#!/usr/bin/env python3
"""Descarga anual de las memorias de empresas del rubro publicadas en la Gaceta Electrónica de Comercio (SEPREC, Bolivia).

Las sociedades anónimas publican por ley su memoria anual, que incluye los estados financieros. La Gaceta (https://gacetadecomercio.gob.bo)
es pública y tiene una API sin clave. Qué hace en cada ejecución (`actualizar`):
  1. Lee el registro de empresas (empresas.json) y pregunta a la Gaceta por las memorias de cada una, por número de matrícula.
  2. Compara con lo que ya conoce (datos/memorias.csv). Las publicaciones nuevas se descargan como PDF a archivo/.
  3. Lee cada PDF nuevo: texto digital si lo tiene, reconocimiento de texto (tesseract) si son páginas escaneadas. Busca el balance y el
     estado de resultados, toma las cifras del último ejercicio y las comprueba con igualdades contables
     (ventas - costo = utilidad bruta; activo = pasivo + patrimonio). Lo que no cuadra queda marcado «revisar».
  4. Agrega las cifras a datos/cifras.csv, avisa de empresas atrasadas y de empresas nuevas del rubro, y escribe el informe de la ejecución.

Solo usa la biblioteca estándar. Para leer PDF necesita pdftotext y pdftoppm (poppler-utils); para páginas escaneadas, tesseract con el idioma español.
Códigos de salida: 0 = terminó bien (aunque no haya memorias nuevas o haya cifras por revisar), 1 = alguna empresa falló, 2 = error fatal.
"""
import argparse
import base64
import concurrent.futures
import csv
import datetime as dt
import hashlib
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

AQUI = Path(__file__).resolve().parent
log = logging.getLogger('gaceta_anual')

COLS_MEMORIAS = ['matricula', 'empresa', 'codigo', 'id_gaceta', 'fecha', 'titulo', 'estado', 'ejercicio', 'paginas', 'paginas_ocr', 'bytes', 'sha256', 'archivo', 'visto_el']
COLS_CIFRAS = ['matricula', 'empresa', 'ejercicio', 'concepto', 'valor', 'publicacion', 'metodo', 'estado', 'visto_el']
COLS_CORR = ['matricula', 'ejercicio', 'concepto', 'valor', 'nota']
# conceptos que se guardan, en bolivianos nominales, tal como los publica cada empresa
CONCEPTOS = ['ventas', 'costo', 'bruto', 'gastos_op', 'operativo', 'neto', 'ac', 'act', 'pc', 'pt', 'pat', 'ppe', 'dep', 'unidades', 'inmuebles', 'obl_inmuebles']
ETIQUETA_CONCEPTO = {'ventas': 'ventas netas', 'costo': 'costo de ventas', 'bruto': 'utilidad bruta', 'operativo': 'resultado operativo', 'neto': 'resultado neto',
                     'ac': 'activo corriente', 'act': 'activo total', 'pc': 'pasivo corriente', 'pt': 'pasivo total', 'pat': 'patrimonio'}


# ----------------------------------------------------------------------------------------------------------------------
# utilidades
# ----------------------------------------------------------------------------------------------------------------------
def sin_tildes(texto):
    return ''.join(c for c in unicodedata.normalize('NFD', str(texto)) if unicodedata.category(c) != 'Mn')


def norm(texto):
    """Mayúsculas, sin tildes y con espacios simples: sirve para comparar nombres y líneas de estados financieros."""
    return re.sub(r'\s+', ' ', sin_tildes(texto).upper()).strip()


# números: 1.234.567,89 · 1,234,567.89 · (2.303.238,90) · -1,595,497.57 · 13 758 083.39
_NUM = re.compile(r'\(?-?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?\)?|\(?-?\d{1,3}(?: \d{3})+[.,]\d{2}\)?|\(?-?\d{4,}(?:[.,]\d{1,2})?\)?')


def numero(token):
    """Convierte un número escrito a la boliviana o a la inglesa. Los paréntesis y el signo menos dan negativo."""
    t = token.strip()
    neg = t.startswith('(') or '-' in t
    t = re.sub(r'[()\-\s]', '', t)
    if not t:
        return None
    if '.' in t and ',' in t:
        dec = '.' if t.rfind('.') > t.rfind(',') else ','
        t = t.replace(',' if dec == '.' else '.', '').replace(dec, '.')
    elif '.' in t or ',' in t:
        sep = '.' if '.' in t else ','
        partes = t.split(sep)
        if len(partes) > 2 and len(partes[-1]) in (1, 2):    # 13.047.684.14: el reconocimiento de texto cambió la coma decimal por un punto
            t = ''.join(partes[:-1]) + '.' + partes[-1]
        elif len(partes) > 2 or len(partes[-1]) == 3:        # 1.234.567 o 1.234: separador de miles
            t = ''.join(partes)
        else:                                                # 1234,5: decimales
            t = partes[0] + '.' + partes[1]
    try:
        v = float(t)
    except ValueError:
        return None
    return -v if neg else v


def valores_de(linea):
    return [v for v in (numero(t) for t in _NUM.findall(linea)) if v is not None]


def fecha(texto):
    """'2026/08/24' o '2026-08-24' a fecha."""
    return dt.date.fromisoformat(str(texto).replace('/', '-')[:10])


# ----------------------------------------------------------------------------------------------------------------------
# registro
# ----------------------------------------------------------------------------------------------------------------------
def cargar_registro(ruta=None):
    p = Path(ruta) if ruta else AQUI / 'empresas.json'
    return json.loads(p.read_text(encoding='utf-8'))


def empresas_activas(registro, ids=None):
    out = [e for e in registro['empresas'] if e.get('seguir', True)]
    return [e for e in out if not ids or e['id'] in ids]


# ----------------------------------------------------------------------------------------------------------------------
# red: la API pública de la Gaceta
# ----------------------------------------------------------------------------------------------------------------------
class Red:
    """Cliente de la API. La API rechaza (403) los pedidos que no traen los encabezados Origin y Referer del sitio de la Gaceta,
    así que se envían; el resto de la identificación es la genérica del programa."""

    def __init__(self, api, origen, agente='gaceta-anual/1.0', espera=1.0, reintentos=3, pausa_reintento=5.0, tamano_max_mb=60):
        self.api, self.origen, self.agente, self.espera = api.rstrip('/'), origen.rstrip('/'), agente, espera
        self.reintentos, self.pausa_reintento = reintentos, pausa_reintento
        self.max_bytes = int(tamano_max_mb * 1024 * 1024 * 1.4)   # el PDF viaja en base64: pesa un tercio más
        self._ultimo = 0.0

    def _esperar(self):
        falta = self.espera - (time.time() - self._ultimo)
        if falta > 0:
            time.sleep(falta)
        self._ultimo = time.time()

    def _pedir(self, metodo, ruta, cuerpo=None):
        self._esperar()
        datos = json.dumps(cuerpo).encode('utf-8') if cuerpo is not None else None
        req = urllib.request.Request(self.api + ruta, data=datos, method=metodo, headers={
            'User-Agent': self.agente, 'Accept': 'application/json', 'Content-Type': 'application/json',
            'Origin': self.origen, 'Referer': self.origen + '/'})
        with urllib.request.urlopen(req, timeout=120) as r:
            crudo = r.read(self.max_bytes + 1)
        if len(crudo) > self.max_bytes:
            raise RuntimeError('la respuesta supera el máximo permitido')
        return json.loads(crudo.decode('utf-8'))

    def _con_reintentos(self, metodo, ruta, cuerpo=None):
        ultimo = None
        for i in range(self.reintentos):
            try:
                d = self._pedir(metodo, ruta, cuerpo)
                if isinstance(d, dict) and d.get('finalizado') is False:
                    raise RuntimeError('la Gaceta respondió: %s' % d.get('mensaje'))
                return d
            except urllib.error.HTTPError as e:
                ultimo = e
                if e.code in (400, 401, 403, 404, 410, 412):      # insistir no sirve
                    break
            except Exception as e:                               # red caída, tiempo agotado, corte de conexión
                ultimo = e
            if i < self.reintentos - 1:
                time.sleep(self.pausa_reintento * (i + 1))
        raise RuntimeError('no se pudo consultar %s: %s' % (ruta, ultimo))

    def buscar(self, razon='', matricula='', categoria='3', pagina=1, limite=100):
        cuerpo = {'fechaInicial': '', 'fecha': '', 'fechaFinal': '', 'categoria': categoria, 'texto': '', 'razonSocial': razon,
                  'tipoPublicacion': '', 'matricula': matricula, 'resumen': '', 'limite': limite, 'pagina': pagina}
        return self._con_reintentos('POST', '/publicaciones', cuerpo)['datos']

    def detalle(self, id_publicacion):
        return self._con_reintentos('GET', '/publicaciones/%s' % id_publicacion)['datos']


def listar_memorias(red, matricula='', razon=''):
    """Todas las memorias anuales de una empresa (por matrícula) o de las que contienen un texto en su nombre."""
    filas, pagina = [], 1
    while True:
        d = red.buscar(razon=razon, matricula=matricula, pagina=pagina)
        for f in d.get('filas', []):
            filas.append({'id': str(f['id']), 'codigo': f['codigo'], 'fecha': fecha(f['fechaPublicacionFormato']).isoformat(),
                          'titulo': f.get('titulo', ''), 'matricula': str(f['empresa']['matricula']), 'razon': f['empresa']['razonSocial'].strip()})
        if not d.get('filas') or pagina * 100 >= d.get('total', 0):
            break
        pagina += 1
    return filas


def descargar_pdf(red, publicacion, carpeta, max_mb=60):
    """Baja el PDF de una publicación a carpeta/<matricula>/<codigo>.pdf. Devuelve ruta, bytes y sha256."""
    d = red.detalle(publicacion['id'])
    doc = d.get('documento')
    if not doc:
        raise RuntimeError('la publicación %s no trae documento' % publicacion['codigo'])
    crudo = base64.b64decode(doc)
    if not crudo.startswith(b'%PDF-'):
        raise RuntimeError('el documento de %s no es un PDF' % publicacion['codigo'])
    if len(crudo) > max_mb * 1024 * 1024:
        raise RuntimeError('el PDF de %s supera el máximo permitido (%d MB)' % (publicacion['codigo'], max_mb))
    destino = Path(carpeta) / publicacion['matricula'] / (publicacion['codigo'].replace('/', '-') + '.pdf')
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(crudo)
    return {'ruta': destino, 'bytes': len(crudo), 'sha256': hashlib.sha256(crudo).hexdigest()}


# ----------------------------------------------------------------------------------------------------------------------
# texto del PDF: capa digital, o reconocimiento de texto en las páginas escaneadas
# ----------------------------------------------------------------------------------------------------------------------
def _cmd(args, **kw):
    return subprocess.run(args, capture_output=True, text=True, **kw)


def _ocr(ruta, pagina, ancho):
    with tempfile.TemporaryDirectory() as tmp:
        base = os.path.join(tmp, 'pg')
        _cmd(['pdftoppm', '-f', str(pagina), '-l', str(pagina), '-scale-to', str(ancho), '-gray', '-png', str(ruta), base])
        png = [os.path.join(tmp, x) for x in os.listdir(tmp) if x.endswith('.png')]
        if not png:
            return ''
        return _cmd(['tesseract', png[0], '-', '-l', 'spa', '--psm', '6', '-c', 'preserve_interword_spaces=1'], env=dict(os.environ, OMP_THREAD_LIMIT='1')).stdout


MAX_PAGINAS_OCR = 120
_MILES = re.compile(r'\d{1,3}(?:[.,]\d{3})+')


def texto_paginas(ruta, ocr=True):
    """Texto de cada página: [(numero, texto, metodo)] con metodo 'texto' u 'ocr'. Se reconocen con tesseract (a 1900 píxeles de alto; en baja
    resolución las cifras salen ilegibles) las páginas sin capa de texto y las que solo tienen un encabezado digital y casi ninguna cifra,
    que es como quedan las tablas insertadas como imagen."""
    info = _cmd(['pdfinfo', str(ruta)]).stdout
    m = re.search(r'Pages:\s+(\d+)', info)
    n = int(m.group(1)) if m else 0
    if n == 0:
        raise RuntimeError('no se pudo abrir el PDF (¿está dañado?)')
    paginas, pendientes = {}, []
    for p in range(1, n + 1):
        t = _cmd(['pdftotext', '-f', str(p), '-l', str(p), '-layout', str(ruta), '-']).stdout
        corto = len(t.strip()) < 80
        mixta = (not corto) and len(t.strip()) < 700 and len(_MILES.findall(t)) < 10
        paginas[p] = (t, 'imagen' if corto else 'texto')
        if corto or mixta:
            pendientes.append(p)
    pendientes = pendientes[:MAX_PAGINAS_OCR]
    if pendientes and ocr and shutil.which('tesseract') and shutil.which('pdftoppm'):
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            for p, t in zip(pendientes, pool.map(lambda q: _ocr(ruta, q, 1900), pendientes)):
                paginas[p] = ((paginas[p][0] + '\n' + t).strip(), 'ocr')
    return [(p, t, metodo if metodo != 'imagen' else 'texto') for p, (t, metodo) in sorted(paginas.items())]


# ----------------------------------------------------------------------------------------------------------------------
# lectura de los estados financieros
# ----------------------------------------------------------------------------------------------------------------------
# Cada concepto: patrones en orden de preferencia, sobre la línea normalizada (mayúsculas, sin tildes). Se admite hasta 3 caracteres de
# basura al comienzo de la línea, que es lo que deja el reconocimiento de texto.
PATRONES = {
    'ventas': [r'VENTAS NETAS\b', r'INGRESOS? OPERATIVOS? N[EO]TOS?\b', r'INGRESOS? NETOS?\b', r'INGRESOS? POR VENTAS?\b', r'VENTAS(?! BRUTAS)( Y SERVICIOS)?\b'],
    'costo': [r'(TOTAL )?COSTO DE (LAS |LOS )?(VENTAS|MERCADERIAS?)( DE LO VENDIDO)?\b'],
    'bruto': [r'(UTILIDAD|RESULTADO|PERDIDA|MARGEN) BRUT[AO]\b'],
    'operativo': [r'(UTILIDAD|RESULTADO|PERDIDA) (NETA )?(OPERATIV[OA]|OPERACIONAL|DE OPERACION|EN OPERACION)\b', r'RESULTADO NETO DE OPERACION\b'],
    'neto': [r'(\(?PERDIDA\)? )?(UTILIDAD|RESULTADO|PERDIDA|GANANCIA)( \(?PERDIDA\)?)?( NET[OA])? (DEL EJERCICIO|DE LA GESTION|DEL PERIODO)\b(?! ANTES)',
             r'RESULTADO NETO\b(?! DE OPERACION)(?! OPERATIV)'],
    'ac': [r'TOTAL ACTIVOS? CORRIENTES?\b', r'ACTIVOS? CORRIENTES?\b'],
    'act': [r'TOTAL (DEL )?ACTIVOS?\b(?! (NO |FIJO|CORRIENTE|DIFERIDO|INTANGIBLE|TANGIBLE))'],
    'pc': [r'TOTAL PASIVOS? CORRIENTES?\b', r'PASIVOS? CORRIENTES?\b'],
    'pnc': [r'(TOTAL )?PASIVOS? NO CORRIENTES?\b'],
    'pt': [r'TOTAL (DEL )?PASIVOS?\b(?! (NO |CORRIENTE))(?! Y )'],
    'pat': [r'TOTAL PATRIMONIO( NETO)?\b', r'PATRIMONIO NETO\b', r'CAPITAL, RESERVAS? Y RESULTADOS\b', r'PATRIMONIO\b(?! Y )'],
    'disponible': [r'DISPONIBLES?\b'], 'exigible': [r'EXIGIBLES?\b'], 'realizable': [r'REALIZABLES?\b'],
    'dep_res': [r'DEPRECIACIONES?\b'],
}
_ANIO = re.compile(r'\b(20\d\d)\b|\b(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC)[-/ ](\d\d)\b')
_BASURA = re.compile(r'^[\W_]+')


def _anios(lineas):
    """Años que aparecen en las líneas, en orden (sin repetir el mismo año seguido)."""
    out = []
    for ln in lineas:
        for m in _ANIO.finditer(norm(ln)):
            a = int(m.group(1)) if m.group(1) else 2000 + int(m.group(2))
            if 2000 <= a <= 2100 and (not out or out[-1] != a):
                out.append(a)
    return out


_RANGO = re.compile(r'\b20\d\d\s*[/-]\s*20\d\d\b')
_RUIDO = re.compile(r'\b(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC)[-/ ]\d\d\b|\b20\d\d\b|\bNOTAS?\b|\bREEXPRESADO\b|\bBS\b|[^A-Z ]')


def encabezado(lineas):
    """Años de las columnas en el orden en que están escritas y el ejercicio (el mayor). La cabecera de columnas es la línea con dos años
    distintos y menos palabras, por ejemplo «MAR-25 NOTAS MAR-26» o «2025 2024». No cuentan los rangos («2024/2025»), el encabezado corrido de la
    página («MEMORIA ANUAL 2026») ni los títulos largos («DEL 1 DE ABRIL DE 2023 AL 31 DE MARZO DE 2024») mientras haya una cabecera mejor."""
    candidatas = []
    for ln in lineas[:45]:
        n = norm(ln)
        if 'MEMORIA' in n or re.search(r'\bPAG\b', n) or _RANGO.search(n):
            continue
        candidatas.append(ln)
    mejor = None
    for i, ln in enumerate(candidatas):
        a = _anios([ln])
        if len(set(a)) >= 2:
            palabras = len([w for w in _RUIDO.sub(' ', norm(ln)).split() if len(w) >= 2])
            if mejor is None or palabras < mejor[0]:
                mejor = (palabras, a)
    if mejor:
        # un título largo («DEL 1 DE ABRIL DE 2025 AL 31 DE MARZO DE 2026») describe el período, no dice en qué orden van las columnas
        return (mejor[1] if mejor[0] <= 2 else []), max(mejor[1])
    todos = _anios(candidatas)
    return [], (max(todos) if todos else None)


def _buscar(patron, limpia):
    return re.match(r'.{0,3}?(?:%s)' % patron, limpia)


def leer_pagina(texto):
    """Cifras de una página: ({concepto: [valores de la línea]}, años de las columnas, ejercicio, columnas por línea)."""
    lineas = texto.splitlines()
    cifras = {}
    for concepto, pats in PATRONES.items():
        for pat in pats:
            hallada = None
            for ln in lineas:
                limpia = _BASURA.sub('', norm(ln))
                if _buscar(pat, limpia):
                    vals = valores_de(ln)
                    if vals:
                        hallada = vals
                        break
            if hallada:
                cifras[concepto] = hallada
                break
    lens = [len(v) for c, v in cifras.items() if c not in ('disponible', 'exigible', 'realizable', 'dep_res')]
    k = 2 if lens and sum(1 for n in lens if n >= 2) * 2 >= len(lens) else 1
    columnas, ejercicio = encabezado(lineas)
    return cifras, columnas, ejercicio, k


def _valor_actual(vals, ascendente, k):
    """Con dos columnas, cuál es la del ejercicio actual: si los años del encabezado suben (2025 2026) es la segunda."""
    if k == 1 or len(vals) == 1:
        return vals[0]
    return vals[1] if ascendente else vals[0]


def _es_estado(n):
    balance = bool(re.search(r'TOTAL (DEL )?ACTIVOS?\b|TOTAL PASIVOS?\b|TOTAL PATRIMONIO|PATRIMONIO NETO|TOTAL PASIVO Y PATRIMONIO', n))
    resultado = bool(re.search(r'COSTO DE (LAS )?(VENTAS|MERCADERIAS?)', n)) and bool(re.search(r'UTILIDAD|RESULTADO|PERDIDA|GANANCIA', n)) and 'GASTOS' in n
    return balance or resultado


def leer_memoria(paginas):
    """Busca el balance y el estado de resultados entre las páginas del PDF y devuelve las cifras del último ejercicio.
    Las páginas sin años en el encabezado heredan el orden de columnas de otra página de la misma memoria."""
    por_concepto, paginas_usadas, ejercicios = {}, {}, []
    candidatas = []
    for p, texto, _ in paginas:
        if _es_estado(norm(texto)):
            cifras, columnas, ejercicio, k = leer_pagina(texto)
            if cifras:
                candidatas.append((len(cifras), p, cifras, columnas, ejercicio, k))
    candidatas.sort(key=lambda x: (-x[0], x[1]))
    orden_doc = next((cols[0] < cols[-1] for _, _, _, cols, _, _ in candidatas if len(set(cols)) >= 2), None)
    alertas, avisos = [], []
    for _, p, cifras, columnas, ejercicio, k in candidatas:
        if len(set(columnas)) >= 2:
            ascendente = columnas[0] < columnas[-1]
        else:
            ascendente = orden_doc
        if k == 2 and ascendente is None and not any(a.startswith('no se pudo saber') for a in alertas):
            alertas.append('no se pudo saber qué columna es el ejercicio actual (el encabezado no trae años)')
        for c, vals in cifras.items():
            if c not in por_concepto:
                por_concepto[c] = _valor_actual(vals[:2], bool(ascendente), k)
                paginas_usadas[c] = p
        if ejercicio:
            ejercicios.append(ejercicio)
    ejercicio = max(set(ejercicios), key=lambda a: (ejercicios.count(a), a)) if ejercicios else None      # el que más páginas dicen; si empatan, el mayor
    if not candidatas:
        alertas.append('no se encontró el balance ni el estado de resultados')
    c = por_concepto
    metodo_pagina = {p: m for p, _, m in paginas}
    if any(metodo_pagina.get(p) == 'ocr' for p in paginas_usadas.values()):
        alertas.append('leída por reconocimiento de texto (OCR): hay que confirmar las cifras contra el PDF')
    # el balance se comprueba solo con cifras leídas por separado: activo, pasivo y patrimonio (o pasivo corriente y no corriente)
    independiente = all(k in c for k in ('act', 'pt', 'pat')) or all(k in c for k in ('act', 'pc', 'pnc', 'pat'))
    if not independiente and 'act' in c:
        alertas.append('no se pudo comprobar el balance: falta alguna de las líneas de pasivo y patrimonio')
    # el costo se guarda siempre positivo; algunas empresas lo escriben entre paréntesis o con signo menos
    if 'costo' in c:
        c['costo'] = abs(c['costo'])
    # Inbolteco y otras restan la depreciación de planta entre el costo y la utilidad bruta: se suma al costo
    if all(k in c for k in ('ventas', 'costo', 'bruto', 'dep_res')) and abs(c['ventas'] - c['costo'] - c['bruto']) > max(1000, 0.002 * abs(c['ventas'])):
        if abs(c['ventas'] - c['costo'] - abs(c['dep_res']) - c['bruto']) <= max(1000, 0.002 * abs(c['ventas'])):
            c['costo'] += abs(c['dep_res'])
            avisos.append('el costo incluye la depreciación que la empresa muestra aparte')
    # derivados: activo corriente, pasivo total, patrimonio y gastos de operación cuando la empresa no los trae como línea
    if 'ac' not in c and all(k in c for k in ('disponible', 'exigible', 'realizable')):
        c['ac'] = c['disponible'] + c['exigible'] + c['realizable']
    if 'pt' not in c and 'pc' in c and 'pnc' in c:
        c['pt'] = c['pc'] + c['pnc']
    if 'pt' not in c and 'act' in c and 'pat' in c:
        c['pt'] = c['act'] - c['pat']
    if 'pat' not in c and 'act' in c and 'pt' in c:
        c['pat'] = c['act'] - c['pt']
    if all(k in c for k in ('pc', 'pnc', 'pt')) and abs(c['pc'] + c['pnc'] - c['pt']) > max(1000, 0.0005 * abs(c['pt'])):
        alertas.append('pasivo corriente + no corriente no da el pasivo total')
    if 'bruto' in c and 'operativo' in c:
        c['gastos_op'] = c['bruto'] - c['operativo']
    for aux in ('disponible', 'exigible', 'realizable', 'pnc', 'dep_res'):
        c.pop(aux, None)
    return {'ejercicio': ejercicio, 'cifras': c, 'paginas': paginas_usadas, 'avisos': avisos, 'alertas': alertas}


def validar(c):
    """Igualdades contables. Devuelve ('ok'|'revisar', [avisos])."""
    avisos = []
    if 'ventas' not in c:
        avisos.append('falta el estado de resultados')
    if 'act' not in c:
        avisos.append('falta el balance')
    if all(k in c for k in ('ventas', 'costo', 'bruto')):
        d = c['ventas'] - c['costo'] - c['bruto']
        if abs(d) > max(1000, 0.002 * abs(c['ventas'])):
            avisos.append('ventas - costo no da la utilidad bruta (diferencia %s)' % format(round(d), ',').replace(',', '.'))
    if all(k in c for k in ('act', 'pt', 'pat')):
        d = c['act'] - c['pt'] - c['pat']
        if abs(d) > max(1000, 0.0005 * abs(c['act'])):
            avisos.append('activo - pasivo - patrimonio no da cero (diferencia %s)' % format(round(d), ',').replace(',', '.'))
    if 'ac' in c and 'act' in c and c['ac'] > c['act'] * 1.0001:
        avisos.append('el activo corriente supera al activo total')
    if 'ventas' in c and abs(c['ventas']) < 100000:
        avisos.append('ventas menores a Bs 100.000: ¿cifras en miles?')
    return ('revisar' if avisos else 'ok'), avisos


# ----------------------------------------------------------------------------------------------------------------------
# almacén: CSV estables y estado
# ----------------------------------------------------------------------------------------------------------------------
def _leer_csv(ruta, cols):
    if not Path(ruta).exists():
        return []
    with open(ruta, encoding='utf-8', newline='') as f:
        return [{c: (r.get(c) or '') for c in cols} for r in csv.DictReader(f)]


def _escribir_csv(ruta, cols, filas, clave):
    with open(ruta, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols, lineterminator='\n')
        w.writeheader()
        for r in sorted(filas, key=clave):
            w.writerow({c: r.get(c, '') for c in cols})


class Almacen:
    def __init__(self, carpeta):
        self.dir = Path(carpeta)
        (self.dir / 'informes').mkdir(parents=True, exist_ok=True)

    def estado(self):
        p = self.dir / 'estado.json'
        return json.loads(p.read_text(encoding='utf-8')) if p.exists() else {'version': 1, 'ultima_ejecucion': None, 'empresas': {}}

    def guardar_estado(self, estado):
        with open(self.dir / 'estado.json', 'w', encoding='utf-8') as f:
            json.dump(estado, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write('\n')

    def memorias(self):
        return _leer_csv(self.dir / 'memorias.csv', COLS_MEMORIAS)

    def guardar_memorias(self, filas):
        _escribir_csv(self.dir / 'memorias.csv', COLS_MEMORIAS, filas, lambda r: (r['matricula'], r['fecha'], r['codigo']))

    def cifras(self):
        return _leer_csv(self.dir / 'cifras.csv', COLS_CIFRAS)

    def guardar_cifras(self, filas):
        _escribir_csv(self.dir / 'cifras.csv', COLS_CIFRAS, filas, lambda r: (r['matricula'], r['ejercicio'], CONCEPTOS.index(r['concepto']) if r['concepto'] in CONCEPTOS else 99))

    def correcciones(self):
        return _leer_csv(self.dir / 'correcciones.csv', COLS_CORR)

    def guardar_correcciones(self, filas):
        _escribir_csv(self.dir / 'correcciones.csv', COLS_CORR, filas, lambda r: (r['matricula'], r['ejercicio'], r['concepto']))


def fusionar_cifras(existentes, nuevas):
    """Agrega las cifras leídas. Una cifra verificada a mano no se pisa; si la memoria nueva trae otro valor, se informa."""
    por_clave = {(r['matricula'], r['ejercicio'], r['concepto']): r for r in existentes}
    cambios = []
    for r in nuevas:
        k = (r['matricula'], r['ejercicio'], r['concepto'])
        previo = por_clave.get(k)
        if previo is None:
            por_clave[k] = r
        elif previo['metodo'] == 'manual':
            if abs(float(previo['valor']) - float(r['valor'])) > 1:
                cambios.append((k, previo['valor'], r['valor']))
        else:
            por_clave[k] = r
    return list(por_clave.values()), cambios


# ----------------------------------------------------------------------------------------------------------------------
# ejecución
# ----------------------------------------------------------------------------------------------------------------------
def _atrasada(empresa, ultima_fecha, hoy, ventana):
    """Los ejercicios que cierran en marzo se publican de junio a octubre. Pasado el plazo, una empresa sin memoria de este año está atrasada."""
    mes_cierre = empresa.get('cierre_mes', 3)
    if mes_cierre != 3:
        return False
    plazo = dt.date(hoy.year, ventana.get('plazo_mes', 10), 28) + dt.timedelta(days=4)        # 1 de noviembre
    plazo = dt.date(plazo.year, plazo.month, 1)
    if hoy < plazo:
        return False
    inicio = dt.date(hoy.year, ventana.get('inicio_mes', 6), 1)
    return ultima_fecha is None or ultima_fecha < inicio


def procesar_empresa(e, ctx):
    pubs = listar_memorias(ctx.red, matricula=e['matricula'])
    conocidas = {r['codigo'] for r in ctx.memorias if r['matricula'] == e['matricula']}
    nuevas = [p for p in pubs if p['codigo'] not in conocidas]
    resultado = {'id': e['id'], 'empresa': e['nombre'], 'tipo': e.get('tipo', ''), 'estado': 'sin_novedad', 'nuevas': [], 'por_revisar': [], 'errores_pub': [],
                 'total_publicaciones': len(pubs), 'mensaje': '', 'cambios': []}
    ultima = max((p['fecha'] for p in pubs), default=None)
    resultado['ultima_publicacion'] = ultima
    for p in sorted(nuevas, key=lambda x: x['fecha']):
        fila = {'matricula': e['matricula'], 'empresa': e['nombre'], 'codigo': p['codigo'], 'id_gaceta': p['id'], 'fecha': p['fecha'], 'titulo': p['titulo'],
                'estado': 'descargada', 'visto_el': ctx.hoy.isoformat()}
        try:
            d = descargar_pdf(ctx.red, p, ctx.dir_archivo, ctx.max_mb)
            fila.update({'bytes': d['bytes'], 'sha256': d['sha256'], 'archivo': str(Path(d['ruta']).relative_to(ctx.dir_archivo))})
            if ctx.leer:
                paginas = texto_paginas(d['ruta'], ocr=ctx.ocr)
                fila['paginas'] = len(paginas)
                fila['paginas_ocr'] = sum(1 for _, _, m in paginas if m == 'ocr')
                lectura = leer_memoria(paginas)
                estado, avisos = validar(lectura['cifras'])
                avisos = lectura['alertas'] + avisos + lectura['avisos']
                if lectura['alertas']:
                    estado = 'revisar'
                ejercicio = lectura['ejercicio'] or (ctx.hoy.year if not lectura['cifras'] else '')
                fila['ejercicio'] = ejercicio
                fila['estado'] = 'leida' if estado == 'ok' else 'revisar'
                for c, v in lectura['cifras'].items():
                    if c in CONCEPTOS and ejercicio:
                        ctx.cifras_nuevas.append({'matricula': e['matricula'], 'empresa': e['nombre'], 'ejercicio': str(ejercicio), 'concepto': c, 'valor': repr(round(v, 2)),
                                                  'publicacion': p['codigo'], 'metodo': 'auto', 'estado': estado, 'visto_el': ctx.hoy.isoformat()})
                if estado != 'ok':
                    resultado['por_revisar'].append({'codigo': p['codigo'], 'ejercicio': ejercicio, 'avisos': avisos})
            resultado['nuevas'].append({'codigo': p['codigo'], 'fecha': p['fecha'], 'archivo': fila.get('archivo', ''), 'estado': fila['estado'], 'ejercicio': fila.get('ejercicio', '')})
        except Exception as ex:
            log.error('%s %s: %s', e['id'], p['codigo'], ex)
            fila['estado'] = 'error_descarga'
            resultado['errores_pub'].append({'codigo': p['codigo'], 'mensaje': str(ex)})
            continue            # no se registra como conocida: se reintenta en la próxima ejecución
        ctx.memorias.append(fila)
    if resultado['errores_pub']:
        resultado['estado'] = 'error'
        resultado['mensaje'] = '; '.join('%s: %s' % (x['codigo'], x['mensaje']) for x in resultado['errores_pub'])
    elif resultado['nuevas']:
        resultado['estado'] = 'nuevas'
    ultima_d = fecha(ultima) if ultima else None
    resultado['atrasada'] = _atrasada(e, ultima_d, ctx.hoy, ctx.registro.get('ventana', {}))
    return resultado


def descubrir(ctx):
    """Empresas del rubro que publicaron memoria y no están en el registro (ni seguidas ni ignoradas)."""
    conocidas = {e['matricula'] for e in ctx.registro['empresas']} | {e['matricula'] for e in ctx.registro.get('ignoradas', [])}
    vistas = {}
    for termino in ctx.registro.get('descubrir', []):
        for p in listar_memorias(ctx.red, razon=termino):
            if p['matricula'] not in conocidas:
                v = vistas.setdefault(p['matricula'], {'matricula': p['matricula'], 'razon': p['razon'], 'ultima': p['fecha'], 'memorias': 0})
                v['memorias'] += 1
                v['ultima'] = max(v['ultima'], p['fecha'])
    return sorted(vistas.values(), key=lambda v: v['razon'])


class Contexto:
    def __init__(self, red, almacen, registro, dir_archivo, hoy, leer=True, ocr=True):
        self.red, self.almacen, self.registro, self.dir_archivo, self.hoy = red, almacen, registro, Path(dir_archivo), hoy
        self.leer, self.ocr = leer, ocr
        self.max_mb = registro.get('tamano_maximo_mb', 60)
        self.memorias = almacen.memorias()
        self.cifras_nuevas = []


def actualizar(dir_datos, dir_archivo, registro, ids=None, hoy=None, buscar_nuevas=True, leer=True, ocr=True, espera=None, api=None):
    hoy = hoy or dt.date.today()
    api = api or registro.get('api', 'https://servicios.seprec.gob.bo/api')
    red = Red(api, registro.get('origen', 'https://gacetadecomercio.gob.bo'), registro.get('agente', 'gaceta-anual/1.0'),
              registro.get('espera_segundos', 1.0) if espera is None else espera, tamano_max_mb=registro.get('tamano_maximo_mb', 60),
              pausa_reintento=0.0 if espera == 0 else 5.0)
    almacen = Almacen(dir_datos)
    Path(dir_archivo).mkdir(parents=True, exist_ok=True)
    ctx = Contexto(red, almacen, registro, dir_archivo, hoy, leer=leer, ocr=ocr)
    estado = almacen.estado()
    resultados = []
    for e in empresas_activas(registro, ids):
        log.info('→ %s', e['id'])
        try:
            r = procesar_empresa(e, ctx)
        except Exception as ex:
            log.error('%s: %s', e['id'], traceback.format_exc())
            r = {'id': e['id'], 'empresa': e['nombre'], 'tipo': e.get('tipo', ''), 'estado': 'error', 'nuevas': [], 'por_revisar': [], 'errores_pub': [], 'cambios': [],
                 'total_publicaciones': None, 'mensaje': 'error inesperado: %s' % ex, 'ultima_publicacion': None, 'atrasada': False}
        log.info('   %s %s', r['estado'], r.get('mensaje', ''))
        resultados.append(r)
        estado['empresas'][e['id']] = {'revisada_el': hoy.isoformat(), 'ultima_publicacion': r.get('ultima_publicacion'), 'publicaciones': r.get('total_publicaciones'),
                                       'error': r['mensaje'] if r['estado'] == 'error' else None}
        almacen.guardar_memorias(ctx.memorias)                       # si la ejecución se corta, lo ya hecho no se pierde
    cifras, cambios = fusionar_cifras(almacen.cifras(), ctx.cifras_nuevas)
    almacen.guardar_cifras(cifras)
    for r in resultados:
        r['cambios'] = [c for c in cambios if c[0][0] == next((x['matricula'] for x in registro['empresas'] if x['id'] == r['id']), None)]
    descubiertas = []
    if buscar_nuevas:
        try:
            descubiertas = descubrir(ctx)
        except Exception as ex:
            log.error('no se pudo buscar empresas nuevas: %s', ex)
    estado['ultima_ejecucion'] = hoy.isoformat()
    almacen.guardar_estado(estado)
    informe = redactar_informe(resultados, descubiertas, hoy)
    (almacen.dir / 'informes' / ('%s.md' % hoy.isoformat())).write_text(informe, encoding='utf-8')
    (almacen.dir / 'ultimo_informe.md').write_text(informe, encoding='utf-8')
    resumen = {'fecha': hoy.isoformat(), 'empresas': len(resultados),
               'con_memorias_nuevas': [r['id'] for r in resultados if r['nuevas']],
               'por_revisar': [r['id'] for r in resultados if r['por_revisar']],
               'errores': [r['id'] for r in resultados if r['estado'] == 'error'],
               'atrasadas': [r['id'] for r in resultados if r.get('atrasada')],
               'descubiertas': descubiertas}
    (almacen.dir / 'ultimo_resumen.json').write_text(json.dumps(resumen, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    return resultados, informe


# ----------------------------------------------------------------------------------------------------------------------
# informe
# ----------------------------------------------------------------------------------------------------------------------
ETIQUETA = {'sin_novedad': 'sin memorias nuevas', 'nuevas': 'memorias nuevas', 'error': 'ERROR'}


def redactar_informe(resultados, descubiertas, hoy):
    nuevas = sum(len(r['nuevas']) for r in resultados)
    atrasadas = [r for r in resultados if r.get('atrasada')]
    L = ['# Memorias del rubro en la Gaceta de SEPREC: %s' % hoy.isoformat(), '']
    partes = ['%d empresas' % len(resultados), '%d memorias nuevas' % nuevas]
    if any(r['por_revisar'] for r in resultados):
        partes.append('%d con cifras por revisar' % sum(1 for r in resultados if r['por_revisar']))
    if atrasadas:
        partes.append('%d atrasada%s' % (len(atrasadas), '' if len(atrasadas) == 1 else 's'))
    if descubiertas:
        partes.append('%d empresa%s nueva%s del rubro' % (len(descubiertas), '' if len(descubiertas) == 1 else 's', '' if len(descubiertas) == 1 else 's'))
    L += [' · '.join(partes), '']
    L += ['| Empresa | Tipo | Estado | Última publicación | Memorias nuevas | Nota |', '|---|---|---|---|---:|---|']
    for r in resultados:
        nota = []
        if r.get('atrasada'):
            nota.append('atrasada: no publicó este año')
        if r['estado'] == 'error':
            nota.append(r['mensaje'])
        L.append('| %s | %s | %s | %s | %d | %s |' % (r['empresa'], r.get('tipo', ''), ETIQUETA.get(r['estado'], r['estado']), r.get('ultima_publicacion') or '—', len(r['nuevas']),
                                                      '; '.join(nota).replace('|', '/').replace('\n', ' ')))
    if nuevas:
        L += ['', '## Memorias nuevas', '']
        for r in resultados:
            for n in r['nuevas']:
                L.append('- **%s**, publicación %s (%s), ejercicio %s: %s' % (r['empresa'], n['codigo'], n['fecha'], n['ejercicio'] or 'sin determinar',
                                                                           'cifras leídas y comprobadas' if n['estado'] == 'leida' else 'hay que revisar las cifras'))
    revisar = [(r, x) for r in resultados for x in r['por_revisar']]
    if revisar:
        L += ['', '## Cifras por revisar', '',
              'La lectura automática no pudo comprobar estas memorias. El PDF está en la copia cruda de la ejecución. Se revisa contra el PDF y se corrige lo que esté mal:',
              '`python3 -I gaceta-anual/gaceta_anual.py corregir --empresa ID --ejercicio AAAA --concepto ventas --valor 12345.67 --nota "..."`',
              'y después se da por buena la lectura (entra a la exportación):',
              '`python3 -I gaceta-anual/gaceta_anual.py confirmar --empresa ID --ejercicio AAAA`', '']
        for r, x in revisar:
            L.append('- **%s**, publicación %s, ejercicio %s: %s' % (r['empresa'], x['codigo'], x['ejercicio'] or 'sin determinar', '; '.join(x['avisos'])))
    cambios = [(r, c) for r in resultados for c in r.get('cambios', [])]
    if cambios:
        L += ['', '## Valores verificados a mano que la memoria nueva trae distintos', '']
        for r, ((m, ej, c), a, n) in cambios:
            L.append('- **%s**, ejercicio %s, %s: guardado %s, la memoria dice %s (¿reexpresión por inflación?)' % (r['empresa'], ej, ETIQUETA_CONCEPTO.get(c, c), a, n))
    if descubiertas:
        L += ['', '## Empresas nuevas del rubro', '', 'Publicaron memoria y no están en `empresas.json`. Hay que decidir si se siguen o se ignoran.', '']
        for d in descubiertas:
            L.append('- %s (matrícula %s), %d memoria%s, la última del %s' % (d['razon'], d['matricula'], d['memorias'], '' if d['memorias'] == 1 else 's', d['ultima']))
    errores = [r for r in resultados if r['estado'] == 'error']
    if errores:
        L += ['', '## Errores', '']
        L += ['- **%s**: %s' % (r['empresa'], r['mensaje']) for r in errores]
    return '\n'.join(L) + '\n'


# ----------------------------------------------------------------------------------------------------------------------
# estado, correcciones y exportación
# ----------------------------------------------------------------------------------------------------------------------
def mostrar_estado(dir_datos, registro, hoy):
    alm = Almacen(dir_datos)
    est = alm.estado()
    ults, pubs = {}, {}
    for r in alm.cifras():
        ults[r['matricula']] = max(ults.get(r['matricula'], ''), r['ejercicio'])
    for r in alm.memorias():
        pubs[r['matricula']] = max(pubs.get(r['matricula'], ''), r['fecha'])
    print('Última ejecución:', est.get('ultima_ejecucion') or 'nunca')
    print('%-14s %-12s %-12s %-16s %s' % ('empresa', 'tipo', 'ejercicio', 'última memoria', 'estado'))
    for e in registro['empresas']:
        s = est['empresas'].get(e['id'], {})
        print('%-14s %-12s %-12s %-16s %s' % (e['nombre'][:14], e.get('tipo', ''), ults.get(e['matricula'], '—'), s.get('ultima_publicacion') or pubs.get(e['matricula']) or '—', s.get('error') or ''))


def valores_vigentes(alm):
    """Cifras por empresa y ejercicio. Mandan las correcciones, luego lo verificado a mano y por último la lectura automática."""
    out = {}
    for r in alm.cifras():
        if r['estado'] == 'revisar':
            continue                     # no se usa hasta que alguien la corrija o la confirme
        out.setdefault((r['matricula'], r['ejercicio']), {})[r['concepto']] = (float(r['valor']), r['metodo'])
    for r in alm.correcciones():
        out.setdefault((r['matricula'], r['ejercicio']), {})[r['concepto']] = (float(r['valor']), 'correccion')
    return out


def razones(e, margenes=True):
    """Razones de un ejercicio. Con margenes=False (empresa que casi no vende) solo salen las del balance."""
    r = {}
    v = e.get('ventas')
    if v and margenes:
        r['bruto'] = e['bruto'] / v * 100 if e.get('bruto') is not None else None
        r['gastos_op'] = (e['bruto'] - e['operativo']) / v * 100 if e.get('bruto') is not None and e.get('operativo') is not None else None
        r['operativo'] = e['operativo'] / v * 100 if e.get('operativo') is not None else None
        r['neto'] = e['neto'] / v * 100 if e.get('neto') is not None else None
    if e.get('ac') and e.get('pc'):
        r['razon'] = e['ac'] / e['pc']
    if e.get('pt') is not None and e.get('act'):
        r['pasivo_activo'] = e['pt'] / e['act'] * 100
    if e.get('dep') and e.get('ppe'):
        r['dep_ppe'] = e['dep'] / e['ppe'] * 100
    return r


def exportar(dir_datos, destino, registro):
    """Escribe pares.json: por empresa y ejercicio, los montos y las razones que usa el tablero de finanzas."""
    alm = Almacen(dir_datos)
    vig = valores_vigentes(alm)
    pares = []
    for e in registro['empresas']:
        if not e.get('seguir', True):
            continue
        margenes = e.get('margenes', True)
        ej, rr = {}, {}
        for (m, anio), conceptos in sorted(vig.items()):
            if m != e['matricula'] or not conceptos.get('ventas'):
                continue
            montos = {c: v for c, (v, _) in conceptos.items()}
            ej[anio] = montos
            rr[anio] = {k: (round(v, 4) if v is not None else None) for k, v in razones(montos, margenes).items()}
        if ej:
            pares.append({'id': e['id'], 'nombre': e['nombre'], 'razon': e.get('razon', e['nombre']), 'tipo': e.get('tipo', ''), 'depto': e.get('depto', ''),
                          'giro': e.get('giro', ''), 'nota': e.get('nota', ''), 'margenes': margenes, 'ej': ej, 'rr': rr})
    Path(destino).mkdir(parents=True, exist_ok=True)
    (Path(destino) / 'pares.json').write_text(json.dumps({'generado': dt.date.today().isoformat(), 'pares': pares}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    return pares


def corregir(dir_datos, registro, empresa, ejercicio, concepto, valor, nota=''):
    e = next((x for x in registro['empresas'] if x['id'] == empresa), None)
    if e is None:
        raise SystemExit('empresa desconocida: %s' % empresa)
    if concepto not in CONCEPTOS:
        raise SystemExit('concepto desconocido: %s (usa uno de %s)' % (concepto, ', '.join(CONCEPTOS)))
    alm = Almacen(dir_datos)
    filas = [r for r in alm.correcciones() if not (r['matricula'] == e['matricula'] and r['ejercicio'] == str(ejercicio) and r['concepto'] == concepto)]
    filas.append({'matricula': e['matricula'], 'ejercicio': str(ejercicio), 'concepto': concepto, 'valor': repr(float(valor)), 'nota': nota})
    alm.guardar_correcciones(filas)


def conocer(dir_datos, registro, ids=None, hoy=None, api=None, espera=None):
    """Registra como conocidas, sin descargarlas, las publicaciones que las empresas ya tienen en la Gaceta. Sirve al agregar una empresa al registro:
    así la próxima ejecución solo baja lo que se publique después."""
    hoy = hoy or dt.date.today()
    api = api or registro.get('api', 'https://servicios.seprec.gob.bo/api')
    red = Red(api, registro.get('origen', 'https://gacetadecomercio.gob.bo'), registro.get('agente', 'gaceta-anual/1.0'),
              registro.get('espera_segundos', 1.0) if espera is None else espera, pausa_reintento=0.0 if espera == 0 else 5.0)
    alm = Almacen(dir_datos)
    filas = alm.memorias()
    vistas = {(r['matricula'], r['codigo']) for r in filas}
    n = 0
    for e in empresas_activas(registro, ids):
        for p in listar_memorias(red, matricula=e['matricula']):
            if (e['matricula'], p['codigo']) not in vistas:
                filas.append({'matricula': e['matricula'], 'empresa': e['nombre'], 'codigo': p['codigo'], 'id_gaceta': p['id'], 'fecha': p['fecha'],
                              'titulo': p['titulo'], 'estado': 'carga_inicial', 'visto_el': hoy.isoformat()})
                n += 1
    alm.guardar_memorias(filas)
    return n


def confirmar(dir_datos, registro, empresa, ejercicio):
    """Da por buena la lectura de un ejercicio que alguien revisó contra el PDF: las cifras pasan a 'ok' y 'manual' y entran a la exportación."""
    e = next((x for x in registro['empresas'] if x['id'] == empresa), None)
    if e is None:
        raise SystemExit('empresa desconocida: %s' % empresa)
    alm = Almacen(dir_datos)
    filas, n = alm.cifras(), 0
    for r in filas:
        if r['matricula'] == e['matricula'] and r['ejercicio'] == str(ejercicio) and (r['estado'] != 'ok' or r['metodo'] != 'manual'):
            r['estado'], r['metodo'], n = 'ok', 'manual', n + 1
    if not n:
        raise SystemExit('no hay cifras por confirmar para %s %s' % (empresa, ejercicio))
    alm.guardar_cifras(filas)
    return n


def leer_archivo(ruta, ocr=True):
    """Lee un PDF suelto (por ejemplo, una memoria que entregó la gerencia) y muestra las cifras y su comprobación, sin guardar nada."""
    lectura = leer_memoria(texto_paginas(ruta, ocr=ocr))
    estado, avisos = validar(lectura['cifras'])
    if lectura['alertas']:
        estado = 'revisar'
    return lectura, estado, lectura['alertas'] + avisos + lectura['avisos']


# ----------------------------------------------------------------------------------------------------------------------
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--empresas-json', help='registro de empresas (por defecto empresas.json junto a este archivo)')
    ap.add_argument('--dir-datos', default=str(AQUI / 'datos'), help='carpeta con memorias.csv, cifras.csv, correcciones.csv, estado e informes')
    ap.add_argument('--dir-archivo', default=str(AQUI / 'archivo'), help='carpeta con los PDF descargados')
    ap.add_argument('--ahora', help='fecha de la ejecución AAAA-MM-DD (para pruebas)')
    ap.add_argument('--api', help='dirección de la API de la Gaceta (para pruebas)')
    sub = ap.add_subparsers(dest='orden', required=True)
    a = sub.add_parser('actualizar', help='busca memorias nuevas, las descarga y lee sus cifras')
    a.add_argument('--solo', help='ids de empresas separados por coma')
    a.add_argument('--sin-lectura', action='store_true', help='solo descarga: no lee las cifras')
    a.add_argument('--sin-ocr', action='store_true', help='no reconoce el texto de páginas escaneadas')
    a.add_argument('--sin-descubrir', action='store_true', help='no busca empresas nuevas del rubro')
    a.add_argument('--espera', type=float, help='segundos entre pedidos a la Gaceta (por defecto el de empresas.json)')
    sub.add_parser('estado', help='muestra el último ejercicio y la última memoria de cada empresa')
    e = sub.add_parser('exportar', help='escribe pares.json para las páginas del tablero')
    e.add_argument('--destino', required=True)
    c = sub.add_parser('corregir', help='fija a mano una cifra mal leída')
    c.add_argument('--empresa', required=True)
    c.add_argument('--ejercicio', required=True)
    c.add_argument('--concepto', required=True)
    c.add_argument('--valor', required=True, type=float)
    c.add_argument('--nota', default='')
    o = sub.add_parser('conocer', help='registra como conocidas, sin descargarlas, las publicaciones que una empresa ya tiene (al agregarla al registro)')
    o.add_argument('--solo', help='ids de empresas separados por coma')
    k = sub.add_parser('confirmar', help='da por buenas las cifras de un ejercicio ya revisadas contra el PDF')
    k.add_argument('--empresa', required=True)
    k.add_argument('--ejercicio', required=True)
    l = sub.add_parser('leer', help='lee un PDF suelto y muestra las cifras, sin guardar')
    l.add_argument('archivo')
    l.add_argument('--sin-ocr', action='store_true')
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format='%(message)s', stream=sys.stdout)
    hoy = dt.date.fromisoformat(args.ahora) if args.ahora else dt.date.today()
    registro = cargar_registro(args.empresas_json)
    try:
        if args.orden == 'actualizar':
            res, informe = actualizar(args.dir_datos, args.dir_archivo, registro, ids=set(args.solo.split(',')) if args.solo else None, hoy=hoy,
                                      buscar_nuevas=not args.sin_descubrir, leer=not args.sin_lectura, ocr=not args.sin_ocr, espera=args.espera, api=args.api)
            print('\n' + informe)
            return 1 if any(r['estado'] == 'error' for r in res) else 0
        if args.orden == 'estado':
            mostrar_estado(args.dir_datos, registro, hoy)
            return 0
        if args.orden == 'exportar':
            pares = exportar(args.dir_datos, args.destino, registro)
            print('%d empresas exportadas a %s' % (len(pares), Path(args.destino) / 'pares.json'))
            return 0
        if args.orden == 'corregir':
            corregir(args.dir_datos, registro, args.empresa, args.ejercicio, args.concepto, args.valor, args.nota)
            print('guardado en correcciones.csv')
            return 0
        if args.orden == 'conocer':
            print('%d publicaciones registradas como conocidas' % conocer(args.dir_datos, registro, ids=set(args.solo.split(',')) if args.solo else None, hoy=hoy, api=args.api))
            return 0
        if args.orden == 'confirmar':
            print('%d cifras confirmadas' % confirmar(args.dir_datos, registro, args.empresa, args.ejercicio))
            return 0
        if args.orden == 'leer':
            lectura, estado, avisos = leer_archivo(args.archivo, ocr=not args.sin_ocr)
            print('ejercicio:', lectura['ejercicio'], '| comprobación:', estado)
            for k in CONCEPTOS:
                if k in lectura['cifras']:
                    print('  %-10s %18s  (página %s)' % (k, format(lectura['cifras'][k], ',.2f'), lectura['paginas'].get(k, 'derivado')))
            for av in avisos:
                print('  aviso:', av)
            return 0
    except Exception:
        log.error(traceback.format_exc())
        return 2


if __name__ == '__main__':
    sys.exit(main())

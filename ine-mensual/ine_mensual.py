#!/usr/bin/env python3
"""Descarga mensual de tablas públicas del INE de Bolivia.

Qué hace en cada ejecución (`actualizar`):
  1. Lee el registro de fuentes (fuentes.json) y vuelve a buscar cada enlace en la página del INE por el título de la tabla,
     de modo que si el INE cambia el enlace la herramienta lo sigue. Si no lo encuentra usa el último enlace que funcionó.
  2. Descarga el archivo, comprueba que es una planilla de verdad (no una página de error) y calcula su huella (sha256).
  3. Si la huella cambió, guarda una copia en archivo/, lee la tabla y la fusiona con lo que ya había en datos/series/.
     Los datos nuevos se agregan; si el INE corrige un valor ya publicado, se anota en datos/revisiones.csv.
  4. Avisa si una tabla quedó atrasada, perdió períodos o trae valores raros, y escribe el informe de la ejecución.

Solo usa la biblioteca estándar, más openpyxl (xlsx) y xlrd (xls).
Códigos de salida: 0 = terminó bien (aunque no haya cambios o haya tablas atrasadas), 1 = alguna fuente falló, 2 = error fatal.
"""
import argparse
import csv
import datetime as dt
import hashlib
import html.parser
import json
import logging
import os
import re
import shutil
import sys
import tempfile
import time
import traceback
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import warnings
import zipfile
from pathlib import Path

warnings.filterwarnings('ignore')

LECTOR_VERSION = 1  # súbelo cuando cambies un lector: fuerza a leer de nuevo aunque el archivo no haya cambiado
AQUI = Path(__file__).resolve().parent
log = logging.getLogger('ine_mensual')

MESES = {'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8, 'septiembre': 9, 'setiembre': 9,
         'octubre': 10, 'noviembre': 11, 'diciembre': 12, 'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6, 'jul': 7, 'ago': 8,
         'sep': 9, 'sept': 9, 'set': 9, 'oct': 10, 'nov': 11, 'dic': 12}


# ----------------------------------------------------------------------------------------------------------------------
# utilidades
# ----------------------------------------------------------------------------------------------------------------------
def norm(texto):
    """Minúsculas, sin tildes, sin números ni signos: sirve para comparar títulos aunque cambie el año del título."""
    t = unicodedata.normalize('NFKD', str(texto))
    t = ''.join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z ]+', ' ', t)).strip()


def num(x):
    """Convierte una celda a número. Devuelve None si está vacía o es un guion."""
    if x is None or isinstance(x, bool):
        return None
    if isinstance(x, (int, float)):
        return float(x)
    s = str(x).strip().replace('\xa0', '')
    if s in ('', '-', '--', '.', '|', 'n.d.', 'nd', 's/d'):
        return None
    if re.fullmatch(r'-?\d{1,3}(\.\d{3}){2,}', s):  # 10.030.501
        s = s.replace('.', '')
    try:
        return float(s)
    except ValueError:
        try:
            return float(s.replace(',', '.'))
        except ValueError:
            return None


def iguales(a, b):
    return abs(a - b) <= 1e-9 * max(1.0, abs(a), abs(b))


def meses_entre(p_a, p_b):
    """Meses de p_a (AAAA-MM) a p_b (AAAA-MM)."""
    return (int(p_b[:4]) * 12 + int(p_b[5:7])) - (int(p_a[:4]) * 12 + int(p_a[5:7]))


# ----------------------------------------------------------------------------------------------------------------------
# registro de fuentes
# ----------------------------------------------------------------------------------------------------------------------
def cargar_registro(ruta=None):
    return json.loads(Path(ruta or (AQUI / 'fuentes.json')).read_text(encoding='utf-8'))


def expandir(registro, hoy):
    """Expande las fuentes con plantilla de año (p. ej. los microdatos de importaciones del año actual y del anterior)."""
    out = []
    for f in registro['fuentes']:
        if 'anios' not in f:
            out.append(dict(f))
            continue
        for desfase in f['anios']:
            a = hoy.year + desfase
            g = {k: v for k, v in f.items() if k not in ('anios', 'url_fija_por_anio')}
            g['anio'] = a
            for k in ('id', 'titulo', 'patron_crudo'):
                if k in g:
                    g[k] = g[k].replace('{anio}', str(a))
            if str(a) in f.get('url_fija_por_anio', {}):
                g['url_fija'] = f['url_fija_por_anio'][str(a)]
            if desfase != 0:
                g['rezago_max_meses'] = None  # el año anterior ya está completo: no se vigila el atraso
            out.append(g)
    return out


# ----------------------------------------------------------------------------------------------------------------------
# red: páginas, enlaces y descargas
# ----------------------------------------------------------------------------------------------------------------------
class Red:
    def __init__(self, agente, espera=1.5, reintentos=3, pausa_reintento=5.0, tamano_max_mb=300):
        self.agente, self.espera, self.reintentos, self.pausa_reintento = agente, espera, reintentos, pausa_reintento
        self.max_bytes = int(tamano_max_mb * 1024 * 1024)
        self._ultimo = 0.0

    def _esperar(self):
        falta = self.espera - (time.time() - self._ultimo)
        if falta > 0:
            time.sleep(falta)
        self._ultimo = time.time()

    def _abrir(self, url):
        self._esperar()
        req = urllib.request.Request(url, headers={'User-Agent': self.agente, 'Accept': '*/*', 'Accept-Language': 'es'})
        return urllib.request.urlopen(req, timeout=90)

    def _con_reintentos(self, fn, url):
        ultimo = None
        for i in range(self.reintentos):
            try:
                return fn()
            except urllib.error.HTTPError as e:
                ultimo = e
                if e.code in (400, 401, 403, 404, 410):  # no tiene sentido insistir
                    break
            except Exception as e:  # red caída, tiempo agotado, corte de conexión
                ultimo = e
            if i < self.reintentos - 1:
                time.sleep(self.pausa_reintento * (i + 1))
        raise RuntimeError('no se pudo obtener %s: %s' % (url, ultimo))

    def pagina(self, url):
        def f():
            with self._abrir(url) as r:
                return r.read(8 * 1024 * 1024).decode('utf-8', 'replace')
        return self._con_reintentos(f, url)

    def descargar(self, url, carpeta, sufijo=''):
        """Baja el archivo a una carpeta temporal. Devuelve ruta, bytes, sha256 y nombre de archivo que informa el servidor."""
        def f():
            fd, ruta = tempfile.mkstemp(dir=carpeta, prefix='descarga_', suffix=sufijo)  # las bibliotecas de planillas exigen la extensión
            h, n = hashlib.sha256(), 0
            try:
                with os.fdopen(fd, 'wb') as out, self._abrir(url) as r:
                    m = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)', r.headers.get('Content-Disposition', '') or '')
                    nombre = m.group(1) if m else ''
                    esperado = int(r.headers.get('Content-Length') or 0)
                    while True:
                        b = r.read(1024 * 1024)
                        if not b:
                            break
                        n += len(b)
                        if n > self.max_bytes:
                            raise RuntimeError('el archivo supera el máximo permitido (%d MB)' % (self.max_bytes // 1048576))
                        h.update(b)
                        out.write(b)
                if esperado and n != esperado:
                    raise RuntimeError('descarga incompleta: %d de %d bytes' % (n, esperado))
                return {'ruta': ruta, 'bytes': n, 'sha256': h.hexdigest(), 'nombre': urllib.parse.unquote(nombre) if nombre else ''}
            except BaseException:
                if os.path.exists(ruta):
                    os.remove(ruta)
                raise
        return self._con_reintentos(f, url)


class _Anclas(html.parser.HTMLParser):
    def __init__(self, base):
        super().__init__(convert_charrefs=True)
        self.base, self.anclas, self._h, self._t = base, [], None, []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            h = dict(attrs).get('href')
            if h:
                self._h, self._t = urllib.parse.urljoin(self.base, h.strip()), []

    def handle_data(self, data):
        if self._h is not None:
            self._t.append(data)

    def handle_endtag(self, tag):
        if tag == 'a' and self._h is not None:
            self.anclas.append((re.sub(r'\s+', ' ', ''.join(self._t)).strip(), self._h))
            self._h = None


def enlaces_de_descarga(contenido, base):
    """Enlaces de la página que llevan a un archivo: recursos compartidos (…/index.php/s/CLAVE) o archivos con extensión de planilla."""
    p = _Anclas(base)
    p.feed(contenido)
    out, vistos = [], set()
    for texto, href in p.anclas:
        sp = urllib.parse.urlsplit(href)
        if re.search(r'/index\.php/s/[A-Za-z0-9]+/?$', sp.path):
            href = urllib.parse.urlunsplit((sp.scheme, sp.netloc, sp.path.rstrip('/') + '/download', '', ''))
        elif not (re.search(r'/index\.php/s/[A-Za-z0-9]+/download$', sp.path) or sp.path.lower().endswith(('.xlsx', '.xls', '.csv', '.zip', '.pdf'))):
            continue
        if (texto, href) not in vistos:
            vistos.add((texto, href))
            out.append((texto, href))
    return out


def elegir_enlace(fuente, enlaces):
    """Busca en los enlaces de la página el de esta fuente. Devuelve (url, nota) o (None, motivo)."""
    cands = []
    for texto, href in enlaces:
        if fuente.get('patron_crudo'):
            ok = re.search(fuente['patron_crudo'], texto.strip(), re.I)
        elif fuente.get('patron'):
            ok = re.search(fuente['patron'], norm(texto))
        else:
            ok = False
        if ok:
            cands.append((texto, href))
    hrefs = list(dict.fromkeys(h for _, h in cands))
    if len(hrefs) == 1:
        return hrefs[0], None
    if len(hrefs) > 1:
        conocido = fuente.get('url_fija')
        if conocido in hrefs:
            return conocido, 'varios enlaces coinciden con el título; se usó el conocido'
        return None, 'varios enlaces coinciden con el título (%s); afina el patrón en fuentes.json' % ', '.join(t[:40] for t, _ in cands[:3])
    return None, 'no hay un enlace con ese título en la página'


def tipo_archivo(ruta):
    with open(ruta, 'rb') as f:
        cab = f.read(4096)
    if cab[:4] == b'PK\x03\x04':
        return 'xlsx'
    if cab[:4] == b'\xd0\xcf\x11\xe0':
        return 'xls'
    if cab[:5] == b'%PDF-':
        return 'pdf'
    bajo = cab.lstrip().lower()
    if bajo.startswith(b'<') or b'<html' in bajo or b'<!doctype' in bajo:
        return 'html'
    return 'desconocido'


def validar_archivo(ruta, formato):
    t = tipo_archivo(ruta)
    if t != formato:
        raise ValueError('se esperaba una planilla %s y llegó un archivo %s (puede ser una página de error del INE)' % (formato, t))
    if formato == 'xlsx':
        with zipfile.ZipFile(ruta) as z:
            nombres = set(z.namelist())
        if '[Content_Types].xml' not in nombres or not any(n.startswith('xl/') for n in nombres):
            raise ValueError('el archivo no tiene la estructura de una planilla xlsx')


# ----------------------------------------------------------------------------------------------------------------------
# lectores de tablas: cada uno devuelve (filas, catalogo)
#   filas: lista de (serie, periodo, valor, preliminar)      catalogo: {serie: {nombre, unidad, cantidad}}
# ----------------------------------------------------------------------------------------------------------------------
def filas_hoja(ruta, hoja=0):
    """Una hoja como lista de listas, sea xls o xlsx. `hoja` es el índice o el nombre."""
    if str(ruta).lower().endswith('.xls') and tipo_archivo(ruta) == 'xls':
        import xlrd
        wb = xlrd.open_workbook(str(ruta))
        s = wb.sheet_by_name(hoja) if isinstance(hoja, str) else wb.sheets()[hoja]
        return [[(c if c != '' else None) for c in s.row_values(i)] for i in range(s.nrows)]
    import openpyxl
    wb = openpyxl.load_workbook(str(ruta), data_only=True)
    ws = wb[hoja] if isinstance(hoja, str) else wb.worksheets[hoja]
    return [list(r) for r in ws.iter_rows(values_only=True)]


def _limpia(c):
    return re.sub(r'\s+', ' ', re.sub(r'\s*\(\d+\)\s*', ' ', str(c).replace('\xa0', ' '))).strip()


def _anio_de(celda):
    """(año, preliminar) si la celda es un año; None si no."""
    if isinstance(celda, (int, float)) and not isinstance(celda, bool) and 1900 <= celda <= 2100:
        return int(celda), False
    if isinstance(celda, str):
        m = re.match(r'^\s*(\d{4})\s*(\(p\))?\s*$', celda, re.I)
        if m:
            return int(m.group(1)), bool(m.group(2))
    return None


def leer_anio_mes(ruta, p):
    """Tablas 'según año y mes': una fila con el año (total anual) seguida de sus meses y una columna por serie."""
    f = filas_hoja(ruta, p.get('hoja', 0))
    cab_i = p0 = None
    for i, r in enumerate(f):
        for j, c in enumerate(r):
            if isinstance(c, str) and norm(c).startswith('periodo'):
                cab_i, p0 = i, j
                break
        if cab_i is not None:
            break
    if cab_i is None:
        raise ValueError('no se encontró la cabecera «PERIODO»')
    cols = [(j, _limpia(c)) for j, c in enumerate(f[cab_i]) if j > p0 and c not in (None, '') and _limpia(c)]
    if not cols:
        raise ValueError('la cabecera no tiene columnas')
    filas, anio, anio_p = [], None, False
    for r in f[cab_i + 1:]:
        desp = 0
        lab = r[p0] if len(r) > p0 else None
        if isinstance(lab, str) and lab.strip() in ('|', '-', '.', '') and len(r) > p0 + 1 and r[p0 + 1] not in (None, ''):
            desp, lab = 1, r[p0 + 1]  # hay filas con un signo suelto antes de la etiqueta
        if lab in (None, ''):
            continue
        a = _anio_de(lab)
        if a:
            anio, anio_p = a
            continue
        if not isinstance(lab, str) or anio is None:
            continue
        s = lab.strip().lower()
        pre = bool(re.search(r'\(p\)\s*$', s))
        s = re.sub(r'\s*\(p\)\s*$', '', s)
        s = re.sub(r'\s*\(\d\)', '', s).strip()
        mes = MESES.get(s)
        if not mes:
            continue
        periodo = '%04d-%02d' % (anio, mes)
        for j, nombre in cols:
            v = num(r[j + desp]) if len(r) > j + desp else None
            if v is not None:
                filas.append((nombre, periodo, v, anio_p or pre))
    unidad = p.get('unidad', '')
    return filas, {n: {'nombre': n, 'unidad': unidad, 'cantidad': ''} for _, n in cols}


def _mapa_meses(f_anios, f_meses):
    """Para tablas anchas: columna -> 'AAAA-MM', con una fila de años (a la izquierda de cada bloque) y otra de meses."""
    anios = {}
    for j, c in enumerate(f_anios):
        a = _anio_de(c)
        if a:
            anios[j] = a[0]
        elif isinstance(c, str) and re.match(r'^\s*(\d{4})', c):
            anios[j] = int(re.match(r'^\s*(\d{4})', c).group(1))
    mapa = {}
    for j, c in enumerate(f_meses):
        if isinstance(c, str) and MESES.get(c.strip().lower()[:3]):
            previos = [a for col, a in anios.items() if col <= j]
            if not previos:
                raise ValueError('mes sin año a su izquierda en la columna %d' % (j + 1))
            mapa[j] = '%04d-%02d' % (max(previos), MESES[c.strip().lower()[:3]])
    return mapa


def leer_precios_materiales(ruta, p):
    """Índice de costos de la construcción: precios promedio por producto y mes, una fila por producto."""
    f = filas_hoja(ruta, 0)
    i_a = next((i for i, r in enumerate(f) if any(isinstance(c, str) and norm(c) == 'codigo' for c in r)), None)
    if i_a is None or i_a + 1 >= len(f):
        raise ValueError('no se encontró la fila «CÓDIGO»')
    mapa = _mapa_meses(f[i_a], f[i_a + 1])
    if not mapa:
        raise ValueError('no se encontraron columnas de meses')
    filas, cat, vistos = [], {}, {}
    for r in f[i_a + 2:]:
        cod = r[1] if len(r) > 1 else None
        if not isinstance(cod, (int, float)) or isinstance(cod, bool):
            continue
        nombre = next((c for j, c in enumerate(r) if j >= 2 and isinstance(c, str) and len(c) > 2), None)
        serie = str(int(cod))
        vistos[serie] = vistos.get(serie, 0) + 1
        if vistos[serie] > 1:  # el INE a veces repite un código con otra presentación (p. ej. «Ganchos J» de 12 y de 100 piezas)
            serie = '%s#%d' % (serie, vistos[serie])
        cat[serie] = {'nombre': (nombre or '').strip(), 'unidad': (str(r[4]).strip() if len(r) > 4 and r[4] is not None else ''),
                      'cantidad': (r[3] if len(r) > 3 and r[3] is not None else '')}
        for j, periodo in mapa.items():
            v = num(r[j]) if j < len(r) else None
            if v is not None:
                filas.append((serie, periodo, v, False))
    return filas, cat


def leer_cuci(ruta, p):
    """Importaciones por capítulo CUCI: tablas anchas (año y mes en columnas), una hoja de valor y otra de volumen."""
    filas, cat = [], {}
    for hoja, prefijo in p['hojas'].items():
        f = filas_hoja(ruta, hoja)
        i_a = next((i for i, r in enumerate(f) if any(isinstance(c, str) and c.strip().upper().startswith('CAP') for c in r)), None)
        if i_a is None or i_a + 2 >= len(f):
            raise ValueError('hoja %s: no se encontró la cabecera «CAP»' % hoja)
        mapa = _mapa_meses(f[i_a], f[i_a + 1])
        unidad = next((str(c).strip() for r in f[:i_a] for c in r if isinstance(c, str) and c.strip().startswith('(') and c.strip().endswith(')')), '')
        for r in f[i_a + 2:]:
            nombre = next((c for c in r if isinstance(c, str) and c.strip()), None)
            if not nombre:
                continue
            serie = '%s|%s' % (prefijo, re.sub(r'\s+', ' ', nombre).strip())
            n0 = len(filas)
            for j, periodo in mapa.items():
                v = num(r[j]) if j < len(r) else None
                if v is not None:
                    filas.append((serie, periodo, v, False))
            if len(filas) > n0:
                cat[serie] = {'nombre': serie.split('|', 1)[1], 'unidad': '%s %s' % (prefijo, unidad), 'cantidad': ''}
    return filas, cat


def leer_poblacion(ruta, p):
    """Población por departamento y año calendario."""
    f = filas_hoja(ruta, 0)
    cab_i = p0 = None
    for i, r in enumerate(f):
        for j, c in enumerate(r):
            if isinstance(c, str) and norm(c) in ('ano', 'anos'):
                cab_i, p0 = i, j
                break
        if cab_i is not None:
            break
    if cab_i is None:
        raise ValueError('no se encontró la cabecera «AÑO»')
    cols = [(j, _limpia(c)) for j, c in enumerate(f[cab_i]) if j > p0 and c not in (None, '')]
    filas = []
    for r in f[cab_i + 1:]:
        a = _anio_de(r[p0] if len(r) > p0 else None)
        if not a:
            continue
        for j, nombre in cols:
            v = num(r[j]) if j < len(r) else None
            if v is not None:
                filas.append((nombre, str(a[0]), v, False))
    return filas, {n: {'nombre': n, 'unidad': 'personas', 'cantidad': ''} for _, n in cols}


def leer_hogares_paredes(ruta, p):
    """Encuesta de Hogares: por departamento, hogares (miles) y porcentaje según material de las paredes."""
    f = filas_hoja(ruta, 0)
    i_c = next((i for i, r in enumerate(f) if any(isinstance(c, str) and c.strip().upper().startswith('DEPARTAMENTO') for c in r)), None)
    if i_c is None:
        raise ValueError('no se encontró la cabecera «DEPARTAMENTO»')
    anios = {}
    for j, c in enumerate(f[i_c]):
        a = _anio_de(c)
        if a:
            anios[j] = str(a[0])
    if not anios:
        raise ValueError('la cabecera no tiene años')
    filas, cat, actual = [], {}, None
    for r in f[i_c + 1:]:
        nombre = re.sub(r'\s+', ' ', str(r[1])).strip() if len(r) > 1 and isinstance(r[1], str) else None
        if not nombre:
            continue
        bajo = nombre.lower()
        material = next((m for m in ('ladrillo', 'adobe', 'madera', 'otro') if bajo.startswith(m)), None)
        if material:
            if actual is None:
                continue
            serie, unidad = '%s|%s' % (actual, material), 'porcentaje de hogares'
        elif any(num(r[j]) is not None for j in anios if j < len(r)):
            actual = nombre.upper()
            serie, unidad = '%s|hogares' % actual, 'miles de hogares'
        else:
            continue
        cat[serie] = {'nombre': serie, 'unidad': unidad, 'cantidad': ''}
        for j, anio in anios.items():
            v = num(r[j]) if j < len(r) else None
            if v is not None:
                filas.append((serie, anio, v, False))
    return filas, cat


def leer_micro_importaciones(ruta, p):
    """Microdatos de importaciones (cientos de miles de filas): se recorren en flujo y se suman por mes y partida arancelaria."""
    import openpyxl
    grupos = [(str(a), b) for a, b in p['grupos']]
    wb = openpyxl.load_workbook(str(ruta), read_only=True, data_only=True)
    ws = wb.worksheets[0]
    idx, agg, n = None, {}, 0
    for r in ws.iter_rows(values_only=True):
        if idx is None:
            if r and any(isinstance(c, str) and c.strip().upper() == 'NANDINA' for c in r):
                cab = [str(c).strip().upper() if c is not None else '' for c in r]
                idx = {k: cab.index(k) for k in ('GESTION', 'MES', 'NANDINA', 'FRO') if k in cab}
                idx['KG'] = cab.index('KILOS') if 'KILOS' in cab else cab.index('KILBRU')
                faltan = [k for k in ('GESTION', 'MES', 'NANDINA', 'FRO', 'KG') if k not in idx]
                if faltan:
                    raise ValueError('faltan columnas en los microdatos: %s' % faltan)
            continue
        n += 1
        cod = re.sub(r'\D', '', str(r[idx['NANDINA']] or ''))
        g = next((nombre for pref, nombre in grupos if cod.startswith(pref)), None)
        if not g:
            continue
        a, m = num(r[idx['GESTION']]), num(r[idx['MES']])
        if a is None or m is None:
            continue
        k = ('%04d-%02d' % (int(a), int(m)), g)
        t = agg.setdefault(k, [0.0, 0.0, 0])
        t[0] += num(r[idx['KG']]) or 0.0
        t[1] += num(r[idx['FRO']]) or 0.0
        t[2] += 1
    if idx is None:
        raise ValueError('no se encontró la cabecera con la columna NANDINA')
    if n == 0:
        raise ValueError('los microdatos no tienen filas')
    filas, cat = [], {}
    for (periodo, g), (kg, usd, cuenta) in sorted(agg.items()):
        filas += [('%s|t' % g, periodo, kg / 1000.0, True), ('%s|usd' % g, periodo, usd, True), ('%s|filas' % g, periodo, float(cuenta), True)]
    for _, g in grupos:
        cat['%s|t' % g] = {'nombre': g, 'unidad': 'toneladas (columna KILOS)', 'cantidad': ''}
        cat['%s|usd' % g] = {'nombre': g, 'unidad': 'US$ (columna FRO)', 'cantidad': ''}
        cat['%s|filas' % g] = {'nombre': g, 'unidad': 'registros', 'cantidad': ''}
    return filas, cat


LECTORES = {'anio_mes': leer_anio_mes, 'precios_materiales': leer_precios_materiales, 'cuci': leer_cuci, 'poblacion': leer_poblacion,
            'hogares_paredes': leer_hogares_paredes, 'micro_importaciones': leer_micro_importaciones}


# ----------------------------------------------------------------------------------------------------------------------
# almacén: series en CSV (se pueden comparar con git), catálogo, revisiones y estado
# ----------------------------------------------------------------------------------------------------------------------
class Almacen:
    COLS_SERIE = ['serie', 'periodo', 'valor', 'preliminar', 'valor_inicial', 'desde']
    COLS_CAT = ['serie', 'orden', 'nombre', 'unidad', 'cantidad']
    COLS_REV = ['fecha', 'fuente', 'serie', 'periodo', 'anterior', 'nuevo']

    def __init__(self, carpeta):
        self.dir = Path(carpeta)
        (self.dir / 'series').mkdir(parents=True, exist_ok=True)
        (self.dir / 'catalogo').mkdir(parents=True, exist_ok=True)
        (self.dir / 'informes').mkdir(parents=True, exist_ok=True)

    # estado
    def estado(self):
        p = self.dir / 'estado.json'
        if p.exists():
            return json.loads(p.read_text(encoding='utf-8'))
        return {'version': 1, 'ultima_ejecucion': None, 'fuentes': {}}

    def guardar_estado(self, estado):
        with open(self.dir / 'estado.json', 'w', encoding='utf-8') as f:
            json.dump(estado, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write('\n')

    # series
    def series(self, fuente):
        p = self.dir / 'series' / (fuente + '.csv')
        out = {}
        if p.exists():
            with open(p, encoding='utf-8', newline='') as f:
                for r in csv.DictReader(f):
                    out[(r['serie'], r['periodo'])] = [float(r['valor']), r['preliminar'] == '1', float(r['valor_inicial']), r['desde']]
        return out

    def guardar_series(self, fuente, datos):
        p = self.dir / 'series' / (fuente + '.csv')
        tmp = p.with_suffix('.tmp')
        with open(tmp, 'w', encoding='utf-8', newline='') as f:
            w = csv.writer(f, lineterminator='\n')
            w.writerow(self.COLS_SERIE)
            for (s, per), (v, pre, ini, desde) in sorted(datos.items()):
                w.writerow([s, per, repr(v), int(pre), repr(ini), desde])
        os.replace(tmp, p)

    # catálogo
    def catalogo(self, fuente):
        p = self.dir / 'catalogo' / (fuente + '.csv')
        out = {}
        if p.exists():
            with open(p, encoding='utf-8', newline='') as f:
                for r in csv.DictReader(f):
                    out[r['serie']] = r
        return out

    def guardar_catalogo(self, fuente, cat):
        p = self.dir / 'catalogo' / (fuente + '.csv')
        previo = self.catalogo(fuente)
        filas = [(orden, s, d.get('nombre', ''), d.get('unidad', ''), d.get('cantidad', '')) for orden, (s, d) in enumerate(cat.items())]
        filas += [(int(d['orden']), s, d['nombre'], d['unidad'], d['cantidad']) for s, d in previo.items() if s not in cat]
        with open(p, 'w', encoding='utf-8', newline='') as f:
            w = csv.writer(f, lineterminator='\n')
            w.writerow(self.COLS_CAT)
            for orden, s, nombre, unidad, cantidad in sorted(filas, key=lambda x: (x[0], x[1])):
                w.writerow([s, orden, nombre, unidad, cantidad])

    # revisiones
    def agregar_revisiones(self, revs):
        if not revs:
            return
        p = self.dir / 'revisiones.csv'
        nuevo = not p.exists()
        with open(p, 'a', encoding='utf-8', newline='') as f:
            w = csv.writer(f, lineterminator='\n')
            if nuevo:
                w.writerow(self.COLS_REV)
            for fecha, fuente, serie, periodo, ant, nue in revs:
                w.writerow([fecha, fuente, serie, periodo, repr(ant), repr(nue)])


def fusionar(fuente, previo, filas, fecha):
    """Mezcla lo leído con lo guardado. Devuelve (datos, resumen, revisiones)."""
    leido, duplicados = {}, 0
    for serie, periodo, valor, pre in filas:
        k = (serie, periodo)
        if k in leido and not iguales(leido[k][0], valor):
            duplicados += 1
        leido[k] = (valor, pre)
    datos = dict(previo)
    nuevos = revisados = confirmados = 0
    revs = []
    for k, (v, pre) in leido.items():
        if k not in previo:
            datos[k] = [v, pre, v, fecha]
            nuevos += 1
            continue
        pv, ppre, ini, desde = previo[k]
        if not iguales(pv, v):
            revs.append((fecha, fuente, k[0], k[1], pv, v))
            datos[k] = [v, pre, ini, desde]
            revisados += 1
        elif ppre != pre:
            datos[k] = [pv, pre, ini, desde]
            confirmados += 1
    ausentes = sum(1 for k in previo if k not in leido)
    return datos, {'nuevos': nuevos, 'revisados': revisados, 'confirmados': confirmados, 'ausentes': ausentes, 'duplicados': duplicados,
                   'filas': len(leido)}, revs


def revisar_calidad(fuente, previo, filas, estado_prev):
    """Devuelve (errores, avisos). Los errores impiden guardar; los avisos solo se informan."""
    errores, avisos = [], []
    if not filas:
        return ['la tabla no trajo ningún dato'], []
    periodos = sorted({p for _, p, _, _ in filas})
    if fuente.get('no_negativos'):
        neg = [(s, p, v) for s, p, v, _ in filas if v < 0]
        if neg:
            avisos.append('%d valores negativos (p. ej. %s %s = %s)' % (len(neg), neg[0][0], neg[0][1], neg[0][2]))
    ult_prev = (estado_prev or {}).get('ultimo_periodo')
    if ult_prev and periodos[-1] < ult_prev:
        errores.append('la tabla retrocedió: ahora llega hasta %s y antes llegaba hasta %s' % (periodos[-1], ult_prev))
    # valores atípicos entre los períodos nuevos (solo series mensuales y solo si ya hay una base guardada, para no avisar de todo el pasado
    # en la primera carga): 3 veces la mediana de los seis anteriores, o menos de un tercio
    por_serie = {}
    for s, p, v, _ in filas:
        if previo and re.fullmatch(r'\d{4}-\d{2}', p):
            por_serie.setdefault(s, {})[p] = v
    raros = []
    for s, d in por_serie.items():
        ps = sorted(d)
        for i, p in enumerate(ps):
            if (s, p) in previo or i < 6:
                continue
            ant = sorted(d[q] for q in ps[i - 6:i])
            med = (ant[2] + ant[3]) / 2
            if med > 0 and (d[p] > 3 * med or d[p] < med / 3):
                raros.append((s, p, d[p], med))
    if raros:
        s, p, v, med = raros[0]
        avisos.append('%d valores nuevos se alejan mucho de lo habitual (p. ej. %s %s = %s; mediana reciente %s)' % (len(raros), s, p, round(v, 3), round(med, 3)))
    return errores, avisos


# ----------------------------------------------------------------------------------------------------------------------
# ejecución
# ----------------------------------------------------------------------------------------------------------------------
class Contexto:
    def __init__(self, red, almacen, dir_archivo, hoy, forzar=False):
        self.red, self.almacen, self.dir_archivo, self.hoy, self.forzar = red, almacen, Path(dir_archivo), hoy, forzar
        self.estado = almacen.estado()
        self._paginas = {}

    def enlaces(self, url):
        if url not in self._paginas:
            try:
                self._paginas[url] = enlaces_de_descarga(self.red.pagina(url), url)
            except Exception as e:
                log.warning('no se pudo leer la página %s: %s', url, e)
                self._paginas[url] = e
        return self._paginas[url]


def resolver_url(f, previo, ctx):
    """Orden de preferencia: el enlace que se encuentra hoy en la página, el último que funcionó y el de fuentes.json."""
    candidatos, notas, sin_enlace = [], [], None
    if f.get('pagina'):
        enl = ctx.enlaces(f['pagina'])
        if isinstance(enl, Exception):
            notas.append('no se pudo leer la página del INE; se usó un enlace guardado')
        else:
            url, nota = elegir_enlace(f, enl)
            if url:
                candidatos.append((url, 'página'))
                if nota:
                    notas.append(nota)
            else:
                sin_enlace = nota
    guardados = [(u, como) for u, como in ((previo.get('url'), 'último que funcionó'), (f.get('url_fija'), 'fuentes.json')) if u]
    if sin_enlace:
        notas.append(sin_enlace + ('; se usó un enlace guardado' if guardados else ''))
    for u, como in guardados:
        if u not in [c[0] for c in candidatos]:
            candidatos.append((u, como))
    return candidatos, notas


def procesar(f, ctx):
    hoy = ctx.hoy.isoformat()
    r = {'id': f['id'], 'titulo': f['titulo'], 'estado': 'error', 'avisos': [], 'nuevos': 0, 'revisados': 0, 'ultimo_periodo': None, 'url': None}
    previo = ctx.estado['fuentes'].get(f['id'], {})
    r['ultimo_periodo'] = previo.get('ultimo_periodo')
    candidatos, notas = resolver_url(f, previo, ctx)
    r['avisos'] += notas
    if not candidatos:
        r['estado'] = 'sin_publicar' if f.get('opcional') else 'error'
        r['mensaje'] = 'todavía no hay un archivo publicado' if f.get('opcional') else 'no hay enlace conocido'
        return r
    carpeta = ctx.dir_archivo / '.tmp'
    carpeta.mkdir(parents=True, exist_ok=True)
    d, errores_descarga = None, []
    for url, como in candidatos:
        try:
            d = ctx.red.descargar(url, carpeta, '.' + f['formato'])
            validar_archivo(d['ruta'], f['formato'])
            r['url'] = url
            if como != 'página' and f.get('pagina') and not any('página' in a for a in r['avisos']):
                r['avisos'].append('se usó el enlace guardado (%s)' % como)
            break
        except Exception as e:
            errores_descarga.append('%s: %s' % (url, e))
            if d and os.path.exists(d['ruta']):
                os.remove(d['ruta'])
            d = None
    if d is None:
        r['mensaje'] = 'no se pudo descargar: ' + ' | '.join(errores_descarga)[:400]
        return r
    try:
        misma_huella = previo.get('sha256') == d['sha256'] and previo.get('lector_version') == LECTOR_VERSION and not ctx.forzar
        r['sha256'], r['bytes'] = d['sha256'], d['bytes']
        if misma_huella:
            r['estado'] = 'sin_cambios'
            ctx.estado['fuentes'][f['id']] = {**previo, 'url': r['url'], 'verificado': hoy, 'estado': 'sin_cambios'}
            _revisar_atraso(f, r, ctx.hoy)
            return r
        # copia cruda versionada
        dest = ctx.dir_archivo / f['id']
        dest.mkdir(parents=True, exist_ok=True)
        copia = dest / ('%s_%s.%s' % (hoy, d['sha256'][:8], f['formato']))
        shutil.copyfile(d['ruta'], copia)
        r['archivo'] = str(copia)
        if not f.get('lector'):
            r['estado'] = 'archivado'
            ctx.estado['fuentes'][f['id']] = {'url': r['url'], 'sha256': d['sha256'], 'bytes': d['bytes'], 'descargado': hoy, 'verificado': hoy,
                                              'cambio': hoy if previo.get('sha256') != d['sha256'] else previo.get('cambio', hoy), 'lector_version': LECTOR_VERSION,
                                              'ultimo_periodo': None, 'estado': 'archivado'}
            if previo.get('sha256') and previo.get('sha256') != d['sha256']:
                r['avisos'].append('el archivo cambió (esta fuente solo se archiva, no se lee)')
            return r
        try:
            filas, cat = LECTORES[f['lector']](d['ruta'], f.get('params', {}))
        except Exception as e:
            log.error('%s: %s', f['id'], traceback.format_exc())
            r['mensaje'] = 'no se pudo leer la tabla (¿cambió su formato?): %s. La copia quedó en %s' % (e, copia)
            return r  # no se actualiza la huella: la próxima vez se vuelve a intentar
        prev_series = ctx.almacen.series(f['id'])
        errores, avisos = revisar_calidad(f, prev_series, filas, previo)
        r['avisos'] += avisos
        if errores:
            r['mensaje'] = '; '.join(errores)
            r['estado'] = 'error'
            return r  # no se actualiza la huella: la próxima vez se vuelve a intentar
        datos, resumen, revs = fusionar(f['id'], prev_series, filas, hoy)
        if resumen['ausentes'] > max(5, 0.001 * max(1, len(prev_series))):
            r['avisos'].append('%d datos que estaban guardados ya no vienen en la tabla (se conservaron)' % resumen['ausentes'])
        if resumen['duplicados']:
            r['avisos'].append('%d filas repetidas con valores distintos (quedó la última)' % resumen['duplicados'])
        ctx.almacen.guardar_series(f['id'], datos)
        ctx.almacen.guardar_catalogo(f['id'], cat)
        ctx.almacen.agregar_revisiones(revs)
        ultimo = max(p for _, p in datos)
        r.update({'nuevos': resumen['nuevos'], 'revisados': resumen['revisados'], 'ultimo_periodo': ultimo, 'filas': resumen['filas'], 'revisiones': revs})
        r['estado'] = 'actualizada' if (resumen['nuevos'] or resumen['revisados']) else 'archivo_distinto_datos_iguales'
        ctx.estado['fuentes'][f['id']] = {'url': r['url'], 'sha256': d['sha256'], 'bytes': d['bytes'], 'descargado': hoy, 'verificado': hoy, 'cambio': hoy,
                                          'lector_version': LECTOR_VERSION, 'ultimo_periodo': ultimo, 'filas': len(datos), 'estado': r['estado']}
        _revisar_atraso(f, r, ctx.hoy)
        return r
    finally:
        if d and os.path.exists(d['ruta']):
            os.remove(d['ruta'])


def _revisar_atraso(f, r, hoy):
    """Marca la fuente como atrasada si su último período quedó más viejo de lo esperado."""
    maxm = f.get('rezago_max_meses')
    ult = r.get('ultimo_periodo')
    r['atrasada'] = False
    if maxm is None or not ult or not re.fullmatch(r'\d{4}-\d{2}', ult):
        return
    atraso = meses_entre(ult, '%04d-%02d' % (hoy.year, hoy.month))
    r['atraso_meses'] = atraso
    if atraso > maxm:
        r['atrasada'] = True
        r['avisos'].append('atrasada: el último período es %s (%d meses; se espera como máximo %d)' % (ult, atraso, maxm))


def actualizar(dir_datos, dir_archivo, registro, ids=None, sin_pesadas=False, hoy=None, forzar=False, espera=None):
    hoy = hoy or dt.date.today()
    red = Red(registro.get('agente', 'ine-mensual/1.0'), registro.get('espera_segundos', 1.5) if espera is None else espera,
              tamano_max_mb=registro.get('tamano_maximo_mb', 300), pausa_reintento=0.0 if (espera == 0) else 5.0)
    almacen = Almacen(dir_datos)
    ctx = Contexto(red, almacen, dir_archivo, hoy, forzar)
    fuentes = expandir(registro, hoy)
    if ids:
        fuentes = [f for f in fuentes if f['id'] in ids]
    resultados = []
    for f in fuentes:
        if sin_pesadas and f.get('pesada'):
            resultados.append({'id': f['id'], 'titulo': f['titulo'], 'estado': 'omitida', 'avisos': [], 'nuevos': 0, 'revisados': 0,
                               'ultimo_periodo': ctx.estado['fuentes'].get(f['id'], {}).get('ultimo_periodo'), 'mensaje': 'omitida (--sin-pesadas)'})
            continue
        log.info('→ %s', f['id'])
        try:
            r = procesar(f, ctx)
        except Exception as e:
            log.error('%s: %s', f['id'], traceback.format_exc())
            r = {'id': f['id'], 'titulo': f['titulo'], 'estado': 'error', 'avisos': [], 'nuevos': 0, 'revisados': 0, 'mensaje': 'error inesperado: %s' % e,
                 'ultimo_periodo': ctx.estado['fuentes'].get(f['id'], {}).get('ultimo_periodo')}
        log.info('   %s %s', r['estado'], r.get('mensaje', ''))
        resultados.append(r)
        almacen.guardar_estado(ctx.estado)  # si la ejecución se corta, lo ya hecho no se pierde
    ctx.estado['ultima_ejecucion'] = hoy.isoformat()
    almacen.guardar_estado(ctx.estado)
    shutil.rmtree(Path(dir_archivo) / '.tmp', ignore_errors=True)
    informe = redactar_informe(resultados, hoy)
    (almacen.dir / 'informes' / ('%s.md' % hoy.isoformat())).write_text(informe, encoding='utf-8')
    (almacen.dir / 'ultimo_informe.md').write_text(informe, encoding='utf-8')
    resumen = {'fecha': hoy.isoformat(), 'fuentes': len(resultados),
               'con_datos_nuevos': [r['id'] for r in resultados if r['estado'] == 'actualizada'],
               'errores': [r['id'] for r in resultados if r['estado'] == 'error'],
               'atrasadas': [r['id'] for r in resultados if r.get('atrasada')],
               'sin_publicar': [r['id'] for r in resultados if r['estado'] == 'sin_publicar']}
    (almacen.dir / 'ultimo_resumen.json').write_text(json.dumps(resumen, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    return resultados, informe


# ----------------------------------------------------------------------------------------------------------------------
# informe
# ----------------------------------------------------------------------------------------------------------------------
ETIQUETA = {'actualizada': 'con datos nuevos', 'sin_cambios': 'sin cambios', 'archivo_distinto_datos_iguales': 'archivo distinto, mismos datos',
            'archivado': 'archivada', 'error': 'ERROR', 'omitida': 'omitida', 'sin_publicar': 'sin publicar'}


def redactar_informe(resultados, hoy):
    cuenta = {}
    for r in resultados:
        cuenta[r['estado']] = cuenta.get(r['estado'], 0) + 1
    atrasadas = [r for r in resultados if r.get('atrasada')]
    L = ['# Descarga mensual del INE: %s' % hoy.isoformat(), '']
    partes = ['%d fuentes' % len(resultados)] + ['%d %s' % (n, ETIQUETA.get(e, e)) for e, n in sorted(cuenta.items(), key=lambda x: -x[1])]
    if atrasadas:
        partes.append('%d atrasada%s' % (len(atrasadas), '' if len(atrasadas) == 1 else 's'))
    L += [' · '.join(partes), '']
    L += ['| Fuente | Estado | Último período | Valores nuevos | Valores corregidos | Nota |', '|---|---|---|---:|---:|---|']
    for r in resultados:
        nota = '; '.join(([r['mensaje']] if r.get('mensaje') and r['estado'] in ('error', 'omitida', 'sin_publicar') else []) + r.get('avisos', []))
        L.append('| %s | %s | %s | %s | %s | %s |' % (r['id'], ETIQUETA.get(r['estado'], r['estado']), r.get('ultimo_periodo') or '', r.get('nuevos', ''), r.get('revisados', ''),
                                                      nota.replace('|', '/').replace('\n', ' ')))
    revs = [(abs(n - a) / abs(a) if a else 1.0, f, s, p, a, n) for r in resultados for (_, f, s, p, a, n) in r.get('revisiones', [])]
    if revs:
        L += ['', '## Correcciones más grandes del INE a datos ya publicados', '', '| Fuente | Serie | Período | Antes | Ahora | Cambio |', '|---|---|---|---:|---:|---:|']
        for rel, f, s, p, a, n in sorted(revs, reverse=True)[:15]:
            L.append('| %s | %s | %s | %s | %s | %+.1f %% |' % (f, s, p, round(a, 4), round(n, 4), (n / a - 1) * 100 if a else 0))
    errores = [r for r in resultados if r['estado'] == 'error']
    if errores:
        L += ['', '## Errores', '']
        L += ['- **%s**: %s' % (r['id'], r.get('mensaje', '')) for r in errores]
    return '\n'.join(L) + '\n'


# ----------------------------------------------------------------------------------------------------------------------
# estado y exportación
# ----------------------------------------------------------------------------------------------------------------------
def mostrar_estado(dir_datos, registro, hoy):
    alm = Almacen(dir_datos)
    est = alm.estado()
    print('Última ejecución: %s' % est.get('ultima_ejecucion'))
    print('%-24s %-12s %-12s %-12s %s' % ('fuente', 'último', 'descargada', 'cambió', 'estado'))
    for f in expandir(registro, hoy):
        e = est['fuentes'].get(f['id'], {})
        print('%-24s %-12s %-12s %-12s %s' % (f['id'], e.get('ultimo_periodo') or '-', e.get('descargado') or '-', e.get('cambio') or '-', e.get('estado') or 'nunca'))


def _valores(alm, fuente):
    """{serie: {periodo: valor}} de una fuente."""
    out = {}
    for (s, p), (v, _, _, _) in alm.series(fuente).items():
        out.setdefault(s, {})[p] = v
    return out


def exportar(dir_datos, destino):
    """Escribe, a partir de los CSV, los JSON que leen las páginas del tablero (mismo formato que los armados a mano)."""
    alm = Almacen(dir_datos)
    destino = Path(destino)
    destino.mkdir(parents=True, exist_ok=True)
    salidas = {}

    # cemento: consumo por departamento (Cochabamba, nacional, Santa Cruz y La Paz) desde 2024
    c = _valores(alm, 'cemento_consumo')
    if c:
        claves = {'cbba': 'COCHABAMBA', 'nac': 'TOTAL', 'scz': 'SANTA CRUZ', 'lpz': 'LA PAZ'}
        meses = sorted({p for d in c.values() for p in d if p >= '2024-01'})
        salidas['cemento_ine.json'] = {'cem': {m: {k: c[v][m] for k, v in claves.items() if m in c.get(v, {})} for m in meses}}

    # precios de cemento y fierro por departamento
    deptos = [('Cochabamba', 'cochabamba'), ('Santa Cruz', 'santacruz'), ('La Paz', 'lapaz'), ('Oruro', 'oruro'), ('Potosí', 'potosi'),
              ('Chuquisaca', 'chuquisaca'), ('Tarija', 'tarija'), ('Beni', 'beni'), ('Pando', 'pando')]
    precios = {}
    for nombre, idd in deptos:
        cat, ser = alm.catalogo('icc_' + idd), _valores(alm, 'icc_' + idd)
        if not cat:
            continue
        precios[nombre] = {}
        for etiqueta, patron in (('cemento', r'cemento portland'), ('fierro12', r'fierro corrugado de 1/2'), ('fierro14', r'fierro corrugado de 1/4')):
            hallados = sorted((int(d['orden']), s) for s, d in cat.items() if re.search(patron, d['nombre'] or '', re.I))
            if hallados:
                s = hallados[0][1]
                cant = cat[s]['cantidad']
                precios[nombre][etiqueta] = {'nombre': cat[s]['nombre'], 'cantidad': float(cant) if cant not in ('', None) else None, 'unidad': cat[s]['unidad'],
                                             'serie': dict(sorted(ser.get(s, {}).items()))}
    if precios:
        salidas['precios_deptos.json'] = precios
        # series de Cochabamba que usan las páginas (código de producto del INE)
        cb, scb = alm.catalogo('icc_cochabamba'), _valores(alm, 'icc_cochabamba')
        codigos = {'ladrillo6': '3735001', 'teja': '3735004', 'cemento50': '3744001', 'piso_ceramica': '3737003', 'fierro_t': '4124203'}
        salidas['precios_cochabamba.json'] = {k: {'codigo': cod, 'nombre': cb.get(cod, {}).get('nombre'), 'unidad': cb.get(cod, {}).get('unidad'),
                                                  'serie': dict(sorted(scb.get(cod, {}).items()))} for k, cod in codigos.items()}

    # permisos de construcción (total) desde 2023
    perm = {}
    for clave, fuente in (('superficie', 'permisos_superficie'), ('numero', 'permisos_numero')):
        t = _valores(alm, fuente).get('TOTAL', {})
        if t:
            perm[clave] = {p: v for p, v in sorted(t.items()) if p >= '2023-01'}
    if perm:
        salidas['permisos_ine.json'] = perm

    # acero y otros materiales importados (microdatos): mensual y enero a último mes, año anterior contra año actual
    micro = {}
    for p in sorted((alm.dir / 'series').glob('imp_micro_*.csv')):
        for s, d in _valores(alm, p.stem).items():
            micro.setdefault(s, {}).update(d)
    if micro:
        grupos = sorted({s.split('|')[0] for s in micro})
        meses = sorted({p for d in micro.values() for p in d})
        anio = int(meses[-1][:4])
        hasta = int(max(m for m in meses if m.startswith(str(anio)))[5:])
        resumen = {}
        for g in grupos:
            def suma(a, sufijo):
                return sum(micro.get('%s|%s' % (g, sufijo), {}).get('%04d-%02d' % (a, m), 0.0) for m in range(1, hasta + 1))
            resumen[g] = {'t25': suma(anio - 1, 't'), 't26': suma(anio, 't'), 'v25': suma(anio - 1, 'usd') / 1e6, 'v26': suma(anio, 'usd') / 1e6}
        mensual = []
        for m in meses:
            def v(g, suf):
                return micro.get('%s|%s' % (g, suf), {}).get(m, 0.0)
            mensual.append({'p': m, 'corrugadas_t': v('Barras corrugadas (7214.20)', 't'), 'corrugadas_usd': v('Barras corrugadas (7214.20)', 'usd'),
                            'alambron_t': v('Alambron (7213)', 't'), 'alambron_usd': v('Alambron (7213)', 'usd')})
        salidas['acero_micro.json'] = {'resumen': resumen, 'mensual': mensual, 'anio': anio, 'hasta_mes': hasta}

    # población y hogares
    pob = {}
    for clave, fuente in (('rev2025', 'poblacion_rev2025'), ('rev2014', 'poblacion_rev2014')):
        v = _valores(alm, fuente)
        if v:
            pob[clave] = {a: {dep: d[a] for dep, d in v.items() if a in d} for a in sorted({p for d in v.values() for p in d})}
    if pob:
        salidas['poblacion_depto.json'] = pob
    hog = _valores(alm, 'hogares_paredes_depto')
    if hog:
        out = {}
        for s, d in hog.items():
            dep, concepto = s.split('|')
            out.setdefault(dep, {})[concepto] = dict(sorted(d.items()))
        salidas['hogares_paredes.json'] = out

    for nombre, contenido in salidas.items():
        with open(destino / nombre, 'w', encoding='utf-8') as f:
            json.dump(contenido, f, ensure_ascii=False)
        log.info('exportado %s', destino / nombre)
    return sorted(salidas)


# ----------------------------------------------------------------------------------------------------------------------
# línea de comandos
# ----------------------------------------------------------------------------------------------------------------------
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--fuentes-json', help='registro de fuentes (por defecto fuentes.json junto a este archivo)')
    ap.add_argument('--dir-datos', default=str(AQUI / 'datos'), help='carpeta con series, catálogo, revisiones, estado e informes')
    ap.add_argument('--dir-archivo', default=str(AQUI / 'archivo'), help='carpeta con las copias crudas de cada descarga')
    ap.add_argument('--ahora', help='fecha de la ejecución AAAA-MM-DD (para pruebas)')
    sub = ap.add_subparsers(dest='orden', required=True)
    a = sub.add_parser('actualizar', help='descarga, lee y guarda las tablas')
    a.add_argument('--solo', help='ids de fuentes separados por coma')
    a.add_argument('--sin-pesadas', action='store_true', help='omite los microdatos de importaciones (archivos de decenas de MB)')
    a.add_argument('--forzar', action='store_true', help='lee de nuevo aunque el archivo no haya cambiado')
    a.add_argument('--espera', type=float, help='segundos entre pedidos al INE (por defecto el de fuentes.json)')
    sub.add_parser('estado', help='muestra el último período de cada fuente')
    e = sub.add_parser('exportar', help='escribe los JSON que usan las páginas del tablero')
    e.add_argument('--destino', required=True)
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format='%(message)s', stream=sys.stdout)
    hoy = dt.date.fromisoformat(args.ahora) if args.ahora else dt.date.today()
    registro = cargar_registro(args.fuentes_json)
    try:
        if args.orden == 'actualizar':
            res, informe = actualizar(args.dir_datos, args.dir_archivo, registro, ids=set(args.solo.split(',')) if args.solo else None,
                                      sin_pesadas=args.sin_pesadas, hoy=hoy, forzar=args.forzar, espera=args.espera)
            print('\n' + informe)
            return 1 if any(r['estado'] == 'error' for r in res) else 0
        if args.orden == 'estado':
            mostrar_estado(args.dir_datos, registro, hoy)
            return 0
        if args.orden == 'exportar':
            exportar(args.dir_datos, args.destino)
            return 0
    except Exception:
        log.error(traceback.format_exc())
        return 2


if __name__ == '__main__':
    sys.exit(main())

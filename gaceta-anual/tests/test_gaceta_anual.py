"""Pruebas de gaceta_anual sin tocar internet: PDF armados al vuelo y un servidor local que hace de API de la Gaceta.
Ejecutar:  python3 -I -m unittest discover -s gaceta-anual/tests -v
Las pruebas que leen PDF necesitan pdftotext (poppler-utils); si falta, se omiten.
"""
import base64
import csv
import datetime as dt
import http.server
import json
import shutil
import sys
import tempfile
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import gaceta_anual as ga  # noqa: E402

HAY_POPPLER = bool(shutil.which('pdftotext') and shutil.which('pdfinfo'))
ORIGEN = 'https://gacetadecomercio.gob.bo'


# ----------------------------------------------------------------------------------------------------------------------
# materiales de prueba
# ----------------------------------------------------------------------------------------------------------------------
def pdf_bytes(paginas):
    """PDF mínimo con texto digital: paginas es una lista de listas de líneas."""
    n = len(paginas)
    objs = [b'<< /Type /Catalog /Pages 2 0 R >>',
            ('<< /Type /Pages /Kids [%s] /Count %d >>' % (' '.join('%d 0 R' % (4 + 2 * i) for i in range(n)), n)).encode(),
            b'<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>']
    for i, lineas in enumerate(paginas):
        cuerpo = b'BT /F1 9 Tf 30 800 Td 11 TL ' + b' '.join(b'(' + l.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)').encode('latin-1') + b') Tj T*' for l in lineas) + b' ET'
        objs.append(('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 842] /Contents %d 0 R /Resources << /Font << /F1 3 0 R >> >> >>' % (5 + 2 * i)).encode())
        objs.append(('<< /Length %d >>\nstream\n' % len(cuerpo)).encode() + cuerpo + b'\nendstream')
    out, offs = b'%PDF-1.4\n', []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += ('%d 0 obj\n' % i).encode() + o + b'\nendobj\n'
    xref = len(out)
    out += ('xref\n0 %d\n' % (len(objs) + 1)).encode() + b'0000000000 65535 f \n' + b''.join(('%010d 00000 n \n' % o).encode() for o in offs)
    out += ('trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, xref)).encode()
    return out


def lineas_memoria(ventas=12000000, costo=7200000, bruto=4800000, op=3100000, neto=1500000, act=24000000, pt=9000000, pat=15000000, previo=True, ascendente=True):
    """Texto de una memoria con balance y estado de resultados comparativos. El ejercicio actual va en la segunda columna si ascendente."""
    def f(v):
        return format(v, ',').replace(',', '.')

    def fila(nombre, a, b):
        pair = (a, b) if ascendente else (b, a)
        return '%-30s %14s %14s' % (nombre, f(pair[0]), f(pair[1]))
    cab = 'Mar-25            Notas        Mar-26' if ascendente else '2026               2025'
    p1 = ['MEMORIA ANUAL 2026', 'Carta del presidente', 'Estimados accionistas: este ejercicio fue de crecimiento. ' * 2]
    bal = ['MEMORIA ANUAL 2026', 'BALANCE GENERAL', 'Del 1 de Abril de 2025 al 31 de Marzo de 2026', '(Expresado en Bolivianos)', cab,
           fila('Activo Corriente', 5000000, 6000000), fila('TOTAL ACTIVO', 20000000, act), fila('Pasivo Corriente', 3000000, 3500000),
           fila('Total Pasivo', 8000000, pt), fila('Total Patrimonio', 12000000, pat)]
    res = ['MEMORIA ANUAL 2026', 'ESTADO DE RESULTADOS', 'Del 1 de Abril de 2025 al 31 de Marzo de 2026', '(Expresado en Bolivianos)', cab,
           fila('Ventas Netas', 10000000, ventas), fila('Costo de Ventas', 6000000, costo), fila('Utilidad Bruta', 4000000, bruto),
           fila('Gastos de Operacion', 1500000, bruto - op), fila('Resultado Operativo', 2500000, op), fila('Resultado de la Gestion', 1200000, neto)]
    return [p1, bal, res]


class Servidor:
    """Imita la API de la Gaceta: exige los encabezados Origin y Referer, filtra por matrícula, razón social y categoría, y sirve PDF en base64."""

    def __init__(self):
        self.publicaciones = []   # dicts: id, codigo, fecha, titulo, matricula, razon, pdf (bytes), estado_http (para simular errores)
        self.pedidos = []
        srv = self

        class H(http.server.BaseHTTPRequestHandler):
            def _ok(self):
                if self.headers.get('Origin') != ORIGEN or not (self.headers.get('Referer') or '').startswith(ORIGEN):
                    self.send_response(403)
                    self.end_headers()
                    return False
                return True

            def _json(self, cuerpo, codigo=200):
                b = json.dumps(cuerpo).encode()
                self.send_response(codigo)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(b)))
                self.end_headers()
                self.wfile.write(b)

            def do_POST(self):
                n = int(self.headers.get('Content-Length') or 0)
                cuerpo = json.loads(self.rfile.read(n) or b'{}')
                srv.pedidos.append(('POST', self.path, cuerpo))
                if not self._ok():
                    return
                filas = [p for p in srv.publicaciones
                         if (not cuerpo.get('matricula') or p['matricula'] == cuerpo['matricula'])
                         and (not cuerpo.get('razonSocial') or cuerpo['razonSocial'].lower() in p['razon'].lower())]
                filas = sorted(filas, key=lambda p: p['fecha'], reverse=True)
                lim, pag = cuerpo.get('limite', 10), cuerpo.get('pagina', 1)
                self._json({'finalizado': True, 'mensaje': 'ok', 'datos': {'total': len(filas), 'filas': [
                    {'id': p['id'], 'codigo': p['codigo'], 'titulo': p['titulo'], 'fechaPublicacionFormato': p['fecha'].replace('-', '/'),
                     'empresa': {'matricula': p['matricula'], 'razonSocial': p['razon']}} for p in filas[(pag - 1) * lim: pag * lim]]}}, 201)

            def do_GET(self):
                srv.pedidos.append(('GET', self.path, None))
                if not self._ok():
                    return
                id_ = self.path.rsplit('/', 1)[-1]
                p = next((x for x in srv.publicaciones if x['id'] == id_), None)
                if p is None:
                    self._json({'finalizado': False, 'mensaje': 'no existe'}, 404)
                elif p.get('estado_http'):
                    self.send_response(p['estado_http'])
                    self.end_headers()
                else:
                    self._json({'finalizado': True, 'datos': {'id': p['id'], 'codigo': p['codigo'], 'documento': base64.b64encode(p['pdf']).decode()}})

            def log_message(self, *a):
                pass

        self.httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
        self.url = 'http://127.0.0.1:%d/api' % self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def cerrar(self):
        self.httpd.shutdown()

    def agregar(self, id_, codigo, fecha, matricula, razon, pdf=None, estado_http=None):
        self.publicaciones.append({'id': id_, 'codigo': codigo, 'fecha': fecha, 'titulo': 'PUBLICACIÓN DE LA MEMORIA ANUAL DE LA SOCIEDAD ' + razon,
                                   'matricula': matricula, 'razon': razon, 'pdf': pdf if pdf is not None else pdf_bytes(lineas_memoria()), 'estado_http': estado_http})


def registro_prueba(**extra):
    r = {'agente': 'gaceta-anual/prueba', 'origen': ORIGEN, 'espera_segundos': 0, 'tamano_maximo_mb': 5, 'ventana': {'inicio_mes': 6, 'plazo_mes': 10},
         'descubrir': ['CERAMICA'],
         'empresas': [{'id': 'aa', 'matricula': '111', 'nombre': 'Alfa', 'razon': 'Cerámica Alfa', 'tipo': 'externa', 'cierre_mes': 3},
                      {'id': 'bb', 'matricula': '222', 'nombre': 'Beta', 'razon': 'Cerámica Beta', 'tipo': 'grupo', 'cierre_mes': 3}],
         'ignoradas': [{'matricula': '999', 'razon': 'Cerámica Ignorada S.A.', 'motivo': 'otro rubro'}]}
    r.update(extra)
    return r


# ----------------------------------------------------------------------------------------------------------------------
class TestNumeros(unittest.TestCase):
    def test_formatos(self):
        casos = {'1.234.567,89': 1234567.89, '1,234,567.89': 1234567.89, '(2.303.238,90)': -2303238.90, '-1,595,497.57': -1595497.57,
                 '13 758 083.39': 13758083.39, '5.683.540': 5683540.0, '12.5': 12.5, '13.047.684.14': 13047684.14, '1234567': 1234567.0}
        for texto, esperado in casos.items():
            self.assertAlmostEqual(ga.numero(texto), esperado, places=2, msg=texto)

    def test_valores_de_una_linea(self):
        self.assertEqual(ga.valores_de('Ventas Netas 27  40,913,642   44,067,065'), [40913642.0, 44067065.0])
        self.assertEqual(ga.valores_de('Ventas Notas 49,198,613 26 51,944,904'), [49198613.0, 51944904.0])     # el 26 es el número de nota
        self.assertEqual(ga.valores_de('Utilidad (331.057) 1.318.049'), [-331057.0, 1318049.0])


class TestEncabezado(unittest.TestCase):
    def test_columnas_ascendentes_y_descendentes(self):
        self.assertEqual(ga.encabezado(['BALANCE', 'Mar-25 Notas Mar-26'])[0], [2025, 2026])
        self.assertEqual(ga.encabezado(['BALANCE', 'ACTIVO Notas 2026 2025'])[0], [2026, 2025])
        self.assertEqual(ga.encabezado(['Nota 31/03/2024 31/03/2023'])[0], [2024, 2023])

    def test_la_cabecera_de_columnas_gana_al_titulo_del_periodo(self):
        lineas = ['ESTADO DE RESULTADOS', 'Por el ejercicio comprendido entre el 1 de abril de 2023 al 31 de marzo de 2024', 'Nota 31/03/2024 31/03/2023']
        cols, ej = ga.encabezado(lineas)
        self.assertEqual(cols, [2024, 2023])
        self.assertEqual(ej, 2024)

    def test_no_cuentan_rangos_ni_el_encabezado_corrido(self):
        cols, ej = ga.encabezado(['MEMORIA ANUAL 2026', 'Memoria Anual', '2024/2025', 'INGRESOS 2025 2024'])
        self.assertEqual(cols, [2025, 2024])
        self.assertEqual(ej, 2025)
        cols, ej = ga.encabezado(['MEMORIA 2024 - 2025', 'Reexpresado Reexpresado', 'Nota Mar-25 Mar-24'])
        self.assertEqual(cols, [2025, 2024])


class TestLector(unittest.TestCase):
    def leer(self, paginas, metodo='texto'):
        return ga.leer_memoria([(i + 1, '\n'.join(l), metodo) for i, l in enumerate(paginas)])

    def test_columnas_ascendentes_toman_la_segunda(self):
        r = self.leer(lineas_memoria())
        self.assertEqual(r['ejercicio'], 2026)
        c = r['cifras']
        self.assertEqual((c['ventas'], c['costo'], c['bruto'], c['operativo'], c['neto']), (12000000, 7200000, 4800000, 3100000, 1500000))
        self.assertEqual((c['ac'], c['act'], c['pc'], c['pt'], c['pat']), (6000000, 24000000, 3500000, 9000000, 15000000))
        self.assertEqual(c['gastos_op'], 1700000)
        self.assertEqual(ga.validar(c), ('ok', []))
        self.assertEqual(r['alertas'], [])

    def test_columnas_descendentes_toman_la_primera(self):
        r = self.leer(lineas_memoria(ascendente=False))
        self.assertEqual(r['cifras']['ventas'], 12000000)
        self.assertEqual(r['cifras']['act'], 24000000)

    def test_el_costo_entre_parentesis_queda_positivo(self):
        p = lineas_memoria()
        p[2] = [l.replace('Costo de Ventas', 'Costo de Ventas (') if False else l for l in p[2]]
        texto = [l.replace(' 7.200.000', ' (7.200.000)') for l in p[2]]
        r = self.leer([p[0], p[1], texto])
        self.assertEqual(r['cifras']['costo'], 7200000)

    def test_balance_en_dos_paginas_y_depreciacion_aparte(self):
        res = ['ESTADO DE RESULTADOS', 'INGRESOS 2026 2025', 'Ventas Netas 11.964.059 11.260.850', 'Costo de Ventas de lo Vendido (8.117.868) (8.007.604)',
               'Depreciaciones (393.417) (406.287)', 'Utilidad Bruta en Ventas 3.452.774 2.846.959', 'GASTOS DE OPERACION', 'Administracion (2.191.624) (1.910.888)',
               'Resultado Neto de Operacion (1.258.660) (953.774)', 'RESULTADO NETO (1.436.754) (1.197.660)']
        activo = ['BALANCE GENERAL', 'ACTIVO Notas 2026 2025', 'ACTIVO CORRIENTE', '9.120.539 8.197.149', 'TOTAL ACTIVO 40.672.010 41.012.461']
        pasivo = ['BALANCE GENERAL', 'PASIVO Y PATRIMONIO Notas 2026 2025', 'PASIVO CORRIENTE', 'TOTAL PASIVO 14.554.680 13.458.377',
                  'PATRIMONIO NETO. 26.117.330 27.554.084', 'TOTAL PASIVO Y PATRIMONIO. 40.672.010 41.012.461']
        r = self.leer([activo, pasivo, res])
        c = r['cifras']
        self.assertEqual(r['ejercicio'], 2026)
        self.assertEqual((c['ventas'], c['bruto'], c['neto'], c['operativo']), (11964059, 3452774, -1436754, -1258660))
        self.assertEqual(c['costo'], 8117868 + 393417)           # suma la depreciación
        self.assertEqual((c['act'], c['pt'], c['pat']), (40672010, 14554680, 26117330))
        self.assertEqual(ga.validar(c)[0], 'ok')
        self.assertIn('el costo incluye la depreciación', ' '.join(r['avisos']))

    def test_gestion_antes_de_impuestos_no_es_el_resultado_neto(self):
        res = ['ESTADO DE GANANCIAS Y PERDIDAS', '2025 2024', 'Ventas netas 221.310.767 196.756.361', 'Costo de ventas (134.842.702) (115.847.526)',
               'Utilidad bruta 86.468.065 80.908.835', 'Gastos de administracion (13.050.170) (13.189.948)', 'Utilidad operativa 20.279.872 16.915.178',
               'Utilidad del ejercicio antes de impuestos 2.528.731 1.809.095', '(Perdida) Utilidad del ejercicio (331.057) 1.318.049']
        r = self.leer([res])
        self.assertEqual(r['cifras']['neto'], -331057)

    def test_ventas_brutas_no_son_las_ventas_netas(self):
        res = ['ESTADO DE RESULTADOS COMPARATIVO', 'Mar-25 Notas Mar-26', 'Ingresos Operativos Notos 19.869.883 21 23.506.118', 'Ventas brutas/facturadas 22.821.166 24.838.571',
               'Costo de Ventas 11.099.832 12.238.167', 'Utilidad Bruta 8.770.052 11.267.960', 'Gastos de Operacion 2.495.176 2.881.677', 'Resultado Operativo 6.274.876 8.386.283']
        r = self.leer([res])
        self.assertEqual(r['cifras']['ventas'], 23506118)         # el OCR escribió «Notos»; igual se reconoce
        self.assertEqual(r['cifras']['bruto'], 11267960)

    def test_lo_que_no_cuadra_queda_por_revisar(self):
        r = self.leer(lineas_memoria(costo=7000000))               # ventas - costo != bruto
        estado, avisos = ga.validar(r['cifras'])
        self.assertEqual(estado, 'revisar')
        self.assertIn('ventas - costo', ' '.join(avisos))
        r = self.leer(lineas_memoria(pat=14000000))                # activo != pasivo + patrimonio
        self.assertIn('activo - pasivo - patrimonio', ' '.join(ga.validar(r['cifras'])[1]))

    def test_sin_balance_o_sin_resultados_pide_revision(self):
        r = self.leer([lineas_memoria()[2]])
        self.assertIn('falta el balance', ga.validar(r['cifras'])[1])
        r = self.leer([lineas_memoria()[1]])
        self.assertIn('falta el estado de resultados', ga.validar(r['cifras'])[1])
        r = self.leer([['Carta del presidente', 'Estimados accionistas']])
        self.assertTrue(r['alertas'])

    def test_balance_sin_lineas_de_pasivo_no_se_da_por_comprobado(self):
        p = lineas_memoria()
        p[1] = [l for l in p[1] if 'Pasivo' not in l and 'Patrimonio' not in l]
        r = self.leer(p)
        self.assertIn('no se pudo comprobar el balance', ' '.join(r['alertas']))

    def test_la_lectura_por_ocr_pide_confirmacion(self):
        r = self.leer(lineas_memoria(), metodo='ocr')
        self.assertIn('reconocimiento de texto', ' '.join(r['alertas']))

    def test_sin_anos_en_el_encabezado_no_se_adivina_la_columna(self):
        p = lineas_memoria()
        p = [[l for l in pag if 'Mar-25' not in l and '2026   ' not in l] for pag in p]
        r = self.leer(p)
        self.assertIn('no se pudo saber qué columna', ' '.join(r['alertas']))

    def test_orden_de_columnas_heredado_de_otra_pagina(self):
        p = lineas_memoria()
        p[2] = [l for l in p[2] if 'Mar-25' not in l]              # los resultados no traen años, el balance sí
        r = self.leer(p)
        self.assertEqual(r['cifras']['ventas'], 12000000)
        self.assertEqual(r['alertas'], [])


@unittest.skipUnless(HAY_POPPLER, 'falta pdftotext')
class TestPdf(unittest.TestCase):
    def test_texto_de_un_pdf_digital(self):
        with tempfile.TemporaryDirectory() as d:
            ruta = Path(d) / 'm.pdf'
            ruta.write_bytes(pdf_bytes(lineas_memoria()))
            paginas = ga.texto_paginas(ruta, ocr=False)
            self.assertEqual(len(paginas), 3)
            self.assertTrue(all(m == 'texto' for _, _, m in paginas))
            r = ga.leer_memoria(paginas)
            self.assertEqual(r['ejercicio'], 2026)
            self.assertEqual(r['cifras']['ventas'], 12000000)
            self.assertEqual(ga.validar(r['cifras'])[0], 'ok')

    def test_las_paginas_con_solo_encabezado_digital_se_reconocen_por_ocr(self):
        """Las tablas insertadas como imagen dejan en el PDF solo el encabezado: esas páginas van a OCR y el texto se suma al digital."""
        from unittest import mock
        paginas = [['MEMORIA ANUAL 2026', 'INDUSTRIA CERAMICA PRUEBA S.A. pag. 1', 'Carta del presidente: un año de crecimiento sostenido para la empresa.'],     # sin cifras, pero es texto de la carta
                   ['MEMORIA ANUAL 2026', 'INDUSTRIA CERAMICA PRUEBA S.A. pag. 2', 'BALANCE GENERAL'],                                                              # encabezado digital + tabla en imagen
                   ['x']]                                                                                                                                          # página casi vacía
        llamadas = []

        def falso_ocr(ruta, pagina, ancho):
            llamadas.append((pagina, ancho))
            return 'TOTAL ACTIVO 24.000.000'
        with tempfile.TemporaryDirectory() as d, mock.patch.object(ga, '_ocr', falso_ocr), mock.patch.object(ga.shutil, 'which', lambda x: '/usr/bin/' + x):
            ruta = Path(d) / 'm.pdf'
            ruta.write_bytes(pdf_bytes(paginas))
            r = ga.texto_paginas(ruta, ocr=True)
        self.assertEqual(sorted(p for p, _ in llamadas), [1, 2, 3])          # ninguna trae cifras: las tres pasan por OCR
        self.assertTrue(all(ancho == 1900 for _, ancho in llamadas))
        self.assertTrue(all(m == 'ocr' for _, _, m in r))
        self.assertIn('BALANCE GENERAL', r[1][1])
        self.assertIn('TOTAL ACTIVO 24.000.000', r[1][1])

    def test_una_pagina_con_cifras_no_pasa_por_ocr(self):
        from unittest import mock
        llamadas = []
        with tempfile.TemporaryDirectory() as d, mock.patch.object(ga, '_ocr', lambda *a: llamadas.append(a) or ''), mock.patch.object(ga.shutil, 'which', lambda x: '/usr/bin/' + x):
            ruta = Path(d) / 'm.pdf'
            ruta.write_bytes(pdf_bytes(lineas_memoria()))
            ga.texto_paginas(ruta, ocr=True)
        self.assertEqual([a[1] for a in llamadas], [1])          # solo la carta, que no trae cifras; el balance y los resultados ya traen sus cifras

    def test_pdf_danado(self):
        with tempfile.TemporaryDirectory() as d:
            ruta = Path(d) / 'roto.pdf'
            ruta.write_bytes(b'%PDF-1.4 esto no es un pdf')
            with self.assertRaises(RuntimeError):
                ga.texto_paginas(ruta, ocr=False)


class Base(unittest.TestCase):
    def setUp(self):
        self.srv = Servidor()
        self.tmp = tempfile.mkdtemp()
        self.datos, self.archivo = Path(self.tmp) / 'datos', Path(self.tmp) / 'archivo'

    def tearDown(self):
        self.srv.cerrar()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def actualizar(self, registro=None, hoy='2026-09-15', **kw):
        return ga.actualizar(self.datos, self.archivo, registro or registro_prueba(), hoy=dt.date.fromisoformat(hoy), espera=0, api=self.srv.url, **kw)

    def sembrar_memorias(self, filas):
        ga.Almacen(self.datos).guardar_memorias(filas)

    def csv(self, nombre):
        with open(self.datos / nombre, encoding='utf-8', newline='') as f:
            return list(csv.DictReader(f))


@unittest.skipUnless(HAY_POPPLER, 'falta pdftotext')
class TestActualizar(Base):
    def test_descarga_lee_y_guarda_lo_nuevo(self):
        self.srv.agregar('1', '100/2025', '2025-09-01', '111', 'CERAMICA ALFA S.A.')            # ya conocida
        self.srv.agregar('2', '200/2026', '2026-08-20', '111', 'CERAMICA ALFA S.A.')            # nueva
        self.sembrar_memorias([{'matricula': '111', 'empresa': 'Alfa', 'codigo': '100/2025', 'id_gaceta': '1', 'fecha': '2025-09-01', 'titulo': 't', 'estado': 'carga_inicial'}])
        res, informe = self.actualizar(buscar_nuevas=False)
        alfa = next(r for r in res if r['id'] == 'aa')
        self.assertEqual([n['codigo'] for n in alfa['nuevas']], ['200/2026'])
        self.assertEqual(alfa['nuevas'][0]['estado'], 'leida')
        self.assertTrue((self.archivo / '111' / '200-2026.pdf').exists())
        # solo se descargó la nueva
        self.assertEqual([p for m, p, _ in self.srv.pedidos if m == 'GET'], ['/api/publicaciones/2'])
        memorias = {r['codigo']: r for r in self.csv('memorias.csv')}
        self.assertEqual(memorias['200/2026']['estado'], 'leida')
        self.assertEqual(memorias['200/2026']['ejercicio'], '2026')
        self.assertEqual(len(memorias['200/2026']['sha256']), 64)
        cifras = {r['concepto']: r for r in self.csv('cifras.csv') if r['matricula'] == '111'}
        self.assertEqual(float(cifras['ventas']['valor']), 12000000.0)
        self.assertEqual((cifras['ventas']['metodo'], cifras['ventas']['estado']), ('auto', 'ok'))
        self.assertIn('Memorias nuevas', informe)
        resumen = json.loads((self.datos / 'ultimo_resumen.json').read_text(encoding='utf-8'))
        self.assertEqual((resumen['con_memorias_nuevas'], resumen['errores'], resumen['por_revisar']), (['aa'], [], []))

    def test_segunda_ejecucion_no_vuelve_a_descargar(self):
        self.srv.agregar('2', '200/2026', '2026-08-20', '111', 'CERAMICA ALFA S.A.')
        self.actualizar(buscar_nuevas=False)
        pedidos = len(self.srv.pedidos)
        res, _ = self.actualizar(buscar_nuevas=False)
        self.assertEqual([r['nuevas'] for r in res], [[], []])
        self.assertFalse(any(m == 'GET' for m, _, _ in self.srv.pedidos[pedidos:]))

    def test_la_api_exige_origin_y_referer(self):
        import urllib.request
        import urllib.error
        req = urllib.request.Request(self.srv.url + '/publicaciones', data=b'{}', method='POST', headers={'Content-Type': 'application/json', 'User-Agent': 'x'})
        with self.assertRaises(urllib.error.HTTPError) as cm:
            urllib.request.urlopen(req)
        self.assertEqual(cm.exception.code, 403)
        self.srv.agregar('2', '200/2026', '2026-08-20', '111', 'CERAMICA ALFA S.A.')
        res, _ = self.actualizar(buscar_nuevas=False)             # el cliente sí los envía
        self.assertEqual(len(next(r for r in res if r['id'] == 'aa')['nuevas']), 1)

    def test_un_error_de_descarga_no_se_registra_y_se_reintenta(self):
        self.srv.agregar('3', '300/2026', '2026-08-25', '222', 'CERAMICA BETA S.A.', estado_http=412)
        res, _ = self.actualizar(buscar_nuevas=False)
        beta = next(r for r in res if r['id'] == 'bb')
        self.assertEqual(beta['estado'], 'error')
        self.assertIn('300/2026', beta['mensaje'])
        self.assertEqual([r['codigo'] for r in self.csv('memorias.csv')], [])
        self.srv.publicaciones[0]['estado_http'] = None           # la Gaceta se arregla
        res, _ = self.actualizar(buscar_nuevas=False)
        self.assertEqual(next(r for r in res if r['id'] == 'bb')['estado'], 'nuevas')

    def test_una_empresa_con_error_no_frena_a_las_demas_y_el_codigo_de_salida_es_1(self):
        self.srv.agregar('2', '200/2026', '2026-08-20', '111', 'CERAMICA ALFA S.A.')
        self.srv.agregar('3', '300/2026', '2026-08-25', '222', 'CERAMICA BETA S.A.', estado_http=412)
        reg = Path(self.tmp) / 'empresas.json'
        reg.write_text(json.dumps(registro_prueba()), encoding='utf-8')
        codigo = ga.main(['--empresas-json', str(reg), '--dir-datos', str(self.datos), '--dir-archivo', str(self.archivo), '--api', self.srv.url, '--ahora', '2026-09-15',
                          'actualizar', '--sin-descubrir', '--espera', '0'])
        self.assertEqual(codigo, 1)
        self.assertEqual([r['codigo'] for r in self.csv('memorias.csv')], ['200/2026'])

    def test_un_pdf_sin_estados_queda_por_revisar(self):
        self.srv.agregar('2', '200/2026', '2026-08-20', '111', 'CERAMICA ALFA S.A.', pdf=pdf_bytes([['Carta del presidente', 'Estimados accionistas: este ejercicio fue bueno.']]))
        res, informe = self.actualizar(buscar_nuevas=False)
        alfa = next(r for r in res if r['id'] == 'aa')
        self.assertEqual(alfa['nuevas'][0]['estado'], 'revisar')
        self.assertEqual(len(alfa['por_revisar']), 1)
        self.assertIn('Cifras por revisar', informe)
        self.assertIn('confirmar', informe)
        resumen = json.loads((self.datos / 'ultimo_resumen.json').read_text(encoding='utf-8'))
        self.assertEqual(resumen['por_revisar'], ['aa'])

    def test_un_documento_que_no_es_pdf_es_un_error(self):
        self.srv.agregar('2', '200/2026', '2026-08-20', '111', 'CERAMICA ALFA S.A.', pdf=b'<html>no soy un pdf</html>')
        res, _ = self.actualizar(buscar_nuevas=False)
        self.assertEqual(next(r for r in res if r['id'] == 'aa')['estado'], 'error')

    def test_sin_lectura_solo_descarga(self):
        self.srv.agregar('2', '200/2026', '2026-08-20', '111', 'CERAMICA ALFA S.A.')
        self.actualizar(buscar_nuevas=False, leer=False)
        self.assertTrue((self.archivo / '111' / '200-2026.pdf').exists())
        self.assertEqual(self.csv('cifras.csv') if (self.datos / 'cifras.csv').exists() else [], [])

    def test_solo_una_empresa(self):
        self.srv.agregar('2', '200/2026', '2026-08-20', '111', 'CERAMICA ALFA S.A.')
        self.srv.agregar('3', '300/2026', '2026-08-25', '222', 'CERAMICA BETA S.A.')
        res, _ = self.actualizar(ids={'bb'}, buscar_nuevas=False)
        self.assertEqual([r['id'] for r in res], ['bb'])


class TestConocer(Base):
    def test_registra_el_historial_sin_descargar(self):
        self.srv.agregar('1', '100/2024', '2024-09-01', '111', 'CERAMICA ALFA S.A.')
        self.srv.agregar('2', '200/2025', '2025-09-01', '111', 'CERAMICA ALFA S.A.')
        n = ga.conocer(self.datos, registro_prueba(), ids={'aa'}, hoy=dt.date(2026, 11, 12), espera=0, api=self.srv.url)
        self.assertEqual(n, 2)
        self.assertEqual({(r['codigo'], r['estado']) for r in self.csv('memorias.csv')}, {('100/2024', 'carga_inicial'), ('200/2025', 'carga_inicial')})
        self.assertFalse(any(m == 'GET' for m, _, _ in self.srv.pedidos))
        self.assertEqual(ga.conocer(self.datos, registro_prueba(), ids={'aa'}, hoy=dt.date(2026, 11, 12), espera=0, api=self.srv.url), 0)      # repetirlo no duplica
        self.srv.agregar('3', '300/2026', '2026-09-01', '111', 'CERAMICA ALFA S.A.')
        res, _ = ga.actualizar(self.datos, self.archivo, registro_prueba(), ids={'aa'}, hoy=dt.date(2026, 11, 13), espera=0, api=self.srv.url, buscar_nuevas=False, leer=False)
        self.assertEqual([n['codigo'] for n in res[0]['nuevas']], ['300/2026'])


class TestAtraso(Base):
    def test_atrasada_despues_del_plazo_si_no_publico_este_ano(self):
        self.srv.agregar('1', '100/2025', '2025-09-30', '111', 'CERAMICA ALFA S.A.')
        self.srv.agregar('2', '200/2026', '2026-08-20', '222', 'CERAMICA BETA S.A.')
        self.sembrar_memorias([{'matricula': '111', 'empresa': 'Alfa', 'codigo': '100/2025', 'id_gaceta': '1', 'fecha': '2025-09-30', 'titulo': 't', 'estado': 'carga_inicial'},
                               {'matricula': '222', 'empresa': 'Beta', 'codigo': '200/2026', 'id_gaceta': '2', 'fecha': '2026-08-20', 'titulo': 't', 'estado': 'carga_inicial'}])
        res, informe = self.actualizar(hoy='2026-11-15', buscar_nuevas=False, leer=False)
        self.assertEqual([r['id'] for r in res if r['atrasada']], ['aa'])
        self.assertIn('atrasada', informe)
        res, _ = self.actualizar(hoy='2026-09-15', buscar_nuevas=False, leer=False)           # dentro de la ventana de publicación: aún no
        self.assertEqual([r['id'] for r in res if r['atrasada']], [])

    def test_funcion_de_atraso(self):
        e = {'cierre_mes': 3}
        v = {'inicio_mes': 6, 'plazo_mes': 10}
        self.assertTrue(ga._atrasada(e, dt.date(2025, 9, 1), dt.date(2026, 11, 1), v))
        self.assertFalse(ga._atrasada(e, dt.date(2025, 9, 1), dt.date(2026, 10, 31), v))
        self.assertFalse(ga._atrasada(e, dt.date(2026, 6, 1), dt.date(2026, 12, 1), v))
        self.assertTrue(ga._atrasada(e, None, dt.date(2026, 12, 1), v))
        self.assertFalse(ga._atrasada({'cierre_mes': 12}, None, dt.date(2026, 12, 1), v))


class TestDescubrir(Base):
    def test_avisa_de_empresas_nuevas_del_rubro_pero_no_de_las_conocidas_ni_las_ignoradas(self):
        self.srv.agregar('1', '100/2025', '2025-09-01', '111', 'CERAMICA ALFA S.A.')
        self.srv.agregar('2', '200/2025', '2025-09-02', '999', 'CERAMICA IGNORADA S.A.')
        self.srv.agregar('3', '300/2026', '2026-08-30', '555', 'CERAMICA NUEVA S.A.')
        self.srv.agregar('4', '400/2026', '2026-08-31', '555', 'CERAMICA NUEVA S.A.')
        self.sembrar_memorias([{'matricula': '111', 'empresa': 'Alfa', 'codigo': '100/2025', 'id_gaceta': '1', 'fecha': '2025-09-01', 'titulo': 't', 'estado': 'carga_inicial'}])
        _, informe = self.actualizar(leer=False)
        resumen = json.loads((self.datos / 'ultimo_resumen.json').read_text(encoding='utf-8'))
        self.assertEqual([d['matricula'] for d in resumen['descubiertas']], ['555'])
        self.assertEqual(resumen['descubiertas'][0]['memorias'], 2)
        self.assertIn('Empresas nuevas del rubro', informe)
        self.assertIn('CERAMICA NUEVA S.A.', informe)


class TestAlmacenYExportar(Base):
    def cifras(self, filas):
        ga.Almacen(self.datos).guardar_cifras(filas)

    def fila(self, ej, concepto, valor, metodo='manual', estado='ok'):
        return {'matricula': '111', 'empresa': 'Alfa', 'ejercicio': str(ej), 'concepto': concepto, 'valor': repr(float(valor)), 'publicacion': 'x', 'metodo': metodo, 'estado': estado, 'visto_el': '2026-01-01'}

    def test_exporta_razones_y_respeta_correcciones_y_revisar(self):
        self.cifras([self.fila(2026, 'ventas', 1000), self.fila(2026, 'costo', 600), self.fila(2026, 'bruto', 400), self.fila(2026, 'operativo', 250), self.fila(2026, 'neto', 100),
                     self.fila(2026, 'ac', 300), self.fila(2026, 'pc', 200), self.fila(2026, 'act', 2000), self.fila(2026, 'pt', 800),
                     self.fila(2025, 'ventas', 900, metodo='auto', estado='revisar')])
        alm = ga.Almacen(self.datos)
        alm.guardar_correcciones([{'matricula': '111', 'ejercicio': '2026', 'concepto': 'neto', 'valor': '120.0', 'nota': 'leído del PDF'}])
        pares = ga.exportar(self.datos, Path(self.tmp) / 'salida', registro_prueba())
        self.assertEqual([p['id'] for p in pares], ['aa'])
        alfa = pares[0]
        self.assertEqual(list(alfa['ej']), ['2026'])             # 2025 está por revisar: no sale
        r = alfa['rr']['2026']
        self.assertAlmostEqual(r['bruto'], 40.0)
        self.assertAlmostEqual(r['neto'], 12.0)                  # manda la corrección
        self.assertAlmostEqual(r['gastos_op'], 15.0)
        self.assertAlmostEqual(r['razon'], 1.5)
        self.assertAlmostEqual(r['pasivo_activo'], 40.0)
        archivo = json.loads((Path(self.tmp) / 'salida' / 'pares.json').read_text(encoding='utf-8'))
        self.assertEqual(archivo['pares'][0]['nombre'], 'Alfa')

    def test_fusion_no_pisa_lo_verificado_a_mano_y_avisa(self):
        previos = [self.fila(2026, 'ventas', 1000), self.fila(2026, 'costo', 600, metodo='auto')]
        nuevas = [self.fila(2026, 'ventas', 1200, metodo='auto'), self.fila(2026, 'costo', 650, metodo='auto'), self.fila(2026, 'bruto', 400, metodo='auto')]
        todas, cambios = ga.fusionar_cifras(previos, nuevas)
        por = {r['concepto']: r for r in todas}
        self.assertEqual(float(por['ventas']['valor']), 1000.0)         # manual: se conserva
        self.assertEqual(float(por['costo']['valor']), 650.0)           # automática: se actualiza
        self.assertIn('bruto', por)
        self.assertEqual([(c[0][2], c[1], c[2]) for c in cambios], [('ventas', '1000.0', '1200.0')])

    def test_corregir_y_confirmar(self):
        self.cifras([self.fila(2026, 'ventas', 1000, metodo='auto', estado='revisar'), self.fila(2026, 'costo', 600, metodo='auto', estado='revisar')])
        ga.corregir(self.datos, registro_prueba(), 'aa', 2026, 'costo', 650.5, 'del PDF')
        ga.corregir(self.datos, registro_prueba(), 'aa', 2026, 'costo', 640, 'otra vez')            # reemplaza, no duplica
        corr = ga.Almacen(self.datos).correcciones()
        self.assertEqual([(c['concepto'], c['valor']) for c in corr], [('costo', '640.0')])
        with self.assertRaises(SystemExit):
            ga.corregir(self.datos, registro_prueba(), 'aa', 2026, 'inventado', 1)
        self.assertEqual(ga.confirmar(self.datos, registro_prueba(), 'aa', 2026), 2)
        self.assertEqual({(r['metodo'], r['estado']) for r in ga.Almacen(self.datos).cifras()}, {('manual', 'ok')})
        with self.assertRaises(SystemExit):
            ga.confirmar(self.datos, registro_prueba(), 'aa', 2026)


class TestCargaInicial(unittest.TestCase):
    """Comprueba que el registro y los datos que se guardan en git son coherentes."""
    AQUI = Path(__file__).resolve().parent.parent

    def test_registro(self):
        reg = ga.cargar_registro()
        ids = [e['id'] for e in reg['empresas']]
        mats = [e['matricula'] for e in reg['empresas']]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(len(mats), len(set(mats)))
        ign = {e['matricula'] for e in reg['ignoradas']}
        self.assertFalse(ign & set(mats), 'una empresa no puede estar seguida e ignorada a la vez')
        self.assertTrue(all(e.get('tipo') in ('externa', 'grupo') for e in reg['empresas']))
        self.assertEqual(reg['origen'], ORIGEN)

    def test_datos_guardados(self):
        reg = ga.cargar_registro()
        alm = ga.Almacen(self.AQUI / 'datos')
        mats = {e['matricula'] for e in reg['empresas']}
        codigos = [(r['matricula'], r['codigo']) for r in alm.memorias()]
        self.assertEqual(len(codigos), len(set(codigos)), 'publicaciones repetidas en memorias.csv')
        self.assertTrue({m for m, _ in codigos} <= mats)
        for r in alm.cifras():
            self.assertIn(r['concepto'], ga.CONCEPTOS)
            self.assertIn(r['matricula'], mats)
            float(r['valor'])
        # lo verificado a mano cumple las igualdades contables
        por = {}
        for r in alm.cifras():
            por.setdefault((r['matricula'], r['ejercicio']), {})[r['concepto']] = float(r['valor'])
        self.assertGreater(len(por), 15)
        for k, c in por.items():
            if all(x in c for x in ('ventas', 'costo', 'bruto')):
                self.assertLess(abs(c['ventas'] - c['costo'] - c['bruto']), 2, k)
            if all(x in c for x in ('act', 'pt', 'pat')):
                self.assertLess(abs(c['act'] - c['pt'] - c['pat']), 5, k)


if __name__ == '__main__':
    unittest.main()

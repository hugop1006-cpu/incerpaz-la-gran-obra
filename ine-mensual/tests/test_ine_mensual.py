"""Pruebas de ine_mensual sin tocar internet: planillas armadas al vuelo y un servidor local que hace de INE.
Ejecutar:  python3 -I -m unittest discover -s ine-mensual/tests -v
"""
import copy
import csv
import datetime as dt
import http.server
import io
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import openpyxl  # noqa: E402

import ine_mensual as im  # noqa: E402


def planilla(ruta, filas):
    wb = openpyxl.Workbook()
    ws = wb.active
    for f in filas:
        ws.append(f)
    wb.save(ruta)


def bytes_planilla(filas):
    wb = openpyxl.Workbook()
    ws = wb.active
    for f in filas:
        ws.append(f)
    b = io.BytesIO()
    wb.save(b)
    return b.getvalue()


def tabla_cemento(extra_meses=(), cochabamba_enero=200):
    """Tabla 'según año y mes' parecida a la del INE: cabecera con tilde, año como texto, meses con (p) y un signo suelto."""
    filas = [[], [None, 'BOLIVIA: CONSUMO DE CEMENTO POR DEPARTAMENTO'], [None, '(En toneladas métricas)'],
             [None, 'PERÍODO', 'CHUQUISACA', 'COCHABAMBA', 'TOTAL'], [],
             [None, '2025', 1000, 2000, 3000],
             [None, 'Enero', 80, cochabamba_enero, 280], [None, 'Febrero', '90', '210', '300'],
             [None, '|', 'Marzo', 95, 220, 315],
             [None, '2026 (p)', 0, 0, 0],
             [None, 'Enero', 85, 230, 315], [None, 'Febrero (p)', 88, 240, 328]]
    for mes, v in extra_meses:
        filas.append([None, mes] + list(v))
    filas.append([None, 'Fuente: empresas productoras'])
    return filas


PAGINA = '''<html><body><ul>
<li><a href="/index.php/s/AAA111">Bolivia – Consumo de Cemento por Departamento según Año y Mes 2000 – 2026</a></li>
<li><a href="/index.php/s/BBB222/download">Bolivia – Ventas de Cemento por Departamento según Año y Mes 1991 – 2026</a></li>
<li><a href="/index.php/s/CCC333/download"><span>Bolivia</span> – Producción de Cemento</a></li>
<li><a href="/otra/pagina">Solo una página</a></li>
</ul></body></html>'''


class Servidor:
    """Servidor HTTP mínimo cuyo contenido se cambia desde la prueba: {ruta: (estado, encabezados, cuerpo)}."""
    def __init__(self):
        self.rutas, self.pedidos = {}, []
        rutas, pedidos = self.rutas, self.pedidos

        class H(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                pedidos.append(self.path)
                est, enc, cuerpo = rutas.get(self.path, (404, {}, b'no existe'))
                self.send_response(est)
                for k, v in enc.items():
                    self.send_header(k, v)
                self.send_header('Content-Length', str(len(cuerpo)))
                self.end_headers()
                self.wfile.write(cuerpo)

            def log_message(self, *a):
                pass

        self.srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
        self.url = 'http://127.0.0.1:%d' % self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def poner(self, ruta, cuerpo, estado=200, **enc):
        self.rutas[ruta] = (estado, enc, cuerpo)

    def cerrar(self):
        self.srv.shutdown()
        self.srv.server_close()


class PruebasBasicas(unittest.TestCase):
    def test_norm_ignora_anios_y_tildes(self):
        self.assertEqual(im.norm('Bolivia – Producción de Cemento según Año y Mes 1991 – 2026'), 'bolivia produccion de cemento segun ano y mes')
        self.assertEqual(im.norm('Potosí'), 'potosi')

    def test_num(self):
        self.assertEqual(im.num('5841'), 5841.0)
        self.assertEqual(im.num('10.030.501'), 10030501.0)
        self.assertEqual(im.num('1,5'), 1.5)
        self.assertIsNone(im.num('-'))
        self.assertIsNone(im.num(None))
        self.assertIsNone(im.num('abc'))

    def test_expandir_plantilla_de_anio(self):
        reg = {'fuentes': [{'id': 'm_{anio}', 'titulo': 'T {anio}', 'anios': [0, -1], 'patron_crudo': '^X {anio}$', 'rezago_max_meses': 3,
                            'url_fija_por_anio': {'2025': 'http://a/2025'}}]}
        f = im.expandir(reg, dt.date(2026, 11, 15))
        self.assertEqual([x['id'] for x in f], ['m_2026', 'm_2025'])
        self.assertEqual(f[1]['patron_crudo'], '^X 2025$')
        self.assertEqual(f[1]['url_fija'], 'http://a/2025')
        self.assertIsNone(f[1]['rezago_max_meses'])  # el año anterior no se vigila por atraso
        self.assertEqual(f[0]['rezago_max_meses'], 3)
        self.assertNotIn('url_fija', f[0])


class PruebasEnlaces(unittest.TestCase):
    def test_encuentra_enlaces_aunque_cambie_el_anio_del_titulo(self):
        enl = im.enlaces_de_descarga(PAGINA, 'http://x/pag')
        self.assertEqual(len(enl), 3)  # la página sin extensión ni /s/ no cuenta
        self.assertTrue(all(h.endswith('/download') for _, h in enl))  # el recurso compartido sin /download se completa
        f = {'patron': '^bolivia consumo de cemento por departamento'}
        url, nota = im.elegir_enlace(f, enl)
        self.assertEqual(url, 'http://x/index.php/s/AAA111/download')
        self.assertIsNone(nota)
        # el texto interno con etiquetas se junta bien
        url, _ = im.elegir_enlace({'patron': '^bolivia produccion de cemento'}, enl)
        self.assertEqual(url, 'http://x/index.php/s/CCC333/download')

    def test_sin_coincidencia_y_ambigua(self):
        enl = im.enlaces_de_descarga(PAGINA, 'http://x/pag')
        url, motivo = im.elegir_enlace({'patron': '^no existe'}, enl)
        self.assertIsNone(url)
        self.assertIn('no hay un enlace', motivo)
        url, motivo = im.elegir_enlace({'patron': 'cemento'}, enl)
        self.assertIsNone(url)
        self.assertIn('varios enlaces', motivo)
        # si uno de los que coinciden es el conocido, se usa
        url, nota = im.elegir_enlace({'patron': 'cemento', 'url_fija': 'http://x/index.php/s/BBB222/download'}, enl)
        self.assertEqual(url, 'http://x/index.php/s/BBB222/download')
        self.assertIn('varios', nota)

    def test_patron_crudo_con_anio(self):
        enl = [('IMPORTACIONES ENE A SEP 2026p', 'http://x/a'), ('IMPORTACIONES 2025p', 'http://x/b'), ('IMPORTACIONES RITEX ENE A SEP 2026p', 'http://x/c')]
        f = {'patron_crudo': r'^IMPORTACIONES (ENE A [A-Z]{3,9} )?2026p?$'}
        self.assertEqual(im.elegir_enlace(f, enl)[0], 'http://x/a')
        f = {'patron_crudo': r'^IMPORTACIONES (ENE A [A-Z]{3,9} )?2025p?$'}
        self.assertEqual(im.elegir_enlace(f, enl)[0], 'http://x/b')


class PruebasLectores(unittest.TestCase):
    def test_leer_anio_mes(self):
        with tempfile.TemporaryDirectory() as d:
            ruta = Path(d) / 't.xlsx'
            planilla(ruta, tabla_cemento())
            filas, cat = im.leer_anio_mes(ruta, {'unidad': 'toneladas'})
        v = {(s, p): (x, pre) for s, p, x, pre in filas}
        self.assertEqual(sorted(cat), ['CHUQUISACA', 'COCHABAMBA', 'TOTAL'])
        self.assertEqual(v[('COCHABAMBA', '2025-01')], (200.0, False))
        self.assertEqual(v[('COCHABAMBA', '2025-02')], (210.0, False))      # número guardado como texto
        self.assertEqual(v[('TOTAL', '2025-03')], (315.0, False))           # fila con signo suelto
        self.assertEqual(v[('COCHABAMBA', '2026-01')], (230.0, True))       # año «2026 (p)»: preliminar
        self.assertEqual(v[('COCHABAMBA', '2026-02')], (240.0, True))
        self.assertNotIn(('TOTAL', '2025-00'), v)
        self.assertEqual(len([k for k in v if k[1].startswith('2025')]), 9)  # los totales anuales no entran

    def test_hoja_sin_cabecera_falla_con_mensaje(self):
        with tempfile.TemporaryDirectory() as d:
            ruta = Path(d) / 't.xlsx'
            planilla(ruta, [['nada'], ['de interés']])
            with self.assertRaises(ValueError) as e:
                im.leer_anio_mes(ruta, {})
        self.assertIn('PERIODO', str(e.exception))

    def test_leer_precios_materiales(self):
        filas = [[], [None, 'Precios'], [None, 'CÓDIGO', 'PRODUCTO', 'CANTIDAD', 'UNIDAD', 2025, None, 2026, None],
                 [None, None, None, None, None, 'Ene', 'Feb', 'Ene', 'Feb'],
                 [None, 3744001, 'Cemento portland IP-30', 50, 'kg', 47.0, 47.5, 48.0, None],
                 [None, 'nota', 'sin código']]
        with tempfile.TemporaryDirectory() as d:
            ruta = Path(d) / 'p.xlsx'
            planilla(ruta, filas)
            rows, cat = im.leer_precios_materiales(ruta, {})
        self.assertEqual(sorted((p, v) for s, p, v, _ in rows), [('2025-01', 47.0), ('2025-02', 47.5), ('2026-01', 48.0)])
        self.assertEqual(cat['3744001']['nombre'], 'Cemento portland IP-30')
        self.assertEqual(cat['3744001']['unidad'], 'kg')

    def test_codigo_repetido_conserva_las_dos_presentaciones(self):
        filas = [[], [None, 'Precios'], [None, 'CÓDIGO', 'PRODUCTO', 'CANTIDAD', 'UNIDAD', 2026, None], [None, None, None, None, None, 'Ene', 'Feb'],
                 [None, 4294404, 'Ganchos J', 12, 'Pieza(s)', 10.0, 11.0], [None, 4294404, 'Ganchos J', 100, 'Pieza(s)', 80.0, 85.0]]
        with tempfile.TemporaryDirectory() as d:
            ruta = Path(d) / 'p.xlsx'
            planilla(ruta, filas)
            rows, cat = im.leer_precios_materiales(ruta, {})
        v = {(s, p): x for s, p, x, _ in rows}
        self.assertEqual(v[('4294404', '2026-01')], 10.0)
        self.assertEqual(v[('4294404#2', '2026-01')], 80.0)
        self.assertEqual((cat['4294404']['cantidad'], cat['4294404#2']['cantidad']), (12, 100))

    def test_validar_archivo_rechaza_paginas_de_error(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'x.xlsx'
            p.write_bytes(b'<!DOCTYPE html><html><body>Archivo no encontrado</body></html>')
            self.assertEqual(im.tipo_archivo(p), 'html')
            with self.assertRaises(ValueError) as e:
                im.validar_archivo(p, 'xlsx')
            self.assertIn('página de error', str(e.exception))
            p.write_bytes(bytes_planilla([['a']]))
            im.validar_archivo(p, 'xlsx')


class PruebasFusion(unittest.TestCase):
    def test_nuevos_revisados_confirmados_y_ausentes(self):
        previo = {('A', '2026-01'): [10.0, True, 10.0, '2026-02-01'], ('A', '2026-02'): [20.0, True, 20.0, '2026-02-01'], ('B', '2026-01'): [5.0, False, 5.0, '2026-02-01']}
        filas = [('A', '2026-01', 10.0, False), ('A', '2026-02', 21.0, True), ('A', '2026-03', 30.0, True)]
        datos, res, revs = im.fusionar('f', previo, filas, '2026-03-15')
        self.assertEqual((res['nuevos'], res['revisados'], res['confirmados'], res['ausentes']), (1, 1, 1, 1))
        self.assertEqual(revs, [('2026-03-15', 'f', 'A', '2026-02', 20.0, 21.0)])
        self.assertEqual(datos[('A', '2026-02')], [21.0, True, 20.0, '2026-02-01'])    # conserva el valor inicial
        self.assertEqual(datos[('A', '2026-01')], [10.0, False, 10.0, '2026-02-01'])  # dejó de ser preliminar
        self.assertEqual(datos[('A', '2026-03')], [30.0, True, 30.0, '2026-03-15'])
        self.assertIn(('B', '2026-01'), datos)                                         # lo ausente se conserva

    def test_calidad(self):
        f = {'no_negativos': True}
        filas = [('S', '2026-%02d' % m, 100.0 + m, False) for m in range(1, 9)] + [('S', '2026-09', 900.0, False), ('T', '2026-01', -3.0, False)]
        err, av = im.revisar_calidad(f, {}, filas, {'ultimo_periodo': '2026-08'})
        self.assertEqual(err, [])
        self.assertTrue(any('negativos' in a for a in av))
        self.assertFalse(any('alejan' in a for a in av))  # en la primera carga no se avisa de todo el pasado
        base = {('S', '2026-%02d' % m): [100.0 + m, False, 100.0 + m, 'x'] for m in range(1, 9)}
        err, av = im.revisar_calidad(f, base, filas, {'ultimo_periodo': '2026-08'})
        self.assertTrue(any('alejan' in a for a in av))   # con base guardada, el 900 de septiembre llama la atención
        err, _ = im.revisar_calidad(f, {}, [('S', '2026-05', 1.0, False)], {'ultimo_periodo': '2026-08'})
        self.assertTrue(any('retrocedió' in e for e in err))
        err, _ = im.revisar_calidad(f, {}, [], {})
        self.assertTrue(err)


class PruebasDeExtremoAExtremo(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.srv = Servidor()
        self.reg = {'agente': 'prueba/1.0', 'espera_segundos': 0, 'fuentes': [
            {'id': 'cemento_consumo', 'titulo': 'Consumo de cemento', 'pagina': self.srv.url + '/pagina', 'patron': '^bolivia consumo de cemento por departamento',
             'url_fija': self.srv.url + '/viejo/download', 'formato': 'xlsx', 'lector': 'anio_mes', 'params': {'unidad': 't'}, 'rezago_max_meses': 3, 'no_negativos': True},
            {'id': 'ventas_rotas', 'titulo': 'Ventas', 'pagina': self.srv.url + '/pagina', 'patron': '^bolivia ventas de cemento',
             'url_fija': self.srv.url + '/index.php/s/BBB222/download', 'formato': 'xlsx', 'lector': 'anio_mes', 'params': {}},
            {'id': 'opcional', 'titulo': 'Opcional', 'pagina': self.srv.url + '/pagina', 'patron': '^no esta', 'formato': 'xlsx', 'lector': 'anio_mes', 'opcional': True},
        ]}
        self.srv.poner('/pagina', PAGINA.encode())
        self.srv.poner('/index.php/s/AAA111/download', bytes_planilla(tabla_cemento()),
                       **{'Content-Disposition': 'attachment; filename="3030106.xlsx"'})
        self.srv.poner('/index.php/s/BBB222/download', b'<html><body>Ya no existe</body></html>')

    def tearDown(self):
        self.srv.cerrar()
        self.tmp.cleanup()

    def correr(self, hoy='2026-04-20', **kw):
        return im.actualizar(self.dir / 'datos', self.dir / 'archivo', self.reg, hoy=dt.date.fromisoformat(hoy), espera=0, **kw)

    def test_flujo_completo(self):
        # 1) primera ejecución: lee la tabla, rechaza la página de error y avisa que lo opcional no está publicado
        res, informe = self.correr('2026-04-20')
        r = {x['id']: x for x in res}
        self.assertEqual(r['cemento_consumo']['estado'], 'actualizada')
        self.assertEqual(r['cemento_consumo']['nuevos'], 15)  # 3 series x 5 meses
        self.assertEqual(r['cemento_consumo']['ultimo_periodo'], '2026-02')
        self.assertEqual(r['ventas_rotas']['estado'], 'error')
        self.assertIn('página de error', r['ventas_rotas']['mensaje'])
        self.assertEqual(r['opcional']['estado'], 'sin_publicar')
        self.assertIn('ERROR', informe)
        resumen = json.loads((self.dir / 'datos' / 'ultimo_resumen.json').read_text())
        self.assertEqual((resumen['con_datos_nuevos'], resumen['errores'], resumen['sin_publicar']), (['cemento_consumo'], ['ventas_rotas'], ['opcional']))
        estado = json.loads((self.dir / 'datos' / 'estado.json').read_text())
        self.assertNotIn('ventas_rotas', estado['fuentes'])             # un fallo no deja huella
        self.assertTrue(list((self.dir / 'archivo' / 'cemento_consumo').glob('2026-04-20_*.xlsx')))
        # el enlace se descubrió en la página, no se usó el 'viejo'
        self.assertEqual(estado['fuentes']['cemento_consumo']['url'], self.srv.url + '/index.php/s/AAA111/download')
        self.assertNotIn('/viejo/download', self.srv.pedidos)

        # 2) segunda ejecución sin cambios: no vuelve a leer ni a fusionar
        res, _ = self.correr('2026-04-21')
        self.assertEqual({x['id']: x['estado'] for x in res}['cemento_consumo'], 'sin_cambios')

        # 3) el INE agrega marzo de 2026 y corrige enero de 2025
        self.srv.poner('/index.php/s/AAA111/download', bytes_planilla(tabla_cemento(extra_meses=[('Marzo', (90, 250, 340))], cochabamba_enero=205)))
        res, informe = self.correr('2026-05-20')
        r = {x['id']: x for x in res}['cemento_consumo']
        self.assertEqual((r['estado'], r['nuevos'], r['revisados']), ('actualizada', 3, 1))
        revs = list(csv.DictReader((self.dir / 'datos' / 'revisiones.csv').read_text().splitlines()))
        self.assertEqual(len(revs), 1)
        self.assertEqual((revs[0]['serie'], revs[0]['periodo'], revs[0]['anterior'], revs[0]['nuevo']), ('COCHABAMBA', '2025-01', '200.0', '205.0'))
        self.assertIn('Correcciones', informe)
        filas = {(f['serie'], f['periodo']): f for f in csv.DictReader((self.dir / 'datos' / 'series' / 'cemento_consumo.csv').read_text().splitlines())}
        self.assertEqual(filas[('COCHABAMBA', '2025-01')]['valor_inicial'], '200.0')  # recuerda lo primero que publicó el INE
        self.assertEqual(filas[('COCHABAMBA', '2025-01')]['valor'], '205.0')

    def test_el_enlace_se_sigue_si_el_ine_lo_cambia(self):
        self.correr('2026-04-20')
        # el INE publica el archivo con otra clave y otro año en el título
        pagina = PAGINA.replace('AAA111', 'ZZZ999').replace('2000 – 2026', '2000 – 2027')
        self.srv.poner('/pagina', pagina.encode())
        self.srv.poner('/index.php/s/ZZZ999/download', bytes_planilla(tabla_cemento(extra_meses=[('Marzo', (90, 250, 340))])))
        res, _ = self.correr('2026-05-20')
        r = {x['id']: x for x in res}['cemento_consumo']
        self.assertEqual(r['estado'], 'actualizada')
        estado = json.loads((self.dir / 'datos' / 'estado.json').read_text())
        self.assertTrue(estado['fuentes']['cemento_consumo']['url'].endswith('/ZZZ999/download'))

    def test_si_la_pagina_falla_se_usa_el_ultimo_enlace(self):
        self.correr('2026-04-20')
        self.srv.poner('/pagina', b'caida', estado=500)
        res, _ = self.correr('2026-04-21')
        r = {x['id']: x for x in res}['cemento_consumo']
        self.assertEqual(r['estado'], 'sin_cambios')
        self.assertTrue(any('guardado' in a for a in r['avisos']))

    def test_marca_atrasada_aunque_no_haya_cambios(self):
        self.correr('2026-04-20')
        res, informe = self.correr('2026-09-20')  # el último período es feb-2026: 7 meses
        r = {x['id']: x for x in res}['cemento_consumo']
        self.assertEqual(r['estado'], 'sin_cambios')
        self.assertTrue(r['atrasada'])
        self.assertIn('atrasada', informe)

    def test_la_planilla_rota_no_pisa_los_datos(self):
        self.correr('2026-04-20')
        antes = (self.dir / 'datos' / 'series' / 'cemento_consumo.csv').read_text()
        # llega una planilla válida pero que retrocede (termina en 2025)
        self.srv.poner('/index.php/s/AAA111/download', bytes_planilla(tabla_cemento()[:9]))
        res, _ = self.correr('2026-05-20')
        r = {x['id']: x for x in res}['cemento_consumo']
        self.assertEqual(r['estado'], 'error')
        self.assertIn('retrocedió', r['mensaje'])
        self.assertEqual((self.dir / 'datos' / 'series' / 'cemento_consumo.csv').read_text(), antes)

    def test_si_cambia_el_formato_avisa_y_no_guarda_la_huella(self):
        # una planilla válida pero sin la cabecera conocida: el INE rediseñó la tabla
        self.srv.poner('/index.php/s/AAA111/download', bytes_planilla([['otra', 'cosa'], [1, 2]]))
        res, _ = self.correr('2026-04-20')
        r = {x['id']: x for x in res}['cemento_consumo']
        self.assertEqual(r['estado'], 'error')
        self.assertIn('cambió su formato', r['mensaje'])
        self.assertNotIn('cemento_consumo', json.loads((self.dir / 'datos' / 'estado.json').read_text())['fuentes'])
        self.assertTrue(list((self.dir / 'archivo' / 'cemento_consumo').glob('*.xlsx')))  # la copia queda para revisarla
        # cuando el INE vuelve a publicar una tabla legible, se recupera sola
        self.srv.poner('/index.php/s/AAA111/download', bytes_planilla(tabla_cemento()))
        res, _ = self.correr('2026-04-21')
        self.assertEqual({x['id']: x for x in res}['cemento_consumo']['estado'], 'actualizada')

    def test_exportar_json_de_cemento(self):
        self.correr('2026-04-20')
        d = self.dir / 'salida'
        self.assertIn('cemento_ine.json', im.exportar(self.dir / 'datos', d))
        # el exportador pide 2024 en adelante y la tabla de prueba trae 2025 y 2026
        j = json.loads((d / 'cemento_ine.json').read_text())
        self.assertEqual(j['cem']['2026-02'], {'cbba': 240.0, 'nac': 328.0})  # solo tiene las series que existen


if __name__ == '__main__':
    unittest.main()

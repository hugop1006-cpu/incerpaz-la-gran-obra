/* Prueba de las pruebas de confianza (obras, testimonios, certificaciones y año de inicio).
   Genera el sitio en una carpeta temporal con datos de prueba y revisa el HTML. No usa navegador.
   Uso: node tools/probar-confianza.js */
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const RAIZ = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'incerpaz-cf-'));
let fallos = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) fallos++; };

function generar(nombre, confianza) {
  const datos = path.join(TMP, nombre + '-datos'), salida = path.join(TMP, nombre + '-sitio');
  fs.mkdirSync(datos, { recursive: true });
  for (const f of fs.readdirSync(path.join(RAIZ, 'site-src/data'))) fs.copyFileSync(path.join(RAIZ, 'site-src/data', f), path.join(datos, f));
  if (confianza) fs.writeFileSync(path.join(datos, 'confianza.json'), JSON.stringify(confianza));
  execFileSync('node', [path.join(RAIZ, 'site-src/build.js')], { env: Object.assign({}, process.env, { CONTENT_DIR: datos, SITE_OUT: salida, CATALOGO_OUT: path.join(TMP, nombre + '-catalogo.json') }), stdio: 'ignore' });
  return (f) => fs.readFileSync(path.join(salida, f), 'utf8');
}

/* 1) con las listas vacías (como está hoy) no aparece ninguna sección ni dato inventado */
const vacio = generar('vacio', null);
const hv = vacio('index.html');
ok(!/id="obras"|id="testimonios"|id="certificaciones"/.test(hv) && !/id="obras"/.test(vacio('pavic.html')), 'con los datos vacíos no se muestra ninguna sección de pruebas');
ok(!/Desde \d{4}/.test(hv), 'sin año de inicio confirmado no se muestra «Desde»');

/* 2) con datos de prueba aparecen; los testimonios sin autorización escrita no salen */
const lleno = generar('lleno', {
  desde: 1990,
  certificaciones: [{ nombre: 'Certificado de prueba', detalle: 'Vigente hasta 2030', archivo: 'documentos/prueba.pdf' }],
  obras: [
    { titulo: 'Obra de prueba general', ciudad: 'Cochabamba', anio: 2025, superficie_m2: 1200, imagen: 'assets/img/productos/pavic-estandar-2.jpg' },
    { titulo: 'Plaza de prueba PAVIC', ciudad: 'Santa Cruz', anio: 2026, imagen: 'assets/img/productos/pavic-tabaco-2.jpg', pavic: true },
    { titulo: 'Obra sin foto', ciudad: 'Oruro' }
  ],
  testimonios: [
    { nombre: 'Ana Prueba', empresa: 'Constructora Ejemplo', ciudad: 'Sucre', texto: 'Texto autorizado de prueba.', autorizacion_escrita: true },
    { nombre: 'Luis Sin Permiso', texto: 'Texto sin autorización.', autorizacion_escrita: false },
    { nombre: 'Rosa Sin Campo', texto: 'Texto sin el campo de autorización.' }
  ]
});
const hl = lleno('index.html'), pl = lleno('pavic.html');
ok(/id="obras"/.test(hl) && /Obra de prueba general/.test(hl) && /Plaza de prueba PAVIC/.test(hl), 'las obras con foto aparecen en el inicio');
ok(!/Obra sin foto/.test(hl), 'una obra sin foto no se muestra');
ok(/Texto autorizado de prueba/.test(hl) && !/Texto sin autorización/.test(hl) && !/Texto sin el campo/.test(hl), 'solo se publican los testimonios con autorización escrita');
ok(/Certificado de prueba/.test(hl) && /documentos\/prueba\.pdf/.test(hl), 'las certificaciones se muestran con su archivo');
ok(/Desde 1990/.test(hl), 'el año de inicio confirmado aparece en la franja de confianza');
ok(/id="obras"/.test(pl) && /Plaza de prueba PAVIC/.test(pl) && !/Obra de prueba general/.test(pl), 'PAVIC muestra solo sus obras de referencia');

fs.rmSync(TMP, { recursive: true, force: true });
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);

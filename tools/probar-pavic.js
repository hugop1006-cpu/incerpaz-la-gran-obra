/* Prueba de los recursos técnicos PAVIC con un navegador real.
   Uso: node tools/probar-pavic.js */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const PUERTO = process.env.PUERTO || '8093';
const BASE = `http://127.0.0.1:${PUERTO}/`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'incerpaz-pv-'));
const ENTORNO = Object.assign({}, process.env, { DB_PATH: path.join(TMP, 'p.db'), CONTENT_DIR: path.join(TMP, 'c'), PORT: PUERTO, ADMIN_PASSWORD: 'admin-clave-123' });
let fallos = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) fallos++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const digitos = (s) => String(s).replace(/\D/g, '');
const fila = (p, t) => p.locator('#pv-resultado tbody tr', { hasText: t }).first().locator('td.num b');

(async () => {
  const srv = spawn('node', [path.join(__dirname, '..', 'server', 'index.js')], { env: ENTORNO, stdio: 'ignore' });
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + 'api/salud')).ok) break; } catch { /* aún no */ } await espera(200); }
    const b = await chromium.launch();
    const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })).newPage();
    const errores = []; p.on('pageerror', (e) => errores.push(e.message));

    await p.goto(BASE + 'pavic.html'); ok((await p.locator('a[href="pavic-recursos.html"]').count()) >= 1, 'la página PAVIC enlaza a los recursos');
    await p.goto(BASE + 'pavic-recursos.html'); await p.waitForSelector('#pv-resultado table');
    ok(/132,5/.test(await p.textContent('#pv-ficha')), 'la ficha muestra el peso por m² (50 piezas × 2,65 kg = 132,5)');
    ok(digitos(await fila(p, 'Piezas').textContent()) === '52500', '1.000 m² con 5 % de merma: 52.500 piezas');
    ok(/139,1/.test(await fila(p, 'Peso').textContent()), 'peso de la cerámica: 139,1 toneladas');
    ok(digitos(await fila(p, 'Base granular').textContent()) === '1500', 'base granular de 15 cm: 150,0 m³');
    await p.fill('#pv-area', '2000');
    ok(digitos(await fila(p, 'Piezas').textContent()) === '105000', 'al cambiar la superficie se recalcula');
    ok((await p.locator('#pv-seccion svg rect').count()) === 4, 'la sección muestra las 4 capas');
    ok(/PAVIC ESTÁNDAR/.test(await p.inputValue('#pv-pliego')) && /20,0/.test(await p.inputValue('#pv-pliego')), 'el texto para pliegos usa los datos de la ficha');
    await p.selectOption('#pv-ciudad', 'santa-cruz');
    ok((await p.locator('#pv-pieza option').count()) >= 2, 'Santa Cruz ofrece sus propias piezas (con medidas propias)');
    ok(/6,5/.test(await p.textContent('#pv-ficha')), 'la ficha de Santa Cruz muestra su alto de 6,5 cm');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#pv-dxf')]);
    const dxf = fs.readFileSync(await dl.path(), 'utf8');
    ok(/LINE/.test(dxf) && /EOF/.test(dxf) && /\.dxf$/.test(dl.suggestedFilename()), 'se descarga un DXF con la pieza');
    const [dc] = await Promise.all([p.waitForEvent('download'), p.click('#pv-csv')]);
    ok(/Piezas/.test(fs.readFileSync(await dc.path(), 'utf8')), 'se descarga el cuadro de cantidades en CSV');
    await p.click('[data-doc="Ensayos de laboratorio"]'); await espera(300);
    ok((await p.inputValue('#pv-docsel')) === 'Ensayos de laboratorio', 'el botón Solicitar preselecciona el documento en el formulario');
    await p.click('#pv-add'); await p.waitForFunction(() => document.querySelector('[data-bcount]').textContent === '1');
    ok(true, 'añadir al presupuesto suma la pieza');

    await p.setViewportSize({ width: 390, height: 800 }); await p.goto(BASE + 'pavic-recursos.html'); await p.waitForSelector('#pv-resultado table');
    ok((await p.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'la página no se desborda en celular');
    ok(errores.length === 0, 'sin errores de JavaScript' + (errores.length ? ': ' + errores[0] : ''));
    await b.close();
  } finally {
    srv.kill();
    const limpio = Object.assign({}, process.env); delete limpio.CONTENT_DIR;
    execFileSync('node', [path.join(__dirname, '..', 'site-src', 'build.js')], { env: limpio, stdio: 'ignore' });
  }
  console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

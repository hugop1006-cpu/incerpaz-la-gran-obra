/* Prueba de los proyectos (materiales, costos, esquema y presupuesto) con un navegador real.
   Uso: node tools/probar-proyectos.js */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const PUERTO = process.env.PUERTO || '8096';
const BASE = `http://127.0.0.1:${PUERTO}/`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'incerpaz-proy-'));
const ENTORNO = Object.assign({}, process.env, { DB_PATH: path.join(TMP, 'p.db'), CONTENT_DIR: path.join(TMP, 'c'), PORT: PUERTO, ADMIN_PASSWORD: 'admin-clave-123' });
let fallos = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) fallos++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const celda = (p, nombre) => p.locator('tbody tr', { hasText: nombre }).first().locator('td.num b');

(async () => {
  const srv = spawn('node', [path.join(__dirname, '..', 'server', 'index.js')], { env: ENTORNO, stdio: 'ignore' });
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + 'api/salud')).ok) break; } catch { /* aún no */ } await espera(200); }
    const b = await chromium.launch();
    const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    const errores = []; p.on('pageerror', (e) => errores.push(e.message));

    await p.goto(BASE + 'proyectos.html');
    ok((await p.locator('.proys a.cat').count()) === 3, 'el listado muestra los 3 proyectos');
    await p.goto(BASE + 'proyectos/churrasquero.html'); await p.waitForSelector('#proy-lista table');
    ok((await p.locator('#proy-plano svg').count()) === 1, 'se dibuja el esquema');
    ok((await celda(p, 'Muros de la base').textContent()).replace(/\D/g, '') === '234', 'muros: 234 piezas de brick estándar con las medidas por defecto');
    ok((await celda(p, 'Revestimiento refractario').textContent()).replace(/\D/g, '') === '62', 'hogar: 62 piezas de biscocho');
    ok(/Ingresa/.test(await p.textContent('#proy-lista')), 'sin sesión no se muestra el costo');
    await p.fill('[data-par="ancho"]', '2');
    ok((await celda(p, 'Muros de la base').textContent()).replace(/\D/g, '') !== '234', 'al cambiar el ancho se recalcula');
    await p.selectOption('#citySel', 'santa-cruz'); await p.waitForSelector('text=No está en el catálogo de Santa Cruz');
    ok(true, 'en Santa Cruz avisa lo que no está en su catálogo');
    await p.selectOption('#citySel', 'cochabamba');

    await p.goto(BASE + 'proyectos/pared-con-enchape.html'); await p.waitForSelector('#proy-lista table');
    ok((await celda(p, 'Ladrillo de enchape').textContent()).replace(/\D/g, '') === '803', 'pared de 4 × 2,4 m con enchape corto: 803 piezas');
    await p.fill('[data-par="vanos"]', '2'); 
    ok((await celda(p, 'Ladrillo de enchape').textContent()).replace(/\D/g, '') === '636', 'descontar 2 m² de vanos baja a 636 piezas');
    await p.selectOption('#citySel', 'santa-cruz');
    ok((await celda(p, 'Ladrillo de enchape').textContent()).replace(/\D/g, '') !== '', 'Santa Cruz también calcula el enchape');
    await p.selectOption('#citySel', 'cochabamba');

    execFileSync('node', [path.join(__dirname, '..', 'server', 'crear-admin.js'), 'equipo@incerpaz.test', 'equipo-clave-1', 'Equipo Prueba', 'cochabamba', 'admin'], { env: ENTORNO, stdio: 'ignore' });
    await p.goto(BASE + 'ingresar.html?volver=proyectos/meson-con-enchape.html'); await p.fill('[name="correo"]', 'equipo@incerpaz.test'); await p.fill('[name="password"]', 'equipo-clave-1');
    await p.click('#form-ingreso button[type="submit"]'); await p.waitForURL('**/meson-con-enchape.html'); await p.waitForSelector('#proy-lista th:has-text("Subtotal")');
    ok(/Total de la cerámica/.test(await p.textContent('#proy-lista')), 'con cuenta verificada se ve el costo y el total');
    await p.click('#proy-add'); await p.waitForFunction(() => document.querySelector('[data-bcount]').textContent === '2');
    ok(true, 'añadir al presupuesto suma los productos de INCERPAZ');

    await p.setViewportSize({ width: 390, height: 800 }); await p.goto(BASE + 'proyectos/churrasquero.html'); await p.waitForSelector('#proy-lista table');
    ok((await p.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'el proyecto no se desborda en celular');
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

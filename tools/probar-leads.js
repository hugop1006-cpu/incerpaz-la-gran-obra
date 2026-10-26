/* Prueba de punta a punta de las guías, exportaciones y la bandeja de contactos (leads).
   Uso: node tools/probar-leads.js */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const PUERTO = process.env.PUERTO || '8091';
const BASE = `http://127.0.0.1:${PUERTO}/`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'incerpaz-ld-'));
const ENTORNO = Object.assign({}, process.env, { DB_PATH: path.join(TMP, 'p.db'), CONTENT_DIR: path.join(TMP, 'c'), PORT: PUERTO, ADMIN_PASSWORD: 'admin-clave-123' });
let fallos = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) fallos++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const srv = spawn('node', [path.join(__dirname, '..', 'server', 'index.js')], { env: ENTORNO, stdio: 'ignore' });
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + 'api/salud')).ok) break; } catch { /* aún no */ } await espera(200); }
    const b = await chromium.launch();
    const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    const adm = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    const errores = []; [p, adm].forEach((x) => x.on('pageerror', (e) => errores.push(e.message)));
    let abiertas = 0; p.context().on('page', () => { abiertas++; });

    await p.goto(BASE + 'guias.html'); ok((await p.locator('.proys a.cat').count()) === 5, 'el listado muestra las 5 guías');
    await p.goto(BASE + 'guias/cuantos-ladrillos-por-metro-cuadrado.html');
    ok(/497/.test(await p.textContent('article')), 'la guía trae el ejemplo calculado (497 piezas)');
    ok((await p.locator('script[type="application/ld+json"]').count()) >= 2 && !/@context/.test((await p.textContent('main')) || ''), 'el marcado para Google no se muestra como texto');
    await p.fill('.form-box [name="nombre"]', 'Luis Rojas'); await p.fill('.form-box [name="celular"]', '70011122'); await p.selectOption('.form-box [name="ciudad"]', 'Santa Cruz');
    await p.fill('.form-box [name="consulta"]', 'Necesito 500 ladrillos'); await p.click('.form-box button[type="submit"]');
    await p.waitForSelector('.form-msg:not([hidden])');
    ok(/Recibimos tu solicitud/.test(await p.textContent('.form-msg')) && abiertas === 0, 'la consulta se envía al servidor sin abrir WhatsApp');

    await p.goto(BASE + 'exportaciones.html');
    await p.fill('.form-box [name="nombre"]', 'John Smith'); await p.fill('.form-box [name="empresa"]', 'Importer LLC'); await p.fill('.form-box [name="correo"]', 'john@importer.com');
    await p.fill('.form-box [name="pais"]', 'Perú'); await p.fill('.form-box [name="volumen"]', '2 contenedores'); await p.click('.form-box button[type="submit"]'); await p.waitForSelector('.form-msg:not([hidden])');
    ok(/Recibimos/.test(await p.textContent('.form-msg')), 'la consulta de exportación se envía');

    await p.goto(BASE + 'donde-estamos.html'); await p.click('[data-city-tab="otra-ciudad"]');
    await p.fill('[data-lead^="Lista de espera"] [name="nombre"]', 'Ana Tarija'); await p.fill('[data-lead^="Lista de espera"] [name="celular"]', '70055566'); await p.fill('[data-lead^="Lista de espera"] [name="ciudad_otra"]', 'Tarija');
    await p.click('[data-lead^="Lista de espera"] button[type="submit"]'); await p.waitForSelector('.form-msg:not([hidden])');
    ok(/avisaremos/.test(await p.textContent('.form-msg')), 'la lista de espera de Tarija se guarda');

    await adm.goto(BASE + 'ingresar.html?volver=equipo.html'); await adm.fill('[name="correo"]', 'hugop1006@gmail.com'); await adm.fill('[name="password"]', 'admin-clave-123');
    await adm.click('#form-ingreso button[type="submit"]'); await adm.waitForURL('**/equipo.html'); await adm.waitForSelector('#lead-nuevos:has-text("3 nuevos")');
    ok(true, 'el panel avisa que hay 3 contactos nuevos');
    await adm.click('[data-tab="leads"]'); await adm.waitForSelector('[data-lead-estado]');
    ok((await adm.locator('[data-lead-estado]').count()) === 3, 'la bandeja lista los 3 contactos');
    ok(/Perú/.test(await adm.textContent('#panel')) && /Tarija/.test(await adm.textContent('#panel')), 'se ven los datos extra (país, ciudad pedida)');
    await adm.locator('[data-lead-estado]').first().selectOption('contactado'); await adm.waitForSelector('#toast.on');
    await adm.fill('[data-lead-nota]', 'Llamado el lunes'); await adm.locator('[data-lead-nota]').first().blur();
    await adm.selectOption('#lead-estado', 'contactado'); await adm.waitForFunction(() => document.querySelectorAll('[data-lead-estado]').length === 1);
    ok(true, 'cambiar estado y filtrar por estado funciona');
    ok(/leads\.csv/.test(await adm.getAttribute('a:has-text("Descargar CSV")', 'href')), 'hay descarga en CSV');

    await p.setViewportSize({ width: 390, height: 800 });
    for (const u of ['guias/como-colocar-enchape-de-ladrillo.html', 'exportaciones.html', 'guias.html']) {
      await p.goto(BASE + u); ok((await p.evaluate(() => document.documentElement.scrollWidth)) <= 390, `${u} no se desborda en celular`);
    }
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

/* Prueba de punta a punta del panel de administración con un navegador real.
   Levanta el servidor con base de datos y contenido temporales, edita desde el panel y comprueba que las páginas
   públicas cambian. Al terminar vuelve a generar el sitio con el contenido original.
   Uso: node tools/probar-admin.js */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const PUERTO = process.env.PUERTO || '8098';
const BASE = `http://127.0.0.1:${PUERTO}/`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'incerpaz-adm-'));
const ENTORNO = Object.assign({}, process.env, { DB_PATH: path.join(TMP, 'p.db'), CONTENT_DIR: path.join(TMP, 'contenido'), PORT: PUERTO, ADMIN_PASSWORD: 'admin-clave-123', SEMBRAR_DEMO: '1' });
let fallos = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) fallos++; };
/* espera el aviso nuevo (primero deja que desaparezca el anterior) */
let pagAviso; const aviso = async (accion, texto) => { await pagAviso.waitForSelector('#toast:not(.on)', { state: 'attached' }).catch(() => {}); await accion(); await pagAviso.waitForFunction((t) => { const e = document.getElementById('toast'); return e && e.classList.contains('on') && e.textContent.indexOf(t) >= 0; }, texto); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const srv = spawn('node', [path.join(__dirname, '..', 'server', 'index.js')], { env: ENTORNO, stdio: 'ignore' });
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + 'api/salud')).ok) break; } catch { /* aún no */ } await espera(200); }
    const b = await chromium.launch();
    const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    const ej = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    const errores = []; [p, ej].forEach((x) => x.on('pageerror', (e) => errores.push(e.message)));
    p.on('dialog', (d) => d.accept()); pagAviso = p;

    await ej.goto(BASE + 'ingresar.html'); await ej.fill('[name="correo"]', 'ejecutivo.prueba@incerpaz.test'); await ej.fill('[name="password"]', 'Prueba-Incerpaz-2026');
    await ej.click('#form-ingreso button[type="submit"]'); await ej.waitForURL('**/equipo.html');
    await ej.goto(BASE + 'admin.html'); await ej.waitForSelector('text=solo para administradores');
    ok(true, 'la cuenta de prueba (ejecutivo) no accede al panel de contenido');

    await p.goto(BASE + 'admin.html'); await p.waitForSelector('text=Ingresa con tu cuenta');
    await p.goto(BASE + 'ingresar.html?volver=admin.html'); await p.fill('[name="correo"]', 'hugop1006@gmail.com'); await p.fill('[name="password"]', 'admin-clave-123');
    await p.click('#form-ingreso button[type="submit"]'); await p.waitForURL('**/admin.html'); await p.waitForSelector('table.tabla');
    ok((await p.locator('tbody tr').count()) === 32, 'el panel lista los 32 productos de Cochabamba');

    await p.click('[data-edit="18-h"]'); await p.fill('[name="titulo"]', '18 HUECOS PRUEBA'); await p.fill('[name="rendimiento"]', '46 Pzas/m2');
    await p.click('#f button[type=submit]'); await p.waitForSelector('table.tabla');
    const pagina = await (await fetch(BASE + 'productos/cochabamba/18-h.html')).text();
    ok(/18 huecos prueba/i.test(pagina), 'el cambio de nombre se publica en la ficha');

    await p.click('[data-tab="precios"]'); await p.waitForSelector('input[data-slug="18-h"]');
    await p.fill('input[data-slug="18-h"][data-lista="general"]', '7.25'); await p.fill('#nota', 'Nota de prueba E2E');
    await aviso(() => p.click('#guardar'), '1 cambios guardados');
    ok(true, 'los precios se guardan');

    await p.click('[data-tab="agencias"]'); await p.waitForSelector('[data-wa-ciudad="sucre"]');
    await p.fill('[data-wa-ciudad="sucre"]', '71234567');
    await p.click('[data-add="oruro"]');
    const t = p.locator('[data-lista="oruro"] [data-ag]').last();
    await t.locator('[name="nombre"]').fill('Agencia Prueba'); await t.locator('[name="direccion"]').fill('Av. Prueba 100'); await t.locator('[name="telefonos"]').fill('2-5230000');
    await aviso(() => p.click('#guardar'), 'Cambios publicados');
    const donde = await (await fetch(BASE + 'donde-estamos.html')).text();
    const cfg = await (await fetch(BASE + 'assets/js/config.js')).text();
    ok(donde.includes('Agencia Prueba') && cfg.includes('71234567'), 'la agencia nueva y el WhatsApp aparecen en Dónde estamos');

    await p.click('[data-tab="agencias"]'); await p.waitForSelector('[data-del="oruro:2"], [data-lista="oruro"] [data-del]');
    await p.locator('[data-lista="oruro"] [data-del]').last().click(); await aviso(() => p.click('#guardar'), 'Cambios publicados');
    ok(!(await (await fetch(BASE + 'donde-estamos.html')).text()).includes('Agencia Prueba'), 'quitar la agencia la saca del sitio');

    await p.setViewportSize({ width: 390, height: 800 }); await p.click('[data-tab="productos"]'); await p.waitForSelector('table.tabla');
    ok((await p.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'el panel no desborda la página en celular');
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

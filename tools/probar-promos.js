/* Prueba de punta a punta de promociones y combos con un navegador real:
   un ejecutivo crea un combo (producto del catálogo + productos ajenos) y lo envía a revisión, el administrador lo publica,
   el visitante lo ve en su ciudad, el cliente ve el precio, lo añade al presupuesto y hace el pedido.
   Uso: node tools/probar-promos.js */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const PUERTO = process.env.PUERTO || '8087';
const BASE = `http://127.0.0.1:${PUERTO}/`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'incerpaz-promo-'));
const ENTORNO = Object.assign({}, process.env, { DB_PATH: path.join(TMP, 'p.db'), CONTENT_DIR: path.join(TMP, 'c'), PORT: PUERTO, ADMIN_PASSWORD: 'admin-clave-123', SEMBRAR_DEMO: '1' });
let fallos = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) fallos++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoy = new Date(), fin = new Date(hoy.getTime() + 10 * 86400000), ayer = new Date(hoy.getTime() - 3 * 86400000), antes = new Date(hoy.getTime() - 20 * 86400000);

async function ingresar(p, correo, clave, volver) {
  await p.goto(BASE + 'ingresar.html' + (volver ? `?volver=${volver}` : '')); await p.fill('[name="correo"]', correo); await p.fill('[name="password"]', clave);
  await p.click('#form-ingreso button[type="submit"]');
}
async function avisoNuevo(p, accion, texto) {
  await p.waitForSelector('#toast:not(.on)', { state: 'attached' }).catch(() => {}); await accion();
  await p.waitForFunction((t) => { const e = document.getElementById('toast'); return e && e.classList.contains('on') && e.textContent.indexOf(t) >= 0; }, texto);
}

(async () => {
  const srv = spawn('node', [path.join(__dirname, '..', 'server', 'index.js')], { env: ENTORNO, stdio: process.env.VER_SERVIDOR ? 'inherit' : 'ignore' });
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + 'api/salud')).ok) break; } catch { /* aún no */ } await espera(200); }
    const b = await chromium.launch();
    const nuevo = async (w = 1280) => (await b.newContext({ viewport: { width: w, height: 900 } })).newPage();
    const ej = await nuevo(), adm = await nuevo(), vis = await nuevo();
    const errores = []; [ej, adm, vis].forEach((x) => { x.on('pageerror', (e) => errores.push(e.message)); x.on('dialog', (d) => d.accept()); });

    /* 1. el ejecutivo crea un combo con productos del catálogo y otros que no lo son */
    await ingresar(ej, 'ejecutivo.prueba@incerpaz.test', 'Prueba-Incerpaz-2026', 'admin.html'); await ej.waitForURL('**/admin.html'); await ej.waitForSelector('#nuevo-promo');
    ok((await ej.locator('[data-tab]').count()) === 1, 'el ejecutivo solo ve la pestaña de promociones de su ciudad');
    await ej.click('#nuevo-promo');
    await ej.fill('[name="titulo"]', 'Combo cocina de prueba'); await ej.fill('[name="id"]', 'combo-cocina-prueba'); await ej.fill('[name="descripcion"]', 'Ladrillo con ollas y cubiertos');
    await ej.fill('[name="inicio"]', iso(hoy)); await ej.fill('[name="fin"]', iso(fin));
    await ej.selectOption('[data-comp="0"] [data-c="slug"]', 'brick-estandar'); await ej.fill('[data-comp="0"] [data-c="cantidad"]', '200');
    await ej.click('#add-comp'); await ej.selectOption('[data-comp="1"] [data-c="tipo"]', 'otro'); await ej.fill('[data-comp="1"] [data-c="nombre"]', 'Olla de aluminio'); await ej.fill('[data-comp="1"] [data-c="cantidad"]', '2');
    await ej.click('#add-comp'); await ej.selectOption('[data-comp="2"] [data-c="tipo"]', 'otro'); await ej.fill('[data-comp="2"] [data-c="nombre"]', 'Juego de cubiertos'); await ej.fill('[data-comp="2"] [data-c="cantidad"]', '1'); await ej.fill('[data-comp="2"] [data-c="nota"]', '24 piezas');
    await ej.fill('[name="precio_general"]', '1500');
    ok((await ej.locator('[name="estado"] option').count()) === 2, 'el ejecutivo solo puede dejar en borrador o enviar a revisión');
    await ej.selectOption('[name="estado"]', 'revision');
    await avisoNuevo(ej, () => ej.click('#f button[type=submit]'), 'Enviado a revisión');
    await ej.waitForSelector('.tabla');
    ok(/En revisión/.test(await ej.textContent('.tabla')), 'el combo queda en revisión');
    ok((await fetch(BASE + 'combos/cochabamba/combo-cocina-prueba.html')).status === 404, 'en revisión todavía no está en el sitio');

    /* 2. el administrador lo revisa y lo publica */
    await ingresar(adm, 'hugop1006@gmail.com', 'admin-clave-123', 'admin.html'); await adm.waitForURL('**/admin.html'); await adm.waitForSelector('[data-tab="promos"]'); await adm.click('[data-tab="promos"]'); await adm.waitForSelector('[data-edit-promo="combo-cocina-prueba"]');
    ok(/esperan tu revisión/.test(await adm.textContent('#vista')), 'el administrador ve cuántos esperan revisión');
    await adm.click('[data-edit-promo="combo-cocina-prueba"]'); await adm.selectOption('[name="estado"]', 'publicada');
    await avisoNuevo(adm, () => adm.click('#f button[type=submit]'), 'Publicado en el sitio');
    ok((await fetch(BASE + 'combos/cochabamba/combo-cocina-prueba.html')).status === 200, 'publicado: la página del combo existe');

    /* 3. el visitante ve el combo en su ciudad y no en otra */
    await vis.goto(BASE + 'catalogo.html?ciudad=cochabamba'); await vis.waitForSelector('.pcard:not([hidden])');
    await vis.click('[data-cat="combos"]');
    ok((await vis.locator('.pcard--combo:not([hidden])', { hasText: 'Combo cocina de prueba' }).count()) === 1, 'el catálogo muestra el combo con su filtro "Combos del mes"');
    await vis.selectOption('#citySel', 'santa-cruz');
    await vis.goto(BASE + 'promociones.html'); await vis.selectOption('#citySel', 'santa-cruz');
    ok((await vis.locator('.promo-card:not([hidden])', { hasText: 'Combo cocina de prueba' }).count()) === 0, 'en Santa Cruz no aparece un combo que es solo de Cochabamba');
    await vis.selectOption('#citySel', 'cochabamba');
    ok((await vis.locator('.promo-card:not([hidden])', { hasText: 'Combo cocina de prueba' }).count()) === 1, 'en Cochabamba sí aparece');
    await vis.click('button[data-grupo="concursos"]');
    ok((await vis.locator('.promo-card:not([hidden])', { hasText: 'Combo cocina de prueba' }).count()) === 0, 'el filtro por tipo oculta lo que no corresponde');
    await vis.click('button[data-grupo="combos"]');
    await vis.goto(BASE + 'index.html'); await vis.waitForSelector('#promos-home:not([hidden])');
    ok(/Combo cocina de prueba/.test(await vis.textContent('#promos-home-lista')), 'el inicio muestra las promociones vigentes de la ciudad');

    await vis.goto(BASE + 'combos/cochabamba/combo-cocina-prueba.html');
    const tabla = await vis.textContent('.tabla');
    ok(/Olla de aluminio/.test(tabla) && /Juego de cubiertos/.test(tabla) && /Producto INCERPAZ/.test(tabla) && /Incluido en el combo/.test(tabla), 'la ficha lista productos del catálogo y productos ajenos');
    ok(/Vigente hasta/.test(await vis.textContent('#promo-estado')), 'la ficha indica la vigencia');
    ok(!/1\.?500/.test(await vis.content()), 'el precio no está escrito en el HTML público');

    /* 4. precio, presupuesto y pedido con una cuenta verificada */
    await ingresar(vis, 'hugop1006@gmail.com', 'admin-clave-123', 'combos/cochabamba/combo-cocina-prueba.html'); await vis.waitForURL('**/combo-cocina-prueba.html');
    await vis.waitForFunction(() => { const e = document.querySelector('.precio-big'); return !!e && /1\.500|1,500/.test(e.textContent); });
    ok(true, 'con cuenta verificada se ve el precio del combo (Bs 1.500)');
    await vis.fill('#qty', '2'); await vis.click('[data-add][data-qty-from]');
    ok((await vis.textContent('[data-bcount]')) === '1', 'el combo se añade al presupuesto como una línea');
    const r = await vis.evaluate(async () => {
      const cab = { 'Content-Type': 'application/json', 'X-Requested-With': 'incerpaz' };
      const res = await fetch('/api/pedidos', { method: 'POST', headers: cab, body: JSON.stringify({ items: [{ ciudad: 'cochabamba', slug: 'combo-combo-cocina-prueba', cantidad: 2 }], entrega: { tipo: 'retiro', agencia: 'Central' }, pago: 'transferencia', nit: '1234567', razon_social: 'Prueba' }) });
      return { status: res.status, cuerpo: await res.json() };
    });
    ok(r.status === 201 && r.cuerpo.pedido.total_estimado === 3000 && r.cuerpo.pedido.items[0].nombre === 'Combo cocina de prueba', 'el pedido acepta el combo y calcula el total (2 × 1.500 = 3.000)');

    /* 5. una promoción vencida no se ofrece */
    const cuerpo = { id: 'sorteo-vencido', tipo: 'sorteo', titulo: 'Sorteo vencido de prueba', resumen: 'Terminó hace unos días', texto: '', ciudades: [], inicio: iso(antes), fin: iso(ayer), estado: 'publicada', cta: { tipo: 'whatsapp', texto: 'Participar' }, bases: 'Bases de prueba para el sorteo vencido.' };
    const rv = await adm.evaluate(async (c) => (await fetch('/api/admin/novedades', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'incerpaz' }, body: JSON.stringify(c) })).status, cuerpo);
    ok(rv === 201, 'el administrador publica una novedad con fechas pasadas');
    await vis.goto(BASE + 'promociones.html'); await vis.waitForSelector('#promos-lista');
    ok((await vis.locator('.promo-card:not([hidden])', { hasText: 'Sorteo vencido de prueba' }).count()) === 0, 'la novedad vencida no aparece en el listado');
    await vis.goto(BASE + 'promociones/sorteo-vencido.html'); await vis.waitForFunction(() => { const e = document.querySelector('#promo-estado'); return !!e && /terminó/.test(e.textContent); });
    ok(await vis.locator('[data-promo-cta]').first().isHidden(), 'en la página de una promoción vencida el botón queda oculto');

    /* 6. celular */
    await vis.setViewportSize({ width: 390, height: 800 });
    for (const u of ['promociones.html', 'combos/cochabamba/combo-cocina-prueba.html', 'promociones/sorteo-vencido.html']) {
      await vis.goto(BASE + u); ok((await vis.evaluate(() => document.documentElement.scrollWidth)) <= 390, `${u} no se desborda en celular`);
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

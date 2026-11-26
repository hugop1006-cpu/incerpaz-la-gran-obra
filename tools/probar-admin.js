/* Prueba de punta a punta del panel de administración con un navegador real.
   Levanta el servidor con base de datos y contenido temporales, edita desde el panel y comprueba que las páginas
   públicas cambian. Al terminar vuelve a generar el sitio con el contenido original.
   Uso: node tools/probar-admin.js */
const { chromium } = require('playwright');
const visitante = require('./visitante');
const { spawn, execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const PUERTO = process.env.PUERTO || '8098';
const BASE = `http://127.0.0.1:${PUERTO}/`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'incerpaz-adm-'));
const ENTORNO = Object.assign({}, process.env, { DB_PATH: path.join(TMP, 'p.db'), CONTENT_DIR: path.join(TMP, 'contenido'), PORT: PUERTO, ADMIN_CORREO: 'admin@incerpaz.test', ADMIN_NOMBRE: 'Administración', ADMIN_PASSWORD: 'admin-clave-123', SEMBRAR_DEMO: '1' });
let fallos = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) fallos++; };
/* espera el aviso nuevo (primero deja que desaparezca el anterior) */
let pagAviso; const aviso = async (accion, texto) => { await pagAviso.locator('#toast.on').waitFor({ state: 'hidden' }); await accion(); await pagAviso.waitForFunction((t) => { const e = document.getElementById('toast'); return e && e.classList.contains('on') && e.textContent.indexOf(t) >= 0; }, texto); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const srv = spawn('node', [path.join(__dirname, '..', 'server', 'index.js')], { env: ENTORNO, stdio: 'ignore' });
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + 'api/salud')).ok) break; } catch { /* aún no */ } await espera(200); }
    const b = await chromium.launch();
    const p = await (await visitante(b, { viewport: { width: 1280, height: 900 } })).newPage();
    const ej = await (await visitante(b, { viewport: { width: 1280, height: 900 } })).newPage();
    const errores = []; [p, ej].forEach((x) => x.on('pageerror', (e) => errores.push(e.message)));
    p.on('dialog', (d) => d.accept()); pagAviso = p;

    await ej.goto(BASE + 'ingresar.html'); await ej.fill('[name="correo"]', 'ejecutivo.prueba@incerpaz.test'); await ej.fill('[name="password"]', 'Prueba-Incerpaz-2026');
    await ej.click('#form-ingreso button[type="submit"]'); await ej.waitForURL('**/equipo.html');
    await ej.goto(BASE + 'admin.html'); await ej.waitForSelector('[data-tab="promos"]');
    ok((await ej.locator('[data-tab]').count()) === 1, 'el ejecutivo solo ve las promociones de su ciudad, no el resto del panel');
    ok((await ej.locator('[data-tab="confianza"]').count()) === 0, 'el ejecutivo no ve la pestaña Confianza');

    await p.goto(BASE + 'admin.html'); await p.waitForSelector('text=Ingresa con tu cuenta');
    await p.goto(BASE + 'ingresar.html?volver=admin.html'); await p.fill('[name="correo"]', ENTORNO.ADMIN_CORREO); await p.fill('[name="password"]', 'admin-clave-123');
    await p.click('#form-ingreso button[type="submit"]'); await p.waitForURL('**/admin.html'); await p.waitForSelector('table.tabla');
    ok((await p.locator('tbody tr').count()) === 32, 'el panel lista los 32 productos de Cochabamba');

    await p.click('[data-edit="18-h"]'); await p.fill('[name="titulo"]', '18 HUECOS PRUEBA'); await p.fill('[name="rendimiento"]', '46 Pzas/m2');
    await p.click('#f button[type=submit]'); await p.waitForSelector('table.tabla');
    const pagina = await (await fetch(BASE + 'productos/cochabamba/18-h.html')).text();
    ok(/18 huecos prueba/i.test(pagina), 'el cambio de nombre se publica en la ficha');

    /* producto nuevo: con fecha «nuevo hasta» lleva la etiqueta y aparece en la portada */
    const futuro = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    await p.click('[data-edit="18-h"]'); await p.fill('[name="nuevo_hasta"]', futuro);
    await p.click('#f button[type=submit]'); await p.waitForSelector('table.tabla');
    ok(/Nuevo hasta/.test(await p.textContent('table.tabla')), 'el panel muestra que el producto está destacado como nuevo');
    const vis = await (await visitante(b, { viewport: { width: 1280, height: 900 } })).newPage();
    await vis.goto(BASE + 'index.html');
    ok(await vis.isVisible('#nuevos-home .pcard[data-ciudad="cochabamba"] .tag--nuevo'), 'el producto nuevo aparece en la portada con su etiqueta');
    await vis.goto(BASE + 'catalogo.html?ciudad=cochabamba&cat=nuevos');
    ok((await vis.locator('#grid .pcard:visible').count()) === 1, 'el filtro «Nuevos» del catálogo lo muestra solo a él');
    await vis.context().close();
    await p.click('[data-edit="18-h"]'); await p.fill('[name="nuevo_hasta"]', '');
    await p.click('#f button[type=submit]'); await p.waitForSelector('table.tabla');
    ok(!/tag--nuevo/.test(await (await fetch(BASE + 'catalogo.html')).text()), 'sin fecha deja de destacarse');

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

    await p.click('[data-tab="confianza"]');
    const confianza = p.locator('.admin-confianza');
    await confianza.waitFor();
    ok((await confianza.locator('h2').allTextContents()).join(', ') === 'Año de inicio, Certificaciones, Obras, Testimonios', 'la pestaña Confianza carga los cuatro bloques');
    const capturas = process.env.CAPTURAS_CONFIANZA;
    if (capturas) {
      for (const nombre of ['Agregar certificación', 'Agregar obra', 'Agregar testimonio']) {
        await confianza.getByRole('button', { name: nombre }).click();
      }
      await p.locator('#toast.on').waitFor({ state: 'hidden' });
      await p.evaluate(() => document.activeElement.blur());
      const panel = p.locator('main');
      const estilo = '.site-header, .wa-float, #toast { visibility: hidden !important; }';
      await panel.screenshot({ path: path.join(capturas, 'confianza-escritorio.png'), style: estilo });
      await p.setViewportSize({ width: 390, height: 800 });
      await panel.screenshot({ path: path.join(capturas, 'confianza-celular.png'), style: estilo });
      await p.setViewportSize({ width: 1280, height: 900 });
      await p.reload();
      await p.click('[data-tab="confianza"]');
    }
    await confianza.getByRole('button', { name: 'Agregar obra' }).click();
    const obra = confianza.locator('[data-confianza="obras"] [data-ficha-confianza]');
    await obra.locator('[name="titulo"]').fill('Obra de prueba del panel');
    await obra.locator('[name="ciudad"]').fill('Ciudad de prueba');
    const fotos = path.join(__dirname, '../site/assets/img/productos');
    const foto = fs.readdirSync(fotos).find((f) => /\.jpe?g$/i.test(f));
    await obra.locator('input[type=file]').setInputFiles(path.join(fotos, foto));
    await obra.locator('img').waitFor();
    for (const autorizado of [true, false]) {
      await confianza.getByRole('button', { name: 'Agregar testimonio' }).click();
      const t = confianza.locator('[data-confianza="testimonios"] [data-ficha-confianza]').last();
      await t.locator('[name="nombre"]').fill('Nombre de prueba');
      await t.locator('[name="texto"]').fill(autorizado ? 'Testimonio autorizado del panel' : 'Testimonio sin autorización del panel');
      if (autorizado) await t.getByLabel('Tengo autorización escrita de esta persona o empresa').check();
    }
    await aviso(() => confianza.getByRole('button', { name: 'Guardar y publicar' }).click(), 'Cambios publicados');
    const portada = await (await fetch(BASE + 'index.html')).text();
    const imagen = await obra.locator('[name="imagen"]').inputValue();
    ok(portada.includes('Obra de prueba del panel') && portada.includes(imagen) && (await fetch(BASE + imagen)).ok, 'la obra y su foto subida aparecen en la portada');
    ok(portada.includes('Testimonio autorizado del panel'), 'el testimonio autorizado aparece en la portada');
    ok(!portada.includes('Testimonio sin autorización del panel'), 'el testimonio sin autorización no se publica');
    await p.reload();
    await p.click('[data-tab="confianza"]');
    const borrador = confianza.locator('[data-confianza="testimonios"] [data-ficha-confianza]').last();
    ok(await borrador.locator('[name="texto"]').inputValue() === 'Testimonio sin autorización del panel', 'el borrador se conserva al volver al panel');
    await p.setViewportSize({ width: 390, height: 800 });
    ok((await p.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'Confianza no desborda la página a 390 px');

    await obra.locator('[name="titulo"]').fill('Obra editada en el panel');
    await borrador.getByRole('button', { name: 'Quitar' }).click();
    await aviso(() => confianza.getByRole('button', { name: 'Guardar y publicar' }).click(), 'Cambios publicados');
    const editada = await (await fetch(BASE + 'index.html')).text();
    ok(editada.includes('Obra editada en el panel') && !editada.includes('Obra de prueba del panel'), 'editar una obra actualiza la portada');
    const guardado = await p.evaluate(async () => (await fetch('/api/admin/confianza')).json());
    ok(guardado.testimonios.length === 1, 'quitar un testimonio lo elimina de los datos guardados');

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

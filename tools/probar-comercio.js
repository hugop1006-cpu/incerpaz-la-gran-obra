/* Prueba de punta a punta del comercio (cuentas, precios, presupuesto y pedido) con un navegador real.
   Levanta el servidor con una base de datos temporal y el ERP de ejemplo.
   Uso: node tools/probar-comercio.js   (necesita: npm i playwright y haber generado el sitio con node site-src/build.js) */
const { chromium } = require('playwright');
const visitante = require('./visitante');
const { spawn, execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const PUERTO = process.env.PUERTO || '8097';
const BASE = `http://127.0.0.1:${PUERTO}/`;
const DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'incerpaz-')), 'prueba.db');
const ENTORNO = Object.assign({}, process.env, { DB_PATH: DB, PORT: PUERTO, ERP_ADAPTER: 'mock' });
let fallos = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) fallos++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  execFileSync('node', [path.join(__dirname, '..', 'server', 'crear-admin.js'), 'equipo@incerpaz.test', 'equipo-clave-1', 'Equipo Prueba', 'cochabamba', 'admin'], { env: ENTORNO, stdio: 'ignore' });
  const srv = spawn('node', [path.join(__dirname, '..', 'server', 'index.js')], { env: ENTORNO, stdio: 'ignore' });
  try {
    for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + 'api/salud')).ok) break; } catch { /* aún no */ } await espera(150); }
    const b = await chromium.launch();
    const cli = await (await visitante(b, { viewport: { width: 1280, height: 900 } })).newPage();
    const adm = await (await visitante(b, { viewport: { width: 1280, height: 900 } })).newPage();
    const errores = []; [cli, adm].forEach((p) => p.on('pageerror', (e) => errores.push(e.message)));

    /* banda para constructores: la ve el visitante y se oculta con sesión */
    await cli.goto(BASE + 'index.html'); await cli.waitForSelector('[data-acct] a');
    ok(await cli.isVisible('#constructores') && (await cli.getAttribute('#constructores a.btn--red', 'href')) === 'registro.html', 'el visitante ve la banda «¿Construyes o vendes materiales?» con el enlace a crear cuenta');
    await cli.goto(BASE + 'catalogo.html?ciudad=cochabamba');
    await cli.waitForSelector('.pcard:not([hidden]):not(.pcard--combo) [data-precio] a');
    ok(/Ingresa para ver precios/.test(await cli.textContent('.pcard:not([hidden]):not(.pcard--combo) .precio')), 'el visitante ve «Ingresa para ver precios» en el catálogo');
    ok((await cli.getAttribute('[data-cuenta]', 'href')) === 'ingresar.html' && !(await cli.locator('[data-cuenta] .hdr-dot').count()), 'el ícono de cuenta del encabezado lleva a ingresar');
    await cli.click('.pcard:not([hidden]):not(.pcard--combo) [data-add]');
    ok((await cli.textContent('[data-bcount]')) === '1', 'añadir al presupuesto actualiza el contador');
    ok(await cli.evaluate(() => document.querySelector('[data-bcount]').parentNode.classList.contains('hdr-ico--on')), 'el ícono del presupuesto se marca cuando hay productos');

    await cli.goto(BASE + 'productos/cochabamba/pavic-estandar.html');
    await cli.fill('#qty', '2000'); await cli.click('[data-add][data-qty-from]');
    ok((await cli.textContent('[data-bcount]')) === '2', 'la ficha añade la cantidad elegida');

    await cli.goto(BASE + 'registro.html');
    await cli.selectOption('[name="tipo"]', 'empresa');
    await cli.fill('[name="nombre"]', 'Ana Ejemplo'); await cli.fill('[name="razon_social"]', 'Constructora Ejemplo SRL'); await cli.fill('[name="nit"]', '1234567012');
    await cli.fill('[name="celular"]', '70000001'); await cli.fill('[name="correo"]', 'ana@ejemplo.com'); await cli.fill('[name="password"]', 'clave-segura-1'); await cli.fill('[name="password2"]', 'clave-segura-1');
    await cli.click('#form-registro button[type="submit"]'); await cli.waitForSelector('#despues:not([hidden])');
    ok(/verificar/i.test(await cli.textContent('#msg')), 'el registro queda pendiente de verificación');

    await cli.goto(BASE + 'ingresar.html?volver=catalogo.html');
    await cli.fill('[name="correo"]', 'ana@ejemplo.com'); await cli.fill('[name="password"]', 'clave-segura-1');
    await cli.click('#form-ingreso button[type="submit"]'); await cli.waitForURL('**/catalogo.html');
    await cli.waitForSelector('.pcard:not([hidden]):not(.pcard--combo) .precio');
    await cli.waitForFunction(() => /verifiques|verificar tu cuenta/i.test(document.querySelector('.pcard:not([hidden]):not(.pcard--combo) .precio').textContent));
    ok(true, 'con la cuenta pendiente no se ven precios');
    ok(!/\d+[.,]\d{2}/.test(await cli.textContent('.pcard:not([hidden]):not(.pcard--combo) .precio')), 'sin cifras en el precio');

    await adm.goto(BASE + 'ingresar.html?volver=equipo.html');
    await adm.fill('[name="correo"]', 'equipo@incerpaz.test'); await adm.fill('[name="password"]', 'equipo-clave-1');
    await adm.click('#form-ingreso button[type="submit"]'); await adm.waitForURL('**/equipo.html');
    await adm.waitForSelector('[data-ver]');
    await adm.selectOption('[data-lista]', 'constructor'); await adm.click('[data-ver]');
    await adm.waitForFunction(() => /No hay cuentas por verificar/.test(document.querySelector('#panel').textContent));
    ok(true, 'el equipo verifica la cuenta y le asigna la lista de precios');

    await cli.reload(); await cli.waitForFunction(() => /Bs\s*\d/.test(document.querySelector('.pcard:not([hidden]):not(.pcard--combo) .precio').textContent));
    ok(/ejemplo/.test(await cli.textContent('.pcard:not([hidden]):not(.pcard--combo) .precio')), 'la cuenta verificada ve precios (marcados como de ejemplo)');

    /* comparador: la cuenta verificada ve el precio de cada producto, también después de quitar uno */
    await cli.goto(BASE + 'comparar.html?p=cochabamba:18-h,cochabamba:18-h-1-2,cochabamba:pavic-estandar');
    await cli.waitForFunction(() => { const n = document.querySelectorAll('.cmp-precio .precio'); return n.length === 3 && Array.from(n).every((x) => /Bs\s*\d/.test(x.textContent)); });
    ok(true, 'el comparador muestra el precio de los 3 productos');
    await cli.click('[data-cmp-quitar="cochabamba:18-h"]');
    await cli.waitForFunction(() => { const n = document.querySelectorAll('.cmp-precio .precio'); return n.length === 2 && Array.from(n).every((x) => /Bs\s*\d/.test(x.textContent)); });
    ok(true, 'al quitar un producto los precios se vuelven a pintar');
    await cli.click('[data-cmp-vaciar]');

    await cli.goto(BASE + 'presupuesto.html'); await cli.waitForSelector('[data-q]');
    ok((await cli.locator('[data-q]').count()) === 2, 'el presupuesto conserva los productos añadidos');
    ok(/Bs\s*\d/.test(await cli.textContent('.tabla tfoot')), 'se muestra el total estimado');
    await cli.fill('#obra', 'Edificio Av. Ejemplo');
    await cli.click('[data-ir="2"]'); await cli.click('[data-ir="3"]'); await cli.click('[data-ir="4"]');
    await cli.click('#enviar-pedido'); await cli.waitForSelector('.done');
    const numero = (await cli.textContent('.done b')).match(/PD-\d{5}/);
    ok(!!numero, 'el pedido se envía y recibe número ' + (numero ? numero[0] : ''));

    await cli.goto(BASE + 'mi-cuenta.html'); await cli.waitForSelector('[data-detalle]');
    ok(/Recibido/.test(await cli.textContent('.tabla')), 'Mi cuenta muestra el pedido recibido');
    await adm.goto(BASE + 'equipo.html'); await adm.click('[data-tab="pedidos"]'); await adm.waitForSelector('[data-estado]');
    await adm.selectOption('[data-estado]', 'en_despacho'); await espera(500);
    await cli.reload(); await cli.waitForSelector('[data-detalle]');
    ok(/En despacho/.test(await cli.textContent('.tabla')), 'el cliente ve el nuevo estado del pedido');
    await cli.click('[data-repetir]'); await cli.waitForURL('**/presupuesto.html');
    ok((await cli.locator('[data-q]').count()) === 2, 'repetir un pedido vuelve a llenar el presupuesto');

    await cli.setViewportSize({ width: 390, height: 800 }); await cli.goto(BASE + 'presupuesto.html'); await cli.waitForSelector('[data-q]');
    ok((await cli.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'el presupuesto no se desborda en celular');
    await cli.goto(BASE + 'index.html'); await cli.waitForSelector('[data-salir]');
    ok((await cli.getAttribute('[data-cuenta]', 'href')) === 'mi-cuenta.html' && (await cli.locator('[data-cuenta] .hdr-dot').count()) === 1, 'con sesión el ícono de cuenta lleva a Mi cuenta y muestra el punto verde');
    ok(!(await cli.isVisible('#constructores')), 'con sesión iniciada la banda para constructores se oculta');
    /* la página ya está en index.html y la URL no cambia: se espera a que cierre sesión y recargue */
    await Promise.all([cli.waitForEvent('load'), cli.click('[data-salir]')]);
    await cli.goto(BASE + 'mi-cuenta.html'); await cli.waitForURL('**/ingresar.html**');
    ok(true, 'al salir, Mi cuenta pide ingresar de nuevo');
    ok(errores.length === 0, 'sin errores de JavaScript' + (errores.length ? ': ' + errores[0] : ''));
    await b.close();
  } finally { srv.kill(); }
  console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

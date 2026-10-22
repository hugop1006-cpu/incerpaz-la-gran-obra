/* Prueba automática del sitio de INCERPAZ.
   1) node site-src/build.js   2) npx http-server -p 8080 .   3) node tools/probar-sitio.js
   Revisa que abran las páginas, no haya imágenes rotas ni errores y que funcionen la ciudad, las calculadoras,
   el catálogo, las pestañas de Dónde estamos, los formularios y el menú móvil. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8080/site/';
let fallos = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) fallos++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const pg = await ctx.newPage();
  const errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  for (const p of ['index.html', 'catalogo.html', 'pavic.html', 'donde-estamos.html', 'empresa.html', 'productos/cochabamba/pavic-estandar.html', 'productos/cochabamba/bloque-ceramico-9-cm.html', 'productos/santa-cruz/tsc.html', 'productos/santa-cruz/pieza-decorativa-trebol.html']) {
    const r = await pg.goto(BASE + p, { waitUntil: 'load' });
    for (let y = 0; y < 9000; y += 700) { await pg.evaluate((v) => window.scrollTo(0, v), y); await pg.waitForTimeout(40); }
    const rotas = await pg.evaluate(() => Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).length);
    ok(r.status() === 200 && rotas === 0, `${p} abre y no tiene imágenes rotas`);
  }
  await pg.goto(BASE + 'index.html');
  await pg.selectOption('#citySel', 'santa-cruz'); await pg.reload();
  ok((await pg.inputValue('#citySel')) === 'santa-cruz', 'la ciudad elegida se recuerda');
  ok((await pg.getAttribute('.wa-float', 'href')).includes('59170009021'), 'el WhatsApp cambia con la ciudad');
  await pg.fill('[data-calc-area]', '100'); await pg.selectOption('[data-calc-merma]', '0.1');
  ok((await pg.textContent('[data-out="pzas"]')).replace(/\D/g, '') === String(Math.ceil(100 * 45 * 1.1)), 'la calculadora de inicio calcula las piezas');
  await pg.goto(BASE + 'catalogo.html?ciudad=cochabamba&cat=pisos-y-pavimentos');
  ok((await pg.textContent('#count')).startsWith('4'), 'el filtro de categoría funciona');
  await pg.click('[data-cat="todas"]'); await pg.fill('#q', 'enchape');
  ok((await pg.textContent('#count')).startsWith('2'), 'la búsqueda funciona');
  await pg.fill('#q', ''); await pg.click('[data-catalogo="santa-cruz"]'); await pg.click('[data-cat="techos"]');
  ok((await pg.textContent('#count')).startsWith('2'), 'el catálogo de Santa Cruz muestra sus tejas');
  await pg.goto(BASE + 'catalogo.html'); await pg.selectOption('#citySel', 'santa-cruz');
  ok(await pg.evaluate(() => document.querySelector('[data-catalogo="santa-cruz"]').getAttribute('aria-pressed') === 'true'), 'al cambiar de ciudad cambia el catálogo');
  await pg.goto(BASE + 'donde-estamos.html#oruro');
  ok(await pg.evaluate(() => !document.getElementById('oruro').hidden && document.getElementById('cochabamba').hidden), 'las pestañas de ciudad funcionan');
  await pg.click('[data-city-tab="otra-ciudad"]');
  const [popup] = await Promise.all([ctx.waitForEvent('page'), (async () => {
    await pg.fill('form[data-lead] [name="nombre"]', 'Prueba'); await pg.fill('form[data-lead] [name="celular"]', '70000000'); await pg.fill('form[data-lead] [name="ciudad_otra"]', 'Tarija');
    await pg.click('form[data-lead] button[type="submit"]'); })()]);
  ok(/whatsapp/.test(popup.url()), 'el formulario abre WhatsApp con el mensaje');
  await pg.setViewportSize({ width: 390, height: 800 }); await pg.goto(BASE + 'index.html');
  ok(!(await pg.isVisible('#nav')), 'el menú móvil empieza cerrado');
  await pg.click('.nav-toggle');
  ok(await pg.isVisible('#nav'), 'el menú móvil se abre');
  ok((await pg.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'no hay desborde horizontal en celular');
  ok(errores.length === 0, 'sin errores de JavaScript' + (errores.length ? ': ' + errores[0] : ''));
  await b.close();
  console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
  process.exit(fallos ? 1 : 0);
})();

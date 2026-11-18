/* Prueba la etiqueta «Nuevo» con fechas y productos de prueba; no altera el catálogo real.
   Uso: node tools/probar-nuevo.js */
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const visitante = require('./visitante');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const RAIZ = path.join(__dirname, '..');
let fallos = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) fallos++; };
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function puertoLibre() {
  const s = net.createServer();
  await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve));
  const puerto = s.address().port;
  await new Promise((resolve) => s.close(resolve));
  return puerto;
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'incerpaz-nuevo-'));
  const contenido = path.join(tmp, 'contenido'), salida = path.join(tmp, 'site');
  const catalogo = path.join(tmp, 'catalogo.json');
  fs.cpSync(path.join(RAIZ, 'site-src/data'), contenido, { recursive: true });
  const productosPath = path.join(contenido, 'productos.json');
  const productos = JSON.parse(fs.readFileSync(productosPath, 'utf8'));
  const futuro = productos[0], vencido = productos[1], sinFecha = productos[2];
  futuro.nuevo_hasta = '2099-12-31';
  vencido.nuevo_hasta = '2000-01-01';
  delete sinFecha.nuevo_hasta;
  fs.writeFileSync(productosPath, JSON.stringify(productos, null, 1));
  let srv, browser;
  try {
    execFileSync(process.execPath, [path.join(RAIZ, 'site-src/build.js')], {
      env: Object.assign({}, process.env, { CONTENT_DIR: contenido, SITE_OUT: salida, CATALOGO_OUT: catalogo }),
      stdio: 'ignore'
    });
    fs.cpSync(path.join(RAIZ, 'site/assets'), path.join(salida, 'assets'), { recursive: true, force: true });
    const htmlCatalogo = fs.readFileSync(path.join(salida, 'catalogo.html'), 'utf8');
    const htmlInicio = fs.readFileSync(path.join(salida, 'index.html'), 'utf8');
    const etiqueta = 'data-nuevo-badge';
    ok(htmlCatalogo.includes('data-nuevo-hasta="2099-12-31"') && htmlCatalogo.includes(etiqueta), 'el catálogo genera la etiqueta para una fecha futura');
    ok(htmlInicio.includes('id="nuevos-home"') && htmlInicio.includes(etiqueta), 'la portada destaca los productos nuevos');
    ok(!htmlInicio.includes('data-comparar="' + vencido.ciudad + ':' + vencido.slug + '"'), 'la portada excluye productos vencidos aunque haya otros vigentes');
    const ficha = (html, p) => Array.from(html.matchAll(/<article class="pcard"[^>]*>[\s\S]*?<\/article>/g)).map((m) => m[0]).find((x) => x.includes('data-comparar="' + p.ciudad + ':' + p.slug + '"')) || '';
    const cardVencido = ficha(htmlCatalogo, vencido), cardSinFecha = ficha(htmlCatalogo, sinFecha);
    ok(cardVencido.includes('data-nuevo-hasta="2000-01-01"') && !cardVencido.includes(etiqueta), 'la fecha vencida no muestra «Nuevo» al generar');
    ok(!cardSinFecha.includes('data-nuevo-hasta') && !cardSinFecha.includes(etiqueta), 'un producto sin fecha no se marca');
    const puerto = await puertoLibre();
    srv = spawn('python3', ['-m', 'http.server', String(puerto), '--bind', '127.0.0.1'], { cwd: salida, stdio: 'ignore' });
    let listo = false;
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch('http://127.0.0.1:' + puerto + '/index.html')).ok) { listo = true; break; } } catch { /* aún inicia */ }
      await esperar(100);
    }
    ok(listo, 'el sitio de prueba responde');
    if (listo) {
      browser = await chromium.launch();
      const ctx = await visitante(browser, { viewport: { width: 1280, height: 900 } });
      const pg = await ctx.newPage();
      await pg.goto('http://127.0.0.1:' + puerto + '/catalogo.html?ciudad=cochabamba');
      const selectorNuevo = '[data-comparar="' + futuro.ciudad + ':' + futuro.slug + '"]';
      ok(await pg.locator(selectorNuevo).locator('xpath=..').locator('[data-nuevo-badge]').isVisible(), 'la etiqueta vigente aparece en el catálogo');
      await pg.goto('http://127.0.0.1:' + puerto + '/index.html');
      ok(await pg.locator('#nuevos-home ' + selectorNuevo).locator('xpath=..').locator('[data-nuevo-badge]').isVisible(), 'la etiqueta vigente aparece en la portada');
      const expiracion = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await expiracion.addInitScript(() => {
        const FechaReal = Date, fijo = new FechaReal('2100-01-02T12:00:00Z').getTime();
        function FechaFija() { return arguments.length ? new FechaReal(...arguments) : new FechaReal(fijo); }
        FechaFija.prototype = FechaReal.prototype; FechaFija.now = () => fijo;
        FechaFija.parse = FechaReal.parse; FechaFija.UTC = FechaReal.UTC; window.Date = FechaFija;
      });
      const despues = await expiracion.newPage();
      await despues.goto('http://127.0.0.1:' + puerto + '/catalogo.html?ciudad=cochabamba');
      ok(await despues.locator(selectorNuevo).locator('xpath=..').locator('[data-nuevo-badge]').isHidden(), 'la etiqueta se oculta al pasar su fecha');
      await despues.goto('http://127.0.0.1:' + puerto + '/index.html');
      ok(await despues.locator('#nuevos-home').isHidden(), 'la sección de la portada desaparece cuando vencen sus productos');
      await browser.close(); browser = null;
    }
  } finally {
    if (browser) await browser.close();
    if (srv) { srv.kill('SIGTERM'); await esperar(100); }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(fallos ? '\n' + fallos + ' fallos' : '\nTodo bien');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

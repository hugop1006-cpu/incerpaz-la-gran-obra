/* Comprueba que el servidor resuelva las cuatro direcciones cortas a sus portadas generadas.
   Uso: node tools/probar-direcciones.js */
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'incerpaz-rutas-'));
  const puerto = await puertoLibre();
  const env = Object.assign({}, process.env, {
    PORT: String(puerto), HOST: '127.0.0.1', DB_PATH: path.join(tmp, 'prueba.db'),
    CONTENT_DIR: path.join(tmp, 'contenido'), SITE_OUT: path.join(tmp, 'generado'),
    CATALOGO_OUT: path.join(tmp, 'catalogo.json'), ADMIN_PASSWORD: 'Prueba-temporal-2026'
  });
  const srv = spawn(process.execPath, [path.join(RAIZ, 'server/index.js')], { env, stdio: 'ignore' });
  let browser;
  try {
    let listo = false;
    for (let i = 0; i < 150; i++) {
      try { if ((await fetch('http://127.0.0.1:' + puerto + '/api/salud')).ok) { listo = true; break; } } catch { /* aún inicia */ }
      if (srv.exitCode != null) break;
      await esperar(200);
    }
    ok(listo, 'el servidor temporal está disponible');
    if (listo) {
      for (const ciudad of ['cochabamba', 'santa-cruz', 'oruro', 'sucre']) {
        for (const sufijo of ['', '/']) {
          const r = await fetch('http://127.0.0.1:' + puerto + '/' + ciudad + sufijo);
          const html = await r.text();
          ok(r.status === 200 && r.url.endsWith('/' + ciudad) && html.includes('data-ciudad-ruta="' + ciudad + '"') && /<title>INCERPAZ \| Cerámica para construir en /.test(html), '/' + ciudad + sufijo + ' abre la portada con la ciudad indicada');
        }
      }
      browser = await chromium.launch();
      for (const [ciudad, catalogo] of [['cochabamba', 'cochabamba'], ['santa-cruz', 'santa-cruz'], ['oruro', 'cochabamba'], ['sucre', 'cochabamba']]) {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const page = await ctx.newPage();
        await page.goto('http://127.0.0.1:' + puerto + '/' + ciudad);
        ok((await page.inputValue('#citySel')) === ciudad && !(await page.isVisible('#cityDlg')), '/' + ciudad + ' selecciona la ciudad sin preguntar');
        await page.goto('http://127.0.0.1:' + puerto + '/catalogo.html');
        ok(await page.evaluate((c) => document.querySelector('[data-catalogo="' + c + '"]').getAttribute('aria-pressed') === 'true', catalogo), '/' + ciudad + ' muestra el catálogo más cercano');
        if (ciudad === 'oruro' || ciudad === 'sucre') ok(await page.isVisible('#catNota'), '/' + ciudad + ' informa que la disponibilidad se confirma con la agencia');
        await ctx.close();
      }
    }
  } finally {
    if (browser) await browser.close();
    srv.kill('SIGTERM');
    await esperar(150);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(fallos ? '\n' + fallos + ' fallos' : '\nTodo bien');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

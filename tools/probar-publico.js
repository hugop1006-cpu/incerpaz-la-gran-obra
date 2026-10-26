/* Verifica que el sitio esté listo para publicarse: SEO, enlaces, privacidad de precios, rendimiento y seguridad del servidor.
   Genera el sitio en modo público (PUBLICO=1), lo revisa y al terminar lo vuelve a generar como estaba.
   Uso: node tools/probar-publico.js */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('node:child_process');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const RAIZ = path.join(__dirname, '..'), SITIO = path.join(RAIZ, 'site');
const DOMINIO = JSON.parse(fs.readFileSync(path.join(RAIZ, 'site-src/data/sitio.json'), 'utf8')).dominio;
const PRIVADAS = new Set(['ingresar.html', 'registro.html', 'presupuesto.html', 'mi-cuenta.html', 'equipo.html', 'admin.html', '404.html']);
let fallos = 0;
const ok = (c, m, detalle) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m + (!c && detalle ? '\n       ' + [].concat(detalle).slice(0, 6).join('\n       ') : '')); if (!c) fallos++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const listar = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listar(path.join(d, e.name)) : [path.join(d, e.name)]));
const pedir = (puerto, ruta, cab = {}) => new Promise((res, rej) => { const r = http.request({ host: '127.0.0.1', port: puerto, path: ruta, headers: cab }, (x) => { const t = []; x.on('data', (c) => t.push(c)); x.on('end', () => res({ status: x.statusCode, headers: x.headers, cuerpo: Buffer.concat(t) })); }); r.on('error', rej); r.end(); });
async function levantar(puerto, extra) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'incerpaz-pub-'));
  const env = Object.assign({}, process.env, { DB_PATH: path.join(tmp, 'p.db'), CONTENT_DIR: path.join(tmp, 'c'), PORT: String(puerto), ADMIN_PASSWORD: 'admin-clave-123', PUBLICO: '1' }, extra);
  const srv = spawn('node', [path.join(RAIZ, 'server', 'index.js')], { env, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await pedir(puerto, '/api/salud')).status === 200) break; } catch { /* aún no */ } await espera(200); }
  return srv;
}

(async () => {
  const limpio = Object.assign({}, process.env); delete limpio.CONTENT_DIR; delete limpio.PUBLICO;
  const srvA = await levantar(8089, { COOKIE_SECURE: '1', TRUST_PROXY: '1', CANONICAL_HOST: 'www.incerpaz.com' });
  const srvB = await levantar(8088, {});
  try {
    /* ---------- 1. páginas estáticas ---------- */
    const archivos = listar(SITIO).filter((f) => f.endsWith('.html')).map((f) => path.relative(SITIO, f).split(path.sep).join('/'));
    const publicas = archivos.filter((f) => !PRIVADAS.has(f));
    const p = { noindex: [], canon: [], titulos: new Map(), titulosLargos: [], desc: [], h1: [], alt: [], ld: [], enlaces: [], og: [], precios: [], privNoidx: [] };
    for (const f of archivos) {
      const h = fs.readFileSync(path.join(SITIO, f), 'utf8');
      const esPriv = PRIVADAS.has(f);
      if (esPriv) { if (f !== '404.html' && !/name="robots" content="noindex/.test(h)) p.privNoidx.push(f); continue; }
      if (/name="robots" content="noindex/.test(h)) p.noindex.push(f);
      const canon = (/<link rel="canonical" href="([^"]+)"/.exec(h) || [])[1];
      if (canon !== `${DOMINIO}/${f === 'index.html' ? '' : f}`) p.canon.push(`${f}: ${canon}`);
      const t = (/<title>([^<]*)<\/title>/.exec(h) || [])[1] || ''; p.titulos.set(t, (p.titulos.get(t) || []).concat(f)); if (t.length > 62 || t.length < 15) p.titulosLargos.push(`${f}: ${t.length}`);
      const d = (/name="description" content="([^"]*)"/.exec(h) || [])[1] || ''; if (d.length < 50 || d.length > 160) p.desc.push(`${f}: ${d.length}`);
      if ((h.match(/<h1[ >]/g) || []).length !== 1) p.h1.push(f);
      for (const im of h.match(/<img\b[^>]*>/g) || []) if (!/\balt=/.test(im)) p.alt.push(`${f}: ${im.slice(0, 60)}`);
      for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); } catch { p.ld.push(f); } }
      for (const m of h.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
        const href = m[1]; if (/^(https?:|mailto:|tel:|#|javascript:)/.test(href)) continue;
        const limpio2 = href.split('#')[0].split('?')[0]; if (!limpio2) continue;
        let dest = path.normalize(path.join(SITIO, path.dirname(f), limpio2));
        if (fs.existsSync(dest) && fs.statSync(dest).isDirectory()) dest = path.join(dest, 'index.html');
        if (!(fs.existsSync(dest) && fs.statSync(dest).isFile())) p.enlaces.push(`${f} → ${href}`);
      }
      const og = (/property="og:image" content="([^"]+)"/.exec(h) || [])[1]; if (!og || !fs.existsSync(path.join(SITIO, og.replace(DOMINIO + '/', '')))) p.og.push(`${f}: ${og}`);
      if (/"price"|"offers"|\bBs\.?\s?\d/.test(h)) p.precios.push(f);
    }
    ok(publicas.length >= 60, `${publicas.length} páginas públicas revisadas`);
    ok(!p.noindex.length, 'ninguna página pública lleva noindex', p.noindex);
    ok(!p.privNoidx.length, 'ingresar, registro, presupuesto, cuenta, equipo y admin llevan noindex', p.privNoidx);
    ok(!p.canon.length, 'cada página declara su canonical con el dominio público', p.canon);
    ok([...p.titulos.values()].every((v) => v.length === 1), 'no hay títulos repetidos', [...p.titulos].filter(([, v]) => v.length > 1).map(([t, v]) => `${t}: ${v.join(', ')}`));
    ok(!p.titulosLargos.length, 'los títulos miden entre 15 y 62 caracteres', p.titulosLargos);
    ok(!p.desc.length, 'las descripciones miden entre 50 y 160 caracteres', p.desc);
    ok(!p.h1.length, 'cada página tiene un solo h1', p.h1);
    ok(!p.alt.length, 'todas las imágenes tienen texto alternativo', p.alt);
    ok(!p.ld.length, 'todo el marcado JSON-LD es válido', p.ld);
    ok(!p.enlaces.length, 'no hay enlaces internos rotos', p.enlaces);
    ok(!p.og.length, 'todas las páginas tienen imagen para compartir en redes', p.og);
    ok(!p.precios.length, 'ningún precio queda escrito en el HTML público', p.precios);
    const sm = fs.readFileSync(path.join(SITIO, 'sitemap.xml'), 'utf8'); const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    ok(urls.length === publicas.length && urls.every((u) => fs.existsSync(path.join(SITIO, u.replace(DOMINIO + '/', '') || 'index.html'))), `el sitemap lista las ${publicas.length} páginas públicas y todas existen`, [`sitemap: ${urls.length}`]);
    const rb = fs.readFileSync(path.join(SITIO, 'robots.txt'), 'utf8');
    ok(/Allow: \//.test(rb) && /Disallow: \/api\//.test(rb) && rb.includes(`${DOMINIO}/sitemap.xml`), 'robots.txt permite rastrear, cierra /api/ y apunta al sitemap');
    const pesoImg = listar(path.join(SITIO, 'assets/img')).filter((f) => /\.(jpe?g|png)$/i.test(f) && fs.statSync(f).size > 350_000);
    ok(!pesoImg.length, 'ninguna imagen pesa más de 350 KB', pesoImg.map((f) => path.relative(SITIO, f)));

    /* ---------- 2. servidor: compresión, caché, seguridad y redirecciones ---------- */
    const cr = await pedir(8089, '/index.html', { Host: 'www.incerpaz.com', 'Accept-Encoding': 'br', 'X-Forwarded-Proto': 'https' });
    const sinc = await pedir(8089, '/index.html', { Host: 'www.incerpaz.com', 'X-Forwarded-Proto': 'https' });
    ok(cr.status === 200 && cr.headers['content-encoding'] === 'br' && cr.cuerpo.length < sinc.cuerpo.length / 3, `el HTML se sirve comprimido (${sinc.cuerpo.length} → ${cr.cuerpo.length} bytes)`);
    const css = (/href="([^"]*site\.css\?v=[^"]+)"/.exec(fs.readFileSync(path.join(SITIO, 'index.html'), 'utf8')) || [])[1];
    const rc = await pedir(8089, '/' + css, { Host: 'www.incerpaz.com', 'X-Forwarded-Proto': 'https' });
    ok(/immutable/.test(rc.headers['cache-control'] || ''), 'el CSS versionado se guarda un año en el navegador');
    const r304 = await pedir(8089, '/index.html', { Host: 'www.incerpaz.com', 'X-Forwarded-Proto': 'https', 'If-None-Match': cr.headers.etag });
    ok(r304.status === 304, 'el HTML se revalida con ETag (304 sin cuerpo)');
    ok(/default-src 'self'/.test(cr.headers['content-security-policy'] || '') && /max-age=31536000/.test(cr.headers['strict-transport-security'] || '') && cr.headers['x-frame-options'] === 'DENY', 'CSP, HSTS y X-Frame-Options presentes');
    const rd = await pedir(8089, '/catalogo.html?ciudad=santa-cruz', { Host: 'incerpaz.com', 'X-Forwarded-Proto': 'https' });
    ok(rd.status === 301 && rd.headers.location === 'https://www.incerpaz.com/catalogo.html?ciudad=santa-cruz', 'incerpaz.com redirige al dominio principal conservando la ruta');
    const rh = await pedir(8089, '/pavic.html', { Host: 'www.incerpaz.com', 'X-Forwarded-Proto': 'http' });
    ok(rh.status === 301 && rh.headers.location === 'https://www.incerpaz.com/pavic.html', 'http redirige a https');
    ok((await pedir(8089, '/api/salud', { Host: 'www.incerpaz.com', 'X-Forwarded-Proto': 'http' })).status === 200, 'la verificación de salud no se redirige');
    ok((await pedir(8089, '/%E0%A4%A')).status === 400, 'una dirección mal codificada da 400 y no 500');

    /* ---------- 3. navegador: la política CSP no rompe nada ---------- */
    const b = await chromium.launch();
    const pg = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    const errores = []; pg.on('pageerror', (e) => errores.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errores.push(m.text()); });
    const BASE = 'http://127.0.0.1:8088/';
    await pg.goto(BASE); await pg.waitForFunction(() => document.querySelectorAll('#citySel option').length === 4);
    ok(true, 'config.js carga y el selector de ciudad funciona');
    await pg.goto(BASE + 'catalogo.html'); await pg.waitForSelector('.pcard:not([hidden])');
    await pg.goto(BASE + 'proyectos/churrasquero.html'); await pg.waitForSelector('#proy-lista table');
    await pg.goto(BASE + 'pavic-recursos.html'); await pg.waitForSelector('#pv-resultado table');
    await pg.goto(BASE + 'guias/cuantos-ladrillos-por-metro-cuadrado.html');
    await pg.fill('.form-box [name="nombre"]', 'Prueba'); await pg.fill('.form-box [name="celular"]', '70011122'); await pg.click('.form-box button[type="submit"]'); await pg.waitForSelector('.form-msg:not([hidden])');
    ok(/Recibimos/.test(await pg.textContent('.form-msg')), 'los formularios siguen enviando con la política activa');
    await pg.goto(BASE + 'ingresar.html?volver=admin.html'); await pg.fill('[name="correo"]', 'hugop1006@gmail.com'); await pg.fill('[name="password"]', 'admin-clave-123');
    await pg.click('#form-ingreso button[type="submit"]'); await pg.waitForURL('**/admin.html'); await pg.waitForSelector('table.tabla');
    ok(errores.length === 0, 'ninguna violación de CSP ni errores de JavaScript', errores);
    await b.close();
  } finally {
    srvA.kill(); srvB.kill();
    execFileSync('node', [path.join(RAIZ, 'site-src', 'build.js')], { env: limpio, stdio: 'ignore' });
  }
  console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

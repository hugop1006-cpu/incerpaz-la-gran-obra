// Genera las capturas y gráficos de las fichas de tienda con DATOS FICTICIOS y un reloj fijo (reproducible).
// Requisitos: Node 18+ y Playwright (npm i -D playwright && npx playwright install chromium). Uso: node store/make-screenshots.cjs
// Las "fotos" de máquinas son ilustraciones generadas: sustitúyelas por tus fotos reales cuando las tengas.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '..'), OUT = __dirname, NOW = new Date('2026-11-05T10:00:00');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const SCREENS = [ // [archivo, titulo (2 líneas), subtítulo]
  ['01-elige-rutina', 'Elige tu rutina\ny empieza', 'Plantillas listas o las tuyas'],
  ['02-un-ejercicio-a-la-vez', 'Un ejercicio\na la vez', 'Con foto de la máquina y su ficha'],
  ['03-registra-series', 'Registra series,\npeso y esfuerzo', 'Con temporizador de descanso'],
  ['04-progreso', 'Mira tu progreso\ny tus récords', 'Gráficas por ejercicio'],
  ['05-plantillas', 'Tus plantillas\ny ejercicios', 'Series, repeticiones y descanso a tu medida'],
  ['06-tus-datos', 'Tus datos son tuyos', 'Copias de seguridad y nube opcional']
];
function seedScript(now) { return `(() => {
  const NOW = ${now}, D = 864e5, iso = n => new Date(NOW - n * D).toISOString().slice(0, 19);
  const set = (n, w, r) => Array.from({ length: n }, () => ({ done: true, weight: String(w), reps: String(r), minutes: '', speed: '' }));
  const E = (mode, sets, effort) => ({ skipped: false, mode, effort, comment: '', symptoms: 'no', sets });
  const days = [38, 34, 31, 27, 24, 20, 17, 13, 10, 6, 3], sessions = days.map((d, i) => { const k = i, entries = {
    prensa: E('lado', set(3, 70 + k * 3, 12), k > 7 ? 8 : 7), 'press-pecho': E('total', set(3, 30 + Math.floor(k * 1.5), 10), 7), remo: E('total', set(3, 45 + k * 2, 10), 7),
    jalon: E('total', set(2, 50 + k * 2, 12), 7), 'elev-laterales': E('mano', set(2, 5 + Math.floor(k / 3) * 2.5, 12), 7), 'curl-biceps': E('mano', set(2, 10 + Math.floor(k / 3) * 2.5, 12), 8) };
    return { id: 'demo' + i, date: iso(d), routine: 'Fuerza cuerpo completo', steps: Object.keys(entries), entries, finished: iso(d) }; });
  const illus = (seed) => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const x = c.getContext('2d'), h = 170 + seed * 7 % 40;
    const g = x.createLinearGradient(0, 0, 0, 600); g.addColorStop(0, '#22384a'); g.addColorStop(1, '#0d1620'); x.fillStyle = g; x.fillRect(0, 0, 800, 600);
    x.fillStyle = '#16222d'; x.fillRect(0, 470, 800, 130); x.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 8; i++) x.fillRect(i * 110 + 10, 470, 4, 130);
    x.fillStyle = '#2b3d4d'; x.fillRect(520, 90, 150, 380); for (let i = 0; i < 9; i++) { x.fillStyle = i < 4 ? 'hsl(' + h + ',70%,55%)' : '#3b5063'; x.fillRect(530, 100 + i * 40, 130, 32); }
    x.strokeStyle = '#8b98a5'; x.lineWidth = 10; x.beginPath(); x.moveTo(595, 90); x.lineTo(595, 40); x.stroke();
    x.fillStyle = '#e6edf3'; x.beginPath(); x.roundRect(150, 330, 230, 50, 14); x.fill(); x.beginPath(); x.roundRect(110, 170, 60, 220, 14); x.fill();
    x.fillStyle = '#2dd4bf'; x.fillRect(150, 380, 18, 90); x.fillRect(362, 380, 18, 90); x.strokeStyle = '#2dd4bf'; x.lineWidth = 14; x.beginPath(); x.moveTo(380, 340); x.lineTo(520, 260); x.stroke();
    return c.toDataURL('image/jpeg', 0.8); };
  const ids = ['caminadora','eliptica','prensa','press-pecho','remo','peso-muerto-rumano','jalon','elev-laterales','curl-biceps','triceps-polea','abductores','aductores','talones'];
  const photos = Object.fromEntries(ids.map((id, i) => [id, illus(i + 1)]));
  localStorage.setItem('pert.v1', JSON.stringify({ sessions, settings: { unit: 'lb', lastBackup: NOW - D }, current: null, templates: [], customExercises: [] }));
  localStorage.setItem('pert.photos.v1', JSON.stringify(photos)); localStorage.setItem('pert.cloud.v1', JSON.stringify({ url: '', key: '', email: '', session: null }));
})();`; }
async function capture(browser, base, name, fn) {
  const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'es-ES' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(seedScript(NOW.getTime())); await p.clock.install({ time: NOW }); await p.goto(base + '/index.html'); await p.waitForSelector('#view *');
  await fn(p); await p.waitForTimeout(250); const buf = await p.screenshot(); await ctx.close(); if (errs.length) throw new Error(name + ': ' + errs.join('|')); return buf;
}
const scrollTo = (p, sel, off = 70) => p.evaluate(([s, o]) => { const el = typeof s === 'string' && s.startsWith('h3:') ? [...document.querySelectorAll('h3')].find(h => h.textContent.includes(s.slice(3))) : document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - o); }, [sel, off]);
const FLOWS = {
  '01-elige-rutina': async p => { await p.evaluate(() => scrollTo(0, 0)); },
  '02-un-ejercicio-a-la-vez': async p => { await p.click('button[data-act=start]'); await p.click('button[data-act=next]'); },
  '03-registra-series': async p => { await p.click('button[data-act=start]'); await p.click('button[data-act=next]');
    for (const i of [0, 1]) { await p.fill(`[data-f=weight][data-i="${i}"]`, '90'); await p.fill(`[data-f=reps][data-i="${i}"]`, '12'); await p.check(`[data-f=done][data-i="${i}"]`); }
    await p.fill('input[type=range]', '8'); await p.check('input[data-f=symptoms][value=no]'); await p.clock.runFor(16000); await scrollTo(p, '.set', 150); },
  '04-progreso': async p => { await p.click('[data-tab=progreso]'); await p.selectOption('select[data-act=pex]', 'prensa'); await p.evaluate(() => scrollTo(0, 0)); },
  '05-plantillas': async p => { await p.click('button[data-act=tpl-open]'); await p.locator('button[data-act=tpl-dup]').first().click(); await p.fill('input[data-t=name]', 'Fuerza 3 días');
    await p.fill('input[data-t=sets][data-n="1"]', '4'); await p.dispatchEvent('input[data-t=sets][data-n="1"]', 'change'); await p.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); }); },
  '06-tus-datos': async p => { await p.evaluate(() => snap('Sesión terminada')); await p.click('[data-tab=ajustes]'); await p.waitForSelector('#snaps .item'); await scrollTo(p, 'h3:Copia de seguridad', 20); }
};
const frameHtml = (W, H, title, sub, shot) => { const capH = Math.round(H * 0.19), m = Math.round(H * 0.03), cardH = H - capH - m, cardW = Math.round(cardH * 440 / 956), r = Math.round(W * 0.05), fs = Math.round(W * 0.075), ss = Math.round(W * 0.036);
  return `<body style="margin:0;width:${W}px;height:${H}px;overflow:hidden;background:radial-gradient(120% 80% at 50% 0%,#17414a 0%,#0f1720 62%);font-family:Inter,system-ui,sans-serif;color:#fff;position:relative">
    <div style="position:absolute;left:0;right:0;top:${Math.round(capH * 0.12)}px;text-align:center"><div style="font-size:${fs}px;font-weight:800;line-height:1.08;white-space:pre-line">${title}</div><div style="font-size:${ss}px;color:#9fe9dc;margin-top:${Math.round(fs * 0.22)}px">${sub}</div></div>
    <img src="${shot}" style="position:absolute;left:${Math.round((W - cardW) / 2)}px;top:${capH}px;width:${cardW}px;height:${cardH}px;border-radius:${r}px;box-shadow:0 30px 80px rgba(0,0,0,.55);border:${Math.max(3, Math.round(W * 0.004))}px solid rgba(255,255,255,.18);object-fit:cover"></body>`; };
(async () => {
  await new Promise(r => server.listen(0, r)); const base = 'http://localhost:' + server.address().port, browser = await chromium.launch(), shots = {};
  for (const [name] of SCREENS) { shots[name] = 'data:image/png;base64,' + (await capture(browser, base, name, FLOWS[name])).toString('base64'); process.stdout.write('· ' + name + '\n'); }
  const SETS = [['apple-iphone-6.9', 1320, 2868], ['google-phone', 1080, 1920]];
  for (const [dir, W, H] of SETS) {
    fs.mkdirSync(path.join(OUT, 'screenshots', dir), { recursive: true }); const pg = await browser.newPage({ viewport: { width: W, height: H } });
    for (const [name, title, sub] of SCREENS) { await pg.setContent(frameHtml(W, H, title, sub, shots[name])); await pg.waitForTimeout(150); await pg.screenshot({ path: path.join(OUT, 'screenshots', dir, name + '.png') }); }
    await pg.close();
  }
  // Gráfico de función de Google Play (1024×500, sin transparencia)
  fs.mkdirSync(path.join(OUT, 'graphics'), { recursive: true }); const fg = await browser.newPage({ viewport: { width: 1024, height: 500 } }); const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'icon-512.png')).toString('base64');
  await fg.setContent(`<body style="margin:0;width:1024px;height:500px;overflow:hidden;background:radial-gradient(90% 120% at 15% 20%,#17414a 0%,#0f1720 70%);font-family:Inter,system-ui,sans-serif;color:#fff;position:relative">
    <img src="${icon}" style="position:absolute;left:70px;top:90px;width:130px;height:130px;border-radius:30px"><div style="position:absolute;left:70px;top:245px;font-size:84px;font-weight:800">Personal T</div>
    <div style="position:absolute;left:72px;top:350px;font-size:34px;color:#9fe9dc;line-height:1.25">Entrenamiento guiado,<br>un ejercicio a la vez</div>
    <img src="${shots['02-un-ejercicio-a-la-vez']}" style="position:absolute;left:640px;top:50px;width:300px;height:652px;border-radius:34px;border:4px solid rgba(255,255,255,.2);box-shadow:0 20px 60px rgba(0,0,0,.5);object-fit:cover"></body>`);
  await fg.waitForTimeout(150); await fg.screenshot({ path: path.join(OUT, 'graphics', 'feature-graphic-1024x500.jpg'), type: 'jpeg', quality: 92 }); /* graphics/icon-512.png es estático (PNG de 32 bits con alfa, exigido por Google Play): no se regenera aquí. */
  await browser.close(); server.close(); console.log('✔ listo en store/');
})().catch(e => { console.error('✖', e.message); process.exit(1); });

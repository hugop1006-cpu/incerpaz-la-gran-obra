// Prueba automática: un robot juega cada nivel hasta la meta (y al jefe). Uso: npm i playwright && node tools/probar-niveles.js [nivel...]
const { chromium } = require('playwright');
const levels = process.argv.slice(2).map(Number);
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 960, height: 544 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('incerpaz_muted', '1'); } catch (e) {} });
  const pg = await ctx.newPage();
  const logs = [];
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  await pg.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
  await pg.addScriptTag({ path: __dirname + '/bot-lib.js' });
  await pg.evaluate(() => { window.INCERPAZ.manual = true; });
  for (const i of (levels.length ? levels : [0, 1, 2, 3, 4])) {
    await pg.evaluate(i => window.BOT.start(i), i);
    let res, total = 0, lastLog = '';
    while (total < 60 * 400) {
      res = await pg.evaluate(() => window.BOT.step(300));
      total += 300;
      if (process.env.VERBOSE) console.log(JSON.stringify(res));
      if (res.done || res.over) break;
    }
    console.log(`Nivel ${i + 1}:`, JSON.stringify(res), 'seg=', (total / 60).toFixed(0));
    if (process.env.SHOT) await pg.screenshot({ path: `lvl${i + 1}.png` });
  }
  console.log(logs.join('\n') || 'consola limpia');
  await b.close();
})();

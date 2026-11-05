// Prueba automática del minijuego Torre de Ladrillos. Uso: npm i playwright && node tools/probar-tetris.js
const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const pg = await (await b.newContext({ viewport: { width: 960, height: 544 } })).newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('incerpaz_muted', '1'); } catch (e) {} });
  await pg.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
  await pg.evaluate(() => { INCERPAZ.manual = true; INCERPAZ.setState('select'); });
  const step = n => pg.evaluate(n => { for (let i = 0; i < n; i++) INCERPAZ.update(1 / 60); INCERPAZ.render(); }, n);
  const key = async k => { await pg.keyboard.down(k); await step(1); await pg.keyboard.up(k); await step(1); };

  await key('KeyT'); assert.equal(await pg.evaluate(() => INCERPAZ.G.state), 'tetris', 'T abre el minijuego');
  await step(160);
  assert.equal(await pg.evaluate(() => Tetris._s().phase), 'play', 'termina la cuenta atrás');

  // línea completa: I horizontal en hueco de 4
  let r = await pg.evaluate(() => {
    const S = Tetris._s(); S.board = Array.from({ length: 22 }, () => new Array(10).fill(0));
    for (let x = 0; x < 10; x++) if (x < 3 || x > 6) S.board[21][x] = 3;
    S.cur = { type: 1, rot: 0, x: 3, y: 10 }; S.lockT = 0;
    return S.lines;
  });
  await key('Space'); await step(40);
  assert.equal(await pg.evaluate(() => Tetris._s().lines), r + 1, 'borra 1 línea');
  assert.ok(await pg.evaluate(() => Tetris._s().board[21].every(v => !v)), 'la fila queda vacía');

  // demolición: borra 3x3 y los escombros caen
  await pg.evaluate(() => {
    const S = Tetris._s(); S.board = Array.from({ length: 22 }, () => new Array(10).fill(0));
    for (let y = 18; y < 22; y++) for (let x = 0; x < 9; x++) S.board[y][x] = 3;
    S.cur = { type: 8, rot: 0, x: 4, y: 2 }; S.lockT = 0;
  });
  await key('Space'); await step(40);
  assert.equal(await pg.evaluate(() => Tetris._s().stats.bombs), 1, 'la bomba explota');

  // guardar pieza
  const h0 = await pg.evaluate(() => Tetris._s().hold);
  await key('KeyC');
  assert.notEqual(await pg.evaluate(() => Tetris._s().hold), h0 || -1, 'guarda la pieza');

  // pausa y reanudar
  await key('KeyP'); assert.equal(await pg.evaluate(() => Tetris._s().phase), 'paused');
  await key('KeyP'); assert.equal(await pg.evaluate(() => Tetris._s().phase), 'play');

  // fin de partida y récord guardado
  await pg.evaluate(() => { const S = Tetris._s(); for (let y = 2; y < 22; y++) for (let x = 0; x < 9; x++) S.board[y][x] = 5; S.board[0][4] = 3; S.board[1][4] = 3; S.cur.y = 0; S.score = 777; });
  await key('Space'); await step(70);
  assert.equal(await pg.evaluate(() => Tetris._s().phase), 'over');
  assert.equal(await pg.evaluate(() => INCERPAZ.Save.data.tetris.hi), 777, 'guarda el récord');
  await pg.evaluate(() => Tetris.action('quit'));
  assert.equal(await pg.evaluate(() => INCERPAZ.G.state), 'select', 'vuelve al menú');
  assert.deepEqual(errs, [], 'sin errores en consola');
  console.log('Torre de Ladrillos: todo OK');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

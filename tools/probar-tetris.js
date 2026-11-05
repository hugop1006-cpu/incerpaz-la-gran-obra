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
  assert.equal(await pg.evaluate(() => Tetris._s()), null, 'primero el menú de modos');
  await key('Enter'); await step(160);
  assert.equal(await pg.evaluate(() => Tetris._s().mode), 'classic');
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

  // T-spin: T encajada en un hueco con 3 esquinas ocupadas, tras girar
  await pg.evaluate(() => {
    const S = Tetris._s(); S.board = Array.from({ length: 22 }, () => new Array(10).fill(0));
    for (let x = 0; x < 10; x++) if (x !== 4) S.board[21][x] = 3;   // fila 21 con un solo hueco (col 4)
    S.board[19][3] = 3;                                            // saliente: 3ª esquina del T-spin
    S.cur = { type: 3, rot: 2, x: 3, y: 19 }; S.lastRot = true; S.lockT = 0; S.fall = 0;
  });
  const ts0 = await pg.evaluate(() => Tetris._s().score);
  await pg.evaluate(() => { const S = Tetris._s(); S.lastRot = true; Tetris._hooks.lockPiece(); });
  assert.equal(await pg.evaluate(() => Tetris._s().score) - ts0, 800, 'T-spin sencillo = 800');
  await step(40);
  // gestos táctiles (con el ratón): tocar gira, arrastrar mueve, deslizón abajo cae
  await pg.evaluate(() => { const S = Tetris._s(); S.board = Array.from({ length: 22 }, () => new Array(10).fill(0)); S.cur = { type: 3, rot: 0, x: 3, y: 4 }; S.lockT = 0; S.fall = 0; });
  const box = await pg.evaluate(() => { const r = document.getElementById('game').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const px = (vx, vy) => [box.x + vx * box.w / 480, box.y + vy * box.h / 272];
  let [ax, ay] = px(240, 120);
  await pg.mouse.move(ax, ay); await pg.mouse.down(); await pg.mouse.up(); await step(2);
  assert.equal(await pg.evaluate(() => Tetris._s().cur.rot), 1, 'tocar gira la pieza');
  const x0 = await pg.evaluate(() => Tetris._s().cur.x);
  await pg.mouse.move(ax, ay); await pg.mouse.down(); await pg.mouse.move(...px(240 + 30, 120), { steps: 4 }); await pg.mouse.up(); await step(2);
  assert.ok(await pg.evaluate(() => Tetris._s().cur.x) > x0, 'arrastrar a la derecha mueve la pieza');
  const pcs = await pg.evaluate(() => Tetris._s().stats.pieces);
  await pg.mouse.move(ax, ay); await pg.mouse.down(); await pg.mouse.move(...px(240, 120 + 70), { steps: 3 }); await pg.mouse.up(); await step(3);
  assert.ok(await pg.evaluate(() => Tetris._s().stats.pieces) > pcs, 'deslizón rápido hacia abajo suelta la pieza');
  await step(40);
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

  // Sprint: gana al llegar a 40 líneas y guarda el mejor tiempo
  await key('KeyT'); await key('ArrowDown'); await key('Enter'); await step(160);
  assert.equal(await pg.evaluate(() => Tetris._s().mode), 'sprint');
  await pg.evaluate(() => {
    const S = Tetris._s(); S.lines = 39; S.time = 61.5; S.board = Array.from({ length: 22 }, () => new Array(10).fill(0));
    for (let x = 0; x < 10; x++) if (x < 3 || x > 6) S.board[21][x] = 3;
    S.cur = { type: 1, rot: 0, x: 3, y: 10 }; S.lockT = 0;
  });
  await key('Space'); await step(40);
  assert.equal(await pg.evaluate(() => Tetris._s().won), true, 'sprint ganado');
  assert.ok(await pg.evaluate(() => INCERPAZ.Save.data.tetris.sprint) > 61, 'guarda el mejor tiempo');
  await pg.evaluate(() => Tetris.action('quit'));

  // Escombros: sube una fila cada 8 piezas
  await key('KeyT'); await key('ArrowDown'); await key('ArrowDown'); await key('Enter'); await step(160);
  assert.equal(await pg.evaluate(() => Tetris._s().mode), 'escombros');
  for (let i = 0; i < 9; i++) { await key('Space'); await step(2); if (await pg.evaluate(() => Tetris._s().phase) === 'over') break; }
  assert.ok(await pg.evaluate(() => Tetris._s().board[21].filter(v => v === 7).length) >= 1 || await pg.evaluate(() => Tetris._s().phase) === 'over', 'aparecen escombros');
  assert.deepEqual(errs, [], 'sin errores en consola');
  console.log('Torre de Ladrillos: todo OK');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

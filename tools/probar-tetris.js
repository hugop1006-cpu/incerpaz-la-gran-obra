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
  // poderes (barra compartida; E cambia de poder, V lo usa)
  const resetBoard = () => pg.evaluate(() => { const S = Tetris._s(); S.board = Array.from({ length: 22 }, () => new Array(10).fill(0)); S.cur = { type: 2, rot: 0, x: 3, y: 2 }; S.lockT = 0; S.slowT = 0; S.sel = 0; return 1; });
  await resetBoard();
  await pg.evaluate(() => { Tetris._s().power = 3; });
  await key('KeyV'); assert.equal(await pg.evaluate(() => Tetris._s().slowT), 0, 'sin carga suficiente no hace nada');
  await pg.evaluate(() => { Tetris._s().power = 5; });
  await key('KeyV'); assert.ok(await pg.evaluate(() => Tetris._s().slowT) > 7, 'FRENO activa la caída lenta');
  assert.equal(await pg.evaluate(() => Tetris._s().power), 1, 'FRENO gasta 4');
  // cemento: rellena el hueco tapado y completa la fila
  await resetBoard();
  await pg.evaluate(() => { const S = Tetris._s(); for (let x = 0; x < 10; x++) { S.board[21][x] = x === 4 ? 0 : 3; S.board[20][x] = 3; } S.power = 10; });
  await key('KeyE'); assert.equal(await pg.evaluate(() => Tetris._s().sel), 1);
  const ln = await pg.evaluate(() => Tetris._s().lines);
  await key('KeyV'); await step(40);
  assert.ok(await pg.evaluate(() => Tetris._s().lines) > ln, 'CEMENTO rellena el hueco y borra líneas');
  assert.equal(await pg.evaluate(() => Tetris._s().power), 5, 'CEMENTO gasta 7 y las 2 líneas cargan +2');
  // nivelador: aplana 2 filas
  await resetBoard();
  await pg.evaluate(() => { const S = Tetris._s(); for (let y = 18; y < 22; y++) for (let x = 0; x < 9; x++) S.board[y][x] = 3; S.power = 9; S.sel = 2; });
  await key('KeyV'); assert.equal(await pg.evaluate(() => Tetris._s().board.flat().filter(v => v).length), 36, 'sin carga suficiente no hace nada');
  await pg.evaluate(() => { Tetris._s().power = 10; });
  await key('KeyV'); assert.equal(await pg.evaluate(() => Tetris._s().board.flat().filter(v => v).length), 18, 'NIVELADORA borra 2 filas');
  assert.equal(await pg.evaluate(() => Tetris._s().power), 0);
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
  await pg.evaluate(() => Tetris.action('quit'));

  // Bloque macizo: una fila llena con macizo NO se borra; la demolición lo rompe
  await key('KeyT'); for (let i = 0; i < 2; i++) await key('ArrowDown'); await key('Enter'); await step(160); // ESCOMBROS
  await pg.evaluate(() => {
    const S = Tetris._s(); S.board = Array.from({ length: 22 }, () => new Array(10).fill(0));
    for (let x = 0; x < 10; x++) if (x < 4 || x > 5) S.board[21][x] = 3;
    S.board[21][0] = 9;                                   // macizo en la fila
    S.cur = { type: 2, rot: 0, x: 3, y: 10 }; S.lockT = 0;
  });
  const lc = await pg.evaluate(() => Tetris._s().lines);
  await key('Space'); await step(40);
  assert.equal(await pg.evaluate(() => Tetris._s().lines), lc, 'fila llena con macizo no se borra');
  assert.ok(await pg.evaluate(() => Tetris._s().board[21].includes(9)), 'el macizo sigue ahí');
  await pg.evaluate(() => { const S = Tetris._s(); S.cur = { type: 8, rot: 0, x: 1, y: 10 }; S.lockT = 0; });
  await key('Space'); await step(40);
  assert.ok(await pg.evaluate(() => !Tetris._s().board.some(r => r.includes(9))), 'la demolición rompe el macizo');
  // los escombros traen un macizo cada 3 filas
  const got = await pg.evaluate(() => { const S = Tetris._s(); S.board = Array.from({ length: 22 }, () => new Array(10).fill(0)); S.cc = 0; for (let i = 0; i < 3; i++) Tetris._hooks.addRubble(); return S.board.flat().filter(v => v === 9).length; });
  assert.equal(got, 1, 'la 3ª fila de escombros trae un macizo');
  await pg.evaluate(() => Tetris.action('quit'));

  // Misiones: menú de etapas, completar la 1ª, desbloquear la 2ª
  await key('KeyT'); await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown'); await key('Enter');
  await key('ArrowDown'); await key('Enter'); // la 2ª está bloqueada: no arranca
  assert.equal(await pg.evaluate(() => Tetris._s()), null, 'misión bloqueada no arranca');
  await key('ArrowUp'); await key('Enter'); await step(160);
  assert.equal(await pg.evaluate(() => Tetris._s().mis.name), 'CIMIENTOS');
  assert.equal(await pg.evaluate(() => Tetris._s().cement), false, 'la misión 1 no tiene macizos');
  await pg.evaluate(() => {
    const S = Tetris._s(); S.lines = 9; S.board = Array.from({ length: 22 }, () => new Array(10).fill(0));
    for (let x = 0; x < 10; x++) if (x < 3 || x > 6) S.board[21][x] = 3;
    S.cur = { type: 1, rot: 0, x: 3, y: 10 }; S.lockT = 0;
  });
  await key('Space'); await step(40);
  assert.equal(await pg.evaluate(() => Tetris._s().won), true, 'misión 1 cumplida');
  assert.equal(await pg.evaluate(() => INCERPAZ.Save.data.tetris.mis), 1, 'desbloquea la siguiente');
  await pg.evaluate(() => Tetris.action('next')); await step(160);
  assert.equal(await pg.evaluate(() => Tetris._s().mis.name), 'MUROS', 'pasa a la misión 2');
  assert.equal(await pg.evaluate(() => Tetris._s().level), 2);
  await pg.evaluate(() => { INCERPAZ.Save.data.tetris.mis = 4; Tetris.action('quit'); });
  await key('KeyT'); await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown'); await key('Enter');
  await key('Enter'); await step(160);
  assert.equal(await pg.evaluate(() => Tetris._s().mis.kind), 'survive');
  await pg.evaluate(() => { Tetris._s().time = 74.95; }); await step(10);
  assert.equal(await pg.evaluate(() => Tetris._s().won), true, 'sobrevivir 75 s cumple la misión');
  assert.equal(await pg.evaluate(() => INCERPAZ.Save.data.tetris.mis), 5);
  await pg.evaluate(() => Tetris.action('quit'));

  // Versus 2 jugadores: cada uno con sus teclas y la basura pasa de un tablero al otro
  await key('KeyT'); for (let i = 0; i < 4; i++) await key('ArrowDown'); await key('Enter'); // VERSUS
  await key('Enter'); await step(160);                                                        // 2 JUGADORES
  assert.equal(await pg.evaluate(() => Tetris._vs().mode), 'vs2');
  assert.equal(await pg.evaluate(() => Tetris._vs().p[0].stats.pieces + Tetris._vs().p[1].stats.pieces), 2, 'cada jugador recibe su pieza');
  const seq = await pg.evaluate(() => Tetris._vs().p.map(P => P.cur.type));
  assert.equal(seq[0], seq[1], 'misma primera pieza para los dos');
  const x1 = await pg.evaluate(() => Tetris._vs().p.map(P => P.cur.x));
  await pg.keyboard.down('KeyA'); await step(2); await pg.keyboard.up('KeyA');
  await pg.keyboard.down('ArrowRight'); await step(2); await pg.keyboard.up('ArrowRight');
  const x2 = await pg.evaluate(() => Tetris._vs().p.map(P => P.cur.x));
  assert.ok(x2[0] < x1[0] && x2[1] > x1[1], 'J1 con A y J2 con flechas se mueven por separado');
  await pg.evaluate(() => {
    const [a] = Tetris._vs().p; a.board = Array.from({ length: 22 }, () => new Array(10).fill(0));
    for (const y of [20, 21]) for (let x = 0; x < 10; x++) if (x < 4 || x > 5) a.board[y][x] = 3;   // hueco de 2 de ancho
    a.cur = { type: 2, rot: 0, x: 3, y: 10 }; a.lockT = 0;                                          // la O cae justo ahí
  });
  await key('Space'); await step(2);
  assert.ok(await pg.evaluate(() => Tetris._vs().p[0].lines) >= 1, 'J1 borra líneas con ESPACIO');
  await step(40);
  assert.ok(await pg.evaluate(() => Tetris._vs().p[1].garb + Tetris._vs().p[1].board.flat().filter(v => v === 7).length) > 0, 'una doble de J1 manda basura a J2');
  await key('Enter'); await step(2); // J2 suelta con ENTER
  await pg.evaluate(() => Tetris.action('quit'));

  // Versus CPU: la CPU juega sola, borra líneas y J1 pierde si no hace nada
  await key('KeyT'); for (let i = 0; i < 4; i++) await key('ArrowDown'); await key('Enter');
  await key('ArrowDown'); await key('ArrowDown'); await key('Enter'); await step(160);   // CPU NORMAL
  assert.equal(await pg.evaluate(() => Tetris._vs().p[1].cpu), true);
  assert.equal(await pg.evaluate(() => Tetris._vs().diff), 1);
  let st = null;
  for (let k = 0; k < 40 && !st; k++) { await step(180); st = await pg.evaluate(() => { const v = Tetris._vs(); return v.phase === 'over' ? { w: v.winner, l: v.p[1].lines } : null; }); }
  const cpuLines = await pg.evaluate(() => Tetris._vs().p[1].lines);
  assert.ok(cpuLines >= 3, 'la CPU borra líneas por sí sola (' + cpuLines + ')');
  assert.ok(st, 'termina la partida');
  await pg.evaluate(() => Tetris.action('quit'));
  assert.equal(await pg.evaluate(() => INCERPAZ.G.state), 'select');
  // Menús del minijuego con toques/clics reales sobre los botones (no solo con el teclado)
  const clickAct = async act => {
    const p = await pg.evaluate(act => { const c = document.getElementById('game'), r = c.getBoundingClientRect(), bt = INCERPAZ.G.buttons.find(x => x.action === act); return bt ? [r.left + (bt.x + bt.w / 2) * r.width / c.width, r.top + (bt.y + bt.h / 2) * r.height / c.height] : null; }, act);
    assert.ok(p, 'no hay botón ' + act);
    await pg.mouse.click(p[0], p[1]); await step(3);
  };
  await pg.evaluate(() => { INCERPAZ.setState('select'); }); await step(2);
  await clickAct('mini'); assert.equal(await pg.evaluate(() => INCERPAZ.G.state), 'tetris', 'el botón MINIJUEGO abre el minijuego');
  await clickAct('mode0'); await step(160);
  assert.equal(await pg.evaluate(() => Tetris._s() && Tetris._s().mode), 'classic', 'tocar CLÁSICO empieza la partida');
  await pg.evaluate(() => Tetris.action('quit')); await step(3);
  await clickAct('mini'); await clickAct('mode3');                                   // MISIONES -> lista
  await clickAct('mode0'); await step(160);
  assert.equal(await pg.evaluate(() => Tetris._s() && Tetris._s().mis && Tetris._s().mis.name), 'CIMIENTOS', 'tocar una misión la empieza');
  await pg.evaluate(() => Tetris.action('quit')); await step(3);
  await clickAct('mini'); await clickAct('mode4'); await clickAct('mode2'); await step(160); // VERSUS -> CPU NORMAL
  assert.equal(await pg.evaluate(() => Tetris._vs() && Tetris._vs().diff), 1, 'tocar CPU NORMAL empieza el versus');
  await pg.evaluate(() => Tetris.action('quit')); await step(3);
  await clickAct('mini'); await clickAct('quit');                                    // VOLVER sale del minijuego
  assert.equal(await pg.evaluate(() => INCERPAZ.G.state), 'select', 'VOLVER regresa al menú de etapas');
  assert.deepEqual(errs, [], 'sin errores en consola');
  console.log('Torre de Ladrillos: todo OK');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

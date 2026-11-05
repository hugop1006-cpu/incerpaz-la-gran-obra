/* INCERPAZ: La Gran Obra — minijuego "TORRE DE LADRILLOS" (Tetris con tema de obra).
   Módulo independiente: game.js le pasa el contexto de dibujo y las entradas con Tetris.init(env).
   - Núcleo: tablero 10x20, bolsa de 7, rotación SRS con patadas, hold, pieza fantasma, bloqueo con retardo, DAS/ARR.
   - Mejoras de obra: la CASA se levanta con las líneas (y cambia el fondo por etapa) y la pieza DEMOLICIÓN
     (bomba 3x3 que aparece cada cierto número de líneas y deja caer los escombros). */
(() => {
  'use strict';
  const COLS = 10, ROWS = 22, HID = 2;           // 2 filas ocultas arriba
  const NAMES = ['', 'VIGA', 'BLOQUE', 'LADRILLO', 'CEMENTO', 'TEJA', 'TABLÓN', 'LOSA', 'DEMOLICIÓN'];
  // Formas (estado 0) en cajas SRS; y = hacia abajo
  const SHAPES = {
    1: { n: 4, c: [[0, 1], [1, 1], [2, 1], [3, 1]] },   // I
    2: { n: 4, c: [[1, 0], [2, 0], [1, 1], [2, 1]] },   // O
    3: { n: 3, c: [[1, 0], [0, 1], [1, 1], [2, 1]] },   // T
    4: { n: 3, c: [[1, 0], [2, 0], [0, 1], [1, 1]] },   // S
    5: { n: 3, c: [[0, 0], [1, 0], [1, 1], [2, 1]] },   // Z
    6: { n: 3, c: [[0, 0], [0, 1], [1, 1], [2, 1]] },   // J
    7: { n: 3, c: [[2, 0], [0, 1], [1, 1], [2, 1]] },   // L
    8: { n: 1, c: [[0, 0]] }                             // demolición
  };
  const ROT = {}; // ROT[tipo][estado] = celdas
  for (const t in SHAPES) {
    const { n, c } = SHAPES[t]; ROT[t] = [c];
    for (let r = 1; r < 4; r++) ROT[t][r] = ROT[t][r - 1].map(([x, y]) => [n - 1 - y, x]);
  }
  // Patadas SRS (x, y con y hacia arriba) → se invierte y al aplicar
  const K_JLSTZ = {
    '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],     '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],    '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
  };
  const K_I = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],   '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],   '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],   '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],   '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
  };

  // Materiales de obra: colores (base, luz, sombra) tomados de la marca
  const MAT = {
    1: ['#1d9bd1', '#7fd6f6', '#0e6a94'],   // viga de acero
    2: ['#f0c928', '#fff08a', '#c99a06'],   // bloque de cerámica
    3: ['#a31621', '#e0555a', '#6b0d15'],   // ladrillo
    4: ['#46c15a', '#9be8a6', '#2a8a3a'],   // cemento fresco
    5: ['#e8892b', '#ffc27a', '#a85a12'],   // teja
    6: ['#a9693a', '#dca06a', '#6e4223'],   // tablón
    7: ['#9aa0a8', '#dfe3e8', '#62676f'],   // losa de cemento
    8: ['#2b2b33', '#6a6a78', '#111116']    // demolición
  };

  const GRAV = lv => Math.pow(0.8 - (Math.min(lv, 15) - 1) * 0.007, Math.min(lv, 15) - 1); // seg por fila
  const DAS = 0.16, ARR = 0.04, SOFT = 0.035, LOCK_DELAY = 0.5, LOCK_RESETS = 15, CLEAR_T = 0.4, READY_T = 2.4;
  const BOMB_EVERY = 8;       // cada cuántas líneas llega una pieza DEMOLICIÓN
  const POWER_MAX = 10;       // carga de la NIVELADORA (líneas + extras de combo/Tetris)
  const HOUSE_LINES = 8;      // líneas por etapa de la casa (5 etapas = 40 líneas)

  const MODES = [
    { id: 'classic', name: 'CLÁSICO', desc: 'SIN FIN · CASA Y DEMOLICIÓN' },
    { id: 'sprint', name: 'SPRINT 40', desc: '40 LÍNEAS EN EL MENOR TIEMPO' },
    { id: 'escombros', name: 'ESCOMBROS', desc: 'SUBEN FILAS DE ESCOMBROS' }
  ];
  const SPRINT_LINES = 40, RUBBLE_EVERY = 8; // piezas entre filas de escombros
  let cellPx = 12;            // tamaño de celda del último dibujo (para los gestos)
  let G0 = null;              // gesto táctil en curso
  let M = null;               // menú de modos {cursor}
  let env = null;             // {ctx, C, B, Font, Art, Snd, Save, pressed, held, txt, panel, button, quit()}
  let S = null;               // partida en curso
  const cellCache = new Map();

  /* ===================== Núcleo ===================== */
  function newBag() {
    const a = [1, 2, 3, 4, 5, 6, 7];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function fillQueue() { while (S.queue.length < 6) S.queue.push(...newBag()); }
  function emptyBoard() { return Array.from({ length: ROWS }, () => new Array(COLS).fill(0)); }

  function start(mode) {
    mode = mode || (S && S.mode) || 'classic'; M = null;
    S = {
      mode, rb: 0, power: 0, sel: 0, slowT: 0, time: 0, sprintDone: false, won: false, lastRot: false,
      board: emptyBoard(), queue: [], cur: null, hold: 0, holdUsed: false,
      score: 0, lines: 0, level: 1, combo: -1, b2b: false, bombCharge: 0, bombsUsed: 0,
      phase: 'ready', t: 0, phaseT: 0, fall: 0, lockT: 0, lockResets: 0, lowest: 0,
      dasDir: 0, dasT: 0, softT: 0,
      clearRows: [], flash: [], particles: [], popups: [], shake: 0, banner: null, houseDone: false,
      newRecord: false, stats: { pieces: 0, tetrises: 0, bombs: 0 }
    };
    fillQueue();
    env.Snd.music('tet');
  }
  const stage = () => Math.min(5, Math.floor(S.lines / HOUSE_LINES));

  function cells(p) { return ROT[p.type][p.rot].map(([x, y]) => [p.x + x, p.y + y]); }
  function fits(p) {
    return cells(p).every(([x, y]) => x >= 0 && x < COLS && y < ROWS && (y < 0 || !S.board[y][x]));
  }
  function spawn(type) {
    const t = type || S.queue.shift();
    fillQueue();
    S.cur = { type: t, rot: 0, x: t === 8 ? 4 : 3, y: 0 };
    S.holdUsed = false; S.fall = 0; S.lockT = 0; S.lockResets = 0; S.lowest = S.cur.y;
    S.stats.pieces++;
    if (!fits(S.cur)) { S.cur.y = -1; if (!fits(S.cur)) return gameOver(); }
    // baja una fila de inmediato si cabe (como en el Tetris oficial)
    const q = { ...S.cur, y: S.cur.y + 1 }; if (fits(q)) S.cur = q;
  }
  function ghostY() { const p = { ...S.cur }; while (fits({ ...p, y: p.y + 1 })) p.y++; return p.y; }
  const grounded = () => !fits({ ...S.cur, y: S.cur.y + 1 });

  function tryMove(dx, dy) {
    const p = { ...S.cur, x: S.cur.x + dx, y: S.cur.y + dy };
    if (!fits(p)) return false;
    S.cur = p; S.lastRot = false;
    if (dy > 0 && p.y > S.lowest) { S.lowest = p.y; S.lockResets = 0; }
    bumpLock();
    return true;
  }
  function bumpLock() { if (grounded() && S.lockResets < LOCK_RESETS) { S.lockT = 0; S.lockResets++; } }
  function rotate(dir) {
    const p = S.cur; if (p.type === 2 || p.type === 8) return false;
    const to = (p.rot + dir + 4) % 4, kicks = (p.type === 1 ? K_I : K_JLSTZ)[p.rot + '>' + to];
    for (const [kx, ky] of kicks) {
      const q = { ...p, rot: to, x: p.x + kx, y: p.y - ky };
      if (fits(q)) { S.cur = q; S.lastRot = true; bumpLock(); env.Snd.play('trot'); return true; }
    }
    return false;
  }
  function doHold() {
    if (S.holdUsed || S.cur.type === 8) { env.Snd.play('no'); return; }
    const t = S.cur.type, h = S.hold; S.hold = t;
    env.Snd.play('thold');
    if (h) spawn(h); else spawn();
    S.holdUsed = true;
  }

  function burst(x, y, color, n = 6, sp = 70) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, v = sp * (0.4 + Math.random());
      S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.5 + Math.random() * 0.4, t: 0, c: color });
    }
  }
  function popup(text, color, big) { S.popups.push({ text, color, t: 0, big }); }

  function lockPiece() {
    const p = S.cur, cs = cells(p);
    S.tspin = false;
    if (cs.every(([, y]) => y < HID) && p.type !== 8) return gameOver(); // bloqueo fuera de vista
    if (p.type === 8) return explode(cs[0][0], cs[0][1]);
    if (p.type === 3 && S.lastRot) { // 3 de las 4 esquinas alrededor del centro ocupadas = T-spin
      const occ = (x, y) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && S.board[y][x]);
      const k = [[0, 0], [2, 0], [0, 2], [2, 2]].filter(([dx, dy]) => occ(p.x + dx, p.y + dy)).length;
      S.tspin = k >= 3;
    }
    cs.forEach(([x, y]) => { if (y >= 0) S.board[y][x] = p.type; });
    env.Snd.play('tlock');
    S.shake = Math.max(S.shake, 0.06);
    afterLock();
  }
  function fullRows() {
    const r = [];
    for (let y = 0; y < ROWS; y++) if (S.board[y].every(v => v)) r.push(y);
    return r;
  }
  function afterLock() {
    S.cur = null;
    const rows = fullRows();
    if (!rows.length) {
      S.combo = -1;
      if (S.tspin) { S.score += 400 * S.level; popup('T-SPIN +' + 400 * S.level, env.B.accent); env.Snd.play('tline2'); }
      return nextPiece();
    }
    clearLines(rows);
  }
  function clearLines(rows) {
    const n = rows.length;
    S.combo++;
    const ts = !!S.tspin;
    let pts = (ts ? [0, 800, 1200, 1600, 1600] : [0, 100, 300, 500, 800])[Math.min(4, n)] * S.level;
    const tet = n >= 4 || ts;
    if (tet) { if (S.b2b) pts = Math.floor(pts * 1.5); S.b2b = true; S.stats.tetrises++; } else S.b2b = false;
    S.tspin = false;
    if (S.mode === 'sprint' && S.lines + n >= SPRINT_LINES) S.sprintDone = true;
    pts += S.combo > 0 ? 50 * S.combo * S.level : 0;
    S.score += pts;
    const oldLines = S.lines;
    S.lines += n;
    S.bombCharge += n;
    const pw0 = S.power; S.power = Math.min(POWER_MAX, S.power + n + (tet ? 2 : 0) + (S.combo > 0 ? 1 : 0));
    if (pw0 < POWER_MAX && S.power >= POWER_MAX) popup('¡CARGA AL MÁXIMO!', env.B.good);
    const lvOld = S.level; S.level = Math.min(15, 1 + Math.floor(S.lines / 10));
    S.clearRows = rows; S.phase = 'clearing'; S.phaseT = 0;
    rows.forEach(y => { for (let x = 0; x < COLS; x++) { burst(x, y, MAT[S.board[y][x]][0], 1, 90); } });
    popup(ts ? 'T-SPIN ' + ['', 'LÍNEA', 'DOBLE', 'TRIPLE'][Math.min(3, n)] + ' +' + pts : (tet ? '¡TETRIS! +' + pts : (['', 'LÍNEA', 'DOBLE', 'TRIPLE'][n] + ' +' + pts)), tet ? env.B.secondary : env.B.light, tet);
    if (S.combo > 0) popup('COMBO x' + S.combo, env.B.secondaryLight);
    if (S.b2b && tet && S.stats.tetrises > 1) popup('SEGUIDO ×1.5', env.B.good);
    env.Snd.play(tet ? 'ttetris' : (n >= 2 ? 'tline2' : 'tline'));
    if (tet) S.shake = 0.35; else S.shake = Math.max(S.shake, 0.1);
    if (S.level > lvOld) { popup('NIVEL ' + S.level, env.B.accent); env.Snd.tempo(1 + (S.level - 1) * 0.035); }
    if (stage() > Math.floor(oldLines / HOUSE_LINES) && stage() < 5) popup('¡ETAPA ' + (stage() + 1) + '!', env.B.good);
    if (stage() >= 5 && !S.houseDone) { S.houseDone = true; S.score += 5000; S.banner = { text: '¡OBRA TERMINADA!', sub: '+5000 · SIGUE CONSTRUYENDO', t: 3.2 }; env.Snd.play('clear'); }
  }
  function finishClear() {
    const rows = S.clearRows.slice().sort((a, b) => a - b);
    rows.forEach(y => { S.board.splice(y, 1); S.board.unshift(new Array(COLS).fill(0)); });
    S.clearRows = [];
    S.phase = 'play';
    if (S.sprintDone) return win();
    nextPiece();
  }
  function explode(cx, cy) {
    S.stats.bombs++;
    let removed = 0;
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
      if (S.board[y][x]) { burst(x, y, MAT[S.board[y][x]][0], 3, 110); removed++; }
      S.board[y][x] = 0;
    }
    for (let i = 0; i < 14; i++) burst(cx, cy, i % 2 ? '#ffb02e' : '#fff6e8', 1, 150);
    S.score += removed * 50 * S.level;
    popup('¡DEMOLICIÓN! +' + removed * 50 * S.level, env.B.danger, true);
    S.shake = 0.5; env.Snd.play('boom');
    // los escombros caen por columnas
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (x < 0 || x >= COLS) continue;
      const col = []; for (let y = ROWS - 1; y >= 0; y--) if (S.board[y][x]) col.push(S.board[y][x]);
      for (let y = ROWS - 1; y >= 0; y--) S.board[y][x] = col[ROWS - 1 - y] || 0;
    }
    S.cur = null;
    const rows = fullRows();
    if (rows.length) clearLines(rows); else { S.combo = -1; nextPiece(); }
  }
  const POWERS = [
    { name: 'FRENO', cost: 4 },      // la caída va 3 veces más lenta durante 8 s
    { name: 'CEMENTO', cost: 7 },    // rellena los huecos tapados de las 6 filas de abajo
    { name: 'NIVELADORA', cost: 10 } // aplana las 2 filas de abajo
  ];
  const FREEZE_T = 8;
  function cyclePower(d) { S.sel = (S.sel + (d || 1) + POWERS.length) % POWERS.length; env.Snd.play('select'); }
  function usePower() {
    if (!S.cur || S.phase !== 'play') return;
    const P = POWERS[S.sel];
    if (S.power < P.cost) { env.Snd.play('no'); return; }
    if (S.sel === 0) {
      S.slowT = FREEZE_T; popup('¡FRENO!', env.B.accent, true); env.Snd.play('wall');
    } else if (S.sel === 1) {
      let n = 0;
      for (let x = 0; x < COLS; x++) {
        let covered = false;
        for (let y = 0; y < ROWS; y++) {
          if (S.board[y][x]) covered = true;
          else if (covered && y >= ROWS - 6) { S.board[y][x] = 4; n++; burst(x, y, MAT[4][1], 2, 60); }
        }
      }
      if (!n) { env.Snd.play('no'); return; }
      S.power -= P.cost; S.score += n * 20 * S.level; popup('¡CEMENTO! +' + n * 20 * S.level, env.B.good, true); env.Snd.play('seal');
      const rows = fullRows();
      if (rows.length) { S.queue.unshift(S.cur.type); S.cur = null; S.tspin = false; clearLines(rows); }
      return;
    } else {
      for (let k = 0; k < 2; k++) { const row = S.board[ROWS - 1 - k]; for (let x = 0; x < COLS; x++) if (row[x]) burst(x, ROWS - 1 - k, MAT[row[x]][1], 2, 100); }
      S.board.splice(ROWS - 2, 2); S.board.unshift(new Array(COLS).fill(0), new Array(COLS).fill(0));
      S.score += 200 * S.level; popup('¡NIVELADORA! +' + 200 * S.level, env.B.good, true);
      S.shake = 0.3; env.Snd.play('ttetris'); bumpLock();
    }
    S.power -= P.cost;
  }
  function nextPiece() {
    if (S.phase === 'over') return;
    if (S.mode === 'escombros' && ++S.rb >= RUBBLE_EVERY) { S.rb = 0; if (!addRubble()) return; }
    if (S.bombCharge >= BOMB_EVERY) { // la demolición llega como 3ª pieza para que se vea venir
      S.bombCharge -= BOMB_EVERY; S.queue.splice(2, 0, 8); S.bombsUsed++;
    }
    spawn();
  }
  function addRubble() { // sube una fila de escombros con un hueco; false si la torre desborda
    if (S.board[0].some(v => v) || S.board[1].some(v => v)) { gameOver(); return false; }
    S.board.shift();
    const hole = Math.floor(Math.random() * COLS);
    S.board.push(Array.from({ length: COLS }, (_, x) => x === hole ? 0 : 7));
    for (let x = 0; x < COLS; x++) if (x !== hole) burst(x, ROWS - 1, MAT[7][0], 1, 60);
    popup('¡ESCOMBROS!', env.B.danger); S.shake = 0.25; env.Snd.play('crack');
    return true;
  }
  function recKey(mode) { return mode === 'escombros' ? 'hiEsc' : 'hi'; }
  function win() {
    S.phase = 'over'; S.phaseT = 0; S.cur = null; S.won = true;
    const d = env.Save.data; d.tetris = d.tetris || { hi: 0, lines: 0, plays: 0 };
    S.newRecord = !d.tetris.sprint || S.time < d.tetris.sprint;
    if (S.newRecord) d.tetris.sprint = S.time;
    d.tetris.lines = Math.max(d.tetris.lines, S.lines); d.tetris.plays++;
    env.Save.write(); env.Snd.music(null); env.Snd.tempo(1); env.Snd.play('win');
  }
  function gameOver() {
    S.phase = 'over'; S.phaseT = 0; S.cur = null;
    const d = env.Save.data; d.tetris = d.tetris || { hi: 0, lines: 0, plays: 0 };
    const rk = recKey(S.mode);
    S.newRecord = S.mode !== 'sprint' && S.score > (d.tetris[rk] || 0);
    if (S.newRecord) d.tetris[rk] = S.score;
    d.tetris.lines = Math.max(d.tetris.lines, S.lines); d.tetris.plays++;
    env.Save.write();
    env.Snd.music(null); env.Snd.tempo(1); env.Snd.play('over');
  }

  /* ===================== Actualización ===================== */
  function update(dt) {
    dt = Math.min(dt, 0.05);
    const e = env;
    if (!S) { if (M) menuUpdate(dt); return; }
    if (S.phase === 'play' || S.phase === 'clearing') S.time += dt;
    S.t += dt; S.phaseT += dt;
    S.shake = Math.max(0, S.shake - dt);
    updateFx(dt);
    if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }

    if (S.phase === 'ready') { if (S.phaseT >= READY_T) { S.phase = 'play'; nextPiece(); } return; }
    if (S.phase === 'paused') {
      if (e.pressed('pause') || e.pressed('confirm')) setPause(false);
      return;
    }
    if (S.phase === 'over') {
      if (S.phaseT > 0.6 && e.pressed('confirm')) { e.Snd.play('ok'); start(S.mode); }
      else if (S.phaseT > 0.3 && e.pressed('back')) quit();
      return;
    }
    if (S.phase === 'clearing') {
      if (S.phaseT >= CLEAR_T) finishClear();
      return;
    }
    // ---- jugando ----
    if (e.pressed('pause')) { setPause(true); return; }
    if (!S.cur) return;
    // movimiento lateral con DAS/ARR
    const L = e.held('left'), R = e.held('right');
    const dir = L && R ? S.dasDir : (L ? -1 : (R ? 1 : 0));
    if (dir !== S.dasDir) {
      S.dasDir = dir; S.dasT = 0;
      if (dir && tryMove(dir, 0)) e.Snd.play('tmove');
    } else if (dir) {
      S.dasT += dt;
      while (S.dasT >= DAS + ARR) { S.dasT -= ARR; if (tryMove(dir, 0)) e.Snd.play('tmove'); else break; }
    }
    if (S.gRot) { S.gRot = false; rotate(1); }
    if (e.pressed('rotcw')) rotate(1);
    if (e.pressed('rotccw')) rotate(-1);
    if (e.pressed('hold')) doHold();
    if (e.pressed('power')) usePower();
    if (e.pressed('powerSel')) cyclePower(1);
    if (S.slowT > 0) S.slowT = Math.max(0, S.slowT - dt);
    if (!S.cur) return;
    if (!S.cur) return;
    if (e.pressed('hard') || S.gHard) { S.gHard = false; // caída instantánea
      let d = 0; while (tryMove(0, 1)) d++;
      S.score += d * 2; S.shake = Math.max(S.shake, 0.12);
      for (const [x, y] of cells(S.cur)) burst(x + 0.5, y + 1, MAT[S.cur.type][1], 2, 40);
      e.Snd.play('thard'); lockPiece(); return;
    }
    // gravedad + caída suave
    const soft = e.held('soft') || S.gSoft;
    const gv = soft ? Math.min(GRAV(S.level), SOFT) : GRAV(S.level) * (S.slowT > 0 ? 3 : 1);
    S.fall += dt;
    while (S.fall >= gv) {
      S.fall -= gv;
      if (!tryMove(0, 1)) { S.fall = 0; break; }
      if (soft) S.score += 1;
    }
    if (grounded()) {
      S.lockT += dt;
      if (S.lockT >= LOCK_DELAY) lockPiece();
    } else S.lockT = 0;
  }
  function updateFx(dt) {
    S.particles.forEach(p => { p.t += dt; p.x += p.vx * dt / 12; p.y += p.vy * dt / 12; p.vy += 260 * dt; });
    S.particles = S.particles.filter(p => p.t < p.life);
    S.popups.forEach(p => { p.t += dt; });
    S.popups = S.popups.filter(p => p.t < 1.4);
  }
  function setPause(on) {
    if (on && (S.phase === 'play' || S.phase === 'ready')) { S.prevPhase = S.phase; S.phase = 'paused'; env.Snd.pauseMusic(true); env.Snd.play('pause'); }
    else if (!on && S.phase === 'paused') { S.phase = S.prevPhase || 'play'; env.Snd.pauseMusic(false); env.Snd.play('pause'); }
  }
  function quit() { env.Snd.pauseMusic(false); env.Snd.tempo(1); S = null; M = null; env.quit(); }
  function open() { S = null; M = { cursor: 0, t: 0 }; }
  function menuUpdate(dt) {
    M.t += dt;
    if (env.pressed('up')) { M.cursor = (M.cursor + MODES.length - 1) % MODES.length; env.Snd.play('select'); }
    if (env.pressed('down')) { M.cursor = (M.cursor + 1) % MODES.length; env.Snd.play('select'); }
    if (env.pressed('confirm')) { env.Snd.play('ok'); start(MODES[M.cursor].id); }
    else if (env.pressed('back') || env.pressed('pause')) { M = null; env.Snd.play('select'); env.quit(); }
  }
  /* Gestos táctiles sobre el tablero: deslizar = mover, tocar = girar, mantener abajo = bajar, deslizón rápido abajo = caer */
  function gesture(type, x, y) {
    if (!S || S.phase !== 'play') { if (type !== 'down') { G0 = null; if (S) S.gSoft = false; } return; }
    const c = cellPx, now = performance.now();
    if (type === 'down') { G0 = { x0: x, y0: y, ax: x, t0: now, moved: false, soft: false }; return; }
    if (!G0) return;
    if (type === 'move') {
      while (S.cur && Math.abs(x - G0.ax) >= c * 0.9) {
        const d = x > G0.ax ? 1 : -1; G0.ax += d * c * 0.9; G0.moved = true;
        if (tryMove(d, 0)) env.Snd.play('tmove');
      }
      const dy = y - G0.y0;
      G0.soft = dy > c * 1.6 && Math.abs(dy) > Math.abs(x - G0.x0);
      S.gSoft = G0.soft;
      if (G0.soft) G0.moved = true;
    } else { // 'up' o 'cancel'
      const dt = now - G0.t0, dx = x - G0.x0, dy = y - G0.y0;
      S.gSoft = false;
      if (type === 'up') {
        if (dy > c * 3 && dt < 280 && Math.abs(dy) > Math.abs(dx) * 1.5) S.gHard = true;       // deslizón rápido hacia abajo
        else if (!G0.moved && Math.hypot(dx, dy) < c * 0.7 && dt < 300) S.gRot = true;         // toque = girar
        else if (dy < -c * 2.5 && dt < 300 && Math.abs(dy) > Math.abs(dx) * 1.5) doHold();     // deslizón hacia arriba = guardar
      }
      G0 = null;
    }
  }
  function action(a) {
    if (!S) {
      if (!M) return;
      if (a === 'quit') { M = null; env.quit(); } else if (a.startsWith('mode')) { env.Snd.play('ok'); start(MODES[+a.slice(4)].id); }
      return;
    }
    if (a === 'resume') setPause(false);
    else if (a === 'retry') { env.Snd.pauseMusic(false); env.Snd.play('ok'); start(S.mode); }
    else if (a === 'quit') quit();
    else if (a === 'pause') setPause(true);
    else if (a === 'psel') cyclePower(1);
  }

  /* ===================== Dibujo ===================== */
  function cellSprite(type, s, ghost) {
    const key = type + ':' + s + (ghost ? 'g' : '');
    let c = cellCache.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = s;
    const g = c.getContext('2d'), [base, light, dark] = MAT[type];
    if (ghost) {
      g.fillStyle = base; g.globalAlpha = 0.22; g.fillRect(0, 0, s, s); g.globalAlpha = 0.8;
      g.fillRect(0, 0, s, 1); g.fillRect(0, s - 1, s, 1); g.fillRect(0, 0, 1, s); g.fillRect(s - 1, 0, 1, s);
      cellCache.set(key, c); return c;
    }
    g.fillStyle = '#1c110b'; g.fillRect(0, 0, s, s);                  // contorno oscuro
    g.fillStyle = base; g.fillRect(1, 1, s - 2, s - 2);
    g.fillStyle = light; g.fillRect(1, 1, s - 2, 1); g.fillRect(1, 1, 1, s - 2);
    g.fillStyle = dark; g.fillRect(1, s - 2, s - 2, 1); g.fillRect(s - 2, 1, 1, s - 2);
    const m = s >> 1;
    g.fillStyle = dark;
    switch (type) {
      case 3: g.fillRect(2, m, s - 4, 1); g.fillRect(m, 2, 1, m - 2); break;                          // ladrillo: junta de mortero
      case 5: for (let i = 3; i < s - 2; i += 3) g.fillRect(i, 2, 1, s - 4); break;                      // teja: surcos
      case 6: g.fillRect(2, m - 1, s - 4, 1); g.fillRect(2, m + 2, s - 4, 1); break;                    // tablón: vetas
      case 1: g.fillStyle = light; g.fillRect(2, m, 1, 1); g.fillRect(s - 3, m, 1, 1); break;           // viga: remaches
      case 2: g.fillRect(m, 2, 1, s - 4); g.fillRect(2, m, s - 4, 1); break;                            // cerámica: cruz de baldosa
      case 4: g.fillStyle = light; g.fillRect(3, 3, 1, 1); g.fillRect(s - 4, s - 4, 1, 1); g.fillRect(m, m + 1, 1, 1); break; // cemento fresco
      case 7: g.fillStyle = light; g.fillRect(2, 2, 2, 1); g.fillRect(s - 4, s - 3, 2, 1); break;       // losa: brillo
      case 8: // bomba: chispa
        g.fillStyle = '#ff7a2e'; g.fillRect(m - 1, 1, 3, 2); g.fillStyle = '#ffe14a'; g.fillRect(m, 0, 1, 2);
        g.fillStyle = '#fff6e8'; g.fillRect(2, s - 5, 2, 2); break;
    }
    cellCache.set(key, c); return c;
  }
  function layout(W, H) {
    const narrow = W < 400;
    let cell, bx, by, side;
    if (narrow) {
      cell = Math.max(8, Math.min(Math.floor((H - 40) / 20), Math.floor((W - 6 - 6 - 6 - 80) / 10)));
      bx = 6; by = Math.max(24, Math.floor((H - cell * 20) / 2) + 6);
      side = [bx + cell * 10 + 6, W - 4];
    } else {
      cell = Math.max(8, Math.min(Math.floor((H - 12) / 20), 14));
      bx = Math.floor((W - cell * 10) / 2); by = Math.floor((H - cell * 20) / 2);
      side = null;
    }
    return { narrow, cell, bx, by, side };
  }

  function drawCell(g, type, px, py, s, ghost) { g.drawImage(cellSprite(type, s, ghost), Math.round(px), Math.round(py)); }
  function drawMini(g, type, cx, cy, s) { // pieza centrada en (cx, cy)
    if (!type) return;
    const cs = ROT[type][0]; let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    cs.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    const w = (x1 - x0 + 1) * s, h = (y1 - y0 + 1) * s;
    cs.forEach(([x, y]) => drawCell(g, type, cx - w / 2 + (x - x0) * s, cy - h / 2 + (y - y0) * s, s));
  }
  function box(g, x, y, w, h, title) {
    const { B, Font } = env;
    g.fillStyle = B.dark; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = 'rgba(30,16,8,0.82)'; g.fillRect(x, y, w, h);
    g.fillStyle = B.primary; g.fillRect(x, y, w, 1);
    if (title) env.txt(title, x + w / 2, y + 3, B.secondary, { align: 'center', scale: 1 });
  }

  function draw(W, H) {
    const { ctx: g, B, Font, Art, txt } = env;
    if (!S) return drawMenu(W, H);
    const st = stage(), lay = layout(W, H), { cell: s, bx, by, narrow } = lay;
    cellPx = s;
    // fondo: cambia con la etapa de la obra
    Art.drawBackground(g, Math.min(4, st), S.t * 6, 0, S.t, W, H, 0);
    g.fillStyle = 'rgba(30,16,8,0.45)'; g.fillRect(0, 0, W, H);

    g.save();
    if (S.shake > 0) g.translate(Math.round((Math.random() - 0.5) * S.shake * 14), Math.round((Math.random() - 0.5) * S.shake * 14));

    // ---- tablero ----
    const bw = s * COLS, bh = s * 20;
    g.fillStyle = B.dark; g.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    g.fillStyle = B.secondary; g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    g.fillStyle = '#1a1010'; g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    g.fillStyle = '#241714'; g.fillRect(bx, by, bw, bh);
    g.fillStyle = 'rgba(255,255,255,0.045)';
    for (let x = 1; x < COLS; x++) g.fillRect(bx + x * s, by, 1, bh);
    for (let y = 1; y < 20; y++) g.fillRect(bx, by + y * s, bw, 1);
    g.save(); g.beginPath(); g.rect(bx, by, bw, bh); g.clip();
    const cy = r => by + (r - HID) * s;
    for (let r = HID; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const v = S.board[r][c]; if (v) drawCell(g, v, bx + c * s, cy(r), s);
    }
    if (S.phase === 'clearing') { // destello de las líneas completas
      const k = S.phaseT / CLEAR_T, a = Math.sin(Math.min(1, k) * Math.PI);
      S.clearRows.forEach(r => { g.fillStyle = 'rgba(255,246,200,' + (0.35 + 0.6 * a).toFixed(2) + ')'; g.fillRect(bx, cy(r), bw, s); });
    }
    if (S.cur && S.phase !== 'paused') {
      const gy = ghostY(), cur = S.cur;
      ROT[cur.type][cur.rot].forEach(([x, y]) => { if (gy !== cur.y) drawCell(g, cur.type, bx + (cur.x + x) * s, cy(gy + y), s, true); });
      const flash = grounded() && S.lockT > 0 && Math.floor(S.t * 16) % 2 === 0;
      ROT[cur.type][cur.rot].forEach(([x, y]) => {
        const r = cur.y + y; if (r < HID) return;
        drawCell(g, cur.type, bx + (cur.x + x) * s, cy(r), s);
        if (flash) { g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(bx + (cur.x + x) * s, cy(r), s, s); }
      });
    }
    // partículas de polvo / escombros
    S.particles.forEach(p => {
      g.globalAlpha = Math.max(0, 1 - p.t / p.life); g.fillStyle = p.c;
      g.fillRect(Math.round(bx + p.x * s + s / 2), Math.round(by + (p.y - HID) * s + s / 2), 2, 2);
    });
    g.globalAlpha = 1;
    g.restore();

    // textos flotantes
    S.popups.forEach((p, i) => {
      const a = Math.min(1, (1.4 - p.t) * 2.5), yy = by + bh * 0.4 - p.t * 22 - (i % 3) * 12;
      g.globalAlpha = a; txt(p.text, bx + bw / 2, yy, p.color, { align: 'center', scale: 1 }); g.globalAlpha = 1;
    });

    // ---- paneles laterales ----
    const hs = Math.max(6, Math.floor(s * 0.62));
    if (!narrow) {
      const lx = bx - 8 - 92, rx = bx + bw + 8;
      // izquierda: GUARDADA, puntos, líneas, nivel
      box(g, lx, by, 92, 52, 'GUARDADA');
      if (S.hold) { g.globalAlpha = S.holdUsed ? 0.4 : 1; drawMini(g, S.hold, lx + 46, by + 33, hs); g.globalAlpha = 1; }
      box(g, lx, by + 60, 92, 94);
      const o1 = { scale: 1 };
      txt('PUNTOS', lx + 6, by + 66, B.secondary, o1); txt(pad(S.score, 7), lx + 86, by + 77, B.light, { align: 'right', scale: 1 });
      txt('LÍNEAS', lx + 6, by + 94, B.secondary, o1); txt(String(S.lines), lx + 86, by + 105, B.light, { align: 'right', scale: 1 });
      txt('NIVEL', lx + 6, by + 122, B.secondary, o1); txt(String(S.level), lx + 86, by + 133, B.light, { align: 'right', scale: 1 });
      if (S.mode !== 'sprint') txt('RÉCORD ' + pad(Math.max(S.score, hi()), 6), lx + 46, by + 160, B.secondaryLight, { align: 'center', scale: 1 });
      if (S.mode === 'sprint') { box(g, lx, by + 160, 92, 62); txt('TIEMPO', lx + 6, by + 166, B.secondary, o1); txt(fmtT(S.time), lx + 86, by + 177, B.light, { align: 'right', scale: 1 }); txt('MEJOR ' + fmtT(bestT()), lx + 46, by + 193, B.secondaryLight, { align: 'center', scale: 1 }); txt('FALTAN ' + Math.max(0, SPRINT_LINES - S.lines), lx + 46, by + 207, B.light, { align: 'center', scale: 1 }); }
      else if (S.mode === 'escombros') txt('ESCOMBROS EN ' + (RUBBLE_EVERY - S.rb), lx + 46, by + 172, S.rb >= RUBBLE_EVERY - 2 ? B.danger : B.light, { align: 'center', scale: 1 });
      // derecha: SIGUIENTES + casa
      box(g, rx, by, 92, 96, 'PRÓXIMAS');
      for (let i = 0; i < 3; i++) drawMini(g, S.queue[i], rx + 46, by + 24 + i * 25, hs);
      drawHouseBox(g, rx, by + 104, 92, 70, st);
      drawBombBar(g, rx, by + 182, 92); drawPowerBar(g, rx, by + 196, 92);
      txt(NAMES[S.cur ? S.cur.type : 0] || '', rx + 46, by + bh - 10, B.light, { align: 'center', scale: 1 });
    } else {
      const sx = lay.side[0], sw = lay.side[1] - sx;
      let y = by;
      box(g, sx, y, sw, 40, 'GUARDADA'); if (S.hold) { g.globalAlpha = S.holdUsed ? 0.4 : 1; drawMini(g, S.hold, sx + sw / 2, y + 26, Math.min(hs, 9)); g.globalAlpha = 1; } y += 46;
      box(g, sx, y, sw, 118, 'PRÓXIMAS'); for (let i = 0; i < 3; i++) drawMini(g, S.queue[i], sx + sw / 2, y + 36 + i * 30, Math.min(hs, 9)); y += 124;
      const o1 = { scale: 1 };
      txt('PUNTOS', sx + 2, y, B.secondary, o1); txt(pad(S.score, 6), sx + sw - 2, y + 11, B.light, { align: 'right', scale: 1 }); y += 26;
      txt('LÍNEAS', sx + 2, y, B.secondary, o1); txt(String(S.lines), sx + sw - 2, y, B.light, { align: 'right', scale: 1 }); y += 14;
      txt('NIVEL', sx + 2, y, B.secondary, o1); txt(String(S.level), sx + sw - 2, y, B.light, { align: 'right', scale: 1 }); y += 14;
      if (S.mode === 'sprint') { txt(fmtT(S.time), sx + sw / 2, y, B.light, { align: 'center', scale: 1 }); y += 11; txt('FALTAN ' + Math.max(0, SPRINT_LINES - S.lines), sx + sw / 2, y, B.secondaryLight, { align: 'center', scale: 1 }); y += 12; }
      else if (S.mode === 'escombros') { txt('ESCOMBROS: ' + (RUBBLE_EVERY - S.rb), sx + sw / 2, y, S.rb >= RUBBLE_EVERY - 2 ? B.danger : B.light, { align: 'center', scale: 1 }); y += 12; }
      drawBombBar(g, sx, y, sw); y += 14; drawPowerBar(g, sx, y, sw); y += 18;
      const hh = Math.min(70, by + bh - y);
      if (hh > 30) drawHouseBox(g, sx, y, sw, hh, st);
    }
    g.restore();

    // título pequeño arriba (sólo si hay sitio)
    if (narrow) txt('TORRE · ' + MODES.find(m => m.id === S.mode).name, W / 2, 6, B.secondary, { align: 'center', scale: 1 });

    drawOverlay(g, W, H, bx, by, bw, bh);
  }
  const fmtT = t => { if (!t) return '--:--.--'; const m = Math.floor(t / 60), sec = t - m * 60; return String(m).padStart(2, '0') + ':' + sec.toFixed(2).padStart(5, '0'); };
  const bestT = () => (env.Save.data.tetris && env.Save.data.tetris.sprint) || 0;
  const pad = (n, l) => String(Math.max(0, Math.floor(n))).padStart(l, '0');
  const hi = () => (env.Save.data.tetris && env.Save.data.tetris[recKey(S ? S.mode : 'classic')]) || 0;

  function drawHouseBox(g, x, y, w, h, st) {
    const { B, Art } = env;
    box(g, x, y, w, h);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    const sc = Math.min((w - 8) / 120, (h - 8) / 96);
    Art.drawHouse(g, x + (w - 120 * sc) / 2, y + h - 4, sc, st, S.t, true);
    g.restore();
    env.txt('OBRA ' + Math.min(100, Math.floor((S.lines / (HOUSE_LINES * 5)) * 100)) + '%', x + w / 2, y + 3, B.secondary, { align: 'center', scale: 1 });
  }
  function drawPowerBar(g, x, y, w) {
    const { B } = env, P = POWERS[S.sel], ready = S.power >= P.cost, k = S.power / POWER_MAX;
    g.fillStyle = B.dark; g.fillRect(x - 1, y - 1, w + 2, 10);
    g.fillStyle = '#183a20'; g.fillRect(x, y, w, 8);
    g.fillStyle = ready ? (Math.floor(S.t * 6) % 2 ? B.good : '#b6ffc2') : '#2f8a40'; g.fillRect(x, y, Math.round(w * k), 8);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, Math.round(w * k), 1);
    POWERS.forEach((p, i) => { g.fillStyle = i === S.sel ? B.secondary : 'rgba(255,246,232,0.5)'; g.fillRect(x + Math.round(w * p.cost / POWER_MAX) - 1, y, 1, 8); }); // marcas de coste
    const label = S.slowT > 0 ? 'FRENO ' + Math.ceil(S.slowT) + 'S' : (ready ? P.name + '! (V)' : '‹ ' + P.name + ' ›');
    env.txt(label, x + w / 2, y + 1, ready || S.slowT > 0 ? B.dark : B.light, { align: 'center', scale: 1 });
    env.hit(x, y - 2, w, 12, 't:psel'); // tocar la barra cambia de poder
  }
  function drawBombBar(g, x, y, w) {
    const { B } = env, k = Math.min(1, S.bombCharge / BOMB_EVERY), queued = S.queue.slice(0, 3).includes(8) || (S.cur && S.cur.type === 8);
    g.fillStyle = B.dark; g.fillRect(x - 1, y - 1, w + 2, 10);
    g.fillStyle = '#3a2418'; g.fillRect(x, y, w, 8);
    g.fillStyle = queued ? (Math.floor(S.t * 6) % 2 ? B.danger : B.secondary) : B.danger; g.fillRect(x, y, Math.round(w * (queued ? 1 : k)), 8);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, Math.round(w * (queued ? 1 : k)), 1);
    env.txt(queued ? 'DEMOLICIÓN!' : 'DEMOLICIÓN', x + w / 2, y + 1, B.light, { align: 'center', scale: 1 });
  }

  function drawMenu(W, H) {
    const { ctx: g, B, Art, txt, button } = env, narrow = W < 400, d = env.Save.data.tetris || {};
    Art.drawBackground(g, 0, M.t * 8, 0, M.t, W, H, 0);
    g.fillStyle = 'rgba(30,16,8,0.55)'; g.fillRect(0, 0, W, H);
    const bw = Math.min(W - 24, 260), bx = Math.round((W - bw) / 2), y0 = Math.round(H * (narrow ? 0.16 : 0.05));
    g.fillStyle = B.dark; g.fillRect(bx - 2, y0 - 2, bw + 4, 38); g.fillStyle = B.secondary; g.fillRect(bx - 1, y0 - 1, bw + 2, 36);
    g.fillStyle = B.primary; g.fillRect(bx, y0, bw, 34);
    for (let i = 0; i < 4; i++) drawCell(g, [3, 2, 1, 5][i], bx + 6 + (i % 2) * 11, y0 + 5 + (i >> 1) * 11, 10); // ladrillos del título
    txt('TORRE DE', bx + bw / 2 + 12, y0 + 6, B.light, { align: 'center', scale: 1 });
    txt('LADRILLOS', bx + bw / 2 + 12, y0 + 16, B.secondaryLight, { align: 'center', scale: 2 });
    txt('ELIGE UN MODO', W / 2, y0 + 42, B.light, { align: 'center' });
    const rh = narrow ? 56 : 40, bh = narrow ? 24 : 18, ys = y0 + (narrow ? 70 : 62);
    MODES.forEach((m, i) => {
      const y = ys + i * (rh + 6), sel = i === M.cursor;
      button(m.name, bx, y, bw, bh, 'mode' + i, sel);
      txt(m.desc, W / 2, y + bh + 5, B.light, { align: 'center', scale: 1 });
      const rec = m.id === 'sprint' ? (d.sprint ? 'MEJOR ' + fmtT(d.sprint) : 'SIN RÉCORD') : 'RÉCORD ' + pad(d[recKey(m.id)] || 0, 7);
      txt(rec, W / 2, y + bh + 17, B.secondaryLight, { align: 'center', scale: 1 });
    });
    button('VOLVER', 6, H - (narrow ? 30 : 24), narrow ? 90 : 60, narrow ? 24 : 16, 'quit', false);
    if (!narrow) txt('↑ ↓ ELEGIR   ENTER JUGAR', W - 6, H - 14, B.secondary, { align: 'right', scale: 1 });
  }
  function drawOverlay(g, W, H, bx, by, bw, bh) {
    const { B, txt, button } = env, narrow = W < 400, cx = bx + bw / 2;
    const dim = a => { g.fillStyle = 'rgba(15,8,4,' + a + ')'; g.fillRect(bx, by, bw, bh); };
    if (S.phase === 'ready') {
      dim(0.55);
      const n = 3 - Math.floor(S.phaseT / (READY_T / 3));
      txt(n > 0 ? String(n) : '¡YA!', cx, by + bh * 0.4, B.secondary, { align: 'center', scale: 6 });
      txt('TORRE DE LADRILLOS', cx, by + bh * 0.62, B.light, { align: 'center' });
    }
    if (S.banner) {
      const bnH = 44, yy = by + bh * 0.3;
      g.fillStyle = 'rgba(20,10,5,0.88)'; g.fillRect(0, yy, W, bnH); g.fillStyle = B.secondary; g.fillRect(0, yy, W, 2); g.fillRect(0, yy + bnH - 2, W, 2);
      txt(S.banner.text, W / 2, yy + 8, B.secondary, { align: 'center', scale: narrow ? 2 : 2 }); txt(S.banner.sub, W / 2, yy + 30, B.light, { align: 'center' });
    }
    if (S.phase === 'paused') {
      dim(0.82);
      txt('PAUSA', cx, by + 12, B.secondary, { align: 'center', scale: 2 });
      const bwid = Math.min(bw - 8, 130), bhgt = narrow ? 22 : 16, bxx = cx - bwid / 2;
      button('CONTINUAR', bxx, by + 40, bwid, bhgt, 't:resume', true);
      button('REINICIAR', bxx, by + 40 + bhgt + 6, bwid, bhgt, 't:retry', false);
      button(env.mutedLabel(), bxx, by + 40 + (bhgt + 6) * 2, bwid, bhgt, 'mute', false);
      button('SALIR AL MENÚ', bxx, by + 40 + (bhgt + 6) * 3, bwid, bhgt, 't:quit', false);
      if (!document.body.classList.contains('touch')) {
        const keys = ['← →: MOVER', '↑ / X: GIRAR', 'Z: GIRAR ←', '↓: BAJAR', 'ESPACIO: CAER', 'C / SHIFT: GUARDAR', 'V: USAR PODER', 'E: CAMBIAR PODER', 'P / ESC: PAUSA'];
        if (!narrow) keys.forEach((k, i) => txt(k, cx, by + 40 + (bhgt + 6) * 4 + 6 + i * 11, B.light, { align: 'center' }));
      }
    }
    if (S.phase === 'over') {
      dim(Math.min(0.85, S.phaseT * 1.5));
      if (S.phaseT > 0.3) {
        if (S.won) { txt('¡TORRE', cx, by + 12, B.good, { align: 'center', scale: 2 }); txt('LISTA!', cx, by + 32, B.good, { align: 'center', scale: 2 }); }
        else { txt('¡LA TORRE', cx, by + 12, B.danger, { align: 'center', scale: 2 }); txt('SE CAYÓ!', cx, by + 32, B.danger, { align: 'center', scale: 2 }); }
        const lh = narrow ? 14 : 11;
        txt('PUNTOS ' + pad(S.score, 7), cx, by + 66, B.light, { align: 'center' });
        txt('LÍNEAS ' + S.lines, cx, by + 66 + lh, B.light, { align: 'center' });
        if (S.mode === 'sprint') { txt('TIEMPO ' + fmtT(S.time), cx, by + 66 + lh * 2, B.light, { align: 'center' }); txt('MEJOR ' + fmtT(bestT()), cx, by + 66 + lh * 3, B.secondaryLight, { align: 'center' }); }
        else { txt('NIVEL ' + S.level, cx, by + 66 + lh * 2, B.light, { align: 'center' }); txt('RÉCORD ' + pad(hi(), 7), cx, by + 66 + lh * 3, B.secondaryLight, { align: 'center' }); }
        if (S.newRecord) txt(S.mode === 'sprint' ? '¡MEJOR TIEMPO!' : '¡NUEVO RÉCORD!', cx, by + 66 + lh * 4, Math.floor(S.t * 4) % 2 ? B.secondary : B.light, { align: 'center' });
        if (S.phaseT > 0.6) {
          const bwid = Math.min(bw - 8, 130), bhgt = narrow ? 22 : 16, bxx = cx - bwid / 2, y0 = by + 66 + lh * 5 + 8;
          button('OTRA VEZ', bxx, y0, bwid, bhgt, 't:retry', true);
          button('SALIR AL MENÚ', bxx, y0 + bhgt + 6, bwid, bhgt, 't:quit', false);
        }
      }
    }
  }

  window.Tetris = {
    init(e) { env = e; },
    open, start, update, draw, action, gesture, usePower, POWERS,
    pause() { if (S) setPause(true); },
    get active() { return !!S; },
    // utilidades para pruebas automáticas
    _s: () => S, _cells: cells, _fits: fits, _hooks: { ROT, SHAPES, COLS, ROWS, HID, spawn, lockPiece, explode, nextPiece, rotate }
  };
})();

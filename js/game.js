/* INCERPAZ: La Gran Obra — motor del juego (Canvas 2D, sin dependencias). */
(() => {
  'use strict';
  const C = CONFIG, T = C.TILE, VW = C.VIEW_W, VH = C.VIEW_H, P = C.PHYS, B = C.BRAND;
  const canvas = document.getElementById('game');
  canvas.width = VW; canvas.height = VH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const PW = 10, PH = 14;                       // tamaño de la caja de colisión de Ladri
  const SOLID_CH = new Set(['#', 'B', 'R', 'S', 'T', 'W']);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pad = (n, l) => String(Math.max(0, Math.floor(n))).padStart(l, '0');

  /* ===================== Guardado (localStorage) ===================== */
  const Save = {
    key: 'incerpaz_gran_obra_v1',
    data: { unlocked: 1, hi: 0, seenStory: false, levels: {} },
    load() {
      try { const d = JSON.parse(localStorage.getItem(this.key)); if (d && typeof d === 'object') this.data = Object.assign(this.data, d); } catch (e) {}
    },
    write() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {} },
    level(i) { return this.data.levels[i] || (this.data.levels[i] = { best: 0, tejas: [false, false, false], clear: false }); }
  };
  Save.load();

  /* ===================== Entrada: teclado + táctil ===================== */
  const BIND = {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    jump: ['Space', 'ArrowUp', 'KeyW', 'KeyZ'], brick: ['KeyX', 'KeyJ', 'ArrowDown', 'KeyS'],
    wall: ['KeyC', 'KeyK', 'ShiftLeft', 'ShiftRight'], pause: ['KeyP', 'Escape'], mute: ['KeyM'],
    confirm: ['Enter', 'NumpadEnter', 'Space'], back: ['Escape']
  };
  const keysDown = new Set(), keysPressed = new Set(), touchHeld = new Set(), touchPressed = new Set();
  const held = a => touchHeld.has(a) || BIND[a].some(k => keysDown.has(k));
  const pressed = a => touchPressed.has(a) || BIND[a].some(k => keysPressed.has(k));
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) keysPressed.add(e.code);
    keysDown.add(e.code);
    Snd.unlock();
  });
  window.addEventListener('keyup', e => keysDown.delete(e.code));
  window.addEventListener('blur', () => { keysDown.clear(); touchHeld.clear(); if (G.state === 'play') setPause(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (G.state === 'play') setPause(true); Snd.suspend(); } else Snd.resume(); });

  function bindTouch() {
    document.querySelectorAll('[data-act]').forEach(btn => {
      const act = btn.dataset.act;
      const down = e => { e.preventDefault(); Snd.unlock(); document.body.classList.add('touch'); btn.classList.add('on'); touchHeld.add(act); touchPressed.add(act); if (btn.setPointerCapture) { try { btn.setPointerCapture(e.pointerId); } catch (x) {} } };
      const up = e => { e.preventDefault(); btn.classList.remove('on'); touchHeld.delete(act); };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });
    window.addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  }
  bindTouch();

  /* ===================== Estado global ===================== */
  const G = {
    state: 'title', // title | story | select | intro | play | pause | clear | over | ending
    levelIndex: 0, lives: C.START_LIVES, score: 0, coinsRun: 0,
    t: 0, stateT: 0, cursor: 0, buttons: [], clearInfo: null, newRecord: false
  };
  const INC = window.INCERPAZ = { manual: false, controller: null };
  let L = null; // nivel en curso

  /* ===================== Carga de nivel ===================== */
  function loadLevel(idx) {
    const def = LEVELS[idx];
    const h = def.map.length, w = def.map[0].length;
    L = {
      idx, def, w, h, theme: def.theme, tiles: [], coins: [], tejas: [], enemies: [], pickups: [], checkpoints: [],
      goal: null, movers: [], temp: new Map(), placed: [], particles: [], texts: [], rocks: [],
      bricks: def.bricks, wallCharges: 0, time: def.time, coinsGot: 0, coinsTotal: 0, tejasGot: [false, false, false],
      camX: 0, camY: 0, t: 0, spawn: null, boss: null, scroll: null, flash: 0, shake: 0, thunderT: rnd(4, 9),
      hint: '', banner: null, hurry: false, stomps: 0, lastBeep: -1
    };
    let tejaN = 0;
    for (let r = 0; r < h; r++) {
      const row = [];
      for (let c = 0; c < w; c++) {
        const ch = def.map[r][c], cx = c * T + T / 2, cy = r * T + T / 2;
        let tile = ' ';
        switch (ch) {
          case '#': case 'B': case 'R': case 'S': case 'T': case '/': case '\\': case '=': case '^': tile = ch; break;
          case 'P': L.spawn = { x: c * T + (T - PW) / 2, y: (r + 1) * T - PH }; break;
          case 'o': L.coins.push({ x: cx, y: cy, got: false, ph: Math.random() * 6 }); L.coinsTotal++; break;
          case 'G': L.tejas.push({ x: cx, y: cy, got: false, idx: tejaN++, ph: Math.random() * 6 }); break;
          case 'C': L.checkpoints.push({ c, x: c * T, y: (r + 1) * T, active: false, camX: 0 }); break;
          case 'F': L.goal = { x: c * T, y: (r + 1) * T }; break;
          case 'e': L.enemies.push({ type: 'termite', x: c * T + 2, y: (r + 1) * T - 10, w: 12, h: 10, vx: -26, dir: -1, dead: false, deadT: 0, t: Math.random() }); break;
          case 'd': L.enemies.push({ type: 'drip', hx: c * T + 4, hy: r * T, x: c * T + 5, y: r * T + 6, w: 6, h: 10, vy: 0, state: 'wait', st: 0, dead: false, deadT: 0 }); break;
          case 'h': L.enemies.push({ type: 'cloud', hx: cx, hy: cy, x: cx, y: cy, off: 0, t: Math.random() * 9, r: 8, w: 0, h: 0, dead: false, deadT: 0 }); break;
          case 'H': case 'W': case 'M': case 'r': L.pickups.push({ kind: ch, x: cx, y: cy, got: false, ph: Math.random() * 6 }); break;
        }
        row.push(tile);
      }
      L.tiles.push(row);
    }
    (def.movers || []).forEach(m => {
      L.movers.push({ x: m.x * T, y: m.y * T, x0: m.x * T, y0: m.y * T, x1: (m.x + (m.dx || 0)) * T, y1: (m.y + (m.dy || 0)) * T,
        w: m.w * T, speed: (m.speed || 2) * T, s: 0, dirn: 1, pause: 0, dx: 0, dy: 0, len: Math.hypot((m.dx || 0) * T, (m.dy || 0) * T) });
    });
    if (def.scroll) L.scroll = { speed: def.scroll.speed, max: def.scroll.stopCol * T, delay: 3.2, active: false };
    if (def.boss) L.boss = { state: 'sleep', hp: def.boss.hp, maxHp: def.boss.hp, cracks: [], timer: 2, shake: 0, flash: 0, eye: 0, deadT: 0, rockT: 3 };
    spawnPlayer(L.spawn.x, L.spawn.y);
    L.camX = L.scroll ? 0 : clamp(L.player.x - VW / 2, 0, Math.max(0, w * T - VW));
    L.camY = clamp(L.player.y - VH * 0.55, 0, Math.max(0, h * T - VH));
    Snd.music(null);
  }
  function spawnPlayer(x, y) {
    L.player = { x, y, w: PW, h: PH, vx: 0, vy: 0, facing: 1, grounded: false, coyote: 0, jumpBuf: 0, ride: null, slope: null, groundCh: ' ',
      anim: 0, invuln: 1.2, helmet: false, barrow: 0, dead: false, deadT: 0, pb: y + PH, hurtT: 0, sealAnim: 0 };
  }
  function respawn() {
    let cp = L.checkpoints.filter(c => c.active).pop();
    const inBoss = L.boss && L.boss.state === 'fight';
    if (inBoss) { // durante el jefe se reaparece en la entrada de la arena, con el suelo reparado
      const d = L.def.boss;
      cp = { x: d.arenaCol * T + 2 * T, y: d.floorRow * T, camX: d.arenaCol * T };
      L.boss.cracks.forEach(k => { for (let r = d.floorRow; r < L.h; r++) L.tiles[r][k.col] = 'B'; });
      L.boss.cracks.length = 0; L.boss.timer = 2;
    }
    const sp = cp ? { x: cp.x + (T - PW) / 2, y: cp.y - PH } : L.spawn;
    // se devuelven los ladrillos apilados (los sellos del jefe se quedan)
    L.placed.forEach(pl => { if (pl.kind === 'stack' && L.tiles[pl.r][pl.c] === 'B') L.tiles[pl.r][pl.c] = ' '; });
    L.placed = L.placed.filter(pl => pl.kind !== 'stack');
    L.temp.clear();
    L.bricks = Math.max(L.def.bricks, L.boss && L.boss.state === 'fight' ? 8 : 0); L.wallCharges = 0;
    L.time = Math.max(L.time, 90);
    L.enemies.forEach(e => { if (e.type === 'drip' && !e.dead) { e.state = 'wait'; e.y = e.hy + 6; e.vy = 0; } });
    L.rocks.length = 0;
    spawnPlayer(sp.x, sp.y);
    if (L.scroll) { L.camX = cp ? cp.camX : 0; L.scroll.delay = 2.2; L.scroll.active = false; }
    else L.camX = clamp(L.player.x - VW / 2, 0, Math.max(0, L.w * T - VW));
    L.camY = clamp(L.player.y - VH * 0.55, 0, Math.max(0, L.h * T - VH));
    L.hurry = false; Snd.hurry(false);
    Snd.music(musicFor());
  }
  const musicFor = () => (L.boss && L.boss.state !== 'sleep') ? 'boss' : L.def.music;

  /* ===================== Colisiones con tiles ===================== */
  function tileAt(c, r) {
    if (c < 0 || c >= L.w) return '#';
    if (r < 0 || r >= L.h) return ' ';
    const ch = L.tiles[r][c];
    if (ch !== ' ') return ch;
    return L.temp.has(r * L.w + c) ? 'W' : ' ';
  }
  const solidAt = (c, r) => SOLID_CH.has(tileAt(c, r));
  const solidPx = (x, y) => solidAt(Math.floor(x / T), Math.floor(y / T));
  function groundPx(x, y) { const ch = tileAt(Math.floor(x / T), Math.floor(y / T)); return SOLID_CH.has(ch) || ch === '=' || ch === '/' || ch === '\\'; }
  function overlapsSolid(p) {
    for (let r = Math.floor(p.y / T); r <= Math.floor((p.y + p.h - 0.01) / T); r++)
      for (let c = Math.floor(p.x / T); c <= Math.floor((p.x + p.w - 0.01) / T); c++) if (solidAt(c, r)) return true;
    return false;
  }

  function moveX(p, dx) {
    if (!dx) return false;
    p.x += dx;
    const c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + p.w - 0.001) / T);
    const r0 = Math.floor(p.y / T), r1 = Math.floor((p.y + p.h - 0.001) / T);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (solidAt(c, r)) { p.x = dx > 0 ? c * T - p.w : (c + 1) * T; p.vx = 0; return true; }
    }
    return false;
  }
  function moveY(p, dy) {
    const prevBottom = p.y + p.h;
    p.y += dy; p.grounded = false;
    const c0 = Math.floor((p.x + 0.01) / T), c1 = Math.floor((p.x + p.w - 0.01) / T);
    const r0 = Math.floor(p.y / T), r1 = Math.floor((p.y + p.h - 0.001) / T);
    if (dy >= 0) {
      let land = null;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const ch = tileAt(c, r);
        if (SOLID_CH.has(ch) ? r * T >= prevBottom - 0.5 : (ch === '=' && prevBottom <= r * T + 0.01 && p.y + p.h > r * T)) { if (land === null || r < land) land = r; }
      }
      if (land !== null) { p.y = land * T - p.h; p.vy = 0; p.grounded = true; p.ride = null; return; }
      for (const m of L.movers) {
        if (p.x + p.w > m.x + 1 && p.x < m.x + m.w - 1 && p.y + p.h >= m.y && prevBottom <= m.y + 5) {
          p.y = m.y - p.h; p.vy = 0; p.grounded = true; p.ride = m; return;
        }
      }
      p.ride = null;
    } else {
      p.ride = null;
      for (let r = r1; r >= r0; r--) for (let c = c0; c <= c1; c++) if (solidAt(c, r)) { p.y = (r + 1) * T; p.vy = 0; return; }
    }
  }
  // pendientes de teja: la caja descansa sobre su esquina más alta
  function handleSlopes(p, wasGrounded) {
    p.slope = null;
    if (p.vy < 0) return;
    const bottom = p.y + p.h, rowB = Math.floor((bottom - 0.01) / T);
    let best = Infinity, which = null;
    for (const x of [p.x + 0.5, p.x + p.w - 0.5]) {
      const c = Math.floor(x / T);
      for (let r = rowB; r <= rowB + 1; r++) {
        const ch = tileAt(c, r);
        if (ch === '/' || ch === '\\') {
          const lx = x - c * T, sy = r * T + (ch === '/' ? T - lx : lx);
          if (sy < best) { best = sy; which = ch; }
        }
      }
    }
    if (which && (bottom >= best || (!p.grounded && wasGrounded && best - bottom <= 6))) {
      p.y = best - p.h; p.vy = 0; p.grounded = true; p.ride = null; p.slope = which;
    }
  }

  /* ===================== Efectos ===================== */
  function burst(x, y, color, n = 8, sp = 90, life = 0.6) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = rnd(sp * 0.3, sp); L.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: rnd(life * 0.5, life), t: 0, color, size: Math.random() < 0.5 ? 2 : 1 }); }
  }
  function addText(x, y, text, color = B.light) { L.texts.push({ x, y, text, color, t: 0 }); }
  function addScore(n, x, y, color) { G.score += n; if (x !== undefined) addText(x, y, '+' + n, color); }
  function banner(text, sec = 2.2, sub) { L.banner = { text, sub, t: sec, max: sec }; }

  /* ===================== Jugador ===================== */
  function hurtPlayer() {
    const p = L.player;
    if (p.invuln > 0 || p.dead) return;
    if (p.helmet) {
      p.helmet = false; p.invuln = C.HELMET_INVULN; p.vy = -190; p.vx = -p.facing * 80; p.hurtT = 0.3;
      Snd.play('hurt'); burst(p.x + 5, p.y, B.accent, 10, 100); addText(p.x - 14, p.y - 8, '¡CASCO ROTO!', B.accent);
      return;
    }
    killPlayer();
  }
  function killPlayer(reason) {
    const p = L.player;
    if (p.dead) return;
    p.dead = true; p.deadT = 0; p.vy = -270; p.vx = 0; p.ride = null; p.barrow = 0; p.helmet = false;
    G.lives--;
    Snd.music(null); Snd.play('die');
    burst(p.x + 5, p.y + 7, B.primaryLight, 12, 120);
    L.deathReason = reason || '';
  }
  function stompBounce(p, inp) { p.vy = -(inp.jump ? P.JUMP * 0.9 : P.STOMP_BOUNCE); p.grounded = false; p.ride = null; }

  function stepPlayer(dt, inp) {
    const p = L.player;
    if (p.dead) { p.deadT += dt; p.vy += P.GRAVITY * dt; p.y += p.vy * dt; return; }
    p.invuln = Math.max(0, p.invuln - dt); p.barrow = Math.max(0, p.barrow - dt); p.hurtT = Math.max(0, p.hurtT - dt);
    p.sealAnim = Math.max(0, p.sealAnim - dt);
    if (p.ride) { p.x += p.ride.dx; p.y += p.ride.dy; }
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const onSand = p.groundCh === 'S', slip = p.grounded && (p.groundCh === 'R' || p.slope);
    const polish = p.grounded && !slip && L.def.polished && p.groundCh === '#';
    const maxV = P.RUN * (p.barrow > 0 ? P.BARROW_MULT : 1) * (onSand ? P.SAND_MULT : 1);
    if (dir && p.hurtT <= 0) {
      p.facing = dir;
      const acc = p.grounded ? (slip ? P.ACC_SLIP : polish ? P.ACC_POLISH : P.ACC) : P.ACC_AIR;
      if (Math.abs(p.vx) > maxV && Math.sign(p.vx) === dir) p.vx = approach(p.vx, dir * maxV, P.FRIC * dt * 0.5);
      else p.vx = approach(p.vx, dir * maxV, acc * dt * (Math.sign(p.vx) === -dir ? 1.7 : 1));
    } else if (!dir) {
      p.vx = approach(p.vx, 0, (p.grounded ? (slip ? P.FRIC_SLIP : polish ? P.FRIC_POLISH : P.FRIC) : P.FRIC_AIR) * dt);
    }
    if (p.grounded && p.slope) p.vx = clamp(p.vx + (p.slope === '/' ? -1 : 1) * P.SLIDE * dt, -170, 170);
    moveX(p, p.vx * dt);
    // salto
    p.coyote = p.grounded ? P.COYOTE : p.coyote - dt;
    p.jumpBuf -= dt;
    if (p.jumpBuf > 0 && p.coyote > 0) { p.vy = -P.JUMP; p.grounded = false; p.coyote = 0; p.jumpBuf = 0; p.ride = null; Snd.play('jump'); }
    let g = P.GRAVITY;
    if (p.vy < 0 && !inp.jump) g *= P.JUMP_CUT;
    p.vy = Math.min(p.vy + g * dt, P.MAX_FALL);
    const was = p.grounded;
    p.pb = p.y + p.h;
    moveY(p, p.vy * dt);
    handleSlopes(p, was);
    if (p.grounded) {
      p.groundCh = p.slope || (p.ride ? '=' : tileAt(Math.floor((p.x + p.w / 2) / T), Math.floor((p.y + p.h + 0.5) / T)));
    } else p.groundCh = ' ';
    if (p.x < 0) p.x = 0;
    if (p.y > L.h * T + 24) killPlayer('abismo');
    if (p.grounded && Math.abs(p.vx) > 8) p.anim += dt * (Math.abs(p.vx) / 40); else if (p.grounded) p.anim = 0;
  }

  /* ===================== Habilidades ===================== */
  function tryBrick() {
    const p = L.player;
    if (p.dead) return;
    if (L.boss && L.boss.state === 'fight' && sealCrack(p)) return;
    if (L.bricks <= 0) { Snd.play('no'); addText(p.x - 14, p.y - 8, 'SIN LADRILLOS', B.danger); return; }
    const cx = Math.floor((p.x + p.w / 2) / T), r = Math.floor((p.y + p.h - 0.01) / T);
    if (tileAt(cx, r) !== ' ' || r < 1) { Snd.play('no'); return; }
    const newY = r * T - p.h;
    if (overlapsSolid({ x: p.x, y: newY, w: p.w, h: p.h })) { Snd.play('no'); return; }
    L.tiles[r][cx] = 'B'; L.placed.push({ c: cx, r, kind: 'stack' });
    L.bricks--; p.y = newY; p.vy = 0; p.grounded = true; p.ride = null; p.sealAnim = 0.2;
    Snd.play('brick'); burst(cx * T + 8, r * T + 14, B.primaryLight, 8, 70, 0.35);
  }
  function tryWall() {
    const p = L.player;
    if (p.dead) return;
    if (L.wallCharges <= 0) { Snd.play('no'); addText(p.x - 10, p.y - 8, 'SIN MURO', B.danger); return; }
    const cx = Math.floor((p.x + p.w / 2) / T), r = Math.floor((p.y + p.h - 0.01) / T);
    if (r < 1 || tileAt(cx, r) !== ' ') { Snd.play('no'); return; }
    const newY = r * T - p.h;
    if (overlapsSolid({ x: p.x, y: newY, w: p.w, h: p.h })) { Snd.play('no'); return; }
    for (let c = cx - 1; c <= cx + 1; c++) if (c >= 0 && c < L.w && L.tiles[r][c] === ' ' && !L.temp.has(r * L.w + c)) L.temp.set(r * L.w + c, C.WALL_TIME);
    L.wallCharges--; p.y = newY; p.vy = 0; p.grounded = true; p.ride = null;
    Snd.play('wall'); burst(cx * T + 8, r * T + 14, B.secondary, 10, 80, 0.4);
  }

  /* ===================== Jefe: La Grieta ===================== */
  function sealCrack(p) {
    const bs = L.boss, def = L.def.boss;
    const cx = Math.floor((p.x + p.w / 2) / T);
    if (p.y + p.h < def.floorRow * T - 26) return false;
    for (const c of [cx + p.facing, cx, cx - p.facing]) {
      const ck = bs.cracks.find(k => k.col === c && k.state === 'open');
      if (!ck) continue;
      if (L.bricks <= 0) { Snd.play('no'); return true; }
      for (let r = def.floorRow; r < L.h; r++) L.tiles[r][c] = 'B';
      L.placed.push({ c, r: def.floorRow, kind: 'seal' });
      bs.cracks.splice(bs.cracks.indexOf(ck), 1);
      L.bricks--; bs.hp--; bs.flash = 0.5; bs.shake = 0.6; p.sealAnim = 0.25;
      Snd.play('seal'); burst(c * T + 8, def.floorRow * T + 4, B.primaryLight, 14, 110, 0.5);
      addScore(C.SCORE.seal, c * T + 4, def.floorRow * T - 12, B.secondary);
      addText(c * T - 12, def.floorRow * T - 30, '¡SELLADA!', B.secondaryLight);
      if (bs.hp <= 0) bossDie();
      return true;
    }
    return false;
  }
  function bossDie() {
    const bs = L.boss, def = L.def.boss;
    bs.state = 'dying'; bs.deadT = 0;
    bs.cracks.forEach(k => { for (let r = def.floorRow; r < L.h; r++) L.tiles[r][k.col] = 'B'; });
    bs.cracks.length = 0; L.rocks.length = 0;
    Snd.music(null); Snd.play('boom');
  }
  function updateBoss(dt) {
    const bs = L.boss, def = L.def.boss, p = L.player;
    bs.flash = Math.max(0, bs.flash - dt); bs.shake = Math.max(0, bs.shake - dt); bs.eye += dt;
    if (bs.state === 'sleep') {
      if (p.x > def.arenaCol * T + 36 && L.camX >= (def.arenaCol * T) - 2) {
        bs.state = 'fight'; bs.timer = 1.6;
        L.bricks = Math.max(L.bricks, 8);
        banner('¡LA GRIETA!', 2.6, 'Séllala con ladrillos (↓ / X)');
        Snd.music('boss'); Snd.play('thunder');
      }
      return;
    }
    if (bs.state === 'dying') {
      bs.deadT += dt; bs.shake = 0.3;
      if (Math.random() < 0.05) burst(rnd(def.arenaCol, def.endCol) * T, rnd(5, 12) * T, Math.random() < 0.5 ? B.secondary : '#ff7040', 6, 140, 0.8);
      if (bs.deadT > 3) { bs.state = 'dead'; completeLevel(); }
      return;
    }
    if (bs.state !== 'fight' || p.dead) return;
    bs.timer -= dt;
    if (bs.timer <= 0 && bs.cracks.length < 3) {
      const cols = [];
      for (let c = def.arenaCol + 1; c < def.endCol; c++) if (tileAt(c, def.floorRow) === '#' && !bs.cracks.some(k => Math.abs(k.col - c) < 3)) cols.push(c);
      if (cols.length) {
        const col = cols[Math.floor(Math.random() * cols.length)];
        bs.cracks.push({ col, state: 'warn', t: 1.25 });
        Snd.play('crack'); bs.shake = 0.5;
        if (L.bricks < bs.cracks.length + 1) { L.bricks++; addText(p.x - 20, p.y - 20, '+1 LADRILLO', B.secondaryLight); }
      }
      bs.timer = 4.2 - (1 - bs.hp / bs.maxHp) * 1.8;
    }
    for (const k of bs.cracks) {
      if (k.state === 'warn') {
        k.t -= dt;
        if (Math.random() < 0.05) burst(k.col * T + rnd(2, 14), def.floorRow * T, '#caa670', 1, 40, 0.4);
        if (k.t <= 0) { k.state = 'open'; for (let r = def.floorRow; r < L.h; r++) L.tiles[r][k.col] = ' '; burst(k.col * T + 8, def.floorRow * T, '#6a4a30', 14, 120, 0.7); Snd.play('crack'); }
      }
    }
    bs.rockT -= dt;
    if (bs.rockT <= 0) {
      bs.rockT = rnd(2.4, 4.2) - (1 - bs.hp / bs.maxHp) * 0.8;
      const x = clamp(p.x + rnd(-70, 70), def.arenaCol * T + 12, def.endCol * T - 12);
      L.rocks.push({ x, y: L.camY - 10, vy: 0, warn: 0.9, state: 'warn' });
    }
  }
  function updateRocks(dt) {
    const p = L.player;
    for (const k of L.rocks) {
      if (k.state === 'warn') { k.warn -= dt; if (k.warn <= 0) k.state = 'fall'; continue; }
      k.vy = Math.min(k.vy + 600 * dt, 360); k.y += k.vy * dt;
      if (solidPx(k.x, k.y + 6)) { k.state = 'gone'; burst(k.x, k.y, '#8a7a66', 8, 90, 0.5); Snd.play('splash'); }
      else if (!p.dead && Math.abs(k.x - (p.x + 5)) < 8 && Math.abs(k.y - (p.y + 7)) < 11) { k.state = 'gone'; burst(k.x, k.y, '#8a7a66', 8, 90, 0.5); hurtPlayer(); }
      else if (k.y > L.h * T) k.state = 'gone';
    }
    L.rocks = L.rocks.filter(k => k.state !== 'gone');
  }

  /* ===================== Enemigos y objetos ===================== */
  function killEnemy(e) {
    e.dead = true; e.deadT = 0.5;
    const cx = e.x + (e.w || 0) / 2;
    burst(cx, e.y + (e.h || 0) / 2, e.type === 'cloud' ? '#a8cccb' : '#9b5524', 8, 90, 0.5);
    addScore(C.SCORE.stomp, cx - 8, e.y - 6, B.light);
    Snd.play('stomp'); L.stomps++;
  }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function enemyContact(e, p, inp, box) {
    const top = box ? box.y : e.y;
    if (p.barrow > 0) { killEnemy(e); return; }
    if (p.vy > 0 && p.pb <= top + 6) { killEnemy(e); stompBounce(p, inp); return; }
    hurtPlayer();
  }
  function updateEnemies(dt, inp) {
    const p = L.player;
    const pr = { x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 1 };
    for (const e of L.enemies) {
      if (e.dead) { e.deadT -= dt; continue; }
      if (e.type === 'termite') {
        e.t += dt;
        const front = e.vx > 0 ? e.x + e.w + 1 : e.x - 1;
        if (solidPx(front, e.y + 3) || solidPx(front, e.y + e.h - 2) || !groundPx(front, e.y + e.h + 2) || e.x < 2 || e.x + e.w > L.w * T - 2) { e.vx = -e.vx; e.dir = Math.sign(e.vx); e.x += e.dir * 1.5; }
        else e.x += e.vx * dt;
        if (!p.dead && overlap(pr, e)) enemyContact(e, p, inp);
      } else if (e.type === 'drip') {
        updateDrip(e, dt, p, pr);
      } else if (e.type === 'cloud') {
        e.t += dt;
        const ph = (e.t % 10) / 10;
        e.r = ph < 0.88 ? 7 + 14 * (ph / 0.88) : 21 - 14 * ((ph - 0.88) / 0.12);
        const target = clamp(p.x - e.hx, -44, 44);
        if (Math.abs(p.x - e.hx) < 150) e.off += (target - e.off) * 0.35 * dt;
        e.x = e.hx + e.off + Math.sin(e.t * 0.7) * 10; e.y = e.hy + Math.sin(e.t * 1.3) * 5;
        const rr = e.r * 0.82;
        e.w = rr * 2; e.h = rr * 2;
        const box = { x: e.x - rr, y: e.y - rr, w: rr * 2, h: rr * 2 };
        if (!p.dead && overlap(pr, box)) {
          const nx = clamp(e.x, pr.x, pr.x + pr.w), ny = clamp(e.y, pr.y, pr.y + pr.h);
          if (Math.hypot(nx - e.x, ny - e.y) < rr) enemyContact(e, p, inp, box);
        }
      }
    }
    L.enemies = L.enemies.filter(e => !(e.dead && e.deadT <= 0));
  }
  function updateDrip(e, dt, p, pr) {
    e.st += dt;
    const near = Math.abs((p.x + 5) - (e.hx + 2)) < 5 * T && p.y > e.hy;
    if (e.state === 'wait') { e.y = e.hy + 6; if (near && e.st > 0.4) { e.state = 'form'; e.st = 0; } }
    else if (e.state === 'form') { if (e.st > 0.85) { e.state = 'fall'; e.st = 0; e.vy = 0; Snd.play('drip'); } }
    else if (e.state === 'fall') {
      e.vy = Math.min(e.vy + 520 * dt, 330); e.y += e.vy * dt;
      if (e.y + e.h > L.h * T || groundPx(e.x + 3, e.y + e.h)) { e.state = 'splash'; e.st = 0; Snd.play('splash'); burst(e.x + 3, e.y + e.h, '#58b8ec', 6, 70, 0.4); }
      else if (!p.dead && overlap(pr, { x: e.x, y: e.y + 1, w: e.w, h: e.h - 2 })) { e.state = 'splash'; e.st = 0; burst(e.x + 3, e.y + e.h, '#58b8ec', 6, 70, 0.4); hurtPlayer(); }
    } else if (e.state === 'splash') { if (e.st > 1.6) { e.state = 'wait'; e.st = 0; } }
  }
  function updatePickups(dt) {
    const p = L.player; if (p.dead) return;
    for (const c of L.coins) if (!c.got && Math.abs(c.x - (p.x + 5)) < 9 && Math.abs(c.y - (p.y + 7)) < 11) {
      c.got = true; L.coinsGot++; G.coinsRun++; G.score += C.SCORE.coin; Snd.play('coin');
      burst(c.x, c.y, B.primaryLight, 4, 50, 0.3);
      if (G.coinsRun % C.COINS_PER_LIFE === 0) { G.lives++; Snd.play('oneup'); addText(c.x - 16, c.y - 12, '¡VIDA EXTRA!', B.good); }
    }
    for (const t of L.tejas) if (!t.got && Math.abs(t.x - (p.x + 5)) < 10 && Math.abs(t.y - (p.y + 7)) < 12) {
      t.got = true; L.tejasGot[t.idx] = true; G.score += C.SCORE.teja; Snd.play('teja');
      burst(t.x, t.y, B.gold, 16, 130, 0.8); addText(t.x - 24, t.y - 14, '¡TEJA DORADA!', B.goldLight);
    }
    for (const u of L.pickups) if (!u.got && Math.abs(u.x - (p.x + 5)) < 11 && Math.abs(u.y - (p.y + 7)) < 13) {
      u.got = true; Snd.play('power'); G.score += C.SCORE.powerup; burst(u.x, u.y, '#fff', 12, 110, 0.6);
      if (u.kind === 'H') { p.helmet = true; addText(u.x - 30, u.y - 14, '¡CASCO REFORZADO!', B.accent); }
      if (u.kind === 'W') { p.barrow = C.BARROW_TIME; addText(u.x - 22, u.y - 14, '¡CARRETILLA!', B.secondary); }
      if (u.kind === 'M') { L.wallCharges = Math.min(C.WALL_MAX_CHARGES, L.wallCharges + 1); addText(u.x - 34, u.y - 14, '¡MURO INSTANTÁNEO!', B.secondary); }
      if (u.kind === 'r') { L.bricks += 3; addText(u.x - 26, u.y - 14, '+3 LADRILLOS', B.primaryLight); }
    }
    for (const cp of L.checkpoints) if (!cp.active && p.x + p.w > cp.x && p.x < cp.x + T && p.y + p.h > cp.y - 36 && p.y < cp.y) {
      cp.active = true; cp.camX = L.camX; Snd.play('check'); addText(cp.x - 30, cp.y - 40, 'PUNTO DE CONTROL', B.secondaryLight);
      burst(cp.x + 12, cp.y - 24, B.secondary, 12, 90, 0.6);
    }
    const c0 = Math.floor((p.x + 2) / T), c1 = Math.floor((p.x + p.w - 2) / T), r = Math.floor((p.y + p.h - 2) / T);
    for (let c = c0; c <= c1; c++) if (tileAt(c, r) === '^' && p.y + p.h > r * T + 8) { if (p.invuln <= 0) { hurtPlayer(); if (!p.dead) p.vy = -230; } }
    if (L.goal && !L.boss && p.x + p.w > L.goal.x + 2 && p.x < L.goal.x + 34 && p.y + p.h > L.goal.y - 48 && p.y < L.goal.y) completeLevel();
  }
  function updateMovers(dt) {
    for (const m of L.movers) {
      const px = m.x, py = m.y;
      if (m.pause > 0) m.pause -= dt;
      else {
        m.s += m.dirn * m.speed * dt;
        if (m.s >= m.len) { m.s = m.len; m.dirn = -1; m.pause = 0.7; }
        if (m.s <= 0) { m.s = 0; m.dirn = 1; m.pause = 0.7; }
      }
      const f = m.len ? m.s / m.len : 0;
      m.x = m.x0 + (m.x1 - m.x0) * f; m.y = m.y0 + (m.y1 - m.y0) * f;
      m.dx = m.x - px; m.dy = m.y - py;
    }
  }

  /* ===================== Completar nivel ===================== */
  function completeLevel() {
    if (G.state !== 'play') return;
    const timeBonus = Math.floor(L.time) * C.SCORE.timeBonusPerSecond;
    G.score += timeBonus + C.SCORE.levelClear;
    const tejas = L.tejasGot.filter(Boolean).length;
    const sv = Save.level(L.idx);
    sv.best = Math.max(sv.best, G.score); sv.clear = true;
    L.tejasGot.forEach((g, i) => { if (g) sv.tejas[i] = true; });
    Save.data.unlocked = Math.max(Save.data.unlocked, Math.min(LEVELS.length, L.idx + 2));
    G.newRecord = G.score > Save.data.hi;
    if (G.newRecord) Save.data.hi = G.score;
    Save.write();
    G.clearInfo = { timeBonus, tejas, coins: L.coinsGot, coinsTotal: L.coinsTotal, last: L.idx === LEVELS.length - 1 };
    Snd.music(null);
    if (G.clearInfo.last) { setState('ending'); Snd.play('win'); } else { setState('clear'); Snd.play('clear'); }
  }

  /* ===================== Actualización del juego ===================== */
  function frameInput() {
    const ctl = INC.controller ? INC.controller(L) : null;
    if (ctl) return { left: !!ctl.left, right: !!ctl.right, jump: !!ctl.jump, jumpP: !!ctl.jumpP, brickP: !!ctl.brickP, wallP: !!ctl.wallP };
    return { left: held('left'), right: held('right'), jump: held('jump'), jumpP: pressed('jump'), brickP: pressed('brick'), wallP: pressed('wall') };
  }

  function updatePlay(dt) {
    const inp = frameInput();
    if (!INC.controller && pressed('pause')) { setPause(true); return; }
    const p = L.player;
    if (!p.dead) {
      if (inp.jumpP) p.jumpBuf = P.JUMP_BUFFER;
      if (inp.brickP) tryBrick();
      if (inp.wallP) tryWall();
    }
    dt = Math.min(dt, 0.05);
    const n = Math.max(1, Math.ceil(dt / (1 / 120))), sub = dt / n;
    for (let i = 0; i < n && G.state === 'play'; i++) stepWorld(sub, inp);
    if (G.state === 'play') updateFx(dt);
  }

  function stepWorld(dt, inp) {
    const p = L.player;
    L.t += dt;
    updateMovers(dt);
    stepPlayer(dt, inp);
    updateCamera(dt);
    if (!p.dead) {
      updatePickups(dt);
      updateEnemies(dt, inp);
      L.time -= dt;
      if (L.time <= 0) { L.time = 0; killPlayer('tiempo'); addText(p.x - 30, p.y - 10, '¡SE ACABÓ EL TIEMPO!', B.danger); }
      const hurry = L.time < 30 && L.time > 0;
      if (hurry !== L.hurry) { L.hurry = hurry; Snd.hurry(hurry); if (hurry) banner('¡APÚRATE!', 1.5); }
    } else if (p.deadT > 1.7) {
      if (G.lives <= 0) { setState('over'); Snd.play('over'); } else respawn();
      return;
    }
    for (const [k, v] of L.temp) { if (v - dt <= 0) L.temp.delete(k); else L.temp.set(k, v - dt); }
    if (L.boss) { updateBoss(dt); updateRocks(dt); }
    L.hint = '';
    for (const h of L.def.hints || []) if (Math.abs((p.x + 5) / T - h.col) < (h.r || 3.5)) L.hint = h.text;
  }

  function updateCamera(dt) {
    const p = L.player;
    const maxX = Math.max(0, L.w * T - VW), maxY = Math.max(0, L.h * T - VH);
    if (L.scroll) {
      const s = L.scroll;
      if (!p.dead) {
        if (s.delay > 0) { s.delay -= dt; if (s.delay <= 0) { s.active = true; banner('¡CORRE! LA LLUVIA AVANZA', 2); } }
        else if (L.camX < s.max) L.camX = Math.min(s.max, L.camX + s.speed * (1 + Math.min(0.35, L.camX / s.max * 0.4)) * dt);
        if (L.camX < s.max && p.x < L.camX + 1) {
          p.x = L.camX + 1;
          if (overlapsSolid(p)) killPlayer('aplastado');
        }
        if (L.camX >= s.max - 0.5) p.x = clamp(p.x, L.camX + 2, L.camX + VW - p.w - 2);
      }
    } else {
      const target = clamp(p.x + p.w / 2 - VW / 2 + p.facing * 22, 0, maxX);
      L.camX += (target - L.camX) * (1 - Math.exp(-7 * dt));
    }
    const ty = clamp(p.y + p.h / 2 - VH * 0.55, 0, maxY);
    L.camY += (ty - L.camY) * (1 - Math.exp(-6 * dt));
    L.camX = clamp(L.camX, 0, maxX);
  }

  function updateFx(dt) {
    for (const q of L.particles) { q.t += dt; q.vy += 300 * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    L.particles = L.particles.filter(q => q.t < q.life);
    for (const t of L.texts) { t.t += dt; t.y -= 16 * dt; }
    L.texts = L.texts.filter(t => t.t < 1.4);
    if (L.banner) { L.banner.t -= dt; if (L.banner.t <= 0) L.banner = null; }
    L.flash = Math.max(0, L.flash - dt * 2);
    if (L.def.theme === 4) {
      L.thunderT -= dt;
      if (L.thunderT <= 0) { L.thunderT = rnd(5, 11); L.flash = 0.8; setTimeout(() => Snd.play('thunder'), 250); }
    }
    if (L.hurry && L.time < 11 && Math.floor(L.time) !== L.lastBeep && !L.player.dead) { L.lastBeep = Math.floor(L.time); Snd.play('warn'); }
  }

  /* ===================== Dibujo ===================== */
  const cloudCache = new Map();
  function cloudSprite(r) { const k = Math.round(r); let c = cloudCache.get(k); if (!c) { c = Art.cloud(k); cloudCache.set(k, c); } return c; }
  const tvar = (c, r) => (Art.h2(c, r, 3) * 4) | 0;
  const txt = (s, x, y, color = B.light, o = {}) => Font.draw(ctx, s, x, y, Object.assign({ color, shadow: B.dark }, o));
  function panel(x, y, w, h, fill = 'rgba(30,16,8,0.82)', border = B.secondary) {
    ctx.fillStyle = B.dark; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = border; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  }
  function button(label, x, y, w, h, action, sel) {
    G.buttons.push({ x, y, w, h, action });
    ctx.fillStyle = B.dark; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = sel ? B.secondary : B.primary; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = sel ? B.secondaryLight : B.primaryLight; ctx.fillRect(x, y, w, 1);
    ctx.fillStyle = sel ? B.secondaryDark : B.primaryDark; ctx.fillRect(x, y + h - 2, w, 2);
    Font.draw(ctx, label, x + w / 2, y + Math.floor((h - 7) / 2), { align: 'center', color: sel ? B.dark : B.light });
  }

  function drawTiles(cx, cy) {
    const c0 = Math.max(0, Math.floor(cx / T)), c1 = Math.min(L.w - 1, Math.floor((cx + VW) / T));
    const r0 = Math.max(0, Math.floor(cy / T)), r1 = Math.min(L.h - 1, Math.floor((cy + VH) / T));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      let ch = L.tiles[r][c];
      if (ch === ' ') {
        if (!L.temp.has(r * L.w + c)) continue;
        const left = L.temp.get(r * L.w + c);
        if (left < 1.6 && Math.floor(left * 10) % 2 === 0) continue;
        ch = 'W';
      }
      let v = 0;
      if (ch === '#' || ch === 'S') { const above = r > 0 ? L.tiles[r - 1][c] : '#'; v = tvar(c, r) + (SOLID_CH.has(above) || above === '/' || above === '\\' ? 0 : 4); }
      else if (ch === 'R') { const above = r > 0 ? L.tiles[r - 1][c] : ' '; v = tvar(c, r) + (above === ' ' || above === '=' ? 4 : 0); }
      ctx.drawImage(Art.tile(L.theme, ch, v), c * T, r * T);
    }
  }

  function drawBossBack() {
    const bs = L.boss, def = L.def.boss;
    const cxm = (def.arenaCol + (def.endCol - def.arenaCol) / 2) * T, base = def.floorRow * T;
    const sh = bs.shake > 0 ? Math.round(Math.sin(L.t * 90) * 2) : 0;
    const dead = bs.state === 'dying' || bs.state === 'dead';
    const open = bs.state === 'fight' || dead;
    ctx.save(); ctx.translate(sh, 0);
    // grieta zigzagueante en la pared del fondo
    const pts = [[0, 0], [-10, -22], [4, -40], [-14, -62], [2, -84], [-8, -108], [0, -132]];
    ctx.fillStyle = '#120a0e';
    ctx.beginPath();
    ctx.moveTo(cxm - 18, base);
    pts.forEach(([x, y], i) => ctx.lineTo(cxm - 22 + x - (i % 2 ? 6 : 0), base + y));
    ctx.lineTo(cxm, base - 150);
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(cxm + 22 - pts[i][0] + (i % 2 ? 6 : 0), base + pts[i][1]);
    ctx.lineTo(cxm + 18, base);
    ctx.fill();
    const glow = open ? 0.55 + 0.25 * Math.sin(L.t * 5) : 0.15;
    ctx.fillStyle = `rgba(255,${bs.flash > 0 ? 255 : 100},40,${glow})`;
    ctx.fillRect(cxm - 3, base - 135, 6, 134);
    // ojos
    const p = L.player, look = clamp((p.x - cxm) / 90, -1, 1);
    if (!dead || Math.floor(L.t * 12) % 2) {
      ctx.fillStyle = open ? (bs.flash > 0 ? '#fff' : '#ffd23a') : '#4a3a30';
      ctx.fillRect(cxm - 16, base - 92, 11, 7); ctx.fillRect(cxm + 5, base - 92, 11, 7);
      ctx.fillStyle = '#220606'; ctx.fillRect(cxm - 12 + look * 3, base - 91, 4, 5); ctx.fillRect(cxm + 9 + look * 3, base - 91, 4, 5);
      ctx.fillStyle = '#120a0e'; ctx.fillRect(cxm - 18, base - 96, 14, 3); ctx.fillRect(cxm + 4, base - 96, 14, 3);
    }
    // dientes
    ctx.fillStyle = open ? '#e8dcc0' : '#6a5a48';
    for (let i = 0; i < 6; i++) { ctx.fillRect(cxm - 15 + i * 6, base - 66, 4, 7 + (i % 2) * 3); ctx.fillRect(cxm - 15 + i * 6, base - 52 - (i % 2) * 3, 4, 6); }
    ctx.restore();
  }
  function drawCracks() {
    const def = L.def.boss;
    for (const k of L.boss.cracks) {
      const x = k.col * T, y = def.floorRow * T;
      if (k.state === 'warn') {
        const sh = Math.round(Math.sin(L.t * 70) * 1);
        ctx.fillStyle = `rgba(255,70,30,${0.35 + 0.3 * Math.sin(L.t * 14)})`; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = B.dark; ctx.fillRect(x + 7 + sh, y, 2, 6); ctx.fillRect(x + 5 - sh, y + 6, 2, 5); ctx.fillRect(x + 8 + sh, y + 11, 2, 5);
      } else {
        const g = ctx.createLinearGradient(0, y, 0, y + 70);
        g.addColorStop(0, 'rgba(255,110,30,0.85)'); g.addColorStop(1, 'rgba(255,110,30,0)');
        ctx.fillStyle = g; ctx.fillRect(x, y, T, 70);
        ctx.fillStyle = '#ffb060'; ctx.fillRect(x, y, 1, 4); ctx.fillRect(x + T - 1, y, 1, 4);
        // marca "sellar aquí"
        if (Math.floor(L.t * 3) % 2) { Font.draw(ctx, '▲', x + 8, y - 12, { align: 'center', color: B.secondaryLight }); }
      }
    }
  }

  function drawPlayer() {
    const p = L.player;
    if (!p.dead && p.invuln > 0 && Math.floor(L.t * 18) % 2 === 0) return;
    const frame = !p.grounded ? 'jump' : (Math.abs(p.vx) > 12 ? (Math.floor(p.anim * 1.6) % 2 ? 'runB' : 'runA') : 'idle');
    const spr = Art.ladri(frame, p.facing);
    const x = Math.round(p.x - 2), y = Math.round(p.y - 2);
    if (p.dead) { ctx.save(); ctx.translate(x + 7, y + 8); ctx.scale(1, -1); ctx.drawImage(Art.ladri('jump', p.facing), -7, -8); ctx.restore(); return; }
    ctx.drawImage(spr, x, y);
    if (p.helmet) {
      ctx.fillStyle = 'rgba(140,210,255,0.8)'; ctx.fillRect(x + 3, y + 1, 8, 3); ctx.fillRect(x + 2, y + 2, 10, 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(x + 4, y + 1, 3, 1);
      ctx.strokeStyle = `rgba(120,200,255,${0.5 + 0.3 * Math.sin(L.t * 8)})`; ctx.strokeRect(x - 0.5, y - 0.5, 15, 17);
    }
    if (p.barrow > 0) {
      const bx = p.facing > 0 ? x + 12 : x - 12;
      ctx.fillStyle = B.dark; ctx.fillRect(bx, y + 8, 13, 6); ctx.fillStyle = B.secondary; ctx.fillRect(bx + 1, y + 9, 11, 4); ctx.fillStyle = B.secondaryDark; ctx.fillRect(bx + 1, y + 12, 11, 1);
      ctx.fillStyle = B.dark; ctx.fillRect(p.facing > 0 ? bx - 4 : bx + 13, y + 7, 4, 2);
      Art.disc(ctx, p.facing > 0 ? bx + 11 : bx + 2, y + 14, 3, B.dark); Art.disc(ctx, p.facing > 0 ? bx + 11 : bx + 2, y + 14, 1, '#aaa');
      if (p.barrow < 2 && Math.floor(L.t * 10) % 2) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(bx, y + 8, 13, 6); }
    }
  }

  function drawEntities(cx, cy) {
    const t = L.t;
    // grúas
    for (const m of L.movers) Art.drawCrane(ctx, m, t);
    for (const cp of L.checkpoints) Art.drawCheckpoint(ctx, cp.x + 2, cp.y, cp.active, t);
    if (L.goal && !L.boss) Art.drawGoal(ctx, L.goal.x, L.goal.y, t);
    for (const c of L.coins) if (!c.got && c.x > cx - 16 && c.x < cx + VW + 16) {
      const f = Math.floor(t * 4 + c.ph) % 7; ctx.drawImage(Art.coin(f === 0 ? 1 : (f === 3 ? 2 : 0)), Math.round(c.x - 5), Math.round(c.y - 4 + Math.sin(t * 3 + c.ph) * 1.5));
    }
    const sv = Save.level(L.idx);
    for (const j of L.tejas) {
      if (j.got) continue;
      const y = j.y + Math.sin(t * 2.5 + j.ph) * 2.5;
      ctx.fillStyle = `rgba(255,220,90,${0.18 + 0.1 * Math.sin(t * 4 + j.ph)})`; Art.disc(ctx, Math.round(j.x), Math.round(y), 11, ctx.fillStyle);
      const f = Math.floor(t * 3 + j.ph) % 5;
      ctx.globalAlpha = sv.tejas[j.idx] ? 0.55 : 1;
      ctx.drawImage(Art.teja(f === 0 ? 1 : (f === 2 ? 2 : 0), false), Math.round(j.x - 7), Math.round(y - 6));
      ctx.globalAlpha = 1;
    }
    for (const u of L.pickups) if (!u.got) ctx.drawImage(Art.powerup(u.kind, 0), Math.round(u.x - 9), Math.round(u.y - 9 + Math.sin(t * 3 + u.ph) * 2));
    for (const e of L.enemies) {
      if (e.type === 'termite') {
        if (e.dead) ctx.drawImage(Art.termite(0, e.dir, true), Math.round(e.x), Math.round(e.y));
        else ctx.drawImage(Art.termite(Math.floor(e.t * 8) % 2, e.dir, false), Math.round(e.x), Math.round(e.y));
      } else if (e.type === 'drip') {
        ctx.fillStyle = B.dark; ctx.fillRect(e.hx - 1, e.hy, 8, 6); ctx.fillStyle = '#7d8590'; ctx.fillRect(e.hx, e.hy, 6, 4); ctx.fillStyle = '#b0b8c4'; ctx.fillRect(e.hx, e.hy, 6, 1);
        if (e.state === 'wait') { ctx.fillStyle = '#58b8ec'; ctx.fillRect(e.hx + 2, e.hy + 5, 2, 2); }
        else if (e.state === 'form') { const s = 2 + Math.floor(e.st / 0.85 * 5), sx = Math.round(Math.sin(e.st * 60) * (e.st > 0.5 ? 1 : 0)); ctx.fillStyle = '#58b8ec'; ctx.fillRect(e.hx + 3 - (s >> 1) + sx, e.hy + 5, s, s + 1); ctx.fillStyle = '#e8f8ff'; ctx.fillRect(e.hx + 3 - (s >> 1) + sx, e.hy + 5, 1, 1); }
        else if (e.state === 'fall') ctx.drawImage(Art.drip(Math.floor(t * 10) % 2), Math.round(e.x - 1), Math.round(e.y - 1));
        else if (e.state === 'splash' && e.st < 0.35) { ctx.fillStyle = '#9ad8f8'; const w = 4 + Math.floor(e.st * 30); ctx.fillRect(Math.round(e.x + 3 - w), Math.round(e.y + e.h - 2), w * 2, 1); ctx.fillRect(Math.round(e.x + 3 - w / 2), Math.round(e.y + e.h - 4), 1, 2); ctx.fillRect(Math.round(e.x + 3 + w / 2), Math.round(e.y + e.h - 4), 1, 2); }
      } else if (e.type === 'cloud' && !e.dead) {
        const s = cloudSprite(e.r);
        ctx.drawImage(s, Math.round(e.x - s.width / 2), Math.round(e.y - (e.r * 1.3 + 2)));
      }
    }
    for (const k of L.rocks) {
      if (k.state === 'warn') { const y = Math.round(L.camY + 30); if (Math.floor(L.t * 10) % 2) { ctx.fillStyle = B.danger; ctx.fillRect(Math.round(k.x) - 5, y, 10, 10); Font.draw(ctx, '!', Math.round(k.x), y + 2, { align: 'center', color: '#fff' }); } }
      else { const x = Math.round(k.x), y = Math.round(k.y); ctx.fillStyle = B.dark; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = '#8a7a66'; ctx.fillRect(x - 4, y - 4, 8, 8); ctx.fillStyle = '#b3a38c'; ctx.fillRect(x - 4, y - 4, 8, 2); ctx.fillStyle = '#5a4c3c'; ctx.fillRect(x, y, 4, 4); }
    }
    drawPlayer();
    for (const q of L.particles) { ctx.globalAlpha = Math.max(0, 1 - q.t / q.life); ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size); }
    ctx.globalAlpha = 1;
    for (const tx of L.texts) { ctx.globalAlpha = Math.min(1, (1.4 - tx.t) * 3); Font.draw(ctx, tx.text, Math.round(tx.x), Math.round(tx.y), { color: tx.color, shadow: B.dark }); }
    ctx.globalAlpha = 1;
  }

  function drawRain() {
    ctx.strokeStyle = 'rgba(190,215,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 80; i++) {
      const x = (i * 53 + L.t * 90) % (VW + 40) - 20, y = (i * 97 + L.t * 460) % (VH + 40) - 20;
      ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 9);
    }
    ctx.stroke();
    if (L.scroll && L.camX < L.scroll.max - 4) { // pared de lluvia que avanza
      const g = ctx.createLinearGradient(0, 0, 36, 0);
      g.addColorStop(0, 'rgba(120,160,230,0.9)'); g.addColorStop(1, 'rgba(120,160,230,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 36, VH);
      ctx.fillStyle = 'rgba(220,235,255,0.7)';
      for (let i = 0; i < 24; i++) { const y = (i * 41 + L.t * 300) % VH; ctx.fillRect((i * 7) % 14, y, 1, 10); }
    }
  }

  function drawHUD() {
    const p = L.player;
    ctx.fillStyle = 'rgba(30,16,8,0.7)'; ctx.fillRect(0, 0, VW, 24);
    ctx.fillStyle = B.primary; ctx.fillRect(0, 24, VW, 1);
    const lab = (s, x) => Font.draw(ctx, s, x, 3, { color: B.secondaryLight });
    lab('VIDAS', 6); Font.draw(ctx, '♥', 6, 13, { color: B.danger }); txt('x' + G.lives, 14, 13, B.light, { shadow: null });
    lab('PUNTOS', 52); Font.draw(ctx, pad(G.score, 6), 52, 13, { color: B.light });
    lab('LADRILLITOS', 104); ctx.drawImage(Art.coin(0), 103, 11); Font.draw(ctx, 'x' + L.coinsGot, 116, 13, { color: B.light });
    lab('TEJAS', 178);
    for (let i = 0; i < 3; i++) { ctx.globalAlpha = L.tejasGot[i] ? 1 : 0.35; ctx.drawImage(Art.teja(0, !L.tejasGot[i]), 178 + i * 15, 12, 12, 10); ctx.globalAlpha = 1; }
    lab('APILAR', 232); ctx.fillStyle = B.dark; ctx.fillRect(231, 12, 11, 9); ctx.fillStyle = B.primary; ctx.fillRect(232, 13, 9, 7); ctx.fillStyle = B.primaryLight; ctx.fillRect(232, 13, 9, 1);
    Font.draw(ctx, 'x' + L.bricks, 245, 13, { color: L.bricks > 0 ? B.light : B.danger });
    lab('PODERES', 290);
    let sx = 290;
    if (p.helmet) { ctx.drawImage(Art.powerup('H', 0), sx - 3, 8, 16, 16); sx += 18; }
    if (p.barrow > 0) { ctx.drawImage(Art.powerup('W', 0), sx - 3, 8, 16, 16); Font.draw(ctx, String(Math.ceil(p.barrow)), sx + 14, 13, { color: B.light }); sx += 26; }
    if (L.wallCharges > 0) { ctx.drawImage(Art.powerup('M', 0), sx - 3, 8, 16, 16); Font.draw(ctx, 'x' + L.wallCharges, sx + 14, 13, { color: B.light }); sx += 28; }
    if (sx === 290) Font.draw(ctx, '-', 290, 13, { color: '#8a7a6a' });
    lab('NIVEL ' + (L.idx + 1), 364);
    Font.draw(ctx, TH_NAME(), 364, 13, { color: B.light });
    const tl = Math.ceil(L.time);
    lab('TIEMPO', 443); Font.draw(ctx, pad(tl, 3), 443, 13, { color: L.time < 30 ? (Math.floor(L.t * 4) % 2 ? B.danger : B.light) : B.light });
    // pista
    if (L.hint && G.state === 'play') {
      const w = Font.width(L.hint) + 14;
      panel(Math.round(VW / 2 - w / 2), 30, w, 15, 'rgba(30,16,8,0.82)', B.secondaryDark);
      Font.draw(ctx, L.hint, VW / 2, 34, { align: 'center', color: B.secondaryLight });
    }
    if (L.banner) {
      const b = L.banner, a = Math.min(1, b.t * 3, (b.max - b.t) * 6);
      ctx.globalAlpha = Math.max(0, a);
      Font.draw(ctx, b.text, VW / 2, 82, { align: 'center', color: B.secondaryLight, shadow: B.dark, scale: 3 });
      if (b.sub) Font.draw(ctx, b.sub, VW / 2, 112, { align: 'center', color: B.light, shadow: B.dark });
      ctx.globalAlpha = 1;
    }
    if (L.boss && (L.boss.state === 'fight' || L.boss.state === 'dying')) {
      const bs = L.boss, w = 150, x = VW / 2 - w / 2;
      txt('LA GRIETA', VW / 2, 30, B.light, { align: 'center' });
      ctx.fillStyle = B.dark; ctx.fillRect(x - 2, 40, w + 4, 9);
      ctx.fillStyle = '#4a1a18'; ctx.fillRect(x, 42, w, 5);
      ctx.fillStyle = bs.flash > 0 ? '#fff' : B.danger; ctx.fillRect(x, 42, Math.max(0, w * bs.hp / bs.maxHp), 5);
    }
  }
  const TH_NAME = () => L.def.name.toUpperCase();

  function drawWorld() {
    const cx = Math.round(L.camX), cy = Math.round(L.camY);
    Art.drawBackground(ctx, L.theme, L.camX, L.camY, L.t, VW, VH, L.flash);
    ctx.save();
    const sk = L.boss && L.boss.shake > 0 ? 2 : 0;
    ctx.translate(-cx + (sk ? Math.round(rnd(-sk, sk)) : 0), -cy + (sk ? Math.round(rnd(-sk, sk)) : 0));
    if (L.boss) drawBossBack();
    drawTiles(cx, cy);
    if (L.boss) drawCracks();
    drawEntities(cx, cy);
    ctx.restore();
    if (L.theme === 4) drawRain();
    drawHUD();
  }

  /* ----- Pantallas ----- */
  function mutedLabel() { return 'SONIDO: ' + (Snd.muted ? 'NO' : 'SÍ'); }
  function drawTitle() {
    Art.drawBackground(ctx, 0, G.t * 28, 0, G.t, VW, VH, 0);
    const off = Math.floor(G.t * 60);
    for (let c = -1; c < VW / T + 2; c++) {
      const wc = c + Math.floor(off / T);
      ctx.drawImage(Art.tile(0, '#', 4 + tvar(wc, 0)), c * T - (off % T), VH - 3 * T);
      ctx.drawImage(Art.tile(0, '#', tvar(wc, 1)), c * T - (off % T), VH - 2 * T);
      ctx.drawImage(Art.tile(0, '#', tvar(wc, 2)), c * T - (off % T), VH - T);
    }
    // Ladri corriendo
    const fr = Math.floor(G.t * 7) % 2 ? 'runA' : 'runB';
    ctx.drawImage(Art.ladri(fr, 1), VW / 2 - 21, VH - 3 * T - 48, 42, 48);
    // cartel del logo
    const w = 300, x = VW / 2 - w / 2, y = 26, L0 = C.LOGO;
    ctx.fillStyle = B.dark; ctx.fillRect(x - 4, y - 4, w + 8, 74);
    ctx.fillStyle = L0.border; ctx.fillRect(x - 2, y - 2, w + 4, 70);
    ctx.fillStyle = L0.background; ctx.fillRect(x, y, w, 66);
    Font.draw(ctx, L0.tagTop, VW / 2 + 12, y + 6, { align: 'center', color: L0.foreground });
    Font.draw(ctx, L0.tagBottom, VW / 2 + 12, y + 54, { align: 'center', color: L0.foreground });
    Font.draw(ctx, L0.text, VW / 2 + 12, y + 19, { align: 'center', color: L0.foreground, scale: 4 });
    ctx.fillStyle = L0.foreground; // icono de baldosas del logo
    for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) ctx.fillRect(x + 12 + k * 9, y + 19 + i * 9, 7, 7);
    Font.draw(ctx, C.SUBTITLE, VW / 2, y + 82, { align: 'center', color: B.secondary, shadow: B.dark, scale: 3 });
    G.buttons.push({ x: 0, y: 0, w: VW, h: VH - 20, action: 'confirm' });
    if (Math.floor(G.t * 2) % 2 === 0) txt(document.body.classList.contains('touch') ? 'TOCA LA PANTALLA PARA JUGAR' : 'PRESIONA ENTER PARA JUGAR', VW / 2, 138, B.light, { align: 'center' });
    txt('RÉCORD ' + pad(Save.data.hi, 6), VW / 2, 152, B.secondaryLight, { align: 'center' });
    txt('INCERPAZ · CERÁMICA Y MATERIALES DE CONSTRUCCIÓN · BOLIVIA', VW / 2, VH - 12, B.light, { align: 'center' });
    button(mutedLabel(), VW - 86, 6, 80, 14, 'mute', false);
  }
  function wrap(text, maxChars) {
    const words = text.split(' '), lines = []; let cur = '';
    for (const w of words) { if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
    if (cur) lines.push(cur); return lines;
  }
  function drawStory() {
    Art.drawBackground(ctx, 0, 0, 0, G.t, VW, VH, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, VW, VH);
    // tormenta que se acerca
    ctx.fillStyle = 'rgba(20,28,50,0.65)'; for (let i = 0; i < 5; i++) { const x = (i * 130 - G.t * 8) % 560 - 60; ctx.fillRect(x, 6 + (i % 2) * 8, 150, 26); ctx.fillRect(x + 30, 0, 90, 18); }
    Art.drawHouse(ctx, 24, VH - 28, 1.7, 2 + (Math.floor(G.t / 1.5) % 4), G.t, false);
    ctx.fillStyle = '#6b6b6b'; ctx.fillRect(0, VH - 28, VW, 28);
    const bx = 236, by = 40;
    panel(bx, by, 228, 170, 'rgba(30,16,8,0.9)');
    txt('LA HISTORIA', bx + 114, by + 10, B.secondary, { align: 'center', scale: 2 });
    const story = 'Una familia necesita su casa terminada antes de que llegue la tormenta. Ladri, el ladrillo de casco amarillo, recorre la obra juntando materiales para levantarla a tiempo. ¡Ayúdalo a terminar LA GRAN OBRA!';
    wrap(story, 35).forEach((ln, i) => txt(ln, bx + 10, by + 36 + i * 13, B.light));
    ctx.drawImage(Art.ladri('idle', -1), bx + 190, by + 134, 28, 32);
    button('SIGUIENTE', bx + 10, by + 146, 100, 16, 'confirm', true);
  }
  function drawSelect() {
    Art.drawBackground(ctx, 0, G.t * 10, 0, G.t, VW, VH, 0);
    ctx.fillStyle = 'rgba(30,16,8,0.45)'; ctx.fillRect(0, 0, VW, VH);
    txt('ELIGE LA ETAPA DE LA OBRA', VW / 2, 12, B.secondary, { align: 'center', scale: 2 });
    const cw = 84, gap = 8, x0 = (VW - (cw * 5 + gap * 4)) / 2, y0 = 40, ch = 112;
    for (let i = 0; i < LEVELS.length; i++) {
      const lv = LEVELS[i], x = x0 + i * (cw + gap), unlocked = i < Save.data.unlocked, sel = i === G.cursor, sv = Save.data.levels[i];
      const y = y0 + (sel ? -3 + Math.round(Math.sin(G.t * 6) * 1) : 0);
      G.buttons.push({ x, y: y0, w: cw, h: ch, action: 'card' + i });
      ctx.fillStyle = B.dark; ctx.fillRect(x - 2, y - 2, cw + 4, ch + 4);
      ctx.fillStyle = sel ? B.secondary : '#5a4a3a'; ctx.fillRect(x - 1, y - 1, cw + 2, ch + 2);
      const th = CONFIG.THEMES[lv.theme];
      const g = ctx.createLinearGradient(0, y, 0, y + 50); g.addColorStop(0, th.skyTop); g.addColorStop(1, th.skyBottom);
      ctx.fillStyle = unlocked ? g : '#555'; ctx.fillRect(x, y, cw, 50);
      ctx.fillStyle = unlocked ? th.groundTop : '#444'; ctx.fillRect(x, y + 40, cw, 4); ctx.fillStyle = unlocked ? th.ground : '#333'; ctx.fillRect(x, y + 44, cw, 6);
      ctx.fillStyle = 'rgba(30,16,8,0.9)'; ctx.fillRect(x, y + 50, cw, ch - 50);
      txt(String(i + 1), x + cw / 2, y + 12, unlocked ? '#fff' : '#999', { align: 'center', scale: 3 });
      const nm = wrap(lv.name.toUpperCase(), 13);
      nm.forEach((s, k) => txt(s, x + cw / 2, y + 56 + k * 9, unlocked ? B.light : '#888', { align: 'center' }));
      if (unlocked) {
        for (let k = 0; k < 3; k++) { ctx.globalAlpha = sv && sv.tejas[k] ? 1 : 0.3; ctx.drawImage(Art.teja(0, !(sv && sv.tejas[k])), x + cw / 2 - 22 + k * 15, y + 78, 12, 10); ctx.globalAlpha = 1; }
        txt(sv && sv.best ? pad(sv.best, 6) : 'NUEVO', x + cw / 2, y + 94, B.secondaryLight, { align: 'center' });
      } else txt('BLOQUEADO', x + cw / 2, y + 86, '#aa6a5a', { align: 'center' });
    }
    const cleared = Object.values(Save.data.levels).filter(v => v && v.clear).length;
    Art.drawHouse(ctx, VW / 2 - 70, VH - 12, 1.15, Math.min(5, cleared), G.t, true);
    txt('LA CASA DE LA FAMILIA: ' + cleared + ' / ' + LEVELS.length + ' ETAPAS', VW / 2, 164, B.light, { align: 'center' });
    txt('← → ELEGIR   ENTER JUGAR   ESC VOLVER', VW / 2, 180, B.secondaryLight, { align: 'center' });
    txt('RÉCORD ' + pad(Save.data.hi, 6), 10, 6, B.secondaryLight);
    button(mutedLabel(), VW - 86, 6, 80, 14, 'mute', false);
    button('VOLVER', 6, VH - 22, 60, 16, 'back', false);
  }
  function drawIntro() {
    drawWorld();
    ctx.fillStyle = 'rgba(20,10,5,0.78)'; ctx.fillRect(0, 70, VW, 120);
    ctx.fillStyle = B.secondary; ctx.fillRect(0, 70, VW, 2); ctx.fillRect(0, 188, VW, 2);
    txt('NIVEL ' + (L.idx + 1), VW / 2, 82, B.secondaryLight, { align: 'center', scale: 2 });
    txt(L.def.name.toUpperCase(), VW / 2, 104, B.light, { align: 'center', scale: 4 });
    wrap(L.def.intro, 60).forEach((s, i) => txt(s, VW / 2, 140 + i * 12, B.light, { align: 'center' }));
    txt('LADRILLOS PARA APILAR: ' + L.bricks + '   ·   TEJAS DORADAS ESCONDIDAS: 3', VW / 2, 172, B.secondaryLight, { align: 'center' });
    G.buttons.push({ x: 0, y: 0, w: VW, h: VH, action: 'confirm' });
  }
  function drawPause() {
    drawWorld();
    ctx.fillStyle = 'rgba(15,8,4,0.78)'; ctx.fillRect(0, 0, VW, VH);
    txt('PAUSA', VW / 2, 34, B.secondary, { align: 'center', scale: 4 });
    const lines = ['← → / A D: MOVERSE', 'ESPACIO / ↑ / W: SALTAR (MANTÉN PARA SALTAR MÁS ALTO)', '↓ / S / X: APILAR UN LADRILLO BAJO LOS PIES', 'C / SHIFT: MURO INSTANTÁNEO (SI TIENES)', 'P / ESC: PAUSA   ·   M: SONIDO'];
    lines.forEach((s, i) => txt(s, VW / 2, 78 + i * 13, B.light, { align: 'center' }));
    button('CONTINUAR', VW / 2 - 70, 156, 140, 18, 'confirm', true);
    button(mutedLabel(), VW / 2 - 70, 180, 140, 18, 'mute', false);
    button('SALIR AL MENÚ', VW / 2 - 70, 204, 140, 18, 'quit', false);
  }
  function drawClear() {
    drawWorld();
    ctx.fillStyle = 'rgba(15,8,4,0.8)'; ctx.fillRect(0, 0, VW, VH);
    const ci = G.clearInfo;
    panel(110, 36, 260, 190);
    txt('¡NIVEL COMPLETADO!', VW / 2, 48, B.secondary, { align: 'center', scale: 2 });
    txt(L.def.name.toUpperCase(), VW / 2, 70, B.light, { align: 'center' });
    const row = (a, b, y) => { txt(a, 130, y, B.light); txt(b, 350, y, B.secondaryLight, { align: 'right' }); };
    row('BONO DE TIEMPO', '+' + ci.timeBonus, 92);
    row('BONO DE NIVEL', '+' + C.SCORE.levelClear, 106);
    row('LADRILLITOS', ci.coins + ' / ' + ci.coinsTotal, 120);
    txt('TEJAS DORADAS', 130, 134, B.light);
    for (let i = 0; i < 3; i++) { ctx.globalAlpha = L.tejasGot[i] ? 1 : 0.3; ctx.drawImage(Art.teja(0, !L.tejasGot[i]), 296 + i * 18, 133, 14, 12); ctx.globalAlpha = 1; }
    row('PUNTAJE', pad(G.score, 6), 154);
    if (G.newRecord) txt('¡NUEVO RÉCORD!', VW / 2, 172, Math.floor(G.t * 4) % 2 ? B.secondary : B.light, { align: 'center' });
    button('SIGUIENTE ETAPA', VW / 2 - 70, 192, 140, 18, 'confirm', true);
  }
  function drawOver() {
    drawWorld();
    ctx.fillStyle = 'rgba(10,5,10,0.82)'; ctx.fillRect(0, 0, VW, VH);
    txt('FIN DEL JUEGO', VW / 2, 56, B.danger, { align: 'center', scale: 4 });
    txt(L.deathReason === 'aplastado' || L.def.theme === 4 ? 'LA TORMENTA GANÓ ESTA VEZ...' : 'LA OBRA SIGUE ESPERANDO...', VW / 2, 100, B.light, { align: 'center' });
    txt('PUNTAJE ' + pad(G.score, 6) + '   ·   RÉCORD ' + pad(Save.data.hi, 6), VW / 2, 120, B.secondaryLight, { align: 'center' });
    button('REINTENTAR ETAPA', VW / 2 - 80, 150, 160, 18, 'confirm', true);
    button('MENÚ DE ETAPAS', VW / 2 - 80, 176, 160, 18, 'quit', false);
  }
  function drawEnding() {
    const t = G.stateT;
    Art.drawBackground(ctx, 0, 120 + t * 10, 0, G.t, VW, VH, 0);
    ctx.fillStyle = '#6fa83a'; ctx.fillRect(0, VH - 40, VW, 40); ctx.fillStyle = '#4f8a2a'; ctx.fillRect(0, VH - 40, VW, 3);
    ctx.fillStyle = '#d9c9a0'; ctx.fillRect(110, VH - 40, 70, 40);
    Art.drawHouse(ctx, 96, VH - 40, 2.4, 5, G.t, true);
    // familia saludando
    const fam = [[340, 30, '#3a6ea5'], [362, 24, '#c0504d'], [382, 17, '#e0a030'], [398, 13, '#5aa05a']];
    fam.forEach(([x, h, col], i) => {
      const y = VH - 40;
      ctx.fillStyle = B.dark; ctx.fillRect(x - 1, y - h - 1, 9, h + 1);
      ctx.fillStyle = col; ctx.fillRect(x, y - h * 0.65, 7, h * 0.65);
      ctx.fillStyle = '#f0c8a0'; ctx.fillRect(x + 1, y - h, 5, h * 0.35);
      const w = Math.sin(G.t * 8 + i) > 0 ? 5 : 2;
      ctx.fillStyle = '#f0c8a0'; ctx.fillRect(x - 2, y - h * 0.65 - w + 2, 2, 5);
    });
    ctx.drawImage(Art.ladri(Math.sin(G.t * 6) > 0.6 ? 'jump' : 'idle', -1), 300, VH - 40 - 16 - Math.max(0, Math.sin(G.t * 6)) * 6, 28, 32);
    // sol y confeti
    ctx.fillStyle = '#fff6c8'; Art.disc(ctx, 420, 56, 20, '#fff6c8');
    for (let i = 0; i < 40; i++) {
      const x = (i * 47 + Math.sin(G.t + i) * 20) % VW, y = (i * 31 + G.t * 60) % VH;
      ctx.fillStyle = [B.primary, B.secondary, B.accent, B.good][i % 4]; ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
    }
    panel(60, 14, 360, 44, 'rgba(30,16,8,0.85)');
    txt('¡LA CASA ESTÁ LISTA!', VW / 2, 22, B.secondary, { align: 'center', scale: 3 });
    txt('LADRI Y LA FAMILIA AGRADECEN A INCERPAZ', VW / 2, 46, B.light, { align: 'center' });
    txt('PUNTAJE FINAL ' + pad(G.score, 6) + (G.newRecord ? '  ¡NUEVO RÉCORD!' : '   RÉCORD ' + pad(Save.data.hi, 6)), VW / 2, 66, B.secondaryLight, { align: 'center' });
    button('VOLVER AL MENÚ', VW / 2 - 70, 90, 140, 18, 'confirm', true);
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    G.buttons = [];
    switch (G.state) {
      case 'title': drawTitle(); break;
      case 'story': drawStory(); break;
      case 'select': drawSelect(); break;
      case 'intro': drawIntro(); break;
      case 'play': drawWorld(); break;
      case 'pause': drawPause(); break;
      case 'clear': drawClear(); break;
      case 'over': drawOver(); break;
      case 'ending': drawEnding(); break;
    }
  }

  /* ===================== Estados y menús ===================== */
  function setState(s) {
    G.state = s; G.stateT = 0;
    if (s === 'title' || s === 'story' || s === 'select') Snd.music('title');
    if (s === 'intro' || s === 'clear' || s === 'over' || s === 'ending') { Snd.music(null); Snd.hurry(false); }
    if (s === 'play') Snd.music(musicFor());
  }
  function setPause(on) {
    if (on && G.state === 'play') { setState('pause'); Snd.pauseMusic(true); Snd.play('pause'); }
    else if (!on && G.state === 'pause') { G.state = 'play'; G.stateT = 0; Snd.pauseMusic(false); Snd.play('pause'); }
  }
  function startRun(idx) {
    G.lives = C.START_LIVES; G.score = 0; G.coinsRun = 0; G.levelIndex = idx;
    loadLevel(idx); setState('intro');
  }
  function nextLevel() { G.levelIndex++; loadLevel(G.levelIndex); setState('intro'); }
  function toSelect() { G.cursor = clamp(Math.min(G.levelIndex, Save.data.unlocked - 1), 0, LEVELS.length - 1); setState('select'); }

  function doAction(a) {
    Snd.unlock();
    switch (a) {
      case 'mute': Snd.toggleMute(); return;
      case 'confirm': confirm(); return;
      case 'back': back(); return;
      case 'quit': toSelect(); Snd.play('select'); return;
    }
    if (a.startsWith('card')) {
      const i = +a.slice(4);
      if (G.state !== 'select') return;
      if (i >= Save.data.unlocked) { Snd.play('no'); return; }
      G.cursor = i; Snd.play('ok'); startRun(i);
    }
  }
  function confirm() {
    switch (G.state) {
      case 'title': Snd.play('ok'); if (Save.data.seenStory) toSelect(); else setState('story'); break;
      case 'story': Save.data.seenStory = true; Save.write(); Snd.play('ok'); toSelect(); break;
      case 'select': if (G.cursor < Save.data.unlocked) { Snd.play('ok'); startRun(G.cursor); } else Snd.play('no'); break;
      case 'intro': setState('play'); break;
      case 'pause': setPause(false); break;
      case 'clear': Snd.play('ok'); nextLevel(); break;
      case 'over': Snd.play('ok'); startRun(G.levelIndex); break;
      case 'ending': Snd.play('ok'); toSelect(); break;
    }
  }
  function back() {
    if (G.state === 'select') { setState('title'); Snd.play('select'); }
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); Snd.unlock();
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * VW / r.width, y = (e.clientY - r.top) * VH / r.height;
    for (let i = G.buttons.length - 1; i >= 0; i--) {
      const b = G.buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { doAction(b.action); return; }
    }
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  function update(dt) {
    G.t += dt; G.stateT += dt;
    if (pressed('mute')) Snd.toggleMute();
    switch (G.state) {
      case 'title': case 'story': case 'intro': case 'clear': case 'over': case 'ending':
        if (pressed('confirm') || (G.state === 'title' && pressed('pause'))) confirm();
        if (G.state === 'over' && pressed('back')) toSelect();
        if (G.state === 'intro' && G.stateT > 3.2) setState('play');
        break;
      case 'select':
        if (pressed('left')) { G.cursor = Math.max(0, G.cursor - 1); Snd.play('select'); }
        if (pressed('right')) { G.cursor = Math.min(LEVELS.length - 1, G.cursor + 1); Snd.play('select'); }
        if (pressed('confirm')) confirm();
        if (pressed('back')) back();
        break;
      case 'play': updatePlay(dt); break;
      case 'pause':
        if (pressed('pause') || pressed('confirm')) setPause(false);
        else if (keysPressed.has('KeyQ')) toSelect();
        break;
    }
    // el nivel sigue vivo de fondo en las pantallas con mundo
    if (L && (G.state === 'intro')) { L.t += dt; }
    keysPressed.clear(); touchPressed.clear();
  }

  /* ===================== Bucle principal ===================== */
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (INC.manual) { last = now; return; }
    let dt = (now - last) / 1000; last = now;
    if (!(dt > 0)) return;
    update(Math.min(dt, 0.1));
    render();
  }
  Object.defineProperty(INC, 'L', { get: () => L });
  Object.assign(INC, {
    update, render, G, Save, startRun, setState,
    tileAt: (c, r) => tileAt(c, r), T,
    jumpToLevel(i) { loadLevel(i); G.levelIndex = i; G.lives = 3; G.score = 0; setState('play'); }
  });
  render();
  requestAnimationFrame(frame);
})();

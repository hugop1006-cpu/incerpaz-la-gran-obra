// Bot de prueba: corre hacia la derecha saltando obstáculos, sube a grúas, sella grietas.
(() => {
  const INC = window.INCERPAZ, T = 16;
  const SOL = c => '#BRSTW'.includes(c);
  const GR = c => SOL(c) || c === '=' || c === '/' || c === '\\';
  const st = { frames: 0, deaths: 0, lastX: 0, stuckT: 0, brickCool: 0, jumpHold: 0, log: [], lastLives: 3, wait: 0 };
  function ctl(L) {
    const p = L.player, out = { left: false, right: true, jump: false, jumpP: false, brickP: false, wallP: false };
    st.frames++;
    if (p.dead) return { left: false, right: false };
    const tile = (c, r) => INC.tileAt(c, r);
    const fr = Math.floor((p.y + p.h - 1) / T);       // fila de los pies
    const cR = Math.floor((p.x + p.w + 3) / T);        // columna justo delante
    const cC = Math.floor((p.x + p.w / 2) / T);
    const feet = p.y + p.h;
    st.brickCool -= 1;
    const pressJump = () => { if (p.grounded || p.coyote > 0) { out.jumpP = !st.jumpHold; } out.jump = true; st.jumpHold = 22; };
    if (st.jumpHold > 0) { out.jump = true; st.jumpHold--; }

    // ---- jefe ----
    if (L.boss && L.boss.state === 'fight') {
      const def = L.def.boss, bs = L.boss;
      out.right = false;
      const open = bs.cracks.filter(k => k.state === 'open');
      const warn = bs.cracks.filter(k => k.state === 'warn');
      let target = null;
      if (open.length) {
        open.sort((a, b) => Math.abs(a.col - cC) - Math.abs(b.col - cC));
        const k = open[0];
        // quedar adyacente (sin cruzar otras grietas)
        const side = cC < k.col ? -1 : 1;
        target = (k.col + side) * T + 3;
        if (Math.abs(cC - k.col) <= 1 && p.grounded) { out.brickP = true; }
      } else target = (def.arenaCol + 14) * T;
      // evitar columnas con aviso
      for (const w of warn) if (Math.abs(cC - w.col) <= 1) target = (w.col + (cC <= w.col ? -3 : 3)) * T;
      // rocas
      for (const r of L.rocks) if (r.state !== 'warn' && Math.abs(r.x - (p.x + 5)) < 18 && r.y < p.y) target = p.x + (r.x < p.x + 5 ? 40 : -40);
      for (const r of L.rocks) if (r.state === 'warn' && Math.abs(r.x - (p.x + 5)) < 20) target = p.x + (r.x < p.x + 5 ? 40 : -40);
      if (target !== null) { if (p.x < target - 3) out.right = true; else if (p.x > target + 3) out.left = true; }
      // no caer en grietas abiertas: si hay vacío justo adelante, detenerse
      const dirc = out.right ? 1 : out.left ? -1 : 0;
      if (dirc) { const c = Math.floor((p.x + p.w / 2 + dirc * 9) / T); if (!GR(tile(c, fr + 1)) && !GR(tile(c, fr + 2))) { out.right = out.left = false; } }
      return out;
    }

    // ---- sobre plataforma móvil ----
    if (p.ride) {
      out.right = false;
      let gx = null;
      for (let x = p.x + p.w; x < p.x + p.w + 70 && gx === null; x += 4) {
        const c = Math.floor(x / T);
        for (let r = fr - 1; r <= fr + 1; r++) {
          if (SOL(tile(c, r)) && !SOL(tile(c, r - 1)) && Math.abs(r * T - feet) <= 8) { gx = x; break; }
        }
      }
      if (gx !== null) {
        const gap = gx - (p.x + p.w), edge = p.x + p.w >= p.ride.x + p.ride.w - 3;
        out.right = true;
        if (gap <= 22 || (edge && gap <= 36)) pressJump(); else if (edge) out.right = false;
      }
      return out;
    }

    // atasco
    if (Math.abs(p.x - st.lastX) < 0.4) st.stuckT++; else { st.stuckT = 0; st.lastX = p.x; }
    if (st.stuckT > 150 && p.grounded) { pressJump(); if (st.stuckT > 210 && st.brickCool <= 0 && L.bricks > 0) { out.brickP = true; st.brickCool = 40; } if (st.stuckT > 400) { out.right = false; out.left = true; } }

    // ---- hacia adelante ----
    // altura de la pared delante
    let h = 0;
    for (let r = fr; r > fr - 8; r--) { if (SOL(tile(cR, r))) h++; else if (h > 0) break; else if (r < fr - 1) break; }
    // pared que empieza a la altura de los pies
    let wallH = 0;
    if (SOL(tile(cR, fr)) || SOL(tile(cR, fr - 1))) { wallH = 0; for (let r = fr; r >= 0 && SOL(tile(cR, r)); r--) wallH++; }
    if (wallH > 0) {
      const dist = (cR * T) - (p.x + p.w);
      if (wallH <= 3) { if (dist < 10) pressJump(); }
      else {
        if (dist < 6 && p.grounded && L.bricks > 0 && st.brickCool <= 0) { out.brickP = true; st.brickCool = 25; }
        else if (dist < 10 && p.grounded && st.brickCool > 0 && st.brickCool < 22) pressJump();
        else if (!p.grounded) { /* esperando */ }
        if (p.grounded && wallH <= 3 + (p.y < 0 ? 0 : 0)) pressJump();
      }
      // si tras apilar ya podemos subir, intentar saltar
      if (p.grounded && st.brickCool < 20 && wallH > 3) pressJump();
    }
    // precipicio / vacío
    const cAhead = Math.floor((p.x + p.w + 6) / T);
    const noGround = c => { for (let r = fr + 1; r <= fr + 3; r++) if (GR(tile(c, r))) return false; return true; };
    if (p.grounded && noGround(cAhead) && !SOL(tile(cAhead, fr))) {
      // ¿hay plataforma móvil alineada?
      const mv = L.movers.find(m => Math.abs(m.y - feet) < 10 && m.x < p.x + p.w + 30 && m.x + m.w > p.x + p.w - 2);
      const anyMover = L.movers.some(m => m.x0 < p.x + 130 && m.x1 + m.w > p.x - 10 && Math.abs(m.y0 - feet) < 100 || Math.abs(m.y1 - feet) < 100 && m.x0 < p.x + 130 && m.x1 + m.w > p.x);
      if (mv) { out.right = true; pressJump(); }
      else if (anyMover && L.movers.some(m => m.x0 + m.w > p.x && m.x0 < p.x + 60)) { out.right = false; }
      else pressJump();
    }
    // peligros
    for (let c = cC; c <= cC + 2; c++) if (tile(c, fr) === '^') { const d = c * T - (p.x + p.w); if (d < 12 && d > -10) pressJump(); }
    // enemigos
    for (const e of L.enemies) {
      if (e.dead) continue;
      if (e.type === 'termite' || e.type === 'cloud') {
        const ex = e.type === 'cloud' ? e.x - e.w / 2 : e.x, ew = e.type === 'cloud' ? e.w : e.w;
        const dx = ex - (p.x + p.w);
        if (dx > -4 && dx < 30 && Math.abs((e.y + (e.h || 0) / 2) - (p.y + 7)) < 26) pressJump();
        if (e.type === 'cloud' && dx > -4 && dx < 44 && e.r > 12 && Math.abs(e.y - (p.y + 7)) < 40) { out.right = false; if (p.grounded && Math.random() < 0.02) pressJump(); }
      } else if (e.type === 'drip') {
        const dx = (e.x + 3) - (p.x + 5);
        if ((e.state === 'form' || e.state === 'fall') && Math.abs(dx) < 22 && dx > -6) out.right = dx > 10 ? true : (st.frames % 2 ? false : true);
      }
    }
    return out;
  }
  window.BOT = {
    st,
    start(i, lives) { INC.controller = ctl; INC.jumpToLevel(i); INC.G.lives = lives || 99; st.frames = 0; st.deaths = 0; st.log = []; st.stuckT = 0; st.lastX = 0; st.jumpHold = 0; st.lastLives = INC.G.lives; },
    step(n) {
      const G = INC.G;
      for (let k = 0; k < n; k++) {
        if (G.state === 'clear' || G.state === 'ending') return { done: true, frames: st.frames, deaths: st.deaths, deathLog: JSON.stringify(st.log.slice(0, 25)), time: Math.round(INC.L.time), score: G.score, tejas: INC.L.tejasGot.filter(Boolean).length };
        if (G.state === 'over') return { done: false, over: true, frames: st.frames };
        if (G.lives < st.lastLives) { st.deaths += st.lastLives - G.lives; const q = INC.L.player; st.log.push([Math.round(q.x / 16), Math.round(q.y / 16), INC.L.deathReason || '']); } st.lastLives = G.lives;
        INC.update(1 / 60);
      }
      const L = INC.L, p = L.player;
      return { done: false, frames: st.frames, x: Math.round(p.x), y: Math.round(p.y), time: Math.round(L.time), deaths: st.deaths, camX: Math.round(L.camX), boss: L.boss ? L.boss.state + ':' + L.boss.hp : '', deathLog: JSON.stringify(st.log.slice(0, 12)) };
    }
  };
})();

/* Todo el arte del juego se dibuja por código (formas y pixel art). Sin imágenes externas. */
(() => {
  const B = CONFIG.BRAND, T = CONFIG.TILE, TH = CONFIG.THEMES;
  const cache = new Map();

  function mk(w, h, fn) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; fn(g, w, h); return c;
  }
  function memo(key, w, h, fn) {
    let c = cache.get(key);
    if (!c) { c = mk(w, h, fn); cache.set(key, c); }
    return c;
  }
  function flipped(key, src) {
    return memo(key, src.width, src.height, (g, w) => { g.translate(w, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); });
  }
  function rows(g, rs, pal, ox = 0, oy = 0) {
    rs.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const col = pal[row[x]]; if (col) { g.fillStyle = col; g.fillRect(ox + x, oy + y, 1, 1); } } });
  }
  function disc(g, cx, cy, r, color) {
    g.fillStyle = color;
    for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y + 0.25)); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); }
  }
  // hash determinista para salpicado de texturas
  function h2(a, b, s = 0) { let n = (a * 374761393 + b * 668265263 + s * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }

  /* ---------------- Ladri (héroe) ---------------- */
  const LADRI_BODY = [
    '....KKKKKK....',
    '..KKYYYYwwKK..',
    '.KYYYYYYYwwYK.',
    '.KYYYYYYYYYYK.',
    'KYyyyyyyyyyyYK',
    'KRRRRRRRRRRRRK',
    'KRREPRRRREPRRK',
    'KRREPRRRREPRRK',
    'KRRRRRRRRRRRRK',
    'KRRRRMMMMRRRRK',
    'KRRRRrRRRRRrRK',
    'KrrrrrrrrrrrrK',
    'KRRRrRRRRRRRrK'
  ];
  const LADRI_FEET = {
    idle: ['KKBBBKKKKBBBKK', '.KBBBBK.KBBBBK', '.KKKKKK.KKKKKK'],
    runA: ['KKBBBKKKKKBBKK', '.KBBBBK..KBBK.', '.KKKKKK..KKKK.'],
    runB: ['KKBBKKKKKBBBKK', '.KBBK..KBBBBK.', '.KKKK..KKKKKK.'],
    jump: ['KKKBBKKKKBBKKK', '..KBBK..KBBK..', '..KKKK..KKKK..']
  };
  const LADRI_PAL = { K: B.dark, Y: B.secondary, y: B.secondaryDark, w: B.secondaryLight, R: B.primary, r: B.primaryDark, l: B.primaryLight, E: B.light, P: B.dark, M: B.dark, B: '#7a4a22' };
  function ladri(frame, dir) {
    const key = 'ladri' + frame;
    const base = memo(key, 14, 16, g => {
      rows(g, LADRI_BODY.concat(LADRI_FEET[frame]), LADRI_PAL);
      // brillo del ladrillo
      g.fillStyle = B.primaryLight; g.fillRect(2, 6, 1, 1); g.fillRect(2, 8, 1, 2);
    });
    return dir < 0 ? flipped(key + 'f', base) : base;
  }

  /* ---------------- Enemigos ---------------- */
  function termite(frame, dir, squashed) {
    const key = 'term' + frame + (squashed ? 's' : '');
    const base = memo(key, 12, 10, g => {
      if (squashed) { g.fillStyle = '#4a2410'; g.fillRect(1, 7, 10, 3); g.fillStyle = '#b8702f'; g.fillRect(2, 7, 8, 1); g.fillStyle = B.light; g.fillRect(8, 8, 1, 1); return; }
      g.fillStyle = '#4a2410'; g.fillRect(1, 4, 1, 1);
      // abdomen
      g.fillStyle = '#7a3f18'; g.fillRect(1, 3, 8, 5); g.fillRect(2, 2, 6, 1); g.fillRect(2, 8, 6, 1);
      g.fillStyle = '#9b5524'; g.fillRect(2, 3, 6, 2); g.fillStyle = '#4a2410'; g.fillRect(4, 3, 1, 5); g.fillRect(6, 3, 1, 5);
      // cabeza
      g.fillStyle = '#d4883a'; g.fillRect(8, 2, 4, 6); g.fillRect(9, 1, 2, 1);
      g.fillStyle = '#fff'; g.fillRect(10, 3, 2, 2); g.fillStyle = '#000'; g.fillRect(11, 4, 1, 1);
      g.fillStyle = '#4a2410'; g.fillRect(11, 7, 1, 2); g.fillRect(9, 7, 1, 1);
      g.fillRect(10, 0, 1, 1); g.fillRect(11, 0, 1, 1); g.fillRect(9, 1, 1, 0);
      // patas
      g.fillStyle = '#2a1408';
      const o = frame ? 1 : 0;
      g.fillRect(2 + o, 8, 1, 2); g.fillRect(4 - o, 8, 1, 2); g.fillRect(6 + o, 8, 1, 2); g.fillRect(8 - o, 8, 1, 2);
    });
    return dir < 0 ? flipped(key + 'f', base) : base;
  }

  /* ---------------- Objetos ---------------- */
  function coin(frame) { // ladrillito 8x6 con brillo
    return memo('coin' + frame, 10, 8, g => {
      g.fillStyle = B.dark; g.fillRect(1, 1, 8, 6);
      g.fillStyle = B.primary; g.fillRect(2, 2, 6, 4);
      g.fillStyle = B.primaryLight; g.fillRect(2, 2, 6, 1); g.fillRect(2, 2, 1, 4);
      g.fillStyle = B.primaryDark; g.fillRect(2, 5, 6, 1); g.fillRect(5, 3, 1, 2);
      if (frame === 1) { g.fillStyle = '#fff'; g.fillRect(7, 0, 1, 3); g.fillRect(6, 1, 3, 1); }
      if (frame === 2) { g.fillStyle = '#fff'; g.fillRect(1, 5, 1, 3); g.fillRect(0, 6, 3, 1); }
    });
  }
  function teja(frame, got) { // teja dorada 14x11
    return memo('teja' + frame + (got ? 'g' : ''), 14, 12, g => {
      const c = got ? ['#4a4a4a', '#6a6a6a', '#8a8a8a'] : [B.goldDark, B.gold, B.goldLight];
      const rs = [
        '..KKKKKKKKKK..', '.K22222222221K.', 'K2211111111111K', 'K21111111111111K'
      ];
      g.fillStyle = B.dark;
      // forma curva de teja colonial
      const shape = [[2, 0, 10], [1, 1, 12], [0, 2, 14], [0, 3, 14], [0, 4, 14], [1, 5, 12], [1, 6, 12], [2, 7, 10], [2, 8, 10], [3, 9, 8], [4, 10, 6]];
      shape.forEach(([x, y, w]) => g.fillRect(x, y, w, 1));
      g.fillStyle = c[1];
      shape.forEach(([x, y, w]) => g.fillRect(x + 1, y + (y === 0 ? 1 : 0), Math.max(0, w - 2), 1));
      g.fillStyle = c[2]; g.fillRect(3, 2, 8, 1); g.fillRect(3, 3, 2, 3);
      g.fillStyle = c[0]; g.fillRect(4, 6, 6, 1); g.fillRect(5, 8, 4, 1); g.fillRect(9, 3, 2, 3);
      if (!got && frame === 1) { g.fillStyle = '#fff'; g.fillRect(11, 0, 1, 4); g.fillRect(10, 1, 3, 1); }
      if (!got && frame === 2) { g.fillStyle = '#fff'; g.fillRect(2, 7, 1, 4); g.fillRect(1, 8, 3, 1); }
    });
  }
  function powerup(kind, frame) {
    return memo('pu' + kind + frame, 18, 18, g => {
      // burbuja
      disc(g, 9, 9, 8, 'rgba(255,255,255,0.28)');
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1; g.beginPath(); g.arc(9, 9, 8, 0, 7); g.stroke();
      if (kind === 'H') { // casco reforzado
        g.fillStyle = B.dark; g.fillRect(3, 5, 12, 8); g.fillRect(4, 4, 10, 1); g.fillRect(2, 11, 14, 3);
        g.fillStyle = '#e9f6ff'; g.fillRect(4, 5, 10, 7); g.fillRect(5, 4, 8, 1);
        g.fillStyle = B.accent; g.fillRect(8, 4, 2, 8); g.fillRect(3, 12, 12, 1);
        g.fillStyle = '#fff'; g.fillRect(5, 6, 2, 2);
      } else if (kind === 'W') { // carretilla
        g.fillStyle = B.dark; g.fillRect(3, 6, 11, 6); g.fillRect(12, 4, 4, 2); g.fillRect(2, 5, 3, 1);
        g.fillStyle = B.secondary; g.fillRect(4, 7, 9, 4); g.fillRect(3, 6, 11, 1);
        g.fillStyle = B.secondaryDark; g.fillRect(4, 10, 9, 1);
        disc(g, 12, 13, 3, B.dark); disc(g, 12, 13, 1, '#999');
        g.fillStyle = B.dark; g.fillRect(4, 12, 1, 3);
      } else if (kind === 'M') { // muro
        g.fillStyle = B.dark; g.fillRect(3, 4, 12, 10);
        g.fillStyle = B.primary; g.fillRect(4, 5, 10, 8);
        g.fillStyle = B.light; g.fillRect(4, 8, 10, 1); g.fillRect(4, 11, 10, 1); g.fillRect(8, 5, 1, 3); g.fillRect(6, 9, 1, 2); g.fillRect(11, 9, 1, 2); g.fillRect(8, 12, 1, 1);
        g.fillStyle = B.secondary; g.fillRect(4, 5, 10, 1);
      } else if (kind === 'r') { // bolsa de ladrillos
        g.fillStyle = B.dark; g.fillRect(4, 5, 10, 9);
        g.fillStyle = B.primary; g.fillRect(5, 6, 4, 3); g.fillRect(10, 6, 3, 3); g.fillRect(5, 10, 8, 3);
        g.fillStyle = B.primaryLight; g.fillRect(5, 6, 4, 1); g.fillRect(5, 10, 8, 1);
        g.fillStyle = B.light; g.fillRect(8, 2, 2, 4); g.fillRect(7, 3, 4, 2);
      }
    });
  }
  function drip(frame) {
    return memo('drip' + frame, 8, 12, g => {
      g.fillStyle = '#1a5f8a'; g.fillRect(3, 0, 2, 2); g.fillRect(2, 2, 4, 2); g.fillRect(1, 4, 6, 5); g.fillRect(2, 9, 4, 2);
      g.fillStyle = '#58b8ec'; g.fillRect(3, 2, 2, 2); g.fillRect(2, 4, 4, 5); g.fillRect(3, 9, 2, 1);
      g.fillStyle = '#e8f8ff'; g.fillRect(2, 5, 1, 3);
      if (frame) { g.fillStyle = '#e8f8ff'; g.fillRect(5, 6, 1, 1); }
    });
  }
  function cloud(r, t) { // Humedad: nube de moho/humedad con cara
    const size = Math.ceil(r * 2.6);
    const c = document.createElement('canvas'); c.width = size + 4; c.height = size + 12;
    const g = c.getContext('2d'), cx = c.width / 2, cy = r * 1.3 + 2;
    const col = '#5a7a82', col2 = '#7aa0a0', col3 = '#a8cccb';
    disc(g, cx - r * 0.6, cy + r * 0.2, Math.round(r * 0.7), col);
    disc(g, cx + r * 0.6, cy + r * 0.2, Math.round(r * 0.7), col);
    disc(g, cx, cy - r * 0.2, Math.round(r * 0.85), col);
    disc(g, cx - r * 0.1, cy - r * 0.3, Math.round(r * 0.6), col2);
    g.fillStyle = col3; g.fillRect(Math.round(cx - r * 0.5), Math.round(cy - r * 0.7), Math.max(1, Math.round(r * 0.3)), 2);
    // moho (manchas verdes)
    g.fillStyle = '#4f7a3a';
    for (let i = 0; i < 5; i++) g.fillRect(Math.round(cx + Math.cos(i * 2.1) * r * 0.6), Math.round(cy + Math.sin(i * 2.1) * r * 0.4), 2, 2);
    // cara enojada
    const e = Math.max(2, Math.round(r * 0.18));
    g.fillStyle = '#fff'; g.fillRect(Math.round(cx - r * 0.45), Math.round(cy - r * 0.15), e + 1, e + 1); g.fillRect(Math.round(cx + r * 0.2), Math.round(cy - r * 0.15), e + 1, e + 1);
    g.fillStyle = '#111'; g.fillRect(Math.round(cx - r * 0.45) + 1, Math.round(cy - r * 0.15) + 1, e, e); g.fillRect(Math.round(cx + r * 0.2) + 1, Math.round(cy - r * 0.15) + 1, e, e);
    g.fillRect(Math.round(cx - r * 0.55), Math.round(cy - r * 0.3), e + 2, 1); g.fillRect(Math.round(cx + r * 0.2), Math.round(cy - r * 0.3), e + 2, 1);
    g.fillStyle = '#233'; g.fillRect(Math.round(cx - r * 0.3), Math.round(cy + r * 0.3), Math.round(r * 0.6), 2);
    return c;
  }

  /* ---------------- Tiles ---------------- */
  function tile(theme, ch, variant) {
    return memo(`tile${theme}${ch}${variant}`, T, T, g => {
      const t = TH[theme], id = t.id;
      const speck = (col, n, seed) => { g.fillStyle = col; for (let i = 0; i < n; i++) g.fillRect(Math.floor(h2(i, seed, theme) * 14) + 1, Math.floor(h2(seed, i, 7 + theme) * 12) + 3, 1 + (i % 2), 1); };
      if (ch === '#') {
        const v = variant & 3, top = variant >= 4;
        if (id === 'acabados') { // piso cerámico brillante
          g.fillStyle = t.ground; g.fillRect(0, 0, T, T);
          g.fillStyle = t.groundDark; g.fillRect(0, 7, T, 1); g.fillRect(7 + (v % 2) * 2, 0, 1, T);
          g.fillStyle = '#fff'; g.fillRect(2 + v, 9, 3, 1); g.fillRect(3 + v, 10, 2, 1);
          if (top) { g.fillStyle = t.groundTop; g.fillRect(0, 0, T, 5); g.fillStyle = '#d8f6f2'; g.fillRect(0, 0, T, 1); g.fillStyle = '#fff'; g.fillRect(3, 1, 5, 1); g.fillRect(10, 2, 2, 1); g.fillStyle = '#5cb3ab'; g.fillRect(0, 4, T, 1); }
        } else {
          g.fillStyle = t.ground; g.fillRect(0, 0, T, T);
          speck(t.groundDark, 5, v + 1); speck(t.sand, 2, v + 9);
          g.fillStyle = t.groundDark; g.fillRect(0, T - 1, T, 1);
          if (top) {
            g.fillStyle = t.groundTop; g.fillRect(0, 0, T, 4);
            g.fillStyle = t.groundDark; g.fillRect(0, 4, T, 1);
            g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(0, 0, T, 1);
            if (id === 'cimientos' || id === 'tormenta') { g.fillStyle = t.groundTop; for (let x = 1; x < T; x += 3 + (v % 2)) g.fillRect(x, 4, 1, 2); }
            if (id === 'muros' || id === 'techo') { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(v * 4 + 3, 1, 1, 3); g.fillRect(12, 2, 1, 2); }
          }
        }
      } else if (ch === 'S') {
        g.fillStyle = t.sand; g.fillRect(0, 0, T, T);
        speck(t.sandDark, 7, variant + 3); speck('#fff4d0', 3, variant + 5);
        if (variant >= 4) { g.fillStyle = '#f5dfa8'; g.fillRect(0, 0, T, 2); g.fillStyle = t.sandDark; g.fillRect(2, 3, 4, 1); g.fillRect(9, 4, 5, 1); }
      } else if (ch === 'B') {
        g.fillStyle = B.primaryDark; g.fillRect(0, 0, T, T);
        const br = (x, y, w) => { g.fillStyle = B.primary; g.fillRect(x, y, w, 6); g.fillStyle = B.primaryLight; g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, 6); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y + 5, w, 1); };
        br(0, 1, 7); br(8, 1, 8); br(-4, 9, 7 + 4); br(5, 9, 10); br(11, 9, 5);
        g.fillStyle = B.dark; g.fillRect(0, 0, T, 1); g.fillRect(0, 8, T, 1); g.fillRect(0, 15, T, 1);
        g.fillStyle = '#e8d0b0'; g.fillRect(0, 7, T, 1); g.fillRect(7, 1, 1, 6); g.fillRect(4, 8, 1, 7); g.fillRect(10, 8, 1, 7);
        // sombra/reborde para separar del fondo
        g.fillStyle = B.dark; g.fillRect(0, 0, 1, T); g.fillRect(15, 0, 1, T);
      } else if (ch === 'R' || ch === '/' || ch === '\\') {
        const surf = x => ch === '/' ? 15 - x : (ch === '\\' ? x : 0);
        for (let x = 0; x < T; x++) {
          const s = surf(x);
          for (let y = s; y < T; y++) {
            const d = ch === 'R' ? y : (y - s);
            const band = Math.floor((d + (ch === 'R' ? 0 : 0)) / 4) % 2;
            g.fillStyle = band ? t.roofDark : t.roof;
            if ((d % 4) === 3) g.fillStyle = t.roofDark;
            g.fillRect(x, y, 1, 1);
          }
          // reborde claro
          if (ch !== 'R') { g.fillStyle = '#ffb27a'; g.fillRect(x, s, 1, 1); }
        }
        if (ch === 'R') {
          g.fillStyle = '#ffb27a'; if (variant >= 4) g.fillRect(0, 0, T, 1);
          g.fillStyle = t.roofDark; for (let y = 0; y < T; y += 4) for (let x = ((y / 4) % 2) * 4; x < T; x += 8) g.fillRect(x, y, 1, 4);
        } else {
          g.fillStyle = t.roofDark; for (let x = 0; x < T; x += 4) { const s = surf(x); g.fillRect(x, s, 1, Math.min(4, T - s)); }
        }
      } else if (ch === 'T') {
        g.fillStyle = t.tileA; g.fillRect(0, 0, T, T);
        g.fillStyle = t.tileB; g.fillRect(0, 0, 8, 8); g.fillRect(8, 8, 8, 8);
        g.fillStyle = '#fff'; g.fillRect(1, 1, 3, 1); g.fillRect(9, 9, 3, 1);
        g.fillStyle = t.groundDark; g.fillRect(0, 7, T, 1); g.fillRect(7, 0, 1, T);
      } else if (ch === '=') {
        // tablón de andamio (una sola cara, se puede atravesar desde abajo)
        g.fillStyle = B.dark; g.fillRect(0, 0, T, 6);
        g.fillStyle = t.plank; g.fillRect(0, 1, T, 4);
        g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(0, 1, T, 1);
        g.fillStyle = t.plankDark; g.fillRect(0, 4, T, 1); g.fillRect(5, 2, 3, 1); g.fillRect(11, 3, 2, 1);
        g.fillStyle = B.dark; g.fillRect(2, 2, 1, 1); g.fillRect(13, 2, 1, 1);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(2, 6, 12, 1);
      } else if (ch === '^') {
        g.fillStyle = '#6b3b1f';
        for (let i = 0; i < 3; i++) {
          const x0 = i * 5 + 1;
          for (let y = 0; y < 10; y++) { const w = Math.max(1, 5 - Math.floor(y / 2)); g.fillStyle = y < 2 ? '#e8e8e8' : '#b5541e'; g.fillRect(x0 + Math.floor((5 - w) / 2), 15 - y, w, 1); }
        }
        g.fillStyle = B.dark; g.fillRect(0, 15, T, 1);
      } else if (ch === 'W') { // muro instantáneo (temporal)
        g.fillStyle = B.dark; g.fillRect(0, 0, T, T);
        g.fillStyle = B.secondary; g.fillRect(1, 1, 14, 14);
        g.fillStyle = B.dark; for (let i = -16; i < 16; i += 8) { for (let k = 0; k < 6; k++) g.fillRect(Math.max(1, Math.min(14, i + k + 8)), 1 + Math.max(0, Math.min(13, k * 2)), 3, 2); }
        g.fillStyle = B.secondaryLight; g.fillRect(1, 1, 14, 1);
      }
    });
  }

  /* ---------------- Fondos por etapa ---------------- */
  const skyCache = new Map();
  function sky(theme, w, h) {
    const key = theme + 'sky';
    let c = skyCache.get(key);
    if (!c) {
      c = mk(1, h, (g) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, TH[theme].skyTop); gr.addColorStop(1, TH[theme].skyBottom); g.fillStyle = gr; g.fillRect(0, 0, 1, h); });
      skyCache.set(key, c);
    }
    return c;
  }
  function drawBackground(g, theme, camX, camY, t, W, H, flash) {
    const th = TH[theme], id = th.id;
    g.drawImage(sky(theme, W, H), 0, 0, W, H);
    const px = (f) => -Math.round(camX * f);
    const wrap = (x, span) => ((x % span) + span) % span;
    if (id === 'cimientos') {
      g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(380, 50, 22, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 5; i++) { const x = wrap(i * 190 + px(0.1) + t * 3, 950) - 80, y = 28 + (i * 37) % 60; g.fillRect(x, y, 56, 8); g.fillRect(x + 10, y - 6, 30, 8); g.fillRect(x + 6, y + 6, 46, 4); }
      g.fillStyle = th.far; for (let i = 0; i < 9; i++) { const x = wrap(i * 150 + px(0.18), 1350) - 150, hh = 40 + (i * 29) % 36; g.beginPath(); g.moveTo(x, 200); g.lineTo(x + 75, 200 - hh); g.lineTo(x + 150, 200); g.fill(); }
      g.fillStyle = th.mid; for (let i = 0; i < 12; i++) { const x = wrap(i * 120 + px(0.35), 1440) - 120, hh = 24 + (i * 17) % 22; g.beginPath(); g.moveTo(x - 20, 215); g.lineTo(x + 50, 215 - hh); g.lineTo(x + 130, 215); g.fill(); }
      // grúa lejana
      g.fillStyle = '#8b7a58'; const gx = wrap(px(0.25) + 260, 900) - 100; g.fillRect(gx, 70, 4, 140); g.fillRect(gx - 40, 70, 90, 4); g.fillRect(gx + 40, 74, 1, 24); g.fillRect(gx + 38, 98, 5, 4);
    } else if (id === 'muros') {
      g.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 4; i++) { const x = wrap(i * 260 + px(0.08) + t * 2, 1040) - 100, y = 30 + i * 22; g.fillRect(x, y, 70, 7); g.fillRect(x + 12, y - 5, 36, 6); }
      g.fillStyle = th.far; for (let i = 0; i < 8; i++) { const x = wrap(i * 150 + px(0.2), 1200) - 100, hh = 60 + (i * 41) % 70; g.fillRect(x, 210 - hh, 90, hh); g.fillStyle = 'rgba(0,0,0,0.15)'; for (let k = 0; k < hh; k += 16) g.fillRect(x, 210 - hh + k, 90, 2); g.fillStyle = th.far; }
      g.fillStyle = th.mid; for (let i = 0; i < 10; i++) { const x = wrap(i * 110 + px(0.4), 1100) - 60; g.fillRect(x, 150, 5, 70); g.fillRect(x + 60, 150, 5, 70); g.fillRect(x, 150, 65, 4); g.fillRect(x, 185, 65, 3); g.fillRect(x, 150, 65, 1); }
      g.fillStyle = '#d9a63a'; const gx = wrap(px(0.3) + 300, 1000) - 100; g.fillRect(gx, 50, 5, 160); g.fillRect(gx - 50, 50, 110, 5); g.fillRect(gx + 50, 55, 1, 40); g.fillRect(gx + 47, 95, 7, 5);
    } else if (id === 'techo') {
      g.fillStyle = '#fff2b0'; g.beginPath(); g.arc(330, 110, 38, 0, 7); g.fill(); g.fillStyle = 'rgba(255,240,170,0.35)'; g.beginPath(); g.arc(330, 110, 56, 0, 7); g.fill();
      g.fillStyle = th.far; for (let i = 0; i < 9; i++) { const x = wrap(i * 130 + px(0.18), 1170) - 130, hh = 30 + (i * 23) % 30; g.fillRect(x, 195 - hh, 100, hh + 30); g.beginPath(); g.moveTo(x - 8, 195 - hh); g.lineTo(x + 50, 195 - hh - 36); g.lineTo(x + 108, 195 - hh); g.fill(); }
      g.fillStyle = th.mid; for (let i = 0; i < 10; i++) { const x = wrap(i * 115 + px(0.38), 1150) - 100, hh = 18 + (i * 31) % 26; g.fillRect(x, 215 - hh, 80, hh + 20); g.beginPath(); g.moveTo(x - 8, 215 - hh); g.lineTo(x + 40, 215 - hh - 28); g.lineTo(x + 88, 215 - hh); g.fill(); g.fillStyle = '#3a2220'; g.fillRect(x + 12, 215 - hh + 8, 10, 10); g.fillRect(x + 50, 215 - hh + 8, 10, 10); g.fillStyle = th.mid; }
      g.fillStyle = 'rgba(80,40,40,0.5)'; for (let i = 0; i < 6; i++) { const x = wrap(i * 120 + px(0.1) - t * 6, 720) - 80, y = 24 + (i * 31) % 70; g.fillRect(x, y, 70, 6); g.fillRect(x + 10, y - 4, 40, 5); }
    } else if (id === 'acabados') {
      // pared interior con zócalo cerámico y ventanas
      g.fillStyle = th.far; g.fillRect(0, 0, W, H);
      g.fillStyle = th.mid; const o = wrap(px(0.5), 48);
      for (let x = -48 + o; x < W + 48; x += 48) { g.fillRect(x, 0, 2, 215); }
      g.fillStyle = th.skyBottom; g.fillRect(0, 150, W, 70);
      g.fillStyle = th.tileB; for (let x = -32 + wrap(px(0.5), 32); x < W + 32; x += 32) for (let y = 156; y < 220; y += 32) { g.fillRect(x, y, 30, 30); g.fillStyle = '#fff'; g.fillRect(x + 3, y + 3, 6, 2); g.fillStyle = th.tileB; }
      for (let i = 0; i < 4; i++) { const x = wrap(i * 190 + px(0.5), 760) - 100; g.fillStyle = '#7a5a3a'; g.fillRect(x, 28, 54, 64); g.fillStyle = '#bfe6f6'; g.fillRect(x + 4, 32, 46, 56); g.fillStyle = '#fff'; g.fillRect(x + 8, 36, 12, 4); g.fillStyle = '#7a5a3a'; g.fillRect(x + 26, 32, 3, 56); g.fillRect(x + 4, 58, 46, 3); }
      g.fillStyle = '#4a3a2a'; for (let i = 0; i < 4; i++) { const x = wrap(i * 190 + 95 + px(0.5), 760) - 100; g.fillRect(x + 12, 0, 1, 28); g.fillStyle = '#ffd86a'; g.fillRect(x + 4, 28, 17, 6); g.fillStyle = 'rgba(255,230,150,0.25)'; g.beginPath(); g.moveTo(x + 4, 34); g.lineTo(x - 14, 90); g.lineTo(x + 38, 90); g.lineTo(x + 21, 34); g.fill(); g.fillStyle = '#4a3a2a'; }
    } else if (id === 'tormenta') {
      g.fillStyle = 'rgba(10,14,26,0.6)'; for (let i = 0; i < 6; i++) { const x = wrap(i * 150 + px(0.1) + t * 14, 900) - 150, y = 8 + (i * 29) % 70; g.fillRect(x, y, 160, 22); g.fillRect(x + 20, y - 12, 100, 16); g.fillRect(x + 40, y + 20, 90, 12); }
      g.fillStyle = th.far; for (let i = 0; i < 9; i++) { const x = wrap(i * 150 + px(0.2), 1350) - 150, hh = 40 + (i * 29) % 36; g.beginPath(); g.moveTo(x, 200); g.lineTo(x + 75, 200 - hh); g.lineTo(x + 150, 200); g.fill(); }
      g.fillStyle = th.mid; for (let i = 0; i < 12; i++) { const x = wrap(i * 120 + px(0.35), 1440) - 120, hh = 24 + (i * 17) % 22; g.beginPath(); g.moveTo(x - 20, 215); g.lineTo(x + 50, 215 - hh); g.lineTo(x + 130, 215); g.fill(); }
      if (flash > 0) { g.fillStyle = `rgba(230,240,255,${Math.min(0.7, flash)})`; g.fillRect(0, 0, W, H); }
    }
  }

  /* ---------------- Objetos del mundo ---------------- */
  function drawCheckpoint(g, x, y, active, t) { // x,y = esquina inferior izquierda de la celda base
    g.fillStyle = B.dark; g.fillRect(x + 5, y - 32, 3, 32);
    g.fillStyle = '#888'; g.fillRect(x + 3, y - 2, 7, 2);
    const wave = Math.round(Math.sin(t * 6) * (active ? 1 : 0));
    g.fillStyle = B.dark; g.fillRect(x + 8, y - 31, 15, 11);
    g.fillStyle = active ? B.secondary : '#9aa0a8'; g.fillRect(x + 8, y - 30 + wave, 14, 9);
    g.fillStyle = active ? B.primary : '#6b7078'; g.fillRect(x + 11, y - 28 + wave, 8, 2); g.fillRect(x + 11, y - 25 + wave, 8, 2);
    if (active) { g.fillStyle = B.secondaryLight; g.fillRect(x + 8, y - 30 + wave, 14, 1); }
  }
  function drawGoal(g, x, y, t) { // arco de entrega: 2 pilares de ladrillo + cartel "META"
    for (const dx of [0, 24]) { g.fillStyle = B.dark; g.fillRect(x + dx, y - 48, 10, 48); g.fillStyle = B.primary; g.fillRect(x + dx + 1, y - 47, 8, 46); g.fillStyle = B.primaryDark; for (let k = 6; k < 46; k += 8) g.fillRect(x + dx + 1, y - 47 + k, 8, 1); g.fillStyle = B.primaryLight; g.fillRect(x + dx + 1, y - 47, 1, 46); }
    g.fillStyle = B.dark; g.fillRect(x - 3, y - 60, 40, 15);
    g.fillStyle = B.secondary; g.fillRect(x - 2, y - 59, 38, 13);
    g.fillStyle = B.secondaryDark; for (let i = 0; i < 38; i += 8) g.fillRect(x - 2 + i, y - 59, 4, 13);
    g.fillStyle = B.dark; g.fillRect(x + 3, y - 56, 28, 7);
    Font.draw(g, 'META', x + 17, y - 55, { align: 'center', color: B.secondaryLight });
    const sw = Math.round(Math.sin(t * 5) * 1.5);
    g.fillStyle = B.danger; g.fillRect(x + 12 + sw, y - 40, 3, 40 - 6 + 6); g.fillStyle = 'rgba(255,255,255,0.0)';
  }
  function drawCrane(g, m, t) { // plataforma de grúa
    const x = Math.round(m.x), y = Math.round(m.y), w = m.w;
    // cable
    g.fillStyle = '#555'; g.fillRect(x + (w >> 1) - 1, 0, 2, y - 2 < 0 ? 0 : y - 2 + 0);
    g.fillStyle = B.dark; g.fillRect(x + 3, y, w - 6, 1);
    // viga
    g.fillStyle = B.dark; g.fillRect(x, y, w, 7);
    g.fillStyle = B.secondary; g.fillRect(x + 1, y + 1, w - 2, 5);
    g.fillStyle = B.dark; for (let i = 3; i < w - 4; i += 10) { g.fillRect(x + i, y + 1, 3, 1); g.fillRect(x + i + 1, y + 2, 3, 1); g.fillRect(x + i + 2, y + 3, 3, 1); g.fillRect(x + i + 3, y + 4, 3, 1); g.fillRect(x + i + 4, y + 5, 3, 1); }
    g.fillStyle = B.secondaryLight; g.fillRect(x + 1, y + 1, w - 2, 1);
    // cadenas / gancho
    g.fillStyle = '#777'; g.fillRect(x + 3, y - 6, 1, 6); g.fillRect(x + w - 4, y - 6, 1, 6);
    g.fillRect(x + (w >> 1) - 3, y - 7, 6, 2);
    g.fillStyle = B.dark; g.fillRect(x + 2, y + 7, w - 4, 2);
  }

  /* ---------------- Casa (progreso y final) ---------------- */
  function drawHouse(g, x, y, s, stage, t, withLogo) {
    // x,y = esquina inferior izquierda; ancho 120*s, alto ~ 90*s ; stage 0..5
    const R = (a, b, c, d, col) => { g.fillStyle = col; g.fillRect(Math.round(x + a * s), Math.round(y - (b + d) * s), Math.round(c * s), Math.round(d * s)); };
    R(0, 0, 120, 4, '#6b6b6b'); // terreno
    if (stage >= 1) { R(4, 0, 112, 5, '#8c8c8c'); R(4, 4, 112, 1, '#b0b0b0'); }
    if (stage >= 2) { // muros de ladrillo
      R(10, 5, 100, 46, B.dark); R(11, 6, 98, 44, B.primary);
      for (let k = 0; k < 44; k += 7) R(11, 6 + k, 98, 1, B.primaryDark);
      for (let k = 0; k < 44; k += 14) for (let i = 0; i < 98; i += 14) R(11 + i + ((k / 14) % 2) * 7, 6 + k, 1, 7, B.primaryDark);
    }
    if (stage >= 3) { // techo
      g.fillStyle = B.dark; g.beginPath(); g.moveTo(x + 2 * s, y - 51 * s); g.lineTo(x + 60 * s, y - 92 * s); g.lineTo(x + 118 * s, y - 51 * s); g.fill();
      g.fillStyle = '#b8402a'; g.beginPath(); g.moveTo(x + 6 * s, y - 52 * s); g.lineTo(x + 60 * s, y - 88 * s); g.lineTo(x + 114 * s, y - 52 * s); g.fill();
      g.fillStyle = '#7a2619'; for (let k = 0; k < 5; k++) { g.fillRect(Math.round(x + (14 + k * 4) * s), Math.round(y - (56 + k * 7) * s), Math.round((92 - k * 8) * s), Math.max(1, Math.round(s))); }
    }
    if (stage >= 4) { // puerta y ventanas
      R(50, 5, 20, 30, B.dark); R(52, 5, 16, 28, '#8d5b28'); R(64, 18, 2, 2, B.secondary);
      R(18, 22, 24, 20, B.dark); R(20, 24, 20, 16, '#bfe6f6'); R(29, 24, 2, 16, B.dark); R(20, 31, 20, 2, B.dark);
      R(78, 22, 24, 20, B.dark); R(80, 24, 20, 16, '#bfe6f6'); R(89, 24, 2, 16, B.dark); R(80, 31, 20, 2, B.dark);
    }
    if (stage >= 5 && withLogo) { // cartel con el logo en la fachada
      const L = CONFIG.LOGO;
      R(28, 42, 64, 9, L.border); R(29, 43, 62, 7, L.background);
      Font.draw(g, L.text, x + 60 * s, y - 49 * s, { align: 'center', color: L.foreground, scale: Math.max(1, Math.floor(s * 0.85)) });
    }
  }

  window.Art = { mk, memo, flipped, rows, disc, h2, ladri, termite, coin, teja, powerup, drip, cloud, tile, drawBackground, drawCheckpoint, drawGoal, drawCrane, drawHouse };
})();

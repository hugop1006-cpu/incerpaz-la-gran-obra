/* Sonido y música con Web Audio API (todo sintetizado, sin archivos). */
(() => {
  let ctx = null, master = null, sfxGain = null, musicGain = null;
  let muted = false;
  try { muted = localStorage.getItem('incerpaz_muted') === '1'; } catch (e) {}

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.28; musicGain.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function tone(freq, dur, type = 'square', vol = 0.3, delay = 0, slideTo = null, dest = null) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.3, freq = 1800, delay = 0, dest = null) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(dest || sfxGain); s.start(t);
  }

  const SFX = {
    jump:   () => tone(300, 0.16, 'square', 0.18, 0, 640),
    coin:   () => { tone(988, 0.07, 'square', 0.16); tone(1319, 0.14, 'square', 0.16, 0.06); },
    stomp:  () => { tone(220, 0.12, 'square', 0.25, 0, 70); noise(0.08, 0.2, 900); },
    hurt:   () => { tone(400, 0.25, 'sawtooth', 0.25, 0, 90); noise(0.15, 0.25, 1500); },
    die:    () => { [520, 440, 360, 280, 200].forEach((f, i) => tone(f, 0.16, 'triangle', 0.3, i * 0.13)); },
    power:  () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.1, 'square', 0.17, i * 0.07)); },
    brick:  () => { noise(0.07, 0.35, 700); tone(140, 0.12, 'square', 0.3, 0, 90); },
    wall:   () => { noise(0.12, 0.3, 1200); tone(180, 0.2, 'triangle', 0.3, 0, 420); },
    check:  () => { [659, 880, 1175].forEach((f, i) => tone(f, 0.12, 'triangle', 0.25, i * 0.09)); },
    teja:   () => { [880, 1175, 1480, 1760, 2349].forEach((f, i) => tone(f, 0.13, 'triangle', 0.22, i * 0.075)); },
    oneup:  () => { [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => tone(f, 0.1, 'square', 0.17, i * 0.08)); },
    drip:   () => tone(1400, 0.1, 'sine', 0.2, 0, 500),
    splash: () => noise(0.09, 0.15, 3000),
    crack:  () => { noise(0.5, 0.45, 400); tone(70, 0.5, 'sawtooth', 0.25, 0, 40); },
    seal:   () => { noise(0.1, 0.4, 600); tone(110, 0.2, 'square', 0.3, 0, 60); [523, 659, 784].forEach((f, i) => tone(f, 0.1, 'square', 0.2, 0.1 + i * 0.07)); },
    boom:   () => { noise(1.1, 0.6, 500); tone(90, 1.0, 'sawtooth', 0.3, 0, 30); },
    no:     () => tone(150, 0.12, 'square', 0.2),
    select: () => tone(784, 0.07, 'square', 0.15),
    ok:     () => { tone(659, 0.08, 'square', 0.18); tone(988, 0.12, 'square', 0.18, 0.07); },
    pause:  () => tone(440, 0.09, 'triangle', 0.25, 0, 330),
    warn:   () => tone(880, 0.06, 'square', 0.12),
    thunder:() => { noise(1.2, 0.5, 350); tone(60, 0.9, 'sawtooth', 0.18, 0, 35); },
    clear:  () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.16, 'square', 0.2, i * 0.12)); },
    over:   () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.3, i * 0.25)); },
    win:    () => { [523, 659, 784, 1047, 1319, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.2, 'square', 0.18, i * 0.14)); }
  };

  /* ---------------- Música ---------------- */
  const SC_MAJ = [0, 2, 4, 7, 9], SC_MIN = [0, 3, 5, 7, 10];
  // lead: 32 pasos (4 compases de 8 corcheas). Números = grado de la escala pentatónica (0-4, +5 por octava), '-' = silencio
  const TRACKS = {
    title: { root: 60, scale: SC_MAJ, bpm: 104, wave: 'square', prog: [0, 5, 3, 4], bassWave: 'triangle',
      lead: '4 - 5 - 7 - 5 - 4 - 2 - 0 - - - 2 - 4 - 5 - 4 - 2 - 4 - - - - 4 - 7 - 9 - 7 - 5 - 4 - 5 - 4 - 2 - 0 - - -'.split(' ') },
    l1: { root: 62, scale: SC_MAJ, bpm: 112, wave: 'square', prog: [0, 3, 4, 0], bassWave: 'triangle',
      lead: '0 2 4 - 2 4 5 - 4 5 7 - 5 4 2 - 3 4 5 - 4 2 0 - 2 - 4 - 2 - - - 0 2 4 - 5 7 9 - 7 5 4 - 2 4 5 - 4 - 2 - 0 - - - - -'.split(' ') },
    l2: { root: 57, scale: SC_MAJ, bpm: 120, wave: 'square', prog: [0, 4, 3, 4], bassWave: 'triangle',
      lead: '7 - 5 4 - 5 7 - 9 - 7 5 - 4 2 - 5 - 4 2 - 4 5 - 7 - 5 - 4 - - - 7 7 - 9 7 - 5 4 - 2 - 4 5 - 7 - 5 4 - 2 - 0 - - -'.split(' ') },
    l3: { root: 64, scale: SC_MAJ, bpm: 126, wave: 'square', prog: [0, 3, 0, 4], bassWave: 'triangle',
      lead: '4 - 7 - 9 - 7 - 5 4 2 - 4 - - - 5 - 9 - 10 - 9 - 7 5 4 - 7 - - - 4 5 7 - 9 7 5 - 4 2 0 - 2 4 - - 5 - 4 - 2 - 0 - -'.split(' ') },
    l4: { root: 65, scale: SC_MAJ, bpm: 100, wave: 'triangle', prog: [0, 4, 5, 3], bassWave: 'sine',
      lead: '9 - 7 - 5 - 7 - 9 - - - 10 - 9 - 7 - 5 - 4 - 5 - 7 - - - - 4 - 5 - 7 - 9 - 7 - 5 - 4 - 2 - 4 - - - 0 - - -'.split(' ') },
    l5: { root: 57, scale: SC_MIN, bpm: 140, wave: 'sawtooth', prog: [0, 0, 3, 4], bassWave: 'square',
      lead: '7 - 7 - 5 7 - - 8 - 7 - 5 - 3 - 7 - 7 - 10 8 7 - - 5 - 3 - 2 - - - 3 5 7 - 5 3 - 5 7 - 8 7 - 5 - 3 5 3 2 - 0 - - -'.split(' ') },
    fin: { root: 60, scale: SC_MAJ, bpm: 92, wave: 'triangle', prog: [0, 3, 4, 0], bassWave: 'sine',
      lead: '4 - - - 7 - 9 - 10 - - - 9 - 7 - 5 - - - 7 - 9 - 7 - - - 4 - - - 7 - 9 - 10 - 12 - 10 - 9 - 7 - 9 - 10 - - - 14 - - -'.split(' ') },
    boss: { root: 52, scale: SC_MIN, bpm: 152, wave: 'sawtooth', prog: [0, 3, 0, 4], bassWave: 'square',
      lead: '7 7 - 5 7 7 - 3 5 5 - 3 5 7 8 - 7 7 - 10 8 7 - 5 3 5 - 3 2 - 0 - 7 - 8 - 7 - 5 - 3 - 5 - 3 - 2 - 3 - 0 - -'.split(' ') }
  };
  let cur = null, step = 0, nextT = 0, timer = null, tempoMult = 1, curName = null;

  function noteFreq(track, deg, oct = 0) {
    const sc = track.scale, n = Math.floor(deg / 5), semi = sc[((deg % 5) + 5) % 5] + 12 * n + 12 * oct;
    return 440 * Math.pow(2, (track.root + semi - 69) / 12);
  }
  function schedule() {
    if (!cur || !ctx) return;
    while (nextT < ctx.currentTime + 0.25) {
      const sd = 60 / cur.bpm / 2 / tempoMult; // corchea
      const i = step % cur.lead.length, tok = cur.lead[i];
      const delay = Math.max(0, nextT - ctx.currentTime);
      if (tok !== '-' && tok !== undefined) tone(noteFreq(cur, parseInt(tok, 10)), sd * 0.9, cur.wave, 0.5, delay, null, musicGain);
      // bajo: dos golpes por compás de 8 corcheas
      const bar = Math.floor(i / 8) % cur.prog.length, pos = i % 8;
      const root = cur.prog[bar];
      if (pos === 0 || pos === 3 || pos === 4 || pos === 7) {
        const deg = pos === 4 ? root + 2 : root;
        tone(noteFreq(cur, deg, -2), sd * 1.6, cur.bassWave, 0.7, delay, null, musicGain);
      }
      if (cur.drums !== false && (pos === 0 || pos === 4)) noise(0.05, 0.25, 220, delay, musicGain);
      if (pos === 2 || pos === 6) noise(0.025, 0.12, 6000, delay, musicGain);
      nextT += sd; step++;
    }
  }

  const Snd = {
    unlock() { ensure(); },
    play(name) { if (!ensure() || muted) return; const f = SFX[name]; if (f) f(); },
    music(name) {
      curName = name;
      if (!name) { cur = null; return; }
      if (!ensure()) return;
      if (cur === TRACKS[name]) return;
      cur = TRACKS[name]; step = 0; nextT = ctx.currentTime + 0.08; tempoMult = 1;
      if (!timer) timer = setInterval(schedule, 50);
    },
    hurry(on) { tempoMult = on ? 1.25 : 1; },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    pauseMusic(p) { if (musicGain) musicGain.gain.value = p ? 0.08 : 0.28; },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('incerpaz_muted', muted ? '1' : '0'); } catch (e) {}
      if (master) master.gain.value = muted ? 0 : 0.8;
      return muted;
    }
  };
  window.Snd = Snd;
})();

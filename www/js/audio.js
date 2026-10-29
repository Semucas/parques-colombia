/* Sonidos sintetizados con WebAudio (no requiere archivos de audio) + música de fondo por escena. */
const Sfx = (() => {
  let ctx = null, musicTimer = null, step = 0;
  const on = () => Store.d.sound;

  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.15, delay = 0, slideTo = null) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol = 0.2) {
    const c = ac(); if (!c) return;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = buf; g.gain.value = vol; s.connect(g).connect(c.destination); s.start();
  }

  const SOUNDS = {
    click: () => tone(660, 0.07, 'square', 0.06),
    roll: () => { for (let i = 0; i < 6; i++) tone(300 + Math.random() * 300, 0.05, 'square', 0.07, i * 0.07); },
    move: () => tone(520, 0.09, 'triangle', 0.12, 0, 760),
    exit: () => { tone(440, 0.1, 'triangle', 0.14); tone(660, 0.15, 'triangle', 0.14, 0.1); },
    capture: () => { noise(0.35, 0.25); tone(220, 0.35, 'sawtooth', 0.15, 0, 60); },
    goal: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.15, i * 0.1)),
    six: () => { tone(880, 0.12, 'square', 0.08); tone(1175, 0.18, 'square', 0.08, 0.1); },
    win: () => [523, 659, 784, 659, 784, 1047, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.17, i * 0.14)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.1, i * 0.22)),
    party: () => { for (let i = 0; i < 8; i++) tone(500 + (i % 4) * 150, 0.1, 'square', 0.07, i * 0.09); }
  };

  function play(name) { if (on() && SOUNDS[name]) SOUNDS[name](); }

  /* ---------- Música de fondo por escena ----------
     'home' (inicio, perfil, puntajes...): www/assets/audio/musica.mp3, o una cumbia sencilla si no existe.
     'game' (durante la partida, más urbana): www/assets/audio/musica-juego.mp3, o un beat de reggaetón si no existe. */
  const TRACK_VOLUME = 0.2;   // bajita, que no tape los efectos
  const SCENES = {
    home: { src: 'assets/audio/musica.mp3', every: 260, el: null, failed: false },
    game: { src: 'assets/audio/musica-juego.mp3', every: 158, el: null, failed: false }
  };
  let scene = 'home';

  // Cumbia sencilla (respaldo del inicio): bajo + guacharaca
  const BASS = [196, 0, 262, 0, 196, 0, 294, 262];
  function tickHome() {
    const b = BASS[step % 8];
    if (b) tone(b, 0.22, 'triangle', 0.035);
    noise(0.04, step % 2 ? 0.012 : 0.025);
    step++;
  }
  // Beat urbano tipo reggaetón (respaldo de la partida), ~95 BPM: bombo en los 4 tiempos, "dembow" de caja, bajo 808 y hi-hat
  const KICK = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  const SNARE = [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  const B808 = [55, 0, 0, 0, 0, 0, 0, 55, 0, 0, 65, 0, 0, 0, 0, 0];
  const LEAD = [0, 0, 0, 0, 440, 0, 0, 0, 0, 0, 523, 0, 392, 0, 0, 0];
  function tickGame() {
    const i = step % 16;
    if (KICK[i]) tone(140, 0.18, 'sine', 0.07, 0, 45);
    if (SNARE[i]) { noise(0.09, 0.03); tone(190, 0.08, 'triangle', 0.025); }
    noise(0.025, i % 2 ? 0.008 : 0.016);
    if (B808[i]) tone(B808[i], 0.28, 'sine', 0.06);
    if (LEAD[i]) tone(LEAD[i], 0.16, 'square', 0.012);
    step++;
  }
  function musicTick() {
    if (!Store.d.music) return stopMusic();
    (scene === 'game' ? tickGame : tickHome)();
  }

  function startSynth() { if (!musicTimer) musicTimer = setInterval(musicTick, SCENES[scene].every); }

  function startMusic() {
    if (!Store.d.music) return;
    const sc = SCENES[scene];
    if (sc.failed) return startSynth();
    if (!sc.el) {
      sc.el = new Audio(sc.src);
      sc.el.loop = true; sc.el.volume = TRACK_VOLUME;
      sc.el.addEventListener('error', () => { sc.failed = true; if (Store.d.music && SCENES[scene] === sc) startSynth(); });
    }
    sc.el.play().catch(err => {
      // NotAllowedError = aún no hay un toque del usuario (se reintenta en el siguiente); otro error = no hay archivo
      if (err && err.name !== 'NotAllowedError') { sc.failed = true; if (SCENES[scene] === sc) startSynth(); }
    });
  }
  function stopMusic() {
    clearInterval(musicTimer); musicTimer = null;
    Object.values(SCENES).forEach(sc => { if (sc.el) sc.el.pause(); });
  }
  // Cambia la música al entrar a la partida ('game') y al volver a las demás pantallas ('home')
  function setScene(name) {
    if (name === scene) return;
    stopMusic(); scene = name; step = 0;
    if (Store.d.music) startMusic();
  }

  return { play, startMusic, stopMusic, setScene, unlock: ac };
})();

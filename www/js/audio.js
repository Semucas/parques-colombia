/* Sonidos sintetizados con WebAudio (no requiere archivos de audio) + música tipo cumbia sencilla. */
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

  // Patrón de cumbia: bajo + "guacharaca"
  const BASS = [196, 0, 262, 0, 196, 0, 294, 262];
  function musicTick() {
    if (!Store.d.music) return stopMusic();
    const b = BASS[step % 8];
    if (b) tone(b, 0.22, 'triangle', 0.035);
    noise(0.04, step % 2 ? 0.012 : 0.025);
    step++;
  }
  // Música de fondo: si existe www/assets/audio/musica.mp3 se usa esa canción (en bucle, volumen bajo);
  // si no existe o falla, suena la cumbia sintetizada de arriba.
  const TRACK_SRC = 'assets/audio/musica.mp3', TRACK_VOLUME = 0.04;   // música de fondo: bajita, que no tape los efectos
  let track = null, trackFailed = false;

  function startSynth() { if (!musicTimer) musicTimer = setInterval(musicTick, 260); }

  function startMusic() {
    if (!Store.d.music) return;
    if (trackFailed) return startSynth();
    if (!track) {
      track = new Audio(TRACK_SRC);
      track.loop = true; track.volume = TRACK_VOLUME;
      track.addEventListener('error', () => { trackFailed = true; if (Store.d.music) startSynth(); });
    }
    track.play().catch(err => {
      // NotAllowedError = aún no hay un toque del usuario (se reintenta en el siguiente); otro error = no hay archivo
      if (err && err.name !== 'NotAllowedError') { trackFailed = true; startSynth(); }
    });
  }
  function stopMusic() {
    clearInterval(musicTimer); musicTimer = null;
    if (track) track.pause();
  }

  return { play, startMusic, stopMusic, unlock: ac };
})();

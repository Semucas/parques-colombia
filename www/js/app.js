/* Interfaz y flujo del juego: navegación, tablero, turnos, bots, online, puntajes y easter eggs. */
(() => {
  const $ = (q, r = document) => r.querySelector(q);
  const $$ = (q, r = document) => [...r.querySelectorAll(q)];
  const rnd = a => a[Math.floor(Math.random() * a.length)];

  const REGIONS = [
    { name: 'Caribe',    color: 'var(--p0)', light: true,  emoji: '🏖️', phrase: '¡Ajá, mi vale!',          img: 'assets/img/caribe.jpg' },
    { name: 'Pacífico',  color: 'var(--p1)', light: false, emoji: '🐋', phrase: '¡Quiubo, mi hermano!',     img: 'assets/img/pacifico.jpg' },
    { name: 'Andina',    color: 'var(--p2)', light: false, emoji: '☕', phrase: '¡Quiubo, parce!',          img: 'assets/img/andina.jpg' },
    { name: 'Amazonía',  color: 'var(--p3)', light: false, emoji: '🦜', phrase: '¡Qué chimba de selva!',    img: 'assets/img/amazonia.jpg' }
  ];
  const LEVELS = [
    { name: 'Parcero novato', desc: 'Bots que juegan al azar · 25 s por turno', secs: 25 },
    { name: 'Rebusque',       desc: 'Bots pillos que cazan fichas · 18 s por turno', secs: 18 },
    { name: 'Capo del parqués', desc: 'Bots estrategas que esquivan riesgos · 12 s', secs: 12 }
  ];
  const PHRASES = {
    capture: ['¡Pa\' la cárcel, parce!', '¡Uy, qué vaina tan brava!', '¡Ay, qué pesar!', '¡Eche, no joda!'],
    six: ['¡Qué suerte, mono!', '¡Eso, mi rey!', '¡Hágale pues!'],
    goal: ['¡Qué chimba, a la meta!', '¡Ficha a salvo, parce!'],
    pass: ['Sin jugadas, ¡toca esperar!', 'Hoy no es el día, parce']
  };
  /* Tablero en cruz: cada brazo mide 3 casillas de ancho y 8 de largo. Las coordenadas (gx,gy) son de una cuadrícula
     lógica de 19x19; al dibujar, las 3 filas/columnas centrales miden 2 unidades y el resto 1, así las casillas
     quedan rectangulares (2x1) y caben los rótulos SALIDA / SEGURO / LLEGADA. Total: 22 unidades de lado.
     Circuito de 68 casillas (17 por brazo: 8 + punta + 8). El carril del medio de cada brazo es el pasillo de llegada. */
  const N = 22;
  const unitStart = g => g <= 8 ? g : g <= 10 ? 8 + (g - 8) * 2 : 14 + (g - 11);
  const unitSpan = g => g >= 8 && g <= 10 ? 2 : 1;
  const cellRect = (gx, gy) => ({ x: unitStart(gx), y: unitStart(gy), w: unitSpan(gx), h: unitSpan(gy) });
  const LANES = [
    [1, 2, 3, 4, 5, 6, 7].map(y => [9, y]),
    [17, 16, 15, 14, 13, 12, 11].map(x => [x, 9]),
    [17, 16, 15, 14, 13, 12, 11].map(y => [9, y]),
    [1, 2, 3, 4, 5, 6, 7].map(x => [x, 9])
  ];
  const GOALS = [[9, 8], [10, 9], [9, 10], [8, 9]];             // casilla de meta de cada jugador, alrededor del centro
  const JAILS = [[14, 0], [14, 14], [0, 14], [0, 0]];          // esquina (en unidades) de cada cárcel, 8x8
  // posiciones de las fichas dentro de la cárcel según cuántas fichas se juegan (1 a 4)
  const SLOT_LAYOUT = { 1: [[0, 0]], 2: [[-1, 0], [1, 0]], 3: [[-1, -1], [1, -1], [0, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]] };
  const slotsOf = () => SLOT_LAYOUT[(G.s && G.s.n) || 4];
  // La cárcel es un cuadrado de 6.2 unidades pegado a la esquina exterior; el nombre va arriba (esquinas de arriba) o abajo
  const JS = 6.2;
  const JAIL_RECT = JAILS.map(([x, y]) => ({ x: x + (x > 0 ? 8 - JS - .25 : .25), y: y + (y > 0 ? 8 - JS - .25 : .25) }));
  const JAIL_C = JAIL_RECT.map((r, p) => [r.x + JS / 2, r.y + JS / 2 + (JAILS[p][1] === 0 ? .95 : -.95)]);   // centro del área de fichas
  const TINTS = ['rgba(252,209,22,.5)', 'rgba(30,111,224,.38)', 'rgba(224,49,70,.38)', 'rgba(34,177,98,.4)'];

  // Posición (x,y) de la casilla absoluta a (0..67), siguiendo el contorno de la cruz en sentido horario
  function trackXY(a) {
    const arm = Math.floor(a / 17), k = a % 17;   // k: 0..7 un lado, 8 punta, 9..16 el otro lado
    switch (arm) {
      case 0: return k <= 7 ? [8, 7 - k] : k === 8 ? [9, 0] : [10, k - 9];
      case 1: return k <= 7 ? [11 + k, 8] : k === 8 ? [18, 9] : [27 - k, 10];
      case 2: return k <= 7 ? [10, 11 + k] : k === 8 ? [9, 18] : [8, 27 - k];
      default: return k <= 7 ? [7 - k, 10] : k === 8 ? [0, 9] : [k - 9, 8];
    }
  }

  const G = { s: null, mode: 'offline', mySeat: 0, level: 1, timers: [], active: false, stats: { captures: 0 },
              fxSeq: -1, isHost: false, tokenEls: [], chipEls: [], lastResult: null, sixStreak: 0,
              anim: null, animTimers: [], busyUntil: 0 };

  /* ---------- navegación y utilidades ---------- */
  function go(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    $('#app').dataset.screen = id;
    if (id === 'scores') renderScores();
    if (id === 'levels') renderLevels();
    if (id === 'home') renderHome();
    if (id === 'profile') renderProfile();
    if (id === 'credits') renderCredits();
  }
  let toastT;
  function toast(txt, ms = 1500) {
    const t = $('#toast'); t.textContent = txt; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
  }
  function confetti(n = 50) {
    const box = $('#confetti'), cols = ['#FCD116', '#1e6fe0', '#CE1126', '#22b162', '#fff'];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + '%';
      c.style.background = rnd(cols);
      c.style.animationDuration = 1.6 + Math.random() * 1.6 + 's';
      c.style.animationDelay = Math.random() * .4 + 's';
      box.appendChild(c);
      setTimeout(() => c.remove(), 3800);
    }
  }
  function modal(html, buttons) {
    $('#modalCard').innerHTML = html + '<div class="menu" id="modalBtns"></div>';
    buttons.forEach(b => {
      const el = document.createElement('button');
      el.className = 'btn ' + (b.cls || 'blue'); el.textContent = b.text;
      el.onclick = () => { $('#modal').classList.add('hidden'); b.fn && b.fn(); };
      $('#modalBtns').appendChild(el);
    });
    $('#modal').classList.remove('hidden');
  }
  const regionImg = r => `<img src="${r.img}" alt="${r.name}" onerror="this.remove()">`;

  /* ---------- home / créditos / niveles ---------- */
  function renderHome() {
    const n = Store.d.name.trim();
    $('#hello').textContent = n ? `¡Quiubo, ${n}!` : '';
    syncAudioButtons();
  }
  function renderProfile() {
    const hasName = !!Store.d.name.trim();
    $('#inpName').value = Store.d.name;
    $('#profileErr').textContent = '';
    syncAudioButtons();
    $('#btnProfileBack').style.visibility = hasName ? 'visible' : 'hidden';   // la primera vez no se puede saltar
    $('#profileMsg').textContent = hasName ? 'Aquí puedes cambiar tu nombre' : '¡Bienvenido! ¿Cómo te llamas, parcero?';
  }
  function saveName() {
    const n = $('#inpName').value.trim();
    if (!n) { $('#profileErr').textContent = 'Escribe un nombre para continuar'; Sfx.play('lose'); return; }
    Store.d.name = n; Store.save();
    Sfx.play('goal');
    if (/^juan valdez$/i.test(n)) { toast('☕ ¡Juan Valdez aprueba este nombre!', 2600); Store.d.eggs.valdez = true; Store.save(); confetti(40); }
    else toast(`¡Quiubo, ${n}!`);
    go('home');
  }
  const regionCardHTML = r => `<div class="region-card ${r.light ? 'light' : ''}" style="--c:${r.color}">${regionImg(r)}<div class="em">${r.emoji}</div><b>${r.name}</b><small>${r.phrase}</small></div>`;
  function renderCredits() {
    $('#creditRegions').innerHTML = REGIONS.map(regionCardHTML).join('');
    $('#eggHint').textContent = Store.d.eggs.coffee ? '☕ Ya te ganaste el tinto. ¡Gracias por jugar!' : '';
  }
  function renderLevels() {
    $('#regionPick').innerHTML = REGIONS.map((r, i) =>
      `<button class="rp ${i === Store.d.region ? 'sel' : ''}" style="--c:${r.color}" data-r="${i}" title="${r.name}">${r.emoji}</button>`).join('');
    $$('.rp').forEach(b => b.onclick = () => { Store.d.region = +b.dataset.r; Store.save(); Sfx.play('click'); renderLevels(); });
    renderTokPick('#tokPick');
    $('#levelList').innerHTML = LEVELS.map((l, i) => {
      const lock = i + 1 > Store.d.unlocked;
      return `<button class="level" data-l="${i + 1}" ${lock ? 'disabled' : ''}><span class="n">${lock ? '🔒' : i + 1}</span>
        <span><b>${l.name}</b><small>${lock ? 'Gana el nivel anterior para desbloquear' : l.desc}</small></span></button>`;
    }).join('');
    $$('.level').forEach(b => b.onclick = () => { Sfx.play('click'); startOffline(+b.dataset.l); });
  }
  // Selector de cuántas fichas se juegan (1 a 4); se guarda y se usa en las partidas nuevas
  function renderTokPick(q) {
    const box = $(q);
    box.innerHTML = [1, 2, 3, 4].map(n => `<button class="tp ${n === Store.d.tokens ? 'sel' : ''}" data-n="${n}">${n}</button>`).join('');
    $$('.tp', box).forEach(b => b.onclick = () => { Store.d.tokens = +b.dataset.n; Store.save(); Sfx.play('click'); renderTokPick(q); });
  }
  function syncAudioButtons() {
    const s = Store.d.sound ? '🔊' : '🔇';
    const mark = (q, on, icon) => { const b = $(q); b.textContent = icon; b.classList.add('tog'); b.classList.toggle('on', on); };
    ['#btnSound', '#btnSound2', '#btnSound3'].forEach(q => mark(q, Store.d.sound, s));
    ['#btnMusic', '#btnMusic2', '#btnMusic3'].forEach(q => mark(q, Store.d.music, Store.d.music ? '🎵' : '🔕'));
  }
  function toggleMusic() {
    Store.d.music = !Store.d.music; Store.save(); syncAudioButtons();
    if (Store.d.music) Sfx.startMusic(); else Sfx.stopMusic();
  }
  function toggleSound() {
    Store.d.sound = !Store.d.sound; Store.save(); syncAudioButtons(); Sfx.play('click');
  }

  /* ---------- tablero ---------- */
  function buildBoard() {
    const b = $('#board'); b.innerHTML = '';
    const pct = v => (v / N * 100) + '%';
    const place = (el, x, y, w, h) => { el.style.left = pct(x); el.style.top = pct(y); el.style.width = pct(w); el.style.height = pct(h); b.appendChild(el); };
    const placeCell = (el, [gx, gy]) => { const r = cellRect(gx, gy); place(el, r.x, r.y, r.w, r.h); };
    // rótulo de la casilla; en los brazos izquierdo y derecho el texto va vertical
    const lbl = (txt, p, vertical) => `<span class="lbl${vertical ? ' v' : ''}${REGIONS[p].light ? ' dark' : ''}">${txt}</span>`;
    const mk = (cls, html = '', c) => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; if (c) e.style.setProperty('--c', c); return e; };

    // Esquinas: cárcel de cada región con su emoji/foto y un plato para las 4 fichas
    G.jailEls = [];
    JAILS.forEach(([x, y], p) => {
      const r = REGIONS[p], top = y === 0, jr = JAIL_RECT[p];
      const jail = mk('jail' + (r.light ? ' light' : ''),
        `${regionImg(r)}<div class="ptag ${top ? 'top' : 'bot'}"><span class="pe">${r.emoji}</span><b class="pn"></b></div>`, r.color);
      place(jail, jr.x, jr.y, JS, JS);
      slotsOf().forEach(([dx, dy]) => place(mk('slot'), JAIL_C[p][0] + dx - .75, JAIL_C[p][1] + dy - .75, 1.5, 1.5));   // huecos de las 4 fichas
      G.jailEls[p] = jail;
    });
    // Centro: círculo de cielo con el sombrero vueltiao
    place(mk('center'), 8, 8, 6, 6);   // cuatro triángulos de color apuntando al centro
    // Circuito: cada brazo se tiñe con el color de su dueño; SALIDA en la casilla de salida, SEGURO en la punta del brazo
    for (let a = 0; a < Engine.TRACK; a++) {
      const xy = trackXY(a), arm = Math.floor(a / 17), vertical = arm === 1 || arm === 3;
      const sp = Engine.STARTS.indexOf(a), tip = Engine.MOUTHS.indexOf(a), sd = Engine.SIDE_SAFES.indexOf(a);
      let el;
      if (sp >= 0) el = mk('cell start', lbl('SALIDA', sp, vertical), REGIONS[sp].color);
      else if (tip >= 0) el = mk('cell start tip', lbl('SEGURO', tip, vertical), REGIONS[tip].color);
      else if (sd >= 0) { const o = (sd + 3) % 4; el = mk('cell start tip', lbl('SEGURO', o, vertical), REGIONS[o].color); }   // color de la cárcel de ese lado
      else { el = mk('cell'); el.style.background = `linear-gradient(${TINTS[arm]}, ${TINTS[arm]}), #fff`; }
      placeCell(el, xy);
    }
    // Pasillo de llegada (color fuerte) y casilla de meta con su rótulo LLEGADA
    LANES.forEach((cells, p) => cells.forEach(xy => placeCell(mk('cell lane', '', REGIONS[p].color), xy)));
    GOALS.forEach((xy, p) => placeCell(mk('cell goal', lbl('LLEGADA', p, p === 1 || p === 3), REGIONS[p].color), xy));
    place(mk('hat', '<img src="assets/img/sombrero.svg" alt="">'), 9.2, 9.75, 3.6, 2.5);

    G.tokenEls = [0, 1, 2, 3].map(p => Array.from({ length: G.s.n || 4 }, (_, i) => {
      const t = mk('token'); t.style.setProperty('--c', REGIONS[p].color);
      t.onclick = () => onTokenClick(p, i);
      b.appendChild(t); return t;
    }));
    buildDice();
  }

  function centerOf(p, r, i) {
    if (r === -1) return [JAIL_C[p][0] + slotsOf()[i][0], JAIL_C[p][1] + slotsOf()[i][1]];
    const xy = r <= Engine.LAST ? trackXY(Engine.abs(p, r)) : r < Engine.GOAL ? LANES[p][r - Engine.LAST - 1] : GOALS[p];
    const c = cellRect(xy[0], xy[1]);
    return [c.x + c.w / 2, c.y + c.h / 2];
  }

  function buildDice() {
    ['#dice1', '#dice2'].forEach(q => { $(q).innerHTML = '<i></i>'.repeat(9); });
    setFace('#dice1', 1); setFace('#dice2', 1);
  }
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function setFace(q, n) { $$(q + ' i').forEach((el, k) => el.style.opacity = PIPS[n].includes(k) ? 1 : 0); }
  function animateDice(a, b) {
    G.rolling = true;
    ['#dice1', '#dice2'].forEach(q => { const d = $(q); d.classList.remove('rolling'); void d.offsetWidth; d.classList.add('rolling'); });
    let k = 0;
    const iv = setInterval(() => {
      setFace('#dice1', 1 + Math.floor(Math.random() * 6)); setFace('#dice2', 1 + Math.floor(Math.random() * 6));
      if (++k > 5) { clearInterval(iv); G.rolling = false; setFace('#dice1', a); setFace('#dice2', b); }
    }, 80);
  }
  function render() {
    const s = G.s, groups = {};
    s.tokens.forEach((arr, p) => arr.forEach((r, i) => {
      const [cx, cy] = centerOf(p, r, i);
      (groups[cx + ',' + cy] = groups[cx + ',' + cy] || []).push([p, i, cx, cy, r]);
    }));
    Object.values(groups).forEach(g => g.forEach(([p, i, cx, cy, r], k) => {
      let ox = 0, oy = 0;
      if (g.length > 1 && r !== -1) { const ang = k / g.length * Math.PI * 2; ox = Math.cos(ang) * .22; oy = Math.sin(ang) * .22; }
      if (G.anim && ((G.anim.p === p && G.anim.i === i) || G.anim.hold.has(p + ':' + i))) return;  // se mueven con la animación
      setTokenPos(G.tokenEls[p][i], cx + ox, cy + oy);
    }));
    const mine = isMine(s.turn) && s.winner < 0 && !G.anim && !G.paused;
    let ch = [], moves = [];
    if (mine && s.phase === 'move') {
      ch = Engine.choices(s, s.turn);
      if (!ch.some(c => c.use === G.sel)) G.sel = ch.length ? ch[0].use : 0;
      const cur = ch.find(c => c.use === G.sel);
      moves = cur ? cur.moves : [];
    } else if (mine && s.phase === 'bonus') moves = Engine.bonusTokens(s, s.turn);
    G.tokenEls.forEach((arr, p) => arr.forEach((el, i) => el.classList.toggle('movable', p === s.turn && moves.includes(i))));
    G.tokenEls.forEach((arr, p) => arr.forEach(el => el.classList.toggle('turn', p === s.turn && s.winner < 0)));   // las fichas de quien juega brillan
    $('#board').classList.toggle('has-turn', s.winner < 0);
    s.players.forEach((pl, p) => {              // nombre, personaje y progreso en la esquina de cada jugador
      const j = G.jailEls[p];
      j.classList.toggle('active', s.turn === p && s.winner < 0);
      $('.pn', j).textContent = (pl.name || '').replace(/^Bot /, '') + (p === G.mySeat ? ' (tú)' : '');
    });
    $('#btnRoll').disabled = !(mine && s.phase === 'roll');
    if (!G.rolling && s.dice[0]) { setFace('#dice1', s.dice[0]); setFace('#dice2', s.dice[1]); }
    $('#dice1').classList.toggle('used', s.phase === 'move' && !s.avail[0]);
    $('#dice2').classList.toggle('used', s.phase === 'move' && !s.avail[1]);
    // Si hay que elegir, los dados se tocan directamente: el elegido brilla y el + suma los dos
    const choose = ch.length > 1;
    const has = u => ch.some(c => c.use === u);
    $('#dice1').classList.toggle('pickable', choose && has(0)); $('#dice2').classList.toggle('pickable', choose && has(1));
    $('#dice1').classList.toggle('sel', choose && (G.sel === 0 || G.sel === 2)); $('#dice2').classList.toggle('sel', choose && (G.sel === 1 || G.sel === 2));
    $('#btnPlus').classList.toggle('hidden', !(choose && has(2)));
    $('#btnPlus').classList.toggle('sel', G.sel === 2);
    $('#msg').textContent = statusText(mine, moves, ch);
  }
  function statusText(mine, moves, ch) {
    const s = G.s;
    if (s.winner >= 0) return `🏆 Ganó ${s.players[s.winner].name}`;
    if (G.paused) return '⏸️ Juego en pausa';
    if (mine && s.phase === 'roll') return '¡Tu turno! Lanza los dados 🎲🎲';
    if (mine && s.phase === 'bonus') return '🎉 ¡Tres pares! Toca una ficha para sacarla del juego';
    if (mine && s.phase === 'move') return ch.length > 1 ? 'Toca un dado (o el + para sumarlos) y luego una ficha' : (moves.length ? 'Toca la ficha que quieres mover' : 'No tienes jugadas…');
    return `Turno de ${s.players[s.turn].name}…`;
  }

  /* ---------- flujo de turnos ---------- */
  const isMine = p => G.s.players[p].type === 'human' && p === G.mySeat;
  const isActor = p => G.s.players[p].type === 'human' ? p === G.mySeat : (G.mode === 'offline' || G.isHost);

  function clearTimers() { G.timers.forEach(clearTimeout); G.timers = []; $('#tbar').style.transition = 'none'; $('#tbar').style.width = '100%'; }
  // Espera ms y además lo que falte de la animación en curso, para que nada pase encima de otra cosa
  function later(fn, ms) {
    const seq = G.s.seq;
    const wait = ms + Math.max(0, (G.busyUntil || 0) - Date.now());
    G.timers.push(setTimeout(() => { if (G.active && !G.paused && G.s && G.s.seq === seq) fn(); }, wait));
  }
  function startTurnTimer(fn) {
    const secs = G.mode === 'online' ? 25 : LEVELS[G.level - 1].secs;
    later(() => {                                  // el reloj del turno empieza cuando termina la animación
      const bar = $('#tbar');
      bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth;
      bar.style.transition = `width ${secs}s linear`; bar.style.width = '0%';
      later(fn, secs * 1000);
    }, 0);
  }

  /* Ritmo del juego (ms): pausas para que el jugador vea lo que ocurre */
  const PACE = { botRoll: 1300, botMove: 1500, single: 1100, pass: 1800, step: 240 };

  // La ficha avanza casilla por casilla; las capturadas esperan a que llegue para irse a la cárcel
  function setTokenPos(el, cx, cy) { el.style.left = ((cx - .43) / N * 100) + '%'; el.style.top = ((cy - .43) / N * 100) + '%'; }
  function startMoveAnim(ev) {
    const to = G.s.tokens[ev.p][ev.i];
    const path = ev.exit ? [0] : ev.bonus ? [Engine.GOAL] : Array.from({ length: ev.d }, (_, k) => to - ev.d + 1 + k);
    const anim = G.anim = { p: ev.p, i: ev.i, hold: new Set(ev.captured.map(c => c.p + ':' + c.i)) };
    G.busyUntil = Date.now() + path.length * PACE.step + 500;
    G.animTimers.forEach(clearTimeout); G.animTimers = [];
    path.forEach((r, k) => G.animTimers.push(setTimeout(() => {
      if (G.anim !== anim) return;
      const [cx, cy] = centerOf(ev.p, r, ev.i);
      setTokenPos(G.tokenEls[ev.p][ev.i], cx, cy); Sfx.play('move');
    }, k * PACE.step)));
    G.animTimers.push(setTimeout(() => {
      if (G.anim !== anim) return;
      G.anim = null; render(); moveFx(ev);
    }, path.length * PACE.step + 120));
  }
  function moveFx(ev) {
    if (ev.captured.length) {
      Sfx.play('capture'); toast(rnd(PHRASES.capture), 1800);
      ev.captured.forEach(c => { const el = G.tokenEls[c.p][c.i]; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); });
    } else if (ev.goal) { Sfx.play('goal'); toast(rnd(PHRASES.goal), 1800); confetti(25); }
    else if (ev.exit) Sfx.play('exit');
    if (ev.win) Sfx.play(ev.p === G.mySeat ? 'win' : 'lose');
  }

  function schedule() {
    clearTimers();
    const s = G.s;
    if (G.paused) return;
    if (s.winner >= 0) return finishGame();
    const p = s.turn, pl = s.players[p];
    if (!isActor(p)) {
      if (G.mode === 'online' && G.isHost) later(() => {   // jugador remoto desconectado: lo reemplaza un bot
        pl.type = 'bot'; pl.level = 2; pl.name += ' (bot)'; s.seq++; commit();
      }, 45000);
      return;
    }
    const human = pl.type === 'human';
    if (s.phase === 'roll') {
      if (human) startTurnTimer(doRoll); else later(doRoll, PACE.botRoll);
    } else if (s.phase === 'bonus') {                       // tres pares: se saca una ficha del juego
      if (human) startTurnTimer(() => doBonus(Engine.botBonus(s, p))); else later(() => doBonus(Engine.botBonus(s, p)), PACE.botMove);
    } else {
      const ch = Engine.choices(s, p);
      if (!ch.length) later(doPass, PACE.pass);
      else if (ch.length === 1 && ch[0].moves.length === 1) later(() => doMove(ch[0].moves[0], ch[0].use), human ? PACE.single : PACE.botMove);
      else if (human) startTurnTimer(() => { const c = Engine.botChoose(s, p, 3); doMove(c.i, c.use); });
      else later(() => { const c = Engine.botChoose(s, p, pl.level || G.level); doMove(c.i, c.use); }, PACE.botMove);
    }
  }

  function commit() {
    if (G.mode === 'online') Online.push(G.s);
    onNewState();
  }
  function onNewState() {
    const fresh = G.fxSeq !== G.s.seq;
    if (fresh) { G.fxSeq = G.s.seq; if (G.s.last && G.s.last.kind === 'move') startMoveAnim(G.s.last); }
    render();
    if (fresh) playFx(G.s.last);
    schedule();
  }

  const d6 = () => 1 + Math.floor(Math.random() * 6);
  function doRoll() {
    const s = G.s; if (s.phase !== 'roll' || !isActor(s.turn)) return;
    Engine.roll(s, d6(), d6());
    commit();
  }
  function doMove(i, use = G.sel) {
    const s = G.s, p = s.turn;
    const ev = Engine.apply(s, p, i, use);
    if (p === G.mySeat) G.stats.captures += ev.captured.length;
    commit();
  }
  function doBonus(i) { Engine.takeOut(G.s, G.s.turn, i); commit(); }
  function doPass() { Engine.pass(G.s, G.s.turn); commit(); }

  function onTokenClick(p, i) {
    const s = G.s;
    if (!s || s.winner >= 0 || s.turn !== p || !isMine(p) || G.anim || G.paused) return;
    if (s.phase === 'bonus') { if (Engine.bonusTokens(s, p).includes(i)) { clearTimers(); doBonus(i); } return; }
    if (s.phase !== 'move') return;
    const c = Engine.choices(s, p).find(c => c.use === G.sel);
    if (!c || !c.moves.includes(i)) return;
    clearTimers(); doMove(i, c.use);
  }

  function playFx(ev) {
    if (!ev) return;
    if (ev.kind === 'roll') {
      Sfx.play('roll'); animateDice(ev.d[0], ev.d[1]);
      if (ev.triple) { Sfx.play('goal'); toast('🎉 ¡Tres pares seguidos! Sacas una ficha del juego', 2800); confetti(40); }
      else if (ev.dbl) { Sfx.play('six'); toast('¡Par! ' + rnd(PHRASES.six) + ' Repites turno', 1800); }
      if (ev.d[0] === 6 && ev.d[1] === 6 && ev.p === G.mySeat) eggSixes();
    } else if (ev.kind === 'move') {
      if (ev.captured.length) {
        Sfx.play('capture'); toast(rnd(PHRASES.capture));
        ev.captured.forEach(c => { const el = G.tokenEls[c.p][c.i]; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); });
      } else if (ev.goal) { Sfx.play('goal'); toast(rnd(PHRASES.goal)); confetti(25); }
      else if (ev.exit) Sfx.play('exit');
      else Sfx.play('move');
      if (ev.win) Sfx.play(ev.p === G.mySeat ? 'win' : 'lose');
    } else if (ev.kind === 'pass') {
      toast(rnd(PHRASES.pass), 1100);
    }
  }

  /* ---------- inicio y fin de partida ---------- */
  function begin(state) {
    G.animTimers.forEach(clearTimeout); G.animTimers = []; G.anim = null; G.busyUntil = 0;
    G.paused = false; G.rolling = false; G.sel = 0;
    G.s = state; G.active = true; G.stats = { captures: 0 }; G.fxSeq = state.seq; G.sixStreak = 0; G.lastResult = null;
    buildBoard();
    $('#btnPause').classList.toggle('hidden', G.mode !== 'offline');   // la pausa solo existe jugando offline
    $('#gameTitle').textContent = G.mode === 'offline' ? `Nivel ${G.level} · ${LEVELS[G.level - 1].name}` : `Sala ${Online.code}`;
    go('game');
    Sfx.play('exit');
    toast(`Juegas con ${REGIONS[G.mySeat].name} ${REGIONS[G.mySeat].emoji}`);
    render(); schedule();
  }

  function startOffline(level) {
    G.mode = 'offline'; G.level = level; G.mySeat = Store.d.region; G.isHost = true;
    const name = Store.d.name.trim() || 'Parcero';
    const players = REGIONS.map((r, i) => i === G.mySeat ? { type: 'human', name } : { type: 'bot', name: 'Bot ' + r.name, level });
    begin(Engine.newState(players, Store.d.tokens));
  }

  function finishGame() {
    G.active = false; clearTimers();
    const s = G.s, won = s.winner === G.mySeat;
    const goals = s.tokens[G.mySeat].filter(r => r === Engine.GOAL).length;
    const n = s.n || 4;                                     // ganar con menos fichas vale menos
    const pts = goals * 100 + G.stats.captures * 50 + (won ? Math.round(300 * (G.mode === 'offline' ? G.level : 2) * n / 4) : 0);
    const entry = { name: Store.d.name.trim() || 'Anónimo', pts, won, captures: G.stats.captures,
                    mode: G.mode, level: G.mode === 'offline' ? G.level : 0, date: Date.now() };
    Store.addScore(entry);
    G.lastResult = entry;
    let extra = '';
    if (won && G.mode === 'offline' && G.level < 3) { Store.unlock(G.level + 1); extra = '<p>🔓 ¡Desbloqueaste el siguiente nivel!</p>'; }
    if (won) confetti(90);
    setTimeout(() => modal(
      `<div class="em">${won ? '🏆' : '😅'}</div><h3>${won ? '¡Ganaste, parce!' : 'Ganó ' + s.players[s.winner].name}</h3>
       <p><b>${pts}</b> puntos · ${G.stats.captures} capturas · ${goals}/${n} fichas en meta</p>${extra}`,
      [{ text: '🏆 Ver puntajes', cls: 'yellow', fn: () => { leaveRoom(); go('scores'); } }]), 1600 + Math.max(0, G.busyUntil - Date.now()));
  }

  /* ---------- pausa (solo offline) ---------- */
  function pauseGame() {
    if (!G.active || G.mode !== 'offline' || G.paused || G.s.winner >= 0) return;
    G.paused = true; clearTimers();
    render();
    modal('<div class="em">⏸️</div><h3>Juego en pausa</h3><p>Tu partida sigue guardada. Cuando quieras, continúa.</p>',
      [{ text: '▶️ Continuar', cls: 'yellow', fn: resumeGame },
       { text: '🚪 Salir de la partida', cls: 'red', fn: () => { G.paused = false; leaveRoom(); go('home'); } }]);
  }
  function resumeGame() {
    if (!G.paused) return;
    G.paused = false;
    render(); schedule();
  }

  function leaveRoom() {
    G.active = false; clearTimers();
    if (G.mode === 'online') { Online.leave(G.isHost); }
  }

  /* ---------- puntajes ---------- */
  function renderScores() {
    const st = Store.d.stats;
    $('#statsRow').innerHTML = [['Partidas', st.games], ['Victorias', st.wins], ['Capturas', st.captures]]
      .map(([l, v]) => `<div class="stat"><b>${v}</b>${l}</div>`).join('');
    const banner = $('#resultBanner');
    if (G.lastResult) {
      banner.classList.remove('hidden');
      banner.innerHTML = `<h3>${G.lastResult.won ? '🏆 ¡Victoria!' : 'Última partida'}</h3><p>${G.lastResult.pts} puntos</p>`;
    } else banner.classList.add('hidden');
    const list = Store.d.scores;
    $('#rankList').innerHTML = list.length ? list.map((e, i) =>
      `<li class="${G.lastResult && e.date === G.lastResult.date ? 'new' : ''}"><span>${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${esc(e.name)}
        <small>${e.mode === 'offline' ? 'Offline · Nivel ' + e.level : 'Online'} · ${new Date(e.date).toLocaleDateString()}</small></span>
        <span class="pts">${e.pts}</span></li>`).join('') : '<li>Aún no hay partidas. ¡Anímate!</li>';
  }
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- online ---------- */
  let room = null;
  function openLobby() {
    const ok = Online.ready();
    $('#lobbyNoConfig').classList.toggle('hidden', ok);
    $('#btnCreate').disabled = !ok; $('#btnJoin').disabled = !ok;
    $('#lobbyErr').textContent = '';
    showLobbyRoom(false);
    go('lobby');
  }
  function showLobbyRoom(v) { $('#lobbyMenu').classList.toggle('hidden', v); $('#lobbyRoom').classList.toggle('hidden', !v); }

  async function enterRoom(promise) {
    try {
      $('#lobbyErr').textContent = '';
      await promise;
      showLobbyRoom(true);
      Online.listen(onRoom);
    } catch (e) { $('#lobbyErr').textContent = e.message || 'No se pudo conectar. Revisa tu internet.'; }
  }
  function onRoom(v) {
    if (!v) {                                    // el anfitrión cerró la sala
      if (G.active || $('#lobby').classList.contains('active')) { toast('La sala se cerró'); G.active = false; clearTimers(); go('home'); }
      return;
    }
    room = v;
    if (v.state) {
      const st = normalize(v.state);
      if (!G.active && $('#lobby').classList.contains('active')) {
        G.mode = 'online'; G.mySeat = Online.seatOf(v); G.isHost = v.host === Online.uid;
        if (G.mySeat < 0) return;
        begin(st);
      } else if (G.active && st.seq > G.s.seq) { G.s = st; onNewState(); }
      return;
    }
    renderLobby(v);
  }
  function renderLobby(v) {
    $('#roomCode').textContent = Online.code;
    $('#seatList').innerHTML = REGIONS.map((r, i) => {
      const s = v.seats && v.seats['s' + i];
      return s ? `<li class="${r.light ? 'light' : ''}" style="--c:${r.color}">${r.emoji} ${esc(s.name)} ${s.uid === Online.uid ? '(tú)' : ''}</li>`
               : `<li class="empty">${r.emoji} Libre (juega un bot)</li>`;
    }).join('');
    const host = v.host === Online.uid;
    $('#btnStart').classList.toggle('hidden', !host);
    $('#lobbyTok').classList.toggle('hidden', !host);
    if (host) renderTokPick('#tokPickLobby');
    $('#waitHost').classList.toggle('hidden', host);
  }
  function normalize(st) {
    st.n = st.n || 4;
    st.tokens = st.tokens.map(a => Array.from({ length: st.n }, (_, i) => a[i]));
    st.players = Array.from({ length: 4 }, (_, i) => st.players[i]);
    st.last = st.last || {}; st.last.captured = st.last.captured || [];
    st.dice = [(st.dice && st.dice[0]) || 0, (st.dice && st.dice[1]) || 0];
    st.avail = [!!(st.avail && st.avail[0]), !!(st.avail && st.avail[1])]; st.dbl = !!st.dbl; st.dbls = st.dbls || 0;
    st.winner = st.winner == null ? -1 : st.winner;
    return st;
  }
  function hostStart() {
    const players = REGIONS.map((r, i) => {
      const s = room.seats && room.seats['s' + i];
      return s ? { type: 'human', name: s.name, uid: s.uid } : { type: 'bot', name: 'Bot ' + r.name, level: 2 };
    });
    Online.startGame(Engine.newState(players, Store.d.tokens));
  }

  /* ---------- easter eggs ---------- */
  function eggSixes() { toast('🎲🎲 ¡Doble seis! Hoy te quiere la Virgen', 2600); confetti(40); }
  function party() {
    document.body.classList.toggle('fiesta');
    Sfx.play('party'); confetti(80);
    Store.d.eggs.party = true; Store.save();
    toast(document.body.classList.contains('fiesta') ? '🎺 ¡Modo fiesta vallenata activado!' : 'Se acabó la fiesta 😅', 2200);
  }

  /* ---------- eventos ---------- */
  function init() {
    const toGo = e => { Sfx.unlock(); Sfx.play('click'); go(e.currentTarget.dataset.go); };
    $$('[data-go]').forEach(b => b.onclick = toGo);

    let splashDone = false;
    const leaveSplash = () => { if (splashDone) return; splashDone = true; Sfx.unlock(); Sfx.startMusic(); go(Store.d.name.trim() ? 'home' : 'profile'); };
    $('#splash').onclick = leaveSplash;
    setTimeout(leaveSplash, 2600);

    $('#btnSaveName').onclick = saveName;
    $('#inpName').onkeydown = e => { if (e.key === 'Enter') saveName(); };
    $('#btnProfileBack').onclick = () => { Sfx.play('click'); go('home'); };
    ['#btnSound', '#btnSound2', '#btnSound3'].forEach(q => $(q).onclick = toggleSound);
    ['#btnMusic', '#btnMusic2', '#btnMusic3'].forEach(q => $(q).onclick = toggleMusic);

    $('#btnOffline').onclick = () => { Sfx.play('click'); go('levels'); };
    $('#btnOnline').onclick = () => { Sfx.play('click'); openLobby(); };
    $('#btnRoll').onclick = () => { if (G.s && G.s.phase === 'roll' && isMine(G.s.turn)) { clearTimers(); doRoll(); } };
    // Tocar un dado: lanza si toca lanzar, o elige ese dado si hay que escoger con cuál mover
    const pickDie = use => {
      const s = G.s; if (!s || G.anim || G.paused) return;
      if (s.phase === 'roll') $('#btnRoll').click();
      else if (s.phase === 'move' && isMine(s.turn) && Engine.choices(s, s.turn).some(c => c.use === use)) { G.sel = use; Sfx.play('click'); render(); }
    };
    $('#dice1').onclick = () => pickDie(0); $('#dice2').onclick = () => pickDie(1); $('#btnPlus').onclick = () => pickDie(2);
    $('#btnPause').onclick = () => { Sfx.play('click'); pauseGame(); };
    $('#btnExit').onclick = () => modal('<div class="em">🚪</div><h3>¿Salir de la partida?</h3><p>Se perderá el progreso de esta partida.</p>',
      [{ text: 'Seguir jugando', cls: 'green' }, { text: 'Salir', cls: 'red', fn: () => { leaveRoom(); go('home'); } }]);
    $('#btnAgain').onclick = () => { Sfx.play('click'); if (G.mode === 'online') openLobby(); else go('levels'); };

    $('#btnCreate').onclick = () => enterRoom(Online.create(Store.d.name.trim() || 'Parcero'));
    $('#btnJoin').onclick = () => enterRoom(Online.join($('#inpCode').value, Store.d.name.trim() || 'Parcero'));
    $('#btnStart').onclick = hostStart;
    $('#btnLobbyBack').onclick = () => { G.mode = 'online'; Online.leave(room && room.host === Online.uid); room = null; go('home'); };

    let logoTaps = 0, coffeeTaps = 0;
    $('#logoEgg').onclick = () => { if (++logoTaps >= 7) { logoTaps = 0; party(); } };
    $('#coffee').onclick = () => {
      if (++coffeeTaps >= 5) { coffeeTaps = 0; Store.d.eggs.coffee = true; Store.save(); confetti(60); Sfx.play('goal');
        modal('<div class="em">☕</div><h3>¡Tinto gratis!</h3><p>Descubriste el huevo de pascua del café. Que no se enfríe, parce.</p>', [{ text: '¡Gracias!', cls: 'yellow' }]); renderCredits(); }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { Sfx.stopMusic(); pauseGame(); }     // al salir de la app, la partida offline se pausa sola
      else if (Store.d.music) Sfx.startMusic();
    });
    renderHome();
  }
  init();
  if (location.search.includes('debug')) window.__G = G;   // solo para pruebas manuales
})();

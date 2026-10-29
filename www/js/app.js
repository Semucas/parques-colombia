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
    pass: ['Sin jugadas, ¡toca esperar!', 'Hoy no es el día, parce'],
    exit: ['¡Ficha pa\' la calle!', '¡Quiubo, a rodar!']
  };
  const N = 18;
  const LANES = [
    [1, 2, 3, 4, 5, 6, 7].map(y => [8, y]),
    [16, 15, 14, 13, 12, 11, 10].map(x => [x, 8]),
    [16, 15, 14, 13, 12, 11, 10].map(y => [9, y]),
    [1, 2, 3, 4, 5, 6, 7].map(x => [x, 9])
  ];
  const GOALS = [[8, 8], [9, 8], [9, 9], [8, 9]];
  const JAILS = [[10, 1], [10, 10], [1, 10], [1, 1]];          // esquina (x,y) de cada cárcel, 7x7
  const SLOTS = [[-1, -0.6], [1, -0.6], [-1, 1.4], [1, 1.4]];  // posiciones de las 4 fichas en la cárcel

  const trackXY = a => a <= 16 ? [a, 0] : a <= 33 ? [17, a - 17] : a <= 50 ? [17 - (a - 34), 17] : [0, 17 - (a - 51)];

  const G = { s: null, mode: 'offline', mySeat: 0, level: 1, timers: [], active: false, stats: { captures: 0 },
              fxSeq: -1, isHost: false, tokenEls: [], chipEls: [], lastResult: null, sixStreak: 0 };

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
    $('#levelList').innerHTML = LEVELS.map((l, i) => {
      const lock = i + 1 > Store.d.unlocked;
      return `<button class="level" data-l="${i + 1}" ${lock ? 'disabled' : ''}><span class="n">${lock ? '🔒' : i + 1}</span>
        <span><b>${l.name}</b><small>${lock ? 'Gana el nivel anterior para desbloquear' : l.desc}</small></span></button>`;
    }).join('');
    $$('.level').forEach(b => b.onclick = () => { Sfx.play('click'); startOffline(+b.dataset.l); });
  }
  function syncAudioButtons() {
    const s = Store.d.sound ? '🔊' : '🔇';
    const mark = (q, on, icon) => { const b = $(q); b.textContent = icon; b.classList.add('tog'); b.classList.toggle('on', on); };
    ['#btnSound', '#btnSound2', '#btnSound3'].forEach(q => mark(q, Store.d.sound, s));
    ['#btnMusic', '#btnMusic2'].forEach(q => mark(q, Store.d.music, Store.d.music ? '🎵' : '🔕'));
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
    const place = (el, x, y, w = 1, h = 1) => { el.style.left = pct(x); el.style.top = pct(y); if (w !== 1 || h !== 1) { el.style.width = pct(w); el.style.height = pct(h); } b.appendChild(el); };
    const mk = (cls, html = '', c) => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; if (c) e.style.setProperty('--c', c); return e; };

    JAILS.forEach(([x, y], p) => {
      const r = REGIONS[p];
      place(mk('jail' + (r.light ? ' light' : ''), `${regionImg(r)}<span class="je">${r.emoji}</span><b>${r.name}</b>`, r.color), x, y, 7, 7);
    });
    for (let a = 0; a < Engine.TRACK; a++) {
      const [x, y] = trackXY(a);
      const sp = Engine.STARTS.indexOf(a);
      const safe = Engine.SAFE.has(a);
      const el = mk('cell' + (sp >= 0 ? ' start' : safe ? ' safe' : ''), sp >= 0 ? REGIONS[sp].emoji : safe ? '⭐' : '', sp >= 0 ? REGIONS[sp].color : null);
      place(el, x, y);
    }
    LANES.forEach((cells, p) => cells.forEach(([x, y]) => place(mk('cell lane', '', REGIONS[p].color), x, y)));
    GOALS.forEach(([x, y], p) => place(mk('cell goal', '', REGIONS[p].color), x, y));
    place(mk('center', '🇨🇴'), 7.4, 7.4, 3.2, 3.2);

    G.tokenEls = [0, 1, 2, 3].map(p => [0, 1, 2, 3].map(i => {
      const t = mk('token'); t.style.setProperty('--c', REGIONS[p].color);
      t.onclick = () => onTokenClick(p, i);
      b.appendChild(t); return t;
    }));
    $('#chips').innerHTML = REGIONS.map((r, p) =>
      `<div class="chip ${r.light ? 'light' : ''}" style="--c:${r.color}"><span>${r.emoji}</span><b></b><div class="goals"></div></div>`).join('');
    G.chipEls = $$('.chip');
    buildDice();
  }

  function centerOf(p, r, i) {
    if (r === -1) { const [x, y] = JAILS[p]; return [x + 3.5 + SLOTS[i][0], y + 3.5 + SLOTS[i][1]]; }
    if (r <= Engine.LAST) { const [x, y] = trackXY(Engine.abs(p, r)); return [x + .5, y + .5]; }
    if (r < Engine.GOAL) { const [x, y] = LANES[p][r - 67]; return [x + .5, y + .5]; }
    const [x, y] = GOALS[p]; return [x + .5, y + .5];
  }

  function buildDice() {
    const d = $('#dice'); d.innerHTML = '<i></i>'.repeat(9);
    setFace(1);
  }
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function setFace(n) { $$('#dice i').forEach((el, k) => el.style.opacity = PIPS[n].includes(k) ? 1 : 0); }
  function animateDice(final) {
    const d = $('#dice'); d.classList.remove('rolling'); void d.offsetWidth; d.classList.add('rolling');
    let k = 0;
    const iv = setInterval(() => { setFace(1 + Math.floor(Math.random() * 6)); if (++k > 5) { clearInterval(iv); setFace(final); } }, 80);
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
      const el = G.tokenEls[p][i];
      el.style.left = ((cx + ox - .4) / N * 100) + '%';
      el.style.top = ((cy + oy - .4) / N * 100) + '%';
    }));
    const mine = isMine(s.turn) && s.winner < 0;
    const moves = mine && s.phase === 'move' ? Engine.legalMoves(s, s.turn, s.dice) : [];
    G.tokenEls.forEach((arr, p) => arr.forEach((el, i) => el.classList.toggle('movable', p === s.turn && moves.includes(i))));
    s.players.forEach((pl, p) => {
      const chip = G.chipEls[p];
      chip.classList.toggle('active', s.turn === p && s.winner < 0);
      chip.classList.toggle('me', p === G.mySeat);
      $('b', chip).textContent = pl.name;
      $('.goals', chip).textContent = `🏁 ${s.tokens[p].filter(r => r === Engine.GOAL).length}/4`;
    });
    $('#btnRoll').disabled = !(mine && s.phase === 'roll');
    if (s.phase === 'move') setFace(s.dice);
    $('#msg').textContent = statusText(mine, moves);
  }
  function statusText(mine, moves) {
    const s = G.s;
    if (s.winner >= 0) return `🏆 Ganó ${s.players[s.winner].name}`;
    if (mine && s.phase === 'roll') return '¡Tu turno! Lanza el dado 🎲';
    if (mine && s.phase === 'move') return moves.length ? 'Toca la ficha que quieres mover' : (s.dice === 5 ? '' : 'No tienes jugadas…');
    return `Turno de ${s.players[s.turn].name}…`;
  }

  /* ---------- flujo de turnos ---------- */
  const isMine = p => G.s.players[p].type === 'human' && p === G.mySeat;
  const isActor = p => G.s.players[p].type === 'human' ? p === G.mySeat : (G.mode === 'offline' || G.isHost);

  function clearTimers() { G.timers.forEach(clearTimeout); G.timers = []; $('#tbar').style.transition = 'none'; $('#tbar').style.width = '100%'; }
  function later(fn, ms) {
    const seq = G.s.seq;
    G.timers.push(setTimeout(() => { if (G.active && G.s && G.s.seq === seq) fn(); }, ms));
  }
  function startTurnTimer(fn) {
    const secs = G.mode === 'online' ? 25 : LEVELS[G.level - 1].secs;
    const bar = $('#tbar');
    bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth;
    bar.style.transition = `width ${secs}s linear`; bar.style.width = '0%';
    later(fn, secs * 1000);
  }

  function schedule() {
    clearTimers();
    const s = G.s;
    if (s.winner >= 0) return finishGame();
    const p = s.turn, pl = s.players[p];
    if (!isActor(p)) {
      if (G.mode === 'online' && G.isHost) later(() => {   // jugador remoto desconectado: lo reemplaza un bot
        pl.type = 'bot'; pl.level = 2; pl.name += ' (bot)'; s.seq++; commit();
      }, 45000);
      return;
    }
    const human = pl.type === 'human';
    const moves = s.phase === 'move' ? Engine.legalMoves(s, p, s.dice) : [];
    if (s.phase === 'roll') {
      if (human) startTurnTimer(doRoll); else later(doRoll, 750);
    } else if (!moves.length) {
      later(doPass, 1000);
    } else if (moves.length === 1) {
      later(() => doMove(moves[0]), human ? 600 : 800);
    } else if (human) {
      startTurnTimer(() => doMove(Engine.botChoose(s, p, s.dice, moves, 3)));
    } else {
      later(() => doMove(Engine.botChoose(s, p, s.dice, moves, pl.level || G.level)), 850);
    }
  }

  function commit() {
    if (G.mode === 'online') Online.push(G.s);
    onNewState();
  }
  function onNewState() {
    render();
    if (G.fxSeq !== G.s.seq) { G.fxSeq = G.s.seq; playFx(G.s.last); }
    schedule();
  }

  function doRoll() {
    const s = G.s; if (s.phase !== 'roll' || !isActor(s.turn)) return;
    Engine.roll(s, 1 + Math.floor(Math.random() * 6));
    commit();
  }
  function doMove(i) {
    const s = G.s, p = s.turn;
    const ev = Engine.apply(s, p, i, s.dice);
    if (p === G.mySeat) G.stats.captures += ev.captured.length;
    commit();
  }
  function doPass() { Engine.pass(G.s, G.s.turn, G.s.dice); commit(); }

  function onTokenClick(p, i) {
    const s = G.s;
    if (!s || s.winner >= 0 || s.phase !== 'move' || s.turn !== p || !isMine(p)) return;
    if (!Engine.legalMoves(s, p, s.dice).includes(i)) return;
    clearTimers(); doMove(i);
  }

  function playFx(ev) {
    if (!ev) return;
    if (ev.kind === 'roll') {
      Sfx.play('roll'); animateDice(ev.d);
      if (ev.d === 6) { Sfx.play('six'); toast(rnd(PHRASES.six), 1200); }
      if (ev.p === G.mySeat) {
        G.sixStreak = ev.d === 6 ? G.sixStreak + 1 : 0;
        if (G.sixStreak === 3) eggSixes();
      }
    } else if (ev.kind === 'move') {
      if (ev.captured.length) {
        Sfx.play('capture'); toast(rnd(PHRASES.capture));
        ev.captured.forEach(c => { const el = G.tokenEls[c.p][c.i]; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); });
      } else if (ev.goal) { Sfx.play('goal'); toast(rnd(PHRASES.goal)); confetti(25); }
      else if (ev.exit) { Sfx.play('exit'); toast(rnd(PHRASES.exit), 1100); }
      else Sfx.play('move');
      if (ev.win) Sfx.play(ev.p === G.mySeat ? 'win' : 'lose');
    } else if (ev.kind === 'pass') {
      toast(rnd(PHRASES.pass), 1100);
    }
  }

  /* ---------- inicio y fin de partida ---------- */
  function begin(state) {
    G.s = state; G.active = true; G.stats = { captures: 0 }; G.fxSeq = state.seq; G.sixStreak = 0; G.lastResult = null;
    buildBoard();
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
    begin(Engine.newState(players));
  }

  function finishGame() {
    G.active = false; clearTimers();
    const s = G.s, won = s.winner === G.mySeat;
    const goals = s.tokens[G.mySeat].filter(r => r === Engine.GOAL).length;
    const pts = goals * 100 + G.stats.captures * 50 + (won ? 300 * (G.mode === 'offline' ? G.level : 2) : 0);
    const entry = { name: Store.d.name.trim() || 'Anónimo', pts, won, captures: G.stats.captures,
                    mode: G.mode, level: G.mode === 'offline' ? G.level : 0, date: Date.now() };
    Store.addScore(entry);
    G.lastResult = entry;
    let extra = '';
    if (won && G.mode === 'offline' && G.level < 3) { Store.unlock(G.level + 1); extra = '<p>🔓 ¡Desbloqueaste el siguiente nivel!</p>'; }
    if (won) confetti(90);
    setTimeout(() => modal(
      `<div class="em">${won ? '🏆' : '😅'}</div><h3>${won ? '¡Ganaste, parce!' : 'Ganó ' + s.players[s.winner].name}</h3>
       <p><b>${pts}</b> puntos · ${G.stats.captures} capturas · ${goals}/4 fichas en meta</p>${extra}`,
      [{ text: '🏆 Ver puntajes', cls: 'yellow', fn: () => { leaveRoom(); go('scores'); } }]), 900);
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
    $('#waitHost').classList.toggle('hidden', host);
  }
  function normalize(st) {
    st.tokens = st.tokens.map(a => Array.from({ length: 4 }, (_, i) => a[i]));
    st.players = Array.from({ length: 4 }, (_, i) => st.players[i]);
    st.last = st.last || {}; st.last.captured = st.last.captured || [];
    st.dice = st.dice || 0; st.winner = st.winner == null ? -1 : st.winner;
    return st;
  }
  function hostStart() {
    const players = REGIONS.map((r, i) => {
      const s = room.seats && room.seats['s' + i];
      return s ? { type: 'human', name: s.name, uid: s.uid } : { type: 'bot', name: 'Bot ' + r.name, level: 2 };
    });
    Online.startGame(Engine.newState(players));
  }

  /* ---------- easter eggs ---------- */
  function eggSixes() { toast('🎲🎲🎲 ¡Tres seises! Hoy te quiere la Virgen', 2600); confetti(40); }
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
    ['#btnMusic', '#btnMusic2'].forEach(q => $(q).onclick = toggleMusic);

    $('#btnOffline').onclick = () => { Sfx.play('click'); go('levels'); };
    $('#btnOnline').onclick = () => { Sfx.play('click'); openLobby(); };
    $('#btnRoll').onclick = () => { if (G.s && G.s.phase === 'roll' && isMine(G.s.turn)) { clearTimers(); doRoll(); } };
    $('#dice').onclick = () => $('#btnRoll').click();
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

    document.addEventListener('visibilitychange', () => { if (document.hidden) Sfx.stopMusic(); else if (Store.d.music) Sfx.startMusic(); });
    renderHome();
  }
  init();
  if (location.search.includes('debug')) window.__G = G;   // solo para pruebas manuales
})();

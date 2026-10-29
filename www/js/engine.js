/* Motor del parqués: lógica pura, sin DOM. Lo usan el modo offline, los bots y el online.
   Reglas: se juega con DOS dados. Cada dado se usa por separado con una ficha (se deben usar los dos).
   Con un 5 en un dado sale una ficha de la cárcel.
   El turno se repite SOLO si salen dos dados iguales (par). Tres pares seguidos: el jugador saca del juego
   una ficha, como si hubiera llegado a la llegada. */
const Engine = (() => {
  const TRACK = 68;                  // casillas del circuito
  const STARTS = [3, 20, 37, 54];   // casilla SALIDA de cada jugador (índice absoluto): 5.ª casilla del brazo, en el lado opuesto a su cárcel
  const LAST = 63;                   // última casilla del circuito (la punta de su brazo); después entra al pasillo
  const GOAL = LAST + 8;             // posición relativa de la meta (LAST+1 .. LAST+7 es el pasillo de llegada)
  const MOUTHS = [8, 25, 42, 59];   // punta de cada brazo (entrada al pasillo): casilla "seguro"
  const SIDE_SAFES = [13, 30, 47, 64]; // 5.ª casilla del lado de la cárcel de cada brazo: también "seguro"
  const SAFE = new Set([...STARTS, ...MOUTHS, ...SIDE_SAFES]);

  // Las fichas avanzan en sentido contrario a las manecillas del reloj: el índice absoluto va DISMINUYENDO
  const abs = (p, r) => (((STARTS[p] - r) % TRACK) + TRACK) % TRACK;

  // r = -1 cárcel, 0..LAST circuito, LAST+1..LAST+7 pasillo, GOAL meta
  // phase: 'roll' (toca lanzar) | 'move' (hay dados por jugar) | 'bonus' (tres pares: sacar una ficha)
  function newState(players, n = 4) {
    return {
      n, tokens: [0, 1, 2, 3].map(() => Array.from({ length: n }, () => -1)),
      turn: 0, dice: [0, 0], avail: [false, false], dbl: false, dbls: 0,
      phase: 'roll', winner: -1, seq: 0,
      players, last: { kind: 'start', captured: [] }
    };
  }

  function legalMoves(s, p, v) {
    const moves = [];
    s.tokens[p].forEach((r, i) => {
      if (r === -1) { if (v === 5) moves.push(i); }
      else if (r < GOAL && r + v <= GOAL) moves.push(i);
    });
    return moves;
  }

  // Dados que aún no se han usado: use 0 = dado 1, use 1 = dado 2
  function values(s) {
    const o = [];
    if (s.avail[0]) o.push({ use: 0, v: s.dice[0] });
    if (s.avail[1]) o.push({ use: 1, v: s.dice[1] });
    return o;
  }
  // Usos que tienen al menos una ficha que se pueda mover: [{use, v, moves}]
  function choices(s, p) {
    return values(s).map(o => ({ ...o, moves: legalMoves(s, p, o.v) })).filter(o => o.moves.length);
  }

  function roll(s, d1, d2) {
    s.dice = [d1, d2]; s.avail = [true, true];
    s.dbl = d1 === d2;
    s.dbls = s.dbl ? s.dbls + 1 : 0;
    const triple = s.dbl && s.dbls >= 3;
    s.phase = triple ? 'bonus' : 'move';
    if (triple) s.avail = [false, false];
    s.last = { kind: 'roll', p: s.turn, d: [d1, d2], dbl: s.dbl, triple, captured: [] };
    s.seq++;
  }

  function endTurn(s, p) {
    const extra = s.dbl && s.dbls < 3;                      // solo se repite con par (y no el tercero)
    if (!extra) { s.turn = (p + 1) % 4; s.dbls = 0; }
    s.dice = [0, 0]; s.avail = [false, false]; s.dbl = false;
    s.phase = 'roll'; s.seq++;
  }

  function checkWin(s, p, ev) {
    if (s.tokens[p].every(r => r === GOAL)) { s.winner = p; ev.win = true; return true; }
    return false;
  }

  function apply(s, p, i, use) {
    const v = s.dice[use];
    const t = s.tokens[p];
    const ev = { kind: 'move', p, i, d: v, captured: [], goal: false, exit: false };
    if (t[i] === -1) { t[i] = 0; ev.exit = true; } else t[i] += v;
    const r = t[i];
    if (r === GOAL) ev.goal = true;
    else if (r <= LAST && !SAFE.has(abs(p, r))) {
      const a = abs(p, r);
      for (let q = 0; q < 4; q++) {
        if (q === p) continue;
        s.tokens[q].forEach((rq, j) => {
          if (rq >= 0 && rq <= LAST && abs(q, rq) === a) { s.tokens[q][j] = -1; ev.captured.push({ p: q, i: j }); }
        });
      }
    }
    s.avail[use] = false;
    s.last = ev; s.seq++;
    if (checkWin(s, p, ev)) return ev;
    if (!s.avail[0] && !s.avail[1]) endTurn(s, p);
    else if (!choices(s, p).length) endTurn(s, p);          // sobran dados pero ya no hay jugadas
    return ev;
  }

  // Tres pares: fichas que se pueden sacar del juego (primero las que ya están en el tablero)
  function bonusTokens(s, p) {
    const t = s.tokens[p], all = [];
    t.forEach((r, i) => { if (r !== GOAL) all.push(i); });
    const onBoard = all.filter(i => t[i] >= 0);
    return onBoard.length ? onBoard : all;
  }
  function takeOut(s, p, i) {
    const ev = { kind: 'move', p, i, d: 0, captured: [], goal: true, exit: false, bonus: true };
    s.tokens[p][i] = GOAL;
    s.last = ev; s.seq++;
    if (!checkWin(s, p, ev)) endTurn(s, p);
    return ev;
  }

  function pass(s, p) {
    s.last = { kind: 'pass', p, d: 0, captured: [] };
    s.seq++;
    endTurn(s, p);
  }

  // cuántas fichas rivales pueden alcanzar la casilla con los dados (1..12)
  function danger(s, p, r) {
    const a = abs(p, r);
    let n = 0;
    for (let q = 0; q < 4; q++) {
      if (q === p) continue;
      for (const rq of s.tokens[q]) {
        if (rq < 0 || rq > LAST) continue;
        const dist = (abs(q, rq) - a + TRACK) % TRACK;   // cuántas casillas le faltan a la ficha rival para llegar aquí
        if (dist >= 1 && dist <= 12) n++;
      }
    }
    return n;
  }

  // Bots: nivel 1 azar, nivel 2 prioriza capturas/salidas/meta, nivel 3 además evita riesgos. Devuelve { i, use }
  function botChoose(s, p, level) {
    const cands = [];
    choices(s, p).forEach(c => c.moves.forEach(i => cands.push({ i, use: c.use })));
    if (!cands.length) return null;
    if (level <= 1) return cands[Math.floor(Math.random() * cands.length)];
    let best = cands[0], bestScore = -Infinity;
    for (const cd of cands) {
      const c = JSON.parse(JSON.stringify(s));
      const ev = apply(c, p, cd.i, cd.use);
      const r = c.tokens[p][cd.i];
      let score = Math.random() * 3 + ev.captured.length * 100 + r * 0.3;
      if (ev.goal) score += 80;
      if (ev.exit) score += 60;
      if (level >= 3) {
        if (r > LAST) score += 25;
        else if (SAFE.has(abs(p, r))) score += 30;
        else score -= danger(c, p, r) * 20;
        const before = s.tokens[p][cd.i];
        if (before >= 0 && before <= LAST && !SAFE.has(abs(p, before))) score += danger(s, p, before) * 15;
      } else if (r > LAST) score += 10;
      if (score > bestScore) { bestScore = score; best = cd; }
    }
    return best;
  }
  // Tres pares: el bot saca la ficha más adelantada
  function botBonus(s, p) {
    const t = s.tokens[p];
    return bonusTokens(s, p).reduce((b, i) => (t[i] > t[b] ? i : b));
  }

  return { TRACK, STARTS, MOUTHS, SIDE_SAFES, LAST, GOAL, SAFE, abs, newState, legalMoves, values, choices, roll, apply,
           bonusTokens, takeOut, pass, botChoose, botBonus };
})();

if (typeof module !== 'undefined') module.exports = Engine;

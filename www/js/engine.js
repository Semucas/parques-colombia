/* Motor del parqués: lógica pura, sin DOM. Lo usan el modo offline, los bots y el online. */
const Engine = (() => {
  const TRACK = 68;                  // casillas del circuito
  const STARTS = [10, 27, 44, 61];   // casilla de salida de cada jugador (índice absoluto)
  const LAST = 66;                   // última casilla del circuito para cada jugador (posición relativa)
  const GOAL = 74;                   // posición relativa de la meta (67..73 es el pasillo de llegada)
  const SAFE = new Set([...STARTS, ...STARTS.map(s => (s + 8) % TRACK)]);

  const abs = (p, r) => (STARTS[p] + r) % TRACK;

  // r = -1 cárcel, 0..66 circuito, 67..73 pasillo, 74 meta
  function newState(players) {
    return {
      tokens: [0, 1, 2, 3].map(() => [-1, -1, -1, -1]),
      turn: 0, dice: 0, phase: 'roll', sixes: 0, winner: -1, seq: 0,
      players, last: { kind: 'start', captured: [] }
    };
  }

  function legalMoves(s, p, d) {
    const moves = [];
    s.tokens[p].forEach((r, i) => {
      if (r === -1) { if (d === 5) moves.push(i); }
      else if (r < GOAL && r + d <= GOAL) moves.push(i);
    });
    return moves;
  }

  function roll(s, d) {
    s.dice = d; s.phase = 'move';
    s.last = { kind: 'roll', p: s.turn, d, captured: [] };
    s.seq++;
  }

  function finish(s, p, d, ev, bonus) {
    s.sixes = d === 6 ? s.sixes + 1 : 0;
    const extra = (d === 6 || bonus) && s.sixes < 3;   // tres 6 seguidos: se pierde el turno extra
    s.last = ev;
    if (s.tokens[p].every(r => r === GOAL)) { s.winner = p; ev.win = true; }
    else if (!extra) { s.turn = (p + 1) % 4; s.sixes = 0; }
    s.phase = 'roll'; s.dice = 0; s.seq++;
  }

  function apply(s, p, i, d) {
    const t = s.tokens[p];
    const ev = { kind: 'move', p, i, d, captured: [], goal: false, exit: false };
    if (t[i] === -1) { t[i] = 0; ev.exit = true; } else t[i] += d;
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
    finish(s, p, d, ev, ev.captured.length > 0 || ev.goal);
    return ev;
  }

  function pass(s, p, d) {
    const ev = { kind: 'pass', p, d, captured: [] };
    finish(s, p, d, ev, false);
    return ev;
  }

  // cuántas fichas rivales pueden alcanzar la casilla en una tirada (1..6)
  function danger(s, p, r) {
    const a = abs(p, r);
    let n = 0;
    for (let q = 0; q < 4; q++) {
      if (q === p) continue;
      for (const rq of s.tokens[q]) {
        if (rq < 0 || rq > LAST) continue;
        const dist = (a - abs(q, rq) + TRACK) % TRACK;
        if (dist >= 1 && dist <= 6) n++;
      }
    }
    return n;
  }

  // Bots: nivel 1 azar, nivel 2 prioriza capturas/salidas/meta, nivel 3 además evita riesgos
  function botChoose(s, p, d, moves, level) {
    if (level <= 1) return moves[Math.floor(Math.random() * moves.length)];
    let best = moves[0], bestScore = -Infinity;
    for (const i of moves) {
      const c = JSON.parse(JSON.stringify(s));
      const ev = apply(c, p, i, d);
      const r = c.tokens[p][i];
      let score = Math.random() * 3 + ev.captured.length * 100 + r * 0.3;
      if (ev.goal) score += 80;
      if (ev.exit) score += 60;
      if (level >= 3) {
        if (r >= 67) score += 25;
        else if (SAFE.has(abs(p, r))) score += 30;
        else score -= danger(c, p, r) * 35;
        const before = s.tokens[p][i];
        if (before >= 0 && before <= LAST && !SAFE.has(abs(p, before))) score += danger(s, p, before) * 25;
      } else if (r >= 67) score += 10;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  return { TRACK, STARTS, LAST, GOAL, SAFE, abs, newState, legalMoves, roll, apply, pass, botChoose };
})();

if (typeof module !== 'undefined') module.exports = Engine;

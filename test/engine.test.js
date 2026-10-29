// Pruebas del motor: node test/engine.test.js
const assert = require('assert');
const E = require('../www/js/engine.js');

const players = [0, 1, 2, 3].map(i => ({ type: 'bot', name: 'B' + i, level: 3 }));

// 1) Partidas completas bot vs bot: deben terminar y mantener invariantes
for (let level = 1; level <= 3; level++) {
  let wins = [0, 0, 0, 0];
  for (let g = 0; g < 200; g++) {
    const s = E.newState(players.map(p => ({ ...p, level })));
    let steps = 0;
    while (s.winner < 0) {
      if (++steps > 20000) throw new Error('La partida no termina');
      E.roll(s, 1 + Math.floor(Math.random() * 6));
      const p = s.turn, moves = E.legalMoves(s, p, s.dice);
      if (!moves.length) E.pass(s, p, s.dice);
      else E.apply(s, p, E.botChoose(s, p, s.dice, moves, level), s.dice);
      s.tokens.forEach(t => t.forEach(r => assert(r >= -1 && r <= E.GOAL, 'posición inválida ' + r)));
    }
    wins[s.winner]++;
    assert(s.tokens[s.winner].every(r => r === E.GOAL));
  }
  console.log(`nivel ${level}: victorias por jugador`, wins);
}

// 2) Reglas puntuales
let s = E.newState(players);
assert.deepStrictEqual(E.legalMoves(s, 0, 3), [], 'sin 5 no se sale de la cárcel');
assert.deepStrictEqual(E.legalMoves(s, 0, 5), [0, 1, 2, 3], 'con 5 salen fichas');

// captura: la ficha 1 del jugador 1 cae en una casilla común ocupada por el jugador 0
s = E.newState(players);
s.tokens[0][0] = 20;                                  // abs = (10+20)%68 = 30
const target = E.abs(0, 20);
assert(!E.SAFE.has(target));
s.tokens[1][0] = ((target - E.STARTS[1]) % 68 + 68) % 68 - 3; // 3 casillas antes
s.turn = 1; s.dice = 3;
const ev = E.apply(s, 1, 0, 3);
assert.strictEqual(ev.captured.length, 1);
assert.strictEqual(s.tokens[0][0], -1, 'la ficha capturada vuelve a la cárcel');
assert.strictEqual(s.turn, 1, 'capturar da turno extra');

// casilla segura: no hay captura
s = E.newState(players);
s.tokens[0][0] = ((E.STARTS[2] - E.STARTS[0]) % 68 + 68) % 68;  // sobre la salida del jugador 2
s.tokens[2][0] = -1; s.turn = 1; s.tokens[1][0] = ((E.STARTS[2] - E.STARTS[1]) % 68 + 68) % 68 - 2;
const ev2 = E.apply(s, 1, 0, 2);
assert.strictEqual(ev2.captured.length, 0, 'no se captura en casillas seguras');

// meta exacta
s = E.newState(players); s.tokens[0][0] = E.GOAL - 2;
assert.deepStrictEqual(E.legalMoves(s, 0, 3), [], 'no se pasa de la meta');
assert.deepStrictEqual(E.legalMoves(s, 0, 2), [0]);

// la última casilla del circuito es la punta del brazo propio (entrada al pasillo)
E.MOUTHS.forEach((m, p) => assert.strictEqual(E.abs(p, E.LAST), m, 'la punta del brazo de ' + p));

console.log('Todas las pruebas del motor pasaron ✔');

// Pruebas del motor: node test/engine.test.js
const assert = require('assert');
const E = require('../www/js/engine.js');

const players = [0, 1, 2, 3].map(i => ({ type: 'bot', name: 'B' + i, level: 3 }));
const d6 = () => 1 + Math.floor(Math.random() * 6);

// Juega un turno completo de un bot (lanza, mueve con cada dado, o saca ficha con tres pares)
function botTurnStep(s, level) {
  const p = s.turn;
  if (s.phase === 'roll') { E.roll(s, d6(), d6()); return; }
  if (s.phase === 'bonus') { E.takeOut(s, p, E.botBonus(s, p)); return; }
  const c = E.botChoose(s, p, level);
  if (!c) E.pass(s, p); else E.apply(s, p, c.i, c.use);
}

// 1) Partidas completas bot vs bot con 1 a 4 fichas: deben terminar y mantener invariantes
for (const n of [1, 2, 3, 4]) {
  for (let level = 1; level <= 3; level++) {
    const wins = [0, 0, 0, 0];
    for (let g = 0; g < 60; g++) {
      const s = E.newState(players.map(p => ({ ...p, level })), n);
      let steps = 0;
      while (s.winner < 0) {
        if (++steps > 40000) throw new Error('La partida no termina (n=' + n + ')');
        botTurnStep(s, level);
        s.tokens.forEach(t => { assert.strictEqual(t.length, n); t.forEach(r => assert(r >= -1 && r <= E.GOAL, 'posición inválida ' + r)); });
      }
      wins[s.winner]++;
      assert(s.tokens[s.winner].every(r => r === E.GOAL));
    }
    if (n === 4 || level === 3) console.log(`fichas ${n}, nivel ${level}: victorias`, wins);
  }
}

// 2) Reglas puntuales
let s = E.newState(players);
s.dice = [3, 4]; s.avail = [true, true];
assert.deepStrictEqual(E.choices(s, 0), [], 'sin un 5 en un dado no se sale de la cárcel');
s.dice = [5, 2]; s.avail = [true, true];
assert.deepStrictEqual(E.choices(s, 0).map(c => c.use), [0], 'el 5 de un dado saca ficha');
s.dice = [1, 4]; s.avail = [true, true];
assert.deepStrictEqual(E.choices(s, 0), [], 'los dados no se suman: 1 + 4 no saca ficha');

// cada dado se usa por separado y consume solo ese dado
s = E.newState(players);
s.tokens[0][0] = 10; s.tokens[0][1] = 20;
E.roll(s, 2, 3);
assert.strictEqual(s.phase, 'move');
assert.deepStrictEqual(E.values(s).map(o => o.v), [2, 3], 'sin opción de suma');
E.apply(s, 0, 0, 0);                                    // usa el dado 1 (2) con la ficha 0
assert.strictEqual(s.tokens[0][0], 12);
assert.deepStrictEqual(E.values(s).map(o => o.v), [3], 'queda solo el otro dado');
assert.strictEqual(s.turn, 0);
E.apply(s, 0, 1, 1);                                    // usa el dado 2 (3) con la ficha 1
assert.strictEqual(s.tokens[0][1], 23);
assert.strictEqual(s.turn, 1, 'sin par, el turno pasa al siguiente');

// repetir turno SOLO con par (capturar o llegar a la meta no lo repiten)
s = E.newState(players);
s.tokens[0][0] = 20;
const target = E.abs(0, 20);
assert(!E.SAFE.has(target));
s.tokens[1][0] = (((E.STARTS[1] - (target + 3)) % 68) + 68) % 68;   // 3 casillas antes del objetivo, en su sentido de avance
s.turn = 1; E.roll(s, 3, 2); s.dbl = false;
const ev = E.apply(s, 1, 0, 0);
assert.strictEqual(ev.captured.length, 1, 'captura');
assert.strictEqual(s.tokens[0][0], -1, 'la ficha capturada vuelve a la cárcel');
E.apply(s, 1, 0, 1);                                    // gasta el otro dado
assert.strictEqual(s.turn, 2, 'capturar no da turno extra');

s = E.newState(players);
s.tokens[0][0] = 30; E.roll(s, 2, 2);
E.apply(s, 0, 0, 0); E.apply(s, 0, 0, 1);
assert.strictEqual(s.turn, 0, 'con par se repite el turno');
assert.strictEqual(s.phase, 'roll');

// tres pares seguidos: se saca una ficha del juego y el turno pasa
s = E.newState(players);
s.tokens[0] = [10, -1, -1, -1];
E.roll(s, 1, 1); E.apply(s, 0, 0, 0); E.apply(s, 0, 0, 1);
E.roll(s, 2, 2); E.apply(s, 0, 0, 0); E.apply(s, 0, 0, 1);
E.roll(s, 3, 3);
assert.strictEqual(s.phase, 'bonus', 'tres pares activan la ficha extra');
assert.deepStrictEqual(E.bonusTokens(s, 0), [0], 'primero las fichas del tablero');
E.takeOut(s, 0, 0);
assert.strictEqual(s.tokens[0][0], E.GOAL, 'la ficha queda como si hubiera llegado');
assert.strictEqual(s.turn, 1);
assert.strictEqual(s.dbls, 0);

// casilla segura: no hay captura
s = E.newState(players);
s.tokens[0][0] = (((E.STARTS[0] - E.STARTS[2]) % 68) + 68) % 68;
s.turn = 1; s.tokens[1][0] = (((E.STARTS[1] - (E.STARTS[2] + 2)) % 68) + 68) % 68;
s.dice = [2, 6]; s.avail = [true, true];
const ev2 = E.apply(s, 1, 0, 0);
assert.strictEqual(ev2.captured.length, 0, 'no se captura en casillas seguras');

// meta exacta
s = E.newState(players); s.tokens[0][0] = E.GOAL - 2;
assert.deepStrictEqual(E.legalMoves(s, 0, 3), [], 'no se pasa de la meta');
assert.deepStrictEqual(E.legalMoves(s, 0, 2), [0]);

// la última casilla del circuito es la punta del brazo propio (entrada al pasillo)
E.MOUTHS.forEach((m, p) => assert.strictEqual(E.abs(p, E.LAST), m, 'la punta del brazo de ' + p));

console.log('Todas las pruebas del motor pasaron ✔');

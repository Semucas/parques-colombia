// Pruebas del motor: node test/engine.test.js
const assert = require('assert');
const E = require('../www/js/engine.js');

const players = [0, 1, 2, 3].map(i => ({ type: 'bot', name: 'B' + i, level: 3 }));
const d6 = () => 1 + Math.floor(Math.random() * 6);

// Juega un paso de un bot: lanza, mueve con cada dado, saca fichas con par, o saca una ficha con tres pares
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
        if (++steps > 60000) throw new Error('La partida no termina (n=' + n + ')');
        botTurnStep(s, level);
        s.tokens.forEach(t => { assert.strictEqual(t.length, n); t.forEach(r => assert(r >= -1 && r <= E.GOAL, 'posición inválida ' + r)); });
      }
      wins[s.winner]++;
      assert(s.tokens[s.winner].every(r => r === E.GOAL));
    }
    if (n === 4 || level === 3) console.log(`fichas ${n}, nivel ${level}: victorias`, wins);
  }
}

// 1b) Partidas con puestos libres (online sin bots): el turno salta a los que no juegan y la partida termina
for (const active of [[0, 2], [1, 2, 3], [0, 1, 3], [3, 0]]) {
  for (const n of [1, 4]) {
    for (let g = 0; g < 30; g++) {
      const ps = players.map((pl, i) => (active.includes(i) ? pl : { type: 'none', name: 'Libre' }));
      const s = E.newState(ps, n);
      assert(active.includes(s.turn), 'empieza un jugador activo');
      let steps = 0;
      while (s.winner < 0) {
        if (++steps > 60000) throw new Error('La partida con puestos libres no termina');
        botTurnStep(s, 2);
        assert(active.includes(s.turn), 'el turno nunca cae en un puesto libre');
        assert(active.includes(s.winner) || s.winner < 0, 'solo gana quien juega');
      }
    }
  }
}
// un jugador que sale: el turno sigue; si solo queda uno, gana
{
  const s = E.newState(players.map(pl => ({ ...pl })), 2);   // copias: removePlayer modifica a los jugadores
  s.turn = 1;
  E.removePlayer(s, 1);
  assert.strictEqual(s.players[1].type, 'none');
  assert.strictEqual(s.turn, 2, 'si salía el del turno, sigue el siguiente');
  assert.strictEqual(s.winner, -1);
  E.removePlayer(s, 3); E.removePlayer(s, 0);
  assert.strictEqual(s.winner, 2, 'el único que queda gana');
}

// 2) Salir de la cárcel: solo con par
let s = E.newState(players);
E.roll(s, 5, 4);
assert.deepStrictEqual(E.choices(s, 0), [], 'sin par no se sale de la cárcel (ni con un 5)');
E.roll(s, 1, 4);
assert.deepStrictEqual(E.choices(s, 0), [], 'un 1 y un 4 tampoco');

// cualquier par (2-2 a 5-5): salen 2 fichas, a la SALIDA, y el turno se repite
for (const d of [2, 3, 4, 5]) {
  s = E.newState(players);
  E.roll(s, d, d);
  const ch = E.choices(s, 0);
  assert.deepStrictEqual(ch.map(c => c.use), [2], 'con el par ' + d + '-' + d + ' hay que sacar fichas');
  E.apply(s, 0, 0, 2);
  assert.strictEqual(s.tokens[0].filter(r => r === 0).length, 2, 'salen 2 fichas con ' + d + '-' + d);
  assert.strictEqual(s.tokens[0].filter(r => r === -1).length, 2, 'las otras 2 siguen en la cárcel');
  assert.strictEqual(s.turn, 0, 'el par repite el turno');
  assert.strictEqual(s.phase, 'roll');
}
// 1-1 y 6-6: salen todas
for (const d of [1, 6]) {
  s = E.newState(players);
  E.roll(s, d, d);
  E.apply(s, 0, 0, 2);
  assert(s.tokens[0].every(r => r === 0), 'con ' + d + '-' + d + ' salen las 4 fichas');
  assert.strictEqual(E.abs(0, 0), E.STARTS[0]);
}
// con pocas fichas salen las que haya
s = E.newState(players, 3); E.roll(s, 3, 3); E.apply(s, 0, 0, 2);
assert.strictEqual(s.tokens[0].filter(r => r === 0).length, 2);
s = E.newState(players, 1); E.roll(s, 4, 4); E.apply(s, 0, 0, 2);
assert.deepStrictEqual(s.tokens[0], [0], 'con 1 ficha sale esa ficha');

// el par con fichas en el tablero: se puede sacar o mover con los dados
s = E.newState(players); s.tokens[0] = [10, -1, -1, -1];
E.roll(s, 2, 2);
assert.deepStrictEqual(E.choices(s, 0).map(c => c.use), [0, 1, 2], 'dado 1, dado 2 o sacar fichas');

// 3) Tres intentos para sacar un par cuando no hay fichas en juego
s = E.newState(players);
assert.strictEqual(s.tries, 3);
E.roll(s, 1, 2); E.pass(s, 0);
assert.strictEqual(s.turn, 0, '1.er intento fallido: sigue el mismo jugador');
assert.strictEqual(s.phase, 'roll'); assert.strictEqual(s.tries, 2);
E.roll(s, 3, 6); E.pass(s, 0);
assert.strictEqual(s.turn, 0, '2.º intento fallido: sigue el mismo jugador'); assert.strictEqual(s.tries, 1);
E.roll(s, 4, 5); E.pass(s, 0);
assert.strictEqual(s.turn, 1, 'tras 3 intentos pasa el turno');
assert.strictEqual(s.tries, 3, 'el siguiente jugador tampoco tiene fichas: 3 intentos');
// con una ficha en el tablero no hay intentos extra
s = E.newState(players); s.tokens[0] = [10, -1, -1, -1]; s.tries = 0;
E.roll(s, 1, 2); s.avail = [false, false]; E.pass(s, 0);
assert.strictEqual(s.turn, 1, 'con fichas en el tablero el turno pasa normal');

// 4) Dados por separado
s = E.newState(players);
s.tokens[0][0] = 10; s.tokens[0][1] = 20;
E.roll(s, 2, 3);
assert.strictEqual(s.phase, 'move');
assert.deepStrictEqual(E.values(s).map(o => o.v), [2, 3], 'sin opción de suma');
E.apply(s, 0, 0, 0);
assert.strictEqual(s.tokens[0][0], 12);
assert.deepStrictEqual(E.values(s).map(o => o.v), [3], 'queda solo el otro dado');
assert.strictEqual(s.turn, 0);
E.apply(s, 0, 1, 1);
assert.strictEqual(s.tokens[0][1], 23);
assert.strictEqual(s.turn, 1, 'sin par, el turno pasa al siguiente');

// 5) Repetir turno SOLO con par (capturar o llegar a la meta no lo repiten)
s = E.newState(players);
s.tokens[0][0] = 20;
const target = E.abs(0, 20);
assert(!E.SAFE.has(target));
s.tokens[1][0] = (((E.STARTS[1] - (target + 3)) % 68) + 68) % 68;   // 3 casillas antes del objetivo, en su sentido de avance
s.turn = 1; E.roll(s, 3, 2);
const ev = E.apply(s, 1, 0, 0);
assert.strictEqual(ev.captured.length, 1, 'captura');
assert.strictEqual(s.tokens[0][0], -1, 'la ficha capturada vuelve a la cárcel');
E.apply(s, 1, 0, 1);
assert.strictEqual(s.turn, 2, 'capturar no da turno extra');

s = E.newState(players);
s.tokens[0][0] = 30; E.roll(s, 2, 2);
E.apply(s, 0, 0, 0); E.apply(s, 0, 0, 1);
assert.strictEqual(s.turn, 0, 'con par se repite el turno');
assert.strictEqual(s.phase, 'roll');

// 6) Tres pares seguidos: se saca una ficha del juego y el turno pasa
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

// 7) Casillas seguras y meta
s = E.newState(players);
s.tokens[0][0] = (((E.STARTS[0] - E.STARTS[2]) % 68) + 68) % 68;
s.turn = 1; s.tokens[1][0] = (((E.STARTS[1] - (E.STARTS[2] + 2)) % 68) + 68) % 68;
s.dice = [2, 6]; s.avail = [true, true];
const ev2 = E.apply(s, 1, 0, 0);
assert.strictEqual(ev2.captured.length, 0, 'no se captura en casillas seguras');

s = E.newState(players); s.tokens[0][0] = E.GOAL - 2;
assert.deepStrictEqual(E.legalMoves(s, 0, 3), [], 'no se pasa de la meta');
assert.deepStrictEqual(E.legalMoves(s, 0, 2), [0]);

// la última casilla del circuito es la punta del brazo propio (entrada al pasillo)
E.MOUTHS.forEach((m, p) => assert.strictEqual(E.abs(p, E.LAST), m, 'la punta del brazo de ' + p));

console.log('Todas las pruebas del motor pasaron ✔');

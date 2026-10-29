/* Modo online con Firebase Realtime Database.
   Estructura: rooms/{CODIGO} = { host, started, seats: {s0..s3: {uid,name}}, state: {...estado del juego...} }
   Cada jugador escribe el estado completo cuando le toca jugar; el anfitrión mueve los bots. */
const Online = (() => {
  let db = null, roomRef = null, handler = null, code = null;

  let uid;
  try { uid = localStorage.getItem('parques_uid'); } catch (e) { /* sin storage */ }
  if (!uid) {
    uid = 'u' + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem('parques_uid', uid); } catch (e) { /* sin storage */ }
  }

  const ready = () => !!(window.firebase && typeof FIREBASE_CONFIG !== 'undefined' &&
    FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('TU_'));

  function init() {
    if (db) return;
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.database();
  }

  const randCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

  async function create(name, emoji) {
    init();
    for (let tries = 0; tries < 5; tries++) {
      const c = randCode();
      const ref = db.ref('rooms/' + c);
      if ((await ref.once('value')).exists()) continue;
      await ref.set({ host: uid, created: Date.now(), started: false, seats: { s0: { uid, name, emoji } } });
      ref.child('seats/s0').onDisconnect().remove();
      code = c; roomRef = ref;
      return c;
    }
    throw new Error('No se pudo crear la sala, intenta de nuevo.');
  }

  async function join(c, name, emoji) {
    init();
    c = c.trim().toUpperCase();
    const ref = db.ref('rooms/' + c);
    const snap = await ref.once('value');
    if (!snap.exists()) throw new Error('Esa sala no existe.');
    if (snap.val().started) throw new Error('Esa partida ya empezó.');
    const res = await ref.child('seats').transaction(cur => {
      cur = cur || {};
      if (Object.values(cur).some(s => s.uid === uid)) return cur;
      for (let i = 0; i < 4; i++) if (!cur['s' + i]) { cur['s' + i] = { uid, name, emoji }; return cur; }
      return undefined;
    });
    if (!res.committed) throw new Error('La sala está llena.');
    const seat = Object.keys(res.snapshot.val()).find(k => res.snapshot.val()[k].uid === uid);
    ref.child('seats/' + seat).onDisconnect().remove();
    code = c; roomRef = ref;
    return c;
  }

  // cb recibe el valor completo de la sala cada vez que cambia (null si se borró)
  function listen(cb) {
    if (handler) roomRef.off('value', handler);
    handler = roomRef.on('value', snap => cb(snap.val()));
  }

  const seatOf = room => {
    const k = room && room.seats && Object.keys(room.seats).find(k => room.seats[k].uid === uid);
    return k ? Number(k.slice(1)) : -1;
  };

  async function startGame(state) {
    await roomRef.update({ started: true, state });
  }

  function push(state) { if (roomRef) roomRef.child('state').set(state); }

  async function leave(isHost) {
    if (!roomRef) return;
    try {
      if (handler) roomRef.off('value', handler);
      if (isHost) await roomRef.remove();
    } catch (e) { /* sin conexión: se ignora */ }
    roomRef = null; handler = null; code = null;
  }

  return { uid, ready, create, join, listen, seatOf, startGame, push, leave, get code() { return code; } };
})();

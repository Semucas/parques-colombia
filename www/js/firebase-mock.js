/* Base de datos simulada para PROBAR el modo online sin Firebase.
   Solo se activa con ?mock en la dirección (por ejemplo http://localhost:5173/index.html?mock).
   Imita lo mínimo de Firebase Realtime Database y comparte los datos entre pestañas del mismo navegador,
   así se puede jugar "online" abriendo dos pestañas. En la app real no hace nada. */
(function () {
  if (!/[?&]mock\b/.test(location.search)) return;
  window.FIREBASE_MOCK = true;
  if (typeof FIREBASE_CONFIG !== 'undefined') FIREBASE_CONFIG.apiKey = 'mock';

  const KEY = 'mockdb';
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mockdb') : null;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const write = t => localStorage.setItem(KEY, JSON.stringify(t));
  const clone = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const keys = path => path.split('/').filter(Boolean);
  const getPath = (t, path) => keys(path).reduce((o, k) => (o == null ? undefined : o[k]), t);
  function setPath(t, path, val) {
    const ks = keys(path);
    let o = t;
    ks.slice(0, -1).forEach(k => { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; });
    const last = ks[ks.length - 1];
    if (val === null || val === undefined) delete o[last]; else o[last] = clone(val);
  }
  const snap = v => ({ val: () => clone(v), exists: () => v !== undefined && v !== null });

  const listeners = [];
  const notify = () => {
    const t = read();
    listeners.slice().forEach(l => setTimeout(() => l.cb(snap(getPath(t, l.path))), 0));
  };
  const emit = () => { if (bc) bc.postMessage(1); notify(); };
  if (bc) bc.onmessage = notify;

  const disconnects = new Map();   // ruta -> acción al cerrar la pestaña
  window.addEventListener('beforeunload', () => {
    const t = read();
    disconnects.forEach((_, path) => setPath(t, path, null));
    if (disconnects.size) { write(t); if (bc) bc.postMessage(1); }
  });

  function ref(path) {
    return {
      child: p => ref(path + '/' + p),
      once: async () => snap(getPath(read(), path)),
      set: async v => { const t = read(); setPath(t, path, v); write(t); emit(); },
      update: async obj => { const t = read(); Object.keys(obj).forEach(k => setPath(t, path + '/' + k, obj[k])); write(t); emit(); },
      remove: async () => { const t = read(); setPath(t, path, null); write(t); emit(); },
      on: (ev, cb) => { listeners.push({ path, cb }); setTimeout(() => cb(snap(getPath(read(), path))), 0); return cb; },
      off: (ev, cb) => { const i = listeners.findIndex(l => l.path === path && (!cb || l.cb === cb)); if (i >= 0) listeners.splice(i, 1); },
      transaction: async fn => {
        const t = read();
        const cur = clone(getPath(t, path));
        const res = fn(cur);
        if (res === undefined) return { committed: false, snapshot: snap(cur) };
        setPath(t, path, res); write(t); emit();
        return { committed: true, snapshot: snap(res) };
      },
      onDisconnect: () => ({
        remove: async () => { disconnects.set(path, true); },
        cancel: async () => { disconnects.delete(path); }
      })
    };
  }
  window.firebase = { initializeApp() {}, database: () => ({ ref }) };

  // Aviso visible: en este modo las salas NO existen en Firebase, solo en este navegador
  window.addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.textContent = 'MODO DE PRUEBA: las salas no son de Firebase';
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#CE1126;color:#fff;font:700 12px sans-serif;text-align:center;padding:4px;pointer-events:none';
    document.body.appendChild(b);
  });
})();

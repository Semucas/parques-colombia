/* Persistencia en localStorage: nombre, ajustes, progreso de niveles, puntajes y easter eggs. */
const Store = (() => {
  const KEY = 'parques_parce_v2';
  const DEFAULTS = {
    name: '', region: 0, tokens: 4, sound: true, music: true,
    unlocked: 1, scores: [], stats: { games: 0, wins: 0, captures: 0 }, eggs: {}
  };
  let d;
  try { d = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (e) { d = Object.assign({}, DEFAULTS); }

  const api = {
    d,
    save() { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* almacenamiento no disponible */ } },
    addScore(entry) {
      d.scores.push(entry);
      d.scores.sort((a, b) => b.pts - a.pts);
      d.scores = d.scores.slice(0, 10);
      d.stats.games++;
      if (entry.won) d.stats.wins++;
      d.stats.captures += entry.captures || 0;
      this.save();
    },
    unlock(level) { if (level > d.unlocked) { d.unlocked = Math.min(level, 3); this.save(); } }
  };
  Object.defineProperty(api, 'd', { get: () => d });
  return api;
})();

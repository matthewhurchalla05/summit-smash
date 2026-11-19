// Shared between server (require) and browser (<script>).
// Edit `leader` names here if a country's leader changes.
(function (root) {
  const CHARACTERS = [
    { id: 'usa',     country: 'United States', leader: 'Donald Trump' },
    { id: 'uk',      country: 'United Kingdom', leader: 'Keir Starmer' },
    { id: 'france',  country: 'France',         leader: 'Emmanuel Macron' },
    { id: 'germany', country: 'Germany',        leader: 'Friedrich Merz' },
    { id: 'israel',  country: 'Israel',         leader: 'Benjamin Netanyahu' },
    { id: 'china',   country: 'China',          leader: 'Xi Jinping' },
    { id: 'russia',  country: 'Russia',         leader: 'Vladimir Putin' },
    { id: 'japan',   country: 'Japan',          leader: 'Sanae Takaichi' },
    { id: 'poland',  country: 'Poland',         leader: 'Donald Tusk' },
    { id: 'czechia', country: 'Czechia',        leader: 'Andrej Babiš' },
    { id: 'horse',   country: 'The Stable',     leader: 'The Horse' },
  ];

  // Hats unlock with account level.
  const HATS = [
    { id: 'none',    name: 'No hat',        level: 1 },
    { id: 'party',   name: 'Party Hat',     level: 2 },
    { id: 'tophat',  name: 'Top Hat',       level: 3 },
    { id: 'cowboy',  name: 'Cowboy Hat',    level: 5 },
    { id: 'viking',  name: 'Viking Helmet', level: 7 },
    { id: 'chef',    name: 'Chef Hat',      level: 9 },
    { id: 'crown',   name: 'Crown',         level: 12 },
    { id: 'halo',    name: 'Halo',          level: 15 },
  ];

  // XP needed to go from level L to L+1.
  function xpForLevel(level) { return 100 + (level - 1) * 50; }
  function levelFromXp(xp) {
    let level = 1, need = xpForLevel(1), rem = xp;
    while (rem >= need) { rem -= need; level++; need = xpForLevel(level); }
    return { level, into: rem, need };
  }

  const api = { CHARACTERS, HATS, xpForLevel, levelFromXp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shared = api;
})(this);

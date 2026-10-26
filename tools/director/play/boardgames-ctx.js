// The parts of a board game's `ctx` (Content/Studio/BoardGames/README.md) that are the same in Play and in the BOARD
// test: the dice of chance, seeded so the same seed plays the same game.
export function rng(seed) {                          // mulberry32: 0..1
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function helpers(random) {
  return {
    random,
    int: n => Math.floor(random() * n),              // 0 .. n-1
    shuffle: list => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  };
}

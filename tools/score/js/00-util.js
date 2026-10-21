// Small helpers shared by every file: numbers, a seeded random source, shuffle bags.
"use strict";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const dbToGain = db => Math.pow(10, db / 20);
const gainToDb = g => 20 * Math.log10(Math.max(g, 1e-9));
const mod = (n, m) => ((n % m) + m) % m;
const sum = arr => arr.reduce((a, b) => a + b, 0);
const uniq = arr => [...new Set(arr)];
const range = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);

// A seeded random source (mulberry32): the same seed plays the same music, so a phrase heard once can be found again.
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    seed,
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: p => next() < p,
    pick: arr => arr[Math.floor(next() * arr.length)],
    // gauss: a normal draw (Box-Muller), for timing and velocity humanising
    gauss: (mean = 0, sd = 1) => mean + sd * Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next()),
    // weighted: [[value, weight], ...] or {value: weight}
    weighted(items) {
      const list = Array.isArray(items) ? items : Object.entries(items);
      const total = sum(list.map(([, w]) => Math.max(0, w)));
      if (total <= 0) return list.length ? list[0][0] : undefined;
      let r = next() * total;
      for (const [v, w] of list) { r -= Math.max(0, w); if (r <= 0) return v; }
      return list[list.length - 1][0];
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
    fork: salt => makeRng((Math.floor(next() * 4294967296) ^ (salt || 0)) >>> 0),
  };
  return rng;
}

// A shuffle bag: every item once in a random order, never the same one twice running (the game's SoundBank rule).
function makeBag(items, rng) {
  let bag = [], last;
  return () => {
    if (!items.length) return undefined;
    if (!bag.length) {
      bag = rng.shuffle(items);
      if (bag.length > 1 && bag[0] === last) bag.push(bag.shift());
    }
    last = bag.shift();
    return last;
  };
}

// Recent-history guard: picks by weight but avoids what was chosen in the last `memory` picks when it can.
function makeNoRepeat(rng, memory = 2) {
  const recent = [];
  return weights => {
    const list = (Array.isArray(weights) ? weights : Object.entries(weights)).filter(([, w]) => w > 0);
    const fresh = list.filter(([v]) => !recent.includes(v));
    const v = rng.weighted(fresh.length ? fresh : list);
    recent.push(v);
    while (recent.length > memory) recent.shift();
    return v;
  };
}

const fmtTime = s => { s = Math.max(0, s); const m = Math.floor(s / 60); return m + ":" + String(Math.floor(s % 60)).padStart(2, "0"); };

// The score kit: what every cue is written with. A cue's generator gets a Take (a list of note events it fills) and
// its parameters, and uses only the take's seeded random source, so the same cue, parameters and seed always write
// the same notes (a favourite can be made again anywhere: the desk, the game's bake).
"use strict";

// Where each instrument sounds good (woohill's REGISTERS: the section strings thud under C3 and click over C6).
const REG = {
  piano: [21, 108], harp: [31, 96], pizz: [43, 84], strings: [40, 86], trem: [43, 86],
  flute: [60, 96], flute_stac: [69, 96], horn: [38, 77], timpani: [36, 57],
  glock: [79, 103], marimba: [45, 93], xylo: [67, 103], bells: [60, 77], guitar: [40, 80], steel: [40, 82],
};
const fitReg = (inst, m) => { const r = REG[inst]; if (!r) return m; while (m < r[0]) m += 12; while (m > r[1]) m -= 12; return m; };

// ---- keys: a tonic pitch class (0 = C) and a mode; degrees count from 0 (the tonic), across octaves ----
const deg = (key, d, base = 60) => { const iv = MODES[key.mode] || MODES.ionian, n = iv.length; return base + key.tonic + iv[mod(d, n)] + 12 * Math.floor(d / n); };
const triad = (key, d, base = 60, n = 3) => range(0, n).map(k => deg(key, d + 2 * k, base));
const keyName = key => pcName(key.tonic) + " " + key.mode.replace(/_/g, " ");
// a progression by degree (0-based): I–V–vi–IV is [0, 4, 5, 3]
const PROGS = {
  pop: [0, 4, 5, 3], royal_road: [3, 4, 2, 5], canon: [0, 4, 5, 2, 3, 0, 3, 4], doo_wop: [0, 5, 3, 4],
  ballad_minor: [0, 5, 2, 6], sad_pop: [5, 3, 0, 4], lament: [0, 6, 5, 4], waltz: [0, 5, 3, 4],
};

// ---- a take: the notes a cue writes, in seconds from its start ----
class Take {
  constructor(rng, p) { this.rng = rng; this.p = p; this.ev = []; this.marks = []; this.hits = []; this.tempo = 90; this.meter = [4, 4]; this.secs = 0; this.key = null; }
  // a note: instrument, MIDI note, start (s), length (s; null rings out), velocity; o: cents, bend, attack, pan, db, raw (no register fit)
  n(inst, midi, t, dur, vel, o = {}) {
    if (t < 0 || !isFinite(t) || !isFinite(midi)) return;
    const m = o.raw ? midi : fitReg(inst, Math.round(midi));
    const e = Object.assign({ inst, midi: m, t, dur, vel: clamp(Math.round(vel), 1, 127) }, o);
    delete e.raw;
    this.ev.push(e);
    this.secs = Math.max(this.secs, t + (dur || 1.5));
    return e;
  }
  // a drum piece (the kit: bass_drum, timp_roll, crash, triangle, tamb, snare, log_lo, anvil...)
  hit(piece, t, vel, o = {}) { if (t < 0) return; this.ev.push(Object.assign({ inst: "drums", piece, t, vel: clamp(Math.round(vel), 1, 127), dur: 0.5 }, o)); this.secs = Math.max(this.secs, t + 1); }
  // several notes at once, rolled upward by `roll` seconds a note, each nudged a few ms (human hands)
  chord(inst, notes, t, dur, vel, o = {}) { const roll = o.roll || 0; notes.forEach((m, i) => this.n(inst, m, t + i * roll + this.human(), dur, vel - (o.taper || 0) * i, Object.assign({}, o, { roll: undefined, taper: undefined }))); }
  human(sd = 0.006) { return this.rng.gauss(0, sd); }
  vel(v, sd = 5) { return clamp(Math.round(this.rng.gauss(v, sd)), 1, 127); }
  mark(t, text) { this.marks.push({ t, text }); }
  // a hit point: where the picture's action lands (a fall's thud, the shock's sting): the desk will line it up with the clip
  point(t, label) { this.hits.push({ t, label }); this.mark(t, "hit: " + label); }
  beat(tempo, meter) { this.tempo = tempo; this.meter = meter || [4, 4]; return 60 / tempo; }
  end(secs) { this.secs = Math.max(secs, 0.5); }
}

// ---- the cue registry ----
// def: {family, label, uses: [tags], desc, refs, params: {name: {kind: "num"|"choice"|"key", ...}}, gen(t, p)}
const CUES = {};
const FAMILIES = { horror: "Horror", kdrama: "K-drama", crossover: "Romance horror" };
function CUE(id, def) { def.id = id; CUES[id] = def; return def; }
// shared parameter shapes
const P = {
  key: (tonic = 9, mode = "aeolian", modes) => ({ kind: "key", def: { tonic, mode }, modes: modes || [mode] }),
  len: (def, min, max) => ({ kind: "num", def, min, max, step: 0.5, label: "length (s)" }),
  tempo: (def, min, max) => ({ kind: "num", def, min, max, step: 1, label: "tempo (bpm)" }),
  amt: (label, def = 0.5) => ({ kind: "num", def, min: 0, max: 1, step: 0.05, label }),
  pick: (label, opts, def) => ({ kind: "choice", opts, def: def ?? opts[0], label }),
};

// The parameters a cue plays with: its defaults, overridden by what's given.
function cueParams(cue, given = {}) {
  const out = {};
  for (const [k, sp] of Object.entries(cue.params || {})) out[k] = given[k] !== undefined ? given[k] : JSON.parse(JSON.stringify(sp.def));
  return out;
}

// Writes a cue: the same cue, parameters and seed give the same notes.
function writeCue(cueId, params, seed) {
  const cue = CUES[cueId];
  if (!cue) throw new Error("no cue " + cueId);
  const p = cueParams(cue, params);
  const t = new Take(makeRng(seed), p);
  t.key = p.key ? { tonic: p.key.tonic, mode: p.key.mode } : null;
  cue.gen(t, p);
  t.ev.sort((a, b) => a.t - b.t);
  t.secs = Math.max(t.secs, ...t.ev.map(e => e.t + 0.2));
  if (p.len) t.secs = Math.min(t.secs, p.len + 4);       // a ringing tail past the length, never much more
  return { cue: cueId, params: p, seed, secs: t.secs, tempo: t.tempo, meter: t.meter, key: t.key, ev: t.ev, marks: t.marks, hits: t.hits };
}

// Variations around a set of parameters: a fresh seed each, numbers moved by up to `spread` of their range, choices
// and modes changed now and then (spread 1: anything in range).
function variations(cueId, base, n, spread, seed0) {
  const cue = CUES[cueId], rng = makeRng(seed0 >>> 0), out = [];
  for (let i = 0; i < n; i++) {
    const p = cueParams(cue, base);
    for (const [k, sp] of Object.entries(cue.params || {})) {
      if (sp.fixed) continue;
      if (sp.kind === "num") { const span = (sp.max - sp.min) * spread; p[k] = clamp(Math.round((p[k] + rng.range(-span, span)) / sp.step) * sp.step, sp.min, sp.max); }
      else if (sp.kind === "choice" && rng.chance(spread * 0.6)) p[k] = rng.pick(sp.opts);
      else if (sp.kind === "key") {
        if (rng.chance(spread * 0.7)) p[k] = { tonic: mod(p[k].tonic + rng.pick([-5, -3, -2, 2, 3, 5, 7]), 12), mode: p[k].mode };
        if (sp.modes.length > 1 && rng.chance(spread * 0.4)) p[k] = { tonic: p[k].tonic, mode: rng.pick(sp.modes) };
      }
    }
    out.push({ params: p, seed: Math.floor(rng.next() * 1e9) });
  }
  return out;
}

// The instruments a take uses (what to load before playing it).
const takeInstruments = take => uniq(take.ev.map(e => e.inst));

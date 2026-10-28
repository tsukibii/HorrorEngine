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
  // a drum piece (the kit: bass_drum, timp_roll, crash, triangle, tamb, snare, log_lo, anvil...); o.kit plays another
  // kit's piece (the eerie "metals": brake_bow, gong_scrape, flexatone...)
  hit(piece, t, vel, o = {}) { if (t < 0) return; const { kit, ...rest } = o; this.ev.push(Object.assign({ inst: kit || "drums", piece, t, vel: clamp(Math.round(vel), 1, 127), dur: 0.5 }, rest)); this.secs = Math.max(this.secs, t + 1); }
  // several notes at once, rolled upward by `roll` seconds a note, each nudged a few ms (human hands)
  chord(inst, notes, t, dur, vel, o = {}) { const roll = o.roll || 0; notes.forEach((m, i) => this.n(inst, m, t + i * roll + this.human(), dur, vel - (o.taper || 0) * i, Object.assign({}, o, { roll: undefined, taper: undefined }))); }
  human(sd = 0.006) { return this.rng.gauss(0, sd); }
  vel(v, sd = 5) { return clamp(Math.round(this.rng.gauss(v, sd)), 1, 127); }
  // a tape stop: everything sounding at t sags and dies over dur (the engine does it to the voices). Notes already
  // written that start after t are dropped; notes the cue writes after this call play (what comes after the stop).
  tapeStop(t, dur = 0.25) {
    this.ev = this.ev.filter(e => e.t < t);
    this.ev.push({ inst: "fx", fx: "tapestop", t, dur, vel: 1 }); this.mark(t, "tape stop");
  }
  mark(t, text) { this.marks.push({ t, text }); }
  // a hit point: where the picture's action lands (a fall's thud, the shock's sting): the desk will line it up with the clip
  point(t, label) { this.hits.push({ t, label }); this.mark(t, "hit: " + label); }
  beat(tempo, meter) { this.tempo = tempo; this.meter = meter || [4, 4]; return 60 / tempo; }
  end(secs) { this.secs = Math.max(secs, 0.5); }
}

// ---- the game's theme: one tune the cues can quote ----
// A K-drama keeps one theme and plays it everywhere (Crash Landing on You's piano theme turning into the orchestra,
// Goblin's song at every big beat: docs/MUSIC_RESEARCH.md §1.4); our romance horror does the same, sweet first and
// corrupted later. A theme is a number: its pitches, bar by bar (8 bars: a phrase ending half-way, on the fifth,
// and one coming home), come from that seed; its rhythm fits the cue's meter, drawn from the same seed, so the tune
// is recognisably the same in her theme's 4/4, the music box's 3/4 and the lullaby's 6/8.
function motifBars(seed) {
  const r = makeRng(Math.imul(seed >>> 0, 2654435761) >>> 0 || 1);
  const count = () => r.weighted([[2, 3], [3, 4], [4, 2]]);
  const walk = (start, n) => {
    const out = [start];
    let d = start, back = 0;
    for (let i = 1; i < n; i++) {
      let step;
      if (back) { step = -back; back = 0; }                          // a leap is answered by a step back
      else if (r.chance(0.25)) { step = r.pick([2, 3, -2, -3, 4]); back = Math.sign(step); }
      else step = r.pick([1, -1, 1, -1, 0]);
      d = clamp(d + step, -2, 8); out.push(d);
    }
    return out;
  };
  const a1 = walk(r.pick([0, 2, 4, 4]), count());
  const a2 = walk(clamp(a1[a1.length - 1] + r.pick([-1, 1, 2]), -2, 8), count());
  const up = r.pick([1, 2]), a3 = a1.map(d => clamp(d + up, -2, 9));
  const half = r.chance(0.6) ? [a3[a3.length - 1] > 4 ? 5 : 3, 4] : [4];
  const a2b = a2.slice(0, -1).concat([clamp(a2[a2.length - 1] + r.pick([-1, -2]), -2, 8)]);
  // the bar before home walks down by step towards the second degree (a scale run into the cadence, no leap)
  const s4 = clamp(a2b[a2b.length - 1] + r.pick([0, 1]), 2, 8), n4 = Math.min(count(), s4), st = Math.max(1, Math.round((s4 - 2) / Math.max(1, n4 - 1)));
  const a4 = range(0, n4).map(i => Math.max(1, s4 - i * Math.min(st, 2)));
  const home = r.chance(0.6) ? [r.pick([1, 2]), 0] : [0];
  return [a1, a2, a3, half, a1, a2b, a4, home];
}
// The theme as notes for a meter (beats a bar: 4, 3, or 2 dotted beats for 6/8): [[degree, beats, bar], ...]
const MOTIF_CELLS = {
  4: { 1: [[4]], 2: [[2, 2], [3, 1], [2, 2]], 3: [[2, 1, 1], [1, 1, 2], [1.5, 0.5, 2]], 4: [[1, 1, 1, 1], [1.5, 0.5, 1, 1]] },
  3: { 1: [[3]], 2: [[2, 1], [2, 1], [1, 2]], 3: [[1, 1, 1], [1.5, 0.5, 1]], 4: [[1, 0.5, 0.5, 1], [0.5, 0.5, 1, 1]] },
  2: { 1: [[2]], 2: [[1, 1]], 3: [[1, 0.5, 0.5], [0.5, 0.5, 1]], 4: [[0.5, 0.5, 0.5, 0.5]] },
};
function motifLine(seed, beats = 4) {
  const r = makeRng((seed * 7 + beats) >>> 0), cells = MOTIF_CELLS[beats] || MOTIF_CELLS[4], out = [];
  motifBars(seed).forEach((bar, b) => {
    const opts = cells[bar.length] || cells[2];
    const cell = (b === 3 || b === 7) ? opts[0] : r.pick(opts);      // the cadences keep the plainest rhythm (a long last note)
    bar.forEach((d, i) => out.push([d, cell[i], b]));
  });
  return out;
}

// ---- the cue registry ----
// def: {family, label, uses: [tags], desc, refs, params: {name: {kind: "num"|"choice"|"key", ...}}, gen(t, p)}
const CUES = {};
const FAMILIES = { horror: "Horror", kdrama: "K-drama", crossover: "Romance horror" };
function CUE(id, def) {
  def.id = id;
  // two knobs every cue has (docs/MUSIC_RESEARCH.md §2.8, 2.9; X2 and X6): corruption bends any cue towards wrong
  // (drifting tuning, dropped notes, a note slipped flat, a tritone drone under it, the tempo sagging), and "she's
  // watching" lays a barely heard high tremolo cluster under it (a comedy scene she is secretly watching). Variations
  // leave them where they are set.
  def.params = Object.assign({}, def.params, {
    // how loud the cue sits against the others (dB at the master, after the limiter): a dread bed far under a sting
    // (docs/MUSIC_RESEARCH.md §5.2: leave the scare its headroom)
    gain: { kind: "num", def: def.level ?? -6, min: -24, max: 6, step: 1, label: "level (dB)", fixed: true, shared: true },
    corrupt: { kind: "num", def: 0, min: 0, max: 1, step: 0.05, label: "corruption (any cue)", fixed: true, shared: true },
    watched: { kind: "num", def: 0, min: 0, max: 1, step: 0.05, label: "she's watching (hidden layer)", fixed: true, shared: true },
  }, def.motif ? { motif: { kind: "num", def: 0, min: 0, max: 9999, step: 1, label: "the game's theme (0: the cue's own tune)", fixed: true, shared: true } } : {});
  CUES[id] = def;
  return def;
}
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
  if (p.corrupt > 0) corruptTake(t, p.corrupt, makeRng((seed ^ 0x5bd1e995) >>> 0));
  if (p.watched > 0) watchedLayer(t, p.watched, makeRng((seed ^ 0x27d4eb2f) >>> 0));
  t.ev.sort((a, b) => a.t - b.t);
  t.secs = Math.max(t.secs, ...t.ev.map(e => e.t + 0.2));
  // a ringing tail past the length, never much more (but never cutting off the cue's own last notes)
  if (p.len) t.secs = Math.min(t.secs, Math.max(p.len + 4, ...t.ev.map(e => e.t + 1.5), ...t.hits.map(x => x.t + 1)));
  return { cue: cueId, params: p, seed, gain: p.gain, secs: t.secs, tempo: t.tempo, meter: t.meter, key: t.key, ev: t.ev, marks: t.marks, hits: t.hits };
}

// Corruption, after the cue has written its notes (its own random source, so the cue's notes stay the same):
// 0.2 a note slipped flat a phrase and a slight drift; 0.4 a tritone drone under it and the tempo sagging; 0.6 notes
// dropped (missing teeth); 0.8 and over the sustained notes bend apart at their ends.
function corruptTake(t, w, rng) {
  const secs = Math.max(1, t.secs), pitched = t.ev.filter(e => e.piece == null && e.inst !== "fx");
  const sag = 0.12 * Math.max(0, w - 0.3);                       // the late notes come later: a spring running down
  for (const e of t.ev) e.t = e.t * (1 + sag * e.t / secs);
  for (const p of t.hits) p.t = p.t * (1 + sag * p.t / secs);
  for (const m of t.marks) m.t = m.t * (1 + sag * m.t / secs);
  t.secs *= 1 + sag;
  for (const e of pitched) {
    e.cents = (e.cents || 0) + rng.gauss(0, 4 + 22 * w);
    if (rng.chance(0.07 * w) && e.dur != null && e.dur < 1.5) { e.midi -= 1; }
    if (w > 0.75 && e.dur != null && e.dur > 1.2 && !e.bend && rng.chance(0.4)) e.bend = { semis: rng.pick([-1, -0.5, 0.5]), at: e.dur * 0.6, dur: e.dur * 0.4 };
  }
  const drop = Math.max(0, w - 0.45) * 0.3;
  if (drop > 0) t.ev = t.ev.filter(e => e.piece != null || e.inst === "fx" || !rng.chance(drop));
  if (w >= 0.35) {
    const tonic = t.key ? t.key.tonic : 9, low = 36 + mod(tonic + 6, 12), end = t.secs;
    for (let s = 0; s < end - 1; s += 8) t.n("strings", low, s, Math.min(9, end - s), 18 + 30 * w, { attack: Math.min(3, (end - s) / 3), raw: true });
    t.secs = end;
    t.mark(0, "corrupted " + w.toFixed(2));
  }
}
// She's watching: a high tremolo cluster you feel more than hear, the whole length, and now and then a far glock ping.
function watchedLayer(t, w, rng) {
  const c = 79 + rng.int(0, 4), end = t.secs;
  for (let s = 0; s < end - 0.5; s += 7) [0, 1, 3].forEach(i => t.n("trem", c + i, s + rng.range(0, 0.4), Math.max(0.5, Math.min(8, end - s - 0.4)), 8 + 22 * w, { attack: Math.min(2.5, (end - s) / 3), raw: true, cents: rng.range(-30, 30), tone: "ponticello" }));
  if (w > 0.4) for (let s = rng.range(2, 5); s < end - 1; s += rng.range(5, 9)) t.n("glock", 96 + rng.pick([0, 1, 6]), s, null, 14 + 16 * w);
  t.secs = end;
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
const takeInstruments = take => uniq(take.ev.filter(e => e.inst !== "fx").map(e => e.inst));

// A take's fingerprint: what its notes are, in eight hex digits. A favourite keeps the one it was kept with, so a
// changed generator that would change a kept cue's notes is caught (check.js, the palette's "changed" badge).
function takePrint(take) {
  let h = 0x811c9dc5;
  const mix = x => { h ^= x & 0xffff; h = Math.imul(h, 0x01000193) >>> 0; };
  for (const e of take.ev) { mix(Math.round(e.t * 100)); mix(e.piece != null ? e.piece.length * 31 + e.piece.charCodeAt(0) : e.inst === "fx" ? 999 : e.midi); mix(e.vel); mix(e.inst.charCodeAt(0) * 7 + e.inst.length); }
  return h.toString(16).padStart(8, "0");
}

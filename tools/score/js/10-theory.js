// Music theory: notes, modes, chords, the chord spacer (voicings over two or three octaves) and the harmony check
// (does a clip fit a scene's scale, and how far to transpose it). Pure functions: no audio here, so the same code
// can be ported to the game (GDScript) and checked headless.
"use strict";

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const noteName = m => NOTE_NAMES[mod(m, 12)] + (Math.floor(m / 12) - 1);
const pcName = pc => NOTE_NAMES[mod(pc, 12)];
function parseNote(s) {
  const m = /^([A-Ga-g])(#|b|s)?(-?\d)?$/.exec(String(s).trim());
  if (!m) throw new Error("not a note: " + s);
  const pc = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()] + (m[2] === "#" || m[2] === "s" ? 1 : m[2] === "b" ? -1 : 0);
  return m[3] === undefined ? mod(pc, 12) : 12 * (parseInt(m[3], 10) + 1) + pc;
}
const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);

// ---- modes and scales (intervals from the tonic) ----
const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10], harmonic_minor: [0, 2, 3, 5, 7, 8, 11], melodic_minor: [0, 2, 3, 5, 7, 9, 11],
  phrygian_dominant: [0, 1, 4, 5, 7, 8, 10], lydian_dominant: [0, 2, 4, 6, 7, 9, 10],
  major_pent: [0, 2, 4, 7, 9], minor_pent: [0, 3, 5, 7, 10], egyptian: [0, 2, 5, 7, 10],
  yo: [0, 2, 5, 7, 9], in_sen: [0, 1, 5, 7, 10], hirajoshi: [0, 2, 3, 7, 8],
  whole_tone: [0, 2, 4, 6, 8, 10], octatonic_hw: [0, 1, 3, 4, 6, 7, 9, 10], octatonic_wh: [0, 2, 3, 5, 6, 8, 9, 11],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
const scalePcs = (tonic, mode) => (Array.isArray(mode) ? mode : MODES[mode] || MODES.ionian).map(i => mod(tonic + i, 12));

// The notes of a scale between lo and hi (MIDI), ascending.
function scaleNotes(tonic, mode, lo, hi) {
  const pcs = new Set(scalePcs(tonic, mode));
  return range(lo, hi + 1).filter(m => pcs.has(mod(m, 12)));
}
// The scale step from note m by `steps` (positive up, negative down), staying in the scale.
function scaleStep(m, steps, tonic, mode) {
  const pcs = new Set(scalePcs(tonic, mode));
  let x = m, n = Math.abs(steps), dir = Math.sign(steps);
  if (!pcs.has(mod(x, 12))) { while (!pcs.has(mod(x, 12))) x += dir || 1; n = Math.max(0, n - 1); }
  while (n > 0) { x += dir; if (pcs.has(mod(x, 12))) n--; }
  return x;
}
// The nearest scale note to m (ties go up).
function snapToScale(m, tonic, mode) {
  const pcs = new Set(scalePcs(tonic, mode));
  for (let d = 0; d < 7; d++) { if (pcs.has(mod(m + d, 12))) return m + d; if (pcs.has(mod(m - d, 12))) return m - d; }
  return m;
}

// ---- chords ----
// Each type: its intervals from the root; `guide` are the tones a voicing must keep (the 3rd and 7th, the colour
// that names it); `five` may be left out.
const CHORDS = {
  maj: { iv: [0, 4, 7], guide: [4] }, min: { iv: [0, 3, 7], guide: [3] },
  sus2: { iv: [0, 2, 7], guide: [2] }, sus4: { iv: [0, 5, 7], guide: [5] },
  add9: { iv: [0, 4, 7, 14], guide: [4, 14] }, madd9: { iv: [0, 3, 7, 14], guide: [3, 14] },
  "6": { iv: [0, 4, 7, 9], guide: [4, 9] }, m6: { iv: [0, 3, 7, 9], guide: [3, 9] },
  "69": { iv: [0, 4, 7, 9, 14], guide: [4, 9, 14] },
  maj7: { iv: [0, 4, 7, 11], guide: [4, 11] }, m7: { iv: [0, 3, 7, 10], guide: [3, 10] },
  "7": { iv: [0, 4, 7, 10], guide: [4, 10] }, m7b5: { iv: [0, 3, 6, 10], guide: [3, 6, 10] },
  dim: { iv: [0, 3, 6], guide: [3, 6] }, dim7: { iv: [0, 3, 6, 9], guide: [3, 6, 9] }, aug: { iv: [0, 4, 8], guide: [4, 8] },
  maj9: { iv: [0, 4, 7, 11, 14], guide: [4, 11, 14] }, m9: { iv: [0, 3, 7, 10, 14], guide: [3, 10, 14] },
  "9": { iv: [0, 4, 7, 10, 14], guide: [4, 10, 14] }, m11: { iv: [0, 3, 7, 10, 14, 17], guide: [3, 10, 17] },
  "maj7#11": { iv: [0, 4, 7, 11, 18], guide: [4, 11, 18] }, "maj9#11": { iv: [0, 4, 7, 11, 14, 18], guide: [4, 11, 18] },
  "7sus4": { iv: [0, 5, 7, 10], guide: [5, 10] }, "9sus4": { iv: [0, 5, 7, 10, 14], guide: [5, 10, 14] },
  "7b9": { iv: [0, 4, 7, 10, 13], guide: [4, 10, 13] }, mmaj7: { iv: [0, 3, 7, 11], guide: [3, 11] },
  quartal: { iv: [0, 5, 10], guide: [5, 10] }, quartal4: { iv: [0, 5, 10, 15], guide: [5, 10, 15] },
  fifths: { iv: [0, 7, 14], guide: [7, 14] }, fifths4: { iv: [0, 7, 14, 21], guide: [14, 21] },
  cluster: { iv: [0, 1, 2], guide: [1, 2] }, power: { iv: [0, 7], guide: [] },
};
const chordPcs = (root, type) => uniq((CHORDS[type] || CHORDS.maj).iv.map(i => mod(root + i, 12)));
const chordSymbol = (root, type, bass) => pcName(root) + (type === "maj" ? "" : type === "min" ? "m" : type) +
  (bass !== undefined && mod(bass, 12) !== mod(root, 12) ? "/" + pcName(bass) : "");

// A chord from a scale degree of a mode: the diatonic chord (thirds stacked in the scale), `n` tones.
function diatonicChord(tonic, mode, degree, n = 4) {
  const iv = Array.isArray(mode) ? mode : MODES[mode];
  const pcs = [];
  for (let k = 0; k < n; k++) pcs.push(mod(tonic + iv[(degree + 2 * k) % iv.length], 12));
  return { root: pcs[0], pcs };
}

// Names a set of pitch classes over a bass (for transcribed clips): the template that explains most with least.
function nameChord(pcsIn, bassPc) {
  const pcs = uniq(pcsIn.map(p => mod(p, 12)));
  let best = null;
  for (const root of pcs) for (const [type, def] of Object.entries(CHORDS)) {
    if (type === "cluster" || type === "power" || type.startsWith("quartal") || type.startsWith("fifths")) continue;
    const tones = new Set(def.iv.map(i => mod(root + i, 12)));
    const hit = pcs.filter(p => tones.has(p)).length, miss = tones.size - hit, extra = pcs.length - hit;
    const score = hit * 2 - miss * 1.5 - extra * 2.5 + (root === bassPc ? 1.2 : 0) - def.iv.length * 0.05;
    if (!best || score > best.score) best = { root, type, score, bass: bassPc };
  }
  if (!best || pcs.length < 2) return pcs.length ? { root: pcs[0], type: "power", symbol: pcName(pcs[0]), score: 0 } : null;
  best.symbol = chordSymbol(best.root, best.type, best.bass);
  return best;
}

// ---- the spacer: voicings of a chord spread over two or three octaves ----
// Low interval limits (the lowest the lower note of an interval may sit before it turns to mud), by semitones.
const LOW_INTERVAL_LIMIT = { 1: 52, 2: 51, 3: 48, 4: 46, 5: 45, 6: 47, 7: 34, 8: 41, 9: 41, 10: 41, 11: 41, 13: 40, 14: 39 };
const DEGREE_NAMES = ["R", "b9", "9", "m3", "3", "11", "#11", "5", "b13", "13", "b7", "7"];

// spaceChord({root, type} or {root, pcs, guide}, opts) -> [{notes, label, score, span, lh, rh}], best first.
// opts: span (semitones the voicing should cover: 24 two octaves, 36 three), bass (a pitch class, default the root),
// low/high (MIDI limits), voices [min, max], prev (a voicing to move smoothly from), style ("warm" | "bright" |
// "open" | "cluster"), count.
function spaceChord(chord, opts = {}) {
  const span = opts.span || 24, low = opts.low ?? 33, high = opts.high ?? 98;
  const [vMin, vMax] = opts.voices || [4, 6];
  const style = opts.style || "open";
  const root = mod(chord.root, 12);
  const def = chord.type ? CHORDS[chord.type] || CHORDS.maj : null;
  const pcs = uniq(chord.pcs ? chord.pcs.map(p => mod(p, 12)) : def.iv.map(i => mod(root + i, 12)));
  const guide = uniq((chord.guide || (def ? def.guide : [])).map(i => mod(root + i, 12))).filter(p => pcs.includes(p));
  const bassPc = mod(opts.bass ?? chord.bass ?? root, 12);
  const isDomB9 = chord.type === "7b9";
  const roleOf = p => mod(p - root, 12);
  const out = [];
  // basses: the bass pitch class in each octave from low that leaves room for the span
  const basses = range(low, Math.min(low + 24, high - 12)).filter(m => mod(m, 12) === bassPc);
  for (const b of basses) {
    const top = Math.min(high, b + span + 2);
    const cands = range(b + 1, top + 1).filter(m => pcs.includes(mod(m, 12)));
    const notes = [b];
    const dfs = startIdx => {
      if (notes.length >= vMin) consider(notes.slice());
      if (notes.length >= vMax) return;
      for (let i = startIdx; i < cands.length; i++) {
        const m = cands[i], prev = notes[notes.length - 1], gap = m - prev;
        if (gap > (notes.length === 1 ? 19 : 14)) break;          // no holes (wider allowed just above the bass)
        if (LOW_INTERVAL_LIMIT[gap] && prev < LOW_INTERVAL_LIMIT[gap]) continue;
        if (gap === 1 && style !== "cluster" && m < 84) continue;  // seconds only up high, or when asked for
        notes.push(m); dfs(i + 1); notes.pop();
      }
    };
    dfs(0);
  }
  function consider(v) {
    const present = new Set(v.map(m => mod(m, 12)));
    if (guide.some(p => !present.has(p))) return;
    if (pcs.length <= v.length && pcs.some(p => !present.has(p) && roleOf(p) !== 7 && p !== root)) return;
    const s = scoreVoicing(v);
    if (s > -1e8) out.push({ notes: v, score: s });
  }
  function scoreVoicing(v) {
    let s = 0;
    const gaps = v.slice(1).map((m, i) => m - v[i]);
    const vspan = v[v.length - 1] - v[0];
    s -= Math.abs(vspan - span) * 0.55;                              // honour the span asked for
    for (let i = 1; i < gaps.length; i++) {                         // harmonic-series spacing: wide low, close high
      const inv = gaps[i] - gaps[i - 1];
      if (inv > 2) s -= (inv - 2) * (v[i] < 60 ? 0.9 : 0.4);
    }
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
      const d = v[j] - v[i];
      if (d % 12 === 1 && d > 1 && !isDomB9) s -= v[i] < 72 ? 4 : 2;  // minor ninths grind
      if (d === 1 && style !== "cluster") s -= 2.5;
      if (d === 2 && v[i] < 60) s -= 1.2;
    }
    const counts = {};
    v.forEach(m => { const r = roleOf(m); counts[r] = (counts[r] || 0) + 1; });
    if ((counts[4] || 0) + (counts[3] || 0) > 1) s -= 1.5;           // a doubled third
    if ((counts[10] || 0) + (counts[11] || 0) > 1) s -= 3;          // a doubled seventh
    const below = v.filter(m => m < 55).length;
    if (below > 3) s -= (below - 3) * 2;                            // too many notes down in the mud
    const topRole = roleOf(v[v.length - 1]);
    const colour = [2, 6, 9, 11].includes(topRole);
    if (style === "bright" || style === "open") s += colour ? 1.6 : topRole === 4 || topRole === 3 ? 0.9 : topRole === 0 ? -0.8 : 0;
    if (style === "warm") s += topRole === 4 || topRole === 3 || topRole === 7 ? 1 : topRole === 0 ? 0.3 : 0.5;
    if (style === "cluster") { const t3 = v.slice(-3); if (t3.length === 3 && t3[2] - t3[0] <= 5) s += 3; }
    const centre = sum(v) / v.length;
    const want = style === "bright" ? 70 : style === "warm" ? 60 : 64;
    s -= Math.abs(centre - want) * 0.12;
    s += v.length >= 5 ? 0.6 : 0;
    const hands = splitHands(v);
    s += hands ? 1.2 : -1.0;                                        // a pianist could play it
    if (opts.prev && opts.prev.length) s -= voiceLeadCost(opts.prev, v) * 0.18;
    return s;
  }
  out.sort((a, b) => b.score - a.score);
  // keep a varied handful: skip near-duplicates (two notes or fewer apart from one already chosen)
  const chosen = [];
  for (const c of out) {
    if (chosen.some(k => differ(k.notes, c.notes) < 2)) continue;
    chosen.push(c);
    if (chosen.length >= (opts.count || 8)) break;
  }
  return chosen.map(c => Object.assign(c, { span: c.notes[c.notes.length - 1] - c.notes[0], label: describeVoicing(c.notes, root),
    ...(splitHands(c.notes) || { lh: null, rh: null }) }));
}

const differ = (a, b) => { const B = new Set(b), A = new Set(a); return a.filter(x => !B.has(x)).length + b.filter(x => !A.has(x)).length; };

// Two hands: the left within a tenth (16), the right within an octave and a third (16), five fingers each.
function splitHands(v) {
  for (let k = 1; k < v.length; k++) {
    const lh = v.slice(0, k), rh = v.slice(k);
    if (lh.length <= 5 && rh.length <= 5 && lh[lh.length - 1] - lh[0] <= 16 && rh[rh.length - 1] - rh[0] <= 16) return { lh, rh };
  }
  return null;
}

// How far the voices move from one voicing to the next (each new note to its nearest old note), minus common tones.
function voiceLeadCost(a, b) {
  let cost = 0;
  for (const m of b) cost += Math.min(...a.map(x => Math.abs(x - m)));
  const common = b.filter(m => a.includes(m)).length;
  return cost - common * 2;
}

function describeVoicing(v, root) {
  const gaps = v.slice(1).map((m, i) => m - v[i]);
  const run = (x) => { let best = 0, cur = 0; for (const g of gaps) { cur = g === x ? cur + 1 : 0; best = Math.max(best, cur); } return best; };
  const tags = [];
  if (run(5) >= 2) tags.push("quartal");
  if (run(7) >= 2 || (gaps[0] === 7 && gaps[1] === 7)) tags.push("stacked fifths");
  if (gaps[0] === 15 || gaps[0] === 16 || (gaps[0] + (gaps[1] || 0) === 16 && gaps[0] === 7)) tags.push("tenth");
  const t3 = v.slice(-3);
  if (t3.length === 3 && t3[2] - t3[0] <= 5) tags.push("cluster top");
  const avg = sum(gaps) / gaps.length;
  if (!tags.length) tags.push(avg >= 6 ? "open" : avg >= 4 ? "spread" : "close");
  const octs = Math.round((v[v.length - 1] - v[0]) / 6) / 2;
  return tags.join(", ") + " · " + octs + " oct · top " + DEGREE_NAMES[mod(v[v.length - 1] - root, 12)];
}

// Voice a chord near a previous voicing (the generator's smooth progressions): the best of the spacer's choices
// weighted by how little the voices move.
function voiceNear(chord, prev, opts) {
  const c = spaceChord(chord, Object.assign({}, opts, { prev, count: 6 }));
  return c.length ? c[0].notes : chordPcs(chord.root, chord.type || "maj").map(p => 60 + mod(p - 60, 12));
}

// ---- the harmony check ----
// A clip's notes are [{t, dur, midi, vel}]. The weight of a pitch class: longer and louder notes count for more, so
// a quick passing tone barely moves the result (the check is meant to be loose).
function pcWeights(notes) {
  const w = new Array(12).fill(0);
  for (const n of notes) w[mod(n.midi, 12)] += Math.sqrt(Math.max(0.05, n.dur || 0.3)) * ((n.vel || 80) / 127);
  return w;
}

// Krumhansl-Kessler key profiles: the key a set of notes most suggests.
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
function correlate(a, b) {
  const ma = sum(a) / a.length, mb = sum(b) / b.length;
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? n / Math.sqrt(da * db) : 0;
}
function detectKey(notes) {
  const w = pcWeights(notes);
  let best = { tonic: 0, mode: "major", r: -2 };
  for (let t = 0; t < 12; t++) for (const [mode, prof] of [["major", KK_MAJOR], ["minor", KK_MINOR]]) {
    const rot = range(0, 12).map(i => prof[mod(i - t, 12)]);
    const r = correlate(w, rot);
    if (r > best.r) best = { tonic: t, mode, r };
  }
  best.name = pcName(best.tonic) + (best.mode === "minor" ? " minor" : " major");
  return best;
}

// fitScale: the share of a clip's weight inside a scale, and the notes outside it.
function fitScale(notes, tonic, mode, shift = 0) {
  const pcs = new Set(scalePcs(tonic, mode));
  const w = pcWeights(notes.map(n => Object.assign({}, n, { midi: n.midi + shift })));
  const total = sum(w) || 1;
  const inside = sum(w.filter((_, pc) => pcs.has(pc)));
  const outside = range(0, 12).filter(pc => w[pc] > 0 && !pcs.has(pc)).map(pc => ({ pc, name: pcName(pc), share: w[pc] / total }));
  return { fit: inside / total, outside };
}

// The transposition (-6..+5 semitones) that makes a clip sit best in a scene's scale; ties go to the smallest move.
// Then the verdict: "fits" (0.85 and up), "colourful" (0.7 up: passing tones, a borrowed note), "clashes" below,
// unless the clip is meant to grind ("dissonant" in its tags), which only reports.
const FIT_GOOD = 0.85, FIT_LOOSE = 0.7;
function harmonyCheck(notes, scene, tags = []) {
  if (!notes || !notes.length) return { verdict: "no notes", shift: 0, fit: 0 };
  let best = null;
  for (let k = -6; k <= 5; k++) {
    const f = fitScale(notes, scene.tonic, scene.mode, k);
    const tonicPull = pcWeights(notes.map(n => ({ ...n, midi: n.midi + k })))[mod(scene.tonic, 12)];
    const score = f.fit + tonicPull * 0.004 - Math.abs(k) * 0.003;
    if (!best || score > best.score) best = Object.assign({ shift: k, score }, f);
  }
  const dissonant = tags.includes("dissonant");
  best.verdict = best.fit >= FIT_GOOD ? "fits" : best.fit >= FIT_LOOSE ? "colourful" : dissonant ? "dissonant (meant)" : "clashes";
  best.key = detectKey(notes);
  best.clashes = clashReport(notes.map(n => ({ ...n, midi: n.midi + best.shift })));
  return best;
}

// Sustained minor seconds and minor ninths sounding together in the low-middle register: the mud a listener hears
// even when every note is "in the scale".
function clashReport(notes) {
  const out = [];
  for (let i = 0; i < notes.length; i++) for (let j = i + 1; j < notes.length; j++) {
    const a = notes[i], b = notes[j];
    const overlap = Math.min(a.t + (a.dur || 0.3), b.t + (b.dur || 0.3)) - Math.max(a.t, b.t);
    if (overlap < 0.15) continue;
    const d = Math.abs(a.midi - b.midi);
    if (d % 12 === 1 && Math.min(a.midi, b.midi) < 72) out.push({ t: +Math.max(a.t, b.t).toFixed(2), notes: [noteName(a.midi), noteName(b.midi)] });
  }
  return out;
}

// Chords in a clip: at each onset, the notes sounding then (the pedal lets a slow roll pile up); while the next
// onset keeps two or more of them, it is the same chord growing, else a new one starts. A group needs three pitch
// classes, and a run up a scale (short notes, mostly steps) is not a chord.
function chordsIn(notes) {
  const sorted = notes.slice().sort((a, b) => a.t - b.t);
  const groups = [];
  let cur = null;
  for (const n of sorted) {
    const sounding = sorted.filter(m => m.t <= n.t + 0.001 && m.t + (m.dur || 0.3) > n.t);
    if (cur && sounding.filter(m => cur.set.has(m)).length >= 2) { for (const m of sounding) cur.set.add(m); continue; }
    if (cur) groups.push(cur);
    cur = { t0: n.t, set: new Set(sounding) };
  }
  if (cur) groups.push(cur);
  return groups.map(g => [...g.set].sort((a, b) => a.t - b.t || a.midi - b.midi)).filter(ns => {
    if (uniq(ns.map(n => mod(n.midi, 12))).length < 3) return false;
    const seq = ns.map(n => n.midi), short = ns.filter(n => (n.dur || 0.3) < 0.3).length;
    const steps = seq.slice(1).filter((m, i) => Math.abs(m - seq[i]) <= 2).length;
    return !(steps > (seq.length - 1) / 2 && short > ns.length / 2);
  }).map(ns => {
    const midis = uniq(ns.map(n => n.midi)).sort((a, b) => a - b);
    return { t: ns[0].t, notes: ns, midis, chord: nameChord(midis, mod(midis[0], 12)) };
  });
}

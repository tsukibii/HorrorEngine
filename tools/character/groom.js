// The brow and lash editor's hairs (the Character Studio's Brows & lashes tab, "Fine hairs"; docs/CHARACTER_STUDIO.md
// §2b). After the user's references (MetaHuman faces, 2026-10-31): a brow is a band of fine hairs lying flat on the
// skin, the front ones up, the body's swept out and a little up, the tail's out and down, the top and bottom rows
// leaning toward the middle; the upper lashes leave the lid's edge forward, ease up into a gentle curl and sweep out
// toward the temple (from the front a dark line along the lid with short tips over it, never a fan standing up), the
// lower lashes few, fine and short, down and out. The user shapes them by hand: each brow's band by handles on its top
// and bottom edges, the lashes by handles at their tips (inner, middle, outer), the hair by sliders, the brows' density
// and flow by brushes. Out come strands (points, radius per point, the normal the card faces) for browlash.js's
// strandCards: one fine hair to a card. Plain arrays in and out (x, y, z each); index.html feeds the face.
//
//   fresh(saved)                       the editor's settings (st.groom), the defaults under what was saved
//   browStrands(ctx, side, g)          one brow: { strands, edges: { upper: [5 points], lower: [5 points] } }
//     ctx: { rows: { upper, lower } (MediaPipe's brow rows, inner to outer, 5 points each), out (the way to the temple),
//            U (up), mm (a millimetre in the body's units), project(p) -> { p, n } (the skin nearest p and its normal) }
//   lashStrands(ctx, side, g)          one eye's lashes: { strands, tips: [3 points: the upper lashes' tips at the handles] }
//     ctx: { lid (index.html's lids[side]: upper, lower, their rims, open0, eye, centre), F, U, mm }
//   lashTip(ctx, side, g, k, over)     handle k's tip with that station's numbers changed (over): the drag's Jacobian

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rot = (v, k, a) => add(add(mul(v, Math.cos(a)), mul(cross(k, v), Math.sin(a))), mul(k, dot(k, v) * (1 - Math.cos(a))));   // v about the unit axis k
const D2R = Math.PI / 180;
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const hash = (a, b) => { let h = Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

// Catmull-Rom through points (clamped at the ends), as a function of t in [0, 1]
function spline(P) {
  const n = P.length;
  return t => {
    const x = Math.max(0, Math.min(1, t)) * (n - 1), i = Math.min(n - 2, Math.floor(x)), u = x - i;
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)], u2 = u * u, u3 = u2 * u;
    return [0, 1, 2].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3));
  };
}
// a few numbers along t (stations at their ts), smooth between them, flat past the ends
function profile(ts, vs) {
  return t => {
    if (t <= ts[0]) return vs[0];
    for (let i = 1; i < ts.length; i++) if (t <= ts[i]) { const u = smooth(ts[i - 1], ts[i], t); return vs[i - 1] + (vs[i] - vs[i - 1]) * u; }
    return vs[vs.length - 1];
  };
}

// ---- the settings ---------------------------------------------------------------------------------------------------

export const BROW_STATIONS = 5;                         // handles along each brow's top and bottom edge, inner to outer (on MediaPipe's rows)
export const LASH_STATIONS = [0.18, 0.55, 0.9];         // the lash handles along the upper lid, inner corner (0) to outer (1)
export const PAINT = { nt: 24, ns: 6 };                 // the brows' brush grid: along the brow, across it
const zeros = n => Array.from({ length: n }, () => [0, 0]);
const browSide = () => ({ upper: zeros(BROW_STATIONS), lower: zeros(BROW_STATIONS), paint: null });   // offsets in mm (toward the temple, up); paint: { dens, comb } or none
const lashSide = () => ({ stations: LASH_STATIONS.map(() => ({ len: 1, lift: 0, sweep: 0 })) });     // each handle's length (a share), lift and sweep (degrees, over the sliders')

export const GROOM_DEFAULTS = {
  on: false, mirror: true,
  brow: { style: "natural", hairs: 420, length: 1, thickness: 1, soft: 0.6, messy: 0.4, head: 82, body: 26, tail: -10, converge: 0.35,
          trim: 0.7, clumps: 0.5, frizz: 0.3, L: browSide(), R: browSide() },
  lash: { style: "natural", count: 130, length: 7, lift: 0, curl: 0.35, tipCurl: 0.5, sweep: 40, inner: 0.55, thickness: 1, clump: 0.35, uneven: 0.5, frizz: 0.2,
          lower: 34, lowerLength: 3.8, lowerAngle: 58, line: 0.22, L: lashSide(), R: lashSide() },
};
// presets: the hair's numbers (the shape by hand stays)
export const BROW_STYLES = {
  natural: { label: "Natural (MetaHuman)", hairs: 420, length: 1, thickness: 1, soft: 0.6, messy: 0.4, head: 82, body: 26, tail: -10, converge: 0.35, trim: 0.7, clumps: 0.5, frizz: 0.3 },
  soft:    { label: "Soft and sparse", hairs: 280, length: 0.9, thickness: 0.85, soft: 0.85, messy: 0.25, head: 80, body: 24, tail: -10, converge: 0.3, trim: 0.8, clumps: 0.3, frizz: 0.2 },
  full:    { label: "Full", hairs: 640, length: 1.1, thickness: 1.05, soft: 0.5, messy: 0.35, head: 84, body: 28, tail: -8, converge: 0.35, trim: 0.6, clumps: 0.55, frizz: 0.35 },
  groomed: { label: "Groomed (brushed up)", hairs: 460, length: 1.05, thickness: 1, soft: 0.55, messy: 0.15, head: 88, body: 42, tail: 0, converge: 0.15, trim: 0.5, clumps: 0.7, frizz: 0.1 },
  straight:{ label: "Straight", hairs: 440, length: 1, thickness: 1, soft: 0.55, messy: 0.2, head: 75, body: 16, tail: -6, converge: 0.3, trim: 0.7, clumps: 0.4, frizz: 0.2 },
  bold:    { label: "Bold (masculine)", hairs: 720, length: 1.2, thickness: 1.3, soft: 0.4, messy: 0.45, head: 80, body: 24, tail: -12, converge: 0.4, trim: 0.55, clumps: 0.6, frizz: 0.5 },
};
export const LASH_STYLES = {
  natural: { label: "Natural (MetaHuman)", count: 115, length: 7, lift: 0, curl: 0.3, sweep: 40, inner: 0.55, thickness: 1, clump: 0.25, lower: 34, lowerLength: 3.8, lowerAngle: 58, tipCurl: 0.5, uneven: 0.5, frizz: 0.2 },
  soft:    { label: "Soft", count: 100, length: 6.2, lift: -2, curl: 0.25, sweep: 36, inner: 0.6, thickness: 0.85, clump: 0.2, lower: 24, lowerLength: 3.4, lowerAngle: 56, tipCurl: 0.45, uneven: 0.4, frizz: 0.15 },
  full:    { label: "Full", count: 160, length: 7.8, lift: 2, curl: 0.35, sweep: 42, inner: 0.55, thickness: 1.1, clump: 0.3, lower: 40, lowerLength: 4.4, lowerAngle: 52, tipCurl: 0.55, uneven: 0.55, frizz: 0.2 },
  doll:    { label: "Doll (curled up)", count: 150, length: 8.5, lift: 18, curl: 0.65, sweep: 30, inner: 0.65, thickness: 1.1, clump: 0.4, lower: 45, lowerLength: 5, lowerAngle: 46, tipCurl: 0.35, uneven: 0.3, frizz: 0.1 },
  fox:     { label: "Fox (swept out)", count: 130, length: 7.5, lift: -4, curl: 0.25, sweep: 55, inner: 0.45, thickness: 1, clump: 0.25, lower: 28, lowerLength: 4, lowerAngle: 55, tipCurl: 0.6, uneven: 0.5, frizz: 0.2 },
  sparse:  { label: "Sparse (masculine, older)", count: 80, length: 5.5, lift: -2, curl: 0.2, sweep: 32, inner: 0.6, thickness: 0.9, clump: 0.15, lower: 18, lowerLength: 3.2, lowerAngle: 58, tipCurl: 0.4, uneven: 0.7, frizz: 0.3 },
};
export const BROW_SLIDERS = [   // [key, label, lo, hi, step, help]
  ["hairs", "Hairs", 80, 1200, 10, "How many hairs each brow has."],
  ["length", "Length", 0.5, 1.8, 0.01, "The hairs' length (the front ones are always shorter)."],
  ["thickness", "Thickness", 0.5, 1.8, 0.01, "Each hair's thickness."],
  ["soft", "Soft edges", 0, 1, 0.01, "How the brow fades out at its edges and its front: hard drawn edge at 0, a soft cloud at 1."],
  ["messy", "Messy", 0, 1, 0.01, "Hairs out of line: groomed at 0, unruly at 1."],
  ["head", "Front hairs' angle", 40, 100, 1, "Degrees from the brow's line: the front hairs stand up (about 80)."],
  ["body", "Middle hairs' angle", -10, 70, 1, "The middle's hairs: swept out and a little up (about 25)."],
  ["tail", "Tail hairs' angle", -40, 30, 1, "The tail's hairs: out and a little down (about -10)."],
  ["converge", "Toward the middle", 0, 1, 0.01, "The top and bottom rows lean toward the brow's middle line, as they grow."],
  ["trim", "Trimmed edges", 0, 1, 0.01, "The hairs along the brow's top, bottom and front shorter than its body's, as a groomed brow's are."],
  ["clumps", "Clumps", 0, 1, 0.01, "Hairs gathered toward their neighbours' tips in little groups (about 2 mm), as real brow hair lies."],
  ["frizz", "Frizz", 0, 1, 0.01, "Each hair's own small waves and strays: smooth at 0."],
];
export const LASH_SLIDERS = [
  ["count", "Upper lashes", 30, 260, 1, "How many upper lashes each eye has."],
  ["length", "Length", 3, 13, 0.1, "The longest lashes (the outer third), mm."],
  ["lift", "Lift", -10, 60, 1, "Degrees up from straight out of the lid: low hugs the eye, high stands up (a doll's)."],
  ["curl", "Curl", 0, 1, 0.01, "How much they curve up along their length."],
  ["tipCurl", "Curl at the tip", 0, 1, 0.01, "Where the curl is: spread along the lash at 0, gathered toward the tip at 1 (straight out of the lid, then up)."],
  ["sweep", "Outer sweep", 0, 70, 1, "Degrees toward the temple at the outer corner (the inner ones stay straight)."],
  ["inner", "Inner length", 0.2, 1, 0.01, "The lashes at the inner corner, as a share of the longest."],
  ["thickness", "Thickness", 0.5, 1.8, 0.01, "Each lash's thickness."],
  ["clump", "Clumps", 0, 1, 0.01, "Neighbouring lashes drawn together at their tips, in groups of two to six."],
  ["uneven", "Uneven", 0, 1, 0.01, "How much the lashes' lengths differ: short ones between the long, as real lashes grow."],
  ["frizz", "Frizz", 0, 1, 0.01, "Each lash's own small wave and lean."],
  ["lower", "Lower lashes", 0, 120, 1, "How many lower lashes each eye has."],
  ["lowerLength", "Lower length", 1.5, 8, 0.1, "The lower lashes' longest, mm."],
  ["lowerAngle", "Lower angle", 15, 80, 1, "Degrees down from straight out of the lid."],
  ["line", "Lash line", 0, 1, 0.01, "The dark line along the lid where the lashes grow: a thin line at 0.2, an eyeliner's at 1."],
];

const browFrom = b => {                                // a brow side's saved hand work, checked, in the defaults' shape
  const a = browSide(); if (!b) return a;
  for (const e of ["upper", "lower"]) if (Array.isArray(b[e])) b[e].slice(0, BROW_STATIONS).forEach((v, i) => { a[e][i] = [+v[0] || 0, +v[1] || 0]; });
  if (b.paint && Array.isArray(b.paint.dens) && b.paint.dens.length === PAINT.nt * PAINT.ns) a.paint = { dens: b.paint.dens.slice(), comb: (b.paint.comb || []).slice() };
  return a;
};
export function fresh(saved) {                         // the defaults under what was saved (a deep copy: nothing shared with the defaults)
  const g = JSON.parse(JSON.stringify(GROOM_DEFAULTS)), s = saved || {};
  for (const k of ["on", "mirror"]) if (k in s) g[k] = s[k];
  for (const part of ["brow", "lash"]) {
    const from = s[part] || {};
    for (const k in g[part]) if (k !== "L" && k !== "R" && k in from) g[part][k] = from[k];
    for (const side of ["L", "R"]) if (from[side]) {
      const b = from[side];
      if (part === "brow") g.brow[side] = browFrom(b);
      else if (Array.isArray(b.stations)) b.stations.slice(0, LASH_STATIONS.length).forEach((v, i) => { g.lash[side].stations[i] = { len: +v.len || 1, lift: +v.lift || 0, sweep: +v.sweep || 0 }; });
    }
  }
  return g;
}
// one side's hand work onto the other (the Mirror switch): offsets toward the temple and up are the same numbers on both
export function mirrorTo(g, from) {
  const to = from === "L" ? "R" : "L";
  g.brow[to] = JSON.parse(JSON.stringify(g.brow[from])); g.lash[to] = JSON.parse(JSON.stringify(g.lash[from]));
}

// ---- a brow ---------------------------------------------------------------------------------------------------------

const NT = 40, NS = 9;                                  // the band's grid on the skin: along, across
function band(ctx, hand) {                              // the band: its edges through the rows and the handles' offsets, laid on the skin as a grid
  const { rows, out, U, mm, project } = ctx;
  const edge = (P, off) => P.map((p, i) => add(p, add(mul(out, off[i][0] * mm), mul(U, off[i][1] * mm))));
  const up = edge(rows.upper, hand.upper), lo = edge(rows.lower, hand.lower);
  const top = spline(up), bot = spline(lo), G = [], N = [];
  for (let i = 0; i < NT; i++) {
    const t = i / (NT - 1), a = bot(t), b = top(t), gr = [], nr = [];
    for (let j = 0; j < NS; j++) { const q = project(mix(a, b, j / (NS - 1))); gr.push(q.p); nr.push(q.n); }
    G.push(gr); N.push(nr);
  }
  const Lt = [], Hs = [];                               // the band's length per unit of t and its height per unit of s, by t (mm)
  for (let i = 0; i < NT; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(NT - 1, i + 1), m = (NS - 1) >> 1;
    Lt.push(Math.hypot(...sub(G[i1][m], G[i0][m])) / ((i1 - i0) / (NT - 1)) / mm);
    Hs.push(Math.hypot(...sub(G[i][NS - 1], G[i][0])) / mm);
  }
  const at = (t, s) => {                                // the skin at (t, s): the grid's bilinear place and normal (past the edges, carried on)
    const x = Math.max(0, Math.min(1, t)) * (NT - 1), i = Math.min(NT - 2, Math.floor(x)), u = x - i;
    const y = s * (NS - 1), j = Math.max(0, Math.min(NS - 2, Math.floor(y))), v = y - j;
    const p00 = G[i][j], p01 = G[i][j + 1], p10 = G[i + 1][j], p11 = G[i + 1][j + 1];
    const p = mix(mix(p00, p10, u), mix(p01, p11, u), v), n = norm(mix(mix(N[i][j], N[i + 1][j], u), mix(N[i][j + 1], N[i + 1][j + 1], u), v));
    return { p, n };
  };
  const metric = t => { const x = Math.max(0, Math.min(1, t)) * (NT - 1), i = Math.min(NT - 2, Math.floor(x)), u = x - i; return [Lt[i] + (Lt[i + 1] - Lt[i]) * u, Hs[i] + (Hs[i + 1] - Hs[i]) * u]; };
  return { at, metric, up, lo, G };
}
const paintAt = (paint, key, t, s, dflt) => {           // the brush grid's value at (t, s), bilinear
  const a = paint && paint[key]; if (!a || !a.length) return dflt;
  const x = Math.max(0, Math.min(1, t)) * (PAINT.nt - 1), y = Math.max(0, Math.min(1, s)) * (PAINT.ns - 1);
  const i = Math.min(PAINT.nt - 2, Math.floor(x)), j = Math.min(PAINT.ns - 2, Math.floor(y)), u = x - i, v = y - j, k = (ii, jj) => a[ii * PAINT.ns + jj] ?? dflt;
  return (k(i, j) * (1 - u) + k(i + 1, j) * u) * (1 - v) + (k(i, j + 1) * (1 - u) + k(i + 1, j + 1) * u) * v;
};
export function browAngle(o, paint, t, s) {             // a hair's way across the band at (t, s): degrees from the brow's line toward its top
  const wh = 1 - smooth(0.05, 0.24, t), wt = smooth(0.6, 0.95, t);
  let th = o.head * wh + o.body * (1 - wh) * (1 - wt) + o.tail * wt;
  th += o.converge * (0.5 - s) * 60 * (1 - 0.7 * wh);   // the top rows lean down, the bottom rows up: toward the middle line
  return th + paintAt(paint, "comb", t, s, 0);
}
export function browDensity(o, paint, t, s) {           // how thick the hair grows at (t, s), 1 the brow's own: the soft edges and front, the brush (Add hair up to 1.5)
  const e = 0.06 + 0.3 * o.soft;
  const across = smooth(-0.02, e, s) * (1 - smooth(1 - e, 1.02, s)), along = (0.35 + 0.65 * smooth(0, 0.18 + 0.25 * o.soft, t)) * (1 - 0.6 * smooth(0.9, 1.0, t));
  return Math.max(0, across * along * paintAt(paint, "dens", t, s, 1));
}
const KEEP = 0.65;                                      // a candidate's chance where the density is 1 (more painted on grows up to all of them)
export function browStrands(ctx, side, g) {
  const o = g.brow, hand = o[side];
  const B = band(ctx, hand), mm = ctx.mm, seed = side === "L" ? 303 : 404, out = [];
  const K = Math.round(o.hairs * 2.6);                  // candidates spread evenly over the band (R2's sequence), each kept by the density there (about Hairs kept)
  const trim = o.trim ?? 0.7, clumps = o.clumps ?? 0.5, frizz = o.frizz ?? 0.3, guides = new Map();
  const grow = (t, s, th0, len, bend, steps) => {         // a hair's path from (t, s): it follows the flow where it goes, on the skin
    let tt = t, ss = s; const pts = [];
    for (let q = 0; q <= steps; q++) {
      const u = q / steps, { p, n } = B.at(tt, ss), lift = (0.04 + 0.12 * Math.sin(Math.PI * Math.min(1, u * 1.1))) * mm;   // lying on the skin, a hair's breadth off it along the way
      pts.push(add(p, mul(n, lift)));
      if (q === steps) break;
      const th = (browAngle(o, hand.paint, tt, ss) - browAngle(o, hand.paint, t, s) + th0 + bend * u) * D2R, [Lt, Hs] = B.metric(tt), step = len / steps;
      tt += Math.cos(th) * step / Math.max(1, Lt); ss += Math.sin(th) * step / Math.max(0.5, Hs);
      ss = Math.max(-0.12, Math.min(1.12, ss));
    }
    return pts;
  };
  const guideOf = (t, s) => {                             // a clump's guide hair: the brow's own flow from the clump's middle (cells about 2 mm by 1.5 mm)
    const [Lt, Hs] = B.metric(t), ci = Math.round(t * Lt / 2), cj = Math.round(s * Hs / 1.5), key = ci + "," + cj;
    if (!guides.has(key)) { const gt = Math.min(1, ci * 2 / Math.max(1, Lt)), gs = Math.max(0, Math.min(1, cj * 1.5 / Math.max(0.5, Hs)));
      const len = (3.4 + 2.0 * smooth(0.05, 0.3, gt) - 1.0 * smooth(0.75, 1, gt)) * o.length; guides.set(key, grow(gt, gs, browAngle(o, hand.paint, gt, gs), len, 0, 4)); }
    return guides.get(key);
  };
  for (let k = 0; k < K; k++) {
    const t = (0.5 + k * 0.7548776662466927) % 1, s = (0.5 + k * 0.5698402909980532) % 1;
    if (hash(k, seed) > Math.min(1, KEEP * browDensity(o, hand.paint, t, s))) continue;
    const r = rng(seed * 7919 + k), th0 = browAngle(o, hand.paint, t, s) + (r() - 0.5) * 36 * o.messy;
    const edge = Math.max(0.7 * smooth(0.62, 1, s), 0.9 * (1 - smooth(0, 0.35, s)), 0.7 * (1 - smooth(0, 0.22, t)));   // near the top, the bottom, the front: trimmed shorter
    const len = (3.4 + 2.0 * smooth(0.05, 0.3, t) - 1.0 * smooth(0.75, 1, t)) * o.length * (0.55 + 0.9 * r() * r() + 0.15 * r()) * (1 - 0.5 * trim * edge);   // mm: shorter at the front and the tail, each its own (a few long strays)
    const bend = (r() - 0.5) * 22 * o.messy, steps = 4, n0 = B.at(t, s).n;
    const r0 = 0.05 * o.thickness * (0.75 + 0.5 * r()) * (1 - 0.25 * (1 - smooth(0, 0.2, t))) * mm;   // brow hairs are about 0.05 mm at the root
    let pts = grow(t, s, th0, len, bend, steps);
    if (clumps > 0) {                                     // gathered toward its clump's guide: the root stays, the tip goes most of the way
      const gd = guideOf(t, s), amt = clumps * (0.55 + 0.35 * r());
      pts = pts.map((p, q) => { const u = q / steps, w = amt * Math.pow(u, 1.4); const gp = add(gd[q], sub(pts[0], gd[0])); return add(mix(p, gp, w), mul(sub(gd[q], gp), 0.35 * w)); });
    }
    if (frizz > 0) {                                      // its own small waves off the flow, along the skin and a little off it
      const ph = r() * 6.283, fq = 1.5 + 2 * r(), side = norm(cross(n0, sub(pts[steps], pts[0]))), amp = frizz * 0.18 * mm;
      pts = pts.map((p, q) => { const u = q / steps; return add(p, add(mul(side, amp * u * Math.sin(ph + fq * u * 6.283)), mul(n0, 0.3 * amp * u * Math.abs(Math.sin(ph * 1.7 + u * 4))))); });
    }
    out.push({ pts, radius: pts.map((_, q) => r0 * (1 - 0.75 * q / steps)), normal: n0 });
  }
  return { strands: out, edges: { upper: B.up.map(p => ctx.project(p).p), lower: B.lo.map(p => ctx.project(p).p) }, band: B };
}
// where on a brow's band a point of the skin lies (the brush): the nearest of the band's grid points, as (t, s)
export function bandPlace(B, p) {
  let best = Infinity, ti = 0, sj = 0;
  for (let i = 0; i < B.G.length; i++) for (let j = 0; j < B.G[i].length; j++) { const d = Math.hypot(...sub(B.G[i][j], p)); if (d < best) { best = d; ti = i; sj = j; } }
  return { t: ti / (B.G.length - 1), s: sj / (B.G[0].length - 1), d: best };
}

// where on a band a point lies as (t, s) with no steps: the nearest grid point, then one least-squares step along the
// grid's two ways there (past the band's edges and ends, carried on straight)
export function bandCoord(B, p) {
  const q = bandPlace(B, p), G = B.G, nt = G.length - 1, ns = G[0].length - 1, i = Math.round(q.t * nt), j = Math.round(q.s * ns);
  const i0 = Math.max(0, i - 1), i1 = Math.min(nt, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(ns, j + 1);
  const a = mul(sub(G[i1][j], G[i0][j]), nt / (i1 - i0)), b = mul(sub(G[i][j1], G[i][j0]), ns / (j1 - j0)), d = sub(p, G[i][j]);
  const aa = dot(a, a), ab = dot(a, b), bb = dot(b, b), da = dot(d, a), db = dot(d, b), det = aa * bb - ab * ab || 1;
  return { t: q.t + (bb * da - ab * db) / det, s: q.s + (aa * db - ab * da) / det };
}

// ---- an eye's lashes ------------------------------------------------------------------------------------------------

function polyline(P, O = null) {                        // a line by arc length: its point, tangent and O's numbers at t
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(...sub(P[i], P[i - 1])));
  const T = L[L.length - 1] || 1;
  return t => {
    const d = Math.max(0, Math.min(1, t)) * T; let i = 1; while (i < P.length - 1 && L[i] < d) i++;
    const f = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1);
    return { p: mix(P[i - 1], P[i], f), t: norm(sub(P[i], P[i - 1])), o: O && O.length === P.length ? O[i - 1].map((x, k) => x + (O[i][k] - x) * f) : null };
  };
}
function lidFrame(ctx, which) {                         // at t along a lid: the root now, the lid's tangent, its rim path turned with the lid's swing round the eye
  const lid = ctx.lid, O = lid.open0 || lid, c0 = O.eye || O.centre, P = lid[which], P0 = O[which];
  if (!P || P.length < 2 || !P0 || P0.length < 2) return null;
  const now = polyline(P), open = polyline(P0, O[which + "Rim"]);
  return t => {
    const { p: root, t: tg } = now(t), { p: root0, o: rp0 } = open(t);
    const vo = sub(root0, c0), vn = sub(root, c0), po = sub(vo, mul(tg, dot(vo, tg))), pn = sub(vn, mul(tg, dot(vn, tg)));
    const ang = Math.atan2(dot(cross(po, pn), tg), dot(po, pn)), rim = [], rim0 = [];
    if (rp0) for (let j = 0; j * 3 + 2 < rp0.length && j < 3; j++) { const v = [rp0[j * 3], rp0[j * 3 + 1], rp0[j * 3 + 2]]; rim0.push(v); rim.push(rot(v, tg, ang)); }
    return { root, tg, ang, rim, rim0, vo };
  };
}
// one lash at t: its points from the lid's front edge. a: the station's numbers there (len a share, lift and sweep in
// degrees over the sliders'); r: its own randoms [length, lean, lift]
function lash(ctx, frame, o, upper, t, a, r) {
  const { F, U, mm } = ctx, fr = frame(t), outer = upper ? t : 1 - t;
  let radial = norm(cross(F, fr.tg)); if (dot(radial, fr.vo) < 0) radial = mul(radial, -1);   // away from the eye's middle in the face's plane: up from the upper lid, down from the lower
  const onRim = j => fr.rim[j] && Math.hypot(...fr.rim[j]) > 0.05 * mm ? add(fr.root, fr.rim[j]) : add(fr.root, mul(F, 0.07 * mm * (j + 1)));
  const pts = upper ? [fr.root, onRim(0), onRim(1), onRim(2)] : [onRim(2)];   // the upper lash lies over the lid's rounded rim first, then leaves it
  const ex = fr.rim0[2] && fr.rim0[1] && Math.hypot(...sub(fr.rim0[2], fr.rim0[1])) > 0.05 * mm ? sub(fr.rim0[2], fr.rim0[1]) : F;
  const exit = Math.atan2(dot(ex, radial), dot(ex, F));  // the way the rim's skin goes over the edge (radians up from straight out)
  let len, lift, curl, sweep;
  if (upper) {
    len = o.length * (o.inner + (1 - o.inner) * smooth(0, 0.6, outer)) * (1 - 0.15 * smooth(0.92, 1, outer)) * a.len * r[0];
    lift = (o.lift + a.lift + r[2]) * D2R; curl = (0.15 + 1.1 * o.curl) * (r[3] ?? 1);
    sweep = (o.sweep * smooth(0.25, 1, outer) - 6 * (1 - smooth(0, 0.2, outer)) + a.sweep) * D2R + r[1];   // the inner ones lean a touch toward the nose
  } else {
    len = o.lowerLength * (0.45 + 0.55 * smooth(0.05, 0.55, outer)) * (1 - 0.2 * smooth(0.9, 1, outer)) * r[0];
    lift = (o.lowerAngle + r[2]) * D2R; curl = 0.12 + 0.25 * o.curl; sweep = (0.75 * o.sweep * smooth(0.15, 1, outer)) * D2R + r[1];   // out toward the temple, more than the upper's at the middle
  }
  const m = upper ? 7 : 5, a0 = pts.length; let q = pts[a0 - 1];
  const along = upper ? fr.tg : mul(fr.tg, -1);         // toward the outer corner (the lower lid's line runs outer to inner)
  for (let k = 1; k <= m; k++) {
    const u = k / m, ease = smooth(0, 0.55, u), ang = exit + (lift - exit) * ease + curl * Math.pow(u, 1 + 2.5 * (o.tipCurl ?? 0.5)) * (upper ? 1 : -0.4) * (1 + 0.6 * (o.tipCurl ?? 0.5));   // the curl gathered toward the tip: out of the lid, then up
    let d = norm(add(mul(F, Math.cos(ang)), mul(radial, Math.sin(ang))));
    d = norm(rot(d, norm(cross(d, along)), sweep * ease));   // swept toward the outer corner about the axis square to it
    if (r[4]) d = norm(rot(d, d[0] || d[1] ? norm(cross(d, radial)) : fr.tg, r[4] * Math.sin(r[5] + u * 5) * u));   // its own small wave (frizz)
    d = rot(d, fr.tg, fr.ang);                            // turned with the lid as it swings shut (its root's turn round the eye since open)
    q = add(q, mul(d, len * mm / m)); pts.push(q);
  }
  return { pts, a0, radial, tg: fr.tg };
}
function stationsOf(g, side) { const S = g.lash[side].stations; return { len: profile(LASH_STATIONS, S.map(x => x.len)), lift: profile(LASH_STATIONS, S.map(x => x.lift)), sweep: profile(LASH_STATIONS, S.map(x => x.sweep)) }; }
export function lashStrands(ctx, side, g) {
  const o = g.lash, out = [], seed = side === "L" ? 101 : 202, st = stationsOf(g, side), tips = [];
  for (const which of ["upper", "lower"]) {
    const upper = which === "upper", frame = lidFrame(ctx, which), n = upper ? o.count : o.lower; if (!frame || !n) continue;
    const r = rng(seed + (upper ? 0 : 7)), hairs = [];
    for (let k = 0; k < n; k++) {
      const tt = (k + 0.15 + 0.7 * r()) / n, t = upper ? 0.035 + 0.96 * tt : 0.04 + 0.88 * tt, at = upper ? t : 1 - t;   // the upper lashes along the whole lid, to its outer end
      const a = upper ? { len: st.len(at), lift: st.lift(at), sweep: st.sweep(at) } : { len: 1, lift: 0, sweep: 0 };
      const un = o.uneven ?? 0.5, short = upper && r() < 0.3 * un, fz = (o.frizz ?? 0.2) * 0.12;   // uneven: a share of short ones between the long, every length its own
      const rr = upper ? [(short ? 0.5 + 0.25 * r() : 0.82 + 0.3 * r()) * (1 - 0.15 * un * r()), (r() - 0.5) * 0.12, (r() - 0.5) * 8, 0.8 + 0.4 * r(), fz * (r() - 0.3), r() * 6.283] : [0.6 + 0.6 * r(), (r() - 0.5) * 0.35, (r() - 0.5) * 18, 1, fz * (r() - 0.5), r() * 6.283];   // the lower ones unevenly: a real lower lid's lashes are a few, each its own way
      let h = lash(ctx, frame, o, upper, upper ? t : t + (r() - 0.5) * 0.6 / n, a, rr);
      for (let up = 1; upper && t < 0.9 && up <= 6 && dot(sub(h.pts[h.pts.length - 1], h.pts[h.a0 - 1]), ctx.U) < 0.1 * ctx.mm; up++)   // an upper lash never hangs into the eye: where the lid turns steeply (its inner end) lifted till its tip clears the lid's edge
        h = lash(ctx, frame, o, upper, t, { ...a, lift: a.lift + 6 * up }, rr);
      h.r0 = (upper ? 0.055 : 0.034) * o.thickness * (0.8 + 0.4 * r()) * ctx.mm; h.t = t;   // (real lashes are about 0.05 to 0.06 mm at the root)
      if (!upper && r() > 0.35 + 0.65 * smooth(0.05, 0.45, 1 - t)) continue;   // few lower lashes toward the inner corner
      hairs.push(h);
    }
    const cr = rng(seed + 31 + (upper ? 0 : 5));         // clumps: neighbours' tips drawn together, groups of two to six (irregular, as real lashes clump)
    if (upper && o.clump > 0) for (let g0 = 0, per; g0 < hairs.length; g0 += per) {
      per = 2 + Math.floor(cr() * (2 + 3 * o.clump));
      const grp = hairs.slice(g0, g0 + per); if (grp.length < 2) continue;
      const m = grp[0].pts.length, avg = Array.from({ length: m }, (_, k) => mul(grp.reduce((s, h) => add(s, h.pts[k] || h.pts[h.pts.length - 1]), [0, 0, 0]), 1 / grp.length));
      for (const h of grp) h.pts = h.pts.map((p, k) => k < h.a0 ? p : mix(p, avg[k], Math.min(0.92, 0.85 * o.clump) * Math.pow((k - h.a0 + 1) / (m - h.a0), 1.3)));
    }
    for (const h of hairs) out.push({ pts: h.pts, radius: h.pts.map((_, k) => h.r0 * (1 - 0.75 * Math.max(0, k - h.a0 + 1) / (h.pts.length - h.a0))), normal: h.radial, t: upper ? h.t : undefined });
    if (upper) for (let k = 0; k < LASH_STATIONS.length; k++) tips.push(lashTip(ctx, side, g, k));
  }
  return { strands: out, tips };
}
export function lashTip(ctx, side, g, k, over = null) {   // a lash's tip at handle k, the station's numbers changed by `over` (the drag)
  const frame = lidFrame(ctx, "upper"); if (!frame) return null;
  const t = LASH_STATIONS[k], s = g.lash[side].stations[k], a = { len: s.len, lift: s.lift, sweep: s.sweep, ...(over || {}) };
  const h = lash(ctx, frame, g.lash, true, t, a, [0.97, 0, 0]);
  return h.pts[h.pts.length - 1];
}

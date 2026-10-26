// Brows and lashes (Character Studio, the Face tab): cards for the salon's hair shader (hairshader.js) and a strand atlas
// of its own (hairtex.js's makeAtlas: clumps that draw together into points, the way lashes and brow hairs end). Our own
// code. No physics: the lashes are rooted on the lid's edge (the eye's smoothed opening, index.html's outline()), lie
// along the lid's rim to its front edge (the line runs along the rim's back, where it meets the eye; lashes grow from
// its front: rooted on the line and sent straight out, they ran under the rim's skin for 3 mm and a band of bare skin
// showed between the eye and the lashes), turn with the lid as it rotates about the eye and squash as it shuts; the
// brows lie flat on the skin between MediaPipe's two brow rows, so they ride every brow expression. Plain arrays in, a
// BufferGeometry out.
//
//   build({ lids, brows, F, U, C, scale }, st) -> { geometry, cards }
//     lids: { L: { upper: [[x,y,z]...] inner -> outer, lower: [...] outer -> inner, upperRim, lowerRim, centre, open }, R: {...} }
//       open: 1 as made, 0 shut; upperRim, lowerRim: from each point of the line, three points over the rim to its front
//       edge, just off its skin (nine numbers, offsets from the line's point: index.html's rimOf)
//     brows: { L: { upper: [[x,y,z]...] medial -> lateral, lower: [...] }, R: {...} }
//     F, U: the face's forward and up; C: the head's middle (the skin's normals point away from it); scale: the body's
import * as THREE from "three";
import { makeAtlas } from "./hairtex.js";
import { rng } from "./salonlib.js";

export const LASH_DEFAULTS = { on: false, count: 80, length: 8.5, curl: 0.55, lift: 0.45, clump: 0.45, spikes: 0, vary: 0, width: 0.5, flare: 0.5,
  lower: true, lowerCount: 36, lowerLength: 4, lowerDrop: 0, line: 0.4, look: "lash_black" };
export const BROW_DEFAULTS = { on: false, shape: "natural", count: 1100, length: 6.5, width: 1, arch: 0, tail: 1, soft: 0.5, powder: 0.45, look: "brow_dark_brown" };
export const LASH_CONTROLS = [   // [key, label, lo, hi, step, help]
  ["count", "Upper lashes", 30, 140, 1, "Upper lashes on each eye."], ["length", "Length (mm)", 4, 14, 0.1, "The longest upper lash."],
  ["curl", "Curl", 0, 1, 0.01, "How far each lash curls up towards its tip."], ["lift", "Lift", 0, 1, 0.01, "How high they leave the lid: 0 straight out, 1 swept up."],
  ["clump", "Clumping", 0, 1, 0.01, "Lashes drawn together into points: 0 every lash apart (natural), 1 spiky (mascara, anime)."],
  ["spikes", "Spiky clumps", 0, 1, 0.01, "Each clump's roots gathered, with a gap to the next: separate spikes along the lid (anime lash sets). 0 the roots spread evenly."],
  ["vary", "Long and short", 0, 1, 0.01, "Every other spike shorter, the way anime lash sets alternate long spikes with short ones."],
  ["width", "Thickness", 0.2, 1.2, 0.01, "Each lash's thickness."], ["flare", "Outer flare", 0, 1, 0.01, "Longer and swept out at the outer corner (a cat eye)."],
  ["lowerCount", "Lower lashes", 0, 80, 1, "On each lower lid."], ["lowerLength", "Lower length (mm)", 1.5, 7, 0.1, "The longest lower lash."],
  ["lowerDrop", "Lower lashes down", 0, 1, 0.01, "Where the lower lashes point: 0 out from the lid, 1 down along the skin under the eye (wisps that show from the front)."],
  ["line", "Lash line", 0, 1, 0.01, "A dark line along the upper lid's edge where the lashes grow (a tight liner)."]];
export const BROW_CONTROLS = [
  ["count", "Hairs", 200, 2400, 1, "Hairs on each brow."], ["length", "Length (mm)", 3, 11, 0.1, "Each hair's length."],
  ["width", "Thickness", 0.4, 1.6, 0.01, "How tall the brow is, top to bottom."], ["arch", "Arch", -1, 1, 0.01, "-1 straight, 0 the face's own, 1 higher arched."],
  ["tail", "Tail", 0.6, 1.25, 0.01, "Where the brow ends: shorter or longer than the face's own."],
  ["soft", "Soft front", 0, 1, 0.01, "Fewer, finer hairs at the front, the brow fading in (a feathered start)."],
  ["powder", "Fill", 0, 1, 0.01, "A soft tint under the hairs, as a real brow's skin shows (or a brow powder): fuller from a distance."]];
export const LASH_STYLES = {   // presets for the lashes' own settings, after the user's references (a style sets every control: styleOf)
  natural: { label: "Natural", group: "Natural", count: 90, length: 8, curl: 0.5, lift: 0.4, clump: 0.2, width: 0.4, flare: 0.3, lowerCount: 30, lowerLength: 3.5, line: 0.25 },
  defined: { label: "Defined (mascara)", group: "Natural", count: 80, length: 9.5, curl: 0.6, lift: 0.5, clump: 0.7, width: 0.6, flare: 0.55, lowerCount: 34, lowerLength: 4.5, line: 0.6 },
  short: { label: "Short, straight", group: "Natural", count: 100, length: 6, curl: 0.2, lift: 0.25, clump: 0.15, width: 0.35, flare: 0.15, lowerCount: 24, lowerLength: 2.5, line: 0.15 },
  doll: { label: "Doll (full, dense)", group: "Dramatic", count: 75, length: 11, curl: 0.75, lift: 0.6, clump: 0.9, width: 0.55, flare: 0.8, lowerCount: 40, lowerLength: 5.5, line: 0.9 },
  // after the user's references (DECISIONS 2026-10-26, night): an anime lash set (a photo: spikes with gaps between them,
  // long ones alternating with short, the outer ones longest and swept out, the lower lashes in separate spikes pointing
  // down the skin), drawn eyes (long wisps, a bold lash line) and a doll's eye ringed in short spikes
  anime: { label: "Anime lash set (spikes)", group: "Anime, after the references", count: 84, length: 12, curl: 0.6, lift: 0.65, clump: 0.95, spikes: 1, vary: 0.8, width: 0.6, flare: 0.75,
           lowerCount: 36, lowerLength: 5.5, lowerDrop: 0.75, line: 0.7 },
  drawn: { label: "Drawn (manhwa, long wisps)", group: "Anime, after the references", count: 60, length: 13, curl: 0.7, lift: 0.7, clump: 1, spikes: 1, vary: 0.5, width: 0.7, flare: 0.9,
           lowerCount: 26, lowerLength: 6, lowerDrop: 0.8, line: 1 },
  animeDoll: { label: "Anime doll (short spikes all round)", group: "Anime, after the references", count: 66, length: 7.5, curl: 0.45, lift: 0.5, clump: 0.9, spikes: 1, vary: 0.25, width: 0.55, flare: 0.3,
               lowerCount: 40, lowerLength: 4.5, lowerDrop: 0.85, line: 0.5 },
};
// a style's settings over every control's default (a style that doesn't name a control takes it back to its default)
export function styleOf(key) {
  const x = { ...Object.fromEntries(LASH_CONTROLS.map(c => [c[0], LASH_DEFAULTS[c[0]]])), ...(LASH_STYLES[key] || {}) };
  delete x.label; delete x.group; return x;
}
export const BROW_SHAPES = {   // presets for the brow's own settings
  natural: { label: "Natural", width: 1, arch: 0, tail: 1, soft: 0.5, count: 1100 },
  straight: { label: "Straight (Korean)", width: 1.05, arch: -0.85, tail: 1.05, soft: 0.65, count: 1200 },
  arched: { label: "Arched", width: 0.9, arch: 0.7, tail: 1.08, soft: 0.4, count: 1000 },
  thin: { label: "Thin", width: 0.55, arch: 0.3, tail: 1.02, soft: 0.3, count: 600 },
  full: { label: "Full, feathered", width: 1.35, arch: -0.2, tail: 1, soft: 0.75, count: 1700 },
};
// the looks, in hairtex.js's words (the hair shader's colours and highlights): soft, little shine
const look = (root, tip, spec, shine, rim) => ({ root, tip, inner: tip, innerAmount: 0, spec1: spec, spec2: tip, shine, gloss1: 160, gloss2: 40,
  shift1: -0.05, shift2: 0.08, shiftNoise: 0.25, rim, rimAmount: 0.08, rootLength: 0.35, soft: 0 });   // (soft: the hair's soft edges; lashes and brows stay crisp)
export const LOOKS = {
  lash_black: { label: "Black", ...look("#050505", "#141210", "#8f8a85", 0.5, "#2a2826") },
  lash_brown_black: { label: "Brown-black", ...look("#0a0605", "#2a1b14", "#9a8574", 0.45, "#3a2a20") },
  brow_dark_brown: { label: "Dark brown", ...look("#140c08", "#3b2a20", "#a08a78", 0.12, "#3f3128") },
  brow_soft_brown: { label: "Soft brown", ...look("#2a1d15", "#6a5040", "#b8a08c", 0.1, "#6a5444") },
  brow_black: { label: "Black", ...look("#080707", "#1e1b19", "#8a8580", 0.12, "#2e2a27") },
  brow_ash: { label: "Ash", ...look("#2a2622", "#6e665e", "#c8c2bb", 0.1, "#6e665e") },
};
export const ATLAS = makeAtlas({ W: 256, H: 256, clumps: 12, tipTaper: 0.85, minLength: 0.92, seed: 11 });   // twelve clumps, each drawing to a point

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rot = (v, k, a) => add(add(mul(v, Math.cos(a)), mul(cross(k, v), Math.sin(a))), mul(k, dot(k, v) * (1 - Math.cos(a))));   // v turned about the unit axis k

// a polyline by arc length: its point and tangent at t in [0, 1], and O's numbers there (one list for each point of P)
function along(P, O = null) {
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(...sub(P[i], P[i - 1])));
  const T = L[L.length - 1] || 1;
  return t => {
    const d = Math.max(0, Math.min(1, t)) * T; let i = 1; while (i < P.length - 1 && L[i] < d) i++;
    const f = (d - L[i - 1]) / ((L[i] - L[i - 1]) || 1);
    return { p: mix(P[i - 1], P[i], f), t: norm(sub(P[i], P[i - 1])), o: O && O.length === P.length ? O[i - 1].map((x, k) => x + (O[i][k] - x) * f) : null };
  };
}

// the cards: each a strip along its points, as wide as w0 at the root and w1 at the tip, across `across`, facing `n`
function Cards() { return { pos: [], nrm: [], uv: [], tan: [], tint: [], depth: [], idx: [], n: 0, lift: [], rim: [], drop: [], inside: [], gaps: [], longest: [] }; }
function card(G, pts, across, n, w0, w1, u0, u1, tint = [0, 0, 0, 0], depth = 0.03) {
  const base = G.pos.length / 3, m = pts.length;
  for (let k = 0; k < m; k++) {
    const v = k / (m - 1), w = (w0 + (w1 - w0) * v) / 2, a = Array.isArray(across[0]) ? across[k] : across, nn = Array.isArray(n[0]) ? n[k] : n;   // one for all, or one each
    const tg = norm(sub(pts[Math.min(k + 1, m - 1)], pts[Math.max(k - 1, 0)]));
    for (const [s, u] of [[-1, u0], [1, u1]]) {
      G.pos.push(...add(pts[k], mul(a, s * w))); G.nrm.push(...nn); G.uv.push(u, v); G.tan.push(...tg); G.tint.push(...tint); G.depth.push(depth);
    }
    if (k) { const a0 = base + (k - 1) * 2; G.idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
  }
  G.n++;
}
function geometryOf(G) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(G.pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(G.nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(G.uv, 2)); g.setAttribute("aTangent", new THREE.Float32BufferAttribute(G.tan, 3));
  g.setAttribute("aTint", new THREE.Float32BufferAttribute(G.tint, 4)); g.setAttribute("aDepth", new THREE.Float32BufferAttribute(G.depth, 1));
  g.setIndex(G.idx); g.computeBoundingSphere();
  return g;
}
const clumpU = (r, wide = 1) => { const c = Math.floor(r() * ATLAS.clumps), s = wide / ATLAS.clumps; const u = (c + 0.5) / ATLAS.clumps; return [u - s * 0.55, u + s * 0.55]; };

// one eye's lashes: upper (and lower), rooted on the lid's edge
function eyeLashes(G, lid, o, F, U, S, side, seed) {
  const r = rng(seed), outward = side === "L" ? 1 : -1;
  const shut = 1 - Math.max(0, Math.min(1, lid.open ?? 1));             // 0 open (as made), 1 shut
  for (const which of ["upper", "lower"]) {
    const upper = which === "upper", P = lid[which]; if (!P || P.length < 2) continue;
    const n = upper ? o.count : o.lowerCount; if (!n) continue;
    const curve = along(P, lid[which + "Rim"]), lens = [], raw = [];
    // the clumps: a few neighbours each (more with Clumping); the lower lid's thinner. Their roots spread evenly along
    // the lid, or (Spiky clumps) gathered in the middle of each clump's share with a gap to the next, so the clumps read
    // as separate spikes; every other clump shorter (Long and short), as anime lash sets alternate
    const sp = o.spikes ?? 0, vary = o.vary ?? 0, gl = [];
    const size = 2 + Math.round(o.clump * 4), gsz = upper ? size : Math.max(2, Math.round(size * (1 - 0.5 * sp))), groups = Math.ceil(n / gsz);
    for (let g = 0; g < groups; g++) gl.push((1 - vary * 0.42 * (g % 2)) * (1 - vary * 0.12 * r()));
    for (let j = 0; j < n; j++) {
      const g = Math.floor(j / gsz), jg = j - g * gsz, gn = Math.min(gsz, n - g * gsz);
      let t = (g + 0.5) / groups + (1 - 0.72 * sp) / groups * ((jg + 0.15 + 0.7 * r()) / gn - 0.5); t = 0.03 + 0.94 * t;
      const outer = upper ? t : 1 - t;                                      // 0 at the inner corner, 1 at the outer
      const { p: root, t: tg, o: rp } = curve(t);
      const c = lid.centre, radial = norm(sub(sub(root, c), mul(F, dot(sub(root, c), F))));   // away from the eye's middle, in the face's plane
      const axis = norm(cross(F, radial));                                  // along the lid at this root: the lid turns about it
      // the lid's turn: a shutting upper lid swings its lashes down and forward; squash: shorter, curling more
      const turn = upper ? -shut * 1.1 : shut * 0.4;                      // (the axis runs inner to outer on the upper lid, the other way on the lower)
      const base = (upper ? 0.25 + 0.75 * o.lift : 0.15 + 0.25 * o.lift) * 0.9 + (upper ? 0 : (o.lowerDrop ?? 0) * 0.85);   // radians up from straight out (the lower lashes down the skin with Lower lashes down)
      const len = (upper ? o.length : o.lowerLength) / 1000 * S * (0.5 + 0.5 * smooth(0, 0.55, outer)) * (1 + (upper ? o.flare * 0.35 : 0) * smooth(0.55, 1, outer))
                  * (1 + (0.3 * r() - 0.18) * (1 - 0.7 * sp)) * gl[g] * (1 - 0.3 * shut);   // (a spike's lashes nearly one length, to one point)
      const curl = (upper ? 0.35 + 1.25 * o.curl : 0.1 + 0.3 * o.curl) * (1 + 0.6 * shut), flare = (upper ? o.flare * 0.45 : 0.15) * smooth(0.4, 1, outer) * outward;
      // over the rim first, from the line to its front edge, just off its rounded skin (three points); the lash itself
      // from there. Every lash the same number of points, for the clumps: where there's no rim to speak of, small steps forward
      // (as the lid shuts its rim turns down and away, and the skin out from the line is the shut lid's front: the way
      // over the rim fades with the opening, the lashes rooted on the line again by the time it's shut, as they were)
      const rk = smooth(0.3, 0.9, lid.open ?? 1), deep = rp ? rk * Math.hypot(rp[6], rp[7], rp[8]) : 0;
      const pts = [root, ...[0, 1, 2].map(j => deep > 0.0002 * S ? add(root, mul([rp[j * 3], rp[j * 3 + 1], rp[j * 3 + 2]], rk)) : add(root, mul(F, 0.00007 * S * (j + 1))))];
      const m = 5, a0 = pts.length; let q = pts[a0 - 1];
      for (let k = 1; k < m; k++) {
        const a = base + curl * Math.pow(k / (m - 1), 1.4);
        let d = norm(add(mul(F, Math.cos(a)), mul(radial, Math.sin(a))));
        d = norm(add(d, [flare * Math.pow(k / (m - 1), 1.2), 0, 0]));     // out towards the outer corner
        d = rot(d, axis, turn);                                         // the lid's turn about its own line
        q = add(q, mul(d, len / (m - 1))); pts.push(q);
      }
      raw.push({ pts, tg, radial, outer, t, len }); lens.push(len);
      const d = norm(sub(pts[pts.length - 1], pts[a0 - 1])), elev = Math.atan2(dot(d, radial), dot(d, F)) * 180 / Math.PI;   // its elevation, the rim's edge to the tip (degrees)
      if (upper) { G.lift.push(elev); G.rim.push(Math.hypot(...sub(pts[a0 - 1], root)) / (0.001 * S)); }   // and how far over the rim it lies (mm), for the check
      else G.drop.push(elev);
    }
    // clumps: a few neighbours draw together towards their tips (into one point with Spiky clumps)
    const draw = Math.min(0.95, o.clump * 0.8 + 0.2 * sp);
    for (let j0 = 0; j0 < raw.length; j0 += gsz) {
      const grp = raw.slice(j0, j0 + gsz), avg = grp[0].pts.map((_, k) => mul(grp.reduce((s, g) => add(s, g.pts[k]), [0, 0, 0]), 1 / grp.length));
      if (upper && grp.length > 1) {                                        // for the check: the gap to the next clump against the roots' spacing inside one, and its longest lash
        const ts = grp.map(g => g.t), next = raw[j0 + gsz]; G.inside.push((Math.max(...ts) - Math.min(...ts)) / (grp.length - 1));
        if (next) G.gaps.push(next.t - Math.max(...ts)); G.longest.push(Math.max(...grp.map(g => g.len)));
      }
      for (const g of grp) {
        const pts = g.pts.map((p, k) => mix(p, avg[k], draw * Math.pow(k / (g.pts.length - 1), 1.6)));   // the root stays, the tip goes most of the way
        const w0 = (upper ? 0.32 : 0.22) * o.width / 1000 * S * (2.2 + 1.5 * o.clump) * (1 - 0.4 * sp), w1 = w0 * 0.15, [u0, u1] = clumpU(r);   // (a spike's lashes narrower: its strands show, not a wedge)
        const facing = norm(cross(g.tg, sub(pts[pts.length - 1], pts[0])));
        card(G, pts, g.tg, facing, w0, w1, u0, u1);                          // across the lid: seen from the front
        card(G, pts, norm(cross(facing, g.tg)), g.tg, w0 * 0.8, w1, u0, u1); // and crossed: seen from the side
      }
    }
    if (upper && o.line > 0) {                                              // the lash line: a dark band where the lashes grow
      // across the rim from the line, along its rounded skin, as far as the line's setting takes it (or, with no rim,
      // a narrow band up and forward from the line as before); its rows across, along the lid
      const m = 24, rows = [], nn = [];
      for (let k = 0; k <= m; k++) {
        const { p, t: tg, o: rp } = curve(0.02 + 0.96 * k / m), rad = norm(sub(sub(p, lid.centre), mul(F, dot(sub(p, lid.centre), F))));
        const rk = smooth(0.3, 0.9, lid.open ?? 1), deep = rp ? rk * Math.hypot(rp[6], rp[7], rp[8]) : 0, w = (0.25 + 0.8 * o.line) / 1000 * S;
        let row;
        if (deep > 0.0003 * S) {
          const path = [add(p, mul(F, 0.0001 * S)), ...[0, 1, 2].map(j => add(p, mul([rp[j * 3], rp[j * 3 + 1], rp[j * 3 + 2]], rk)))], L = [0];
          for (let j = 1; j < 4; j++) L.push(L[j - 1] + Math.hypot(...sub(path[j], path[j - 1])));
          const reach = Math.min(L[3], Math.max(w, L[3] * (0.35 + 0.65 * o.line)));
          row = [path[0]]; for (let j = 1; j < 4; j++) { if (L[j] <= reach) row.push(path[j]); else { row.push(mix(path[j - 1], path[j], (reach - L[j - 1]) / ((L[j] - L[j - 1]) || 1))); break; } }
          while (row.length < 4) row.push(row[row.length - 1]);
        } else { const acr = norm(add(mul(rad, 0.7), mul(F, 0.7))), q = add(p, mul(F, 0.0003 * S)); row = [-0.3, 0.13, 0.57, 1].map(s => add(q, mul(acr, s * w))); }
        rows.push(row); nn.push(norm(cross(tg, sub(row[3], row[0]))));
      }
      const base = G.pos.length / 3;
      // (the atlas's strands run across it, roots at the line: short lash roots over the rim, not stripes as wide as it)
      for (let k = 0; k <= m; k++) for (let j = 0; j < 4; j++) { G.pos.push(...rows[k][j]); G.nrm.push(...nn[k]); G.uv.push(0.02 + 0.5 * k / m, 0.03 + 0.25 * j / 3); G.tan.push(...norm(sub(rows[k][3], rows[k][0]))); G.tint.push(0, 0, 0, 0); G.depth.push(0.01); }
      for (let k = 0; k < m; k++) for (let j = 0; j < 3; j++) { const a = base + k * 4 + j, b = a + 4; G.idx.push(a, a + 1, b, a + 1, b + 1, b); }
      G.n++;
    }
  }
}

// the brow's fill: a soft see-through strip over the band (its own mesh, vertex colours with alpha): three rows across,
// clear at the top and bottom edges and at both ends, the most in the middle
function powder(P, rows, amount) {
  const base = P.pos.length / 3, m = rows.length - 1;
  for (let k = 0; k <= m; k++) {
    const end = 1 - Math.pow(Math.abs(2 * k / m - 1), 3), { c, a, n } = rows[k];
    for (const [s, w] of [[-1, 0], [0, 1], [1, 0]]) { P.pos.push(...add(c, mul(a, s))); P.nrm.push(...n); P.alpha.push(amount * end * w * 0.85); }
  }
  for (let k = 0; k < m; k++) for (let j = 0; j < 2; j++) { const a0 = base + k * 3 + j; P.idx.push(a0, a0 + 3, a0 + 1, a0 + 1, a0 + 3, a0 + 4); }
}

// one brow: hairs lying flat on the skin in the band between its two rows, the front ones up, the rest swept out
function brow(G, rows, o, C, U, S, seed, P) {
  const r = rng(seed), top = along(rows.upper), bot = along(rows.lower);
  const end0 = mix(top(0).p, bot(0).p, 0.5), end1 = mix(top(1).p, bot(1).p, 0.5);
  const mid = t => {                                                       // the band's middle and half height at t (0 the front, 1 the tail), shaped
    const tt = t * o.tail, a = top(tt), b = bot(tt); let c = mix(a.p, b.p, 0.5), half = Math.hypot(...sub(a.p, b.p)) / 2 * o.width * 1.3 * (1 - 0.5 * smooth(0.6, 1.05, t));   // MediaPipe's rows sit inside the brow: a little taller
    if (tt > 1) c = add(end1, mul(norm(sub(end1, mix(top(0.9).p, bot(0.9).p, 0.5))), (tt - 1) * Math.hypot(...sub(end1, end0))));   // a longer tail goes on along its line
    const line = mix(end0, end1, Math.min(tt, 1)), dev = sub(c, line);
    c = add(line, mul(dev, 1 + o.arch));                                  // the arch: straighter (-1) or higher (+1) than the face's own
    return { c, half, tg: norm(sub(top(Math.min(tt + 0.02, 1)).p, top(Math.max(tt - 0.02, 0)).p)) };
  };
  if (o.powder > 0 && P) {                                                // the fill: the band itself, a faint tint under the hairs
    const rows = [];
    for (let k = 0; k <= 24; k++) { const { c, half, tg } = mid(0.01 + 0.99 * k / 24), out = norm(sub(c, C)), up = norm(cross(out, tg));
      rows.push({ c: add(c, mul(out, 0.00025 * S)), a: mul(dot(up, U) < 0 ? mul(up, -1) : up, half * 1.05), n: out }); }
    powder(P, rows, o.powder);
  }
  for (let j = 0; j < o.count; j++) {
    let t = r(); t = Math.pow(t, 0.9);
    if (r() > 1 - o.soft * 0.7 * (1 - smooth(0, 0.3, t))) continue;        // the soft front: fewer hairs there
    const { c, half, tg } = mid(t), s = (r() + r()) - 1;                  // -1 the bottom of the band, 1 its top, more in the middle
    const out = norm(sub(c, C)), up = norm(cross(out, tg)), bandUp = dot(up, U) < 0 ? mul(up, -1) : up;
    const root = add(c, mul(bandUp, s * half));
    const n = norm(sub(root, C));                                          // the skin's normal, near enough: away from the head's middle
    const phi = (1 - smooth(0.02, 0.4, t)) * 1.25 + 0.3 - s * 0.35 - 0.25 * smooth(0.7, 1, t);   // the front up, the middle diagonal, the tail along; top and bottom rows lean in
    let d = norm(add(mul(tg, Math.cos(phi)), mul(bandUp, Math.sin(phi))));
    d = norm(sub(d, mul(n, dot(d, n))));
    const len = o.length / 1000 * S * (0.65 + 0.45 * r()) * (1 - 0.3 * (1 - smooth(0, 0.2, t)) * o.soft) * (1 - 0.25 * smooth(0.75, 1, t));
    const lift = 0.00018 * S, pts = [add(root, mul(n, lift)), add(add(root, mul(d, len * 0.5)), mul(n, lift * 1.8)), add(add(root, mul(d, len)), mul(n, lift * 1.2))];
    const fine = 1 - 0.45 * o.soft * (1 - smooth(0, 0.25, t)), w0 = 0.24 / 1000 * S * fine, [u0, u1] = clumpU(r, 0.35);   // one fine hair to a card
    card(G, pts, norm(cross(n, d)), n, w0, w0 * 0.3, u0, u1, [0, 0, 0, 0], 0.03);
  }
}

export function build(ctx, lash, brw) {
  const G = Cards(), H = Cards(), P = { pos: [], nrm: [], alpha: [], idx: [] }, { F, U, C, scale: S } = ctx;
  if (lash.on) for (const side of ["L", "R"]) if (ctx.lids[side]) eyeLashes(G, ctx.lids[side], lash, F, U, S, side, side === "L" ? 101 : 202);
  if (brw.on) for (const side of ["L", "R"]) if (ctx.brows[side]) brow(H, ctx.brows[side], brw, C, U, S, side === "L" ? 303 : 404, P);
  const fill = new THREE.BufferGeometry();
  fill.setAttribute("position", new THREE.Float32BufferAttribute(P.pos, 3)); fill.setAttribute("normal", new THREE.Float32BufferAttribute(P.nrm, 3));
  fill.setAttribute("color", new THREE.Float32BufferAttribute(P.alpha.flatMap(a => [1, 1, 1, a]), 4)); fill.setIndex(P.idx);
  const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0), lift = mean(G.lift), rim = mean(G.rim), drop = mean(G.drop);   // the upper lashes' mean elevation (degrees), their way over the rim (mm), the lower lashes' elevation
  const spike = mean(G.gaps) / (mean(G.inside) || 1);                       // the gap between clumps against the roots' spacing inside one: about 1 spread evenly, far more as spikes
  const odd = G.longest.filter((_, i) => i % 2), even = G.longest.filter((_, i) => !(i % 2)), alt = mean(odd) / (mean(even) || 1);   // every other clump's length against its neighbours'
  return { lashes: geometryOf(G), brows: geometryOf(H), fill, cards: { lashes: G.n, brows: H.n, lift, rim, drop, spike, alt } };
}

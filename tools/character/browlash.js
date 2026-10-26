// Brows and lashes (Character Studio, the Face tab): cards for the salon's hair shader (hairshader.js) and strand atlases
// of their own (the brows hairtex.js's makeAtlas: clumps that draw together into points; the lashes lashAtlas, one fine
// strand to a cell: every lash is one hair). Our own code. No physics: the lashes are rooted on the lid's edge (the eye's smoothed opening, index.html's outline()), lie
// along the lid's rim to its front edge (the line runs along the rim's back, where it meets the eye; lashes grow from
// its front: rooted on the line and sent straight out, they ran under the rim's skin for 3 mm and a band of bare skin
// showed between the eye and the lashes), turn with the lid as it rotates about the eye and squash as it shuts; the
// brows lie flat on the skin between MediaPipe's two brow rows, so they ride every brow expression. Plain arrays in, a
// BufferGeometry out.
//
//   build({ lids, brows, F, U, C, scale }, st) -> { geometry, cards }
//     lids: { L: { upper: [[x,y,z]...] inner -> outer, lower: [...] outer -> inner, upperRim, lowerRim, centre, eye, open, open0 }, R: {...} }
//       open: 1 as made, 0 shut; upperRim, lowerRim: from each point of the line, three points over the rim to its front
//       edge, just off its skin (nine numbers, offsets from the line's point: index.html's rimOf; the upper's a fourth,
//       the skin 0.7 mm up the lid, for the lash line); eye: the eyeball's middle; open0: the same lids as they are open
//     brows: { L: { upper: [[x,y,z]...] medial -> lateral, lower: [...] }, R: {...} }
//     F, U: the face's forward and up; C: the head's middle (the skin's normals point away from it); scale: the body's
import * as THREE from "three";
import { makeAtlas } from "./hairtex.js";
import { rng } from "./salonlib.js";

export const LASH_DEFAULTS = { on: false, count: 110, length: 8.5, curl: 0.55, lift: 0.45, clump: 0.3, spikes: 0, vary: 0.15, under: 0.35, cross: 0.35, width: 0.5, flare: 0.5,
  lower: true, lowerCount: 36, lowerLength: 4, lowerDrop: 0.25, line: 0.4, look: "lash_black" };
export const BROW_DEFAULTS = { on: false, shape: "natural", count: 1100, length: 6.5, width: 1, arch: 0, tail: 1, soft: 0.5, powder: 0.45, look: "brow_dark_brown" };
export const LASH_CONTROLS = [   // [key, label, lo, hi, step, help]
  ["count", "Upper lashes", 30, 140, 1, "Upper lashes on each eye."], ["length", "Length (mm)", 4, 14, 0.1, "The longest upper lash."],
  ["curl", "Curl", 0, 1, 0.01, "How far each lash curls up towards its tip."], ["lift", "Lift", 0, 1, 0.01, "How high they leave the lid: 0 straight out, 1 swept up."],
  ["clump", "Clumping", 0, 1, 0.01, "Hairs in clusters drawn together into points: 0 small clusters, barely drawn in (natural), 1 clusters of eight to a point (mascara, anime)."],
  ["spikes", "Spiky clumps", 0, 1, 0.01, "Each clump's roots gathered, with a gap to the next: separate spikes along the lid (anime lash sets). 0 the roots spread evenly."],
  ["vary", "Long and short", 0, 1, 0.01, "Every third cluster the longest and the rest shorter, the way anime lash sets mix long spikes with short ones."],
  ["under", "Under-lashes", 0, 1, 0.01, "Short hairs along the whole lid under the clusters: the dense fringe between the spikes, so the lid never looks bald."],
  ["cross", "Criss-cross", 0, 1, 0.01, "Each cluster leaning its own way along the lid, so neighbours cross (wispy); 0 all combed one way."],
  ["width", "Thickness", 0.2, 1.2, 0.01, "Each hair's thickness: about a tenth of a millimetre at 0.5."], ["flare", "Outer flare", 0, 1, 0.01, "Longer and swept out at the outer corner (a cat eye)."],
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
  natural: { label: "Natural", group: "Natural", count: 110, length: 8.5, curl: 0.5, lift: 0.4, clump: 0.15, spikes: 0, vary: 0.15, under: 0.35, cross: 0.35, width: 0.45, flare: 0.3, lowerCount: 36, lowerLength: 4, lowerDrop: 0.25, line: 0.25 },
  defined: { label: "Defined (mascara)", group: "Natural", count: 110, length: 10, curl: 0.6, lift: 0.5, clump: 0.6, spikes: 0.3, vary: 0.3, under: 0.4, cross: 0.4, width: 0.6, flare: 0.55, lowerCount: 40, lowerLength: 5, lowerDrop: 0.35, line: 0.6 },
  short: { label: "Short, straight", group: "Natural", count: 120, length: 6, curl: 0.2, lift: 0.25, clump: 0.1, spikes: 0, vary: 0.1, under: 0.3, cross: 0.25, width: 0.4, flare: 0.15, lowerCount: 28, lowerLength: 2.5, lowerDrop: 0.2, line: 0.15 },
  doll: { label: "Doll (full, dense)", group: "Dramatic", count: 160, length: 11.5, curl: 0.75, lift: 0.6, clump: 0.7, spikes: 0.3, vary: 0.3, under: 0.7, cross: 0.3, width: 0.6, flare: 0.8, lowerCount: 48, lowerLength: 5.5, lowerDrop: 0.5, line: 0.9 },
  // after the user's references (DECISIONS 2026-10-26, night): an anime lash set (a photo: clusters of fine hairs drawn
  // to points with gaps between them, long ones among short, the outer ones longest and swept out, short hairs under
  // them along the whole lid, neighbours crossing; the lower lashes in small clusters pointing down the skin), drawn
  // eyes (long wisps, a bold lash line) and a doll's eye ringed in short spikes
  anime: { label: "Anime lash set (spikes)", group: "Anime, after the references", count: 150, length: 13, curl: 0.6, lift: 0.6, clump: 0.95, spikes: 0.85, vary: 0.8, under: 0.7, cross: 0.6, width: 0.7, flare: 0.75,
           lowerCount: 42, lowerLength: 5.5, lowerDrop: 0.75, line: 0.6 },
  drawn: { label: "Drawn (manhwa, long wisps)", group: "Anime, after the references", count: 90, length: 13.5, curl: 0.7, lift: 0.7, clump: 1, spikes: 1, vary: 0.5, under: 0.3, cross: 0.4, width: 0.75, flare: 0.9,
           lowerCount: 24, lowerLength: 6, lowerDrop: 0.8, line: 1 },
  animeDoll: { label: "Anime doll (short spikes all round)", group: "Anime, after the references", count: 120, length: 8, curl: 0.45, lift: 0.5, clump: 0.9, spikes: 0.9, vary: 0.3, under: 0.5, cross: 0.4, width: 0.6, flare: 0.3,
               lowerCount: 44, lowerLength: 4.5, lowerDrop: 0.85, line: 0.5 },
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
  lash_black: { label: "Black", ...look("#050505", "#0e0d0c", "#8f8a85", 0.3, "#2a2826") },
  lash_brown_black: { label: "Brown-black", ...look("#0a0605", "#221610", "#9a8574", 0.3, "#3a2a20") },
  brow_dark_brown: { label: "Dark brown", ...look("#140c08", "#3b2a20", "#a08a78", 0.12, "#3f3128") },
  brow_soft_brown: { label: "Soft brown", ...look("#2a1d15", "#6a5040", "#b8a08c", 0.1, "#6a5444") },
  brow_black: { label: "Black", ...look("#080707", "#1e1b19", "#8a8580", 0.12, "#2e2a27") },
  brow_ash: { label: "Ash", ...look("#2a2622", "#6e665e", "#c8c2bb", 0.1, "#6e665e") },
};
export const ATLAS = makeAtlas({ W: 256, H: 256, clumps: 12, tipTaper: 0.85, minLength: 0.92, seed: 11 });   // twelve clumps, each drawing to a point (the brows)
// the lash atlas: one strand to a cell, straight down its middle, a soft core thinning to a point at the tip (a hair's
// card shows one cell across its width, so the hair is as thin as the card's soft core); the same channels as the salon's
export function lashAtlas(o = {}) {
  const W = o.W ?? 256, H = o.H ?? 256, cells = o.cells ?? 32, cw = W / cells, r = rng(o.seed ?? 5), data = new Uint8Array(W * H * 4);
  for (let c = 0; c < cells; c++) {
    const xc = (c + 0.5) * cw + (r() - 0.5) * 0.6, bright = 0.15 + 0.35 * r(), id = r(), cid = 0.3 + 0.4 * r(), len = 0.95 + 0.05 * r();
    for (let y = 0; y < H; y++) {
      const v = y / H; if (v > len) break;
      const sg = 1.45 * (1 - 0.55 * v / len), a0 = 1 - 0.4 * smooth(0.8 * len, len, v);   // the core's width (px) thinning to the tip, which fades out
      for (let x = Math.floor(xc - 4); x <= Math.ceil(xc + 4); x++) {
        if (x < 0 || x >= W) continue;
        const d = (x + 0.5 - xc) / sg, a = a0 * Math.exp(-d * d), i = (y * W + x) * 4;
        data[i] = Math.round(bright * 255); data[i + 1] = Math.round(id * 255); data[i + 2] = Math.round(cid * 255); data[i + 3] = Math.round(Math.min(1, a) * 255);
      }
    }
  }
  return { W, H, data, strands: cells, clumps: cells, cells };
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rot = (v, k, a) => add(add(mul(v, Math.cos(a)), mul(cross3(k, v), Math.sin(a))), mul(k, dot(k, v) * (1 - Math.cos(a))));   // v turned about the unit axis k
export const LASH_ATLAS = lashAtlas();                 // (after the helpers it uses)
export const RIM_UP = 2.5;   // mm: how far up the lid the open rim's fourth point is taken (index.html's rimOf); the lash line and the painted liner scale it to their own widths
// a root on a lid's line now against the same root with the eye open: how far it has swung round the eye's middle c0
// since, about the lid's tangent there (ang0), and the open lid's rim path at it (rp0: offsets, three or four points)
// turned with it. What the blink does to a lash's frame: its rim swings with the margin, its hairs with it (eyeLashes)
function swingCore(root, root0, tg, rp0, c0) {
  const vo = sub(root0, c0), vn = sub(root, c0), po = sub(vo, mul(tg, dot(vo, tg))), pn = sub(vn, mul(tg, dot(vn, tg)));
  const ang0 = Math.atan2(dot(cross3(po, pn), tg), dot(po, pn)), rim = [];
  if (rp0) for (let j = 0; j * 3 + 2 < rp0.length; j++) rim.push(rot([rp0[j * 3], rp0[j * 3 + 1], rp0[j * 3 + 2]], tg, ang0));
  return { root, root0, tg, ang0, rim, vo };
}
// the same at every point of a lid's line P (its line P0 and rim R0 with the eye open, the eye's middle c0): the painted
// liner's lines (index.html's lidFront) follow the margin the way the lashes do
export function lidFrame(P, P0, R0, c0) {
  const n = P.length;
  return P.map((p, i) => swingCore(p, P0[i], norm(sub(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)])), R0 ? R0[i] : null, c0));
}
// the lash line's atlas: the lashes' roots as a dense fringe, opaque along the eye's edge (v 0) and ragged where it ends
// up the lid (v 1): strands up from the edge, each its own length, over a solid base; u wraps along the lid
export function lineAtlas(o = {}) {
  const W = o.W ?? 256, H = o.H ?? 64, r = rng(o.seed ?? 9), A = new Float32Array(W * H), data = new Uint8Array(W * H * 4);
  for (let st = 0; st < 120; st++) {
    const x0 = r() * W, lean = (r() - 0.5) * 0.5, len = 0.5 + 0.5 * r(), sg = 1.3 + 0.9 * r();
    for (let y = 0; y < H; y++) {
      const v = y / H; if (v > len) break;
      const xc = x0 + lean * y, a0 = 1 - smooth(0.6 * len, len, v);
      for (let x = Math.floor(xc - 4); x <= Math.ceil(xc + 4); x++) { const d = (x + 0.5 - xc) / sg, a = a0 * Math.exp(-d * d), i = y * W + ((x % W) + W) % W; A[i] = A[i] + a * (1 - A[i]); }
    }
  }
  for (let y = 0; y < H; y++) {
    const v = y / H, solid = 1 - smooth(0.3, 0.7, v);
    for (let x = 0; x < W; x++) { const i = y * W + x, q = i * 4; data[q] = 50 + Math.round(60 * r()); data[q + 1] = Math.round(255 * r()); data[q + 2] = 110 + Math.round(60 * r()); data[q + 3] = Math.round(Math.min(1, Math.max(A[i], solid)) * 255); }
  }
  return { W, H, data, strands: 120, clumps: 1 };
}
export const LINE_ATLAS = lineAtlas();

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
function Cards() { return { pos: [], nrm: [], uv: [], tan: [], tint: [], depth: [], idx: [], n: 0, lift: [], rim: [], drop: [], inside: [], gaps: [], glen: [], toward: [] }; }
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

// one eye's lashes: fine hairs rooted on the lid's edge, lying over the rim and lifting from its front edge (after the
// user's reference, an anime lash set: DECISIONS 2026-10-26, night). The upper lid: clusters of a few hairs each that
// draw together into a point (anime lash sets, mascara), their roots spread along the lid or gathered with a gap to the
// next cluster (Spiky clumps), every third cluster the longest and the rest shorter (Long and short), each cluster
// leaning its own way along the lid so they cross (Criss-cross), and short hairs under them along the whole lid
// (Under-lashes); the lower lid: small clusters pointing out from the lid, or down the skin (Lower lashes down). Every
// hair is a thin card (two, crossed) with one strand of the lash atlas on it, tapering to a point.
// A blink: each hair's frame is set on the lid as it is open (lid.open0: the lid's line, its rim and the eye's middle
// then) and turned about the lid's own line by how far its root has swung round the eye's middle since (a bendy bone
// a lash: the rim it lies over and its whole curve turn with the lid), so shut, the lashes point at the viewer and
// down, as a closed eye's do, instead of folding into the lower lid; the lash line (B) turns the same way.
function eyeLashes(G, B, lid, o, F, U, S, side, seed) {
  const r = rng(seed), outward = side === "L" ? 1 : -1, mm = 0.001 * S, O = lid.open0 || lid, c0 = O.eye || O.centre;   // (the lids swing round the eyeball's middle, a centimetre behind the opening's)
  const sp = o.spikes ?? 0, vary = o.vary ?? 0, under = o.under ?? 0, cross = o.cross ?? 0;
  for (const which of ["upper", "lower"]) {
    const upper = which === "upper", P = lid[which]; if (!P || P.length < 2 || !O[which] || O[which].length < 2) continue;
    const n = upper ? o.count : o.lowerCount; if (!n) continue;
    const curve = along(P), curve0 = along(O[which], O[which + "Rim"]);   // the line now; the line and its rim path with the eye open
    // at t along the lid: the root now, its root with the eye open and the rim path there, the lid's tangent, and the
    // lid's turn since (the root's swing round the eye's middle, about the tangent): what was made open is turned by it
    const swing = t => { const { p: root, t: tg } = curve(t), { p: root0, o: rp0 } = curve0(t); return swingCore(root, root0, tg, rp0, c0); };
    // the lashes themselves also tip forward and down as the lid shuts, more than the margin's travel round the eye says
    // (MHR's blink brings the lids together halfway, where a real lid comes all the way down): a droop with the shutting,
    // the way the lid's middle swings, on the hairs' direction only (the rim they grow from swings with the margin), so a
    // shut eye's lashes point at the viewer and a little down, as a closed eye's do, from the upper lid's own edge
    const droop = upper ? 0.45 * (1 - Math.max(0, Math.min(1, lid.open ?? 1))) * Math.sign(swing(0.5).ang0 || -1) : 0;
    const frame = t => { const w = swing(t); return { root: w.root, root0: w.root0, tg: w.tg, ang: w.ang0 + droop, rim: w.rim, vo: w.vo }; };
    // the hairs to make: where on the lid (t), its length as a share of the longest, its lean along the lid (toward the
    // outer corner), its cluster. Clusters of a few hairs (more with Clumping; the lower lid's of one to three)
    const per = upper ? 3 + Math.round(o.clump * 5) : 1 + Math.round(o.clump * 2), groups = Math.max(1, Math.round(n / per)), hairs = [], gl = [], glean = [];
    for (let g = 0; g < groups; g++) {
      const rk = r();
      gl.push(g % 3 === 0 ? 1 - vary * 0.1 * rk : g % 3 === 1 ? 1 - vary * (0.15 + 0.2 * rk) : 1 - vary * (0.3 + 0.35 * rk));   // long, medium and short clusters in turn, by Long and short
      glean.push((r() - 0.5) * 0.7 * cross);                                       // its lean along the lid (radians): neighbours cross
    }
    for (let g = 0; g < groups; g++) {
      const tc = (g + 0.5) / groups, span = (1 - 0.7 * sp) / groups, gn = g === groups - 1 ? n - g * per : per;   // the cluster's roots over its share, or gathered (spikes)
      for (let j = 0; j < gn; j++) hairs.push({ t: tc + span * ((j + 0.15 + 0.7 * r()) / gn - 0.5), len: gl[g] * (0.92 + 0.08 * r()), lean: glean[g] + (r() - 0.5) * 0.12, g });
      if (upper) G.glen.push(gl[g]);
    }
    if (upper && under > 0) {                                              // the under-lashes: short hairs along the whole lid, under the clusters
      const nu = Math.round(n * under * 0.9);
      for (let j = 0; j < nu; j++) hairs.push({ t: (j + 0.1 + 0.8 * r()) / nu, len: 0.3 + 0.25 * r(), lean: (r() - 0.5) * 0.4 * cross, g: -1 });
    }
    const raw = [], m = 6;                                                 // each hair: the root, three points over the rim, then m points of the hair itself
    for (const h of hairs) {
      const t = 0.03 + 0.94 * Math.max(0, Math.min(1, h.t)), outer = upper ? t : 1 - t;   // 0 at the inner corner, 1 at the outer
      const { root, tg, ang, rim, vo } = frame(t);
      const radial0 = norm(sub(vo, mul(F, dot(vo, F))));                   // away from the eye's middle, in the face's plane, with the eye open
      const radial = upper ? norm(add(radial0, mul(U, 0.7 * smooth(0.5, 1, outer)))) : radial0;   // (the upper lid's outer lashes leave it upward, not sideways)
      const base = (upper ? 0.25 + 0.75 * o.lift : 0.15 + 0.25 * o.lift) * 0.9 + (upper ? 0 : (o.lowerDrop ?? 0) * 0.85);   // radians up from straight out
      const env = upper ? (0.5 + 0.5 * smooth(0, 0.55, outer)) * (1 + o.flare * 0.35 * smooth(0.55, 1, outer))   // longer toward the outer corner (and the flare)
                        : (0.55 + 0.45 * smooth(0.1, 0.6, outer)) * (1 - 0.25 * smooth(0.85, 1, outer));
      const len = (upper ? o.length : o.lowerLength) * mm * env * h.len;
      const curl = upper ? 0.35 + 1.25 * o.curl : 0.1 + 0.3 * o.curl, flare = (upper ? o.flare * 0.45 : 0.15) * smooth(0.4, 1, outer) * outward;
      // over the rim first, from the line to its front edge, just off its rounded skin (three points, the open lid's turned
      // with it); the hair itself from there. Without a rim, small steps forward
      const pts = [root, ...[0, 1, 2].map(j => rim[j] && Math.hypot(...rim[j]) > 0.05 * mm ? add(root, rim[j]) : add(root, mul(F, 0.07 * mm * (j + 1))))];   // (the rim as it is open, swung with the margin)
      const a0 = pts.length; let q = pts[a0 - 1];
      for (let k = 1; k <= m; k++) {
        const a = base + curl * Math.pow(k / m, 1.4);
        let d = norm(add(mul(F, Math.cos(a)), mul(radial, Math.sin(a))));
        d = norm(add(add(d, [flare * Math.pow(k / m, 1.2), 0, 0]), mul(U, Math.abs(flare) * 0.6 * Math.pow(k / m, 1.2))));   // out towards the outer corner, and up
        d = norm(add(d, mul(tg, h.lean * (upper ? 1 : -1))));              // its lean along the lid
        d = rot(d, tg, ang);                                                // turned with the lid
        q = add(q, mul(d, len / m)); pts.push(q);
      }
      raw.push({ pts, tg, t, len, g: h.g });
      const d = norm(sub(pts[pts.length - 1], pts[a0 - 1])), elev = Math.atan2(dot(d, U), dot(d, F)) * 180 / Math.PI;   // its elevation, the rim's edge to the tip (degrees up from straight out)
      if (upper) { if (h.g >= 0) { G.lift.push(elev); G.rim.push(Math.hypot(...sub(pts[a0 - 1], root)) / mm); G.toward.push(dot(d, F)); } }   // how far over the rim it lies (mm) and how much it points at the viewer, for the check
      else G.drop.push(Math.atan2(-dot(d, U), dot(d, F)) * 180 / Math.PI);
    }
    // the clusters draw together towards their tips (into one point with Spiky clumps); for the check, the gap to the next
    // cluster against the roots' spacing inside one
    const draw = Math.min(0.95, o.clump * 0.85 + 0.1 * sp), byGroup = new Map();
    for (const h of raw) if (h.g >= 0) { if (!byGroup.has(h.g)) byGroup.set(h.g, []); byGroup.get(h.g).push(h); }
    for (const [g, grp] of byGroup) {
      if (grp.length < 2) continue;
      const avg = grp[0].pts.map((_, k) => mul(grp.reduce((s, h) => add(s, h.pts[k]), [0, 0, 0]), 1 / grp.length));
      for (const h of grp) h.pts = h.pts.map((p, k) => mix(p, avg[k], draw * Math.pow(k / (h.pts.length - 1), 1.6)));   // the root stays, the tip goes most of the way
      if (upper) { const ts = grp.map(h => h.t), next = byGroup.get(g + 1); G.inside.push((Math.max(...ts) - Math.min(...ts)) / (grp.length - 1)); if (next) G.gaps.push(Math.min(...next.map(h => h.t)) - Math.max(...ts)); }
    }
    // the cards: one strand of the lash atlas each (its cell across the card), thin, tapering to a point; crossed with a
    // second at right angles to it, so the hair shows from the side and from above too
    for (const h of raw) {
      const hw = 0.22 * o.width * mm * (upper ? 1 : 0.8) * (h.g < 0 ? 0.85 : 1), w0 = hw * 3.6, w1 = w0 * 0.5;   // the hair itself about a quarter of the card's width (the strand's soft core)
      const cell = Math.floor(r() * LASH_ATLAS.cells), u0 = cell / LASH_ATLAS.cells, u1 = (cell + 1) / LASH_ATLAS.cells;
      const facing = norm(cross3(h.tg, sub(h.pts[h.pts.length - 1], h.pts[0])));
      card(G, h.pts, h.tg, facing, w0, w1, u0, u1);                          // across the lid: seen from the front
      card(G, h.pts, facing, h.tg, w0 * 0.8, w1, u0, u1);                     // and across that: seen from the side
    }
    if (upper && o.line > 0) {                                              // the lash line: the lashes' roots as a dense dark fringe (lineAtlas) over the whole rim, from the
      // eye's edge to the lid's front edge and on up the lid's skin as far as Lash line takes it (its fourth rim point, the
      // skin 0.7 mm up), turned with the lid; its rows across, along the lid; no skin shows between the roots
      const mrow = 32, rows = [], nn = [];
      for (let k = 0; k <= mrow; k++) {
        const { root, tg, rim } = frame(0.02 + 0.96 * k / mrow);
        let row;
        if (rim[2] && Math.hypot(...rim[2]) > 0.3 * mm) {
          const front = add(root, rim[2]), top = rim[3] ? add(root, rim[3]) : add(front, mul(U, RIM_UP * mm));   // (the fourth rim point: RIM_UP mm up the lid)
          row = [add(root, mul(F, 0.1 * mm)), add(root, rim[0]), add(root, rim[1]), front, mix(front, top, 0.7 * o.line / RIM_UP)];   // up to 0.7 mm up the lid
        } else {                                                            // no rim to speak of: a narrow band up and forward from the line
          const rad = norm(sub(sub(root, c0), mul(F, dot(sub(root, c0), F)))), acr = norm(add(mul(rad, 0.7), mul(F, 0.7))), q = add(root, mul(F, 0.3 * mm)), w = (0.25 + 0.8 * o.line) * mm;
          row = [-0.3, 0.1, 0.4, 0.7, 1].map(s => add(q, mul(acr, s * w)));
        }
        rows.push(row); nn.push(norm(cross3(tg, sub(row[4], row[0]))));
      }
      const base = B.pos.length / 3;
      for (let k = 0; k <= mrow; k++) for (let j = 0; j < 5; j++) { B.pos.push(...rows[k][j]); B.nrm.push(...nn[k]); B.uv.push(8 * k / mrow, j / 4); B.tan.push(...norm(sub(rows[k][4], rows[k][0]))); B.tint.push(0, 0, 0, 0); B.depth.push(0.01); }
      for (let k = 0; k < mrow; k++) for (let j = 0; j < 4; j++) { const a = base + k * 5 + j, b = a + 5; B.idx.push(a, a + 1, b, a + 1, b + 1, b); }
      B.n++;
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
    for (let k = 0; k <= 24; k++) { const { c, half, tg } = mid(0.01 + 0.99 * k / 24), out = norm(sub(c, C)), up = norm(cross3(out, tg));
      rows.push({ c: add(c, mul(out, 0.00025 * S)), a: mul(dot(up, U) < 0 ? mul(up, -1) : up, half * 1.05), n: out }); }
    powder(P, rows, o.powder);
  }
  for (let j = 0; j < o.count; j++) {
    let t = r(); t = Math.pow(t, 0.9);
    if (r() > 1 - o.soft * 0.7 * (1 - smooth(0, 0.3, t))) continue;        // the soft front: fewer hairs there
    const { c, half, tg } = mid(t), s = (r() + r()) - 1;                  // -1 the bottom of the band, 1 its top, more in the middle
    const out = norm(sub(c, C)), up = norm(cross3(out, tg)), bandUp = dot(up, U) < 0 ? mul(up, -1) : up;
    const root = add(c, mul(bandUp, s * half));
    const n = norm(sub(root, C));                                          // the skin's normal, near enough: away from the head's middle
    const phi = (1 - smooth(0.02, 0.4, t)) * 1.25 + 0.3 - s * 0.35 - 0.25 * smooth(0.7, 1, t);   // the front up, the middle diagonal, the tail along; top and bottom rows lean in
    let d = norm(add(mul(tg, Math.cos(phi)), mul(bandUp, Math.sin(phi))));
    d = norm(sub(d, mul(n, dot(d, n))));
    const len = o.length / 1000 * S * (0.65 + 0.45 * r()) * (1 - 0.3 * (1 - smooth(0, 0.2, t)) * o.soft) * (1 - 0.25 * smooth(0.75, 1, t));
    const lift = 0.00018 * S, pts = [add(root, mul(n, lift)), add(add(root, mul(d, len * 0.5)), mul(n, lift * 1.8)), add(add(root, mul(d, len)), mul(n, lift * 1.2))];
    const fine = 1 - 0.45 * o.soft * (1 - smooth(0, 0.25, t)), w0 = 0.24 / 1000 * S * fine, [u0, u1] = clumpU(r, 0.35);   // one fine hair to a card
    card(G, pts, norm(cross3(n, d)), n, w0, w0 * 0.3, u0, u1, [0, 0, 0, 0], 0.03);
  }
}

export function build(ctx, lash, brw) {
  const G = Cards(), B = Cards(), H = Cards(), P = { pos: [], nrm: [], alpha: [], idx: [] }, { F, U, C, scale: S } = ctx;
  if (lash.on) for (const side of ["L", "R"]) if (ctx.lids[side]) eyeLashes(G, B, ctx.lids[side], lash, F, U, S, side, side === "L" ? 101 : 202);
  if (brw.on) for (const side of ["L", "R"]) if (ctx.brows[side]) brow(H, ctx.brows[side], brw, C, U, S, side === "L" ? 303 : 404, P);
  const fill = new THREE.BufferGeometry();
  fill.setAttribute("position", new THREE.Float32BufferAttribute(P.pos, 3)); fill.setAttribute("normal", new THREE.Float32BufferAttribute(P.nrm, 3));
  fill.setAttribute("color", new THREE.Float32BufferAttribute(P.alpha.flatMap(a => [1, 1, 1, a]), 4)); fill.setIndex(P.idx);
  const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0), lift = mean(G.lift), rim = mean(G.rim), drop = mean(G.drop);   // the upper lashes' mean elevation (degrees), their way over the rim (mm), the lower lashes' elevation
  const spike = mean(G.gaps) / (mean(G.inside) || 1);                       // the gap between clumps against the roots' spacing inside one: about 1 spread evenly, far more as spikes
  const gm = mean(G.glen) || 1, vary = Math.sqrt(mean(G.glen.map(x => (x - gm) * (x - gm)))) / gm;   // how much the clusters' lengths differ (their spread over their mean)
  const toward = mean(G.toward);                                             // how much the upper lashes point at the viewer (1 straight at them)
  return { lashes: geometryOf(G), line: geometryOf(B), brows: geometryOf(H), fill, cards: { lashes: G.n, line: B.n, brows: H.n, lift, rim, drop, spike, vary, toward } };
}

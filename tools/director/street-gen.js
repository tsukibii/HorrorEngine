// The street builder's generator (docs/STREET_BUILDER.md): a street (its roads, buildings, things and fences) built
// from its numbers as low-poly geometry, a material slot per surface and UVs in metres, so a PBR set off the shelf
// keeps its real size on anything. One source for the page (street.js, through street3.js) and node (the check, the
// .glb): no DOM, no three.js. Story space: x east, y north, z up, metres. A piece is made in its own space (x across
// its front, the FRONT toward -y, z up from its base, as the kit's) and turned (`turn`, degrees anticlockwise) and set
// down at `at`; a road and a fence run from `from` to `to`.
export const FORMAT = 1;

// ---- material slots: [colour, roughness, metalness, flags]. Flags: e lit (glows at dusk and night), a cut out (its
// pattern is a picture made in code; a PBR set on it keeps the cut), t patterned in code (a PBR set replaces it).
// A street's `look` (or a piece's) puts a colour or a set from the shelf (`pbr/<name>`) on any slot.
export const SLOTS = {
  wall: ["#cfcac1", 0.9], wall2: ["#8e8a83", 0.9], trim: ["#e2dfd8", 0.75], concrete: ["#9b9993", 0.92], plaster: ["#e8e1d2", 0.95],
  frame: ["#3a3c40", 0.5, 0.4], glass: ["#262e38", 0.12, 0.2], lit: ["#ffbf72", 0.4, 0, "e"], lit_cool: ["#dfe9fb", 0.4, 0, "e"],
  shop: ["#ffb27e", 0.3, 0, "e"], lobby: ["#efe6d2", 0.3, 0, "e"], door: ["#4c4038", 0.6, 0.2], shutter: ["#9ea4aa", 0.45, 0.55, "t"],
  shutter_box: ["#8d9399", 0.5, 0.5], dark: ["#121214", 1], roof: ["#3d4046", 0.7], roof_flat: ["#7c7a75", 0.95],
  tiles: ["#3f434a", 0.55, 0.1, "t"], rail: ["#5c6066", 0.5, 0.6], bars: ["#5c6066", 0.5, 0.6, "a"],
  wood: ["#5b412d", 0.75], wood_dark: ["#2f231a", 0.8], lattice: ["#4c3526", 0.8, 0, "a"], paper: ["#f2d9a6", 0.9, 0, "e"],
  awning: ["#7d2f2a", 0.9], metal: ["#899096", 0.45, 0.65], pipe: ["#a3a5a7", 0.55, 0.3], ac: ["#e2e0db", 0.6], fan: ["#2b2d31", 0.8, 0, "t"],
  tank: ["#d7dbdf", 0.5], glassblock: ["#b8cfd6", 0.25, 0, "t"], grime: ["#6f6c66", 0.95],
  asphalt: ["#2a3033", 0.95], plinth: ["#6c6862", 0.95], inside: ["#4b4641", 1], inside_floor: ["#5a4a3a", 1], pavement: ["#7a766f", 0.9, 0, "t"], kerb: ["#9b978f", 0.85], paint: ["#e9e7e0", 0.7], paint_y: ["#e2a33a", 0.7],
  ground: ["#38393b", 1], gravel: ["#6d6a64", 1],
  pole: ["#b3b0a9", 0.85], steel: ["#5f656b", 0.45, 0.7], lamp: ["#fff0cf", 0.4, 0, "e"], lamp_cool: ["#eef4ff", 0.4, 0, "e"], wire: ["#18181a", 0.8],
  hazard: ["#e0b42c", 0.6, 0, "t"], chainlink: ["#8c949b", 0.5, 0.6, "a"], boards: ["#7b5b3f", 0.8, 0, "a"], panel: ["#c6cacd", 0.5, 0.4, "t"],
  blocks: ["#a6a39c", 0.9, 0, "t"], bamboo: ["#a99a60", 0.7, 0, "a"], post: ["#6a6e73", 0.5, 0.6], grate: ["#3a3c3f", 0.6, 0.6, "a"],
  alu: ["#b9bdc1", 0.35, 0.8], gate_blue: ["#3f8ccc", 0.45, 0.3], steel_sash: ["#5d615d", 0.5, 0.4], glass_frost: ["#cfd6d4", 0.45, 0.05], glass_wire: ["#3a4448", 0.12, 0.2],
  curtain: ["#e6d9b4", 0.95], ring: ["#8cc6dc", 0.45], foliage: ["#6b8a42", 0.9], bark: ["#4a3f35", 0.95],
  red: ["#c3312a", 0.5], white: ["#efeeea", 0.6], black: ["#1e1e20", 0.6], yellow: ["#e3b331", 0.5], blue: ["#2c5ea8", 0.5], green: ["#3e6b46", 0.6],
  orange: ["#e0782c", 0.5], chrome: ["#c9cdd1", 0.15, 0.9], iron: ["#2f3033", 0.7, 0.5], rubber: ["#151515", 0.9],
  skin: ["#c99b7b", 0.7], cloth: ["#474c57", 0.9], cloth2: ["#2a2b30", 0.9], hair: ["#1b1714", 0.8],
  vend: ["#f0f0ec", 0.5], vend_lit: ["#f3f6ff", 0.4, 0, "e"], car: ["#d8dbde", 0.35, 0.3], car_glass: ["#1d232a", 0.1, 0.3],
  headlight: ["#fff6e2", 0.3, 0, "e"], taillight: ["#ff3b2b", 0.3, 0, "e"], noren: ["#2a3550", 0.9], plant_pot: ["#8a5a3c", 0.8],
};
// a sign's or a road glyph's slot names its picture: "sign:<key>" (the street's signs list), "glyph:<character>",
// "tsign:<kind>" (a traffic sign's face). Their base: what they fall back to with no picture.
export const slotBase = s => SLOTS[s] ? s : s.startsWith("glyph:") ? "paint" : s.startsWith("sign:") || s.startsWith("tsign:") ? "white" : s.startsWith("decal:") ? "decal" : "wall";

// mulberry32, as the kit's: the same seed, the same street on every machine
export function rng(seed) {
  let a = (Math.floor(+seed || 0) >>> 0) ^ 0x9e3779b9;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// what lies on a surface (a fan's grille, a car's glass, a sign's face, a road's paint) keeps this far off it: closer,
// the two fight in the depth buffer at a distance (STREET's clash test holds every piece to it)
export const GAP = 0.01;
const SIDE_IN = 0.006;                                               // a part's sides, in from where they're asked to be
const num = (v, d) => Number.isFinite(+v) && v !== null && v !== "" ? +v : d;
const seedOf = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---- the triangles: {slot: {pos, nrm, uv, idx}}, the kit's shape (kit3.js and kit.glb read it) -------------------
function out() { return { G: {}, signs: [], lights: [] }; }
const buf = (o, s) => o.G[s] || (o.G[s] = { pos: [], nrm: [], uv: [], idx: [] });
// UVs in metres by box projection in the piece's own space: a wall's run along it, its height up; a roof's or a
// floor's x and y. Every face reads the right way round from outside.
function uvAt(p, n) {
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  if (az >= ax && az >= ay) return [p[0], p[1]];
  if (ay >= ax) return [n[1] < 0 ? p[0] : -p[0], p[2]];
  return [n[0] > 0 ? p[1] : -p[1], p[2]];
}
// a flat polygon facing n (its winding turned to face it), convex, its points in order; uv given or in metres
function poly(o, slot, P, n, uv) {
  if (P.length < 3) return;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; cx += (a[1] - b[1]) * (a[2] + b[2]); cy += (a[2] - b[2]) * (a[0] + b[0]); cz += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = Math.hypot(cx, cy, cz); if (l < 1e-10) return;
  if (!n) n = [cx / l, cy / l, cz / l];
  let order = P.map((_, i) => i);
  if (cx * n[0] + cy * n[1] + cz * n[2] < 0) order = order.reverse();
  const g = buf(o, slot), base = g.pos.length / 3;
  for (const i of order) { g.pos.push(P[i][0], P[i][1], P[i][2]); g.nrm.push(n[0], n[1], n[2]); const t = uv ? uv[i] : uvAt(P[i], n); g.uv.push(t[0], t[1]); }
  for (let i = 1; i + 1 < order.length; i++) g.idx.push(base, base + i, base + i + 1);
}
const two = (o, slot, P, n, uv) => { poly(o, slot, P, n, uv); poly(o, slot, P, [-n[0], -n[1], -n[2]], uv); };   // seen from both sides
// an upright box in the piece's space; skip: faces to leave out ("-z" its bottom, "+x" ...)
function box(o, slot, x0, y0, z0, x1, y1, z1, skip = "") {
  if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0]; if (z1 < z0) [z0, z1] = [z1, z0];
  if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4 || z1 - z0 < 1e-4) return;
  const f = (k, P, n) => { if (!skip.includes(k)) poly(o, slot, P, n); };
  f("-x", [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [-1, 0, 0]);
  f("+x", [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);
  f("-y", [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
  f("+y", [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);
  f("-z", [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1]);
  f("+z", [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// a box along any three square axes: c its middle, A B C the axes (unit), h their half lengths
function obox(o, slot, c, A, Bv, C, h, skip = "") {
  const P = (i, j, k) => add(add(add(c, mul(A, i * h[0])), mul(Bv, j * h[1])), mul(C, k * h[2]));
  const f = (key, pts, n) => { if (!skip.includes(key)) poly(o, slot, pts, n); };
  f("-a", [P(-1, -1, -1), P(-1, 1, -1), P(-1, 1, 1), P(-1, -1, 1)], mul(A, -1));
  f("+a", [P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)], A);
  f("-b", [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)], mul(Bv, -1));
  f("+b", [P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1)], Bv);
  f("-c", [P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1)], mul(C, -1));
  f("+c", [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)], C);
}
// a bar between two points (a thin box): w its width, t its thickness, up the direction its width lies across
function bar(o, slot, a, b, w, t = w, up = [0, 0, 1]) {
  const d = sub(b, a), L = Math.hypot(...d); if (L < 1e-5) return;
  const A = mul(d, 1 / L); let C = sub(up, mul(A, dot(up, A))); if (Math.hypot(...C) < 1e-4) C = Math.abs(A[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  C = norm(sub(C, mul(A, dot(C, A)))); const Bv = cross(C, A);
  obox(o, slot, mul(add(a, b), 0.5), A, Bv, C, [L / 2, t / 2, w / 2]);
}
// a cylinder from a to b, radius r (r2 at b: a taper), n sides; caps unless told not to
function cyl(o, slot, a, b, r, n = 8, r2 = r, caps = true, slot2 = slot) {
  const d = sub(b, a), L = Math.hypot(...d); if (L < 1e-5) return;
  const W = mul(d, 1 / L), U = norm(Math.abs(W[2]) < 0.9 ? cross(W, [0, 0, 1]) : cross(W, [1, 0, 0])), V = cross(W, U);
  const ring = (c, rr) => Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2; return add(c, add(mul(U, Math.cos(t) * rr), mul(V, Math.sin(t) * rr))); });
  const A0 = ring(a, r), A1 = ring(b, r2), g = buf(o, slot);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, t = (i + 0.5) / n * Math.PI * 2, nn = norm(add(mul(U, Math.cos(t)), mul(V, Math.sin(t))));
    const u0 = i / n * 2 * Math.PI * Math.max(r, r2), u1 = (i + 1) / n * 2 * Math.PI * Math.max(r, r2);
    poly(o, slot, [A0[i], A0[j], A1[j], A1[i]], nn, [[u0, 0], [u1, 0], [u1, L], [u0, L]]);
  }
  void g;
  if (caps) { poly(o, slot2, A0.slice(), mul(W, -1)); poly(o, slot2, A1.slice(), W); }
}
// a tube along points (a wire, a wheel's rim, a rail): r its radius, `sides` round it; closed joins the ends
function tube(o, slot, pts, r, sides = 3, closed = false) {
  const n = pts.length; if (n < 2) return;
  const g = buf(o, slot);
  const rings = pts.map((p, i) => {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const W = norm(sub(b, a)), U = norm(Math.abs(W[2]) < 0.9 ? cross(W, [0, 0, 1]) : cross(W, [1, 0, 0])), V = cross(W, U);
    return Array.from({ length: sides }, (_, k) => { const t = k / sides * Math.PI * 2; const nn = add(mul(U, Math.cos(t)), mul(V, Math.sin(t))); return [add(p, mul(nn, r)), nn]; });
  });
  let run = 0;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const A = rings[i], Bq = rings[(i + 1) % n], seg = Math.hypot(...sub(pts[(i + 1) % n], pts[i]));
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides, base = g.pos.length / 3;
      for (const [q, uu, vv] of [[A[k], run, k / sides], [A[k2], run, (k + 1) / sides], [Bq[k2], run + seg, (k + 1) / sides], [Bq[k], run + seg, k / sides]]) {
        g.pos.push(...q[0]); g.nrm.push(...q[1]); g.uv.push(uu, vv * 2 * Math.PI * r);
      }
      g.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
    run += seg;
  }
}

// a lump of leaves: a squashed sphere, 10 by 7, each point pushed in or out a little
function lump(o, slot, c, r, squash, R) {
  const nu = 10, nv = 7, P = [];
  for (let j = 0; j <= nv; j++) { const row = []; for (let i = 0; i < nu; i++) { const th = i / nu * Math.PI * 2, ph = j / nv * Math.PI, k = r * (0.86 + R() * 0.28) * (j === 0 || j === nv ? 1 : 1);
    row.push([c[0] + Math.cos(th) * Math.sin(ph) * k, c[1] + Math.sin(th) * Math.sin(ph) * k, c[2] + Math.cos(ph) * k * squash]); } P.push(row); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = P[j][i], b = P[j][(i + 1) % nu], cc = P[j + 1][(i + 1) % nu], d = P[j + 1][i], m = [(a[0] + cc[0]) / 2 - c[0], (a[1] + cc[1]) / 2 - c[1], (a[2] + cc[2]) / 2 - c[2]];
    const l = Math.hypot(...m) || 1; poly(o, slot, [a, b, cc, d], [m[0] / l, m[1] / l, m[2] / l]);
  }
}
// ---- a face of a building: its own 2D space, u along it (left to right seen from outside), z up, n out of it -----
// F: {o: its bottom left corner (the piece's space), U: along it, N: out of it, W: its width, name}
const FACES = ["front", "right", "back", "left"];
export function faceFrames(x0, y0, x1, y1, z) {
  return {
    front: { name: "front", o: [x0, y0, z], U: [1, 0, 0], N: [0, -1, 0], W: x1 - x0 },
    right: { name: "right", o: [x1, y0, z], U: [0, 1, 0], N: [1, 0, 0], W: y1 - y0 },
    back: { name: "back", o: [x1, y1, z], U: [-1, 0, 0], N: [0, 1, 0], W: x1 - x0 },
    left: { name: "left", o: [x0, y1, z], U: [0, -1, 0], N: [-1, 0, 0], W: y1 - y0 },
  };
}
const fp = (F, u, z, n) => [F.o[0] + F.U[0] * u + F.N[0] * n, F.o[1] + F.U[1] * u + F.N[1] * n, z];
function fquad(o, slot, F, u0, u1, z0, z1, n, uv) { poly(o, slot, [fp(F, u0, z0, n), fp(F, u1, z0, n), fp(F, u1, z1, n), fp(F, u0, z1, n)], [F.N[0], F.N[1], 0], uv); }
function fbox(o, slot, F, u0, u1, z0, z1, n0, n1, skip = "") {
  const a = fp(F, u0, z0, n0), b = fp(F, u1, z1, n1);
  box(o, slot, a[0], a[1], z0, b[0], b[1], z1, skip);
}
// which of an upright box's faces looks along the face's normal (s 1) or back into the wall (s -1)
const nKey = (F, s) => { const n = [F.N[0] * s, F.N[1] * s]; return Math.abs(n[0]) > 0.5 ? (n[0] > 0 ? "+x" : "-x") : (n[1] > 0 ? "+y" : "-y"); };
// the wall left round the holes, as few rectangles as it takes: columns between the holes' edges, merged across
export function wallRects(W, z0, z1, holes) {
  const xs = [...new Set([0, W, ...holes.flatMap(h => [h.u0, h.u1]).filter(u => u > 0 && u < W)])].sort((a, b) => a - b);
  const cols = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i], b = xs[i + 1], m = (a + b) / 2;
    if (b - a < 1e-4) continue;
    const hs = holes.filter(h => h.u0 < m && h.u1 > m && h.z1 > z0 && h.z0 < z1).sort((p, q) => p.z0 - q.z0);
    const iv = []; let z = z0;
    for (const h of hs) { if (h.z0 > z + 1e-4) iv.push([z, Math.min(h.z0, z1)]); z = Math.max(z, h.z1); }
    if (z < z1 - 1e-4) iv.push([z, z1]);
    cols.push({ a, b, iv });
  }
  const done = [], open = new Map();
  for (const c of cols) {
    const keys = new Set(c.iv.map(([p, q]) => p.toFixed(4) + "|" + q.toFixed(4)));
    for (const [k, r] of open) if (!keys.has(k) || Math.abs(r[1] - c.a) > 1e-6) { done.push(r); open.delete(k); }
    for (const [p, q] of c.iv) { const k = p.toFixed(4) + "|" + q.toFixed(4), r = open.get(k); if (r) r[1] = c.b; else open.set(k, [c.a, c.b, p, q]); }
  }
  return done.concat([...open.values()]);
}

// ---- the building styles' defaults: what a building has when its spec doesn't say (street-presets.js makes whole
// buildings from a style with a seed; these keep an old spec readable) -------------------------------------------------
export const FACE_DEFAULT = { win: "punched", cols: 0, ww: 1.3, wh: 1.4, sill: 0.85, ground: "same", bands: false, lit: 0.45, door: 0.2, cool: 0.3 };
export const BUILDING_DEFAULT = { w: 8, d: 10, floors: 4, fh: 3.1, gh: 3.6, turn: 0, seed: 1 };
export const WIN_STYLES = { punched: "windows", band: "a band of glass", glass: "all glass", tall: "tall windows", small: "small windows",
  pairs: "windows in pairs", fins: "fins (no windows)", lattice: "wooden lattice", shutters: "shuttered windows", none: "blank wall" };
export const GROUND_STYLES = { same: "as the floors above", shop: "a shop front", shutter: "shutters", door: "a door and a window",
  glass: "a glass lobby", open: "open (parking, a passage)", lattice: "a wooden lattice front", wall: "blank wall" };
export const ROOF_KINDS = { flat: "flat, a parapet", rail: "flat, a railing", gable: "gable", hip: "hip", shed: "one slope", none: "bare" };

function faceSettings(b, name) {
  const f = (b.faces || {})[name];
  const isSide = name === "left" || name === "right";
  const base = Object.assign({}, FACE_DEFAULT, isSide || name === "back" ? { win: name === "back" ? "small" : "none", ground: "wall" } : {});
  return Object.assign(base, typeof f === "string" ? { win: f } : f || {});
}
// the floors of a building: [{k (1 up), z0, h, tier}] and the tiers' rectangles
export function floorsOf(b) {
  const w = num(b.w, 8), d = num(b.d, 10), n = Math.max(1, Math.round(num(b.floors, 1))), fh = num(b.fh, 3.1), gh = num(b.gh, fh);
  const rows = [], tiers = [{ x0: -w / 2, y0: -d / 2, x1: w / 2, y1: d / 2, z0: 0, rows: [] }];
  let z = 0;
  for (let k = 1; k <= n; k++) { const h = k === 1 ? gh : fh, r = { k, z0: z, h, tier: 0 }; rows.push(r); tiers[0].rows.push(r); z += h; }
  tiers[0].z1 = z;
  let k = n;
  (b.tiers || []).forEach((t, i) => {
    const prev = tiers[tiers.length - 1], [f = 0, r = 0, bk = 0, l = 0] = t.inset || [];
    const T = { x0: prev.x0 + num(l, 0), y0: prev.y0 + num(f, 0), x1: prev.x1 - num(r, 0), y1: prev.y1 - num(bk, 0), z0: z, rows: [], t };
    if (T.x1 - T.x0 < 0.5 || T.y1 - T.y0 < 0.5) return;
    const th = num(t.fh, fh);
    for (let j = 0; j < Math.max(1, Math.round(num(t.floors, 1))); j++) { k++; const row = { k, z0: z, h: th, tier: i + 1 }; rows.push(row); T.rows.push(row); z += th; }
    T.z1 = z; tiers.push(T);
  });
  return { rows, tiers, height: z };
}
export function buildingHeight(b) { return floorsOf(b).height; }

// a floor's windows (holes) on a face: {u0, u1, z0, z1, kind, dp (depth), mull: [u...], lit}
function floorHoles(s, W, row, R) {
  const z0 = row.z0, h = row.h, k = row.k, H = [];
  const style = k === 1 && s.ground && s.ground !== "same" ? "g:" + s.ground : s.win;
  const litOf = () => R() < num(s.lit, 0.45) ? (R() < num(s.cool, 0.3) ? "lit_cool" : "lit") : "glass";
  const grid = (ww, wh, sill, kind = "win", n = 0, dp = 0.14) => {
    const cols = n || num(s.cols, 0) || Math.max(1, Math.floor((W - 0.5) / 2.6));
    const bw = W / cols, w = Math.min(ww, bw - 0.45), hh = Math.min(wh, h - sill - 0.35);
    if (w < 0.25 || hh < 0.25) return;
    for (let i = 0; i < cols; i++) { const c = (i + 0.5) * bw + num(s.shift, 0); H.push({ u0: c - w / 2, u1: c + w / 2, z0: z0 + sill, z1: z0 + sill + hh, kind, dp, lit: litOf(), mull: w > 1.05 ? [c] : [] }); }
  };
  const ww = num(s.ww, 1.3), wh = num(s.wh, 1.4), sill = num(s.sill, 0.85);
  switch (style) {
    case "punched": grid(ww, wh, sill); break;
    case "tall": grid(Math.min(ww, 0.9), Math.max(wh, 2.0), Math.min(sill, 0.3)); break;
    case "small": grid(Math.min(ww, 0.7), Math.min(wh, 0.7), Math.max(sill, 1.45)); break;
    case "shutters": grid(ww, wh, sill, "shutwin"); break;
    case "pairs": {                                   // two windows close together in each bay
      const cols = num(s.cols, 0) || Math.max(1, Math.floor((W - 0.5) / 3.6)), bw = W / cols, w = Math.min(ww * 0.6, bw / 2 - 0.35), hh = Math.min(wh, h - sill - 0.35);
      if (w > 0.25 && hh > 0.25) for (let i = 0; i < cols; i++) for (const side of [-1, 1]) { const c = (i + 0.5) * bw + side * (w / 2 + 0.12); H.push({ u0: c - w / 2, u1: c + w / 2, z0: z0 + sill, z1: z0 + sill + hh, kind: "win", dp: 0.14, lit: litOf(), mull: [] }); }
      break;
    }
    case "band": { const m = num(s.margin, 0.35), hh = Math.min(wh, h - sill - 0.3); if (W - 2 * m > 0.5 && hh > 0.3) H.push({ u0: m, u1: W - m, z0: z0 + sill, z1: z0 + sill + hh, kind: "win", dp: 0.1, lit: litOf(), mull: mulls(m, W - m, 1.5) }); break; }
    case "glass": { const m = num(s.margin, 0.12); H.push({ u0: m, u1: W - m, z0: z0 + 0.12, z1: z0 + h - 0.18, kind: "win", dp: 0.05, lit: litOf(), mull: mulls(m, W - m, 1.25) }); break; }
    case "lattice": { const m = num(s.margin, 0.3), hh = Math.min(wh, h - 0.7); if (W - 2 * m > 0.5) H.push({ u0: m, u1: W - m, z0: z0 + Math.min(sill, h - hh - 0.25), z1: z0 + Math.min(sill, h - hh - 0.25) + hh, kind: "koshi", dp: 0.16, lit: R() < num(s.lit, 0.45) ? "paper" : "dark", mull: [] }); break; }
    case "g:shop": { const m = num(s.margin, 0.3), top = Math.min(h - 0.75, 3.1); H.push({ u0: m, u1: W - m, z0: z0 + 0.12, z1: z0 + top, kind: "shop", dp: 0.18, lit: s.closed ? "glass" : "shop", mull: mulls(m, W - m, 1.9), door: clamp(num(s.door, 0.5), 0, 1) }); break; }
    case "g:shutter": {
      const n = Math.max(1, Math.round((W - 0.3) / 3.3)), bw = (W - 0.3) / n, top = Math.min(h - 0.55, 2.7);
      for (let i = 0; i < n; i++) H.push({ u0: 0.15 + i * bw + 0.14, u1: 0.15 + (i + 1) * bw - 0.14, z0: z0, z1: z0 + top, kind: "shutter", dp: 0.12, lit: "glass", mull: [] });
      break;
    }
    case "g:door": {
      const dw = 0.95, c = clamp(num(s.door, 0.2) * W, dw / 2 + 0.25, W - dw / 2 - 0.25);
      H.push({ u0: c - dw / 2, u1: c + dw / 2, z0: z0, z1: z0 + Math.min(2.15, h - 0.3), kind: "door", dp: 0.1, lit: "glass", mull: [] });
      const free = c > W / 2 ? [0.3, c - dw / 2 - 0.4] : [c + dw / 2 + 0.4, W - 0.3];
      const w = Math.min(ww, free[1] - free[0]);
      if (w > 0.5) { const m = (free[0] + free[1]) / 2; H.push({ u0: m - w / 2, u1: m + w / 2, z0: z0 + sill, z1: z0 + sill + Math.min(wh, h - sill - 0.4), kind: "win", dp: 0.14, lit: litOf(), mull: w > 1.05 ? [m] : [] }); }
      break;
    }
    case "g:glass": H.push({ u0: 0.2, u1: W - 0.2, z0: z0 + 0.05, z1: z0 + h - 0.45, kind: "win", dp: 0.06, lit: s.closed ? "glass" : "lobby", mull: mulls(0.2, W - 0.2, 1.6) }); break;
    case "g:open": H.push({ u0: 0.45, u1: W - 0.45, z0: z0, z1: z0 + h - 0.55, kind: "void", dp: 2.5, lit: "dark", mull: [] }); break;
    case "g:lattice": {
      const dw = 1.6, c = clamp(num(s.door, 0.3) * W, dw / 2 + 0.2, W - dw / 2 - 0.2), top = Math.min(h - 0.35, 2.3);
      H.push({ u0: c - dw / 2, u1: c + dw / 2, z0: z0, z1: z0 + top, kind: "koshi", dp: 0.12, lit: R() < num(s.lit, 0.45) ? "paper" : "dark", mull: [c], door: 1 });
      if (c - dw / 2 - 0.2 > 0.6) H.push({ u0: 0.2, u1: c - dw / 2 - 0.15, z0: z0 + 0.35, z1: z0 + top, kind: "koshi", dp: 0.16, lit: R() < num(s.lit, 0.45) ? "paper" : "dark", mull: [] });
      if (W - 0.2 - (c + dw / 2 + 0.15) > 0.6) H.push({ u0: c + dw / 2 + 0.15, u1: W - 0.2, z0: z0 + 0.35, z1: z0 + top, kind: "koshi", dp: 0.16, lit: R() < num(s.lit, 0.45) ? "paper" : "dark", mull: [] });
      break;
    }
    default: break;                                  // none, fins, g:wall
  }
  return H.filter(h => h.u1 - h.u0 > 0.2 && h.z1 - h.z0 > 0.2 && h.u0 >= -1e-6 && h.u1 <= W + 1e-6);
}
function mulls(a, b, step) { const n = Math.max(1, Math.round((b - a) / step)), out = []; for (let i = 1; i < n; i++) out.push(a + (b - a) * i / n); return out; }

// what's set into a hole: its reveals (the wall's thickness), then glass with its frame, a door, a shutter...
function holeGen(o, F, h, R) {
  const { u0, u1, z0, z1 } = h, dp = h.dp, rv = h.reveal || "wall";
  // the reveals: their normals point into the hole's middle
  poly(o, rv, [fp(F, u0, z0, 0), fp(F, u0, z0, -dp), fp(F, u0, z1, -dp), fp(F, u0, z1, 0)], [F.U[0], F.U[1], 0]);
  poly(o, rv, [fp(F, u1, z0, 0), fp(F, u1, z0, -dp), fp(F, u1, z1, -dp), fp(F, u1, z1, 0)], [-F.U[0], -F.U[1], 0]);
  poly(o, h.kind === "win" || h.kind === "shutwin" ? "trim" : rv, [fp(F, u0, z0, 0), fp(F, u1, z0, 0), fp(F, u1, z0, -dp), fp(F, u0, z0, -dp)], [0, 0, 1]);
  poly(o, rv, [fp(F, u0, z1, 0), fp(F, u1, z1, 0), fp(F, u1, z1, -dp), fp(F, u0, z1, -dp)], [0, 0, -1]);
  const back = -dp, fw = 0.05;
  const frameRing = (n, slot = "frame", w = fw, mull = h.mull || []) => {
    fquad(o, slot, F, u0, u0 + w, z0, z1, n); fquad(o, slot, F, u1 - w, u1, z0, z1, n);
    fquad(o, slot, F, u0 + w, u1 - w, z0, z0 + w, n); fquad(o, slot, F, u0 + w, u1 - w, z1 - w, z1, n);
    for (const m of mull) fquad(o, slot, F, m - w / 2, m + w / 2, z0 + w, z1 - w, n);
  };
  // a shop front's door: its middle and its sides (no mullion runs through it)
  const dc = u0 + (u1 - u0) * clamp(num(h.door, 0.5), 0.1, 0.9), da = Math.max(u0 + 0.07, dc - 0.45), db = Math.min(u1 - 0.07, dc + 0.45);
  switch (h.kind) {
    case "win": case "shop":
      fquad(o, h.lit || "glass", F, u0, u1, z0, z1, back);
      frameRing(back + 0.01, "frame", h.kind === "shop" ? 0.07 : fw, h.kind === "shop" ? (h.mull || []).filter(m => m < da - 0.12 || m > db + 0.12) : h.mull || []);
      if (h.kind === "shop" && h.lit === "shop") {                 // the light it throws out over the pavement, one a 5 m
        const n = Math.max(1, Math.round((u1 - u0) / 5));
        for (let i = 0; i < n; i++) o.lights.push({ at: fp(F, u0 + (u1 - u0) * (i + 0.5) / n, z0 + (z1 - z0) * 0.55, 0.7), color: h.glow || "#ffb47f", power: 3.5, dist: 5, shop: true });
      }
      if (h.kind === "shop") {                                     // a glass door: its frame all round, a kick plate, a push bar
        const c = dc, a = da, b = db, st = 0.07, top = Math.min(z1 - 0.08, z0 + 2.2), d = back + 0.02;
        fquad(o, "frame", F, a - st, a, z0, top + st, d);                  // the stiles, the head over them, the kick plate
        fquad(o, "frame", F, b, b + st, z0, top + st, d);
        fquad(o, "frame", F, a, b, top, top + st, d);
        fquad(o, "frame", F, a, b, z0, z0 + 0.22, d);
        fquad(o, "glass", F, a, b, z0 + 0.22, top, back + 0.008);         // the door's own pane, darker than the window round it
        const hx = c > (u0 + u1) / 2 ? a + 0.1 : b - 0.1;                 // the bar on the side away from the hinges
        fbox(o, "steel", F, Math.min(hx, hx + (c > (u0 + u1) / 2 ? 0.45 : -0.45)), Math.max(hx, hx + (c > (u0 + u1) / 2 ? 0.45 : -0.45)), z0 + 0.98, z0 + 1.03, d, d + 0.05);
      }
      break;
    case "shutwin":                                                 // a window with its storm shutter down
      fquad(o, "shutter", F, u0, u1, z0, z1, back + 0.02); frameRing(back + 0.03, "shutter_box", 0.04);
      fbox(o, "shutter_box", F, u0 - 0.05, u1 + 0.05, z1, z1 + 0.22, 0, 0.18, nKey(F, -1));
      break;
    case "shutter":
      fquad(o, "shutter", F, u0, u1, z0, z1, back);
      fbox(o, "shutter_box", F, u0 - 0.04, u1 + 0.04, z1, z1 + 0.32, 0, 0.24, nKey(F, -1));
      fbox(o, "shutter_box", F, u0, u0 + 0.06, z0, z1, back, 0.02); fbox(o, "shutter_box", F, u1 - 0.06, u1, z0, z1, back, 0.02);
      break;
    case "door":
      fquad(o, "door", F, u0, u1, z0, z1, back);
      frameRing(back + 0.01, "frame", 0.05);
      fbox(o, "metal", F, u1 - 0.18, u1 - 0.14, z0 + 0.95, z0 + 1.1, back, back + 0.06);
      break;
    case "koshi": {                                                // a wooden lattice over paper or the dark
      fquad(o, h.lit === "paper" ? "paper" : "dark", F, u0, u1, z0, z1, back);
      fquad(o, "lattice", F, u0, u1, z0, z1, back + 0.05);
      fquad(o, "lattice", F, u0, u1, z0, z1, back + 0.06);   // (both faces of the screen, its back toward the paper)
      frameRing(back + 0.07, "wood_dark", 0.07);
      break;
    }
    case "void": fquad(o, "dark", F, u0, u1, z0, z1, back); break;
    case "glassblock": fquad(o, "glassblock", F, u0, u1, z0, z1, back); frameRing(back + 0.01, "trim", 0.06); break;
    default: fquad(o, "glass", F, u0, u1, z0, z1, back);
  }
}

// ---- parts on a face: openings (cut into the wall) and things on it -------------------------------------------------
export const PART_KINDS = {
  // openings
  window: { label: "Window", hole: "win", w: 1.3, h: 1.4, z: 0.85, dp: 0.14, note: "a window cut into the wall" },
  door: { label: "Door", hole: "door", w: 0.95, h: 2.1, z: 0, dp: 0.1, note: "a door" },
  shopfront: { label: "Shop front", hole: "shop", w: 4, h: 2.8, z: 0.12, dp: 0.18, note: "a glazed shop front, lit inside" },
  shutter: { label: "Shutter", hole: "shutter", w: 3, h: 2.6, z: 0, dp: 0.12, note: "a roll-down shutter with its box" },
  glassblock: { label: "Glass blocks", hole: "glassblock", w: 1.2, h: 6, z: 3, dp: 0.06, note: "a strip of glass blocks (a stairwell)" },
  opening: { label: "Dark opening", hole: "void", w: 3, h: 2.4, z: 0, dp: 2.5, note: "a dark way in: parking, a passage" },
  lattice_window: { label: "Lattice window", hole: "koshi", w: 2, h: 1.2, z: 0.6, dp: 0.16, note: "a wooden lattice (koshi) over paper" },
  // things on the wall
  bay: { label: "Box (sticks out)", w: 2.4, h: 2.6, z: 0.3, out: 0.9, note: "a box sticking out of the wall: a bay, a closed balcony; windows on its front if you like" },
  balcony: { label: "Balcony", w: 3, h: 1.05, z: 0, out: 1.0, note: "a slab and its parapet (solid, a railing or bars)" },
  sign: { label: "Sign board", w: 2.4, h: 0.8, z: 2.9, out: 0.1, note: "a board flat on the wall with words on it" },
  vsign: { label: "Blade sign", w: 0.7, h: 3.2, z: 3.5, out: 0.7, note: "a tall sign sticking out from the wall (words top to bottom)" },
  awning: { label: "Awning", w: 3, h: 0.5, z: 2.4, out: 1.1, note: "a sloping cloth awning" },
  canopy: { label: "Canopy slab", w: 4, h: 0.3, z: 2.8, out: 1.6, note: "a flat slab over the way in" },
  eave: { label: "Eave (pent roof)", w: 0, h: 0.55, z: 2.8, out: 0.9, note: "a little tiled roof along the wall between the floors" },
  ac: { label: "AC unit", w: 0.8, h: 0.6, z: 0, out: 0.3, note: "an air conditioner's outdoor unit" },
  pipe: { label: "Pipe", w: 0.1, h: 9, z: 0, out: 0.1, note: "a drain pipe up the wall" },
  lamp: { label: "Wall lamp", w: 0.3, h: 0.35, z: 2.3, out: 0.25, note: "a lamp on the wall (lights at dusk)" },
  lantern: { label: "Hanging lantern", w: 0.4, h: 0.5, z: 2.6, out: 0.7, note: "a lantern hung out on a bracket (the old town)" },
  stairs: { label: "Outside stairs", w: 5, h: 3, z: 0, out: 1.1, note: "a concrete stair up the wall to a floor" },
  block: { label: "Small box", w: 0.4, h: 0.5, z: 1.2, out: 0.15, note: "a box on the wall: a meter, a fire extinguisher, a post box..." },
  panel: { label: "Panel", w: 2, h: 2, z: 1, out: 0.03, note: "a flat panel of any material on the wall" },
  rail: { label: "Railing", w: 3, h: 1.1, z: 3, out: 0.05, note: "a railing along the wall" },
  noren: { label: "Noren curtain", w: 1.2, h: 0.6, z: 1.6, out: 0.12, note: "a short shop curtain over a door" },
  roofsign: { label: "Name on the roof", w: 12, h: 1.4, z: 0.3, out: 0.06, note: "the school's name standing on its roof: a panel a letter on a steel frame along the front (z: over the parapet)" },
  clock: { label: "Clock", w: 1.3, h: 1.3, z: 8, out: 0.15, note: "a school's clock: a white face in a dark rim, its hands at ten past ten (on a box's front: out past the box's)" },
};
// a part repeated along its face (`repeat` of them, `gap` m apart): a lamp by each door, a post under a walkway
export function partCopies(parts) {
  const out2 = [];
  for (const p of parts || []) { const n = Math.max(1, Math.min(60, Math.round(num(p.repeat, 1)))), g = num(p.gap, 3); for (let i = 0; i < n; i++) out2.push(i ? Object.assign({}, p, { x: num(p.x, 0) + i * g, repeat: 1 }) : p); }
  return out2;
}
const fillOf = (p, R) => p.lit === false ? "glass" : p.lit === true ? "lit" : (R() < 0.5 ? "lit" : "glass");
function partHoles(b, F, parts, rows, R) {
  const H = [];
  for (const p of parts) {
    const K = PART_KINDS[p.kind]; if (!K || !K.hole) continue;
    const zs = partZs(p, rows);
    for (const [zi, zb] of zs.entries()) {
      const w = num(p.w, K.w), hh = Math.min(num(p.h, K.h), upTo(zs, zi) - 0.1), c = F.W / 2 + num(p.x, 0);   // a hole a floor, wall between
      H.push({ u0: c - w / 2, u1: c + w / 2, z0: zb + num(p.z, K.z), z1: zb + num(p.z, K.z) + hh, kind: K.hole, dp: num(p.dp, K.dp),
               lit: K.hole === "shop" ? (p.lit === false ? "glass" : "shop") : K.hole === "koshi" ? (p.lit === false ? "dark" : "paper") : fillOf(p, R),
               mull: K.hole === "shop" ? mulls(c - w / 2, c + w / 2, num(p.mull, 1.9)) : K.hole === "win" && w > 1.05 ? [c] : [], door: num(p.door, 0.5), glow: p.glow, part: p });
    }
  }
  return H;
}
// a part repeated up the floors: `floors: [from, to]` puts one on each (its z from that floor's base); `upTo` how high
// one there can be before it runs into its own copy on the next floor
const upTo = (zs, i) => i + 1 < zs.length ? zs[i + 1] - zs[i] : Infinity;
function partZs(p, rows) {
  if (!Array.isArray(p.floors)) return [0];
  const [a, bb] = p.floors.map(v => Math.round(num(v, 1)));
  return rows.filter(r => r.k >= a && r.k <= (bb || a)).map(r => r.z0);
}
function partGen(o, b, F0, p, rows, R, signs, near = []) {
  const K = PART_KINDS[p.kind]; if (!K || K.hole) return;
  const F = p.in ? Object.assign({}, F0, { o: [F0.o[0] - F0.N[0] * num(p.in, 0), F0.o[1] - F0.N[1] * num(p.in, 0), F0.o[2]] }) : F0;   // set back into a recess
  const zs = partZs(p, rows);
  for (const [zi, zb] of zs.entries()) {
    // its top, and its bottom when it's off its floor, a few mm in too: never in the plane of a floor's line, a fin's end, a
    // slab's top; never into its own copy on the next floor
    const W0 = num(p.w, K.w), w = p.kind === "eave" && !W0 ? F.W + 0.4 : W0, out = num(p.out, K.out), lift = num(p.z, K.z) > 0.02 ? SIDE_IN : 0;
    const z = zb + num(p.z, K.z) + lift, h = Math.min(num(p.h, K.h), upTo(zs, zi)) - SIDE_IN - lift;
    const c = F.W / 2 + num(p.x, 0), u0 = c - w / 2 + SIDE_IN, u1 = c + w / 2 - SIDE_IN, slot = p.slot;
    switch (p.kind) {
      case "bay": {
        const sl = slot || "wall";
        fbox(o, sl, F, u0, u1, z, z + h, 0.0, out, nKey(F, -1) + (p.win ? nKey(F, 1) : ""));
        if (p.win) {                                                 // windows on its front, one a floor (or `cols`)
          const bw = u1 - u0, front = { name: F.name, o: fp(F, u0, 0, out), U: F.U, N: F.N, W: bw };   // the box's own front, left out
          const s = Object.assign({}, FACE_DEFAULT, { win: typeof p.win === "string" ? p.win : "punched", cols: num(p.cols, 1), ww: num(p.ww, Math.min(1.4, bw - 0.5)), wh: num(p.wh, 1.3), sill: num(p.sill, 0.8), lit: num(p.litp, 0.5) });
          const H = []; for (const r of rows) if (r.z0 >= z - 0.01 && r.z0 + r.h <= z + h + 0.01) H.push(...floorHoles(Object.assign({}, s, { ground: "same" }), bw, r, R));
          if (!H.length) H.push(...floorHoles(Object.assign({}, s, { ground: "same" }), bw, { k: 2, z0: z, h }, R));
          // the front, with the windows cut in, in the plane the box's sides end in
          for (const [a, bb, p0, q0] of wallRects(bw, z, z + h, H)) fquad(o, sl, front, a, bb, p0, q0, 0);
          for (const hh of H) holeGen(o, front, hh, R);
        }
        if (p.rail) railGen(o, F, u0, u1, z + h, z + h + 1.0, out - 0.05);
        break;
      }
      case "balcony": {
        const t = 0.16, kind = p.rail || "solid", sl = slot || "trim";
        fbox(o, sl, F, u0, u1, z - t, z, 0, out, nKey(F, -1));
        if (kind === "solid") {
          fbox(o, p.slot2 || sl, F, u0, u1, z, z + h, out - 0.1, out);
          fbox(o, p.slot2 || sl, F, u0, u0 + 0.1, z, z + h, 0, out - 0.1); fbox(o, p.slot2 || sl, F, u1 - 0.1, u1, z, z + h, 0, out - 0.1);
        } else {
          railGen(o, F, u0, u1, z, z + h, out - 0.04, kind === "bars" ? "bars" : null);
          const sideF = (u) => ({ name: F.name, o: fp(F, u, 0, 0), U: F.N, N: [-F.U[0], -F.U[1], 0], W: out });
          railGen(o, sideF(u0), 0.04, out - 0.04, z, z + h, 0, kind === "bars" ? "bars" : null, [false, true]);   // to the front's corner posts
          railGen(o, { ...sideF(u1), U: F.N, N: [F.U[0], F.U[1], 0] }, 0.04, out - 0.04, z, z + h, 0, kind === "bars" ? "bars" : null, [false, true]);
        }
        break;
      }
      case "sign": {
        const key = `${b.id || "b"}.${signs.length}`;
        fbox(o, p.back || "black", F, u0, u1, z, z + h, 0, out, nKey(F, -1));
        signs.push({ key, text: p.text || "", fg: p.fg || "#ffffff", bg: p.bg || "#202024", lit: p.lit !== false, dir: p.dir || (h > w * 1.6 ? "v" : "h"), w, h });
        fquad(o, "sign:" + key, F, u0 + 0.01, u1 - 0.01, z + 0.01, z + h - 0.01, out + GAP, [[0, 0], [1, 0], [1, 1], [0, 1]]);
        break;
      }
      case "vsign": {                                                // a blade: its two faces carry the words, top to bottom
        // over a box on the wall (a bay), it hangs off the box's front instead of through it
        const bay = near.filter(q => q !== p && q.kind === "bay" && Math.abs(F.W / 2 + num(q.x, 0) - c) < num(q.w, PART_KINDS.bay.w) / 2 + 0.1
          && partZs(q, rows).some(qz => qz + num(q.z, PART_KINDS.bay.z) < z + h && qz + num(q.z, PART_KINDS.bay.z) + num(q.h, PART_KINDS.bay.h) > z)).reduce((m, q) => Math.max(m, num(q.out, PART_KINDS.bay.out)), 0);
        const key = `${b.id || "b"}.${signs.length}`, th = 0.18, n0 = bay + 0.18, n1 = n0 + out;
        signs.push({ key, text: p.text || "", fg: p.fg || "#ffffff", bg: p.bg || "#202024", lit: p.lit !== false, dir: p.dir || "v", w: out, h });
        fbox(o, p.back || "black", F, c - th / 2, c + th / 2, z, z + h, n0, n1);
        const side = (s) => { const u = c + s * (th / 2 + GAP); const P = [fp(F, u, z + 0.03, n0 + 0.03), fp(F, u, z + 0.03, n1 - 0.03), fp(F, u, z + h - 0.03, n1 - 0.03), fp(F, u, z + h - 0.03, n0 + 0.03)];
          const uv = s > 0 ? [[1, 0], [0, 0], [0, 1], [1, 1]] : [[0, 0], [1, 0], [1, 1], [0, 1]];   // reads right from either side
          poly(o, "sign:" + key, P, [F.U[0] * s, F.U[1] * s, 0], uv); };
        side(1); side(-1);
        fbox(o, "steel", F, c - 0.03, c + 0.03, z + h - 0.25, z + h - 0.15, bay, n0, nKey(F, -1)); fbox(o, "steel", F, c - 0.03, c + 0.03, z + 0.15, z + 0.25, bay, n0, nKey(F, -1));
        break;
      }
      case "awning": {
        const drop = h, sl = slot || "awning", a0 = fp(F, u0, z, 0.02), a1 = fp(F, u1, z, 0.02), b0 = fp(F, u0, z - drop, out), b1 = fp(F, u1, z - drop, out);
        const up = norm(cross(sub(a1, a0), sub(b0, a0)));
        two(o, sl, [a0, a1, b1, b0], up[2] > 0 ? up : mul(up, -1));
        two(o, sl, [b0, b1, add(b1, [0, 0, -0.22]), add(b0, [0, 0, -0.22])], [F.N[0], F.N[1], 0]);
        two(o, sl, [a0, b0, add(b0, [0, 0, -0.22])], [-F.U[0], -F.U[1], 0]); two(o, sl, [a1, b1, add(b1, [0, 0, -0.22])], [F.U[0], F.U[1], 0]);
        break;
      }
      case "canopy": fbox(o, slot || "concrete", F, u0, u1, z, z + h, 0, out, nKey(F, -1)); break;
      case "eave": {                                                 // a pent roof: tiles sloping out and down, a fascia board
        const t = 0.07, drop = h, sl = slot || "tiles";
        const P = (u, n, dz) => fp(F, u, z - drop * (n / out) + dz, n);
        const top = [P(u0, 0, t), P(u1, 0, t), P(u1, out, t), P(u0, out, t)], bot = [P(u0, 0, 0), P(u1, 0, 0), P(u1, out, 0), P(u0, out, 0)];
        const up = norm(cross(sub(top[1], top[0]), sub(top[3], top[0])));
        poly(o, sl, top, up[2] > 0 ? up : mul(up, -1)); poly(o, "wood_dark", bot, up[2] > 0 ? mul(up, -1) : up);
        poly(o, "wood_dark", [bot[3], bot[2], top[2], top[3]], [F.N[0], F.N[1], 0]);
        poly(o, "wood_dark", [bot[0], bot[3], top[3], top[0]], [-F.U[0], -F.U[1], 0]); poly(o, "wood_dark", [bot[1], bot[2], top[2], top[1]], [F.U[0], F.U[1], 0]);
        fbox(o, "wood_dark", F, u0 - GAP, u1 + GAP, z - drop - 0.12, z - drop + 0.02, out - 0.06, out + 0.02);
        break;
      }
      case "ac": {
        fbox(o, slot || "ac", F, u0, u1, z, z + h, 0.02, out, nKey(F, -1));
        const r = Math.min(h, w) * 0.36, cu = u0 + w * 0.38, cz = z + h / 2;
        poly(o, "fan", [fp(F, cu - r, cz - r, out + GAP), fp(F, cu + r, cz - r, out + GAP), fp(F, cu + r, cz + r, out + GAP), fp(F, cu - r, cz + r, out + GAP)], [F.N[0], F.N[1], 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        if (num(p.z, K.z) > 0.5) fbox(o, "steel", F, u0 + 0.05, u1 - 0.05, z - 0.04, z, 0, out, nKey(F, -1));   // its bracket, on the wall
        break;
      }
      case "pipe": cyl(o, slot || "pipe", fp(F, c, z, out), fp(F, c, z + h, out), Math.max(0.03, w / 2), 6); break;
      case "roofsign": {                                             // a panel a letter, standing on the roof's edge on a frame
        const chars = [...String(p.text || "")].filter(ch => ch.trim()), nC = Math.max(1, chars.length), zr = (rows.top || z) + num(p.z, K.z);
        const pw = Math.min(h, (w - (nC - 1) * num(p.gap, 0.3)) / nC), gp = nC > 1 ? (w - nC * pw) / (nC - 1) : 0, n0 = -num(p.back, 0.4);   // behind the parapet (or on its face)
        if (n0 < -0.02) {                                             // standing on the roof: a frame behind the panels
          fbox(o, "steel", F, u0, u1, zr - num(p.z, K.z), zr + 0.06, n0 - 0.05, n0 - 0.01);
          fbox(o, "steel", F, u0, u1, zr + h * 0.75, zr + h * 0.75 + 0.05, n0 - 0.05, n0 - 0.01);
        }
        chars.forEach((ch, i) => {
          const a = u0 + i * (pw + gp), key = `${b.id || "b"}.${signs.length}`;
          fbox(o, p.back || "white", F, a, a + pw, zr, zr + pw, n0, n0 + 0.04);
          signs.push({ key, text: ch, fg: p.fg || "#1d4f9c", bg: p.bg || "#f4f4f0", lit: false, dir: "h", w: pw, h: pw });
          fquad(o, "sign:" + key, F, a + 0.01, a + pw - 0.01, zr + 0.01, zr + pw - 0.01, n0 + 0.04 + GAP, [[0, 0], [1, 0], [1, 1], [0, 1]]);
        });
        break;
      }
      case "clock": {                                                // a school's clock: its rim, its face, its hands (ten past ten)
        const r = Math.max(0.15, Math.min(w, h) / 2 - 0.05), zc = z + h / 2, f0 = Math.max(0, out - 0.12);
        cyl(o, slot || "frame", fp(F, c, zc, f0), fp(F, c, zc, out - 0.02), r + 0.05, 28);
        cyl(o, "white", fp(F, c, zc, out - 0.03), fp(F, c, zc, out), r, 28);
        for (let i = 0; i < 12; i++) {                               // the hours' marks round the face
          const a = i * Math.PI / 6, du = Math.sin(a), dz = Math.cos(a), r0 = r * 0.8, r1 = r * (i % 3 ? 0.88 : 0.93), wd = r * (i % 3 ? 0.02 : 0.04);
          poly(o, "black", [fp(F, c + du * r0 - dz * wd, zc + dz * r0 + du * wd, out + GAP), fp(F, c + du * r1 - dz * wd, zc + dz * r1 + du * wd, out + GAP),
            fp(F, c + du * r1 + dz * wd, zc + dz * r1 - du * wd, out + GAP), fp(F, c + du * r0 + dz * wd, zc + dz * r0 - du * wd, out + GAP)], [F.N[0], F.N[1], 0]);
        }
        for (const [a, len, wd, n] of [[Math.PI * 2 * (10 + 10 / 60) / 12, r * 0.5, r * 0.05, out + 2 * GAP], [Math.PI * 2 * 10 / 60, r * 0.78, r * 0.035, out + 3 * GAP]]) {
          const du = Math.sin(a), dz = Math.cos(a);                  // each hand in a plane of its own (they cross at the hub)
          poly(o, "black", [fp(F, c - dz * wd - du * r * 0.08, zc + du * wd - dz * r * 0.08, n), fp(F, c + dz * wd - du * r * 0.08, zc - du * wd - dz * r * 0.08, n),
            fp(F, c + dz * wd * 0.4 + du * len, zc - du * wd * 0.4 + dz * len, n), fp(F, c - dz * wd * 0.4 + du * len, zc + du * wd * 0.4 + dz * len, n)], [F.N[0], F.N[1], 0]);
        }
        break;
      }
      case "lamp": {
        fbox(o, slot || "black", F, c - w / 2, c + w / 2, z + h * 0.25, z + h, 0, out, nKey(F, -1));
        fquad(o, "lamp", F, c - w / 2 + 0.03, c + w / 2 - 0.03, z + h * 0.3, z + h * 0.9, out + GAP);
        o.lights.push({ at: fp(F, c, z + h * 0.6, out + 0.3), color: p.color || "#ffd9a0", power: num(p.power, 4), dist: num(p.dist, 7), z: z + h * 0.6 });
        break;
      }
      case "lantern": {                                              // bracket out of the wall, a box lantern under it
        fbox(o, "wood_dark", F, c - 0.03, c + 0.03, z + h + 0.12, z + h + 0.18, 0, out + 0.06, nKey(F, -1));
        const a = fp(F, c, z, out), r = w / 2;
        box(o, "paper", a[0] - r, a[1] - r, z, a[0] + r, a[1] + r, z + h, "");
        box(o, "wood_dark", a[0] - r - 0.03, a[1] - r - 0.03, z + h, a[0] + r + 0.03, a[1] + r + 0.03, z + h + 0.07);
        box(o, "wood_dark", a[0] - r - 0.02, a[1] - r - 0.02, z - 0.05, a[0] + r + 0.02, a[1] + r + 0.02, z);
        bar(o, "wood_dark", [a[0], a[1], z + h + 0.07], [a[0], a[1], z + h + 0.15], 0.02);
        o.lights.push({ at: [a[0], a[1], z + h / 2], color: p.color || "#ffc27a", power: num(p.power, 5), dist: num(p.dist, 8), z: z + h / 2 });
        break;
      }
      case "stairs": {                                               // up the wall from u0 (ground) to u1 (z + h), `dir` -1 the other way
        const dir = num(p.dir, 1) < 0 ? -1 : 1, n = Math.max(2, Math.round(h / 0.19)), run = (u1 - u0) / n, rise = h / n, t = 0.22, sl = slot || "concrete";
        for (let i = 0; i < n; i++) {                                // from u0 to u1 exactly: the top step meets the landing, never under it
          const a = dir > 0 ? u0 + i * run : u1 - (i + 1) * run, bb = a + run, zt = z + (i + 1) * rise;
          fbox(o, sl, F, a, bb, zt - t - (i === 0 ? 0 : rise), zt, 0.0, out - 0.12, nKey(F, -1));
        }
        const ua = dir > 0 ? u0 : u1, ub = dir > 0 ? u1 : u0;          // the parapet on its open side: a sloping slab
        fslab(o, sl, F, [[ua, z - 0.25], [ub, z + h - 0.25], [ub, z + h + 1.0], [ua, z + 1.0]], out - 0.12, out);
        if (p.landing !== false) fbox(o, sl, F, dir > 0 ? u1 : u0 - 1.2, dir > 0 ? u1 + 1.2 : u0, z + h - t, z + h, 0, out, nKey(F, -1));
        break;
      }
      case "block": fbox(o, slot || "metal", F, u0, u1, z, z + h, 0, out, nKey(F, -1)); break;
      case "panel": fbox(o, slot || "metal", F, u0, u1, z, z + h, 0, out, nKey(F, -1)); break;
      case "rail": railGen(o, F, u0, u1, z, z + h, out); break;
      case "noren": {
        const n = 3, gw = w / n;
        for (let i = 0; i < n; i++) two(o, slot || "noren", [fp(F, u0 + i * gw + 0.01, z, out), fp(F, u0 + (i + 1) * gw - 0.01, z, out), fp(F, u0 + (i + 1) * gw - 0.01, z + h, out), fp(F, u0 + i * gw + 0.01, z + h, out)], [F.N[0], F.N[1], 0]);
        bar(o, "wood_dark", fp(F, u0 - 0.1, z + h + 0.03, out), fp(F, u1 + 0.1, z + h + 0.03, out), 0.04);
        break;
      }
      default: break;
    }
  }
}
// a flat shape in a face's u-z (four points, in order) given a thickness from n0 to n1: both faces and its edges
function fslab(o, slot, F, Q, n0, n1) {
  let area = 0; for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length]; area += a[0] * b[1] - b[0] * a[1]; }
  if (area < 0) Q = Q.slice().reverse();                              // anticlockwise, seen from outside
  const N = [F.N[0], F.N[1], 0], P = (q, n) => fp(F, q[0], q[1], n);
  poly(o, slot, Q.map(q => P(q, n1)), N); poly(o, slot, Q.map(q => P(q, n0)), mul(N, -1));
  for (let i = 0; i < Q.length; i++) {
    const a = Q[i], b = Q[(i + 1) % Q.length], e = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...e) || 1;
    const en = [e[1] / l, -e[0] / l], cxy = [F.U[0] * en[0], F.U[1] * en[0], en[1]];        // the edge's outward normal (the shape wound anticlockwise)
    poly(o, slot, [P(a, n0), P(b, n0), P(b, n1), P(a, n1)], cxy);
  }
}
// a railing along a face from u0 to u1 at n: posts, a top rail, a mid rail; bars (cut out) between if asked
// skip: leave out its first or last post, another rail's at the same place (a corner's); a rail stops at a post's side
function railGen(o, F, u0, u1, z0, z1, n, fill = null, skip = [false, false]) {
  const steps = Math.max(1, Math.round((u1 - u0) / 1.5)), us = Array.from({ length: steps + 1 }, (_, i) => u0 + (u1 - u0) * i / steps);
  us.forEach((u, i) => { if ((i === 0 && skip[0]) || (i === steps && skip[1])) return; fbox(o, "rail", F, u - 0.025, u + 0.025, z0, z1, n - 0.025, n + 0.025); });
  const zm = z0 + (z1 - z0) * 0.45;
  for (let i = 0; i < steps; i++) {                                  // the rails between the posts, never into one
    const a = us[i] + 0.025, b = us[i + 1] - 0.025;
    if (b - a < 0.005) continue;
    fbox(o, "rail", F, a, b, z1 - 0.05, z1, n - 0.03, n + 0.03);
    fbox(o, "rail", F, a, b, zm, zm + 0.03, n - 0.015, n + 0.015);
  }
  if (fill) { const P = [fp(F, u0, z0, n), fp(F, u1, z0, n), fp(F, u1, z1 - 0.05, n), fp(F, u0, z1 - 0.05, n)]; two(o, fill, P, [F.N[0], F.N[1], 0]); }
}
// a railing all round a box's top, `inset` in from its edges: one post at each corner, the rails meeting it
function railRound(o, x0, y0, x1, y1, z0, z1, inset = 0.06) {
  for (const F of Object.values(faceFrames(x0, y0, x1, y1, 0))) railGen(o, F, inset, F.W - inset, z0, z1, -inset, null, [false, true]);
}

// ---- roofs -------------------------------------------------------------------------------------------------------------
function roofGen(o, b, T, R) {
  const r = Object.assign({ kind: "flat", parapet: 0.9, pitch: 24, over: 0.45, ridge: "x" }, b.roof || {});
  const { x0, y0, x1, y1 } = T;
  let z = T.z1;
  const things = () => (r.things || []).forEach((t, i) => roofThing(o, t, T, R, `${b.id || "b"}.r${i}`));
  if (r.kind === "flat" || r.kind === "rail" || r.kind === "none") {
    const parapet = r.kind === "flat" && r.parapet > 0.05;
    box(o, "roof_flat", x0, y0, z, x1, y1, z + 0.02, parapet ? "-z-x+x-y+y" : "-z");
    if (parapet) {
      const t = num(r.wall, 0.16), p = num(r.parapet, 0.9), sl = r.slot || "wall", c = 0.03, zc = z + p;
      box(o, sl, x0, y0, z, x1, y0 + t, z + p, "-z"); box(o, sl, x0, y1 - t, z, x1, y1, z + p, "-z");
      box(o, sl, x0, y0 + t, z, x0 + t, y1 - t, z + p, "-z"); box(o, sl, x1 - t, y0 + t, z, x1, y1 - t, z + p, "-z");
      box(o, "trim", x0 - c, y0 - c, zc, x1 + c, y0 + t + c, zc + 0.06); box(o, "trim", x0 - c, y1 - t - c, zc, x1 + c, y1 + c, zc + 0.06);
      box(o, "trim", x0 - c, y0 + t + c, zc, x0 + t + c, y1 - t - c, zc + 0.06); box(o, "trim", x1 - t - c, y0 + t + c, zc, x1 + c, y1 - t - c, zc + 0.06);
    }
    if (r.kind === "rail") railRound(o, x0, y0, x1, y1, z, z + 1.1);
    things();
    return;
  }
  // a pitched roof: its slabs (with the overhang), the gable walls under them, a ridge. Boxed (a walk-in building's): a
  // closed solid on a soffit at the walls' top, a gable's or a shed's ends flush with its walls; its volume returned
  // (half-spaces: inside where n·p <= d) so roofs that meet can be joined into one (joinRoofs)
  const ov = num(r.over, 0.45), tn = Math.tan(clamp(num(r.pitch, 24), 3, 60) * Math.PI / 180), t = 0.14, sl = r.slot || "tiles";
  const alongX = r.ridge !== "y", zw = z, boxed = !!r.boxed;          // zw: the walls' top
  if (boxed) z = z + ov * tn;                                        // the eaves at the walls' top, not under it
  // in the roof's frame: s along the ridge, q across it (half span Q), lift = q's distance from the eave
  const ovS = boxed && r.kind !== "hip" ? 0 : ov;
  const S0 = (alongX ? x0 : y0) - ovS, S1 = (alongX ? x1 : y1) + ovS, Qc = alongX ? (y0 + y1) / 2 : (x0 + x1) / 2, Q = (alongX ? y1 - y0 : x1 - x0) / 2;
  const P = (s, q, zz) => alongX ? [s, Qc + q, zz] : [Qc + q, s, zz];
  const ze = z - ov * tn;                                            // the eave's height (out at the overhang)
  const vol = [hs([0, 0, -1], [0, 0, zw])], vols = [vol];             // over its soffit
  if (r.kind === "gable" || r.kind === "shed") {
    const sides = r.kind === "gable" ? [-1, 1] : [1];
    // a boxed shed's high side: its wall carried up to the slab, no overhang there (a lean-to's)
    const qTop = r.kind === "gable" ? 0 : boxed ? -Q : -Q - ov, rise = r.kind === "gable" ? (Q + ov) * tn : (Q + ov - qTop) * tn, qLo = r.kind === "shed" ? qTop : -Q - ov;
    for (const sd of sides) {
      const qa = sd * (Q + ov), zt = ze + rise;
      const top = [P(S0, qa, ze + t), P(S1, qa, ze + t), P(S1, qTop, zt + t), P(S0, qTop, zt + t)];
      const bot = [P(S0, qa, ze), P(S1, qa, ze), P(S1, qTop, zt), P(S0, qTop, zt)];
      const up = norm(cross(sub(top[1], top[0]), sub(top[3], top[0]))), upn = up[2] > 0 ? up : mul(up, -1);
      poly(o, sl, top, upn); if (!boxed) poly(o, "wood_dark", bot, mul(upn, -1));
      vol.push(hs(upn, top[0]));                                     // under its top
      const outN = alongX ? [0, sd, 0] : [sd, 0, 0];
      poly(o, "wood_dark", [bot[0], bot[1], top[1], top[0]], outN);
      poly(o, "wood_dark", [bot[0], bot[3], top[3], top[0]], alongX ? [-1, 0, 0] : [0, -1, 0]); poly(o, "wood_dark", [bot[1], bot[2], top[2], top[1]], alongX ? [1, 0, 0] : [0, 1, 0]);
    }
    vol.push(hs(alongX ? [-1, 0, 0] : [0, -1, 0], P(S0, 0, 0)), hs(alongX ? [1, 0, 0] : [0, 1, 0], P(S1, 0, 0)),
      hs(alongX ? [0, -1, 0] : [-1, 0, 0], P(S0, qLo, 0)), hs(alongX ? [0, 1, 0] : [1, 0, 0], P(S0, Q + ov, 0)));
    // the gable ends: the wall's triangle between the wall's top and the slope (a shed's: a wedge, high at -q); boxed,
    // from the walls' top up, and a soffit under all of it
    const wsl = b.roofWall || "wall", zu = ze + rise;                 // zu: the slab's underside at its top
    for (const s of [alongX ? x0 : y0, alongX ? x1 : y1]) {
      const outN = alongX ? [s === x0 ? -1 : 1, 0, 0] : [0, s === y0 ? -1 : 1, 0];
      if (boxed) poly(o, wsl, r.kind === "gable" ? [P(s, -Q - ov, zw), P(s, Q + ov, zw), P(s, 0, zu)] : [P(s, Q + ov, zw), P(s, qTop, zw), P(s, qTop, zu)], outN);   // out to the eaves, up to the slab
      else if (r.kind === "gable") poly(o, wsl, [P(s, -Q, z), P(s, Q, z), P(s, 0, z + Q * tn)], outN);
      else poly(o, wsl, [P(s, -Q, z), P(s, Q, z), P(s, -Q, z + 2 * Q * tn)], outN);
    }
    if (r.kind === "shed") {
      const hiN = alongX ? [0, -1, 0] : [-1, 0, 0];
      if (boxed) {                                                   // its high wall up to the slab, the slab's edge over it
        poly(o, wsl, [P(S0, qTop, zw), P(S1, qTop, zw), P(S1, qTop, zu), P(S0, qTop, zu)], hiN);
        poly(o, "wood_dark", [P(S0, qTop, zu), P(S1, qTop, zu), P(S1, qTop, zu + t), P(S0, qTop, zu + t)], hiN);
      }
      else poly(o, wsl, [P(S0 + ov, -Q, zw), P(S1 - ov, -Q, zw), P(S1 - ov, -Q, z + 2 * Q * tn), P(S0 + ov, -Q, z + 2 * Q * tn)], hiN);
    }
    if (boxed) poly(o, "wood_dark", [P(S0, qLo, zw), P(S1, qLo, zw), P(S1, Q + ov, zw), P(S0, Q + ov, zw)], [0, 0, -1]);
    if (r.kind === "gable") {
      const zr = ze + (Q + ov) * tn + t + 0.03;
      bar(o, sl, P(S0 - 0.03, 0, zr), P(S1 + 0.03, 0, zr), 0.16, 0.16);
      vols.push([hs([0, 0, 1], [0, 0, zr + 0.08]), hs([0, 0, -1], [0, 0, zr - 0.08]), hs(alongX ? [-1, 0, 0] : [0, -1, 0], P(S0 - 0.03, 0, 0)), hs(alongX ? [1, 0, 0] : [0, 1, 0], P(S1 + 0.03, 0, 0)),
        hs(alongX ? [0, -1, 0] : [-1, 0, 0], P(S0, -0.08, 0)), hs(alongX ? [0, 1, 0] : [1, 0, 0], P(S0, 0.08, 0))]);   // its ridge's, two ridges crossing
    }
  } else if (r.kind === "hip") {                                     // four slopes to a short ridge, closed underneath
    const L = (S1 - S0) / 2, run = Q + ov, rl = Math.max(0, L - run), Sc = (S0 + S1) / 2, zt = ze + run * tn;
    const E = [P(S0, -run, ze), P(S1, -run, ze), P(S1, run, ze), P(S0, run, ze)], Ra = P(Sc - rl, 0, zt), Rb = P(Sc + rl, 0, zt);
    for (const F of [[E[0], E[1], Rb, Ra], [E[2], E[3], Ra, Rb], [E[1], E[2], Rb], [E[3], E[0], Ra]]) {
      poly(o, sl, F, null);
      const n = norm(cross(sub(F[1], F[0]), sub(F[2], F[0]))); vol.push(hs(n[2] > 0 ? n : mul(n, -1), F[0]));   // under each slope
    }
    poly(o, "wood_dark", E.slice(), [0, 0, -1]);
    // make sure the slopes face up and out
    fixUp(o, sl);
  }
  things();
  return boxed ? vols : null;
}
// a half-space through p, n out of it: [nx, ny, nz, d], inside where n·p <= d
const hs = (n, p) => { const u = norm(n); return [u[0], u[1], u[2], dot(u, p)]; };
// ---- joining roofs that overlap: each cut away where it's inside another's volume. On a face of both (two slopes in
// one plane, two soffits) the first keeps it and the other's is cut; two faces back to back are both cut
const HS_EPS = 1e-6;
const lerpV = (a, b, t) => ({ p: a.p.map((x, k) => x + (b.p[k] - x) * t), n: norm(a.n.map((x, k) => x + (b.n[k] - x) * t)), uv: a.uv.map((x, k) => x + (b.uv[k] - x) * t) });
function clipPoly(P, h, keepOut) {                                   // a convex polygon's part on one side of h's plane (the plane counts on both)
  const res = [], side = v => { const s = h[0] * v.p[0] + h[1] * v.p[1] + h[2] * v.p[2] - h[3]; return Math.abs(s) < HS_EPS ? 0 : keepOut ? s : -s; };
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], sa = side(a), sb = side(b);
    if (sa >= 0) res.push(a);
    if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) res.push(lerpV(a, b, sa / (sa - sb)));
  }
  return res;
}
function emitPoly(o, slot, P) {
  let ar = [0, 0, 0]; for (let i = 1; i + 1 < P.length; i++) ar = add(ar, cross(sub(P[i].p, P[0].p), sub(P[i + 1].p, P[0].p)));
  if (Math.hypot(...ar) < 1e-8) return;                              // a sliver along a plane: nothing
  const g = buf(o, slot), base = g.pos.length / 3;
  for (const v of P) { g.pos.push(...v.p); g.nrm.push(...v.n); g.uv.push(...v.uv); }
  for (let i = 1; i + 1 < P.length; i++) g.idx.push(base, base + i, base + i + 1);
}
function clipOutside(src, vol, first) {
  const o = out();
  for (const [slot, g] of Object.entries(src.G)) for (let i = 0; i < g.idx.length; i += 3) {
    let P = [0, 1, 2].map(k => { const j = g.idx[i + k]; return { p: [g.pos[j * 3], g.pos[j * 3 + 1], g.pos[j * 3 + 2]], n: [g.nrm[j * 3], g.nrm[j * 3 + 1], g.nrm[j * 3 + 2]], uv: [g.uv[j * 2], g.uv[j * 2 + 1]] }; });
    const fn = norm(cross(sub(P[1].p, P[0].p), sub(P[2].p, P[0].p)));
    for (const h of vol) {                                           // outside = outside the first half-space, or inside it and outside the next...
      if (P.every(v => Math.abs(h[0] * v.p[0] + h[1] * v.p[1] + h[2] * v.p[2] - h[3]) < HS_EPS)) {
        if (first && fn[0] * h[0] + fn[1] * h[1] + fn[2] * h[2] > 0) { emitPoly(o, slot, P); P = null; break; }
        continue;
      }
      const outside = clipPoly(P, h, true);
      if (outside.length >= 3) emitPoly(o, slot, outside);
      P = clipPoly(P, h, false);
      if (P.length < 3) { P = null; break; }
    }                                                                // what's left is inside it: gone
  }
  o.signs = src.signs; o.lights = src.lights;
  return o;
}
function mergeInto(o, src) {
  for (const [slot, g] of Object.entries(src.G)) {
    const d = buf(o, slot), base = d.pos.length / 3;
    d.pos.push(...g.pos); d.nrm.push(...g.nrm); d.uv.push(...g.uv); for (const i of g.idx) d.idx.push(base + i);
  }
}
// roofs built apart ({o, vols}), joined: each cut where it's inside another
function joinRoofs(o, built) {
  built.forEach((A, i) => { let g = A.o; built.forEach((B, j) => { if (j !== i) for (const v of B.vols || []) g = clipOutside(g, v, i < j); }); mergeInto(o, g); });
}
// ---- an outline of upright rectangles [x0, y0, x1, y1] joined: as rectangles that don't overlap (rows of cells, carried
// up), as bars each as long as it can run one way (an L: its two), and its edges (a face frame each, walked with the
// inside on the left, its ends' corners convex or not)
function runsMerged(n1, n2, at) {                                    // runs along a (cells covered), carried across b while the same
  const res = []; let open = [];
  for (let b = 0; b <= n2; b++) {
    const runs = [];
    if (b < n2) for (let a = 0; a < n1; a++) if (at(a, b)) { const l = runs[runs.length - 1]; if (l && l[1] === a) l[1] = a + 1; else runs.push([a, a + 1]); }
    const next = runs.map(([p, q]) => { const k = open.find(r => r.p === p && r.q === q); if (k) { k.b1 = b + 1; return k; } return { p, q, b0: b, b1: b + 1 }; });
    for (const k of open) if (!next.includes(k)) res.push(k);
    open = next;
  }
  return res;
}
export function rectUnion(R) {
  const snap = v => Math.round(v * 1e4) / 1e4;
  const xs = [...new Set(R.flatMap(r => [snap(r[0]), snap(r[2])]))].sort((a, b) => a - b), ys = [...new Set(R.flatMap(r => [snap(r[1]), snap(r[3])]))].sort((a, b) => a - b);
  const nx = xs.length - 1, ny = ys.length - 1;
  const C = Array.from({ length: nx }, (_, i) => Array.from({ length: ny }, (_, j) => { const x = (xs[i] + xs[i + 1]) / 2, y = (ys[j] + ys[j + 1]) / 2; return R.some(r => x > r[0] && x < r[2] && y > r[1] && y < r[3]); }));
  const cov = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && C[i][j];
  const rects = runsMerged(nx, ny, cov).map(k => [xs[k.p], ys[k.b0], xs[k.q], ys[k.b1]]);
  const cols = runsMerged(ny, nx, (j, i) => cov(i, j)).map(k => [xs[k.b0], ys[k.p], xs[k.b1], ys[k.q]]);
  const inside = (a, b) => a[0] >= b[0] - 1e-6 && a[1] >= b[1] - 1e-6 && a[2] <= b[2] + 1e-6 && a[3] <= b[3] + 1e-6;
  const all = rects.concat(cols), bars = all.filter((a, i) => !all.some((b, j) => j !== i && inside(a, b) && (!inside(b, a) || j < i)));
  const convex = (x, y) => { const i = xs.indexOf(x), j = ys.indexOf(y); return [cov(i - 1, j - 1), cov(i, j - 1), cov(i - 1, j), cov(i, j)].filter(Boolean).length !== 3; };
  const edges = [];
  const run = (axis, n, at, from, to) => {
    const U = [-n[1], n[0]], A = axis === "x" ? [from, at] : [at, from], B = axis === "x" ? [to, at] : [at, to];
    const fwd = (B[0] - A[0]) * U[0] + (B[1] - A[1]) * U[1] > 0, P0 = fwd ? A : B, P1 = fwd ? B : A;
    edges.push({ axis, F: { name: "edge", o: [P0[0], P0[1], 0], U: [U[0], U[1], 0], N: [n[0], n[1], 0], W: Math.abs(to - from) }, cv: [convex(...P0), convex(...P1)] });
  };
  for (let j = 0; j <= ny; j++) for (const sd of [-1, 1]) {        // along x at ys[j]: sd -1 the cells above it inside
    let a = null;
    for (let i = 0; i <= nx; i++) {
      const on = i < nx && (sd < 0 ? cov(i, j) && !cov(i, j - 1) : cov(i, j - 1) && !cov(i, j));
      if (on && a === null) a = i;
      if (!on && a !== null) { run("x", [0, sd], ys[j], xs[a], xs[i]); a = null; }
    }
  }
  for (let i = 0; i <= nx; i++) for (const sd of [-1, 1]) {        // along y at xs[i]
    let a = null;
    for (let j = 0; j <= ny; j++) {
      const on = j < ny && (sd < 0 ? cov(i, j) && !cov(i - 1, j) : cov(i - 1, j) && !cov(i, j));
      if (on && a === null) a = j;
      if (!on && a !== null) { run("y", [sd, 0], xs[i], ys[a], ys[j]); a = null; }
    }
  }
  return { rects, bars, edges };
}
// a flat roof over an outline that isn't a box: its slab in rectangles that don't overlap, the parapet (or the rail) round
// the outline only; the walls along x take the corners and those along y stop short of them, and their coping the same
function flatRoofOver(o, U, z, roof, wallSlot) {
  const parapet = roof.kind === "flat" && num(roof.parapet, 0.5) > 0.05, p = num(roof.parapet, 0.5), t = 0.12, c = 0.03, zc = z + p;
  for (const [x0, y0, x1, y1] of U.rects) box(o, "roof_flat", x0, y0, z, x1, y1, z + 0.02, "-z-x+x-y+y");
  for (const e of U.edges) {
    const F = e.F, ax = e.axis === "x", [c0, c1] = e.cv;
    if (parapet) {
      fbox(o, wallSlot, F, ax ? (c0 ? 0 : -t) : (c0 ? t : 0), F.W + (ax ? (c1 ? 0 : t) : (c1 ? -t : 0)), z, zc, -t, 0, "-z");
      fbox(o, "trim", F, ax ? (c0 ? -c : -t - c) : (c0 ? t + c : c), F.W + (ax ? (c1 ? c : t + c) : (c1 ? -t - c : -c)), zc, zc + 0.06, -t - c, c);
      continue;
    }
    fquad(o, "roof_flat", F, 0, F.W, z, z + 0.02, 0);                // the slab's edge
    if (roof.kind === "rail") railGen(o, F, c0 ? 0.06 : -0.06, F.W - (c1 ? 0.06 : -0.06), z, z + 1.1, -0.06, null, [false, true]);
  }
}
function fixUp(o, slot) {                                            // flip any triangle of a slot that faces down
  const g = o.G[slot]; if (!g) return;
  for (let i = 0; i < g.idx.length; i += 3) {
    const [a, b, c] = [g.idx[i], g.idx[i + 1], g.idx[i + 2]].map(k => [g.pos[k * 3], g.pos[k * 3 + 1], g.pos[k * 3 + 2]]);
    const n = cross(sub(b, a), sub(c, a));
    if (n[2] < 0) { [g.idx[i + 1], g.idx[i + 2]] = [g.idx[i + 2], g.idx[i + 1]]; for (const k of [g.idx[i], g.idx[i + 1], g.idx[i + 2]]) { g.nrm[k * 3] *= -1; g.nrm[k * 3 + 1] *= -1; g.nrm[k * 3 + 2] *= -1; } }
  }
  // the normals of a slope: its face's own
  for (let i = 0; i < g.idx.length; i += 3) {
    const ks = [g.idx[i], g.idx[i + 1], g.idx[i + 2]], [a, b, c] = ks.map(k => [g.pos[k * 3], g.pos[k * 3 + 1], g.pos[k * 3 + 2]]);
    const n = norm(cross(sub(b, a), sub(c, a)));
    if (n[2] > 0) for (const k of ks) { g.nrm[k * 3] = n[0]; g.nrm[k * 3 + 1] = n[1]; g.nrm[k * 3 + 2] = n[2]; }
  }
}
export const ROOF_THINGS = { tank: "water tank", ac: "AC units", antenna: "antenna", hut: "stair hut", billboard: "billboard", mast: "mast" };
function roofThing(o, t, T, R, key) {
  const z = T.z1, cx = (T.x0 + T.x1) / 2 + num(t.x, 0), cy = (T.y0 + T.y1) / 2 + num(t.y, 0);
  switch (t.kind) {
    case "tank": {
      const w = num(t.w, 2), d = num(t.d, 1.4), h = num(t.h, 1.4), leg = num(t.leg, 0.9);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(o, "steel", cx + sx * (w / 2 - 0.1) - 0.04, cy + sy * (d / 2 - 0.1) - 0.04, z, cx + sx * (w / 2 - 0.1) + 0.04, cy + sy * (d / 2 - 0.1) + 0.04, z + leg - 0.08);
      box(o, "steel", cx - w / 2, cy - d / 2, z + leg - 0.08, cx + w / 2, cy + d / 2, z + leg);
      box(o, t.slot || "tank", cx - w / 2 + 0.05, cy - d / 2 + 0.05, z + leg, cx + w / 2 - 0.05, cy + d / 2 - 0.05, z + leg + h);
      break;
    }
    case "ac": { const n = Math.max(1, Math.round(num(t.n, 3))); for (let i = 0; i < n; i++) { const x = cx + (i - (n - 1) / 2) * 1.0; box(o, "ac", x - 0.42, cy - 0.15, z + 0.1, x + 0.42, cy + 0.15, z + 0.72); box(o, "steel", x - 0.45, cy - 0.2, z, x + 0.45, cy + 0.2, z + 0.1); } break; }
    case "antenna": { const h = num(t.h, 3); cyl(o, "steel", [cx, cy, z], [cx, cy, z + h], 0.03, 6); for (let i = 0; i < 3; i++) bar(o, "steel", [cx - 0.6 + i * 0.1, cy, z + h - 0.3 - i * 0.35], [cx + 0.6 - i * 0.1, cy, z + h - 0.3 - i * 0.35], 0.02); break; }
    case "mast": { const h = num(t.h, 5); cyl(o, "steel", [cx, cy, z], [cx, cy, z + h], 0.06, 6, 0.03); break; }
    case "hut": {
      const w = num(t.w, 2.6), d = num(t.d, 3), h = num(t.h, 2.6);
      box(o, t.slot || "wall", cx - w / 2, cy - d / 2, z, cx + w / 2, cy + d / 2, z + h, "-z");
      box(o, "trim", cx - w / 2 - 0.05, cy - d / 2 - 0.05, z + h, cx + w / 2 + 0.05, cy + d / 2 + 0.05, z + h + 0.12);
      box(o, "door", cx - 0.45, cy - d / 2 - 0.02, z, cx + 0.45, cy - d / 2 + 0.01, z + 2.0, "");
      break;
    }
    case "billboard": {
      const w = num(t.w, 5), h = num(t.h, 2.2), lift = num(t.lift, 1.2);
      for (const sx of [-1, 1]) { box(o, "steel", cx + sx * (w / 2 - 0.3) - 0.05, cy - 0.05, z, cx + sx * (w / 2 - 0.3) + 0.05, cy + 0.05, z + lift + h - 0.1); bar(o, "steel", [cx + sx * (w / 2 - 0.3), cy + 0.7, z], [cx + sx * (w / 2 - 0.3), cy, z + lift + h * 0.6], 0.05); }
      box(o, "black", cx - w / 2, cy - 0.1, z + lift, cx + w / 2, cy + 0.02, z + lift + h);
      o.signs.push({ key, text: t.text || "", fg: t.fg || "#ffffff", bg: t.bg || "#2a2a2e", lit: t.lit !== false, dir: "h", w, h });
      const fy = cy - 0.1 - GAP;
      poly(o, "sign:" + key, [[cx - w / 2 + 0.05, fy, z + lift + 0.05], [cx + w / 2 - 0.05, fy, z + lift + 0.05], [cx + w / 2 - 0.05, fy, z + lift + h - 0.05], [cx - w / 2 + 0.05, fy, z + lift + h - 0.05]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      break;
    }
    default: break;
  }
  void R;
}

// ---- a building --------------------------------------------------------------------------------------------------------
export function buildingParts(b, foot) {
  if (b.inside && Array.isArray(b.inside.rooms) && b.inside.rooms.length) return insideParts(b, foot);
  const o = out(), R = rng(num(b.seed, 1)), { rows, tiers } = floorsOf(b);
  const drop = foot ? foot.z - foot.low : 0;
  if (drop > 0.03) {                                                  // on a slope: its walls carried down to the lowest ground under it
    const T0 = tiers[0];
    for (const F of Object.values(faceFrames(T0.x0, T0.y0, T0.x1, T0.y1, 0))) fquad(o, b.plinth || "plinth", F, 0, F.W, -drop - 0.05, 0, 0);
  }
  const parts = partCopies(Array.isArray(b.parts) ? b.parts : []);
  const signs = o.signs;
  tiers.forEach((T, ti) => {
    const frames = faceFrames(T.x0, T.y0, T.x1, T.y1, 0);
    for (const name of FACES) {
      const F = frames[name], s = faceSettings(b, name), fparts = parts.filter(p => (p.face || "front") === name && (p.tier || 0) === ti);
      const H = [];
      for (const r of T.rows) {
        const over = (s.floors || {})[r.k], sr = over ? Object.assign({}, s, typeof over === "string" ? { win: over } : over) : s;
        H.push(...floorHoles(sr, F.W, r, R));
      }
      const PH = partHoles(b, F, fparts, T.rows, R);
      // a part's opening takes the place of the floor's own windows it overlaps
      const keep = H.filter(h => !PH.some(q => q.u0 < h.u1 && q.u1 > h.u0 && q.z0 < h.z1 && q.z1 > h.z0));
      const all = keep.concat(PH);
      for (const r of T.rows) {
        const wsl = r.k === 1 && s.groundSlot ? s.groundSlot : s.slot || "wall";
        for (const [a, bb, p, q] of wallRects(F.W, r.z0, r.z0 + r.h, all)) fquad(o, wsl, F, a, bb, p, q, 0);
      }
      for (const h of all) holeGen(o, F, h, R);
      if (s.bands) for (const r of T.rows.slice(1)) fbox(o, "trim", F, -0.04, F.W + 0.04, r.z0 - 0.12, r.z0 + 0.06, 0, 0.07, nKey(F, -1));
      if (s.win === "fins" || (s.floors && Object.values(s.floors).includes("fins"))) {
        const pitch = num(s.pitch, 0.9), n = Math.max(2, Math.round(F.W / pitch));
        for (const r of T.rows) {
          const st = ((s.floors || {})[r.k] && ((s.floors || {})[r.k].win || (s.floors || {})[r.k])) || (r.k === 1 && s.ground !== "same" ? "g" : s.win);
          if (st !== "fins") continue;
          for (let i = 0; i <= n; i++) { const u = clamp(F.W * i / n, 0.04, F.W - 0.04); fbox(o, s.finSlot || "trim", F, u - 0.04, u + 0.04, r.z0, r.z0 + r.h, 0, num(s.fin, 0.3), ""); }
        }
      }
      for (const p of fparts) partGen(o, b, F, p, T.rows, R, signs, fparts);
    }
    if (ti < tiers.length - 1) {                                      // a setback: the terrace left on this tier's top
      const t = tiers[ti + 1];
      const kind = (t.t && t.t.edge) || "rail";
      box(o, "roof_flat", T.x0, T.y0, T.z1, T.x1, T.y1, T.z1 + 0.02, kind === "rail" ? "-z" : "-z-x+x-y+y");
      if (kind === "rail") railRound(o, T.x0, T.y0, T.x1, T.y1, T.z1, T.z1 + 1.1);
      else for (const F of Object.values(faceFrames(T.x0, T.y0, T.x1, T.y1, 0))) fbox(o, "wall", F, 0, F.W, T.z1, T.z1 + 0.9, -0.15, 0, "");
    } else roofGen(o, b, T, R);
  });
  box(o, "dark", tiers[0].x0 + 0.01, tiers[0].y0 + 0.01, -0.001, tiers[0].x1 - 0.01, tiers[0].y1 - 0.01, GAP + 0.002, "-x+x-y+y-z");
  void rows;
  return o;
}

// ---- a building with a set's level inside it (docs/STREET_BUILDER.md §5c): the street builds its outside round the
// level's rooms. `inside`: {set, level, rooms (the level's rooms as the page last read them: at, size, ceiling, skip,
// openings), rows (copies side by side), floors (copies stacked: a motel), raise (its floor above the ground), skin}.
// The rooms' outline (any shape the rooms make) gets a wall a little outside the level's own, the level's outside
// doors and windows cut through it at their places and sizes (so the doors are the level's), walls only where the level
// builds them (an open veranda stays open), a plinth to the ground, steps up to a raised floor, a roof. The rooms inside
// are drawn as a dark stand-in (piece `<id>__inside`, never exported: in Godot the level's own scene goes there, at the
// marker `insideMarkers` gives).
export const INSIDE_SKIN = 0.1, INSIDE_GAP = 0.05;                   // the shell's thickness, outside the level's wall's face
const ROOF_GAP = 0.01;                                               // the roof over the level's own top, never in its plane
const LT = 0.1;                                                      // the scene builder's wall (storylib.WALL_T)
// the level's rooms turned so its way in faces the building's front (-y), its middle at the building's middle
export function insideFrame(ins) {
  const all = (ins.rooms || []).filter(r => r.size && r.at), shut = all.filter(r => r.ceiling !== false);
  const zl = [...new Set(shut.map(r => Math.round(num(r.at[2], 0) * 1000) / 1000))].sort((a, b) => a - b);
  if (zl.length > 1) return storeysFrame(ins, all, shut, zl);
  const rooms = (ins.rooms || []).filter(r => Math.abs(num((r.at || [])[2], 0)) < 0.01);
  const xs = rooms.flatMap(r => [r.at[0], r.at[0] + r.size[0]]), ys = rooms.flatMap(r => [r.at[1], r.at[1] + r.size[1]]);
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  // its way in: a door on an outside wall (one called front_* first), else the south
  let side = ins.front;
  if (!side) {                                                        // a door named for it, else one from the genkan or hall
    const out = rooms.flatMap(r => (r.openings || []).filter(o => !o.window && r.ceiling !== false && edgeOutside(rooms, r, o.wall)).map(o => ({ o, w: o.wall, r })));
    const pick = out.find(x => /front|entr|main/i.test((x.o.door && x.o.door.id) || "")) || out.find(x => /genkan|entr|foyer|hall|lobby/i.test(x.r.id || "")) || out[0];
    side = pick ? pick.w : "s";
  }
  const rot = { s: 0, e: 90, n: 180, w: 270 }[side] || 0;           // turned so that side faces -y
  const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, a = -rot * Math.PI / 180, c = Math.round(Math.cos(a)), sn = Math.round(Math.sin(a));
  const toLocal = (x, y) => [(x - cx) * c - (y - cy) * sn, (x - cx) * sn + (y - cy) * c];
  const W = rot % 180 ? box[3] - box[1] : box[2] - box[0], D = rot % 180 ? box[2] - box[0] : box[3] - box[1];
  const H = Math.max(...rooms.filter(r => r.ceiling !== false).map(r => num(r.size[2], 2.6)), 2.4);
  return { rooms, box, rot, toLocal, W, D, H, side, cx, cy };
}
// a set built in storeys (a school's building, SCENE_BUILDER §10b): its storeys (the floors its enclosed rooms stand on;
// a room through several, a stair shaft, stands in each), the roof's level (the top storey's floor and one more storey's
// height, where its stairs land) and what goes on above it (the shafts' penthouses); the box round all of it
function storeysFrame(ins, all, shut, zl) {
  const ground = all.filter(r => Math.abs(num(r.at[2], 0)) < 0.01);
  const xs = all.flatMap(r => [r.at[0], r.at[0] + r.size[0]]), ys = all.flatMap(r => [r.at[1], r.at[1] + r.size[1]]);
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  let side = ins.front;
  if (!side) {
    const out = ground.flatMap(r => (r.openings || []).filter(o => !o.window && r.ceiling !== false && edgeOutside(ground, r, o.wall)).map(o => ({ o, w: o.wall, r })));
    const pick = out.find(x => /front|entr|main/i.test((x.o.door && x.o.door.id) || "")) || out.find(x => /genkan|entr|foyer|hall|lobby/i.test(x.r.id || "")) || out[0];
    side = pick ? pick.w : "s";
  }
  const rot = { s: 0, e: 90, n: 180, w: 270 }[side] || 0;
  const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, a = -rot * Math.PI / 180, c = Math.round(Math.cos(a)), sn = Math.round(Math.sin(a));
  const toLocal = (x, y) => [(x - cx) * c - (y - cy) * sn, (x - cx) * sn + (y - cy) * c];
  const W = rot % 180 ? box[3] - box[1] : box[2] - box[0], D = rot % 180 ? box[2] - box[0] : box[3] - box[1];
  const storeys = zl.map((z, k) => ({ k, z, h: k + 1 < zl.length ? zl[k + 1] - z : z - zl[k - 1],
    rooms: shut.filter(r => num(r.at[2], 0) <= z + 0.3 && num(r.at[2], 0) + num(r.size[2], 2.4) >= z + 1.0) }));
  const top = zl[zl.length - 1] + storeys[storeys.length - 1].h;
  const pent = shut.filter(r => num(r.at[2], 0) + num(r.size[2], 2.4) > top + 1.0);
  const H = Math.max(...storeys[0].rooms.filter(r => Math.abs(num(r.at[2], 0)) < 0.01 && num(r.size[2], 2.4) < storeys[0].h + 0.01).map(r => num(r.size[2], 2.6)), 2.4);
  return { rooms: ground, all, shut, box, rot, toLocal, W, D, H, side, cx, cy, storeys, top, pent };
}
function edgeOutside(rooms, r, wall) {                                // a room's wall with no enclosed room behind it (anywhere along it)
  const [x0, y0] = r.at, [w, d] = r.size, line = { n: [x0, y0 + d, x0 + w, y0 + d], s: [x0, y0, x0 + w, y0], e: [x0 + w, y0, x0 + w, y0 + d], w: [x0, y0, x0, y0 + d] }[wall];
  const mid = [(line[0] + line[2]) / 2, (line[1] + line[3]) / 2], nrm = { n: [0, 1], s: [0, -1], e: [1, 0], w: [-1, 0] }[wall];
  const p = [mid[0] + nrm[0] * 0.05, mid[1] + nrm[1] * 0.05];
  return !rooms.some(q => q !== r && q.ceiling !== false && p[0] > q.at[0] && p[0] < q.at[0] + q.size[0] && p[1] > q.at[1] && p[1] < q.at[1] + q.size[1]);
}
// the enclosed rooms' outline: its edges ({a, b} in the level's space, its outward normal, built or open) and the openings
// on each, found on a grid of the rooms' own edges
export function insideOutline(rooms) {
  const shut = rooms.filter(r => r.ceiling !== false);
  const xs = [...new Set(shut.flatMap(r => [r.at[0], r.at[0] + r.size[0]]).map(v => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
  const ys = [...new Set(shut.flatMap(r => [r.at[1], r.at[1] + r.size[1]]).map(v => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
  const inRoom = (x, y) => shut.some(r => x > r.at[0] && x < r.at[0] + r.size[0] && y > r.at[1] && y < r.at[1] + r.size[1]);
  const cov = (i, j) => i >= 0 && j >= 0 && i < xs.length - 1 && j < ys.length - 1 && inRoom((xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2);
  // a stretch of a room's wall line that the level builds: on that line, along its side, not skipped
  const built = (axis, v, a0, a1) => rooms.some(r => {
    const [x0, y0] = r.at, [w, d] = r.size;
    for (const [wall, lv, lo, hi] of axis === "x" ? [["s", y0, x0, x0 + w], ["n", y0 + d, x0, x0 + w]] : [["w", x0, y0, y0 + d], ["e", x0 + w, y0, y0 + d]]) {
      if (Math.abs(lv - v) > 0.002 || a0 < lo - 0.002 || a1 > hi + 0.002) continue;
      const sk = r.skip || [];
      if (sk.includes(wall)) continue;
      const m = (a0 + a1) / 2 - lo;
      if (sk.some(x => Array.isArray(x) && x[0] === wall && m >= num(x[1], 0) - 0.002 && m <= num(x[2], 0) + 0.002)) continue;
      return true;
    }
    return false;
  });
  const pieces = [];
  for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < ys.length; j++) {
    if (!cov(i, j)) continue;
    if (!cov(i, j - 1)) pieces.push({ axis: "x", v: ys[j], a0: xs[i], a1: xs[i + 1], n: [0, -1] });
    if (!cov(i, j + 1)) pieces.push({ axis: "x", v: ys[j + 1], a0: xs[i], a1: xs[i + 1], n: [0, 1] });
    if (!cov(i - 1, j)) pieces.push({ axis: "y", v: xs[i], a0: ys[j], a1: ys[j + 1], n: [-1, 0] });
    if (!cov(i + 1, j)) pieces.push({ axis: "y", v: xs[i + 1], a0: ys[j], a1: ys[j + 1], n: [1, 0] });
  }
  for (const p of pieces) p.built = built(p.axis, p.v, p.a0, p.a1);
  // merged along their lines (the same side, the same built), each end convex or not (how far the shell runs past it)
  pieces.sort((p, q) => (p.axis + p.n + p.v).localeCompare(q.axis + q.n + q.v) || p.v - q.v || p.a0 - q.a0);
  const edges = [];
  for (const p of pieces) {
    const e = edges[edges.length - 1];
    if (e && e.axis === p.axis && e.v === p.v && e.n[0] === p.n[0] && e.n[1] === p.n[1] && e.built === p.built && Math.abs(e.a1 - p.a0) < 1e-6) e.a1 = p.a1;
    else edges.push(Object.assign({}, p));
  }
  const coveredAt = (x, y) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].filter(([dx, dy]) => inRoom(x + dx * 0.01, y + dy * 0.01)).length;
  for (const e of edges) for (const end of ["a0", "a1"]) {
    const [x, y] = e.axis === "x" ? [e[end], e.v] : [e.v, e[end]];
    e[end === "a0" ? "c0" : "c1"] = coveredAt(x, y) === 3 ? -1 : 1;         // 3 of the 4 squares round it inside: a corner turning in
  }
  // the openings on the outside edges, from whichever room keeps them
  for (const r of rooms) for (const o of r.openings || []) {
    const [x0, y0] = r.at, [w, d] = r.size, at = num(o.at, 0), hw = num(o.w, 0.9) / 2;
    const [axis, v, base] = { n: ["x", y0 + d, x0], s: ["x", y0, x0], e: ["y", x0 + w, y0], w: ["y", x0, y0] }[o.wall] || [];
    if (!axis) continue;
    const e = edges.find(e => e.axis === axis && Math.abs(e.v - v) < 0.002 && base + at > e.a0 - 0.002 && base + at < e.a1 + 0.002);
    if (!e) continue;
    const rz = num((r.at || [])[2], 0);
    (e.holes = e.holes || []).push({ a0: base + at - hw, a1: base + at + hw, z0: rz + num(o.sill, 0), z1: rz + num(o.sill, 0) + num(o.h, 2.1), window: !!o.window, door: o.door || null,
      frame: o.frame || "", round: /porthole/.test(o.frame || "") });
  }
  return { edges, xs, ys };
}
export function insideParts(b, foot) {
  const fr0 = insideFrame(b.inside);
  if (fr0.storeys) return storeysParts(b, foot, fr0);
  const o = out(), ins = b.inside, fr = fr0, { edges } = insideOutline(fr.rooms);
  const rows = Math.max(1, Math.round(num(ins.rows, 1))), floors = Math.max(1, Math.min(4, Math.round(num(ins.floors, 1))));
  const raise = num(ins.raise, 0.15), slab = 0.3, H = fr.H, storey = H + LT + slab, drop = foot ? foot.z - foot.low : 0;
  const skinSlot = ins.slot || "wall", T = INSIDE_SKIN, G = LT / 2 + INSIDE_GAP;      // the shell's face: G out from the room's edge, T thick
  const W = fr.W, D = fr.D, totalW = W * rows;
  const copyAt = (k) => -totalW / 2 + W * (k + 0.5);                 // the copy's middle along the building
  const L2 = (x, y, k) => { const [u, v] = fr.toLocal(x, y); return [u + copyAt(k), v]; };
  const inside = out();
  for (let f = 0; f < floors; f++) {
    const z0 = raise + f * storey, zTop = z0 + H + LT + (f === floors - 1 ? ROOF_GAP : 0);
    for (let k = 0; k < rows; k++) {
      for (const e of edges) {
        // between two copies the walls are shared: the outline's sides that face another copy aren't outside
        const nrmL = (() => { const [u0, v0] = fr.toLocal(0, 0), [u1, v1] = fr.toLocal(e.n[0], e.n[1]); return [u1 - u0, v1 - v0]; })();
        if (Math.abs(nrmL[0]) > 0.5 && ((nrmL[0] < 0 && k > 0) || (nrmL[0] > 0 && k < rows - 1))) continue;
        const [ax, ay] = e.axis === "x" ? [e.a0, e.v] : [e.v, e.a0], [bx, by] = e.axis === "x" ? [e.a1, e.v] : [e.v, e.a1];
        let A = L2(ax, ay, k), B = L2(bx, by, k);
        const N = [nrmL[0], nrmL[1], 0], U = [-N[1], N[0], 0];         // the face runs left to right seen from outside
        const swap = (B[0] - A[0]) * U[0] + (B[1] - A[1]) * U[1] < 0;
        if (swap) [A, B] = [B, A];
        let ext0 = swap ? e.c1 : e.c0, ext1 = swap ? e.c0 : e.c1;
        if (rows > 1) {                                              // an end on a joint with the next copy: it runs on, unbent
          const atL = x => Math.abs(x - (copyAt(k) - W / 2)) < 0.01, atR = x => Math.abs(x - (copyAt(k) + W / 2)) < 0.01;
          for (const [P0, which] of [[A, 0], [B, 1]]) if ((atL(P0[0]) && k > 0) || (atR(P0[0]) && k < rows - 1)) { if (which === 0) ext0 = 0; else ext1 = 0; }
        }
        const len = Math.hypot(B[0] - A[0], B[1] - A[1]), s0 = -(G + T) * Math.max(0, ext0) + (ext0 < 0 ? G : 0), s1 = len + (G + T) * Math.max(0, ext1) - (ext1 < 0 ? G : 0);
        const F = { name: "inside", o: [A[0] + N[0] * G + U[0] * s0, A[1] + N[1] * G + U[1] * s0, 0], U, N, W: s1 - s0 };
        const zb = f === 0 ? -drop - 0.05 : z0 - slab;
        if (!e.built) {                                              // an open side: the shell stops, an end cap each side
          for (const u of [0, F.W]) fbox(o, skinSlot, F, u - 0.001, u + 0.001, zb, zTop, 0, T);
          continue;
        }
        const holes = (e.holes || []).map(h => { const p0 = L2(...(e.axis === "x" ? [h.a0, e.v] : [e.v, h.a0]), k), p1 = L2(...(e.axis === "x" ? [h.a1, e.v] : [e.v, h.a1]), k);
          const u0 = (p0[0] - F.o[0]) * U[0] + (p0[1] - F.o[1]) * U[1], u1 = (p1[0] - F.o[0]) * U[0] + (p1[1] - F.o[1]) * U[1];
          return { u0: Math.min(u0, u1), u1: Math.max(u0, u1), z0: z0 + h.z0, z1: z0 + h.z1, window: h.window }; }).filter(h => h.u1 - h.u0 > 0.05);
        for (const [a, bb, p, q] of wallRects(F.W, zb, zTop, holes.map(h => Object.assign({}, h)))) {
          fquad(o, skinSlot, F, a, bb, p, q, T);
          const c0 = fp(F, a, p, -G + LT / 2), c1 = fp(F, bb, q, T);           // its collider: the level's wall and the shell, as one
          (o.col = o.col || []).push([[Math.min(c0[0], c1[0]), Math.min(c0[1], c1[1]), p], [Math.max(c0[0], c1[0]), Math.max(c0[1], c1[1]), q]]);
        }
        for (const h of holes) {                                     // the hole's sides, from the shell's face back to the level's wall
          const Fh = Object.assign({}, F, { o: [F.o[0] - N[0] * G, F.o[1] - N[1] * G, 0] });
          poly(o, "trim", [fp(Fh, h.u0, h.z0, G + T), fp(Fh, h.u0, h.z0, LT / 2), fp(Fh, h.u0, h.z1, LT / 2), fp(Fh, h.u0, h.z1, G + T)], [U[0], U[1], 0]);
          poly(o, "trim", [fp(Fh, h.u1, h.z0, G + T), fp(Fh, h.u1, h.z0, LT / 2), fp(Fh, h.u1, h.z1, LT / 2), fp(Fh, h.u1, h.z1, G + T)], [-U[0], -U[1], 0]);
          poly(o, "trim", [fp(Fh, h.u0, h.z1, G + T), fp(Fh, h.u1, h.z1, G + T), fp(Fh, h.u1, h.z1, LT / 2), fp(Fh, h.u0, h.z1, LT / 2)], [0, 0, -1]);
          if (h.z0 > z0 + 0.02) poly(o, "trim", [fp(Fh, h.u0, h.z0, G + T), fp(Fh, h.u1, h.z0, G + T), fp(Fh, h.u1, h.z0, LT / 2), fp(Fh, h.u0, h.z0, LT / 2)], [0, 0, 1]);
          else if (f === 0 && raise > 0.12 && !h.window) {            // a step up to a raised floor, under a door
            fbox(o, "concrete", F, h.u0 - 0.15, h.u1 + 0.15, -drop, z0 - Math.min(0.2, raise / 2), T, T + 0.35);
            if (raise > 0.3) fbox(o, "concrete", F, h.u0 - 0.15, h.u1 + 0.15, -drop, z0 - raise + 0.18, T + 0.35, T + 0.65);
          }
        }
        // the floor's edge between the storeys; the faces looking east or west a GAP lower than the others, so where two
        // meet at a corner turning in (an L-shaped set stacked: the school's wing) they're never in one plane
        const zo = Math.abs(N[0]) > 0.5 ? GAP : 0;
        if (f > 0) fbox(o, "trim", F, 0, F.W, z0 - slab - zo, z0 - slab + 0.12 - zo, T, T + 0.06);
      }
      // the stand-in rooms: dark, facing in (the level goes here in Godot)
      for (const r of fr.rooms) {
        if (r.ceiling === false) continue;
        const p0 = L2(r.at[0], r.at[1], k), p1 = L2(r.at[0] + r.size[0], r.at[1] + r.size[1], k), x0 = Math.min(p0[0], p1[0]), x1 = Math.max(p0[0], p1[0]), y0 = Math.min(p0[1], p1[1]), y1 = Math.max(p0[1], p1[1]), h = num(r.size[2], H);
        poly(inside, "inside_floor", [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, 1]);
        poly(inside, "inside", [[x0, y0, z0 + h], [x1, y0, z0 + h], [x1, y1, z0 + h], [x0, y1, z0 + h]], [0, 0, -1]);
        poly(inside, "inside", [[x0, y0, z0], [x1, y0, z0], [x1, y0, z0 + h], [x0, y0, z0 + h]], [0, 1, 0]); poly(inside, "inside", [[x0, y1, z0], [x1, y1, z0], [x1, y1, z0 + h], [x0, y1, z0 + h]], [0, -1, 0]);
        poly(inside, "inside", [[x0, y0, z0], [x0, y1, z0], [x0, y1, z0 + h], [x0, y0, z0 + h]], [1, 0, 0]); poly(inside, "inside", [[x1, y0, z0], [x1, y1, z0], [x1, y1, z0 + h], [x1, y0, z0 + h]], [-1, 0, 0]);
      }
    }
  }
  // the roof: over the outline's box when the rooms fill most of it, else over each room. Pitched roofs are boxed (on a
  // flat soffit at the walls' top: nothing of them below it, nothing of the level above it); a flat one's slab on the walls
  const zTop = raise + (floors - 1) * storey + H + LT + ROOF_GAP, shut = fr.rooms.filter(r => r.ceiling !== false);
  const sb = [Math.min(...shut.map(r => r.at[0])), Math.min(...shut.map(r => r.at[1])), Math.max(...shut.map(r => r.at[0] + r.size[0])), Math.max(...shut.map(r => r.at[1] + r.size[1]))];
  const area = shut.reduce((a, r) => a + r.size[0] * r.size[1], 0), boxA = (sb[2] - sb[0]) * (sb[3] - sb[1]);
  const roof = Object.assign({ kind: "hip", pitch: 24, over: 0.6 }, b.roof || {});
  const c0 = [L2(sb[0], sb[1], 0), L2(sb[2], sb[3], 0)], c1 = [L2(sb[0], sb[1], rows - 1), L2(sb[2], sb[3], rows - 1)], all = [...c0, ...c1];
  const tiers = area / boxA > 0.85 ? [{ x0: Math.min(...all.map(p => p[0])) - G - T, y0: Math.min(...all.map(p => p[1])) - G - T, x1: Math.max(...all.map(p => p[0])) + G + T, y1: Math.max(...all.map(p => p[1])) + G + T, z1: zTop }]
    : [].concat(...Array.from({ length: rows }, (_, k) => shut.map(r => { const p0 = L2(r.at[0], r.at[1], k), p1 = L2(r.at[0] + r.size[0], r.at[1] + r.size[1], k); return { x0: Math.min(p0[0], p1[0]) - G - T, y0: Math.min(p0[1], p1[1]) - G - T, x1: Math.max(p0[0], p1[0]) + G + T, y1: Math.max(p0[1], p1[1]) + G + T, z1: zTop }; })));
  const flat = roof.kind === "flat" || roof.kind === "rail" || roof.kind === "none", parapet = roof.kind === "flat" && num(roof.parapet, 0.5) > 0.05;
  const roofOf = (t, extra) => roofGen(out2(t), Object.assign({}, b, { id: b.id, roof: Object.assign({}, roof, { things: [], boxed: !flat, wall: 0.12, parapet: num(roof.parapet, 0.5), slot: flat ? skinSlot : roof.slot }, extra), roofWall: skinSlot }), Object.assign({ z0: 0 }, t), rng(1));
  let into = o; const out2 = () => into;
  if (tiers.length === 1) roofOf(tiers[0], {});
  else {                                                             // rooms that don't fill their box: one roof over their outline
    const U = rectUnion(tiers.map(t => [t.x0, t.y0, t.x1, t.y1]));
    if (flat) flatRoofOver(o, U, zTop, roof, skinSlot);
    else {                                                           // a pitched one over each bar of it (an L's two), joined
      const bars = U.bars.map(r => ({ r: r.slice(), alongX: r[2] - r[0] >= r[3] - r[1] })).sort((a, c) => (c.r[2] - c.r[0]) * (c.r[3] - c.r[1]) - (a.r[2] - a.r[0]) * (a.r[3] - a.r[1]));
      // a gable's or a slope's wing starts at the ridge of the bigger roof it runs into, its one end out in the open (an
      // L's, a T's); hips join whole
      if (roof.kind !== "hip") bars.forEach((a, i) => { for (const m of bars.slice(0, i)) {
        if (m.alongX === a.alongX || !(a.r[0] < m.r[2] - 1e-6 && a.r[2] > m.r[0] + 1e-6 && a.r[1] < m.r[3] - 1e-6 && a.r[3] > m.r[1] + 1e-6)) continue;
        const k = a.alongX ? 0 : 1, mc = (m.r[k] + m.r[k + 2]) / 2;
        if (a.r[k] >= m.r[k] - 1e-6 && a.r[k + 2] > m.r[k + 2] + 1e-6) a.r[k] = Math.max(a.r[k], mc);
        else if (a.r[k + 2] <= m.r[k + 2] + 1e-6 && a.r[k] < m.r[k] - 1e-6) a.r[k + 2] = Math.min(a.r[k + 2], mc);
      } });
      joinRoofs(o, bars.map(({ r, alongX }) => {
        into = out();
        const vols = roofOf({ x0: r[0], y0: r[1], x1: r[2], y1: r[3], z1: zTop }, { ridge: alongX ? "x" : "y" });
        return { o: into, vols };
      }));
    }
  }
  // its own parts (a walkway, stairs, a canopy, signs...) on the box round it all
  const R = rng(num(b.seed, 1)), frames = faceFrames(-totalW / 2 - G - T, -D / 2 - G - T, totalW / 2 + G + T, D / 2 + G + T, 0);
  const ps = partCopies(b.parts);
  for (const p of ps) partGen(o, b, frames[p.face || "front"], p, insideFloors(b), R, o.signs, ps.filter(q => (q.face || "front") === (p.face || "front")));
  o.inside = inside;
  return o;
}
// ---- a set built in storeys (SCENE_BUILDER §10b, STREET_BUILDER §5f: a school's building; the user, 2026-11-01: "the
// school building needs to be to scale, so the actual rooms could fit in"): the shell storey by storey round each one's
// own rooms (a stair shaft stands in all of them), every door and window cut at its own height, what the outside's
// `facade` asks for on its faces (eaves over the windows, pilasters at the rooms' joints and between the windows, the
// floors' edges, guard rails at low windows), a flat roof at the roof's level whose parapet, coping and railing run round
// it but never along a penthouse (the stair shafts going on up through the roof, their own walls and roofs). Seen from
// the street the windows show their sashes and glass and the rooms are dark, as stand-ins (`inside`, never exported: in
// Godot the level's own windows and rooms are there)
const INFILL = {
  window_classroom: { cols: 2, split: 0.68, slot: "alu" }, window_ribbon: { cols: 2, split: 0.76, slot: "alu" }, window_slide: { cols: 2, slot: "alu" },
  window_corridor: { cols: 2, split: 0.64, slot: "alu", glass: "glass_frost" }, window_wired: { cols: 1, slot: "alu", glass: "glass_wire" },
  window_steel: { cols: 4, rows: 3, slot: "steel_sash" }, window_big: { cols: 2, slot: "frame" }, window_small: { cols: 1, slot: "frame" }, window_fixed: { cols: 1, slot: "frame" },
};
export const FACADE_DEFAULT = { eaves: false, pilasters: false, bands: false, rails: false };
export function roofTopOf(b) {                                       // how far the parapet and its coping stand over the roof
  const roof = b.roof || {};
  return roof.kind === "flat" || !roof.kind ? num(roof.parapet, 0.6) + 0.06 : 0;
}
function storeysParts(b, foot, fr) {
  const o = out(), inside = out(), ins = b.inside, R = rng(num(b.seed, 1));
  const raise = num(ins.raise, 0.15), drop = foot ? foot.z - foot.low : 0, skin = ins.slot || "wall", T = INSIDE_SKIN, G = LT / 2 + INSIDE_GAP;
  const fac = Object.assign({}, FACADE_DEFAULT, b.facade || {}), roof = Object.assign({ kind: "flat", parapet: 0.6 }, b.roof || {});
  const NS = fr.storeys.length, top = raise + fr.top;
  const pentTop = fr.pent.length ? raise + Math.max(...fr.pent.map(r => num(r.at[2], 0) + num(r.size[2], 2.4))) + LT + ROOF_GAP : 0;
  const L2 = (x, y) => fr.toLocal(x, y);
  const grow = (r, g) => { const p0 = L2(r.at[0], r.at[1]), p1 = L2(r.at[0] + r.size[0], r.at[1] + r.size[1]); return [Math.min(p0[0], p1[0]) - g, Math.min(p0[1], p1[1]) - g, Math.max(p0[0], p1[0]) + g, Math.max(p0[1], p1[1]) + g]; };
  const pentR = fr.pent.map(r => grow(r, G + T));
  // an outline's edge as a face (from outside: left to right), its corners run on or cut back as the old shell's
  const faceOf = (e) => {
    const [ax, ay] = e.axis === "x" ? [e.a0, e.v] : [e.v, e.a0], [bx, by] = e.axis === "x" ? [e.a1, e.v] : [e.v, e.a1];
    let A = L2(ax, ay), B = L2(bx, by);
    const [u0, v0] = L2(0, 0), [u1, v1] = L2(e.n[0], e.n[1]), N = [u1 - u0, v1 - v0, 0], U = [-N[1], N[0], 0];
    const swap = (B[0] - A[0]) * U[0] + (B[1] - A[1]) * U[1] < 0; if (swap) [A, B] = [B, A];
    const ext0 = swap ? e.c1 : e.c0, ext1 = swap ? e.c0 : e.c1, len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const s0 = -(G + T) * Math.max(0, ext0) + (ext0 < 0 ? G : 0), s1 = len + (G + T) * Math.max(0, ext1) - (ext1 < 0 ? G : 0);
    const F = { name: "inside", o: [A[0] + N[0] * G + U[0] * s0, A[1] + N[1] * G + U[1] * s0, 0], U, N, W: s1 - s0 };
    const toU = (x, y) => { const p = L2(x, y); return (p[0] - F.o[0]) * U[0] + (p[1] - F.o[1]) * U[1]; };
    return { F, A, B, N, U, swap, ext0, ext1, toU, s0, len };
  };
  const bands = fr.storeys.map((st, k) => ({ k, rooms: st.rooms, zf: raise + st.z, zb: k === 0 ? -drop - 0.05 : raise + st.z, zt: raise + st.z + st.h, h: st.h }));
  if (fr.pent.length) bands.push({ k: NS, pent: true, rooms: fr.pent, zf: top, zb: top + ROOF_GAP, zt: pentTop, h: pentTop - top });
  const colSpots = {};                                                // a face's pilasters, by its line: the same up every storey
  for (const bd of bands) {
    const { edges } = insideOutline(bd.rooms);
    for (const e of edges) {
      const fc = faceOf(e), { F, N, U } = fc, zb = bd.zb, last = bd.k === NS - 1;
      if (!e.built) { for (const u of [0, F.W]) fbox(o, skin, F, u - 0.001, u + 0.001, zb, bd.zt, 0, T); continue; }
      // this storey's holes (a shaft's at every height: only those in this storey's height)
      const cut = (e.holes || []).filter(h => raise + h.z1 > bd.zb + 0.01 && raise + h.z0 < bd.zt + (last ? ROOF_GAP : 0) - 0.01).map(h => {
        const p0 = e.axis === "x" ? [h.a0, e.v] : [e.v, h.a0], p1 = e.axis === "x" ? [h.a1, e.v] : [e.v, h.a1], u0 = fc.toU(...p0), u1 = fc.toU(...p1);
        return { u0: Math.min(u0, u1), u1: Math.max(u0, u1), z0: raise + h.z0, z1: raise + h.z1, window: h.window, frame: h.frame, round: h.round, door: h.door,
                 own: raise + h.z0 >= bd.zf - 0.01 && raise + h.z0 < bd.zt - 0.05 };
      }).filter(h => h.u1 - h.u0 > 0.05);
      const holes = cut.filter(h => h.own);
      // the top storey's wall stops at the roof where a penthouse goes on up (its own walls carry on), else at the roof
      const zt = bd.zt + (last ? ROOF_GAP : 0);
      for (const [a, bb, p, q] of wallRects(F.W, zb, zt, cut.map(h => Object.assign({}, h, { z0: Math.max(h.z0, zb), z1: Math.min(h.z1, zt) })))) {
        fquad(o, skin, F, a, bb, p, q, T);
        const c0 = fp(F, a, p, -G + LT / 2), c1 = fp(F, bb, q, T);
        (o.col = o.col || []).push([[Math.min(c0[0], c1[0]), Math.min(c0[1], c1[1]), p], [Math.max(c0[0], c1[0]), Math.max(c0[1], c1[1]), q]]);
      }
      const Fh = Object.assign({}, F, { o: [F.o[0] - N[0] * G, F.o[1] - N[1] * G, 0] });
      for (const h of holes) {
        if (h.round) { portholeGen(o, inside, F, h, G, T); continue; }
        poly(o, "trim", [fp(Fh, h.u0, h.z0, G + T), fp(Fh, h.u0, h.z0, LT / 2), fp(Fh, h.u0, h.z1, LT / 2), fp(Fh, h.u0, h.z1, G + T)], [U[0], U[1], 0]);
        poly(o, "trim", [fp(Fh, h.u1, h.z0, G + T), fp(Fh, h.u1, h.z0, LT / 2), fp(Fh, h.u1, h.z1, LT / 2), fp(Fh, h.u1, h.z1, G + T)], [-U[0], -U[1], 0]);
        poly(o, "trim", [fp(Fh, h.u0, h.z1, G + T), fp(Fh, h.u1, h.z1, G + T), fp(Fh, h.u1, h.z1, LT / 2), fp(Fh, h.u0, h.z1, LT / 2)], [0, 0, -1]);
        if (h.z0 > bd.zf + 0.02) poly(o, "trim", [fp(Fh, h.u0, h.z0, G + T), fp(Fh, h.u1, h.z0, G + T), fp(Fh, h.u1, h.z0, LT / 2), fp(Fh, h.u0, h.z0, LT / 2)], [0, 0, 1]);
        else if (bd.k === 0 && raise > 0.12 && !h.window) {        // a step up to the raised floor, under a door
          fbox(o, "concrete", F, h.u0 - 0.15, h.u1 + 0.15, -drop, bd.zf - Math.min(0.2, raise / 2), T, T + 0.35);
          if (raise > 0.3) fbox(o, "concrete", F, h.u0 - 0.15, h.u1 + 0.15, -drop, bd.zf - raise + 0.18, T + 0.35, T + 0.65);
        }
        infillGen(inside, F, h, G, R);                               // its sashes and glass, seen from the street
      }
      if (bd.pent) continue;
      // the floor's edge at each storey over the first (east and west faces a GAP lower: never one plane at a corner)
      const zo = Math.abs(N[0]) > 0.5 ? GAP : 0;
      if (fac.bands && bd.k > 0) { const bh = num(fac.bands.h, 0.22), bo = num(fac.bands.out, 0.04);
        fbox(o, fac.bands.slot || "trim", F, 0.001, F.W - 0.001, bd.zf - bh - zo, bd.zf - zo, T, T + bo, nKey(F, -1)); }
      // eaves (庇): a slab over each run of windows, `ends` past them, runs closer than `join` one; stopping short of the
      // face's corners
      if (fac.eaves) {
        const ev = fac.eaves, out2 = num(ev.out, 0.9), t = num(ev.t, 0.15), over = num(ev.over, 0.05), ends = num(ev.ends, 0.3), join = num(ev.join, 2.0);
        const lo = fc.ext0 > 0 ? G + T + 0.02 : 0.02, hi = F.W - (fc.ext1 > 0 ? G + T + 0.02 : 0.02);
        const runs = [];
        for (const h of holes.filter(h => h.window && !h.round).sort((p, q) => p.u0 - q.u0)) {
          const r = runs[runs.length - 1];
          if (r && h.u0 - r.u1 <= join && Math.abs(h.z1 - r.z1) < 0.06) { r.u1 = Math.max(r.u1, h.u1); r.z1 = Math.max(r.z1, h.z1); } else runs.push({ u0: h.u0, u1: h.u1, z1: h.z1 });
        }
        for (const r of runs) { const a = Math.max(lo, r.u0 - ends), c = Math.min(hi, r.u1 + ends); if (c - a > 0.3) fbox(o, ev.slot || "trim", F, a, c, r.z1 + over - zo, r.z1 + over + t - zo, T, T + out2, nKey(F, -1)); }
      }
      // guard rails (手すり) across low windows above the ground: two bars on posts, in front of the glass
      if (fac.rails && bd.k > 0) {
        const rl = fac.rails, n = T + num(rl.out, 0.12), lowSill = num(rl.below, 0.95);
        for (const h of holes.filter(h => h.window && !h.round && h.z0 - bd.zf < lowSill)) {
          for (const zr of [bd.zf + num(rl.h, 1.1), bd.zf + num(rl.h, 1.1) - 0.32]) fbox(o, "rail", F, h.u0 + 0.01, h.u1 - 0.01, zr - 0.035, zr, n - 0.02, n + 0.02);
          for (const u of [h.u0 + 0.03, h.u1 - 0.03]) fbox(o, "rail", F, u - 0.012, u + 0.012, bd.zf + num(rl.h, 1.1) - 0.42, bd.zf + num(rl.h, 1.1) - 0.035 - 0.001, T, n - 0.021, nKey(F, -1));
        }
      }
      // pilasters: where the rooms meet along this face and in the walls between windows wide enough, the corners too
      if (fac.pilasters) {                                            // (in the level's metres along the line: one column up every storey)
        const pl = fac.pilasters, pw = num(pl.w, 0.6), gapMin = num(pl.gap, pw + 0.2), key = `${e.axis}:${e.v}:${e.n}`;
        const spots = colSpots[key] = colSpots[key] || { fc, axis: e.axis, v: e.v, as: new Set(), holes: [] };
        for (const r of bd.rooms) {                                   // the rooms' ends on this line
          const [x0, y0] = r.at, [w, d] = r.size, on = e.axis === "x" ? (Math.abs(y0 - e.v) < 0.01 || Math.abs(y0 + d - e.v) < 0.01) : (Math.abs(x0 - e.v) < 0.01 || Math.abs(x0 + w - e.v) < 0.01);
          if (!on) continue;
          for (const a of e.axis === "x" ? [x0, x0 + w] : [y0, y0 + d]) if (a > e.a0 + 0.3 && a < e.a1 - 0.3) spots.as.add(Math.round(a * 100) / 100);
        }
        const ws = (e.holes || []).filter(h => !h.round && raise + h.z0 >= bd.zf - 0.01 && raise + h.z0 < bd.zt - 0.05).sort((p, q) => p.a0 - q.a0);
        for (let i = 1; i < ws.length; i++) if (ws[i].a0 - ws[i - 1].a1 >= gapMin && Math.abs(ws[i].z0 - ws[i - 1].z0) < 0.3) spots.as.add(Math.round((ws[i].a0 + ws[i - 1].a1) / 2 * 100) / 100);
        if (pl.ends) for (const a of [e.a0 + pw / 2 + 0.05, e.a1 - pw / 2 - 0.05]) spots.as.add(Math.round(a * 100) / 100);
        spots.holes.push(...(e.holes || []));
      }
    }
  }
  // the pilasters: from the ground to the roof's parapet, never over a hole
  if (fac.pilasters) {
    const pl = fac.pilasters, pw = num(pl.w, 0.6), po = num(pl.out, 0.12), ztop = top + roofTopOf(b) - 0.06;
    for (const { fc, axis, v, as, holes } of Object.values(colSpots)) for (const a of as) {
      if (holes.some(h => h.a1 > a - pw / 2 - 0.02 && h.a0 < a + pw / 2 + 0.02)) continue;   // never over a hole, any storey's
      const u = fc.toU(...(axis === "x" ? [a, v] : [v, a]));
      if (u - pw / 2 < 0 || u + pw / 2 > fc.F.W) continue;
      fbox(o, pl.slot || skin, fc.F, u - pw / 2, u + pw / 2, -drop - 0.05, ztop, T, T + po, "-z" + nKey(fc.F, -1));
    }
  }
  // the dark rooms seen through the holes (never exported: the level goes there)
  for (const r of fr.shut) {
    const [x0, y0, x1, y1] = grow(r, 0), z0 = raise + num(r.at[2], 0), h = num(r.size[2], 2.6);
    poly(inside, "inside_floor", [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, 1]);
    poly(inside, "inside", [[x0, y0, z0 + h], [x1, y0, z0 + h], [x1, y1, z0 + h], [x0, y1, z0 + h]], [0, 0, -1]);
    poly(inside, "inside", [[x0, y0, z0], [x1, y0, z0], [x1, y0, z0 + h], [x0, y0, z0 + h]], [0, 1, 0]); poly(inside, "inside", [[x0, y1, z0], [x1, y1, z0], [x1, y1, z0 + h], [x0, y1, z0 + h]], [0, -1, 0]);
    poly(inside, "inside", [[x0, y0, z0], [x0, y1, z0], [x0, y1, z0 + h], [x0, y0, z0 + h]], [1, 0, 0]); poly(inside, "inside", [[x1, y0, z0], [x1, y1, z0], [x1, y1, z0 + h], [x1, y0, z0 + h]], [-1, 0, 0]);
  }
  // the roof: over the top storey's rooms but not the penthouses, its parapet round it but never along one; the
  // penthouses' own on them
  const mainR = fr.storeys[NS - 1].rooms.map(r => grow(r, G + T)), xs = [...new Set(mainR.concat(pentR).flatMap(r => [r[0], r[2]]).map(v => Math.round(v * 1e4) / 1e4))].sort((a, c) => a - c);
  const ys = [...new Set(mainR.concat(pentR).flatMap(r => [r[1], r[3]]).map(v => Math.round(v * 1e4) / 1e4))].sort((a, c) => a - c), cells = [];
  const inR = (R2, x, y) => R2.some(r => x > r[0] && x < r[2] && y > r[1] && y < r[3]);
  for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < ys.length; j++) { const x = (xs[i] + xs[i + 1]) / 2, y = (ys[j] + ys[j + 1]) / 2; if (inR(mainR, x, y) && !inR(pentR, x, y)) cells.push([xs[i], ys[j], xs[i + 1], ys[j + 1]]); }
  const nextTo = e => { const F = e.F, m = fp(F, F.W / 2, 0, 0.05); return inR(pentR, m[0], m[1]) || inR(pentR, ...fp(F, 0.02, 0, 0.05).slice(0, 2)) && inR(pentR, ...fp(F, F.W - 0.02, 0, 0.05).slice(0, 2)); };
  if (cells.length) flatRoofParts(o, rectUnion(cells), top + ROOF_GAP, roof, skin, nextTo);
  for (const r of fr.pent) flatRoofParts(o, rectUnion([grow(r, G + T)]), pentTop, { kind: "flat", parapet: num(roof.pent_parapet, 0.3) }, skin, () => false);
  // its own parts (signs, the clock, fans, pipes; the name on the roof) on the box round its enclosed rooms
  const all = fr.shut.map(r => grow(r, 0)), bx0 = Math.min(...all.map(r => r[0])) - G - T, by0 = Math.min(...all.map(r => r[1])) - G - T, bx1 = Math.max(...all.map(r => r[2])) + G + T, by1 = Math.max(...all.map(r => r[3])) + G + T;
  const frames = faceFrames(bx0, by0, bx1, by1, 0), ps = partCopies(b.parts), rows = insideFloors(b);
  for (const p of ps) partGen(o, b, frames[p.face || "front"], p, rows, R, o.signs, ps.filter(q => (q.face || "front") === (p.face || "front")));
  o.inside = inside;
  return o;
}
// a flat roof over an outline (rectUnion's): its slab's top, a parapet with its coping round its edges (`skip` an edge: a
// penthouse's wall goes up there instead), a railing on the coping or the slab
function flatRoofParts(o, U, z, roof, wallSlot, skip) {
  const parapet = roof.kind === "flat" && num(roof.parapet, 0.6) > 0.05, p = num(roof.parapet, 0.6), t = 0.12, c = 0.03, zc = z + p;
  for (const [x0, y0, x1, y1] of U.rects) box(o, "roof_flat", x0, y0, z, x1, y1, z + 0.02, "-z-x+x-y+y");
  for (const e of U.edges) {
    if (skip(e)) continue;
    const F = e.F, ax = e.axis === "x", [c0, c1] = e.cv;
    if (parapet) {
      fbox(o, wallSlot, F, ax ? (c0 ? 0 : -t) : (c0 ? t : 0), F.W + (ax ? (c1 ? 0 : t) : (c1 ? -t : 0)), z, zc, -t, 0, "-z");
      fbox(o, "trim", F, ax ? (c0 ? -c : -t - c) : (c0 ? t + c : c), F.W + (ax ? (c1 ? c : t + c) : (c1 ? -t - c : -c)), zc, zc + 0.06, -t - c, c);
      if (roof.rail) railGen(o, F, (c0 ? 0.35 : -0.35), F.W - (c1 ? 0.35 : -0.35), z + 0.02, z + 0.02 + num(roof.rail_h, 1.5), -0.35, null, [false, true]);
      continue;
    }
    fquad(o, "roof_flat", F, 0, F.W, z, z + 0.02, 0);
    if (roof.kind === "rail" || roof.rail) railGen(o, F, c0 ? 0.06 : -0.06, F.W - (c1 ? 0.06 : -0.06), z, z + 1.1, -0.06, null, [false, true]);
  }
}
// a window's or a door's sashes and glass as the street sees them, where the level's own frame is (the level's wall's
// middle, behind the shell): never exported (`inside`); curtains drawn some of the way behind a classroom's
function infillGen(o, F, h, G, R) {
  const n = -G + 0.005, K = INFILL[h.frame] || (h.door ? null : { cols: 2, slot: "frame" }), u0 = h.u0, u1 = h.u1, z0 = h.z0, z1 = h.z1;
  if (!K) {                                                           // a door: its leaf, glass in it if it has any
    const glassy = /glass|school/.test((h.door && h.door.kit) || "");
    fquad(o, "frame", F, u0, u1, z0, z1, n - 0.004);
    if (glassy) fquad(o, "glass", F, u0 + 0.06, u1 - 0.06, /school/.test(h.door.kit) ? z0 + (z1 - z0) * 0.5 : z0 + 0.25, z1 - 0.08, n);
    return;
  }
  fquad(o, K.glass || "glass", F, u0, u1, z0, z1, n);
  const fw = 0.05, f = n + 0.03, slot = K.slot || "frame", bar = (a, b, p, q) => fbox(o, slot, F, a, b, p, q, n + 0.004, f);
  bar(u0, u1, z0, z0 + fw); bar(u0, u1, z1 - fw, z1); bar(u0, u0 + fw, z0 + fw, z1 - fw); bar(u1 - fw, u1, z0 + fw, z1 - fw);
  const cols = K.cols || 1, rows = K.rows || (K.split ? 2 : 1);
  for (let i = 1; i < cols; i++) { const u = u0 + (u1 - u0) * i / cols; bar(u - 0.022, u + 0.022, z0 + fw, z1 - fw); }
  const zs = K.split ? [z0 + (z1 - z0) * K.split] : Array.from({ length: rows - 1 }, (_, j) => z0 + (z1 - z0) * (j + 1) / rows);
  for (const z of zs) bar(u0 + fw, u1 - fw, z - 0.02, z + 0.02);
  if (!K.glass && R() < 0.75) {                                       // curtains, drawn to one side or both, behind the glass
    const cw = (u1 - u0) * (0.18 + R() * 0.3), zc1 = K.split ? z0 + (z1 - z0) * K.split : z1;
    if (R() < 0.6) fquad(o, "curtain", F, u0 + 0.05, u0 + 0.05 + cw, z0 + 0.06, zc1 - 0.03, n + 0.002);
    if (R() < 0.6) fquad(o, "curtain", F, u1 - 0.05 - cw, u1 - 0.05, z0 + 0.06, zc1 - 0.03, n + 0.002);
  }
}
// a round window (a stair tower's porthole, the user's photo): the shell over the square hole's corners, a round reveal
// back to the level's wall, a painted ring proud of the face; its glass seen from the street (the level's own in Godot)
function portholeGen(o, inside, F, h, G, T) {
  // the ring inside the square (its outer edge 5 mm in), the glass and the reveal at its inner edge, the shell round it
  const cu = (h.u0 + h.u1) / 2, cz = (h.z0 + h.z1) / 2, hw = (h.u1 - h.u0) / 2, hh = (h.z1 - h.z0) / 2, Ro = Math.min(hw, hh) - 0.005, n = 40, ring = Math.min(0.16, Ro * 0.2), Rr = Ro - ring;
  const P = (r, a, nn) => fp(F, cu + Math.cos(a) * r, cz + Math.sin(a) * r, nn), Nf = [F.N[0], F.N[1], 0];
  const sq = a => { const c = Math.cos(a), s2 = Math.sin(a), t = Math.min(Math.abs(c) > 1e-9 ? hw / Math.abs(c) : 1e9, Math.abs(s2) > 1e-9 ? hh / Math.abs(s2) : 1e9); return [c * t, s2 * t]; };
  const corners = [[hw, hh], [-hw, hh], [-hw, -hh], [hw, -hh]], cAng = corners.map(([x, z]) => (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2));
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, mid = cAng.filter(c => c > a0 + 1e-9 && c < a1 - 1e-9).sort((p, q) => q - p);
    const outer = [sq(a1), ...mid.map(c => corners[cAng.indexOf(c)]), sq(a0)].map(([x, z]) => fp(F, cu + x, cz + z, T));
    poly(o, "wall", [P(Rr + ring, a0, T), P(Rr + ring, a1, T), ...outer].filter((q, k, A) => k === 0 || Math.hypot(q[0] - A[k - 1][0], q[1] - A[k - 1][1], q[2] - A[k - 1][2]) > 1e-6), Nf);
    poly(o, "ring", [P(Rr, a0, T + 0.04), P(Rr, a1, T + 0.04), P(Rr + ring, a1, T + 0.04), P(Rr + ring, a0, T + 0.04)], Nf);   // the ring's face
    const am = (a0 + a1) / 2, outN = [F.U[0] * Math.cos(am), F.U[1] * Math.cos(am), Math.sin(am)];
    poly(o, "ring", [P(Rr + ring, a0, T), P(Rr + ring, a1, T), P(Rr + ring, a1, T + 0.04), P(Rr + ring, a0, T + 0.04)], outN);   // its rim
    poly(o, "ring", [P(Rr, a0, -G + LT / 2), P(Rr, a1, -G + LT / 2), P(Rr, a1, T + 0.04), P(Rr, a0, T + 0.04)], mul(outN, -1));   // the reveal
  }
  poly(inside, "glass_wire", Array.from({ length: n }, (_, i) => P(Rr, i / n * Math.PI * 2, -G + 0.005)), Nf);
}
export function insideFloors(b) {
  const fr = insideFrame(b.inside);
  if (fr.storeys) {
    const raise = num(b.inside.raise, 0.15), rows = fr.storeys.map(st => ({ k: st.k + 1, z0: raise + st.z, h: st.h }));
    rows.top = raise + fr.top + roofTopOf(b);
    return rows;
  }
  const raise = num(b.inside.raise, 0.15), storey = fr.H + LT + 0.3, n = Math.max(1, Math.min(4, Math.round(num(b.inside.floors, 1))));
  return Array.from({ length: n }, (_, f) => ({ k: f + 1, z0: raise + f * storey, h: storey }));
}
// the box an inside-building takes on the plan (its w and d: the shell round all its copies)
export function insideSize(b) {
  const fr = insideFrame(b.inside);
  if (fr.storeys) { const e = 2 * (LT / 2 + INSIDE_GAP + INSIDE_SKIN), r3 = v => Math.round(v * 1000) / 1000;
    return { w: r3(fr.W + e), d: r3(fr.D + e), h: r3(insideFloors(b).top) }; }
  const rows = Math.max(1, Math.round(num(b.inside.rows, 1))), e = 2 * (LT / 2 + INSIDE_GAP + INSIDE_SKIN);
  return { w: Math.round((fr.W * rows + e) * 1000) / 1000, d: Math.round((fr.D + e) * 1000) / 1000, h: insideFloors(b).slice(-1)[0].z0 + fr.H + LT };
}
// where each copy's level goes (Godot: its scene, its origin there, turned): [{name, at, turn, meta}] in the street
export function insideMarkers(b, foot) {
  if (!b.inside || !(b.inside.rooms || []).length) return [];
  const ins = b.inside, fr = insideFrame(ins);
  if (fr.storeys) {                                                  // one level, every storey of it: its origin at the ground's raise
    const [u, v] = fr.toLocal(0, 0), at = place([u, v, num(ins.raise, 0.15)], { at: b.at, turn: b.turn, z: foot ? foot.z : 0 });
    return [{ name: `inside_${b.id}_1_1`, at, turn: num(b.turn, 0) - fr.rot, meta: { set: ins.set || "", level: ins.level || "", floor: 1, copy: 1, storeys: fr.storeys.length } }];
  }
  const rows = Math.max(1, Math.round(num(ins.rows, 1))), floors = Math.max(1, Math.min(4, Math.round(num(ins.floors, 1))));
  const raise = num(ins.raise, 0.15), storey = fr.H + LT + 0.3, out2 = [];
  for (let f = 0; f < floors; f++) for (let k = 0; k < rows; k++) {
    const [u, v] = fr.toLocal(0, 0), at = place([u - fr.W * rows / 2 + fr.W * (k + 0.5), v, raise + f * storey], { at: b.at, turn: b.turn, z: foot ? foot.z : 0 });
    out2.push({ name: `inside_${b.id}_${f + 1}_${k + 1}`, at, turn: num(b.turn, 0) - fr.rot, meta: { set: ins.set || "", level: ins.level || "", floor: f + 1, copy: k + 1 } });
  }
  return out2;
}
// a window's frame in the level (its <room>_fx_win<n>, a kit: the preset's name), found by its place on its wall
function frameOf(r, o) {
  const along = p => o.wall === "n" || o.wall === "s" ? (p.at || [])[0] : (p.at || [])[1];
  const f = (r.props || []).find(p => /_fx_win\d+$/.test(p.id || "") && p.kit && Math.abs(num(along(p), -99) - num(o.at, 0)) < 0.03 && Math.abs(num(p.z, 0) - num(o.sill, 0)) < 0.12);
  return f ? (f.kit.preset || f.kit.type || undefined) : undefined;
}
// a level's rooms as the street keeps them (what its outside needs: their places, sizes, ceilings, skips and openings)
export function insideRooms(level) {
  return (level && level.rooms || []).map(r => ({ id: r.id, at: r.at, size: r.size, ceiling: r.ceiling !== false ? undefined : false, skip: r.skip && r.skip.length ? r.skip : undefined,
    openings: (r.openings || []).map(o => Object.fromEntries(Object.entries({ wall: o.wall, at: o.at, w: o.w, h: o.h, sill: o.sill || undefined, window: o.window || undefined,
      frame: o.window ? frameOf(r, o) : undefined, door: o.door ? Object.assign({ id: o.door.id }, o.door.kit && o.door.kit.preset ? { kit: o.door.kit.preset } : {}) : undefined }).filter(([, v]) => v !== undefined))) }))
    .map(r => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)));
}

// the outside on the scene builder's plan, in the level's own space: its walls' outer face round the enclosed rooms, and
// the roof's edge (round the rooms' box when they fill it, as the roof is built, else round the rooms), as segments
export function outsidePlan(level, o) {
  const rooms = insideRooms(level).filter(r => r.ceiling !== false && Math.abs(num((r.at || [])[2], 0)) < 0.01 && r.size);
  if (!rooms.length) return null;
  const e = LT / 2 + INSIDE_GAP + INSIDE_SKIN, roof = Object.assign({ kind: "hip", over: 0.6 }, (o || {}).roof || {});
  const over = ["gable", "hip", "shed"].includes(roof.kind) ? num(roof.over, 0.6) : 0;
  const R = rooms.map(r => [r.at[0], r.at[1], r.at[0] + r.size[0], r.at[1] + r.size[1]]), grow = k => R.map(r => [r[0] - k, r[1] - k, r[2] + k, r[3] + k]);
  const bx = [Math.min(...R.map(r => r[0])), Math.min(...R.map(r => r[1])), Math.max(...R.map(r => r[2])), Math.max(...R.map(r => r[3]))];
  const full = R.reduce((a, r) => a + (r[2] - r[0]) * (r[3] - r[1]), 0) / ((bx[2] - bx[0]) * (bx[3] - bx[1])) > 0.85;
  const segs = U => U.edges.map(({ F }) => [F.o[0], F.o[1], F.o[0] + F.U[0] * F.W, F.o[1] + F.U[1] * F.W]);
  return { walls: segs(rectUnion(grow(e))), roof: over > 0 ? segs(rectUnion(full ? [[bx[0] - e - over, bx[1] - e - over, bx[2] + e + over, bx[3] + e + over]] : grow(e + over))) : [] };
}

// ---- a set's outside: how an enterable building looks from the street, designed with its rooms in the scene builder
// (its level's `outside`, docs/SCENE_BUILDER.md §8, STORY_FORMAT §2): its colours (`look`: a slot's colour or a
// pbr/<set>), its roof, the wall's slot, how high its floor stands (`raise`, steps up to the doors), which side faces
// the street (`front`), what's fixed to its walls (`parts`: the street builder's own, no openings: the level's doors
// and windows are the holes). A street's building with that set inside follows it until it's changed in the street.
export const OUTSIDE_DEFAULT = { look: { wall: "#cfc5b3", trim: "#6b5a49", tiles: "#3d4148" }, roof: { kind: "hip", pitch: 24, over: 0.6 }, raise: 0.15, parts: [] };
export const OUTSIDE_PARTS = Object.keys(PART_KINDS).filter(k => !PART_KINDS[k].hole);
export const OUTSIDE_SLOTS = ["wall", "wall2", "plaster", "concrete", "trim", "wood", "wood_dark", "blocks", "panel"];
const copy = v => JSON.parse(JSON.stringify(v));
const canon = v => Array.isArray(v) ? "[" + v.map(canon).join(",") + "]" : v && typeof v === "object"
  ? "{" + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}" : JSON.stringify(v);
// what a building's outside is now, and its mark (the same outside, the same mark: keys in any order)
export function outsideNow(b) {
  const ins = b.inside || {};
  return { look: b.look || {}, roof: b.roof || {}, parts: b.parts || [], raise: num(ins.raise, 0.15), slot: ins.slot || "", front: ins.front || "", facade: b.facade };
}
export function outsideMark(b) {
  let h = 2166136261; for (const c of canon(outsideNow(b))) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
// the set's outside put on the building that holds it; whether the building changed. `inside.from` is the mark of the
// outside last put on: a building whose outside no longer matches it was changed in the street, and keeps its own from
// then on (`inside.own`; "Follow the set's outside" in the page takes it back).
export function applyOutside(b, out) {
  const ins = b.inside;
  if (!ins || !out || ins.own) return false;
  const had = ins.from;
  if (had && had !== outsideMark(b)) { ins.own = true; return true; }
  b.look = copy(out.look || {}); b.roof = copy(out.roof || OUTSIDE_DEFAULT.roof); b.parts = copy(out.parts || []);
  if (out.facade) b.facade = copy(out.facade); else delete b.facade;
  ins.raise = num(out.raise, 0.15);
  if (out.slot) ins.slot = out.slot; else delete ins.slot;
  if (out.front) ins.front = out.front; else delete ins.front;
  ins.from = outsideMark(b);
  return had !== ins.from;
}
// the building a level's outside makes round it, placed so that the level stays where it is (its own coordinates, its
// floor at z = raise over the ground): the scene builder draws it, the street check builds every set's
export function outsideBuilding(level, out, id = "outside") {
  const rooms = insideRooms(level);
  if (!rooms.some(r => r.ceiling !== false && Math.abs(num((r.at || [])[2], 0)) < 0.01)) return null;
  const o = Object.assign({}, OUTSIDE_DEFAULT, out || {});
  const b = { id, style: "set", seed: num(o.seed, 1), floors: 1, look: copy(o.look || {}), roof: copy(o.roof || {}), parts: copy(o.parts || []), ...(o.facade ? { facade: copy(o.facade) } : {}),
    inside: { set: "-", level: "", rows: 1, floors: 1, raise: num(o.raise, 0.15), rooms } };
  if (o.slot) b.inside.slot = o.slot;
  if (o.front) b.inside.front = o.front;
  const fr = insideFrame(b.inside);
  b.at = [fr.cx, fr.cy]; b.turn = fr.rot;
  return Object.assign(b, insideSize(b));
}
// an outside's faces in the level's own compass (front, left, back, right -> n, e, s, w)
export function outsideFaces(level, out) {
  const b = outsideBuilding(level, out); if (!b) return null;
  const turn = ((b.turn % 360) + 360) % 360, by = { 0: "s", 90: "e", 180: "n", 270: "w" }, order = ["s", "e", "n", "w"];
  const f = by[turn] || "s", i = order.indexOf(f);
  return { front: f, right: order[(i + 1) % 4], back: order[(i + 2) % 4], left: order[(i + 3) % 4] };
}

// ---- roads: a smooth line through their points (from, via..., to), each point with its height ------------------------
export const ROAD_DEFAULT = { width: 6, walks: [2, 2], kerb: 0.15, edge: [0, 0], centre: "dashed" };
export const MARK_KINDS = { stop: "stop line", text: "words (止まれ)", zebra: "zebra crossing", diamond: "crossing ahead (◇)", arrow: "arrow", line: "a line across", bays: "parking bays" };
// the points a road passes through, each [x, y, z]: `z` a number (all of it), one a point, or [at from, at to] (between
// them by distance)
export function roadPoints(r) {
  const P = [r.from, ...(Array.isArray(r.via) ? r.via : []), r.to].map(p => [num(p[0], 0), num(p[1], 0)]);
  const z = r.z;
  if (Array.isArray(z) && z.length === P.length) return P.map((p, i) => [p[0], p[1], num(z[i], 0)]);
  if (Array.isArray(z) && z.length >= 2) {
    const d = [0]; for (let i = 1; i < P.length; i++) d.push(d[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const a = num(z[0], 0), b = num(z[z.length - 1], 0), L = d[d.length - 1] || 1;
    return P.map((p, i) => [p[0], p[1], a + (b - a) * d[i] / L]);
  }
  return P.map(p => [p[0], p[1], num(z, 0)]);
}
// a centripetal Catmull-Rom curve through the points (no loops, no overshoot at a sharp bend), a point every `step` m;
// two points: the straight line, two points
function spline(P, step) {
  if (P.length < 3) return P.map(p => p.slice());
  const ext = (a, b) => a.map((v, k) => 2 * v - b[k]), Q = [ext(P[0], P[1]), ...P, ext(P[P.length - 1], P[P.length - 2])], out = [P[0].slice()];
  const dist = (u, v) => Math.pow(Math.max(1e-4, Math.hypot(v[0] - u[0], v[1] - u[1])), 0.5);
  for (let i = 1; i + 2 < Q.length; i++) {
    const [p0, p1, p2, p3] = [Q[i - 1], Q[i], Q[i + 1], Q[i + 2]];
    const t0 = 0, t1 = dist(p0, p1), t2 = t1 + dist(p1, p2), t3 = t2 + dist(p2, p3);
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 1; k <= n; k++) {
      const t = t1 + (t2 - t1) * k / n, lerp = (A, B, ta, tb) => A.map((v, j) => ((tb - t) * v + (t - ta) * B[j]) / (tb - ta));
      const A1 = lerp(p0, p1, t0, t1), A2 = lerp(p1, p2, t1, t2), A3 = lerp(p2, p3, t2, t3);
      out.push(lerp(lerp(A1, A2, t0, t2), lerp(A2, A3, t1, t3), t1, t2));
    }
  }
  return out;
}
// a road's line: its points along it (P, each [x, y, z]), their distances (S), directions (T); frame(s), at(s, q) (q
// across, + to the left walking from `from` to `to`), z(s), nearest(x, y), stations(s0, s1): the points a strip bends at
export function roadPath(r) {
  if (r && r._path) return r._path;
  const P = spline(roadPoints(r), 1.5), n = P.length, S = [0];
  for (let i = 1; i < n; i++) S.push(S[i - 1] + Math.max(1e-6, Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])));
  const T = P.map((_, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; });
  const L = S[n - 1], W = num(r.width, 6), walks = Array.isArray(r.walks) ? r.walks.map(v => num(v, 0)) : [num(r.walks, 2), num(r.walks, 2)];
  const seg = s => { let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; } return lo; };
  const frame = s => {
    const i = seg(Math.max(0, Math.min(L, s))), u = Math.max(-2, Math.min(3, (s - S[i]) / ((S[i + 1] - S[i]) || 1)));
    const p = P[i].map((v, k) => v + (P[i + 1][k] - v) * u), tt = [T[i][0] + (T[i + 1][0] - T[i][0]) * Math.max(0, Math.min(1, u)), T[i][1] + (T[i + 1][1] - T[i][1]) * Math.max(0, Math.min(1, u))];
    const l = Math.hypot(...tt) || 1, t = [tt[0] / l, tt[1] / l];
    return { p, t, n: [-t[1], t[0]] };
  };
  const at = (s, q) => { const f = frame(s); return [f.p[0] + f.n[0] * q, f.p[1] + f.n[1] * q, f.p[2]]; };
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]), pad = W / 2 + Math.max(...walks) + 0.5;
  const box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
  const nearest = (x, y) => {
    let best = null;
    for (let i = 0; i + 1 < n; i++) {
      const a = P[i], b = P[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-9;
      let u = ((x - a[0]) * dx + (y - a[1]) * dy) / l2;
      if (i > 0) u = Math.max(0, u); if (i + 2 < n) u = Math.min(1, u);      // past the ends: the line carries on straight
      const cx = a[0] + dx * u, cy = a[1] + dy * u, d = Math.hypot(x - cx, y - cy);
      if (!best || d < best.d) best = { s: S[i] + u * Math.sqrt(l2), d, cx, cy };
    }
    const f = frame(best.s);
    return { s: best.s, q: (x - best.cx) * f.n[0] + (y - best.cy) * f.n[1], d: best.d, z: f.p[2] };
  };
  const stations = (s0, s1) => { const out = [s0]; for (let i = 0; i < n; i++) if (S[i] > s0 + 1e-6 && S[i] < s1 - 1e-6) out.push(S[i]); out.push(s1); return out; };
  return { P, S, T, L, W, walks, kerb: num(r.kerb, 0.15), frame, at, z: s => frame(s).p[2], nearest, stations, box, curved: n > 2, id: r.id };
}
export const roadFrame = roadPath;                                    // (the old name)
const inBox = (g, x, y) => x >= g.box[0] && x <= g.box[2] && y >= g.box[1] && y <= g.box[3];
function onCarriageway(g, x, y) { if (!inBox(g, x, y)) return false; const q = g.nearest(x, y); return q.s >= 0 && q.s <= g.L && Math.abs(q.q) <= g.W / 2 + 1e-3; }
// where another road's carriageway covers a strip of this one (q0..q1 across it): intervals along it, found by stepping
// along and sharpened at their edges
function cutsOf(f, q0, q1, others) {
  if (!others.length) return [];
  const e = Math.min(0.05, (q1 - q0) / 4);                            // just inside the strip: a road that only touches its edge doesn't cut it
  const hit = s => [q0 + e, (q0 + q1) / 2, q1 - e].some(q => { const [x, y] = f.at(s, q); return others.some(g => onCarriageway(g, x, y)); });
  const step = 0.3, cuts = []; let start = null, prev = 0, prevHit = hit(0);
  if (prevHit) start = 0;
  for (let s = step; s < f.L + step; s += step) {
    const sc = Math.min(s, f.L), h = hit(sc);
    if (h !== prevHit) {
      let a = prev, b = sc;                                            // the edge between prev and sc, by halves
      for (let k = 0; k < 7; k++) { const m = (a + b) / 2; if (hit(m) === prevHit) a = m; else b = m; }
      if (h) start = b; else { cuts.push([start, a]); start = null; }
    }
    prev = sc; prevHit = h;
    if (sc >= f.L) break;
  }
  if (start !== null) cuts.push([start, f.L]);
  return cuts;
}
function spans(L, cuts) {
  const out = []; let s = 0;
  for (const [a, b] of cuts) { if (a > s + 0.01) out.push([s, Math.min(a, L)]); s = Math.max(s, b); }
  if (s < L - 0.01) out.push([s, L]);
  return out.filter(([a, b]) => b - a > 0.01);
}
// a flat shape facing up (its winding turned so), its normal its own: a sloped road's slope
function polyUp(o, slot, P, uv) {
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; cx += (a[1] - b[1]) * (a[2] + b[2]); cy += (a[2] - b[2]) * (a[0] + b[0]); cz += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = Math.hypot(cx, cy, cz); if (l < 1e-10) return;
  const nn = cz >= 0 ? [cx / l, cy / l, cz / l] : [-cx / l, -cy / l, -cz / l];
  poly(o, slot, P, nn, uv);
}
export function roadParts(r, others = [], index = 0) {
  const o = out(), f = roadPath(r), W = f.W, L = f.L, zA = 0.004 + 0.003 * (index % 8), og = others.map(roadPath);
  const P3 = (s, q, dz) => { const p = f.at(s, q); return [p[0], p[1], p[2] + dz]; };
  const strip = (slot, s0, s1, q0, q1, dz) => { const st = f.stations(s0, s1); for (let i = 0; i + 1 < st.length; i++) { const a = st[i], b = st[i + 1]; polyUp(o, slot, [P3(a, q0, dz), P3(b, q0, dz), P3(b, q1, dz), P3(a, q1, dz)], [[-q0, a], [-q0, b], [-q1, b], [-q1, a]]); } };
  const side = (slot, s0, s1, q, dz0, dz1, facing) => {                // an upright face along it at q, facing `facing` (+1 left)
    const st = f.stations(s0, s1);
    for (let i = 0; i + 1 < st.length; i++) { const a = st[i], b = st[i + 1], fr = f.frame((a + b) / 2); poly(o, slot, [P3(a, q, dz0), P3(b, q, dz0), P3(b, q, dz1), P3(a, q, dz1)], [fr.n[0] * facing, fr.n[1] * facing, 0]); }
  };
  strip(r.surface || "asphalt", 0, L, -W / 2, W / 2, zA);
  // the kerbs' ramps, for the colliders alone (never drawn): a 30° slope in front of each kerb face, so a body a person's
  // size walks up onto the pavement (a floor is up to 45° to Godot's CharacterBody3D, a 15 cm step is a wall); each quad
  // wound to face up (a trimesh collides from its front only)
  const ramps = o.ramps = { pos: [], idx: [] }, RUN = 1.732;
  const rampQuad = (A, B, C, D) => {
    const n = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]), v = ramps.pos.length / 3;
    ramps.pos.push(...A, ...B, ...C, ...D);
    ramps.idx.push(...(n >= 0 ? [v, v + 1, v + 2, v, v + 2, v + 3] : [v, v + 2, v + 1, v, v + 3, v + 2]));
  };
  const rampAlong = (s0, s1, q, out, dzLo, dzHi) => { const st = f.stations(s0, s1); for (let i = 0; i + 1 < st.length; i++) { const a = st[i], b = st[i + 1]; rampQuad(P3(a, q + out, dzLo), P3(b, q + out, dzLo), P3(b, q, dzHi), P3(a, q, dzHi)); } };
  // the walks: raised slabs either side, a kerb's face toward the road, cut where another road crosses
  [[1, f.walks[0]], [-1, f.walks[1]]].forEach(([sd, ww]) => {
    if (ww <= 0.01) return;
    const qa = sd * W / 2, qb = sd * (W / 2 + ww), k = f.kerb, lo = Math.min(qa, qb), hi = Math.max(qa, qb);
    for (const [s0, s1] of spans(L, cutsOf(f, lo, hi, og))) {
      const stone = r.kerbStone !== false, ks = 0.15;                  // the kerb stone's 15 cm along the road edge
      strip(r.walk || "pavement", s0, s1, stone && sd > 0 ? lo + ks : lo, stone && sd < 0 ? hi - ks : hi, k);
      side("kerb", s0, s1, qa, 0, k, -sd); side("kerb", s0, s1, qb, -0.05, k, sd);
      for (const s of [s0, s1]) { const fr = f.frame(s), dir = s === s0 ? -1 : 1; poly(o, "kerb", [P3(s, lo, -0.05), P3(s, hi, -0.05), P3(s, hi, k), P3(s, lo, k)], [fr.t[0] * dir, fr.t[1] * dir, 0]); }
      if (stone) strip("kerb", s0, s1, sd > 0 ? qa : qa - ks, sd > 0 ? qa + ks : qa, k);
      if (k > 0.03) {
        rampAlong(s0, s1, qa, -sd * k * RUN, zA, k);                      // up from the road
        rampAlong(s0, s1, qb, sd * k * RUN, 0, k);                        // up from what's behind the walk
        for (const [se, dir] of [[s0, -1], [s1, 1]]) {                    // up onto its ends, where a crossing cuts it
          const t = se + dir * k * RUN;
          rampQuad(P3(t, lo, zA), P3(t, hi, zA), P3(se, hi, k), P3(se, lo, k));
        }
      }
    }
  });
  // the lines along it: the edge lines (their distance in from each edge) and the centre line, stopping at crossings
  // road paint lies flat on the road (the user: "it should look part of the road"): the lines 5 mm over the asphalt, the
  // marks 5 mm over them, as thin as STREET's clash test lets layers be (never a floating sheet with its own shadow)
  const zl = zA + 0.005, lw = 0.15;
  const line = (q, slot, dash) => {
    for (const [s0, s1] of spans(L, cutsOf(f, q - lw / 2, q + lw / 2, og))) {
      if (!dash) { strip(slot, s0, s1, q - lw / 2, q + lw / 2, zl); continue; }
      for (let s = s0; s < s1; s += dash[0] + dash[1]) strip(slot, s, Math.min(s1, s + dash[0]), q - lw / 2, q + lw / 2, zl);
    }
  };
  const [el = 0, er = 0] = Array.isArray(r.edge) ? r.edge.map(v => num(v, 0)) : [num(r.edge, 0), num(r.edge, 0)];
  if (el > 0) line(W / 2 - el, "paint", null);
  if (er > 0) line(-W / 2 + er, "paint", null);
  const c = r.centre || "none";
  if (c === "dashed") line(0, "paint", [5, 5]); else if (c === "solid") line(0, "paint", null); else if (c === "yellow") line(0, "paint_y", null);
  // the marks: at metres from `from`, x across from the middle (+ to the right walking to `to`). Each lies 5 mm over the
  // lines; one painted over an earlier mark lies 5 mm over that one (never two in one plane), and only then
  const markSpan = m => {
    const s = num(m.at, 0), x = -num(m.x, 0), mw = num(m.w, W - 0.5);
    const len = m.kind === "text" ? [...String(m.text || "止まれ")].filter(ch => ch.trim()).length * (num(m.len, 2.0) + num(m.gap, 0.5))
      : num(m.len, { stop: 0.45, line: 0.15, zebra: 4, bays: 20, diamond: 3, arrow: 3 }[m.kind] ?? 1);
    const hw = m.kind === "arrow" ? 0.35 : m.kind === "diamond" ? Math.min(mw, 1.6) / 2 + 0.1 : m.kind === "text" ? Math.min(num(m.w, 1.1), W - 0.3) / 2 : m.kind === "bays" ? num(m.w, 5) / 2 : mw / 2;
    return [s - 0.05, s + len + 0.05, x - hw - 0.05, x + hw + 0.05];
  };
  const markSpans = (r.marks || []).map(markSpan), layer = [];
  markSpans.forEach((a, i) => { layer[i] = 0; for (let j = 0; j < i; j++) { const b = markSpans[j]; if (a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3]) layer[i] = Math.max(layer[i], layer[j] + 1); } });
  (r.marks || []).forEach((m, mi) => {
    const s = num(m.at, 0), x = -num(m.x, 0), mw = num(m.w, W - 0.5), z = zl + 0.005 * (1 + Math.min(layer[mi], 6));
    const quad = (slot, pts, uv) => polyUp(o, slot, pts.map(([a, b]) => P3(s + a, x + b, z)), uv);
    switch (m.kind) {
      case "stop": strip("paint", s, s + num(m.len, 0.45), x - mw / 2, x + mw / 2, z); break;
      case "line": strip(m.slot || "paint", s, s + num(m.len, 0.15), x - mw / 2, x + mw / 2, z); break;
      case "zebra": { const len = num(m.len, 4); for (let q = -mw / 2; q + 0.45 <= mw / 2 + 1e-6; q += 0.9) strip("paint", s, s + len, x + q, x + q + 0.45, z); break; }
      case "bays": {                                                // a car park's bays: a line across every `gap` m, `w` deep, a line along their back
        const len = num(m.len, 20), gap = num(m.gap, 2.5), bw = num(m.w, 5);
        for (let a = 0; a <= len + 1e-6; a += gap) strip("paint", s + a - 0.06, s + a + 0.06, x - bw / 2, x + bw / 2 - 0.12, z);
        strip("paint", s, s + len, x + bw / 2 - 0.12, x + bw / 2, z);
        break;
      }
      case "diamond": {
        const len = num(m.len, 3), hw = Math.min(mw, 1.6) / 2, pts = [[0, 0], [len / 2, -hw], [len, 0], [len / 2, hw]], h = 0.07;
        const nrm = i => { const [a0, b0] = pts[i], [a1, b1] = pts[(i + 1) % 4], d = Math.hypot(a1 - a0, b1 - b0); return [(b1 - b0) / d, -(a1 - a0) / d]; };
        const mit = (i, sd) => { const n0 = nrm((i + 3) % 4), n1 = nrm(i), k = sd * h / (1 + n0[0] * n1[0] + n0[1] * n1[1]); return [pts[i][0] + (n0[0] + n1[0]) * k, pts[i][1] + (n0[1] + n1[1]) * k]; };
        for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad("paint", [mit(i, 1), mit(j, 1), mit(j, -1), mit(i, -1)]); }   // a ring, its corners mitred
        break;
      }
      case "arrow": { const len = num(m.len, 3); strip("paint", s, s + len * 0.6, x - 0.08, x + 0.08, z); quad("paint", [[len * 0.6, -0.35], [len, 0], [len * 0.6, 0.35]]); break; }   // the shaft up to the head
      case "text": {                                                // read by someone driving from `from` to `to`: the first character furthest
        const chars = [...String(m.text || "止まれ")].filter(ch => ch.trim()), len = num(m.len, 2.0), gap = num(m.gap, 0.5), cw = Math.min(num(m.w, 1.1), W - 0.3);
        chars.forEach((ch, i) => {
          const a0 = (chars.length - 1 - i) * (len + gap), a1 = a0 + len;
          quad("glyph:" + ch, [[a0, cw / 2], [a0, -cw / 2], [a1, -cw / 2], [a1, cw / 2]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        });
        break;
      }
      default: break;
    }
  });
  return o;
}

// ---- the ground: what's under any point. The roads set its height; between them it blends (the lots at the height of
// the road beside them); on a road its own height, on a pavement its top -----------------------------------------------
export function terrain(S) {
  const paths = (S.roads || []).map(roadPath), flat = (S.roads || []).every(r => !r.z || (Array.isArray(r.z) ? r.z.every(v => !+v) : !+r.z));
  const ground = (x, y) => {
    if (flat || !paths.length) return 0;
    let sw = 0, sz = 0;
    for (const g of paths) {
      const q = g.nearest(x, y), walk = g.walks[q.q >= 0 ? 0 : 1], e = Math.max(0, q.d - (g.W / 2 + walk));
      if (e === 0 && q.s >= 0 && q.s <= g.L) return q.z;
      const w = 1 / Math.pow(e * e + 0.5, 1.5); sw += w; sz += w * q.z;
    }
    return sz / sw;
  };
  const surface = (x, y) => {                                         // the top of what's there: a road, a pavement, the ground
    for (const g of paths) {
      if (!inBox(g, x, y)) continue;
      const q = g.nearest(x, y); if (q.s < 0 || q.s > g.L) continue;
      if (Math.abs(q.q) <= g.W / 2) return q.z;
      if (Math.abs(q.q) <= g.W / 2 + g.walks[q.q >= 0 ? 0 : 1]) return q.z + g.kerb;
    }
    return ground(x, y);
  };
  return { flat, paths, ground, surface };
}
// a building's footing: its floor at the ground just inside its front's middle; how far the ground falls under it
export function footing(b, T) {
  if (b.z !== undefined && b.z !== null && b.z !== "") return { z: num(b.z, 0), low: num(b.z, 0) };
  const w = num(b.w, 8), d = num(b.d, 10), P = l => place([l[0], l[1], 0], { at: b.at, turn: b.turn });
  const front = P([0, -d / 2 + 0.05]), z = T.ground(front[0], front[1]);
  if (T.flat) return { z, low: z };
  let low = z;
  for (const [u, v] of [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]) { const p = P([u * w / 2, v * d / 2]); low = Math.min(low, T.ground(p[0], p[1])); }
  return { z, low };
}

// ---- things: street furniture, a kind each -------------------------------------------------------------------------
export const THING_KINDS = {
  lamp: { label: "Street lamp", cat: "Lights", h: 6.5, note: "a pole with an arm and a head over the road (lights at dusk)" },
  lantern: { label: "Lantern lamp", cat: "Lights", h: 5.2, note: "the shopping street's lamp: lanterns on arms, a name plate on top" },
  postlamp: { label: "Post lamp", cat: "Lights", h: 3.2, note: "a short lamp on a post (a park, a path)" },
  pole: { label: "Utility pole", cat: "Poles and wires", h: 11, note: "a concrete pole with its cross arms; Wire to another pole for the wires" },
  vending: { label: "Vending machine", cat: "Shop and street", h: 1.83, note: "a lit drinks machine" },
  postbox: { label: "Post box", cat: "Shop and street", h: 1.3, note: "a red post box (round, or square)" },
  bollard: { label: "Bollard", cat: "Shop and street", h: 0.85, note: "a short post with a reflector" },
  bike: { label: "Bicycle", cat: "Shop and street", h: 1.05, note: "a bicycle on its stand" },
  sign: { label: "Road sign", cat: "Road", h: 2.8, note: "a pole with road signs: stop, one way, no entry, 30, walkers" },
  mirror: { label: "Traffic mirror", cat: "Road", h: 3.0, note: "the round orange mirror at a blind corner" },
  cone: { label: "Traffic cone", cat: "Road", h: 0.7, note: "a cone" },
  barrier: { label: "Barrier", cat: "Road", h: 0.8, note: "a striped barrier on two legs" },
  manhole: { label: "Manhole", cat: "Road", h: 0.02, note: "an iron cover in the road" },
  drain: { label: "Drain grate", cat: "Road", h: 0.02, note: "a grate at the road's edge" },
  car: { label: "Car", cat: "Road", h: 1.8, note: "a parked car (a van, a small car, a saloon)" },
  person: { label: "Person (stand-in)", cat: "People", h: 1.7, note: "a stand-in for scale and a shot's composition" },
  bench: { label: "Bench", cat: "Shop and street", h: 0.8, note: "a bench" },
  bin: { label: "Bin", cat: "Shop and street", h: 0.9, note: "a bin" },
  crates: { label: "Crates", cat: "Shop and street", h: 0.9, note: "a stack of plastic crates" },
  pot: { label: "Plant pot", cat: "Shop and street", h: 0.45, note: "a pot (no plant yet)" },
  ac: { label: "AC unit", cat: "Shop and street", h: 0.6, note: "an air conditioner's outdoor unit on the ground" },
  box: { label: "Block", cat: "Shop and street", h: 1.0, note: "a plain block of any size and material: stand in for anything" },
  tree: { label: "Tree (stand-in)", cat: "Plants", h: 8, note: "a trunk and a lumpy crown `w` across: a stand-in for a street's or a schoolyard's tree (Blender's Foliage for the real ones)" },
};
export const SIGN_KINDS = { stop: "止まれ (stop)", oneway: "one way", straight: "straight on only", noentry: "no entry", speed30: "30 limit", walk: "walkers", school: "school", noparking: "no parking" };
export function thingParts(t) {
  const o = out(), K = THING_KINDS[t.kind] || THING_KINDS.box, h = num(t.h, K.h), R = rng(seedOf(t.id || t.kind) + num(t.seed, 0));
  switch (t.kind) {
    case "lamp": {
      const arm = num(t.arm, 1.4), col = t.slot || "steel";
      box(o, col, -0.12, -0.12, 0, 0.12, 0.12, 0.45);
      cyl(o, col, [0, 0, 0.45], [0, 0, h], 0.075, 8, 0.055);
      bar(o, col, [0, 0, h - 0.25], [0, -arm, h + 0.05], 0.07, 0.07);
      box(o, col, -0.16, -arm - 0.45, h - 0.12, 0.16, -arm + 0.05, h + 0.08);
      poly(o, t.cool ? "lamp_cool" : "lamp", [[-0.12, -arm - 0.4, h - 0.12 - GAP], [0.12, -arm - 0.4, h - 0.12 - GAP], [0.12, -arm, h - 0.12 - GAP], [-0.12, -arm, h - 0.12 - GAP]], [0, 0, -1]);
      o.lights.push({ at: [0, -arm - 0.2, h - 0.3], color: t.color || (t.cool ? "#e8f0ff" : "#ffd6a0"), power: num(t.power, 30), dist: num(t.dist, 18), down: true });
      break;
    }
    case "lantern": {                                                // the shopping street's lamp (one or two lanterns, a name plate)
      const col = t.slot || "black", heads = Math.max(1, Math.min(2, Math.round(num(t.heads, 2)))), arm = num(t.arm, 0.75);
      cyl(o, col, [0, 0, 0], [0, 0, h + 0.5], 0.07, 8, 0.06);
      box(o, col, -0.14, -0.14, 0, 0.14, 0.14, 0.5);
      const head = (x, y, z) => {
        cyl(o, "lamp", [x, y, z - 0.42], [x, y, z], 0.16, 6, 0.19, true, col);
        cyl(o, col, [x, y, z], [x, y, z + 0.07], 0.22, 6, 0.08);
        cyl(o, col, [x, y, z - 0.47], [x, y, z - 0.42], 0.12, 6);
        bar(o, col, [x, y, z + 0.07], [x, y, z + 0.18], 0.03);
        o.lights.push({ at: [x, y, z - 0.2], color: t.color || "#ffc47e", power: num(t.power, 12), dist: num(t.dist, 11) });
      };
      const dirs = heads === 2 ? [-1, 1] : [-1];
      for (const sd of dirs) { bar(o, col, [0, sd * 0.035, h - 0.1], [0, sd * arm, h + 0.15], 0.05); head(0, sd * arm, h - 0.05); }   // each arm from its own side of the pole
      if (t.text !== "") {                                           // the plate on top: words, a little blue roof
        const key = `${t.id || "lantern"}.0`, pw = num(t.pw, 1.0), ph = 0.34, z0 = h + 0.55;
        o.signs.push({ key, text: t.text || "ほんちょう", fg: "#1d2a4d", bg: "#f2f2ee", lit: false, dir: "h", w: pw, h: ph });
        box(o, col, -pw / 2 - 0.02, -0.03, z0 - 0.02, pw / 2 + 0.02, 0.03, z0 + ph + 0.02);
        const pf = 0.03 + GAP;
        for (const sd of [-1, 1]) poly(o, "sign:" + key, [[-pw / 2, sd * pf, z0], [pw / 2, sd * pf, z0], [pw / 2, sd * pf, z0 + ph], [-pw / 2, sd * pf, z0 + ph]], [0, sd, 0], sd < 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[1, 0], [0, 0], [0, 1], [1, 1]]);
        for (const sd of [-1, 1]) poly(o, "blue", [[-pw / 2 - 0.05, sd * pf, z0 + ph + 0.02], [pw / 2 + 0.05, sd * pf, z0 + ph + 0.02], [0, sd * pf, z0 + ph + 0.3]], [0, sd, 0]);
        box(o, "blue", -0.04, -0.03, z0 + ph + 0.02, 0.04, 0.03, z0 + ph + 0.3, "");
      }
      break;
    }
    case "postlamp": {
      const col = t.slot || "black";
      if (num(t.globes, 0) > 0) {                                     // a pole with a bar and round globes on it
        const n = Math.round(num(t.globes, 2)), bw = num(t.bar, 0.9);
        cyl(o, col, [0, 0, 0], [0, 0, h - 0.25], 0.055, 8);
        box(o, col, -bw / 2, -0.03, h - 0.3, bw / 2, 0.03, h - 0.22);
        for (let i = 0; i < n; i++) {
          const x = n === 1 ? 0 : -bw / 2 + bw * i / (n - 1);
          cyl(o, col, [x, 0, h - 0.22], [x, 0, h - 0.14], 0.06, 8);
          cyl(o, "lamp", [x, 0, h - 0.14], [x, 0, h + 0.06], 0.17, 8, 0.2, false); cyl(o, "lamp", [x, 0, h + 0.06], [x, 0, h + 0.26], 0.2, 8, 0.12, false);
          poly(o, "lamp", Array.from({ length: 8 }, (_, k) => [x + Math.cos(k / 8 * Math.PI * 2) * 0.12, Math.sin(k / 8 * Math.PI * 2) * 0.12, h + 0.26]), [0, 0, 1]);
          o.lights.push({ at: [x, 0, h + 0.06], color: t.color || "#fff1d6", power: num(t.power, 7), dist: num(t.dist, 9) });
        }
        break;
      }
      cyl(o, col, [0, 0, 0], [0, 0, h - 0.45], 0.05, 8);
      cyl(o, "lamp", [0, 0, h - 0.45], [0, 0, h - 0.1], 0.13, 8, 0.15, true, col);
      cyl(o, col, [0, 0, h - 0.1], [0, 0, h], 0.2, 8, 0.05);
      o.lights.push({ at: [0, 0, h - 0.3], color: t.color || "#ffd09a", power: num(t.power, 8), dist: num(t.dist, 9) });
      break;
    }
    case "pole": {                                                   // a concrete pole: cross arms, insulators, a transformer if asked
      cyl(o, "pole", [0, 0, 0], [0, 0, h], 0.17, 10, 0.12);
      if (t.guard !== false) cyl(o, "hazard", [0, 0, 0.02], [0, 0, 1.8], 0.17 + GAP + 0.005, 10, 0.17 + GAP);
      for (const [z, wdt] of [[h - 0.45, 1.9], [h - 1.45, 1.5]]) {
        box(o, "steel", -wdt / 2, -0.05, z - 0.05, wdt / 2, 0.05, z + 0.05);
        for (const x of armXs(wdt)) cyl(o, "white", [x, 0, z + 0.05], [x, 0, z + 0.19], 0.035, 6);
      }
      if (t.trans) { cyl(o, "pole", [0.28, -0.3, h - 3.6], [0.28, -0.3, h - 2.6], 0.24, 8); cyl(o, "pole", [-0.28, -0.3, h - 3.6], [-0.28, -0.3, h - 2.6], 0.24, 8); box(o, "steel", -0.6, -0.35, h - 3.7, 0.6, -0.15, h - 3.6); }
      for (let z = 2.2; z < h - 2; z += 0.45) box(o, "steel", -0.015, -0.2, z, 0.015, 0.2, z + 0.03);   // the step bolts
      break;
    }
    case "vending": {
      const w = num(t.w, 1.0), d = num(t.d, 0.75), col = t.slot || "vend";
      box(o, col, -w / 2, -d / 2, 0, w / 2, d / 2, h);
      poly(o, "vend_lit", [[-w / 2 + 0.06, -d / 2 - GAP, h * 0.5], [w / 2 - 0.06, -d / 2 - GAP, h * 0.5], [w / 2 - 0.06, -d / 2 - GAP, h - 0.12], [-w / 2 + 0.06, -d / 2 - GAP, h - 0.12]], [0, -1, 0]);
      box(o, "black", -w / 2 + 0.08, -d / 2 - 0.04, 0.12, w / 2 - 0.08, -d / 2, 0.38);
      box(o, "black", w / 2 - 0.3, -d / 2 - 0.03, h * 0.38, w / 2 - 0.08, -d / 2, h * 0.47);
      o.lights.push({ at: [0, -d / 2 - 0.5, h * 0.7], color: "#e9f0ff", power: num(t.power, 3), dist: num(t.dist, 4.5) });
      break;
    }
    case "postbox": {
      if (t.style === "square") { box(o, "red", -0.22, -0.18, 0.25, 0.22, 0.18, h); box(o, "red", -0.05, -0.05, 0, 0.05, 0.05, 0.25); box(o, "black", -0.14, -0.185, h - 0.32, 0.14, -0.18, h - 0.26); }
      else { cyl(o, "red", [0, 0, 0], [0, 0, h - 0.2], 0.21, 12); cyl(o, "red", [0, 0, h - 0.2], [0, 0, h - 0.12], 0.25, 12); cyl(o, "red", [0, 0, h - 0.12], [0, 0, h], 0.2, 12, 0.06); box(o, "black", -0.12, -0.215, h - 0.5, 0.12, -0.2, h - 0.44); }
      break;
    }
    case "bollard": { const r = num(t.r, 0.065); cyl(o, t.slot || "steel", [0, 0, 0], [0, 0, h], r, 8); cyl(o, "white", [0, 0, h - 0.18], [0, 0, h - 0.1], r + GAP, 8, r + GAP, false); break; }
    case "bike": {                                                   // along x, the front wheel at +x
      const rw = 0.33, hub = [[-0.52, 0, rw], [0.52, 0, rw]], ring = c => Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2; return [c[0] + Math.cos(a) * rw, 0, c[2] + Math.sin(a) * rw]; });
      for (const c of hub) { tube(o, "rubber", ring(c), 0.02, 4, true); bar(o, "chrome", [c[0] - rw, 0, c[2]], [c[0] + rw, 0, c[2]], 0.006); bar(o, "chrome", [c[0], 0, c[2] - rw], [c[0], 0, c[2] + rw], 0.006); }
      const seat = [-0.18, 0, 0.92], head = [0.35, 0, 0.95], bb = [-0.05, 0, 0.32], col = t.slot || "black";
      for (const [a, b2, w] of [[seat, bb, 0.03], [bb, head, 0.04], [seat, head, 0.02], [head, hub[1], 0.03]]) bar(o, col, a, b2, w);   // tubes 5 mm apart in thickness
      for (const sd of [-1, 1]) for (const [q, sy] of [[bb, 0.046], [seat, 0.034]]) bar(o, col, [hub[0][0], sd * sy, hub[0][2]], [q[0], sd * sy, q[2]], 0.016);   // the stays, either side of the wheel
      box(o, "black", seat[0] - 0.12, -0.06, seat[2], seat[0] + 0.08, 0.06, seat[2] + 0.05);
      bar(o, "chrome", [head[0], -0.28, head[2] + 0.1], [head[0], 0.28, head[2] + 0.1], 0.025);
      box(o, "steel", head[0] + 0.05, -0.15, head[2] - 0.15, head[0] + 0.35, 0.15, head[2]);   // its basket
      break;
    }
    case "sign": {
      const list = (Array.isArray(t.signs) && t.signs.length ? t.signs : ["stop"]).slice(0, 3);
      cyl(o, "steel", [0, 0, 0], [0, 0, h], 0.03, 6);
      let z = h - 0.05;
      for (const k of list) {
        const sc = num(t.scale, 1), s = (k === "oneway" ? [0.9, 0.3] : k === "stop" ? [0.8, 0.7] : [0.6, 0.6]).map(v => v * sc);
        z -= s[1];
        poly(o, "tsign:" + k, [[-s[0] / 2, -0.06, z], [s[0] / 2, -0.06, z], [s[0] / 2, -0.06, z + s[1]], [-s[0] / 2, -0.06, z + s[1]]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        poly(o, "tsign:" + k + ":back", [[-s[0] / 2, -0.05, z], [s[0] / 2, -0.05, z], [s[0] / 2, -0.05, z + s[1]], [-s[0] / 2, -0.05, z + s[1]]], [0, 1, 0], [[1, 0], [0, 0], [0, 1], [1, 1]]);
        box(o, "steel", -0.04, -0.05, z + s[1] / 2 - 0.03, 0.04, 0, z + s[1] / 2 + 0.03);
        z -= 0.08 * sc;
      }
      break;
    }
    case "mirror": {
      cyl(o, "orange", [0, 0, 0], [0, 0, h], 0.04, 8);
      bar(o, "orange", [0, 0, h - 0.2], [0, -0.25, h - 0.2], 0.05);
      cyl(o, "orange", [0, -0.25, h - 0.2], [0, -0.33, h - 0.2], 0.42, 14);
      cyl(o, "chrome", [0, -0.33, h - 0.2], [0, -0.335, h - 0.2], 0.37, 14, 0.37, true);
      break;
    }
    case "cone": cyl(o, "orange", [0, 0, 0.04], [0, 0, h], 0.16, 8, 0.025); box(o, "orange", -0.2, -0.2, 0, 0.2, 0.2, 0.04); cyl(o, "white", [0, 0, h * 0.45], [0, 0, h * 0.62], 0.115, 8, 0.085, false); break;
    case "barrier": {
      const w = num(t.w, 1.6);
      for (const sx of [-1, 1]) { bar(o, "white", [sx * (w / 2 - 0.1), -0.25, 0], [sx * (w / 2 - 0.1), 0, h], 0.05); bar(o, "white", [sx * (w / 2 - 0.1 - GAP), 0.25, 0], [sx * (w / 2 - 0.1 - GAP), 0, h], 0.05); }
      box(o, "hazard", -w / 2, -0.03, h - 0.28, w / 2, 0.03, h);
      break;
    }
    case "manhole": cyl(o, "iron", [0, 0, 0], [0, 0, 0.012], num(t.r, 0.32), 14); break;
    case "drain": { const w = num(t.w, 0.9), d = num(t.d, 0.35); box(o, "dark", -w / 2, -d / 2, 0, w / 2, d / 2, 0.006); poly(o, "grate", [[-w / 2, -d / 2, 0.006 + GAP], [w / 2, -d / 2, 0.006 + GAP], [w / 2, d / 2, 0.006 + GAP], [-w / 2, d / 2, 0.006 + GAP]], [0, 0, 1]); break; }
    case "car": carGen(o, t, h); break;
    case "person": personGen(o, t, h, R); break;
    case "bench": { const w = num(t.w, 1.6); box(o, "wood", -w / 2, -0.22, 0.42, w / 2, 0.22, 0.47); box(o, "wood", -w / 2, 0.16, 0.5, w / 2, 0.21, 0.82); for (const sx of [-1, 1]) box(o, "steel", sx * (w / 2 - 0.15) - 0.03, -0.2, 0, sx * (w / 2 - 0.15) + 0.03, 0.2, 0.42); break; }
    case "bin": cyl(o, t.slot || "steel", [0, 0, 0], [0, 0, h], 0.25, 10); cyl(o, "black", [0, 0, h], [0, 0, h + 0.04], 0.26, 10); break;
    case "crates": { const n = Math.max(1, Math.round(num(t.n, 3))); for (let i = 0; i < n; i++) box(o, t.slot || (i % 2 ? "yellow" : "blue"), -0.23 + (R() - 0.5) * 0.04, -0.17, i * 0.3, 0.23, 0.17 + (R() - 0.5) * 0.03, i * 0.3 + 0.29); break; }
    case "tree": {                                                  // a trunk, two limbs, a crown of overlapping lumps
      // the crown from `base` (of its height) to its top, `w` across: lumps round a middle one, high and low
      const w = num(t.w, h * 0.7), tr = Math.max(0.08, w * 0.04), base = num(t.base, 0.38), zb = h * base, zm = (zb + h) / 2, hh = (h - zb) / 2;
      cyl(o, "bark", [0, 0, 0], [0, 0, zm], tr, 7, tr * 0.6);
      for (let k = 0; k < 3; k++) { const a = R() * Math.PI * 2; cyl(o, "bark", [0, 0, zb * 0.9], [Math.cos(a) * w * 0.25, Math.sin(a) * w * 0.25, zm + hh * 0.2], tr * 0.5, 5, tr * 0.25); }
      const n = 7 + Math.floor(R() * 3);
      lump(o, t.slot || "foliage", [0, 0, zm], Math.min(w * 0.38, hh * 0.9), Math.min(1.1, hh / (w * 0.38)), R);
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 + R() * 0.5, rr = w * (0.24 + R() * 0.1), r0 = w * (0.2 + R() * 0.07), zz = zm + (R() * 2 - 1) * hh * 0.45;
        lump(o, t.slot || "foliage", [Math.cos(a) * rr, Math.sin(a) * rr, zz], r0, Math.min(1, hh / (r0 * 1.6)) * (0.8 + R() * 0.25), R);
      }
      break;
    }
    case "pot": cyl(o, t.slot || "plant_pot", [0, 0, 0], [0, 0, h], 0.16, 8, 0.22); cyl(o, "dark", [0, 0, h - 0.04], [0, 0, h - 0.035], 0.2, 8); break;
    case "ac": box(o, "ac", -0.4, -0.15, 0, 0.4, 0.15, h); poly(o, "fan", [[-0.33, -0.15 - GAP, 0.08], [0.1, -0.15 - GAP, 0.08], [0.1, -0.15 - GAP, 0.52], [-0.33, -0.15 - GAP, 0.52]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]); break;
    default: { const w = num(t.w, 1), d = num(t.d, 1); box(o, t.slot || "concrete", -w / 2, -d / 2, 0, w / 2, d / 2, h); }
  }
  return o;
}
const armXs = w => [-w / 2 + 0.12, -0.3, 0.3, w / 2 - 0.12];
function carGen(o, t, h) {
  const style = t.style || "van", col = t.slot || "car", L = style === "kei" ? 3.4 : style === "sedan" ? 4.6 : 4.7, W = style === "kei" ? 1.48 : 1.7;
  const body = style === "sedan" ? 0.75 : 0.95, top = style === "sedan" ? 1.42 : h;
  const wheels = [[-L / 2 + 0.7, -W / 2], [L / 2 - 0.75, -W / 2], [-L / 2 + 0.7, W / 2], [L / 2 - 0.75, W / 2]];
  for (const [x, y] of wheels) cyl(o, "rubber", [x, y - 0.1 * Math.sign(y), 0.31], [x, y + 0.02 * Math.sign(y), 0.31], 0.31, 10);
  box(o, col, -L / 2, -W / 2, 0.28, L / 2, W / 2, body + 0.28);
  const c0 = style === "sedan" ? -L / 2 + 1.2 : -L / 2 + 0.25, c1 = style === "sedan" ? L / 2 - 1.25 : L / 2 - 0.8;
  box(o, col, c0, -W / 2 + 0.06, body + 0.28, c1, W / 2 - 0.06, top);
  const gw = W / 2 - 0.06 + GAP;                                     // the windows a GAP off the cabin's sides
  for (const sd of [-1, 1]) poly(o, "car_glass", [[c0 + 0.15, sd * gw, body + 0.38], [c1 - 0.1, sd * gw, body + 0.38], [c1 - 0.1, sd * gw, top - 0.08], [c0 + 0.15, sd * gw, top - 0.08]], [0, sd, 0]);
  poly(o, "car_glass", [[c1 + GAP, -W / 2 + 0.15, body + 0.36], [c1 + GAP, W / 2 - 0.15, body + 0.36], [c1 + GAP, W / 2 - 0.15, top - 0.08], [c1 + GAP, -W / 2 + 0.15, top - 0.08]], [1, 0, 0]);
  for (const sd of [-1, 1]) { box(o, "headlight", L / 2 - 0.02, sd * (W / 2 - 0.3) - 0.14, body, L / 2 + 0.01, sd * (W / 2 - 0.3) + 0.14, body + 0.14); box(o, "taillight", -L / 2 - 0.01, sd * (W / 2 - 0.15) - 0.1, body, -L / 2 + 0.02, sd * (W / 2 - 0.15) + 0.1, body + 0.25); }
}
function personGen(o, t, h, R) {                                    // a plain low-poly figure facing -y: legs, body, arms, head
  const k = h / 1.7, walk = t.pose === "walk", cl = t.slot || "cloth", c2 = t.slot2 || "cloth2", st = walk ? 0.17 * k : 0;
  for (const sx of [-1, 1]) {
    const hip = [sx * 0.09 * k, 0, 0.88 * k], foot = [sx * 0.1 * k, sx * st, 0.07 * k];
    cyl(o, c2, foot, hip, 0.068 * k, 6, 0.085 * k);
    box(o, "black", foot[0] - 0.055 * k, foot[1] - 0.13 * k, 0, foot[0] + 0.055 * k, foot[1] + 0.06 * k, 0.08 * k);
    const sh = [sx * 0.2 * k, 0, 1.38 * k], hand = [sx * 0.25 * k, -sx * st * 0.8, 0.84 * k];
    cyl(o, cl, sh, hand, 0.06 * k, 6, 0.045 * k);
    cyl(o, "skin", hand, [hand[0], hand[1], hand[2] - 0.08 * k], 0.04 * k, 5);
  }
  cyl(o, cl, [0, 0, 0.84 * k], [0, 0, 1.42 * k], 0.17 * k, 6, 0.21 * k);
  cyl(o, cl, [0, 0, 1.42 * k], [0, 0, 1.47 * k], 0.21 * k, 6, 0.08 * k, false);
  cyl(o, "skin", [0, 0, 1.44 * k], [0, 0, 1.52 * k], 0.05 * k, 6);
  cyl(o, "skin", [0, 0, 1.5 * k], [0, 0, 1.69 * k], 0.088 * k, 7, 0.08 * k);
  cyl(o, "hair", [0, 0.02 * k, 1.6 * k], [0, 0.02 * k, 1.72 * k], 0.093 * k, 7, 0.06 * k);
  if (t.bag) box(o, "black", -0.15 * k, 0.15 * k, 0.95 * k, 0.15 * k, 0.32 * k, 1.38 * k);
  void R;
}

// ---- fences: a run from `from` to `to`, posts and what's between them ---------------------------------------------
export const FENCE_KINDS = {
  mesh: { label: "Wire mesh", h: 1.8, step: 2.0, note: "chain-link on steel posts with a top rail" },
  wood: { label: "Wooden boards", h: 1.6, step: 1.8, note: "boards with small gaps on wooden posts" },
  panel: { label: "Long metal panels", h: 2.4, step: 1.8, note: "the tall ribbed panels round a building site" },
  block: { label: "Block wall", h: 1.5, step: 0, note: "a concrete block wall with its cap" },
  blockmesh: { label: "Block wall, mesh on top", h: 1.9, step: 2.0, note: "a low block wall with a mesh fence on it" },
  rail: { label: "Pipe railing", h: 1.0, step: 2.0, note: "posts and two rails (a guardrail, a canal's edge)" },
  bamboo: { label: "Bamboo", h: 1.8, step: 1.8, note: "a bamboo screen fence (the old town)" },
  slats: { label: "Wooden slats", h: 1.8, step: 2.0, note: "horizontal slats on posts (a modern house's screen)" },
  gate: { label: "Gate (two leaves)", h: 1.3, step: 0, note: "a steel gate of bars between two posts, its two leaves shut (open: how far, 0 to 1)" },
  accordion: { label: "Folding gate", h: 1.1, step: 0, note: "the striped folding (accordion) gate across a car park's way in, half drawn (open: 0 to 1)" },
  chain: { label: "Chain", h: 0.75, step: 0, note: "a chain hung between two short posts (a car park's way in at night)" },
  ribbed: { label: "Ribbed concrete wall", h: 1.8, step: 2.0, note: "precast concrete panels ribbed top to bottom on both faces, a post at each joint, a coping (a school's front)" },
  slidegate: { label: "Sliding gate", h: 1.5, step: 0, note: "a school's steel gate on wheels: a frame of bars painted blue, slid `open` (0 to 1) back along its run" },
};
export function fenceParts(f, surface) {
  const o = out(), K = FENCE_KINDS[f.kind] || FENCE_KINDS.mesh, [ax, ay] = f.from, [bx, by] = f.to, L = Math.hypot(bx - ax, by - ay);
  if (L < 0.05) return o;
  const h = num(f.h, K.h), step = num(f.step, K.step), t = [(bx - ax) / L, (by - ay) / L], n = [-t[1], t[0]];
  // made along x from 0 to L (its own space, the run's left at +y), then laid along the run (UVs stay the run's own)
  const n0 = Math.max(1, step > 0 ? Math.round(L / step) : 1), bays = Array.from({ length: n0 + 1 }, (_, i) => L * i / n0);
  const post = f.post || (f.kind === "wood" || f.kind === "bamboo" || f.kind === "slats" ? "wood" : "post");
  const quadX = (slot, x0, x1, z0, z1, y = 0) => two(o, slot, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, -1, 0]);
  switch (f.kind) {
    case "block": case "blockmesh": {
      const bh = f.kind === "block" ? h : num(f.wall, 0.8), th = 0.15;
      box(o, f.slot || "blocks", 0, -th / 2, 0, L, th / 2, bh, "-z");
      box(o, "concrete", -0.01, -th / 2 - 0.02, bh, L + 0.01, th / 2 + 0.02, bh + 0.06);
      if (f.kind === "blockmesh") {
        for (const x of bays) cyl(o, post, [clamp(x, 0.05, L - 0.05), 0, bh + 0.06], [clamp(x, 0.05, L - 0.05), 0, h - 0.02], 0.025, 6);
        quadX("chainlink", 0, L, bh + 0.08, h - 0.04);
        cyl(o, post, [0, 0, h - 0.02], [L, 0, h - 0.02], 0.02, 6);
      }
      break;
    }
    case "mesh": {
      for (const x of bays) cyl(o, post, [clamp(x, 0.03, L - 0.03), 0, 0], [clamp(x, 0.03, L - 0.03), 0, h - 0.02], 0.028, 6);
      quadX(f.slot || "chainlink", 0, L, 0.04, h - 0.03);
      cyl(o, post, [0, 0, h - 0.02], [L, 0, h - 0.02], 0.022, 6);
      break;
    }
    case "wood": {
      for (const x of bays) box(o, post, clamp(x, 0.05, L - 0.05) - 0.045, 0.01, 0, clamp(x, 0.05, L - 0.05) + 0.045, 0.1, h + 0.05);
      for (const z of [0.25, h - 0.3]) box(o, post, 0, 0.0, z, L, 0.03, z + 0.09);
      quadX(f.slot || "boards", 0, L, 0.05, h, -0.01);
      break;
    }
    case "slats": {
      for (const x of bays) box(o, post, clamp(x, 0.04, L - 0.04) - 0.04, -0.04, 0, clamp(x, 0.04, L - 0.04) + 0.04, 0.04, h);
      const sl = Math.max(3, Math.round(h / 0.14));
      for (let i = 0; i < sl; i++) box(o, f.slot || "wood", 0, -0.065, 0.06 + i * (h - 0.08) / sl, L, -0.045, 0.06 + i * (h - 0.08) / sl + (h - 0.08) / sl * 0.75);
      break;
    }
    case "panel": {
      for (const x of bays) box(o, post, clamp(x, 0.04, L - 0.04) - 0.04, 0.02, 0, clamp(x, 0.04, L - 0.04) + 0.04, 0.1, h);
      box(o, f.slot || "panel", 0, -0.02, 0, L, 0.02, h, "-z");
      break;
    }
    case "rail": {
      for (const x of bays) cyl(o, post, [clamp(x, 0.04, L - 0.04), 0, 0], [clamp(x, 0.04, L - 0.04), 0, h - 0.03], 0.035, 8);
      for (const z of [h - 0.03, h * 0.55]) cyl(o, f.slot || "post", [0, 0, z], [L, 0, z], 0.03, 8);
      break;
    }
    case "gate": {                                                    // two posts, two barred leaves meeting in the middle (swung by `open`)
      const op = clamp(num(f.open, 0), 0, 1) * 85 * Math.PI / 180, pw = 0.12, lw = (L - 2 * pw) / 2 - 0.03;   // shut, a gap between the leaves
      box(o, f.post || "steel", 0, -pw / 2, 0, pw, pw / 2, h + 0.15); box(o, f.post || "steel", L - pw, -pw / 2, 0, L, pw / 2, h + 0.15);
      for (const side of [0, 1]) {
        const hx = side ? L - pw : pw, dir = side ? -1 : 1, a = side ? Math.PI - op : op;
        const along = [Math.cos(a) * dir * (side ? -1 : 1), Math.sin(a) * (side ? 1 : 1)], tip = [hx + along[0] * lw, along[1] * lw];
        for (const z of [0.1, h - 0.05]) bar(o, f.slot || "rail", [hx, 0, z], [tip[0], tip[1], z], 0.05, 0.04);
        bar(o, f.slot || "rail", [tip[0], tip[1], 0.08], [tip[0], tip[1], h], 0.05, 0.05);   // thicker than the rails across: no side in their plane
        two(o, "bars", [[hx, 0, 0.12], [tip[0], tip[1], 0.12], [tip[0], tip[1], h - 0.07], [hx, 0, h - 0.07]], [-along[1], along[0], 0]);
      }
      break;
    }
    case "ribbed": {                                                  // precast panels with vertical ribs both sides, posts, a coping
      const th = 0.1, rw = 0.055, rd = 0.035, pitch = num(f.rib, 0.15), sl = f.slot || "concrete";
      box(o, sl, 0, -th / 2, 0, L, th / 2, h, "-z+z-x+x");
      for (const x of bays) box(o, sl, clamp(x, 0.11, L - 0.11) - 0.11, -th / 2 - rd - 0.03, 0, clamp(x, 0.11, L - 0.11) + 0.11, th / 2 + rd + 0.03, h, "-z+z");   // posts
      for (let i = 0; i < n0; i++) {
        const a = bays[i] + 0.14, b = bays[i + 1] - 0.14, nr = Math.max(1, Math.floor((b - a) / pitch));
        for (let k = 0; k < nr; k++) {
          const x = a + (b - a) * (k + 0.5) / nr;
          for (const sd of [-1, 1]) {                                 // a rib: its face and its two sides (top and foot hidden)
            const y0 = sd * th / 2, y1 = sd * (th / 2 + rd);
            poly(o, sl, [[x - rw / 2, y1, 0], [x + rw / 2, y1, 0], [x + rw / 2, y1, h - 0.01], [x - rw / 2, y1, h - 0.01]], [0, sd, 0]);
            poly(o, sl, [[x - rw / 2, y0, 0], [x - rw / 2, y1, 0], [x - rw / 2, y1, h - 0.01], [x - rw / 2, y0, h - 0.01]], [-1, 0, 0]);
            poly(o, sl, [[x + rw / 2, y0, 0], [x + rw / 2, y1, 0], [x + rw / 2, y1, h - 0.01], [x + rw / 2, y0, h - 0.01]], [1, 0, 0]);
          }
        }
      }
      box(o, "concrete", -0.02, -th / 2 - rd - 0.05, h, L + 0.02, th / 2 + rd + 0.05, h + 0.08);   // the coping
      break;
    }
    case "slidegate": {                                               // a frame of bars on wheels, slid back along its run behind it
      const op = clamp(num(f.open, 0), 0, 0.95), y = -0.16, sl = f.slot || "gate_blue", x0 = -L * op + 0.06, x1 = x0 + L - 0.12, zb = 0.1;
      box(o, f.post || "concrete", L - 0.15, -0.18, 0, L + 0.05, 0.18, h + 0.12);                 // the post it shuts against
      const zm = zb + (h - zb) * 0.5;                                // rails right across, stiles between them (never over a rail)
      for (const [a, b, p, q] of [[x0, x1, h - 0.06, h], [x0, x1, zb, zb + 0.06], [x0, x1, zm - 0.03, zm + 0.03],
        [x0, x0 + 0.06, zb + 0.06, zm - 0.03], [x0, x0 + 0.06, zm + 0.03, h - 0.06], [x1 - 0.06, x1, zb + 0.06, zm - 0.03], [x1 - 0.06, x1, zm + 0.03, h - 0.06]])
        box(o, sl, a, y - 0.03, p, b, y + 0.03, q);
      const nb = Math.max(2, Math.round((x1 - x0) / 0.12));
      for (let i = 1; i < nb; i++) { const x = x0 + (x1 - x0) * i / nb; cyl(o, sl, [x, y, zb + 0.06], [x, y, h - 0.06], 0.012, 5); }
      for (const x of [x0 + 0.25, x1 - 0.25]) cyl(o, "rubber", [x, y - 0.04, 0.06], [x, y + 0.04, 0.06], 0.06, 8);
      break;
    }
    case "accordion": {                                               // the folding gate: a lattice of thin diagonals on little wheels, drawn `open` back to its post
      const op = clamp(num(f.open, 0.5), 0, 0.95), len = Math.max(0.4, L * (1 - op)), n = Math.max(3, Math.round(len / 0.32));
      box(o, f.post || "white", 0, -0.08, 0, 0.16, 0.08, h + 0.1); box(o, f.post || "white", L - 0.12, -0.06, 0, L, 0.06, h * 0.6);
      for (let i = 0; i < n; i++) {
        const x0 = 0.16 + (len - 0.16) * i / n, x1 = 0.16 + (len - 0.16) * (i + 1) / n;
        bar(o, i % 2 ? "red" : "white", [x0, -0.011, 0.12], [x1, -0.011, h], 0.035, 0.02); bar(o, i % 2 ? "white" : "red", [x0, 0.011, h], [x1, 0.011, 0.12], 0.035, 0.02);   // two layers, pinned where they cross
        cyl(o, "rubber", [x1, -0.04, 0.05], [x1, 0.04, 0.05], 0.05, 6);
      }
      box(o, "white", 0.16, -0.03, h - 0.04, len, 0.03, h + 0.04); box(o, "white", 0.16, -0.03, 0.08, len, 0.03, 0.14);
      break;
    }
    case "chain": {
      for (const x of [0.06, L - 0.06]) { cyl(o, f.post || "white", [x, 0, 0], [x, 0, h], 0.05, 8); cyl(o, "red", [x, 0, h - 0.18], [x, 0, h - 0.1], 0.05 + GAP, 8, 0.05 + GAP, false); }
      const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push([0.06 + (L - 0.12) * t, 0, h - 0.12 - 0.35 * 4 * t * (1 - t)]); }
      tube(o, "steel", pts, 0.012, 4);
      break;
    }
    case "bamboo": {
      for (const x of bays) cyl(o, "wood_dark", [clamp(x, 0.05, L - 0.05), 0.04, 0], [clamp(x, 0.05, L - 0.05), 0.04, h + 0.05], 0.05, 8);
      quadX(f.slot || "bamboo", 0, L, 0.02, h);
      for (const z of [h * 0.2, h * 0.55, h * 0.88]) box(o, "wood_dark", 0, -0.03, z, L, 0.03, z + 0.04);
      break;
    }
    default: break;
  }
  // into the street: x along the run, y its left; each post on the ground under it, the bays between leaning with it
  const zs = bays.map(x => surface ? surface(ax + t[0] * x, ay + t[1] * x) : 0);
  const zAt = x => { if (x <= 0) return zs[0]; for (let i = 0; i + 1 < bays.length; i++) if (x <= bays[i + 1]) return zs[i] + (zs[i + 1] - zs[i]) * (x - bays[i]) / ((bays[i + 1] - bays[i]) || 1); return zs[zs.length - 1]; };
  for (const g of Object.values(o.G)) {
    for (let i = 0; i < g.pos.length; i += 3) { const x = g.pos[i], y = g.pos[i + 1]; g.pos[i] = ax + t[0] * x + n[0] * y; g.pos[i + 1] = ay + t[1] * x + n[1] * y; g.pos[i + 2] += zAt(x); }
    for (let i = 0; i < g.nrm.length; i += 3) { const x = g.nrm[i], y = g.nrm[i + 1]; g.nrm[i] = t[0] * x + n[0] * y; g.nrm[i + 1] = t[1] * x + n[1] * y; }
  }
  return o;
}

// ---- wires between utility poles: each pole's `to` (another pole's id) hangs its wires to that one ----------------
function poleArms(t) {                                               // the insulators' tops, in the street
  const h = num(t.h, THING_KINDS.pole.h), out = [];
  for (const [z, w] of [[h - 0.45, 1.9], [h - 1.45, 1.5]]) for (const x of armXs(w)) out.push(place([x, 0, z + 0.19], t));
  return out;
}
export function wiresParts(poles) {
  const o = out(), byId = Object.fromEntries(poles.map(p => [p.id, p]));
  for (const p of poles) {
    const q = byId[p.to]; if (!q || q === p) continue;
    const A = poleArms(p), Bq = poleArms(q);
    // match the arms by side so the wires don't cross: the far pole's arms ordered along the near pole's
    const dirA = sub(A[A.length - 1], A[0]), sortQ = Bq.slice(0, 4).sort((u, v) => dot(sub(u, A[0]), dirA) - dot(sub(v, A[0]), dirA)).concat(Bq.slice(4).sort((u, v) => dot(sub(u, A[0]), dirA) - dot(sub(v, A[0]), dirA)));
    A.forEach((a, i) => {
      const b = sortQ[i], span = Math.hypot(b[0] - a[0], b[1] - a[1]), sag = num(p.sag, 0.012 * span + 0.15), N = 10, pts = [];
      for (let k = 0; k <= N; k++) { const s = k / N; pts.push([a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s - 4 * sag * s * (1 - s)]); }
      tube(o, "wire", pts, i < 4 ? 0.012 : 0.009, 3);
    });
  }
  return o;
}

// ---- a piece into the street: turned and set down ----------------------------------------------------------------
export function place(p, piece) {
  const a = num(piece.turn, 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), [ax, ay] = piece.at || [0, 0], az = num(piece.z, 0);
  return [ax + p[0] * c - p[1] * s, ay + p[0] * s + p[1] * c, az + p[2]];
}
function placeAll(o, piece) {
  const a = num(piece.turn, 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), [ax, ay] = piece.at || [0, 0], az = num(piece.z, 0);
  for (const g of Object.values(o.G)) {
    for (let i = 0; i < g.pos.length; i += 3) { const x = g.pos[i], y = g.pos[i + 1]; g.pos[i] = ax + x * c - y * s; g.pos[i + 1] = ay + x * s + y * c; g.pos[i + 2] += az; }
    for (let i = 0; i < g.nrm.length; i += 3) { const x = g.nrm[i], y = g.nrm[i + 1]; g.nrm[i] = x * c - y * s; g.nrm[i + 1] = x * s + y * c; }
  }
  for (const L of o.lights) L.at = place(L.at, piece);
  return o;
}

// ---- the whole street: a list of pieces, each its triangles by slot, its signs and its lights ----------------------
// cache (optional): a Map the page keeps between builds; a piece whose numbers (and footing) haven't changed is reused
export function build(street, cache) {
  const S = street || {}, pieces = [], T = terrain(S), memo = (key, make) => { if (!cache) return make(); let v = cache.get(key); if (!v) { v = make(); cache.set(key, v); } v.used = true; return v; };
  const roads = S.roads || [], buildings = S.buildings || [], things = S.things || [], fences = S.fences || [];
  const roadsKey = JSON.stringify(roads);
  const safe = (id, type, make) => { try { return Object.assign({ id, type }, make()); } catch (e) { return { id, type, G: {}, signs: [], lights: [], error: e.message }; } };
  roads.forEach((r, i) => pieces.push(memo("r|" + i + "|" + roadsKey, () => safe(r.id, "road", () => roadParts(r, roads.filter(q => q !== r), i)))));
  for (const b of buildings) {
    const foot = footing(b, T), key = "b|" + JSON.stringify(b) + "|" + foot.z + "|" + foot.low;
    const p = memo(key, () => safe(b.id, "building", () => placeAll(buildingParts(b, foot), Object.assign({}, b, { z: foot.z }))));
    pieces.push(p);
    if (p.inside) pieces.push(memo(key + "|inside", () => Object.assign({ id: b.id + "__inside", type: "inside", of: b.id, signs: [], lights: [] }, placeAll(p.inside, Object.assign({}, b, { z: foot.z })))));
  }
  const placed = things.map(t => Object.assign({}, t, { z: T.surface(...(t.at || [0, 0])) + num(t.lift, 0) }));
  for (const t of placed) pieces.push(memo("t|" + JSON.stringify(t), () => safe(t.id, "thing", () => placeAll(thingParts(t), t))));
  for (const f of fences) pieces.push(memo("f|" + JSON.stringify(f) + "|" + (T.flat ? "" : roadsKey), () => safe(f.id, "fence", () => fenceParts(f, T.surface))));
  const poles = placed.filter(t => t.kind === "pole");
  if (poles.some(p => p.to)) pieces.push(memo("w|" + JSON.stringify(poles), () => Object.assign({ id: "_wires", type: "wires" }, wiresParts(poles))));
  for (const d of S.decals || []) pieces.push(memo("d|" + JSON.stringify(d), () => safe(d.id, "decal", () => decalParts(d))));
  // the ground under it all, a margin round what's there: flat, one quad; on a slope, a grid following the roads
  const bb = bounds2(S);
  if (bb && S.ground !== false) {
    const m = num(S.margin, 12), key = "g|" + bb.join(",") + "|" + m + "|" + (T.flat ? "" : roadsKey);
    pieces.push(memo(key, () => {
      const o = out(), x0 = bb[0] - m, y0 = bb[1] - m, x1 = bb[2] + m, y1 = bb[3] + m;
      if (T.flat) poly(o, "ground", [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], [0, 0, 1]);
      else {
        const cell = num(S.cell, 3), nx = Math.max(1, Math.ceil((x1 - x0) / cell)), ny = Math.max(1, Math.ceil((y1 - y0) / cell)), Z = [];
        for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) Z.push(T.ground(x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny) - 0.06);
        const V = (i, j) => [x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny, Z[j * (nx + 1) + i]];
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) polyUp(o, "ground", [V(i, j), V(i + 1, j), V(i + 1, j + 1), V(i, j + 1)]);
      }
      return Object.assign({ id: "_ground", type: "ground" }, o);
    }));
  }
  if (cache) for (const [k, v] of cache) { if (!v.used) cache.delete(k); else v.used = false; }
  return pieces;
}
// ---- decals: what's laid on a surface by hand (the paint page: a poster, rain streaks, a manhole, oil): a quad a GAP off
// the surface at `at`, facing along its normal `n`, `w` x `h` metres, turned `rot` degrees; its up the world's on a wall,
// north on the ground. Its slot `decal:<kind>` wears the decal's picture (assets/decals, tools/streetbake/decals.py)
export function decalParts(d) {
  const n = norm(Array.isArray(d.n) && d.n.length === 3 ? d.n.map(v => num(v, 0)) : [0, 0, 1]), at = (d.at || [0, 0, 0]).map(v => num(v, 0));
  const w = Math.max(0.02, num(d.w, 1)), h = Math.max(0.02, num(d.h, 1)), a = num(d.rot, 0) * Math.PI / 180;
  const R0 = norm(cross(Math.abs(n[2]) < 0.7 ? [0, 0, 1] : [0, 1, 0], n)), U0 = cross(n, R0);
  const R = add(mul(R0, Math.cos(a)), mul(U0, Math.sin(a))), U = sub(mul(U0, Math.cos(a)), mul(R0, Math.sin(a)));
  const C = add(at, mul(n, GAP)), P = (i, j) => add(C, add(mul(R, i * w / 2), mul(U, j * h / 2)));
  const o = out();
  poly(o, "decal:" + String(d.kind || "damp"), [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)], n, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  return o;
}
// the street's extent on the plan [x0, y0, x1, y1]
export function bounds2(S) {
  const xs = [], ys = [];
  const pt = (x, y) => { xs.push(x); ys.push(y); };
  for (const r of S.roads || []) { const f = roadPath(r), q = f.W / 2 + Math.max(...f.walks); for (const p of f.P) { pt(p[0] - q, p[1] - q); pt(p[0] + q, p[1] + q); } }
  for (const b of S.buildings || []) for (const [x, y] of footprint(b)) pt(x, y);
  for (const t of S.things || []) pt(...(t.at || [0, 0]));
  for (const f of S.fences || []) { pt(...f.from); pt(...f.to); }
  return xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null;
}
export function footprint(b) {
  const w = num(b.w, 8), d = num(b.d, 10);
  return [[-w / 2, -d / 2, 0], [w / 2, -d / 2, 0], [w / 2, d / 2, 0], [-w / 2, d / 2, 0]].map(p => place(p, { at: b.at, turn: b.turn }).slice(0, 2));
}
export function stats(pieces) {
  let tris = 0, verts = 0; const slots = new Set();
  for (const p of pieces) for (const [s, g] of Object.entries(p.G)) { tris += g.idx.length / 3; verts += g.pos.length / 3; if (g.idx.length) slots.add(s); }
  return { tris, verts, slots: slots.size, pieces: pieces.length };
}

// ---- a shot's camera: where a point of the street lands in its frame (0..1 across, 0..1 down), as three.js draws it
// (a perspective camera at `eye` looking at `look`, upright, `vfov` tall). Null behind the eye.
export function project(shot, P) {
  const e = shot.eye, l = shot.look, a = Array.isArray(shot.aspect) ? shot.aspect[0] / shot.aspect[1] : 16 / 9;
  const zc = norm(sub(e, l)), xc = norm(cross([0, 0, 1], zc)), yc = cross(zc, xc), d = sub(P, e);
  const x = dot(d, xc), y = dot(d, yc), z = dot(d, zc), t = Math.tan(num(shot.vfov, 60) * Math.PI / 360);
  if (z > -1e-6) return null;
  return [((x / -z) / (t * a) + 1) / 2, (1 - (y / -z) / t) / 2];
}
// how far the street's pins land from where the shot's photo has them, as a share of the frame's height
export function pinErrors(shot) {
  const a = Array.isArray(shot.aspect) ? shot.aspect[0] / shot.aspect[1] : 16 / 9;
  return (shot.pins || []).map(p => { const q = project(shot, p.at); return { name: p.name, err: q ? Math.hypot((q[0] - p.px[0]) * a, q[1] - p.px[1]) : Infinity, at: q }; });
}

// ---- what the player bumps into, and what hides what (the Godot export, GODOT_EXPORT §8's occluders): a few boxes and
// the walkable surfaces a piece. boxes: [{c: [x, y, z], ax: [3 unit axes], h: [3 half sizes]}] in the street;
// surface: triangles {pos, idx} (the roads' tops and kerbs, the ground). Occluders sit inside what they stand for.
const BLOCKERS = new Set(["lamp", "lantern", "postlamp", "pole", "sign", "mirror", "bollard", "cone"]);
const turned = (piece) => { const a = num(piece.turn, 0) * Math.PI / 180; return [[Math.cos(a), Math.sin(a), 0], [-Math.sin(a), Math.cos(a), 0], [0, 0, 1]]; };
const boxAt = (piece, lo, hi) => ({ c: place([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], piece), ax: turned(piece), h: [(hi[0] - lo[0]) / 2, (hi[1] - lo[1]) / 2, (hi[2] - lo[2]) / 2] });
function localBounds(G) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const g of Object.values(G)) for (let i = 0; i < g.pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], g.pos[i + k]); hi[k] = Math.max(hi[k], g.pos[i + k]); }
  return lo[0] === Infinity ? null : { lo, hi };
}
export function blockers(S, pieces) {
  const T = terrain(S), out = {}, byId = Object.fromEntries((pieces || []).map(p => [p.id, p]));
  const surf = (p, slots) => { const tris = { pos: [], idx: [] }; for (const s of slots) { const g = p && p.G[s]; if (!g) continue; const v0 = tris.pos.length / 3; tris.pos.push(...g.pos); for (const i of g.idx) tris.idx.push(i + v0); } return tris; };
  for (const r of S.roads || []) {
    const sf = surf(byId[r.id], ["asphalt", "gravel", "pavement", "kerb"]), rp = byId[r.id] && byId[r.id].ramps;
    if (rp) { const v0 = sf.pos.length / 3; sf.pos.push(...rp.pos); for (const i of rp.idx) sf.idx.push(i + v0); }   // the kerbs' ramps: walked up, never drawn
    out[r.id] = { boxes: [], occ: [], surface: sf };
  }
  if (byId._ground) out._ground = { boxes: [], occ: [], surface: surf(byId._ground, ["ground"]) };
  for (const b of S.buildings || []) {
    const foot = footing(b, T), piece = Object.assign({}, b, { z: foot.z }), { tiers } = floorsOf(b), boxes = [], occ = [];
    if (b.inside && (b.inside.rooms || []).length) {                     // hollow: its walls (the doors' holes open), not a block
      for (const [lo, hi] of buildingParts(b, foot).col || []) boxes.push(boxAt(piece, lo, hi));
    } else tiers.forEach((t, i) => {
      boxes.push(boxAt(piece, [t.x0, t.y0, i === 0 ? foot.low - foot.z - 0.1 : t.z0], [t.x1, t.y1, t.z1]));
      if (t.x1 - t.x0 > 1.2 && t.y1 - t.y0 > 1.2 && t.z1 - t.z0 > 1.2) occ.push(boxAt(piece, [t.x0 + 0.25, t.y0 + 0.25, t.z0 + 0.4], [t.x1 - 0.25, t.y1 - 0.25, t.z1 - 0.3]));
    });
    const fl = b.inside && (b.inside.rooms || []).length ? insideFloors(b) : floorsOf(b).rows;
    for (const p of b.parts || []) if (p.kind === "balcony") {              // a balcony's slab (a motel's walkway): to walk on
      const F = faceFrames(-num(b.w, 8) / 2, -num(b.d, 10) / 2, num(b.w, 8) / 2, num(b.d, 10) / 2, 0)[p.face || "front"], K = PART_KINDS.balcony;
      const w = num(p.w, K.w), out2 = num(p.out, K.out), c = F.W / 2 + num(p.x, 0);
      const zs = Array.isArray(p.floors) ? fl.filter(r => r.k >= p.floors[0] && r.k <= (p.floors[1] || p.floors[0])).map(r => r.z0 + num(p.z, 0)) : [num(p.z, K.z)];
      for (const z of zs) { const a = fp(F, c - w / 2, z, 0), bb = fp(F, c + w / 2, z, out2); boxes.push(boxAt(piece, [Math.min(a[0], bb[0]), Math.min(a[1], bb[1]), z - 0.16], [Math.max(a[0], bb[0]), Math.max(a[1], bb[1]), z])); }
    }
    for (const p of b.parts || []) if (p.kind === "stairs") {                // a stair up the wall: a ramp to its top, its landing
      const K = PART_KINDS.stairs, F = faceFrames(-num(b.w, 8) / 2, -num(b.d, 10) / 2, num(b.w, 8) / 2, num(b.d, 10) / 2, 0)[p.face || "front"];
      const w = num(p.w, K.w), h = num(p.h, K.h), out2 = num(p.out, K.out), c = F.W / 2 + num(p.x, 0), z = num(p.z, 0), dir = num(p.dir, 1) < 0 ? -1 : 1;
      const a = fp(F, c - dir * w / 2, z, out2 / 2), bb = fp(F, c + dir * w / 2, z + h, out2 / 2), mid = place([(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2, (z + z + h) / 2 - 0.12], piece);
      const along = [bb[0] - a[0], bb[1] - a[1], h], L = Math.hypot(...along), A = place([along[0] / L, along[1] / L, 0], { turn: b.turn }), Aw = [A[0], A[1], h / L];
      const Nw = place([F.N[0], F.N[1], 0], { turn: b.turn }), up = cross(Aw, Nw);
      boxes.push({ c: mid, ax: [Aw, [Nw[0], Nw[1], 0], up], h: [L / 2, out2 / 2, 0.12] });
      if (p.landing !== false) { const e = dir > 0 ? c + w / 2 : c - w / 2 - 1.2; const l0 = fp(F, e, z + h - 0.22, 0), l1 = fp(F, e + 1.2, z + h, out2); boxes.push(boxAt(piece, [Math.min(l0[0], l1[0]), Math.min(l0[1], l1[1]), z + h - 0.22], [Math.max(l0[0], l1[0]), Math.max(l0[1], l1[1]), z + h])); }
    }
    out[b.id] = { boxes, occ, surface: null };
  }
  for (const t of S.things || []) {
    if (t.kind === "person" || t.kind === "manhole" || t.kind === "drain") continue;
    const piece = Object.assign({}, t, { z: T.surface(...(t.at || [0, 0])) + num(t.lift, 0) }), K = THING_KINDS[t.kind] || {}, h = num(t.h, K.h || 1);
    if (BLOCKERS.has(t.kind)) { out[t.id] = { boxes: [boxAt(piece, [-0.12, -0.12, 0], [0.12, 0.12, h])], occ: [], surface: null }; continue; }
    const lb = localBounds(thingParts(t).G); if (lb) out[t.id] = { boxes: [boxAt(piece, lb.lo, lb.hi)], occ: [], surface: null };
  }
  for (const f of S.fences || []) {
    const K = FENCE_KINDS[f.kind] || FENCE_KINDS.mesh, [ax, ay] = f.from, [bx, by] = f.to, L = Math.hypot(bx - ax, by - ay); if (L < 0.05) continue;
    if ((f.kind === "gate" || f.kind === "accordion") && num(f.open, f.kind === "accordion" ? 0.5 : 0) >= 0.5) continue;   // an open gate: the way through
    const step = num(f.step, K.step), n = Math.max(1, step > 0 ? Math.round(L / step) : 1), h = num(f.h, K.h), boxes = [];
    for (let i = 0; i < n; i++) {
      const s0 = L * i / n, s1 = L * (i + 1) / n, p0 = [ax + (bx - ax) * s0 / L, ay + (by - ay) * s0 / L], p1 = [ax + (bx - ax) * s1 / L, ay + (by - ay) * s1 / L];
      const z0 = Math.min(T.surface(...p0), T.surface(...p1)), zt = Math.max(T.surface(...p0), T.surface(...p1)) + h;
      boxes.push({ c: [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (z0 - 0.2 + zt) / 2], ax: [[(bx - ax) / L, (by - ay) / L, 0], [-(by - ay) / L, (bx - ax) / L, 0], [0, 0, 1]], h: [(s1 - s0) / 2, 0.08, (zt - z0 + 0.2) / 2] });
    }
    out[f.id] = { boxes, occ: [], surface: null };
  }
  return out;
}
// a box's twelve triangles (for the collision and occluder meshes)
export function boxTris(b, into) {
  const P = (i, j, k) => [0, 1, 2].map(d => b.c[d] + b.ax[0][d] * i * b.h[0] + b.ax[1][d] * j * b.h[1] + b.ax[2][d] * k * b.h[2]);
  const v0 = into.pos.length / 3, C = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  for (const c of C) into.pos.push(...P(...c));
  for (const [a, b2, c, d] of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [3, 0, 4, 7]]) into.idx.push(v0 + a, v0 + b2, v0 + c, v0 + a, v0 + c, v0 + d);
  return into;
}

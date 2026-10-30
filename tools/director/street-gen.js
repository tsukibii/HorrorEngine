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
  asphalt: ["#2d3034", 0.95], pavement: ["#7a766f", 0.9, 0, "t"], kerb: ["#9b978f", 0.85], paint: ["#e9e7e0", 0.7], paint_y: ["#e2a33a", 0.7],
  ground: ["#38393b", 1], gravel: ["#6d6a64", 1],
  pole: ["#b3b0a9", 0.85], steel: ["#5f656b", 0.45, 0.7], lamp: ["#fff0cf", 0.4, 0, "e"], lamp_cool: ["#eef4ff", 0.4, 0, "e"], wire: ["#18181a", 0.8],
  hazard: ["#e0b42c", 0.6, 0, "t"], chainlink: ["#8c949b", 0.5, 0.6, "a"], boards: ["#7b5b3f", 0.8, 0, "a"], panel: ["#c6cacd", 0.5, 0.4, "t"],
  blocks: ["#a6a39c", 0.9, 0, "t"], bamboo: ["#a99a60", 0.7, 0, "a"], post: ["#6a6e73", 0.5, 0.6], grate: ["#3a3c3f", 0.6, 0.6, "a"],
  red: ["#c3312a", 0.5], white: ["#efeeea", 0.6], black: ["#1e1e20", 0.6], yellow: ["#e3b331", 0.5], blue: ["#2c5ea8", 0.5], green: ["#3e6b46", 0.6],
  orange: ["#e0782c", 0.5], chrome: ["#c9cdd1", 0.15, 0.9], iron: ["#2f3033", 0.7, 0.5], rubber: ["#151515", 0.9],
  skin: ["#c99b7b", 0.7], cloth: ["#474c57", 0.9], cloth2: ["#2a2b30", 0.9], hair: ["#1b1714", 0.8],
  vend: ["#f0f0ec", 0.5], vend_lit: ["#f3f6ff", 0.4, 0, "e"], car: ["#d8dbde", 0.35, 0.3], car_glass: ["#1d232a", 0.1, 0.3],
  headlight: ["#fff6e2", 0.3, 0, "e"], taillight: ["#ff3b2b", 0.3, 0, "e"], noren: ["#2a3550", 0.9], plant_pot: ["#8a5a3c", 0.8],
};
// a sign's or a road glyph's slot names its picture: "sign:<key>" (the street's signs list), "glyph:<character>",
// "tsign:<kind>" (a traffic sign's face). Their base: what they fall back to with no picture.
export const slotBase = s => SLOTS[s] ? s : s.startsWith("glyph:") ? "paint" : s.startsWith("sign:") || s.startsWith("tsign:") ? "white" : "wall";

// mulberry32, as the kit's: the same seed, the same street on every machine
export function rng(seed) {
  let a = (Math.floor(+seed || 0) >>> 0) ^ 0x9e3779b9;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
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
  const frameRing = (n, slot = "frame", w = fw) => {
    fquad(o, slot, F, u0, u0 + w, z0, z1, n); fquad(o, slot, F, u1 - w, u1, z0, z1, n);
    fquad(o, slot, F, u0 + w, u1 - w, z0, z0 + w, n); fquad(o, slot, F, u0 + w, u1 - w, z1 - w, z1, n);
    for (const m of h.mull || []) fquad(o, slot, F, m - w / 2, m + w / 2, z0 + w, z1 - w, n);
  };
  switch (h.kind) {
    case "win": case "shop":
      fquad(o, h.lit || "glass", F, u0, u1, z0, z1, back);
      frameRing(back + 0.01, "frame", h.kind === "shop" ? 0.07 : fw);
      if (h.kind === "shop" && h.lit === "shop") {                 // the light it throws out over the pavement, one a 5 m
        const n = Math.max(1, Math.round((u1 - u0) / 5));
        for (let i = 0; i < n; i++) o.lights.push({ at: fp(F, u0 + (u1 - u0) * (i + 0.5) / n, z0 + (z1 - z0) * 0.55, 0.7), color: h.glow || "#ffb47f", power: 3.5, dist: 5, shop: true });
      }
      if (h.kind === "shop") {                                     // a door in the glass, and a kick plate under it
        const c = u0 + (u1 - u0) * clamp(num(h.door, 0.5), 0.1, 0.9), dw = 0.9;
        fquad(o, "frame", F, Math.max(u0, c - dw / 2) , Math.min(u1, c + dw / 2), z0, z0 + 0.12, back + 0.02);
        fquad(o, "frame", F, Math.max(u0, c - dw / 2 - 0.04), Math.max(u0, c - dw / 2), z0, Math.min(z1, z0 + 2.2), back + 0.02);
        fquad(o, "frame", F, Math.min(u1, c + dw / 2), Math.min(u1, c + dw / 2 + 0.04), z0, Math.min(z1, z0 + 2.2), back + 0.02);
      }
      break;
    case "shutwin":                                                 // a window with its storm shutter down
      fquad(o, "shutter", F, u0, u1, z0, z1, back + 0.02); frameRing(back + 0.03, "shutter_box", 0.04);
      fbox(o, "shutter_box", F, u0 - 0.05, u1 + 0.05, z1, z1 + 0.22, -0.02, 0.18);
      break;
    case "shutter":
      fquad(o, "shutter", F, u0, u1, z0, z1, back);
      fbox(o, "shutter_box", F, u0 - 0.04, u1 + 0.04, z1, z1 + 0.32, 0, 0.24);
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
};
const fillOf = (p, R) => p.lit === false ? "glass" : p.lit === true ? "lit" : (R() < 0.5 ? "lit" : "glass");
function partHoles(b, F, parts, rows, R) {
  const H = [];
  for (const p of parts) {
    const K = PART_KINDS[p.kind]; if (!K || !K.hole) continue;
    for (const zb of partZs(p, rows)) {
      const w = num(p.w, K.w), hh = num(p.h, K.h), c = F.W / 2 + num(p.x, 0);
      H.push({ u0: c - w / 2, u1: c + w / 2, z0: zb + num(p.z, K.z), z1: zb + num(p.z, K.z) + hh, kind: K.hole, dp: num(p.dp, K.dp),
               lit: K.hole === "shop" ? (p.lit === false ? "glass" : "shop") : K.hole === "koshi" ? (p.lit === false ? "dark" : "paper") : fillOf(p, R),
               mull: K.hole === "shop" ? mulls(c - w / 2, c + w / 2, num(p.mull, 1.9)) : K.hole === "win" && w > 1.05 ? [c] : [], door: num(p.door, 0.5), glow: p.glow, part: p });
    }
  }
  return H;
}
// a part repeated up the floors: `floors: [from, to]` puts one on each (its z from that floor's base)
function partZs(p, rows) {
  if (!Array.isArray(p.floors)) return [0];
  const [a, bb] = p.floors.map(v => Math.round(num(v, 1)));
  return rows.filter(r => r.k >= a && r.k <= (bb || a)).map(r => r.z0);
}
function partGen(o, b, F0, p, rows, R, signs) {
  const K = PART_KINDS[p.kind]; if (!K || K.hole) return;
  const F = p.in ? Object.assign({}, F0, { o: [F0.o[0] - F0.N[0] * num(p.in, 0), F0.o[1] - F0.N[1] * num(p.in, 0), F0.o[2]] }) : F0;   // set back into a recess
  for (const zb of partZs(p, rows)) {
    const W0 = num(p.w, K.w), w = p.kind === "eave" && !W0 ? F.W + 0.4 : W0, h = num(p.h, K.h), out = num(p.out, K.out), z = zb + num(p.z, K.z);
    const c = F.W / 2 + num(p.x, 0), u0 = c - w / 2, u1 = c + w / 2, slot = p.slot;
    switch (p.kind) {
      case "bay": {
        const sl = slot || "wall";
        fbox(o, sl, F, u0, u1, z, z + h, 0.0, out, nKey(F, -1) + (p.win ? nKey(F, 1) : ""));
        if (p.win) {                                                 // windows on its front, one a floor (or `cols`)
          const front = { name: F.name, o: fp(F, u0, 0, out + 0.002), U: F.U, N: F.N, W: w };
          const s = Object.assign({}, FACE_DEFAULT, { win: typeof p.win === "string" ? p.win : "punched", cols: num(p.cols, 1), ww: num(p.ww, Math.min(1.4, w - 0.5)), wh: num(p.wh, 1.3), sill: num(p.sill, 0.8), lit: num(p.litp, 0.5) });
          const H = []; for (const r of rows) if (r.z0 >= z - 0.01 && r.z0 + r.h <= z + h + 0.01) H.push(...floorHoles(Object.assign({}, s, { ground: "same" }), w, r, R));
          if (!H.length) H.push(...floorHoles(Object.assign({}, s, { ground: "same" }), w, { k: 2, z0: z, h }, R));
          // the front again, with the windows cut in (the box's own front is covered by this one)
          for (const [a, bb, p0, q0] of wallRects(w, z, z + h, H)) fquad(o, sl, front, a, bb, p0, q0, 0.001);
          for (const hh of H) holeGen(o, front, hh, R);
        }
        if (p.rail) railGen(o, F, u0, u1, z + h, z + h + 1.0, out - 0.05);
        break;
      }
      case "balcony": {
        const t = 0.16, kind = p.rail || "solid", sl = slot || "trim";
        fbox(o, sl, F, u0, u1, z - t, z, 0, out);
        if (kind === "solid") {
          fbox(o, p.slot2 || sl, F, u0, u1, z, z + h, out - 0.1, out);
          fbox(o, p.slot2 || sl, F, u0, u0 + 0.1, z, z + h, 0, out - 0.1); fbox(o, p.slot2 || sl, F, u1 - 0.1, u1, z, z + h, 0, out - 0.1);
        } else {
          railGen(o, F, u0, u1, z, z + h, out - 0.04, kind === "bars" ? "bars" : null);
          const sideF = (u) => ({ name: F.name, o: fp(F, u, 0, 0), U: F.N, N: [-F.U[0], -F.U[1], 0], W: out });
          railGen(o, sideF(u0), 0.04, out - 0.04, z, z + h, 0, kind === "bars" ? "bars" : null, true);
          railGen(o, { ...sideF(u1), U: F.N, N: [F.U[0], F.U[1], 0] }, 0.04, out - 0.04, z, z + h, 0, kind === "bars" ? "bars" : null, true);
        }
        break;
      }
      case "sign": {
        const key = `${b.id || "b"}.${signs.length}`;
        fbox(o, p.back || "black", F, u0, u1, z, z + h, 0, out);
        signs.push({ key, text: p.text || "", fg: p.fg || "#ffffff", bg: p.bg || "#202024", lit: p.lit !== false, dir: p.dir || (h > w * 1.6 ? "v" : "h"), w, h });
        fquad(o, "sign:" + key, F, u0 + 0.01, u1 - 0.01, z + 0.01, z + h - 0.01, out + 0.002, [[0, 0], [1, 0], [1, 1], [0, 1]]);
        break;
      }
      case "vsign": {                                                // a blade: its two faces carry the words, top to bottom
        const key = `${b.id || "b"}.${signs.length}`, th = 0.18, n0 = 0.18, n1 = 0.18 + out;
        signs.push({ key, text: p.text || "", fg: p.fg || "#ffffff", bg: p.bg || "#202024", lit: p.lit !== false, dir: p.dir || "v", w: out, h });
        fbox(o, p.back || "black", F, c - th / 2, c + th / 2, z, z + h, n0, n1);
        const side = (s) => { const u = c + s * (th / 2 + 0.002); const P = [fp(F, u, z + 0.03, n0 + 0.03), fp(F, u, z + 0.03, n1 - 0.03), fp(F, u, z + h - 0.03, n1 - 0.03), fp(F, u, z + h - 0.03, n0 + 0.03)];
          const uv = s > 0 ? [[1, 0], [0, 0], [0, 1], [1, 1]] : [[0, 0], [1, 0], [1, 1], [0, 1]];   // reads right from either side
          poly(o, "sign:" + key, P, [F.U[0] * s, F.U[1] * s, 0], uv); };
        side(1); side(-1);
        fbox(o, "steel", F, c - 0.03, c + 0.03, z + h - 0.25, z + h - 0.15, 0, n0); fbox(o, "steel", F, c - 0.03, c + 0.03, z + 0.15, z + 0.25, 0, n0);
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
      case "canopy": fbox(o, slot || "concrete", F, u0, u1, z, z + h, 0, out); break;
      case "eave": {                                                 // a pent roof: tiles sloping out and down, a fascia board
        const t = 0.07, drop = h, sl = slot || "tiles";
        const P = (u, n, dz) => fp(F, u, z - drop * (n / out) + dz, n);
        const top = [P(u0, 0, t), P(u1, 0, t), P(u1, out, t), P(u0, out, t)], bot = [P(u0, 0, 0), P(u1, 0, 0), P(u1, out, 0), P(u0, out, 0)];
        const up = norm(cross(sub(top[1], top[0]), sub(top[3], top[0])));
        poly(o, sl, top, up[2] > 0 ? up : mul(up, -1)); poly(o, "wood_dark", bot, up[2] > 0 ? mul(up, -1) : up);
        poly(o, "wood_dark", [bot[3], bot[2], top[2], top[3]], [F.N[0], F.N[1], 0]);
        poly(o, "wood_dark", [bot[0], bot[3], top[3], top[0]], [-F.U[0], -F.U[1], 0]); poly(o, "wood_dark", [bot[1], bot[2], top[2], top[1]], [F.U[0], F.U[1], 0]);
        fbox(o, "wood_dark", F, u0, u1, z - drop - 0.12, z - drop + 0.02, out - 0.06, out + 0.02);
        break;
      }
      case "ac": {
        fbox(o, slot || "ac", F, u0, u1, z, z + h, 0.02, out);
        const r = Math.min(h, w) * 0.36, cu = u0 + w * 0.38, cz = z + h / 2;
        poly(o, "fan", [fp(F, cu - r, cz - r, out + 0.003), fp(F, cu + r, cz - r, out + 0.003), fp(F, cu + r, cz + r, out + 0.003), fp(F, cu - r, cz + r, out + 0.003)], [F.N[0], F.N[1], 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        if (z > 0.5) fbox(o, "steel", F, u0 + 0.05, u1 - 0.05, z - 0.04, z, 0, out);   // its bracket
        break;
      }
      case "pipe": cyl(o, slot || "pipe", fp(F, c, z, out), fp(F, c, z + h, out), Math.max(0.03, w / 2), 6); break;
      case "lamp": {
        fbox(o, slot || "black", F, c - w / 2, c + w / 2, z + h * 0.25, z + h, 0, out);
        fquad(o, "lamp", F, c - w / 2 + 0.03, c + w / 2 - 0.03, z + h * 0.3, z + h * 0.9, out + 0.002);
        o.lights.push({ at: fp(F, c, z + h * 0.6, out + 0.3), color: p.color || "#ffd9a0", power: num(p.power, 4), dist: num(p.dist, 7), z: z + h * 0.6 });
        break;
      }
      case "lantern": {                                              // bracket out of the wall, a box lantern under it
        fbox(o, "wood_dark", F, c - 0.03, c + 0.03, z + h + 0.12, z + h + 0.18, 0, out + 0.06);
        const a = fp(F, c, z, out), r = w / 2;
        box(o, "paper", a[0] - r, a[1] - r, z, a[0] + r, a[1] + r, z + h, "");
        box(o, "wood_dark", a[0] - r - 0.03, a[1] - r - 0.03, z + h, a[0] + r + 0.03, a[1] + r + 0.03, z + h + 0.07);
        box(o, "wood_dark", a[0] - r - 0.02, a[1] - r - 0.02, z - 0.05, a[0] + r + 0.02, a[1] + r + 0.02, z);
        bar(o, "wood_dark", [a[0], a[1], z + h + 0.07], [a[0], a[1], z + h + 0.15], 0.02);
        o.lights.push({ at: [a[0], a[1], z + h / 2], color: p.color || "#ffc27a", power: num(p.power, 5), dist: num(p.dist, 8), z: z + h / 2 });
        break;
      }
      case "stairs": {                                               // up the wall from u0 (ground) to u1 (z + h), `dir` -1 the other way
        const dir = num(p.dir, 1) < 0 ? -1 : 1, n = Math.max(2, Math.round(h / 0.19)), run = w / n, rise = h / n, t = 0.22, sl = slot || "concrete";
        for (let i = 0; i < n; i++) {
          const a = dir > 0 ? u0 + i * run : u1 - (i + 1) * run, bb = a + run, zt = z + (i + 1) * rise;
          fbox(o, sl, F, a, bb, zt - t - (i === 0 ? 0 : rise), zt, 0.0, out);
        }
        const ua = dir > 0 ? u0 : u1, ub = dir > 0 ? u1 : u0;          // the parapet on its open side: a sloping slab
        fslab(o, sl, F, [[ua, z - 0.25], [ub, z + h - 0.25], [ub, z + h + 1.0], [ua, z + 1.0]], out - 0.12, out);
        if (p.landing !== false) fbox(o, sl, F, dir > 0 ? u1 : u0 - 1.2, dir > 0 ? u1 + 1.2 : u0, z + h - t, z + h, 0, out);
        break;
      }
      case "block": fbox(o, slot || "metal", F, u0, u1, z, z + h, 0, out); break;
      case "panel": fbox(o, slot || "metal", F, u0, u1, z, z + h, 0, out); break;
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
function railGen(o, F, u0, u1, z0, z1, n, fill = null, side = false) {
  const steps = Math.max(1, Math.round((u1 - u0) / 1.5));
  for (let i = 0; i <= steps; i++) { const u = u0 + (u1 - u0) * i / steps; fbox(o, "rail", F, u - 0.025, u + 0.025, z0, z1, n - 0.025, n + 0.025); }
  fbox(o, "rail", F, u0, u1, z1 - 0.05, z1, n - 0.03, n + 0.03);
  fbox(o, "rail", F, u0, u1, z0 + (z1 - z0) * 0.45, z0 + (z1 - z0) * 0.45 + 0.03, n - 0.015, n + 0.015);
  if (fill) { const P = [fp(F, u0, z0, n), fp(F, u1, z0, n), fp(F, u1, z1 - 0.05, n), fp(F, u0, z1 - 0.05, n)]; two(o, fill, P, [F.N[0], F.N[1], 0]); }
  void side;
}

// ---- roofs -------------------------------------------------------------------------------------------------------------
function roofGen(o, b, T, R) {
  const r = Object.assign({ kind: "flat", parapet: 0.9, pitch: 24, over: 0.45, ridge: "x" }, b.roof || {});
  const { x0, y0, x1, y1 } = T, z = T.z1;
  const things = () => (r.things || []).forEach((t, i) => roofThing(o, t, T, R, `${b.id || "b"}.r${i}`));
  if (r.kind === "flat" || r.kind === "rail" || r.kind === "none") {
    box(o, "roof_flat", x0, y0, z - 0.001, x1, y1, z + 0.02, "-z");
    if (r.kind === "flat" && r.parapet > 0.05) {
      const t = num(r.wall, 0.16), p = num(r.parapet, 0.9), sl = r.slot || "wall";
      box(o, sl, x0, y0, z, x1, y0 + t, z + p, "-z"); box(o, sl, x0, y1 - t, z, x1, y1, z + p, "-z");
      box(o, sl, x0, y0 + t, z, x0 + t, y1 - t, z + p, "-z"); box(o, sl, x1 - t, y0 + t, z, x1, y1 - t, z + p, "-z");
      for (const [a, b2, c, d] of [[x0, y0, x1, y0 + t], [x0, y1 - t, x1, y1], [x0, y0 + t, x0 + t, y1 - t], [x1 - t, y0 + t, x1, y1 - t]])
        box(o, "trim", a - 0.03, b2 - 0.03, z + p, c + 0.03, d + 0.03, z + p + 0.06, "-z");
    }
    if (r.kind === "rail") for (const F of Object.values(faceFrames(x0, y0, x1, y1, 0))) railGen(o, F, 0.05, F.W - 0.05, z, z + 1.1, -0.06);
    things();
    return;
  }
  // a pitched roof: its slabs (with the overhang), the gable walls under them, a ridge
  const ov = num(r.over, 0.45), tn = Math.tan(clamp(num(r.pitch, 24), 3, 60) * Math.PI / 180), t = 0.14, sl = r.slot || "tiles";
  const alongX = r.ridge !== "y";
  // in the roof's frame: s along the ridge, q across it (half span Q), lift = q's distance from the eave
  const S0 = (alongX ? x0 : y0) - ov, S1 = (alongX ? x1 : y1) + ov, Qc = alongX ? (y0 + y1) / 2 : (x0 + x1) / 2, Q = (alongX ? y1 - y0 : x1 - x0) / 2;
  const P = (s, q, zz) => alongX ? [s, Qc + q, zz] : [Qc + q, s, zz];
  const ze = z - ov * tn;                                            // the eave's height (out at the overhang)
  if (r.kind === "gable" || r.kind === "shed") {
    const sides = r.kind === "gable" ? [-1, 1] : [1];
    const qTop = r.kind === "gable" ? 0 : -Q - ov, rise = r.kind === "gable" ? (Q + ov) * tn : (2 * Q + 2 * ov) * tn;
    for (const sd of sides) {
      const qa = sd * (Q + ov), zt = ze + rise;
      const top = [P(S0, qa, ze + t), P(S1, qa, ze + t), P(S1, qTop, zt + t), P(S0, qTop, zt + t)];
      const bot = [P(S0, qa, ze), P(S1, qa, ze), P(S1, qTop, zt), P(S0, qTop, zt)];
      const up = norm(cross(sub(top[1], top[0]), sub(top[3], top[0]))), upn = up[2] > 0 ? up : mul(up, -1);
      poly(o, sl, top, upn); poly(o, "wood_dark", bot, mul(upn, -1));
      const outN = alongX ? [0, sd, 0] : [sd, 0, 0];
      poly(o, "wood_dark", [bot[0], bot[1], top[1], top[0]], outN);
      poly(o, "wood_dark", [bot[0], bot[3], top[3], top[0]], alongX ? [-1, 0, 0] : [0, -1, 0]); poly(o, "wood_dark", [bot[1], bot[2], top[2], top[1]], alongX ? [1, 0, 0] : [0, 1, 0]);
    }
    // the gable ends: the wall's triangle between the wall's top and the slope (a shed's: a wedge, high at -q)
    const wsl = b.roofWall || "wall";
    for (const s of [alongX ? x0 : y0, alongX ? x1 : y1]) {
      const outN = alongX ? [s === x0 ? -1 : 1, 0, 0] : [0, s === y0 ? -1 : 1, 0];
      if (r.kind === "gable") poly(o, wsl, [P(s, -Q, z), P(s, Q, z), P(s, 0, z + Q * tn)], outN);
      else poly(o, wsl, [P(s, -Q, z), P(s, Q, z), P(s, -Q, z + 2 * Q * tn)], outN);
    }
    if (r.kind === "shed") { const hiN = alongX ? [0, -1, 0] : [-1, 0, 0]; poly(o, wsl, [P(S0 + ov, -Q, z), P(S1 - ov, -Q, z), P(S1 - ov, -Q, z + 2 * Q * tn), P(S0 + ov, -Q, z + 2 * Q * tn)], hiN); }
    if (r.kind === "gable") bar(o, sl, P(S0, 0, ze + (Q + ov) * tn + t + 0.03), P(S1, 0, ze + (Q + ov) * tn + t + 0.03), 0.16, 0.16);
  } else if (r.kind === "hip") {                                     // four slopes to a short ridge, closed underneath
    const L = (S1 - S0) / 2, run = Q + ov, rl = Math.max(0, L - run), Sc = (S0 + S1) / 2, zt = ze + run * tn;
    const E = [P(S0, -run, ze), P(S1, -run, ze), P(S1, run, ze), P(S0, run, ze)], Ra = P(Sc - rl, 0, zt), Rb = P(Sc + rl, 0, zt);
    poly(o, sl, [E[0], E[1], Rb, Ra], null); poly(o, sl, [E[2], E[3], Ra, Rb], null);
    poly(o, sl, [E[1], E[2], Rb], null); poly(o, sl, [E[3], E[0], Ra], null);
    poly(o, "wood_dark", E.slice(), [0, 0, -1]);
    // make sure the slopes face up and out
    fixUp(o, sl);
  }
  things();
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
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(o, "steel", cx + sx * (w / 2 - 0.1) - 0.04, cy + sy * (d / 2 - 0.1) - 0.04, z, cx + sx * (w / 2 - 0.1) + 0.04, cy + sy * (d / 2 - 0.1) + 0.04, z + leg);
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
      for (const sx of [-1, 1]) { box(o, "steel", cx + sx * (w / 2 - 0.3) - 0.05, cy - 0.05, z, cx + sx * (w / 2 - 0.3) + 0.05, cy + 0.05, z + lift + h); bar(o, "steel", [cx + sx * (w / 2 - 0.3), cy + 0.7, z], [cx + sx * (w / 2 - 0.3), cy, z + lift + h * 0.6], 0.05); }
      box(o, "black", cx - w / 2, cy - 0.1, z + lift, cx + w / 2, cy + 0.02, z + lift + h);
      o.signs.push({ key, text: t.text || "", fg: t.fg || "#ffffff", bg: t.bg || "#2a2a2e", lit: t.lit !== false, dir: "h", w, h });
      poly(o, "sign:" + key, [[cx - w / 2 + 0.05, cy - 0.102, z + lift + 0.05], [cx + w / 2 - 0.05, cy - 0.102, z + lift + 0.05], [cx + w / 2 - 0.05, cy - 0.102, z + lift + h - 0.05], [cx - w / 2 + 0.05, cy - 0.102, z + lift + h - 0.05]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      break;
    }
    default: break;
  }
  void R;
}

// ---- a building --------------------------------------------------------------------------------------------------------
export function buildingParts(b) {
  const o = out(), R = rng(num(b.seed, 1)), { rows, tiers } = floorsOf(b);
  const parts = Array.isArray(b.parts) ? b.parts : [];
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
      if (s.bands) for (const r of T.rows.slice(1)) fbox(o, "trim", F, -0.04, F.W + 0.04, r.z0 - 0.12, r.z0 + 0.06, 0, 0.07, "");
      if (s.win === "fins" || (s.floors && Object.values(s.floors).includes("fins"))) {
        const pitch = num(s.pitch, 0.9), n = Math.max(2, Math.round(F.W / pitch));
        for (const r of T.rows) {
          const st = ((s.floors || {})[r.k] && ((s.floors || {})[r.k].win || (s.floors || {})[r.k])) || (r.k === 1 && s.ground !== "same" ? "g" : s.win);
          if (st !== "fins") continue;
          for (let i = 0; i <= n; i++) { const u = clamp(F.W * i / n, 0.04, F.W - 0.04); fbox(o, s.finSlot || "trim", F, u - 0.04, u + 0.04, r.z0, r.z0 + r.h, 0, num(s.fin, 0.3), ""); }
        }
      }
      for (const p of fparts) partGen(o, b, F, p, T.rows, R, signs);
    }
    if (ti < tiers.length - 1) {                                      // a setback: the terrace left on this tier's top
      const t = tiers[ti + 1];
      box(o, "roof_flat", T.x0, T.y0, T.z1 - 0.001, T.x1, T.y1, T.z1 + 0.02, "-z");
      const kind = (t.t && t.t.edge) || "rail";
      for (const F of Object.values(faceFrames(T.x0, T.y0, T.x1, T.y1, 0))) {
        if (kind === "rail") railGen(o, F, 0.05, F.W - 0.05, T.z1, T.z1 + 1.1, -0.06);
        else fbox(o, "wall", F, 0, F.W, T.z1, T.z1 + 0.9, -0.15, 0, "");
      }
    } else roofGen(o, b, T, R);
  });
  box(o, "dark", tiers[0].x0 + 0.01, tiers[0].y0 + 0.01, -0.001, tiers[0].x1 - 0.01, tiers[0].y1 - 0.01, 0.002, "-x+x-y+y-z");
  return o;
}

// ---- roads -------------------------------------------------------------------------------------------------------------
export const ROAD_DEFAULT = { width: 6, walks: [2, 2], kerb: 0.15, edge: [0, 0], centre: "dashed" };
export const MARK_KINDS = { stop: "stop line", text: "words (止まれ)", zebra: "zebra crossing", diamond: "crossing ahead (◇)", arrow: "arrow", line: "a line across" };
export function roadFrame(r) {
  const [ax, ay] = r.from, [bx, by] = r.to, L = Math.hypot(bx - ax, by - ay) || 1e-6;
  const t = [(bx - ax) / L, (by - ay) / L], n = [-t[1], t[0]];      // n: the road's left (walking from `from` to `to`)
  return { a: [ax, ay], t, n, L, W: num(r.width, 6), walks: Array.isArray(r.walks) ? r.walks.map(v => num(v, 0)) : [num(r.walks, 2), num(r.walks, 2)], kerb: num(r.kerb, 0.15) };
}
const at2 = (f, s, q) => [f.a[0] + f.t[0] * s + f.n[0] * q, f.a[1] + f.t[1] * s + f.n[1] * q];
// where another road's carriageway crosses a strip of this one (q0..q1 across it): intervals along it
function cutsOf(f, q0, q1, others) {
  const cuts = [];
  for (const g of others) {
    const corners = [[0, -g.W / 2], [g.L, -g.W / 2], [g.L, g.W / 2], [0, g.W / 2]].map(([s, q]) => at2(g, s, q))
      .map(([x, y]) => { const dx = x - f.a[0], dy = y - f.a[1]; return [dx * f.t[0] + dy * f.t[1], dx * f.n[0] + dy * f.n[1]]; });
    let P = corners;
    for (const [sgn, lim] of [[1, q0], [-1, q1]]) {                   // keep q >= q0, then q <= q1
      const Q = [];
      for (let i = 0; i < P.length; i++) {
        const A = P[i], Bp = P[(i + 1) % P.length], ia = sgn * (A[1] - lim) >= 0, ib = sgn * (Bp[1] - lim) >= 0;
        if (ia) Q.push(A);
        if (ia !== ib) { const k = (lim - A[1]) / (Bp[1] - A[1]); Q.push([A[0] + (Bp[0] - A[0]) * k, lim]); }
      }
      P = Q; if (!P.length) break;
    }
    if (P.length >= 3) { const ss = P.map(p => p[0]); cuts.push([Math.min(...ss), Math.max(...ss)]); }
  }
  return cuts.sort((p, q) => p[0] - q[0]);
}
function spans(L, cuts) {
  const out = []; let s = 0;
  for (const [a, b] of cuts) { if (a > s + 0.01) out.push([s, Math.min(a, L)]); s = Math.max(s, b); }
  if (s < L - 0.01) out.push([s, L]);
  return out.filter(([a, b]) => b - a > 0.01);
}
export function roadParts(r, others = [], index = 0) {
  const o = out(), f = roadFrame(r), W = f.W, L = f.L, zA = 0.004 + 0.0004 * (index % 8);
  const P3 = (s, q, z) => { const [x, y] = at2(f, s, q); return [x, y, z]; };
  const strip = (slot, s0, s1, q0, q1, z) => poly(o, slot, [P3(s0, q0, z), P3(s1, q0, z), P3(s1, q1, z), P3(s0, q1, z)], [0, 0, 1]);
  strip(r.surface || "asphalt", 0, L, -W / 2, W / 2, zA);
  const og = others.map(roadFrame);
  // the walks: raised slabs either side, a kerb's face toward the road, cut where another road crosses
  [[1, f.walks[0]], [-1, f.walks[1]]].forEach(([side, ww]) => {
    if (ww <= 0.01) return;
    const qa = side * W / 2, qb = side * (W / 2 + ww), k = f.kerb, lo = Math.min(qa, qb), hi = Math.max(qa, qb);
    for (const [s0, s1] of spans(L, cutsOf(f, lo, hi, og))) {
      strip(r.walk || "pavement", s0, s1, lo, hi, k);
      poly(o, "kerb", [P3(s0, qa, 0), P3(s1, qa, 0), P3(s1, qa, k), P3(s0, qa, k)], [f.n[0] * -side, f.n[1] * -side, 0]);
      poly(o, "kerb", [P3(s0, qb, 0), P3(s1, qb, 0), P3(s1, qb, k), P3(s0, qb, k)], [f.n[0] * side, f.n[1] * side, 0]);
      for (const s of [s0, s1]) poly(o, "kerb", [P3(s, lo, 0), P3(s, hi, 0), P3(s, hi, k), P3(s, lo, k)], s === s0 ? [-f.t[0], -f.t[1], 0] : [f.t[0], f.t[1], 0]);
      if (r.kerbStone !== false) strip("kerb", s0, s1, side > 0 ? qa : qa - 0.15 * 1, side > 0 ? qa + 0.15 : qa, k + 0.001);
    }
  });
  // the lines along it: the edge lines (their distance in from each edge) and the centre line, stopping at crossings
  const zl = zA + 0.003, lw = 0.15;
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
  // the marks: at metres from `from`, x across from the middle (+ to the right walking to `to`)
  for (const m of r.marks || []) {
    const s = num(m.at, 0), x = -num(m.x, 0), mw = num(m.w, W - 0.5), z = zl + 0.001;
    switch (m.kind) {
      case "stop": strip("paint", s, s + num(m.len, 0.45), x - mw / 2, x + mw / 2, z); break;
      case "line": strip(m.slot || "paint", s, s + num(m.len, 0.15), x - mw / 2, x + mw / 2, z); break;
      case "zebra": { const len = num(m.len, 4); for (let q = -mw / 2; q + 0.45 <= mw / 2 + 1e-6; q += 0.9) strip("paint", s, s + len, x + q, x + q + 0.45, z); break; }
      case "diamond": {
        const len = num(m.len, 3), hw = Math.min(mw, 1.6) / 2, pts = [[s, x], [s + len / 2, x - hw], [s + len, x], [s + len / 2, x + hw]];
        for (let i = 0; i < 4; i++) { const [s0, q0] = pts[i], [s1, q1] = pts[(i + 1) % 4], d = Math.hypot(s1 - s0, q1 - q0), ns = -(q1 - q0) / d * 0.07, nq = (s1 - s0) / d * 0.07;
          poly(o, "paint", [P3(s0 - ns, q0 - nq, z), P3(s1 - ns, q1 - nq, z), P3(s1 + ns, q1 + nq, z), P3(s0 + ns, q0 + nq, z)], [0, 0, 1]); }
        break;
      }
      case "arrow": { const len = num(m.len, 3); strip("paint", s, s + len * 0.65, x - 0.08, x + 0.08, z); poly(o, "paint", [P3(s + len * 0.6, x - 0.35, z), P3(s + len, x, z), P3(s + len * 0.6, x + 0.35, z)], [0, 0, 1]); break; }
      case "text": {                                                // read by someone driving from `from` to `to`: the first character furthest
        const chars = [...String(m.text || "止まれ")].filter(ch => ch.trim()), len = num(m.len, 2.0), gap = num(m.gap, 0.5), cw = Math.min(num(m.w, 1.1), W - 0.3);
        chars.forEach((ch, i) => {
          const s0 = s + (chars.length - 1 - i) * (len + gap), s1 = s0 + len;
          poly(o, "glyph:" + ch, [P3(s0, x + cw / 2, z), P3(s0, x - cw / 2, z), P3(s1, x - cw / 2, z), P3(s1, x + cw / 2, z)], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        });
        break;
      }
      default: break;
    }
  }
  return o;
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
      poly(o, t.cool ? "lamp_cool" : "lamp", [[-0.12, -arm - 0.4, h - 0.121], [0.12, -arm - 0.4, h - 0.121], [0.12, -arm, h - 0.121], [-0.12, -arm, h - 0.121]], [0, 0, -1]);
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
      for (const sd of dirs) { bar(o, col, [0, 0, h - 0.1], [0, sd * arm, h + 0.15], 0.05); head(0, sd * arm, h - 0.05); }
      if (t.text !== "") {                                           // the plate on top: words, a little blue roof
        const key = `${t.id || "lantern"}.0`, pw = num(t.pw, 1.0), ph = 0.34, z0 = h + 0.55;
        o.signs.push({ key, text: t.text || "ほんちょう", fg: "#1d2a4d", bg: "#f2f2ee", lit: false, dir: "h", w: pw, h: ph });
        box(o, col, -pw / 2 - 0.02, -0.03, z0 - 0.02, pw / 2 + 0.02, 0.03, z0 + ph + 0.02);
        for (const sd of [-1, 1]) poly(o, "sign:" + key, [[-pw / 2, sd * 0.032, z0], [pw / 2, sd * 0.032, z0], [pw / 2, sd * 0.032, z0 + ph], [-pw / 2, sd * 0.032, z0 + ph]], [0, sd, 0], sd < 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[1, 0], [0, 0], [0, 1], [1, 1]]);
        for (const sd of [-1, 1]) poly(o, "blue", [[-pw / 2 - 0.05, sd * 0.032, z0 + ph + 0.02], [pw / 2 + 0.05, sd * 0.032, z0 + ph + 0.02], [0, sd * 0.032, z0 + ph + 0.3]], [0, sd, 0]);
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
      if (t.guard !== false) cyl(o, "hazard", [0, 0, 0], [0, 0, 1.8], 0.185, 10, 0.18);
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
      poly(o, "vend_lit", [[-w / 2 + 0.06, -d / 2 - 0.002, h * 0.5], [w / 2 - 0.06, -d / 2 - 0.002, h * 0.5], [w / 2 - 0.06, -d / 2 - 0.002, h - 0.12], [-w / 2 + 0.06, -d / 2 - 0.002, h - 0.12]], [0, -1, 0]);
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
    case "bollard": { const r = num(t.r, 0.065); cyl(o, t.slot || "steel", [0, 0, 0], [0, 0, h], r, 8); cyl(o, "white", [0, 0, h - 0.18], [0, 0, h - 0.1], r + 0.004, 8, r + 0.004, false); break; }
    case "bike": {                                                   // along x, the front wheel at +x
      const rw = 0.33, hub = [[-0.52, 0, rw], [0.52, 0, rw]], ring = c => Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2; return [c[0] + Math.cos(a) * rw, 0, c[2] + Math.sin(a) * rw]; });
      for (const c of hub) { tube(o, "rubber", ring(c), 0.02, 4, true); bar(o, "chrome", [c[0] - rw, 0, c[2]], [c[0] + rw, 0, c[2]], 0.006); bar(o, "chrome", [c[0], 0, c[2] - rw], [c[0], 0, c[2] + rw], 0.006); }
      const seat = [-0.18, 0, 0.92], head = [0.35, 0, 0.95], bb = [-0.05, 0, 0.32], col = t.slot || "black";
      for (const [a, b2] of [[hub[0], bb], [hub[0], seat], [seat, bb], [bb, head], [seat, head], [head, hub[1]]]) bar(o, col, a, b2, 0.03);
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
      for (const sx of [-1, 1]) { bar(o, "white", [sx * (w / 2 - 0.1), -0.25, 0], [sx * (w / 2 - 0.1), 0, h], 0.05); bar(o, "white", [sx * (w / 2 - 0.1), 0.25, 0], [sx * (w / 2 - 0.1), 0, h], 0.05); }
      box(o, "hazard", -w / 2, -0.03, h - 0.28, w / 2, 0.03, h);
      break;
    }
    case "manhole": cyl(o, "iron", [0, 0, 0], [0, 0, 0.012], num(t.r, 0.32), 14); break;
    case "drain": { const w = num(t.w, 0.9), d = num(t.d, 0.35); box(o, "dark", -w / 2, -d / 2, 0, w / 2, d / 2, 0.006); poly(o, "grate", [[-w / 2, -d / 2, 0.011], [w / 2, -d / 2, 0.011], [w / 2, d / 2, 0.011], [-w / 2, d / 2, 0.011]], [0, 0, 1]); break; }
    case "car": carGen(o, t, h); break;
    case "person": personGen(o, t, h, R); break;
    case "bench": { const w = num(t.w, 1.6); box(o, "wood", -w / 2, -0.22, 0.42, w / 2, 0.22, 0.47); box(o, "wood", -w / 2, 0.16, 0.5, w / 2, 0.21, 0.82); for (const sx of [-1, 1]) box(o, "steel", sx * (w / 2 - 0.15) - 0.03, -0.2, 0, sx * (w / 2 - 0.15) + 0.03, 0.2, 0.42); break; }
    case "bin": cyl(o, t.slot || "steel", [0, 0, 0], [0, 0, h], 0.25, 10); cyl(o, "black", [0, 0, h], [0, 0, h + 0.04], 0.26, 10); break;
    case "crates": { const n = Math.max(1, Math.round(num(t.n, 3))); for (let i = 0; i < n; i++) box(o, t.slot || (i % 2 ? "yellow" : "blue"), -0.23 + (R() - 0.5) * 0.04, -0.17, i * 0.3, 0.23, 0.17 + (R() - 0.5) * 0.03, i * 0.3 + 0.29); break; }
    case "pot": cyl(o, t.slot || "plant_pot", [0, 0, 0], [0, 0, h], 0.16, 8, 0.22); cyl(o, "dark", [0, 0, h - 0.04], [0, 0, h - 0.035], 0.2, 8); break;
    case "ac": box(o, "ac", -0.4, -0.15, 0, 0.4, 0.15, h); poly(o, "fan", [[-0.33, -0.151, 0.08], [0.1, -0.151, 0.08], [0.1, -0.151, 0.52], [-0.33, -0.151, 0.52]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]); break;
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
  for (const sd of [-1, 1]) poly(o, "car_glass", [[c0 + 0.15, sd * (W / 2 - 0.059), body + 0.38], [c1 - 0.1, sd * (W / 2 - 0.059), body + 0.38], [c1 - 0.1, sd * (W / 2 - 0.059), top - 0.08], [c0 + 0.15, sd * (W / 2 - 0.059), top - 0.08]], [0, sd, 0]);
  poly(o, "car_glass", [[c1 + 0.001, -W / 2 + 0.15, body + 0.36], [c1 + 0.001, W / 2 - 0.15, body + 0.36], [c1 + 0.001, W / 2 - 0.15, top - 0.08], [c1 + 0.001, -W / 2 + 0.15, top - 0.08]], [1, 0, 0]);
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
};
export function fenceParts(f) {
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
        for (const x of bays) cyl(o, post, [clamp(x, 0.05, L - 0.05), 0, bh + 0.06], [clamp(x, 0.05, L - 0.05), 0, h], 0.025, 6);
        quadX("chainlink", 0, L, bh + 0.08, h - 0.04);
        cyl(o, post, [0, 0, h - 0.02], [L, 0, h - 0.02], 0.02, 6);
      }
      break;
    }
    case "mesh": {
      for (const x of bays) cyl(o, post, [clamp(x, 0.03, L - 0.03), 0, 0], [clamp(x, 0.03, L - 0.03), 0, h], 0.028, 6);
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
      for (const x of bays) cyl(o, post, [clamp(x, 0.04, L - 0.04), 0, 0], [clamp(x, 0.04, L - 0.04), 0, h], 0.035, 8);
      for (const z of [h - 0.03, h * 0.55]) cyl(o, f.slot || "post", [0, 0, z], [L, 0, z], 0.03, 8);
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
  // into the street: x along the run, y its left
  for (const g of Object.values(o.G)) {
    for (let i = 0; i < g.pos.length; i += 3) { const x = g.pos[i], y = g.pos[i + 1]; g.pos[i] = ax + t[0] * x + n[0] * y; g.pos[i + 1] = ay + t[1] * x + n[1] * y; }
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
export function build(street) {
  const S = street || {}, pieces = [];
  const roads = S.roads || [], buildings = S.buildings || [], things = S.things || [], fences = S.fences || [];
  roads.forEach((r, i) => { try { pieces.push(Object.assign({ id: r.id, type: "road" }, roadParts(r, roads.filter(q => q !== r), i))); } catch (e) { pieces.push({ id: r.id, type: "road", G: {}, signs: [], lights: [], error: e.message }); } });
  for (const b of buildings) { try { pieces.push(Object.assign({ id: b.id, type: "building" }, placeAll(buildingParts(b), b))); } catch (e) { pieces.push({ id: b.id, type: "building", G: {}, signs: [], lights: [], error: e.message }); } }
  for (const t of things) { try { pieces.push(Object.assign({ id: t.id, type: "thing" }, placeAll(thingParts(t), t))); } catch (e) { pieces.push({ id: t.id, type: "thing", G: {}, signs: [], lights: [], error: e.message }); } }
  for (const f of fences) { try { pieces.push(Object.assign({ id: f.id, type: "fence" }, fenceParts(f))); } catch (e) { pieces.push({ id: f.id, type: "fence", G: {}, signs: [], lights: [], error: e.message }); } }
  const poles = things.filter(t => t.kind === "pole");
  if (poles.some(p => p.to)) pieces.push(Object.assign({ id: "_wires", type: "wires" }, wiresParts(poles)));
  // the ground under it all, a margin round what's there
  const bb = bounds2(S);
  if (bb && S.ground !== false) {
    const o = out(), m = num(S.margin, 12);
    poly(o, "ground", [[bb[0] - m, bb[1] - m, 0], [bb[2] + m, bb[1] - m, 0], [bb[2] + m, bb[3] + m, 0], [bb[0] - m, bb[3] + m, 0]], [0, 0, 1]);
    pieces.push(Object.assign({ id: "_ground", type: "ground" }, o));
  }
  return pieces;
}
// the street's extent on the plan [x0, y0, x1, y1]
export function bounds2(S) {
  const xs = [], ys = [];
  const pt = (x, y) => { xs.push(x); ys.push(y); };
  for (const r of S.roads || []) { const f = roadFrame(r), q = f.W / 2 + Math.max(...f.walks); for (const s of [0, f.L]) for (const qq of [-q, q]) pt(...at2(f, s, qq)); }
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

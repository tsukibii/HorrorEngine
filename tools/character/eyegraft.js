// the grafted eyes on the Studio's face (tools/eye_patch.py makes Content/Studio/Bodies/MHR_eyes.bin, served as
// bodies/MHR_eyes.bin): the lids as thick flesh resting on the eyeball, their edge rolling in to touch it, the crease,
// the lower lid's roll and the corners, grafted onto MHR's base face. Each of its points rides the MHR triangle under
// it (v = sum(b * P) + scale * (rest - sum(b * P0)), MHR's own blink left out); the eyeball follows the skin round the
// eye (loops 15 and out) and grows with it; the lid's edge and the lining are seated back on the eyeball as they rest
// on it; the blink turns each lid point about the eyeball's centre on the head's x axis by its share of the angle
// between the lids where it is, measured on the face as it is (the upper lid 85%): the lids slide over the eyeball and
// meet, never through it. The same maths as eye_patch.py's apply() (EYEPATCH checks it there).
import * as THREE from "three";

const KINDS = { f4: Float32Array, u4: Uint32Array, i4: Int32Array, i2: Int16Array };
const NAMES = ["pos", "tri", "bary", "ring", "blink", "membrane", "uv", "mhrv", "faces", "hide", "contact", "lash", "fade"];
const OUTER = 15, SEAT_TO = 4, SEAT_OFF = 10, FLAT_A = 3, FLAT_B = 13;   // (FLAT: the upper lid from its lash line to the base mesh's crease, laid flat for its skin and makeup)   // (OUTER: read from the file's loops below when it says)          // the loops the eyeball follows (and out), the lid's edge seated to the 4th loop, eased out by the 10th
const smooth = u => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
const D2R = Math.PI / 180;
// the eye's shape keys (DECISIONS 2026-10-31: "make it modifiable through some basic shape keys ... just more asian or
// caucasian etc and size"): each a smooth field in the eye's own frame (x out toward the temple, y up, z forward), in
// mm at the face's size, faded by loop so the skin round the eye holds; our own numbers. The same maths as
// eye_patch.py's apply(), which EYEPATCH checks at every key's ends and the presets (the lids still meet shut, nothing
// in the eyeball)
export const SHAPE_KEYS = [
  ["size", "Eye size", -1, 1, 0.01, "The eye bigger or smaller: the eyeball and the opening together (8% either way), the lids still resting on it."],
  ["crease", "Crease", -1, 1, 0.01, "−1 a monolid (the upper lid full, its fold filled, as in many East Asian eyes), +1 a deep double lid (the fold set in, as in many European eyes)."],
  ["fold", "Inner fold", 0, 1, 0.01, "The upper lid's skin carried down over the inner corner (an epicanthic fold)."],
  ["tilt", "Tilt", -1, 1, 0.01, "The outer corner up (+1, a lifted almond) or down (−1), about the eye's middle (8° either way)."],
  ["opening", "Opening", -2.5, 1, 0.01, "−1 narrower (the upper lid lower, the lower higher), −2.5 a heavy lid resting low over the iris (a doll's sleepy almond: eyes v3); +1 rounder."],
  ["depth", "Depth", -1, 1, 0.01, "−1 deep-set (the eye and its lids 1.2 mm back under the brow), +1 prominent."],
  ["cute", "Cute eye", 0, 1, 0.01, "The cute eye's opening (after your picture): diagonal, the inner corner low and pointed, the outer corner high, the upper lid a tall round arch and the lower lid running straight up to the outer corner. 1: the picture's own outline; the switch above sets it with a single lid."],
];
export const KEYS0 = { size: 0, crease: 0, fold: 0, tilt: 0, opening: 0, depth: 0, cute: 0 };
// the Cute eye switch's keys (DECISIONS 2026-11-17, cuter eyes: "a toggle button for this kind of eye called cute-eye";
// the user's picture is a single-lidded eye: "the mono eyelid eye shape"): the opening, a single lid, its skin a
// little over the inner corner (eye_patch.py CUTE: the same)
export const CUTE_KEYS = { crease: -0.85, fold: 0.45, cute: 1 };
export const EYE_PRESETS = {
  "Default": {}, "East Asian": { crease: -0.8, fold: 0.6, tilt: 0.25, opening: -0.3, depth: 0.35 }, "Caucasian": { crease: 0.6, opening: 0.15, depth: -0.4 }, "Cute eye": CUTE_KEYS,
};
// the cute eye (eye_patch.py CUTE_*: the same numbers, EYEPATCH compares them): the inner corner narrowed to a point
// (CUTE_PINCH: how much of each point's height over the corner is taken, within so many mm of it toward the eye, toward
// the nose and above or below); each lid's edge turned about the eye's own x axis by a profile along the opening
// (CUTE_UP, CUTE_LO: degrees up at 17 places from the inner corner to the outer, closer together toward the corners);
// the opening set on a diagonal: every point lifted by its distance from the eye's middle toward the temple times the
// tangent of CUTE_TILT degrees (the outer corner up, the inner down, nothing moved sideways: a turn of the whole
// region pushed the skin under the outer corner out into a ridge against the skin beside it: the user's "weird side
// sag"), about a point CUTE_PIVOT mm toward the temple from the eye's middle (the outer corner rises less and the
// inner drops more: there are 8 mm of skin over the outer corner and 18 under the inner one); the eyeball CUTE_RISE mm
// higher in its lids (with the pivot, the opening sits lower on the eye: the upper lid rests on the iris, as in the picture). How much of
// each the skin round the opening takes (CUTE_REACH, mm): the lids' turn and the pinch by how near it is to where the
// lids meet the eye (a bell that wide, and nothing within the second number of the graft's edge: a profile changes
// fast along the lid near a corner, and turning the whole column of skin under it by the lid's own angle ran a crease
// down the cheek from the outer corner: the "side sag" again); the lift by how far it is from the graft's edge (all
// of it from the third number in, none at the edge: the fall-off made for the other keys halves within 2 mm of a
// corner, where the lift is greatest; and by how near it is to the opening, a bell the fourth number wide: the cheek
// under the eye stays). The fifth: how near the lid's edge the skin takes the profile as it is; further off it takes a
// gentler one (`wide`). Last, after the other keys, the skin it has moved is smoothed (CUTE_RELAX passes, each point
// drawn half way toward the middle of its neighbours: the upper lid's skin from past its rim to short of the graft's
// edge, and both lids' beside the outer corner): a single lid has no folds, and the lift leaves fine ones. Fitted on
// a new character's eye so the opening's outline is the reference's
// (the user's picture and their tracing of it, smoothed: docs/research/cute_eye/)
export const CUTE_TILT = 19.88;
export const CUTE_PINCH = [0.6, 2.5, 1.5, 3.0], CUTE_RISE = -0.2, CUTE_PIVOT = 4, CUTE_RELAX = 12;
export const CUTE_REACH = [7.0, 2.5, 8.0, 10.0, 2.0];
export const CUTE_UP = [0, -4.56, -5.95, -2.81, 4.15, 13.2, 13.32, 11.34, 10.42, 9.92, 9.91, 9.46, 8.55, 6.71, 5.24, 3.2, 0];
export const CUTE_LO = [0, 0.26, -0.3, -1.8, -3.86, -4.97, -4.95, -4.79, -4.03, -3.08, -0.85, 0.71, 1.95, 2.24, 1.18, -0.54, 0];
// a profile's value at u (0..1 along the opening): a Catmull-Rom curve through its values, the j-th of n+1 at
// u = (1 − cos(π j / n)) / 2 (they stand closer together toward the corners, where the lids turn fastest)
// a profile as the skin away from the lid's edge takes it: drawn toward its neighbours eight times and eased out to
// nothing over the fifth of the opening by each corner (eye_patch.py `_wide`: the same sums)
export function wide(tab) {
  const t = tab.slice(), n = t.length - 1;
  for (let pass = 0; pass < 8; pass++) { const q = t.slice(); for (let j = 1; j < n; j++) t[j] = 0.25 * q[j - 1] + 0.5 * q[j] + 0.25 * q[j + 1]; }
  return t.map((v, j) => { const u = 0.5 * (1 - Math.cos(Math.PI * j / n)); return v * smooth(u / 0.2) * smooth((1 - u) / 0.2); });
}
export function prof(tab, u) {
  const n = tab.length - 1, x = Math.acos(1 - 2 * Math.min(1, Math.max(0, u))) / Math.PI * n, i = Math.min(Math.floor(x), n - 1), f = x - i;
  const p0 = tab[Math.max(i - 1, 0)], p1 = tab[i], p2 = tab[i + 1], p3 = tab[Math.min(i + 2, n)];
  return 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * p1 - p0 - 3 * p2 + p3) * f * f * f);
}

export async function load(url, BASEP, TRIS) {         // the graft, or null when it hasn't been made on this machine
  const r = await fetch(url).catch(() => null); if (!r || !r.ok) return null;
  const buf = await r.arrayBuffer(), hl = new DataView(buf).getUint32(0, true);
  const H = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), base = 4 + hl, G = { header: H, sides: {} };
  for (const side of ["L", "R"]) {
    const s = H.sides[side], o = { side, eye: s.eye };
    for (const k of NAMES) { const m = s[k]; if (m) o[k] = new KINDS[m.type](buf, base + m.at, m.count * m.width); }
    if (!o.fade) o.fade = Float32Array.from(o.ring, k => k >= 999 ? 0 : 1 - smooth((k - 8) / 8));   // (a graft made before the falloff)
    const n = o.n = o.ring.length, OFF = o.off = new Float32Array(n * 3), seat = o.seat = new Float32Array(n), height = o.height = new Float32Array(n);
    const c0 = s.eye.centre, r0 = s.eye.radius;
    for (let i = 0; i < n; i++) {
      const t = o.tri[i] * 3;
      for (let a = 0; a < 3; a++) { let q = 0; for (let k = 0; k < 3; k++) q += o.bary[i * 3 + k] * BASEP[TRIS[t + k] * 3 + a]; OFF[i * 3 + a] = o.pos[i * 3 + a] - q; }
      height[i] = Math.hypot(o.pos[i * 3] - c0[0], o.pos[i * 3 + 1] - c0[1], o.pos[i * 3 + 2] - c0[2]) - r0;   // over the eyeball at rest (the lining below it)
      seat[i] = o.ring[i] >= 999 ? 0 : 1 - smooth((o.ring[i] - SEAT_TO) / (SEAT_OFF - SEAT_TO));
    }
    const sx = o.sx = side === "L" ? 1 : -1, lx = i => (o.pos[i * 3] - c0[0]) * sx, ly = i => o.pos[i * 3 + 1] - c0[1];
    let xin = Infinity, xout = -Infinity, yin = 0, yout = 0;
    for (let i = 0; i < n; i++) if (o.ring[i] === 0) { const x = lx(i); if (x < xin) { xin = x; yin = ly(i); } if (x > xout) { xout = x; yout = ly(i); } }
    o.lid = new Int8Array(n); o.u = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = o.u[i] = (lx(i) - xin) / (xout - xin), line = yin + (yout - yin) * Math.min(1, Math.max(0, u));
      o.lid[i] = o.blink[i] > 0 ? 1 : o.blink[i] < 0 ? -1 : ly(i) > line ? 1 : -1;
    }
    { const out = H.loops?.out ?? 21, E_ = []; for (let i = 0; i < n; i++) if (o.ring[i] >= out) E_.push(i);   // each point's distance (m, at rest) from the graft's edge: its last loop and MHR's own points round the hole
      const near = L => { const D = new Float32Array(n); for (let i = 0; i < n; i++) { let b = Infinity; for (const e of L) { const q = (o.pos[i * 3] - o.pos[e * 3]) ** 2 + (o.pos[i * 3 + 1] - o.pos[e * 3 + 1]) ** 2 + (o.pos[i * 3 + 2] - o.pos[e * 3 + 2]) ** 2; if (q < b) b = q; } D[i] = Math.sqrt(b); } return D; };
      o.edge = near(E_); o.rim = near([...o.ring.keys()].filter(i => o.ring[i] === 0)); }   // (and from where the lids meet the eyeball)
    // where the cute eye smooths the skin it has moved (eye_patch.py relax_zone: the same), and each point's neighbours
    o.relax = Float32Array.from(o.ring, (k, i) => k >= 999 ? 0 : smooth((k - 4) / 3) * (1 - smooth((k - 17) / 3)) * Math.max(o.lid[i] > 0 ? 1 : 0, smooth((o.u[i] - 0.85) / 0.15)));
    { const sets = Array.from({ length: n }, () => new Set()), f = o.faces;
      for (let t = 0; t < f.length; t += 3) { const a = f[t], b = f[t + 1], c2 = f[t + 2]; sets[a].add(b).add(c2); sets[b].add(a).add(c2); sets[c2].add(a).add(b); }
      o.nb = sets.map(x => Int32Array.from(x)); }
    o.cin = 0; { let b = Infinity; for (let i = 0; i < n; i++) if (o.ring[i] === 0 && lx(i) < b) { b = lx(i); o.cin = i; } }   // the inner corner's point
    o.outer = Int32Array.from([...o.ring.keys()].filter(i => o.ring[i] >= OUTER));
    // the flat lid: each upper lid point from the lash line to the crease (loops FLAT_A to FLAT_B) with the points of
    // those two loops at its angle round the eye (seen from the front) and its share of the way between them
    const ang = i => Math.atan2(o.pos[i * 3 + 1] - c0[1], (o.pos[i * 3] - c0[0]) * sx), byRing = k => [...o.ring.keys()].filter(i => o.ring[i] === k && o.lid[i] > 0);
    const RA = byRing(FLAT_A), RB = byRing(FLAT_B), nearest = (L, a) => { let b = L[0], d = Infinity; for (const j of L) { const e = Math.abs(Math.atan2(Math.sin(ang(j) - a), Math.cos(ang(j) - a))); if (e < d) { d = e; b = j; } } return b; };
    o.flat = [];
    if (RA.length && RB.length) for (let i = 0; i < n; i++) { const k = o.ring[i]; if (o.lid[i] > 0 && k > FLAT_A && k < FLAT_B) { const a = ang(i); o.flat.push([i, nearest(RA, a), nearest(RB, a), (k - FLAT_A) / (FLAT_B - FLAT_A)]); } }
    o.contactAll = Int32Array.from([...o.ring.keys()].filter(i => o.ring[i] === 0));
    let mx = [0, 0, 0]; for (const i of o.outer) for (let a = 0; a < 3; a++) mx[a] += o.pos[i * 3 + a] / o.outer.length;
    let sp = 0; for (const i of o.outer) sp += Math.hypot(o.pos[i * 3] - mx[0], o.pos[i * 3 + 1] - mx[1], o.pos[i * 3 + 2] - mx[2]); o.spread0 = sp / o.outer.length;
    const rings = o.rings = {};                         // each loop's points (the rims: loops 0 to the lash line and on up the lid)
    for (let i = 0; i < n; i++) { const k = o.ring[i]; if (k >= 0 && k <= 14) (rings[k] ||= []).push(i); }
    G.sides[side] = o;
  }
  G.lashRing = H.lash_ring || 3; G.upperShare = H.upper_share || 0.85;
  G.hideT = new Uint8Array(TRIS.length / 3); for (const side of ["L", "R"]) for (const t of G.sides[side].hide) G.hideT[t] = 1;
  return G;
}

const CUTE_UP_WIDE = wide(CUTE_UP), CUTE_LO_WIDE = wide(CUTE_LO);
// the eyeball from the face before any expression (P: the Studio's points then, lo: RAW's lowest y, scale: SCALE):
// its centre and radius in the Studio's space, and how much the skin round it grew
export function eyeOf(G, side, P, scale, lo, keys = null) {
  const o = G.sides[side], c0 = o.eye.centre, r0 = o.eye.radius, mv = [0, 0, 0], at = [0, 0, 0], pts = [];
  for (const i of o.outer) {
    const v = place(o, i, P, scale); pts.push(v);
    mv[0] += (v[0] - scale * o.pos[i * 3]) / o.outer.length; mv[1] += (v[1] - scale * (o.pos[i * 3 + 1] - lo)) / o.outer.length; mv[2] += (v[2] - scale * o.pos[i * 3 + 2]) / o.outer.length;
    for (let a = 0; a < 3; a++) at[a] += v[a] / o.outer.length;
  }
  let sp = 0; for (const v of pts) sp += Math.hypot(v[0] - at[0], v[1] - at[1], v[2] - at[2]); sp /= pts.length;
  const grow = sp / (scale * o.spread0), K = { ...KEYS0, ...(keys || {}) }, mm = 0.001 * scale * grow;
  return { c: [scale * c0[0] + mv[0], scale * (c0[1] - lo) + mv[1] + CUTE_RISE * mm * K.cute, scale * c0[2] + mv[2] + 1.2 * mm * K.depth], r: scale * r0 * grow * (1 + 0.08 * K.size), grow, scale, keys: K };
}
function place(o, i, P, scale) {                        // a point riding its triangle
  const t = o.tri[i], v = [scale * o.off[i * 3], scale * o.off[i * 3 + 1], scale * o.off[i * 3 + 2]];
  for (let k = 0; k < 3; k++) { const b = o.bary[i * 3 + k]; if (!b) continue; const j = TRIS_[t * 3 + k] * 3; v[0] += b * P[j]; v[1] += b * P[j + 1]; v[2] += b * P[j + 2]; }
  return v;
}
let TRIS_ = null;
export function bindTris(TRIS) { TRIS_ = TRIS; }

// the graft's points now (out: Float32Array n*3) on the face P (the Studio's points with every expression but the
// blink), the eye from eyeOf, shut by blink (0..1)
export function placeAll(G, side, P, eye, blink, out, surf = null) {   // surf(x, y, z): how far the eyeball's surface is from its centre that way (the cornea's bulge), or null: its white's sphere
  const o = G.sides[side], n = o.n, { c, r, grow, scale } = eye, K = eye.keys || KEYS0, mm = 0.001 * scale * grow, sx = o.sx;
  const moves = K.size || K.tilt || K.opening || K.depth || K.cute;
  let cin = null;                                       // the inner corner now (the cute eye narrows the opening onto it)
  if (K.cute) { const v = place(o, o.cin, P, scale), sz = 1 + 0.08 * K.size; cin = [c[0] + (v[0] - c[0]) * sz, c[1] + (v[1] - c[1]) * sz]; }
  for (let i = 0; i < n; i++) {
    const v = place(o, i, P, scale), w = o.seat[i], k = o.ring[i];
    if (moves && k < 999) {                             // size, tilt, opening, depth: the lids with the eyeball
      let x = v[0] - c[0], y = v[1] - c[1], z = v[2] - c[2];
      const fd = o.fade[i], sz = 1 + 0.08 * K.size * smooth(fd / 0.6); x *= sz; y *= sz; z *= sz;   // (the falloff: 1 at the opening, 0 at the graft's edge)
      if (K.cute) {                                     // the cute eye, in the eye's own frame
        const ed = o.edge[i] * 1000, w = Math.exp(-((o.rim[i] * 1000 / CUTE_REACH[0]) ** 2)) * smooth(ed / CUTE_REACH[1]);   // (how much of the pinch and the turn the skin takes: by how near it is to where the lids meet the eye)
        const d = (c[0] + x - cin[0]) * sx / mm, dy = c[1] + y - cin[1];   // the inner corner narrowed to a point
        y -= CUTE_PINCH[0] * K.cute * dy * Math.exp(-((d / (d > 0 ? CUTE_PINCH[1] : CUTE_PINCH[2])) ** 2) - (dy / (CUTE_PINCH[3] * mm)) ** 2) * w;
        const near = Math.exp(-((o.rim[i] * 1000 / CUTE_REACH[4]) ** 2)), up = o.lid[i] > 0;   // (the lid's own edge takes its profile as it is; the skin further off a gentler one that eases out toward the corners: a profile that stops dead at a corner is a step in the skin above it)
        const turn = prof(up ? CUTE_UP : CUTE_LO, o.u[i]) * near + prof(up ? CUTE_UP_WIDE : CUTE_LO_WIDE, o.u[i]) * (1 - near);
        const b = -turn * D2R * K.cute * w, ca = Math.cos(b), sa = Math.sin(b), ny = y * ca - z * sa; z = y * sa + z * ca; y = ny;   // each lid's edge turned by its profile
        y += Math.tan(CUTE_TILT * D2R * K.cute) * (x * sx - CUTE_PIVOT * mm) * smooth(ed / CUTE_REACH[2]) * Math.exp(-((o.rim[i] * 1000 / CUTE_REACH[3]) ** 2));   // on a diagonal: the outer corner up, the inner down, about a point CUTE_PIVOT mm toward the temple
      }
      const a = 8 * K.tilt * D2R * smooth(fd / 0.5);
      if (a) { const lx = x * sx, ca = Math.cos(a), sa = Math.sin(a), ny = lx * sa + y * ca; x = (lx * ca - y * sa) * sx; y = ny; }
      const u = o.u[i], tap = smooth(u / 0.25) * smooth((1 - u) / 0.2), b = (o.lid[i] > 0 ? -5 : 2.5) * D2R * K.opening * Math.abs(o.blink[i]) * tap;
      if (b) { const ca = Math.cos(b), sa = Math.sin(b), ny = y * ca - z * sa; z = y * sa + z * ca; y = ny; }
      z += 1.2 * mm * K.depth * smooth(fd / 0.6);
      v[0] = c[0] + x; v[1] = c[1] + y; v[2] = c[2] + z;
    }
    if (w > 0) {                                        // seated on the eyeball as at rest
      const qx = v[0] - c[0], qy = v[1] - c[1], qz = v[2] - c[2], d = Math.hypot(qx, qy, qz) || 1, k = ((r + o.height[i] * scale * grow) - d) * w / d;
      v[0] += qx * k; v[1] += qy * k; v[2] += qz * k;
    }
    out[i * 3] = v[0]; out[i * 3 + 1] = v[1]; out[i * 3 + 2] = v[2];
  }
  if (K.crease || K.fold) for (let i = 0; i < n; i++) {   // crease and inner fold: the upper lid's skin, after it's seated
    const k = o.ring[i]; if (k >= 999 || o.lid[i] <= 0) continue;
    const u = o.u[i], tap = smooth(u / 0.25) * smooth((1 - u) / 0.2);
    const qx = out[i * 3] - c[0], qy = out[i * 3 + 1] - c[1], qz = out[i * 3 + 2] - c[2], d = Math.hypot(qx, qy, qz) || 1;
    let push = 0, down = 0;
    if (K.crease > 0) push = -1.0 * mm * K.crease * Math.exp(-(((k - 12.5) / 2.5) ** 2)) * tap;       // a deeper double lid: the fold set in (the base mesh's crease: about the 12th loop)
    else if (K.crease < 0) { const b = Math.exp(-(((k - 12) / 3.5) ** 2)) * tap; push = 1.4 * mm * -K.crease * b; down = 0.8 * mm * -K.crease * b; }   // a monolid: filled, a little lower
    out[i * 3] += qx / d * push; out[i * 3 + 1] += qy / d * push - down; out[i * 3 + 2] += qz / d * push;
    if (K.fold) { const f = K.fold * (1 - smooth(u / 0.3)) * Math.exp(-(((k - 7) / 4) ** 2)) * smooth((k - 3) / 2); out[i * 3] += -0.8 * mm * sx * f; out[i * 3 + 1] += -1.2 * mm * f; out[i * 3 + 2] += 0.4 * mm * f; }   // (the lid's edge stays: the skin above it drapes over the corner)
  }
  if (K.cute) {                                         // the skin the cute eye has moved, smoothed: each point drawn half way toward the middle of its neighbours, CUTE_RELAX times
    const was = new Float32Array(n * 3);
    for (let pass = 0; pass < CUTE_RELAX; pass++) {
      was.set(out.subarray(0, n * 3));
      for (let i = 0; i < n; i++) {
        const z = 0.5 * K.cute * o.relax[i]; if (!z) continue;
        const nb = o.nb[i]; let x = 0, y = 0, zz = 0; for (const j of nb) { x += was[j * 3]; y += was[j * 3 + 1]; zz += was[j * 3 + 2]; }
        out[i * 3] += z * (x / nb.length - was[i * 3]); out[i * 3 + 1] += z * (y / nb.length - was[i * 3 + 1]); out[i * 3 + 2] += z * (zz / nb.length - was[i * 3 + 2]);
      }
    }
  }
  if (blink > 0) shut(G, o, out, c, blink, mm);
  if (surf) for (let i = 0; i < n; i++) {               // over the cornea's bulge the lid rides out with it (open over the iris's top, shut over all of it), its thickness kept: never into it
    const k = o.ring[i]; if (k >= 999 || !(o.seat[i] > 0 || o.blink[i])) continue;
    const qx = out[i * 3] - c[0], qy = out[i * 3 + 1] - c[1], qz = out[i * 3 + 2] - c[2], d = Math.hypot(qx, qy, qz) || 1;
    const sf = surf(qx / d, qy / d, qz / d); if (sf <= r * 1.0001) continue;   // (over the white the seat has it)
    // the lining too (the loops under 0, the lid's back on the eye): it rests as far under the dome as it rested under
    // the white (a lid that lies on the iris, the eyes v3 look's lower one, left its lining on the white's sphere under
    // the dome: a line of eyeball in front of the lid's edge, EYELIDS)
    const want = sf + (k < 0 ? Math.min(o.height[i], 0) : Math.max(o.height[i], 0.00012)) * scale * grow;
    if (d < want) { const t = (want - d) / d; out[i * 3] += qx * t; out[i * 3 + 1] += qy * t; out[i * 3 + 2] += qz * t; }
  }
  return out;
}
function shut(G, o, V, c, blink, mm) {                  // each lid point turned on the head's x axis through the eyeball's centre
  const up = [], lo = [];
  for (const i of o.contactAll) {
    const x = V[i * 3] - c[0], psi = Math.atan2(V[i * 3 + 1] - c[1], V[i * 3 + 2] - c[2]);
    if (o.blink[i] >= 0) up.push([x, psi]); if (o.blink[i] <= 0) lo.push([x, psi]);   // (the corners in both lids: each closes onto them)
  }
  up.sort((a, b) => a[0] - b[0]); lo.sort((a, b) => a[0] - b[0]);
  const xs = [...up, ...lo].map(p => p[0]), xmin = Math.min(...xs), xmax = Math.max(...xs);
  const interp = (L, x) => { if (x <= L[0][0]) return L[0][1]; for (let k = 1; k < L.length; k++) if (x <= L[k][0]) { const u = (x - L[k - 1][0]) / ((L[k][0] - L[k - 1][0]) || 1); return L[k - 1][1] + u * (L[k][1] - L[k - 1][1]); } return L[L.length - 1][1]; };
  if (!up.length || !lo.length) return;
  for (let i = 0; i < o.n; i++) {
    const w = o.blink[i]; if (!w) continue;
    const x = V[i * 3] - c[0], past = Math.max(0, xmin - x, x - xmax);   // past the corners: eased out over 1.5 mm (a tilted eye's lid can reach past its corner)
    const gap = Math.max(0, interp(up, x) - interp(lo, x)) * (1 - smooth(past / (1.5 * mm))), a = (w > 0 ? G.upperShare : -(1 - G.upperShare)) * gap * Math.abs(w) * blink;
    const qy = V[i * 3 + 1] - c[1], qz = V[i * 3 + 2] - c[2], ca = Math.cos(a), sa = Math.sin(a);
    V[i * 3 + 1] = c[1] + qy * ca - qz * sa; V[i * 3 + 2] = c[2] + qy * sa + qz * ca;
  }
}

// where the skin and its makeup are worked out on the graft (the drawn geometry's objPos): its points open, but the upper
// lid from the lash line to the crease laid flat between them (open, that skin folds under the crease; shut it unfolds,
// and its skin and makeup carry on from the lash line to the crease as on a real lid), out: Float32Array n*3
export function skinPlaces(G, side, V0, out) {
  const o = G.sides[side]; out.set(V0);
  for (const [i, a, b, t] of o.flat) for (let k = 0; k < 3; k++) out[i * 3 + k] = V0[a * 3 + k] + t * (V0[b * 3 + k] - V0[a * 3 + k]);
  return out;
}
// the opening as the Studio's other parts read it: 32 points round where the lids meet the eyeball (0..16 the lower lid,
// outer corner to inner; 16..32 the upper, back out), and their middle
export function outline32(G, side, V) {
  const o = G.sides[side], ids = Array.from(o.contact), P = ids.map(i => [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]]);
  const c = [0, 1, 2].map(a => P.reduce((q, p) => q + p[a], 0) / P.length), out = side === "L" ? 1 : -1;
  let io = 0, ii = 0; P.forEach((p, k) => { if (out * p[0] > out * P[io][0]) io = k; if (out * p[0] < out * P[ii][0]) ii = k; });
  const n = P.length, walk = (a, b, dir) => { const L = [P[a]]; for (let k = a; k !== b;) { k = (k + dir + n) % n; L.push(P[k]); } return L; };
  // the contact loop runs round the eye (from the outer corner up over the upper lid): the lower lid is the other way
  const A = walk(io, ii, 1), B = walk(io, ii, -1), meanY = L => L.reduce((q, p) => q + p[1], 0) / L.length;
  const lower = meanY(A) < meanY(B) ? A : B, upper = (meanY(A) < meanY(B) ? B : A).slice().reverse();
  const res = (L, m) => {                               // m points by arc length, both ends kept
    const d = [0]; for (let k = 1; k < L.length; k++) d.push(d[k - 1] + Math.hypot(L[k][0] - L[k - 1][0], L[k][1] - L[k - 1][1], L[k][2] - L[k - 1][2]));
    const T = d[d.length - 1] || 1, outP = [];
    for (let j = 0; j < m; j++) { const s = T * j / (m - 1); let k = 1; while (k < L.length - 1 && d[k] < s) k++; const u = (s - d[k - 1]) / ((d[k] - d[k - 1]) || 1); outP.push([0, 1, 2].map(a => L[k - 1][a] + u * (L[k][a] - L[k - 1][a]))); }
    return outP;
  };
  const lo = res(lower, 17), up = res(upper, 17);
  return { pts: [...lo, ...up.slice(1, 16)], c };
}

// a lid's rim as rimOf gives it (index.html): per point of the line, three points over the lid's edge to its front
// (where the lashes grow) and, with up, a fourth that far up the lid; offsets from the line's point, smoothed along it
export function rim(G, side, V, line, up = null, mm = 0.001) {
  const o = G.sides[side], R = o.rings, L = G.lashRing, near = (k, p) => {
    let best = -1, bd = Infinity; for (const i of R[k] || []) { const d = (V[i * 3] - p[0]) ** 2 + (V[i * 3 + 1] - p[1]) ** 2 + (V[i * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } }
    return best < 0 ? p : [V[best * 3], V[best * 3 + 1], V[best * 3 + 2]];
  };
  const rows = line.map((p, j) => {
    const q1 = near(Math.max(1, Math.round(L / 3)), p), q2 = near(Math.max(1, Math.round(2 * L / 3)), p), q3 = near(L, p);
    const row = [...q1, ...q2, ...q3].map((x, a) => x - p[a % 3]);
    if (up != null) {                                   // up the lid from the front edge by `up` mm
      const want = (Array.isArray(up) ? up[j] : up) * mm; let q = q3;
      for (let k = L + 1; k <= 14; k++) { const t = near(k, q3); q = t; if (Math.hypot(t[0] - q3[0], t[1] - q3[1], t[2] - q3[2]) >= want) break; }
      row.push(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    }
    return row;
  });
  return rows.map((row, j) => row.map((x, a) => (x + (rows[Math.max(0, j - 1)][a]) + (rows[Math.min(rows.length - 1, j + 1)][a])) / 3));   // smoothed along the lid
}

// the drawn graft: both eyes in one geometry on the skin's own material (its procedural skin on objPos, the photo and
// the paint on MHR's UVs), the wet membrane (the lining, where the lid meets the eye, its edge behind the lash line)
export function geometry(G) {
  const nL = G.sides.L.n, n = nL + G.sides.R.n, g = new THREE.BufferGeometry();
  for (const [k, w] of [["position", 3], ["normal", 3], ["objPos", 3]]) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n * 3), w));
  const uv = new Float32Array(n * 2); uv.set(G.sides.L.uv, 0); uv.set(G.sides.R.uv, nL * 2);
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setAttribute("skinUv", g.attributes.uv);
  const mem = new Float32Array(n); mem.set(G.sides.L.membrane, 0); mem.set(G.sides.R.membrane, nL);
  g.setAttribute("membrane", new THREE.BufferAttribute(mem, 1)); g.setAttribute("skinThin", new THREE.BufferAttribute(new Float32Array(n), 1));
  const blur = new Float32Array(n);                     // how softly it reads the photo and the paint: the upper lid from its edge to the crease (shut, it unfolds over skin the photo never saw), the lining
  for (const [side, off] of [["L", 0], ["R", nL]]) { const o = G.sides[side]; for (let i = 0; i < o.n; i++) { const k = o.ring[i]; blur[off + i] = k >= 999 ? 0 : k <= 0 ? 1 : o.lid[i] > 0 ? smooth((k - 1) / 2) * (1 - smooth((k - 11) / 6)) : 1 - smooth((k - 1) / 2); } }   // (fading out gently over the crease and the fold, so the shut lid's tone meets the photo's without an edge)
  g.setAttribute("photoBlur", new THREE.BufferAttribute(blur, 1));
  const col = new Float32Array(n * 3).fill(1);           // the skin's vertex colour (white but in the mouth: index.html mouthShade), darker down the socket
  for (const [side, off] of [["L", 0], ["R", nL]]) { const o = G.sides[side]; for (let i = 0; i < o.n; i++) if (o.ring[i] < 0) col.fill(1 + 0.1 * o.ring[i], (off + i) * 3, (off + i) * 3 + 3); }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const fl = G.sides.L.faces, fr = G.sides.R.faces, idx = new Uint32Array(fl.length + fr.length); idx.set(fl, 0); for (let k = 0; k < fr.length; k++) idx[fl.length + k] = fr[k] + nL;
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.userData.nL = nL;
  return g;
}
// its normals: the graft's own, but MHR's where it meets MHR (its own points round the hole) and eased into MHR's over
// the loops eased onto MHR's skin, so the seam doesn't show in the light
export function normals(G, g, NP) {
  g.computeVertexNormals(); const N_ = g.attributes.normal.array, nL = g.userData.nL, ease = G.header.loops?.ease || 12, outK = G.header.loops?.out || 19;
  for (const side of ["L", "R"]) {
    const o = G.sides[side], off = side === "L" ? 0 : nL;
    for (let i = 0; i < o.n; i++) {
      const k = o.ring[i]; if (k < ease) continue;
      const w = k >= 999 ? 1 : smooth((k - ease) / (outK - ease)), m = [0, 0, 0], t = o.tri[i];
      for (let a = 0; a < 3; a++) { const b = o.bary[i * 3 + a], j = TRIS_[t * 3 + a] * 3; m[0] += b * NP[j]; m[1] += b * NP[j + 1]; m[2] += b * NP[j + 2]; }
      const j = (off + i) * 3, x = N_[j] + w * (m[0] - N_[j]), y = N_[j + 1] + w * (m[1] - N_[j + 1]), z = N_[j + 2] + w * (m[2] - N_[j + 2]), l = Math.hypot(x, y, z) || 1;
      N_[j] = x / l; N_[j + 1] = y / l; N_[j + 2] = z / l;
    }
  }
  g.attributes.normal.needsUpdate = true;
}

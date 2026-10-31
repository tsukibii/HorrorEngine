// TAU's eyes on the Studio's face (tools/eye_patch.py makes Content/Studio/Bodies/MHR_eyes.bin, served as
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
const OUTER = 15, SEAT_TO = 4, SEAT_OFF = 10, FLAT_A = 3, FLAT_B = 13;   // (FLAT: the upper lid from its lash line to TAU's crease, laid flat for its skin and makeup)   // (OUTER: read from the file's loops below when it says)          // the loops the eyeball follows (and out), the lid's edge seated to the 4th loop, eased out by the 10th
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
  ["opening", "Opening", -1, 1, 0.01, "−1 narrower (the upper lid lower, the lower higher), +1 rounder."],
  ["depth", "Depth", -1, 1, 0.01, "−1 deep-set (the eye and its lids 1.2 mm back under the brow), +1 prominent."],
];
export const KEYS0 = { size: 0, crease: 0, fold: 0, tilt: 0, opening: 0, depth: 0 };
export const EYE_PRESETS = {
  "TAU": {}, "East Asian": { crease: -0.8, fold: 0.6, tilt: 0.25, opening: -0.3, depth: 0.35 }, "Caucasian": { crease: 0.6, opening: 0.15, depth: -0.4 },
};

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
  return { c: [scale * c0[0] + mv[0], scale * (c0[1] - lo) + mv[1], scale * c0[2] + mv[2] + 1.2 * mm * K.depth], r: scale * r0 * grow * (1 + 0.08 * K.size), grow, scale, keys: K };
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
  const moves = K.size || K.tilt || K.opening || K.depth;
  for (let i = 0; i < n; i++) {
    const v = place(o, i, P, scale), w = o.seat[i], k = o.ring[i];
    if (moves && k < 999) {                             // size, tilt, opening, depth: the lids with the eyeball
      let x = v[0] - c[0], y = v[1] - c[1], z = v[2] - c[2];
      const fd = o.fade[i], sz = 1 + 0.08 * K.size * smooth(fd / 0.6); x *= sz; y *= sz; z *= sz;   // (the falloff: 1 at the opening, 0 at the graft's edge)
      const a = 8 * D2R * K.tilt * smooth(fd / 0.5);
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
    if (K.crease > 0) push = -1.0 * mm * K.crease * Math.exp(-(((k - 12.5) / 2.5) ** 2)) * tap;       // a deeper double lid: the fold set in (TAU's crease: about the 12th loop)
    else if (K.crease < 0) { const b = Math.exp(-(((k - 12) / 3.5) ** 2)) * tap; push = 1.4 * mm * -K.crease * b; down = 0.8 * mm * -K.crease * b; }   // a monolid: filled, a little lower
    out[i * 3] += qx / d * push; out[i * 3 + 1] += qy / d * push - down; out[i * 3 + 2] += qz / d * push;
    if (K.fold) { const f = K.fold * (1 - smooth(u / 0.3)) * Math.exp(-(((k - 7) / 4) ** 2)) * smooth((k - 3) / 2); out[i * 3] += -0.8 * mm * sx * f; out[i * 3 + 1] += -1.2 * mm * f; out[i * 3 + 2] += 0.4 * mm * f; }   // (the lid's edge stays: the skin above it drapes over the corner)
  }
  if (blink > 0) shut(G, o, out, c, blink, mm);
  if (surf) for (let i = 0; i < n; i++) {               // over the cornea's bulge the lid rides out with it (open over the iris's top, shut over all of it), its thickness kept: never into it
    const k = o.ring[i]; if (k < 0 || k >= 999 || !(o.seat[i] > 0 || o.blink[i])) continue;
    const qx = out[i * 3] - c[0], qy = out[i * 3 + 1] - c[1], qz = out[i * 3 + 2] - c[2], d = Math.hypot(qx, qy, qz) || 1;
    const sf = surf(qx / d, qy / d, qz / d); if (sf <= r * 1.0001) continue;   // (over the white the seat has it)
    const want = sf + Math.max(o.height[i], 0.00012) * scale * grow;
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
  for (const [side, off] of [["L", 0], ["R", nL]]) { const o = G.sides[side]; for (let i = 0; i < o.n; i++) { const k = o.ring[i]; blur[off + i] = k >= 999 ? 0 : k <= 0 ? 1 : o.lid[i] > 0 ? smooth((k - 1) / 2) * (1 - smooth((k - 12) / 3)) : 1 - smooth((k - 1) / 2); } }
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

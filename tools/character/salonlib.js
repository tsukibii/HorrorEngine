// The salon's hair as numbers (docs/SALON_PLAN.md, Phase 2): locks of three kinds, each a few handles that a guide's
// curves are rebuilt from, kept off the body by a collider; mirrored across a seam. Plain arrays, no three.js, so the
// page and node share it. Everything is in the head's local space (salonref.js): the origin between the ears, X to the
// character's left, Y up the face, Z forward, in metres on MHR's base head (a body of another size is scaled to it).
//
//   lock types
//     strand  one guide: pts (6 control points, pts[0] the root)
//     sheet   a root line along the scalp and three edge curves (left, middle, right: 6 control points each) that the
//             guides across it are blended from; the edges' points are its handles
//     bundle  a spine (6 control points) and a radius at the root and the tip: a tapered tube of guides round it
//   evaluate(lock, collider) -> [{pts, across, width}]  every guide as a polyline with its ribbon's direction and width
//   Collider(points) -> push(p, gap)                   the head as a radial field, the torso as horizontal slices

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = a => Math.hypot(a[0], a[1], a[2]), norm = a => mul(a, 1 / (len(a) || 1));
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const CTRL = 6;                 // control points per curve
export const SAMPLES = 24;             // points per evaluated guide
export const GAP = 0.0025;             // hair kept this far off the skin (m)
export const HUG = 0.03;               // a new curve's points this close to the head lie down on it

// ---- curves -----------------------------------------------------------------------------------------------------------
// a centripetal Catmull-Rom through the points, n samples (ends included)
export function catmull(P, n = SAMPLES) {
  if (P.length < 2) return P.map(p => p.slice());
  const ext = [sub(mul(P[0], 2), P[1]), ...P, sub(mul(P[P.length - 1], 2), P[P.length - 2])];
  const segs = P.length - 1, out = [];
  for (let s = 0; s < n; s++) {
    const g = s / (n - 1) * segs, i = Math.min(segs - 1, Math.floor(g)), u = g - i;
    const p0 = ext[i], p1 = ext[i + 1], p2 = ext[i + 2], p3 = ext[i + 3];
    const t01 = Math.pow(len(sub(p1, p0)) || 1e-6, 0.5), t12 = Math.pow(len(sub(p2, p1)) || 1e-6, 0.5), t23 = Math.pow(len(sub(p3, p2)) || 1e-6, 0.5);
    // tangents (Barry and Goldman's form, scaled to the segment)
    const m1 = mul(add(sub(mul(sub(p1, p0), 1 / t01), mul(sub(p2, p0), 1 / (t01 + t12))), mul(sub(p2, p1), 1 / t12)), t12);
    const m2 = mul(add(sub(mul(sub(p2, p1), 1 / t12), mul(sub(p3, p1), 1 / (t12 + t23))), mul(sub(p3, p2), 1 / t23)), t12);
    const u2 = u * u, u3 = u2 * u;
    out.push(add(add(mul(p1, 2 * u3 - 3 * u2 + 1), mul(m1, u3 - 2 * u2 + u)), add(mul(p2, -2 * u3 + 3 * u2), mul(m2, u3 - u2))));
  }
  return out;
}

// a polyline's point at a fraction of its length
export function along(P, f) {
  if (P.length === 1) return P[0].slice();
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + len(sub(P[i], P[i - 1])));
  const want = clamp(f, 0, 1) * L[L.length - 1];
  for (let i = 1; i < P.length; i++) if (L[i] >= want) { const s = L[i] - L[i - 1]; return mix(P[i - 1], P[i], s ? (want - L[i - 1]) / s : 0); }
  return P[P.length - 1].slice();
}
export function length(P) { let s = 0; for (let i = 1; i < P.length; i++) s += len(sub(P[i], P[i - 1])); return s; }
export function resample(P, n) { return Array.from({ length: n }, (_, i) => along(P, i / (n - 1))); }

// ---- the body as a collider -------------------------------------------------------------------------------------------
// the head: a radial field round the skull's middle (the outermost skin per direction, bilinear between bins), from the
// points above the chin; the neck and torso: horizontal slices every centimetre, each a polar radius round its middle,
// the arms left out. push(p, gap) moves a point out along the field's direction until it's gap off the skin.
const EL = 72, AZ = 144, SA = 48;      // the head's field: 2.5 degrees a bin
export class Collider {
  constructor(P, opts = {}) {
    const n = P.length / 3;
    this.chin = opts.chin ?? -0.095;                                  // the chin's height (local)
    let zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i < n; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; if (y > 0.02 && Math.hypot(x, y, z) < 0.16) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); } }
    this.C = [0, 0.01, isFinite(zmin) ? (zmin + zmax) / 2 : 0];
    const R = new Float32Array(EL * AZ);
    const splat = (x, y, z) => {
      if (y < this.chin) return;
      const d = [x - this.C[0], y - this.C[1], z - this.C[2]], r = len(d); if (r > 0.2 || r < 1e-6) return;
      const [e, a] = this.bin(d, r), k = Math.min(EL - 1, Math.round(e)) * AZ + (Math.round(a) % AZ); if (r > R[k]) R[k] = r;
    };
    if (opts.tris) {                                                 // the skin itself: points spread over every triangle
      const T = opts.tris, S = 5;
      for (let t = 0; t < T.length; t += 3) {
        const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
        if (P[a + 1] < this.chin && P[b + 1] < this.chin && P[c + 1] < this.chin) continue;
        for (let u = 0; u <= S; u++) for (let v = 0; u + v <= S; v++) { const w = S - u - v; splat((P[a] * u + P[b] * v + P[c] * w) / S, (P[a + 1] * u + P[b + 1] * v + P[c + 1] * w) / S, (P[a + 2] * u + P[b + 2] * v + P[c + 2] * w) / S); }
      }
    } else for (let i = 0; i < n; i++) splat(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    fill(R, EL, AZ, true);
    this.R = R;
    // the slices: from just under the chin to the hips
    this.y0 = this.chin + 0.03; this.dy = 0.01; this.ns = 70;
    this.slices = [];
    for (let s = 0; s < this.ns; s++) {
      const y = this.y0 - s * this.dy, xlim = y > -0.24 ? 0.27 : 0.19;
      let cx = 0, cz = 0, m = 0; const pts = [];
      for (let i = 0; i < n; i++) { const py = P[i * 3 + 1]; if (Math.abs(py - y) > 0.008) continue; const px = P[i * 3], pz = P[i * 3 + 2]; if (Math.abs(px) > xlim) continue; pts.push(px, pz); cx += px; cz += pz; m++; }
      if (!m) { this.slices.push(null); continue; }
      cx /= m; cz /= m;
      const r = new Float32Array(SA);
      for (let j = 0; j < pts.length; j += 2) { const dx = pts[j] - cx, dz = pts[j + 1] - cz, a = (Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI) * SA, k = Math.round(a) % SA; r[k] = Math.max(r[k], Math.hypot(dx, dz)); }
      fill(r, 1, SA, true);
      this.slices.push({ y, cx, cz, r });
    }
  }
  bin(d, r) { const e = Math.asin(clamp(d[1] / r, -1, 1)), a = Math.atan2(d[0], d[2]); return [(e + Math.PI / 2) / Math.PI * (EL - 1), (a + Math.PI) / (2 * Math.PI) * AZ]; }
  radius(d) {                                                        // the head's radius in direction d (bilinear)
    const r = len(d) || 1e-9, [e, a] = this.bin(d, r), e0 = Math.floor(e), a0 = Math.floor(a), fe = e - e0, fa = a - a0;
    const at = (i, j) => this.R[clamp(i, 0, EL - 1) * AZ + ((j % AZ) + AZ) % AZ];
    return (at(e0, a0) * (1 - fa) + at(e0, a0 + 1) * fa) * (1 - fe) + (at(e0 + 1, a0) * (1 - fa) + at(e0 + 1, a0 + 1) * fa) * fe;
  }
  sliceRadius(s, dx, dz) { const a = (Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI) * SA, a0 = Math.floor(a), f = a - a0; return s.r[a0 % SA] * (1 - f) + s.r[(a0 + 1) % SA] * f; }
  push(p, gap = GAP) {
    let q = p.slice(), moved = false;
    if (q[1] > this.chin - 0.03) {
      const d = sub(q, this.C), r = len(d), R = this.radius(d);
      if (R > 0 && r < R + gap) { q = add(this.C, mul(d, (R + gap) / (r || 1e-9))); moved = true; }
    }
    if (q[1] < this.y0 + 0.005) {
      const f = (this.y0 - q[1]) / this.dy, i = Math.floor(f), w = f - i;
      const a = this.slices[clamp(i, 0, this.ns - 1)], b = this.slices[clamp(i + 1, 0, this.ns - 1)];
      if (a && b && f < this.ns - 1) {
        const cx = a.cx * (1 - w) + b.cx * w, cz = a.cz * (1 - w) + b.cz * w, dx = q[0] - cx, dz = q[2] - cz, rr = Math.hypot(dx, dz);
        const R = this.sliceRadius(a, dx, dz) * (1 - w) + this.sliceRadius(b, dx, dz) * w;
        if (R > 0 && rr < R + gap) { const k = (R + gap) / (rr || 1e-9); q[0] = cx + dx * k; q[2] = cz + dz * k; moved = true; }
      }
    }
    return [q, moved];
  }
  inside(p) { return this.push(p, 0)[1]; }
  depth(p) {                                                         // how far outside the body p is (m; the hair's depth for its shading)
    let d = Infinity;
    if (p[1] > this.chin - 0.03) { const v = sub(p, this.C); d = len(v) - this.radius(v); }
    if (p[1] < this.y0 + 0.005) {
      const f = (this.y0 - p[1]) / this.dy, i = Math.floor(f), w = f - i, a = this.slices[clamp(i, 0, this.ns - 1)], b = this.slices[clamp(i + 1, 0, this.ns - 1)];
      if (a && b && f < this.ns - 1) { const cx = a.cx * (1 - w) + b.cx * w, cz = a.cz * (1 - w) + b.cz * w, dx = p[0] - cx, dz = p[2] - cz; d = Math.min(d, Math.hypot(dx, dz) - (this.sliceRadius(a, dx, dz) * (1 - w) + this.sliceRadius(b, dx, dz) * w)); }
    }
    return isFinite(d) ? d : 0.1;
  }
  surface(p, gap = 0.0015) {                                          // a point snapped onto the head's skin (roots)
    const d = sub(p, this.C), R = this.radius(d);
    return add(this.C, mul(norm(d), R + gap));
  }
  normal(p) { return norm(sub(p, this.C)); }
}
function fill(R, rows, cols, wrap) {                                 // empty bins take their neighbours' largest
  for (let pass = 0; pass < 8; pass++) {
    let empty = 0;
    for (let e = 0; e < rows; e++) for (let a = 0; a < cols; a++) {
      const k = e * cols + a; if (R[k]) continue; empty++;
      let m = 0;
      for (const [de, da] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const ee = e + de; if (ee < 0 || ee >= rows) continue; const aa = wrap ? (a + da + cols) % cols : a + da; if (aa < 0 || aa >= cols) continue; m = Math.max(m, R[ee * cols + aa]); }
      if (m) R[k] = m;
    }
    if (!empty) break;
  }
}

// ---- the scalp: where roots may go ------------------------------------------------------------------------------------
// round the head from the front (degrees round the skull's middle, heights in local metres): the forehead's hairline, the
// temples' corners, the sideburns in front of the ears down to the tragus, above the ears (the ears themselves left
// out), behind them down to the nape. Measured on MHR: the face's edge by the ear is at 58 degrees, the ear 80 to 108.
const lerp1 = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
export function scalpLimit(az) {
  if (az < 28) return 0.062;
  if (az < 50) return lerp1(0.062, 0.046, (az - 28) / 22);              // the temple's corner
  if (az < 58) return lerp1(0.046, -0.025, (az - 50) / 8);              // the sideburn's front edge
  if (az < 80) return -0.025;                                           // the sideburn, to the tragus
  if (az < 108) return 0.042;                                           // above the ear
  if (az < 118) return lerp1(0.042, -0.04, (az - 108) / 10);            // close round the back of the ear
  if (az < 140) return lerp1(-0.04, -0.07, (az - 118) / 22);            // behind it, down to the nape
  return -0.075;
}
export function onScalp(p, C = [0, 0.01, 0]) {
  const d = sub(p, C); if (len(d) > 0.17) return false;
  const az = Math.abs(Math.atan2(p[0], p[2] - C[2])) * 180 / Math.PI;
  if (az > 58 && az < 110 && Math.abs(p[0]) > 0.077 && p[1] < 0.045) return false;   // the ear's flap
  return p[1] > scalpLimit(az);
}

// ---- making locks -----------------------------------------------------------------------------------------------------
let NEXT = 1;
export const newId = () => `L${Date.now().toString(36)}${(NEXT++).toString(36)}`;

// a curve from a to b laid over the head: straight, bowed out by sag, then pushed off the body and smoothed a few times
// so it lies on the head like combed hair instead of cutting through it
export function drape(a, b, col, sag = 0, n = CTRL) {
  const L = len(sub(b, a));
  let P = Array.from({ length: n }, (_, i) => mix(a, b, i / (n - 1)));
  if (!col) return P;
  // combed: a point near the head lies on it (pushed out of it or pulled down onto it), smoothed, again
  for (let it = 0; it < 6; it++) {
    P = P.map((p, i) => i === 0 ? p : onto(p, col));
    P = P.map((p, i) => i === 0 || i === n - 1 ? p : mix(p, mix(P[i - 1], P[i + 1], 0.5), 0.3));
  }
  P = P.map((p, i) => i === 0 ? p : onto(p, col));
  // the wheel's bow: away from the head, most in the middle
  if (sag) P = P.map((p, i) => i === 0 ? p : col.push(add(p, mul(col.normal(p), sag * L * Math.sin(Math.PI * i / (n - 1)) * 0.5)), GAP)[0]);
  return P;
}
// a point within HUG of the head laid on it (GAP off the skin), one further away left where it is
export function onto(p, col, reach = HUG) {
  const d = sub(p, col.C), r = len(d), R = col.radius(d);
  if (p[1] > col.chin - 0.03 && R > 0 && r < R + reach) return add(col.C, mul(d, (R + GAP) / (r || 1e-9)));
  return col.push(p, GAP)[0];
}
// a lock's control points laid onto the head (all but the roots): "Onto the scalp"
export function hug(lock, col, reach = HUG) {
  const H = handles(lock);
  for (const h of H) if (!h.root) setHandle(lock, h.path, onto(h.p, col, reach));
}

export function makeStrand(root, end, col, o = {}) {
  return { id: newId(), type: "strand", name: o.name || "strand", group: o.group || "g1", visible: true,
           pts: drape(root, end, col, o.sag ?? 0), width: o.width ?? 0.006, taper: o.taper ?? 0.6, render: o.render || "cards", density: o.density ?? 12, color: o.color || null, mirror_of: null };
}

// a sheet: the root line (points on the scalp), the end line's middle and its width (the spread)
export function makeSheet(rootLine, endMid, spread, col, o = {}) {
  const root = rootLine.map(p => p.slice()), r0 = root[0], r1 = root[root.length - 1], rm = along(root, 0.5);
  let across = sub(r1, r0); const down = sub(endMid, rm);
  across = sub(across, mul(norm(down), dot(across, norm(down)))); across = norm(across);
  const half = mul(across, spread / 2);
  const edges = [drape(r0, sub(endMid, half), col, o.sag ?? 0), drape(rm, endMid, col, o.sag ?? 0), drape(r1, add(endMid, half), col, o.sag ?? 0)];
  const guides = o.guides ?? clamp(Math.round(Math.max(length(root), spread) / 0.012) + 1, 3, 12);
  return { id: newId(), type: "sheet", name: o.name || "sheet", group: o.group || "g1", visible: true, root, edges, guides,
           taper: o.taper ?? 0.5, render: o.render || "cards", density: o.density ?? 60, color: o.color || null, mirror_of: null };
}

export function makeBundle(root, tip, col, o = {}) {
  return { id: newId(), type: "bundle", name: o.name || "bundle", group: o.group || "g1", visible: true,
           spine: drape(root, tip, col, o.sag ?? 0), r0: o.r0 ?? 0.015, r1: o.r1 ?? 0.004, guides: o.guides ?? 8,
           taper: o.taper ?? 0.4, render: o.render || "cards", density: o.density ?? 80, color: o.color || null, mirror_of: null };
}

// every point array of a lock (the handles and the roots), for moving, mirroring, saving
export function handles(lock) {
  if (lock.type === "strand") return lock.pts.map((p, i) => ({ p, root: i === 0, path: ["pts", i] }));
  if (lock.type === "bundle") return lock.spine.map((p, i) => ({ p, root: i === 0, path: ["spine", i] }));
  const out = [];
  lock.edges.forEach((E, j) => E.forEach((p, i) => { if (i > 0) out.push({ p, root: false, path: ["edges", j, i] }); }));
  return out;
}
export function setHandle(lock, path, p) {
  if (path[0] === "edges") lock.edges[path[1]][path[2]] = p; else lock[path[0]][path[1]] = p;
}

// ---- evaluating a lock into guides ------------------------------------------------------------------------------------
// guides: [{pts: SAMPLES points, across: a unit vector per point (the ribbon's width), width: per point}]
const quad = (L, M, R, u) => { const Mp = sub(mul(M, 2), mul(add(L, R), 0.5)); return add(add(mul(L, (1 - u) * (1 - u)), mul(Mp, 2 * u * (1 - u))), mul(R, u * u)); };

function keepOff(pts, col) { return col ? pts.map((p, i) => i === 0 ? p : col.push(p, GAP)[0]) : pts; }
function sideways(pts, col, k) {                                     // a ribbon lying flat on the hair's surface
  const i0 = Math.max(0, k - 1), i1 = Math.min(pts.length - 1, k + 1), t = norm(sub(pts[i1], pts[i0]));
  const out = col ? col.normal(pts[k]) : [0, 0, 1];
  let a = cross(t, out); if (len(a) < 1e-4) a = cross(t, [1, 0, 0]);
  return norm(a);
}

export function evaluate(lock, col) {
  const taperW = (w, k) => w * (1 - lock.taper * Math.pow(k / (SAMPLES - 1), 1.5));
  if (lock.type === "strand") {
    const pts = keepOff(catmull(lock.pts), col);
    return [{ pts, across: pts.map((_, k) => sideways(pts, col, k)), width: pts.map((_, k) => taperW(lock.width, k)) }];
  }
  if (lock.type === "sheet") {
    const g = Math.max(2, lock.guides | 0), [L, M, R] = lock.edges, n = L.length, guides = [];
    for (let j = 0; j < g; j++) {
      const u = j / (g - 1), root = along(lock.root, u);
      const C = L.map((_, k) => quad(L[k], M[k], R[k], u));
      const d = sub(root, C[0]);
      const ctrl = C.map((c, k) => add(c, mul(d, Math.pow(1 - k / (n - 1), 2))));
      ctrl[0] = root;
      guides.push(keepOff(catmull(ctrl), col));
    }
    // the ribbons' width: the gap to the neighbours, overlapped
    return guides.map((pts, j) => {
      const nb = guides[j + 1] || guides[j - 1];
      return { pts, across: pts.map((p, k) => { const a = sub(nb[k], p); return len(a) > 1e-5 ? norm(j + 1 < g ? a : mul(a, -1)) : sideways(pts, col, k); }),
               width: pts.map((p, k) => taperW(Math.max(0.004, len(sub(nb[k], p)) * 1.7), k)) };
    });
  }
  // bundle: guides round the spine at the radius from root to tip
  const spine = keepOff(catmull(lock.spine), col), g = Math.max(3, lock.guides | 0), out = [];
  const frames = []; let b1 = null;
  for (let k = 0; k < spine.length; k++) {                           // a frame along the spine, carried (parallel transport)
    const t = norm(sub(spine[Math.min(spine.length - 1, k + 1)], spine[Math.max(0, k - 1)]));
    if (!b1) { b1 = cross(t, col ? col.normal(spine[0]) : [0, 0, 1]); if (len(b1) < 1e-4) b1 = cross(t, [1, 0, 0]); }
    b1 = norm(sub(b1, mul(t, dot(b1, t)))); frames.push([t, b1, cross(t, b1)]);
  }
  for (let j = 0; j < g; j++) {
    const th = j / g * 2 * Math.PI, c = Math.cos(th), s = Math.sin(th);
    const pts = spine.map((p, k) => { const f = k / (spine.length - 1), r = lock.r0 + (lock.r1 - lock.r0) * f; const [, u, v] = frames[k]; return add(p, add(mul(u, c * r), mul(v, s * r))); });
    const kept = keepOff(pts, col);
    out.push({ pts: kept, across: kept.map((_, k) => { const [, u, v] = frames[k]; return norm(add(mul(u, -s), mul(v, c))); }),
               width: kept.map((_, k) => { const f = k / (spine.length - 1), r = lock.r0 + (lock.r1 - lock.r0) * f; return Math.max(0.003, 2 * Math.PI * r / g * 1.8) * (1 - lock.taper * 0.3 * f); }) });
  }
  return out;
}

// the realism option: thin strands spread through the lock (between its guides, jittered), as polylines
export function strandsOf(lock, guides, seed = 7) {
  const r = rng(seed + (lock.id ? [...String(lock.id)].reduce((a, c) => a + c.charCodeAt(0), 0) : 0)), out = [], N = Math.max(1, lock.density | 0);
  if (lock.type === "strand") {
    const G = guides[0];
    for (let s = 0; s < N; s++) { const o = (r() - 0.5) * 2, w = r() * 0.6 + 0.4; out.push(G.pts.map((p, k) => add(p, mul(G.across[k], o * G.width[k] * 0.5 * w)))); }
    return out;
  }
  if (lock.type === "sheet") {
    for (let s = 0; s < N; s++) {
      const u = r() * (guides.length - 1), j = Math.min(guides.length - 2, Math.floor(u)), f = u - j, A = guides[j].pts, B = guides[j + 1].pts, tip = 0.75 + 0.25 * r();
      const pts = A.map((p, k) => add(mix(p, B[k], f), mul(guides[j].across[k], (r() - 0.5) * 0.002)));
      out.push(resample(pts.slice(0, Math.max(2, Math.round(pts.length * tip))), SAMPLES));
    }
    return out;
  }
  for (let s = 0; s < N; s++) {
    const j = Math.floor(r() * guides.length), k2 = (j + 1) % guides.length, f = r(), A = guides[j].pts, B = guides[k2].pts, tip = 0.8 + 0.2 * r();
    out.push(resample(A.map((p, k) => mix(p, B[k], f)).slice(0, Math.max(2, Math.round(A.length * tip))), SAMPLES));
  }
  return out;
}

// ---- the mirror -------------------------------------------------------------------------------------------------------
// a twin across the seam, a plane x = seam (the middle, or moved sideways); roots snapped back onto the skin
export function reflectPoint(p, seam = 0) { return [2 * seam - p[0], p[1], p[2]]; }
export function mirrored(lock, seam = 0, col = null, id = null) {
  const m = JSON.parse(JSON.stringify(lock)), R = p => reflectPoint(p, seam);
  m.id = id || newId(); m.mirror_of = lock.id; m.name = (lock.name || lock.type) + " (mirror)";
  if (m.type === "strand") { m.pts = m.pts.map(R); if (col) m.pts[0] = col.surface(m.pts[0]); }
  else if (m.type === "bundle") { m.spine = m.spine.map(R); if (col) m.spine[0] = col.surface(m.spine[0]); }
  else { m.root = m.root.map(R).map(p => col ? col.surface(p) : p); m.edges = m.edges.map(E => E.map(R)); m.edges.forEach(E => { E[0] = col ? col.surface(E[0]) : E[0]; }); }
  return m;
}
// the twins follow their originals (after an edit): every lock whose mirror_of is the edited one is rebuilt from it
export function syncTwins(locks, seam, col) {
  const byId = Object.fromEntries(locks.map(l => [l.id, l]));
  return locks.map(l => {
    const o = l.mirror_of && byId[l.mirror_of]; if (!o) return l;
    const name = !l.name || l.name.endsWith(" (mirror)") ? (o.name || o.type) + " (mirror)" : l.name;   // a renamed twin keeps its name
    return Object.assign(mirrored(o, seam, col, l.id), { group: l.group, visible: l.visible, name });
  });
}

// ---- moving a whole lock, a handle with its neighbours ----------------------------------------------------------------
// dragging one handle pulls the ones after it along (falling off), so a lock bends instead of kinking
export function dragHandle(lock, path, to, col, falloff = 0.6) {
  const H = handles(lock), i = H.findIndex(h => h.path.join() === path.join()); if (i < 0) return;
  const d = sub(to, H[i].p);
  const series = path[0] === "edges" ? H.filter(h => h.path[1] === path[1]) : H;
  const at = series.findIndex(h => h.path.join() === path.join());
  series.forEach((h, k) => {
    if (h.root) return;
    const w = k === at ? 1 : k > at ? Math.pow(falloff, k - at) : 0;
    if (!w) return;
    let q = add(h.p, mul(d, w)); if (col) q = col.push(q, GAP)[0];
    setHandle(lock, h.path, q);
  });
}
export function moveLock(lock, d) {
  const T = p => add(p, d);
  if (lock.type === "strand") lock.pts = lock.pts.map(T);
  else if (lock.type === "bundle") lock.spine = lock.spine.map(T);
  else { lock.root = lock.root.map(T); lock.edges = lock.edges.map(E => E.map(T)); }
}

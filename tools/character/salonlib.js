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
export const WARP = 1.4;               // closer near the root (where the root bends): sample k at (k / (SAMPLES - 1)) ^ WARP
export const TS = Array.from({ length: SAMPLES }, (_, k) => Math.pow(k / (SAMPLES - 1), WARP));   // each sample's place along a guide, 0 to 1
export const GAP = 0.0025;             // hair kept this far off the skin (m)
export const HUG = 0.03;               // a new curve's points this close to the head lie down on it

// ---- curves -----------------------------------------------------------------------------------------------------------
// a centripetal Catmull-Rom through the points, n samples (ends included), spread evenly (warp 1) or closer at the start
export function catmull(P, n = SAMPLES, warp = 1) {
  if (P.length < 2) return P.map(p => p.slice());
  const ext = [sub(mul(P[0], 2), P[1]), ...P, sub(mul(P[P.length - 1], 2), P[P.length - 2])];
  const segs = P.length - 1, out = [];
  for (let s = 0; s < n; s++) {
    const g = Math.pow(s / (n - 1), warp) * segs, i = Math.min(segs - 1, Math.floor(g)), u = g - i;
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
  const n = o.ctrl ?? CTRL;                                             // control points down each edge (more for a long lock)
  const edges = [drape(r0, sub(endMid, half), col, o.sag ?? 0, n), drape(rm, endMid, col, o.sag ?? 0, n), drape(r1, add(endMid, half), col, o.sag ?? 0, n)];
  const guides = o.guides ?? clamp(Math.round(Math.max(length(root), spread) / 0.012) + 1, 3, 12);
  return { id: newId(), type: "sheet", name: o.name || "sheet", group: o.group || "g1", visible: true, root, edges, guides,
           taper: o.taper ?? 0.5, render: o.render || "cards", density: o.density ?? 60, color: o.color || null, mirror_of: null };
}

// a bundle: a tube round its spine, r0 at the root to r1 at the tip; its cross-section an ellipse, `height` its other
// axis as a share of its width (1 round); `axis` the width's direction at the root (a bundle line's line), or across
// the spine on the scalp
export function makeBundle(root, tip, col, o = {}) {
  return { id: newId(), type: "bundle", name: o.name || "bundle", group: o.group || "g1", visible: true,
           spine: drape(root, tip, col, o.sag ?? 0), r0: o.r0 ?? 0.015, r1: o.r1 ?? 0.004, height: o.height ?? 1, axis: o.axis || null, guides: o.guides ?? 8,
           taper: o.taper ?? 0.4, render: o.render || "cards", density: o.density ?? 80, color: o.color || null, mirror_of: null };
}
// a bundle line: a line drawn along the scalp is the bundle's diameter (its width across the root, the root in its
// middle), gathered to a third at the tip
export function makeBundleLine(rootLine, tip, col, o = {}) {
  const a = rootLine[0], b = rootLine[rootLine.length - 1], r = Math.max(0.003, len(sub(b, a)) / 2), mid = mix(a, b, 0.5);
  return makeBundle(col ? col.surface(mid) : mid, tip, col, Object.assign({ name: "bundle line", r0: r, r1: Math.max(0.002, r * 0.3), axis: norm(sub(b, a)) }, o));
}

// ---- the cover: the finishing helper -----------------------------------------------------------------------------------
// A parting along the head's middle (the seam, x = seam), hair over the gaps: each root a Y, up from the skin to the top
// of the hair over it (the fork: `over(p)` lifts a point onto the hair laid there), then out to both sides over the
// hair, `length` long: round the head to 80 degrees off the parting, then straight down. Two sheets a stretch of the
// parting (about 6 cm), so they follow the head; `cover` lays them over all the other hair.
//   scalpMidline(col, seam) -> the scalp's middle line, the front hairline to the nape, as points
//   partingCover(col, {seam, from, to, length, over}) -> the sheets (from, to: shares of the midline, front to nape)
export function scalpMidline(col, seam = 0, n = 241) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (-0.1 + 1.35 * i / (n - 1)) * Math.PI, p = col.surface(add(col.C, [seam, 0.1 * Math.sin(a), 0.1 * Math.cos(a)]));
    if (onScalp(p, col.C)) out.push(p); else if (out.length) break;
  }
  return out;
}
const ARM_TURN = 80 * Math.PI / 180;
function yArm(col, root, side, L, over, n = 10) {
  const lift = q => over ? over(col.push(q, GAP)[0]) : col.push(q, GAP)[0];
  const fork = lift(add(root, mul(col.normal(root), GAP))), d0 = col.normal(fork);
  let sw = sub([side, 0, 0], mul(d0, dot([side, 0, 0], d0))); sw = norm(sw);
  const round = a => { const d = norm(add(mul(d0, Math.cos(a)), mul(sw, Math.sin(a)))); return add(col.C, mul(d, col.radius(d) + GAP)); };
  const R0 = len(sub(fork, col.C)), turn = Math.min(ARM_TURN, L / R0), side80 = round(turn), pts = [root, fork];
  for (let i = 1; i <= n - 2; i++) {
    const s = L * i / (n - 2);
    pts.push(lift(s <= turn * R0 ? round(s / R0) : add(side80, [0, -(s - turn * R0), 0])));
  }
  return pts;
}
export function partingCover(col, o = {}) {
  const line = scalpMidline(col, o.seam ?? 0); if (line.length < 2) return [];
  const total = length(line), a = clamp(o.from ?? 0.1, 0, 1), b = clamp(o.to ?? 0.6, 0, 1), L = o.length ?? 0.2;
  if ((b - a) * total < 0.01) return [];
  const segs = Math.max(1, Math.round((b - a) * total / 0.06)), out = [];
  for (let k = 0; k < segs; k++) {
    const f0 = a + (b - a) * k / segs, f1 = a + (b - a) * (k + 1) / segs, root = Array.from({ length: 7 }, (_, i) => along(line, f0 + (f1 - f0) * i / 6));
    const guides = clamp(Math.round(length(root) / 0.008) + 1, 3, 10);
    for (const side of [1, -1]) out.push({ id: newId(), type: "sheet", name: `cover ${k + 1} ${side > 0 ? "left" : "right"}`, group: o.group || "g1", visible: true, cover: true,
      root: root.map(p => p.slice()), edges: [0, 3, 6].map(i => yArm(col, root[i], side, L, o.over)), guides, taper: 0.3, render: "cards", density: 80, color: null, mirror_of: null });
  }
  return out;
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

// every point but the root kept off the body; with layers, lifted over the hair laid below, the lift spread along the
// lock (each point at least its neighbour's lift less DRAPE per metre along) so it drapes over instead of stepping up
const DRAPE = 0.6;
function keepOff(pts, col, layers = null) {
  if (!col) return pts;
  const P = pts.map((p, i) => i === 0 ? p : col.push(p, GAP)[0]);
  if (!layers) return P;
  const lift = P.map((p, i) => i === 0 ? 0 : len(sub(layers.push(p), p)));
  if (!lift.some(x => x > 0)) return P;
  const seg = P.map((p, i) => i ? len(sub(p, P[i - 1])) : 0);
  for (let i = 2; i < P.length; i++) lift[i] = Math.max(lift[i], lift[i - 1] - DRAPE * seg[i]);
  for (let i = P.length - 2; i >= 1; i--) lift[i] = Math.max(lift[i], lift[i + 1] - DRAPE * seg[i + 1]);
  return P.map((p, i) => i === 0 || !lift[i] ? p : col.push(add(p, mul(norm(sub(p, layers.C)), lift[i])), GAP)[0]);
}

// ---- layer by height --------------------------------------------------------------------------------------------------
// Real hair: what grows higher lies over what grows lower. The locks are laid lowest root first; each is pushed out of a
// map of the hair already laid (round the skull's middle, 2.5 degrees a bin: how far out the hair reaches that way),
// then adds to it what of it lies on the head: at each point along the lock, if its lowest guide is within `lie` of
// where it would rest (on the skin, or on the hair below), the points there no further out than the lock's own
// thickness count (a bundle's top over its bottom: guides.thick, by sample; a sheet's edge lifted off the cheek
// doesn't); where it stands off (pulled out, poking) or hangs below the head, nothing counts, so hair laid later passes
// under a poke instead of being lifted along it. Only the head is layered (above the chin).
export const rootHeight = l => l.type === "strand" ? l.pts[0][1] : l.type === "bundle" ? l.spine[0][1] : l.root.reduce((a, p) => a + p[1], 0) / l.root.length;
export class Layers {
  constructor(col, opts = {}) { this.col = col; this.C = col.C; this.R = new Float32Array(EL * AZ); this.thick = opts.thick ?? 0.002; this.gap = opts.gap ?? 0.0015; this.lie = opts.lie ?? 0.008; }
  bin(d, r) { const e = Math.asin(clamp(d[1] / r, -1, 1)), a = Math.atan2(d[0], d[2]); return [(e + Math.PI / 2) / Math.PI * (EL - 1), (a + Math.PI) / (2 * Math.PI) * AZ]; }
  splat(p) {
    const d = sub(p, this.C), r = len(d); if (r < 1e-6) return;
    const [e, a] = this.bin(d, r), e0 = Math.round(e), a0 = Math.round(a), rr = r + this.thick;
    for (let de = -1; de <= 1; de++) for (let da = -1; da <= 1; da++) {
      const ee = e0 + de; if (ee < 0 || ee >= EL) continue;
      const k = ee * AZ + (((a0 + da) % AZ) + AZ) % AZ; if (rr > this.R[k]) this.R[k] = rr;
    }
  }
  // how far p stands off where it would rest (the skin, or the hair laid so far); Infinity off the head
  standoff(p) {
    if (p[1] < this.col.chin - 0.03) return Infinity;
    const d = sub(p, this.C), R = this.col.radius(d); if (!(R > 0)) return Infinity;
    const H = this.radius(d);
    return len(d) - Math.max(R + GAP, H > 0 ? H + this.gap : 0);
  }
  add(guides) {
    if (!guides.length) return;
    const n = guides[0].pts.length, T = guides.thick, keep = [];     // decided first: a lock doesn't lie on itself
    for (let k = 1; k < n; k++) {
      const row = []; let low = Infinity;
      for (const G of guides) {
        if (!G.pts[k]) continue; const p = G.pts[k], h = mul(G.across[k], G.width[k] / 2);
        for (const q of [p, add(p, h), sub(p, h)]) { const s = this.standoff(q); row.push([q, s]); low = Math.min(low, s); }
      }
      if (low >= this.lie) continue;
      const most = low + this.lie + (T ? T[k] : 0);
      for (const [q, s] of row) if (s < most) keep.push(q);
    }
    for (const p of keep) this.splat(p);
  }
  radius(d) {                                                        // the hair laid so far, this way (0: none)
    const r = len(d) || 1e-9, [e, a] = this.bin(d, r), e0 = Math.floor(e), a0 = Math.floor(a), fe = e - e0, fa = a - a0;
    const at = (i, j) => this.R[clamp(i, 0, EL - 1) * AZ + ((j % AZ) + AZ) % AZ];
    const v = [at(e0, a0), at(e0, a0 + 1), at(e0 + 1, a0), at(e0 + 1, a0 + 1)], w = [(1 - fe) * (1 - fa), (1 - fe) * fa, fe * (1 - fa), fe * fa];
    let s = 0, m = 0; for (let i = 0; i < 4; i++) if (v[i] > 0) { s += v[i] * w[i]; m += w[i]; }
    return m > 0.3 ? s / m : 0;                                      // only where the hair below really is
  }
  push(p) {
    if (p[1] < this.col.chin - 0.03) return p;
    const d = sub(p, this.C), r = len(d), R = this.radius(d);
    return R > 0 && r < R + this.gap ? add(this.C, mul(d, (R + this.gap) / (r || 1e-9))) : p;
  }
}
// how deep in the hair a point is: the hair's outer surface round the skull's middle (every guide point and card edge
// shown, 2.5 degrees a bin, bilinear), and a point's distance under it. The shader shades by it (the hair over a point
// shadows it), so the outermost hair is lit however close to the skin it lies; under the chin, the distance off the body.
export class Envelope {
  constructor(col) { this.col = col; this.C = col.C; this.R = new Float32Array(EL * AZ); }
  add(guides) {
    for (const G of guides) G.pts.forEach((p, k) => { const h = mul(G.across[k], G.width[k] / 2); for (const q of [p, add(p, h), sub(p, h)]) this.splat(q); });
  }
  splat(p) {
    const d = sub(p, this.C), r = len(d); if (r < 1e-6 || p[1] < this.col.chin - 0.03) return;
    const e = Math.asin(clamp(d[1] / r, -1, 1)), a = Math.atan2(d[0], d[2]), e0 = Math.round((e + Math.PI / 2) / Math.PI * (EL - 1)), a0 = Math.round((a + Math.PI) / (2 * Math.PI) * AZ);
    for (let de = -1; de <= 1; de++) for (let da = -1; da <= 1; da++) { const ee = e0 + de; if (ee < 0 || ee >= EL) continue; const k = ee * AZ + (((a0 + da) % AZ) + AZ) % AZ; if (r > this.R[k]) this.R[k] = r; }
  }
  under(p) {                                                         // m under the outer surface (or off the body, low down)
    if (p[1] < this.col.chin - 0.03) return Math.max(0, 0.028 - this.col.depth(p));
    const d = sub(p, this.C), r = len(d) || 1e-9, e = (Math.asin(clamp(d[1] / r, -1, 1)) + Math.PI / 2) / Math.PI * (EL - 1), a = (Math.atan2(d[0], d[2]) + Math.PI) / (2 * Math.PI) * AZ;
    const e0 = Math.floor(e), a0 = Math.floor(a), fe = e - e0, fa = a - a0, at = (i, j) => this.R[clamp(i, 0, EL - 1) * AZ + ((j % AZ) + AZ) % AZ];
    const R = (at(e0, a0) * (1 - fa) + at(e0, a0 + 1) * fa) * (1 - fe) + (at(e0 + 1, a0) * (1 - fa) + at(e0 + 1, a0 + 1) * fa) * fe;
    return Math.max(0, R - r);
  }
}
function sideways(pts, col, k) {                                     // a ribbon lying flat on the hair's surface
  const i0 = Math.max(0, k - 1), i1 = Math.min(pts.length - 1, k + 1), t = norm(sub(pts[i1], pts[i0]));
  const out = col ? col.normal(pts[k]) : [0, 0, 1];
  let a = cross(t, out); if (len(a) < 1e-4) a = cross(t, [1, 0, 0]);
  return norm(a);
}

// ---- the roots ------------------------------------------------------------------------------------------------------
// Hair comes out of the head: a guide leaves the scalp `lift` degrees off it, the way the hair goes, and bends over into
// the rest of the lock within `length` (a Hermite curve from the root to the guide there), each guide a little its own
// (`vary`: its lift and its way, either side). Applied once the lock is kept off the body and laid over the hair below,
// and to whatever pose physics or gravity gives it, so neither changes how hair comes out of the head, and a root under
// other hair rises through it instead of standing straight up to it. setRoots() sets them for every lock.
export const ROOTS = { lift: 40, length: 0.02, vary: 0.4 };
export function setRoots(o) { Object.assign(ROOTS, o || {}); }
export const seedOf = id => [...String(id || "")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
export function rootBend(pts, col, r = Math.random, R = ROOTS) {
  const n = pts.length; if (!col || !(R.lift > 0) || !(R.length > 0) || n < 5) return pts;
  const s = [0]; for (let k = 1; k < n; k++) s.push(s[k - 1] + len(sub(pts[k], pts[k - 1])));
  const Lr = Math.min(R.length, 0.3 * s[n - 1]); let j = 2; while (j < n - 2 && s[j] < Lr) j++;
  const P0 = pts[0], P1 = pts[j], n0 = col.normal(P0), T1 = norm(sub(pts[j + 1], pts[j - 1]));
  const flat = v => sub(v, mul(n0, dot(v, n0)));
  let f = flat(sub(P1, P0)); if (len(f) < 1e-4) f = flat(sub(pts[Math.min(n - 1, j + 3)], P0)); if (len(f) < 1e-6) f = cross(n0, [1, 0, 0]); f = norm(f);
  const v = R.vary || 0, tw = v * 0.35 * (r() * 2 - 1), lift = R.lift * Math.PI / 180 * (1 + v * 0.5 * (r() * 2 - 1));
  f = norm(add(mul(f, Math.cos(tw)), mul(cross(n0, f), Math.sin(tw))));
  const e = norm(add(mul(n0, Math.sin(lift)), mul(f, Math.cos(lift)))), D = len(sub(P1, P0)) * 1.3, m0 = mul(e, D), m1 = mul(T1, D), out = pts.slice();
  for (let k = 1; k < j; k++) {
    const t = s[k] / s[j], t2 = t * t, t3 = t2 * t;
    out[k] = col.push(add(add(mul(P0, 2 * t3 - 3 * t2 + 1), mul(m0, t3 - 2 * t2 + t)), add(mul(P1, -2 * t3 + 3 * t2), mul(m1, t3 - t2))), GAP)[0];
  }
  return out;
}

// thickness (strands and sheets): a dome over the lock, a half-ellipse across it as high as `thickness` times half its
// width (1: round), thinning towards the tip by `thicknessTaper` (1: to nothing); its guides follow the arc from one
// edge over the top to the other, outward from the head. Each guide carries u, where it is across the lock (0 to 1),
// and guides.thick the dome's height (the layer it makes).
function thicken(lock, base, col) {
  const T = lock.thickness || 0; if (!(T > 0)) return base;
  const n = base[0].pts.length, one = base.length === 1, m = one ? 3 : clamp(base.length - 1, 3, 8), tt = lock.thicknessTaper ?? 1;
  const edge = (k, side) => one ? add(base[0].pts[k], mul(base[0].across[k], side * base[0].width[k] / 2)) : base[side < 0 ? 0 : base.length - 1].pts[k];
  const at = (k, u) => { if (one) return mix(edge(k, -1), edge(k, 1), u); const x = u * (base.length - 1), j = Math.min(base.length - 2, Math.floor(x)); return mix(base[j].pts[k], base[j + 1].pts[k], x - j); };
  const fr = [], H = [];
  for (let k = 0; k < n; k++) {
    const L = edge(k, -1), R = edge(k, 1), w = len(sub(R, L)), a = w > 1e-6 ? mul(sub(R, L), 1 / w) : base[0].across[k];
    let up = col ? col.normal(mix(L, R, 0.5)) : [0, 0, 1]; up = sub(up, mul(a, dot(up, a))); up = len(up) > 1e-4 ? norm(up) : norm(cross(a, [1, 0, 0]));
    fr.push([a, up, w]); H.push(T * w / 2 * (1 - tt * TS[k]));
  }
  const dome = [];
  for (let i = 0; i < m; i++) {
    const phi = Math.PI * (i + 0.5) / m, u = (1 + Math.cos(phi)) / 2, c = Math.cos(phi), sn = Math.sin(phi);
    const pts = keepOff(fr.map((_, k) => add(at(k, u), mul(fr[k][1], H[k] * sn))), col);
    dome.push({ pts, u, t: TS, across: fr.map(([a, up, w], k) => { const d = add(mul(a, -sn * w / 2), mul(up, c * H[k])); return len(d) > 1e-6 ? norm(d) : a; }),
                width: fr.map(([, , w], k) => Math.max(0.003, Math.hypot(sn * w / 2, c * H[k]) * Math.PI / m * 1.7) * (one ? 1 : 1 - lock.taper * Math.pow(TS[k], 1.5))) });
  }
  const out = [...base, ...dome]; out.thick = H;
  return out;
}

export function evaluate(lock, col, layers = null) {
  const taperW = (w, k) => w * (1 - lock.taper * Math.pow(TS[k], 1.5)), rr = rng(seedOf(lock.id));
  const lay = P => rootBend(keepOff(catmull(P, SAMPLES, WARP), col, layers), col, rr);   // a curve: sampled, kept off, its root bent
  if (lock.type === "strand") {
    const pts = lay(lock.pts);
    return thicken(lock, [{ pts, u: 0.5, t: TS, across: pts.map((_, k) => sideways(pts, col, k)), width: pts.map((_, k) => taperW(lock.width, k)) }], col);
  }
  if (lock.type === "sheet") {
    const g = Math.max(2, lock.guides | 0), [L, M, R] = lock.edges, n = L.length, guides = [];
    for (let j = 0; j < g; j++) {
      const u = j / (g - 1), root = along(lock.root, u);
      const C = L.map((_, k) => quad(L[k], M[k], R[k], u));
      const d = sub(root, C[0]);
      const ctrl = C.map((c, k) => add(c, mul(d, Math.pow(1 - k / (n - 1), 2))));
      ctrl[0] = root;
      guides.push(lay(ctrl));
    }
    // the ribbons' width: the gap to the neighbours, overlapped
    return thicken(lock, guides.map((pts, j) => {
      const nb = guides[j + 1] || guides[j - 1];
      return { pts, u: j / (g - 1), t: TS, across: pts.map((p, k) => { const a = sub(nb[k], p); return len(a) > 1e-5 ? norm(j + 1 < g ? a : mul(a, -1)) : sideways(pts, col, k); }),
               width: pts.map((p, k) => taperW(Math.max(0.004, len(sub(nb[k], p)) * 1.7), k)) };
    }), col);
  }
  // bundle: guides round the spine at the radius from root to tip
  const spine = lay(lock.spine), g = Math.max(3, lock.guides | 0), out = [];
  const frames = []; let b1 = null;
  for (let k = 0; k < spine.length; k++) {                           // a frame along the spine, carried (parallel transport)
    const t = norm(sub(spine[Math.min(spine.length - 1, k + 1)], spine[Math.max(0, k - 1)]));
    if (!b1) {                                                       // the width: the bundle line's line, or across on the scalp
      if (lock.axis) { b1 = sub(lock.axis, mul(t, dot(lock.axis, t))); if (len(b1) < 0.2) b1 = null; }
      if (!b1) { b1 = cross(t, col ? col.normal(spine[0]) : [0, 0, 1]); if (len(b1) < 1e-4) b1 = cross(t, [1, 0, 0]); }
    }
    b1 = norm(sub(b1, mul(t, dot(b1, t)))); frames.push([t, b1, cross(t, b1)]);
  }
  const h = lock.height ?? 1, rad = k => lock.r0 + (lock.r1 - lock.r0) * TS[k];
  for (let j = 0; j < g; j++) {                                      // round an ellipse: r across, r * height the other way
    const th = j / g * 2 * Math.PI, c = Math.cos(th), s = Math.sin(th), arc = Math.hypot(s, h * c);
    const pts = spine.map((p, k) => { const r = rad(k), [, u, v] = frames[k]; return add(p, add(mul(u, c * r), mul(v, s * r * h))); });
    const kept = keepOff(pts, col, layers);
    out.push({ pts: kept, t: TS, across: kept.map((_, k) => { const [, u, v] = frames[k]; return norm(add(mul(u, -s), mul(v, c * h))); }),
               width: kept.map((_, k) => { const f = TS[k]; return Math.max(0.003, 2 * Math.PI * rad(k) * arc / g * 1.8) * (1 - lock.taper * 0.3 * f); }) });
  }
  out.thick = spine.map((_, k) => 2 * rad(k) * Math.max(h, 1e-3));    // its depth across the scalp: the layer it makes
  return out;
}

// the realism option: thin strands spread through the lock (between its guides, jittered), as polylines
export function strandsOf(lock, guides, seed = 7) {
  const r = rng(seed + (lock.id ? [...String(lock.id)].reduce((a, c) => a + c.charCodeAt(0), 0) : 0)), out = [], N = Math.max(1, lock.density | 0);
  if (lock.type === "strand" && guides.length === 1) {
    const G = guides[0];
    for (let s = 0; s < N; s++) { const o = (r() - 0.5) * 2, w = r() * 0.6 + 0.4; out.push(G.pts.map((p, k) => add(p, mul(G.across[k], o * G.width[k] * 0.5 * w)))); }
    return out;
  }
  if (lock.type === "sheet" || lock.type === "strand") {                // a thick one too: round its guides, base and dome
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
  else if (m.type === "bundle") { m.spine = m.spine.map(R); if (col) m.spine[0] = col.surface(m.spine[0]); if (m.axis) m.axis = [-m.axis[0], m.axis[1], m.axis[2]]; }
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

// ---- pulling a handle: Blender's proportional editing ------------------------------------------------------------------
// After Blender's transform (calculatePropRatio in source/blender/editors/transform/transform_generics.cc and the
// PROPSIZE keys in transform.cc; GPL, the curves and the rules ported, no code copied). Every handle within `size` of
// the one taken moves by the pull times a weight that falls off with its distance; the one taken moves the whole way,
// the ones beyond `size` not at all. Like Blender's, it's measured from where the handles were when the drag began, so
// growing or shrinking the reach mid-drag (the wheel: 1.1 a notch, 1.01 with Shift) re-weighs them all.
//   d = (size - r) / size, r the distance from the handle taken
export const FALLOFFS = {
  smooth: d => Math.min(1, 3 * d * d - 2 * d * d * d), sphere: d => Math.sqrt(Math.max(0, 2 * d - d * d)), root: d => Math.sqrt(d),
  inverse_square: d => d * (2 - d), sharp: d => d * d, linear: d => d, constant: () => 1,
};
export function falloff(r, size, kind = "smooth") { if (!(size > 0) || r > size) return 0; return (FALLOFFS[kind] || FALLOFFS.smooth)((size - r) / size); }
export const growReach = (size, up, fine = false) => { const k = fine ? 1.01 : 1.1; return Math.max(0.002, Math.min(0.5, up ? size * k : size / k)); };

// every lock's handles where they are now (the drag's start)
export function pullStart(locks) {
  const s = {}; for (const l of locks) s[l.id] = handles(l).map(h => ({ path: h.path, key: h.path.join(), p: h.p.slice(), root: h.root }));
  return s;
}
// how much each handle shown moves for a pull from c: [{id, key, p, w}] (the handle taken w 1)
export function pullWeights(start, grab, c, o = {}) {
  const out = [], size = o.size ?? 0.05;
  for (const id of o.ids || Object.keys(start)) {
    if (o.only && id !== grab.id) continue;
    for (const h of start[id] || []) {
      if (h.root) continue;
      const w = id === grab.id && h.key === grab.path.join() ? 1 : falloff(len(sub(h.p, c)), size, o.falloff);
      if (w > 0) out.push({ id, key: h.key, path: h.path, p: h.p, w });
    }
  }
  return out;
}
// pull the handle grab = {id, path} to `to`: every lock's handles set from the start, the pull weighted onto those in
// reach (o: size, falloff, only: just the lock taken, ids: the locks shown, seam, col). A twin's handles move its
// original's, mirrored (the twin follows); an original seen both ways (itself and its twin, near the seam) takes the two
// pulls blended by their weights, never more than the stronger. Roots stay. Returns the ids of the locks moved.
export function pull(locks, start, grab, to, o = {}) {
  const byId = Object.fromEntries(locks.map(l => [l.id, l])), seam = o.seam ?? 0;
  const g = (start[grab.id] || []).find(h => h.key === grab.path.join()); if (!g) return [];
  const d = sub(to, g.p), dm = [-d[0], d[1], d[2]];
  const owner = l => l.mirror_of && byId[l.mirror_of] ? byId[l.mirror_of] : l;
  const acc = new Map();                                   // "id|key" -> {wd, wm}
  for (const x of pullWeights(start, grab, g.p, o)) {
    const l = byId[x.id]; if (!l) continue;
    const T = owner(l), k = T.id + "|" + x.key, a = acc.get(k) || { id: T.id, path: x.path, wd: 0, wm: 0 };
    if (T === l) a.wd = Math.max(a.wd, x.w); else a.wm = Math.max(a.wm, x.w);
    acc.set(k, a);
  }
  const G = owner(byId[grab.id]), gk = G.id + "|" + g.key;
  const moved = new Set();
  for (const l of locks) {                                  // back to the start (a reach shrunk mid-drag lets go)
    if (l.mirror_of && byId[l.mirror_of]) continue;
    for (const h of start[l.id] || []) if (!h.root) setHandle(l, h.path, h.p.slice());
  }
  for (const [k, a] of acc) {
    const T = byId[a.id], s0 = start[a.id].find(h => h.key === a.path.join()); if (!s0) continue;
    let v;
    if (k === gk) v = G === byId[grab.id] ? d : dm;           // the handle taken lands under the cursor
    else { const w = Math.max(a.wd, a.wm), t = a.wd + a.wm; v = add(mul(d, a.wd * w / t), mul(dm, a.wm * w / t)); }
    let q = add(s0.p, v); if (o.col) q = o.col.push(q, GAP)[0];
    setHandle(T, a.path, q); moved.add(a.id);
  }
  return [...moved];
}
export function moveLock(lock, d) {
  const T = p => add(p, d);
  if (lock.type === "strand") lock.pts = lock.pts.map(T);
  else if (lock.type === "bundle") lock.spine = lock.spine.map(T);
  else { lock.root = lock.root.map(T); lock.edges = lock.edges.map(E => E.map(T)); }
}

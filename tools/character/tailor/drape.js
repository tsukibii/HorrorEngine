// The drape: a garment hung on the body by gravity, so it falls into folds instead of floating round the body the way
// it was cut (DECISIONS 2026-10-26: the cloth is simulated and baked). Position-based cloth in small steps (XPBD,
// Macklin et al. 2019, "Small Steps in Physics Simulation": a pass or two a step, many steps): every edge keeps its
// length (stiff when pulled, soft when pushed: cloth buckles rather than shrinks), every two triangles resist bending
// away from flat (quadratic bending, Bergou et al. 2006: fabric is flat before it's sewn), gravity, the skin and the
// clothes already worn keep it out (each point's plane at its closest skin, asked again as the point moves; the layers
// under it raise that plane), friction where it touches, held where the garment holds (a waistband, a skirt's waist, a
// neckline, cuffs and ribbed bands, under what it's tucked into; a buttoned front kept closed).
// No point ends further from where the garment hangs from than the cloth between them reaches (long range
// attachments, Kim et al. 2012), so it hangs without stretching. `slack` is cloth cut fuller round the body than the
// body is (a straight shirt over a narrow waist): the extra falls into folds. Units are real (metres, kilograms,
// seconds), so a fabric's weight and stiffness mean what they say. Plain typed arrays: the Studio's worker and node.
import { normals, adjacency, boundaryLoops, smooth, clamp } from "./mesh.js";

/** the settings a garment drapes with (its piece's `drape` and the garment's own edits are laid over these) */
export const DRAPE = {
  time: 1.2,          // seconds of falling and settling (it stops sooner once nothing moves)
  sub: 600,           // steps a second
  iters: 2,           // passes over the lengths a step (plain Gauss-Seidel: over-relaxing them grows the round-off without end)
  gravity: 9.81,
  density: 0.2,       // kg per square metre (a t-shirt's jersey 0.18, denim 0.4)
  bend: 6e-6,         // bending stiffness, N m (silk 1e-6, jersey 5e-6, shirting 8e-6, denim 3e-5), but never stiffer in a step
                      // than the points it moves are heavy: a stiffer bend after the lengths, its push carried on as speed,
                      // grows the round-off into a buzz that never settles (a skirt's 5 mm wool), so it's held to that
  compress: 0.5,      // how much an edge resists being pushed shorter, against being pulled longer (1): cloth folds rather than shrinks
  damp: 4,            // air and the cloth's own damping, per second
  friction: 0.5,      // against the skin and the clothes under it
  slack: 0,           // fabric round the body beyond the cut's (0.2: a fifth more), falling into folds
  drop: 0,            // fabric along the body beyond the cut's: sleeves and legs bunch where they're stopped
  memory: 0,          // how much the cloth keeps the shape it was cut in (pressed pleats: 1), against lying flat
  gap: 0.0005,        // between the cloth's inside and what it lies on
};

/** the cloth's edges, and for every edge two triangles share the four points that bend about it */
function topology(n, T) {
  const at = new Map(), A = [], B = [], O1 = [], O2 = [];
  for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = T[t + k], b = T[t + (k + 1) % 3], c = T[t + (k + 2) % 3], key = a < b ? a * n + b : b * n + a, e = at.get(key);
    if (e === undefined) { at.set(key, A.length); A.push(a); B.push(b); O1.push(c); O2.push(-1); }
    else O2[e] = c;
  }
  return { A: Uint32Array.from(A), B: Uint32Array.from(B), O1: Int32Array.from(O1), O2: Int32Array.from(O2) };
}

const cot = (P, o, a, b) => {                       // the cotangent of the angle at o between o->a and o->b
  const ux = P[a * 3] - P[o * 3], uy = P[a * 3 + 1] - P[o * 3 + 1], uz = P[a * 3 + 2] - P[o * 3 + 2];
  const vx = P[b * 3] - P[o * 3], vy = P[b * 3 + 1] - P[o * 3 + 1], vz = P[b * 3 + 2] - P[o * 3 + 2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  return (ux * vx + uy * vy + uz * vz) / Math.max(1e-12, Math.hypot(cx, cy, cz));
};
const area = (P, a, b, c) => {
  const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
  const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
  return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
};

/** how far the clothes already worn stand off each skin point (their outsides' distance from it and their thickness),
    spread so the next layer rides over their edges: as the cut measures them (pieces.js layers), so a garment cut over
    them starts above the floor its drape gives it; `under`: [{outer: [{P, T}], thickness}] */
export function underHeights(B, under) {
  const n = B.P.length / 3, H = new Float32Array(n);
  if (!under || !under.length) return H;
  const hit = {};
  for (const g of under) for (const o of g.outer) for (let i = 0; i < o.P.length; i += 3) {
    const r = B.surf.closest(o.P[i], o.P[i + 1], o.P[i + 2], 0.08, hit); if (!r || r.d <= 0) continue;
    H[r.v] = Math.max(H[r.v], r.d + (g.thickness || 0.002));
  }
  const adj = B.adj || (B.adj = adjacency(n, B.T));
  const spread = (k, fn) => { for (let it = 0; it < k; it++) { const c = Float32Array.from(H); for (let i = 0; i < n; i++) { let m = c[i], s = c[i], cnt = 1; for (let q = adj.start[i]; q < adj.start[i + 1]; q++) { const v = c[adj.list[q]]; m = Math.max(m, v); s += v; cnt++; } H[i] = fn(c[i], m, s / cnt); } } };
  spread(1, (c, m) => m);                                            // close the holes between the garments' points
  spread(2, (c, m, a) => a);                                         // and soften its edges
  return H;
}

/** how firmly each point is held where it is (over a half: it stays as cut): a bottom by its waistband, a skirt by
    its waist, a top round its neckline (the band there keeps it round, or it would sag into a V) and where it's tucked
    into what goes over it (`tuck`: how far under that waist a point is), straight legs from under the seat down, its sleeves inside the sleeves over it (`cover`:
    how far down each arm they reach, {L, R}); `bands`: held under its bands (tailor.js) */
export function holds(F, G, p, tuck = null, bands = null, cover = null) {
  const s = F.s, P = G.outer.P, n = P.length / 3, H = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (G.rings) H[i] = 1 - smooth(0.012 * s, 0.045 * s, G.rings.y0 - y);
    else if (G.waist && p.neck === false) H[i] = 1 - smooth(0.012 * s, 0.045 * s, G.waist(x, y, z));
    else if (G.neck) H[i] = 1 - smooth(0.006 * s, 0.024 * s, G.neck(x, y, z));
    if (tuck && !G.rings && !F.arm(x, y, z)) H[i] = Math.max(H[i], smooth(-0.03 * s, -0.005 * s, tuck(x, y, z)));
    const a = cover && !G.rings ? F.arm(x, y, z) : null;
    if (a) H[i] = Math.max(H[i], smooth(-0.03 * s, -0.005 * s, cover[a.side] - a.t));
    if (bands) H[i] = Math.max(H[i], bands[i]);
    if (p.legs && p.legs.straight > 0 && !G.rings && y < F.crotchY && !F.arm(x, y, z)) H[i] = Math.max(H[i], 1 - smooth(F.crotchY - 0.16 * s, F.crotchY - 0.06 * s, y));   // straight legs (wide pressed trousers) hang as cut: a stiff column from under the seat, never settling onto the knee
  }
  return H;
}

/** the pairs of points either side of a front opening where it's buttoned (`closed`: [low, high]), kept as close as
    they were cut: {A, B, L} */
function closures(F, G, closed) {
  const P = G.outer.P, s = F.s, O = G.open, A = [], Bv = [], L = [];
  if (!O || !closed) return { A, B: Bv, L };
  const edge = [];
  for (const loop of boundaryLoops(G.outer.T)) for (const i of loop) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (y >= closed[0] && y <= closed[1] && z > F.torsoAxis(y)[1] && Math.abs(O.value(x, y, z)) < 0.002 * s) edge.push(i);
  }
  const left = edge.filter(i => P[i * 3] > F.torsoAxis(P[i * 3 + 1])[0]), right = edge.filter(i => P[i * 3] <= F.torsoAxis(P[i * 3 + 1])[0]);
  for (const i of left) {
    let best = -1, bd = (0.01 * s) ** 2;
    for (const j of right) { const d = (P[j * 3] - P[i * 3]) ** 2 + (P[j * 3 + 1] - P[i * 3 + 1]) ** 2 + (P[j * 3 + 2] - P[i * 3 + 2]) ** 2; if (d < bd) { bd = d; best = j; } }
    if (best >= 0) { A.push(i); Bv.push(best); L.push(Math.sqrt(bd)); }
  }
  return { A: Uint32Array.from(A), B: Uint32Array.from(Bv), L: Float64Array.from(L) };
}

/** where a garment is cut loose (1) or fitted (0): a top under its bust, a bottom down its legs under the seat, a
    skirt under the hips. Never a sleeve: its ease makes it loose, and between its shoulder and a cuff that holds, more
    cloth only buckles, creeping on for as long as the drape runs */
export function fullness(F, G, p) {
  const s = F.s, P = G.outer.P, n = P.length / 3, out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (G.rings) { out[i] = 1 - smooth(F.hipY - 0.06 * s, F.hipY + 0.02 * s, y); continue; }
    if (F.arm(x, y, z)) continue;
    if (p.neck === false) out[i] = 1 - smooth(F.crotchY - 0.04 * s, F.hipY, y);
    else out[i] = 1 - smooth(F.bustY - 0.1 * s, F.bustY - 0.01 * s, y);
  }
  return out;
}

/** the cut's small pieces that nothing holds (under a fiftieth of its points, apart from the rest: a sliver where an
    opening meets a hem), each as its points */
function loose(n, T, hold) {
  const par = Int32Array.from({ length: n }, (_, i) => i), find = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
  for (let t = 0; t < T.length; t += 3) { const a = find(T[t]); par[find(T[t + 1])] = a; par[find(T[t + 2])] = a; }
  const pieces = new Map();
  for (let i = 0; i < n; i++) { const r = find(i); (pieces.get(r) || pieces.set(r, []).get(r)).push(i); }
  return [...pieces.values()].filter(q => q.length < n / 50 && !q.some(i => hold[i] > 0.5));
}

/** each point's nearest point to hang from (`from`: where it's held, or the tops of the shoulders) by the cloth's own lengths, and how far
    that is along it (Dijkstra from all of them at once): {A (that point, -1 for none), D} */
function tethers(n, EA, EB, L0, from) {
  const D = new Float64Array(n).fill(Infinity), A = new Int32Array(n).fill(-1), start = new Uint32Array(n + 1);
  for (let e = 0; e < EA.length; e++) { start[EA[e] + 1]++; start[EB[e] + 1]++; }
  for (let i = 0; i < n; i++) start[i + 1] += start[i];
  const nb = new Uint32Array(start[n]), len = new Float64Array(start[n]), fill = start.slice(0, n);
  for (let e = 0; e < EA.length; e++) { const a = EA[e], b = EB[e]; nb[fill[a]] = b; len[fill[a]++] = L0[e]; nb[fill[b]] = a; len[fill[b]++] = L0[e]; }
  const heap = [], push = (d, i) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  for (let i = 0; i < n; i++) if (from[i]) { D[i] = 0; A[i] = i; push(0, i); }
  while (heap.length) {
    const [d, i] = pop(); if (d > D[i]) continue;
    for (let q = start[i]; q < start[i + 1]; q++) { const j = nb[q], dj = d + len[q]; if (dj < D[j]) { D[j] = dj; A[j] = A[i]; push(dj, j); } }
  }
  return { A, D };
}

// ---- the step's passes: plain functions over typed arrays, so the engine keeps them fast ----------------------------

/** each point's velocity from how far it moved last step (out: the fastest and the root mean square), then its next
    place: damped, with gravity */
export function predict(X, Xp, W, n, g, damp, h, out) {
  let fast = 0, sum = 0; const ih = 1 / h;
  for (let i = 0; i < n; i++) {
    const i3 = i * 3, x = X[i3], y = X[i3 + 1], z = X[i3 + 2];
    let vx = (x - Xp[i3]) * ih, vy = (y - Xp[i3 + 1]) * ih, vz = (z - Xp[i3 + 2]) * ih;
    const v2 = vx * vx + vy * vy + vz * vz; sum += v2; if (v2 > fast) fast = v2;
    Xp[i3] = x; Xp[i3 + 1] = y; Xp[i3 + 2] = z;
    if (W[i] === 0) continue;
    vx *= damp; vy = (vy - g) * damp; vz *= damp;
    X[i3] = x + vx * h; X[i3 + 1] = y + vy * h; X[i3 + 2] = z + vz * h;
  }
  out[0] = Math.sqrt(fast); out[1] = Math.sqrt(sum / n);
}

export function lengths(X, W, EA, EB, L0, ne, cs) {
  for (let e = 0; e < ne; e++) {
    const a = EA[e], b = EB[e], a3 = a * 3, b3 = b * 3, dx = X[b3] - X[a3], dy = X[b3 + 1] - X[a3 + 1], dz = X[b3 + 2] - X[a3 + 2];
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz), wa = W[a], wb = W[b], ws = wa + wb;
    if (L < 1e-9 || ws === 0) continue;
    let C = L - L0[e]; if (C < 0) C *= cs;
    const k = C / (ws * L), ka = wa * k, kb = wb * k;
    X[a3] += ka * dx; X[a3 + 1] += ka * dy; X[a3 + 2] += ka * dz;
    X[b3] -= kb * dx; X[b3 + 1] -= kb * dy; X[b3 + 2] -= kb * dz;
  }
}

export function bends(X, W, bI, bK, bD, bC, nb) {
  for (let q = 0; q < nb; q++) {
    const q4 = q * 4, q3 = q * 3, a = bI[q4], b = bI[q4 + 1], c = bI[q4 + 2], d = bI[q4 + 3], i0 = a * 3, i1 = b * 3, i2 = c * 3, i3 = d * 3;
    const k0 = bK[q4], k1 = bK[q4 + 1], k2 = bK[q4 + 2], k3 = bK[q4 + 3];
    const cx = k0 * X[i0] + k1 * X[i1] + k2 * X[i2] + k3 * X[i3] - bC[q3];
    const cy = k0 * X[i0 + 1] + k1 * X[i1 + 1] + k2 * X[i2 + 1] + k3 * X[i3 + 1] - bC[q3 + 1];
    const cz = k0 * X[i0 + 2] + k1 * X[i1 + 2] + k2 * X[i2 + 2] + k3 * X[i3 + 2] - bC[q3 + 2];
    const s = bD[q], w0 = W[a] * k0 * s, w1 = W[b] * k1 * s, w2 = W[c] * k2 * s, w3 = W[d] * k3 * s;
    X[i0] -= w0 * cx; X[i0 + 1] -= w0 * cy; X[i0 + 2] -= w0 * cz;
    X[i1] -= w1 * cx; X[i1 + 1] -= w1 * cy; X[i1 + 2] -= w1 * cz;
    X[i2] -= w2 * cx; X[i2 + 1] -= w2 * cy; X[i2 + 2] -= w2 * cz;
    X[i3] -= w3 * cx; X[i3 + 1] -= w3 * cy; X[i3 + 2] -= w3 * cz;
  }
}

/** the buttoned pairs: pulled back to no further apart than they were cut (they may come closer) */
export function seams(X, W, SA, SB, SL, ns) {
  for (let q = 0; q < ns; q++) {
    const a = SA[q], b = SB[q], a3 = a * 3, b3 = b * 3, dx = X[b3] - X[a3], dy = X[b3 + 1] - X[a3 + 1], dz = X[b3 + 2] - X[a3 + 2];
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz), wa = W[a], wb = W[b], ws = wa + wb;
    if (L <= SL[q] || ws === 0) continue;
    const k = (L - SL[q]) / (ws * L), ka = wa * k, kb = wb * k;
    X[a3] += ka * dx; X[a3 + 1] += ka * dy; X[a3 + 2] += ka * dz;
    X[b3] -= kb * dx; X[b3 + 1] -= kb * dy; X[b3 + 2] -= kb * dz;
  }
}

export function tether(X, W, TA, TD, n) {
  for (let i = 0; i < n; i++) {
    const a = TA[i]; if (a < 0 || a === i || W[i] === 0) continue;
    const i3 = i * 3, a3 = a * 3, dx = X[i3] - X[a3], dy = X[i3 + 1] - X[a3 + 1], dz = X[i3 + 2] - X[a3 + 2], L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (L <= TD[i]) continue;
    const k = TD[i] / L;
    X[i3] = X[a3] + dx * k; X[i3 + 1] = X[a3 + 1] + dy * k; X[i3 + 2] = X[a3 + 2] + dz * k;
  }
}

/** the point's plane: its closest skin from where it is now (walked from the last, or searched where another limb is
    near), raised by the clothes under it; and how far it can move before it must ask again (half its way to that
    plane, at least `R`: a point a hand off the legs asks seldom) */
export function ask(c, i) {
  const X = c.X, x = X[i * 3], y = X[i * 3 + 1], z = X[i * 3 + 2], near = c.near[i];
  c.ASK[i * 3] = x; c.ASK[i * 3 + 1] = y; c.ASK[i * 3 + 2] = z;
  const r = c.surf.closest(x, y, z, c.reach, c.hit, near ? -1 : c.HINT[i]), R = near ? c.R / 4 : c.R;
  if (!r) { c.HAS[i] = 0; c.FREE[i] = Math.max(R, (c.reach - c.top) / 2) ** 2; return; }
  const T = c.surf.T, L = c.lift, floor = c.base + L[T[r.t]] * (1 - r.u - r.w) + L[T[r.t + 1]] * r.u + L[T[r.t + 2]] * r.w;   // the layers' height across the skin's triangle: a step there would make the point flip
  const p = i * 7, PL = c.PL;
  c.HAS[i] = 1; c.HINT[i] = r.v;
  PL[p] = r.x; PL[p + 1] = r.y; PL[p + 2] = r.z; PL[p + 3] = r.nx; PL[p + 4] = r.ny; PL[p + 5] = r.nz; PL[p + 6] = floor;
  c.FREE[i] = Math.max(R, (r.d - floor) / 2) ** 2;
}

export function collide(c, mu) {
  const X = c.X, Xp = c.Xp, W = c.W, PL = c.PL, ASK = c.ASK, HAS = c.HAS, FREE = c.FREE, n = c.n;
  let asked = 0;
  for (let i = 0; i < n; i++) {
    if (W[i] === 0) continue;
    const i3 = i * 3, ax = X[i3] - ASK[i3], ay = X[i3 + 1] - ASK[i3 + 1], az = X[i3 + 2] - ASK[i3 + 2];
    if (ax * ax + ay * ay + az * az > FREE[i]) { ask(c, i); asked++; }
    if (!HAS[i]) continue;
    const p = i * 7, nx = PL[p + 3], ny = PL[p + 4], nz = PL[p + 5];
    const d = (X[i3] - PL[p]) * nx + (X[i3 + 1] - PL[p + 1]) * ny + (X[i3 + 2] - PL[p + 2]) * nz - PL[p + 6];
    if (d >= 0) continue;
    X[i3] -= d * nx; X[i3 + 1] -= d * ny; X[i3 + 2] -= d * nz;
    // friction: the slide along the surface this step, held back by as much as it was pushed out times mu
    let tx = X[i3] - Xp[i3], ty = X[i3 + 1] - Xp[i3 + 1], tz = X[i3 + 2] - Xp[i3 + 2];
    const tn = tx * nx + ty * ny + tz * nz; tx -= tn * nx; ty -= tn * ny; tz -= tn * nz;
    const tl = Math.sqrt(tx * tx + ty * ty + tz * tz), stop = tl <= -mu * d ? 1 : (-mu * d) / tl;
    X[i3] -= tx * stop; X[i3 + 1] -= ty * stop; X[i3 + 2] -= tz * stop;
  }
  return asked;
}

/** a generator run to its end: what it returns */
export function run(it) { let r = it.next(); while (!r.done) r = it.next(); return r.value; }

/** drape() a step at a time: it yields how far through it is (0 to 1) every few dozen steps, so a worker can show it
    and drop it for a newer one between them; with `cfg.gpu` it first yields {gpu: its prepared state} and takes what's
    sent back in (drape_gpu.js's result) as the drape, or runs its own steps if nothing is (run() sends nothing) */
export const drape = (...a) => run(draping(...a));

/**
 * Hang a garment's outside (G.outer: the cut cloth) on the body B. `under`: the garments already worn, draped
 * ([{outer}]); `th`: this cloth's thickness; `cfg`: DRAPE's settings, and `baked`: the points of an earlier drape of the
 * same cut (taken as they are when they fit it). Returns {P (the draped points, as G.outer.P), stats}.
 */
export function* draping(B, G, p, cfg = {}, under = [], th = 0.002) {
  const S = prepare(B, G, p, cfg, under, th);
  if (S.done) return S.done;
  if (S.o.gpu) { const r = yield { gpu: S }; if (r) return r; }   // the steps on the card (drape_gpu.js, the worker's to run, asked by the
                                                                  // pages' "Use the GPU"): what it gives back, else the CPU's here
  const { o, n, X, Xp, W, E, ne, L0, bI, bK, bD, bC, nb, TT, SE, c, RF, steps, g, cs, iters, h } = S, speed = [0, 0];
  let step = 0, asked = 0;
  for (; step < steps; step++) {
    const late = step / steps, damp = Math.exp(-(o.damp + 30 * smooth(0.6, 1, late)) * h);   // settled harder at the end
    predict(X, Xp, W, n, g, damp, h, speed);
    if (late > 0.4 && speed[1] < 0.002 && speed[0] < 0.05) { X.set(Xp); break; }   // settled: on the whole under 2 mm a second
    // the bending in each pass with the lengths: once a step after them, the two undid each other into the speed and a
    // soft knit's sleeve never settled (LESSONS)
    for (let it = 0; it < iters; it++) { lengths(X, W, E.A, E.B, L0, ne, cs); seams(X, W, SE.A, SE.B, SE.L, SE.L.length); bends(X, W, bI, bK, bD, bC, nb); }
    tether(X, W, TT.A, TT.D, n);
    asked += collide(c, o.friction);
    if (RF) floorRings(X, W, n, RF, G.rings);
    if (step % 30 === 29) yield step / steps;
  }
  return finish(S, step, asked, speed);
}
/** a skirt never comes in past the legs' hull (unheld between the legs, its back buckled into the gap) */
export function floorRings(X, W, n, RF, rings) {
  for (let i = 0; i < n; i++) {
    if (W[i] === 0) continue;
    const dx = X[i * 3] - rings.cx, dz = X[i * 3 + 2] - rings.cz, d = Math.hypot(dx, dz), m = RF[i];
    if (d < m && d > 1e-6) { X[i * 3] = rings.cx + dx / d * m; X[i * 3 + 2] = rings.cz + dz / d * m; }
  }
}
/** how a drape came out (its points, the stretch, how far it fell, how still it is at the end) */
export function finish(S, step, asked, speed, extra = {}) {
  const { X, E, ne, L0, n, P0, nb, SE, t0 } = S;
  // how it came out: the stretch (edges of a millimetre and more against their lengths: the middle one, one in ten,
  // one in a hundred), how far it fell
  const r = [];
  for (let e = 0; e < ne; e++) { if (L0[e] < 0.001) continue; const a = E.A[e] * 3, b = E.B[e] * 3; r.push(Math.hypot(X[b] - X[a], X[b + 1] - X[a + 1], X[b + 2] - X[a + 2]) / L0[e]); }
  r.sort((a, b) => a - b);
  const q = f => +(r[Math.floor(f * (r.length - 1))] || 1).toFixed(4);
  let fell = 0; for (let i = 0; i < n; i++) fell = Math.max(fell, P0[i * 3 + 1] - X[i * 3 + 1]);
  return { P: Float32Array.from(X), stats: { points: n, edges: ne, bends: nb, buttoned: SE.L.length, steps: step, asked, stretch: { p50: q(0.5), p90: q(0.9), p99: q(0.99) }, fell: +fell.toFixed(4),
    moving: { max: +speed[0].toFixed(4), rms: +speed[1].toFixed(4) }, ms: Date.now() - t0, ...extra } };
}
/** everything a drape needs before its steps (the CPU's and the GPU's, drape_gpu.js): the cloth's masses, holds,
    lengths, bends, tethers and buttoned pairs, the planes it lies on; {done} for a bake taken as it is */
export function prepare(B, G, p, cfg = {}, under = [], th = 0.002) {
  const o = { ...DRAPE, ...cfg }, F = B.F, s = F.s, P0 = G.outer.P, T = G.outer.T, n = P0.length / 3, t0 = Date.now();
  if (o.baked && o.baked.length === P0.length) return { done: { P: Float32Array.from(o.baked), stats: { points: n, baked: true, ms: Date.now() - t0 } } };
  const X = Float64Array.from(P0), Xp = Float64Array.from(P0);
  const N0 = normals(P0, T), E = topology(n, T), ne = E.A.length;

  // masses from the area round each point; held points don't move
  const M = new Float64Array(n);
  for (let t = 0; t < T.length; t += 3) { const a = area(P0, T[t], T[t + 1], T[t + 2]) * o.density / 3; M[T[t]] += a; M[T[t + 1]] += a; M[T[t + 2]] += a; }
  const hold = holds(F, G, p, o.tuck, o.hold, o.cover), W = new Float64Array(n);
  for (const piece of loose(n, T, hold)) for (const i of piece) hold[i] = 1;   // a sliver the cut left alone: as cut (it would fall for ever)
  for (let i = 0; i < n; i++) W[i] = hold[i] > 0.5 || !(M[i] > 0) ? 0 : 1 / M[i];

  // which way is round the garment at each point (round an arm, elsewhere round the body: square to straight down)
  const round = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2], a = G.rings ? null : F.arm(x, y, z);
    const d = a ? a.A.line.dir(a.t) : [0, -1, 0];
    const nx = N0[i * 3], ny = N0[i * 3 + 1], nz = N0[i * 3 + 2], dn = d[0] * nx + d[1] * ny + d[2] * nz;
    let dx = d[0] - dn * nx, dy = d[1] - dn * ny, dz = d[2] - dn * nz; const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
    round[i * 3] = ny * dz - nz * dy; round[i * 3 + 1] = nz * dx - nx * dz; round[i * 3 + 2] = nx * dy - ny * dx;
  }
  // the edges from the top down: one pass carries the weight up to where it hangs from
  if (o.order !== false) {
    const top = e => Math.max(P0[E.A[e] * 3 + 1], P0[E.B[e] * 3 + 1]), idx = Array.from({ length: ne }, (_, e) => e).sort((a, b) => top(b) - top(a));
    for (const k of ["A", "B", "O1", "O2"]) E[k] = E[k].constructor.from(idx, e => E[k][e]);
  }
  // each edge's length: as cut, fuller round the body by `slack` and longer along it by `drop` where the garment is
  // cut loose (under a top's bust, down a bottom's legs) and isn't held
  const full = fullness(F, G, p), L0 = new Float64Array(ne);
  for (let e = 0; e < ne; e++) {
    const a = E.A[e], b = E.B[e], dx = P0[b * 3] - P0[a * 3], dy = P0[b * 3 + 1] - P0[a * 3 + 1], dz = P0[b * 3 + 2] - P0[a * 3 + 2], L = Math.hypot(dx, dy, dz) || 1e-9;
    const r = ((round[a * 3] + round[b * 3]) * dx + (round[a * 3 + 1] + round[b * 3 + 1]) * dy + (round[a * 3 + 2] + round[b * 3 + 2]) * dz) / (2 * L), r2 = r * r;
    const free = (1 - Math.max(hold[a], hold[b])) * Math.min(full[a], full[b]);
    L0[e] = L * (1 + free * (o.slack * r2 + o.drop * (1 - r2)));
  }
  // bending: the four points about each shared edge, their weights (cotangents), and the bend it keeps (memory)
  const h = 1 / o.sub, h2 = h * h, BI = [], BK = [], BD = [], BC = [];
  for (let e = 0; e < ne; e++) {
    const i3 = E.O2[e]; if (i3 < 0) continue;
    const i0 = E.A[e], i1 = E.B[e], i2 = E.O1[e];
    const c01 = cot(P0, i0, i1, i2), c02 = cot(P0, i0, i1, i3), c03 = cot(P0, i1, i0, i2), c04 = cot(P0, i1, i0, i3);
    const K = [c03 + c04, c01 + c02, -c01 - c03, -c02 - c04], A = area(P0, i0, i1, i2) + area(P0, i0, i1, i3);
    if (!(A > 1e-12) || K.some(k => !Number.isFinite(k) || Math.abs(k) > 50)) continue;   // a sliver: no bend worth keeping
    const w = [i0, i1, i2, i3].reduce((sum, v, k) => sum + W[v] * K[k] * K[k], 0); if (!(w > 0)) continue;
    const alpha = Math.max(A / (3 * o.bend) / h2 * o.iters, w);      // its compliance in each pass (the step's the material's), held to the points' own weight
    BI.push(i0, i1, i2, i3); BK.push(...K); BD.push(1 / (w + alpha));
    let cx = 0, cy = 0, cz = 0; [i0, i1, i2, i3].forEach((v, k) => { cx += K[k] * P0[v * 3]; cy += K[k] * P0[v * 3 + 1]; cz += K[k] * P0[v * 3 + 2]; });
    BC.push(cx * o.memory, cy * o.memory, cz * o.memory);
  }
  const bI = Uint32Array.from(BI), bK = Float64Array.from(BK), bD = Float64Array.from(BD), bC = Float64Array.from(BC), nb = bD.length;
  // what it hangs from: where it's held, else the tops of the shoulders (and round the neck); each point's tether to
  // the nearest
  const from = new Uint8Array(n); let anyHeld = false;
  for (let i = 0; i < n; i++) if (W[i] === 0) { from[i] = 1; anyHeld = true; }
  if (!anyHeld) for (let i = 0; i < n; i++) if (P0[i * 3 + 1] > F.neckBaseY - (o.shoulders ?? 0.05) * s && !F.arm(P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2])) from[i] = 1;
  const TT = tethers(n, E.A, E.B, L0, from), SE = closures(F, G, o.closed);

  // what it lies on: the skin, raised by the clothes under it, a plane per point at its closest skin
  const lift = underHeights(B, under), base = th + o.gap * s; let top = base; for (let i = 0; i < lift.length; i++) top = Math.max(top, base + lift[i]);
  const c = { X, Xp, W, n, surf: B.surf, hit: {}, lift, base, top, reach: top + 0.02 * s, R: 0.002 * s,
              PL: new Float64Array(n * 7), ASK: new Float64Array(n * 3), FREE: new Float64Array(n), HINT: new Int32Array(n).fill(-1), HAS: new Uint8Array(n), near: new Uint8Array(n) };
  if (G.hints) c.HINT.set(G.hints);
  for (let i = 0; i < n; i++) ask(c, i);
  // points another limb comes near (between the thighs): searched every time, not walked from the last
  const own = new Uint8Array(n), R = B.region;
  for (let i = 0; i < n; i++) if (c.HAS[i]) own[i] = R[c.HINT[i]];
  for (let i = 0; i < n; i++) if (c.HAS[i] && own[i]) c.near[i] = B.surf.grid.any(X[i * 3], X[i * 3 + 1], X[i * 3 + 2], 0.04 * s, q => R[q] !== own[i] && R[q] !== 0) ? 1 : 0;

  // a skirt's floor: each point's least radius, by its ring and angle as cut (pieces.js skirtOutline)
  const RF = G.rings?.floor ? Float64Array.from({ length: n }, (_, i) => {
    const f = G.rings.floor, r = Math.max(0, Math.min(f.rows.length - 1, Math.round((G.rings.y0 - P0[i * 3 + 1]) / f.dy)));
    const a = Math.atan2(P0[i * 3] - G.rings.cx, P0[i * 3 + 2] - G.rings.cz), k = ((Math.round((a / (2 * Math.PI) + 0.5) * f.NA) % f.NA) + f.NA) % f.NA;
    return f.rows[r][k];
  }) : null;
  const steps = Math.round(o.time * o.sub), g = o.gravity * h, cs = clamp(o.compress, 0, 1), iters = o.iters;
  return { o, n, P0, X, Xp, W, E, ne, L0, bI, bK, bD, bC, nb, TT, SE, c, RF, rings: G.rings, steps, g, cs, iters, h, t0 };
}

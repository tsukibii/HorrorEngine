// How the tailor turns a patch of skin into cloth: lifted off the body by its ease, relaxed like a stretched membrane
// (it lies on what bulges and bridges what dips: under the bust, the waist, the spine, the small of the back; the more
// rounds, the looser it hangs), then given a thickness with a rim round every open edge.
import { normals, adjacency, boundaryLoops } from "./mesh.js";

/** the mesh's vertices v with value >= -margin, and the triangles among them (renumbered): {P, T, keep (old index per new)} */
export function crop(P, T, v, margin) {
  const n = P.length / 3, map = new Int32Array(n).fill(-1), keep = [];
  for (let i = 0; i < n; i++) if (v[i] >= -margin) { map[i] = keep.length; keep.push(i); }
  const tri = [];
  for (let t = 0; t < T.length; t += 3) {
    const a = map[T[t]], b = map[T[t + 1]], c = map[T[t + 2]];
    if (a >= 0 && b >= 0 && c >= 0) tri.push(a, b, c);
  }
  const Q = new Float32Array(keep.length * 3);
  keep.forEach((i, j) => { Q[j * 3] = P[i * 3]; Q[j * 3 + 1] = P[i * 3 + 1]; Q[j * 3 + 2] = P[i * 3 + 2]; });
  return { P: Q, T: new Uint32Array(tri), keep };
}

/**
 * Lift and relax: every point starts `ease[i]` off the body along the skin's normal, then `iters` rounds of smoothing
 * along the cloth's normal only (no sliding), each followed by pushing back out to its clearance from the body and
 * from the clothes already worn (`colliders`: [{surf, clear}]).
 */
export function relax(P, T, N, ease, opts = {}) {
  const n = P.length / 3, Q = new Float32Array(P.length), adj = adjacency(n, T);
  const iters = opts.iters ?? 16, lam = opts.lambda ?? 0.5, cols = opts.colliders || [], W = opts.weight;
  const clear = opts.clear || ease, hints = opts.hints ? Int32Array.from(opts.hints) : null;   // the skin's vertex each point came from
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) Q[i * 3 + k] = P[i * 3 + k] + N[i * 3 + k] * ease[i];
  const hit = {};
  const push = (exact = false) => {
    for (const [ci, c] of cols.entries()) {
      const walk = hints && ci === 0 && !exact;                      // the body: walk from where the point was last (a full search at the end,
      for (let i = 0; i < n; i++) {                                  // and always where another part of the body is near: the other leg, an arm)
        const need = c.clear === undefined ? clear[i] : c.clear;
        const r = c.surf.closest(Q[i * 3], Q[i * 3 + 1], Q[i * 3 + 2], need + 0.04, hit, walk && !(opts.contested && opts.contested[i]) ? hints[i] : -1);
        if (r && walk) hints[i] = r.v;
        if (!r || r.d >= need) continue;
        const m = need - r.d;
        Q[i * 3] += r.nx * m; Q[i * 3 + 1] += r.ny * m; Q[i * 3 + 2] += r.nz * m;
      }
    }
  };
  push();
  let G = normals(Q, T);
  const D = new Float32Array(P.length);
  for (let it = 0; it < iters; it++) {
    if (it % 4 === 3) G = normals(Q, T);
    for (let i = 0; i < n; i++) {
      const a = adj.start[i], b = adj.start[i + 1]; if (b === a) continue;
      let mx = 0, my = 0, mz = 0;
      for (let q = a; q < b; q++) { const j = adj.list[q] * 3; mx += Q[j]; my += Q[j + 1]; mz += Q[j + 2]; }
      const k = 1 / (b - a), dx = mx * k - Q[i * 3], dy = my * k - Q[i * 3 + 1], dz = mz * k - Q[i * 3 + 2];
      const d = (dx * G[i * 3] + dy * G[i * 3 + 1] + dz * G[i * 3 + 2]) * lam * (W ? W[i] : 1);
      D[i * 3] = G[i * 3] * d; D[i * 3 + 1] = G[i * 3 + 1] * d; D[i * 3 + 2] = G[i * 3 + 2] * d;
    }
    for (let i = 0; i < Q.length; i++) Q[i] += D[i];
    push(it === iters - 1);                                          // the last round searches properly: a walk can stop at the wrong leg
  }
  if (!iters) push(true);
  if (opts.hintsOut) opts.hintsOut.hints = hints;
  return Q;
}

/**
 * Cloth with a thickness: the outer surface as it is, an inner one `t` in along the normals (turned over), and a strip
 * round every open edge joining them, with its own vertices so the edge stays crisp. Returns {P, T, S}: S is a shade
 * per vertex (1; `rim` on the edge's strip and `edge` on the outside's last row of points: together they read as the
 * shadow and the stitching along a hem or round a pocket).
 */
export function thicken(P, T, t, rim = 1, edge = 1) {
  if (!(t > 0)) return { P, T, S: new Float32Array(P.length / 3).fill(1) };
  const n = P.length / 3, N = normals(P, T), loops = boundaryLoops(T);
  const out = new Float32Array(n * 6 + loops.reduce((s, l) => s + l.length * 6, 0));
  out.set(P);
  for (let i = 0; i < n * 3; i++) out[n * 3 + i] = P[i] - N[i] * t;
  const tri = Array.from(T);
  for (let q = 0; q < T.length; q += 3) tri.push(T[q] + n, T[q + 2] + n, T[q + 1] + n);
  let o = n * 2;
  for (const loop of loops) {
    const m = loop.length, base = o;
    loop.forEach((v, j) => {
      for (let k = 0; k < 3; k++) { out[(base + j) * 3 + k] = P[v * 3 + k]; out[(base + m + j) * 3 + k] = P[v * 3 + k] - N[v * 3 + k] * t; }
    });
    for (let j = 0; j < m; j++) {
      const a = base + j, b = base + (j + 1) % m, c = base + m + j, d = base + m + (j + 1) % m;
      // the loop runs the way its triangles walk their edges, so the strip faces out
      tri.push(a, c, b, b, c, d);
    }
    o += m * 2;
  }
  const S = new Float32Array(out.length / 3).fill(1); S.fill(rim, n * 2);
  for (const loop of loops) for (const v of loop) S[v] = edge;
  return { P: out, T: new Uint32Array(tri), S };
}

/** a piece of cloth lifted off another (a pocket on a shirt, a waistband on trousers): the part of `base` where
    value(x, y, z, nx, ny, nz) >= 0, raised `lift` (a number or lift(value)) along its normals */
export function lifted(cut, base, value, lift) {
  const N = normals(base.P, base.T), n = base.P.length / 3, v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = value(base.P[i * 3], base.P[i * 3 + 1], base.P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
  const c = cut(base.P, base.T, v);
  if (!c.T.length) return null;
  const Nn = new Float32Array(c.P.length);
  c.from.forEach(([a, b, u], i) => { for (let k = 0; k < 3; k++) Nn[i * 3 + k] = N[a * 3 + k] * (1 - u) + N[b * 3 + k] * u; });
  for (let i = 0; i < c.P.length / 3; i++) {
    const [a, b, u] = c.from[i], val = v[a] * (1 - u) + v[b] * u, l = typeof lift === "function" ? lift(val) : lift;
    const nl = Math.hypot(Nn[i * 3], Nn[i * 3 + 1], Nn[i * 3 + 2]) || 1;
    for (let k = 0; k < 3; k++) c.P[i * 3 + k] += Nn[i * 3 + k] / nl * l;
  }
  return { P: c.P, T: c.T };
}


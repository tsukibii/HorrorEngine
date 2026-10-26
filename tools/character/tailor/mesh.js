// Mesh helpers for the tailor (tools/character/tailor.js): plain typed arrays, no DOM, so the Studio page and node
// (the check, the OBJ writer) run the same code. Y up, metres.

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a || 1e-9), 0, 1); return t * t * (3 - 2 * t); };

/** area-weighted vertex normals */
export function normals(P, T) {
  const N = new Float32Array(P.length);
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { N[i] += nx; N[i + 1] += ny; N[i + 2] += nz; }
  }
  for (let i = 0; i < N.length; i += 3) {
    const l = Math.hypot(N[i], N[i + 1], N[i + 2]);
    if (l > 1e-12) { N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; } else { N[i] = 0; N[i + 1] = 1; N[i + 2] = 0; }
  }
  return N;
}

/** one midpoint subdivision: every triangle in four. Returns {P, T, parents}: the new vertices (from P.length / 3 on) are
    the middles of the edges parents[2k], parents[2k + 1] */
export function subdivide(P, T) {
  const n = P.length / 3, mid = new Map(), extra = [], parents = [];
  const edge = (a, b) => {
    const k = a < b ? a * n + b : b * n + a;
    let m = mid.get(k);
    if (m === undefined) { m = n + extra.length / 3; mid.set(k, m); parents.push(a, b); extra.push((P[a * 3] + P[b * 3]) / 2, (P[a * 3 + 1] + P[b * 3 + 1]) / 2, (P[a * 3 + 2] + P[b * 3 + 2]) / 2); }
    return m;
  };
  const T2 = new Uint32Array(T.length * 4);
  for (let t = 0, o = 0; t < T.length; t += 3) {
    const a = T[t], b = T[t + 1], c = T[t + 2], ab = edge(a, b), bc = edge(b, c), ca = edge(c, a);
    T2.set([a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca], o); o += 12;
  }
  const P2 = new Float32Array(P.length + extra.length); P2.set(P); P2.set(extra, P.length);
  return { P: P2, T: T2, parents };
}

/** neighbours as a compressed list: vertex i's are list[start[i] .. start[i + 1]) */
export function adjacency(n, T) {
  const sets = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) { const a = T[t + k], b = T[t + (k + 1) % 3]; sets[a].add(b); sets[b].add(a); }
  const start = new Uint32Array(n + 1); let tot = 0;
  for (let i = 0; i < n; i++) { start[i] = tot; tot += sets[i].size; }
  start[n] = tot;
  const list = new Uint32Array(tot);
  for (let i = 0, o = 0; i < n; i++) for (const j of sets[i]) list[o++] = j;
  return { start, list };
}

/** vertex -> its triangles, compressed */
export function vertexTris(n, T) {
  const cnt = new Uint32Array(n + 1);
  for (let i = 0; i < T.length; i++) cnt[T[i] + 1]++;
  for (let i = 0; i < n; i++) cnt[i + 1] += cnt[i];
  const list = new Uint32Array(T.length), fill = cnt.slice(0, n);
  for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) list[fill[T[t + k]]++] = t / 3;
  return { start: cnt, list };
}

/** a point cloud in a uniform grid: nearest(x, y, z, r) -> index or -1 */
export class PointGrid {
  constructor(P, cell = 0.008, idx = null) {
    const ids = idx || Array.from({ length: P.length / 3 }, (_, i) => i);
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const i of ids) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i * 3 + k]); hi[k] = Math.max(hi[k], P[i * 3 + k]); }
    this.P = P; this.cell = cell; this.lo = lo.map(v => v - cell * 2);
    this.nx = Math.ceil((hi[0] - this.lo[0]) / cell) + 3; this.ny = Math.ceil((hi[1] - this.lo[1]) / cell) + 3; this.nz = Math.ceil((hi[2] - this.lo[2]) / cell) + 3;
    const nc = this.nx * this.ny * this.nz, start = new Uint32Array(nc + 1), cid = new Uint32Array(ids.length);
    ids.forEach((i, j) => { const c = this.cellOf(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); cid[j] = c; start[c + 1]++; });
    for (let c = 0; c < nc; c++) start[c + 1] += start[c];
    const fill = start.slice(0, nc), items = new Uint32Array(ids.length);
    ids.forEach((i, j) => { items[fill[cid[j]]++] = i; });
    this.start = start; this.items = items;
  }
  /** is any point within r of (x, y, z) one that ok(index) accepts? */
  any(x, y, z, r, ok) {
    const c = this.cell, R = Math.ceil(r / c), ix = Math.floor((x - this.lo[0]) / c), iy = Math.floor((y - this.lo[1]) / c), iz = Math.floor((z - this.lo[2]) / c), P = this.P, r2 = r * r;
    for (let k = Math.max(0, iz - R); k <= Math.min(this.nz - 1, iz + R); k++) for (let j = Math.max(0, iy - R); j <= Math.min(this.ny - 1, iy + R); j++) {
      const row = (k * this.ny + j) * this.nx;
      for (let i = Math.max(0, ix - R); i <= Math.min(this.nx - 1, ix + R); i++)
        for (let q = this.start[row + i], e = this.start[row + i + 1]; q < e; q++) {
          const p = this.items[q]; if ((P[p * 3] - x) ** 2 + (P[p * 3 + 1] - y) ** 2 + (P[p * 3 + 2] - z) ** 2 < r2 && ok(p)) return true;
        }
    }
    return false;
  }
  cellOf(x, y, z) {
    const c = this.cell, ix = Math.floor((x - this.lo[0]) / c), iy = Math.floor((y - this.lo[1]) / c), iz = Math.floor((z - this.lo[2]) / c);
    return (iz * this.ny + iy) * this.nx + ix;
  }
  nearest(x, y, z, r = 0.05) {
    // grow the searched block until the best found is nearer than anything outside it can be
    const c = this.cell, ix = Math.floor((x - this.lo[0]) / c), iy = Math.floor((y - this.lo[1]) / c), iz = Math.floor((z - this.lo[2]) / c);
    const RM = Math.ceil(r / c), P = this.P;
    let best = -1, bd = r * r;
    for (let R = 1, done = 0; R <= RM; R++) {
      for (let k = Math.max(0, iz - R); k <= Math.min(this.nz - 1, iz + R); k++) for (let j = Math.max(0, iy - R); j <= Math.min(this.ny - 1, iy + R); j++) {
        const row = (k * this.ny + j) * this.nx, shell = Math.abs(k - iz) === R || Math.abs(j - iy) === R;
        for (let i = Math.max(0, ix - R); i <= Math.min(this.nx - 1, ix + R); i++) {
          if (R > 1 && !shell && Math.abs(i - ix) !== R) continue;      // the inside was searched last round
          if (R > 1 && done && Math.abs(i - ix) < R && !shell) continue;
          for (let q = this.start[row + i], e = this.start[row + i + 1]; q < e; q++) {
            const p = this.items[q], dx = P[p * 3] - x, dy = P[p * 3 + 1] - y, dz = P[p * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz;
            if (d < bd) { bd = d; best = p; }
          }
        }
      }
      done = 1;
      if (best >= 0 && bd <= (R * c) * (R * c)) break;
    }
    return best;
  }
}

/** closest point on triangle abc to p -> [x, y, z, u, v] (barycentric of b and c) */
function closestTri(p, a, b, c, out) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
  const apx = p[0] - a[0], apy = p[1] - a[1], apz = p[2] - a[2];
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  const set = (u, v) => { out[0] = a[0] + abx * u + acx * v; out[1] = a[1] + aby * u + acy * v; out[2] = a[2] + abz * u + acz * v; out[3] = u; out[4] = v; return out; };
  if (d1 <= 0 && d2 <= 0) return set(0, 0);
  const bpx = p[0] - b[0], bpy = p[1] - b[1], bpz = p[2] - b[2], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return set(1, 0);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return set(d1 / (d1 - d3), 0);
  const cpx = p[0] - c[0], cpy = p[1] - c[1], cpz = p[2] - c[2], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return set(0, 1);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return set(0, d2 / (d2 - d6));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return set(1 - w, w); }
  const den = 1 / (va + vb + vc); return set(vb * den, vc * den);
}

/** a closed surface you can ask about: the signed distance of a point (positive outside), the closest point and the smooth normal there.
    Built on the vertices' grid, then the triangles round the nearest vertex. */
export class Surface {
  constructor(P, T, N = null, cell = 0.008) {
    this.P = P; this.T = T; this.N = N || normals(P, T);
    const n = P.length / 3;
    this.grid = new PointGrid(P, cell);
    this.vt = vertexTris(n, T);
    this._a = [0, 0, 0]; this._b = [0, 0, 0]; this._c = [0, 0, 0]; this._o = [0, 0, 0, 0, 0];
  }
  /** the nearest vertex by walking the mesh from `hint` (a vertex near the last answer): a few steps, not a search */
  walk(x, y, z, hint) {
    const P = this.P, A = this.adj || (this.adj = adjacency(P.length / 3, this.T));
    let v = hint, d = (P[v * 3] - x) ** 2 + (P[v * 3 + 1] - y) ** 2 + (P[v * 3 + 2] - z) ** 2;
    for (let step = 0; step < 200; step++) {
      let best = -1, bd = d;
      for (let q = A.start[v]; q < A.start[v + 1]; q++) { const n = A.list[q], dn = (P[n * 3] - x) ** 2 + (P[n * 3 + 1] - y) ** 2 + (P[n * 3 + 2] - z) ** 2; if (dn < bd) { bd = dn; best = n; } }
      if (best < 0) break; v = best; d = bd;
    }
    return v;
  }
  /** {d, x, y, z, nx, ny, nz, v, t, u, w} or null when nothing is within `reach` (t the closest triangle's first index
      into T, u and w its second and third corners' shares); from a `hint` vertex it walks instead of searching */
  closest(x, y, z, reach = 0.08, out = {}, hint = -1) {
    const v = hint >= 0 ? this.walk(x, y, z, hint) : this.grid.nearest(x, y, z, reach); if (v < 0) return null;
    const P = this.P, T = this.T, N = this.N, p = [x, y, z], a = this._a, b = this._b, c = this._c, o = this._o;
    let bd = 1e9, bt = -1, bo = null;
    for (let q = this.vt.start[v]; q < this.vt.start[v + 1]; q++) {
      const t = this.vt.list[q] * 3, i = T[t] * 3, j = T[t + 1] * 3, k = T[t + 2] * 3;
      a[0] = P[i]; a[1] = P[i + 1]; a[2] = P[i + 2]; b[0] = P[j]; b[1] = P[j + 1]; b[2] = P[j + 2]; c[0] = P[k]; c[1] = P[k + 1]; c[2] = P[k + 2];
      closestTri(p, a, b, c, o);
      const d = (o[0] - x) ** 2 + (o[1] - y) ** 2 + (o[2] - z) ** 2;
      if (d < bd) { bd = d; bt = t; bo = [o[0], o[1], o[2], o[3], o[4]]; }
    }
    if (bt < 0) return null;
    const i = T[bt] * 3, j = T[bt + 1] * 3, k = T[bt + 2] * 3, u = bo[3], w = bo[4], s = 1 - u - w;
    let nx = N[i] * s + N[j] * u + N[k] * w, ny = N[i + 1] * s + N[j + 1] * u + N[k + 1] * w, nz = N[i + 2] * s + N[j + 2] * u + N[k + 2] * w;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const dist = Math.sqrt(bd), side = (x - bo[0]) * nx + (y - bo[1]) * ny + (z - bo[2]) * nz;
    out.d = side >= 0 ? dist : -dist; out.x = bo[0]; out.y = bo[1]; out.z = bo[2]; out.nx = nx; out.ny = ny; out.nz = nz; out.v = v;
    out.t = bt; out.u = u; out.w = w;
    return out;
  }
}

/** Cut a triangle mesh along v = 0 (keep v >= 0): the cut edges' points are interpolated, so the new edge is one clean curve.
    `v` is per vertex. Returns {P, T, from} where from[i] is the source of vertex i: [a, b, t] (a point t of the way from a to b; a == b for an
    original vertex). Vertices no triangle uses are dropped. */
export function cut(P, T, v) {
  const n = P.length / 3, map = new Int32Array(n).fill(-1), out = [], from = [], tri = [], cutv = new Map();
  const keep = i => { if (map[i] < 0) { map[i] = out.length / 3; out.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); from.push([i, i, 0]); } return map[i]; };
  const mid = (a, b) => {                                        // the point on edge a-b where v = 0 (a keeps)
    const k = a < b ? a * n + b : b * n + a; let m = cutv.get(k);
    if (m === undefined) {
      const t = v[a] / (v[a] - v[b]), q = [P[a * 3] + (P[b * 3] - P[a * 3]) * t, P[a * 3 + 1] + (P[b * 3 + 1] - P[a * 3 + 1]) * t, P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * t];
      if (t < 1e-5) m = keep(a);                                     // the line goes through the kept point itself
      else { m = out.length / 3; out.push(...q); from.push([a, b, t]); }
      cutv.set(k, m);
    }
    return m;
  };
  const push = (a, b, c) => { if (a !== b && b !== c && a !== c) tri.push(a, b, c); };
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t], b = T[t + 1], c = T[t + 2], ia = v[a] >= 0, ib = v[b] >= 0, ic = v[c] >= 0, cnt = ia + ib + ic;
    if (cnt === 0) continue;
    if (cnt === 3) { tri.push(keep(a), keep(b), keep(c)); continue; }
    // rotate so the odd vertex is first
    let A = a, B = b, C = c, ka = ia, kb = ib, kc = ic;
    if (cnt === 1) {                                              // one kept: a small triangle
      if (kb) { A = b; B = c; C = a; } else if (kc) { A = c; B = a; C = b; }
      const p = keep(A), q = mid(A, B), r = mid(A, C); push(p, q, r);
    } else {                                                      // two kept: a quad cut in two
      if (!ia) { A = a; B = b; C = c; } else if (!ib) { A = b; B = c; C = a; } else { A = c; B = a; C = b; }
      const q = keep(B), r = keep(C), p1 = mid(B, A), p2 = mid(C, A);
      push(q, r, p2); push(q, p2, p1);
    }
  }
  return { P: new Float32Array(out), T: new Uint32Array(tri), from };
}

/** Split a mesh along v = 0, keeping both sides: the triangles it crosses are cut in three, the new points shared
    along the line, so a seam can follow it exactly. `S` (a value per vertex) and `at` (another place for every point:
    where a drape hung it) are carried. Returns {P, T, S, at} */
export function split(P, T, v, S = null, at = null) {
  const n = P.length / 3, out = Array.from(P), sh = S ? Array.from(S) : null, ah = at ? Array.from(at) : null, mids = new Map(), tri = [];
  const mid = (a, b) => {
    const k = a < b ? a * n + b : b * n + a; let m = mids.get(k);
    if (m === undefined) {
      const t = v[a] / (v[a] - v[b]);
      if (t < 1e-5) m = a; else if (t > 1 - 1e-5) m = b;            // the line goes through a point: no new one there
      else {
        m = out.length / 3;
        out.push(P[a * 3] + (P[b * 3] - P[a * 3]) * t, P[a * 3 + 1] + (P[b * 3 + 1] - P[a * 3 + 1]) * t, P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * t);
        if (sh) sh.push(S[a] + (S[b] - S[a]) * t);
        if (ah) ah.push(at[a * 3] + (at[b * 3] - at[a * 3]) * t, at[a * 3 + 1] + (at[b * 3 + 1] - at[a * 3 + 1]) * t, at[a * 3 + 2] + (at[b * 3 + 2] - at[a * 3 + 2]) * t);
      }
      mids.set(k, m);
    }
    return m;
  };
  const push = (a, b, c) => { if (a !== b && b !== c && a !== c) tri.push(a, b, c); };
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t], b = T[t + 1], c = T[t + 2], sa = v[a] >= 0, sb = v[b] >= 0, sc = v[c] >= 0;
    if (sa === sb && sb === sc) { tri.push(a, b, c); continue; }
    // rotate so A is alone on its side
    let A = a, B = b, C = c;
    if (sb !== sa && sb !== sc) { A = b; B = c; C = a; } else if (sc !== sa && sc !== sb) { A = c; B = a; C = b; }
    const p = mid(A, B), q = mid(A, C);
    push(A, p, q); push(p, B, C); push(p, C, q);
  }
  return { P: new Float32Array(out), T: new Uint32Array(tri), S: sh ? new Float32Array(sh) : null, at: ah ? new Float32Array(ah) : null };
}

/** edges used by one triangle, chained into loops of vertex indices */
export function boundaryLoops(T) {
  const count = new Map(), next = new Map();
  for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = T[t + k], b = T[t + (k + 1) % 3], key = a < b ? a + "_" + b : b + "_" + a;
    count.set(key, (count.get(key) || 0) + 1);
  }
  const adj = new Map();
  for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = T[t + k], b = T[t + (k + 1) % 3], key = a < b ? a + "_" + b : b + "_" + a;
    if (count.get(key) === 1) next.set(a, b);                    // directed as the triangle walks it
  }
  const loops = [], seen = new Set();
  for (const s of next.keys()) {
    if (seen.has(s)) continue;
    const loop = []; let i = s;
    while (i !== undefined && !seen.has(i)) { seen.add(i); loop.push(i); i = next.get(i); }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}

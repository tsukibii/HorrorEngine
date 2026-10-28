// thin.js: how thin the body is at each of its points, for the skin's translucency (skinlight.js): from each point a
// ray goes straight in (against its normal) to where it comes out of the body again; ears, nostrils, eyelids and
// fingers are millimetres, a cheek or a thigh centimetres. 0 thick .. 1 thin, smoothed a little over the mesh. A grid
// of the triangles keeps it fast (MHR's 18,439 points, about 0.1 s). Our own code.
//
//   thinness(P, idx, Nrm, o)   Float32Array a point: P positions (metres, xyz a point), idx the triangles (3 a
//                              triangle), Nrm the points' normals; o.thin, o.thick: the metres read as fully thin and
//                              fully thick (0.004, 0.035); o.smooth: rounds of averaging with the neighbours (2)
//   thicknessOf(...)           the metres themselves (Infinity where a ray never comes out)

export function thicknessOf(P, idx, Nrm, o = {}) {
  const n = P.length / 3, T = idx.length / 3, far = o.far ?? 0.15, cell = o.cell ?? 0.02;
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i * 3 + k]); hi[k] = Math.max(hi[k], P[i * 3 + k]); }
  lo = lo.map(v => v - cell); hi = hi.map(v => v + cell);
  const dim = [0, 1, 2].map(k => Math.max(1, Math.ceil((hi[k] - lo[k]) / cell))), cells = new Map();
  const key = (x, y, z) => (z * dim[1] + y) * dim[0] + x;
  for (let t = 0; t < T; t++) {                        // each triangle in every cell its box touches
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3, c0 = [], c1 = [];
    for (let k = 0; k < 3; k++) {
      c0.push(Math.floor((Math.min(P[a + k], P[b + k], P[c + k]) - lo[k]) / cell));
      c1.push(Math.floor((Math.max(P[a + k], P[b + k], P[c + k]) - lo[k]) / cell));
    }
    for (let z = c0[2]; z <= c1[2]; z++) for (let y = c0[1]; y <= c1[1]; y++) for (let x = c0[0]; x <= c1[0]; x++) {
      const kk = key(x, y, z); let l = cells.get(kk); if (!l) cells.set(kk, l = []); l.push(t);
    }
  }
  const out = new Float32Array(n).fill(Infinity), seen = new Int32Array(T).fill(-1);
  for (let i = 0; i < n; i++) {
    let dx = -Nrm[i * 3], dy = -Nrm[i * 3 + 1], dz = -Nrm[i * 3 + 2]; const L = Math.hypot(dx, dy, dz); if (!L) continue;
    dx /= L; dy /= L; dz /= L;
    const ox = P[i * 3] + dx * 1e-4, oy = P[i * 3 + 1] + dy * 1e-4, oz = P[i * 3 + 2] + dz * 1e-4;
    let best = Infinity;
    // through the grid's cells along the ray (3D DDA), nearest first, until a hit nearer than the next cell
    let x = Math.floor((ox - lo[0]) / cell), y = Math.floor((oy - lo[1]) / cell), z = Math.floor((oz - lo[2]) / cell);
    const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
    const nx = (x + (sx > 0 ? 1 : 0)) * cell + lo[0], ny = (y + (sy > 0 ? 1 : 0)) * cell + lo[1], nz = (z + (sz > 0 ? 1 : 0)) * cell + lo[2];
    let tx = sx ? (nx - ox) / dx : Infinity, ty = sy ? (ny - oy) / dy : Infinity, tz = sz ? (nz - oz) / dz : Infinity;
    const ddx = sx ? cell / Math.abs(dx) : Infinity, ddy = sy ? cell / Math.abs(dy) : Infinity, ddz = sz ? cell / Math.abs(dz) : Infinity;
    let t0 = 0;
    while (t0 < Math.min(far, best) && x >= 0 && y >= 0 && z >= 0 && x < dim[0] && y < dim[1] && z < dim[2]) {
      for (const t of cells.get(key(x, y, z)) || []) {
        if (seen[t] === i) continue; seen[t] = i;
        const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
        if (a === i || b === i || c === i) continue;    // its own triangles
        const h = hit(P, a, b, c, ox, oy, oz, dx, dy, dz);
        if (h > 0 && h < best) best = h;
      }
      if (tx < ty && tx < tz) { t0 = tx; tx += ddx; x += sx; } else if (ty < tz) { t0 = ty; ty += ddy; y += sy; } else { t0 = tz; tz += ddz; z += sz; }
    }
    out[i] = best;
  }
  return out;
}

function hit(P, a, b, c, ox, oy, oz, dx, dy, dz) {     // Möller-Trumbore: the ray's distance to the triangle, or -1
  const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
  const e1x = P[b * 3] - ax, e1y = P[b * 3 + 1] - ay, e1z = P[b * 3 + 2] - az, e2x = P[c * 3] - ax, e2y = P[c * 3 + 1] - ay, e2z = P[c * 3 + 2] - az;
  const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return -1;
  const inv = 1 / det, tx = ox - ax, ty = oy - ay, tz = oz - az, u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return -1;
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return -1;
  return (e2x * qx + e2y * qy + e2z * qz) * inv;
}

export function thinness(P, idx, Nrm, o = {}) {
  const th = thicknessOf(P, idx, Nrm, o), n = th.length, a = o.thin ?? 0.004, b = o.thick ?? 0.035;
  let v = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = Math.min(1, Math.max(0, (th[i] - a) / (b - a))); v[i] = 1 - x * x * (3 - 2 * x); }
  const nb = Array.from({ length: n }, () => []);       // its neighbours, for the averaging
  for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const p = idx[t + k], q = idx[t + (k + 1) % 3]; nb[p].push(q); nb[q].push(p); }
  for (let r = 0; r < (o.smooth ?? 2); r++) {
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = v[i] * 2, m = 2; for (const j of nb[i]) { s += v[j]; m++; } w[i] = s / m; }
    v = w;
  }
  return v;
}

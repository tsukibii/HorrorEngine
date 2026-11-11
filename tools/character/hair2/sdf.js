// The body as a distance grid, for the hair editor v2.0 (docs/HAIR_V2.md): how far any point near the head, neck,
// shoulders and chest is from the skin, and which way is out. The salon keeps hair off a head of rays from the skull's
// middle (salonlib.js Collider), which can't see behind an ear and stands hair off the cheeks (LESSONS: collide hair
// with the skin, not a star-shaped head); this is the skin itself. Plain arrays, no three.js: the page, its worker and
// node share it. Everything is in the head's local space (salonref.js: the origin between the ears, X the character's
// left, Y up, Z forward, metres on MHR's base head).
//
//   buildSDF(P, T, o)        P: the body's points (local), T: its triangles -> { n, lo, cell, d }   d: signed metres (+ outside)
//   addSurface(S, P, T, thick)   an open surface (clothes) made solid `thick` deep and joined in
//   dist(S, x, y, z)         the distance at a point (trilinear)
//   grad(S, x, y, z, out)    the way out (unit; out = [x, y, z]); false where the grid is flat (far from the body)
//
// Made in three steps: the triangles' own cells exactly; then outward cell to cell, each cell trying its neighbours'
// nearest triangles (so every cell within `band` of the skin knows its true nearest triangle, not a guess); then the
// sign from the smooth normal at the nearest point, and beyond the band by flooding in from above the head.

export const BOX = { lo: [-0.27, -0.42, -0.30], hi: [0.27, 0.22, 0.20], cell: 0.004, band: 0.06 };

// the nearest point of triangle (a, b, c) to p (Ericson, Real-Time Collision Detection 5.1.5); its barycentric weights
// left in W, the squared distance returned
const W = [0, 0, 0];
function nearTri(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let u, v, w;
  if (d1 <= 0 && d2 <= 0) { u = 1; v = 0; w = 0; }
  else {
    const bpx = px - bx, bpy = py - by, bpz = pz - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { u = 0; v = 1; w = 0; }
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { v = d1 / (d1 - d3); u = 1 - v; w = 0; }
      else {
        const cpx = px - cx, cpy = py - cy, cpz = pz - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { u = 0; v = 0; w = 1; }
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { w = d2 / (d2 - d6); u = 1 - w; v = 0; }
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); u = 0; v = 1 - w; }
            else { const den = 1 / (va + vb + vc); v = vb * den; w = vc * den; u = 1 - v - w; }
          }
        }
      }
    }
  }
  W[0] = u; W[1] = v; W[2] = w;
  const qx = ax * u + bx * v + cx * w - px, qy = ay * u + by * v + cy * w - py, qz = az * u + bz * v + cz * w - pz;
  return qx * qx + qy * qy + qz * qz;
}

// the points' smooth normals (each triangle's, weighted by its area)
export function vertexNormals(P, T) {
  const N = new Float32Array(P.length);
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { N[i] += nx; N[i + 1] += ny; N[i + 2] += nz; }
  }
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
  return N;
}

// unsigned distances to a set of triangles, exact within `band` of them: { D, TR } (TR: each cell's nearest triangle, -1 beyond the band)
function unsigned(P, T, tris, g) {
  const { nx, ny, nz, lo, cell, band } = g, N = nx * ny * nz, D = new Float64Array(N).fill(1e9), TR = new Int32Array(N).fill(-1);
  const queue = [];
  for (const t of tris) {                                               // each triangle's own cells (its box and a cell round it)
    const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
    const x0 = Math.max(0, Math.floor((Math.min(P[a], P[b], P[c]) - lo[0]) / cell) - 1), x1 = Math.min(nx - 1, Math.ceil((Math.max(P[a], P[b], P[c]) - lo[0]) / cell) + 1);
    const y0 = Math.max(0, Math.floor((Math.min(P[a + 1], P[b + 1], P[c + 1]) - lo[1]) / cell) - 1), y1 = Math.min(ny - 1, Math.ceil((Math.max(P[a + 1], P[b + 1], P[c + 1]) - lo[1]) / cell) + 1);
    const z0 = Math.max(0, Math.floor((Math.min(P[a + 2], P[b + 2], P[c + 2]) - lo[2]) / cell) - 1), z1 = Math.min(nz - 1, Math.ceil((Math.max(P[a + 2], P[b + 2], P[c + 2]) - lo[2]) / cell) + 1);
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = (z * ny + y) * nx + x, d2 = nearTri(lo[0] + x * cell, lo[1] + y * cell, lo[2] + z * cell, P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2]);
      if (d2 < D[k]) { if (TR[k] < 0) queue.push(k); D[k] = d2; TR[k] = t; }
    }
  }
  // outward, nearest cells first (buckets half a cell deep, so a cell is settled about once): a cell offers its
  // triangle to its six neighbours, and one that is nearer for it takes it and offers it on
  const b2 = band * band, step = [1, -1, nx, -nx, nx * ny, -nx * ny], half = cell * 0.5, nb = Math.ceil(band / half) + 2;
  const buckets = Array.from({ length: nb }, () => []), bucket = d2 => Math.min(nb - 1, (Math.sqrt(d2) / half) | 0), done = new Float64Array(N).fill(-1);
  for (const k of queue) buckets[bucket(D[k])].push(k);
  for (let bi = 0; bi < nb; bi++) {
    const Q = buckets[bi];
    for (let q = 0; q < Q.length; q++) {
      const k = Q[q]; if (done[k] === D[k]) continue; done[k] = D[k];   // (offered already as it is now)
      const t = TR[k], x = k % nx, y = Math.floor(k / nx) % ny, z = Math.floor(k / (nx * ny));
      const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
      for (let s = 0; s < 6; s++) {
        const X = x + (s === 0) - (s === 1), Y = y + (s === 2) - (s === 3), Z = z + (s === 4) - (s === 5);
        if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue;
        const j = k + step[s]; if (TR[j] === t) continue;
        const d2 = nearTri(lo[0] + X * cell, lo[1] + Y * cell, lo[2] + Z * cell, P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2]);
        if (d2 < D[j] * 0.999999 && d2 < b2) { D[j] = d2; TR[j] = t; buckets[Math.max(bi, bucket(d2))].push(j); }
      }
    }
    buckets[bi] = null;
  }
  const out = new Float32Array(N);
  for (let k = 0; k < N; k++) out[k] = TR[k] < 0 ? band : Math.sqrt(D[k]);
  return { D: out, TR };
}

const gridOf = o => {
  const cell = o.cell ?? BOX.cell, lo = o.lo ?? BOX.lo, hi = o.hi ?? BOX.hi, band = o.band ?? BOX.band;
  return { cell, lo: lo.slice(), band, nx: Math.ceil((hi[0] - lo[0]) / cell) + 1, ny: Math.ceil((hi[1] - lo[1]) / cell) + 1, nz: Math.ceil((hi[2] - lo[2]) / cell) + 1 };
};
const inBox = (P, T, g) => {                                            // the triangles that reach into the grid
  const hi = [g.lo[0] + (g.nx - 1) * g.cell, g.lo[1] + (g.ny - 1) * g.cell, g.lo[2] + (g.nz - 1) * g.cell], out = [];
  for (let t = 0; t < T.length; t += 3) {
    let ok = true;
    for (let a = 0; a < 3 && ok; a++) {
      const v0 = P[T[t] * 3 + a], v1 = P[T[t + 1] * 3 + a], v2 = P[T[t + 2] * 3 + a];
      if (Math.max(v0, v1, v2) < g.lo[a] - g.cell || Math.min(v0, v1, v2) > hi[a] + g.cell) ok = false;
    }
    if (ok) out.push(t);
  }
  return out;
};

export function buildSDF(P, T, o = {}) {
  const g = gridOf(o), { nx, ny, nz, lo, cell, band } = g, N = nx * ny * nz;
  const { D, TR } = unsigned(P, T, inBox(P, T, g), g), VN = o.normals || vertexNormals(P, T);
  for (let k = 0; k < N; k++) {                                         // the sign, within the band: by the smooth normal at the nearest point
    const t = TR[k]; if (t < 0) continue;
    const x = lo[0] + (k % nx) * cell, y = lo[1] + (Math.floor(k / nx) % ny) * cell, z = lo[2] + Math.floor(k / (nx * ny)) * cell;
    const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
    nearTri(x, y, z, P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2]);
    const qx = P[a] * W[0] + P[b] * W[1] + P[c] * W[2], qy = P[a + 1] * W[0] + P[b + 1] * W[1] + P[c + 1] * W[2], qz = P[a + 2] * W[0] + P[b + 2] * W[1] + P[c + 2] * W[2];
    const mx = VN[a] * W[0] + VN[b] * W[1] + VN[c] * W[2], my = VN[a + 1] * W[0] + VN[b + 1] * W[1] + VN[c + 1] * W[2], mz = VN[a + 2] * W[0] + VN[b + 2] * W[1] + VN[c + 2] * W[2];
    if ((x - qx) * mx + (y - qy) * my + (z - qz) * mz < 0) D[k] = -D[k];
  }
  // beyond the band: outside is what the grid's top (above the head) reaches through cells no triangle is near; the rest is inside
  const seen = new Uint8Array(N), stack = [];
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) { const k = (z * ny + (ny - 1)) * nx + x; if (TR[k] < 0) { seen[k] = 1; stack.push(k); } }
  const step = [1, -1, nx, -nx, nx * ny, -nx * ny];
  while (stack.length) {
    const k = stack.pop(), x = k % nx, y = Math.floor(k / nx) % ny, z = Math.floor(k / (nx * ny));
    for (let s = 0; s < 6; s++) {
      const X = x + (s === 0) - (s === 1), Y = y + (s === 2) - (s === 3), Z = z + (s === 4) - (s === 5);
      if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue;
      const j = k + step[s]; if (seen[j] || TR[j] >= 0) continue;
      seen[j] = 1; stack.push(j);
    }
  }
  for (let k = 0; k < N; k++) if (TR[k] < 0 && !seen[k]) D[k] = -band;
  return { n: [nx, ny, nz], lo, cell, band, d: D };
}

// an open surface (a garment) joined in as a shell `thick` deep: hair rests on a collar instead of going through it
export function addSurface(S, P, T, thick = 0.003) {
  const g = { cell: S.cell, lo: S.lo, band: Math.min(S.band, 0.03), nx: S.n[0], ny: S.n[1], nz: S.n[2] };
  const { D } = unsigned(P, T, inBox(P, T, g), g);
  for (let k = 0; k < D.length; k++) { const d = D[k] - thick; if (d < S.d[k]) S.d[k] = d; }
  return S;
}

// rounded lumps joined in smoothly (each { c, r: [rx, ry, rz] }, a soft join `k` wide): the ears covered over, so hair
// that falls over an ear flows round one smooth rise instead of catching on its rim. A copy; S is left as it is
export function withLumps(S, lumps, k = 0.02) {
  const out = { ...S, d: new Float32Array(S.d) }, [nx, ny, nz] = S.n, c = S.cell;
  for (const b of lumps) {
    const lo = [0, 1, 2].map(a => Math.max(0, Math.floor((b.c[a] - b.r[a] - 2.5 * k - S.lo[a]) / c))), hi = [0, 1, 2].map(a => Math.min(S.n[a] - 1, Math.ceil((b.c[a] + b.r[a] + 2.5 * k - S.lo[a]) / c))), rm = Math.min(b.r[0], b.r[1], b.r[2]);
    for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) {
      const i = (z * ny + y) * nx + x, e = (Math.hypot((S.lo[0] + x * c - b.c[0]) / b.r[0], (S.lo[1] + y * c - b.c[1]) / b.r[1], (S.lo[2] + z * c - b.c[2]) / b.r[2]) - 1) * rm;
      const a = out.d[i], h = Math.max(k - Math.abs(a - e), 0) / k;
      out.d[i] = Math.min(a, e) - h * h * k * 0.25;
    }
  }
  void nz;
  return out;
}

export function dist(S, x, y, z) {
  const [nx, ny, nz] = S.n, c = S.cell;
  let fx = (x - S.lo[0]) / c, fy = (y - S.lo[1]) / c, fz = (z - S.lo[2]) / c;
  if (fx < 0) fx = 0; else if (fx > nx - 1.001) fx = nx - 1.001;
  if (fy < 0) fy = 0; else if (fy > ny - 1.001) fy = ny - 1.001;
  if (fz < 0) fz = 0; else if (fz > nz - 1.001) fz = nz - 1.001;
  const x0 = fx | 0, y0 = fy | 0, z0 = fz | 0, tx = fx - x0, ty = fy - y0, tz = fz - z0, d = S.d, k = (z0 * ny + y0) * nx + x0, sy = nx, sz = nx * ny;
  const c00 = d[k] + (d[k + 1] - d[k]) * tx, c10 = d[k + sy] + (d[k + sy + 1] - d[k + sy]) * tx;
  const c01 = d[k + sz] + (d[k + sz + 1] - d[k + sz]) * tx, c11 = d[k + sz + sy] + (d[k + sz + sy + 1] - d[k + sz + sy]) * tx;
  const a = c00 + (c10 - c00) * ty, b = c01 + (c11 - c01) * ty;
  return a + (b - a) * tz;
}

export function grad(S, x, y, z, out) {
  const h = S.cell;
  const gx = dist(S, x + h, y, z) - dist(S, x - h, y, z), gy = dist(S, x, y + h, z) - dist(S, x, y - h, z), gz = dist(S, x, y, z + h) - dist(S, x, y, z - h);
  const l = Math.hypot(gx, gy, gz);
  if (l < 1e-9) { out[0] = 0; out[1] = 0; out[2] = 0; return false; }
  out[0] = gx / l; out[1] = gy / l; out[2] = gz / l;
  return true;
}

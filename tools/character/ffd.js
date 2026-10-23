// A cube you deform like Blender's lattice (docs/SALON.md): n x n x n control points round a box (3 by default: every
// face a 3 x 3 grid, the corners shared by three faces, the edges' middles by two), a point moved through the box by
// interpolating weights (a free-form deformation: smooth, the space under a handle moving exactly with it, and with the
// points evenly spaced nothing moves). Plain arrays, no three.js. Used by the salon's reference (the video's cube) and
// its fill.
//
//   const c = makeCube(min, max)        c.pts[idx(c, i, j, k)] = [x, y, z]
//   deform(c, p) -> p'                   points outside the box move with its nearest face
//   handles(c) -> [{i, j, k, kind}]     the surface's points: corner, edge, face
//   mirrorOf(c, i, j, k) -> [i', j, k]  the same point on the other side (left-right)

export const idx = (c, i, j, k) => (i * c.n + j) * c.n + k;
const lerp = (a, b, t) => a + (b - a) * t;

export function makeCube(min, max, n = 3) {
  const c = { min: min.slice(), max: max.slice(), n, pts: [], stretch: [1, 1, 1] };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++)
    c.pts.push([lerp(min[0], max[0], i / (n - 1)), lerp(min[1], max[1], j / (n - 1)), lerp(min[2], max[2], k / (n - 1))]);
  return c;
}
export const rest = (c, i, j, k) => [lerp(c.min[0], c.max[0], i / (c.n - 1)), lerp(c.min[1], c.max[1], j / (c.n - 1)), lerp(c.min[2], c.max[2], k / (c.n - 1))];
export const centre = c => [(c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2, (c.min[2] + c.max[2]) / 2];

// Lagrange weights on n evenly spaced nodes: the space under a handle moves exactly with it (Blender's Bezier lattice
// moves it by a fraction), smoothly between; evenly spaced points reproduce every point (no movement at rest)
function basis(n, t) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) { let w = 1; const ti = i / (n - 1); for (let j = 0; j < n; j++) if (j !== i) { const tj = j / (n - 1); w *= (t - tj) / (ti - tj); } out[i] = w; }
  return out;
}

export function isRest(c, eps = 1e-9) {
  if (c.stretch && c.stretch.some(s => Math.abs(s - 1) > eps)) return false;
  const n = c.n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    const p = c.pts[idx(c, i, j, k)], r = rest(c, i, j, k);
    if (Math.abs(p[0] - r[0]) > eps || Math.abs(p[1] - r[1]) > eps || Math.abs(p[2] - r[2]) > eps) return false;
  }
  return true;
}

export function deform(c, p) {
  const n = c.n, t = [0, 1, 2].map(a => (p[a] - c.min[a]) / ((c.max[a] - c.min[a]) || 1));
  const tc = t.map(x => Math.max(0, Math.min(1, x)));
  const bx = basis(n, tc[0]), by = basis(n, tc[1]), bz = basis(n, tc[2]);
  let q = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const w = bx[i] * by[j];
    for (let k = 0; k < n; k++) { const ww = w * bz[k]; const P = c.pts[idx(c, i, j, k)]; q[0] += ww * P[0]; q[1] += ww * P[1]; q[2] += ww * P[2]; } }
  // outside the box: carried by the displacement at its nearest point on the box
  const pc = [0, 1, 2].map(a => lerp(c.min[a], c.max[a], tc[a]));
  q = [q[0] + p[0] - pc[0], q[1] + p[1] - pc[1], q[2] + p[2] - pc[2]];
  const s = c.stretch || [1, 1, 1];
  if (s[0] !== 1 || s[1] !== 1 || s[2] !== 1) { const m = centre(c); q = q.map((x, a) => m[a] + (x - m[a]) * s[a]); }
  return q;
}

export function handles(c) {
  const n = c.n, out = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    const ends = [i, j, k].filter(x => x === 0 || x === n - 1).length;
    if (!ends) continue;                                             // inside: not a handle
    out.push({ i, j, k, kind: ends === 3 ? "corner" : ends === 2 ? "edge" : "face" });
  }
  return out;
}
export const mirrorOf = (c, i, j, k) => [c.n - 1 - i, j, k];

// the inside point (3 x 3 x 3) follows the faces: their centres' mean, so a pulled face carries the middle along
export function settle(c) {
  if (c.n !== 3) return;
  const f = [[0, 1, 1], [2, 1, 1], [1, 0, 1], [1, 2, 1], [1, 1, 0], [1, 1, 2]].map(([i, j, k]) => c.pts[idx(c, i, j, k)]);
  const r = rest(c, 1, 1, 1), fr = [[0, 1, 1], [2, 1, 1], [1, 0, 1], [1, 2, 1], [1, 1, 0], [1, 1, 2]].map(([i, j, k]) => rest(c, i, j, k));
  // the middle moves by the faces' mean displacement
  const d = [0, 1, 2].map(a => f.reduce((s, p, m) => s + p[a] - fr[m][a], 0) / 6);
  c.pts[idx(c, 1, 1, 1)] = [r[0] + d[0], r[1] + d[1], r[2] + d[2]];
}

// the lines drawn on the cube's faces: every grid line that lies on the surface
export function lines(c) {
  const n = c.n, out = [], on = x => x === 0 || x === n - 1;
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    if (on(a) || on(b)) {
      out.push([...Array(n)].map((_, s) => c.pts[idx(c, s, a, b)]));      // along x
      out.push([...Array(n)].map((_, s) => c.pts[idx(c, a, s, b)]));      // along y
      out.push([...Array(n)].map((_, s) => c.pts[idx(c, a, b, s)]));      // along z
    }
  }
  return out;
}

// the ray's point on the box's inscribed ellipsoid (where it enters, or where it passes closest): the depth a picture's
// pixel is taken to lie at, so the face of the cube that faces a camera is the one that moves its picture
export function ellipsoidHit(c, o, d) {
  const m = centre(c), r = [0, 1, 2].map(a => Math.max(1e-6, (c.max[a] - c.min[a]) / 2));
  const O = [0, 1, 2].map(a => (o[a] - m[a]) / r[a]), Dd = [0, 1, 2].map(a => d[a] / r[a]);
  const A = Dd[0] ** 2 + Dd[1] ** 2 + Dd[2] ** 2, B = 2 * (O[0] * Dd[0] + O[1] * Dd[1] + O[2] * Dd[2]), C = O[0] ** 2 + O[1] ** 2 + O[2] ** 2 - 1;
  const disc = B * B - 4 * A * C;
  const s = disc >= 0 ? (-B - Math.sqrt(disc)) / (2 * A) : -B / (2 * A);
  return [o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s];
}

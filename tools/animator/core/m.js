// Animator v2: the small maths everything else stands on. Plain arrays: a vector [x, y, z], a rotation a quaternion
// [x, y, z, w] (glTF's order), a 4x4 matrix sixteen numbers by columns (glTF's). No three.js: the same file runs in
// the page and in node.
export const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  mad: (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  // a's part square to the unit vector n
  perp: (a, n) => { const d = a[0] * n[0] + a[1] * n[1] + a[2] * n[2]; return [a[0] - n[0] * d, a[1] - n[1] * d, a[2] - n[2] * d]; },
};
export const Q = {
  id: () => [0, 0, 0, 1],
  mul: (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]],
  conj: a => [-a[0], -a[1], -a[2], a[3]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2], a[3]) || 1; return [a[0] / l, a[1] / l, a[2] / l, a[3] / l]; },
  axis: (ax, ang) => { const n = V.norm(ax), s = Math.sin(ang / 2); return [n[0] * s, n[1] * s, n[2] * s, Math.cos(ang / 2)]; },
  rot: (q, v) => {                                           // v turned by q
    const x = q[0], y = q[1], z = q[2], w = q[3], tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
    return [v[0] + w * tx + y * tz - z * ty, v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx];
  },
  slerp: (a, b, t) => {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; const s = d < 0 ? -1 : 1; d = Math.abs(d);
    if (d > 0.9995) return Q.norm([a[0] + (s * b[0] - a[0]) * t, a[1] + (s * b[1] - a[1]) * t, a[2] + (s * b[2] - a[2]) * t, a[3] + (s * b[3] - a[3]) * t]);
    const th = Math.acos(d), k0 = Math.sin((1 - t) * th) / Math.sin(th), k1 = s * Math.sin(t * th) / Math.sin(th);
    return [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1, a[3] * k0 + b[3] * k1];
  },
  // the shortest turn that takes unit vector a onto unit vector b
  fromTo: (a, b) => {
    const d = V.dot(a, b); if (d > 0.999999) return [0, 0, 0, 1];
    if (d < -0.999999) { let ax = V.cross([1, 0, 0], a); if (V.len(ax) < 1e-6) ax = V.cross([0, 1, 0], a); return Q.axis(ax, Math.PI); }
    const c = V.cross(a, b); return Q.norm([c[0], c[1], c[2], 1 + d]);
  },
  // from three unit axes at right angles (the columns of a rotation matrix)
  basis: (x, y, z) => {
    const m00 = x[0], m01 = y[0], m02 = z[0], m10 = x[1], m11 = y[1], m12 = z[1], m20 = x[2], m21 = y[2], m22 = z[2], tr = m00 + m11 + m22; let q;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4]; }
    else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
    else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s]; }
    else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s]; }
    return Q.norm(q);
  },
  // the turn that takes the frame (d0 along, h0 across) onto (d along, h across): a bone and its hinge, both ways
  frame: (d0, h0, d, h) => {
    const b0 = frameOf(d0, h0), b1 = frameOf(d, h);
    return Q.mul(Q.basis(b1[0], b1[1], b1[2]), Q.conj(Q.basis(b0[0], b0[1], b0[2])));
  },
  angle: q => 2 * Math.acos(Math.min(1, Math.abs(q[3]))),
  // a turn's part about one axis (the twist), for reading an angle back
  twist: (q, ax) => { const p = V.mul(ax, V.dot([q[0], q[1], q[2]], ax)), t = Q.norm([p[0], p[1], p[2], q[3]]); let a = 2 * Math.atan2(V.dot([t[0], t[1], t[2]], ax), t[3]); if (a > Math.PI) a -= 2 * Math.PI; else if (a < -Math.PI) a += 2 * Math.PI; return a; },   // (-180 .. 180 degrees: q and -q are one turn)
};
function frameOf(d, h) { const x = V.norm(d), y = V.norm(V.perp(h, x)), z = V.cross(x, y); return [x, y, z]; }
// rotations about the character's own axes (x across, y up, z forward: rig.js turns a file's axes into these)
export const rx = a => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)], ry = a => [0, Math.sin(a / 2), 0, Math.cos(a / 2)], rz = a => [0, 0, Math.sin(a / 2), Math.cos(a / 2)];
export const M4 = {
  id: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  mul: (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; },
  trs: (t, q, s = [1, 1, 1]) => {
    const x = q[0], y = q[1], z = q[2], w = q[3], xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
    return [(1 - 2 * (yy + zz)) * s[0], 2 * (xy + wz) * s[0], 2 * (xz - wy) * s[0], 0, 2 * (xy - wz) * s[1], (1 - 2 * (xx + zz)) * s[1], 2 * (yz + wx) * s[1], 0,
      2 * (xz + wy) * s[2], 2 * (yz - wx) * s[2], (1 - 2 * (xx + yy)) * s[2], 0, t[0], t[1], t[2], 1];
  },
  point: (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]],
  dir: (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]],
  // a matrix with no shear taken apart
  split: m => {
    const sx = Math.hypot(m[0], m[1], m[2]), sy = Math.hypot(m[4], m[5], m[6]), sz = Math.hypot(m[8], m[9], m[10]);
    const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]), k = det < 0 ? -1 : 1;
    return { t: [m[12], m[13], m[14]], q: Q.basis([m[0] / sx * k, m[1] / sx * k, m[2] / sx * k], [m[4] / sy, m[5] / sy, m[6] / sy], [m[8] / sz, m[9] / sz, m[10] / sz]), s: [sx * k, sy, sz] };
  },
  inv: m => {                                                // any 4x4 (bind matrices are rigid, but a scale may be in them)
    const a = m, o = new Array(16), b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5],
      b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6], b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12],
      b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; det = 1 / det;
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
    return o;
  },
};
export const DEG = Math.PI / 180;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };   // 0 at a, 1 at b, smooth
export const sm2 = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };   // the same, smoother at its ends
export const wrap01 = x => x - Math.floor(x);
// a bump: 0 at a and b, 1 at their middle (a raised cosine)
export const hump = (a, b, x) => (x <= a || x >= b) ? 0 : 0.5 - 0.5 * Math.cos(2 * Math.PI * (x - a) / (b - a));
// a curve through points [[x, y], ...] (x rising), smooth and never overshooting (monotone cubic); periodic over
// `period` when given (the last point then wraps onto the first)
export function curve(pts, period = 0) {
  const P = period ? [...pts, [pts[0][0] + period, pts[0][1]]] : pts, n = P.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0]));
  for (let i = 0; i < n; i++) {
    const a = i > 0 ? d[i - 1] : (period ? d[n - 2] : d[0]), b = i < n - 1 ? d[i] : (period ? d[0] : d[n - 2]);
    m[i] = a * b <= 0 ? 0 : 2 * a * b / (a + b);           // (the harmonic mean: no overshoot between points)
  }
  return x => {
    if (period) x = P[0][0] + ((x - P[0][0]) % period + period) % period; else x = clamp(x, P[0][0], P[n - 1][0]);
    let i = 0; while (i < n - 2 && x > P[i + 1][0]) i++;
    const h = P[i + 1][0] - P[i][0], t = (x - P[i][0]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * P[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * P[i + 1][1] + (t3 - t2) * h * m[i + 1];
  };
}
// a seeded random number, 0..1 (so the same character always gets the same idle)
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

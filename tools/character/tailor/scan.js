// Reading a body for the tailor: horizontal slices (loops), and from them the landmarks every garment is cut to (the crotch, the
// waist, the armpit, the neck, the arms' and legs' centre lines). Works on any standing, facing +Z, A-posed human mesh (MHR is the
// one it's made for): everything is found from the geometry, so a body shaped in the Studio is measured the same way.
import { clamp } from "./mesh.js";

/** the loops where the plane y = h cuts the mesh: [{cx, cz, area, perim, x0, x1, z0, z1, pts: [[x, z]...]}] */
export function slice(P, T, h, tris = null) {
  const seg = new Map(), pt = new Map();
  const key = (a, b) => (a < b ? a + "_" + b : b + "_" + a);
  const at = (a, b) => {
    const k = key(a, b); let r = pt.get(k);
    if (!r) { const ya = P[a * 3 + 1], yb = P[b * 3 + 1], t = (h - ya) / (yb - ya); r = [P[a * 3] + (P[b * 3] - P[a * 3]) * t, P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * t, k]; pt.set(k, r); }
    return r;
  };
  const each = tris || { length: T.length / 3 };
  for (let q = 0; q < each.length; q++) {
    const t = (tris ? tris[q] : q) * 3, v = [T[t], T[t + 1], T[t + 2]], y = v.map(i => P[i * 3 + 1] - h);
    if ((y[0] > 0) === (y[1] > 0) && (y[1] > 0) === (y[2] > 0)) continue;
    const cr = [];
    for (let k = 0; k < 3; k++) { const a = v[k], b = v[(k + 1) % 3]; if ((y[k] > 0) !== (y[(k + 1) % 3] > 0)) cr.push(at(a, b)); }
    if (cr.length !== 2) continue;
    for (const [p, q] of [[cr[0], cr[1]], [cr[1], cr[0]]]) { if (!seg.has(p[2])) seg.set(p[2], []); seg.get(p[2]).push(q); }
  }
  const used = new Set(), loops = [];
  for (const [k0] of seg) {
    if (used.has(k0)) continue;
    const poly = []; let k = k0, prev = null;
    for (let guard = 0; guard < 100000; guard++) {
      used.add(k); const p = pt.get(k); poly.push([p[0], p[1]]);
      const opts = (seg.get(k) || []).filter(q => q[2] !== prev && !used.has(q[2]));
      if (!opts.length) break; prev = k; k = opts[0][2];
    }
    if (poly.length < 3) continue;
    let A = 0, cx = 0, cz = 0, per = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < poly.length; i++) {
      const [x, z] = poly[i], [X, Z] = poly[(i + 1) % poly.length], c = x * Z - X * z;
      A += c; cx += (x + X) * c; cz += (z + Z) * c; per += Math.hypot(X - x, Z - z);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    A /= 2; if (Math.abs(A) < 1e-9) continue;
    loops.push({ cx: cx / (6 * A), cz: cz / (6 * A), area: Math.abs(A), perim: per, x0, x1, z0, z1, pts: poly });
  }
  return loops;
}

/** the landmarks of a body (metres, feet on the floor): see the object below */
export function scan(P, T) {
  let top = -1e9, low = 1e9;
  for (let i = 1; i < P.length; i += 3) { top = Math.max(top, P[i]); low = Math.min(low, P[i]); }
  const H = top - low, s = H / 1.726;                              // MHR's average at 1.726 m is what the numbers below were found on
  const step = 0.005, nr = Math.floor((H - 0.02) / step) + 1, bucket = Array.from({ length: nr }, () => []);
  for (let t = 0; t < T.length / 3; t++) {                         // each triangle in the rows its height spans
    const a = P[T[t * 3] * 3 + 1], b = P[T[t * 3 + 1] * 3 + 1], c = P[T[t * 3 + 2] * 3 + 1];
    const r0 = Math.max(0, Math.ceil((Math.min(a, b, c) - low - 0.01) / step)), r1 = Math.min(nr - 1, Math.floor((Math.max(a, b, c) - low - 0.01) / step));
    for (let r = r0; r <= r1; r++) bucket[r].push(t);
  }
  const rows = [];
  for (let r = 0; r < nr; r++) { const y = low + 0.01 + r * step; rows.push({ y, loops: slice(P, T, y, bucket[r]) }); }
  const central = r => r.loops.filter(l => l.x0 < 0 && l.x1 > 0).sort((a, b) => b.area - a.area)[0];
  const at = y => rows[clamp(Math.round((y - 0.01) / step), 0, rows.length - 1)];

  let crotchY = 0;
  for (const r of rows.filter(r => r.y > 0.40 * H && r.y < 0.62 * H).reverse()) if (!central(r)) { crotchY = r.y; break; }
  crotchY += step / 2;

  let armpitY = 0.75 * H;
  for (const r of rows.filter(r => r.y > 0.68 * H && r.y < 0.9 * H).reverse()) {
    const c = central(r); if (!c) continue;
    if (c.x1 - c.x0 < 0.52 * s && r.loops.length >= 3) { armpitY = r.y + step; break; }
  }

  const arm = { L: [], R: [] };
  for (const r of rows.filter(r => r.y <= armpitY && r.y > 0.45 * H).reverse()) {
    const c = central(r), hw = c ? Math.max(-c.x0, c.x1) : 0.2 * s;
    for (const l of r.loops) {
      if (l === c || l.area < 0.0004) continue;
      if (Math.abs(l.cx) < hw * 1.1 + 0.02) continue;
      arm[l.cx > 0 ? "L" : "R"].push({ y: r.y, cx: l.cx, cz: l.cz, area: l.area, loop: l });
    }
  }
  const leg = { L: [], R: [] };
  for (const r of rows.filter(r => r.y < crotchY && r.y > 0.03)) {
    const ls = r.loops.filter(l => Math.abs(l.cx) < 0.3 * s).sort((a, b) => b.area - a.area).slice(0, 2);
    for (const l of ls) leg[l.cx > 0 ? "L" : "R"].push({ y: r.y, cx: l.cx, cz: l.cz, area: l.area, loop: l });
  }
  return { H, s, rows, crotchY, armpitY, arm, leg, central, at, top, low };
}

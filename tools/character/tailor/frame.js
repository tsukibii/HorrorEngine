// The body's frame for the tailor: the heights garments are cut at (neck, armpit, bust, waist, hips, crotch, knee),
// the neck's axis, the torso's axis at any height, each arm's centre line from the shoulder joint to the fingertips
// (its length, the wrist), and which side of the sleeve seam a point is on. Made from scan.js's slices.
import { scan } from "./scan.js";
import { clamp, lerp } from "./mesh.js";

const avg = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);

// a polyline resampled every `step` metres of its length, smoothed: [[x, y, z]...]
function resample(pts, step, passes = 3) {
  let P = pts.map(p => p.slice());
  for (let k = 0; k < passes; k++) P = P.map((p, i) => i === 0 || i === P.length - 1 ? p : [0, 1, 2].map(a => (P[i - 1][a] + 2 * p[a] + P[i + 1][a]) / 4));
  const out = [P[0]]; let carry = 0;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    let t = step - carry;
    while (t <= L) { out.push([0, 1, 2].map(k => a[k] + (b[k] - a[k]) * t / L)); t += step; }
    carry = L - (t - step);
  }
  return out;
}

/** a centre line you can measure against: t (metres along it) and the distance to it, for any point */
export class Line {
  constructor(pts) {
    this.p = pts; this.t = [0];
    for (let i = 1; i < pts.length; i++) this.t.push(this.t[i - 1] + Math.hypot(...[0, 1, 2].map(k => pts[i][k] - pts[i - 1][k])));
    this.len = this.t[this.t.length - 1];
  }
  /** [t, distance, segment] of the point's closest place on the line (t can run past either end) */
  project(x, y, z) {
    const P = this.p; let best = 1e9, bt = 0, bs = 0;
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i], b = P[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L2 = dx * dx + dy * dy + dz * dz;
      let u = ((x - a[0]) * dx + (y - a[1]) * dy + (z - a[2]) * dz) / L2;
      if (i > 0) u = Math.max(0, u); if (i + 2 < P.length) u = Math.min(1, u);
      const qx = a[0] + dx * u - x, qy = a[1] + dy * u - y, qz = a[2] + dz * u - z, d = qx * qx + qy * qy + qz * qz;
      if (d < best) { best = d; bt = this.t[i] + u * Math.sqrt(L2); bs = i; }
    }
    return [bt, Math.sqrt(best), bs];
  }
  seg(t) { const i = this.t.findIndex(v => v >= t); return clamp(i < 0 ? this.p.length - 1 : i, 1, this.p.length - 1); }
  at(t) {
    const i = this.seg(t), a = this.p[i - 1], b = this.p[i];
    const u = (t - this.t[i - 1]) / ((this.t[i] - this.t[i - 1]) || 1);
    return [0, 1, 2].map(k => a[k] + (b[k] - a[k]) * u);
  }
  dir(t) {
    const i = this.seg(t), a = this.p[i - 1], b = this.p[i], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d) || 1;
    return d.map(v => v / l);
  }
}

/** everything a garment is cut to, measured on this body (P, T: metres, Y up, facing +Z, feet on the floor) */
export function frame(P, T) {
  const S = scan(P, T), { H, s } = S;
  const rowsIn = (a, b) => S.rows.filter(r => r.y >= a && r.y <= b);
  const torsoLoop = r => S.central(r);

  // the neck: the narrowest central loop above the shoulders, and its base where the shoulders start to spread
  const up = rowsIn(S.armpitY + 0.05 * s, 0.93 * H).map(r => ({ y: r.y, l: torsoLoop(r) })).filter(r => r.l);
  const neckW = Math.min(...up.filter(r => r.y > S.armpitY + 0.15 * s).map(r => r.l.x1 - r.l.x0));
  const nb = up.find(r => r.l.x1 - r.l.x0 < 1.3 * neckW) || up[up.length - 1];
  const neckBaseY = nb.y;
  const col = up.filter(r => r.y >= neckBaseY && r.y <= neckBaseY + 0.04 * s);
  const neck = { cx: avg(col.map(r => r.l.cx)), cz: avg(col.map(r => r.l.cz)), r: avg(col.map(r => Math.sqrt(r.l.area / Math.PI))), y: neckBaseY };

  // the torso: its loops' centres between the crotch and the armpit, the waist the narrowest, the hips the widest, the bust the deepest
  const tor = rowsIn(S.crotchY + 0.01, S.armpitY).map(r => ({ y: r.y, l: torsoLoop(r) })).filter(r => r.l);
  const axisRows = tor.map(r => [r.y, r.l.cx, r.l.cz]).concat([[neckBaseY, neck.cx, neck.cz]]);
  const torsoAxis = y => {                                          // [cx, cz] of the torso at height y (held at the ends)
    if (y <= axisRows[0][0]) return [axisRows[0][1], axisRows[0][2]];
    for (let i = 1; i < axisRows.length; i++) if (axisRows[i][0] >= y) {
      const a = axisRows[i - 1], b = axisRows[i], u = (y - a[0]) / ((b[0] - a[0]) || 1);
      return [lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
    }
    const l = axisRows[axisRows.length - 1]; return [l[1], l[2]];
  };
  const pick = (a, b, f, best) => { let r = null; for (const t of tor) if (t.y >= a && t.y <= b && (!r || best(f(t), f(r)))) r = t; return r; };
  const waist = pick(S.crotchY + 0.14 * s, S.armpitY - 0.12 * s, t => t.l.perim, (a, b) => a < b);
  const hips = pick(S.crotchY + 0.03 * s, S.crotchY + 0.16 * s, t => t.l.z0, (a, b) => a < b);   // the seat at its fullest
  const bust = pick(waist.y + 0.05 * s, S.armpitY, t => t.l.z1, (a, b) => a > b);

  // the arms: the biggest loop beyond the torso on each side, per row, as a line; up to the shoulder joint, out to the fingertips
  const arms = {};
  for (const side of ["L", "R"]) {
    const sg = side === "L" ? 1 : -1, byRow = new Map();
    for (const p of S.arm[side]) { const q = byRow.get(p.y); if (!q || p.area > q.area) byRow.set(p.y, p); }
    const pts = [...byRow.values()].sort((a, b) => b.y - a.y).map(p => [p.cx, p.y, p.cz]);
    // the hand is cut into fingers lower down: follow the line only while it moves on smoothly
    const keep = [pts[0]];
    for (const p of pts.slice(1)) { const q = keep[keep.length - 1]; if (Math.hypot(p[0] - q[0], p[2] - q[2]) < 0.04 * s) keep.push(p); else break; }
    let line = resample(keep, 0.01 * s);
    // up the upper arm's direction to the shoulder joint, as far as the arm is long from the armpit to the shoulder's top
    const a = line[0], b = line[Math.min(8, line.length - 1)], d = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dl = Math.hypot(...d);
    const ext = 0.07 * s, J = [a[0] + d[0] / dl * ext, a[1] + d[1] / dl * ext, a[2] + d[2] / dl * ext];
    const head = []; for (let k = 6; k >= 1; k--) head.push([0, 1, 2].map(i => a[i] + (J[i] - a[i]) * k / 6));
    const L = new Line(head.concat(line));
    // the arm's own points: everything past the seam plane near the line. The fingertip is the farthest of them
    const seam = L.t[6];                                           // the plane through the armpit's loop, square to the arm
    let tip = L.len, rs = [];
    for (let i = 0; i < P.length; i += 3) {
      if (P[i] * sg < 0.12 * s || P[i + 1] < S.crotchY) continue;
      const [t, dd] = L.project(P[i], P[i + 1], P[i + 2]);
      if (t < seam || dd > 0.11 * s) continue;
      tip = Math.max(tip, t); rs.push([t, dd]);
    }
    // the wrist: the thinnest place in the arm's last third before the hand
    const bins = new Map();
    for (const [t, dd] of rs) { const k = Math.round(t / (0.01 * s)); if (!bins.has(k)) bins.set(k, []); bins.get(k).push(dd); }
    const prof = [...bins.entries()].map(([k, ds]) => [k * 0.01 * s, ds.sort((x, y) => x - y)[Math.floor(ds.length * 0.5)]]).sort((x, y) => x[0] - y[0]);
    const cand = prof.filter(([t]) => t > 0.5 * tip && t < 0.9 * tip), rmin = Math.min(...cand.map(p => p[1]));
    const thin = cand.filter(p => p[1] <= 1.12 * rmin);                // the forearm's thin end: the last of it before the hand widens
    const wrist = thin.length ? thin[thin.length - 1][0] : 0.75 * tip;
    const elbow = prof.filter(([t]) => t > 0.35 * tip && t < 0.6 * tip);
    arms[side] = { line: L, J, seam, tip, wrist, elbow: elbow.length ? elbow.reduce((m, p) => (p[1] < m[1] ? p : m))[0] : 0.45 * tip, sg, profile: prof };
  }

  // the legs: their loops' centres from the crotch to the floor
  const legs = {}, legLines = {};
  for (const side of ["L", "R"]) {
    const pts = S.leg[side].slice().sort((a, b) => b.y - a.y);
    const byRow = new Map(); for (const p of pts) { const q = byRow.get(p.y); if (!q || p.area > q.area) byRow.set(p.y, p); }
    legLines[side] = new Line(resample([...byRow.values()].sort((a, b) => b.y - a.y).map(p => [p.cx, p.y, p.cz]), 0.02 * s, 6));
    const knee = pts.filter(p => p.y > 0.22 * H && p.y < 0.34 * H).reduce((m, p) => (!m || p.area < m.area ? p : m), null);
    legs[side] = { knee: knee ? knee.y : 0.28 * H, ankle: 0.05 * H };
  }

  const F = {
    H, s, scan: S, neck, torsoAxis, crotchY: S.crotchY, armpitY: S.armpitY, waistY: waist.y, hipY: hips.y, bustY: bust.y, neckBaseY,
    kneeY: avg([legs.L.knee, legs.R.knee]), ankleY: 0.045 * H, arms, legs, legLines,
    // the torso's panels as arc lengths, the parts' radii: fabric coordinates in metres (tailor/uv.js)
    torsoU: torsoArcs(S, torsoAxis, S.crotchY - 0.06 * s, S.armpitY - 0.015 * s),
    torsoR: avg(tor.filter(t => t.y > waist.y && t.y < S.armpitY).map(t => t.l.perim / (2 * Math.PI))),
    armR: avg(arms.L.profile.filter(([t]) => t > arms.L.seam && t < arms.L.wrist).map(p => p[1])) + 0.01 * s,
    legR: avg(S.leg.L.filter(p => p.y > 0.3 * H).map(p => Math.sqrt(p.area / Math.PI))),
    /** the arm a point belongs to ("L", "R") with its t along that arm, or null for the rest of the body */
    arm(x, y, z) {
      if (y < S.crotchY || Math.abs(x) < 0.12 * s) return null;
      const A = arms[x > 0 ? "L" : "R"], [t, d] = A.line.project(x, y, z);
      return t >= A.seam && d < 0.11 * s ? { side: x > 0 ? "L" : "R", t, d, A } : null;
    },
    /** the angle round the torso's axis at this height: 0 at the front (+Z), +pi/2 to the body's left (+X) */
    theta(x, y, z) { const [cx, cz] = torsoAxis(y); return Math.atan2(x - cx, z - cz); },
  };
  return F;
}

/** the torso's outline at every row as arc lengths by angle round its middle, from the front's middle (the front half,
    +-pi/2) and from the back's (the back half): u(x, y, z) is how far across a panel laid on the body a point is, in
    metres, the way a flat front and back sewn at the sides would lie */
function torsoArcs(S, axis, y0, y1) {
  const rows = [];
  for (const r of S.rows) {
    if (r.y < y0 || r.y > y1) continue;
    const l = S.central(r); if (!l) continue;
    const [cx, cz] = axis(r.y);
    const pts = l.pts.map(p => [Math.atan2(p[0] - cx, p[1] - cz), p[0], p[1]]).sort((a, b) => a[0] - b[0]);
    const ang = [], arc = []; let acc = 0;
    for (let i = 0; i < pts.length; i++) { if (i) acc += Math.hypot(pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); ang.push(pts[i][0]); arc.push(acc); }
    acc += Math.hypot(pts[0][1] - pts[pts.length - 1][1], pts[0][2] - pts[pts.length - 1][2]);   // round the back's middle to the start
    ang.push(pts[0][0] + 2 * Math.PI); arc.push(acc);
    const at = a => { let lo = 0, hi = ang.length - 1; if (a < ang[0]) a += 2 * Math.PI; if (a >= ang[hi]) return arc[hi];
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ang[m] <= a) lo = m; else hi = m; } return arc[lo] + (arc[hi] - arc[lo]) * (a - ang[lo]) / ((ang[hi] - ang[lo]) || 1); };
    const zero = at(0), pi = at(Math.PI), total = acc;
    const point = a => { let lo = 0, hi = ang.length - 2; if (a < ang[0]) a += 2 * Math.PI;   // the outline's point at an angle
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ang[m] <= a) lo = m; else hi = m; }
      const p0 = pts[lo], p1 = pts[(lo + 1) % pts.length], u = (a - ang[lo]) / ((ang[lo + 1] - ang[lo]) || 1); return [p0[1] + (p1[1] - p0[1]) * u, p0[2] + (p1[2] - p0[2]) * u]; };
    rows.push({ y: r.y, cx, cz, at, zero, pi, total, point });
  }
  const HALF = Math.PI / 2;
  const one = (R, x, z, back) => {
    let a = Math.atan2(x - R.cx, z - R.cz);
    if (!back) return R.at(Math.max(-HALF, Math.min(HALF, a))) - R.zero;            // the front: from its middle
    if (Math.abs(a) < HALF) a = a < 0 ? -HALF : HALF;
    let b = R.at(a) - R.pi;                                                          // the back: from its middle (a = +-pi), round the wrap
    if (b > R.total / 2) b -= R.total; else if (b < -R.total / 2) b += R.total;
    return 2 + b;                                                                    // a panel of its own, reading left to right from behind
  };
  // above the top row (the armpit's) a yoke: that row's outline by x, so the lines stay upright over the shoulders
  const top = rows[rows.length - 1], yoke = top && (back => {
    const xs = [], us = [];
    for (let a = -HALF; a <= HALF + 1e-9; a += Math.PI / 180) {
      const aa = back ? (a < 0 ? -Math.PI - a : Math.PI - a) : a;
      const pt = top.point(aa); xs.push(pt[0]); us.push(one(top, pt[0], pt[1], back));
    }
    const ord = xs.map((v, i) => i).sort((i, j) => xs[i] - xs[j]), X = ord.map(i => xs[i]), U = ord.map(i => us[i]);
    return x => { const n = X.length; if (x <= X[0]) return U[0] - (X[0] - x) * Math.sign(U[n - 1] - U[0]); if (x >= X[n - 1]) return U[n - 1] + (x - X[n - 1]) * Math.sign(U[n - 1] - U[0]);
      let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (X[m] <= x) lo = m; else hi = m; } return U[lo] + (U[hi] - U[lo]) * (x - X[lo]) / ((X[hi] - X[lo]) || 1); };
  });
  const yokes = top ? [yoke(false), yoke(true)] : null;
  return (x, y, z, back = z < (rows[0]?.cz ?? 0)) => {
    if (!rows.length) return x;
    const row = y2 => {
      if (y2 <= rows[0].y) return one(rows[0], x, z, back);
      if (y2 >= top.y) return one(top, x, z, back);
      let lo = 0, hi = rows.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rows[m].y <= y2) lo = m; else hi = m; }
      const u = (y2 - rows[lo].y) / ((rows[hi].y - rows[lo].y) || 1);
      return one(rows[lo], x, z, back) * (1 - u) + one(rows[hi], x, z, back) * u;
    };
    const w = Math.max(0, Math.min(1, (y - (top.y - 0.04)) / 0.04));                // into the yoke over the last 4 cm
    return w <= 0 ? row(y) : row(y) * (1 - w) + yokes[back ? 1 : 0](x) * w;
  };
}

/** a named height on this body: "waist", "hip+0.03", "crotch-0.1", or a number (metres) */
export function height(F, h) {
  if (typeof h === "number") return h;
  const m = /^([a-z]+)\s*([+-]\s*[\d.]+)?$/.exec(String(h).trim());
  if (!m) throw new Error(`a height: ${h}`);
  const base = { neck: F.neckBaseY, armpit: F.armpitY, bust: F.bustY, waist: F.waistY, hip: F.hipY, crotch: F.crotchY, knee: F.kneeY, ankle: F.ankleY, floor: 0 }[m[1]];
  if (base === undefined) throw new Error(`no height called ${m[1]}`);
  return base + (m[2] ? parseFloat(m[2].replace(/\s/g, "")) * F.s : 0);
}

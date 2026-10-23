// The tailor's pieces: what each kind of garment keeps of the body (its cut lines as values, positive on the cloth),
// how loose it sits, and the details lifted off it (bands, plackets, pockets, collars, belts, buttons).
// Every length is in metres on MHR's average body (1.726 m) and scales with the body's height (F.s).
import { cut, normals, adjacency, subdivide, PointGrid, Surface, smooth } from "./mesh.js";
import { crop, relax, thicken, lifted } from "./fit.js";
import { height } from "./frame.js";

const TAU = Math.PI * 2;
const front = (z, cz, w = 0.03) => smooth(cz - w, cz + w, z);      // 0 at the back, 1 at the front

// ---- the cut lines ------------------------------------------------------------------------------------------------

/** the neckline: a cone round the neck's base (it rises away from the neck, so the shoulders are never cut), dipped
    at the front (and the back) into a scoop, a V or a square */
export function neckline(F, o = {}) {
  const s = F.s, N = F.neck, depth = (o.depth ?? 0.012) * s, back = (o.back ?? 0.0) * s, w = (o.width ?? 0.085) * s;
  const tilt = (o.tilt ?? 0.022) * s, k = 1.6, r0 = N.r + ((o.open ?? 0.004) + (o.ease ?? 0)) * s, shape = o.shape || "round";   // the cone starts where the cloth is
  const g = u => { u = Math.min(1, Math.abs(u)); return shape === "v" ? 1 - u : shape === "square" ? (u < 0.85 ? 1 : 1 - smooth(0.85, 1, u)) : Math.sqrt(1 - u * u); };
  const cutY = (x, y, z) => {
    const dx = x - N.cx, dz = z - N.cz, rho = Math.hypot(dx, dz), c = rho > 1e-6 ? dz / rho : 0;
    const base = N.y - tilt * c;                                    // lower at the front, higher at the back: the neck's base slopes
    const cone = k * Math.max(0, rho - r0);
    const fr = front(z, N.cz, 0.025 * s), G = g(dx / w) * fr, B = g(dx / w) * (1 - fr);
    return base + (1 - Math.max(G, B * (back > 0))) * cone - depth * G - back * B;
  };
  const v = (x, y, z) => cutY(x, y, z) - y;
  v.cutY = cutY;
  return v;
}

/** a hem round the torso at height `at`, longer at the front or back by `front`/`back` (metres) */
const torsoHem = (F, at, o = {}) => {
  const y0 = height(F, at), fr = (o.front ?? 0) * F.s, bk = (o.back ?? 0) * F.s, sd = (o.side ?? 0) * F.s;
  return (x, y, z) => {
    const th = F.theta(x, y, z), c = Math.cos(th), si = Math.abs(Math.sin(th));
    return y - (y0 - fr * Math.max(0, c) - bk * Math.max(0, -c) + sd * si * si);
  };
};
/** a waistline at `at`, dropped at the front by `drop` (a low rise) and raised at the back by `rise` */
const waistline = (F, at, o = {}) => {
  const y0 = height(F, at), dr = (o.drop ?? 0.01) * F.s, ri = (o.rise ?? 0.02) * F.s;
  return (x, y, z) => { const c = Math.cos(F.theta(x, y, z)); return y0 - dr * Math.max(0, c) + ri * Math.max(0, -c) - y; };
};
/** the length along the arm a sleeve reaches: a number (metres from the shoulder joint), or "wrist", "elbow", "short" */
const sleeveEnd = (F, side, L) => {
  const A = F.arms[side], s = F.s;
  if (L === "wrist" || L === "long") return A.wrist - 0.012 * s;
  if (L === "elbow") return A.elbow + 0.02 * s;
  if (L === "short") return A.seam + 0.13 * s;
  if (L === "cap") return A.seam + 0.05 * s;
  return Math.max(A.seam + 0.03 * s, L * s);
};

/** a garment's value at a point (>= 0 on the cloth) and, for the fit, its ease and clearance */
function cutter(F, p) {
  const s = F.s;
  const neck = p.neck === false ? null : neckline(F, { ease: p.ease?.body, ...(p.neck || {}) });
  const ends = p.sleeve === undefined || p.sleeve === false ? null : { L: sleeveEnd(F, "L", p.sleeve), R: sleeveEnd(F, "R", p.sleeve) };
  const hem = p.hem ? torsoHem(F, p.hem.at, p.hem) : null;
  const waist = p.waist ? waistline(F, p.waist.at, p.waist) : null;
  const legY = p.legs ? height(F, p.legs.to) : null;
  return (x, y, z) => {
    const a = F.arm(x, y, z);
    let v = 1;
    if (neck) v = Math.min(v, neck(x, y, z));
    if (a) return Math.min(v, ends ? ends[a.side] - a.t : -1);
    if (hem) v = Math.min(v, hem(x, y, z));
    if (waist) v = Math.min(v, waist(x, y, z));
    if (legY !== null) v = Math.min(v, y - legY);
    return v;
  };
}

// ---- the body, ready to be cut ------------------------------------------------------------------------------------

/** the body once per character: its frame and the surface to keep the cloth off */
export function prepare(P, T, F) {
  const surf = new Surface(P, T);
  return { F, P, T, surf, N: surf.N };
}

/** how far out the clothes already worn reach over each of `pts` (points on the skin, flat xyz): their outsides'
    distances from the skin, spread a couple of rings so the next layer eases over their edges */
export function layers(B, pts, T, under) {
  const n = pts.length / 3, extra = new Float32Array(n);
  if (!under.length) return extra;
  const grid = new PointGrid(pts, 0.008), hit = {}, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pts.length; i++) { lo[i % 3] = Math.min(lo[i % 3], pts[i]); hi[i % 3] = Math.max(hi[i % 3], pts[i]); }
  for (const g of under) for (const o of g.outer) {
    const P = o.P;
    for (let i = 0; i < P.length; i += 3) {
      if (P[i + 1] < lo[1] - 0.02 || P[i + 1] > hi[1] + 0.02 || P[i] < lo[0] - 0.1 || P[i] > hi[0] + 0.1) continue;
      const r = B.surf.closest(P[i], P[i + 1], P[i + 2], 0.08, hit); if (!r || r.d <= 0) continue;
      const v = grid.nearest(r.x, r.y, r.z, 0.02); if (v < 0) continue;
      extra[v] = Math.max(extra[v], r.d + (g.thickness || 0.002));
    }
  }
  const adj = adjacency(n, T);
  const spread = (fn, k) => { for (let it = 0; it < k; it++) { const c = Float32Array.from(extra); for (let i = 0; i < n; i++) { let m = c[i], sum = c[i], cnt = 1; for (let q = adj.start[i]; q < adj.start[i + 1]; q++) { const v = c[adj.list[q]]; m = Math.max(m, v); sum += v; cnt++; } extra[i] = fn(c[i], m, sum / cnt); } } };
  spread((c, m) => m, 1);                                           // close the holes between the garments' points
  spread((c, m, a) => a, 2);                                        // and soften its edges
  return extra;
}

/**
 * A garment cut from the skin: the body's points under it (with a margin) lifted by the ease (plus whatever is worn
 * under it), relaxed `tension` rounds on the body's own mesh (the looser the more), split in four and settled again
 * at that finer size, then cut along its lines. Returns {outer (the cloth's outside), V (its value), neck, ends,
 * legY, waist} for the details.
 */
export function shell(B, p, under) {
  const F = B.F, s = F.s, V = cutter(F, p);
  const n0 = B.P.length / 3, v0 = new Float32Array(n0);
  for (let i = 0; i < n0; i++) v0[i] = V(B.P[i * 3], B.P[i * 3 + 1], B.P[i * 3 + 2]);
  const C = crop(B.P, B.T, v0, 0.06 * s);
  const N = new Float32Array(C.keep.length * 3); C.keep.forEach((i, j) => { N[j * 3] = B.N[i * 3]; N[j * 3 + 1] = B.N[i * 3 + 1]; N[j * 3 + 2] = B.N[i * 3 + 2]; });
  // the ease: the body's, the sleeves', the legs' (growing towards the hem by `flare`), more round the crotch
  const e = p.ease || {}, eb = (e.body ?? 0.008) * s, ea = (e.sleeve ?? e.body ?? 0.008) * s, el = (e.leg ?? e.body ?? 0.008) * s;
  const fl = (e.flare ?? 0) * s, knee = F.kneeY, crotch = F.crotchY, legTo = p.legs ? height(F, p.legs.to) : 0;
  const ease = layers(B, C.P, C.T, under), gap = 0.0015 * s, W = new Float32Array(ease.length);
  for (let j = 0; j < ease.length; j++) if (ease[j] > 0) ease[j] += gap;
  const [ccx, ccz] = F.torsoAxis(crotch), pits = ["L", "R"].map(k => { const A = F.arms[k], q = A.line.at(A.seam); return [q[0] * 0.85, F.armpitY - 0.02 * s, q[2]]; });
  for (let j = 0; j < ease.length; j++) {
    const x = C.P[j * 3], y = C.P[j * 3 + 1], z = C.P[j * 3 + 2], a = F.arm(x, y, z);
    // how freely it smooths: not at all into the armpit or down between the legs (it would web them), a little on the limbs
    const dp = Math.min(...pits.map(q => Math.hypot(x - q[0], y - q[1], z - q[2]))), dc = Math.hypot(x - ccx, y - crotch, z - ccz);
    W[j] = smooth(0.03 * s, 0.11 * s, dp) * (a || y < crotch ? 0.3 : 1);
    if (a) { ease[j] += ea; continue; }
    const legW = 1 - smooth(crotch - 0.02 * s, crotch + 0.06 * s, y);
    ease[j] += eb + (el - eb) * legW + fl * smooth(knee + 0.1 * s, legTo, y) * legW;
    if (p.legs) ease[j] += (e.crotch ?? 0.014) * s * Math.exp(-((dc / (0.08 * s)) ** 2));
  }
  const Q = relax(C.P, C.T, N, ease, { iters: p.tension ?? 16, weight: W, colliders: [{ surf: B.surf }] });
  // four times the triangles, the new points between their parents, settled a few rounds at that size
  const fine = subdivide(Q, C.T), m = fine.P.length / 3, n = Q.length / 3;
  const ease2 = new Float32Array(m), W2 = new Float32Array(m); ease2.set(ease); W2.set(W);
  for (let k = 0; k < m - n; k++) { const a = fine.parents[2 * k], b = fine.parents[2 * k + 1]; ease2[n + k] = (ease[a] + ease[b]) / 2; W2[n + k] = (W[a] + W[b]) / 2; }
  const Qf = relax(fine.P, fine.T, new Float32Array(fine.P.length), ease2, { iters: 4, weight: W2, clear: ease2, colliders: [{ surf: B.surf }] });
  const v = new Float32Array(m);
  for (let j = 0; j < m; j++) v[j] = V(Qf[j * 3], Qf[j * 3 + 1], Qf[j * 3 + 2]);
  const c = cut(Qf, fine.T, v);
  const ends = p.sleeve === undefined || p.sleeve === false ? null : { L: sleeveEnd(F, "L", p.sleeve), R: sleeveEnd(F, "R", p.sleeve) };
  return { outer: { P: c.P, T: c.T }, V, neck: p.neck === false ? null : neckline(F, { ease: p.ease?.body, ...(p.neck || {}) }), ends,
           legY: p.legs ? height(F, p.legs.to) : null, waist: p.waist ? waistline(F, p.waist.at, p.waist) : null };
}

/** a skirt as rings hung from the waist: at every height the body's outline (both legs inside it) plus the ease, never
    narrowing below the hips (a flare widens it, a pencil skirt `taper`s it to the knee), pleats stitched down to the hip */
export function skirt(B, p, colliders) {
  const F = B.F, s = F.s, NA = p.columns || 256, dy = 0.005 * s;
  const y0 = height(F, p.waist?.at ?? "waist-0.04"), y1 = height(F, p.length ?? "knee+0.06"), hipY = F.hipY;
  const [cx, cz] = F.torsoAxis(y0), rows = Math.ceil((y0 - y1) / dy) + 1;
  const ease = (p.ease ?? 0.006) * s, flare = p.flare ?? 0.12, taper = p.taper ?? 0, pleats = p.pleats || null;
  const tri = B.T, P = B.P;
  // the body's outline at a height: its loops (not the arms') as a convex hull, as a radius per angle from (cx, cz)
  const hull = y => {
    const pts = [];
    for (const l of (F.scan.at(y)?.loops || [])) if (Math.abs(l.cx) < 0.3 * s) for (const q of l.pts) pts.push([q[0] - cx, q[1] - cz]);
    for (const c of colliders) {                                     // and what's worn under it
      const Q = c.outer.P; for (let i = 1; i < Q.length; i += 3) if (Math.abs(Q[i] - y) < dy * 0.6 && Math.abs(Q[i - 1]) < 0.3 * s) pts.push([Q[i - 1] - cx, Q[i + 1] - cz]);
    }
    return radii(pts, NA);
  };
  const R = [];
  for (let r = 0; r < rows; r++) {
    const y = y0 - r * dy, h = hull(y), row = new Float32Array(NA);
    for (let k = 0; k < NA; k++) {
      let v = h[k] + ease;
      if (r > 0 && y < hipY) {
        const prev = R[r - 1][k];
        v = Math.max(v, prev + (taper > 0 ? -taper : flare) * dy);
      }
      row[k] = v;
    }
    R.push(row);
  }
  // soften round and down (the hull's corners)
  for (let pass = 0; pass < 2; pass++) for (const row of R) { const c = Float32Array.from(row); for (let k = 0; k < NA; k++) row[k] = Math.max(c[k], (c[(k + NA - 1) % NA] + 2 * c[k] + c[(k + 1) % NA]) / 4); }
  const out = new Float32Array(rows * NA * 3), T = [];
  const stitch = hipY - (pleats?.stitched ?? 0.06) * s;
  for (let r = 0; r < rows; r++) {
    const y = y0 - r * dy;
    for (let k = 0; k < NA; k++) {
      const a = (k / NA - 0.5) * TAU; let rad = R[r][k];
      if (pleats) {                                                  // knife pleats: a saw round the hem, opening below the stitching
        const ph = (k / NA) * pleats.n, f = ph - Math.floor(ph), d = (pleats.depth ?? 0.012) * s * smooth(stitch + 0.02 * s, stitch - 0.04 * s, y);
        rad += d * (pleats.box ? 1 - Math.abs(2 * f - 1) * 2 : f) - d * 0.5;
      }
      if (p.waves) {                                                 // a circle skirt's soft folds, deepening to the hem
        const d = p.waves.depth * s * smooth(hipY, y1, y);
        rad += d * Math.sin(a * p.waves.n + 0.7);
      }
      out.set([cx + Math.sin(a) * rad, y, cz + Math.cos(a) * rad], (r * NA + k) * 3);
    }
  }
  for (let r = 0; r + 1 < rows; r++) for (let k = 0; k < NA; k++) {
    const a = r * NA + k, b = r * NA + (k + 1) % NA, c = (r + 1) * NA + k, d = (r + 1) * NA + (k + 1) % NA;
    T.push(a, b, c, b, d, c);
  }
  const mean = R.map(row => row.reduce((a, v) => a + v, 0) / NA);   // each row's radius: the fabric spreads to the hem as a flared panel
  const radius = y => mean[Math.max(0, Math.min(rows - 1, Math.round((y0 - y) / dy)))];
  return { outer: { P: out, T: new Uint32Array(T) }, V: null, neck: null, rings: { y0, y1, cx, cz, radius } };
}

/** a radius per angle (NA of them, from -pi at k = 0) of the convex hull of 2D points round the origin */
function radii(pts, NA) {
  const R = new Float32Array(NA);
  if (pts.length < 3) return R;
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); const H = lo.concat(up);
  for (let k = 0; k < NA; k++) {
    const a = (k / NA - 0.5) * TAU, dx = Math.sin(a), dz = Math.cos(a); let best = 0;
    for (let i = 0; i < H.length; i++) {
      const p = H[i], q = H[(i + 1) % H.length], ex = q[0] - p[0], ez = q[1] - p[1], den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = (p[0] * ez - p[1] * ex) / den, u = (p[0] * dz - p[1] * dx) / den;
      if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.max(best, t);
    }
    R[k] = best;
  }
  return R;
}

// ---- details lifted off a garment ---------------------------------------------------------------------------------

/** a rounded rectangle's signed distance (negative inside) */
const rrect = (u, v, hw, hh, r) => { const qx = Math.abs(u) - hw + r, qy = Math.abs(v) - hh + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };

/** the details' values on a garment's outside: each returns value(x, y, z, nx, ny, nz) (>= 0 on the detail) and its lift */
export function detail(F, G, d) {
  const s = F.s, w = (d.width ?? 0.02) * s;
  switch (d.kind) {
    case "neckband": {                                               // a rib round the neckline
      const N = G.neck; if (!N) return null;
      return { value: (x, y, z) => { const u = N(x, y, z); return Math.min(u, w - u); }, lift: (d.lift ?? 0.0015) * s };
    }
    case "collar": {                                                 // a shirt collar lying over the shoulders, rolled at the neck, points at the front
      const N = G.neck; if (!N) return null;
      const tips = (d.tips ?? 0.03) * s, gap = d.gap ?? 0.012;
      return {
        value: (x, y, z) => {
          const fr = front(z, F.neck.cz, 0.03 * s), u = N(x, y, z), side = Math.abs(x - F.neck.cx);
          const wid = w + tips * fr * smooth(0.06 * s, 0.0, side);
          return Math.min(u, wid - u, side - gap * s * fr + (1 - fr) * 1);
        },
        lift: val => (d.lift ?? 0.003) * s + (d.roll ?? 0.006) * s * smooth(w * 0.6, 0, val),
      };
    }
    case "placket": {                                                // a button band down the front, from the neck to the hem
      const top = d.from ? height(F, d.from) : 9, bot = d.to ? height(F, d.to) : -9;
      return {
        value: (x, y, z, nx, ny, nz) => { const [cx, cz] = F.torsoAxis(y); return Math.min(w / 2 - Math.abs(x - cx - (d.x ?? 0) * s), (z - cz) * 4, top - y, y - bot, G.V ? G.V(x, y, z) : 1); },
        lift: (d.lift ?? 0.0015) * s,
      };
    }
    case "band": {                                                   // a band round the torso: on the waistline (a waistband, a belt) or between two heights (a hem band)
      if (d.follow === "waist" && G.waist) {
        const inset = (d.inset ?? 0) * s;
        return { value: (x, y, z) => { if (F.arm(x, y, z)) return -1; const u = G.waist(x, y, z) - inset; return Math.min(u, w - u); }, lift: (d.lift ?? 0.002) * s };
      }
      const top = height(F, d.from), bot = height(F, d.to);
      return { value: (x, y, z) => (F.arm(x, y, z) ? -1 : Math.min(top - y, y - bot)), lift: (d.lift ?? 0.002) * s };
    }
    case "cuff": {                                                   // a band at a sleeve's end, or a trouser leg's
      const L = d.length ?? 0.05;
      return {
        value: (x, y, z) => {
          const a = F.arm(x, y, z);
          if (d.on === "legs") return a ? -1 : Math.min(G.legY + L * s - y, 1);
          if (!a) return -1;
          return Math.min(G.ends[a.side] - a.t, a.t - (G.ends[a.side] - L * s));
        },
        lift: (d.lift ?? 0.0015) * s,
      };
    }
    case "pocket": {                                                 // a patch pocket (and its flap): a rounded rectangle seen from the front, the back or the side
      const look = d.on || "front", cw = (d.w ?? 0.11) * s / 2, ch = (d.h ?? 0.13) * s / 2, rr = (d.r ?? 0.012) * s;
      const cy = height(F, d.at), dx = (d.x ?? 0) * s;
      return {
        value: (x, y, z, nx, ny, nz) => {
          let u, facing;
          if (look === "side") { u = z - (d.z ?? 0) * s; facing = Math.sign(dx || 1) * nx; if (x * Math.sign(dx || 1) < 0) return -1; }
          else { u = x - dx; facing = look === "back" ? -nz : nz; if ((look === "back" ? -1 : 1) * (z - F.torsoAxis(y)[1]) < 0) return -1; }
          if (facing < -0.15 || F.arm(x, y, z)) return -1;           // it wraps round a curve (a bust, a thigh), but never onto the far side
          return Math.min(-rrect(u, y - cy, cw, ch, rr), G.V ? G.V(x, y, z) - 0.004 * s : 1);
        },
        lift: (d.lift ?? 0.0025) * s,
      };
    }
    default: throw new Error(`no detail called ${d.kind}`);
  }
}

/** buttons: little discs down a line on the garment's outside, [{P, T}] */
export function buttons(F, outer, d) {
  const s = F.s, top = height(F, d.from), bot = height(F, d.to), n = d.count ?? 6, r = (d.r ?? 0.0065) * s, h = (d.h ?? 0.003) * s;
  const N = normals(outer.P, outer.T), P = outer.P, out = { P: [], T: [] };
  for (let i = 0; i < n; i++) {
    const y = top + (bot - top) * (n === 1 ? 0.5 : i / (n - 1)), [cx, cz] = F.torsoAxis(y), x = cx + (d.x ?? 0) * s;
    let best = -1, bd = 1e9;
    for (let j = 0; j < P.length; j += 3) {
      if (P[j + 2] < cz) continue;
      const dd = (P[j] - x) ** 2 + (P[j + 1] - y) ** 2;
      if (dd < bd) { bd = dd; best = j; }
    }
    if (best < 0 || bd > (0.01 * s) ** 2) continue;
    disc(out, [P[best], P[best + 1], P[best + 2]], [N[best], N[best + 1], N[best + 2]], r, h, (d.lift ?? 0.0015) * s);
  }
  return { P: new Float32Array(out.P), T: new Uint32Array(out.T), S: new Float32Array(out.P.length / 3).fill(1) };
}
function disc(out, c, n, r, h, lift, seg = 14) {
  const up = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let u = [n[1] * up[2] - n[2] * up[1], n[2] * up[0] - n[0] * up[2], n[0] * up[1] - n[1] * up[0]]; const ul = Math.hypot(...u); u = u.map(v => v / ul);
  const w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const base = out.P.length / 3, at = (k, lv, rad) => { const a = k / seg * TAU; return [0, 1, 2].map(i => c[i] + n[i] * lv + (u[i] * Math.cos(a) + w[i] * Math.sin(a)) * rad); };
  for (let k = 0; k < seg; k++) out.P.push(...at(k, lift, r), ...at(k, lift + h, r * 0.92));
  out.P.push(...[0, 1, 2].map(i => c[i] + n[i] * (lift + h * 1.15)));
  const top = base + seg * 2;
  for (let k = 0; k < seg; k++) {
    const a = base + k * 2, b = base + ((k + 1) % seg) * 2;
    out.T.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, top);
  }
}

export { thicken, lifted, cut };

// ---- handles: the lines a garment can be dragged by (the Studio's Clothes tab) --------------------------------------

/** a named height's parts: "crotch+0.12" -> ["crotch", 0.12] (a number is metres from the floor) */
export const parseHeight = h => {
  if (typeof h === "number") return ["floor", h / 1];
  const m = /^([a-z]+)\s*([+-]\s*[\d.]+)?$/.exec(String(h).trim());
  return m ? [m[1], m[2] ? parseFloat(m[2].replace(/\s/g, "")) : 0] : ["floor", 0];
};

/**
 * Where a garment can be pulled: [{key, label, path (into its piece), kind ("height": anchor + value scaled with the
 * body, or "number"), anchor, value, at (a point on its outside), axis (the way the value grows), rate (metres a unit)}]
 */
export function handles(F, G, p) {
  const s = F.s, O = G.outer.P, out = [];
  const best = (ok, score) => { let b = -1, bs = -1e9; for (let i = 0; i < O.length; i += 3) { if (!ok(O[i], O[i + 1], O[i + 2])) continue; const v = score(O[i], O[i + 1], O[i + 2]); if (v > bs) { bs = v; b = i; } } return b < 0 ? null : [O[b], O[b + 1], O[b + 2]]; };
  const frontAt = (y, x0) => best((x, yy) => Math.abs(yy - y) < 0.01 * s && Math.abs(x - x0) < 0.02 * s, (x, yy, z) => z);
  const add = (h, at) => { if (at) out.push({ ...h, at }); };
  if (p.kind === "skirt") {
    const R = G.rings, [wa, wv] = parseHeight(p.waist?.at ?? "waist-0.04"), [la, lv] = parseHeight(p.length ?? "knee+0.06");
    add({ key: "waist", label: "Waist", path: ["waist", "at"], kind: "height", anchor: wa, value: wv, axis: [0, 1, 0], rate: s }, frontAt(R.y0, R.cx));
    add({ key: "length", label: "Length", path: ["length"], kind: "height", anchor: la, value: lv, axis: [0, 1, 0], rate: s }, best((x, y) => Math.abs(y - R.y1) < 0.006 * s, (x, y, z) => z - Math.abs(x - R.cx)));
    if (!(p.taper > 0)) add({ key: "flare", label: "Flare", path: ["flare"], kind: "number", value: p.flare ?? 0.12, axis: [1, 0, 0], rate: Math.max(0.05, F.hipY - R.y1) }, best((x, y) => Math.abs(y - R.y1) < 0.006 * s, x => x));
    return out;
  }
  const [cx0, cz0] = F.torsoAxis(F.crotchY);
  if (p.neck) {
    const N = F.neck;
    add({ key: "neck", label: "Neckline depth", path: ["neck", "depth"], kind: "number", value: p.neck.depth ?? 0.012, axis: [0, -1, 0], rate: s },
      best((x, y, z) => Math.abs(x - N.cx) < 0.012 * s && z > N.cz && y < N.y + 0.03 * s && y > F.armpitY, (x, y) => y));
  }
  if (p.hem) {
    const [a, v] = parseHeight(p.hem.at), y = height(F, p.hem.at);
    add({ key: "hem", label: "Hem", path: ["hem", "at"], kind: "height", anchor: a, value: v, axis: [0, 1, 0], rate: s }, frontAt(y - (p.hem.front ?? 0) * s, F.torsoAxis(y)[0]));
  }
  if (p.sleeve !== undefined && p.sleeve !== false && G.ends) {
    const A = F.arms.L, t = G.ends.L, c = A.line.at(t), d = A.line.dir(t);
    add({ key: "sleeve", label: "Sleeve length", path: ["sleeve"], kind: "number", value: +(t / s).toFixed(4), axis: d, rate: s },
      best((x, y, z) => { const a = F.arm(x, y, z); return a && a.side === "L" && Math.abs(a.t - t) < 0.012 * s; }, (x, y) => y - c[1]));
  }
  if (p.waist) {
    const [a, v] = parseHeight(p.waist.at), y = height(F, p.waist.at);
    add({ key: "waist", label: "Waist", path: ["waist", "at"], kind: "height", anchor: a, value: v, axis: [0, 1, 0], rate: s }, frontAt(y - (p.waist.drop ?? 0.01) * s, F.torsoAxis(y)[0]));
  }
  if (p.legs) {
    const [a, v] = parseHeight(p.legs.to), y = height(F, p.legs.to);
    add({ key: "legs", label: "Leg length", path: ["legs", "to"], kind: "height", anchor: a, value: v, axis: [0, 1, 0], rate: s },
      best((x, yy) => Math.abs(yy - y) < 0.012 * s && x > cx0 + 0.02 * s, (x, yy, z) => z - Math.abs(yy - y) * 4));
  }
  return out;
}

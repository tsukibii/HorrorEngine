// The tailor's pieces: what each kind of garment keeps of the body (its cut lines as values, positive on the cloth),
// how loose it sits, and the details lifted off it (bands, plackets, pockets, collars, belts, buttons).
// Every length is in metres on MHR's average body (1.726 m) and scales with the body's height (F.s).
import { cut, normals, adjacency, subdivide, PointGrid, Surface, smooth, clamp } from "./mesh.js";
import { crop, relax, thicken, lifted } from "./fit.js";
import { height } from "./frame.js";

const TAU = Math.PI * 2;
const front = (z, cz, w = 0.03) => smooth(cz - w, cz + w, z);      // 0 at the back, 1 at the front

// ---- the cut lines ------------------------------------------------------------------------------------------------

/** the neckline: a cone round the neck's base (it rises away from the neck, so the shoulders are never cut), dipped
    at the front (and the back) into a scoop, a V or a square; `rise` (metres) takes the whole line up the neck instead,
    for a turtleneck or a mock neck (the cloth climbs the neck and the neckband is its roll) */
export function neckline(F, o = {}) {
  const s = F.s, N = F.neck, depth = (o.depth ?? 0.012) * s, back = (o.back ?? 0.0) * s, w = (o.width ?? 0.085) * s, rise = (o.rise ?? 0) * s;
  const tilt = (o.tilt ?? 0.022) * s, k = 1.6, r0 = N.r + ((o.open ?? 0.004) + (o.ease ?? 0)) * s, shape = o.shape || "round";   // the cone starts where the cloth is
  const g = u => { u = Math.min(1, Math.abs(u)); return shape === "v" ? 1 - u : shape === "square" ? (u < 0.85 ? 1 : 1 - smooth(0.85, 1, u)) : Math.sqrt(1 - u * u); };
  const cutY = (x, y, z) => {
    const dx = x - N.cx, dz = z - N.cz, rho = Math.hypot(dx, dz), c = rho > 1e-6 ? dz / rho : 0;
    const base = N.y - tilt * c + rise;                             // lower at the front, higher at the back: the neck's base slopes; `rise` takes the line up the neck (a turtleneck)
    const cone = k * Math.max(0, rho - r0);
    const fr = front(z, N.cz, 0.025 * s), G = g(dx / w) * fr, B = g(dx / w) * (1 - fr);
    const yc = base + (1 - Math.max(G, B * (back > 0))) * cone - depth * G - back * B;
    return rise > 0 ? Math.min(yc, base + 0.012 * s) : yc;           // risen, the line is level all round: the neck widens toward the jaw, and the cone would climb it
  };
  const v = (x, y, z) => cutY(x, y, z) - y;
  v.cutY = cutY;
  return v;
}

/** a hem round the torso at height `at`, longer at the front or back by `front`/`back` (metres) */
export const torsoHem = (F, at, o = {}) => {
  const y0 = height(F, at), fr = (o.front ?? 0) * F.s, bk = (o.back ?? 0) * F.s, sd = (o.side ?? 0) * F.s;
  return (x, y, z) => {
    const th = F.theta(x, y, z), c = Math.cos(th), si = Math.abs(Math.sin(th));
    return y - (y0 - fr * Math.max(0, c) - bk * Math.max(0, -c) + sd * si * si);
  };
};
/** a waistline at `at`, dropped at the front by `drop` (a low rise) and raised at the back by `rise` */
export const waistline = (F, at, o = {}) => {
  const y0 = height(F, at), dr = (o.drop ?? 0.01) * F.s, ri = (o.rise ?? 0.02) * F.s;
  return (x, y, z) => { const c = Math.cos(F.theta(x, y, z)); return y0 - dr * Math.max(0, c) + ri * Math.max(0, -c) - y; };
};
/** the length along the arm a sleeve reaches: a number (metres from the shoulder joint), or "wrist", "elbow", "short",
    "cap", each with an offset in metres down the arm ("elbow+0.05": rolled to below the elbow) */
export const sleeveEnd = (F, side, L) => {
  const A = F.arms[side], s = F.s, m = typeof L === "string" && /^(wrist|long|elbow|short|cap)\s*([+-]\s*[\d.]+)?$/.exec(L.trim());
  if (!m) return Math.max(A.seam + 0.03 * s, L * s);
  const off = m[2] ? parseFloat(m[2].replace(/\s/g, "")) * s : 0;
  const at = { wrist: A.wrist - 0.012 * s, long: A.wrist - 0.012 * s, elbow: A.elbow + 0.02 * s, short: A.seam + 0.13 * s, cap: A.seam + 0.05 * s }[m[1]];
  return Math.max(A.seam + 0.03 * s, at + off);
};

/** a front opening: half its width at height y (a gap down the middle, widening into a V from `from` up to the neck, `top`
    wide each side there); value(x, y, z) is how far a point is from its edge (>= 0 on the cloth), the back untouched.
    `shift` (metres, + to the body's left) slides the opening's middle sideways from nothing at the neck to `shift` at
    `from` and straight on below it: a wrap front (a jeogori's, a wrap dress's), its edge a diagonal across the chest */
export function opening(F, o) {
  const s = F.s, y0 = height(F, o.from ?? "bust-0.06"), y1 = F.neckBaseY, g = (o.gap ?? 0.006) * s / 2, top = (o.top ?? 0.07) * s, sh = (o.shift ?? 0) * s;
  const half = y => (y <= y0 ? g : g + (top - g) * Math.min(1, ((y - y0) / Math.max(0.01, y1 - y0)) ** (o.curve ?? 1)));
  const mid = y => sh * clamp((y1 - y) / Math.max(0.01, y1 - y0), 0, 1);
  const value = (x, y, z) => { const [cx, cz] = F.torsoAxis(y); return z < cz ? 1 : Math.abs(x - cx - mid(y)) - half(y); };
  return { half, mid, value, y0, y1, top };
}

/** a shoe's opening: how high the upper comes at a point of the foot, from `heel` at the back to `vamp` over the
    instep (`from` along the foot: in front of it the upper is whole), as heights over the floor in metres; a boot is
    the same with both high */
export function shoeLine(F, o) {
  const s = F.s, heel = (o.heel ?? 0.07) * s, vamp = (o.vamp ?? o.heel ?? 0.07) * s, from = o.from ?? 0.62, toe = Math.max(vamp, 0.1 * s);
  return (x, y, z) => {
    const f = F.feet[x >= F.torsoAxis(F.crotchY)[0] ? "L" : "R"], [a] = f.at(x, z);
    const top = a >= from ? toe : heel + (vamp - heel) * smooth(0.1, from, a);   // in front of the instep the upper is whole (over the toes)
    return top - y;
  };
}

// ---- underwear: a bra's band, cups and straps; briefs' leg openings ---------------------------------------------------

/** the bust's two points (the fullest forward each side, between the bust's height and a little under it) and the fold
    under each (going down from the point, where the front stops coming back in before the belly); a chest with no fold
    has it 7 cm under its point. On F once */
export function bust(F) {
  if (F._bust) return F._bust;
  const S = F.scan, s = F.s, [cx, cz] = F.torsoAxis(F.bustY), out = {};
  for (const [k, sg] of [["L", 1], ["R", -1]]) {
    let best = null;
    for (const r of S.rows) {
      if (r.y < F.bustY - 0.06 * s || r.y > Math.min(F.bustY + 0.05 * s, F.armpitY)) continue;
      const l = S.central(r); if (!l) continue;
      for (const [x, z] of l.pts) if ((x - cx) * sg > 0.03 * s && (x - cx) * sg < 0.14 * s && (!best || z > best[2])) best = [x, r.y, z];
    }
    if (!best) best = [cx + sg * 0.09 * s, F.bustY, cz + 0.1 * s];
    let fold = null, low = Infinity;
    for (const r of S.rows.filter(r => r.y < best[1] - 0.03 * s && r.y > best[1] - 0.14 * s).reverse()) {
      const l = S.central(r); if (!l) continue;
      let z = -Infinity; for (const [x, zz] of l.pts) if (Math.abs(x - best[0]) < 0.012 * s) z = Math.max(z, zz);
      if (!Number.isFinite(z)) continue;
      if (z <= low) { low = z; fold = r.y; } else if (z > low + 0.002 * s) break;   // the front comes out again: the belly
    }
    out[k] = { x: best[0], y: best[1], z: best[2], fold: clamp(fold ?? best[1] - 0.07 * s, best[1] - 0.1 * s, best[1] - 0.045 * s) };
  }
  out.under = (out.L.fold + out.R.fold) / 2;
  return (F._bust = out);
}
const sdPoly = (P, u, v) => {                                       // a polygon's signed distance at (u, v): < 0 inside
  let d = Infinity, inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [ax, ay] = P[j], [bx, by] = P[i], ex = bx - ax, ey = by - ay, t = clamp(((u - ax) * ex + (v - ay) * ey) / (ex * ex + ey * ey || 1), 0, 1);
    d = Math.min(d, Math.hypot(u - ax - ex * t, v - ay - ey * t));
    if ((ay > v) !== (by > v) && u < ax + (v - ay) / (by - ay) * ex) inside = !inside;
  }
  return inside ? -d : d;
};

/** a bra: a band round the ribs under the bust (a little higher at the back by `rise`), cups over the bust laid on the
    torso's front as a flat panel (tailor's torsoU across, the height up; `top` how far over the bust's point a cup
    comes, `outer` how far out past it, `gore` the gap between them at the band), and straps from each cup's highest
    point up over the shoulder and down to the back band (or, `racer`, meeting between the shoulder blades). Styles:
    triangle, balconette, plunge (the cups' inner edges in a V down to the band), sports (one front panel to a scoop,
    wide straps, a racer back), bandeau (a band over the bust, no straps). value >= 0 on the cloth */
export function bra(F, o) {
  const s = F.s, B = bust(F), style = o.style || "balconette", [cx0] = F.torsoAxis(F.bustY);
  const band = (o.band ?? 0.02) * s, under = B.under + (o.drop ?? 0) * s, top = (o.top ?? 0.03) * s, outer = (o.outer ?? 0.07) * s, gore = (o.gore ?? 0.016) * s / 2;
  const sw = (o.strap ?? 0.012) * s / 2, rise = (o.rise ?? 0.01) * s, apexY = (B.L.y + B.R.y) / 2;
  const cups = [["L", 1], ["R", -1]].map(([k, sg]) => {
    const A = B[k], uA = Math.max(0.02 * s, Math.abs(F.torsoU(A.x, A.y, A.z, false))), yA = A.y;
    let poly;
    if (style === "triangle") poly = [[gore, under], [uA + outer, under], [uA + 0.006 * s, yA + top]];
    else if (style === "plunge") poly = [[gore, under + 0.006 * s], [uA + outer, under], [uA + 0.62 * outer, yA + top + 0.008 * s], [uA - 0.3 * outer, yA + top - 0.012 * s], [gore + 0.003 * s, under + 0.028 * s]];
    else poly = [[gore, under + 0.004 * s], [uA + outer, under], [uA + 0.72 * outer, yA + top + 0.01 * s], [uA - 0.25 * outer, yA + top - 0.003 * s], [gore + 0.004 * s, yA - 0.006 * s]];   // balconette
    const hi = poly.reduce((a, p) => (p[1] > a[1] ? p : a)), kx = Math.abs(A.x - cx0) / uA;   // the strap leaves the cup's highest point
    return { sg, poly, xs: cx0 + sg * (style === "sports" ? (o.strapX ?? 0.075) * s : hi[0] * kx), ys: style === "sports" ? apexY + top : hi[1] };
  });
  const scoop = (o.scoop ?? 0.03) * s, sideW = (o.panel ?? 0.11) * s;   // sports: the front panel's scoop and the width where it's full height
  const backTop = under + rise, midY = Math.min(F.armpitY - 0.02 * s, backTop + 0.08 * s), topY = F.neckBaseY - 0.01 * s;
  const strapX = (c, y, back) => {                                   // where a strap's middle is at height y
    if (!back || !o.racer) return c.xs;
    const t = clamp((y - midY) / Math.max(0.01 * s, topY - midY), 0, 1);   // a racer: from the shoulder down into the middle of the back
    return cx0 + (c.xs - cx0) * Math.sqrt(t) + c.sg * sw * 0.9 * (1 - Math.sqrt(t));
  };
  return (x, y, z) => {
    if (F.arm(x, y, z)) return -1;
    const [cx, cz] = F.torsoAxis(y), fr = front(z, cz, 0.03 * s), back = z < cz, lift = rise * (1 - fr);
    if (style === "bandeau") return Math.min(y - (under - band + lift), apexY + top + lift * 0.5 - y);
    let v = Math.min(y - (under - band + lift), under + lift - y);    // the band
    if (style === "sports") {                                         // one panel over the front, to a scoop between the straps
      if (!back) { const u = Math.abs(F.torsoU(x, y, z, false)), t = clamp(1 - u / sideW, 0, 1); v = Math.max(v, Math.min(y - (under - band), apexY + top - scoop * t * t * (3 - 2 * t) - y)); }
      else if (o.racer) { const w = (o.bottom ?? 0.1) * s / 2 * (1 - clamp((y - backTop) / Math.max(0.01 * s, midY - backTop), 0, 1)) + sw; v = Math.max(v, Math.min(y - (under - band + lift), w - Math.abs(x - cx), midY + 0.01 * s - y)); }
    } else for (const c of cups) {                                   // the cups, on the front
      if (back) continue;
      const u = c.sg * F.torsoU(x, y, z, false); if (u < 0) continue;
      v = Math.max(v, -sdPoly(c.poly, u, y));
    }
    for (const c of cups) {                                           // the straps: up from the cup, over the shoulder, down the back
      if ((x - cx) * c.sg < -0.01 * s) continue;
      const from = back ? (o.racer ? backTop - 0.004 * s : backTop + lift - 0.004 * s) : c.ys - 0.006 * s;
      v = Math.max(v, Math.min(sw - Math.abs(x - strapX(c, y, back)), y - from, F.neckBaseY + 0.05 * s - y));
    }
    return v;
  };
}

/** briefs, a thong, a G-string, a tanga, under the waistline: the leg openings. Between the legs a `gusset` that goes
    `deep` under the crotch; the front panel widens from it to the hips, its edge rising to `side` over the crotch at the
    hip's side (`curve` under 1: cut high at once, over 1: low and then up); the back the same from its own gusset (a
    thong's strip) with its own `curve`, and `drop`: how far under the crotch's height it reaches over the seat; a thong's
    back (`band`) rises from its strip to just that far under the waistline. The front and back blend over a few
    centimetres between the legs and at the hips. value >= 0 on the cloth */
export function brief(F, o, waist = null) {
  const s = F.s, cy = F.crotchY, side = cy + (o.side ?? 0.08) * s, b = o.back || {}, bandB = b.band !== undefined && waist ? b.band * s : null;
  const gf = (o.gusset ?? 0.03) * s / 2, cf = o.curve ?? 1, gb = (b.gusset ?? o.gusset ?? 0.03) * s / 2, cb = b.curve ?? 2.2, drop = (b.drop ?? 0.03) * s, deep = (o.deep ?? 0.035) * s;
  const l = F.scan.central(F.scan.at(side)), [hx] = F.torsoAxis(side), Wh = l ? Math.max(hx - l.x0, l.x1 - hx) : 0.17 * s;
  return (x, y, z) => {
    if (F.arm(x, y, z)) return -1;
    const [cx, cz] = F.torsoAxis(Math.max(y, cy)), u = Math.abs(x - cx), w = front(z, cz, 0.035 * s);
    const g = gb + (gf - gb) * w, c = cb + (cf - cb) * w, low = cy - drop * (1 - w);
    const top = bandB === null ? side : side + (waist(x, y, z) + y - bandB - side) * (1 - w);   // the back's edge up to its waistband
    const t = clamp((u - g) / Math.max(0.01 * s, Wh - g), 0, 1), e = low + (top - low) * t ** c;
    return Math.max(Math.min(g - u, y - (cy - deep)), y - e);
  };
}

/** a garment's value at a point (>= 0 on the cloth): the least of its lines there. `V.which(x, y, z)` gives [value, which
    line is nearest: "neck", "open", "sleeve", "hem", "waist", "legs", "shoe", "under" (underwear's own shape)] for the
    guides (tailor/guides.js); `V.parts` the lines themselves */
export function cutter(F, p) {
  const neck = p.neck === false ? null : neckline(F, { ease: p.ease?.body, ...(p.neck || {}) });
  const ends = p.sleeve === undefined || p.sleeve === false ? null : { L: sleeveEnd(F, "L", p.sleeve), R: sleeveEnd(F, "R", p.sleeve) };
  const hem = p.hem ? torsoHem(F, p.hem.at, p.hem) : null;
  const waist = p.waist ? waistline(F, p.waist.at, p.waist) : null;
  const legY = p.legs ? height(F, p.legs.to) : null, open = p.open ? opening(F, p.open) : null, shoe = p.shoe ? shoeLine(F, p.shoe) : null;
  const under = p.bra ? bra(F, p.bra) : p.brief ? brief(F, p.brief, waist) : null;   // underwear: its own shape, within the rest
  const at = (x, y, z, w) => {
    const a = F.arm(x, y, z);
    let v = under ? Math.min(1, under(x, y, z)) : 1, k = under ? "under" : "";
    const take = (u, kind) => { if (u < v) { v = u; k = kind; } };
    if (neck) take(neck(x, y, z), "neck");
    if (open && !a) take(open.value(x, y, z), "open");
    if (a) take(ends ? ends[a.side] - a.t : -1, "sleeve");
    else {
      if (hem) take(hem(x, y, z), "hem");
      if (waist) take(waist(x, y, z), "waist");
      if (legY !== null) take(y - legY, "legs");
      if (shoe) take(shoe(x, y, z), "shoe");
    }
    if (w) w.kind = k;
    return v;
  };
  const V = (x, y, z) => at(x, y, z, null);
  V.which = (x, y, z) => { const w = {}; const v = at(x, y, z, w); return [v, w.kind]; };
  V.parts = { neck, ends, hem, waist, legY, open, shoe, under };
  return V;
}

// ---- the body, ready to be cut ------------------------------------------------------------------------------------

/** the body once per character: its frame and the surface to keep the cloth off */
export function prepare(P, T, F) {
  const surf = new Surface(P, T), n = P.length / 3, region = new Uint8Array(n);   // each skin point's part: torso, an arm, a leg
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], a = F.arm(x, y, z);
    region[i] = a ? (a.side === "L" ? 1 : 2) : y < F.crotchY ? (x >= F.torsoAxis(F.crotchY)[0] ? 3 : 4) : 0;
  }
  return { F, P, T, surf, N: surf.N, region };
}

/** the points (of a crop of the skin) another part of the body comes within `reach` of: they need a proper search
    when they're kept off the skin, not a walk from their own part */
function contested(B, C, reach) {
  const out = new Uint8Array(C.keep.length), R = B.region, G = B.surf.grid;
  for (let j = 0; j < C.keep.length; j++) {
    const own = R[C.keep[j]];
    out[j] = G.any(C.P[j * 3], C.P[j * 3 + 1], C.P[j * 3 + 2], reach[j], q => R[q] !== own && !(own === 0 || R[q] === 0)) ? 1 : 0;
  }
  return out;
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
    W[j] = p.shoe ? 1 : smooth(0.03 * s, 0.11 * s, dp) * (a || y < crotch ? 0.3 : 1);   // a shoe smooths all over: the toes into one toe box
    if (a) { ease[j] += ea; continue; }
    const legW = 1 - smooth(crotch - 0.02 * s, crotch + 0.06 * s, y);
    ease[j] += eb + (el - eb) * legW + fl * smooth(knee + 0.1 * s, legTo, y) * legW;
    if (p.legs) ease[j] += (e.crotch ?? 0.014) * s * Math.exp(-((dc / (0.08 * s)) ** 2));
  }
  const near = contested(B, C, Array.from(ease, e => 2 * e + 0.02 * s));
  const H = {}, Q = relax(C.P, C.T, N, ease, { iters: p.tension ?? 16, weight: W, colliders: [{ surf: B.surf }], hints: C.keep, hintsOut: H, contested: near });
  // four times the triangles, the new points between their parents, settled a few rounds at that size
  const fine = subdivide(Q, C.T), m = fine.P.length / 3, n = Q.length / 3;
  const ease2 = new Float32Array(m), W2 = new Float32Array(m), hint2 = new Int32Array(m), near2 = new Uint8Array(m); ease2.set(ease); W2.set(W); hint2.set(H.hints); near2.set(near);
  for (let k = 0; k < m - n; k++) { const a = fine.parents[2 * k], b = fine.parents[2 * k + 1]; ease2[n + k] = (ease[a] + ease[b]) / 2; W2[n + k] = (W[a] + W[b]) / 2; hint2[n + k] = H.hints[a]; near2[n + k] = near[a] | near[b]; }
  let Qf = relax(fine.P, fine.T, new Float32Array(fine.P.length), ease2, { iters: 4, weight: W2, clear: ease2, colliders: [{ surf: B.surf }], hints: hint2, contested: near2 }), Tf = fine.T, mf = m, hf = hint2;
  if (p.fine > 1) {                                                  // narrow parts (straps, strings): split in four again, about 2.5 mm, settled twice
    const f2 = subdivide(Qf, fine.T), m2 = f2.P.length / 3, e3 = new Float32Array(m2), W3 = new Float32Array(m2), h3 = new Int32Array(m2), n3 = new Uint8Array(m2);
    e3.set(ease2); W3.set(W2); h3.set(hint2); n3.set(near2);
    for (let k = 0; k < m2 - m; k++) { const a = f2.parents[2 * k], b = f2.parents[2 * k + 1]; e3[m + k] = (ease2[a] + ease2[b]) / 2; W3[m + k] = (W2[a] + W2[b]) / 2; h3[m + k] = hint2[a]; n3[m + k] = near2[a] | near2[b]; }
    Qf = relax(f2.P, f2.T, new Float32Array(f2.P.length), e3, { iters: 2, weight: W3, clear: e3, colliders: [{ surf: B.surf }], hints: h3, contested: n3 }); Tf = f2.T; mf = m2; hf = h3;
  }
  const v = new Float32Array(mf);
  for (let j = 0; j < mf; j++) v[j] = V(Qf[j * 3], Qf[j * 3 + 1], Qf[j * 3 + 2]);
  const c = cut(Qf, Tf, v);
  const ends = p.sleeve === undefined || p.sleeve === false ? null : { L: sleeveEnd(F, "L", p.sleeve), R: sleeveEnd(F, "R", p.sleeve) };
  return { outer: { P: c.P, T: c.T }, hints: Int32Array.from(c.from, ([a]) => hf[a]), V, neck: p.neck === false ? null : neckline(F, { ease: p.ease?.body, ...(p.neck || {}) }), ends, open: p.open ? opening(F, p.open) : null,
           legY: p.legs ? height(F, p.legs.to) : null, waist: p.waist ? waistline(F, p.waist.at, p.waist) : null };
}

/** a skirt's outline: from its waist (`waist.at`) down to its hem (`length`), every `dy`, a radius per angle (NA of
    them, from -pi: the back) round the torso's axis at the waist: the body's convex hull at that height (the torso's
    loop, never an arm beside it: a dress hung from the bust; both legs; what's worn under it, `colliders`) plus the
    ease, never narrowing below the hips (from its top with `straight`: a chima gathered under the bust), widened by
    `flare` (m per m) or narrowed by `taper` (a pencil skirt). The tailor's rings and the guides' */
export function skirtOutline(F, p, colliders = [], dy = 0.005 * F.s, NA = p.columns || 256) {
  const s = F.s;
  const y0 = height(F, p.waist?.at ?? "waist-0.04"), y1 = height(F, p.length ?? "knee+0.06"), hipY = F.hipY;
  const [cx, cz] = F.torsoAxis(y0), rows = Math.ceil((y0 - y1) / dy - 1e-6) + 1;
  dy = (y0 - y1) / Math.max(1, rows - 1);                           // the last ring on the hem itself
  const ease = (p.ease ?? 0.006) * s, flare = p.flare ?? 0.12, taper = p.taper ?? 0;
  const hull = y => {
    const pts = [], row = F.scan.at(y), c = row && y > F.crotchY ? F.scan.central(row) : null;   // above the crotch the torso is one loop, the rest arms
    for (const l of (row?.loops || [])) if (c ? l === c : Math.abs(l.cx) < 0.3 * s) for (const q of l.pts) pts.push([q[0] - cx, q[1] - cz]);
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
      if (r > 0 && (y < hipY || p.straight)) {
        const prev = R[r - 1][k];
        v = Math.max(v, prev + (taper > 0 ? -taper : flare) * dy);
      }
      row[k] = v;
    }
    R.push(row);
  }
  // soften round and down (the hull's corners)
  for (let pass = 0; pass < 2; pass++) for (const row of R) { const c = Float32Array.from(row); for (let k = 0; k < NA; k++) row[k] = Math.max(c[k], (c[(k + NA - 1) % NA] + 2 * c[k] + c[(k + 1) % NA]) / 4); }
  return { y0, y1, cx, cz, dy, rows, NA, R, hipY };
}

/** a skirt as rings hung from the waist (skirtOutline), knife or box pleats stitched down to the hip, a circle skirt's
    waves; `open: {gap}` leaves it open down the front, `gap` metres wide (a coat's skirts over a jacket) */
export function skirt(B, p, colliders) {
  const F = B.F, s = F.s, pleats = p.pleats || null, gap = (p.open?.gap ?? 0) * s;
  const { y0, y1, cx, cz, rows, NA, R, hipY, dy } = skirtOutline(F, p, colliders, 0.005 * s);   // (dy as the outline spaced it: the last ring on the hem)
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
      if (p.waves) {                                                 // a circle skirt's soft folds, deepening to the hem, outward only (inward they'd cut into a calf the rings just clear)
        const d = p.waves.depth * s * smooth(hipY, y1, y);
        rad += d * (0.5 + 0.5 * Math.sin(a * p.waves.n + 0.7));
      }
      out.set([cx + Math.sin(a) * rad, y, cz + Math.cos(a) * rad], (r * NA + k) * 3);
    }
  }
  const inGap = (r, k) => gap > 0 && Math.abs((k / NA - 0.5) * TAU) * R[r][k] < gap / 2;   // a column within the opening at the front
  for (let r = 0; r + 1 < rows; r++) for (let k = 0; k < NA; k++) {
    if (inGap(r, k) && inGap(r, (k + 1) % NA)) continue;
    const a = r * NA + k, b = r * NA + (k + 1) % NA, c = (r + 1) * NA + k, d = (r + 1) * NA + (k + 1) % NA;
    T.push(a, b, c, b, d, c);
  }
  const mean = R.map(row => row.reduce((a, v) => a + v, 0) / NA);   // each row's radius: the fabric spreads to the hem as a flared panel
  const radius = y => mean[Math.max(0, Math.min(rows - 1, Math.round((y0 - y) / dy)))];
  return { outer: { P: out, T: new Uint32Array(T) }, V: null, neck: null, rings: { y0, y1, cx, cz, radius } };
}

/** a shoe's upper, lofted round each foot as Woohill's footwear is: vertical sections across the foot every few mm from
    heel to toe, each the convex outline of the foot there (the toes one smooth box) plus the ease, smoothed along the
    foot and rounded off at both ends; then its opening cut by `shoe` (shoeLine). Returns what shell() does */
export function shoeShell(B, p) {
  const F = B.F, s = F.s, P = B.P, T = B.T, ease = (p.ease?.body ?? 0.005) * s, NA = 72, step = 0.003 * s, line = shoeLine(F, p.shoe);
  const top = Math.max((p.shoe.heel ?? 0.07), (p.shoe.vamp ?? 0.07), 0.1) * s + 0.03 * s;
  const out = [], tri = [];
  for (const side of ["L", "R"]) {
    const f = F.feet[side], d = [f.d[0], 0, f.d[1]], perp = [f.d[1], 0, -f.d[0]], h = [f.heel[0], 0, f.heel[1]];
    const tris = [];                                                 // the foot's triangles
    for (let t = 0; t < T.length; t += 3) {
      const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
      if (Math.min(P[a + 1], P[b + 1], P[c + 1]) > top || P[a] * f.sg < 0.05 * s) continue;
      tris.push(t);
    }
    const along = q => (q[0] - h[0]) * d[0] + (q[2] - h[2]) * d[2], across = q => (q[0] - h[0]) * perp[0] + (q[2] - h[2]) * perp[2];
    const sections = [];
    for (let t0 = -0.004 * s; t0 <= f.len + 0.004 * s; t0 += step) {   // where the plane along = t0 cuts the foot's triangles
      const pts = [];
      for (const t of tris) {
        const v = [0, 1, 2].map(k => [P[T[t + k] * 3], P[T[t + k] * 3 + 1], P[T[t + k] * 3 + 2]]), w = v.map(q => along(q) - t0);
        for (let k = 0; k < 3; k++) { const a = k, b = (k + 1) % 3; if ((w[a] > 0) !== (w[b] > 0)) { const u = w[a] / (w[a] - w[b]), q = [0, 1, 2].map(i => v[a][i] + (v[b][i] - v[a][i]) * u); if (q[1] < top) pts.push([across(q), q[1]]); } }
      }
      if (pts.length < 6) continue;
      const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cy = pts.reduce((a, q) => a + q[1], 0) / pts.length;
      sections.push({ t: t0, cx, cy, pts, R: radii(pts.map(q => [q[0] - cx, q[1] - cy]), NA) });
    }
    // a section's outline carried onto another (shrunk by k, round the other's blended middle): the union of the two,
    // measured round that middle (radii carried as they were, round a middle that moved, sank a tall boot's back under
    // the floor)
    const carry = (q, r, k, u) => {
      const cx = q.cx * u + r.cx * (1 - u), cy = q.cy * u + r.cy * (1 - u), pts = q.pts.map(p => [p[0] - cx, p[1] - cy]);
      for (let a = 0; a < NA; a++) { const ang = (a / NA - 0.5) * TAU, rr = r.R[a] * k; pts.push([r.cx + Math.sin(ang) * rr - cx, r.cy + Math.cos(ang) * rr - cy]); }
      q.cx = cx; q.cy = cy; q.R = radii(pts, NA);
    };
    // the heel cup: the outline from a few cm forward carried back to the heel, so its back is a wall, not the heel bone's knob
    const k0 = sections.findIndex(q => q.t >= 0.035 * s);
    if (k0 > 0) for (let i = 0; i < k0; i++) { const q = sections[i], u = Math.max(0, q.t / sections[k0].t); carry(q, sections[k0], 0.86 + 0.14 * u, u); }
    // the toe box: rounded, not the big toe's point (the outline from 3 cm back, narrowing to 70% at the tip)
    const kt = sections.findLastIndex(q => q.t <= f.len - 0.03 * s);
    if (kt > 0) for (let i = kt + 1; i < sections.length; i++) {
      const q = sections[i], r = sections[kt], u = Math.min(1, (q.t - r.t) / Math.max(1e-3, sections[sections.length - 1].t - r.t));
      carry(q, r, 1 - 0.3 * u * u, u);
    }
    // smooth along the foot (the sections' centres and radii), then the rounded ends: a quarter circle the ease's size and more
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i + 1 < sections.length; i++) {
      const a = sections[i - 1], b = sections[i], c = sections[i + 1];
      b.cx = (a.cx + 2 * b.cx + c.cx) / 4; b.cy = (a.cy + 2 * b.cy + c.cy) / 4;
      b.R = b.R.map((r, k) => Math.max(r, (a.R[k] + 2 * r + c.R[k]) / 4));
    }
    const rings = [], cap = ease + 0.002 * s;                         // the ends round off by the ease: a quarter circle
    const ring = (sec, t, k) => Array.from(sec.R, (r, a) => { const ang = (a / NA - 0.5) * Math.PI * 2, rr = r + ease * k; return [sec.cx + Math.sin(ang) * rr, sec.cy + Math.cos(ang) * rr, t]; });
    const first = sections[0], last = sections[sections.length - 1];
    for (let i = 4; i >= 1; i--) { const u = i / 5; rings.push(ring(first, first.t - cap * u, Math.sqrt(1 - u * u))); }
    for (const sec of sections) rings.push(ring(sec, sec.t, 1));
    for (let i = 1; i <= 4; i++) { const u = i / 5; rings.push(ring(last, last.t + cap * u, Math.sqrt(1 - u * u))); }
    const base = out.length / 3;
    const to3 = ([x, y, t]) => [h[0] + d[0] * t + perp[0] * x, y, h[2] + d[2] * t + perp[2] * x];
    for (const r of rings) for (const q of r) out.push(...to3(q));
    for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < NA; k++) {
      const a = base + i * NA + k, b = base + i * NA + (k + 1) % NA, c = base + (i + 1) * NA + k, e = base + (i + 1) * NA + (k + 1) % NA;
      tri.push(a, c, b, b, c, e);                                    // both feet share the frame (the toe ahead): one winding, faces out
    }
    const ends = [[first, first.t - cap, 0], [last, last.t + cap, rings.length - 1]];
    for (const [sec, t, ri] of ends) {                                 // close each end on its middle
      const m = out.length / 3; out.push(...to3([sec.cx, sec.cy, t]));
      for (let k = 0; k < NA; k++) { const a = base + ri * NA + k, b = base + ri * NA + (k + 1) % NA; if (ri === 0) tri.push(m, a, b); else tri.push(m, b, a); }
    }
  }
  const Pm = new Float32Array(out), v = new Float32Array(Pm.length / 3);
  for (let i = 0; i < v.length; i++) v[i] = line(Pm[i * 3], Pm[i * 3 + 1], Pm[i * 3 + 2]);
  const c = cut(Pm, new Uint32Array(tri), v);
  return { outer: { P: c.P, T: c.T }, V: (x, y, z) => line(x, y, z), neck: null, ends: null, legY: 0, waist: null, open: null };
}

/** a shoe's sole under each foot: the footprint's outline (the foot's points near the floor, hulled) pushed out by
    `overhang`, `thick` deep under the floor and `rise` up its side, the toe sprung up a little; {P, T, S} for both feet */
export function soles(F, B, o) {
  const s = F.s, thick = (o.thick ?? 0.012) * s, rise = (o.rise ?? 0.008) * s, over = (o.overhang ?? 0.005) * s, spring = (o.spring ?? 0.012) * s, heelH = (o.heel ?? 0) * s;
  const P = B.P, out = { P: [], T: [] }, NA = 128;
  for (const side of ["L", "R"]) {
    const f = F.feet[side], pts = [];
    for (let i = 0; i < P.length; i += 3) if (P[i] * f.sg > 0.05 * s && P[i + 1] < 0.025 * s) pts.push([P[i], P[i + 2]]);
    const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cz = pts.reduce((a, q) => a + q[1], 0) / pts.length;
    const R = radii(pts.map(q => [q[0] - cx, q[1] - cz]), NA);
    const ring = [];                                                  // the outline, its rows from the top of the sole's side to under it
    const rows = [[rise, 0], [rise * 0.3, 0.6], [0, 1], [-thick * 0.5, 1], [-thick + 0.002 * s, 0.85], [-thick, 0.6]];
    for (const [h, w] of rows) for (let k = 0; k < NA; k++) {
      const a = (k / NA - 0.5) * Math.PI * 2, r = R[k] + over * w, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
      const [along] = f.at(x, z), lift = spring * smooth(0.75, 1.05, along) + heelH * smooth(0.3, 0.1, along) * (h < 0 ? 1 : 0);
      ring.push([x, h + lift, z]);
    }
    const base = out.P.length / 3;
    for (const q of ring) out.P.push(...q);
    for (let r = 0; r + 1 < rows.length; r++) for (let k = 0; k < NA; k++) {
      const a = base + r * NA + k, b = base + r * NA + (k + 1) % NA, c = base + (r + 1) * NA + k, d = base + (r + 1) * NA + (k + 1) % NA;
      out.T.push(a, c, b, b, c, d);
    }
    const bot = out.P.length / 3, last = base + (rows.length - 1) * NA;   // the tread: a fan from the middle
    const [ax] = f.at(cx, cz); out.P.push(cx, -thick + spring * smooth(0.75, 1.05, ax), cz);
    for (let k = 0; k < NA; k++) out.T.push(bot, last + (k + 1) % NA, last + k);
  }
  return { P: new Float32Array(out.P), T: new Uint32Array(out.T), S: new Float32Array(out.P.length / 3).fill(1) };
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
          if (d.front === false) return Math.min(u, wid - u, F.neck.cz + 0.01 * s - z);   // round the back only: lapels take the front
          return Math.min(u, wid - u, side - gap * s * fr + (1 - fr) * 1);
        },
        lift: val => (d.lift ?? 0.003) * s + (d.roll ?? 0.006) * s * smooth(w * 0.6, 0, val),
      };
    }
    case "lapel": {                                                  // a jacket's lapels: along the opening's V, widest at the neck, nothing at the top button
      const O = G.open; if (!O) return null;
      const wTop = (d.width ?? 0.075) * s;
      return {
        value: (x, y, z) => {
          if (y < O.y0) return -1;
          const u = O.value(x, y, z), w = wTop * Math.min(1, ((y - O.y0) / Math.max(0.01, O.y1 - O.y0)) ** (d.curve ?? 0.8));
          return Math.min(u + 0.002 * s, w - u, G.V ? G.V(x, y, z) + 0.004 * s : 1);
        },
        lift: val => (d.lift ?? 0.004) * s + (d.roll ?? 0.004) * s * smooth(wTop * 0.5, 0, val),
      };
    }
    case "edgeband": {                                               // a band all down the opening's edges (a cardigan's, a zip's tape)
      const O = G.open; if (!O) return null;
      return { value: (x, y, z) => { const u = O.value(x, y, z); return z < F.torsoAxis(y)[1] ? -1 : Math.min(u + 0.002 * s, w - u); }, lift: (d.lift ?? 0.0015) * s };
    }
    case "foot": {                                                   // a part of a shoe's upper by where it is on the foot: a toe cap, a heel counter, a tongue
      const a0 = d.from ?? 0.8, a1 = d.to ?? 1.2, hw = d.width ? d.width * s / 2 : null;
      return {
        value: (x, y, z, nx, ny) => {
          if (y > 0.25 * s) return -1;
          const f = F.feet[x >= F.torsoAxis(F.crotchY)[0] ? "L" : "R"], [a, c] = f.at(x, z);
          return Math.min(a - a0, a1 - a, hw ? hw - Math.abs(c + (d.offset ?? 0) * s) : 1, d.top ? ny - 0.35 : 1, d.above !== undefined ? y - d.above * s : 1);
        },
        lift: (d.lift ?? 0.0015) * s,
      };
    }
    case "placket": {                                                // a button band down the front, from the neck to the hem
      const top = d.from ? height(F, d.from) : 9, bot = d.to ? height(F, d.to) : -9;
      return {
        value: (x, y, z, nx, ny, nz) => { const [cx, cz] = F.torsoAxis(y); return Math.min(w / 2 - Math.abs(x - cx - (d.x ?? 0) * s), (z - cz) * 4, top - y, y - bot, G.V ? G.V(x, y, z) : 1); },
        lift: (d.lift ?? 0.0015) * s,
      };
    }
    case "trim": {                                                   // a band along every edge the garment has (underwear's elastic): where its value is under w
      if (!G.V) return null;
      return { value: (x, y, z) => { const v = G.V(x, y, z); return Math.min(v + 0.0005 * s, w - v); }, lift: (d.lift ?? 0.0008) * s };
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
      const cy = height(F, d.at), dx = (d.x ?? 0) * s, sx = Math.sign(dx || 1);
      // a side pocket keeps to the outside of its leg (the crotch faces down, not away, and sits in its window too)
      const leg = Object.values(F.legLines).find(l => Math.sign(l.p[l.p.length >> 1][0]) === sx);
      const legX = y => { const P = leg.p; let i = 1; while (i < P.length - 1 && P[i][1] > y) i++; const a = P[i - 1], b = P[i], u = clamp((a[1] - y) / ((a[1] - b[1]) || 1), 0, 1); return a[0] + (b[0] - a[0]) * u; };
      return {
        value: (x, y, z, nx, ny, nz) => {
          let u, facing;
          if (look === "side") { u = z - (d.z ?? 0) * s; facing = sx * nx; if ((x - (y < F.crotchY && leg ? legX(y) : 0)) * sx < 0) return -1; }
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

/** buttons: little discs down a line on the garment's outside, [{P, T}]; found on the cut cloth and sewn where its
    point hangs (`at`, after a drape) */
export function buttons(F, outer, d, at = null) {
  const s = F.s, top = height(F, d.from), bot = height(F, d.to), n = d.count ?? 6, r = (d.r ?? 0.0065) * s, h = (d.h ?? 0.003) * s;
  const P = outer.P, A = at || P, N = normals(A, outer.T), out = { P: [], T: [] };
  for (let i = 0; i < n; i++) {
    const y = top + (bot - top) * (n === 1 ? 0.5 : i / (n - 1)), [cx, cz] = F.torsoAxis(y), x = cx + (d.x ?? 0) * s;
    let best = -1, bd = 1e9;
    for (let j = 0; j < P.length; j += 3) {
      if (P[j + 2] < cz) continue;
      const dd = (P[j] - x) ** 2 + (P[j + 1] - y) ** 2;
      if (dd < bd) { bd = dd; best = j; }
    }
    if (best < 0 || bd > (0.01 * s) ** 2) continue;
    disc(out, [A[best], A[best + 1], A[best + 2]], [N[best], N[best + 1], N[best + 2]], r, h, (d.lift ?? 0.0015) * s);
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
export function handles(F, G, p, at = null) {
  const s = F.s, O = G.outer.P, A = at || O, out = [];   // found on the cut cloth, shown where it hangs
  const best = (ok, score) => { let b = -1, bs = -1e9; for (let i = 0; i < O.length; i += 3) { if (!ok(O[i], O[i + 1], O[i + 2])) continue; const v = score(O[i], O[i + 1], O[i + 2]); if (v > bs) { bs = v; b = i; } } return b < 0 ? null : [A[b], A[b + 1], A[b + 2]]; };
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
  if (p.open && G.open) {
    const [a, v] = parseHeight(p.open.from ?? "bust-0.06"), y = G.open.y0;
    add({ key: "open", label: "Opening's V", path: ["open", "from"], kind: "height", anchor: a, value: v, axis: [0, 1, 0], rate: s }, frontAt(y, F.torsoAxis(y)[0] + (G.open.mid ? G.open.mid(y) : 0) + G.open.half(y) + 0.004 * s));
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
  if (p.legs && p.kind !== "shoe") {                                 // (a shoe's legs run to the floor: nothing to pull)
    const [a, v] = parseHeight(p.legs.to), y = height(F, p.legs.to), leg = F.legLines.L;
    add({ key: "legs", label: "Leg length", path: ["legs", "to"], kind: "height", anchor: a, value: v, axis: [0, 1, 0], rate: s },
      best((x, yy, z) => Math.abs(yy - y) < 0.012 * s && x > cx0 + 0.02 * s && leg.project(x, yy, z)[1] < 0.1 * s, (x, yy, z) => z - Math.abs(yy - y) * 4));   // round the leg itself, not out on the foot
  }
  return out;
}

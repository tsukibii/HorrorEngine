// From hairs to cards (the hair editor v2.0, docs/HAIR_V2.md §3.9): each pore's hair is one small lock, a ribbon about
// twice as wide as the pores are apart, lying flat on the hair's surface like a shingle (its width across the flow,
// its face out), with the salon's strand atlas on it. What's new against the salon's cards: a card shows as much of
// the atlas as it is wide (the whole atlas is ATLAS_M of hair), so strands are the same thickness on every card; a
// blunt end stops before the atlas's strands thin out; and a card keeps points only where it bends. Plain arrays.
//
//   build(ctx) -> { position, normal (the cards' own faces), tangent (4), uv, color, index, card (each vertex's hair), cards, triangles }
//   coverage(geo, roots, normals) -> { one, two, thin: [root indices under two layers] }   how many cards lie over each root
import { dist, grad } from "./sdf.js";
import { K, TS, hash } from "./strands.js";

export const ATLAS_M = 0.05;                                             // the atlas's width in metres of hair (its 34 clumps: 1.5 mm a clump)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// which of a hair's K points a card keeps: the ends, then whichever point the kept line misses most, until none is
// missed by more than `tol` (or `most` are kept): straight hair a few, a curl many
function keep(pts, o, tol, least, most) {
  const kept = new Uint8Array(K); kept[0] = kept[K - 1] = 1; let n = 2;
  for (let k = 1; k < least - 1; k++) { const j = Math.round(k * (K - 1) / (least - 1)); if (!kept[j]) { kept[j] = 1; n++; } }
  for (; n < most;) {
    let worst = tol, at = -1, a = 0;
    for (let b = 1; b < K; b++) {
      if (!kept[b]) continue;
      const ax = pts[o + a * 3], ay = pts[o + a * 3 + 1], az = pts[o + a * 3 + 2], bx = pts[o + b * 3] - ax, by = pts[o + b * 3 + 1] - ay, bz = pts[o + b * 3 + 2] - az, l2 = bx * bx + by * by + bz * bz || 1e-12;
      for (let j = a + 1; j < b; j++) {
        const px = pts[o + j * 3] - ax, py = pts[o + j * 3 + 1] - ay, pz = pts[o + j * 3 + 2] - az, f = clamp((px * bx + py * by + pz * bz) / l2, 0, 1), e = Math.hypot(px - bx * f, py - by * f, pz - bz * f);
        if (e > worst) { worst = e; at = j; }
      }
      a = b;
    }
    if (at < 0) break;
    kept[at] = 1; n++;
  }
  return kept;
}

// ctx: { n, pts, len, u, width (each hair's card width, m), taper, wispy (0 blunt .. 1 wispy ends: one number, or one a hair), roll (each hair's turn about itself, radians: standing short hair),
//        tint (3 a hair, or none), S, C, tol, least, most, twist (K a hair: a card's own turn, or none), axis (3 a kept point: a curl's middle line), out (3 a kept point: the way out, for a tail) }
export function build(ctx) {
  const { n, pts, len, u, width, S, C } = ctx, tol = ctx.tol ?? 0.0008, least = ctx.least ?? 4, most = ctx.most ?? 14;
  const P = [], N = [], T = [], UV = [], COL = [], I = [], CARD = [], g = [0, 0, 0];
  let cards = 0;
  const ac = new Float32Array(K * 3), tn = new Float32Array(K * 3), nr = new Float32Array(K * 3);
  for (let i = 0; i < n; i++) {
    if (!(len[i] > 0)) continue;
    const o = i * K * 3, w0 = width[i], taper = typeof ctx.taper === "number" ? ctx.taper : ctx.taper[i], roll = ctx.roll ? ctx.roll[i] : 0;
    let pax = 0, pay = 0, paz = 0;
    for (let k = 0; k < K; k++) {
      const a = Math.max(0, k - 1), b = Math.min(K - 1, k + 1);
      let tx = pts[o + b * 3] - pts[o + a * 3], ty = pts[o + b * 3 + 1] - pts[o + a * 3 + 1], tz = pts[o + b * 3 + 2] - pts[o + a * 3 + 2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const x = pts[o + k * 3], y = pts[o + k * 3 + 1], z = pts[o + k * 3 + 2];
      // the way out of the hair here: off the skin near the body, away from the neck's line further out
      let ox, oy, oz;
      if (ctx.out) { ox = ctx.out[o + k * 3]; oy = ctx.out[o + k * 3 + 1]; oz = ctx.out[o + k * 3 + 2]; }                    // (a tail's hairs: out from its own middle)
      else if (dist(S, x, y, z) < S.band * 0.8 && grad(S, x, y, z, g)) { ox = g[0]; oy = g[1]; oz = g[2]; }
      else { ox = x - C[0]; oy = 0; oz = z - C[2]; const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l; }
      let ax = ty * oz - tz * oy, ay = tz * ox - tx * oz, az = tx * oy - ty * ox, al = Math.hypot(ax, ay, az);
      if (al < 0.05) { ax = pax; ay = pay; az = paz; al = Math.hypot(ax, ay, az) || 1; if (al < 0.5) { ax = tz; ay = 0; az = -tx; al = Math.hypot(ax, ay, az) || 1; } }
      ax /= al; ay /= al; az /= al;
      if (ctx.axis) {                                                      // a curl: the card's width lies along the lock's middle line (a ringlet's ribbon)
        const ex = ctx.axis[o + k * 3], ey = ctx.axis[o + k * 3 + 1], ez = ctx.axis[o + k * 3 + 2], el = Math.hypot(ex, ey, ez);
        if (el > 0.03) { const d = ex * tx + ey * ty + ez * tz; let bx = ex - tx * d, by = ey - ty * d, bz = ez - tz * d; const bl = Math.hypot(bx, by, bz); if (bl > 1e-4) { const m = Math.min(1, el * 1.5); ax = ax * (1 - m) + bx / bl * m; ay = ay * (1 - m) + by / bl * m; az = az * (1 - m) + bz / bl * m; const l2 = Math.hypot(ax, ay, az) || 1; ax /= l2; ay /= l2; az /= l2; } }
      }
      const tw = roll + (ctx.twist ? ctx.twist[i * K + k] : 0);
      if (tw) { const c = Math.cos(tw), s = Math.sin(tw), bx = ty * az - tz * ay, by = tz * ax - tx * az, bz = tx * ay - ty * ax; ax = ax * c + bx * s; ay = ay * c + by * s; az = az * c + bz * s; }
      if (k && ax * pax + ay * pay + az * paz < 0) { ax = -ax; ay = -ay; az = -az; }
      pax = ax; pay = ay; paz = az;
      ac[k * 3] = ax; ac[k * 3 + 1] = ay; ac[k * 3 + 2] = az; tn[k * 3] = tx; tn[k * 3 + 1] = ty; tn[k * 3 + 2] = tz;
      let fx = ay * tz - az * ty, fy = az * tx - ax * tz, fz = ax * ty - ay * tx; if (fx * ox + fy * oy + fz * oz < 0) { fx = -fx; fy = -fy; fz = -fz; }   // the card's face, out
      nr[k * 3] = fx; nr[k * 3 + 1] = fy; nr[k * 3 + 2] = fz;
    }
    const kept = keep(pts, o, tol, least, most), base = P.length / 3, span = clamp(w0 / ATLAS_M, 0.02, 0.5), u0 = hash(u[i], 11) * (1 - span);
    const vEnd = 0.57 + 0.43 * clamp((typeof ctx.wispy === "object" ? ctx.wispy[i] : ctx.wispy) ?? 0.3, 0, 1), tint = ctx.tint;   // blunt: the card ends before any of the atlas's strands do (they stop from 0.59 on); wispy: it runs through them
    let rows = 0;
    for (let k = 0; k < K; k++) {
      if (!kept[k]) continue;
      const t = TS[k], w = w0 * (1 - taper * Math.pow(t, 1.5)) * 0.5, x = pts[o + k * 3], y = pts[o + k * 3 + 1], z = pts[o + k * 3 + 2];
      P.push(x - ac[k * 3] * w, y - ac[k * 3 + 1] * w, z - ac[k * 3 + 2] * w, x + ac[k * 3] * w, y + ac[k * 3 + 1] * w, z + ac[k * 3 + 2] * w);
      for (let e = 0; e < 2; e++) { N.push(nr[k * 3], nr[k * 3 + 1], nr[k * 3 + 2]); T.push(tn[k * 3], tn[k * 3 + 1], tn[k * 3 + 2], 1); CARD.push(i); if (tint) COL.push(tint[i * 3], tint[i * 3 + 1], tint[i * 3 + 2]); else COL.push(1, 1, 1); }
      UV.push(u0, t * vEnd, u0 + span, t * vEnd);
      if (rows) { const a = base + (rows - 1) * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      rows++;
    }
    cards++;
  }
  return { position: new Float32Array(P), normal: new Float32Array(N), tangent: new Float32Array(T), uv: new Float32Array(UV), color: new Float32Array(COL), index: new Uint32Array(I), card: new Uint32Array(CARD), cards, triangles: I.length / 3 };
}

// two sets of cards as one
export function join(a, b) {
  if (!b || !b.position.length) return a; if (!a || !a.position.length) return b;
  const cat = (x, y, C) => { const o = new C(x.length + y.length); o.set(x); o.set(y, x.length); return o; }, base = a.position.length / 3, idx = new Uint32Array(a.index.length + b.index.length);
  idx.set(a.index); for (let i = 0; i < b.index.length; i++) idx[a.index.length + i] = b.index[i] + base;
  const card = new Uint32Array(a.card.length + b.card.length); card.set(a.card); for (let i = 0; i < b.card.length; i++) card[a.card.length + i] = b.card[i] + a.cards;
  return { position: cat(a.position, b.position, Float32Array), normal: cat(a.normal, b.normal, Float32Array), tangent: cat(a.tangent, b.tangent, Float32Array), uv: cat(a.uv, b.uv, Float32Array),
    color: cat(a.color, b.color, Float32Array), index: idx, card, cards: a.cards + b.cards, triangles: idx.length / 3 };
}

// how many cards lie over each root: a ray from just over the skin straight out, counted against every card's
// triangles (a grid of them), a card's own root left out; a tip counts for less (the atlas thins there)
export function coverage(geo, roots, normals, o = {}) {
  const P = geo.position, I = geo.index, UV = geo.uv, cell = 0.012, reach = o.reach ?? 0.05, grid = new Map(), n = roots.length / 3;
  const key = (x, y, z) => ((Math.floor(x / cell) + 512) << 20) | ((Math.floor(y / cell) + 512) << 10) | (Math.floor(z / cell) + 512);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const x0 = Math.floor(Math.min(P[a], P[b], P[c]) / cell), x1 = Math.floor(Math.max(P[a], P[b], P[c]) / cell), y0 = Math.floor(Math.min(P[a + 1], P[b + 1], P[c + 1]) / cell), y1 = Math.floor(Math.max(P[a + 1], P[b + 1], P[c + 1]) / cell);
    const z0 = Math.floor(Math.min(P[a + 2], P[b + 2], P[c + 2]) / cell), z1 = Math.floor(Math.max(P[a + 2], P[b + 2], P[c + 2]) / cell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const q = ((x + 512) << 20) | ((y + 512) << 10) | (z + 512); (grid.get(q) || grid.set(q, []).get(q)).push(t); }
  }
  const layers = new Float32Array(n), seen = new Map(); let one = 0, two = 0; const thin = [];
  for (let i = 0; i < n; i++) {
    const ox = roots[i * 3] + normals[i * 3] * 0.0012, oy = roots[i * 3 + 1] + normals[i * 3 + 1] * 0.0012, oz = roots[i * 3 + 2] + normals[i * 3 + 2] * 0.0012, dx = normals[i * 3], dy = normals[i * 3 + 1], dz = normals[i * 3 + 2];
    seen.clear(); let sum = 0;
    for (let s = 0; s <= reach; s += cell * 0.5) {
      const g = grid.get(key(ox + dx * s, oy + dy * s, oz + dz * s)); if (!g) continue;
      for (const t of g) {
        if (seen.has(t)) continue; seen.set(t, 1);
        const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det, tx = ox - P[a], ty = oy - P[a + 1], tz = oz - P[a + 2], uu = (tx * px + ty * py + tz * pz) * inv; if (uu < 0 || uu > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, vv = (dx * qx + dy * qy + dz * qz) * inv; if (vv < 0 || uu + vv > 1) continue;
        const hit = (e2x * qx + e2y * qy + e2z * qz) * inv; if (hit < 0.0004 || hit > reach) continue;
        const v = UV[I[t] * 2 + 1] * (1 - uu - vv) + UV[I[t + 1] * 2 + 1] * uu + UV[I[t + 2] * 2 + 1] * vv;
        sum += v < 0.55 ? 1 : v < 0.8 ? 0.6 : 0.25;
      }
    }
    layers[i] = sum; if (sum >= 0.95) one++; if (sum >= 1.9) two++; else thin.push(i);
  }
  return { one: n ? one / n : 1, two: n ? two / n : 1, thin, layers };
}

// The salon's cheat (docs/SALON.md, The fill): the locks you placed are traced into a glow, a shell round the head that
// joins them up over the scalp; you cut it where it shouldn't be (the ears, the face), push and pull it, then fill it:
// a mass of hair between the head and the glow, combed the way the nearest locks run. Plain arrays, no three.js.
//
// The glow is a grid of directions round the skull's middle (the collider's C): AZ round the head, EL from under the
// jaw to the crown; each cell has a radius (the shell's distance from C), whether it's on, and the body's own extent
// that way (inner: the shell never goes inside it). Left and right mirror: cell i and AZ - 1 - i.
//
//   trace(guides, col) -> glow                     guides: every lock's guide polylines (local points)
//   fillMesh(glow, guides, col, opts) -> {shell: {position, index}, strands: [polyline], flow}

import { add, sub, mul, dot, len, norm, cross, rng, onScalp } from "./salonlib.js";

export const AZ = 36, EL = 22, EL_MIN = -80, EL_MAX = 86;
const D = Math.PI / 180;
export const azOf = i => -180 + (i + 0.5) * 360 / AZ;
export const elOf = j => EL_MIN + (EL_MAX - EL_MIN) * j / (EL - 1);
export const dirOf = (az, el) => [Math.cos(el * D) * Math.sin(az * D), Math.sin(el * D), Math.cos(el * D) * Math.cos(az * D)];
export const cell = (i, j) => j * AZ + i;
export const mirrorCell = c => cell(AZ - 1 - (c % AZ), Math.floor(c / AZ));
const wrap = i => ((i % AZ) + AZ) % AZ;
const MIN_THICK = 0.012;            // over bare scalp: a centimetre of hair

// how far the body reaches from C along d (the last point inside it), from the collider
export function innerAlong(col, d, far = 0.75) {
  let last = 0;
  for (let t = 0.02; t < far; t += 0.004) if (col.inside(add(col.C, mul(d, t)))) last = t;
  return last;
}

// the angle of a point round C, as fractional grid coordinates
function gridOf(d) {
  const r = len(d), el = Math.asin(Math.max(-1, Math.min(1, d[1] / r))) / D, az = Math.atan2(d[0], d[2]) / D;
  return [(az + 180) / (360 / AZ) - 0.5, (el - EL_MIN) / ((EL_MAX - EL_MIN) / (EL - 1))];
}

export function trace(guides, col, opts = {}) {
  const n = AZ * EL, r = new Float32Array(n), inner = new Float32Array(n), on = new Uint8Array(n), lockR = new Float32Array(n), fixed = new Uint8Array(n);
  for (let j = 0; j < EL; j++) for (let i = 0; i < AZ; i++) inner[cell(i, j)] = innerAlong(col, dirOf(azOf(i), elOf(j)));
  // the locks: every guide point's distance, spread over the cells round its direction
  for (const G of guides) for (const p of G) {
    const d = sub(p, col.C), rr = len(d) + 0.003, [gi, gj] = gridOf(d);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const j = Math.round(gj) + dj; if (j < 0 || j >= EL) continue;
      const i = wrap(Math.round(gi) + di), c = cell(i, j);
      if (Math.hypot(i - gi - Math.round((i - gi) / AZ) * AZ, j - gj) > 0.75) continue;
      lockR[c] = Math.max(lockR[c], rr);
    }
  }
  // the scalp: cells whose skin is scalp; the face: the front below the hairline and above the chin, which the joining
  // never crosses (a fringe and two sidelocks round it would otherwise close over it)
  const face = new Uint8Array(n);
  for (let c = 0; c < n; c++) {
    const i = c % AZ, j = Math.floor(c / AZ), d = dirOf(azOf(i), elOf(j)), skin = add(col.C, mul(d, inner[c]));
    const scalp = inner[c] > 0 && onScalp(skin, col.C);
    face[c] = !scalp && Math.abs(azOf(i)) < 75 && skin[1] > col.chin - 0.01 && skin[2] > col.C[2] + 0.03 ? 1 : 0;
    // below the brows the face stays clear (locks may hang in front of it; the fill mustn't lie on it)
    if (face[c] && (opts.faceClear ?? true) && skin[1] < 0.03) continue;
    if (lockR[c] > 0 || scalp) { on[c] = 1; fixed[c] = 1; r[c] = Math.max(lockR[c], inner[c] + MIN_THICK); }
  }
  // joined up: a closing (grow by a cell, then shrink) fills the gaps between locks
  const grow = (m, k) => { let a = m; for (let s = 0; s < k; s++) { const b = new Uint8Array(n); for (let c = 0; c < n; c++) { if (a[c]) { b[c] = 1; continue; } const i = c % AZ, j = Math.floor(c / AZ); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const jj = j + dj; if (jj >= 0 && jj < EL && a[cell(wrap(i + di), jj)]) { b[c] = 1; break; } } } a = b; } return a; };
  const shrink = (m, k) => { let a = m; for (let s = 0; s < k; s++) { const b = new Uint8Array(n); for (let c = 0; c < n; c++) { if (!a[c]) continue; const i = c % AZ, j = Math.floor(c / AZ); let keep = 1; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const jj = j + dj; if (jj >= 0 && jj < EL && !a[cell(wrap(i + di), jj)]) { keep = 0; break; } } b[c] = keep; } a = b; } return a; };
  const k = opts.join ?? 2, closed = shrink(grow(on, k), k);
  for (let c = 0; c < n; c++) if (closed[c] && !on[c] && !face[c]) { on[c] = 1; r[c] = 0; }
  // the gaps' radii from their neighbours (fixed cells stay), then everything smoothed a little
  for (let it = 0; it < 60; it++) relax(r, on, fixed, inner, it < 50);
  for (let c = 0; c < n; c++) if (on[c]) r[c] = Math.max(r[c], inner[c] + MIN_THICK * 0.5);
  return { AZ, EL, C: col.C.slice(), r: Array.from(r), inner: Array.from(inner), on: Array.from(on), face: Array.from(face) };
}
function relax(r, on, fixed, inner, keepFixed) {
  const n = r.length, out = Float32Array.from(r);
  for (let c = 0; c < n; c++) {
    if (!on[c] || (keepFixed && fixed[c])) continue;
    const i = c % AZ, j = Math.floor(c / AZ); let s = 0, m = 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const jj = j + dj; if (jj < 0 || jj >= EL) continue; const cc = cell(wrap(i + di), jj); if (on[cc] && r[cc] > 0) { s += r[cc]; m++; } }
    if (m) out[c] = keepFixed ? s / m : 0.7 * r[c] + 0.3 * s / m;
    out[c] = Math.max(out[c], inner[c] + MIN_THICK * 0.5);
  }
  r.set(out);
}

// the shell's point for a cell, and the radius anywhere (bilinear over the cells that are on)
export const pointOf = (g, c, rr = null) => add(g.C, mul(dirOf(azOf(c % AZ), elOf(Math.floor(c / AZ))), rr ?? g.r[c]));
export function radiusAt(g, d, field = g.r) {
  const [gi, gj] = gridOf(d), i0 = Math.floor(gi), j0 = Math.max(0, Math.min(EL - 2, Math.floor(gj))), fi = gi - i0, fj = Math.max(0, Math.min(1, gj - j0));
  let s = 0, w = 0;
  for (const [di, dj, ww] of [[0, 0, (1 - fi) * (1 - fj)], [1, 0, fi * (1 - fj)], [0, 1, (1 - fi) * fj], [1, 1, fi * fj]]) {
    const c = cell(wrap(i0 + di), j0 + dj); if (!g.on[c] || ww <= 0) continue; s += field[c] * ww; w += ww;
  }
  return w > 0.25 ? s / w : null;                                      // null: off the glow
}

// edits: cut or bring back, push out or pull in, smooth; a cell list (with mirror: their twins too)
export function withMirror(cells, mirror) { if (!mirror) return cells; const s = new Set(cells); for (const c of cells) s.add(mirrorCell(c)); return [...s]; }
export function setOn(g, cells, v) { for (const c of cells) { g.on[c] = v ? 1 : 0; if (v && !(g.r[c] > g.inner[c])) g.r[c] = g.inner[c] + MIN_THICK; } }
export function pushOut(g, cells, dr) { for (const c of cells) g.r[c] = Math.max(g.inner[c] + 0.002, g.r[c] + dr); }
export function smooth(g, cells) {
  const set = new Set(cells), r = Float32Array.from(g.r);
  for (const c of set) { const i = c % AZ, j = Math.floor(c / AZ); let s = 0, m = 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const jj = j + dj; if (jj < 0 || jj >= EL) continue; const cc = cell(wrap(i + di), jj); if (g.on[cc]) { s += g.r[cc]; m++; } } if (m) r[c] = 0.5 * g.r[c] + 0.5 * s / m; }
  g.r = Array.from(r);
}
export function copySide(g, fromLeft) {                               // one side's glow onto the other, mirrored
  for (let j = 0; j < EL; j++) for (let i = 0; i < AZ; i++) {
    const az = azOf(i); if (fromLeft ? az >= 0 : az <= 0) continue;    // the side being written
    const c = cell(i, j), m = mirrorCell(c); g.on[c] = g.on[m]; g.r[c] = g.r[m];
  }
}
export function boundary(g) {                                          // cells on with a neighbour off
  const out = [];
  for (let c = 0; c < g.on.length; c++) { if (!g.on[c]) continue; const i = c % AZ, j = Math.floor(c / AZ); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const jj = j + dj; if (jj < 0 || jj >= EL || !g.on[cell(wrap(i + di), jj)]) { out.push(c); break; } } }
  return out;
}

// the triangles between cells that are on (sub: each cell split sub x sub, radii bilinear), as a flat mesh
export function shellMesh(g, field = g.r, sub = 1, col = null) {
  const W = AZ * sub, H = (EL - 1) * sub + 1, pos = [], index = [], id = new Int32Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gi = x / sub, gj = y / sub, az = -180 + (gi + 0.5) * 360 / AZ, el = EL_MIN + (EL_MAX - EL_MIN) * gj / (EL - 1), d = dirOf(az, el);
    let rr = radiusAt(g, d, field); if (rr == null) continue;
    if (col) rr = Math.max(rr, innerAlong(col, d) + 0.003);             // between cells the skin can rise (the ears, the jaw)
    let q = add(g.C, mul(d, rr)); if (col) q = col.push(q, 0.003)[0];
    id[y * W + x] = pos.length / 3; pos.push(...q);
  }
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W; x++) {
    const a = id[y * W + x], b = id[y * W + (x + 1) % W], c = id[(y + 1) * W + x], d = id[(y + 1) * W + (x + 1) % W];
    if (a >= 0 && b >= 0 && c >= 0) index.push(a, c, b);
    if (b >= 0 && c >= 0 && d >= 0) index.push(b, c, d);
  }
  return { position: pos, index };
}

// the comb: at p, the way the nearest locks run (their guides' directions, nearer counting more), laid on the shell;
// far from every lock the hair falls down the shell
export function segHash(segs, h = 0.04) {
  const m = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  for (const s of segs) { const k = key(Math.floor(s.m[0] / h), Math.floor(s.m[1] / h), Math.floor(s.m[2] / h)); if (!m.has(k)) m.set(k, []); m.get(k).push(s); }
  return { m, h, all: segs, near(p) { const out = [], x = Math.floor(p[0] / h), y = Math.floor(p[1] / h), z = Math.floor(p[2] / h);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const l = m.get(key(x + a, y + b, z + c)); if (l) out.push(...l); }
    return out.length >= 3 ? out : segs; } };
}
export function flowAt(p, segs, normal, k = 8) {
  const best = [];
  if (segs.near) segs = segs.near(p);
  for (const s of segs) { const d2 = (p[0] - s.m[0]) ** 2 + (p[1] - s.m[1]) ** 2 + (p[2] - s.m[2]) ** 2; if (best.length < k) { best.push([d2, s]); best.sort((a, b) => a[0] - b[0]); } else if (d2 < best[k - 1][0]) { best[k - 1] = [d2, s]; best.sort((a, b) => a[0] - b[0]); } }
  let v = [0, 0, 0], wsum = 0;
  for (const [d2, s] of best) { const w = 1 / (d2 + 1e-4); v = add(v, mul(s.t, w)); wsum += w; }
  const near = best.length ? Math.sqrt(best[0][0]) : 1;
  const fall = 0.4 * Math.min(1, near / 0.08);                           // a lock 8 cm away: gravity takes over
  v = add(mul(norm(v), 1 - fall), mul([0, -1, 0], fall + (wsum ? 0 : 1)));
  v = sub(v, mul(normal, dot(v, normal)));                              // along the shell
  return len(v) > 1e-6 ? norm(v) : norm(sub([0, -1, 0], mul(normal, dot([0, -1, 0], normal))));
}

// the fill: the glow's radius tapered to the head at its edges (so the mass lands on the skin where it was cut), a
// shell a little inside it, and strands combed over it
export function fillMesh(g, guides, opts = {}, col = null) {
  const n = AZ * EL, field = g.r.slice(), edge = new Set(boundary(g));
  for (const c of edge) field[c] = g.inner[c] + 0.004;
  // the ring inside the edge half way down
  for (let c = 0; c < n; c++) { if (!g.on[c] || edge.has(c)) continue; const i = c % AZ, j = Math.floor(c / AZ); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const jj = j + dj; if (jj >= 0 && jj < EL && edge.has(cell(wrap(i + di), jj))) { field[c] = (g.r[c] + g.inner[c] + 0.004) / 2; break; } } }
  const inset = field.map((x, c) => Math.max(g.inner[c] + 0.003, x - 0.002));
  const shell = shellMesh(g, inset, opts.sub ?? 2, col);
  const segs = [];
  for (const G of guides) for (let k = 1; k < G.length; k++) { const t = sub(G[k], G[k - 1]), l = len(t); if (l > 1e-5) segs.push({ m: mul(add(G[k], G[k - 1]), 0.5), t: mul(t, 1 / l) }); }
  // strands: seeds spread over the shell's triangles by area, each walked along the comb on the shell
  const P = shell.position, I = shell.index, rnd = rng(opts.seed ?? 11), N = opts.density ?? 900, areas = [];
  let total = 0;
  for (let t = 0; t < I.length; t += 3) { const a = P.slice(I[t] * 3, I[t] * 3 + 3), b = P.slice(I[t + 1] * 3, I[t + 1] * 3 + 3), c = P.slice(I[t + 2] * 3, I[t + 2] * 3 + 3); total += len(cross(sub(b, a), sub(c, a))) / 2; areas.push(total); }
  const strands = [], outward = p => norm(sub(p, g.C)), hash = segHash(segs);
  for (let s = 0; s < N && total > 0; s++) {
    const pick = rnd() * total; let lo = 0, hi = areas.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (areas[mid] < pick) lo = mid + 1; else hi = mid; }
    const t = lo * 3, u = rnd(), v = rnd(), su = Math.sqrt(u);
    const A = P.slice(I[t] * 3, I[t] * 3 + 3), B = P.slice(I[t + 1] * 3, I[t + 1] * 3 + 3), Cc = P.slice(I[t + 2] * 3, I[t + 2] * 3 + 3);
    let p = add(add(mul(A, 1 - su), mul(B, su * (1 - v))), mul(Cc, su * v));
    const line = [p], steps = Math.round((0.04 + 0.1 * rnd()) / 0.005);
    for (let k = 0; k < steps; k++) {
      const nrm = outward(p), f = flowAt(p, hash, nrm);
      let q = add(p, mul(f, 0.005)); const d = sub(q, g.C), rr = radiusAt(g, d, inset);
      if (rr == null) break;
      q = add(g.C, mul(norm(d), rr + 0.001)); line.push(q); p = q;
    }
    if (line.length >= 3) strands.push(line);
  }
  return { shell, strands, segs: segs.length };
}

// Library garments on a character (DECISIONS 2026-11-11: the garments picked from MakeHuman's community packs, "make
// sure we can edit them in the studio"): a garment baked once onto MHR's average body at rest (tools/clothing_library.py
// bake, storykit/clothfit.py) is carried onto any MHR body here: every MHR body is the same mesh, so the skin's own
// change is known point by point. Each garment point moves as the blend of the K skin points nearest it on the average
// body moved (where the skin point went, plus the garment point's offset from it turned and scaled as the skin there
// was), then cloth that dips into the skin is put back outside it. The prototype's stage 2 (docs/research/clothing_v2/
// proto/fit.py Warp, push_out), in plain typed arrays: the Studio page, its worker and node run the same code.
// The result is a part as the tailor's own (tailor.js: P, T, N, UV in metres, PART, S), with UVO: the garment's own UV
// for its own texture (tailor/look.js `own`).
import { normals, adjacency, Surface } from "./mesh.js";

export const K = 16, EPS = 0.004, EASE = 0.003;
// layers (the prototype's rule, docs/research/clothing_v2/fit_test.md §7, lightly: only the upper garment moves): a
// garment's layer from its group in the catalogue and its name; one on a higher layer is set outside the ones under
// it where they lie together; shoes, hats and the like keep their shape (they aren't moved)
export const GAP = 0.0025, NEAR = 0.03, MOST = 0.03, H_MIN = 0.0015;
const STIFF = new Set(["shoes", "hats", "glasses", "jewelry", "masks", "equipment", "gloves"]);
export const rigid = group => STIFF.has(group);
export function layerOf(group, id = "") {
  if (/sock|stocking|pantyhose|tights|leg_warmer|armsleeve/.test(id)) return 15;
  if (group === "underwear") return 10;
  if (group === "shoes") return 20;
  if (group === "pants" || group === "skirts") return 30;
  if (group === "shirts" || group === "dress" || group === "suits") return /coat|jacket|blazer|cardigan|hoodie/.test(id) ? 60 : 40;
  return 90;
}

/** a bake's bytes: {head, rest, src, uv, uv2, tris, cover} (storykit/clothfit.py writes it) */
export function readBake(buf) {
  const n = new DataView(buf).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n))), out = { head };
  for (const [name, a] of Object.entries(head.arrays)) {
    const at = 4 + n + a.at, Ty = name === "src" || name === "tris" || name === "cover" ? Uint32Array : Float32Array;
    out[name] = new Ty(buf.slice(at, at + a.count * 4));
  }
  return out;
}

// the rotation nearest a 3x3 matrix M (row major, 9 numbers at m[o..]): Newton's iteration for the polar factor,
// Q <- (Q + Q^-T) / 2. A matrix that turns the skin inside out or has no size gives the identity.
function polar(m, o, out, oo) {
  let a = m[o], b = m[o + 1], c = m[o + 2], d = m[o + 3], e = m[o + 4], f = m[o + 5], g = m[o + 6], h = m[o + 7], i = m[o + 8];
  for (let it = 0; it < 24; it++) {
    const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g, det = a * A + b * B + c * C;
    if (!(det > 1e-30)) { out[oo] = out[oo + 4] = out[oo + 8] = 1; out[oo + 1] = out[oo + 2] = out[oo + 3] = out[oo + 5] = out[oo + 6] = out[oo + 7] = 0; return; }
    // the inverse transpose is the cofactor matrix over the determinant
    const k = 0.5 / det, na = 0.5 * a + k * A, nb = 0.5 * b + k * B, nc = 0.5 * c + k * C,
      nd = 0.5 * d + k * (c * h - b * i), ne = 0.5 * e + k * (a * i - c * g), nf = 0.5 * f + k * (b * g - a * h),
      ng = 0.5 * g + k * (b * f - c * e), nh = 0.5 * h + k * (c * d - a * f), ni = 0.5 * i + k * (a * e - b * d);
    const ch = Math.abs(na - a) + Math.abs(nb - b) + Math.abs(nc - c) + Math.abs(nd - d) + Math.abs(ne - e) + Math.abs(nf - f) + Math.abs(ng - g) + Math.abs(nh - h) + Math.abs(ni - i);
    a = na; b = nb; c = nc; d = nd; e = ne; f = nf; g = ng; h = nh; i = ni;
    if (ch < 1e-7) break;
  }
  out[oo] = a; out[oo + 1] = b; out[oo + 2] = c; out[oo + 3] = d; out[oo + 4] = e; out[oo + 5] = f; out[oo + 6] = g; out[oo + 7] = h; out[oo + 8] = i;
}

/** each skin point's turn R (row major, 9 a point) and scale s from its neighbourhood on `p` to the same on `X`: its
    edges and its normal, then averaged with its neighbours' twice so a noisy patch of skin doesn't kink the cloth */
export function frames(p, X, T) {
  const n = p.length / 3, M = new Float64Array(n * 9), sa = new Float64Array(n), sb = new Float64Array(n), cnt = new Float64Array(n);
  const edge = (i, j) => {                              // b a^T: the matrix whose polar factor turns a onto b
    const ax = p[j * 3] - p[i * 3], ay = p[j * 3 + 1] - p[i * 3 + 1], az = p[j * 3 + 2] - p[i * 3 + 2];
    const bx = X[j * 3] - X[i * 3], by = X[j * 3 + 1] - X[i * 3 + 1], bz = X[j * 3 + 2] - X[i * 3 + 2], o = i * 9;
    M[o] += bx * ax; M[o + 1] += bx * ay; M[o + 2] += bx * az; M[o + 3] += by * ax; M[o + 4] += by * ay; M[o + 5] += by * az; M[o + 6] += bz * ax; M[o + 7] += bz * ay; M[o + 8] += bz * az;
    sa[i] += ax * ax + ay * ay + az * az; sb[i] += bx * bx + by * by + bz * bz; cnt[i]++;
  };
  for (let t = 0; t < T.length; t += 3) { const a = T[t], b = T[t + 1], c = T[t + 2]; edge(a, b); edge(b, c); edge(c, a); edge(b, a); edge(c, b); edge(a, c); }
  const n0 = normals(p, T), n1 = normals(X, T), s = new Float64Array(n);
  let R = new Float64Array(n * 9);
  for (let i = 0; i < n; i++) {
    s[i] = Math.sqrt(sb[i] / Math.max(sa[i], 1e-20));
    const w = sa[i] / Math.max(cnt[i], 1) * 2 * s[i], o = i * 9;   // the normals as one more pair, as heavy as two average edges
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) M[o + r * 3 + c] += w * n1[i * 3 + r] * n0[i * 3 + c];
    polar(M, o, R, o);
  }
  const A = adjacency(n, T);
  for (let round = 0; round < 2; round++) {
    const R2 = new Float64Array(n * 9), s2 = new Float64Array(n), acc = new Float64Array(9);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 9; k++) acc[k] = R[i * 9 + k];
      let ss = s[i], c = 1;                               // (a neighbour counts twice, as the two triangles on its edge name it)
      for (let q = A.start[i]; q < A.start[i + 1]; q++) { const j = A.list[q]; for (let k = 0; k < 9; k++) acc[k] += 2 * R[j * 9 + k]; ss += 2 * s[j]; c += 2; }
      polar(acc, 0, R2, i * 9); s2[i] = ss / c;
    }
    R = R2; s.set(s2);
  }
  return { R, s };
}

// the K points of P nearest each query: a uniform grid, the block round the query grown until its K-th is nearer than
// anything outside the block can be
class Nearest {
  constructor(P, cell = 0.03) {
    const n = P.length / 3, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i * 3 + k]); hi[k] = Math.max(hi[k], P[i * 3 + k]); }
    this.P = P; this.cell = cell; this.lo = lo; this.dim = [0, 1, 2].map(k => Math.max(1, Math.ceil((hi[k] - lo[k]) / cell) + 1));
    const nc = this.dim[0] * this.dim[1] * this.dim[2], start = new Uint32Array(nc + 1), cid = new Uint32Array(n);
    for (let i = 0; i < n; i++) { cid[i] = this.cellOf(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); start[cid[i] + 1]++; }
    for (let c = 0; c < nc; c++) start[c + 1] += start[c];
    const fill = start.slice(0, nc), items = new Uint32Array(n);
    for (let i = 0; i < n; i++) items[fill[cid[i]]++] = i;
    this.start = start; this.items = items;
  }
  at(v, k) { return Math.max(0, Math.min(this.dim[k] - 1, Math.floor((v - this.lo[k]) / this.cell))); }
  cellOf(x, y, z) { return (this.at(z, 2) * this.dim[1] + this.at(y, 1)) * this.dim[0] + this.at(x, 0); }
  /** the k nearest to (x, y, z) into idx and d2 (nearest first): how many were found */
  query(x, y, z, k, idx, d2) {
    const P = this.P, c = this.cell, [nx, ny, nz] = this.dim, ix = this.at(x, 0), iy = this.at(y, 1), iz = this.at(z, 2);
    // how far the query lies outside the grid's box (a hem hanging away from the body): the block grows from there
    const out = Math.max(0, this.lo[0] - x, x - (this.lo[0] + nx * c), this.lo[1] - y, y - (this.lo[1] + ny * c), this.lo[2] - z, z - (this.lo[2] + nz * c));
    let found = 0;
    for (let R = 1; R <= Math.max(nx, ny, nz); R++) {
      found = 0;
      for (let kk = Math.max(0, iz - R); kk <= Math.min(nz - 1, iz + R); kk++) for (let j = Math.max(0, iy - R); j <= Math.min(ny - 1, iy + R); j++) {
        const row = (kk * ny + j) * nx;
        for (let q = this.start[row + Math.max(0, ix - R)], e = this.start[row + Math.min(nx - 1, ix + R) + 1]; q < e; q++) {
          const p = this.items[q], dx = P[p * 3] - x, dy = P[p * 3 + 1] - y, dz = P[p * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz;
          if (found === k && d >= d2[k - 1]) continue;
          let at = found < k ? found++ : k - 1;               // into its place, nearest first
          while (at > 0 && d2[at - 1] > d) { d2[at] = d2[at - 1]; idx[at] = idx[at - 1]; at--; }
          d2[at] = d; idx[at] = p;
        }
      }
      const safe = R * c - out;                               // everything within this of the query has been looked at
      if (found === k && safe > 0 && d2[k - 1] <= safe * safe) break;
      if (found === P.length / 3) break;
    }
    return found;
  }
}

/** a body ready to wear library garments: `base` MHR's average at rest (the body the bakes stand on), `P` and `T` the
    character's body (MHR's own pose: the dress form when there is one) */
export class Wearer {
  constructor(base, P, T) {
    if (base.length !== P.length) throw new Error(`the bakes' body has ${base.length / 3} points, this one ${P.length / 3}: not the same mesh`);
    this.base = base; this.P = P; this.T = T;
    const f = frames(base, P, T); this.R = f.R; this.s = f.s;
    this.near = new Nearest(base);
    this.skin = new Surface(P, T, null, 0.012);
  }
  /** the baked points on this body (float32, a point a baked point): the warp alone */
  warp(rest) {
    const n = rest.length / 3, out = new Float32Array(n * 3), idx = new Uint32Array(K), d2 = new Float64Array(K), { base, P, R, s } = this;
    for (let q = 0; q < n; q++) {
      const x = rest[q * 3], y = rest[q * 3 + 1], z = rest[q * 3 + 2], m = this.near.query(x, y, z, K, idx, d2);
      let sx = 0, sy = 0, sz = 0, sw = 0;
      for (let k = 0; k < m; k++) {
        const i = idx[k], w = 1 / ((d2[k] + EPS * EPS) ** 2), o = i * 9, dx = x - base[i * 3], dy = y - base[i * 3 + 1], dz = z - base[i * 3 + 2], si = s[i];
        sx += w * (P[i * 3] + si * (R[o] * dx + R[o + 1] * dy + R[o + 2] * dz));
        sy += w * (P[i * 3 + 1] + si * (R[o + 3] * dx + R[o + 4] * dy + R[o + 5] * dz));
        sz += w * (P[i * 3 + 2] + si * (R[o + 6] * dx + R[o + 7] * dy + R[o + 8] * dz));
        sw += w;
      }
      out[q * 3] = sx / sw; out[q * 3 + 1] = sy / sw; out[q * 3 + 2] = sz / sw;
    }
    return out;
  }
  // the points `want` says to move (its push written into D, 3 a point: true when it moves one), moved; the push spread
  // to the cloth round them, so no point stands out alone; again until none is left or `rounds` are done
  _ease(G, A, want, rounds) {
    const n = G.length / 3, D = new Float32Array(n * 3), Ds = new Float32Array(n * 3), tmp = new Float32Array(n * 3), inside = new Uint8Array(n);
    let moved = 0;
    for (let r = 0; r < rounds; r++) {
      D.fill(0); inside.fill(0);
      let any = 0;
      for (let i = 0; i < n; i++) if (want(i, D)) { inside[i] = 1; any++; }
      if (r === 0) moved = any;
      if (!any) break;
      Ds.set(D);
      for (let it = 0; it < 3; it++) {
        for (let i = 0; i < n; i++) {
          let ax = 0, ay = 0, az = 0; const a = A.start[i], b = A.start[i + 1];
          for (let q = a; q < b; q++) { const j = A.list[q] * 3; ax += Ds[j]; ay += Ds[j + 1]; az += Ds[j + 2]; }
          const k = b > a ? 0.5 / (b - a) : 0;
          tmp[i * 3] = 0.5 * Ds[i * 3] + k * ax; tmp[i * 3 + 1] = 0.5 * Ds[i * 3 + 1] + k * ay; tmp[i * 3 + 2] = 0.5 * Ds[i * 3 + 2] + k * az;
        }
        Ds.set(tmp);
      }
      for (let i = 0; i < n; i++) { const w = inside[i] ? D : Ds, k = inside[i] ? 1 : 0.7; G[i * 3] += k * w[i * 3]; G[i * 3 + 1] += k * w[i * 3 + 1]; G[i * 3 + 2] += k * w[i * 3 + 2]; }
    }
    return moved;
  }
  /** cloth that dips into the skin put back `ease` outside it, its neighbours eased along with it: how many points
      the first round moved */
  pushOut(G, A, ease = EASE, rounds = 4) {
    const c = {};
    return this._ease(G, A, (i, D) => {
      const x = G[i * 3], y = G[i * 3 + 1], z = G[i * 3 + 2], h = this.skin.closest(x, y, z, 0.06, c);
      if (!h || !(h.d < ease)) return false;
      D[i * 3] = h.x + ease * h.nx - x; D[i * 3 + 1] = h.y + ease * h.ny - y; D[i * 3 + 2] = h.z + ease * h.nz - z; return true;
    }, rounds);
  }
  // how far point i of G would have to move out, along the skin's own normal there, to stand GAP outside every one of
  // `under` (surfaces of the garments worn under it) lying within NEAR of it: 0 when it's outside them already. "Out"
  // is the skin's, never the cloth's own facing (a turned hem faces anywhere); heights are off the skin
  _under(G, i, under, hs, c, c2) {
    const x = G[i * 3], y = G[i * 3 + 1], z = G[i * 3 + 2];
    if (!this.skin.closest(x, y, z, 0.25, hs)) return 0;
    let need = 0;
    for (const S of under) {
      const q = S.closest(x, y, z, 0.06, c); if (!q || Math.abs(q.d) > NEAR) continue;
      const hq = this.skin.closest(q.x, q.y, q.z, 0.25, c2); if (!hq) continue;
      need = Math.max(need, hq.d + GAP - hs.d);
    }
    return need;
  }
  /** a garment set outside the ones worn under it (their welded {P, T}) where they lie together: only it moves, no
      point more than MOST; how many points the first round moved */
  over(G, A, under, rounds = 4) {
    const S = under.map(u => new Surface(u.P, u.T, null, 0.012)), hs = {}, c = {}, c2 = {};
    return this._ease(G, A, (i, D) => {
      const need = Math.min(MOST, this._under(G, i, S, hs, c, c2));
      if (!(need > 0)) return false;
      D[i * 3] = hs.nx * need; D[i * 3 + 1] = hs.ny * need; D[i * 3 + 2] = hs.nz * need; return true;
    }, rounds);
  }
  /** a garment pressed in under the ones worn over it (their welded {P, T}) where it still stands through them (a
      waistband's loops through a top's hem, a sock through a shoe): toward the skin, never nearer it than H_MIN; how
      many points the first round moved */
  tuck(G, A, over, rounds = 3) {
    const S = over.map(u => new Surface(u.P, u.T, null, 0.012)), hs = {}, c = {}, c2 = {};
    return this._ease(G, A, (i, D) => {
      const x = G[i * 3], y = G[i * 3 + 1], z = G[i * 3 + 2];
      if (!this.skin.closest(x, y, z, 0.25, hs)) return false;
      let need = 0;
      for (const U of S) {
        const q = U.closest(x, y, z, 0.06, c); if (!q || Math.abs(q.d) > NEAR) continue;
        const hq = this.skin.closest(q.x, q.y, q.z, 0.25, c2); if (!hq) continue;
        need = Math.max(need, hs.d - (hq.d - GAP));
      }
      need = Math.min(need, hs.d - H_MIN, MOST);
      if (!(need > 0)) return false;
      D[i * 3] = -hs.nx * need; D[i * 3 + 1] = -hs.ny * need; D[i * 3 + 2] = -hs.nz * need; return true;
    }, rounds);
  }
  /** how many of a garment's points and triangles' middles (its welded G, W) still lie more than a millimetre under
      one of `under` (the check's count) */
  crossings(G, under, W = null) {
    const S = under.map(u => new Surface(u.P, u.T, null, 0.012)), hs = {}, c = {}, c2 = {};
    let Q = G;
    if (W) { Q = new Float32Array(G.length + W.length); Q.set(G); for (let t = 0; t < W.length; t += 3) for (let a = 0; a < 3; a++) Q[G.length + t + a] = (G[W[t] * 3 + a] + G[W[t + 1] * 3 + a] + G[W[t + 2] * 3 + a]) / 3; }
    let k = 0; for (let i = 0; i < Q.length / 3; i++) if (this._under(Q, i, S, hs, c, c2) > GAP + 0.001) k++;
    return k;
  }
  /** an outfit of library garments, in layers: list = [{bake, name, color, layer, rigid}] in any order. Each is fitted
      and set outside the ones on lower layers (over), then each is pressed in under what's worn over it where it still
      stands through (tuck); they come back in the list's order. `fixed`: garments that are worn with them and don't move
      (the tailor's own, already cut and hung: [{layer, outer: [{P, T}]}]): the library's go outside the ones under them
      and are pressed in under the ones over them */
  dress(list, fixed = []) {
    const order = list.map((x, i) => [x.layer ?? 40, i, x]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(a => a[2]), made = new Map(), lay = x => x.layer ?? 40;
    for (const x of order) made.set(x, this.wear(x.bake, x.name, x.color, { rigid: x.rigid,
      under: [...order.filter(y => lay(y) < lay(x) && made.has(y)).flatMap(y => made.get(y).outer), ...fixed.filter(f => lay(f) < lay(x)).flatMap(f => f.outer)] }));
    for (const x of order) {
      const above = [...order.filter(y => lay(y) > lay(x)).flatMap(y => made.get(y).outer), ...fixed.filter(f => lay(f) > lay(x)).flatMap(f => f.outer)]; if (x.rigid || !above.length) continue;
      const g = made.get(x), o = g.outer[0], n = this.tuck(o.P, adjacency(o.P.length / 3, o.T), above);
      if (n) { g.stats.tucked = n; this.finish(g, x.bake); }
    }
    return list.map(x => made.get(x));
  }
  /** a garment's part made again from its welded points (after they were moved) */
  finish(g, bake) {
    const G = g.outer[0].P, Nw = normals(G, g.outer[0].T), q = g.parts[0], src = bake.src;
    for (let i = 0; i < src.length; i++) { const j = src[i] * 3; q.P[i * 3] = G[j]; q.P[i * 3 + 1] = G[j + 1]; q.P[i * 3 + 2] = G[j + 2]; q.N[i * 3] = Nw[j]; q.N[i * 3 + 1] = Nw[j + 1]; q.N[i * 3 + 2] = Nw[j + 2]; }
    return g;
  }
  /**
   * A baked garment on this body, as a garment of the tailor's: {name, parts: [one part: P, T, N, UV (metres), UVO (its
   * own), PART, S, name, color, fabric: true], outer: [{P, T}] (its welded points, for what goes over it), cover (a byte
   * a body point: the skin it hides, MakeHuman's own list for it), stats}. `o.under`: the outsides ({P, T}) of the garments
   * on lower layers, which it is set outside of; `o.rigid`: one that keeps its shape (layerOf, rigid)
   */
  wear(bake, name = bake.head.id, color = "#ffffff", o = {}) {
    const t0 = Date.now(), { rest, src, uv, uv2, tris } = bake, n = rest.length / 3, m = src.length;
    const G = this.warp(rest);
    const W = new Uint32Array(tris.length); for (let i = 0; i < tris.length; i++) W[i] = src[tris[i]];   // the triangles on the welded points
    const A = adjacency(n, W), moved = this.pushOut(G, A);
    const lifted = o.under?.length && !o.rigid ? this.over(G, A, o.under) : 0;   // (o.under: the outsides of what's worn under it; o.rigid: a shoe, a hat: as made)
    const Nw = normals(G, W);                                 // smooth across the UV seams
    const P = new Float32Array(m * 3), N = new Float32Array(m * 3);
    for (let i = 0; i < m; i++) { const j = src[i] * 3; P[i * 3] = G[j]; P[i * 3 + 1] = G[j + 1]; P[i * 3 + 2] = G[j + 2]; N[i * 3] = Nw[j]; N[i * 3 + 1] = Nw[j + 1]; N[i * 3 + 2] = Nw[j + 2]; }
    const cover = new Uint8Array(this.P.length / 3); for (const i of bake.cover) cover[i] = 1;
    const part = { name, color, fabric: true, P, T: Uint32Array.from(tris), N, UV: Float32Array.from(uv2), UVO: Float32Array.from(uv), PART: new Float32Array(m), S: new Float32Array(m).fill(1) };
    return { name, library: bake.head.id, parts: [part], outer: [{ P: G, T: W }], cover, handles: [], stats: { triangles: tris.length / 3, vertices: m, moved, lifted, ms: Date.now() - t0 } };
  }
}

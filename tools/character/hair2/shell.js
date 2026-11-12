// Hair under a few centimetres is shells, not cards (the hair editor v2.0, docs/HAIR_V2.md §3.10): a buzz cut, stubble,
// clipped sides and napes, the undercoat of a short cut. A card standing on end can't be seen from above; so, the fur
// technique: a few copies of the scalp's patch lifted off the skin a millimetre or two apart, leaning the way the hair
// is combed, each drawn with a tile of hairs' cross-sections that thin out toward the top layer. Where the pores thin
// (the hairline's edge, a thinning crown) fewer of the tile's hairs are drawn: each point carries how much hair is left
// there. Plain arrays; Godot's hair_shell.gdshader and the Studio's own material draw them.
//
//   tile(size, seed)   -> RGBA bytes: R how tall this hair is (its own number), G its number for thinning, B its shade, A its
//                         profile (1 at its middle to 0 at its edge)
//   build(ctx)         -> { position, normal, tangent, uv, color, index, layers }   color: r the layer (0 skin .. 1 tips), g the hair left there; uv: the tile (TILE_M of scalp a repeat)
import { rng } from "../salonlib.js";

export const TILE_M = 0.028, SHELL_MAX = 0.03;                           // the tile's size on the scalp; the longest hair shells draw
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function tile(size = 256, seed = 5, count = 1100) {
  const r = rng(seed), H = new Float32Array(size * size), G = new Float32Array(size * size), B = new Float32Array(size * size), A = new Float32Array(size * size);
  // hairs evenly thrown (the best of a few tries each: no two on top of each other), each a soft round dot
  const pts = [];
  for (let i = 0; i < count; i++) {
    let best = null, bd = -1;
    for (let t = 0; t < 8; t++) { const x = r() * size, y = r() * size; let d = 1e9; for (const p of pts) { let dx = Math.abs(p[0] - x), dy = Math.abs(p[1] - y); dx = Math.min(dx, size - dx); dy = Math.min(dy, size - dy); d = Math.min(d, dx * dx + dy * dy); } if (d > bd) { bd = d; best = [x, y]; } }
    pts.push(best);
  }
  for (const [cx, cy] of pts) {
    const h = 0.45 + 0.55 * Math.pow(r(), 0.6), g = r(), b = r(), rad = 2.1 + 1.3 * r();
    for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / rad; if (d >= 1) continue;
      const k = (((y % size) + size) % size) * size + (((x % size) + size) % size), a = 1 - d * d;
      if (a > A[k]) { A[k] = a; H[k] = h; G[k] = g; B[k] = b; }
    }
  }
  const out = new Uint8ClampedArray(size * size * 4);
  for (let k = 0; k < size * size; k++) { out[k * 4] = Math.round(H[k] * 255); out[k * 4 + 1] = Math.round(G[k] * 255); out[k * 4 + 2] = Math.round(B[k] * 255); out[k * 4 + 3] = Math.round(A[k] * 255); }
  return out;
}

// ctx: { patch: { position, normal, index } (scalp.js patch: the scalp's own triangles), height (m a patch point: how long the hair is there, 0: none),
//        left (0..1 a point: how much hair is left there), dir (3 a point: the way it's combed, or zeros), lean (0 upright .. 1 lying) }
// The tile is laid flat onto each triangle from the side it faces most (x, y or z): true to size within a third, and a
// seam between two sides is a seam between two scatters of dots, which can't be seen. Points are shared within a side.
export function build(ctx) {
  const { patch, height, left, dir } = ctx, n = patch.position.length / 3, lean = clamp(ctx.lean ?? 0.45, 0, 0.9), X = patch.position, NR = patch.normal;
  let top = 0; for (let i = 0; i < n; i++) top = Math.max(top, height[i]);
  if (top < 0.0008) return null;
  const layers = clamp(Math.round(top / 0.0022), 4, 10), at = new Map(), base = [], tris = [];
  for (let t = 0; t < patch.index.length; t += 3) {
    const a = patch.index[t], b = patch.index[t + 1], c = patch.index[t + 2];
    if (!((height[a] > 0.0005 && left[a] > 0.02) || (height[b] > 0.0005 && left[b] > 0.02) || (height[c] > 0.0005 && left[c] > 0.02))) continue;
    const ux = X[b * 3] - X[a * 3], uy = X[b * 3 + 1] - X[a * 3 + 1], uz = X[b * 3 + 2] - X[a * 3 + 2], vx = X[c * 3] - X[a * 3], vy = X[c * 3 + 1] - X[a * 3 + 1], vz = X[c * 3 + 2] - X[a * 3 + 2];
    const fx = Math.abs(uy * vz - uz * vy), fy = Math.abs(uz * vx - ux * vz), fz = Math.abs(ux * vy - uy * vx), axis = fx >= fy && fx >= fz ? 0 : fy >= fz ? 1 : 2;
    for (const v of [a, b, c]) { const key = v * 3 + axis; let j = at.get(key); if (j === undefined) { j = base.length; at.set(key, j); base.push([v, axis]); } tris.push(j); }
  }
  const m = base.length, P = new Float32Array(m * layers * 3), N = new Float32Array(m * layers * 3), T = new Float32Array(m * layers * 4), UV = new Float32Array(m * layers * 2), COL = new Float32Array(m * layers * 4), I = new Uint32Array(tris.length * layers);
  base.forEach(([v, axis], j) => {
    const x = X[v * 3], y = X[v * 3 + 1], z = X[v * 3 + 2], nx = NR[v * 3], ny = NR[v * 3 + 1], nz = NR[v * 3 + 2];
    let dx = dir[v * 3], dy = dir[v * 3 + 1], dz = dir[v * 3 + 2]; const dl = Math.hypot(dx, dy, dz);
    const k = dl > 0.1 ? lean : 0, c = Math.sqrt(1 - k * k); if (dl > 0.1) { dx /= dl; dy /= dl; dz /= dl; }
    const gx = nx * c + dx * k, gy = ny * c + dy * k, gz = nz * c + dz * k;                 // the way the hair stands here: off the skin, leaning the combed way
    const u = (axis === 0 ? z : x) / TILE_M, w = (axis === 1 ? z : -y) / TILE_M;
    for (let l = 0; l < layers; l++) {
      const f = (l + 1) / layers, h = height[v] * f, o = l * m + j;
      P[o * 3] = x + gx * h; P[o * 3 + 1] = y + gy * h; P[o * 3 + 2] = z + gz * h;
      N[o * 3] = nx; N[o * 3 + 1] = ny; N[o * 3 + 2] = nz;
      T[o * 4] = gx; T[o * 4 + 1] = gy; T[o * 4 + 2] = gz; T[o * 4 + 3] = 1;
      UV[o * 2] = u; UV[o * 2 + 1] = w;
      COL[o * 4] = f; COL[o * 4 + 1] = height[v] > 0.0005 ? left[v] : 0; COL[o * 4 + 2] = 0; COL[o * 4 + 3] = 1;
    }
  });
  for (let l = 0; l < layers; l++) for (let t = 0; t < tris.length; t++) I[l * tris.length + t] = l * m + tris[t];
  return { position: P, normal: N, tangent: T, uv: UV, color: COL, index: I, layers, triangles: I.length / 3 };
}

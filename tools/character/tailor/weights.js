// Skin weights for the clothes (docs/TAILOR.md §3b): a garment moves with the body by the body's own skinning, no
// simulation. Each point takes the weights of the skin round it: the skin's points near its nearest, by a Gaussian on
// how much farther they are. The width is the same for every layer close to the body, so a shirt and the trousers over
// it get the same weights and keep their few millimetres apart; it widens for cloth that stands off (a skirt's hem
// between the knees moves with both thighs, not with the one it happens to be nearest). A function of the point's
// place, so it's smooth over the cloth and the same on both sides of a seam. (Copying the closest skin point's weights
// isn't: over a groove, the spine's, points either side of it project onto different walls and one point on the line
// between gets weights of its own, a spike when the back bends.)
import { PointGrid } from "./mesh.js";

/** the body to take weights from: its rest points P (the ones the clothes were cut on) and its skinning, four bones a
    point (BI) with their weights (BW) */
export function skinOf(P, BI, BW) {
  return { P, BI, BW, grid: new PointGrid(P, 0.015) };
}

/** a garment's points (rest, the body's space) -> {index: Uint16Array, weight: Float32Array}, four bones a point.
    `soft` is the Gaussian's width near the body (m); past `near` off the skin it grows by `spread` a metre. */
export function transfer(K, P, { soft = 0.015, near = 0.03, spread = 0.5 } = {}) {
  const n = P.length / 3, index = new Uint16Array(n * 4), weight = new Float32Array(n * 4);
  const { BI, BW } = K, B = K.P, G = K.grid, c = G.cell, acc = new Map();
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], v0 = G.nearest(x, y, z, 0.6);
    if (v0 < 0) { weight[i * 4] = 1; continue; }                        // nowhere near the body: its first bone, the root
    const d0 = Math.hypot(B[v0 * 3] - x, B[v0 * 3 + 1] - y, B[v0 * 3 + 2] - z), sig = soft + spread * Math.max(0, d0 - near), R = d0 + 2.5 * sig;
    const Rc = Math.ceil(R / c), ix = Math.floor((x - G.lo[0]) / c), iy = Math.floor((y - G.lo[1]) / c), iz = Math.floor((z - G.lo[2]) / c);
    acc.clear();
    for (let kz = Math.max(0, iz - Rc); kz <= Math.min(G.nz - 1, iz + Rc); kz++) for (let ky = Math.max(0, iy - Rc); ky <= Math.min(G.ny - 1, iy + Rc); ky++) {
      const row = (kz * G.ny + ky) * G.nx;
      for (let kx = Math.max(0, ix - Rc); kx <= Math.min(G.nx - 1, ix + Rc); kx++) for (let q = G.start[row + kx], e = G.start[row + kx + 1]; q < e; q++) {
        const p = G.items[q], d = Math.hypot(B[p * 3] - x, B[p * 3 + 1] - y, B[p * 3 + 2] - z); if (d > R) continue;
        const w = Math.exp(-(((d - d0) / sig) ** 2));
        for (let k = 0; k < 4; k++) { const bw = BW[p * 4 + k]; if (bw > 0) acc.set(BI[p * 4 + k], (acc.get(BI[p * 4 + k]) || 0) + bw * w); }
      }
    }
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((a, e) => a + e[1], 0) || 1;
    top.forEach(([b, w], k) => { index[i * 4 + k] = b; weight[i * 4 + k] = w / sum; });
  }
  return { index, weight };
}

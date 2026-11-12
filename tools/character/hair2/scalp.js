// The scalp, painted from the pores (the hair editor v2.0, docs/HAIR_V2.md §3.10): the scalp's own patch of the skin,
// lifted a hair off it, with a small texture that has a soft dot for every growing pore. Under thick hair the dots
// merge into the roots' shade; under thin hair and at the hairline they thin out with the pores, so the edge is soft;
// on a buzz cut or a shaved head they are the stubble; along the parting the skin is left clear. In place of the
// salon's flat darkened cap, which reads as painted on at a hairline. Plain arrays.
//
//   patch(body, pores)                 -> { position, normal, uv, index, vert }   the scalp's triangles (where pores are), on the chart below
//   paint(body, grown, s, spacing, colour, size) -> RGBA bytes (size x size): the colour the roots', the alpha the shade; grown: every pore that grows (all of the fixed set inside the hairline: the shade is as fine as the pores),
//                                                  { n, pos, weight (a pore's share of a full dot: less at the hairline's soft edge, where the hairs are short and fine) }
//
// The chart for the texture: the scalp unrolled from the top of the head, the front up: a point's angle from straight
// up is its distance from the picture's middle, its angle round the head its direction (135 degrees down is the edge).
import { partingSide, partingShare, sagittal } from "./flow.js";
import { earIn } from "./pores.js";

const REACH = 135 * Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function chartUV(x, y, z, C) {
  const dx = x - C[0], dy = y - C[1], dz = z - C[2], r = Math.hypot(dx, dy, dz) || 1e-9, th = Math.acos(clamp(dy / r, -1, 1)), az = Math.atan2(dx, dz), rho = Math.min(0.5, th / REACH * 0.5);
  return [0.5 + rho * Math.sin(az), 0.5 - rho * Math.cos(az)];
}

export function patch(body, pores, lift = 0.0004) {
  const { L, T, VN, C } = body, on = new Uint8Array(L.length / 3);
  for (let i = 0; i < pores.n; i++) { const t = pores.tri[i] * 3; on[T[t]] = on[T[t + 1]] = on[T[t + 2]] = 1; }
  // and two rings of triangles round them (never an ear's flap, which lies over the same place on the chart): no holes
  // where a small triangle holds no pore, and the paint fades out inside the patch, not at its jagged edge
  const D = 180 / Math.PI, ear = v => earIn(Math.atan2(L[v * 3] - C[0], L[v * 3 + 2] - C[2]) * D, L[v * 3 + 1]) < 1 && Math.hypot(L[v * 3] - C[0], L[v * 3 + 2] - C[2]) > 0.079;
  for (let ring = 0; ring < 2; ring++) {
    const add = [];
    for (let t = 0; t < T.length; t += 3) { const a = T[t], b = T[t + 1], c = T[t + 2]; if ((on[a] || on[b] || on[c]) && !(on[a] && on[b] && on[c])) for (const v of [a, b, c]) if (!on[v] && !ear(v)) add.push(v); }
    for (const v of add) on[v] = 1;
  }
  const map = new Int32Array(L.length / 3).fill(-1), pos = [], nrm = [], uv = [], idx = [], vert = [];
  for (let t = 0; t < T.length; t += 3) {
    if (!on[T[t]] || !on[T[t + 1]] || !on[T[t + 2]]) continue;
    for (let k = 0; k < 3; k++) {
      const v = T[t + k];
      if (map[v] < 0) { map[v] = pos.length / 3; vert.push(v); const x = L[v * 3] + VN[v * 3] * lift, y = L[v * 3 + 1] + VN[v * 3 + 1] * lift, z = L[v * 3 + 2] + VN[v * 3 + 2] * lift; pos.push(x, y, z); nrm.push(VN[v * 3], VN[v * 3 + 1], VN[v * 3 + 2]); uv.push(...chartUV(L[v * 3], L[v * 3 + 1], L[v * 3 + 2], C)); }
      idx.push(map[v]);
    }
  }
  return { position: new Float32Array(pos), normal: new Float32Array(nrm), uv: new Float32Array(uv), index: new Uint32Array(idx), vert: new Uint32Array(vert) };   // vert: each patch point's point on the body
}

// grown: { n, pos (3 a pore, the body's) }; s: the settings (the parting's width, scalp.shade, scalp.stubble); spacing: the pores' (m)
export function paint(body, grown, s, spacing, colour = [10, 9, 9], size = 512) {
  const C = body.C, A = new Float32Array(size * size), sc = s.scalp || {}, stub = clamp(sc.stubble || 0, 0, 1);
  const R = 0.094, kr = 0.5 / REACH / R * size;                           // pixels a metre, along a line down from the top
  const sig = Math.max(1.2, spacing * 0.95 * kr), reach = Math.ceil(sig * 2.6);   // dots wide enough to run together: a shade, not a pattern (short hair's own dots are the shells')
  for (let i = 0; i < grown.n; i++) {
    const [u, v] = chartUV(grown.pos[i * 3], grown.pos[i * 3 + 1], grown.pos[i * 3 + 2], C), cx = u * size, cy = v * size, wt = grown.weight ? grown.weight[i] : 1;
    // round the head a dot is wider in the picture than down it, more so toward the edge: squeezed back to round on the skin
    const dxc = cx - size / 2, dyc = cy - size / 2, rho = Math.hypot(dxc, dyc) / size, th = rho / 0.5 * REACH, kt = th > 0.05 ? (rho * size) / (R * Math.sin(Math.min(th, 2.2))) : kr, q = clamp(kt / kr, 1, 2.2);
    const rl = Math.hypot(dxc, dyc) || 1, rx = dxc / rl, ry = dyc / rl;
    const x0 = Math.max(0, Math.floor(cx - reach * q)), x1 = Math.min(size - 1, Math.ceil(cx + reach * q)), y0 = Math.max(0, Math.floor(cy - reach * q)), y1 = Math.min(size - 1, Math.ceil(cy + reach * q));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const ex = x + 0.5 - cx, ey = y + 0.5 - cy, a = ex * rx + ey * ry, b = (-ex * ry + ey * rx) / q, d2 = (a * a + b * b) / (sig * sig);
      if (d2 < 7) A[y * size + x] += Math.exp(-d2) * q * wt;             // (as much shade from a dot wherever it is on the chart)
    }
  }
  const out = new Uint8ClampedArray(size * size * 4), shade = clamp(sc.shade ?? 0.85, 0, 1), pw = (s.parting && s.parting.kind !== "none" ? s.parting.width || 0 : 0) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const k = y * size + x; let a = smooth(0.15, 1.6, A[k]);
    if (pw > 0 && a > 0) {                                                // the parting's skin: left clear by its width
      const ex = (x + 0.5) / size - 0.5, ey = (y + 0.5) / size - 0.5, rho = Math.hypot(ex, ey), th = rho / 0.5 * REACH, az = Math.atan2(ex, -ey);
      const px = C[0] + R * Math.sin(th) * Math.sin(az), py = C[1] + R * Math.cos(th), pz = C[2] + R * Math.sin(th) * Math.cos(az);
      if (partingShare(s, sagittal(py, pz, C)) > 0.5) a *= smooth(pw * 0.6, pw + 0.0016, Math.abs(partingSide(s, px, pz)));
    }
    out[k * 4] = colour[0]; out[k * 4 + 1] = colour[1]; out[k * 4 + 2] = colour[2]; out[k * 4 + 3] = Math.round(255 * shade * a);
  }
  return out;
}

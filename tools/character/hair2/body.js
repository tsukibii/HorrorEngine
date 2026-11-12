// A body for the hair editor v2.0: its points in the head's local space (salonref.js: the origin between the ears,
// X the character's left, Y up, Z forward, metres on MHR's base head), its smooth normals, the skull's middle, and
// back again. Plain arrays; the page, its worker and node share it.
//
//   localBody(P, T) -> { L, T, VN, hf, C }     P: the body's points (the Studio's, metres), T: its triangles
//   toWorld(body, q) / dirToWorld(body, d)     a local point or direction back in the body's space
import { headFrame, toLocal, toWorld as frameToWorld, MV } from "../salonref.js";
import { vertexNormals } from "./sdf.js";
import { earIn } from "./pores.js";

export function localBody(P, T, anchors) {
  const hf = anchors ? headFrame(P, anchors) : headFrame(P), L = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) { const q = toLocal(hf, [P[i], P[i + 1], P[i + 2]]); L[i] = q[0]; L[i + 1] = q[1]; L[i + 2] = q[2]; }
  // the skull's middle, as the salon's collider finds it: half way front to back among the points over the ears
  let zmin = Infinity, zmax = -Infinity;
  for (let i = 0; i < L.length; i += 3) if (L[i + 1] > 0.02 && Math.hypot(L[i], L[i + 1], L[i + 2]) < 0.16) { zmin = Math.min(zmin, L[i + 2]); zmax = Math.max(zmax, L[i + 2]); }
  return { L, T, VN: vertexNormals(L, T), hf, C: [0, 0.01, isFinite(zmin) ? (zmin + zmax) / 2 : 0] };
}
export const toWorld = (body, q) => frameToWorld(body.hf, q);
export const dirToWorld = (body, d) => MV(body.hf.B, d);
// the head's frame as a column-major 4x4 (three.js and glTF): local metres -> the body's space
export function frameMatrix(hf) {
  const { B, S, C } = hf;
  return [B[0][0] * S, B[1][0] * S, B[2][0] * S, 0, B[0][1] * S, B[1][1] * S, B[2][1] * S, 0, B[0][2] * S, B[1][2] * S, B[2][2] * S, 0, C[0], C[1], C[2], 1];
}

// the ears as two rounded lumps (sdf.js withLumps): each ear's flap found on the chart (the points that stand furthest
// out there), a lump from the skull's side out past it and a little over and behind it
export function earLumps(body) {
  const { L, C } = body, out = [];
  for (const side of [1, -1]) {
    const pts = [];
    for (let i = 0; i < L.length; i += 3) { const x = L[i] * side; if (x < 0.05) continue; const az = Math.atan2(x, L[i + 2] - C[2]) * 180 / Math.PI; if (earIn(az, L[i + 1]) < 0.92) pts.push([x, L[i + 1], L[i + 2]]); }
    if (pts.length < 12) continue;
    const xs = pts.map(p => p[0]).sort((a, b) => a - b), skull = xs[Math.floor(xs.length * 0.15)], flap = pts.filter(p => p[0] > xs[Math.floor(xs.length * 0.55)]);
    const lo = [1, 1, 1], hi = [-1, -1, -1]; for (const p of flap) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[a]); hi[a] = Math.max(hi[a], p[a]); }
    out.push({ c: [side * (skull - 0.004), (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], r: [hi[0] + 0.0035 - (skull - 0.004), (hi[1] - lo[1]) / 2 + 0.014, (hi[2] - lo[2]) / 2 + 0.012] });
  }
  return out;
}

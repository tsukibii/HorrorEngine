// Fabric coordinates for the tailor's garments: every point gets (u, v) in metres on the part it lies on, so a fabric
// tile (tools/character/tailor/fabric.js) is laid at its real size, the way a sewn garment's panels lie: the torso as a
// front and a back panel (u the arc length across each row's own outline from the middle; side seams), a sleeve
// round the arm's line (the seam underneath), a trouser leg round its own line from the waist down (the seam at the back,
// a stocking's), a skirt as a front and a back panel spreading to the hem as flared panels do. u runs across, v up. Points are
// split only along those seams; the normals come from the joined mesh, so the light doesn't break there.
import { normals, split } from "./mesh.js";

export const PARTS = ["front", "arm L", "arm R", "leg L", "leg R", "skirt", "back"];
const TAU = Math.PI * 2;

/** which part a point is on (an index into PARTS); legs reach up to `legsTo` (a bottom's waist: its legs are one
    panel each from there down) */
export function partAt(F, x, y, z, o = {}) {
  if (o.rings) return 5;
  const a = F.arm(x, y, z);
  if (a) return a.side === "L" ? 1 : 2;
  if (y < Math.max(F.crotchY - 0.01 * F.s, o.legsTo ?? -1)) { const [cx] = F.torsoAxis(Math.min(y, F.crotchY)); return x >= cx ? 3 : 4; }
  return z >= F.torsoAxis(y)[1] ? 0 : 6;
}

/** [angle (-pi..pi, what wraps at the seam), v, metres per radian round] of a point on a part */
function coords(F, part, x, y, z, rings, radii) {
  if (part === 0 || part === 6) return [F.torsoU(x, y, z, part === 6), y, 1];   // panels: no angle to wrap (the 1 is metres per unit)
  if (part === 5) {                                                   // a skirt: a front and a back panel spreading to the hem, seams at the sides
    const a = Math.atan2(x - rings.cx, z - rings.cz), r = rings.radius(y);
    return [Math.abs(a) <= Math.PI / 2 ? a * r : 2 - (a > 0 ? Math.PI - a : -Math.PI - a) * r, y, 1];   // each reads left to right from its side
  }
  if (part === 3 || part === 4) {
    const L = F.legLines[part === 3 ? "L" : "R"], [t] = L.project(x, y, z), [cx, , cz] = L.at(t);
    return [Math.atan2(x - cx, z - cz), y, radii ? radii(part, t) : F.legR];
  }
  const A = F.arms[part === 1 ? "L" : "R"], [t] = A.line.project(x, y, z), c = A.line.at(t), d = A.line.dir(t);
  // round the arm from its top: the seam is underneath
  const up = [-d[1] * d[0], 1 - d[1] * d[1], -d[1] * d[2]], ul = Math.hypot(...up) || 1, e1 = up.map(v => v / ul);
  const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]];
  const r = [x - c[0], y - c[1], z - c[2]];
  return [Math.atan2(r[0] * e2[0] + r[1] * e2[1] + r[2] * e2[2], r[0] * e1[0] + r[1] * e1[1] + r[2] * e1[2]), -t, (radii ? radii(part, t) : F.armR) * (part === 1 ? -1 : 1)];   // reading left to right from beside the arm
}

/** the seams as values, each 0 along its line: the torso's sides, the sleeves' seams and their undersides, the legs'
    middle and their backs, a coverall's waist, a skirt's sides. The mesh is split along each before it's unwrapped */
function seams(F, o) {
  const s = F.s, out = [], legsTo = o.legsTo ?? -1;
  if (o.rings) return [(x, y, z) => z - o.rings.cz];                                          // a skirt's sides
  const legTop = Math.max(F.crotchY - 0.01 * s, legsTo);
  out.push((x, y, z) => (y < legTop || F.arm(x, y, z) ? 1 : z - F.torsoAxis(y)[1]));       // the sides
  for (const k of ["L", "R"]) {
    const A = F.arms[k], sg = A.sg;
    out.push((x, y, z) => { if (x * sg < 0.08 * s || y < F.crotchY) return 1; const [t, d] = A.line.project(x, y, z); return d < 0.11 * s ? t - A.seam : 1; });
    out.push((x, y, z) => {                                                                    // round underneath
      const a = F.arm(x, y, z); if (!a || a.side !== k) return 1;
      const [t] = A.line.project(x, y, z), c = A.line.at(t), d = A.line.dir(t);
      const up = [-d[1] * d[0], 1 - d[1] * d[1], -d[1] * d[2]], ul = Math.hypot(...up) || 1, e1 = up.map(v => v / ul);
      const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]], r = [x - c[0], y - c[1], z - c[2]];
      return r[0] * e1[0] + r[1] * e1[1] + r[2] * e1[2] > 0 ? 1 : r[0] * e2[0] + r[1] * e2[1] + r[2] * e2[2];
    });
  }
  out.push((x, y, z) => (y >= legTop || F.arm(x, y, z) ? 1 : x - F.torsoAxis(Math.min(y, F.crotchY))[0]));   // between the legs
  for (const k of ["L", "R"]) {                                                                  // down the backs of the legs
    const L = F.legLines[k], sg = k === "L" ? 1 : -1;
    out.push((x, y, z) => { if (y >= legTop || x * sg < 0 || F.arm(x, y, z)) return 1; const [t] = L.project(x, y, z), c = L.at(t); return z > c[2] ? 1 : x - c[0]; });
  }
  if (legsTo > F.crotchY) out.push((x, y, z) => (F.arm(x, y, z) ? 1 : y - legTop));               // a coverall's waist
  return out;
}

/**
 * A garment part's mesh with fabric coordinates: {P, T, N, UV, PART, S}. Split along its seams first; then each
 * triangle takes the part its middle is on, its corners are unwrapped round that part from the first one, and a point
 * is shared only by corners that agree.
 */
export function unwrap(F, P, T, S, o = {}) {
  for (const f of seams(F, o)) {
    const n = P.length / 3, v = new Float32Array(n);
    for (let i = 0; i < n; i++) v[i] = f(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    const r = split(P, T, v, S); P = r.P; T = r.T; S = r.S;
  }
  const N0 = normals(P, T), rings = o.rings || null, keys = new Map();
  // each sleeve's and leg's own radius along it (1 cm rings, from this garment's points): u is true metres round every ring
  const bins = new Map(), BIN = 0.01;
  for (let i = 0; i < P.length / 3; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], part = partAt(F, x, y, z, o);
    if (part < 1 || part > 4) continue;
    const L = part <= 2 ? F.arms[part === 1 ? "L" : "R"].line : F.legLines[part === 3 ? "L" : "R"], [t, d] = L.project(x, y, z);
    const k = part * 1000 + Math.round(t / BIN), b = bins.get(k) || [0, 0]; b[0] += d; b[1]++; bins.set(k, b);
  }
  const radii = (part, t) => {
    const k = Math.round(t / BIN); let sum = 0, n = 0;
    for (let j = k - 2; j <= k + 2; j++) { const b = bins.get(part * 1000 + j); if (b) { sum += b[0] / b[1]; n++; } }
    return n ? sum / n : part <= 2 ? F.armR : F.legR;
  };
  const oP = [], oN = [], oUV = [], oPart = [], oS = [], tri = new Uint32Array(T.length);
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
    const part = partAt(F, (P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3, o);
    let a0 = null;
    for (let k = 0; k < 3; k++) {
      const v = T[t + k];
      let [ang, w, R] = coords(F, part, P[v * 3], P[v * 3 + 1], P[v * 3 + 2], rings, radii);
      if (a0 === null) a0 = ang;
      else if (part !== 0 && part !== 6 && part !== 5 && ang - a0 > Math.PI) ang -= TAU;   // across the seam: on the first corner's side
      else if (part !== 0 && part !== 6 && part !== 5 && a0 - ang > Math.PI) ang += TAU;
      const u = ang * R, key = v * 8 + part + "|" + Math.round(u * 2000);
      let id = keys.get(key);
      if (id === undefined) {
        id = oS.length; keys.set(key, id);
        oP.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); oN.push(N0[v * 3], N0[v * 3 + 1], N0[v * 3 + 2]);
        oUV.push(u, w); oPart.push(part); oS.push(S ? S[v] : 1);
      }
      tri[t + k] = id;
    }
  }
  return { P: new Float32Array(oP), T: tri, N: new Float32Array(oN), UV: new Float32Array(oUV), PART: new Float32Array(oPart), S: new Float32Array(oS) };
}

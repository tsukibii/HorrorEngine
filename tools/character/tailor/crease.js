// Creases for the tailor's garments (DECISIONS 2026-11-01: "what makes our clothes bland is we are missing creases ...
// add a crease gen, basically how we emulate wrinkles on faces"): the cloth's small relief drawn as a height in the
// garment's shader, the way skinshader.js draws the skin's wrinkles, never as geometry. The drape (tailor/drape.js)
// gives the big folds; this gives what a sewn, worn garment has on top of them:
//
//   folds      soft ridges where the cloth bunches when the body bends: inside the elbow, behind the knee, a sleeve
//              stacking at the wrist, a trouser leg breaking on the shoe, the waist
//   drag lines diagonal pulls from where the cloth is held: the crotch down the front of the thigh (a jean's whiskers),
//              from the armpit across the chest
//   press      a trouser leg's pressed crease down the middle of its front
//   seams      the stitched line sunk in, the cloth puckered a few millimetres either side
//   hems       a turned hem's edge rolled, its row of stitches a centimetre and a bit in, where the turn-up ends
//   crinkle    the fabric's own small wrinkles from wear, stretched by gravity: linen's many, wool's few, knit's none
//   drape      fine vertical streaks down skirts and wide legs between the drape's folds
//
// Per vertex, made when a garment is unwrapped (tailor/uv.js `unwrap`), `crz` = (bend: how much it bunches there,
// drag: how much it's pulled, seam: metres to the nearest seam, edge: metres to the nearest hem or edge); a loose leg (`loose`, the leg's ease in metres) doesn't fold at the knee: it doesn't touch it. The shader
// (tailor/look.js) reads them with the fabric coordinates (metres: u round, v along) and the part, so the creases lie
// at their real size; amounts by the fabric (`CREASE`) and the garment's own `crease` (a design's, or an edit's).
// The height is in metres of cloth; its slope bends the normal (view) and is baked into the export's normal map
// (albedo.js bakeClothMaps); the valleys darken the colour a little (ambient occlusion in the folds).
import { smooth } from "./mesh.js";

// by fabric: crinkle (its own wrinkles), fold (how deep its bends bunch), press (a pressed crease holds), seam (how
// much a seam puckers), stitch (a hem's stitches show), drape (streaks between the folds)
export const CREASE = {
  flat: { crinkle: 0.3, fold: 0.6, press: 0, seam: 0.6, stitch: 0.6, drape: 0.4 },
  cotton: { crinkle: 0.55, fold: 0.8, press: 0, seam: 0.8, stitch: 1, drape: 0.4 },
  linen: { crinkle: 1.2, fold: 1, press: 0, seam: 0.9, stitch: 1, drape: 0.5 },
  crepe: { crinkle: 0.25, fold: 0.6, press: 0.6, seam: 0.6, stitch: 0.6, drape: 0.8 },
  flannel: { crinkle: 0.18, fold: 0.6, press: 0.9, seam: 0.6, stitch: 0.5, drape: 0.6 },
  jersey: { crinkle: 0.12, fold: 0.6, press: 0, seam: 0.4, stitch: 0.7, drape: 0.3 },
  denim: { crinkle: 0.35, fold: 1.1, press: 0, seam: 1.1, stitch: 1.2, drape: 0.3 },
  canvas: { crinkle: 0.35, fold: 0.9, press: 0, seam: 1, stitch: 1.1, drape: 0.2 },
  twill: { crinkle: 0.3, fold: 0.8, press: 0.8, seam: 0.8, stitch: 0.9, drape: 0.5 },
  knit: { crinkle: 0.04, fold: 0.5, press: 0, seam: 0.3, stitch: 0, drape: 0.2 },
  rib: { crinkle: 0, fold: 0.2, press: 0, seam: 0.2, stitch: 0, drape: 0 },
  wool: { crinkle: 0.12, fold: 0.55, press: 0.7, seam: 0.6, stitch: 0.5, drape: 0.5 },
  tweed: { crinkle: 0.1, fold: 0.5, press: 0.4, seam: 0.6, stitch: 0.4, drape: 0.3 },
  silk: { crinkle: 0.45, fold: 0.7, press: 0, seam: 0.5, stitch: 0.5, drape: 0.9 },
  satin: { crinkle: 0.35, fold: 0.7, press: 0, seam: 0.5, stitch: 0.5, drape: 0.9 },
  spandex: { crinkle: 0, fold: 0.15, press: 0, seam: 0.3, stitch: 0.4, drape: 0 },
  leather: { crinkle: 0.3, fold: 1.2, press: 0, seam: 0.9, stitch: 1.3, drape: 0.2 },
  patent: { crinkle: 0.1, fold: 0.8, press: 0, seam: 0.6, stitch: 1, drape: 0 },
  suede: { crinkle: 0.25, fold: 1, press: 0, seam: 0.8, stitch: 1, drape: 0.2 },
  velvet: { crinkle: 0.2, fold: 0.7, press: 0, seam: 0.5, stitch: 0.3, drape: 0.6 },
  quilted: { crinkle: 0.1, fold: 0.5, press: 0, seam: 0.6, stitch: 0.6, drape: 0 },
  rubber: { crinkle: 0, fold: 0.3, press: 0, seam: 0.3, stitch: 0, drape: 0 },
  sheer: { crinkle: 0, fold: 0, press: 0, seam: 0, stitch: 0, drape: 0 },
  fishnet: { crinkle: 0, fold: 0, press: 0, seam: 0, stitch: 0, drape: 0 },
  lace: { crinkle: 0, fold: 0.2, press: 0, seam: 0, stitch: 0, drape: 0.2 },
  laced: { crinkle: 0.1, fold: 0.4, press: 0, seam: 0.4, stitch: 0.4, drape: 0.4 },
  sequin: { crinkle: 0, fold: 0.3, press: 0, seam: 0.2, stitch: 0, drape: 0 },
};
/** the crease settings a garment wears: its fabric's, scaled by `amount` (the Creases slider, 1 as made), with the
    design's or an edit's own (`crease: {amount, crinkle, fold, press, seam, stitch, drape}`) over them */
export function creaseOf(surface, own = {}) {
  const base = CREASE[surface] || CREASE.flat, a = own.amount ?? 1, out = { amount: a };
  for (const k of ["crinkle", "fold", "press", "seam", "stitch", "drape"]) out[k] = (own[k] ?? base[k]) * a;
  return out;
}

const CAP = 0.05;                                       // metres: distances further than this don't matter to the shader
/** Dijkstra along the mesh's edges from `seeds` (vertex ids), stopping at CAP: metres to the nearest seed */
function spread(P, nbr, seeds) {
  const n = P.length / 3, heap = []; let d = new Float64Array(n).fill(CAP);   // (64-bit: a float32 store rounds a sum up, and a zero-length edge then improves it for ever)
  const push = (v, k) => { heap.push([k, v]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (const s of seeds) { d[s] = 0; push(s, 0); }
  while (heap.length) {
    const [k, v] = pop(); if (k > d[v]) continue;
    for (const w of nbr[v]) {
      const e = Math.hypot(P[v * 3] - P[w * 3], P[v * 3 + 1] - P[w * 3 + 1], P[v * 3 + 2] - P[w * 3 + 2]), nk = k + e;
      if (nk < d[w] - 1e-9) { d[w] = nk; push(w, nk); }
    }
  }
  // the graph's distances step along its edges (a zigzag across the triangles): relaxed a few rounds toward their
  // neighbours' (the seeds held), so the lines drawn at a distance come out smooth
  for (let it = 0; it < 6; it++) {
    const e = Float64Array.from(d);
    for (let v = 0; v < n; v++) {
      if (d[v] === 0 || d[v] >= CAP || !nbr[v].length) continue;
      let sum = 0; for (const w of nbr[v]) sum += d[w];
      e[v] = 0.5 * d[v] + 0.5 * sum / nbr[v].length;
    }
    d = e;
  }
  return d;
}

/**
 * The crease data of an unwrapped garment part: `crz` (4 a vertex). P: the points as they hang (the distances along
 * the cloth); R: where they were cut (the body's frame: where the elbow, the knee, the crotch are); T: triangles;
 * part: each point's part (tailor/uv.js PARTS); S: the shade (1, less on a hem's last row and its rim: the hems'
 * seeds); src: each point's point before the seams split it (a seam is where one point became two). F: the body's frame.
 */
export function creaseData(F, P, R, T, part, S, src, shoe = false, loose = 0, top = false, stack = 0.05) {
  const n = P.length / 3, s = F.s, crz = new Float32Array(n * 4);
  const nbr = Array.from({ length: n }, () => []), count = new Map();
  for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = T[t + k], b = T[t + (k + 1) % 3]; nbr[a].push(b);
    const key = a < b ? a * n + b : b * n + a; count.set(key, (count.get(key) || 0) + 1);
  }
  const copies = new Map(); for (let i = 0; i < n; i++) copies.set(src[i], (copies.get(src[i]) || 0) + 1);
  const seamSeeds = new Set(), hemSeeds = [];
  for (const [key, c] of count) if (c === 1) { const a = Math.floor(key / n), b = key % n; for (const v of [a, b]) if (copies.get(src[v]) > 1) seamSeeds.add(v); }
  for (let i = 0; i < n; i++) if (S[i] < 0.999) hemSeeds.push(i);
  const seam = spread(P, nbr, seamSeeds), edge = spread(P, nbr, hemSeeds);
  const g = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
  // a loose top's hang (CLOTHING_PLAN 5): the bagginess shown by folds on cloth that's fitted, never by the cut's
  // size: soft vertical folds down the front from under the bust and down the back from under the shoulder blades,
  // the sleeve's sag along its underside, blousing over the waist; by the ease (4 mm none, 14 mm all), carried as a
  // negative drag (a top isn't dragged where it hangs)
  const loosen = top ? smooth(0.004, 0.014, loose) : 0;
  for (let i = 0; i < n; i++) {
    const x = R[i * 3], y = R[i * 3 + 1], z = R[i * 3 + 2], p = part[i];
    let bend = 0, drag = 0;
    if (shoe) { /* a shoe: its seams and edges only, no folds */ }
    else if (p === 1 || p === 2) {                                        // a sleeve: inside the elbow, stacking at the wrist
      const A = F.arms[p === 1 ? "L" : "R"], [t] = A.line.project(x, y, z), c = A.line.at(t), r = [x - c[0], y - c[1], z - c[2]], rl = Math.hypot(...r) || 1;
      const inside = r[2] / rl;                                     // the arm's front: the elbow's inside (MHR's arms hang palms in)
      bend = g(t, A.elbow, 0.06 * s) * (0.3 + 0.7 * smooth(-0.3, 0.9, inside)) + 0.85 * smooth(A.wrist - 0.12 * s, A.wrist - 0.02 * s, t);
      if (loosen) drag = -loosen * smooth(0.2, 0.85, -r[1] / rl) * smooth(A.seam + 0.03 * s, A.seam + 0.1 * s, t) * (1 - smooth(A.wrist - 0.1 * s, A.wrist - 0.03 * s, t));
    } else if (p === 3 || p === 4) {                                // a leg: behind the knee, the break on the shoe, the crotch's whiskers
      const L = F.legLines[p === 3 ? "L" : "R"], [t] = L.project(x, y, z), c = L.at(t), r = [x - c[0], 0, z - c[2]], rl = Math.hypot(r[0], r[2]) || 1;
      const front = r[2] / rl, inner = (p === 3 ? -1 : 1) * r[0] / rl;
      bend = g(y, F.kneeY, 0.06 * s) * (0.25 + 0.75 * smooth(-0.2, 0.9, -front)) * (1 - smooth(0.018, 0.04, loose)) + 0.9 * (1 - smooth(F.ankleY + 0.005 * s, F.ankleY + stack * s, y)) * smooth(F.ankleY - 0.012 * s, F.ankleY + 0.005 * s, y) * smooth(-0.3, 0.45, front);   // (the break only on cloth that reaches the shoe: a hem above it hangs clean; `stack` how far up it runs: a slouch sock's folds up the calf; none on the foot nor round the heel's back, where the leg's coordinates pinch: folds came out as shards)
      drag = smooth(F.crotchY - 0.22 * s, F.crotchY - 0.04 * s, y) * (1 - smooth(F.crotchY - 0.01 * s, F.crotchY + 0.03 * s, y)) * smooth(-0.3, 0.6, front) * (0.5 + 0.5 * smooth(-0.5, 0.6, inner));
    } else if (p === 0 || p === 6) {                                // the body: the waist, the armpits' pull across the chest
      const [cx] = F.torsoAxis(y), side = Math.abs(x - cx) / (0.16 * s);
      bend = (0.35 + 0.4 * loosen) * g(y, F.waistY, 0.05 * s);
      drag = g(y, F.armpitY - 0.05 * s, 0.06 * s) * smooth(0.35, 0.95, side) * (p === 0 ? 1 : 0.6);
      const hang = loosen * (p === 0 ? 1 - smooth(F.bustY - 0.11 * s, F.bustY, y) : 1 - smooth(F.armpitY - 0.16 * s, F.armpitY - 0.03 * s, y)) * (1 - 0.6 * smooth(0.6, 1, side));
      drag -= hang;                                                 // (one into the other: no edge where they meet)
    }
    crz[i * 4] = Math.min(1, bend); crz[i * 4 + 1] = Math.min(1, drag); crz[i * 4 + 2] = seam[i]; crz[i * 4 + 3] = edge[i];
  }
  return crz;
}

// ---- the shader ------------------------------------------------------------------------------------------------------
// clothH(): the height (metres of cloth) at the fabric coordinates `uv` (metres) on `part`, from the vertex's crease
// data `c` and the settings; `fw` the metres a pixel covers (what's finer than two pixels fades, so nothing shimmers).
// The fabric's slope (dh/du, dh/dv) is worked out from it by the screen's derivatives (clothSlope in look.js).
export const CREASE_GLSL = `
uniform float uCrAmt, uCrCrinkle, uCrFold, uCrPress, uCrSeam, uCrStitch, uCrDrape, uCrSeed;
float crHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float crNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(crHash(i), crHash(i + vec2(1.0, 0.0)), f.x), mix(crHash(i + vec2(0.0, 1.0)), crHash(i + vec2(1.0, 1.0)), f.x), f.y); }
float crFbm(vec2 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * crNoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; } return s; }
float crRidge(float x) { float r = 1.0 - abs(2.0 * fract(x) - 1.0); return r * r * (3.0 - 2.0 * r); }   // 0 in the valley, 1 on the ridge, soft both ways
float crFade(float fw, float period) { return 1.0 - smoothstep(period * 0.2, period * 0.5, fw); }
float clothH(vec2 uv, float part, vec4 c, float fw) {
  if (uCrAmt <= 0.0) return 0.0;
  vec2 q = uv + uCrSeed;
  float h = 0.0, limb = step(0.5, part) * step(part, 4.5), leg = step(2.5, part) * step(part, 4.5), hang = max(leg, step(4.5, part) * step(part, 5.5));
  // folds: rings round the limb (along v) where it bends, wavy, broken up, sharper in the valleys
  if (c.x > 0.01 && uCrFold > 0.0) {
    // each fold its own spacing (1.5 to 3 cm), tilted one way then the other round the limb (a zigzag, as bunched cloth
    // buckles), and only part of the way round: arcs, not rings
    // (the spacing varied by warping, never by dividing by a varying period: v is metres up the body, and that beats)
    float p = uv.y / 0.022 + 2.2 * crFbm(vec2(uv.x * 6.0, uv.y * 7.0) + uCrSeed) + 0.55 * sin(uv.x * 38.0 + 3.0 * crNoise(vec2(uv.x * 5.0, uv.y * 9.0) + uCrSeed));
    float arc = smoothstep(0.3, 0.75, crNoise(vec2(uv.x * 14.0, p * 0.8) + 3.1 + uCrSeed));   // smooth along and across: a step here draws dashes
    h += c.x * uCrFold * 0.0026 * (crRidge(p) - 0.6) * arc * crFade(fw, 0.02);
  }
  // drag lines: diagonal, from the crotch down and out over the thigh (each leg its own way), from the armpit down and in
  if (c.y > 0.01 && uCrFold > 0.0) {
    vec2 dir = leg > 0.5 ? normalize(vec2(part < 3.5 ? 1.0 : -1.0, -0.55)) : normalize(vec2(-sign(uv.x + 1e-4) * 0.7, -1.0));
    float p = dot(uv, vec2(-dir.y, dir.x)) / 0.024 + 0.8 * crFbm(uv * 10.0 + 7.0 + uCrSeed);
    float along = crNoise(vec2(dot(uv, dir) * 8.0, p * 0.5) + uCrSeed);
    h += c.y * uCrFold * 0.0018 * (crRidge(p) - 0.5) * smoothstep(0.2, 0.75, along) * crFade(fw, 0.022);
  }
  // the press: a sharp ridge down the middle of a trouser leg's front (u = 0 there)
  if (leg > 0.5 && uCrPress > 0.0) h += uCrPress * 0.0009 * exp(-pow(uv.x / 0.0022, 2.0)) * crFade(fw, 0.006);
  // seams: the stitched line sunk in, puckered a few millimetres either side, the pucker coming and going along it
  if (uCrSeam > 0.0 && c.z < 0.012) {
    float puck = 0.6 + 0.8 * crNoise(vec2((uv.x + uv.y) * 160.0, c.z * 300.0) + uCrSeed);
    h += uCrSeam * (-0.0008 * exp(-pow(c.z / 0.0016, 2.0)) + 0.0005 * puck * exp(-pow((c.z - 0.0050) / 0.0026, 2.0))) * crFade(fw, 0.006);
  }
  // hems: the turned edge rolled, the turn-up ending 2.5 cm in, a row of stitches 1.3 cm in
  if (uCrStitch > 0.0 && c.w < 0.03) {
    float dash = 0.5 + 0.5 * sin((uv.x + uv.y) * 6.2832 / 0.0032);
    h += uCrStitch * (0.00035 * exp(-pow(c.w / 0.003, 2.0)) + 0.00018 * (1.0 - smoothstep(0.022, 0.027, c.w))
                      - 0.0002 * dash * exp(-pow((c.w - 0.013) / 0.0008, 2.0)) * crFade(fw, 0.004));
  }
  // crinkle: the fabric's own wrinkles, longer than they're wide and hanging down (gravity), ridged
  if (uCrCrinkle > 0.0) {
    // creases as thin lines: where a noise stretched down the hang crosses its middle, a narrow valley with a soft
    // shoulder either side, the way a worn shirt's wrinkles are lines, not bumps; a second, finer set across them
    float n1 = crFbm(vec2(q.x * 14.0, q.y * 5.5)), n2 = crFbm(vec2(q.x * 9.0, q.y * 22.0) + 5.0);
    float l1 = exp(-pow((n1 - 0.5) / 0.035, 2.0)), l2 = exp(-pow((n2 - 0.5) / 0.03, 2.0));
    float b1 = exp(-pow((n1 - 0.5) / 0.12, 2.0)), b2 = exp(-pow((n2 - 0.5) / 0.1, 2.0));
    float spot = smoothstep(0.3, 0.75, crNoise(q * 4.0 + 11.0));   // wrinkled here, smooth there
    h += uCrCrinkle * ((0.0005 * b1 - 0.0011 * l1) * crFade(fw, 0.012) + (0.0002 * b2 - 0.0005 * l2) * crFade(fw, 0.008)) * (0.3 + 0.7 * spot);
  }
  // hang: a loose top's soft vertical folds (a negative drag), 5 cm apart, wandering, longer than the fabric's own
  // wrinkles; down a sleeve the same along its underside
  if (c.y < 0.0 && uCrFold > 0.0) {
    float p = uv.x / 0.05 + 0.9 * crFbm(vec2(uv.x * 4.0, uv.y * 1.6) + 13.0 + uCrSeed);
    float along = smoothstep(0.2, 0.7, crNoise(vec2(p * 0.7, uv.y * 3.0) + 9.0 + uCrSeed));
    h += -c.y * uCrFold * 0.022 * (crRidge(p) - 0.55) * (0.35 + 0.65 * along) * crFade(fw, 0.05);
  }
  // drape: fine vertical streaks down a skirt or a wide leg between the drape's folds
  if (uCrDrape > 0.0 && hang > 0.5) {
    float n3 = crFbm(vec2(q.x * 34.0, q.y * 2.2) + 2.0);
    h += uCrDrape * 0.0012 * (n3 - 0.5) * crFade(fw, 0.02);
  }
  return h * uCrAmt;
}
`;
/** the uniforms for CREASE_GLSL from a garment's crease settings (creaseOf) and a seed (each garment its own) */
export function creaseUniforms(cr, seed = 0) {
  return {
    uCrAmt: { value: cr.amount > 0 ? 1 : 0 }, uCrCrinkle: { value: cr.crinkle }, uCrFold: { value: cr.fold }, uCrPress: { value: cr.press },
    uCrSeam: { value: cr.seam }, uCrStitch: { value: cr.stitch }, uCrDrape: { value: cr.drape }, uCrSeed: { value: seed },
  };
}

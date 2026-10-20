// The fat suit (an experiment, docs/FLESH.md): a character's body as a lean body wearing a layer of fat. MHR's
// identity shapes share every vertex, so the same character made lean (the sliders solved for the least fat at the
// same height and limb lengths) sits exactly inside it: the gap, vertex by vertex, is the fat's thickness. That one
// number drives the physics, the way a layer of soft tissue behaves:
//   mass        m = density x thickness x skin area            (more fat, more mass)
//   stiffness   k = shear modulus x area / thickness           (a thick layer shears easily: soft; a thin one is stuck)
//   so its own frequency falls as 1 / thickness (thin skin over bone doesn't wobble; a belly does, slowly), and
//   its sag under gravity grows as thickness squared (density x g x h^2 / G).
// Each fat vertex is a damped spring around where the skinned fat suit puts it; neighbours pull on each other
// (the layer is continuous: waves, shared load); the lean body inside supports it (fat can't be pushed through
// muscle, and can't stretch away from it forever); gravity is measured against the standing pose the shape was
// made in, so lying down moves fat sideways but standing adds nothing.
import * as THREE from "three";
import { shapeMesh, SHAPES } from "./bodies.js";

// ---- the lean body inside: same height, arms and legs, least fat ----------------------------------------------
export function measures(mesh) {
  const G = mesh.geometry, P = G.attributes.position, MP = G.morphAttributes.position, D = mesh.morphTargetDictionary, n = P.count;
  const pick = f => { const o = []; for (let i = 0; i < n; i++) if (f(P.getX(i), P.getY(i), P.getZ(i))) o.push(i); return o; };
  let top = 0, low = 0;
  for (let i = 0; i < n; i++) { if (P.getY(i) > P.getY(top)) top = i; if (P.getY(i) < P.getY(low)) low = i; }
  const M = {   // [vertex set, axis 0/1/2, kind, role: keep (bones) or fat]
    height: [[top, low], 1, "height", "keep"],
    arms: [pick(x => Math.abs(x) > 40), 0, "absmax", "keep"],
    crotch: [pick((x, y) => Math.abs(x) < 1.5 && y > 60 && y < 100), 1, "min", "keep"],
    shoulders: [pick((x, y) => y > 138 && y < 146 && Math.abs(x) < 24), 0, "span", "keep"],
    waist: [pick((x, y) => y > 100 && y < 108 && Math.abs(x) < 22), 0, "span", "fat"],
    belly: [pick((x, y) => y > 92 && y < 110 && Math.abs(x) < 12), 2, "max", "fat"],
    hips: [pick((x, y) => y > 82 && y < 94 && Math.abs(x) < 24), 0, "span", "fat"],
    butt: [pick((x, y) => y > 78 && y < 96 && Math.abs(x) < 15), 2, "negmin", "fat"],
    chest: [pick((x, y) => y > 118 && y < 128 && Math.abs(x) < 16), 2, "span", "fat"],
    thighs: [pick((x, y) => y > 62 && y < 76 && x > 2 && x < 24), 0, "span", "fat"],
    upperarm: [pick((x, y) => y > 128 && y < 150 && Math.abs(x) > 22 && Math.abs(x) < 34), 2, "span", "fat"],
  };
  const val = (name, w) => {                       // w: per-component weights (array) or null for the base
    const [set, ax, kind] = M[name];
    const v = i => { let p = P.array[i * 3 + ax]; if (w) for (let c = 0; c < SHAPES; c++) if (w[c]) p += MP[D["shape_c_" + c]].array[i * 3 + ax] * w[c]; return p; };
    if (kind === "height") return v(top) - v(low);
    let lo = Infinity, hi = -Infinity; for (const i of set) { const x = v(i); lo = Math.min(lo, x); hi = Math.max(hi, x); }
    return kind === "span" ? hi - lo : kind === "max" ? hi : kind === "min" ? lo : kind === "negmin" ? -lo : Math.max(Math.abs(lo), Math.abs(hi));
  };
  return { M, val };
}

export function leanShape(mesh, outer, keepWeight = 40, ridge = 0.15, target = null) {
  // body components only (0-19): head and hands stay the character's; least squares on the linearised measures
  const { M, val } = measures(mesh), K = 20, names = Object.keys(M);
  const o = outer.slice(0, SHAPES).concat(new Array(Math.max(0, SHAPES - outer.length)).fill(0));
  const at = w => names.map(n => val(n, w));
  const m0 = at(o);
  const J = names.map(() => new Array(K).fill(0));
  for (let c = 0; c < K; c++) { const w = o.slice(); w[c] += 1; const m1 = at(w); names.forEach((n, r) => J[r][c] = m1[r] - m0[r]); }
  const avg = at(null);
  // targets: bones as they are; fat measures down to 70 % of the average body's (a lean, "flat" person)
  const tgt = names.map((n, r) => target ? target(n, m0[r], avg[r], M[n][3]) : M[n][3] === "keep" ? m0[r] : Math.min(m0[r], 0.7 * avg[r]));
  const wt = names.map((n, r) => (target ? tgt[r] === m0[r] : M[n][3] === "keep") ? keepWeight : 1);
  const A = Array.from({ length: K }, (_, i) => Array.from({ length: K }, (_, j) => J.reduce((s, row, r) => s + wt[r] * row[i] * row[j], 0) + (i === j ? ridge : 0)));
  const b = Array.from({ length: K }, (_, i) => J.reduce((s, row, r) => s + wt[r] * row[i] * (tgt[r] - m0[r]), 0));
  for (let i = 0; i < K; i++) {                     // Gauss-Jordan with pivoting
    let p = i; for (let r = i + 1; r < K; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let r = 0; r < K; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c < K; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
  }
  const lean = o.slice();
  for (let c = 0; c < K; c++) lean[c] = Math.max(-3, Math.min(3, o[c] + b[c] / A[c][c]));
  const report = Object.fromEntries(names.map(n => [n, { outer: +val(n, o).toFixed(1), lean: +val(n, lean).toFixed(1), average: +val(n, null).toFixed(1) }]));
  return { lean, report };
}

// a flat-chested, flat-backed version of a body: chest and backside down, everything else (waist, hips, thighs,
// shoulders, height, limbs) kept: the base the water balloons go on
export function flatShape(mesh, start) {
  return leanShape(mesh, start, 40, 0.15, (n, m0, avg) => n === "chest" ? Math.min(m0, 0.72 * avg) : n === "butt" ? Math.min(m0, 0.62 * avg) : m0);
}

// a slightly chubby hourglass from a woman's body: full bust, hips, backside and thighs, a waist that stays
// narrower than both, a soft belly; height, limbs and shoulders kept. Factors are of the average body's measures
// MHR widens the waist with the hips (its body space comes from scans: 0.78 waist to hips at the sliders' limits),
// so the waist is kept (0: held hard) and the rest of the curve is sculpted. Chest and backside are fitted flat, as
// for the balloons' base, and HOURGLASS_SCULPT puts the bust and backside back as volumes and cinches the waist
export const HOURGLASS = { chest: 0.72, hips: 1.25, butt: 0.62, thighs: 1.18, waist: 0, belly: 1.06, upperarm: 1.12 };
export const HOURGLASS_SCULPT = { bust: 0.6, butt: 0.55, belly: 0.35, droop: 0.35, cinch: 0.09, regions: false };
export function hourglassShape(mesh, start, f = HOURGLASS) {
  return leanShape(mesh, start, 40, f.ridge ?? 0.4, (n, m0, avg, role) => role === "keep" ? m0 : f[n] ? (n === "chest" || n === "butt" ? Math.min(m0, f[n] * avg) : f[n] * avg) : m0);
}

// ---- water balloons: breasts and buttocks as volumes of fluid in skin, added to a flat body ---------------------
// Each is a smooth dome on the body's surface (no surface detail), sized by its volume in litres. Its thickness feeds
// the same physics as the fat suit, plus: the fluid keeps its volume (squashed one side, it bulges the other) and the
// pair can't pass through each other at the midline.
export const BALLOONS = { bust: 0.9, butt: 0.6, droop: 0.3 };          // litres per side
export function balloonSculpt(opts = {}) {
  const o = Object.assign({}, BALLOONS, opts);
  return (sim, area, nrm) => {
    const N = sim.N, B = sim.outerBind;
    let top = -1e9, low = 1e9; for (let i = 0; i < N; i++) { top = Math.max(top, B[i * 3 + 1]); low = Math.min(low, B[i * 3 + 1]); }
    const H = top - low;
    const nn = i => { const v = new THREE.Vector3(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]); return v.normalize(); };
    const surf = (x, y, front) => {                // the body's surface point nearest (x, y) on its front or back
      let best = -1, bz = front ? -1e9 : 1e9;
      for (let i = 0; i < N; i++) { if (Math.abs(B[i * 3] - x) > 2.5 || Math.abs(B[i * 3 + 1] - y) > 2.5) continue; const z = B[i * 3 + 2]; if (front ? z > bz : z < bz) { bz = z; best = i; } }
      return best;
    };
    // where they sit, as fractions of height (the flat base measured, not guessed per person)
    const spots = [
      // sink: where the ellipsoid's centre sits, in its depths out from the skin (above 0: a round balloon with a fold
      // under it; below 0: a flatter swell)
      { name: "breast L", x: 0.056 * H, y: low + 0.718 * H, front: true, sx: 0.055 * H, sUp: 0.075 * H, sDown: 0.05 * H, litres: o.bust, sink: 0.1 },
      { name: "breast R", x: -0.056 * H, y: low + 0.718 * H, front: true, sx: 0.055 * H, sUp: 0.075 * H, sDown: 0.05 * H, litres: o.bust, sink: 0.1 },
      { name: "buttock L", x: 0.05 * H, y: low + 0.475 * H, front: false, sx: 0.075 * H, sUp: 0.085 * H, sDown: 0.06 * H, litres: o.butt, sink: -0.3 },
      { name: "buttock R", x: -0.05 * H, y: low + 0.475 * H, front: false, sx: 0.075 * H, sUp: 0.085 * H, sDown: 0.06 * H, litres: o.butt, sink: -0.3 },
    ];
    // a soft belly (the hourglass): low and wide, a flat swell
    if (o.belly > 0) spots.push({ name: "belly", x: 0, y: low + 0.55 * H, front: true, sx: 0.085 * H, sUp: 0.055 * H, sDown: 0.075 * H, litres: o.belly, sink: -0.45 });
    // regions: false leaves the volumes unlabelled (a fat suit finds its own regions from the thickness)
    const region = new Int8Array(N), regionInfo = [];
    if (o.regions !== false) { sim.region = region; sim.regionNames = ["", ...spots.map(s => s.name)]; sim.regionInfo = regionInfo; }
    const disp = new Float32Array(N * 3);
    // each volume is an ellipsoid partly sunk into the body, joined to it with a smooth fillet (a soft union): the
    // skin inside it moves out to its surface along rays from its centre, so the shape stays one round balloon with
    // a soft fold where it meets the body, and nothing overlaps
    const smax = (a, b, k) => { const t = Math.max(0, Math.min(1, 0.5 + 0.5 * (a - b) / k)); return b + (a - b) * t + k * t * (1 - t); };
    spots.forEach((sp, k) => {
      const c = surf(sp.x, sp.y, sp.front); if (c < 0 || !(sp.litres > 0)) return;
      const C0 = new THREE.Vector3(B[c * 3], B[c * 3 + 1], B[c * 3 + 2]), nc = nn(c);
      const out = nc.clone(); if (sp.front && sp.x) out.x += Math.sign(sp.x) * 0.12; out.normalize();          // breasts point a little apart
      const side = new THREE.Vector3(0, 1, 0).cross(out).normalize(), up = out.clone().cross(side).normalize();
      const shape = s => {                         // the displaced points for an ellipsoid scaled by s
        const rx = sp.sx * 0.95 * s, ryU = sp.sUp * 0.85 * s, ryD = sp.sDown * 1.1 * s, rz = sp.sx * 0.9 * s;
        const Cc = C0.clone().addScaledVector(out, rz * sp.sink).addScaledVector(up, -o.droop * 0.25 * ryD);
        const blend = 0.35 * rz, moved = new Map(); let vol = 0;
        const Co = C0.clone().addScaledVector(out, -rz);                    // rays start deep in the body: always outward
        const loc = (w, ry) => [w.dot(side) / rx, w.dot(up) / ry, w.dot(out) / rz];
        for (let i = 0; i < N; i++) {
          const v = new THREE.Vector3(B[i * 3], B[i * 3 + 1], B[i * 3 + 2]);
          // the reach: fading out at its edges (a hard cut stepped the skin where a fuller chest crossed it)
          const reach = Math.max(rx, ryU, rz) * 1.5 + blend, dc = v.distanceTo(Cc), back = v.clone().sub(C0).dot(out);
          if (dc > reach || back < -0.7 * rz) continue;
          const ss = u => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
          const fade = ss((reach - dc) / (0.15 * reach)) * ss((back + 0.7 * rz) / (0.3 * rz));
          const d = v.clone().sub(Co), r = d.length(); d.divideScalar(r || 1);
          const ry = v.clone().sub(Cc).dot(up) > 0 ? ryU : ryD;             // the upper half is longer and flatter
          const P = loc(Co.clone().sub(Cc), ry), D = loc(d, ry);
          const qa = D[0] ** 2 + D[1] ** 2 + D[2] ** 2, qb = 2 * (P[0] * D[0] + P[1] * D[1] + P[2] * D[2]), qc = P[0] ** 2 + P[1] ** 2 + P[2] ** 2 - 1;
          const disc = qb * qb - 4 * qa * qc; if (disc < 0) continue;
          const R = (-qb + Math.sqrt(disc)) / (2 * qa); if (R <= 0) continue;   // where the ray leaves the ellipsoid
          const nr = r + (smax(r, R, blend) - r) * fade; if (nr - r < 1e-4) continue;
          const nv = Co.clone().addScaledVector(d, nr);
          moved.set(i, nv); vol += area[i] * nv.clone().sub(v).dot(nn(i));
        }
        return { moved, vol };
      };
      // the size that holds the litres: the part of the ellipsoid outside the skin (a cap above a plane `sink` of its
      // depth below the centre; the body's curve and the fillet are left out)
      const capV = Math.PI * (1 + sp.sink) ** 2 * (2 - sp.sink) / 3, ry = (sp.sUp * 0.85 + sp.sDown * 1.1) / 2;
      let sz = Math.cbrt(sp.litres * 1000 / (sp.sx * 0.95 * ry * sp.sx * 0.9 * capV)), best = shape(sz);
      for (let it = 0; it < 4 && best.vol > 0; it++) { sz *= Math.cbrt(sp.litres * 1000 / best.vol); best = shape(sz); }   // then measured
      let apex = -1, ah = 0;
      for (const [i, nv] of best.moved) {
        const dh = Math.hypot(nv.x - B[i * 3], nv.y - B[i * 3 + 1], nv.z - B[i * 3 + 2]);
        // where two volumes reach the same skin (between the breasts) the larger push wins: the second one used to
        // overwrite the first and leave a V
        if (dh > Math.hypot(disp[i * 3], disp[i * 3 + 1], disp[i * 3 + 2])) { disp[i * 3] = nv.x - B[i * 3]; disp[i * 3 + 1] = nv.y - B[i * 3 + 1]; disp[i * 3 + 2] = nv.z - B[i * 3 + 2]; }
        if (dh > 0.2) region[i] = k + 1;
        if (dh > ah) { ah = dh; apex = i; }
      }
      regionInfo[k + 1] = { name: sp.name, apex: ah, litres: sp.litres, centre: c, volume: +(best.vol / 1000).toFixed(2) };
    });
    for (let i = 0; i < N * 3; i++) B[i] += disp[i];
    if (o.cinch) cinchWaist(sim, B, low, H, o.cinch);
  };
}
// a narrower waist: the trunk's skin pulled in toward its own centre around the waist (a smooth band), arms left out
function cinchWaist(sim, B, low, H, amount) {
  const G = sim.mesh.geometry, SI = G.attributes.skinIndex, SW = G.attributes.skinWeight, bones = sim.mesh.skeleton.bones;
  const trunk = new Set(["root", "c_spine0", "c_spine1", "c_spine2"]);
  const isTrunk = sim.rep.map(r => { let best = -1, bw = 0; for (let k = 0; k < 4; k++) if (SW.getComponent(r, k) > bw) { bw = SW.getComponent(r, k); best = SI.getComponent(r, k); } return trunk.has(bones[best]?.name); });
  const yc = low + 0.615 * H, half = 0.06 * H;                       // the natural waist, above the navel
  let cx = 0, cz = 0, n = 0;
  for (let i = 0; i < sim.N; i++) if (isTrunk[i] && Math.abs(B[i * 3 + 1] - yc) < 0.02 * H) { cx += B[i * 3]; cz += B[i * 3 + 2]; n++; }
  if (!n) return; cx /= n; cz /= n;
  for (let i = 0; i < sim.N; i++) {
    if (!isTrunk[i]) continue;
    const u = 1 - Math.abs(B[i * 3 + 1] - yc) / half; if (u <= 0) continue;
    const f = amount * u * u * (3 - 2 * u);
    B[i * 3] = cx + (B[i * 3] - cx) * (1 - f); B[i * 3 + 2] = cz + (B[i * 3 + 2] - cz) * (1 - f * 0.6);   // sides more than front and back
  }
}

// ---- the simulation -----------------------------------------------------------------------------------------
// shear 2000 Pa: a 10 cm belly rings at about 2.4 Hz and slides 4 cm when lying down; 4 cm of fat at 6 Hz
export const FLESH_DEFAULTS = { density: 900, shear: 2000, damping: 0.15, coupling: 1.0, skin: 0.45, holdRamp: 0.028, maxStretch: 0.8, maxSquash: 0.6, gravity: 9.81, substeps: 4 };

export class FleshSim {
  constructor(figure, outer, lean, opts = {}) {
    this.f = figure; this.o = Object.assign({}, FLESH_DEFAULTS, opts);
    const mesh = this.mesh = shapeMesh(figure.model);
    const G = mesh.geometry, P = G.attributes.position, MP = G.morphAttributes.position, D = mesh.morphTargetDictionary;
    const n = P.count;
    // weld the triangle soup: one simulated point per position
    const key = i => `${Math.round(P.getX(i) * 100)},${Math.round(P.getY(i) * 100)},${Math.round(P.getZ(i) * 100)}`;
    const ids = new Map(), rep = [], wid = new Int32Array(n);
    for (let i = 0; i < n; i++) { const k = key(i); if (!ids.has(k)) { ids.set(k, rep.length); rep.push(i); } wid[i] = ids.get(k); }
    this.rep = rep; this.wid = wid; const N = this.N = rep.length;
    const bindOf = w => { const out = new Float32Array(N * 3); rep.forEach((i, v) => { for (let a = 0; a < 3; a++) { let p = P.array[i * 3 + a]; for (let c = 0; c < SHAPES; c++) if (w[c]) p += MP[D["shape_c_" + c]].array[i * 3 + a] * w[c]; out[v * 3 + a] = p; } }); return out; };
    this.outerBind = bindOf(outer); this.leanBind = bindOf(lean);
    // the render meshes: indexed on the welded points (smooth normals)
    const index = []; for (let i = 0; i < n; i += 3) index.push(wid[i], wid[i + 1], wid[i + 2]);
    this.index = index;
    // neighbours, area, normals (bind, mesh units)
    const nb = Array.from({ length: N }, () => new Set()), area = new Float32Array(N), nrm = new Float32Array(N * 3);
    const v3 = (arr, i) => new THREE.Vector3(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);
    for (let t = 0; t < index.length; t += 3) {
      const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
      nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b);
      const pa = v3(this.outerBind, a), pb = v3(this.outerBind, b), pc = v3(this.outerBind, c);
      const cr = new THREE.Vector3().crossVectors(pb.clone().sub(pa), pc.clone().sub(pa)), ar = cr.length() / 2;
      for (const v of [a, b, c]) { area[v] += ar / 3; nrm[v * 3] += cr.x; nrm[v * 3 + 1] += cr.y; nrm[v * 3 + 2] += cr.z; }
    }
    this.nb = nb.map(s => Int32Array.from(s));
    this.area = area;
    this.preSculpt = Float32Array.from(this.outerBind);         // the body before any sculpted volume
    if (opts.sculpt) opts.sculpt(this, area, nrm);    // volumes added on top (water balloons): thickness follows
    // units: mesh units -> metres (the figure's scale)
    mesh.updateMatrixWorld(true);
    const sc = this.sc = mesh.matrixWorld.getMaxScaleOnAxis();     // the figure stands unscaled in the world
    // thickness: how far the fat suit stands off the lean body, along the skin's normal (never negative)
    this.h = new Float32Array(N); this.m = new Float32Array(N); this.k = new Float32Array(N);
    const o = this.o;
    for (let v = 0; v < N; v++) {
      const nn = v3(nrm, v).normalize(), pre = v3(this.preSculpt, v), dp = pre.clone().sub(v3(this.leanBind, v));
      const hpre = Math.max(0, dp.dot(nn));
      // the lean body as the suit (before any sculpted volume) pressed in by its thickness: always inside (where the
      // lean shape stood outside the suit, at bony points like the collarbones, the thickness is zero and the two
      // coincide). Sculpted volumes sit on top of it, so the lean body stays the body under them
      for (let a = 0; a < 3; a++) this.leanBind[v * 3 + a] = this.preSculpt[v * 3 + a] - [nn.x, nn.y, nn.z][a] * Math.max(hpre, 0.4 / (sc * 100));   // at least 4 mm under
      const hm = this.thick(v, nn), h = hm * sc;                    // mesh units, metres
      const A = Math.max(1e-6, area[v] * sc * sc);
      this.h[v] = h;
      const hh = Math.max(h, 0.003);                                // skin over bone: a thin, stiff layer
      this.m[v] = o.density * A * hh;
      this.k[v] = o.shear * A / hh;
    }
    // the refiner (the page's brush): painted volume (mesh units, along the skin's normal) and jiggle (a multiplier
    // per point) on top of the body as built
    this.nrm0 = new Float32Array(N * 3); for (let v = 0; v < N; v++) { const nn = v3(nrm, v).normalize(); this.nrm0.set([nn.x, nn.y, nn.z], v * 3); }
    this.areaM = area; this.outerBase = Float32Array.from(this.outerBind);
    this.vol = new Float32Array(N); this.jig = new Float32Array(N).fill(1);
    if (this.region) {                             // balloons swing as a whole: one damped mass each (the bulk mode)
      const nR = this.regionNames.length;
      this.bulk = Array.from({ length: nR }, () => ({ hApex: 0, mass: 0, U: new THREE.Vector3(), V: new THREE.Vector3(), T: new THREE.Vector3(), Tp: new THREE.Vector3(), w: 0 }));
      for (let v = 0; v < N; v++) { const r = this.region[v]; if (!r) continue; const B = this.bulk[r]; B.hApex = Math.max(B.hApex, this.h[v]); B.mass += this.m[v]; }
      this.wB = new Float32Array(N);
      for (let v = 0; v < N; v++) { const r = this.region[v]; if (r) this.wB[v] = this.h[v] / Math.max(1e-6, this.bulk[r].hApex); }
      for (const B of this.bulk) B.k = 1;                                  // stiffness multiplier (support)
    }
    this.x = new Float32Array(N * 3); this.vel = new Float32Array(N * 3);
    this.R = new Float32Array(N * 3); this.Rprev = new Float32Array(N * 3); this.A = new Float32Array(N * 3); this.Gd = new Float32Array(N * 3);
    this.first = true;
  }
  thick(v, n) {                                  // tissue over the lean body at a point, along the normal (mesh units)
    const B = this.outerBind, L = this.leanBind;
    return Math.max(0, (B[v * 3] - L[v * 3]) * n.x + (B[v * 3 + 1] - L[v * 3 + 1]) * n.y + (B[v * 3 + 2] - L[v * 3 + 2]) * n.z);
  }
  refine() {                                     // after painting volume: the shape, the thickness and the physics follow
    const N = this.N, o = this.o, sc = this.sc, B = this.outerBind, L = this.leanBind, n = this.nrm0;
    for (let v = 0; v < N; v++) {
      for (let a = 0; a < 3; a++) B[v * 3 + a] = this.outerBase[v * 3 + a] + n[v * 3 + a] * this.vol[v];
      const hm = this.thick(v, { x: n[v * 3], y: n[v * 3 + 1], z: n[v * 3 + 2] });
      const h = this.h[v] = hm * sc, A = Math.max(1e-6, this.areaM[v] * sc * sc), hh = Math.max(h, 0.003);
      this.m[v] = o.density * A * hh; this.k[v] = o.shear * A / hh;
    }
    this.first = true;
  }
  skin(out, bind, gOut) {                         // CPU skinning of bind points (mesh units) -> world (metres)
    const mesh = this.mesh, v = new THREE.Vector3(), w = new THREE.Vector3(), g = new THREE.Vector3();
    for (let i = 0; i < this.N; i++) {
      const r = this.rep[i];
      v.set(bind[i * 3], bind[i * 3 + 1], bind[i * 3 + 2]);
      if (gOut) w.copy(v).add(g.set(0, -1, 0));                       // a point "below" in the standing bind pose
      mesh.applyBoneTransform(r, v).applyMatrix4(mesh.matrixWorld);
      out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
      if (gOut) { mesh.applyBoneTransform(r, w).applyMatrix4(mesh.matrixWorld); w.sub(v).normalize(); gOut[i * 3] = w.x; gOut[i * 3 + 1] = w.y; gOut[i * 3 + 2] = w.z; }
    }
  }
  step(dt) {
    const N = this.N, o = this.o;
    this.mesh.updateMatrixWorld(true);
    this.Rprev.set(this.R);
    this.skin(this.R, this.outerBind, this.Gd);
    this.skin(this.A, this.leanBind, null);
    if (this.first) { this.x.set(this.R); this.Rprev.set(this.R); this.vel.fill(0); this.first = false; return; }
    const sub = o.substeps, h = dt / sub, x = this.x, vel = this.vel, R = this.R, Rp = this.Rprev;
    const u = new Float32Array(N * 3), tgt = new Float32Array(N * 3);
    for (let s = 1; s <= sub; s++) {
      const a = s / sub;
      for (let i = 0; i < N * 3; i++) { tgt[i] = Rp[i] + (R[i] - Rp[i]) * a; u[i] = x[i] - tgt[i]; }
      if (this.bulk) this.stepBulk(tgt, h, dt);
      for (let i = 0; i < N; i++) {
        const m = this.m[i], k = this.k[i];
        if (this.h[i] < 0.002) { for (let c = 0; c < 3; c++) { x[i * 3 + c] = tgt[i * 3 + c]; vel[i * 3 + c] = 0; } continue; }   // skin on bone: no jiggle
        if (this.bulk && this.region[i]) {          // a balloon point: carried by its balloon's swing, most at the tip
          const U = this.bulk[this.region[i]].U, w = this.wB[i];
          x[i * 3] = tgt[i * 3] + U.x * w; x[i * 3 + 1] = tgt[i * 3 + 1] + U.y * w; x[i * 3 + 2] = tgt[i * 3 + 2] + U.z * w;
          continue;
        }
        const om = Math.min(400, Math.sqrt(k / m)), damp = 2 * o.damping * om;
        // neighbours: the layer is continuous (a Laplacian of the offsets)
        let lx = 0, ly = 0, lz = 0; const nb = this.nb[i];
        for (let j = 0; j < nb.length; j++) { const q = nb[j] * 3; lx += u[q] - u[i * 3]; ly += u[q + 1] - u[i * 3 + 1]; lz += u[q + 2] - u[i * 3 + 2]; }
        const cpl = o.coupling * om * om / Math.max(1, nb.length);
        // gravity: only what's changed since the standing pose the shape was made in
        const gx = 0 - this.Gd[i * 3], gy = -1 - this.Gd[i * 3 + 1], gz = 0 - this.Gd[i * 3 + 2];
        for (let c = 0; c < 3; c++) {
          // damping acts on the motion relative to the body (moving steadily must not drag the flesh back)
          const tv = (R[i * 3 + c] - Rp[i * 3 + c]) / dt;
          const acc = -om * om * u[i * 3 + c] - damp * (vel[i * 3 + c] - tv) + cpl * [lx, ly, lz][c] + o.gravity * [gx, gy, gz][c];
          vel[i * 3 + c] += acc * h;
        }
      }
      for (let i = 0; i < N; i++) if (!(this.bulk && this.region[i])) for (let c = 0; c < 3; c++) x[i * 3 + c] += vel[i * 3 + c] * h;
      // the skin: offsets are smoothed toward their neighbours' (surface tension), so the layer moves as one sheet
      // and doesn't fold where thick fat meets thin
      if (o.skin > 0) {
        for (let i = 0; i < N * 3; i++) u[i] = x[i] - tgt[i];
        for (let i = 0; i < N; i++) {
          const nb = this.nb[i]; if (!nb.length) continue;
          let ax = 0, ay = 0, az = 0; for (let j = 0; j < nb.length; j++) { const q = nb[j] * 3; ax += u[q]; ay += u[q + 1]; az += u[q + 2]; }
          const k = o.skin / sub * 4, inv = 1 / nb.length;
          x[i * 3] += (ax * inv - u[i * 3]) * k; x[i * 3 + 1] += (ay * inv - u[i * 3 + 1]) * k; x[i * 3 + 2] += (az * inv - u[i * 3 + 2]) * k;
        }
      }
      // support: the lean body inside. Fat compresses at most so far toward it, and stretches only so far from where
      // the suit puts it
      for (let i = 0; i < N; i++) {
        const hh = this.h[i]; if (hh < 0.002) continue;
        const fr = Math.min(1, Math.max(0, (hh - 0.002) / o.holdRamp)), free = fr * fr * (3 - 2 * fr);   // thin fat is held to the bone, softly
        if (free < 1) for (let c = 0; c < 3; c++) x[i * 3 + c] = tgt[i * 3 + c] + (x[i * 3 + c] - tgt[i * 3 + c]) * free;
        const ox = x[i * 3] - tgt[i * 3], oy = x[i * 3 + 1] - tgt[i * 3 + 1], oz = x[i * 3 + 2] - tgt[i * 3 + 2];
        let nx = tgt[i * 3] - this.A[i * 3], ny = tgt[i * 3 + 1] - this.A[i * 3 + 1], nz = tgt[i * 3 + 2] - this.A[i * 3 + 2];
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        const inward = -(ox * nx + oy * ny + oz * nz);
        if (inward > o.maxSquash * hh) {                             // pushed into the muscle: stop there
          const fix = inward - o.maxSquash * hh;
          x[i * 3] += nx * fix; x[i * 3 + 1] += ny * fix; x[i * 3 + 2] += nz * fix;
          const vn = vel[i * 3] * nx + vel[i * 3 + 1] * ny + vel[i * 3 + 2] * nz; if (vn < 0) { vel[i * 3] -= vn * nx; vel[i * 3 + 1] -= vn * ny; vel[i * 3 + 2] -= vn * nz; }
        }
        const len = Math.hypot(x[i * 3] - tgt[i * 3], x[i * 3 + 1] - tgt[i * 3 + 1], x[i * 3 + 2] - tgt[i * 3 + 2]), lim = o.maxStretch * hh + 0.004;
        if (len > lim) { const s2 = lim / len; for (let c = 0; c < 3; c++) x[i * 3 + c] = tgt[i * 3 + c] + (x[i * 3 + c] - tgt[i * 3 + c]) * s2; }
      }
      if (this.region) this.fluid(tgt);
    }
  }
  stepBulk(tgt, h, dt) {                         // each balloon's mass on its spring, in world space, gravity as for fat
    const o = this.o;
    for (let r = 1; r < this.bulk.length; r++) {
      const B = this.bulk[r]; if (!B.mass) continue;
      const T = new THREE.Vector3(), G = new THREE.Vector3(); let W = 0;
      for (let i = 0; i < this.N; i++) if (this.region[i] === r) { const w = this.wB[i] * this.m[i]; W += w; T.x += tgt[i * 3] * w; T.y += tgt[i * 3 + 1] * w; T.z += tgt[i * 3 + 2] * w; G.x += this.Gd[i * 3] * w; G.y += this.Gd[i * 3 + 1] * w; G.z += this.Gd[i * 3 + 2] * w; }
      T.divideScalar(W); G.divideScalar(W);
      if (!B.init) { B.Tp.copy(T); B.init = true; }
      const Tv = T.clone().sub(B.Tp).divideScalar(h); B.Tp.copy(T);
      const om = Math.sqrt(o.shear * B.k / o.density) / Math.max(0.01, B.hApex), damp = 2 * o.damping * om;
      // U is the offset from where the body carries it; its velocity relative to the body is V - Tv
      const P = T.clone().add(B.U);
      const acc = B.U.clone().multiplyScalar(-om * om).addScaledVector(B.V.clone().sub(Tv), -damp)
        .add(new THREE.Vector3(-G.x, -1 - G.y, -G.z).multiplyScalar(o.gravity));
      B.V.addScaledVector(acc, h);
      P.addScaledVector(B.V, h);
      B.U.copy(P.sub(T));
      const lim = o.maxStretch * B.hApex; if (B.U.length() > lim) B.U.setLength(lim);
    }
  }
  fluid(tgt) {                                   // water balloons: each keeps its volume; pairs stay apart at the midline
    const x = this.x, Ar = this.A, nR = this.regionNames.length;
    const V = new Float64Array(nR), V0 = new Float64Array(nR), W = new Float64Array(nR);
    const dir = new Float32Array(this.N * 3);
    for (let i = 0; i < this.N; i++) {
      const r = this.region[i]; if (!r) continue;
      let nx = tgt[i * 3] - Ar[i * 3], ny = tgt[i * 3 + 1] - Ar[i * 3 + 1], nz = tgt[i * 3 + 2] - Ar[i * 3 + 2];
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; dir[i * 3] = nx; dir[i * 3 + 1] = ny; dir[i * 3 + 2] = nz;
      const a = this.area[i];
      V0[r] += a * this.h[i];
      V[r] += a * ((x[i * 3] - Ar[i * 3]) * nx + (x[i * 3 + 1] - Ar[i * 3 + 1]) * ny + (x[i * 3 + 2] - Ar[i * 3 + 2]) * nz);
      W[r] += a * this.h[i];
    }
    for (let i = 0; i < this.N; i++) {             // the missing (or extra) volume, pushed out where the fluid is deepest
      const r = this.region[i]; if (!r || !W[r]) continue;
      const d = (V0[r] - V[r]) / W[r] * this.h[i];
      x[i * 3] += dir[i * 3] * d; x[i * 3 + 1] += dir[i * 3 + 1] * d; x[i * 3 + 2] += dir[i * 3 + 2] * d;
    }
    // the midline: breasts at the breastbone, buttocks at the cleft
    const all = this.f.all, Wp = n => all[n].getWorldPosition(new THREE.Vector3());
    const planes = { 1: [Wp("c_spine3"), Wp("l_clavicle").sub(Wp("r_clavicle")).normalize(), 1], 2: [Wp("c_spine3"), Wp("l_clavicle").sub(Wp("r_clavicle")).normalize(), -1],
                     3: [Wp("root"), Wp("l_upleg").sub(Wp("r_upleg")).normalize(), 1], 4: [Wp("root"), Wp("l_upleg").sub(Wp("r_upleg")).normalize(), -1] };
    for (let i = 0; i < this.N; i++) {
      const r = this.region[i]; if (!r || !planes[r]) continue;
      const [P, L, sgn] = planes[r];
      const sx = ((x[i * 3] - P.x) * L.x + (x[i * 3 + 1] - P.y) * L.y + (x[i * 3 + 2] - P.z) * L.z) * sgn;
      const st = ((tgt[i * 3] - P.x) * L.x + (tgt[i * 3 + 1] - P.y) * L.y + (tgt[i * 3 + 2] - P.z) * L.z) * sgn;
      const lim = Math.min(0.003, st);
      if (sx < lim) { const d = (lim - sx) * sgn; x[i * 3] += L.x * d; x[i * 3 + 1] += L.y * d; x[i * 3 + 2] += L.z * d; }
    }
  }
  apex(r) {                                      // a balloon's tip (its deepest point) and how far it has moved
    let best = -1, bh = 0; for (let i = 0; i < this.N; i++) if (this.region[i] === r && this.h[i] > bh) { bh = this.h[i]; best = i; }
    return best;
  }
  thicknessMap() {                               // for Unreal: per point, its rest position (cm, bind) and fat (cm)
    const pts = [];
    for (let i = 0; i < this.N; i++) pts.push([+this.outerBind[i * 3].toFixed(2), +this.outerBind[i * 3 + 1].toFixed(2), +this.outerBind[i * 3 + 2].toFixed(2), +(this.h[i] * 100).toFixed(2)]);
    return { units: "cm, MHR bind space (Y up)", shear_pa: this.o.shear, density: this.o.density, damping: this.o.damping, points: pts };
  }
  offset(i) { return Math.hypot(this.x[i * 3] - this.R[i * 3], this.x[i * 3 + 1] - this.R[i * 3 + 1], this.x[i * 3 + 2] - this.R[i * 3 + 2]); }
  // the frequency each point would ring at, and its sag if gravity turned 90 degrees (for the report)
  freq(i) { return Math.sqrt(this.k[i] / this.m[i]) / (2 * Math.PI); }
  sag90(i) { return this.o.gravity * this.m[i] / this.k[i]; }
}

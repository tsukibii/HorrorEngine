// Animator v2: a character's body, measured. What the animation is made from (docs/ANIMATOR_V2.md §3): the lengths of
// the limbs, how wide and deep the trunk is at every height, the bust, the belly and the seat, how thick the thighs
// and the arms are, and from all of it a weight. Read from the character's own unclothed body when the file carries
// its recipe (every Studio export does: extras.studio's body.bin, MHR's points), else from the meshes it has.
import { V, clamp } from "./m.js";
import { SIDES, SGN, skinned, partKind } from "./rig.js";

const SEG = { trunk: 0, head: 1, armU_l: 2, armL_l: 3, hand_l: 4, legU_l: 5, legL_l: 6, foot_l: 7, armU_r: 8, armL_r: 9, hand_r: 10, legU_r: 11, legL_r: 12, foot_r: 13 }, NSEG = 14;
export { SEG };

/** each joint's segment (the part of the body its skin belongs to) */
export function jointSegments(rig) {
  const out = new Int8Array(rig.J.length).fill(-1);
  for (const i of rig.order) {
    const b = rig.J[i], m = /^([lr])_(.*)$/.exec(b.name), s = m ? m[1] : "", n = m ? m[2] : b.name; let seg = -1;
    if (s) {
      if (/^(wrist$|thumb|index|middle|ring|pinky)/.test(n)) seg = SEG["hand_" + s];
      else if (/^(lowarm|wrist_twist)/.test(n)) seg = SEG["armL_" + s];
      else if (/^uparm/.test(n)) seg = SEG["armU_" + s];
      else if (/^upleg/.test(n)) seg = SEG["legU_" + s];
      else if (/^lowleg/.test(n)) seg = SEG["legL_" + s];
      else if (/^(foot|talocrural|subtalar|transversetarsal|ball)/.test(n)) seg = SEG["foot_" + s];
      else if (/^eye/.test(n)) seg = SEG.head;
      else if (/^clavicle/.test(n)) seg = SEG.trunk;
    } else if (/^c_(head|jaw|teeth|tongue)/.test(b.name) || /^jiggle_/.test(b.name)) seg = SEG.head;
    else if (/^(root|body_world|c_spine|c_neck)/.test(b.name)) seg = SEG.trunk;
    out[i] = seg >= 0 ? seg : (b.parent >= 0 ? out[b.parent] : SEG.trunk);
  }
  return out;
}

// MHR's rig file (Content/Studio/Bodies/MHR_lod1_rig.bin): each of MHR's points' four bones and weights, by name
export function readMhrRig(buf) {
  const dv = new DataView(buf), hl = dv.getUint32(0, true), H = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), N = H.points;
  const BI = new Uint8Array(buf, H.bi_at, N * 4), Q16 = new Uint16Array(buf.slice(H.bw_at, H.bw_at + N * 8)), BW = new Float32Array(N * 4);
  for (let i = 0; i < N * 4; i++) BW[i] = Q16[i] / 65535;
  return { N, names: H.bones.map(b => b.name), BI, BW };
}

/** the character's own unclothed body from the file's recipe, as points with the rig's bones: null when the file has
    no recipe (not a Studio export) or MHR's rig file wasn't given */
export function recipeBody(glb, rig, mhrRig) {
  const st = ((glb.json.scenes || [])[glb.json.scene || 0] || {}).extras?.studio, b64 = st?.files?.["body.bin"];
  if (!b64 || !mhrRig) return null;
  const bytes = typeof Buffer !== "undefined" ? Buffer.from(b64, "base64") : Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  if (bytes.byteLength !== mhrRig.N * 12) return null;
  const P = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)), map = mhrRig.names.map(n => rig.ix.has(n) ? rig.ix.get(n) : rig.pelvis);
  const JI = new Uint16Array(mhrRig.N * 4); for (let i = 0; i < JI.length; i++) JI[i] = map[mhrRig.BI[i]];
  return { P, JI, JW: mhrRig.BW, from: "recipe" };
}
/** the character's settings from the file's recipe (character.json), or null */
export function recipeCharacter(glb) {
  const st = ((glb.json.scenes || [])[glb.json.scene || 0] || {}).extras?.studio, b64 = st?.files?.["character.json"];
  if (!b64) return null;
  try { return JSON.parse(typeof Buffer !== "undefined" ? Buffer.from(b64, "base64").toString("utf8") : new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)))); } catch (e) { return null; }
}

/** the points of the file's own meshes with the rig's bones: kinds ["skin"], ["skin", "cover"] ... (rig.js partKind) */
export function meshPoints(glb, rig, kinds = ["skin", "cover"]) {
  const parts = skinned(glb).filter(p => kinds.includes(partKind(p.name))), Ps = [], Is = [], Ws = []; let n = 0;
  for (const p of parts) {
    const joints = glb.json.skins[p.skin].joints, map = joints.map(nd => { const k = rig.J.findIndex(b => b.node === nd); return k < 0 ? rig.pelvis : k; });
    for (const pr of p.prims) {
      const P = glb.read(pr.attributes.POSITION), I = glb.read(pr.attributes.JOINTS_0), W = glb.read(pr.attributes.WEIGHTS_0, { float: true }), I2 = new Uint16Array(I.length);
      for (let i = 0; i < I.length; i++) I2[i] = map[I[i]];
      Ps.push(P); Is.push(I2); Ws.push(W); n += P.length / 3;
    }
  }
  const P = new Float32Array(n * 3), JI = new Uint16Array(n * 4), JW = new Float32Array(n * 4); let o = 0;
  Ps.forEach((p, k) => { P.set(p, o * 3); JI.set(Is[k], o * 4); JW.set(Ws[k], o * 4); o += p.length / 3; });
  return { P, JI, JW, from: "meshes" };
}

const pct = (arr, f) => { if (!arr.length) return 0; const s = Float64Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.max(0, Math.round(f * (s.length - 1))))]; };
const girthOf = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));   // an ellipse's way round (Ramanujan)

/** the body's measures from points with bones ({ P, JI, JW }: recipeBody or meshPoints) */
export function measure(rig, pts) {
  const { P, JI, JW } = pts, n = P.length / 3, segJ = jointSegments(rig), seg = new Int8Array(n), acc = new Float32Array(NSEG);
  let top = -1e9, floor = 1e9;
  for (let i = 0; i < n; i++) {
    acc.fill(0); for (let k = 0; k < 4; k++) { const w = JW[i * 4 + k]; if (w > 0) acc[segJ[JI[i * 4 + k]]] += w; }
    let b = 0; for (let s = 1; s < NSEG; s++) if (acc[s] > acc[b]) b = s; seg[i] = b;
    const y = P[i * 3 + 1]; if (y > top) top = y; if (y < floor) floor = y;
  }
  const H = top - floor, at = i => rig.J[i].at, B = { from: pts.from, height: H, floor };
  // ---- the limbs' lengths -----------------------------------------------------------------------------------------
  const LL = rig.legL, LR = rig.legR, AL = rig.armL, AR = rig.armR, avg = (a, b) => (a + b) / 2;
  B.thigh = avg(LL.thigh, LR.thigh); B.shank = avg(LL.shank, LR.shank); B.ankleH = avg(at(LL.foot)[1], at(LR.foot)[1]) - floor;
  B.leg = B.thigh + B.shank + B.ankleH;                                   // the hip joint's height standing with the legs straight
  B.hipHalf = avg(Math.abs(at(LL.up)[0]), Math.abs(at(LR.up)[0])); B.hipY = avg(at(LL.up)[1], at(LR.up)[1]) - floor;
  B.upper = avg(AL.upper, AR.upper); B.fore = avg(AL.fore, AR.fore); B.hand = avg(AL.handLen, AR.handLen);
  B.shoulderHalf = avg(Math.abs(at(AL.up)[0]), Math.abs(at(AR.up)[0])); B.shoulderY = avg(at(AL.up)[1], at(AR.up)[1]) - floor;
  // the foot, in its own frame (z along it from the ankle, x across, the rest's toe-out taken off): where its heel,
  // its ball and its toes are from the ankle joint
  {
    const c = Math.cos(-LL.yaw0), s = Math.sin(-LL.yaw0), a = at(LL.foot); let zmin = 0, zmax = 0, xmin = 0, xmax = 0;
    for (let i = 0; i < n; i++) if (seg[i] === SEG.foot_l) { const x = P[i * 3] - a[0], z = P[i * 3 + 2] - a[2], fx = c * x + s * z, fz = -s * x + c * z; zmin = Math.min(zmin, fz); zmax = Math.max(zmax, fz); xmin = Math.min(xmin, fx); xmax = Math.max(xmax, fx); }
    const bl = V.sub(at(LL.ball), a);
    B.foot = { heelBack: -zmin, toeAhead: zmax, ballAhead: -s * bl[0] + c * bl[2], ballH: at(LL.ball)[1] - floor, half: (xmax - xmin) / 2, mid: (xmax + xmin) / 2, yaw0: LL.yaw0 };
    if (!(B.foot.toeAhead > 0.05)) B.foot = { heelBack: 0.05 * H / 1.65, toeAhead: 0.19 * H / 1.65, ballAhead: 0.125 * H / 1.65, ballH: 0.02, half: 0.045, mid: 0, yaw0: LL.yaw0 };
  }
  // ---- the trunk, slab by slab ------------------------------------------------------------------------------------
  let crotch = 1e9; const midX = 0.012 * H / 1.65;
  for (let i = 0; i < n; i++) if (seg[i] === SEG.trunk && Math.abs(P[i * 3]) < midX && P[i * 3 + 1] < crotch) crotch = P[i * 3 + 1];
  if (!(crotch < 1e8)) crotch = floor + B.hipY - 0.08 * H;
  B.crotchY = crotch - floor;
  const dy = 0.015, y0 = crotch, y1 = floor + B.shoulderY + 0.045 * H / 1.65, ns = Math.max(4, Math.ceil((y1 - y0) / dy)), bins = Array.from({ length: ns }, () => ({ x: [], z: [], zMid: [], zLat: [], w: new Float32Array(rig.J.length) }));
  const trunkLike = s => s === SEG.trunk || s === SEG.legU_l || s === SEG.legU_r, yDelt = floor + B.shoulderY - 0.07 * H, xDelt = 0.93 * B.shoulderHalf;
  for (let i = 0; i < n; i++) {
    if (!trunkLike(seg[i])) continue; const y = P[i * 3 + 1], k = Math.floor((y - y0) / dy); if (k < 0 || k >= ns) continue;
    if (y > yDelt && Math.abs(P[i * 3]) > xDelt) continue;               // (the shoulder's cap is the arm's, not the chest's width)
    const b = bins[k]; b.x.push(P[i * 3]); b.z.push(P[i * 3 + 2]);
    for (let q = 0; q < 4; q++) { const w = JW[i * 4 + q]; if (w > 0 && segJ[JI[i * 4 + q]] === SEG.trunk) b.w[JI[i * 4 + q]] += w; }
  }
  const slabs = [];
  for (let k = 0; k < ns; k++) {
    const b = bins[k]; if (b.x.length < 6) continue;
    const xlo = pct(b.x, 0.01), xhi = pct(b.x, 0.99), zb = pct(b.z, 0.01), zf = pct(b.z, 0.99), a = (xhi - xlo) / 2;
    let jt = rig.pelvis, best = 0; for (let q = 0; q < b.w.length; q++) if (b.w[q] > best) { best = b.w[q]; jt = q; }
    slabs.push({ y: y0 + (k + 0.5) * dy - floor, a, cx: (xhi + xlo) / 2, zf, zb, b: (zf - zb) / 2, cz: (zf + zb) / 2, joint: jt });
  }
  // (the front at the sides of the chest and at its middle: a bust stands out at the sides, a breastbone between)
  for (const s of slabs) { let lat = -1e9, mid = -1e9; const k = Math.floor((s.y + floor - y0) / dy);
    for (let i = 0; i < n; i++) { if (!trunkLike(seg[i])) continue; const y = P[i * 3 + 1]; if (Math.floor((y - y0) / dy) !== k) continue; const ax = Math.abs(P[i * 3] - s.cx) / s.a, z = P[i * 3 + 2]; if (ax < 0.15) mid = Math.max(mid, z); else if (ax > 0.3 && ax < 0.8) lat = Math.max(lat, z); }
    s.zLat = lat > -1e8 ? lat : s.zf; s.zMid = mid > -1e8 ? mid : s.zf; }
  B.slabs = slabs;
  const within = (lo, hi) => slabs.filter(s => s.y >= lo && s.y <= hi), argmax = (list, f) => list.reduce((a, s) => (a == null || f(s) > f(a) ? s : a), null);
  // the levels, each looked for where a body has it (shares of the height; a heavy body's narrowest and widest places
  // are not where a thin one's are, so no level is found from another's)
  const hips = argmax(within(B.crotchY, B.crotchY + 0.13 * H), s => s.a) || slabs[0];
  const bust = argmax(within(0.685 * H, Math.min(0.79 * H, B.shoulderY - 0.02 * H)), s => s.zLat) || slabs[slabs.length - 1];
  const under = argmax(within(bust.y - 0.09 * H, bust.y - 0.03 * H), s => -s.zf) || bust;
  const waist = argmax(within(0.585 * H, under.y - 0.005), s => -s.a) || under;
  const belly = argmax(within(B.crotchY + 0.04 * H, waist.y + 0.02 * H), s => s.zf) || waist;
  const seat = argmax(within(B.crotchY, hips.y + 0.07 * H), s => -s.zb) || hips;
  B.levels = { hips: hips.y, waist: waist.y, bust: bust.y, under: under.y, belly: belly.y, seat: seat.y };
  B.half = { hips: hips.a, waist: waist.a, bust: bust.a, under: under.a };
  B.girth = { hips: girthOf(hips.a, hips.b), waist: girthOf(waist.a, waist.b), bust: girthOf(bust.a, bust.b), under: girthOf(under.a, under.b) };
  B.bustOut = Math.max(0, bust.zLat - under.zf);                           // how far the bust stands in front of the ribs under it
  B.bellyOut = Math.max(0, belly.zf - under.zf);                           // how far the belly stands in front of them
  B.seatOut = Math.max(0, waist.zb - seat.zb);                             // how far the seat stands behind the waist's back
  B.hipFlare = Math.max(0, hips.a - waist.a);
  // the places soft tissue hangs from (rest, world): each bust's apex, the belly's, each buttock's, each inner thigh's
  const apex = (test, score) => { let best = -1e9, at = null; for (let i = 0; i < n; i++) { if (!trunkLike(seg[i])) continue; const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]; if (!test(p)) continue; const v = score(p); if (v > best) { best = v; at = p; } } return at; };
  const Y = y => y + floor;
  B.apex = {};
  for (const s of SIDES) {
    const g = SGN[s];
    B.apex["bust_" + s] = apex(p => Math.abs(p[1] - Y(bust.y)) < 0.03 * H / 1.65 + dy && g * p[0] > 0.25 * bust.a && g * p[0] < 0.8 * bust.a, p => p[2]) || [g * 0.5 * bust.a, Y(bust.y), bust.zf];
    B.apex["seat_" + s] = apex(p => Math.abs(p[1] - Y(seat.y)) < 0.03 * H / 1.65 + dy && g * p[0] > 0.2 * hips.a && g * p[0] < 0.8 * hips.a, p => -p[2]) || [g * 0.5 * hips.a, Y(seat.y), seat.zb];
    B.apex["hip_" + s] = apex(p => Math.abs(p[1] - Y(hips.y)) < 0.02 * H / 1.65 + dy && Math.abs(p[2] - hips.cz) < 0.5 * hips.b, p => g * p[0]) || [g * hips.a, Y(hips.y), hips.cz];
  }
  B.apex.belly = apex(p => Math.abs(p[1] - Y(belly.y)) < 0.03 * H / 1.65 + dy && Math.abs(p[0]) < 0.3 * belly.a, p => p[2]) || [0, Y(belly.y), belly.zf];
  // ---- the limbs' thickness ---------------------------------------------------------------------------------------
  const limb = (segId, A, Bp, g, nb = 8) => {
    const ax = V.sub(Bp, A), L = V.len(ax), d = V.mul(ax, 1 / L), f = V.norm(V.perp([0, 0, 1], d)), o = V.mul(V.cross(f, d), g), out = Array.from({ length: nb }, () => ({ med: [], lat: [], front: [], back: [], r: [] }));
    for (let i = 0; i < n; i++) { if (seg[i] !== segId) continue; const v = [P[i * 3] - A[0], P[i * 3 + 1] - A[1], P[i * 3 + 2] - A[2]], t = V.dot(v, d) / L, k = Math.floor(t * nb); if (k < 0 || k >= nb) continue;
      const r = V.mad(v, d, -t * L), ro = V.dot(r, o), rf = V.dot(r, f), b = out[k]; b.r.push(Math.hypot(ro, rf)); (ro >= 0 ? b.lat : b.med).push(Math.abs(ro)); (rf >= 0 ? b.front : b.back).push(Math.abs(rf)); }
    return { len: L, bins: out.map((b, k) => ({ f: (k + 0.5) / nb, med: pct(b.med, 0.95), lat: pct(b.lat, 0.95), front: pct(b.front, 0.95), back: pct(b.back, 0.95), r: pct(b.r, 0.9), n: b.r.length })) };
  };
  B.limbs = {};
  for (const s of SIDES) {
    const Lg = rig.leg(s), Ar = rig.arm(s), g = SGN[s];
    B.limbs["thigh_" + s] = limb(SEG["legU_" + s], at(Lg.up), at(Lg.low), g); B.limbs["calf_" + s] = limb(SEG["legL_" + s], at(Lg.low), at(Lg.foot), g);
    B.limbs["upper_" + s] = limb(SEG["armU_" + s], at(Ar.up), at(Ar.low), g, 5); B.limbs["fore_" + s] = limb(SEG["armL_" + s], at(Ar.low), at(Ar.hand), g, 5);
  }
  const meanR = (name, lo = 0, hi = 1) => { const b = B.limbs[name + "_l"].bins.concat(B.limbs[name + "_r"].bins).filter(x => x.f >= lo && x.f <= hi && x.n > 3); return b.length ? b.reduce((a, x) => a + x.r, 0) / b.length : 0; };
  B.r = { thigh: meanR("thigh", 0.3, 0.7), thighTop: meanR("thigh", 0.15, 0.4), calf: meanR("calf", 0.1, 0.5), upper: meanR("upper", 0.2, 0.9), fore: meanR("fore", 0.1, 0.9) };
  // the inside of the thighs: how far the flesh reaches toward the other leg, along the thigh
  B.thighIn = B.limbs.thigh_l.bins.map((b, k) => ({ f: b.f, med: (b.med + B.limbs.thigh_r.bins[k].med) / 2 }));
  // ---- the head -----------------------------------------------------------------------------------------------------
  { let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], c = 0; for (let i = 0; i < n; i++) if (seg[i] === SEG.head) { c++; for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], P[i * 3 + a]); hi[a] = Math.max(hi[a], P[i * 3 + a]); } }
    B.headR = c ? [(hi[0] - lo[0]) / 2, (hi[1] - lo[1]) / 2, (hi[2] - lo[2]) / 2] : [0.075, 0.11, 0.095]; B.headC = c ? [(hi[0] + lo[0]) / 2, (hi[1] + lo[1]) / 2, (hi[2] + lo[2]) / 2] : at(rig.head); }
  // ---- the weight -------------------------------------------------------------------------------------------------
  // the body as slabs and tubes (a stadium model): its volume, and a weight at a body's density. Not a scale's
  // reading: a number that says thin, ordinary or heavy the same way for every character
  let vol = 0; for (const s of slabs) vol += 3.25 * s.a * s.b * dy;
  const tube = (name, from = 0) => { let v = 0; for (const s of SIDES) { const l = B.limbs[name + "_" + s]; for (const b of l.bins) if (b.f >= from && b.n > 3) v += Math.PI * ((b.med + b.lat) / 2) * ((b.front + b.back) / 2) * l.len / l.bins.length; } return v; };
  const tCrotch = clamp((B.hipY - B.crotchY) / (B.thigh || 1), 0, 0.6);
  vol += tube("thigh", tCrotch) + tube("calf") + tube("upper") + tube("fore");
  vol += 4 / 3 * Math.PI * B.headR[0] * B.headR[1] * B.headR[2] * 0.86 + 2 * (0.00038 + 0.00095) * (H / 1.7) ** 3;
  B.volume = vol; B.mass = 1010 * vol; B.bmi = B.mass / (H * H);
  B.build = clamp((B.bmi - 21.5) / 7.5, -0.8, 1.8);                        // -: thin, 0: ordinary, 1: heavy
  // how feminine the shape is (-1 .. 1), for where the style slider starts on a file with no recipe
  B.femme = clamp(clamp((hips.a / (B.shoulderHalf || 1) - 0.93) / 0.07, -1, 1) * 0.55 + clamp(B.bustOut / (0.028 * H / 1.65) - 0.6, -0.6, 1) * 0.45, -1, 1);
  return B;
}

/** what the Animator's page and the bake's report show: the measures in centimetres and kilograms */
export function summary(B) {
  const cm = v => Math.round(v * 1000) / 10;
  return { height: cm(B.height), leg: cm(B.leg), weight: Math.round(B.mass * 10) / 10, bmi: Math.round(B.bmi * 10) / 10, build: Math.round(B.build * 100) / 100,
    bust: cm(B.girth.bust), underbust: cm(B.girth.under), waist: cm(B.girth.waist), hips: cm(B.girth.hips), thigh: cm(2 * Math.PI * B.r.thighTop), shoulders: cm(2 * B.shoulderHalf),
    bustOut: cm(B.bustOut), bellyOut: cm(B.bellyOut), seatOut: cm(B.seatOut), from: B.from };
}

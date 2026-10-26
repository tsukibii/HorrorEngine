// The pose the Character Studio shows its body in: MHR's own rest pose (an A-pose: the upper arms 48° down, the elbows
// bent, the hands forward, each leg 7° out) or a T-pose like a modeller's reference (the arms level out to the sides,
// the elbows and wrists straight, the legs straight down, the feet flat). Only what's shown: the body is shaped,
// fitted, dressed and saved in MHR's rest pose (the desk, Unreal and every file the Studio writes stay in it); the pose
// is laid over it by MHR's own skinning (Content/Studio/Bodies/MHR_lod1_rig.bin, rig_mhr.mjs), its joints refitted to
// the body as it is (each moves with the skin round it, as the desk's bodies.js refits them). Only the arms and the legs
// turn; and the neck stands up (MHR's rest pose carries its head well forward, the user found it uncanny: everything
// below the head moves forward under it, level, the neck part of the way). The head and everything on it (the face, the
// eyes, the teeth) stays exactly where it was. Plain JS, no three.js (posetest.mjs checks it).
//
//   const R = readRig(buffer)             {N, bones: [{name, parent, at}], BI, BW, rings}
//   const J = joints(R, P, P0, scale)     each bone's place on body P (P0: the rest body the rig was made on, `scale` P's scale to it)
//   const X = pose(R, J, "t" | "rest")    each bone's turn and pivots (null for "rest": nothing moves)
//   skin(R, X, P, out)                    the posed points; at(R, X, i, p) where point i's skinning takes p; turn(R, X, i, d) a direction
//   skinWith(X, BI, BW, Q, out)           any points with their own four bones (a garment's, tailor/weights.js)
//   shiftAt(X, y)                         how far forward the neck's stand moves a thing at height y that isn't skinned (the hair)

export const POSES = { t: "T-pose", rest: "MHR's A-pose" };
// the head's joint ahead of the shoulders' in the T-pose, as a share of the neck's height (from the chest's joint to the
// head's): 0.12 is about 2.2 cm on the bases (MHR's rest pose has 6.1 to 7.4), the ear over the shoulder's top within
// a centimetre on most bodies; upright, as the user's reference (the neck's front, under the jaw, leans 14° from upright
// in the side view: 29° in MHR's pose, 17° at 0.17, about 8° in the reference)
export const NECK_AHEAD = 0.12;

export function readRig(buf) {
  const dv = new DataView(buf), hl = dv.getUint32(0, true), H = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), N = H.points;
  const BI = new Uint8Array(buf, H.bi_at, N * 4), Q = new Uint16Array(buf.slice(H.bw_at, H.bw_at + N * 8)), BW = new Float32Array(N * 4);
  for (let i = 0; i < N * 4; i++) BW[i] = Q[i] / 65535;
  const bones = H.bones, byName = new Map(bones.map((b, i) => [b.name, i]));
  const order = [], seen = new Uint8Array(bones.length);               // parents before children
  const visit = i => { if (seen[i]) return; if (bones[i].parent >= 0) visit(bones[i].parent); seen[i] = 1; order.push(i); };
  bones.forEach((_, i) => visit(i));
  // each joint's ring: the points weighted to both the bone and its parent (where the skin bends round the joint), by
  // the product of the two weights; a bone with none moves with the points weighted to it, or else with its parent
  const nb = bones.length, ring = Array.from({ length: nb }, () => new Map()), own = Array.from({ length: nb }, () => new Map());
  for (let p = 0; p < N; p++) for (let k = 0; k < 4; k++) {
    const b = BI[p * 4 + k], w = BW[p * 4 + k]; if (!(w > 0)) continue;
    own[b].set(p, w);
    const par = bones[b].parent; if (par < 0) continue;
    for (let j = 0; j < 4; j++) if (BI[p * 4 + j] === par && BW[p * 4 + j] > 0) ring[b].set(p, w * BW[p * 4 + j]);
  }
  const rings = bones.map((_, b) => {
    const use = [...ring[b].values()].reduce((a, w) => a + w, 0) > 1 ? ring[b] : [...own[b].values()].reduce((a, w) => a + w, 0) > 1 ? own[b] : null;
    if (!use) return null;
    const s = [...use.values()].reduce((a, w) => a + w, 0);
    return { idx: Uint32Array.from(use.keys()), w: Float32Array.from([...use.values()].map(w => w / s)) };
  });
  return { N, bones, byName, order, BI, BW, rings };
}

// the joints on a body: each the ring's middle on P plus the ring's middle's offset from the joint on P0, scaled
export function joints(R, P, P0, scale = 1) {
  const J = new Float64Array(R.bones.length * 3);
  for (const b of R.order) {
    const g = R.rings[b], at = R.bones[b].at, par = R.bones[b].parent;
    if (!g) {                                                             // no skin of its own: it keeps its place on its parent
      for (let a = 0; a < 3; a++) J[b * 3 + a] = par < 0 ? at[a] * scale : J[par * 3 + a] + (at[a] - R.bones[par].at[a]) * scale;
      continue;
    }
    for (let a = 0; a < 3; a++) {
      let m = 0, m0 = 0;
      for (let q = 0; q < g.idx.length; q++) { m += g.w[q] * P[g.idx[q] * 3 + a]; m0 += g.w[q] * P0[g.idx[q] * 3 + a]; }
      J[b * 3 + a] = m + (at[a] - m0) * scale;
    }
  }
  return J;
}

// ---- quaternions ([x, y, z, w]) -------------------------------------------------------------------------------------
const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
                        a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qInv = q => [-q[0], -q[1], -q[2], q[3]];
function qRot(q, v) {                                                    // v turned by q
  const [x, y, z, w] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}
const unit = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
function qFrom(a, b) {                                                   // the shortest turn taking unit a onto unit b
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (d < -0.999999) { const p = Math.abs(a[0]) < 0.9 ? [0, -a[2], a[1]] : [-a[1], a[0], 0], l = Math.hypot(...p); return [p[0] / l, p[1] / l, p[2] / l, 0]; }
  const q = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0], 1 + d], l = Math.hypot(...q);
  return q.map(x => x / l);
}
const I = [0, 0, 0, 1];

// each bone's turn: the arms level out to the sides from the shoulder (the elbow and the wrist straightened along them),
// the legs straight down from the hip in the front view (their side view kept), the feet kept flat. The turns are in
// the body's own space; a bone left alone takes its parent's. X: {q: turns, J: pivots, J2: where they end up, moved}
export function pose(R, J, name = "t") {
  if (name !== "t") return null;
  const nb = R.bones.length, q = Array.from({ length: nb }, () => I), J2 = new Float64Array(J), moved = new Uint8Array(nb);
  const ix = n => R.byName.get(n), at = b => [J[b * 3], J[b * 3 + 1], J[b * 3 + 2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const aim = {};                                                         // bone -> the direction it's aimed along, from the joint to the next
  for (const [s, x] of [["l", 1], ["r", -1]]) {
    const out = [x, 0, 0];
    aim[ix(`${s}_uparm`)] = [ix(`${s}_lowarm`), () => out];
    aim[ix(`${s}_lowarm`)] = [ix(`${s}_wrist`), () => out];
    aim[ix(`${s}_wrist`)] = [ix(`${s}_middle1`), () => out];
    aim[ix(`${s}_upleg`)] = [ix(`${s}_foot`), d => unit([0, d[1], d[2]])];  // down in front, as it was from the side
    aim[ix(`${s}_foot`)] = "flat";
  }
  for (const b of R.order) {
    const par = R.bones[b].parent, qp = par >= 0 ? q[par] : I;
    if (par >= 0) {                                                       // the pivot rides its parent
      const r = qRot(qp, sub(at(b), at(par)));
      for (let a = 0; a < 3; a++) J2[b * 3 + a] = J2[par * 3 + a] + r[a];
      moved[b] = moved[par];
    }
    const A = aim[b];
    if (A === "flat") { q[b] = I; moved[b] = 1; J2[b * 3 + 1] = J[b * 3 + 1]; continue; }   // the foot as it was, its sole on the floor (a leg straightened reaches 6 mm lower)
    if (!A) { q[b] = qp; continue; }
    const [to, want] = A, d0 = sub(at(to), at(b)), now = unit(qRot(qp, d0));
    q[b] = qMul(qFrom(now, want(unit(d0))), qp); moved[b] = 1;
  }
  // the neck stood up: everything but the head moves forward, level, so the head's joint ends NECK_AHEAD of the
  // shoulders'; the neck's own joints part of the way, by their height between the chest's joint and the head's
  const head = ix("c_head"), chest = ix("c_spine3"), neck = ix("c_neck"), shL = ix("l_uparm"), shR = ix("r_uparm");
  let shift = null;
  if ([head, chest, neck, shL, shR].every(b => b >= 0)) {
    const yH = J[head * 3 + 1], yC = J[chest * 3 + 1], ahead = J[head * 3 + 2] - (J[shL * 3 + 2] + J[shR * 3 + 2]) / 2;
    const dz = Math.max(0, ahead - NECK_AHEAD * (yH - yC)), inHead = new Uint8Array(nb), onNeck = new Uint8Array(nb);
    for (const b of R.order) { const p = R.bones[b].parent; inHead[b] = b === head || (p >= 0 && inHead[p]) ? 1 : 0; onNeck[b] = !inHead[b] && (b === neck || p === neck) ? 1 : 0; }
    if (dz > 0) for (let b = 0; b < nb; b++) {
      const f = inHead[b] ? 0 : onNeck[b] ? Math.max(0, Math.min(1, (yH - J[b * 3 + 1]) / (yH - yC))) : 1;
      if (f > 0) { J2[b * 3 + 2] += dz * f; moved[b] = 1; }
    }
    shift = { dz, yH, yC };
  }
  return { q, J, J2, moved, shift };
}
// how far forward the neck's stand moves a thing at height y that isn't skinned (the salon's hair, hung from the head):
// all of it below the chest's joint, none above the head's, the neck's share between, as the neck's joints move
export function shiftAt(X, y) {
  const s = X?.shift; if (!s || !s.dz) return 0;
  return s.dz * Math.max(0, Math.min(1, (s.yH - y) / (s.yH - s.yC)));
}

// a point's place under its four bones' turns (unweighted: the bones' own)
function blend(X, bi, bw, p, out, o) {
  let x = 0, y = 0, z = 0;
  for (let k = 0; k < 4; k++) {
    const w = bw[k]; if (!(w > 0)) continue;
    const b = bi[k], r = qRot(X.q[b], [p[0] - X.J[b * 3], p[1] - X.J[b * 3 + 1], p[2] - X.J[b * 3 + 2]]);
    x += w * (r[0] + X.J2[b * 3]); y += w * (r[1] + X.J2[b * 3 + 1]); z += w * (r[2] + X.J2[b * 3 + 2]);
  }
  out[o] = x; out[o + 1] = y; out[o + 2] = z;
}
// the posed points: a point whose bones haven't moved is copied as it is (the face, to the last bit)
export function skin(R, X, P, out = new Float32Array(P.length)) {
  if (!X) { out.set(P); return out; }
  return skinWith(X, R.BI, R.BW, P, out);
}
export function skinWith(X, BI, BW, Q, out = new Float32Array(Q.length)) {
  if (!X) { out.set(Q); return out; }
  const n = Q.length / 3, bi = [0, 0, 0, 0], bw = [0, 0, 0, 0], p = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    let still = true;
    for (let k = 0; k < 4; k++) { bi[k] = BI[i * 4 + k]; bw[k] = BW[i * 4 + k]; if (bw[k] > 0 && X.moved[bi[k]]) still = false; }
    if (still) { out[i * 3] = Q[i * 3]; out[i * 3 + 1] = Q[i * 3 + 1]; out[i * 3 + 2] = Q[i * 3 + 2]; continue; }
    p[0] = Q[i * 3]; p[1] = Q[i * 3 + 1]; p[2] = Q[i * 3 + 2];
    blend(X, bi, bw, p, out, i * 3);
  }
  return out;
}
// directions (a garment's normals) with their own four bones: turned by them, blended, made unit again
export function turnWith(X, BI, BW, D, out = new Float32Array(D.length)) {
  if (!X) { out.set(D); return out; }
  for (let i = 0; i < D.length / 3; i++) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) { const w = BW[i * 4 + k]; if (!(w > 0)) continue; const r = qRot(X.q[BI[i * 4 + k]], [D[i * 3], D[i * 3 + 1], D[i * 3 + 2]]); x += w * r[0]; y += w * r[1]; z += w * r[2]; }
    const l = Math.hypot(x, y, z) || 1; out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l;
  }
  return out;
}
// where point i's skinning takes p (a point beside it: a handle's pull), and a direction there
export function at(R, X, i, p) {
  if (!X) return p.slice();
  const o = [0, 0, 0]; blend(X, [0, 1, 2, 3].map(k => R.BI[i * 4 + k]), [0, 1, 2, 3].map(k => R.BW[i * 4 + k]), p, o, 0); return o;
}
export function turn(R, X, i, d) {
  if (!X) return d.slice();
  let o = [0, 0, 0];
  for (let k = 0; k < 4; k++) { const w = R.BW[i * 4 + k]; if (!(w > 0)) continue; const r = qRot(X.q[R.BI[i * 4 + k]], d); o = [o[0] + w * r[0], o[1] + w * r[1], o[2] + w * r[2]]; }
  return o;
}

// Animations v3, the layer (docs/ANIMATOR_V3.md §11): a flourish laid over whatever she's doing. The user, DECISIONS
// 2026-11-14, later: "as ik blendables meaning if the lower body and chest is in a position e.g. walking or sitting,
// we can still blend in these animations". This is the rule itself, in JavaScript: the page shows a flourish over a
// walk or a seat with it, ANIMATOR holds it, and the Look plugin's HSGesture (gesture.gd) is this file in GDScript:
// what one does to a pose the other does, to the same numbers.
//
// A pose here is what a clip holds: each joint's own rotation, and a translation where the clip gives one
// (Pose.locals(), or sample() of a clip's tracks). lay(rig, base, life, t):
//   the flourish's arm (its collarbone down to its fingertips)   its own turns, faded in over the clip's first `in`
//                                                                 seconds and out over its last `out`
//   her spine, her neck, her head, the other arm's collarbone    how far the flourish has turned each from where it
//                                                                 started, added to what the base has it doing
//   everything else (her pelvis, her legs, her soft tissue)      the base's, untouched
//   a hand that touches her (`touch`)                             while it does, the point of her hand the clip names is
//                                                                 put where the clip has it on the bone it touches, as
//                                                                 that bone is in the pose she's really in: her arm's
//                                                                 two bones solved again for the wrist that takes
import { V, Q, sm, clamp } from "./m.js";

const I4 = [0, 0, 0, 1];
/** a clip's tracks (clips.js tracksOf) at a time, as a pose: [{ r, t? }] for every joint (one the clip doesn't move:
    as it rests) */
export function sample(rig, clip, t) {
  const f = clamp(t * clip.fps, 0, clip.keys - 1), i0 = Math.min(clip.keys - 2, Math.floor(f)), a = f - i0, i1 = i0 + 1, out = restPose(rig);
  for (const tr of clip.tracks) { const o = out[tr.joint];
    if (tr.r) o.r = Q.slerp([tr.r[i0 * 4], tr.r[i0 * 4 + 1], tr.r[i0 * 4 + 2], tr.r[i0 * 4 + 3]], [tr.r[i1 * 4], tr.r[i1 * 4 + 1], tr.r[i1 * 4 + 2], tr.r[i1 * 4 + 3]], a);
    if (tr.t) o.t = [0, 1, 2].map(k => tr.t[i0 * 3 + k] + (tr.t[i1 * 3 + k] - tr.t[i0 * 3 + k]) * a); }
  return out;
}
/** the rest pose as a pose */
export function restPose(rig) {
  return rig.J.map(b => ({ r: Q.norm(Q.mul(Q.conj(b.parent >= 0 ? rig.J[b.parent].q0 : I4), b.q0)) }));
}
/** a pose's joints in her own space: { W: each joint's turn, P: each joint's place } */
export function fk(rig, pose) {
  const n = rig.J.length, W = new Array(n), P = new Array(n);
  for (const i of rig.order) { const b = rig.J[i], p = b.parent, o = pose[i];
    if (p < 0) { W[i] = o.r; P[i] = o.t || b.at; continue; }
    W[i] = Q.mul(W[p], o.r); P[i] = V.add(P[p], Q.rot(W[p], o.t || Q.rot(Q.conj(rig.J[p].q0), V.sub(b.at, rig.J[p].at)))); }
  return { W, P };
}
/** which joints the layer takes how: { arm: { l, r } (collarbone to fingertips), add (spine, neck, head), clav: { l, r } } */
export function parts(rig) {
  if (rig._parts) return rig._parts;
  const under = j => { const out = [j]; for (let k = 0; k < out.length; k++) for (const c of rig.J[out[k]].kids) if (!rig.J[c].soft) out.push(c); return out; };
  return (rig._parts = { arm: { l: under(rig.armL.clav), r: under(rig.armR.clav) }, add: [...rig.spine, rig.neck, rig.head], clav: { l: rig.armL.clav, r: rig.armR.clav } });
}
/** how much of a flourish's arm is on at `t` seconds of it (0..1), and how much its touch is */
export const armWeight = (L, secs, t) => sm(0, Math.max(0.01, L.in), t) * (1 - sm(secs - Math.max(0.01, L.out), secs, t));
export const touchWeight = (L, t) => L.touch ? sm(L.touch.from - 0.3, L.touch.from, t) * (1 - sm(L.touch.to, L.touch.to + 0.3, t)) : 0;

/** A flourish laid over a pose. base: the pose she's in; life: { meta: its record (`life`), secs, at(t) -> its pose
    at t, first: its pose at 0 }; t: seconds into the flourish. opt.ik false: without the touch's solve; opt.amount:
    all of it scaled (0..1); opt.weight: the arm's weight given outright (a carry pose, held: no way in or out).
    -> { pose, weight, touch: null | { weight, target, was, moved } } (touch: where the hand's point was put, where the
    blend alone had left it, how far it was carried: her own space, metres) */
export function lay(rig, base, life, t, opt = {}) {
  const L = life.meta, G = parts(rig), k = opt.amount ?? 1, w = (opt.weight ?? armWeight(L, life.secs, t)) * k, now = life.at(t), first = life.first, out = base.map(o => ({ r: o.r, ...(o.t ? { t: o.t } : {}) }));
  const sides = L.hand === "both" ? ["l", "r"] : L.hand === "l" || L.hand === "r" ? [L.hand] : [];
  for (const s of sides) for (const j of G.arm[s]) out[j].r = Q.slerp(base[j].r, now[j].r, w);
  const add = G.add.slice(); for (const s of ["l", "r"]) if (!sides.includes(s)) add.push(G.clav[s]);
  for (const j of add) { const d = Q.mul(Q.conj(first[j].r), now[j].r); out[j].r = Q.norm(Q.mul(base[j].r, k >= 1 ? d : Q.slerp(I4, d, k))); }
  let touch = null; const wt = touchWeight(L, t) * k;
  if (L.touch && wt > 0.0005 && opt.ik !== false) {
    const s = L.hand, A = rig.arm(s), bone = rig.ix.get(L.touch.side ? `${L.touch.side}_${L.touch.bone}` : L.touch.bone);
    if (bone != null) {
      // where the clip has the hand's point, in the clip's own bone; then where that is on the bone as it is now
      const C = fk(rig, now), rel = Q.rot(Q.conj(C.W[bone]), V.sub(V.add(C.P[A.hand], Q.rot(C.W[A.hand], L.touch.point)), C.P[bone]));
      const N = fk(rig, out), target = V.add(N.P[bone], Q.rot(N.W[bone], rel)), was = V.add(N.P[A.hand], Q.rot(N.W[A.hand], L.touch.point));
      let move = V.mul(V.sub(target, was), wt); const far = V.len(move), most = opt.most ?? 0.25; if (far > most) move = V.mul(move, most / far);
      solveArm(rig, out, N, A, V.add(N.P[A.hand], move));
      touch = { weight: wt, target, was, moved: V.len(move) };
    }
  }
  return { pose: out, weight: w, touch };
}

/** her arm's two bones solved again for the wrist at `goal` (her own space), the elbow on the side it was, the hand
    turned as it was: `pose` is changed in place (N: its joints, fk()). The Look plugin's HSHandIK solves the same. */
export function solveArm(rig, pose, N, A, goal) {
  const S = N.P[A.up], E = N.P[A.low], Wr = N.P[A.hand], a = V.dist(S, E), c = V.dist(E, Wr), to = V.sub(goal, S), d = clamp(V.len(to), Math.abs(a - c) + 0.001, (a + c) * 0.999), u = V.norm(to);
  const line = V.norm(V.sub(Wr, S)); let off = V.perp(V.sub(E, S), line); if (V.len(off) < 1e-4) off = V.perp([0, -1, 0], line);
  if (V.dot(line, u) > -0.999) off = Q.rot(Q.fromTo(line, u), off);
  const side = V.norm(V.perp(off, u)), ca = clamp((a * a + d * d - c * c) / (2 * a * d), -1, 1), e2 = V.add(S, V.add(V.mul(u, a * ca), V.mul(side, a * Math.sqrt(Math.max(0, 1 - ca * ca)))));
  const R1 = Q.fromTo(V.norm(V.sub(E, S)), V.norm(V.sub(e2, S))), w1 = V.add(S, Q.rot(R1, V.sub(Wr, S))), R2 = Q.fromTo(V.norm(V.sub(w1, e2)), V.norm(V.sub(V.mad(S, u, d), e2)));
  const Wup = Q.norm(Q.mul(R1, N.W[A.up])), Wlow = Q.norm(Q.mul(R2, Q.mul(R1, N.W[A.low]))), pu = rig.J[A.up].parent, ph = rig.J[A.hand].parent;
  pose[A.up].r = Q.norm(Q.mul(Q.conj(N.W[pu]), Wup)); pose[A.low].r = Q.norm(Q.mul(Q.conj(Wup), Wlow));
  // the hand keeps the turn it had: its own rotation against whatever carries it now (the forearm, or the wrist's twist bone under the forearm)
  const Wph = ph === A.low ? Wlow : Q.mul(Wlow, pose[ph].r);
  pose[A.hand].r = Q.norm(Q.mul(Q.conj(Wph), N.W[A.hand]));
}

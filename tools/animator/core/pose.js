// Animator v2: a pose, and the builder that makes one from a few controls (docs/ANIMATOR_V2.md §4). A pose is a world
// turn for each bone, measured from the rest pose (a bone left alone takes its parent's), and where the pelvis is. The
// builder never deals in bone axes: a limb is where its joints are (the legs by two-bone IK from the hip to an ankle,
// the arms by angles from the shoulder or by IK to a wrist), and each bone's turn is the one that takes its rest
// direction and hinge onto the posed ones, so the same controls give the same pose on any rest pose. A limb's twist is
// shared out along its twist bones.
import { V, Q, rx, ry, rz, clamp } from "./m.js";
import { SIDES, SGN } from "./rig.js";

const I4 = [0, 0, 0, 1], UP = [0, 1, 0], SPINE_F = [0.15, 0.4, 0.72, 1];
const ypr = o => o.q || Q.mul(ry(o.yaw || 0), Q.mul(rz(o.roll || 0), rx(o.pitch || 0)));
const turn = (v, ax, a) => { const c = Math.cos(a), s = Math.sin(a), k = V.cross(ax, v), d = V.dot(ax, v) * (1 - c); return [v[0] * c + k[0] * s + ax[0] * d, v[1] * c + k[1] * s + ax[1] * d, v[2] * c + k[2] * s + ax[2] * d]; };

export class Pose {
  constructor(rig) { this.rig = rig; this.D = new Array(rig.J.length).fill(null); this.place = new Map(); this.off = new Map(); this.size = new Map(); this.info = {}; }
  /** every bone's world turn and every joint's world place */
  solve() {
    const R = this.rig, n = R.J.length, D = new Array(n), P = new Float64Array(n * 3);
    for (const i of R.order) {
      const b = R.J[i], p = b.parent; D[i] = this.D[i] || (p >= 0 ? D[p] : I4);
      let at;
      if (this.place.has(i)) at = this.place.get(i);
      else if (p < 0) at = b.at;
      else { let d = V.sub(b.at, R.J[p].at); const o = this.off.get(i); if (o) d = V.add(d, o); at = V.add([P[p * 3], P[p * 3 + 1], P[p * 3 + 2]], Q.rot(D[p], d)); }
      P[i * 3] = at[0]; P[i * 3 + 1] = at[1]; P[i * 3 + 2] = at[2];
    }
    return { D, P };
  }
  /** the pose as the file wants it: each joint's own rotation, and translation where it isn't the rest's ({ r, t }) */
  locals(solved = this.solve()) {
    const R = this.rig, { D, P } = solved, out = new Array(R.J.length);
    for (const i of R.order) {
      const b = R.J[i], p = b.parent, Wp = p >= 0 ? Q.mul(D[p], R.J[p].q0) : I4, r = Q.norm(Q.mul(Q.conj(Wp), Q.mul(D[i], b.q0)));
      const o = { r }; if (this.place.has(i) || this.off.has(i)) o.t = Q.rot(Q.conj(Wp), p >= 0 ? [P[i * 3] - P[p * 3], P[i * 3 + 1] - P[p * 3 + 1], P[i * 3 + 2] - P[p * 3 + 2]] : [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
      if (this.size.has(i)) o.s = this.size.get(i);
      out[i] = o;
    }
    return out;
  }
}

/** where the ankle is for a foot planted at `o` (the ankle's place on the ground when the foot is flat), turned `yaw`
    and pitched `pitch`: toes up, about the heel; toes down, about the ball, and as the heel comes right up the foot
    rolls on over its toes (the point it turns about moves from the ball to the toes' tips): a leg's last reach at
    toe-off, without which no stride is as long as a real one */
export const rollPoint = (F, pitch) => { const t = clamp((-pitch - 0.45) / 0.7, 0, 1); return F.ballAhead + (0.93 * F.toeAhead - F.ballAhead) * t * t * (3 - 2 * t); };
export function ankleAt(F, ankleH, o, yaw, pitch) {
  const Y = ry(yaw);
  if (pitch >= 0) return V.add(V.add(o, Q.rot(Y, [0, 0, -F.heelBack])), Q.rot(Y, Q.rot(rx(-pitch), [0, ankleH, F.heelBack])));
  const z = rollPoint(F, pitch);
  return V.add(V.add(o, Q.rot(Y, [0, 0, z])), Q.rot(Y, Q.rot(rx(-pitch), [0, ankleH, -z])));
}

/** A pose from controls:
    c.pelvis { pos, yaw, roll, pitch | q }      the pelvis joint's place and turn (yaw: to her left; roll: her left side up; pitch: forward)
    c.chest  { yaw, roll, pitch | q }           the chest's turn in the world; the spine bends between the two
    c.head   { yaw, roll, pitch | q }           the head's turn in the world; the neck half way
    c.legs.l/.r { ankle, yaw, pitch, roll, toe, knee }   the ankle's place, the foot's heading, pitch (toes up) and roll, the toes' bend, the knee turned out
    c.arms.l/.r { flex, abd, rot, elbow, pron, wrist, curl, spread, hang }   angles from the hanging arm; or { hand: [x,y,z], pole, palm, ... } the wrist's place
    c.clav.l/.r { up, fwd } */
export function build(rig, c) {
  const R = rig, pose = new Pose(rig), Dp = ypr(c.pelvis), Dc = ypr(c.chest || {}), Dh = ypr(c.head || {});
  pose.D[R.top] = I4; pose.D[R.pelvis] = Dp; pose.place.set(R.pelvis, c.pelvis.pos);
  R.spine.forEach((j, k) => { pose.D[j] = Q.slerp(Dp, Dc, SPINE_F[k]); });
  pose.D[R.neck] = Q.slerp(Dc, Dh, c.neck ?? 0.45); pose.D[R.head] = Dh;
  for (const s of SIDES) { const g = SGN[s], cl = (c.clav || {})[s]; pose.D[R.arm(s).clav] = cl ? Q.mul(Dc, Q.mul(ry(-g * (cl.fwd || 0)), rz(g * (cl.up || 0)))) : Dc; }
  const { P } = pose.solve(), at = j => [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]], info = pose.info;
  // ---- the legs ---------------------------------------------------------------------------------------------------
  const pyaw = Math.atan2(2 * (Dp[3] * Dp[1] + Dp[0] * Dp[2]), 1 - 2 * (Dp[1] * Dp[1] + Dp[0] * Dp[0]));   // the pelvis's heading
  for (const s of SIDES) {
    const L = R.leg(s), g = SGN[s], lc = c.legs[s], H = at(L.up), A = lc.ankle, yaw = lc.yaw || 0, reach = L.thigh + L.shank;
    let d = V.dist(A, H); info["reach_" + s] = d / reach; d = clamp(d, Math.abs(L.thigh - L.shank) + 1e-4, reach * 0.99995);
    const u = V.norm(V.sub(A, H)), poleYaw = lc.poleYaw ?? (pyaw + (yaw - pyaw) * 0.6 + g * (lc.knee || 0)), pole = lc.pole || [Math.sin(poleYaw), 0, Math.cos(poleYaw)];
    let w = V.perp(pole, u); if (V.len(w) < 1e-5) w = V.perp([0, 0, 1], u); w = V.norm(w);
    const ca = clamp((L.thigh * L.thigh + d * d - L.shank * L.shank) / (2 * L.thigh * d), -1, 1), sa = Math.sqrt(1 - ca * ca), K = V.add(H, V.add(V.mul(u, L.thigh * ca), V.mul(w, L.thigh * sa)));
    const dt = V.norm(V.sub(K, H)), ds = V.norm(V.sub(V.add(H, V.mul(u, d)), K)), h = V.norm(V.cross(w, u));
    const Du = Q.frame(L.dt0, L.ht0, dt, h), Dl = Q.frame(L.ds0, L.hs0, ds, h);
    const Df = lc.q || Q.mul(ry(yaw), Q.mul(rx(-(lc.pitch || 0)), Q.mul(rz(lc.roll || 0), ry(-L.yaw0))));
    pose.D[L.up] = Du; pose.D[L.low] = Dl; pose.D[L.foot] = Df;
    pose.D[L.ball] = lc.toe ? Q.mul(ry(yaw), Q.mul(rx(-(lc.pitch || 0) - lc.toe), Q.mul(rz(lc.roll || 0), ry(-L.yaw0)))) : null;
    const tw = Q.twist(Q.mul(Q.conj(Dp), Du), L.dt0), sw = Q.twist(Q.mul(Q.conj(Dl), Df), L.ds0);
    for (const t of L.upTw) pose.D[t.j] = Q.mul(Du, Q.axis(L.dt0, -(1 - t.f) * tw));
    for (const t of L.lowTw) pose.D[t.j] = Q.mul(Dl, Q.axis(L.ds0, t.f * sw));
    info["knee_" + s] = Math.acos(clamp(V.dot(dt, ds), -1, 1)); info["kneeAt_" + s] = K;
  }
  // ---- the arms ---------------------------------------------------------------------------------------------------
  const cyaw = Math.atan2(2 * (Dc[3] * Dc[1] + Dc[0] * Dc[2]), 1 - 2 * (Dc[1] * Dc[1] + Dc[0] * Dc[0])), Dup = ry(cyaw);
  for (const s of SIDES) {
    const A = R.arm(s), g = SGN[s], ac = c.arms[s], S = at(A.up); let du, df, h;
    if (ac.hand) {                                             // to a wrist's place: two-bone IK, the elbow toward `pole`
      const reach = A.upper + A.fore, d = clamp(V.dist(ac.hand, S), Math.abs(A.upper - A.fore) + 1e-4, reach * 0.9995), u = V.norm(V.sub(ac.hand, S));
      info["armReach_" + s] = V.dist(ac.hand, S) / reach;
      let w = V.perp(ac.pole || [g * 0.35, -0.75, -0.55], u); if (V.len(w) < 1e-5) w = V.perp([0, -1, 0], u); w = V.norm(w);
      const ca = clamp((A.upper * A.upper + d * d - A.fore * A.fore) / (2 * A.upper * d), -1, 1), sa = Math.sqrt(1 - ca * ca), E = V.add(S, V.add(V.mul(u, A.upper * ca), V.mul(w, A.upper * sa)));
      du = V.norm(V.sub(E, S)); df = V.norm(V.sub(V.add(S, V.mul(u, d)), E)); h = V.norm(V.cross(w, u));
    } else {                                                   // by angles from the arm hanging: forward, out to the side, turned in, then the elbow
      const ref = Q.slerp(Dc, Dup, ac.hang ?? 0.7), Rs = Q.mul(ref, Q.mul(rx(-(ac.flex || 0)), Q.mul(rz(g * (ac.abd || 0)), ry(-g * (ac.rot || 0)))));
      du = Q.rot(Rs, [0, -1, 0]); h = Q.rot(Rs, [-1, 0, 0]); df = turn(du, h, ac.elbow || 0);
    }
    const Du = Q.frame(A.du0, A.h0, du, h), Dl = Q.frame(A.df0, A.h0, df, h), b = V.cross(df, h);
    let pron = ac.pron ?? 0.4;
    if (ac.palm) {                                           // the palm turned to face a direction, as far as a forearm turns
      // The turn is read about the middle of the forearm's own range (-70 .. 150 degrees). A palm asked to face along
      // the forearm says nothing about its turn, and one asked to face where no forearm can turn it is past one end
      // or the other: the less across it and the further past an end, the less it's heeded, so the hand never flips
      // from one end of its range to the other between two frames
      const pb = V.dot(ac.palm, b), ph = g * V.dot(ac.palm, h), across = Math.hypot(pb, ph), MID = 0.7, HALF = 1.9;
      let d = Math.atan2(pb, ph) - MID; if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
      const w = clamp((across - 0.2) / 0.4, 0, 1), o = clamp((Math.abs(d) - HALF) / (Math.PI - HALF), 0, 1), heed = w * w * (3 - 2 * w) * (1 - o * o * (3 - 2 * o));
      pron += (MID + clamp(d, -HALF, HALF) - pron) * heed * (ac.palmK ?? 1);
    }
    const dTw = g * (pron - A.pron0), Dw = Q.mul(Q.axis(df, dTw), Dl), n = Q.rot(Dw, A.palm0), wr = ac.wrist || 0;
    const Dhand = wr ? Q.mul(Q.axis(V.cross(df, n), wr), Dw) : Dw;
    pose.D[A.up] = Du; pose.D[A.low] = Dl; pose.D[A.wtw] = Dw; pose.D[A.hand] = Dhand;
    const tw = Q.twist(Q.mul(Q.conj(pose.D[A.clav]), Du), A.du0);
    for (const t of A.upTw) pose.D[t.j] = Q.mul(Du, Q.axis(A.du0, -(1 - t.f) * tw));
    for (const t of A.lowTw) pose.D[t.j] = Q.mul(Dl, Q.axis(A.df0, t.f * dTw));
    // the fingers: each joint curled toward the palm about the knuckles' own axis; the thumb half as much
    const curl = ac.curl ?? 0.3, nh = Q.rot(Dhand, A.palm0);
    A.fingers.forEach((chain, fi) => { if (!chain.length) return; const first = chain.find(j => /[1-3]$/.test(R.J[j].name)) ?? chain[0], kid = R.J[first].kids[0];
      const d0 = kid != null ? V.norm(V.sub(R.J[kid].at, R.J[first].at)) : A.handDir, k = V.norm(V.cross(Q.rot(Dhand, d0), nh)), amt = fi === 0 ? curl * 0.45 : curl * (1 + 0.12 * (fi - 2)); let Dq = Dhand, acc = 0;
      for (const j of chain) { if (/0$/.test(R.J[j].name) && fi !== 0) { pose.D[j] = Dhand; continue; } acc += amt * (/1$/.test(R.J[j].name) ? 0.9 : /2$/.test(R.J[j].name) ? 1.15 : 0.7); pose.D[j] = Q.mul(Q.axis(k, acc), Dhand); } });
    info["elbowAt_" + s] = V.add(S, V.mul(du, A.upper)); info["wristAt_" + s] = V.add(info["elbowAt_" + s], V.mul(df, A.fore)); info["handDir_" + s] = Q.rot(Dhand, A.handDir); info["palm_" + s] = nh;
  }
  return pose;
}

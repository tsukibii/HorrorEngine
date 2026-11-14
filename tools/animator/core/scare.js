// Animations v3: the scares (docs/ANIMATOR_V3.md §2.5): "a generic lunge jump scare ones (ones that briefly appear)".
// Each is short and starts ALREADY COILED: she's shown in its first frame, and a person standing at ease is not a
// scare. A burst to its `peak`, held shaking until `show` (how long to leave her there before she's gone), and, for
// a game that keeps her, a way back to the idle's first pose. meta.scare: { peak, show (seconds), reach (metres in
// front of where she stands that her hands or head get: stand her that far and a little more from the player) }.
import { V, Q, DEG, clamp, lerp, sm, sm2, hump } from "./m.js";
import { params, FPS } from "./gait.js";
import { stance, basePose, homeOf, armTo, mixA, bez, turnV } from "./acts.js";
import { standing, knuckles } from "./acting.js";
import { allFours, kneeling, planted, idleAt } from "./quad.js";

const TAU = 2 * Math.PI, r3 = v => +v.toFixed(3);
const mixArm = (A, B, t) => { const o = { ...A }; for (const k of ["flex", "elbow", "abd", "rot", "pron", "wrist", "curl", "hang"]) o[k] = lerp(A[k] ?? 0, B[k] ?? 0, t); return o; };
const made = (name, T, ctrl, peak, show, reach, more = {}) => { const n = Math.round(T * FPS) + 1; return { name, loop: false, n, fps: FPS, secs: (n - 1) / FPS, ctrl, events: [{ t: peak, name: "peak" }, { t: show, name: "over" }], meta: { scare: { peak: r3(peak), show: r3(show), reach: r3(reach), ...more } } }; };

/** { scare_lunge, scare_loom, scare_snap, scare_claw } */
export function scares(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), sc = p.sc, arm = body.upper + body.fore, q = clamp(1 - 0.12 * p.pw + 0.2 * p.heavy, 0.8, 1.35), out = [];
  // ---- the lunge: from low with the arms drawn back, a step and the whole body thrown forward, both hands at your face ----
  { const t0 = 0.07 * q, tp = 0.38 * q, th = tp + 0.6, T = th + 1.05 * q, step = 0.5 * sc * (1 + 0.1 * p.pw - 0.15 * p.heavy);
    const C = { flex: -28 * DEG, elbow: 100 * DEG, abd: 16 * DEG, rot: 0, pron: 30 * DEG, wrist: 0, curl: 0.9, hang: 0.3 };
    const ctrl = f => { const t = f / FPS, s = sm2(t0, tp, t), r = sm2(th, T - 0.1, t), mix = (c, k) => (c * (1 - s) + k * s) * (1 - r), e = sm(tp - 0.02, tp + 0.05, t) * (1 - sm(th - 0.15, th + 0.05, t)), sh = e * Math.sin(TAU * 12.5 * t), sh2 = e * Math.sin(TAU * 10.5 * t + 1.3);
      const st = sm2(t0, tp - 0.03, t) * (1 - sm2(th + 0.12, T - 0.3, t)), lift = 0.06 * sc * (hump(t0, tp - 0.03, t) + 0.8 * hump(th + 0.12, T - 0.3, t));
      const c = standing(rig, body, p, S, base, { k: 1 - r, fwd: mix(-0.03, 0.27) * sc, down: mix(0.09, 0.13) * sc, pitch: mix(20, 36) * DEG, yaw: mix(0, 8) * DEG + 0.8 * DEG * sh2, pyaw: mix(0, 5) * DEG, look: [mix(25, -24) * DEG, 0], head: { roll: 3 * DEG * sh },
        feet: { r: { dz: step * st, lift, pitch: 9 * DEG * hump(t0, tp + 0.05, t) }, l: { pitch: -32 * DEG * s * (1 - r) } }, squat: 1 - r });
      c.arms.l = mixArm(C, S.arm, r); c.arms.r = mixArm(C, S.arm, r); c.clav = { l: { up: 10 * DEG * (1 - r) }, r: { up: 10 * DEG * (1 - r) } };
      const home = homeOf(rig, c), ka = sm2(t0 + 0.02, tp, t) * (1 - sm2(th, T - 0.15, t));
      for (const [sd, g] of [["l", 1], ["r", -1]]) { const Sh = home.shoulder[sd], tg = [Sh[0] - g * 0.035 * sc + 0.006 * sh2, Sh[1] + 0.05 * sc + 0.012 * sh * g, Sh[2] + 0.93 * arm];
        c.arms[sd] = armTo(home, sd, tg, ka, { palm: [0, -0.45, 0.9], pole: [g * 0.75, -0.6, -0.2], curl: 0.42, wrist: -26 * DEG, via: [Sh[0] + g * 0.06 * sc, Sh[1] - 0.12 * sc, Sh[2] + 0.3 * arm] }); }
      return c; };
    const pk = homeOf(rig, ctrl(Math.round(tp * FPS)));
    out.push(made("scare_lunge", T, ctrl, tp, th, Math.max(knuckles(rig, pk.info, "l")[2], knuckles(rig, pk.info, "r")[2]))); }
  // ---- the loom: bent double with the head hanging, whipped upright onto her toes and leant in over you ----------------
  { const t0 = 0.1 * q, tp = 0.44 * q, th = tp + 0.75, T = th + 1.1 * q;
    const C = { flex: 0, elbow: 8 * DEG, abd: 3 * DEG, rot: 5 * DEG, pron: 40 * DEG, wrist: 0, curl: 0.5, hang: 1 }, K = { flex: 8 * DEG, elbow: 36 * DEG, abd: 25 * DEG, rot: -10 * DEG, pron: 75 * DEG, wrist: -14 * DEG, curl: 0.5, hang: 0.6 };   // (risen, her hands are hooked at her sides: hung limp from the wrists in loose fists they read as tired)
    const ctrl = f => { const t = f / FPS, s = sm2(t0, tp, t), r = sm2(th, T - 0.1, t), mix = (c, k) => (c * (1 - s) + k * s) * (1 - r), over = hump(tp - 0.12, tp + 0.2, t), e = sm(tp, tp + 0.06, t) * (1 - sm(th - 0.15, th + 0.05, t)), sh = e * Math.sin(TAU * 11 * t), creepIn = sm(tp, th, t) * (1 - r);
      const c = standing(rig, body, p, S, base, { k: 1 - r, fwd: mix(-0.06, 0.07) * sc + 0.02 * sc * creepIn, down: mix(0.05, 0) * sc, pitch: (mix(80, 9) + 5 * over * (1 - r) + 3 * creepIn) * DEG, heel: 0.75 * s * (1 - r), look: [mix(60, 11.5) * DEG, 0.4 * DEG * sh], head: { roll: (mix(0, 24) + 7 * creepIn + 1.6 * sh) * DEG } });
      c.arms.l = mixArm(mixArm(C, K, s), S.arm, r); c.arms.r = mixArm(mixArm(C, K, s), S.arm, r); c.clav = { l: { up: 11 * DEG * s * (1 - r) }, r: { up: 11 * DEG * s * (1 - r) } }; return c; };
    const pk = homeOf(rig, ctrl(Math.round(tp * FPS))), P = pk.pose.solve().P;
    out.push(made("scare_loom", T, ctrl, tp, th, P[rig.head * 3 + 2] + 0.09 * sc)); }
  // ---- the snap: stood with the head down; it snaps up and to one side, a shoulder jerks ---------------------------------
  { const ts = 0.13, tp = 0.23, th = 0.95, T = 1.9 * q;
    const ctrl = f => { const t = f / FPS, s = sm(ts, tp, t), r = sm2(th, T - 0.1, t), mix = (c, k) => (c * (1 - s) + k * s) * (1 - r), after = Math.max(0, t - ts), ring = (t > ts ? Math.exp(-after / 0.14) * Math.sin(TAU * 9 * after) : 0) * (1 - r), jerk = hump(ts - 0.02, ts + 0.3, t);
      const c = standing(rig, body, p, S, base, { k: 1 - r, down: mix(0.012, 0) * sc, pitch: mix(9, 2) * DEG, roll: 5 * DEG * ring, look: [mix(34, -6) * DEG, mix(0, 9) * DEG], head: { roll: mix(0, -23) * DEG - 2 * DEG * ring } });
      c.clav = { l: { fwd: mix(8, 0) * DEG }, r: { fwd: mix(8, 0) * DEG, up: 15 * DEG * jerk * (1 - r) } }; return c; };
    out.push(made("scare_snap", T, ctrl, tp, th, 0)); }
  // ---- the claw: on all fours; a hand clawed up and forward from the floor, the trunk risen -----------------------------
  { const G = kneeling(rig, body, set), A = rig.armR, t0 = 0.08 * q, tp = 0.3 * q, th = tp + 0.5, T = th + 0.95 * q, W0 = [-G.hx, G.wristH, G.zc + 0.03 * sc], flat = planted(rig, "r", W0).handQ, claw = Q.frame(A.handDir, A.palm0, [0.1, 0.45, 0.89], [-0.1, -0.89, 0.45]);
    const I = idleAt(G, 0), frame = (a, coil, sh = 0) => {
      const o = { ...I, pz: I.pz - 0.05 * sc * coil + 0.04 * sc * a, pitch: -9 * DEG * a, chest: { yaw: I.chest.yaw * (1 - a) + 9 * DEG * a, roll: I.chest.roll * (1 - a) - 5 * DEG * a, pitch: 7 * DEG * coil - frame.rise * a }, head: { yaw: I.head.yaw * (1 - a), roll: 8 * DEG * a + 2 * DEG * sh, pitch: lerp(I.head.pitch + 8 * DEG * coil, -4 * DEG, a) }, W: { l: [G.hx, G.wristH, G.zc - 0.02 * sc], r: W0 } };
      // the hand goes to in front of her own risen shoulder and a little over it, the elbow kept low (an arm thrown straight out past the head from a trunk this far over is past where a shoulder's twist can be shared out)
      const Sr = homeOf(rig, allFours(rig, body, set, o, G)).shoulder.r, tg = [Sr[0] + 0.07 * sc, Sr[1] + 0.13 * sc + 0.012 * sh, Sr[2] + 0.31 * sc];
      o.W = { l: o.W.l }; o.arms = { r: { hand: bez(W0, [W0[0] - 0.05 * sc, G.wristH + 0.12 * sc, W0[2] + 0.1 * sc], tg, a), pole: turnV([-0.35, 0.1, -1], [-0.45, -0.85, 0.1], sm(0, 1, a)), handQ: Q.slerp(flat, claw, sm(0, 0.6, a)), curl: 0.78 * a, thumbFlat: 1 - a, free: true } };
      return allFours(rig, body, set, o, G); };
    // how far the trunk can rise with the other hand still on the floor
    frame.rise = 30 * DEG; for (; frame.rise > 6 * DEG; frame.rise -= 2 * DEG) if ((homeOf(rig, frame(1, 0)).info.armReach_l || 0) < 0.975) break;
    const ctrl = f => { const t = f / FPS, s = sm2(t0, tp, t), r = sm2(th, T - 0.1, t), e = sm(tp, tp + 0.05, t) * (1 - sm(th - 0.12, th + 0.04, t)); return frame(s * (1 - r), (1 - sm(0, t0 + 0.06, t)), e * Math.sin(TAU * 12 * t)); };
    const pk = homeOf(rig, ctrl(Math.round(tp * FPS)));
    out.push(made("scare_claw", T, ctrl, tp, th, knuckles(rig, pk.info, "r")[2], { from: "crawl" })); }
  return out;
}

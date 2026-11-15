// Animations v3: fights (docs/ANIMATOR_V3.md §5): a punch, a swing of whatever she holds, being hit. The clips throw
// the blow straight ahead of her at her own shoulder's height and say where it lands from where she stands
// (meta.punch.at: her knuckles; meta.swing.at: her palm, and `axis`: the way a thing held in that fist points); in
// Godot she is turned to who she's hitting and the arm's IK carries it the rest of the way (HSHandIK).
import { V, Q, DEG, clamp, lerp, sm, sm2, hump } from "./m.js";
import { params, FPS } from "./gait.js";
import { stance, basePose, homeOf, armTo, mixA, turnV } from "./acts.js";
import { standing, knuckles } from "./acting.js";

const r3 = v => v.map(x => +x.toFixed(3));

/** { punch, swing, hit_react }: with the right hand (mirrored: the left) */
export function fighting(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), sc = p.sc, arm = body.upper + body.fore, slow = clamp(1 + 0.18 * p.heavy + 0.15 * p.weak - 0.1 * p.strong, 0.85, 1.5), out = [];
  const hipY = body.hipY + body.floor;
  // ---- the punch: the guard up, the shoulder back, the fist out with the chest and the hips turning into it -------------
  { const g1 = 0.28 * slow, w1 = 0.4 * slow, th = 0.58 * slow, r1 = 0.88 * slow, T = 1.55 * slow, n = Math.round(T * FPS) + 1;
    const ctrl = f => { const t = f / FPS, G = sm2(0.02, g1, t) * (1 - sm2(r1 + 0.05, T - 0.1, t)), W = sm(g1 - 0.06, w1, t) * (1 - sm(w1, th, t)), K = sm2(w1 + 0.02, th, t) * (1 - sm2(th + 0.07, r1, t));
      const yaw = (-10 * G - 14 * W + 36 * K) * DEG;
      const c = standing(rig, body, p, S, base, { k: sm(0, 0.4, G), fwd: (0.02 * G - 0.025 * W + 0.09 * K) * sc, down: (0.035 * G + 0.012 * K) * sc, pitch: (4 * G + 5 * K) * DEG, yaw, pyaw: (-5 * G - 4 * W + 14 * K) * DEG, look: [2 * DEG * G, -0.62 * yaw], squat: G,
        feet: { r: { pitch: -24 * DEG * K } } });
      c.clav = { l: { up: 8 * DEG * G }, r: { up: 8 * DEG * G, fwd: 14 * DEG * K } };
      const home = homeOf(rig, c), Sr = home.shoulder.r, Sl = home.shoulder.l;
      const guardR = [Sr[0] + 0.075 * sc, Sr[1] + 0.03 * sc, Sr[2] + (0.17 - 0.05 * W) * sc], x = -0.035 * sc, dy = -0.015 * sc, hit = [x, Sr[1] + dy, Sr[2] + Math.sqrt(Math.max(0.01, (0.965 * arm) ** 2 - (Sr[0] - x) ** 2 - dy * dy))];
      c.arms.r = armTo(home, "r", mixA(guardR, hit, K), G, { palm: V.norm(mixA([0.9, 0.1, -0.3], [0.1, -1, 0.05], K)), pole: V.norm(mixA([-0.3, -0.9, -0.2], [-0.75, -0.55, -0.3], K)), curl: 1.3, wrist: 0, via: [Sr[0] - 0.03 * sc, Sr[1] - 0.3 * sc, Sr[2] + 0.16 * sc] });
      c.arms.l = armTo(home, "l", [Sl[0] - 0.065 * sc, Sl[1] + (0.045 + 0.02 * K) * sc, Sl[2] + (0.22 - 0.07 * K) * sc], G, { palm: [-0.9, 0.1, -0.3], pole: [0.3, -0.9, -0.2], curl: 1.3, via: [Sl[0] + 0.03 * sc, Sl[1] - 0.3 * sc, Sl[2] + 0.16 * sc] });
      return c; };
    const h = homeOf(rig, ctrl(Math.round(th * FPS))), at = knuckles(rig, h.info, "r");
    out.push({ name: "punch", loop: false, n, fps: FPS, secs: (n - 1) / FPS, ctrl, events: [{ t: th, name: "hit" }], meta: { punch: { hand: "r", at: r3(at), reach: +at[2].toFixed(3) } } }); }
  // ---- the swing: the hand up behind the shoulder, then over the top and down through what's in front of her, and across --
  { const u1 = 0.5 * slow, f1 = 0.94 * slow, th = u1 + 0.02 + 0.613 * (f1 - u1 - 0.02), T = 2.0 * slow, n = Math.round(T * FPS) + 1;   // (the hit two thirds of the way through the blow: where the path's third point is)
    // a smooth curve through points, u counted in points (Catmull-Rom)
    const through = (P, u) => { const i = clamp(Math.floor(u), 0, P.length - 2), t = u - i, a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(P.length - 1, i + 2)];
      return b.map((_, k) => 0.5 * (2 * b[k] + (c[k] - a[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t + (3 * b[k] - a[k] - 3 * c[k] + d[k]) * t * t * t)); };
    const ctrl = f => { const t = f / FPS, w = sm2(0.03, u1, t), K = sm(u1 + 0.02, f1, t), R = sm2(f1 + 0.06, T - 0.1, t), on = 1 - R, yaw = (-34 * w + 66 * K) * on * DEG;
      const c = standing(rig, body, p, S, base, { k: sm(0, 0.5, w) * on, fwd: (-0.04 * w + 0.13 * K) * sc * on, down: 0.03 * sc * K * on, pitch: (-4 * w + 20 * K) * on * DEG, yaw, pyaw: 0.36 * yaw, look: [3 * DEG * K * on, -0.62 * yaw], squat: K * on,
        feet: { r: { pitch: -26 * DEG * K * on } } });
      c.arms.l = { ...S.arm, flex: S.arm.flex + (22 * w - 30 * K) * on * DEG, abd: S.arm.abd + 10 * DEG * w * on, elbow: S.arm.elbow + 25 * DEG * w * on };
      const home = homeOf(rig, c), Sr = home.shoulder.r, near = (P, lo = 0.5) => { const d = V.sub(P, Sr), l = V.len(d), want = clamp(l, lo * arm, 0.95 * arm); return V.mad(Sr, d, want / (l || 1)); };   // (never further than the arm is long, never folded flat against the shoulder)
      // The hand's way: up behind her shoulder (wound up), over the top, out and down in front of her own shoulder to
      // her chest's height (where it lands: the arm nearly straight, pointing ahead and down), then down across to her
      // other hip.
      const P0 = near([Sr[0] - 0.09 * sc, Sr[1] + 0.2 * sc, Sr[2] - 0.1 * sc]), Pt = near([Sr[0] - 0.03 * sc, Sr[1] + 0.33 * sc, Sr[2] + 0.17 * sc]), P1 = near([Sr[0], Sr[1] - 0.6 * arm, Sr[2] + 0.74 * arm]), P2 = near([0.13 * sc, hipY + 0.26 * sc, c.pelvis.pos[2] + 0.24 * sc]);
      const tg = near(through([P0, Pt, P1, P2], 3 * K)), q = K * 1.5;
      // the palm to her own middle all the way, as a hand holds a hammer; the elbow out to her side until it has landed, then let down
      const palm = q < 1 ? turnV([0.95, 0.1, 0.25], [0.97, -0.1, -0.2], sm(0, 1, q)) : turnV([0.97, -0.1, -0.2], [0.8, -0.5, -0.3], sm(1, 1.5, q));
      const pole = q < 1 ? turnV([-1, -0.1, 0.1], [-0.92, -0.3, -0.2], sm(0.3, 1, q)) : turnV([-0.92, -0.3, -0.2], [-0.6, -0.7, -0.3], sm(1, 1.5, q));   // (as it lands the elbow is out to her side, not under the arm: under it, the forearm points up at the hand and what the fist holds stands up with it)
      // What the fist holds stands out of its thumb side, square to the forearm: back over her shoulder while the
      // forearm is up (wound up), up as it comes over the top, ahead and up as the forearm comes down in front of her.
      // The wrist does the rest: tipped a little toward the thumb wound up, and toward the little finger as it lands
      // (`dev`, and a little past what a wrist gives alone: a handle lies slanted across a palm, not square to it),
      // which is what brings a bat's end down onto what's in front of her, about level.
      // (The fist's turn was first given outright, with what it held 55 degrees up as it landed, then level with the
      //  forearm level too. A hand can't hold a hammer along its own forearm: the forearm's twist bones went half a
      //  turn in a frame trying. And in the game a bat's end 55 degrees up was half a metre over who it was swung at:
      //  the hand IK made up for it by pointing the bat at them early and dragging her hand down to her hip.)
      c.arms.r = armTo(home, "r", tg, w * on, { palm, pole, curl: 1.2, wrist: 0, via: [Sr[0] - 0.36 * sc, Sr[1] - 0.12 * sc, Sr[2] + 0.1 * sc] });   // (up round the outside: a hand brought up past its own shoulder folds the arm flat)
      c.arms.r.dev = (-0.14 + 0.89 * sm(0.3, 1, q)) * w * on;
      return c; };
    const h = homeOf(rig, ctrl(Math.round(th * FPS))), at = knuckles(rig, h.info, "r"), axis = V.norm(V.cross(h.info.handDir_r, h.info.palm_r));
    out.push({ name: "swing", loop: false, n, fps: FPS, secs: (n - 1) / FPS, ctrl, events: [{ t: th, name: "hit" }], meta: { swing: { hand: "r", at: r3(at), axis: r3(axis), reach: +at[2].toFixed(3) } } }); }
  // ---- hit from in front: the trunk and the head thrown back, a step to catch it, upright again -------------------------
  { const T = 1.4 * slow, n = Math.round(T * FPS) + 1;
    const ctrl = f => { const t = f / FPS, back = sm(0, 0.12, t) * (1 - sm2(0.45 * slow, T - 0.1, t)), hp = 12 * hump(0, 0.2, t) - 24 * hump(0.1, 0.6 * slow, t), fl = hump(0, 0.65 * slow, t);
      const st = sm2(0.08, 0.34, t) * (1 - sm2(0.62 * slow, T - 0.15, t)), lift = 0.045 * sc * (hump(0.08, 0.34, t) + hump(0.62 * slow, T - 0.15, t));
      const c = standing(rig, body, p, S, base, { k: sm(0, 0.15, t) * (1 - sm2(0.5 * slow, T - 0.05, t)), fwd: -0.075 * sc * back, down: 0.02 * sc * back, pitch: -17 * DEG * back, yaw: 8 * DEG * back, look: [(hp + 8.5 * back) * DEG, -5 * DEG * back],
        feet: { r: { dz: -0.24 * sc * st, lift } } });
      for (const s of ["l", "r"]) c.arms[s] = { ...S.arm, abd: S.arm.abd + 20 * DEG * fl, flex: S.arm.flex + 22 * DEG * fl, elbow: S.arm.elbow + 30 * DEG * fl };
      return c; };
    out.push({ name: "hit_react", loop: false, n, fps: FPS, secs: (n - 1) / FPS, ctrl, events: [], meta: {} }); }
  return out;
}

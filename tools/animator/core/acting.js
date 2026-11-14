// Animations v3: small acts stood where she is (docs/ANIMATOR_V3.md §2): a peek round a wall's edge, a hand that holds
// something brought to the mouth to eat or drink, a look round, a knock on a door, cowering. Made as the Animator's
// other acts are (acts.js): the standing body leant into what the act needs, a hand taken somewhere by its wrist and
// brought back to where it hangs. Each starts and ends in the idle's first pose, except where a loop holds a pose in
// between (peek_out ends as peek_loop leans; peek_back starts there).
import { V, Q, DEG, clamp, lerp, sm, sm2, hump, rx, ry, rz } from "./m.js";
import { ankleAt } from "./pose.js";
import { params, FPS } from "./gait.js";
import { stance, basePose, homeOf, armTo, leanFrame, pelvisY, mixA, bez } from "./acts.js";

const TAU = 2 * Math.PI, r3 = v => v.map(x => +x.toFixed(3));

/** a standing frame (acts.js leanFrame: the idle's feet, the pelvis and the chest leant) with feet that step.
    a.feet: { l|r: { dx, dz, lift, pitch (toes up; below 0: the heel up, on the ball), yaw } } from where the idle has
    them. The pelvis is never higher than both legs reach. */
export function standing(rig, body, p, S, base, a) {
  const c = leanFrame(rig, body, p, S, base, a), F = body.foot, aH = body.ankleH;
  for (const s of ["l", "r"]) { const f = (a.feet || {})[s]; if (!f) continue; const L = c.legs[s], yaw = L.yaw + (f.yaw || 0), pitch = f.pitch || 0;
    L.ankle = ankleAt(F, aH, [L.ankle[0] + (f.dx || 0), f.lift || 0, L.ankle[2] + (f.dz || 0)], yaw, pitch); L.yaw = yaw; L.pitch = pitch; L.toe = pitch < 0 ? Math.min(-pitch, 0.95) * (f.lift ? 0.4 : 1) : 0; }
  if (a.proll) c.pelvis.roll += a.proll; if (a.pyaw != null) c.pelvis.yaw = base.c.pelvis.yaw * (1 - (a.k ?? 1)) + a.pyaw;
  const at = [c.pelvis.pos[0], c.pelvis.pos[2]], turn = Q.mul(ry(c.pelvis.yaw || 0), Q.mul(rz(c.pelvis.roll || 0), rx(c.pelvis.pitch || 0)));
  const cap = Math.min(pelvisY(rig, body, c.legs.l.ankle, at, 1, 1.5 * DEG, turn), pelvisY(rig, body, c.legs.r.ankle, at, -1, 1.5 * DEG, turn));   // (with the knees all but straight: the idle itself stands under it)
  if (c.pelvis.pos[1] > cap) c.pelvis.pos[1] = cap;
  if (a.head) { if (a.head.roll != null) c.head.roll = (c.head.roll || 0) + a.head.roll; if (a.neck != null) c.neck = a.neck; }
  return c;
}
/** where her mouth is in a solved pose (between the lips): from the teeth's bone, else from the head's */
export function mouthOf(rig, solved) {
  const P = solved.P, at = j => [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]], h = rig.head, D = solved.D[h], t = rig.ix.get("c_teeth"), size = rig.headTop >= 0 ? V.dist(rig.J[h].at, rig.J[rig.headTop].at) / 0.187 : 1;
  return t != null ? V.add(at(t), Q.rot(D, [0, 0.003 * size, 0.045 * size])) : V.add(at(h), Q.rot(D, [0, 0.017 * size, 0.086 * size]));
}
// a hand's knuckles in a built pose (the middle of the fist's front)
export const knuckles = (rig, info, s) => V.mad(info["wristAt_" + s], info["handDir_" + s], 0.5 * rig.arm(s).handLen);
const clipOf = (name, n, ctrl, events, meta, loop = false) => ({ name, loop, n, fps: FPS, secs: (loop ? n : n - 1) / FPS, ctrl, events, meta });

// ---- a peek round a wall's edge ---------------------------------------------------------------------------------------
/** { peek_out, peek_loop, peek_back }: she stands hidden behind the end of a wall that's in front of her, its edge to
    her right (meta.peek.edge, from where she stands), and leans out past it to her right, her right hand on the
    edge. Mirrored: to her left. */
export function peeking(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), sc = p.sc, shY = body.shoulderY + body.floor;
  const xe = -(body.shoulderHalf + 0.085 * sc), zw = 0.2 * sc, edge = [xe, 0, zw];
  const frame = (u, o = {}) => {                              // u: 0 stood behind it .. 1 leant out
    const c = standing(rig, body, p, S, base, { k: sm(0, 0.35, u), side: -0.105 * sc * u, fwd: 0.02 * sc * u, down: 0.035 * sc * u, pitch: (7 * u + (o.dp || 0)) * DEG, yaw: -7 * DEG * u, roll: (27 * u + (o.lean || 0)) * DEG,
      proll: 7 * DEG * u, look: [(2 + (o.hp || 0)) * DEG * u, (-6 + (o.hy || 0)) * DEG * u], head: { roll: (15 + (o.tilt || 0)) * DEG * u }, feet: { l: { pitch: -16 * DEG * u } }, squat: 0.4 * u });
    c.breath = o.breath || 0;
    const home = homeOf(rig, c), wob = o.hand || [0, 0, 0];
    c.arms.r = armTo(home, "r", [xe - 0.03 * sc + wob[0], shY - 0.03 * sc + wob[1], zw - 0.075 * sc + wob[2]], sm2(0.05, 0.8, u), { palm: [1, 0, 0.15], pole: [-0.5, -0.8, -0.35], curl: 0.66, wrist: -8 * DEG, via: [xe + 0.06 * sc, shY - 0.3 * sc, zw - 0.1 * sc] });   // (her palm on the wall's end, the fingers round its front)
    c.arms.l = armTo(home, "l", [0.07 * sc, shY - 0.21 * sc, zw - 0.045 * sc], sm2(0.2, 1, u) * 0.999, { palm: [0, 0.1, 1], pole: [0.75, -0.6, -0.3], curl: 0.2, wrist: -30 * DEG });
    return c; };
  const To = clamp(1.15 - 0.2 * p.pw + 0.25 * p.heavy, 0.8, 1.7), no = Math.round(To * FPS) + 1, Tb = clamp(0.95 - 0.1 * p.pw + 0.2 * p.heavy, 0.8, 1.4), nb = Math.round(Tb * FPS) + 1, Nl = 6 * FPS;
  const out = f => frame(sm2(0.04, 0.96, f / (no - 1)) * (0.94 + 0.06 * sm(0.5, 1, f / (no - 1)))), back = f => frame(1 - sm2(0, 0.9, f / (nb - 1)));
  const hold = f => { const t = (f % Nl) / FPS, b = Math.sin(TAU * t / 3), w = Math.sin(TAU * t / 6); return frame(1, { breath: b, lean: 1.2 * w, dp: 0.6 * b, tilt: 3 * Math.sin(TAU * t / 6 + 1), hy: 3 * w, hand: [0, 0.002 * b, 0] }); };
  const head = (() => { const P = homeOf(rig, frame(1)).pose.solve().P, j = rig.head; return r3([P[j * 3], P[j * 3 + 1], P[j * 3 + 2]]); })();
  const meta = { peek: { side: "r", edge: r3(edge), head } };
  return [clipOf("peek_out", no, out, [{ t: 0.82 * To, name: "out" }], meta), clipOf("peek_loop", Nl, hold, [], meta, true), clipOf("peek_back", nb, back, [{ t: 0.62 * Tb, name: "hidden" }], meta)];
}

// ---- a hand that holds something, to the mouth ----------------------------------------------------------------------------
/** { eat, drink }: the right hand (mirrored: the left) brought up to the mouth and down again. What it holds is the
    game's: these put the hand where a small thing held in a fist would meet the lips, and say where (meta.eat.at,
    meta.eat.mouth, from where she stands); in Godot the hand is then brought the rest of the way for the thing
    that's really in it (HSHandIK). eat: two bites with the hand lowered between; drink: one long sip, the head back. */
export function mouthing(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), sc = p.sc, slow = 1 + 0.15 * p.heavy + 0.15 * p.weak - 0.08 * p.strong;
  // where the wrist goes: so a fist's top is at the lips (the mouth read off the pose it's in)
  const wristFor = (c, up) => { const m = mouthOf(rig, homeOf(rig, c).pose.solve()); return [m[0] - 0.045 * sc, m[1] - (0.105 - 0.03 * up) * sc, m[2] + (0.085 - 0.012 * up) * sc]; };
  const body_ = (k, o = {}) => { const c = leanFrame(rig, body, p, S, base, { k: sm(0, 1, k), pitch: (o.pitch || 0) * DEG, yaw: -3 * DEG * k, look: [(o.hp || 0) * DEG, (o.hy || 0) * DEG] }); c.breath = 0; return c; };
  const arm = (c, k, up, o = {}) => { const home = homeOf(rig, c), to = wristFor(c, up), rest = [home.shoulder.r[0] + 0.02 * sc, home.shoulder.r[1] - 0.3 * sc, home.shoulder.r[2] + 0.2 * sc], at = o.low ? mixA(to, rest, o.low) : to;
    c.arms.r = armTo(home, "r", at, k, { palm: [0.8, 0.12 + 0.3 * up, -0.58], pole: [-0.55, -0.8, -0.2], curl: 1.05, wrist: (6 + 16 * up) * DEG, via: [home.shoulder.r[0] - 0.02 * sc, home.shoulder.r[1] - 0.36 * sc, home.shoulder.r[2] + 0.22 * sc] }); return c; };
  // eat
  const Te = 4.3 * slow, t1 = 0.75 * slow, b1 = 0.86 * slow, d1 = 1.15 * slow, t2 = 2.3 * slow, b2 = 2.86 * slow, d2 = 3.15 * slow, ne = Math.round(Te * FPS);
  const eat = f => { const t = f / FPS, up = sm2(0.06, t1, t) * (1 - sm2(d2, Te - 0.15, t)), low = 0.55 * sm2(d1, d1 + 0.45 * slow, t) * (1 - sm2(t2, b2 - 0.1, t)), chew = sm(d1, d1 + 0.3, t) * (1 - sm(t2 - 0.2, t2, t)) + sm(d2, d2 + 0.3, t) * (1 - sm(Te - 0.5, Te - 0.2, t));
    const bite = hump(b1 - 0.2, b1 + 0.2, t) + hump(b2 - 0.2, b2 + 0.2, t), c = body_(up, { pitch: 2 * up + 4 * bite, hp: 7 * bite + 1.6 * chew * Math.sin(TAU * 2.4 * t), hy: -4 * up });
    return arm(c, up, 0.25 * bite, { low }); };
  // drink
  const Td = 3.5 * slow, s1 = 0.8 * slow, s2 = 1.0 * slow, s3 = 2.0 * slow, nd = Math.round(Td * FPS);
  const drink = f => { const t = f / FPS, up = sm2(0.06, s1, t) * (1 - sm2(s3 + 0.1, Td - 0.15, t)), tip = sm2(s1 - 0.1, s2 + 0.35, t) * (1 - sm2(s3 - 0.25, s3 + 0.15, t)), gulp = tip * Math.sin(TAU * 1.5 * (t - s2));
    return arm(body_(up, { pitch: -3 * tip, hp: -15 * tip + 0.8 * gulp, hy: -3 * up }), up, tip); };
  const at = (fn, f) => { const c = fn(f), h = homeOf(rig, c); return { at: r3(c.arms.r.hand), mouth: r3(mouthOf(rig, h.pose.solve())) }; };
  return [clipOf("eat", ne, eat, [{ t: b1, name: "bite" }, { t: b2, name: "bite" }, { t: d2 + 0.1, name: "done" }], { eat: { hand: "r", ...at(eat, Math.round(b1 * FPS)) } }),
    clipOf("drink", nd, drink, [{ t: s2, name: "sip" }, { t: s3, name: "done" }], { eat: { hand: "r", ...at(drink, Math.round((s2 + 0.4) * FPS)) } })];
}

// ---- looking round, a knock, cowering ---------------------------------------------------------------------------------------
/** { look_around }: the head, and the chest after it, turned to her left, held, to her right, held, and back */
export function lookAround(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), slow = 1 + 0.15 * p.heavy + 0.1 * p.weak, T = 4.6 * slow, n = Math.round(T * FPS);
  const a1 = 0.25 * slow, a2 = 1.0 * slow, h1 = 1.7 * slow, b2 = 2.9 * slow, h2 = 3.6 * slow, e = T - 0.15;
  const ctrl = f => { const t = f / FPS, L = sm2(a1, a2, t) * (1 - sm2(h1, b2, t)), R = sm2(h1, b2, t) * (1 - sm2(h2, e, t)), yaw = (56 * L - 60 * R) * DEG, k = Math.max(L, R);
    const c = leanFrame(rig, body, p, S, base, { k: sm(0, 0.5, k), yaw: 0.3 * yaw, pitch: 2 * DEG * k, look: [(5 * k) * DEG, 0.82 * yaw] }); c.pelvis.yaw += 0.08 * yaw; c.head.roll = (c.head.roll || 0) + 0.06 * yaw; return c; };
  return [clipOf("look_around", n, ctrl, [{ t: a2, name: "left" }, { t: b2, name: "right" }], {})];
}
/** { knock }: the right fist raised to a door in front of her and rapped on it three times (meta.knock.at: where the
    knuckles land, from where she stands; a `knock` event at each) */
export function knocking(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), sc = p.sc, slow = 1 + 0.15 * p.heavy + 0.12 * p.weak - 0.06 * p.strong, shY = body.shoulderY + body.floor, arm = body.upper + body.fore;
  const T = 2.5 * slow, up = 0.62 * slow, raps = [0.78, 1.05, 1.32].map(x => x * slow), dn = 1.55 * slow, n = Math.round(T * FPS), zd = Math.min(0.42 * sc, 0.8 * arm), tgt = [-0.07 * sc - body.shoulderHalf * 0.35, shY - 0.05 * sc, zd];
  const ctrl = f => { const t = f / FPS, k = sm2(0.06, up, t) * (1 - sm2(dn, T - 0.12, t)); let back = 1; for (const r of raps) back = Math.min(back, clamp(Math.abs(t - r) / 0.1, 0, 1) ** 0.7);   // (0 at each rap: the fist on the door)
    const c = leanFrame(rig, body, p, S, base, { k: sm(0, 0.6, k), pitch: 3 * DEG * k, fwd: 0.015 * sc * k, yaw: -5 * DEG * k, look: [3 * DEG * k, -3 * DEG * k] }), home = homeOf(rig, c);
    c.arms.r = armTo(home, "r", [tgt[0], tgt[1] + 0.012 * sc * back, tgt[2] - (0.075 * sc + 0.055 * sc * back * k)], k, { palm: [0.75, -0.6, 0.1], pole: [-0.6, -0.75, -0.25], curl: 1.25, wrist: (-18 + 14 * back) * DEG });
    return c; };
  const hit = (() => { const c = ctrl(Math.round(raps[0] * FPS)), h = homeOf(rig, c); return r3(knuckles(rig, h.info, "r")); })();
  return [clipOf("knock", n, ctrl, raps.map(r => ({ t: r, name: "knock" })), { knock: { hand: "r", at: hit } })];
}
/** { cower_loop }: crouched small, turned a little away, the forearms up over the head, trembling. 4 s. */
export function cowering(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), sc = p.sc, N = 4 * FPS;
  const ctrl = f => { const t = (f % N) / FPS, b = Math.sin(TAU * t / 2), tr = Math.sin(TAU * 8 * t) * (0.6 + 0.4 * Math.sin(TAU * t / 4)), tr2 = Math.sin(TAU * 8 * t + 1.7);
    const c = leanFrame(rig, body, p, S, base, { k: 1, down: (0.2 + 0.008 * b) * sc, pitch: (36 + 1.2 * b + 0.5 * tr) * DEG, fwd: -0.07 * sc, yaw: -14 * DEG, roll: (4 + 0.4 * tr2) * DEG, squat: 1, look: [(16 + 0.5 * tr) * DEG, -12 * DEG] });
    c.breath = b; c.clav = { l: { up: 14 * DEG, fwd: 10 * DEG }, r: { up: 14 * DEG, fwd: 10 * DEG } };
    const home = homeOf(rig, c), P = home.pose.solve().P, hj = rig.head, hd = [P[hj * 3], P[hj * 3 + 1], P[hj * 3 + 2]], hq = home.pose.solve().D[hj], pt = (x, y, z) => V.add(hd, Q.rot(hq, [x * sc, y * sc, z * sc]));
    for (const [s, g] of [["l", 1], ["r", -1]]) c.arms[s] = armTo(home, s, V.add(pt(g * 0.085, 0.115, 0.12 + (g > 0 ? 0.02 : 0)), [0.002 * tr2, 0.003 * tr, 0]), 1, { palm: Q.rot(hq, [0, 0.5, 0.85]), pole: Q.rot(hq, [g * 0.55, -0.55, 0.6]), curl: 0.5, wrist: -10 * DEG });
    return c; };
  return [clipOf("cower_loop", N, ctrl, [], {}, true)];
}

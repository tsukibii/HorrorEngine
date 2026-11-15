// Animations v3: small acts stood where she is (docs/ANIMATOR_V3.md §2): a peek round a wall's edge, a hand that holds
// something brought to the mouth to eat or drink, a look round, a knock on a door, cowering. Made as the Animator's
// other acts are (acts.js): the standing body leant into what the act needs, a hand taken somewhere by its wrist and
// brought back to where it hangs. Each starts and ends in the idle's first pose, except where a loop holds a pose in
// between (peek_out ends as peek_loop leans; peek_back starts there).
import { V, Q, DEG, clamp, lerp, sm, sm2, hump, rx, ry, rz } from "./m.js";
import { ankleAt } from "./pose.js";
import { params, FPS } from "./gait.js";
import { stance, basePose, homeOf, armTo, leanFrame, pelvisY, mixA, bez } from "./acts.js";
import { handDrop } from "./quad.js";

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
// A hand's and a head's own size against a person's of the body's size (1 on a person, and never under the body's own
// scale): where a wrist goes beside a mouth, on a wall's end or over a head is by the hand that's on it and the head
// it's beside. An ogre's hand is half as big again as its height makes it, a goblin's head and ears nearly twice
export const handScale = (rig, sc) => Math.max(sc, rig.armL.handLen / 0.175);
export const headScale = (body, sc) => [Math.max(sc, body.headR[0] / 0.088), Math.max(sc, body.headR[1] / 0.112), Math.max(sc, body.headR[2] / 0.103)];
// a hand's knuckles in a built pose (the middle of the fist's front)
export const knuckles = (rig, info, s) => V.mad(info["wristAt_" + s], info["handDir_" + s], 0.5 * rig.arm(s).handLen);
// A hand laid flat on something upright: its own turn in the world (pose.js handQ). `along`: the way its fingers point,
// in the surface; `into`: the way into the surface, which the palm faces; `tilt`, degrees: the fingers tipped toward
// it from the wrist (the heel of a hand is thicker than its fingers), as a hand planted on the floor's are
const laid = (rig, s, along, into, tilt = 8) => { const A = rig.arm(s), d = tilt * DEG, n0 = V.norm(into), f0 = V.norm(V.perp(along, n0));
  return Q.frame(A.handDir, A.palm0, V.add(V.mul(f0, Math.cos(d)), V.mul(n0, Math.sin(d))), V.sub(V.mul(n0, Math.cos(d)), V.mul(f0, Math.sin(d)))); };
const clipOf = (name, n, ctrl, events, meta, loop = false) => ({ name, loop, n, fps: FPS, secs: (loop ? n : n - 1) / FPS, ctrl, events, meta });

// ---- a peek round a wall's edge ---------------------------------------------------------------------------------------
/** { peek_out, peek_loop, peek_back }: she stands hidden behind the end of a wall that's in front of her, its edge to
    her right (meta.peek.edge, from where she stands), and leans out past it to her right, her right hand on the
    edge. Mirrored: to her left. */
export function peeking(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), sc = p.sc, shY = body.shoulderY + body.floor, arm = body.upper + body.fore;
  // The wall stands clear of her front as she stands: her face, her chest, her belly, her fingertips as her hands
  // hang (an ogre's hang ahead of its belly, and are 41 cm long). On a person that's a hand's
  // breadth past her toes; a hunched creature's face is a foot ahead of its feet (a hag's, a ghoul's), and a wall
  // put by her height alone stood inside its head
  const P0 = base.pose.solve().P, face = P0[rig.head * 3 + 2] + (body.headC[2] + body.headR[2] - rig.J[rig.head].at[2]), tips = Math.max(...[rig.armL, rig.armR].flatMap(A => A.fingers.flat().flatMap(j => [j, ...rig.J[j].kids])).map(j => P0[j * 3 + 2])), front = Math.max(face, tips, ...body.slabs.map(s => s.zf));
  const hang = Math.max(P0[rig.armL.hand * 3 + 2], P0[rig.armR.hand * 3 + 2]) + 0.62 * rig.armL.handLen;   // (and of her hands turned any way where they hang: an ogre's wrists hang 15 cm behind where its belly put the wall, its hands 41 cm long)
  const xe = -(body.shoulderHalf + 0.085 * sc), zw = Math.max(0.2 * sc, front + 0.03 * sc, hang), edge = [xe, 0, zw];
  const lean = (u, o = {}) => { const c = standing(rig, body, p, S, base, { k: sm(0, 0.35, u), side: -0.105 * sc * u, fwd: 0.02 * sc * u, down: 0.035 * sc * u, pitch: (7 * u + (o.dp || 0)) * DEG, yaw: -7 * DEG * u, roll: (27 * u + (o.lean || 0)) * DEG,
      proll: 7 * DEG * u, look: [(2 + (o.hp || 0)) * DEG * u, (-6 + (o.hy || 0)) * DEG * u], head: { roll: (15 + (o.tilt || 0)) * DEG * u }, feet: { l: { pitch: -16 * DEG * u } }, squat: 0.4 * u });
    c.breath = o.breath || 0; return c; };
  // Her hands are laid on the wall, their own turn given outright as a hand planted on the floor's is (quad.js planted,
  // pose.js handQ), each wrist as far off the wall as the hand's deepest finger joint (handDrop: a ghoul's fingers are
  // half as long again as its size makes them). They were first taken there by the arm's own rules, which carry a hand
  // on the way its forearm points: the right hand's fingers went on behind the wall, and the left, put in front of her
  // chest with her forearm pointing at the wall, went into it: a person's fingertips 11 cm past its back, hidden in a
  // wall that thick and through a thinner one; a ghoul's 21 cm, out of the other side on the mesh.
  // The right hand on the wall's end, under her face: the palm to it, the fingers up and forward along it (seen from
  // in front, a hand round the wall's end beside her face), the heel of the hand behind the wall's back. The elbow
  // hangs under her shoulder, behind the hand, so the forearm comes up to the wrist the way the fingers go on.
  // The end is a line up the wall, so how high the hand is on it is free: it's put below her shoulder as she leans, as
  // far from it as leaves the arm half bent (0.48 of its length: a long arm's hand ends lower down the wall). It was
  // first at her shoulder's own height, which is where her face comes out: on the mesh she stood with her cheek on
  // her hand.
  const hs = handScale(rig, sc), off = Math.max(0.028 * sc, handDrop(rig, { tilt: 8, curl: 0.1 }) - 0.003 * sc), S1 = homeOf(rig, lean(1)).shoulder;
  const hx = xe - off, hz = zw - 0.075 * hs, flat = Math.hypot(hx - S1.r[0], hz - S1.r[2]), hy = S1.r[1] - Math.sqrt(Math.max((0.2 * arm) ** 2, (0.48 * arm) ** 2 - flat * flat));
  const onEnd = laid(rig, "r", [0, Math.sin(35 * DEG), Math.cos(35 * DEG)], [1, 0, 0]);
  // The left hand flat on the wall's back, up beside her left shoulder as she leans, its fingers up and a little
  // toward the wall's end; the elbow down under it, so the forearm stands along the wall and the wrist is hardly bent
  const dz = zw - off - S1.l[2], rl = Math.sqrt(Math.max((0.2 * arm) ** 2, (0.45 * arm) ** 2 - dz * dz)), lw = [S1.l[0] + rl * Math.cos(20 * DEG), S1.l[1] + rl * Math.sin(20 * DEG), zw - off];
  const onBack = laid(rig, "l", [-0.25, 0.97, 0], [0, 0, 1]);
  // Kept out of the wall on their way. Until a hand has turned flat it points the way its forearm does, and a wrist
  // within a hand's length of the wall then has its fingers in it (the left hand's 10 cm on a person and 31 on an
  // ogre, half way through the lean). Where a frame's hand is found in the wall its wrist is put back out by as much:
  // the left's off the wall's back, the right's off whichever of the wall's back and its end it's nearer under. A
  // fingertip's own joint may be `press` in: the pad of a finger pressed on it
  const press = 0.006 * hs, hand = Object.fromEntries(["l", "r"].map(s => { const A = rig.arm(s), js = [A.hand]; for (const ch of A.fingers) for (const j of ch) { js.push(j); for (const k of rig.J[j].kids) js.push(k); } return [s, js]; }));
  const clear = c => { for (let it = 0; it < 4; it++) { const P = homeOf(rig, c).pose.solve().P; let moved = false;
      for (const s of ["l", "r"]) { let worst = 0, ax = 2;
        for (const j of hand[s]) { const x = P[j * 3] - xe, z = P[j * 3 + 2] - zw; if (x <= 0 || z <= 0) continue; const d = s === "l" ? z : Math.min(x, z); if (d > worst) { worst = d; ax = s === "l" || z < x ? 2 : 0; } }
        if (worst > press) { const W = c.arms[s].hand.slice(); W[ax] -= worst - 0.5 * press; c.arms[s].hand = W; moved = true; } }
      if (!moved) break; } return c; };
  const frame = (u, o = {}) => {                              // u: 0 stood behind it .. 1 leant out
    const c = lean(u, o), home = homeOf(rig, c), wob = o.hand || [0, 0, 0], on = sm(0.4, 0.95, u);   // (on: the hands turned flat to the wall as they get to it)
    // (the arm goes with the lean, all the way through it: sent in a burst in the middle of it, as it first was, the elbow swung round 27 degrees in a frame on a person and 37 on a ghoul's longer arm)
    const W0 = home.info.wristAt_r, via = [Math.min((W0[0] + hx) / 2, hx - 0.12 * hs), (W0[1] + hy) / 2 - 0.02 * sc, W0[2] + 0.35 * (hz - W0[2])];   // (up beside her and out past the wall's end first, then forward to it: a way that stays inside the arm's reach on any body)
    c.arms.r = { ...armTo(home, "r", [hx + wob[0], hy + wob[1], hz + wob[2]], sm(0.02, 0.9, u), { palm: [1, 0, 0.15], pole: [-0.16, -0.73, -0.66], curl: 0.12, via, near: 0.36 * arm }), handQ: onEnd, handK: on, thumbFlat: on };
    // (the left hand goes out to her side and up, the forearm swinging up along the wall: brought straight up in front of her, a forearm and a hand don't fit between her and the wall)
    const L0 = home.info.wristAt_l, SL = home.shoulder.l, viaL = [SL[0] + 0.85 * arm, SL[1] - 0.4 * arm, Math.min(SL[2] + 0.1 * arm, zw - rig.armL.handLen)];   // (and a hand's length back from the wall until it has turned flat to it)
    const kl = clamp(u / 0.97, 0, 1) * 0.999, PL = [0.3, -0.95, 0];   // (all the way through the lean, as the right arm goes: started a fifth of the way in and eased again, the forearm's swing up the wall was over in seven frames of coming back, the upper arm turning 36 degrees in one)
    c.arms.l = { ...armTo(home, "l", lw, kl, { palm: [0, 0.1, 1], pole: PL, curl: 0.1, via: viaL }), handQ: onBack, handK: on, thumbFlat: on };
    c.arms.l.curl = lerp(home.c.arms.l.curl ?? 0.45, 0.1, sm(0, 0.5, kl));   // (the fingers straightened before the palm has turned to the wall: curled, they point into it)
    return clear(c); };
  const long = clamp((arm / body.height - 0.31) / 0.08, 0, 1);  // (an arm long for the body it's on, a ghoul's, an ogre's, has further to fold away: it's given a little longer)
  const To = clamp(1.15 - 0.2 * p.pw + 0.25 * p.heavy, 0.8, 1.7) + 0.1 * long, no = Math.round(To * FPS) + 1, Tb = clamp(0.95 - 0.1 * p.pw + 0.2 * p.heavy, 0.8, 1.4) + 0.2 * long, nb = Math.round(Tb * FPS) + 1, Nl = 6 * FPS;
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
  // (`up`: 0 a bite, 1 a sip: the hand then comes up level with the mouth and further out in front of it, so what it holds lies tipped toward her and not stood under her chin)
  // (eating, nearer: the top of the fist at her lips. It was a hand's breadth under her mouth and as far out in front of it, for a thing that stands up out of the fist; on the mesh, with nothing in it, the fist stopped at her collarbone.
  //  With a thing in it the game's hand IK takes the hand back out as far as the thing is long)
  const hs = handScale(rig, sc), wristFor = (c, up, eat = 0) => { const m = mouthOf(rig, homeOf(rig, c).pose.solve());
    return [m[0] - (0.045 - 0.01 * eat) * hs, m[1] - (0.105 - 0.04 * up - 0.03 * eat) * hs, m[2] + (0.09 + 0.035 * up - 0.03 * eat) * hs]; };
  const body_ = (k, o = {}) => { const c = leanFrame(rig, body, p, S, base, { k: sm(0, 1, k), pitch: (o.pitch || 0) * DEG, yaw: -3 * DEG * k, look: [(o.hp || 0) * DEG, (o.hy || 0) * DEG] }); c.breath = 0; return c; };
  const arm = (c, k, up, o = {}) => { const home = homeOf(rig, c), to = wristFor(c, up, o.eat || 0), rest = [home.shoulder.r[0] + 0.02 * sc, home.shoulder.r[1] - 0.3 * sc, home.shoulder.r[2] + 0.2 * sc], at = o.low ? mixA(to, rest, o.low) : to;
    c.arms.r = armTo(home, "r", at, k, { palm: [0.8, 0.12 + 0.3 * up, -0.58], pole: [-0.55, -0.8, -0.2], curl: 1.05, wrist: (6 + 16 * up) * DEG, via: [home.shoulder.r[0] - 0.02 * sc, home.shoulder.r[1] - 0.36 * sc, home.shoulder.r[2] + 0.22 * sc] }); return c; };
  // eat
  const Te = 4.3 * slow, t1 = 0.75 * slow, b1 = 0.86 * slow, d1 = 1.15 * slow, t2 = 2.3 * slow, b2 = 2.86 * slow, d2 = 3.15 * slow, ne = Math.round(Te * FPS);
  const eat = f => { const t = f / FPS, up = sm2(0.06, t1, t) * (1 - sm2(d2, Te - 0.15, t)), low = 0.55 * sm2(d1, d1 + 0.45 * slow, t) * (1 - sm2(t2, b2 - 0.1, t)), chew = sm(d1, d1 + 0.3, t) * (1 - sm(t2 - 0.2, t2, t)) + sm(d2, d2 + 0.3, t) * (1 - sm(Te - 0.5, Te - 0.2, t));
    const bite = hump(b1 - 0.2, b1 + 0.2, t) + hump(b2 - 0.2, b2 + 0.2, t), c = body_(up, { pitch: 2 * up + 4 * bite, hp: 7 * bite + 1.6 * chew * Math.sin(TAU * 2.4 * t), hy: -4 * up });
    return arm(c, up, 0.25 * bite, { low, eat: 1 }); };
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
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), sc = p.sc, N = 4 * FPS, HK = headScale(body, sc);
  const ctrl = f => { const t = (f % N) / FPS, b = Math.sin(TAU * t / 2), tr = Math.sin(TAU * 8 * t) * (0.6 + 0.4 * Math.sin(TAU * t / 4)), tr2 = Math.sin(TAU * 8 * t + 1.7);
    const c = leanFrame(rig, body, p, S, base, { k: 1, down: (0.2 + 0.008 * b) * sc, pitch: (36 + 1.2 * b + 0.5 * tr) * DEG, fwd: -0.07 * sc, yaw: -14 * DEG, roll: (4 + 0.4 * tr2) * DEG, squat: 1, look: [(16 + 0.5 * tr) * DEG, -12 * DEG] });
    c.breath = b; c.clav = { l: { up: 14 * DEG, fwd: 10 * DEG }, r: { up: 14 * DEG, fwd: 10 * DEG } };
    const home = homeOf(rig, c), P = home.pose.solve().P, hj = rig.head, hd = [P[hj * 3], P[hj * 3 + 1], P[hj * 3 + 2]], hq = home.pose.solve().D[hj], pt = (x, y, z) => V.add(hd, Q.rot(hq, [x * HK[0], y * HK[1], z * HK[2]]));
    for (const [s, g] of [["l", 1], ["r", -1]]) c.arms[s] = armTo(home, s, V.add(pt(g * 0.085, 0.115, 0.12 + (g > 0 ? 0.02 : 0)), [0.002 * tr2, 0.003 * tr, 0]), 1, { palm: Q.rot(hq, [0, 0.5, 0.85]), pole: Q.rot(hq, [g * 0.55, -0.55, 0.6]), curl: 0.5, wrist: -10 * DEG });
    return c; };
  return [clipOf("cower_loop", N, ctrl, [], {}, true)];
}

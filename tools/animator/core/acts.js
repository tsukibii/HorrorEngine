// Animator v2: standing, sitting, lying down to sleep, opening a door, reaching for something (docs/ANIMATOR_V2.md
// §5b). Like the gaits, none is a recording: each is the body moved through what the act needs (the pelvis down and
// back onto a seat, the trunk leaning to keep the weight over the feet, a hand to a handle), timed and shaped by the
// same three sliders and the body's own measures: a strong body lowers itself and rises in one clean line, a weak or
// heavy one drops the last of the way, rocks, and pushes up off its thighs. Every act starts and ends in the idle's
// first pose, so a player can cross from one to another through it.
import { V, Q, rx, ry, rz, DEG, clamp, lerp, sm, sm2, hump } from "./m.js";
import { build } from "./pose.js";
import { params, FPS } from "./gait.js";
import { armDepth } from "./clear.js";

const TAU = 2 * Math.PI, legLen = (l1, l2, knee) => Math.sqrt(l1 * l1 + l2 * l2 + 2 * l1 * l2 * Math.cos(knee));
const ease = t => sm2(0, 1, t), mixA = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const bez = (a, m, b, t) => mixA(mixA(a, m, t), mixA(m, b, t), t);
// from one direction round to another at an even rate
function turnV(a, b, t) { a = V.norm(a); b = V.norm(b); const d = clamp(V.dot(a, b), -1, 1), th = Math.acos(d); if (th < 1e-3 || th > 3.1) return V.norm(mixA(a, b, t)); const s = Math.sin(th); return V.norm(V.add(V.mul(a, Math.sin((1 - t) * th) / s), V.mul(b, Math.sin(t * th) / s))); }
/** the standing pose's numbers for this body and these sliders; with the body's solid shapes (`X`), the arms hang as
    far out as it takes to clear the hips and the thighs: every act's arms start from there */
function stance(rig, body, p, X = null) {
  const S = stance0(rig, body, p); if (!X) return S;
  const c = { legs: feet(body, S), arms: { l: { ...S.arm }, r: { ...S.arm } }, chest: { pitch: S.lean }, head: {}, pelvis: { pos: [0, 0, 0], pitch: S.tilt } };
  c.pelvis.pos[1] = pelvisY(rig, body, c.legs.l.ankle, [0, 0], 1, 3 * DEG);
  for (let it = 0; it < 30; it++) { const pose = build(rig, c), solved = pose.solve(), d = Math.max(armDepth(rig, X, pose, solved, "l"), armDepth(rig, X, pose, solved, "r")); if (d <= 0) break; c.arms.l.abd += 1.2 * DEG; c.arms.r.abd += 1.2 * DEG; }
  S.arm.abd = c.arms.l.abd + 0.6 * DEG; return S;
}
function stance0(rig, body, p) {
  const width = p.sc * clamp(0.16 - 0.05 * p.fem + 0.07 * p.masc + 0.05 * p.heavy, 0.09, 0.3), toe = (8 - 4 * p.style + 3 * p.heavy) * DEG;
  const lean = (1.5 + 5 * p.weak - 2 * p.strong - 2 * p.heavy) * DEG, head = (5 * p.weak - 1 * p.strong) * DEG;
  const arm = { flex: (-1 + 3 * p.weak) * DEG, elbow: (11 + 6 * p.masc - 2 * p.fem + 5 * p.heavy) * DEG, abd: (4 + 5 * p.masc + 1 * p.fem + 2 * p.heavy) * DEG, rot: (8 + 10 * p.masc - 4 * p.fem) * DEG,
    pron: (25 + 25 * p.masc - 12 * p.fem) * DEG, wrist: 0, curl: clamp(0.28 + 0.22 * p.masc - 0.08 * p.fem, 0.1, 0.9), hang: 0.8 };
  return { width, toe, lean, head, arm, tilt: (3 * p.fem - 1 * p.masc) * DEG };
}
/** the pelvis joint's height for a leg planted at `ankle`, the hip over `at` (x, z of the pelvis), the knee bent `knee` */
function pelvisY(rig, body, ankle, at, g, knee, turn = null) {
  let hp = rig.leg(g > 0 ? "l" : "r").hip; if (turn) hp = Q.rot(turn, hp);
  const dx = ankle[0] - (at[0] + hp[0]), dz = ankle[2] - (at[1] + hp[2]), d = legLen(body.thigh, body.shank, knee);
  return ankle[1] + Math.sqrt(Math.max(1e-6, d * d - dx * dx - dz * dz)) - hp[1];
}
const feet = (body, S, dz = [0, 0]) => ({ l: { ankle: [S.width / 2, body.ankleH, dz[0]], yaw: S.toe, pitch: 0 }, r: { ankle: [-S.width / 2, body.ankleH, dz[1]], yaw: -S.toe, pitch: 0 } });
const mirrorQ = q => [q[0], -q[1], -q[2], q[3]], mx = v => v && [-v[0], v[1], v[2]];
/** a pose's controls seen in a mirror (her left and right changed over): for the other hand's, the other side's clips */
export function mirror(c) {
  const turn = o => o && (o.q ? { ...o, q: mirrorQ(o.q) } : { ...o, yaw: -(o.yaw || 0), roll: -(o.roll || 0) });
  const leg = l => ({ ...l, ankle: mx(l.ankle), yaw: -(l.yaw || 0), roll: -(l.roll || 0), ...(l.q ? { q: mirrorQ(l.q) } : {}), ...(l.pole ? { pole: mx(l.pole) } : {}), ...(l.poleYaw != null ? { poleYaw: -l.poleYaw } : {}) });
  const arm = a => ({ ...a, ...(a.hand ? { hand: mx(a.hand) } : {}), ...(a.pole ? { pole: mx(a.pole) } : {}), ...(a.palm ? { palm: mx(a.palm) } : {}) });
  return { ...c, pelvis: { ...turn(c.pelvis), pos: mx(c.pelvis.pos) }, chest: turn(c.chest), head: turn(c.head), legs: { l: leg(c.legs.r), r: leg(c.legs.l) }, arms: { l: arm(c.arms.r), r: arm(c.arms.l) },
    ...(c.clav ? { clav: { l: c.clav.r, r: c.clav.l } } : {}) };
}
export const mirrored = (clip, name) => ({ ...clip, name, ctrl: f => mirror(clip.ctrl(f)), meta: mirrorMeta(clip.meta), events: clip.events });
const mirrorMeta = m => { if (!m) return m; const o = {}; for (const [k, v] of Object.entries(m)) o[k] = Array.isArray(v) && v.length === 3 && v.every(x => typeof x === "number") ? [-v[0], v[1], v[2]] : (v && typeof v === "object" && !Array.isArray(v) ? mirrorMeta(v) : v); if (o.hand) o.hand = o.hand === "r" ? "l" : "r"; if (o.side) o.side = o.side === "l" ? "r" : "l"; return o; };

/** standing still: breathing, the weight settled on one leg as the style has it, a slow sway. A loop of 8 s. */
export function idle(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), N = 8 * FPS, k = clamp(0.2 + 0.5 * p.fem - 0.12 * p.masc - 0.1 * p.heavy, 0.05, 0.75);   // how much the weight sits on one leg
  const breathT = 4, ctrl = f => {
    const t = (f % N) / FPS, b = Math.sin(TAU * t / breathT), sw = Math.sin(TAU * t / 8), sw2 = Math.sin(TAU * t / 8 + 1.3), c = { phase: f / N };
    const px = k * 0.034 * p.sc + 0.005 * p.sc * sw, pz = 0.004 * p.sc * sw2, roll = k * 5.5 * DEG + 0.4 * DEG * sw, yaw = k * 3 * DEG;
    c.legs = feet(body, S, [0, k * 0.035 * p.sc]); c.legs.r.yaw -= k * 6 * DEG;
    const y = pelvisY(rig, body, c.legs.l.ankle, [px, pz], 1, (3 + 2 * p.weak) * DEG, Q.mul(ry(yaw), rz(roll)));
    c.pelvis = { pos: [px, y - 0.0012 * b, pz], yaw, roll, pitch: S.tilt };
    c.chest = { yaw: -0.4 * yaw, roll: -0.55 * roll - 0.3 * DEG * sw, pitch: S.lean - 0.55 * DEG * b };
    c.head = { yaw: 2 * DEG * Math.sin(TAU * t / 8 + 0.6), roll: 0.25 * c.chest.roll + k * 1.5 * DEG, pitch: S.head + 0.2 * DEG * b };
    const a = s => ({ ...S.arm, flex: S.arm.flex + 0.5 * DEG * b * s, abd: S.arm.abd + 0.4 * DEG * b });
    c.arms = { l: a(1), r: a(-1) }; c.clav = { l: { up: 1.1 * DEG * (0.5 + 0.5 * b) }, r: { up: 1.1 * DEG * (0.5 + 0.5 * b) } }; c.breath = b;
    return c;
  };
  return { name: "idle_loop", loop: true, n: N, fps: FPS, secs: N / FPS, ctrl, events: [], meta: {} };
}

// An arm taken by its wrist from where it hangs to a place, `k` of the way along a curve. "Where it hangs" is on the
// body as it is in this frame (`home`: the frame built with its arms by their angles): at k = 0 it is that arm exactly,
// so a hand leaves the side and comes back to it wherever the body has got to meanwhile
function homeOf(rig, c) { const pose = build(rig, c), { P } = pose.solve(), at = j => [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]]; return { c, pose, info: pose.info, shoulder: { l: at(rig.armL.up), r: at(rig.armR.up) } }; }
function armTo(home, s, to, k, o = {}) {
  const W0 = home.info["wristAt_" + s], E0 = home.info["elbowAt_" + s], S0 = home.shoulder[s], g = s === "l" ? 1 : -1, out = o.via || [(W0[0] + to[0]) / 2 + g * 0.04, (W0[1] + to[1]) / 2 + 0.02, (W0[2] + to[2]) / 2 + 0.05];
  const pole0 = V.sub(E0, S0), pole1 = o.pole || [g * 0.5, -0.75, -0.45], palm1 = o.palm || [0, -1, 0];
  // (the palm: the hanging arm's own turn, and `k` of the way to facing where it's asked: an angle blended, never two directions, which whip round when they face opposite ways)
  return { hand: bez(W0, out, to, k), pole: turnV(pole0, pole1, ease(k)), pron: home.c.arms[s].pron ?? 0.4, palm: V.norm(palm1), palmK: ease(k), curl: lerp(home.c.arms[s].curl ?? 0.3, o.curl ?? 0.35, k), wrist: (o.wrist || 0) * k, free: true };
}
// the base pose (the idle's first frame) built once
function basePose(rig, body, set, X) { const c = idle(rig, body, set, X).ctrl(0), h = homeOf(rig, c); return { ...h, pelvis: c.pelvis.pos.slice() }; }

// ---- sitting ----------------------------------------------------------------------------------------------------------
// where a body ends up on a seat `H` high: the pelvis joint's place (from where it stood), how it's tilted
function seated(rig, body, p, S, H) {
  const flesh = clamp(0.8 * (body.limbs.thigh_l.bins[2].back || 0.07), 0.05, 0.13), hipY = H + flesh, dy = hipY - (body.shank + body.ankleH), back = Math.sqrt(Math.max(0.01, body.thigh * body.thigh - dy * dy));
  const tilt = -(9 + 7 * p.weak - 4 * p.strong + 3 * p.heavy) * DEG;         // the pelvis rolled back, as it is on a seat
  const hp = Q.rot(rx(tilt), rig.legL.hip);
  return { pos: [0, hipY - hp[1], -back * 0.96 - hp[2] + 0.02 * p.sc], tilt, chest: (2 + 9 * p.weak - 3 * p.strong) * DEG - 2 * DEG, head: (6 * p.weak) * DEG, flesh };
}
// the hands' places on the thighs when sat (the wrist over the thigh's top, a little behind the knee)
function onThighs(rig, body, pose, p) {
  const out = {}, { P } = pose.solve();
  for (const s of ["l", "r"]) { const g = s === "l" ? 1 : -1, K = pose.info["kneeAt_" + s], L = rig.leg(s), H = [P[L.up * 3], P[L.up * 3 + 1], P[L.up * 3 + 2]], along = V.norm(V.sub(H, K));
    const r = (body.limbs["thigh_" + s].bins[4].front || 0.06) + 0.01; out[s] = V.add(V.add(K, V.mul(along, (0.4 + 0.08 * p.fem) * body.thigh)), [g * (-0.02 * p.fem + 0.01 * p.masc), r + 0.022, 0]); }
  return out;
}
const baseLegs = base => ({ l: { ankle: base.c.legs.l.ankle.slice(), yaw: base.c.legs.l.yaw, pitch: 0 }, r: { ankle: base.c.legs.r.ankle.slice(), yaw: base.c.legs.r.yaw, pitch: 0 } });   // the feet where the idle has them: no act shuffles them
function sitFrame(rig, body, p, S, base, Z, a) {              // a: { down 0..1 (stood .. sat), lean, rock, hands 0..1, press, breath, drop }
  const c = { legs: baseLegs(base), breath: a.breath || 0, press: { seat: a.press || 0 } }, dn = a.down, kz = Math.pow(dn, 0.8), ky = Math.pow(dn, 1.25);   // (the hips go back before they go down; `down` comes eased already)
  const sp = base.pelvis, pos = [sp[0] * (1 - kz), lerp(sp[1], Z.pos[1], ky) - (a.sink || 0), lerp(sp[2], Z.pos[2], kz)];
  if (dn > 0) { const out = (9 * p.masc - 6 * p.fem + 4 * p.heavy) * DEG * dn; c.legs.l.poleYaw = c.legs.l.yaw * 0.6 * (1 - dn) + (S.toe * 0.5) * dn + out; c.legs.r.poleYaw = c.legs.r.yaw * 0.6 * (1 - dn) - (S.toe * 0.5) * dn - out; }
  c.pelvis = { pos, yaw: base.c.pelvis.yaw * (1 - dn), roll: base.c.pelvis.roll * (1 - dn), pitch: lerp(S.tilt, Z.tilt, ease(dn)) + 0.45 * (a.lean || 0) + (a.rock || 0) };
  c.chest = { yaw: base.c.chest.yaw * (1 - dn), roll: base.c.chest.roll * (1 - dn), pitch: lerp(S.lean, Z.chest, ease(dn)) + (a.lean || 0) + 1.4 * (a.rock || 0) };
  c.head = { yaw: 0, roll: base.c.head.roll * (1 - dn), pitch: lerp(S.head, Z.head, dn) + 0.35 * (a.lean || 0) + (a.look || 0) };
  const hang = s => ({ ...S.arm, flex: S.arm.flex + 0.5 * (a.lean || 0) + 10 * DEG * dn, elbow: S.arm.elbow + 18 * DEG * dn, hang: 0.85 });
  c.arms = { l: hang("l"), r: hang("r") };
  if (a.hands > 0.001) { const home = homeOf(rig, c), T = onThighs(rig, body, home.pose, p);
    for (const s of ["l", "r"]) c.arms[s] = armTo(home, s, T[s], a.hands, { palm: [0, -1, 0.1], pole: [s === "l" ? 0.8 : -0.8, -0.35, -0.5], curl: 0.3 }); }
  return c;
}
/** sitting down, sitting, standing up: { sit_down, sit_loop, stand_up } for a seat `H` m high (set.seat, 0.45) */
export function sitting(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), H = set.seat ?? 0.45, Z = seated(rig, body, p, S, H), effort = clamp(0.5 * p.heavy + 0.6 * p.weak - 0.3 * p.strong, 0, 1.2);
  const leanMax = (34 + 9 * p.heavy + 7 * p.weak - 6 * p.strong) * DEG, meta = { seat: { height: H, edge: +(-0.05 * p.sc).toFixed(3), pelvis: Z.pos.map(v => +v.toFixed(3)) } };
  // down: a controlled lowering; a weak or heavy body lets go for the last of it and lands
  const Td = 1.9 + 0.5 * p.heavy + 0.4 * p.weak - 0.2 * p.strong, drop = clamp(0.1 + 0.25 * effort, 0.08, 0.42), tc = 0.72 * Td, nd = Math.round((Td + 0.9) * FPS);
  const downAt = t => { const u = clamp(t / tc, 0, 1), a = 1 - drop; return u < 0.8 ? a * sm2(0.06, 0.8, u) : a + drop * Math.pow((u - 0.8) / 0.2, 1.6 + effort); };   // (the end of it faster: let go)
  const sitDown = f => { const t = f / FPS, dn = downAt(t), after = Math.max(0, t - tc), hit = effort * Math.exp(-after * 5) * Math.sin(after * 11), land = t >= tc ? 1 : 0;
    return sitFrame(rig, body, p, S, base, Z, { down: dn, lean: leanMax * hump(0.05 * tc, 1.25 * tc, t) * (1 - 0.35 * land * sm(tc, tc + 0.5, t)), rock: -5 * DEG * hit * land - 3 * DEG * land * sm(tc, tc + 0.25, t) * (1 - sm(tc + 0.25, tc + 0.8, t)),
      sink: land ? 0.012 * (0.4 + effort) * Math.exp(-after * 6) * Math.cos(after * 12) + 0.006 * (1 - Math.exp(-after * 6)) : 0, press: sm(tc - 0.05, tc + 0.12, t), hands: sm(tc * 0.55, tc + 0.7, t) * (effort > 0.25 ? 1 : sm(tc, tc + 0.7, t)), look: 9 * DEG * hump(0, tc, t), breath: 0 }); };
  // sat: breathing, a small shift of the weight
  const Ns = 8 * FPS, sitLoop = f => { const t = (f % Ns) / FPS, b = Math.sin(TAU * t / 4), w = Math.sin(TAU * t / 8);
    const c = sitFrame(rig, body, p, S, base, Z, { down: 1, lean: -0.5 * DEG * b + 0.6 * DEG * w, sink: 0.006, press: 1, hands: 1, breath: b }); c.pelvis.pos[0] += 0.004 * w; c.chest.roll = 0.5 * DEG * w; c.head.yaw = 2 * DEG * Math.sin(TAU * t / 8 + 0.8); return c; };
  // up: the trunk thrown forward over the feet (the heavier or weaker, the further and with a rock back first), then the legs
  const Tu = 1.7 + 0.6 * p.heavy + 0.5 * p.weak - 0.2 * p.strong, t0 = 0.28 * Tu + 0.2 * effort, nu = Math.round((Tu + 0.5) * FPS), upLean = (38 + 10 * p.heavy + 8 * p.weak - 6 * p.strong) * DEG;
  const standUp = f => { const t = f / FPS, dn = 1 - sm2(t0, Tu, t);
    return sitFrame(rig, body, p, S, base, Z, { down: dn, lean: upLean * hump(0, Tu * 1.02, t) * (0.55 + 0.45 * sm(0, t0, t)) - 4 * DEG * effort * hump(0, 0.5 * t0, t), sink: 0.006 * (1 - sm(t0 - 0.1, t0 + 0.1, t)),
      press: 1 - sm(t0 - 0.08, t0 + 0.1, t), hands: 1 - sm(t0 + (effort > 0.25 ? 0.35 : 0) * (Tu - t0), Tu * (effort > 0.25 ? 0.95 : 0.6), t), look: 5 * DEG * hump(0, Tu, t), breath: 0 }); };
  return [
    { name: "sit_down", loop: false, n: nd, fps: FPS, secs: (nd - 1) / FPS, ctrl: sitDown, events: [{ t: tc, name: "seated" }], meta },
    { name: "sit_loop", loop: true, n: Ns, fps: FPS, secs: Ns / FPS, ctrl: sitLoop, events: [], meta },
    { name: "stand_up", loop: false, n: nu, fps: FPS, secs: (nu - 1) / FPS, ctrl: standUp, events: [{ t: t0, name: "risen" }], meta },
  ];
}

// ---- lying down to sleep ------------------------------------------------------------------------------------------------
/** lying down on a bed from stood beside it (her back to it), asleep, getting up: { lie_down, sleep_loop, get_up }.
    She sits on the edge, then turns and lies back with her head to her left (the clips mirrored have it to her right). */
export function sleeping(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), H = set.seat ?? 0.45, Z = seated(rig, body, p, S, H), effort = clamp(0.5 * p.heavy + 0.6 * p.weak - 0.3 * p.strong, 0, 1.2);
  const leanMax = (30 + 8 * p.heavy + 6 * p.weak - 5 * p.strong) * DEG, slab = body.slabs.reduce((a, s) => (Math.abs(s.y - body.levels.seat) < Math.abs(a.y - body.levels.seat) ? s : a), body.slabs[0]);
  const rb = clamp(0.84 * (rig.J[rig.pelvis].at[2] - slab.zb), 0.07, 0.2), LY = H + rb, lie = [0.04 * p.sc, LY, Z.pos[2] - 0.13 * p.sc];   // the pelvis lain down: on its back, further onto the bed
  const legL = body.thigh + body.shank, ankR = Math.max(0.04, body.r.calf * 0.55);
  const Tsit = 1.5 + 0.4 * p.heavy + 0.3 * p.weak, tc = 0.74 * Tsit, Tturn = 1.9 + 0.5 * p.heavy + 0.4 * p.weak, Tset = 1.1, T = Tsit + 0.35 + Tturn + Tset, n = Math.round(T * FPS);
  const t1 = Tsit + 0.35, t2 = t1 + Tturn;
  // a frame by how far lain (0 sat on the edge .. 1 on her back), the legs' own way up (legs 0..1), settled 0..1
  const lying = (down, ln, legs, settle, breath, a = {}) => {
    const dn = down;                                          // (sat: all of sitFrame's)
    if (ln <= 0) return sitFrame(rig, body, p, S, base, Z, { down: dn, lean: a.lean || 0, rock: a.rock || 0, sink: a.sink || 0, press: a.press || 0, hands: a.hands || 0, look: a.look || 0, breath });
    const k = ease(ln), yawA = -90 * DEG * ease(clamp(ln * 1.25, 0, 1)), rec = 90 * DEG * ease(clamp((ln - 0.12) / 0.88, 0, 1));
    const Dy = ry(yawA), lat = Q.rot(Dy, [1, 0, 0]), Dp = Q.mul(Q.axis(lat, -rec), Q.mul(Dy, rx(Z.tilt * (1 - k))));      // turned to face the bed's foot, then laid back
    const pos = [lerp(Z.pos[0], lie[0], k), lerp(Z.pos[1] - 0.006, lie[1], sm(0.25, 1, ln)) + 0.035 * p.sc * hump(0, 0.9, ln), lerp(Z.pos[2], lie[2], ease(clamp(ln * 1.1, 0, 1)))];
    const c = { breath, press: { seat: 1 - k, back: sm(0.75, 1, ln) }, pelvis: { pos, q: Dp } };
    const curlUp = hump(0.1, 1.05, ln) * (1 - settle);       // the trunk curled forward while it's lowered, the head held up till it's down
    c.chest = { q: Q.mul(Dp, rx((14 * curlUp + 2) * DEG + Z.chest * (1 - k))) }; c.head = { q: Q.mul(c.chest.q, Q.mul(rx((16 * curlUp + 9 * k) * DEG), ry(-14 * DEG * settle))) }; c.neck = 0.5;
    // the legs: off the floor, drawn up, swung onto the bed, let out along it
    const hipW = s => V.add(pos, Q.rot(Dp, rig.leg(s).hip)), foot = {};
    for (const s of ["l", "r"]) { const g = s === "l" ? 1 : -1, F0 = [g * S.width / 2, body.ankleH, 0], hip = hipW(s), far = s === "l" ? 0.985 : 0.93;   // (her right leg a little bent: nobody sleeps to attention)
      const end = [hip[0] - legL * far, H + ankR, hip[2] + g * -0.02 + (s === "r" ? 0.05 : 0)], mid = [hip[0] - 0.42 * legL, H + 0.2 * p.sc + ankR, hip[2] * 0.5 + 0.12];
      const u = clamp(legs + (s === "l" ? 0.06 : -0.06), 0, 1), A = u <= 0 ? F0 : bez(F0, mid, end, ease(u));
      const fq = Q.slerp(Q.mul(ry(g * S.toe), ry(-rig.leg(s).yaw0)), Q.mul(Dp, Q.mul(ry(g * 16 * DEG), rx(30 * DEG))), ease(u));
      foot[s] = { ankle: A, q: fq, pole: V.norm(mixA(Q.rot(Dy, [0, 0, 1]), [0.1 * g, 1, 0.25 * g], ease(u))) }; }
    c.legs = foot;
    // the arms: the hand of the side she lies toward props her on the bed, the other steadies; then one on her belly, one beside her
    const prop = sm(0.02, 0.3, ln) * (1 - sm(0.72, 1, ln)), rest = sm(0.7, 1, ln);
    const bedL = [pos[0] + 0.3 * p.sc, H + 0.02, Z.pos[2] + 0.02], bedR = [pos[0] - 0.22 * p.sc, H + 0.02, Z.pos[2] + 0.1];
    const belly = V.add(pos, Q.rot(Dp, [0.05 * p.sc, 0.2 * (body.levels.under - body.crotchY) + 0.1, (body.apex.belly[2] - rig.J[rig.pelvis].at[2]) + 0.035]));
    const side = V.add(pos, Q.rot(Dp, [-(body.half.hips + 0.1), 0.1, -rb + 0.035]));
    const lw = prop + rest, la = lw > 1e-3 ? mixA(bedL, belly, rest / lw) : bedL, rw = prop + rest, ra = rw > 1e-3 ? mixA(bedR, side, rest / rw) : bedR;
    c.arms = { l: { ...S.arm, hang: 0.3 }, r: { ...S.arm, hang: 0.3 } }; const home = homeOf(rig, c);
    c.arms = { l: armTo(home, "l", la, clamp(lw, 0, 1), { via: [bedL[0], H + 0.25, bedL[2] + 0.12], palm: Q.rot(Dp, [0, 0.2, -1]), pole: Q.rot(Dp, [0.8, -0.5, -0.3]), curl: 0.3 }),
      r: armTo(home, "r", ra, clamp(rw, 0, 1), { via: [bedR[0], H + 0.22, bedR[2] + 0.15], palm: Q.rot(Dp, [0, 0.1, -1]), pole: Q.rot(Dp, [-0.9, -0.3, -0.3]), curl: 0.32 }) };
    return c;
  };
  const sitPart = t => { const u = clamp(t / tc, 0, 1), drop = clamp(0.1 + 0.25 * effort, 0.08, 0.42), a = 1 - drop, dn = u < 0.8 ? a * sm2(0.06, 0.8, u) : a + drop * Math.pow((u - 0.8) / 0.2, 1.6 + effort), after = Math.max(0, t - tc), land = t >= tc ? 1 : 0;
    return { down: dn, lean: leanMax * hump(0.05 * tc, 1.25 * tc, t), rock: -4 * DEG * effort * Math.exp(-after * 5) * Math.sin(after * 11) * land, sink: land ? 0.01 * (0.4 + effort) * Math.exp(-after * 6) * Math.cos(after * 12) + 0.006 * (1 - Math.exp(-after * 6)) : 0, press: sm(tc - 0.05, tc + 0.12, t), look: 8 * DEG * hump(0, tc, t) }; };
  const lieDown = f => { const t = f / FPS; if (t <= t1) return lying(sitPart(t).down, 0, 0, 0, 0, sitPart(t)); const ln = sm2(t1, t2, t); return lying(1, ln, sm2(t1 + 0.12 * Tturn, t2 - 0.1 * Tturn, t), sm(t2 - 0.2, T - 0.15, t), 0); };
  const Ns = 10 * FPS, sleepLoop = f => { const t = (f % Ns) / FPS, b = Math.sin(TAU * t / 5), c = lying(1, 1, 1, 1, b); c.pelvis.pos[1] += 0.0015 * b; return c; };
  // up again: the same road back, the push off the bed first; then to her feet as from any seat
  const Tup = Tturn * 1.3, Trise = 1.7 + 0.6 * p.heavy + 0.5 * p.weak - 0.2 * p.strong, t0r = 0.28 * Trise + 0.2 * effort, u1 = 0.35 + Tup, Tg = u1 + 0.45 + Trise + 0.4, ng = Math.round(Tg * FPS), upLean = (38 + 10 * p.heavy + 8 * p.weak - 6 * p.strong) * DEG;
  const getUp = f => { const t = f / FPS; if (t <= u1) { const back = 1 - sm2(0.35, u1, t); return lying(1, back, 1 - sm2(0.35 + 0.1 * Tup, u1 - 0.12 * Tup, t), back * (1 - sm(0, 0.9, t)), 0); }
    const tt = t - u1 - 0.45, dn = 1 - sm2(t0r, Trise, tt);
    return sitFrame(rig, body, p, S, base, Z, { down: dn, lean: upLean * hump(0, Trise * 1.02, tt) * (0.55 + 0.45 * sm(0, t0r, tt)), sink: 0.006 * (1 - sm(t0r - 0.1, t0r + 0.1, tt)), press: 1 - sm(t0r - 0.08, t0r + 0.1, tt),
      hands: effort > 0.25 ? sm(-0.4, 0, tt) * (1 - sm(t0r + 0.35 * (Trise - t0r), Trise * 0.95, tt)) : 0, look: 5 * DEG * hump(0, Trise, tt), breath: 0 }); };
  const end = lying(1, 1, 1, 1, 0), headAt = (() => { const P = build(rig, end).solve().P, j = rig.head; return [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]].map(v => +v.toFixed(3)); })();
  const meta = { bed: { height: H, edge: +(-0.05 * p.sc).toFixed(3), pelvis: lie.map(v => +v.toFixed(3)), head: headAt, side: "l" } };
  return [
    { name: "lie_down", loop: false, n, fps: FPS, secs: (n - 1) / FPS, ctrl: lieDown, events: [{ t: tc, name: "seated" }, { t: t2, name: "lain" }], meta },
    { name: "sleep_loop", loop: true, n: Ns, fps: FPS, secs: Ns / FPS, ctrl: sleepLoop, events: [], meta },
    { name: "get_up", loop: false, n: ng, fps: FPS, secs: (ng - 1) / FPS, ctrl: getUp, events: [{ t: u1, name: "sat_up" }, { t: u1 + 0.45 + t0r, name: "risen" }], meta },
  ];
}

// ---- a hand to something: a door's handle, a thing to pick up --------------------------------------------------------
// the standing body leaning into a reach: where the pelvis and the chest go for a hand that has to get to `to`
function leanFrame(rig, body, p, S, base, a) {               // a: { fwd (m), down (m), pitch, yaw, side (m), heel 0..1, look: [pitch, yaw], squat 0..1 }
  const c = { legs: baseLegs(base), breath: 0 }, sp = base.pelvis, k = a.k ?? 1, heel = (a.heel || 0) * 24 * DEG;
  for (const s of ["l", "r"]) if (heel > 0) { const A0 = c.legs[s].ankle; c.legs[s].pitch = -heel; c.legs[s].toe = heel; c.legs[s].ankle = [A0[0], body.ankleH * Math.cos(heel) + body.foot.ballAhead * Math.sin(heel), A0[2] + body.foot.ballAhead * (1 - Math.cos(heel)) + body.ankleH * Math.sin(heel)]; }
  const at = [sp[0] * (1 - k) + (a.side || 0), sp[2] + (a.fwd || 0)], ystand = pelvisY(rig, body, c.legs.l.ankle, at, 1, (3 + 2 * p.weak) * DEG);
  c.pelvis = { pos: [at[0], Math.min(ystand, lerp(sp[1], sp[1] - (a.down || 0), 1)) + (heel > 0 ? 0 : 0), at[1]], yaw: base.c.pelvis.yaw * (1 - k) + 0.35 * (a.yaw || 0), roll: base.c.pelvis.roll * (1 - k), pitch: S.tilt + 0.3 * (a.pitch || 0) };
  if (a.down > 0) c.pelvis.pos[1] = Math.min(ystand, sp[1] - a.down); else c.pelvis.pos[1] = lerp(sp[1], ystand, k);
  if (a.squat) { c.legs.l.poleYaw = c.legs.l.yaw * 0.6 + 6 * DEG * a.squat; c.legs.r.poleYaw = c.legs.r.yaw * 0.6 - 6 * DEG * a.squat; }
  c.chest = { yaw: base.c.chest.yaw * (1 - k) + (a.yaw || 0), roll: base.c.chest.roll * (1 - k) + (a.roll || 0), pitch: S.lean + (a.pitch || 0) };
  c.head = { yaw: 0.6 * (a.yaw || 0) + (a.look ? a.look[1] : 0), roll: base.c.head.roll * (1 - k), pitch: S.head + 0.5 * (a.pitch || 0) + (a.look ? a.look[0] : 0) };
  c.arms = { l: { ...S.arm, flex: S.arm.flex + 0.35 * (a.pitch || 0) }, r: { ...S.arm, flex: S.arm.flex + 0.35 * (a.pitch || 0) } };
  return c;
}
/** opening a door with the right hand (mirrored: the left): { open_push, open_pull, open_slide }. The handle is at
    meta.handle from where she stands; `grab`, `open` and `release` say when the door is hers and when it moves. */
export function opening(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), hy = set.handle ?? 1.0, reach = (body.upper + body.fore) * 0.93, slow = 1 + 0.25 * p.heavy + 0.2 * p.weak - 0.1 * p.strong;
  const grip = 0.075 * p.sc, hx = -body.shoulderHalf * 0.85, dy = hy - body.shoulderY - body.floor, hz = Math.sqrt(Math.max(0.02, reach * reach - dy * dy)) + grip + 0.03 * p.sc;   // as far in front as a bent arm takes the hand: she stands back from the door
  const mk = (name, kind) => {
    const T = (kind === "slide" ? 2.2 : kind === "pull" ? 2.3 : 2.0) * slow, tg = 0.5 * slow, tt = tg + 0.22, to = tt + 0.12, te = to + (kind === "slide" ? 0.75 : 0.62) * slow, tr = te + 0.12, n = Math.round(T * FPS);
    const handle = [hx, hy, hz], travel = kind === "push" ? [0.05, -0.02, 0.26] : kind === "pull" ? [-0.1, -0.02, -0.27] : [-0.52, 0, 0.0];
    const ctrl = f => { const t = f / FPS, k = sm2(0.05, tg, t) * (1 - sm2(tr, T - 0.12, t)), mv = sm2(to, te, t), turn = sm(tg, tt, t) * (1 - sm(te, tr, t));
      const tgt = V.add(V.add(handle, V.mul(travel, mv)), [0, -0.03 * turn * (kind === "slide" ? 0 : 1), -grip]);
      const w = kind === "push" ? 1 : kind === "pull" ? -1 : 0, lean = sm(tg * 0.5, tt, t) * (1 - sm(tr, T, t));
      const c = leanFrame(rig, body, p, S, base, { k: sm(0, tg, t) * (1 - sm(tr, T, t)), fwd: 0.03 * lean + w * 0.07 * mv * (1 - sm(tr, T, t)), pitch: (5 * lean + w * 5 * mv * (1 - sm(tr, T, t))) * DEG,
        yaw: (-6 * lean - (kind === "slide" ? 16 : kind === "pull" ? -8 : 5) * mv * (1 - sm(tr, T, t))) * DEG, side: (kind === "slide" ? -0.05 : kind === "pull" ? 0.02 : 0) * mv * (1 - sm(tr, T, t)), look: [7 * DEG * k, -8 * DEG * k] });
      const home = homeOf(rig, c); c.arms.r = armTo(home, "r", tgt, k, { palm: kind === "slide" ? [1, 0, 0.2] : [0.3, -1, 0], pole: [-0.75, -0.6, -0.2], curl: lerp(0.3, 0.95, sm(tg - 0.08, tg + 0.06, t) * (1 - sm(tr - 0.05, tr + 0.1, t))), wrist: -8 * DEG * turn });
      return c; };
    return { name, loop: false, n, fps: FPS, secs: (n - 1) / FPS, ctrl, events: [{ t: tg, name: "grab" }, { t: to, name: "open" }, { t: tr, name: "release" }],
      meta: { door: { kind, hand: "r", handle: handle.map(v => +v.toFixed(3)), travel: travel.map(v => +v.toFixed(3)), opens: +(te - to).toFixed(2) } } };
  };
  return [mk("open_push", "push"), mk("open_pull", "pull"), mk("open_slide", "slide")];
}
/** reaching for something with the right hand and taking it (mirrored: the left): { reach_low, reach_mid, reach_high }.
    meta.reach says where the hand closes, from where she stands; `grab` when; `put_away` when the hand lets go again. */
export function reaching(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), effort = clamp(0.5 * p.heavy + 0.6 * p.weak - 0.3 * p.strong, 0, 1.2), slow = 1 + 0.3 * p.heavy + 0.25 * p.weak - 0.1 * p.strong, grip = 0.075 * p.sc;
  const sy = body.shoulderY + body.floor, arm = body.upper + body.fore;
  const mk = (name, lvl) => {
    const tgt = lvl === "low" ? [-0.1 * p.sc, 0.1, 0.36 * p.sc] : lvl === "mid" ? [-body.shoulderHalf * 0.8, 0.86, 0.42 * p.sc] : [-body.shoulderHalf * 0.8, sy + 0.86 * arm - 0.05, 0.3 * p.sc];
    const T = (lvl === "low" ? 3.3 : lvl === "mid" ? 2.3 : 3.0) * slow, tg = (lvl === "low" ? 1.2 : lvl === "mid" ? 0.8 : 1.05) * slow, th = tg + 0.3, tb = T - 0.4, n = Math.round(T * FPS);   // (out, a moment on it, and a slower way back: an arm let down, not snatched)
    // how the body gets the hand there: low, the knees and the hips fold (a strong body squats, a weak one stoops, a hand on its knee); high, up on the toes
    const squat = lvl === "low" ? clamp(0.55 + 0.25 * p.strong - 0.25 * p.weak - 0.15 * p.heavy, 0.2, 0.85) : 0;
    const hand = V.sub(tgt, [0, lvl === "low" ? -grip * 0.6 : 0, lvl === "low" ? 0 : grip]);
    // the body's part of the reach, `u` times as much as a short reach needs: grown until the arm can do the rest
    const lean = (k, u) => lvl === "low" ? { down: Math.min((0.2 + 0.33 * squat) * u, 0.52) * p.sc * k, pitch: Math.min((62 - 26 * squat) * u, 82) * DEG * k, fwd: -0.05 * p.sc * k, yaw: -8 * DEG * k, squat: k, look: [14 * DEG * k, -6 * DEG * k] }
      : lvl === "mid" ? { pitch: Math.min(10 * u, 48) * DEG * k, fwd: Math.min(0.04 * u, 0.13) * p.sc * k, down: Math.max(0, 0.03 * (u - 1.6)) * p.sc * k, yaw: -9 * DEG * k, look: [8 * DEG * k, -8 * DEG * k] }
        : { pitch: -5 * DEG * k, heel: Math.min(1, 0.6 * u) * k, fwd: Math.min(0.03 * u, 0.1) * p.sc * k, yaw: -5 * DEG * k, look: [-22 * DEG * k, -6 * DEG * k] };
    let u = 1; for (; u < 4; u += 0.1) { const h = homeOf(rig, leanFrame(rig, body, p, S, base, { ...lean(1, u), k: 1 })); if (V.dist(h.shoulder.r, hand) <= 0.94 * arm) break; }
    const ctrl = f => { const t = f / FPS, go = sm2(0.08, tg, t), back = sm2(th, tb, t), k = go * (1 - back), hold = sm(tg - 0.06, tg + 0.05, t) * (1 - sm(tb + 0.1, T - 0.05, t));
      const c = leanFrame(rig, body, p, S, base, { ...lean(k, u), k: sm(0, tg, t) * (1 - sm(tb, T, t)) });
      const home = homeOf(rig, c), carry = [home.info.wristAt_r[0] - 0.02, home.info.wristAt_r[1] + 0.07, home.info.wristAt_r[2] + 0.1];
      c.arms.r = armTo(home, "r", hand, k, { palm: lvl === "low" ? [0, -1, 0.15] : lvl === "mid" ? [0.2, -0.9, 0.3] : [0, -0.2, 1], pole: lvl === "high" ? [-0.9, -0.1, -0.4] : [-0.7, -0.6, -0.3], curl: lerp(0.25, 0.95, hold),
        via: lvl === "high" ? [tgt[0] - 0.08, sy - 0.05, 0.3 * p.sc] : null });
      if (back > 0 && back < 1) c.arms.r.hand = mixA(c.arms.r.hand, carry, 0.5 * hump(0, 1, back));     // (what it took is brought back close to the body)
      if (lvl === "low" && effort > 0.3) { const T2 = onThighs(rig, body, home.pose, p).l; c.arms.l = armTo(home, "l", T2, sm(0.1, tg * 0.8, t) * (1 - sm(tb - 0.2, T - 0.1, t)), { palm: [0, -1, 0.1], pole: [0.8, -0.3, -0.5], curl: 0.4 }); }
      return c; };
    return { name: "reach_" + lvl, loop: false, n, fps: FPS, secs: (n - 1) / FPS, ctrl, events: [{ t: tg, name: "grab" }, { t: tb + 0.12, name: "put_away" }], meta: { reach: { hand: "r", at: tgt.map(v => +v.toFixed(3)), level: lvl } } };
  };
  return [mk("reach_low", "low"), mk("reach_mid", "mid"), mk("reach_high", "high")];
}

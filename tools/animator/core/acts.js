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
export const ease = t => sm2(0, 1, t), mixA = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export const bez = (a, m, b, t) => mixA(mixA(a, m, t), mixA(m, b, t), t);
// from one direction round to another at an even rate
export function turnV(a, b, t) { a = V.norm(a); b = V.norm(b); const d = clamp(V.dot(a, b), -1, 1), th = Math.acos(d); if (th < 1e-3 || th > 3.1) return V.norm(mixA(a, b, t)); const s = Math.sin(th); return V.norm(V.add(V.mul(a, Math.sin((1 - t) * th) / s), V.mul(b, Math.sin(t * th) / s))); }
/** the standing pose's numbers for this body and these sliders; with the body's solid shapes (`X`), the arms hang as
    far out as it takes to clear the hips and the thighs: every act's arms start from there */
export function stance(rig, body, p, X = null) {
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
    pron: (20 + 14 * p.masc - 8 * p.fem) * DEG, wrist: 0, curl: clamp(0.5 + 0.12 * p.masc - 0.05 * p.fem, 0.3, 0.75), hang: 0.8 };   // (the palm to the thigh, turned a little to the back: pose.js counts it from the body)
  return { width, toe, lean, head, arm, tilt: (3 * p.fem - 1 * p.masc) * DEG };
}
/** the pelvis joint's height for a leg planted at `ankle`, the hip over `at` (x, z of the pelvis), the knee bent `knee` */
export function pelvisY(rig, body, ankle, at, g, knee, turn = null) {
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
  const arm = a => ({ ...a, ...(a.hand ? { hand: mx(a.hand) } : {}), ...(a.pole ? { pole: mx(a.pole) } : {}), ...(a.palm ? { palm: mx(a.palm) } : {}), ...(a.handQ ? { handQ: mirrorQ(a.handQ) } : {}) });
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
export function homeOf(rig, c) { const pose = build(rig, c), { P } = pose.solve(), at = j => [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]]; return { c, pose, info: pose.info, shoulder: { l: at(rig.armL.up), r: at(rig.armR.up) } }; }
// (`o.near`, metres: on its way the wrist is kept at least that far from this frame's shoulder. A hand's place is given
//  by what it's going to, and how near that passes the shoulder depends on the arm: an arm half as long again folds flat
//  on the way to the same place, and an elbow folded flat points anywhere. Eased in from a quarter further out, so the
//  path has no corner where it starts)
export function clearOf(P, S, r) {
  const v = V.sub(P, S), d = V.len(v), d1 = 1.25 * r; if (d >= d1 || r <= 0) return P;
  const want = r + 0.25 * r * Math.pow(d / d1, 5), u = d > 1e-5 ? V.mul(v, 1 / d) : [0, 0, 1];
  return V.mad(S, u, want);
}
// (`o.far`, metres: the wrist is never asked further from this frame's shoulder than that, and is let off gently from
//  nine tenths of it. A hand left on a bed while the body goes on past it is asked for 1.8 of the arm; the arm lies
//  straight toward it, and in the frame the hand comes back within reach the elbow folds 32 to 50 degrees at once: an
//  arm at its whole length takes any bend for no change of reach at all. Kept short of it, the elbow gives all the way)
export function within(P, S, far) {
  const v = V.sub(P, S), d = V.len(v), d0 = 0.9 * far; if (d <= d0 || far <= 0) return P;
  return V.mad(S, v, (d0 + (far - d0) * (1 - Math.exp(-(d - d0) / (far - d0)))) / d);
}
export function armTo(home, s, to, k, o = {}) {
  const W0 = home.info["wristAt_" + s], E0 = home.info["elbowAt_" + s], S0 = home.shoulder[s], g = s === "l" ? 1 : -1, out = o.via || [(W0[0] + to[0]) / 2 + g * 0.04, (W0[1] + to[1]) / 2 + 0.02, (W0[2] + to[2]) / 2 + 0.05];
  const pole0 = V.sub(E0, S0), pole1 = o.pole || [g * 0.5, -0.75, -0.45], palm1 = o.palm || [0, -1, 0], at0 = bez(W0, out, to, k), at = o.far ? within(at0, S0, o.far) : at0;
  // (the palm: the hanging arm's own turn, and `k` of the way to facing where it's asked: an angle blended, never two directions, which whip round when they face opposite ways)
  return { hand: o.near ? clearOf(at, S0, o.near) : at, pole: turnV(pole0, pole1, ease(k)), pron: home.info["pron_" + s], pronArm: true, palm: V.norm(palm1), palmK: ease(k), curl: lerp(home.c.arms[s].curl ?? 0.45, o.curl ?? 0.45, k), wrist: (o.wrist || 0) * k, free: true };
}
// the base pose (the idle's first frame) built once
export function basePose(rig, body, set, X) { const c = idle(rig, body, set, X).ctrl(0), h = homeOf(rig, c); return { ...h, pelvis: c.pelvis.pos.slice() }; }

// ---- what her furniture is ------------------------------------------------------------------------------------------------
// A clip that sits her down, lays her on a bed, opens a door or takes something off a table is made for a seat, a bed,
// a handle and a table of some height. A person's are 45, 45, 100 and 86 cm. On the 1.63 m test woman those are the
// back of her knee, three quarters of the way up to her shoulder, and her leg's own length: that is what "her own
// size" means on any other body. (The user, DECISIONS 2026-11-14, short NPCs: "children npcs (really short npcs), can
// you figure out a way to adjust the animations proportionally to height".)
export const PERSONS = { seat: 0.45, bed: 0.45, handle: 1.0, table: 0.86 };
/** The furniture her clips are made for, metres: { mode, seat, bed, handle, table }.
    set.furniture "fit" (the default): a person's, wherever her body can use it: a seat and a bed no higher than her
      hips (1.05 of her leg: over 1.18 of her own she gets onto it as a child does, `seated().high`), a handle no
      higher than her hand goes with her elbow still bent (0.6 of her arm over her shoulder), a table no higher than
      a fifth of her arm over her shoulder. An adult's are a person's, and so are a child's, a goblin's and an imp's
      seat and bed; a body bigger than a person keeps a person's and comes down to it. What is still out of her
      reach (a 70 cm creature's chair) the game lifts her onto.
    "own": her own size, whatever she is. "person": a person's, whatever she is.
    set.seat, set.bed, set.handle, set.table (metres) say one outright. */
export function furniture(body, set = {}) {
  const K = body.shank + body.ankleH, sy = body.shoulderY + body.floor, arm = body.upper + body.fore;
  const own = { seat: 0.947 * K, bed: 0.947 * K, handle: 0.751 * sy, table: 0.994 * body.leg };
  const fit = { seat: Math.min(PERSONS.seat, 1.05 * body.leg), bed: Math.min(PERSONS.bed, 1.05 * body.leg), handle: Math.min(PERSONS.handle, sy + 0.6 * arm), table: Math.min(PERSONS.table, sy + 0.2 * arm) };
  const mode = set.furniture === "own" || set.furniture === "person" ? set.furniture : "fit", base = mode === "own" ? own : mode === "person" ? PERSONS : fit, out = { mode };
  for (const k of ["seat", "bed", "handle", "table"]) out[k] = +(typeof set[k] === "number" ? set[k] : base[k]).toFixed(3);
  return out;
}

// ---- sitting ----------------------------------------------------------------------------------------------------------
// where a body ends up on a seat `H` high: the pelvis joint's place (from where it stood), how it's tilted.
// **A high seat** (`high`: one over 1.18 of her own, FEET_ON: a person's chair to a child, a goblin or an imp). Her legs
// can't sit on it with her feet on the floor: with them there her thighs would slope 28 degrees and more, and an
// imp's legs were asked for 1.18 of their length. She sits as a child does: her hip joints a thigh behind the seat's
// edge, her thighs lying on it, her legs hanging from it (sitFrame)
export const FEET_ON = 1.18 * 0.947;
function seated(rig, body, p, S, H) {
  const ks = Math.min(1, p.sc / 0.95), flesh = clamp(0.8 * (body.limbs.thigh_l.bins[2].back || 0.07), 0.05 * ks, 0.13), hipY = H + flesh, dy = hipY - (body.shank + body.ankleH), back = Math.sqrt(Math.max(0.01, body.thigh * body.thigh - dy * dy));
  const tilt = -(9 + 7 * p.weak - 4 * p.strong + 3 * p.heavy) * DEG;         // the pelvis rolled back, as it is on a seat
  const hp = Q.rot(rx(tilt), rig.legL.hip), slope = 5 * DEG, edge = -0.05 * p.sc;
  if (H > FEET_ON * (body.shank + body.ankleH)) return { pos: [0, hipY - hp[1], edge + 0.06 * p.sc - body.thigh * Math.cos(slope) - hp[2]], tilt, chest: (2 + 9 * p.weak - 3 * p.strong) * DEG - 2 * DEG, head: (6 * p.weak) * DEG, flesh, H,
    high: true, slope, edge, perch: body.thigh * Math.cos(slope) - 0.09 * p.sc };                    // (perch: how far in front of where she ends up her pelvis is with her bottom on the seat's front, 3 cm behind its edge)
  return { pos: [0, hipY - hp[1], -back * 0.96 - hp[2] + 0.02 * p.sc], tilt, chest: (2 + 9 * p.weak - 3 * p.strong) * DEG - 2 * DEG, head: (6 * p.weak) * DEG, flesh, H };
}
// A foot standing at `A0` under a hip that has gone further from it than it was as she stood (`far0`): up on its toes,
// the ball staying where it is and the leg let out toward its whole length as the heel comes up; past that the foot is
// off the floor, the leg straight toward where it stood. (Pulled up by the hip, as a child's feet are getting onto a
// chair: no leg is ever asked for more than its length)
function footUnder(body, hip, A0, L, far0) {
  const top = 46 * DEG, most = Math.max(far0, 0.99 * L), at = r => [A0[0], A0[1] + body.ankleH * (Math.cos(r) - 1) + body.foot.ballAhead * Math.sin(r), A0[2] + body.foot.ballAhead * (1 - Math.cos(r)) + body.ankleH * Math.sin(r)];
  const over = r => V.len(V.sub(at(r), hip)) - lerp(far0, most, r / top);
  if (over(0) <= 0) return { ankle: A0, pitch: 0, toe: 0 };
  if (over(top) <= 0) { let a = 0, b = top; for (let i = 0; i < 26; i++) { const m = (a + b) / 2; if (over(m) > 0) a = m; else b = m; } return { ankle: at(b), pitch: -b, toe: b }; }
  const A = at(top), d = V.sub(A, hip), l = V.len(d);
  return { ankle: V.mad(hip, d, most / l), pitch: -top, toe: top * (1 - sm(0, 0.14 * L, l - most)) };
}
// the hands' places on the thighs (the wrist over the thigh's top, a little behind the knee) and which way each palm
// faces there: at the thigh. "Top" is the thigh's own (the side its knee bends toward), not the world's: as she gets
// up and the thigh comes upright the hand stays on its front with the palm to it, and from there back to her side.
// (A palm simply asked to face the floor would, on an arm coming down toward the knee, face away from the leg.)
export function onThighs(rig, body, pose, p, legs) {
  const out = {}, { P, D } = pose.solve(), fwd = Q.rot(D[rig.pelvis], [0, 0, 1]);
  for (const s of ["l", "r"]) { const g = s === "l" ? 1 : -1, K = pose.info["kneeAt_" + s], L = rig.leg(s), H = [P[L.up * 3], P[L.up * 3 + 1], P[L.up * 3 + 2]], along = V.norm(V.sub(H, K));
    const bent = V.perp(V.sub(K, V.lerp(H, legs[s].ankle, 0.5)), along), lb = V.len(bent), top = V.norm(V.add(V.mul(bent, sm(0.02, 0.1, lb) / (lb || 1)), V.mul(V.norm(V.perp(fwd, along)), 1 - sm(0.02, 0.1, lb))));
    const r = (body.limbs["thigh_" + s].bins[4].front || 0.06) + 0.01, side = V.norm(V.cross(top, along));   // (side: toward her left)
    out[s] = V.add(V.add(K, V.mul(along, (0.4 + 0.08 * p.fem) * body.thigh)), V.add(V.mul(side, g * (-0.02 * p.fem + 0.01 * p.masc)), V.mul(top, r + 0.022)));
    out["palm_" + s] = V.norm(V.add(V.mul(top, -1), V.mul(along, -0.1))); }
  return out;
}
export const baseLegs = base => ({ l: { ankle: base.c.legs.l.ankle.slice(), yaw: base.c.legs.l.yaw, pitch: 0 }, r: { ankle: base.c.legs.r.ankle.slice(), yaw: base.c.legs.r.yaw, pitch: 0 } });   // the feet where the idle has them: no act shuffles them
function sitFrame(rig, body, p, S, base, Z, a) {              // a: { down 0..1 (stood .. sat), lean, rock, hands 0..1, press, breath, drop, swing: { l, r } degrees,
                                                              //      rest: { l, r: { to, via, palm, pole, curl }, far }: where her hands go instead of onto her thighs (a bed's top beside her),
                                                              //      restK 0..1: how much there and how much on her thighs (1) }
  const c = { legs: baseLegs(base), breath: a.breath || 0, press: { seat: a.press || 0 } }, dn = a.down, kz = Math.pow(dn, 0.8), ky = Math.pow(dn, 1.25);   // (the hips go back before they go down; `down` comes eased already)
  const sp = base.pelvis, pos = [sp[0] * (1 - kz), lerp(sp[1], Z.pos[1], ky) - (a.sink || 0), lerp(sp[2], Z.pos[2], kz)];
  // (onto a high seat: her bottom to its front first, down to it or up onto it, a hop when it's over her hips; then
  //  she slides back. Hips that went back first would be over the seat with nothing under them and her feet off the floor)
  if (Z.high) { const kp = sm2(0, 0.5, dn), kb = Math.pow(sm2(0.34, 1, dn), 0.9), zp = Z.pos[2] + Z.perch, hop = Z.pos[1] > sp[1] - 0.02 * p.sc ? 0.03 * p.sc * hump(0, 0.8, dn) : 0;
    pos[0] = sp[0] * (1 - kp); pos[1] = lerp(sp[1], Z.pos[1], kp) - (a.sink || 0) + hop; pos[2] = lerp(lerp(sp[2], zp, kp), Z.pos[2], kb); }
  if (dn > 0) { const out = (9 * p.masc - 6 * p.fem + 4 * p.heavy) * DEG * dn; c.legs.l.poleYaw = c.legs.l.yaw * 0.6 * (1 - dn) + (S.toe * 0.5) * dn + out; c.legs.r.poleYaw = c.legs.r.yaw * 0.6 * (1 - dn) - (S.toe * 0.5) * dn - out; }
  c.pelvis = { pos, yaw: base.c.pelvis.yaw * (1 - dn), roll: base.c.pelvis.roll * (1 - dn), pitch: lerp(S.tilt, Z.tilt, ease(dn)) + 0.45 * (a.lean || 0) + (a.rock || 0) };
  c.chest = { yaw: base.c.chest.yaw * (1 - dn), roll: base.c.chest.roll * (1 - dn), pitch: lerp(S.lean, Z.chest, ease(dn)) + (a.lean || 0) + 1.4 * (a.rock || 0) };
  c.head = { yaw: 0, roll: base.c.head.roll * (1 - dn), pitch: lerp(S.head, Z.head, dn) + 0.35 * (a.lean || 0) + (a.look || 0) };
  const hang = s => ({ ...S.arm, flex: S.arm.flex + 0.5 * (a.lean || 0) + 10 * DEG * dn, elbow: S.arm.elbow + 18 * DEG * dn, hang: 0.85 });
  c.arms = { l: hang("l"), r: hang("r") };
  if (Z.high) {
    // her legs: each foot where it stood until her hip joint is over the seat (up on its toes, or off the floor, when
    // the hip has gone too far for it), then let go of the floor as her thigh comes onto the seat, to hang from its
    // edge: the shin a little ahead of straight down (never back into what she sits on), the toes drooped
    const Dq = Q.mul(ry(c.pelvis.yaw), Q.mul(rz(c.pelvis.roll), rx(c.pelvis.pitch))), D0 = Q.mul(ry(base.c.pelvis.yaw || 0), Q.mul(rz(base.c.pelvis.roll || 0), rx(base.c.pelvis.pitch || 0))), L = body.thigh + body.shank;
    for (const s of ["l", "r"]) { const off = rig.leg(s).hip, hip = V.add(pos, Q.rot(Dq, off)), A0 = c.legs[s].ankle, st = footUnder(body, hip, A0, L, V.len(V.sub(A0, V.add(sp, Q.rot(D0, off)))));
      // (where it hangs is under where her knee will be once she has slid back, not under where it is now: let go
      //  under a knee that still stuck out in front, the foot shot 20 cm forward and came back with her. And it comes
      //  up over the whole of the slide: over the first of it only, an imp's legs, pulled straight by the hop, folded
      //  36 degrees in a frame)
      const w = sm(0.035 * p.sc, 0.03 * p.sc + 0.85 * Z.perch, Z.edge - hip[2]), th = (4 + ((a.swing && a.swing[s]) || 0)) * DEG, ky2 = hip[1] - body.thigh * Math.sin(Z.slope), kz2 = hip[2] + (Z.pos[2] - pos[2]) + body.thigh * Math.cos(Z.slope);
      c.legs[s].ankle = mixA(st.ankle, [lerp(hip[0], A0[0], 0.5), ky2 - body.shank * Math.cos(th), kz2 + body.shank * Math.sin(th)], w); c.legs[s].pitch = lerp(st.pitch, -26 * DEG, w); if (st.toe * (1 - w) > 1e-4) c.legs[s].toe = st.toe * (1 - w); }
    // her hands: on the seat beside her while she gets onto it and pushes herself back, then on her thighs
    const prop = sm(0.02, 0.42, dn) * (1 - sm(0.78, 0.98, dn)), hk = a.hands || 0, w = prop + hk;
    if (w > 0.001) { const home = homeOf(rig, c), rk = a.rest ? a.restK ?? 1 : 0, T = rk > 0.999 ? null : onThighs(rig, body, home.pose, p, c.legs);
      for (const s of ["l", "r"]) { const g = s === "l" ? 1 : -1, onSeat = [g * (body.half.hips + 0.05 * p.sc), Z.H + 0.16 * rig.armL.handLen, Z.edge - 0.07 * p.sc], m = hk / w, th = T && { to: T[s], palm: T["palm_" + s], pole: [g * 0.8, -0.35, -0.5], curl: 0.35 };
        const to = !th ? a.rest[s] : rk < 0.001 ? th : { to: mixA(th.to, a.rest[s].to, rk), palm: V.norm(mixA(th.palm, a.rest[s].palm, rk)), pole: V.norm(mixA(V.norm(th.pole), V.norm(a.rest[s].pole), rk)), curl: lerp(th.curl, a.rest[s].curl, rk) };
        c.arms[s] = armTo(home, s, mixA(onSeat, to.to, m), clamp(w, 0, 1), { palm: V.norm(mixA([0, -1, 0], to.palm, m)), pole: V.norm(mixA([g * 0.35, -0.3, -0.9], V.norm(to.pole), m)), curl: lerp(0.18, to.curl, m), far: 0.985 * (body.upper + body.fore) }); } }
    return c;
  }
  if (a.hands > 0.001 && a.rest) { const home = homeOf(rig, c), rk = a.restK ?? 1, T = rk > 0.999 ? null : onThighs(rig, body, home.pose, p, c.legs);
    for (const s of ["l", "r"]) { const r = a.rest[s];
      c.arms[s] = !T ? armTo(home, s, r.to, a.hands, { via: r.via, palm: r.palm, pole: r.pole, curl: r.curl, far: a.rest.far })
        : armTo(home, s, mixA(T[s], r.to, rk), a.hands, { palm: V.norm(mixA(T["palm_" + s], r.palm, rk)), pole: V.norm(mixA(V.norm([s === "l" ? 0.8 : -0.8, -0.35, -0.5]), V.norm(r.pole), rk)), curl: lerp(0.35, r.curl, rk), far: a.rest.far }); } }
  else if (a.hands > 0.001) { const home = homeOf(rig, c), T = onThighs(rig, body, home.pose, p, c.legs);
    for (const s of ["l", "r"]) c.arms[s] = armTo(home, s, T[s], a.hands, { palm: T["palm_" + s], pole: [s === "l" ? 0.8 : -0.8, -0.35, -0.5], curl: 0.35 }); }
  return c;
}
/** sitting down, sitting, standing up: { sit_down, sit_loop, stand_up } for a seat `H` m high (furniture().seat) */
export function sitting(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), H = furniture(body, set).seat, Z = seated(rig, body, p, S, H), effort = clamp(0.5 * p.heavy + 0.6 * p.weak - 0.3 * p.strong, 0, 1.2);
  // (a high seat: she doesn't fold forward over her feet to get onto it or off it, she slides; her legs swing as they
  //  come off the floor, a kick forward and a few swings that die down, and now and then as she sits)
  const hi = !!Z.high, lk = hi ? 0.6 : 1, kick = (t, tl, ph) => 11 * sm(tl - 0.55, tl - 0.05, t) * Math.exp(-Math.max(0, t - tl) * 2) * Math.cos(Math.max(0, t - tl) * 5 + ph);
  const leanMax = (34 + 9 * p.heavy + 7 * p.weak - 6 * p.strong) * DEG * lk, meta = { seat: { height: H, edge: +(-0.05 * p.sc).toFixed(3), pelvis: Z.pos.map(v => +v.toFixed(3)), ...(hi ? { high: true } : {}) } };
  // down: a controlled lowering; a weak or heavy body lets go for the last of it and lands
  const Td = 1.9 + 0.5 * p.heavy + 0.4 * p.weak - 0.2 * p.strong, drop = clamp(0.1 + 0.25 * effort, 0.08, 0.42), tc = 0.72 * Td, nd = Math.round((Td + 0.9) * FPS);
  const downAt = t => { const u = clamp(t / tc, 0, 1), a = 1 - drop; return u < 0.8 ? a * sm2(0.06, 0.8, u) : a + drop * Math.pow((u - 0.8) / 0.2, 1.6 + effort); };   // (the end of it faster: let go)
  const sitDown = f => { const t = f / FPS, dn = downAt(t), after = Math.max(0, t - tc), hit = effort * Math.exp(-after * 5) * Math.sin(after * 11), land = t >= tc ? 1 : 0;
    return sitFrame(rig, body, p, S, base, Z, { down: dn, lean: leanMax * hump(0.05 * tc, 1.25 * tc, t) * (1 - 0.35 * land * sm(tc, tc + 0.5, t)), rock: -5 * DEG * hit * land - 3 * DEG * land * sm(tc, tc + 0.25, t) * (1 - sm(tc + 0.25, tc + 0.8, t)),
      sink: land ? 0.012 * (0.4 + effort) * Math.exp(-after * 6) * Math.cos(after * 12) + 0.006 * (1 - Math.exp(-after * 6)) : 0, press: sm(tc - 0.05, tc + 0.12, t), hands: sm(tc * 0.55, tc + 0.7, t) * (effort > 0.25 ? 1 : sm(tc, tc + 0.7, t)), look: 9 * DEG * hump(0, tc, t), breath: 0,
      ...(hi ? { swing: { l: kick(t, tc, 0), r: kick(t, tc, 0.9) } } : {}) }); };
  // sat: breathing, a small shift of the weight
  const Ns = 8 * FPS, sitLoop = f => { const t = (f % Ns) / FPS, b = Math.sin(TAU * t / 4), w = Math.sin(TAU * t / 8);
    const sw = hi ? 4 * Math.pow(Math.sin(Math.PI * t / 8), 2) : 0;                       // (her legs swung a little, one then the other, for a few seconds of every eight)
    const c = sitFrame(rig, body, p, S, base, Z, { down: 1, lean: -0.5 * DEG * b + 0.6 * DEG * w, sink: 0.006, press: 1, hands: 1, breath: b, ...(hi ? { swing: { l: sw * Math.sin(TAU * t / 2), r: -sw * Math.sin(TAU * t / 2) } } : {}) }); c.pelvis.pos[0] += 0.004 * w; c.chest.roll = 0.5 * DEG * w; c.head.yaw = 2 * DEG * Math.sin(TAU * t / 8 + 0.8); return c; };
  // up: the trunk thrown forward over the feet (the heavier or weaker, the further and with a rock back first), then the legs
  const Tu = 1.7 + 0.6 * p.heavy + 0.5 * p.weak - 0.2 * p.strong, t0 = 0.28 * Tu + 0.2 * effort, nu = Math.round((Tu + 0.5) * FPS), upLean = (38 + 10 * p.heavy + 8 * p.weak - 6 * p.strong) * DEG * lk;
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
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), H = furniture(body, set).bed, Z = seated(rig, body, p, S, H), effort = clamp(0.5 * p.heavy + 0.6 * p.weak - 0.3 * p.strong, 0, 1.2);
  // (ks: a small body's share of the distances that were written in a person's centimetres, 1 on anyone a person's
  //  size or bigger. far: no hand is asked further than her arm goes, see armTo. On a high bed she gets onto its edge
  //  as onto a high seat, and her legs come up onto it from where they hang)
  const ks = Math.min(1, p.sc / 0.95), hi = !!Z.high, lk = hi ? 0.6 : 1, far = 0.985 * (body.upper + body.fore);
  const leanMax = (30 + 8 * p.heavy + 6 * p.weak - 5 * p.strong) * DEG * lk, slab = body.slabs.reduce((a, s) => (Math.abs(s.y - body.levels.seat) < Math.abs(a.y - body.levels.seat) ? s : a), body.slabs[0]);
  const rb = clamp(0.84 * (rig.J[rig.pelvis].at[2] - slab.zb), 0.07 * ks, 0.2), LY = H + rb, lie = [0.04 * p.sc, LY, Z.pos[2] - 0.13 * p.sc];   // the pelvis lain down: on its back, further onto the bed
  // (sat: her legs as she sits on its edge, which is where they leave from. They used to leave from where a person's
  //  stand and with the knees straight ahead: an ogre sits on a person's bed with its knees up and turned out, and in
  //  the frame it began to lie down they jumped 27 cm inward, its thighs 44 degrees)
  const legL = body.thigh + body.shank, ankR = Math.max(0.04 * ks, body.r.calf * 0.55), sat = sitFrame(rig, body, p, S, base, Z, { down: 1 }).legs;
  // Her hands, sat on the bed's edge: on the bed beside her, where they prop her as she lies back and push her up
  // again. (They used to hang at her sides until she turned: a hanging hand beside a hip that is on a bed is in the
  // mattress, a person's fingers 7 cm, a ghoul's whole hand.) `bedAt(x)`: those two places for a pelvis at x
  const bedAt = x => ({ l: [x + 0.3 * p.sc, H + 0.02 * ks, Z.pos[2] + 0.02 * ks], r: [x - 0.22 * p.sc, H + 0.02 * ks, Z.pos[2] + 0.1 * ks] }), VIA = { l: [0.25, 0.12], r: [0.22, 0.15] };
  const POLE = { l: [0.5, -0.35, -0.8], r: [-0.55, -0.3, -0.78] }, LAIN = { l: [0.9, -0.1, 0.1], r: [-0.9, -0.1, -0.15] }, PALM = { l: [0, 0.2, -1], r: [0, 0.1, -1] }, CURL = { l: 0.3, r: 0.32 };
  const onBed = (() => { const B0 = bedAt(Z.pos[0]), D0 = rx(Z.tilt), o = { far }; for (const s of ["l", "r"]) o[s] = { to: B0[s], via: [B0[s][0], H + VIA[s][0] * ks, B0[s][2] + VIA[s][1] * ks], palm: Q.rot(D0, PALM[s]), pole: Q.rot(D0, POLE[s]), curl: CURL[s] }; return o; })();
  const Tsit = 1.5 + 0.4 * p.heavy + 0.3 * p.weak, tc = 0.74 * Tsit, Tturn = 1.9 + 0.5 * p.heavy + 0.4 * p.weak, Tset = 1.1, T = Tsit + 0.35 + Tturn + Tset, n = Math.round(T * FPS);
  const t1 = Tsit + 0.35, t2 = t1 + Tturn;
  // a frame by how far lain (0 sat on the edge .. 1 on her back), the legs' own way up (legs 0..1), settled 0..1
  const lying = (down, ln, legs, settle, breath, a = {}) => {
    const dn = down;                                          // (sat: all of sitFrame's)
    if (ln <= 0) return sitFrame(rig, body, p, S, base, Z, { down: dn, lean: a.lean || 0, rock: a.rock || 0, sink: a.sink || 0, press: a.press || 0, hands: a.hands || 0, rest: onBed, look: a.look || 0, breath });
    const k = ease(ln), yawA = -90 * DEG * ease(clamp(ln * 1.25, 0, 1)), rec = 90 * DEG * ease(clamp((ln - 0.12) / 0.88, 0, 1));
    const Dy = ry(yawA), lat = Q.rot(Dy, [1, 0, 0]), Dp = Q.mul(Q.axis(lat, -rec), Q.mul(Dy, rx(Z.tilt * (1 - k))));      // turned to face the bed's foot, then laid back
    const pos = [lerp(Z.pos[0], lie[0], k), lerp(Z.pos[1] - 0.006, lie[1], sm(0.25, 1, ln)) + 0.035 * p.sc * hump(0, 0.9, ln), lerp(Z.pos[2], lie[2], ease(clamp(ln * 1.1, 0, 1)))];
    const c = { breath, press: { seat: 1 - k, back: sm(0.75, 1, ln) }, pelvis: { pos, q: Dp } };
    const curlUp = hump(0.1, 1.05, ln) * (1 - settle);       // the trunk curled forward while it's lowered, the head held up till it's down
    c.chest = { q: Q.mul(Dp, rx((14 * curlUp + 2) * DEG + Z.chest * (1 - k))) }; c.head = { q: Q.mul(c.chest.q, Q.mul(rx((16 * curlUp + 9 * k) * DEG), ry(-14 * DEG * settle))) }; c.neck = 0.5;
    // the legs: off the floor, drawn up, swung onto the bed, let out along it
    const hipW = s => V.add(pos, Q.rot(Dp, rig.leg(s).hip)), foot = {};
    for (const s of ["l", "r"]) { const g = s === "l" ? 1 : -1, F0 = sat[s].ankle, hip = hipW(s), out = s === "l" ? 0.985 : 0.93;   // (her right leg a little bent: nobody sleeps to attention)
      // (over the bed's edge, not through it: the foot is lifted in front of the edge until it's over the bed's top,
      //  the knee folding, and only then carried back onto it. Curved toward a point behind the edge and 20 cm over
      //  the bed, every body's ankle went 2 to 5 cm into the mattress's corner on the way)
      const end = [hip[0] - legL * out, H + ankR, hip[2] + g * -0.02 * ks + (s === "r" ? 0.05 * ks : 0)], mid = [hip[0] - 0.42 * legL, H + 0.4 * p.sc + ankR, Math.max(hip[2] * 0.5 + 0.12 * ks, 0.05 * p.sc)];
      const u = clamp(legs + (s === "l" ? 0.06 : -0.06), 0, 1), A = u <= 0 ? F0 : bez(F0, mid, end, ease(u));
      const fq = Q.slerp(Q.mul(ry(sat[s].yaw || 0), Q.mul(rx(-(sat[s].pitch || 0)), ry(-rig.leg(s).yaw0))), Q.mul(Dp, Q.mul(ry(g * 16 * DEG), rx(30 * DEG))), ease(u)), py = sat[s].poleYaw || 0;
      foot[s] = { ankle: A, q: fq, pole: V.norm(mixA(Q.rot(Dy, [Math.sin(py), 0, Math.cos(py)]), [0.1 * g, 1, 0.25 * g], ease(u))) }; }
    c.legs = foot;
    // the arms: the hand of the side she lies toward props her on the bed, the other steadies; then one on her belly, one beside her
    // the arms: her hands on the bed beside her prop her as she lies back; then one on her belly, one beside her
    const prop = 1 - sm(0.72, 1, ln), rest = sm(0.7, 1, ln), B = bedAt(pos[0]), bedL = B.l, bedR = B.r;
    const belly = V.add(pos, Q.rot(Dp, [0.05 * p.sc, 0.2 * (body.levels.under - body.crotchY) + 0.1 * ks, (body.apex.belly[2] - rig.J[rig.pelvis].at[2]) + 0.035 * ks]));
    // (beside her, her wrist half a hand's width and a little over the bed, by her hand's own size: a ghoul's is twice
    //  a person's; the forearm level, so the hand lies along the bed and doesn't point down into it)
    const side = V.add(pos, Q.rot(Dp, [-(body.half.hips + 0.1 * ks), 0.1 * ks, -rb + Math.max(0.035 * ks, 0.36 * rig.armR.handLen)]));
    // (the elbows behind her as she props herself, where a hanging arm's already are: asked out to the sides, an arm
    //  whose hand hardly moved swung its elbow a quarter turn round in three frames, 43 degrees in one on a hag; lain,
    //  out to her sides and level, so they lie on the bed and not in it)
    const lw = prop + rest, la = lw > 1e-3 ? mixA(bedL, belly, rest / lw) : bedL, rw = prop + rest, ra = rw > 1e-3 ? mixA(bedR, side, rest / rw) : bedR, m = lw > 1e-3 ? rest / lw : 0;
    // (her arms leave from how they hang as she sits, sitFrame's: started from a standing arm's angles, both jumped 25
    //  degrees in the frame she began to turn)
    const hk = 1 - sm(0, 0.5, ln), hung = { ...S.arm, flex: S.arm.flex + 10 * DEG * hk, elbow: S.arm.elbow + 18 * DEG * hk, hang: lerp(0.3, 0.85, hk) };
    c.arms = { l: { ...hung }, r: { ...hung } }; const home = homeOf(rig, c);
    c.arms = { l: armTo(home, "l", la, clamp(lw, 0, 1), { via: [bedL[0], H + VIA.l[0] * ks, bedL[2] + VIA.l[1] * ks], palm: Q.rot(Dp, PALM.l), pole: Q.rot(Dp, V.norm(mixA(V.norm(POLE.l), LAIN.l, m))), curl: CURL.l, far }),
      r: armTo(home, "r", ra, clamp(rw, 0, 1), { via: [bedR[0], H + VIA.r[0] * ks, bedR[2] + VIA.r[1] * ks], palm: Q.rot(Dp, V.norm(mixA(PALM.r, [1, 0, -0.25], m))), pole: Q.rot(Dp, V.norm(mixA(V.norm(POLE.r), LAIN.r, m))), curl: lerp(CURL.r, 0.14, m), far }) };   // (lain, the hand beside her on its edge, its palm to her thigh: palm down, its thumb and a long hand's curled fingers were in the bed)
    return c;
  };
  const sitPart = t => { const u = clamp(t / tc, 0, 1), drop = clamp(0.1 + 0.25 * effort, 0.08, 0.42), a = 1 - drop, dn = u < 0.8 ? a * sm2(0.06, 0.8, u) : a + drop * Math.pow((u - 0.8) / 0.2, 1.6 + effort), after = Math.max(0, t - tc), land = t >= tc ? 1 : 0;
    return { down: dn, lean: leanMax * hump(0.05 * tc, 1.25 * tc, t), rock: -4 * DEG * effort * Math.exp(-after * 5) * Math.sin(after * 11) * land, sink: land ? 0.01 * (0.4 + effort) * Math.exp(-after * 6) * Math.cos(after * 12) + 0.006 * (1 - Math.exp(-after * 6)) : 0, press: sm(tc - 0.05, tc + 0.12, t), look: 8 * DEG * hump(0, tc, t), hands: sm(0.55 * tc, tc + 0.4, t) }; };
  const lieDown = f => { const t = f / FPS; if (t <= t1) return lying(sitPart(t).down, 0, 0, 0, 0, sitPart(t)); const ln = sm2(t1, t2, t); return lying(1, ln, sm2(t1 + 0.12 * Tturn, t2 - 0.1 * Tturn, t), sm(t2 - 0.2, T - 0.15, t), 0); };
  const Ns = 10 * FPS, sleepLoop = f => { const t = (f % Ns) / FPS, b = Math.sin(TAU * t / 5), c = lying(1, 1, 1, 1, b); c.pelvis.pos[1] += 0.0015 * b; return c; };
  // up again: the same road back, the push off the bed first; then to her feet as from any seat
  const Tup = Tturn * 1.3, Trise = 1.7 + 0.6 * p.heavy + 0.5 * p.weak - 0.2 * p.strong, t0r = 0.28 * Trise + 0.2 * effort, u1 = 0.35 + Tup, Tg = u1 + 0.45 + Trise + 0.4, ng = Math.round(Tg * FPS), upLean = (38 + 10 * p.heavy + 8 * p.weak - 6 * p.strong) * DEG * lk;
  const getUp = f => { const t = f / FPS; if (t <= u1) { const back = 1 - sm2(0.35, u1, t); return lying(1, back, 1 - sm2(0.35 + 0.1 * Tup, u1 - 0.12 * Tup, t), back * (1 - sm(0, 0.9, t)), 0, { hands: 1 }); }
    const tt = t - u1 - 0.45, dn = 1 - sm2(t0r, Trise, tt), push = effort > 0.25 ? sm(-0.4, 0, tt) * (1 - sm(t0r + 0.35 * (Trise - t0r), Trise * 0.95, tt)) : 0;
    return sitFrame(rig, body, p, S, base, Z, { down: dn, lean: upLean * hump(0, Trise * 1.02, tt) * (0.55 + 0.45 * sm(0, t0r, tt)), sink: 0.006 * (1 - sm(t0r - 0.1, t0r + 0.1, tt)), press: 1 - sm(t0r - 0.08, t0r + 0.1, tt),
      // (her hands leave the bed before her trunk comes forward over them, as they came down onto it after she had
      //  sat: left on it while she rose, a folded arm's elbow swung under its shoulder, 57 degrees in a frame on a
      //  hag, and left behind her until she was up, an arm flipped right over. A weak or heavy body's go to its thighs
      //  from there and push it up, as from any seat)
      hands: Math.max(1 - sm(-0.4, 0.8 * t0r, tt), push), rest: onBed, restK: (1 - sm(-0.4, 0.8 * t0r, tt)) / Math.max(1e-6, 1 - sm(-0.4, 0.8 * t0r, tt) + push), look: 5 * DEG * hump(0, Trise, tt), breath: 0 }); };
  const end = lying(1, 1, 1, 1, 0), headAt = (() => { const P = build(rig, end).solve().P, j = rig.head; return [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]].map(v => +v.toFixed(3)); })();
  const meta = { bed: { height: H, edge: +(-0.05 * p.sc).toFixed(3), pelvis: lie.map(v => +v.toFixed(3)), head: headAt, side: "l", ...(hi ? { high: true } : {}) } };
  return [
    { name: "lie_down", loop: false, n, fps: FPS, secs: (n - 1) / FPS, ctrl: lieDown, events: [{ t: tc, name: "seated" }, { t: t2, name: "lain" }], meta },
    { name: "sleep_loop", loop: true, n: Ns, fps: FPS, secs: Ns / FPS, ctrl: sleepLoop, events: [], meta },
    { name: "get_up", loop: false, n: ng, fps: FPS, secs: (ng - 1) / FPS, ctrl: getUp, events: [{ t: u1, name: "sat_up" }, { t: u1 + 0.45 + t0r, name: "risen" }], meta },
  ];
}

// ---- a hand to something: a door's handle, a thing to pick up --------------------------------------------------------
// the standing body leaning into a reach: where the pelvis and the chest go for a hand that has to get to `to`
export function leanFrame(rig, body, p, S, base, a) {               // a: { fwd (m), down (m), pitch, yaw, side (m), heel 0..1, look: [pitch, yaw], squat 0..1 }
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
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), hy = furniture(body, set).handle, arm = body.upper + body.fore, reach = arm * 0.93, slow = 1 + 0.25 * p.heavy + 0.2 * p.weak - 0.1 * p.strong;
  // How far her hand goes with the door, and her body after it, is by her arm: a person's hand follows a pushed door
  // 26 cm, and a child's arm (37 cm where a woman's is 44) was straight long before that, the elbow snapping back
  // 47 degrees in a frame as she let go (a person's own, and anyone's with an arm that long, stay as they were)
  const ts = Math.min(1, arm / 0.41), grip = 0.075 * p.sc, hx = -body.shoulderHalf * 0.85, sy0 = body.shoulderY + body.floor;
  // How her body gets her hand to it. A handle over her shoulder (a goblin's, a small child's: a person's handle is
  // as high as she can take hold of): up on her toes. One far under it (a body bigger than a person: an ogre's
  // shoulder is 1.2 m over a person's handle and its arm 1.07 m long, so its hand stopped 20 cm over it): bent down to
  // it, the knees giving, until the handle is no further under her shoulder than nine tenths of her reach. (A tall
  // man's hand gets to it with his arm nearly straight down, 0.94 of his reach under his shoulder: he stands as he did)
  const heel = clamp(((hy - sy0) / arm - 0.25) / 0.35, 0, 1), bend = u => ({ pitch: Math.min(13 * u, 68) * DEG, down: Math.min(0.06 * u, 0.42) * p.sc, squat: clamp(u / 3, 0, 1) });
  let stoop = 0, sh = [0, sy0, 0];
  if (heel > 0 || hy - sy0 < -0.97 * reach) {
    const at = u => homeOf(rig, leanFrame(rig, body, p, S, base, { k: 1, heel, ...(u > 0 ? { ...bend(u), fwd: -0.02 * u * p.sc } : {}) })).shoulder.r, s0 = homeOf(rig, leanFrame(rig, body, p, S, base, { k: 1 })).shoulder.r;
    if (heel <= 0) for (stoop = 0.1; stoop < 6; stoop += 0.1) if (hy - at(stoop)[1] >= -0.9 * reach) break;
    const s1 = at(stoop); sh = [0, sy0 + (s1[1] - s0[1]), s1[2] - s0[2]];                     // (her shoulder as she takes hold of it, from where it is as she stands)
  }
  const dy = hy - sh[1], hz = sh[2] + Math.sqrt(Math.max(0.02 * ts * ts, reach * reach - dy * dy)) + grip + 0.03 * p.sc;   // as far in front as a bent arm takes the hand: she stands back from the door
  // How long her hand takes to get there and back is by how far her arm has to swing up from where it hangs: a
  // person's handle is 38 degrees up from a woman's hanging arm, a child's is level with her shoulder (88) and an
  // imp's over its head (130), and brought back in the same third of a second the arm turned 40 to 57 degrees a frame
  const swing = Math.atan2(hz - grip - sh[2], -dy) / DEG, q = Math.max(1, swing / 56);
  const mk = (name, kind) => {
    const T0 = (kind === "slide" ? 2.2 : kind === "pull" ? 2.3 : 2.0) * slow, tg = 0.5 * slow * q, tt = tg + 0.22, to = tt + 0.12, te = to + (kind === "slide" ? 0.75 : 0.62) * slow, tr = te + 0.12;
    const back = T0 - 0.12 - (0.5 * slow + 0.22 + 0.12 + (kind === "slide" ? 0.75 : 0.62) * slow + 0.12), T = T0 + (tg - 0.5 * slow) + (q - 1) * back, n = Math.round(T * FPS);   // (back: the time her hand has to come home in)
    const handle = [hx, hy, hz], travel = (kind === "push" ? [0.05, -0.02, 0.26] : kind === "pull" ? [-0.1, -0.02, -0.27] : [-0.52, 0, 0.0]).map(v => v * ts);
    const ctrl = f => { const t = f / FPS, k = sm2(0.05, tg, t) * (1 - sm2(tr, T - 0.12, t)), mv = sm2(to, te, t), turn = sm(tg, tt, t) * (1 - sm(te, tr, t));
      const tgt = V.add(V.add(handle, V.mul(travel, mv)), [0, -0.03 * ts * turn * (kind === "slide" ? 0 : 1), -grip]);
      const w = kind === "push" ? 1 : kind === "pull" ? -1 : 0, lean = sm(tg * 0.5, tt, t) * (1 - sm(tr, T, t)), bk = sm(0.04, 0.92 * tg, t) * (1 - sm(tr, T - 0.08, t));   // (bk: on her toes, or bent to it, by the time she takes hold of it)
      const c = leanFrame(rig, body, p, S, base, { k: sm(0, tg, t) * (1 - sm(tr, T, t)), fwd: (0.03 * lean + w * 0.07 * mv * (1 - sm(tr, T, t))) * ts - (stoop > 0 ? 0.02 * stoop * p.sc * bk : 0), pitch: (5 * lean + w * 5 * mv * (1 - sm(tr, T, t))) * DEG + (stoop > 0 ? bend(stoop).pitch * bk : 0),
        yaw: (-6 * lean - (kind === "slide" ? 16 : kind === "pull" ? -8 : 5) * mv * (1 - sm(tr, T, t))) * DEG, side: (kind === "slide" ? -0.05 : kind === "pull" ? 0.02 : 0) * ts * mv * (1 - sm(tr, T, t)), look: [7 * DEG * k, -8 * DEG * k],
        ...(heel > 0 ? { heel: heel * bk } : {}), ...(stoop > 0 ? { down: bend(stoop).down * bk, squat: bend(stoop).squat * bk } : {}) });
      const home = homeOf(rig, c);
      // (a hand that has to come up to her shoulder's height or over it goes round her shoulder at arm's length, as an
      //  arm swung up does, and back the same way. Taken straight there and back, as a person's hand is to a handle at
      //  her waist, it passed close by her shoulder: the elbow folded and opened again, 40 degrees in a frame)
      let via = null;
      if (q > 1) { const Sh = home.shoulder.r, W0 = home.info.wristAt_r, da = V.norm(V.sub(W0, Sh)), db = V.norm(V.sub(tgt, Sh)), mid = V.add(da, db), lm = V.len(mid);
        if (lm > 0.2) { const M = V.mad(Sh, V.mul(mid, 1 / lm), 0.96 * arm), arc = V.sub(V.mul(M, 2), V.mul(V.add(W0, tgt), 0.5)), straight = [(W0[0] + tgt[0]) / 2 - 0.04, (W0[1] + tgt[1]) / 2 + 0.02, (W0[2] + tgt[2]) / 2 + 0.05];
          via = mixA(straight, arc, clamp((q - 1) / 0.4, 0, 1)); } }
      c.arms.r = armTo(home, "r", tgt, k, { palm: kind === "slide" ? [1, 0, 0.2] : [0.3, -1, 0], pole: [-0.75, -0.6, -0.2], curl: lerp(0.3, 0.95, sm(tg - 0.08, tg + 0.06, t) * (1 - sm(tr - 0.05, tr + 0.1, t))), wrist: -8 * DEG * turn, ...(via ? { via } : {}) });
      return c; };
    // (shoulder, arm, grip: her shoulder as she takes hold of it, her arm's length, and where the middle of her
    //  closed hand is from her wrist then. In the game that middle is put on the handle, wherever the handle is, so
    //  her wrist has to get to `grip` short of it: a handle lower than this was made for is out of her arm's reach
    //  from where the clip stands her, and whoever plays it stands her nearer by these: motion.gd handle_ahead())
    const grab = build(rig, ctrl(Math.round(tg * FPS))), gs = grab.solve(), A = rig.armR, hold = Q.rot(gs.D[A.hand], [0, 1, 2].map(k => A.handDir[k] * 0.085 * (A.handLen / 0.17) + A.palm0[k] * 0.022));
    const shAt = [gs.P[A.up * 3], gs.P[A.up * 3 + 1], gs.P[A.up * 3 + 2]];
    return { name, loop: false, n, fps: FPS, secs: (n - 1) / FPS, ctrl, events: [{ t: tg, name: "grab" }, { t: to, name: "open" }, { t: tr, name: "release" }],
      meta: { door: { kind, hand: "r", handle: handle.map(v => +v.toFixed(3)), travel: travel.map(v => +v.toFixed(3)), opens: +(te - to).toFixed(2), shoulder: shAt.map(v => +v.toFixed(3)), arm: +arm.toFixed(3), grip: hold.map(v => +v.toFixed(3)) } } };
  };
  return [mk("open_push", "push"), mk("open_pull", "pull"), mk("open_slide", "slide")];
}
/** reaching for something with the right hand and taking it (mirrored: the left): { reach_low, reach_mid, reach_high }.
    meta.reach says where the hand closes, from where she stands; `grab` when; `put_away` when the hand lets go again. */
export function reaching(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = basePose(rig, body, set, X), effort = clamp(0.5 * p.heavy + 0.6 * p.weak - 0.3 * p.strong, 0, 1.2), slow = 1 + 0.3 * p.heavy + 0.25 * p.weak - 0.1 * p.strong, grip = 0.075 * p.sc;
  const sy = body.shoulderY + body.floor, arm = body.upper + body.fore, table = furniture(body, set).table;
  const mk = (name, lvl) => {
    const tgt = lvl === "low" ? [-0.1 * p.sc, 0.1, 0.36 * p.sc] : lvl === "mid" ? [-body.shoulderHalf * 0.8, table, 0.42 * p.sc] : [-body.shoulderHalf * 0.8, sy + 0.86 * arm - 0.05, 0.3 * p.sc];
    const T = (lvl === "low" ? 3.3 : lvl === "mid" ? 2.3 : 3.0) * slow, tg = (lvl === "low" ? 1.2 : lvl === "mid" ? 0.8 : 1.05) * slow, th = tg + 0.3, tb = T - 0.4, n = Math.round(T * FPS);   // (out, a moment on it, and a slower way back: an arm let down, not snatched)
    // how the body gets the hand there: low, the knees and the hips fold (a strong body squats, a weak one stoops, a hand on its knee); high, up on the toes
    const squat = lvl === "low" ? clamp(0.55 + 0.25 * p.strong - 0.25 * p.weak - 0.15 * p.heavy, 0.2, 0.85) : 0;
    const hand = V.sub(tgt, [0, lvl === "low" ? -grip * 0.6 : 0, lvl === "low" ? 0 : grip]);
    // the body's part of the reach, `u` times as much as a short reach needs: grown until the arm can do the rest
    // (low: as far down as 0.62 of the body's scale and 92 degrees over. It was held to 0.52 and 82, and from there the
    //  two women's hands stopped 5 and 8 cm short of where they were asked: a thing on the floor was never touched, and
    //  no IK in the game can make an arm longer. mid: past what a person needs, the knees give too: an ogre's table is
    //  at its knees)
    const lean = (k, u) => lvl === "low" ? { down: Math.min((0.2 + 0.33 * squat) * u, 0.62) * p.sc * k, pitch: Math.min((62 - 26 * squat) * u, 92) * DEG * k, fwd: -0.05 * p.sc * k, yaw: -8 * DEG * k, squat: k, look: [14 * DEG * k, -6 * DEG * k] }
      : lvl === "mid" ? { pitch: Math.min(10 * u, 48) * DEG * k, fwd: Math.min(0.04 * u, 0.13) * p.sc * k, down: (Math.max(0, 0.03 * (u - 1.6)) + Math.max(0, 0.2 * (u - 3.8))) * p.sc * k, squat: clamp((u - 3.8) / 1.5, 0, 1) * k, yaw: -9 * DEG * k, look: [8 * DEG * k, -8 * DEG * k] }
        : { pitch: -5 * DEG * k, heel: Math.min(1, 0.6 * u) * k, fwd: Math.min(0.03 * u, 0.1) * p.sc * k, yaw: -5 * DEG * k, look: [-22 * DEG * k, -6 * DEG * k] };
    let u = 1; for (; u < 6; u += 0.1) { const h = homeOf(rig, leanFrame(rig, body, p, S, base, { ...lean(1, u), k: 1 })); if (V.dist(h.shoulder.r, hand) <= 0.94 * arm) break; }
    const ctrl = f => { const t = f / FPS, go = sm2(0.08, tg, t), back = sm2(th, tb, t), k = go * (1 - back), hold = sm(tg - 0.06, tg + 0.05, t) * (1 - sm(tb + 0.1, T - 0.05, t));
      const c = leanFrame(rig, body, p, S, base, { ...lean(k, u), k: sm(0, tg, t) * (1 - sm(tb, T, t)) });
      const home = homeOf(rig, c), carry = [home.info.wristAt_r[0] - 0.02, home.info.wristAt_r[1] + 0.07, home.info.wristAt_r[2] + 0.1];
      c.arms.r = armTo(home, "r", hand, k, { palm: lvl === "low" ? [0.55, -0.25, -0.8] : lvl === "mid" ? [0.2, -0.9, 0.3] : [0, -0.2, 1], pole: lvl === "high" ? [-0.9, -0.1, -0.4] : [-0.7, -0.6, -0.3], curl: lerp(0.25, 0.95, hold),
        via: lvl === "high" ? [tgt[0] - 0.08, sy - 0.05, 0.3 * p.sc] : null });
      if (back > 0 && back < 1) c.arms.r.hand = mixA(c.arms.r.hand, carry, 0.5 * hump(0, 1, back));     // (what it took is brought back close to the body)
      // (the other hand goes to its thigh: a weak or heavy body leans on it; any body's hangs to the floor from a squat this deep if it's left to, a ghoul's 6 cm through it)
      if (lvl === "low") { const T2 = onThighs(rig, body, home.pose, p, c.legs); c.arms.l = armTo(home, "l", T2.l, sm(0.1, tg * 0.8, t) * (1 - sm(tb - 0.2, T - 0.1, t)), { palm: T2.palm_l, pole: [0.8, -0.3, -0.5], curl: 0.4 }); }
      return c; };
    // (low, the palm faces back toward her feet and in. It was asked to face the floor, which a forearm pointing at the
    //  floor can't do and says nothing about: the turn stayed the hanging arm's until the elbow bent, then went 60
    //  degrees in a frame)
    // Low, the hand comes down on the thing from above, its fingers pointing at the floor: the wrist is held as high
    // over the thing as keeps them off it, by the hand's own fingers (a wrist a person's 4.5 cm over the thing put a
    // person's fingertips 2 cm under the floor as the hand opened, and an ogre's 21)
    if (lvl === "low") { const tips = []; for (const chain of rig.armR.fingers) for (const j of chain) { tips.push(j); for (const kid of rig.J[j].kids) tips.push(kid); }
      for (let i = 0; i < 3; i++) { let low = 1e9;
        for (let f = Math.round((tg - 0.6) * FPS); f <= Math.round((tb + 0.2) * FPS); f += 2) { const P = homeOf(rig, ctrl(f)).pose.solve().P; for (const j of tips) low = Math.min(low, P[j * 3 + 1]); }
        if (low >= 0.003) break; hand[1] += 0.005 - low; } }
    return { name: "reach_" + lvl, loop: false, n, fps: FPS, secs: (n - 1) / FPS, ctrl, events: [{ t: tg, name: "grab" }, { t: tb + 0.12, name: "put_away" }], meta: { reach: { hand: "r", at: tgt.map(v => +v.toFixed(3)), wrist: hand.map(v => +v.toFixed(3)), level: lvl } } };
  };
  return [mk("reach_low", "low"), mk("reach_mid", "mid"), mk("reach_high", "high")];
}

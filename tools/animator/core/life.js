// Animations v3, life (docs/ANIMATOR_V3.md §11, §12): small movements that show she's alive (a scratch, a look at
// what she holds, a hand through her hair, a stretch), and the poses a thing is carried in. The user, DECISIONS
// 2026-11-14, later: "'add life' animations ... looking at an object they are holding, scratching, little life
// flourish stuff ... as ik blendables meaning if the lower body and chest is in a position e.g. walking or sitting,
// we can still blend in these".
//
// A flourish is made standing, on the idle's first pose, and nothing below her chest moves in it: her legs and her
// pelvis are the idle's to the bit. In a game it isn't played instead of what she's doing but laid over it (layer.js;
// in Godot the Look plugin's HSGesture): its arm's own turns, and how far it turns her trunk and her head from where
// it started. So each one says, in its record (`life`), what the layer needs:
//   hand   "r", "l", "both" or "": the arm (collarbone to fingertips) the layer takes from it
//   head   "add": her head's turn in it is added to what her head is doing; "look": the same, and she is looking at
//          something of her own, so a head that follows the player is held off meanwhile
//   in, out   seconds: the arm is faded in over the first `in` (her hand leaving where it was) and out over the last `out`
//   touch  { bone, side?, from, to, point }: from `from` to `to` her hand is on her. `point`, in the wrist's own
//          space, is kept where this clip has it on `bone` (the other arm's when `side` says), wherever that bone
//          is in the pose she's really in: a hand scratches a head that's turned to follow you
//   over   what she can be doing under it: "stand", "walk", "sit"
//   free   the hand must hold nothing (false: made for a thing in it, or no hand in it at all)
//   weight how often it's picked against the others
// Where a hand goes is by her own parts (her head's own middle and size, her mouth, her neck's joints, her trunk's
// slabs, her other arm's joints), never a person's number times her height: these are made on goblins and ogres too.
// No face in any of it: expressions are their own layer.
import { V, Q, DEG, clamp, lerp, sm, sm2 } from "./m.js";
import { build } from "./pose.js";
import { params, FPS } from "./gait.js";
import { stance, idle, homeOf, armTo, baseLegs, within, turnV } from "./acts.js";
import { mouthOf, handScale } from "./acting.js";
import { armDepth, slabAt, POW, clearance } from "./clear.js";
import { headAt } from "./measure.js";

const TAU = 2 * Math.PI, r3 = v => v.map(x => +x.toFixed(3)), r4 = v => v.map(x => +x.toFixed(4));
const at = (so, j) => [so.P[j * 3], so.P[j * 3 + 1], so.P[j * 3 + 2]];
const E = (t, a, b, c, d) => sm2(a, b, t) * (1 - sm2(c, d, t));   // 0, up from a to b, held, down from c to d
export const OVER = ["stand", "walk", "sit"];

/** The pose every flourish and carry pose stands on: the idle's first, as the idle is baked: its hanging arms carried
    out as far as the idle's own clearance carries them (clear.js). So these clips need no clearance of their own
    (`clear: false`: it was most of what making one cost), and they start and end on the idle's first key exactly. */
const BASES = new WeakMap();
export function lifeBase(rig, body, set, X) {
  const key = JSON.stringify(set), had = BASES.get(body); if (had && had.key === key && had.X === X) return had.base;
  const clip = idle(rig, body, set, X), c = clip.ctrl(0); if (X) clearance(rig, X, clip)(c, 0);
  const base = { ...homeOf(rig, c), pelvis: c.pelvis.pos.slice() }; BASES.set(body, { key, X, base }); return base;
}
/** the idle's first pose with her chest, her head and her collarbones turned from it (radians: yaw, roll, pitch the
    chest's; hy, hr, hp the head's; clav: { l|r: { up, fwd } }): nothing below the chest is touched */
export function frameOf(base, a = {}) {
  const b = base.c, cl = s => { const o = (b.clav || {})[s] || {}, m = (a.clav || {})[s] || {}; return { up: (o.up || 0) + (m.up || 0), fwd: (o.fwd || 0) + (m.fwd || 0) }; };
  return { legs: baseLegs(base), pelvis: { pos: base.pelvis.slice(), yaw: b.pelvis.yaw, roll: b.pelvis.roll, pitch: b.pelvis.pitch },
    chest: { yaw: b.chest.yaw + (a.yaw || 0), roll: b.chest.roll + (a.roll || 0), pitch: b.chest.pitch + (a.pitch || 0) },
    head: { yaw: b.head.yaw + (a.hy || 0), roll: b.head.roll + (a.hr || 0), pitch: b.head.pitch + (a.hp || 0) },
    arms: { l: { ...b.arms.l }, r: { ...b.arms.r } }, clav: { l: cl("l"), r: cl("r") }, breath: a.breath || 0 };
}

/** her head in a solved pose: its middle and half sizes (the skin's own box as she stands at rest, carried by the
    head's bone). pt(v): a place from its middle in its own axes (x her left, y up, z the way she faces);
    on(d, lift): on her skull the way `d` from its middle, `lift` metres off it; out(d): the way out of her skull
    there; dir(v): a direction of its own;
    inside(p): how deep a place is in her head */
export function headOf(rig, body, so) {
  const j = rig.head, q = so.D[j], c = V.add(at(so, j), Q.rot(q, V.sub(body.headC, rig.J[j].at))), R = body.headR;
  const pt = v => V.add(c, Q.rot(q, v));
  // (on: off her skull's own shape, measure.js headAt: not her head's box, which her ears and her nose make)
  // (the way out of her skull at a place on it: square to its own shape there, which on a head that isn't a ball isn't the way from its middle)
  const skin = d => V.mul(V.norm(d), headAt(body, d)), out = d => { const u = V.norm(d), t1 = V.norm(V.cross(u, Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), t2 = V.cross(u, t1), e = 0.22;
    const n = V.norm(V.cross(V.sub(skin(V.mad(u, t1, e)), skin(V.mad(u, t1, -e))), V.sub(skin(V.mad(u, t2, e)), skin(V.mad(u, t2, -e))))); return V.dot(n, u) < 0 ? V.mul(n, -1) : n; };
  return { q, c, R, pt, dir: v => Q.rot(q, v), on: (d, lift = 0) => pt(V.mad(skin(d), out(d), lift)), out: d => Q.rot(q, out(d)),
    inside: (p, full = false) => { const v = Q.rot(Q.conj(q), V.sub(p, c)); return headAt(body, v, full) - V.len(v); } };   // how deep a place is in her skull (`full`: in the shape her ears and nose make, which takes all that's between an ear and her head for inside it): metres; below 0, outside
}
/** a place on her trunk's skin in a solved pose: at the height `y` it has as she stands at rest (from the floor), `u`
    of its half width to her left (-1: her right side), on her front (`back`: her back), `lift` metres off it.
    -> { at, n (the way out of her there), joint (the bone that carries it) } */
export function onTrunk(rig, X, so, y, u, lift = 0, back = false) {
  const s = slabAt(X, y), ux = clamp(u, -0.985, 0.985), zz = s.b * Math.pow(1 - Math.pow(Math.abs(ux), POW), 1 / POW);
  let nx = Math.sign(ux) * Math.pow(Math.abs(ux), POW - 1) / s.a, nz = (back ? -1 : 1) * Math.pow(zz / s.b, POW - 1) / s.b; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
  const j = y < X.split ? rig.pelvis : rig.chest, rest = [s.cx + ux * s.a + lift * nx, y, s.cz + (back ? -zz : zz) + lift * nz];
  return { at: V.add(at(so, j), Q.rot(so.D[j], V.sub(rest, rig.J[j].at))), n: Q.rot(so.D[j], [nx, 0, nz]), joint: j };
}
/** a point of her hand in a built pose: "tips" the ends of her three middle fingers, "palm" the middle of her palm on
    its skin, "knuckle" her first finger's middle joint (the top of a loose fist), "back" the back of her hand */
export function handPoint(rig, sc, s, what) {
  const A = rig.arm(s), hs = handScale(rig, sc), tip = ch => { const last = ch[ch.length - 1]; return last == null ? null : (rig.J[last].kids[0] ?? last); };
  const tips = [1, 2, 3].map(i => tip(A.fingers[i] || [])).filter(j => j != null), ix2 = rig.ix.get(`${s}_index2`);
  return (pose, so) => { const W = pose.info["wristAt_" + s], d = pose.info["handDir_" + s], n = pose.info["palm_" + s];
    if (what === "tips" && tips.length) { let p = [0, 0, 0]; for (const j of tips) p = V.add(p, at(so, j)); return V.mul(p, 1 / tips.length); }
    if (what === "knuckle" && ix2 != null) return at(so, ix2);
    if (what === "back") return V.add(V.mad(W, d, 0.42 * A.handLen), V.mul(n, -0.014 * hs));
    return V.add(V.mad(W, d, 0.5 * A.handLen), V.mul(n, 0.018 * hs)); };
}
// an arm taken to a wrist's place `k` of the way, passing `mid` half way there (armTo's own curve bends toward a
// point it never reaches: here the point is on the path). `handQ`: her hand's own turn in the world where it lands
// (a hand laid on her is laid the way a hand lies there, not the way its forearm happens to point): taken up as it
// gets there, from the turn her hanging hand had; without it armTo's palm rule. `more`: what armTo doesn't set (dev)
function armVia(home, s, to, k, o) {
  const W0 = home.info["wristAt_" + s], via = o.mid ? V.mul(V.sub(V.mul(o.mid, 4), V.add(W0, to)), 0.5) : null, a = armTo(home, s, to, k, { ...o, via });
  // (on its way the wrist is never asked further than the arm goes: a path that bulges past her reach lays the arm out
  //  straight and snaps the elbow as it comes back. Not where it hangs, nor where it lands: those are as they are)
  { const A = home.pose.rig.arm(s), w = sm(0.02, 0.3, k) * (1 - sm(0.7, 0.98, k)); if (w > 0) a.hand = V.lerp(a.hand, within(a.hand, home.shoulder[s], 0.97 * (A.upper + A.fore)), w); }
  // (her elbow goes to the side it's held on later than her hand goes to its place: it rises with her hand, not ahead
  //  of it. Blended at the hand's own pace, a hand on its way to her head was at her chest with her elbow already
  //  out at her shoulder's height: a wing)
  if (o.pole && o.late) a.pole = turnV(V.sub(home.info["elbowAt_" + s], home.shoulder[s]), o.pole, sm2(o.late, 1, k));
  if ("handQ" in o) { a.palmK = 0; a.wrist = 0; if (o.handQ) { a.handQ = o.handQ; a.handK = sm2(0.2, 1, k); } }
  if (o.more) for (const [key, v] of Object.entries(o.more)) a[key] = typeof v === "number" ? v * k : v;
  return a;
}
// The wrist's place for which a point of her hand is on `target`. The arm is built to a wrist's place, the point read
// off the hand as built, the wrist moved by what's missing, a few times over: where a hand's fingertips are isn't
// known until it's built (its turn follows its forearm). `from`: a place to start from (the frame before's).
function wristFor(rig, c, s, target, point, opts, from = null) {
  const home = homeOf(rig, c), A = rig.arm(s), L = A.upper + A.fore, far = 0.985 * L, near = Math.abs(A.upper - A.fore) + 0.012, S0 = home.shoulder[s];
  let W = from || V.lerp(target, S0, clamp(0.55 * A.handLen / Math.max(0.05, V.dist(target, S0)), 0, 0.6)), miss = 1;
  for (let i = 0; i < (from ? 3 : 9); i++) {
    const d = V.sub(W, S0), l = V.len(d) || 1e-6; if (l > far) W = V.mad(S0, d, far / l); else if (l < near) W = V.mad(S0, d, near / l);
    const pose = build(rig, { ...c, arms: { ...c.arms, [s]: armVia(home, s, W, 1, opts) } }), so = pose.solve(), e = V.sub(target, point(pose, so));
    miss = V.len(e); if (miss < 0.0008) break; W = V.add(W, V.mul(e, i < 2 ? 1 : 0.8));
  }
  return { wrist: W, miss, reach: V.dist(W, S0) / L };
}
// An arm taken somewhere by its wrist isn't kept clear of her body by clearance() (that carries hanging arms out).
// Here its elbow is swung round the line from her shoulder to her wrist until her upper arm and her forearm are clear
// of her, the way that takes the least. -> the pole to ask for
function clearPole(rig, X, c, s, W, opts) {
  if (!X) return opts.pole;
  const home = homeOf(rig, c), ax = V.norm(V.sub(W, home.shoulder[s]));
  const deep = pole => { const pose = build(rig, { ...c, arms: { ...c.arms, [s]: armVia(home, s, W, 1, { ...opts, pole }) } }); return armDepth(rig, X, pose, pose.solve(), s, 0, opts.clearTo ?? 1); };
  if (deep(opts.pole) <= 0) return opts.pole;
  for (let a = 6; a <= 78; a += 6) for (const g of [1, -1]) { const pole = Q.rot(Q.axis(ax, g * a * DEG), opts.pole); if (deep(pole) <= 0) return pole; }
  return opts.pole;
}
/** how deep the arms a clip takes by their wrists get into her, over its frames (metres; below 0: clear):
    { elbow, rest } the elbow's ball, and the forearm's (with `to` 2, the wrist's too). An elbow may lie against her
    ribs, as a bent arm's does; a forearm may not go through her. */
export function armsIn(rig, X, frames, sides = ["r"], to = 1) {
  let elbow = -1, rest = -1; if (!X) return { elbow, rest };
  for (const c of frames) { const pose = build(rig, c), so = pose.solve(); for (const s of sides) if (c.arms[s].hand) { elbow = Math.max(elbow, armDepth(rig, X, pose, so, s, 0, 0)); rest = Math.max(rest, armDepth(rig, X, pose, so, s, 1, to)); } }
  return { elbow, rest };
}
const ELBOW_IN = 0.014, REST_IN = 0.003;                      // what's let pass: an elbow that deep in her padded shape is on her ribs, not in them
export const LIMITS = { elbow: ELBOW_IN, rest: REST_IN, head: 0.012, turn: 34 * DEG, least: 0.22, bend: 62 * DEG, miss: 0.004, pass: 0.004 };
/** How well a flourish does on this body, over its frames: { bad, why, elbow, rest, head, least, turn }. `bad` is 0
    when all of it is clean, else the most any rule is broken by, as metres (a degree of turn counts a millimetre):
    her elbow no deeper in her than lies against her ribs and her forearm not in her at all (armsIn); no joint of the
    hand deeper in her skull than a fingertip presses; no bone turning more than 34 degrees in a frame; the arm
    never folded tighter than an elbow folds. A flourish over `LIMITS.pass` isn't made for her: a hag's hunch puts her
    temple where her shoulder is, and no hand of hers tucks hair there. */
export function judge(rig, body, X, frames, sides = ["r"]) {
  let elbow = -1, rest = -1, head = -1, least = 9, turn = 0, prev = null;
  for (const c of frames) { const pose = build(rig, c), so = pose.solve(), H = headOf(rig, body, so), loc = pose.locals(so);
    for (const s of sides) if (c.arms[s].hand) { const A = rig.arm(s); least = Math.min(least, pose.info["armReach_" + s] ?? 9);
      if (X) { elbow = Math.max(elbow, armDepth(rig, X, pose, so, s, 0, 0)); rest = Math.max(rest, armDepth(rig, X, pose, so, s, 1, 1)); }
      for (const j of [A.hand, ...A.fingers.flat()]) head = Math.max(head, H.inside(at(so, j))); }
    if (prev) for (let j = 0; j < rig.J.length; j++) { if (rig.J[j].soft) continue; const a = loc[j].r, b = prev[j].r; turn = Math.max(turn, 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])))); }
    prev = loc; }
  const terms = [[elbow - LIMITS.elbow, "her elbow in her"], [rest - LIMITS.rest, "her forearm in her"], [head - LIMITS.head, "her hand in her head"], [(turn - LIMITS.turn) / DEG * 0.001, "a bone turning too fast"], [(LIMITS.least - least) * 0.2, "her arm folded flat"]];
  let bad = 0, why = ""; for (const [v, w] of terms) if (v > bad) { bad = v; why = w; }
  return { bad, why, elbow, rest, head, least, turn };
}
// a clip from frames made ahead (a flourish's hand is solved frame after frame, each from the one before): the
// controls are handed out as copies, since what bakes a clip writes into them
// (copied by hand, not by structuredClone: its copies are objects of another kind to the engine, and one clip's worth
//  of them through build() left every later call of it three to four times slower, for the rest of the process:
//  the next body's walk took 9 s to make instead of 2.5)
const copyArm = a => { const o = { ...a }; if (a.hand) o.hand = a.hand.slice(); if (a.pole) o.pole = a.pole.slice(); if (a.palm) o.palm = a.palm.slice(); if (a.handQ) o.handQ = a.handQ.slice(); return o; };
const copyLeg = l => ({ ...l, ankle: l.ankle.slice() });
const copyOf = c => ({ legs: { l: copyLeg(c.legs.l), r: copyLeg(c.legs.r) }, pelvis: { ...c.pelvis, pos: c.pelvis.pos.slice() }, chest: { ...c.chest }, head: { ...c.head }, arms: { l: copyArm(c.arms.l), r: copyArm(c.arms.r) }, clav: { l: { ...c.clav.l }, r: { ...c.clav.r } }, breath: c.breath });
const clipOf = (name, frames, meta, loop = false) => ({ name, loop, frames, clear: false, n: frames.length, fps: FPS, secs: (loop ? frames.length : frames.length - 1) / FPS, ctrl: f => copyOf(frames[Math.min(frames.length - 1, Math.max(0, f))]), events: [], meta });

/** the flourishes, the right hand's (animate.js makes the left's as mirrors): each { name, n, fps, ctrl, meta: { life } } */
export function living(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = lifeBase(rig, body, set, X), sc = p.sc, hs = handScale(rig, sc), A = rig.armR, fl = body.floor;
  const slow = 1 + 0.12 * p.heavy + 0.12 * p.weak - 0.06 * p.strong, L = body.levels;
  const HS = rig.headTop >= 0 ? V.dist(rig.J[rig.head].at, rig.J[rig.headTop].at) / 0.187 : sc;   // her head's size against a person's
  const eyes = so => { const l = rig.ix.get("l_eye"), r = rig.ix.get("r_eye"); return l != null && r != null ? V.lerp(at(so, l), at(so, r), 0.5) : headOf(rig, body, so).pt([0, 0.1 * body.headR[1], 0.6 * body.headR[2]]); };
  const list = [], skipped = [], eye0 = eyes(homeOf(rig, frameOf(base, {})).pose.solve());                     // between her eyes, as she stands
  const life = (o, T, up, down, extra = {}) => ({ hand: o.hand ?? "r", head: o.head ?? "add", in: +(0.62 * up).toFixed(2), out: +(0.62 * (T - down)).toFixed(2), over: o.over || OVER, free: o.free ?? true, weight: o.weight ?? 1, ...extra });

  // ---- one hand taken somewhere and brought back ---------------------------------------------------------------------
  // o: { T, up (the hand is there), down (it leaves), body(t, k, aim) -> frameOf's turns,
  //      either wrist(home, t) -> where the wrist goes (a hand in the air),
  //      or target(so, t, H, home) -> where a point of the hand goes, with point ("tips", "palm", "knuckle", "back") and bone (what it touches),
  //      arm(H, t, k, so) -> { pole, curl, and either along + palm (the way her fingers point and the way her palm faces where the hand lands: its turn outright) or armTo's palm and wrist },
  //      mid: [out to her side, up, forward] from her shoulder, in her leg's scale: where the hand passes half way, clearTo: which of the arm's balls are kept out of her (1: her elbow and forearm; 2: her wrist too),
  //      look: her head is turned to her hand (aim: how far it has to turn, handed to body()) }
  const MAXB = 48 * DEG;                                        // as far as a wrist is asked to bend
  const LATE = 0.42;                                            // a hand taken up to her head (`late`): how far it has gone before her elbow starts for the side it's held on (armVia)
  const oneHand = (name, o) => {
    const T = o.T, n = Math.round(T * FPS), point = o.point ? handPoint(rig, sc, "r", o.point) : null, palmPt = handPoint(rig, sc, "r", "palm");
    const kOf = t => E(t, 0.04, o.up, o.down, T - 0.06), th = (o.up + o.down) / 2;
    let aim = { pitch: 0, yaw: 0 }, pole = null, fix = [0, 0, 0, 1], W = null, worst = 0, reach = 0, touch = null, ahead = 0;
    const optsAt = (home, so, t, k) => { const H = headOf(rig, body, so), a = o.arm(H, t, k, so), sh = home.shoulder.r, al = a.along ? Q.rot(fix, V.norm(a.along)) : null;
      return { ...a, ...(al ? { handQ: Q.frame(A.handDir, A.palm0, al, Q.rot(fix, V.norm(a.palm))), alongW: al } : {}), pole: pole || a.pole, late: o.late ? LATE : 0, mid: o.mid ? [sh[0] - o.mid[0] * sc, sh[1] + o.mid[1] * sc, sh[2] + o.mid[2] * sc] : null, H }; };
    const frame = (t, k, solve) => {
      const c = frameOf(base, o.body ? o.body(t, k, aim) : {}), home = homeOf(rig, c), so = home.pose.solve(), opts = optsAt(home, so, t, k);
      let to;
      if (o.wrist) to = within(V.add(o.wrist(home, t, so), cdir(so, [0, 0, ahead])), home.shoulder.r, 0.93 * armLen);
      else { const tgt = o.target(so, t, opts.H, home); if (solve) { const w = wristFor(rig, c, "r", tgt, point, opts, W); W = w.wrist; if (t >= o.up && t <= o.down) { worst = Math.max(worst, w.miss); reach = Math.max(reach, w.reach); } } to = W || tgt; }
      return { c, home, opts, to };
    };
    const built = f => build(rig, { ...f.c, arms: { ...f.c.arms, r: armVia(f.home, "r", f.to, 1, f.opts) } });
    // set up at the middle of the hold.
    // A look: where her head turns, from her eyes to the hand as it's held, most of the way (her eyes do the rest)
    // A hand held in the air: out in front of her until her forearm is clear of her where it's held (an ogre's chest)
    // (no further than leaves her arm bent: pushed on from there it was held out nearly straight, a limp hand on the end of it)
    if (o.wrist && X) for (let i = 0; i < 8; i++) { const f = frame(th, 1, false), pose = built(f), so = pose.solve(); if (armDepth(rig, X, pose, so, "r", 1, 1) <= REST_IN && armDepth(rig, X, pose, so, "r", 0, 0) <= ELBOW_IN) break;
      if (V.dist(f.to, f.home.shoulder.r) > 0.82 * armLen) break; ahead += 0.025 * sc; }
    if (o.look) for (let i = 0; i < 2; i++) { const pose = built(frame(th, 1, true)), d = V.sub(palmPt(pose, pose.solve()), eye0);
      aim = { pitch: clamp(0.84 * Math.atan2(-d[1], Math.hypot(d[0], d[2])), -30 * DEG, 42 * DEG), yaw: clamp(0.9 * Math.atan2(d[0], d[2]), -50 * DEG, 50 * DEG) }; W = null; }
    // A hand laid on her: her elbow goes behind her hand (where her forearm would be if her wrist were straight, as
    // near that as her arm's two bones allow), and where her wrist would still be bent further than a wrist bends,
    // the hand is turned toward her forearm by what's over: it lies the way it was asked as far as it can. The pole
    // kept is the side her elbow is then on, square to the line from her shoulder to her wrist: a pole that points
    // along the way the hand travels flips the arm over as the hand passes it
    if (o.target) for (let i = 0; i < 9; i++) { W = null; pole = null; const f = frame(th, 1, true), al = f.opts.alongW; if (!al) break;
      const S0 = f.home.shoulder.r, pose = built({ ...f, opts: { ...f.opts, pole: V.sub(V.mad(f.to, al, -A.fore), S0) } }), El = pose.info.elbowAt_r, df = V.norm(V.sub(pose.info.wristAt_r, El)), bend = Math.acos(clamp(V.dot(df, al), -1, 1));
      pole = V.norm(V.perp(V.sub(El, S0), V.norm(V.sub(f.to, S0))));
      if (bend <= MAXB) break; fix = Q.mul(Q.axis(V.cross(al, df), bend - MAXB + 2 * DEG), fix); }
    { W = null; const f = frame(th, 1, true); pole = clearPole(rig, X, f.c, "r", f.to, { ...f.opts, clearTo: o.clearTo }); }
    // On its way there and back the hand is turned from its own forearm, by a share of how it's turned from it where
    // it lands: a turn taken up in the world while the forearm still points somewhere else bends the wrist double
    // on the way (83 degrees, for a hand that lands bent 45)
    let rel = null; const natural = (f, k) => build(rig, { ...f.c, arms: { ...f.c.arms, r: armVia(f.home, "r", f.to, k, { ...f.opts, handQ: null }) } }).D[A.hand];
    { W = null; const f = frame(th, 1, true); if (f.opts.handQ) rel = Q.mul(Q.conj(natural(f, 1)), f.opts.handQ); }
    // (a way whose held pose is already out of the question: not worth its frames)
    { W = null; const f = frame(th, 1, true), c1 = { ...f.c, arms: { ...f.c.arms, r: armVia(f.home, "r", f.to, 1, f.opts) } }, j = judge(rig, body, X, [c1], ["r"]); W = null;
      if (j.bad > 3 * LIMITS.pass) return { name, bad: j.bad, why: j.why }; }
    // the frames; then, while her arm passes through her on its way there or back, the way moved out in front of her
    let frames = [], push = 0;
    for (let it = 0; it < 5; it++) { W = null; worst = 0; reach = 0; frames = [];
      for (let f = 0; f < n; f++) { const t = f / FPS, k = kOf(t), fr = frame(t, k, k > 0.001); if (fr.opts.mid) fr.opts.mid = V.add(fr.opts.mid, [-0.9 * push * sc, 0, 0.45 * push * sc]); fr.c.arms.r = armVia(fr.home, "r", fr.to, k, fr.opts);
        if (rel && k < 0.999) { const q = Q.mul(natural(fr, k), Q.slerp([0, 0, 0, 1], rel, sm2(0.08, 1, k))); fr.c.arms.r.handQ = k > 0.9 ? Q.slerp(q, fr.opts.handQ, sm(0.9, 0.999, k)) : q; fr.c.arms.r.handK = 1; }
        frames.push(fr.c); }
      const way = frames.filter((c, f) => f / FPS < o.up - 0.05 || f / FPS > o.down + 0.05), d = armsIn(rig, X, way, ["r"], 1); if ((d.elbow <= ELBOW_IN && d.rest <= REST_IN) || !o.mid) break; push += 0.03; }
    if (o.bone) { const pose = build(rig, frames[Math.round(th * FPS)]), so = pose.solve(); touch = r4(Q.rot(Q.conj(so.D[A.hand]), V.sub(point(pose, so), at(so, A.hand)))); }
    const meta = { life: life(o, T, o.up, o.down, o.bone ? { touch: { ...(typeof o.bone === "string" ? { bone: o.bone } : o.bone), from: +o.up.toFixed(2), to: +o.down.toFixed(2), point: touch }, miss: +(worst * 1000).toFixed(1), reach: +reach.toFixed(3) } : {}) };
    // how well it does: 0 when her arm is clear of her through all of it, the hand is where it's asked and the arm isn't at its full length (metres over, otherwise)
    const j = judge(rig, body, X, frames, ["r"]); let bad = j.bad, why = j.why;
    if (worst - LIMITS.miss > bad) { bad = worst - LIMITS.miss; why = "her hand short of it"; }
    if (o.bone) { const pose = build(rig, frames[Math.round(th * FPS)]), bend = Math.acos(clamp(V.dot(V.norm(V.sub(pose.info.wristAt_r, pose.info.elbowAt_r)), pose.info.handDir_r), -1, 1)); if ((bend - LIMITS.bend) / DEG * 0.001 > bad) { bad = (bend - LIMITS.bend) / DEG * 0.001; why = "her wrist bent double"; } }
    return { ...clipOf(name, frames, meta), bad, why };
  };
  // one flourish, the first of a few ways to do it that her body can do cleanly: a big bust, broad shoulders or short
  // arms want the same scratch somewhere a little different. One she can't do cleanly any of the ways isn't made for
  // her (`skipped` says which, and why): the game's layer picks among the ones she has
  const DEBUG = typeof process !== "undefined" && process.env && process.env.LIFE_DEBUG;
  const firstClean = ways => { let best = null, i = 0, took = 0; for (const way of ways) { const c = way(); if (!best || c.bad < best.bad) { best = c; took = i; } i++; if (c.bad <= 0) break; }
    if (DEBUG && (took || best.bad > 0)) console.log(" ", best.name, "way", took, "of", ways.length, "bad", (best.bad * 1000).toFixed(1), "mm", best.why || "");
    if (best.bad <= LIMITS.pass || (DEBUG && process.env.LIFE_KEEP)) list.push(best); else skipped.push({ name: best.name, why: best.why, by: +(best.bad * 1000).toFixed(1) }); };
  const stroke = (t, up, down, hz) => Math.sin(TAU * hz * (t - up)) * E(t, up, up + 0.12, down - 0.14, down);

  const cq = so => so.D[rig.chest], cdir = (so, v) => Q.rot(so.D[rig.chest], v);
  // Where a hand is held to be looked at: down and ahead of her eyes the way `dir`, `far` of her arm's length from
  // them, nearer where her arm doesn't get that far (a hunched goblin's head is out in front of its shoulders: a hand
  // held "in front of its shoulder" is under its chin, or in its face). -> the wrist's place from her shoulder
  const armLen = A.upper + A.fore, home0 = homeOf(rig, frameOf(base, {}));
  const lookSpot = (dir, far) => { const d = V.norm(dir), S0 = home0.shoulder.r; let P = null;
    for (let f = far; f >= 0.38; f -= 0.03) { P = V.mad(eye0, d, f * armLen); if (V.dist(P, S0) <= 0.9 * armLen) break; }
    return V.sub(within(P, S0, 0.93 * armLen), S0); };
  // her hand brought up in front of her and looked at: what she holds, turned over; or her nails
  { const T = 3.1 * slow, up = 0.8 * slow, down = 2.25 * slow;
    firstClean([[[-0.23, -0.81, 0.53], 0.775], [[-0.22, -0.68, 0.7], 0.72], [[-0.2, -0.55, 0.81], 0.68]].map(([dir, far]) => () => { const spot = lookSpot(dir, far);
      return oneHand("life_look_hand", { T, up, down, look: true, head: "look", free: false, weight: 1.5,
        wrist: (home, t) => V.add(V.add(home.shoulder.r, spot), [0, 0.012 * sc * stroke(t, up, down, 0.75 / slow), 0]),
        arm: (H, t) => { const tw = stroke(t, up, down, 0.62 / slow); return { palm: V.norm([0.8, 0.3 + 0.5 * tw, -0.45 - 0.2 * tw]), pole: [-0.5, -0.82, -0.25], curl: 0.8, wrist: 4 * DEG }; },
        mid: [-0.04, -0.33, 0.25], body: (t, k, aim) => ({ pitch: 3 * DEG * k, hp: aim.pitch * k, hy: aim.yaw * k, hr: 2 * DEG * k }) }); })); }

  // fingertips to the back of her head, on her hand's side: four scratches, her head tilting into them. Her fingers
  // point across the back of her head and up, her palm to it. A crown her arm can't get to (an imp's: a big head on
  // short arms) is tried further down toward the side of her head, over her ear
  { const T = 2.7 * slow, up = 0.78 * slow, down = 1.85 * slow, dirs = [[-0.5, 0.62, -0.6], [-0.85, 0.42, -0.05]], alongs = [[0.8, 0.45, -0.2], [0.15, 0.85, -0.5]];
    firstClean([0, 0.35, 0.7, 1].map(u => () => { const spot = H => H.on(V.lerp(dirs[0], dirs[1], u), 0.006 * HS);
      return oneHand("life_scratch_head", { T, up, down, point: "tips", bone: "c_head", late: true,
        target: (so, t, H) => { const st = stroke(t, up, down, 4.2); return V.add(spot(H), H.dir([0.006 * HS * st, 0.011 * HS * st, 0])); },
        arm: (H, t) => ({ along: H.dir(V.lerp(alongs[0], alongs[1], u)), palm: V.mul(H.out(V.lerp(dirs[0], dirs[1], u)), -1), pole: [-0.85, 0.2, 0.4], curl: 0.9 + 0.12 * stroke(t, up, down, 4.2) }),
        mid: [0.13, -0.16, 0.22], body: (t, k) => ({ hp: 7 * DEG * k, hr: 5 * DEG * k, hy: -5 * DEG * k, pitch: 1.5 * DEG * k }) }); })); }

  // a palm on the side of her neck away from her hand, her fingers round the back of it, kneaded twice, her head
  // tipped away. (The back of her neck from her own side is out of this skeleton's reach: its wrist would have to
  // be where its shoulder is.) Where her forearm would lie in her chest on its way there (broad shoulders), nearer
  // her throat
  { const T = 3.1 * slow, up = 0.85 * slow, down = 2.2 * slow, nq = so => so.D[rig.neck], knead = t => Math.max(0, stroke(t, up, down, 1.6));
    const body_ = (t, k) => ({ hr: (9 * k + 3 * stroke(t, up, down, 0.8)) * DEG, hy: -4 * DEG * k, hp: 2 * DEG * k });
    firstClean([...[[0.047, 0.05, 0.0], [0.04, 0.056, 0.014], [0.03, 0.06, 0.03]].map(at0 => () => oneHand("life_rub_neck", { T, up, down, point: "palm", bone: "c_neck",
      target: so => V.add(at(so, rig.neck), Q.rot(nq(so), V.mul(at0, HS))),
      arm: (H, t, k, so) => ({ along: Q.rot(nq(so), [0.3, -0.1, -0.95]), palm: Q.rot(nq(so), [-0.9, -0.2, 0.2]), pole: [-0.3, -0.75, 0.6], curl: 0.45 + 0.35 * knead(t) }),
      mid: [-0.03, -0.3, 0.22], body: body_ })),
      // (a creature with no neck to speak of: the top of her other shoulder, kneaded)
      () => { const top = so => V.add(V.lerp(at(so, rig.armL.clav), at(so, rig.armL.up), 0.55), cdir(so, [0, 0.045 * sc, -0.01 * sc]));
        return oneHand("life_rub_neck", { T, up, down, point: "palm", bone: rig.J[rig.chest].name, target: so => top(so),
          arm: (H, t, k, so) => ({ along: cdir(so, [0.35, -0.2, -0.9]), palm: cdir(so, [-0.1, -0.97, 0.15]), pole: [-0.3, -0.75, 0.6], curl: 0.45 + 0.35 * knead(t) }), mid: [-0.03, -0.3, 0.22], body: body_ }); }]); }

  // her other upper arm scratched near its shoulder, on its front, looked at. Her forearm passes in front of her:
  // over a bust it can't pass, the scratch is tried higher, on the front and then the top of that shoulder
  { const T = 2.5 * slow, up = 0.75 * slow, down = 1.7 * slow;
    firstClean([[0.24, [0.45, 0.1, 0.89], [0.62, 0, -0.78]], [0.13, [0.2, 0.25, 0.95], [0.5, 0.1, -0.86]], [0.06, [0.25, 0.75, 0.6], [0.55, -0.35, -0.75]]].map(([frac, o3, al]) => () => { const out = V.norm(o3);
      return oneHand("life_scratch_arm", { T, up, down, point: "tips", bone: { bone: "uparm", side: "l" }, over: ["stand", "sit"], head: "look",
        target: (so, t, H, home) => V.mad(V.lerp(home.shoulder.l, home.info.elbowAt_l, frac + 0.05 * stroke(t, up, down, 4)), cdir(so, out), (X ? X.rUpper : 0.05 * sc) + 0.004),
        arm: (H, t, k, so) => ({ along: cdir(so, al), palm: cdir(so, V.mul(out, -1)), pole: [-0.15, -0.45, 0.88], curl: 0.8 + 0.1 * stroke(t, up, down, 4) }),
        mid: [-0.02, -0.27, 0.24], body: (t, k) => ({ hy: 24 * DEG * k, hp: 14 * DEG * k, yaw: 3 * DEG * k }) }); })); }

  // the top of a loose fist (her first finger's middle joint) across the end of her nose, twice
  { const T = 1.95 * slow, up = 0.6 * slow, down = 1.2 * slow;
    firstClean([() => oneHand("life_rub_nose", { T, up, down, point: "knuckle", bone: "c_head", weight: 0.8,
      target: (so, t, H) => V.add(mouthOf(rig, so), H.dir([(-0.004 + 0.009 * stroke(t, up, down, 3.2)) * HS, 0.03 * HS, 0.032 * HS])),
      arm: H => ({ along: H.dir([0.45, 0.8, -0.35]), palm: H.dir([0.5, -0.3, -0.8]), pole: [-0.45, -0.85, 0.2], curl: 1.0 }),
      mid: [0.0, -0.33, 0.22], body: (t, k) => ({ hp: (-3 * E(t, up - 0.2, up, up + 0.1, up + 0.4) + 4 * E(t, up + 0.2, down, down, T - 0.2)) * DEG }) })]); }

  // the back of her hand across her forehead, from her left to her right
  { const T = 2.3 * slow, up = 0.65 * slow, down = 1.45 * slow;
    firstClean([() => oneHand("life_wipe_brow", { T, up, down, point: "back", bone: "c_head", weight: 0.8, late: true,
      target: (so, t, H) => H.on([0.32 - 0.8 * sm(up, down, t), 0.5, 0.84], 0.004 * HS),
      arm: (H, t) => ({ along: H.dir([0.85, 0.5, 0.1]), palm: H.out([0.32 - 0.8 * sm(up, down, t), 0.5, 0.84]), pole: [-0.75, -0.3, 0.55], curl: 0.5 }),
      mid: [0.02, -0.19, 0.27], body: (t, k) => ({ hp: -5 * DEG * k }) })]); }   // (half way there her hand is already at her chest: lower, it came up late and all at once, her forearm level across her on the way)

  // her forearm level in front of the bottom of her chest, on her hand's own side of her middle (this arm is short:
  // to her middle it's held out nearly straight), her elbow by her side, the back of her wrist looked at (a watch),
  // her hand a loose fist (half closed, its fingers hung from a level hand like a claw). Tried further out in front
  // of her where her forearm doesn't pass her bust, and last down by her navel
  { const T = 2.6 * slow, up = 0.72 * slow, down = 1.85 * slow;
    firstClean([[[-0.13, -0.89, 0.44], 0.82], [[-0.1, -0.8, 0.59], 0.78], [[0.06, -0.62, 0.78], 0.7], [[0.1, -0.94, 0.33], 0.84]].map(([dir, far]) => () => { const spot = lookSpot(dir, far);
      return oneHand("life_check_wrist", { T, up, down, look: true, head: "look", free: false, weight: 0.8,
        wrist: home => V.add(home.shoulder.r, spot),
        arm: () => ({ palm: V.norm([0.05, -0.97, 0.2]), pole: [-0.7, -0.5, 0.5], curl: 1.05, wrist: 0 }),
        mid: [0.0, -0.33, 0.25], body: (t, k, aim) => ({ pitch: 3 * DEG * k, hp: aim.pitch * k, hy: aim.yaw * k }) }); })); }

  // the top of her other shoulder brushed off, twice, looked at: her fingertips from by her collarbone out over the
  // shoulder's point (on her chest under it, it read as a hand on her heart), or over the front of that shoulder.
  // Where her head is in the way of that (a big head low on its shoulders), her chest under her collarbone, nearer
  // her breastbone where her forearm can't pass in front of her
  { const T = 2.4 * slow, up = 0.75 * slow, down = 1.65 * slow, flick = t => 0.5 - 0.5 * Math.cos(TAU * 2 * clamp((t - up) / (down - up), 0, 1)), rU = X ? X.rUpper : 0.05 * sc;
    const look = (t, k) => ({ hy: 30 * DEG * k, hp: 16 * DEG * k, yaw: 3 * DEG * k }), mid = [-0.02, -0.27, 0.24];
    firstClean([...[[0.6, [0.12, 0.62, 0.78]], [0.68, [0.2, 0.3, 0.93]]].map(([f0, o3]) => () => { const out = V.norm(o3);
      return oneHand("life_brush_off", { T, up, down, point: "tips", bone: { bone: "clavicle", side: "l" }, head: "look",
        target: (so, t) => V.mad(V.lerp(at(so, rig.armL.clav), at(so, rig.armL.up), f0 + 0.36 * flick(t)), cdir(so, out), rU + 0.008),
        arm: (H, t, k, so) => ({ along: cdir(so, [0.8, 0.3, -0.52]), palm: cdir(so, V.mul(out, -1)), pole: [-0.2, -0.6, 0.78], curl: 0.34 - 0.16 * flick(t) }), mid, body: look }); }),
      ...[0.7, 0.52, 0.36].map(u0 => () => oneHand("life_brush_off", { T, up, down, point: "tips", bone: rig.J[rig.chest].name, head: "look",
        target: (so, t) => onTrunk(rig, X, so, fl + body.shoulderY - (0.035 + 0.05 * flick(t)) * sc, u0 + 0.14 * flick(t), 0.006).at,
        arm: (H, t, k, so) => ({ along: cdir(so, [0.75, 0.2, -0.62]), palm: V.mul(onTrunk(rig, X, so, fl + body.shoulderY - 0.035 * sc, u0, 0).n, -1), pole: [-0.2, -0.6, 0.78], curl: 0.32 - 0.16 * flick(t) }), mid, body: look }))]); }

  // fingertips from her temple back over her ear: hair tucked behind it
  { const T = 2.2 * slow, up = 0.62 * slow, down = 1.2 * slow, eye = rig.ix.get("r_eye");
    firstClean([() => oneHand("life_tuck_hair", { T, up, down, point: "tips", bone: "c_head", weight: 0.9,
      target: (so, t, H) => { const u = sm(up, down - 0.08, t), e = eye != null ? at(so, eye) : H.pt([-0.37 * H.R[0], 0.1 * H.R[1], 0.57 * H.R[2]]); return V.add(e, H.dir([(-0.05 - 0.008 * u) * HS, (0.016 - 0.03 * u) * HS, (-0.035 - 0.065 * u) * HS])); },
      arm: H => ({ along: H.dir([0.15, 0.55, -0.82]), palm: H.dir([0.95, 0, 0.25]), pole: [-0.5, -0.55, 0.67], curl: 0.45 }),
      mid: [0.1, -0.22, 0.27], body: (t, k) => ({ hr: 4 * DEG * k, hy: 6 * DEG * k, hp: 3 * DEG * k }) })]); }

  // a knuckle under her chin, held: thinking
  { const T = 3.4 * slow, up = 0.78 * slow, down = 2.5 * slow, jaw = rig.ix.get("c_jaw_null");
    // (her forearm comes up in front of her: where it can't pass her bust that way, from further out to her side, or from out in front of her)
    firstClean([[[0.3, 0.9, -0.3], [0.4, -0.2, -0.9], [0.0, -0.34, 0.22]], [[0.56, 0.76, -0.33], [0.3, -0.3, -0.9], [0.05, -0.34, 0.24]], [[0.25, 0.72, -0.64], [0.4, -0.55, -0.73], [0.0, -0.3, 0.3]]].map(([al, pm, mid]) => () => oneHand("life_chin", { T, up, down, point: "knuckle", bone: "c_head", over: ["stand", "sit"], weight: 0.8,
      target: (so, t, H) => jaw != null ? V.add(at(so, jaw), H.dir([-0.006 * HS, -0.024 * HS, -0.004 * HS])) : V.add(mouthOf(rig, so), H.dir([-0.006 * HS, -0.058 * HS, 0.005 * HS])),
      arm: H => ({ along: H.dir(al), palm: H.dir(pm), pole: [-0.35, -0.8, 0.5], curl: 1.05 }),
      mid, body: (t, k) => ({ hp: (5 * k + 1.5 * stroke(t, up, down, 0.6)) * DEG, hr: -3 * DEG * k, hy: 6 * DEG * k }) }))); }

  // her side scratched, about level with her navel
  { const T = 2.5 * slow, up = 0.7 * slow, down = 1.7 * slow, yb = fl + lerp(L.belly, L.waist, 0.6), jt = body.slabs.reduce((a, s) => (Math.abs(s.y + fl - yb) < Math.abs(a.y + fl - yb) ? s : a), body.slabs[0]).joint;
    firstClean([() => oneHand("life_scratch_belly", { T, up, down, point: "tips", bone: rig.J[jt ?? rig.pelvis].name,
      target: (so, t) => onTrunk(rig, X, so, yb + 0.013 * sc * stroke(t, up, down, 4), -0.62, 0.005).at,
      arm: (H, t, k, so) => { const tp = onTrunk(rig, X, so, yb, -0.62, 0); return { along: Q.rot(so.D[tp.joint], [0.8, -0.5, 0.33]), palm: V.mul(tp.n, -1), pole: [-0.8, -0.25, -0.5], curl: 0.8 + 0.1 * stroke(t, up, down, 4) }; },
      mid: [0.08, -0.42, 0.14], body: (t, k) => ({ hp: 5 * DEG * k, pitch: 1 * DEG * k }) })]); }

  // a hand on her hip a while (her palm on her side just under her waist, her fingers forward), her weight settling onto it
  { const T = 4.3 * slow, up = 0.85 * slow, down = 3.3 * slow, yh = fl + lerp(L.waist, L.hips, 0.22);
    firstClean([() => oneHand("life_hand_hip", { T, up, down, point: "palm", bone: rig.J[rig.pelvis].name, over: ["stand"], weight: 0.8,
      target: so => onTrunk(rig, X, so, yh, -0.985, 0.003).at,
      arm: (H, t, k, so) => { const tp = onTrunk(rig, X, so, yh, -0.985, 0); return { along: Q.rot(so.D[tp.joint], [0.25, -0.5, 0.83]), palm: V.mul(tp.n, -1), pole: [-0.92, 0.12, -0.38], curl: 0.5 }; },
      mid: [0.13, -0.42, 0.02], body: (t, k) => ({ roll: 2 * DEG * k, hy: -3 * DEG * k }) })]); }

  // ---- by her arm's own angles, both arms, or no arm at all ------------------------------------------------------------
  const framesOf = (T, make) => Array.from({ length: Math.round(T * FPS) }, (_, f) => make(f / FPS));
  // her hand opened wide and closed, twice, at her side
  { const T = 2.1 * slow, a0 = 0.4 * slow, a1 = T - 0.55 * slow;
    list.push(clipOf("life_flex_hand", framesOf(T, t => { const k = E(t, 0.04, a0, a1, T - 0.06), c = frameOf(base, {}), a = c.arms.r;
      a.flex += 7 * DEG * k; a.elbow += 20 * DEG * k; a.curl = lerp(a.curl, 0.65 - 0.65 * Math.cos(TAU * (t - a0) / (0.5 * (a1 - a0))), k); a.wrist = 13 * DEG * Math.sin(TAU * (t - a0) / (a1 - a0)) * k; return c; }),
      { life: life({ head: "", weight: 0.7 }, T, a0, a1) })); }

  // both arms up over her head, her back arched, and down again out in front of her sides
  { const T = 3.9 * slow, up = 1.2 * slow, down = 2.3 * slow, armL = A.upper + A.fore; let spread = 0, frames = [];
    const make = t => { const k = E(t, 0.05, up, down, T - 0.08), arch = E(t, up - 0.45, up + 0.2, down - 0.1, down + 0.5);
      const c = frameOf(base, { pitch: -8 * DEG * arch, hp: -13 * DEG * arch, clav: { l: { up: 16 * DEG * k }, r: { up: 16 * DEG * k } } }), home = homeOf(rig, c);
      for (const [s, g] of [["l", 1], ["r", -1]]) { const sh = home.shoulder[s], x = g * Math.max(0.85 * body.shoulderHalf, body.headR[0] + 0.07 * hs);
        const to = [x, sh[1] + 0.93 * armL, sh[2] - (0.03 + 0.05 * arch) * sc], mid = t < (up + down) / 2 ? [sh[0] + g * (0.1 + spread) * sc, sh[1] - 0.04 * sc, sh[2] + (0.3 + 0.3 * spread) * sc] : [sh[0] + g * (0.25 + 0.5 * spread) * sc, sh[1] + 0.06 * sc, sh[2] + 0.2 * sc];
        c.arms[s] = armVia(home, s, to, k, { palm: [0, 0.35, 0.94], pole: V.lerp([g * 0.3, -0.8, -0.5], [g * 0.85, -0.45, -0.25], sm(up, down, t)), curl: 0.9 - 0.7 * arch, wrist: -15 * DEG * arch, mid }); }   // (her elbows down and back as her arms go up; out to her sides as they come down: left pointing back, a goblin's came down through its ribs)
      return c; };
    for (let i = 0; i < 8; i++) { frames = framesOf(T, make); const d = armsIn(rig, X, frames, ["l", "r"], 1); if (d.elbow <= ELBOW_IN && d.rest <= REST_IN) break; spread += 0.03; }
    firstClean([() => { const j = judge(rig, body, X, frames, ["l", "r"]); return { ...clipOf("life_stretch", frames, { life: life({ hand: "both", over: ["stand", "sit"], weight: 0.6 }, T, up, down) }), bad: j.bad, why: j.why }; }]); }

  // her palms together in front of her, rubbed: under her bust where her arms get there clear of her, else higher, in front of her breastbone
  { const T = 2.8 * slow, up = 0.72 * slow, down = 2.0 * slow; let best = null;
    for (const y of [fl + L.under - 0.02 * sc, fl + lerp(L.bust, body.shoulderY, 0.45), fl + lerp(L.belly, L.waist, 0.5)]) { let lift = 0.09 * sc, spread = 0, frames = [], d = null;
      const make = t => { const k = E(t, 0.05, up, down, T - 0.08), rub = stroke(t, up, down, 2.6), c = frameOf(base, { hp: 9 * DEG * k, pitch: 2 * DEG * k, clav: { l: { up: 6 * DEG * k }, r: { up: 6 * DEG * k } } }), home = homeOf(rig, c), so = home.pose.solve();
        const mid = onTrunk(rig, X, so, y, 0, lift), q = cq(so);
        for (const [s, g] of [["l", 1], ["r", -1]]) { const sh = home.shoulder[s], to = V.add(mid.at, Q.rot(q, [g * 0.036 * hs, 0, g * 0.016 * hs * rub]));
          c.arms[s] = armVia(home, s, to, k, { palm: Q.rot(q, [-g, 0, 0.05]), pole: [g * 0.85, -0.5, -0.2], curl: 0.4, wrist: -22 * DEG, mid: [sh[0] + g * (0.03 + spread) * sc, sh[1] - 0.3 * sc, sh[2] + (0.17 + 0.4 * spread) * sc] }); }
        return c; };
      const held = () => { const c = make((up + down) / 2), pose = build(rig, c), so = pose.solve(); return { in: X ? Math.max(armDepth(rig, X, pose, so, "l", 1, 1), armDepth(rig, X, pose, so, "r", 1, 1), armDepth(rig, X, pose, so, "l", 0, 0) - ELBOW_IN + REST_IN, armDepth(rig, X, pose, so, "r", 0, 0) - ELBOW_IN + REST_IN) : -1, reach: Math.max(pose.info.armReach_l, pose.info.armReach_r) }; };
      for (let i = 0; i < 10; i++) { const h = held(); if (h.in <= REST_IN || h.reach > 0.84) break; lift += 0.015 * sc; }
      for (let i = 0; i < 4; i++) { frames = framesOf(T, make); d = armsIn(rig, X, frames, ["l", "r"], 1); if (d.elbow <= ELBOW_IN && d.rest <= REST_IN) break; spread += 0.03; }
      const h = held(), j = judge(rig, body, X, frames, ["l", "r"]), far = 0.3 * (h.reach - 0.86), bad = Math.max(j.bad, far);
      if (!best || bad < best.bad) best = { frames, bad, why: far > j.bad ? "her arms at their full length" : j.why }; if (bad <= 0) break; }
    firstClean([() => ({ ...clipOf("life_rub_hands", best.frames, { life: life({ hand: "both", over: ["stand", "sit"], weight: 0.6 }, T, up, down) }), bad: best.bad, why: best.why })]); }

  // her shoulders rolled: forward, up, back and down, once and a half, her head tipping side to side
  { const T = 2.9 * slow;
    list.push(clipOf("life_roll_shoulders", framesOf(T, t => { const e = E(t, 0.08, 0.55 * slow, T - 0.75 * slow, T - 0.08), ph = TAU * (t - 0.15 * slow) / (1.5 * slow), cl = { up: (3 + 10 * Math.sin(ph)) * DEG * e, fwd: 9 * DEG * Math.cos(ph) * e };
      return frameOf(base, { clav: { l: cl, r: cl }, hr: 7 * DEG * Math.sin(0.5 * ph) * e, hp: -4 * DEG * e, pitch: -2 * DEG * e }); }),
      { life: life({ hand: "", free: false, weight: 0.8 }, T, 0.5 * slow, T - 0.7 * slow) })); }

  // a breath in, her shoulders up; out, they drop and her head sinks a little
  { const T = 3.1 * slow;
    list.push(clipOf("life_sigh", framesOf(T, t => { const inn = E(t, 0.1, 1.0 * slow, 1.35 * slow, 1.9 * slow), outt = E(t, 1.4 * slow, 2.1 * slow, 2.3 * slow, T - 0.1), cl = { up: (7 * inn - 2.5 * outt) * DEG };
      return frameOf(base, { clav: { l: cl, r: cl }, pitch: (-3.5 * inn + 2.5 * outt) * DEG, hp: (-4 * inn + 7 * outt) * DEG, breath: inn }); }),
      { life: life({ hand: "", free: false }, T, 0.6 * slow, T - 0.6 * slow) })); }

  // a look off to her right and back: something caught her eye
  { const T = 2.0 * slow;
    list.push(clipOf("life_glance", framesOf(T, t => { const k = E(t, 0.08, 0.5 * slow, 1.25 * slow, T - 0.1); return frameOf(base, { hy: -40 * DEG * k, yaw: -8 * DEG * k, hp: 2 * DEG * k, hr: -2 * DEG * k }); }),
      { life: { ...life({ hand: "", head: "look", free: false, weight: 1.2 }, T, 0.5 * slow, 1.25 * slow), side: "r" } })); }

  // her head tipped to one shoulder, held, then to the other
  { const T = 3.7 * slow;
    list.push(clipOf("life_neck_stretch", framesOf(T, t => { const a = E(t, 0.1, 0.7 * slow, 1.4 * slow, 2.0 * slow) - E(t, 1.75 * slow, 2.45 * slow, 3.0 * slow, T - 0.1), cl = g => ({ up: -3 * DEG * Math.max(0, -g * a) });
      return frameOf(base, { hr: 22 * DEG * a, hp: 3 * DEG * Math.abs(a), roll: -2 * DEG * a, clav: { l: cl(1), r: cl(-1) } }); }),
      { life: life({ hand: "", free: false, over: ["stand", "sit"], weight: 0.7 }, T, 0.7 * slow, T - 0.7 * slow) })); }
  list.skipped = skipped;
  return list;
}

/** the poses a thing is carried in, the right hand's (animate.js makes the left's as mirrors): one-pose clips, each
    with its record (`carry`: { hand, how, plumb: how much the arm hangs by gravity whatever her chest does, keep: how
    much of what her arm was doing is kept, a walk's swing }). The game's layer holds her arm in one over any clip
    (docs/ANIMATOR_V3.md §12); made here so the arm clears her own belly, bust and hips. */
export function carrying(rig, body, set, X = null) {
  const p = params(body, set), S = stance(rig, body, p, X), base = lifeBase(rig, body, set, X), sc = p.sc, hs = handScale(rig, sc), A = rig.armR, fl = body.floor, L = body.levels, list = [];
  // (an arm taken by its wrist: its elbow swung round until her arm is clear of her; where no swing clears it (a broad
  //  belly under a level forearm), the hand is moved out the way `a.out` says, a little at a time, and tried again)
  const posed = (name, how, plumb, keep, armOf) => { const c = frameOf(base, {}), home = homeOf(rig, c), so = home.pose.solve(), a = armOf(c, home, so);
    if (a.to) { let o = { ...a.opts }, to = a.to;
      for (let i = 0; i < 10; i++) { o = { ...a.opts }; o.pole = clearPole(rig, X, c, "r", to, o); const pose = build(rig, { ...c, arms: { ...c.arms, r: armVia(home, "r", to, 1, o) } }), s2 = pose.solve();
        if (!X || (armDepth(rig, X, pose, s2, "r", 0, 0) <= ELBOW_IN && armDepth(rig, X, pose, s2, "r", 1, 1) <= REST_IN)) break; to = within(V.mad(to, a.out || [-0.6, 0, 0.8], 0.022 * sc), home.shoulder.r, 0.9 * (A.upper + A.fore)); }
      c.arms.r = armVia(home, "r", to, 1, o); }
    else { c.arms.r = a; if (X) for (let i = 0; i < 30; i++) { const pose = build(rig, c); if (armDepth(rig, X, pose, pose.solve(), "r") <= 0) break; c.arms.r.abd += 1.2 * DEG; } }   // (an arm by its angles: carried out until it's clear of her, as the stance's is: these clips get no clearance of their own)
    list.push(clipOf(name, [c, copyOf(c)], { carry: { hand: "r", how, plumb, keep } })); };
  // at her side: her arm hanging, a little forward and bent, a fist
  posed("carry_side", "side", 1, 0.35, c => ({ ...c.arms.r, flex: c.arms.r.flex + 5 * DEG, abd: c.arms.r.abd + 2 * DEG, elbow: c.arms.r.elbow + 9 * DEG, curl: 1.15 }));
  // in front of her: her upper arm hanging, her forearm level and pointing ahead, her thumb up (a cup stands in the fist)
  posed("carry_front", "front", 0.7, 0, (c, home) => ({ to: V.add(home.shoulder.r, [0.045 * sc, -0.86 * A.upper, 0.9 * A.fore]), opts: { palm: [1, 0.05, 0], pole: [0.05, -0.6, -0.8], curl: 1.1 } }));
  // held to her chest: her hand in front of her breastbone, over her bust, her forearm in front of her (what she holds is between it and her)
  posed("carry_chest", "chest", 0, 0, (c, home, so) => { const y = fl + lerp(L.bust, body.shoulderY, 0.25), t = onTrunk(rig, X, so, y, 0.12, 0.05 * hs); return { to: t.at, out: [-0.15, 0.25, 0.95], opts: { palm: V.mul(t.n, -1), pole: [-0.25, -0.95, 0.1], curl: 0.7, wrist: 6 * DEG } }; });
  // over her shoulder: her fist in front of her shoulder, her forearm up, its thumb side back over her shoulder (a bat lies there)
  posed("carry_shoulder", "shoulder", 0, 0, (c, home) => ({ to: V.add(home.shoulder.r, [-0.01 * sc, 0.03 * sc, 0.14 * sc]), opts: { palm: V.norm([0.9, 0, -0.4]), pole: [-0.25, -0.9, 0.35], curl: 1.1, more: { dev: -10 * DEG } } }));
  // raised in front of her, about level with her chin: a lantern, a torch
  posed("carry_raised", "raised", 0.7, 0, (c, home) => ({ to: V.add(home.shoulder.r, [0.02 * sc, 0.1 * sc, 0.36 * sc]), opts: { palm: [1, 0.1, 0], pole: [-0.45, -0.85, -0.25], curl: 1.1 } }));
  return list;
}

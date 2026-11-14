// ANIMATOR: the Animator v2 (docs/ANIMATOR_V2.md) without a browser or Godot, on the three bodies it's tested on
// (bodies.mjs: a skinny man, a normal woman, a chubby woman, laid out as the Character Studio's export is).
//   node tools/animator/check.mjs [--verbose]            ends "ANIMATOR ok"
// What it holds: the measures (each body's weight from its own unclothed body, the same from its meshes; who is
// heavier, who has a bust, a belly); the soft bones each body gets and their skin weights (every point still adds up to
// one, on four bones at most; the garment goes with the skin); every clip there, each loop closing on itself and no
// frame jumping, each act starting and ending in the idle's pose (or on the seat, on the bed); the walk (its pace by
// the body, the knee bent as a walking knee is, no leg asked to be longer than it is, the planted foot staying where
// it was put, the toes clear of the floor); what each slider does; the arms never inside the body, the thighs squashed
// where they would overlap; the soft tissue's motion (a bust in a woman's walk, more in her run, none at softness 0);
// the bake (only bones animated, never the face's, never a morph target; baked again no bigger; unbaked, the file's
// own skin weights back to the last bit). And animations v3 (docs/ANIMATOR_V3.md): each new clip to its rules on the
// three people, then the same clips on five creatures' bodies (bodies.mjs CREATURE_BODIES: the Studio's creature cards
// made in node): the elbow's hinge MHR's own on any body, no arm wrung along its length, nothing turning faster than
// it may, nothing under the floor, no arm asked for more than its length, a wall clear of a hunched face, a hand that
// gets to what it reaches for.
import { testBody, bodyGlb, mhrRigBuffer, TEST_BODIES, CREATURE_BODIES } from "./bodies.mjs";
import { parseGlb } from "./core/glb.js";
import { prepare, attach, animate, makers, makeClip, settingsFor } from "./core/animate.js";
import { measure, meshPoints, summary } from "./core/measure.js";
import { unbake, baked, record } from "./core/bake.js";
import { jiggleTick, ringOf, stiffOf, softUse, TICK } from "./core/soft.js";
import { isBodyBone } from "./core/clips.js";
import { skinned, partKind, ELBOW } from "./core/rig.js";
import { Q, V, DEG } from "./core/m.js";

const VERBOSE = process.argv.includes("--verbose"), t0 = Date.now(), errs = [], MHR = mhrRigBuffer();
const ok = (cond, what, got = "") => { if (!cond) errs.push(`${what}${got !== "" ? `: ${got}` : ""}`); else if (VERBOSE) console.log(`  ok  ${what}${got !== "" ? `: ${got}` : ""}`); };
const say = t => console.log("  " + t);
const NAMES = ["idle_loop", "walk_loop", "run_loop", "sit_down", "sit_loop", "stand_up", "lie_down", "sleep_loop", "get_up", "lie_down_r", "sleep_r_loop", "get_up_r", "open_push", "open_pull", "open_slide",
  "open_push_l", "open_pull_l", "open_slide_l", "reach_low", "reach_mid", "reach_high", "reach_low_l", "reach_mid_l", "reach_high_l"];
// animations v3 (docs/ANIMATOR_V3.md §2)
const V3 = ["sneak_loop", "crouch_loop", "crawl_loop", "crawl_idle_loop", "creep_loop", "creep_idle_loop", "scuttle_loop", "peek_out", "peek_loop", "peek_back", "peek_out_l", "peek_l_loop", "peek_back_l",
  "scare_lunge", "scare_loom", "scare_snap", "scare_claw", "punch", "swing", "hit_react", "punch_l", "swing_l", "eat", "drink", "eat_l", "drink_l", "look_around", "knock", "cower_loop"];
NAMES.push(...V3);
const FAST = /^(scare_|punch|swing)/;                         // a blow or a scare is thrown: its arms may turn faster in a frame than anything else does
const bytes = {}, ctxs = {}, clips = {};
const clamp1 = x => Math.max(-1, Math.min(1, x));
const quatAngle = (a, b, i, j) => { const d = Math.abs(a[i] * b[j] + a[i + 1] * b[j + 1] + a[i + 2] * b[j + 2] + a[i + 3] * b[j + 3]); return 2 * Math.acos(Math.min(1, d)); };
const trackOf = (rig, c, name) => c.tracks.find(t => rig.J[t.joint].name === name);
const all = (ctx, set, only) => Object.fromEntries(makers(ctx.rig, ctx.body, set, only, ctx.X).map(m => { const c = makeClip(ctx.rig, ctx.body, ctx.X, ctx.plan, m, set); return [m.name, { ...c.tracks, stats: c.stats, frames: c.frames, maker: m }]; }));

// ---- 1. the bodies, measured ----------------------------------------------------------------------------------------------
for (const n of Object.keys(TEST_BODIES)) {
  bytes[n] = bodyGlb(testBody(n)); const g = parseGlb(bytes[n]); ctxs[n] = prepare(g, { mhrRig: MHR }); const b = ctxs[n].body, s = summary(b);
  ok(ctxs[n].rig.unturned, `${n}: its bones are unturned, as the Studio's are`);
  ok(b.from === "recipe" && Math.abs(b.height - TEST_BODIES[n].height) < 0.005, `${n}: measured from its own unclothed body, as tall as it was made`, `${s.height} cm from its ${b.from}`);
  const m2 = measure(ctxs[n].rig, meshPoints(g, ctxs[n].rig));
  ok(Math.abs(m2.mass - b.mass) < 0.08 * b.mass, `${n}: its meshes weigh about what its body does`, `${m2.mass.toFixed(1)} and ${b.mass.toFixed(1)} kg`);
  say(`${n}: ${s.height} cm, ${s.weight} kg (build ${s.build}), bust ${s.bust} waist ${s.waist} hips ${s.hips}, legs ${s.leg} cm; soft: ${ctxs[n].plan.map(x => `${x.name.slice(5)} ${x.amount.toFixed(1)}`).join(", ")}`);
}
const M = ctxs.skinny_man, W = ctxs.normal_woman, C = ctxs.chubby_woman;
ok(M.body.mass > 54 && M.body.mass < 67 && M.body.build < -0.2, "the skinny man is light", `${M.body.mass.toFixed(1)} kg, build ${M.body.build.toFixed(2)}`);
ok(W.body.mass > 49 && W.body.mass < 63 && Math.abs(W.body.build) < 0.3, "the normal woman is ordinary", `${W.body.mass.toFixed(1)} kg, build ${W.body.build.toFixed(2)}`);
ok(C.body.mass > 65 && C.body.mass < 82 && C.body.build > 0.6, "the chubby woman is heavy", `${C.body.mass.toFixed(1)} kg, build ${C.body.build.toFixed(2)}`);
ok(W.body.bustOut > 0.02 && M.body.bustOut < 0.015 && C.body.bellyOut > W.body.bellyOut + 0.005 && C.body.r.thigh > W.body.r.thigh + 0.008, "a bust on the women, a belly and thicker thighs on the chubby one",
  `bust out ${(W.body.bustOut * 100).toFixed(1)} and ${(M.body.bustOut * 100).toFixed(1)} cm; belly out ${(C.body.bellyOut * 100).toFixed(1)} and ${(W.body.bellyOut * 100).toFixed(1)} cm`);
ok(W.body.femme > 0.4 && M.body.femme < 0.2, "the shape itself says which is which (for a file with no recipe)", `${W.body.femme.toFixed(2)} and ${M.body.femme.toFixed(2)}`);

// ---- 2. the soft bones and their skin weights ---------------------------------------------------------------------------------
ok(!M.plan.some(b => b.kind === "bust") && W.plan.filter(b => b.kind === "bust").length === 2, "no bust bones on the man, two on the woman");
const amt = (ctx, kind) => Math.max(0, ...ctx.plan.filter(b => b.kind === kind).map(b => b.amount));
ok(amt(C, "belly") > amt(W, "belly") + 0.2 && amt(C, "thigh") > amt(W, "thigh") + 0.2 && amt(W, "thigh") > amt(M, "thigh"), "the heavier the body the more its belly and thighs are given", `belly ${amt(C, "belly").toFixed(2)}, ${amt(W, "belly").toFixed(2)}; thigh ${amt(C, "thigh").toFixed(2)}, ${amt(W, "thigh").toFixed(2)}, ${amt(M, "thigh").toFixed(2)}`);
for (const [n, ctx] of Object.entries(ctxs)) {
  const g = ctx.glb, j = g.json, softFrom = j.skins[0].joints.length - ctx.plan.length; let worst = 0, most = 0, soft = { skin: 0, cover: 0 }, bad = 0;
  for (const part of skinned(g)) for (const pr of part.prims) { const JI = g.read(pr.attributes.JOINTS_0), JW = g.read(pr.attributes.WEIGHTS_0, { float: true });
    for (let v = 0; v < JW.length / 4; v++) { let s = 0, sw = 0; for (let k = 0; k < 4; k++) { const w = JW[v * 4 + k]; s += w; if (JI[v * 4 + k] >= softFrom && w > 0) sw += w; if (JI[v * 4 + k] >= j.skins[part.skin].joints.length) bad++; }
      worst = Math.max(worst, Math.abs(s - 1)); most = Math.max(most, sw); if (sw > 0.01) soft[partKind(part.name)]++; } }
  ok(worst < 1e-4 && bad === 0, `${n}: every point's weights still add up to one, on bones the skin has`, `off by ${worst.toExponential(1)} at most`);
  ok(most <= 0.801 && most > 0.3, `${n}: a point gives a soft bone 0.8 of itself at most`, most.toFixed(2));
  ok(soft.skin > 400 && soft.cover > 200, `${n}: skin and garment both go with the soft bones`, `${soft.skin} points of skin, ${soft.cover} of the garment`);
}

// ---- 3. the clips ---------------------------------------------------------------------------------------------------------
for (const [n, ctx] of Object.entries(ctxs)) {
  const set = settingsFor(ctx.glb, ctx.body, {}); clips[n] = all(ctx, set);
  ok(NAMES.every(c => clips[n][c]) && Object.keys(clips[n]).length === NAMES.length, `${n}: every clip made`, Object.keys(clips[n]).length);
  ok(Math.sign(set.style) === (n === "skinny_man" ? -1 : 1), `${n}: the walk's style starts from the body`, set.style);
  let jump = 0, where = "", nan = 0, face = 0, fast = 0, fastWhere = "";
  for (const c of Object.values(clips[n])) for (const t of c.tracks) { const nm = ctx.rig.J[t.joint].name; if (!isBodyBone(nm)) face++;
    if (t.r) for (let k = 0; k < c.keys; k++) { for (let q = 0; q < 4; q++) if (!Number.isFinite(t.r[k * 4 + q])) nan++; if (k) { const a = quatAngle(t.r, t.r, (k - 1) * 4, k * 4);
      if (FAST.test(c.name)) { if (a > fast) { fast = a; fastWhere = `${c.name} ${nm} key ${k}`; } } else if (a > jump) { jump = a; where = `${c.name} ${nm} key ${k}`; } } }
    if (t.t) for (let k = 1; k < c.keys; k++) { const d = Math.hypot(t.t[k * 3] - t.t[k * 3 - 3], t.t[k * 3 + 1] - t.t[k * 3 - 2], t.t[k * 3 + 2] - t.t[k * 3 - 1]); if (/^root$/.test(nm) && d > 0.07) errs.push(`${n} ${c.name}: the pelvis jumps ${(d * 100).toFixed(1)} cm in a frame (key ${k})`); } }
  ok(nan === 0 && face === 0, `${n}: every track a number, none on the face's bones or the springs'`);
  ok(jump < 34 * DEG, `${n}: no bone turns more than 34 degrees in a frame`, `${(jump / DEG).toFixed(1)} degrees (${where})`);
  ok(fast < 56 * DEG, `${n}: a blow's or a scare's bones no more than 56`, `${(fast / DEG).toFixed(1)} degrees (${fastWhere})`);
  // a loop closes on itself; an act starts and ends where the next one takes over
  const key = (c, k) => { const o = {}; for (const t of c.tracks) if (t.r) o[ctx.rig.J[t.joint].name] = t.r.subarray(k * 4, k * 4 + 4); return o; };
  const apart = (a, b) => { let w = 0; for (const nm of Object.keys(a)) if (b[nm] && !/^soft_/.test(nm)) w = Math.max(w, quatAngle(a[nm], b[nm], 0, 0)); return w / DEG; };
  const idle0 = key(clips[n].idle_loop, 0), last = c => key(c, c.keys - 1);
  for (const c of Object.values(clips[n])) if (c.loop) ok(apart(key(c, 0), last(c)) < 0.2, `${n} ${c.name}: its last key is its first`);
  for (const c of ["open_push", "open_pull", "open_slide", "reach_low", "reach_mid", "reach_high"]) ok(apart(key(clips[n][c], 0), idle0) < 2 && apart(last(clips[n][c]), idle0) < 2, `${n} ${c}: starts and ends in the idle's first pose`, `${apart(key(clips[n][c], 0), idle0).toFixed(1)} and ${apart(last(clips[n][c]), idle0).toFixed(1)} degrees off`);
  // (a left hand's clip is the right's in a mirror: it starts with the weight on the other leg, a shift a player's blend makes)
  for (const c of ["open_push_l", "reach_high_l", "lie_down_r"]) ok(apart(key(clips[n][c], 0), idle0) < 20 && apart(last(clips[n][c]), key(clips[n][c], 0)) < (c === "lie_down_r" ? 400 : 2), `${n} ${c}: starts near the idle's pose (the weight on the other leg), ends as it started`, `${apart(key(clips[n][c], 0), idle0).toFixed(1)} degrees off`);
  ok(apart(key(clips[n].sit_down, 0), idle0) < 2 && apart(last(clips[n].stand_up), idle0) < 2 && apart(key(clips[n].lie_down, 0), idle0) < 2 && apart(last(clips[n].get_up), idle0) < 2, `${n}: sitting and lying down start stood as the idle stands, getting up ends so`);
  ok(apart(last(clips[n].sit_down), key(clips[n].sit_loop, 0)) < 5 && apart(key(clips[n].stand_up, 0), key(clips[n].sit_loop, 0)) < 5, `${n}: sit_down ends sat as sit_loop sits, stand_up starts there`, `${apart(last(clips[n].sit_down), key(clips[n].sit_loop, 0)).toFixed(1)} and ${apart(key(clips[n].stand_up, 0), key(clips[n].sit_loop, 0)).toFixed(1)} degrees off`);
  ok(apart(last(clips[n].lie_down), key(clips[n].sleep_loop, 0)) < 5 && apart(key(clips[n].get_up, 0), key(clips[n].sleep_loop, 0)) < 5, `${n}: lie_down ends as sleep_loop lies, get_up starts there`, `${apart(last(clips[n].lie_down), key(clips[n].sleep_loop, 0)).toFixed(1)} and ${apart(key(clips[n].get_up, 0), key(clips[n].sleep_loop, 0)).toFixed(1)} degrees off`);
}

// ---- 4. the walk and the run ------------------------------------------------------------------------------------------------
const gaitFacts = (ctx, c) => {
  const R = ctx.rig, F = c.frames, n = F.length, L = R.legL, P = (f, j) => [F[f].solved.P[j * 3], F[f].solved.P[j * 3 + 1], F[f].solved.P[j * 3 + 2]];
  let load = 0, swing = 0, reach = 0, low = 1e9, slip = 0, toeLow = 1e9, pyLo = 1e9, pyHi = -1e9, width = 0, list = 0;
  const beta = c.maker.plan.beta, v = c.speed, T = c.secs;
  let anchor = null;
  for (let f = 0; f < n; f++) { const phi = f / n, k = F[f].pose.info.knee_l / DEG, cc = F[f].c; reach = Math.max(reach, F[f].pose.info.reach_l, F[f].pose.info.reach_r);
    if (phi < 0.3) load = Math.max(load, k); if (phi > beta) swing = Math.max(swing, k);
    const ball = P(f, L.ball), ank = P(f, L.foot); low = Math.min(low, ball[1], ank[1]); pyLo = Math.min(pyLo, cc.pelvis.pos[1]); pyHi = Math.max(pyHi, cc.pelvis.pos[1]); width = Math.max(width, cc.legs.l.ankle[0] - cc.legs.r.ankle[0]); list = Math.max(list, Math.abs(cc.pelvis.roll));
    if (phi > 0.12 && phi < 0.3 && cc.legs.l.pitch === 0 || (phi > 0.1 && phi < 0.28 && Math.abs(cc.legs.l.pitch) < 1e-6)) { const z = ank[2] + v * T * phi; if (anchor == null) anchor = z; slip = Math.max(slip, Math.abs(z - anchor)); }
    if (phi > beta + 0.05 && phi < 0.95) toeLow = Math.min(toeLow, ball[1]); }
  return { load, swing, reach, low, slip, toeLow, bob: pyHi - pyLo, width, list: list / DEG, speed: v, secs: T };
};
const walkOf = {};
for (const [n, ctx] of Object.entries(ctxs)) {
  const w = walkOf[n] = gaitFacts(ctx, clips[n].walk_loop), r = gaitFacts(ctx, clips[n].run_loop);
  ok(w.speed > 0.95 && w.speed < 1.6 && w.secs > 0.85 && w.secs < 1.35, `${n}: walks at a walking pace`, `${w.speed.toFixed(2)} m/s, a stride every ${w.secs.toFixed(2)} s`);
  ok(w.load > 9 && w.load < 34 && w.swing > 52 && w.swing < 78, `${n}: the knee gives as the foot takes the weight and folds to swing through`, `${w.load.toFixed(0)} and ${w.swing.toFixed(0)} degrees`);
  ok(w.reach < 0.9996 && r.reach < 0.9996, `${n}: no leg is asked to be longer than it is`, `${w.reach.toFixed(4)}, running ${r.reach.toFixed(4)}`);
  ok(w.slip < 0.012, `${n}: the planted foot stays where it was put`, `${(w.slip * 1000).toFixed(1)} mm`);
  ok(w.low > 0.008 && w.toeLow > 0.015, `${n}: no foot under the floor, the toes clear of it in swing`, `${(w.low * 1000).toFixed(0)} and ${(w.toeLow * 1000).toFixed(0)} mm`);
  ok(w.bob > 0.015 && w.bob < 0.065, `${n}: the pelvis rises and falls over each step`, `${(w.bob * 100).toFixed(1)} cm`);
  ok(r.speed > 1.9 * w.speed && r.speed < 4.2 && r.swing > 70 && r.swing < 125 && r.bob > 0.02, `${n}: the run is a run`, `${r.speed.toFixed(2)} m/s, the knee to ${r.swing.toFixed(0)} degrees, the pelvis ${(r.bob * 100).toFixed(1)} cm`);
}
ok(walkOf.chubby_woman.speed < walkOf.normal_woman.speed - 0.08 && walkOf.chubby_woman.width > walkOf.normal_woman.width + 0.015, "the heavier woman walks slower and a little wider", `${walkOf.chubby_woman.speed.toFixed(2)} and ${walkOf.normal_woman.speed.toFixed(2)} m/s; ${(walkOf.chubby_woman.width * 100).toFixed(1)} and ${(walkOf.normal_woman.width * 100).toFixed(1)} cm`);
ok(walkOf.chubby_woman.width < 0.16, "but not wide: the thighs squash instead", `${(walkOf.chubby_woman.width * 100).toFixed(1)} cm between the ankles`);

// ---- 5. the sliders -------------------------------------------------------------------------------------------------------
{
  const f = (set, only = ["walk"]) => all(W, { ...settingsFor(W.glb, W.body, {}), ...set }, only), g = c => gaitFacts(W, c.walk_loop);
  const fem = g(f({ style: 1 })), masc = g(f({ style: -1 })), heavy = g(f({ weight: 1 })), light = g(f({ weight: -1 })), strong = g(f({ strength: 1 })), weak = g(f({ strength: 0 }));
  ok(fem.width < masc.width - 0.04 && fem.list > masc.list + 2, "style: a feminine walk is narrower and lists the hips more than a masculine one", `${(fem.width * 100).toFixed(1)} and ${(masc.width * 100).toFixed(1)} cm, ${fem.list.toFixed(1)} and ${masc.list.toFixed(1)} degrees`);
  ok(heavy.speed < light.speed - 0.15 && heavy.width > light.width, "weight: heavier is slower and wider", `${heavy.speed.toFixed(2)} and ${light.speed.toFixed(2)} m/s`);
  ok(strong.speed > weak.speed + 0.08, "strength: a strong body walks faster than a weak one", `${strong.speed.toFixed(2)} and ${weak.speed.toFixed(2)} m/s`);
  // how fast the pelvis is still coming down as it meets the seat
  const drop = c => { const t = trackOf(W.rig, c.sit_down, "root").t, k = Math.max(2, Math.floor(c.sit_down.events.find(e => e.name === "seated").t * 30)); return (t[(k - 2) * 3 + 1] - t[k * 3 + 1]) * 15; };
  const sw = f({ strength: 0, weight: 0.6 }, ["sit"]), ss = f({ strength: 1 }, ["sit"]);
  ok(drop(sw) > drop(ss) + 0.25 && sw.sit_down.secs > ss.sit_down.secs, "strength: a weak, heavy body is still dropping as it meets the seat, a strong one sets itself down; and the weak one takes longer over it", `${drop(sw).toFixed(2)} and ${drop(ss).toFixed(2)} m/s, ${sw.sit_down.secs.toFixed(1)} and ${ss.sit_down.secs.toFixed(1)} s`);
  const s0 = f({ soft: 0 }), s1 = f({ soft: 1 }), s2 = f({ soft: 1.5 }), b = c => c.walk_loop.stats.soft.soft_bust_l;
  ok(b(s0) < 0.3 && b(s1) > 3 && b(s1) < 22 && b(s2) > b(s1) * 1.2, "softness: none at 0, a bust that moves at 1, more at 1.5", `${b(s0)}, ${b(s1)}, ${b(s2)} mm`);
  const b0 = f({ bounce: 0 }), b1 = f({ bounce: 1 });
  ok(b(b1) > b(s1) * 1.03 && b(b0) < b(s1) * 0.85, "bounce: a bust that settles at once moves less in the walk, one left to ring moves more", `${b(b0)}, ${b(s1)}, ${b(b1)} mm`);
}

// ---- 5b. the soft bones are jiggle bones (JiggleBones' way: DECISIONS 2026-11-13, the hands and the jiggle) -------------------
{ // the plugin's rule itself: its default bone (stiffness 1, damping 0) at 60 ticks a second
  const d = ringOf(1, 0); ok(Math.abs(d.f - 3.669) < 0.01 && Math.abs(d.half - 0.1526) < 0.001, "JiggleBones' default bone (stiffness 1, damping 0) rings at 3.67 Hz and halves in 0.15 s by the rule as written here", `${d.f.toFixed(2)} Hz, ${d.half.toFixed(3)} s`);
  ok(Math.abs(ringOf(stiffOf(2.8), 0).f - 2.8) < 0.01 && ringOf(1, 30).f < ringOf(1, 0).f && ringOf(1, 30).half < ringOf(1, 0).half, "a stiffness is found for the rate a bone should ring at; damping shortens the ringing");
  // a weight let go 0.3 rad off with its joint still: measured, it rings and dies as the rule's own solution says
  const rest = V.norm([0, -0.47, 0.88]), len = 0.074, stiff = 0.5567, damp = 2, st = { x: V.mul(Q.rot(Q.axis([1, 0, 0], 0.3), rest), len), xp: null }, ang = []; st.xp = st.x.slice();
  for (let t = 0; t < 120; t++) { jiggleTick(st, [0, 0, 0], rest, len, stiff, damp); const dd = V.norm(st.x); ang.push(Math.atan2(V.dot(V.cross(rest, dd), [1, 0, 0]), V.dot(rest, dd))); }
  const cross = [], peaks = []; for (let i = 1; i < ang.length; i++) { if ((ang[i - 1] < 0) !== (ang[i] < 0)) cross.push(i - 1 + Math.abs(ang[i - 1]) / (Math.abs(ang[i - 1]) + Math.abs(ang[i]))); if (i < ang.length - 1 && Math.abs(ang[i]) > Math.abs(ang[i - 1]) && Math.abs(ang[i]) >= Math.abs(ang[i + 1]) && Math.abs(ang[i]) > 3e-4) peaks.push([i, Math.abs(ang[i])]); }
  const hz = (cross.length - 1) / (2 * (cross[cross.length - 1] - cross[0]) * TICK), half = (peaks[peaks.length - 1][0] - peaks[0][0]) * TICK * Math.log(0.5) / Math.log(peaks[peaks.length - 1][1] / peaks[0][1]), want = ringOf(stiff, damp);
  ok(Math.abs(hz / want.f - 1) < 0.03 && Math.abs(half / want.half - 1) < 0.1 && Math.abs(V.len(st.x) - len) < 1e-9, "a weight let go rings at the rate and dies in the time the rule gives, and stays on its rod", `${hz.toFixed(2)} Hz, half in ${half.toFixed(3)} s (${want.f.toFixed(2)}, ${want.half.toFixed(3)})`);
  ok(Math.abs(ang[9] + 0.154851) < 1e-5 && Math.abs(ang[19] - 0.074595) < 1e-5 && Math.abs(ang[29] + 0.032468) < 1e-5, "the same weight after 10, 20 and 30 ticks as Godot's HSSoftJiggle is held to (JIGGLE)", `${ang[9].toFixed(6)}, ${ang[19].toFixed(6)}, ${ang[29].toFixed(6)}`);
  // each soft bone a rod from where the flesh is rooted to its middle: the joint deeper in the body than the middle
  for (const [n, ctx] of Object.entries(ctxs)) { const bad = [], rig = ctx.rig;
    for (const x of ctx.plan) { const j = rig.J[x.j].at, ax = x.kind === "thigh" ? x.axis : null, out = p => Math.hypot(p[0], p[2] - rig.J[rig.pelvis].at[2]);
      // (a thigh's is rooted across its bone from its middle, inside the thigh; the others nearer the trunk's own line than their middles)
      const inside = ax ? V.len(V.perp(V.sub(x.pivot, ax.a), ax.d)) < 0.9 * ctx.body.r.thigh && V.dot(V.sub(x.pivot, ax.a), x.medial) < 0 && V.dot(V.sub(x.at, ax.a), x.medial) > 0 : out(x.pivot) < out(x.at) - 0.01;
      if (V.dist(j, x.pivot) > 1e-6 || x.len < 0.04 || x.len > 0.15 || Math.abs(V.len(x.dir) - 1) > 1e-9 || !inside) bad.push(`${x.name} (rod ${(x.len * 100).toFixed(1)} cm)`); }
    ok(!bad.length, `${n}: each soft bone's joint is where its flesh is rooted, deeper in the body than its middle, a rod of 4 to 15 cm between`, bad.join(", ") || ctx.plan.filter(x => x.side >= 0).map(x => `${x.name.replace("soft_", "")} ${(x.len * 100).toFixed(1)}`).join(", ") + " cm"); }
  // baked as a swing: the bone turns; it isn't shifted (a breast's only by its breath)
  { const c = clips.normal_woman.walk_loop, tr = trackOf(W.rig, c, "soft_bust_l"); let turn = 0, shift = 0;
    for (let k = 0; k < c.keys; k++) { turn = Math.max(turn, 2 * Math.acos(Math.min(1, Math.abs(tr.r[k * 4 + 3])))); shift = Math.max(shift, Math.hypot(tr.t[k * 3] - tr.t[0], tr.t[k * 3 + 1] - tr.t[1], tr.t[k * 3 + 2] - tr.t[2])); }
    ok(tr.r && turn > 4 * DEG && turn < 30 * DEG && shift < 0.0005, "baked as a swing about its root: a breast's bone turns in the walk and isn't shifted", `${(turn / DEG).toFixed(1)} degrees, ${(shift * 1000).toFixed(2)} mm`); }
  // it carries on after the body has stopped: sitting down, the breast still swings after she has landed, and settles
  { const c = clips.normal_woman.sit_down, bj = W.plan.find(x => x.name === "soft_bust_l"), sw = k => { const fr = c.frames[k], D = fr.pose.D[bj.j]; return D ? Q.angle(Q.mul(D, Q.conj(fr.solved.D[bj.parent]))) : 0; };
    const k0 = Math.round(c.maker.events.find(e => e.name === "seated").t * 30); let after = 0; for (let k = k0 + 2; k < Math.min(c.frames.length, k0 + 14); k++) after = Math.max(after, sw(k)); let end = 0; for (let k = c.frames.length - 4; k < c.frames.length; k++) end = Math.max(end, sw(k));
    ok(after > 1.2 * DEG && end < 0.45 * after, "it carries on after the body has stopped: sat down, her bust still swings, then settles", `${(after / DEG).toFixed(1)} degrees in the moments after she lands, ${(end / DEG).toFixed(1)} at the clip's end`); }
  const use = softUse(W.plan.find(x => x.name === "soft_bust_l"), { soft: 1, bounce: 0.5 }), ring = ringOf(use.stiff, use.damp);
  ok(ring.f > 2.2 && ring.f < 3.6 && ring.half > 0.12 && ring.half < 0.3, "a breast rings a few times and stops, as the plugin's own default does", `${ring.f.toFixed(1)} Hz, half its swing gone in ${ring.half.toFixed(2)} s`);
}

// ---- 6. nothing through itself, and what moves ----------------------------------------------------------------------------------
for (const [n, ctx] of Object.entries(ctxs)) for (const c of ["idle_loop", "walk_loop", "run_loop"]) ok(clips[n][c].stats.armInside <= 1, `${n} ${c}: no arm inside the body`, `${clips[n][c].stats.armInside} mm`);
ok(clips.chubby_woman.walk_loop.stats.arm_l > clips.skinny_man.walk_loop.stats.arm_l + 4, "the chubby woman carries her arms further out than the skinny man", `${clips.chubby_woman.walk_loop.stats.arm_l} and ${clips.skinny_man.walk_loop.stats.arm_l} degrees`);
// the hands (the user's screenshot, DECISIONS 2026-11-13, the hands: a runner's palms faced the ground): where the palms
// face, counted against the chest's own side-to-side axis; how closed the hand is; where the thumb is; a runner's fist
// going from beside the hip to in front of the chest
{ const hands = (n, c) => { const rig = ctxs[n].rig, o = { in: 9, down: -9, tip: 0, thumb: 0, zBack: 9, zFront: -9, yBack: 0, yFront: 0, k: 0 }, at = (P, j) => [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]];
    for (const fr of clips[n][c].frames) for (const sd of ["l", "r"]) { const g = sd === "l" ? 1 : -1, A = rig.arm(sd), P = fr.solved.P, pn = fr.pose.info["palm_" + sd], W = at(P, A.hand), ix = j => rig.ix.get(`${sd}_${j}`);
      o.in = Math.min(o.in, V.dot(pn, V.mul(Q.rot(fr.solved.D[rig.chest], [-1, 0, 0]), g))); o.down = Math.max(o.down, -pn[1]);
      o.tip += V.dist(at(P, ix("middle_null")), W) / A.handLen; o.thumb += V.dist(at(P, ix("thumb_null")), at(P, ix("index2"))) / A.handLen; o.k++;
      const z = W[2] - P[rig.pelvis * 3 + 2]; if (z < o.zBack) { o.zBack = z; o.yBack = W[1] - at(P, rig.leg(sd).up)[1]; } if (z > o.zFront) { o.zFront = z; o.yFront = W[1] - at(P, A.up)[1]; } }
    o.tip /= o.k; o.thumb /= o.k; return o; };
  const rest = (() => { const rig = ctxs.normal_woman.rig, A = rig.armL, at = nm => rig.J[rig.ix.get(nm)].at; return V.dist(at("l_thumb_null"), at("l_index2")) / A.handLen; })();
  for (const n of Object.keys(ctxs)) { const i = hands(n, "idle_loop"), w = hands(n, "walk_loop"), r = hands(n, "run_loop"), sc = ctxs[n].body.leg / 0.87;
    ok(i.in > 0.75 && w.in > 0.75 && i.down < 0.3 && w.down < 0.3, `${n}: standing and walking, the palms face the body (1: square to it), none toward the floor`, `${i.in.toFixed(2)} and ${w.in.toFixed(2)}; down ${i.down.toFixed(2)} and ${w.down.toFixed(2)}`);
    ok(r.in > 0.6 && r.down < 0.55, `${n}: running, the palms face the body and not the ground`, `${r.in.toFixed(2)}, down ${r.down.toFixed(2)} at the most`);
    ok(w.tip > 0.72 && w.tip < 0.97 && r.tip < 0.62, `${n}: a walking hand is at rest (neither flat nor closed), a running one a loose fist`, `the fingertip ${w.tip.toFixed(2)} and ${r.tip.toFixed(2)} of the hand's length from the wrist`);
    ok(w.thumb < 0.62 * rest && r.thumb < 0.62 * rest, `${n}: the thumb lies in by the first finger, not held off the hand as the rig's rest pose has it`, `${(w.thumb / rest).toFixed(2)} and ${(r.thumb / rest).toFixed(2)} of the rest pose's gap`);
    ok(r.zBack < 0.06 * sc && Math.abs(r.yBack) < 0.2 * sc && r.zFront > 0.2 * sc && r.yFront > -0.3 * sc && r.yFront < 0.02, `${n}: a runner's fist goes from beside the hip to in front of the chest`, `${(r.zBack * 100).toFixed(0)} cm ahead of the pelvis at its hindmost, ${(r.yBack * 100).toFixed(0)} cm over the hip joint; ${(r.zFront * 100).toFixed(0)} cm ahead, ${(-r.yFront * 100).toFixed(0)} cm under the shoulder`); }
  const t = clips.chubby_woman.run_loop.stats;
  ok(t.turn_l > 15 && t.arm_l < 14, "the chubby woman's forearms are turned to point ahead past her belly when she runs, her arms hardly carried wider for it", `turned ${t.turn_l} degrees, carried out ${t.arm_l}`); }
{ const t = clips.chubby_woman.walk_loop.stats.soft.thighs, tm = clips.skinny_man.walk_loop.stats.soft.thighs;
  ok(t.before > 8 && t.after < 0.5 * t.before && tm.before < 3, "the chubby woman's thighs would overlap and are squashed instead; the skinny man's never meet", `${t.before} mm, ${t.after} left; his ${tm.before}`); }
{ const s = n => clips[n].walk_loop.stats.soft, r = n => clips[n].run_loop.stats.soft;
  ok(s("normal_woman").soft_bust_l > 3 && r("normal_woman").soft_bust_l > s("normal_woman").soft_bust_l * 1.3 && s("skinny_man").soft_bust_l == null, "a woman's bust moves in her walk and more in her run; the man has none", `${s("normal_woman").soft_bust_l} and ${r("normal_woman").soft_bust_l} mm`);
  ok(s("chubby_woman").soft_belly > s("normal_woman").soft_belly * 1.5, "the chubby woman's belly moves more", `${s("chubby_woman").soft_belly} and ${s("normal_woman").soft_belly} mm`);
  const press = clips.normal_woman.sit_loop.frames[0].pose.off.get(W.plan.find(b => b.name === "soft_seat_l").j); ok(press[1] > 0.008, "sat, the seat is pressed flat", `${(press[1] * 1000).toFixed(0)} mm`); }

// ---- 6b. animations v3 (docs/ANIMATOR_V3.md): the low gaits, all fours, peeking, the scares, the fights, the small acts ---------
const v3 = {};
for (const [n, ctx] of Object.entries(ctxs)) {
  const R = ctx.rig, C = clips[n], H = ctx.body.height, arm = ctx.body.upper + ctx.body.fore, at = (c, f, nm) => { const P = c.frames[f].solved.P, j = R.ix.get(nm); return [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]]; };
  const span = (c, names, k = 1) => { let lo = 1e9, hi = -1e9; for (let f = 0; f < c.frames.length; f++) for (const nm of names) { const y = at(c, f, nm)[k]; lo = Math.min(lo, y); hi = Math.max(hi, y); } return [lo, hi]; };
  // a contact that's down stays where it was put: the joint's place, carried back at the clip's own speed, over the phases it's down
  const slip = (c, nm, a, b) => { let z0 = null, x0 = 0, worst = 0; const m = c.frames.length; for (let f = 0; f < m; f++) { const phi = f / m; if (phi < a || phi > b) continue; const q = at(c, f, nm), z = q[2] + c.speed * c.secs * phi; if (z0 == null) { z0 = z; x0 = q[0]; } worst = Math.max(worst, Math.hypot(z - z0, q[0] - x0)); } return worst * 1000; };
  const keyOf = (c, k) => { const o = {}; for (const t of c.tracks) if (t.r) o[R.J[t.joint].name] = t.r.subarray(k * 4, k * 4 + 4); return o; };
  const apart = (a, b) => { let w = 0; for (const nm of Object.keys(a)) if (b[nm] && !/^soft_/.test(nm)) w = Math.max(w, quatAngle(a[nm], b[nm], 0, 0)); return w / DEG; };
  const first = c => keyOf(c, 0), last = c => keyOf(c, c.keys - 1), idle0 = first(C.idle_loop), fr = (c, t) => Math.min(c.frames.length - 1, Math.round(t * c.fps)), ev = (c, name) => c.events.filter(e => e.name === name).map(e => e.t);
  const cm = v => (v * 100).toFixed(1), mm = v => v.toFixed(1), idleHip = span(C.idle_loop, ["root"])[0], idleHead = span(C.idle_loop, ["c_head"])[1];
  // the sneak and the creep: slow, low, leant, the planted foot still
  { const s = C.sneak_loop, k = C.creep_loop, w = C.walk_loop, sh = span(s, ["root"]), kh = span(k, ["root"]), lean = c => Math.min(...c.frames.map(f => f.c.chest.pitch)) / DEG;
    ok(s.speed > 0.25 && s.speed < 0.8 && s.speed < 0.6 * w.speed && k.speed > 0.3 && k.speed < 1.0, `${n}: the sneak and the creep are slow`, `${s.speed.toFixed(2)} and ${k.speed.toFixed(2)} m/s (her walk ${w.speed.toFixed(2)})`);
    ok(sh[1] < idleHip - 0.06 && kh[1] < sh[1] - 0.03, `${n}: the sneak is held low, the creep lower`, `the pelvis ${cm(idleHip - sh[1])} and ${cm(idleHip - kh[1])} cm under where it stands`);
    ok(lean(s) > 15 && lean(k) > 30 && Math.max(...k.frames.map(f => f.c.head.pitch)) < 8 * DEG, `${n}: the trunk leant, a creeping head held up out of it`, `${lean(s).toFixed(0)} and ${lean(k).toFixed(0)} degrees`);
    ok(slip(s, "l_foot", 0.17, 0.44) < 12 && slip(k, "l_foot", 0.17, 0.42) < 12, `${n}: the planted foot stays where it was put`, `${mm(slip(s, "l_foot", 0.17, 0.44))} and ${mm(slip(k, "l_foot", 0.17, 0.42))} mm`);
    ok(span(s, ["l_ball", "r_ball", "l_foot", "r_foot"])[0] > 0.008 && span(k, ["l_ball", "r_ball", "l_foot", "r_foot"])[0] > 0.008, `${n}: no foot under the floor in either`);
    const cr = C.crouch_loop, ci = C.creep_idle_loop; ok(span(cr, ["root"])[1] < idleHip - 0.06 && span(ci, ["root"])[1] < span(cr, ["root"])[0] && span(cr, ["l_foot"], 2)[1] - span(cr, ["l_foot"], 2)[0] < 1e-4, `${n}: the crouch and the creep's stance are held low on still feet`);
    v3[n] = { sneak: s.speed, creep: k.speed }; }
  // on hands and knees: the knees and the hands down where they were put, nothing under the floor, the hips rising over each knee
  { const c = C.crawl_loop, kn = span(c, ["l_lowleg", "r_lowleg"]), wr = span(c, ["l_wrist", "r_wrist"]), tip = span(c, ["l_middle_null", "r_middle_null", "l_index_null", "r_index_null", "l_thumb_null", "r_thumb_null"]), hip = span(c, ["root"]), m = c.frames.length, q = Math.round(0.25 * m);
    ok(c.speed > 0.18 && c.speed < 0.75, `${n}: crawls at a crawl`, `${c.speed.toFixed(2)} m/s, a stride every ${c.secs.toFixed(2)} s`);
    ok(kn[0] > 0.03 && kn[0] < 0.09 && kn[1] < 0.14, `${n}: the knees on the floor, carried just over it`, `${cm(kn[0])} to ${cm(kn[1])} cm`);
    ok(slip(c, "l_lowleg", 0.07, 0.5) < 12 && slip(c, "r_wrist", 0.02, 0.5) < 12, `${n}: a knee and a hand that are down stay where they were put`, `${mm(slip(c, "l_lowleg", 0.07, 0.5))} and ${mm(slip(c, "r_wrist", 0.02, 0.5))} mm`);
    ok(wr[0] > 0.015 && tip[0] > -0.012 && span(c, ["l_foot", "r_foot", "l_ball", "r_ball"])[0] > 0.008, `${n}: no hand, finger or foot under the floor`, `wrists ${cm(wr[0])}, fingertips ${cm(tip[0])} cm`);
    ok(hip[1] - hip[0] > 0.012 && hip[1] - hip[0] < 0.07, `${n}: the hips rise over each knee`, `${cm(hip[1] - hip[0])} cm`);
    ok(at(c, q, "r_wrist")[1] < 0.045 && at(c, q, "l_wrist")[1] > 0.05, `${n}: the opposite hand is down with a knee, its own side's carried`, `${cm(at(c, q, "r_wrist")[1])} and ${cm(at(c, q, "l_wrist")[1])} cm`);
    const sd = Math.abs(at(c, 0, "root")[1] - at(c, 0, "r_uparm")[1]); ok(sd < 0.14, `${n}: the back about level`, `shoulders ${cm(sd)} cm from the hips' height`);
    const id = C.crawl_idle_loop; ok(span(id, ["l_lowleg"], 2)[1] - span(id, ["l_lowleg"], 2)[0] < 0.004 && span(id, ["l_wrist", "r_wrist"])[1] < 0.04, `${n}: stopped on all fours, knees and hands down`);
    v3[n].crawl = c.speed; }
  // the scuttle: on hands and feet, the knees off the floor, quick
  { const c = C.scuttle_loop, kn = span(c, ["l_lowleg", "r_lowleg"]), wr = span(c, ["l_wrist", "r_wrist"]), tip = span(c, ["l_middle_null", "r_middle_null", "l_index_null", "r_index_null"]);
    ok(c.speed > 1.8 * C.crawl_loop.speed && c.speed < 2.6 && c.secs < 0.9, `${n}: the scuttle is quick`, `${c.speed.toFixed(2)} m/s, a stride every ${c.secs.toFixed(2)} s`);
    ok(kn[0] > 0.05 && wr[0] > 0.015 && tip[0] > -0.01 && span(c, ["l_ball", "r_ball"])[0] > 0.008, `${n}: on its hands and the balls of its feet, the knees off the floor`, `knees ${cm(kn[0])} cm up at the least`);
    ok(slip(c, "l_ball", 0.06, 0.44) < 15 && slip(c, "r_wrist", 0.06, 0.42) < 15, `${n}: a foot and a hand that are down stay put`, `${mm(slip(c, "l_ball", 0.06, 0.44))} and ${mm(slip(c, "r_wrist", 0.06, 0.42))} mm`);
    ok(Math.max(...c.frames.map(f => Math.max(f.pose.info.armReach_l, f.pose.info.armReach_r))) < 0.985 && Math.abs(at(c, 0, "root")[1] - at(c, 0, "r_uparm")[1]) < 0.2, `${n}: no arm asked to be longer than it is, the back near level`); }
  // the peek: out past the wall's edge, a hand on it, and back
  { const o = C.peek_out, l = C.peek_loop, b = C.peek_back, e = o.meta.peek.edge, hd = at(l, 0, "c_head"), w = at(l, 0, "r_wrist");
    ok(apart(first(o), idle0) < 2 && apart(last(o), first(l)) < 6 && apart(first(b), first(l)) < 6 && apart(last(b), idle0) < 2, `${n}: the peek starts stood, ends as it's held, and comes back`, `${apart(last(o), first(l)).toFixed(1)} degrees from the hold`);
    ok(hd[0] < e[0] - 0.03 && Math.abs(at(o, 0, "c_head")[0]) < 0.05, `${n}: her head goes out past the wall's edge`, `${cm(e[0] - hd[0])} cm past it`);
    ok(Math.hypot(w[0] - e[0], w[2] - e[2]) < 0.14 && w[1] > 0.52 * H && w[1] < hd[1] - 0.2 * H / 1.63, `${n}: her hand on the wall's end, under her face`, `${cm(Math.hypot(w[0] - e[0], w[2] - e[2]))} cm from it, ${cm(w[1])} cm up, her head at ${cm(hd[1])}`);
    ok(ev(o, "out").length === 1 && ev(b, "hidden").length === 1 && C.peek_l_loop.meta.peek.edge[0] > 0 && at(C.peek_l_loop, 0, "c_head")[0] > -e[0] + 0.03 && C.peek_l_loop.meta.peek.side === "l", `${n}: its moments, and the same to her left`); }
  // the scares: coiled from the first frame, a peak, how long to show her, back to the idle
  for (const nm of ["scare_lunge", "scare_loom", "scare_snap", "scare_claw"]) { const c = C[nm], sc = c.meta.scare, from = nm === "scare_claw" ? first(C.crawl_idle_loop) : idle0;
    ok(sc.peak > 0.1 && sc.peak < 0.7 && sc.show > sc.peak + 0.3 && sc.show < c.secs - 0.5 && ev(c, "peak")[0] === c.events[0].t && ev(c, "over").length === 1, `${n} ${nm}: a peak within 0.7 s, shown for under ${c.secs.toFixed(1)}`, `peak ${sc.peak}, shown ${sc.show} s`);
    ok(apart(last(c), from) < 2 && (nm === "scare_claw" ? apart(first(c), from) < 22 : apart(first(c), idle0) > 15), `${n} ${nm}: starts ${nm === "scare_claw" ? "on all fours" : "already coiled"}, ends ${nm === "scare_claw" ? "as it kneels" : "in the idle's pose"}`, `${apart(first(c), idle0).toFixed(0)} degrees from the idle at its first frame`); }
  { const c = C.scare_lunge, pk = fr(c, c.meta.scare.peak), step = at(c, pk, "r_foot")[2] - at(c, 0, "r_foot")[2], hands = Math.min(at(c, pk, "l_wrist")[1], at(c, pk, "r_wrist")[1]);
    ok(c.meta.scare.reach > 0.5 && step > 0.25 && hands > 0.62 * H && at(c, 0, "r_wrist")[2] < 0.22, `${n}: the lunge: a step, both hands thrown out at your face`, `a ${cm(step)} cm step, the hands ${cm(c.meta.scare.reach)} cm out at ${cm(hands)} cm up`);
    const l = C.scare_loom, lp = fr(l, l.meta.scare.peak); ok(at(l, 0, "c_head")[1] < 0.78 * idleHead && at(l, lp, "c_head")[1] > idleHead - 0.05 && at(l, lp, "l_foot")[1] > ctx.body.ankleH + 0.02, `${n}: the loom: from bent double to upright on her toes`, `the head from ${cm(at(l, 0, "c_head")[1])} to ${cm(at(l, lp, "c_head")[1])} cm`);
    const sn = C.scare_snap, hp = f => sn.frames[f].c.head.pitch / DEG; ok(hp(0) > 30 && hp(fr(sn, sn.meta.scare.peak)) < 5 && sn.meta.scare.peak < 0.3, `${n}: the snap: the head up from hanging in a moment`, `${hp(0).toFixed(0)} to ${hp(fr(sn, sn.meta.scare.peak)).toFixed(0)} degrees`);
    const cl = C.scare_claw, cp = fr(cl, cl.meta.scare.peak); ok(at(cl, cp, "r_wrist")[1] > 0.3 && at(cl, cp, "l_wrist")[1] < 0.045 && span(cl, ["l_lowleg", "r_lowleg"])[1] < 0.09 && cl.meta.scare.from === "crawl", `${n}: the claw: a hand up from the floor, the other and both knees still down`, `${cm(at(cl, cp, "r_wrist")[1])} cm up`); }
  // the fights
  { const c = C.punch, m = c.meta.punch, h = fr(c, ev(c, "hit")[0]), k = V.mad(at(c, h, "r_wrist"), c.frames[h].pose.info.handDir_r, 0.5 * R.armR.handLen), sh = at(c, h, "r_uparm");
    ok(apart(first(c), idle0) < 2 && apart(last(c), idle0) < 2 && ev(c, "hit").length === 1, `${n}: the punch starts and ends in the idle's pose`);
    ok(V.dist(k, m.at) < 0.004 && m.reach > 0.8 * arm && Math.abs(m.at[1] - sh[1]) < 0.08 && c.frames[h].pose.info.armReach_r > 0.93, `${n}: the fist lands straight ahead at her shoulder's height, the arm out`, `${cm(m.reach)} cm ahead, ${cm(m.at[1])} cm up, the arm ${(c.frames[h].pose.info.armReach_r * 100).toFixed(0)}% out`);
    const g = fr(c, 0.3 * c.secs / 1.55); ok(at(c, g, "l_wrist")[1] > sh[1] - 0.14 && at(c, h, "l_wrist")[1] > sh[1] - 0.14, `${n}: the other fist kept up`);
    const s = C.swing, sm_ = s.meta.swing, sf = fr(s, ev(s, "hit")[0]), wound = span(s, ["r_wrist"])[1];
    ok(apart(first(s), idle0) < 2 && apart(last(s), idle0) < 2 && Math.abs(V.len(sm_.axis) - 1) < 0.01 && sm_.axis[1] > -0.2 && sm_.axis[1] < 0.6 && sm_.axis[2] > 0.6 && wound > at(s, 0, "r_uparm")[1] + 0.1 && at(s, sf, "r_wrist")[2] > 0.25 && at(s, sf, "r_wrist")[1] < wound - 0.2, `${n}: the swing: the hand up over the shoulder, down through what's in front, what it holds pointing up and ahead as it lands`, `from ${cm(wound)} cm up to ${cm(at(s, sf, "r_wrist")[1])} cm, ${cm(at(s, sf, "r_wrist")[2])} cm ahead; the fist's axis ${sm_.axis.join(", ")}`);
    { const heldAt = f => { const I = s.frames[f].pose.info; return V.norm(V.cross(I.handDir_r, I.palm_r)); }, wf = fr(s, 0.5 * s.secs / 2.0), up = heldAt(wf), land = heldAt(sf), tw = t => { let most = 0; const tr = s.tracks.find(x => R.J[x.joint].name === t); for (let k = 1; k < s.keys; k++) most = Math.max(most, quatAngle(tr.r, tr.r, (k - 1) * 4, k * 4)); return most / DEG; };
      ok(up[2] < -0.5 && land[2] > 0.6 && land[1] < 0.6 && tw("r_lowarm_twist3_proc") < 40 && tw("r_wrist") < 56, `${n}: what the fist holds is back over her shoulder wound up and ahead as it lands, by the wrist and never by a forearm turned past its range`,
        `wound up it points ${up.map(v => v.toFixed(2)).join(", ")}, landing ${land.map(v => v.toFixed(2)).join(", ")} (${(Math.asin(land[1]) / DEG).toFixed(0)} degrees up); the forearm's twist ${tw("r_lowarm_twist3_proc").toFixed(0)} degrees a frame at the most`); }
    const hr = C.hit_react; ok(apart(first(hr), idle0) < 2 && apart(last(hr), idle0) < 2 && Math.min(...hr.frames.map(f => f.c.chest.pitch)) < -10 * DEG && span(hr, ["r_foot"], 2)[0] < at(hr, 0, "r_foot")[2] - 0.12, `${n}: hit: thrown back, a step to catch it, upright again`);
    ok(C.punch_l.meta.punch.hand === "l" && Math.abs(C.punch_l.meta.punch.at[0] + m.at[0]) < 1e-6 && C.swing_l.meta.swing.hand === "l" && Math.abs(C.swing_l.meta.swing.axis[0] + sm_.axis[0]) < 1e-6, `${n}: the left hand's are the right's in a mirror`); }
  // eating and drinking, looking round, a knock, cowering
  { const e = C.eat, d = C.drink, b = fr(e, ev(e, "bite")[0]), sp = fr(d, ev(d, "sip")[0] + 0.4), M = e.meta.eat.mouth, gap = V.dist(at(e, b, "r_wrist"), M), gapD = V.dist(at(d, sp, "r_wrist"), d.meta.eat.mouth);
    ok(ev(e, "bite").length === 2 && ev(d, "sip").length === 1 && ev(e, "done").length === 1 && apart(first(e), idle0) < 2 && apart(last(e), idle0) < 2 && apart(last(d), idle0) < 2, `${n}: eating: two bites; drinking: a sip; each from the idle and back to it`);
    ok(gap < 0.19 && gap > 0.07 && gapD < 0.26 && gapD > gap && at(e, b, "r_wrist")[1] < M[1] && Math.abs(M[1] - 0.885 * H) < 0.05, `${n}: the hand comes up under her mouth, and further out in front of it to drink (what it holds tipped toward her)`, `the wrist ${cm(gap)} cm from her lips eating, ${cm(gapD)} drinking`);
    ok(d.frames[sp].c.head.pitch < d.frames[0].c.head.pitch - 8 * DEG, `${n}: her head goes back to drink`);
    const la = C.look_around, yaw = f => { const D = la.frames[f].solved.D[R.head], v = Q.rot(D, [0, 0, 1]); return Math.atan2(v[0], v[2]) / DEG; }, ys = la.frames.map((_, f) => yaw(f));
    ok(Math.max(...ys) > 45 && Math.min(...ys) < -45 && apart(last(la), idle0) < 2, `${n}: looks round to both sides and back`, `${Math.max(...ys).toFixed(0)} and ${Math.min(...ys).toFixed(0)} degrees`);
    const kn = C.knock, raps = ev(kn, "knock"), kAt = f => V.mad(at(kn, f, "r_wrist"), kn.frames[f].pose.info.handDir_r, 0.5 * R.armR.handLen), off = raps.map(t => V.dist(kAt(fr(kn, t)), kn.meta.knock.at)), between = kn.meta.knock.at[2] - kAt(fr(kn, (raps[0] + raps[1]) / 2))[2];
    ok(raps.length === 3 && Math.max(...off) < 0.02 && between > 0.02 && apart(last(kn), idle0) < 2, `${n}: three raps on the same spot, the fist drawn back between`, `${mm(Math.max(...off) * 1000)} mm off at the most, ${cm(between)} cm back`);
    const cw = C.cower_loop; ok(span(cw, ["root"])[1] < idleHip - 0.12 && span(cw, ["l_wrist", "r_wrist"])[0] > at(cw, 0, "r_uparm")[1] && span(cw, ["l_foot"], 2)[1] - span(cw, ["l_foot"], 2)[0] < 1e-4, `${n}: cowering: low, the arms up over the head`); }
}
{ const f = (set, only) => all(W, { ...settingsFor(W.glb, W.body, {}), ...set }, only);
  const strong = f({ strength: 1 }, ["sneak", "crawl"]), weak = f({ strength: 0 }, ["sneak", "crawl"]), heavy = f({ weight: 1 }, ["crawl", "scare"]), light = f({ weight: -1 }, ["crawl", "scare"]);
  ok(strong.sneak_loop.speed > weak.sneak_loop.speed + 0.04 && strong.crawl_loop.speed > weak.crawl_loop.speed + 0.04, "strength: a strong body sneaks and crawls quicker", `${strong.sneak_loop.speed.toFixed(2)} and ${weak.sneak_loop.speed.toFixed(2)} m/s; ${strong.crawl_loop.speed.toFixed(2)} and ${weak.crawl_loop.speed.toFixed(2)} m/s`);
  ok(heavy.crawl_loop.speed < light.crawl_loop.speed - 0.04 && heavy.scare_lunge.meta.scare.peak > light.scare_lunge.meta.scare.peak, "weight: a heavy one crawls slower and lunges later", `${heavy.crawl_loop.speed.toFixed(2)} and ${light.crawl_loop.speed.toFixed(2)} m/s; ${heavy.scare_lunge.meta.scare.peak} and ${light.scare_lunge.meta.scare.peak} s`);
  say(`v3: ${Object.entries(v3).map(([n, o]) => `${n} sneaks ${o.sneak.toFixed(2)}, creeps ${o.creep.toFixed(2)}, crawls ${o.crawl.toFixed(2)} m/s`).join("; ")}`); }

// ---- 6c. creatures (DECISIONS 2026-11-14: "animations for creatures (our monsters)"; docs/ANIMATOR_V3.md §8.4) -----------------
// The clips are made from the body, and a creature's body is not a person's: a goblin's arms are long for its legs, a
// ghoul's and a hag's backs hunched, an ogre's hands twice a person's for its height, an imp knee high. What was built
// on three people is held on five creatures here: the Studio's own creature cards, made in node as the page makes them.
{
  const twistOf = (R, F, s) => { const A = R.arm(s), D = F.pose.D; return [Q.twist(Q.mul(Q.conj(D[A.clav]), D[A.up]), A.du0) / DEG, Q.twist(Q.mul(Q.conj(D[A.low]), D[A.wtw]), A.df0) / DEG]; };
  const tipsOf = R => { const out = []; for (const s of ["l", "r"]) for (const chain of R.arm(s).fingers) for (const j of chain) { out.push(j); for (const k of R.J[j].kids) out.push(k); } return out; };
  // MHR's own elbow: the constant is the axis its two bases' elbows are bent about at rest
  for (const base of ["feminine", "masculine"]) { const R = prepare(parseGlb(bodyGlb(testBody(base))), { mhrRig: MHR }).rig, A = R.armR, own = V.norm(V.cross(A.du0, A.df0)), off = Math.acos(clamp1(V.dot(own, A.h0))) / DEG, offL = Math.acos(clamp1(V.dot(V.norm(V.cross(R.armL.du0, R.armL.df0)), R.armL.h0))) / DEG;
    ok(off < 2.5 && offL < 2.5 && A.bend0 > 30 * DEG && Math.abs(V.len(ELBOW.h) - 1) < 2e-3 && Math.abs(V.dot(ELBOW.h, V.norm(ELBOW.du))) < 2e-3, `MHR's ${base} base: the elbow's hinge is the axis its own elbow is bent about, on both arms`, `${off.toFixed(1)} and ${offL.toFixed(1)} degrees off, the elbow bent ${(A.bend0 / DEG).toFixed(0)} at rest`); }
  // on people: the idle's arms as they were (the upper arm's skin 31 to 34 degrees round against the collarbone, the forearm's under 12), and a thing on the floor is reached
  for (const [n, ctx] of Object.entries(ctxs)) { const [tu, tf] = twistOf(ctx.rig, clips[n].idle_loop.frames[0], "r"), c = clips[n].reach_low, g = Math.round(c.events.find(e => e.name === "grab").t * c.fps), P = c.frames[g].solved.P, w = ctx.rig.armR.hand, a = c.frames[g].c.arms.r.hand, d = Math.hypot(P[w * 3] - a[0], P[w * 3 + 1] - a[1], P[w * 3 + 2] - a[2]);
    let low = 1e9; for (const F of c.frames) for (const j of tipsOf(ctx.rig)) low = Math.min(low, F.solved.P[j * 3 + 1]);
    ok(Math.abs(tu) < 45 && Math.abs(tf) < 25, `${n}: standing, no arm is wrung along its length`, `the upper arm ${tu.toFixed(0)}, the forearm ${tf.toFixed(0)} degrees`);
    ok(d < 0.015 && low > -0.012 && c.meta.reach.wrist[1] > c.meta.reach.at[1], `${n}: taking something from the floor, the hand gets to where it's asked and its fingers stay off the floor`, `${(d * 100).toFixed(1)} cm off, the lowest fingertip ${(low * 100).toFixed(1)} cm`); }
  const HELD = ["idle_loop", "walk_loop", "run_loop", "reach_low", "reach_mid", "reach_high", "reach_low_l", "reach_mid_l", "reach_high_l", ...V3], NOREACH = /^reach_/, says = [];
  for (const n of CREATURE_BODIES) {
    const ctx = prepare(parseGlb(bodyGlb(testBody(n))), { mhrRig: MHR }), R = ctx.rig, b = ctx.body, set = settingsFor(ctx.glb, b, {}), C = all(ctx, set), tips = tipsOf(R), sc = b.height / 1.63, arm = b.upper + b.fore;
    const at = (c, f, nm) => { const P = c.frames[f].solved.P, j = R.ix.get(nm); return [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]]; };
    ok(NAMES.every(c => C[c]) && Object.keys(C).length === NAMES.length && ctx.rig.unturned && Math.abs(b.height - testBody(n).def.height) < 0.01, `${n}: a creature's body measured, every clip made`, `${(b.height * 100).toFixed(0)} cm, ${b.mass.toFixed(0)} kg, arms ${(arm * 100).toFixed(0)} cm, legs ${(b.leg * 100).toFixed(0)} cm`);
    // the elbow: MHR's own hinge whatever the rest pose's bend has become, and no arm wrung along its length standing
    const A = R.armR, bend = A.bend0 / DEG, [tu, tf] = twistOf(R, C.idle_loop.frames[0], "r"), [tul, tfl] = twistOf(R, C.idle_loop.frames[0], "l");
    ok(Math.acos(clamp1(V.dot(A.h0, V.norm(V.perp(ELBOW.h, A.du0))))) / DEG < 3 && Math.abs(tu) < 50 && Math.abs(tf) < 50 && Math.abs(tu + tul) < 2 && Math.abs(tf + tfl) < 3, `${n}: the elbow's hinge is MHR's own though its elbow is bent only ${bend.toFixed(0)} degrees at rest; standing, no arm is wrung`, `the upper arm ${tu.toFixed(0)}, the forearm ${tf.toFixed(0)} degrees`);
    let jump = 0, where = "", nan = 0, wrap = 0, asked = 0, askedWhere = "", lowTip = 1e9, tipWhere = "", lowFoot = 1e9, lowWrist = 1e9, lowHead = 1e9;
    for (const name of HELD) { const c = C[name], lim = FAST.test(name) ? 56 : 34;
      for (const t of c.tracks) { const nm = R.J[t.joint].name; if (!t.r || /^soft_/.test(nm)) continue;
        for (let k = 0; k < c.keys; k++) { for (let q = 0; q < 4; q++) if (!Number.isFinite(t.r[k * 4 + q])) nan++; if (!k) continue; const a = quatAngle(t.r, t.r, (k - 1) * 4, k * 4) / DEG / (/_ball$/.test(nm) ? 56 / 34 : 1) * (34 / lim); if (a > jump) { jump = a; where = `${name} ${nm} key ${k}`; } }
        if (c.loop) wrap = Math.max(wrap, quatAngle(t.r, t.r, 0, (c.keys - 1) * 4) / DEG); }
      for (let f = 0; f < c.frames.length; f++) { const I = c.frames[f].pose.info, P = c.frames[f].solved.P;
        if (!NOREACH.test(name)) { const a = Math.max(I.armReach_l || 0, I.armReach_r || 0); if (a > asked) { asked = a; askedWhere = name; } }
        for (const j of tips) if (P[j * 3 + 1] < lowTip) { lowTip = P[j * 3 + 1]; tipWhere = name; }
        for (const nm of ["l_foot", "r_foot", "l_ball", "r_ball"]) lowFoot = Math.min(lowFoot, P[R.ix.get(nm) * 3 + 1]);
        for (const nm of ["l_wrist", "r_wrist"]) lowWrist = Math.min(lowWrist, P[R.ix.get(nm) * 3 + 1]);
        lowHead = Math.min(lowHead, P[R.head * 3 + 1]); } }
    // (a toe follows its foot's heel as it leaves the floor: on a knee-high imp's 0.47 s stride that is 38 degrees in a frame, and it's given a blow's limit)
    ok(nan === 0 && jump < 34 && wrap < 0.2, `${n}: in the new clips, the walk, the run and the reaches no bone turns faster than it may (34 degrees a frame; a blow's, a scare's and a toe's 56), every loop closes`, `${jump.toFixed(1)} of 34 (${where})`);
    ok(asked < 0.999, `${n}: no arm is asked for more than its length (but in a reach on its way down, by design)`, `${asked.toFixed(3)} (${askedWhere})`);
    ok(lowTip > -0.012 && lowFoot > 0.004 && lowWrist > 0.01 && lowHead > 0.05, `${n}: nothing under the floor: no fingertip, foot, wrist or head`, `the lowest fingertip ${(lowTip * 100).toFixed(1)} cm (${tipWhere}), foot ${(lowFoot * 100).toFixed(1)}, wrist ${(lowWrist * 100).toFixed(1)}`);
    // the low gaits at their own paces, the planted contacts still
    const slip = (c, nm, a0, b0) => { let z0 = null, x0 = 0, worst = 0; const m = c.frames.length; for (let f = 0; f < m; f++) { const phi = f / m; if (phi < a0 || phi > b0) continue; const q = at(c, f, nm), z = q[2] + c.speed * c.secs * phi; if (z0 == null) { z0 = z; x0 = q[0]; } worst = Math.max(worst, Math.hypot(z - z0, q[0] - x0)); } return worst; };
    const pace = { walk: C.walk_loop.speed, sneak: C.sneak_loop.speed, creep: C.creep_loop.speed, crawl: C.crawl_loop.speed, scuttle: C.scuttle_loop.speed };
    ok(pace.sneak < 0.62 * pace.walk && pace.creep < 0.8 * pace.walk && pace.crawl < 0.5 * pace.walk && pace.scuttle > 1.8 * pace.crawl, `${n}: sneaks, creeps and crawls slower than it walks, scuttles quicker than it crawls`, `walk ${pace.walk.toFixed(2)}, sneak ${pace.sneak.toFixed(2)}, creep ${pace.creep.toFixed(2)}, crawl ${pace.crawl.toFixed(2)}, scuttle ${pace.scuttle.toFixed(2)} m/s`);
    const slips = [slip(C.sneak_loop, "l_foot", 0.17, 0.44), slip(C.creep_loop, "l_foot", 0.17, 0.42), slip(C.crawl_loop, "l_lowleg", 0.07, 0.5), slip(C.crawl_loop, "r_wrist", 0.02, 0.5), slip(C.scuttle_loop, "l_ball", 0.06, 0.44), slip(C.scuttle_loop, "r_wrist", 0.06, 0.42)];
    ok(Math.max(...slips) < 0.015 * Math.max(1, sc), `${n}: a foot, a knee and a hand that are down stay where they were put`, slips.map(v => (v * 1000).toFixed(0)).join(", ") + " mm");
    // the peek: the wall clear of its face and its front, its head out past the wall's end, its hand on it, the arm not folded flat
    { const o = C.peek_out, l = C.peek_loop, e = o.meta.peek.edge, P0 = C.idle_loop.frames[0].solved.P, face = P0[R.head * 3 + 2] + (b.headC[2] + b.headR[2] - R.J[R.head].at[2]), front = Math.max(face, ...b.slabs.map(s => s.zf)), hd = at(l, 0, "c_head"), w = at(l, 0, "r_wrist"), reach = l.frames[0].pose.info.armReach_r;
      let least = 9; for (const c of [o, l, C.peek_back]) for (const F of c.frames) if ((F.c.arms.r.hand || 0) && F.pose.info.armReach_r < least) least = F.pose.info.armReach_r;
      ok(e[2] > front + 0.01 && hd[0] < e[0] - 0.03 * sc && Math.hypot(w[0] - e[0], w[2] - e[2]) < 0.16 * Math.max(1, R.armR.handLen / 0.175) && reach > 0.4 && least > 0.34, `${n}: peeking, the wall stands clear of its front, its head goes out past the wall's end, its hand is on it and its arm never folded flat`,
        `the wall ${((e[2] - front) * 100).toFixed(0)} cm past its front (${(front * 100).toFixed(0)} cm ahead of its feet), the head ${((e[0] - hd[0]) * 100).toFixed(0)} cm out, the arm at ${reach.toFixed(2)} of its length held and ${least.toFixed(2)} at the least`); }
    // the scares, the blows, the mouth, on its own sizes
    { const sc0 = C.scare_lunge.meta.scare, cl = C.scare_claw, cp = Math.min(cl.frames.length - 1, Math.round(cl.meta.scare.peak * cl.fps)), pm = C.punch.meta.punch, h = Math.round(C.punch.events.find(e => e.name === "hit").t * C.punch.fps), k = V.mad(at(C.punch, h, "r_wrist"), C.punch.frames[h].pose.info.handDir_r, 0.5 * R.armR.handLen);
      ok(sc0.peak > 0.1 && sc0.peak < 0.75 && sc0.show > sc0.peak + 0.3 && sc0.reach > 0.5 * arm && at(cl, cp, "r_wrist")[1] > 0.3 * sc && at(cl, cp, "l_wrist")[1] < 0.05 * Math.max(1, R.armL.handLen / 0.175) + 0.03, `${n}: its lunge has a peak and a reach, its claw a hand up with the other still down`, `the lunge ${(sc0.reach * 100).toFixed(0)} cm out at ${sc0.peak} s`);
      ok(V.dist(k, pm.at) < 0.006 && pm.reach > 0.75 * arm && Math.abs(V.len(C.swing.meta.swing.axis) - 1) < 0.01 && C.swing.meta.swing.axis[2] > 0.55 && C.swing.meta.swing.axis[1] < 0.78, `${n}: its punch lands where its record says, what it swings points ahead as it lands (no more than 50 degrees up)`, `${(pm.reach * 100).toFixed(0)} cm ahead at ${(pm.at[1] * 100).toFixed(0)} cm up`);
      const e = C.eat, bt = Math.round(e.events.find(x => x.name === "bite").t * e.fps), M = e.meta.eat.mouth, gap = V.dist(at(e, bt, "r_wrist"), M), hand = R.armR.handLen, cw = C.cower_loop, hy = at(cw, 0, "c_head");
      ok(gap > 0.35 * hand && gap < 1.25 * hand && at(e, bt, "r_wrist")[1] < M[1], `${n}: eating, its fist comes up under its mouth by its own hand's size`, `the wrist ${(gap * 100).toFixed(0)} cm from its lips, a hand of ${(hand * 100).toFixed(0)} cm`);
      // (where a wrist is in the head's own box, 1 its surface: a goblin's head and ears are nearly twice a person's for its height)
      const hq = cw.frames[0].pose.D[R.head], hc = V.add(hy, Q.rot(hq, V.sub(b.headC, R.J[R.head].at))), inHead = w => { const v = Q.rot(Q.conj(hq), V.sub(w, hc)); return Math.hypot(v[0] / b.headR[0], v[1] / b.headR[1], v[2] / b.headR[2]); };
      const out = Math.min(inHead(at(cw, 0, "l_wrist")), inHead(at(cw, 0, "r_wrist")));
      ok(Math.min(at(cw, 0, "l_wrist")[1], at(cw, 0, "r_wrist")[1]) > at(cw, 0, "r_uparm")[1] && out > 1.25 && out < 2.2, `${n}: cowering, its hands are up in front of its head and clear of it, by its head's own size`, `${out.toFixed(2)} of the way out from its middle to its surface`); }
    // taking something: the hand gets there, low and from a table
    { const far = lvl => { const c = C["reach_" + lvl], g = Math.round(c.events.find(e => e.name === "grab").t * c.fps), P = c.frames[g].solved.P, w = R.armR.hand, a = c.frames[g].c.arms.r.hand; return Math.hypot(P[w * 3] - a[0], P[w * 3 + 1] - a[1], P[w * 3 + 2] - a[2]); };
      ok(far("low") < 0.015 && far("mid") < 0.015 && far("high") < 0.015, `${n}: a thing on the floor, on a table and on a shelf is reached`, `${(far("low") * 100).toFixed(1)}, ${(far("mid") * 100).toFixed(1)} and ${(far("high") * 100).toFixed(1)} cm off`); }
    says.push(`${n} ${(b.height * 100).toFixed(0)} cm: walks ${pace.walk.toFixed(2)}, creeps ${pace.creep.toFixed(2)}, crawls ${pace.crawl.toFixed(2)}, scuttles ${pace.scuttle.toFixed(2)} m/s`);
  }
  say("creatures: " + says.join("; "));
}

// ---- 7. the bake --------------------------------------------------------------------------------------------------------------
{
  const src = parseGlb(bytes.normal_woman), j0 = src.json, skinNode = j0.nodes.findIndex(n => /_skin$/.test(n.name || "")), pr0 = j0.meshes[j0.nodes[skinNode].mesh].primitives[0];
  // a face shape on the skin, as an export for Godot has: the bake must leave it be
  pr0.targets = [{ POSITION: src.addAccessor(new Float32Array(src.read(pr0.attributes.POSITION).length), "VEC3", { minmax: true }) }]; j0.meshes[j0.nodes[skinNode].mesh].weights = [0.25]; j0.meshes[j0.nodes[skinNode].mesh].extras = { targetNames: ["jawDrop"] };
  const withFace = src.write(), g = parseGlb(withFace), w0 = g.read(pr0.attributes.WEIGHTS_0).slice(), nodes0 = g.json.nodes.length, r = animate(g, { mhrRig: MHR }), out = g.write(), back = parseGlb(out), j = back.json;
  ok(baked(back) && (j.animations || []).length === NAMES.length, "baked: every clip in the file", (j.animations || []).length);
  const joints = new Set(j.skins[0].joints); let notJoint = 0, morph = 0, face = 0, nan = 0;
  for (const a of j.animations) for (const ch of a.channels) { if (!joints.has(ch.target.node)) notJoint++; if (ch.target.path === "weights") morph++; if (!isBodyBone(j.nodes[ch.target.node].name)) face++;
    const d = back.read(a.samplers[ch.sampler].output); for (let i = 0; i < d.length; i += 97) if (!Number.isFinite(d[i])) nan++; }
  ok(notJoint === 0 && morph === 0 && face === 0 && nan === 0, "baked: only the body's bones are animated: no morph target, no eye, jaw or spring bone", `${notJoint} ${morph} ${face} ${nan}`);
  const m = j.meshes[j.nodes[skinNode].mesh]; ok(m.primitives[0].targets.length === 1 && m.weights[0] === 0.25 && m.extras.targetNames[0] === "jawDrop", "baked: the skin's face shape and its weight as they were");
  ok(j.nodes.every(n => !(n.matrix && joints.has(j.nodes.indexOf(n)))) && j.skins.every(s => s.joints.length === j.skins[0].joints.length), "baked: the bones carry translations (glTF allows no matrix on an animated node), every skin the same bones");
  const rec = record(back), pub = j.nodes[skinNode].extras.hsMotion; ok(rec && rec.clips.walk_loop.speed > 1 && rec.clips.sit_down.seat && rec.clips.open_push.door && rec.clips.reach_low.reach && rec.palm && pub && pub.clips && !pub.undo, "baked: its record (speeds, events, where a seat, a handle and a reach are) in the scene and on the skin's node");
  ok(rec.version === 3 && pub.soft.length === 9 && pub.soft.every(b => b.axis.length === 3 && Math.abs(Math.hypot(...b.axis) - 1) < 1e-3 && b.length > 0.04 && b.stiffness > 0.1 && b.damping >= 0 && b.gain > 0 && b.limit > 0) && pub.settings.bounce === 0.5,
    "baked: each soft bone's rod and JiggleBones' numbers for it in the record, for whoever swings it live", pub.soft.filter(b => /_l$|belly/.test(b.bone)).map(b => `${b.bone.replace("soft_", "")} ${b.stiffness.toFixed(2)}/${b.damping.toFixed(1)}`).join(", "));
  ok(pub.clips.crawl_loop.speed > 0.1 && pub.clips.scuttle_loop.speed > pub.clips.crawl_loop.speed && pub.clips.scare_lunge.scare.peak > 0 && pub.clips.scare_lunge.scare.show > pub.clips.scare_lunge.scare.peak && pub.clips.punch.punch.at.length === 3
    && pub.clips.swing.swing.axis.length === 3 && pub.clips.peek_out.peek.edge.length === 3 && pub.clips.eat.eat.mouth.length === 3 && pub.clips.knock.knock.at.length === 3 && pub.clips.punch_l.punch.hand === "l",
    "baked: animations v3's record: the low gaits' speeds, a scare's peak and how long to show her, where a punch lands, a swing's axis, a wall's edge, her mouth, a knock's spot");
  const again = parseGlb(out); animate(again, { mhrRig: MHR, settings: { strength: 0.9 } }); const out2 = again.write();
  ok(Math.abs(out2.length - out.length) < 0.04 * out.length && record(parseGlb(out2)).settings.strength === 0.9 && record(parseGlb(out2)).settings.style === rec.settings.style, "baked again with another slider: no bigger but for what the slider does to its clips' lengths, the new setting, the others kept", `${out.length} and ${out2.length} bytes`);
  const same = parseGlb(withFace); animate(same, { mhrRig: MHR }); const o3 = same.write(); let diff = o3.length !== out.length; for (let i = 0; !diff && i < out.length; i++) if (o3[i] !== out[i]) diff = true;
  ok(!diff, "baked twice from the same file: the same bytes");
  const un = parseGlb(out2); unbake(un); const w1 = un.read(un.json.meshes[un.json.nodes[skinNode].mesh].primitives[0].attributes.WEIGHTS_0); let wd = 0; for (let i = 0; i < w0.length; i++) wd = Math.max(wd, Math.abs(w0[i] - w1[i]));
  ok(!baked(un) && un.json.nodes.length === nodes0 && !(un.json.animations || []).length && wd === 0 && Math.abs(un.write().length - withFace.length) < 0.01 * withFace.length, "unbaked: no clips, no soft bones, the skin's own weights back to the last bit, the file its old size", `${un.write().length} and ${withFace.length} bytes`);
  const pv = parseGlb(bytes.normal_woman); animate(pv, { mhrRig: MHR, rigOnly: true }); const at = attach(parseGlb(pv.write()), { mhrRig: MHR });
  ok(at.plan.length === W.plan.length && Math.abs(at.body.mass - W.body.mass) < 0.01 && at.plan.every(b => b.j >= 0), "the page's preview (soft bones, no clips) read back: the same body, the same soft bones");
  say(`baked: ${(out.length / 1e6).toFixed(1)} MB from ${(withFace.length / 1e6).toFixed(1)} MB, ${NAMES.length} clips, ${r.plan.length} soft bones`);
}

for (const e of errs) console.log("ERROR: " + e);
console.log(errs.length ? `ANIMATOR FAILED (${errs.length})` : `ANIMATOR ok (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(errs.length ? 1 : 0);

// Animator v2: everything in order (docs/ANIMATOR_V2.md §1): a character's .glb read, its body measured, its clips
// made from the body and the sliders, and baked into the file. One function for the command line, the page's server
// and the checks.
import { readRig } from "./rig.js";
import { measure, recipeBody, recipeCharacter, meshPoints, readMhrRig, summary } from "./measure.js";
import { gait, params } from "./gait.js";
import { idle, sitting, sleeping, opening, reaching, mirrored } from "./acts.js";
import { prowl, lowStance } from "./stealth.js";
import { crawl, crawlIdle, scuttle } from "./quad.js";
import { peeking, mouthing, lookAround, knocking, cowering } from "./acting.js";
import { scares } from "./scare.js";
import { fighting } from "./fight.js";
import { poses, tracksOf } from "./clips.js";
import { unbake, writeClips, record } from "./bake.js";
import { proxies, clearance, worstArm } from "./clear.js";
import { softRig, softMotion, softPlan, softUse } from "./soft.js";

export const VERSION = 3;                                     // (3: animations v3's clips, docs/ANIMATOR_V3.md; 2: the soft bones are jiggle bones, each at its flesh's root; 1: springs at its middle)
export const DEFAULTS = { style: null, strength: 0.5, weight: 0, soft: 1, bounce: 0.5 };

/** the settings a character starts from: the walk's style from the body itself (the recipe's base, or its shape) */
export function settingsFor(glb, body, given = {}) {
  const ch = recipeCharacter(glb), auto = ch && typeof ch.base === "number" ? -0.6 * ch.base : 0.6 * body.femme;
  const s = { ...DEFAULTS, ...given }; if (s.style == null) s.style = Math.round(auto * 100) / 100;
  return s;
}

/** a character got ready to animate: the file unbaked if it was baked, read, measured, its soft bones put in.
    -> { glb, rig, body, X (the body's solid shapes), plan (its soft bones), undo } */
export function prepare(glb, { mhrRig = null } = {}) {
  unbake(glb);
  const rig = readRig(glb), pts = recipeBody(glb, rig, mhrRig ? readMhrRig(mhrRig) : null) || meshPoints(glb, rig), body = measure(rig, pts), undo = {};
  const cover = body.from === "recipe" ? measure(rig, meshPoints(glb, rig)) : null, X = proxies(rig, body, { cover });
  return { glb, rig, body, X, plan: softRig(glb, rig, body, undo), undo };
}
/** the same for a file that has its soft bones already (the page's preview, a baked file): nothing in it changed */
export function attach(glb, { mhrRig = null } = {}) {
  const rig = readRig(glb); for (const b of rig.J) if (/^soft_/.test(b.name)) b.soft = true;
  const pts = recipeBody(glb, rig, mhrRig ? readMhrRig(mhrRig) : null) || meshPoints(glb, rig), body = measure(rig, pts), X = proxies(rig, body, {});
  const plan = softPlan(rig, body).filter(b => rig.ix.has(b.name)); plan.forEach(b => { b.j = rig.ix.get(b.name); });
  return { glb, rig, body, X, plan, undo: null };
}

/** the clips of a studied character, as makers (each { name, loop, n, fps, ctrl(frame), events, meta }). `only`:
    kinds to make (KINDS); the acts with one hand or one side also made mirrored (`_l`: the left hand, to her left;
    the head to her right) */
export const KINDS = ["idle", "walk", "run", "sit", "sleep", "open", "reach", "sneak", "crawl", "creature", "peek", "scare", "fight", "eat", "acting"];
export function makers(rig, body, set, only = null, X = null) {
  const list = [], want = n => !only || only.includes(n);
  if (want("idle")) list.push(idle(rig, body, set, X));
  if (want("walk")) { const g = gait(rig, body, set, "walk"); list.push({ ...g, name: "walk_loop", meta: { stride: +g.stride.toFixed(3) } }); }
  if (want("run")) { const g = gait(rig, body, set, "run"); list.push({ ...g, name: "run_loop", meta: { stride: +g.stride.toFixed(3) } }); }
  if (want("sit")) list.push(...sitting(rig, body, set, X));
  if (want("sleep")) { const s = sleeping(rig, body, set, X); list.push(...s, ...s.map(c => mirrored(c, c.name.replace(/(_loop)?$/, m => "_r" + m)))); }
  if (want("open")) { const o = opening(rig, body, set, X); list.push(...o, ...o.map(c => mirrored(c, c.name + "_l"))); }
  if (want("reach")) { const r = reaching(rig, body, set, X); list.push(...r, ...r.map(c => mirrored(c, c.name + "_l"))); }
  // animations v3 (docs/ANIMATOR_V3.md §2)
  const gaitOf = g => ({ ...g, meta: { stride: +g.stride.toFixed(3) } });
  if (want("sneak")) list.push(gaitOf(prowl(rig, body, set, "sneak")), lowStance(rig, body, set, "sneak"));
  if (want("crawl")) list.push(gaitOf(crawl(rig, body, set)), crawlIdle(rig, body, set));
  if (want("creature")) list.push(gaitOf(prowl(rig, body, set, "creep")), lowStance(rig, body, set, "creep"), gaitOf(scuttle(rig, body, set)));
  const both = (clips, tag = "_l") => [...clips, ...clips.map(c => mirrored(c, c.name.replace(/(_loop)?$/, m => tag + m)))];   // (the other hand's, the other side's)
  if (want("peek")) list.push(...both(peeking(rig, body, set, X)));
  if (want("scare")) list.push(...scares(rig, body, set, X));
  if (want("fight")) { const f = fighting(rig, body, set, X); list.push(...f, ...f.filter(c => c.name !== "hit_react").map(c => mirrored(c, c.name + "_l"))); }
  if (want("eat")) list.push(...both(mouthing(rig, body, set, X)));
  if (want("acting")) list.push(...lookAround(rig, body, set, X), ...knocking(rig, body, set, X), ...cowering(rig, body, set, X));
  return list;
}

/** one clip made for a studied character: its poses with the arms kept clear and the soft tissue moving, as tracks.
    -> { tracks (clips.js tracksOf), frames, stats } */
export function makeClip(rig, body, X, plan, maker, set) {
  const stats = {}, frames = poses(rig, maker, clearance(rig, X, maker, stats));
  stats.armInside = +(Math.max(0, worstArm(rig, X, frames)) * 1000).toFixed(1);
  if (plan && plan.length) stats.soft = softMotion(rig, body, plan, maker, frames, set);
  let reach = 0; for (const f of frames) reach = Math.max(reach, f.pose.info.reach_l || 0, f.pose.info.reach_r || 0); stats.reach = +reach.toFixed(4);
  return { tracks: tracksOf(rig, maker, frames), frames, stats };
}

/** read, measure, make and bake: glb is changed in place. rigOnly: the soft bones and no clips (the page's preview).
    -> { rig, body, clips, plan, report } */
export function animate(glb, { settings = {}, mhrRig = null, only = null, rigOnly = false } = {}) {
  const last = record(glb)?.settings || {}, ctx = prepare(glb, { mhrRig }), { rig, body, X, plan, undo } = ctx, set = settingsFor(glb, body, { ...last, ...settings });
  const clips = [], stats = {};
  if (!rigOnly) for (const m of makers(rig, body, set, only, X)) { const c = makeClip(rig, body, X, plan, m, set); clips.push(c.tracks); stats[m.name] = c.stats; }
  const palm = s => { const A = rig.arm(s); return [0, 1, 2].map(k => +(A.handDir[k] * 0.085 * (A.handLen / 0.17) + A.palm0[k] * 0.022).toFixed(4)); };   // where a held thing sits in a hand, from the wrist's bone
  const rec = { version: VERSION, tool: "HorrorStudio Animator v2", settings: set, body: summary(body), soft: plan.map(b => { const u = softUse(b, set), r4 = v => +v.toFixed(4);    // each soft bone as a jiggle bone, for whoever swings it live (the look plugin's HSSoftJiggle): its rod and the plugin's numbers
      return { bone: b.name, parent: rig.J[b.parent].name, amount: +b.amount.toFixed(2), axis: b.dir.map(r4), length: r4(b.len), stiffness: r4(u.stiff), damping: r4(u.damp), gravity: r4(u.grav), gain: r4(u.gain), limit: r4(u.limit) }; }), palm: { l: palm("l"), r: palm("r") } };
  writeClips(glb, rig, clips, rec, undo);
  return { rig, body, clips, plan, report: { body: rec.body, settings: set, clips: rec.clips, soft: rec.soft, stats, softVerts: plan.moved || 0 } };
}

// The preview bake: what the desk's Watch computes, written down for Unreal (docs/UNREAL_FLOW.md §1b). For every
// scene, the stage is stepped through its timeline at `fps` and each frame's camera, every figure's joints, the
// subtitle, the black and the lights' flicker are recorded; events are kept as moments to stop at. The flow, the
// stitches and the endings go along as they are, so Unreal's StoryPreview walks the same graph the Watch does.
// Unreal plays the recording and computes nothing of its own: what you see there is what the desk worked out.
// Coordinates: three (x, y up, z south) -> Unreal centimetres (x, y = three z, z = three y).
import * as THREE from "three";
import { version, eventSecs, PLAYS, RADIUS } from "./stage.js";

const ue = v => [+(v.x * 100).toFixed(1), +(v.z * 100).toFixed(1), +(v.y * 100).toFixed(1)];
const ueDir = v => [+v.x.toFixed(4), +v.z.toFixed(4), +v.y.toFixed(4)];
const hfov = (vfov, aspect) => 2 * Math.atan(Math.tan(vfov * Math.PI / 360) * aspect) * 180 / Math.PI;
const OUTCOMES = { press: ["success", "fail"], mash: ["success", "fail"], hold: ["success", "fail"], breath: ["success", "fail"],
                   aim: ["success", "fail"], struggle: ["escape", "caught"] };

function eventOf(ev, story) {
  const out = { type: ev.type, prompt: ev.prompt || "", secs: eventSecs(ev, story) };
  out.options = ev.type === "choose" ? (ev.options || []).map(o => ({ id: o.id, label: o.label || o.id, ja: o.ja || "" }))
                                     : (OUTCOMES[ev.type] || ["success", "fail"]).map(r => ({ id: r, label: r }));
  if (ev.default) out.default = ev.default;
  return out;
}

export function bakeScene(stage, story, plan, sc, files, fps) {
  const v = version(sc), level = v.level || Object.keys(story.levels)[0];
  stage.setWorld(plan, story, level);
  const tl = stage.timeline(v), n = Math.max(1, Math.ceil(tl.total * fps) + 1);
  const cast = Object.keys(v.stage || {}).filter(c => stage.cast[c]);
  const joints = stage.lib.joints.map(j => j.name);
  const frames = [], subs = [], events = [], lights = {};
  let sub = null;
  for (let f = 0; f < n; f++) {
    const T = Math.min(tl.total, f / fps), st = stage.stateAt(tl, T, files);
    stage.apply(tl, st, T);
    const c = stage.camera;
    c.updateMatrixWorld(true);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(c.quaternion);
    const fr = { cam: [...ue(c.position), ...ueDir(fwd), ...ueDir(up), +hfov(c.fov, 16 / 9).toFixed(2)], black: +(st.black || 0).toFixed(3), bodies: {} };
    for (const who of cast) {
      const fig = stage.cast[who];
      if (!fig.group.visible) continue;
      fr.bodies[who] = joints.map(j => { const p = fig.jointWorld(j); return p ? ue(p) : null; });
    }
    for (const l of stage.lights) {
      const k = l.userData.base ? l.intensity / l.userData.base : 1;
      if (Math.abs(k - 1) > 0.01 || lights[l.userData.id]) (lights[l.userData.id] = lights[l.userData.id] || new Array(f).fill(1)).push(+k.toFixed(3));
    }
    for (const id of Object.keys(lights)) if (lights[id].length < f + 1) lights[id].push(1);
    frames.push(fr);
    const key = st.sub ? `${st.who}|${st.sub}` : null;            // a subtitle: one entry per stretch it's up
    if (key !== (sub && sub.key)) { if (sub) sub.t1 = T; sub = key ? { key, t0: T, t1: tl.total, en: st.sub, ja: st.ja || "", who: st.who || "" } : null; if (sub) subs.push(sub); }
  }
  for (const s of tl.segs) if (s.type === "event") events.push(Object.assign(eventOf(s.event, story), { t: +s.start.toFixed(3), end: +s.end.toFixed(3) }));
  subs.forEach(s => { delete s.key; s.t0 = +s.t0.toFixed(3); s.t1 = +s.t1.toFixed(3); });
  return { level, title: v.title || "", total: +tl.total.toFixed(3), fps, cast, frames, subs, events, lights,
           enter: v.enter || { kind: "fade", secs: 0.6 }, exit: v.exit || { kind: "fade", secs: 0.6 }, pick: sc.pick || null };
}

function stitchOf(st, n, story) {
  const flags = [], objective = ((st.beats || []).flatMap(b => b.do || []).find(a => a.objective) || {}).objective || "";
  for (const b of st.beats || []) for (const a of b.do || []) if (a.flag && !b.secret) flags.push(a.flag);
  const its = (story.interrupts || []).filter(it => it.during === "all" || (it.during || []).includes(n.ref)).map(it => ({ to: it.to, label: it.label || it.id }));
  const out = { title: st.title || "", level: st.level || Object.keys(story.levels)[0], goal: st.goal || objective, flags, interrupts: its, target_min: +(st.target_min || 3) };
  if (st.timer) out.timer = { secs: +st.timer.secs, fail: st.timer.fail, label: st.timer.label || "" };
  if (st.play) out.play = { type: st.play.type, secs: +st.play.secs || 0, rule: st.play.rule || "", results: PLAYS[st.play.type] || ["success", "fail"] };
  return out;
}

// The whole game: every scene baked, the flow and what each stitch and ending needs. onProgress(i, n, id) per scene.
export async function bakePreview(stage, story, plan, files, fps = 30, onProgress = () => {}) {
  const lib = stage.lib, bones = [];
  for (const j of lib.joints) if (j.parent && j.name !== "head_end") bones.push([j.parent, j.name, RADIUS[j.parent] || 0.04]);
  const out = { format: 1, game: story.game.id, start: story.game.start, fps, joints: lib.joints.map(j => j.name), bones,
                cast: {}, flow: story.flow, scenes: {}, stitches: {}, made: new Date().toISOString() };
  for (const [id, c] of Object.entries(story.cast || {})) out.cast[id] = { name: c.name || id, height: +(c.height || 1.7) };
  const ids = Object.keys(story.scenes || {});
  for (let i = 0; i < ids.length; i++) {
    onProgress(i, ids.length, ids[i]);
    await new Promise(r => setTimeout(r, 0));                     // let the page draw its progress
    out.scenes[ids[i]] = bakeScene(stage, story, plan, story.scenes[ids[i]], files, fps);
  }
  for (const [nid, n] of Object.entries(story.flow)) if (n.type === "stitch" && story.stitches[n.ref]) out.stitches[n.ref] = stitchOf(story.stitches[n.ref], n, story);
  return out;
}

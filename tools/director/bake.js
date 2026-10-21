// The preview bake: what the desk's Watch computes, written down for Unreal (docs/UNREAL_FLOW.md §1b). For every
// scene, the stage is stepped through its timeline at `fps` and each frame's camera, every figure's joints, the
// subtitle, the black and the lights' flicker are recorded; events are kept as moments to stop at. The flow, the
// stitches and the endings go along as they are, so Unreal's StoryPreview walks the same graph the Watch does.
// Unreal plays the recording and computes nothing of its own: what you see there is what the desk worked out.
// Coordinates: three (x, y up, z south) -> Unreal centimetres (x, y = three z, z = three y).
// A cast member with a real body (MHR, shaped) goes across as that body: bodyGlb() exports it shaped and in its bind
// pose, and every frame records each bone's skinning matrix (bind mesh space -> world, `skin`), so Unreal deforms
// the same mesh the same way. Unreal measures its own import axes from the bones' bind positions (`bind`).
import * as THREE from "three";
import { version, eventSecs, PLAYS, RADIUS } from "./stage.js";

const skinnedOf = fig => { let m = null; if (fig && fig.model) fig.model.traverse(o => { if (!m && o.isSkinnedMesh) m = o; }); return m; };
const r4 = x => Math.round(x * 1e4) / 1e4;
// per bone: bone world * bone inverse * (bind space in metres -> the file's bind space): the exported mesh's space ->
// world, 12 numbers
// (column-major, top 3 rows); the 3x3 part times
// `SKIN_LIN` so a centimetre body scaled to metres (about 0.01) keeps its digits at 4 decimals
export const SKIN_LIN = 100;
function skinMatrices(mesh) {
  const out = [], m = new THREE.Matrix4(), k = SKIN_LIN, unK = new THREE.Matrix4().makeScale(1 / bindScale(mesh), 1 / bindScale(mesh), 1 / bindScale(mesh));
  mesh.skeleton.bones.forEach((b, i) => {
    m.multiplyMatrices(b.matrixWorld, mesh.skeleton.boneInverses[i]).multiply(mesh.bindMatrix).multiply(unK);
    const e = m.elements;
    out.push(r4(e[0] * k), r4(e[1] * k), r4(e[2] * k), r4(e[4] * k), r4(e[5] * k), r4(e[6] * k), r4(e[8] * k), r4(e[9] * k), r4(e[10] * k),
             r4(e[12]), r4(e[13]), r4(e[14]));
  });
  return out;
}

// The body's bind space in metres: MHR's FBX binds in centimetres (its bones about 170 apart from foot to head).
function bindScale(mesh) {
  if (mesh.userData.bindK) return mesh.userData.bindK;
  let lo = Infinity, hi = -Infinity; const m = new THREE.Matrix4(), v = new THREE.Vector3();
  for (const bi of mesh.skeleton.boneInverses) { v.setFromMatrixPosition(m.copy(bi).invert()); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); }
  return (mesh.userData.bindK = hi - lo > 20 ? 0.01 : 1);
}

// A cast member's body as the desk shows it (shape morphs applied, its refitted skeleton in the bind pose), as a .glb
// for Unreal: a fresh skeleton with the same bone names and no scales, vertices and bones in metres, the mesh at the
// identity (Unreal applies node scales to bones but not to a skinned mesh's vertices). With each bone's bind position,
// which Unreal fits its import axes to.
export async function bodyGlb(fig, GLTFExporter) {
  const src = skinnedOf(fig); if (!src) return null;
  const k = bindScale(src), K = new THREE.Matrix4().makeScale(k, k, k);
  const geo = new THREE.BufferGeometry(), P = src.geometry.attributes.position.clone(), MP = src.geometry.morphAttributes.position || [], inf = src.morphTargetInfluences || [];
  for (let m = 0; m < MP.length; m++) {
    const w = inf[m]; if (!w) continue;
    for (let v = 0; v < P.count; v++) P.setXYZ(v, P.getX(v) + MP[m].getX(v) * w, P.getY(v) + MP[m].getY(v) * w, P.getZ(v) + MP[m].getZ(v) * w);
  }
  geo.setAttribute("position", P);
  if (src.geometry.attributes.normal) geo.setAttribute("normal", src.geometry.attributes.normal.clone());   // the file's smooth normals
  geo.setAttribute("skinIndex", src.geometry.attributes.skinIndex.clone());
  geo.setAttribute("skinWeight", src.geometry.attributes.skinWeight.clone());
  if (src.geometry.index) geo.setIndex(src.geometry.index.clone());
  geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(K, src.bindMatrix));      // into the bind space, in metres
  if (!geo.attributes.normal) geo.computeVertexNormals();                          // (the FBX's vertices aren't shared: recomputed ones come out flat)
  // the skeleton again: each bone where it was bound (scaled to metres), its rotation kept and its scale dropped
  const bones = src.skeleton.bones, idx = new Map(bones.map((b, i) => [b, i])), world = [], fresh = [];
  const tp = new THREE.Vector3(), tq = new THREE.Quaternion(), ts = new THREE.Vector3();
  bones.forEach((b, i) => {
    new THREE.Matrix4().copy(src.skeleton.boneInverses[i]).invert().premultiply(K).decompose(tp, tq, ts);
    world.push(new THREE.Matrix4().compose(tp.clone(), tq.clone(), new THREE.Vector3(1, 1, 1)));
    const nb = new THREE.Bone(); nb.name = b.name; fresh.push(nb);
  });
  const group = new THREE.Group(); group.name = "body";
  bones.forEach((b, i) => {
    let p = b.parent; while (p && !idx.has(p)) p = p.parent;
    const pi = p ? idx.get(p) : -1;
    const local = pi < 0 ? world[i].clone() : new THREE.Matrix4().copy(world[pi]).invert().multiply(world[i]);
    local.decompose(fresh[i].position, fresh[i].quaternion, ts);
    (pi < 0 ? group : fresh[pi]).add(fresh[i]);
  });
  group.updateMatrixWorld(true);
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xc9c0b2, roughness: 0.8 }));
  mesh.name = "body_mesh"; group.add(mesh); group.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(fresh), new THREE.Matrix4());
  const bind = [];
  world.forEach(w => { tp.setFromMatrixPosition(w); bind.push(r4(tp.x), r4(tp.y), r4(tp.z)); });
  const glb = await new GLTFExporter().parseAsync(group, { binary: true });
  return { glb: new Blob([glb], { type: "model/gltf-binary" }), bones: bones.map(b => b.name), bind };
}

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
  const skinned = Object.fromEntries(cast.map(w => [w, skinnedOf(stage.cast[w])]).filter(([, m]) => m));
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
      if (skinned[who]) { fig.group.updateMatrixWorld(true); (fr.skin = fr.skin || {})[who] = skinMatrices(skinned[who]); }
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
  const mode = (v.camera || {}).mode || "free";                 // how far the player may look round the recorded view (stage.apply)
  const look = mode === "hard" ? [0, 0] : mode === "free" ? [180, 80] : (v.camera || {}).cone || [30, 18];
  return { level, title: v.title || "", total: +tl.total.toFixed(3), fps, cast, frames, subs, events, lights, look,
           enter: v.enter || { kind: "blend", secs: 0.8 }, exit: v.exit || { kind: "blend", secs: 0.8 }, pick: sc.pick || null };   // Unreal's preview fades a blend: it has no walking to blend from yet
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
export async function bakePreview(stage, story, plan, files, fps = 30, onProgress = () => {}, GLTFExporter = null, saveBody = null) {
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
  out.bodies = {};                                 // each cast member's body, exported once (any scene's figure will do)
  if (GLTFExporter && saveBody) {
    stage.setWorld(plan, story, Object.keys(story.levels)[0]);
    for (const who of Object.keys(stage.cast)) {
      const b = await bodyGlb(stage.cast[who], GLTFExporter); if (!b) continue;
      await saveBody(who, b.glb);
      out.bodies[who] = { file: `Body_${who}.glb`, bones: b.bones, bind: b.bind, skin_lin: SKIN_LIN };
    }
  }
  for (const [nid, n] of Object.entries(story.flow)) if (n.type === "stitch" && story.stitches[n.ref]) out.stitches[n.ref] = stitchOf(story.stitches[n.ref], n, story);
  return out;
}

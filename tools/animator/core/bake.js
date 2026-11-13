// Animator v2: the bake (docs/ANIMATOR_V2.md §8). Clips written into the character's own .glb as glTF animations, and
// its way back: a baked file can be baked again with other settings, nothing of the first bake left in it.
import { M4 } from "./m.js";

const NAME = "hsMotion";
const sceneOf = glb => (glb.json.scenes || [])[glb.json.scene || 0] || (glb.json.scenes || [])[0];

/** is this file baked already (does it carry the Animator's record) */
export const baked = glb => !!(sceneOf(glb)?.extras?.[NAME]);
export const record = glb => sceneOf(glb)?.extras?.[NAME] || null;

/** a baked file made as it was before its bake: its animations out, its soft bones and their skin weights out */
export function unbake(glb) {
  const j = glb.json, sc = sceneOf(glb), rec = sc?.extras?.[NAME]; if (!rec) return false;
  const ours = new Set(Object.keys(rec.clips || {})); j.animations = (j.animations || []).filter(a => !ours.has(a.name)); if (!j.animations.length) delete j.animations;
  const u = rec.undo;
  if (u) {
    for (const p of u.prims || []) { const pr = j.meshes[p.mesh].primitives[p.prim]; pr.attributes.JOINTS_0 = p.JOINTS_0; pr.attributes.WEIGHTS_0 = p.WEIGHTS_0; }
    for (const s of u.skins || []) { const sk = j.skins[s.skin]; sk.joints.length = s.joints; sk.inverseBindMatrices = s.ibm; }
    if (u.nodes && u.nodes.count) {
      if (u.nodes.first + u.nodes.count !== j.nodes.length) throw new Error("this file was changed after its bake (nodes were added): export the character again from the Studio and bake that");
      const gone = new Set(); for (let i = u.nodes.first; i < j.nodes.length; i++) gone.add(i);
      j.nodes.length = u.nodes.first; for (const n of j.nodes) if (n.children) { n.children = n.children.filter(c => !gone.has(c)); if (!n.children.length) delete n.children; }
    }
  }
  delete sc.extras[NAME]; for (const n of j.nodes) if (n.extras && n.extras[NAME]) { delete n.extras[NAME]; if (!Object.keys(n.extras).length) delete n.extras; }
  glb.compact();
  return true;
}

/** new joints under the rig's: [{ name, parent (a rig joint's index), at: [x,y,z] rest, world }] -> their rig indices.
    Each skin of the file gets them at the end of its joints with their inverse bind matrices. */
export function addJoints(glb, rig, list, undo) {
  const j = glb.json, first = j.nodes.length, out = [];
  undo.nodes = { first, count: list.length }; undo.skins = [];
  for (const b of list) { const p = rig.J[b.parent], node = { name: b.name, translation: [b.at[0] - p.at[0], b.at[1] - p.at[1], b.at[2] - p.at[2]] };   // (the Studio's bones are unturned: a child's place is its offset)
    j.nodes.push(node); (j.nodes[p.node].children ||= []).push(j.nodes.length - 1);
    const i = rig.J.length; rig.J.push({ i, node: j.nodes.length - 1, name: b.name, parent: b.parent, at: b.at.slice(), q0: [0, 0, 0, 1], kids: [], soft: true }); p.kids.push(i); rig.order.push(i); rig.ix.set(b.name, i); out.push(i); }
  for (let s = 0; s < (j.skins || []).length; s++) {
    const sk = j.skins[s], n0 = sk.joints.length, old = sk.inverseBindMatrices != null ? glb.read(sk.inverseBindMatrices) : null, ibm = new Float32Array((n0 + list.length) * 16);
    if (old) ibm.set(old); else for (let k = 0; k < n0; k++) ibm.set(M4.id(), k * 16);
    list.forEach((b, k) => { ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -b.at[0], -b.at[1], -b.at[2], 1], (n0 + k) * 16); sk.joints.push(first + k); });
    undo.skins.push({ skin: s, joints: n0, ibm: sk.inverseBindMatrices ?? null }); sk.inverseBindMatrices = glb.addAccessor(ibm, "MAT4");
  }
  return out;
}

/** a primitive's skin weights written again (the old ones kept for the way back) */
export function setWeights(glb, mesh, prim, JI, JW, undo) {
  const pr = glb.json.meshes[mesh].primitives[prim]; (undo.prims ||= []).push({ mesh, prim, JOINTS_0: pr.attributes.JOINTS_0, WEIGHTS_0: pr.attributes.WEIGHTS_0 });
  pr.attributes.JOINTS_0 = glb.addAccessor(JI, "VEC4", { target: 34962 }); pr.attributes.WEIGHTS_0 = glb.addAccessor(JW, "VEC4", { target: 34962 });
}

/** the clips (clips.js tracksOf) as the file's animations, and the record of the bake. glTF lets a node that's
    animated carry no matrix: the Studio's bones (a matrix each, a plain translation) become translations. */
export function writeClips(glb, rig, clips, rec, undo) {
  const j = glb.json;
  for (const b of rig.J) { const n = j.nodes[b.node]; if (!n.matrix) continue; const l = glb.local(b.node); delete n.matrix; n.translation = l.t;
    if (Math.abs(l.q[3]) < 0.9999999) n.rotation = l.q; if (Math.abs(l.s[0] - 1) + Math.abs(l.s[1] - 1) + Math.abs(l.s[2] - 1) > 1e-6) n.scale = l.s; }
  const names = new Set(clips.map(c => c.name)); j.animations = (j.animations || []).filter(a => !names.has(a.name));
  rec.clips = {};
  for (const c of clips) {
    const input = glb.addAccessor(c.times, "SCALAR", { minmax: true }), samplers = [], channels = []; let still = null;
    // (a track that holds one value all through, a finger's curl in a walk, is written as two keys, the clip's ends)
    const add = (node, path, data, type) => { const w = type === "VEC4" ? 4 : 3, n = data.length / w; let same = n > 2; for (let i = w; same && i < data.length; i++) if (Math.abs(data[i] - data[i % w]) > 1e-6) same = false;
      if (same) { still ??= glb.addAccessor(new Float32Array([0, c.times[c.times.length - 1]]), "SCALAR", { minmax: true }); const two = new Float32Array(2 * w); two.set(data.subarray(0, w)); two.set(data.subarray(0, w), w); samplers.push({ input: still, output: glb.addAccessor(two, type), interpolation: "LINEAR" }); }
      else samplers.push({ input, output: glb.addAccessor(data, type), interpolation: "LINEAR" });
      channels.push({ sampler: samplers.length - 1, target: { node, path } }); };
    for (const t of c.tracks) { const node = rig.J[t.joint].node; if (t.r) add(node, "rotation", t.r, "VEC4"); if (t.t) add(node, "translation", t.t, "VEC3"); if (t.s) add(node, "scale", t.s, "VEC3"); }
    j.animations.push({ name: c.name, samplers, channels });
    rec.clips[c.name] = { loop: c.loop, secs: +c.secs.toFixed(4), ...(c.speed ? { speed: +c.speed.toFixed(3) } : {}), ...(c.events.length ? { events: c.events.map(e => ({ ...e, t: +e.t.toFixed(3) })) } : {}), ...c.meta };
  }
  rec.undo = undo;
  const sc = sceneOf(glb); (sc.extras ||= {})[NAME] = rec;
  // Godot keeps a node's extras as metadata but drops a scene's and an animation's: the same record, without the way
  // back, on the skin's own node, where a game finds it
  const skinNode = j.nodes.find(n => n.mesh != null && n.skin != null && /_skin$/.test(n.name || "")) || j.nodes.find(n => n.mesh != null && n.skin != null);
  if (skinNode) { const { undo: _, ...pub } = rec; (skinNode.extras ||= {})[NAME] = pub; }
  // (the way back's accessors are named only in the record: kept through the packing, and told their new numbers)
  const roots = []; for (const p of undo.prims || []) roots.push(p.JOINTS_0, p.WEIGHTS_0); for (const s of undo.skins || []) roots.push(s.ibm);
  const map = glb.compact(roots);
  if (map) { for (const p of undo.prims || []) { p.JOINTS_0 = map.get(p.JOINTS_0); p.WEIGHTS_0 = map.get(p.WEIGHTS_0); } for (const s of undo.skins || []) if (s.ibm != null) s.ibm = map.get(s.ibm); }
}

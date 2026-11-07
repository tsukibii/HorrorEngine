// A level as a .glb for a Godot project built by hand (DECISIONS 2026-11-03, night: "when I export interiors/streets/
// character models ... an export to godot"; docs/SCENE_BUILDER.md §11): the scene builder's Export for Godot, into
// Exports/interiors/<name>/. What the builder's 3D view shows of the level, made into the nodes Godot's importer reads:
//   visual/<piece>              every piece's mesh with its materials (kit things and library meshes inside their
//                               blocks)
//   outside/                    the building round it as the street builds it, when the view shows it (its own node: a
//                               level put inside a street's building leaves it out, the street has that shell)
//   doors/door_<id>             a door's leaf and what's attached to it (its handle, its half of the hinges), the node's
//                               origin on the hinge: turned about Y it swings (extras: hinge, the turn that opens it,
//                               slide, locked_by: what opens it, an item's name or flag:<name>); its collider under it
//   collision/<room>-colonly    the solid pieces' boxes, one trimesh a room: Godot makes each a StaticBody3D on import
//   occluders/<room>_occ-occonly  the walls', floors' and ceilings' boxes: OccluderInstance3D, occlusion culling
//   lights/light_<id>           the level's lamps (KHR_lights_punctual), their energy as Godot's
//   markers/                    player_start, spot_<id>, trigger_<id>: empty nodes looking along their -Z (Godot's
//                               forward), what they are in their extras
// Y up, metres, story north -Z (the desk's s2t). Plain three.js: the page hands it its stage, its plan and its outside.
import * as THREE from "three";
import { s2t } from "./stage.js";
import * as S3 from "./street3.js";

const clean = s => String(s || "level").replace(/[^A-Za-z0-9_]+/g, "_");
const energyOf = i => Math.max(0.3, Math.min(3, +i || 1));          // a desk lamp's intensity as Godot's light energy
const Y = new THREE.Vector3(0, 1, 0);

// a piece's box (size [w, d, h] about its middle, yaw degrees) as triangles, in three's space, into T
function boxInto(T, p, extra = new THREE.Matrix4()) {
  const [w, d, h] = p.size, m = new THREE.Matrix4().compose(s2t(...p.pos), new THREE.Quaternion().setFromAxisAngle(Y, (p.yaw || 0) * Math.PI / 180), new THREE.Vector3(1, 1, 1));
  m.premultiply(extra);
  const v0 = T.pos.length / 3;
  for (const z of [-1, 1]) for (const y of [-1, 1]) for (const x of [-1, 1]) {
    const v = new THREE.Vector3(x * w / 2, y * h / 2, z * d / 2).applyMatrix4(m); T.pos.push(v.x, v.y, v.z);
  }
  // corners: i = x + 2y + 4z (x, y, z each 0 for -1, 1 for +1); six faces, each two triangles wound outward
  for (const [a, b, c, e] of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]])
    T.idx.push(v0 + a, v0 + b, v0 + c, v0 + a, v0 + c, v0 + e);
}
function trisMesh(name, T) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(T.pos, 3));
  geo.setIndex(T.idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff00ff })); m.name = name; return m;
}
// a world object as the export's: shared geometry and its full material (not the simple view's), what isn't a surface
// left out (lights, points, lines, sprites, the hidden), a block whose own box is hidden (a kit thing's, a library mesh's)
// a plain node over its children
// a window's or a glazed door's pane as the game's own export has it (storykit/godot.py: 12 % of a pale blue, a glint):
// the desk's 25 %, lit by the room's lamps in Godot, was a milky veil over the street outside
let PANE = null;
const pane = () => PANE || (PANE = Object.assign(new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.85, 0.9, 0.95, THREE.SRGBColorSpace), roughness: 0.05, metalness: 0,
  transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }), { name: "glass" }));
function copyOf(o, shown = false) {                                  // shown: a door the view has taken away (Doors open)
  if ((!o.visible && !shown) || o.isLight || o.isPoints || o.isLine || o.isSprite) return null;
  const mat = o.isMesh ? (o.userData.slot === "glass" ? pane() : (o.userData.fullMat || o.material)) : null;
  const hidden = o.isMesh && [].concat(mat).every(m => !m || m.visible === false || m.isShaderMaterial);
  const c = o.isMesh && !hidden ? new THREE.Mesh(o.geometry, mat) : new THREE.Group();
  c.name = o.name || (o.userData && o.userData.slot ? "kit_" + o.userData.slot : "");
  c.position.copy(o.position); c.quaternion.copy(o.quaternion); c.scale.copy(o.scale);
  for (const k of o.children) { const kc = copyOf(k); if (kc) c.add(kc); }
  return c.isMesh || c.children.length ? c : null;
}

export function levelGroup(stage, plan, story, level, opts = {}) {
  const out = new THREE.Group(); out.name = clean(opts.name || level);
  const G = name => { const g = new THREE.Group(); g.name = name; out.add(g); return g; };
  const visual = G("visual"), doors = G("doors"), collision = G("collision"), occluders = G("occluders"), lights = G("lights"), markers = G("markers");
  const pieces = (plan.pieces || []).filter(p => p.level === level), byId = new Map(pieces.map(p => [p.id, p]));
  const world = [...stage.world.children];
  const doorOf = o => { const p = o.userData && o.userData.piece; return p && (p.kind === "door" ? p.id : o.userData.attach && byId.has(o.userData.attach) && byId.get(o.userData.attach).kind === "door" ? o.userData.attach : null); };
  // the pieces as they're drawn (a door and what's attached to it into its own node)
  const doorNodes = new Map();
  for (const o of world) {
    const p = o.userData && o.userData.piece;
    if (!p || p.level !== level || o.userData.kind === "leak") continue;
    const did = doorOf(o), c = copyOf(o, !!did && !p.tags.includes("hidden")); if (!c) continue;
    c.name = clean(p.id);
    if (!did) { visual.add(c); continue; }
    if (!doorNodes.has(did)) {
      const dm = world.find(w => w.userData && w.userData.piece && w.userData.piece.id === did), dp = byId.get(did);
      const sw = (dm && dm.userData.swing) || { pivot: new THREE.Vector3(-(dp.size[0]) / 2, 0, 0), hinge: "left", slide: ((dp.d || {}).swing === "slide") };
      const base = (dm && dm.userData.base) || { pos: dm ? dm.position.clone() : s2t(...dp.pos), rot: dm ? dm.rotation.y : (dp.yaw || 0) * Math.PI / 180 };
      const n = new THREE.Group(); n.name = "door_" + clean(did);
      n.position.copy(sw.pivot.clone().applyAxisAngle(Y, base.rot).add(base.pos)); n.rotation.y = base.rot;   // on the hinge, square with the door
      const lk = (dp.d || {}).locked_by || ((dp.tags || []).find(t => t.startsWith("locked_by:")) || "").slice(10);   // what opens it (an item's name, or flag:<name>)
      n.userData = Object.assign({ kind: "door", id: did, hinge: sw.hinge || "left", opens: sw.slide ? 0 : (sw.hinge === "right" ? 1 : -1), slide: !!sw.slide, width: +(dp.size[0]).toFixed(3) }, lk ? { locked_by: lk } : {});
      const inv = new THREE.Matrix4().copy(n.matrix.compose(n.position, n.quaternion, n.scale)).invert();
      const T = { pos: [], idx: [] }; boxInto(T, Object.assign({}, dp, { pos: dp.pos, yaw: base.rot * 180 / Math.PI }), inv);
      n.add(trisMesh(n.name + "_col-colonly", T));
      doors.add(n); doorNodes.set(did, { node: n, inv, base });
    }
    const D = doorNodes.get(did), ob = o.userData.base || { pos: o.position, rot: o.rotation.y };   // at the door's shut place
    c.position.copy(ob.pos).applyMatrix4(D.inv); c.rotation.y = ob.rot - D.base.rot;
    D.node.add(c);
  }
  // colliders and occluders, a mesh a room
  const coll = new Map(), occ = new Map(), into = (M, room) => { if (!M.has(room)) M.set(room, { pos: [], idx: [] }); return M.get(room); };
  for (const p of pieces) {
    if (!["wall", "floor", "ceiling", "mesh"].includes(p.kind) || p.tags.includes("hidden") || p.tags.includes("hollow")) continue;
    if (p.tags.includes("use:clean") || doorOf({ userData: { piece: p, attach: (p.tags.find(t => t.startsWith("attach:")) || "").slice(7) } })) continue;
    const room = clean(p.room || "level");
    boxInto(into(coll, room), p);
    if (p.kind !== "mesh") boxInto(into(occ, room), p);
  }
  for (const [room, T] of coll) collision.add(trisMesh(room + "-colonly", T));
  if (opts.occluders !== false) for (const [room, T] of occ) occluders.add(trisMesh(room + "_occ-occonly", T));
  // the lamps
  if (opts.lights !== false) for (const l of stage.lights || []) {
    const id = l.userData && l.userData.id; if (!id || !byId.has(id)) continue;
    const base = l.userData.base !== undefined ? l.userData.base : l.intensity;
    const L = l.isSpotLight ? new THREE.SpotLight(l.color.clone(), energyOf(base), l.distance, l.angle, l.penumbra, 2) : new THREE.PointLight(l.color.clone(), energyOf(base), l.distance, 2);
    L.name = "light_" + clean(id); L.position.copy(l.position);
    L.userData = { kind: "light", id, lamp: l.userData.kind || "bulb", lit: !!base, room: l.userData.room || null };
    if (!base) L.intensity = energyOf(1);                           // a lamp the story lights later: there at its energy, its extras say so
    lights.add(L);
    if (L.isSpotLight) { L.target.position.copy(l.target.position); lights.add(L.target); L.target.name = L.name + "_aim"; }
  }
  // where the player starts, the spots and the trigger areas: empty nodes looking along their -Z
  for (const p of pieces) {
    if (!["spot", "start", "trigger"].includes(p.kind)) continue;
    const o = new THREE.Object3D(); o.name = p.kind === "start" ? "player_start" : `${p.kind}_${clean(p.id)}`;
    o.position.copy(s2t(...p.pos)); o.rotation.y = ((p.yaw || 0) - 90) * Math.PI / 180;
    o.userData = Object.assign({ kind: p.kind, id: p.id, room: p.room || null, yaw: p.yaw || 0 }, p.kind === "trigger" ? { size: p.size } : {});
    markers.add(o);
  }
  if (opts.outside) out.add(S3.exportVisual(opts.outside, new Map(), "outside"));   // its own node: hidden or left out when the level goes in a street's building
  out.userData = { horrorstudio: { kind: "interior", level, from: opts.from || "", rooms: [...new Set(pieces.map(p => p.room).filter(Boolean))], up: "+Y", units: "metres" } };
  return out;
}

// the group as a .glb (the textures it wears loaded first)
export async function levelGlb(group, GLTFExporter) {
  await S3.texturesReady(group);
  return new Promise((res, rej) => new GLTFExporter().parse(group, r => res(r), e => rej(e), { binary: true, maxTextureSize: 2048 }));
}

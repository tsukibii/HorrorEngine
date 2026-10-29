// Real bodies for the director: any rigged human dropped into Content/Studio/Bodies (glTF or FBX: Manny or Quinn
// exported from your Unreal, a Mixamo character, a MetaHuman body), driven by the previs blocking.
// Bones are found by name (Unreal mannequin, Mixamo and common rig names). The pose is retargeted by direction:
// each bone is aimed along the previs bone it stands for, keeping the body's facing, so A-pose and T-pose models
// both work, and generated motions (positions only) drive them as well as blocked poses.
import * as THREE from "three";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { FBXLoader } from "./vendor/FBXLoader.js";
import * as SkeletonUtils from "./vendor/SkeletonUtils.js";
import { skinLit, setSkinLit } from "../shared/skinlight.js";
import { skinWet, setSkinWet, wetOf } from "../shared/skinwet.js";   // the story's `skin` word: wet, sweating, dripping, oiled

const norm = s => s.toLowerCase().replace(/mixamorig\d*/g, "").replace(/[^a-z0-9]/g, "");
const SIDED = {   // previs joint (without side) -> candidate names, X = the side ("l"/"left", "r"/"right")
  clavicle: ["claviclex", "xclavicle", "xshoulder", "shoulderx"],
  upperarm: ["upperarmx", "xarm", "armx", "xupperarm", "xuparm"],
  lowerarm: ["lowerarmx", "xforearm", "forearmx", "xlowerarm", "xlowarm"],
  hand: ["handx", "xhand", "xwrist"],
  thigh: ["thighx", "xupleg", "uplegx", "xupperleg", "upperlegx", "xthigh"],
  calf: ["calfx", "xleg", "legx", "xlowerleg", "lowerlegx", "xcalf", "shinx", "xshin", "xlowleg"],
  foot: ["footx", "xfoot"],
  ball: ["ballx", "xtoebase", "toebasex", "xtoes", "toesx", "xtoe", "toex"],
};
const CENTRE = { pelvis: ["pelvis", "hips", "hip", "root"], neck_01: ["neck01", "neck", "cneck"], head: ["head", "chead"] };   // root last: MHR's hips (UE's root is on the floor, but UE has pelvis)
const AIM = { pelvis: "spine_01", spine_01: "spine_02", spine_02: "spine_03", spine_03: "neck_01", neck_01: "head", head: "head_end",
  clavicle_l: "upperarm_l", upperarm_l: "lowerarm_l", lowerarm_l: "hand_l", hand_l: "hand_end_l",
  clavicle_r: "upperarm_r", upperarm_r: "lowerarm_r", lowerarm_r: "hand_r", hand_r: "hand_end_r",
  thigh_l: "calf_l", calf_l: "foot_l", foot_l: "ball_l", thigh_r: "calf_r", calf_r: "foot_r", foot_r: "ball_r" };
const UPPER = new Set(["spine_02", "spine_03", "neck_01", "head"]);
const TRUNK = ["pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head"];
const TRUNK_MHR = new Set(["root", "c_spine0", "c_spine1", "c_spine2", "c_spine3", "c_neck", "c_head"]);
const ARM = /^(clavicle|upperarm|lowerarm|hand)_/;

export function mapBones(root) {
  const bones = []; root.traverse(o => { if (o.isBone) bones.push(o); });
  const by = {}; for (const b of bones) if (!(norm(b.name) in by)) by[norm(b.name)] = b;
  const map = {};
  for (const [j, cands] of Object.entries(CENTRE)) for (const c of cands) if (by[c]) { map[j] = by[c]; break; }
  const ue5 = !!by.spine05, mhr = !!by.cspine3;     // UE5's five spine bones; Meta's MHR (c_spine0..3)
  const spine = mhr ? { spine_01: ["cspine0"], spine_02: ["cspine2"], spine_03: ["cspine3"] } :
    { spine_01: ["spine01", "spine"], spine_02: ue5 ? ["spine03"] : ["spine02", "spine1", "chest"], spine_03: ue5 ? ["spine05"] : ["spine03", "spine2", "upperchest"] };
  for (const [j, cands] of Object.entries(spine)) for (const c of cands) if (by[c]) { map[j] = by[c]; break; }
  for (const [base, cands] of Object.entries(SIDED)) for (const [side, forms] of [["l", ["l", "left"]], ["r", ["r", "right"]]]) {
    outer: for (const c of cands) for (const f of forms) { const n = c.replace("x", f); if (by[n]) { map[`${base}_${side}`] = by[n]; break outer; } }
  }
  return { map, bones, missing: ["pelvis", "spine_01", "neck_01", "head", "upperarm_l", "lowerarm_l", "hand_l", "upperarm_r", "lowerarm_r", "hand_r", "thigh_l", "calf_l", "foot_l", "thigh_r", "calf_r", "foot_r"].filter(j => !map[j]) };
}

// Meta's MHR (Momentum Human Rig, Apache-2.0: Content/Studio/Bodies/MHR.fbx) carries its 45 identity shapes as morph
// targets shape_c_0..44 (0-19 body, 20-39 head, 40-44 hands; 45-116 are FACS expressions). A cast member's `shape`
// sets them, and the skeleton is refitted to the new body (the FBX's bones don't move with the morphs).
export const SHAPES = 45;
export function shapeMesh(root) {
  let m = null;
  root.traverse(o => { if (!m && o.isSkinnedMesh && o.morphTargetDictionary && "shape_c_0" in o.morphTargetDictionary) m = o; });
  return m;
}
export function applyShape(root, shape) {
  const mesh = shapeMesh(root);
  if (!mesh || !shape) return false;
  const dict = mesh.morphTargetDictionary, inf = mesh.morphTargetInfluences;
  for (let i = 0; i < SHAPES; i++) { const k = dict["shape_c_" + i]; if (k !== undefined) inf[k] = +(shape[i] || 0); }
  const sk = mesh.skeleton, geo = mesh.geometry, P = geo.attributes.position, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  const MP = geo.morphAttributes.position || [], n = P.count;
  sk.boneInverses = sk.boneInverses.map(b => b.clone());           // the template and other clones share these
  const saved = sk.bones.map(b => b.quaternion.clone());
  sk.pose();                                                       // the bind pose: where the morphs apply
  root.updateMatrixWorld(true);
  const lin = new THREE.Matrix3().setFromMatrix4(mesh.bindMatrix);
  const disp = new Float32Array(n * 3);
  for (let i = 0; i < SHAPES; i++) {
    const k = dict["shape_c_" + i], w = inf[k]; if (!w || !MP[k]) continue;
    const a = MP[k];
    for (let v = 0; v < n; v++) { disp[v * 3] += a.getX(v) * w; disp[v * 3 + 1] += a.getY(v) * w; disp[v * 3 + 2] += a.getZ(v) * w; }
  }
  // each joint moves with the skin around it: vertices weighted to both the bone and its parent (the joint's ring)
  const nb = sk.bones.length, idx = new Map(sk.bones.map((b, i) => [b, i]));
  const parentOf = sk.bones.map(b => { let p = b.parent; while (p && !idx.has(p)) p = p.parent; return p ? idx.get(p) : -1; });
  const wsum = new Float32Array(nb), ring = new Float32Array(nb), acc = new Float32Array(nb * 3), accR = new Float32Array(nb * 3);
  const wv = new Float32Array(nb);
  for (let v = 0; v < n; v++) {
    const ids = [SI.getX(v), SI.getY(v), SI.getZ(v), SI.getW(v)], ws = [SW.getX(v), SW.getY(v), SW.getZ(v), SW.getW(v)];
    for (let k = 0; k < 4; k++) wv[ids[k]] += ws[k];
    for (let k = 0; k < 4; k++) {
      const b = ids[k], w = ws[k]; if (w <= 0) continue;
      wsum[b] += w; acc[b * 3] += disp[v * 3] * w; acc[b * 3 + 1] += disp[v * 3 + 1] * w; acc[b * 3 + 2] += disp[v * 3 + 2] * w;
      const pw = parentOf[b] >= 0 ? wv[parentOf[b]] : 0, r = w * pw;
      if (r > 0) { ring[b] += r; accR[b * 3] += disp[v * 3] * r; accR[b * 3 + 1] += disp[v * 3 + 1] * r; accR[b * 3 + 2] += disp[v * 3 + 2] * r; }
    }
    for (let k = 0; k < 4; k++) wv[ids[k]] = 0;
  }
  const target = sk.bones.map((b, i) => {
    const use = ring[i] > 1 ? [accR, ring[i]] : wsum[i] > 1 ? [acc, wsum[i]] : null;
    if (!use) return null;
    const d = new THREE.Vector3(use[0][i * 3], use[0][i * 3 + 1], use[0][i * 3 + 2]).divideScalar(use[1]).applyMatrix3(lin);
    return b.getWorldPosition(new THREE.Vector3()).add(d);
  });
  const order = []; root.traverse(o => { if (idx.has(o)) order.push(idx.get(o)); });     // parents before children
  for (const i of order) {
    if (!target[i]) continue;
    const b = sk.bones[i]; b.parent.updateMatrixWorld(true);
    b.position.copy(b.parent.worldToLocal(target[i].clone())); b.updateMatrixWorld(true);
  }
  sk.calculateInverses();                                          // this body's bind pose
  sk.bones.forEach((b, i) => b.quaternion.copy(saved[i]));         // back to the file's own rest pose
  root.updateMatrixWorld(true);
  return true;
}

export async function loadBody(url) {
  if (/\.fbx$/i.test(url)) return await new FBXLoader().loadAsync(url);
  const g = await new GLTFLoader().loadAsync(url);
  return g.scene;
}

function frame(primary, secondaries) {           // an orthonormal frame from a primary axis and the first usable secondary
  const a = primary.clone().normalize();
  let s = null;
  for (const v of secondaries) if (v && Math.abs(a.dot(v.clone().normalize())) < 0.92) { s = v.clone().normalize(); break; }
  if (!s) s = Math.abs(a.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  const c = new THREE.Vector3().crossVectors(a, s).normalize(), b = new THREE.Vector3().crossVectors(c, a).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, b, c));
}
function axes(P) {                                // the body's left, up and forward from joint positions
  const Lu = P.upperarm_l && P.upperarm_r ? P.upperarm_l.clone().sub(P.upperarm_r).normalize() : new THREE.Vector3(1, 0, 0);
  const Ll = P.thigh_l && P.thigh_r ? P.thigh_l.clone().sub(P.thigh_r).normalize() : Lu.clone();
  const U = P.neck_01 && P.pelvis ? P.neck_01.clone().sub(P.pelvis).normalize() : new THREE.Vector3(0, 1, 0);
  const F = new THREE.Vector3().crossVectors(Lu, U).normalize();
  return { Lu, Ll, U, F };
}

// ---- the whole MHR skeleton, from Kimodo's SOMA 77 joints (motion.py preview keeps them as "soma:<Name>") -----------
// Chains pair MHR joints with SOMA joints; a null sits on SOMA's path between its chain's anchors at MHR's own arc
// fraction. Bones are then aimed joint to joint with a side axis from positions (palms, eyes, hips), so nothing
// depends on either rig's rotation conventions; MHR's twist bones share out the forearm, shin, arm and thigh twist.
const SIDE = [["l", "Left"], ["r", "Right"]];
export const SOMA_CHAINS = (() => {
  const ch = [
    [["root", "Hips"], ["c_spine0", null], ["c_spine1", null], ["c_spine2", null], ["c_spine3", "Chest"]],
    [["c_spine3", "Chest"], ["c_neck", "Neck1"], ["c_head", "Head"], ["c_head_null", "HeadEnd"]],
  ];
  for (const [m, s] of SIDE) {
    ch.push([[`${m}_clavicle`, `${s}Shoulder`], [`${m}_uparm`, `${s}Arm`], [`${m}_lowarm`, `${s}ForeArm`], [`${m}_wrist`, `${s}Hand`]]);
    ch.push([[`${m}_upleg`, `${s}Leg`], [`${m}_lowleg`, `${s}Shin`], [`${m}_foot`, `${s}Foot`], [`${m}_ball`, `${s}ToeBase`], [`${m}_ball_end`, `${s}ToeEnd`]]);
    ch.push([["c_head", "Head"], [`${m}_eye`, `${s}Eye`]]);
    for (const f of ["index", "middle", "ring"]) {
      const F = f[0].toUpperCase() + f.slice(1);
      ch.push([[`${m}_wrist`, `${s}Hand`], [`${m}_${f}1`, `${s}Hand${F}2`], [`${m}_${f}2`, `${s}Hand${F}3`], [`${m}_${f}3`, `${s}Hand${F}4`], [`${m}_${f}_null`, `${s}Hand${F}End`]]);
    }
    ch.push([[`${m}_wrist`, `${s}Hand`], [`${m}_pinky0`, `${s}HandPinky1`], [`${m}_pinky1`, `${s}HandPinky2`], [`${m}_pinky2`, `${s}HandPinky3`], [`${m}_pinky3`, `${s}HandPinky4`], [`${m}_pinky_null`, `${s}HandPinkyEnd`]]);
    ch.push([[`${m}_wrist`, `${s}Hand`], [`${m}_thumb0`, `${s}HandThumb1`], [`${m}_thumb1`, null], [`${m}_thumb2`, `${s}HandThumb2`], [`${m}_thumb3`, `${s}HandThumb3`], [`${m}_thumb_null`, `${s}HandThumbEnd`]]);
  }
  return ch;
})();
const FINGERS = ["index", "middle", "ring", "pinky"];
// [bone, the joint it aims at, its side axis], parents first
export const MHR_DRIVE = (() => {
  const d = [["root", "c_spine1", "low"], ["c_spine0", "c_spine1", "low"], ["c_spine1", "c_spine2", "low"], ["c_spine2", "c_spine3", "up"],
             ["c_spine3", "c_neck", "up"], ["c_neck", "c_head", "eyes"], ["c_head", "c_head_null", "eyes"]];
  for (const [m] of SIDE) {
    d.push([`${m}_clavicle`, `${m}_uparm`, "torso"], [`${m}_uparm`, `${m}_lowarm`, `elbow:${m}`], [`${m}_lowarm`, `${m}_wrist`, `elbow:${m}`],
           [`${m}_wrist`, `${m}_middle1`, `across:${m}`]);
    d.push([`${m}_upleg`, `${m}_lowleg`, `toes:${m}`], [`${m}_lowleg`, `${m}_foot`, `toes:${m}`], [`${m}_foot`, `${m}_ball`, "low"], [`${m}_ball`, `${m}_ball_end`, "low"]);
    for (const f of FINGERS) {
      const js = f === "pinky" ? ["pinky0", "pinky1", "pinky2", "pinky3", "pinky_null"] : [`${f}1`, `${f}2`, `${f}3`, `${f}_null`];
      for (let i = 0; i + 1 < js.length; i++) d.push([`${m}_${js[i]}`, `${m}_${js[i + 1]}`, `across:${m}`]);
    }
    for (const [a, b] of [["thumb0", "thumb1"], ["thumb1", "thumb2"], ["thumb2", "thumb3"], ["thumb3", "thumb_null"]]) d.push([`${m}_${a}`, `${m}_${b}`, `palm:${m}`]);
  }
  return d;
})();
function sideAxis(rule, P) {                      // the side axis a drive rule names, from joint positions
  const v = (a, b) => (P[a] && P[b] ? P[b].clone().sub(P[a]) : null);
  const [k, m] = rule.split(":");
  if (k === "low") return [v("r_upleg", "l_upleg")];
  if (k === "up") return [v("r_uparm", "l_uparm"), v("r_upleg", "l_upleg")];
  if (k === "eyes") return [v("r_eye", "l_eye"), v("r_uparm", "l_uparm")];
  if (k === "torso") return [v("c_spine0", "c_neck"), v("r_upleg", "l_upleg")];
  const across = v(`${m}_pinky1`, `${m}_index1`);
  if (k === "across") return [across, v("r_uparm", "l_uparm")];
  if (k === "palm") { const f = v(`${m}_wrist`, `${m}_middle1`); return [across && f ? new THREE.Vector3().crossVectors(across, f) : null, across]; }
  if (k === "toes") return [v(`${m}_foot`, `${m}_ball`), v("r_upleg", "l_upleg")];
  if (k === "elbow") {                            // the elbow's bend plane; a straight arm falls back to the palm
    const a = v(`${m}_uparm`, `${m}_lowarm`), b = v(`${m}_lowarm`, `${m}_wrist`);
    const n = a && b ? new THREE.Vector3().crossVectors(a, b) : null;
    return [n && n.length() > 0.2 * a.length() * b.length() ? n : null, across, v("r_uparm", "l_uparm")];
  }
  return [];
}
function swingTwist(q, axis) {                    // the twist part of q about a unit axis
  const p = new THREE.Vector3(q.x, q.y, q.z), d = p.dot(axis);
  const t = new THREE.Quaternion(axis.x * d, axis.y * d, axis.z * d, q.w);
  return t.lengthSq() < 1e-12 ? new THREE.Quaternion() : t.normalize();
}
// relaxed hands for blocked poses (degrees per finger joint, toward the palm); Kimodo motions bring their own
const CURL = { index: [6, 12, 8], middle: [10, 15, 10], ring: [14, 18, 12], pinky: [18, 20, 14] };

// ---- not clipping through yourself: elliptical capsules measured from this body's own (shaped) skin -----------
// The torso is two capsules (belly, chest) with separate width and depth, the head one; arms are pushed out of them
// by turning the upper arm about the shoulder and the forearm about the elbow, a few passes. Big bodies get big
// capsules, so a heavy character's arms hang wider. Hands locked to targets use a two-bone IK whose elbow swings
// away from the body (`reach`).
const BODY_CAPS = [["belly", "root", "c_spine2", ["root", "c_spine0", "c_spine1"]], ["chest", "c_spine2", "c_neck", ["c_spine2", "c_spine3"]],
                   ["head", "c_neck", "c_head_null", ["c_head"]]];
function closestOnSegment(p, a, b) {
  const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq())));
  return { t, q: a.clone().addScaledVector(ab, t) };
}

export class BodyFigure {
  constructor(lib, height, template, opts = {}) {
    this.lib = lib; this.height = height || 1.7;
    this.group = new THREE.Group();
    this.model = SkeletonUtils.clone(template);
    this.group.add(this.model);
    this.shaped = applyShape(this.model, opts.shape);
    const clay = new THREE.MeshStandardMaterial({ color: opts.color || 0xc9c0b2, roughness: 0.8, emissive: 0x120f0c });
    // squash: soft flesh (the "soft" attribute) gives way around the arms (four capsules, mesh space) instead of being
    // passed through; unclip() leaves the arms a little sunk in, and this shapes the flesh around them
    this.squash = { caps: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -100, 0, 0)), ends: [0, 1, 2, 3].map(() => new THREE.Vector3(0, -100, 0)) };
    const sq = this.squash;
    clay.onBeforeCompile = sh => {
      sh.uniforms.uSqA = { value: sq.caps }; sh.uniforms.uSqB = { value: sq.ends };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float soft;\nuniform vec4 uSqA[4];\nuniform vec3 uSqB[4];")
        .replace("#include <skinning_vertex>", `#include <skinning_vertex>
        for (int i = 0; i < 4; i++) {
          vec3 a = uSqA[i].xyz, b = uSqB[i]; float R = uSqA[i].w;
          if (R <= 0.0 || soft <= 0.0) continue;
          vec3 ab = b - a; float t = clamp(dot(transformed - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
          vec3 q = a + ab * t, d = transformed - q; float r = length(d);
          if (r < R && r > 1e-5) transformed = q + d / r * mix(r, R, soft);
        }`);
    };
    clay.customProgramCacheKey = () => "inkcel-squash";
    this.model.traverse(o => { if (o.isMesh) { if (!opts.keepMaterials) o.material = clay; o.frustumCulled = false; o.castShadow = false; } });
    this.skinMats = opts.keepMaterials ? [] : [clay];           // the materials the `skin` word wets (setWet)
    if (opts.keepMaterials) this.model.traverse(o => {      // a Studio export's skin, lit as the Studio lights it (its studioSkin; its maps: the relief, the roughness, the thinness)
      const m = o.isMesh && o.material, sk = m && m.userData && m.userData.studioSkin;
      if (sk && !m.userData.skinLit) { skinLit(m, { thin: "map" }); setSkinLit(m, sk); }
      if (sk && !this.skinMats.includes(m)) this.skinMats.push(m);
    });
    for (const m of this.skinMats) skinWet(m);
    const { map, missing } = mapBones(this.model);
    this.map = map; this.missing = missing;
    this.ok = missing.length <= 2;
    this.pos = null;
    this.setup();
    this.setupFull();
    if (this.mhr) this.setupCollision();
    this.reach = {};                             // side -> {target (figure space), w}: hands locked onto things
  }
  setup() {
    const m = this.model, map = this.map;
    m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1);
    m.updateMatrixWorld(true);
    // face the model the previs way (+Z forward, +X its left), then scale it to the cast member's height
    const wp = j => map[j] ? map[j].getWorldPosition(new THREE.Vector3()) : null;
    const P0 = {}; for (const j of Object.keys(map)) P0[j] = wp(j);
    const ax = axes(P0);                         // the model's own up (hips to neck) and left: files can come in Z-up
    const up = ax.U.clone().normalize(), left = ax.Lu.clone().addScaledVector(up, -ax.Lu.dot(up)).normalize();
    const fwd = new THREE.Vector3().crossVectors(left, up).normalize();
    const modelFrame = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(left, up, fwd));
    m.quaternion.copy(modelFrame.invert());
    m.updateMatrixWorld(true);
    // size from the bones, not the mesh box (a skinned mesh under a turned parent measures wrong): head to the lowest
    // foot bone, times the previs ratio of the whole height to the head joint's height
    const low = () => Math.min(...["ball_l", "ball_r", "foot_l", "foot_r"].map(j => map[j] ? wp(j).y : Infinity));
    const headY = map.head ? wp("head").y : null;
    const restHead = (() => { let y = 0, j = this.lib.joints[this.lib.index.head]; while (j) { y += j.off.y; j = j.parent ? this.lib.joints[this.lib.index[j.parent]] : null; } return y; })();
    const h = headY !== null && isFinite(low()) ? (headY - low()) * this.lib.height / restHead : 1.7;
    const s = this.height / (h || 1.7);
    m.scale.setScalar(s);
    m.updateMatrixWorld(true);
    const pel = map.pelvis ? wp("pelvis") : new THREE.Vector3();
    m.position.set(-pel.x, -low(), -pel.z);
    m.updateMatrixWorld(true);
    // rest data, in the figure's own space (the group sits at the origin here)
    this.rest = {};
    const P = {}; for (const j of Object.keys(map)) P[j] = wp(j);
    this.restAxes = axes(P);
    for (const [j, b] of Object.entries(map)) {
      const q = b.getWorldQuaternion(new THREE.Quaternion());
      let dir = null;
      const aim = AIM[j];
      if (aim && map[aim]) dir = P[map[aim] && aim].clone().sub(P[j]);
      else if (j === "head" || j === "neck_01") dir = new THREE.Vector3(0, 1, 0);
      else if (j.startsWith("hand_")) dir = P[j].clone().sub(P[j.replace("hand", "lowerarm")] || P[j]);
      else if (j.startsWith("ball_")) dir = null;
      this.rest[j] = { q, dir: dir && dir.length() > 1e-5 ? dir.normalize() : null };
    }
    for (const [j, r] of Object.entries(this.rest)) if (r.dir) r.frame = frame(r.dir, this.secondaries(j, this.restAxes));
    // the previs skeleton's own rest (zero rotations), for the trunk: its bones are turned by how far the previs bone
    // turned from ITS rest, so the body keeps its own spine curve (aiming would straighten MHR's S-curve and tip the
    // pelvis: MHR's pelvis-to-spine joint points backwards, the previs one straight up)
    const SP = {}, sc = this.height / this.lib.height;
    for (const jn of this.lib.joints) SP[jn.name] = jn.parent ? SP[jn.parent].clone().add(jn.off.clone().multiplyScalar(sc)) : jn.off.clone().multiplyScalar(sc);
    this.srcFrame = {};
    const sax = axes(SP);
    for (const j of TRUNK) if (AIM[j] && SP[j] && SP[AIM[j]]) this.srcFrame[j] = frame(SP[AIM[j]].clone().sub(SP[j]), this.secondaries(j, sax));
  }
  secondaries(j, ax) {
    if (ARM.test(j)) return [ax.F, ax.U];
    if (UPPER.has(j)) return [ax.Lu, ax.F];
    return [ax.Ll, ax.F];
  }
  setupFull() {                                  // rest data for driving every MHR bone (only MHR rigs have them)
    const bones = {}; this.model.traverse(o => { if (o.isBone) bones[o.name] = o; });
    this.all = bones;
    this.mhr = !!(bones.c_spine3 && bones.l_index1 && bones.l_wrist);
    if (!this.mhr) return;
    this.model.updateMatrixWorld(true);
    this.restLocal = {}; this.restWorldQ = {}; this.restPos = {};
    for (const [n, b] of Object.entries(bones)) {
      this.restLocal[n] = b.quaternion.clone();
      this.restWorldQ[n] = b.getWorldQuaternion(new THREE.Quaternion());
      this.restPos[n] = b.getWorldPosition(new THREE.Vector3());
    }
    for (const [m] of SIDE) {                     // a virtual toe end: MHR's ball has no child
      const ball = this.restPos[`${m}_ball`], tt = this.restPos[`${m}_transversetarsal`];
      if (ball && tt) this.restPos[`${m}_ball_end`] = ball.clone().add(ball.clone().sub(tt).setY(0).setLength(0.06 * this.height / 1.7));
    }
    this.restFrame = {};
    for (const [bone, aim, rule] of MHR_DRIVE) {
      const a = this.restPos[bone], b = this.restPos[aim];
      if (a && b) this.restFrame[bone] = frame(b.clone().sub(a), sideAxis(rule, this.restPos));
    }
    // arc fractions of SOMA-less chain joints between their anchors, on MHR's own rest
    this.chainT = {};
    for (const ch of SOMA_CHAINS) for (let i = 0; i < ch.length; i++) {
      if (ch[i][1]) continue;
      let a = i - 1, b = i + 1; while (a > 0 && !ch[a][1]) a--; while (b < ch.length - 1 && !ch[b][1]) b++;
      const len = (x, y) => { let L = 0; for (let k = x; k < y; k++) L += this.restPos[ch[k][0]] && this.restPos[ch[k + 1][0]] ? this.restPos[ch[k][0]].distanceTo(this.restPos[ch[k + 1][0]]) : 0; return L; };
      this.chainT[ch[i][0]] = { from: ch[a][1], to: ch[b][1], t: len(a, i) / Math.max(1e-6, len(a, b)) };
    }
    // finger curl axes in each finger bone's own space, toward the palm
    this.curlAxis = {};
    for (const [m] of SIDE) {
      const across = this.restPos[`${m}_index1`].clone().sub(this.restPos[`${m}_pinky1`]).normalize();
      const fwd = this.restPos[`${m}_middle1`].clone().sub(this.restPos[`${m}_wrist`]);
      let palm = new THREE.Vector3().crossVectors(across, fwd).normalize();
      const thumb = this.restPos[`${m}_thumb_null`].clone().sub(this.restPos[`${m}_middle1`]);
      if (thumb.dot(palm) < 0) palm.negate();     // the palm faces the thumb's side
      for (const f of FINGERS) for (const j of [1, 2, 3]) {
        const n = `${m}_${f}${j}`, next = j < 3 ? `${m}_${f}${j + 1}` : `${m}_${f}_null`;
        if (!this.restPos[n] || !this.restPos[next]) continue;
        const d = this.restPos[next].clone().sub(this.restPos[n]);
        const ax = new THREE.Vector3().crossVectors(d, palm).normalize().negate();   // d x palm turns the tip toward the palm
        if (new THREE.Vector3().crossVectors(ax, d).dot(palm) < 0) ax.negate();
        this.curlAxis[n] = ax.applyQuaternion(this.restWorldQ[n].clone().invert());
      }
    }
  }
  setupCollision() {                             // capsule sizes from the rest skin (morphs and all), in figure space
    const mesh = (() => { let m = null; this.model.traverse(o => { if (!m && o.isSkinnedMesh) m = o; }); return m; })();
    if (!mesh || !this.mhr) return;
    this.model.updateMatrixWorld(true); mesh.skeleton.update();
    const SI = mesh.geometry.attributes.skinIndex, SW = mesh.geometry.attributes.skinWeight, n = SI.count;
    const bi = new Map(mesh.skeleton.bones.map((b, i) => [b.name, i]));
    const v = new THREE.Vector3(), pts = [], dom = [];
    for (let i = 0; i < n; i += 2) {             // every other corner is plenty
      mesh.getVertexPosition(i, v); pts.push(v.clone().applyMatrix4(mesh.matrixWorld));
      let best = -1, bw = 0; for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > bw) { bw = w; best = SI.getComponent(i, k); } }
      dom.push(best);
    }
    if (!mesh.geometry.attributes.soft) {          // how soft each corner is: trunk flesh (spine, pelvis), not limbs or bone
      const soft = new Float32Array(SI.count), trunk = new Set(["root", "c_spine0", "c_spine1", "c_spine2", "c_spine3"].map(x => bi.get(x)));
      for (let i = 0; i < SI.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (trunk.has(SI.getComponent(i, k))) w += SW.getComponent(i, k); soft[i] = Math.min(1, w) * 0.85; }
      mesh.geometry.setAttribute("soft", new THREE.BufferAttribute(soft, 1));
    }
    this.skinMesh = mesh;
    const P = this.restPos, left = P.l_upleg.clone().sub(P.r_upleg).normalize();
    const pct = (arr, q) => { if (!arr.length) return 0; const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; };
    this.caps = [];
    for (const [name, a, b, bones] of BODY_CAPS) {
      if (!P[a] || !P[b]) continue;
      const ids = new Set(bones.map(x => bi.get(x)).filter(x => x !== undefined));
      const axis = P[b].clone().sub(P[a]).normalize(), fwd = new THREE.Vector3().crossVectors(left, axis).normalize(), side = new THREE.Vector3().crossVectors(axis, fwd);
      const xs = [], zs = [];
      pts.forEach((p, k) => {
        if (!ids.has(dom[k])) return;
        const { t, q } = closestOnSegment(p, P[a], P[b]); if (t <= 0.02 || t >= 0.98) return;
        const d = p.clone().sub(q); xs.push(d.dot(side)); zs.push(d.dot(fwd));
      });
      // the spine runs near the back: centre the capsule in the body (front-to-back), then size it
      const cz = (pct(zs, 0.95) + pct(zs, 0.05)) / 2;
      this.caps.push({ name, a, b, cz, rx: pct(xs.map(Math.abs), 0.8), rz: pct(zs.map(z => Math.abs(z - cz)), 0.8) });
    }
    const limb = (bones) => { const ids = new Set(bones.map(x => bi.get(x)).filter(x => x !== undefined)); return ids; };
    this.limbR = {};
    for (const [m] of SIDE) for (const [seg, a, b, bones] of [["up", `${m}_uparm`, `${m}_lowarm`, [0, 1, 2, 3, 4].map(k => `${m}_uparm_twist${k}_proc`)],
                                                              ["low", `${m}_lowarm`, `${m}_wrist`, [1, 2, 3, 4].map(k => `${m}_lowarm_twist${k}_proc`).concat([`${m}_wrist_twist`])]]) {
      const ids = limb(bones), ds = [];
      pts.forEach((p, k) => { if (ids.has(dom[k])) { const { t, q } = closestOnSegment(p, P[a], P[b]); if (t > 0.1 && t < 0.9) ds.push(p.distanceTo(q)); } });
      this.limbR[`${m}_${seg}`] = pct(ds, 0.6);
    }
  }
  capsuleFrame(c) {                              // a body capsule's current ends and axes (figure space)
    const W = n => this.group.worldToLocal(this.all[n].getWorldPosition(new THREE.Vector3()));
    const a = W(c.a), b = W(c.b), axis = b.clone().sub(a).normalize();
    const left = W("l_upleg").sub(W("r_upleg"));
    const fwd = new THREE.Vector3().crossVectors(left, axis).normalize(), side = new THREE.Vector3().crossVectors(axis, fwd);
    return { a: a.addScaledVector(fwd, c.cz || 0), b: b.addScaledVector(fwd, c.cz || 0), side, fwd };
  }
  unclip(passes = 3) {                           // push the arms out of the torso and head
    if (!this.caps || !this.caps.length) return;
    const W = n => this.group.worldToLocal(this.all[n].getWorldPosition(new THREE.Vector3()));
    for (let it = 0; it < passes; it++) {
      const frames = this.caps.map(c => [c, this.capsuleFrame(c)]);
      let moved = false;
      // the upper arm only meets the belly (it hangs against the chest and armpit by nature); the forearm meets both.
      // Skin is soft: limbs may sink a little (60 % of their radius) before they count as clipping
      for (const [m] of SIDE) for (const [bone, child, seg, hit, ts] of [[`${m}_uparm`, `${m}_lowarm`, "up", ["belly"], [0.6, 0.8, 1.0]],
                                                                         [`${m}_lowarm`, `${m}_wrist`, "low", ["belly", "chest", "head"], [0.35, 0.6, 0.85, 1.0]]]) {
        const A = W(bone), B = W(child), ra = 0.6 * (this.limbR[`${m}_${seg}`] || 0.04);
        let push = new THREE.Vector3();
        for (const [c, f] of frames) {
          if (!hit.includes(c.name)) continue;
          for (const t of ts) {
            const p = A.clone().lerp(B, t), { q } = closestOnSegment(p, f.a, f.b);
            const d = p.clone().sub(q), x = d.dot(f.side), z = d.dot(f.fwd), r = Math.hypot(x, z);
            if (r < 1e-6) continue;
            const ang = Math.atan2(z, x), re = 1 / Math.sqrt((Math.cos(ang) / Math.max(c.rx, 1e-3)) ** 2 + (Math.sin(ang) / Math.max(c.rz, 1e-3)) ** 2);
            const pen = re + ra - r;
            if (pen > 0.002 && pen / t > push.length()) {        // the deepest contact decides (summing over-pushes)
              push = f.side.clone().multiplyScalar(x).addScaledVector(f.fwd, z).normalize().multiplyScalar(pen / t);
            }
          }
        }
        if (push.lengthSq() < 1e-8) continue;
        const from = B.clone().sub(A), to = from.clone().add(push.clampLength(0, 0.1)).setLength(from.length());
        this.turnBone(bone, from, to);
        moved = true;
      }
      if (!moved) break;
    }
  }
  turnBone(name, fromDir, toDir) {               // turn a bone in figure space so fromDir becomes toDir
    const b = this.all[name] || this.map[name]; if (!b) return;
    const gq = this.group.getWorldQuaternion(new THREE.Quaternion());
    const d = new THREE.Quaternion().setFromUnitVectors(fromDir.clone().normalize(), toDir.clone().normalize());
    const dw = gq.clone().multiply(d).multiply(gq.clone().invert());               // into world
    const world = dw.multiply(b.getWorldQuaternion(new THREE.Quaternion()));
    b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
    b.updateMatrixWorld(true);
  }
  reachTo(side, target, w = 1) {                 // two-bone IK: the wrist onto target (figure space), elbow away from the body
    const m = side === "left" || side === "l" ? "l" : "r";
    const up = this.all ? this.all[`${m}_uparm`] : null, low = this.all ? this.all[`${m}_lowarm`] : null, wr = this.all ? this.all[`${m}_wrist`] : null;
    const U = up || this.map[`upperarm_${m}`], L = low || this.map[`lowerarm_${m}`], H = wr || this.map[`hand_${m}`];
    if (!U || !L || !H || w <= 0) return;
    const P = o => this.group.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
    const S = P(U), E = P(L), Wp = P(H), a = S.distanceTo(E), b = E.distanceTo(Wp);
    const T = Wp.clone().lerp(target, Math.min(1, w));
    const d = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, S.distanceTo(T)));
    const dir = T.clone().sub(S).normalize();
    // the elbow's swing: keep the current bend plane, nudged outward and down (away from the torso)
    const outward = new THREE.Vector3(m === "l" ? 1 : -1, -0.6, -0.3).normalize();
    let pole = E.clone().sub(S).addScaledVector(dir, -E.clone().sub(S).dot(dir)).normalize().lerp(outward, 0.5);
    pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
    const E2 = S.clone().addScaledVector(dir, x).addScaledVector(pole, h), W2 = S.clone().addScaledVector(dir, d);
    this.turnBone(U.name, E.clone().sub(S), E2.clone().sub(S));
    const E3 = P(L), Wn = P(H);
    this.turnBone(L.name, Wn.clone().sub(E3), W2.clone().sub(E3));
  }
  static somaHeight(soma) { return soma && soma.rest ? soma.rest[soma.names.indexOf("HeadEnd")][1] : 1.759; }
  somaToMhr(pos) {                               // "soma:<Name>" positions -> MHR joint positions (figure space)
    const S = n => pos["soma:" + n];
    const out = {};
    for (const ch of SOMA_CHAINS) for (const [mn, sn] of ch) if (sn && S(sn)) out[mn] = S(sn).clone();
    for (const [mn, c] of Object.entries(this.chainT)) {
      const path = this.somaPath(c.from, c.to).map(S);
      if (path.some(p => !p)) continue;
      let L = 0; for (let k = 0; k + 1 < path.length; k++) L += path[k].distanceTo(path[k + 1]);
      let want = c.t * L;
      for (let k = 0; k + 1 < path.length; k++) {
        const seg = path[k].distanceTo(path[k + 1]);
        if (want <= seg || k + 2 === path.length) { out[mn] = path[k].clone().lerp(path[k + 1], seg > 1e-9 ? Math.min(1, want / seg) : 0); break; }
        want -= seg;
      }
    }
    return out;
  }
  somaPath(a, b) {                               // SOMA joints from a down to b (b a descendant of a)
    const soma = BodyFigure.soma; if (!soma) return [a, b];
    const out = [b]; let n = b;
    while (n && n !== a) { n = soma.parents[soma.names.indexOf(n)]; if (n) out.push(n); }
    return n === a ? out.reverse() : [a, b];
  }
  updateFull(P) {                                // every MHR bone from MHR-named joint positions (figure space)
    if (!this.somaRestFrame && BodyFigure.soma) {  // SOMA's own rest, for the trunk (as the previs path does)
      const R = {}; BodyFigure.soma.names.forEach((n, i) => { R["soma:" + n] = new THREE.Vector3(...BodyFigure.soma.rest[i]); });
      const Q = this.somaToMhr(R);
      this.somaRestFrame = {};
      for (const [bone, aim, rule] of MHR_DRIVE) if (TRUNK_MHR.has(bone) && Q[bone] && Q[aim]) this.somaRestFrame[bone] = frame(Q[aim].clone().sub(Q[bone]), sideAxis(rule, Q));
    }
    const gq = this.group.getWorldQuaternion(new THREE.Quaternion()), gqi = gq.clone().invert();
    const root = this.all.root;
    if (P.root) { root.position.copy(root.parent.worldToLocal(this.group.localToWorld(P.root.clone()))); }
    for (const [bone, aim, rule] of MHR_DRIVE) {
      const b = this.all[bone], rf = this.restFrame[bone];
      if (!b || !rf || !P[bone] || !P[aim]) continue;
      const dir = P[aim].clone().sub(P[bone]);
      if (dir.lengthSq() < 1e-10) continue;
      const base = TRUNK_MHR.has(bone) && this.somaRestFrame ? this.somaRestFrame[bone] || rf : rf;
      const want = frame(dir, sideAxis(rule, P)).multiply(base.clone().invert()).multiply(this.restWorldQ[bone]);
      const parentQ = gqi.clone().multiply(b.parent.getWorldQuaternion(new THREE.Quaternion()));
      b.quaternion.copy(parentQ.invert().multiply(want));
      b.updateMatrixWorld(true);
    }
    this.shareTwist();
  }
  shareTwist() {                                 // MHR's twist bones carry the skin: spread each limb's roll along them
    const tw = (parent, child, prefix, n, inward) => {
      const p = this.all[parent], c = this.all[child]; if (!p || !c) return;
      // the limb's axis in the parent's own frame (rest), and the roll about it, as a rotation in that frame
      const axis = this.restPos[child].clone().sub(this.restPos[parent]).applyQuaternion(this.restWorldQ[parent].clone().invert()).normalize();
      let q;
      if (inward) {                              // the bone's own roll since rest, undone toward its root
        q = swingTwist(this.restLocal[parent].clone().invert().multiply(p.quaternion), axis).invert();
      } else {                                   // the child's roll relative to the bone, shared toward the child
        const W = o => o.getWorldQuaternion(new THREE.Quaternion());
        const rel = W(p).invert().multiply(W(c)), rest = this.restWorldQ[parent].clone().invert().multiply(this.restWorldQ[child]);
        q = swingTwist(rel.multiply(rest.invert()), axis);
      }
      for (let k = 0; k <= n; k++) {
        const t = this.all[`${prefix}${k}_proc`]; if (!t) continue;
        const f = inward ? 1 - k / n : k / (n + 1);
        t.quaternion.copy(new THREE.Quaternion().slerp(q, f).multiply(this.restLocal[t.name]));
      }
    };
    for (const [m] of SIDE) {
      tw(`${m}_lowarm`, `${m}_wrist`, `${m}_lowarm_twist`, 4, false);
      tw(`${m}_lowleg`, `${m}_foot`, `${m}_lowleg_twist`, 4, false);
      tw(`${m}_uparm`, `${m}_lowarm`, `${m}_uparm_twist`, 4, true);
      tw(`${m}_upleg`, `${m}_lowleg`, `${m}_upleg_twist`, 4, true);
    }
    tw("c_neck", "c_head", "c_neck_twist", 1, true);
    this.model.updateMatrixWorld(true);
  }
  curlFingers(curl = CURL) {                     // relaxed hands on blocked poses
    for (const [m] of SIDE) for (const f of FINGERS) for (const j of [1, 2, 3]) {
      const n = `${m}_${f}${j}`, b = this.all[n], ax = this.curlAxis[n];
      if (!b || !ax) continue;
      b.quaternion.copy(this.restLocal[n]).multiply(new THREE.Quaternion().setFromAxisAngle(ax, curl[f][j - 1] * Math.PI / 180));
    }
    this.model.updateMatrixWorld(true);
  }
  setWet(s) { for (const m of this.skinMats) setSkinWet(m, s); }     // the `skin` word: {wet, sweat, drips, oil} (skinwet.js)
  get wet() { return this.skinMats.length ? wetOf(this.skinMats[0]) : null; }
  setColor(c) { this.model.traverse(o => { if (o.isMesh && o.material && o.material.color) o.material.color.set(c); }); }
  update(pos) {                                  // pos: previs joint -> Vector3 in character space (+ "soma:" joints)
    this.pos = pos;
    if (!this.ok) return;
    if (this.mhr && pos["soma:Hips"] && pos["soma:LeftHandIndexEnd"]) { this.updateFull(this.somaToMhr(pos)); this.afterPose(); return; }
    const ax = axes(pos), gq = this.group.getWorldQuaternion(new THREE.Quaternion()), gqi = gq.clone().invert();
    const pel = this.map.pelvis;
    if (pel && pos.pelvis) {                     // put the hips where the previs hips are
      const w = this.group.localToWorld(pos.pelvis.clone());
      pel.position.copy(pel.parent.worldToLocal(w));
    }
    for (const j of this.lib.joints.map(x => x.name)) {
      const b = this.map[j], r = this.rest[j];
      if (!b || !r || !r.frame) continue;
      const aim = AIM[j];
      let dir = null;
      if (aim && pos[aim] && pos[j]) dir = pos[aim].clone().sub(pos[j]);
      if (!dir || dir.length() < 1e-5) continue;
      let sec = this.secondaries(j, ax);
      if ((j === "head" || j === "neck_01") && pos.head_side && pos.head) {        // the look layer's turn
        const hs = pos.head_side.clone().sub(pos.head).normalize();
        sec = [j === "head" ? hs : hs.add(ax.Lu).normalize(), ax.F];
      }
      const tf = frame(dir, sec);
      const base = this.srcFrame[j] || r.frame;                                  // trunk: the previs bone's turn from its rest
      const want = tf.multiply(base.clone().invert()).multiply(r.q);             // limbs: aimed like the previs bone
      const parentQ = gqi.clone().multiply(b.parent.getWorldQuaternion(new THREE.Quaternion()));
      b.quaternion.copy(parentQ.invert().multiply(want));
      b.updateMatrixWorld(true);
    }
    if (this.mhr) { this.curlFingers(); this.shareTwist(); }
    this.afterPose();
  }
  afterPose() {                                  // the IK layer on top of the animation: reaches, then no clipping
    for (const [side, r] of Object.entries(this.reach || {})) if (r && r.target) this.reachTo(side, r.target, r.w ?? 1);
    if (this.mhr && !this.noUnclip) { this.unclip(); this.shareTwist(); }
    if (this.mhr && this.skinMesh && this.squash) {        // the arms, in the mesh's own space, for the flesh to give around
      const M = this.skinMesh, Wl = n => M.worldToLocal(this.all[n].getWorldPosition(new THREE.Vector3()));
      const k = 1 / M.getWorldScale(new THREE.Vector3()).x;
      [["l", "uparm", "lowarm", "up"], ["l", "lowarm", "wrist", "low"], ["r", "uparm", "lowarm", "up"], ["r", "lowarm", "wrist", "low"]].forEach(([m, a, b, seg], i) => {
        const B = Wl(`${m}_${b}`), A = Wl(`${m}_${a}`).lerp(B, seg === "up" ? 0.35 : 0);    // not the shoulder: the armpit stays
        const R = (this.limbR[`${m}_${seg}`] || 0.04) * k * (this.noSquash ? 0 : 1);
        this.squash.caps[i].set(A.x, A.y, A.z, R); this.squash.ends[i].copy(B);
      });
    }
  }
  jointWorld(name) { const p = this.pos && this.pos[name]; return p ? this.group.localToWorld(p.clone()) : null; }
  headWorld() { return this.jointWorld("head") ? this.jointWorld("head").lerp(this.jointWorld("head_end"), 0.4) : this.group.position.clone().setY(1.55); }
  // where the model's own joints ended up, for checking the retarget against the previs
  modelJointWorld(name) { const b = this.map[name]; return b ? b.getWorldPosition(new THREE.Vector3()) : null; }
}

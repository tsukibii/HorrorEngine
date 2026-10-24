// Motion maths for the director: the previs skeleton, poses, blocking keys, easing, modifiers (time remaps), fitting a
// motion to its take, and blending between clips. Pure functions over three.js maths; stage.js draws what these return.
import * as THREE from "three";

const D2R = Math.PI / 180;
export const SIDES = [["_l", "_r"]];

export function loadLibrary(json) {
  const joints = json.skeleton.joints.map(([name, parent, off]) => ({ name, parent, off: new THREE.Vector3(...off) }));
  const index = Object.fromEntries(joints.map((j, i) => [j.name, i]));
  const poses = {};
  for (const [name, p] of Object.entries(json.poses)) poses[name] = compilePose(p, joints);
  return { joints, index, poses, height: json.skeleton.height, names: Object.keys(json.poses) };
}

function compilePose(p, joints) {
  const q = {};
  for (const j of joints) {
    const e = p[j.name];
    q[j.name] = e ? new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0] * D2R, e[1] * D2R, e[2] * D2R, "XYZ")) : new THREE.Quaternion();
  }
  const rr = p.root_rot || [0, 0, 0];
  return {
    q, root: new THREE.Vector3(...(p.root || [0, 0, 0])), yaw: (p.yaw || 0) * D2R,
    rootRot: new THREE.Quaternion().setFromEuler(new THREE.Euler(rr[0] * D2R, rr[1] * D2R, rr[2] * D2R, "XYZ")),
    move: new THREE.Vector3(),   // world-ish travel from the stage mark (character space), set by blocking keys
  };
}

export function clonePose(p) {
  const q = {};
  for (const k in p.q) q[k] = p.q[k].clone();
  return { q, root: p.root.clone(), yaw: p.yaw, rootRot: p.rootRot.clone(), move: p.move.clone() };
}

export function mixPose(a, b, w) {
  const out = clonePose(a);
  for (const k in out.q) out.q[k].slerp(b.q[k], w);
  out.root.lerp(b.root, w);
  out.yaw = a.yaw + (b.yaw - a.yaw) * w;
  out.rootRot.slerp(b.rootRot, w);
  out.move.lerp(b.move, w);
  return out;
}

// ---- easing (Blender-style interpolation between keys) --------------------------------------------------------
export const EASES = {
  linear: u => u,
  in: u => u * u * u,
  out: u => 1 - Math.pow(1 - u, 3),
  inout: u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2,
  snap: u => u < 0.82 ? 0.08 * (u / 0.82) : 0.08 + 0.92 * Math.pow((u - 0.82) / 0.18, 0.5),  // creep, then a sudden jump
  hold: u => u < 1 ? 0 : 1,                                                                   // stay, then cut
  overshoot: u => { const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); },
};
export const EASE_NAMES = Object.keys(EASES);

// ---- blocking: pose keys along the clip -------------------------------------------------------------------------
// keys: [{at: 0..1 | s: seconds, pose, ease, walk, move: [dx,dz] character space metres (resolved by the stage)}]
export function evalBlock(lib, keys, t, dur, startMove) {
  // keys may carry a resolved `moveVec` (not enumerable, so it never lands in story.json): copy it explicitly
  const ks = (keys || []).map(k => ({ ...k, moveVec: k.moveVec ? k.moveVec.clone() : null, t: k.s !== undefined ? +k.s : (+k.at || 0) * dur })).sort((a, b) => a.t - b.t);
  if (!ks.length) return clonePose(lib.poses.idle || lib.poses.tpose);
  const P = k => {
    const p = clonePose(lib.poses[k.pose] || lib.poses.idle);
    if (k.moveVec) p.move.copy(k.moveVec);
    return p;
  };
  // carry each key's travel forward so a later key without `move` stays where the last one went
  let carry = startMove ? startMove.clone() : new THREE.Vector3();      // where the last clip left the actor
  for (const k of ks) { if (k.moveVec) carry = k.moveVec.clone(); else k.moveVec = carry.clone(); }
  if (t <= ks[0].t) return P(ks[0]);
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i], b = ks[i + 1];
    if (t <= b.t) {
      const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      const w = (EASES[b.ease] || EASES.inout)(Math.min(1, Math.max(0, u)));
      let p = mixPose(P(a), P(b), w);
      if (b.walk) {                            // the stride eases in as a walk sets off and out as it arrives (not a snap of the legs)
        const n = ks[i + 2], fi = a.walk ? 1 : (t - a.t) / WALK_FADE, fo = n && n.walk ? 1 : (b.t - t) / WALK_FADE;
        p = walkOverlay(lib, p, t, Math.max(0, Math.min(1, fi, fo)));
      }
      p.move.copy(a.moveVec).lerp(b.moveVec, b.walk ? u : w);
      return p;
    }
  }
  return P(ks[ks.length - 1]);
}

const WALK_FADE = 0.3;                          // seconds the blocking's stride takes to ease in and out
export function walkOverlay(lib, p, t, w = 1) {
  const phase = (Math.sin(t * Math.PI * 1.8 * 2) + 1) / 2;   // ~1.8 steps a second
  const stride = mixPose(lib.poses.walk_a, lib.poses.walk_b, phase);
  const out = clonePose(p);
  for (const j of ["thigh_l", "calf_l", "thigh_r", "calf_r", "upperarm_l", "upperarm_r"]) out.q[j].slerp(stride.q[j], w);
  return out;
}

// ---- forward kinematics: a pose -> joint positions in character space (metres, scaled to the cast's height) ----
export function fk(lib, pose, height) {
  const s = (height || lib.height) / lib.height;
  const Y = new THREE.Vector3(0, 1, 0);
  const yawQ = new THREE.Quaternion().setFromAxisAngle(Y, pose.yaw);
  const base = yawQ.clone().multiply(pose.rootRot);          // the whole body: turned, then tipped (lying down)
  const world = {}, rot = {};
  for (const j of lib.joints) {
    if (!j.parent) {
      rot[j.name] = base.clone().multiply(pose.q[j.name]);
      world[j.name] = j.off.clone().add(pose.root.clone().applyQuaternion(yawQ));
      continue;
    }
    const pr = rot[j.parent];
    world[j.name] = j.off.clone().applyQuaternion(pr).add(world[j.parent]);
    rot[j.name] = pr.clone().multiply(pose.q[j.name]);
  }
  for (const k in world) world[k].multiplyScalar(s).add(pose.move);   // the body to the cast member's height; the travel stays metres (a mark is where it is)
  return { pos: world, rot };
}

// ---- baked motion files (Kimodo -> motion.py preview): positions per frame -------------------------------------
export function sampleBaked(file, u) {
  const n = file.pos.length;
  const f = Math.min(n - 1, Math.max(0, u * (n - 1)));
  const i = Math.floor(f), w = f - i, j = Math.min(n - 1, i + 1);
  const pos = {};
  file.joints.forEach((name, k) => {
    const a = file.pos[i][k], b = file.pos[j][k];
    pos[name] = new THREE.Vector3(a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w);
  });
  return { pos };
}

// ---- modifiers: time remaps on normalised clip time u (0..1) -> source time (0..1) ----------------------------
// ease {in, out}: Bezier time curve; speed {x}; ramp {from, to}; hold {at, secs}; snap {at, secs}; twitch {amount};
// trim {in, out}; loop {from, to}; mirror (handled on poses).
function bezier(u, a, b) {     // a cubic Bezier time curve with handles (a,0) and (1-b,1), solved for x = u
  let lo = 0, hi = 1, t = u;
  for (let i = 0; i < 24; i++) {
    t = (lo + hi) / 2;
    const x = 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * (1 - b) + t * t * t;
    if (x < u) lo = t; else hi = t;
  }
  return 3 * (1 - t) * t * t + t * t * t;
}
function rand(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

export function remap(mods, u, dur) {
  let s = u;
  for (const m of mods || []) {
    const D = dur || 1;
    if (m.type === "ease") s = bezier(s, Math.min(0.9, (+m.in || 0) / D * 2.5), Math.min(0.9, (+m.out || 0) / D * 2.5));
    else if (m.type === "speed") s = Math.min(1, s * (+m.x || 1));
    else if (m.type === "ramp") { const a = +m.from || 1, b = +m.to || 1; s = Math.min(1, (a * s + (b - a) * s * s / 2) / ((a + b) / 2)); }
    else if (m.type === "hold") { const at = +m.at || 0, h = Math.min(0.9, (+m.secs || 0) / D);
      s = s < at ? s * at / Math.max(1e-6, at) : s < at + h ? at : at + (s - at - h) * (1 - at) / Math.max(1e-6, 1 - at - h); }
    else if (m.type === "snap") { const at = +m.at || 0.5, f = Math.min(0.5, (+m.secs || 0.12) / D);
      s = s < 1 - f ? at * (s / (1 - f)) : at + (1 - at) * EASES.out((s - (1 - f)) / f); }
    else if (m.type === "twitch") { const amt = +m.amount || 0.3, step = 0.12 / D, k = Math.floor(s / step);
      if (rand(k) < amt) s = k * step; else s = Math.min(1, s + (rand(k + 7) - 0.5) * amt * step); }
    else if (m.type === "trim") s = (+m.in || 0) + s * ((m.out ?? 1) - (+m.in || 0));
    else if (m.type === "loop") { const a = +m.from || 0, b = m.to ?? 1, span = Math.max(1e-3, b - a);
      if (s > a) s = a + ((s - a) * (+m.times || 2)) % span; }
  }
  return Math.min(1, Math.max(0, s));
}
export const MOD_TYPES = { ease: ["in", "out"], speed: ["x"], ramp: ["from", "to"], hold: ["at", "secs"], snap: ["at", "secs"],
  twitch: ["amount"], trim: ["in", "out"], loop: ["from", "to", "times"], mirror: [] };

// fitting a baked motion of srcSecs into a clip of dur seconds
export function fitTime(fit, u, dur, srcSecs) {
  if (!srcSecs) return u;
  const r = dur / srcSecs;          // >1: the take is longer than the motion
  switch (fit || "stretch") {
    case "hold": return Math.min(1, u * r);
    case "loop": return (u * r) % 1;
    case "pad": return Math.max(0, (u * dur - (dur - srcSecs)) / srcSecs);
    case "trim": return Math.min(1, u * r);
    default: return u;              // stretch: play the whole motion over the clip
  }
}
export const FITS = ["stretch", "hold", "loop", "pad", "trim"];

export function mirrorPositions(pos) {
  const out = {};
  for (const [k, v] of Object.entries(pos)) {
    const m = k.endsWith("_l") ? k.slice(0, -2) + "_r" : k.endsWith("_r") ? k.slice(0, -2) + "_l" :
      k.startsWith("soma:Left") ? "soma:Right" + k.slice(9) : k.startsWith("soma:Right") ? "soma:Left" + k.slice(10) : k;
    out[m] = new THREE.Vector3(-v.x, v.y, v.z);
  }
  return out;
}

// blend two position sets, then put bone lengths back (lerped positions shrink limbs)
export function blendPositions(lib, a, b, w, height) {
  const out = {};
  for (const j of lib.joints) {
    if (!a[j.name] || !b[j.name]) continue;
    out[j.name] = a[j.name].clone().lerp(b[j.name], w);
  }
  for (const k of Object.keys(a)) if (k.startsWith("soma:") && b[k]) out[k] = a[k].clone().lerp(b[k], w);   // Kimodo's full skeleton
  return keepBones(lib, out, height, a, b, w);
}
// an inertial blend (as Unreal's Inertialization): the incoming motion plays at full speed from its first frame, and
// the difference at the join (where the last motion left the body, `from`, against where this one starts, `start`)
// fades out over the blend; a crossfade from a held pose drags the new motion back while it lasts
export function inertialBlend(lib, from, start, pos, w, height) {
  const out = {}, k = 1 - w;
  for (const n in pos) out[n] = from[n] && start[n] ? pos[n].clone().addScaledVector(from[n].clone().sub(start[n]), k) : pos[n].clone();
  return keepBones(lib, out, height, from, pos, w);
}
// the previs bones back to their lengths after a blend: a's and b's own, w of the way (a Kimodo body's proportions
// aren't the previs skeleton's), the skeleton's scaled to the height where neither has the bone
function keepBones(lib, out, height, a, b, w) {
  const s = (height || lib.height) / lib.height, len = (P, j) => P && P[j.name] && P[j.parent] ? P[j.name].distanceTo(P[j.parent]) : null;
  for (const j of lib.joints) {
    if (!j.parent || !out[j.name] || !out[j.parent]) continue;
    const la = len(a, j), lb = len(b, j), l = la !== null && lb !== null ? la + (lb - la) * w : la ?? lb ?? j.off.length() * s;
    const d = out[j.name].clone().sub(out[j.parent]);
    if (d.length() > 1e-6) out[j.name] = out[j.parent].clone().add(d.setLength(l));
  }
  return out;
}

// ---- layers: a part of the body played from another motion or a pose, over the clip's own (STORY_FORMAT §3.5) ----
// each mask: the previs joints whose subtrees it takes (`tops`), the joint they hang from (`at`, kept where the base
// has it), and the frame that lines the layer's body up with the base's there: a bone (its two ends) and a line
// across the body (the hips for the upper body, the shoulders above), so the layer leans and turns with the base
export const MASKS = {
  upper: { tops: ["spine_02"], at: "spine_01", frame: ["pelvis", "spine_01", "thigh_l", "thigh_r"] },
  arms: { tops: ["clavicle_l", "clavicle_r"], at: "spine_03", frame: ["spine_02", "spine_03", "clavicle_l", "clavicle_r"] },
  left_arm: { tops: ["clavicle_l"], at: "spine_03", frame: ["spine_02", "spine_03", "clavicle_l", "clavicle_r"] },
  right_arm: { tops: ["clavicle_r"], at: "spine_03", frame: ["spine_02", "spine_03", "clavicle_l", "clavicle_r"] },
  head: { tops: ["neck_01"], at: "spine_03", frame: ["spine_02", "spine_03", "clavicle_l", "clavicle_r"] },
};
export const MASK_NAMES = Object.keys(MASKS);
function maskFrame(P, [a, b, l, r]) {          // a bone and a line across the body -> a rotation (null if a joint is missing)
  if (!P[a] || !P[b] || !P[l] || !P[r]) return null;
  const up = P[b].clone().sub(P[a]).normalize(), side = P[l].clone().sub(P[r]);
  side.addScaledVector(up, -side.dot(up)).normalize();
  if (!(up.lengthSq() > 0.5 && side.lengthSq() > 0.5)) return null;
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, new THREE.Vector3().crossVectors(side, up)));
}
function subtreeOf(tops, parentOf) {           // the tops and everything below them
  const out = new Set(tops); let grew = true;
  while (grew) { grew = false; for (const [n, p] of parentOf) if (p && out.has(p) && !out.has(n)) { out.add(n); grew = true; } }
  return out;
}
// the base with the mask's part of the body taken from `layer` (joint positions in the same space), w of the way:
// each bone there pointing the layer's way, turned to the base's frame, and as long as the base's (the base's body
// keeps its proportions, as the retarget does), hung from the base's joint. Kimodo's 77 joints ("soma:") follow the
// layer's when both have them; when the layer is a pose (25 previs joints), the base's SOMA joints there ride the
// previs bones that carry them, so the body keeps its fingers
export function layerPositions(lib, base, layer, mask, w, height, soma) {
  const m = MASKS[mask]; if (!m || !(w > 0)) return base;
  const qb = maskFrame(base, m.frame), ql = maskFrame(layer, m.frame); if (!qb || !ql || !base[m.at] || !layer[m.at]) return base;
  const q = qb.clone().multiply(ql.clone().invert()), A = base[m.at];
  const prevParent = new Map(lib.joints.map(j => [j.name, j.parent]));
  const part = subtreeOf(m.tops, prevParent), tg = {};
  const aim = (order, parentOf, key) => {      // parents first: the layer's bone direction, turned, at the base's length
    for (const n of order) {
      const k = key(n), pk = key(parentOf.get(n)); if (!base[k] || !layer[k] || !base[pk] || !layer[pk]) continue;
      tg[k] = (tg[pk] || base[pk]).clone().add(layer[k].clone().sub(layer[pk]).normalize().applyQuaternion(q).multiplyScalar(base[k].distanceTo(base[pk])));
    }
  };
  aim(lib.joints.map(j => j.name).filter(n => part.has(n)), prevParent, n => n);
  if (base["soma:Hips"] && soma && soma.map && soma.parents) {
    const somaParent = new Map(soma.names.map((n, i) => [n, soma.parents[i]]));
    const sPart = subtreeOf(m.tops.map(t => soma.map[t]).filter(Boolean), somaParent);
    if (layer["soma:Hips"]) aim(soma.names.filter(n => sPart.has(n)), somaParent, n => "soma:" + n);
    else {                                     // carried: each SOMA joint by its nearest previs joint (the bone from it, turned)
      const ofSoma = new Map(Object.entries(soma.map).map(([pv, sn]) => [sn, pv]));
      const kids = new Map(); for (const j of lib.joints) if (j.parent && !kids.has(j.parent)) kids.set(j.parent, j.name);
      const turn = P => {                      // the base's bone at previs joint P, turned onto the layered one
        const c = kids.get(P), pp = prevParent.get(P), [a, b] = c && tg[c] ? [P, c] : [pp, P];
        if (!a || !tg[a] || !tg[b] || !base[a] || !base[b]) return new THREE.Quaternion();
        return new THREE.Quaternion().setFromUnitVectors(base[b].clone().sub(base[a]).normalize(), tg[b].clone().sub(tg[a]).normalize());
      };
      const turns = new Map();
      for (const n of sPart) {
        let k = n; while (k && !(ofSoma.has(k) && part.has(ofSoma.get(k)))) k = somaParent.get(k);
        const P = k && ofSoma.get(k), key = "soma:" + n; if (!P || !tg[P] || !base[key] || !base[P]) continue;
        if (k === n) { tg[key] = tg[P].clone(); continue; }
        if (!turns.has(P)) turns.set(P, turn(P));
        tg[key] = tg[P].clone().add(base[key].clone().sub(base[P]).applyQuaternion(turns.get(P)));
      }
    }
  }
  const out = {}; for (const n in base) out[n] = tg[n] ? base[n].clone().lerp(tg[n], w) : base[n].clone();
  return keepBones(lib, out, height, base, Object.assign({ [m.at]: A }, tg), w);   // the rest of the body exactly the base's
}

export function poseDistance(a, b, joints) {   // mean joint distance in metres over the given joints
  let sum = 0, n = 0;
  for (const k of joints) if (a[k] && b[k]) { sum += a[k].distanceTo(b[k]); n++; }
  return n ? sum / n : 0;
}

export const GROUPS = {
  head: ["head", "head_end", "neck_01"], torso: ["spine_01", "spine_02", "spine_03", "pelvis", "clavicle_l", "clavicle_r"],
  arms: ["upperarm_l", "lowerarm_l", "upperarm_r", "lowerarm_r"], hands: ["hand_l", "hand_end_l", "hand_r", "hand_end_r"],
  legs: ["thigh_l", "calf_l", "thigh_r", "calf_r"], feet: ["foot_l", "ball_l", "foot_r", "ball_r"],
};

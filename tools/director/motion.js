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
      if (b.walk) p = walkOverlay(lib, p, t);
      p.move.copy(a.moveVec).lerp(b.moveVec, b.walk ? u : w);
      return p;
    }
  }
  return P(ks[ks.length - 1]);
}

function walkOverlay(lib, p, t) {
  const phase = (Math.sin(t * Math.PI * 1.8 * 2) + 1) / 2;   // ~1.8 steps a second
  const stride = mixPose(lib.poses.walk_a, lib.poses.walk_b, phase);
  const out = clonePose(p);
  for (const j of ["thigh_l", "calf_l", "thigh_r", "calf_r", "upperarm_l", "upperarm_r"]) out.q[j].copy(stride.q[j]);
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
      world[j.name] = j.off.clone().add(pose.root.clone().applyQuaternion(yawQ)).add(pose.move);
      continue;
    }
    const pr = rot[j.parent];
    world[j.name] = j.off.clone().applyQuaternion(pr).add(world[j.parent]);
    rot[j.name] = pr.clone().multiply(pose.q[j.name]);
  }
  for (const k in world) world[k].multiplyScalar(s);
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
  const s = (height || lib.height) / lib.height;
  const out = {};
  for (const j of lib.joints) {
    if (!a[j.name] || !b[j.name]) continue;
    out[j.name] = a[j.name].clone().lerp(b[j.name], w);
  }
  for (const k of Object.keys(a)) if (k.startsWith("soma:") && b[k]) out[k] = a[k].clone().lerp(b[k], w);   // Kimodo's full skeleton
  for (const j of lib.joints) {
    if (!j.parent || !out[j.name] || !out[j.parent]) continue;
    const len = j.off.length() * s, d = out[j.name].clone().sub(out[j.parent]);
    if (d.length() > 1e-6) out[j.name] = out[j.parent].clone().add(d.setLength(len));
  }
  return out;
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

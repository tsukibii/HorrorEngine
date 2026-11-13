// Animator v2: test bodies without a browser. MHR's body for a name (the Studio's bases and the tailor's slim and full
// ones), its joints fitted as the Studio fits them, written as a .glb laid out the way the Character Studio's export
// is (docs/ANIMATOR_V2.md §2): unturned bones by MHR's names under body_world, one skin, the skin mesh `<name>_skin`,
// its recipe's body.bin and character.json in the scene's extras; and, to try soft tissue under clothes, a plain
// shell over the trunk and thighs as a garment would be (`tee`). No textures: a grey body. For the checks and for
// working on the motion; real characters come from the Studio's Export for Godot.
//
//   node tools/animator/bodies.mjs [--out DIR] [name ...]      the three test bodies (or the ones named) into DIR
//                                                               (Saved/Animator/bodies), "BODIES ok"
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { loadMhr, mhrBody, grownBody, bodyWeights, bodySculpt, growRig, ROOT } from "../character/tailor/node.mjs";
import * as PO from "../character/pose.js";
import { Glb } from "./core/glb.js";

// the three the Animator is tested on (DECISIONS 2026-11-13, animation v2): a skinny man, a normal woman, a chubby woman
export const TEST_BODIES = {
  // (MHR's first body shape is its weight: about 19 kg a unit on a 1.8 m man; `add` goes on top of the base's weights,
  //  as the Studio's shape sliders do; `grown`: a body as the Studio's cards make it, grow.js. `studio`: the same
  //  character made in the Character Studio's page, dressed, by tools/animator/people.mjs)
  skinny_man: { mhr: "masculine", add: { 0: -0.9 }, height: 1.8, base: 1, about: "the masculine base 17 kg lighter: about 60 kg on 1.80 m",
    studio: { name: "anim_skinny_man", plain: true, base: "masculine", shape: { 0: -0.9 }, outfit: "casual: graphic tee and jeans", garments: 4, hair: "m_two_block" } },
  normal_woman: { grown: { base: -1, head: "v2female", body: "v2athletic" }, height: 1.63, base: -1, about: "v2female's head on the v2 athletic body: about 56 kg on 1.63 m",
    studio: { name: "anim_normal_woman", head: "v2female", body: "v2athletic", outfit: "t-shirt and skirt", garments: 3, hair: "bob_bangs" } },
  chubby_woman: { grown: { base: -1, head: "v2female", body: "bodyv2", sculpt: { belly: 1, waist: 0.8, upper_arms: 0.8, forearms: 0.5, thighs: 0.5, bust: 0.5, hips: 0.4, calves: 0.5, seat: 0.4, neck_width: 0.4 } }, height: 1.6, base: -1,
    about: "bodyv2 with a belly, a thicker waist, arms and legs: about 73 kg on 1.60 m",
    studio: { name: "anim_chubby_woman", head: "v2female", body: "bodyv2", outfit: "leggings and long sleeves", garments: 3, hair: "ponytail_low" } },
};

let MHR = null;
/** a test body: { name, P (MHR's points, metres, feet on the floor), T, joints: [{ name, parent, at }] parents first, BI, BW (the rig's, a point's four bones by the joints' order) } */
export function testBody(name) {
  const def = TEST_BODIES[name] || { mhr: name, height: 1.7, base: 0 }, m = (MHR ||= loadMhr()), R = growRig(m); let b, J;
  if (def.grown) { b = grownBody(m, { ...def.grown, height: def.height }); J = PO.joints(R, b.P, m.P, b.scale, b.F); }
  else {
    const w = bodyWeights(def.mhr).slice(); while (w.length < m.k) w.push(0); for (const [i, v] of Object.entries(def.add || {})) w[+i] += v;
    const sculpt = { ...(bodySculpt(def.mhr) || {}), ...(def.sculpt || {}) }; b = mhrBody(m, w, def.height, Object.keys(sculpt).length ? sculpt : null);
    const Q = new Float32Array(m.P); let lo = 1e9, hi = -1e9;
    for (let k = 0; k < w.length; k++) if (w[k]) for (let i = 0; i < Q.length; i++) Q[i] += w[k] * m.shapes[k * m.n * 3 + i];
    for (let i = 1; i < Q.length; i += 3) { lo = Math.min(lo, Q[i]); hi = Math.max(hi, Q[i]); }
    J = PO.joints(R, b.P, m.P, def.height / (hi - lo));
  }
  const slot = new Map(R.order.map((bi, k) => [bi, k]));
  const joints = R.order.map(bi => ({ name: R.bones[bi].name, parent: R.bones[bi].parent < 0 ? -1 : slot.get(R.bones[bi].parent), at: [J[bi * 3], J[bi * 3 + 1], J[bi * 3 + 2]] }));
  const BI = new Uint16Array(R.N * 4); for (let i = 0; i < BI.length; i++) BI[i] = slot.get(R.BI[i]);
  return { name, P: b.P, T: m.T, joints, BI, BW: R.BW, def };
}

const normals = (P, T) => { const N = new Float32Array(P.length);
  for (let t = 0; t < T.length; t += 3) { const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3, ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const i of [a, b, c]) { N[i] += nx; N[i + 1] += ny; N[i + 2] += nz; } }
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
  return N; };

/** the body as a .glb's bytes, laid out as the Studio's export; garment: a shell over the trunk and thighs too */
export function bodyGlb(body, { garment = true } = {}) {
  const g = new Glb({ asset: { version: "2.0", generator: "HorrorStudio Animator test body" }, scene: 0, scenes: [{ name: body.name, nodes: [] }], nodes: [], meshes: [], skins: [], materials: [], buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [] }, new Uint8Array(0));
  const j = g.json, nj = body.joints.length, first = j.nodes.length;
  body.joints.forEach((b, k) => { const p = b.parent < 0 ? [0, 0, 0] : body.joints[b.parent].at; j.nodes.push({ name: b.name, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, b.at[0] - p[0], b.at[1] - p[1], b.at[2] - p[2], 1] }); });
  body.joints.forEach((b, k) => { if (b.parent >= 0) (j.nodes[first + b.parent].children ||= []).push(first + k); });
  const roots = body.joints.map((b, k) => (b.parent < 0 ? first + k : -1)).filter(k => k >= 0); j.scenes[0].nodes.push(...roots);
  const ibm = new Float32Array(nj * 16); body.joints.forEach((b, k) => { ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -b.at[0], -b.at[1], -b.at[2], 1], k * 16); });
  const part = (name, P, T, BI, BW, color) => {
    j.materials.push({ name, pbrMetallicRoughness: { baseColorFactor: color, metallicFactor: 0, roughnessFactor: 0.75 } });
    j.skins.push({ joints: body.joints.map((_, k) => first + k), skeleton: roots[0], inverseBindMatrices: g.addAccessor(ibm.slice(), "MAT4") });
    j.meshes.push({ primitives: [{ mode: 4, material: j.materials.length - 1, indices: g.addAccessor(T, "SCALAR", { target: 34963 }),
      attributes: { POSITION: g.addAccessor(P, "VEC3", { minmax: true, target: 34962 }), NORMAL: g.addAccessor(normals(P, T), "VEC3", { target: 34962 }), JOINTS_0: g.addAccessor(BI, "VEC4", { target: 34962 }), WEIGHTS_0: g.addAccessor(BW, "VEC4", { target: 34962 }) } }] });
    j.nodes.push({ name, mesh: j.meshes.length - 1, skin: j.skins.length - 1 }); j.scenes[0].nodes.push(j.nodes.length - 1);
  };
  part(body.name + "_skin", body.P, body.T, body.BI, new Float32Array(body.BW), [0.78, 0.62, 0.54, 1]);
  if (garment) {                                               // a shell 5 mm off the skin from mid thigh to the collar bones, the arms left bare: a tee and shorts
    const N = normals(body.P, body.T), at = n => body.joints.find(b => b.name === n).at, yLo = (at("l_upleg")[1] + at("l_lowleg")[1]) / 2, yHi = at("l_uparm")[1] + 0.01, xArm = Math.abs(at("l_uparm")[0]) + 0.02;
    const keep = new Int32Array(body.P.length / 3).fill(-1), P = [], BI = [], BW = []; let c = 0;
    for (let i = 0; i < keep.length; i++) { const x = body.P[i * 3], y = body.P[i * 3 + 1]; if (y < yLo || y > yHi || Math.abs(x) > xArm) continue; keep[i] = c++;
      for (let a = 0; a < 3; a++) P.push(body.P[i * 3 + a] + 0.005 * N[i * 3 + a]); for (let k = 0; k < 4; k++) { BI.push(body.BI[i * 4 + k]); BW.push(body.BW[i * 4 + k]); } }
    const T = []; for (let t = 0; t < body.T.length; t += 3) { const a = keep[body.T[t]], b = keep[body.T[t + 1]], d = keep[body.T[t + 2]]; if (a >= 0 && b >= 0 && d >= 0) T.push(a, b, d); }
    part("tee", new Float32Array(P), new Uint32Array(T), new Uint16Array(BI), new Float32Array(BW), [0.32, 0.36, 0.48, 1]);
  }
  const b64 = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");
  j.scenes[0].extras = { studio: { format: 1, name: body.name, tool: "tools/animator/bodies.mjs", files: { "character.json": Buffer.from(JSON.stringify({ base: body.def.base ?? 0, height: body.def.height })).toString("base64"), "body.bin": b64(new Float32Array(body.P)) } } };
  return g.write();
}

/** MHR's rig file as measure.js reads it (readMhrRig) */
export const mhrRigBuffer = () => { const b = readFileSync(join(ROOT, "Content", "Studio", "Bodies", "MHR_lod1_rig.bin")); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

if (process.argv[1] && process.argv[1].endsWith("bodies.mjs")) {
  const args = process.argv.slice(2), oi = args.indexOf("--out"), out = oi >= 0 ? args[oi + 1] : join(ROOT, "Saved", "Animator", "bodies"), names = args.filter((a, i) => !a.startsWith("--") && i !== oi + 1 - (oi < 0 ? 1e9 : 0));
  mkdirSync(out, { recursive: true });
  for (const n of names.length ? names : Object.keys(TEST_BODIES)) { const bytes = bodyGlb(testBody(n)); writeFileSync(join(out, n + ".glb"), bytes); console.log(`  ok  ${n}: ${join(out, n + ".glb")} (${(bytes.length / 1e6).toFixed(1)} MB)`); }
  console.log("BODIES ok");
}

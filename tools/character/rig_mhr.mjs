// MHR's skeleton and skinning for the Character Studio's own points: the rig its pose is shown in (pose.js). The
// Studio's body is Content/Studio/Bodies/MHR_lod1.bin (pack_mhr.py: points, no bones); this takes MHR_lod1.fbx's
// skeleton (127 bones) and each point's four bones and weights from the same mesh, matched point to point by place
// (the FBX splits its corners; every one of the bin's points has its corners there, a hundredth of a millimetre off).
//
//   node tools/character/rig_mhr.mjs        writes Content/Studio/Bodies/MHR_lod1_rig.bin, ends "RIG ok"
//
// The file: a uint32 header length, the header (JSON: the points, the bones {name, parent, at: their rest place in
// metres}, the offset of each block), the bone of each point's four (uint8, N x 4) and their weights (uint16 out of
// 65535, N x 4, each point's summing to 65535). Meta's MHR, Apache-2.0 (Content/Studio/Bodies/MHR_LICENSE.txt).
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, "..", ".."), BODIES = join(ROOT, "Content", "Studio", "Bodies");
const VENDOR = join(ROOT, "tools", "director", "vendor");
const { register } = await import("module");             // "three" as the pages name it: the vendored copy
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, next) { return s === "three" ? { url: ${JSON.stringify("file://" + join(VENDOR, "three.module.min.js"))}, shortCircuit: true } : next(s, c); }`));
const THREE = await import("three");
const { FBXLoader } = await import("file://" + join(VENDOR, "FBXLoader.js"));
const fail = m => { console.error("RIG FAIL: " + m); process.exit(1); };

// the Studio's points (metres, Y up, facing +Z)
const bin = readFileSync(join(BODIES, "MHR_lod1.bin")), hl = bin.readUInt32LE(0), H = JSON.parse(bin.subarray(4, 4 + hl).toString("utf8"));
const N = H.points, P = new Float32Array(bin.buffer.slice(bin.byteOffset + H.points_at, bin.byteOffset + H.points_at + N * 12));

// the FBX's body: the skinned mesh carrying MHR's identity shapes (its eyes and teeth are meshes of their own)
const fbx = readFileSync(join(BODIES, "MHR_lod1.fbx"));
const warn = console.warn; console.warn = () => {};      // "skeleton attached to more than one geometry": the eyes share it
const root = new FBXLoader().parse(fbx.buffer.slice(fbx.byteOffset, fbx.byteOffset + fbx.byteLength), "");
console.warn = warn;
root.updateMatrixWorld(true);
let mesh = null;
root.traverse(o => { if (o.isSkinnedMesh && o.morphTargetDictionary && "shape_c_0" in o.morphTargetDictionary && (!mesh || o.geometry.attributes.position.count > mesh.geometry.attributes.position.count)) mesh = o; });
if (!mesh) fail("no skinned body with MHR's shapes in MHR_lod1.fbx");
const bones = mesh.skeleton.bones, at = new Map(bones.map((b, i) => [b, i]));
if (bones.length > 255) fail(`${bones.length} bones: more than a byte holds`);

// each of the Studio's points: the FBX corner at its place (a grid of 1 mm cells)
const cell = 0.001, grid = new Map(), key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
for (let i = 0; i < N; i++) { const k = key(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); (grid.get(k) || grid.set(k, []).get(k)).push(i); }
const g = mesh.geometry, n = g.attributes.position.count, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
const BI = new Uint8Array(N * 4), BW = new Uint16Array(N * 4), got = new Int32Array(N).fill(-1), dist = new Float32Array(N).fill(Infinity);
const v = new THREE.Vector3(), m = mesh.matrixWorld;
let unmatched = 0, disagree = 0;
for (let c = 0; c < n; c++) {
  v.fromBufferAttribute(g.attributes.position, c).applyMatrix4(m).multiplyScalar(0.01);   // cm to metres (the bind pose: no skinning)
  const fx = Math.floor(v.x / cell), fy = Math.floor(v.y / cell), fz = Math.floor(v.z / cell);
  let best = -1, bd = 2e-4;                                // within a fifth of a millimetre
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
    for (const i of grid.get(`${fx + dx},${fy + dy},${fz + dz}`) || []) { const d = Math.hypot(P[i * 3] - v.x, P[i * 3 + 1] - v.y, P[i * 3 + 2] - v.z); if (d < bd) { bd = d; best = i; } }
  if (best < 0) { unmatched++; continue; }
  const ws = [0, 1, 2, 3].map(k => [SI.getComponent(c, k), SW.getComponent(c, k)]).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]);
  if (got[best] >= 0) {                                    // another corner of the same point: the same skinning
    const was = [0, 1, 2, 3].map(k => [BI[best * 4 + k], BW[best * 4 + k]]).filter(([, w]) => w > 0);
    if (was.length !== ws.length || was.some(([b], k) => b !== ws[k][0])) disagree++;
    if (bd >= dist[best]) continue;
  }
  got[best] = c; dist[best] = bd;
  const sum = ws.reduce((a, [, w]) => a + w, 0) || 1; let left = 65535;
  for (let k = 0; k < 4; k++) {
    const [b, w] = ws[k] || [0, 0], q = k === ws.length - 1 ? left : Math.round(w / sum * 65535);
    BI[best * 4 + k] = b; BW[best * 4 + k] = k < ws.length ? q : 0; if (k < ws.length) left -= q;
  }
}
const missing = got.reduce((a, x) => a + (x < 0 ? 1 : 0), 0);
if (missing) fail(`${missing} of the Studio's ${N} points have no corner in the FBX`);
if (unmatched) fail(`${unmatched} of the FBX body's ${n} corners are on none of the Studio's points`);
if (disagree) fail(`${disagree} corners of one point skinned differently`);
let far = 0; for (let i = 0; i < N; i++) far = Math.max(far, dist[i]);

// the bones: their names, their parents (in this list), their rest places in metres
const out = bones.map((b, i) => {
  let p = b.parent; while (p && !at.has(p)) p = p.parent;
  const w = b.getWorldPosition(new THREE.Vector3()).multiplyScalar(0.01);
  return { name: b.name, parent: p ? at.get(p) : -1, at: [+w.x.toFixed(6), +w.y.toFixed(6), +w.z.toFixed(6)] };
});
const head = { about: "MHR's skeleton and skinning on the Character Studio's points (tools/character/rig_mhr.mjs from MHR_lod1.fbx): the pose the Studio shows its body in, tools/character/pose.js. MHR, Apache-2.0 (Meta)",
  points: N, units: "m", up: "+Y", front: "+Z", bones: out, bi_at: 0, bw_at: 0 };
const pad = s => { const b = Buffer.from(s, "utf8"); return Buffer.concat([b, Buffer.alloc((4 - (4 + b.length) % 4) % 4, 0x20)]); };
let hb = pad(JSON.stringify(head));
for (let k = 0; k < 2; k++) { head.bi_at = 4 + hb.length; head.bw_at = head.bi_at + N * 4; hb = pad(JSON.stringify(head)); }   // the offsets' own digits settle the length
const len = Buffer.alloc(4); len.writeUInt32LE(hb.length);
writeFileSync(join(BODIES, "MHR_lod1_rig.bin"), Buffer.concat([len, hb, Buffer.from(BI.buffer), Buffer.from(BW.buffer)]));
console.log(`  ${N} points, each on its FBX corners (${n} of them) within ${(far * 1000).toFixed(3)} mm; ${bones.length} bones`);
console.log("RIG ok");

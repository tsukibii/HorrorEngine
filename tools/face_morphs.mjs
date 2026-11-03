// MHR's 72 face shapes as morph targets on a Character Studio export (DECISIONS 2026-11-01: faces in Godot; docs/
// GODOT_DIRECTOR.md §6c), for the copy a Godot project wears (game/people/<name>.glb): the export's own map onto MHR's
// points (each corner's _MHRP, _MHRW: what the desk's face.js moves it by) gives each shape's move on every corner it
// touches, scaled by the body's height over MHR's, written as a sparse morph target named by Meta's name; Godot makes
// them blend shapes and the runtime's face.gd plays the story's `expr` on them. A lash card (_MHRR its root, _MHRE its
// eye's middle) turns whole about its eye as its root moves, at the shape's full weight (face.js turns it the same
// way). What the desk does besides (the lids kept off the eyeballs, the eyes turned by the gaze) isn't a morph and
// stays the desk's. The Studio's own file is left as it is; a file already baked is left alone.
//   node tools/face_morphs.mjs <in.glb> [out.glb]     (out: in place; ends FACEMORPHS ok)
//   node tools/face_morphs.mjs --check                  (FACEMORPHS: a made-up export of MHR's own face and a lash card,
//                                                        baked and read back: the morphs MHR's own moves, the card turned)
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "..");

/** MHR's face (Content/Studio/Bodies/MHR_lod1.bin): its 72 names, each shape's move on the points it moves (D:
 * 72 × k × 3), which of those a point is (slot, -1 for none), its points and height */
export function mhrFace() {
  const raw = fs.readFileSync(path.join(ROOT, "Content", "Studio", "Bodies", "MHR_lod1.bin"));
  const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const n = new DataView(buf).getUint32(0, true), H = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, n)));
  const k = H.expr_points, idx = new Uint32Array(buf, H.expr_idx_at, k), half = new Uint16Array(buf, H.expr_at, H.expressions * k * 3);
  const D = new Float32Array(half.length);
  for (let i = 0; i < half.length; i++) {
    const x = half[i], s = x & 0x8000 ? -1 : 1, e = (x >> 10) & 31, f = x & 1023;
    D[i] = s * (e === 0 ? f * 5.960464477539063e-8 : e === 31 ? 0 : Math.pow(2, e - 15) * (1 + f / 1024));
  }
  const slot = new Int32Array(H.points).fill(-1); idx.forEach((p, i) => { slot[p] = i; });
  const P = new Float32Array(buf, H.points_at, H.points * 3), T = new Uint32Array(buf, H.triangles_at, H.triangles * 3);
  let lo = Infinity, hi = -Infinity; for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); }
  return { names: H.expr_names, k, D, slot, P, T, tall: hi - lo };
}

// ---- a glb's chunks and accessors -------------------------------------------------------------------------------
export function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a .glb`);
  let off = 12, json = null, bin = Buffer.alloc(0);
  while (off + 8 <= b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4), data = b.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString("utf8"));
    else if (type === 0x004e4942) bin = Buffer.from(data);
    off += 8 + len;
  }
  return { json, bin };
}
export function writeGlb(file, json, bin) {
  const pad = (b, c) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, c)]);
  if (json.buffers && json.buffers[0]) json.buffers[0].byteLength = bin.length;
  const J = pad(Buffer.from(JSON.stringify(json), "utf8"), 0x20), B = pad(bin, 0);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + J.length + 8 + B.length, 8);
  jh.writeUInt32LE(J.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); bh.writeUInt32LE(B.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, jh, J, bh, B]));
}
const COMP = { 5120: [1, "getInt8", 127], 5121: [1, "getUint8", 255], 5122: [2, "getInt16", 32767], 5123: [2, "getUint16", 65535], 5125: [4, "getUint32", 1], 5126: [4, "getFloat32", 1] };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
/** an accessor's values as plain numbers, row after row (a sparse one's too; normalized ints back to 0..1) */
export function readAcc(json, bin, i) {
  const a = json.accessors[i], n = NCOMP[a.type], [sz, get, top] = COMP[a.componentType], out = new Float64Array(a.count * n);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength), norm = a.normalized ? 1 / top : 1;
  if (a.bufferView !== undefined) {
    const bv = json.bufferViews[a.bufferView], stride = bv.byteStride || sz * n, base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    for (let e = 0; e < a.count; e++) for (let c = 0; c < n; c++) out[e * n + c] = dv[get](base + e * stride + c * sz, true) * norm;
  }
  if (a.sparse) {
    const S = a.sparse, iv = json.bufferViews[S.indices.bufferView], vv = json.bufferViews[S.values.bufferView];
    const [isz, iget] = COMP[S.indices.componentType], ib = (iv.byteOffset || 0) + (S.indices.byteOffset || 0), vb = (vv.byteOffset || 0) + (S.values.byteOffset || 0);
    for (let j = 0; j < S.count; j++) { const e = dv[iget](ib + j * isz, true); for (let c = 0; c < n; c++) out[e * n + c] = dv[get](vb + (j * n + c) * sz, true) * norm; }
  }
  return out;
}

// ---- the bake ---------------------------------------------------------------------------------------------------
/** turn v about the axis that takes a to b (both from the eye's middle), by the angle between them (face.js's lash turn) */
function turner(a, b) {
  const la = Math.hypot(...a), lb = Math.hypot(...b);
  let k = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sn = Math.hypot(...k) / (la * lb), cs = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb);
  if (sn <= 1e-9) return p => p;
  k = k.map(x => x / (sn * la * lb));
  return p => {
    const d = k[0] * p[0] + k[1] * p[1] + k[2] * p[2], c = [k[1] * p[2] - k[2] * p[1], k[2] * p[0] - k[0] * p[2], k[0] * p[1] - k[1] * p[0]];
    return [0, 1, 2].map(i => p[i] * cs + c[i] * sn + k[i] * d * (1 - cs));
  };
}

/** the face's morphs added to a glb's json and bin: {meshes: n, corners, targets} (0 meshes: nothing carries MHR's points,
 * or it's baked already) */
export function bake(json, bin, F = mhrFace()) {
  const parts = [], chunks = [bin];
  let size = bin.length;
  const view = (buf) => {                             // a new bufferView at the bin's end (4-aligned)
    const padn = (4 - (size % 4)) % 4; if (padn) { chunks.push(Buffer.alloc(padn)); size += padn; }
    json.bufferViews.push({ buffer: 0, byteOffset: size, byteLength: buf.length }); chunks.push(buf); size += buf.length;
    return json.bufferViews.length - 1;
  };
  for (const [mi, mesh] of (json.meshes || []).entries()) {
    const ex = mesh.extras || {};
    if (Array.isArray(ex.targetNames) && ex.targetNames.length === 72 && ex.targetNames[0] === F.names[0]) continue;   // baked already
    const prims = mesh.primitives.map(p => {
      const A = p.attributes || {};
      if (A._MHRP === undefined || A._MHRW === undefined || A.POSITION === undefined || p.targets) return null;
      return { p, I: readAcc(json, bin, A._MHRP), W: readAcc(json, bin, A._MHRW), X: readAcc(json, bin, A.POSITION),
        R: A._MHRR !== undefined ? readAcc(json, bin, A._MHRR) : null, E: A._MHRE !== undefined ? readAcc(json, bin, A._MHRE) : null };
    });
    if (!prims.some(Boolean)) continue;
    parts.push({ mi, mesh, prims });
  }
  // the body's height (the tallest skin's, as face.js finds it): MHR's moves scaled by it, brows and lashes too
  let tall = 0;
  for (const { prims } of parts) for (const q of prims) if (q && !q.R) {
    let lo = Infinity, hi = -Infinity; for (let i = 1; i < q.X.length; i += 3) { lo = Math.min(lo, q.X[i]); hi = Math.max(hi, q.X[i]); }
    tall = Math.max(tall, hi - lo);
  }
  const scale = tall > 0 ? tall / F.tall : 1;
  let corners = 0, targets = 0;
  const move = (e, s) => [F.D[(e * F.k + s) * 3] * scale, F.D[(e * F.k + s) * 3 + 1] * scale, F.D[(e * F.k + s) * 3 + 2] * scale];
  for (const { mesh, prims } of parts) {
    for (const [pi, prim] of mesh.primitives.entries()) {
      const q = prims[pi], count = json.accessors[prim.attributes.POSITION].count;
      let cards = null;
      if (q && q.R && q.E) {                          // a lash card: its corners by their root, turned about their eye
        const by = new Map();
        for (let v = 0; v < count; v++) {
          const key = `${q.R[v * 3]},${q.R[v * 3 + 1]},${q.R[v * 3 + 2]}`; let c = by.get(key);
          if (!c) by.set(key, c = { s: F.slot[q.I[v * 3]], r: [q.R[v * 3], q.R[v * 3 + 1], q.R[v * 3 + 2]], e: [q.E[v * 3], q.E[v * 3 + 1], q.E[v * 3 + 2]], v: [] });
          c.v.push(v);
        }
        cards = [...by.values()].filter(c => c.s >= 0);
      }
      prim.targets = [];
      for (let e = 0; e < 72; e++) {
        const idx = [], val = [];
        if (q && cards) {
          for (const c of cards) {
            const m = move(e, c.s); if (!m[0] && !m[1] && !m[2]) continue;
            const a = [c.r[0] - c.e[0], c.r[1] - c.e[1], c.r[2] - c.e[2]], turn = turner(a, [a[0] + m[0], a[1] + m[1], a[2] + m[2]]);
            for (const v of c.v) {
              const p = [q.X[v * 3] - c.e[0], q.X[v * 3 + 1] - c.e[1], q.X[v * 3 + 2] - c.e[2]], t = turn(p);
              const d = [t[0] - p[0], t[1] - p[1], t[2] - p[2]];
              if (Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]) > 1e-7) { idx.push(v); val.push(...d); }
            }
          }
        } else if (q) {
          for (let c = 0; c < count; c++) {
            let x = 0, y = 0, z = 0;
            for (let j = 0; j < 3; j++) {
              const w = q.W[c * 3 + j], s = w ? F.slot[q.I[c * 3 + j]] : -1; if (s < 0) continue;
              const o = (e * F.k + s) * 3; x += w * F.D[o]; y += w * F.D[o + 1]; z += w * F.D[o + 2];
            }
            if (Math.abs(x) + Math.abs(y) + Math.abs(z) > 1e-7) { idx.push(c); val.push(x * scale, y * scale, z * scale); }
          }
        }
        const acc = { componentType: 5126, count, type: "VEC3", min: [0, 0, 0], max: [0, 0, 0] };
        if (idx.length) {
          for (let j = 0; j < val.length; j++) { const c = j % 3; acc.min[c] = Math.min(acc.min[c], val[j]); acc.max[c] = Math.max(acc.max[c], val[j]); }
          acc.sparse = { count: idx.length, indices: { bufferView: view(Buffer.from(Uint32Array.from(idx).buffer)), componentType: 5125 },
            values: { bufferView: view(Buffer.from(Float32Array.from(val).buffer)) } };
          corners += idx.length;
        }
        json.accessors.push(acc);
        prim.targets.push({ POSITION: json.accessors.length - 1 });
        targets++;
      }
    }
    mesh.weights = new Array(72).fill(0);
    mesh.extras = Object.assign({}, mesh.extras || {}, { targetNames: F.names.slice() });
  }
  return { meshes: parts.length, corners, targets, scale, bin: Buffer.concat(chunks) };
}

export function bakeFile(input, output = input) {
  const { json, bin } = readGlb(input), r = bake(json, bin);
  if (r.meshes) writeGlb(output, json, r.bin);
  else if (output !== input) fs.copyFileSync(input, output);
  return r;
}

// ---- the check: a made-up export of MHR's own face, and a lash card ----------------------------------------------
function madeUp(F, file) {
  const n = F.P.length / 3, I = new Uint32Array(n * 3), W = new Float32Array(n * 3);
  for (let p = 0; p < n; p++) { I[p * 3] = I[p * 3 + 1] = I[p * 3 + 2] = p; W[p * 3] = 1; }
  // a lash card of four corners on a point of the upper lid's (one eyesClosed moves most), its eye 1.2 cm behind it
  const blink = F.names.indexOf("eyesClosed_L");
  let root = -1, best = 0;
  for (let p = 0; p < n; p++) { const s = F.slot[p]; if (s < 0) continue; const o = (blink * F.k + s) * 3, m = Math.hypot(F.D[o], F.D[o + 1], F.D[o + 2]); if (m > best) { best = m; root = p; } }
  const r = [F.P[root * 3], F.P[root * 3 + 1], F.P[root * 3 + 2]], eye = [r[0], r[1] - 0.004, r[2] - 0.012];
  const cardX = Float32Array.from([...r, r[0] + 0.004, r[1], r[2] + 0.002, r[0], r[1] + 0.006, r[2] + 0.004, r[0] + 0.004, r[1] + 0.006, r[2] + 0.006]);
  const cardI = Uint32Array.from([root, root, root, root, root, root, root, root, root, root, root, root]), cardW = Float32Array.from([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]);
  const cardR = Float32Array.from([...r, ...r, ...r, ...r]), cardE = Float32Array.from([...eye, ...eye, ...eye, ...eye]);
  const blobs = [F.P, I, W, F.T, cardX, cardI, cardW, cardR, cardE, Uint32Array.from([0, 1, 2, 2, 1, 3])].map(a => Buffer.from(a.buffer, a.byteOffset, a.byteLength));
  const json = { asset: { version: "2.0" }, buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [], meshes: [], nodes: [], scenes: [{ nodes: [0, 1] }], scene: 0 };
  let off = 0; const views = blobs.map(b => { json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: b.length }); off += b.length; return json.bufferViews.length - 1; });
  const acc = (v, ct, cnt, type, extra = {}) => { json.accessors.push(Object.assign({ bufferView: v, componentType: ct, count: cnt, type }, extra)); return json.accessors.length - 1; };
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < F.P.length; i++) { lo[i % 3] = Math.min(lo[i % 3], F.P[i]); hi[i % 3] = Math.max(hi[i % 3], F.P[i]); }
  json.meshes.push({ name: "skin", primitives: [{ attributes: { POSITION: acc(views[0], 5126, n, "VEC3", { min: lo, max: hi }), _MHRP: acc(views[1], 5125, n, "VEC3"), _MHRW: acc(views[2], 5126, n, "VEC3") }, indices: acc(views[3], 5125, F.T.length, "SCALAR") }] });
  const cmin = [0, 1, 2].map(c => Math.min(...[0, 1, 2, 3].map(v => cardX[v * 3 + c]))), cmax = [0, 1, 2].map(c => Math.max(...[0, 1, 2, 3].map(v => cardX[v * 3 + c])));
  json.meshes.push({ name: "lashes", primitives: [{ attributes: { POSITION: acc(views[4], 5126, 4, "VEC3", { min: cmin, max: cmax }), _MHRP: acc(views[5], 5125, 4, "VEC3"), _MHRW: acc(views[6], 5126, 4, "VEC3"),
    _MHRR: acc(views[7], 5126, 4, "VEC3"), _MHRE: acc(views[8], 5126, 4, "VEC3") }, indices: acc(views[9], 5125, 6, "SCALAR") }] });
  json.nodes.push({ name: "body", mesh: 0 }, { name: "lashes", mesh: 1 });
  writeGlb(file, json, Buffer.concat(blobs));
  return { root, eye, blink, cardX };
}

function check() {
  const F = mhrFace(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "facemorphs_")), file = path.join(tmp, "madeup.glb"), bad = [];
  const ok = (what, good, why = "") => { console.log((good ? "  ok  " : "  BAD ") + what + (good || !why ? "" : "  " + why)); if (!good) bad.push(what); };
  const m = madeUp(F, file), r = bakeFile(file), again = bakeFile(file);
  ok(`baked: ${r.meshes} meshes, ${r.targets} morph targets, ${r.corners} corners moved; again: nothing (${again.meshes})`, r.meshes === 2 && r.targets === 144 && again.meshes === 0);
  const { json, bin } = readGlb(file), skin = json.meshes[0], lash = json.meshes[1];
  ok("the targets named by MHR's 72 (Meta's names), the weights at rest", JSON.stringify(skin.extras.targetNames) === JSON.stringify(F.names) && skin.weights.length === 72 && skin.weights.every(w => w === 0));
  let worst = 0, moved = 0;                               // every corner's move MHR's own, shape by shape
  for (let e = 0; e < 72; e++) {
    const d = readAcc(json, bin, skin.primitives[0].targets[e].POSITION);
    for (let p = 0; p < F.P.length / 3; p++) {
      const s = F.slot[p], o = (e * F.k + s) * 3;
      const want = s < 0 ? [0, 0, 0] : [F.D[o], F.D[o + 1], F.D[o + 2]];
      worst = Math.max(worst, Math.abs(d[p * 3] - want[0]), Math.abs(d[p * 3 + 1] - want[1]), Math.abs(d[p * 3 + 2] - want[2]));
      if (s >= 0 && Math.hypot(...want) > 1e-6) moved++;
    }
  }
  ok(`the skin's morphs MHR's own moves (${(worst * 1000).toFixed(4)} mm at worst, ${moved} moves), its scale 1 (${r.scale.toFixed(4)})`, worst < 1e-6 && moved > 1000 && Math.abs(r.scale - 1) < 1e-6);
  const dL = readAcc(json, bin, lash.primitives[0].targets[m.blink].POSITION);    // the card on a blink: turned about its eye, its corners as far from it
  let off = 0, swing = 0;
  for (let v = 0; v < 4; v++) {
    const p = [m.cardX[v * 3] - m.eye[0], m.cardX[v * 3 + 1] - m.eye[1], m.cardX[v * 3 + 2] - m.eye[2]], t = [p[0] + dL[v * 3], p[1] + dL[v * 3 + 1], p[2] + dL[v * 3 + 2]];
    off = Math.max(off, Math.abs(Math.hypot(...t) - Math.hypot(...p))); swing = Math.max(swing, Math.hypot(dL[v * 3], dL[v * 3 + 1], dL[v * 3 + 2]));
  }
  const rootMove = Math.hypot(...[0, 1, 2].map(c => F.D[(m.blink * F.k + F.slot[m.root]) * 3 + c]));
  ok(`a lash card on the blink turned whole about its eye (its corners ${(off * 1000).toFixed(4)} mm off their distance, swung ${(swing * 1000).toFixed(1)} mm; its root ${(rootMove * 1000).toFixed(1)} mm)`, off < 1e-5 && swing > 0.5 * rootMove && rootMove > 0.001);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(bad.length ? `FACEMORPHS FAIL (${bad.length})` : "FACEMORPHS ok");
  return bad.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes("--check")) process.exit(check());
  if (!args[0]) { console.log("node tools/face_morphs.mjs <in.glb> [out.glb]   |   --check"); process.exit(1); }
  const r = bakeFile(path.resolve(args[0]), path.resolve(args[1] || args[0]));
  console.log(r.meshes ? `FACEMORPHS ok (${r.meshes} meshes, ${r.targets} morph targets, ${r.corners} corners; scale ${r.scale.toFixed(3)})` : "FACEMORPHS ok (nothing to bake: no MHR points, or baked already)");
}

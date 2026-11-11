// A binary glTF written from plain arrays, in node, for the hair editor v2.0's own tools (make.mjs: a head and its
// hair as a file Godot can picture; check.mjs). The page doesn't use it: there the Character Studio's export writes
// the hair with everything else on the rig (three.js's GLTFExporter). Just enough of glTF 2.0: meshes with their
// attributes, materials with PNG textures (base colour, occlusion) and extras, nodes in a tree, one skin.
//
//   const G = new Glb();
//   const tex = G.texture(rgba, W, H, { repeatS: true });          // RGBA bytes -> a PNG in the file
//   const mat = G.material({ name, color, texture: tex, alphaCutoff: 0.4, doubleSided: true, occlusion: tex2, extras });
//   const mesh = G.mesh({ name, position, normal, tangent, uv, uv1, color, index, material: mat, extras });
//   G.node({ name, mesh, parent })       G.write(path)
import zlib from "zlib";
import { writeFileSync } from "fs";

// RGBA bytes as a PNG (8 bits a channel, no interlace)
export function png(rgba, W, H) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1); }
  const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, "ascii"); data.copy(b, 8); b.writeUInt32BE(zlib.crc32(b.subarray(4, 8 + data.length)) >>> 0, 8 + data.length); return b; };
  const head = Buffer.alloc(13); head.writeUInt32BE(W, 0); head.writeUInt32BE(H, 4); head[8] = 8; head[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", zlib.deflateSync(raw, { level: 6 })), chunk("IEND", Buffer.alloc(0))]);
}

export class Glb {
  constructor() { this.j = { asset: { version: "2.0", generator: "HorrorStudio hair2/glb.mjs" }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }] }; this.bin = []; this.at = 0; }
  view(bytes, target) {
    const pad = (4 - (this.at % 4)) % 4; if (pad) { this.bin.push(Buffer.alloc(pad)); this.at += pad; }
    const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength); this.bin.push(b);
    const v = { buffer: 0, byteOffset: this.at, byteLength: b.length }; if (target) v.target = target;
    this.at += b.length; return this.j.bufferViews.push(v) - 1;
  }
  accessor(arr, type, o = {}) {
    const comp = arr instanceof Float32Array ? 5126 : arr instanceof Uint32Array ? 5125 : arr instanceof Uint16Array ? 5123 : 5121, n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
    const a = { bufferView: this.view(arr, o.target), componentType: comp, count: arr.length / n, type };
    if (o.minmax) { const lo = Array(n).fill(Infinity), hi = Array(n).fill(-Infinity); for (let i = 0; i < arr.length; i++) { const k = i % n; if (arr[i] < lo[k]) lo[k] = arr[i]; if (arr[i] > hi[k]) hi[k] = arr[i]; } a.min = lo; a.max = hi; }
    return this.j.accessors.push(a) - 1;
  }
  texture(rgba, W, H, o = {}) {
    const j = this.j; j.images ||= []; j.textures ||= []; j.samplers ||= [];
    const img = j.images.push({ mimeType: "image/png", bufferView: this.view(png(rgba, W, H)) }) - 1;
    const smp = j.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: o.repeatS ? 10497 : 33071, wrapT: o.repeatT ? 10497 : 33071 }) - 1;
    return j.textures.push({ source: img, sampler: smp }) - 1;
  }
  material(o) {
    const m = { name: o.name, pbrMetallicRoughness: { baseColorFactor: o.color || [1, 1, 1, 1], metallicFactor: o.metallic ?? 0, roughnessFactor: o.roughness ?? 0.6 }, doubleSided: !!o.doubleSided };
    if (o.texture !== undefined) m.pbrMetallicRoughness.baseColorTexture = { index: o.texture };
    if (o.occlusion !== undefined) m.occlusionTexture = { index: o.occlusion };
    if (o.alphaCutoff !== undefined) { m.alphaMode = "MASK"; m.alphaCutoff = o.alphaCutoff; } else if (o.blend) m.alphaMode = "BLEND";
    if (o.unlit) { m.extensions = { KHR_materials_unlit: {} }; (this.j.extensionsUsed ||= []).includes("KHR_materials_unlit") || this.j.extensionsUsed.push("KHR_materials_unlit"); }
    if (o.extras) m.extras = o.extras;
    return this.j.materials.push(m) - 1;
  }
  mesh(o) {
    const at = { POSITION: this.accessor(o.position, "VEC3", { target: 34962, minmax: true }) };
    if (o.normal) at.NORMAL = this.accessor(o.normal, "VEC3", { target: 34962 });
    if (o.tangent) at.TANGENT = this.accessor(o.tangent, "VEC4", { target: 34962 });
    if (o.uv) at.TEXCOORD_0 = this.accessor(o.uv, "VEC2", { target: 34962 });
    if (o.uv1) at.TEXCOORD_1 = this.accessor(o.uv1, "VEC2", { target: 34962 });
    if (o.color) at.COLOR_0 = this.accessor(o.color, o.color.length / (o.position.length / 3) === 4 ? "VEC4" : "VEC3", { target: 34962 });
    if (o.joints) { at.JOINTS_0 = this.accessor(o.joints, "VEC4", { target: 34962 }); at.WEIGHTS_0 = this.accessor(o.weights, "VEC4", { target: 34962 }); }
    const prim = { attributes: at, indices: this.accessor(o.index, "SCALAR", { target: 34963 }) };
    if (o.material !== undefined) prim.material = o.material;
    const m = { name: o.name, primitives: [prim] }; if (o.extras) m.extras = o.extras;
    return this.j.meshes.push(m) - 1;
  }
  node(o) {
    const n = { name: o.name };
    if (o.mesh !== undefined) n.mesh = o.mesh;
    if (o.skin !== undefined) n.skin = o.skin;
    if (o.translation) n.translation = o.translation;
    if (o.matrix) n.matrix = o.matrix;
    if (o.extras) n.extras = o.extras;
    const i = this.j.nodes.push(n) - 1;
    if (o.parent !== undefined) (this.j.nodes[o.parent].children ||= []).push(i); else this.j.scenes[0].nodes.push(i);
    return i;
  }
  skin(joints, inverseBind, skeleton) { (this.j.skins ||= []); const s = { joints, inverseBindMatrices: this.accessor(inverseBind, "MAT4") }; if (skeleton !== undefined) s.skeleton = skeleton; return this.j.skins.push(s) - 1; }
  bytes() {
    const bin = Buffer.concat(this.bin), binPad = (4 - (bin.length % 4)) % 4; this.j.buffers[0].byteLength = bin.length + binPad;
    let js = Buffer.from(JSON.stringify(this.j), "utf8"); const jsPad = (4 - (js.length % 4)) % 4; if (jsPad) js = Buffer.concat([js, Buffer.alloc(jsPad, 0x20)]);
    const head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length + binPad, 8);
    const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
    const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length + binPad, 0); bh.writeUInt32LE(0x004E4942, 4);
    return Buffer.concat([head, jh, js, bh, bin, Buffer.alloc(binPad)]);
  }
  write(path) { const b = this.bytes(); writeFileSync(path, b); return b.length; }
}

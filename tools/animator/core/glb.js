// Animator v2: a .glb taken apart and put back together. Enough of glTF 2.0 to read a Character Studio export
// (accessors with strides, normalised integers and sparse parts), to add bones, skin weights and animations to it,
// and to write it again with everything it had (meshes, materials, pictures, morph targets, extras) untouched.
// ArrayBuffers and typed arrays only: the same file runs in node and in a page.
const COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const ARR = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

export function parseGlb(buffer) {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("not a .glb (no glTF header)");
  if (dv.getUint32(4, true) !== 2) throw new Error("only glTF 2.0 is read");
  let at = 12, json = null, bin = new Uint8Array(0);
  while (at < u8.byteLength) {
    const len = dv.getUint32(at, true), type = dv.getUint32(at + 4, true), body = u8.subarray(at + 8, at + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body));
    else if (type === 0x004e4942 && !bin.length) bin = body;
    at += 8 + len + ((4 - len % 4) % 4);
  }
  if (!json) throw new Error("a .glb with no JSON chunk");
  return new Glb(json, bin);
}

export class Glb {
  constructor(json, bin) { this.json = json; this.bin = bin; this.more = []; this.size = bin.byteLength; }
  // an accessor's numbers as one flat typed array of its own (strides undone, sparse parts applied); with float: true
  // normalised integers come back as 0..1 (or -1..1) floats
  read(index, { float = false } = {}) {
    const a = this.json.accessors[index], n = COMPS[a.type], T = ARR[a.componentType], out = new T(a.count * n);
    const fill = (viewIndex, offset, count, comps, Tt, into, stride0) => {
      const v = this.json.bufferViews[viewIndex], base = this.view(viewIndex), stride = v.byteStride || comps * Tt.BYTES_PER_ELEMENT;
      const dv = new DataView(base.buffer, base.byteOffset + (offset || 0), base.byteLength - (offset || 0)), get = getter(dv, Tt);
      for (let i = 0; i < count; i++) for (let c = 0; c < comps; c++) into[i * comps + c] = get(i * stride + c * Tt.BYTES_PER_ELEMENT);
    };
    if (a.bufferView != null) fill(a.bufferView, a.byteOffset, a.count, n, T, out);
    if (a.sparse) {
      const s = a.sparse, It = ARR[s.indices.componentType], idx = new It(s.count), val = new T(s.count * n);
      fill(s.indices.bufferView, s.indices.byteOffset, s.count, 1, It, idx); fill(s.values.bufferView, s.values.byteOffset, s.count, n, T, val);
      for (let i = 0; i < s.count; i++) for (let c = 0; c < n; c++) out[idx[i] * n + c] = val[i * n + c];
    }
    if (float && T !== Float32Array) { const f = new Float32Array(out.length), k = a.normalized ? NORM[a.componentType] : 1; for (let i = 0; i < f.length; i++) f[i] = Math.max(-1, out[i] / k); return f; }
    return out;
  }
  view(index) {                                               // a bufferView's bytes (old ones in the file's chunk, new ones in `more`)
    const v = this.json.bufferViews[index];
    if ((v.byteOffset || 0) + v.byteLength <= this.bin.byteLength) return this.bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    for (const m of this.more) if (m.at === v.byteOffset) return m.bytes;
    throw new Error("a bufferView outside the file");
  }
  // new bytes at the end of the buffer (kept on a 4-byte boundary); returns the bufferView's index
  addView(typed, target) {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength), at = this.size + ((4 - this.size % 4) % 4);
    this.more.push({ at, bytes }); this.size = at + bytes.byteLength;
    const v = { buffer: 0, byteOffset: at, byteLength: bytes.byteLength }; if (target) v.target = target;
    (this.json.bufferViews ||= []).push(v); return this.json.bufferViews.length - 1;
  }
  // a new accessor over a typed array; `type` SCALAR, VEC3..., min and max worked out when asked for (glTF wants them
  // on an animation's times and a mesh's positions)
  addAccessor(typed, type, { normalized = false, minmax = false, target } = {}) {
    const n = COMPS[type], code = +Object.keys(ARR).find(k => ARR[k] === typed.constructor), a = { bufferView: this.addView(typed, target), componentType: code, count: typed.length / n, type };
    if (normalized) a.normalized = true;
    if (minmax) { const lo = new Array(n).fill(Infinity), hi = new Array(n).fill(-Infinity); for (let i = 0; i < typed.length; i++) { const c = i % n; if (typed[i] < lo[c]) lo[c] = typed[i]; if (typed[i] > hi[c]) hi[c] = typed[i]; } a.min = lo; a.max = hi; }
    (this.json.accessors ||= []).push(a); return this.json.accessors.length - 1;
  }
  // the file again: the JSON and one buffer (what it had, then what was added)
  write() {
    const total = this.size + ((4 - this.size % 4) % 4), bin = new Uint8Array(total); bin.set(this.bin, 0);
    for (const m of this.more) bin.set(m.bytes, m.at);
    (this.json.buffers ||= [{}])[0].byteLength = total; delete this.json.buffers[0].uri;
    let text = new TextEncoder().encode(JSON.stringify(this.json)); const pad = (4 - text.byteLength % 4) % 4;
    if (pad) { const t = new Uint8Array(text.byteLength + pad).fill(0x20); t.set(text); text = t; }
    const out = new Uint8Array(12 + 8 + text.byteLength + 8 + total), dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.byteLength, true);
    dv.setUint32(12, text.byteLength, true); dv.setUint32(16, 0x4e4f534a, true); out.set(text, 20);
    dv.setUint32(20 + text.byteLength, total, true); dv.setUint32(24 + text.byteLength, 0x004e4942, true); out.set(bin, 28 + text.byteLength);
    return out;
  }
  // What nothing uses any more thrown out (accessors, and the bytes only they pointed at), the rest packed again:
  // a file baked a second time is no bigger than one baked once. `roots`: accessors to keep though nothing in the
  // file's own structure names them (the bake's way back); returns each kept accessor's new index (a Map), or null
  // when the file uses an extension that points at bytes in ways not known here (then nothing is changed)
  compact(roots = []) {
    const j = this.json; if ((j.extensionsUsed || []).some(e => /draco|meshopt|gpu_instancing|basisu/i.test(e))) return null;
    const used = new Set(roots.filter(a => a != null));
    for (const m of j.meshes || []) for (const p of m.primitives || []) { for (const a of Object.values(p.attributes || {})) used.add(a); if (p.indices != null) used.add(p.indices); for (const t of p.targets || []) for (const a of Object.values(t)) used.add(a); }
    for (const s of j.skins || []) if (s.inverseBindMatrices != null) used.add(s.inverseBindMatrices);
    for (const an of j.animations || []) for (const s of an.samplers || []) { used.add(s.input); used.add(s.output); }
    const amap = new Map(), acc = []; [...used].sort((a, b) => a - b).forEach(i => { amap.set(i, acc.length); acc.push(j.accessors[i]); });
    const vused = new Set(); for (const a of acc) { if (a.bufferView != null) vused.add(a.bufferView); if (a.sparse) { vused.add(a.sparse.indices.bufferView); vused.add(a.sparse.values.bufferView); } }
    for (const im of j.images || []) if (im.bufferView != null) vused.add(im.bufferView);
    const vmap = new Map(), views = [], chunks = []; let size = 0;
    for (const i of [...vused].sort((a, b) => a - b)) { const v = j.bufferViews[i], bytes = this.view(i), at = size + ((4 - size % 4) % 4); chunks.push({ at, bytes }); size = at + bytes.byteLength; vmap.set(i, views.length); views.push({ ...v, byteOffset: at }); }
    const bin = new Uint8Array(size + ((4 - size % 4) % 4)); for (const c of chunks) bin.set(c.bytes, c.at);
    for (const a of acc) { if (a.bufferView != null) a.bufferView = vmap.get(a.bufferView); if (a.sparse) { a.sparse.indices.bufferView = vmap.get(a.sparse.indices.bufferView); a.sparse.values.bufferView = vmap.get(a.sparse.values.bufferView); } }
    for (const im of j.images || []) if (im.bufferView != null) im.bufferView = vmap.get(im.bufferView);
    for (const m of j.meshes || []) for (const p of m.primitives || []) { for (const k of Object.keys(p.attributes || {})) p.attributes[k] = amap.get(p.attributes[k]); if (p.indices != null) p.indices = amap.get(p.indices); for (const t of p.targets || []) for (const k of Object.keys(t)) t[k] = amap.get(t[k]); }
    for (const s of j.skins || []) if (s.inverseBindMatrices != null) s.inverseBindMatrices = amap.get(s.inverseBindMatrices);
    for (const an of j.animations || []) for (const s of an.samplers || []) { s.input = amap.get(s.input); s.output = amap.get(s.output); }
    j.accessors = acc; j.bufferViews = views; this.bin = bin; this.more = []; this.size = bin.byteLength;
    return amap;
  }
  // a node's own place: translation, rotation, scale (a matrix taken apart when the file wrote one)
  local(node) {
    const n = this.json.nodes[node];
    if (n.matrix) return splitMatrix(n.matrix);
    return { t: (n.translation || [0, 0, 0]).slice(), q: (n.rotation || [0, 0, 0, 1]).slice(), s: (n.scale || [1, 1, 1]).slice() };
  }
  parents() {                                                 // each node's parent (-1: a scene's root)
    const p = new Array((this.json.nodes || []).length).fill(-1);
    (this.json.nodes || []).forEach((n, i) => (n.children || []).forEach(c => { p[c] = i; }));
    return p;
  }
}
function getter(dv, T) {
  if (T === Float32Array) return o => dv.getFloat32(o, true);
  if (T === Uint32Array) return o => dv.getUint32(o, true);
  if (T === Uint16Array) return o => dv.getUint16(o, true);
  if (T === Int16Array) return o => dv.getInt16(o, true);
  if (T === Uint8Array) return o => dv.getUint8(o);
  return o => dv.getInt8(o);
}
function splitMatrix(m) {
  const sx = Math.hypot(m[0], m[1], m[2]), sy = Math.hypot(m[4], m[5], m[6]), sz = Math.hypot(m[8], m[9], m[10]);
  const r = [m[0] / sx, m[1] / sx, m[2] / sx, m[4] / sy, m[5] / sy, m[6] / sy, m[8] / sz, m[9] / sz, m[10] / sz], tr = r[0] + r[4] + r[8]; let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(r[5] - r[7]) / s, (r[6] - r[2]) / s, (r[1] - r[3]) / s, s / 4]; }
  else if (r[0] > r[4] && r[0] > r[8]) { const s = Math.sqrt(1 + r[0] - r[4] - r[8]) * 2; q = [s / 4, (r[3] + r[1]) / s, (r[6] + r[2]) / s, (r[5] - r[7]) / s]; }
  else if (r[4] > r[8]) { const s = Math.sqrt(1 + r[4] - r[0] - r[8]) * 2; q = [(r[3] + r[1]) / s, s / 4, (r[7] + r[5]) / s, (r[6] - r[2]) / s]; }
  else { const s = Math.sqrt(1 + r[8] - r[0] - r[4]) * 2; q = [(r[6] + r[2]) / s, (r[7] + r[5]) / s, s / 4, (r[1] - r[3]) / s]; }
  return { t: [m[12], m[13], m[14]], q, s: [sx, sy, sz] };
}

// Node's side of the tailor: MHR's body from its packed file (the same format tools/character/mhr.py reads), the OBJ writer.
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as SC from "../sculpt.js";
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export function loadMhr(path = join(ROOT, "Content", "Studio", "Bodies", "MHR_lod1.bin")) {
  const buf = readFileSync(path), dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const hl = dv.getUint32(0, true), h = JSON.parse(Buffer.from(buf.buffer, buf.byteOffset + 4, hl).toString("utf8"));
  const f32 = (at, n) => new Float32Array(buf.buffer.slice(buf.byteOffset + at, buf.byteOffset + at + n * 4));
  const u32 = (at, n) => new Uint32Array(buf.buffer.slice(buf.byteOffset + at, buf.byteOffset + at + n * 4));
  const f16 = (at, n) => {
    const u = new Uint16Array(buf.buffer.slice(buf.byteOffset + at, buf.byteOffset + at + n * 2)), o = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = u[i], e = (x >> 10) & 31, m = x & 1023, sg = x >> 15 ? -1 : 1;
      o[i] = e === 0 ? sg * m * 2 ** -24 : e === 31 ? (m ? NaN : sg * Infinity) : sg * (1 + m / 1024) * 2 ** (e - 15);
    }
    return o;
  };
  return { P: f32(h.points_at, h.points * 3), T: u32(h.triangles_at, h.triangles * 3), shapes: f16(h.shapes_at, h.shapes * h.points * 3), n: h.points, k: h.shapes };
}

/** the body for weights (45 numbers) and a sculpt ({control: value}, sculpt.js's body controls: the belly, the waist,
    the limbs...), scaled to height, feet on the floor: as the Character Studio makes it */
export function mhrBody(m, weights = [], height = 1.7, sculpt = null) {
  const P = new Float32Array(m.P);
  for (let k = 0; k < Math.min(weights.length, m.k); k++) {
    const w = weights[k]; if (!w) continue;
    const o = k * m.n * 3; for (let i = 0; i < P.length; i++) P[i] += w * m.shapes[o + i];
  }
  if (sculpt) for (const c of bodyControls(m)) {
    const v = sculpt[c.id]; if (!v) continue;
    for (let q = 0; q < c.idx.length; q++) { const i = c.idx[q] * 3; P[i] += v * c.d[q * 3]; P[i + 1] += v * c.d[q * 3 + 1]; P[i + 2] += v * c.d[q * 3 + 2]; }
  }
  let lo = 1e9, hi = -1e9; for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); }
  const k = height / (hi - lo);
  for (let i = 0; i < P.length; i += 3) { P[i] *= k; P[i + 1] = (P[i + 1] - lo) * k; P[i + 2] *= k; }
  return { P, T: m.T };
}

export function objText(parts, header = "") {
  const out = header ? [`# ${header}`] : []; let base = 0;
  for (const g of parts) {
    out.push(`o ${g.name || "part"}`);
    for (let i = 0; i < g.P.length; i += 3) out.push(`v ${g.P[i].toFixed(5)} ${g.P[i + 1].toFixed(5)} ${g.P[i + 2].toFixed(5)}`);
    for (let t = 0; t < g.T.length; t += 3) out.push(`f ${g.T[t] + 1 + base} ${g.T[t + 1] + 1 + base} ${g.T[t + 2] + 1 + base}`);
    base += g.P.length / 3;
  }
  return out.join("\n") + "\n";
}
export const writeObj = (path, parts, header) => writeFileSync(path, objText(parts, header));

// the sculpt's body controls, built once on MHR's base (the face's need MediaPipe's points from the Studio's server;
// the body's are found from its own cross-sections)
let CONTROLS = null;
const bodyControls = m => CONTROLS ||= SC.buildSculpt({ P: m.P, T: m.T, lm: () => [0, 1.6, 0.1] }).controls.filter(c => c.group === "Body");
const tried = name => {                                              // TAILOR_BODIES: a JSON file of more bodies by name (weights, or
  if (!process.env.TAILOR_BODIES) return null;                       // {weights, sculpt}): one tried on before it's a preset
  const b = JSON.parse(readFileSync(process.env.TAILOR_BODIES, "utf-8"))[name];
  return b ? (Array.isArray(b) ? { weights: b } : b) : null;
};
const presetsFile = () => JSON.parse(readFileSync(join(ROOT, "Content", "Studio", "Bodies", "MHR_presets.json")));
/** a named test body as the Studio makes it: its weights, the sculpt its base carries, scaled to height */
export const namedBody = (m, name, height) => mhrBody(m, bodyWeights(name), height, bodySculpt(name));
/** the sculpt a base carries (MHR_presets.json's sculpt: MHR's belly, which its shapes can't take back), or null */
export function bodySculpt(name) {
  const t = tried(name); if (t) return t.sculpt || null;
  return presetsFile().sculpt?.[name] || null;
}

/** a test body's weights by name: MHR's presets (average, feminine, masculine) or the tailor's own (tailor/bodies.json: slim_ and full_feminine, slim_ and full_masculine) */
export function bodyWeights(name) {
  if (name === "average") return [];
  const t = tried(name); if (t) return t.weights;
  const pre = presetsFile().presets;
  if (pre[name]) return pre[name];
  const own = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "bodies.json"))).bodies;
  if (own[name]) return own[name];
  throw new Error(`no body called ${name}: ${["average", ...Object.keys(pre), ...Object.keys(own)].join(", ")}`);
}

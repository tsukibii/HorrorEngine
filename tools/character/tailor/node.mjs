// Node's side of the tailor: MHR's body from its packed file (the same format tools/character/mhr.py reads), the OBJ writer.
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as SC from "../sculpt.js";
import * as GW from "../grow.js";
import * as PO from "../pose.js";
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
export function mhrBody(m, weights = [], height = 1.7, sculpt = null, { anime = false, form = false } = {}) {   // anime: the Bust past -1 and 1 as the Studio's Anime switch makes it (sculpt.js bustShape; off: the bump alone, as it was); form: its dress form (what the tailor cuts on: a full bust with no hollow under it)
  const P = new Float32Array(m.P);
  for (let k = 0; k < Math.min(weights.length, m.k); k++) {
    const w = weights[k]; if (!w) continue;
    const o = k * m.n * 3; for (let i = 0; i < P.length; i++) P[i] += w * m.shapes[o + i];
  }
  let lo = 1e9, hi = -1e9; for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); }
  const k = height / (hi - lo);
  for (let i = 0; i < P.length; i += 3) { P[i] *= k; P[i + 1] = (P[i + 1] - lo) * k; P[i + 2] *= k; }
  if (sculpt) {
    const value = id => sculpt[id] || 0;
    for (const c of bodyControls(m)) {                               // after the scale, scaled with it: as the Studio adds it
      const v = SC.fieldValue(c, value, anime) * k; if (!v) continue;
      for (let q = 0; q < c.idx.length; q++) { const i = c.idx[q] * 3; P[i] += v * c.d[q * 3]; P[i + 1] += v * c.d[q * 3 + 1]; P[i + 2] += v * c.d[q * 3 + 2]; }
    }
    if (anime && Math.abs(value("bust")) > 1) {                               // a full bust, or a flat chest: made on the body as it now is (sculpt.js bustShape)
      const r = SC.bustShape(bodySculpt0(m), i => [P[i * 3] / k, P[i * 3 + 1] / k, P[i * 3 + 2] / k], value("bust"), 1, form);
      for (let q = 0; q < r.idx.length; q++) { const i = r.idx[q] * 3; P[i] += k * r.d[q * 3]; P[i + 1] += k * r.d[q * 3 + 1]; P[i + 2] += k * r.d[q * 3 + 2]; }
      for (let g = 0; g < r.gather.length; g += 2) { const i = r.gather[g] * 3, a = r.gather[g + 1] * 3; P[i] = P[a]; P[i + 1] = P[a + 1]; P[i + 2] = P[a + 2]; }   // (a form's gathered points exactly on the points they lie on)
    }
  }
  return { P, T: m.T };
}

/** a body as the Character Studio makes a child or a creature (grow.js, DECISIONS 2026-11-10, night): `age` 8 to 17
    (or none: the adult) on a base (-1 feminine .. 1 masculine), `sculpt` on top ({control: value}), scaled to `height`
    (an age's average when not given), feet on the floor. Returns { P, T, scale, F: each point's own scale (the joints'),
    weights, age: grow.js's ageOf, gather: a dress form's gathered points (pairs: a point, the point it lies on) } */
export function grownBody(m, { age = 18, base = 0, v2 = 0, body2 = 0, head = null, body = null, trial = null, trialHead = null, height = null, sculpt = {}, monster = false, anime = false, form = false } = {}) {   // anime, form: as mhrBody's; head, body: the feminine end's head and body presets by name (grow.js HEADS, BODIES; MHR_presets.json); v2: 1 and body2: 1 the older words for head "v2female" and body "bodyv2"; trial, trialHead: { weights, sculpt } in the body's or the head's preset's place (one being fitted)
  const PF = presetsFile(), G = grow(m), A = GW.ageOf(age, base, G.grow), pre = PF.presets, ms = pre.masculine || [], t = base * A.sexed, hk = Math.abs(base) * (0.4 + 0.6 * A.sexed);
  const FE = GW.femEnd(PF, { head: head ?? (v2 ? "v2female" : ""), body: body ?? (body2 ? "bodyv2" : ""), trial, trialHead }), f = FE.weights, fem = FE.sculpt;   // (a body preset changes only the body's weights and controls, a head preset only the head's and the neck's)
  const weights = Array.from({ length: m.k }, (_, i) => i < 20 ? (f[i] || 0) * (1 - t) / 2 + (ms[i] || 0) * (1 + t) / 2 : hk * ((base < 0 ? f : ms)[i] || 0));
  const SF = PF.sculpt || {};
  const carried = id => fem(id) * (1 - base) / 2 + ((SF.masculine || {})[id] || 0) * (1 + base) / 2;
  const value = id => { const v = (sculpt[id] || 0) + carried(id) + (A.sculpt[id] || 0); if (!v) return 0; const R = GW.REACH[id], [lin, lim] = GW.limits(id, monster, anime); let o = GW.soften(v, lin, lim); if (R) o = Math.min(R[1], Math.max(R[0], o)); return o; };
  const X = new Float32Array(m.P), F = new Float32Array(m.n).fill(1);
  for (let k = 0; k < m.k; k++) { const w = weights[k]; if (!w) continue; const o = k * m.n * 3; for (let i = 0; i < X.length; i++) X[i] += w * m.shapes[o + i]; }
  GW.applyProps(G.grow, value, X, m.P, F);
  let lo = 1e9, hi = -1e9; for (let i = 1; i < X.length; i += 3) { lo = Math.min(lo, X[i]); hi = Math.max(hi, X[i]); }
  const h = height ?? A.height ?? 1.7, k = h / (hi - lo), P = new Float32Array(X.length);
  for (let i = 0; i < X.length; i += 3) { P[i] = X[i] * k; P[i + 1] = (X[i + 1] - lo) * k; P[i + 2] = X[i + 2] * k; }
  for (const c of G.sculpt.controls) { const v = SC.fieldValue(c, value, anime); if (!v) continue; for (let q = 0; q < c.idx.length; q++) { const i = c.idx[q] * 3, s = v * k * F[c.idx[q]]; P[i] += s * c.d[q * 3]; P[i + 1] += s * c.d[q * 3 + 1]; P[i + 2] += s * c.d[q * 3 + 2]; } }
  let gather = [];
  if (anime && Math.abs(value("bust")) > 1) {                        // Anime: a full bust, or a flat chest: made on the body as it now is, at its chest's own size (sculpt.js bustShape)
    const B = G.sculpt.bust[0], size = B.idx.reduce((a, i) => a + F[i], 0) / B.idx.length;
    const r = SC.bustShape(G.sculpt, i => [P[i * 3] / k, P[i * 3 + 1] / k, P[i * 3 + 2] / k], value("bust"), size, form);
    for (let q = 0; q < r.idx.length; q++) { const i = r.idx[q] * 3; P[i] += k * r.d[q * 3]; P[i + 1] += k * r.d[q * 3 + 1]; P[i + 2] += k * r.d[q * 3 + 2]; }
    for (let g = 0; g < r.gather.length; g += 2) { const i = r.gather[g] * 3, a = r.gather[g + 1] * 3; P[i] = P[a]; P[i + 1] = P[a + 1]; P[i + 2] = P[a + 2]; }   // (a form's gathered points exactly on the points they lie on)
    gather = r.gather;
  }
  let a = 1e9, b = -1e9; for (let i = 1; i < P.length; i += 3) { a = Math.min(a, P[i]); b = Math.max(b, P[i]); }   // exactly as tall as its height says, after everything (index.html exactHeight)
  const e = h / (b - a); for (let i = 0; i < P.length; i += 3) { P[i] *= e; P[i + 1] = (P[i + 1] - a) * e; P[i + 2] *= e; }
  return { P, T: m.T, scale: k * e, F, weights, age: A, height: h, gather };
}
// the whole sculpt and the proportions on MHR's base, once: the face's fields by MediaPipe's points on it (the Studio's
// server's, kept in Bodies/MHR_landmarks.json), the proportions on MHR's rig
let GROWN = null;
function grow(m) {
  if (GROWN) return GROWN;
  const LM = JSON.parse(readFileSync(join(ROOT, "Content", "Studio", "Bodies", "MHR_landmarks.json"), "utf8"));
  const lm = i => { const t = LM.tri[i] * 3, b = LM.bary[i], o = [0, 0, 0]; for (let k = 0; k < 3; k++) { const v = m.T[t + k] * 3; for (let a = 0; a < 3; a++) o[a] += b[k] * m.P[v + a]; } return o; };
  const rb = readFileSync(join(ROOT, "Content", "Studio", "Bodies", "MHR_lod1_rig.bin")), rig = PO.readRig(rb.buffer.slice(rb.byteOffset, rb.byteOffset + rb.byteLength));
  return (GROWN = { sculpt: SC.buildSculpt({ P: m.P, T: m.T, lm }), grow: GW.buildGrow({ P: m.P, rig, chin: lm(152), eyes: (lm(145)[1] + lm(374)[1]) / 2 - 0.004 }), rig, lm: LM });
}
export const growRig = m => grow(m).rig;
/** MediaPipe's point i on a body's points (MHR's landmarks: a triangle and a place in it) */
export function landmark(m, P, i) { const LM = grow(m).lm, t = LM.tri[i] * 3, b = LM.bary[i], o = [0, 0, 0]; for (let k = 0; k < 3; k++) { const v = m.T[t + k] * 3; for (let a = 0; a < 3; a++) o[a] += b[k] * P[v + a]; } return o; }

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
let CONTROLS = null, SCULPT0 = null;
const bodySculpt0 = m => SCULPT0 ||= SC.buildSculpt({ P: m.P, T: m.T, lm: () => [0, 1.6, 0.1] });
const bodyControls = m => CONTROLS ||= bodySculpt0(m).controls.filter(c => c.group === "Body");
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

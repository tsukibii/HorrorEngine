// GROW: the Character Studio's proportions, ages, Cutify and creatures (grow.js, and the sculpt's fields they use) on
// MHR's own base body, without a browser. Every control well formed (sorted points, no NaN, the same on both sides);
// nothing here moves a point of the head against another (the head is the unit: a fitted face, the eyes, the teeth and
// the hair stay as made), and the body's size against the head leaves it where it was; the adult is nothing at all;
// each age's head is the chart's share of its height, the build narrower and the legs' share as children's are; the
// joints follow a body whose parts were sized apart; a slider's sum eases into its limit; no field folds the skin over
// at a monster's reach; every name an age, Cutify, a creature or a limit uses is a control that exists; and a
// creature's teeth (fangs, points) leave an adult's plain ones as they were.
// Ends "GROW ok".
//   node tools/character/growtest.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as PO from "./pose.js";
import * as GW from "./grow.js";
import * as SC from "./sculpt.js";
import { loadMhr, grownBody, landmark } from "./tailor/node.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url)), B = path.join(HERE, "..", "..", "Content", "Studio", "Bodies");
let bad = 0;
const say = (ok, words) => { if (!ok) bad++; console.log((ok ? "  ok  " : "  BAD ") + words); };
const ab = f => { const b = fs.readFileSync(path.join(B, f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const buf = ab("MHR_lod1.bin"), hl = new DataView(buf).getUint32(0, true), H = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
const N = H.points, P = new Float32Array(buf.slice(H.points_at, H.points_at + N * 12)), T = new Uint32Array(buf.slice(H.triangles_at, H.triangles_at + H.triangles * 12));
const rig = PO.readRig(ab("MHR_lod1_rig.bin")), LM = JSON.parse(fs.readFileSync(path.join(B, "MHR_landmarks.json"), "utf8"));
const lmOn = X => i => { const t = LM.tri[i] * 3, b = LM.bary[i], o = [0, 0, 0]; for (let k = 0; k < 3; k++) { const v = T[t + k] * 3; for (let a = 0; a < 3; a++) o[a] += b[k] * X[v + a]; } return o; };
const lm = lmOn(P);

const S = SC.buildSculpt({ P, T, lm }), G = GW.buildGrow({ P, rig, chin: lm(152), eyes: (lm(145)[1] + lm(374)[1]) / 2 - 0.004 });
const M = loadMhr();                                                     // (the same file again, as the tailor's node side reads it: grownBody, the body as the Studio composes it)
const ALL = [...S.controls, ...G.controls], byId = new Map(ALL.map(c => [c.id, c]));
const span = X => { let lo = Infinity, hi = -Infinity; for (let i = 1; i < X.length; i += 3) { lo = Math.min(lo, X[i]); hi = Math.max(hi, X[i]); } return [lo, hi]; };

// ---- every control well formed
{
  let unsorted = 0, nan = 0, worst = 0, worstId = "", unmatched = 0, moved = 0;
  // a point's mirror image, where the base has one exactly (the head's points all; most of the body's); a point on the
  // middle is its own: what a control does sideways there must be nothing, or the two halves pull apart
  const key = (x, y, z) => { const ax = Math.round(Math.abs(x) * 1e5); return `${ax},${Math.round(y * 1e5)},${Math.round(z * 1e5)},${ax ? Math.sign(x) : 0}`; }, Mp = new Map();
  for (let i = 0; i < N; i++) Mp.set(key(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]), i);
  for (const c of ALL) {
    for (let q = 1; q < c.idx.length; q++) if (c.idx[q] <= c.idx[q - 1]) unsorted++;
    for (const v of c.d) if (!Number.isFinite(v)) nan++;
    const at = new Map(); c.idx.forEach((i, q) => at.set(i, q)); moved += c.idx.length;
    for (let q = 0; q < c.idx.length; q++) { const i = c.idx[q], m = Mp.get(key(-P[i * 3], P[i * 3 + 1], P[i * 3 + 2])); if (m === undefined) { unmatched++; continue; }
      const k = at.get(m), o = k === undefined ? [0, 0, 0] : [c.d[k * 3], c.d[k * 3 + 1], c.d[k * 3 + 2]], e = Math.max(Math.abs(c.d[q * 3] + o[0]), Math.abs(c.d[q * 3 + 1] - o[1]), Math.abs(c.d[q * 3 + 2] - o[2]));
      if (e > worst) { worst = e; worstId = c.id; } }
  }
  say(ALL.length >= 50 && !unsorted && !nan, `${S.controls.length} sculpt controls and ${G.controls.length} proportions, their points in order, no NaN`);
  say(worst < 4e-6 && unmatched < 0.1 * moved, `each the same on both sides and nothing sideways at the middle (a point and its mirror image: ${(worst * 1e6).toFixed(1)} µm apart at most, in ${worstId}; the rig's weights are 16-bit)`);
}

// ---- the head is the unit: its points move as one (or not at all)
{
  const HEAD = new Uint8Array(rig.bones.length); for (const b of rig.order) { const p = rig.bones[b].parent; HEAD[b] = rig.bones[b].name === "c_head" || (p >= 0 && HEAD[p]) ? 1 : 0; }
  const head = []; for (let i = 0; i < N; i++) { let w = 0; for (let k = 0; k < 4; k++) if (HEAD[rig.BI[i * 4 + k]]) w += rig.BW[i * 4 + k]; if (w > 0.999) head.push(i); }
  const pick = head.filter((_, k) => k % 37 === 0), d = (X, a, b) => Math.hypot(X[a * 3] - X[b * 3], X[a * 3 + 1] - X[b * 3 + 1], X[a * 3 + 2] - X[b * 3 + 2]);
  let worst = 0, still = 0;
  for (const c of G.controls) for (const v of [-3, -1, 1, 3]) {
    const X = Float32Array.from(P); GW.applyProps(G, id => id === c.id ? v : 0, X, P);
    for (let k = 1; k < pick.length; k++) worst = Math.max(worst, Math.abs(d(X, pick[0], pick[k]) - d(P, pick[0], pick[k])));
    if (c.id === "head_size" || c.id === "legs_length" || c.id === "arms_length" || c.id === "hands" || c.id === "feet" || c.id === "fingers") for (const i of pick) still = Math.max(still, d(X, i, i) + Math.hypot(X[i * 3] - P[i * 3], X[i * 3 + 1] - P[i * 3 + 1], X[i * 3 + 2] - P[i * 3 + 2]));
  }
  say(head.length > 3000 && worst < 2e-6, `no proportion bends the head: its ${head.length} points keep their distances at every slider to ±3 (${(worst * 1e6).toFixed(2)} µm)`);
  say(still < 1e-6, `a bigger head, longer limbs, hands and feet leave the head's points exactly where they were (${(still * 1e6).toFixed(2)} µm)`);
}

// ---- the adult is nothing; each age's head, height and build
{
  const A = GW.ageOf(18, 0, G), X = Float32Array.from(P), moved = GW.applyProps(G, id => A.sculpt[id] || 0, X, P);
  let same = true; for (let i = 0; i < X.length; i++) if (X[i] !== P[i]) { same = false; break; }
  say(!moved && same && !Object.keys(A.sculpt).length && A.sexed === 1, "the adult (18) adds nothing: the body bit for bit as before the ages");
  const chinY = X => lmOn(X)(152)[1], width = (X, y0, y1, xmax) => { let w = 0; for (let i = 0; i < N; i++) if (X[i * 3 + 1] > y0 && X[i * 3 + 1] < y1 && Math.abs(X[i * 3]) < xmax) w = Math.max(w, Math.abs(X[i * 3])); return 2 * w; };
  const [lo0, hi0] = span(P), r0 = (hi0 - chinY(P)) / (hi0 - lo0), headAdult = (hi0 - chinY(P)) * 1.7 / (hi0 - lo0);
  let worst = 0, rise = true, last = 0, tall = 0, rows = [];
  for (let age = 8; age <= 17; age++) {
    const b = grownBody(M, { age, base: 0 }), [lo, hi] = span(b.P), chin = landmark(M, b.P, 152)[1], r = (hi - chin) / (hi - lo), want = r0 * [0.156, 0.152, 0.148, 0.144, 0.141, 0.138, 0.136, 0.134, 0.133, 0.1325][age - 8] / 0.132;
    worst = Math.max(worst, Math.abs(r / want - 1)); if (b.height <= last) rise = false; last = b.height; tall = Math.max(tall, Math.abs(hi - lo - b.height), Math.abs(lo));
    rows.push(`${age}: ${(1 / r).toFixed(2)} heads, ${b.height.toFixed(2)} m`);
    if (age === 8) {
      const headCm = (hi - chin) * 100, crotch = Math.min(...Array.from({ length: N }, (_, i) => Math.abs(b.P[i * 3]) < 0.012 * b.scale ? b.P[i * 3 + 1] : Infinity));
      say(headCm > 17.5 && headCm < 20.5 && b.scale / (1.7 / (hi0 - lo0)) > 0.9, `at eight the head is ${headCm.toFixed(1)} cm from chin to crown on a ${b.height.toFixed(2)} m body, its skull ${(b.scale / (1.7 / (hi0 - lo0)) * 100).toFixed(0)}% an adult's at 1.70 m (a child's head is most of its adult size: 93% round at eight) over a shorter face`);
      const share = (crotch - lo) / (hi - lo);
      say(share > 0.42 && share < 0.5, `its legs ${(share * 100).toFixed(1)}% of its height (a child's: 45 to 47%)`);
      let feet = Infinity, top = 0; for (let i = 0; i < N; i++) { if (b.P[i * 3 + 1] - lo < 0.03) feet = Math.min(feet, b.F[i]); if (b.P[i * 3 + 1] > hi - 0.03) top = Math.max(top, b.F[i]); }
      say(Math.abs(top - 1) < 1e-6 && feet < 0.84 && feet > 0.72, `the body under it ${(feet * 100).toFixed(0)}% of the adult's against the head (each point's own scale: 1 on the head)`);
    }
  }
  say(tall < 0.0005, `each age's body exactly its height with its feet on the floor (${(tall * 1000).toFixed(2)} mm off at most)`);
  say(worst < 0.015, `ages 8 to 17: the head's share of the height within ${(worst * 100).toFixed(1)}% of the growth chart's (${rows.filter((_, k) => k % 3 === 0).join("; ")})`);
  say(rise, "and each age's average height taller than the last");
  // the build: with the sculpt's fields an eight-year-old's shoulders and hips narrower for the body than the adult's
  const a8 = GW.ageOf(8, 0, G), F = new Float32Array(N * 3);
  for (const c of S.controls) { const v = a8.sculpt[c.id]; if (!v) continue; for (let q = 0; q < c.idx.length; q++) { const i = c.idx[q] * 3; F[i] += v * c.d[q * 3]; F[i + 1] += v * c.d[q * 3 + 1]; F[i + 2] += v * c.d[q * 3 + 2]; } }
  const Y = Float32Array.from(P, (v, i) => v + F[i]);
  const shx = X => PO.joints(rig, X, P, 1)[rig.byName.get("l_uparm_twist2_proc") * 3], sh = shx(Y) / shx(P), hip = width(Y, 0.94, 0.96, 0.24) / width(P, 0.94, 0.96, 0.24);
  say(sh < 0.97 && sh > 0.85 && hip < 0.98 && hip > 0.85, `an eight-year-old's shoulders ${(sh * 100).toFixed(0)}% and pelvis ${(hip * 100).toFixed(0)}% of the adult build's width (before the body's own scale)`);
  const g = GW.ageOf(8, -1, G), b = GW.ageOf(8, 1, G), g15 = GW.ageOf(15, -1, G), b15 = GW.ageOf(15, 1, G);
  say(Math.abs(g.height - b.height) < 0.02 && b15.height - g15.height > 0.05 && g.sexed === 0 && g15.sexed > 0.7, `girls and boys the same build and height at eight (${g.height} m, ${b.height} m), parted by fifteen (${g15.height} m, ${b15.height} m)`);
  const half = GW.ageOf(10, 0, G, 0.5), full = GW.ageOf(10, 0, G, 1), none = GW.ageOf(10, 0, G, 0);
  say(Math.abs(half.sculpt.face_height - full.sculpt.face_height / 2) < 1e-9 && !none.sculpt.face_height && none.sculpt.head_size === full.sculpt.head_size && none.sculpt.shoulders === full.sculpt.shoulders,
    "Young face turns the age's face down alone (for a child's own picture): the body's proportions stay");
}

// ---- the joints on a body whose parts were sized apart
{
  const a = GW.ageOf(8, 0, G), X = Float32Array.from(P), Sx = new Float32Array(N); GW.applyProps(G, id => a.sculpt[id] || 0, X, P, Sx);
  const J0 = PO.joints(rig, P, P, 1), J = PO.joints(rig, X, P, 1, Sx), ix = n => rig.byName.get(n), at = (Jx, n) => [Jx[ix(n) * 3], Jx[ix(n) * 3 + 1], Jx[ix(n) * 3 + 2]], d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const head = d(at(J, "c_head"), at(J0, "c_head")), eye = d(at(J, "l_eye"), at(J0, "l_eye")), leg = d(at(J, "l_upleg"), at(J, "l_foot")) / d(at(J0, "l_upleg"), at(J0, "l_foot")), arm = d(at(J, "l_uparm"), at(J, "l_wrist")) / d(at(J0, "l_uparm"), at(J0, "l_wrist"));
  say(head < 0.004 && eye < 0.0015, `the head's joint stays (${(head * 1000).toFixed(1)} mm) and the eye's in it (${(eye * 1000).toFixed(2)} mm)`);
  say(leg > 0.74 && leg < 0.86 && arm > 0.72 && arm < 0.84, `the leg's bones ${(leg * 100).toFixed(0)}% and the arm's ${(arm * 100).toFixed(0)}% as long as the adult's: the skeleton follows the body`);
  let fin = true; for (const v of J) if (!Number.isFinite(v)) fin = false;
  say(fin, "every joint a number");
}

// ---- a slider's sum eases into its limit
{
  let ok = GW.soften(1, 1.75, 2.3) === 1 && GW.soften(-1.7, 1.75, 2.3) === -1.7 && GW.soften(1.75, 1.75, 2.3) === 1.75, mono = true, prev = -Infinity;
  for (let v = -9; v <= 9; v += 0.05) { const s = GW.soften(v, 1.75, 2.3); if (s < prev - 1e-12 || Math.abs(s) > 2.3) mono = false; prev = s; }
  say(ok && mono && GW.soften(9, 3, 3.4) < 3.4 && GW.soften(9, 3, 3.4) > 3.39, "a sum a character could have before the ages is as it was (to 1.75); past it it eases into the limit and never passes it");
}

// ---- no field folds the skin over at a monster's reach (a triangle turned to face the other way)
{
  const nrm = (X, t) => { const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3, u = [X[b] - X[a], X[b + 1] - X[a + 1], X[b + 2] - X[a + 2]], v = [X[c] - X[a], X[c + 1] - X[a + 1], X[c + 2] - X[a + 2]];
    return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; };
  const flips = (id, v) => { const c = byId.get(id), X = Float32Array.from(P); if (c.prop) GW.applyProps(G, k => k === id ? v : 0, X, P); else for (let q = 0; q < c.idx.length; q++) { const i = c.idx[q] * 3; X[i] += v * c.d[q * 3]; X[i + 1] += v * c.d[q * 3 + 1]; X[i + 2] += v * c.d[q * 3 + 2]; }
    const hit = new Uint8Array(N); for (const i of c.idx) hit[i] = 1; let n = 0;
    for (let t = 0; t < T.length; t += 3) { if (!hit[T[t]] && !hit[T[t + 1]] && !hit[T[t + 2]]) continue; const a = nrm(P, t), b = nrm(X, t); if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < 0) n++; } return n; };
  const at = id => { const R = GW.REACH[id] || [-3.4, 3.4]; return [Math.max(-3, R[0]), Math.min(3, R[1])]; };
  const NEW = ["face_height", "face_round", "eye_size", "eye_spacing", "eye_depth", "eye_tilt", "snout", "skull_back", "bust", "seat", "head_size", "neck_length", "torso_length", "legs_length", "arms_length", "hands", "feet", "fingers"];
  const rows = NEW.map(id => [id, Math.max(...at(id).map(v => flips(id, v)))]), worst = rows.filter(r => r[1] > 0);
  say(!worst.length, `at their furthest in monster mode, ${NEW.length} of the new fields turn no triangle over` + (worst.length ? `: ${worst.map(r => r.join(" ")).join(", ")}` : ""));
  const ears = ["ears_size", "ears_out", "ears_point"].map(id => [id, Math.max(...at(id).map(v => flips(id, v)))]), hunch = flips("hunch", 3);
  say(ears.every(r => r[1] <= 60) && hunch <= 90, `the ears' three (an ear is a fold of folds: ${ears.map(r => r.join(" ")).join(", ")} of its small triangles turn at 3) and a hunch at 3 (${hunch}, in the waist's crease) stay a creature's`);
  const person = [...NEW, "ears_size", "ears_out", "hunch"].map(id => [id, Math.max(flips(id, Math.min(1, at(id)[1])), flips(id, Math.max(-1, at(id)[0])))]).filter(r => r[1] > 0);
  say(!person.length, "within a person's range (±1) none of them turns any" + (person.length ? `: ${person.map(r => r.join(" ")).join(", ")}` : ""));
}

// ---- every name used is a control that exists; the creatures' builds are MHR's own shapes
{
  const names = [["a child's body", GW.CHILD_BODY], ["a child's face", GW.CHILD_FACE], ["Cutify", GW.CUTE], ["the limits", GW.REACH], ...Object.entries(GW.MONSTERS).map(([k, m]) => [`the ${k}`, m.sculpt])];
  const lost = names.flatMap(([what, o]) => Object.keys(o).filter(id => !byId.has(id)).map(id => `${what}: ${id}`));
  say(!lost.length, `the ages, Cutify, the limits and ${Object.keys(GW.MONSTERS).length} creatures name only controls that exist` + (lost.length ? ` (missing: ${lost.join(", ")})` : ""));
  const reach = Object.values(GW.MONSTERS).every(m => Object.values(m.sculpt).every(v => Math.abs(v) <= 3) && Object.entries(m.shape || {}).every(([i, v]) => +i >= 0 && +i < H.shapes && Math.abs(v) <= 3) && m.height >= 0.4 && m.height <= 3.5 && Math.abs(m.base ?? 0) <= 1);
  say(reach, "each creature within monster mode's reach (sliders to ±3, MHR's shapes to ±3, 0.4 to 3.5 m)");
  const hs = G.handles.every(h => h.at[0] >= 0 && h.controls.every(id => byId.has(id))) && S.handles.every(h => h.controls.every(id => byId.has(id)));
  say(hs && G.handles.length >= 6, `${S.handles.length + G.handles.length} circles on the body, each on a point and dragging controls that exist`);
}

// ---- a creature's teeth (teeth.js): plain ones as they always were; fangs longer past the edge; points on every tooth
{
  const T = await import("./teeth.js"), a = T.buildMouth(), z = T.buildMouth({ fangs: 0, points: 0 }), f = T.buildMouth({ fangs: 1 }), p = T.buildMouth({ points: 1 });
  const same = (A, B2) => A.length === B2.length && A.every((v, i) => v === B2[i]), lowY = m => { let lo = 1e9; for (let i = 1; i < m.pos.length; i += 3) lo = Math.min(lo, m.pos[i]); return lo; }, hiY = m => { let hi = -1e9; for (let i = 1; i < m.pos.length; i += 3) hi = Math.max(hi, m.pos[i]); return hi; };
  const wide = m => { let w = 0, n = 0; for (let i = 0; i < m.pos.length; i += 3) if (m.pos[i + 1] < 0.8 && Math.abs(m.pos[i]) < 9) { w += Math.abs(m.pos[i]); n++; } return w / n; };   // how far from the middle the front teeth's edges reach, on average
  let nan = 0; for (const m of [f.upper.teeth, f.lower.teeth, p.upper.teeth, p.lower.teeth]) for (const v of m.pos) if (!Number.isFinite(v)) nan++;
  say(same(a.upper.teeth.pos, z.upper.teeth.pos) && same(a.lower.teeth.pos, z.lower.teeth.pos) && Math.abs(lowY(a.upper.teeth) + 0.6) < 1e-9, "teeth without fangs or points are an adult's as before (the upper edge 0.6 mm under the line)");
  say(!nan && lowY(f.upper.teeth) < -7 && hiY(f.lower.teeth) > hiY(a.lower.teeth) + 4 && f.upper.teeth.pos.length === a.upper.teeth.pos.length, `fangs at 1: the upper canines ${(-lowY(f.upper.teeth) - 0.6).toFixed(1)} mm past the others' edge, the lower ${(hiY(f.lower.teeth) - hiY(a.lower.teeth)).toFixed(1)} mm up`);
  say(lowY(p.upper.teeth) < -1.5 && lowY(p.upper.teeth) > -3 && wide(p.upper.teeth) !== wide(a.upper.teeth), `pointed teeth at 1: every tooth drawn to a point, the front ones ${(-lowY(p.upper.teeth) - 0.6).toFixed(1)} mm longer`);
}

if (bad) { console.log(`GROW FAIL: ${bad}`); process.exit(1); }
console.log("GROW ok");

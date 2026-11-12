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
  // a head never shrinks as it grows up: at each base the skull (the body's scale: the head is the unit) no smaller than
  // the year before and never bigger than the adult's at that base's adult height
  {
    let bad = [], rowsK = [];
    for (const base of [-1, 0, 1]) {
      const adult = grownBody(M, { age: 18, base }).scale; let prev = 0, ks = [];
      for (let age = 8; age <= 18; age++) { const k = grownBody(M, { age, base }).scale / adult; if (k < prev - 2e-3 || k > 1 + 2e-3) bad.push(`${base}:${age} ${k.toFixed(4)}`); prev = k; ks.push(k); }
      rowsK.push(`${base < 0 ? "feminine" : base > 0 ? "masculine" : "between"} ${(ks[0] * 100).toFixed(0)}% at 8, ${(ks[4] * 100).toFixed(0)}% at 12, ${(ks[6] * 100).toFixed(0)}% at 14`);
    }
    say(!bad.length, `a skull never shrinks growing up, nor outgrows the adult's: ${rowsK.join("; ")}${bad.length ? " (BAD " + bad.join(", ") + ")" : ""}`);
  }
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
  const NEW = ["neck_base", "shoulder_slope", "face_taper", "face_height", "face_round", "eye_size", "eye_spacing", "eye_depth", "eye_tilt", "snout", "skull_back", "bust", "seat", "head_size", "neck_length", "torso_length", "legs_length", "arms_length", "hands", "feet", "fingers"];
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
  // a creature as a preset (the Body tab's cards): its name, a word about it, a look whose colours are colours and whose
  // horns are a kind horns.js makes (the look's other names are the page's own: GROWPAGE checks them there)
  const src = fs.readFileSync(path.join(HERE, "horns.js"), "utf8"), kinds = new Set([...src.slice(src.indexOf("export const HORNS"), src.indexOf("export const EARS")).matchAll(/^  (\w+): \{/gm)].map(m => m[1]));
  const hex = c => /^#[0-9a-f]{6}$/i.test(c || ""), colours = o => Object.entries(o || {}).filter(([k]) => /color$|^tone$|^iris2?$|^sclera$|^corner$|^accent$/i.test(k)).every(([, v]) => hex(v));
  const odd = Object.entries(GW.MONSTERS).filter(([, m]) => !(m.label && m.about && m.look && hex(m.look.tone) && colours(m.look.skin?.tweak) && colours(m.look.eyes?.set) && colours(m.look.lips) && (!m.look.horns || kinds.has(m.look.horns.style)))).map(([k]) => k);
  say(!odd.length && kinds.size >= 13, `each creature a preset with its name, a word about it and a look (a skin colour, its eyes, lips, teeth; horns of a kind there is)` + (odd.length ? `: not ${odd.join(", ")}` : ""));
  const heads = byId.size && [...byId.values()].filter(c => GW.onHead(c)), body = [...byId.values()].filter(c => !GW.onHead(c));
  say(heads.length > 20 && body.some(c => c.id === "hunch") && body.some(c => c.group === "Body") && !heads.some(c => c.group === "Body" || c.prop), `"Face only" is the head's ${heads.length} controls: the Face group and the Creature group but the hunch; nothing of the body's or the proportions'`);
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

// ---- Anime: the Bust slider past its bump's ends (sculpt.js bustShape; DECISIONS 2026-11-11: "more flat too but also
// more busty like the image", of the first try "unnaturally pointy ... more how a water balloon would sit", and then
// "keep the new bust slider as an 'anime' toggleable"): with Anime on, on the feminine body, the slider from flat (-2)
// to its top (3). The bump's field stops at -1 and 1; past them the shape is made on the body as it is. With Anime off
// the Bust is the bump alone at any value, as it always was. Nothing but the breasts' own points moves (the fold under them, the ribs, the arms stay);
// the two sides alike; bigger at every step; the front of a full bust a ball (a sphere fits it: no point), its middle
// below the breast's root (the weight low), the ball's front blunt; at -2 the chest flat
{
  const bustC = byId.get("bust"), F = S.bust, foot = new Set([...F[0].idx, ...F[1].idx]);
  say(SC.fieldValue(bustC, () => 3, true) === 1 && SC.fieldValue(bustC, () => -2, true) === -1 && SC.fieldValue(bustC, () => 0.4, true) === 0.4 && GW.SPAN.bust && byId.has("bust") && GW.limits("bust", false, true)[0] === 3 && GW.limits("waist", false, true)[0] === 1.75 && GW.limits("bust", true, true)[0] === 3,
    "Anime on: the Bust's bump stops at -1 and 1 (past them the shape is made on the body); its slider runs -2 to 3 and its sum eases in past 3, the others' as before");
  // off: the plain slider. The bump is the whole of it at any value (a monster's 3 too), its limits a person's, and a
  // body made with a Bust past 1 is the bump's own, point for point
  { const plain = (v, monster) => { const G0 = grownBody(M, { base: -1, height: 1.62, sculpt: { bust: v }, monster }), Z = grownBody(M, { base: -1, height: 1.62, sculpt: {}, monster }), c = byId.get("bust"); let worst = 0, moved = 0;
      const at = new Map(); c.idx.forEach((i, q) => at.set(i, q));
      for (let i = 0; i < N; i++) { const q = at.get(i), w = q === undefined ? [0, 0, 0] : [c.d[q * 3], c.d[q * 3 + 1], c.d[q * 3 + 2]];
        for (let a = 0; a < 3; a++) { const d = G0.P[i * 3 + a] - Z.P[i * 3 + a]; if (Math.abs(d) > 1e-6) moved++; worst = Math.max(worst, Math.abs(d - v * G0.scale * w[a])); } } return { worst, moved }; };
    const p3 = plain(3, true), p1 = plain(1, false);
    say(SC.fieldValue(bustC, () => 3) === 3 && SC.fieldValue(bustC, () => -2) === -2 && GW.limits("bust", false)[0] === 1.75 && GW.limits("bust", true)[0] === 3 && p3.worst < 2e-5 && p1.worst < 2e-5 && p3.moved > 0,
      `Anime off: the Bust is the bump alone at any value, as it was (a monster's 3: every point within ${(p3.worst * 1e6).toFixed(0)} µm of three times the bump), its limits the others'`); }
  const body = v => grownBody(M, { base: -1, height: 1.62, sculpt: { bust: v }, anime: true }), B0 = body(0), at = (X, i) => [X[i * 3], X[i * 3 + 1], X[i * 3 + 2]];
  let nan = 0, stray = 0, asym = 0, last = -1, grows = true; const front = {};
  const mirror = new Map(); { const key = (x, y, z) => `${Math.round(Math.abs(x) * 2e4)},${Math.round(y * 2e4)},${Math.round(z * 2e4)}`, L = new Map();
    for (const i of F[0].idx) L.set(key(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]), i); for (const j of F[1].idx) { const i = L.get(key(P[j * 3], P[j * 3 + 1], P[j * 3 + 2])); if (i !== undefined) mirror.set(i, j); } }
  for (const v of [-2, -1.5, 1.3, 1.6, 2, 3]) {
    const X = body(v).P, R = body(Math.max(-1, Math.min(1, v))).P;      // against the bump's own end: what the shape adds
    for (let i = 0; i < N; i++) { const d = Math.hypot(X[i * 3] - R[i * 3], X[i * 3 + 1] - R[i * 3 + 1], X[i * 3 + 2] - R[i * 3 + 2]); if (!Number.isFinite(d)) nan++; else if (d > 2e-5 && !foot.has(i)) stray++; }
    for (const [i, j] of mirror) asym = Math.max(asym, Math.abs(X[i * 3] + X[j * 3]), Math.abs(X[i * 3 + 1] - X[j * 3 + 1]), Math.abs(X[i * 3 + 2] - X[j * 3 + 2]));
    let z = -1; for (const i of F[0].idx) z = Math.max(z, X[i * 3 + 2]); front[v] = z; if (v > 0) { if (z <= last) grows = false; last = z; }
  }
  say(!nan && !stray && mirror.size > 0.9 * F[0].idx.length, `the shape moves the breasts' own ${F[0].idx.length} points a side and nothing else (the fold, the ribs and the arms stay), no NaN`);
  say(asym < 0.002, `the two sides alike (${(asym * 1000).toFixed(2)} mm apart at most)`);
  let z0 = -1; for (const i of F[0].idx) z0 = Math.max(z0, B0.P[i * 3 + 2]);
  say(grows && front[3] - z0 > 0.07 && front[1.6] - z0 > 0.02 && front[1.6] - z0 < 0.06, `fuller at every step: the front ${((front[1.3] - z0) * 100).toFixed(1)} cm further out at 1.3, ${((front[1.6] - z0) * 100).toFixed(1)} at 1.6, ${((front[2] - z0) * 100).toFixed(1)} at 2, ${((front[3] - z0) * 100).toFixed(1)} at 3 (the picture's)`);
  // a ball: a sphere through the points of the breast's front half (those nearer its middle than its edge)
  const sphere = X => { const pts = []; F[0].idx.forEach((i, q) => { if (F[0].share[q] < 0.62 && F[0].g[q] > 0.9) pts.push(at(X, i)); });
    // least squares: |p|^2 = 2 c.p + (r^2 - |c|^2)
    const A = [0, 0, 0, 0].map(() => [0, 0, 0, 0]), b = [0, 0, 0, 0];
    for (const p of pts) { const r = [2 * p[0], 2 * p[1], 2 * p[2], 1], y = p[0] * p[0] + p[1] * p[1] + p[2] * p[2]; for (let a = 0; a < 4; a++) { b[a] += r[a] * y; for (let c = 0; c < 4; c++) A[a][c] += r[a] * r[c]; } }
    for (let c = 0; c < 4; c++) { let pv = c; for (let r = c + 1; r < 4; r++) if (Math.abs(A[r][c]) > Math.abs(A[pv][c])) pv = r; [A[c], A[pv]] = [A[pv], A[c]]; [b[c], b[pv]] = [b[pv], b[c]];
      for (let r = 0; r < 4; r++) { if (r === c) continue; const m = A[r][c] / A[c][c]; for (let k = c; k < 4; k++) A[r][k] -= m * A[c][k]; b[r] -= m * b[c]; } }
    const c = [b[0] / A[0][0], b[1] / A[1][1], b[2] / A[2][2]], rad = Math.sqrt(b[3] / A[3][3] + c[0] * c[0] + c[1] * c[1] + c[2] * c[2]);
    let rms = 0, tip = 0; for (const p of pts) { const e = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - rad; rms += e * e; tip = Math.max(tip, e); }
    let rootY = 0, n = 0; for (const j of F[0].ring) { rootY += X[j * 3 + 1]; n++; }
    return { rad, rms: Math.sqrt(rms / pts.length), tip, n: pts.length, below: rootY / n - c[1] }; };
  const b3 = sphere(body(3).P), b16 = sphere(body(1.6).P);
  // the cone it replaces: the bump alone pushed to 3 on the same body, as the slider did before
  const cone = (() => { const G0 = grownBody(M, { base: -1, height: 1.62, sculpt: {} }), Y = Float32Array.from(G0.P), c = byId.get("bust");
    for (let q = 0; q < c.idx.length; q++) { const i = c.idx[q] * 3; Y[i] += 3 * G0.scale * c.d[q * 3]; Y[i + 1] += 3 * G0.scale * c.d[q * 3 + 1]; Y[i + 2] += 3 * G0.scale * c.d[q * 3 + 2]; } return sphere(Y); })();
  say(b3.rms < 0.006 && b3.tip < 0.012 && b3.rad > 0.07 && b3.rad < 0.12 && b16.rms < 0.006 && b16.rad > 0.045 && b16.rad < b3.rad,
    `a full bust's front is a ball: a sphere of ${(b3.rad * 100).toFixed(1)} cm fits ${b3.n} of its points within ${(b3.rms * 1000).toFixed(1)} mm (none over ${(b3.tip * 1000).toFixed(1)} mm proud of it) at 3, ${(b16.rad * 100).toFixed(1)} cm within ${(b16.rms * 1000).toFixed(1)} mm at 1.6`);
  say(cone.tip > 2 * b3.tip && cone.rms > 2 * b3.rms && b3.below > 0.02 && b16.below > 0, `not a point (the bump alone pushed to 3, as it was: ${(cone.tip * 1000).toFixed(0)} mm proud of its best sphere, ${(cone.rms * 1000).toFixed(1)} mm off it all over) and its weight low (the ball's middle ${(b3.below * 100).toFixed(1)} cm under the middle of the breast's root at 3, ${(b16.below * 100).toFixed(1)} at 1.6)`);
  // flat: how far the breast stands in front of the plane through its own ring (z = a x + b y + c, least squares)
  const proud = v => { const X = body(v).P, Rg = [...F[0].ring].map(j => at(X, j)), A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
    for (const p of Rg) { const r = [p[0], p[1], 1]; for (let a = 0; a < 3; a++) { b[a] += r[a] * p[2]; for (let c = 0; c < 3; c++) A[a][c] += r[a] * r[c]; } }
    for (let c = 0; c < 3; c++) { let pv = c; for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[pv][c])) pv = r; [A[c], A[pv]] = [A[pv], A[c]]; [b[c], b[pv]] = [b[pv], b[c]];
      for (let r = 0; r < 3; r++) { if (r === c) continue; const m = A[r][c] / A[c][c]; for (let k = c; k < 3; k++) A[r][k] -= m * A[c][k]; b[r] -= m * b[c]; } }
    const pl = [b[0] / A[0][0], b[1] / A[1][1], b[2] / A[2][2]]; let best = -1;
    for (const i of F[0].idx) best = Math.max(best, X[i * 3 + 2] - (pl[0] * X[i * 3] + pl[1] * X[i * 3 + 1] + pl[2])); return best; };
  // the dress form (what the tailor cuts on): the same ball with no hollow under it. On the real one the skin under a
  // full bust faces away from the chest's front (its underside); on the form none does. It moves the breasts' points and
  // the skin under the ball (the apron) and nothing else; under 1 it's the body itself
  { const tris = []; const inF = new Set(F[0].idx); for (let t = 0; t < T.length; t += 3) if (inF.has(T[t]) || inF.has(T[t + 1]) || inF.has(T[t + 2])) tris.push(t);   // (with the strip between the breast's last points and the fold's)
    const away = X => { let n = 0; for (const t of tris) { const a = at(X, T[t]), b = at(X, T[t + 1]), c = at(X, T[t + 2]), u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0], l = Math.hypot(nx, ny, nz); if (l > 1e-12 && (nx * F[0].nrm[0] + nz * F[0].nrm[2]) / l < -0.6) n += l / 2 * 1e4; } return n; };   // cm2 turned well away (the form's own side under the ball stands square to the chest, its foot flaring a little)
    const form = v => grownBody(M, { base: -1, height: 1.62, sculpt: { bust: v }, anime: true, form: true }).P, f3 = form(3), r3 = body(3).P, apron = new Set([...F[0].apron, ...F[1].apron]);
    let strayF = 0, movedA = 0, same = 0; for (let i = 0; i < N; i++) { const d = Math.hypot(f3[i * 3] - r3[i * 3], f3[i * 3 + 1] - r3[i * 3 + 1], f3[i * 3 + 2] - r3[i * 3 + 2]); if (d > 2e-5) { if (apron.has(i)) movedA++; else if (!foot.has(i)) strayF++; } }
    const f08 = form(0.8), r08 = body(0.8).P; for (let i = 0; i < N * 3; i++) if (f08[i] !== r08[i]) same++;
    const aR3 = away(r3), aR2 = away(body(2).P), aF3 = away(f3), aF2 = away(form(2));
    // (the hollow's own skin is gathered onto the ball's widest ring: its triangles come to nothing; what's left facing away is the foot of the strip from that ring to the ribs beyond)
    const G2 = grownBody(M, { base: -1, height: 1.62, sculpt: { bust: 2 }, anime: true, form: true }).gather, G3 = grownBody(M, { base: -1, height: 1.62, sculpt: { bust: 3 }, anime: true, form: true }).gather;
    let apart = 0; for (let g = 0; g < G3.length; g += 2) for (let a = 0; a < 3; a++) if (f3[G3[g] * 3 + a] !== f3[G3[g + 1] * 3 + a]) apart++;
    say(aR3 > 60 && aR2 > 20 && aF2 < 0.1 * aR2 && aF3 < 0.1 * aR3 && !strayF && movedA > 0 && !same && G2.length > 40 && G3.length > G2.length && !apart,
      `the dress form has no underside: of the breast's skin ${aF2.toFixed(1)} cm2 faces away from the chest's front at 2 and ${aF3.toFixed(1)} at 3, where the hanging one's underside is ${aR2.toFixed(0)} cm2 at 2 and ${aR3.toFixed(0)} at 3; the hollow's skin is gathered onto the ball's widest ring (${G2.length / 2} points at 2, ${G3.length / 2} at 3, each exactly on the point it lies on: the tailor makes them one); it moves the breasts and ${movedA} points of the skin under them out from under the ball, nothing else (${strayF}); under 1 it's the body itself`); }
  const f0 = proud(0), f1 = proud(-1), f2 = proud(-2);
  say(f2 < 0.02 && f2 < f1 - 0.008 && f1 < f0, `flatter under -1: the breast ${(f0 * 100).toFixed(1)} cm in front of the plane through its root at 0, ${(f1 * 100).toFixed(1)} at -1, ${(f2 * 100).toFixed(1)} at -2 (the chest's own wall)`);
}

// ---- the v2female base (MHR_presets.json), and the Neck width it is made with
{
  const PF = JSON.parse(fs.readFileSync(path.join(B, "MHR_presets.json"), "utf8")), ids = Object.keys((PF.sculpt || {}).v2female || {});
  say(!!PF.presets.v2female && PF.presets.v2female.length === M.k && ids.length > 5 && ids.every(id => byId.has(id)), `the v2female base: ${M.k} weights and a sculpt of ${ids.length} controls, every one a control that exists`);
  // the neck from the front at its narrowest: the least, over the heights from the chin down 7 cm, of the body's width there
  const chinY = X => landmark(M, X, 152)[1];
  const neck = X => { let best = 9; const c = chinY(X); for (let y = c; y > c - 0.07; y -= 0.004) { let w = 0; for (let i = 0; i < X.length; i += 3) if (Math.abs(X[i + 1] - y) < 0.004 && Math.abs(X[i]) < 0.14 && Math.abs(X[i]) > w) w = Math.abs(X[i]); if (w > 0.01) best = Math.min(best, w); } return best * 200; };
  const fem = grownBody(M, { base: -1 }).P, v2 = grownBody(M, { base: -1, v2: 1 }).P, slim = grownBody(M, { base: -1, sculpt: { neck_width: -1 } }).P;
  const nF = neck(fem), nV = neck(v2), nS = neck(slim);
  say(nF > 10 && nS < nF - 2.5 && nS > 6 && nV < nF - 0.8 && nV > nS + 0.5, `Neck width -1: the neck at its narrowest from the front ${nF.toFixed(1)} cm on the feminine base, ${nS.toFixed(1)} with it; v2female, which carries it at ${PF.sculpt.v2female.neck_width}, ${nV.toFixed(1)}`);
  // the face stays: its own points (the chin, the nose's tip, the mouth's and the eyes' corners, the face's sides by the ears, the forehead's top), and the jaw's angles hardly
  const mv = i => Math.hypot(...landmark(M, slim, i).map((v, k) => v - landmark(M, fem, i)[k])) * 1000, face = Math.max(...[152, 1, 61, 291, 33, 263, 234, 454, 10].map(mv)), jawA = mv(172), underEar = mv(397);   // (172: on the jaw's line by the mouth's height; 397, its opposite number in the table, lies 4.5 cm further back: under the ear, behind the jaw, where the neck is meant to come in)
  let most = 0; for (let i = 0; i < fem.length; i += 3) most = Math.max(most, Math.hypot(slim[i] - fem[i], slim[i + 1] - fem[i + 1], slim[i + 2] - fem[i + 2]));
  say(face < 0.3 && jawA < 2 && underEar > 3 && underEar < 12 && most > 0.012 && most < 0.03, `it leaves the face where it was (its chin, nose, mouth, eyes, sides and forehead ${face.toFixed(2)} mm at the most, the jaw's line ${jawA.toFixed(1)}); under the ear, behind the jaw, the neck comes in ${underEar.toFixed(1)} mm; the neck's own points move ${(most * 1000).toFixed(0)} mm at the most`);
  // every triangle of the neck still faces the way it did, at its furthest (a column pulled in too far turns its skin over under the chin: 2 triangles at -1.6, none at -1.4, its limit)
  let flipped = 0, seen = 0; const nrm = (X, t) => { const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3, u = [X[b] - X[a], X[b + 1] - X[a + 1], X[b + 2] - X[a + 2]], v = [X[c] - X[a], X[c + 1] - X[a + 1], X[c + 2] - X[a + 2]]; return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; };
  const deep = grownBody(M, { base: -1, sculpt: { neck_width: -3 } }).P;                                     // (asked for far past it: held at its limit)
  for (let t = 0; t < T.length; t += 3) { const a = T[t] * 3; if (Math.hypot(deep[a] - fem[a], deep[a + 2] - fem[a + 2]) < 0.002) continue; seen++; const n0 = nrm(fem, t), n1 = nrm(deep, t); if (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2] <= 0) flipped++; }
  say(seen > 300 && !flipped && GW.REACH.neck_width[0] === -1.4, `asked for -3 it is held at ${GW.REACH.neck_width[0]}: none of the ${seen} triangles it moves is turned past a right angle (the neck then ${neck(deep).toFixed(1)} cm)`);
  const m0 = grownBody(M, { base: 1 }).P, m1 = grownBody(M, { base: 1, v2: 1 }).P, h0 = grownBody(M, { base: 0 }).P, h1 = grownBody(M, { base: 0, v2: 1 }).P; let dm = 0, dh = 0;
  for (let i = 0; i < m0.length; i++) { dm = Math.max(dm, Math.abs(m1[i] - m0[i])); dh = Math.max(dh, Math.abs(h1[i] - h0[i])); }
  const nH = neck(h1), nH0 = neck(h0);
  say(dm === 0 && dh > 0.003 && nH < nH0 - 0.3 && nH > nV, `it is the feminine end's: the masculine base is the same with it to the bit, halfway the neck is ${nH0.toFixed(1)} cm without it and ${nH.toFixed(1)} with`);
  // its face, against the feminine base's: the eyes much further apart and larger, a small lower face (shorter from the eyes to the chin, narrower at the jaw's angles and by the chin), a smaller mouth
  const mid = (a, c) => a.map((v, k) => (v + c[k]) / 2), eyeY = X => (landmark(M, X, 145)[1] + landmark(M, X, 374)[1]) / 2, jawW = X => Math.abs(landmark(M, X, 172)[0] - landmark(M, X, 397)[0]) * 100;
  const eyeW = X => Math.abs(landmark(M, X, 33)[0] - landmark(M, X, 133)[0]) * 1000, apart = X => Math.abs(mid(landmark(M, X, 33), landmark(M, X, 133))[0] - mid(landmark(M, X, 263), landmark(M, X, 362))[0]) * 100, long = X => (eyeY(X) - chinY(X)) * 100;
  const across = (X, a, c) => Math.abs(landmark(M, X, a)[0] - landmark(M, X, c)[0]) * 100;
  say(apart(v2) > apart(fem) + 0.7 && apart(v2) < 7.6 && eyeW(v2) > eyeW(fem) + 1 && jawW(v2) < jawW(fem) - 0.8 && long(v2) < long(fem) - 0.5 && long(v2) > long(fem) - 1.5 && across(v2, 150, 379) < across(fem, 150, 379) - 0.9 && across(v2, 61, 291) < across(fem, 61, 291) - 0.5,
    `its face: the eyes ${apart(v2).toFixed(1)} cm apart (the feminine base's ${apart(fem).toFixed(1)}), each ${eyeW(v2).toFixed(1)} mm corner to corner (${eyeW(fem).toFixed(1)}), ${long(v2).toFixed(1)} cm from the eyes' line to the chin (${long(fem).toFixed(1)}), ${jawW(v2).toFixed(1)} cm between the jaw's angles (${jawW(fem).toFixed(1)}), ${across(v2, 150, 379).toFixed(1)} across the jaw by the chin (${across(fem, 150, 379).toFixed(1)}), the mouth ${across(v2, 61, 291).toFixed(1)} (${across(fem, 61, 291).toFixed(1)})`);
  // ---- Face taper (sculpt.js): the face narrowing from the eyes down to the chin. -1: a fifth narrower at the chin, less
  // the higher (the mouth's corners a few percent), nothing at the eyes and the ears; and no ledge: at one height every
  // point moves in the same proportion of how far out it is, so the cheek is never left standing over the jaw
  const c = byId.get("face_taper"), tap = grownBody(M, { base: -1, sculpt: { face_taper: -1 } }).P, mvT = i => landmark(M, tap, i).map((v, k) => (v - landmark(M, fem, i)[k]) * 1000);
  const share = i => -mvT(i)[0] / (landmark(M, fem, i)[0] * 1000), still = Math.max(...[33, 133, 263, 362, 234, 454, 10, 168].map(i => Math.hypot(...mvT(i)))), updown = Math.max(...[150, 379, 61, 291, 172, 397].map(i => Math.hypot(mvT(i)[1], mvT(i)[2])));
  say(!!c && share(379) > 0.14 && share(379) < 0.2 && share(291) > 0.03 && share(291) < 0.1 && share(172) > share(291) && share(172) < share(379) && Math.abs(share(150) - share(379)) < 0.01 && still < 0.5 && updown < 0.05,
    `Face taper -1: the jaw by the chin ${(share(379) * 100).toFixed(0)}% nearer the middle, the jaw at the mouth's height ${(share(172) * 100).toFixed(0)}%, the mouth's corners ${(share(291) * 100).toFixed(0)}%, the two sides alike; the eyes, the face's sides by the ears, the forehead and the nose's root ${still.toFixed(2)} mm, nothing up, down, forward or back (${updown.toFixed(2)} mm)`);
  { const y0 = landmark(M, P, 152)[1] + 0.012, pts = []; for (let q = 0; q < c.idx.length; q++) { const i = c.idx[q] * 3; if (Math.abs(P[i + 1] - y0) < 0.004 && Math.abs(P[i]) > 0.012 && P[i + 2] > landmark(M, P, 172)[2]) pts.push(c.d[q * 3] / P[i]); }
    const lo = Math.min(...pts), hi = Math.max(...pts);
    say(pts.length > 8 && hi - lo < 0.03, `no ledge: across the face's front 1.2 cm over the chin, ${pts.length} points move in between ${(lo * 100).toFixed(1)} and ${(hi * 100).toFixed(1)}% of how far out they are for each unit`); }
  // ---- the shoulders and the neck's base (sculpt.js Shoulder slope, Neck base; the user on v2female, 2026-11-12: "looks a
  // bit uncanny when it should look more feminine"). Each control alone on MHR's base: where it moves and where it doesn't
  const span = (id, pick) => { const k = byId.get(id); let lo = Infinity, hi = -Infinity, side = 0, n = 0; for (let q = 0; q < k.idx.length; q++) { const i = k.idx[q] * 3; if (!pick(Math.abs(P[i]), P[i + 1], P[i + 2])) continue; n++; lo = Math.min(lo, k.d[q * 3 + 1]); hi = Math.max(hi, k.d[q * 3 + 1]); side = Math.max(side, Math.abs(k.d[q * 3]), Math.abs(k.d[q * 3 + 2])); } return { n, lo: lo * 1000, hi: hi * 1000, side: side * 1000 }; };
  const moved = (id, pick) => { const k = byId.get(id); let most = 0; for (let q = 0; q < k.idx.length; q++) { const i = k.idx[q] * 3; if (pick(Math.abs(P[i]), P[i + 1], P[i + 2])) most = Math.max(most, Math.hypot(k.d[q * 3], k.d[q * 3 + 1], k.d[q * 3 + 2])); } return most * 1000; };
  { const arm = span("shoulder_slope", (x, y) => x > 0.25), still = Math.max(moved("shoulder_slope", (x, y) => x < 0.069), moved("shoulder_slope", (x, y) => y > 1.535), moved("shoulder_slope", (x, y) => x < 0.2 && y < 1.23)), mid = span("shoulder_slope", (x, y) => Math.abs(x - 0.13) < 0.006 && y > 1.4);
    say(arm.n > 500 && Math.abs(arm.lo + 30) < 0.01 && Math.abs(arm.hi + 30) < 0.01 && arm.side === 0 && still === 0 && mid.lo < -10 && mid.hi > -20,
      `Shoulder slope 1: the arm comes down whole, ${(-arm.lo).toFixed(0)} mm, and nothing sideways; halfway out the shoulder's top ${(-mid.hi).toFixed(0)} to ${(-mid.lo).toFixed(0)} mm; within 7 cm of the middle, from the chin up and on the trunk under the armpits ${still.toFixed(2)} mm`); }
  { const top = span("neck_base", (x, y) => Math.abs(x - 0.09) < 0.008 && y > 1.47), still = Math.max(moved("neck_base", (x, y) => x < 0.045), moved("neck_base", (x, y) => x > 0.175), moved("neck_base", (x, y) => y > 1.535), moved("neck_base", (x, y) => y < 1.40));
    say(top.n > 3 && top.hi > 22 && top.hi <= 25.01 && top.side === 0 && still === 0,
      `Neck base 1: the top of the shoulder 9 cm out ${top.hi.toFixed(0)} mm higher (-1: that much lower), nothing sideways; within 4.5 cm of the middle, from the shoulder's point out, from the chin up and under 1.40 m ${still.toFixed(2)} mm`); }
  // v2female carries the Neck base at -0.3 and nothing of the slope: her pictures have the shoulders where MHR's are and
  // the rise up to the neck lower. The top of the body 9 cm out from the middle, and at the shoulder's point (17 cm)
  const topAt = (X, x) => { let y = -9; const c = chinY(X); for (let i = 0; i < X.length; i += 3) if (Math.abs(Math.abs(X[i]) - x) < 0.005 && X[i + 1] < c - 0.015 && X[i + 1] > y) y = X[i + 1]; return y * 100; };
  say(topAt(fem, 0.09) - topAt(v2, 0.09) > 0.4 && topAt(fem, 0.09) - topAt(v2, 0.09) < 1.5 && Math.abs(topAt(fem, 0.17) - topAt(v2, 0.17)) < 0.3 && PF.sculpt.v2female.shoulder_slope === undefined && PF.sculpt.v2female.shoulders === undefined,
    `v2female's neck base: the top of the shoulder 9 cm out ${(topAt(fem, 0.09) - topAt(v2, 0.09)).toFixed(1)} cm lower than the feminine base's, the shoulder's point where it was (${Math.abs(topAt(fem, 0.17) - topAt(v2, 0.17)).toFixed(1)} cm); the base carries no slope and no narrowing`);
}

if (bad) { console.log(`GROW FAIL: ${bad}`); process.exit(1); }
console.log("GROW ok");

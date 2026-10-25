// POSE: the Character Studio's T-pose (pose.js on MHR's rig, rig_mhr.mjs) and its Belly control (sculpt.js), checked
// without a browser on MHR's bodies: the average, the bases (feminine, masculine) and the tailor's slim and full ones,
// each at its own height. The rig skins every point (four bones, the weights summing to one). In the T-pose the arms
// level out from the shoulders with the elbows and wrists straight, the legs stand straight under the hips with the
// soles where they were, everything on the spine, the neck and the head alone stays put to the last bit (the face
// above all), and no skin tears: no edge longer than MHR's longest at rest, nearly every edge within a quarter of its
// length, a handful of triangles at most turned over (deep in the armpit's fold on the fullest body, which opens as
// the arm lifts: an edge of 5 mm in the A-pose's crease becomes 2.4 cm, five times longer, out of sight). Belly -1 takes
// the average stomach back to a flat line (no further out than the chest) and moves nothing above the ribs or below
// the hips. Ends "POSE ok".
//
//   node tools/character/posetest.mjs
import { readFileSync } from "fs";
import { join } from "path";
import { loadMhr, mhrBody, bodyWeights, ROOT } from "./tailor/node.mjs";
import * as PO from "./pose.js";
import * as SC from "./sculpt.js";

const fails = [], ok = m => console.log("  ok  " + m), fail = m => { fails.push(m); console.log("  FAIL " + m); };
const M = loadMhr(), N = M.n;
const rb = readFileSync(join(ROOT, "Content", "Studio", "Bodies", "MHR_lod1_rig.bin")), R = PO.readRig(rb.buffer.slice(rb.byteOffset, rb.byteOffset + rb.byteLength));

// the rig: every point on four bones that exist, its weights summing to one
{
  let bad = 0, off = 0;
  for (let i = 0; i < N; i++) { let s = 0; for (let k = 0; k < 4; k++) { if (R.BI[i * 4 + k] >= R.bones.length) bad++; s += R.BW[i * 4 + k]; } off = Math.max(off, Math.abs(s - 1)); }
  R.N === N && !bad && off < 1e-4 ? ok(`the rig: ${N} points on ${R.bones.length} bones, every point's weights summing to one`) : fail(`the rig: ${R.N} points for ${N}, ${bad} bad bones, weights off by ${off}`);
}

const edges = []; { const seen = new Set(); for (let t = 0; t < M.T.length; t += 3) for (let k = 0; k < 3; k++) { const a = M.T[t + k], b = M.T[t + (k + 1) % 3], key = a < b ? a * N + b : b * N + a; if (!seen.has(key)) { seen.add(key); edges.push(a, b); } } }
const HEIGHT = { average: 1.7, feminine: 1.62, masculine: 1.78, slim_feminine: 1.6, slim_masculine: 1.76, full_feminine: 1.64, full_masculine: 1.78 };
for (const [name, H] of Object.entries(HEIGHT)) {
  const w = bodyWeights(name), raw = mhrBody(M, w, 1);                  // its own proportions; the scale the Studio gives it
  let lo = 1e9, hi = -1e9; { const P = new Float32Array(M.P); for (let k = 0; k < w.length; k++) if (w[k]) for (let i = 0; i < P.length; i++) P[i] += w[k] * M.shapes[k * N * 3 + i]; for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); } }
  const scale = H / (hi - lo), P = mhrBody(M, w, H).P, X = PO.pose(R, PO.joints(R, P, M.P, scale), "t"), S = PO.skin(R, X, P), J = n => { const b = R.byName.get(n); return [X.J2[b * 3], X.J2[b * 3 + 1], X.J2[b * 3 + 2]]; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], ang = (a, b) => Math.acos(Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b))) * 180 / Math.PI;
  let arms = 0, bend = 0, legs = 0;
  for (const s of ["l", "r"]) {
    arms = Math.max(arms, Math.abs(J(`${s}_wrist`)[1] - J(`${s}_uparm`)[1]), Math.abs(J(`${s}_lowarm`)[1] - J(`${s}_uparm`)[1]));
    bend = Math.max(bend, ang(sub(J(`${s}_lowarm`), J(`${s}_uparm`)), sub(J(`${s}_wrist`), J(`${s}_lowarm`))), ang(sub(J(`${s}_wrist`), J(`${s}_lowarm`)), sub(J(`${s}_middle1`), J(`${s}_wrist`))));
    legs = Math.max(legs, Math.abs(J(`${s}_foot`)[0] - J(`${s}_upleg`)[0]));
  }
  let headMoved = 0, still = 0, sole0 = 1e9, sole1 = 1e9;
  for (let i = 0; i < N; i++) {
    const d = Math.abs(S[i * 3] - P[i * 3]) + Math.abs(S[i * 3 + 1] - P[i * 3 + 1]) + Math.abs(S[i * 3 + 2] - P[i * 3 + 2]);
    if (P[i * 3 + 1] > 0.88 * H && d !== 0) headMoved++;
    let moves = false; for (let k = 0; k < 4; k++) if (R.BW[i * 4 + k] > 0 && X.moved[R.BI[i * 4 + k]]) moves = true;
    if (!moves && d !== 0) still++;
    sole0 = Math.min(sole0, P[i * 3 + 1]); sole1 = Math.min(sole1, S[i * 3 + 1]);
  }
  const r = [], len = (A, a, b) => Math.hypot(A[a * 3] - A[b * 3], A[a * 3 + 1] - A[b * 3 + 1], A[a * 3 + 2] - A[b * 3 + 2]); let long0 = 0, long1 = 0;
  for (let e = 0; e < edges.length; e += 2) { const l0 = len(P, edges[e], edges[e + 1]), l1 = len(S, edges[e], edges[e + 1]); long0 = Math.max(long0, l0); long1 = Math.max(long1, l1); if (l0 > 1e-6) r.push(l1 / l0); }
  r.sort((a, b) => a - b); const q = f => r[Math.floor(f * (r.length - 1))];
  let over = 0;                                                         // triangles turned over: the face against its rest one turned by its corner's bones
  for (let t = 0; t < M.T.length; t += 3) {
    const n = A => { const [a, b, c] = [M.T[t], M.T[t + 1], M.T[t + 2]], u = [A[b * 3] - A[a * 3], A[b * 3 + 1] - A[a * 3 + 1], A[b * 3 + 2] - A[a * 3 + 2]], v = [A[c * 3] - A[a * 3], A[c * 3 + 1] - A[a * 3 + 1], A[c * 3 + 2] - A[a * 3 + 2]];
      return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; };
    const n1 = n(S), was = PO.turn(R, X, M.T[t], n(P)); if (was[0] * n1[0] + was[1] * n1[1] + was[2] * n1[2] < 0) over++;
  }
  const sum = `arms level within ${(arms * 1000).toFixed(1)} mm, elbows and wrists straight within ${bend.toFixed(1)}°, legs straight within ${(legs * 1000).toFixed(1)} mm, soles ${((sole1 - sole0) * 1000).toFixed(1)} mm from where they were; edges ${q(0).toFixed(2)} to ${q(1).toFixed(2)} (99% under ${q(0.99).toFixed(2)}), the longest ${(long1 * 100).toFixed(1)} cm (${(long0 * 100).toFixed(1)} at rest), ${over} turned over`;
  arms < 0.002 && bend < 1 && legs < 0.002 && Math.abs(sole1 - sole0) < 0.003 && !headMoved && !still && q(0) > 0.45 && q(1) < 6 && q(0.99) < 1.25 && long1 <= long0 * 1.05 && over <= 8
    ? ok(`${name} (${H} m): ${sum}; the head and the spine's own points untouched`) : fail(`${name}: ${sum}; ${headMoved} of the head's points and ${still} of the spine's moved`);
}

// the belly: on MHR's base (the face's controls need MediaPipe's points, from the Studio's server; the belly's don't)
{
  const P = M.P, S = SC.buildSculpt({ P, T: M.T, lm: () => [0, 1.6, 0.1] }), c = S.controls.find(c => c.id === "belly");
  const Q = Float32Array.from(P); let outside = 0;
  for (let q = 0; q < c.idx.length; q++) { const i = c.idx[q]; for (let a = 0; a < 3; a++) Q[i * 3 + a] -= c.d[q * 3 + a]; if (P[i * 3 + 1] < 0.88 || P[i * 3 + 1] > 1.24) outside++; }
  const front = (A, y0, y1) => { let z = -1e9; for (let i = 0; i < N; i++) if (A[i * 3 + 1] > y0 && A[i * 3 + 1] < y1 && Math.abs(A[i * 3]) < 0.02 && A[i * 3 + 2] > 0) z = Math.max(z, A[i * 3 + 2]); return z; };
  const chest = front(P, 1.25, 1.27), was = front(P, 0.94, 1.18), now = front(Q, 0.94, 1.18), mirrored = S.handles.some(h => h.id === "belly");
  was > chest + 0.015 && now < chest + 0.01 && !outside && mirrored
    ? ok(`Belly -1: the stomach's front from ${((was - chest) * 100).toFixed(1)} cm out of the chest's line to ${((now - chest) * 100).toFixed(1)} cm (${c.idx.length} points, nothing above the ribs or below the hips); a circle on it`)
    : fail(`Belly -1: the stomach ${((was - chest) * 100).toFixed(1)} -> ${((now - chest) * 100).toFixed(1)} cm out of the chest's line, ${outside} points moved outside it, circle ${mirrored}`);
}
console.log(fails.length ? `POSE FAILED (${fails.length})` : "POSE ok");
process.exit(fails.length ? 1 : 0);

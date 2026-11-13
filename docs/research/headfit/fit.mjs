// fit.mjs <name> [--prior v2female|plain] [--out file]: a head preset's sculpt values from one picture's landmarks.
// MediaPipe's 468 points on her picture (lm.py) against the same points on MHR's feminine head as a trial head preset
// makes it (grownBody trialHead; MHR_landmarks.json), under a weak-perspective camera (a turn, a scale, a shift, fitted
// with the sliders): across and down the picture trusted, depth hardly; the mouth and the brows trusted less when her
// expression moves them; the forehead under her fringe hardly. Controls a front view can't see keep the prior's values.
import { readFileSync, writeFileSync } from "fs";
const R = new URL("../../../tools/character/", import.meta.url).pathname;
const { loadMhr, grownBody, landmark } = await import(R + "tailor/node.mjs");
const HERE = new URL(".", import.meta.url).pathname + "out/", args = process.argv.slice(2), name = args[0], opt = k => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const PF = JSON.parse(readFileSync(new URL("../../../Content/Studio/Bodies/MHR_presets.json", import.meta.url).pathname, "utf8")), prior = opt("--prior") === "plain" ? {} : PF.sculpt.v2female;
const M = loadMhr(), src = JSON.parse(readFileSync(HERE + name + ".json", "utf8")), N = 468;
const Tg = src.pts.slice(0, N).map(p => [p[0], -p[1], -p[2]]);
const LIPS = [61,146,91,181,84,17,314,405,321,375,291,185,40,39,37,0,267,269,270,409,78,95,88,178,87,14,317,402,318,324,308,191,80,81,82,13,312,311,310,415];
const BROWS = [70,63,105,66,107,55,65,52,53,46,300,293,334,296,336,285,295,282,283,276];
const OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
const EYES = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466];
const bs = src.blend || {}, mouthMoved = Math.max(bs.mouthPucker || 0, bs.mouthFunnel || 0, (bs.mouthSmileLeft || 0), (bs.jawOpen || 0)), browMoved = Math.max(bs.browInnerUp || 0, bs.browOuterUpLeft || 0, bs.browOuterUpRight || 0);
const w = new Float64Array(N).fill(1);
for (const i of EYES) w[i] = 2;
for (const i of OVAL) w[i] = 1.5;
for (const i of LIPS) w[i] = Math.max(0.15, 1 - 1.2 * mouthMoved);
for (const i of BROWS) w[i] = Math.max(0.1, 0.6 - browMoved);
// the forehead: under a fringe in every picture (the detector guesses it): the points above the brows count little
const U0 = (() => { const g = grownBody(M, { base: -1 }); return g; })();
const un = g => { const o = new Float32Array(g.P.length); for (let i = 0; i < o.length; i++) o[i] = g.P[i] / g.scale; return o; };
const lmk = U => Array.from({ length: N }, (_, i) => landmark(M, U, i));
const L0 = lmk(un(U0)), browY = Math.max(...BROWS.map(i => L0[i][1]));
for (let i = 0; i < N; i++) if (L0[i][1] > browY + 0.004) w[i] = Math.min(w[i], 0.12);
const WZ = +(opt("--wz") || 0.12);
// the controls a front view can read
const IDS = (opt("--ids") || "eye_size,eye_spacing,eye_tilt,face_height,face_taper,face_round,jaw_width,chin_length,chin_width,cheekbones,cheeks,nose_size,nose_length,nose_width,nose_tip,mouth_width,lips,temples,forehead_width").split(",");
const LIM = +(opt("--lim") || 1.6), RIDGE = +(opt("--ridge") || 0.02);
const given = opt("--sculpt") ? JSON.parse(readFileSync(opt("--sculpt"), "utf8")) : null, start = given ? (given.sculpt || given) : prior;   // --sculpt FILE: these values (pose only with --iters 0)
let s = Object.fromEntries(IDS.map(k => [k, start[k] || 0]));
const fixed = Object.fromEntries(Object.entries(start).filter(([k]) => !IDS.includes(k)));
const head = sc => lmk(un(grownBody(M, { base: -1, trialHead: { sculpt: { ...fixed, ...sc } } })));
// the camera: a rotation (a vector), a scale, a shift; closed form to start (Procrustes), then refined with the sliders
const rot = v => { const a = Math.hypot(...v); if (a < 1e-12) return [[1,0,0],[0,1,0],[0,0,1]]; const [x, y, z] = v.map(q => q / a), c = Math.cos(a), si = Math.sin(a), C = 1 - c;
  return [[c + x*x*C, x*y*C - z*si, x*z*C + y*si], [y*x*C + z*si, c + y*y*C, y*z*C - x*si], [z*x*C - y*si, z*y*C + x*si, c + z*z*C]]; };
const proj = (L, pose) => { const Rm = rot(pose.slice(0, 3)), c = pose[3]; return L.map(p => [c * (Rm[0][0]*p[0] + Rm[0][1]*p[1] + Rm[0][2]*p[2]) + pose[4], c * (Rm[1][0]*p[0] + Rm[1][1]*p[1] + Rm[1][2]*p[2]) + pose[5], c * (Rm[2][0]*p[0] + Rm[2][1]*p[1] + Rm[2][2]*p[2]) + pose[6]]); };
const resid = (L, pose) => { const q = proj(L, pose), r = new Float64Array(N * 3); for (let i = 0; i < N; i++) { const sw = Math.sqrt(w[i]); r[i*3] = sw * (q[i][0] - Tg[i][0]); r[i*3+1] = sw * (q[i][1] - Tg[i][1]); r[i*3+2] = sw * WZ * (q[i][2] - Tg[i][2]); } return r; };
const solve = (A, b) => { const n = b.length, Mx = A.map((r, i) => [...r, b[i]]); for (let i = 0; i < n; i++) { let p = i; for (let j = i + 1; j < n; j++) if (Math.abs(Mx[j][i]) > Math.abs(Mx[p][i])) p = j; [Mx[i], Mx[p]] = [Mx[p], Mx[i]]; for (let j = i + 1; j < n; j++) { const f = Mx[j][i] / Mx[i][i]; for (let k = i; k <= n; k++) Mx[j][k] -= f * Mx[i][k]; } }
  const x = new Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let v = Mx[i][n]; for (let k = i + 1; k < n; k++) v -= Mx[i][k] * x[k]; x[i] = v / Mx[i][i]; } return x; };
// start: scale and shift from the eyes' and the mouth's spread, facing the camera
let L = head(s);
const cen = P => [0, 1, 2].map(a => P.reduce((t, p, i) => t + w[i] * p[a], 0) / w.reduce((t, v) => t + v, 0)), cl = cen(L), ct = cen(Tg);
const spread = (P, c) => Math.sqrt(P.reduce((t, p, i) => t + w[i] * ((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2), 0));
let pose = [0, 0, 0, spread(Tg, ct) / spread(L, cl), 0, 0, 0]; pose[4] = ct[0] - pose[3] * cl[0]; pose[5] = ct[1] - pose[3] * cl[1]; pose[6] = ct[2] - pose[3] * cl[2];
const gnPose = (L, pose, it = 12) => { for (let n = 0; n < it; n++) { const r0 = resid(L, pose), J = []; const h = [1e-4, 1e-4, 1e-4, pose[3] * 1e-4, 0.01, 0.01, 0.01];
    for (let k = 0; k < 7; k++) { const p2 = pose.slice(); p2[k] += h[k]; const r1 = resid(L, p2); J.push(r1.map((v, i) => (v - r0[i]) / h[k])); }
    const A = J.map(a => J.map(b => a.reduce((t, v, i) => t + v * b[i], 0))), g = J.map(a => -a.reduce((t, v, i) => t + v * r0[i], 0)); for (let k = 0; k < 7; k++) A[k][k] *= 1.0001;
    const d = solve(A, g); pose = pose.map((v, k) => v + d[k]); } return pose; };
pose = gnPose(L, pose, 25);
const cost = r => r.reduce((t, v) => t + v * v, 0);
const rmsMm = (L, pose) => { const q = proj(L, pose); let t = 0, ws = 0; for (let i = 0; i < N; i++) { t += w[i] * ((q[i][0] - Tg[i][0]) ** 2 + (q[i][1] - Tg[i][1]) ** 2); ws += w[i]; } return Math.sqrt(t / ws) / pose[3] * 1000; };
console.log(`${name}: ${IDS.length} controls; mouth moved ${mouthMoved.toFixed(2)}, brows ${browMoved.toFixed(2)}; start (${opt("--prior") === "plain" ? "plain" : "v2female"}): ${rmsMm(L, pose).toFixed(2)} mm rms across the picture, ${pose[3].toFixed(0)} px a metre`);
for (let it = 0; it < +(opt("--iters") || 7); it++) {
  const r0 = resid(L, pose), J = [], h = 0.3;
  for (const k of IDS) { const L1 = head({ ...s, [k]: s[k] + h }), r1 = resid(L1, pose); J.push(r1.map((v, i) => (v - r0[i]) / h)); }
  // the camera's own columns too, so a slider doesn't do the camera's work
  const hp = [1e-4, 1e-4, 1e-4, pose[3] * 1e-4, 0.01, 0.01, 0.01];
  for (let k = 0; k < 7; k++) { const p2 = pose.slice(); p2[k] += hp[k]; const r1 = resid(L, p2); J.push(r1.map((v, i) => (v - r0[i]) / hp[k])); }
  const n = J.length, A = J.map(a => J.map(b => a.reduce((t, v, i) => t + v * b[i], 0))), g = J.map(a => -a.reduce((t, v, i) => t + v * r0[i], 0));
  const lam = RIDGE * cost(r0) / 1 + 1e-9, scaleRidge = A.slice(0, IDS.length).reduce((t, r, i) => t + r[i], 0) / IDS.length;
  IDS.forEach((k, i) => { A[i][i] += RIDGE * scaleRidge; g[i] -= RIDGE * scaleRidge * (s[k] - (prior[k] || 0)); });
  const d = solve(A, g); let step = 1;
  for (let tries = 0; tries < 6; tries++, step /= 2) {
    const s2 = Object.fromEntries(IDS.map((k, i) => [k, Math.max(-LIM, Math.min(LIM, s[k] + step * d[i]))])), p2 = pose.map((v, k) => v + step * d[IDS.length + k]), L2 = head(s2), pz = gnPose(L2, p2, 6);
    if (cost(resid(L2, pz)) < cost(r0)) { s = s2; L = L2; pose = pz; break; }
  }
  console.log(`  ${it + 1}: ${rmsMm(L, pose).toFixed(2)} mm (step ${step})`);
}
const Rm = rot(pose.slice(0, 3)), yaw = Math.atan2(Rm[0][2], Rm[2][2]) * 180 / Math.PI, pitch = Math.asin(-Rm[1][2]) * 180 / Math.PI, roll = Math.atan2(Rm[1][0], Rm[1][1]) * 180 / Math.PI;
const rd = v => Math.round(v * 20) / 20, out = Object.fromEntries(Object.entries({ ...fixed, ...s }).map(([k, v]) => [k, rd(v)]).filter(([, v]) => v));
console.log(`  camera: turned ${yaw.toFixed(0)}, tilted ${pitch.toFixed(0)}, rolled ${roll.toFixed(0)}; ${rmsMm(L, pose).toFixed(2)} mm rms`);
console.log("  " + IDS.map(k => `${k} ${s[k].toFixed(2)}${Math.abs(s[k]) >= LIM - 1e-6 ? "!" : ""}`).join(", "));
// by region: how far off each part still is (mm across the picture)
const q = proj(L, pose), part = (ids) => { let t = 0; for (const i of ids) t += (q[i][0] - Tg[i][0]) ** 2 + (q[i][1] - Tg[i][1]) ** 2; return (Math.sqrt(t / ids.length) / pose[3] * 1000).toFixed(1); };
console.log(`  left by part (mm): eyes ${part(EYES)}, oval ${part(OVAL.filter(i => w[i] > 1))}, lips ${part(LIPS)}, brows ${part(BROWS)}`);
// the head as the camera sees it: its triangles in her picture's pixels (over.py draws its outline over her picture)
{ const g = grownBody(M, { base: -1, trialHead: { sculpt: { ...fixed, ...s } } }), U = un(g), chinY = landmark(M, U, 152)[1], T = M.T, P2 = proj(Array.from({ length: U.length / 3 }, (_, i) => [U[i * 3], U[i * 3 + 1], U[i * 3 + 2]]), pose), tri = [];
  for (let t = 0; t < T.length; t += 3) { const a = T[t], b = T[t + 1], c = T[t + 2]; if (U[a * 3 + 1] < chinY - 0.1 || U[b * 3 + 1] < chinY - 0.1 || U[c * 3 + 1] < chinY - 0.1) continue; tri.push(+P2[a][0].toFixed(1), +(-P2[a][1]).toFixed(1), +P2[b][0].toFixed(1), +(-P2[b][1]).toFixed(1), +P2[c][0].toFixed(1), +(-P2[c][1]).toFixed(1)); }
  const ring = ids => ids.map(i => [+q[i][0].toFixed(1), +(-q[i][1]).toFixed(1)]);
  writeFileSync(HERE + name + (opt("--tag") || "") + "_proj.json", JSON.stringify({ lm: q.map(p => [+p[0].toFixed(2), +(-p[1]).toFixed(2)]), tri, eyeR: ring([33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246]), eyeL: ring([263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466]), lips: ring([61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185]), nose: ring([98, 97, 2, 326, 327]), brows: [ring([70,63,105,66,107]), ring([300,293,334,296,336])] })); }
writeFileSync(opt("--out") || HERE + name + "_fit.json", JSON.stringify({ name, sculpt: out, pose, yaw, pitch, roll, rms: rmsMm(L, pose) }, null, 1));

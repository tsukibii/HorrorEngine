// profit.mjs <name> [--prior v2female|plain] [--ids a,b,...] [--sculpt FILE --iters 0] [--lim 2] [--ridge 0.03] [--jaw 0.15] [--tag T]
// A head preset's sculpt values from a picture seen from the side (profile.py's trace: out/<name>_profile.json).
// MediaPipe finds no face in a profile, so nothing here is its points on the picture: the head as a trial head preset
// makes it (grownBody's trialHead) is turned, sized and moved by a camera fitted with the sliders, and compared as an
// outline: its own silhouette toward the front (row by row, the frontmost of its triangles' edges) against the
// traced one from the forehead to the chin; the jaw's lower border (MediaPipe's jaw points on MHR, as a line)
// against the traced jaw; the eye's lids and outer corner and the ear's top, back and lobe (the frontmost, rearmost,
// highest and lowest of the ear's own points) against the points put by hand. Her mouth is parted: MHR's jawDrop is
// on the head while it's compared (--jaw, fitted when --jaw fit). What a side view can't see (every width) keeps the
// prior's value. Writes out/<name><tag>_pfit.json and out/<name><tag>_pproj.json (ours in the picture's pixels: pover.py).
import { readFileSync, writeFileSync } from "fs";
const R = new URL("../../../tools/character/", import.meta.url).pathname, B = new URL("../../../Content/Studio/Bodies/", import.meta.url).pathname;
const { loadMhr, grownBody, landmark } = await import(R + "tailor/node.mjs");
const HERE = new URL(".", import.meta.url).pathname + "out/", args = process.argv.slice(2), name = args[0], opt = (k, d = null) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const PF = JSON.parse(readFileSync(B + "MHR_presets.json", "utf8")), prior = opt("--prior") === "plain" ? {} : PF.sculpt[opt("--prior", "v2female")] || {};
const M = loadMhr(), src = JSON.parse(readFileSync(HERE + name + "_profile.json", "utf8")), FACE = src.faces === "left" ? -1 : 1;
// MHR's jawDrop on every point (her mouth is parted)
const buf = readFileSync(B + "MHR_lod1.bin"), hl = buf.readUInt32LE(0), H = JSON.parse(buf.subarray(4, 4 + hl).toString("utf8")), ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const K = H.expr_points, EIDX = new Uint32Array(ab.slice(H.expr_idx_at, H.expr_idx_at + K * 4)), half = new Uint16Array(ab.slice(H.expr_at, H.expr_at + H.expressions * K * 6));
const f16 = h => { const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 31, f = h & 1023; return e === 0 ? s * f * 2 ** -24 : e === 31 ? (f ? NaN : s * Infinity) : s * (1 + f / 1024) * 2 ** (e - 15); };
const JD = H.expr_names.indexOf("jawDrop"), LD = H.expr_names.findIndex(n => /^lowerLipDepressor/.test(n));
const un = g => { const o = new Float32Array(g.P.length); for (let i = 0; i < o.length; i++) o[i] = g.P[i] / g.scale; return o; };
const opened = (U, j) => { if (!j) return U; for (let k = 0; k < K; k++) { const v = EIDX[k] * 3; for (let a = 0; a < 3; a++) U[v + a] += j * f16(half[(JD * K + k) * 3 + a]); } return U; };
// the points that are the head (and the neck's top), and her left ear's (the ones Ear size moves)
const U0 = un(grownBody(M, { base: -1 })), chin0 = landmark(M, U0, 152)[1], NV = U0.length / 3;
const HEAD = []; for (let i = 0; i < NV; i++) if (U0[i * 3 + 1] > chin0 - 0.05) HEAD.push(i);
const inHead = new Uint8Array(NV); for (const i of HEAD) inHead[i] = 1;
const EDGES = (() => { const s = new Set(), T = M.T, o = []; for (let t = 0; t < T.length; t += 3) for (let e = 0; e < 3; e++) { const a = T[t + e], b = T[t + (e + 1) % 3]; if (!inHead[a] || !inHead[b]) continue; const k = a < b ? a * NV + b : b * NV + a; if (!s.has(k)) { s.add(k); o.push(a, b); } } return o; })();
const UE = un(grownBody(M, { base: -1, sculpt: { ears_size: 1 } })), EAR = HEAD.filter(i => (FACE < 0 ? U0[i * 3] > 0.03 : U0[i * 3] < -0.03) && Math.hypot(UE[i * 3] - U0[i * 3], UE[i * 3 + 1] - U0[i * 3 + 1], UE[i * 3 + 2] - U0[i * 3 + 2]) > 0.0008);
const SIDE = FACE < 0 ? { outer: 263, top: 386, bottom: 374, inner: 362, ring: [263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466], jaw: [152, 377, 400, 378, 379, 365, 397, 288] }
  : { outer: 33, top: 159, bottom: 145, inner: 133, ring: [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246], jaw: [152, 148, 176, 149, 150, 136, 172, 58] };
// the controls a side view can read
const IDS = (opt("--ids") || "forehead_slope,brow_ridge,nose_projection,nose_length,nose_base,nose_tip,nose_bridge,nose_size,jaw_angle,lips,lip_upper,lip_lower,lip_pout,chin_forward,chin_length,face_height,eye_depth,eye_size,ears_size").split(",").filter(Boolean);
const LIM = +opt("--lim", 2), RIDGE = +opt("--ridge", 0.03), fitJaw = opt("--jaw") === "fit";
const YAW = opt("--yaw") == null ? null : (90 - Math.abs(+opt("--yaw"))) * Math.PI / 180;   // --yaw 80: the camera held that far round (90: a true profile); a side picture alone doesn't say (a longer nose seen more from the front draws the same outline)
const given = opt("--sculpt") ? JSON.parse(readFileSync(opt("--sculpt"), "utf8")) : null, start = given ? (given.sculpt || given) : prior;
let s = Object.fromEntries(IDS.map(k => [k, start[k] || 0])), jaw = fitJaw ? 0.15 : +opt("--jaw", given?.jaw ?? 0.15);
const fixed = Object.fromEntries(Object.entries(start).filter(([k]) => !IDS.includes(k) && k !== "jaw"));
const head = (sc, j) => opened(un(grownBody(M, { base: -1, trialHead: { weights: given?.weights, sculpt: { ...fixed, ...sc } } })), j);   // (--sculpt FILE's `weights`: MHR head weights of the head's own)
// the camera: a turn (a vector, on top of facing the picture's side), a scale, a shift. Picture x right, y down
const rot = v => { const a = Math.hypot(...v); if (a < 1e-12) return [[1,0,0],[0,1,0],[0,0,1]]; const [x, y, z] = v.map(q => q / a), c = Math.cos(a), si = Math.sin(a), C = 1 - c;
  return [[c + x*x*C, x*y*C - z*si, x*z*C + y*si], [y*x*C + z*si, c + y*y*C, y*z*C - x*si], [z*x*C - y*si, z*y*C + x*si, c + z*z*C]]; };
const mul = (A, Bm) => A.map(r => [0, 1, 2].map(j => r[0] * Bm[0][j] + r[1] * Bm[1][j] + r[2] * Bm[2][j]));
const R0 = rot([0, FACE * Math.PI / 2, 0]);             // (facing left: turned -90 degrees about y, her left side to the camera)
const cam = pose => { const Rm = mul(rot(pose.slice(0, 3)), R0), c = pose[3]; return p => [c * (Rm[0][0]*p[0] + Rm[0][1]*p[1] + Rm[0][2]*p[2]) + pose[4], -c * (Rm[1][0]*p[0] + Rm[1][1]*p[1] + Rm[1][2]*p[2]) + pose[5]]; };
const at = (U, i) => [U[i * 3], U[i * 3 + 1], U[i * 3 + 2]];
// ours in the picture: the silhouette toward the front (the frontmost x on each half pixel row), the named points
const ROW = 0.5;
function seen(U, pose) {
  const pr = cam(pose), X = new Float32Array(NV), Y = new Float32Array(NV); for (const i of HEAD) { const q = pr(at(U, i)); X[i] = q[0]; Y[i] = q[1]; }
  const ys = src.silhouette.map(p => p[1]), y0 = Math.min(...ys) - 30, y1 = Math.max(...ys) + 30, n = Math.round((y1 - y0) / ROW) + 1, front = new Float32Array(n).fill(FACE < 0 ? 1e9 : -1e9);
  for (let e = 0; e < EDGES.length; e += 2) { const a = EDGES[e], b = EDGES[e + 1]; let ya = Y[a], yb = Y[b], xa = X[a], xb = X[b]; if (ya > yb) { [ya, yb, xa, xb] = [yb, ya, xb, xa]; }
    const r0 = Math.max(0, Math.ceil((ya - y0) / ROW)), r1 = Math.min(n - 1, Math.floor((yb - y0) / ROW));
    for (let r = r0; r <= r1; r++) { const y = y0 + r * ROW, x = yb - ya < 1e-9 ? Math.min(xa, xb) : xa + (xb - xa) * (y - ya) / (yb - ya); if (FACE < 0 ? x < front[r] : x > front[r]) front[r] = x; } }
  const sil = []; for (let r = 0; r < n; r++) if (Math.abs(front[r]) < 1e8) sil.push([front[r], y0 + r * ROW]);
  const lm = i => pr(landmark(M, U, i)); let top = null, lobe = null, back = null;
  for (const i of EAR) { const q = [X[i], Y[i]]; if (!top || q[1] < top[1]) top = q; if (!lobe || q[1] > lobe[1]) lobe = q; if (!back || (FACE < 0 ? q[0] > back[0] : q[0] < back[0])) back = q; }
  return { sil, jaw: SIDE.jaw.map(lm), pts: { eye_outer: lm(SIDE.outer), eye_top: lm(SIDE.top), eye_bottom: lm(SIDE.bottom), ear_top: top, ear_lobe: lobe, ear_back: back, tip: lm(4), subnasale: lm(2), nasion: lm(168), menton: lm(152) },
    ear: EAR.map(i => [X[i], Y[i]]), eye: SIDE.ring.map(lm), lips: [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185].map(lm) };
}
const near = (line, p) => { let best = 1e18, o = [0, 0]; for (let i = 0; i + 1 < line.length; i++) { const a = line[i], b = line[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)), qx = a[0] + t * dx, qy = a[1] + t * dy, d = (qx - p[0]) ** 2 + (qy - p[1]) ** 2; if (d < best) { best = d; o = [qx - p[0], qy - p[1]]; } } return o; };
// the traced silhouette every 2 px along itself, the jaw as traced
const resample = (line, step) => { const o = [line[0]]; let left = step; for (let i = 0; i + 1 < line.length; i++) { let a = line[i]; const b = line[i + 1]; let L = Math.hypot(b[0] - a[0], b[1] - a[1]); while (L >= left) { const t = left / L; a = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]; o.push(a); L -= left; left = step; } left -= L; } return o; };
const TS = [...resample(src.silhouette.slice(0, src.gap), 2), ...resample(src.silhouette.slice(src.gap), 2)], TJ = src.jaw, TP = src.points;
const WP = { eye_outer: 1.5, eye_top: 0.15, eye_bottom: 0.6, ear_top: 1.5, ear_lobe: 1.5, ear_back: 1.2, tip: 1.5, subnasale: 1, nasion: 0.7, menton: 1 }, WS = 1, WJ = 0.6;
function resid(U, pose) {
  const S = seen(U, pose), r = [];
  for (const p of TS) { const d = near(S.sil, p); r.push(WS * d[0], WS * d[1]); }
  for (const p of TJ) { const d = near(S.jaw, p); r.push(WJ * d[0], WJ * d[1]); }
  for (const k in WP) { const w = Math.sqrt(WP[k]) * 1.6; r.push(w * (S.pts[k][0] - TP[k][0]), w * (S.pts[k][1] - TP[k][1])); }
  if (YAW != null) r.push(400 * (pose[1] - YAW), 0);
  return r;
}
const solve = (A, b) => { const n = b.length, Mx = A.map((r, i) => [...r, b[i]]); for (let i = 0; i < n; i++) { let p = i; for (let j = i + 1; j < n; j++) if (Math.abs(Mx[j][i]) > Math.abs(Mx[p][i])) p = j; [Mx[i], Mx[p]] = [Mx[p], Mx[i]]; for (let j = i + 1; j < n; j++) { const f = Mx[j][i] / Mx[i][i]; for (let k = i; k <= n; k++) Mx[j][k] -= f * Mx[i][k]; } }
  const x = new Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let v = Mx[i][n]; for (let k = i + 1; k < n; k++) v -= Mx[i][k] * x[k]; x[i] = v / Mx[i][i]; } return x; };
const cost = r => r.reduce((t, v) => t + v * v, 0), HP = pose => [2e-3, 2e-3, 2e-3, pose[3] * 2e-3, 0.3, 0.3];
const gnPose = (U, pose, it = 10) => { for (let n = 0; n < it; n++) { const r0 = resid(U, pose), h = HP(pose), J = [];
    for (let k = 0; k < 6; k++) { const p2 = pose.slice(); p2[k] += h[k]; const r1 = resid(U, p2); J.push(r1.map((v, i) => (v - r0[i]) / h[k])); }
    const A = J.map(a => J.map(b => a.reduce((t, v, i) => t + v * b[i], 0))), g = J.map(a => -a.reduce((t, v, i) => t + v * r0[i], 0)); for (let k = 0; k < 6; k++) A[k][k] *= 1.02;
    const d = solve(A, g); let st = 1, ok = false; for (let q = 0; q < 6; q++, st /= 2) { const p2 = pose.map((v, k) => v + st * d[k]); if (cost(resid(U, p2)) < cost(r0)) { pose = p2; ok = true; break; } } if (!ok) break; } return pose; };
// start: the eye-ear distance and the nose-ear line set the scale, the turn and the shift (her head is tipped)
let U = head(s, jaw);
const start2 = (() => { let best = null; const e0 = landmark(M, U, SIDE.outer), earMid = EAR.reduce((t, i) => [t[0] + U[i * 3] / EAR.length, t[1] + U[i * 3 + 1] / EAR.length, t[2] + U[i * 3 + 2] / EAR.length], [0, 0, 0]);
  const tEar = [(TP.ear_top[0] + TP.ear_lobe[0]) / 2, (TP.ear_top[1] + TP.ear_lobe[1]) / 2], dT = Math.hypot(tEar[0] - TP.eye_outer[0], tEar[1] - TP.eye_outer[1]);
  for (const tip of [-0.5, -0.35, -0.2, 0, 0.2]) for (const yaw of [-0.3, 0, 0.3]) { let pose = [0, yaw, tip * -FACE, 1000, 0, 0]; const pr = cam(pose), a = pr(e0), b = pr(earMid), c = dT / Math.hypot(a[0] - b[0], a[1] - b[1]) * 1000; pose[3] = c;
    const a2 = cam(pose)(e0); pose[4] = TP.eye_outer[0] - a2[0]; pose[5] = TP.eye_outer[1] - a2[1]; pose = gnPose(U, pose, 14); const cst = cost(resid(U, pose)); if (!best || cst < best.c) best = { c: cst, pose }; }
  return best.pose; })();
let pose = start2;
const mm = (r, pose) => Math.sqrt(cost(r) / (r.length / 2)) / pose[3] * 1000;
const parts = (U, pose) => { const S = seen(U, pose), rms = (pts, line) => Math.sqrt(pts.reduce((t, p) => { const d = near(line, p); return t + d[0] * d[0] + d[1] * d[1]; }, 0) / pts.length) / pose[3] * 1000;
  const pt = k => Math.hypot(S.pts[k][0] - TP[k][0], S.pts[k][1] - TP[k][1]) / pose[3] * 1000;
  return `outline ${rms(TS, S.sil).toFixed(2)} mm rms (worst ${Math.max(...TS.map(p => Math.hypot(...near(S.sil, p)))).toFixed(1)} px), jaw ${rms(TJ, S.jaw).toFixed(2)}, eye ${["eye_outer", "eye_top", "eye_bottom"].map(k => pt(k).toFixed(1)).join("/")}, ear ${["ear_top", "ear_lobe", "ear_back"].map(k => pt(k).toFixed(1)).join("/")}, tip ${pt("tip").toFixed(1)}, subnasale ${pt("subnasale").toFixed(1)}, menton ${pt("menton").toFixed(1)}`; };
console.log(`${name}: ${IDS.length} controls, prior ${opt("--prior", "v2female")}; ${TS.length} outline points, ${EAR.length} ear points, ${pose[3].toFixed(0)} px a metre\n  start: ${parts(U, pose)}`);
for (let it = 0; it < +opt("--iters", 8); it++) {
  const r0 = resid(U, pose), J = [], h = 0.3, names = [...IDS, ...(fitJaw ? ["jaw"] : [])];
  for (const k of IDS) { const r1 = resid(head({ ...s, [k]: s[k] + h }, jaw), pose); J.push(r1.map((v, i) => (v - r0[i]) / h)); }
  if (fitJaw) { const r1 = resid(head(s, jaw + 0.1), pose); J.push(r1.map((v, i) => (v - r0[i]) / 0.1)); }
  const hp = HP(pose); for (let k = 0; k < 6; k++) { const p2 = pose.slice(); p2[k] += hp[k]; const r1 = resid(U, p2); J.push(r1.map((v, i) => (v - r0[i]) / hp[k])); }
  const A = J.map(a => J.map(b => a.reduce((t, v, i) => t + v * b[i], 0))), g = J.map(a => -a.reduce((t, v, i) => t + v * r0[i], 0));
  const sr = A.slice(0, IDS.length).reduce((t, r, i) => t + r[i], 0) / Math.max(1, IDS.length);
  IDS.forEach((k, i) => { A[i][i] += RIDGE * sr; g[i] -= RIDGE * sr * (s[k] - (prior[k] || 0)); });
  for (let k = 0; k < A.length; k++) A[k][k] *= 1.05;
  const d = solve(A, g); let step = 1, ok = false;
  for (let tries = 0; tries < 7; tries++, step /= 2) {
    const s2 = Object.fromEntries(IDS.map((k, i) => [k, Math.max(-LIM, Math.min(LIM, s[k] + step * d[i]))])), j2 = fitJaw ? Math.max(0, Math.min(0.5, jaw + step * d[IDS.length])) : jaw, off = names.length;
    const U2 = head(s2, j2), pz = gnPose(U2, pose.map((v, k) => v + step * d[off + k]), 4);
    if (cost(resid(U2, pz)) < cost(r0)) { s = s2; jaw = j2; U = U2; pose = pz; ok = true; break; }
  }
  console.log(`  ${it + 1}: ${mm(resid(U, pose), pose).toFixed(2)} (step ${ok ? step : 0})`); if (!ok) break;
}
const Rm = mul(rot(pose.slice(0, 3)), R0), yaw = Math.atan2(Rm[0][2], Rm[2][2]) * 180 / Math.PI, pitch = Math.asin(-Rm[1][2]) * 180 / Math.PI, roll = Math.atan2(Rm[1][0], Rm[1][1]) * 180 / Math.PI;
const rd = v => Math.round(v * 20) / 20, out = Object.fromEntries(Object.entries({ ...fixed, ...s }).map(([k, v]) => [k, rd(v)]).filter(([, v]) => v));
console.log(`  camera: turned ${yaw.toFixed(0)}, tilted ${pitch.toFixed(0)}, rolled ${roll.toFixed(0)}; the jaw dropped ${jaw.toFixed(2)}\n  end: ${parts(U, pose)}`);
console.log("  " + IDS.map(k => `${k} ${s[k].toFixed(2)}${Math.abs(s[k]) >= LIM - 1e-6 ? "!" : ""}`).join(", "));
const S = seen(U, pose), r1 = a => a.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]);
writeFileSync(HERE + name + (opt("--tag") || "") + "_pproj.json", JSON.stringify({ sil: r1(S.sil), jaw: r1(S.jaw), ear: r1(S.ear), eye: r1(S.eye), lips: r1(S.lips), pts: Object.fromEntries(Object.entries(S.pts).map(([k, p]) => [k, [+p[0].toFixed(2), +p[1].toFixed(2)]])), px_per_m: pose[3] }));
writeFileSync(HERE + name + (opt("--tag") || "") + "_pfit.json", JSON.stringify({ name, sculpt: out, jaw, pose, yaw, pitch, roll }, null, 1));

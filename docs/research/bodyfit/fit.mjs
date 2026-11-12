// fit.mjs [--iters 8] [--start FILE.json] [--out TAG]: MHR's body weights and the Studio's proportion and body sliders fitted to the T-pose
// picture's measures (t1_targets.json: shares of the bare height). The body is the feminine base with v2female's head, in the Studio's
// T-pose, cut by planes: the legs' edges by height, the trunk's half width, the arms' top and bottom by how far out, the face's marks.
// Gauss-Newton with a ridge toward the feminine base's weights and toward no sculpt. Prints the fit; writes TAG.fit.json
import { readFileSync, writeFileSync } from "fs";
const ROOT = new URL("../../../", import.meta.url).pathname, S = (process.env.BODYFIT || ROOT + "Saved/Body/fit") + "/", R0 = ROOT + "tools/character/";
const N = await import(R0 + "tailor/node.mjs"); const PO = await import(R0 + "pose.js");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
const M = N.loadMhr(), T = M.T, NV = M.n, CM = 163;
const rb = readFileSync(ROOT + "Content/Studio/Bodies/MHR_lod1_rig.bin"), R = PO.readRig(rb.buffer.slice(rb.byteOffset, rb.byteOffset + rb.byteLength));
const TG = JSON.parse(readFileSync(S + "t1_targets.json", "utf8")), FEM = JSON.parse(readFileSync(ROOT + "Content/Studio/Bodies/MHR_presets.json", "utf8")).presets.feminine;
const under = name => { const root = R.byName.get(name), set = new Uint8Array(R.bones.length); for (const b of R.order) { const p = R.bones[b].parent; set[b] = b === root || (p >= 0 && set[p]) ? 1 : 0; } return set; };
const wOn = (set, i) => { let s = 0; for (let k = 0; k < 4; k++) if (set[R.BI[i * 4 + k]]) s += R.BW[i * 4 + k]; return s; };
const LL = under("l_upleg"), RL = under("r_upleg"), LA = under("l_uparm"), RA = under("r_uparm"), kind = new Uint8Array(NV);   // 0 trunk and head, 1 her left leg, 2 right leg, 3 left arm, 4 right arm
for (let i = 0; i < NV; i++) kind[i] = wOn(LL, i) > 0.5 ? 1 : wOn(RL, i) > 0.5 ? 2 : wOn(LA, i) > 0.5 ? 3 : wOn(RA, i) > 0.5 ? 4 : 0;
const tris = [[], [], [], [], []]; for (let t = 0; t < T.length; t += 3) { const c = [0, 0, 0, 0, 0]; for (let k = 0; k < 3; k++) c[kind[T[t + k]]]++; const k = c.indexOf(Math.max(...c)); tris[k].push(t); }
// a set's triangles cut by a plane (axis a at value v): the least and the most of axis b where its edges cross
function cut(Sx, list, a, v, b) { let lo = Infinity, hi = -Infinity;
  for (const t of list) for (let e = 0; e < 3; e++) { const i = T[t + e] * 3, j = T[t + (e + 1) % 3] * 3, p = Sx[i + a] - v, q = Sx[j + a] - v; if (p * q > 0 || p === q) continue; const x = Sx[i + b] + (Sx[j + b] - Sx[i + b]) * p / (p - q); if (x < lo) lo = x; if (x > hi) hi = x; }
  return [lo, hi]; }
const NAMES = ["legs_length", "torso_length", "arms_length", "neck_length", "head_size", "thighs", "calves", "hips", "waist", "upper_arms", "forearms", "shoulders", "bust", "chest"], NW = 20;
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// what the cardigan adds to the trunk's half width (cm at 163): its knit on the bust and the hips, more where it hangs clear of the waist
const DEPTHS = [["bust", 0.735, 0.17, 26.5], ["under the bust", 0.69, 0.17, 20.5], ["waist", 0.645, 0.2, 21.5], ["belly", 0.585, 0.22, 24.5], ["hips", 0.52, 0.26, 24.5]];
const KNEE = 0.285;                                                     // the knee's joint: three to four centimetres over the leg's narrowest under the knee (0.253 of the height in the picture)
const cardigan = t => 1.0 + 1.0 * sm(0.57, 0.62, t) * (1 - sm(0.66, 0.70, t)), SLEEVE = 0.8, CUFF = 2.5;
function measure(p) {
  const weights = FEM.slice(); for (let k = 0; k < NW; k++) weights[k] = p[k]; const sculpt = {}; NAMES.forEach((n, k) => { sculpt[n] = p[NW + k]; });
  const g = N.grownBody(M, { base: -1, v2: 1, body2: 1, trial: { weights, sculpt } }), X = PO.pose(R, PO.joints(R, g.P, M.P, g.scale, g.F), "t"), Sx = PO.skin(R, X, g.P);
  let lo = 1e9, hi = -1e9; for (let i = 1; i < Sx.length; i += 3) { lo = Math.min(lo, Sx[i]); hi = Math.max(hi, Sx[i]); } const H = hi - lo;
  const r = [], say = [], sc = p[NW + NAMES.length], fl = p[NW + NAMES.length + 1], at = t => sc * (t + fl);   // (the picture's shares of the height are of a height that was guessed: the skull's top under the hair, the sole in the shoe. Its scale and its floor are unknowns too, held near the guess)
  for (const L0 of TG.legs) { const L = { t: at(L0.t), inner: sc * L0.inner, outer: sc * L0.outer }; const y = lo + L.t * H, a = cut(Sx, tris[1], 1, y, 0), b = cut(Sx, tris[2], 1, y, 0); if (!isFinite(a[0]) || !isFinite(b[0])) { r.push(0, 0); continue; }
    const inner = (a[0] - b[1]) / 2 / H, outer = (a[1] - b[0]) / 2 / H, w = (outer - inner), wt = L.outer - L.inner;
    r.push((w - wt) * CM); r.push(L.t >= 0.40 ? (outer - L.outer) * CM : 0); say.push([L.t, wt * CM, w * CM, L.outer * CM, outer * CM]); }
  const trunk = [];
  for (const Q0 of TG.trunk) { if (Q0.t > 0.765) continue; const Q = { t: at(Q0.t), half: sc * Q0.half }; const y = lo + Q.t * H, a = cut(Sx, tris[0], 1, y, 0), b = cut(Sx, tris[1], 1, y, 0), c = cut(Sx, tris[2], 1, y, 0), half = (Math.max(a[1], b[1], c[1]) - Math.min(a[0], b[0], c[0])) / 2 / H, want = Q.half - cardigan(Q0.t) / CM;
    r.push(0.5 * (half - want) * CM); trunk.push([Q.t, want * CM, half * CM]); }
  const arm = [];
  for (const A0 of TG.arm) { const A = { d: sc * A0.d, top: at(A0.top), bottom: at(A0.bottom) }; const x = A.d * H, a = cut(Sx, tris[3], 0, x, 1), b = cut(Sx, tris[4], 0, -x, 1); if (!isFinite(a[0]) || !isFinite(b[0])) { r.push(0, 0); continue; }
    const top = ((a[1] + b[1]) / 2 - lo) / H, bot = ((a[0] + b[0]) / 2 - lo) / H, sl = SLEEVE + 0.7 * sm(0.24, 0.30, A0.d), wantT = A.top - sl / CM, wantB = A.bottom + sl / CM;   // (the sleeve bunches over its cuff: more of it toward the wrist)
    if (A0.d > 0.335) { r.push(0, 0); continue; }                           // (the cuff: its ribbing, not the arm)
    r.push(0.7 * ((top - bot) - (wantT - wantB)) * CM, 0); arm.push([A.d, (wantT - wantB) * CM, (top - bot) * CM, wantT * CM, top * CM]); }
  const lm = i => N.landmark(M, Sx, i), eyes = ((lm(33)[1] + lm(133)[1] + lm(263)[1] + lm(362)[1]) / 4 - lo) / H, chin = (lm(152)[1] - lo) / H, J = n => { const b = R.byName.get(n); return [X.J2[b * 3], X.J2[b * 3 + 1] - lo, X.J2[b * 3 + 2]]; };
  const wrist = J("l_wrist")[0] / H, wantWrist = sc * TG.marks.cuff - CUFF / CM;
  // the crotch: the lowest point of the trunk between the legs
  let crotch = 1e9; for (const t of tris[0]) for (let e = 0; e < 3; e++) { const i = T[t + e] * 3; if (Math.abs(Sx[i]) < 0.02 && Sx[i + 1] - lo > 0.35 * H && Sx[i + 1] - lo < 0.6 * H) crotch = Math.min(crotch, (Sx[i + 1] - lo) / H); }
  const knee = J("l_lowleg")[1] / H;
  // the pit of the neck: down the front's middle from the chin, the point furthest back before the chest comes forward
  const c152 = lm(152); let pit = null; for (let i = 0; i < Sx.length; i += 3) if (Math.abs(Sx[i]) < 0.004 && Sx[i + 1] < c152[1] - 0.03 && Sx[i + 1] > c152[1] - 0.14 && Sx[i + 2] > c152[2] - 0.095 && (!pit || Sx[i + 2] < pit[1])) pit = [Sx[i + 1], Sx[i + 2]];   // (the front's points only: within 9.5 cm behind the chin's own depth)
  const pitH = (pit[0] - lo) / H; r.push(1.0 * (pitH - at(TG.marks.pit)) * CM);
  r.push((eyes - at(TG.marks.eyes)) * CM, (chin - at(TG.marks.chin)) * CM, (wrist - wantWrist) * CM, 3 * Math.min(0, crotch - at(TG.marks.hem)) * CM, 0, 0.7 * (knee - (at(KNEE - 0.03) + 0.03)) * CM);   // (the crotch is behind the cardigan, so only: not under its hem, where two legs show)
  // front to back: the picture is from the front alone, so the trunk's depths are held to a medium build's for its widths (mine, not hers: no side picture)
  const depth = []; { const P = g.P, Hh = g.height; for (const [name, t, xmax, want] of DEPTHS) { const y = t * Hh; let z0 = 9, z1 = -9; for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i + 1] - y) < 0.006 && Math.abs(P[i]) < xmax) { z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); } const d = (z1 - z0) / Hh * CM; r.push(+arg("depthw", 0.4) * (d - want)); depth.push([name, want, d]); } }
  return { r, say, trunk, arm, depth, marks: { eyes, chin, wrist, wantWrist, crotch, H, pit: pitH, want: { eyes: at(TG.marks.eyes), chin: at(TG.marks.chin), pit: at(TG.marks.pit), hem: at(TG.marks.hem) }, knee: J("l_lowleg")[1] / H, hip: J("l_upleg")[1] / H, shoulder: J("l_uparm")[1] / H, shoulderX: J("l_uparm")[0] / H } };
}
const P0 = [...FEM.slice(0, NW), ...NAMES.map(n => n === "neck_length" ? -0.1 : 0), 1, 0], FREE = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 14, 15]), LAM = [...Array.from({ length: NW }, (_, k) => FREE.has(k) ? 0.35 : 1e6), +arg("lenridge", 0.6), +arg("lenridge", 0.6), 0.1, 1e6, 1e6, ...Array(9).fill(+arg("bumpridge", 1.5)), 2500, 28000];   // (the scale within 2% or so, the floor within a centimetre)   // (MHR's shapes that say something; the subtle ones, the neck's and the seat's stay the feminine base's)   // (the lengths free; the head's size left as it is: its face is v2female's; the body's own shapes before the sculpt's bumps)
const LIM = [...Array(NW).fill(3), ...NAMES.map(n => n === "arms_length" ? 1.75 : n === "thighs" ? 0.8 : 1.9), 1.06, 0.02], STEP = [...Array(NW).fill(0.15), ...NAMES.map(() => 0.15), 0.004, 0.002];
let p = arg("start") ? JSON.parse(readFileSync(arg("start"), "utf8")).p : P0.slice();
for (const z of (arg("zero", "") || "").split(",").filter(Boolean)) p[NW + NAMES.indexOf(z)] = 0;
const cost = (p, m) => m.r.reduce((s, v) => s + v * v, 0) + p.reduce((s, v, k) => s + LAM[k] * (v - P0[k]) ** 2, 0);
function solve(A, b) { const n = b.length; A = A.map(r => r.slice()); b = b.slice();
  for (let i = 0; i < n; i++) { let piv = i; for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[piv][i])) piv = k; [A[i], A[piv]] = [A[piv], A[i]]; [b[i], b[piv]] = [b[piv], b[i]];
    for (let k = i + 1; k < n; k++) { const f = A[k][i] / A[i][i]; for (let j = i; j < n; j++) A[k][j] -= f * A[i][j]; b[k] -= f * b[i]; } }
  const x = new Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i]; } return x; }
let m = measure(p), c = cost(p, m); const t0 = Date.now(); console.log(`start: cost ${c.toFixed(1)} (${m.r.length} measures, ${p.length} unknowns)`);
for (let it = 0; it < +arg("iters", 8); it++) {
  const n = p.length, Jm = m.r.map(() => new Array(n).fill(0));
  for (let k = 0; k < n; k++) { const q = p.slice(), h = STEP[k]; q[k] += h; const mq = measure(q); for (let i = 0; i < m.r.length; i++) Jm[i][k] = (mq.r[i] - m.r[i]) / h; }
  const A = Array.from({ length: n }, () => new Array(n).fill(0)), b = new Array(n).fill(0);
  for (let i = 0; i < m.r.length; i++) for (let k = 0; k < n; k++) { if (!Jm[i][k]) continue; b[k] -= Jm[i][k] * m.r[i]; for (let j = 0; j < n; j++) A[k][j] += Jm[i][k] * Jm[i][j]; }
  for (let k = 0; k < n; k++) b[k] -= LAM[k] * (p[k] - P0[k]);
  let done = false, mu = 0.05;
  while (mu < 400 && !done) { const A2 = A.map((row, k) => { const q = row.slice(); q[k] += LAM[k] + mu; return q; }), d = solve(A2, b), q = p.map((v, k) => Math.max(-LIM[k], Math.min(LIM[k], v + d[k]))), mq = measure(q), cq = cost(q, mq);
    if (cq < c - 1e-4) { p = q; m = mq; c = cq; done = true; } else mu *= 4; }
  console.log(`  ${it + 1}: cost ${c.toFixed(2)}, damping ${mu}, ${((Date.now() - t0) / 1000).toFixed(0)} s`); if (!done) break;
}
const rms = a => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / Math.max(1, a.length));
console.log("weights (the feminine base's):", p.slice(0, NW).map((v, k) => `${k}:${v.toFixed(2)}(${FEM[k].toFixed(2)})`).join(" "));
console.log("sliders:", NAMES.map((n, k) => `${n} ${p[NW + k].toFixed(2)}`).join(", "));
console.log("legs (share of height: width wanted, ours | outer wanted, ours; cm at 163):"); console.log("  " + m.say.filter((_, i) => i % 3 === 0).map(s => `${s[0].toFixed(2)}: ${s[1].toFixed(1)},${s[2].toFixed(1)} | ${s[3].toFixed(1)},${s[4].toFixed(1)}`).join("   "));
console.log(`  the legs' width off by ${rms(m.say.map(s => s[2] - s[1])).toFixed(2)} cm rms, at most ${Math.max(...m.say.map(s => Math.abs(s[2] - s[1]))).toFixed(2)}`);
console.log("trunk (half width wanted under the cardigan, ours):"); console.log("  " + m.trunk.filter((_, i) => i % 3 === 0).map(s => `${s[0].toFixed(2)}: ${s[1].toFixed(1)},${s[2].toFixed(1)}`).join("   ")); console.log(`  off by ${rms(m.trunk.map(s => s[2] - s[1])).toFixed(2)} cm rms`);
console.log("arms (how far out: thickness wanted, ours | top wanted, ours):"); console.log("  " + m.arm.filter((_, i) => i % 2 === 0).map(s => `${s[0].toFixed(2)}: ${s[1].toFixed(1)},${s[2].toFixed(1)} | ${s[3].toFixed(1)},${s[4].toFixed(1)}`).join("   "));
console.log("front to back (wanted, ours): " + m.depth.map(d => `${d[0]} ${d[1].toFixed(1)},${d[2].toFixed(1)}`).join("  "));
console.log(`the picture's scale ${p[NW + NAMES.length].toFixed(4)}, its floor ${(p[NW + NAMES.length + 1] * CM).toFixed(2)} cm`);
console.log("marks (wanted, ours; cm at 163):", `pit of the neck ${(m.marks.want.pit * CM).toFixed(1)},${(m.marks.pit * CM).toFixed(1)}  eyes ${(m.marks.want.eyes * CM).toFixed(1)},${(m.marks.eyes * CM).toFixed(1)}  chin ${(m.marks.want.chin * CM).toFixed(1)},${(m.marks.chin * CM).toFixed(1)}  wrist out ${(m.marks.wantWrist * CM).toFixed(1)},${(m.marks.wrist * CM).toFixed(1)}  crotch ${(m.marks.want.hem * CM).toFixed(1)}+,${(m.marks.crotch * CM).toFixed(1)}  knee joint ${(m.marks.knee * CM).toFixed(1)}  hip joint ${(m.marks.hip * CM).toFixed(1)}  shoulder joint ${(m.marks.shoulder * CM).toFixed(1)} up, ${(m.marks.shoulderX * CM).toFixed(1)} out`);
if (arg("out")) writeFileSync(S + arg("out") + ".fit.json", JSON.stringify({ p, names: NAMES, cost: c }));

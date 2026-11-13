// exprfit.mjs <name> [--head v2female] [--iters 8] [--ridge 0.01]: the expression (MHR's face shapes, the mouth's) that
// puts a head's lips where a picture's are. MediaPipe's 468 points on the picture (out/<name>.json: docs/research/
// headfit/lm.py) against the same points on the head with the shapes added, a camera fitted with them (a turn, a
// scale, a shift): the lips' rings count most, then the chin and jaw, the rest a little (her face is not ours: only the
// mouth is being matched). Left and right shapes are tied (a smile from the front). Writes out/<name>_expr.json.
import { readFileSync, writeFileSync } from "fs";
const R = new URL("../../../tools/character/", import.meta.url).pathname, B = new URL("../../../Content/Studio/Bodies/", import.meta.url).pathname;
const { loadMhr, grownBody, landmark } = await import(R + "tailor/node.mjs");
const HERE = new URL(".", import.meta.url).pathname + "out/", args = process.argv.slice(2), name = args[0], opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const M = loadMhr(), src = JSON.parse(readFileSync(HERE + name + ".json", "utf8")), N0 = 468, Tg = src.pts.slice(0, N0).map(p => [p[0], -p[1], -p[2]]);
const buf = readFileSync(B + "MHR_lod1.bin"), hl = buf.readUInt32LE(0), H = JSON.parse(buf.subarray(4, 4 + hl).toString("utf8")), ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const K = H.expr_points, EIDX = new Uint32Array(ab.slice(H.expr_idx_at, H.expr_idx_at + K * 4)), half = new Uint16Array(ab.slice(H.expr_at, H.expr_at + H.expressions * K * 6));
const f16 = h => { const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 31, f = h & 1023; return e === 0 ? s * f * 2 ** -24 : e === 31 ? (f ? NaN : s * Infinity) : s * (1 + f / 1024) * 2 ** (e - 15); };
const where = new Int32Array(M.n).fill(-1); EIDX.forEach((v, k) => { where[v] = k; });
const LM = JSON.parse(readFileSync(B + "MHR_landmarks.json", "utf8"));
// each shape's move at each landmark (MHR's units)
const names = H.expr_names, D = names.map((_, e) => Array.from({ length: N0 }, (_, i) => { const t = LM.tri[i] * 3, b = LM.bary[i], o = [0, 0, 0];
  for (let k = 0; k < 3; k++) { const q = where[M.T[t + k]]; if (q < 0) continue; for (let a = 0; a < 3; a++) o[a] += b[k] * f16(half[(e * K + q) * 3 + a]); } return o; }));
const g = grownBody(M, { base: -1, head: opt("--head", "v2female") }), U = new Float32Array(g.P.length); for (let i = 0; i < U.length; i++) U[i] = g.P[i] / g.scale;
const L0 = Array.from({ length: N0 }, (_, i) => landmark(M, U, i));
// the opening's own edges. MHR's lips are sealed by a membrane (its triangles stretch when the jaw drops), and MediaPipe's
// inner-lip points for both lips sit on it at one place: they never part. The membrane's corners that stay up with the
// jaw dropped are the upper lip's edge, those that go down the lower lip's; thirteen points along each, by how far
// across the mouth they are at rest, against the picture's inner rings read at the same fractions
const dv = (e, v) => { const q = where[v]; return q < 0 ? [0, 0, 0] : [0, 1, 2].map(a => f16(half[(e * K + q) * 3 + a])); };
{ const jd = names.indexOf("jawDrop"), c13 = L0[13], area = (A, Bq, C) => { const u = [Bq[0] - A[0], Bq[1] - A[1], Bq[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]; return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]); };
  const at = v => [U[v * 3], U[v * 3 + 1], U[v * 3 + 2]], dropped = v => { const d = dv(jd, v), p = at(v); return [p[0] + d[0], p[1] + d[1], p[2] + d[2]]; }, seal = new Set();
  for (let t = 0; t < M.T.length; t += 3) { const [a, b, c] = [M.T[t], M.T[t + 1], M.T[t + 2]]; if (where[a] < 0 || where[b] < 0 || where[c] < 0) continue; const m = at(a);
    if (Math.hypot(m[0] - c13[0], m[1] - c13[1], m[2] - c13[2]) > 0.045) continue; if (area(dropped(a), dropped(b), dropped(c)) > 10 * area(at(a), at(b), at(c)) + 1e-9) [a, b, c].forEach(v => seal.add(v)); }
  const up = [], lo = []; for (const v of seal) (dv(jd, v)[1] > -0.012 ? up : lo).push(v);
  const chain = vs => vs.map(v => [at(v)[0], v]).sort((a, b) => a[0] - b[0]), CU = chain(up), CL = chain(lo), x0 = Math.min(CU[0][0], CL[0][0]), x1 = Math.max(CU.at(-1)[0], CL.at(-1)[0]);
  const ringAt = (ids, t) => { const P = ids.map(i => Tg[i]).sort((a, b) => a[0] - b[0]), x = P[0][0] + t * (P.at(-1)[0] - P[0][0]); let k = 0; while (k < P.length - 2 && P[k + 1][0] < x) k++; const f = Math.max(0, Math.min(1, (x - P[k][0]) / Math.max(1e-9, P[k + 1][0] - P[k][0]))); return [0, 1, 2].map(a => P[k][a] + f * (P[k + 1][a] - P[k][a])); };
  const RU = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308], RL = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308], EDGE = [];
  for (const [C, ring] of [[CU, RU], [CL, RL]]) for (let j = 0; j <= 12; j++) { const t = j / 12, x = x0 + t * (x1 - x0); let k = 0; while (k < C.length - 2 && C[k + 1][0] < x) k++; const f = Math.max(0, Math.min(1, (x - C[k][0]) / Math.max(1e-9, C[k + 1][0] - C[k][0])));
    const va = C[k][1], vb = C[k + 1][1], pa = at(va), pb = at(vb); L0.push([0, 1, 2].map(a => pa[a] + f * (pb[a] - pa[a]))); Tg.push(ringAt(ring, t)); EDGE.push(L0.length - 1);
    names.forEach((_, e) => { const da = dv(e, va), db = dv(e, vb); D[e].push([0, 1, 2].map(a => da[a] + f * (db[a] - da[a]))); }); }
  globalThis.EDGE = EDGE; console.log(`the mouth's seal: ${seal.size} points, ${up.length} on the upper lip's edge, ${lo.length} on the lower's`); }
const N = L0.length, EDGE = globalThis.EDGE, EU = EDGE.slice(0, 13), EL = EDGE.slice(13);
// the unknowns: the mouth's shapes, left and right as one
const PAIRS = (opt("--shapes", "jawDrop,lipCornerPuller,upperLipRaiser,lowerLipDepressor,lipStretcher,cheekRaiser,dimpler,lipFunneler_?T,lipFunneler_?B,lipsToward_?T,lipsToward_?B,nasolabialFurrow,lipTightener,chinRaiser_B,chinRaiser_T,lipPressor,lipCornerDepressor,jawThrust")).split(",");
const groups = PAIRS.map(p => { const ids = p.includes("?") ? ["L", "R"].map(s => names.indexOf(p.replace("?", s))) : names.indexOf(p) >= 0 ? [names.indexOf(p)] : [names.indexOf(p + "_L"), names.indexOf(p + "_R")]; if (ids.some(i => i < 0)) throw new Error("no shape " + p); return { p, ids }; });
const OUTER = [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185], INNER = [78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191];
const OVAL = [152,148,176,149,150,136,172,58,377,400,378,379,365,397,288], w = new Float64Array(N).fill(0.25);
for (const i of OUTER) w[i] = 4; for (const i of INNER) w[i] = 0; for (const i of EDGE) w[i] = 6; for (const i of OVAL) w[i] = 1.5;   // (the table's inner points: the membrane's, left out)
for (const i of [33,133,263,362,1,2,98,327,168,6]) w[i] = 2;                      // the eyes' corners and the nose: what holds the camera
const WZ = 0.1, RIDGE = +opt("--ridge", 0.01), MAX = +opt("--max", 1.2);
let x = new Float64Array(groups.length);
const FIX = Object.fromEntries((opt("--fix", "") || "").split(",").filter(Boolean).map(kv => { const [k, v] = kv.split("="); return [PAIRS.indexOf(k), +v]; }));   // --fix jawDrop=0.36: held there (what the teeth say, which the lips' points can't)
for (const [k, v] of Object.entries(FIX)) { if (+k < 0) throw new Error("--fix: no such shape"); x[+k] = v; }
const shape = x => L0.map((p, i) => { const o = p.slice(); groups.forEach((gr, k) => { if (!x[k]) return; for (const e of gr.ids) for (let a = 0; a < 3; a++) o[a] += x[k] * D[e][i][a]; }); return o; });
const rot = v => { const a = Math.hypot(...v); if (a < 1e-12) return [[1,0,0],[0,1,0],[0,0,1]]; const [X, Y, Z] = v.map(q => q / a), c = Math.cos(a), s = Math.sin(a), C = 1 - c;
  return [[c + X*X*C, X*Y*C - Z*s, X*Z*C + Y*s], [Y*X*C + Z*s, c + Y*Y*C, Y*Z*C - X*s], [Z*X*C - Y*s, Z*Y*C + X*s, c + Z*Z*C]]; };
const proj = (L, P) => { const Rm = rot(P.slice(0, 3)), c = P[3]; return L.map(p => [c * (Rm[0][0]*p[0] + Rm[0][1]*p[1] + Rm[0][2]*p[2]) + P[4], c * (Rm[1][0]*p[0] + Rm[1][1]*p[1] + Rm[1][2]*p[2]) + P[5], c * (Rm[2][0]*p[0] + Rm[2][1]*p[1] + Rm[2][2]*p[2]) + P[6]]); };
const resid = (L, P) => { const q = proj(L, P), r = new Float64Array(N * 3); for (let i = 0; i < N; i++) { const s = Math.sqrt(w[i]); r[i*3] = s * (q[i][0] - Tg[i][0]); r[i*3+1] = s * (q[i][1] - Tg[i][1]); r[i*3+2] = s * WZ * (q[i][2] - Tg[i][2]); } return r; };
const solve = (A, b) => { const n = b.length, Mx = A.map((r, i) => [...r, b[i]]); for (let i = 0; i < n; i++) { let p = i; for (let j = i + 1; j < n; j++) if (Math.abs(Mx[j][i]) > Math.abs(Mx[p][i])) p = j; [Mx[i], Mx[p]] = [Mx[p], Mx[i]]; for (let j = i + 1; j < n; j++) { const f = Mx[j][i] / Mx[i][i]; for (let k = i; k <= n; k++) Mx[j][k] -= f * Mx[i][k]; } }
  const o = new Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let v = Mx[i][n]; for (let k = i + 1; k < n; k++) v -= Mx[i][k] * o[k]; o[i] = v / Mx[i][i]; } return o; };
const cost = r => r.reduce((t, v) => t + v * v, 0), W = w.reduce((a, b) => a + b, 0);
let L = shape(x); const cen = P => [0, 1, 2].map(a => P.reduce((t, p, i) => t + w[i] * p[a], 0) / W), cl = cen(L), ct = cen(Tg), spread = (P, c) => Math.sqrt(P.reduce((t, p, i) => t + w[i] * ((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2), 0));
let P = [0, 0, 0, spread(Tg, ct) / spread(L, cl), 0, 0, 0]; for (let a = 0; a < 3; a++) P[4 + a] = ct[a] - P[3] * cl[a];
const hp = () => [1e-4, 1e-4, 1e-4, P[3] * 1e-4, 0.01, 0.01, 0.01];
const step = (withX) => { const r0 = resid(L, P), J = [], n = withX ? groups.length : 0;
  for (let k = 0; k < n; k++) { const x2 = x.slice(); x2[k] += 0.1; const r1 = resid(shape(x2), P); J.push(r1.map((v, i) => (v - r0[i]) / 0.1)); }
  const h = hp(); for (let k = 0; k < 7; k++) { const p2 = P.slice(); p2[k] += h[k]; const r1 = resid(L, p2); J.push(r1.map((v, i) => (v - r0[i]) / h[k])); }
  const A = J.map(a => J.map(b => a.reduce((t, v, i) => t + v * b[i], 0))), gr = J.map(a => -a.reduce((t, v, i) => t + v * r0[i], 0));
  const sc = n ? A.slice(0, n).reduce((t, r, i) => t + r[i], 0) / n : 0; for (let k = 0; k < n; k++) { A[k][k] += RIDGE * sc; gr[k] -= RIDGE * sc * x[k]; } for (let k = n; k < n + 7; k++) A[k][k] *= 1.0001;
  const d = solve(A, gr); let s = 1;
  for (let t = 0; t < 6; t++, s /= 2) { const x2 = x.map((v, k) => k in FIX ? FIX[k] : k < n ? Math.max(0, Math.min(MAX, v + s * d[k])) : v), p2 = P.map((v, k) => v + s * d[n + k]), L2 = shape(x2); if (cost(resid(L2, p2)) < cost(r0)) { x = x2; P = p2; L = L2; return true; } }
  return false; };
for (let i = 0; i < 25; i++) step(false);
const rms = ids => { const q = proj(L, P); let t = 0; for (const i of ids) t += (q[i][0] - Tg[i][0]) ** 2 + (q[i][1] - Tg[i][1]) ** 2; return Math.sqrt(t / ids.length) / P[3] * 1000; };
console.log(`${name}: at rest the outer lips ${rms(OUTER).toFixed(1)} mm off, the opening's edges ${rms(EDGE).toFixed(1)}`);
for (let i = 0; i < +opt("--iters", 10); i++) if (!step(true)) break;
const Rm = rot(P.slice(0, 3)), yaw = Math.atan2(Rm[0][2], Rm[2][2]) * 180 / Math.PI, pitch = Math.asin(-Rm[1][2]) * 180 / Math.PI, roll = Math.atan2(Rm[1][0], Rm[1][1]) * 180 / Math.PI;
console.log(`  fitted: the outer lips ${rms(OUTER).toFixed(1)} mm off, the opening's edges ${rms(EDGE).toFixed(1)}; camera turned ${yaw.toFixed(0)}, tilted ${pitch.toFixed(0)}, rolled ${roll.toFixed(0)}`);
const out = {}; groups.forEach((gr, k) => { if (x[k] > 0.02) for (const e of gr.ids) out[names[e]] = Math.round(x[k] * 100) / 100; });
console.log("  " + groups.map((gr, k) => `${gr.p} ${x[k].toFixed(2)}`).join(", "));
// the opening as the picture has it and as fitted: its width and height (mm on our head)
const q = proj(L, P), span = (Q, a, b) => Math.hypot(Q[a][0] - Q[b][0], Q[a][1] - Q[b][1]) / P[3] * 1000;
console.log(`  the opening: hers ${span(Tg, EU[0], EU[12]).toFixed(1)} mm wide, ${span(Tg, EU[6], EL[6]).toFixed(1)} high in the middle; ours ${span(q, EU[0], EU[12]).toFixed(1)} wide, ${span(q, EU[6], EL[6]).toFixed(1)} high; the lips' corners hers ${span(Tg, 61, 291).toFixed(1)}, ours ${span(q, 61, 291).toFixed(1)}`);
writeFileSync(HERE + name + "_expr.json", JSON.stringify({ name, expr: out, pose: P, yaw, pitch, roll }, null, 1));

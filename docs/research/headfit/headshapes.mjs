// headshapes.mjs: what each of MHR's head identity shapes (20..39) does to a face, per +1 of its weight, on v2female's head (mm):
// the eyes' span, the face across at the mouth's height and half way to the chin, across in front of the ears, the eyes over the chin,
// the mouth, an eye, how far the nose stands out, the forehead. How v2 fox and v2 pixie got a slimmer lower face (shape 20)
const R = new URL("../../../tools/character/", import.meta.url).pathname;
const { loadMhr, grownBody, landmark } = await import(R + "tailor/node.mjs"); import { readFileSync } from "fs";
const PF = JSON.parse(readFileSync(new URL("../../../Content/Studio/Bodies/MHR_presets.json", import.meta.url).pathname, "utf8")), M = loadMhr(), f0 = PF.presets.feminine, sc = PF.sculpt.v2female;
const meas = w => { const g = grownBody(M, { base: -1, trialHead: { weights: w, sculpt: sc } }), U = g.P.map(v => v / g.scale), L = i => landmark(M, U, i), d = (a, b) => Math.hypot(L(a)[0] - L(b)[0], L(a)[1] - L(b)[1]), E = d(33, 263), T = M.T, eyeY = (L(33)[1] + L(263)[1]) / 2;
  const half = y => { let hi = -1e9; for (let t = 0; t < T.length; t += 3) for (let e = 0; e < 3; e++) { const a = T[t + e] * 3, b = T[t + (e + 1) % 3] * 3; if ((U[a + 1] - y) * (U[b + 1] - y) > 0) continue; const f = Math.abs(U[b + 1] - U[a + 1]) < 1e-9 ? 0 : (y - U[a + 1]) / (U[b + 1] - U[a + 1]), x = U[a] + f * (U[b] - U[a]); if (x > hi && x < 0.12) hi = x; } return hi; };
  return [E * 1000, 2000 * half(L(13)[1]), 2000 * half((L(13)[1] + L(152)[1]) / 2), 2000 * L(454)[0], (eyeY - L(152)[1]) * 1000, d(61, 291) * 1000, d(33, 133) * 1000, (L(4)[2] - L(168)[2]) * 1000, (L(10)[1] - eyeY) * 1000]; };
const b = meas(f0); console.log("            eyes' span  w@mouth  w@jaw  w@ear-front  eyes-chin  mouth  eye  nose out  forehead"); console.log("v2female".padEnd(12) + b.map(v => v.toFixed(1).padStart(9)).join(""));
console.log("feminine head weights:", f0.slice(20, 40).map(v => v.toFixed(2)).join(" "));
for (let k = 20; k < 40; k++) { const w = f0.slice(); w[k] += 1; const m = meas(w); console.log(("shape " + k).padEnd(12) + m.map((v, i) => (v - b[i]).toFixed(1).padStart(9)).join("")); }

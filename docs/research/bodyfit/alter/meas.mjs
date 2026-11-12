// meas.mjs cand.json: each candidate body ({name: {weights|"bodyv2", sculpt}}) made as the Studio makes it on v2female's head at 1.63 m:
// tape round the bust, waist and hips (convex hull, arms left out), widths; front and side silhouettes into sil_<name>.json
import { readFileSync, writeFileSync } from "fs";
const R = new URL("../../../../tools/character/", import.meta.url).pathname, { loadMhr, grownBody } = await import(R + "tailor/node.mjs");
const HERE = new URL(".", import.meta.url).pathname + "out/", M = loadMhr(), PF = JSON.parse(readFileSync(new URL("../../../../Content/Studio/Bodies/MHR_presets.json", import.meta.url).pathname, "utf8"));
const C = JSON.parse(readFileSync(process.argv[2] || HERE + "cand.json", "utf8")), W = JSON.parse(readFileSync(HERE + "weights.json", "utf8"));
const hull = pts => { const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); } for (const q of p.slice().reverse()) { while (hi.length >= 2 && cr(hi.at(-2), hi.at(-1), q) <= 0) hi.pop(); hi.push(q); }
  const h = [...lo.slice(0, -1), ...hi.slice(0, -1)]; let len = 0; for (let i = 0; i < h.length; i++) len += Math.hypot(h[i][0] - h[(i + 1) % h.length][0], h[i][1] - h[(i + 1) % h.length][1]); return len; };
for (const [name, c] of Object.entries(C)) {
  const weights = c.weights === "bodyv2" ? PF.presets.bodyv2 : c.weights ? (typeof c.weights === "string" ? W[c.weights] : c.weights) : PF.presets.bodyv2;
  const g = c.plain ? grownBody(M, { base: -1, head: "v2female", height: 1.63 }) : grownBody(M, { base: -1, head: "v2female", trial: { weights, sculpt: c.sculpt || {} }, height: 1.63, anime: !!c.anime, sculpt: c.own || {} }), P = g.P, H = 1.63;
  const tape = (t, xmax) => { const pts = []; for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i + 1] - t * H) < 0.006 && Math.abs(P[i]) < xmax) pts.push([P[i], P[i + 2]]); return pts.length > 5 ? hull(pts) * 100 : 0; };
  const wide = (t, xmax) => { let w = 0; for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i + 1] - t * H) < 0.006 && Math.abs(P[i]) < xmax) w = Math.max(w, Math.abs(P[i])); return w * 200; };
  let bust = 0, hips = 0, waist = 1e9, wAt = 0, bAt = 0, hAt = 0;
  for (let t = 0.69; t <= 0.775; t += 0.005) { const v = tape(t, 0.17); if (v > bust) { bust = v; bAt = t; } }
  for (let t = 0.47; t <= 0.56; t += 0.005) { const v = tape(t, 0.27); if (v > hips) { hips = v; hAt = t; } }
  for (let t = hAt + 0.05; t <= bAt - 0.03; t += 0.005) { const v = tape(t, 0.2); if (v && v < waist) { waist = v; wAt = t; } }
  const sh = wide(0.815, 0.3), thigh = (() => { let m = 0; for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i + 1] - 0.44 * H) < 0.006 && P[i] > 0.01) m = Math.max(m, P[i]); let n = 9; for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i + 1] - 0.44 * H) < 0.006 && P[i] > 0.01) n = Math.min(n, P[i]); return (m - n) * 100; })();
  console.log(`${name.padEnd(12)} bust ${bust.toFixed(0)} waist ${waist.toFixed(0)} hips ${hips.toFixed(0)} cm (waist/hips ${(waist / hips).toFixed(2)}); across: shoulders ${sh.toFixed(1)}, waist ${wide(wAt, 0.2).toFixed(1)}, hips ${wide(hAt, 0.27).toFixed(1)}, a thigh ${thigh.toFixed(1)}`);
  const tri = [], T = M.T; for (let t = 0; t < T.length; t += 3) tri.push(...[0, 1, 2].flatMap(k => [+P[T[t + k] * 3].toFixed(4), +P[T[t + k] * 3 + 1].toFixed(4), +P[T[t + k] * 3 + 2].toFixed(4)]));
  writeFileSync(HERE + "sil_" + name + ".json", JSON.stringify(tri));
}

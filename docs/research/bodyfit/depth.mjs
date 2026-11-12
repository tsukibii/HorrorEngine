// depth.mjs FIT.json|plain ...: a body's depth front to back and width at the bust's, the waist's and the hips' height (rest pose, cm at its own height), and a tape round each
import { readFileSync } from "fs";
const ROOT = new URL("../../../", import.meta.url).pathname, R0 = ROOT + "tools/character/"; const N = await import(R0 + "tailor/node.mjs");
const M = N.loadMhr(), NW = 20, FEM = JSON.parse(readFileSync(ROOT + "Content/Studio/Bodies/MHR_presets.json", "utf8")).presets.feminine;
for (const w of process.argv.slice(2)) { let o;
  if (w === "plain") o = { base: -1, v2: 1 }; else if (w === "file") o = { base: -1, v2: 1, body2: 1 }; else { const F = JSON.parse(readFileSync(w, "utf8")), weights = FEM.slice(); for (let k = 0; k < NW; k++) weights[k] = F.p[k]; const sculpt = {}; F.names.forEach((n, k) => { sculpt[n] = F.p[NW + k]; }); o = { base: -1, v2: 1, body2: 1, trial: { weights, sculpt } }; }
  const g = N.grownBody(M, o), P = g.P, H = g.height, out = [];
  for (const [name, t, xmax] of [["bust", 0.735, 0.17], ["under the bust", 0.69, 0.17], ["waist", 0.645, 0.2], ["belly", 0.585, 0.22], ["hips", 0.52, 0.26]]) { const y = t * H, pts = []; for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i + 1] - y) < 0.006 && Math.abs(P[i]) < xmax) pts.push([P[i], P[i + 2]]);
    let x0 = 9, x1 = -9, z0 = 9, z1 = -9; for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    // a tape round it: the convex hull's length
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); } for (const q of p.slice().reverse()) { while (hi.length >= 2 && cr(hi.at(-2), hi.at(-1), q) <= 0) hi.pop(); hi.push(q); }
    const hull = [...lo.slice(0, -1), ...hi.slice(0, -1)]; let len = 0; for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; len += Math.hypot(a[0] - b[0], a[1] - b[1]); }
    out.push(`${name} ${((x1 - x0) * 100).toFixed(0)} wide, ${((z1 - z0) * 100).toFixed(0)} deep, ${(len * 100).toFixed(0)} round`); }
  console.log((w.split("/").pop().replace(".fit.json", "")).padEnd(7) + out.join(";  ")); }

// glb.mjs OUT.glb FIT.json|plain|fem: the whole body at rest (MHR's own pose), its middle at the origin, for Godot's pictures
import { readFileSync } from "fs";
const ROOT = new URL("../../../", import.meta.url).pathname, R0 = ROOT + "tools/character/"; const N = await import(R0 + "tailor/node.mjs"); const { Glb } = await import(R0 + "hair2/glb.mjs");
const M = N.loadMhr(), T = M.T, NW = 20, FEM = JSON.parse(readFileSync(ROOT + "Content/Studio/Bodies/MHR_presets.json", "utf8")).presets.feminine;
let o; const w = process.argv[3];
if (w === "plain") o = { base: -1, v2: 1 }; else if (w === "fem") o = { base: -1 }; else if (w === "file") o = { base: -1, v2: 1, body2: 1 };
else { const F = JSON.parse(readFileSync(w, "utf8")), weights = FEM.slice(); for (let k = 0; k < NW; k++) weights[k] = F.p[k]; const sculpt = {}; F.names.forEach((n, k) => { sculpt[n] = F.p[NW + k]; }); o = { base: -1, v2: 1, body2: 1, trial: { weights, sculpt } }; }
const g = N.grownBody(M, o), P = g.P, n = P.length / 3, pos = new Float32Array(P.length), nrm = new Float32Array(P.length);
for (let i = 0; i < n; i++) { pos[i * 3] = P[i * 3]; pos[i * 3 + 1] = P[i * 3 + 1] - 0.83; pos[i * 3 + 2] = P[i * 3 + 2]; }
for (let t = 0; t < T.length; t += 3) { const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3, ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const i of [a, b, c]) { nrm[i] += nx; nrm[i + 1] += ny; nrm[i + 2] += nz; } }
for (let i = 0; i < n; i++) { const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1; nrm[i * 3] /= l; nrm[i * 3 + 1] /= l; nrm[i * 3 + 2] /= l; }
const G = new Glb(); G.node({ name: "head_skin", mesh: G.mesh({ name: "head_skin", position: pos, normal: nrm, index: Uint32Array.from(T), material: G.material({ name: "skin", color: [0.8, 0.63, 0.54, 1], roughness: 0.6 }) }) }); G.write(process.argv[2]); console.log(process.argv[2]);

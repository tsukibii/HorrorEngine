// over.mjs FIT.json OUT.json: the fitted body in the T-pose as triangles in the picture's own pixels (front view, no perspective), by the fit's scale and floor
import { readFileSync, writeFileSync } from "fs";
const ROOT = new URL("../../../", import.meta.url).pathname, S = (process.env.BODYFIT || ROOT + "Saved/Body/fit") + "/", R0 = ROOT + "tools/character/";
const N = await import(R0 + "tailor/node.mjs"); const PO = await import(R0 + "pose.js");
const M = N.loadMhr(), T = M.T, NW = 20;
const rb = readFileSync(ROOT + "Content/Studio/Bodies/MHR_lod1_rig.bin"), R = PO.readRig(rb.buffer.slice(rb.byteOffset, rb.byteOffset + rb.byteLength));
const F = JSON.parse(readFileSync(process.argv[2], "utf8")), TG = JSON.parse(readFileSync(S + "t1_targets.json", "utf8")), FEM = JSON.parse(readFileSync(ROOT + "Content/Studio/Bodies/MHR_presets.json", "utf8")).presets.feminine;
const p = F.p, weights = FEM.slice(); for (let k = 0; k < NW; k++) weights[k] = p[k]; const sculpt = {}; F.names.forEach((n, k) => { sculpt[n] = p[NW + k]; });
const plain = process.argv.includes("--plain"), g = N.grownBody(M, plain ? { base: -1, v2: 1 } : { base: -1, v2: 1, body2: 1, trial: { weights, sculpt } }), X = PO.pose(R, PO.joints(R, g.P, M.P, g.scale, g.F), "t"), Sx = PO.skin(R, X, g.P);
let lo = 1e9, hi = -1e9; for (let i = 1; i < Sx.length; i += 3) { lo = Math.min(lo, Sx[i]); hi = Math.max(hi, Sx[i]); } const H = hi - lo;
const sc = plain ? 1 : p[NW + F.names.length], fl = plain ? 0 : p[NW + F.names.length + 1];
// a share t' of our height is the picture's share t = t'/sc - fl; a picture row y = floor - t * stature_px
const xy = []; for (let i = 0; i < Sx.length; i += 3) { const t = (Sx[i + 1] - lo) / H / sc - fl, x = Sx[i] / H / sc; xy.push(+(TG.cx + x * TG.stature_px).toFixed(1), +(TG.floor - t * TG.stature_px).toFixed(1)); }
writeFileSync(process.argv[3], JSON.stringify({ xy, tris: Array.from(T) })); console.log("written", process.argv[3]);

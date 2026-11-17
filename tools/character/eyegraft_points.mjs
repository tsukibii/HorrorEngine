// The grafted eyes' points as the Studio places them (eyegraft.js: placeAll), worked out in node on MHR's base, for
// EYEPATCH (python tools/eye_patch.py check): the Studio's maths and eye_patch.py's `apply` are written twice, and this
// is how the check holds one to the other, point by point.
//   node tools/character/eyegraft_points.mjs EYES.bin POINTS.f32 TRIS.u32 '{"cute": 1}' OUT.f32
// POINTS.f32 and TRIS.u32: MHR's points (float32 x, y, z) and triangles (uint32), as eye_patch.py writes them; the keys
// a shape (eyegraft.js SHAPE_KEYS); OUT.f32: the left eye's points open, then shut (float32 x, y, z each).
import fs from "fs";
import path from "path";
import { register } from "module";
import { fileURLToPath, pathToFileURL } from "url";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
// (eyegraft.js imports three.js by its bare name, as the pages' import maps give it: the vendored copy here)
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, n) { return s === "three" ? { url: ${JSON.stringify(pathToFileURL(path.join(ROOT, "tools", "director", "vendor", "three.module.min.js")).href)}, shortCircuit: true } : n(s, c); }`));
const [bin, pf, tf, keys, outf] = process.argv.slice(2);
const bytes = f => { const b = fs.readFileSync(f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => bytes(bin) });   // (the Studio fetches the graft from its server)
const EG = await import("./eyegraft.js");
const P = new Float32Array(bytes(pf)), T = new Uint32Array(bytes(tf)), K = { ...EG.KEYS0, ...JSON.parse(keys) };
const G = await EG.load("MHR_eyes.bin", P, T); EG.bindTris(T);
const eye = EG.eyeOf(G, "L", P, 1, 0, K), n = G.sides.L.n, out = new Float32Array(n * 6);
EG.placeAll(G, "L", P, eye, 0, out.subarray(0, n * 3)); EG.placeAll(G, "L", P, eye, 1, out.subarray(n * 3));
fs.writeFileSync(outf, Buffer.from(out.buffer));
console.log(JSON.stringify({ n, c: eye.c, r: eye.r }));

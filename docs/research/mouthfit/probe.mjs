// probe.mjs: what a few of MHR's face shapes do to the lips' landmarks at full weight (mm on MHR's base)
import { readFileSync } from "fs";
const R = new URL("../../../tools/character/", import.meta.url).pathname, B = new URL("../../../Content/Studio/Bodies/", import.meta.url).pathname;
const { loadMhr } = await import(R + "tailor/node.mjs"); const M = loadMhr();
const buf = readFileSync(B + "MHR_lod1.bin"), hl = buf.readUInt32LE(0), H = JSON.parse(buf.subarray(4, 4 + hl).toString("utf8")), ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const K = H.expr_points, EIDX = new Uint32Array(ab.slice(H.expr_idx_at, H.expr_idx_at + K * 4)), half = new Uint16Array(ab.slice(H.expr_at, H.expr_at + H.expressions * K * 6));
const f16 = h => { const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 31, f = h & 1023; return e === 0 ? s * f * 2 ** -24 : s * (1 + f / 1024) * 2 ** (e - 15); };
const where = new Int32Array(M.n).fill(-1); EIDX.forEach((v, k) => { where[v] = k; });
const LM = JSON.parse(readFileSync(B + "MHR_landmarks.json", "utf8")), names = H.expr_names;
const mv = (e, i) => { const t = LM.tri[i] * 3, b = LM.bary[i], o = [0, 0, 0], miss = []; for (let k = 0; k < 3; k++) { const q = where[M.T[t + k]]; if (q < 0) { miss.push(k); continue; } for (let a = 0; a < 3; a++) o[a] += b[k] * f16(half[(e * K + q) * 3 + a]); } return o.map(v => +(v * 1000).toFixed(1)).join(",") + (miss.length ? " (missing " + miss.length + ")" : ""); };
let mx = 0; for (let i = 0; i < 2000; i++) mx = Math.max(mx, Math.abs(f16(half[(names.indexOf("jawDrop") * K + i) * 3 + 1])));
console.log("points with expressions", K, "of", M.n, "; jawDrop's largest move in the first 2000:", (mx * 1000).toFixed(1), "mm");
for (const n of ["jawDrop", "lipCornerPuller_L", "upperLipRaiser_L", "lowerLipDepressor_L", "lipStretcher_L"]) { const e = names.indexOf(n);
  console.log(n.padEnd(20), "upper lip middle (13)", mv(e, 13), "| lower lip middle (14)", mv(e, 14), "| outer lower (17)", mv(e, 17), "| chin (152)", mv(e, 152), "| her left corner (291)", mv(e, 291), "| inner left corner (308)", mv(e, 308)); }

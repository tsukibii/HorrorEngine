// direct.mjs [head ...] [--sculpt JSON]: a head's own front proportions straight off its mesh (no camera, no detector), in
// the shares two_heads.md reads off the pictures by hand: of the eyes' span (outer corner to outer corner)
const R = new URL("../../../tools/character/", import.meta.url).pathname;
const { loadMhr, grownBody, landmark } = await import(R + "tailor/node.mjs"); const GW = await import(R + "grow.js");
const M = loadMhr(), args = process.argv.slice(2), si = args.indexOf("--sculpt"), extra = si < 0 ? {} : JSON.parse(args[si + 1]), heads = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const yaw = 0;
export function measure(sculptOwn, head) {
  const g = grownBody(M, { base: -1, head, sculpt: sculptOwn }), U = new Float32Array(g.P.length); for (let i = 0; i < U.length; i++) U[i] = g.P[i] / g.scale;
  const c = Math.cos(yaw), s = Math.sin(yaw); for (let i = 0; i < U.length; i += 3) { const x = U[i], z = U[i + 2]; U[i] = x * c + z * s; U[i + 2] = -x * s + z * c; }   // (turned as the picture's head is)
  const L = i => landmark(M, U, i), d = (a, b) => Math.hypot(L(a)[0] - L(b)[0], L(a)[1] - L(b)[1]), E = d(33, 263), eyeY = (L(33)[1] + L(263)[1]) / 2;
  const span = (y, zmin = -1) => { let lo = 1e9, hi = -1e9; const T = M.T; for (let t = 0; t < T.length; t += 3) for (let e = 0; e < 3; e++) { const a = T[t + e] * 3, b = T[t + (e + 1) % 3] * 3; if ((U[a + 1] - y) * (U[b + 1] - y) > 0) continue; const f = Math.abs(U[b + 1] - U[a + 1]) < 1e-9 ? 0 : (y - U[a + 1]) / (U[b + 1] - U[a + 1]), x = U[a] + f * (U[b] - U[a]), z = U[a + 2] + f * (U[b + 2] - U[a + 2]); if (z < zmin || Math.abs(x) > 0.12) continue; lo = Math.min(lo, x); hi = Math.max(hi, x); } return hi - lo; };
  const subn = L(2), tip = L(4), ala = L(327), chin = L(152), seam = L(13); let aw = 0; for (let i = 0; i < U.length; i += 3) if (U[i + 1] > subn[1] - 0.002 && U[i + 1] < subn[1] + 0.012 && U[i + 2] > ala[2] - 0.003 && Math.abs(U[i] - subn[0]) < 0.03) aw = Math.max(aw, Math.abs(U[i] - subn[0]));
  return { "eye length": (d(33, 133) + d(263, 362)) / 2 / E, "between the eyes": d(133, 362) / E, "eyes to nose base": (eyeY - subn[1]) / E, "eyes to mouth": (eyeY - seam[1]) / E, "eyes to chin": (eyeY - chin[1]) / E,
    "mouth width": d(61, 291) / E, "face width at the mouth": span(seam[1]) / E, "face width at the cheekbones": span(eyeY - 0.02, L(454)[2] + 0.012) / E, "chin width (4% over its edge)": span(chin[1] + 0.035 * E, chin[2] - 0.05) / E,
    "eye span, mm": E * 1000, "upper lip's red": Math.abs(L(0)[1] - L(13)[1]) / E, "lower lip's red": Math.abs(L(14)[1] - L(17)[1]) / E };
}
if (process.argv[1].endsWith("direct.mjs")) {
  const cols = heads.map(h => [h, measure({ ...((GW.LIPS[(GW.HEADS[h] || {}).lips] || {}).sculpt || {}), ...extra }, h === "plain" ? "" : h)]);
  console.log("".padEnd(32) + cols.map(c => c[0].padStart(10)).join(""));
  for (const k of Object.keys(cols[0][1])) console.log(k.padEnd(32) + cols.map(c => (c[1][k] > 5 ? c[1][k].toFixed(1) : c[1][k].toFixed(3)).padStart(10)).join(""));
}

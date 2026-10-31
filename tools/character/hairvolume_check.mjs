// HAIRVOLUME: the salon bake's hair volume (hairvolume.js) on a made-up head: a sphere of 9 cm under two layers of card
// vertices (an inner one 5 mm off the skin, an outer one 2 cm off it), each vertex's card face turned at random across
// the hair. The shell normals point out of the hair's mass (along the radius, on both layers, whatever way their cards
// face), the inner layer sees less of the sky than the outer one (the occlusion), the grid is small and quick, nothing
// is NaN, and a card wound into the hair is turned to face its shell normal. Ends "HAIRVOLUME ok".
//   node tools/character/hairvolume_check.mjs
import * as HV from "./hairvolume.js";

const pos = [], face = [];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (const R of [0.095, 0.11]) for (let a = 0; a < 40; a++) for (let b = 0; b < 20; b++) {
  const th = (b + 0.5) / 20 * Math.PI * 0.6, ph = a / 40 * 2 * Math.PI, d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
  pos.push(d[0] * R, d[1] * R, d[2] * R);
  const s = rnd() < 0.5 ? 1 : -1; face.push(d[2] * s, d[0] * s, d[1] * s);   // a card's face: square to the radius, either way
}
const t0 = Date.now();
const V = HV.volume(pos, p => Math.hypot(...p) < 0.09, { cell: 0.008, blur: 0.012 });
const sh = HV.shell(V, pos, face, 0.8), oc = HV.occlusion(V, pos, sh, { reach: 0.06 });
const ms = Date.now() - t0, half = pos.length / 6;
let along = [0, 0], open = [0, 0], nan = 0;
for (let i = 0; i < pos.length / 3; i++) {
  const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], r = Math.hypot(...p), k = i < half ? 0 : 1;
  const d = (sh[i * 3] * p[0] + sh[i * 3 + 1] * p[1] + sh[i * 3 + 2] * p[2]) / r;
  if (![d, oc[i]].every(Number.isFinite)) nan++;
  along[k] += d / half; open[k] += oc[i] / half;
}
const bad = [];
const say = (ok, what) => { console.log((ok ? "  ok  " : "  BAD ") + what); if (!ok) bad.push(what); };
say(along[0] > 0.9 && along[1] > 0.9, `the shell normals point out of the hair, whichever way their cards face: along the radius ${along[0].toFixed(2)} (inner layer), ${along[1].toFixed(2)} (outer); over 0.9`);
say(open[0] < open[1] - 0.1, `the inner layer sees less sky than the outer: ${open[0].toFixed(3)} against ${open[1].toFixed(3)} (at least 0.1 less)`);
say(!nan, `no NaN (${nan})`);
say(ms < 3000 && V.n[0] * V.n[1] * V.n[2] < 2e6, `the grid ${V.n.join(" x ")} in ${ms} ms`);
// the winding: two cards on the crown, one wound out of the hair and one into it, both with the shell's normal (up): the
// one wound in is turned round, the other left; a second pass turns nothing
const cp = [-0.01, 0.1, 0, 0.01, 0.1, 0, 0, 0.1, 0.02], cn = [0, 1, 0, 0, 1, 0, 0, 1, 0];
const idx = new Uint32Array([0, 2, 1, 0, 1, 2]), t1 = HV.wind(idx, cp, cn), t2 = HV.wind(idx, cp, cn);
const up = t => { const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3, u = [cp[b] - cp[a], cp[b + 2] - cp[a + 2]], v = [cp[c] - cp[a], cp[c + 2] - cp[a + 2]]; return u[1] * v[0] - u[0] * v[1] > 0; };
say(t1 === 1 && t2 === 0 && up(0) && up(3), `the cards wound toward their shell normals: ${t1} turned round, then ${t2}; both now face up`);
console.log(bad.length ? "HAIRVOLUME FAIL" : "HAIRVOLUME ok");
process.exit(bad.length ? 1 : 0);

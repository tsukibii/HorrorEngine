// The Studio's own bodies, dumped for the fit test:   node bodies.mjs [out dir]
// writes <out dir>/<name>.f32 (the points), <name>_form.f32 when the body has a dress form of its own (a full bust:
// TAILOR §1j), tris.u32, and bodies.json (each one's height). The seven test bodies of tailor/bodies.json, and main's
// newer proportions (DECISIONS 2026-11-10 and 11): the Anime switch's full and flat busts, children of ten and fourteen.
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { loadMhr, mhrBody, grownBody, bodyWeights, bodySculpt } from "../../../../tools/character/tailor/node.mjs";
const OUT = process.argv[2] || "bodies";
const m = loadMhr(); mkdirSync(OUT, { recursive: true });
const save = (name, P) => writeFileSync(join(OUT, `${name}.f32`), Buffer.from(new Float32Array(P).buffer));
const info = {};
const H = { average: 1.7, feminine: 1.62, masculine: 1.76, slim_feminine: 1.62, full_feminine: 1.62, slim_masculine: 1.76, full_masculine: 1.76 };
for (const [name, h] of Object.entries(H)) { const b = mhrBody(m, bodyWeights(name), h, bodySculpt(name)); save(name, b.P); info[name] = { height: h }; }
// Anime: the Bust past the plain slider's ends, on the feminine base; clothes go on its dress form
for (const [name, bust] of [["anime_full", 2.1], ["anime_flat", -2]]) {
  const sc = { ...bodySculpt("feminine"), bust };
  save(name, mhrBody(m, bodyWeights("feminine"), 1.62, sc, { anime: true }).P);
  if (bust > 1) save(name + "_form", mhrBody(m, bodyWeights("feminine"), 1.62, sc, { anime: true, form: true }).P);
  info[name] = { height: 1.62, form: bust > 1, bust };
}
// children (grow.js): a girl of ten, a boy of fourteen, at their ages' own heights
for (const [name, age, base] of [["girl_10", 10, -0.7], ["boy_14", 14, 0.7]]) {
  const b = grownBody(m, { age, base }); save(name, b.P); info[name] = { height: +b.height.toFixed(3), age };
}
writeFileSync(join(OUT, "tris.u32"), Buffer.from(new Uint32Array(m.T).buffer));
writeFileSync(join(OUT, "bodies.json"), JSON.stringify(info, null, 1));
for (const [k, v] of Object.entries(info)) console.log(k, JSON.stringify(v));

// The Studio's own test bodies (identity weights, sculpt, height), dumped for the fit test:   node bodies.mjs [out dir]
// writes <out dir>/<name>.f32 (the points) and tris.u32
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { loadMhr, mhrBody, bodyWeights, bodySculpt } from "../../../../tools/character/tailor/node.mjs";
const OUT = process.argv[2] || "bodies";
const m = loadMhr(); mkdirSync(OUT, { recursive: true });
const H = { average: 1.7, feminine: 1.62, masculine: 1.76, slim_feminine: 1.62, full_feminine: 1.62, slim_masculine: 1.76, full_masculine: 1.76 };
for (const [name, h] of Object.entries(H)) {
  const b = mhrBody(m, bodyWeights(name), h, bodySculpt(name));
  writeFileSync(join(OUT, `${name}.f32`), Buffer.from(new Float32Array(b.P).buffer));
  console.log(name, h, b.P.length / 3, "points");
}
writeFileSync(join(OUT, "tris.u32"), Buffer.from(new Uint32Array(m.T).buffer));

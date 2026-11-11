// The tailor's own garments on one of the dumped bodies, for wearing with library garments:
//   node tailor_parts.mjs <bodies dir> <body> <out prefix> design[=#colour][@{"look json"}] ...
//   node tailor_parts.mjs <bodies dir> <body> <out prefix> <list.json>      [[design, colour, look, edit], ...]: an outfit's own lines
// writes <out prefix>.json (each garment: its design, slot and parts) and <out prefix>.bin (the parts' arrays, as
// tailor/sheet.mjs sends them: P, T, N, UV, PART, S, CRZ). Cut on the body's dress form when it has one.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import * as TAILOR from "../../../../tools/character/tailor.js";
import { ROOT } from "../../../../tools/character/tailor/node.mjs";
import { SURFACES } from "../../../../tools/character/tailor/fabric.js";
const [dir, body, out, ...list] = process.argv.slice(2);
const f32 = f => { const b = readFileSync(f); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const u32 = f => { const b = readFileSync(f); return new Uint32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const form = join(dir, body + "_form.f32"), P = f32(existsSync(form) ? form : join(dir, body + ".f32")), T = u32(join(dir, "tris.u32"));
const designs = JSON.parse(readFileSync(join(ROOT, "Content", "Studio", "Clothes", "designs.json"))).designs;
const wear = (list.length === 1 && list[0].endsWith(".json") ? JSON.parse(readFileSync(list[0])) : list.map(s => { const [a, look] = s.split("@"), [d, c] = a.split("="); return [d, c, look ? JSON.parse(look) : undefined]; }))
  .map(([d, c, look, edit]) => { if (!designs[d]) { console.error("no design " + d); process.exit(1); } return [d, c || designs[d].color, look || undefined, edit || undefined]; });
const B = TAILOR.body(P, T), worn = TAILOR.dress(B, wear, designs, { drape: false });
const KEYS = [["P", Float32Array], ["T", Uint32Array], ["N", Float32Array], ["UV", Float32Array], ["PART", Float32Array], ["S", Float32Array], ["CRZ", Float32Array]];
const blobs = [], head = worn.map((g, i) => ({ design: wear[i][0], slot: designs[wear[i][0]].slot, surface: designs[wear[i][0]].surface, sheer: !!(SURFACES[designs[wear[i][0]].surface] || [])[4], look: g.look,
  parts: g.parts.map(q => { for (const [k, A] of KEYS) blobs.push(Buffer.from(new A(q[k] || []).buffer)); return { name: q.name, color: q.color, fabric: q.fabric, surface: q.surface, n: Object.fromEntries(KEYS.map(([k]) => [k, (q[k] || []).length])) }; }) }));
writeFileSync(out + ".json", JSON.stringify(head)); writeFileSync(out + ".bin", Buffer.concat(blobs));
console.log(worn.map(g => `${g.name} ${g.stats.triangles} tris`).join(", "));

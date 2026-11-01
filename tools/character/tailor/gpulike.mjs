// The card's way of draping (tailor/drape_gpu.js likeGPU: the constraints in batches, the planes asked every few steps)
// against drape.js's own loop, on the CPU in node, no card needed: the first hanging garment of an outfit hung both
// ways, how far apart their points end and how each hung. Where to try a change to the card's method before the card
// (TAILOR §1i). node tools/character/tailor/gpulike.mjs "t-shirt and skirt" [body] [height]
import { readFileSync } from "fs"; import { join } from "path";
import { loadMhr, namedBody, ROOT } from "./node.mjs"; import * as TAILOR from "../tailor.js"; import { likeGPU } from "./drape_gpu.js";
const designs = JSON.parse(readFileSync(join(ROOT, "Content/Studio/Clothes/designs.json"), "utf8")).designs;
const outfits = JSON.parse(readFileSync(join(ROOT, "Content/Studio/Clothes/outfits.json"), "utf8")).outfits;
const m = loadMhr(), b = namedBody(m, process.argv[3] || "feminine", +(process.argv[4] || 1.62)), B = TAILOR.body(b.P, b.T), list = outfits[process.argv[2]];
const upto = TAILOR.plan("f", list, designs).findIndex(g => g.drapes) + 1;
const run = (gpu) => { const it = TAILOR.dressing(B, list.slice(0, upto), designs, { drape: true, body: "f", cache: false, gpu }); let r, back; while (!(r = it.next(back)).done) back = r.value.gpu ? likeGPU(r.value.gpu) : undefined; return r.value[upto - 1]; };
const a = run(false), e = run(true), P = a.hung, Q = e.hung, d = [];
for (let i = 0; i < P.length; i += 3) d.push(Math.hypot(P[i] - Q[i], P[i + 1] - Q[i + 1], P[i + 2] - Q[i + 2]));
d.sort((x, y) => x - y);
console.log(a.name, "CPU", JSON.stringify(a.drape.stretch), a.drape.steps, "steps", a.drape.ms + " ms | the card's way", JSON.stringify(e.drape.stretch), e.drape.steps, "steps", e.drape.ms + " ms | apart, mm: p50", (d[d.length >> 1] * 1000).toFixed(1), "p90", (d[Math.floor(0.9 * d.length)] * 1000).toFixed(1), "max", (d[d.length - 1] * 1000).toFixed(1));

// LIBRARY: the library garments' fit in JavaScript (tailor/library.js), no browser.   node tools/character/tailor/librarytest.mjs [id ...]
// On the bakes in <clothing>/_mhr (tools/clothing_library.py bake): on MHR's average itself a garment stays where it
// was baked; on the average turned and scaled it turns and scales with it; on the Studio's test bodies (slim, full, a
// full bust's dress form, children of ten and fourteen) every point is finite, hardly any cloth is left inside the skin
// and none of it flies off; a part comes back as the tailor's own with its own UVs and the skin it hides.
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadMhr, mhrBody, grownBody, bodyWeights, bodySculpt } from "./node.mjs";
import { readBake, Wearer, frames, layerOf, rigid } from "./library.js";
import { Surface } from "./mesh.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."), DIR = join(process.env.STUDIO_CLOTHING || join(ROOT, "assets", "clothing"), "_mhr");
const faults = [], fail = m => faults.push(m), layerNote = [];
if (!existsSync(join(DIR, "_base.f32"))) { console.log(`LIBRARY FAIL: no bakes in ${DIR} (python tools/clothing_library.py bake)`); process.exit(1); }
const base = new Float32Array(readFileSync(join(DIR, "_base.f32")).buffer.slice(0));
const all = readdirSync(DIR).filter(f => f.endsWith(".bin")).map(f => f.slice(0, -4)).sort();
const want = process.argv.slice(2).length ? process.argv.slice(2) : ["elvs_pencil_skirt", "mindfront_f_dress_02", "punkduck_spaghetti_strap_tank_top", "cortu_jeans_shorts", "mindfront_m_suit_01", "toigo_ballet_flats", "wolgade_female_top_01", "elvs_camisole1"].filter(i => all.includes(i));
if (!want.length) { console.log("LIBRARY FAIL: none of the garments asked for is baked"); process.exit(1); }
const bake = id => { const b = readFileSync(join(DIR, id + ".bin")); return readBake(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const m = loadMhr(), T = m.T;
if (base.length !== m.T.reduce((a, b) => Math.max(a, b), 0) * 3 + 3) fail(`the bakes' body has ${base.length / 3} points, MHR's ${m.T.reduce((a, b) => Math.max(a, b), 0) + 1}`);

// 1. the average itself: where it was baked (the warp alone)
const W0 = new Wearer(base, base, T);
for (const id of want) {
  const b = bake(id), G = W0.warp(b.rest); let worst = 0;
  for (let i = 0; i < G.length; i++) worst = Math.max(worst, Math.abs(G[i] - b.rest[i]));
  if (!(worst < 1e-4)) fail(`${id}: on the average itself it moved ${(worst * 1000).toFixed(2)} mm`);
}
// 2. the average turned 30 degrees about Y, 1.1 times its size and moved: the garment the same
{
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6), k = 1.1, move = P => { const Q = new Float32Array(P.length); for (let i = 0; i < P.length; i += 3) { Q[i] = k * (c * P[i] + s * P[i + 2]) + 0.2; Q[i + 1] = k * P[i + 1] + 0.05; Q[i + 2] = k * (-s * P[i] + c * P[i + 2]) - 0.1; } return Q; };
  const X = move(base), f = frames(base, X, T); let sw = 0; for (const v of f.s) sw = Math.max(sw, Math.abs(v - k));
  if (!(sw < 1e-3)) fail(`a body 1.1 times its size reads as scaled by up to ${(sw).toFixed(4)} off that`);
  const W = new Wearer(base, X, T);
  for (const id of want.slice(0, 3)) { const b = bake(id), G = W.warp(b.rest), E = move(b.rest); let worst = 0; for (let i = 0; i < G.length; i++) worst = Math.max(worst, Math.abs(G[i] - E[i]));
    if (!(worst < 1e-3)) fail(`${id}: on a body turned and scaled it is up to ${(worst * 1000).toFixed(2)} mm from turning and scaling with it`); }
}
// 3. the Studio's bodies
const bodies = [["feminine", () => mhrBody(m, bodyWeights("feminine"), 1.62, bodySculpt("feminine")).P], ["full_masculine", () => mhrBody(m, bodyWeights("full_masculine"), 1.76, bodySculpt("full_masculine")).P],
  ["slim_feminine", () => mhrBody(m, bodyWeights("slim_feminine"), 1.62, bodySculpt("slim_feminine")).P],
  ["anime_full (its dress form)", () => mhrBody(m, bodyWeights("feminine"), 1.62, { ...bodySculpt("feminine"), bust: 2.1 }, { anime: true, form: true }).P],
  ["girl_10", () => grownBody(m, { age: 10, base: -0.7 }).P], ["boy_14", () => grownBody(m, { age: 14, base: 0.7 }).P]];
let n = 0, slowest = 0;
for (const [bname, make] of bodies) {
  const P = Float32Array.from(make()), W = new Wearer(base, P, T), skin = new Surface(P, T, null, 0.012), c = {};
  for (const id of want) {
    const b = bake(id), g = W.wear(b, "lib:" + id), q = g.parts[0]; n++; slowest = Math.max(slowest, g.stats.ms);
    if (q.P.length !== b.src.length * 3 || q.N.length !== q.P.length || q.UV.length !== b.src.length * 2 || q.UVO.length !== q.UV.length || q.PART.length !== b.src.length || q.S.length !== b.src.length || q.T.length !== b.tris.length)
      fail(`${id} on ${bname}: a part's arrays don't agree in length`);
    if (!q.P.every(Number.isFinite) || !q.N.every(Number.isFinite)) { fail(`${id} on ${bname}: points that aren't finite`); continue; }
    let inside = 0, far = 0; const G = g.outer[0].P, k = G.length / 3;
    for (let i = 0; i < k; i++) { const h = skin.closest(G[i * 3], G[i * 3 + 1], G[i * 3 + 2], 0.06, c); if (h && h.d < -0.002) inside++; }
    for (let i = 0; i < k; i++) { let d = Infinity; for (let a = 0; a < 3; a++) d = Math.min(d, Math.abs(G[i * 3 + a])); if (Math.hypot(G[i * 3], G[i * 3 + 1], G[i * 3 + 2]) > 3) far++; }
    if (inside > Math.max(4, 0.01 * k)) fail(`${id} on ${bname}: ${inside} of ${k} points more than 2 mm inside the skin`);
    if (far) fail(`${id} on ${bname}: ${far} points flew off`);
    if (g.cover.length !== P.length / 3 || g.cover.reduce((a, v) => a + v, 0) !== b.cover.length) fail(`${id} on ${bname}: the skin it hides isn't the bake's`);
  }
}
// 4. layers: a top worn over a skirt (and a dress over underwear) is set outside it where they lie together
{
  const pairs = [["elvs_pleated_plaid_mini_skirt", "punkduck_spaghetti_strap_tank_top", "skirts", "shirts"], ["punkduck_sport_briefs", "mindfront_f_dress_02", "underwear", "dress"]].filter(p => all.includes(p[0]) && all.includes(p[1]));
  if (layerOf("skirts", "x") >= layerOf("shirts", "x") || layerOf("underwear", "a_stocking") <= layerOf("underwear", "a_bra") || layerOf("shoes", "x") >= layerOf("pants", "x") || !rigid("shoes") || rigid("dress")) fail("the layers' order by group and name isn't the rule's");
  const P = Float32Array.from(mhrBody(m, bodyWeights("feminine"), 1.62, bodySculpt("feminine")).P), W = new Wearer(base, P, T);
  for (const [lo, up] of pairs) {
    const L = W.wear(bake(lo), lo), plain = W.wear(bake(up), up), layered = W.wear(bake(up), up, "#ffffff", { under: L.outer });
    const before = W.crossings(plain.outer[0].P, L.outer), after = W.crossings(layered.outer[0].P, L.outer);
    let most = 0; for (let i = 0; i < plain.outer[0].P.length; i += 3) most = Math.max(most, Math.hypot(layered.outer[0].P[i] - plain.outer[0].P[i], layered.outer[0].P[i + 1] - plain.outer[0].P[i + 1], layered.outer[0].P[i + 2] - plain.outer[0].P[i + 2]));
    if (after > Math.max(3, 0.1 * before)) fail(`${up} over ${lo}: ${after} of its points still under it (${before} before the layers)`);
    if (most > 0.05) fail(`${up} over ${lo}: a point moved ${(most * 1000).toFixed(0)} mm`);
    const stiff = W.wear(bake(up), up, "#ffffff", { rigid: true }).outer[0].P;
    if (!W.wear(bake(up), up, "#ffffff", { under: L.outer, rigid: true }).outer[0].P.every((v, i) => v === stiff[i])) fail("a rigid garment was moved by what's under it");
    // the two worn as an outfit: the lower one pressed in where it still stood through the upper's triangles
    const [L2, U2] = W.dress([{ bake: bake(lo), name: lo, layer: 30 }, { bake: bake(up), name: up, layer: 40 }]);
    const mid0 = W.crossings(layered.outer[0].P, L.outer, layered.outer[0].T), mid1 = W.crossings(U2.outer[0].P, L2.outer, U2.outer[0].T);
    if (mid1 > Math.max(3, 0.25 * mid0)) fail(`${up} over ${lo} as an outfit: ${mid1} of its points and triangles still under it (${mid0} with the upper lifted alone)`);
    const skin = new Surface(P, T, null, 0.012), c = {}; let inside = 0; const GL = L2.outer[0].P;
    for (let i = 0; i < GL.length / 3; i++) { const h = skin.closest(GL[i * 3], GL[i * 3 + 1], GL[i * 3 + 2], 0.06, c); if (h && h.d < 0.0005) inside++; }
    if (inside > Math.max(4, 0.01 * GL.length / 3)) fail(`${lo} under ${up}: pressed into the skin at ${inside} points`);
    if (!L2.parts[0].P.every(Number.isFinite)) fail(`${lo} under ${up}: points that aren't finite`);
    layerNote.push(`${up} over ${lo}: ${before} points under it, ${after} after; with its triangles ${mid0}, ${mid1} once the lower is pressed in`);
  }
}
// 5. gravity, what's covered, what's left out (DECISIONS 2026-11-11, the last)
{
  const H = 1.62, P = Float32Array.from(mhrBody(m, bodyWeights("feminine"), H, bodySculpt("feminine")).P), W = new Wearer(base, P, T), id = "mindfront_f_dress_02";
  if (all.includes(id)) {
    const flat = W.wear(bake(id), id, "#fff", { gravity: 0 }), light = W.wear(bake(id), id), A = flat.outer[0].P, B = light.outer[0].P, Tw = flat.outer[0].T;
    let most = 0, down = 0, k = 0; for (let i = 0; i < A.length; i += 3) { const d = Math.hypot(B[i] - A[i], B[i + 1] - A[i + 1], B[i + 2] - A[i + 2]); most = Math.max(most, d); if (d > 0.001) { down += B[i + 1] - A[i + 1]; k++; } }
    if (!(light.stats.fell > 50) || flat.stats.fell !== 0) fail(`gravity: ${light.stats.fell} points of the dress fell with it on, ${flat.stats.fell} with it off`);
    if (most > 0.0501) fail(`gravity: a point moved ${(most * 1000).toFixed(0)} mm`);
    if (!(down / Math.max(k, 1) < 0)) fail("gravity: the cloth that moved didn't go down on the whole");
    let stretch = 0; for (let t = 0; t < Tw.length; t += 3) for (let e = 0; e < 3; e++) { const a = Tw[t + e] * 3, b = Tw[t + (e + 1) % 3] * 3, l0 = Math.hypot(A[a] - A[b], A[a + 1] - A[b + 1], A[a + 2] - A[b + 2]), l1 = Math.hypot(B[a] - B[b], B[a + 1] - B[b + 1], B[a + 2] - B[b + 2]); if (l0 > 0.004) stretch = Math.max(stretch, l1 / l0); }
    if (stretch > 1.3) fail(`gravity: a thread stretched to ${stretch.toFixed(2)} of its length`);
    const heavy = W.wear(bake(id), id, "#fff", { gravity: 1 }); if (!(heavy.stats.fell >= light.stats.fell)) fail("gravity: heavier moved less cloth than light");
    // the skin the dress hides here: the belly and hips under it, not the head, the hands or the feet
    const [g] = W.dress([{ bake: bake(id), name: id, layer: 40 }]), cv = g.cover; let n = 0, wrong = 0, belly = 0, bellyAll = 0;
    for (let i = 0; i < cv.length; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; if (cv[i]) { n++; if (y > 0.88 * H || y < 0.25 * H || Math.abs(x) > 0.3) wrong++; } if (y > 0.56 * H && y < 0.66 * H && Math.abs(x) < 0.1) { bellyAll++; if (cv[i]) belly++; } }
    if (!(n > 1500) || wrong) fail(`the dress hides ${n} skin points, ${wrong} of them on the head, the lower legs or the arms`);
    if (!(belly > 0.9 * bellyAll)) fail(`the dress hides ${belly} of the ${bellyAll} skin points round the waist`);
    layerNote.push(`the dress: ${light.stats.fell} points fall, ${n} skin points hidden`);
  }
  const shoe = "toigo_ballet_flats", sock = "toigo_lace_frill_socks";
  if (all.includes(shoe) && all.includes(sock)) {
    const [so, sh] = W.dress([{ bake: bake(sock), name: sock, layer: 15 }, { bake: bake(shoe), name: shoe, layer: 20, rigid: true }]);
    let toes = 0, toesAll = 0; for (let i = 0; i < sh.cover.length; i++) if (P[i * 3 + 1] < 0.03 && P[i * 3 + 2] > 0.08) { toesAll++; if (sh.cover[i] || so.cover[i]) toes++; }
    if (!(toes > 0.9 * toesAll)) fail(`a shoe over a sock hides ${toes} of the ${toesAll} skin points of the toes`);
    if (!(so.stats.trimmed > 0) || so.parts[0].T.length + so.stats.trimmed * 3 !== bake(sock).tris.length) fail(`the sock inside the shoe: ${so.stats.trimmed} of its triangles left out`);
    const [so2] = W.dress([{ bake: bake(sock), name: sock, layer: 15 }, { bake: bake(shoe), name: shoe, layer: 20, rigid: true, opaque: false }]);
    if (so2.stats.trimmed) fail("a sock under a see-through shoe lost triangles");
    layerNote.push(`a sock in a shoe: ${so.stats.trimmed} triangles left out, ${toes} of ${toesAll} toe points hidden`);
  }
}
for (const f of faults) console.log("LIBRARY FAIL:", f);
if (!faults.length) console.log(`LIBRARY ok (${want.length} garments of ${all.length} baked, on ${bodies.length} bodies: ${n} fits, the slowest ${slowest} ms; ${layerNote.join("; ")})`);
process.exit(faults.length ? 1 : 0);

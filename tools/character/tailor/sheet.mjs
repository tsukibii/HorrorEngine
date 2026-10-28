// A contact sheet of the tailor's clothes on a body, rendered with three.js in headless Chromium (Playwright):
// front, three-quarter, side and back, full length and close, so a garment is reviewed by looking, not by guessing.
//
//   node tools/character/tailor/sheet.mjs --outfit "work uniform" [--body average|feminine|masculine|slim_ or full_feminine|slim_ or full_masculine] [--height 1.62]
//        [--designs t-shirt,pants] [--out sheet.png] [--size 360] [--close | --chest | --legs | --feet] [--uv | --debug] [--look JSON]
//        [--pbr pants=pbr/Fabric/denim1[:0.3][,design=ref...]]   a PBR set off the shelf on a garment (its repeat in metres; + tints it)
//        [--drape [JSON]]   hung by gravity (tailor/drape.js); JSON: {design: {drape settings}} over the designs' own
//        [--edit JSON]      a garment's own edits, as the Studio keeps them: {"t-shirt": {"fit": 0}} (skin tight)
//        [--sculpt JSON]    the body's sculpt over its base's (sculpt.js's body controls): {"belly": -0.5}
//
// Needs Playwright (npm i playwright, or PLAYWRIGHT=<path to its package>).
import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";
import { join } from "path";
import { createRequire } from "module";
import { loadMhr, mhrBody, bodyWeights, bodySculpt, ROOT } from "./node.mjs";
import * as TAILOR from "../tailor.js";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1] ?? true; };
const has = k => process.argv.includes("--" + k);
const CLOTHES = process.env.TAILOR_CLOTHES || join(ROOT, "Content", "Studio", "Clothes");   // TAILOR_CLOTHES: a folder of designs and outfits being tried
const designs = JSON.parse(readFileSync(join(CLOTHES, "designs.json"))).designs;
const outfits = JSON.parse(readFileSync(join(CLOTHES, "outfits.json"))).outfits;
const bodyName = arg("body", "feminine"), H = parseFloat(arg("height", /masculine/.test(bodyName) ? 1.76 : /feminine/.test(bodyName) ? 1.62 : 1.7));
const extra = arg("look") ? JSON.parse(arg("look")) : null;               // --look '{"print": {...}}': on every garment, for a test
const list0 = arg("designs") ? String(arg("designs")).split(",").map(d => [d]) : outfits[arg("outfit", "work uniform")];
// --pbr: a garment's set off the shelf (Content/Studio/PBR, docs/ASSETS.md §6), as the Studio's pbrOf gives it to tailor/look.js
const SHELF = process.env.STUDIO_PBR || join(ROOT, "Content", "Studio", "PBR");
const pbrSet = spec => {
  const [ref, opt = ""] = spec.split(":"), rel = ref.replace(/^pbr\//, ""), f = join(SHELF, ...rel.split("/"), "meta.json");
  if (!existsSync(f)) spawnSync("python3", [join(ROOT, "tools", "pbr.py")], { stdio: "ignore" });   // the shelf scanned: each set's meta.json
  if (!existsSync(f)) { console.error(`no PBR set ${ref} on the shelf (${SHELF})`); process.exit(1); }
  const m = JSON.parse(readFileSync(f));
  return { ref, base: "/pbrfile/" + rel.split("/").map(encodeURIComponent).join("/"), maps: m.maps, normal: m.normal, orm: m.orm,
           tile_m: parseFloat(opt) || (m.tile_m && m.tile_m !== 2 ? m.tile_m : 0.3), tint: opt.endsWith("+") };
};
const pbrs = Object.fromEntries((arg("pbr") ? String(arg("pbr")).split(",") : []).map(s => { const [d, r] = s.split("="); return [d, pbrSet(r)]; }));
const edits = arg("edit") ? JSON.parse(arg("edit")) : {};
const list = list0 && list0.map(([d, c, l, e]) => [d, c, extra || pbrs[d] ? { ...(l || {}), ...(extra || {}), ...(pbrs[d] ? { pbr: pbrs[d] } : {}) } : l, edits[d] || e]);   // an outfit's own edit (a fit) unless --edit gives one
if (!list) { console.error("no such outfit"); process.exit(1); }
const out = arg("out", "tailor_sheet.png"), size = parseInt(arg("size", 360));

const b = mhrBody(loadMhr(), bodyWeights(bodyName), H, arg("sculpt") ? { ...bodySculpt(bodyName), ...JSON.parse(arg("sculpt")) } : bodySculpt(bodyName));
const dset = typeof arg("drape") === "string" && arg("drape").startsWith("{") ? JSON.parse(arg("drape")) : {};
for (const [d, o] of Object.entries(dset)) designs[d].piece.drape = { ...(designs[d].piece.drape || {}), ...o };
const t0 = Date.now(), B = TAILOR.body(b.P, b.T), worn = TAILOR.dress(B, list, designs, { drape: has("drape") });
const stats = worn.map(g => `${g.name} ${g.stats.triangles} tris ${g.stats.ms} ms` + (g.drape ? ` (drape ${g.drape.ms} ms, ${g.drape.steps} steps, fell ${(g.drape.fell * 100).toFixed(1)} cm)` : ""));
console.log(`made in ${Date.now() - t0} ms: ${stats.join(", ")}`);

// everything as one binary: [body, part, part...], each {color, P (f32), T (u32)}
const HUES = ["#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe"];
const parts = worn.flatMap(g => g.parts).map((q, i) => has("debug") && /_/.test(q.name) ? { ...q, color: HUES[i % HUES.length] } : q);   // --debug: each detail its own colour
const KEYS = [["P", Float32Array], ["T", Uint32Array], ["N", Float32Array], ["UV", Float32Array], ["PART", Float32Array], ["S", Float32Array]];
const lookOf = new Map(worn.flatMap(g => g.parts.map(q => [q.name, g.look])));
const head = parts.map(q => ({ name: q.name, color: q.color, fabric: q.fabric, surface: q.surface, look: lookOf.get(q.name), n: Object.fromEntries(KEYS.map(([k]) => [k, q[k].length])) }));
const bin = Buffer.concat([Buffer.from(new Float32Array(b.P).buffer), Buffer.from(new Uint32Array(b.T).buffer), ...parts.flatMap(q => KEYS.map(([k, A]) => Buffer.from(new A(q[k]).buffer)))]);
const views = has("feet")
  ? [["front", 0, 0.1, 0.42, 0], ["3/4", 35, 0.07, 0.3, 0.19], ["side", 90, 0.07, 0.3, 0.19], ["back", 180, 0.08, 0.3, 0.19], ["inside", 290, 0.07, 0.3, 0.19]]
  : has("legs")
  ? [["front", 0, 0.45, 0.42], ["3/4", 40, 0.45, 0.42], ["side", 90, 0.45, 0.42], ["back", 180, 0.45, 0.42], ["feet", 25, 0.12, 0.3]]
  : has("chest")
  ? [["front", 0, 1.3, 0.5], ["3/4", 45, 1.3, 0.5], ["side", 90, 1.3, 0.5], ["back", 180, 1.3, 0.5], ["low", 20, 0.85, 0.6]]
  : has("close")
  ? [["front", 0, 1.15, 1.25], ["3/4", 40, 1.15, 1.25], ["side", 90, 1.15, 1.25], ["back", 180, 1.15, 1.25], ["3/4 back", 220, 1.15, 1.25], ["legs", 30, 0.55, 1.35]]
  : [["front", 0, 0.88, 2.2], ["3/4", 40, 0.88, 2.2], ["side", 90, 0.88, 2.2], ["back", 180, 0.88, 2.2], ["3/4 back", 220, 0.88, 2.2]];
const page = `<!doctype html><html><head><style>body{margin:0;background:#20232a}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three.js"}}</script></head><body>
<script type="module">
import * as THREE from "three";
import * as LOOK from "/tailor/look.js";
const head = ${JSON.stringify(head)}, views = ${JSON.stringify(views)}, S = ${size}, H = ${H}, NB = [${b.P.length}, ${b.T.length}], LOOKS = ${JSON.stringify(has("uv") ? { debug: "uv" } : {})};
const buf = await (await fetch("/data.bin")).arrayBuffer();
const W = S * views.length, R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
R.setSize(W, Math.round(S * 1.5)); document.body.appendChild(R.domElement); R.setScissorTest(true);
const scene = new THREE.Scene(); scene.background = new THREE.Color("#2a2d34");
scene.add(new THREE.HemisphereLight("#dfe6f0", "#3a3530", 1.3));
const key = new THREE.DirectionalLight("#fff4e8", 2.2); key.position.set(1.5, 3, 2.5); scene.add(key);
const rim = new THREE.DirectionalLight("#bcd0ff", 1.0); rim.position.set(-2, 2, -2.5); scene.add(rim);
let o = 0;
const take = (A, n) => { const a = new A(buf, o, n); o += n * 4; return a; };
const body = new THREE.BufferGeometry(); body.setAttribute("position", new THREE.BufferAttribute(take(Float32Array, NB[0]), 3)); body.setIndex(new THREE.BufferAttribute(take(Uint32Array, NB[1]), 1)); body.computeVertexNormals();
scene.add(new THREE.Mesh(body, new THREE.MeshStandardMaterial({ color: "#c8a28c", roughness: 0.6 })));
for (const m of head) {
  const q = { name: m.name, color: m.color, fabric: m.fabric, surface: m.surface, P: take(Float32Array, m.n.P), T: take(Uint32Array, m.n.T), N: take(Float32Array, m.n.N), UV: take(Float32Array, m.n.UV), PART: take(Float32Array, m.n.PART), S: take(Float32Array, m.n.S) };
  scene.add(LOOK.mesh(q, m.name, LOOKS.debug ? LOOKS : m.look));
}
await LOOK.mapsLoaded();                                          // a PBR set's maps
const cam = new THREE.PerspectiveCamera(28, 1 / 1.5, 0.05, 20);
views.forEach(([name, deg, ty, dist, tx = 0], i) => {
  const a = deg * Math.PI / 180, k = H / 1.726;
  cam.position.set(tx * k + Math.sin(a) * dist * 2.2 * k, ty * k + 0.1 * dist / 0.5, Math.cos(a) * dist * 2.2 * k); cam.lookAt(tx * k, ty * k, 0);
  R.setViewport(i * S, 0, S, Math.round(S * 1.5)); R.setScissor(i * S, 0, S, Math.round(S * 1.5)); R.render(scene, cam);
});
window.done = true;
</script></body></html>`;
const three = readFileSync(join(ROOT, "tools", "director", "vendor", "three.module.min.js"));
const server = createServer((q, r) => {
  if (q.url === "/") { r.writeHead(200, { "content-type": "text/html" }); return r.end(page); }
  if (q.url === "/three.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(three); }
  if (/^\/tailor\/[a-z]+\.js$/.test(q.url)) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(readFileSync(join(ROOT, "tools", "character", q.url))); }
  if (q.url === "/data.bin") { r.writeHead(200, { "content-type": "application/octet-stream" }); return r.end(bin); }
  if (q.url.startsWith("/pbrfile/")) {                               // a PBR set's map, off the shelf
    const rel = decodeURIComponent(q.url.slice(9)).split("/"), f = join(SHELF, ...rel);
    if (!rel.includes("..") && /\.(png|jpe?g)$/i.test(f) && existsSync(f)) { r.writeHead(200, { "content-type": /png$/i.test(f) ? "image/png" : "image/jpeg" }); return r.end(readFileSync(f)); }
  }
  r.writeHead(404); r.end();
}).listen(0, "127.0.0.1");
await new Promise(r => server.once("listening", r));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const browser = await require("../../browser.cjs").launch(chromium);
const pg = await (await browser.newContext({ viewport: { width: size * views.length, height: Math.round(size * 1.5) } })).newPage();
const errs = []; pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
await pg.goto(`http://127.0.0.1:${server.address().port}/`);
await pg.waitForFunction(() => window.done, null, { timeout: 120000 }).catch(e => errs.push(e.message));
await pg.screenshot({ path: out });
await browser.close(); server.close();
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
writeFileSync(out.replace(/\.png$/, ".txt"), stats.join("\n") + "\n");
console.log(`SHEET ${out}`);

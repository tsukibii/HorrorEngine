// A contact sheet of the tailor's clothes on a body, rendered with three.js in headless Chromium (Playwright):
// front, three-quarter, side and back, full length and close, so a garment is reviewed by looking, not by guessing.
//
//   node tools/character/tailor/sheet.mjs --outfit "work uniform" [--body average|feminine|masculine] [--height 1.62]
//        [--designs t-shirt,pants] [--out sheet.png] [--size 360] [--close]
//
// Needs Playwright (npm i playwright, or PLAYWRIGHT=<path to its package>).
import { createServer } from "http";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createRequire } from "module";
import { loadMhr, mhrBody, ROOT } from "./node.mjs";
import * as TAILOR from "../tailor.js";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1] ?? true; };
const has = k => process.argv.includes("--" + k);
const CLOTHES = join(ROOT, "Content", "Studio", "Clothes");
const designs = JSON.parse(readFileSync(join(CLOTHES, "designs.json"))).designs;
const outfits = JSON.parse(readFileSync(join(CLOTHES, "outfits.json"))).outfits;
const presets = JSON.parse(readFileSync(join(ROOT, "Content", "Studio", "Bodies", "MHR_presets.json"))).presets;
const bodyName = arg("body", "feminine"), H = parseFloat(arg("height", bodyName === "masculine" ? 1.76 : bodyName === "feminine" ? 1.62 : 1.7));
const list = arg("designs") ? String(arg("designs")).split(",").map(d => [d]) : outfits[arg("outfit", "work uniform")];
if (!list) { console.error("no such outfit"); process.exit(1); }
const out = arg("out", "tailor_sheet.png"), size = parseInt(arg("size", 360));

const b = mhrBody(loadMhr(), presets[bodyName] || [], H);
const t0 = Date.now(), B = TAILOR.body(b.P, b.T), worn = TAILOR.dress(B, list, designs);
const stats = worn.map(g => `${g.name} ${g.stats.triangles} tris ${g.stats.ms} ms`);
console.log(`made in ${Date.now() - t0} ms: ${stats.join(", ")}`);

// everything as one binary: [body, part, part...], each {color, P (f32), T (u32)}
const meshes = [{ color: "#c8a28c", P: b.P, T: b.T, skin: true }, ...worn.flatMap(g => g.parts)];
const head = meshes.map(m => ({ color: m.color, skin: !!m.skin, np: m.P.length, nt: m.T.length }));
const bin = Buffer.concat(meshes.flatMap(m => [Buffer.from(new Float32Array(m.P).buffer), Buffer.from(new Uint32Array(m.T).buffer)]));
const views = has("chest")
  ? [["front", 0, 1.3, 0.5], ["3/4", 45, 1.3, 0.5], ["side", 90, 1.3, 0.5], ["back", 180, 1.3, 0.5], ["low", 20, 0.85, 0.6]]
  : has("close")
  ? [["front", 0, 1.15, 1.25], ["3/4", 40, 1.15, 1.25], ["side", 90, 1.15, 1.25], ["back", 180, 1.15, 1.25], ["3/4 back", 220, 1.15, 1.25], ["legs", 30, 0.55, 1.35]]
  : [["front", 0, 0.88, 2.2], ["3/4", 40, 0.88, 2.2], ["side", 90, 0.88, 2.2], ["back", 180, 0.88, 2.2], ["3/4 back", 220, 0.88, 2.2]];
const page = `<!doctype html><html><head><style>body{margin:0;background:#20232a}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three.js"}}</script></head><body>
<script type="module">
import * as THREE from "three";
const head = ${JSON.stringify(head)}, views = ${JSON.stringify(views)}, S = ${size}, H = ${H};
const buf = await (await fetch("/data.bin")).arrayBuffer();
const W = S * views.length, R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
R.setSize(W, Math.round(S * 1.5)); document.body.appendChild(R.domElement); R.setScissorTest(true);
const scene = new THREE.Scene(); scene.background = new THREE.Color("#2a2d34");
scene.add(new THREE.HemisphereLight("#dfe6f0", "#3a3530", 1.3));
const key = new THREE.DirectionalLight("#fff4e8", 2.2); key.position.set(1.5, 3, 2.5); scene.add(key);
const rim = new THREE.DirectionalLight("#bcd0ff", 1.0); rim.position.set(-2, 2, -2.5); scene.add(rim);
let o = 0;
for (const m of head) {
  const P = new Float32Array(buf, o, m.np); o += m.np * 4; const T = new Uint32Array(buf, o, m.nt); o += m.nt * 4;
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(P, 3)); g.setIndex(new THREE.BufferAttribute(T, 1)); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: m.color, roughness: m.skin ? 0.6 : 0.88, side: THREE.DoubleSide })));
}
const cam = new THREE.PerspectiveCamera(28, 1 / 1.5, 0.05, 20);
views.forEach(([name, deg, ty, dist], i) => {
  const a = deg * Math.PI / 180, k = H / 1.726;
  cam.position.set(Math.sin(a) * dist * 2.2 * k, ty * k + 0.1, Math.cos(a) * dist * 2.2 * k); cam.lookAt(0, ty * k, 0);
  R.setViewport(i * S, 0, S, Math.round(S * 1.5)); R.setScissor(i * S, 0, S, Math.round(S * 1.5)); R.render(scene, cam);
});
window.done = true;
</script></body></html>`;
const three = readFileSync(join(ROOT, "tools", "director", "vendor", "three.module.min.js"));
const server = createServer((q, r) => {
  if (q.url === "/") { r.writeHead(200, { "content-type": "text/html" }); return r.end(page); }
  if (q.url === "/three.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(three); }
  if (q.url === "/data.bin") { r.writeHead(200, { "content-type": "application/octet-stream" }); return r.end(bin); }
  r.writeHead(404); r.end();
}).listen(0, "127.0.0.1");
await new Promise(r => server.once("listening", r));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const pg = await (await browser.newContext({ viewport: { width: size * views.length, height: Math.round(size * 1.5) } })).newPage();
const errs = []; pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
await pg.goto(`http://127.0.0.1:${server.address().port}/`);
await pg.waitForFunction(() => window.done, null, { timeout: 120000 }).catch(e => errs.push(e.message));
await pg.screenshot({ path: out });
await browser.close(); server.close();
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
writeFileSync(out.replace(/\.png$/, ".txt"), stats.join("\n") + "\n");
console.log(`SHEET ${out}`);

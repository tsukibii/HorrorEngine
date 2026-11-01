// Thumbnails for the Studio's outfit picker (and its garment picker): every outfit in Content/Studio/Clothes/outfits.json
// worn by the default model (a new character: the body halfway between the feminine and masculine bases, 1.70 m, as the
// Character Studio starts it), hung by gravity, pictured from the front and a little to the side, into
// Content/Studio/Clothes/thumbs/<slug>.jpg (the slug: the name in lower case, anything but letters and digits an
// underscore; a JPEG, a tenth of a PNG's size, ~15 KB); every design alone, as cut, into thumbs/design_<name>.jpg. The page shows them as cards; a card without
// its picture shows its name alone, so run this after adding or changing an outfit (DECISIONS 2026-10-27).
//
//   node tools/character/tailor/thumbs.mjs [--only "name,name"] [--designs] [--outfits] [--body default|feminine|masculine|average]
//        [--no-drape] [--size 240] [--out DIR]
//
// Needs Playwright (npm i playwright, or PLAYWRIGHT=<path to its package>).
import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { createRequire } from "module";
import { loadMhr, mhrBody, bodyWeights, bodySculpt, ROOT } from "./node.mjs";
import * as TAILOR from "../tailor.js";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1] ?? true; };
const has = k => process.argv.includes("--" + k);
const CLOTHES = process.env.TAILOR_CLOTHES || join(ROOT, "Content", "Studio", "Clothes");
const designs = JSON.parse(readFileSync(join(CLOTHES, "designs.json"))).designs;
const outfits = JSON.parse(readFileSync(join(CLOTHES, "outfits.json"))).outfits;
const OUT = arg("out", join(CLOTHES, "thumbs")), size = parseInt(arg("size", 240)), drape = !has("no-drape");
const only = arg("only") ? String(arg("only")).split(",").map(s => s.trim()) : null;
const both = !has("designs") && !has("outfits");
export const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** the default model's body: halfway between the bases (the body sliders), MHR's own head and hands, the sculpt the
    feminine base carries at half strength, 1.70 m: what the Studio's `weights()` and `baseSculpt` give a new character */
function defaultBody(m) {
  const pre = JSON.parse(readFileSync(join(ROOT, "Content", "Studio", "Bodies", "MHR_presets.json")));
  const groups = (() => { const buf = readFileSync(join(ROOT, "Content", "Studio", "Bodies", "MHR_lod1.bin")); const hl = buf.readUInt32LE(0); return JSON.parse(buf.subarray(4, 4 + hl).toString()).groups; })();
  const [a, b] = groups.body, f = pre.presets.feminine, mm = pre.presets.masculine, w = [];
  for (let i = 0; i < m.k; i++) w.push(i >= a && i < b ? ((f[i] || 0) + (mm[i] || 0)) / 2 : 0);
  const sc = {}; for (const [k, v] of Object.entries(pre.sculpt?.feminine || {})) sc[k] = v / 2;
  return mhrBody(m, w, 1.7, sc);
}
const m = loadMhr(), bodyName = arg("body", "default");
const b = bodyName === "default" ? defaultBody(m) : mhrBody(m, bodyWeights(bodyName), parseFloat(arg("height", /masculine/.test(bodyName) ? 1.76 : /feminine/.test(bodyName) ? 1.62 : 1.7)), bodySculpt(bodyName));
const B = TAILOR.body(b.P, b.T), H = 1.7;
mkdirSync(OUT, { recursive: true });

// the jobs: each outfit (hung), each design alone (as cut)
const jobs = [];
if (both || has("outfits")) for (const [name, list] of Object.entries(outfits)) if (!only || only.includes(name)) jobs.push({ name, file: slug(name), list, drape });
if (both || has("designs")) for (const name of Object.keys(designs)) if (!only || only.includes(name)) jobs.push({ name, file: "design_" + slug(name), list: [[name]], drape: false, alone: true });
if (!jobs.length) { console.error("nothing to picture"); process.exit(1); }

const KEYS = [["P", Float32Array], ["T", Uint32Array], ["N", Float32Array], ["UV", Float32Array], ["PART", Float32Array], ["S", Float32Array], ["CRZ", Float32Array]];
const three = readFileSync(join(ROOT, "tools", "director", "vendor", "three.module.min.js"));
const SHELF = join(ROOT, "assets", "pbr");
let current = null;                                                // the job the page is showing: its parts as one binary
const page = () => `<!doctype html><html><head><style>body{margin:0;background:#20232a}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three.js"}}</script></head><body>
<script type="module">
import * as THREE from "three";
import * as LOOK from "/tailor/look.js";
const S = ${size}, W = S, Hh = Math.round(S * 1.5);
const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W, Hh); document.body.appendChild(R.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color("#2a2d34");
scene.add(new THREE.HemisphereLight("#dfe6f0", "#3a3530", 1.3));
const key = new THREE.DirectionalLight("#fff4e8", 2.2); key.position.set(1.5, 3, 2.5); scene.add(key);
const rim = new THREE.DirectionalLight("#bcd0ff", 1.0); rim.position.set(-2, 2, -2.5); scene.add(rim);
const cam = new THREE.PerspectiveCamera(26, W / Hh, 0.05, 20);
let shown = [];
window.show = async (head, NB, view) => {
  for (const o of shown) { scene.remove(o); o.geometry.dispose(); o.material.dispose?.(); } shown = [];
  const buf = await (await fetch("/data.bin?" + Math.random())).arrayBuffer(); let o = 0;
  const take = (A, n) => { const a = new A(buf, o, n); o += n * 4; return a; };
  const body = new THREE.BufferGeometry(); body.setAttribute("position", new THREE.BufferAttribute(take(Float32Array, NB[0]), 3)); body.setIndex(new THREE.BufferAttribute(take(Uint32Array, NB[1]), 1)); body.computeVertexNormals();
  const skin = new THREE.Mesh(body, new THREE.MeshStandardMaterial({ color: "#c8a28c", roughness: 0.6 })); scene.add(skin); shown.push(skin);
  for (const m of head) {
    const q = { name: m.name, color: m.color, fabric: m.fabric, surface: m.surface, P: take(Float32Array, m.n.P), T: take(Uint32Array, m.n.T), N: take(Float32Array, m.n.N), UV: take(Float32Array, m.n.UV), PART: take(Float32Array, m.n.PART), S: take(Float32Array, m.n.S), CRZ: m.n.CRZ ? take(Float32Array, m.n.CRZ) : undefined };
    const mesh = LOOK.mesh(q, m.name, m.look); scene.add(mesh); shown.push(mesh);
  }
  await LOOK.mapsLoaded();
  const [deg, c, dist] = view, a = deg * Math.PI / 180;                 // round the centre c, dist away, a little above
  cam.position.set(c[0] + Math.sin(a) * dist, c[1] + dist * 0.12, c[2] + Math.cos(a) * dist); cam.lookAt(c[0], c[1], c[2]);
  R.render(scene, cam); await new Promise(r => requestAnimationFrame(r)); R.render(scene, cam);
  return true;
};
window.ready = true;
</script></body></html>`;
const server = createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/") { r.writeHead(200, { "content-type": "text/html" }); return r.end(page()); }
  if (u === "/three.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(three); }
  if (/^\/tailor\/[a-z]+\.js$/.test(u)) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(readFileSync(join(ROOT, "tools", "character", u))); }
  if (u === "/data.bin" && current) { r.writeHead(200, { "content-type": "application/octet-stream" }); return r.end(current); }
  if (u.startsWith("/pbrfile/")) { const rel = decodeURIComponent(u.slice(9)).split("/"), f = join(SHELF, ...rel); if (!rel.includes("..") && /\.(png|jpe?g)$/i.test(f) && existsSync(f)) { r.writeHead(200, { "content-type": /png$/i.test(f) ? "image/png" : "image/jpeg" }); return r.end(readFileSync(f)); } }
  r.writeHead(404); r.end();
}).listen(0, "127.0.0.1");
await new Promise(r => server.once("listening", r));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const browser = await require("../../browser.cjs").launch(chromium);
const pg = await (await browser.newContext({ viewport: { width: size, height: Math.round(size * 1.5) } })).newPage();
const errs = []; pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
await pg.goto(`http://127.0.0.1:${server.address().port}/`);
await pg.waitForFunction(() => window.ready, null, { timeout: 60000 });

const t0 = Date.now();
for (const job of jobs) {
  const t = Date.now();
  let worn;
  try { worn = TAILOR.dress(B, job.list, designs, { drape: job.drape }); } catch (e) { console.error(`${job.name}: ${e.message}`); continue; }
  const parts = worn.flatMap(g => g.parts), lookOf = new Map(worn.flatMap(g => g.parts.map(q => [q.name, g.look])));
  const head = parts.map(q => ({ name: q.name, color: q.color, fabric: q.fabric, surface: q.surface, look: lookOf.get(q.name), n: Object.fromEntries(KEYS.map(([k]) => [k, q[k].length])) }));
  current = Buffer.concat([Buffer.from(new Float32Array(b.P).buffer), Buffer.from(new Uint32Array(b.T).buffer), ...parts.flatMap(q => KEYS.map(([k, A]) => Buffer.from(new A(q[k]).buffer)))]);
  // the view: the whole figure for an outfit; a design alone framed on where it is (its parts' heights)
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const q of parts) for (let i = 0; i < q.P.length; i++) { lo[i % 3] = Math.min(lo[i % 3], q.P[i]); hi[i % 3] = Math.max(hi[i % 3], q.P[i]); }
  const c = [0, 1, 2].map(k => (lo[k] + hi[k]) / 2), ext = Math.max(hi[1] - lo[1], (hi[0] - lo[0]) / 1.5);
  const view = job.alone ? [25, [c[0], c[1], c[2]], Math.max(0.7, ext * 2.5 + 0.3)] : [25, [0, H * 0.5, 0], H * 2.65];
  await pg.evaluate(([h, nb, v]) => window.show(h, nb, v), [head, [b.P.length, b.T.length], view]);
  await pg.screenshot({ path: join(OUT, job.file + ".jpg"), type: "jpeg", quality: 86 });
  console.log(`${job.name}: ${worn.map(g => g.name).join(", ")} (${Date.now() - t} ms)`);
}
await browser.close(); server.close();
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
console.log(`THUMBS ${jobs.length} pictures in ${OUT} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);

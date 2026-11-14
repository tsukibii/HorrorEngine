// The clothing fabric sets (tools/fabricpbr.py, pbr/fabric/) pictured as the Studio draws them (tailor/look.js): each
// set a row, a ball of cloth with folds in it, close up (a few centimetres of cloth: its yarns) and at a garment's
// distance in four dyes (undyed, a red, a navy, black), a sheer knit over skin. Headless Chromium (Playwright).
//
//   node tools/character/tailor/swatch.mjs [--sets WoolKnit001,Leather001] [--out sheet.jpg] [--size 300]
//        [--tints "#e9e4d8,#8a2432,#22304e,#19191b"] [--check]   (--check: FABRICSHEET, each picture measured)
import { createServer } from "http";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1] ?? true; };
const has = k => process.argv.includes("--" + k);
const DIR = join(ROOT, "pbr", "fabric"), want = arg("sets") ? String(arg("sets")).split(",") : null;
const sets = readdirSync(DIR).filter(f => existsSync(join(DIR, f, "meta.json"))).map(f => ({ folder: f, name: f.replace(/_\d+K-JPG$/, ""), meta: JSON.parse(readFileSync(join(DIR, f, "meta.json"))) }))
  .filter(s => s.meta.fabric && (!want || want.includes(s.name)));
if (want) sets.sort((a, b) => want.indexOf(a.name) - want.indexOf(b.name));
if (!sets.length) { console.error("no fabric sets in pbr/fabric: python tools/fabricpbr.py"); process.exit(1); }
const tints = String(arg("tints", "#e9e4d8,#8a2432,#22304e,#19191b")).split(","), S = parseInt(arg("size", 300));
const out = arg("out", join(ROOT, "Saved", "Story", "_look", "fabricpbr", "swatches.jpg"));
const cells = sets.flatMap((s, r) => [{ r, c: 0, set: r, tint: tints[0], close: true }, { r, c: 1, set: r, tint: tints[1], close: true }, ...tints.map((t, i) => ({ r, c: 2 + i, set: r, tint: t, close: false }))]);
const COLS = 2 + tints.length, CAP = 22;

const page = `<!doctype html><html><head><style>body{margin:0;background:#1b1d22;font:12px sans-serif;color:#dddad2}canvas{display:block}
.cap{position:absolute;left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style>
<script type="importmap">{"imports":{"three":"/three.js"}}</script></head><body>
<script type="module">
import * as THREE from "three";
import * as LOOK from "/tailor/look.js";
const sets = ${JSON.stringify(sets)}, cells = ${JSON.stringify(cells)}, S = ${S}, COLS = ${COLS}, CAP = ${CAP}, ROWS = sets.length;
const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
R.setSize(COLS * S, ROWS * (S + CAP)); document.body.appendChild(R.domElement); R.setScissorTest(true); R.setClearColor("#1b1d22");
R.toneMapping = THREE.AgXToneMapping; R.toneMappingExposure = 1.25;
// a ball of cloth, its radius in metres, folds running down it; the fabric's coordinates in metres round it
function ball(rad) {
  const g = new THREE.SphereGeometry(rad, 220, 160), P = g.attributes.position, U = g.attributes.uv, n = P.count, uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = Math.atan2(x, z), h = y / rad;
    const f = 1 + 0.035 * Math.sin(a * 5 + h * 2.2) * (0.4 + 0.6 * Math.cos(h * 1.3)) + 0.018 * Math.sin(a * 11 - h * 5) + 0.012 * Math.sin(h * 9 + a * 3);
    P.setXYZ(i, x * f, y * f, z * f); uv[i * 2] = U.getX(i) * 2 * Math.PI * rad; uv[i * 2 + 1] = U.getY(i) * Math.PI * rad;
  }
  g.computeVertexNormals();
  return { P: P.array, N: g.attributes.normal.array, UV: uv, T: new Uint32Array(g.index.array), PART: new Float32Array(n), S: new Float32Array(n).fill(1) };
}
const BALLS = new Map(), ballOf = rad => { const k = rad.toFixed(5); if (!BALLS.has(k)) BALLS.set(k, ball(rad)); return BALLS.get(k); };
// close up, about half a repeat across the picture (between 8 mm and 4.5 cm): a yarn a few pixels wide
const zoomOf = m => Math.min(0.045, Math.max(0.008, m.tile_m * 0.55)) / 0.038;
const lights = s => {
  s.add(new THREE.HemisphereLight("#dfe6f0", "#3a3530", 0.9));
  const key = new THREE.DirectionalLight("#fff4e8", 2.6); key.position.set(-1.6, 2.2, 2.2); s.add(key);
  const rim = new THREE.DirectionalLight("#bcd0ff", 1.6); rim.position.set(2.2, 1.2, -2.4); s.add(rim);
};
const scenes = cells.map(c => {
  const set = sets[c.set], m = set.meta, s = new THREE.Scene(); lights(s);
  const pbr = { ref: "pbr/fabric/" + set.folder, base: "/pbrfile/" + encodeURIComponent(set.folder), maps: m.maps, normal: m.normal, fabric: m.fabric, tile_m: m.tile_m, tint: true };
  const k = c.close ? zoomOf(m) : 1, q = { name: set.name, color: c.tint, ...ballOf(0.085 * k) };
  s.add(LOOK.mesh(q, set.name, { color: c.tint, pbr, denier: m.fabric.kind === "sheer" ? 0.3 : undefined }));
  if (m.fabric.kind === "sheer") {                                  // the skin under a sheer knit: the same ball, a hair smaller
    const b = ballOf(0.085 * k), g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(b.P, 3)); g.setAttribute("normal", new THREE.BufferAttribute(b.N, 3)); g.setIndex(new THREE.BufferAttribute(b.T, 1));
    const skin = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: "#c8a28c", roughness: 0.55 })); skin.scale.setScalar(0.994); s.add(skin);
  }
  s.userData.k = k;
  return s;
});
await LOOK.mapsLoaded();
const far = new THREE.PerspectiveCamera(24, 1, 0.01, 5); far.position.set(0, 0.03, 0.46); far.lookAt(0, 0, 0);
cells.forEach((c, i) => {
  const x = c.c * S, y = (ROWS - 1 - c.r) * (S + CAP) + CAP, k = scenes[i].userData.k;
  const near = new THREE.PerspectiveCamera(24, 1, 0.002 * k, 5); near.position.set(-0.035 * k, 0.03 * k, 0.155 * k); near.lookAt(-0.022 * k, 0.012 * k, 0.07 * k);
  R.setViewport(x, y, S, S); R.setScissor(x, y, S, S); R.render(scenes[i], c.close ? near : far);
});
sets.forEach((s, r) => { const d = document.createElement("div"); d.className = "cap"; d.style.top = (r * (S + CAP) + S + 3) + "px"; d.style.width = (COLS * S - 12) + "px";
  d.textContent = s.name + ": " + s.meta.label + " (" + (s.meta.tile_m * 100).toFixed(1) + " cm a repeat)"; document.body.appendChild(d); });
window.done = true;
</script></body></html>`;
const three = readFileSync(join(ROOT, "tools", "director", "vendor", "three.module.min.js"));
const server = createServer((q, r) => {
  if (q.url === "/") { r.writeHead(200, { "content-type": "text/html" }); return r.end(page); }
  if (q.url === "/three.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(three); }
  if (/^\/tailor\/[a-z]+\.js$/.test(q.url)) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(readFileSync(join(ROOT, "tools", "character", q.url))); }
  if (q.url.startsWith("/pbrfile/")) {
    const rel = decodeURIComponent(q.url.slice(9)).split("/"), f = join(DIR, ...rel);
    if (!rel.includes("..") && /\.(png|jpe?g)$/i.test(f) && existsSync(f)) { r.writeHead(200, { "content-type": /png$/i.test(f) ? "image/png" : "image/jpeg" }); return r.end(readFileSync(f)); }
  }
  r.writeHead(404); r.end();
}).listen(0, "127.0.0.1");
await new Promise(r => server.once("listening", r));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const browser = await require("../../browser.cjs").launch(chromium);
const pg = await (await browser.newContext({ viewport: { width: COLS * S, height: sets.length * (S + CAP) } })).newPage();
const errs = []; pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => { if (m.type() === "error" || /THREE\.WebGLProgram/.test(m.text())) errs.push(m.text()); });
await pg.goto(`http://127.0.0.1:${server.address().port}/`);
await pg.waitForFunction(() => window.done, null, { timeout: 300000 }).catch(e => errs.push(e.message));
mkdirSync(dirname(out), { recursive: true });
await pg.screenshot({ path: out, type: /\.png$/.test(out) ? "png" : "jpeg", ...( /\.png$/.test(out) ? {} : { quality: 92 }) });
await browser.close(); server.close();
if (errs.length) { console.error(errs.join("\n")); process.exit(1); }
console.log(`SWATCHES ${out} (${sets.length} sets)`);

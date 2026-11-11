// The fit test's pictures: each body wearing its fitted garments, four views a row, drawn by three.js in headless
// Chromium (the repo's own browser launcher).   node render.mjs <out dir of fit.py> <sheet.png> [size] [body,body...]
//   VIEWS=0,40,180 (the angles drawn), ZOOM=top|legs, GRID=<columns> (a catalogue), TIMEOUT=<ms>,
//   LOOKS='{"<garment name>": {"surface": "flannel", "pattern": "plaid", "colors": [...], "repeat": 0.12, "color": "#...",
//           "keep": 0..1, "decal": {"file": "<png>", "side": "back", "yf": 0.775, "w": 0.26}}}': our own fabric (the tailor's
//   fabric.js, laid by the second UV in metres) and a PNG decal on a library garment
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const dir = resolve(process.argv[2]), out = process.argv[3], size = parseInt(process.argv[4] || "420");
const index = JSON.parse(readFileSync(join(dir, "index.json")));
const only = process.argv[5] ? process.argv[5].split(",") : null;
const bodies = index.bodies.filter(b => !only || only.includes(b.name));
const PAGE = `<!doctype html><html><body style="margin:0;background:#1d1f23;color:#ddd;font:13px sans-serif">
<div id="rows"></div>
<script type="module">
import * as THREE from "/three.js";
const index = ${JSON.stringify({ bodies, garments: index.garments })}, S = ${size};
const GRID = ${JSON.stringify(process.env.GRID || "")}; if (GRID) document.getElementById("rows").style.cssText = "display:flex;flex-wrap:wrap";
const tl = new THREE.TextureLoader();
const tex = async (p, srgb) => { if (!p) return null; try { const t = await tl.loadAsync("/file?p=" + encodeURIComponent(p)); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; } catch (e) { return null; } };
const LOOKS = ${process.env.LOOKS || "{}"};                         // {garment name: {surface, pattern, colors, repeat, color, decal: {file, side, y, w}}}: our own fabric on a library garment
const FAB = await import("/tailor/fabric.js");
const rep = c => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
const mats = [], decals = [];
for (const g of index.garments) {
  const map = await tex(g.tex, true), normalMap = await tex(g.normal, false), look = LOOKS[g.name];
  if (!look) { mats.push(new THREE.MeshStandardMaterial({ map, normalMap, color: map ? 0xffffff : 0x8899aa, roughness: 0.82, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.4 })); decals.push(null); continue; }
  const detail = await tex(g.detail, false), grain = rep(FAB.surfaceTile(look.surface || "cotton"));
  const pat = look.pattern ? rep(FAB.patternTile(look.pattern, look.colors)) : null; if (pat) pat.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ color: look.color || "#ffffff", normalMap, roughness: look.rough ?? 0.85, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { grainMap: { value: grain }, patMap: { value: pat }, detailMap: { value: detail }, grainRep: { value: 1 / FAB.SURFACES[look.surface || "cotton"][1] }, patRep: { value: 1 / (look.repeat || 0.1) },
      hasPat: { value: pat ? 1 : 0 }, hasDetail: { value: detail ? (look.keep ?? 1) : 0 } });
    sh.vertexShader = "attribute vec2 aUvM; varying vec2 vUvM; varying vec2 vUv0;\\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\\n vUvM = aUvM; vUv0 = uv;");
    sh.fragmentShader = "uniform sampler2D grainMap, patMap, detailMap; uniform float grainRep, patRep, hasPat, hasDetail; varying vec2 vUvM; varying vec2 vUv0;\\n" +
      sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\\n" +
        "if (hasPat > 0.5) diffuseColor.rgb *= texture2D(patMap, vUvM * patRep).rgb;\\n" +
        "diffuseColor.rgb *= mix(vec3(1.0), texture2D(grainMap, vUvM * grainRep).rgb * 2.0, 0.8);\\n" +
        "if (hasDetail > 0.0) diffuseColor.rgb *= mix(vec3(1.0), texture2D(detailMap, vUv0).rgb * 2.0, hasDetail);");
  };
  mats.push(m);
  decals.push(look.decal ? { ...look.decal, tex: await tex(look.decal.file, true) } : null);
}
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(S, Math.round(S * 1.55)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const VIEWS = (${JSON.stringify(process.env.VIEWS || "0,38,90,180")}).split(",").map((a, i) => [i ? "v" + a : "front", parseFloat(a)]);
for (const b of index.bodies) {
  const buf = await (await fetch("/file?p=" + encodeURIComponent(${JSON.stringify(dir)} + "/" + b.file))).arrayBuffer();
  const hl = new Uint32Array(buf, 0, 1)[0], head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  let at = 4 + hl; const f32 = n => { const a = new Float32Array(buf, at, n); at += n * 4; return a; }, u32 = n => { const a = new Uint32Array(buf, at, n); at += n * 4; return a; };
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x24262b);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a40, 1.1));
  const key = new THREE.DirectionalLight(0xfff2e0, 2.4); key.position.set(-1.5, 2.6, 2.4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 1.2); rim.position.set(1.8, 2.0, -2.2); scene.add(rim);
  const group = new THREE.Group(); scene.add(group);
  const bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.BufferAttribute(f32(head.body.P), 3)); bg.setIndex(new THREE.BufferAttribute(u32(head.body.T), 1)); bg.computeVertexNormals(); bg.computeBoundingBox(); const bh = bg.boundingBox.max.y;
  group.add(new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: 0xc8a48c, roughness: 0.62 })));
  head.garments.forEach((g, i) => {
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(f32(g.P), 3)); geo.setAttribute("normal", new THREE.BufferAttribute(f32(g.N), 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(f32(g.UV), 2)); if (g.UV2) geo.setAttribute("aUvM", new THREE.BufferAttribute(f32(g.UV2), 2)); geo.setIndex(new THREE.BufferAttribute(u32(g.T), 1));
    group.add(new THREE.Mesh(geo, mats[g.m ?? i]));
    const dc = decals[g.m ?? i];
    if (dc && dc.tex) {                                               // a PNG decal: projected straight onto the garment from behind or in front, drawn as the triangles it covers
      const P = geo.attributes.position.array, N = geo.attributes.normal.array, T = geo.index.array, sg = dc.side === "back" ? -1 : 1, n = P.length / 3;
      let cx = 0; for (let k = 0; k < n; k++) cx += P[k * 3]; cx /= n;
      const w = dc.w || 0.26, hh = w * dc.tex.image.height / dc.tex.image.width, cy = dc.yf ? dc.yf * bh : (dc.y ?? 1.3), uv = new Float32Array(n * 2), idx = [];
      for (let k = 0; k < n; k++) { uv[k * 2] = sg * (P[k * 3] - cx) / w + 0.5; uv[k * 2 + 1] = (P[k * 3 + 1] - cy) / hh + 0.5; }
      for (let t = 0; t < T.length; t += 3) {
        const [a, b, c] = [T[t], T[t + 1], T[t + 2]];
        const inside = [a, b, c].some(v => uv[v * 2] > 0 && uv[v * 2] < 1 && uv[v * 2 + 1] > 0 && uv[v * 2 + 1] < 1), facing = [a, b, c].every(v => N[v * 3 + 2] * sg > 0.35);
        if (inside && facing) idx.push(a, b, c);
      }
      const dg = new THREE.BufferGeometry(); dg.setAttribute("position", geo.attributes.position); dg.setAttribute("normal", geo.attributes.normal); dg.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); dg.setIndex(idx);
      dc.tex.wrapS = dc.tex.wrapT = THREE.ClampToEdgeWrapping;
      const dm = new THREE.MeshStandardMaterial({ map: dc.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: 0.7, side: THREE.DoubleSide });
      dm.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\\n if (vMapUv.x < 0.0 || vMapUv.x > 1.0 || vMapUv.y < 0.0 || vMapUv.y > 1.0) discard;"); };
      group.add(new THREE.Mesh(dg, dm));
    }
  });
  const box = new THREE.Box3().setFromObject(group), h = box.max.y;
  const row = document.createElement("div"); row.style.cssText = "display:flex;align-items:flex-end;margin:0 0 2px 0"; document.getElementById("rows").appendChild(row);
  const zoom = ${JSON.stringify(process.env.ZOOM || "")};
  for (const [name, az] of VIEWS) {
    const half = zoom === "top" ? 0.52 : zoom === "legs" ? 0.6 : 1.0, cy = zoom === "top" ? h * 0.76 : zoom === "legs" ? h * 0.3 : h * 0.5;
    const cam = new THREE.OrthographicCamera(-half * S / (S * 1.55) * 1.0, half * S / (S * 1.55), half, -half, 0.1, 20);
    const a = az * Math.PI / 180; cam.position.set(Math.sin(a) * 5, cy, Math.cos(a) * 5); cam.lookAt(0, cy, 0); cam.updateProjectionMatrix();
    renderer.render(scene, cam);
    const im = new Image(); im.src = renderer.domElement.toDataURL("image/png"); await im.decode();
    const cell = document.createElement("div"); cell.style.cssText = "position:relative;margin-right:2px"; cell.appendChild(im);
    if (name === "front") { const t = document.createElement("div"); t.textContent = b.name; t.style.cssText = "position:absolute;left:6px;top:4px;font-weight:bold"; cell.appendChild(t); }
    row.appendChild(cell);
  }
}
window.DONE = true;
</script></body></html>`;
// what the page may read: the fit's own folder, the garments' textures (their folders are in index.json), the studio's prints
const ROOTS = [dir, join(REPO, "Content/Studio/Clothes/prints"), ...index.garments.flatMap(g => [g.tex, g.normal]).filter(Boolean).map(f => dirname(resolve(f)))];
const server = createServer((q, r) => {
  const u = new URL(q.url, "http://x");
  if (u.pathname === "/") { r.writeHead(200, { "content-type": "text/html" }); return r.end(PAGE); }
  if (u.pathname === "/three.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(readFileSync(join(REPO, "tools/director/vendor/three.module.min.js"))); }
  if (u.pathname === "/tailor/fabric.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(readFileSync(join(REPO, "tools/character/tailor/fabric.js"))); }
  if (u.pathname === "/file") {
    const p = resolve(u.searchParams.get("p") || "");
    if (!ROOTS.some(root => p.startsWith(root)) || !existsSync(p)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { "content-type": p.endsWith(".png") ? "image/png" : p.endsWith(".jpg") ? "image/jpeg" : "application/octet-stream" }); return r.end(readFileSync(p));
  }
  r.writeHead(404); r.end();
}).listen(0, "127.0.0.1");
await new Promise(r => server.once("listening", r));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const browser = await require(join(REPO, "tools/browser.cjs")).launch(chromium);
const nv = (process.env.VIEWS || "0,38,90,180").split(",").length, cols = parseInt(process.env.GRID || "0");
const pg = await browser.newPage({ viewport: cols ? { width: (size * nv + 2) * cols + 4, height: Math.round(size * 1.55 + 2) * Math.ceil(bodies.length / cols) + 4 } : { width: size * nv + 8, height: Math.round(size * 1.55) * bodies.length + 4 } });
pg.on("console", m => { if (m.type() === "error" || m.type() === "warning") console.log("page:", m.text().slice(0, 600)); }); pg.on("pageerror", e => console.log("page error:", e.message));
await pg.goto(`http://127.0.0.1:${server.address().port}/`);
await pg.waitForFunction("window.DONE === true", null, { timeout: parseInt(process.env.TIMEOUT || "600000") });
await pg.screenshot({ path: out, fullPage: true });
await browser.close(); server.close();
console.log("RENDER ok ->", out);

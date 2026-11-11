// The fit test's pictures: each body wearing its outfit, drawn by three.js in headless Chromium (the repo's own browser
// launcher). Library garments wear their own textures, or ours; the tailor's garments wear the tailor's own materials.
//
//   node render.mjs <outfit dir of wear.py (or fit.py)> <sheet.png> [size] [body,body...]
//   VIEWS=0,40,180 (the angles drawn)   ZOOM=top|waist|legs|feet   GRID=<columns> (a catalogue)   TIMEOUT=<ms>   NOHIDE=1 (draw what's covered too)
//   LOOKS='{"<garment name>": {...}}' over the outfit's own "looks". A look, on a library garment:
//     {"pbr": "Procedural/fabric_denim", "tile": 0.03, "color": "#..."}   a set off the PBR shelf at its real size (the second UV, in metres)
//     {"surface": "flannel", "pattern": "plaid", "colors": [...], "repeat": 0.12, "color": "#..."}   the tailor's own fabric.js
//     "keep": 0..1 (how much of the garment's own seams and folds stays, a layer over the fabric)
//     "decal": {"file": "<png>", "side": "back", "yf": 0.775, "w": 0.26}   a PNG projected on
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const SHELF = existsSync(join(REPO, "assets", "pbr")) ? join(REPO, "assets", "pbr") : join(REPO, "pbr");
const dir = resolve(process.argv[2]), out = process.argv[3], size = parseInt(process.argv[4] || "420");
const index = JSON.parse(readFileSync(join(dir, "index.json")));
const only = process.argv[5] ? process.argv[5].split(",") : null;
const bodies = index.bodies.filter(b => !only || only.includes(b.name));
const looks = { ...(index.looks || {}), ...JSON.parse(process.env.LOOKS || "{}") };
for (const l of Object.values(looks)) {                             // a shelf set: its maps as files, its repeat
  if (!l.pbr || typeof l.pbr !== "string") continue;
  const folder = join(SHELF, ...l.pbr.replace(/^pbr\//, "").split("/")), meta = JSON.parse(readFileSync(join(folder, "meta.json")));
  l.pbr = { ...Object.fromEntries(Object.entries(meta.maps || {}).map(([k, f]) => [k, join(folder, f)])), gl: meta.normal !== "dx", tile: l.tile || meta.tile_m || 0.3, tint: !!meta.tint, label: meta.label };
}
const nv = (process.env.VIEWS || "0,38,90,180").split(",").length, cols = parseInt(process.env.GRID || "0");
const PAGE = `<!doctype html><html><head><script type="importmap">{"imports":{"three":"/three.js"}}</script></head>
<body style="margin:0;background:#1d1f23;color:#ddd;font:13px sans-serif"><div id="rows"></div>
<script type="module">
import * as THREE from "three";
import * as LOOK from "/tailor/look.js";
import * as FAB from "/tailor/fabric.js";
const index = ${JSON.stringify({ bodies, garments: index.garments })}, LOOKS = ${JSON.stringify(looks)}, S = ${size}, DIR = ${JSON.stringify(dir)};
const GRID = ${cols}, ZOOM = ${JSON.stringify(process.env.ZOOM || "")}, NOHIDE = ${process.env.NOHIDE ? "true" : "false"};
const VIEWS = (${JSON.stringify(process.env.VIEWS || "0,38,90,180")}).split(",").map((a, i) => [i ? "v" + a : "front", parseFloat(a)]);
if (GRID) document.getElementById("rows").style.cssText = "display:flex;flex-wrap:wrap";
const tl = new THREE.TextureLoader(), file = p => "/file?p=" + encodeURIComponent(p);
const tex = async (p, srgb) => { if (!p) return null; try { const t = await tl.loadAsync(file(p)); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; } catch (e) { return null; } };
const rep = t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
const canvasTex = c => rep(new THREE.CanvasTexture(c));

// every material: what's covered by a layer over it is left out, with a dither where it's only partly inside
let KEYS = 0;
function covered(m, more, lib = true) {
  const before = m.onBeforeCompile, key0 = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => "", key = "cover" + (KEYS++);
  m.customProgramCacheKey = () => key0() + "|" + key;              // (three keeps a program by this text: each of these is its own)
  m.onBeforeCompile = (sh, r) => {
    if (before) before(sh, r);
    sh.vertexShader = "attribute float aCover; varying float vCover;" + (lib ? " attribute vec2 aUvM; varying vec2 vUvM; varying vec2 vUv0;" : "") + "\\n" + sh.vertexShader.replace("void main() {", "void main() {\\n vCover = aCover;" + (lib ? " vUvM = aUvM; vUv0 = uv;" : ""));
    sh.fragmentShader = "varying float vCover;" + (lib ? " varying vec2 vUvM; varying vec2 vUv0;" : "") + "\\n" + sh.fragmentShader.replace("void main() {", "void main() {\\n" +
      "if (vCover > 0.0) { float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); if (vCover > n) discard; }");
    if (more) more(sh);
  };
  return m;
}
const mats = [], decals = [];
for (const g of index.garments) {
  const own = await tex(g.tex, true), ownN = await tex(g.normal, false), look = LOOKS[g.name];
  let m;
  if (!look) m = covered(new THREE.MeshStandardMaterial({ map: own, normalMap: ownN, color: own ? 0xffffff : 0x8899aa, roughness: 0.82, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.4 }));
  else {
    const detail = await tex(g.detail, false), keep = look.keep ?? 1;
    const layer = sh => {                                           // the garment's own seams, stitches and folds over whatever fabric it wears
      sh.uniforms.detailMap = { value: detail }; sh.uniforms.keep = { value: detail ? keep : 0 };
      sh.fragmentShader = "uniform sampler2D detailMap; uniform float keep;\\n" + sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\\n if (keep > 0.0) diffuseColor.rgb *= mix(vec3(1.0), texture2D(detailMap, vUv0).rgb * 2.0, keep);");
    };
    if (look.pbr) {                                                 // a set off the shelf, on the second UV (metres)
      const s = look.pbr, on1 = async (p, srgb) => { const t = await tex(p, srgb); if (!t) return null; rep(t); t.channel = 1; t.repeat.set(1 / s.tile, 1 / s.tile); return t; };
      m = new THREE.MeshStandardMaterial({ map: await on1(s.albedo, true), normalMap: await on1(s.normal, false), roughnessMap: await on1(s.rough, false), color: look.color || "#ffffff", roughness: 1, metalness: 0, side: THREE.DoubleSide });
      if (!s.gl) m.normalScale.set(1, -1);
      covered(m, layer);
    } else {                                                        // the tailor's own fabric tile and pattern
      const grain = canvasTex(FAB.surfaceTile(look.surface || "cotton")), pat = look.pattern ? canvasTex(FAB.patternTile(look.pattern, look.colors)) : null; if (pat) pat.colorSpace = THREE.SRGBColorSpace;
      m = covered(new THREE.MeshStandardMaterial({ color: look.color || "#ffffff", normalMap: ownN, roughness: look.rough ?? 0.85, metalness: 0, side: THREE.DoubleSide }), sh => {
        Object.assign(sh.uniforms, { grainMap: { value: grain }, patMap: { value: pat }, grainRep: { value: 1 / FAB.SURFACES[look.surface || "cotton"][1] }, patRep: { value: 1 / (look.repeat || 0.1) }, hasPat: { value: pat ? 1 : 0 } });
        sh.fragmentShader = "uniform sampler2D grainMap, patMap; uniform float grainRep, patRep, hasPat;\\n" + sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\\n" +
          "if (hasPat > 0.5) diffuseColor.rgb *= texture2D(patMap, vUvM * patRep).rgb;\\n diffuseColor.rgb *= mix(vec3(1.0), texture2D(grainMap, vUvM * grainRep).rgb * 2.0, 0.8);");
        layer(sh);
      });
    }
  }
  mats.push(m);
  decals.push(look && look.decal ? { ...look.decal, tex: await tex(look.decal.file, true) } : null);
}
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(S, Math.round(S * 1.55)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const shown = (T, C) => { if (NOHIDE || !C) return T; const o = []; for (let t = 0; t < T.length; t += 3) if (!(C[T[t]] >= 1 && C[T[t + 1]] >= 1 && C[T[t + 2]] >= 1)) o.push(T[t], T[t + 1], T[t + 2]); return new Uint32Array(o); };
for (const b of index.bodies) {
  const buf = await (await fetch(file(DIR + "/" + b.file))).arrayBuffer();
  const hl = new Uint32Array(buf, 0, 1)[0], head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  let at = 4 + hl; const f32 = n => { const a = new Float32Array(buf, at, n); at += n * 4; return a; }, u32 = n => { const a = new Uint32Array(buf, at, n); at += n * 4; return a; };
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x24262b);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a40, 1.1));
  const key = new THREE.DirectionalLight(0xfff2e0, 2.4); key.position.set(-1.5, 2.6, 2.4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 1.2); rim.position.set(1.8, 2.0, -2.2); scene.add(rim);
  const group = new THREE.Group(); scene.add(group);
  const bP = f32(head.body.P), bT = u32(head.body.T), bC = head.body.C ? f32(head.body.C) : null;
  const bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.BufferAttribute(bP, 3)); bg.setIndex(new THREE.BufferAttribute(shown(bT, bC), 1)); bg.computeVertexNormals(); bg.computeBoundingBox(); const bh = bg.boundingBox.max.y;
  group.add(new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: 0xc8a48c, roughness: 0.62 })));
  for (const g of head.garments) {
    const geo = new THREE.BufferGeometry(), P = f32(g.P), N = f32(g.N), UV = f32(g.UV), UV2 = g.UV2 ? f32(g.UV2) : null, C = g.C ? f32(g.C) : new Float32Array(g.P / 3), T = u32(g.T);
    geo.setAttribute("position", new THREE.BufferAttribute(P, 3)); geo.setAttribute("normal", new THREE.BufferAttribute(N, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(UV, 2));
    if (UV2) { geo.setAttribute("uv1", new THREE.BufferAttribute(UV2, 2)); geo.setAttribute("aUvM", new THREE.BufferAttribute(UV2, 2)); }
    geo.setAttribute("aCover", new THREE.BufferAttribute(NOHIDE ? new Float32Array(C.length) : C, 1)); geo.setIndex(new THREE.BufferAttribute(shown(T, C), 1));
    group.add(new THREE.Mesh(geo, mats[g.m]));
    const dc = decals[g.m];
    if (dc && dc.tex) {                                             // a PNG decal: projected straight on from behind or in front, drawn as the triangles it covers
      const sg = dc.side === "back" ? -1 : 1, n = P.length / 3;
      let cx = 0; for (let k = 0; k < n; k++) cx += P[k * 3]; cx /= n;
      const w = dc.w || 0.26, hh = w * dc.tex.image.height / dc.tex.image.width, cy = dc.yf ? dc.yf * bh : (dc.y ?? 1.3), uv = new Float32Array(n * 2), idx = [];
      for (let k = 0; k < n; k++) { uv[k * 2] = sg * (P[k * 3] - cx) / w + 0.5; uv[k * 2 + 1] = (P[k * 3 + 1] - cy) / hh + 0.5; }
      for (let t = 0; t < T.length; t += 3) {
        const [a, b2, c] = [T[t], T[t + 1], T[t + 2]];
        const inside = [a, b2, c].some(v => uv[v * 2] > 0 && uv[v * 2] < 1 && uv[v * 2 + 1] > 0 && uv[v * 2 + 1] < 1), facing = [a, b2, c].every(v => N[v * 3 + 2] * sg > 0.35);
        if (inside && facing) idx.push(a, b2, c);
      }
      const dg = new THREE.BufferGeometry(); dg.setAttribute("position", geo.attributes.position); dg.setAttribute("normal", geo.attributes.normal); dg.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); dg.setIndex(idx);
      dc.tex.wrapS = dc.tex.wrapT = THREE.ClampToEdgeWrapping;
      const dm = new THREE.MeshStandardMaterial({ map: dc.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: 0.7, side: THREE.DoubleSide });
      dm.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\\n if (vMapUv.x < 0.0 || vMapUv.x > 1.0 || vMapUv.y < 0.0 || vMapUv.y > 1.0) discard;"); };
      group.add(new THREE.Mesh(dg, dm));
    }
  }
  for (const m of head.tailor || []) {                              // the tailor's parts, in the tailor's own materials
    const q = { name: m.name, color: m.color, fabric: m.fabric, surface: m.surface, P: f32(m.n.P), T: u32(m.n.T), N: f32(m.n.N), UV: f32(m.n.UV), PART: f32(m.n.PART), S: f32(m.n.S), CRZ: m.n.CRZ ? f32(m.n.CRZ) : undefined };
    const C = f32(m.n.C); q.T = shown(q.T, C);
    if (!q.T.length) continue;
    const mesh = LOOK.mesh(q, m.name, m.look || {});
    mesh.geometry.setAttribute("aCover", new THREE.BufferAttribute(NOHIDE ? new Float32Array(C.length) : C, 1)); covered(mesh.material, null, false);
    group.add(mesh);
  }
  await LOOK.mapsLoaded();
  const row = document.createElement("div"); row.style.cssText = "display:flex;align-items:flex-end;margin:0 0 2px 0"; document.getElementById("rows").appendChild(row);
  for (const [name, az] of VIEWS) {
    const half = ZOOM === "top" ? 0.52 : ZOOM === "legs" ? 0.6 : ZOOM === "feet" ? 0.3 : ZOOM === "waist" ? 0.34 : 1.0, cy = ZOOM === "top" ? bh * 0.76 : ZOOM === "legs" ? bh * 0.3 : ZOOM === "feet" ? bh * 0.13 : ZOOM === "waist" ? bh * 0.6 : bh * 0.5;
    const cam = new THREE.OrthographicCamera(-half * S / (S * 1.55), half * S / (S * 1.55), half, -half, 0.1, 20);
    const a = az * Math.PI / 180; cam.position.set(Math.sin(a) * 5, cy, Math.cos(a) * 5); cam.lookAt(0, cy, 0); cam.updateProjectionMatrix();
    renderer.render(scene, cam);
    const im = new Image(); im.src = renderer.domElement.toDataURL("image/png"); await im.decode();
    const cell = document.createElement("div"); cell.style.cssText = "position:relative;margin-right:2px"; cell.appendChild(im);
    if (name === "front") { const t = document.createElement("div"); t.textContent = b.label || b.name; t.style.cssText = "position:absolute;left:6px;top:4px;font-weight:bold"; cell.appendChild(t); }
    row.appendChild(cell);
  }
}
window.DONE = true;
</script></body></html>`;
// what the page may read: the outfit's own folder, the garments' textures, the studio's prints, the PBR shelf
const ROOTS = [dir, join(REPO, "Content/Studio/Clothes/prints"), SHELF, join(REPO, "pbr"), ...index.garments.flatMap(g => [g.tex, g.normal]).filter(Boolean).map(f => dirname(resolve(f)))];
const server = createServer((q, r) => {
  const u = new URL(q.url, "http://x");
  if (u.pathname === "/") { r.writeHead(200, { "content-type": "text/html" }); return r.end(PAGE); }
  if (u.pathname === "/three.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(readFileSync(join(REPO, "tools/director/vendor/three.module.min.js"))); }
  if (/^\/tailor\/[a-z_]+\.js$/.test(u.pathname)) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(readFileSync(join(REPO, "tools", "character", u.pathname))); }
  if (u.pathname.startsWith("/pbrfile/")) {                         // a tailor garment's own PBR set (look.js asks for it here)
    const f = join(SHELF, ...decodeURIComponent(u.pathname.slice(9)).split("/"));
    if (!f.includes("..") && existsSync(f)) { r.writeHead(200, { "content-type": /png$/i.test(f) ? "image/png" : "image/jpeg" }); return r.end(readFileSync(f)); }
  }
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
const pg = await browser.newPage({ viewport: cols ? { width: (size * nv + 2) * cols + 4, height: Math.round(size * 1.55 + 2) * Math.ceil(bodies.length / cols) + 4 } : { width: size * nv + 8, height: Math.round(size * 1.55) * bodies.length + 4 } });
pg.on("console", m => { if (m.type() === "error") console.log("page:", m.text().slice(0, 600)); }); pg.on("pageerror", e => console.log("page error:", e.message));
await pg.goto(`http://127.0.0.1:${server.address().port}/`);
await pg.waitForFunction("window.DONE === true", null, { timeout: parseInt(process.env.TIMEOUT || "600000") });
await pg.screenshot({ path: out, fullPage: true });
await browser.close(); server.close();
console.log("RENDER ok ->", out);

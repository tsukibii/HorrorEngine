// The tailor's clothes in motion: bodies shaped like the desk's (tools/director/bodies.js BodyFigure on MHR_lod1.fbx
// with a body's identity weights), each dressed by the tailor on its rest pose, the clothes skinned to its skeleton by
// tailor/weights.js, then posed through the desk's poses and its walk (tools/director/motion.js) and rendered as a
// contact sheet: a pose a column, a body's views a block of rows. Also measures, in every pose, how much of each
// garment's outside is under the skin (not counting creases: where the body folds into itself, a sit's hip or an arm
// against the side, the cloth goes with the skin it's on).
//
//   node tools/character/tailor/motion.mjs --outfit "work uniform" | --designs flats,skirt [--bodies feminine,full_masculine]
//        [--height 1.62] [--poses rest,idle,walk0,walk0.5,walk1,sit,crouch,kneel,lunge] [--size 260] [--views 0,90,180]
//        [--zoom 1] [--at -0.05] [--marks] [--out x.png]
// walk0 and walk1 are the desk's two strides (walk_a, walk_b), walk0.5 between; rest is the pose the clothes were cut
// on. --zoom closes in, --at aims that many heights above the hips, --marks shows the cloth under the skin in red.
//
// Needs Playwright (npm i playwright, or PLAYWRIGHT=<path to its package>). Prints a line per body and pose (the share
// of each garment under the skin, %) and ends "MOTION-SHEET <file>".
import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { createRequire } from "module";
import { bodyWeights, ROOT } from "./node.mjs";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1] ?? true; };
const HEIGHT = { average: 1.7, feminine: 1.62, masculine: 1.78, slim_feminine: 1.6, slim_masculine: 1.76, full_feminine: 1.64, full_masculine: 1.78 };
const bodies = String(arg("bodies", arg("body", "feminine"))).split(",").map(name => ({ name, weights: bodyWeights(name), H: parseFloat(arg("height", HEIGHT[name] || 1.7)) }));
const outfit = arg("outfit", "work uniform"), out = arg("out", "tailor_motion.png"), size = parseInt(arg("size", 260));
const poses = String(arg("poses", "idle,walk0,walk0.5,walk1,sit,crouch,kneel,lunge")).split(",");
const CLOTHES = join(ROOT, "Content", "Studio", "Clothes");
const designs = JSON.parse(readFileSync(join(CLOTHES, "designs.json"))).designs, outfits = JSON.parse(readFileSync(join(CLOTHES, "outfits.json"))).outfits;
const only = arg("designs", null), list = only ? String(only).split(",").map(d => [d]) : outfits[outfit];
if (!list || list.some(([d]) => !designs[d])) { console.error(`no outfit or design called ${only || outfit}`); process.exit(1); }
const views = String(arg("views", "0,90,180")).split(",").map(Number), zoom = parseFloat(arg("zoom", 1)), at = parseFloat(arg("at", -0.05));
const setup = { bodies, list, designs, poses, size, views, zoom, at, marks: process.argv.includes("--marks") };

const page = `<!doctype html><html><head><style>body{margin:0;background:#20232a}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three.js"}}</script></head><body>
<script type="module">
import * as THREE from "three";
import { FBXLoader } from "/director/vendor/FBXLoader.js";
import { BodyFigure, shapeMesh } from "/director/bodies.js";
import { loadLibrary, clonePose, walkOverlay, fk } from "/director/motion.js";
import * as TAILOR from "/character/tailor.js";
import * as LOOK from "/character/tailor/look.js";
import { Surface } from "/character/tailor/mesh.js";
import * as WEIGHTS from "/character/tailor/weights.js";
const S = ${JSON.stringify(setup)};
const log = [], say = l => { log.push(l); console.log(l); };
try {
  const lib = loadLibrary(await (await fetch("/poses.json")).json());
  const template = await new FBXLoader().loadAsync("/MHR_lod1.fbx");
  const scene = new THREE.Scene(); scene.background = new THREE.Color("#2a2d34");
  scene.add(new THREE.HemisphereLight("#dfe6f0", "#3a3530", 1.3));
  const key = new THREE.DirectionalLight("#fff4e8", 2.2); key.position.set(1.5, 3, 2.5); scene.add(key);
  const rim = new THREE.DirectionalLight("#bcd0ff", 1.0); rim.position.set(-2, 2, -2.5); scene.add(rim);
  const rows = S.views.length, R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  R.setSize(S.size * S.poses.length, S.size * 1.5 * rows * S.bodies.length); document.body.appendChild(R.domElement); R.setScissorTest(true);
  const cam = new THREE.PerspectiveCamera(30, 1 / 1.5, 0.05, 20), v = new THREE.Vector3(), nv = new THREE.Vector3();
  const poseOf = name => {
    const w = /^walk([\\d.]+)$/.exec(name);
    if (w) return walkOverlay(lib, clonePose(lib.poses.idle), Math.asin(2 * Math.min(1, +w[1]) - 1) / (Math.PI * 3.6));
    return clonePose(lib.poses[name] || lib.poses.idle);
  };
  const world = (mesh, i, out) => mesh.getVertexPosition(i, out).applyMatrix4(mesh.matrixWorld);
  for (const [bi, who] of S.bodies.entries()) {
    const fig = new BodyFigure(lib, who.H, template, { shape: who.weights, keepMaterials: true });
    scene.add(fig.group);
    const body = shapeMesh(fig.model);
    body.material = new THREE.MeshStandardMaterial({ color: "#c8a28c", roughness: 0.6 });
    fig.group.updateMatrixWorld(true);
    // the body at rest, welded (the file splits its corners), in the figure's space: what the tailor cuts from
    const geo = body.geometry, n = geo.attributes.position.count, key3 = new Map(), uniq = [], of = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      world(body, i, v);
      const k = Math.round(v.x * 1e5) + "," + Math.round(v.y * 1e5) + "," + Math.round(v.z * 1e5);
      let u = key3.get(k); if (u === undefined) { u = uniq.length / 3; key3.set(k, u); uniq.push(v.x, v.y, v.z); }
      of[i] = u;
    }
    const P = new Float32Array(uniq), tri = [], idx = geo.index ? geo.index.array : Array.from({ length: n }, (_, i) => i);
    for (let t = 0; t < idx.length; t += 3) { const a = of[idx[t]], b = of[idx[t + 1]], c = of[idx[t + 2]]; if (a !== b && b !== c && a !== c) tri.push(a, b, c); }
    const T = new Uint32Array(tri), NU = P.length / 3;
    const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, BI = new Uint16Array(NU * 4), BW = new Float32Array(NU * 4);
    for (let i = 0; i < n; i++) { const u = of[i]; for (let k = 0; k < 4; k++) { BI[u * 4 + k] = SI.getComponent(i, k); BW[u * 4 + k] = SW.getComponent(i, k); } }
    const t0 = performance.now(), B = TAILOR.body(P, T), worn = TAILOR.dress(B, S.list, S.designs), t1 = performance.now();
    // the clothes as skinned meshes on the body's skeleton, their rest points taken back through the rest skinning:
    // skinned = matrixWorld * bindMatrixInverse * (sum w * bone) * bindMatrix * p, so p = bindMatrix^-1 * (sum)^-1 * A^-1 * world
    const K = WEIGHTS.skinOf(P, BI, BW);
    body.skeleton.update();
    const bm = body.skeleton.boneMatrices, M = new THREE.Matrix4(), C = new THREE.Matrix4(), tmp = new THREE.Matrix4();
    const Ai = body.matrixWorld.clone().multiply(body.bindMatrixInverse).invert(), bindInv = body.bindMatrix.clone().invert();
    const skinned = (gg, material, Q, N) => {
      const np = Q.length / 3, { index, weight } = WEIGHTS.transfer(K, Q), local = new Float32Array(np * 3), nrm = N && new Float32Array(np * 3);
      for (let i = 0; i < np; i++) {
        M.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        for (let k = 0; k < 4; k++) { const x = weight[i * 4 + k]; if (!x) continue; tmp.fromArray(bm, index[i * 4 + k] * 16); for (let e = 0; e < 16; e++) M.elements[e] += tmp.elements[e] * x; }
        C.copy(bindInv).multiply(M.invert()).multiply(Ai);
        v.set(Q[i * 3], Q[i * 3 + 1], Q[i * 3 + 2]).applyMatrix4(C); local[i * 3] = v.x; local[i * 3 + 1] = v.y; local[i * 3 + 2] = v.z;
        if (N) { nv.set(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]).transformDirection(C); nrm[i * 3] = nv.x; nrm[i * 3 + 1] = nv.y; nrm[i * 3 + 2] = nv.z; }
      }
      gg.setAttribute("position", new THREE.BufferAttribute(local, 3));
      if (nrm) gg.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
      gg.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(index, 4)); gg.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weight, 4));
      const sm = new THREE.SkinnedMesh(gg, material); sm.frustumCulled = false; sm.bindMode = body.bindMode;
      body.parent.add(sm); sm.position.copy(body.position); sm.quaternion.copy(body.quaternion); sm.scale.copy(body.scale);
      sm.bind(body.skeleton, body.bindMatrix);
      return sm;
    };
    const measured = [];
    for (const g of worn) {
      for (const q of g.parts) { const m = LOOK.mesh(q, g.name, g.look); skinned(m.geometry, m.material, q.P, q.N); }
      // its outside (the surface the cloth is thickened in from), hidden: what's measured against the skin
      const og = new THREE.BufferGeometry(); og.setIndex(new THREE.BufferAttribute(g.outer[0].T, 1));
      measured.push({ sm: skinned(og, new THREE.MeshBasicMaterial(), g.outer[0].P), garment: g.name });
      measured.at(-1).sm.visible = false;
    }
    const F = B.F, cm = y => Math.round(y * 100);
    say(who.name + ": dressed in " + Math.round(t1 - t0) + " ms, skinned in " + Math.round(performance.now() - t1) + " ms: " + worn.map(g => g.name).join(", ") +
      " (" + cm(F.H) + " cm tall, the neck at " + cm(F.neckBaseY) + ", armpits " + cm(F.armpitY) + ", waist " + cm(F.waistY) + ", crotch " + cm(F.crotchY) + ")");
    const restBones = body.skeleton.bones.map(b => [b.position.clone(), b.quaternion.clone()]);
    for (const [pi, name] of S.poses.entries()) {
      if (name === "rest") body.skeleton.bones.forEach((b, i) => { b.position.copy(restBones[i][0]); b.quaternion.copy(restBones[i][1]); });
      else fig.update(fk(lib, poseOf(name), who.H).pos);
      fig.group.updateMatrixWorld(true);
      // the posed skin, and how much of each garment's outside is under it, outside a crease (the spot a centimetre out
      // from the skin it's under is free, as in tailor/check.mjs)
      const PP = new Float32Array(NU * 3), done = new Uint8Array(NU);
      for (let i = 0; i < n; i++) { const u = of[i]; if (done[u]) continue; done[u] = 1; world(body, i, v); PP[u * 3] = v.x; PP[u * 3 + 1] = v.y; PP[u * 3 + 2] = v.z; }
      const surf = new Surface(PP, T), hit = {}, h2 = {}, under = {}, marks = [], kk = 0.01 * who.H / 1.726;
      for (const g of measured) {
        const np = g.sm.geometry.attributes.position.count; let bad = 0, cnt = 0;
        for (let i = 0; i < np; i += 3) {
          world(g.sm, i, v); const r = surf.closest(v.x, v.y, v.z, 0.05, hit); cnt++;
          if (!r || r.d >= -0.002) continue;
          const q = surf.closest(r.x + r.nx * kk, r.y + r.ny * kk, r.z + r.nz * kk, 0.05, h2);
          if (!q || q.d > 0) { bad++; marks.push(v.x, v.y, v.z); }
        }
        under[g.garment] = +(100 * bad / cnt).toFixed(1);
      }
      say("  " + name + " " + JSON.stringify(under));
      const dots = S.marks && marks.length ? new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(marks, 3)),
        new THREE.PointsMaterial({ color: "#ff2020", size: 3, sizeAttenuation: false, depthTest: false })) : null;
      if (dots) { dots.renderOrder = 9; scene.add(dots); }
      const mid = fig.map.pelvis.getWorldPosition(new THREE.Vector3()); mid.y = Math.max(0.5 * mid.y, mid.y + S.at * who.H);
      S.views.forEach((deg, row) => {
        const a = deg * Math.PI / 180, d = 3.4 * who.H / 1.7 / S.zoom, y = ((S.bodies.length - 1 - bi) * rows + rows - 1 - row) * S.size * 1.5;
        cam.position.set(mid.x + Math.sin(a) * d, mid.y + 0.1 / S.zoom, mid.z + Math.cos(a) * d); cam.lookAt(mid.x, mid.y, mid.z);
        R.setViewport(pi * S.size, y, S.size, S.size * 1.5); R.setScissor(pi * S.size, y, S.size, S.size * 1.5); R.render(scene, cam);
      });
      if (dots) { scene.remove(dots); dots.geometry.dispose(); }
    }
    // the next body takes the stage
    scene.remove(fig.group);
    fig.group.traverse(o => { if (o.isMesh && o !== body) { o.geometry.dispose(); } });
  }
} catch (e) { log.push("ERROR " + (e.stack || e)); }
window.LOG = log; window.done = true;
</script></body></html>`;

const TYPES = { ".js": "text/javascript", ".json": "application/json", ".fbx": "application/octet-stream" };
const server = createServer((q, r) => {
  const url = decodeURIComponent(q.url.split("?")[0]);
  const send = (f, type) => { if (!existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": type || TYPES[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f)); };
  if (url === "/") { r.writeHead(200, { "content-type": "text/html" }); return r.end(page); }
  if (url === "/three.js") return send(join(ROOT, "tools", "director", "vendor", "three.module.min.js"), "text/javascript");
  if (url === "/poses.json") return send(join(ROOT, "Content", "Studio", "poses.json"));
  if (url === "/MHR_lod1.fbx") return send(join(ROOT, "Content", "Studio", "Bodies", "MHR_lod1.fbx"));
  if (/^\/(director|character)\/[\w/.-]+\.js$/.test(url) && !url.includes("..")) return send(join(ROOT, "tools", url));
  r.writeHead(404); r.end();
}).listen(0, "127.0.0.1");
await new Promise(r => server.once("listening", r));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const pg = await (await browser.newContext({ viewport: { width: size * poses.length, height: size * 1.5 * views.length * bodies.length } })).newPage();
const errs = []; let fail; const failed = new Promise(r => { fail = r; });
pg.on("pageerror", e => { errs.push(e.message); fail(); });
pg.on("console", m => { if (m.type() === "error") errs.push(m.text()); else if (process.env.VERBOSE) console.log("  page: " + m.text()); });
await pg.goto(`http://127.0.0.1:${server.address().port}/`);
await Promise.race([pg.waitForFunction(() => window.done, null, { timeout: 1800000 }).catch(e => errs.push(e.message)), failed]);
const log = await pg.evaluate(() => window.LOG || []);
await pg.screenshot({ path: out });
await browser.close(); server.close();
for (const l of log) console.log(l);
if (errs.length || log.some(l => l.startsWith("ERROR"))) { console.error(errs.join("\n")); process.exit(1); }
writeFileSync(out.replace(/\.png$/, ".txt"), log.join("\n") + "\n");
console.log(`MOTION-SHEET ${out}`);

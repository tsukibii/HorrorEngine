// The open mouth pictured in the Character Studio's own page, for the overlay against a picture (DECISIONS 2026-11-13,
// better mouths: "If your overlayed open mouth matches the image 1:1 in 3d model shape, and is close in texture then you
// can pass this new branch"; docs/research/mouthfit/compare.py lays it over the picture and measures it):
//
//   node tools/character/mouthshots.mjs --out DIR [--preset "open smile" | --expr '{"jawDrop": 0.5, ...}']
//        [--look "neon wing"] [--head v2female] [--teeth '{"style": "v2"}'] [--sculpt '{"lips": 0.3}']
//        [--lips '{"shine": 0}'] [--yaw -1] [--pitch -8] [--light studio|lamp|night|torch|reference] [--key front] [--tag a] [--shapes]
//       a scratch character (_mouth) as the Studio starts one, the look worn, the expression set (MHR's shapes: a name
//       without _L/_R sets both sides), the head from the picture's side: DIR/mouth<tag>.png (the mouth filling the
//       frame), DIR/face<tag>.png, and DIR/mouth<tag>.json: where the lips' outer points (MediaPipe's ring), the
//       opening's own outline and a few of the face's points are in each picture, in pixels.
//
//       --shapes: also each lip shape (grow.js LIPS) on the mouth at rest, from the front: DIR/lips_<key>.png
//       (lips_plain.png: none).
//
// The Character Studio's server running (python tools/character/serve.py). GPU=1 on a machine with a graphics card.
// Ends "MOUTHSHOTS ok".
import { createRequire } from "module";
import path from "path";
import fs from "fs";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const URL = process.env.BODY_URL || "http://127.0.0.1:8793/", args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const OUT = path.resolve(opt("--out", ".")), TAG = opt("--tag", ""), NAME = "_mouth", J = (k, d) => JSON.parse(opt(k, d));
const cfg = { preset: opt("--preset", "open smile"), expr: opt("--expr", null) ? J("--expr", "{}") : null, look: opt("--look", "neon wing"), head: opt("--head", "v2female"), teeth: J("--teeth", "{}"), sculpt: J("--sculpt", "{}"), lips: J("--lips", "{}"),
              yaw: +opt("--yaw", -1), pitch: +opt("--pitch", -8), light: opt("--light", "studio"), key: opt("--key", "") };
fs.mkdirSync(OUT, { recursive: true });
const browser = await req("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 } })).newPage(); page.setDefaultTimeout(300000);
const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
const B = (f, a) => page.evaluate(f, a), t0 = Date.now();
const settle = async () => { await page.waitForFunction(() => /points/.test(document.querySelector("#hud").textContent) && !/finding|fitting/.test(document.querySelector("#status").textContent), null, { timeout: 300000 }); await page.waitForTimeout(1500); };
const OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185], FACE = [33, 133, 263, 362, 1, 2, 152, 234, 454, 10];
// the view aimed at some landmarks, filling `fill` of the clip; then where the lips' points, the opening and the face's points are in it
const aim = (clip, ids, fill, yaw, pitch) => B(async ([cx, cy, cw, ch, ids, fill, yaw, pitch, OUTER, FACE, key]) => { const b = window.__body, T = b.THREE, cam = b.camera;
  b.orbit.yaw = yaw * Math.PI / 180; b.orbit.pitch = pitch * Math.PI / 180;
  const px = p => { const r = b.renderer.domElement.getBoundingClientRect(), q = new T.Vector3(...p).applyMatrix4(b.rig.matrixWorld).project(cam); return [r.left + (q.x + 1) / 2 * r.width - cx, r.top + (1 - q.y) / 2 * r.height - cy]; };
  for (let pass = 0; pass < 7; pass++) {
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    b.rig.updateMatrixWorld(true); cam.updateMatrixWorld(true);
    const r = b.renderer.domElement.getBoundingClientRect(), pts = ids.map(i => new T.Vector3(...b.lmk(i)).applyMatrix4(b.rig.matrixWorld));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const mid = new T.Vector3();
    for (const p of pts) { mid.add(p); const q = p.clone().project(cam), x = r.left + (q.x + 1) / 2 * r.width, y = r.top + (1 - q.y) / 2 * r.height; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    mid.multiplyScalar(1 / pts.length);
    const k = Math.max((x1 - x0) / (cw * fill), (y1 - y0) / (ch * fill)), depth = cam.position.distanceTo(mid), mpp = 2 * depth * Math.tan(cam.fov * Math.PI / 360) / r.height;
    const right = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    b.orbit.pan.addScaledVector(right, ((x0 + x1) / 2 - (cx + cw / 2)) * mpp).addScaledVector(up, -((y0 + y1) / 2 - (cy + ch / 2)) * mpp); b.orbit.zoom = Math.min(3, Math.max(0.01, b.orbit.zoom * k));
  }
  if (key === "front") {                               // the picture's light: the lamp from the camera's side, a little above and to one side (the Studio's own comes from steeply above in a close-up of the head)
    let sc = b.rig; while (sc.parent) sc = sc.parent; const f = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 2), r = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), u = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const dir = f.clone().addScaledVector(u, 0.32).addScaledVector(r, -0.22).normalize();
    sc.traverse(o => { if (o.isDirectionalLight && o.intensity > 0) { o.target.position.copy(o.getWorldPosition(new T.Vector3())).sub(dir); o.target.updateMatrixWorld(true); } });
  }
  await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); b.rig.updateMatrixWorld(true); cam.updateMatrixWorld(true);
  return { outer: OUTER.map(i => px(b.lmk(i))), ring: (b.mouthRing || []).map(px), face: FACE.map(i => px(b.lmk(i))), mm: (() => { const a = px(b.lmk(61)), c = px(b.lmk(291)), A = b.lmk(61), C = b.lmk(291); return Math.hypot(a[0] - c[0], a[1] - c[1]) / (Math.hypot(A[0] - C[0], A[1] - C[1], A[2] - C[2]) * 1000 / b.scale); })() };
}, [clip.x, clip.y, clip.width, clip.height, ids, fill, yaw, pitch, OUTER, FACE, cfg.key]);
try {
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => window.__body && window.__body.SCULPT && window.__body.hair2, null, { timeout: 300000 });
  await page.fill("#newName", NAME); await page.click("#make", { noWaitAfter: true });
  await page.waitForFunction(n => window.__body.who === n && /starts from the/.test(document.querySelector("#status").textContent), NAME, { timeout: 300000 });
  await settle();
  const said = await B(c => { const b = window.__body; document.querySelector("#handlesOn").checked = false; const h = document.querySelector("#viewHelp"); if (h) h.style.display = "none"; b.setPose("rest");
    if (c.head !== b.st.headPreset) b.usePreset("head", c.head === "plain" ? "" : c.head);
    const s = document.querySelector("#lightSel"); if (s && [...s.options].some(o => o.value === c.light)) { s.value = c.light; s.dispatchEvent(new Event("change")); }
    if (c.look) b.useLook(c.look);
    Object.assign(b.st.teeth, c.teeth); Object.assign(b.st.sculpt, c.sculpt); Object.assign(b.st.lips, c.lips);
    const amap = b.AMAP || null, shapes = c.expr || (amap && amap.mhr_presets && amap.mhr_presets[c.preset] && amap.mhr_presets[c.preset].shapes);
    if (!shapes) return "no expression: " + c.preset;
    b.setExpr(b.mhrPreset(shapes)); b.changed("body"); return { teeth: b.st.teeth.style, head: b.st.headPreset, shapes }; }, cfg);
  if (typeof said === "string") throw new Error(said);
  await page.click('#views button[data-v="head"]', { noWaitAfter: true }); await settle(); await page.waitForTimeout(3000);
  const box = await page.locator("#view").boundingBox(), sq = Math.min(box.width - 320, box.height - 80, 760);
  const face = { x: Math.round(box.x + (box.width - sq) / 2), y: Math.round(box.y + 50), width: sq, height: sq }, wide = { x: face.x, y: Math.round(face.y + sq * 0.17), width: sq, height: Math.round(sq * 0.66) };
  const fp = await aim(face, [10, 152, 234, 454], 0.78, cfg.yaw, cfg.pitch); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, `face${TAG}.png`), clip: face });
  const mp = await aim(wide, [61, 291, 0, 17, 2, 18], 0.86, cfg.yaw, cfg.pitch); await page.waitForTimeout(2000); await page.screenshot({ path: path.join(OUT, `mouth${TAG}.png`), clip: wide });
  const dbg = await B(() => { const M = window.__body.MOUTHPARTS, o = {}; o.teeth = M.teeth.color.getHexString(); o.tongue = M.tongue.color.getHexString();
    for (const n of ["upper-teeth", "lower-teeth"]) { const m = M.parts[n], g = m.geometry, N = g.attributes.normal.array, P = g.attributes.position.array, C = g.attributes.color.array; let zmax = -1e9; for (let i = 2; i < P.length; i += 3) zmax = Math.max(zmax, P[i]);
      let nz = 0, c = 0, k = 0; for (let i = 0; i < P.length; i += 3) if (P[i + 2] > zmax - 0.6) { nz += N[i + 2]; c += C[i]; k++; }
      const e = m.matrixWorld.elements; o[n] = { frontNormalZ: +(nz / k).toFixed(2), frontColour: +(c / k).toFixed(2), n: k, det: +(new (window.__body.THREE.Matrix4)().copy(m.matrixWorld).determinant()).toExponential(2), sameMat: m.material === M.teeth, visible: m.visible, z: +e[14].toFixed(4) }; }
    return o; });
  fs.writeFileSync(path.join(OUT, `mouth${TAG}.json`), JSON.stringify({ cfg, said, dbg, face: fp, mouth: mp })); console.log("  " + JSON.stringify(dbg));
  console.log(`  ok  ${said.teeth} mouth on ${said.head}: mouth${TAG}.png (${mp.mm.toFixed(1)} px a millimetre, the opening's outline ${mp.ring.length} points), face${TAG}.png`);
  if (args.includes("--shapes")) {                     // the lip shapes (grow.js LIPS), each on the mouth at rest: DIR/lips_<key>.png
    const GW = await import("./grow.js"), close = { x: wide.x, y: Math.round(face.y + sq * 0.25), width: sq, height: Math.round(sq * 0.5) };
    for (const key of ["", ...Object.keys(GW.LIPS)]) {
      await B(([key, lips]) => { const b = window.__body; b.setExpr(b.mhrPreset({})); Object.assign(b.st.lips, lips); b.useLips(key, true); b.changed("body"); }, [key, cfg.lips]);
      await settle(); await page.waitForTimeout(2500);
      await aim(close, [61, 291, 0, 17], 0.5, 0, 1.5); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, `lips_${key || "plain"}.png`), clip: close });
      console.log(`  ok  lips_${key || "plain"}.png`);
    }
  }
  if (errs.length) throw new Error("page errors: " + errs.slice(0, 3).join(" | "));
} catch (e) {
  console.log("MOUTHSHOTS FAIL: " + e.message); await browser.close(); process.exit(1);
}
await browser.close();
console.log(`MOUTHSHOTS ok (${((Date.now() - t0) / 1000).toFixed(0)} s)`);

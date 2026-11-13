// Close-ups of whole looks (looks.js LOOKS: the eyes, the lips, the skin's makeup, the lashes) on a scratch character in
// the Character Studio's own page, for a look to be held beside the picture it's after (DECISIONS 2026-11-12, make-up
// enhanced: "analyze the daz images ... and re-create those makeup looks 1:1 (the same lip gloss, shines etc, )"):
//
//   node tools/character/makeupshots.mjs --out DIR [--looks "soft cinematic,daz porcelain"] [--head v2female]
//        [--light reference] [--hair none|<a hair editor v2.0 style>] [--set '{"lips": {...}, "makeup": {...}}']
//       each look: the face from the front and three quarters, the eyes close, the lips close (DIR/<look>_face.png,
//       _34.png, _eyes.png, _lips.png; spaces in a look's name as _). --set: settings laid over the look before it's
//       pictured (lips: the lipstick's, makeup: the skin's makeup, eyes), for trying a value without editing looks.js
//
// The Character Studio's server running (python tools/character/serve.py; BODY_URL for another port). GPU=1 on a
// machine with a graphics card (tools/browser.cjs). Ends "MAKEUPSHOTS ok".
import { createRequire } from "module";
import path from "path";
import fs from "fs";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const URL = process.env.BODY_URL || "http://127.0.0.1:8793/", args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const OUT = path.resolve(opt("--out", ".")), LIGHT = opt("--light", "reference"), HEAD = opt("--head", "v2female"), HAIR = opt("--hair", "none"), SET = JSON.parse(opt("--set", "{}")), NAME = "_makeup";
const LK = await import("./looks.js"), looks = opt("--looks", Object.keys(LK.LOOKS).join(",")).split(",").map(s => s.trim()).filter(Boolean);
if (looks.some(l => !LK.LOOKS[l])) { console.log(`MAKEUPSHOTS FAIL: no look named ${looks.filter(l => !LK.LOOKS[l]).join(", ")} (there are: ${Object.keys(LK.LOOKS).join(", ")})`); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const browser = await req("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 } })).newPage(); page.setDefaultTimeout(300000);
const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
const B = (f, a) => page.evaluate(f, a), t0 = Date.now();
const settle = async () => { await page.waitForFunction(() => /points/.test(document.querySelector("#hud").textContent) && !/finding|fitting/.test(document.querySelector("#status").textContent), null, { timeout: 300000 }); await page.waitForTimeout(1500); };
// the view aimed at some of the face's landmarks (MediaPipe's points on the head), filling `fill` of the clip
const aim = (clip, ids, fill, yawDeg) => B(async ([cx, cy, cw, ch, ids, fill, yawDeg]) => { const b = window.__body, T = b.THREE, cam = b.camera;
  b.orbit.yaw = yawDeg * Math.PI / 180; b.orbit.pitch = 0.02;
  for (let pass = 0; pass < 6; pass++) {
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    b.rig.updateMatrixWorld(true); cam.updateMatrixWorld(true);
    const r = b.renderer.domElement.getBoundingClientRect(), pts = ids.map(i => new T.Vector3(...b.lmk(i)).applyMatrix4(b.rig.matrixWorld));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const mid = new T.Vector3();
    for (const p of pts) { mid.add(p); const q = p.clone().project(cam), x = r.left + (q.x + 1) / 2 * r.width, y = r.top + (1 - q.y) / 2 * r.height; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    mid.multiplyScalar(1 / pts.length);
    const k = Math.max((x1 - x0) / (cw * fill), (y1 - y0) / (ch * fill)), depth = cam.position.distanceTo(mid), px = 2 * depth * Math.tan(cam.fov * Math.PI / 360) / r.height;
    const right = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    b.orbit.pan.addScaledVector(right, ((x0 + x1) / 2 - (cx + cw / 2)) * px).addScaledVector(up, -((y0 + y1) / 2 - (cy + ch / 2)) * px); b.orbit.zoom = Math.min(3, Math.max(0.02, b.orbit.zoom * k));
  } }, [clip.x, clip.y, clip.width, clip.height, ids, fill, yawDeg]);
try {
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => window.__body && window.__body.SCULPT && window.__body.hair2, null, { timeout: 300000 });
  await page.fill("#newName", NAME); await page.click("#make", { noWaitAfter: true });
  await page.waitForFunction(n => window.__body.who === n && /starts from the/.test(document.querySelector("#status").textContent), NAME, { timeout: 300000 });
  await settle();
  await B(([head, light]) => { const b = window.__body; document.querySelector("#handlesOn").checked = false; const h = document.querySelector("#viewHelp"); if (h) h.style.display = "none"; b.setPose("rest"); b.usePreset("head", head);
    const s = document.querySelector("#lightSel"); if (s && [...s.options].some(o => o.value === light)) { s.value = light; s.dispatchEvent(new Event("change")); } }, [HEAD, LIGHT]);
  if (HAIR !== "none") { await page.click('#tabs button[data-tab="hair2"]', { noWaitAfter: true }); await page.waitForTimeout(600); await B(id => document.querySelector(`#hair2Grid .card[data-style="${id}"]`).click(), HAIR);
    await page.waitForTimeout(800); await page.waitForFunction(() => { const s = window.__body.hair2.state; return !s.on || (s.shownSeq === s.seq && !s.draft && s.stats) || s.failed; }, null, { timeout: 300000 }); }
  await page.click('#tabs button[data-tab="body"]', { noWaitAfter: true });
  await page.click('#views button[data-v="head"]', { noWaitAfter: true }); await settle();
  const box = await page.locator("#view").boundingBox(), sq = Math.min(box.width - 320, box.height - 80, 760);
  const face = { x: Math.round(box.x + (box.width - sq) / 2), y: Math.round(box.y + 50), width: sq, height: sq }, wide = { x: face.x, y: Math.round(face.y + sq * 0.25), width: sq, height: Math.round(sq * 0.5) };
  const FACE = [10, 152, 234, 454], EYES = [33, 263, 70, 300, 145, 374, 133, 362], LIPS = [61, 291, 0, 17];
  for (const look of looks) {
    await B(([look, set]) => { const b = window.__body; b.useLook(look);
      if (set.lips) Object.assign(b.st.lips, set.lips); if (set.makeup) Object.assign(b.st.skin.proc, set.makeup); if (set.eyes) { Object.assign(b.st.eyes, set.eyes); b.paintEyes(); }
      b.skinLook(); b.changed("expr"); }, [look, SET]);
    await settle(); await page.waitForTimeout(2500);
    const f = look.replace(/[^A-Za-z0-9]+/g, "_");
    await aim(face, FACE, 0.78, 0); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, f + "_face.png"), clip: face });
    await aim(face, FACE, 0.78, 28); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, f + "_34.png"), clip: face });
    await aim(wide, EYES, 0.8, 0); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, f + "_eyes.png"), clip: wide });
    await aim(wide, LIPS, 0.5, 0); await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, f + "_lips.png"), clip: wide });
    console.log(`  ok  ${look}: ${f}_face.png, _34.png, _eyes.png, _lips.png`);
  }
  if (errs.length) throw new Error("page errors: " + errs.slice(0, 3).join(" | "));
} catch (e) {
  console.log("MAKEUPSHOTS FAIL: " + e.message); await browser.close(); process.exit(1);
}
await browser.close();
console.log(`MAKEUPSHOTS ok (${looks.length} looks, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);

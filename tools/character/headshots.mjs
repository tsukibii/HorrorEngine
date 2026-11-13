// Head presets pictured in the Character Studio's own page, to hold a head card to its reference picture (DECISIONS
// 2026-11-13, two heads: "Be as 1:1 as possible for the proportions"; docs/research/headfit lays the outline over the
// picture, this is the real thing with its lids, eyes and lips to look at beside it):
//
//   node tools/character/headshots.mjs --out DIR [--heads v2fox,v2pixie] [--views "front:0:0,side:-90:0,q:-68:-10"]
//        [--variants FILE.json] [--light studio|reference] [--key front] [--fill 0.62] [--hair STYLE] [--look "porcelain berry"] [--fov 20] [--face]
//       a scratch character (_headshot) as the Studio starts one; for each head (its card clicked: the head, its lids'
//       and its lips' shape) and each view (name:yaw:pitch, degrees) DIR/<head>_<view>.png, the head filling `fill`
//       of a square frame. --variants: a list of { tag, head, eyes: {the eye shape's keys}, lips: {the five lip
//       sliders}, sculpt: {the character's own sliders on top}, hair: STYLE, set: {the style's settings} } to try
//       values before they are a card's: DIR/<tag>_<view>.png. --face: the face alone fills the frame (the forehead to
//       the chin, ear to ear), not the whole skull. --look: a whole look (looks.js) worn first: lashes, brows, makeup.
//
// The Character Studio's server running (python tools/character/serve.py). GPU=1 on a machine with a graphics card.
// Ends "HEADSHOTS ok".
import { createRequire } from "module";
import path from "path";
import fs from "fs";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const URL = process.env.BODY_URL || "http://127.0.0.1:8793/", args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const OUT = path.resolve(opt("--out", ".")), NAME = "_headshot", GW = await import("./grow.js");
const VIEWS = opt("--views", "front:0:0,side:-90:0").split(",").map(v => { const [n, y, p] = v.split(":"); return { name: n, yaw: +y, pitch: +p }; });
const VARS = opt("--variants", null) ? JSON.parse(fs.readFileSync(opt("--variants"), "utf8")) : opt("--heads", Object.keys(GW.HEADS).join(",")).split(",").map(h => ({ tag: h, head: h, hair: opt("--hair", ""), look: opt("--look", "") }));
const FILL = +opt("--fill", 0.62), LIGHT = opt("--light", "studio"), KEY = opt("--key", "front");
fs.mkdirSync(OUT, { recursive: true });
const browser = await req("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 } })).newPage(); page.setDefaultTimeout(300000);
const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
const B = (f, a) => page.evaluate(f, a), t0 = Date.now();
const settle = async () => { await page.waitForFunction(() => /points/.test(document.querySelector("#hud").textContent) && !/finding|fitting/.test(document.querySelector("#status").textContent), null, { timeout: 300000 }); await page.waitForTimeout(1500); };
const hairDone = async () => { await page.waitForTimeout(700); await page.waitForFunction(() => { const s = window.__body.hair2.state; return !s.on || (s.shownSeq === s.seq && !s.draft && s.stats) || s.failed; }, null, { timeout: 300000 }); };
// the view aimed at the head (the skull's top, the chin, the ears' sides), filling `fill` of the clip
const aim = (clip, yaw, pitch) => B(async ([cx, cy, cw, ch, fill, yaw, pitch, key, face]) => { const b = window.__body, T = b.THREE, cam = b.camera, ids = [10, 152, 234, 454, 1];
  b.orbit.yaw = yaw * Math.PI / 180; b.orbit.pitch = pitch * Math.PI / 180;
  for (let pass = 0; pass < 7; pass++) {
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    b.rig.updateMatrixWorld(true); cam.updateMatrixWorld(true);
    const r = b.renderer.domElement.getBoundingClientRect(), pts = ids.map(i => new T.Vector3(...b.lmk(i)).applyMatrix4(b.rig.matrixWorld));
    if (!face) { const top = pts[0].clone(); top.y += 0.07 * b.scale; pts.push(top); const back = pts[0].clone().lerp(pts[1], 0.35); back.z -= 0.2 * b.scale; pts.push(back); }   // (the skull over the forehead and behind it: MediaPipe's points are the face's alone)
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const mid = new T.Vector3();
    for (const p of pts) { mid.add(p); const q = p.clone().project(cam), x = r.left + (q.x + 1) / 2 * r.width, y = r.top + (1 - q.y) / 2 * r.height; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    mid.multiplyScalar(1 / pts.length);
    const k = Math.max((x1 - x0) / (cw * fill), (y1 - y0) / (ch * fill)), depth = cam.position.distanceTo(mid), mpp = 2 * depth * Math.tan(cam.fov * Math.PI / 360) / r.height;
    const right = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    b.orbit.pan.addScaledVector(right, ((x0 + x1) / 2 - (cx + cw / 2)) * mpp).addScaledVector(up, -((y0 + y1) / 2 - (cy + ch / 2)) * mpp); b.orbit.zoom = Math.min(3, Math.max(0.01, b.orbit.zoom * k));
  }
  if (key === "front") {                               // the lamp from the camera's side, a little above and to one side (the Studio's own comes from steeply above in a close-up of the head)
    let sc = b.rig; while (sc.parent) sc = sc.parent; const f = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 2), r = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), u = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const dir = f.clone().addScaledVector(u, 0.32).addScaledVector(r, -0.22).normalize();
    sc.traverse(o => { if (o.isDirectionalLight && o.intensity > 0) { o.target.position.copy(o.getWorldPosition(new T.Vector3())).sub(dir); o.target.updateMatrixWorld(true); } });
  }
  await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
}, [clip.x, clip.y, clip.width, clip.height, FILL, yaw, pitch, KEY, args.includes("--face")]);
try {
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => window.__body && window.__body.SCULPT && window.__body.hair2, null, { timeout: 300000 });
  await page.fill("#newName", NAME); await page.click("#make", { noWaitAfter: true });
  await page.waitForFunction(n => window.__body.who === n && /starts from the/.test(document.querySelector("#status").textContent), NAME, { timeout: 300000 });
  await settle();
  await B(light => { const b = window.__body; document.querySelector("#handlesOn").checked = false; const h = document.querySelector("#viewHelp"); if (h) h.style.display = "none"; b.setPose("rest");
    const s = document.querySelector("#lightSel"); if (s && [...s.options].some(o => o.value === light)) { s.value = light; s.dispatchEvent(new Event("change")); } }, LIGHT);
  await page.click('#views button[data-v="head"]', { noWaitAfter: true }); await settle();
  if (opt("--fov", null)) await B(f => { const c = window.__body.camera; c.fov = f; c.updateProjectionMatrix(); }, +opt("--fov"));   // (a longer lens: a portrait's, where the Studio's own close-up widens the nose and the cheeks)
  const box = await page.locator("#view").boundingBox(), sq = Math.min(box.width - 320, box.height - 80, 760), clip = { x: Math.round(box.x + (box.width - sq) / 2), y: Math.round(box.y + 50), width: sq, height: sq };
  const LOOK = opt("--look", "") || (VARS.find(v => v.look) || {}).look || "";
  if (LOOK) { await B(look => { const b = window.__body; b.useLook(look); b.changed("body"); }, LOOK); await settle(); }   // (a whole look, once: lashes, brows, makeup, the eyes' paint; it moves no slider of the face's shape)
  const own = await B(() => ({ ...window.__body.st.sculpt }));
  for (const v of VARS) {
    const said = await B(([v, own]) => { const b = window.__body, G = b.GW; if (v.head !== "plain" && !G.HEADS[v.head]) return "no head: " + v.head;
      for (const k of Object.keys(b.st.sculpt)) delete b.st.sculpt[k]; Object.assign(b.st.sculpt, own);
      if (v.look) b.useLook(v.look);
      b.usePreset("head", v.head === "plain" ? "" : v.head);
      if (v.eyes) b.st.eyes.shape = { size: 0, crease: 0, fold: 0, tilt: 0, opening: 0, depth: 0, ...v.eyes };
      if (v.lips) for (const id of G.LIP_IDS) { if (v.lips[id]) b.st.sculpt[id] = v.lips[id]; else delete b.st.sculpt[id]; }
      Object.assign(b.st.sculpt, v.sculpt || {}); b.changed("body"); return { head: b.st.headPreset, eyes: b.st.eyes.shape }; }, [v, own]);
    if (typeof said === "string") throw new Error(said);
    await settle();
    await B(async ([style, set]) => { const b = window.__body; if (style) { b.hair2.use(style, set || {}, true); await b.hair2.ready(); } else if (b.hair2.state.on) b.hair2.wear(false); }, [v.hair || "", v.set || null]).catch(() => {});
    if (v.hair) await hairDone();
    await page.waitForTimeout(2500);
    for (const w of VIEWS) { await aim(clip, w.yaw, w.pitch); await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, `${v.tag}_${w.name}.png`), clip }); }
    console.log(`  ok  ${v.tag}: ${VIEWS.map(w => w.name).join(", ")} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  if (errs.length) throw new Error("page errors: " + errs.slice(0, 3).join(" | "));
} catch (e) {
  console.log("HEADSHOTS FAIL: " + e.message); await browser.close(); process.exit(1);
}
await browser.close();
console.log(`HEADSHOTS ok (${((Date.now() - t0) / 1000).toFixed(0)} s)`);

// The head and body presets' cards (grow.js HEADS, BODIES; the Body tab's Presets; DECISIONS 2026-11-12, make-up enhanced:
// "thumbnail categories for, monster as we have now (untouched), heads, and bodies"), pictured in the Character
// Studio's own page in a headless browser:
//
//   node tools/character/presets.mjs thumbs [--only head_v2female,body_bodyv2] [--hair m_buzz | --hair none] [--top crop-tee] [--out DIR]
//       each head on a scratch character (_presets) as the Studio starts one (grow.js NEW_START, its look), the head
//       pictured a little from the side; each body the whole figure from the front in a cropped tee and leggings
//       (the tailor's own, cut on that body), on the Studio's own head. Into Content/Studio/Presets/thumbs/
//       head_<id>.jpg and body_<id>.jpg (plain: the feminine base's own), kept in the project as the creatures' are.
//       --hair: a hair editor v2.0 style the heads wear so a card reads as a person (a buzz cut by default: the
//       head's shape, its forehead and its hairline are what the card is for); none: bald
//
// The Character Studio's server running (python tools/character/serve.py; BODY_URL for another port). On a machine with
// a graphics card: GPU=1 in front (tools/browser.cjs). Ends "PRESETS ok".
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."), URL = process.env.BODY_URL || "http://127.0.0.1:8793/";
const args = process.argv.slice(2), mode = args[0], opt = k => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
if (mode !== "thumbs") { console.log("node tools/character/presets.mjs thumbs [--only head_v2female,body_bodyv2] [--hair bun_low|none]"); process.exit(1); }
const GW = await import("./grow.js"), only = (opt("--only") || "").split(",").filter(Boolean), HAIR = opt("--hair") || "m_buzz", TOP = opt("--top") || "crop-tee", OUT = opt("--out"), NAME = "_presets";
const all = [...["", ...Object.keys(GW.HEADS)].map(k => ["head", k]), ...["", ...Object.keys(GW.BODIES)].map(k => ["body", k])], id = ([kind, k]) => `${kind}_${k || "plain"}`;
const todo = all.filter(c => !only.length || only.includes(id(c)));
if (only.some(o => !all.some(c => id(c) === o))) { console.log(`PRESETS FAIL: no card named ${only.filter(o => !all.some(c => id(c) === o)).join(", ")} (there are: ${all.map(id).join(", ")})`); process.exit(1); }
const browser = await req("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 } })).newPage(); page.setDefaultTimeout(300000);   // (a busy software-drawn page answers late)
const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
const B = (f, a) => page.evaluate(f, a), t0 = Date.now();
const settle = async () => {                             // the view's own word that it's composed, the face's fit not in flight
  await page.waitForFunction(() => /points/.test(document.querySelector("#hud").textContent) && !/finding|fitting/.test(document.querySelector("#status").textContent), null, { timeout: 300000 });
  await page.waitForTimeout(1500);
};
const hairDone = async () => { await page.waitForTimeout(700); await page.waitForFunction(() => { const s = window.__body.hair2.state; return !s.on || (s.shownSeq === s.seq && !s.draft && s.stats) || s.failed; }, null, { timeout: 300000 }); };   // (a moment first: a changed head asks for its hair again a little after)
const dressed = n => page.waitForFunction(n => { const g = window.__body.GARMENTS.children; return g.length >= n && !/^(cutting|cut|hanging)$/.test(window.__body.drapeState?.stage || ""); }, n, { timeout: 600000 });
// what's pictured fitted into the card: the head's points, or the body's within 30 cm of its middle (the trunk and the
// legs fill the card: the arms, out to the sides in MHR's pose, run off it), seen through
// the view's camera; the view's zoom and pan moved until they sit in the card's middle and fill it (a few times: the
// pan moves the camera, so the first fit is a little off)
const fit = (clip, whole, fill) => B(async ([cx, cy, cw, ch, whole, fill]) => { const b = window.__body, T = b.THREE, cam = b.camera, r = b.renderer.domElement.getBoundingClientRect();
  await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));      // (the view's camera where its zoom and pan now put it)
  b.rig.updateMatrixWorld(true); cam.updateMatrixWorld(true);
  const P = b.POS, chin = b.lmk(152); let top = 0; for (let i = 1; i < P.length / 3; i++) if (P[i * 3 + 1] > P[top * 3 + 1]) top = i;
  const crown = [P[top * 3], P[top * 3 + 1], P[top * 3 + 2]], mid = whole ? [0, crown[1] / 2, 0] : [0, 1, 2].map(a => (chin[a] + crown[a]) / 2), H = Math.hypot(...[0, 1, 2].map(a => crown[a] - chin[a])), R = whole ? 9 : 0.8 * H;
  const pts = []; for (let i = 0; i < P.length; i += whole ? 9 : 3) if (whole ? Math.abs(P[i]) < 0.3 : Math.hypot(P[i] - mid[0], P[i + 1] - mid[1], P[i + 2] - mid[2]) < R) pts.push(new T.Vector3(P[i], P[i + 1], P[i + 2]).applyMatrix4(b.rig.matrixWorld));
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of pts) { const q = p.clone().project(cam), x = r.left + (q.x + 1) / 2 * r.width, y = r.top + (1 - q.y) / 2 * r.height; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const k = Math.max((x1 - x0) / (cw * fill), (y1 - y0) / (ch * fill)), depth = cam.position.distanceTo(new T.Vector3(...mid).applyMatrix4(b.rig.matrixWorld));
  const px = 2 * depth * Math.tan(cam.fov * Math.PI / 360) / r.height;                       // metres a pixel there
  const right = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  const dx = ((x0 + x1) / 2 - (cx + cw / 2)) * px, dy = ((y0 + y1) / 2 - (cy + ch / 2)) * px;
  b.orbit.pan.addScaledVector(right, dx).addScaledVector(up, -dy); b.orbit.zoom = Math.min(3, Math.max(0.06, b.orbit.zoom * k));
  return { k, dx, dy, n: pts.length }; }, [clip.x, clip.y, clip.width, clip.height, whole, fill]);
const shoot = async (clip, file) => {                    // down to a card's size (280 px wide) as a JPEG, in the page: no image tool needed
  const png = await page.screenshot({ clip });
  const jpg = await B(async b64 => { const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
    const c = document.createElement("canvas"); c.width = 280; c.height = Math.round(280 * im.height / im.width); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.88).split(",")[1]; }, png.toString("base64"));
  fs.writeFileSync(file, Buffer.from(jpg, "base64"));
  console.log(`  ok  ${path.basename(file, ".jpg")}: ${path.relative(ROOT, file)} (${Math.round(Buffer.from(jpg, "base64").length / 1024)} KB)`);
};
try {
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => window.__body && window.__body.SCULPT && window.__body.hair2, null, { timeout: 300000 });
  const out = OUT ? path.resolve(OUT) : path.join(ROOT, "Content", "Studio", "Presets", "thumbs"); fs.mkdirSync(out, { recursive: true });
  await page.fill("#newName", NAME); await page.click("#make", { noWaitAfter: true });      // a character as the Studio starts one
  await page.waitForFunction(n => window.__body.who === n && /starts from the/.test(document.querySelector("#status").textContent), NAME, { timeout: 300000 });
  await settle();
  await B(() => { document.querySelector("#handlesOn").checked = false; const h = document.querySelector("#viewHelp"); if (h) h.style.display = "none"; window.__body.setPose("rest"); });
  const box = await page.locator("#view").boundingBox(), start = await B(() => ({ head: window.__body.st.headPreset, body: window.__body.st.bodyPreset }));
  // ---- the heads
  const heads = todo.filter(c => c[0] === "head");
  if (heads.length) {
    if (HAIR !== "none") {
      await page.click('#tabs button[data-tab="hair2"]', { noWaitAfter: true }); await page.waitForTimeout(600);
      await B(id => document.querySelector(`#hair2Grid .card[data-style="${id}"]`).click(), HAIR); await hairDone();
      await page.click('#tabs button[data-tab="body"]', { noWaitAfter: true });
    }
    await page.click('#views button[data-v="head"]', { noWaitAfter: true }); await page.click('#views button[data-yaw="0"]', { noWaitAfter: true });
    const w = Math.min(box.width - 300, 560), h = Math.min(Math.round(w * 1.25), box.height - 50), clip = { x: Math.round(box.x + (box.width - w) / 2), y: Math.round(box.y + 46), width: w, height: h };
    for (const c of heads) {
      await B(k => { const b = window.__body; b.usePreset("head", k); b.orbit.zoom = 1; b.orbit.pan.set(0, 0, 0); b.orbit.yaw = 22 * Math.PI / 180; b.orbit.pitch = 0.03; }, c[1]);
      await settle(); if (HAIR !== "none") await hairDone();
      await page.waitForTimeout(2500);
      for (let i = 0; i < 8; i++) { const f = await fit(clip, false, 0.8); if (i > 1 && Math.abs(f.k - 1) < 0.01 && Math.hypot(f.dx, f.dy) < 0.001) break; await page.waitForTimeout(400); }   // (until it sits still: the hair's last redraw can move the view once)
      await page.waitForTimeout(2000);
      await shoot(clip, path.join(out, id(c) + ".jpg"));
    }
    await B(k => window.__body.usePreset("head", k), start.head); await settle();
  }
  // ---- the bodies: the whole figure from the front, dressed for a gym
  const bodies = todo.filter(c => c[0] === "body");
  if (bodies.length) {
    if (HAIR !== "none" && !heads.length) {
      await page.click('#tabs button[data-tab="hair2"]', { noWaitAfter: true }); await page.waitForTimeout(600);
      await B(id => document.querySelector(`#hair2Grid .card[data-style="${id}"]`).click(), HAIR); await hairDone();
      await page.click('#tabs button[data-tab="body"]', { noWaitAfter: true });
    }
    await page.click('#views button[data-v="body"]', { noWaitAfter: true }); await page.click('#views button[data-yaw="0"]', { noWaitAfter: true });
    const h = Math.min(box.height - 60, 900), w = Math.round(h * 0.4), clip = { x: Math.round(box.x + (box.width - w) / 2), y: Math.round(box.y + 46), width: w, height: h };
    for (const c of bodies) {
      await B(([k, top]) => { const b = window.__body; if (b.st.anime) { b.setAnime(false); delete b.st.sculpt.bust; }   // (a card before this one may have turned Anime on: grow.js BODIES' `anime`)
        b.usePreset("body", k); b.st.clothes = [{ design: "leggings", color: "#23252b" }, { design: top, color: "#3a4352" }]; b.dress(); b.orbit.zoom = 1; b.orbit.pan.set(0, 0, 0); b.orbit.yaw = 0; b.orbit.pitch = 0.02; }, [c[1], TOP]);
      await settle(); await page.waitForTimeout(1500); await dressed(2); if (HAIR !== "none") await hairDone();
      await page.waitForTimeout(2500);
      for (let i = 0; i < 8; i++) { const f = await fit(clip, true, 0.93); if (i > 1 && Math.abs(f.k - 1) < 0.01 && Math.hypot(f.dx, f.dy) < 0.002) break; await page.waitForTimeout(400); }
      await page.waitForTimeout(2500);
      await shoot(clip, path.join(out, id(c) + ".jpg"));
    }
  }
  if (errs.length) throw new Error("page errors: " + errs.slice(0, 3).join(" | "));
} catch (e) {
  console.log("PRESETS FAIL: " + e.message); await browser.close(); process.exit(1);
}
await browser.close();
console.log(`PRESETS ok (${mode}, ${todo.length}, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);

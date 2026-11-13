// The eye looks (eyelooks.js EYE_LOOKS; the Face tab's cards; DECISIONS 2026-11-12, eyes v3: "create a thumbnail icon for
// it similar to the icons we have in our monster presets"), driven in the Character Studio's own page in a headless
// browser:
//
//   node tools/character/eyelooks.mjs thumbs [--only v3]
//       the cards' pictures: each look on a scratch character (_eyelooks, the v2female base), her left eye close under
//       the beauty light, into Content/Studio/Eyes/thumbs/<id>.jpg (kept in the project, as the creatures' are)
//   node tools/character/eyelooks.mjs make [--only v3] [--name NAME] [--base v2female|feminine|average|masculine]
//                                          [--hair STYLE] [--look "soft cinematic"] [--set JSON] [--shots DIR] [--variants FILE] [--export] [--again]
//       a character wearing an eye look (eyes_<id> unless --name), made from the defaults and saved; one that's there
//       already is opened and given the look again unless it's yours (--again starts it over). --hair: a hair editor
//       v2.0 style on it (daz_twin_tails: the reference's fringe and tails); --set: an eye look's own values changed
//       for this run ({"eyes": {...}, "shape": {...}, "sculpt": {...}, "lash": {...}, "makeup": {...}}: tuning);
//       --shots DIR: the Studio's own pictures of it (both eyes, one eye, the face) into DIR, and with --variants FILE
//       (a JSON of {tag: {eyes, shape, sculpt, lash, makeup}}) each of those worn over the look and pictured too; --export: Export for
//       Godot (People/<name>/export/<name>.glb and Exports/characters/<name>/<name>.glb, its face shapes baked)
//
// The Character Studio's server running (python tools/character/serve.py; BODY_URL for another port). On a machine with
// a graphics card: GPU=1 in front (tools/browser.cjs). Ends "EYELOOKPAGE ok".
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."), URL = process.env.BODY_URL || "http://127.0.0.1:8793/";
const args = process.argv.slice(2), mode = args[0], opt = k => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; }, has = k => args.includes(k);
if (mode !== "thumbs" && mode !== "make") { console.log("node tools/character/eyelooks.mjs thumbs | make [--only v3] [--name NAME] [--base v2female] [--hair STYLE] [--set JSON] [--shots DIR] [--export] [--again]"); process.exit(1); }
const EL = await import("./eyelooks.js"), only = (opt("--only") || "").split(",").filter(Boolean), keys = Object.keys(EL.EYE_LOOKS).filter(k => !only.length || only.includes(k));
if (only.some(k => !EL.EYE_LOOKS[k])) { console.log(`EYELOOKPAGE FAIL: no eye look named ${only.filter(k => !EL.EYE_LOOKS[k]).join(", ")} (there are: ${Object.keys(EL.EYE_LOOKS).join(", ")})`); process.exit(1); }
const browser = await req("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: opt("--shots") || mode === "thumbs" ? 2 : 1 })).newPage(); page.setDefaultTimeout(600000);   // (a busy software-drawn page answers late; the pictures at twice the size)
const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
page.on("console", m => { if (m.type() === "error" && /Shader Error/.test(m.text())) errs.push(m.text().slice(0, 400)); });   // (a shader that doesn't compile is a console error, and a black eye in the picture)
const B = (f, a) => page.evaluate(f, a), t0 = Date.now();
const settle = async () => {                             // the view's own word that it's composed, the face's fit not in flight
  await page.waitForFunction(() => /points/.test(document.querySelector("#hud").textContent) && !/finding|fitting/.test(document.querySelector("#status").textContent), null, { timeout: 600000 });
  await page.waitForTimeout(1500);
};
const fresh = async name => {                            // a character made (or started again) from the defaults, as New does
  await page.fill("#newName", name); await page.click("#make", { noWaitAfter: true });
  await page.waitForFunction(n => window.__body.who === n && /starts from the/.test(document.querySelector("#status").textContent), name, { timeout: 600000 });
  await settle();
};
const exists = async name => { await page.waitForFunction(() => document.querySelector("#who").options.length > 0, null, { timeout: 20000 }).catch(() => {});   // (the list comes a moment after the page)
  return B(n => [...document.querySelector("#who").options].some(o => o.value === n), name); };
const openIt = async name => { await page.selectOption("#who", name); await page.waitForFunction(n => window.__body.who === n, name, { timeout: 600000 }); await settle(); };
const base = async which => {                            // the base's button (v2female: the feminine base with its head and neck)
  const sel = { v2female: '.bases button[data-v2="1"]:not([data-b2])', bodyv2: '.bases button[data-b2="1"]', feminine: '.bases button[data-base="-1"]:not([data-v2])',
                average: '.bases button[data-base="0"]', masculine: '.bases button[data-base="1"]' }[which];
  if (!sel) throw new Error(`no base named ${which}`);
  await page.click(sel, { noWaitAfter: true }); await settle();
};
// the view on her eyes: the head from the front, panned and zoomed until `what` (both eyes, the face) sits in the clip:
// her eyes' middles a share of its width apart, their midpoint in its middle. Each step moves the view by what the
// last frame measured, so it's looped until it sits (a software-drawn page draws about a frame a second)
const frame = async (what, clip) => {
  const step = () => B(async ([what, cx, cy, cw, ch]) => { const b = window.__body, T = b.THREE, cam = b.camera, r = b.renderer.domElement.getBoundingClientRect();
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
    b.rig.updateMatrixWorld(true); cam.updateMatrixWorld(true);
    const eL = new T.Vector3(), eR = new T.Vector3(); b.EYES.L.getWorldPosition(eL); b.EYES.R.getWorldPosition(eR);
    const px = p => { const q = p.clone().project(cam); return [r.left + (q.x + 1) / 2 * r.width, r.top + (1 - q.y) / 2 * r.height]; };
    const A = px(eL), C = px(eR), gap = Math.hypot(A[0] - C[0], A[1] - C[1]) || 1, want = (what === "pair" ? 0.668 : what === "card" ? 0.5 : 0.3) * cw;
    const mid = eL.clone().add(eR).multiplyScalar(0.5); mid.y -= (what === "face" ? 0.03 : 0.002) * b.scale;
    const m = px(mid), depth = cam.position.distanceTo(mid), mpp = 2 * depth * Math.tan(cam.fov * Math.PI / 360) / r.height;
    const right = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const dx = m[0] - (cx + cw / 2), dy = m[1] - (cy + ch / 2), k = gap / want;
    b.orbit.pan.addScaledVector(right, dx * mpp).addScaledVector(up, -dy * mpp); b.orbit.zoom = Math.min(3, Math.max(0.03, b.orbit.zoom * k));
    return Math.max(Math.abs(dx), Math.abs(dy), Math.abs(gap - want));
  }, [what, clip.x, clip.y, clip.width, clip.height]);
  for (let i = 0; i < 8; i++) if (await step() < 1.5) break;
  await B(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))));   // drawn as it now stands
  await page.waitForTimeout(1200);
};
const view = async () => {                               // the head from the front, nothing drawn over it, under the beauty light
  await B(() => { const b = window.__body; document.querySelector("#handlesOn").checked = false; const h = document.querySelector("#viewHelp"); if (h) h.style.display = "none"; b.setPose("rest");
    document.querySelector("#lightSel").value = "beauty"; b.setLight("beauty"); });
  await page.click('#views button[data-v="head"]', { noWaitAfter: true }); await page.click('#views button[data-yaw="0"]', { noWaitAfter: true });
  await B(() => { const b = window.__body; b.orbit.pitch = 0; b.orbit.zoom = 1; b.orbit.pan.set(0, 0, 0); });
  await page.waitForTimeout(800);
};
const clipOf = async (aspect, wide = 760) => { const box = await page.locator("#view").boundingBox(), w = Math.min(box.width - 40, wide), h = Math.round(w / aspect);
  return { x: Math.round(box.x + (box.width - w) / 2), y: Math.round(box.y + 60), width: w, height: Math.min(h, box.height - 80) }; };
const jpeg = (png, wide) => B(async ([b64, wide]) => { const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();   // down to a card's size, in the page: no image tool needed
  const c = document.createElement("canvas"); c.width = wide; c.height = Math.round(wide * im.height / im.width); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.88).split(",")[1]; }, [png.toString("base64"), wide]);
const crop = (png, x, y, w, h) => B(async ([b64, x, y, w, h]) => { const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
  const c = document.createElement("canvas"); c.width = Math.round(w * im.width); c.height = Math.round(h * im.height); c.getContext("2d").drawImage(im, -Math.round(x * im.width), -Math.round(y * im.height));
  return c.toDataURL("image/png").split(",")[1]; }, [png.toString("base64"), x, y, w, h]);
const wear = async (k, set) => {                         // the eye look on the open character, a run's own values over it
  await B(([k, set]) => { const b = window.__body, L = b.EL.EYE_LOOKS[k];
    if (set) for (const part of ["eyes", "shape", "sculpt", "makeup"]) if (set[part]) L[part] = { ...(L[part] || {}), ...set[part] };
    if (set?.lash) L.lash = { ...(L.lash || {}), ...set.lash, set: { ...(L.lash?.set || {}), ...(set.lash.set || {}) } };
    b.useEyeLook(k, { shape: true, makeup: true }); }, [k, set]);
  await page.waitForTimeout(3500);
};
try {
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => window.__body && window.__body.SCULPT && window.__body.useEyeLook, null, { timeout: 600000 });
  if (mode === "thumbs") {
    const out = path.join(ROOT, "Content", "Studio", "Eyes", "thumbs"); fs.mkdirSync(out, { recursive: true });
    await fresh("_eyelooks"); await base("v2female"); await view();
    const clip = await clipOf(2);
    for (const k of keys) {
      await wear(k, null); await frame("card", clip);
      // her left eye cut out of the picture of both (a view any closer is inside the lens's reach): one eye fills a card,
      // where two side by side are too small to read
      const jpg = await jpeg(Buffer.from(await crop(await page.screenshot({ clip }), 0.6, 0.35, 0.3, 0.3), "base64"), 320);
      fs.writeFileSync(path.join(out, k + ".jpg"), Buffer.from(jpg, "base64"));
      console.log(`  ok  ${k}: ${path.relative(ROOT, path.join(out, k + ".jpg"))} (${Math.round(Buffer.from(jpg, "base64").length / 1024)} KB)`);
    }
  } else {
    const set = opt("--set") ? JSON.parse(opt("--set")) : null, shots = opt("--shots"), made = [];
    for (const k of keys) {
      const name = opt("--name") || "eyes_" + k, there = await exists(name), again = !there || has("--again");
      if (again) {
        await fresh(name); await base(opt("--base") || "v2female");
        if (opt("--look")) { await B(n => window.__body.useLook(n), opt("--look")); await page.waitForTimeout(2500); }
        if (opt("--hair")) await B(async style => { const b = window.__body; b.hair2.use(style, {}, true); await b.hair2.ready(); }, opt("--hair"));
      } else await openIt(name);
      await B(() => window.__body.setPose("rest"));
      await wear(k, set);
      await B(() => { document.querySelector("#status").textContent = ""; }); await page.click("#save", { noWaitAfter: true });
      await page.waitForFunction(() => /saved/.test(document.querySelector("#status").textContent), null, { timeout: 600000 });
      let said = `${name}: ${again ? "made" : "opened"}, wearing ${EL.EYE_LOOKS[k].label}, saved`;
      if (shots) {
        fs.mkdirSync(shots, { recursive: true }); await view();
        const picture = async tag => {                   // both eyes as the reference frames them, her left eye cut out of that picture (a view any closer is inside the lens's reach), the face
          const clip = await clipOf(1175 / 406); await frame("pair", clip);
          const png = await page.screenshot({ clip }); fs.writeFileSync(path.join(shots, `${tag}_pair.png`), png);
          fs.writeFileSync(path.join(shots, `${tag}_eye.png`), Buffer.from(await crop(png, 0.61, 0.0, 0.39, 1.0), "base64"));
        };
        await picture(name);
        const fclip = await clipOf(836 / 612); await frame("face", fclip); await page.screenshot({ clip: fclip, path: path.join(shots, `${name}_face.png`) });
        // a run's variants (--variants FILE: {"tag": {eyes, shape, sculpt, lash, makeup}, ...}): each worn over the look and pictured, nothing saved
        if (opt("--variants")) for (const [tag, vset] of Object.entries(JSON.parse(fs.readFileSync(opt("--variants"), "utf8")))) { await wear(k, vset); await picture(`${name}_${tag}`); console.log(`  ..  ${tag}`); }
        said += `; pictured into ${shots}`;
      }
      if (has("--export")) {
        await B(() => { document.querySelector("#status").textContent = ""; }); await page.click("#expPack", { noWaitAfter: true });
        await page.waitForFunction(() => /for Godot \(drag/.test(document.querySelector("#status").textContent) || document.querySelector("#status").className === "bad", null, { timeout: 3600000 });
        const word = await B(() => document.querySelector("#status").textContent);
        if (!/for Godot \(drag/.test(word)) throw new Error(`${name}: the export: ${word}`);
        const godot = ["Exports", path.join("Saved", "Exports")].map(d => path.join(ROOT, d, "characters", name, name + ".glb")).find(f => fs.existsSync(f));
        said += `; exported${godot ? `: ${path.relative(ROOT, godot)} (${Math.round(fs.statSync(godot).size / 1e6)} MB)` : ""}`;
      }
      console.log("  ok  " + said); made.push(name);
    }
  }
  if (errs.length) throw new Error("page errors: " + errs.slice(0, 3).join(" | "));
} catch (e) {
  console.log("EYELOOKPAGE FAIL: " + e.message); await browser.close(); process.exit(1);
}
await browser.close();
console.log(`EYELOOKPAGE ok (${mode}, ${keys.length}, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);

// The creature presets (grow.js MONSTERS; the Body tab's cards; DECISIONS 2026-11-11: "add presets for the monster-ish
// shapes you made so I can use them"), driven in the Character Studio's own page in a headless browser:
//
//   node tools/character/creatures.mjs thumbs [--only goblin,ogre]
//       the cards' pictures: each creature with its look on a scratch character (_creatures), its head pictured into
//       Content/Studio/Creatures/thumbs/<id>.jpg (kept in the project, as the outfits' are)
//   node tools/character/creatures.mjs make [--only goblin,ogre] [--prefix creature_] [--export] [--shape] [--again]
//       each creature as a character of its own (creature_goblin ...), made from its preset and saved; one that's
//       there already is left as it is (it may be yours by now) unless --again; --export: also Export for Godot
//       (People/<name>/export/<name>.glb and Exports/characters/<name>/<name>.glb, its face shapes baked), ready to
//       drop into a Godot project; --shape: its shape and teeth without its look
//
// The Character Studio's server running (python tools/character/serve.py; BODY_URL for another port). On a machine with
// a graphics card: GPU=1 in front (tools/browser.cjs). Ends "CREATURES ok".
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."), URL = process.env.BODY_URL || "http://127.0.0.1:8793/";
const args = process.argv.slice(2), mode = args[0], opt = k => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; }, has = k => args.includes(k);
if (mode !== "thumbs" && mode !== "make") { console.log("node tools/character/creatures.mjs thumbs | make [--only a,b] [--prefix creature_] [--export] [--shape] [--again]"); process.exit(1); }
const GW = await import("./grow.js"), only = (opt("--only") || "").split(",").filter(Boolean), keys = Object.keys(GW.MONSTERS).filter(k => !only.length || only.includes(k));
if (only.some(k => !GW.MONSTERS[k])) { console.log(`CREATURES FAIL: no creature named ${only.filter(k => !GW.MONSTERS[k]).join(", ")} (there are: ${Object.keys(GW.MONSTERS).join(", ")})`); process.exit(1); }
const browser = await req("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1300, height: 900 } })).newPage(); page.setDefaultTimeout(300000);   // (a busy software-drawn page answers late)
const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
const B = (f, a) => page.evaluate(f, a), t0 = Date.now();
const settle = async () => {                             // the view's own word that it's composed, the face's fit not in flight
  await page.waitForFunction(() => /points/.test(document.querySelector("#hud").textContent) && !/finding|fitting/.test(document.querySelector("#status").textContent), null, { timeout: 300000 });
  await page.waitForTimeout(1500);
};
const fresh = async name => {                            // a character made (or started again) from the defaults, as New does
  await page.fill("#newName", name); await page.click("#make", { noWaitAfter: true });
  await page.waitForFunction(n => window.__body.who === n && /starts from the/.test(document.querySelector("#status").textContent), name, { timeout: 300000 });
  await settle();
};
const exists = name => B(n => [...document.querySelector("#who").options].some(o => o.value === n), name);
const openIt = async name => { await page.selectOption("#who", name); await page.waitForFunction(n => window.__body.who === n, name, { timeout: 300000 }); await settle(); };
try {
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => window.__body && window.__body.SCULPT, null, { timeout: 300000 });
  if (mode === "thumbs") {
    const out = path.join(ROOT, "Content", "Studio", "Creatures", "thumbs"); fs.mkdirSync(out, { recursive: true });
    await fresh("_creatures");
    await B(() => { document.querySelector("#handlesOn").checked = false; const h = document.querySelector("#viewHelp"); if (h) h.style.display = "none"; window.__body.setPose("rest"); });
    await page.click('#views button[data-v="head"]', { noWaitAfter: true }); await page.click('#views button[data-yaw="35"]', { noWaitAfter: true });
    const box = await page.locator("#view").boundingBox(), w = Math.min(box.width - 300, 560), h = Math.min(Math.round(w * 1.25), box.height - 50);
    const clip = { x: Math.round(box.x + (box.width - w) / 2), y: Math.round(box.y + 46), width: w, height: h };
    // the head and what it wears (its ears, its horns) fitted into the card: the points within a head of the head's
    // middle and the accessories' own, seen through the view's camera; the view's zoom and pan moved until they sit in
    // the card's middle and fill it (twice: the pan moves the camera, so the first fit is a little off)
    const fit = () => B(async ([cx, cy, cw, ch]) => { const b = window.__body, T = b.THREE, cam = b.camera, r = b.renderer.domElement.getBoundingClientRect();
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));      // (the view's camera where its zoom and pan now put it)
      b.rig.updateMatrixWorld(true); cam.updateMatrixWorld(true);
      const P = b.POS, chin = b.lmk(152); let top = 0; for (let i = 1; i < P.length / 3; i++) if (P[i * 3 + 1] > P[top * 3 + 1]) top = i;
      const crown = [P[top * 3], P[top * 3 + 1], P[top * 3 + 2]], mid = [0, 1, 2].map(a => (chin[a] + crown[a]) / 2), H = Math.hypot(...[0, 1, 2].map(a => crown[a] - chin[a])), R = 0.72 * H;
      const pts = []; for (let i = 0; i < P.length; i += 3) if (Math.hypot(P[i] - mid[0], P[i + 1] - mid[1], P[i + 2] - mid[2]) < R) pts.push(new T.Vector3(P[i], P[i + 1], P[i + 2]).applyMatrix4(b.rig.matrixWorld));
      b.WEAR.group.traverse(o => { if (!o.isMesh || !o.visible) return; const g = o.geometry.attributes.position; for (let i = 0; i < g.count; i += 7) pts.push(new T.Vector3().fromBufferAttribute(g, i).applyMatrix4(o.matrixWorld)); });
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const mean = new T.Vector3();
      for (const p of pts) { const q = p.clone().project(cam), x = r.left + (q.x + 1) / 2 * r.width, y = r.top + (1 - q.y) / 2 * r.height; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      // the card's middle in the world, at the head's depth: where the box's middle should be seen; and how much bigger the box may be
      const k = Math.max((x1 - x0) / (cw * 0.84), (y1 - y0) / (ch * 0.84)), depth = cam.position.distanceTo(new T.Vector3(...mid).applyMatrix4(b.rig.matrixWorld));
      const px = 2 * depth * Math.tan(cam.fov * Math.PI / 360) / r.height;                       // metres a pixel there
      const right = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const dx = ((x0 + x1) / 2 - (cx + cw / 2)) * px, dy = ((y0 + y1) / 2 - (cy + ch / 2)) * px;
      b.orbit.pan.addScaledVector(right, dx).addScaledVector(up, -dy); b.orbit.zoom = Math.min(3, Math.max(0.06, b.orbit.zoom * k));
      return { k, dx, dy, n: pts.length }; }, [clip.x, clip.y, clip.width, clip.height]);
    for (const k of keys) {
      await B(k => { const b = window.__body; b.useCreature(k, { look: true }); b.orbit.zoom = 1; b.orbit.pan.set(0, 0, 0); }, k);
      await page.waitForTimeout(3000);
      for (let i = 0; i < 3; i++) await fit();
      await page.waitForTimeout(2000);
      const png = await page.screenshot({ clip });
      // down to a card's size (280 px wide) as a JPEG, in the page: no image tool needed
      const jpg = await B(async b64 => { const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
        const c = document.createElement("canvas"); c.width = 280; c.height = Math.round(280 * im.height / im.width); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        return c.toDataURL("image/jpeg", 0.86).split(",")[1]; }, png.toString("base64"));
      fs.writeFileSync(path.join(out, k + ".jpg"), Buffer.from(jpg, "base64"));
      console.log(`  ok  ${k}: ${path.relative(ROOT, path.join(out, k + ".jpg"))} (${Math.round(Buffer.from(jpg, "base64").length / 1024)} KB)`);
    }
  } else {
    const prefix = opt("--prefix") || "creature_", look = !has("--shape"), made = [];
    for (const k of keys) {
      const name = prefix + k, there = await exists(name), again = !there || has("--again");
      if (again) {
        await fresh(name);
        await B(([k, look]) => { const b = window.__body; b.setPose("rest"); b.useCreature(k, { look }); }, [k, look]);
        await page.waitForTimeout(2500);
        await B(() => { document.querySelector("#status").textContent = ""; }); await page.click("#save", { noWaitAfter: true });
        await page.waitForFunction(() => /saved/.test(document.querySelector("#status").textContent), null, { timeout: 300000 });
      } else await openIt(name);                         // (yours by now: left as it is; --again makes it again from the preset)
      const st = await B(() => { const b = window.__body, P = b.POS; let lo = 1e9, hi = -1e9, nan = 0; for (let i = 0; i < P.length; i++) { if (!Number.isFinite(P[i])) nan++; if (i % 3 === 1) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); } }
        return { h: b.st.height, tall: hi - lo, nan, creature: b.st.creature, tone: b.st.skin.tone, horns: b.st.accessories.filter(a => a.kind === "horns").length }; });
      if (st.nan || (again && (Math.abs(st.tall - st.h) > 0.01 || st.creature !== k))) throw new Error(`${name}: ${JSON.stringify(st)}`);
      let said = again ? `${name}: saved (${st.h} m${look ? `, skin ${st.tone}${st.horns ? ", horns" : ""}` : ", its shape alone"})` : `${name}: there already, left as it is (--again makes it again from the preset)`;
      if (has("--export")) {
        await B(() => { document.querySelector("#status").textContent = ""; }); await page.click("#expPack", { noWaitAfter: true });
        // (the page says "wrote People/... ; for Godot…" when the Studio's own file is written, then "... for Godot (drag ...)" once the copy with its face shapes baked is made: that second one)
        await page.waitForFunction(() => /for Godot \(drag/.test(document.querySelector("#status").textContent) || document.querySelector("#status").className === "bad", null, { timeout: 1800000 });
        const word = await B(() => document.querySelector("#status").textContent);
        if (!/for Godot \(drag/.test(word)) throw new Error(`${name}: the export: ${word}`);
        const godot = ["Exports", path.join("Saved", "Exports")].map(d => path.join(ROOT, d, "characters", name, name + ".glb")).find(f => fs.existsSync(f));
        said += `; exported${godot ? `: ${path.relative(ROOT, godot)} (${Math.round(fs.statSync(godot).size / 1e6)} MB)` : ""}`;
      }
      console.log("  ok  " + said); made.push(name);
    }
    console.log(`       ${made.length} characters in Content/Studio/People${has("--export") ? ", their Godot copies in Exports/characters (python tools/godot_byhand.py exports <your project> brings them in)" : ""}`);
  }
  if (errs.length) throw new Error("page errors: " + errs.slice(0, 3).join(" | "));
} catch (e) {
  console.log("CREATURES FAIL: " + e.message); await browser.close(); process.exit(1);
}
await browser.close();
console.log(`CREATURES ok (${mode}, ${keys.length}, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);

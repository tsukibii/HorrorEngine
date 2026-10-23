// The Character Studio (tools/character/index.html) in a headless browser: MHR loads with its 45 sliders; a scratch character;
// the feminine base and a shape slider move the body, the height scales it; a front picture (the page's own head from
// the front, so no one's photo is needed) bends the face and nothing under the neck; a side picture (the head at 3/4)
// is taken for the depth; the expressions: a preset moves only the face, the ARKit map routes a blink onto
// eyesClosed (not a look), the eyeballs sit either side; the skin is made from the front picture and worn; the procedural
// skin takes over the body with the photo on the face through its mask, and its features change the picture; pants are made to the body and worn;
// the Hair tab is the salon on this character (its body saved for it), brows and lashes switch in the Face tab;
// the head OBJ exports; the pictures clear and the face goes. Ends "STUDIO ok".
//
//   python tools/face_mesh.py setup, python tools/garment.py setup, python tools/retarget.py setup   (once)
//   python tools/character/serve.py              (in another shell)
//   node tools/character/studiotest.js [shot.png]
//
// Needs Playwright (npm i playwright, or PLAYWRIGHT=<path to its package>).
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const BASE = process.env.BODY_URL || "http://127.0.0.1:8793/";
const NAME = "_studiotest";
const shot = process.argv[2];
const fail = m => { console.error("STUDIO FAIL: " + m); process.exit(1); };

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("dialog", d => d.accept());                   // "start it again from the defaults?", "remove?"
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { await page.screenshot({ path: shot || "studiotest_fail.png" }); fail(`${what}: ${e.message}`); } };
  const sample = () => page.evaluate(() => { const P = window.__body.POS; let s = 0, top = -1e9; for (let i = 0; i < P.length; i += 3) { s += P[i] * 7 + P[i + 2] * 3; top = Math.max(top, P[i + 1]); } return { s, top }; });
  const below = () => page.evaluate(() => {                 // how far the face moved anything under the neck
    const b = window.__body, d = b.delta; if (!d) return 0;
    let m = 0; for (let j = 0; j < d.idx.length; j++) { const i = d.idx[j]; if (b.POS[i * 3 + 1] < b.st.height * 0.78) m = Math.max(m, Math.abs(d.d[j * 3]) + Math.abs(d.d[j * 3 + 1]) + Math.abs(d.d[j * 3 + 2])); }
    return m;
  });
  const headShot = async yaw => {
    await page.click('#views button[data-v="head"]'); await page.click(`#views button[data-yaw="${yaw}"]`);
    await page.waitForTimeout(400);
    // the canvas's box, not its element: with the skin shader a software-rendered frame is slow, and the element shot waits for still frames
    const clip = await page.evaluate(() => { const r = document.querySelector("#view canvas").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    return page.screenshot({ clip, timeout: 120000 });
  };
  await page.goto(BASE);

  await step("MHR loads with its sliders and labels", async () => {
    await page.waitForFunction(() => window.__body && window.__body.N > 10000, null, { timeout: 60000 });
    const rows = await page.$$("#shapeRows .row");
    if (rows.length !== 45) throw new Error(`${rows.length} shape sliders`);
    const label = await page.textContent("#shapeRows .row span");
    if (!/: \w/.test(label)) throw new Error(`no label: ${label}`);
  });
  await step("a new character", async () => {
    // a run that stopped early leaves its pictures behind (the last step clears them): clear them first
    await page.evaluate(n => Promise.all(["front", "side"].map(s => fetch(`api/picture/${n}/${s}/png`, { method: "POST", body: "" }))), NAME);
    await page.fill("#newName", NAME); await page.click("#make");
    await page.waitForFunction(n => window.__body.who === n, NAME);
  });
  let a, front, side;
  await step("the base and a slider move the body; the height scales it", async () => {
    a = await sample();
    await page.click('.bases button[data-base="-1"]');
    const b = await sample();
    if (Math.abs(b.s - a.s) < 1e-3) throw new Error("the feminine base didn't move the body");
    await page.$eval("#shapeRows .row input", i => { i.value = +i.value > 0 ? -2 : 2; i.dispatchEvent(new Event("input")); });
    const c = await sample();
    if (Math.abs(c.s - b.s) < 1e-3) throw new Error("shape 0 didn't move the body");
    await page.$$eval("#baseRows input", ins => { ins[1].value = 1.6; ins[1].dispatchEvent(new Event("input")); });
    const d = await sample();
    if (Math.abs(d.top - 1.6) > 0.005) throw new Error(`height ${d.top}`);
  });
  await step("a front picture bends the face, not the body", async () => {
    front = await headShot("0"); side = await headShot("35");
    await page.setInputFiles("#slots .slot:nth-child(1) input", { name: "front.png", mimeType: "image/png", buffer: front });
    await page.waitForFunction(() => window.__body.delta && window.__body.report && window.__body.report.used === 1, null, { timeout: 90000 });
    const m = await below();
    if (m > 1e-9) throw new Error(`moved ${m} under the neck`);
  });
  await step("a side picture gives the depth", async () => {
    await page.setInputFiles("#slots .slot:nth-child(2) input", { name: "side.png", mimeType: "image/png", buffer: side });
    await page.waitForFunction(() => window.__body.report && window.__body.report.sides === 1, null, { timeout: 90000 });
  });
  await step("expressions: a preset moves the face only; the map sends a blink to eyesClosed", async () => {
    await page.click('#tabs button[data-tab="expr"]');
    const before = await page.evaluate(() => Array.from(window.__body.POS));
    await page.click('#exprPresets button[title^="mouthSmile"]');
    const moved = await page.evaluate(b => { const P = window.__body.POS, h = window.__body.st.height; let face = 0, body = 0;
      for (let i = 0; i < P.length; i += 3) { const d = Math.abs(P[i] - b[i]) + Math.abs(P[i + 1] - b[i + 1]) + Math.abs(P[i + 2] - b[i + 2]); if (P[i + 1] > h * 0.85) face = Math.max(face, d); else body = Math.max(body, d); }
      return { face, body }; }, before);
    if (moved.face < 0.002) throw new Error(`the smile moved the face ${moved.face} m`);
    if (moved.body > 5e-4) throw new Error(`the smile moved the body ${moved.body} m`);   // MHR's shapes reach the upper neck a little
    const w = await page.evaluate(() => { const b = window.__body, w = b.fromArkit({ eyeBlinkLeft: 1 }); return Object.fromEntries(b.ENAMES.map((n, i) => [n, w[i]]).filter(x => x[1])); });
    if (JSON.stringify(w) !== JSON.stringify({ eyesClosed_L: 1 })) throw new Error("eyeBlinkLeft maps to " + JSON.stringify(w));
    const eyes = await page.evaluate(() => { const E = window.__body.EYES; return [E.L.visible, E.R.visible, E.L.position.x, E.R.position.x]; });
    if (!eyes[0] || !eyes[1] || !(eyes[2] > 0.01 && eyes[3] < -0.01)) throw new Error("the eyeballs aren't in place: " + eyes);
    await page.click("#exprClear");
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("the skin from the front picture: a texture, worn", async () => {
    await page.click('#tabs button[data-tab="skin"]');
    await page.click("#photoSkin button");
    await page.waitForFunction(() => window.__body.skin && window.__body.material.map === window.__body.skin, null, { timeout: 90000 });
    const st = await page.textContent("#status");
    if (!/skin: .*skin\.png/.test(st)) throw new Error(st);
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("procedural skin: made in the shader, the photo through its mask on the face; a feature changes the picture", async () => {
    await page.click('#tabs button[data-tab="skin"]');
    await page.waitForFunction(() => window.__body.skinMask, null, { timeout: 30000 });
    await page.click("#procRows label.tog input");
    await page.waitForFunction(() => window.__body.SKU.uProc.value === 1 && window.__body.SKU.uHasPhoto.value === 1 && window.__body.material.map === null, null, { timeout: 10000 });
    const a = await headShot(0);
    await page.evaluate(() => { const i = document.querySelector("#procRows .row input[type=range]"); i.value = 1; i.dispatchEvent(new Event("input")); });   // mottling all the way
    await page.evaluate(() => { const r = [...document.querySelectorAll("#procRows .row")].find(x => x.textContent.startsWith("Freckles")); const i = r.querySelector("input"); i.value = 1; i.dispatchEvent(new Event("input")); });
    const b = await headShot(0);
    if (Buffer.compare(a, b) === 0) throw new Error("the features don't change the picture");
    await page.click('#tabs button[data-tab="skin"]');
    await page.click("#procRows label.tog input");                         // back off for the rest
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("touch-up: a stroke across the lips shows, undo takes it back, saved as two pictures", async () => {
    // the frame isn't still while the wig swings: measure the mouth (no hair over it) and the paint layer itself
    await page.click('#tabs button[data-tab="skin"]');
    const a = await headShot(0);
    const mouth = await page.evaluate(() => {
      const r = document.querySelector("#view canvas").getBoundingClientRect(), p = [61, 291, 0, 17].map(i => window.__body.onScreen(i));
      const xs = p.map(q => q[0] - r.left), ys = p.map(q => q[1] - r.top);
      return { x: Math.round(Math.min(...xs)), y: Math.round(Math.min(...ys)) - 2, w: Math.round(Math.max(...xs) - Math.min(...xs)), h: Math.round(Math.max(...ys) - Math.min(...ys)) + 4 };
    });
    const red = png => page.evaluate(async ([b64, m]) => {                 // red over green, averaged over the mouth
      const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
      const d = g.getImageData(m.x, m.y, Math.max(1, m.w), Math.max(1, m.h)).data; let s = 0;
      for (let i = 0; i < d.length; i += 4) s += d[i] - d[i + 1];
      return s / (d.length / 4);
    }, [png.toString("base64"), mouth]);
    const layer = () => page.evaluate(() => { const g = window.__body.TOUCH.pg.getImageData(0, 0, 2048, 2048).data; let s = 0; for (let i = 3; i < g.length; i += 4) s += g[i]; return s; });
    const alpha0 = await layer();
    await page.click("#touchRows label.tog input");
    await page.evaluate(() => { const c = document.querySelector("#touchRows input[type=color]"); c.value = "#d0203a"; c.dispatchEvent(new Event("input")); });
    const [x0, y0] = await page.evaluate(() => window.__body.onScreen(61)), [x1, y1] = await page.evaluate(() => window.__body.onScreen(291));   // the mouth's corners
    await page.mouse.move(x0, y0); await page.mouse.down();
    for (let i = 1; i <= 4; i++) await page.mouse.move(x0 + (x1 - x0) * i / 4, y0 + (y1 - y0) * i / 4);
    await page.mouse.up();
    const ra = await red(a), rb = await red(await headShot(0));
    if (!(rb > ra + 3)) throw new Error(`the paint doesn't show on the mouth (red ${ra.toFixed(1)} -> ${rb.toFixed(1)})`);
    await page.click("#touchUndo");
    const rc = await red(await headShot(0));
    if (await layer() !== alpha0 || Math.abs(rc - ra) > 1.5) throw new Error(`undo doesn't take the stroke back (red ${ra.toFixed(1)} -> ${rc.toFixed(1)})`);
    await page.click("#touchSave");
    await page.waitForFunction(() => document.querySelector("#touchSave").textContent === "Saved", null, { timeout: 60000 });
    for (const k of ["paint", "touch"]) {
      const ok = await page.evaluate(async k => (await fetch(`api/skin/${encodeURIComponent(window.__body.who)}?${k}=1`)).ok, k);
      if (!ok) throw new Error(`skin_${k}.png wasn't saved`);
    }
    await page.click("#touchRows label.tog input");                        // painting off for the rest
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("clothes: pants made to this body, draped, worn", async () => {
    await page.click('#tabs button[data-tab="clothes"]');
    await page.waitForFunction(() => document.querySelectorAll("#clothesRows select option").length > 0);
    await page.selectOption("#clothesRows select", "pants");
    await page.click("#clothesRows button");
    await page.waitForFunction(() => window.__body.garments.has("pants"), null, { timeout: 180000 });
    const st = await page.textContent("#status");
    if (!/pants: \d+ points, seams within/.test(st)) throw new Error(st);
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("hair is the salon: the Hair tab opens it on this character, with this body; brows and lashes switch in the Face tab", async () => {
    await page.click('#tabs button[data-tab="hair"]');
    await page.waitForFunction(n => {
      const f = document.querySelector("#salonFrame");
      return !f.hidden && document.querySelector("main").hidden && f.src.includes("person=" + encodeURIComponent(n)) && f.contentWindow.__salon && f.contentWindow.__salon.ready;
    }, NAME, { timeout: 180000 });
    const s = await page.evaluate(() => { const w = document.querySelector("#salonFrame").contentWindow; return { person: w.__salon.PERSON && w.__salon.PERSON.name, embed: w.document.body.classList.contains("embed-person"), bald: w.__salon.st.locks.length }; });
    if (s.person !== NAME || !s.embed) throw new Error("the salon in the Hair tab: " + JSON.stringify(s));
    const body = await page.evaluate(async n => (await fetch(`api/people/${encodeURIComponent(n)}/body.bin`)).ok, NAME);
    if (!body) throw new Error("the Hair tab didn't save the body for the salon");
    await page.click('#tabs button[data-tab="face"]');
    if (await page.evaluate(() => document.querySelector("main").hidden || !document.querySelector("#salonFrame").hidden)) throw new Error("the studio didn't come back from the salon");
    const before = await page.evaluate(() => window.__body.hair ? window.__body.hair.brows.position.length : 0);
    await page.click("#browRows label.tog >> nth=0"); await page.click("#browRows label.tog >> nth=1");   // brows and lashes off
    await page.waitForFunction(() => !window.__body.st.hair.brows && !window.__body.st.hair.lashes, null, { timeout: 10000 });
    await page.click("#browRows label.tog >> nth=0"); await page.click("#browRows label.tog >> nth=1");   // and back on
    if (!before) throw new Error("no brows or lashes grown");
    console.log(`       the salon on ${s.person} (${s.bald} locks: ${s.bald ? "its own hair" : "bald"}); brows and lashes ${before / 3} points`);
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("the eye plane: the lids' points picked in Layers, used as the eye plane; the shell stays, the eyeball goes inside the head, its paint on the shell; Clear sinks the shell again", async () => {
    await page.click('#tabs button[data-tab="skin"]');
    await page.evaluate(() => [...document.querySelectorAll("#eyeRows button")].find(b => b.textContent === "Start from the lids").click());
    await page.waitForFunction(() => !document.querySelector('section[data-tab="layers"]').hidden && window.__body.LAY.layers.count() > 0, null, { timeout: 10000 });
    await page.evaluate(() => document.querySelector("#eyePlaneLay button").click());
    const on = await page.evaluate(() => { const b = window.__body, p = b.st.eyes.plane, z = Math.max(...p.map(v => b.POS[v * 3 + 2]));
      return { n: p.length, left: p.filter(v => b.POS[v * 3] > 0).length, on: b.SKU.uEyeOn.value, ball: b.EYES.L.visible, front: z - b.EYES.L.position.z, r: b.EYES.L.scale.x, count: document.querySelector("#planeCount").textContent }; });
    if (!on.n || !on.left || on.left === on.n || on.on !== 1 || on.ball || !(on.front > on.r)) throw new Error("the eye plane: " + JSON.stringify(on));
    await page.evaluate(() => { document.querySelector("#laySelect").checked && document.querySelector("#laySelect").click(); window.__body.LAY.layers.clear(); window.__body.LAY.showSel(); });
    await page.click('#tabs button[data-tab="skin"]');
    await page.evaluate(() => [...document.querySelectorAll("#eyeRows button")].find(b => b.textContent === "Clear").click());
    const off = await page.evaluate(() => ({ n: window.__body.st.eyes.plane.length, on: window.__body.SKU.uEyeOn.value, ball: window.__body.EYES.L.visible }));
    if (off.n || off.on || !off.ball) throw new Error("the eye plane cleared: " + JSON.stringify(off));
    console.log(`       ${on.count}; the shell ${(on.front * 1000).toFixed(1)} mm in front of the eyeball's centre (radius ${(on.r * 1000).toFixed(1)} mm)`);
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("the head OBJ exports", async () => {
    await page.click("#expHead");
    await page.waitForFunction(() => /wrote .*_studiotest_head\.obj/.test(document.querySelector("#status").textContent), null, { timeout: 30000 });
  });
  if (shot) await page.screenshot({ path: shot });
  await step("cleared pictures take the face away", async () => {
    await page.click('#tabs button[data-tab="face"]');
    // the button itself: by now a software-rendered frame (wig, strands, clothes) is too slow for the pointer's wait for still frames
    for (let n; (n = await page.$$eval("#slots .slot .x", x => x.length)) > 0;) {    // one at a time: the slots redraw after each
      await page.$eval("#slots .slot .x", b => b.click());
      await page.waitForFunction(n => document.querySelectorAll("#slots .slot .x").length < n, n, { timeout: 60000 });
    }
    await page.waitForFunction(() => !window.__body.delta && window.__body.pics.length === 0, null, { timeout: 60000 });
  });
  if (errors.length) fail("page errors: " + errors.join(" | "));
  await browser.close();
  console.log("STUDIO ok");
})();

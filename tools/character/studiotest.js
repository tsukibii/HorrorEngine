// The Character Studio (tools/character/index.html) in a headless browser: MHR loads with its 45 sliders; a scratch character;
// the feminine base and a shape slider move the body, the height scales it; a front picture (the page's own head from
// the front, so no one's photo is needed) bends the face and nothing under the neck; a side picture (the head at 3/4)
// is taken for the depth; the expressions: a preset moves only the face, the ARKit map routes a blink onto
// eyesClosed (not a look), the eyeballs sit either side; the skin is made from the front picture and worn; the procedural
// skin takes over the body with the photo on the face through its mask, and its features change the picture; the work uniform
// is cut from the body and worn, and refits when the body grows;
// a twin-tail wig (clumps with physics) settles off the head and shoulders, survives a shake and exports its chains,
// the grown cards still grow; brows and lashes; strands from elsewhere (a stand-in) batched into clumps,
// rebuilt from guide chains on the GPU, off the body through a shake; the head OBJ exports; the pictures clear and the face goes. Ends "STUDIO ok".
//
//   python tools/face_mesh.py setup, python tools/retarget.py setup   (once)
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
  await step("clothes: the work uniform cut from this body and worn; a taller body refits it", async () => {
    await page.click('#tabs button[data-tab="clothes"]');
    await page.waitForFunction(() => document.querySelectorAll("#clothesRows select option").length > 2);
    await page.selectOption("#clothesRows select >> nth=0", "work uniform");
    await page.click("#clothesRows >> text=Wear the outfit");
    await page.waitForFunction(() => window.__body.GARMENTS.children.length > 3, null, { timeout: 120000 });
    const top = () => page.evaluate(() => { let t = -1e9; for (const m of window.__body.GARMENTS.children) { const P = m.geometry.attributes.position.array; for (let i = 1; i < P.length; i += 3) t = Math.max(t, P[i]); } return t; });
    const was = await top(), h = await page.evaluate(() => window.__body.st.height);
    await page.$$eval("#baseRows input", (ins, v) => { ins[1].value = v; ins[1].dispatchEvent(new Event("input")); }, h + 0.1);
    await page.waitForFunction(w => { let t = -1e9; for (const m of window.__body.GARMENTS.children) { const P = m.geometry.attributes.position.array; for (let i = 1; i < P.length; i += 3) t = Math.max(t, P[i]); } return t > w + 0.04; }, was, { timeout: 120000 });
    await page.$$eval("#baseRows input", (ins, v) => { ins[1].value = v; ins[1].dispatchEvent(new Event("input")); }, h);
    await page.waitForFunction(w => { let t = -1e9; for (const m of window.__body.GARMENTS.children) { const P = m.geometry.attributes.position.array; for (let i = 1; i < P.length; i += 3) t = Math.max(t, P[i]); } return Math.abs(t - w) < 0.01; }, was, { timeout: 120000 });
    await page.click("#worn button");                                       // the shirt off, the trousers stay
    await page.waitForFunction(() => window.__body.st.clothes.length === 1 && window.__body.GARMENTS.children.every(m => m.name.startsWith("work-trousers")), null, { timeout: 120000 });
    await page.click("#worn button");
    await page.waitForFunction(() => window.__body.GARMENTS.children.length === 0);
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("hair: a twin-tail wig settles off the head and shoulders, survives a shake, exports its chains; grown cards too", async () => {
    await page.click('#tabs button[data-tab="hair"]');
    await page.selectOption("#hairRows select >> nth=1", "style");
    await page.selectOption("#hairRows select >> nth=0", "twin");
    await page.waitForFunction(() => window.__body.wig && window.__body.st.hair.style === "twin", null, { timeout: 30000 });
    await page.waitForTimeout(2500);
    const m = () => page.evaluate(() => window.__body.wig.measure(window.__body.rig.matrix.clone().invert().elements));
    const a = await m();
    if (a.clumps < 100 || a.nan || a.inside_pct > 2 || !(a.drift_mm < 80)) throw new Error("settled " + JSON.stringify(a));
    await page.selectOption("#hairRows select >> nth=2", "shake"); await page.waitForTimeout(2500);
    const b = await m();
    await page.selectOption("#hairRows select >> nth=2", "still");
    if (b.nan || b.inside_pct > 3) throw new Error("shaken " + JSON.stringify(b));
    const brows = await page.evaluate(() => window.__body.hair.brows.index.length);
    if (!brows) throw new Error("no brows");
    await page.click("#hairRows > button >> text=Export hair OBJ");
    await page.waitForFunction(() => /wrote .*_studiotest_hair\.obj and the wig's chains/.test(document.querySelector("#status").textContent), null, { timeout: 30000 });
    await page.click("#hairRows > label.tog >> nth=0");                    // the wig off: cards grown from the scalp (the model box has its own switches)
    await page.waitForFunction(() => !window.__body.st.hair.wig && window.__body.hair.report.cards > 500 && window.__body.hair.report.inside_pct < 2, null, { timeout: 30000 });
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("strand hair: strands from elsewhere batched into clumps, rebuilt on the GPU from guide chains, off the body, through a shake", async () => {
    // a stand-in for strands made elsewhere: dense strands grown by hair.js on this body, 32 points each
    const pts = await page.evaluate(async () => {
      const H = await import("./hair.js"), b = window.__body;
      const r = H.grow(b.POS, b.TRIS, b.lmk, b.scale, { style: "long", cards: 3000, guidesOnly: true });
      return r.strands.map(s => s.pts);
    }).catch(() => null);
    if (!pts) throw new Error("no stand-in strands");
    const P = 32, flat = new Float32Array(pts.length * P * 3);
    pts.forEach((s, i) => { for (let j = 0; j < P; j++) { const k = Math.min(s.length - 1, Math.round(j * (s.length - 1) / (P - 1))); flat.set(s[k], (i * P + j) * 3); } });
    await page.evaluate(async ([who, data]) => { await fetch(`api/hair/${who}/strands?points=32`, { method: "POST", body: new Float32Array(data) }); }, [NAME, Array.from(flat)]);
    await page.click('#tabs button[data-tab="hair"]');
    await page.evaluate(() => { window.__body.st.hair.batch = { clumps: 128, strands: 3000 }; });
    await page.selectOption("#hairRows select >> nth=1", "photo");
    await page.click("#hairRows button >> text=Batch again");
    await page.waitForFunction(() => /strands: \d+ drawn on \d+ clumps/.test(document.querySelector("#status").textContent), null, { timeout: 120000 });
    await page.waitForFunction(() => window.__body.strands && window.__body.strands.ready, null, { timeout: 30000 });
    await page.waitForTimeout(2000);
    const m = () => page.evaluate(() => window.__body.strands.measure(window.__body.rig.matrix.clone().invert().elements));
    const a = await m();
    if (a.nan || a.inside_pct > 2 || a.clumps !== 128) throw new Error("settled " + JSON.stringify(a));
    await page.selectOption("#hairRows select >> nth=2", "shake"); await page.waitForTimeout(2000);
    const b = await m(); await page.selectOption("#hairRows select >> nth=2", "still");
    if (b.nan || b.inside_pct > 3) throw new Error("shaken " + JSON.stringify(b));
    await page.selectOption("#hairRows select >> nth=1", "style");
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("hair library: the hairstyles shown, the front picture matched (skipped without a library)", async () => {
    const has = await page.evaluate(async () => (await fetch("api/hairlib/index.json")).ok);
    if (!has) return;                                   // python tools/perm.py setup, then library
    const front = await page.evaluate(() => window.__body.pics.some(p => p.name.startsWith("front.")));
    await page.click('#tabs button[data-tab="hair"]');
    await page.selectOption("#hairRows select >> nth=1", "photo");
    await page.waitForFunction(() => document.querySelectorAll(".hairlib div").length > 0, null, { timeout: 10000 });
    await page.click(".hairlib div >> nth=0");
    if (!(await page.evaluate(() => Object.keys(window.__body.st.hair.blend.weights).length === 1))) throw new Error("a click didn't pick a hairstyle");
    if (front) {
      await page.click("#hairRows button:has-text('Match the front picture')");
      await page.waitForFunction(() => /closest:/.test(document.querySelector("#status").textContent), null, { timeout: 60000 });
    }
    await page.selectOption("#hairRows select >> nth=1", "style");
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("a hair model as a wig: centimetres scaled, fitted by the crown, locked at the top, swinging off the head; a handle widens it", async () => {
    const V = [], F = [], grid = (fn, nu, nv) => {      // a test model made here: a dome and a curtain round the back, in centimetres
      const b = V.length;
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) V.push(fn(i / nu, j / nv));
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = b + j * (nu + 1) + i, c = a + nu + 1; F.push([a, c, a + 1], [a + 1, c, c + 1]); }
    };
    grid((u, v) => { const e = v * Math.PI / 2 * 1.15 - 0.15; return [11.5 * Math.cos(u * 2 * Math.PI) * Math.cos(e), 11.5 * Math.sin(e), 11.5 * Math.sin(u * 2 * Math.PI) * Math.cos(e)]; }, 48, 16);
    grid((u, v) => { const a = (40 + u * 280) * Math.PI / 180, r = 11.8 + 3 * v; return [r * Math.sin(a), -1.7 - 35 * v, r * Math.cos(a)]; }, 40, 24);
    const obj = V.map(p => `v ${p.join(" ")}`).concat(F.map(f => `f ${f.map(i => i + 1).join(" ")}`)).join("\n");
    await page.click('#tabs button[data-tab="hair"]');
    await page.selectOption("#hairRows select:has(option[value=shake])", "still");   // the hair step leaves the head shaking
    await page.selectOption("#hairRows select:has(option[value=model])", "model");
    await page.setInputFiles("#hairRows input[type=file]", { name: "studiotest_hair.obj", mimeType: "text/plain", buffer: Buffer.from(obj) });
    await page.waitForFunction(() => window.__body.modelWig, null, { timeout: 60000 });
    const rep = () => page.evaluate(() => { const w = window.__body.modelWig, M = window.__body.rig.matrix; return { ...w.report, ...w.measure(M.elements, M.clone().invert().elements) }; });
    await page.waitForTimeout(1500);                                         // settled on a still head
    const a = await rep();
    if (!(a.particles > 50 && a.locked > 0 && a.inside === 0 && a.drift_mm < 0.5)) throw new Error("fitted: " + JSON.stringify(a));
    await page.selectOption("#hairRows select:has(option[value=shake])", "shake"); await page.waitForTimeout(2500);
    const b = await rep();
    if (b.drift_mm > 0.5 || b.swing_mm < 2 || b.inside > b.particles * 0.02) throw new Error("shaking: " + JSON.stringify(b));
    await page.selectOption("#hairRows select:has(option[value=shake])", "still");
    await page.evaluate(() => document.querySelector('#views button[data-yaw="0"]').click()); await page.waitForTimeout(800);
    const [x, y] = await page.evaluate(() => window.__body.handleOnScreen("left")), [cx] = await page.evaluate(() => window.__body.handleOnScreen("right"));
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 4; i++) await page.mouse.move(x + Math.sign(x - cx) * 12 * i, y);
    await page.mouse.up();
    const left = await page.evaluate(() => window.__body.st.hair.model.fit.left);
    if (!(left > 1.05)) throw new Error(`the left handle didn't widen it (left ${left})`);
    await page.waitForFunction(() => window.__body.modelWig, null, { timeout: 30000 });   // the physics back on release
    await page.selectOption("#hairRows select:has(option[value=model])", "style");        // the style back for the rest
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

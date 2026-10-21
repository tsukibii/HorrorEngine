// The body editor (tools/body/index.html) in a headless browser: MHR loads with its 45 sliders; a scratch character;
// the feminine base and a shape slider move the body, the height scales it; a front picture (the page's own head from
// the front, so no one's photo is needed) bends the face and nothing under the neck; a side picture (the head at 3/4)
// is taken for the depth; the head OBJ exports; the pictures clear and the face goes. Ends "BODYPAGE ok".
//
//   python tools/face_mesh.py setup         (once)
//   python tools/body/serve.py              (in another shell)
//   node tools/body/bodytest.js [shot.png]
//
// Needs Playwright (npm i playwright, or PLAYWRIGHT=<path to its package>).
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const BASE = process.env.BODY_URL || "http://127.0.0.1:8793/";
const NAME = "_bodytest";
const shot = process.argv[2];
const fail = m => { console.error("BODYPAGE FAIL: " + m); process.exit(1); };

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { await page.screenshot({ path: shot || "bodytest_fail.png" }); fail(`${what}: ${e.message}`); } };
  const sample = () => page.evaluate(() => { const P = window.__body.POS; let s = 0, top = -1e9; for (let i = 0; i < P.length; i += 3) { s += P[i] * 7 + P[i + 2] * 3; top = Math.max(top, P[i + 1]); } return { s, top }; });
  const below = () => page.evaluate(() => {                 // how far the face moved anything under the neck
    const b = window.__body, d = b.delta; if (!d) return 0;
    let m = 0; for (let j = 0; j < d.idx.length; j++) { const i = d.idx[j]; if (b.POS[i * 3 + 1] < b.st.height * 0.78) m = Math.max(m, Math.abs(d.d[j * 3]) + Math.abs(d.d[j * 3 + 1]) + Math.abs(d.d[j * 3 + 2])); }
    return m;
  });
  const headShot = async yaw => {
    await page.click('#views button[data-v="head"]'); await page.click(`#views button[data-yaw="${yaw}"]`);
    await page.waitForTimeout(400);
    return page.locator("#view canvas").screenshot();
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
    await page.fill("#newName", NAME); await page.click("#make");
    await page.waitForFunction(n => window.__body.who === n, NAME);
  });
  let a, front, side;
  await step("the base and a slider move the body; the height scales it", async () => {
    a = await sample();
    await page.click('.bases button[data-base="-1"]');
    const b = await sample();
    if (Math.abs(b.s - a.s) < 1e-3) throw new Error("the feminine base didn't move the body");
    await page.$eval("#shapeRows .row input", i => { i.value = 2; i.dispatchEvent(new Event("input")); });
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
  await step("the head OBJ exports", async () => {
    await page.click("#expHead");
    await page.waitForFunction(() => /wrote .*_bodytest_head\.obj/.test(document.querySelector("#status").textContent), null, { timeout: 30000 });
  });
  if (shot) await page.screenshot({ path: shot });
  await step("cleared pictures take the face away", async () => {
    for (let k = 0; k < 2; k++) { await page.click("#slots .slot .x"); await page.waitForTimeout(800); }
    await page.waitForFunction(() => !window.__body.delta && window.__body.pics.length === 0, null, { timeout: 60000 });
  });
  if (errors.length) fail("page errors: " + errors.join(" | "));
  await browser.close();
  console.log("BODYPAGE ok");
})();

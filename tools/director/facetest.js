// The face page (face.html) in a headless browser: the head template loads; a picture of it (the page's own front
// view, so no one's photo is needed) is added under a scratch name; MediaPipe finds the face; a slider and a picture's
// tick refit; the face-only head; Save writes the OBJ; the picture is removed again. Ends "FACEPAGE ok".
//
//   python tools/face_mesh.py setup         (once)
//   python tools/director/serve.py          (in another shell)
//   node tools/director/facetest.js [shot.png]
//
// Needs Playwright (npm i playwright, or PLAYWRIGHT=<path to its package>).
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const BASE = process.env.DESK_URL || "http://127.0.0.1:8780/";
const NAME = "_facetest";
const shot = process.argv[2];
const fail = m => { console.error("FACEPAGE FAIL: " + m); process.exit(1); };

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 800 } })).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { await page.screenshot({ path: shot || "facetest_fail.png" }); fail(`${what}: ${e.message}`); } };
  const report = () => page.evaluate(() => window.__face.report);
  const fitted = (pred, ms = 60000) => page.waitForFunction(pred, null, { timeout: ms, polling: 100 });
  const statusText = () => page.textContent("#status");
  await page.goto(BASE + "face.html");

  let picture;
  await step("the head template loads", async () => {
    await fitted(() => window.__face && window.__face.head && window.__face.head.base.length > 3000);
    await page.selectOption("#name", { index: 0 }).catch(() => {});
    await page.click('#views button[data-yaw="0"]');
    await page.waitForTimeout(400);
    picture = await page.locator("#view canvas").screenshot();
  });
  await step("a new name and a picture of the template", async () => {
    await page.fill("#newName", NAME); await page.click("#make");
    await page.setInputFiles("#files", { name: "front.png", mimeType: "image/png", buffer: picture });
    await fitted(() => window.__face.report && window.__face.report.used === 1);
    if ((await page.$$("#pics .pic")).length !== 1) throw new Error("one thumbnail expected");
  });
  await step("a slider refits", async () => {
    const before = await page.evaluate(() => Array.from(window.__face.head.fit.slice(0, 3000)).join());
    await page.$eval("#shape input[type=range]", i => { i.value = 0.1; i.dispatchEvent(new Event("input")); });   // depth
    await fitted(b => window.__face.report && window.__face.report.settings.depth === 0.1 &&
      Array.from(window.__face.head.fit.slice(0, 3000)).join() !== b, before);
  });
  await step("untick the only picture: nothing to fit, said so", async () => {
    await page.uncheck("#pics .pic input");
    await page.waitForFunction(() => /left out/.test(document.querySelector("#status").textContent), null, { timeout: 30000 });
    errors.splice(0);                                 // the 400 behind that message is the point
    await page.check("#pics .pic input");
    await fitted(() => !/left out/.test(document.querySelector("#status").textContent) && window.__face.report.used === 1);
  });
  await step("the face only", async () => {
    await page.selectOption("#head", "none");
    await fitted(() => window.__face.head.base.length === 468 * 3 && window.__face.head.fit && window.__face.head.fit.length === 468 * 3);
    await page.selectOption("#head", "mhr");
    await fitted(() => window.__face.head.base.length > 3000 && window.__face.head.fit && window.__face.head.fit.length === window.__face.head.base.length);
  });
  await step("Save writes the OBJ", async () => {
    await page.click("#save");
    await page.waitForFunction(() => /saved .*_facetest\.obj/.test(document.querySelector("#status").textContent), null, { timeout: 60000 });
  });
  if (shot) await page.screenshot({ path: shot });
  await step("the picture is removed again", async () => {
    page.on("dialog", d => d.accept());
    await page.click("#pics .pic button");
    await page.waitForFunction(() => /add pictures first/.test(document.querySelector("#status").textContent) ||
      document.querySelectorAll("#pics .pic").length === 0, null, { timeout: 30000 });
  });
  if (errors.length) fail("page errors: " + errors.join(" | "));
  await browser.close();
  console.log("FACEPAGE ok");
})();

// The splat page (tools/character/gshair.html) in a headless browser: a splat and its head load for a character, the
// Gaussians draw (pixels of hair on the canvas), the clay shows, a shake jiggles the chains without a NaN and they stay
// off the head, the light turns. Ends "GSHAIRPAGE ok".
//
//   python tools/gshair.py check --keep                 (once: the synthetic wig's splat in vendor/gshair/check/wig/)
//   python tools/character/serve.py                    (in another shell)
//   node tools/character/gshairtest.js [DIR] [shot.png] DIR: a capture folder with splat.json, splat.bin and head.json
//                                                       (default vendor/gshair/check/wig); copied to People/_gshairtest/gshair/
//
// Needs Playwright (npm i playwright, or PLAYWRIGHT=<path to its package>; PW_CHROME=<a Chromium binary> when its browsers aren't installed).
const fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const BASE = process.env.BODY_URL || "http://127.0.0.1:8793/";
const ROOT = path.resolve(__dirname, "..", "..");
const NAME = "_gshairtest";
const src = process.argv[2] || path.join(ROOT, "vendor", "gshair", "check", "wig");
const shot = process.argv[3];
const fail = m => { console.error("GSHAIRPAGE FAIL: " + m); process.exit(1); };

(async () => {
  const dst = path.join(ROOT, "Content", "Studio", "People", NAME, "gshair");
  fs.mkdirSync(dst, { recursive: true });
  for (const f of ["splat.json", "splat.bin", "head.json"]) {
    if (!fs.existsSync(path.join(src, f))) fail(`no ${f} in ${src} (python tools/gshair.py check --keep)`);
    fs.copyFileSync(path.join(src, f), path.join(dst, f));
  }
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });   // PW_CHROME: a Chromium of your own
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 720 } })).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { await page.screenshot({ path: shot || "gshairtest_fail.png" }); fail(`${what}: ${e.message}`); } };
  const pixels = () => page.evaluate(() => {           // how many canvas pixels aren't the clear colour or the grey head
    const c = window.__gshair.canvas, k = document.createElement("canvas"); k.width = c.width; k.height = c.height;
    const x = k.getContext("2d"); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, k.width, k.height).data;
    let hair = 0, any = 0;
    for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (Math.abs(r - 27) + Math.abs(g - 28) + Math.abs(b - 32) > 12) any++; if (r > g + 6 && g > b + 2 && r > 25) hair++; }
    return { any, hair };
  });
  await page.goto(BASE + "gshair.html?name=" + NAME);
  await step("the splat and the head load", async () => {
    await page.waitForFunction(() => window.__gshair && window.__gshair.ready, null, { timeout: 60000 });
    const n = await page.evaluate(() => [window.__gshair.hair.M, window.__gshair.hair.K]);
    if (!(n[0] > 100) || !(n[1] >= 2)) throw new Error(`${n[0]} Gaussians on ${n[1]} clumps`);
    console.log(`       ${n[0]} Gaussians on ${n[1]} clumps`);
  });
  await step("the hair draws", async () => {
    await page.waitForTimeout(1500);
    const p = await pixels();
    if (p.hair < 300) throw new Error(`${p.hair} brown pixels (${p.any} drawn)`);
    console.log(`       ${p.hair} brown pixels of hair, ${p.any} drawn`);
  });
  await step("the clay shows", async () => {
    await page.click("text=Show the clay"); await page.waitForTimeout(300);
    const v = await page.evaluate(() => window.__gshair.st.showClay);
    if (!v) throw new Error("not on");
  });
  await step("a shake jiggles the chains and they stay off the head", async () => {
    await page.evaluate(() => window.__gshair.motion("shake"));
    let worst = 0;
    for (let i = 0; i < 6; i++) { await page.waitForTimeout(300); const m = await page.evaluate(() => window.__gshair.measure()); if (m.nan) throw new Error("NaN in the chains"); worst = Math.max(worst, m.inside_pct); if (m.drift_mm > 200) throw new Error(`drift ${m.drift_mm} mm`); }
    await page.evaluate(() => window.__gshair.motion("still")); await page.waitForTimeout(800);
    const m = await page.evaluate(() => window.__gshair.measure());
    if (m.inside_pct > 10) throw new Error(`${m.inside_pct}% of the chain points inside the head`);
    console.log(`       settled: drift ${m.drift_mm} mm, inside ${m.inside_pct}% (worst ${worst}%)`);
  });
  await step("the light turns and the hair still draws", async () => {
    await page.evaluate(() => { const i = document.querySelector('input[title="The hair\'s sheen: low is glossy."]'); i.value = 0.15; i.dispatchEvent(new Event("input")); });
    await page.waitForTimeout(400);
    const p = await pixels();
    if (p.hair < 300) throw new Error(`${p.hair} brown pixels`);
  });
  if (shot) { await page.click("text=Show the clay"); await page.waitForTimeout(600); await page.screenshot({ path: shot }); }
  if (errors.length) fail("page errors: " + errors.join(" | "));
  await browser.close();
  console.log("GSHAIRPAGE ok");
})().catch(e => fail(e.message));

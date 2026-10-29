// Pictures of a saved Character Studio character from the Studio's own view (the three.js render, its skin and eye
// shaders), for the Godot side to be measured beside (tools/godot/studio_compare.py, GDSTUDIO): the head from the
// front under the Studio's lights, one picture a light. The Studio's server must be running (port 8793).
//   node tools/character/studioshot.mjs --person NAME --out DIR [--lights studio,reference]   (GPU=1 on the user's machine)
import { createRequire } from "module";
import { mkdirSync } from "fs";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const args = process.argv.slice(2), arg = (k, d) => (args.indexOf(k) >= 0 ? args[args.indexOf(k) + 1] : d);
const NAME = arg("--person", ""), OUT = arg("--out", "."), LIGHTS = arg("--lights", "studio,reference").split(",");
const URL = process.env.BODY_URL || "http://127.0.0.1:8793/";
if (!NAME) { console.error("STUDIOSHOT FAIL: --person NAME"); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const browser = await req("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));
try {
  await page.goto(URL);
  await page.waitForFunction(() => window.__body && window.__body.N > 10000, null, { timeout: 120000 });
  await page.waitForFunction(n => [...document.querySelectorAll("#who option")].some(o => o.value === n), NAME, { timeout: 30000 });
  await page.selectOption("#who", NAME);
  await page.waitForFunction(n => window.__body.who === n, NAME, { timeout: 120000 });
  await page.waitForTimeout(2500);                                           // the clothes and hair worn, the face baked
  await page.click('#views button[data-v="head"]'); await page.click('#views button[data-yaw="0"]');
  await page.waitForTimeout(800);
  const clip = await page.evaluate(() => { const r = document.querySelector("#view canvas").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  const out = {};
  for (const light of LIGHTS) {
    const has = await page.evaluate(l => { const s = document.querySelector("#lightSel"); if (!s) return false; if (![...s.options].some(o => o.value === l)) return false; s.value = l; s.dispatchEvent(new Event("change")); return true; }, light);
    await page.waitForTimeout(1200);
    const f = `${OUT}/studio_${light}.png`;
    await page.screenshot({ path: f, clip, timeout: 120000 });
    out[light] = { file: f, light_set: has };
  }
  out.who = await page.evaluate(() => ({ who: window.__body.who, tone: window.__body.st && window.__body.st.skin && window.__body.st.skin.tone }));
  console.log("STUDIOSHOT " + JSON.stringify(out));
  if (errors.length) console.log("STUDIOSHOT page errors: " + JSON.stringify(errors.slice(0, 3)));
} catch (e) {
  console.error("STUDIOSHOT FAIL: " + e.message);
  await page.screenshot({ path: `${OUT}/studioshot_fail.png` }).catch(() => {});
  process.exitCode = 1;
} finally { await browser.close(); }

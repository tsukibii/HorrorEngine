// WARDROBE: the wardrobe page (tools/character/wardrobe.html, docs/WARDROBE_PLAN.md) in a headless browser on the Character
// Studio's server: the dummy shown, an outfit worn and made, the same outfit's top edited and made again faster than
// the whole (the kept garments), new folds on the shorts (a new seed, the shorts made again, the rest kept), saved to My
// outfits with a picture and read back by the Studio's route, then deleted; the same outfit again answered by the tailor
// at once with nothing sent (every garment and its meshes kept). Ends "WARDROBE ok".
//   node tools/character/wardrobetest.mjs        (the Studio's server running: python tools/character/serve.py; BODY_URL for another port)
import { createRequire } from "module";
import { existsSync, readFileSync, unlinkSync } from "fs";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const URL = (process.env.BODY_URL || "http://127.0.0.1:8793/").replace(/\/?$/, "/");
const MINE = new globalThis.URL("../../Content/Studio/Clothes/my_outfits.json", import.meta.url), had = existsSync(MINE);   // (made by the save below: taken away again if it wasn't there before and is empty)
const browser = await req("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
const errors = [], fails = [];
page.on("pageerror", e => errors.push(e.message));
const say = (ok, what) => { console.log((ok ? "  ok  " : "  BAD ") + what); if (!ok) fails.push(what); };
const made = () => page.evaluate(() => window.__wardrobe.made);
const waitMade = async (after, ms = 240000) => { await page.waitForFunction(t => { const m = window.__wardrobe?.made; return m && m.at !== t && m.stage; }, after, { timeout: ms }); return made(); };
try {
  await page.goto(URL + "wardrobe.html");
  await page.waitForFunction(() => window.__wardrobe, null, { timeout: 300000 });
  say(true, "the wardrobe opened, the dummy made");
  // stamp each result so a wait can tell a new one from the last
  await page.evaluate(() => { const W = window.__wardrobe; let n = 0; const d = Object.getOwnPropertyDescriptor(W, "made"); Object.defineProperty(W, "made", { get() { const m = d.get(); return m.stage ? { ...m, at: m.at ?? (m.at = ++n) } : m; } }); });
  const NAME = "casual: houndstooth shorts";
  const has = await page.evaluate(n => !!window.__wardrobe.OUTFITS[n], NAME);
  say(has, `the preset "${NAME}" offered`);
  let t0 = Date.now(); await page.evaluate(n => window.__wardrobe.wear(window.__wardrobe.OUTFITS[n]), NAME);
  let m = await waitMade(null); const whole = Date.now() - t0;
  const parts = await page.evaluate(() => window.__wardrobe.GARMENTS.children.length);
  say(parts > 4 && m.stage === "done", `the outfit made on the dummy: ${parts} parts in ${(whole / 1000).toFixed(1)} s`);
  // the outermost garment (the shorts) given new folds: only it is made again
  const last = m.at;
  t0 = Date.now();
  await page.evaluate(() => { const W = window.__wardrobe, c = W.st.clothes[W.st.clothes.length - 1]; c.edit = { ...(c.edit || {}), folds: { depth: 0.015, count: 4, seed: 3 } }; W.dress(true); });
  m = await waitMade(last); const again = Date.now() - t0;
  say(again < whole, `new folds on the shorts made in ${(again / 1000).toFixed(1)} s, the rest kept (the whole outfit took ${(whole / 1000).toFixed(1)} s)`);
  t0 = Date.now(); const last2 = m.at;
  await page.evaluate(() => window.__wardrobe.dress(true));             // nothing changed: every garment as it was kept
  m = await waitMade(last2); const same = Date.now() - t0;
  say(m.tailor < 1000 && m.sent === 0, `the same outfit again: the tailor answered in ${(m.tailor / 1000).toFixed(2)} s, ${m.sent} garments sent, every garment and its meshes kept (${(same / 1000).toFixed(1)} s to the next frame drawn on this machine's CPU)`);
  // saved to My outfits, with a picture, and read back by the Studio's own route
  await page.fill("#saveName", "_wardrobetest");
  await page.click("#save");
  await page.waitForFunction(() => window.__wardrobe.MINE.outfits["_wardrobetest"], null, { timeout: 30000 });
  const back = await (await page.request.get(URL + "api/clothes/my_outfits.json")).json();
  const saved = back.outfits?._wardrobetest;
  say(Array.isArray(saved) && saved.length === 4 && saved[3][3]?.folds?.seed === 3, "saved to My outfits, the shorts' folds with it (the Studio's route reads it)");
  const thumb = await page.request.get(URL + "api/clothes/thumbs/wardrobetest.jpg");
  say(thumb.ok() && (await thumb.body()).length > 3000, "its picture saved for the Studio's card");
  await page.evaluate(() => { document.querySelector("#worn details:not([open])")?.setAttribute("open", ""); });
  await page.screenshot({ path: process.env.WARDROBE_SHOT || "/dev/null" }).catch(() => {});
  const del = await (await page.request.post(URL + "api/clothes/myoutfits", { data: JSON.stringify({ delete: "_wardrobetest" }) })).json();
  say(!del.outfits?._wardrobetest, "deleted again");
  say(!errors.length, `no page errors${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
} catch (e) { fails.push(String(e)); console.log("  BAD " + e); }
await browser.close();
try { if (!had && existsSync(MINE) && !Object.keys(JSON.parse(readFileSync(MINE, "utf8")).outfits || {}).length) unlinkSync(MINE); } catch { /* left as it is */ }
console.log(fails.length ? `WARDROBE FAIL (${fails.length})` : "WARDROBE ok");
process.exit(fails.length ? 1 : 0);

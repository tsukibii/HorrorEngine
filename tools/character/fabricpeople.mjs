// The clothing fabric sets on a character (tools/fabricpbr.py; docs/TAILOR.md §1k): a new character made in the
// Character Studio's own page in a headless browser as the Studio starts one (v2female's head on bodyv2's body), given
// hair, dressed in one of the "fabrics:" outfits (Content/Studio/Clothes/outfits.json: every garment in a fabric set),
// saved and exported for Godot (Exports/characters/<name>/<name>.glb): what tools/godot/cloth_check.py --person
// pictures on the look plugin's cloth shader (GDCLOTH).
//
//   node tools/character/fabricpeople.mjs [--name fabric_demo] [--outfit "fabrics: cream knit over a wool skirt and sheer tights"]
//        [--hair daz_bob] [--again] [--shot FILE]     (--shot: the Studio's own picture of her, dressed)
//
// The Character Studio's server running (python tools/character/serve.py; BODY_URL for another port). GPU=1 in front
// on a machine with a graphics card (tools/browser.cjs). Ends "FABRICPEOPLE ok".
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."), URL = process.env.BODY_URL || "http://127.0.0.1:8793/";
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; }, has = k => args.includes(k);
const name = opt("--name", "fabric_demo"), outfit = opt("--outfit", "fabrics: cream knit over a wool skirt and sheer tights"), hair = opt("--hair", "daz_bob");
const t0 = Date.now(), secs = () => ((Date.now() - t0) / 1000).toFixed(0);
const exported = () => ["Exports", path.join("Saved", "Exports")].map(d => path.join(ROOT, d, "characters", name, name + ".glb")).find(f => fs.existsSync(f));
if (exported() && !has("--again")) { console.log(`  ok  ${name}: there already (${path.relative(ROOT, exported())}); --again makes it again`); console.log("FABRICPEOPLE ok"); process.exit(0); }
const browser = await req("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1300, height: 900 } })).newPage(); page.setDefaultTimeout(1800000);
const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
page.on("console", m => { if (m.type() === "error" && /WebGLProgram|shader/i.test(m.text())) errs.push(m.text().slice(0, 600)); });
const B = (f, a) => page.evaluate(f, a);
const settle = async () => { await page.waitForFunction(() => /points/.test(document.querySelector("#hud").textContent) && !/finding|fitting/.test(document.querySelector("#status").textContent), null, { timeout: 1800000 }); await page.waitForTimeout(1500); };
try {
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => window.__body && window.__body.SCULPT && window.__body.hair2, null, { timeout: 1800000 });   // (drawn on the CPU where there's no card: slow to start)
  console.log(`  ..  the Studio's page is up (${secs()} s)`);
  await page.fill("#newName", name); await page.click("#make", { noWaitAfter: true });
  await page.waitForFunction(n => window.__body.who === n && /starts from the/.test(document.querySelector("#status").textContent), name, { timeout: 600000 });
  await settle();
  console.log(`  ..  ${name}: the body (${secs()} s)`);
  if (hair && hair !== "none") {
    await B(async style => { const b = window.__body; b.hair2.use(style, {}, true); await b.hair2.ready(); }, hair); await page.waitForTimeout(700);
    await page.waitForFunction(() => { const s = window.__body.hair2.state; return !s.on || (s.shownSeq === s.seq && !s.draft && s.stats) || s.failed; }, null, { timeout: 600000 });
    console.log(`  ..  ${name}: hair ${hair} (${secs()} s)`);
  }
  const want = await B(n => (window.__body.OUTFITS || {})[n]?.length ?? -1, outfit);
  await B(n => window.__body.wearOutfit(n), outfit);
  await page.waitForFunction(n => { const g = window.__body.GARMENTS.children; return g.length >= n && !/^(cutting|cut|hanging)$/.test(window.__body.drapeState?.stage || ""); }, Math.max(1, want), { timeout: 1800000 });
  await page.waitForTimeout(2500);
  const sets = await B(() => [...new Set(window.__body.GARMENTS.children.map(m => m.material?.userData?.fabric?.set).filter(Boolean))]);
  console.log(`  ..  ${name}: dressed in "${outfit}", on the fabric sets ${sets.join(", ") || "none"} (${secs()} s)`);
  if (!sets.length) throw new Error("no garment wears a fabric set (are they in pbr/fabric? python tools/fabricpbr.py)");
  if (opt("--shot")) { await page.waitForTimeout(1500); await (await page.$("canvas")).screenshot({ path: opt("--shot") }); }
  await B(() => { window.__body.setPose("rest"); document.querySelector("#status").textContent = ""; }); await page.click("#save", { noWaitAfter: true });
  await page.waitForFunction(() => /saved/.test(document.querySelector("#status").textContent), null, { timeout: 600000 });
  await B(() => { document.querySelector("#status").textContent = ""; }); await page.click("#expPack", { noWaitAfter: true });
  await page.waitForFunction(() => /for Godot \(drag/.test(document.querySelector("#status").textContent) || document.querySelector("#status").className === "bad", null, { timeout: 3600000 });
  const word = await B(() => document.querySelector("#status").textContent);
  if (!/for Godot \(drag/.test(word)) throw new Error(`the export: ${word}`);
  if (errs.length) throw new Error("page errors: " + errs.slice(0, 3).join(" | "));
  const f = exported(); console.log(`  ok  ${name}: exported${f ? `: ${path.relative(ROOT, f)} (${Math.round(fs.statSync(f).size / 1e6)} MB)` : ""} (${secs()} s)`);
} catch (e) { console.log("FABRICPEOPLE FAIL: " + e.message + (errs.length ? " | " + errs.slice(0, 2).join(" | ") : "")); await browser.close(); process.exit(1); }
await browser.close();
console.log(`FABRICPEOPLE ok (${secs()} s): python tools/godot/cloth_check.py --person ${name}`);

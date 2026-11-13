// Animator v2: the three characters it is tested on (DECISIONS 2026-11-13, animation v2: "For testing just do a skinny
// man, normal woman, chubby woman"), made in the Character Studio's own page in a headless browser, dressed, given
// hair, saved and exported for Godot (Exports/characters/<name>/<name>.glb), ready for the Animator. The same bodies
// as bodies.mjs builds without a browser (its TEST_BODIES: one table for both).
//
//   node tools/animator/people.mjs [--only skinny_man,chubby_woman] [--again] [--bare]
//       a character that's there already is left as it is unless --again; --bare: no clothes and no hair (quicker)
//
// The Character Studio's server running (python tools/character/serve.py; BODY_URL for another port). GPU=1 in front
// on a machine with a graphics card (tools/browser.cjs). Ends "PEOPLE ok".
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { TEST_BODIES } from "./bodies.mjs";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."), URL = process.env.BODY_URL || "http://127.0.0.1:8793/";
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; }, has = k => args.includes(k);
const only = (opt("--only") || "").split(",").filter(Boolean), keys = Object.keys(TEST_BODIES).filter(k => !only.length || only.includes(k));
const t0 = Date.now(), secs = () => ((Date.now() - t0) / 1000).toFixed(0);
const exported = name => ["Exports", path.join("Saved", "Exports")].map(d => path.join(ROOT, d, "characters", name, name + ".glb")).find(f => fs.existsSync(f));
const made = [];
for (const k of keys) {                                   // (a browser a character: the plain start is a page's own switch)
  const def = TEST_BODIES[k], S = def.studio, name = S.name;
  if (exported(name) && !has("--again")) { console.log(`  ok  ${name}: there already (${path.relative(ROOT, exported(name))}); --again makes it again`); made.push(name); continue; }
  const browser = await req("../browser.cjs").launch(chromium);
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 900 } })).newPage(); page.setDefaultTimeout(600000);
  const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
  const B = (f, a) => page.evaluate(f, a);
  const settle = async () => { await page.waitForFunction(() => /points/.test(document.querySelector("#hud").textContent) && !/finding|fitting/.test(document.querySelector("#status").textContent), null, { timeout: 600000 }); await page.waitForTimeout(1500); };
  try {
    if (S.plain) await page.addInitScript(() => { window.__plainNew = true; });
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForFunction(() => window.__body && window.__body.SCULPT && window.__body.hair2, null, { timeout: 600000 });
    await page.fill("#newName", name); await page.click("#make", { noWaitAfter: true });
    await page.waitForFunction(n => window.__body.who === n && /starts from the/.test(document.querySelector("#status").textContent), name, { timeout: 600000 });
    await settle();
    if (S.base) { await page.click({ masculine: '.bases button[data-base="1"]', average: '.bases button[data-base="0"]', feminine: '.bases button[data-base="-1"]:not([data-v2])' }[S.base], { noWaitAfter: true }); await settle(); }
    await B(([S, def]) => { const b = window.__body; b.setPose("rest");
      if (S.head) b.usePreset("head", S.head); if (S.body) b.usePreset("body", S.body);
      for (const [i, v] of Object.entries(S.shape || {})) b.st.shape[+i] = v;
      Object.assign(b.st.sculpt, (def.grown && def.grown.sculpt) || def.sculpt || {});
      b.st.height = def.height; b.changed("body"); b.changed("scale"); }, [S, def]);
    await settle();
    const tall = await B(() => { const P = window.__body.POS; let lo = 1e9, hi = -1e9; for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); } return hi - lo; });
    if (Math.abs(tall - def.height) > 0.012) throw new Error(`${name}: ${tall.toFixed(3)} m tall, not ${def.height}`);
    console.log(`  ..  ${name}: the body (${tall.toFixed(2)} m, ${secs()} s)`);
    if (!has("--bare")) {
      if (S.hair) { await B(async style => { const b = window.__body; b.hair2.use(style, {}, true); await b.hair2.ready(); }, S.hair); await page.waitForTimeout(700);
        await page.waitForFunction(() => { const s = window.__body.hair2.state; return !s.on || (s.shownSeq === s.seq && !s.draft && s.stats) || s.failed; }, null, { timeout: 600000 }); console.log(`  ..  ${name}: hair ${S.hair} (${secs()} s)`); }
      if (S.outfit) { await B(n => window.__body.wearOutfit(n), S.outfit);
        await page.waitForFunction(n => { const g = window.__body.GARMENTS.children; return g.length >= n && !/^(cutting|cut|hanging)$/.test(window.__body.drapeState?.stage || ""); }, S.garments || 1, { timeout: 1800000 }); await page.waitForTimeout(1500); console.log(`  ..  ${name}: wearing "${S.outfit}" (${secs()} s)`); }
    }
    await B(() => { window.__body.setPose("rest"); document.querySelector("#status").textContent = ""; }); await page.click("#save", { noWaitAfter: true });
    await page.waitForFunction(() => /saved/.test(document.querySelector("#status").textContent), null, { timeout: 600000 });
    await B(() => { document.querySelector("#status").textContent = ""; }); await page.click("#expPack", { noWaitAfter: true });
    await page.waitForFunction(() => /for Godot \(drag/.test(document.querySelector("#status").textContent) || document.querySelector("#status").className === "bad", null, { timeout: 3600000 });
    const word = await B(() => document.querySelector("#status").textContent);
    if (!/for Godot \(drag/.test(word)) throw new Error(`${name}: the export: ${word}`);
    if (errs.length) throw new Error("page errors: " + errs.slice(0, 3).join(" | "));
    const f = exported(name); console.log(`  ok  ${name}: ${def.about}; exported${f ? `: ${path.relative(ROOT, f)} (${Math.round(fs.statSync(f).size / 1e6)} MB)` : ""} (${secs()} s)`); made.push(name);
  } catch (e) { console.log("PEOPLE FAIL: " + e.message); await browser.close(); process.exit(1); }
  await browser.close();
}
console.log(`PEOPLE ok (${made.length} characters, ${secs()} s): python tools/animator/serve.py lists them`);

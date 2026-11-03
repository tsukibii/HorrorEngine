// A level as the .glb for a Godot project built by hand, from the command line (the scene builder's Export for Godot
// does the same: levelexport.js, docs/SCENE_BUILDER.md §11). The desk's server running.
//
//   node tools/director/levelexport.mjs --game set:school_tokyo [--level L] [--no-outside]
//        writes Exports/interiors/<name>/<name>.glb and its README (the page's button does the same)
//   node tools/director/levelexport.mjs --game Pilot --level house --out some/where.glb
//        just the .glb, there (the checks)
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const game = opt("--game"), level = opt("--level", ""), out = opt("--out", "");
if (!game) { console.log("give --game <Game> or --game set:<name> (and --level when it has more than one)"); process.exit(2); }
const browser = await require("../browser.cjs").launch(chromium);
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  const q = new URLSearchParams({ game }); if (level) q.set("level", level);
  await page.goto(`${process.env.DESK_URL || "http://127.0.0.1:8780/"}builder.html?${q}`);
  await page.waitForFunction(() => window.__builderReady, null, { timeout: 180000 });
  if (args.includes("--no-outside")) await page.evaluate(() => { const c = document.querySelector("#showOutside"); if (c.checked) { c.checked = false; c.dispatchEvent(new Event("change")); } });
  await page.waitForFunction(() => window.__exportReady && window.__exportReady(), null, { timeout: 180000 });
  if (out) {
    const b64 = await page.evaluate(() => window.__exportGodotLevel());
    const f = path.resolve(ROOT, out);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(b64, "base64"));
    console.log(`wrote ${path.relative(ROOT, f)} (${Math.round(fs.statSync(f).size / 1024)} KB)`);
  } else {
    const j = await page.evaluate(() => window.__exportForGodot());
    console.log(`wrote ${j.path} (${Math.round(fs.statSync(path.join(ROOT, j.path)).size / 1024)} KB): drag ${j.folder} into your Godot project`);
  }
  if (errors.length) { console.log("page errors: " + errors.slice(0, 3).join(" | ")); process.exitCode = 1; }
} finally { await browser.close(); }

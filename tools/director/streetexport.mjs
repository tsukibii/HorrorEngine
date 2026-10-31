// A street as the .glb to drop into a Godot project's folder, from the command line (the page's Export .glb does the same):
// its chunks, its colliders (`-colonly`), occluders (`-occonly`), the lamps' lights and where each inside's level goes.
// The desk's server running. docs/STREET_BUILDER.md §5b.
//
//   node tools/director/streetexport.mjs --street shibuya_lane [--out Saved/Streets/shibuya_lane/shibuya_lane.glb]
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const street = opt("--street");
if (!street) { console.log("give --street <name>"); process.exit(2); }
const out = path.resolve(ROOT, opt("--out", `Saved/Streets/${street}/${street}.glb`));
const browser = await require("../browser.cjs").launch(chromium);
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${process.env.DESK_URL || "http://127.0.0.1:8780/"}street.html?street=${encodeURIComponent(street)}`);
  await page.waitForFunction(n => window.__streetReady && window.ST.name === n, street, { timeout: 120000 });
  const b64 = await page.evaluate(() => window.__exportGodot());
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(b64, "base64"));
  console.log(`wrote ${path.relative(ROOT, out)} (${Math.round(fs.statSync(out).size / 1024)} KB): drop it into your Godot project's folder`);
  if (errors.length) { console.log("page errors: " + errors.slice(0, 3).join(" | ")); process.exitCode = 1; }
} finally { await browser.close(); }

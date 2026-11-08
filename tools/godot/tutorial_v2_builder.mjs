// TUTORIAL2's pictures of the scene builder (tools/godot/tutorial_v2.py --pictures; guides/tutorial_v2's modelling
// steps): the hotel floor set open in the builder as the guide's steps leave it. The plan and the corridor from the
// player's eye; the stairwell's floor and its stairs; room 304 picked (its tone); 304's door picked (its lock); the
// paint bucket on the corridor's walls; the whole floor from outside. The desk's server running.
//   node tools/godot/tutorial_v2_builder.mjs --out guides/tutorial_v2/img
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const args = process.argv.slice(2), out = path.resolve(ROOT, args[args.indexOf("--out") + 1] || "guides/tutorial_v2/img");
const DESK = process.env.DESK_URL || "http://127.0.0.1:8780/";
fs.mkdirSync(out, { recursive: true });
const browser = await require("../browser.cjs").launch(chromium);
let bad = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  page.on("dialog", d => d.accept());
  await page.goto(`${DESK}builder.html?game=set:hotel_floor`);
  await page.waitForFunction(() => window.__builderReady && window.B && window.B.plan && window.B.model && window.B.model.rooms.length > 5, null, { timeout: 180000 });
  const shot = async (name, fn, wait = 1500) => {
    await page.evaluate(code => (0, eval)(code), fn);         // statements, run in the page
    await page.waitForTimeout(wait);
    const f = path.join(out, `${name}.jpg`);
    await page.screenshot({ path: f, type: "jpeg", quality: 86 });
    console.log(`  picture: ${path.relative(ROOT, f)}`);
  };
  // the floors bar: the second floor's (the stairwell's foot) and the third's
  const floor = i => { const b = [...document.querySelectorAll("#floors button")].filter(b => /^(B?\d+F|\d)/.test(b.textContent.trim())); (b[i] || b[0]).click(); };
  const eye = (x, y, z, yaw, pitch = 0) => { Object.assign(window.B.model.player, { x, y, z, yaw }); window.builder.pitch(pitch); window.builder.render3d(); };
  await shot("builder_plan", `(${floor})(1); window.B.sel = null; window.builder.changed(false); (${eye})(1.4, 7.0, 2.85, 0, -3);`, 2500);
  await shot("builder_stairs", `(${floor})(0); window.B.sel = { room: "stairs" }; window.builder.changed(false); (${eye})(1.9, 8.45, 0, 90, 18);`, 2500);
  await shot("builder_room", `(${floor})(1); window.B.sel = { room: "r304" }; window.builder.changed(false); (${eye})(5.2, 3.2, 2.85, 335, -8);`, 2500);
  await shot("builder_door", `window.B.sel = { op: "door_304" }; window.builder.changed(false); (${eye})(7.2, 7.4, 2.85, 300, -6);`, 2000);
  await shot("builder_paint", `window.B.sel = null; window.builder.changed(false); window.builder.paint.on(true); window.builder.paint.brush("pbr/wall/Plaster001_1K-PNG"); (${eye})(3.5, 6.6, 2.85, 10, 0);`, 2500);
  await page.evaluate(() => window.builder.paint.on(false));
  await shot("builder_around", `const v = document.querySelector("#viewMode"); v.value = "around"; v.dispatchEvent(new Event("change"));`, 3000);
  if (errors.length) { console.log("page errors: " + errors.slice(0, 3).join(" | ")); bad++; }
} finally { await browser.close(); }
process.exit(bad ? 1 : 0);

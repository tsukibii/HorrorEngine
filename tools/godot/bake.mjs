// The desk's bake without the desk's button: opens the game on a running desk in a headless browser and records the
// Watch as the Generate button does (bake.js's bakePreview: every scene's camera, bodies, subtitles, events and lights
// at 30 fps, each cast member's body as Body_<who>.glb) into Content/Games/<G>/Previs/. The Godot export carries it.
//   node tools/godot/bake.mjs --game TestRoom001        (the desk's server running; DESK_URL for another port)
import { createRequire } from "module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");

const args = process.argv.slice(2), game = args[args.indexOf("--game") + 1] || "Pilot";
const URL = (process.env.DESK_URL || "http://127.0.0.1:8780/") + "?game=" + encodeURIComponent(game);
const browser = await createRequire(import.meta.url)("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 900, height: 560 } })).newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
try {
  await page.goto(URL);
  await page.waitForFunction(() => window.__dd && window.__dd.S && window.__dd.PLAN && window.__dd.watchStage, null, { timeout: 60000 });
  const r = await page.evaluate(async game => {
    const { bakePreview } = await import("/bake.js"), { GLTFExporter } = await import("/vendor/GLTFExporter.js");
    const dd = window.__dd, bodies = [];
    const saveBody = async (who, blob) => { bodies.push(who); await fetch(`/api/export/${encodeURIComponent(game)}/Body_${encodeURIComponent(who)}.glb`, { method: "POST", body: blob }); };
    const pv = await bakePreview(dd.watchStage, dd.S, dd.PLAN, dd.FILES, 30, () => {}, GLTFExporter, saveBody);
    const res = await fetch("/api/preview/" + encodeURIComponent(game), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pv) });
    const j = await res.json();
    return { scenes: Object.keys(pv.scenes).length, frames: Object.values(pv.scenes).reduce((n, s) => n + s.frames.length, 0), bodies, path: j.path, kb: j.kb };
  }, game);
  console.log(`BAKE ok: ${game}: ${r.scenes} scenes, ${r.frames} frames, bodies ${r.bodies.join(", ") || "none"} -> ${r.path} (${r.kb} KB)`);
  if (errors.length) console.log("page errors: " + errors.join(" | "));
} catch (e) {
  console.error("BAKE FAIL: " + e.message + (errors.length ? "\n" + errors.join("\n") : ""));
  process.exitCode = 1;
} finally { await browser.close(); }

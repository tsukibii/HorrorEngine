// ANIMATORPAGE: the Animator v2's page (docs/ANIMATOR_V2.md §9) on its own server and a scratch folder of characters
// (the three test bodies bodies.mjs builds, laid out as Exports/characters is), driven in a headless browser: the
// characters listed; one opened, measured and shown, its soft bones in the page's skeleton; the walk made in the page
// and playing (its bones moving, the feet never under the floor); each slider changing what it should (a feminine
// walk narrower than a masculine one, a heavier one slower, softness scaling the soft bones' motion); every kind of
// clip made; Bake: the file baked in place with every clip and its record, listed as baked, and baked again from the
// page with other sliders. --out <folder> keeps pictures of the page there.
//   node tools/animator/pagetest.mjs [--out docs/animator_sheets]
import { createRequire } from "module";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { testBody, bodyGlb } from "./bodies.mjs";
import { parseGlb } from "./core/glb.js";
const require = createRequire(import.meta.url), { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../.."), SCRATCH = path.join(ROOT, "Saved", "animator_check"), PLACE = path.join(SCRATCH, "characters");
const PORT = +(process.env.ANIMATOR_TEST_PORT || 8899), URL_ = `http://127.0.0.1:${PORT}/`, OUT = process.argv.includes("--out") ? path.resolve(process.argv[process.argv.indexOf("--out") + 1]) : null;
const REAL = process.argv.includes("--real") ? process.argv[process.argv.indexOf("--real") + 1] : null;   // a real export's name (Exports/characters): pictured too, when --out
let server = null; const t0 = Date.now();
const fail = m => { console.error("ANIMATORPAGE FAIL: " + m); if (server) server.kill(); process.exit(1); };
fs.rmSync(SCRATCH, { recursive: true, force: true });
for (const n of ["skinny_man", "normal_woman", "chubby_woman"]) { fs.mkdirSync(path.join(PLACE, n), { recursive: true }); fs.writeFileSync(path.join(PLACE, n, n + ".glb"), bodyGlb(testBody(n))); }
const places = [PLACE, ...(REAL ? [path.join(ROOT, "Exports", "characters")] : [])].join(path.delimiter);

(async () => {
  server = spawn("python3", [path.join(ROOT, "tools", "animator", "serve.py"), "--port", String(PORT)], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ANIMATOR_PLACES: places, ANIMATOR_SAVED: path.join(SCRATCH, "saved") } });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(URL_ + "api/characters")).ok) break; } catch (e) { } await new Promise(r => setTimeout(r, 250)); }
  const browser = await require("../browser.cjs").launch(chromium);
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 860 } })).newPage(); page.setDefaultTimeout(180000);
  const errors = []; page.on("pageerror", e => errors.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const step = async (what, fn) => { try { const said = await fn(); console.log("  ok  " + what + (said ? `: ${said}` : "")); }
    catch (e) { await page.screenshot({ path: path.join(SCRATCH, "fail.png") }).catch(() => {}); await browser.close(); fail(`${what}: ${e.message}${errors.length ? "\n  page errors: " + errors.join(" | ") : ""}`); } };
  const shot = async name => { if (!OUT) return; fs.mkdirSync(OUT, { recursive: true }); await page.waitForTimeout(600); await page.screenshot({ path: path.join(OUT, name + ".jpg"), type: "jpeg", quality: 88 }); };
  const B = (f, a) => page.evaluate(f, a);
  const loaded = name => page.waitForFunction(n => window.__anim && window.__anim.name === n && window.__anim.ctx && window.__anim.model && window.__anim.list.length && !/Reading/.test(document.querySelector("#status").textContent), name);
  const slide = async (id, v) => { await B(([id, v]) => { const e = document.querySelector("#" + id); e.value = v; e.dispatchEvent(new Event("input")); }, [id, v]); await page.waitForTimeout(250); };
  const walk = () => B(() => { const c = window.__anim.list.find(x => x.name === "walk_loop"); return c ? { secs: c.secs, speed: c.speed, arm: c.stats.arm_l, soft: c.stats.soft } : null; });
  const stepWidth = () => B(() => { const A = window.__anim, c = A.list.find(x => x.name === "walk_loop"), m = c.maker; let w = 0; for (let f = 0; f < m.n; f++) { const k = m.ctrl(f); w = Math.max(w, k.legs.l.ankle[0] - k.legs.r.ankle[0]); } return w; });

  await page.goto(URL_ + "?c=normal_woman");
  await step("the page: the three characters listed, the one asked for opened, measured and shown", async () => {
    await loaded("normal_woman");
    const r = await B(() => { const A = window.__anim; return { n: A.chars.length, kg: A.ctx.body.mass, from: A.ctx.body.from, soft: A.ctx.plan.length, softBones: A.ctx.plan.filter(b => A.bones.has(b.name)).length, bones: A.bones.size, set: A.set, read: document.querySelector("#body").textContent }; });
    if (r.n < 3) throw new Error(`${r.n} characters listed`);
    if (r.from !== "recipe" || r.kg < 48 || r.kg > 64) throw new Error(`measured ${r.kg.toFixed(1)} kg from its ${r.from}`);
    if (r.soft < 7 || r.softBones !== r.soft) throw new Error(`${r.soft} soft bones planned, ${r.softBones} in the page's skeleton`);
    if (!(r.set.style > 0.3)) throw new Error(`a feminine body's walk starts at style ${r.set.style}`);
    if (!/kg/.test(r.read)) throw new Error("no read-out of the body");
    return `${r.kg.toFixed(0)} kg from her own body, ${r.soft} soft bones, the walk's style starts at ${r.set.style}`;
  });
  await step("the walk made in the page and playing: its bones move, the feet stay on the floor", async () => {
    await page.click("#kinds button:nth-child(2)"); await page.waitForFunction(() => window.__anim.clip === "walk_loop");
    const a = await B(() => { const b = window.__anim.bones.get("l_upleg"); return b.quaternion.toArray(); }); await page.waitForTimeout(700);
    const r = await B(() => { const A = window.__anim, b = A.bones.get("l_upleg"), T = A.model.parent ? null : null; A.model.updateMatrixWorld(true); let low = 1e9; for (const n of ["l_ball", "r_ball", "l_foot", "r_foot"]) { const o = A.bones.get(n), p = o.getWorldPosition(new (o.position.constructor)()); low = Math.min(low, p.y); } return { q: b.quaternion.toArray(), low, t: A.t }; });
    if (Math.abs(a[0] - r.q[0]) + Math.abs(a[3] - r.q[3]) < 1e-4) throw new Error("the thigh isn't moving");
    if (r.low < 0.004) throw new Error(`a foot's joint ${(r.low * 1000).toFixed(0)} mm from the floor`);
    const w = await walk(); return `${w.speed.toFixed(2)} m/s, a stride every ${w.secs.toFixed(2)} s`;
  });
  await shot("animator_page");
  await step("the sliders: a feminine walk is narrower than a masculine one, a heavier body slower, a strong one quicker, softness scales the soft bones", async () => {
    await slide("style", 1); const fem = await stepWidth(); await slide("style", -1); const masc = await stepWidth(); if (!(masc > fem + 0.03)) throw new Error(`step width ${fem.toFixed(3)} feminine, ${masc.toFixed(3)} masculine`);
    await slide("style", 0.6); const w0 = await walk(); await slide("weight", 1); const w1 = await walk(); if (!(w1.speed < w0.speed - 0.08)) throw new Error(`heavier: ${w0.speed} -> ${w1.speed} m/s`);
    await slide("weight", 0); await slide("strength", 1); const w2 = await walk(); if (!(w2.speed > w0.speed + 0.03)) throw new Error(`stronger: ${w0.speed} -> ${w2.speed} m/s`);
    await slide("strength", 0.5); await slide("soft", 0); const s0 = await walk(); await slide("soft", 1.5); const s1 = await walk();
    if (!(s0.soft.soft_seat_l < 0.5 && s1.soft.soft_seat_l > 4)) throw new Error(`the seat moves ${s0.soft.soft_seat_l} mm at none, ${s1.soft.soft_seat_l} at most`);
    await slide("soft", 1); await page.click("#reset"); await page.waitForTimeout(250);
    return `step ${fem.toFixed(2)} m feminine, ${masc.toFixed(2)} m masculine; ${w0.speed.toFixed(2)} m/s, heavier ${w1.speed.toFixed(2)}, stronger ${w2.speed.toFixed(2)}`;
  });
  await step("every kind of clip made in the page: idle, run, sit, sleep, open, reach", async () => {
    const seen = [];
    for (let i = 1; i <= 7; i++) { await page.click(`#kinds button:nth-child(${i})`); await page.waitForTimeout(350); const r = await B(() => ({ kind: window.__anim.kind, clips: window.__anim.list.map(c => c.name), nan: window.__anim.list.some(c => c.tracks.some(t => t.r && t.r.some(v => !Number.isFinite(v)))) }));
      if (r.nan) throw new Error(`${r.kind}: a track that isn't a number`); if (!r.clips.length) throw new Error(`${r.kind}: no clips`); seen.push(`${r.kind} ${r.clips.length}`);
      if (r.kind === "sit") { await page.waitForTimeout(1800); await shot("animator_sit"); } }
    return seen.join(", ");
  });
  await step("Bake: every clip written into the character's own file, its record with it, the list says baked", async () => {
    await page.click("#kinds button:nth-child(2)"); await slide("style", 0.2);
    await page.click("#bake"); await page.waitForFunction(() => /baked,|failed/.test(document.querySelector("#status").textContent), null, { timeout: 240000 });
    const said = await B(() => document.querySelector("#status").textContent); if (!/baked,/.test(said)) throw new Error(said + "\n" + await B(() => document.querySelector("#log").textContent));
    const g = parseGlb(fs.readFileSync(path.join(PLACE, "normal_woman", "normal_woman.glb"))), rec = g.json.scenes[0].extras.hsMotion, names = (g.json.animations || []).map(a => a.name);
    for (const n of ["idle_loop", "walk_loop", "run_loop", "sit_down", "sit_loop", "stand_up", "lie_down", "sleep_loop", "get_up", "open_push", "open_pull", "open_slide", "reach_low", "reach_mid", "reach_high"]) if (!names.includes(n)) throw new Error(`no ${n} in the baked file`);
    if (!rec || rec.settings.style !== 0.2) throw new Error(`the record's settings: ${JSON.stringify(rec && rec.settings)}`);
    if (!fs.existsSync(path.join(PLACE, "normal_woman", "normal_woman.motion.json"))) throw new Error("no motion.json beside it");
    const listed = await B(() => window.__anim.chars.find(c => c.name === "normal_woman")); if (!listed.baked || listed.clips.length !== names.length) throw new Error("the list doesn't say it's baked");
    return `${names.length} clips, ${(fs.statSync(path.join(PLACE, "normal_woman", "normal_woman.glb")).size / 1e6).toFixed(1)} MB`;
  });
  await shot("animator_baked");
  await step("baked again from the page with other sliders: the same clips, the new settings, no bigger", async () => {
    const before = fs.statSync(path.join(PLACE, "normal_woman", "normal_woman.glb")).size;
    await page.reload(); await loaded("normal_woman"); const kept = await B(() => window.__anim.set.style); if (kept !== 0.2) throw new Error(`opened again its sliders start at ${kept}, not what it was baked with`);
    await slide("strength", 0.9); await page.click("#bake"); await page.waitForFunction(() => /baked,|failed/.test(document.querySelector("#status").textContent), null, { timeout: 240000 });
    const g = parseGlb(fs.readFileSync(path.join(PLACE, "normal_woman", "normal_woman.glb"))), rec = g.json.scenes[0].extras.hsMotion, after = fs.statSync(path.join(PLACE, "normal_woman", "normal_woman.glb")).size;
    if (rec.settings.strength !== 0.9 || rec.settings.style !== 0.2) throw new Error(JSON.stringify(rec.settings)); if (after > before * 1.03) throw new Error(`${before} -> ${after} bytes`);
    return `${(after / 1e6).toFixed(1)} MB after, ${(before / 1e6).toFixed(1)} before`;
  });
  if (REAL && OUT) await step(`a real export pictured (${REAL})`, async () => { await page.selectOption("#who", REAL); await loaded(REAL); await page.click("#kinds button:nth-child(2)"); await page.waitForTimeout(1500); await shot("animator_" + REAL); });
  if (errors.length) { await browser.close(); fail("page errors: " + errors.slice(0, 4).join(" | ")); }
  await browser.close(); server.kill();
  console.log(`ANIMATORPAGE ok (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
})();

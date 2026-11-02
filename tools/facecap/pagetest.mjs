// FACEMOCAP: the Face page (tools/facecap; docs/GODOT_ANIMATION_PLAN.md §3b) on its own server, a scratch library (the
// studio's expressions copied, and one made up) and a scratch Godot project, driven in a headless browser: the cards
// drawn as the default MHR wearing each (not a capsule, not the video); the project from --project, its faces/ empty;
// two faces ticked (a capture and a loop) and sent: their clips in faces/ and faces/loops/, marked in the list, the
// project remembered; a card opened, the face moving on the character in the preview, renamed and saved; a folder that
// isn't a project said so, Send off. With EXPR_VIDEO (a video of a face, and face_capture.py's MediaPipe set up) a video
// is imported too, else that part is skipped (faces stay out of git). --out <folder> keeps the guide's pictures there.
//   node tools/facecap/pagetest.mjs [--out guides/director/img]
import { createRequire } from "module";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../.."), SCRATCH = path.join(ROOT, "Saved", "facecap_check");
const LIB = path.join(SCRATCH, "lib"), PROJECT = path.join(SCRATCH, "project"), PORT = +(process.env.FACECAP_TEST_PORT || 8898);
const OUT = process.argv.includes("--out") ? path.resolve(process.argv[process.argv.indexOf("--out") + 1]) : null;
const URL_ = `http://127.0.0.1:${PORT}/`;
let server = null;
const fail = m => { console.error("FACEMOCAP FAIL: " + m); if (server) server.kill(); process.exit(1); };

// the scratch library: the studio's own expressions (expression.json only) and one made up (both eyes shut, a pout)
fs.rmSync(SCRATCH, { recursive: true, force: true });
fs.mkdirSync(LIB, { recursive: true }); fs.mkdirSync(PROJECT, { recursive: true });
fs.writeFileSync(path.join(PROJECT, "project.godot"), "config_version=5\n");
const STUDIO = path.join(ROOT, "Content", "Studio", "Expressions");
for (const d of fs.existsSync(STUDIO) ? fs.readdirSync(STUDIO) : []) {
  const f = path.join(STUDIO, d, "expression.json");
  if (fs.existsSync(f)) { fs.mkdirSync(path.join(LIB, d)); fs.copyFileSync(f, path.join(LIB, d, "expression.json")); }
}
const n = 30, ramp = i => +Math.sin(Math.PI * i / (n - 1)).toFixed(3);
fs.mkdirSync(path.join(LIB, "made_up"));
fs.writeFileSync(path.join(LIB, "made_up", "expression.json"), JSON.stringify({ name: "made up", version: 1, fps: 30, frames: n, secs: 1, neutral: "first", strength: 1, made: "2099-01-01T00:00:00",
  curves: { eyeBlinkLeft: Array.from({ length: n }, (_, i) => ramp(i)), eyeBlinkRight: Array.from({ length: n }, (_, i) => ramp(i)), mouthPucker: Array.from({ length: n }, (_, i) => ramp(i)) } }));
const loopId = fs.readdirSync(LIB).find(d => JSON.parse(fs.readFileSync(path.join(LIB, d, "expression.json"), "utf8")).loop);

(async () => {
  server = spawn("python3", [path.join(ROOT, "tools", "facecap", "serve.py"), "--port", String(PORT), "--library", LIB, "--project", PROJECT], { stdio: ["ignore", "pipe", "pipe"] });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(URL_ + "api/godot/projects")).ok) break; } catch (e) { } await new Promise(r => setTimeout(r, 250)); }
  const browser = await require("../browser.cjs").launch(chromium, { args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); }
    catch (e) { await page.screenshot({ path: path.join(SCRATCH, "fail.png") }).catch(() => {}); await browser.close(); fail(`${what}: ${e.message}${errors.length ? "\n  page errors: " + errors.join(" | ") : ""}`); } };
  const shot = async (name, el) => { if (!OUT) return; fs.mkdirSync(OUT, { recursive: true }); await (el ? page.locator(el) : page).screenshot({ path: path.join(OUT, name + ".jpg"), type: "jpeg", quality: 86 }); made.push(name); };
  const made = [];
  const canvasStats = sel => page.evaluate(q => { const v = document.querySelector(q); if (!v) return null;
    const g = v.getContext("2d") || null; let d;
    if (g) d = g.getImageData(0, 0, v.width, v.height).data;
    else { const c = document.createElement("canvas"); c.width = v.width; c.height = v.height; c.getContext("2d").drawImage(v, 0, 0); d = c.getContext("2d").getImageData(0, 0, v.width, v.height).data; }
    let s = 0, sq = 0, lit = 0; for (let i = 0; i < d.length; i += 4) { const y = d[i] + d[i + 1] + d[i + 2]; s += y; sq += y * y; if (y > 150) lit++; } const k = d.length / 4;
    return { mean: s / k, sd: Math.sqrt(Math.max(0, sq / k - (s / k) ** 2)), lit: lit / k }; }, sel);

  await page.goto(URL_);
  await step("the page: the library's cards, each the default MHR wearing the expression at its strongest (not a capsule, not the video)", async () => {
    await page.waitForFunction(() => window.__fc && document.querySelectorAll(".xp-card").length >= 2, null, { timeout: 120000 });
    const ids = await page.evaluate(() => [...document.querySelectorAll(".xp-card")].map(c => c.dataset.id));
    const want = fs.readdirSync(LIB).sort();
    if (JSON.stringify([...ids].sort()) !== JSON.stringify(want)) throw new Error(`cards ${ids} for ${want}`);
    if (await page.$(".xp-card img, .xp-card video")) throw new Error("a card shows the video");
    await page.waitForFunction(() => { const v = document.querySelector('.xp-card[data-id="made_up"] canvas'); if (!v) return false;
      const d = v.getContext("2d").getImageData(v.width / 2, v.height / 2, 1, 1).data; return d[0] + d[1] + d[2] > 60; }, null, { timeout: 120000 });
    const st = await canvasStats('.xp-card[data-id="made_up"] canvas');
    if (!st || st.sd < 12) throw new Error(`the card's picture is flat: ${JSON.stringify(st)}`);
    const body = await page.evaluate(() => Object.keys(window.__fc.stage.bodies));
    if (!body.some(b => /mhr/i.test(b))) throw new Error(`no MHR body loaded: ${body}`);
  });

  await step(`For Godot: the project the page was started for, its faces/ empty; a capture and a loop (${loopId}) ticked and sent, their clips in faces/ and faces/loops/, marked in the list`, async () => {
    const v = await page.inputValue("#fcProject");
    if (path.resolve(v) !== PROJECT) throw new Error(`the project field says ${v}`);
    await page.waitForFunction(() => /0 face clips/.test((document.querySelector("#fcState") || {}).textContent || ""), null, { timeout: 15000 });
    if (await page.isEnabled("#fcSend")) throw new Error("Send is on with nothing ticked");
    await page.check('#fcList input[data-id="made_up"]');
    if (loopId) await page.check(`#fcList input[data-id="${loopId}"]`);
    await page.click("#fcSend");
    await page.waitForSelector("#fcOut", { timeout: 60000 });
    const out = await page.textContent("#fcOut");
    if (!fs.existsSync(path.join(PROJECT, "faces", "made_up.tres"))) throw new Error(`no faces/made_up.tres (${out})`);
    if (loopId && !fs.existsSync(path.join(PROJECT, "faces", "loops", loopId + ".tres"))) throw new Error(`no faces/loops/${loopId}.tres (${out})`);
    const t = fs.readFileSync(path.join(PROJECT, "faces", "made_up.tres"), "utf8");
    if (!/script_class="HSFaceClip"/.test(t) || !/eyesClosed_L|lipPucker/.test(t)) throw new Error("the clip isn't an HSFaceClip moving the eyes and lips");
    const marks = await page.evaluate(() => [...document.querySelectorAll("#fcList .fc-row")].map(r => [r.querySelector("input").dataset.id, (r.querySelector(".fc-in") || {}).textContent || ""]));
    const m = Object.fromEntries(marks);
    if (!/faces\//.test(m.made_up) || (loopId && !/loops/.test(m[loopId]))) throw new Error(`the list's marks: ${JSON.stringify(marks)}`);
    const rec = await (await fetch(URL_ + "api/godot/projects")).json();
    if (rec.projects[0] !== PROJECT) throw new Error(`not remembered: ${JSON.stringify(rec)}`);
    await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));   // (the picture without the toast)
    await shot("f_facepage");
  });

  await step("a card opened: the face moving on the character in the preview, renamed and saved into the library", async () => {
    await page.click('.xp-card[data-id="made_up"] .xp-name');
    await page.waitForSelector(".mdl canvas.xp-canvas", { timeout: 60000 });
    await page.waitForFunction(() => { const P = window.__fc.XP.previewing; return P && P.fig && P.targets && P.targets.length; }, null, { timeout: 60000 });
    const face = () => page.evaluate(() => { let s = 0; for (const t of window.__fc.XP.previewing.targets || []) for (const i of t.idx || []) if (i >= 0) s += t.mesh.morphTargetInfluences[i] || 0; return s; });
    const a = []; for (let i = 0; i < 8; i++) { await page.waitForTimeout(150); a.push(await face()); }
    if (Math.max(...a) - Math.min(...a) < 0.05) throw new Error(`the face doesn't move in the preview (its shapes' weights ${a.map(v => v.toFixed(3)).join(" ")})`);
    await shot("f_facepreview", ".mdl");
    await page.fill(".xp-nameIn", "made up, renamed");
    await page.click(".mdl button.primary");
    await page.waitForFunction(() => !document.querySelector(".mdl"), null, { timeout: 15000 });
    const e = JSON.parse(fs.readFileSync(path.join(LIB, "made_up", "expression.json"), "utf8"));
    if (e.name !== "made up, renamed") throw new Error(`its name is ${e.name}`);
    await page.waitForFunction(() => [...document.querySelectorAll("#fcList .fc-nm")].some(x => x.textContent.includes("made up, renamed")), null, { timeout: 15000 });
  });

  await step("a folder that isn't a Godot project said so, Send off", async () => {
    await page.fill("#fcProject", SCRATCH);
    await page.press("#fcProject", "Enter"); await page.locator("#fcProject").blur();
    await page.waitForFunction(() => /isn't a Godot project/.test((document.querySelector("#fcState") || {}).textContent || ""), null, { timeout: 15000 });
    await page.check('#fcList input[data-id="made_up"]').catch(() => {});
    if (await page.isEnabled("#fcSend")) throw new Error("Send is on for a folder that isn't a project");
  });

  const video = process.env.EXPR_VIDEO || null;
  if (video) await step(`Import: ${path.basename(video)} solved, previewed, named, accepted into the library`, async () => {
    await page.setInputFiles("#exprPanel input[type=file]", video);
    await page.waitForSelector(".mdl .xp-prev", { timeout: 240000 });
    await page.fill(".xp-nameIn", "imported here"); await page.click(".mdl button.primary");
    await page.waitForSelector('.xp-card[data-id="imported_here"]', { timeout: 30000 });
    if (!fs.existsSync(path.join(LIB, "imported_here", "clip.mp4"))) throw new Error("no clip kept with it");
  });
  else console.log("  --  no video to import (EXPR_VIDEO, with face_capture.py's MediaPipe set up): the import is skipped");

  await browser.close(); server.kill();
  if (errors.length) fail("page errors: " + errors.join(" | "));
  if (OUT) console.log("  " + made.join(", "));
  console.log("FACEMOCAP ok");
})().catch(e => fail(e.stack || e.message));

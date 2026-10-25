// GUIDE: the pictures in the desk's guide (guide.html), made by driving the desk in a headless browser through what
// each one shows: the board, a quick task, an act, a scene's script, typing it, a take's waveform, the timeline, the
// stage by mouse, the pickers with pictures, a task's beats, the Database, the problems, Go to, the Watch, the debug
// panel, a round, the saves kept, the keys. Every step is checked as it's done, so it's also a test of them: it ends
// "GUIDE ok". Nothing is saved to the games: a take and a scratch game it makes are removed after.
//   python tools/director/serve.py          (in another shell)
//   node tools/director/guide_shots.mjs      (DESK_URL for another port; the pictures go to tools/director/guide/)
import { createRequire } from "module";
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, "..", ".."), OUT = join(HERE, "guide");
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
const BASE = (process.env.DESK_URL || "http://127.0.0.1:8780/").replace(/\/?$/, "/"), SCRATCH = "ZzGuide";
const fails = [], ok = m => console.log("  ok  " + m), fail = m => { fails.push(m); console.log("  FAIL " + m); };
mkdirSync(OUT, { recursive: true });

// a take for the waveform: a voice-like burst between half a second of silence each side (16-bit PCM)
function wav() {
  const sr = 22050, n = Math.round(sr * 3.4), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const t = i / sr; let v = 0.002 * (rnd() - 0.5);
    if (t > 0.55 && t < 2.75) { const env = Math.abs(Math.sin((t - 0.55) * Math.PI * 2.6)) ** 0.6 * Math.min(1, (t - 0.55) * 8, (2.75 - t) * 8); v = env * (0.45 * Math.sin(2 * Math.PI * 180 * t) + 0.2 * Math.sin(2 * Math.PI * 360 * t) + 0.12 * (rnd() - 0.5)); }
    b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32000), 44 + i * 2);
  }
  return b;
}

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", e => errors.push(e.message));
p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
p.on("dialog", d => d.accept());
const wait = ms => p.waitForTimeout(ms);
const box = async sel => { const r = await p.$eval(sel, x => { const b = x.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; }); return r; };
const pad = (r, k = 8) => ({ x: Math.max(0, r.x - k), y: Math.max(0, r.y - k), width: Math.min(1500 - Math.max(0, r.x - k), r.width + 2 * k), height: Math.min(950 - Math.max(0, r.y - k), r.height + 2 * k) });
const SIZES = {};                                  // each picture's size, written into guide.html's <img> tags at the end
async function shot(name, clip, what) {
  try { await p.screenshot({ path: join(OUT, name + ".jpg"), type: "jpeg", quality: 82, clip: clip || undefined }); SIZES[name] = clip ? [Math.round(clip.width), Math.round(clip.height)] : [1500, 950]; ok(`${name}: ${what}`); }
  catch (e) { fail(`${name}: ${e.message.split("\n")[0]}`); }
}
async function step(what, fn) { try { await fn(); } catch (e) { fail(`${what}: ${e.message.split("\n")[0]}`); await p.keyboard.press("Escape").catch(() => {}); } }
const ready = async (sel, n = 1, ms = 60000) => p.waitForFunction(([s, n]) => [...document.querySelectorAll(s)].filter(i => i.src && !i.src.startsWith("data:image/gif") && !i.classList.contains("stale")).length >= n, [sel, n], { timeout: ms });
const open = async (game = "Sample") => {
  await p.goto(BASE + "?game=" + game);
  await p.waitForFunction(() => window.__dd && window.__dd.S && window.__dd.PLAN && document.querySelectorAll("#board .card").length >= 1, null, { timeout: 90000 });
  await wait(600);
};
const scr = (x, y, z) => p.evaluate(([x, y, z]) => { const st = window.__dd.flowStage, V = st.camera.position.constructor, v = new V(x, z, -y).project(st.camera), r = st.renderer.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, [x, y, z]);
const tab = async name => { for (const t of await p.$$(".ltabs button")) if ((await t.textContent()).trim() === name) { await t.click(); return; } throw new Error("no tab " + name); };
const take = join(ROOT, "Footage", "Sample", "Sample_s_message_main_c1.wav");

try {
  console.log("the desk");
  await open();
  await step("the toolbar", async () => shot("toolbar", { x: 0, y: 0, width: 1500, height: 72 }, "the toolbar"));
  await step("the board", async () => {
    await ready("#board img.cardpic", 3, 90000); await wait(800);
    await shot("board", { x: 0, y: 36, width: 820, height: 530 }, "the flow board, its scene cards with their frames");
  });
  await step("a card's menu", async () => {
    const c = await p.$('#board .card[data-id="n_message"]'), b = await c.boundingBox();
    await p.mouse.click(b.x + 40, b.y + 20, { button: "right" }); await p.waitForSelector(".cmenu"); await wait(150);
    const m = await box(".cmenu"); await shot("board-menu", pad({ x: b.x - 10, y: b.y - 10, width: m.x + m.width - b.x + 20, height: Math.max(b.height, m.y + m.height - b.y) + 20 }, 4), "a card's right-click menu");
    await p.keyboard.press("Escape");
  });
  await step("an act", async () => {
    await p.evaluate(() => { const S = window.__dd.S; S.frames = [{ id: "f_guide", title: "Act 1: the visit", color: "#8a63d2", nodes: ["n_arrive", "n_message", "n_game"] }]; window.__dd.touch(); });
    await wait(500); await p.evaluate(() => { const B = window.__dd.board; B.center("n_hide1"); if (B.mini.style.display === "none") B.toggleMini(); }); await wait(400);
    await shot("board-acts", { x: 208, y: 72, width: 612, height: 490 }, "an act around three cards, the minimap");
    await p.keyboard.press("m").catch(() => {});
    await p.evaluate(() => { delete window.__dd.S.frames; window.__dd.touch(); });
  });
  await step("a quick task", async () => {
    if (!(await p.$(".quick .qchip, .quick button"))) throw new Error("no quick tasks");
    await p.click(".quick .qchip, .quick button >> nth=0"); await p.waitForSelector(".mdl"); await wait(300);    // by selector: the live check redraws the panel
    await shot("quick-task", pad(await box(".mdl")), "a quick task's blanks, and what it makes");
    await p.keyboard.press("Escape"); await wait(200);
  });
  await step("the script", async () => {
    await p.click('#board .card[data-id="n_message"]'); await ready(".lpicw img.pic", 4, 90000); await wait(500);
    await shot("script", { x: 820, y: 72, width: 680, height: 878 }, "a scene as a script: what the player sees, who, the words");
  });
  await step("typing a line", async () => {
    await p.click(".typeline"); await p.keyboard.type("Mari: Did you hear that? [CU]"); await p.keyboard.press("Enter"); await wait(400);
    await p.keyboard.type("(she glances at the cellar door)"); await p.keyboard.press("Enter"); await wait(400);
    const last = await p.evaluate(() => { const c = window.__dd.S.scenes.s_message.clips; return c[c.length - 1]; });
    if (last.en !== "Did you hear that?" || last.act !== "she glances at the cellar door" || last.shot !== "cu") throw new Error("the typed line: " + JSON.stringify(last));
    const r = await box(".typerow"); await shot("typing", pad({ x: 820, y: r.y - 150, width: 680, height: 200 }, 0), "a line typed under the script, its note");
    for (const b of await p.$$("#inspector button")) if ((await b.textContent()).includes("Edit as text")) { await b.click(); break; }
    await p.waitForSelector(".scriptdlg"); await wait(300);
    await shot("script-text", pad(await box(".mdl")), "the scene as text, and what applying it does");
    await p.keyboard.press("Escape"); await wait(200);
  });
  await step("the take's waveform", async () => {
    if (!(await p.$(".ltabs"))) { await p.click(".clip.line >> nth=0 >> .ltext"); await wait(300); }
    await tab("Take"); await wait(200);
    const [fc] = await Promise.all([p.waitForEvent("filechooser"), p.click(".lpane .dropzone")]);
    await fc.setFiles({ name: "take.wav", mimeType: "audio/wav", buffer: wav() });
    await p.waitForFunction(() => window.__dd.S.scenes.s_message.clips[0].dur > 0, null, { timeout: 30000 });
    await tab("Take"); await p.waitForFunction(() => /the take/.test((document.querySelector(".wave-i") || {}).textContent || ""), null, { timeout: 30000 }); await wait(300);
    const r = await box(".wavebox"); await shot("take-wave", pad({ x: r.x, y: r.y - 70, width: r.width, height: r.height + 70 }), "a take's waveform, the trims and the body's span");
  });
  await step("the timeline", async () => {
    await p.$eval("#tlbar", x => x.scrollIntoView({ block: "center" })); await wait(400);
    const cue = await p.$("#tlbar .cue"); if (!cue) throw new Error("no cue");
    const cb = await cue.boundingBox(), segs = await p.$$eval("#tlbar .seg", xs => xs.map(x => { const r = x.getBoundingClientRect(); return { t: x.textContent, l: r.left }; }));
    const c3 = segs.find(s => s.t.startsWith("c3")) || segs[segs.length - 1];
    await p.mouse.move(cb.x + 1, cb.y + 4); await p.mouse.down(); await p.mouse.move(c3.l + 3, cb.y + 4, { steps: 8 }); await wait(150);
    const tb = await box("#tlbar"); await shot("timeline", pad({ x: tb.x, y: tb.y - 46, width: tb.width, height: tb.height + 70 }), "a cue dragged along the timeline onto a clip's edge");
    await p.mouse.up(); await wait(300);
  });
  await step("the stage: dragging", async () => {
    await p.click('#board .card[data-id="n_message"]'); await wait(600);
    const a = await scr(2, 5.4, 1.0), z = await scr(2.05, 3.65, 0);
    await p.mouse.move(a[0], a[1]); await p.mouse.down(); for (let i = 1; i <= 10; i++) await p.mouse.move(a[0] + (z[0] - a[0]) * i / 10 * 0.6, a[1] + (z[1] - a[1]) * i / 10 * 0.6);
    await wait(200); const sb = await box("#stageBox"); await shot("stage-drag", sb, "Mari dragged across the floor: the rings are the marks");
    await p.mouse.up(); await wait(400); await p.keyboard.press("Control+z"); await wait(300);
  });
  await step("the stage: right-click", async () => {
    const sb = await box("#stageBox"), at = await p.evaluate(r => {          // a point of the floor in view
      for (let y = r.y + r.height - 14; y > r.y + r.height * 0.5; y -= 12) for (let x = r.x + 60; x < r.x + r.width - 60; x += 40) { const h = window.__dd.flowStage.pickAt(x, y); if (h && h.kind === "floor") return [x, y]; }
      return null; }, sb);
    if (!at) throw new Error("no floor in view");
    await p.mouse.click(at[0], at[1], { button: "right" }); await p.waitForSelector(".cmenu"); await wait(150);
    const m = await box(".cmenu"), x0 = Math.min(sb.x, m.x), y0 = Math.min(sb.y, m.y);
    await shot("stage-menu", pad({ x: x0, y: y0, width: Math.max(sb.x + sb.width, m.x + m.width) - x0, height: Math.max(sb.y + sb.height, m.y + m.height) - y0 }, 0), "the floor's right-click menu");
    await p.keyboard.press("Escape");
  });
  await step("the stage: free camera", async () => {
    await p.click("#sFree"); await wait(600); await shot("free-cam", await box("#stageBox"), "the free camera: the player's marker in orange");
    await p.click("#sFree"); await wait(300);
  });
  await step("the pose picker", async () => {
    if (!(await p.$(".ltabs"))) { await p.click(".clip.line >> nth=0 >> .ltext"); await wait(200); }    // the line open (it may be already)
    await tab("Body"); await wait(300);
    await p.click(".lpane .ppk"); await p.waitForSelector(".ppk-pop"); await ready(".ppk-pop img.pic-pose", 10, 90000); await wait(400);
    await shot("pose-picker", pad(await box(".ppk-pop")), "a pose picked from pictures");
    await p.keyboard.press("Escape"); await wait(200);
  });
  await step("a task's beats", async () => {
    await p.click('#board .card[data-id="n_arrive"]'); await wait(600);
    await shot("beats", { x: 820, y: 72, width: 680, height: 878 }, "a task's beats as event pages");
    await p.click("#inspector .a-add >> nth=0"); await p.waitForSelector(".pal-search"); await wait(300);
    await shot("palette", pad(await box(".mdl")), "the command palette");
    await p.keyboard.type("behav"); await wait(200); await p.keyboard.press("Enter"); await p.waitForSelector(".mdl .ppk", { timeout: 5000 });
    await p.click(".mdl .ppk"); await p.waitForSelector(".ppk-pop"); await ready(".ppk-pop img.pic-cast", 1, 60000); await wait(300);
    const m = await box(".mdl"), pp = await box(".ppk-pop");
    await shot("command-form", pad({ x: m.x, y: m.y, width: Math.max(m.x + m.width, pp.x + pp.width) - m.x, height: Math.max(m.y + m.height, pp.y + pp.height) - m.y }), "a command's form, the cast picked by face");
    await p.keyboard.press("Escape"); await wait(150); await p.keyboard.press("Escape"); await wait(200);
  });
  await step("the Database", async () => {
    await p.click('nav button[data-v="dbView"]'); await p.evaluate(() => window.__dd.openDb("cast")); await ready(".db-portrait img.pic", 1, 60000); await wait(400);
    await shot("database", { x: 0, y: 36, width: 1500, height: 560 }, "the Database: the cast, a portrait, every use");
    await p.evaluate(() => window.__dd.openDb("motions", "mari_idle")); await ready(".db-portrait img.pic-table", 1, 60000); await wait(300);
    await shot("db-motions", { x: 0, y: 36, width: 1500, height: 520 }, "the reusable motions, as pictures");
  });
  await step("the problems", async () => {
    await p.click('nav button[data-v="flowView"]'); await wait(300);
    await p.evaluate(() => { const S = window.__dd.S; S.scenes.s_message.clips[1].who = "nobody"; window.__dd.touch(); });
    await wait(900); await p.click("#problemsBtn"); await p.waitForSelector(".ppanel"); await wait(300);
    await shot("problems", pad(await box(".ppanel")), "the problems, found as you edit");
    await p.click("#problemsBtn"); await p.keyboard.press("Control+z"); await wait(300);
  });
  await step("go to anything", async () => {
    await p.keyboard.press("Control+k"); await p.waitForSelector(".goto-in"); await p.keyboard.type("knock"); await wait(200);
    await shot("goto", pad(await box(".goto")), "Ctrl+K: a card, a line, a beat, an action");
    await p.keyboard.press("Escape");
  });
  await step("the keys", async () => {
    await p.click("#keysHelp"); await p.waitForSelector(".help"); await wait(200);
    await shot("help", pad(await box(".mdl")), "the keys and help");
    await p.keyboard.press("Escape");
  });
  console.log("playing it");
  await step("the Watch", async () => {
    await p.click('nav button[data-v="watchView"]'); await wait(300);
    await p.evaluate(() => { document.querySelector("#wFast").checked = false; document.querySelector("#wPlay").checked = false; window.__dd.watch("n_message"); });
    await wait(3500); await shot("watch", { x: 0, y: 36, width: 1500, height: 914 }, "the Watch: the scene from the player's eye");
    await p.evaluate(() => window.__dd.stopWatch()); await wait(400);
  });
  await step("the debug panel", async () => {
    await p.keyboard.press("F9"); await p.waitForSelector(".dbg"); await wait(300);
    await shot("debug", pad(await box(".dbg")), "the debug panel: the state a playthrough starts from");
    await p.keyboard.press("F9");
  });
  await step("a round", async () => {
    await p.evaluate(() => { document.querySelector("#wFast").checked = false; window.__dd.watch("n_game"); });
    await p.waitForSelector(".wcard.round", { timeout: 90000 }); await wait(2500);
    await shot("round", { x: 0, y: 36, width: 1500, height: 914 }, "a round: the seeker counting behind its card");
    await p.evaluate(() => window.__dd.stopWatch()); await wait(400);
  });
  console.log("the saves kept");
  await step("the saves kept", async () => {
    await fetch(BASE + "api/new/" + SCRATCH, { method: "POST" });
    await open(SCRATCH);
    for (const t of ["The first draft", "The second draft"]) { await p.evaluate(t => { window.__dd.S.game.title = t; window.__dd.touch(); }, t); await p.keyboard.press("Control+s"); await wait(1300); }
    await p.click("#history"); await p.waitForSelector(".hist-i"); const rows = await p.$$(".hist-i"); await rows[rows.length - 1].click(); await p.waitForSelector(".hist-diff h4"); await wait(200);
    await shot("history", pad(await box(".mdl")), "the saves kept, and what's different now");
    await p.keyboard.press("Escape");
  });
} finally {
  rmSync(join(ROOT, "Content", "Games", SCRATCH), { recursive: true, force: true }); rmSync(join(ROOT, "Saved", "Story", SCRATCH), { recursive: true, force: true });
  if (existsSync(take)) rmSync(take);
  await browser.close();
}
{                                                  // the guide's pictures sized, so its links land where they point before the pictures load
  const g = join(HERE, "guide.html"), html = readFileSync(g, "utf8");
  const out = html.replace(/<img src="guide\/([a-z0-9-]+)\.jpg"(?: width="\d+" height="\d+")?/g, (m, n) => SIZES[n] ? `<img src="guide/${n}.jpg" width="${SIZES[n][0]}" height="${SIZES[n][1]}"` : m);
  if (out !== html) writeFileSync(g, out);
  const missing = [...html.matchAll(/src="guide\/([a-z0-9-]+)\.jpg"/g)].map(m => m[1]).filter(n => !existsSync(join(OUT, n + ".jpg")));
  if (missing.length) fail("pictures the guide shows but none was made: " + missing.join(", "));
}
const real = errors.filter(e => !/GL Driver|GroupMarker|swiftshader|WebGL/i.test(e));
if (real.length) fail("the page said: " + real.slice(0, 3).join(" · "));
console.log(fails.length ? `GUIDE FAILED (${fails.length})` : "GUIDE ok");
process.exit(fails.length ? 1 : 0);

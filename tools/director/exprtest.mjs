// EXPRESSIONS: the expression library in the desk (docs/EXPRESSIONS_PLAN.md §1), driven in a headless browser. The
// Expressions tab beside the Inspector; a card drawn as the character wearing the expression (not the video), played
// through on hover; names only; the preview on the default body, a cast member and a Studio export (the face moving on
// each); Import (a video solved by tools/face_capture.py, previewed, named, accepted); rename; the red x asking first and
// moving it to Saved/Expressions/removed. Faces stay out of git, so the video is EXPR_VIDEO, or a clip already in the
// library, or (neither) the import is skipped and a made-up expression is used for the rest.
//   node tools/director/exprtest.mjs          (the desk's server running; DESK_URL for another port)
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const { chromium } = createRequire(import.meta.url)("playwright");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../.."), LIB = path.join(ROOT, "Content/Studio/Expressions");
const DESK = (process.env.DESK_URL || "http://127.0.0.1:8780/") + "?game=Pilot", TEST = "exprtest";
const fail = m => { console.error("EXPRESSIONS FAIL: " + m); cleanup(); process.exit(1); };
const cleanup = () => { for (const d of fs.existsSync(LIB) ? fs.readdirSync(LIB) : []) if (d.startsWith(TEST)) fs.rmSync(path.join(LIB, d), { recursive: true, force: true });
  const gone = path.join(ROOT, "Saved/Expressions/removed"); for (const d of fs.existsSync(gone) ? fs.readdirSync(gone) : []) if (d.startsWith(TEST)) fs.rmSync(path.join(gone, d), { recursive: true, force: true }); };

let video = process.env.EXPR_VIDEO || null;
if (!video && fs.existsSync(LIB)) for (const d of fs.readdirSync(LIB)) { const f = path.join(LIB, d, "clip.mp4"); if (!d.startsWith(TEST) && fs.existsSync(f)) { video = path.join(ROOT, "Saved", `${TEST}_input.mp4`); fs.copyFileSync(f, video); break; } }

(async () => {
  cleanup();
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { await page.screenshot({ path: "exprtest_fail.png" }); await browser.close(); fail(`${what}: ${e.message}${errors.length ? "\n  page errors: " + errors.join(" | ") : ""}`); } };
  await page.goto(DESK);
  await page.waitForFunction(() => window.__dd && window.__dd.S && window.__dd.flowStage && Object.keys(window.__dd.flowStage.bodies).length, null, { timeout: 60000 });
  await page.evaluate(() => { try { localStorage.removeItem("dd.exprWho"); localStorage.removeItem("dd.exprNames"); } catch (e) { } });
  let id = null;

  if (video) await step(`Import: ${path.basename(process.env.EXPR_VIDEO || "a clip in the library")} solved, previewed beside the character, named, accepted`, async () => {
    await page.click('#rtabs button[data-r="exprPanel"]'); await page.waitForSelector("#xpImport");
    await page.setInputFiles("#exprPanel input[type=file]", video);
    await page.waitForSelector(".mdl .xp-prev", { timeout: 180000 });
    const n = await page.evaluate(() => ({ video: !!document.querySelector(".mdl video.xp-video"), canvas: !!document.querySelector(".mdl canvas.xp-canvas"), who: [...document.querySelector(".xp-prev select").options].map(o => o.value) }));
    if (!n.video || !n.canvas || !n.who.includes("mhr") || !n.who.includes("cast:mari")) throw new Error(JSON.stringify(n));
    await page.fill(".xp-nameIn", TEST + " imported"); await page.click(".mdl button.primary");
    await page.waitForSelector(`.xp-card[data-id="${TEST}_imported"]`, { timeout: 30000 }); id = TEST + "_imported";
    const e = JSON.parse(fs.readFileSync(path.join(LIB, id, "expression.json"), "utf8"));
    if (e.name !== TEST + " imported" || !Object.keys(e.curves).length || !fs.existsSync(path.join(LIB, id, "clip.mp4"))) throw new Error(`the kept expression: ${JSON.stringify({ name: e.name, curves: Object.keys(e.curves).length })}`);
  });
  else {                                               // no video on this machine: a made-up one (both eyes shut, then a pout)
    console.log("  --  no video to import (EXPR_VIDEO, or a clip in the library): the import is skipped");
    id = TEST + "_made"; fs.mkdirSync(path.join(LIB, id), { recursive: true });
    const n = 30, ramp = i => Math.sin(Math.PI * i / (n - 1));
    fs.writeFileSync(path.join(LIB, id, "expression.json"), JSON.stringify({ name: TEST + " made", version: 1, fps: 30, frames: n, secs: 1, neutral: "first", strength: 1, made: "2099-01-01T00:00:00",
      curves: { eyeBlinkLeft: Array.from({ length: n }, (_, i) => +ramp(i).toFixed(3)), eyeBlinkRight: Array.from({ length: n }, (_, i) => +ramp(i).toFixed(3)), mouthPucker: Array.from({ length: n }, (_, i) => +ramp(i).toFixed(3)) } }));
    await page.click('#rtabs button[data-r="exprPanel"]'); await page.waitForSelector("#xpImport");
  }

  await step("the card is the character wearing it (at its strongest moment, not the video), and hover plays it through", async () => {
    await page.evaluate(() => window.__dd.XP.refresh());
    const card = `.xp-card[data-id="${id}"]`;
    await page.waitForSelector(`${card} canvas`);
    if (await page.$(`${card} img, ${card} video`)) throw new Error("the card shows the video or a picture of it");
    const sum = () => page.evaluate(c => { const v = document.querySelector(c + " canvas"), d = v.getContext("2d").getImageData(0, 0, v.width, v.height).data; let s = 0, sq = 0; for (let i = 0; i < d.length; i += 4) { s += d[i]; sq += d[i] * d[i]; } const n = d.length / 4; return { s, sd: Math.sqrt(sq / n - (s / n) ** 2) }; }, card);
    await page.waitForFunction(c => { const v = document.querySelector(c + " canvas"), d = v.getContext("2d").getImageData(v.width / 2, v.height / 2, 1, 1).data; return d[0] + d[1] + d[2] > 0; }, card, { timeout: 60000 });
    const still = await sum();
    if (!(still.sd > 20)) throw new Error(`the card's picture is flat (sd ${still.sd.toFixed(1)})`);
    await page.hover(card); const a = []; for (let i = 0; i < 6; i++) { await page.waitForTimeout(150); a.push((await sum()).s); }
    if (new Set(a).size < 3) throw new Error("hovering doesn't play it: " + a.join(", "));
    await page.mouse.move(5, 5);
  });
  await step("names only: a list of names, no pictures; off again", async () => {
    await page.check("#exprPanel .xp-tog input"); const n = await page.evaluate(() => ({ names: document.querySelectorAll(".xp-grid.names .xp-card").length, pics: document.querySelectorAll(".xp-grid canvas").length }));
    await page.uncheck("#exprPanel .xp-tog input");
    if (!(n.names > 0) || n.pics) throw new Error(JSON.stringify(n));
  });
  await step("the preview: the face moves on the default body, on a cast member in their body and on a Studio export (exported again with its corners' MHR points)", async () => {
    const r = await page.evaluate(async id => {
      const FACE = await import("/shared/face.js"), { FacePreview } = await import("/expressions.js"), M = await FACE.loadMap();
      const people = (await (await fetch("/api/bodies")).json()).bodies.filter(f => f.startsWith("people/"));
      const e = await (await fetch(`/api/expressions/${id}`)).json(), w = FACE.toMHR(FACE.sample(e, 0.0), M), at = (FACE.toMHR(FACE.sample(e, e.secs * 0.5), M));
      const out = {}, box = document.createElement("div"); document.body.append(box);
      for (const who of ["mhr", "cast:mari", ...people.slice(0, 1)]) {
        const P = new FacePreview(box, window.__dd.XP.ctx, 160), note = await P.wear(who);
        const shot = () => { const c = document.createElement("canvas"); c.width = c.height = 160; c.getContext("2d").drawImage(P.renderer.domElement, 0, 0); return c.getContext("2d").getImageData(0, 0, 160, 160).data; };
        P.frame(null); const a = shot(); P.frame(FACE.toMHR(Object.fromEntries(Object.keys(e.curves).map(k => [k, 1])), M)); const b = shot();
        let diff = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) > 24) diff++;
        out[who] = { note, targets: P.targets.length, changed: diff }; P.dispose();
      }
      return { out, moving: Math.max(...w) !== Math.max(...at) || w.some((v, i) => v !== at[i]) };
    }, id);
    for (const [who, v] of Object.entries(r.out)) if (v.note || !v.targets || v.changed < 40) throw new Error(`${who}: ${JSON.stringify(v)}`);
    if (!r.moving) throw new Error("the expression doesn't change over its length");
    console.log("       pixels changed by the face, fully on: " + Object.entries(r.out).map(([w, v]) => `${w} ${v.changed}`).join(", "));
  });
  await step("click a card: the preview opens; a new name saved keeps its folder", async () => {
    await page.click(`.xp-card[data-id="${id}"]`); await page.waitForSelector(".mdl .xp-prev");
    await page.fill(".xp-nameIn", TEST + " renamed"); await page.click(".mdl button.primary");
    await page.waitForFunction(id => [...document.querySelectorAll(`.xp-card[data-id="${id}"] .xp-name`)].some(n => n.textContent.includes("renamed")), id, { timeout: 20000 });
  });
  await step("the red x asks first (Cancel keeps it), then Remove moves it to Saved/Expressions/removed", async () => {
    await page.hover(`.xp-card[data-id="${id}"]`); await page.click(`.xp-card[data-id="${id}"] .xp-x`);
    await page.waitForSelector(".mdl"); const asked = await page.textContent(".mdl");
    if (!/Remove this expression/.test(asked)) throw new Error("no question: " + asked);
    await page.click(".mdl .mdl-f button:not(.primary)"); await page.waitForTimeout(300);
    if (!(await page.$(`.xp-card[data-id="${id}"]`)) || !fs.existsSync(path.join(LIB, id))) throw new Error("Cancel removed it");
    await page.click(`.xp-card[data-id="${id}"] .xp-x`); await page.click(".mdl button.primary");
    await page.waitForFunction(id => !document.querySelector(`.xp-card[data-id="${id}"]`), id, { timeout: 20000 });
    const kept = fs.readdirSync(path.join(ROOT, "Saved/Expressions/removed")).some(d => d.startsWith(id));
    if (fs.existsSync(path.join(LIB, id)) || !kept) throw new Error(`still in the library ${fs.existsSync(path.join(LIB, id))}, kept ${kept}`);
  });
  if (errors.length) { await browser.close(); fail("page errors: " + errors.join(" | ")); }
  await browser.close(); cleanup(); if (video && !process.env.EXPR_VIDEO) fs.rmSync(video, { force: true });
  console.log("EXPRESSIONS ok");
})().catch(e => fail(e.stack || e.message));

// PROPPAGE: the prop generator's page in a headless browser, on its own server with a scratch copy of the recipe book,
// a scratch folder for what's made and one for pictures (PROPS_PRESETS, PROPS_OUT, PROPS_IMAGES), so your recipes and
// props are never touched. Every recipe a card; one opened into its form and changed there; made by Blender from the
// page, its log followed and its picture on its card, the paint under your pictures beside its maps. Then the picture
// editor (docs/PROPGEN.md §17): the texture with its cuts read from the model's UVs, its parts and own pictures as
// layers, the prop in 3D wearing the canvas; pictures added; a file from the desktop dropped onto a part its shape,
// filling it; a logo dropped onto a part, placed where it lands; one onto one of its own pictures, taking its place;
// the logo sized, turned and moved by its handles, Ctrl+Z a step back; a picture the texture's shape over the whole
// texture in its layout; a smudge dragged onto a part; the logo made a flourish in each corner; made again with all
// of it, the made texture where the canvas said; the made prop in 3D with its sockets; a PBR set picked; the layout's
// template for Krita (.ora) and back in; a part picked on the prop in 3D; two variations made at once; kept as a
// recipe of its own (`from` its base and only what differs), then deleted again. Blender is needed (propgen.py's).
//   node tools/propgen/pagetest.mjs           (PROPS_TEST_PORT for another port than 8792)
import { createRequire } from "module";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import net from "net";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const { launch } = require("../browser.cjs");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const PORT = +(process.env.PROPS_TEST_PORT || 8792), PAGE = `http://127.0.0.1:${PORT}`;
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "props-page-"));
const PRESETS = path.join(HOME, "presets.json"), OUT = path.join(HOME, "Props"), IMAGES = path.join(HOME, "images");
fs.copyFileSync(path.join(ROOT, "Content", "Studio", "Props", "presets.json"), PRESETS);
const fails = [], ok = m => console.log("  ok  " + m), fail = m => { fails.push(m); console.log("  FAIL " + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const free = port => new Promise(r => { const s = net.createConnection(port, "127.0.0.1"); s.on("connect", () => { s.destroy(); r(false); }); s.on("error", () => r(true)); });
const book = () => JSON.parse(fs.readFileSync(PRESETS, "utf8"));
const sha = f => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex");
const t0 = Date.now();

if (!(await free(PORT))) { console.log(`port ${PORT} is taken: PROPS_TEST_PORT=<another> node tools/propgen/pagetest.mjs`); process.exit(1); }
const srv = spawn(process.env.PYTHON || "python3", ["tools/propgen/serve.py"], {
  cwd: ROOT, env: Object.assign({}, process.env, { PROPS_PORT: String(PORT), PROPS_PRESETS: PRESETS, PROPS_OUT: OUT, PROPS_IMAGES: IMAGES }),
  stdio: ["ignore", "pipe", "pipe"],
});
let srvOut = "";
srv.stdout.on("data", d => { srvOut += d; });
srv.stderr.on("data", d => { srvOut += d; });
for (let i = 0; i < 60 && await free(PORT); i++) await sleep(150);

const browser = await launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error" && !/favicon/.test(m.text())) errors.push(m.text()); });
page.on("dialog", d => d.accept());
const step = async (what, fn) => {
  try { const note = await fn(); ok(what + (note ? `: ${note}` : "")); } catch (e) { fail(`${what}: ${e.message.split("\n")[0]}`); await page.screenshot({ path: path.join(HOME, "fail.png") }).catch(() => { }); }
};
const S = () => page.evaluate(() => JSON.parse(JSON.stringify({ name: window.__pp.name, spec: window.__pp.spec, meta: window.__pp.meta, pics: window.__pp.pics,
  job: window.__pp.job, decal: window.__pp.decal, viewInfo: window.__pp.viewInfo, list: window.__pp.list.map(r => ({ name: r.name, made: r.made, thumb: r.thumb, unsaved: r.unsaved })) })));
async function makeAndWait(limit = 420000) {
  const before = await page.evaluate(() => window.__pp.job && window.__pp.job.id);
  await page.click("#make");
  await page.waitForFunction(b => window.__pp.job && window.__pp.job.id !== b && window.__pp.job.finished, before, { timeout: limit });
  const j = (await S()).job;
  if (j.state !== "done") throw new Error(`the make ${j.state}: ${(await page.textContent("#job-log")).slice(-400)}`);
  return j;
}

try {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__pp && window.__pp.ready, null, { timeout: 30000 });
  await step("every recipe a card, none made yet in the scratch folder", async () => {
    const n = Object.keys(book()).filter(k => !k.startsWith("_")).length;
    const cards = await page.locator(".card").count(), ph = await page.locator(".card .ph").count();
    if (cards !== n) throw new Error(`${cards} cards for ${n} recipes`);
    if (ph !== n) throw new Error(`${ph} of them say not made`);
    return `${cards} cards`;
  });
  await step("a recipe opened into its form, its words changed there", async () => {
    await page.click('.card[data-name="ema"]');
    await page.waitForFunction(() => window.__pp.name === "ema");
    const text = page.locator('#tab-settings .row:has(label[title="art.text"]) input');
    await text.fill("奉納テスト");
    const wish = page.locator('#tab-settings .row:has(label[title="back.wish"]) textarea');
    await wish.fill("ゆるさない");
    const s = await S();
    if (s.spec.art.text !== "奉納テスト" || s.spec.back.wish !== "ゆるさない") throw new Error(JSON.stringify([s.spec.art, s.spec.back]));
    if (!(await page.textContent("#dirty")).includes("Changed")) throw new Error("no word that it's changed");
    return `${await page.locator("#tab-settings .row").count()} settings`;
  });
  let albedo1 = "";
  await step("made by Blender from the page: its log, its picture on its card, its texture's islands", async () => {
    await page.selectOption("#tex", "512");
    const j = await makeAndWait();
    const s = await S();
    const card = s.list.find(r => r.name === "ema");
    if (!card.made || !/\/thumb\/ema\?v=/.test(card.thumb)) throw new Error("no picture on its card");
    if (!(await page.locator('.card[data-name="ema"] img').count())) throw new Error("the card shows no picture");
    if (!s.meta || !s.meta.islands || !s.meta.islands.front) throw new Error("no islands in what was made");
    if (s.meta.spec.art.text !== "奉納テスト") throw new Error("it was made without the change");
    albedo1 = sha(path.join(OUT, "ema", s.meta.textures.main[0]));
    return `${(await page.textContent("#job-log")).split("\n").filter(Boolean).length} lines of log, ${s.meta.tris} triangles`;
  });
  const at = (isl, x, y) => page.evaluate(([i, x, y]) => window.__pe.toScreen(i, x, y), [isl, x, y]);
  const colour = (isl, x, y) => page.evaluate(([i, x, y]) => window.__pe.colourAt(i, x, y), [isl, x, y]);
  // a picture on the left dragged onto the canvas (HTML's drag and drop, as the browser fires it)
  async function dragPic(sel, x, y, mods = {}) {
    await page.evaluate(({ sel, x, y, mods }) => {
      const src = document.querySelector(sel), cv = document.querySelector(".pe-canvas"), dt = new DataTransfer();
      src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
      cv.dispatchEvent(new DragEvent("dragover", Object.assign({ bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }, mods)));
      cv.dispatchEvent(new DragEvent("drop", Object.assign({ bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }, mods)));
      src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
    }, { sel, x, y, mods });
  }
  const picPng = (w, h, kind) => page.evaluate(({ w, h, kind }) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
    if (kind === "logo") { g.fillStyle = "#c0262a"; g.beginPath(); g.arc(w / 2, h / 2, w * 0.45, 0, 7); g.fill(); g.fillStyle = "#101010"; g.fillRect(w * 0.3, h * 0.42, w * 0.4, h * 0.16); }
    if (kind === "label") { g.fillStyle = "#2050d0"; g.fillRect(0, 0, w, h); g.fillStyle = "#f2f2f2"; g.beginPath(); g.arc(w / 2, h / 2, h * 0.3, 0, 7); g.fill(); }
    if (kind === "sheet") for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? "#2f8f4f" : "#e6e1cf"; g.fillRect(x * w / 8, y * h / 8, w / 8, h / 8); }
    return c.toDataURL("image/png").split(",")[1];
  }, { w, h, kind });
  let logo = "", sheetPic = "";
  await step("the picture editor: the texture with its cuts from the model's UVs, its parts and own pictures as layers, the prop wearing the canvas", async () => {
    await page.click('#tabs button[data-tab="texture"]');
    await page.waitForFunction(() => window.__pe && window.__pe.cuts() && window.__pe.live3d().length, null, { timeout: 60000 });
    const s = await S(), cuts = await page.evaluate(() => window.__pe.cuts());
    if (!s.meta.design || !s.meta.design.main || !s.meta.design.main.paint) throw new Error(`no paint under your pictures in what was made: ${JSON.stringify(s.meta.design)}`);
    if (!fs.existsSync(path.join(OUT, "ema", s.meta.design.main.paint))) throw new Error("its paint isn't beside its maps");
    if (cuts.segs < 8) throw new Error(`${cuts.segs} cut lines`);
    const parts = Object.values(s.meta.islands).filter(i => i.mat === "main").length;
    if ((await page.locator('.pe-row[data-kind="part"]').count()) !== parts) throw new Error(`${await page.locator('.pe-row[data-kind="part"]').count()} parts listed, ${parts} on the texture`);
    if ((await page.locator('.pe-row[data-kind="slot"]').count()) < 1) throw new Error("its own pictures aren't listed");
    if (!(await page.evaluate(() => window.__pe.live3d())).includes("ema_main")) throw new Error("the prop in 3D doesn't wear the canvas");
    if ((await page.locator(".pe-bar button[data-mat]").count()) !== 2) throw new Error("its two textures (main, cord) aren't both offered");
    return `${cuts.segs} cut lines over ${cuts.tris} triangles, ${parts} parts`;
  });
  await step("pictures added in the editor go into the pictures folder", async () => {
    await page.setInputFiles(".pe-file", [{ name: "page logo.png", mimeType: "image/png", buffer: Buffer.from(await picPng(256, 256, "logo"), "base64") },
      { name: "page sheet.png", mimeType: "image/png", buffer: Buffer.from(await picPng(512, 512, "sheet"), "base64") }]);
    await page.waitForFunction(() => window.__pp.pics.length === 2);
    if (!fs.existsSync(path.join(IMAGES, "page_logo.png"))) throw new Error("not in the pictures folder");
    const s = await S();
    logo = s.pics.find(p => p.name === "page_logo.png").path;
    sheetPic = s.pics.find(p => p.name === "page_sheet.png").path;
    if ((await page.locator(".pe-pics .pe-pic").count()) !== 2) throw new Error("not shown to drag");
    return s.pics.map(p => p.name).join(", ");
  });
  await step("a file from the desktop dropped onto a part its shape: it fills the part", async () => {
    const [x, y] = await at("front", 8, 94);
    const b64 = await picPng(600, 408, "label");
    await page.evaluate(({ b64, x, y }) => {
      const bin = atob(b64), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const dt = new DataTransfer();
      dt.items.add(new File([u8], "front label.png", { type: "image/png" }));
      const cv = document.querySelector(".pe-canvas");
      cv.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
      cv.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    }, { b64, x, y });
    await page.waitForFunction(() => (window.__pp.spec.decals || []).length === 1, null, { timeout: 15000 });
    const d = (await S()).spec.decals[0];
    if (d.island !== "front" || d.fit !== "stretch") throw new Error(JSON.stringify(d));
    if (!fs.existsSync(path.join(IMAGES, "front_label.png"))) throw new Error("the file isn't in the pictures folder");
    await page.waitForTimeout(300);
    const c = await colour("front", 140, 95);
    if (Math.abs(c[0] - 0x20) > 30 || Math.abs(c[1] - 0x50) > 30 || Math.abs(c[2] - 0xd0) > 30) throw new Error(`the canvas there is ${c}, not the picture's blue`);
    return `${d.image.split("/").pop()} over all of the front; the canvas there ${c}`;
  });
  await step("a logo dragged onto a part: placed where it lands", async () => {
    const [x, y] = await at("back", 40, 42);
    await dragPic(`.pe-pic[data-path="${logo}"]`, x, y);
    await page.waitForFunction(() => (window.__pp.spec.decals || []).length === 2);
    const d = (await S()).spec.decals[1];
    if (d.island !== "back" || d.fit || Math.abs(d.x - 40) > 1.5 || Math.abs(d.y - 42) > 1.5 || !(d.w > 10)) throw new Error(JSON.stringify(d));
    const sel = await page.evaluate(() => window.__pp.ed.sel);
    if (sel.kind !== "decal" || sel.i !== 1) throw new Error(`picked ${JSON.stringify(sel)}`);
    return `at ${d.x} × ${d.y} mm, ${d.w} mm wide`;
  });
  let swapped = null;
  await step("a logo dragged onto one of its own pictures takes its place", async () => {
    const sl = (await S()).meta.slots.find(x => x.id === "front.motif");
    if (!sl) throw new Error("the ema has no front.motif");
    const [x, y] = await at("front", sl.box[0] + sl.box[2] / 2, sl.box[1] + sl.box[3] / 2);
    await dragPic(`.pe-pic[data-path="${logo}"]`, x, y);
    await page.waitForFunction(id => (window.__pp.spec.pictures || {})[id], sl.id);
    swapped = sl.id;
    if (!(await page.locator(`.pe-row[data-slot="${sl.id}"] .pe-k.yours`).count())) throw new Error("its layer doesn't say it's yours");
    if (!/wants \d+ × \d+ px/.test(await page.textContent(".pe-props"))) throw new Error("no size wanted on its settings");
    return `${sl.id}: ${(await page.textContent(".pe-props .pe-wants")).trim()}`;
  });
  await step("the logo sized, turned and moved by its handles; Ctrl+Z a step back", async () => {
    await page.click('.pe-row[data-kind="decal"][data-i="1"]');
    const d0 = (await S()).spec.decals[1];
    let h = await page.evaluate(() => window.__pe.handle("se"));
    await page.mouse.move(h[0], h[1]); await page.mouse.down(); await page.mouse.move(h[0] + 30, h[1] + 30, { steps: 4 }); await page.mouse.up();
    const d1 = (await S()).spec.decals[1];
    if (!(d1.w > d0.w * 1.1) || Math.abs(d1.h / d1.w - 1) > 0.05) throw new Error(`sized ${JSON.stringify(d1)}`);
    h = await page.evaluate(() => window.__pe.handle("rot"));
    const c = await at("back", d1.x, d1.y);
    await page.mouse.move(h[0], h[1]); await page.mouse.down(); await page.mouse.move(c[0] + 100, c[1], { steps: 6 }); await page.mouse.up();
    const d2 = (await S()).spec.decals[1];
    if (Math.abs(d2.rot + 90) > 3) throw new Error(`turned ${JSON.stringify(d2)}`);
    await page.mouse.move(c[0], c[1]); await page.mouse.down(); await page.mouse.move(c[0] + 25, c[1] - 15, { steps: 5 }); await page.mouse.up();
    const d3 = (await S()).spec.decals[1];
    if (!(d3.x > d2.x + 2) || !(d3.y > d2.y + 1)) throw new Error(`moved ${JSON.stringify(d3)}`);
    await page.locator(".pe-canvas").focus();
    await page.keyboard.press("Control+z");
    const d4 = (await S()).spec.decals[1];
    if (d4.x !== d2.x || d4.y !== d2.y) throw new Error(`undone ${JSON.stringify(d4)}, not back at ${d2.x}, ${d2.y}`);
    return `${d0.w} → ${d1.w} mm, turned ${d2.rot}°, moved and back`;
  });
  await step("a picture the texture's shape over the whole texture, laid in its layout", async () => {
    const [x, y] = await at("front", 75, 51);
    await dragPic(`.pe-pic[data-path="${sheetPic}"]`, x, y);
    await page.waitForFunction(() => (window.__pp.spec.sheets || []).length === 1);
    const s = await S(), sh = s.spec.sheets[0];
    const parts = Object.entries(s.meta.islands).filter(([, i]) => i.mat === "main").map(([n]) => n).sort();
    if (sh.mat !== "main" || sh.at || JSON.stringify(Object.keys(sh.layout).sort()) !== JSON.stringify(parts)) throw new Error(JSON.stringify(sh));
    if (!(await page.locator('.pe-row[data-kind="sheet"]').count())) throw new Error("not listed over the whole texture");
    return `laid on ${parts.join(", ")}`;
  });
  await step("a smudge off the shelf dragged onto a part", async () => {
    const [x, y] = await at("back", 115, 60);
    await dragPic(".pe-smudges .pe-pic", x, y);
    await page.waitForFunction(() => (window.__pp.spec.smudges || []).length === 1);
    const m = (await S()).spec.smudges[0];
    if (m.island !== "back" || Math.abs(m.x - 115) > 1.5 || Math.abs(m.y - 60) > 1.5) throw new Error(JSON.stringify(m));
    return `${m.image} at ${m.x}, ${m.y} mm on the back`;
  });
  await step("the logo made a flourish: one in each corner", async () => {
    await page.click('.pe-row[data-kind="decal"][data-i="1"]');
    await page.locator(".pe-props details.pe-more summary").click();
    await page.locator(".pe-props label", { hasText: "One in each corner" }).locator("input").check();
    await page.waitForFunction(() => window.__pp.spec.decals[1].corners === true);
  });
  await step("made again with them: in the made recipe, the made texture where the canvas said", async () => {
    const want = await colour("front", 140, 95);
    await makeAndWait();
    const s = await S();
    if (!s.meta.spec.decals || s.meta.spec.decals[1].image !== logo || !s.meta.spec.decals[1].corners) throw new Error("the logo isn't in what was made");
    if (!s.meta.spec.sheets || !s.meta.spec.smudges) throw new Error("the sheet or the smudge isn't in what was made");
    const sl = (s.meta.slots || []).find(x => x.id === swapped);
    if (!sl || sl.now !== "yours") throw new Error(`${swapped} isn't yours in what was made: ${JSON.stringify(sl)}`);
    const a2 = sha(path.join(OUT, "ema", s.meta.textures.main[0]));
    if (a2 === albedo1) throw new Error("its texture is the same as before");
    await page.click('.pe-bar button[data-mode="made"]');
    await page.waitForTimeout(1500);
    const got = await colour("front", 140, 95);
    await page.click('.pe-bar button[data-mode="design"]');
    if (want.some((v, k) => Math.abs(v - got[k]) > 45)) throw new Error(`made ${got} where the canvas showed ${want}`);
    return `the front's corner: canvas ${want}, made ${got}`;
  });
  await step("the made prop in 3D, its sockets marked", async () => {
    await page.click('#tabs button[data-tab="view"]');
    await page.waitForFunction(() => window.__pp.viewInfo && window.__pp.viewInfo.tris > 0, null, { timeout: 60000 });
    const v = (await S()).viewInfo;
    if (!v.sockets.includes("hang")) throw new Error(`sockets ${v.sockets}`);
    if (Math.abs(v.tris - (await S()).meta.tris) > 2) throw new Error(`${v.tris} triangles in the view, ${(await S()).meta.tris} made`);
    return `${Math.round(v.tris)} triangles, sockets ${v.sockets.join(", ")}`;
  });
  await step("a PBR set off the shelf picked for its material", async () => {
    await page.click('#tabs button[data-tab="texture"]');
    await page.waitForFunction(() => !!document.querySelector(".pe-props"));
    await page.locator(".pe-canvas").focus();
    await page.keyboard.press("Escape");
    const opts = await page.locator(".pe-pbr select option").count();
    if (opts < 2) return "the shelf is empty here: nothing to pick (skipped)";
    const first = await page.locator(".pe-pbr select option").nth(1).getAttribute("value");
    await page.locator(".pe-pbr select").first().selectOption(first);
    const p = (await S()).spec.pbr;
    if (!p || !Object.values(p).some(x => x.set === first)) throw new Error(JSON.stringify(p));
    await page.evaluate(() => { delete window.__pp.spec.pbr; });
    return first;
  });
  await step("the layout's template for Krita (.ora: Guide, Paint, Base) and back in as a picture", async () => {
    await page.evaluate(() => window.__pe.select(null));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click('.pe-props button:text-is("Template (.ora)")')]);
    const ora = path.join(HOME, dl.suggestedFilename());
    await dl.saveAs(ora);
    const z = fs.readFileSync(ora);
    if (z.readUInt32LE(0) !== 0x04034b50 || z.toString("latin1", 30, 38) !== "mimetype" || z.toString("latin1", 38, 54) !== "image/openraster") throw new Error("not an OpenRaster file (mimetype first, stored)");
    const txt = z.toString("latin1");
    for (const n of ['name="Guide"', 'name="Paint"', 'name="Base"', "mergedimage.png", "Thumbnails/thumbnail.png"]) if (!txt.includes(n)) throw new Error(`no ${n} in it`);
    const before = (await S()).pics.length;
    await page.setInputFiles(".pe-file", ora);
    await page.waitForFunction(n => window.__pp.pics.length === n + 1, before);
    if (!fs.existsSync(path.join(IMAGES, "ema_main.png"))) throw new Error("its Paint layer isn't in the pictures folder");
    return `${dl.suggestedFilename()}, ${z.length} bytes`;
  });
  await step("a part picked on the prop in 3D", async () => {
    await page.evaluate(() => window.__pe.select(null));
    const b = await page.locator(".pe-3d canvas").boundingBox();
    let sel = null;
    for (const [fx, fy] of [[0.5, 0.5], [0.45, 0.55], [0.55, 0.45], [0.5, 0.6]]) {
      await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
      await page.waitForTimeout(200);
      sel = await page.evaluate(() => window.__pp.ed.sel);
      if (sel && sel.kind === "part") break;
    }
    if (!sel || sel.kind !== "part") throw new Error(`nothing picked (${JSON.stringify(sel)})`);
    return sel.island;
  });
  await step("two variations made at once, each its own card", async () => {
    await page.fill("#as", "ema_page");
    await page.selectOption("#vars", "2");
    await makeAndWait(600000);
    const s = await S();
    for (const n of ["ema_page_v1", "ema_page_v2"]) {
      const c = s.list.find(r => r.name === n);
      if (!c || !c.made || !c.unsaved) throw new Error(`${n}: ${JSON.stringify(c)}`);
      if (!(await page.locator(`.card[data-name="${n}"] img`).count())) throw new Error(`${n} has no picture`);
    }
    const s1 = JSON.parse(fs.readFileSync(path.join(OUT, "ema_page_v1", "meta.json"), "utf8")).seed;
    const s2 = JSON.parse(fs.readFileSync(path.join(OUT, "ema_page_v2", "meta.json"), "utf8")).seed;
    if (s1 === s2) throw new Error("the same seed twice");
    await page.selectOption("#vars", "1");
    return `seeds ${s1} and ${s2}`;
  });
  await step("kept as a recipe of its own: from ema, and only what differs", async () => {
    await page.fill("#as", "ema_page_test");
    await page.click("#saveas");
    await page.waitForFunction(() => window.__pp.name === "ema_page_test");
    const r = book().ema_page_test;
    if (!r) throw new Error("not in presets.json");
    if (r.from !== "ema") throw new Error(`from ${r.from}`);
    if (!r.decals || !r.sheets || !r.smudges || r.art.text !== "奉納テスト" || r.back.wish !== "ゆるさない") throw new Error(JSON.stringify(r));
    if ("motif" in r.art || "wear" in r) throw new Error(`more than what differs: ${JSON.stringify(r)}`);
    if (!fs.readdirSync(path.join(OUT, "_history")).length) throw new Error("no copy of presets.json kept before it");
    return JSON.stringify(r).slice(0, 120);
  });
  await step("deleted again", async () => {
    await page.click("#delete");
    await page.waitForFunction(() => !window.__pp.name);
    if (book().ema_page_test) throw new Error("still in presets.json");
    if (await page.locator('.card[data-name="ema_page_test"]').count()) throw new Error("still a card");
  });
  await step("no errors on the page", async () => { if (errors.length) throw new Error(errors.slice(0, 3).join(" | ")); });
} catch (e) {
  fail(e.message);
}
await browser.close();
srv.kill();
const secs = Math.round((Date.now() - t0) / 1000);
if (fails.length) {
  console.log(`(the scratch folder kept for a look: ${HOME}; the server said: ${srvOut.slice(-300)})`);
  console.log("PROPPAGE FAIL: " + fails.join("; "));
  process.exit(1);
}
fs.rmSync(HOME, { recursive: true, force: true });
console.log(`PROPPAGE ok (the page: cards, a form, Blender's make and its log; the picture editor: the cuts, pictures dragged onto a part, onto its own picture and over the whole texture, handles, undo, a smudge, a flourish, made as the canvas showed, the .ora template; 3D, variations, a recipe saved and deleted; ${secs}s)`);

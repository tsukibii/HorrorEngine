// GUIDEPROPS: the prop customizer's guide pictures (guides/prop_customizer/img/), the prop generator's page driven in a
// headless browser on its own server, a scratch copy of the recipe book, an empty scratch pictures folder and a scratch
// folder of made props (the box of shells and a shell, copied from Saved/Props: made here first, `propgen.py make
// shells_box_5 shell_12ga`), so your recipes, pictures and props are never touched. Each step the guide shows is pictured
// as it's done: the customizable props by themselves, a box of shells found and opened into its form, the picture
// editor, a logo onto the box's own brand, a price sticker placed on its lid with its handles, a logo onto a shell's own
// brand along its hull, the box made from the page, kept as a recipe of its own. Blender is needed for the make.
//   node tools/propgen/guide_shots.mjs        (PROPS_GUIDE_PORT for another port than 8794)
import { createRequire } from "module";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import net from "net";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const { launch } = require("../browser.cjs");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const PORT = +(process.env.PROPS_GUIDE_PORT || 8794), PAGE = `http://127.0.0.1:${PORT}`;
const GUIDE = path.join(ROOT, "guides", "prop_customizer"), IMG = path.join(GUIDE, "img"), EX = path.join(GUIDE, "examples");
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "props-guide-"));
const PRESETS = path.join(HOME, "presets.json"), OUT = path.join(HOME, "Props"), IMAGES = path.join(HOME, "images"), THUMBS = path.join(HOME, "thumbs");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const free = port => new Promise(r => { const s = net.createConnection(port, "127.0.0.1"); s.on("connect", () => { s.destroy(); r(false); }); s.on("error", () => r(true)); });
const fails = [], shots = [];
const t0 = Date.now();

fs.copyFileSync(path.join(ROOT, "Content", "Studio", "Props", "presets.json"), PRESETS);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(IMAGES, { recursive: true });
for (const n of ["shells_box_5", "shell_12ga"]) {
  const src = path.join(ROOT, "Saved", "Props", n);
  if (!fs.existsSync(path.join(src, "meta.json"))) { console.log(`GUIDEPROPS FAIL: ${n} isn't made (python tools/propgen.py make shells_box_5 shell_12ga)`); process.exit(1); }
  fs.cpSync(src, path.join(OUT, n), { recursive: true });
}
fs.cpSync(path.join(ROOT, "Content", "Studio", "Props", "thumbs"), THUMBS, { recursive: true });
fs.mkdirSync(IMG, { recursive: true });

if (!(await free(PORT))) { console.log(`port ${PORT} is taken: PROPS_GUIDE_PORT=<another> node tools/propgen/guide_shots.mjs`); process.exit(1); }
const srv = spawn(process.env.PYTHON || "python3", ["tools/propgen/serve.py"], {
  cwd: ROOT, env: Object.assign({}, process.env, { PROPS_PORT: String(PORT), PROPS_PRESETS: PRESETS, PROPS_OUT: OUT, PROPS_IMAGES: IMAGES, PROPS_THUMBS: THUMBS }),
  stdio: ["ignore", "pipe", "pipe"],
});
let srvOut = "";
srv.stdout.on("data", d => { srvOut += d; });
srv.stderr.on("data", d => { srvOut += d; });
for (let i = 0; i < 60 && await free(PORT); i++) await sleep(150);

const browser = await launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error" && !/favicon/.test(m.text())) errors.push(m.text()); });
page.on("dialog", d => d.accept());
const shot = async (name, clip) => {
  await sleep(250);
  await page.screenshot({ path: path.join(IMG, name + ".jpg"), type: "jpeg", quality: 84, clip });
  shots.push(name);
  console.log(`  picture: guides/prop_customizer/img/${name}.jpg`);
};
const step = async (what, fn) => {
  try { const note = await fn(); console.log(`  ok  ${what}${note ? `: ${note}` : ""}`); }
  catch (e) { fails.push(`${what}: ${e.message.split("\n")[0]}`); console.log(`  FAIL ${what}: ${e.message.split("\n")[0]}`); }
};
const at = (isl, x, y) => page.evaluate(([i, x, y]) => window.__pe.toScreen(i, x, y), [isl, x, y]);
const slotOf = id => page.evaluate(id => (window.__pp.meta.slots || []).find(s => s.id === id), id);
async function dragPic(sel, x, y) {
  await page.evaluate(({ sel, x, y }) => {
    const src = document.querySelector(sel), cv = document.querySelector(".pe-canvas"), dt = new DataTransfer();
    src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    cv.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    cv.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
  }, { sel, x, y });
}
const pic = name => page.evaluate(n => window.__pp.pics.find(p => p.name === n).path, name);
async function open(name) {
  await page.click('#tabs button[data-tab="settings"]').catch(() => { });
  await page.fill("#search", "");
  await page.click(`.card[data-name="${name}"]`);
  await page.waitForFunction(n => window.__pp.name === n, name);
}
async function editor(mat) {
  await page.click('#tabs button[data-tab="texture"]');
  await page.waitForFunction(() => window.__pe && window.__pe.cuts(), null, { timeout: 60000 });
  if (mat) {
    await page.click(`.pe-bar button[data-mat="${mat}"]`);
    await page.waitForFunction(m => window.__pe.cuts(m), mat, { timeout: 30000 });
  }
  await page.click('.pe-views button[data-view="picture"]');
  await page.waitForFunction(() => window.__pe.picture().ready, null, { timeout: 60000 });
  await page.keyboard.press("Escape");
  await sleep(500);
}

try {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__pp && window.__pp.ready, null, { timeout: 30000 });
  await step("the customizable props by themselves (✎)", async () => {
    await page.click("#fams button.custom");
    await sleep(600);
    await shot("customizable");
    const n = await page.locator(".card").count();
    await page.click("#fams button.custom");
    return `${n} cards`;
  });
  await step("found by its name and opened into its form", async () => {
    await page.fill("#search", "shells");
    await sleep(400);
    await page.click('.card[data-name="shells_box_5"]');
    await page.waitForFunction(() => window.__pp.name === "shells_box_5");
    await sleep(600);
    await shot("settings");
    return `${await page.locator("#tab-settings .row").count()} settings`;
  });
  await step("the picture editor on the box's printed card: its faces, their own pictures, its picture", async () => {
    await editor("card");
    await shot("editor");
    return `${await page.locator(".pe-row").count()} layers`;
  });
  await step("your pictures added (the guide's examples)", async () => {
    await page.setInputFiles(".pe-file", [path.join(EX, "raven_logo.png"), path.join(EX, "price_sticker.png")]);
    await page.waitForFunction(() => window.__pp.pics.length === 2, null, { timeout: 15000 });
    return (await page.evaluate(() => window.__pp.pics.map(p => p.name))).join(", ");
  });
  await step("the logo dropped on the lid's own brand: it takes its place, seen on the box's picture", async () => {
    const sl = await slotOf("lid.brand");
    const [x, y] = await at("lid", sl.box[0] + sl.box[2] / 2, sl.box[1] + sl.box[3] / 2);
    await page.evaluate(() => window.__pe.snapPicture());
    await dragPic(`.pe-pic[data-path="${await pic("raven_logo.png")}"]`, x, y);
    await page.waitForFunction(() => (window.__pp.spec.pictures || {})["lid.brand"], null, { timeout: 15000 });
    await page.waitForFunction(() => window.__pe.picture().since > 200, null, { timeout: 30000 });
    await sleep(600);
    await shot("swap");
    return `${(await page.evaluate(() => window.__pe.picture())).since} pixels of its picture changed`;
  });
  await step("a price sticker placed on the lid, picked: its handles", async () => {
    const [x, y] = await at("lid", 108, 62);                     // (clear of the lid's own pictures: a drop on one takes its place)
    await page.evaluate(() => window.__pe.snapPicture());
    await dragPic(`.pe-pic[data-path="${await pic("price_sticker.png")}"]`, x, y);
    await page.waitForFunction(() => (window.__pp.spec.decals || []).length === 1, null, { timeout: 15000 });
    const h = await page.evaluate(() => window.__pe.handle("se"));   // its corner handle, in: a sticker's size
    const c = await at("lid", (await page.evaluate(() => window.__pp.spec.decals[0])).x, (await page.evaluate(() => window.__pp.spec.decals[0])).y);
    await page.mouse.move(h[0], h[1]); await page.mouse.down();
    await page.mouse.move(c[0] + (h[0] - c[0]) * 0.55, c[1] + (h[1] - c[1]) * 0.55, { steps: 6 }); await page.mouse.up();
    await page.waitForFunction(() => window.__pe.picture().since > 100, null, { timeout: 30000 });
    await sleep(600);
    await shot("place");
    const d = await page.evaluate(() => window.__pp.spec.decals[0]);
    return `at ${d.x} × ${d.y} mm on the ${d.island}, ${d.w} mm wide`;
  });
  await step("made from the page under a name of its own: its log, its card's picture", async () => {
    await page.keyboard.press("Escape");
    await page.fill("#as", "shells_box_raven");
    const before = await page.evaluate(() => window.__pp.job && window.__pp.job.id);
    await page.click("#make");
    await page.waitForFunction(b => window.__pp.job && window.__pp.job.id !== b && window.__pp.job.finished, before, { timeout: 600000 });
    const j = await page.evaluate(() => window.__pp.job);
    if (j.state !== "done") throw new Error(`the make ${j.state}: ${(await page.textContent("#job-log")).slice(-300)}`);
    await page.waitForFunction(() => (window.__pp.list.find(r => r.name === "shells_box_raven") || {}).made, null, { timeout: 30000 });
    await sleep(1500);
    await shot("made");
    return "made";
  });
  await step("kept as a recipe of its own: from the box, and only what differs", async () => {
    await page.click("#saveas");
    await page.waitForFunction(() => window.__pp.name === "shells_box_raven", null, { timeout: 15000 });
    await page.click('#tabs button[data-tab="json"]');
    await page.evaluate(() => { const t = document.querySelector("#json"); t.scrollTop = t.scrollHeight; });
    await sleep(500);
    await shot("saved");
    const r = JSON.parse(fs.readFileSync(PRESETS, "utf8")).shells_box_raven;
    if (!r || r.from !== "shells_box_5") throw new Error(JSON.stringify(r).slice(0, 200));
    return JSON.stringify(r).slice(0, 140);
  });
  await step("a shell's own brand, along its hull: the logo dropped on it", async () => {
    await open("shell_12ga");
    await editor("hull");
    const sl = await slotOf("hull.brand");
    const [x, y] = await at("hull", sl.box[0] + sl.box[2] / 2, sl.box[1] + sl.box[3] / 2);
    await page.evaluate(() => window.__pe.snapPicture());
    await dragPic(`.pe-pic[data-path="${await pic("raven_logo.png")}"]`, x, y);
    await page.waitForFunction(() => (window.__pp.spec.pictures || {})["hull.brand"], null, { timeout: 15000 });
    await page.waitForFunction(() => window.__pe.picture().since > 30, null, { timeout: 30000 });
    await sleep(600);
    await shot("shell");
    return `${(await page.evaluate(() => window.__pe.picture())).since} pixels changed`;
  });
  if (errors.length) fails.push("errors on the page: " + errors.slice(0, 3).join(" | "));
} catch (e) {
  fails.push(e.message);
}
await browser.close();
srv.kill();
if (fails.length) {
  console.log(`(the scratch folder kept: ${HOME}; the server said: ${srvOut.slice(-300)})`);
  console.log("GUIDEPROPS FAIL: " + fails.join("; "));
  process.exit(1);
}
fs.rmSync(HOME, { recursive: true, force: true });
console.log(`GUIDEPROPS ok (${shots.length} pictures into guides/prop_customizer/img: ${shots.join(", ")}; ${Math.round((Date.now() - t0) / 1000)}s)`);

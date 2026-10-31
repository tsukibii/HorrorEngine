// PROPPAGE: the prop generator's page in a headless browser, on its own server with a scratch copy of the recipe book,
// a scratch folder for what's made and one for pictures (PROPS_PRESETS, PROPS_OUT, PROPS_IMAGES), so your recipes and
// props are never touched. Every recipe a card; one opened into its form and changed there; made by Blender from the
// page, its log followed and its picture on its card; a picture dropped in and clicked onto the texture where the
// front of the plaque is (a decal), its parts listed with the picture size each wants, a picture wrapped over the
// whole front; a smudge off the shelf moved by a click, the decal made a flourish in each corner; made again with all
// of it, the texture
// changed; the made prop loaded in 3D with its
// sockets; a PBR set off the shelf picked for its material; two variations made at once; kept as a recipe of its own
// (`from` its base and only what differs), then deleted again. Blender is needed (propgen.py's), as for PROPGEN.
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
  await step("a picture dropped into the page goes into the pictures folder", async () => {
    await page.click('#tabs button[data-tab="texture"]');
    const b64 = await page.evaluate(() => {
      const c = document.createElement("canvas"); c.width = 256; c.height = 128;
      const g = c.getContext("2d"); g.fillStyle = "#c0262a"; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.fill();
      g.fillStyle = "#101010"; g.font = "bold 70px sans-serif"; g.fillText("PP", 128, 90);
      return c.toDataURL("image/png").split(",")[1];
    });
    await page.setInputFiles("#tab-texture input[type=file]", { name: "page logo.png", mimeType: "image/png", buffer: Buffer.from(b64, "base64") });
    await page.waitForFunction(() => window.__pp.pics.length === 1);
    if (!fs.existsSync(path.join(IMAGES, "page_logo.png"))) throw new Error("not in the pictures folder");
    return (await S()).pics[0].path;
  });
  await step("a click on the texture puts it there: a decal on the island under the click", async () => {
    const r = page.locator('.atlas rect.isl[data-island="front"]').first();
    const b = await r.boundingBox();
    await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.62);
    await page.waitForFunction(() => (window.__pp.spec.decals || []).length === 1);
    const d = (await S()).spec.decals[0], isl = (await S()).meta.islands.front;
    if (d.island !== "front") throw new Error(`on ${d.island}`);
    if (Math.abs(d.x - isl.mm[0] * 0.5) > isl.mm[0] * 0.05 || Math.abs(d.y - isl.mm[1] * 0.38) > isl.mm[1] * 0.06) throw new Error(`at ${d.x}, ${d.y} of ${isl.mm}`);
    if (!(await page.locator(".atlas rect.dec").count())) throw new Error("not drawn on the texture");
    return `at ${d.x} × ${d.y} mm of ${isl.mm.join(" × ")}`;
  });
  await step("its parts listed with the picture each wants; one wrapped over a whole part", async () => {
    const row = page.locator('.isl-row[data-island="front"]');
    const txt = await row.textContent();
    const m = txt.match(/picture (\d+) × (\d+) px/);
    if (!m) throw new Error(`no size in "${txt}"`);
    const isl = (await S()).meta.islands.front, px = (await S()).meta.materials.main.px;
    const want = Math.round((isl.rect[2] - isl.rect[0]) * px) * 2;
    if (Math.abs(+m[1] - want) > 1) throw new Error(`${m[1]} px wide, not ${want}`);
    if (!(await page.locator('.isl-row[data-island="cord_a"] .wraps').count())) throw new Error("the cord's band isn't marked as going round");
    await row.locator("button").click();
    await page.waitForFunction(() => (window.__pp.spec.decals || []).length === 2);
    const d = (await S()).spec.decals[1];
    if (d.fit !== "stretch" || d.island !== "front") throw new Error(JSON.stringify(d));
    return `the front wants ${m[1]} × ${m[2]} px`;
  });
  await step("a smudge off the shelf, moved by a click on the texture", async () => {
    await page.locator(".shelf .pic").first().click();
    await page.waitForFunction(() => (window.__pp.spec.smudges || []).length === 1);
    await page.waitForFunction(() => [...document.querySelectorAll(".atlas img")].every(i => i.complete));
    await page.locator('.atlas rect.isl[data-island="front"]').first().scrollIntoViewIfNeeded();
    const isl = (await S()).meta.islands.front, b = await page.locator('.atlas rect.isl[data-island="front"]').first().boundingBox();
    await page.mouse.click(b.x + b.width * 0.3, b.y + b.height * (1 - 0.4));
    await page.waitForFunction(x => Math.abs(window.__pp.spec.smudges[0].x - x) < 3, 0.3 * isl.mm[0], { timeout: 5000 });
    const m = (await S()).spec.smudges[0];
    if (Math.abs(m.x - 0.3 * isl.mm[0]) > 2 || Math.abs(m.y - 0.4 * isl.mm[1]) > 2) throw new Error(JSON.stringify(m));
    if (!(await page.locator(".atlas ellipse.smu").count())) throw new Error("not drawn on the texture");
    if (!/\d+ × \d+ px/.test(await page.locator(".smudge").first().textContent())) throw new Error("no size wanted on its row");
    return `${m.image} at ${m.x}, ${m.y} mm on the front`;
  });
  await step("the decal made a flourish: one in each corner", async () => {
    await page.locator(".decal:not(.smudge)").first().locator("label", { hasText: "corners" }).locator("input").check();
    await page.waitForFunction(() => window.__pp.spec.decals[0].corners === true);
  });
  await step("made again with them: in the made recipe, the texture changed", async () => {
    await makeAndWait();
    const s = await S();
    if (!s.meta.spec.decals || s.meta.spec.decals[0].image !== s.pics[0].path) throw new Error("the decal isn't in what was made");
    if (s.meta.spec.decals[1].fit !== "stretch") throw new Error("the wrapped picture isn't in what was made");
    if (!s.meta.spec.smudges || !s.meta.spec.decals[0].corners) throw new Error("the smudge or the flourish isn't in what was made");
    const a2 = sha(path.join(OUT, "ema", s.meta.textures.main[0]));
    if (a2 === albedo1) throw new Error("its texture is the same as before");
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
    const opts = await page.locator(".pbrrow select option").count();
    if (opts < 2) return "the shelf is empty here: nothing to pick (skipped)";
    const first = await page.locator(".pbrrow select option").nth(1).getAttribute("value");
    await page.locator(".pbrrow select").first().selectOption(first);
    const p = (await S()).spec.pbr;
    if (!p || !Object.values(p).some(x => x.set === first)) throw new Error(JSON.stringify(p));
    await page.evaluate(() => { delete window.__pp.spec.pbr; });
    return first;
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
    if (!r.decals || r.art.text !== "奉納テスト" || r.back.wish !== "ゆるさない") throw new Error(JSON.stringify(r));
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
console.log(`PROPPAGE ok (the page: cards, a form, Blender's make and its log, a picture placed by a click, a smudge and a flourish, 3D, variations, a recipe saved and deleted; ${secs}s)`);

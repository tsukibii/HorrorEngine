// The street paint page's check (docs/STREET_PAINT.md §5), in a headless browser on a scratch copy of the Shibuya lane
// (Content/Studio/Streets/painttest_scratch, taken away after): the library listed (the project's PBR sets by category),
// a wall painted through the photo's shot (its look in the street, its surface wearing the set), picked up and tuned
// live (a tint, rain streaks, moss in patches: the look an object, the surface wearing the set made of it), every
// surface of a kind painted at once, a decal laid on the road, undo and redo, saved and read back from disk. The desk's
// server running (DESK_URL for another port). Ends "PAINT ok".
//
//   node tools/director/painttest.mjs
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const URL0 = process.env.DESK_URL || "http://127.0.0.1:8780/";
const NAME = "painttest_scratch", DIR = path.join(ROOT, "Content/Studio/Streets", NAME), SRC = path.join(ROOT, "Content/Studio/Streets/shibuya_lane/street.json");
const errs = [], fail = m => { errs.push(m); console.log("FAIL: " + m); };
fs.mkdirSync(DIR, { recursive: true });
const start = JSON.parse(fs.readFileSync(SRC, "utf8"));
for (const b of start.buildings) b.look = Object.fromEntries(Object.entries(b.look || {}).filter(([, v]) => typeof v === "string" && !v.startsWith("pbr/")));   // the scratch starts unpainted
start.look = {}; start.decals = [];
fs.writeFileSync(path.join(DIR, "street.json"), JSON.stringify(start, null, 1));
const browser = await require("../browser.cjs").launch(chromium);
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
  page.on("pageerror", e => fail("page error: " + e.message));
  await page.goto(`${URL0}paint.html?street=${NAME}&light=day`);
  await page.waitForFunction(n => window.__paintReady && window.PT.name === n, NAME, { timeout: 300000 });
  const lib = await page.evaluate(() => document.querySelectorAll("#lib .card").length);
  const shelf = await page.evaluate(async () => (await (await fetch("/api/pbr")).json()).sets);
  const jp = Object.keys(shelf).filter(r => r.startsWith("pbr/Procedural/jp_")).length, own = Object.keys(shelf).filter(r => !r.startsWith("pbr/Procedural/")).length;
  const groups = await page.evaluate(() => [...document.querySelectorAll("#lib > h3")].map(h => h.textContent));
  console.log(`the library: ${lib} cards (${own} PBR sets, ${jp} made in code), groups ${groups.join(", ")}`);
  if (lib < own + jp) fail(`the library shows ${lib} of ${own + jp} sets`);
  if (shelf["pbr/concrete/Concrete027_1K-PNG"] && !groups.includes("concrete")) fail("the project's concrete sets have no group of their own");
  const decals = await page.evaluate(() => document.querySelectorAll("#decals .card").length);
  if (decals < 10) fail(`${decals} decals listed`);
  const set = shelf["pbr/concrete/Concrete027_1K-PNG"] ? "pbr/concrete/Concrete027_1K-PNG" : jp ? "pbr/Procedural/jp_tile45_white" : "#c8c2b6";
  const r = await page.evaluate(async set => {
    window.__paint.shot("photo"); window.__paint.draw();
    const wall = window.__paint.paintAt(0.86, 0.32, set);                 // the right building's wall, through the photo's shot
    const it = wall && window.PT.S.buildings.find(b => b.id === wall.id);
    let worn = false;
    window.__paint.draw();
    const h = window.__paint.at(0.86, 0.32);
    if (h) worn = !!(h.object.material.map || h.object.material.userData.base === set);
    // picked up and tuned live: a tint, rain streaks and moss in patches; the look an object, worn as the set made of it
    window.__paint.pickAt(0.86, 0.32);
    const tuned = set.startsWith("pbr/") ? window.__paint.tune(b => { b.tint = "#c7a99b"; b.layers = [{ wear: "streaks", amount: 1.5 }, { set: "pbr/foliage/Moss002_1K-PNG", amount: 0.5, coverage: 0.2, size: 0.6 }]; }) : null;
    await window.__paint.made(); window.__paint.draw();
    const h2 = window.__paint.at(0.86, 0.32), wears = h2 && h2.object.material.userData.pbr;
    const walk = window.__paint.paintAt(0.93, 0.93, set.startsWith("pbr/") ? "pbr/concrete/Concrete010_1K-PNG" : "#888888", "all");
    const before = (window.PT.S.decals || []).length;
    const d = window.__paint.decalAt(0.45, 0.78, "oil");
    const laid = (window.PT.S.decals || []).length - before;
    window.__paint.undo(); const undone = (window.PT.S.decals || []).length;
    window.__paint.undo(true); const redone = (window.PT.S.decals || []).length;
    const piece = window.PT.pieces.some(p => p.type === "decal");
    const saved = await window.__paint.save();
    return { wall, look: it && JSON.parse(JSON.stringify(it.look)), worn, tuned, wears, walk, streetLook: window.PT.S.look, laid, undone, redone, piece, saved, decal: d && d.n };
  }, set);
  console.log(JSON.stringify(r));
  const want = r.tuned || set, onWall = r.look && r.look[r.wall && r.wall.slot];
  if (!r.wall || !onWall || JSON.stringify(onWall) !== JSON.stringify(want)) fail(`the wall wasn't painted as tuned: ${JSON.stringify(r.wall)} ${JSON.stringify(onWall)} (wanted ${JSON.stringify(want)})`);
  if (!r.worn) fail("the painted wall doesn't wear the set");
  if (r.tuned && !(r.tuned.tint === "#c7a99b" && r.tuned.layers.length === 2 && r.tuned.set === set)) fail(`the brush didn't tune: ${JSON.stringify(r.tuned)}`);
  if (r.tuned && !String(r.wears || "").startsWith("pbr/_made/")) fail(`the tuned wall wears ${r.wears}, not the set made of its look`);
  if (!r.walk || !(r.streetLook || {})[r.walk.slot]) fail(`every ${r.walk && r.walk.slot} wasn't painted: ${JSON.stringify(r.streetLook)}`);
  if (r.laid !== 1 || r.undone !== 0 || r.redone !== 1 || !r.piece) fail(`a decal laid ${r.laid}, undone to ${r.undone}, redone to ${r.redone}, built ${r.piece}`);
  if (!r.decal || r.decal[2] < 0.7) fail(`the decal on the road faces ${r.decal}`);
  const disk = JSON.parse(fs.readFileSync(path.join(DIR, "street.json"), "utf8"));
  const b = disk.buildings.find(x => x.id === (r.wall || {}).id);
  if (!r.saved || !b || JSON.stringify((b.look || {})[r.wall.slot]) !== JSON.stringify(want) || (disk.decals || []).length !== 1) fail("what was saved isn't what was painted");
  await page.screenshot({ path: path.join(ROOT, "Saved/Streets", "paint_check.png") });
} finally {
  await browser.close();
  fs.rmSync(DIR, { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, "Saved/Streets", NAME), { recursive: true, force: true });
}
console.log(errs.length ? `PAINT FAILED (${errs.length})` : "PAINT ok");
process.exit(errs.length ? 1 : 0);

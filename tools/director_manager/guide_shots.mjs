// The Director Manager's pictures in the Director's guide (guides/director/img/m_*.jpg): the page driven in a headless
// browser on a project (the guide's sample, which `tools/godot_director.py guide` makes and then runs this on) and
// pictured at what the guide shows: a quest and its steps (a step for Mari, her answer to the wrong thing given),
// picking when from the desk's palette, what comes next by what's been done, a conversation with a question, the
// moments, the states, an achievement, Coverage and the saves. Nothing is saved to the project; the saves shown are
// made up, in a user dir of its own.
//   node tools/director_manager/guide_shots.mjs --project <folder> [--out <folder>]     (ends MANAGERSHOTS ok)
import { createRequire } from "module";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const req = createRequire(import.meta.url);
const { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../..");
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const PROJ = arg("--project") ? path.resolve(arg("--project")) : null, OUT = path.resolve(arg("--out") || path.join(ROOT, "guides", "director", "img"));
const PORT = Number(process.env.HSDM_PORT || 8799);
const made = [], fails = [];
const bad = (what, why = "") => { fails.push(what); console.log(`  BAD ${what}${why ? "  " + why : ""}`); };
if (!PROJ || !fs.existsSync(path.join(PROJ, "project.godot"))) { console.log("MANAGERSHOTS FAIL: --project <a Godot project folder>"); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

// the made-up saves go in a user dir of the pictures' own (Godot's on Linux: under XDG_DATA_HOME), where the server says
const DATA = path.join(os.tmpdir(), "hsdm_guide", ".local", "share");
fs.rmSync(path.join(os.tmpdir(), "hsdm_guide"), { recursive: true, force: true });

const srv = spawn(process.env.PYTHON || "python3", [path.join(HERE, "serve.py"), "--project", PROJ, "--port", String(PORT)], { env: { ...process.env, XDG_DATA_HOME: DATA }, stdio: ["ignore", "pipe", "pipe"] });
const up = async () => { for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/api/project`)).ok) return true; } catch { /* not yet */ } await new Promise(r => setTimeout(r, 250)); } return false; };
const browser = await req("../browser.cjs").launch(chromium);
const page = await browser.newPage({ viewport: { width: 1400, height: 940 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
const shot = async (file, loc) => {
  const p = path.join(OUT, file + ".jpg");
  if (loc) { await loc.scrollIntoViewIfNeeded(); await loc.screenshot({ path: p, type: "jpeg", quality: 88 }); }
  else await page.screenshot({ path: p, type: "jpeg", quality: 88 });
  made.push(file);
};
const tab = async t => { await page.click(`nav.tabs button[data-tab=${t}]`); await page.waitForTimeout(200); };
try {
  if (!(await up())) throw new Error("the Manager's server never answered");
  const ud = (await (await fetch(`http://127.0.0.1:${PORT}/api/project`)).json()).user;   // a slot and the autosave
  const now = Math.floor(Date.UTC(2026, 10, 1, 23, 52) / 1000);
  fs.mkdirSync(ud, { recursive: true });
  fs.writeFileSync(path.join(ud, "saves_the_house.json"), JSON.stringify({ "1": { where: "A drink", secs: 412, at: now }, auto: { where: "The key", secs: 95, at: now - 600 } }));
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });
  await page.waitForFunction(() => window.hsdm && window.hsdm.S, null, { timeout: 15000 });
  const S = await page.evaluate(() => window.hsdm.S);
  if (!S.quests.some(q => q.id === "q_drink") || !S.talk.mari) throw new Error("not the sample's story (no q_drink, no Mari)");
  // a quest: the drink errand, its step for Mari and her answer to anything else
  await tab("quests");
  await page.click("[data-quest=q_drink]");
  await page.waitForTimeout(150);
  await shot("m_quests");
  // picking when: the desk's palette of triggers, from a step's pill
  await page.click("[data-step=give_mug] .trig button.pill");
  await page.waitForSelector(".mdl .tile");
  await page.waitForTimeout(200);
  await shot("m_trigger", page.locator(".mdl").first());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  // what comes next by what's been done: the night's two ways
  await page.click("[data-quest=q_night]");
  await page.waitForTimeout(150);
  await shot("m_next", page.locator(".card:has(> h3:has-text('What comes next'))"));
  // Mari's conversation with a question and its answers
  await tab("people");
  await page.click("[data-person=mari]");
  await page.waitForTimeout(150);
  await shot("m_talk", page.locator("[data-talk=t_open]"));
  await page.evaluate(() => { document.getElementById("page").scrollTop = 0; });
  await tab("moments");
  await shot("m_moments");
  await tab("states");
  await shot("m_states");
  await tab("achievements");
  await shot("m_achievements", page.locator("[data-achievement=ACH_HOST]"));
  await tab("coverage");
  await shot("m_coverage");
  await tab("saves");
  await shot("m_saves");
  if (await page.evaluate(() => document.getElementById("state").classList.contains("dirty"))) bad("the pictures changed the story (unsaved edits)");
  if (errors.length) bad("errors in the page", errors.slice(0, 3).join(" | "));
} catch (e) {
  bad("the pictures ran through", String(e).slice(0, 400));
} finally {
  await browser.close();
  srv.kill();
}
console.log(`  ${made.join(", ")}`);
console.log(fails.length ? `MANAGERSHOTS FAIL (${fails.length})` : `MANAGERSHOTS ok (${made.length} pictures in ${path.relative(ROOT, OUT) || OUT})`);
process.exit(fails.length ? 1 : 0);

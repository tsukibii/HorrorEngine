// MANAGERPAGE: the Director Manager's page in a headless browser (docs/GODOT_DIRECTOR_PLAN.md §4), on its own server and a
// scratch project (Saved/manager_check: a project.godot, the sample's kind of story, the scene's ids as the plugin indexes
// them, a save): every tab drawn with no errors; a quest added with a step whose trigger is picked from the desk's
// palette; a condition added; a round (hide and seek); a conversation, a moment, a state, an ending, an achievement added; saved, and the file on
// disk holds them (its last version kept in director/history/); Coverage finds what the scene has that the story never
// names and what the story names that the scene hasn't got; a save deleted; the next play set.
//   node tools/director_manager/pagetest.mjs        (ends MANAGERPAGE ok)
import { createRequire } from "module";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../..");
const PROJ = path.join(ROOT, "Saved", "manager_check"), PORT = 8797;
const USER = path.join(os.tmpdir(), "hsdm_user");                   // XDG_DATA_HOME for the server: its own user dir
const fails = [];
const ok = (what, good, why = "") => { console.log((good ? "  ok  " : "  BAD ") + what + (good || !why ? "" : "  " + why)); if (!good) fails.push(what); };

// ---- the scratch project ----------------------------------------------------------------------------------------------
fs.rmSync(PROJ, { recursive: true, force: true });
fs.mkdirSync(path.join(PROJ, "director"), { recursive: true });
fs.mkdirSync(path.join(PROJ, ".hsdirector"), { recursive: true });
fs.writeFileSync(path.join(PROJ, "project.godot"), 'config_version=5\n\n[application]\n\nconfig/name="Manager Check"\n');
const story = {
  format: 1,
  quests: [{ id: "q_key", title: "The key", objective: "Find the key", steps: [{ id: "find_key", text: "Find the key", done: { pickup: "bedroom_key" } }] }],
  moments: [{ id: "figure_scare", when: { enter: "kitchen_doorway" }, if: "read:letter", do: [{ think: "What was that?" }] }],
  talk: { mari: [{ id: "t_hello", lines: [{ text: "Hello." }] }] },
  states: [{ while: { done: "q_key" }, set: { mari: { do: "go", to: "bedroom_spot" } } }],
  endings: [{ id: "e_end", kind: "good", title: "The end" }], achievements: [], facts: {},
};
fs.writeFileSync(path.join(PROJ, "director", "director.json"), JSON.stringify(story, null, 1));
const scene = { area: ["hall", "kitchen", "kitchen_doorway"], room: ["hall", "kitchen"], thing: ["letter", "bedroom_key", "kettle", "wardrobe", "kitchen_door", "mari", "teapot_lonely"],
  door: ["kitchen_door"], item: ["bedroom_key", "mug"], note: ["letter"], actor: ["mari"], spot: ["start", "bedroom_spot", "corner"], light: ["hall_lamp"], level: ["house"],
  life: ["kettle"], "life:kettle": ["kettle"], motion: ["sample_idle"], path: ["hall_path"] };
fs.writeFileSync(path.join(PROJ, ".hsdirector", "index.json"), JSON.stringify({ _scenes: { "res://main.tscn": scene }, ...scene }));
const ud = path.join(USER, "godot", "app_userdata", "Manager Check");
fs.mkdirSync(ud, { recursive: true });
fs.writeFileSync(path.join(ud, "saves_manager_check.json"), JSON.stringify({ "1": { where: "The key", secs: 30, at: 1790000000 }, auto: { where: "The key", secs: 12, at: 1790000100 } }));
fs.mkdirSync(path.join(PROJ, "game"), { recursive: true });
fs.writeFileSync(path.join(PROJ, "game", "lives.json"), JSON.stringify({ lives: { kettle: { states: [{ id: "off" }, { id: "heating" }, { id: "boiling" }] } } }));

// ---- the server and the page ------------------------------------------------------------------------------------------
const srv = spawn(process.env.PYTHON || "python3", [path.join(HERE, "serve.py"), "--project", PROJ, "--port", String(PORT)], { env: { ...process.env, XDG_DATA_HOME: USER }, stdio: ["ignore", "pipe", "pipe"] });
await new Promise(r => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
try {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "load" });
  await page.waitForFunction(() => window.hsdm && window.hsdm.S, null, { timeout: 15000 });
  ok("the page opens on the project (its name in the header)", (await page.textContent("#proj")) === "Manager Check");
  for (const t of ["quests", "people", "moments", "states", "endings", "facts", "achievements", "coverage", "saves"]) {
    await page.click(`nav.tabs button[data-tab=${t}]`);
    await page.waitForTimeout(80);
  }
  ok("every tab drawn with no errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  const stray = [];
  for (const t of ["quests", "people", "moments", "states", "endings", "facts", "achievements", "coverage", "saves"]) {
    await page.click(`nav.tabs button[data-tab=${t}]`);
    if ((await page.textContent("main.page")).includes("[object ")) stray.push(t);
  }
  ok("every tab's cards drawn as cards (no [object ...] text)", stray.length === 0, stray.join(", "));
  // a quest, its step, its trigger from the desk's palette, a condition on its next
  await page.click("nav.tabs button[data-tab=quests]");
  await page.click("[data-act=new-quest]");
  await page.click("[data-act=new-step]");
  await page.click("[data-step] .trig button.pill");
  await page.waitForSelector(".mdl .tile");
  await page.click(".mdl .tile:has-text('The player picks up')");
  await page.waitForTimeout(150);
  const sel = await page.$(".mdl select");
  if (sel) { await sel.selectOption("bedroom_key"); }
  await page.click(".mdl .mdl-f button.primary");
  await page.waitForTimeout(150);
  let S = await page.evaluate(() => window.hsdm.S);
  const q2 = S.quests[1];
  ok("a quest added, its step's trigger picked from the desk's palette (picks up the key)", !!q2 && q2.steps.length === 1 && q2.steps[0].done && q2.steps[0].done.pickup === "bedroom_key", JSON.stringify(q2 && q2.steps));
  await page.click("text=Add a way, by what's been done");
  await page.click(".card:has-text('What comes next') .cond button:has-text('add')");
  await page.waitForSelector(".mdl input[list]");
  await page.fill(".mdl input[list]", "read:letter");
  await page.click(".mdl .mdl-f button.primary");
  await page.waitForTimeout(100);
  S = await page.evaluate(() => window.hsdm.S);
  ok("a condition added to the quest's next (read:letter)", JSON.stringify(S.quests[1].next || []).includes("read:letter"), JSON.stringify(S.quests[1].next));
  // a round of gameplay instead of steps (STORY_FORMAT §9.8): hide and seek, Mari hunting
  await page.click("[data-act=new-round]");
  await page.selectOption("[data-round] .row:has-text('Who hunts') select", "mari");
  S = await page.evaluate(() => window.hsdm.S);
  const rq = S.quests[1], rtext = await page.textContent("[data-round]");
  ok("a round added to the quest (hide and seek, Mari hunting; its results' facts named for what comes next)",
    !!rq.round && rq.round.type === "hide" && rq.round.seeker === "mari" && rtext.includes(`result:${rq.id}:hidden`) && rtext.includes(`result:${rq.id}:found`), JSON.stringify(rq.round));
  // a conversation, a moment, a state, an ending, an achievement
  await page.click("nav.tabs button[data-tab=people]");
  await page.click("[data-act=new-talk]");
  await page.click("nav.tabs button[data-tab=moments]");
  await page.click("[data-act=new-moment]");
  await page.click("nav.tabs button[data-tab=states]");
  await page.click("[data-act=new-state]");
  await page.click("nav.tabs button[data-tab=endings]");
  await page.click("[data-act=new-ending]");
  S = await page.evaluate(() => window.hsdm.S);
  ok("a conversation, a moment, a state and an ending added", S.talk.mari.length === 2 && S.moments.length === 2 && S.states.length === 2 && S.endings.length === 2);
  // saved: the file on disk, its last version kept
  await page.click("#save");
  await page.waitForTimeout(400);
  const disk = JSON.parse(fs.readFileSync(path.join(PROJ, "director", "director.json"), "utf8"));
  const hist = fs.readdirSync(path.join(PROJ, "director", "history"));
  ok("saved: director/director.json holds them, the version before kept in history/", disk.quests.length === 2 && disk.quests[1].steps[0].done.pickup === "bedroom_key" && disk.quests[1].round && disk.quests[1].round.seeker === "mari" && hist.length === 1);
  ok("the header says saved", (await page.textContent("#state")) === "saved");
  // coverage
  await page.click("nav.tabs button[data-tab=coverage]");
  const cov = await page.evaluate(() => window.hsdm.cov);
  ok("Coverage: what the scene has that the story never names (the lonely teapot, the corner, the hall path, the mug)",
    cov.unused.thing.includes("teapot_lonely") && cov.unused.spot.includes("corner") && cov.unused.path.includes("hall_path") && cov.unused.item.includes("mug") && !cov.unused.thing.includes("bedroom_key"), JSON.stringify(cov.unused));
  ok("Coverage: the letter counts as named by a fact (read:letter), Mari by her conversation", !cov.unused.note.includes("letter") && !cov.unused.actor.includes("mari"));
  ok("Coverage: what's wrong (the new moment has no when, the new quest nothing leads to... )", cov.problems.some(p => p.text.includes("has no when")), JSON.stringify(cov.problems.map(p => p.text)));
  ok("Coverage: the round's hunter named, nothing wrong with the round", !cov.unused.actor.includes("mari") && !cov.problems.some(p => p.text.includes("round")), JSON.stringify(cov.problems.map(p => p.text)));
  // saves
  await page.click("nav.tabs button[data-tab=saves]");
  ok("the saves listed (a slot and the autosave)", (await page.$$("main.page table.cov tr")).length === 3);
  await page.click("main.page table.cov tr >> nth=1 >> button");
  await page.waitForTimeout(300);
  const saves = JSON.parse(fs.readFileSync(path.join(ud, "saves_manager_check.json"), "utf8"));
  ok("a save deleted (slot 1 gone, the autosave kept)", !saves["1"] && !!saves.auto, JSON.stringify(saves));
  await page.selectOption("main.page .card:has-text('The next play starts at') select", "q_key");
  await page.click("main.page button:has-text('Set')");
  await page.waitForTimeout(300);
  const run = JSON.parse(fs.readFileSync(path.join(ud, "hs_director_run.json"), "utf8"));
  ok("the next play set (Godot's play-from-here file)", run.from === "q_key");
  ok("no errors in the page", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  ok("the page ran through", false, String(e).slice(0, 400));
} finally {
  await browser.close();
  srv.kill();
}
console.log(fails.length ? `MANAGERPAGE FAILED (${fails.length})` : "MANAGERPAGE ok");
process.exit(fails.length ? 1 : 0);

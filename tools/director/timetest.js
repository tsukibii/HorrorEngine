// The time of day on the desk (STORY_FORMAT §3.1 `time`): a scene without one keeps the time of the scene it branched
// from, back to game.time (night when unset); the board marks it, the scene's picker says where it comes from, the
// stage lights the level by it, and the Watch changes it when a scene with its own time plays. In memory only: the
// Pilot's message scene set to day. Ends "TIMES ok".
//
//   python tools/director/serve.py          (in another shell)
//   node tools/director/timetest.js
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const URL = (process.env.DESK_URL || "http://127.0.0.1:8780/") + "?game=Pilot";
const fail = m => { console.error("TIMES FAIL: " + m); process.exit(1); };

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__dd && window.__dd.PLAN && window.__dd.flowStage && window.__dd.flowStage.level, null, { timeout: 60000 });
  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { fail(`${what}: ${e.message}`); } };

  await step("unset, the game starts at night and every node keeps it", async () => {
    const r = await page.evaluate(() => { const d = window.__dd; d.select("n_search"); return { time: d.flowStage.time, sky: d.flowStage.scene.background.getHex() }; });
    if (r.time !== "night" || r.sky !== 0x070a16) throw new Error(`the search at ${r.time}, the sky ${r.sky.toString(16)}`);
  });
  await step("a scene set to day: the scenes and tasks after it keep day, the ones before stay night; the picker says where the time comes from", async () => {
    const r = await page.evaluate(() => {
      const d = window.__dd, S = d.S; S.scenes[S.flow.n_message.ref].time = "day";
      const at = id => { d.select(id); return d.flowStage.time; };
      const times = { arrive: at("n_arrive"), message: at("n_message"), search: at("n_search"), cellar: at("n_cellar") };
      d.select("n_cellar");
      const row = [...document.querySelectorAll("#inspector .row")].find(r => /^time/.test(r.textContent));
      const card = [...document.querySelectorAll("#board .card")].find(c => /n_message/.test(c.textContent));
      return { times, picker: row ? row.querySelector("select").selectedOptions[0].textContent : null, card: card ? card.textContent : "", sky: d.flowStage.scene.background.getHex(), windows: d.flowStage.windows.length };
    });
    const t = r.times;
    if (t.arrive !== "night" || t.message !== "day" || t.search !== "day" || t.cellar !== "day") throw new Error(`times ${JSON.stringify(t)}`);
    if (!/as before: day \(from Mari in the hall\)/.test(r.picker || "")) throw new Error(`the cellar scene's picker reads ${JSON.stringify(r.picker)}`);
    if (!/☀ day/.test(r.card)) throw new Error(`the board's card for the message scene: ${r.card}`);
    if (r.sky !== 0xb7c6d6 || r.windows < 1) throw new Error(`the stage by day: sky ${r.sky.toString(16)}, ${r.windows} window lights`);
  });
  await step("the Watch changes the time when a scene with its own time plays, and keeps it after", async () => {
    await page.click('nav button[data-v="watchView"]');
    await page.uncheck("#wPlay"); await page.check("#wFast");     // tasks as cards, each passing in 2 s
    const r = await page.evaluate(async () => {
      const d = window.__dd; d.watch("n_arrive");
      const t0 = d.run.time, s0 = d.watchStage.time;
      const until = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return true; await new Promise(r => setTimeout(r, 200)); } return false; };
      const got = await until(() => d.run && d.run.trail.includes("n_message"), 60000);
      const t1 = d.run && d.run.time, s1 = d.watchStage.time;
      d.stopWatch();
      return { t0, s0, got, t1, s1 };
    });
    if (r.t0 !== "night" || r.s0 !== "night") throw new Error(`the Watch starts at ${r.t0} (stage ${r.s0})`);
    if (!r.got) throw new Error("the Watch never reached the message scene");
    if (r.t1 !== "day" || r.s1 !== "day") throw new Error(`after the message scene: ${r.t1} (stage ${r.s1})`);
  });
  await step("game.time sets the start", async () => {
    await page.click('nav button[data-v="flowView"]');
    const r = await page.evaluate(() => { const d = window.__dd; d.S.game.time = "dusk"; d.select("n_arrive"); return d.flowStage.time; });
    if (r !== "dusk") throw new Error(`the arrival at ${r}`);
  });
  if (errors.length) fail("page errors: " + errors.slice(0, 3).join(" | "));
  console.log("TIMES ok");
  await browser.close();
})();

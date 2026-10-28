// A cast member's models on the desk (STORY_FORMAT §2 `models`, §3.1 a scene's; HANDOFF_DIRECTOR_TODO §5): a model a
// scene picks is worn there and in every scene after it until one picks another or sets it back to default; the
// Database keeps a cast member's models, a scene's picker says what the flow brings, the board's card shows a pick,
// the stage dresses each node by it, the Watch changes the body as it plays on. In memory only: the Pilot's Mari gets a
// second look (MHR_hi.fbx), the message scene picks it, the cellar sets her back. Ends "MODELS ok".
//
//   python tools/director/serve.py          (in another shell)
//   node tools/director/modelstest.js
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const URL = (process.env.DESK_URL || "http://127.0.0.1:8780/") + "?game=Pilot";
const fail = m => { console.error("MODELS FAIL: " + m); process.exit(1); };

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on("dialog", d => d.accept());
  await page.goto(URL);
  await page.waitForFunction(() => window.__dd && window.__dd.PLAN && window.__dd.flowStage && window.__dd.flowStage.level, null, { timeout: 60000 });
  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { fail(`${what}: ${e.message}`); } };
  const LOOK = "MHR_hi.fbx";

  await step("the Database: Mari's Models row adds a look, its body picked from the bodies", async () => {
    const r = await page.evaluate(async () => {
      const d = window.__dd; d.openDb("cast", "mari"); await new Promise(res => setTimeout(res, 400));
      const add = [...document.querySelectorAll("#dbView button")].find(b => /Add a model/.test(b.textContent));
      if (!add) return { add: false };
      add.click(); await new Promise(res => setTimeout(res, 300));
      return { add: true, models: JSON.parse(JSON.stringify(d.S.cast.mari.models || {})), row: !!document.querySelector("#dbView .db-model") };
    });
    if (!r.add || !r.row || Object.keys(r.models).length !== 1) throw new Error(JSON.stringify(r));
  });
  await step(`the look renamed “wet” and given ${LOOK}; the message scene picks it, the cellar sets her back to default`, async () => {
    await page.evaluate(async LOOK => {
      const d = window.__dd, S = d.S; S.cast.mari.models = { wet: LOOK };
      S.scenes[S.flow.n_message.ref].models = { mari: "wet" }; S.scenes[S.flow.n_cellar.ref].models = { mari: "default" };
      d.touch(); await d.loadBodies();
    }, LOOK);
  });
  await step("the stage dresses each node by the flow: default before the pick, the look from it on, default again from the cellar", async () => {
    const r = await page.evaluate(() => {
      const d = window.__dd, at = id => { d.select(id); return d.flowStage.cast.mari.file; };
      return { arrive: at("n_arrive"), message: at("n_message"), search: at("n_search"), cellar: at("n_cellar") };
    });
    if (r.arrive !== "MHR.fbx" || r.message !== LOOK || r.search !== LOOK || r.cellar !== "MHR.fbx") throw new Error(JSON.stringify(r));
  });
  await step("the picker of a scene after it says what the flow brings; the board's card shows the pick", async () => {
    const r = await page.evaluate(() => {
      const d = window.__dd, S = d.S;                  // a scene after the message scene (not the cellar): its picker
      const sid = Object.keys(S.flow).find(k => S.flow[k].type === "scene" && !["n_message", "n_cellar"].includes(k) && (d.models()[k] || {}).models && d.models()[k].models.mari === "wet");
      d.select(sid);
      const row = [...document.querySelectorAll("#inspector .row")].find(x => /^models/.test(x.textContent));
      const card = [...document.querySelectorAll("#board .card")].find(c => /n_message/.test(c.textContent));
      return { sid, picker: row ? row.querySelector("select").selectedOptions[0].textContent : null, card: card ? card.textContent : "" };
    });
    if (!r.sid || !/as before: wet/.test(r.picker || "")) throw new Error(`the picker of ${r.sid}: ${JSON.stringify(r.picker)}`);
    if (!/Mari: wet/.test(r.card)) throw new Error(`the message scene's card: ${r.card}`);
  });
  await step("the Watch: Mari plays the message scene in the look, the run carrying it", async () => {
    await page.evaluate(() => { document.querySelector('nav button[data-v="watchView"]').click(); window.__dd.watch("n_message"); });
    await page.waitForFunction(() => window.__dd.run && window.__dd.run.trail.includes("n_message"), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const a = await page.evaluate(() => ({ file: window.__dd.watchStage.cast.mari.file, models: window.__dd.run.models }));
    if (a.file !== LOOK || (a.models || {}).mari !== "wet") throw new Error(`in the message scene: ${JSON.stringify(a)}`);
    await page.evaluate(() => window.__dd.stopWatch());
  });
  if (errors.length) fail("page errors: " + errors.slice(0, 3).join(" | "));
  console.log("MODELS ok");
  await browser.close();
})().catch(e => fail(e.stack || String(e)));

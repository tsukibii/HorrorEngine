// Play mode in a headless browser (docs/GAMEPLAY_PLAN.md §8 step 1): the Pilot walked from the start to the good
// ending with the keys and the cursor, as a player would: a wall stops you, the front door opens with E, the hall's
// trigger ends the arrival, the letter reads, the kitchen's glimpse fires, the drawer's code is typed on the panel,
// the key shows and is taken, the locked cellar door opens with it, the struggle is dragged free, and the timed run
// out of the house ends on the porch. Ends "PLAY ok".
//
//   python tools/director/serve.py          (in another shell)
//   node tools/director/playtest.js [shot.png]
//
// Needs Playwright (npm i playwright, or PLAYWRIGHT=<path to its package>).
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const URL = (process.env.DESK_URL || "http://127.0.0.1:8780/") + "?game=Pilot";
const shot = process.argv[2];
const OPTIONAL = /\/api\/(takes|motion)\//;          // a game without takes or motion files yet answers 404: not Play's
const fail = m => { console.error("PLAY FAIL: " + m); process.exit(1); };

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on("response", r => { if (r.status() >= 400 && !OPTIONAL.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__dd && window.__dd.S && window.__dd.PLAN, null, { timeout: 30000 });
  await page.click('nav button[data-v="watchView"]');
  await page.check("#wPlay"); await page.check("#wSkip");
  await page.click("#wStart");

  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { await page.screenshot({ path: shot || "playtest_fail.png" }); fail(`${what}: ${e.message}`); } };
  const playing = (on = true, ms = 60000) => page.waitForFunction(on => { const p = window.__dd.play; return on ? p && p.active : !(p && p.active); }, on, { timeout: ms });
  const scenesUntilPlay = async (ms = 90000) => {          // skip scenes (dev skip), drag free of any struggle
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (await page.evaluate(() => !!(window.__dd.play && window.__dd.play.active))) return;
      if (await page.$(".qte")) {
        await page.mouse.move(700, 300); await page.mouse.down();
        for (let y = 300; y < 800; y += 25) await page.mouse.move(700, y);
        await page.mouse.up();
      } else await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
    }
    throw new Error("Play never came back");
  };
  // stand `d` metres from a thing, facing it, on a side where nothing's in the way and the cursor lands on it
  const goTo = (id, d = 0.9) => page.evaluate(([id, d]) => {
    const rt = window.__dd.play, THREE_V = rt.player.pos.constructor, o = rt.byId[id];
    if (!o) throw new Error("no " + id);
    const at = o.getWorldPosition(new THREE_V());
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, feet = new THREE_V(at.x + Math.cos(a) * d, 0, at.z - Math.sin(a) * d);
      const yaw = Math.atan2(-(at.z - feet.z), at.x - feet.x) * 180 / Math.PI;
      rt.place(feet, yaw, 0);
      const before = rt.player.pos.clone(); rt.pushOut(rt.set("walk"));
      if (before.distanceTo(rt.player.pos) > 1e-3) continue;
      const eye = rt.eyePos(), dy = at.y - eye.y;
      rt.player.pitch = Math.atan2(dy, d) * 180 / Math.PI;
      rt.tick(0.016);
      if (rt.target === o) return { k, cursor: document.querySelector(".ph-cursor").dataset.cursor };
    }
    throw new Error(`can't get the cursor on ${id}`);
  }, [id, d]);
  const press = async (key, ms = 120) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  const flag = f => page.evaluate(f => window.__dd.run.flags.has(f), f);
  // stand at a story point facing yaw (where you stand isn't an "enter"), then walk forward for ms
  const walkIn = async (x, y, yaw, ms) => {
    await page.evaluate(([x, y, yaw]) => { const rt = window.__dd.play; rt.place(new (rt.player.pos.constructor)(x, 0, -y), yaw, 0); }, [x, y, yaw]);
    await press("KeyW", ms);
  };

  await step("the arrival plays on the porch", () => playing());
  await step("a wall stops you", async () => {
    await page.evaluate(() => { const rt = window.__dd.play; rt.place(new (rt.player.pos.constructor)(2, 0, -1.5), 180, 0); });  // in the hall, facing west
    await press("KeyW", 2500);
    const x = await page.evaluate(() => window.__dd.play.player.pos.x);
    if (x < 0.2 || x > 0.6) throw new Error(`walked to x=${x.toFixed(2)}: the hall's west wall is at 0`);
    await page.evaluate(() => { const rt = window.__dd.play; rt.placeAt(rt.level, "start"); });
  });
  await step("the front door: the cursor says open, E opens it", async () => {
    const r = await goTo("front_door", 1.0);
    if (r.cursor !== "open") throw new Error("cursor " + r.cursor);
    await press("KeyE"); await page.waitForTimeout(900);
    if (!(await page.evaluate(() => window.__dd.play.doors.front_door.open))) throw new Error("not open");
  });
  await step("walking in through it ends the arrival (the hall's trigger)", async () => {
    await page.evaluate(() => { const rt = window.__dd.play; rt.place(new (rt.player.pos.constructor)(2, 0, 0.6), 90, 0); });
    await press("KeyW", 1500);
    await playing(false, 10000);
    if (!(await page.evaluate(() => window.__dd.play.doors.front_door.locked))) throw new Error("the slam didn't lock it");
  });
  await step("the message scene, then the search", () => scenesUntilPlay());
  await step("the letter: the cursor says read, the note opens", async () => {
    const r = await goTo("letter_hall", 0.7);
    if (r.cursor !== "read") throw new Error("cursor " + r.cursor);
    await press("KeyE"); await page.waitForSelector(".ph-panel .ph-text");
    const t = await page.textContent(".ph-panel .ph-text"); if (!/door open/.test(t)) throw new Error("note text " + t);
    await page.click(".ph-panel .ph-close");
  });
  await step("crouch (toggle) lowers the eye", async () => {
    await press("KeyC"); await page.waitForTimeout(700);
    const e = await page.evaluate(() => window.__dd.play.player.eye); if (e > 1.2) throw new Error("eye " + e);
    await press("KeyC"); await page.waitForTimeout(700);
  });
  await step("the kitchen's glimpse fires on entering", async () => {
    await walkIn(2, 5.4, 90, 1300); await page.waitForTimeout(1500);
    const line = await page.textContent(".ph-line"); if (!/Mari\?/.test(line)) throw new Error("line " + line);
  });
  await step("the drawer's code on the keypad sets drawer_open and shows the key", async () => {
    await goTo("desk_lock", 0.8);
    await press("KeyE"); await page.waitForSelector(".ph-pad");
    for (const k of "0314") await page.click(`.ph-pad button:text-is("${k}")`);
    await page.click('.ph-pad button:text-is("OK")');
    await page.waitForTimeout(500);
    if (!(await flag("drawer_open"))) throw new Error("no flag");
    if (!(await page.evaluate(() => window.__dd.play.byId.cellar_key_pickup.visible))) throw new Error("the key isn't shown");
  });
  await step("the cellar door is locked without the key", async () => {
    await goTo("cellar_door", 1.0);
    const c = await page.evaluate(() => document.querySelector(".ph-cursor").dataset.cursor);
    if (c !== "locked") throw new Error("cursor " + c);
  });
  await step("the key: taken, the stitch ends after the knocking", async () => {
    const r = await goTo("cellar_key_pickup", 0.7);
    if (r.cursor !== "take") throw new Error("cursor " + r.cursor);
    await press("KeyE");
    await page.waitForFunction(() => !window.__dd.play.end, null, { timeout: 15000 });
  });
  await step("the choice by act: the key opens the cellar door, walking in chooses it", async () => {
    await playing();
    await goTo("cellar_door", 1.0);
    await press("KeyE"); await page.waitForTimeout(900);
    if (!(await page.evaluate(() => window.__dd.play.doors.cellar_door.open))) throw new Error("not open");
    await walkIn(0.7, 2, 180, 1400);
    await playing(false, 10000);
  });
  await step("the cellar, the grab (dragged free), then the run", () => scenesUntilPlay());
  await step("the run out has its timer", async () => {
    const t = await page.textContent(".ph-timer"); if (!(+t > 0)) throw new Error("timer " + t);
  });
  await step("out onto the porch: the good ending", async () => {
    await walkIn(2, -3.6, 90, 1200);             // the Pilot never unlocks the front door after the slam: in from the garden
    await page.waitForFunction(() => window.__watchEnd, null, { timeout: 15000 });
    const end = await page.evaluate(() => window.__watchEnd);
    if (end !== "Out of the house") throw new Error("ending " + end);
  });
  if (shot) await page.screenshot({ path: shot });
  if (errors.length) fail("page errors: " + errors.join(" | "));
  await browser.close();
  console.log("PLAY ok");
})().catch(e => fail(e.stack || e.message));

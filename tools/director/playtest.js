// Play mode in a headless browser (docs/GAMEPLAY_PLAN.md §8 step 1): the Pilot walked from the start to the good
// ending with the keys, the mouse and the cursor, as a player would (a left click uses: DECISIONS 2026-10-27, later): a
// wall stops you, the front door opens with a click, the hall's trigger ends the arrival, Mari walks her route in the
// hall, a question (ask) is answered beside her, a die is rolled and its face heard, a plushie is picked up into the
// inventory (lagging, flopping and bobbing in the hand) and put down with G (on the floor in front of you, heard where
// it lies), the inventory's row (E hides and shows it, the one in the hand in the middle, the wheel turns it, at most
// five), Shift runs, a game of chō-han is played at the hall table, the letter reads, the kitchen's kettle is switched on and boils by itself, a click hides in the locker and gets out, her eyes catch
// you in the open but not hidden or in a safe zone, the kitchen's glimpse fires, the drawer's code is typed on the panel,
// the key shows and is taken, the locked cellar door opens with it, the grab is answered ("Let go of me.": no quick-time events, DECISIONS 2026-10-27), and the timed run
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
  await page.evaluate(async () => {                 // in memory only: two chairs to sit on, one starts a triggered scene
    const S = window.__dd.S, k = S.levels.house.rooms.find(r => r.id === "kitchen");
    for (const id of ["chair_a", "chair_b"]) k.props.find(p => p.id === id).use = "sit";
    S.stitches.t_search.beats.push({ id: "b_sit", when: { use: "chair_b" }, do: [{ scene: "s_message" }] });
    S.levels.house.rooms.find(r => r.id === "hall").props.push({ id: "big_die", shape: "box 0.3 0.3 0.3", at: [2.6, 4.2], use: "roll" });
    S.stitches.t_search.beats.push({ id: "b_roll", when: { rolled: "big_die", at_least: 1 }, optional: true, do: [{ flag: "rolled_once" }] });
    S.levels.house.rooms.find(r => r.id === "hall").props.push({ id: "plush", shape: "box 0.3 0.25 0.35", at: [1.0, 3.0], use: "carry", physics: "plushie" });
    for (let i = 1; i <= 6; i++) S.levels.house.rooms.find(r => r.id === "hall").props.push({ id: "inv_" + i, shape: "box 0.08 0.08 0.08", at: [0.5 + 0.3 * ((i - 1) % 3), i <= 3 ? 5.0 : 5.4], use: "pickup", item: "inv_item_" + i });
    S.stitches.t_search.beats.push({ id: "b_inv_put", when: { dropped: "inv_6", in: "hall" }, optional: true, do: [{ flag: "inv_put" }] });
    S.items = Object.assign(S.items || {}, { flashlight: { name: "Flashlight", torch: true } });      // the flashlight: F, and the story's torch
    S.levels.house.rooms.find(r => r.id === "hall").props.push({ id: "torch1", shape: "cyl 0.025 0.18", at: [1.4, 5.0], use: "pickup", item: "flashlight" });
    S.stitches.t_search.beats.push({ id: "b_torch_on", when: { torch: "on" }, optional: true, do: [{ flag: "torch_on" }] },
      { id: "b_torch_dead", when: { flag: "kill_torch" }, optional: true, do: [{ torch: "dead" }] }, { id: "b_torch_works", when: { flag: "fix_torch" }, optional: true, do: [{ torch: "works" }] });
    S.stitches.t_search.beats.push({ id: "b_plush", when: { carrying: "plush" }, optional: true, do: [{ flag: "has_plush" }] });
    S.stitches.t_search.beats.push({ id: "b_put", when: { dropped: "plush", in: "hall" }, optional: true, do: [{ flag: "plush_put" }] });
    S.stitches.t_search.beats.push({ id: "b_put_k", when: { dropped: "plush", in: "kitchen" }, optional: true, do: [{ flag: "plush_kitchen" }] });
    Object.assign(S.levels.house.rooms.find(r => r.id === "hall").props.find(p => p.id === "hall_table"), { use: "game", game: "chohan", vs: "mari", settings: { seed: 3 } });
    S.stitches.t_search.beats.push({ id: "b_game", when: { played: "hall_table" }, optional: true, do: [{ flag: "played_dice" }] });
    for (const r of ["win", "lose"]) S.stitches.t_search.beats.push({ id: "b_" + r, when: { played: "hall_table", result: r }, optional: true, do: [{ flag: r + "_dice" }] });
    S.levels.house.rooms.find(r => r.id === "hall").props.push({ id: "hall_safe", use: "trigger", at: [3.3, 3.5], size: [0.8, 0.8, 2.4], safe: true });
    S.levels.house.routes = { r_hall: { points: [{ at: "hall_mari_back_spot", wait: 1, pose: "look_left" }, "hall_mari_near_spot"], mode: "pingpong" } };
    S.stitches.t_search.beats.push({ id: "b_walk", when: { start: true }, do: [{ behave: "mari", as: "path", route: "r_hall" }] });
    S.stitches.t_search.beats.push({ id: "b_ask", when: { flag: "ask_now" }, optional: true, do: [{ ask: "q_stay", line: "mari_002", who: "mari",
      options: [{ id: "stay", label: "I'll stay" }, { id: "go", label: "I should go", do: [{ flag: "said_go" }] }] }] });
    S.stitches.t_search.beats.push({ id: "b_answered", when: { answered: "q_stay", option: "go" }, optional: true, do: [{ flag: "heard_go" }] });
    S.levels.house.rooms.find(r => r.id === "kitchen").props.push({ id: "pilot_kettle", kit: "kettle_jug", on: "kitchen_table", at: [2.5, 1.75], rot: 270, secs: { heating: 1, boiling: 0.5 } });
    S.stitches.t_search.beats.push({ id: "b_kettle", when: { state: "pilot_kettle", is: "boiled" }, optional: true, do: [{ flag: "tea_ready" }] });
    // a request (STORY_FORMAT §9.12): Mari asks for the kettle; when it's boiled she walks to the kitchen and sits down
    S.levels.house.rooms.find(r => r.id === "kitchen").props.push({ id: "kitchen_chair_spot", use: "spot", at: [1.4, 1.2], rot: 90 });
    S.stitches.t_search.beats.find(b => b.id === "b_search_list").do.push({ todo: "make_tea", text: "Put the kettle on", who: "mari", ticks: { state: "pilot_kettle", is: "boiled" },
      on: { done: [{ behave: "mari", as: "go", via: ["hall_mari_back_spot"], to: "kitchen_chair_spot", then: "sit" }] } });
    S.stitches.t_search.beats.push({ id: "b_tea_sat", when: { arrived: "mari", at: "kitchen_chair_spot" }, optional: true, do: [{ think: "She sat down to wait for her tea." }] });
    // the player's name (STORY_FORMAT §4 `name`): asked in a box, then {name} in what's shown says it
    S.stitches.t_search.beats.push({ id: "b_name", when: { flag: "name_now" }, optional: true, do: [{ name: "What's your name?" }, { think: "{name}, keep it together." }] });
    await window.__dd.replan();
  });
  await page.click('nav button[data-v="watchView"]');
  await page.check("#wPlay"); await page.check("#wSkip");
  // the pointer lock, faked (a headless browser has none): a left click while it's "locked" uses what's under the reticle
  await page.evaluate(() => {
    const box = document.querySelector("#watchBox"), fire = () => document.dispatchEvent(new Event("pointerlockchange"));
    window.__lock = null; Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => window.__lock });
    document.exitPointerLock = () => { if (window.__lock) { window.__lock = null; fire(); } };
    box.requestPointerLock = () => { window.__lock = box; fire(); return Promise.resolve(); };
  });
  await page.click("#wStart");

  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { await page.screenshot({ path: shot || "playtest_fail.png" }); fail(`${what}: ${e.message}${errors.length ? "\n  page errors: " + errors.join(" | ") : ""}`); } };
  const playing = (on = true, ms = 60000) => page.waitForFunction(on => { const p = window.__dd.play; return on ? p && p.active : !(p && p.active); }, on, { timeout: ms });
  const scenesUntilPlay = async (ms = 90000) => {          // skip scenes (dev skip), mash free of any struggle
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (await page.evaluate(() => !!(window.__dd.play && window.__dd.play.active))) return;
      if (await page.$(".ph-dock .ph-opt")) await page.keyboard.press("Digit1");   // a scene's choice: the first answer (the grab's "Let go of me.")
      else if (await page.$(".qte")) {
        for (let i = 0; i < 6; i++) { await page.keyboard.press("KeyE"); await page.keyboard.press("Space"); }
        await page.mouse.click(700, 400);
      } else await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
    }
    throw new Error("Play never came back");
  };
  // stand `d` metres from a thing, facing it, on a side where nothing's in the way and the cursor lands on it
  // (after any look the story is turning you through, or a move, has finished: they'd turn the aim away)
  const goTo = (id, d = 0.9) => page.waitForFunction(() => { const rt = window.__dd.play; return !rt.lookTween && !rt.moving; }, null, { timeout: 60000 }).then(() => page.evaluate(([id, d]) => {
    const rt = window.__dd.play, THREE_V = rt.player.pos.constructor, o = rt.byId[id];
    if (!o) throw new Error("no " + id);
    const at = o.getWorldPosition(new THREE_V());
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, feet = new THREE_V(at.x + Math.cos(a) * d, 0, at.z - Math.sin(a) * d);
      const yaw = Math.atan2(-(at.z - feet.z), at.x - feet.x) * 180 / Math.PI;
      rt.place(feet, yaw, 0);
      const before = rt.player.pos.clone(); rt.pushOut(rt.set("walk"));
      if (before.distanceTo(rt.player.pos) > 1e-3) continue;
      if (rt.triggers.some(t => rt.isIn(t) && !rt.inside.has(t.id))) continue;   // standing here would trip a trigger (enter)
      const eye = rt.eyePos(), dy = at.y - eye.y;
      rt.player.pitch = Math.atan2(dy, d) * 180 / Math.PI;
      const c = rt.stage.camera;                         // aim from here without a tick: a tick would fire what the spot touches
      c.position.copy(eye); c.rotation.order = "YXZ"; c.rotation.set(rt.player.pitch * Math.PI / 180, (rt.player.yaw - 90) * Math.PI / 180, 0); c.updateMatrixWorld();
      rt.updateCursor(0);
      if (rt.target === o) return { k, cursor: document.querySelector(".ph-cursor").dataset.cursor };
    }
    throw new Error(`can't get the cursor on ${id} ${JSON.stringify({ tween: !!rt.lookTween, moving: !!rt.moving, busy: rt.busy, hiding: rt.player.hiding, seat: !!rt.player.seat, eye: rt.player.eye, hit: rt.look.id, vis: o.visible })}`);
  }, [id, d]));
  const press = async (key, ms = 120) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  // a left click on what's under the reticle: the mouse parked in the middle of the view with the lock let go for that
  // moment (a locked mouse that moves turns the view; another click elsewhere may have moved it), the lock taken, the click
  const click = async () => {
    const b = await page.locator("#watchBox").boundingBox();
    await page.evaluate(() => { window.__lock = null; });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.evaluate(() => document.querySelector("#watchBox").requestPointerLock());
    await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
  };
  // wait for the game's own clock, not the wall's: on slow frames (a software GPU) a second of real time is less play;
  // done early when play ends (walking into the place that answers a choice)
  const gameWait = async secs => {
    const c0 = await page.evaluate(() => window.__dd.play.clock);
    try { await page.waitForFunction(([c0, s]) => !window.__dd.play.active || window.__dd.play.clock - c0 >= s, [c0, secs], { timeout: 60000 }); }   // or play ended (a walk that chose); 60 s: a software GPU late in the run draws 2 frames a second
    catch (e) { throw new Error(`the play clock stopped (from ${c0.toFixed(2)}): ${await page.evaluate(() => { const rt = window.__dd.play; return JSON.stringify({ active: rt.active, held: rt.held, busy: rt.busy, stopped: rt.stopped, clock: rt.clock, menu: !!document.querySelector(".ph-menu"), panel: !!document.querySelector(".ph-panel,.ph-dock"), trail: (window.__dd.run || {}).trail, inside: [...rt.inside], at: [+rt.player.pos.x.toFixed(2), +(-rt.player.pos.z).toFixed(2)] }); })}`); }
  };
  const hold = async (key, secs) => { await page.keyboard.down(key); try { await gameWait(secs); } finally { await page.keyboard.up(key); } };   // a walk of `secs` of play
  const flag = f => page.evaluate(f => window.__dd.run.flags.has(f), f);
  // stand at a story point facing yaw (where you stand isn't an "enter"), then walk forward for ms
  const walkIn = async (x, y, yaw, ms) => {
    await page.evaluate(([x, y, yaw]) => { const rt = window.__dd.play; rt.place(new (rt.player.pos.constructor)(x, 0, -y), yaw, 0); }, [x, y, yaw]);
    await hold("KeyW", ms / 1000);
  };

  await step("the arrival plays on the porch", () => playing());
  await step("a wall stops you", async () => {
    await page.evaluate(() => { const rt = window.__dd.play; rt.place(new (rt.player.pos.constructor)(2, 0, -1.5), 180, 0); });  // in the hall, facing west
    await hold("KeyW", 2.5);
    const x = await page.evaluate(() => window.__dd.play.player.pos.x);
    if (x < 0.2 || x > 0.6) throw new Error(`walked to x=${x.toFixed(2)}: the hall's west wall is at 0`);
    await page.evaluate(() => { const rt = window.__dd.play; rt.placeAt(rt.level, "start"); });
  });
  await step("the front door: the cursor says open (the mouse's button as its key), a click opens it", async () => {
    const r = await goTo("front_door", 1.0);
    if (r.cursor !== "open") throw new Error("cursor " + r.cursor);
    if (!(await page.$(".ph-prompt .ph-mouse"))) throw new Error("the prompt's key isn't the mouse");
    await click(); await gameWait(0.9);
    if (!(await page.evaluate(() => window.__dd.play.doors.front_door.open))) throw new Error("not open");
  });
  await step("walking in through it ends the arrival (the hall's trigger)", async () => {
    await page.evaluate(() => { const rt = window.__dd.play; rt.place(new (rt.player.pos.constructor)(2, 0, 0.6), 90, 0); });
    await page.keyboard.down("KeyW");                // held until the trigger ends it: slow frames (a software GPU) walk less per second
    try { await playing(false, 10000); } finally { await page.keyboard.up("KeyW"); }
    if (!(await page.evaluate(() => window.__dd.play.doors.front_door.locked))) throw new Error("the slam didn't lock it");
  });
  await step("the message scene blends in from the eye: no black", async () => {
    const most = await page.evaluate(async () => { let m = 0; const t0 = performance.now(); while (performance.now() - t0 < 900) { m = Math.max(m, +document.querySelector("#watchOv .black").style.opacity || 0); await new Promise(r => requestAnimationFrame(r)); } return m; });
    if (most > 0.15) throw new Error(`black went to ${most.toFixed(2)}`);
  });
  await step("the message scene, then the search", () => scenesUntilPlay());
  const mari = () => page.evaluate(() => { const rt = window.__dd.play, f = rt.stage.cast.mari, n = rt.npcs.mari;
    return { vis: f.group.visible, x: f.group.position.x, y: -f.group.position.z, walking: n && n.walking, pose: n && n.pose }; });
  const onRoute = async what => {                      // on the line between her two spots, and moving along it
    const a = await mari(); let b = a;                  // up to 4 s of the game's clock for her to move (a software GPU's slow frames: a wall-clock second is less play)
    const c0 = await page.evaluate(() => window.__dd.play.clock);
    for (let t0 = Date.now(); Date.now() - t0 < 60000 && Math.abs(a.y - b.y) < 0.2 && b.pose !== "look_left" && (await page.evaluate(() => window.__dd.play.clock)) - c0 < 4; ) { await page.waitForTimeout(250); b = await mari(); }
    for (const m of [a, b]) if (!m.vis || Math.abs(m.x - 2) > 0.05 || m.y < 3.55 || m.y > 5.8) throw new Error(`${what}: off her route ${JSON.stringify(m)}`);
    if (Math.abs(a.y - b.y) < 0.2 && !(a.pose === "look_left" || b.pose === "look_left")) throw new Error(`${what}: not walking ${JSON.stringify([a, b])} ${await page.evaluate(() => { const rt = window.__dd.play; return JSON.stringify({ active: rt.active, held: rt.held, busy: rt.busy, clock: rt.clock, menu: !!document.querySelector(".ph-menu"), npc: rt.npcs.mari && Object.keys(rt.npcs.mari) }); })}`);
  };
  const tasks = () => page.evaluate(() => [...document.querySelectorAll(".ph-todo .ph-task")].map(e => ({ id: e.dataset.id, state: e.dataset.state, text: e.textContent })));
  await step("the to-do list: the search puts three tasks on the HUD under the objective, all open, Mari's request with her name", async () => {
    const t = await tasks();
    if (t.length !== 3 || t.some(x => x.state !== "open") || !/letter/.test(t[0].text) || !/kettle.*Mari/.test(t[2].text)) throw new Error(JSON.stringify(t));
  });
  await step("a task failed: one with a time limit counts down and fails by itself, struck in the bad colour; its failed runs and is heard", async () => {
    await page.evaluate(() => { const rt = window.__dd.play; window.__heard = []; rt.todo.add({ todo: "t_test", text: "A test task", secs: 0.6, on: { failed: [{ flag: "t_test_failed" }] } });
      const l = rt.listener; rt.listener = ev => { if (ev.type === "todo") window.__heard.push(ev); if (l) l(ev); }; window.__restore = () => { rt.listener = l; }; });
    await page.waitForFunction(() => (document.querySelector('.ph-task[data-id=t_test]') || {}).dataset?.state === "failed", null, { timeout: 8000 });
    const r = await page.evaluate(() => { const rt = window.__dd.play, e = document.querySelector(".ph-task[data-id=t_test]"); window.__restore();
      const out = { flag: rt.flags.has("t_test_failed"), heard: window.__heard, struck: getComputedStyle(e.querySelector(".ph-task-text")).textDecorationLine, box: e.querySelector(".ph-box").textContent };
      rt.todo.remove("t_test"); rt.flags.delete("t_test_failed"); return out; });
    if (!r.flag || !r.heard.some(e => e.id === "t_test" && e.state === "failed") || !/line-through/.test(r.struck) || r.box !== "✕") throw new Error(JSON.stringify(r));
    if ((await tasks()).length !== 3) throw new Error("the test task is still on the list");
  });
  await step("a hidden task: kept, ticked and heard like the rest, but never on the list", async () => {
    const r = await page.evaluate(() => { const rt = window.__dd.play; window.__heard = []; const l = rt.listener; rt.listener = ev => { if (ev.type === "todo") window.__heard.push(ev); if (l) l(ev); };
      rt.todo.add({ todo: "t_hidden", text: "Tidy up before she comes", hidden: true });
      const shown = !!document.querySelector(".ph-task[data-id=t_hidden]");
      rt.todo.set("t_hidden", "done"); rt.listener = l;
      const out = { shown, kept: (rt.todo.list.find(t => t.id === "t_hidden") || {}).state, heard: window.__heard.map(e => e.id + ":" + e.state) };
      rt.todo.remove("t_hidden"); return out; });
    if (r.shown || r.kept !== "done" || !r.heard.includes("t_hidden:done")) throw new Error(JSON.stringify(r));
    if ((await tasks()).length !== 3) throw new Error("the list changed");
  });
  await step("the player's name: a box asks it, it's typed and kept with the run, and {name} in a thought says it", async () => {
    await page.evaluate(() => window.__dd.play.setFlag("name_now"));
    await page.waitForSelector(".ph-panel .ph-name", { timeout: 60000 });
    const ph = await page.getAttribute(".ph-panel .ph-name", "placeholder");
    await page.keyboard.type("Mika"); await page.keyboard.press("Enter");
    await page.waitForFunction(() => /Mika, keep it together\./.test(window.__dd.play.hud.lineEl.textContent), null, { timeout: 60000 });
    const r = await page.evaluate(() => ({ run: window.__dd.run.name, think: window.__dd.play.hud.lineEl.classList.contains("think"), panel: !!document.querySelector(".ph-panel") }));
    if (r.run !== "Mika" || !r.think || r.panel || !ph) throw new Error(JSON.stringify(Object.assign(r, { ph })));
  });
  await step("a behaviour: Mari walks her route up and down the hall (path, pingpong, a wait in a pose)", () => onRoute("the search"));
  await step("ask: the question in the footer, its answers right under it at the bottom centre, the focus on Mari; 2 answers, its do runs and answered is heard", async () => {
    await page.evaluate(() => { const rt = window.__dd.play; rt.behave("mari", { as: "idle", at: "hall_mari_spot" }); rt.place(new (rt.player.pos.constructor)(2, 0, -2.6), 90, 0); rt.setFlag("ask_now"); });
    await page.waitForSelector(".ph-dock .ph-opt", { timeout: 60000 }); await page.waitForTimeout(300);
    const f = await page.evaluate(() => { const rt = window.__dd.play, w = document.querySelector(".ph-dock .ph-choice"), r = w.getBoundingClientRect(), R = rt.hud.root.getBoundingClientRect(), L = rt.hud.lineEl.getBoundingClientRect();
      return { inFooter: !!w.closest(".ph-footer"), off: Math.round(r.left + r.width / 2 - (R.left + R.width / 2)), below: Math.round(r.top - L.bottom), pad: Math.round(R.bottom - r.bottom),
        focus: rt.hud.root.dataset.focus, line: rt.hud.lineEl.textContent, opts: [...w.querySelectorAll(".ph-opt")].map(o => o.textContent) }; });
    if (!f.inFooter || Math.abs(f.off) > 2 || f.below < 0 || f.pad < 16 || f.focus !== "speaker") throw new Error("not at the bottom centre under the line, the focus on her " + JSON.stringify(f));
    if (!/Mari/.test(f.line) || f.opts.length !== 2) throw new Error("footer or options " + JSON.stringify(f));
    await page.keyboard.press("Digit2");
    await page.waitForFunction(() => window.__dd.run.flags.has("said_go") && window.__dd.run.flags.has("heard_go") && !document.querySelector(".ph-dock"), null, { timeout: 60000 });
    await page.evaluate(() => window.__dd.play.behave("mari", { as: "path", route: "r_hall" }));
  });
  await step("sitting: a click sits (the eye at sitting height), a click stands", async () => {
    const r = await goTo("chair_a", 0.8);
    if (r.cursor !== "sit") throw new Error("cursor " + r.cursor);
    await click(); await gameWait(0.9);
    const e = await page.evaluate(() => [window.__dd.play.player.eye, !!window.__dd.play.player.seat]);
    if (!e[1] || Math.abs(e[0] - 1.15) > 0.05) throw new Error("seated " + e);
    const p = await page.textContent(".ph-prompt"); if (!/Stand up/.test(p)) throw new Error("prompt " + p);
    await click(); await gameWait(0.9);
    const s = await page.evaluate(() => [window.__dd.play.player.eye, !!window.__dd.play.player.seat]);
    if (s[1] || s[0] < 1.6) throw new Error("standing " + s);
  });
  await step("a triggered scene: sitting on the other chair plays one, then walking goes on", async () => {
    await goTo("chair_b", 0.8);
    await click();
    await playing(false, 60000);                   // the scene takes over; 60 s, not 5: it missed once on the software GPU (LESSONS)
    await scenesUntilPlay();
    const st = await page.evaluate(() => { const rt = window.__dd.play; return { seat: !!rt.player.seat, stitch: !!rt.end, y: -rt.player.pos.z }; });
    if (st.seat || !st.stitch) throw new Error(JSON.stringify(st));
    if (Math.abs(st.y - 2.2) > 0.6) throw new Error(`carried on from y=${st.y.toFixed(2)}, the scene's eye is at 2.2`);
    await onRoute("after the scene");
  });
  await step("the die: a click throws it, it settles on the floor, its face is heard (rolled)", async () => {
    const r = await goTo("big_die", 1.1);
    if (r.cursor !== "roll") throw new Error("cursor " + r.cursor);
    await click();
    await page.waitForFunction(() => window.__dd.run.flags.has("rolled_once"), null, { timeout: 60000 });   // a ceiling: physics on a slow software renderer settles late
    const d = await page.evaluate(() => { const m = window.__dd.play.byId.big_die; return { y: m.position.y, log: document.querySelector(".ph-log").textContent }; });
    if (Math.abs(d.y - 0.15) > 0.04) throw new Error(`the die rests at y=${d.y.toFixed(3)}, not on the floor`);
    if (!/rolled [1-6]/.test(d.log)) throw new Error("log " + d.log);
    const faces = await page.evaluate(async () => {     // the face read from known orientations
      const { topFace } = await import("./play/physics.js"), Q = window.__dd.play.player.pos.constructor;
      const q = new (window.__dd.play.byId.big_die.quaternion.constructor)();
      const at = (x, y, z) => { q.setFromAxisAngle(new Q(x, y, z).normalize(), Math.PI / 2); return topFace(q); };
      q.identity(); const up = topFace(q);
      return [up, at(1, 0, 0), at(-1, 0, 0), at(0, 0, 1), at(0, 0, -1)];
    });
    if (faces.join() !== "1,4,3,2,5") throw new Error("faces " + faces);
  });
  await step("a plushie: a click picks it up into the inventory, in the hand (lagging and flopping on a turn, bobbing as you walk); G puts it down on the floor in front of you, no fall, and it's heard where it lies", async () => {
    const r = await goTo("plush", 0.8);
    if (r.cursor !== "take" || !(await page.$(".ph-prompt .ph-mouse"))) throw new Error(`cursor ${r.cursor}, the prompt ${await page.textContent(".ph-prompt")}`);
    await click(); await gameWait(0.3);
    const c = await page.evaluate(() => { const rt = window.__dd.play, h = rt.hand; return { id: rt.carried && rt.carried.id, flag: window.__dd.run.flags.has("has_plush"), world: rt.byId.plush.visible,
      row: [...document.querySelectorAll(".ph-inv-i")].map(e => e.dataset.id + (e.classList.contains("held") ? "*" : "")), hand: h && h.x.m.visible ? h.x.m.position.distanceTo(rt.stage.camera.position) : null }; });
    if (c.id !== "plush" || !c.flag || c.world || c.row.join() !== "plush*" || !(c.hand > 0.3 && c.hand < 1)) throw new Error(`picked up: ${JSON.stringify(c)}`);
    await page.evaluate(() => { const rt = window.__dd.play; rt.place(new (rt.player.pos.constructor)(1.0, 0, -2.6), 0, 0); });   // in the open, facing east
    await gameWait(1.2);
    const turn = await page.evaluate(async () => {           // a brisk look north and back, as a mouse turns: 90 degrees in 0.35 s each way, eased
      const rt = window.__dd.play, x = rt.hand.x, frame = () => new Promise(f => requestAnimationFrame(f)), t0 = rt.clock, e = u => u * u * (3 - 2 * u);
      let lag = 0, bend = 0;
      while (rt.clock - t0 < 1.2) {
        const u = (rt.clock - t0) / 0.35; rt.player.yaw = 90 * (u < 1 ? e(u) : u < 2 ? 1 - e(u - 1) : 0);
        await frame(); if (rt.hand.at) lag = Math.max(lag, x.st.pos.distanceTo(rt.hand.at)); bend = Math.max(bend, x.st.bend.length());
      }
      return { lag, bend };
    });
    if (!(turn.lag > 0.01 && turn.lag < 0.2) || !(turn.bend > 0.01)) throw new Error(`on a turn it should stay in the hand, lagging a little, its top flopping: ${JSON.stringify(turn)}`);
    await gameWait(1.0);
    const bob = page.evaluate(async () => {                   // its squash while walking
      const rt = window.__dd.play, x = rt.hand.x, frame = () => new Promise(f => requestAnimationFrame(f)), t0 = rt.clock;
      let lo = 1, hi = -1; while (rt.clock - t0 < 1.0) { await frame(); if (rt.player.speed > 0.5) { lo = Math.min(lo, x.st.sq); hi = Math.max(hi, x.st.sq); } }
      return hi - lo;
    });
    await hold("KeyW", 1.1);
    const bobbed = await bob;
    if (!(bobbed > 0.004)) throw new Error(`it should bob with the steps: squash range ${bobbed}`);
    const before = await page.evaluate(() => { const p = window.__dd.play.player; return { x: p.pos.x, z: p.pos.z, yaw: p.yaw }; });
    await press("KeyG"); await gameWait(0.2);
    await page.waitForFunction(() => window.__dd.run.flags.has("plush_put"), null, { timeout: 60000 });   // heard: in the hall
    const d = await page.evaluate(() => { const rt = window.__dd.play, m = rt.byId.plush; return { carried: !!rt.carried, vis: m.visible, x: m.position.x, z: m.position.z, y: m.position.y,
      kept: !!rt.kept.house.bodies.plush, kitchen: window.__dd.run.flags.has("plush_kitchen"), row: document.querySelectorAll(".ph-inv-i").length, hand: !!rt.hand }; });
    const a = before.yaw * Math.PI / 180, ahead = (d.x - before.x) * Math.cos(a) - (d.z - before.z) * Math.sin(a);
    if (d.carried || !d.vis || d.kitchen || !d.kept || d.row || d.hand || Math.abs(d.y - 0.175) > 0.01 || !(ahead > 0.3 && ahead < 0.7)) throw new Error(`put down: ${JSON.stringify(d)}, ${ahead.toFixed(2)} m ahead`);
    console.log(`       on a turn ${(turn.lag * 100).toFixed(1)} cm behind the hand, its top ${(turn.bend * 100).toFixed(1)} cm over; a ${(bobbed * 100).toFixed(1)} % bob walking; put down ${ahead.toFixed(2)} m ahead, resting at ${d.y.toFixed(3)} m`);
  });
  await step("the inventory: one row, the newest in the hand in the middle, at most five shown (the farther ones fade), each its picture; the wheel turns it, E hides it and shows it, G puts the one in the hand down and a click takes it back", async () => {
    await page.evaluate(() => { const rt = window.__dd.play; for (let i = 1; i <= 6; i++) rt.take(rt.byId["inv_" + i]); rt.place(new (rt.player.pos.constructor)(1.0, 0, -2.6), 0, 0); });
    await page.waitForTimeout(500);
    const row = () => page.evaluate(async () => {           // measured once the row's slides and fades have run (a software GPU's long frames start them late)
      const inv = document.querySelector(".ph-inv");
      for (const e of [inv, ...inv.querySelectorAll(".ph-inv-i")]) getComputedStyle(e).transform;
      await Promise.all(inv.getAnimations({ subtree: true }).map(a => a.finished.catch(() => null)));
      const R = inv.getBoundingClientRect(), mid = R.left + R.width / 2;
      return { on: inv.classList.contains("on"), opacity: +getComputedStyle(inv).opacity, name: document.querySelector(".ph-inv-name").textContent,
        items: [...document.querySelectorAll(".ph-inv-i")].map(e => { const r = e.getBoundingClientRect(); return { id: e.dataset.id, held: e.classList.contains("held"), far: e.classList.contains("far"),
          off: Math.round(r.left + r.width / 2 - mid), op: +getComputedStyle(e).opacity, png: /^data:image\/png/.test(e.querySelector("img").src) }; }),
        held: window.__dd.play.carried && window.__dd.play.carried.id }; });
    const r1 = await row(), shown = r1.items.filter(x => !x.far), held = r1.items.find(x => x.held);
    if (r1.items.length !== 6 || shown.length !== 5 || !held || held.id !== "inv_6" || r1.held !== "inv_6" || Math.abs(held.off) > 2 || !r1.on || !r1.items.every(x => x.png))
      throw new Error("the row " + JSON.stringify(r1));
    const far = r1.items.find(x => x.far), side = shown.filter(x => !x.held).map(x => x.off).sort((a, b) => a - b);
    if (far.op > 0.01 || side.length !== 4 || !(side[0] < side[1] && side[1] < 0 && side[2] > 0 && side[2] < side[3])) throw new Error("either side " + JSON.stringify(r1.items));
    await page.evaluate(() => document.querySelector("#watchBox").dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true })));
    await page.waitForTimeout(500);
    const r2 = await row(), h2 = r2.items.find(x => x.held);
    if (r2.held !== "inv_1" || !h2 || h2.id !== "inv_1" || Math.abs(h2.off) > 2 || r2.items.find(x => x.id === "inv_6").off >= 0) throw new Error("the wheel " + JSON.stringify(r2));
    await page.evaluate(() => document.querySelector("#watchBox").dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true })));
    await page.waitForTimeout(400);
    if ((await row()).held !== "inv_6") throw new Error("the wheel back");
    await press("KeyE"); await page.waitForTimeout(500);
    const r3 = await row(); if (r3.on || r3.opacity > 0.01) throw new Error("E didn't hide it " + JSON.stringify({ on: r3.on, o: r3.opacity }));
    await press("KeyE"); await page.waitForTimeout(500);
    const r4 = await row(); if (!r4.on || r4.opacity < 0.99) throw new Error("E didn't show it again");
    await press("KeyG"); await gameWait(0.2);
    await page.waitForFunction(() => window.__dd.run.flags.has("inv_put"), null, { timeout: 60000 });
    const r5 = await row(); if (r5.items.length !== 5 || r5.items.some(x => x.id === "inv_6") || r5.held !== "inv_5") throw new Error("put down " + JSON.stringify(r5));
    const t = await goTo("inv_6", 0.7);
    if (t.cursor !== "take") throw new Error("cursor " + t.cursor);
    await click(); await gameWait(0.2);
    const r6 = await row(); if (r6.items.length !== 6 || r6.held !== "inv_6" || !(await page.evaluate(() => window.__dd.play.items.has("inv_item_6")))) throw new Error("taken back " + JSON.stringify(r6));
    await page.evaluate(() => { const rt = window.__dd.play; for (let i = 1; i <= 6; i++) { rt.inv.remove("inv_" + i); rt.items.delete("inv_item_" + i); } });   // out of the way of the rest
  });
  await step("the flashlight: a pickup whose item is a torch goes in the pocket (not the row) and F is on the hint; F lights the way from the hand (the frame brighter, the beam a moment behind a turn) and is heard; the story's torch: dead flickers it out and F only clicks, works brings it back", async () => {
    const r = await goTo("torch1", 0.8);
    if (r.cursor !== "take") throw new Error("cursor " + r.cursor);
    await click(); await gameWait(0.3);
    const a = await page.evaluate(() => { const rt = window.__dd.play; return { has: rt.items.has("flashlight"), row: document.querySelectorAll(".ph-inv-i").length, light: !!rt.torchLight,
      on: rt.torchLight && rt.torchLight.on, hint: !!document.querySelector('.ph-hint .ph-pair[data-k="F"]'), vis: rt.byId.torch1.visible }; });
    if (!a.has || a.row || !a.light || a.on || !a.hint || a.vis) throw new Error("taken: " + JSON.stringify(a));
    await page.evaluate(() => { const rt = window.__dd.play; rt.place(new (rt.player.pos.constructor)(1.0, 0, -2.6), 0, -12); });
    await gameWait(0.4);
    const lum = () => page.evaluate(() => {                 // the frame's middle, as drawn
      const cv = window.__dd.play.stage.renderer.domElement, c = document.createElement("canvas"); c.width = c.height = 48;
      const x = c.getContext("2d"); x.drawImage(cv, cv.width * 0.35, cv.height * 0.35, cv.width * 0.3, cv.height * 0.3, 0, 0, 48, 48);
      const d = x.getImageData(0, 0, 48, 48).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4); });
    const beam = () => page.evaluate(() => { const rt = window.__dd.play, l = rt.torchLight.hot, c = rt.stage.camera, f = new (c.position.constructor)(0, 0, -1).applyQuaternion(c.quaternion);
      return { near: l.position.distanceTo(c.position), dot: l.target.position.clone().sub(l.position).normalize().dot(f), k: l.intensity, on: rt.torchLight.on, dead: rt.torchLight.dead }; });
    const off = await lum();
    await press("KeyF"); await gameWait(0.4);
    const lit = await lum(), b1 = await beam(), heard = await flag("torch_on");
    if (!b1.on || !(b1.k > 0) || !(b1.near < 0.45) || !(b1.dot > 0.99) || !heard) throw new Error(`F: ${JSON.stringify(b1)}, heard ${heard}`);
    if (!(lit > off * 1.25 + 3)) throw new Error(`the beam should light the frame: ${off.toFixed(1)} off, ${lit.toFixed(1)} on`);
    const lag = await page.evaluate(async () => {           // a brisk look left: the beam a moment behind, then on the look again
      const rt = window.__dd.play, l = rt.torchLight.hot, c = rt.stage.camera, frame = () => new Promise(f => requestAnimationFrame(f)), t0 = rt.clock, y0 = rt.player.yaw;
      let low = 1; while (rt.clock - t0 < 0.9) { const u = Math.min(1, (rt.clock - t0) / 0.3); rt.player.yaw = y0 + 70 * u * u * (3 - 2 * u); await frame();
        const f = new (c.position.constructor)(0, 0, -1).applyQuaternion(c.quaternion); low = Math.min(low, l.target.position.clone().sub(l.position).normalize().dot(f)); }
      const f = new (c.position.constructor)(0, 0, -1).applyQuaternion(c.quaternion); return { low, end: l.target.position.clone().sub(l.position).normalize().dot(f) }; });
    if (!(lag.low < 0.995 && lag.end > 0.995)) throw new Error("the beam on a turn: " + JSON.stringify(lag));
    await page.evaluate(() => window.__dd.play.setFlag("kill_torch")); await gameWait(1.8);
    const b2 = await beam(); await press("KeyF"); await gameWait(0.3); const b3 = await beam();
    if (b2.on || b2.k > 0 || !b2.dead || b3.on || b3.k > 0) throw new Error(`dead: ${JSON.stringify(b2)}, then F ${JSON.stringify(b3)}`);
    await page.evaluate(() => window.__dd.play.setFlag("fix_torch")); await gameWait(0.2);
    await press("KeyF"); await gameWait(0.3); const b4 = await beam();
    await press("KeyF"); await gameWait(0.3); const b5 = await beam();
    if (!b4.on || !(b4.k > 0) || b4.dead || b5.on || b5.k > 0) throw new Error(`works: F ${JSON.stringify(b4)}, F ${JSON.stringify(b5)}`);
    console.log(`       the frame's middle ${off.toFixed(0)} dark, ${lit.toFixed(0)} in the beam; on a turn the beam lags to ${(Math.acos(lag.low) * 180 / Math.PI).toFixed(1)}° off the look`);
  });
  await step("Shift runs (forward, standing): about twice the walk", async () => {
    const speed = async keys => { await page.evaluate(() => { const rt = window.__dd.play; rt.place(new (rt.player.pos.constructor)(0.8, 0, -2.6), 0, 0); });
      const x0 = await page.evaluate(() => window.__dd.play.player.pos.x), c0 = await page.evaluate(() => window.__dd.play.clock);
      for (const k of keys) await page.keyboard.down(k);
      try { await gameWait(0.8); } finally { for (const k of keys) await page.keyboard.up(k); }
      return await page.evaluate(([x0, c0]) => (window.__dd.play.player.pos.x - x0) / (window.__dd.play.clock - c0), [x0, c0]); };
    const walk = await speed(["KeyW"]), run = await speed(["ShiftLeft", "KeyW"]);
    if (!(run > walk * 1.6)) throw new Error(`walk ${walk.toFixed(2)} m/s, run ${run.toFixed(2)} m/s`);
  });
  await step("a board game: a click at the table sits you down facing it, its rules play it out (chō-han: the cup shakes and comes down, you call, it lifts on the dice), you stand up and the story hears the result", async () => {
    const r = await goTo("hall_table", 1.0);
    const name = await page.textContent(".ph-prompt .ph-name");
    if (r.cursor !== "use" || name !== "Chō-han") throw new Error(`cursor ${r.cursor}, its name ${name}`);
    await click();
    await page.waitForSelector(".ph-dock .ph-opt", { timeout: 90000 });
    const at = await page.evaluate(() => { const rt = window.__dd.play, t = rt.byId.hall_table; return { playing: rt.playing, eye: rt.player.eye, pitch: rt.player.pitch, opts: [...document.querySelectorAll(".ph-dock .ph-opt")].map(o => o.textContent),
      near: Math.hypot(rt.player.pos.x - t.position.x, rt.player.pos.z - t.position.z), pieces: rt.stage.world.children.filter(o => o.isGroup && o.children.length >= 3).length }; });
    if (at.playing !== "hall_table" || !(at.pitch < -15) || at.near > 1.1 || at.opts.join() !== "Chō (even),Han (odd)") throw new Error(`at the table: ${JSON.stringify(at)}`);
    await page.keyboard.press("Digit1");                 // chō
    await page.waitForFunction(() => window.__dd.run.flags.has("played_dice"), null, { timeout: 90000 });
    const d = await page.evaluate(() => { const rt = window.__dd.play, f = window.__dd.run.flags; return { playing: rt.playing, win: f.has("win_dice"), lose: f.has("lose_dice"), eye: rt.player.eye, log: document.querySelector(".ph-log").textContent }; });
    if (d.playing || d.win === d.lose || !/Chō-han: (win|lose)/.test(d.log) || Math.abs(d.eye - 1.65) > 0.05) throw new Error(`after: ${JSON.stringify(d)}`);
    console.log(`       seated ${at.near.toFixed(2)} m from the table looking ${(-at.pitch).toFixed(0)}° down; called chō: ${d.win ? "win" : "lose"}`);
  });
  await step("the letter: the cursor says read, the note opens", async () => {
    const r = await goTo("letter_hall", 0.7);
    if (r.cursor !== "read") throw new Error("cursor " + r.cursor);
    await click(); await page.waitForSelector(".ph-panel .ph-text");
    const t = await page.textContent(".ph-panel .ph-text"); if (!/door open/.test(t)) throw new Error("note text " + t);
    await page.click(".ph-panel .ph-close");
  });
  await step("reading the letter ticks its task on the list by itself (its ticks: read)", async () => {
    const t = await tasks(); if ((t.find(x => x.id === "read_letter") || {}).state !== "done" || (t.find(x => x.id === "find_key") || {}).state !== "open") throw new Error(JSON.stringify(t));
  });
  await step("the bed: a click lies you down on it (the eye just over it, looking up), the view goes dark, the story's beat plays a chapter: its card, an autosave, then you wake and get up where you stood", async () => {
    const r = await goTo("study_bed", 0.9);
    if (r.cursor !== "sit") throw new Error("cursor " + r.cursor);
    const before = await page.evaluate(() => { const p = window.__dd.play.player; return { x: p.pos.x, z: p.pos.z, eye: p.eye }; });
    await page.evaluate(() => { try { localStorage.removeItem("horrorstudio.saves." + ((window.__dd.S.game || {}).title || "game")); } catch (e) { } });
    await click();
    // 60 s: the lie-down's tween moves at most 0.05 s a frame, and a software GPU late in the run draws 2 frames a second
    await page.waitForFunction(() => window.__dd.play.player.sleeping && window.__dd.play.player.eye < 1 && !window.__dd.play.moving, null, { timeout: 60000 }).catch(async e => {
      throw new Error("not lying down: " + await page.evaluate(() => { const rt = window.__dd.play, p = rt.player; return JSON.stringify({ sleeping: p.sleeping, eye: p.eye, target: rt.target && rt.target.userData.id, moving: !!rt.moving, busy: rt.busy, line: rt.hud.lineEl.textContent, ready: rt.ready(rt.byId.study_bed) }); })); });
    const lying = await page.evaluate(() => ({ eye: window.__dd.play.player.eye, pitch: window.__dd.play.player.pitch }));
    await page.waitForSelector(".ph-chapter.on", { timeout: 60000 });
    const card = await page.evaluate(() => ({ t: document.querySelector(".ph-chapter-t").textContent, s: (document.querySelector(".ph-chapter-s") || {}).textContent,
      black: +document.querySelector("#watchOv .black").style.opacity, save: JSON.parse(localStorage.getItem("horrorstudio.saves." + ((window.__dd.S.game || {}).title || "game")) || "{}").auto }));
    await page.waitForFunction(() => !window.__dd.play.player.sleeping && !document.querySelector(".ph-chapter"), null, { timeout: 60000 });
    const up = await page.evaluate(() => { const p = window.__dd.play.player; return { x: p.pos.x, z: p.pos.z, eye: p.eye, black: +document.querySelector("#watchOv .black").style.opacity }; });
    console.log(`       lying: eye ${lying.eye.toFixed(2)} m, looking ${Math.round(lying.pitch)}° up; the card “${card.t}” · ${card.s} over black ${card.black}; autosave “${card.save && card.save.where}”`);
    if (card.t !== "Later" || card.s !== "02:13" || card.black < 0.99 || !card.save || card.save.where !== "Later") throw new Error(JSON.stringify(card));
    if (lying.eye > 0.9 || lying.pitch < 30) throw new Error("not lying " + JSON.stringify(lying));
    if (up.black > 0.01 || Math.abs(up.eye - 1.65) > 0.05 || Math.hypot(up.x - before.x, up.z - before.z) > 0.05) throw new Error("not up " + JSON.stringify(up) + " " + JSON.stringify(before));
  });
  await step("a chapter changes the time of day behind its card", async () => {
    const r = await page.evaluate(async () => { const rt = window.__dd.play, was = window.__dd.run.time; const p = rt.chapter("Test", { time: "dusk", secs: 0.2, save: false });
      await new Promise(r => setTimeout(r, 1500)); const mid = window.__dd.run.time; await p; const t = window.__dd.run.time; rt.opts.setTime(was); return { was, mid, t }; });
    if (r.t !== "dusk") throw new Error(JSON.stringify(r));
  });
  await step("hiding: a click gets you into the locker (hiding height, its walls slats you see through, no walking), a click gets you out", async () => {
    const r = await goTo("hall_locker", 0.8);
    if (r.cursor !== "hide") throw new Error("cursor " + r.cursor);
    await click();
    await page.waitForFunction(() => { const rt = window.__dd.play; return rt.player.hiding === "hall_locker" && !rt.moving; }, null, { timeout: 60000 });
    const inside = () => page.evaluate(() => { const rt = window.__dd.play, m = rt.byId.hall_locker;
      return { eye: rt.player.eye, x: rt.player.pos.x, y: -rt.player.pos.z, slats: !!m.material.alphaMap, stance: document.querySelector(".ph-stance").textContent,
               label: document.querySelector(".ph-prompt").textContent }; });
    const a = await inside();
    if (Math.abs(a.eye - 1.6) > 0.05 || Math.hypot(a.x - 0.35, a.y - 4.3) > 0.05) throw new Error("not inside " + JSON.stringify(a));
    if (!a.slats || a.stance !== "hidden" || !/Get out/.test(a.label)) throw new Error(JSON.stringify(a));
    await hold("KeyW", 0.4);
    const b = await inside(); if (Math.hypot(b.x - a.x, b.y - a.y) > 1e-3) throw new Error("walked while hidden");
    await click();
    await page.waitForFunction(() => { const rt = window.__dd.play; return !rt.player.hiding && !rt.moving; }, null, { timeout: 60000 });
    const c = await inside(); if (c.slats || Math.hypot(c.x - 0.35, c.y - 4.3) < 0.5) throw new Error("not out " + JSON.stringify(c));
  });
  await step("being seen: in her cone the meter fills and caught fires; hidden or in a safe zone she doesn't see you", async () => {
    const rt = () => window.__dd.play;
    await page.evaluate(() => window.__dd.play.behave("mari", { as: "idle", at: "hall_mari_spot", sees: { calm: 0.3 } }));   // at the hall's end, facing the front door
    const stand = (x, y) => page.evaluate(([x, y]) => { const rt = window.__dd.play; rt.place(new (rt.player.pos.constructor)(x, 0, -y), 90, 0); }, [x, y]);
    await stand(2, 2.6);
    await page.waitForFunction(() => { const c = window.__dd.play.lastCaught; return c && c.by === "mari"; }, null, { timeout: 60000 });
    const quiet = async (what, ms = 2000) => {
      const c0 = await page.evaluate(() => window.__dd.play.lastCaught.clock);
      await gameWait(ms / 1000);
      const st = await page.evaluate(() => ({ c: window.__dd.play.lastCaught.clock, k: window.__dd.play.suspicion }));
      if (st.c !== c0 || st.k > 0.05) throw new Error(`${what}: seen ${JSON.stringify(st)}`);
    };
    await stand(3.3, 3.5); await quiet("in the safe zone");
    await goTo("hall_locker", 0.8); await click();
    await page.waitForFunction(() => window.__dd.play.player.hiding === "hall_locker", null, { timeout: 60000 });
    await quiet("in the locker");
    await click(); await page.waitForFunction(() => !window.__dd.play.player.hiding && !window.__dd.play.moving, null, { timeout: 60000 });
    await page.evaluate(() => window.__dd.play.behave("mari", { as: "path", route: "r_hall" }));            // back to her walk, not looking
  });
  await step("crouch (toggle) lowers the eye", async () => {
    await press("KeyC"); await gameWait(0.7);
    const e = await page.evaluate(() => window.__dd.play.player.eye); if (e > 1.2) throw new Error("eye " + e);
    await press("KeyC"); await gameWait(0.7);
  });
  await step("the kitchen's glimpse fires on entering", async () => {
    await page.evaluate(() => { const h = window.__dd.play.hud, line = h.line.bind(h); window.__lines = []; h.line = (t, w, secs) => { window.__lines.push(t); return line(t, w, secs); }; });
    await walkIn(2, 5.4, 90, 1300); await gameWait(0.5);          // every line Play showed on the way in (a short one may be gone already)
    const lines = await page.evaluate(() => window.__lines); if (!lines.some(t => /Mari\?/.test(t))) throw new Error("lines " + JSON.stringify(lines));
  });
  await step("a little thing: the kettle says Switch on, a click switches it on, it boils by itself (steam from its spout) and the story hears it (state)", async () => {
    await goTo("pilot_kettle", 0.8);
    const label = await page.evaluate(() => document.querySelector(".ph-label").textContent);
    if (label !== "Switch on") throw new Error("the prompt says " + JSON.stringify(label));
    await click(); await gameWait(0.3);
    const st = await page.evaluate(() => window.__dd.play.stateOf("pilot_kettle"));
    if (st !== "heating") throw new Error("after a click it's " + st);
    await gameWait(0.9);
    const steam = await page.evaluate(() => { const it = window.__dd.play.stage.life.items.find(i => i.id === "pilot_kettle"), p = it && it.parts["steam@spout0"];
      return p ? [...p.pts.geometry.attributes.alpha.array].filter(a => a > 0.01).length : -1; });
    if (!(steam > 3)) throw new Error("no steam from the spout while it boils: " + steam);
    await gameWait(1.2);
    if (!(await flag("tea_ready"))) throw new Error("boiled not heard: it's " + await page.evaluate(() => window.__dd.play.stateOf("pilot_kettle")));
  });
  await step("a request: Mari's kettle task ticks as it boils, and she walks off to the kitchen (by the hall's end) and sits at the table; the story hears she's arrived", async () => {
    const t = await tasks(); if ((t.find(x => x.id === "make_tea") || {}).state !== "done") throw new Error(JSON.stringify(t));
    const going = await page.evaluate(() => { const n = window.__dd.play.npcs.mari; return n && n.as === "go" && !n.st.arrived; });
    if (!going) throw new Error("she isn't on her way: " + await page.evaluate(() => JSON.stringify(window.__dd.play.npcs.mari && { as: window.__dd.play.npcs.mari.as, st: Object.keys(window.__dd.play.npcs.mari.st) })));
    for (let i = 0; i < 40 && !(await page.evaluate(() => window.__dd.play.ended.b_tea_sat !== undefined)); i++) await gameWait(0.5);
    const r = await page.evaluate(() => { const rt = window.__dd.play, n = rt.npcs.mari, sp = rt.plan.things.kitchen_chair_spot;
      return { arrived: n.st.arrived, pose: n.pose, walking: n.walking, d: Math.hypot(n.pos.x - sp.pos[0], -n.pos.z - sp.pos[1]), yaw: n.yaw, heard: rt.ended.b_tea_sat !== undefined }; });
    console.log(`       she sat ${r.d.toFixed(2)} m from the chair's spot, facing ${Math.round(r.yaw)}°, pose ${r.pose}`);
    if (r.arrived !== "kitchen_chair_spot" || r.pose !== "sit" || r.walking || r.d > 0.06 || !r.heard) throw new Error(JSON.stringify(r));
  });
  await step("the little things' sounds: each one made in the browser, rendered offline, is a sound and doesn't clip", async () => {
    const bad = await page.evaluate(async () => {
      const S = await import("./lifesound.js"), out = [];
      for (const name of S.SOUNDS) {
        const ctx = new OfflineAudioContext(1, 22050 * 2, 22050), g = ctx.createGain(); g.connect(ctx.destination);
        if (S.LOOP[name]) { const v = S.LOOP[name](ctx, g); v.set(1, 3, 0.5, { every: 0.5 }); if (v.tick) for (let t = 0; t < 2; t += 0.1) v.tick(t, t + 1.06); } else S.ONCE[name](ctx, g, 0.05);
        const d = (await ctx.startRendering()).getChannelData(0); let pk = 0; for (const x of d) pk = Math.max(pk, Math.abs(x));
        if (!(pk > 0.02 && pk < 0.98)) out.push(`${name} ${pk.toFixed(3)}`);
      }
      return out;
    });
    if (bad.length) throw new Error("silent or clipping: " + bad.join(", "));
  });
  await step("the sound shelf: every story sound off the shelf is served and decodes, and the sound command plays it where it's placed", async () => {
    const r = await page.evaluate(async () => {
      const X = await import("./sfx.js"), all = await X.shelf(), S = window.__dd.S, out = { n: Object.keys(all).length, bad: [] };
      for (const [id, s] of Object.entries(S.sounds || {})) {
        const n = X.shelfName(s.file); if (!n) continue;
        if (!all[n]) { out.bad.push(id + ": not on the shelf"); continue; }
        const bytes = await (await fetch("/sfx/" + all[n].file)).arrayBuffer(), buf = await new OfflineAudioContext(1, 8, 44100).decodeAudioData(bytes);
        let pk = 0; for (const x of buf.getChannelData(0)) pk = Math.max(pk, Math.abs(x));
        if (!(buf.duration > 0.05 && pk > 0.05)) out.bad.push(`${id}: ${n} ${buf.duration.toFixed(2)} s peak ${pk.toFixed(3)}`);
      }
      const rt = window.__dd.play, sid = Object.keys(S.sounds || {})[0], at = Object.keys(rt.byId)[0];
      const p = await X.playShelf(X.shelfName(S.sounds[sid].file), { pos: rt.byId[at].getWorldPosition(rt.byId[at].position.clone()), camera: rt.stage.camera });
      out.played = p && p.secs; if (p) p.stop();
      return out;
    });
    if (r.n < 100 || r.bad.length || !(r.played > 0)) throw new Error(JSON.stringify(r));
  });
  await step("the drawer's code on the keypad sets drawer_open and shows the key", async () => {
    await goTo("desk_lock", 0.8);
    await click(); await page.waitForSelector(".ph-pad");
    for (const k of "0314") await page.click(`.ph-pad button:text-is("${k}")`);
    await page.click('.ph-pad button:text-is("OK")');
    await page.waitForTimeout(500);
    if (!(await flag("drawer_open"))) throw new Error("no flag");
    if (!(await page.evaluate(() => window.__dd.play.byId.cellar_key_pickup.visible))) throw new Error("the key isn't shown");
  });
  await step("the bed after the drawer's open: its if (!drawer_open) no longer holds, it says Not now and nothing happens", async () => {
    const r = await goTo("study_bed", 0.9);
    if (r.cursor !== "locked") throw new Error("cursor " + r.cursor);
    await click(); await page.waitForTimeout(400);
    const s = await page.evaluate(() => { const rt = window.__dd.play; return { sleeping: !!rt.player.sleeping, line: rt.hud.lineEl.textContent }; });
    if (s.sleeping || !/Not now/.test(s.line)) throw new Error(JSON.stringify(s));
  });
  await step("the cellar door is locked without the key", async () => {
    await goTo("cellar_door", 1.0);
    const c = await page.evaluate(() => document.querySelector(".ph-cursor").dataset.cursor);
    if (c !== "locked") throw new Error("cursor " + c);
  });
  await step("the key: taken, the stitch ends after the knocking", async () => {
    const r = await goTo("cellar_key_pickup", 0.7);
    if (r.cursor !== "take") throw new Error("cursor " + r.cursor);
    await click();
    await page.waitForFunction(() => (document.querySelector(".ph-task[data-id=find_key]") || {}).dataset?.state === "done", null, { timeout: 5000 });
    if (await page.evaluate(() => !(window.__dd.play.carried && window.__dd.play.carried.id === "cellar_key_pickup"))) throw new Error("the key isn't in the hand");
    await page.waitForFunction(() => !window.__dd.play.end, null, { timeout: 60000 });
    if ((await tasks()).length) throw new Error("the list isn't cleared at the end of the search (untodo)");
  });
  await step("the choice by act: the key opens the cellar door, walking in chooses it", async () => {
    await playing();
    await goTo("cellar_door", 1.0);
    await click(); await gameWait(0.9);
    if (!(await page.evaluate(() => window.__dd.play.doors.cellar_door.open))) throw new Error("not open");
    await walkIn(0.7, 2, 180, 1400);
    await playing(false, 10000);
  });
  await step("the cellar, the grab (answered: let go of me), then the run", () => scenesUntilPlay());
  await step("the run out has its timer", async () => {
    const t = await page.textContent(".ph-timer"); if (!(+t > 0)) throw new Error("timer " + t);
  });
  await step("out onto the porch: the good ending", async () => {
    await walkIn(2, -3.6, 90, 1200);             // the Pilot never unlocks the front door after the slam: in from the garden
    await page.waitForFunction(() => window.__watchEnd, null, { timeout: 60000 });
    const end = await page.evaluate(() => window.__watchEnd);
    if (end !== "Out of the house") throw new Error("ending " + end);
  });
  await step("a second playtest starts from the story's level, not the last one's: the cellar door the first run unlocked and opened is shut and locked, in its frame", async () => {
    await page.click("#wStart"); await scenesUntilPlay();
    const d = await page.evaluate(() => { const rt = window.__dd.play, d = rt.doors.cellar_door, b = d.mesh.userData.base; return { level: rt.level, open: d.open, locked: d.locked, turned: b ? Math.abs(d.mesh.rotation.y - b.rot) + d.mesh.position.distanceTo(b.pos) : 0 }; });
    if (d.open || !d.locked || d.turned > 1e-3) throw new Error(`the cellar door: ${JSON.stringify(d)}`);
  });
  await step("Esc toggles the pause menu, with the pointer locked as in a browser (faked: a lock asked for straight after an Esc is lost again to that Esc); the controls on its left, each key drawn", async () => {
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const box = document.querySelector("#watchBox"), fire = () => document.dispatchEvent(new Event("pointerlockchange"));
      window.__lock = null; window.__asks = 0; Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => window.__lock });
      document.exitPointerLock = () => { if (window.__lock) { window.__lock = null; fire(); } };
      box.requestPointerLock = () => { window.__asks++; window.__lock = box; fire(); if (window.__escHeld) setTimeout(() => { window.__lock = null; fire(); }, 30); return Promise.resolve(); };
      box.requestPointerLock(); window.__asks = 0;
      window.__dd.play.give("flashlight");             // (a new run: the flashlight's row shows once it's had)
    });
    const menus = () => page.evaluate(() => document.querySelectorAll(".ph-menu:not(.out)").length);
    await page.evaluate(() => document.exitPointerLock()); await page.waitForTimeout(500);   // Esc in play: the browser lets the pointer go
    const open1 = await menus();
    const ctl = await page.evaluate(() => { const c = document.querySelector(".ph-menu .ph-controls"), n = document.querySelector(".ph-menu .ph-nav"); if (!c || !n) return null;
      const a = c.getBoundingClientRect(), b = n.getBoundingClientRect();
      return { rows: [...c.querySelectorAll(".ph-ctl-label")].map(r => r.textContent), icons: c.querySelectorAll(".ph-ctl svg").length, left: a.right <= b.left + 1 && a.width > 0 }; });
    if (!ctl || ctl.rows.join() !== "Movement,Interact,Inventory,Switch item,Drop,Run,Crouch,Flashlight" || ctl.icons !== 8 || !ctl.left) throw new Error("the controls on the pause menu's left (the flashlight's once you have it): " + JSON.stringify(ctl));
    await page.evaluate(() => { window.__escHeld = true; }); await page.keyboard.press("Escape"); await page.waitForTimeout(600); await page.evaluate(() => { window.__escHeld = false; });
    const shut = await menus(), asks = await page.evaluate(() => window.__asks);
    await page.keyboard.press("Escape"); await page.waitForTimeout(500); const open2 = await menus();
    await page.keyboard.press("Escape"); await page.waitForTimeout(500); const shut2 = await menus();
    if (open1 !== 1 || shut !== 0 || asks !== 0 || open2 !== 1 || shut2 !== 0) throw new Error(`the menu by Esc: open ${open1}, Esc ${shut} (lock asked ${asks}), Esc ${open2}, Esc ${shut2}`);
  });
  if (shot) await page.screenshot({ path: shot });
  if (errors.length) fail("page errors: " + errors.join(" | "));
  await browser.close();
  console.log("PLAY ok");
})().catch(e => fail(e.stack || e.message));

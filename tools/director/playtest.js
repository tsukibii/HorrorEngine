// Play mode in a headless browser (docs/GAMEPLAY_PLAN.md §8 step 1): the Pilot walked from the start to the good
// ending with the keys and the cursor, as a player would: a wall stops you, the front door opens with E, the hall's
// trigger ends the arrival, Mari walks her route in the hall, a question (ask) is answered beside her, a die is rolled and
// its face heard, a plushie is picked up and put down by holding E (lagging, flopping and bobbing in the hands, squashing
// as it lands, heard where it lies), a game of chō-han is played at the hall table, the letter reads, the kitchen's kettle is switched on and boils by itself, E hides in the locker and gets out, her eyes catch
// you in the open but not hidden or in a safe zone, the kitchen's glimpse fires, the drawer's code is typed on the panel,
// the key shows and is taken, the locked cellar door opens with it, the struggle is mashed free (E), and the timed run
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
    await window.__dd.replan();
  });
  await page.click('nav button[data-v="watchView"]');
  await page.check("#wPlay"); await page.check("#wSkip");
  await page.click("#wStart");

  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { await page.screenshot({ path: shot || "playtest_fail.png" }); fail(`${what}: ${e.message}${errors.length ? "\n  page errors: " + errors.join(" | ") : ""}`); } };
  const playing = (on = true, ms = 60000) => page.waitForFunction(on => { const p = window.__dd.play; return on ? p && p.active : !(p && p.active); }, on, { timeout: ms });
  const scenesUntilPlay = async (ms = 90000) => {          // skip scenes (dev skip), mash free of any struggle
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (await page.evaluate(() => !!(window.__dd.play && window.__dd.play.active))) return;
      if (await page.$(".qte")) {
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
  // wait for the game's own clock, not the wall's: on slow frames (a software GPU) a second of real time is less play;
  // done early when play ends (walking into the place that answers a choice)
  const gameWait = async secs => {
    const c0 = await page.evaluate(() => window.__dd.play.clock);
    try { await page.waitForFunction(([c0, s]) => !window.__dd.play.active || window.__dd.play.clock - c0 >= s, [c0, secs], { timeout: 60000 }); }   // or play ended (a walk that chose); 60 s: a software GPU late in the run draws 2 frames a second
    catch (e) { throw new Error(`the play clock stopped (from ${c0.toFixed(2)}): ${await page.evaluate(() => { const rt = window.__dd.play; return JSON.stringify({ active: rt.active, held: rt.held, busy: rt.busy, stopped: rt.stopped, clock: rt.clock, menu: !!document.querySelector(".ph-menu"), panel: !!document.querySelector(".ph-panel,.ph-float"), trail: (window.__dd.run || {}).trail, inside: [...rt.inside], at: [+rt.player.pos.x.toFixed(2), +(-rt.player.pos.z).toFixed(2)] }); })}`); }
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
  await step("the front door: the cursor says open, E opens it", async () => {
    const r = await goTo("front_door", 1.0);
    if (r.cursor !== "open") throw new Error("cursor " + r.cursor);
    await press("KeyE"); await gameWait(0.9);
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
    const a = await mari(); let b = a;                  // up to 4 s for her to move: slow frames (a software GPU) walk less per second
    for (let t0 = Date.now(); Date.now() - t0 < 4000 && Math.abs(a.y - b.y) < 0.2 && b.pose !== "look_left"; ) { await page.waitForTimeout(250); b = await mari(); }
    for (const m of [a, b]) if (!m.vis || Math.abs(m.x - 2) > 0.05 || m.y < 3.55 || m.y > 5.8) throw new Error(`${what}: off her route ${JSON.stringify(m)}`);
    if (Math.abs(a.y - b.y) < 0.2 && !(a.pose === "look_left" || b.pose === "look_left")) throw new Error(`${what}: not walking ${JSON.stringify([a, b])} ${await page.evaluate(() => { const rt = window.__dd.play; return JSON.stringify({ active: rt.active, held: rt.held, busy: rt.busy, clock: rt.clock, menu: !!document.querySelector(".ph-menu"), npc: rt.npcs.mari && Object.keys(rt.npcs.mari) }); })}`);
  };
  await step("a behaviour: Mari walks her route up and down the hall (path, pingpong, a wait in a pose)", () => onRoute("the search"));
  await step("ask: the answers float beside Mari, the question in the footer; 2 answers, its do runs and answered is heard", async () => {
    await page.evaluate(() => { const rt = window.__dd.play; rt.behave("mari", { as: "idle", at: "hall_mari_spot" }); rt.place(new (rt.player.pos.constructor)(2, 0, -2.6), 90, 0); rt.setFlag("ask_now"); });
    await page.waitForSelector(".ph-float .ph-opt", { timeout: 60000 }); await page.waitForTimeout(300);
    const f = await page.evaluate(() => { const rt = window.__dd.play, w = document.querySelector(".ph-float");
      return { centre: w.classList.contains("centre"), focus: rt.hud.root.dataset.focus, line: rt.hud.lineEl.textContent, opts: [...w.querySelectorAll(".ph-opt")].map(o => o.textContent) }; });
    if (f.centre || f.focus !== "speaker") throw new Error("not beside her " + JSON.stringify(f));
    if (!/Mari/.test(f.line) || f.opts.length !== 2) throw new Error("footer or options " + JSON.stringify(f));
    await page.keyboard.press("Digit2");
    await page.waitForFunction(() => window.__dd.run.flags.has("said_go") && window.__dd.run.flags.has("heard_go") && !document.querySelector(".ph-float"), null, { timeout: 60000 });
    await page.evaluate(() => window.__dd.play.behave("mari", { as: "path", route: "r_hall" }));
  });
  await step("sitting: E sits (the eye at sitting height), E stands", async () => {
    const r = await goTo("chair_a", 0.8);
    if (r.cursor !== "sit") throw new Error("cursor " + r.cursor);
    await press("KeyE"); await gameWait(0.9);
    const e = await page.evaluate(() => [window.__dd.play.player.eye, !!window.__dd.play.player.seat]);
    if (!e[1] || Math.abs(e[0] - 1.15) > 0.05) throw new Error("seated " + e);
    const p = await page.textContent(".ph-prompt"); if (!/Stand up/.test(p)) throw new Error("prompt " + p);
    await press("KeyE"); await gameWait(0.9);
    const s = await page.evaluate(() => [window.__dd.play.player.eye, !!window.__dd.play.player.seat]);
    if (s[1] || s[0] < 1.6) throw new Error("standing " + s);
  });
  await step("a triggered scene: sitting on the other chair plays one, then walking goes on", async () => {
    await goTo("chair_b", 0.8);
    await press("KeyE");
    await playing(false, 60000);                   // the scene takes over; 60 s, not 5: it missed once on the software GPU (LESSONS)
    await scenesUntilPlay();
    const st = await page.evaluate(() => { const rt = window.__dd.play; return { seat: !!rt.player.seat, stitch: !!rt.end, y: -rt.player.pos.z }; });
    if (st.seat || !st.stitch) throw new Error(JSON.stringify(st));
    if (Math.abs(st.y - 2.2) > 0.6) throw new Error(`carried on from y=${st.y.toFixed(2)}, the scene's eye is at 2.2`);
    await onRoute("after the scene");
  });
  await step("the die: E throws it, it settles on the floor, its face is heard (rolled)", async () => {
    const r = await goTo("big_die", 1.1);
    if (r.cursor !== "roll") throw new Error("cursor " + r.cursor);
    await press("KeyE");
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
  await step("a plushie: held E picks it up (a tap doesn't); in the hands it lags and flops on a turn and bobs as you walk; held E puts it down, it falls, squashes, settles on the floor and is heard where it lies", async () => {
    const r = await goTo("plush", 0.8);
    const key = await page.textContent(".ph-prompt .ph-key");
    if (r.cursor !== "take" || key !== "Hold E") throw new Error(`cursor ${r.cursor}, the key says ${key}`);
    await press("KeyE"); await gameWait(0.3);
    if (await page.evaluate(() => !!window.__dd.play.carried)) throw new Error("a tap picked it up");
    await hold("KeyE", 0.65); await gameWait(0.2);
    const c = await page.evaluate(() => { const rt = window.__dd.play; return { id: rt.carried && rt.carried.id, flag: window.__dd.run.flags.has("has_plush"), prompt: document.querySelector(".ph-prompt").textContent }; });
    if (c.id !== "plush" || !c.flag || !/Hold E.*Put down/.test(c.prompt)) throw new Error(`picked up: ${JSON.stringify(c)}`);
    await page.evaluate(() => { const rt = window.__dd.play; rt.place(new (rt.player.pos.constructor)(1.0, 0, -2.6), 0, 0); });   // in the open, facing east
    await gameWait(1.2);
    const turn = await page.evaluate(async () => {           // a brisk look north and back, as a mouse turns: 90 degrees in 0.35 s each way, eased
      const rt = window.__dd.play, x = rt.physics.moverOf(rt.carried.m), frame = () => new Promise(f => requestAnimationFrame(f)), t0 = rt.clock, e = u => u * u * (3 - 2 * u);
      let lag = 0, bend = 0;
      while (rt.clock - t0 < 1.2) {
        const u = (rt.clock - t0) / 0.35; rt.player.yaw = 90 * (u < 1 ? e(u) : u < 2 ? 1 - e(u - 1) : 0);
        await frame(); if (rt.carried.at) lag = Math.max(lag, x.st.pos.distanceTo(rt.carried.at)); bend = Math.max(bend, x.st.bend.length());
      }
      return { lag, bend };
    });
    if (!(turn.lag > 0.01 && turn.lag < 0.2) || !(turn.bend > 0.01)) throw new Error(`on a turn it should stay in the hands, lagging a little, its top flopping: ${JSON.stringify(turn)}`);
    await gameWait(1.0);
    const bob = page.evaluate(async () => {                   // its squash while walking
      const rt = window.__dd.play, x = rt.physics.moverOf(rt.carried.m), frame = () => new Promise(f => requestAnimationFrame(f)), t0 = rt.clock;
      let lo = 1, hi = -1; while (rt.clock - t0 < 1.0) { await frame(); if (rt.player.speed > 0.5) { lo = Math.min(lo, x.st.sq); hi = Math.max(hi, x.st.sq); } }
      return hi - lo;
    });
    await hold("KeyW", 1.1);
    const bobbed = await bob;
    if (!(bobbed > 0.004)) throw new Error(`it should bob with the steps: squash range ${bobbed}`);
    const fall = page.evaluate(async () => {                  // put down: how far it squashes as it lands
      const rt = window.__dd.play, m = rt.byId.plush, x = rt.physics.moverOf(m), frame = () => new Promise(f => requestAnimationFrame(f)), t0 = rt.clock;
      let lo = 0; while (rt.clock - t0 < 2.5 && !window.__dd.run.flags.has("plush_put")) { await frame(); if (!rt.carried) lo = Math.min(lo, x.st.sq); }
      return lo;
    });
    await hold("KeyE", 0.65);
    await page.waitForFunction(() => window.__dd.run.flags.has("plush_put"), null, { timeout: 60000 });   // settled in the hall
    const squash = await fall;
    const d = await page.evaluate(() => { const rt = window.__dd.play, m = rt.byId.plush; return { carried: !!rt.carried, y: m.position.y, kept: !!rt.kept.house.bodies.plush, kitchen: window.__dd.run.flags.has("plush_kitchen") }; });
    if (d.carried || d.kitchen || !d.kept || d.y < 0.11 || d.y > 0.2) throw new Error(`put down: ${JSON.stringify(d)}`);
    if (!(squash < -0.015)) throw new Error(`it should squash as it lands: ${squash}`);
    console.log(`       on a turn ${(turn.lag * 100).toFixed(1)} cm behind the hands, its top ${(turn.bend * 100).toFixed(1)} cm over; a ${(bobbed * 100).toFixed(1)} % bob walking; ${(-squash * 100).toFixed(1)} % squashed landing; rests at ${d.y.toFixed(3)} m`);
  });
  await step("a board game: E at the table sits you down facing it, its rules play it out (chō-han: the cup shakes and comes down, you call, it lifts on the dice), you stand up and the story hears the result", async () => {
    const r = await goTo("hall_table", 1.0);
    const name = await page.textContent(".ph-prompt .ph-name");
    if (r.cursor !== "use" || name !== "Chō-han") throw new Error(`cursor ${r.cursor}, its name ${name}`);
    await press("KeyE");
    await page.waitForSelector(".ph-float .ph-opt", { timeout: 90000 });
    const at = await page.evaluate(() => { const rt = window.__dd.play, t = rt.byId.hall_table; return { playing: rt.playing, eye: rt.player.eye, pitch: rt.player.pitch, opts: [...document.querySelectorAll(".ph-float .ph-opt")].map(o => o.textContent),
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
    await press("KeyE"); await page.waitForSelector(".ph-panel .ph-text");
    const t = await page.textContent(".ph-panel .ph-text"); if (!/door open/.test(t)) throw new Error("note text " + t);
    await page.click(".ph-panel .ph-close");
  });
  await step("hiding: E gets into the locker (hiding height, its walls slats you see through, no walking), E gets out", async () => {
    const r = await goTo("hall_locker", 0.8);
    if (r.cursor !== "hide") throw new Error("cursor " + r.cursor);
    await press("KeyE");
    await page.waitForFunction(() => { const rt = window.__dd.play; return rt.player.hiding === "hall_locker" && !rt.moving; }, null, { timeout: 60000 });
    const inside = () => page.evaluate(() => { const rt = window.__dd.play, m = rt.byId.hall_locker;
      return { eye: rt.player.eye, x: rt.player.pos.x, y: -rt.player.pos.z, slats: !!m.material.alphaMap, stance: document.querySelector(".ph-stance").textContent,
               label: document.querySelector(".ph-prompt").textContent }; });
    const a = await inside();
    if (Math.abs(a.eye - 1.6) > 0.05 || Math.hypot(a.x - 0.35, a.y - 4.3) > 0.05) throw new Error("not inside " + JSON.stringify(a));
    if (!a.slats || a.stance !== "hidden" || !/Get out/.test(a.label)) throw new Error(JSON.stringify(a));
    await hold("KeyW", 0.4);
    const b = await inside(); if (Math.hypot(b.x - a.x, b.y - a.y) > 1e-3) throw new Error("walked while hidden");
    await press("KeyE");
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
    await goTo("hall_locker", 0.8); await press("KeyE");
    await page.waitForFunction(() => window.__dd.play.player.hiding === "hall_locker", null, { timeout: 60000 });
    await quiet("in the locker");
    await press("KeyE"); await page.waitForFunction(() => !window.__dd.play.player.hiding && !window.__dd.play.moving, null, { timeout: 60000 });
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
  await step("a little thing: the kettle says Switch on, E switches it on, it boils by itself (steam from its spout) and the story hears it (state)", async () => {
    await goTo("pilot_kettle", 0.8);
    const label = await page.evaluate(() => document.querySelector(".ph-label").textContent);
    if (label !== "Switch on") throw new Error("the prompt says " + JSON.stringify(label));
    await press("KeyE"); await gameWait(0.3);
    const st = await page.evaluate(() => window.__dd.play.stateOf("pilot_kettle"));
    if (st !== "heating") throw new Error("after E it's " + st);
    await gameWait(0.9);
    const steam = await page.evaluate(() => { const it = window.__dd.play.stage.life.items.find(i => i.id === "pilot_kettle"), p = it && it.parts["steam@spout0"];
      return p ? [...p.pts.geometry.attributes.alpha.array].filter(a => a > 0.01).length : -1; });
    if (!(steam > 3)) throw new Error("no steam from the spout while it boils: " + steam);
    await gameWait(1.2);
    if (!(await flag("tea_ready"))) throw new Error("boiled not heard: it's " + await page.evaluate(() => window.__dd.play.stateOf("pilot_kettle")));
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
    await page.waitForFunction(() => !window.__dd.play.end, null, { timeout: 60000 });
  });
  await step("the choice by act: the key opens the cellar door, walking in chooses it", async () => {
    await playing();
    await goTo("cellar_door", 1.0);
    await press("KeyE"); await gameWait(0.9);
    if (!(await page.evaluate(() => window.__dd.play.doors.cellar_door.open))) throw new Error("not open");
    await walkIn(0.7, 2, 180, 1400);
    await playing(false, 10000);
  });
  await step("the cellar, the grab (mashed free), then the run", () => scenesUntilPlay());
  await step("the run out has its timer", async () => {
    const t = await page.textContent(".ph-timer"); if (!(+t > 0)) throw new Error("timer " + t);
  });
  await step("out onto the porch: the good ending", async () => {
    await walkIn(2, -3.6, 90, 1200);             // the Pilot never unlocks the front door after the slam: in from the garden
    await page.waitForFunction(() => window.__watchEnd, null, { timeout: 60000 });
    const end = await page.evaluate(() => window.__watchEnd);
    if (end !== "Out of the house") throw new Error("ending " + end);
  });
  if (shot) await page.screenshot({ path: shot });
  if (errors.length) fail("page errors: " + errors.join(" | "));
  await browser.close();
  console.log("PLAY ok");
})().catch(e => fail(e.stack || e.message));

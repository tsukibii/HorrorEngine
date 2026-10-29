// TESTROOM: TestRoom001 (docs/games/TestRoom001.md) played from its start to its good ending in the desk's Play mode,
// station by station, as a player would: each station's to-do list is its checklist, every task done by the thing it
// names (a click, a walk, a key) and seen ticked, and what the station shows measured on the way (the door open, the
// lights out, the kettle boiled, the figure gone again). Then the branches it can't take on the way: a death and its
// retry (hide and seek), and the doll's trigger cutscene. The same checklist is what an Unreal build of the room is
// held to (docs/UNREAL_NEXT.md). Played in the simple view (the software GPU draws only what the eye can see).
//   python tools/director/serve.py          (in another shell)
//   node tools/director/testroom.mjs [--from n_station] [shot.png]
// Ends "TESTROOM ok".
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
const args = process.argv.slice(2), at = args.indexOf("--from"), FROM = at >= 0 ? args.splice(at, 2)[1] : null, shot = args[0];
const DESK = (process.env.DESK_URL || "http://127.0.0.1:8780/") + "?game=TestRoom001";
const OPTIONAL = /\/api\/(takes|motion)\//;            // no takes or motion files for a test room: not Play's
const fail = m => { console.error("TESTROOM FAIL: " + m); process.exit(1); };
const REF = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../Saved/Story/TestRoom001/reference");   // the desk's reference for Unreal

// the stations in the flow's order, and what each leaves the player with (a start --from a later one is given it)
const ORDER = ["n_arrive", "n_hello", "n_front", "n_doors", "n_power", "n_store", "n_kitchen", "n_chores", "n_rest", "n_games",
  "n_dark", "n_library", "n_bath", "n_talk", "n_hide", "n_run", "n_sneak", "n_sleep", "n_night", "n_annex", "n_final"];
const LEAVES = { n_hello: { karma: 1, flags: ["met_aoi"], states: { kitchen_tv: "static" } }, n_doors: { items: ["key_brass", "fuse"], flags: ["vault_open"] }, n_power: { flags: ["power_cut"] }, n_kitchen: { flags: ["phone_rang"], states: { kitchen_tv: "off" } },
  n_chores: { items: ["mop"], flags: ["chores_done", "feat_clean"] }, n_games: { karma: 1 }, n_dark: { items: ["flashlight", "batteries"], flags: ["torch_on"] },
  n_library: { flags: ["found_painting"] }, n_talk: { karma: 2 }, n_annex: { flags: ["annex_lit"] } };
const snapFor = nid => {                               // the run's state on reaching nid, as the stations before it leave it
  const s = { flags: [], items: [], karma: { karma: 0 }, counters: {}, states: {}, trail: [] };
  for (const n of ORDER.slice(0, ORDER.indexOf(nid))) { const l = LEAVES[n] || {}; s.flags.push(...(l.flags || [])); s.items.push(...(l.items || [])); s.karma.karma += l.karma || 0; Object.assign(s.states, l.states || {}); }
  return s;
};

(async () => {
  const browser = await createRequire(import.meta.url)("../browser.cjs").launch(chromium);
  const page = await (await browser.newContext({ viewport: { width: 900, height: 560 } })).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on("response", r => { if (r.status() >= 400 && !OPTIONAL.test(r.url())) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(DESK);
  await page.evaluate(() => new MutationObserver(() => { if (document.querySelector(".ph-glitch")) window.__glitched = (window.__glitched || 0) + 1; }).observe(document.body, { subtree: true, childList: true }));
  await page.waitForFunction(() => window.__dd && window.__dd.S && window.__dd.PLAN, null, { timeout: 60000 });
  await page.evaluate(() => window.__dd.setSimple(true));
  await page.click('nav button[data-v="watchView"]');
  await page.check("#wPlay"); await page.check("#wSkip"); await page.uncheck("#wFast");   // rounds wait for their result
  await page.evaluate(() => {                            // the pointer lock, faked (a headless browser has none)
    const box = document.querySelector("#watchBox"), fire = () => document.dispatchEvent(new Event("pointerlockchange"));
    window.__lock = null; Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => window.__lock });
    document.exitPointerLock = () => { if (window.__lock) { window.__lock = null; fire(); } };
    box.requestPointerLock = () => { window.__lock = box; fire(); return Promise.resolve(); };
  });

  const t0 = Date.now();
  const step = async (what, fn) => {
    try { await fn(); console.log(`  ok  ${what}`); }
    catch (e) { await page.screenshot({ path: shot || "testroom_fail.png" }); fail(`${what}: ${e.message}${errors.length ? "\n  page errors: " + errors.join(" | ") : ""}\n  at ${await where()}`); }
  };
  const where = () => page.evaluate(() => { const R = window.__dd.run, rt = window.__dd.play;
    return JSON.stringify({ trail: R && R.trail.slice(-3), play: !!(rt && rt.active), at: rt ? [+rt.player.pos.x.toFixed(2), +(-rt.player.pos.z).toFixed(2)] : null,
      todo: R && (R.todo || []).map(t => `${t.id}:${t.state}`), heard: (window.__todoLog || []).slice(-8), flags: R && [...R.flags].slice(-8),
      hiding: rt && rt.player.hiding, busy: rt && rt.busy, cards: [...document.querySelectorAll("#watchBox .wcard")].map(c => c.textContent.slice(0, 60)) }); }).catch(() => "?");
  const playing = (on = true, ms = 90000) => page.waitForFunction(on => { const p = window.__dd.play; return on ? !!(p && p.active) : !(p && p.active); }, on, { timeout: ms });
  const node = () => page.evaluate(() => { const R = window.__dd.run; return R ? R.trail[R.trail.length - 1] : null; });
  const atNode = async (nid, ms = 120000) => {           // the flow has reached nid (and, a stitch, Play has the controls)
    await page.waitForFunction(nid => { const R = window.__dd.run; return R && R.trail.includes(nid); }, nid, { timeout: ms })   // (a short scene may be over already)
      .catch(async () => { await page.screenshot({ path: shot || "testroom_fail.png" }); throw new Error(`never reached ${nid} (${await where()})`); });
    if ((await page.evaluate(nid => window.__dd.S.flow[nid].type, nid)) === "stitch" && !(await page.evaluate(nid => (window.__dd.S.stitches[window.__dd.S.flow[nid].ref] || {}).play, nid))) { await playing(); await hook(); }
  };
  // a scene in the Watch: skipped along (dev skip) to each reply or choice, those answered in turn by `answers` (digits)
  const scene = async (answers = [], ms = 120000) => {
    const left = [...answers], start = Date.now(), n0 = await node();
    while (Date.now() - start < ms) {
      if (await page.evaluate(() => !!(window.__dd.play && window.__dd.play.active))) {
        if (await page.evaluate(() => !!window.__dd.play.held)) { await page.keyboard.press("Escape"); await page.waitForTimeout(600); }   // a skip's Esc landed in play: the menu it opened
        return;
      }
      if (await page.$(".ph-dock .ph-opt")) { await page.keyboard.press("Digit" + (left.shift() || 1)); await page.waitForTimeout(600); continue; }
      if (await page.$("#watchBox .wcard")) return;     // a round's card, or an ending
      if ((await node()) !== n0 && (await page.evaluate(() => { const R = window.__dd.run; return R && window.__dd.S.flow[R.trail[R.trail.length - 1]].type !== "scene"; }))) return;
      await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    }
    throw new Error("the scene never ended");
  };
  // stand d metres from a thing, facing it, where nothing's in the way and the cursor lands on it (playtest.js's goTo);
  // aimed at its middle, else anywhere across its top, as a player clicks whatever part shows (a hob beside its pot);
  // look: only looked at (a painting: the reticle on it, nothing to click)
  const goTo = (id, d = 0.9, look = false) => page.waitForFunction(() => { const rt = window.__dd.play; return rt && !rt.lookTween && !rt.moving; }, null, { timeout: 60000 }).then(() => page.evaluate(([id, d, look]) => {
    const rt = window.__dd.play, V = rt.player.pos.constructor, o = rt.byId[id];
    if (!o) throw new Error("no " + id);
    const at = new V(); o.getWorldPosition(at);
    const lo = new V(Infinity, Infinity, Infinity), hi = new V(-Infinity, -Infinity, -Infinity), p = new V();
    o.updateMatrixWorld(true);
    o.traverse(m => { if (!m.isMesh || !m.visible || !m.geometry) return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox;
      for (let k = 0; k < 8; k++) { p.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(m.matrixWorld); lo.min(p); hi.max(p); } });
    const aims = [at];
    if (lo.x <= hi.x) {
      aims.push(lo.clone().add(hi).multiplyScalar(0.5));
      for (const fx of [0.15, 0.38, 0.62, 0.85]) for (const fz of [0.15, 0.38, 0.62, 0.85]) aims.push(new V(lo.x + (hi.x - lo.x) * fx, hi.y - 0.002, lo.z + (hi.z - lo.z) * fz));
    }
    for (const dd of [d, d * 1.3, d * 0.8]) for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12, feet = new V(at.x + Math.cos(a) * dd, 0, at.z - Math.sin(a) * dd);
      rt.place(feet, Math.atan2(-(at.z - feet.z), at.x - feet.x) * 180 / Math.PI, 0);
      const before = rt.player.pos.clone(); rt.pushOut(rt.set("walk"));
      if (before.distanceTo(rt.player.pos) > 1e-3) continue;
      if (rt.triggers.some(t => rt.isIn(t) && !rt.inside.has(t.id))) continue;   // standing here would trip a trigger (enter)
      const eye = rt.eyePos(), c = rt.stage.camera;
      for (const aim of aims) {
        rt.player.yaw = Math.atan2(-(aim.z - eye.z), aim.x - eye.x) * 180 / Math.PI;
        rt.player.pitch = Math.atan2(aim.y - eye.y, Math.hypot(aim.x - eye.x, aim.z - eye.z)) * 180 / Math.PI;
        c.position.copy(eye); c.rotation.order = "YXZ"; c.rotation.set(rt.player.pitch * Math.PI / 180, (rt.player.yaw - 90) * Math.PI / 180, 0); c.updateMatrixWorld();
        rt.updateCursor(0);
        if (look ? rt.look.id === id : rt.target === o) return { cursor: document.querySelector(".ph-cursor").dataset.cursor, label: (document.querySelector(".ph-prompt") || {}).textContent || "" };
      }
    }
    throw new Error(`can't get the cursor on ${id} (${JSON.stringify({ busy: rt.busy, hiding: rt.player.hiding, seat: !!rt.player.seat, look: rt.look.id, vis: o.visible })})`);
  }, [id, d, look]));
  const click = async () => {                           // a left click on what's under the reticle
    const b = await page.locator("#watchBox").boundingBox();
    await page.evaluate(() => { window.__lock = null; });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.evaluate(() => document.querySelector("#watchBox").requestPointerLock());
    await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
  };
  const use = async (id, d) => { const r = await goTo(id, d); await click(); return r; };
  const gameWait = async secs => {                      // the game's clock, not the wall's (slow frames are less play)
    const c0 = await page.evaluate(() => window.__dd.play.clock);
    await page.waitForFunction(([c0, s]) => !window.__dd.play.active || window.__dd.play.clock - c0 >= s, [c0, secs], { timeout: 120000 });
  };
  const until = (fn, arg, what, ms = 120000) => page.waitForFunction(fn, arg, { timeout: ms }).catch(async () => { throw new Error(`${what}: never (${await where()})`); });
  const hold = async (key, secs) => { await page.keyboard.down(key); try { await gameWait(secs); } finally { await page.keyboard.up(key); } };
  const press = async (key, ms = 120) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  const place = (x, y, yaw = 90, pitch = 0) => page.evaluate(([x, y, yaw, pitch]) => { const rt = window.__dd.play; rt.place(new (rt.player.pos.constructor)(x, 0, -y), yaw, pitch); }, [x, y, yaw, pitch]);
  const flag = f => page.evaluate(f => window.__dd.run.flags.has(f), f);
  const tasks = () => page.evaluate(() => [...document.querySelectorAll(".ph-todo .ph-task")].map(e => ({ id: e.dataset.id, state: e.dataset.state })));
  const task = async id => ((await tasks()).find(t => t.id === id) || {}).state || null;
  // every task ticked or failed, heard as it happens (a station's last tick ends it, and its list is cleared straight away)
  // and every knock (Play's runtime lasts the run: a station's knock at its very start is heard too)
  // and every knock and the player's own footsteps by their floor (Play's runtime lasts the run: a station's knock at
  // its very start is heard too)
  const hook = () => page.evaluate(() => { const rt = window.__dd.play; window.__todoLog = window.__todoLog || []; window.__knocks = window.__knocks || 0; window.__steps = window.__steps || [];
    if (rt && !rt.__hooked) { rt.__hooked = true; const e = rt.emit.bind(rt); rt.emit = ev => { if (ev.type === "todo") window.__todoLog.push(ev.id + ":" + ev.state); return e(ev); };
      const f = rt.shelfSound; rt.shelfSound = function (n, a, db) { if (/^knock/.test(n)) window.__knocks++; if (/^step_/.test(n) && !a) window.__steps.push(rt.lastStep.floor); return f.call(this, n, a, db); }; } });
  const ticked = (id, what) => until(k => (window.__todoLog || []).includes(k), id + ":done", what || `${id} ticked`);
  const state = id => page.evaluate(id => window.__dd.play.stateOf(id), id);
  const door = id => page.evaluate(id => { const d = window.__dd.play.doorOf(id); return { open: !!d.open, locked: !!d.locked }; }, id);
  const closePanel = async () => { if (await page.$(".ph-panel .ph-close")) { await page.click(".ph-panel .ph-close"); await page.waitForTimeout(300); } };
  const walkThrough = async (doorId, into, ms = 2.2) => {   // a metre in front of a door on the side away from `into`, facing it, and on through
    await page.evaluate(([id, into]) => { const rt = window.__dd.play, V = rt.player.pos.constructor, m = rt.byId[id], b = m.userData.base || { pos: m.position, rot: m.rotation.y };
      const at = b.pos.clone(), n = new V(Math.sin(b.rot), 0, Math.cos(b.rot)), r = window.__dd.S.levels[rt.level].rooms.find(r => r.id === into);   // the leaf shut: its face
      const side = Math.sign(n.dot(new V(r.at[0] + r.size[0] / 2 - at.x, 0, -(r.at[1] + r.size[1] / 2) - at.z))) || 1, feet = at.clone().addScaledVector(n, -side * 1.0); feet.y = 0;
      rt.place(feet, Math.atan2(-(at.z - feet.z), at.x - feet.x) * 180 / Math.PI, 0); }, [doorId, into]);
    await hold("KeyW", ms);
  };
  const enterRoom = async (doorId, room) => {           // open it if it's shut, walk through it, and be in the room
    if (!(await door(doorId)).open) { const r = await use(doorId, 1.0); if (r.cursor === "locked") throw new Error(`${doorId} is locked`); await gameWait(1.0); }
    await walkThrough(doorId, room);
    await until(r => window.__dd.play.inside.has(r), room, `in the ${room}`, 30000);
  };

  if (FROM) { await page.evaluate(([n, s]) => { window.__dd.watch(n, s); }, [FROM, snapFor(FROM)]); console.log(`  from ${FROM}`); }   // not awaited: the run lasts till its ending
  else await page.click("#wStart");
  const from = FROM ? ORDER.indexOf(FROM) : 0;
  // after each station, the reference an Unreal build is held to (docs/UNREAL_NEXT.md): the run's state, and the view
  const states = {};
  fs.mkdirSync(REF, { recursive: true });
  const record = async nid => {
    states[nid] = await page.evaluate(() => { const R = window.__dd.run, rt = window.__dd.play;
      return { flags: [...R.flags].sort(), karma: R.karma, counters: R.counters, time: R.time, name: R.name || null, ticked: (window.__todoLog || []).slice(),
        level: rt && rt.level, power: rt ? rt.powered() : null, items: rt ? [...rt.items].sort() : [],
        doors: rt ? Object.fromEntries(Object.entries(rt.doors).map(([k, d]) => [k, (d.open ? "open" : "shut") + (d.locked ? ", locked" : "")])) : {},
        things: rt && rt.lives ? Object.fromEntries(Object.keys(rt.lives.things).map(id => [id, rt.stateOf(id)])) : {} }; });
    const box = await page.locator("#watchBox").boundingBox(); if (box) await page.screenshot({ path: path.join(REF, `${nid}.png`), clip: box });
    fs.writeFileSync(path.join(REF, "states.json"), JSON.stringify({ game: "TestRoom001", made: new Date().toISOString(), from: FROM || ORDER[0], states }, null, 1));
  };
  const station = async (nid, fn) => { if (ORDER.indexOf(nid) < from) return; await atNode(nid); await fn(); await record(nid).catch(() => null); console.log(`       ${nid} done at ${((Date.now() - t0) / 60000).toFixed(1)} min`); };

  await station("n_arrive", async () => {
    await step("1 · Moving: the arrival in the yard, its two tasks on the list, the walk, the run, the crouch, the steps on dirt", async () => {
      await until(() => document.querySelectorAll(".ph-todo .ph-task").length === 2, null, "the list after the fade in", 60000);
      const t = await tasks(); if (t.map(x => x.id).join() !== "t1_door,t1_in" || t.some(x => x.state !== "open")) throw new Error("the list " + JSON.stringify(t));
      await page.evaluate(() => { window.__steps.length = 0; });
      await place(1.5, -8.5, 0); const x0 = await page.evaluate(() => window.__dd.play.player.pos.x);
      await hold("KeyW", 1.2); const walked = await page.evaluate(x0 => window.__dd.play.player.pos.x - x0, x0);
      await place(1.5, -8.0, 0); await page.keyboard.down("ShiftLeft"); await hold("KeyW", 1.2); await page.keyboard.up("ShiftLeft");
      const ran = await page.evaluate(() => window.__dd.play.player.pos.x - 1.5);
      if (!(walked > 0.8) || !(ran > walked * 1.6)) throw new Error(`walked ${walked.toFixed(2)} m, ran ${ran.toFixed(2)} m in the same time`);
      await press("KeyC"); await gameWait(0.7); const eye = await page.evaluate(() => window.__dd.play.player.eye); await press("KeyC"); await gameWait(0.7);
      if (!(eye < 1.2)) throw new Error("crouched, the eye at " + eye);
      const steps = await page.evaluate(() => window.__steps);
      if (!steps.length || steps.some(f => f !== "dirt")) throw new Error("steps in the yard: " + JSON.stringify(steps));
      const lastName = await page.evaluate(() => window.__dd.play.lastStep.name);     // the yard's in the rain (game.weather): the steps sound wet
      if (!/^step_wet/.test(lastName)) throw new Error("steps in the rain should be wet: " + lastName);
    });
    await step("the front door: a click opens it (the task ticks), through it into the lobby (it ticks), and the station ends", async () => {
      await place(1.5, -5.9, 90); await use("front_door", 1.0); await gameWait(1.0);
      if (!(await door("front_door")).open) throw new Error("not open");
      await ticked("t1_door");
      await walkThrough("front_door", "lobby", 2.5);
      await until(() => !window.__dd.play.end || window.__dd.run.trail.length > 1, null, "the station's end");
    });
  });

  await station("n_hello", async () => {
    await step("Aoi in the lobby (a scene): her name a word (the guide, till you've met her), her reply answered as a conversation card (Ready: karma +1, her reply two lines, then on past the line for Not great), her body track (from her second line she walks to the bench and sits there till the shot ends), the scene's cues on its clips' edges (the kitchen's TV to static), its sets (met_aoi), her face row (an expression, then a loop of its held part to the end), the player's thought typing itself out and retyped (Easy. -> Fine.)", async () => {
      // skipped along to her question; then, answered, watched to its end: a conversation card's answer (§9.9), her reply
      // two lines, then on to the line it skips to (her line for the other answer never said)
      // her body track: from her mark (x 1.5) to the bench (x -3); a skip jumps to her question, so the Watch is seen
      // there (where the timeline has her then: on her way) and from there to the bench
      const t0 = Date.now(), subs = [], xs = [];
      while (!(await page.$(".ph-dock .ph-opt"))) { if (Date.now() - t0 > 60000) throw new Error("her question never came"); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
      const xq = await page.evaluate(() => { const g = window.__dd.watchStage.cast.aoi.group; return g.visible ? +g.position.x.toFixed(2) : null; });
      const whoQ = await page.evaluate(() => (document.querySelector("#watchBox .ph-line .ph-who") || {}).textContent || "");   // her name, a word: not met yet
      if (whoQ !== "the guide") throw new Error(`her name at her question: ${JSON.stringify(whoQ)} (the guide till you've met her: {guide}, §9.14)`);
      await page.keyboard.press("Digit1");
      while (Date.now() - t0 < 120000) {
        const o = await page.evaluate(() => { const R = window.__dd.run, p = window.__dd.play, g = window.__dd.watchStage.cast.aoi.group;
          return { sub: (document.querySelector("#watchOv .sub") || {}).textContent || "", x: g.visible ? g.position.x : null, out: !!(p && p.active) || !R || R.trail[R.trail.length - 1] !== "n_hello" }; });
        if (o.sub && subs[subs.length - 1] !== o.sub) subs.push(o.sub);
        if (o.out) break;
        if (o.x !== null) xs.push(o.x);
        await page.waitForTimeout(80);
      }
      const tr = await page.evaluate(async () => {      // by the scene's timeline: at her mark till her second line, walking two seconds in, on her way at her question, at the bench sitting by the end
        const { version } = await import("/stage.js"), st = window.__dd.watchStage, tl = st.timeline(version(window.__dd.S.scenes.s_hello)), c2 = tl.segs.find(x => x.type === "clip" && x.clip.id === "c2"), q = tl.segs.find(x => x.type === "reply");
        const at = T => { const s = st.stateAt(tl, T, window.__dd.FILES), pl = s.place.aoi; return pl ? { x: +pl.pos.x.toFixed(2), z: +pl.pos.z.toFixed(2), yaw: Math.round(pl.yaw), pelvis: +s.poses.aoi.pelvis.y.toFixed(2) } : null; };
        return { before: at(c2.start - 0.1), walking: at(c2.start + 2), asked: at(q.start), end: at(tl.total) };
      });
      const { before, walking, asked, end } = tr;
      if (before !== null || !walking || !(walking.x < 1.2 && walking.x > -2.8) || !(end && Math.abs(end.x + 3) < 0.1 && Math.abs(end.z - 0.85) < 0.1 && end.yaw === 270 && end.pelvis < 0.6)
          || !asked || xq === null || Math.abs(xq - asked.x) > 0.15 || !(xs.length && Math.min(...xs) < -2.9))
        throw new Error(`her body track: ${JSON.stringify(tr)}; in the Watch at her question x ${xq}, then down to ${xs.length ? Math.min(...xs).toFixed(2) : "unseen"}`);
      const said = ["Good. Then let's begin.", "The corridor's yours. I'll be watching.", "One thing a room. Fine."], skipped = "Tell me if it gets to be too much.";
      const typed = ["One thing a room. Easy.", "One thing a room. Fine."].map(x => subs.indexOf(x));   // typed out, then retyped (§9.15)
      if (!(typed[0] >= 0 && typed[1] > typed[0] && subs.some((x, i) => i < typed[0] && x.startsWith("One th") && x.length < 23))) throw new Error("the thought typing itself out: " + JSON.stringify(subs.slice(-24)));
      if (said.some(x => !subs.includes(x)) || subs.includes(skipped) || subs.indexOf(said[0]) > subs.indexOf(said[1]) || subs.indexOf(said[1]) > subs.indexOf(said[2])) throw new Error("the conversation said " + JSON.stringify(subs));
      const tk = await page.evaluate(async () => { const { version } = await import("/stage.js");
        return window.__dd.watchStage.timeline(version(window.__dd.S.scenes.s_hello), { c3: "good" }).segs.filter(s => s.type === "clip").map(s => s.clip.id).join(); });
      if (tk !== "c1,c2,c3,c3_good,c3_good_2,c4") throw new Error("its takes: " + tk);
      const r = await page.evaluate(() => ({ karma: window.__dd.run.karma.karma, met: window.__dd.run.flags.has("met_aoi"), tv: window.__dd.run.lives.at("kitchen_tv", window.__dd.run.secs + 999).state }));
      if (r.karma !== 1 || !r.met || r.tv !== "static") throw new Error(JSON.stringify(r));
      const f = await page.evaluate(async () => {                // the face over the scene's timeline: at rest before its first placement, on after
        const { FACES, version, edgeTime } = await import("/stage.js"), st = window.__dd.watchStage, tl = st.timeline(version(window.__dd.S.scenes.s_hello));
        const on = []; for (let T = 0; T < tl.total; T += 0.2) { const w = (st.stateAt(tl, T, window.__dd.FILES).faces || {}).aoi; on.push(!!w && Math.max(...w) > 0.03); }
        return { lib: Object.keys(FACES.lib).sort(), first: on.indexOf(true) * 0.2, share: on.filter(Boolean).length / on.length, c3: edgeTime(tl.segs, { clip: "c3" }), total: tl.total, last: on[on.length - 1] };
      });
      if (f.lib.join() !== "pout_and_glance,pout_and_glance_loop" || !(f.first >= 0.2 && f.first <= 1.6) || !(f.share > 0.4) || !f.last) throw new Error("her face: " + JSON.stringify(f));
    });
  });

  await station("n_front", async () => {
    await step("2 · The front door: the steps on the lobby's tile; the knock heard at it, Aoi outside; the peephole puts the eye to her (the task ticks, her line), a step back", async () => {
      await page.evaluate(() => { window.__steps.length = 0; });
      await place(-2.0, -4.0, 0); await hold("KeyW", 1.0);    // along the lobby's south side, off its rug
      const st = await page.evaluate(() => window.__steps);
      if (!st.length || st.some(f => f !== "tile")) throw new Error("the steps in the lobby: " + JSON.stringify(st));
      await gameWait(0.6);
      let lens = null; for (const id of ["front_door:peephole:a", "front_door:peephole:b"]) { try { await goTo(id, 0.6); lens = id; break; } catch (e) { } }
      if (!lens) throw new Error("the lens");
      await click(); await gameWait(0.5);
      const p = await page.evaluate(() => { const rt = window.__dd.play, n = rt.npcs.aoi; return { peeping: rt.player.peeping && rt.player.peeping.door, aoi: n && n.as, y: n && -n.pos.z }; });
      if (p.peeping !== "front_door" || p.aoi !== "idle" || !(p.y < -5)) throw new Error("at the lens: " + JSON.stringify(p));
      const wet = await page.evaluate(() => (((window.__dd.play.skinWet || {}).aoi) || {}).wet || 0);     // out in the yard's rain: her skin wets by itself
      if (!(wet > 0.1)) throw new Error("Aoi out in the rain should be wet by now: " + wet);
      await ticked("t2_peep");
      if (!(await page.evaluate(() => window.__knocks)) && !/knock/.test(await page.evaluate(() => document.querySelector(".ph-log").textContent))) throw new Error("no knock heard");
      await press("KeyS"); await gameWait(0.3);
    });
    await step("the latch: the door shut first (Close it first), then its thumb turn locks it (the bar across, the task ticks), Aoi goes", async () => {
      if ((await door("front_door")).open) {              // open since station 1 (a start from here finds it shut)
        const r0 = await goTo("front_door:latch", 0.6);
        if (r0.cursor !== "locked" || !/close it first/i.test(r0.label)) throw new Error("the turn on an open door: " + JSON.stringify(r0));
        await use("front_door", 1.0); await gameWait(1.2);
        if ((await door("front_door")).open) throw new Error("still open");
      }
      await use("front_door:latch", 0.6); await gameWait(0.4);
      const L = await page.evaluate(() => ({ locked: window.__dd.play.doorOf("front_door").locked, bar: window.__dd.play.byId["front_door:latch"].userData.bar.rotation.y }));
      if (!L.locked || Math.abs(L.bar - Math.PI / 2) > 0.01) throw new Error(JSON.stringify(L));
      await ticked("t2_lock");
    });
  });

  await station("n_doors", async () => {
    await step("3 · Doors and keys: the sliding door to the keys room; the closet locked (Locked) until the brass key's taken, then it opens and you walk in", async () => {
      await place(1.5, 1.2, 90);
      await enterRoom("door_keys", "keys");
      const c0 = await goTo("closet_door", 1.0); if (c0.cursor !== "locked") throw new Error("the closet without the key: " + c0.cursor);
      await use("key_brass_pickup", 0.7); await ticked("t3_key");
      await enterRoom("closet_door", "closet"); await ticked("t3_closet");
    });
    await step("the code on the closet's note (the task ticks), the store's keypad takes 4071, the vault's flag lock opens, in (ticks), the fuse (ticks), the door slams behind you, and you get out again", async () => {
      await use("code_note", 0.6); await page.waitForSelector(".ph-panel .ph-text", { timeout: 30000 });
      if (!/4071/.test(await page.textContent(".ph-panel .ph-text"))) throw new Error("the note");
      await closePanel(); await ticked("t3_code");
      await walkThrough("closet_door", "keys"); await place(-2.5, 2.5, 0);
      await enterRoom("door_keys", "corridor"); await enterRoom("door_store", "store");
      const v0 = await goTo("vault_door", 1.0); if (v0.cursor !== "locked") throw new Error("the vault before its code: " + v0.cursor);
      await use("vault_keypad", 0.7); await page.waitForSelector(".ph-pad", { timeout: 30000 });
      for (const k of "4071") await page.click(`.ph-pad button:text-is("${k}")`);
      await page.click('.ph-pad button:text-is("OK")'); await page.waitForTimeout(400);
      if (!(await flag("vault_open"))) throw new Error("the keypad didn't set vault_open");
      await enterRoom("vault_door", "vault"); await ticked("t3_vault");
      await use("fuse_pickup", 0.6); await ticked("t3_fuse");
      await until(() => !window.__dd.play.doorOf("vault_door").open, null, "the vault door slammed", 30000);
      await enterRoom("vault_door", "store");
    });
  });

  await station("n_power", async () => {
    await step("4 · Power: into the power room, the power cuts (the lamps dark, the candle burning on, the switch only clicks: No power)", async () => {
      await place(1.5, 2.5, 0);
      await enterRoom("door_power", "power");
      await until(() => !window.__dd.play.powered(), null, "the power cut", 30000);
      const L = await page.evaluate(() => { const b = window.__dd.play.byId; return { lamp: b.power_lamp.intensity, candle: b.power_candle_light.intensity, corridor: b.corr_lamp_1.intensity }; });
      if (L.lamp !== 0 || L.corridor !== 0 || !(L.candle > 0)) throw new Error(JSON.stringify(L));
      const s = await goTo("power_switch", 0.7); if (s.cursor !== "locked" || !/no power/i.test(s.label)) throw new Error("the switch in the cut: " + JSON.stringify(s));
      await click(); await gameWait(0.3); if ((await task("t4_switch")) !== "open") throw new Error("a dead switch ticked its task");
    });
    await step("the breaker brings the power back (ticks, the lamp flickering up), the switch lights the bulb (ticks), the candle blown out (ticks)", async () => {
      await use("breaker_box", 0.7); await gameWait(1.2);
      if (!(await page.evaluate(() => window.__dd.play.powered()))) throw new Error("no power");
      await ticked("t4_breaker");
      await use("power_switch", 0.7); await gameWait(0.4);
      if (!(await page.evaluate(() => window.__dd.play.byId.power_bulb.intensity > 0))) throw new Error("the bulb is dark");
      await ticked("t4_switch");
      const c = await use("power_candle", 0.6); if (!/blow/i.test(c.label)) throw new Error("the candle says " + c.label);
      await gameWait(0.3); await ticked("t4_candle");
      if (!(await page.evaluate(() => window.__dd.play.byId.power_candle_light.intensity === 0))) throw new Error("the candle's light is still on");
    });
  });

  await station("n_store", async () => {
    await step("5 · In your hands: the three tins into the inventory's row (each ticks), the box carried to the shelf and put down there (G: it ticks), the plushie in the hand (ticks)", async () => {
      await place(1.5, 7.5, 180);
      await enterRoom("door_store", "store");
      for (const t of ["a", "b", "c"]) { await use(`tin_${t}_pickup`, 0.6); await ticked(`t5_${t}`); }
      const row = await page.evaluate(() => document.querySelectorAll(".ph-inv-i").length);
      if (row < 3) throw new Error("the row holds " + row);
      await use("store_box", 0.8); await gameWait(0.3);
      if ((await page.evaluate(() => (window.__dd.play.carried || {}).id)) !== "store_box") throw new Error("the box isn't in the hand");
      await place(-2.5, 7.9, 90); await gameWait(0.3); await press("KeyG"); await gameWait(0.3);
      await ticked("t5_box");
      await use("store_plush", 0.8); await ticked("t5_plush");
    });
  });

  await station("n_kitchen", async () => {
    await step("6 · Little things: Aoi asks for the kettle (her name by the task); a click switches it on, it boils by itself and ticks, and she walks off and sits", async () => {
      await place(1.5, 7.5, 0);
      await enterRoom("door_kitchen", "kitchen");
      const t = await tasks(); if (!t.some(x => x.id === "t6_kettle")) throw new Error(JSON.stringify(t));
      if (!/Aoi/.test(await page.textContent('.ph-task[data-id="t6_kettle"]'))) throw new Error("the request has no name by it");
      const sw = await page.evaluate(() => { const st = window.__dd.watchStage, f = st.cast.aoi; return { set: st.skin.aoi, worn: f.wet, kind: f.constructor.name }; });   // the task's `skin` beat: she sweats in the kitchen, drawn on her body (skinwet.js)
      if (!sw.set || sw.set.wet !== 0.6 || sw.set.sweat !== 0.4 || !sw.worn || sw.worn.wet !== 0.6 || sw.worn.sweat !== 0.4) throw new Error("her skin: " + JSON.stringify(sw));
      const k = await use("kitchen_kettle", 0.7); if (!/switch on/i.test(k.label)) throw new Error("the kettle says " + k.label);
      await gameWait(0.3); if ((await state("kitchen_kettle")) !== "heating") throw new Error("not heating");
      await ticked("t6_kettle", "the kettle boiled");
      await until(() => { const n = window.__dd.play.npcs.aoi; return n && n.st.arrived === "kitchen_chair_spot"; }, null, "Aoi sat at the table", 120000);
    });
    await step("the cup poured from the boiled kettle (full: ticks), the cigarette put out, the TV (static since the lobby's scene) off, the hob on and the pot simmering, then the phone rings and is answered", async () => {
      const c = await use("kitchen_mug", 0.6); if (!/pour/i.test(c.label)) throw new Error("the cup says " + c.label);
      await ticked("t6_cup", "the cup full");
      const a = await use("kitchen_ashtray", 0.6); if (!/put it out/i.test(a.label)) throw new Error("the ashtray says " + a.label);
      await ticked("t6_cig");
      if ((await state("kitchen_tv")) !== "static") throw new Error("the TV is " + await state("kitchen_tv"));   // the lobby scene's cue (a start from later: LEAVES)
      await use("kitchen_tv", 1.0); await ticked("t6_tv");
      await use("kitchen_hob", 0.7); await ticked("t6_hob", "the pot simmering");
      await until(() => window.__dd.play.stateOf("kitchen_phone") === "ringing", null, "the phone ringing", 30000);
      const p = await use("kitchen_phone", 0.6); if (!/answer/i.test(p.label)) throw new Error("the phone says " + p.label);
      await ticked("t6_phone");
    });
  });

  await station("n_chores", async () => {
    await step("7 · Chores: the mud needs the mop (Need the mop), the mop taken, held clicks scrub both stains away (they tick, a feat), the back door's latch locks it (ticks)", async () => {
      await place(1.5, 12.5, 0);
      await enterRoom("door_chores", "chores");
      const s0 = await goTo("chores_stain", 1.0); if (s0.cursor !== "locked") throw new Error("the mud without the mop: " + s0.cursor);
      await use("mop_pickup", 0.7); await ticked("t7_mop");
      for (const [id, secs] of [["chores_stain", 2], ["chores_stain_2", 1.5]]) {
        if (!(await page.evaluate(() => (window.__dd.play.carried || {}).item === "mop")) && id === "chores_stain") throw new Error("the mop isn't in the hand");
        await goTo(id, 1.0);
        const b = await page.locator("#watchBox").boundingBox();
        await page.evaluate(() => { window.__lock = null; }); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await page.evaluate(() => document.querySelector("#watchBox").requestPointerLock());
        await page.mouse.down(); await gameWait(secs + 0.6); await page.mouse.up();
      }
      await ticked("t7_mud"); await ticked("t7_blood");
      if (!(await flag("feat_clean"))) throw new Error("the feat's flag");
      await use("back_door:latch", 0.6); await gameWait(0.4);
      if (!(await door("back_door")).locked) throw new Error("the back door isn't locked");
      await ticked("t7_latch");
    });
  });

  await station("n_rest", async () => {
    await step("8 · Sitting: the chair sits you (eye at sitting height, ticks) and stands you; the sofa plays a scene, then the name typed is kept and said", async () => {
      await place(1.5, 12.5, 180);
      await enterRoom("door_rest", "rest");
      const r = await use("rest_chair", 0.7); if (r.cursor !== "sit") throw new Error("the chair: " + r.cursor);
      await gameWait(0.9);
      const e = await page.evaluate(() => [window.__dd.play.player.eye, !!window.__dd.play.player.seat]);
      if (!e[1] || Math.abs(e[0] - 1.15) > 0.05) throw new Error("seated " + e);
      await ticked("t8_chair"); await click(); await gameWait(0.9);
      await use("rest_sofa", 0.9);
      await playing(false, 60000); await scene();
      await page.waitForSelector(".ph-panel .ph-name", { timeout: 60000 });
      await page.keyboard.type("Riko"); await page.keyboard.press("Enter");
      await until(() => /Riko\. She'll write that/.test(window.__dd.play.hud.lineEl.textContent), null, "the name said");
      if ((await page.evaluate(() => window.__dd.run.name)) !== "Riko") throw new Error("the name isn't kept");
      if (await page.evaluate(() => window.__dd.play.player.seat)) await click();
    });
  });

  await station("n_games", async () => {
    await step("9 · Games: the die thrown and its face heard (ticks); chō-han with Aoi played out at the table (ticks), then her question answered (One more: karma +1, ticks)", async () => {
      await place(1.5, 17.5, 180);
      await enterRoom("door_games", "games");
      const d = await use("games_die", 1.1); if (d.cursor !== "roll") throw new Error("the die: " + d.cursor);
      await ticked("t9_die", "the die settled");
      await use("games_table", 1.0);
      await page.waitForSelector(".ph-dock .ph-opt", { timeout: 90000 });
      await page.keyboard.press("Digit1");
      await ticked("t9_game", "the game played");
      await page.waitForSelector(".ph-dock .ph-opt", { timeout: 90000 });
      const q = await page.evaluate(() => [...document.querySelectorAll(".ph-dock .ph-opt")].map(o => o.textContent));
      if (!/One more/.test(q[0])) throw new Error("her question: " + q);
      await page.keyboard.press("Digit1");
      await ticked("t9_ask");
      if ((await page.evaluate(() => window.__dd.run.karma.karma)) !== 2) throw new Error("karma " + await page.evaluate(() => window.__dd.run.karma.karma));
    });
  });

  await station("n_dark", async () => {
    await step("10 · The dark: the flashlight into the pocket (ticks), F lights it (ticks), it flickers and dies (F only clicks), the batteries shown and taken bring it back", async () => {
      await place(1.5, 17.5, 0);
      await enterRoom("door_dark", "dark");
      await use("torch_pickup", 0.6); await ticked("t10_torch");
      await press("KeyF"); await ticked("t10_on");
      await until(() => { const t = window.__dd.play.torchLight; return t && t.dead && !t.on; }, null, "the flashlight dead (its stutter over, out)", 60000);
      await press("KeyF"); await gameWait(0.3);
      if (await page.evaluate(() => window.__dd.play.torchLight.on)) throw new Error("a dead flashlight lit");
      await use("batteries_pickup", 0.6); await ticked("t10_bat");
      await gameWait(0.3); if (await page.evaluate(() => window.__dd.play.torchLight.dead)) throw new Error("still dead");
    });
    await step("on the way out the glimpse: a creak, the figure there for a moment and gone; out of the room (ticks)", async () => {
      await page.evaluate(() => { window.__seen = false; const f = window.__dd.play.byId.dark_figure; const t = setInterval(() => { if (f.visible) window.__seen = true; }, 20); window.__stopSeen = () => clearInterval(t); });
      await place(5.6, 17.5, 180); await hold("KeyW", 1.2);      // west, into the doorway's trigger
      await until(() => window.__seen, null, "the figure seen", 60000);
      await until(() => !window.__dd.play.byId.dark_figure.visible, null, "the figure gone again", 60000);
      await page.evaluate(() => window.__stopSeen());
      await walkThrough("door_dark", "corridor"); await ticked("t10_out");
    });
  });

  await station("n_library", async () => {
    await step("11 · Reading and looking: the diary read (ticks); the photo taken up in the hands and turned over, put back (ticks); the bookshelf's card (ticks)", async () => {
      await place(1.5, 22.5, 180);
      await enterRoom("door_library", "library");
      await use("library_diary", 0.6); await page.waitForSelector(".ph-panel .ph-text", { timeout: 30000 }); await closePanel(); await ticked("t11_diary");
      await use("library_photo", 0.6); await page.waitForSelector(".ph-exam", { timeout: 60000 }); await gameWait(0.3);
      const b = await page.locator("#watchBox").boundingBox(), x = b.x + b.width * 0.3, y = b.y + b.height * 0.35;
      await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= 10; i++) await page.mouse.move(x + i * 26, y, { steps: 2 }); await page.mouse.up();
      await gameWait(0.5);
      if (!(await page.evaluate(() => window.__dd.play.examining.angle() > 2.2))) throw new Error("not turned over");
      await page.keyboard.press("Escape"); await until(() => !window.__dd.play.examining, null, "put back", 30000);
      await ticked("t11_photo");
      await use("library_shelf", 1.0); await page.waitForSelector(".ph-panel", { timeout: 30000 });
      if (!/labelled with your name/.test(await page.textContent(".ph-panel"))) throw new Error("the shelf's card");
      await closePanel(); await ticked("t11_shelf");
    });
    await step("the painting looked at two seconds (ticks): the secret, a note slips out (found_painting), and it reads", async () => {
      await goTo("library_painting", 1.6, true); await gameWait(2.6);
      await ticked("t11_paint");
      if (!(await flag("found_painting"))) throw new Error("the secret's flag");
      if (!(await page.evaluate(() => window.__dd.play.byId.painting_note.visible))) throw new Error("the note isn't shown");
    });
  });

  await station("n_bath", async () => {
    await step("12 · Hiding: the tap turned on (running: ticks); in the locker (hidden), the room changes while you're not looking (the towel gone, writing on the mirror: ticks)", async () => {
      await place(1.5, 27.5, 180);
      await enterRoom("door_bath", "bath");
      await use("bath_tap", 0.6); await ticked("t12_tap");
      await use("bath_locker", 0.8);
      await until(() => window.__dd.play.player.hiding === "bath_locker", null, "in the locker", 60000);
      await until(() => !window.__dd.play.byId.bath_towel.visible && window.__dd.play.byId.bath_mirror_text.visible, null, "the swap", 60000);
      await ticked("t12_hide");                                  // the station ends with you in the locker: the next scene takes the eye from there
    });
  });

  await station("n_talk", async () => {
    await step("Aoi in the workshop (a scene, faded in): the timed choice answered (I trust you: karma +2)", async () => {
      const k0 = await page.evaluate(() => window.__dd.run.karma.karma);
      await scene([1]);
      const k = await page.evaluate(() => window.__dd.run.karma.karma);
      if (k - k0 !== 2) throw new Error(`karma ${k0} then ${k}`);
    });
  });

  await station("n_hide", async () => {
    await step("14 · Hide and seek (a round): found in the second locker, the death scene for that locker, the branch map's retry back to the round (the pocket and the little things kept)", async () => {
      await page.waitForSelector("#watchBox .wcard button", { timeout: 60000 });
      await page.click('#watchBox .wcard button:text-is("found")');
      await page.waitForSelector('#watchBox .wcard button:text-is("workshop locker 2")', { timeout: 30000 });
      await page.click('#watchBox .wcard button:text-is("workshop locker 2")');
      await until(() => window.__watchEnd === "Found", null, "the death", 120000).catch(async e => { await scene(); await until(() => window.__watchEnd === "Found", null, "the death", 120000); });
      const r = await page.evaluate(() => ({ found: window.__dd.run.counters.found, at: window.__dd.run.foundAt }));
      if (r.found !== 1 || r.at !== "workshop_locker_2") throw new Error(JSON.stringify(r));
      await page.click('#watchBox .wcard button:text-matches("Return to")');
      await page.evaluate(() => { window.__watchEnd = null; });
      await page.waitForSelector("#watchBox .wcard button", { timeout: 60000 });
      const kept = await page.evaluate(() => ({ items: [...window.__dd.run.items].sort(), tv: window.__dd.run.lives.at("kitchen_tv", 0).state }));   // the checkpoint kept the pocket and the little things
      if (!kept.items.includes("fuse") || !kept.items.includes("flashlight") || kept.tv !== "off") throw new Error("after the retry: " + JSON.stringify(kept));
      await page.click('#watchBox .wcard button:text-is("hidden")');
    });
  });

  await station("n_run", async () => {
    await step("15 · Run: its timer counting down on the HUD; into the atrium in time (ticks)", async () => {
      const t1 = +(await page.textContent(".ph-timer")); await gameWait(1); const t2 = +(await page.textContent(".ph-timer"));
      if (!(t1 > 0 && t2 < t1)) throw new Error(`the timer ${t1} then ${t2}`);
      await place(1.5, 28.5, 90); await hold("KeyW", 2.5);
      await ticked("t15_run");
    });
  });

  await station("n_sneak", async () => {
    await step("16 · Sneak: the jumpscare as you come in (a creak, the figure there and gone); then Aoi walks her route; her eyes fill the meter in the open, never in the safe corner; the far corner reached (ticks)", async () => {
      await page.evaluate(() => { window.__js = false; const f = window.__dd.play.byId.atr_figure; const t = setInterval(() => { if (f.visible) window.__js = true; }, 20); window.__stopJs = () => clearInterval(t); });
      await place(1.5, 30.4, 90); await hold("KeyW", 0.8);   // walked into the middle (a place there isn't an enter)
      await until(() => window.__js, null, "the jumpscare", 60000); await page.evaluate(() => window.__stopJs());
      await until(() => { const n = window.__dd.play.npcs.aoi; return n && n.as === "path"; }, null, "Aoi on her route", 30000);
      await place(-3.8, 31.2, 45); await gameWait(2.5);     // the safe corner: unseen
      if (await page.evaluate(() => window.__dd.play.suspicion > 0.05)) throw new Error("seen in the safe corner");
      await until(() => { const n = window.__dd.play.npcs.aoi; return n.pos.x > -1 && n.pos.x < 3; }, null, "Aoi mid-route", 60000);
      await page.evaluate(() => { const rt = window.__dd.play, n = rt.npcs.aoi, a = n.yaw * Math.PI / 180;   // in the open, in front of her
        rt.place(new (rt.player.pos.constructor)(n.pos.x + Math.cos(a) * 2.5, 0, n.pos.z - Math.sin(a) * 2.5), n.yaw + 180, 0); });
      await gameWait(0.45);
      const k = await page.evaluate(() => window.__dd.play.suspicion); if (!(k > 0.15)) throw new Error("in the open in front of her, the meter at " + k.toFixed(2));
      await place(-3.8, 31.2, 45); await gameWait(2.0);
      if (await page.evaluate(() => window.__dd.play.suspicion > 0.05)) throw new Error("the meter didn't drain in the safe corner");
      await place(6.5, 33.6, 90); await hold("KeyW", 0.6);   // walked into the far corner
      await ticked("t16_cross");
    });
  });

  await station("n_sleep", async () => {
    await step("17 · Night: back to the rest room's bed, it sleeps you (the chapter card Night 2 · 23:40, the time now night), you wake and it ticks; the lobby's clock stopped", async () => {
      await place(1.5, 12.5, 180); await enterRoom("door_rest", "rest");
      await use("rest_bed", 0.9);
      await page.waitForSelector(".ph-chapter.on", { timeout: 90000 });
      const card = await page.evaluate(() => [document.querySelector(".ph-chapter-t").textContent, (document.querySelector(".ph-chapter-s") || {}).textContent]);
      if (card.join(" · ") !== "Night 2 · 23:40") throw new Error("the card " + card);
      await until(() => !window.__dd.play.player.sleeping && !document.querySelector(".ph-chapter"), null, "awake", 90000);
      await ticked("t17_sleep");
      const r = await page.evaluate(() => ({ time: window.__dd.run.time, clock: window.__dd.play.stateOf("lobby_clock") }));
      if (r.time !== "night" || r.clock !== "stopped") throw new Error(JSON.stringify(r));
    });
  });

  await station("n_night", async () => {
    await step("Aoi at the door at night (a scene): her name now Aoi (a word, §9.14); a line kept by the chores done, one left out; the answer for the painting offered, the one for skipped chores not; her face by the painting; an hour and a half skipped (the kitchen clock jumps on)", async () => {
      const t0 = Date.now();
      while (!(await page.$(".ph-dock .ph-opt"))) { if (Date.now() - t0 > 60000) throw new Error("her question never came"); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
      const q = await page.evaluate(async () => {
        const { version } = await import("/stage.js"), st = window.__dd.watchStage, tl = st.timeline(version(window.__dd.S.scenes.s_night));
        st.stateAt(tl, 0.5, window.__dd.FILES);
        return { who: (document.querySelector("#watchBox .ph-line .ph-who") || {}).textContent || "", opts: [...document.querySelectorAll(".ph-dock .ph-opt > span:first-child")].map(e => e.textContent),
          lines: tl.segs.filter(x => x.type === "clip" && !x.answer).map(x => x.clip.id), faces: ((tl.facePlan || {}).aoi || []).map(it => (it.p.if || []).join()) };
      });
      if (q.who !== "Aoi" || q.opts.join("|") !== "Ready.|I saw the painting." || q.lines.join() !== "c1,c2,c4" || q.faces.join("|") !== "found_painting") throw new Error(JSON.stringify(q));
      const ran = await page.evaluate(() => { const R = window.__dd.run, s = R.lives.at("kitchen_clock", R.secs); return (s.spent || {}).running || 0; });
      if (!(ran > 5400 && ran < 5400 + 3600)) throw new Error(`the kitchen clock after the skip ran ${ran.toFixed(0)} s (an hour and a half skipped: skip 5400)`);
      await page.keyboard.press("Digit2");
      await scene();
    });
  });

  await station("n_annex", async () => {
    await step("18 · The annex (another level): a memory flicker that types out and breaks off; dark, a checkpoint; the note read (ticks); the fusebox says it needs the fuse, takes it (gone from the pocket), and the power comes on (ticks)", async () => {
      await until(() => window.__dd.play.level === "annex" && !window.__dd.play.powered(), null, "the annex, dark", 30000);
      await until(() => (window.__glitched || 0) > 0 && !document.querySelector(".ph-glitch"), null, "the memory flicker breaking off (§9.15)", 30000);
      await use("annex_note", 0.6); await page.waitForSelector(".ph-panel .ph-text", { timeout: 30000 }); await closePanel(); await ticked("t18_note");
      const f = await goTo("fusebox", 0.8); if (!/^use: fuse/i.test(f.label)) throw new Error("the fusebox says " + f.label);
      await click(); await gameWait(0.4);
      await ticked("t18_fuse");
      const r = await page.evaluate(() => ({ powered: window.__dd.play.powered(), fuse: window.__dd.play.items.has("fuse") }));
      if (!r.powered || r.fuse) throw new Error(JSON.stringify(r));
    });
  });

  await station("n_final", async () => {
    await step("the end by act (leave by the door), the secret's scene (found_painting), and karma 4: Passed, its title card's words (§9.14) with the name typed", async () => {
      await enterRoom("exit_door", "annex_out").catch(() => null);
      await scene();
      await until(() => window.__watchEnd, null, "an ending", 120000);
      const end = await page.evaluate(() => ({ end: window.__watchEnd, trail: window.__dd.run.trail.slice(-4), karma: window.__dd.run.karma.karma }));
      if (end.end !== "Passed" || !end.trail.includes("n_egg")) throw new Error(JSON.stringify(end));
      const words = await page.evaluate(() => (document.querySelector("#watchBox .wcard .etext") || {}).textContent || "");
      if (words !== "Every room passed, Riko. The report goes in tomorrow.") throw new Error("the title card's words: " + JSON.stringify(words));
    });
  });

  await step("the doll's trigger cutscene: taken in the library, the flow jumps to her scene and the bad ending", async () => {
    await page.evaluate(([n, s]) => { window.__watchEnd = null; window.__dd.watch(n, s); }, ["n_library", snapFor("n_library")]);
    await atNode("n_library");
    await place(1.5, 22.5, 180); await enterRoom("door_library", "library");
    await use("doll_pickup", 0.6);
    await scene();
    await until(() => window.__watchEnd, null, "the ending", 120000);
    if ((await page.evaluate(() => window.__watchEnd)) !== "She wanted her back") throw new Error("ending " + await page.evaluate(() => window.__watchEnd));
  });

  if (shot) await page.screenshot({ path: shot });
  if (errors.length) fail("page errors: " + errors.join(" | "));
  await browser.close();
  console.log(`TESTROOM ok (${((Date.now() - t0) / 60000).toFixed(1)} min)`);
})().catch(e => fail(e.stack || e.message));

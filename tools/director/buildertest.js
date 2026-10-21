// The scene builder in a headless browser: every reference layout loads with nothing to fix and passes the story
// and level checks; the player walks (and a wall stops them); a room and a door are added; a layout saves into a
// scratch game (made and removed here) and reads back the same. Ends "BUILDER ok".
//
//   python tools/director/serve.py          (in another shell)
//   node tools/director/buildertest.js [shots dir]
//
// Needs Playwright (npm i playwright, or PLAYWRIGHT=<path to its package>).
const fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const URL = process.env.DESK_URL || "http://127.0.0.1:8780/";
const ROOT = path.resolve(__dirname, "../..");
const SCRATCH = "Zz_builder_test";

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/favicon|WebGL|GPU stall/i.test(m.text())) errors.push(m.text()); });
  const fail = msg => { console.log("FAIL " + msg); process.exitCode = 1; };
  page.on("dialog", d => d.accept());
  const shots = process.argv[2];
  if (shots) fs.mkdirSync(shots, { recursive: true });

  // a scratch game to save into
  const made = await (await fetch(URL + "api/new/" + SCRATCH, { method: "POST" })).json();
  if (!(made.games || []).includes(SCRATCH)) throw new Error("couldn't make the scratch game: " + JSON.stringify(made));
  try {
    await page.goto(URL + "builder.html");
    await page.waitForFunction(() => window.__builderReady, null, { timeout: 60000 });
    await page.selectOption("#game", SCRATCH);
    await page.waitForFunction(g => window.B && window.B.game === g && window.B.plan, SCRATCH, { timeout: 30000 })
      .catch(async e => { throw new Error("the scratch game didn't open: " + JSON.stringify(await page.evaluate(() => ({ game: window.B.game, status: document.querySelector("#status").textContent, options: [...document.querySelectorAll("#game option")].map(o => o.value) })))); });

    const presets = await page.evaluate(() => [...document.querySelectorAll("#preset option")].map(o => o.value).filter(Boolean));
    for (const id of presets) {
      await page.evaluate(id => { window.B.dirty = false; window.builder.openPreset(id); }, id);
      await page.waitForFunction(() => window.B.plan && window.B.planStory && window.B.planStory.levels[window.B.target], null, { timeout: 30000 });
      await page.waitForTimeout(400);
      const r = await page.evaluate(async () => {
        const chk = await window.builder.runChecks();
        const st = window.BM.stats(window.B.model, window.B.exported.level);
        return { problems: window.B.exported.problems, errors: chk.errors, rooms: st.rooms, area: Math.round(st.total), loops: st.loops, unreachable: st.unreachable,
                 walls: window.B.plan.pieces.filter(p => p.kind === "wall").length };
      });
      console.log(id.padEnd(7), `${r.rooms} rooms, ${r.area} m², ${r.loops} loops, ${r.walls} wall pieces`);
      if (r.problems.length) fail(`${id}: ${r.problems.join("; ")}`);
      if (r.errors.length) fail(`${id}: checks: ${r.errors.slice(0, 4).join("; ")}`);
      if (r.unreachable.length) fail(`${id}: unreachable ${r.unreachable.join(", ")}`);
      if (shots) await page.screenshot({ path: path.join(shots, `builder_${id}.png`) });
    }

    // walking: forward from the start for a while; a wall must stop the player (they never leave the rooms)
    const walk = await page.evaluate(async () => {
      const B = window.B, p = B.model.player, x0 = p.x, y0 = p.y;
      document.querySelector("#view").focus();
      document.querySelector("#view").dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", bubbles: true }));
      await new Promise(r => setTimeout(r, 2500));
      document.querySelector("#view").dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW", bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      const inRoom = window.BM.roomAt(B.model, p.x, p.y, p.z);
      return { moved: Math.hypot(p.x - x0, p.y - y0), inRoom: inRoom && inRoom.id };
    });
    console.log("walk", walk.moved.toFixed(2), "m, ends in", walk.inRoom);
    if (!(walk.moved > 0.3)) fail("the player didn't walk");
    if (!walk.inRoom) fail("the player walked out of the rooms (a wall didn't stop them)");

    // add a room beside the plan and a door into it; the door must link it
    const add = await page.evaluate(() => {
      const B = window.B, rs = B.model.rooms.filter(r => Math.abs(r.z) < 0.3);
      const east = rs.reduce((a, r) => (r.x + r.w > a.x + a.w ? r : a));
      window.builder.addRoom("closet");
      const c = B.model.rooms[B.model.rooms.length - 1];
      c.x = east.x + east.w; c.y = east.y; c.w = 1.2; c.d = Math.min(1.5, east.d); window.builder.changed();
      window.builder.addOpening(c.x, c.y + c.d / 2, "door");
      const lv = B.exported.level;
      return { links: lv.links.filter(l => l.a === c.id || l.b === c.id).length, problems: B.exported.problems };
    });
    if (add.links !== 1) fail(`the added closet has ${add.links} links: ${add.problems.join("; ")}`);

    // the finish: skirting and casings in the plan, a light and its switch per room, the trim on the level
    await page.evaluate(() => { window.B.dirty = false; window.builder.openPreset("3ldk"); });
    await page.waitForFunction(() => window.B.planStory && window.B.planStory.levels[window.B.target], null, { timeout: 30000 });
    await page.waitForTimeout(500);
    const fin = await page.evaluate(() => {
      const P = window.B.plan.pieces, lv = window.B.exported.level;
      const props = lv.rooms.flatMap(r => r.props || []);
      return { skirting: P.filter(p => p.tags.includes("trim:skirting")).length, casing: P.filter(p => p.tags.includes("trim:casing")).length,
               lights: P.filter(p => p.kind === "light").length, switches: props.filter(p => p.use === "switch").length, items: props.filter(p => p.id.includes("_wi_")).length, trim: lv.trim };
    });
    console.log("finish", JSON.stringify(fin));
    if (!(fin.skirting > 20 && fin.casing > 20 && fin.lights >= 8 && fin.switches >= 6 && fin.items >= 4 && fin.trim && fin.trim.skirting)) fail("finish " + JSON.stringify(fin));

    // a wall item clicked into the LDK's south-west corner area
    const wi = await page.evaluate(() => {
      const B = window.B, r = B.model.rooms.find(x => x.kind === "ldk");
      window.builder.addItem(r.x + 0.2, r.y + r.d / 2);                 // near its west wall
      const it = B.model.items[B.model.items.length - 1];
      return { wall: it.wall, room: it.room, inLevel: B.exported.level.rooms.find(x => x.id === r.id).props.some(p => p.id === it.id), problems: B.exported.problems };
    });
    if (wi.wall !== "w" || !wi.inLevel) fail("wall item " + JSON.stringify(wi));

    // a reference window: a model made here (78 x 117 cm, 7 cm deep, in centimetres as from Unreal), the wall cut to it
    const ref = await page.evaluate(async () => {
      const THREE = await import("three");
      const { GLTFExporter } = await import("./vendor/GLTFExporter.js");
      const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xffffff });
      for (const [w, h, d, x, y] of [[78, 5, 7, 0, 56], [78, 5, 7, 0, -56], [5, 117, 7, -36.5, 0], [5, 117, 7, 36.5, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, 0); g.add(b); }
      const glb = await new GLTFExporter().parseAsync(g, { binary: true });
      await window.builder.loadRef(new File([glb], "window_test.glb"));
      const B = window.B, r = B.model.rooms.find(x => x.kind === "bedroom");
      window.builder.setTool("ref");
      window.builder.addOpening(r.x + r.w / 2, r.y + 0.05, "ref");    // its south wall
      const op = B.model.ops[B.model.ops.length - 1];
      await new Promise(res => setTimeout(res, 1200));
      const refs = window.B.plan ? 1 : 0;
      return { ref: { w: B.ref.w, h: B.ref.h, d: B.ref.d, type: B.ref.type }, op: { w: op.w, h: op.h, sill: op.sill, type: op.type, ref: op.ref }, problems: B.exported.problems };
    });
    console.log("reference", JSON.stringify(ref));
    if (Math.abs(ref.op.w - 0.78) > 0.001 || Math.abs(ref.op.h - 1.17) > 0.001 || ref.op.type !== "window" || ref.op.ref !== "window_test") fail("reference cut " + JSON.stringify(ref));
    const chk = await page.evaluate(() => window.builder.runChecks());
    if (chk.errors.length) fail("after the finish, the item and the cut-out: " + chk.errors.slice(0, 3).join("; "));
    if (shots) await page.screenshot({ path: path.join(shots, "builder_finish.png") });

    // save the house into the scratch game and read it back
    await page.evaluate(() => { window.builder.openPreset("house"); });
    await page.waitForTimeout(600);
    await page.evaluate(() => window.builder.save(false));
    await page.waitForTimeout(800);
    const saved = JSON.parse(fs.readFileSync(path.join(ROOT, "Content/Games", SCRATCH, "story.json"), "utf8"));
    const lv = Object.entries(saved.levels).find(([k]) => k.startsWith("home_house"));
    if (!lv) fail("the house wasn't saved into the story");
    else {
      const n = lv[1].rooms.length, kinds = new Set(lv[1].rooms.map(r => r.kind)).size;
      console.log("saved", lv[0], n, "rooms,", kinds, "kinds,", lv[1].links.length, "links");
      if (n < 20) fail("saved house has only " + n + " rooms");
    }
    if (shots) {
      await page.evaluate(() => { document.querySelector("#eye").value = "stand"; window.builder.render3d(); });
      await page.screenshot({ path: path.join(shots, "builder_saved.png") });
    }
  } finally {
    fs.rmSync(path.join(ROOT, "Content/Games", SCRATCH), { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, "Saved/Story", SCRATCH), { recursive: true, force: true });
  }
  if (errors.length) fail("page errors: " + [...new Set(errors)].slice(0, 5).join(" | "));
  await browser.close();
  if (!process.exitCode) console.log("BUILDER ok");
})().catch(e => { console.log("FAIL " + e.stack); process.exit(1); });

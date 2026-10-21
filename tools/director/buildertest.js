// The scene builder in a headless browser: every reference layout loads with nothing to fix and passes the story
// and level checks; the player walks (and a wall stops them); a room and a door are added; the finish, wall items,
// a reference cut-out and the kit (furniture, fittings, floors, a ceiling step, window frames, curtains) pass and
// read back; a layout saves into a scratch game (made and removed here) and reads back the same; the desk reloads,
// another game's level is borrowed, the desk's deep link shows its marks. Ends "BUILDER ok".
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
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), page = await ctx.newPage();
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

    // the kit: furniture against a wall, a downlight, a wall fitting, a ceiling step, a window frame and curtains;
    // they pass the checks, the plan builds them, and a saved level reads back the same
    const kt = await page.evaluate(async () => {
      const B = window.B, bu = window.builder, BMm = window.BM;
      B.dirty = false; bu.openPreset("1ldk");
      const ldk = B.model.rooms.find(r => r.kind === "ldk");
      bu.setKitPreset("kit", "sofa_3"); bu.addKit(ldk.x + ldk.w - 0.3, ldk.y + ldk.d / 2);
      const sofa = B.model.kits[B.model.kits.length - 1];
      bu.setKitPreset("kit", "downlight_100"); bu.addKit(ldk.x + 1, ldk.y + 1);
      const dl = B.model.kits[B.model.kits.length - 1];
      bu.addItem(ldk.x + 0.6, ldk.y + ldk.d - 0.1, "socket_jp_2");
      ldk.ceilKit = { preset: "ceiling_step" };
      const win = B.model.ops.find(o => o.type === "window" && BMm.sides(B.model, o).some(q => q.room === ldk));
      bu.addCurtains(win);
      bu.changed();
      await new Promise(r => setTimeout(r, 1500));
      const lvl = B.exported.level, props = lvl.rooms.flatMap(r => (r.props || []).map(p => Object.assign({ room: r.id }, p)));
      // its front corner dragged 30 cm out into the room: deeper, its back still at the wall; then a variation, same size
      const back0 = +(ldk.w - sofa.x - sofa.size[1] / 2).toFixed(3), w0 = sofa.size[0];
      const a = sofa.rot * Math.PI / 180, fx = ldk.x + sofa.x + Math.sin(a) * (sofa.size[1] / 2 + 0.3) + Math.cos(a) * sofa.size[0] / 2;
      const fy = ldk.y + sofa.y - Math.cos(a) * (sofa.size[1] / 2 + 0.3) + Math.sin(a) * sofa.size[0] / 2;
      bu.resizeKitBy(sofa.id, 1, -1, fx, fy);
      const resized = { d: sofa.size[1], w: sofa.size[0], back: +(ldk.w - sofa.x - sofa.size[1] / 2).toFixed(3), back0, w0 };
      const spec0 = JSON.stringify(sofa.spec), size0 = JSON.stringify(sofa.size);
      bu.varyKit(sofa);
      const varied = { changed: JSON.stringify(sofa.spec) !== spec0, sameSize: JSON.stringify(sofa.size) === size0 };
      // a cushion clicked onto the sofa lands on its seat; every doorway gets a kit door (leaf, handle, frame)
      bu.setKitPreset("kit", "throw_pillow"); bu.addKit(ldk.x + sofa.x, ldk.y + sofa.y);
      const pil = B.model.kits[B.model.kits.length - 1], cushion = { z: pil.z, on: (pil.extra || {}).on, sofa: sofa.id };
      for (const op of B.model.ops) if (op.type === "door" || op.type === "slide") op.extra = Object.assign({}, op.extra, { kit: { preset: op.type === "slide" ? "door_slide" : "door_shaker", handle: "bar_pull" } });
      bu.changed();
      await new Promise(r => setTimeout(r, 1200));
      const back = BMm.levelToModel({ levels: { t: B.exported.level } }, "t");
      const parts = B.plan.pieces.filter(q => q.tags.some(t => t.startsWith("door_part:"))).map(q => q.tags.find(t => t.startsWith("door_part:")).slice(10));
      const doorsN = B.model.ops.filter(o => o.type === "door" || o.type === "slide").length;
      return { cushion, doors: { n: doorsN, leaves: parts.filter(x => x === "leaf").length, handles: parts.filter(x => x === "handle").length, frames: parts.filter(x => x === "frame").length }, resized, varied, sofa: [+(ldk.w - sofa.x).toFixed(3), sofa.rot], dl: [dl.z, dl.size[2], ldk.h], problems: B.exported.problems,
               kitProps: props.filter(p => p.kit).length, floors: props.filter(p => /_fx_floor$/.test(p.id)).length, frames: props.filter(p => /_fx_win\d+$/.test(p.id)).length,
               pieces: B.plan.pieces.filter(q => q.tags.some(t => t.startsWith("kit:"))).length,
               back: { kits: back.kits.length, fits: back.items.filter(i => i.kind === "fit").length, floors: back.rooms.filter(r => r.floorKit).length,
                       ceil: back.rooms.filter(r => r.ceilKit).length, frames: back.ops.filter(o => o.frame).length },
               model: { kits: B.model.kits.length, fits: B.model.items.filter(i => i.kind === "fit").length, floors: B.model.rooms.filter(r => r.floorKit).length,
                        ceil: B.model.rooms.filter(r => r.ceilKit).length, frames: B.model.ops.filter(o => o.frame).length },
               chk: await bu.runChecks() };
    });
    console.log("kit", JSON.stringify(Object.assign({}, kt, { chk: kt.chk.errors.length + " errors" })));
    if (kt.chk.errors.length) fail("the kit: " + kt.chk.errors.slice(0, 3).join("; "));
    if (kt.problems.length) fail("the kit's problems: " + kt.problems.join("; "));
    if (Math.abs(kt.resized.d - 1.22) > 0.011 || kt.resized.back !== kt.resized.back0 || kt.resized.w !== kt.resized.w0) fail("dragging the sofa's front corner: " + JSON.stringify(kt.resized));
    if (!kt.varied.changed || !kt.varied.sameSize) fail("varying the sofa: " + JSON.stringify(kt.varied));
    if (Math.abs(kt.cushion.z - 0.42) > 0.001 || kt.cushion.on !== kt.cushion.sofa) fail("a cushion on the sofa: " + JSON.stringify(kt.cushion));
    if (!kt.doors.n || kt.doors.leaves !== kt.doors.n || kt.doors.handles !== kt.doors.n || kt.doors.frames !== kt.doors.n) fail("the kit doors: " + JSON.stringify(kt.doors));
    if (kt.sofa[0] > 0.9 || kt.sofa[1] !== 270) fail("the sofa didn't go back to the east wall facing west: " + kt.sofa);
    if (Math.abs(kt.dl[0] + kt.dl[1] - kt.dl[2]) > 0.001) fail("the downlight isn't on the ceiling: " + kt.dl);
    if (!kt.floors || !kt.frames || kt.pieces < kt.kitProps) fail("floors, frames or kit pieces missing: " + JSON.stringify(kt));
    if (JSON.stringify(kt.back) !== JSON.stringify(kt.model)) fail("the level doesn't read back the same: " + JSON.stringify(kt.back) + " vs " + JSON.stringify(kt.model));

    // a hinge of yours: loaded as a reference, clicked onto a door: its mortises are cut to it, it's split at its
    // barrel, the door's half rides the leaf when it swings and the frame's half stays
    const hg = await page.evaluate(async () => {
      const THREE = await import("three"), { GLTFExporter } = await import("./vendor/GLTFExporter.js");
      const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0x886633 });
      for (const sx of [-1, 1]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.0025), mat); pl.position.set(sx * 0.0215, 0, 0.00125); g.add(pl); }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.1, 24), mat); bar.position.set(0, 0, 0.0025); g.add(bar);
      const buf = await new GLTFExporter().parseAsync(g, { binary: true });
      const B = window.B, bu = window.builder;
      await bu.loadRef(new File([buf], "test_hinge.glb"));
      const ref = B.ref, door = B.model.ops.find(o => o.type === "door" && Math.abs(o.z) < 0.3);
      const [dx, dy] = door.axis === "y" ? [door.c, door.v] : [door.v, door.c];
      await bu.applyHingeAt(dx, dy);
      await new Promise(r => setTimeout(r, 1500));
      const kit = door.extra.kit, parts = B.plan.pieces.filter(q => q.tags.includes(`door:${door.id}`)).map(q => (q.tags.find(t => t.startsWith("door_part:")) || "").slice(10));
      const st = window.__stage || null;
      const chk = await bu.runChecks();
      bu.swing(0);
      const objs = () => { const o = {}; window.__builderStage.world.traverse(m => { if (m.userData && m.userData.id && m.userData.id.startsWith(door.id)) o[m.userData.id] = [m.position.x, m.position.z, m.rotation.y]; }); return o; };
      const before = objs(); bu.swing(90); const after = objs(); bu.swing(0);
      const moved = id => before[id] && after[id] && Math.hypot(after[id][0] - before[id][0], after[id][1] - before[id][1]) > 0.001;
      const turned = id => before[id] && after[id] && Math.abs(Math.abs(after[id][2] - before[id][2]) - Math.PI / 2) < 0.01;
      // the leaf turns about its hinges: its hinge-side edge stays (nearly) put while its other edge sweeps ~a door's width
      return { type: ref.type, kit: { h: kit.hinge_h, w: kit.hinge_w, t: kit.hinge_t, art: kit.hinge_art }, parts, errors: chk.errors,
               leaf: turned(door.id), handle: turned(door.id + "__handle"), doorHalf: turned(door.id + "__hinge1_door"), frameHalf: moved(door.id + "__hinge1_frame") || turned(door.id + "__hinge1_frame") };
    });
    console.log("hinge", JSON.stringify(hg));
    if (hg.type !== "hinge" || Math.abs(hg.kit.h - 0.1) > 0.002 || Math.abs(hg.kit.t - 0.0025) > 0.0002 || !/^local\/hinge_test_hinge$/.test(hg.kit.art)) fail("the hinge reference: " + JSON.stringify(hg.kit));
    if (hg.parts.filter(p => p === "hinge_door").length !== 3 || hg.parts.filter(p => p === "hinge_frame").length !== 3) fail("the split hinge's halves aren't placed: " + JSON.stringify(hg.parts));
    if (hg.errors.length) fail("with the hinge: " + hg.errors.slice(0, 3).join("; "));
    if (!hg.leaf || !hg.handle || !hg.doorHalf || hg.frameHalf) fail("swinging the door: " + JSON.stringify(hg));
    if (shots) { await page.evaluate(() => { const B = window.B, r = B.model.rooms.find(r => r.kind === "ldk"); Object.assign(B.model.player, { x: r.x + r.w * 0.75, y: r.y + r.d * 0.8, yaw: 200 }); window.builder.render3d(); }); await page.waitForTimeout(600); await page.screenshot({ path: path.join(shots, "builder_kit.png") }); }
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

    // the round trip: a builder save reloads a desk open on the same game
    const desk = await ctx.newPage();   // the same context: a BroadcastChannel never crosses contexts
    desk.on("pageerror", e => errors.push("desk: " + e.message));
    await desk.goto(URL + "index.html?game=" + SCRATCH);
    await desk.waitForFunction(() => window.__dd && window.__dd.S && window.__dd.S.levels, null, { timeout: 30000 });
    await desk.waitForTimeout(500);
    const before = await desk.evaluate(() => Object.keys(window.__dd.S.levels));
    await page.evaluate(() => { window.B.dirty = false; window.builder.openPreset("1ldk"); });
    await page.waitForTimeout(600);
    await page.evaluate(() => window.builder.save(false));
    await desk.waitForFunction(n => Object.keys(window.__dd.S.levels).length > n, before.length, { timeout: 15000 })
      .catch(async () => fail("the desk didn't reload after the builder saved: " + JSON.stringify({ builder: await page.evaluate(() => document.querySelector("#status").textContent),
        desk: await desk.evaluate(() => [document.querySelector("#status").textContent, document.querySelector("#banner").style.display]) })));
    console.log("desk levels", before.length, "->", (await desk.evaluate(() => Object.keys(window.__dd.S.levels))).join(","));
    await desk.close();

    // another game's level as a start: Sample's house, with its people and the things it uses left behind
    await page.evaluate(() => { window.B.dirty = false; window.builder.openOther("Sample", "house"); });
    await page.waitForTimeout(600);
    const bor = await page.evaluate(async () => ({ target: window.B.target, rooms: window.B.model.rooms.length, chk: await window.builder.runChecks() }));
    console.log("borrowed", bor.target, bor.rooms, "rooms");
    if (!bor.rooms || bor.chk.errors.length) fail("borrowed level: " + JSON.stringify(bor).slice(0, 300));

    // a deep link from the desk: Sample's house with a node's marks, and the script panel
    const node = Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, "Content/Games/Sample/story.json"), "utf8")).flow).find(([, n]) => n.type === "scene")[0];
    await page.goto(URL + `builder.html?game=Sample&level=house&node=${node}`);
    await page.waitForFunction(() => window.__builderReady && window.B.game === "Sample" && window.B.plan, null, { timeout: 60000 });
    const mk = await page.evaluate(() => ({ focus: window.B.focus, level: window.B.target, here: window.builder.nodesHere().length,
      rows: document.querySelectorAll("#script button").length, hot: window.builder.focusIds().size,
      marks: document.querySelectorAll("#plan path[fill='#ff6b5a'], #plan path[fill='#8fd18f'], #plan path[fill='#6fb3d9']").length }));
    console.log("deep link", JSON.stringify(mk));
    if (mk.focus !== node || mk.level !== "house" || !mk.here || !mk.rows || !mk.marks) fail("the deep link and marks: " + JSON.stringify(mk));
    if (shots) await page.screenshot({ path: path.join(shots, "builder_marks.png") });

    // the kit maker: every type at its defaults, a preset exploded into parts, a glb export
    const km = await ctx.newPage();
    km.on("pageerror", e => errors.push("kit maker: " + e.message));
    await km.goto(URL + "kit.html");
    await km.waitForFunction(() => window.__kitReady, null, { timeout: 60000 });
    const kr = await km.evaluate(() => {
      const KM = window.kitmaker, out = { types: 0, parts: 0 };
      for (const o of [...document.querySelectorAll("#newType option")].filter(o => o.value)) { const s = document.querySelector("#newType"); s.value = o.value; s.onchange(); out.types++; }
      KM.openPreset("vanity_drawers"); out.vars = KM.showVariations(1).length; out.thumbs = document.querySelectorAll("#vStrip figure").length;
      document.querySelector("#vStrip figure").click(); out.varOf = KM.K.varOf;
      KM.openPreset("vanity_drawers"); KM.explode(); out.parts = KM.K.spec.parts.length; out.type = KM.K.spec.type;
      out.rows = document.querySelectorAll(".kf-card").length;
      return out;
    });
    console.log("kit maker", JSON.stringify(kr));
    if (kr.types < 18 || kr.type !== "parts" || !kr.parts || kr.rows !== kr.parts || kr.vars !== 6 || kr.thumbs !== 6 || kr.varOf !== "vanity_drawers") fail("the kit maker: " + JSON.stringify(kr));
    // a corner handle dragged with the mouse: the box grows, the parts with it
    await km.evaluate(() => { const K = window.kitmaker; K.openPreset("dining_chair"); K.render(); });
    const [hx, hy] = await km.evaluate(() => window.kitmaker.screenOf(window.kitmaker.handleAt("xz", 1, 1)));
    const s0 = await km.evaluate(() => window.kitmaker.K.spec.size);
    await km.mouse.move(hx, hy); await km.mouse.down(); await km.mouse.move(hx + 25, hy + 10); await km.mouse.move(hx + 50, hy + 20); await km.mouse.up();
    const s1 = await km.evaluate(() => ({ size: window.kitmaker.K.spec.size, leg: window.kitmaker.K.spec.parts[0].size[0] }));
    console.log("kit handle", JSON.stringify(s0), "->", JSON.stringify(s1));
    if (JSON.stringify(s1.size) === JSON.stringify(s0) || s1.size[2] !== s0[2]) fail("dragging the kit maker's corner handle: " + JSON.stringify([s0, s1]));
    if (shots) await km.screenshot({ path: path.join(shots, "kit_maker.png") });
    await km.close();

    // the PBR shelf (docs/ASSETS.md §6): when it has sets (`python tools/pbr.py demo`), each one dresses the preview
    const shelf = await (await fetch(URL + "api/pbr")).json();
    const refs = Object.keys(shelf.sets || {});
    if (!refs.length) console.log("pbr shelf: empty, skipped (`python tools/pbr.py demo` makes sets to test on)");
    else {
      const pp = await ctx.newPage();
      pp.on("pageerror", e => errors.push("pbr: " + e.message));
      await pp.goto(URL + "pbr.html");
      await pp.waitForFunction(n => window.__pbr && Object.keys(window.__pbr.S.sets).length === n, refs.length, { timeout: 30000 });
      await pp.evaluate(() => window.__pbr.stop());
      const out = {};
      for (const shape of ["sphere", "cube", "room", "plane"]) {
        await pp.evaluate(([r, s]) => { window.__pbr.select(r); window.__pbr.shape(s); }, [refs[0], shape]);
        await pp.waitForTimeout(1500);
        out[shape] = await pp.evaluate(() => { let maps = 0; window.__pbrScene.traverse(o => { if (o.isMesh && o.material.map && o.material.map.image) maps++; }); return maps; });
      }
      const cards = await pp.evaluate(() => document.querySelectorAll("#list figure").length);
      console.log("pbr shelf", refs.length, "sets,", cards, "cards, textured meshes", JSON.stringify(out));
      if (cards !== refs.length || Object.values(out).some(n => !n)) fail("the PBR shelf: " + JSON.stringify({ cards, out }));
      if (shots) await pp.screenshot({ path: path.join(shots, "pbr_shelf.png") });
      await pp.close();
    }
  } finally {
    for (const f of fs.existsSync(path.join(ROOT, "Content/Studio/Library/meshes/local")) ? fs.readdirSync(path.join(ROOT, "Content/Studio/Library/meshes/local")) : [])
      if (f.startsWith("hinge_test_hinge_")) fs.rmSync(path.join(ROOT, "Content/Studio/Library/meshes/local", f));
    const li = path.join(ROOT, "Content/Studio/Library/index/local.json");
    if (fs.existsSync(li)) { const j = JSON.parse(fs.readFileSync(li, "utf8")); for (const k of Object.keys(j)) if (k.startsWith("hinge_test_hinge_")) delete j[k]; fs.writeFileSync(li, JSON.stringify(j, null, 1)); }
    fs.rmSync(path.join(ROOT, "Content/Games", SCRATCH), { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, "Saved/Story", SCRATCH), { recursive: true, force: true });
  }
  if (errors.length) fail("page errors: " + [...new Set(errors)].slice(0, 5).join(" | "));
  await browser.close();
  if (!process.exitCode) console.log("BUILDER ok");
})().catch(e => { console.log("FAIL " + e.stack); process.exit(1); });

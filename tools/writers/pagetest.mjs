// WRITERSPAGE: the writers' room's page in a headless browser, on its own server and a scratch home (WRITERS_HOME), so
// your sessions are never touched. A new session; shapes dragged from the palette onto the chart and titled where they
// land; joined by dragging from a dot (and from a dot into empty space, making the next one there); the inspector: the
// gist, someone new, a talk's question and answers; a choice whose arrows are labelled on the chart; two endings;
// undo and redo; copy, paste and delete; an act round the picked shapes; every change saved to the session's file;
// the problems at their shapes; the About tab; Build into the scratch home with the story check ok. Then Claude's side
// (/chart): a script read in by room.py shows on the page with each shape's script in the inspector, and read in again
// while the page is open it's taken in by itself, a shape moved on the page keeping its place, Ctrl+Z going back.
//   node tools/writers/pagetest.mjs           (WRITERS_TEST_PORT for another port than 8796)
import { createRequire } from "module";
import { spawn, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import net from "net";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const PORT = +(process.env.WRITERS_TEST_PORT || 8796), PAGE = `http://127.0.0.1:${PORT}`;
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "writers-page-"));
const fails = [], ok = m => console.log("  ok  " + m), fail = m => { fails.push(m); console.log("  FAIL " + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const free = port => new Promise(r => { const s = net.createConnection(port, "127.0.0.1"); s.on("connect", () => { s.destroy(); r(false); }); s.on("error", () => r(true)); });

if (!(await free(PORT))) { console.log(`port ${PORT} is taken: WRITERS_TEST_PORT=<another> node tools/writers/pagetest.mjs`); process.exit(1); }
const srv = spawn(process.env.PYTHON || "python3", ["tools/writers/serve.py"], { cwd: ROOT, env: Object.assign({}, process.env, { WRITERS_PORT: String(PORT), WRITERS_HOME: HOME }), stdio: ["ignore", "pipe", "pipe"] });
let srvOut = ""; srv.stdout.on("data", d => srvOut += d); srv.stderr.on("data", d => srvOut += d);
for (let i = 0; i < 40 && await free(PORT); i++) await sleep(150);

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1500, height: 920 } })).newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));
const step = async (what, fn) => { try { await fn(); ok(what); } catch (e) { fail(`${what}: ${e.message.split("\n")[0]}`); await page.screenshot({ path: path.join(HOME, "fail.png") }).catch(() => { }); } };
const P = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__wr.P)));
const onDisk = (sid = null) => { const d = path.join(HOME, "Prototypes"); sid = sid || fs.readdirSync(d)[0]; return JSON.parse(fs.readFileSync(path.join(d, sid, "prototype.json"), "utf8")); };
const room = (...args) => {                         // room.py on the scratch home, as Claude runs it
  const r = spawnSync(process.env.PYTHON || "python3", ["tools/writers/room.py", ...args], { cwd: ROOT, env: Object.assign({}, process.env, { WRITERS_HOME: HOME }), encoding: "utf8" });
  if (r.status !== 0) throw new Error((r.stdout + r.stderr).slice(-400));
  return r.stdout;
};
const saved = async () => { await page.evaluate(() => window.__wr.flush()); await page.waitForFunction(() => document.querySelector("#saved").textContent === "saved", null, { timeout: 8000 }); };
const shape = id => page.locator(`.shape[data-id="${id}"]`);
const chartAt = async (fx, fy) => { const b = await page.locator("#chart").boundingBox(); return { x: b.x + b.width * fx, y: b.y + b.height * fy }; };
const ids = async type => (await P()).nodes.filter(n => n.type === type).map(n => n.id);
async function drop(type, fx, fy) {                 // a shape from the palette onto the chart, then its title typed there
  const before = new Set((await P()).nodes.map(n => n.id)), at = await chartAt(fx, fy), cb = await page.locator("#chart").boundingBox();
  await page.dragAndDrop(`.pal-i.${type}`, "#chart", { targetPosition: { x: at.x - cb.x, y: at.y - cb.y } });
  await page.waitForFunction(n => window.__wr.P.nodes.length > n, before.size, { timeout: 5000 });
  return (await P()).nodes.find(n => !before.has(n.id)).id;
}
async function typeTitle(text) { await page.waitForSelector(".sh-title.editing, .sh-text.editing", { timeout: 4000 }); await page.keyboard.type(text); await page.keyboard.press("Enter"); }
async function link(from, to, side = "e") {        // a dot of one shape dragged onto another
  await shape(from).hover();
  const p = await shape(from).locator(`.port.${side}`).boundingBox(), t = await shape(to).boundingBox();
  await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2); await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 }); await page.mouse.up();
}

try {
  await page.goto(PAGE);
  await step("a new session from the first dialog: the chart opens with its start", async () => {
    await page.waitForSelector("#modal.on .dlg", { timeout: 8000 });
    await page.fill("#modal input", "Page Test"); await page.fill("#modal textarea", "a friend asks you to stay");
    await page.click("#modal .go");
    await page.waitForSelector('.shape.start', { timeout: 8000 });
    const p = await P(); if (p.title !== "Page Test" || p.brief.kind !== "a friend asks you to stay") throw new Error(JSON.stringify(p.brief));
    await page.evaluate(() => { const c = window.__wr.chart; c.view = { x: 30, y: 40, z: 0.6 }; c.apply(); });   // room to lay out a story
  });
  let sc, tk, ch, e1, e2;
  await step("shapes dragged from the palette, titled where they land", async () => {
    sc = await drop("scene", 0.25, 0.4); await typeTitle("The door opens");
    const p = await P(), n = p.nodes.find(x => x.id === sc);
    if (n.title !== "The door opens" || n.type !== "scene") throw new Error(JSON.stringify(n));
    if (!(await shape(sc).textContent()).includes("The door opens")) throw new Error("not drawn");
  });
  await step("joined by dragging from a dot to the next shape", async () => {
    await link("start", sc);
    const p = await P(); if (!p.edges.some(e => e.from === "start" && e.to === sc)) throw new Error(JSON.stringify(p.edges));
    if (!(await page.locator(".cedges path.edge").count())) throw new Error("no arrow drawn");
  });
  await step("a dot dragged into empty space makes the next shape there, joined", async () => {
    await shape(sc).hover();
    const p0 = await shape(sc).locator(".port.e").boundingBox(), at = await chartAt(0.45, 0.4);
    await page.mouse.move(p0.x + 6, p0.y + 6); await page.mouse.down(); await page.mouse.move(at.x, at.y, { steps: 8 }); await page.mouse.up();
    await page.click(".cmenu .cmenu-i.talk");
    await typeTitle("Across the table");
    const p = await P(); tk = p.nodes.find(n => n.type === "talk").id;
    if (!p.edges.some(e => e.from === sc && e.to === tk)) throw new Error("not joined");
  });
  await step("the inspector: the gist, someone new, the talk's question and answers", async () => {
    await shape(tk).click();
    await page.waitForSelector("#inspector .ih .t", { timeout: 3000 });
    await page.locator("#inspector textarea").first().fill("She asks about the shut room.");
    await page.click("#inspector button:has-text('+ someone new')");
    await page.fill("#modal input", "Hana"); await page.click("#modal .go");
    await page.waitForFunction(() => (window.__wr.P.cast || []).some(c => c.name === "Hana"), null, { timeout: 3000 });
    await page.waitForSelector("#inspector input[placeholder^='Walt said']", { timeout: 3000 });
    await page.locator("#inspector .two.ask select").selectOption("hana");
    await page.fill("#inspector input[placeholder^='Walt said']", "Do you remember her room?");
    const says = page.locator("#inspector input[placeholder^='what you do or say']");
    await says.nth(0).fill("Of course I do."); await says.nth(1).fill("Whose room?");
    await saved();
    const n = onDisk().nodes.find(x => x.id === tk);
    if (n.text !== "She asks about the shut room." || !n.who.includes("hana") || n.talk.line.text !== "Do you remember her room?" || n.talk.options[1].say !== "Whose room?")
      throw new Error(JSON.stringify(n));
  });
  await step("a choice and two endings; its arrows labelled on the chart", async () => {
    ch = await drop("choice", 0.65, 0.4); await typeTitle("Open the door?");
    await link(tk, ch);
    e1 = await drop("ending", 0.88, 0.15); await typeTitle("Let her rest");
    e2 = await drop("ending", 0.88, 0.7); await typeTitle("The last bus");
    await link(ch, e1, "n"); await link(ch, e2, "s");
    const p = await P(), ways = p.edges.filter(e => e.from === ch);
    if (ways.length !== 2) throw new Error(JSON.stringify(ways));
    const w = ways.find(e => e.to === e1);
    const mid = await page.evaluate(id => {             // the arrow's own middle (a curve's box isn't on it)
      const pth = document.querySelector(`.cedges .ehit[data-edge="${id}"]`), q = pth.getPointAtLength(pth.getTotalLength() / 2), m = pth.getScreenCTM();
      return { x: m.a * q.x + m.c * q.y + m.e, y: m.b * q.x + m.d * q.y + m.f };
    }, w.id);
    await page.mouse.dblclick(mid.x, mid.y);
    await page.waitForSelector(".elabel-edit", { timeout: 3000 }); await page.keyboard.type("Open it"); await page.keyboard.press("Enter");
    const w2 = ways.find(e => e.to === e2);
    await page.evaluate(id => { const c = window.__wr.chart; c.editEdge(id); }, w2.id);
    await page.waitForSelector(".elabel-edit", { timeout: 3000 }); await page.keyboard.type("Walk away"); await page.keyboard.press("Enter");
    const q = await P(), kinds = q.nodes.filter(n => n.type === "ending").map(n => n.kind).sort();
    if (q.edges.find(e => e.id === w.id).label !== "Open it" || q.edges.find(e => e.id === w2.id).label !== "Walk away" || kinds.join() !== "intended,other") throw new Error(JSON.stringify(q.edges) + kinds);
    if (!(await page.locator(".cedges .elabel text", { hasText: "Open it" }).count())) throw new Error("the label isn't drawn");
  });
  await step("the problems show at their shape, and go when fixed", async () => {
    await saved();
    const before = await page.evaluate(() => window.__wr.check.errors.length);
    await page.evaluate(id => { const P = window.__wr.P; P.nodes.find(n => n.id === id).talk.options[0].say = ""; }, tk);
    await page.evaluate(() => window.__wr.flush());
    await page.waitForSelector(`.shape[data-id="${tk}"].p-error`, { timeout: 5000 });
    await page.click(".bar .probs"); await page.waitForSelector("#problems .e", { timeout: 3000 });
    await page.click("#problems .e"); const picked = await page.evaluate(() => [...window.__wr.chart.sel.nodes]);
    if (picked[0] !== tk) throw new Error("a problem's click picked " + picked);
    await page.evaluate(id => { const P = window.__wr.P; P.nodes.find(n => n.id === id).talk.options[0].say = "Of course I do."; }, tk);
    await page.evaluate(() => window.__wr.flush());
    await page.waitForFunction(() => window.__wr.check.errors.length === 0, null, { timeout: 5000 });
    if (before !== 0) throw new Error(`${before} errors before`);
  });
  await step("undo and redo", async () => {
    await saved();
    const n0 = (await P()).nodes.length;
    await shape(e2).click(); await page.keyboard.press("Delete");
    await page.waitForFunction(n => window.__wr.P.nodes.length === n - 1, n0, { timeout: 3000 });
    await page.click("#undo"); await page.waitForFunction(n => window.__wr.P.nodes.length === n, n0, { timeout: 5000 });
    await page.click("#redo"); await page.waitForFunction(n => window.__wr.P.nodes.length === n - 1, n0, { timeout: 5000 });
    await page.click("#undo"); await page.waitForFunction(n => window.__wr.P.nodes.length === n, n0, { timeout: 5000 });
    const q = await P(); if (!q.edges.some(e => e.to === e2)) throw new Error("the arrow didn't come back with it");
  });
  await step("copy and paste a shape (a new id), then delete it", async () => {
    const n0 = (await P()).nodes.length;
    await shape(sc).click(); await page.keyboard.press("Control+c"); await page.keyboard.press("Control+v");
    await page.waitForFunction(n => window.__wr.P.nodes.length === n + 1, n0, { timeout: 3000 });
    const q = await P(), copy = q.nodes[q.nodes.length - 1];
    if (copy.id === sc || copy.title !== "The door opens") throw new Error(JSON.stringify(copy));
    await page.keyboard.press("Delete");
    await page.waitForFunction(n => window.__wr.P.nodes.length === n, n0, { timeout: 3000 });
  });
  await step("an act round the picked shapes (Shift-drag picks them)", async () => {
    await page.click(".bar button:has-text('Fit')");          // all of it in view (going to a problem centred the talk)
    const a = await shape("start").boundingBox(), b = await shape(tk).boundingBox();
    await page.keyboard.down("Shift");
    await page.mouse.move(a.x - 20, Math.min(a.y, b.y) - 40); await page.mouse.down();
    await page.mouse.move(b.x + b.width + 20, Math.max(a.y + a.height, b.y + b.height) + 40, { steps: 10 }); await page.mouse.up();
    await page.keyboard.up("Shift");
    const picked = await page.evaluate(() => [...window.__wr.chart.sel.nodes]);
    if (!picked.includes(sc) || !picked.includes(tk)) throw new Error("picked " + picked);
    await page.click("#inspector button:has-text('Put an act round them')");
    await page.waitForSelector(".cframe-h .t[contenteditable=true]", { timeout: 3000 }); await page.keyboard.type("Night one"); await page.keyboard.press("Enter");
    await saved();
    const f = onDisk().frames[0]; if (!f || f.title !== "Night one") throw new Error(JSON.stringify(f));
    const inside = await page.evaluate(() => window.__wr.chart.inside(window.__wr.P.frames[0]));
    if (!inside.includes(sc) || !inside.includes(tk)) throw new Error("inside " + inside);
  });
  await step("a shape dragged: its place saved, its arrows follow", async () => {
    const b = await shape(sc).boundingBox(), x0 = (await P()).nodes.find(n => n.id === sc).x;
    await page.mouse.move(b.x + 40, b.y + 30); await page.mouse.down(); await page.mouse.move(b.x + 40, b.y + 130, { steps: 8 }); await page.mouse.up();
    await saved();
    const n = onDisk().nodes.find(x => x.id === sc);
    if (n.x !== x0 || n.y % 10 || Math.abs(n.y - (await P()).nodes.find(x => x.id === sc).y) > 0) throw new Error(JSON.stringify(n));
  });
  await step("About: the brief and the story's heart, saved", async () => {
    await page.click("#tabs button[data-tab=about]");
    await page.locator("#about textarea").nth(1).fill("A real story: a friend kept her grandmother's room shut.");
    await page.locator("#about input").nth(1).fill("Hana asks you to stay the weekend.");
    await saved();
    const d = onDisk(); if (!/grandmother/.test(d.brief.references) || d.story.logline !== "Hana asks you to stay the weekend.") throw new Error(JSON.stringify(d.story));
    await page.click("#tabs button[data-tab=faces]"); await page.waitForSelector(".face", { timeout: 3000 });
    await page.click("#tabs button[data-tab=flow]");
  });
  await step("what the page shows is written for Claude (now.json)", async () => {
    await shape(tk).click(); await sleep(700);
    const v = JSON.parse(fs.readFileSync(path.join(HOME, "Saved", "now.json"), "utf8"));
    if (v.tab !== "flow" || !(v.selected || []).includes(tk)) throw new Error(JSON.stringify(v));
  });
  await step("Build: a working outline in the director, the story check ok", async () => {
    await page.click("#buildBtn"); await page.waitForSelector("#modal.on .dlg", { timeout: 3000 });
    await page.fill("#modal input", "PageTest"); await page.click("#modal .go");
    await page.waitForFunction(() => /Built/.test((document.querySelector("#modal.on .dh") || {}).textContent || ""), null, { timeout: 120000 });
    const msg = await page.textContent("#modal .db");
    if (!/STORY ok/.test(msg)) throw new Error(msg.slice(0, 300));
    for (const f of ["story.json", "BUILD.md", "faces.md", "prototype.json"]) if (!fs.existsSync(path.join(HOME, "Games", "PageTest", f))) throw new Error("no " + f);
    const S = JSON.parse(fs.readFileSync(path.join(HOME, "Games", "PageTest", "story.json"), "utf8"));
    if (!S.flow[`n_${tk}`] || !S.flow[`n_${ch}`] || S.flow[`n_${ch}`].options.map(o => o.label).sort().join() !== "Open it,Walk away") throw new Error(JSON.stringify(S.flow[`n_${ch}`]));
    await page.keyboard.press("Escape");
  });
  let sid2, scr;
  await step("Claude's chart (/chart): a script read in by room.py opens here, each shape's script in the inspector, the answers with their thoughts", async () => {
    scr = path.join(HOME, "come.script.txt");
    fs.copyFileSync(path.join(ROOT, "tools", "writers", "script_example.txt"), scr);
    sid2 = /new session (\S+):/.exec(room("import", scr, "--notes", scr))[1];
    if (!fs.existsSync(path.join(HOME, "Prototypes", sid2, "notes.txt"))) throw new Error("the notes weren't kept");
    await page.evaluate(id => window.__wr.open(id), sid2);
    await page.waitForSelector('.shape[data-id="opening_ji"]', { timeout: 8000 });
    await page.evaluate(() => { const c = window.__wr.chart; c.pick({ nodes: ["opening_ji"] }); c.center("opening_ji"); });
    await page.waitForSelector("#inspector .script pre.lines", { timeout: 4000 });
    const t = await page.textContent("#inspector .script pre.lines");
    if (!/Ji: .*It's been so long/.test(t) || !/\*Enter Name\*/.test(t)) throw new Error(t.slice(0, 200));
    const thinks = await page.locator("#inspector input[placeholder^='your thought']").evaluateAll(xs => xs.map(x => x.value));
    if (!thinks.includes("She's probably cold, I should let her inside")) throw new Error(JSON.stringify(thinks));
  });
  await step("read in again while the page is open: taken in by itself, the shape moved here keeps its place, Ctrl+Z goes back", async () => {
    await page.evaluate(() => { const c = window.__wr.chart; c.pick({ nodes: [] }); c.center("tea"); });
    await sleep(300);
    const b = await shape("tea").boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + 12); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + 92, { steps: 8 }); await page.mouse.up();
    await saved();
    const moved = onDisk(sid2).nodes.find(n => n.id === "tea");
    fs.writeFileSync(scr, fs.readFileSync(scr, "utf8").replace(`"Her coat is still on. It's warm in here."`, `"Her coat is still on. It's warm in here."\n\n"She hasn't taken her shoes off either."`));
    room("import", scr, "--into", sid2);
    await page.waitForFunction(() => JSON.stringify(window.__wr.P).includes("shoes off"), null, { timeout: 10000 });
    const n = (await P()).nodes.find(x => x.id === "tea");
    if (n.x !== moved.x || n.y !== moved.y) throw new Error(`moved to ${moved.x},${moved.y}, after: ${n.x},${n.y}`);
    await page.locator("#chart").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+z");
    await page.waitForFunction(() => !JSON.stringify(window.__wr.P).includes("shoes off"), null, { timeout: 5000 });
    await saved();
    if (JSON.stringify(onDisk(sid2)).includes("shoes off")) throw new Error("undone on the page, not on disk");
  });
  if (errors.length) fail("page errors: " + errors.slice(0, 3).join("; "));
} finally {
  await browser.close();
  srv.kill();
  fs.rmSync(HOME, { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, "Saved", "Story", "PageTest"), { recursive: true, force: true });
}
console.log("WRITERSPAGE " + (fails.length ? `FAILED (${fails.length})` : "ok"));
process.exit(fails.length ? 1 : 0);

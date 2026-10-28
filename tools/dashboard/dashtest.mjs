// DASH: the dashboard (dashboard.py) in a headless browser. It starts its own dashboard on a spare port, then: every
// tool of the launcher is a row; a story view runs as a job on the game picked in the header and shows its output; a
// tool that needs a word says so until it's filled in; a page (the score room) starts, opens when it answers, is in
// the launcher's own record, and stops; a long check is stopped early; the filter narrows the rows.
//   node tools/dashboard/dashtest.mjs           (DASH_PORT for another port than 8798)
import { createRequire } from "module";
import { spawn, execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import net from "net";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const PORT = +(process.env.DASH_PORT || 8798), DASH = `http://127.0.0.1:${PORT}`;
const fails = [], ok = m => console.log("  ok  " + m), fail = m => { fails.push(m); console.log("  FAIL " + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const free = port => new Promise(r => { const s = net.createConnection(port, "127.0.0.1"); s.on("connect", () => { s.destroy(); r(false); }); s.on("error", () => r(true)); });
const running = () => { try { return Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, "Saved/launch.json"), "utf8")).running || {}); } catch (e) { return []; } };

if (!(await free(PORT))) { console.log(`port ${PORT} is taken: DASH_PORT=<another> node tools/dashboard/dashtest.mjs`); process.exit(1); }
const srv = spawn(process.env.PYTHON || "python3", ["dashboard.py", "--no-open"], { cwd: ROOT, env: Object.assign({}, process.env, { DASH_PORT: String(PORT) }), stdio: ["ignore", "pipe", "pipe"] });
let srvOut = ""; srv.stdout.on("data", d => srvOut += d); srv.stderr.on("data", d => srvOut += d);
for (let i = 0; i < 40 && await free(PORT); i++) await sleep(150);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));
const step = async (what, fn) => { try { await fn(); ok(what); } catch (e) { fail(`${what}: ${e.message}`); await page.screenshot({ path: path.join(ROOT, "Saved/dashtest_fail.png") }).catch(() => { }); } };
const rowOf = label => page.locator(".row", { has: page.locator(".label", { hasText: label }) }).first();
const jobOf = label => page.evaluate(l => (window.__dash.status.jobs.find(j => j.label === l) || null), label);
const waitJob = async (label, until = j => j.status !== "running", secs = 60) => {
  for (let i = 0; i < secs * 4; i++) { const j = await jobOf(label); if (j && until(j)) return j; await sleep(250); }
  throw new Error(`${label}: ${JSON.stringify(await jobOf(label))}`);
};
const outText = () => page.textContent("#out");

try {
  await page.goto(DASH);
  await page.waitForSelector(".row");
  await step("every tool in the launcher is a row, by its section, and the pages to start from are tiles", async () => {
    const n = await page.locator(".row").count(), tools = await page.evaluate(() => window.__dash.tools.length);
    const launched = execFileSync(process.env.PYTHON || "python3", ["tools/launch.py", "--list"], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").length;
    const tiles = await page.locator(".tile").count();
    if (n !== tools || tools !== launched) throw new Error(`${n} rows, ${tools} tools, the launcher lists ${launched}`);
    if (tiles < 3) throw new Error(`${tiles} tiles`);
    console.log(`       ${n} tools in ${await page.locator(".sec").count()} sections, ${tiles} to start from`);
  });
  await step("a story view runs as a job on the header's game; its output streams in and it ends ok", async () => {
    await page.selectOption("#game", "Pilot");
    await rowOf("Flow graph").locator("button", { hasText: "Run" }).click();
    const j = await waitJob("Flow graph");
    if (j.status !== "ok" || !/--game Pilot/.test(j.shown)) throw new Error(JSON.stringify(j));
    await page.waitForFunction(() => /n_arrive/.test(document.querySelector("#out").textContent), null, { timeout: 8000 });
  });
  await step("a tool that needs a word says so until it's filled in, then runs with it", async () => {
    const row = rowOf("Show one scene, stitch or node");
    await row.locator("button", { hasText: "Run" }).click();
    await page.waitForFunction(() => /fill in: Id/.test(document.querySelector("#toast").textContent), null, { timeout: 4000 });
    await row.locator("input").fill("t_search");
    await row.locator("button", { hasText: "Run" }).click();
    const j = await waitJob("Show one scene, stitch or node");
    await page.waitForFunction(() => /stitch t_search/.test(document.querySelector("#out").textContent), null, { timeout: 8000 });
    if (j.status !== "ok") throw new Error(JSON.stringify(j));
  });
  if (await free(8791)) await step("a page: Start starts its server, opens it once it answers, the launcher's record has it; Stop stops it", async () => {
    const [popup] = await Promise.all([ctx.waitForEvent("page"), rowOf("Score room (music)").locator("button", { hasText: "Start" }).click()]);
    await popup.waitForURL(/127\.0\.0\.1:8791/, { timeout: 20000 });
    await popup.waitForLoadState("domcontentloaded");
    const title = await popup.title(); await popup.close();
    if (!running().includes("python tools/score/serve.py")) throw new Error("not in Saved/launch.json: " + running());
    await page.waitForFunction(() => window.__dash.status.pages.some(p => p.labels.includes("Score room (music)")), null, { timeout: 5000 });
    await rowOf("Score room (music)").locator("button", { hasText: "Stop" }).click();
    for (let i = 0; i < 40 && !(await free(8791)); i++) await sleep(150);
    if (!(await free(8791))) throw new Error("its server is still up");
    if (running().includes("python tools/score/serve.py")) throw new Error("still in the launcher's record");
    console.log(`       opened “${title}”, then stopped`);
  });
  else console.log("  (skipped: the score room's port 8791 is in use, so the page step would touch yours)");
  await step("a long check is stopped early: its whole process group goes, the job says stopped", async () => {
    await rowOf("Every offline check, one game").locator("button", { hasText: "Run" }).click();
    await waitJob("Every offline check, one game", j => j.status === "running", 10);
    await sleep(1500);
    await rowOf("Every offline check, one game").locator("button", { hasText: "Stop" }).click();
    const j = await waitJob("Every offline check, one game", j => j.status !== "running", 15);
    if (j.status !== "stopped") throw new Error(JSON.stringify(j));
    const left = execFileSync("ps", ["-eo", "pid,args"], { encoding: "utf8" }).split("\n").filter(l => /check_all\.py --game Pilot/.test(l) && !/ps -eo/.test(l));
    if (left.length) throw new Error("still running: " + left.join(" | "));
  });
  await step("the filter narrows the rows to the words typed", async () => {
    await page.fill("#filter", "kimodo");
    const n = await page.locator(".row").count(), want = await page.evaluate(() => window.__dash.tools.filter(t => /kimodo/i.test(t.section + " " + t.label + " " + t.cmd)).length);
    await page.fill("#filter", "");
    if (!n || n !== want) throw new Error(`${n} rows for ${want} tools`);
  });
  if (errors.length) fail("page errors: " + errors.join(" | "));
} finally {
  await browser.close();
  srv.kill("SIGINT");
  await sleep(500);
}
console.log(fails.length ? `DASH FAILED (${fails.length})` : "DASH ok");
process.exit(fails.length ? 1 : 0);

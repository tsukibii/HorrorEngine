// Pictures of library garments worn in the Character Studio's own view, in the looks given: for a contact sheet.
//   node tools/character/libraryshots.mjs <shots.json> <out dir>      (the Studio's server running; GPU=1 on the user's machine)
// shots.json: [{name, base (-1 feminine .. 1 masculine), height, yaw (0 front, 35), clothes: [{library: id, color, own: false, surface, pbr, pbrTint, pbrTile} | {design, color}]}]
// The clothes are set as the page's own state (st.clothes: what its Library cards and Worn rows write) on a scratch
// character that is never saved.
import { createRequire } from "module";
import { mkdirSync, readFileSync } from "fs";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const [FILE, OUT] = process.argv.slice(2), SHOTS = JSON.parse(readFileSync(FILE, "utf8")), URL = process.env.BODY_URL || "http://127.0.0.1:8793/";
mkdirSync(OUT, { recursive: true });
const browser = await req("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1300, height: 1100 } })).newPage();
page.on("dialog", d => d.accept()); const errors = []; page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error" && /shader|WebGL|THREE/i.test(m.text())) errors.push(m.text().slice(0, 200)); });   // (a material that doesn't compile says so here)
await page.addInitScript(() => { window.__plainNew = true; });   // (a new character from MHR's plain halfway base, as this was written on: not the Studio's own start, grow.js NEW_START)
await page.goto(URL);
await page.waitForFunction(() => window.__body && window.__body.N > 10000, null, { timeout: 180000 });
await page.waitForFunction(async () => (await (await fetch("api/library")).json()).garments?.length > 0, null, { timeout: 30000 });
await page.fill("#newName", "_libraryshots"); await page.click("#make");      // a scratch character from the defaults (never saved again)
await page.waitForFunction(() => window.__body.who === "_libraryshots" && /starts from the/.test(document.querySelector("#status").textContent), null, { timeout: 180000 }); await page.waitForTimeout(1500);
await page.evaluate(() => { const s = [...document.querySelectorAll("#view select, #views select, select")].find(x => [...x.options].some(o => /T-pose/.test(o.textContent))); if (s) { s.value = [...s.options].find(o => !/T-pose/.test(o.textContent)).value; s.dispatchEvent(new Event("change")); } });
let body = "";
for (const sh of SHOTS) {
  const key = JSON.stringify([sh.base ?? 0, sh.height ?? 1.7]);
  await page.evaluate(({ sh, fresh }) => {
    const b = window.__body;
    if (fresh) { const bs = [...document.querySelectorAll(".bases button")].sort((x, y) => Math.abs(+x.dataset.base - (sh.base ?? 0)) - Math.abs(+y.dataset.base - (sh.base ?? 0)))[0]; if (bs) bs.click(); }
    b.st.clothes = sh.clothes.map(c => c.library ? { design: "lib:" + c.library, color: "#ffffff", ...c } : { ...c });
    b.dress();
  }, { sh, fresh: key !== body });
  body = key;
  const n = sh.clothes.length;
  await page.waitForFunction(({ libs, others }) => { const g = window.__body.GARMENTS.children; return g.filter(m => m.userData.library).length === libs && (!others || g.some(m => !m.userData.library)) && !/^(cutting|cut|hanging)$/.test(window.__body.drapeState?.stage || ""); },
    { libs: sh.clothes.filter(c => c.library).length, others: sh.clothes.some(c => !c.library) }, { timeout: 300000 });
  await page.click('#views button[data-v="body"]'); await page.click(`#views button[data-yaw="${sh.yaw ?? 35}"]`);
  await page.waitForTimeout(sh.wait ?? 3500);                                 // the textures and PBR maps loaded, the view drawn
  const r = await page.evaluate(() => { const r = document.querySelector("#view canvas").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  const w = Math.min(r.width, sh.crop ?? 460);
  await page.screenshot({ path: `${OUT}/${sh.name}.png`, clip: { x: r.x + (r.width - w) / 2, y: r.y + 40, width: w, height: r.height - 60 }, timeout: 180000 });
  console.log(sh.name);
}
if (errors.length) console.log("page errors: " + JSON.stringify(errors.slice(0, 3)));
await browser.close();

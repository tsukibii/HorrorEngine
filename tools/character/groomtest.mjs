// GROOM: the Character Studio's brows and lashes by hand (groom.js; the Brows & lashes tab, Fine hairs, Edit on the face;
// docs/CHARACTER_STUDIO.md §2b), driven in a headless browser on a character (PERSON, else _studiotest, else the first):
// the edit mode and its handles; the brows' hairs on the skin and about Hairs of them; the lashes after MetaHuman's
// (the middle ones rising 1 to 3 mm over the lid, never more than 35° up, the outer ones swept out toward the temple,
// every upper lash's tip above its root); a brow handle dragged moves that edge (and its twin, mirrored); a lash handle
// dragged up lifts them; Thin out and Add hair; a style; the blink takes the lashes down; saved and opened again the
// same. Ends "GROOM ok". The Character Studio's server running (BODY_URL for another port).
//   node tools/character/groomtest.mjs
import { createRequire } from "module";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const URL = process.env.BODY_URL || "http://127.0.0.1:8793/";
const browser = await req("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1300, height: 860 } })).newPage(); page.setDefaultTimeout(120000);   // (a busy software-drawn page answers late)
const errs = [], bad = [], t0 = Date.now();
page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
const say = (ok, what) => { console.log((ok ? "  ok  " : "  BAD ") + what); if (!ok) bad.push(what); };
const B = (f, a) => page.evaluate(f, a);
try {
  await page.goto(URL);
  await page.waitForFunction(() => window.__body && window.__body.N > 10000, null, { timeout: 180000 });
  await page.waitForFunction(() => [...document.querySelectorAll("#who option")].some(o => o.value), null, { timeout: 60000 }).catch(() => null);
  const names = await B(() => [...document.querySelectorAll("#who option")].map(o => o.value).filter(Boolean));
  const NAME = process.env.PERSON || (names.includes("_studiotest") ? "_studiotest" : names[0]);
  if (!NAME) throw new Error("no character to try it on (make one in the Studio, or run STUDIO)");
  await page.selectOption("#who", NAME);
  await page.waitForFunction(n => window.__body.who === n && window.__body.POS[12001] !== 0, NAME, { timeout: 180000 });
  await page.waitForTimeout(4000);
  await page.click('#tabs button[data-tab="brows"]');
  await B(() => { const B = window.__body; B.st.groom = null; });   // (a clean start: the defaults, below)
  await B(() => { const B = window.__body; B.st.groom = window.__groomFresh(); B.browLash(); });
  await B(() => [...document.querySelectorAll("button")].find(b => b.textContent === "Edit on the face").click());
  await page.waitForTimeout(2500);
  const ed = await B(() => ({ on: window.__body.st.groom.on, bar: !document.querySelector("#groomBar").hidden, handles: [...document.querySelectorAll("#groomHandles .gh")].filter(e => e.style.display !== "none").length }));
  say(ed.on && ed.bar && ed.handles >= 20, `Edit on the face: the brows and lashes by hand on, the bar shown, ${ed.handles} handles on the face (26: each brow's two edges, five each; the lashes' three)`);
  const m = await B(() => window.__groomMeasure());
  say(m.brows.L > 0.55 * m.hairs && m.brows.L < 1.5 * m.hairs && m.brows.R > 0.55 * m.hairs, `the brows: ${m.brows.L} and ${m.brows.R} hairs (Hairs ${m.hairs})`);
  say(m.onSkin < 0.5, `the brows' hairs lie on the skin: ${m.onSkin.toFixed(2)} mm off it at most`);
  const [inner, mid, outer] = m.lash;
  say(mid.rise >= 0.8 && mid.rise <= 3.2 && mid.elev <= 35, `the middle lashes rise ${mid.rise.toFixed(1)} mm over the lid, ${mid.elev.toFixed(0)}° up from straight out (MetaHuman's: forward, a dark line with short tips over it, not a fan standing up)`);
  say(outer.out >= 30, `the outer lashes swept out toward the temple: ${outer.out.toFixed(0)}° (the inner ones ${inner.out.toFixed(0)}°)`);
  say(m.drooping === 0, `every upper lash's tip above its root (none hanging into the eye): ${m.drooping} not`);
  // a brow handle dragged up: that edge moves, and its twin with Mirror
  const drag = async (sel, dx, dy) => { const r = await (await page.$(sel)).boundingBox(); const x = r.x + r.width / 2, y = r.y + r.height / 2;
    await page.mouse.move(x, y); await page.mouse.down(); for (let k = 1; k <= 6; k++) await page.mouse.move(x + dx * k / 6, y + dy * k / 6); await page.mouse.up(); await page.waitForTimeout(500); };
  await B(() => { const l = [...document.querySelectorAll("#groomHandles .gh")]; l.forEach((e, i) => e.id = "gh" + i); });
  const ix = await B(() => { const l = [...document.querySelectorAll("#groomHandles .gh")]; return { brow: l.findIndex(e => e.classList.contains("brow")) + 2, lash: l.findIndex(e => e.classList.contains("lash")) + 1 }; });
  const b0 = await B(() => JSON.parse(JSON.stringify(window.__body.st.groom.brow)));
  await drag(`#gh${ix.brow}`, 0, -30);
  const b1 = await B(() => JSON.parse(JSON.stringify(window.__body.st.groom.brow)));
  const moved = b1.L.upper[2][1] - b0.L.upper[2][1], twin = b1.R.upper[2][1] - b0.R.upper[2][1];
  say(moved > 1 && Math.abs(twin - moved) < 1e-6, `a brow handle dragged 30 px up raised that edge ${moved.toFixed(1)} mm, its twin the same (Mirror)`);
  const l0 = await B(() => window.__body.st.groom.lash.L.stations[1].lift);
  await drag(`#gh${ix.lash}`, 0, -25);
  const l1 = await B(() => window.__body.st.groom.lash.L.stations[1].lift);
  say(l1 > l0 + 2, `a lash handle dragged up lifted them: ${l0.toFixed(1)}° to ${l1.toFixed(1)}°`);
  // the brushes: Thin out, then Add hair, across the left brow's middle
  const stroke = async (brush) => {
    await B(b => [...document.querySelectorAll("#groomBar button")].find(x => x.textContent === b).click(), brush);
    const pts = await B(() => window.__groomBrowScreen("L"));
    await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down();
    for (let k = 0; k < 3; k++) for (const p of pts) await page.mouse.move(p[0], p[1]);
    await page.mouse.up(); await page.waitForTimeout(500);
    return (await B(() => window.__groomMeasure())).brows.L;
  };
  const before = m.brows.L, thin = await stroke("Thin out"), more = await stroke("Add hair");
  say(thin < before * 0.85 && more > thin, `the brushes: Thin out took the left brow from ${before} hairs to ${thin}, Add hair back to ${more}`);
  await B(() => [...document.querySelectorAll("#groomBar button")].find(x => x.textContent === "Handles").click());
  // a style
  await B(() => { const s = [...document.querySelectorAll("#browRows details select")].find(x => [...x.options].some(o => o.value === "doll")); s.value = "doll"; s.onchange(); });
  const doll = await B(() => window.__body.st.groom.lash.lift);
  say(doll === 18, `a lash style (Doll) sets the sliders: lift ${doll}`);
  // the blink: the lashes go down with the lids
  const tipOpen = await B(() => window.__groomMeasure().tipY);
  await B(() => { const r = document.querySelector("#groomBar input[type=range]"); r.value = 1; r.oninput(); });
  await page.waitForTimeout(800);
  const tipShut = await B(() => window.__groomMeasure().tipY);
  await B(() => { const r = document.querySelector("#groomBar input[type=range]"); r.value = 0; r.oninput(); });
  say(tipShut < tipOpen - 1, `blinking takes the lashes down: the middle lash's tip ${(tipOpen - tipShut).toFixed(1)} mm lower shut`);
  // saved, opened again: the same
  const want = await B(() => JSON.stringify(window.__body.st.groom));
  await page.click("#save"); await page.waitForTimeout(2500);
  await page.reload(); await page.waitForFunction(() => window.__body && window.__body.N > 10000, null, { timeout: 180000 });
  await page.selectOption("#who", NAME);
  await page.waitForFunction(n => window.__body.who === n && window.__body.POS[12001] !== 0, NAME, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const got = await B(() => JSON.stringify(window.__body.st.groom));
  say(got === want, "saved with the character and opened again, the same (shape, brushing, handles, style)");
  await B(() => [...document.querySelectorAll("button")].find(b => b.textContent === "Edit on the face").click());
  await page.waitForTimeout(800);
  await B(() => [...document.querySelectorAll("#groomBar button")].find(x => x.textContent === "Done").click());
  say(await B(() => document.querySelector("#groomBar").hidden), "Done leaves the edit mode");
  say(errs.length === 0, "no errors on the page" + (errs.length ? ": " + errs.slice(0, 3).join(" | ") : ""));
} catch (e) { say(false, "the run stopped: " + e.message.split("\n")[0]); }
await browser.close();
console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
console.log("GROOM " + (bad.length ? "FAIL" : "ok"));
process.exit(bad.length ? 1 : 0);

// LIBRARYPAGE: the clothing library's garments in the Character Studio's page (DECISIONS 2026-11-11: "make sure we can
// edit them in the studio").   node tools/character/librarypagetest.mjs [--out DIR]   (the Studio's server running; GPU=1 on the user's machine)
// On a scratch character, `_librarytest`: the Library section lists the baked garments with their pictures; a click
// wears one, fitted to the body, its own texture on it; its colour tints it; switched to one of our fabrics and then
// to a PBR set off the shelf (its repeat, its tint); a second one worn beside it; it follows the T-pose; saved with the
// character and worn again when it's opened; taken off. --out keeps a picture of each step; --export also exports an
// outfit in layers for Godot (People/_librarytest/export: what tools/godot/library_check.py, GDLIBRARY, reads).
import { createRequire } from "module";
import { mkdirSync } from "fs";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const args = process.argv.slice(2), OUT = args.indexOf("--out") >= 0 ? args[args.indexOf("--out") + 1] : "", EXPORT = args.includes("--export");
const URL = process.env.BODY_URL || "http://127.0.0.1:8793/", NAME = "_librarytest";
if (OUT) mkdirSync(OUT, { recursive: true });
const browser = await req("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
const errors = [], faults = [], fail = m => faults.push(m); page.on("pageerror", e => errors.push(e.message));
page.on("dialog", d => d.accept());                                        // (the scratch character started again from the defaults; leaving with unsaved changes)
const B = (f, a) => page.evaluate(f, a);
const lib = () => B(() => window.__body.GARMENTS.children.filter(m => m.userData.library).map(m => { const u = m.material.userData.uniforms, P = m.geometry.attributes.position;
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let i = 0; i < P.count; i++) { const v = [P.getX(i), P.getY(i), P.getZ(i)]; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } }
  return { id: m.userData.library, garment: m.userData.garment, points: P.count, lo, hi, own: u.uOwnOn.value, pbr: u.uPbrOn.value, tint: u.uPbrTint.value, color: "#" + u.uColor.value.getHexString(), skinned: !!m.userData.skin, finite: [...P.array].every(Number.isFinite) }; }));
const worn = async (n, ms = 120000) => { await page.waitForFunction(k => window.__body.GARMENTS.children.filter(m => m.userData.library).length === k, n, { timeout: ms }); await page.waitForTimeout(600); return lib(); };
const clip = () => B(() => { const r = document.querySelector("#view canvas").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
const shot = async name => { if (!OUT) return; await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/${name}.png`, clip: await clip(), timeout: 180000 }); };
const row = id => page.locator("#worn > div").filter({ hasText: "(library)" }).filter({ has: page.locator(`text=${id}`) }).first();
try {
  await page.goto(URL);
  await page.waitForFunction(() => window.__body && window.__body.N > 10000, null, { timeout: 180000 });
  const list = await B(async () => (await (await fetch("api/library")).json()));
  if (!list.garments?.length || !list.base) throw new Error("the server lists no baked library garments (python tools/clothing_library.py fetch, then bake)");
  await page.fill("#newName", NAME); await page.click("#make");
  await page.waitForFunction(n => window.__body.who === n && /starts from the/.test(document.querySelector("#status").textContent), NAME, { timeout: 180000 }); await page.waitForTimeout(1500);
  if (await B(() => window.__body.st.clothes.length)) throw new Error("a new character already wears something");
  await page.click('#tabs button[data-tab="clothes"]');
  await page.waitForFunction(() => document.querySelectorAll("#libGrid .card").length > 0, null, { timeout: 30000 });
  const tabs = await B(() => [...document.querySelectorAll("#libTabs button")].map(b => b.dataset.group));
  if (!tabs.includes("dress")) fail(`the library's groups are ${tabs}: no dresses`);
  const cards = await B(() => [...document.querySelectorAll("#libGrid .card")].map(b => ({ id: b.dataset.library, img: !!b.querySelector("img") })));
  await page.waitForTimeout(1500);
  const pics = await B(() => [...document.querySelectorAll("#libGrid .card img")].filter(i => i.complete && i.naturalWidth > 0).length);
  if (!(pics >= Math.min(4, cards.length))) fail(`only ${pics} of ${cards.length} cards show their garment's picture`);
  const dress = cards.find(c => /f_dress_02/.test(c.id)) || cards[0];
  // 1. worn: fitted, on the body, its own texture
  await page.click(`#libGrid .card[data-library="${dress.id}"]`);
  let g = (await worn(1))[0];
  const H = await B(() => window.__body.st.height);
  if (!g.finite || !(g.hi[1] - g.lo[1] > 0.3 && g.hi[1] < H && g.lo[1] > 0)) fail(`${dress.id} worn: not on the body (y ${g.lo[1].toFixed(2)} to ${g.hi[1].toFixed(2)}, the body ${H} m)`);
  if (g.own !== 1 || g.pbr !== 0) fail(`${dress.id} worn: not in its own texture (own ${g.own}, pbr ${g.pbr})`);
  if (!g.skinned) fail(`${dress.id} worn: no bones from the skin round it (it won't follow a pose)`);
  if (!(await B(id => document.querySelector(`#libGrid .card[data-library="${id}"]`).classList.contains("on"), dress.id))) fail("its card isn't marked as worn");
  await page.click('#views button[data-v="body"]'); await page.click('#views button[data-yaw="35"]');
  await shot("1_own_texture");
  // 2. its colour tints it
  await B(() => { const r = [...document.querySelectorAll("#worn > div")].find(d => /\(library\)/.test(d.textContent)), c = r.querySelector('input[type="color"]'); c.value = "#c04060"; c.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.waitForTimeout(400); g = (await lib())[0];
  if (g.color !== "#c04060" || g.own !== 1) fail(`its colour didn't tint its own texture (${g.color}, own ${g.own})`);
  await shot("2_tinted");
  // 3. one of our fabrics in its place, then a PBR set off the shelf
  await B(() => { const r = [...document.querySelectorAll("#worn > div")].find(d => /\(library\)/.test(d.textContent)); r.querySelector("details").open = true; const t = r.querySelector('details label.tog input[type="checkbox"]'); t.checked = false; t.dispatchEvent(new Event("change", { bubbles: true })); });
  await page.waitForTimeout(600); g = (await lib())[0];
  if (g.own !== 0) fail("with its own texture switched off it still wears it");
  await shot("3_our_fabric");
  var sets = await B(() => { const r = [...document.querySelectorAll("#worn > div")].find(d => /\(library\)/.test(d.textContent)), s = [...r.querySelectorAll("select")].find(x => [...x.options].some(o => /^pbr\//.test(o.value))); return s ? [...s.options].map(o => o.value).filter(Boolean) : []; });
  if (sets.length) {
    const ref = sets.find(r => /fabric_/.test(r)) || sets[0];
    await B(ref => { const r = [...document.querySelectorAll("#worn > div")].find(d => /\(library\)/.test(d.textContent)), s = [...r.querySelectorAll("select")].find(x => [...x.options].some(o => /^pbr\//.test(o.value))); s.value = ref; s.dispatchEvent(new Event("change", { bubbles: true })); }, ref);
    await page.waitForTimeout(800); g = (await lib())[0];
    if (g.pbr !== 1 || g.own !== 0) fail(`a PBR set picked (${ref}): the garment doesn't wear it (pbr ${g.pbr}, own ${g.own})`);
    const c = await B(() => window.__body.st.clothes.find(c => c.library));
    if (c.pbr !== ref || c.own !== false) fail(`the worn garment's settings don't say the set (${JSON.stringify(c)})`);
    await page.waitForTimeout(2500); await shot("4_pbr_set");
  } else console.log("  (no PBR sets on this machine's shelf: that step skipped)");
  // 4. a second one beside it; both follow the T-pose (the view's default pose)
  const other = cards.find(c => c.id !== dress.id && /flats|boots|shoes/.test(c.id)) || cards.find(c => c.id !== dress.id);
  const tab = list.garments.find(x => x.id === other.id).group;
  await page.click(`#libTabs button[data-group="${tab}"]`).catch(() => {});
  await page.click(`#libGrid .card[data-library="${other.id}"]`).catch(async () => { await B(id => document.querySelector(`#libGrid .card[data-library="${id}"]`)?.click(), other.id); });
  const two = await worn(2);
  if (!two.every(x => x.finite && x.skinned)) fail("two library garments worn: one isn't finite or has no bones");
  await shot("5_two_worn");
  // 5. saved with the character, worn again when it's opened
  await B(() => { document.querySelector("#status").textContent = ""; }); await page.click("#save");
  await page.waitForFunction(() => /^saved /.test(document.querySelector("#status").textContent), null, { timeout: 180000 });
  const saved = await B(async n => (await fetch(`api/people/${n}`)).json(), NAME), sc = (saved.character || saved).clothes || [];
  if (sc.filter(c => c.library).length !== 2 || !sc.some(c => c.library === dress.id && c.design === "lib:" + dress.id)) fail(`saved: the character's clothes are ${JSON.stringify(sc).slice(0, 200)}`);
  await page.reload();
  await page.waitForFunction(() => window.__body && window.__body.N > 10000, null, { timeout: 180000 });
  await page.waitForFunction(n => [...document.querySelectorAll("#who option")].some(o => o.value === n), NAME, { timeout: 30000 });
  await page.selectOption("#who", NAME);
  await page.waitForFunction(n => window.__body.who === n && /points/.test(document.querySelector("#hud").textContent), NAME, { timeout: 180000 }); await page.waitForTimeout(4000);
  const again = await worn(2, 180000), back = again.find(x => x.id === dress.id);
  if (!back) fail("opened again: the dress isn't worn");
  else if (sets.length && (back.pbr !== 1 || back.color !== "#c04060")) fail(`opened again: the dress came back without its set or its colour (pbr ${back.pbr}, ${back.color})`);
  await shot("6_opened_again");
  // (--export: an outfit in layers exported for Godot, for GDLIBRARY: briefs under a dress in a PBR set, socks in flats)
  if (EXPORT) {
    await B(() => { const b = window.__body, L = (id, more = {}) => ({ design: "lib:" + id, library: id, color: "#ffffff", ...more });
      b.st.clothes = [L("punkduck_sport_briefs"), L("toigo_lace_frill_socks"), L("mindfront_f_dress_02", { own: false, pbr: "pbr/Procedural/fabric_satin", color: "#7a1830" }), L("toigo_ballet_flats")].filter(c => document.querySelector("#libGrid") && true); b.dress(); });
    const out = await worn(4, 180000), hid = out.filter(x => x.id === "punkduck_sport_briefs" || x.id === "toigo_lace_frill_socks");
    if (!out.every(x => x.finite)) fail("the export's outfit: a garment isn't finite");
    await B(() => { document.querySelector("#status").textContent = ""; }); await page.click("#save");
    await page.waitForFunction(() => /^saved /.test(document.querySelector("#status").textContent), null, { timeout: 180000 });
    await page.click("#expPack");
    await page.waitForFunction(() => { const s = document.querySelector("#status"); return /wrote .*\.glb/.test(s.textContent) || s.className.includes("bad"); }, null, { timeout: 500000 });
    const said = await B(() => document.querySelector("#status").textContent);
    if (!/\.glb/.test(said)) fail("Export for Godot: " + said.slice(0, 160)); else console.log("  exported: " + said.slice(0, 110));
    await page.waitForTimeout(8000);                                         // (the copy for Godot, with the face's shapes, written after)
    await B(() => { const b = window.__body; b.st.clothes = b.st.clothes.filter(c => /f_dress_02|ballet_flats/.test(c.library)); b.dress(); });
    await worn(2);
    await page.click('#tabs button[data-tab="clothes"]');
  }
  // 6. taken off
  await page.click('#tabs button[data-tab="clothes"]');
  await B(() => { const r = [...document.querySelectorAll("#worn > div")].find(d => /\(library\)/.test(d.textContent)); [...r.querySelectorAll("button")].find(b => b.textContent === "×").click(); });
  const left = await worn(1);
  if (left[0].id === dress.id) fail("taking the first one off left it on");
} catch (e) { fail(e.message.split("\n")[0]); await page.screenshot({ path: `${OUT || "."}/librarypage_fail.png` }).catch(() => {}); }
if (errors.length) fail("page errors: " + JSON.stringify(errors.slice(0, 3)));
await browser.close();
for (const f of faults) console.log("LIBRARYPAGE FAIL:", f);
if (!faults.length) console.log("LIBRARYPAGE ok (a library garment worn, tinted, in our fabric and a PBR set, two worn, saved and opened again, taken off)");
process.exit(faults.length ? 1 : 0);

// The hair builder (tools/character/hairbuilder.html) in a headless browser: a preset loads and draws over a base head;
// a horizontal cut makes two pieces; the bottom piece dragged moves its Gaussians and not the top's; a stretch
// stretches; paint adds Gaussians and erase removes them; jiggle on a piece survives a shake with no NaN; the preset
// saves under a new name with its cage, edit.bin and a bake, and loads back with the same pieces. Ends "HAIRBUILDER ok".
//
//   python tools/character/serve.py                    (in another shell)
//   node tools/character/hairbuildertest.js [preset] [shot.png]     preset: minimax_wig by default
//
// Needs Playwright (npm i playwright, or PLAYWRIGHT=<path to its package>; PW_CHROME=<a Chromium binary> when its browsers aren't installed).
const fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const BASE = process.env.BODY_URL || "http://127.0.0.1:8793/";
const ROOT = path.resolve(__dirname, "..", "..");
const PRESET = process.argv[2] || "minimax_wig", TEST = "_hairbuildertest";
const shot = process.argv[3];
const fail = m => { console.error("HAIRBUILDER FAIL: " + m); process.exit(1); };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 760 } })).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { await page.screenshot({ path: shot || "hairbuildertest_fail.png" }); fail(`${what}: ${e.message}`); } };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const grab = () => ev(() => { const c = window.__builder.canvas, k = document.createElement("canvas"); k.width = c.width; k.height = c.height; k.getContext("2d").drawImage(c, 0, 0); return Array.from(k.getContext("2d").getImageData(0, 0, k.width, k.height).data); });
  const hairPixels = async () => { const a = await grab(); await ev(() => { window.__builder.hair.mesh.visible = false; }); await page.waitForTimeout(400); const b = await grab(); await ev(() => { window.__builder.hair.mesh.visible = true; }); await page.waitForTimeout(300);
    let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 12) n++; return n; };
  await page.goto(BASE + "hairbuilder.html?preset=" + PRESET);
  await step("the preset loads over a base head and draws", async () => {
    await page.waitForFunction(() => window.__builder && window.__builder.ready, null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    const n = await ev(() => [window.__builder.hair.n, window.__builder.lattice.pieces.length]);
    if (!(n[0] > 1000) || n[1] !== 1) throw new Error(`${n[0]} Gaussians, ${n[1]} pieces`);
    const px = await hairPixels(); if (px < 2000) throw new Error(`${px} pixels of hair`);
    console.log(`       ${n[0]} Gaussians, ${px} pixels of hair`);
  });
  await step("the box's width stretches the whole hair about its centre", async () => {
    const ext = () => ev(() => { const P = window.__builder.hair.positions(); let lo = 1e9, hi = -1e9; for (let i = 0; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); } return hi - lo; });
    const w0 = await ext();
    await ev(() => { const inp = document.querySelector('input[title="The whole hair stretched sideways about the box\'s centre."]'); inp.value = (+inp.value) * 1.5; inp.dispatchEvent(new Event("input")); });
    await page.waitForTimeout(200);
    const w1 = await ext();
    if (Math.abs(w1 / w0 - 1.5) > 0.03) throw new Error(`width ${w0.toFixed(3)} -> ${w1.toFixed(3)}`);
    await ev(() => { const inp = document.querySelector('input[title="The whole hair stretched sideways about the box\'s centre."]'); inp.value = (+inp.value) / 1.5; inp.dispatchEvent(new Event("input")); });
    console.log(`       ${w0.toFixed(3)} m -> ${w1.toFixed(3)} m and back`);
  });
  await step("a horizontal cut makes two pieces, each with Gaussians", async () => {
    await ev(() => { window.__builder.st.cage.cuts.y.push(0.5); window.__builder.rebuildCage(); });
    await page.waitForTimeout(300);
    const c = await ev(() => window.__builder.lattice.pieces.map(p => [p.id, p.count]));
    if (c.length !== 2 || c.some(p => p[1] < 100)) throw new Error(JSON.stringify(c));
    console.log(`       pieces ${c.map(p => p[0] + ":" + p[1]).join(" ")}`);
  });
  await step("the bottom piece moved: its Gaussians move, the top's stay", async () => {
    const before = await ev(() => Array.from(window.__builder.hair.positions()));
    await ev(() => { const L = window.__builder.lattice; const bottom = L.pieces.find(p => p.j === 0); window.__builder.select(bottom.id); L.movePiece(bottom.id, [0.05, -0.03, 0]); window.__builder.hair.updateNodes(bottom.id); });
    await page.waitForTimeout(300);
    const after = await ev(() => Array.from(window.__builder.hair.positions()));
    const piece = await ev(() => Array.from(window.__builder.hair.piece)), bottomIdx = await ev(() => window.__builder.lattice.pieces.findIndex(p => p.j === 0));
    let movedB = 0, movedT = 0, nB = 0, nT = 0;
    for (let i = 0; i < piece.length; i++) { const d = Math.hypot(after[i * 3] - before[i * 3], after[i * 3 + 1] - before[i * 3 + 1], after[i * 3 + 2] - before[i * 3 + 2]); if (piece[i] === bottomIdx) { nB++; if (d > 0.04) movedB++; } else { nT++; if (d > 1e-5) movedT++; } }
    if (movedB < 0.9 * nB) throw new Error(`${movedB} of ${nB} bottom Gaussians moved`);
    if (movedT > 0) throw new Error(`${movedT} top Gaussians moved`);
    console.log(`       bottom ${movedB}/${nB} moved, top ${movedT}/${nT}`);
  });
  await step("a stretch widens the piece", async () => {
    const w = await ev(() => { const L = window.__builder.lattice, id = window.__builder.st.selected, p = L.byId[id]; const s0 = L.stretch(p)[0]; L.scalePiece(id, [1.5, 1, 1]); window.__builder.hair.updateNodes(id); return [s0, L.stretch(p)[0]]; });
    if (Math.abs(w[1] / w[0] - 1.5) > 0.02) throw new Error(`stretch ${w[0]} -> ${w[1]}`);
  });
  await step("paint adds Gaussians, erase removes them", async () => {
    const n0 = await ev(() => window.__builder.hair.n);
    const c = await page.evaluate(() => { const r = document.querySelector("#view canvas").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.4 }; });
    await ev(() => { window.__builder.st.brush.mode = "paint"; window.__builder.st.brush.count = 20; window.__builder.st.brush.radius = 0.04; });
    await ev(c => window.__builder.dab(c.x, c.y), c);
    const n1 = await ev(() => window.__builder.hair.n);
    if (n1 !== n0 + 20) throw new Error(`${n0} -> ${n1} after a paint dab`);
    await ev(() => { window.__builder.st.brush.mode = "erase"; });
    await ev(c => window.__builder.dab(c.x, c.y), c);
    const alive = await ev(() => Array.from(window.__builder.hair.alive).filter(a => a).length);
    if (alive >= n1) throw new Error(`erase removed nothing (${alive} alive of ${n1})`);
    await ev(() => { window.__builder.st.brush.mode = "off"; });
    console.log(`       ${n0} -> ${n1} painted, ${n1 - alive} erased`);
  });
  await step("jiggle on the bottom piece survives a shake without a NaN", async () => {
    await ev(() => { const L = window.__builder.lattice, p = L.byId[window.__builder.st.selected]; p.settings.jiggle = true; window.__builder.rebuildJiggle(); window.__builder.select(p.id); window.__builder.motion("shake"); });
    await page.waitForFunction(() => Object.keys(window.__builder.wigs).length === 1, null, { timeout: 5000 });
    await page.waitForTimeout(1500);
    const ok = await ev(() => { const L = window.__builder.lattice; return L.pieces.every(p => p.nodes.every(Number.isFinite)); });
    if (!ok) throw new Error("NaN in the nodes");
    await ev(() => window.__builder.motion("still")); await page.waitForTimeout(600);
    const px = await hairPixels(); if (px < 2000) throw new Error(`${px} pixels of hair after the shake`);
  });
  await step("saved under a new name with a bake, and loads back with its pieces", async () => {
    await ev(n => { document.querySelector("#saveName").value = n; }, TEST);
    await ev(() => window.__builder.savePreset(true));
    await page.waitForFunction(() => /saved/.test(document.querySelector("#status").textContent), null, { timeout: 30000 });
    const d = path.join(ROOT, "Content", "Studio", "Hair", TEST);
    for (const f of ["hair.json", "gaussians.bin", "edit.bin", "bake.json", "bake.bin"]) if (!fs.existsSync(path.join(d, f))) throw new Error(`no ${f}`);
    const h = JSON.parse(fs.readFileSync(path.join(d, "hair.json"), "utf-8"));
    if (!h.cage.locked || h.cage.cuts.y.length !== 1 || !Object.values(h.cage.pieces).some(p => p.jiggle)) throw new Error("the cage didn't save: " + JSON.stringify(h.cage.cuts));
    await page.goto(BASE + "hairbuilder.html?preset=" + TEST);
    await page.waitForFunction(() => window.__builder && window.__builder.ready, null, { timeout: 90000 });
    const n = await ev(() => [window.__builder.hair.n, window.__builder.lattice.pieces.length, Object.keys(window.__builder.wigs).length]);
    if (n[1] !== 2 || n[2] !== 1) throw new Error(`loaded back: ${n[0]} Gaussians, ${n[1]} pieces, ${n[2]} jiggling`);
    console.log(`       ${n[0]} Gaussians, ${n[1]} pieces, ${n[2]} jiggling after the reload`);
    fs.rmSync(d, { recursive: true, force: true });
  });
  if (shot) await page.screenshot({ path: shot });
  if (errors.length) fail("page errors: " + errors.join(" | "));
  await browser.close();
  console.log("HAIRBUILDER ok");
})().catch(e => fail(e.message));

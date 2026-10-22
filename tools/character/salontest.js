// The salon (tools/character/salon.html) in a headless browser. The locked reference: turning the view snaps it onto the
// nearest frame of the MiniMax turntable (Content/Studio/Hair/References/minimax_wig), the view's camera is that frame's,
// the picture is drawn; with half the turn in use the far side is a mirrored frame; the fit moves the cameras. The lock
// tools with the mouse: a strand (root, end), a sheet (a root line dragged along the scalp, an end), a bundle; Mirror on
// gives a sheet a twin across the seam that follows a pulled handle; no guide point inside the body; undo and redo; a
// save and a reload. Ends "SALON ok".
//
//   python tools/character/serve.py                    (in another shell)
//   node tools/character/salontest.js [shot.png]
//
// Needs Playwright (npm i playwright, or PLAYWRIGHT=<path to its package>; PW_CHROME=<a Chromium binary> when its browsers aren't installed).
const fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const BASE = process.env.BODY_URL || "http://127.0.0.1:8793/";
const ROOT = path.resolve(__dirname, "..", "..");
const TEST = "_salontest", shot = process.argv[2];
const fail = m => { console.error("SALON FAIL: " + m); process.exit(1); };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-background-networking", "--disable-component-update"] });
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 744 } })).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { await page.screenshot({ path: shot || "salontest_fail.png" }); fail(`${what}: ${e.message}`); } };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const view = async (yaw, pitch = 0.1, dist = 1.3) => { await ev(([y, p, d]) => { const s = window.__salon; Object.assign(s.orbit, { yaw: y, pitch: p, dist: d, zoom: 1, pan: [0, 0] }); s.draw(); }, [yaw, pitch, dist]); await page.waitForTimeout(250); };
  const scr = p => ev(p => { const s = window.__salon; s.render(); const r = s.canvas.getBoundingClientRect(); const q = s.screenOf(p); return [r.left + q[0], r.top + q[1]]; }, p);
  const surf = p => ev(p => window.__salon.COL.surface(p), p);
  const count = () => ev(() => window.__salon.st.locks.length);
  const drag = async pts => { await page.mouse.move(...pts[0]); await page.mouse.down(); for (let i = 1; i < pts.length; i++) for (let k = 1; k <= 5; k++) await page.mouse.move(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k / 5, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k / 5); await page.mouse.up(); };

  await page.goto(BASE + "salon.html?ref=minimax_wig");
  await step("the salon loads the head and the reference", async () => {
    await page.waitForFunction(() => window.__salon && window.__salon.ready, null, { timeout: 90000 });
    const n = await ev(() => [window.__salon.CAMS.length, window.__salon.HF && window.__salon.HF.S]);
    if (!(n[0] >= 90) || !(n[1] > 0.5)) throw new Error(`${n[0]} cameras, head size ${n[1]}`);
  });
  await step("turning the view snaps onto the nearest frame; the view's camera is that frame's and its picture is drawn", async () => {
    let last = null;
    for (const a of [0, 90, 180, 270]) {
      await view(a * Math.PI / 180, -0.25, 0.85); await page.waitForTimeout(400);
      const r = await ev(() => { const s = window.__salon, c = s.SNAP; if (!c) return null; const m = document.querySelector("#ref");
        return { name: c.name, angle: c.angle, mirrored: c.mirrored, shown: m.style.display !== "none" && m.complete && m.naturalWidth > 0 }; });
      if (!r) throw new Error(`no frame at ${a}°`);
      if (r.angle > 8) throw new Error(`${a}°: the nearest frame ${r.name} is ${r.angle.toFixed(1)}° off`);
      if (r.mirrored) throw new Error(`${a}°: a mirrored frame although the video covers it`);
      if (!r.shown) throw new Error(`${a}°: frame ${r.name}'s picture isn't drawn`);
      if (r.name === last) throw new Error(`${a}°: the same frame as the last angle`);
      last = r.name;
      console.log(`       ${a}° -> frame ${r.name} (${r.angle.toFixed(1)}° off)`);
    }
    // the view's camera sits exactly on the frame's
    const d = await ev(() => { const s = window.__salon; s.render(); const w = s.SR.worldCamera(s.SNAP, s.HF), cam = s.cameraPosition(); return Math.hypot(cam[0] - w.C[0], cam[1] - w.C[1], cam[2] - w.C[2]); });
    if (!(d <= 1e-6)) throw new Error(`the view's camera is ${d} m off the frame's`);
  });
  await step("with half the turn in use, the far side is a mirrored frame", async () => {
    await ev(() => { const s = window.__salon; s.st.reference.fit.cover = 180; s.recam(); });
    await view(-Math.PI / 2, -0.25, 0.85);
    const r = await ev(() => { const c = window.__salon.SNAP; return c && { name: c.name, mirrored: c.mirrored, angle: c.angle }; });
    if (!r || !r.mirrored) throw new Error(JSON.stringify(r));
    const flip = await ev(() => document.querySelector("#ref").style.transform);
    if (!/scale\(-1, 1\)/.test(flip)) throw new Error("the picture isn't flipped: " + flip);
    console.log(`       270° -> frame ${r.name} mirrored`);
    await ev(() => { const s = window.__salon; s.st.reference.fit.cover = 360; s.recam(); });
  });
  await step("the fit moves the reference's cameras with it", async () => {
    await view(0, -0.25, 0.85);
    const d = await ev(() => { const s = window.__salon, c0 = s.SNAP, same = c => c.i === c0.i && c.mirrored === c0.mirrored;
      const a = s.SR.worldCamera(s.CAMS.find(same), s.HF).C; s.st.reference.fit.offset[0] += 0.02; s.recam();
      const b = s.SR.worldCamera(s.CAMS.find(same), s.HF).C; s.st.reference.fit.offset[0] -= 0.02; s.recam(); return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / s.HF.S; });
    if (Math.abs(d - 0.02) > 1e-4) throw new Error(`a 2 cm offset moved the camera ${(d * 100).toFixed(2)} cm`);
    await ev(() => window.__salon.loadReference(""));
  });
  await step("a strand: a root clicked on the scalp, an end clicked", async () => {
    await view(0.5, 0.1, 1.3);
    const n0 = await count(); await page.keyboard.press("s");
    await page.mouse.click(...await scr(await surf([0.04, 0.13, 0.0])));
    const e = await scr([0.12, -0.2, 0.03]); await page.mouse.move(...e); await page.mouse.wheel(0, -200); await page.mouse.click(...e);
    const l = await ev(() => { const s = window.__salon, l = s.st.locks[s.st.locks.length - 1]; return { type: l.type, guides: s.EVAL[l.id] ? s.EVAL[l.id].length : 0 }; });
    if (await count() !== n0 + 1 || l.type !== "strand") throw new Error(`${await count()} locks, last ${l.type}`);
  });
  await step("a sheet: a root line dragged along the hairline, its end on the brows", async () => {
    await view(0, 0.05, 1.1);
    const n0 = await count(); await page.keyboard.press("l");
    const pts = []; for (const p of [[-0.05, 0.075, 0.05], [-0.02, 0.085, 0.07], [0.02, 0.085, 0.07], [0.05, 0.075, 0.05]]) pts.push(await scr(await surf(p)));
    await drag(pts);
    const e = await scr(await surf([0, 0.03, 0.2])); await page.mouse.move(...e); await page.mouse.click(...e);
    const l = await ev(() => { const s = window.__salon, l = s.st.locks[s.st.locks.length - 1]; return { type: l.type, roots: l.root ? l.root.length : 0, guides: l.guides }; });
    if (await count() !== n0 + 1 || l.type !== "sheet" || l.roots < 3 || l.guides < 3) throw new Error(JSON.stringify(l));
    console.log(`       ${l.roots} root points, ${l.guides} guides`);
  });
  await step("a bundle: a root and a tip", async () => {
    await view(Math.PI, 0.0, 1.9);
    const n0 = await count(); await page.keyboard.press("b");
    await page.mouse.click(...await scr(await surf([0.0, 0.08, -0.12])));
    const e = await scr([0.05, -0.25, -0.24]); await page.mouse.move(...e); await page.mouse.click(...e);
    if (await count() !== n0 + 1) throw new Error("no bundle");
  });
  await step("Mirror on: a sidelock gets a twin across the seam", async () => {
    await view(0, 0.05, 1.1);
    await ev(() => { window.__salon.st.mirror.on = true; });
    const n0 = await count(); await page.keyboard.press("l");
    const pts = []; for (const p of [[-0.06, 0.07, 0.03], [-0.075, 0.04, 0.01]]) pts.push(await scr(await surf(p)));
    await drag(pts);
    const e = await scr([-0.085, -0.13, 0.06]); await page.mouse.move(...e); await page.mouse.click(...e);
    await ev(() => { window.__salon.st.mirror.on = false; });
    const t = await ev(() => { const L = window.__salon.st.locks, a = L[L.length - 2], b = L[L.length - 1]; return { twin: b.mirror_of === a.id, ax: a.edges[2][5][0], bx: b.edges[2][5][0], y: [a.edges[2][5][1], b.edges[2][5][1]] }; });
    if (await count() !== n0 + 2 || !t.twin) throw new Error(`${(await count()) - n0} locks added, twin ${t.twin}`);
    if (Math.abs(t.ax + t.bx) > 1e-9 || Math.abs(t.y[0] - t.y[1]) > 1e-9) throw new Error(`the twin's end isn't the mirror: ${JSON.stringify(t)}`);
  });
  await step("a handle pulled with the mouse moves the lock, and its twin follows", async () => {
    await view(-Math.PI / 2, 0.05, 1.1);
    await page.keyboard.press("v");
    const id = await ev(() => { const L = window.__salon.st.locks; return L[L.length - 2].id; });
    await ev(id => window.__salon.select(id), id);
    const h = await ev(id => window.__salon.st.locks.find(l => l.id === id).edges[1][3], id);
    const from = await scr(h);
    await page.mouse.move(...from); await page.mouse.down(); await page.mouse.move(from[0] - 40, from[1] + 8, { steps: 8 }); await page.mouse.up();
    const r = await ev(id => { const L = window.__salon.st.locks, a = L.find(l => l.id === id), b = L.find(l => l.mirror_of === id); return [a.edges[1][3], b.edges[1][3]]; }, id);
    const moved = Math.hypot(r[0][0] - h[0], r[0][1] - h[1], r[0][2] - h[2]);
    if (moved < 0.01) throw new Error(`the handle moved ${(moved * 100).toFixed(2)} cm`);
    if (Math.abs(r[0][0] + r[1][0]) > 1e-9 || Math.abs(r[0][2] - r[1][2]) > 1e-9) throw new Error("the twin didn't follow");
    console.log(`       the handle moved ${(moved * 100).toFixed(1)} cm, the twin with it`);
  });
  await step("no guide point inside the body, none NaN", async () => {
    const bad = await ev(() => { const s = window.__salon; s.render(); let inside = 0, nan = 0, n = 0;
      for (const l of s.st.locks) for (const G of s.EVAL[l.id] || []) G.pts.forEach((p, k) => { n++; if (!p.every(Number.isFinite)) nan++; else if (k > 0 && s.COL.push(p, -0.001)[1]) inside++; });
      return { inside, nan, n }; });
    if (bad.nan || bad.inside) throw new Error(JSON.stringify(bad));
    console.log(`       ${bad.n} guide points checked`);
  });
  await step("undo takes changes back (the pull, then the twins), redo puts them again", async () => {
    const snap = () => ev(() => JSON.stringify(window.__salon.st.locks));
    const s0 = await snap(), n0 = await count();
    await page.keyboard.press("Control+z"); const s1 = await snap();
    await page.keyboard.press("Control+z"); const n2 = await count();
    await page.keyboard.press("Control+Shift+z"); await page.keyboard.press("Control+Shift+z"); const s3 = await snap();
    if (s1 === s0) throw new Error("undo changed nothing");
    if (n2 !== n0 - 2) throw new Error(`the second undo left ${n2} locks of ${n0} (the sidelock and its twin should go)`);
    if (s3 !== s0) throw new Error("redo didn't bring it all back");
  });
  await step("saved as salon.json and loaded back the same", async () => {
    const before = await ev(() => window.__salon.st.locks.map(l => [l.id, l.type, l.mirror_of]));
    await ev(n => { document.querySelector("#hairName").value = n; return window.__salon.save(); }, TEST);
    const f = path.join(ROOT, "Content", "Studio", "Hair", TEST, "salon.json");
    if (!fs.existsSync(f)) throw new Error("no " + f);
    await page.goto(BASE + "salon.html?hair=" + TEST);
    await page.waitForFunction(() => window.__salon && window.__salon.ready, null, { timeout: 90000 });
    const after = await ev(() => window.__salon.st.locks.map(l => [l.id, l.type, l.mirror_of]));
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`${before.length} locks saved, ${after.length} loaded`);
    fs.rmSync(path.dirname(f), { recursive: true, force: true });
    console.log(`       ${after.length} locks`);
  });
  if (shot) await page.screenshot({ path: shot });
  if (errors.length) fail("page errors: " + errors.join(" | "));
  await browser.close();
  console.log("SALON ok");
})().catch(e => fail(e.message));

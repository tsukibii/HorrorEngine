// The salon (tools/character/salon.html) in a headless browser. The locked reference: turning the view snaps it onto the
// nearest frame of the MiniMax turntable (Content/Studio/Hair/References/minimax_wig), the view's camera is that frame's,
// the picture is drawn; with half the turn in use the far side is a mirrored frame; the fit moves the cameras; the
// reference's cube bends the picture where its pulled face looks at the view. The lock
// tools with the mouse: a strand (root, end), a sheet (a root line dragged along the scalp, an end), a bundle; Mirror on
// gives a sheet a twin across the seam that follows a pulled handle; no guide point inside the body; undo and redo; the
// pull (Blender's proportional editing: the falloffs, the handles in reach on its lock and the next, the wheel growing the
// reach mid-drag, O, a twin's pull); a bundle line (the line its width, the wheel's oval, Height); thickness on a strand
// and a sheet (off by default, the dome's height, its taper); the roots (leaving the scalp at their lift, flat at 0,
// gravity not flattening them); padding (the scalp covered, along the hair, physics left out, a base group, the bake);
// the base (baked alone, hidden, Clip blend);
// the presets (all eight on the head, the scalp covered, the long cut falling clear of the
// face); the cover (a parting of Y's over the rest, its length the
// top hair's, falling onto it with friction, kept as shown); the
// darkened scalp (full on the crown, none on the face, faded at the hairline, Thickness); physics on the bundle (a shake swings it, still settles it); the bake (a
// skinned mesh for it, one simplified mesh for the rest, a glTF that loads back and bends on its bones, the hair's look
// in it); the look (the strand atlas, the shader on every card, a look restyling them); a save and a reload.
// Ends "SALON ok".
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
  page.on("dialog", d => d.accept());                                 // the Character Studio's "start it again?"
  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { await page.screenshot({ path: shot || "salontest_fail.png" }); fail(`${what}: ${e.message}`); } };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const view = async (yaw, pitch = 0.1, dist = 1.3) => { await ev(([y, p, d]) => { const s = window.__salon; Object.assign(s.orbit, { yaw: y, pitch: p, dist: d, zoom: 1, pan: [0, 0] }); s.draw(); }, [yaw, pitch, dist]); await page.waitForTimeout(250); };
  const scr = p => ev(p => { const s = window.__salon; s.render(); const r = s.canvas.getBoundingClientRect(); const q = s.screenOf(p); return [r.left + q[0], r.top + q[1]]; }, p);
  const surf = p => ev(p => window.__salon.COL.surface(p), p);
  const count = () => ev(() => window.__salon.st.locks.length);
  const openSteps = () => ev(() => document.querySelectorAll("details.step").forEach(d => { d.open = true; }));   // the side panel's dropdowns
  const drag = async pts => { await page.mouse.move(...pts[0]); await page.mouse.down(); for (let i = 1; i < pts.length; i++) for (let k = 1; k <= 5; k++) await page.mouse.move(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k / 5, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k / 5); await page.mouse.up(); };

  await page.goto(BASE + "salon.html?ref=minimax_wig");
  await step("the salon loads the head and the reference", async () => {
    await page.waitForFunction(() => window.__salon && window.__salon.ready, null, { timeout: 90000 });
    const n = await ev(() => [window.__salon.CAMS.length, window.__salon.HF && window.__salon.HF.S]);
    if (!(n[0] >= 90) || !(n[1] > 0.5)) throw new Error(`${n[0]} cameras, head size ${n[1]}`);
  });
  await step("the side panel: fourteen steps in the work's order, closed until opened", async () => {
    const steps = await ev(() => [...document.querySelectorAll("details.step")].map(d => [d.querySelector("summary b").textContent, d.open]));
    const want = ["Character", "Reference", "Start from", "Mirror", "Locks", "Selected", "Pull", "Roots", "Gravity and motion", "Finish", "Volume", "Scalp", "Look", "Bake"];
    if (JSON.stringify(steps.map(x => x[0])) !== JSON.stringify(want.map((w, i) => `${i + 1}. ${w}`)) || steps.some(x => x[1])) throw new Error(JSON.stringify(steps));
    if (await page.isVisible("#bakebox button")) throw new Error("a closed step's buttons show");
    await openSteps();
    if (!(await page.isVisible("#bakebox button"))) throw new Error("an open step's buttons don't show");
  });
  await step("turning the view snaps onto the nearest frame; the view's camera is that frame's and its picture is drawn", async () => {
    let last = null;
    for (const a of [0, 90, 180, 270]) {
      await view(a * Math.PI / 180, -0.25, 0.85); await page.waitForTimeout(400);
      const r = await ev(() => { const s = window.__salon, c = s.SNAP; if (!c) return null; const o = s.overlay();
        return { name: c.name, angle: c.angle, mirrored: c.mirrored, shown: o.visible && o.loaded }; });
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
    const flip = await ev(() => window.__salon.overlay().flipped);
    if (!flip) throw new Error("the picture isn't flipped");
    console.log(`       270° -> frame ${r.name} mirrored`);
    await ev(() => { const s = window.__salon; s.st.reference.fit.cover = 360; s.recam(); });
  });
  await step("the fit moves the reference's cameras with it", async () => {
    await view(0, -0.25, 0.85);
    const d = await ev(() => { const s = window.__salon, c0 = s.SNAP, same = c => c.i === c0.i && c.mirrored === c0.mirrored;
      const a = s.SR.worldCamera(s.CAMS.find(same), s.HF).C; s.st.reference.fit.offset[0] += 0.02; s.recam();
      const b = s.SR.worldCamera(s.CAMS.find(same), s.HF).C; s.st.reference.fit.offset[0] -= 0.02; s.recam(); return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / s.HF.S; });
    if (Math.abs(d - 0.02) > 1e-4) throw new Error(`a 2 cm offset moved the camera ${(d * 100).toFixed(2)} cm`);
  });
  await step("the cube: a face's middle pulled bends the picture where that face looks at you, hardly elsewhere", async () => {
    await page.keyboard.press("f");
    const mid = async yaw => { await view(yaw, -0.25, 0.85); await page.waitForTimeout(300);
      return ev(() => { const P = window.__salon.overlay().pos, G = Math.round(Math.sqrt(P.length / 3)) - 1, i = ((G / 2) * (G + 1) + G / 2) * 3; return [P[i], P[i + 1]]; }); };
    const f0 = await mid(0), b0 = await mid(Math.PI);
    await view(0, -0.25, 0.85); await page.waitForTimeout(300);
    const h = await scr(await ev(() => { const s = window.__salon, c = s.st.reference.fit.cube; return c.pts[s.FFD.idx(c, 1, 1, 2)]; }));
    await page.mouse.move(...h); await page.mouse.down(); await page.mouse.move(h[0] + 25, h[1], { steps: 5 }); await page.mouse.move(h[0] + 50, h[1], { steps: 5 }); await page.mouse.up();
    const moved = await ev(() => { const s = window.__salon, c = s.st.reference.fit.cube, F = s.FFD; const p = c.pts[F.idx(c, 1, 1, 2)], r = F.rest(c, 1, 1, 2); return Math.hypot(p[0] - r[0], p[1] - r[1], p[2] - r[2]); });
    if (moved < 0.01) throw new Error(`the front face's handle moved ${(moved * 100).toFixed(2)} cm under the mouse`);
    const f1 = await mid(0), b1 = await mid(Math.PI);
    const df = Math.hypot(f1[0] - f0[0], f1[1] - f0[1]), db = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]);
    if (df < 20 || db > 0.15 * df) throw new Error(`the front's middle moved ${df.toFixed(1)} px, the back's ${db.toFixed(1)} px`);
    const handles = await ev(() => { const s = window.__salon; return s.FFD.handles(s.st.reference.fit.cube).length; });
    if (handles !== 26) throw new Error(`${handles} handles on the cube`);
    console.log(`       the front face's middle dragged ${(moved * 100).toFixed(1)} cm: the front view's middle moved ${df.toFixed(0)} px, the back's ${db.toFixed(1)} px`);
    await page.keyboard.press("Control+z");
    const rest = await ev(() => window.__salon.FFD.isRest(window.__salon.st.reference.fit.cube));
    if (!rest) throw new Error("undo didn't put the cube back");
    await page.keyboard.press("v");
    await ev(() => window.__salon.loadReference(""));
  });
  await step("a strand: a root clicked on the scalp, an end clicked", async () => {
    await view(0.5, 0.1, 1.3);
    const n0 = await count(); await page.keyboard.press("s");
    await page.mouse.click(...await scr(await surf([0.04, 0.13, 0.0])));
    const e = await scr([0.12, -0.2, 0.03]); await page.mouse.move(...e); await page.mouse.wheel(0, -200); await page.mouse.click(...e);
    const l = await ev(() => { const s = window.__salon, l = s.st.locks[s.st.locks.length - 1]; s.render(); return { type: l.type, guides: s.EVAL[l.id] ? s.EVAL[l.id].length : 0 }; });
    if (await count() !== n0 + 1 || l.type !== "strand") throw new Error(`${await count()} locks, last ${l.type}`);
  });
  await step("the strand lies on the scalp; a root on the sideburn is taken, one on the ear isn't", async () => {
    // a strand over the crown to the back of the head (no bow from the wheel) lies on it
    await view(Math.PI * 0.75, 0.35, 0.9);
    const n00 = await count(); await page.keyboard.press("s");
    await page.mouse.click(...await scr(await surf([0.02, 0.2, 0.0])));
    const e0 = await scr(await surf([0.03, 0.02, -0.2])); await page.mouse.move(...e0); await page.mouse.click(...e0);
    if (await count() !== n00 + 1) throw new Error("no strand over the crown");
    const lie = await ev(() => { const s = window.__salon, l = s.st.locks[s.st.locks.length - 1]; s.render(); return s.EVAL[l.id][0].pts.slice(1, -2).map(p => s.COL.depth(p)).sort((a, b) => a - b); });
    await page.keyboard.press("Control+z");
    if (lie[lie.length >> 1] > 0.004 || lie[lie.length - 1] > 0.008) throw new Error(`the strand is ${(lie[lie.length >> 1] * 1000).toFixed(1)} mm off the skin (median), ${(lie[lie.length - 1] * 1000).toFixed(1)} at most`);
    await view(-Math.PI / 2 + 0.25, 0.0, 0.6);
    const tries = await ev(() => { const s = window.__salon, SL = s.SL;
      const sideburn = s.COL.surface([-0.07, 0.01, 0.005]), ear = s.COL.surface([-0.085, 0.0, -0.06]);
      return { sideburn: SL.onScalp(sideburn, s.COL.C), ear: SL.onScalp(ear, s.COL.C), at: s.screenOf(sideburn) }; });
    if (!tries.sideburn || tries.ear) throw new Error(JSON.stringify(tries));
    const n0 = await count(); await page.keyboard.press("s");
    await page.mouse.click(...await scr(await surf([-0.07, 0.01, 0.005])));
    const e = await scr([-0.09, -0.08, 0.03]); await page.mouse.move(...e); await page.mouse.click(...e);
    if (await count() !== n0 + 1) throw new Error("no strand from the sideburn");
    await page.keyboard.press("Control+z");
    console.log(`       a strand over the crown lies ${(lie[lie.length >> 1] * 1000).toFixed(1)} mm off the skin (median, ${(lie[lie.length - 1] * 1000).toFixed(1)} at most); a sideburn strand placed`);
  });
  await step("Layer by height: a lock rooted higher lies over the one rooted lower where they cross; a lower lock pulled out, or hanging far below, doesn't lift it", async () => {
    const ids = await ev(() => { const s = window.__salon, SL = s.SL, C = s.COL;
      const low = SL.makeStrand(C.surface([0.065, 0.05, 0.0]), C.surface([0.08, -0.03, -0.06]), C, { name: "low", width: 0.02 });
      const high = SL.makeStrand(C.surface([0.03, 0.17, -0.01]), C.surface([0.075, -0.04, -0.03]), C, { name: "high", width: 0.02 });
      s.addLock(low); s.addLock(high); s.render(); return [low.id, high.id]; });
    const under = () => ev(([lo, hi]) => { const s = window.__salon, L = new s.SL.Layers(s.COL); L.add(s.EVAL[lo]);
      let n = 0, worst = 0; for (const G of s.EVAL[hi]) G.pts.forEach((p, k) => { if (!k) return; const d = s.SL.sub(p, s.COL.C), R = L.radius(d); if (R > 0) { const gap = s.SL.len(d) - R; if (gap < L.gap - 1e-6) { n++; worst = Math.min(worst, gap); } } });
      return { n, worst }; }, ids);
    const off = await under();
    await page.click("text=Layer by height"); await page.waitForTimeout(200); await ev(() => window.__salon.render());
    const on = await under();
    if (!(off.n > 0)) throw new Error("the two locks don't cross: the check means nothing");
    if (on.n) throw new Error(`${on.n} points of the higher lock still under the lower (${(on.worst * 1000).toFixed(1)} mm)`);
    await page.click("text=Layer by height");
    await ev(ids => { for (const id of ids) window.__salon.deleteLock(id); }, ids);
    // the user's case: a lower strand at the back pulled out from the head, another hanging far below; a higher strand
    // combed down over the first, another beside: they lie on the head under the poke (the old map lifted them 11 and 6 cm)
    const dev = await ev(() => { const s = window.__salon, SL = s.SL, C = s.COL, m = s.st.mirror.on; s.st.mirror.on = false;
      const lo = s.addLock(SL.makeStrand(C.surface([0, -0.01, -0.1]), [0, -0.22, -0.13], C, { width: 0.02 }));
      lo.pts[2] = SL.add(lo.pts[2], [0, 0.02, -0.06]); lo.pts[3] = SL.add(lo.pts[3], [0, 0, -0.03]);
      const tail = s.addLock(SL.makeStrand(C.surface([0.03, -0.02, -0.095]), [0.05, -0.4, -0.2], C, { width: 0.02 }));
      const hi = s.addLock(SL.makeStrand(C.surface([0, 0.09, -0.07]), [0, -0.22, -0.135], C, { width: 0.02 }));
      const hi2 = s.addLock(SL.makeStrand(C.surface([0.03, 0.08, -0.08]), [0.045, -0.2, -0.14], C, { width: 0.02 }));
      s.st.mirror.on = m; s.dirtyAll(); s.render();
      const flat = [hi, hi2].map(l => s.EVAL[l.id][0].pts);
      s.st.layering = true; s.dirtyAll(); s.render();
      // how far each moved: anywhere (over the lower roots, which rise out of the head, it goes over them), and away from them
      const far = p => Math.min(SL.len(SL.sub(p, lo.pts[0])), SL.len(SL.sub(p, tail.pts[0]))) > 0.03;
      const d = [hi, hi2].map((l, j) => Math.max(...s.EVAL[l.id][0].pts.map((p, k) => SL.len(SL.sub(p, flat[j][k])))));
      const away = [hi, hi2].map((l, j) => Math.max(0, ...s.EVAL[l.id][0].pts.map((p, k) => far(flat[j][k]) ? SL.len(SL.sub(p, flat[j][k])) : 0)));
      s.st.layering = false; for (const l of [lo, tail, hi, hi2]) s.deleteLock(l.id); s.render(); return [...d, ...away]; });
    if (dev[0] > 0.015 || dev[1] > 0.015 || dev[3] > 0.003) throw new Error(`the higher strands were lifted ${dev.slice(0, 2).map(x => (x * 100).toFixed(1))} cm by the poke and the hanging strand (${dev.slice(2).map(x => (x * 1000).toFixed(1))} mm away from their roots)`);
    console.log(`       crossing: ${off.n} of the higher lock's points under the lower one without it, none with it; over a lower strand pulled out, the higher one moves ${(dev[0] * 100).toFixed(1)} cm (over its base), the one beside the hanging strand ${(dev[1] * 100).toFixed(1)} (over its root; ${(dev[3] * 1000).toFixed(1)} mm away from it)`);
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
  await step("the pull is Blender's proportional editing: handles in reach move with it, less the farther they are; the wheel sizes the reach mid-drag; O turns it off; a twin's pull moves its original", async () => {
    // Blender's curves (calculatePropRatio), d = (size - r) / size; the wheel's 1.1 a notch, 1.01 with Shift
    const cur = await ev(() => { const SL = window.__salon.SL, out = {}; for (const k of Object.keys(SL.FALLOFFS)) out[k] = [0.25, 0.5, 0.75].map(d => SL.falloff((1 - d) * 0.1, 0.1, k));
      return Object.assign(out, { beyond: SL.falloff(0.1001, 0.1, "constant"), edge: SL.falloff(0.1, 0.1, "constant"), grow: [SL.growReach(0.05, true), SL.growReach(0.05, false, true)] }); });
    const want = { smooth: d => 3 * d * d - 2 * d * d * d, sphere: d => Math.sqrt(2 * d - d * d), root: Math.sqrt, inverse_square: d => d * (2 - d), sharp: d => d * d, linear: d => d, constant: () => 1 };
    for (const [k, f] of Object.entries(want)) [0.25, 0.5, 0.75].forEach((d, i) => { if (Math.abs(cur[k][i] - f(d)) > 1e-9) throw new Error(`${k}(${d}) = ${cur[k][i]}`); });
    if (cur.beyond !== 0 || cur.edge !== 1 || Math.abs(cur.grow[0] - 0.055) > 1e-12 || Math.abs(cur.grow[1] - 0.05 / 1.01) > 1e-12) throw new Error(JSON.stringify(cur));
    // two strands hanging behind the head, 2.5 cm apart; the first's fifth handle pulled sideways
    const ids = await ev(() => { const s = window.__salon, SL = s.SL, C = s.COL, m = s.st.mirror.on; s.st.mirror.on = false;
      const a = s.addLock(SL.makeStrand(C.surface([0, 0.05, -0.1]), [0, -0.2, -0.24], C)), b = s.addLock(SL.makeStrand(C.surface([0.025, 0.05, -0.1]), [0.025, -0.2, -0.24], C));
      s.st.mirror.on = m; s.select(a.id); Object.assign(s.PULL, { on: true, falloff: "smooth", size: 0.08, only: false }); s.pullPanel(); return [a.id, b.id]; });
    await view(Math.PI, 0.05, 1.1); await page.keyboard.press("v");
    const pts = () => ev(ids => { const s = window.__salon; return ids.map(id => s.SL.handles(s.st.locks.find(l => l.id === id)).map(h => h.p)); }, ids);
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const grab = async (k, fn) => { const from = await scr((await pts())[0][k]); await page.mouse.move(...from); await page.mouse.down(); await page.mouse.move(from[0] + 30, from[1] + 6, { steps: 6 }); await fn(); await page.mouse.up(); };
    const P0 = await pts(), G = 4;
    await grab(G, async () => {});
    const P1 = await pts(), dg = P1[0][G].map((x, a) => x - P0[0][G][a]);
    if (Math.hypot(...dg) < 0.01) throw new Error(`the handle moved ${(Math.hypot(...dg) * 100).toFixed(2)} cm`);
    const exp = await ev(([P0, dg, G]) => { const s = window.__salon, sm = d => 3 * d * d - 2 * d * d * d;   // Blender's smooth, by hand
      return P0.map(L => L.map((p, k) => { const r = Math.hypot(...p.map((x, a) => x - P0[0][G][a])), w = k === 0 ? 0 : r >= 0.08 ? 0 : sm((0.08 - r) / 0.08);
        return { w, q: w ? s.COL.push(p.map((x, a) => x + w * dg[a]), s.SL.GAP)[0] : p }; })); }, [P0, dg, G]);
    let worst = 0, inReach = [0, 0], still = 0;
    exp.forEach((L, j) => L.forEach((e, k) => { worst = Math.max(worst, dist(e.q, P1[j][k])); if (e.w > 0 && !(j === 0 && k === G)) inReach[j]++; if (!e.w) still++; }));
    if (worst > 1e-6) throw new Error(`a handle isn't where the smooth falloff puts it: ${worst} m off`);
    if (!inReach[0] || !inReach[1] || !still) throw new Error(`in reach: ${inReach} (this lock, the next), unmoved ${still}`);
    const wB = exp[1][G].w;
    // the reach shrunk to 1 cm: the other strand stays; the wheel (down) grows it mid-drag until it takes the other strand too
    await ev(() => { window.__salon.PULL.size = 0.01; });
    const rB = dist((await pts())[1][G], (await pts())[0][G]), notches = Math.ceil(Math.log(rB / 0.01) / Math.log(1.1)) + 1;
    let mid = null, grown = null, B0 = (await pts())[1][G];
    await grab(G, async () => { mid = (await pts())[1][G]; for (let i = 0; i < notches; i++) await page.mouse.wheel(0, 100); grown = await ev(() => window.__salon.PULL.size);
      const after = (await pts())[1][G]; mid = [dist(mid, B0), dist(after, B0)]; await page.mouse.wheel(0, -100); });
    const shrunk = await ev(() => window.__salon.PULL.size);
    if (mid[0] > 1e-9 || mid[1] < 0.001) throw new Error(`the other strand moved ${mid.map(x => (x * 1000).toFixed(2))} mm (before, after the wheel)`);
    if (Math.abs(grown - 0.01 * Math.pow(1.1, notches)) > 1e-9 || Math.abs(shrunk - grown / 1.1) > 1e-9) throw new Error(`the reach ${grown}, ${shrunk}`);
    // O: off, only the handle moves
    await page.keyboard.press("o"); const on = await ev(() => window.__salon.PULL.on);
    const Q0 = await pts(); await grab(G, async () => {}); const Q1 = await pts();
    const others = Q0.flatMap((L, j) => L.map((p, k) => j === 0 && k === G ? 0 : dist(p, Q1[j][k])));
    await page.keyboard.press("o");
    if (on || Math.max(...others) > 1e-9 || dist(Q0[0][G], Q1[0][G]) < 0.005) throw new Error(`with O off: on ${on}, others moved ${Math.max(...others)}`);
    await ev(ids => { const s = window.__salon; for (const id of ids) s.deleteLock(id); s.PULL.size = 0.08; s.pullPanel(); }, ids);
    // the twin's handle pulled (the sidelock's mirror): its original moves, mirrored
    const tw = await ev(() => { const s = window.__salon, t = s.st.locks.find(l => l.mirror_of); s.select(t.id); return { id: t.id, of: t.mirror_of, h: t.edges[1][3], o: s.st.locks.find(l => l.id === t.mirror_of).edges[1][3] }; });
    await view(Math.PI / 2, 0.05, 1.1);
    const f = await scr(tw.h); await page.mouse.move(...f); await page.mouse.down(); await page.mouse.move(f[0] + 35, f[1] + 10, { steps: 6 }); await page.mouse.up();
    const t2 = await ev(tw => { const L = window.__salon.st.locks; return { h: L.find(l => l.id === tw.id).edges[1][3], o: L.find(l => l.id === tw.of).edges[1][3], seam: window.__salon.st.mirror.seam }; }, tw);
    const mirrorErr = Math.hypot(2 * t2.seam - t2.h[0] - t2.o[0], t2.h[1] - t2.o[1], t2.h[2] - t2.o[2]);
    if (dist(t2.o, tw.o) < 0.005 || dist(t2.h, tw.h) < 0.005 || mirrorErr > 1e-9) throw new Error(`the twin's pull: original moved ${dist(t2.o, tw.o)}, twin ${dist(t2.h, tw.h)}, mirror off by ${mirrorErr}`);
    console.log(`       pulled ${(Math.hypot(...dg) * 100).toFixed(1)} cm: ${inReach[0]} more handles on its strand and ${inReach[1]} on the next (${(wB * 100).toFixed(0)}% at 2.5 cm) by the smooth falloff, ${still} beyond the 8 cm reach still; ${notches} notches grew the reach to ${(grown * 100).toFixed(2)} cm and took the next strand; the twin's pull moved its original ${(dist(t2.o, tw.o) * 100).toFixed(1)} cm`);
  });
  await step("a bundle line: the line dragged along the scalp is its width, the wheel makes it an oval, Height changes it", async () => {
    await view(Math.PI * 0.8, 0.35, 0.9); await page.keyboard.press("d");
    const sa = await scr(await surf([-0.025, 0.14, -0.07])), sb = await scr(await surf([0.025, 0.14, -0.07]));
    const [A, B] = await ev(q => q.map(([x, y]) => window.__salon.COL.surface(window.__salon.headAt(x, y))), [sa, sb]);   // where the clicks land
    await page.mouse.move(...sa); await page.mouse.down(); await page.mouse.move((sa[0] + sb[0]) / 2, (sa[1] + sb[1]) / 2); await page.mouse.move(...sb); await page.mouse.up();
    for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 100);      // down: flatter, a tenth a notch
    const tip = await scr([0.0, -0.06, -0.2]); await page.mouse.move(...tip); await page.mouse.click(...tip);
    const ring = () => ev(() => { const s = window.__salon, SL = s.SL, l = s.st.locks.find(x => x.id === s.selected); s.render(); const G = s.EVAL[l.id], c = l.spine[0];
      const e = j => SL.len(SL.sub(G[j].pts[0], c)), twin = s.st.locks.find(x => x.mirror_of === l.id);
      // the width's way: the line, squared to where the bundle leaves the root
      const t0 = SL.norm(SL.cross(SL.sub(G[0].pts[0], c), SL.sub(G[2].pts[0], c))), u = SL.norm(SL.sub(l.axis, SL.mul(t0, SL.dot(l.axis, t0))));   // the ring's own plane
      return { type: l.type, r0: l.r0, height: l.height, axis: l.axis, along: Math.abs(SL.dot(SL.norm(SL.sub(G[0].pts[0], c)), u)), ratio: e(2) / e(0), twinAxis: twin ? twin.axis : SL.mirrored(l, 0.01, s.COL).axis }; });
    const r = await ring(), w = Math.hypot(...B.map((x, a) => x - A[a]));
    if (r.type !== "bundle" || !r.axis || Math.abs(2 * r.r0 - w) > 1e-6 || r.along < 0.9999) throw new Error(`not the line's width: ${JSON.stringify(r)}, the line ${w}`);
    if (Math.abs(r.height - Math.pow(1.1, -5)) > 1e-6 || Math.abs(r.ratio - r.height) > 0.01) throw new Error(`the wheel's oval: ${JSON.stringify(r)}`);
    if (Math.abs(r.twinAxis[0] + r.axis[0]) > 1e-9 || Math.abs(r.twinAxis[1] - r.axis[1]) > 1e-9 || Math.abs(r.twinAxis[2] - r.axis[2]) > 1e-9) throw new Error("a twin's width isn't mirrored");
    await page.$$eval("#selbox .row", rows => { const row = rows.find(x => x.querySelector("span") && x.querySelector("span").textContent === "Height"); const i = row.querySelector("input"); i.value = 1.5; i.dispatchEvent(new Event("input")); });
    const r2 = await ring();
    if (Math.abs(r2.height - 1.5) > 1e-9 || Math.abs(r2.ratio - 1.5) > 0.01) throw new Error(`Height didn't make it taller: ${JSON.stringify(r2)}`);
    await ev(() => { const s = window.__salon; s.deleteLock(s.selected); });
    console.log(`       ${(w * 100).toFixed(1)} cm line -> ${(r.r0 * 200).toFixed(1)} cm across; 5 notches -> height ${(r.height * 100).toFixed(0)}% (the ring ${(r.ratio * 100).toFixed(0)}%), the slider 150%; a twin's width mirrored`);
  });
  await step("thickness on a strand and a sheet: off by default, a dome as high as half the width at 1, thinning to the tip by its taper", async () => {
    const ids = await ev(() => { const s = window.__salon, SL = s.SL, C = s.COL, m = s.st.mirror.on; s.st.mirror.on = false;
      const a = s.addLock(SL.makeStrand(C.surface([0, 0.1, -0.08]), [0, -0.15, -0.17], C, { width: 0.02 }));
      const b = s.addLock(SL.makeSheet([C.surface([-0.03, 0.12, -0.07]), C.surface([0, 0.125, -0.075]), C.surface([0.03, 0.12, -0.07])], [0, -0.15, -0.18], 0.06, C));
      s.st.mirror.on = m; s.select(a.id); s.render(); return [a.id, b.id]; });
    const slide = (label, v) => page.$$eval("#selbox .row", (rows, [label, v]) => { const row = rows.find(x => x.querySelector("span") && x.querySelector("span").textContent === label); const i = row.querySelector("input"); i.value = v; i.dispatchEvent(new Event("input")); return +row.querySelector("output").textContent; }, [label, v]);
    const shape = id => ev(id => { const s = window.__salon, SL = s.SL, l = s.st.locks.find(x => x.id === id); s.render(); const G = s.EVAL[id], n = G[0].pts.length;
      const W = k => l.type === "strand" ? G[0].width[k] : SL.len(SL.sub(G[l.guides - 1].pts[k], G[0].pts[k]));
      const top = G.filter(g => Math.abs(g.u - 0.5) < 0.01).pop(), mid = k => l.type === "strand" ? G[0].pts[k] : SL.mix(G[(l.guides - 1) >> 1].pts[k], G[l.guides >> 1].pts[k], 0.5);
      const lift = k => SL.len(SL.sub(top.pts[k], mid(k)));
      return { guides: G.length, base: l.type === "strand" ? 1 : l.guides, root: lift(0) / (W(0) / 2), tip: lift(n - 1) / (W(n - 1) / 2), half: lift(n >> 1) / (W(n >> 1) / 2), at: G[0].t ? G[0].t[n >> 1] : (n >> 1) / (n - 1) }; }, id);
    const flat = await shape(ids[0]);
    const def = await ev(() => { const rows = [...document.querySelectorAll("#selbox .row")], v = l => +rows.find(x => x.querySelector("span").textContent === l).querySelector("input").value; return [v("Thickness"), v("Thickness taper")]; });
    if (flat.guides !== 1 || def[0] !== 0 || def[1] !== 1) throw new Error(`a new strand isn't flat by default: ${flat.guides} guides, Thickness ${def[0]}, taper ${def[1]}`);
    await slide("Thickness", 1); const round = await shape(ids[0]);
    await slide("Thickness taper", 0); const even = await shape(ids[0]);
    await ev(id => window.__salon.select(id), ids[1]); await slide("Thickness", 0.5); const sheet = await shape(ids[1]);
    await ev(id => { const s = window.__salon, l = s.st.locks.find(x => x.id === id); l.render = "strands"; s.dirtyAll(); s.render(); }, ids[1]);
    const strands = await ev(id => window.__salon.MESHES[id].children.find(o => o.userData.role === "strands").geometry.attributes.position.count, ids[1]);
    if (round.guides !== 4 || Math.abs(round.root - 1) > 0.03 || round.tip > 0.01 || Math.abs(round.half - (1 - round.at)) > 0.06) throw new Error(`the round strand: ${JSON.stringify(round)}`);
    if (Math.abs(even.tip - 1) > 0.05 || Math.abs(even.half - 1) > 0.05) throw new Error(`taper 0 should keep it round to the tip: ${JSON.stringify(even)}`);
    if (sheet.guides <= sheet.base || Math.abs(sheet.root - 0.5) > 0.03 || sheet.tip > 0.01 || !strands) throw new Error(`the sheet: ${JSON.stringify(sheet)}, ${strands} strand vertices`);
    await ev(ids => { for (const id of ids) window.__salon.deleteLock(id); }, ids);
    console.log(`       a strand: 1 card flat, 4 at 1 (the dome at the root ${(round.root * 100).toFixed(0)}% of half its width, ${(round.at * 100).toFixed(0)}% along ${(round.half * 100).toFixed(0)}%, the tip ${(round.tip * 100).toFixed(0)}%; taper 0: ${(even.tip * 100).toFixed(0)}% at the tip); a sheet at 0.5: ${sheet.base} -> ${sheet.guides} guides, ${(sheet.root * 100).toFixed(0)}% at the root; its strands drawn round the dome`);
  });
  await step("the roots: hair leaves the scalp at its lift and bends over (Lift 0: flat from the root), and gravity doesn't flatten it", async () => {
    const id = await ev(() => { const s = window.__salon, SL = s.SL, C = s.COL, m = s.st.mirror.on; s.st.mirror.on = false;
      const l = s.addLock(SL.makeStrand(C.surface([0.01, 0.19, -0.02]), [0.02, -0.15, -0.16], C, { width: 0.01 })); s.st.mirror.on = m; s.select(null); s.render(); return l.id; });
    const leaves = () => ev(id => { const s = window.__salon, SL = s.SL; s.render(); const P = s.EVAL[id][0].pts, n0 = s.COL.normal(P[0]);
      return { angle: Math.max(...[1, 2, 3].map(k => Math.asin(SL.dot(SL.norm(SL.sub(P[k], P[0])), n0)) * 180 / Math.PI)), peak: Math.max(...P.slice(1, 6).map(p => s.COL.depth(p))) }; }, id);
    const lift = v => page.$$eval("#rootbox .row", (rows, v) => { const row = rows.find(x => x.querySelector("span").textContent === "Lift"); const i = row.querySelector("input"); i.value = v; i.dispatchEvent(new Event("input")); }, v);
    const on = await leaves(); await lift(0); const flat = await leaves(); await lift(40);
    await page.click("#dropSwitch"); await page.waitForFunction(() => window.__salon.drop.state && window.__salon.drop.state.frames > 30, null, { timeout: 30000 });
    await ev(() => window.__salon.drop.pause()); await page.click("#dropSwitch"); const fallen = await leaves();
    await page.keyboard.press("Control+z"); await ev(id => window.__salon.deleteLock(id), id);
    if (on.angle < 20 || flat.angle > on.angle - 10 || fallen.angle < 20 || on.peak > 0.012) throw new Error(`the root leaves at ${on.angle.toFixed(1)} deg (lift 0: ${flat.angle.toFixed(1)}; after gravity: ${fallen.angle.toFixed(1)}), ${(on.peak * 1000).toFixed(1)} mm high`);
    console.log(`       lift 40: it leaves the scalp at ${on.angle.toFixed(0)} deg and bends over (${(on.peak * 1000).toFixed(1)} mm at most); lift 0: ${flat.angle.toFixed(0)} deg; after gravity: ${fallen.angle.toFixed(0)} deg`);
  });
  await step("the cover: a parting along the head's middle, each root a Y up through the hair and out to both sides over it, as long as the top hair; it falls onto the hair, rubbing, and is kept as shown", async () => {
    // a crown with a hole: four sheets rooted round it, combed out and down
    const crown = await ev(() => { const s = window.__salon, SL = s.SL, C = s.COL, m = s.st.mirror.on; s.st.mirror.on = false;
      const crown = C.surface([0, 0.2, -0.045]), n = C.normal(crown), a = SL.norm(SL.cross(n, [1, 0, 0])), b = SL.cross(n, a), ids = [];
      for (let i = 0; i < 4; i++) { const th = (i + 0.5) / 4 * 2 * Math.PI, d = SL.add(SL.mul(a, Math.cos(th)), SL.mul(b, Math.sin(th))), side = SL.cross(n, d), at = r => C.surface(SL.add(crown, SL.mul(d, r)));
        ids.push(s.addLock(SL.makeSheet([C.surface(SL.add(at(0.03), SL.mul(side, -0.015))), at(0.03), C.surface(SL.add(at(0.03), SL.mul(side, 0.015)))], SL.add(SL.add(crown, SL.mul(d, 0.14)), [0, -0.15, 0]), 0.06, C)).id); }
      s.st.mirror.on = m; s.select(null); s.render(); return ids; });
    const n0 = await count();
    await page.click("#coverbox label:text('Show the parting')");
    const pre = await ev(() => { const s = window.__salon, row = [...document.querySelectorAll("#coverbox .row")].find(x => x.querySelector("span").textContent === "Length");
      return { shown: s.cover.settings.show, length: +row.querySelector("input").value, top: s.cover.topLength() * 100, n: s.cover.preview().length }; });
    if (!pre.shown || Math.abs(pre.length - pre.top) > 0.25 || pre.n < 2) throw new Error(`the preview: ${JSON.stringify(pre)}`);
    const drawn = () => ev(() => { const s = window.__salon, out = {}; s.render(); for (const l of s.st.locks) { const g = s.MESHES[l.id], c = g && g.children.find(o => o.userData.role === "cards"); if (c) out[l.id] = Array.from(c.geometry.attributes.position.array); } return out; });
    const before = await drawn();
    await page.click("#coverbox button:text-is('Make the hair')");
    const made = await ev(() => { const s = window.__salon, SL = s.SL, L = s.st.locks.filter(l => l.cover), seam = s.st.mirror.seam; s.drop.pause(); s.drop.show(0);
      const over = new SL.Layers(s.COL); for (const l of s.st.locks.filter(l => l.visible && !l.cover).sort((a, b) => a.id < b.id ? -1 : 1)) over.add(s.EVAL[l.id]);
      const arm = l => SL.length(l.edges[1].slice(1));
      return { n: L.length, ids: L.map(l => l.id), group: L.every(l => l.group === "cover"), falling: !!(s.drop.state && s.drop.state.frames),
               roots: Math.max(...L.flatMap(l => l.root.map(p => Math.max(Math.abs(p[0] - seam), s.COL.depth(p))))),
               sides: L.map(l => Math.sign(l.edges[1][l.edges[1].length - 1][0] - seam) * (l.name.endsWith("left") ? 1 : -1)),
               arms: L.map(arm), length: s.cover.settings.length ?? s.cover.topLength(),
               forksUnder: L.flatMap(l => l.edges.map(E => E[1])).filter(p => SL.len(SL.sub(over.push(p), p)) > 1e-6).length,
               forksLifted: L.flatMap(l => l.edges.map(E => SL.len(SL.sub(E[1], E[0])))).filter(d => d > 0.004).length,
               top: L.map(l => l.edges[1].slice(1, 5)) }; });
    if (made.n < 2 || made.n % 2 || !made.group || !made.falling || made.roots > 0.003) throw new Error(`made: ${JSON.stringify(made).slice(0, 300)}`);
    if (made.sides.some(x => x !== 1)) throw new Error(`an arm reaches the wrong side: ${made.sides}`);
    if (made.arms.some(a => Math.abs(a / made.length - 1) > 0.1)) throw new Error(`the arms aren't the top hair's length (${made.length}): ${made.arms}`);
    if (made.forksUnder || !made.forksLifted) throw new Error(`the forks: ${made.forksUnder} under the hair, ${made.forksLifted} lifted onto it`);
    await ev(() => window.__salon.drop.run());
    await page.waitForFunction(() => window.__salon.drop.state && window.__salon.drop.state.frames > 45, null, { timeout: 60000 });
    await ev(() => { const s = window.__salon; s.drop.pause(); s.drop.show(s.drop.state.frames - 1); });
    const shown = await drawn(); await page.click("#dropSwitch"); const kept = await drawn();
    let off = 0, still = 0; for (const id in kept) { const a = shown[id], b = kept[id]; if (!a || a.length !== b.length) { off = Infinity; continue; } for (let i = 0; i < a.length; i++) off = Math.max(off, Math.abs(a[i] - b[i])); if (before[id]) for (let i = 0; i < b.length; i++) still = Math.max(still, Math.abs(before[id][i] - b[i])); }
    const lay = await ev(ids => { const s = window.__salon, SL = s.SL, over = new SL.Layers(s.COL); for (const l of s.st.locks.filter(l => l.visible && !l.cover).sort((a, b) => a.id < b.id ? -1 : 1)) over.add(s.EVAL[l.id]);
      let n = 0, under = 0; for (const id of ids) for (const G of s.EVAL[id]) { let arc = 0;              // past the root, which rises through the hair
        G.pts.forEach((p, k) => { if (k) arc += SL.len(SL.sub(p, G.pts[k - 1])); if (arc < 0.045 || p[1] < s.COL.chin - 0.03) return; const d = SL.sub(p, s.COL.C), R = over.radius(d); if (R > 0) { n++; if (SL.len(d) < R + over.gap - 1e-6) under++; } }); }
      return { n, under, top: ids.map(id => s.st.locks.find(l => l.id === id).edges[1].slice(1, 5)) }; }, made.ids);
    const slid = Math.max(...lay.top.flatMap((E, j) => E.map((p, k) => Math.hypot(...p.map((x, a) => x - made.top[j][k][a])))));
    if (off > 1e-6 || still > 1e-6) throw new Error(`switched off, the cover moved ${off} m from what was shown; the other hair moved ${still} m`);
    if (!lay.n || lay.under) throw new Error(`${lay.under} of ${lay.n} cover points over other hair are under it`);
    if (slid > 0.015) throw new Error(`the cover slid ${(slid * 100).toFixed(1)} cm on top of the head: no friction`);
    await page.keyboard.press("Control+z"); await page.keyboard.press("Control+z");
    if (await count() !== n0 || await ev(() => window.__salon.st.groups.some(g => g.id === "cover"))) throw new Error("two undos didn't take the cover away");
    await ev(ids => { const s = window.__salon; for (const id of ids) s.deleteLock(id); s.cover.settings.show = false; s.coverPanel(); s.render(); }, crown);
    console.log(`       ${made.n} sheets on the parting (roots ${(made.roots * 1000).toFixed(1)} mm off the middle and the skin), arms ${(made.length * 100).toFixed(1)} cm (the top hair's), ${made.forksLifted} forks lifted onto the hair; over it past their roots (${lay.n} points, none under); on top it slid ${(slid * 1000).toFixed(1)} mm (friction); kept as shown, the rest unmoved; undone`);
  });
  await step("Thicken: every card as much wider, the strands where they were", async () => {
    const id = await ev(() => { const s = window.__salon, SL = s.SL, C = s.COL, m = s.st.mirror.on; s.st.mirror.on = false;
      const l = s.addLock(SL.makeStrand(C.surface([0.02, 0.15, -0.06]), [0.03, -0.12, -0.16], C, { width: 0.01 })); s.st.mirror.on = m; s.render(); return l.id; });
    const card = () => ev(id => { const s = window.__salon; s.render(); const G = s.EVAL[id][0]; return { w: G.width.slice(), p: G.pts.map(q => q.slice()) }; }, id);
    const slide = v => page.$$eval("#volbox .row", (rows, v) => { const row = rows.find(x => x.querySelector("span").textContent === "Thicken"); const i = row.querySelector("input"); i.value = v; i.dispatchEvent(new Event("input")); }, v);
    const a = await card(); await slide(2); const b = await card(); await slide(1);
    await ev(id => window.__salon.deleteLock(id), id);
    const ratio = Math.max(...b.w.map((w, k) => Math.abs(w / a.w[k] - 2))), moved = Math.max(...b.p.map((q, k) => Math.hypot(...q.map((x, j) => x - a.p[k][j]))));
    if (ratio > 1e-9 || moved > 1e-9) throw new Error(`Thicken 2: widths off by ${ratio}, the guide moved ${moved} m`);
    console.log("       Thicken 2: every card twice as wide, the guide where it was");
  });
  await step("the presets: all eight build on the head (mirrored, the scalp covered); the long cut falls and is kept with the face clear; undo brings the hair back", async () => {
    const before = await ev(() => JSON.stringify(window.__salon.st.locks));
    const all = await ev(() => { const s = window.__salon, SL = s.SL, L = s.localPoints(), out = [];
      for (const p of s.presets.list) {
        s.presets.apply(p.id); s.render();
        const env = new SL.Envelope(s.COL); for (const l of s.st.locks) env.add(s.EVAL[l.id]);
        let n = 0, covered = 0, inside = 0, nan = 0;
        for (let i = 0; i < L.length; i += 3) { const q = [L[i], L[i + 1], L[i + 2]]; if (!SL.onScalp(q, s.COL.C) || SL.len(SL.sub(q, s.COL.C)) > 0.17) continue; n++; if (env.under(q) > 0.001) covered++; }
        for (const l of s.st.locks) for (const G of s.EVAL[l.id]) G.pts.forEach((q, k) => { if (!q.every(Number.isFinite)) nan++; else if (k && s.COL.push(q, -0.001)[1]) inside++; });
        out.push({ id: p.id, who: p.who, locks: s.st.locks.length, twins: s.st.locks.filter(l => l.mirror_of).length, cover: covered / n, inside, nan, lift: s.st.roots.lift });
      }
      return out; });
    for (const r of all) if (r.locks < 10 || !r.twins || r.cover < 0.9 || r.inside || r.nan) throw new Error(`${r.id}: ${JSON.stringify(r)}`);
    await ev(() => window.__salon.presets.apply("w_long"));
    await page.click("#dropSwitch"); await page.waitForFunction(() => window.__salon.drop.state && window.__salon.drop.state.frames > 45, null, { timeout: 120000 });
    await ev(() => window.__salon.drop.pause()); await page.click("#dropSwitch");
    const face = await ev(() => { const s = window.__salon, C = s.COL.C; s.render(); let n = 0;
      for (const l of s.st.locks) for (const G of s.EVAL[l.id]) for (const q of G.pts) if (Math.abs(q[0] - C[0]) < 0.035 && q[1] > -0.07 && q[1] < 0.02 && q[2] > C[2] + 0.06) n++;
      return n; });
    if (face) throw new Error(`${face} points of the long cut's hair hang in front of the face after the fall`);
    for (let i = 0; i < all.length + 2; i++) await page.keyboard.press("Control+z");
    const back = await ev(() => JSON.stringify(window.__salon.st.locks));
    if (back !== before) throw new Error("undo didn't bring the hair back");
    console.log(`       ${all.map(r => `${r.id} ${r.locks} locks ${(r.cover * 100).toFixed(0)}%`).join(", ")} of the scalp covered; the long cut fell, the face clear; undone`);
  });
  await step("padding: the base filled out (the scalp covered, cards along the hair, under the smooth outside, off the body); physics left out; a base group alone; in the bake", async () => {
    const r = await ev(async () => { const s = window.__salon, SL = s.SL, V = s.st.volume;
      s.presets.apply("w_long"); V.padding = true; V.thickness = 0.5; s.render(); s.volume.refresh();
      const P = s.volume.pad, c = s.volume.check, base = s.volume.baseLocks();
      // along the hair: each padding card's direction against the nearest base guide's, at a few points each
      const pts = []; for (const l of base) for (const G of s.EVAL[l.id]) G.pts.forEach((p, k) => { if (k && k < G.pts.length - 1 && p[1] > s.COL.chin - 0.03) pts.push([p, SL.norm(SL.sub(G.pts[k + 1], G.pts[k - 1]))]); });
      let agree = 0, n = 0, inside = 0, above = 0;
      for (const G of P.cards) for (const k of [4, 10, 16]) {
        const p = G.pts[k], tg = SL.norm(SL.sub(G.pts[k + 1], G.pts[k - 1])); let best = null, bd = 1e9;
        for (const [q, t] of pts) { const d = SL.len(SL.sub(q, p)); if (d < bd) { bd = d; best = t; } }
        agree += Math.abs(SL.dot(tg, best)); n++;
        if (s.COL.push(p, -0.001)[1]) inside++;
        const d = SL.sub(p, s.COL.C), R = P.hull.at(SL.norm(d)); if (R && SL.len(d) > R + 0.001) above++;
      }
      const sumPts = L => L.reduce((a, l) => a + s.EVAL[l.id].reduce((b, G) => b + G.pts.length, 0), 0);
      const all = { cards: P.cards.length, before: c.before, after: c.after, agree: agree / n, inside, above, points: P.stats.points, expected: sumPts(base) };
      // a lock with physics is left out
      const ph = base.find(l => l.group === "back"); ph.physics = Object.assign({}, s.SP ? {} : {}, { on: true }); s.render(); s.volume.refresh();
      all.withPhysics = s.volume.pad.stats.points; all.expectedPhysics = sumPts(s.volume.baseLocks()); all.physicsOut = !s.volume.baseLocks().includes(ph); ph.physics.on = false;
      // the base: one group ticked
      const g = s.st.groups.find(g => g.id === "top"); g.base = true; s.dirtyAll(); s.render(); s.volume.refresh();   // (as the ▣ toggle does)
      all.groupPoints = s.volume.pad.stats.points; all.groupExpected = sumPts(s.st.locks.filter(l => l.group === "top" && !(l.physics && l.physics.on))); g.base = false; s.dirtyAll();
      // in the bake: the still mesh has the padding's cards
      document.querySelector("#hairName").value = "_salontest"; s.render(); s.volume.refresh();
      const on = await s.bake(); V.padding = false; s.render(); const off = await s.bake();
      all.bakeOn = on.static.vertices; all.bakeOff = off.static.vertices; all.padCards = on.padding && on.padding.cards;
      return all; });
    await page.keyboard.press("Control+z");
    if (r.cards < 30 || r.after < r.before || r.after < 0.97 || r.agree < 0.75 || r.inside || r.above) throw new Error(`the padding: ${JSON.stringify(r)}`);
    if (r.points !== r.expected || r.withPhysics !== r.expectedPhysics || !r.physicsOut || r.groupPoints !== r.groupExpected) throw new Error(`what it's made of: ${JSON.stringify(r)}`);
    if (!(r.bakeOn > r.bakeOff) || r.padCards !== r.cards) throw new Error(`the bake: ${JSON.stringify(r)}`);
    console.log(`       the long cut: ${r.cards} padding cards, the scalp covered ${(r.before * 100).toFixed(0)}% -> ${(r.after * 100).toFixed(0)}%, along the hair (mean |cos| ${r.agree.toFixed(2)}), none in the body or over the smooth outside; a physics lock left out; one base group alone; the bake ${r.bakeOff} -> ${r.bakeOn} still vertices`);
  });
  await step("the base: baked alone; hidden, it still holds up the strands outside it; Clip blend 0 lets one sink in, 1 lays it on, 0.5 half; the main bake keeps the hidden base", async () => {
    const r = await ev(async () => { const s = window.__salon, SL = s.SL, C = s.COL, V = s.st.volume;
      s.presets.apply("w_long"); V.padding = true; V.thickness = 0.5;
      for (const g of s.st.groups) g.base = true;                       // all of it the base
      s.st.groups.push({ id: "flourish", name: "Flourish", visible: true });
      const m = s.st.mirror.on; s.st.mirror.on = false;
      const f = SL.makeStrand(C.surface([0.02, 0.17, -0.05]), C.surface([0.05, 0.0, -0.12]), C, { width: 0.015 }); SL.hug(f, C);   // on the scalp: inside the base
      f.group = "flourish"; f.name = "flourish"; s.st.locks.push(f);
      s.st.mirror.on = m; s.dirtyAll(); s.render(); s.volume.refresh();
      // how far under the base's outside the flourish sits (its points over the head, past its root)
      const under = () => { s.dirtyAll(); s.render(); const B = s.volume.base, G = s.EVAL[f.id][0]; let sum = 0, n = 0, max = 0;
        G.pts.forEach((p, k) => { if (k < 6 || p[1] < C.chin - 0.03) return; const d = SL.sub(p, C.C), R = B.hull.at(SL.norm(d)); if (!R) return; const u = Math.max(0, R + 0.0015 - SL.len(d)); sum += u; n++; max = Math.max(max, u); });
        return { mean: sum / Math.max(1, n), max, n }; };
      V.blend = 0; const b0 = under(); V.blend = 1; const b1 = under(); V.blend = 0.5; const bh = under(); V.blend = 1;
      document.querySelector("#hairName").value = "_salontest";
      const bb = await s.volume.bakeBase();
      s.volume.showBase(false); const hid = under(); const shownBase = s.st.groups.filter(g => g.base).some(g => g.visible);
      const full = await s.bake();
      return { b0, b1, bh, bb, hid, shownBase, staticV: full.static.vertices };
    });
    for (let i = 0; i < 2; i++) await page.keyboard.press("Control+z");
    await ev(() => { const s = window.__salon; s.presets.apply("w_long"); });
    await page.keyboard.press("Control+z"); await page.keyboard.press("Control+z");
    await ev(() => { const s = window.__salon; s.st.volume.padding = false; s.dirtyAll(); s.render(); });
    if (!(r.b0.mean > 0.002) || r.b1.max > 1e-6 || !(r.bh.mean > r.b0.mean * 0.3 && r.bh.mean < r.b0.mean * 0.7)) throw new Error(`Clip blend: ${JSON.stringify(r)}`);
    if (!r.bb || !(r.bb.locks > 10) || !(r.bb.padding > 0) || r.hid.max > 1e-6 || r.shownBase || !(r.staticV > r.bb.vertices * 0.5)) throw new Error(`the base: ${JSON.stringify(r)}`);
    const glb = fs.readFileSync(path.join(ROOT, "Content", "Studio", "Hair", TEST, "salon_base.glb")); if (glb.toString("ascii", 0, 4) !== "glTF") throw new Error("salon_base.glb isn't a glTF");
    console.log(`       Clip blend 0: the flourish ${(r.b0.mean * 1000).toFixed(1)} mm into the base (mean), 1: on it, 0.5: ${(r.bh.mean * 1000).toFixed(1)} mm; the base baked alone (${r.bb.locks} locks, ${r.bb.padding} padding cards, ${r.bb.vertices} vertices); hidden, it still holds the flourish up; the main bake keeps it (${r.staticV} still vertices)`);
  });
  await step("the darkened scalp: on by default in the roots' colour, full on the crown, nothing on the face, faded at the hairline; Thickness changes it", async () => {
    // the face: every vertex in front (within 28 degrees of straight ahead) below 4 cm over the ears' line
    const r = await ev(() => { const s = window.__salon, i = s.scalpInfo(); if (!i) return null; const A = i.alpha, L = s.localPoints(), C = s.COL.C;
      let face = 0, faceN = 0; for (let k = 0; k < A.length; k++) { const x = L[k * 3], y = L[k * 3 + 1], z = L[k * 3 + 2]; const az = Math.abs(Math.atan2(x, z - C[2])) * 180 / Math.PI; if (az < 28 && y < 0.04 && y > -0.12 && z > C[2]) { faceN++; if (A[k] > 0) face++; } }
      return { vertices: i.vertices, max: Math.max(...A), face, faceN, soft: A.filter(a => a > 0 && a < s.st.scalp.thickness - 1e-6).length }; });
    if (!r || r.vertices < 500 || Math.abs(r.max - 0.7) > 1e-6 || r.face || r.faceN < 100 || r.soft < 20) throw new Error(JSON.stringify(r));
    const r2 = await ev(() => { const s = window.__salon; s.st.scalp.thickness = 0.3; s.scalpPanel(); s.dirtyAll(); s.render(); return Math.max(...s.scalpInfo().alpha); });
    if (Math.abs(r2 - 0.3) > 1e-6) throw new Error("Thickness didn't change it: " + r2);
    await ev(() => { const s = window.__salon; s.st.scalp.thickness = 0.7; s.scalpPanel(); s.render(); });
    console.log(`       ${r.vertices} vertices on the scalp, full (0.7) on the crown, ${r.soft} fading at the hairline, none of the face's ${r.faceN}`);
  });
  await step("the hair look: a strand atlas see-through at its tips, the shader on every card, a look restyling them all", async () => {
    const T = await import(path.join(__dirname, "hairtex.js"));
    const prof = T.coverageProfile(T.makeAtlas());
    if (!(prof[1] > 0.55 && prof[9] < 0.1)) throw new Error("the atlas's coverage root to tip: " + prof.join(" "));
    const r = await ev(() => { const s = window.__salon; let cards = 0, hair = 0; for (const id in s.MESHES) s.MESHES[id].traverse(o => { if (o.userData.role === "cards") { cards++; if (o.material.userData.hair && o.geometry.attributes.aTangent && o.geometry.attributes.aDepth) hair++; } });
      const before = s.HAIRU.tipC.value.getHex(); s.st.look.hair = "chestnut"; s.restyle(); const after = s.HAIRU.tipC.value.getHex(); s.st.look.hair = "jet_blue"; s.restyle();
      return { cards, hair, changed: before !== after }; });
    if (!r.cards || r.cards !== r.hair || !r.changed) throw new Error(JSON.stringify(r));
    console.log(`       coverage root to tip ${prof.map(x => x.toFixed(2)).join(" ")}; ${r.hair} cards on the hair shader; a look restyles them`);
  });
  await step("physics on the bundle: a shake swings its tip, its root stays on the head, it settles back to its style", async () => {
    const id = await ev(() => window.__salon.st.locks.find(l => l.type === "bundle").id);
    await ev(id => window.__salon.select(id), id);
    await page.click("text=Physics (it swings)");
    await view(Math.PI * 0.8, 0.1, 1.4);
    await page.click("#movebox button:text-is('shake')");
    let peak = 0; for (let k = 0; k < 8; k++) { await page.waitForTimeout(150); peak = Math.max(peak, await ev(id => window.__salon.tipOffset(id), id)); }
    const bad = await ev(id => { const s = window.__salon, it = s.SIM.items.find(x => x.id === id), Mi = s.MESHES[id].parent.matrix.clone().invert(); let nan = 0, inside = 0, root = 0;
      const T = p => { const e = Mi.elements; return [e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12], e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13], e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14]]; };
      for (const c of it.chains) { c.x.forEach((p, i) => { if (!p.every(Number.isFinite)) nan++; else if (i && s.COL.push(T(p), -0.002)[1]) inside++; }); const r0 = T(c.x[0]); root = Math.max(root, Math.hypot(r0[0] - c.rest[0][0], r0[1] - c.rest[0][1], r0[2] - c.rest[0][2])); }
      return { nan, inside, root }; }, id);
    if (peak < 0.01) throw new Error(`the tip swung ${(peak * 100).toFixed(2)} cm`);
    if (bad.nan || bad.inside || bad.root > 1e-6) throw new Error(JSON.stringify(bad));
    await page.click("#movebox button:text-is('still')");
    await page.waitForFunction(() => !window.__salon.PLAYING, null, { timeout: 15000 });
    console.log(`       the tip swung up to ${(peak * 100).toFixed(1)} cm; still, it settled and the loop stopped`);
  });
  await step("Gravity: all the hair falls; the slider goes back; switched off, the moment shown is kept exactly (a twin, layers on); undo brings it back", async () => {
    // what's drawn: every lock's cards, as positions
    const drawn = () => ev(() => { const s = window.__salon, out = {}; for (const l of s.st.locks) { const g = s.MESHES[l.id], c = g && g.children.find(o => o.userData.role === "cards"); if (c) out[l.id] = Array.from(c.geometry.attributes.position.array); } return out; });
    await ev(() => { const s = window.__salon; s.st.layering = true; s.dirtyAll(); s.render(); });
    const tips = () => ev(() => window.__salon.st.locks.map(l => { const P = l.type === "strand" ? l.pts : l.type === "bundle" ? l.spine : l.edges[1]; return [P[0].slice(), P[P.length - 1].slice()]; }));
    const before = await tips();
    await page.click("#dropSwitch");
    await page.waitForFunction(() => window.__salon.drop.state && window.__salon.drop.state.frames > 45, null, { timeout: 30000 });
    const st0 = await ev(() => window.__salon.drop.state);
    await ev(() => { window.__salon.drop.pause(); window.__salon.drop.show(0); });
    const zero = await ev(() => { const s = window.__salon, it = s.drop; return it.state.frame; });
    if (zero !== 0) throw new Error("the slider didn't go back");
    await ev(() => window.__salon.drop.show(window.__salon.drop.state.frames - 1));
    const shown = await drawn(), twins = await ev(() => window.__salon.st.locks.filter(l => l.mirror_of).length);
    await page.click("#dropSwitch");                                // off: the moment shown is kept
    await ev(() => window.__salon.render()); const kept = await drawn();
    let off = 0; for (const id in shown) { const a = shown[id], b = kept[id]; if (!b || a.length !== b.length) { off = Infinity; break; } for (let i = 0; i < a.length; i++) off = Math.max(off, Math.abs(a[i] - b[i])); }
    if (off > 1e-6 || !twins) throw new Error(`switched off, the hair moved ${off} m from what was shown (${twins} twins)`);
    const after = await tips();
    const fell = Math.max(...after.map((t, i) => before[i][1][1] - t[1][1])), rootMoved = Math.max(...after.map((t, i) => Math.hypot(...t[0].map((x, k) => x - before[i][0][k]))));
    const inside = await ev(() => { const s = window.__salon; s.render(); let n = 0; for (const l of s.st.locks) for (const G of s.EVAL[l.id] || []) G.pts.forEach((p, k) => { if (k && s.COL.push(p, -0.0015)[1]) n++; }); return n; });
    if (fell < 0.02 || rootMoved > 1e-6 || inside) throw new Error(JSON.stringify({ fell, rootMoved, inside }));
    await page.keyboard.press("Control+z");
    const back = await tips();
    if (JSON.stringify(back) !== JSON.stringify(before)) throw new Error("undo didn't bring the shape back");
    await ev(() => { const s = window.__salon; s.st.layering = false; s.dirtyAll(); s.render(); });
    console.log(`       ${st0.frames} moments recorded; a tip fell ${(fell * 100).toFixed(1)} cm, the roots stayed; switched off, the hair stayed exactly as shown (${twins} twin, layers on); undone`);
  });
  await step("Bake: the swinging lock its own skinned mesh, the rest one mesh with fewer vertices; the file loads back and its bones bend it", async () => {
    await ev(n => { document.querySelector("#hairName").value = n; document.querySelector("#status").textContent = ""; }, TEST);   // (an earlier bake's "baked" gone)
    await page.click("#bakebox button:text-is('Bake the hairstyle')");
    await page.waitForFunction(() => /baked/.test(document.querySelector("#status").textContent), null, { timeout: 60000 });
    const d = path.join(ROOT, "Content", "Studio", "Hair", TEST), sum = JSON.parse(fs.readFileSync(path.join(d, "salon_bake.json"), "utf-8"));
    const glb = fs.readFileSync(path.join(d, "salon.glb"));
    if (glb.toString("ascii", 0, 4) !== "glTF") throw new Error("salon.glb isn't a binary glTF");
    const json = JSON.parse(glb.toString("utf-8", 20, 20 + glb.readUInt32LE(12)));
    if (sum.physics.length !== 1 || (json.skins || []).length !== 1 || !(sum.after.vertices < sum.before.vertices)) throw new Error(JSON.stringify({ physics: sum.physics.length, skins: (json.skins || []).length, before: sum.before, after: sum.after }));
    const scalpMat = (json.materials || []).find(m => m.name === "hair_scalp");
    if (!scalpMat || scalpMat.alphaMode !== "BLEND" || !(scalpMat.extensions && scalpMat.extensions.KHR_materials_unlit) || !(json.nodes || []).some(n => n.name === "hair_scalp")) throw new Error("the bake's scalp: " + JSON.stringify(scalpMat));
    const cardsMat = (json.materials || []).find(m => m.name === "hair_cards");
    if (!(json.images || []).length || !cardsMat || cardsMat.alphaMode !== "MASK" || !(cardsMat.extras && cardsMat.extras.look && cardsMat.extras.look.label)) throw new Error("the bake's look: " + JSON.stringify({ images: (json.images || []).length, cards: cardsMat }).slice(0, 300));
    console.log(`       ${sum.before.vertices} vertices live -> ${sum.after.vertices} baked (static ${sum.static.vertices}); ${Math.round(glb.length / 1024)} KB`);
  });
  await step("Preview the bake: only the bake shown (the editing hair and its scalp hidden), its bones bend it, made again when the hair changes or its detail; a drawing tool ends it", async () => {
    await page.click("#previewBake");
    await page.waitForFunction(() => window.__salon.BAKEVIEW, null, { timeout: 60000 });
    const shown = await ev(() => { const s = window.__salon, m = Object.values(s.MESHES); let baked = 0; s.BAKEG.traverse(o => { if (o.isMesh) baked++; });
      return { editing: m.some(x => x.parent.visible && x.visible), scalp: s.scalpInfo() && s.scalpInfo().visible, bake: s.BAKEG.visible, baked, physics: s.BAKEVIEW.summary.physics.length }; });
    if (shown.editing || shown.scalp || !shown.bake || shown.baked < 3 || shown.physics !== 1) throw new Error(JSON.stringify(shown));
    const c = await ev(() => window.__salon.bakeCheck());
    if (!c || c.bones !== 6 || c.bind > 1e-4 || c.moveTip < 0.01 || c.moveRoot > 0.1 * c.moveTip) throw new Error(JSON.stringify(c));   // the root ring sits round its bone: it turns a little
    await ev(() => { const s = window.__salon; s.st.locks.find(l => l.physics && l.physics.on).visible = false; s.dirtyAll(); s.render(); });   // the swinging lock hidden: the preview follows
    await page.waitForFunction(() => window.__salon.BAKEVIEW && window.__salon.BAKEVIEW.summary.physics.length === 0, null, { timeout: 30000 });
    await ev(() => { const s = window.__salon; s.st.locks.find(l => l.physics && l.physics.on).visible = true; s.dirtyAll(); s.render(); });
    await page.waitForFunction(() => window.__salon.BAKEVIEW && window.__salon.BAKEVIEW.summary.physics.length === 1, null, { timeout: 30000 });
    const detail = [];                                                  // the bake's detail: more points along a card, then every point, then back
    for (const [along, full] of [[16, false], [16, true], [8, false]]) {
      const was = await ev(() => window.__salon.BAKEVIEW);
      await ev(([a, f]) => { const r = document.querySelector("#bakeDetail input[type=range]"), t = document.querySelector("#bakeDetail input[type=checkbox]");
        if (t.checked !== f) t.click(); r.value = a; r.dispatchEvent(new Event("input")); r.dispatchEvent(new Event("change")); }, [along, full]);
      await page.waitForFunction(w => window.__salon.BAKEVIEW && window.__salon.BAKEVIEW !== w, was, { timeout: 30000 }).catch(() => null);
      await page.waitForFunction(([a, f]) => { const s = window.__salon; return s.BAKEVIEW && s.st.bake.along === a && s.st.bake.full === f; }, [along, full], { timeout: 30000 });
      await page.waitForTimeout(600);
      detail.push(await ev(() => window.__salon.BAKEVIEW.summary.after.vertices));
    }
    if (!(detail[1] >= detail[0] && detail[0] > detail[2])) throw new Error("the bake's detail: " + JSON.stringify(detail));
    await ev(() => window.__salon.setTool("strand"));
    const back = await ev(() => { const s = window.__salon; s.render(); return { preview: !!s.BAKEVIEW, editing: Object.values(s.MESHES).some(x => x.parent.visible && x.visible), scalp: s.scalpInfo() && s.scalpInfo().visible, bake: s.BAKEG.children.length }; });
    await ev(() => window.__salon.setTool("select"));
    if (back.preview || !back.editing || !back.scalp || back.bake) throw new Error(JSON.stringify(back));
    console.log(`       ${shown.baked} baked meshes shown alone; ${c.name}: ${c.bones} bones, bind pose exact (${c.bind.toExponential(1)} m), its root bone turned moves the tip ${(c.moveTip * 100).toFixed(1)} cm and the root ${(c.moveRoot * 1000).toFixed(2)} mm; the swinging lock hidden and shown, the preview followed; detail 16 points ${detail[0]}, every point ${detail[1]}, 8 points ${detail[2]} vertices; the strand tool ended it`);
  });
  await step("the bake's smoothing: Smooth curves keeps more points only where a card bends sharply, Tame flyaways brings what stands out in (never nearer the head than 3 mm, nothing below the chin), the hair you edit untouched", async () => {
    const r = await ev(() => {
      const s = window.__salon, D = s.bakeDebug, COL = s.COL, sets = s.st.locks.filter(l => l.visible && s.EVAL[l.id]).map(l => [s.EVAL[l.id], !!(l.physics && l.physics.on)]);
      const sig = () => sets.reduce((a, [gs]) => a + gs.reduce((b, G) => b + G.pts.reduce((c, p) => c + p[0] * 1.3 + p[1] * 0.7 + p[2], 0), 0), 0);
      const corners = out => { let n = 0, pts = 0; for (const G of out.flat()) { pts += G.pts.length; for (let i = 1; i < G.pts.length - 1; i++) {
        const u = G.pts[i].map((v, k) => v - G.pts[i - 1][k]), w = G.pts[i + 1].map((v, k) => v - G.pts[i][k]), c = (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (Math.hypot(...u) * Math.hypot(...w) || 1);
        if (Math.acos(Math.max(-1, Math.min(1, c))) > Math.PI / 4) n++; } } return { n, pts }; };
      const live = sig(), keep = { ...s.st.bake };
      Object.assign(s.st.bake, { along: 8, full: false, smooth: 0, tame: 0 }); const a = corners(D.bakeCards(sets));
      s.st.bake.smooth = 1; const b = corners(D.bakeCards(sets));
      s.st.bake.smooth = 0; s.st.bake.tame = 1;
      const flat = sets.flatMap(([gs]) => gs), tamed = D.tameGuides(flat, 1); let moved = 0, outward = 0, tooNear = 0, belowChin = 0, most = 0;
      flat.forEach((G, k) => G.pts.forEach((p, i) => { const q = tamed[k].pts[i], d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); if (d < 1e-7) return; moved++; most = Math.max(most, d);
        const r0 = Math.hypot(p[0] - COL.C[0], p[1] - COL.C[1], p[2] - COL.C[2]), r1 = Math.hypot(q[0] - COL.C[0], q[1] - COL.C[1], q[2] - COL.C[2]); if (r1 > r0 + 1e-7) outward++;
        if (D.clearance(q) < Math.min(D.clearance(p), 0.003) - 1e-6) tooNear++; if (p[1] < COL.chin - 0.03) belowChin++; }));
      Object.assign(s.st.bake, keep);
      return { a, b, moved, outward, tooNear, belowChin, most, same: Math.abs(sig() - live) < 1e-9 };
    });
    if (!(r.b.pts > r.a.pts) || !(r.b.n <= r.a.n) || !(r.moved > 0) || r.outward || r.tooNear || r.belowChin || !r.same) throw new Error("the smoothing: " + JSON.stringify(r));
    console.log(`       Smooth curves 1: ${r.a.pts} -> ${r.b.pts} points kept, corners over 45 degrees ${r.a.n} -> ${r.b.n}; Tame flyaways 1: ${r.moved} points brought in (up to ${(r.most * 1000).toFixed(0)} mm), none out, none nearer the head than 3 mm; the live hair unchanged`);
  });
  await step("the retro look: Flat shows the hair unlit and bakes an unlit material", async () => {
    await ev(() => { const s = window.__salon; s.st.look.flat = true; s.restyle(); });
    await page.click("#previewBake"); await page.waitForFunction(() => window.__salon.BAKEVIEW, null, { timeout: 60000 });
    const f = await ev(() => { const s = window.__salon; let unlit = false; s.BAKEG.traverse(o => { if (o.isMesh && o.material && o.material.name === "hair_cards" && o.material.isMeshBasicMaterial) unlit = true; }); return { unlit, uniform: s.HAIRU.uFlat.value }; });
    await page.click("#previewBake"); await ev(() => { const s = window.__salon; s.st.look.flat = false; s.restyle(); });
    if (!f.unlit || f.uniform !== 1) throw new Error("the flat look: " + JSON.stringify(f));
    console.log(`       the hair shader unlit (uFlat ${f.uniform}); the bake's cards an unlit material`);
  });
  await step("soft edges: the look's Soft edges reaches the hair's shader and softens the strands' outlines (the brows and lashes stay crisp)", async () => {
    const shotOf = async soft => { await ev(v => { const s = window.__salon; s.st.look.custom.soft = v; s.restyle(); s.render(); }, soft); await page.waitForTimeout(300);
      const r = await ev(() => { const c = window.__salon.canvas.getBoundingClientRect(); return { x: c.x, y: c.y, width: c.width, height: c.height }; });
      return (await page.screenshot({ clip: r })).toString("base64"); };
    const view = await ev(() => { const s = window.__salon, o = { ...s.orbit }; Object.assign(s.orbit, { yaw: 1.2, pitch: 0.05, dist: 0.75, zoom: 1, pan: [0, 0] }); s.draw(); return o; });   // the hair from the side, close
    const a = await shotOf(0), b = await shotOf(1), u = await ev(() => window.__salon.HAIRU.uSoft.value);
    await ev(o => { Object.assign(window.__salon.orbit, o); window.__salon.draw(); }, view);
    const changed = await ev(async ([a, b]) => { const px = async s => { const i = new Image(); i.src = "data:image/png;base64," + s; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
      const A = await px(a), B = await px(b); let n = 0; for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 20) n++; return n / (A.length / 4); }, [a, b]);
    await ev(() => { const s = window.__salon; delete s.st.look.custom.soft; s.restyle(); });
    if (u !== 1 || !(changed > 0.003)) throw new Error(`soft edges: uSoft ${u}, ${(changed * 100).toFixed(2)}% of the picture changed`);
    console.log(`       Soft edges 0 -> 1: ${(changed * 100).toFixed(1)}% of the picture changes, along the strands' edges`);
  });
  await step("leaving: the hair's changes are marked unsaved (Save clears it); the mouse's back button, right-click's menu and Backspace don't leave the page", async () => {
    const g = await ev(() => {
      const cv = window.__salon.canvas, fire = (type, init) => { const e = new MouseEvent(type, { bubbles: true, cancelable: true, ...init }); cv.dispatchEvent(e); return e.defaultPrevented; };
      const key = k => { const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }); document.body.dispatchEvent(e); return e.defaultPrevented; };
      return { unsaved: window.__salon.unsaved, back: fire("mouseup", { button: 3 }), menu: fire("contextmenu", { button: 2 }), backspace: key("Backspace") };
    });
    if (!g.unsaved || !g.back || !g.menu || !g.backspace) throw new Error(JSON.stringify(g));
    console.log("       edited hair marked unsaved; back button, right-click's menu and Backspace stopped");
  });
  await step("saved as salon.json and loaded back the same", async () => {
    const before = await ev(() => [window.__salon.st.locks.map(l => [l.id, l.type, l.mirror_of]), window.__salon.st.scalp.thickness, window.__salon.st.layering]);
    await ev(n => { document.querySelector("#hairName").value = n; return window.__salon.save(); }, TEST);
    if (await ev(() => window.__salon.unsaved)) throw new Error("still marked unsaved after Save");
    const f = path.join(ROOT, "Content", "Studio", "Hair", TEST, "salon.json");
    if (!fs.existsSync(f)) throw new Error("no " + f);
    await page.goto(BASE + "salon.html?hair=" + TEST);
    await page.waitForFunction(() => window.__salon && window.__salon.ready, null, { timeout: 90000 }); await openSteps();
    await page.waitForTimeout(500);
    const after = await ev(() => [window.__salon.st.locks.map(l => [l.id, l.type, l.mirror_of]), window.__salon.st.scalp.thickness, window.__salon.st.layering]);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`saved ${JSON.stringify(before).slice(0, 200)}, loaded ${JSON.stringify(after).slice(0, 200)}`);
    if (!(await ev(() => window.__salon.scalpInfo() && window.__salon.scalpInfo().vertices))) throw new Error("the scalp isn't drawn after the reload");
    fs.rmSync(path.dirname(f), { recursive: true, force: true });
    console.log(`       ${after[0].length} locks, the scalp at ${after[1]}`);
  });
  await step("on a character: the Character Studio saves its body, the salon draws on it and keeps the hair on it, the bake goes onto it, and the Character Studio wears it", async () => {
    const dir = path.join(ROOT, "Content", "Studio", "People", TEST), style = path.join(ROOT, "Content", "Studio", "Hair", TEST + "_style");
    fs.rmSync(dir, { recursive: true, force: true });
    await page.goto(BASE);                                           // the Character Studio: a character, feminine, 1.58 m, saved
    await page.waitForFunction(() => window.__body && window.__body.N > 10000, null, { timeout: 90000 });
    await page.fill("#newName", TEST); await page.click("#make");
    await page.waitForFunction(n => window.__body.who === n, TEST, { timeout: 30000 });
    await page.click('.bases button[data-base="-1"]');
    await page.$$eval("#baseRows input", ins => { ins[1].value = 1.58; ins[1].dispatchEvent(new Event("input")); });
    await page.click("#save"); await page.waitForFunction(() => /saved .*its body/.test(document.querySelector("#status").textContent), null, { timeout: 30000 });
    const N = await ev(() => window.__body.N), body = fs.readFileSync(path.join(dir, "body.bin"));
    if (body.length !== N * 12) throw new Error(`body.bin is ${body.length} bytes for ${N} points`);
    await page.goto(BASE + "salon.html?person=" + TEST);             // the salon on it: its body, hair made and saved onto it
    await page.waitForFunction(() => window.__salon && window.__salon.ready, null, { timeout: 90000 }); await openSteps();
    const on = await ev(() => { const s = window.__salon, P = s.PERSON; let top = -1; for (let i = 1; i < P.body.length; i += 3) top = Math.max(top, P.body[i]); return { name: P.name, face: P.face, top, picked: document.querySelector("#person").value }; });
    if (on.name !== TEST || !on.face || on.picked !== TEST || Math.abs(on.top - 1.58) > 0.003) throw new Error(JSON.stringify(on));
    await ev(() => { window.__salon.presets.apply("bald"); window.__salon.render(); });             // Bald: no locks, no darkened scalp
    if (await count() !== 0 || await ev(() => window.__salon.scalpInfo())) throw new Error("Bald left hair or a darkened scalp");
    await ev(() => { window.__salon.presets.apply("m_crop"); window.__salon.render(); });
    const locks = await count();
    await ev(() => { document.querySelector("#status").textContent = ""; }); await page.click("#saveHair");
    await page.waitForFunction(n => new RegExp(`saved ${n}'s hair`).test(document.querySelector("#status").textContent), TEST, { timeout: 30000 });
    if (!fs.existsSync(path.join(dir, "salon", "salon.json"))) throw new Error("the hair isn't kept on the character");
    await ev(n => { document.querySelector("#hairName").value = n; }, TEST + "_style"); await page.click("#saveStyle");
    await page.waitForFunction(() => /saved the hairstyle/.test(document.querySelector("#status").textContent), null, { timeout: 30000 });
    const kept = JSON.parse(fs.readFileSync(path.join(style, "salon.json"), "utf-8")); fs.rmSync(style, { recursive: true, force: true });
    if (kept.head.person !== null || kept.locks.length !== locks) throw new Error("the hairstyle: " + JSON.stringify(kept.head));
    await ev(() => { document.querySelector("#status").textContent = ""; }); await page.click(`#bakebox button:text-is('Bake onto ${TEST}')`);
    await page.waitForFunction(n => new RegExp(`baked onto ${n}`).test(document.querySelector("#status").textContent), TEST, { timeout: 60000 });
    const sum = JSON.parse(fs.readFileSync(path.join(dir, "salon", "salon_bake.json"), "utf-8"));
    if (sum.head.person !== TEST || !fs.existsSync(path.join(dir, "salon", "salon.glb"))) throw new Error("the bake: " + JSON.stringify(sum.head));
    await page.goto(BASE + "salon.html?person=" + TEST);             // opened again: its own hair
    await page.waitForFunction(() => window.__salon && window.__salon.ready, null, { timeout: 90000 });
    if (await count() !== locks) throw new Error(`reopened with ${await count()} locks, saved ${locks}`);
    await page.goto(BASE);                                           // the Character Studio wears it: on the head, over its top
    await page.waitForFunction(() => window.__body && window.__body.N > 10000, null, { timeout: 90000 });
    await page.selectOption("#who", TEST); await page.waitForFunction(n => window.__body.who === n, TEST, { timeout: 30000 });
    await page.waitForFunction(() => window.__body.salonHair, null, { timeout: 30000 });   // the studio wears the salon's bake on opening
    await page.waitForTimeout(300);
    const w = await ev(() => {
      const b = window.__body, H = b.salonHair; H.updateMatrixWorld(true); const v = new H.position.constructor(), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      H.traverse(o => { if (!o.isMesh || o.isSkinnedMesh || o.name === "hair_scalp") return; const P = o.geometry.attributes.position;
        for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v.getComponent(k)); hi[k] = Math.max(hi[k], v.getComponent(k)); } } });
      let top = -1; for (let i = 1; i < b.POS.length; i += 3) top = Math.max(top, b.POS[i]);
      return { lo, hi, top, visible: H.visible };
    });
    const mid = (w.lo[0] + w.hi[0]) / 2;
    if (!w.visible || w.hi[1] < w.top || w.hi[1] > w.top + 0.06 || w.lo[1] < w.top - 0.3 || Math.abs(mid) > 0.01) throw new Error(JSON.stringify(w));
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`       ${TEST}: body.bin from the Character Studio (${N} points, ${on.top.toFixed(3)} m); ${locks} locks kept on it and baked onto it (${sum.after.vertices} vertices); the Character Studio wears it from ${w.lo[1].toFixed(3)} to ${w.hi[1].toFixed(3)} m over a ${w.top.toFixed(3)} m head top, centred ${(mid * 1000).toFixed(1)} mm`);
  });
  if (shot) await page.screenshot({ path: shot });
  if (errors.length) fail("page errors: " + errors.join(" | "));
  await browser.close();
  console.log("SALON ok");
})().catch(e => fail(e.message));

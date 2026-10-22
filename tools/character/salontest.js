// The salon (tools/character/salon.html) in a headless browser. The locked reference: turning the view snaps it onto the
// nearest frame of the MiniMax turntable (Content/Studio/Hair/References/minimax_wig), the view's camera is that frame's,
// the picture is drawn; with half the turn in use the far side is a mirrored frame; the fit moves the cameras; the
// reference's cube bends the picture where its pulled face looks at the view. The lock
// tools with the mouse: a strand (root, end), a sheet (a root line dragged along the scalp, an end), a bundle; Mirror on
// gives a sheet a twin across the seam that follows a pulled handle; no guide point inside the body; undo and redo; the
// trace's glow (the face kept clear), a mirrored brush selection cut, the glow pushed out by a drag, the fill (off the
// body, combed the locks' way) and its cube; physics on the bundle (a shake swings it, still settles it); the bake (a
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
  await step("Trace wraps the locks and the scalp in a glow, the face below the brows kept clear", async () => {
    await page.click("button:text-is('Trace')");
    const g = await ev(() => { const s = window.__salon, g = s.st.glow; let on = 0, under = 0, face = 0;
      for (let c = 0; c < g.on.length; c++) { if (!g.on[c]) continue; on++; if (g.r[c] < g.inner[c]) under++;
        const p = s.SF.pointOf(g, c, g.inner[c]); if (g.face[c] && p[1] < 0.03) face++; }
      return { on, under, face, n: g.on.length }; });
    if (g.on < 150 || g.under || g.face) throw new Error(JSON.stringify(g));
    console.log(`       ${g.on} of ${g.n} cells in the glow`);
  });
  await step("the Glow tool's brush selects both sides with mirror on, and Cut takes them out", async () => {
    await page.keyboard.press("g"); await view(-Math.PI / 2, 0.0, 1.0);
    const ear = await scr([-0.075, 0.0, -0.005]);
    await page.mouse.move(...ear); await page.mouse.down(); await page.mouse.move(ear[0] + 10, ear[1] + 15, { steps: 4 }); await page.mouse.up();
    const sel = await ev(() => { const s = window.__salon, S = [...s.SEL]; return { n: S.length, paired: S.every(c => s.SEL.has(s.SF.mirrorCell(c))), cells: S }; });
    if (sel.n < 4 || !sel.paired) throw new Error(`${sel.n} selected, mirrored pairs: ${sel.paired}`);
    await page.click("button:text-is('Cut')");
    const left = await ev(cs => cs.filter(c => window.__salon.st.glow.on[c]).length, sel.cells);
    if (left) throw new Error(`${left} of the cut cells still on`);
    console.log(`       ${sel.n} cells selected round both ears and cut`);
  });
  await step("dragging a selected point up pushes the glow out there", async () => {
    await page.click("button:text-is('None')");
    await view(0, 0.5, 1.0);
    const top = await scr(await ev(() => { const s = window.__salon, g = s.st.glow, c = s.SF.cell(Math.floor(s.SF.AZ / 2), s.SF.EL - 4); return s.SF.pointOf(g, c); }));
    await page.mouse.click(...top);
    const before = await ev(() => { const s = window.__salon; return [...s.SEL].map(c => [c, s.st.glow.r[c]]); });
    if (!before.length) throw new Error("nothing selected at the crown");
    await page.mouse.move(...top); await page.mouse.down(); await page.mouse.move(top[0], top[1] - 30, { steps: 6 }); await page.mouse.up();
    const grew = await ev(b => b.map(([c, r]) => window.__salon.st.glow.r[c] - r), before);
    if (Math.min(...grew) < 0.01) throw new Error(`the glow moved ${grew.map(x => (x * 1000).toFixed(1)).join(", ")} mm`);
    console.log(`       ${before.length} points pushed out ${(Math.min(...grew) * 1000).toFixed(0)} mm`);
  });
  await step("Fill: a mass between the head and the glow, off the body, combed the way the nearest locks run", async () => {
    await page.click("button:text-is('Fill')"); await page.waitForTimeout(300);
    const f = await ev(() => { const s = window.__salon, F = s.fillInfo(), res = F.res, SL = s.SL; let inside = 0;
      const P = res.shell.position; for (let i = 0; i < P.length; i += 3) if (s.COL.push([P[i], P[i + 1], P[i + 2]], -0.001)[1]) inside++;
      const segs = []; for (const l of s.st.locks) for (const G of s.EVAL[l.id] || []) for (let k = 1; k < G.pts.length; k++) segs.push([SL.mul(SL.add(G.pts[k], G.pts[k - 1]), 0.5), SL.norm(SL.sub(G.pts[k], G.pts[k - 1]))]);
      let agree = 0, near = 0;
      for (const line of res.strands) { const p = line[0], d = SL.norm(SL.sub(line[2], line[0])); let best = null, bd = 0.03;
        for (const [m, t] of segs) { const dd = SL.len(SL.sub(m, p)); if (dd < bd) { bd = dd; best = t; } }
        if (best) { near++; agree += SL.dot(d, best); } }
      return { vertices: F.vertices, strands: F.strands, inside, near, agree: near ? agree / near : 0 }; });
    if (f.vertices < 500 || f.strands < 200 || f.inside) throw new Error(JSON.stringify(f));
    if (f.near < 20 || f.agree < 0.5) throw new Error(`the comb doesn't follow the locks: ${JSON.stringify(f)}`);
    console.log(`       ${f.vertices} vertices, ${f.strands} strands; ${f.near} start beside a lock, running its way by ${f.agree.toFixed(2)} (1 = the same)`);
  });
  await step("the fill's cube bends the mass with the mouse", async () => {
    await page.click("text=shape the fill (its cube)");
    await view(0, 0.1, 1.3);
    const h = await scr(await ev(() => { const s = window.__salon, c = s.st.glow.fill.cube; return c.pts[s.FFD.idx(c, 2, 2, 2)]; }));
    const v0 = await ev(() => window.__salon.fillInfo().vertices);
    const before = await ev(() => { const s = window.__salon, c = s.st.glow.fill.cube; return c.pts[s.FFD.idx(c, 2, 2, 2)].slice(); });
    await page.mouse.move(...h); await page.mouse.down(); await page.mouse.move(h[0] + 40, h[1] - 20, { steps: 6 }); await page.mouse.up();
    const after = await ev(() => { const s = window.__salon, c = s.st.glow.fill.cube; return { p: c.pts[s.FFD.idx(c, 2, 2, 2)], rest: s.FFD.isRest(c) }; });
    const moved = Math.hypot(after.p[0] - before[0], after.p[1] - before[1], after.p[2] - before[2]);
    if (moved < 0.01 || after.rest) throw new Error(`the fill's corner moved ${(moved * 100).toFixed(2)} cm`);
    if (v0 !== await ev(() => window.__salon.fillInfo().vertices)) throw new Error("the mass changed its vertices");
    console.log(`       a corner of the fill's cube pulled ${(moved * 100).toFixed(1)} cm`);
    await page.keyboard.press("v");
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
  await step("Bake: the swinging lock its own skinned mesh, the rest one mesh with fewer vertices; the file loads back and its bones bend it", async () => {
    await ev(n => { document.querySelector("#hairName").value = n; }, TEST);
    await page.click("#bakebox button:text-is('Bake')");
    await page.waitForFunction(() => /baked/.test(document.querySelector("#status").textContent), null, { timeout: 60000 });
    const d = path.join(ROOT, "Content", "Studio", "Hair", TEST), sum = JSON.parse(fs.readFileSync(path.join(d, "salon_bake.json"), "utf-8"));
    const glb = fs.readFileSync(path.join(d, "salon.glb"));
    if (glb.toString("ascii", 0, 4) !== "glTF") throw new Error("salon.glb isn't a binary glTF");
    const json = JSON.parse(glb.toString("utf-8", 20, 20 + glb.readUInt32LE(12)));
    if (sum.physics.length !== 1 || (json.skins || []).length !== 1 || !(sum.after.vertices < sum.before.vertices)) throw new Error(JSON.stringify({ physics: sum.physics.length, skins: (json.skins || []).length, before: sum.before, after: sum.after }));
    const cardsMat = (json.materials || []).find(m => m.name === "hair_cards");
    if (!(json.images || []).length || !cardsMat || cardsMat.alphaMode !== "MASK" || !(cardsMat.extras && cardsMat.extras.look && cardsMat.extras.look.label)) throw new Error("the bake's look: " + JSON.stringify({ images: (json.images || []).length, cards: cardsMat }).slice(0, 300));
    await page.click("text=show the bake"); await page.waitForTimeout(800);
    const c = await ev(() => window.__salon.bakeCheck());
    if (!c || c.bones !== 6 || c.bind > 1e-4 || c.moveTip < 0.01 || c.moveRoot > 0.1 * c.moveTip) throw new Error(JSON.stringify(c));   // the root ring sits round its bone: it turns a little
    await page.click("text=show the bake");
    console.log(`       ${sum.before.vertices} vertices live -> ${sum.after.vertices} baked (static ${sum.static.vertices}); ${c.name}: ${c.bones} bones, bind pose exact (${c.bind.toExponential(1)} m), its root bone turned moves the tip ${(c.moveTip * 100).toFixed(1)} cm and the root ${(c.moveRoot * 1000).toFixed(2)} mm; ${Math.round(glb.length / 1024)} KB`);
  });
  await step("saved as salon.json and loaded back the same", async () => {
    const before = await ev(() => [window.__salon.st.locks.map(l => [l.id, l.type, l.mirror_of]), window.__salon.st.glow.on.reduce((a, b) => a + b, 0), window.__salon.st.glow.filled]);
    await ev(n => { document.querySelector("#hairName").value = n; return window.__salon.save(); }, TEST);
    const f = path.join(ROOT, "Content", "Studio", "Hair", TEST, "salon.json");
    if (!fs.existsSync(f)) throw new Error("no " + f);
    await page.goto(BASE + "salon.html?hair=" + TEST);
    await page.waitForFunction(() => window.__salon && window.__salon.ready, null, { timeout: 90000 });
    await page.waitForTimeout(500);
    const after = await ev(() => [window.__salon.st.locks.map(l => [l.id, l.type, l.mirror_of]), window.__salon.st.glow.on.reduce((a, b) => a + b, 0), window.__salon.st.glow.filled]);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`saved ${JSON.stringify(before).slice(0, 200)}, loaded ${JSON.stringify(after).slice(0, 200)}`);
    if (!(await ev(() => window.__salon.fillInfo().vertices))) throw new Error("the fill isn't drawn after the reload");
    fs.rmSync(path.dirname(f), { recursive: true, force: true });
    console.log(`       ${after[0].length} locks, ${after[1]} glow cells, filled`);
  });
  if (shot) await page.screenshot({ path: shot });
  if (errors.length) fail("page errors: " + errors.join(" | "));
  await browser.close();
  console.log("SALON ok");
})().catch(e => fail(e.message));

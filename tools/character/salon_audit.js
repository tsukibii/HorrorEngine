// The salon's editing measured in a headless browser (docs/SALON_REVIEW.md): what the view shows at each distance, how
// long a lock placed from the front comes out and where its end sits, how far the end jumps when the view is turned
// while placing, how many handles and locks the pull's reach takes on a whole head of hair, whether a click picks a
// lock the head hides, where a root line dragged off the scalp stops. Writes audit.json and five screenshots to the
// folder given (Saved/SalonAudit by default); the sheet in docs/assets/salon/ was made from them with ImageMagick's
// montage. Run it again after a change to the tools to see what moved.
//
//   python tools/character/serve.py                    (in another shell)
//   node tools/character/salon_audit.js [out dir]
//
// Needs Playwright (as salontest.js: PLAYWRIGHT=<its package>, PW_CHROME=<a Chromium binary>; BODY_URL for another port).
const fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const BASE = process.env.BODY_URL || "http://127.0.0.1:8793/";
const OUT = process.argv[2] || path.join(__dirname, "..", "..", "Saved", "SalonAudit");
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await require("../browser.cjs").launch(chromium, { executablePath: process.env.PW_CHROME || undefined, args: ["--disable-background-networking", "--disable-component-update"] });
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 744 } })).newPage();
  page.on("dialog", d => d.accept());
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const view = async (yaw, pitch = 0.1, dist = 0.85) => { await ev(([y, p, d]) => { const s = window.__salon; Object.assign(s.orbit, { yaw: y, pitch: p, dist: d, zoom: 1, pan: [0, 0] }); s.render(); }, [yaw, pitch, dist]); await page.waitForTimeout(200); };
  const scr = p => ev(p => { const s = window.__salon; s.render(); const r = s.canvas.getBoundingClientRect(); const q = s.screenOf(p); return [r.left + q[0], r.top + q[1]]; }, p);
  const surf = p => ev(p => window.__salon.COL.surface(p), p);
  const shot = async name => { await ev(() => window.__salon.render()); await page.waitForTimeout(150); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); };
  const lastEnd = () => ev(() => { const s = window.__salon; const l = s.st.locks[s.st.locks.length - 1]; return l.pts[l.pts.length - 1].map(x => +x.toFixed(3)); });
  const R = {};
  await page.goto(BASE + "salon.html");
  await page.waitForFunction(() => window.__salon && window.__salon.ready, null, { timeout: 120000 });
  await page.waitForTimeout(500);

  // 1. what the view shows at the default distance and zoomed out: the head's size on screen, the lowest point the cursor can reach
  R.views = [];
  for (const d of [0.85, 1.2, 1.6, 2.5]) {
    await view(0, 0.1, d);
    R.views.push(await ev(d => { const s = window.__salon; s.render(); const r = s.canvas.getBoundingClientRect();
      const top = s.screenOf([0, 0.125, 0]), ch = s.screenOf([0, s.COL.chin, 0.06]);
      let lo = -2, hi = 0.2; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (s.screenOf([0, m, 0])[1] > r.height) lo = m; else hi = m; }
      const px = s.screenOf([0.01, 0.01, 0])[0] - s.screenOf([0, 0.01, 0])[0];   // pixels per cm at the head's middle
      return { dist: d, canvas: [r.width, r.height], headPx: Math.round(ch[1] - top[1]), lowestLocalY: +hi.toFixed(3), belowChin: +(s.COL.chin - hi).toFixed(3), pxPerCm: +px.toFixed(1), handlePx: +(0.9 * px).toFixed(1) };
    }, d));
  }

  // 2. a strand placed from the front to the bottom of the view: how long it comes out, where its end sits in depth
  await view(0, 0.1, 0.85);
  await ev(() => window.__salon.setTool("strand"));
  const root = await surf([0.03, 0.14, 0.0]);
  await page.mouse.click(...await scr(root));
  const e = await scr([0.09, R.views[0].lowestLocalY + 0.015, 0.0]); await page.mouse.move(...e); await page.waitForTimeout(150);
  await shot("1_front_placing");
  await page.mouse.click(...e); await page.waitForTimeout(200);
  R.frontStrand = await ev(() => { const s = window.__salon; const l = s.st.locks[s.st.locks.length - 1];
    return { len: +s.SL.length(l.pts).toFixed(3), root: l.pts[0].map(x => +x.toFixed(3)), end: l.pts[l.pts.length - 1].map(x => +x.toFixed(3)), handles: s.SL.handles(l).length }; });
  await ev(() => { const s = window.__salon; s.setTool("select"); s.select(s.st.locks[s.st.locks.length - 1].id); });
  await view(Math.PI / 2, 0.1, 0.85); await shot("2_same_lock_from_side");
  await ev(() => window.__salon.undo());

  // 3. turning the view while placing moves the end: the cursor back on the same spot after a right-drag turn of 90 degrees
  await view(0, 0.1, 0.85); await ev(() => window.__salon.setTool("strand"));
  await page.mouse.click(...await scr(root)); const e1 = await scr([0.09, -0.15, 0]); await page.mouse.move(...e1); await page.waitForTimeout(80); await page.mouse.click(...e1); await page.waitForTimeout(80);
  const endA = await lastEnd(); await ev(() => window.__salon.undo());
  await page.mouse.click(...await scr(root)); await page.mouse.move(...e1); await page.waitForTimeout(80);
  await page.mouse.down({ button: "right" }); for (let k = 1; k <= 10; k++) await page.mouse.move(e1[0] - 19.6 * k, e1[1]); await page.mouse.up({ button: "right" });
  await page.mouse.move(...e1); await page.waitForTimeout(150); await shot("3_turned_while_placing");
  await page.mouse.click(...e1); await page.waitForTimeout(80);
  const endB = await lastEnd(), yaw = await ev(() => Math.round(window.__salon.orbit.yaw * 180 / Math.PI));
  R.turnWhilePlacing = { endA, endB, yawDeg: yaw, jump: +Math.hypot(...endA.map((x, i) => x - endB[i])).toFixed(3) };
  await ev(() => window.__salon.undo());

  // 4. a sheet's root line dragged from the crown down the side past the ear onto the cheek: where it stops
  await view(Math.PI / 2, 0.1, 0.85); await ev(() => window.__salon.setTool("sheet"));
  const a = await scr(await surf([0.1, 0.1, 0.0])), b = await scr(await surf([0.1, -0.05, 0.03]));
  await page.mouse.move(...a); await page.mouse.down(); for (let k = 1; k <= 12; k++) await page.mouse.move(a[0] + (b[0] - a[0]) * k / 12, a[1] + (b[1] - a[1]) * k / 12); await page.mouse.up(); await page.waitForTimeout(80);
  R.rootLine = await ev(() => { const s = window.__salon, L = s.place.line; return { points: L.length, length: +s.SL.length(L).toFixed(3), first: L[0].map(x => +x.toFixed(3)), last: L[L.length - 1].map(x => +x.toFixed(3)), draggedFromY: 0.1, draggedToY: -0.05 }; });
  await page.keyboard.press("Escape");

  // 5. the pull on a whole head of hair: how many locks and handles an 8, 20 and 50 cm reach takes from a crown handle
  R.pull = await ev(() => { const s = window.__salon; const P = s.presets.list.find(p => p.who === "women"); s.presets.apply(P.id);
    let best = null; for (const l of s.st.locks) { if (l.mirror_of) continue; const h = s.SL.rootHeight(l); if (!best || h > best.h) best = { l, h }; }
    const H = s.SL.handles(best.l).filter(h => !h.root), g = H[Math.min(2, H.length - 1)], start = s.SL.pullStart(s.st.locks);
    const count = size => { const w = s.SL.pullWeights(start, { id: best.l.id, path: g.path }, g.p, { size, falloff: "smooth", only: false, ids: s.st.locks.map(l => l.id) }); return { handles: w.length, locks: new Set(w.map(x => x.id)).size }; };
    const perType = {}; for (const l of s.st.locks) perType[l.type] = (perType[l.type] || 0) + 1;
    return { preset: P.label, length: P.length, locks: s.st.locks.length, perType, groups: s.st.groups.map(g => g.name), handles: s.st.locks.reduce((a, l) => a + s.SL.handles(l).length, 0), at8: count(0.08), at20: count(0.20), at50: count(0.5), lock: best.l.id, name: best.l.name, path: g.path, p: g.p };
  });
  await view(0.5, 0.25, 0.85);
  await ev(([id, size]) => { const s = window.__salon; s.setTool("select"); s.PULL.size = size; s.pullPanel(); s.select(id); }, [R.pull.lock, 0.2]);
  await page.mouse.move(...await scr(R.pull.p)); await page.waitForTimeout(200); await shot("4_reach_20cm_on_a_full_head");
  await ev(() => { window.__salon.PULL.size = 0.08; window.__salon.pullPanel(); });

  // 6. zoomed out far enough for the preset's full length: the head's size then
  await view(0.0, 0.1, 2.5); await shot("5_zoomed_out_for_long_hair");

  // 7. picking from the front: a lock on the back of the head, hidden by it, picked through the head?
  await view(0, 0.1, 0.85);
  R.pickThrough = await ev(() => { const s = window.__salon; s.render(); const r = s.canvas.getBoundingClientRect();
    const az = p => Math.abs(Math.atan2(p[0], p[2] - s.COL.C[2])) * 180 / Math.PI;
    for (const l of s.st.locks.filter(l => l.type === "sheet" && az(l.root[2]) > 150 && s.EVAL[l.id])) {
      const G = s.EVAL[l.id][Math.floor(s.EVAL[l.id].length / 2)];
      for (let k = 4; k < 12; k++) { const p = G.pts[k], q = s.screenOf(p);
        if (q[0] < 0 || q[1] < 0 || q[0] > r.width || q[1] > r.height) continue;
        const hit = s.headAt(r.left + q[0], r.top + q[1]); if (!hit) continue;
        const cam = s.cameraPosition(), w = p => s.SR.toWorld(s.HF, p), dHead = Math.hypot(...w(hit).map((x, i) => x - cam[i])), dLock = Math.hypot(...w(p).map((x, i) => x - cam[i]));
        if (dHead < dLock - 0.03) return { lock: l.name, screen: [r.left + q[0], r.top + q[1]], headNearerBy: +(dLock - dHead).toFixed(3) }; } }
    return null; });
  if (R.pickThrough) { await ev(() => window.__salon.setTool("select")); await page.mouse.click(...R.pickThrough.screen); await page.waitForTimeout(100);
    R.pickThrough.picked = await ev(() => { const s = window.__salon; const l = s.st.locks.find(l => l.id === s.selected); return l ? l.name : null; }); }

  // 8. the Locks panel for the preset
  R.panel = await ev(() => ({ lockRows: document.querySelectorAll("#locks .lock").length, groupRows: document.querySelectorAll("#locks .grp").length, panelPx: document.querySelector("#locks").scrollHeight }));
  R.errors = errors;
  fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(R, null, 1));
  const v = R.views[0], z = R.views[R.views.length - 1];
  console.log(`view: the head ${v.headPx} px tall at ${v.dist} m, the cursor reaches ${(v.belowChin * 100).toFixed(1)} cm below the chin; at ${z.dist} m ${z.headPx} px, ${(z.belowChin * 100).toFixed(0)} cm, a handle ${z.handlePx} px`);
  console.log(`a strand from the crown to the bottom edge: ${(R.frontStrand.len * 100).toFixed(0)} cm, its end ${((R.frontStrand.end[1] - (await ev(() => window.__salon.COL.chin))) * -100).toFixed(0)} cm below the chin at z ${R.frontStrand.end[2]}`);
  console.log(`turned ${R.turnWhilePlacing.yawDeg} degrees while placing, the same cursor spot: the end ${(R.turnWhilePlacing.jump * 100).toFixed(1)} cm away`);
  console.log(`root line dragged off the scalp: ${R.rootLine.points} points, ${(R.rootLine.length * 100).toFixed(1)} cm, stops at y ${R.rootLine.last[1]}`);
  console.log(`${R.pull.preset}: ${R.pull.locks} locks, ${R.pull.handles} handles; a pull takes ${R.pull.at8.handles} handles on ${R.pull.at8.locks} locks at 8 cm, ${R.pull.at20.handles} on ${R.pull.at20.locks} at 20, ${R.pull.at50.handles} on ${R.pull.at50.locks} at 50`);
  console.log(`a click on a lock ${R.pickThrough ? (R.pickThrough.headNearerBy * 100).toFixed(0) + " cm behind the head picked " + (R.pickThrough.picked === R.pickThrough.lock ? "it (through the head)" : R.pickThrough.picked) : "behind the head: none found in view"}`);
  console.log(`Locks: ${R.panel.lockRows} rows in ${R.panel.groupRows} groups, ${R.panel.panelPx} px; page errors: ${errors.length}`);
  console.log(`written to ${OUT}`);
  await browser.close();
})().catch(e => { console.error("SALON AUDIT FAIL", e); process.exit(1); });

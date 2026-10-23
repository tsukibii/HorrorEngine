// The Character Studio (tools/character/index.html) in a headless browser: MHR loads with its 45 sliders; a scratch character;
// the feminine base and a shape slider move the body, the height scales it; a front picture (the page's own head from
// the front, so no one's photo is needed) bends the face and nothing under the neck; a side picture (the head at 3/4)
// is taken for the depth; the expressions: a preset moves only the face, the ARKit map routes a blink onto
// eyesClosed (not a look), the eyeballs sit either side; the skin is made from the front picture and worn; the procedural
// skin takes over the body with the photo on the face through its mask, and its features change the picture; the work uniform
// is cut from the body and worn, takes denim and a print without refitting, its hem is dragged up by its handle,
// and it refits when the body grows; a PBR set chosen from files named as Unreal's are (albedo, normal-dx, roughness)
// goes onto the shelf as assets/pbr/studiotest_denim (the files' leading _ taken off) and onto the pants, its DirectX
// normal turned for three.js; the PBR shelf page shows it, a map chosen by hand there is kept, and the set goes;
// the Hair tab is the salon on this character (its body saved for it), brows and lashes switch in the Face tab;
// the head OBJ exports; the pictures clear and the face goes. Ends "STUDIO ok".
//
//   python tools/face_mesh.py setup, python tools/retarget.py setup   (once)
//   python tools/character/serve.py              (in another shell)
//   node tools/character/studiotest.js [shot.png]
//
// Needs Playwright (npm i playwright, or PLAYWRIGHT=<path to its package>).
const fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const BASE = process.env.BODY_URL || "http://127.0.0.1:8793/";
const NAME = "_studiotest";
const shot = process.argv[2];
const fail = m => { console.error("STUDIO FAIL: " + m); process.exit(1); };
// a small PNG of one colour (no canvas in node): the maps of a PBR set the test makes
const png = rgb => {
  const W = 4, raw = Buffer.alloc((W * 3 + 1) * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) rgb.forEach((v, k) => { raw[y * (W * 3 + 1) + 1 + x * 3 + k] = v; });
  const crc = b => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c >>> 1 ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const td = Buffer.concat([Buffer.from(t), d]), l = Buffer.alloc(4), c = Buffer.alloc(4); l.writeUInt32BE(d.length); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", require("zlib").deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
  // a click here never navigates: don't wait for one after it (with a heavy shader in software GL the page can be too
  // busy to answer that wait, and a click that was done timed out)
  const click0 = page.click.bind(page); page.click = (s, o) => click0(s, { noWaitAfter: true, ...o });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("dialog", d => d.accept());                   // "start it again from the defaults?", "remove?"
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { await page.screenshot({ path: shot || "studiotest_fail.png" }); fail(`${what}: ${e.message}`); } };
  const sample = () => page.evaluate(() => { const P = window.__body.POS; let s = 0, top = -1e9; for (let i = 0; i < P.length; i += 3) { s += P[i] * 7 + P[i + 2] * 3; top = Math.max(top, P[i + 1]); } return { s, top }; });
  const below = () => page.evaluate(() => {                 // how far the face moved anything under the neck
    const b = window.__body, d = b.delta; if (!d) return 0;
    let m = 0; for (let j = 0; j < d.idx.length; j++) { const i = d.idx[j]; if (b.POS[i * 3 + 1] < b.st.height * 0.78) m = Math.max(m, Math.abs(d.d[j * 3]) + Math.abs(d.d[j * 3 + 1]) + Math.abs(d.d[j * 3 + 2])); }
    return m;
  });
  const headShot = async yaw => {
    await page.click('#views button[data-v="head"]'); await page.click(`#views button[data-yaw="${yaw}"]`);
    await page.waitForTimeout(400);
    // the canvas's box, not its element: with the skin shader a software-rendered frame is slow, and the element shot waits for still frames
    const clip = await page.evaluate(() => { const r = document.querySelector("#view canvas").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    return page.screenshot({ clip, timeout: 120000 });
  };
  await page.goto(BASE);

  await step("MHR loads with its sliders and labels", async () => {
    await page.waitForFunction(() => window.__body && window.__body.N > 10000, null, { timeout: 60000 });
    const rows = await page.$$("#shapeRows .row");
    if (rows.length !== 45) throw new Error(`${rows.length} shape sliders`);
    const label = await page.textContent("#shapeRows .row span");
    if (!/: \w/.test(label)) throw new Error(`no label: ${label}`);
  });
  await step("a new character", async () => {
    // a run that stopped early leaves its pictures behind (the last step clears them): clear them first
    await page.evaluate(n => Promise.all(["front", "side"].map(s => fetch(`api/picture/${n}/${s}/png`, { method: "POST", body: "" }))), NAME);
    await page.fill("#newName", NAME); await page.click("#make");
    await page.waitForFunction(n => window.__body.who === n, NAME);
  });
  let a, front, side;
  await step("the base and a slider move the body; the height scales it", async () => {
    a = await sample();
    await page.click('.bases button[data-base="-1"]');
    const b = await sample();
    if (Math.abs(b.s - a.s) < 1e-3) throw new Error("the feminine base didn't move the body");
    await page.$eval("#shapeRows .row input", i => { i.value = +i.value > 0 ? -2 : 2; i.dispatchEvent(new Event("input")); });
    const c = await sample();
    if (Math.abs(c.s - b.s) < 1e-3) throw new Error("shape 0 didn't move the body");
    await page.$$eval("#baseRows input", ins => { ins[1].value = 1.6; ins[1].dispatchEvent(new Event("input")); });
    const d = await sample();
    if (Math.abs(d.top - 1.6) > 0.005) throw new Error(`height ${d.top}`);
  });
  await step("the sculpt: named controls (the forehead's height among them), each mirrored and moving only its part; a circle on the body dragged moves its sliders, green while held; saved with the character", async () => {
    await page.click('#tabs button[data-tab="body"]');
    const r = await page.evaluate(() => {
      const b = window.__body, S = b.SCULPT, P = () => Float32Array.from(b.POS);
      b.st.sculpt = {}; b.compose(); const p0 = P();
      b.st.sculpt = { forehead_height: 1 }; b.compose(); const p1 = P();
      let hi = 1; for (let i = 1; i < p0.length; i += 3) if (p0[i] > p0[hi]) hi = i;
      let below = 0; for (let i = 0; i < p0.length; i += 3) if (p0[i + 1] < 0.75 * b.st.height && Math.hypot(p1[i] - p0[i], p1[i + 1] - p0[i + 1], p1[i + 2] - p0[i + 2]) > 1e-7) below++;
      b.st.sculpt = {}; b.compose();
      const key = (x, y, z) => { const ax = Math.round(Math.abs(x) * 1e5); return `${ax},${Math.round(y * 1e5)},${Math.round(z * 1e5)},${ax ? Math.sign(x) : 0}`; };   // the points with an exact mirror image (the head's all; 96% of the body's)
      const B = b.BASEP, M = new Map();
      for (let i = 0; i < B.length / 3; i++) M.set(key(B[i * 3], B[i * 3 + 1], B[i * 3 + 2]), i);
      let worst = 0, unmatched = 0;
      for (const c of S.controls) {
        const at = new Map(); for (let q = 0; q < c.idx.length; q++) at.set(c.idx[q], q);
        for (let q = 0; q < c.idx.length; q++) { const i = c.idx[q], m = M.get(key(-B[i * 3], B[i * 3 + 1], B[i * 3 + 2])); if (m === undefined) { unmatched++; continue; }
          const k = at.get(m), o = k === undefined ? [0, 0, 0] : [c.d[k * 3], c.d[k * 3 + 1], c.d[k * 3 + 2]];
          worst = Math.max(worst, Math.abs(c.d[q * 3] + o[0]), Math.abs(c.d[q * 3 + 1] - o[1]), Math.abs(c.d[q * 3 + 2] - o[2])); }
      }
      return { controls: S.controls.length, handles: b.HANDLES.list.length, topUp: p1[hi] - p0[hi], below, worst, unmatched, moved: S.controls.reduce((a, c) => a + c.idx.length, 0) };
    });
    if (!(r.controls >= 20) || !(r.handles >= 30) || !(r.topUp > 0.01) || r.below || r.worst > 1e-6 || r.unmatched > 0.05 * r.moved) throw new Error("the sculpt: " + JSON.stringify(r));
    await page.click('#views button[data-v="head"]'); await page.click('#views button[data-yaw="0"]'); await page.waitForTimeout(600);
    const h = await page.evaluate(() => { const H = window.__body.HANDLES.list.find(x => x.h.id === "forehead"), q = H.e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2, getComputedStyle(H.e).display]; });
    await page.mouse.move(h[0], h[1]); await page.mouse.down(); await page.mouse.move(h[0], h[1] - 60, { steps: 4 });
    const held = await page.evaluate(() => [...document.querySelectorAll("#sculptRows .row.active")].map(x => x.firstChild.textContent));
    await page.mouse.up();
    const after = await page.evaluate(() => ({ v: window.__body.st.sculpt.forehead_height, active: document.querySelectorAll("#sculptRows .row.active").length }));
    await page.click("#save"); await page.waitForFunction(() => /saved/.test(document.querySelector("#status").textContent), null, { timeout: 30000 });
    const saved = await page.evaluate(async n => (await (await fetch(`api/people/${n}`)).json()).sculpt, NAME);
    await page.click("#resetSculpt"); await page.click('#views button[data-v="body"]');
    if (h[2] === "none" || held.join() !== "Forehead height" || !(after.v > 0.4 && after.v < 0.6) || after.active || !(saved && Math.abs(saved.forehead_height - after.v) < 1e-9)) throw new Error("the forehead's circle: " + JSON.stringify({ h, held, after, saved }));
    console.log(`       ${r.controls} controls, ${r.handles} circles; Forehead height 1 raises the head's top ${(r.topUp * 1000).toFixed(0)} mm and nothing under the chest; every control mirrored (within ${r.worst.toExponential(0)} m where the base is: all but ${r.unmatched} of ${r.moved} points); the forehead's circle dragged 60 px up: Forehead height ${after.v} (its row green while held), saved`);
  });
  await step("a front picture bends the face, not the body", async () => {
    front = await headShot("0"); side = await headShot("35");
    await page.setInputFiles("#slots .slot:nth-child(1) input", { name: "front.png", mimeType: "image/png", buffer: front });
    await page.waitForFunction(() => window.__body.delta && window.__body.report && window.__body.report.used === 1, null, { timeout: 90000 });
    const m = await below();
    if (m > 1e-9) throw new Error(`moved ${m} under the neck`);
  });
  await step("a side picture gives the depth", async () => {
    await page.setInputFiles("#slots .slot:nth-child(2) input", { name: "side.png", mimeType: "image/png", buffer: side });
    await page.waitForFunction(() => window.__body.report && window.__body.report.sides === 1, null, { timeout: 90000 });
  });
  await step("expressions: a preset moves the face only; the map sends a blink to eyesClosed", async () => {
    await page.click('#tabs button[data-tab="expr"]');
    const before = await page.evaluate(() => Array.from(window.__body.POS));
    await page.click('#exprPresets button[title^="mouthSmile"]');
    const moved = await page.evaluate(b => { const P = window.__body.POS, h = window.__body.st.height; let face = 0, body = 0;
      for (let i = 0; i < P.length; i += 3) { const d = Math.abs(P[i] - b[i]) + Math.abs(P[i + 1] - b[i + 1]) + Math.abs(P[i + 2] - b[i + 2]); if (P[i + 1] > h * 0.85) face = Math.max(face, d); else body = Math.max(body, d); }
      return { face, body }; }, before);
    if (moved.face < 0.002) throw new Error(`the smile moved the face ${moved.face} m`);
    if (moved.body > 5e-4) throw new Error(`the smile moved the body ${moved.body} m`);   // MHR's shapes reach the upper neck a little
    const w = await page.evaluate(() => { const b = window.__body, w = b.fromArkit({ eyeBlinkLeft: 1 }); return Object.fromEntries(b.ENAMES.map((n, i) => [n, w[i]]).filter(x => x[1])); });
    if (JSON.stringify(w) !== JSON.stringify({ eyesClosed_L: 1 })) throw new Error("eyeBlinkLeft maps to " + JSON.stringify(w));
    const eyes = await page.evaluate(() => { const E = window.__body.EYES; return [E.L.visible, E.R.visible, E.L.position.x, E.R.position.x]; });
    if (!eyes[0] || !eyes[1] || !(eyes[2] > 0.01 && eyes[3] < -0.01)) throw new Error("the eyeballs aren't in place: " + eyes);
    await page.click("#exprClear");
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("teeth and tongue: as wide as the mouth, the lower ones on the jaw (a lip shape never moves them), seen only through the opening in every speech pose; the opening clean to its corners (no skin left inside its outline); the lower lip's curl, closed at rest", async () => {
    const pose = w => page.evaluate(w => { const b = window.__body; b.st.expr.fill(0); for (const [k, v] of Object.entries(w)) b.st.expr[b.ENAMES.indexOf(k)] = v; b.compose(); }, w);
    const m = await page.evaluate(() => {
      const b = window.__body, M = b.MOUTH, mw = () => Math.abs(b.lmk(291)[0] - b.lmk(61)[0]), k = () => M.upper.matrix.elements[0];
      const r0 = k() / mw(), w0 = mw(), was = b.st.sculpt.mouth_width || 0; b.st.sculpt.mouth_width = 1; b.compose(); const r1 = k() / mw(), wide = mw(); b.st.sculpt.mouth_width = was; b.compose();
      return { on: M.upper.visible && M.jaw.visible && Object.keys(M.parts).length, r0, r1, grew: wide / w0, upper: Array.from(M.upper.matrix.elements) };
    });
    if (m.on !== 5) throw new Error(`the mouth's parts: ${m.on}`);
    if (m.grew < 1.03 || Math.abs(m.r1 / m.r0 - 1) > 0.02) throw new Error(`the teeth don't follow the mouth's width (the mouth ×${m.grew.toFixed(3)}, teeth to mouth ${m.r0.toExponential(3)} → ${m.r1.toExponential(3)})`);
    const jaw = () => page.evaluate(() => { const b = window.__body, M = b.MOUTH, tip = new b.THREE.Vector3(0, 1.6, -6).applyMatrix4(M.lower.matrix).applyMatrix4(M.jaw.matrix);
      return { tip: tip.toArray(), pts: b.JAW.v.map(v => [b.POS[v * 3], b.POS[v * 3 + 1], b.POS[v * 3 + 2]]), jaw: Array.from(M.jaw.matrix.elements), upper: Array.from(M.upper.matrix.elements) }; });
    await pose({}); const j0 = await jaw();
    await pose({ jawDrop: 1 }); const j1 = await jaw();
    const dTip = j1.tip.map((v, i) => v - j0.tip[i]), M = new Float64Array(j1.jaw);   // the jaw's own points, carried by the teeth's motion, against where the shape put them
    let off = 0; j0.pts.forEach((p, q) => { const r = [0, 1, 2].map(a => M[a] * p[0] + M[4 + a] * p[1] + M[8 + a] * p[2] + M[12 + a]); off += Math.hypot(...r.map((v, a) => v - j1.pts[q][a])) / j0.pts.length; });
    if (dTip[1] > -0.02 || off * 1000 > 2) throw new Error(`the lower teeth don't ride the jaw: the tip moved ${dTip.map(v => (v * 1000).toFixed(1))} mm, the jaw's points ${(off * 1000).toFixed(2)} mm off the teeth's motion`);
    await pose({ lipPucker_L: 1, lipPucker_R: 1, chinRaiser_B: 1, chinRaiser_T: 1, lipSuck_LB: 1, lowerLipDepressor_L: 1 }); const j2 = await jaw();
    if (j2.jaw.some((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) > 1e-6)) throw new Error("a lip shape moved the jaw");
    if ([j1, j2].some(j => j.upper.some((v, i) => Math.abs(v - m.upper[i]) > 1e-9))) throw new Error("an expression moved the upper teeth");
    const fold = await page.evaluate(() => { const b = window.__body, E = n => b.ENAMES.indexOf(n); b.st.expr.fill(0); b.st.expr[E("lipPucker_L")] = 1; b.st.expr[E("lipFunneler_LB")] = 0.6;
      const w = b.paired(); return [w[E("lipPucker_L")], w[E("lipFunneler_LB")]]; });   // a full pucker and a funnel together fold the lower lip out: the funnel gives way
    if (fold[0] !== 1 || fold[1] > 0.1 + 1e-6) throw new Error(`a pucker with a funnel isn't limited: ${fold}`);
    // the opening as a mask: the membrane drawn green with the teeth off; then with them on, every pixel they change must be in it
    await page.click('#views button[data-v="head"]');
    const shot = async () => { await page.waitForTimeout(300); const clip = await page.evaluate(() => { const r = document.querySelector("#view canvas").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
      return (await page.screenshot({ clip, timeout: 120000 })).toString("base64"); };
    const speech = { aa: { jawDrop: 0.5, upperLipRaiser_L: 0.25, upperLipRaiser_R: 0.25 }, wide: { jawDrop: 1 }, smile: { lipCornerPuller_L: 1, lipCornerPuller_R: 1, jawDrop: 0.25, upperLipRaiser_L: 0.3, upperLipRaiser_R: 0.3 },
                     oo: { lipPucker_L: 1, lipPucker_R: 1, lipFunneler_LB: 0.6, lipFunneler_LT: 0.6, lipFunneler_RB: 0.6, lipFunneler_RT: 0.6, jawDrop: 0.25 },
                     snarl: { upperLipRaiser_L: 1, upperLipRaiser_R: 1, jawDrop: 0.15, lowerLipDepressor_L: 0.6, lowerLipDepressor_R: 0.6 } };
    for (const [name, w] of Object.entries(speech)) for (const yaw of [0, 0.7]) {
      await pose(w);
      await page.evaluate(yaw => { const b = window.__body, o = b.orbit, h = b.st.height, p = b.lmk(13); o.yaw = yaw; o.pitch = 0; o.zoom = 0.42; o.pan.set(p[0], p[1] - (h - 0.12 * h / 1.7), p[2]);
        b.BAG.material.color.set(0x00ff00); b.BAG.material.vertexColors = false; b.BAG.material.needsUpdate = true; b.st.teeth.on = false; b.compose(); }, yaw);
      const a = await shot();
      const ring = await page.evaluate(() => { const b = window.__body, r = document.querySelector("#view canvas").getBoundingClientRect(), R = b.mouthRing; if (!R) return null;
        return R.map(p => { const v = new b.THREE.Vector3(...p).applyMatrix4(b.rig.matrixWorld).project(b.camera); return [(v.x + 1) / 2 * r.width, (1 - v.y) / 2 * r.height]; }); });
      await page.evaluate(() => { window.__body.st.teeth.on = true; window.__body.compose(); });
      const t = await shot();
      const r = await page.evaluate(async ([a, t, ring]) => {
        const px = async b64 => { const i = new Image(); i.src = "data:image/png;base64," + b64; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
        const A = await px(a), T = await px(t), W = A.width, H = A.height, d = A.data, e = T.data, mask = new Uint8Array(W * H);
        for (let i = 0; i < W * H; i++) if (d[i * 4 + 1] > 150 && d[i * 4] < 90 && d[i * 4 + 2] < 90) for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {   // the edge's soft pixels too
          const j = i + y * W + x; if (j >= 0 && j < W * H) mask[j] = 1; }
        let changed = 0, out = 0;
        for (let i = 0; i < W * H; i++) if (Math.abs(d[i * 4] - e[i * 4]) + Math.abs(d[i * 4 + 1] - e[i * 4 + 1]) + Math.abs(d[i * 4 + 2] - e[i * 4 + 2]) > 30) { changed++; if (!mask[i]) out++; }
        let skin = 0, area = 0;                          // inside the opening's outline, a little in from it: the bag everywhere, no skin
        if (ring) { const c = ring.reduce((q, p) => [q[0] + p[0] / ring.length, q[1] + p[1] / ring.length], [0, 0]), P = ring.map(p => [c[0] + (p[0] - c[0]) * 0.9, c[1] + (p[1] - c[1]) * 0.8]);
          const inP = (x, y) => { let k = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) k = !k; return k; };
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inP(x, y)) { area++; const i = (y * W + x) * 4; if (!(d[i + 1] > 150 && d[i] < 90 && d[i + 2] < 90)) skin++; } }
        return { changed, out, skin, area };
      }, [a, t, ring]);
      if (yaw === 0 && name !== "oo" && r.area > 200 && r.skin > 0.03 * r.area)   // (a pucker's lips stand in front of its opening and are kept) throw new Error(`${name} at ${yaw}: ${r.skin} of the ${r.area} pixels inside the opening's outline aren't the mouth's inside`);
      if (r.out > Math.max(6, 0.005 * r.changed)) throw new Error(`${name} at ${yaw}: ${r.out} of the ${r.changed} pixels the teeth change are outside the opening`);
      if (name !== "oo" && r.changed < 200) throw new Error(`${name} at ${yaw}: the teeth hardly show (${r.changed} pixels)`);
    }
    await page.evaluate(() => { const b = window.__body; b.BAG.material.color.set(0xffffff); b.BAG.material.vertexColors = true; b.BAG.material.needsUpdate = true; b.st.expr.fill(0); b.compose(); });
    const saved = await page.evaluate(async () => { const b = window.__body; b.st.teeth.shade = 0.6; document.querySelector("#save").click(); await new Promise(r => setTimeout(r, 1500));
      return (await (await fetch(`api/people/${encodeURIComponent(b.who)}`)).json()).teeth; });
    if (saved?.shade !== 0.6 || saved.on !== true) throw new Error(`the teeth aren't saved with the character: ${JSON.stringify(saved)}`);
    // the lower lip's curl: it rolls the lip's inner edge in by its amount, and at rest the lips stay closed (no cut, no teeth) whatever it is
    const curl = await page.evaluate(() => { const b = window.__body, C = b.CURL, at = () => Array.from(C.idx, i => [b.POS[i * 3], b.POS[i * 3 + 1], b.POS[i * 3 + 2]]);
      b.st.expr.fill(0); const out = {}; let p0 = null, moved = 0;
      for (const k of [0, 0.5, 1]) { b.st.teeth.curl = k; b.compose(); out[k] = b.SKU.uMouthOn.value || b.BAG.visible ? "open" : "closed";
        const p = at(); if (k === 0) p0 = p; if (k === 0.5) moved = Math.max(...p.map((q, i) => Math.hypot(q[0] - p0[i][0], q[1] - p0[i][1], q[2] - p0[i][2]))) / b.scale; }
      b.st.teeth.curl = 0.5; b.compose(); return { n: C.idx.length, out, moved: moved * 1000 }; });
    if (curl.n < 50) throw new Error(`the lower lip's curl moves ${curl.n} points`);
    if (Object.values(curl.out).some(v => v !== "closed")) throw new Error(`at rest the lips part with the curl: ${JSON.stringify(curl.out)}`);
    if (Math.abs(curl.moved - 1.2) > 0.15) throw new Error(`the curl at 0.5 rolls the lip's edge ${curl.moved.toFixed(2)} mm, not 1.2`);
    console.log(`       the lower lip's curl: ${curl.n} points, its edge rolled ${curl.moved.toFixed(2)} mm at 0.5; at rest closed at 0, 0.5 and 1`);
  });
  await step("the skin from the front picture: a texture, worn", async () => {
    await page.click('#tabs button[data-tab="skin"]');
    await page.click("#photoSkin button");
    await page.waitForFunction(() => window.__body.skin && window.__body.material.map === window.__body.skin, null, { timeout: 90000 });
    const st = await page.textContent("#status");
    if (!/skin: .*skin\.png/.test(st)) throw new Error(st);
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("procedural skin: made in the shader, the photo through its mask on the face; a feature changes the picture", async () => {
    await page.click('#tabs button[data-tab="skin"]');
    await page.waitForFunction(() => window.__body.skinMask, null, { timeout: 30000 });
    await page.click("#procRows label.tog input");
    await page.waitForFunction(() => window.__body.SKU.uProc.value === 1 && window.__body.SKU.uHasPhoto.value === 1 && window.__body.material.map === null, null, { timeout: 10000 });
    const a = await headShot(0);
    await page.evaluate(() => { const i = document.querySelector("#procRows .row input[type=range]"); i.value = 1; i.dispatchEvent(new Event("input")); });   // mottling all the way
    await page.evaluate(() => { const r = [...document.querySelectorAll("#procRows .row")].find(x => x.textContent.startsWith("Freckles")); const i = r.querySelector("input"); i.value = 1; i.dispatchEvent(new Event("input")); });
    const b = await headShot(0);
    if (Buffer.compare(a, b) === 0) throw new Error("the features don't change the picture");
    await page.click('#tabs button[data-tab="skin"]');
    await page.click("#procRows label.tog input");                         // back off for the rest
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("touch-up: a stroke across the lips shows, undo takes it back, saved as two pictures", async () => {
    // the frame isn't still while the wig swings: measure the mouth (no hair over it) and the paint layer itself
    await page.click('#tabs button[data-tab="skin"]');
    const a = await headShot(0);
    const mouth = await page.evaluate(() => {
      const r = document.querySelector("#view canvas").getBoundingClientRect(), p = [61, 291, 0, 17].map(i => window.__body.onScreen(i));
      const xs = p.map(q => q[0] - r.left), ys = p.map(q => q[1] - r.top);
      return { x: Math.round(Math.min(...xs)), y: Math.round(Math.min(...ys)) - 2, w: Math.round(Math.max(...xs) - Math.min(...xs)), h: Math.round(Math.max(...ys) - Math.min(...ys)) + 4 };
    });
    const red = png => page.evaluate(async ([b64, m]) => {                 // red over green, averaged over the mouth
      const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
      const d = g.getImageData(m.x, m.y, Math.max(1, m.w), Math.max(1, m.h)).data; let s = 0;
      for (let i = 0; i < d.length; i += 4) s += d[i] - d[i + 1];
      return s / (d.length / 4);
    }, [png.toString("base64"), mouth]);
    const layer = () => page.evaluate(() => { const g = window.__body.TOUCH.pg.getImageData(0, 0, 2048, 2048).data; let s = 0; for (let i = 3; i < g.length; i += 4) s += g[i]; return s; });
    const alpha0 = await layer();
    await page.click("#touchRows label.tog input");
    await page.evaluate(() => { const c = document.querySelector("#touchRows input[type=color]"); c.value = "#d0203a"; c.dispatchEvent(new Event("input")); });
    const [x0, y0] = await page.evaluate(() => window.__body.onScreen(61)), [x1, y1] = await page.evaluate(() => window.__body.onScreen(291));   // the mouth's corners
    await page.mouse.move(x0, y0); await page.mouse.down();
    for (let i = 1; i <= 4; i++) await page.mouse.move(x0 + (x1 - x0) * i / 4, y0 + (y1 - y0) * i / 4);
    await page.mouse.up();
    const ra = await red(a), rb = await red(await headShot(0));
    if (!(rb > ra + 3)) throw new Error(`the paint doesn't show on the mouth (red ${ra.toFixed(1)} -> ${rb.toFixed(1)})`);
    await page.click("#touchUndo");
    const rc = await red(await headShot(0));
    if (await layer() !== alpha0 || Math.abs(rc - ra) > 1.5) throw new Error(`undo doesn't take the stroke back (red ${ra.toFixed(1)} -> ${rc.toFixed(1)})`);
    await page.click("#touchSave");
    await page.waitForFunction(() => document.querySelector("#touchSave").textContent === "Saved", null, { timeout: 60000 });
    for (const k of ["paint", "touch"]) {
      const ok = await page.evaluate(async k => (await fetch(`api/skin/${encodeURIComponent(window.__body.who)}?${k}=1`)).ok, k);
      if (!ok) throw new Error(`skin_${k}.png wasn't saved`);
    }
    await page.click("#touchRows label.tog input");                        // painting off for the rest
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("clothes: the work uniform cut from this body and worn, in denim with a print, its hem dragged up; a taller or a sculpted body refits it", async () => {
    await page.click('#tabs button[data-tab="clothes"]');
    await page.waitForFunction(() => document.querySelectorAll("#clothesRows select option").length > 2);
    await page.selectOption("#clothesRows select >> nth=0", "work uniform");
    await page.click("#clothesRows >> text=Wear the outfit");
    await page.waitForFunction(() => window.__body.GARMENTS.children.length > 3, null, { timeout: 120000 });
    // its look: denim and a print on the shirt, the materials only (nothing refits). The outfit is socks and boots
    // first: the shirt's row is found by its name
    const shirt = await page.evaluate(() => window.__body.GARMENTS.children.find(m => m.name === "work-shirt").geometry.uuid);
    const SHIRT = "#worn > div:has(.row span:text-is('Work shirt (short sleeves)'))", LOOKS = `${SHIRT} details:has(summary:text-is('Fabric, pattern, print'))`;
    const worn = d => `window.__body.st.clothes.find(c => c.design === "${d}")`;
    await page.$eval(LOOKS, d => { d.open = true; });
    await page.selectOption(`${LOOKS} >> select >> nth=0`, "denim");
    await page.waitForFunction(() => window.__body.GARMENTS.children.find(m => m.name === "work-shirt").material.userData.uniforms.uFabricScale.value > 28);
    await page.$eval(LOOKS, d => { d.open = true; });
    await page.fill(`${LOOKS} >> input[placeholder="text to print"]`, "STAFF"); await page.press(`${LOOKS} >> input[placeholder="text to print"]`, "Enter");
    await page.waitForFunction(() => window.__body.GARMENTS.children.find(m => m.name === "work-shirt").material.userData.uniforms.uPrintOn.value === 1);
    if (await page.evaluate(() => window.__body.GARMENTS.children.find(m => m.name === "work-shirt").geometry.uuid) !== shirt) throw new Error("a new look refitted the shirt");
    if (!(await page.evaluate(`${worn("work-shirt")}.print?.text === "STAFF"`))) throw new Error("the print isn't kept with the character");
    // the shirt's hem dragged up by its handle in the view: kept as the garment's own edit, the shirt cut shorter
    const low = name => page.evaluate(n => { const m = window.__body.GARMENTS.children.find(g => g.name === n); let lo = 1e9; const P = m.geometry.attributes.position.array; for (let i = 1; i < P.length; i += 3) lo = Math.min(lo, P[i]); return lo; }, name);
    const hem0 = await low("work-shirt");
    await page.click('#views button[data-v="body"]'); await page.click('#views button[data-yaw="0"]'); await page.waitForTimeout(400);   // the earlier tabs left the view on the head
    const [hx, hy] = await page.evaluate(() => window.__body.garmentHandleOnScreen("work-shirt:hem"));
    await page.mouse.move(hx, hy); await page.mouse.down(); await page.mouse.move(hx, hy - 25, { steps: 5 }); await page.mouse.move(hx, hy - 50, { steps: 5 }); await page.mouse.up();
    await page.waitForFunction(`/^crotch\\+/.test(${worn("work-shirt")}.edit?.hem?.at || "")`, null, { timeout: 20000 });
    await page.waitForFunction(async h => { const m = window.__body.GARMENTS.children.find(g => g.name === "work-shirt"); if (!m) return false; let lo = 1e9; const P = m.geometry.attributes.position.array; for (let i = 1; i < P.length; i += 3) lo = Math.min(lo, P[i]); return lo > h + 0.03; }, hem0, { timeout: 120000 });
    const top = () => page.evaluate(() => { let t = -1e9; for (const m of window.__body.GARMENTS.children) { const P = m.geometry.attributes.position.array; for (let i = 1; i < P.length; i += 3) t = Math.max(t, P[i]); } return t; });
    const was = await top(), h = await page.evaluate(() => window.__body.st.height);
    await page.$$eval("#baseRows input", (ins, v) => { ins[1].value = v; ins[1].dispatchEvent(new Event("input")); }, h + 0.1);
    await page.waitForFunction(w => { let t = -1e9; for (const m of window.__body.GARMENTS.children) { const P = m.geometry.attributes.position.array; for (let i = 1; i < P.length; i += 3) t = Math.max(t, P[i]); } return t > w + 0.04; }, was, { timeout: 120000 });
    await page.$$eval("#baseRows input", (ins, v) => { ins[1].value = v; ins[1].dispatchEvent(new Event("input")); }, h);
    await page.waitForFunction(w => { let t = -1e9; for (const m of window.__body.GARMENTS.children) { const P = m.geometry.attributes.position.array; for (let i = 1; i < P.length; i += 3) t = Math.max(t, P[i]); } return Math.abs(t - w) < 0.01; }, was, { timeout: 120000 });
    const cut = () => page.evaluate(() => window.__body.GARMENTS.children.map(m => m.geometry.uuid).join());   // the sculpt refits them too
    for (const sc of [{ waist: 1 }, {}]) { const g0 = await cut(); await page.evaluate(v => { const b = window.__body; b.st.sculpt = v; b.compose(); }, sc);
      await page.waitForFunction(g => window.__body.GARMENTS.children.map(m => m.geometry.uuid).join() !== g, g0, { timeout: 120000 }); }
    await page.click(`${SHIRT} button[title='take it off']`);               // the shirt off, the rest stays
    await page.waitForFunction(() => { const B = window.__body; return !B.st.clothes.some(c => c.design === "work-shirt") && B.st.clothes.length === 3 &&
      !B.GARMENTS.children.some(m => m.name.startsWith("work-shirt")) && B.GARMENTS.children.some(m => m.name.startsWith("work-trousers")); }, null, { timeout: 120000 });
    while (await page.$("#worn button[title='take it off']")) await page.click("#worn button[title='take it off']");
    await page.waitForFunction(() => window.__body.GARMENTS.children.length === 0, null, { timeout: 120000 });
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("a PBR set from files on a garment: Unreal's names (albedo, normal-dx, roughness) onto the shelf, the pants wearing it", async () => {
    await page.click('#tabs button[data-tab="clothes"]');
    await page.selectOption("#clothesRows select >> nth=1", "pants");
    await page.click("#clothesRows button:text-is('Wear it')");
    await page.waitForFunction(() => window.__body.GARMENTS.children.some(m => m.name === "pants"), null, { timeout: 120000 });
    const PANTS = "#worn > div:has(.row span:text-is('Pants'))", LOOKS = `${PANTS} details:has(summary:text-is('Fabric, pattern, print'))`;
    await page.$eval(LOOKS, d => { d.open = true; });
    await page.setInputFiles(`${LOOKS} input[type=file][multiple]`, [["albedo", [30, 42, 52]], ["normal-dx", [128, 128, 255]], ["roughness", [240, 240, 240]]]
      .map(([k, rgb]) => ({ name: `_studiotest_denim_${k}.png`, mimeType: "image/png", buffer: png(rgb) })));
    await page.waitForFunction(() => window.__body.st.clothes.find(c => c.design === "pants")?.pbr === "pbr/studiotest_denim", null, { timeout: 30000 });   // the shelf hides _: it's taken off
    const m = await page.evaluate(() => { const m = window.__body.GARMENTS.children.find(g => g.name === "pants").material;
      return { normal: !!m.normalMap, dx: m.normalScale.y === -1, rough: !!m.roughnessMap, on: m.userData.uniforms.uPbrOn.value }; });
    if (!m.normal || !m.rough || m.on !== 1) throw new Error("the set isn't on the pants: " + JSON.stringify(m));
    if (!m.dx) throw new Error("a DirectX normal map wasn't turned for three.js");
    // the PBR button's shelf page shows the set on its sphere, and a map chosen by hand (the roughness: none) is kept
    const shelf = await page.context().newPage(), ref = "pbr/studiotest_denim";
    await shelf.goto(BASE + "pbr.html");
    await shelf.click(`.grid figure[data-ref="${ref}"]`, { noWaitAfter: true });
    const rough = "#maps figure:nth-child(3) select";                       // colour, normal, rough...
    const set = async (v, ok) => { await shelf.selectOption(rough, v); await shelf.waitForFunction(async ([r, ok]) =>
      new Function("m", "return " + ok)((await (await fetch("/api/pbr")).json()).sets[r]), [ref, ok], { timeout: 20000 }); };
    await set("", "!m.maps.rough && m.by_hand.rough === ''");
    await set("*", "m.maps.rough === 'studiotest_denim_roughness.png' && !('rough' in (m.by_hand || {}))");
    await shelf.close();
    fs.rmSync(path.join((await (await fetch(BASE + "api/pbr")).json()).root, "studiotest_denim"), { recursive: true, force: true });   // off the shelf again
    await page.click(`${PANTS} button[title='take it off']`);
    await page.waitForFunction(() => window.__body.GARMENTS.children.length === 0, null, { timeout: 120000 });
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("hair is the salon: the Hair tab opens it on this character, with this body", async () => {
    await page.click('#tabs button[data-tab="hair"]');
    await page.waitForFunction(n => {
      const f = document.querySelector("#salonFrame");
      return !f.hidden && document.querySelector("main").hidden && f.src.includes("person=" + encodeURIComponent(n)) && f.contentWindow.__salon && f.contentWindow.__salon.ready;
    }, NAME, { timeout: 180000 });
    const s = await page.evaluate(() => { const w = document.querySelector("#salonFrame").contentWindow; return { person: w.__salon.PERSON && w.__salon.PERSON.name, embed: w.document.body.classList.contains("embed-person"), bald: w.__salon.st.locks.length }; });
    if (s.person !== NAME || !s.embed) throw new Error("the salon in the Hair tab: " + JSON.stringify(s));
    const body = await page.evaluate(async n => (await fetch(`api/people/${encodeURIComponent(n)}/body.bin`)).ok, NAME);
    if (!body) throw new Error("the Hair tab didn't save the body for the salon");
    await page.click('#tabs button[data-tab="face"]');
    if (await page.evaluate(() => document.querySelector("main").hidden || !document.querySelector("#salonFrame").hidden)) throw new Error("the studio didn't come back from the salon");
    // a second visit after the body changed: the salon's head is the Studio's body as it is now, point for point
    const same = () => page.evaluate(() => { const w = document.querySelector("#salonFrame").contentWindow;
      const P = w.__salon.HEAD ? w.__salon.HEAD.geometry.attributes.position.array : null, B = window.__body.neutralBody();
      if (!P) return -1; let d = 0; for (let i = 0; i < B.length; i += 997) d = Math.max(d, Math.abs(P[i] - B[i])); return d; });
    const base0 = await page.evaluate(() => window.__body.st.base);
    await page.evaluate(() => { const r = document.querySelector('#baseRows input[type=range]'); r.value = 0.6; r.dispatchEvent(new Event("input")); });
    await page.click('#tabs button[data-tab="hair"]');
    await page.waitForFunction(() => /as the Character Studio has it now/.test(document.querySelector("#salonFrame").contentWindow.document.querySelector("#status")?.textContent || ""), null, { timeout: 120000 });
    const off = await same();
    await page.click('#tabs button[data-tab="face"]');
    await page.evaluate(b => { const r = document.querySelector('#baseRows input[type=range]'); r.value = b; r.dispatchEvent(new Event("input")); }, base0);
    if (!(off >= 0 && off < 1e-5)) throw new Error("the salon's head isn't the Studio's body on a second visit: " + off);
    console.log(`       the salon on ${s.person} (${s.bald} locks: ${s.bald ? "its own hair" : "bald"}); after a body change, a second visit shows the new body (within ${(off * 1e6).toFixed(1)} µm)`);
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("brows and lashes (the hair shader): off at first; the lashes on the lids' edges swing down as the eyes shut, the brows ride a brow raise", async () => {
    await page.click('#tabs button[data-tab="face"]');
    if (await page.evaluate(() => window.__body.st.lash.on || window.__body.st.brow.on)) throw new Error("brows and lashes should start off");
    await page.click("#browRows label.tog >> nth=0"); await page.click("#browRows label.tog >> nth=1");   // lashes and brows on
    await page.waitForFunction(() => window.__body.st.lash.on && window.__body.st.brow.on && window.__body.browlash && window.__body.browlash.lashes && window.__body.browlash.brows, null, { timeout: 15000 });
    const r = await page.evaluate(() => {
      const b = window.__body, i = n => b.ENAMES.indexOf(n), meanY = g => { const P = g.attributes.position.array; let y = 0; for (let k = 1; k < P.length; k += 3) y += P[k]; return y / (P.length / 3); };
      b.st.expr.fill(0); b.compose(); const cards = b.browlash, lift = cards.lift, brow = meanY(b.BLM.brow.geometry), lid = b.lmk(386)[1];
      b.st.expr[i("eyesClosed_L")] = 1; b.st.expr[i("eyesClosed_R")] = 1; b.compose(); const liftShut = b.browlash.lift, lidShut = b.lmk(386)[1];
      b.st.expr.fill(0); for (const n of ["innerBrowRaiser_L", "innerBrowRaiser_R", "outerBrowRaiser_L", "outerBrowRaiser_R"]) b.st.expr[i(n)] = 1; b.compose(); const browUp = meanY(b.BLM.brow.geometry);
      b.st.expr.fill(0); b.compose();
      return { cards, lift, liftShut, lidDrop: (lid - lidShut) * 1000, raise: (browUp - brow) * 1000, shader: !!b.BLM.lash.material.uniforms && !!b.BLM.lash.material.uniforms.atlas };
    });
    if (!(r.cards.lashes > 100 && r.cards.brows > 200) || !(r.lift - r.liftShut > 20) || !(r.raise > 1) || !r.shader) throw new Error("brows and lashes: " + JSON.stringify(r));
    await page.click("#browRows label.tog >> nth=0"); await page.click("#browRows label.tog >> nth=1");   // and off again
    await page.waitForFunction(() => !window.__body.st.lash.on && !window.__body.st.brow.on, null, { timeout: 10000 });
    console.log(`       ${r.cards.lashes} lash cards, ${r.cards.brows} brow cards; shut, the lid drops ${r.lidDrop.toFixed(1)} mm and the upper lashes turn from ${r.lift.toFixed(0)}° to ${r.liftShut.toFixed(0)}°; a brow raise lifts the brows ${r.raise.toFixed(1)} mm`);
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("the eyes: cut out of the skin along the model's own lid line (the strip its blink squeezes, found on MHR's own face; moved by hand), on a face fitted to pictures too (its blink still meets), filled in every pose (the eyeball through a stencil, over what's inside); a bigger eyeball grows back from its pupil; a blink closes the opening; Pupil size", async () => {
    const r = await page.evaluate(() => {
      const b = window.__body, L = b.EYES.L, front = () => L.position.z + L.scale.x, i = n => b.ENAMES.indexOf(n);
      const fan = () => { const P = b.HOLES.geometry.attributes.position.array; let a = 0; for (let k = 0; k < P.length; k += 9) a += Math.abs((P[k + 3] - P[k]) * (P[k + 7] - P[k + 1]) - (P[k + 6] - P[k]) * (P[k + 4] - P[k + 1])) / 2; return a; };
      b.st.expr.fill(0); b.st.eyes.size = 1; b.compose(); const f1 = front(), r1 = L.scale.x, cut = b.SKU.uCutOn.value, open = fan(), pts = b.outline("L").pts.length;
      b.st.eyes.size = 2; b.paintEyes(); b.compose(); const f2 = front(), r2 = L.scale.x, r0 = 0.0118 * b.scale;
      const stencil = L.material.stencilWrite && L.material.stencilFunc === 514 && L.material.depthTest === false;   // THREE.EqualStencilFunc
      b.st.expr[i("eyesClosed_L")] = 1; b.st.expr[i("eyesClosed_R")] = 1; b.compose(); const shut = fan(); b.st.expr.fill(0);
      b.st.eyes.on = false; b.compose(); const off = b.SKU.uCutOn.value; b.st.eyes.on = true; b.st.eyes.size = 1; b.paintEyes(); b.compose();
      const mesh = !!b.MESHLID.L && !!b.MESHLID.R, base = b.st.eyes.lidLine.base;   // the model's own lids, against MediaPipe's
      b.st.eyes.meshLids = false; b.compose(); const mp = fan(); b.st.eyes.meshLids = true; b.compose(); const own = fan();
      const keep = structuredClone(b.st.eyes.lidLine);                   // the eyelid line: the lower points down open the cut further
      for (const sd of ["L", "R"]) b.st.eyes.lidLine[sd].lower.fill(0); b.compose(); const at0 = fan();
      for (const sd of ["L", "R"]) b.st.eyes.lidLine[sd].lower.fill(-1.5); b.compose(); const at15 = fan();
      b.st.eyes.lidLine = keep; b.compose();
      // on the face fitted to the pictures: the lid line still corner to corner, each lid in order outwards; a blink meets
      const poly = P => { let a = 0; for (let k = 0, j = P.length - 1; k < P.length; j = k++) a += (P[j][0] + P[k][0]) * (P[j][1] - P[k][1]); return Math.abs(a) / 2; };
      const wide = R => Math.hypot(R[0][0] - R[8][0], R[0][1] - R[8][1]), ownRing = b.lidRing("L");
      b.st.eyes.meshLids = false; const mpRing = b.lidRing("L"); b.st.eyes.meshLids = true;
      const ordered = [ownRing.slice(9, 16), ownRing.slice(1, 8).reverse()].every(ch => ch.every((p, k) => !k || p[0] > ch[k - 1][0]));   // the left eye: outwards is +x
      const rawOpen = poly(b.outline("L", 1, false).pts); b.st.expr[i("eyesClosed_L")] = 1; b.compose(); const rawShut = poly(b.outline("L", 1, false).pts); b.st.expr.fill(0); b.compose();
      const fit = { on: !!b.delta, width: wide(ownRing) / wide(mpRing), ordered, meet: rawShut / rawOpen };
      return { mesh, base, mp, own, at0, at15, cut, pts, open, shut, f1, f2, r1, r2, r0, stencil, off, fit, pupil: [...document.querySelectorAll("#eyeRows .row span")].some(x => x.textContent === "Pupil size") };
    });
    const defaults = await page.evaluate(async () => (await fetch("api/defaults")).ok);
    if (!defaults || !r.mesh || r.base !== "mesh" || !(r.own > 1.3 * r.mp) || !(r.at15 > r.at0 * 1.05) || r.cut !== 1 || r.pts !== 32 || !(r.open > 0) || !(r.shut < 0.05 * r.open) || Math.abs(r.f2 - r.f1) > 1e-6 || !(r.r1 >= r.r0) || !(r.r2 >= 2 * r.r0 - 1e-9) || !r.stencil || r.off || !r.pupil
        || !r.fit.on || !(r.fit.width > 0.8 && r.fit.width < 1.6) || !r.fit.ordered || !(r.fit.meet < 0.3)) throw new Error("the eyes: " + JSON.stringify(r));
    console.log(`       the model's own lids on both eyes: the opening ${(r.own * 1e6).toFixed(0)} mm² against MediaPipe's ${(r.mp * 1e6).toFixed(0)}`);
    console.log(`       the eyelid line's lower points 1.5 mm down: the opening ${(r.at0 * 1e6).toFixed(0)} -> ${(r.at15 * 1e6).toFixed(0)} mm²`);
    console.log(`       on the face fitted to the pictures: the lid line ${r.fit.width.toFixed(2)} times MediaPipe's width, in order; a blink leaves ${(r.fit.meet * 100).toFixed(0)}% of the lids' opening`);
    console.log(`       openings ${(r.open * 1e6).toFixed(0)} mm² open, ${(r.shut * 1e6).toFixed(1)} shut; the eyeball fitted at ${(r.r1 * 1000).toFixed(1)} mm (12 mm: ${(r.r0 * 1000).toFixed(1)}), size 2: ${(r.r2 * 1000).toFixed(1)} mm, its front where it was`);
  });
  await step("the split view: front and side panes, each its own camera (the wheel in one moves only it), the line between them dragged; Split again for one view", async () => {
    await page.click('#views button[data-v="head"]'); await page.click("#splitBtn");
    const c = await page.evaluate(() => { const r = document.querySelector("#view canvas").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
    const before = await page.evaluate(() => window.__body.SPLIT.orbits.map(o => o.zoom));
    await page.mouse.move(c[0] + c[2] * 0.75, c[1] + c[3] * 0.5); await page.mouse.wheel(0, 300); await page.waitForTimeout(200);
    const bar = await page.evaluate(() => { const r = document.querySelector("#splitBar").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.mouse.move(bar[0], bar[1]); await page.mouse.down(); await page.mouse.move(bar[0] - c[2] * 0.2, bar[1], { steps: 4 }); await page.mouse.up();
    const r = await page.evaluate(() => { const S = window.__body.SPLIT; return { on: S.on, active: S.active, at: S.at, zooms: S.orbits.map(o => o.zoom), yaws: S.orbits.map(o => o.yaw) }; });
    await page.click("#splitBtn");
    const off = await page.evaluate(() => ({ on: window.__body.SPLIT.on, bar: document.querySelector("#splitBar").hidden }));
    if (!r.on || r.active !== 1 || !(r.zooms[1] > before[1]) || r.zooms[0] !== before[0] || Math.abs(r.yaws[1] - Math.PI / 2) > 1e-6 || r.yaws[0] !== 0 || !(r.at < 0.4) || off.on || !off.bar) throw new Error("the split: " + JSON.stringify({ r, before, off }));
    console.log(`       front and side; the side pane zoomed ${before[1].toFixed(2)} -> ${r.zooms[1].toFixed(2)}, the front kept ${r.zooms[0].toFixed(2)}; the line at ${(r.at * 100).toFixed(0)}%; one view again`);
    await page.click('#views button[data-v="body"]');
  });
  await step("the view like Blender's: middle- (or right-) drag turns it, Shift+drag pans; the mouse's back button, right-click's menu and Backspace don't leave the page (Backspace still types)", async () => {
    await page.click('#views button[data-v="body"]');
    const c = await page.evaluate(() => { const r = document.querySelector("#view canvas").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const at = () => page.evaluate(() => { const o = window.__body.orbit; return { yaw: o.yaw, pan: o.pan.toArray() }; });
    const o0 = await at();
    await page.mouse.move(c[0], c[1]); await page.mouse.down({ button: "middle" }); await page.mouse.move(c[0] + 90, c[1], { steps: 5 }); await page.mouse.up({ button: "middle" });
    const o1 = await at();
    await page.keyboard.down("Shift"); await page.mouse.move(c[0], c[1]); await page.mouse.down({ button: "middle" }); await page.mouse.move(c[0] + 60, c[1] + 30, { steps: 5 }); await page.mouse.up({ button: "middle" }); await page.keyboard.up("Shift");
    const o2 = await at();
    const g = await page.evaluate(() => {
      const cv = document.querySelector("#view canvas");
      const fire = (type, init) => { const e = new MouseEvent(type, { bubbles: true, cancelable: true, ...init }); cv.dispatchEvent(e); return e.defaultPrevented; };
      const key = (k, t) => { const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }); t.dispatchEvent(e); return e.defaultPrevented; };
      return { back: fire("mouseup", { button: 3 }), forward: fire("mousedown", { button: 4 }), menu: fire("contextmenu", { button: 2 }), paste: fire("mousedown", { button: 1 }),
               backspace: key("Backspace", document.body), altLeft: (() => { const e = new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true, cancelable: true }); document.body.dispatchEvent(e); return e.defaultPrevented; })(),
               typing: key("Backspace", document.querySelector("#newName")) };
    });
    await page.click('#views button[data-v="body"]');
    const pan1 = Math.hypot(...o1.pan.map((v, i) => v - o0.pan[i])), pan2 = Math.hypot(...o2.pan.map((v, i) => v - o1.pan[i]));
    if (!(Math.abs(o1.yaw - o0.yaw) > 0.3) || pan1 > 1e-9 || Math.abs(o2.yaw - o1.yaw) > 1e-9 || !(pan2 > 0.01) || !g.back || !g.forward || !g.menu || !g.paste || !g.backspace || !g.altLeft || g.typing) throw new Error("the view's controls: " + JSON.stringify({ o0, o1, o2, g }));
    console.log(`       middle-drag turned the view ${((o1.yaw - o0.yaw) * 180 / Math.PI).toFixed(0)} degrees (no pan), Shift+middle-drag panned ${(pan2 * 100).toFixed(1)} cm (no turn); back and forward buttons, right-click's menu, middle-click's paste, Backspace and Alt+Left stopped; Backspace in a text box types`);
  });
  await step("the head OBJ exports", async () => {
    await page.click("#expHead");
    await page.waitForFunction(() => /wrote .*_studiotest_head\.obj/.test(document.querySelector("#status").textContent), null, { timeout: 30000 });
  });
  if (shot) await page.screenshot({ path: shot });
  await step("cleared pictures take the face away", async () => {
    await page.click('#tabs button[data-tab="face"]');
    // the button itself: by now a software-rendered frame (wig, strands, clothes) is too slow for the pointer's wait for still frames
    for (let n; (n = await page.$$eval("#slots .slot .x", x => x.length)) > 0;) {    // one at a time: the slots redraw after each
      await page.$eval("#slots .slot .x", b => b.click());
      await page.waitForFunction(n => document.querySelectorAll("#slots .slot .x").length < n, n, { timeout: 60000 });
    }
    await page.waitForFunction(() => !window.__body.delta && window.__body.pics.length === 0, null, { timeout: 60000 });
  });
  if (errors.length) fail("page errors: " + errors.join(" | "));
  await browser.close();
  console.log("STUDIO ok");
})();

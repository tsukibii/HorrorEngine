// The Character Studio (tools/character/index.html) in a headless browser: MHR loads with its 45 sliders; a scratch character;
// the feminine base and a shape slider move the body, the height scales it; the sculpt's controls (Belly -1 a flat
// stomach); the view's T-pose (the arms level, the head untouched) over a body written in MHR's own pose; a front picture (the page's own head from
// the front, so no one's photo is needed) bends the face and nothing under the neck; a side picture (the head at 3/4)
// is taken for the depth; the expressions: a preset moves only the face, the ARKit map routes a blink onto
// eyesClosed (not a look), the eyeballs sit either side; the skin is made from the front picture and worn; the procedural
// skin takes over the body with the photo on the face through its mask, and its features change the picture; the work uniform
// is cut from the body and worn, takes denim and a print without refitting, its hem is dragged up by its handle,
// and it refits when the body grows; a t-shirt and a skirt hang by gravity (the drape), lower than they were cut, are
// baked with the character (drape.bin, read back the same) and taken as baked when nothing changed, each with its Hang
// settings; at a Fit of 0 the t-shirt clings to the body and doesn't hang; a PBR set chosen from files named as Unreal's are (albedo, normal-dx, roughness)
// goes onto the shelf as assets/pbr/studiotest_denim (the files' leading _ taken off) and onto the pants, its DirectX
// normal turned for three.js; the PBR shelf page shows it, a map chosen by hand there is kept, and the set goes;
// the Hair tab is the salon on this character (its body saved for it), brows and lashes switch in the Face tab; the anime
// lash styles gather the lashes into spikes and the natural one spreads them; the anime pink makeup paints the liner from
// the lashes' roots and pink under the eye, and its look turns the lashes on; the three drawn eye shapes are lash styles
// (the fox's sweep, the half-lidded's lashes down over the eye, the doll's spikes) with a liner each;
// accessories are held to the skin; the head OBJ exports; the export for the desk and Unreal carries the character's
// recipe and Import brings it back with every file and setting the same; the pictures clear and the face goes.
// Ends "STUDIO ok".
//
//   python tools/face_mesh.py setup, python tools/retarget.py setup   (once)
//   python tools/character/serve.py              (in another shell)
//   node tools/character/studiotest.js [shot.png]        (ONLY=jewellery: just the steps whose words match, after the new character)
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
  const saveNow = async () => {                       // Save, and wait for this save's word (not the last one's)
    await page.evaluate(() => { document.querySelector("#status").textContent = ""; });
    await page.click("#save"); await page.waitForFunction(() => /saved/.test(document.querySelector("#status").textContent), null, { timeout: 30000 });
  };
  const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY, "i") : null;   // ONLY=jewellery: those steps alone (after the new character)
  const step = async (what, fn) => {
    if (ONLY && !ONLY.test(what) && !/^(MHR loads|a new character)/.test(what)) return;
    try { await fn(); console.log("  ok  " + what); } catch (e) { await page.screenshot({ path: shot || "studiotest_fail.png" }); fail(`${what}: ${e.message}`); }
  };
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
    // it starts from the studio's look (soft cinematic), applied and saved once it's open: the steps below were written for MHR's plain one
    await page.waitForFunction(() => /starts from the/.test(document.querySelector("#status").textContent), null, { timeout: 90000 });
    const look = await page.evaluate(async n => { const b = window.__body, s = b.st, saved = await (await fetch(`api/people/${n}`)).json();
      const got = { lips: s.lips.on, soft: s.eyes.limbalSoft, tear: s.eyes.tearline, proc: s.skin.proc.on, savedLips: saved.lips?.on };
      b.useLook("MHR plain"); return { got, plain: { lips: s.lips.on, soft: s.eyes.limbalSoft, proc: s.skin.proc.on } }; }, NAME);
    if (!look.got.lips || look.got.soft !== 0.6 || !(look.got.tear > 0) || !look.got.proc || !look.got.savedLips) throw new Error(`a new character's look: ${JSON.stringify(look.got)}`);
    if (look.plain.lips || look.plain.soft !== 0 || look.plain.proc) throw new Error(`MHR plain: ${JSON.stringify(look.plain)}`);
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
      b.st.sculpt = { belly: -1 }; b.compose(); const p2 = P(), H = b.st.height;   // the belly taken back: the stomach's front, nothing over the chest or under the hips
      let flat = 0, elsewhere = 0; for (let i = 0; i < p0.length; i += 3) { const d = p0[i + 2] - p2[i + 2]; flat = Math.max(flat, d); if ((p0[i + 1] > 0.75 * H || p0[i + 1] < 0.5 * H) && Math.hypot(p2[i] - p0[i], p2[i + 1] - p0[i + 1], d) > 1e-7) elsewhere++; }
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
      return { controls: S.controls.length, handles: b.HANDLES.list.length, topUp: p1[hi] - p0[hi], below, worst, unmatched, moved: S.controls.reduce((a, c) => a + c.idx.length, 0), flat, elsewhere, scale: b.scale };
    });
    if (!(r.controls >= 20) || !(r.handles >= 30) || !(r.topUp > 0.01) || r.below || r.worst > 1e-6 || r.unmatched > 0.05 * r.moved) throw new Error("the sculpt: " + JSON.stringify(r));
    if (!(r.flat > 0.015 * r.scale) || r.elsewhere) throw new Error(`Belly -1: the stomach back ${(r.flat * 1000).toFixed(1)} mm, ${r.elsewhere} points moved over the chest or under the hips`);
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
    console.log(`       Belly -1 takes the stomach back ${(r.flat * 1000).toFixed(0)} mm (a flat line from the pubic bone to the ribs)`);
    console.log(`       ${r.controls} controls, ${r.handles} circles; Forehead height 1 raises the head's top ${(r.topUp * 1000).toFixed(0)} mm and nothing under the chest; every control mirrored (within ${r.worst.toExponential(0)} m where the base is: all but ${r.unmatched} of ${r.moved} points); the forehead's circle dragged 60 px up: Forehead height ${after.v} (its row green while held), saved`);
  });
  await step("the view's pose: a T-pose to shape in (the arms level from the shoulders, the legs straight, the neck stood up under a head untouched to the last bit); the A-pose is MHR's own, and what's written stays in it", async () => {
    const r = await page.evaluate(async () => {
      const b = window.__body, R = b.RIG, X = b.POSED, J = n => { const i = R.byName.get(n); return [X.J2[i * 3], X.J2[i * 3 + 1], X.J2[i * 3 + 2]]; };
      const H = R.byName.get("c_head"), inHead = new Uint8Array(R.bones.length); for (const k of R.order) { const p = R.bones[k].parent; inHead[k] = k === H || (p >= 0 && inHead[p]) ? 1 : 0; }
      let head = 0, headPts = 0;                       // the head's own points (on its bones alone): not a bit moved
      for (let i = 0; i < b.N; i++) { let on = true; for (let k = 0; k < 4; k++) if (R.BW[i * 4 + k] > 0 && !inHead[R.BI[i * 4 + k]]) on = false;
        if (on) { headPts++; for (let a = 0; a < 3; a++) head = Math.max(head, Math.abs(b.SHOW[i * 3 + a] - b.POS[i * 3 + a])); } }
      const ahead = A => A[H * 3 + 2] - (A[R.byName.get("l_uparm") * 3 + 2] + A[R.byName.get("r_uparm") * 3 + 2]) / 2, yC = X.J[R.byName.get("c_spine3") * 3 + 1];
      const neck = { was: ahead(X.J), now: ahead(X.J2), want: b.PO.NECK_AHEAD * (X.J[H * 3 + 1] - yC) };
      const drawn = () => { const D = b.rig.children.find(o => o.isMesh && o.geometry.attributes.objPos).geometry.attributes.position.array; let d = 0;
        for (let c = 0; c < b.TRIS.length; c += 7) for (let a = 0; a < 3; a++) d = Math.max(d, Math.abs(D[c * 3 + a] - b.POS[b.TRIS[c] * 3 + a])); return d; };
      const out = { pose: b.pose, arms: Math.abs(J("l_wrist")[1] - J("l_uparm")[1]) + Math.abs(J("r_wrist")[1] - J("r_uparm")[1]), legs: Math.abs(J("l_foot")[0] - J("l_upleg")[0]) + Math.abs(J("r_foot")[0] - J("r_upleg")[0]), head, headPts, neck, drawn: drawn() };
      out.written = await b.inRest(() => drawn()); out.after = b.pose;   // an export's body: MHR's own pose
      b.setPose("rest"); out.rest = drawn(); out.restPosed = !!b.POSED; b.setPose("t");
      return out;
    });
    if (r.pose !== "t" || !(r.arms < 0.01) || !(r.legs < 0.01) || r.head !== 0 || !(r.headPts > 3000) || !(Math.abs(r.neck.now - Math.min(r.neck.was, r.neck.want)) < 1e-4 && r.neck.was - r.neck.now > 0.02) || !(r.drawn > 0.2) || r.written !== 0 || r.after !== "t" || r.rest !== 0 || r.restPosed) throw new Error("the pose: " + JSON.stringify(r));
    console.log(`       the arms level (${(r.arms * 1000).toFixed(1)} mm off), the legs straight (${(r.legs * 1000).toFixed(1)} mm), the neck stood up (the head's joint ${(r.neck.was * 100).toFixed(1)} -> ${(r.neck.now * 100).toFixed(1)} cm ahead of the shoulders'), the head's ${r.headPts} points exactly where they were; drawn up to ${(r.drawn * 100).toFixed(0)} cm from MHR's pose, written in it`);
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
  await step("teeth and tongue: as wide as the mouth, the lower ones on the jaw (a lip shape never moves them), seen only through the opening in every speech pose; the opening clean to its corners (no skin left inside its outline); the lower lip's curl, closed at rest; the teeth wet, their edges translucent", async () => {
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
    const look = await page.evaluate(() => { const m = window.__body.MOUTH.parts["upper-teeth"], c = m.geometry.attributes.color.array; let blue = 0;
      for (let i = 0; i < c.length; i += 3) blue = Math.max(blue, c[i + 2] / Math.max(c[i], 1e-3));
      return { coat: m.material.clearcoat, blue }; });   // wet (a clear coat), the biting edges translucent blue-grey
    if (!(look.coat > 0.5) || !(look.blue > 1.1)) throw new Error(`the teeth's look: coat ${look.coat}, the bluest edge ${look.blue.toFixed(2)}`);
  });
  await step("lipstick: painted inside the lips' outline (its guide, shown on request) over the photo skin or none, following the lips when the jaw drops; saved with the character", async () => {
    await page.click('#tabs button[data-tab="face"]'); await page.click('#views button[data-v="head"]');
    const redness = async () => {                                   // red over green, averaged over the lower lip on the screen
      await page.waitForTimeout(400);
      const box = await page.evaluate(() => { const r = document.querySelector("#view canvas").getBoundingClientRect(), b = window.__body, a = b.onScreen(14), c = b.onScreen(17);
        const x = (a[0] + c[0]) / 2 - r.left, y = (a[1] + c[1]) / 2 - r.top; return { x: Math.round(x - 12), y: Math.round(y - 4), w: 24, h: 8 }; });
      const png = (await page.screenshot({ clip: await page.evaluate(() => { const r = document.querySelector("#view canvas").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) })).toString("base64");
      return page.evaluate(async ([b64, m]) => { const i = new Image(); i.src = "data:image/png;base64," + b64; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height;
        const g = c.getContext("2d"); g.drawImage(i, 0, 0); const d = g.getImageData(m.x, m.y, m.w, m.h).data; let s = 0; for (let k = 0; k < d.length; k += 4) s += d[k] - d[k + 1]; return s / (d.length / 4); }, [png, box]);
    };
    await page.evaluate(() => { const b = window.__body, o = b.orbit, h = b.st.height, p = b.lmk(14); b.st.expr.fill(0); b.compose(); o.yaw = 0; o.pitch = 0; o.zoom = 0.3; o.pan.set(p[0], p[1] - (h - 0.12 * h / 1.7), p[2]); });
    const off = await redness();
    await page.click("#lipRows label.tog input");                 // Lipstick on
    const on = await redness();
    if (!(on > off + 12)) throw new Error(`the lipstick doesn't show on the lower lip: red over green ${off.toFixed(1)} -> ${on.toFixed(1)}`);
    const r = await page.evaluate(() => { const b = window.__body, low = () => Math.min(...b.SKU.uLipP.value.map(v => v.y));
      const guides = [...document.querySelectorAll("#lipRows label.tog input")]; guides[1].click();
      const shown = b.LIPGUIDE.line.visible && b.LIPGUIDE.line.geometry.attributes.position.count === 32;
      const y0 = low(); b.st.expr[b.ENAMES.indexOf("jawDrop")] = 0.6; b.compose(); const y1 = low(); b.st.expr.fill(0); b.compose();
      guides[1].click(); return { shown, hidden: !b.LIPGUIDE.line.visible, drop: (y0 - y1) / b.scale * 1000, on: b.SKU.uLipOn.value };
    });
    if (!r.shown || !r.hidden || r.on !== 1) throw new Error(`the guide: shown ${r.shown}, hidden again ${r.hidden}, lipstick ${r.on}`);
    if (!(r.drop > 8)) throw new Error(`the lipstick's outline doesn't follow the jaw: its lowest point moved ${r.drop.toFixed(1)} mm`);
    const saved = await page.evaluate(async () => { document.querySelector("#save").click(); await new Promise(r => setTimeout(r, 1500)); return (await (await fetch(`api/people/${encodeURIComponent(window.__body.who)}`)).json()).lips; });
    if (!saved?.on || saved.guide !== undefined) throw new Error(`the lipstick isn't saved with the character: ${JSON.stringify(saved)}`);
    await page.click("#lipRows label.tog input");                 // off again for the rest
    console.log(`       the lower lip red over green ${off.toFixed(1)} -> ${on.toFixed(1)}; its outline follows the jaw ${r.drop.toFixed(1)} mm down`);
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
  const HANG = "label:has-text('Hang by gravity (cloth simulation)') input";
  await step("clothes: the work uniform cut from this body and worn, in denim with a print, its hem dragged up; a taller or a sculpted body refits it", async () => {
    await page.click('#tabs button[data-tab="clothes"]');
    await page.waitForFunction(() => document.querySelectorAll("#clothesRows select option").length > 2);
    if (await page.isChecked(HANG)) await page.click(HANG);                  // the cut alone here: the drape has its own step
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
  await step("clothes hang by gravity: a t-shirt and a skirt fall from the cut, are baked with the character and taken back as baked; a fit of 0 clings", async () => {
    await page.click('#tabs button[data-tab="clothes"]');
    await page.selectOption("#clothesRows select >> nth=0", "t-shirt and skirt");
    await page.click("#clothesRows >> text=Wear the outfit");
    await page.waitForFunction(() => window.__body.drapeState.stage === "done" && window.__body.GARMENTS.children.some(m => m.name === "skirt"), null, { timeout: 120000 });
    // where a garment's cloth is in MHR's own pose (the view turns it to the T-pose): its lowest point, how far out from the body's middle
    const shape = n => page.evaluate(n => { const m = window.__body.GARMENTS.children.find(g => g.name === n); if (!m) return null;
      const P = m.userData.rest ? m.userData.rest.P : m.geometry.attributes.position.array; let lo = 1e9, r = 0;
      for (let i = 0; i < P.length; i += 3) { lo = Math.min(lo, P[i + 1]); r += Math.hypot(P[i], P[i + 2]); } return { lo, r: r / (P.length / 3) }; }, n);
    const cut = await shape("t-shirt"), skirtCut = await shape("skirt");
    await page.click(HANG);                                                  // hung: the cut first, then the clothes as they fall
    await page.waitForFunction(() => window.__body.drapeState.stage === "hung", null, { timeout: 600000 });
    const hung = await shape("t-shirt"), skirtHung = await shape("skirt");
    if (!(hung.lo < cut.lo - 0.01)) throw new Error(`the t-shirt didn't fall: its hem ${cut.lo.toFixed(3)} -> ${hung.lo.toFixed(3)}`);
    if (Math.abs(skirtHung.lo - skirtCut.lo) > 0.06 || Math.abs(skirtHung.r - skirtCut.r) < 0.001) throw new Error(`the skirt: ${JSON.stringify([skirtCut, skirtHung])}`);
    const keys = await page.evaluate(() => Object.keys(window.__body.bakes).sort());
    if (keys.length !== 2) throw new Error(`${keys.length} bakes, not the t-shirt's and the skirt's`);
    if ((await page.$$("#worn details > summary:text-is('Hang')")).length !== 2) throw new Error("no Hang settings under the skirt and the t-shirt");
    await saveNow();
    await page.waitForFunction(async k => { const b = window.__body, got = await b.loadDrape(b.who), ks = Object.keys(got).sort();
      return ks.join() === k.join() && ks.every(x => got[x].length === b.bakes[x].length && got[x].every((v, i) => v === b.bakes[x][i])); }, keys, { timeout: 30000 });
    await page.evaluate(() => window.__body.dress());                       // nothing changed: taken as baked, nothing falls
    await page.waitForFunction(() => window.__body.drapeState.stage === "hung" && /as baked/.test(document.querySelector("#status").textContent), null, { timeout: 120000 });
    const again = await shape("t-shirt");
    if (Math.abs(again.lo - hung.lo) > 1e-6 || Math.abs(again.r - hung.r) > 1e-6) throw new Error("the bake didn't come back as it hung");
    // a fit of 0: skin tight, nothing to hang; its cloth nearer the body all round
    const TEE = "#worn > div:has(.row span:text-is('T-shirt'))";
    await page.$eval(`${TEE} details:has(summary:text-is('Shape'))`, d => { d.open = true; });
    await page.$eval(`${TEE} details:has(summary:text-is('Shape')) .row:has(span:text-is('Fit')) input`, i => { i.value = 0; i.dispatchEvent(new Event("input")); });
    await page.waitForFunction(() => window.__body.st.clothes.find(c => c.design === "t-shirt")?.edit?.fit === 0, null, { timeout: 10000 });
    await page.waitForFunction(() => window.__body.drapeState.stage === "hung" && /hung by gravity: skirt[^,]*$/.test(document.querySelector("#status").textContent), null, { timeout: 600000 });
    const tight = await shape("t-shirt");                                   // nearer the body all round (the t-shirt as designed is close already:
    if (!(tight.r < hung.r - 0.0015)) throw new Error(`at a fit of 0 the t-shirt is ${((hung.r - tight.r) * 1000).toFixed(1)} mm nearer the body`);   // 2.5 mm on average, 2026-10-26)
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
  await step("brows and lashes (the hair shader): off at first; the lashes on the lids' edges lie over the lid's rim to its front edge (no bare skin between the eye and the lashes) and turn with the lid as the eyes shut, still on their rim, pointing at the viewer; the lash line a dense fringe; the brows ride a brow raise", async () => {
    await page.click('#tabs button[data-tab="face"]');
    if (await page.evaluate(() => window.__body.st.lash.on || window.__body.st.brow.on)) throw new Error("brows and lashes should start off");
    await page.click("#browRows label.tog >> nth=0"); await page.click("#browRows label.tog >> nth=1");   // lashes and brows on
    await page.waitForFunction(() => window.__body.st.lash.on && window.__body.st.brow.on && window.__body.browlash && window.__body.browlash.lashes && window.__body.browlash.brows, null, { timeout: 15000 });
    const r = await page.evaluate(() => {
      const b = window.__body, i = n => b.ENAMES.indexOf(n), meanY = g => { const P = g.attributes.position.array; let y = 0; for (let k = 1; k < P.length; k += 3) y += P[k]; return y / (P.length / 3); };
      b.st.expr.fill(0); b.compose(); const cards = b.browlash, lift = cards.lift, toward = cards.toward, brow = meanY(b.BLM.brow.geometry), lid = b.lmk(386)[1];
      b.st.expr[i("eyesClosed_L")] = 1; b.st.expr[i("eyesClosed_R")] = 1; b.compose(); const liftShut = b.browlash.lift, rimShut = b.browlash.rim, towardShut = b.browlash.toward, lidShut = b.lmk(386)[1];
      b.st.expr.fill(0); for (const n of ["innerBrowRaiser_L", "innerBrowRaiser_R", "outerBrowRaiser_L", "outerBrowRaiser_R"]) b.st.expr[i(n)] = 1; b.compose(); const browUp = meanY(b.BLM.brow.geometry);
      b.st.expr.fill(0); b.compose();
      return { cards, lift, liftShut, rimShut, toward, towardShut, lidDrop: (lid - lidShut) * 1000, raise: (browUp - brow) * 1000, shader: !!b.BLM.lash.material.uniforms && !!b.BLM.lash.material.uniforms.atlas, line: b.BLM.line.geometry.attributes.position.count };
    });
    // over the rim: MHR's upper rim is 2.4 mm deep in the middle, less towards the corners (the lashes lift from its front
    // edge, not from the line along its back); shut, they keep their rim, turned with the lid, and point at the viewer
    if (!(r.cards.lashes > 300 && r.cards.brows > 200 && r.cards.line === 2 && r.line > 100) || !(r.lift - r.liftShut > 20) || !(r.cards.rim > 1.2 && r.cards.rim < 3.2) || !(r.rimShut > 1.2 && r.rimShut < 3.2) || !(r.liftShut < 0 && r.liftShut > -60) || !(r.raise > 1) || !r.shader) throw new Error("brows and lashes: " + JSON.stringify(r));
    await page.click("#browRows label.tog >> nth=0"); await page.click("#browRows label.tog >> nth=1");   // and off again
    await page.waitForFunction(() => !window.__body.st.lash.on && !window.__body.st.brow.on, null, { timeout: 10000 });
    console.log(`       ${r.cards.lashes} lash cards, ${r.cards.brows} brow cards; the upper lashes lie ${r.cards.rim.toFixed(1)} mm over the lid's rim before they lift (${r.rimShut.toFixed(1)} shut); shut, the lid drops ${r.lidDrop.toFixed(1)} mm and the upper lashes turn from ${r.lift.toFixed(0)}° to ${r.liftShut.toFixed(0)}°, pointing at the viewer (${r.towardShut.toFixed(2)} of straight at them, ${r.toward.toFixed(2)} open); a brow raise lifts the brows ${r.raise.toFixed(1)} mm`);
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("anime lashes after the user's references: the anime styles gather the lashes into separate spikes with gaps between them, every other spike shorter, the lower lashes pointing down the skin; the natural style spreads them evenly and level; a style sets every slider; the styles are grouped in the picker", async () => {
    await page.click('#tabs button[data-tab="face"]');
    const groups = await page.$$eval("#browRows select optgroup", gs => gs.map(g => g.label));
    if (!groups.some(g => /anime/i.test(g)) || !groups.some(g => /natural/i.test(g))) throw new Error("the style picker's groups: " + JSON.stringify(groups));
    const r = await page.evaluate(async () => {
      const b = window.__body, BL = await import("./browlash.js");
      const at = k => { Object.assign(b.st.lash, BL.styleOf(k), { on: true }); b.browLash(); const c = b.browlash; return { spike: c.spike, vary: c.vary, drop: c.drop, lift: c.lift, rim: c.rim, cards: c.lashes }; };
      const anime = at("anime"), drawn = at("drawn"), doll = at("animeDoll"), natural = at("natural"), N = BL.styleOf("natural");
      const reset = Object.keys(N).every(k => b.st.lash[k] === N[k]);   // the anime style's spikes gone with the natural one: a style sets every control
      b.st.lash.on = false; b.browLash();
      return { anime, drawn, doll, natural, reset };
    });
    // the gap between clusters against the roots' spacing inside one: about 1 spread evenly, far more as spikes; the clusters' lengths' spread over their mean; the lower lashes' angle down from straight out (degrees)
    for (const [k, x] of [["anime", r.anime], ["drawn", r.drawn], ["anime doll", r.doll]]) if (!(x.spike > 4 && x.drop > 35 && x.rim > 1.2 && x.rim < 3.2 && x.cards > 300)) throw new Error(`${k}: ${JSON.stringify(x)}`);
    if (!(r.anime.vary > 0.12) || !(r.natural.spike < 2 && r.natural.vary < 0.1 && r.natural.drop < 45 && r.anime.drop > r.natural.drop + 10) || !r.reset) throw new Error("natural against anime: " + JSON.stringify(r));
    console.log(`       anime: ${r.anime.cards} hairs an eye, the gap between spikes ${r.anime.spike.toFixed(1)}× the roots' spacing inside one (natural ${r.natural.spike.toFixed(1)}×), the clusters' lengths spread ${(r.anime.vary * 100).toFixed(0)}% (natural ${(r.natural.vary * 100).toFixed(0)}%), the lower lashes ${r.anime.drop.toFixed(0)}° down the skin (natural ${r.natural.drop.toFixed(0)}°)`);
    await page.click('#tabs button[data-tab="body"]');
  });
  await step("the three eye shapes the user drew, as lashes and liner: the fox almond's lashes sweep to the outer corner, long there and short at the inner; the half-lidded eye's point down over the eye; the round doll's are short spikes all round; each look sets its style and its liner", async () => {
    await page.click('#tabs button[data-tab="face"]');
    const r = await page.evaluate(async () => {
      const b = window.__body, BL = await import("./browlash.js");
      const at = k => { Object.assign(b.st.lash, BL.styleOf(k), { on: true }); b.browLash(); const c = b.browlash; return { sweep: c.sweep, lift: c.lift, spike: c.spike, drop: c.drop, cards: c.lashes, rim: c.rim }; };
      const natural = at("natural"), fox = at("fox"), half = at("halfLidded"), doll = at("roundDoll");
      const lens = k => { Object.assign(b.st.lash, BL.styleOf(k), { on: true }); b.browLash(); const P = b.BLM.lash.geometry.attributes.position.array; let n = 0; for (let i = 0; i < P.length; i += 3) n++; return n; };
      const looks = {}; for (const [name, style, pre] of [["fox almond", "fox", "fox liner"], ["half-lidded", "halfLidded", "half-lidded liner"], ["round doll", "roundDoll", "doll pink"]]) {
        b.useLook(name); looks[name] = { style: b.st.lash.sweep === BL.styleOf(style).sweep && b.st.lash.lift === BL.styleOf(style).lift && b.st.lash.on, liner: b.st.skin.proc.liner, inner: b.st.skin.proc.linerInner, width: b.st.skin.proc.linerWidth }; }
      b.useLook("MHR plain"); b.st.lash.on = false; b.browLash();
      return { natural, fox, half, doll, looks };
    });
    // sweep: how much the upper lashes' tips lean toward the outer corner (1 along the lid); lift: their mean elevation (degrees up from straight out)
    if (!(r.fox.sweep > r.natural.sweep + 0.25 && r.fox.rim > 1.2 && r.fox.cards > 300)) throw new Error("fox: " + JSON.stringify({ fox: r.fox, natural: r.natural }));
    if (!(r.half.lift < 15 && r.half.lift < r.natural.lift - 30 && r.half.cards > 300)) throw new Error("half-lidded: " + JSON.stringify({ half: r.half, natural: r.natural }));
    if (!(r.doll.spike > 4 && r.doll.drop > 35 && r.doll.cards > 200)) throw new Error("round doll: " + JSON.stringify(r.doll));
    for (const [k, v] of Object.entries(r.looks)) if (!(v.style && v.liner > 0.5 && v.inner > 0.4)) throw new Error(`the look ${k}: ${JSON.stringify(v)}`);
    await page.click('#tabs button[data-tab="body"]');
    console.log(`       fox: the lashes lean ${r.fox.sweep.toFixed(2)} toward the outer corner (natural ${r.natural.sweep.toFixed(2)}); half-lidded: ${r.half.lift.toFixed(0)}° from straight out (natural ${r.natural.lift.toFixed(0)}° up); round doll: spikes ${r.doll.spike.toFixed(1)}× the roots' spacing, the lower ones ${r.doll.drop.toFixed(0)}° down`);
  });
  await step("the anime pink makeup after the user's references: the preset paints the liner between the lashes' roots and a line a liner's width up the lid (both found on the skin), a wash under the eye, the inner corner and the waterline pink; under the eye the picture goes pinker; the anime pink look turns the anime lashes on with it", async () => {
    await page.click('#tabs button[data-tab="skin"]');
    const eyeShot = async () => {                                         // the head view zoomed onto the left eye: the canvas's picture
      await page.evaluate(() => { const b = window.__body; document.querySelector('#views button[data-v="head"]').click(); const O = b.orbit; O.yaw = 0; O.pitch = 0.02;
        const e = b.EYES.L.position, ty = b.st.height - 0.12 * b.st.height / 1.7; O.pan.set(e.x, e.y - ty, e.z); O.zoom = 0.14; });
      await page.waitForTimeout(700);
      const clip = await page.evaluate(() => { const r = document.querySelector("#view canvas").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
      return page.screenshot({ clip, timeout: 120000 });
    };
    const pinkUnder = png => page.evaluate(async ([b64]) => {              // red over green in a patch under the left eye's lower lid
      const b = window.__body, img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
      const r = document.querySelector("#view canvas").getBoundingClientRect(), p = b.onScreen(374), c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const g = c.getContext("2d"); g.drawImage(img, 0, 0); const d = g.getImageData(Math.round(p[0] - r.left) - 30, Math.round(p[1] - r.top) + 6, 60, 22).data; let s = 0;
      for (let i = 0; i < d.length; i += 4) s += d[i] - d[i + 1];
      return s / (d.length / 4);
    }, [png.toString("base64")]);
    const pick = async name => { await page.selectOption("#procRows select >> nth=1", name); await page.waitForTimeout(300); };   // the makeup presets' menu (skin, then makeup)
    await pick("none"); const plain = await pinkUnder(await eyeShot());
    await pick("anime pink"); const pink = await pinkUnder(await eyeShot());
    const u = await page.evaluate(() => { const b = window.__body, U = b.SKU, lid = U.uLidUL.value[4], front = U.uLidFL.value[4], top = U.uLidTL.value[4];
      return { under: U.uf_under.value, water: U.uf_waterline.value, corner: U.uf_corner.value, liner: U.uf_liner.value, width: U.uf_linerWidth.value, inner: U.uf_linerInner.value,
               ahead: (front.z - lid.z) * 1000, band: top.w * 1000, up: (top.y - front.y) * 1000, on: b.st.skin.proc.on }; });
    if (!(u.on && u.under > 0.5 && u.water > 0.5 && u.corner > 0.5 && u.liner > 0.5 && u.width > 1 && u.inner > 0)) throw new Error("the preset: " + JSON.stringify(u));
    // the liner's band in the lid's middle: from the lashes' roots (the lid's front edge, ahead of its line) a liner's width up the skin
    if (!(u.ahead > 1 && u.ahead < 3.5) || !(u.band > 0.9 && u.band < 3) || !(u.up > 0.3)) throw new Error("the liner's band: " + JSON.stringify(u));
    if (!(pink > plain + 4)) throw new Error(`under the eye: red over green ${plain.toFixed(1)} plain, ${pink.toFixed(1)} with the preset`);
    const look = await page.evaluate(() => { const b = window.__body; b.useLook("anime pink"); return { on: b.st.lash.on, spikes: b.st.lash.spikes, under: b.st.skin.proc.under, cards: b.browlash && b.browlash.lashes }; });
    if (!(look.on && look.spikes > 0.5 && look.under > 0.5 && look.cards > 300)) throw new Error("the anime pink look: " + JSON.stringify(look));
    await page.evaluate(() => { const b = window.__body; b.useLook("MHR plain"); b.st.lash.on = false; b.browLash(); });   // back to the plain look the steps below were written for
    await page.click('#views button[data-v="head"]'); await page.click('#views button[data-yaw="0"]');
    await page.click('#tabs button[data-tab="body"]');
    console.log(`       under the eye, red over green ${plain.toFixed(1)} plain and ${pink.toFixed(1)} with the preset; the liner's band ${u.band.toFixed(2)} mm wide in the lid's middle, from the lashes' roots ${u.ahead.toFixed(1)} mm ahead of the lid line`);
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
  await step("the eyes softened: the iris melts into the white (Iris edge softness), the eye occlusion shades the white at the lids and corners, a tear line along each lower lid (only when set)", async () => {
    const r = await page.evaluate(() => {
      const b = window.__body, column = () => {                     // the eye's paint (baked flat, the shader's own) along a few radii from the middle: brightness per step
        const S = 512, cv = b.EYEPAINT.bakeEye(b.renderer, b.st.eyes, b.eyeShapeOf("L"), "L", S), d = cv.getContext("2d").getImageData(0, 0, S, S).data;
        return [0, 1, 2].map(k => { const a = k * Math.PI / 3; return Array.from({ length: S / 2 }, (_, r) => { const x = Math.round(S / 2 + Math.cos(a) * r), y = Math.round(S / 2 - Math.sin(a) * r), i = (Math.min(S - 1, y) * S + Math.min(S - 1, x)) * 4; return (d[i] + d[i + 1] + d[i + 2]) / 3; }); });
      };
      const was = { ...b.st.eyes }; b.st.expr.fill(0);
      b.st.eyes.limbalSoft = 0; b.paintEyes(); const H0 = column();
      b.st.eyes.limbalSoft = 0.8; b.paintEyes(); const S0 = column();
      let hard = 0, soft = 0;                                      // where the two differ is the iris's edge (the painted iris shrinks on a grown eyeball): the steepest step there
      H0.forEach((h, c) => { const s = S0[c], rows = h.map((v, y) => Math.abs(v - s[y]) > 6 ? y : -1).filter(y => y >= 0); if (!rows.length) return;
        for (let y = Math.max(0, rows[0] - 3); y < Math.min(h.length - 1, rows[rows.length - 1] + 3); y++) { hard = Math.max(hard, Math.abs(h[y + 1] - h[y])); soft = Math.max(soft, Math.abs(s[y + 1] - s[y])); } });
      b.st.eyes.occlusion = 0.7; b.st.eyes.tearline = 0.5; b.compose();
      const occ = b.EYESH.L.uOcc.value, tear = b.TEAR.L.visible && b.TEAR.R.visible, lo = b.outline("L").pts.slice(0, 17), P = b.TEAR.L.geometry.attributes.position.array;
      let far = 0; for (let i = 0; i < P.length; i += 3) far = Math.max(far, Math.min(...lo.map(q => Math.hypot(P[i] - q[0], P[i + 1] - q[1], P[i + 2] - q[2]))));
      b.st.eyes.tearline = 0; b.compose(); const tearOff = b.TEAR.L.visible || b.TEAR.R.visible;
      Object.assign(b.st.eyes, was); b.paintEyes(); b.compose();
      return { hard, soft, occ, tear, far: far / b.scale * 1000, tearOff };
    });
    if (!(r.soft < 0.5 * r.hard)) throw new Error(`the iris's edge isn't softer: the steepest step ${r.hard.toFixed(0)} -> ${r.soft.toFixed(0)}`);
    if (Math.abs(r.occ - 0.7) > 1e-6) throw new Error(`the eye occlusion isn't set: ${r.occ}`);
    if (!r.tear || r.tearOff || !(r.far < 1.2)) throw new Error(`the tear line: on ${r.tear}, off at 0 ${!r.tearOff}, ${r.far.toFixed(2)} mm from the lower lid`);
    console.log(`       the iris's edge: its steepest step ${r.hard.toFixed(0)} -> ${r.soft.toFixed(0)} (softness 0 -> 0.8); the tear line within ${r.far.toFixed(2)} mm of the lower lid`);
    // the tear line seen close from the front: a soft glint, never a hard white line (the user's screenshot, 2026-10-24:
    // it added up to 228 of 255 in a band with hard edges); the openings' edges faded over a pixel (alpha to coverage)
    await page.click('#views button[data-v="head"]');
    const eye = async k => {
      await page.evaluate(k => { const b = window.__body, o = b.orbit, h = b.st.height, e = b.EYES.R.position; b.st.expr.fill(0); b.st.eyes.tearline = k; b.compose();
        o.yaw = 0.05; o.pitch = 0.05; o.zoom = 0.09; o.pan.set(e.x, e.y - 0.004 * b.scale - (h - 0.12 * h / 1.7), e.z); }, k);
      await page.waitForTimeout(500);
      const clip = await page.evaluate(() => { const r = document.querySelector("#view canvas").getBoundingClientRect(); return { x: r.x + r.width * 0.3, y: r.y + r.height * 0.3, width: r.width * 0.4, height: r.height * 0.4 }; });
      return (await page.screenshot({ clip, timeout: 120000 })).toString("base64");
    };
    const was = await page.evaluate(() => window.__body.st.eyes.tearline);
    const off = await eye(0), on = await eye(0.5);
    const t = await page.evaluate(async ([off, on, was]) => {
      const px = async b64 => { const i = new Image(); i.src = "data:image/png;base64," + b64; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height;
        const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
      const a = await px(off), b = await px(on); let peak = 0;
      for (let k = 0; k < a.length; k += 4) peak = Math.max(peak, (b[k] + b[k + 1] + b[k + 2] - a[k] - a[k + 1] - a[k + 2]) / 3);
      const B = window.__body; B.st.eyes.tearline = was; B.compose();
      return { peak, a2c: B.material.alphaToCoverage };
    }, [off, on, was]);
    if (!(t.peak > 10 && t.peak < 115)) throw new Error(`the tear line adds up to ${t.peak.toFixed(0)} of 255 (a glint is 10 to 115)`);
    if (!t.a2c) throw new Error("the skin's openings are cut with a hard edge (no alpha to coverage)");
    console.log(`       the tear line close up: at most ${t.peak.toFixed(0)} of 255 added, faded at its edges`);
  });
  await step("the eye refracts (tools/shared/eye.js, MetaHuman's way): seen from the side the pupil sits behind the cornea where a ray traced through the dome by Snell's law puts it, not painted on its front; the cornea reflects the lights inside the iris; off, the iris is painted on the eyeball as before", async () => {
    await page.click('#views button[data-v="head"]');
    const was = await page.evaluate(() => JSON.stringify(window.__body.st.eyes));
    const shot = async (yaw, eyes, plain, alone) => {                // alone: only the eyeballs (the reflections are theirs; skin, clothes or hair can't count)
      await page.evaluate(([yaw, eyes, plain, alone]) => {
        const b = window.__body, o = b.orbit, h = b.st.height, e = b.EYES.L.position;
        b.st.expr.fill(0); Object.assign(b.st.eyes, eyes); b.paintEyes();
        o.yaw = yaw; o.pitch = 0.02; o.zoom = 0.12; o.pan.set(e.x, e.y - (h - 0.12 * h / 1.7), e.z); b.compose();
        if (plain) for (const m of Object.values(b.eyeMats)) { m.clearcoat = 0; m.roughness = 1; m.envMapIntensity = 0; }   // no reflections: the pupil a clean dark blob
        if (alone) for (const k of b.rig.children) if (k !== b.EYES.L && k !== b.EYES.R && k !== b.HOLES) { k.userData.shotHid = k.visible; k.visible = false; }
      }, [yaw, eyes, plain, alone]);
      // wait for frames drawn as set, not for the clock: a material that loses its coat recompiles, which with a full
      // scene (clothes, hair) on the software GPU outlasts a fixed wait (LESSONS: the game's clock, not the wall's)
      await page.evaluate(() => new Promise(r => { let n = 0; const f = () => (++n >= 4 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
      await page.waitForTimeout(600);
      const clip = await page.evaluate(() => { const r = document.querySelector("#view canvas").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
      const img = (await page.screenshot({ clip, timeout: 120000 })).toString("base64");
      if (alone) await page.evaluate(() => { for (const k of window.__body.rig.children) if (k.userData.shotHid !== undefined) { k.visible = k.userData.shotHid; delete k.userData.shotHid; } });
      return img;
    };
    const flat = { pupil: 0.45, limbal: 0, limbalSoft: 0, fibres: 0, veins: 0, iris: "#8a6a4a", iris2: "#8a6a4a", sclera: "#f0f0f0", corner: "#f0f0f0", cornerPink: 0, scleraShade: 0,
                   catch1: 0, catch2: 0, occlusion: 0, lidShade: 0, tearline: 0, irisDepth: 0.2, bulge: 1, ior: 1.336, irisBright: 1 };
    const on = await shot(0.6, { ...flat, real: true }, true), off = await shot(0.6, { ...flat, real: false }, true);
    const r = await page.evaluate(async ([on, off, pupil]) => {
      const b = window.__body, THREE = b.THREE, cam = b.camera, L = b.EYES.L, s = b.eyeShapeOf("L");
      const px = async b64 => { const i = new Image(); i.src = "data:image/png;base64," + b64; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height;
        const g = c.getContext("2d"); g.drawImage(i, 0, 0); return { d: g.getImageData(0, 0, i.width, i.height).data, w: i.width, h: i.height }; };
      const A = await px(on), B = await px(off), at = p => { const v = L.localToWorld(p.clone()).project(cam); return [(v.x + 1) / 2 * A.w, (1 - v.y) / 2 * A.h]; };
      // the pupil as a ray traced through each pixel sees it, apart from the shader: the eyeball (the white's sphere, the
      // cornea's dome over the limbus) hit first; then the paint read where it lies (off), or where the ray, bent at the dome
      // by Snell's law, lands on the iris's plane (on); the pupil is where that reading falls within its radius
      const C = L.worldToLocal(cam.getWorldPosition(new THREE.Vector3())), apex = at(new THREE.Vector3(0, 0, s.zc + s.rc));
      const reach = Math.hypot(...[0, 1].map(k => at(new THREE.Vector3(s.rho, 0, s.zl))[k] - at(new THREE.Vector3(0, 0, s.zl))[k]));   // the iris's radius on screen
      const read = (i, j, ior) => {
        const D = L.worldToLocal(new THREE.Vector3((i + 0.5) / A.w * 2 - 1, 1 - (j + 0.5) / A.h * 2, 0.5).unproject(cam)).sub(C).normalize();
        const oc = new THREE.Vector3(C.x, C.y, C.z - s.zc), bq = oc.dot(D), dq = bq * bq - oc.lengthSq() + s.rc * s.rc;
        let P = dq >= 0 ? C.clone().addScaledVector(D, -bq - Math.sqrt(dq)) : null;
        if (!P || P.z < s.zl) { const b2 = C.dot(D), d2 = b2 * b2 - C.lengthSq() + 1; if (d2 < 0) return null; P = C.clone().addScaledVector(D, -b2 - Math.sqrt(d2)); return [P.x, P.y]; }
        if (!ior) return [P.x, P.y];
        const n = new THREE.Vector3(P.x, P.y, P.z - s.zc).normalize(), eta = 1 / ior, nd = n.dot(D), k = 1 - eta * eta * (1 - nd * nd);
        const t = D.clone().multiplyScalar(eta).sub(n.multiplyScalar(eta * nd + Math.sqrt(k))), h = Math.max(P.z - s.zi, 0) / Math.max(-t.z, 0.08);
        return [P.x + t.x * h, P.y + t.y * h];
      };
      const box = f => { let n = 0, x = 0, y = 0;                   // the centroid of what f says is pupil, round the eye's axis
        for (let j = Math.floor(apex[1] - 1.4 * reach); j < apex[1] + 1.4 * reach; j++) for (let i = Math.floor(apex[0] - 1.4 * reach); i < apex[0] + 1.4 * reach; i++)
          if (i >= 0 && j >= 0 && i < A.w && j < A.h && Math.hypot(i - apex[0], j - apex[1]) <= 1.4 * reach && f(i, j)) { n++; x += i; y += j; }
        return n ? [x / n, y / n, n] : null; };
      const dark = I => (i, j) => { const o = (j * I.w + i) * 4; return I.d[o] + I.d[o + 1] + I.d[o + 2] < 3 * 14; };   // the pupil only (the iris's far side, lit as a bowl, goes dark too)
      const traced = ior => (i, j) => { const q = read(i, j, ior); return !!q && Math.hypot(q[0], q[1]) < pupil * s.rho; };
      return { cOn: box(dark(A)), cOff: box(dark(B)), tOn: box(traced(1.336)), tOff: box(traced(0)), tUnbent: box(traced(1)), reach };
    }, [on, off, flat.pupil]);
    if (!r.cOn || !r.cOff || !r.tOn || !r.tOff) throw new Error(`no pupil found: ${JSON.stringify(r)}`);
    const len = v => Math.hypot(v[0], v[1]), d = (a, b) => [a[0] - b[0], a[1] - b[1]];
    const missOn = len(d(r.cOn, r.tOn)), missOff = len(d(r.cOff, r.tOff)), got = d(r.cOn, r.cOff), want = d(r.tOn, r.tOff), unbent = d(r.tUnbent, r.tOff);
    if (!(len(want) > 5) || !(missOn < 4) || !(missOff < 4))
      throw new Error(`the pupil drawn at ${r.cOn.slice(0, 2).map(v => v.toFixed(1))} (traced ${r.tOn.slice(0, 2).map(v => v.toFixed(1))}), painted at ${r.cOff.slice(0, 2).map(v => v.toFixed(1))} (traced ${r.tOff.slice(0, 2).map(v => v.toFixed(1))})`);
    // the cornea reflects the lights (whatever lights the view has): a highlight inside the dark iris that goes when its clear
    // coat goes; and off, the painted catchlights are back
    const inside = async (real, plain) => {
      const img = await shot(0.15, { ...JSON.parse(was), real }, plain, true);
      return page.evaluate(async b64 => {
        const b = window.__body, THREE = b.THREE, L = b.EYES.L, s = b.eyeShapeOf("L"), i = new Image(); i.src = "data:image/png;base64," + b64; await i.decode();
        const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); const d = g.getImageData(0, 0, i.width, i.height).data;
        const at = p => { const v = L.localToWorld(p.clone()).project(b.camera); return [(v.x + 1) / 2 * i.width, (1 - v.y) / 2 * i.height]; };
        const m = at(new THREE.Vector3(0, 0, s.zl)), e = at(new THREE.Vector3(s.rho, 0, s.zl)), R = 0.8 * Math.hypot(e[0] - m[0], e[1] - m[1]);
        let n = 0, peak = 0;
        for (let y = Math.max(0, Math.floor(m[1] - R)); y < Math.min(i.height, m[1] + R); y++) for (let x = Math.max(0, Math.floor(m[0] - R)); x < Math.min(i.width, m[0] + R); x++)
          if (Math.hypot(x - m[0], y - m[1]) < R) { const o = (y * i.width + x) * 4, l = (d[o] + d[o + 1] + d[o + 2]) / 3; peak = Math.max(peak, l); if (l > 165) n++; }
        return { n, peak };
      }, img);
    };
    const coat = await inside(true, false), bare = await inside(true, true), painted = await inside(false, false);
    await page.evaluate(was => { const b = window.__body; Object.assign(b.st.eyes, JSON.parse(was)); b.paintEyes(); b.compose(); }, was);
    if (!(coat.peak > 180 && bare.peak < 140 && coat.n > bare.n)) throw new Error(`the cornea doesn't reflect the lights inside the iris: its brightest ${coat.peak.toFixed(0)} with the coat, ${bare.peak.toFixed(0)} without`);
    if (!(painted.n > 20)) throw new Error(`the painted eye lost its catchlights (${painted.n} bright pixels)`);
    console.log(`       34° off the eye's axis the pupil sits ${len(got).toFixed(1)} px from where it's painted on the cornea's front; traced through the dome by Snell's law, ${len(want).toFixed(1)} (unbent ${len(unbent).toFixed(1)}): drawn within ${missOn.toFixed(1)} px of the trace, painted within ${missOff.toFixed(1)}`);
    console.log(`       the cornea reflects the lights inside the iris (its brightest ${coat.peak.toFixed(0)} of 255, ${coat.n} bright pixels; ${bare.peak.toFixed(0)} without its coat); painted on the eyeball instead, its catchlights (${painted.n})`);
  });
  await step("iris patterns and pupil shapes (tools/shared/eye.js): a heart for a pupil (two lobes up, a dip between them, a tip down), a slit, a goat's bar, a star and a flower of five, a diamond, a cross, a crescent, a ring, two pupils apart, none; each pattern lays its accent over the iris and keeps the pupil dark; a style from the panel sets colours, pattern and pupil, and what an export carries keeps them", async () => {
    const r = await page.evaluate(() => {
      const B = window.__body, E = B.EYEPAINT, s = E.eyeShape(E.EYE_DEFAULTS), W = 512, R = s.rho * W / 2, P = 0.36;
      const bake = p => E.bakeEye(B.renderer, { ...E.EYE_DEFAULTS, iris: "#7a8fb0", iris2: "#c8d4e6", pupil: P, ...p }, s, "L", W).getContext("2d").getImageData(0, 0, W, W).data;
      const each = (d, f) => { for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) f((x + 0.5 - W / 2) / R, (W / 2 - y - 0.5) / R, (y * W + x) * 4); };   // the iris's plane: the limbus at 1, up +
      const shapes = {};
      for (const [v] of E.EYE_CHOICES[1][2]) {                         // the pupil's dark pixels, in its own radius
        const d = bake({ pupilShape: v }), m = [];
        each(d, (u, w, i) => { if (u * u + w * w < 0.8 && d[i] + d[i + 1] + d[i + 2] < 90) m.push([u / P, w / P]); });
        const xs = m.map(p => p[0]), ys = m.map(p => p[1]), at = (q, e = 0.06) => m.some(p => Math.abs(p[0] - q[0]) < e && Math.abs(p[1] - q[1]) < e);
        const top = x => Math.max(-9, ...m.filter(p => Math.abs(p[0] - x) < 0.04).map(p => p[1]));
        const width = y => { const row = m.filter(p => Math.abs(p[1] - y) < 0.04).map(p => p[0]); return row.length ? Math.max(...row) - Math.min(...row) : 0; };
        const bins = Array(72).fill(0); for (const [x, y] of m) { const k = Math.floor((Math.atan2(y, x) + Math.PI) / (2 * Math.PI) * 72) % 72; bins[k] = Math.max(bins[k], Math.hypot(x, y)); }
        const mean = bins.reduce((a, b) => a + b, 0) / 72; let peaks = 0;
        for (let k = 0; k < 72; k++) { const a = bins[(k + 71) % 72], b = bins[k], c = bins[(k + 1) % 72]; if (b > a && b >= c && b > mean * 1.08) peaks++; }
        const span = a => a.length ? Math.max(...a) - Math.min(...a) : 0;
        shapes[v] = { area: m.length / (R * R * P * P), w: span(xs), h: span(ys), top: m.length ? Math.max(...ys) : 0, bottom: m.length ? Math.min(...ys) : 0,
                      dip: top(0.23) - top(0), upper: width(0.45), lower: width(-0.45), peaks, centre: at([0, 0], 0.08), cx: m.length ? xs.reduce((a, b) => a + b, 0) / m.length : 0,
                      arms: [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]].every(q => at(q)), diag: at([0.62, 0.62], 0.05), ring: [[0.8, 0], [-0.8, 0], [0, 0.8]].every(q => at(q)),
                      gap: m.filter(p => Math.abs(p[0]) < 0.06).length, n: m.length };
      }
      const base = { iris: "#4a1694", iris2: "#7b3fd0", accent: "#ffa21f" }, ref = bake({ ...base }), pats = {};
      for (const [v] of E.EYE_CHOICES[0][2]) {                         // each pattern on violet with an orange accent, against the natural one
        const d = bake({ ...base, pattern: v }); let diff = 0, acc = 0, n = 0, pupil = 0;
        each(d, (u, w, i) => { const rr = Math.hypot(u, w);
          if (rr < P * 0.8) { pupil = Math.max(pupil, d[i] + d[i + 1] + d[i + 2]); return; }
          if (rr < P + 0.05 || rr > 0.9) return;
          n++; diff += (Math.abs(d[i] - ref[i]) + Math.abs(d[i + 1] - ref[i + 1]) + Math.abs(d[i + 2] - ref[i + 2])) / 3;
          if (d[i] > 150 && d[i] > d[i + 2] + 60 && d[i + 1] > d[i + 2]) acc++; });
        pats[v] = { diff: diff / n, accent: acc / n, pupil };
      }
      const kept = E.EYE_STYLES.filter(([, , , st]) => { const p = E.eyeRecord({ ...E.EYE_DEFAULTS, ...st }, s, "L").paint; return p.pattern === st.pattern && p.pupilShape === st.pupilShape && p.accent === st.accent; }).length;
      return { shapes, pats, styles: E.EYE_STYLES.length, kept };
    });
    const S = r.shapes, bad = [];
    const want = (ok, what) => { if (!ok) bad.push(what); };
    want(Math.abs(S.round.area - Math.PI) < 0.15 * Math.PI && !S.round.peaks, `round: area ${S.round.area.toFixed(2)} (π), ${S.round.peaks} points`);
    want(S.heart.dip > 0.08 && S.heart.upper > 1.6 * S.heart.lower && S.heart.top > 0.7 && S.heart.bottom < -0.6, `heart: dip ${S.heart.dip.toFixed(2)}, widths ${S.heart.upper.toFixed(2)} up / ${S.heart.lower.toFixed(2)} down, ${S.heart.top.toFixed(2)} to ${S.heart.bottom.toFixed(2)}`);
    want(S.slit.h > 3 * S.slit.w, `slit: ${S.slit.w.toFixed(2)} by ${S.slit.h.toFixed(2)}`);
    want(S.goat.w > 2.2 * S.goat.h, `goat: ${S.goat.w.toFixed(2)} by ${S.goat.h.toFixed(2)}`);
    want(S.star.peaks === 5 && S.flower.peaks === 5, `points: the star ${S.star.peaks}, the flower ${S.flower.peaks}`);
    want(S.diamond.h > 1.3 * S.diamond.w && S.diamond.h < 2 * S.diamond.w, `diamond: ${S.diamond.w.toFixed(2)} by ${S.diamond.h.toFixed(2)}`);
    want(S.cross.arms && !S.cross.diag, `cross: arms ${S.cross.arms}, a diagonal ${S.cross.diag}`);
    want(!S.crescent.centre && S.crescent.cx > 0.15, `crescent: its middle ${S.crescent.centre ? "dark" : "clear"}, its weight at ${S.crescent.cx.toFixed(2)}`);
    want(!S.ring.centre && S.ring.ring, `ring: its middle ${S.ring.centre ? "dark" : "clear"}, the ring ${S.ring.ring}`);
    want(S.two.gap === 0 && S.two.w > 1.6, `two: ${S.two.gap} dark pixels between them, ${S.two.w.toFixed(2)} across`);
    want(S.none.n === 0, `none: ${S.none.n} dark pixels`);
    for (const [v, p] of Object.entries(r.pats)) {
      if (p.pupil > 120) bad.push(`${v}: the pupil not dark (${p.pupil})`);
      if (v === "natural") continue;
      if (!(p.diff > ({ crypts: 3, halo: 4 }[v] ?? 8))) bad.push(`${v}: hardly differs from the natural iris (${p.diff.toFixed(1)}, over the whole iris: the halo is a narrow band)`);
      if (v !== "crypts" && !(p.accent > 0.02)) bad.push(`${v}: its accent barely shows (${(p.accent * 100).toFixed(1)}%)`);
    }
    if (r.kept !== r.styles) bad.push(`an export keeps the pattern and pupil of ${r.kept} of ${r.styles} styles`);
    // a style from the panel: the heart
    const was = await page.evaluate(() => JSON.stringify(window.__body.st.eyes));
    const ui = await page.evaluate(() => {
      const b = window.__body, sel = document.querySelector("#eyeStyle"); sel.value = "heart"; sel.dispatchEvent(new Event("change"));
      return { shape: b.st.eyes.pupilShape, pattern: b.st.eyes.pattern, iris: b.st.eyes.iris, picker: document.querySelector("#eye_pupilShape").value, options: sel.options.length - 1 };
    });
    await page.evaluate(was => { const b = window.__body; Object.assign(b.st.eyes, JSON.parse(was)); b.paintEyes(); b.compose(); }, was);
    if (ui.shape !== "heart" || ui.picker !== "heart" || ui.options !== r.styles) bad.push(`the panel's style: ${JSON.stringify(ui)}`);
    if (bad.length) throw new Error(bad.join("; "));
    console.log(`       the heart: two lobes ${S.heart.upper.toFixed(2)} wide over a tip ${S.heart.lower.toFixed(2)} wide, a dip of ${S.heart.dip.toFixed(2)} between the lobes (the pupil's radius 1); the slit ${(S.slit.h / S.slit.w).toFixed(1)} times as tall as wide, the bar ${(S.goat.w / S.goat.h).toFixed(1)} times as wide; five points on the star and the flower; two pupils apart; the ring hollow; none none`);
    console.log(`       patterns over a violet iris: ${Object.entries(r.pats).filter(([v]) => v !== "natural").map(([v, p]) => `${v} ${p.diff.toFixed(0)} off natural (${(p.accent * 100).toFixed(0)}% accent)`).join(", ")}; ${r.styles} styles, each kept in an export`);
  });
  await step("accessories: glasses round the eyes, a sticker and a piercing held to the skin (a smile carries the sticker), a choker round the neck, one put where you click; saved with the character and back on reopening", async () => {
    await page.click('#tabs button[data-tab="acc"]');
    for (const v of ["glasses:round", "sticker:heart", "piercing:ring", "neck:choker"]) { await page.selectOption("#accAdd select", v); await page.click("#accAdd button"); }
    const r = await page.evaluate(() => {
      const b = window.__body, W = b.WEAR, A = b.st.accessories, mm = 0.001 * b.scale, made = A.map(a => W.made.get(a.id).obj.children.length);
      const lensAt = side => { const g = W.made.get(A[0].id).obj.children.filter(o => o.renderOrder === 6)[side === "L" ? 0 : 1].geometry.attributes.position; return new b.THREE.Vector3(g.getX(0), g.getY(0), g.getZ(0)); };
      const eye = s => b.EYES[s].position.clone().add(new b.THREE.Vector3(0, 0, b.EYES[s].scale.x));
      const lens = ["L", "R"].map(s => { const l = lensAt(s), e = eye(s); return { side: Math.hypot(l.x - e.x, l.y - e.y) / mm, ahead: (l.z - e.z) / mm }; });
      const sheet = () => { const o = W.made.get(A[1].id).obj.children.find(x => x.renderOrder === 5), g = o.geometry.attributes.position, c = new b.THREE.Vector3(); for (let i = 0; i < g.count; i++) c.add(new b.THREE.Vector3(g.getX(i), g.getY(i), g.getZ(i))); return c.multiplyScalar(1 / g.count); };
      const s0 = sheet(); b.st.expr.set(b.fromArkit({ mouthSmileLeft: 0.9, mouthSmileRight: 0.9, cheekSquintLeft: 0.7, cheekSquintRight: 0.7 })); b.compose();
      const s1 = sheet(), onSkin = W.point(W.anchorOf(A[1])).distanceTo(s1) / mm; b.st.expr.fill(0); b.compose();
      return { made, lens, moved: s0.distanceTo(s1) / mm, onSkin };
    });
    if (r.made.some(n => !n)) throw new Error(`nothing drawn for some: ${JSON.stringify(r.made)}`);
    if (r.lens.some(l => l.side > 3 || l.ahead < 5 || l.ahead > 25)) throw new Error(`the lenses aren't in front of the eyes: ${JSON.stringify(r.lens)}`);
    if (!(r.moved > 0.5) || !(r.onSkin < 3)) throw new Error(`the sticker under the eye: moved ${r.moved.toFixed(2)} mm with a smile, ${r.onSkin.toFixed(2)} mm off its place`);
    // put the piercing on the nose's tip by clicking there
    await page.evaluate(() => { const b = window.__body; b.orbit.yaw = 0; b.orbit.pitch = 0; b.orbit.zoom = 0.5; });
    await page.waitForTimeout(500);
    await page.click("#accList .layrow:nth-child(3) .lname");
    await page.click('#accEdit button:has-text("Place by clicking")');
    const at = await page.evaluate(() => window.__body.onScreen(1));
    await page.mouse.click(at[0], at[1]); await page.waitForTimeout(300);
    const c = await page.evaluate(() => { const b = window.__body, W = b.WEAR, a = b.st.accessories[2], p = W.point(W.anchorOf(a)), n = b.lmk(1); return { at: !!a.at, spot: a.spot, off: Math.hypot(p.x - n[0], p.y - n[1], p.z - n[2]) / (0.001 * b.scale) }; });
    if (!c.at || c.off > 4) throw new Error(`Place by clicking: ${JSON.stringify(c)}`);
    await saveNow();
    const saved = await page.evaluate(async n => (await (await fetch(`api/people/${n}`)).json()).accessories, NAME);
    await page.evaluate(n => { window.__body.WEAR.set([]); const s = document.querySelector("#who"); s.value = n; s.dispatchEvent(new Event("change")); }, NAME);   // none drawn until it's open again
    await page.waitForFunction(() => window.__body.WEAR.made.size === 4, null, { timeout: 60000 });
    if ((saved || []).length !== 4 || !saved[2].at) throw new Error(`saved: ${JSON.stringify(saved)}`);
    await page.evaluate(() => { const b = window.__body; b.st.accessories = []; b.WEAR.set([]); b.drawAcc(); });
    await saveNow();
    const left = await page.evaluate(async n => (await (await fetch(`api/people/${n}`)).json()).accessories, NAME);
    if ((left || []).length) throw new Error(`taken off, but ${left.length} saved`);
    console.log(`       the lenses ${r.lens.map(l => l.ahead.toFixed(1)).join(" and ")} mm in front of the eyes; the sticker moved ${r.moved.toFixed(1)} mm with a smile and stayed on the skin; clicked onto the nose ${c.off.toFixed(1)} mm from its tip`);
  });
  await step("jewellery: heart lenses; hoops in both ears swung clear of the jaw, a nose hoop through the nostril; a necklace dropped by gravity keeps its length and lies on the body (its front lower than its back, the pendant on the chest), a longer one hangs lower, a choker snug round the neck; saved and back on reopening", async () => {
    const r = await page.evaluate(() => {
      const b = window.__body, W = b.WEAR, V = b.THREE.Vector3, mm = 0.001 * b.scale, mk = (k, s, o) => Object.assign(b.ACCS.fresh(k, s), o || {});
      const A = [mk("glasses", "heart"), mk("earring", "hoop", { spot: "left earlobe" }), mk("piercing", "nose hoop"), mk("neck", "chain", { length: 45, pendant: "heart" }), mk("neck", "choker")];
      b.st.accessories = A; W.set(A); b.drawAcc();
      const verts = (o, every = 1) => { o.updateMatrixWorld(); const g = o.geometry.attributes.position, out = []; for (let i = 0; i < g.count; i += every) out.push(new V(g.getX(i), g.getY(i), g.getZ(i)).applyMatrix4(o.matrixWorld)); return out; };
      const { right, up } = W.faceFrame(), mid = new V(...b.lmk(168));
      // the heart: its tip under the lens's middle, its top dipping between two lobes
      const L = verts(W.made.get(A[0].id).obj.children.filter(o => o.renderOrder === 6)[0]), c = L[0], xy = L.map(v => [v.clone().sub(c).dot(right), v.clone().sub(c).dot(up)]);
      const w = Math.max(...xy.map(p => p[0])) - Math.min(...xy.map(p => p[0])), h = Math.max(...xy.map(p => p[1])) - Math.min(...xy.map(p => p[1]));
      const tip = xy.reduce((a, p) => p[1] < a[1] ? p : a), top = Math.max(...xy.map(p => p[1])), dip = Math.max(...xy.filter(p => Math.abs(p[0]) < 0.08 * w).map(p => p[1]));
      const heart = { tipOff: Math.abs(tip[0]) / w, dip: (top - dip) / h };
      // the hoops: both ears, mirrored, every part away from the hole outside the skin
      const em = W.made.get(A[1].id), holes = [W.point(W.anchorOf(A[1])), W.point(W.mirrorOf(A[1], em))], hoops = em.obj.children;
      let inHoop = Infinity; hoops.forEach((o, k) => { for (const v of verts(o, 7)) if (v.distanceTo(holes[k]) > 9 * mm) inHoop = Math.min(inHoop, W.skinGap(v)); });   // (through the lobe it's in the skin: that's the hole)
      const at = hoops.map(o => o.position.clone().sub(mid)), sides = at[0].dot(right) * at[1].dot(right) < 0, level = Math.abs(at[0].dot(up) - at[1].dot(up)) / mm;   // a face fitted to pictures isn't a mirror image
      // the nose hoop: through the nostril, most of it outside
      const nv = verts(W.made.get(A[2].id).obj.children[0], 3), nostril = new V(...b.lmk(358));
      const nose = { through: Math.min(...nv.map(v => v.distanceTo(nostril))) / mm, out: nv.filter(v => W.skinGap(v) > 0).length / nv.length };   // (MHR's nostril is shallow: the ring's inner half reads as in the skin)
      // the necklaces
      const neck = a => { const m = W.made.get(a.id), F = W.torsoField(m.neck.body), P = m.neck.points, val = P.map(p => F.sdf.value(p.x, p.y, p.z)).filter(isFinite);
        const pend = m.obj.children.filter(o => o.userData.pendant).flatMap(o => verts(o, 5)).map(v => F.sdf.value(v.x, v.y, v.z)).filter(isFinite);
        return { fell: m.neck.fell, made: m.neck.length, want: a.length / 100, inside: Math.min(...val) / mm, front: P[P.length >> 1].y, back: P[0].y, pendant: pend.length ? Math.min(...pend) / mm : null, chin: b.lmk(152)[1] }; };
      const n45 = neck(A[3]), choker = neck(A[4]);
      A[3].length = 70; W.rebuild(A[3]); W.update(); const n70 = neck(A[3]);
      return { made: A.map(a => W.made.get(a.id).obj.children.length), heart, inHoop: inHoop / mm, sides, level, nose, n45, n70, choker };
    });
    if (r.made.some(n => !n)) throw new Error(`nothing drawn for some: ${JSON.stringify(r.made)}`);
    if (!(r.heart.tipOff < 0.15 && r.heart.dip > 0.08)) throw new Error(`the heart lens isn't a heart: ${JSON.stringify(r.heart)}`);
    if (r.made[1] !== 2 || !(r.inHoop > -0.2) || !r.sides || !(r.level < 10)) throw new Error(`the hoops: ${r.made[1]} drawn, ${(-r.inHoop).toFixed(2)} mm into the skin away from the hole, ${r.sides ? "one each side" : "both one side"}, ${r.level.toFixed(1)} mm apart in height`);
    if (!(r.nose.through < 3 && r.nose.out > 0.2)) throw new Error(`the nose hoop: ${r.nose.through.toFixed(1)} mm from the nostril, ${(100 * r.nose.out).toFixed(0)}% of it outside the skin (the rest through the nostril's rim)`);
    for (const [name, n] of [["45 cm", r.n45], ["70 cm", r.n70], ["choker", r.choker]]) {
      if (n.fell || !(n.inside > 0)) throw new Error(`the ${name} necklace went into the body: ${JSON.stringify(n)}`);
      if (name !== "choker" && Math.abs(n.made - n.want) > 0.02) throw new Error(`the ${name} necklace is ${(n.made * 100).toFixed(1)} cm long`);
    }
    if (!(r.n45.front < r.n45.back - 0.03) || !(r.n45.pendant > -0.3)) throw new Error(`the 45 cm necklace: front ${((r.n45.front - r.n45.back) * 100).toFixed(1)} cm under its back, its pendant ${r.n45.pendant} mm into the chest`);
    if (!(r.n70.front < r.n45.front - 0.05)) throw new Error(`70 cm hangs only ${((r.n45.front - r.n70.front) * 100).toFixed(1)} cm lower than 45`);
    if (!(r.choker.made > 0.25 && r.choker.made < r.n45.made && r.choker.front < r.choker.chin - 0.01 && r.choker.front > r.choker.chin - 0.1)) throw new Error(`the choker: ${JSON.stringify(r.choker)}`);
    await saveNow();
    await page.evaluate(n => { window.__body.WEAR.set([]); const s = document.querySelector("#who"); s.value = n; s.dispatchEvent(new Event("change")); }, NAME);
    await page.waitForFunction(() => window.__body.WEAR.made.size === 5, null, { timeout: 60000 });
    const back = await page.evaluate(() => { const b = window.__body, A = b.st.accessories; return { kinds: A.map(a => a.kind + ":" + a.style).join(" "), length: A[3].length, pair: A[1].pair, drawn: A.map(a => b.WEAR.made.get(a.id).obj.children.length) }; });
    if (back.length !== 70 || !back.pair || back.drawn.some(n => !n)) throw new Error(`reopened: ${JSON.stringify(back)}`);
    await page.evaluate(() => { const b = window.__body; b.st.accessories = []; b.WEAR.set([]); b.drawAcc(); });
    await saveNow();
    console.log(`       a heart's tip ${(r.heart.tipOff * 100).toFixed(0)}% off the lens's middle; hoops ${r.inHoop.toFixed(1)} mm clear of the skin, one each side within ${r.level.toFixed(1)} mm in height; the nose hoop ${r.nose.through.toFixed(1)} mm from the nostril`);
    console.log(`       necklaces: 45 cm made ${(r.n45.made * 100).toFixed(1)} (front ${((r.n45.back - r.n45.front) * 100).toFixed(1)} cm under the back), 70 cm ${((r.n45.front - r.n70.front) * 100).toFixed(1)} cm lower, the choker ${(r.choker.made * 100).toFixed(1)} cm`);
  });
  await step("fingernails: found on all ten fingertips and painted there by the skin's shader (the nail over its bed); a polish shows its colour on the nails and only there; saved with the character", async () => {
    await page.click('#tabs button[data-tab="skin"]');
    const found = await page.evaluate(() => (window.__body.nails?.fingers || []).map(f => `${f.hand} ${f.finger} ${(f.length * 1000).toFixed(1)}x${(f.width * 1000).toFixed(1)}`));
    if (found.length !== 10) throw new Error(`${found.length} nails found: ${found.join(", ")}`);
    const bad = found.filter(f => { const [l, w] = f.split(" ").pop().split("x").map(Number); return !(l > 6 && l < 16 && w > 6 && w < 16); });
    if (bad.length) throw new Error(`nails of odd sizes: ${bad.join(", ")}`);
    await page.click('#nailRows button:has-text("Look at the nails")'); await page.waitForTimeout(500);
    const boxes = await page.evaluate(() => {                         // the left middle finger's nail and the skin behind it, on the screen
      const b = window.__body, f = b.nails.fingers.find(x => x.hand === "left" && x.finger === "middle"), V = b.THREE.Vector3, c = b.renderer.domElement.getBoundingClientRect();
      const turn = d => new V(...b.PO.turn(b.RIG, b.POSED, f.vertex, d));   // where the hand is shown (the view's pose)
      const at = k => { const tip = new V(b.SHOW[f.vertex * 3], b.SHOW[f.vertex * 3 + 1], b.SHOW[f.vertex * 3 + 2]), q = tip.addScaledVector(turn(f.axis), -k * f.length).addScaledVector(turn(f.back), 0.004).applyMatrix4(b.rig.matrixWorld).project(b.camera);
        return { x: Math.round((q.x + 1) / 2 * c.width - 4), y: Math.round((1 - q.y) / 2 * c.height - 4), w: 8, h: 8 }; };
      return { nail: at(0.55), skin: at(1.9), canvas: { x: c.x, y: c.y, width: c.width, height: c.height } };
    });
    const colour = async () => {
      await page.waitForTimeout(400);
      const png = (await page.screenshot({ clip: boxes.canvas, timeout: 120000 })).toString("base64");
      return page.evaluate(async ([b64, B]) => { const i = new Image(); i.src = "data:image/png;base64," + b64; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height;
        const g = c.getContext("2d"); g.drawImage(i, 0, 0); const mean = m => { const d = g.getImageData(m.x, m.y, m.w, m.h).data, o = [0, 0, 0]; for (let k = 0; k < d.length; k += 4) for (let j = 0; j < 3; j++) o[j] += d[k + j] / (d.length / 4); return o; };
        return { nail: mean(B.nail), skin: mean(B.skin) }; }, [png, boxes]);
    };
    // as the Nails checkbox does it (skinLook: the skin's coat too; nailLook alone left a coat on the whole skin from before, a highlight the view from above caught)
    const set = o => page.evaluate(o => { const b = window.__body; Object.assign(b.st.nails, o); b.nailSet.all(); b.skinLook(); }, o);
    await set({ on: false }); const off = await colour();
    await set({ on: true, paint: false }); const bare = await colour();
    await page.selectOption("#nailRows select", "classic red"); const red = await colour();
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), rg = c => c[0] - c[1];
    if (!(d(bare.nail, off.nail) > 6)) throw new Error(`the bare nail doesn't show: ${off.nail.map(Math.round)} -> ${bare.nail.map(Math.round)}`);
    if (!(rg(red.nail) > rg(off.nail) + 25)) throw new Error(`the red polish doesn't show on the nail: ${off.nail.map(Math.round)} -> ${red.nail.map(Math.round)}`);
    if (!(d(red.skin, off.skin) < 6)) throw new Error(`the polish isn't only on the nail: the skin behind it ${off.skin.map(Math.round)} -> ${red.skin.map(Math.round)}`);
    await saveNow();
    const saved = await page.evaluate(async n => (await (await fetch(`api/people/${n}`)).json()).nails, NAME);
    if (!saved?.paint || saved.colour !== "#b0122e") throw new Error(`the nails aren't saved with the character: ${JSON.stringify(saved)}`);
    await page.selectOption("#nailRows select", "bare"); await saveNow();
    console.log(`       ten nails (${found.slice(0, 2).join(", ")} mm...); the nail ${off.nail.map(Math.round)} -> bare ${bare.nail.map(Math.round)} -> red ${red.nail.map(Math.round)}; the skin behind it ${off.skin.map(Math.round)} -> ${red.skin.map(Math.round)}`);
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
  await step("the export for the desk and Unreal: one GLB, neutral, in metres, rigged on MHR's skeleton (the eyes on their bones), the eyes' openings cut out of its skin and the lids resting on the eyes (an eyeball shows only through its opening, without the Studio's stencil), carrying what the character is made from; Import brings it back as another character, every file and setting the same", async () => {
    const pics = await page.evaluate(() => window.__body.pics.length);
    await page.evaluate(() => { document.querySelector("#status").textContent = ""; });
    await page.click("#expPack");
    await page.waitForFunction(() => /wrote People\/_studiotest\/export\/_studiotest\.glb/.test(document.querySelector("#status").textContent), null, { timeout: 180000 });
    const r = await page.evaluate(async n => {
      const b = window.__body, buf = await (await fetch(`api/package/${n}/${n}.glb`)).arrayBuffer(), dv = new DataView(buf);
      const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, dv.getUint32(12, true))));
      const node = json.nodes.find(x => x.name === `${n}_skin`), prim = node && json.meshes[node.mesh].primitives[0], acc = prim && json.accessors[prim.attributes.POSITION];
      const eyes = ["L", "R"].map(sd => {                           // each eyeball: its paint baked flat, the eye's shape and paint for a reader that refracts it, its points in eye units
        const en = json.nodes.find(x => x.name === `${n}_eye_${sd}`), ep = en && json.meshes[en.mesh].primitives[0], em = ep && json.materials[ep.material];
        return !!(ep && em && em.pbrMetallicRoughness?.baseColorTexture && em.extras?.studioEye?.side === sd && em.extras.studioEye.shape?.rc > 0 && em.extras.studioEye.paint?.iris
                  && ["_EYELOCAL", "TEXCOORD_0", "TANGENT", "NORMAL"].every(k => k in ep.attributes));
      });
      // the rig: one skeleton, MHR's 127 bones from body_world, every part skinned on it; posed, the head carries the face
      // and the eyes (each on its eye's bone) and leaves the feet
      const skins = json.skins || [], rig = { skins: skins.length, joints: skins[0]?.joints.length, root: skins[0] && json.nodes[skins[0].skeleton]?.name,
                                              all: json.nodes.filter(x => "mesh" in x).every(x => "skin" in x) };
      const { GLTFLoader } = await import("./vendor/GLTFLoader.js"), g = await new GLTFLoader().parseAsync(buf, "");
      const T = b.THREE, by = {}; g.scene.traverse(o => { if (o.isSkinnedMesh) by[o.name] = o; });
      // a file has only depth (the Studio's stencil keeps each eyeball inside its opening): the lids rest on the eyes, so
      // an eyeball shows only through its opening. The skin and the eyes drawn flat from the front, above, below and 20°
      // to either side of each eye; the eyeball's pixels outside both openings' outlines as the skin carries them
      // (its extras), seen from there (behind an opening, the eyeball rightly covers what's inside the head)
      const through = (() => {
        const scene = new T.Scene(), ms = [], skinM = by[`${n}_skin`], E = [by[`${n}_eye_L`], by[`${n}_eye_R`]], O = skinM.userData.openings, out = [];
        if (!O || !O.L || !O.R) return null;
        scene.add(g.scene); g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (o.isMesh) ms.push([o, o.visible, o.material, o.frustumCulled]); });
        const green = new T.MeshBasicMaterial({ color: 0x00ff00 }), red = new T.MeshBasicMaterial({ color: 0xff0000 });
        for (const [o] of ms) { o.visible = o === skinM || E.includes(o); o.frustumCulled = false; o.material = o === skinM ? green : red; }
        const W = 320, H = 240, rt = new T.WebGLRenderTarget(W, H), cam = new T.PerspectiveCamera(10, W / H, 0.01, 10), R0 = b.renderer, cc = R0.getClearColor(new T.Color()), ca = R0.getClearAlpha();
        const inPoly = (P, x, y) => { let c = false, d = Infinity; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j];
          if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
          const vx = xj - xi, vy = yj - yi, t = Math.max(0, Math.min(1, ((x - xi) * vx + (y - yi) * vy) / (vx * vx + vy * vy || 1))); d = Math.min(d, Math.hypot(x - xi - t * vx, y - yi - t * vy)); }
          return c || d < 1.5; };                                   // inside, or within a pixel and a half of its line
        for (const [side, bone] of [["L", "l_eye"], ["R", "r_eye"]]) {
          const c = g.scene.getObjectByName(bone).getWorldPosition(new T.Vector3());
          for (const [yaw, pitch] of [[0, 0], [0, 0.3], [0, -0.3], [0.35, 0], [-0.35, 0]]) {
            cam.position.set(c.x + 0.3 * Math.sin(yaw) * Math.cos(pitch), c.y + 0.3 * Math.sin(pitch), c.z + 0.3 * Math.cos(yaw) * Math.cos(pitch)); cam.lookAt(c); cam.updateMatrixWorld();
            R0.setRenderTarget(rt); R0.setClearColor(0, 1); R0.clear(); R0.render(scene, cam); const A = new Uint8Array(W * H * 4); R0.readRenderTargetPixels(rt, 0, 0, W, H, A);
            const P = ["L", "R"].map(sd => O[sd].map(q => { const v = new T.Vector3(...q).project(cam); return [(v.x + 1) / 2 * W, (v.y + 1) / 2 * H]; }));
            let eye = 0, outside = 0;
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (!(A[i] > 128 && A[i + 1] < 100)) continue; eye++; if (!P.some(Q => inPoly(Q, x + 0.5, y + 0.5))) outside++; }
            out.push({ side, yaw, pitch, px: eye, over: outside / Math.max(1, eye) });
          }
        }
        R0.setRenderTarget(null); R0.setClearColor(cc, ca); rt.dispose(); green.dispose(); red.dispose();
        for (const [o, v, m, f] of ms) { o.visible = v; o.material = m; o.frustumCulled = f; }
        scene.remove(g.scene); return out;
      })();
      const eyeBone = sd => { const m = by[`${n}_eye_${sd}`]; return m ? m.skeleton.bones[m.geometry.attributes.skinIndex.getX(0)].name : null; };
      const head = g.scene.getObjectByName("c_head"), centre = m => { m.geometry.computeBoundingBox(); const v = new T.Vector3(), c = new T.Vector3(); let k = 0; for (let i = 0; i < m.geometry.attributes.position.count; i += 97) { m.getVertexPosition(i, v); c.add(v); k++; } return c.divideScalar(k); };
      const skinM = by[`${n}_skin`], lowest = () => { let y = 1e9; const v = new T.Vector3(); for (let i = 0; i < skinM.geometry.attributes.position.count; i += 13) { skinM.getVertexPosition(i, v); y = Math.min(y, v.y); } return y; };
      g.scene.updateMatrixWorld(true); const e0 = centre(by[`${n}_eye_L`]), f0 = lowest();
      head.rotation.y = 0.6; g.scene.updateMatrixWorld(true); const e1 = centre(by[`${n}_eye_L`]), f1 = lowest(), p = head.getWorldPosition(new T.Vector3());
      const turned = Math.atan2(e1.x - p.x, e1.z - p.z) - Math.atan2(e0.x - p.x, e0.z - p.z);
      Object.assign(rig, { eyes: [eyeBone("L"), eyeBone("R")], turned, feet: Math.abs(f1 - f0) });
      const before = JSON.stringify(b.character()), rec = await b.recipeOf(new File([buf], `${n}.glb`)), made = await (await fetch(`api/package/${n}/export.made.json`)).json();
      const back = await b.importPackage(new File([buf], `${n}.glb`), n + "_back");
      const [s0, s1] = await Promise.all([n, n + "_back"].map(async x => (await (await fetch(`api/recipe/${x}`)).json()).sha1));
      return { meshes: json.meshes.length, skin: acc ? acc.count : 0, corners: b.TRIS.length, h: acc ? acc.max[1] - acc.min[1] : 0, foot: acc ? acc.min[1] : 1, height: b.st.height,
               files: Object.keys(rec.files), receipt: !!(made.sources && made.sources["character.json"]), back, who: b.who, same: JSON.stringify(s0) === JSON.stringify(s1),
               settings: JSON.stringify(b.character()) === before, mb: buf.byteLength / 1048576, eyes, rig, through, lids: { ...b.LIDREST } };
    }, NAME);
    if (r.meshes < 6 || !r.skin) throw new Error(`the GLB has ${r.meshes} meshes, the skin ${r.skin} corners`);
    if (!r.eyes.every(Boolean)) throw new Error(`the eyeballs don't carry the eye (a baked paint, extras.studioEye, _EYELOCAL, uv, tangents): ${JSON.stringify(r.eyes)}`);
    if (!(r.rig.joints === 127 && r.rig.root === "body_world" && r.rig.all && r.rig.eyes[0] === "l_eye" && r.rig.eyes[1] === "r_eye" && Math.abs(r.rig.turned - 0.6) < 0.05 && r.rig.feet < 1e-4))
      throw new Error(`the export's rig: ${JSON.stringify(r.rig)}`);
    if (!(r.skin > 0.97 * r.corners && r.skin < 1.5 * r.corners)) throw new Error(`the skin: ${r.skin} corners against MHR's ${r.corners} (only the eyes' openings come out, cut along their outlines)`);
    if (!(r.lids.L > 0 && r.lids.R > 0 && r.lids.most < 0.005)) throw new Error(`the lids don't rest on the eyes: ${JSON.stringify(r.lids)}`);
    if (!r.through) throw new Error("the skin doesn't carry its openings' outlines (extras.openings)");
    const worst = Math.max(...r.through.map(v => v.over));
    if (r.through.some(v => v.px < 500) || worst > 0.002)
      throw new Error(`an eyeball shows outside its opening in the file (its share of the eyeball's pixels): ${JSON.stringify(r.through.map(v => [v.side, v.yaw, v.pitch, v.px, +v.over.toFixed(4)]))}`);
    if (Math.abs(r.h - r.height) > 0.03 * r.height || Math.abs(r.foot) > 0.005) throw new Error(`not the character's size: ${r.h.toFixed(3)} m tall, feet at ${r.foot.toFixed(3)} (height ${r.height})`);
    if (!["character.json", "layers.json", "body.bin"].every(f => r.files.includes(f)) || (pics && !r.files.some(f => f.startsWith("pictures/"))) || !r.receipt)
      throw new Error(`the recipe carries ${r.files.join(", ")}; the receipt ${r.receipt}`);
    if (r.back !== NAME + "_back" || r.who !== NAME + "_back" || !r.same || !r.settings) throw new Error(`the import: ${JSON.stringify(r)}`);
    await page.evaluate(n => { const s = document.querySelector("#who"); s.value = n; s.dispatchEvent(new Event("change")); }, NAME);   // back to this test's character
    await page.waitForFunction(([n, k]) => window.__body.who === n && window.__body.pics.length === k, [NAME, pics], { timeout: 120000 });
    console.log(`       the GLB ${r.mb.toFixed(1)} MB: ${r.meshes} meshes, the skin ${r.skin} of ${r.corners} corners (the eyes' openings out), ${r.h.toFixed(2)} m tall; its recipe ${r.files.length} files; back as ${r.back}, every file and setting the same`);
    console.log(`       the eyes in a file (depth only): the lids rest on them (${r.lids.L} and ${r.lids.R} of MHR's points forward, at most ${(r.lids.most * 1000).toFixed(1)} mm); from the front, above, below and 20° to either side, at most ${(100 * worst).toFixed(2)}% of an eyeball outside its opening`);
    console.log(`       rigged: MHR's ${r.rig.joints} bones from ${r.rig.root}, every part skinned on them; the head turned 0.60 rad takes the eyes ${r.rig.turned.toFixed(2)} round it (each on ${r.rig.eyes.join(" and ")}), the feet stay (${(r.rig.feet * 1000).toFixed(2)} mm)`);
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

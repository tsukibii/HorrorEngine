// A Character Studio character on the desk (STORY_FORMAT §2 `previs_body: "people/<name>"`): the bodies list has each
// one the Studio exported (People/<name>/export/<name>.glb, Export for desk / Unreal), a cast member wears it (MHR's
// skeleton driven by the blocking, the character's own look, its eyes wearing tools/shared/eye.js), the story check
// knows it, and the simple view (the toolbar's Simple, for when the desk lags) takes the textures and the eyes' shading
// away and gives them back, kept in this browser. In memory only: the Pilot's Mari wears the character. Ends
// "PEOPLE ok".
//
//   python tools/director/serve.py          (in another shell)
//   node tools/director/peopletest.js       (PERSON=name: that character, else the first exported; STUDIO exports
//                                            _studiotest)
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const URL = (process.env.DESK_URL || "http://127.0.0.1:8780/") + "?game=Pilot";
const fail = m => { console.error("PEOPLE FAIL: " + m); process.exit(1); };

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 820 } })).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const open = async () => {
    await page.goto(URL);
    await page.waitForFunction(() => window.__dd && window.__dd.PLAN && window.__dd.flowStage && window.__dd.flowStage.level, null, { timeout: 60000 });
  };
  await open();
  await page.evaluate(() => { try { localStorage.removeItem("dd.simple"); } catch (e) { } window.__dd.setSimple(false); });
  const step = async (what, fn) => { try { await fn(); console.log("  ok  " + what); } catch (e) { fail(`${what}: ${e.message}`); } };
  let body = null;

  await step("the bodies list has the Character Studio's exports, named as such in the Database", async () => {
    const r = await page.evaluate(async () => ({ bodies: (await (await fetch("/api/bodies")).json()).bodies, labels: window.__dd.DB.D.bodies() }));
    const people = r.bodies.filter(f => f.startsWith("people/"));
    body = process.env.PERSON ? "people/" + process.env.PERSON : people[0];
    if (!body || !people.includes(body)) throw new Error(`no Character Studio export here${process.env.PERSON ? ` named ${process.env.PERSON}` : ""} (Export for desk / Unreal in the Studio; STUDIO exports _studiotest): ${JSON.stringify(r.bodies)}`);
    const label = r.labels.find(x => Array.isArray(x) && x[0] === body);
    if (!label || label[1] !== `${body.slice(7)} (Character Studio)`) throw new Error(`the Database lists it as ${JSON.stringify(label)}`);
  });
  await step("a cast member wears it: MHR's skeleton, posed by the blocking; the character's own look (not the desk's clay); its eyes on their bones, wearing the eye", async () => {
    const r = await page.evaluate(async f => {
      const d = window.__dd, J = ["head", "hand_l", "hand_r", "foot_l", "foot_r"];
      const off = fig => J.map(j => { const a = fig.jointWorld(j), b = fig.modelJointWorld(j); return a && b ? a.distanceTo(b) : 1; });   // the body's joints from the blocking's (their joints differ a little by definition)
      const wear = async b => { d.S.cast.mari.previs_body = b; await d.loadBodies(); d.select("n_message"); await new Promise(r => setTimeout(r, 1000)); return d.flowStage.cast.mari; };
      const ref = (await (await fetch("/api/bodies")).json()).bodies.includes("MHR.fbx") ? off(await wear("MHR.fbx")) : null;   // the desk's own MHR body, as it follows the same blocking
      const fig = await wear(f); if (!fig) return { err: "Mari has no figure in the message scene" };
      const meshes = []; fig.model.traverse(o => { if (o.isMesh) meshes.push(o); });
      const skin = meshes.find(m => /_skin$/.test(m.name)), eyes = meshes.filter(m => m.material.userData.eyeU);
      const bone = m => m.skeleton.bones[m.geometry.attributes.skinIndex.getX(0)].name;
      return { kind: fig.constructor.name, ok: fig.ok, mhr: fig.mhr, clay: skin && skin.material.customProgramCacheKey() === "inkcel-squash", skin: !!skin,
               eyes: eyes.map(m => [m.name, bone(m), !!m.material.userData.plain]), off: off(fig), ref, tall: fig.height };
    }, body);
    if (r.err) throw new Error(r.err);
    if (r.kind !== "BodyFigure" || !r.ok || !r.mhr) throw new Error(`not a body on MHR's skeleton: ${JSON.stringify(r)}`);
    if (!r.skin || r.clay) throw new Error(`the skin ${r.skin ? "is the desk's clay" : "is missing"}`);
    const want = [["_eye_L", "l_eye"], ["_eye_R", "r_eye"]];
    if (r.eyes.length !== 2 || !want.every(([n, b]) => r.eyes.some(e => e[0].endsWith(n) && e[1] === b && e[2]))) throw new Error(`the eyes: ${JSON.stringify(r.eyes)}`);
    const cm = a => a.map(v => (v * 100).toFixed(1)).join(", "), worse = r.ref ? Math.max(...r.off.map((v, i) => v - r.ref[i])) : Math.max(...r.off) - 0.08;
    if (worse > 0.015) throw new Error(`the body doesn't follow the blocking: head, hands, feet ${cm(r.off)} cm off its joints${r.ref ? `, the desk's own MHR body ${cm(r.ref)}` : ""}`);
    console.log(`       ${body.slice(7)} as Mari, ${r.tall} m: the head, hands and feet ${cm(r.off)} cm off the blocking's joints${r.ref ? ` (the desk's own MHR body ${cm(r.ref)})` : ""}; the eyes on l_eye and r_eye`);
  });
  await step("the eye on the stage: drawn by tools/shared/eye.js, dark at the pupil, light in the white either side of the iris", async () => {
    const r = await page.evaluate(() => {
      const d = window.__dd, st = d.flowStage, fig = st.cast.mari, eye = fig.model.getObjectByName("l_eye"), R = st.renderer, gl = R.getContext();
      let mat = null; fig.model.traverse(o => { if (o.isMesh && /_eye_L$/.test(o.name)) mat = o.material; });
      st.setTime("day");
      const p = eye.getWorldPosition(st.camera.position.clone()), dir = st.camera.position.clone().set(0, 0, 1).applyQuaternion(eye.getWorldQuaternion(st.camera.quaternion.clone()));
      const cam = st.camera.clone(); cam.fov = 6; cam.aspect = 1; cam.near = 0.05; cam.position.copy(p).addScaledVector(dir, 0.3); cam.lookAt(p); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      R.setSize(96, 96, false); st.simplify(); R.render(st.scene, cam);
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      st.resize(); d.select("n_message");
      const lum = (x, y) => { const i = (Math.round(y * (H - 1)) * W + Math.round(x * (W - 1))) * 4; return 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; };
      let white = 0, skin = 0, k = 0; for (let y = 0.4; y <= 0.6; y += 0.05) { for (const x of [0.14, 0.18, 0.22, 0.78, 0.82, 0.86]) white = Math.max(white, lum(x, y)); for (const x of [0.02, 0.98]) { skin += lum(x, y); k++; } }
      return { mid: lum(0.5, 0.5), white, skin: skin / k, shader: !!(mat && mat.userData.eyeU && mat.isMeshPhysicalMaterial) };   // the white's lightest, the lids' mean
    });
    if (!r.shader) throw new Error("the left eye isn't drawn by tools/shared/eye.js");
    // the white against the lids round it, not a number of its own: how light an eye's white comes out is the character's
    // (its paint) and the light's; a broken eye is dark there, or no lighter than the skin
    if (!(r.mid < 50 && r.white > 90 && r.white > r.skin + 12)) throw new Error(`the eye close up by day: the pupil ${r.mid.toFixed(0)}, the white at most ${r.white.toFixed(0)}, the lids beside it ${r.skin.toFixed(0)} (of 255)`);
    console.log(`       close up by day: the pupil ${r.mid.toFixed(0)}, the white ${r.white.toFixed(0)}, the lids beside it ${r.skin.toFixed(0)} (of 255)`);
  });
  await step("the simple view: every surface a plain colour, no textures (but cut-outs), the eyes their flat paint, one pixel per pixel; off, everything as it was; kept in this browser", async () => {
    const r = await page.evaluate(() => {
      const d = window.__dd, st = d.flowStage, before = new Map(); st.scene.traverse(o => { if (o.isMesh) before.set(o, o.material); });
      d.setSimple(true);
      let n = 0, lit = 0, textured = 0, eyes = 0;
      st.scene.traverse(o => {
        if (!o.isMesh) return; n++;
        for (const m of [].concat(o.material)) {
          if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshPhongMaterial) lit++;
          if (m.userData.simple && m.map && !(m.alphaTest > 0 || m.transparent)) { const was = before.get(o); if (was && was.userData.plain && m.map === was.userData.plain.map) eyes++; else textured++; }
        }
      });
      const worn = [...before.values()].filter(m => m.userData && m.userData.plain).length;   // every figure wearing the character (the level places Mari too)
      const on = { n, lit, textured, eyes, worn, pr: st.renderer.getPixelRatio(), kept: localStorage.getItem("dd.simple"), button: document.querySelector("#simpleView").classList.contains("on") };
      d.setSimple(false);
      let back = 0, other = 0; st.scene.traverse(o => { if (o.isMesh && before.has(o)) { if (o.material === before.get(o)) back++; else other++; } });
      d.setSimple(true);
      return { on, back, other, button: document.querySelector("#simpleView").classList.contains("on") };
    });
    const o = r.on;
    if (o.lit || o.textured || o.worn < 2 || o.eyes !== o.worn || o.pr !== 1 || o.kept !== "1" || !o.button) throw new Error(`on: ${JSON.stringify(o)}`);
    if (r.other || !r.back) throw new Error(`off: ${r.back} surfaces back as they were, ${r.other} not`);
    await open();                                     // a new page: still simple
    const again = await page.evaluate(() => { const st = window.__dd.flowStage; st.render(); let lit = 0; st.scene.traverse(o => { if (o.isMesh && [].concat(o.material).some(m => m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) lit++; });
      return { button: document.querySelector("#simpleView").classList.contains("on"), lit }; });
    if (!again.button || again.lit) throw new Error(`after a reload: ${JSON.stringify(again)}`);
    await page.click("#simpleView");
    const off = await page.evaluate(() => ({ kept: localStorage.getItem("dd.simple"), button: document.querySelector("#simpleView").classList.contains("on") }));
    if (off.kept || off.button) throw new Error(`the button didn't turn it off: ${JSON.stringify(off)}`);
    console.log(`       ${o.n} surfaces: none lit, none textured but the eyes' flat paint and cut-outs, at one pixel per pixel; ${r.back} back as they were`);
  });
  await step("the story check knows a Studio character: one exported passes, one that isn't warns", async () => {
    const r = await page.evaluate(async f => {
      const d = window.__dd, S = JSON.parse(JSON.stringify(d.S)), check = async v => { S.cast.mari.previs_body = v; const j = await (await fetch("/api/storycheck/Pilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(S) })).json(); return j.warnings.filter(w => /previs_body/.test(w)); };
      return { has: await check(f), none: await check("people/_nobody_here") };
    }, body);
    if (r.has.length) throw new Error(`warned for ${body}: ${r.has.join(" | ")}`);
    if (!r.none.some(w => /no Export for desk/.test(w))) throw new Error(`no warning for a character that isn't exported: ${JSON.stringify(r.none)}`);
  });
  if (errors.length) fail("page errors: " + errors.slice(0, 5).join(" | "));
  await browser.close();
  console.log("PEOPLE ok");
})();

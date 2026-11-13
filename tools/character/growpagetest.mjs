// GROWPAGE: the Character Studio's ages, Cutify, monster mode, horns and animal ears, driven in a headless browser on a
// scratch character (_growtest; DECISIONS 2026-11-10, night). An eight-year-old: the height the age's average, the
// head its share of it, the feet on the floor, the eyes in a head nine tenths an adult's; the T-pose on a child; a front
// picture (the page's own head: no one's photo) still bends the face and nothing under the neck, and Young face turned
// down leaves the body's proportions; Cutify grows the eyes and shortens the face, and off it's as it was; saved and
// opened again the same; hair baked on the adult's head (a made-up bake: four marks on the scalp) rides the head to the
// child's, is still on it opened again, and a bake that sits on no head we know is left and said; monster mode: the sliders to ±3, the Creature controls, the height to 3.5 m, every creature
// to start from a whole body with no NaN, its fangs, and leaving it brings everything back into a person's range;
// every kind of horn on the head (rigid on it in a file), every kind of ear with its chain's joints, without its
// headband, a cow's tag, its flop; Export for Godot: each ear's chain of bones under the head in the file, the ears'
// meshes skinned to them, the horns on the head's bone, the head's scale said with the skin (what the face shapes are
// sized by: not the height, on a child); then, with Godot on the machine, JIGGLE on that export.
// Ends "GROWPAGE ok". The Character Studio's server running (BODY_URL for another port); `python tools/face_mesh.py setup` once.
//   node tools/character/growpagetest.mjs [shot.png]      (QUICK=1: no picture fit, no export)
import { createRequire } from "module";
import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const URL = process.env.BODY_URL || "http://127.0.0.1:8793/", NAME = "_growtest", QUICK = !!process.env.QUICK, shot = process.argv[2];
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const browser = await req("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1300, height: 860 } })).newPage(); page.setDefaultTimeout(180000);   // (a busy software-drawn page answers late)
const click0 = page.click.bind(page); page.click = (s, o) => click0(s, { noWaitAfter: true, ...o });
const errs = [], bad = [], t0 = Date.now();
page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
const say = (ok, what) => { console.log((ok ? "  ok  " : "  BAD ") + what); if (!ok) bad.push(what); };
const B = (f, a) => page.evaluate(f, a);
const SALON = path.join(ROOT, "Content", "Studio", "People", NAME, "salon");   // (the scratch character's hair: none, but the made-up bake below)
// the made-up bake's four marks against the scalp points they were put on: the furthest any is from its point now (m),
// and the head's top
const hairOff = ids => B(ids => { const b = window.__body, H = b.salonHair; if (!H) return null; b.rig.updateMatrixWorld(true);
  const T = b.THREE, toRig = new T.Matrix4().copy(b.rig.matrixWorld).invert(), v = new T.Vector3(), each = []; let m = null; H.traverse(o => { if (o.isMesh) m = o; });
  const P = m.geometry.attributes.position; ids.forEach((i, k) => { v.fromBufferAttribute(P, k * 3).applyMatrix4(m.matrixWorld).applyMatrix4(toRig); each.push(Math.hypot(v.x - b.POS[i * 3], v.y - b.POS[i * 3 + 1], v.z - b.POS[i * 3 + 2])); });
  return { most: Math.max(...each), each, y: H.matrix.elements[13], k: Math.cbrt(Math.abs(H.matrix.determinant())), record: !!b.st.hairHead, stale: b.hairStale }; }, ids);
const age = v => B(v => { const i = document.querySelector("#ageRows input"); i.value = v; i.oninput(); }, v);
const preset = (kind, k) => B(([kind, k]) => document.querySelector(`#${kind}Cards .card[data-preset="${k}"]`).click(), [kind, k]);   // a head's or a body's card clicked ("": Plain)
const tog = (id, on) => B(([id, on]) => { const c = document.querySelector(id); if (c.checked !== on) { c.checked = on; c.onchange(); } }, [id, on]);
// the body as it stands: its height, the head's share (the chin to the top), the lowest point, the eyes
const body = () => B(() => { const b = window.__body, P = b.POS; let lo = 1e9, hi = -1e9, nan = 0; for (let i = 0; i < P.length; i++) { if (!Number.isFinite(P[i])) nan++; if (i % 3 === 1) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); } }
  const chin = b.lmk(152), eL = b.EYES.L.position, eR = b.EYES.R.position, c0 = b.lmk(33), c1 = b.lmk(133), nose = b.lmk(1), brow = b.lmk(9);
  return { lo, hi, nan, head: (hi - chin[1]) / (hi - lo), ipd: Math.hypot(eL.x - eR.x, eL.y - eR.y, eL.z - eR.z), eyeY: (eL.y + eR.y) / 2, eyeR: b.EYES.L.scale.x, lid: Math.hypot(c0[0] - c1[0], c0[1] - c1[1], c0[2] - c1[2]),
           face: ((eL.y + eR.y) / 2 - chin[1]) / b.scale, nose: (nose[2] - brow[2]) / b.scale, scale: b.scale, height: b.st.height, chinY: chin[1] }; });
try {
  fs.rmSync(SALON, { recursive: true, force: true });
  await page.addInitScript(() => { window.__plainNew = true; });   // (a new character from MHR's plain halfway base, as this was written on: not the Studio's own start, grow.js NEW_START)
  await page.goto(URL);
  await page.waitForFunction(() => window.__body && window.__body.N > 10000 && window.__body.SCULPT, null, { timeout: 180000 });
  await B(n => Promise.all(["front", "side"].map(s => fetch(`api/picture/${n}/${s}/png`, { method: "POST", body: "" })).concat(fetch(`api/people/${n}/face.bin`, { method: "POST", body: "" }))), NAME);
  // ---- a new character as the Studio starts it (grow.js NEW_START; DECISIONS 2026-11-12, make-up enhanced): the
  // feminine base, v2female's head on bodyv2's body, their cards marked; the three categories of cards
  await B(() => { window.__plainNew = false; });
  await page.fill("#newName", NAME); await page.click("#make");
  await page.waitForFunction(n => window.__body.who === n && /starts from the/.test(document.querySelector("#status").textContent), NAME, { timeout: 180000 });
  await page.waitForTimeout(3000);
  { const n = await B(async name => { const b = window.__body, s = b.st, P = b.neutralBody(); let lo = 1e9, hi = -1e9; for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); }
      const on = id => [...document.querySelectorAll(`${id} .card.on`)].map(c => c.dataset.preset), keys = id => [...document.querySelectorAll(`${id} .card`)].map(c => c.dataset.preset), file = await (await fetch(`api/people/${name}`)).json();
      const pics = []; for (const [kind, id] of [["head", "#headCards"], ["body", "#bodyCards"]]) for (const k of keys(id)) { const r = await fetch(`api/presets/thumbs/${kind}_${k || "plain"}.jpg`); if (!r.ok || (await r.arrayBuffer()).byteLength < 2000) pics.push(`${kind}_${k || "plain"}`); }
      return { base: s.base, head: s.headPreset, body: s.bodyPreset, h: s.height, tall: hi - lo, headOn: on("#headCards"), bodyOn: on("#bodyCards"), heads: keys("#headCards"), bodies: keys("#bodyCards"), want: b.GW.NEW_START, H: Object.keys(b.GW.HEADS), B: Object.keys(b.GW.BODIES), file, pics,
               tabs: [...document.querySelectorAll("#presetTabs button")].map(x => x.textContent), shown: [!document.querySelector("#headBox").hidden, !document.querySelector("#bodyBox").hidden, !document.querySelector("#creatureBox").hidden] }; }, NAME);
    say(n.base === -1 && n.head === n.want.head && n.body === n.want.body && n.h === n.want.height && Math.abs(n.tall - n.h) < 0.01 && n.headOn.join() === n.head && n.bodyOn.join() === n.body && n.file.headPreset === n.head && n.file.bodyPreset === n.body && n.file.base === -1,
      `a new character starts on the feminine base with ${n.head}'s head on ${n.body}'s body, ${n.h} m, their cards marked, saved so (base ${n.base}, head ${n.head}, body ${n.body}, ${n.tall.toFixed(3)} m tall)`);
    say(n.tabs.join() === "Heads,Bodies,Monsters" && n.shown.join() === "true,false,false" && n.heads[0] === "" && n.bodies[0] === "" && n.H.every(k => n.heads.includes(k)) && n.B.every(k => n.bodies.includes(k)) && !n.pics.length,
      `the presets in three categories (${n.tabs.join(", ")}), the heads shown first: ${n.heads.length} head cards and ${n.bodies.length} body cards, Plain first, each with its picture${n.pics.length ? " (NO PICTURE: " + n.pics.join(", ") + ")" : ""}`);
    // the v2 mouth and the lips a new character starts on (grow.js NEW_START; DECISIONS 2026-11-13, better mouths), the
    // lip shapes' chips (Face, Mouth), the mouth's style picker
    { const wait = () => page.waitForTimeout(2500);
      const read = () => B(() => { const b = window.__body, s = b.st, M = b.MOUTHPARTS.parts; return { style: s.teeth.style, pick: document.querySelector("#teethStyle").value, chips: [...document.querySelectorAll("#lipShapes button")].map(c => c.dataset.lips), on: [...document.querySelectorAll("#lipShapes button.on")].map(c => c.dataset.lips),
        lips: b.GW.LIP_IDS.map(id => s.sculpt[id] || 0), top: (b.lmk(0)[1] - b.lmk(13)[1]) * 1000 / b.scale, n: M["lower-tongue"].geometry.attributes.position.count, uv: !!M["lower-tongue"].geometry.attributes.uv, want: b.GW.NEW_START, all: Object.keys(b.GW.LIPS) }; });
      const m0 = await read();
      await B(() => document.querySelector('#lipShapes button[data-lips="v2_full"]').click()); await wait(); const m1 = await read();
      await B(() => document.querySelector('#lipShapes button[data-lips=""]').click()); await wait(); const m2 = await read();
      const pick = v => B(v => { const e = document.querySelector("#teethStyle"); e.value = v; e.dispatchEvent(new Event("change")); }, v);   // (the picker is on the Face tab, not the one shown)
      await pick("classic"); await wait(); const m3 = await read();
      await pick("v2"); await B(w => document.querySelector(`#lipShapes button[data-lips="${w}"]`).click(), m0.want.lips); await wait(); const m4 = await read();
      say(m0.style === m0.want.teeth && m0.pick === m0.style && m0.uv && m0.on.join() === m0.want.lips && n.file.teeth?.style === m0.style && m0.chips[0] === "" && m0.all.every(k => m0.chips.includes(k)),
        `a new character's mouth is the ${m0.style} one (the picker on it, its tongue with its papillae's layout, saved so) and its lips ${m0.on.join()} (its chip marked; ${m0.chips.length} chips, Own first)`);
      say(m1.on.join() === "v2_full" && Math.abs(m1.top - m0.top) > 0.15 && m2.on.join() === "" && m2.lips.every(v => v === 0) && Math.abs(m2.top - m0.top) > 0.15 && m3.style === "classic" && m3.n !== m0.n && !m3.uv && m4.style === "v2" && m4.n === m0.n && m4.on.join() === m0.want.lips && m4.lips.join() === m0.lips.join(),
        `a lip shape's chip sets the five lip sliders (the upper lip's red ${m0.top.toFixed(1)} mm high on ${m0.on.join()}, ${m1.top.toFixed(1)} on v2_full, ${m2.top.toFixed(1)} on Own with all five at 0); the mouth's style picked: classic (its tongue ${m3.n} points, no layout on it), v2 again (${m4.n} points); the lips back as they started`); }
    // a file from before the cards (the two switches: v2: 1, b2: 1) opens on the same two presets
    await B(async name => { const f = await (await fetch(`api/people/${name}`)).json(); delete f.headPreset; delete f.bodyPreset; f.v2 = 1; f.b2 = 1; await fetch(`api/people/${name}`, { method: "POST", body: JSON.stringify(f) }); }, NAME);
    await page.reload(); await page.waitForFunction(() => window.__body && window.__body.SCULPT, null, { timeout: 180000 });
    await page.selectOption("#who", NAME); await page.waitForFunction(n => window.__body.who === n && /points/.test(document.querySelector("#hud").textContent), NAME, { timeout: 180000 }); await page.waitForTimeout(2000);
    const o = await B(() => ({ head: window.__body.st.headPreset, body: window.__body.st.bodyPreset }));
    say(o.head === "v2female" && o.body === "bodyv2", `a character saved before the cards (v2: 1, b2: 1) opens on ${o.head}'s head and ${o.body}'s body`); }
  // ---- and from MHR's plain halfway base, as everything below was written on
  await B(() => { window.__plainNew = true; });
  await page.fill("#newName", NAME); await page.click("#make");
  await page.waitForFunction(n => window.__body.who === n && /starts from the/.test(document.querySelector("#status").textContent), NAME, { timeout: 180000 });
  await page.waitForTimeout(3000);
  { const p = await B(() => ({ base: window.__body.st.base, head: window.__body.st.headPreset, body: window.__body.st.bodyPreset, h: window.__body.st.height })); if (p.base !== 0 || p.head || p.body || p.h !== 1.7) throw new Error("the plain start: " + JSON.stringify(p)); }
  await B(() => { const b = window.__body; b.setPose("rest"); document.querySelector('.bases button[data-base="0"]').click(); document.querySelector("#handlesOn").checked = false; });
  await page.waitForTimeout(1500);

  // ---- the adult, then eight
  const adult = await body(), ui = await B(() => ({ age: !!document.querySelector("#ageRows input"), out: document.querySelector("#ageRows output").textContent, min: +document.querySelector("#baseRows .row:last-child input").min, st: window.__body.st.age }));
  say(ui.age && ui.out === "adult" && ui.st.age === 18 && ui.min <= 1.1 && Math.abs(adult.head - 0.1248) < 0.004, `a new character is an adult as before (the head ${(1 / adult.head).toFixed(2)} to the height); the height's slider goes down to ${ui.min} m`);
  // (hair baked on the adult's head, as the salon does: its frame from the body, its points in the head's own space; here
  // four small marks, each on a point of the skull that an age's face leaves alone)
  const baked = await B(async n => {
    const b = window.__body, T = b.THREE, SR = await import("./salonref.js"), { GLTFExporter } = await import("./vendor/GLTFExporter.js");
    const P = b.neutralBody(), hf = SR.headFrame(P), earY = P[SR.DEFAULT_ANCHORS.left * 3 + 1], best = (f, ok) => { let at = -1, top = -Infinity; for (let i = 0; i < b.N; i++) if (ok(i) && f(i) > top) { top = f(i); at = i; } return at; };
    const up = i => P[i * 3 + 1] > earY + 0.045, ids = [best(i => -P[i * 3 + 2], up), best(i => P[i * 3], up), best(i => -P[i * 3], up), best(i => P[i * 3 + 1] - 0.6 * P[i * 3 + 2], up)];   // the back of the head, over each ear, the crown's back
    const pts = []; for (const i of ids) { const q = SR.toLocal(hf, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); pts.push(...q, q[0] + 0.002, q[1], q[2], q[0], q[1] + 0.002, q[2]); }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(new Float32Array(pts), 3)); g.computeVertexNormals();
    const scene = new T.Scene(), mesh = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0x222222, name: "hair_marks" })); mesh.name = "hair_static"; scene.add(mesh);
    const glb = await new Promise((ok, bad) => new GLTFExporter().parse(scene, ok, bad, { binary: true }));
    const at = `api/people/${n}/salon/`, info = { about: "GROWPAGE's made-up bake: four marks on the scalp", head: { C: hf.C, B: hf.B, S: hf.S, person: n } };
    const r = await Promise.all([fetch(at + "salon.glb", { method: "POST", body: glb }), fetch(at + "salon_bake.json", { method: "POST", body: JSON.stringify(info) })]);
    window.postMessage({ salon: "baked" }, location.origin);
    return { ok: r.every(x => x.ok), ids, y: hf.C[1] };
  }, NAME);
  await page.waitForFunction(() => window.__body.salonHair && window.__body.st.hairHead, null, { timeout: 120000 }).catch(() => null);
  const hair0 = await hairOff(baked.ids);
  say(baked.ok && hair0 && hair0.record && hair0.most < 2e-4, `a hairstyle baked on the adult's head (four marks on its scalp) is worn where it was baked (${hair0 ? (hair0.most * 1000).toFixed(2) : "?"} mm off), and the character records the head it was made on`);
  await age(8); await page.waitForTimeout(2500);
  const kid = await body(), hair8 = await hairOff(baked.ids);
  say(hair8 && hair8.most < 1e-3 && hair0.y - hair8.y > 0.25 && hair8.k < hair0.k * 0.97, `at eight the bake rides the head: ${((hair0.y - (hair8?.y || 0)) * 100).toFixed(0)} cm lower and ${((1 - (hair8?.k || 0) / hair0.k) * 100).toFixed(0)}% smaller with it, its marks still on their scalp points (${hair8 ? hair8.each.map(v => (v * 1000).toFixed(2)).join(", ") : "?"} mm off)`);
  say(kid.height >= 1.26 && kid.height <= 1.29 && Math.abs(kid.hi - kid.height) < 0.001 && Math.abs(kid.lo) < 0.001 && !kid.nan, `age 8: the height set to the age's average (${kid.height} m), the body that tall with its feet on the floor`);
  say(Math.abs(kid.head / 0.1477 - 1) < 0.02, `its head ${(1 / kid.head).toFixed(2)} to the height (an adult's ${(1 / adult.head).toFixed(2)}): a child's share, not a small adult's`);
  const k = kid.scale / adult.scale;
  say(k > 0.9 && k < 0.97 && Math.abs(kid.ipd / adult.ipd / k - 1) < 0.06 && kid.eyeY > kid.chinY && kid.eyeY < kid.hi, `the skull ${(k * 100).toFixed(0)}% an adult's size (a child's is most of its adult size), its eyes ${(kid.ipd * 1000).toFixed(0)} mm apart in it (${(adult.ipd * 1000).toFixed(0)} mm on the adult)`);
  say(kid.face < adult.face * 0.97 && kid.nose < adult.nose * 0.95, `the age's face: ${((1 - kid.face / adult.face) * 100).toFixed(0)}% shorter under the eyes, the nose ${((1 - kid.nose / adult.nose) * 100).toFixed(0)}% less out of the face`);
  const hud = await B(() => document.querySelector("#hud").textContent);
  say(/age 8/.test(hud), "the view says the age");

  // ---- the T-pose on a child
  const tp = await B(() => { const b = window.__body; b.setPose("t"); const X = b.POSED, ix = n => b.RIG.byName.get(n), y = n => X.J2[ix(n) * 3 + 1];
    const r = { posed: !!X, arm: Math.abs(y("l_wrist") - y("l_uparm")), leg: Math.abs(X.J2[ix("l_foot") * 3] - X.J2[ix("l_upleg") * 3]) }; let nan = 0; for (const v of b.SHOW) if (!Number.isFinite(v)) nan++; r.nan = nan; b.setPose("rest"); return r; });
  say(tp.posed && tp.arm < 0.012 && tp.leg < 0.012 && !tp.nan, `the T-pose on the child: the arms level (${(tp.arm * 1000).toFixed(1)} mm off), the legs straight (${(tp.leg * 1000).toFixed(1)} mm)`);

  // ---- a picture still makes the face (the page's own head as the picture)
  if (!QUICK) {
    await age(18); await page.waitForTimeout(1500);
    await page.click('#views button[data-v="head"]'); await page.click('#views button[data-yaw="0"]'); await page.waitForTimeout(2500);
    const clip = await B(() => { const r = document.querySelector("#view canvas").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    const front = await page.screenshot({ clip, timeout: 180000 });
    await age(9); await page.waitForTimeout(1500);
    await page.click('#tabs button[data-tab="face"]');
    await page.setInputFiles("#slots .slot:nth-child(1) input", { name: "front.png", mimeType: "image/png", buffer: front });
    await page.waitForFunction(() => window.__body.delta && window.__body.report && window.__body.report.used === 1, null, { timeout: 240000 });
    await page.waitForTimeout(2000);
    const fit = await B(() => { const b = window.__body, d = b.delta; let under = 0, most = 0; for (let j = 0; j < d.idx.length; j++) { const i = d.idx[j], m = Math.abs(d.d[j * 3]) + Math.abs(d.d[j * 3 + 1]) + Math.abs(d.d[j * 3 + 2]); most = Math.max(most, m); if (b.POS[i * 3 + 1] < b.st.height * 0.74) under = Math.max(under, m); } return { n: d.idx.length, under, most }; });
    const with1 = await body();
    say(fit.n > 500 && fit.most > 1e-4 && fit.under < 1e-9 && Math.abs(with1.head / (0.1248 * 0.152 / 0.132) - 1) < 0.05, `a front picture on a nine-year-old: the face fitted (${fit.n} points), nothing under the neck moved, the head still the age's share (${(1 / with1.head).toFixed(2)} to the height)`);
    // the body under the neck: every seventh point 5 cm and more under the chin as it is now (the same points both times: the chin moves with the face)
    const underIds = await B(() => { const b = window.__body, chin = b.lmk(152)[1], out = []; for (let i = 0; i < b.N; i += 7) if (b.POS[i * 3 + 1] < chin - 0.05) out.push(i); return out; });
    const under = () => B(ids => { const P = window.__body.POS, out = []; for (const i of ids) out.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); return out; }, underIds);
    const body1 = await under();
    await B(() => { const i = document.querySelector("#ageRows .row:last-child input"); i.value = 0; i.oninput(); }); await page.waitForTimeout(1500);
    const with0 = await body(), body0 = await under(), moved = body0.length === body1.length ? Math.max(...body0.map((v, i) => Math.abs(v - body1[i]))) : 1;
    say(with0.face > with1.face * 1.02 && Math.abs(with0.scale - with1.scale) < 1e-9 && Math.abs(with0.height - with1.height) < 1e-9 && moved < 1e-6 && Math.abs(with0.eyeY - with1.eyeY) < 5e-4, `Young face at 0 (the picture gives the face): the face ${((with0.face / with1.face - 1) * 100).toFixed(0)}% longer again, the body under the neck exactly as it was (${(moved * 1e6).toFixed(2)} µm over ${body1.length / 3} points, the same scale and height; the eyes, smaller again, ${(Math.abs(with0.eyeY - with1.eyeY) * 1000).toFixed(2)} mm from where they were)`);
    await B(() => { const i = document.querySelector("#ageRows .row:last-child input"); i.value = 1; i.oninput(); });
    await B(n => fetch(`api/picture/${n}/front/png`, { method: "POST", body: "" }), NAME);
    await B(() => window.__body.st && document.querySelector("#slots .slot .x")?.click());
    await page.waitForFunction(() => !window.__body.delta, null, { timeout: 120000 }).catch(() => null);
    await page.click('#tabs button[data-tab="body"]'); await page.click('#views button[data-v="body"]');
  }

  // ---- Cutify
  await age(18); await page.waitForTimeout(1500);
  const before = await body(), P0 = await B(() => Array.from(window.__body.POS));
  await tog("#cuteOn", true); await page.waitForTimeout(2000);
  const cute = await body();
  say(cute.lid > before.lid * 1.03 && cute.eyeR > before.eyeR * 1.02 && cute.face < before.face * 0.985 && cute.nose < before.nose * 0.97, `Cutify on an adult: the eyes ${((cute.lid / before.lid - 1) * 100).toFixed(0)}% wider (the eyeball ${((cute.eyeR / before.eyeR - 1) * 100).toFixed(0)}% bigger), the face ${((1 - cute.face / before.face) * 100).toFixed(1)}% shorter, the nose ${((1 - cute.nose / before.nose) * 100).toFixed(0)}% smaller`);
  await B(() => { const i = document.querySelector("#cuteRows input"); i.value = 1.5; i.oninput(); }); await page.waitForTimeout(1500);
  const cute2 = await body();
  say(cute2.lid > cute.lid * 1.02 && !cute2.nan, `more of it at 1.5 (the eyes ${((cute2.lid / before.lid - 1) * 100).toFixed(0)}% wider)`);
  await tog("#cuteOn", false); await page.waitForTimeout(1500);
  const off = await B(P0 => { const P = window.__body.POS; let m = 0; for (let i = 0; i < P.length; i++) m = Math.max(m, Math.abs(P[i] - P0[i])); return m; }, P0);
  say(off < 1e-6, `off, the face exactly as it was (${(off * 1e6).toFixed(2)} µm)`);

  // ---- saved and opened again
  await age(10); await tog("#cuteOn", true); await page.waitForTimeout(1000);
  await preset("head", "v2female"); await preset("body", "bodyv2"); await page.waitForTimeout(800);   // (v2female's head and bodyv2's body picked, so the save and the reopening below carry them too)
  await B(() => { document.querySelector("#status").textContent = ""; }); await page.click("#save");
  await page.waitForFunction(() => /saved/.test(document.querySelector("#status").textContent), null, { timeout: 60000 });
  const saved = await B(async n => (await fetch(`api/people/${n}`)).json(), NAME);
  say(saved.headPreset === "v2female" && saved.bodyPreset === "bodyv2" && saved.v2 === undefined, "and its head and body presets saved with it (v2female, bodyv2)");
  say(saved.age?.age === 10 && saved.cute?.on === true && saved.monster === false && saved.height === 1.39, `saved with the character: age ${saved.age?.age}, Cutify ${saved.cute?.on ? "on" : "off"} at ${saved.cute?.amount}, ${saved.height} m`);
  await page.reload(); await page.waitForFunction(() => window.__body && window.__body.SCULPT, null, { timeout: 180000 });
  await page.selectOption("#who", NAME);
  await page.waitForFunction(n => window.__body.who === n && /points/.test(document.querySelector("#hud").textContent), NAME, { timeout: 180000 }); await page.waitForTimeout(4000);
  const again = await B(() => ({ st: window.__body.st.age, cute: window.__body.st.cute, out: document.querySelector("#ageRows output").textContent, on: document.querySelector("#cuteOn").checked, h: window.__body.st.height }));
  { const v = await B(() => ({ head: window.__body.st.headPreset, body: window.__body.st.bodyPreset, on: [...document.querySelectorAll("#headCards .card.on, #bodyCards .card.on")].map(c => c.dataset.preset) }));
    say(v.head === "v2female" && v.body === "bodyv2" && v.on.join() === "v2female,bodyv2", "opened again on v2female's head and bodyv2's body, their cards marked");
    await preset("head", ""); await preset("body", ""); await B(() => document.querySelector('.bases button[data-base="0"]').click()); await page.waitForTimeout(800); }
  say(again.st.age === 10 && again.cute.on && again.out === "10" && again.on && again.h === 1.39, "opened again the same (age 10, Cutify on)");
  await page.waitForFunction(() => window.__body.salonHair, null, { timeout: 120000 }).catch(() => null);
  const hair10 = await hairOff(baked.ids);
  say(hair10 && hair10.record && !hair10.stale && hair10.most < 1.5e-3, `the hair opened again on the ten-year-old's head: the record kept with the character, the marks ${hair10 ? hair10.each.map(v => (v * 1000).toFixed(2)).join(", ") : "?"} mm off their scalp points`);
  // (a bake that sits on no head we know: no record, its frame 12 cm over this head: left where it was baked, and said)
  const stale = await B(async n => { const b = window.__body, at = `api/people/${n}/salon/salon_bake.json`, info = await (await fetch(at + "?v=" + Date.now())).json();
    info.head.C[1] += 0.12; await fetch(at, { method: "POST", body: JSON.stringify(info) }); b.st.hairHead = null; await b.loadSalon();
    return { stale: b.hairStale, y: b.salonHair.matrix.elements[13], want: info.head.C[1], hud: document.querySelector("#hud").textContent }; }, NAME);
  say(stale.stale && Math.abs(stale.y - stale.want) < 1e-6 && /baked on another head/.test(stale.hud), "a bake that sits on no head the character knows is left where it was baked, and the view says to bake it again");
  fs.rmSync(SALON, { recursive: true, force: true });
  const bald = await B(async () => { const b = window.__body; await b.loadSalon().catch(() => null); return { hair: !!b.salonHair, hud: document.querySelector("#hud").textContent }; });
  say(!bald.hair && !/baked on another head/.test(bald.hud), "its hair taken away: bald again, nothing said");
  await age(18); await tog("#cuteOn", false); await B(() => { document.querySelector("#handlesOn").checked = false; window.__body.setPose("rest"); });

  // ---- v2female's head (MHR_presets.json; DECISIONS 2026-11-12, the 1:1; a card since make-up enhanced): its card makes
  // the feminine end's head and neck it, the neck slender, the body under it as it was; Plain, the feminine base again
  { const meas = () => B(() => { const b = window.__body, P = b.neutralBody(); let lo = Infinity, hi = -Infinity; for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); }
      let best = 9; for (let f = 0.8; f < 0.885; f += 0.004) { const y = lo + (hi - lo) * f; let w = 0; for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i + 1] - y) < 0.004 && Math.abs(P[i]) < 0.14 && Math.abs(P[i]) > w) w = Math.abs(P[i]); if (w > 0.01) best = Math.min(best, w); }   // (the neck from the front at its narrowest)
      let hips = 0; const yh = lo + 0.51 * (hi - lo); for (let i = 0; i < P.length; i += 3) { const x = Math.abs(P[i]); if (Math.abs(P[i + 1] - yh) < 0.006 && x < 0.26 && x > hips) hips = x; }
      return { neck: best * 200, hips: hips * 200, hipsU: hips / b.scale, head: b.st.headPreset, body: b.st.bodyPreset, on: [...document.querySelectorAll("#headCards .card.on")].map(c => c.dataset.preset).join(), base: b.st.base }; });
    await B(() => document.querySelector('.bases button[data-base="-1"]').click()); await page.waitForTimeout(2000); const fem = await meas();
    await B(() => document.querySelector('.bases button[data-base="0"]').click()); await preset("head", "v2female"); await page.waitForTimeout(2000); const v2 = await meas();   // (picked on the halfway base: the base goes to Feminine)
    say(!fem.head && fem.on === "" && v2.head === "v2female" && v2.on === "v2female" && v2.base === -1 && v2.neck < fem.neck - 0.8 && v2.neck > 6 && Math.abs(v2.hipsU / fem.hipsU - 1) < 0.001 && !v2.body,
      `v2female's card: the neck ${fem.neck.toFixed(1)} cm at its narrowest on the feminine base, ${v2.neck.toFixed(1)} on v2female, its card marked, the base set to Feminine, the hips as they were (${v2.hips.toFixed(1)} cm, ${fem.hips.toFixed(1)} before: the body scaled to the same height under a shorter face, in its own units ${(Math.abs(v2.hipsU / fem.hipsU - 1) * 100).toFixed(3)}% apart)`);
    await preset("head", ""); await page.waitForTimeout(2000); const off = await meas();
    say(!off.head && off.on === "" && Math.abs(off.neck - fem.neck) < 0.05, `Plain: the feminine base's head again (${off.neck.toFixed(1)} cm)`);
    // the neck's length (grow.js Neck length; DECISIONS 2026-11-12, necks: "a modifier / slider in general to make necks
    // shorter"): its row with the neck's other sliders in Body, right after Neck width, saying what it does; dragged to
    // -1 the head comes down toward the shoulders (the top of the head over the top of the shoulder 9 cm out), and
    // back at 0 the body is as it was
    const rows = await B(() => { const d = [...document.querySelectorAll("#sculptRows details")].find(d => d.querySelector("summary").textContent === "Body"), p = [...document.querySelectorAll("#sculptRows details")].find(d => d.querySelector("summary").textContent === "Proportions");
      const names = e => [...e.querySelectorAll(".row > span")].map(x => x.textContent); return { body: names(d), props: names(p), help: window.__body.sculptRow.neck_length.title || "" }; });   // (a sculpt row's help is its tooltip)
    const at = rows.body.indexOf("Neck length");
    say(at > 0 && rows.body[at - 1] === "Neck width" && rows.body.filter(n => n === "Neck length").length === 1 && !rows.props.includes("Neck length") && /shorter/.test(rows.help) && /cm/.test(rows.help),
      `Neck length is in Body right after ${rows.body[at - 1]} (${rows.body.slice(Math.max(0, at - 2), at + 2).join(", ")}), not in Proportions, and says "${rows.help}"`);
    const lift = () => B(() => { const b = window.__body, P = b.neutralBody(); let lo = Infinity, hi = -Infinity; for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); }
      let top = -9; for (let i = 0; i < P.length; i += 3) if (Math.abs(Math.abs(P[i]) - 0.09) < 0.005 && P[i + 1] - lo < 0.89 * (hi - lo) && P[i + 1] > top) top = P[i + 1];   // (under the ears: the shoulder's top 9 cm out)
      return { gap: (hi - top) * 100, h: hi - lo }; });
    const setNeck = v => B(v => { const r = window.__body.sculptRow.neck_length.querySelector("input"); r.value = v; r.oninput(); }, v);
    const n0 = await lift(); await setNeck(-1); await page.waitForTimeout(1500); const n1 = await lift(); await setNeck(0); await page.waitForTimeout(1500); const n2 = await lift();
    say(n0.gap - n1.gap > 1.8 && n0.gap - n1.gap < 3 && Math.abs(n2.gap - n0.gap) < 0.05 && Math.abs(n1.h - n0.h) < 0.002,
      `the Neck length slider at -1: the head ${(n0.gap - n1.gap).toFixed(1)} cm nearer the shoulder's top (its top ${n0.gap.toFixed(1)} cm over it, then ${n1.gap.toFixed(1)}), the height as set; back at 0 as it was`);
    // bodyv2's body (MHR_presets.json presets.bodyv2; DECISIONS 2026-11-12, a T-pose reference; a card since make-up
    // enhanced): its card makes the feminine end's body it, wide hips, short arms, and the head is not touched (the
    // face's width at the eyes and the eyes' height under the crown as they were); Plain, the body before it again
    const build = () => B(() => { const b = window.__body, P = b.neutralBody(); let lo = Infinity, hi = -Infinity; for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); }
      let hips = 0, reach = 0; const y = lo + 0.51 * (hi - lo); for (let i = 0; i < P.length; i += 3) { const x = Math.abs(P[i]); if (Math.abs(P[i + 1] - y) < 0.006 && x < 0.26 && x > hips) hips = x; if (x > reach) reach = x; }
      const s = b.scale, e0 = b.lmk(33), e1 = b.lmk(263), ch = b.lmk(152), j0 = b.lmk(234), j1 = b.lmk(454);
      return { hips: hips * 200, reach: reach * 100, h: hi - lo, body: b.st.bodyPreset, head: b.st.headPreset, on: [...document.querySelectorAll("#bodyCards .card.on")].map(c => c.dataset.preset).join(),
               face: [Math.hypot(e0[0] - e1[0], e0[1] - e1[1], e0[2] - e1[2]) / s, Math.hypot(j0[0] - j1[0], j0[1] - j1[1], j0[2] - j1[2]) / s, ((e0[1] + e1[1]) / 2 - ch[1]) / s] }; });   // (the head's own measures, in MHR's units: the eyes apart, the face across, the eyes over the chin)
    await preset("head", "v2female"); await page.waitForTimeout(2000); const v2b = await build();
    await B(() => document.querySelector('#presetTabs button[data-kind="body"]').click()); await preset("body", "bodyv2"); await page.waitForTimeout(2500); const b2b = await build();
    const faceMoved = Math.max(...b2b.face.map((v, i) => Math.abs(v - v2b.face[i]))) * 1000;
    say(!v2b.body && v2b.on === "" && b2b.body === "bodyv2" && b2b.on === "bodyv2" && b2b.head === "v2female" && b2b.hips > v2b.hips + 4 && b2b.reach < v2b.reach - 2 && Math.abs(b2b.h - v2b.h) < 0.003 && faceMoved < 0.05,
      `bodyv2's card: the hips ${v2b.hips.toFixed(1)} cm across before it, ${b2b.hips.toFixed(1)} on bodyv2, the hands ${(v2b.reach - b2b.reach).toFixed(1)} cm nearer the body, as tall as set, the head still v2female's and not moved (${faceMoved.toFixed(3)} mm in its own measures)`);
    // v2pear's card (DECISIONS 2026-11-13, more body presets): the hips wider still, and the one body card that sets
    // something of the character's own: Anime on, the Bust at its start, the Anime row's slider showing it
    { await preset("body", "v2pear"); await page.waitForTimeout(2500); const pb = await build();
      const pa = await B(() => { const b = window.__body; return { anime: b.st.anime, bust: b.st.sculpt.bust, want: b.GW.BODIES.v2pear.anime, box: document.querySelector("#animeOn").checked, rows: !document.querySelector("#animeRows").hidden, slider: +document.querySelector("#animeRows input").value }; });
      say(pb.body === "v2pear" && pb.on === "v2pear" && pb.head === "v2female" && pb.hips > b2b.hips + 2 && Math.abs(pb.h - v2b.h) < 0.003 && pa.anime && pa.box && pa.rows && pa.bust === pa.want && Math.abs(pa.slider - pa.want) < 0.011,
        `v2pear's card: the hips ${pb.hips.toFixed(1)} cm across (bodyv2's ${b2b.hips.toFixed(1)}), as tall as set, the head still v2female's; Anime switched on with the Bust at ${pa.bust}, its own row shown with the slider there (${pa.slider})`);
      await B(() => { const b = window.__body; b.setAnime(false); delete b.st.sculpt.bust; b.changed("body"); }); await page.waitForTimeout(1500); }   // (as it was, for what follows)
    await preset("body", ""); await page.waitForTimeout(2000); const offb = await build();
    say(!offb.body && offb.head === "v2female" && Math.abs(offb.hips - v2b.hips) < 0.05, `Plain: the feminine base's body under v2female's head again (${offb.hips.toFixed(1)} cm)`);
    await preset("head", "");
    await B(() => { document.querySelector('.bases button[data-base="0"]').click(); document.querySelector('#presetTabs button[data-kind="monster"]').click(); }); await page.waitForTimeout(1000); }

  // ---- the creatures: cards that are always there (DECISIONS 2026-11-11), a click makes the character that creature
  const cards = await B(async () => { const cs = [...document.querySelectorAll("#creatureCards .card[data-creature]")], out = [];
    for (const c of cs) { const r = await fetch(`api/creatures/thumbs/${c.dataset.creature}.jpg`), n = r.ok ? (await r.arrayBuffer()).byteLength : 0; out.push({ k: c.dataset.creature, label: c.querySelector("span").textContent, pic: r.ok && /jpeg/.test(r.headers.get("content-type") || "") && n > 2000 }); }
    return { out, shown: !!cs.length && cs[0].offsetParent !== null, monster: window.__body.st.monster, keys: Object.keys(window.__body.GW.MONSTERS) }; });
  say(cards.out.length >= 7 && cards.shown && !cards.monster && cards.out.every(c => c.pic && c.label) && cards.keys.every(k => cards.out.some(c => c.k === k)),
    `the creatures as ${cards.out.length} cards under Monsters, shown with Monster mode off, each with its picture: ${cards.out.map(c => c.label + (c.pic ? "" : " (NO PICTURE)")).join(", ")}`);
  const card = async (k, look = true, face = false) => {   // (the two switches are read when a card is clicked)
    await B(([k, look, face]) => { document.querySelector("#creatureLook").checked = look; document.querySelector("#creatureFace").checked = face; document.querySelector(`#creatureCards .card[data-creature="${k}"]`).click(); }, [k, look, face]);
    await page.waitForTimeout(2500); };
  const worn = () => B(() => { const b = window.__body, s = b.st; return { monster: s.monster, creature: s.creature, on: [...document.querySelectorAll("#creatureCards .card.on")].map(c => c.dataset.creature), box: document.querySelector("#monsterOn").checked,
    tone: s.skin.tone, proc: !!s.skin.proc.on, sclera: s.eyes.sclera, pupilShape: s.eyes.pupilShape, lips: s.lips.on ? s.lips.color : null, horns: s.accessories.filter(a => a.kind === "horns").map(a => a.style),
    height: s.height, base: s.base, sculpt: { ...s.sculpt }, shape: [...s.shape].filter(Boolean).length, fangs: s.teeth.fangs, age: s.age.age }; });
  const M = await B(() => window.__body.GW.MONSTERS), plain = await worn();
  await age(10); await card("demon");                    // on a ten-year-old, Monster mode off: the whole creature, an adult again
  const demon = await worn(), dm = M.demon;
  say(demon.monster && demon.box && demon.creature === "demon" && demon.on.join() === "demon" && demon.age === 18 && demon.height === dm.height && demon.sculpt.horn_brow === dm.sculpt.horn_brow,
    `a card clicked with Monster mode off switches it on and makes the character that creature (the demon: ${demon.height} m, an adult again from ten, its card marked)`);
  say(demon.tone === dm.look.tone && demon.proc && demon.sclera === dm.look.eyes.set.sclera && demon.pupilShape === "slit" && demon.horns.join() === dm.look.horns.style && demon.fangs === dm.teeth.fangs,
    `with its look: the skin ${demon.tone}, drawn by the procedural skin, a slit pupil in a dark eye, ${demon.horns.join()} horns, its fangs`);
  await card("goblin");
  const gob = await worn();
  say(gob.creature === "goblin" && gob.on.join() === "goblin" && gob.tone === M.goblin.look.tone && !gob.horns.length && gob.height === M.goblin.height, `another card takes its place whole: the goblin's skin ${gob.tone}, the demon's horns gone, ${gob.height} m`);
  await card("ogre", false);
  const ogre = await worn();
  say(ogre.creature === "ogre" && ogre.height === M.ogre.height && ogre.tone === gob.tone && ogre.sclera === gob.sclera && ogre.fangs === (M.ogre.teeth?.fangs || 0), `"With its look" off: the ogre's shape and teeth (${ogre.height} m) on the skin and eyes the character had`);
  await card("alien", true, true);
  const head = await worn(), isHead = await B(() => { const b = window.__body; return Object.fromEntries(b.SCULPT.controls.map(c => [c.id, b.GW.onHead(c)])); });
  const bodyKept = Object.keys({ ...ogre.sculpt, ...head.sculpt }).filter(id => !isHead[id]).every(id => (head.sculpt[id] || 0) === (ogre.sculpt[id] || 0));
  const headSet = Object.entries(M.alien.sculpt).filter(([id]) => isHead[id]).every(([id, v]) => head.sculpt[id] === v) && Object.keys(head.sculpt).filter(id => isHead[id]).every(id => id in M.alien.sculpt);
  say(head.creature === "alien" && head.height === ogre.height && head.base === ogre.base && head.shape === ogre.shape && bodyKept && headSet && head.tone === M.alien.look.tone,
    `"Face only": the grey alien's head and look on the ogre's body (${head.height} m still, its build and its body's sliders as they were, the face's ${Object.keys(M.alien.sculpt).filter(id => isHead[id]).length} the alien's)`);
  // every creature whole: a body at its own height, its feet on the floor, its fangs when it has them, its look's names real
  const names = await B(() => { const b = window.__body, bad = [];
    for (const [k, m] of Object.entries(b.GW.MONSTERS)) { const L = m.look || {};
      if (L.skin?.preset && !b.SKINSH.SKIN_PRESETS[L.skin.preset]) bad.push(`${k}: no skin preset "${L.skin.preset}"`);
      for (const id of Object.keys(L.skin?.tweak || {})) if (!(id in b.st.skin.proc)) bad.push(`${k}: the skin has no "${id}"`);
      if (L.eyes?.style && !b.EYEPAINT.EYE_STYLES.some(x => x[0] === L.eyes.style)) bad.push(`${k}: no eye style "${L.eyes.style}"`);
      for (const id of Object.keys(L.eyes?.set || {})) if (!(id in b.st.eyes)) bad.push(`${k}: the eyes have no "${id}"`);
      for (const id of Object.keys(L.lips || {})) if (!(id in b.st.lips)) bad.push(`${k}: the lips have no "${id}"`);
      for (const id of Object.keys({ ...(L.teeth || {}), ...(m.teeth || {}) })) if (!(id in b.st.teeth)) bad.push(`${k}: the teeth have no "${id}"`);
      if (L.horns && !b.ACCS.HN.HORNS[L.horns.style]) bad.push(`${k}: no horns "${L.horns.style}"`);
    } return bad; });
  say(!names.length, names.length ? `a look names what isn't there: ${names.join("; ")}` : "every look's names are the page's own (its skin preset and sliders, its eye style and settings, its lips, teeth and horns)");
  const creatures = [];
  for (const { k, label } of cards.out) {
    await card(k);
    const r = await body(), t = await B(() => { const b = window.__body, g = b.MOUTH.parts["upper-teeth"].geometry.attributes.position.array; let lo = 1e9; for (let i = 1; i < g.length; i += 3) lo = Math.min(lo, g[i]); return { fang: lo, teeth: b.st.teeth.fangs, moved: Object.keys(b.st.sculpt).length, creature: b.st.creature, tone: b.st.skin.tone }; });
    creatures.push({ name: label, ok: !r.nan && Math.abs(r.hi - r.height) < 0.01 && Math.abs(r.lo) < 0.002 && t.moved > 8 && (t.teeth ? t.fang < -2 : t.fang > -1) && t.creature === k && t.tone === M[k].look.tone, h: r.height, heads: 1 / r.head });
  }
  say(creatures.every(c => c.ok), `each a whole body at its own height, its feet on the floor, its fangs when it has them, in its own skin: ${creatures.map(c => `${c.name} ${c.h} m, ${c.heads.toFixed(1)} heads${c.ok ? "" : " (BAD)"}`).join("; ")}`);
  // saved with the character and marked when it's opened again
  await card("imp");
  await B(() => { document.querySelector("#status").textContent = ""; }); await page.click("#save");
  await page.waitForFunction(() => /saved/.test(document.querySelector("#status").textContent), null, { timeout: 60000 });
  const kept = await B(async n => (await fetch(`api/people/${n}`)).json(), NAME);
  await page.reload(); await page.waitForFunction(() => window.__body && window.__body.SCULPT, null, { timeout: 180000 });
  await page.selectOption("#who", NAME);
  await page.waitForFunction(n => window.__body.who === n && /points/.test(document.querySelector("#hud").textContent), NAME, { timeout: 180000 }); await page.waitForTimeout(4000);
  await B(() => { const b = window.__body; b.setPose("rest"); document.querySelector("#handlesOn").checked = false; });
  const imp = await worn();
  say(kept.creature === "imp" && kept.monster === true && imp.creature === "imp" && imp.on.join() === "imp" && imp.tone === M.imp.look.tone && imp.horns.join() === M.imp.look.horns.style && imp.height === M.imp.height,
    `saved with the character and opened again: the imp (${imp.height} m, its skin, its ${imp.horns.join()} horns), its card marked`);

  // ---- monster mode's reach
  const mon = await B(() => ({ max: +document.querySelector("#sculptRows input").max, creature: [...document.querySelectorAll("#sculptRows details")].find(d => d.querySelector("summary").textContent === "Creature")?.hidden,
    hi: +document.querySelector("#baseRows .row:last-child input").max, lo: +document.querySelector("#baseRows .row:last-child input").min }));
  say(mon.max === 3 && mon.creature === false && mon.hi === 3.5 && mon.lo === 0.4, `monster mode: the sculpt's sliders to ±3, the Creature controls shown, the height ${mon.lo} to ${mon.hi} m`);
  await tog("#monsterOn", false); await page.waitForTimeout(1500);
  const person = await B(() => { const b = window.__body, s = b.st; return { monster: s.monster, most: Math.max(0, ...Object.values(s.sculpt).map(Math.abs)), creature: ["eye_tilt", "ears_point", "snout", "skull_back", "hunch"].map(k => s.sculpt[k] || 0).some(Boolean), h: s.height, max: +document.querySelector("#sculptRows input").max,
    was: s.creature, on: document.querySelectorAll("#creatureCards .card.on").length }; });
  say(!person.monster && person.most <= 1 && !person.creature && person.h >= 1.1 && person.h <= 2.1 && person.max === 1 && !person.was && !person.on, `leaving monster mode: every slider back within a person's range (the most ${person.most}), the creature's own at 0, ${person.h} m, no card marked`);
  // (a person again for what follows: the look the cards put on taken off as New would have it)
  await B(plain => { const b = window.__body; b.st.accessories = b.st.accessories.filter(a => a.kind !== "horns"); b.creatureLook({ tone: plain.tone, teeth: { fangs: 0, points: 0 } }); }, plain);
  await B(() => { const b = window.__body; b.st.sculpt = {}; b.st.shape.fill(0); document.querySelector("#resetShape").click(); document.querySelector("#resetSculpt").click(); Object.assign(b.st.teeth, { fangs: 0, points: 0 }); document.querySelector('.bases button[data-base="-1"]').click(); });
  await age(18); await page.waitForTimeout(1500);

  // ---- horns and ears
  await page.click('#tabs button[data-tab="acc"]');
  const acc = await B(() => {
    const b = window.__body, W = b.WEAR, HN = b.ACCS.HN, out = { horns: [], ears: [] }, top = Math.max(...Array.from({ length: b.POS.length / 3 }, (_, i) => b.POS[i * 3 + 1]));
    const put = a => { b.st.accessories.length = 0; b.st.accessories.push(a); W.set(b.st.accessories); return W.made.get(a.id); };
    const box = m => { let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], nan = 0, tris = 0; for (const o of m.obj.children) { const p = o.geometry.attributes.position.array; tris += o.geometry.index.count / 3; for (let i = 0; i < p.length; i++) { if (!Number.isFinite(p[i])) nan++; lo[i % 3] = Math.min(lo[i % 3], p[i]); hi[i % 3] = Math.max(hi[i % 3], p[i]); } } return { lo, hi, nan, tris }; };
    for (const st of Object.keys(HN.HORNS)) { const a = b.ACCS.fresh("horns", st), m = put(a), x = box(m);
      out.horns.push({ st, n: m.obj.children.length, nan: x.nan, tris: x.tris, up: x.hi[1] - top, rigid: m.obj.children.every(o => o.userData.rigid === "c_head"), map: m.obj.children.every(o => o.material.map && o.material.normalMap), near: x.lo[1] > top - 0.2 && x.hi[1] < top + 0.4 });
      a.material = "gold"; W.update(); out.horns[out.horns.length - 1].metal = W.made.get(a.id).obj.children.length === m.obj.children.length && !W.made.get(a.id).obj.children[0].material.map; }
    for (const st of Object.keys(HN.EARS)) { const a = b.ACCS.fresh("ears", st), m = put(a), x = box(m), K = HN.EARS[st], j = m.obj.children.filter(o => o.userData.jiggle);
      const r = { st, n: m.obj.children.length, nan: x.nan, band: m.obj.children.some(o => o.name === "ear_band"), chains: new Set(j.map(o => o.userData.jiggle.name)).size, joints: j[0]?.userData.jiggle.joints.length, bones: K.bones, along: j.every(o => o.geometry.attributes.along), tag: m.obj.children.some(o => /ear_tag/.test(o.name)), tipY: Math.min(...j.map(o => o.userData.jiggle.joints.at(-1)[1])) };
      a.headband = false; W.update(); r.noBand = !W.made.get(a.id).obj.children.some(o => o.name === "ear_band");
      a.droop = 1; W.update(); r.flopY = Math.min(...W.made.get(a.id).obj.children.filter(o => o.userData.jiggle).map(o => o.userData.jiggle.joints.at(-1)[1])); out.ears.push(r); }
    return out;
  });
  say(acc.horns.length >= 13 && acc.horns.every(h => h.n >= 1 && !h.nan && h.rigid && h.map && h.near && h.metal), `${acc.horns.length} kinds of horn, each on the head with no NaN, its own colour and relief drawn (or a metal's), whole on the head's bone in a file: ${acc.horns.map(h => `${h.st} ${Math.round(h.tris / 100) / 10}k`).join(", ")}`);
  const tall = acc.horns.find(h => h.st === "demon"), small = acc.horns.find(h => h.st === "stubs");
  say(tall.up > 0.1 && small.up < 0.05 && small.up > -0.03, `the great horns stand ${(tall.up * 100).toFixed(0)} cm over the crown, the stubs ${(small.up * 100).toFixed(1)} cm`);
  say(acc.ears.length >= 13 && acc.ears.every(e => e.n >= 5 && !e.nan && e.band && e.noBand && e.chains === 2 && e.joints === e.bones + 1 && e.along), `${acc.ears.length} kinds of ear, each a pair on a headband (or without it, from the head), a chain of joints each from root to tip: ${acc.ears.map(e => `${e.st} ${e.bones}`).join(", ")}`);
  const cow = acc.ears.find(e => e.st === "cow"), cat = acc.ears.find(e => e.st === "cat");
  say(cow.tag && !cat.tag && cat.flopY < cat.tipY - 0.01, `a cow's ear tagged; Flop takes an upright ear's tip down (a cat's ${((cat.tipY - cat.flopY) * 100).toFixed(1)} cm)`);

  // ---- the export: the ears' chains in the file
  if (!QUICK) {
    await B(() => { const b = window.__body, W = b.WEAR; b.st.accessories.length = 0; b.st.accessories.push(b.ACCS.fresh("ears", "cow"), b.ACCS.fresh("horns", "bull")); W.set(b.st.accessories); });
    await age(9); await page.waitForTimeout(2000);
    await B(() => { document.querySelector("#status").textContent = ""; }); await page.click("#expPack");
    await page.waitForFunction(n => new RegExp(`wrote People/${n}/export/${n}\\.glb`).test(document.querySelector("#status").textContent) || document.querySelector("#status").className === "bad", NAME, { timeout: 900000 });
    const st = await B(() => document.querySelector("#status").textContent);
    const file = await B(async n => {
      const buf = await (await fetch(`api/package/${n}/${n}.glb`)).arrayBuffer(), dv = new DataView(buf), J = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, dv.getUint32(12, true))));
      const nodes = J.nodes || [], idx = new Map(nodes.map((x, i) => [x.name, i])), parentOf = new Map(); nodes.forEach((x, i) => (x.children || []).forEach(c => parentOf.set(c, i)));
      const chain = side => { const out = []; let at = idx.get(`jiggle_ear_${side}_0`); while (at !== undefined) { out.push(nodes[at].name); at = (nodes[at].children || []).find(c => /^jiggle_ear_/.test(nodes[c].name)); } return out; };
      const skin = (J.skins || [])[0] || { joints: [] }, joint = new Set(skin.joints.map(i => nodes[i].name));
      // the ears' meshes: which joints their points are weighted to (the accessor's bytes read)
      const bin = 20 + dv.getUint32(12, true) + 8, used = name => { const nd = nodes.find(x => x.name === name), out = new Set(); if (!nd || nd.mesh === undefined) return null;
        for (const p of J.meshes[nd.mesh].primitives) { const a = J.accessors[p.attributes.JOINTS_0], v = J.bufferViews[a.bufferView], o = bin + (v.byteOffset || 0) + (a.byteOffset || 0), n16 = a.componentType === 5123, st = v.byteStride || (n16 ? 8 : 4);
          const wa = J.accessors[p.attributes.WEIGHTS_0], wv = J.bufferViews[wa.bufferView], wo = bin + (wv.byteOffset || 0) + (wa.byteOffset || 0), ws = wv.byteStride || 16;
          for (let i = 0; i < a.count; i++) for (let k = 0; k < 4; k++) if (dv.getFloat32(wo + i * ws + k * 4, true) > 0.01) out.add(nodes[skin.joints[n16 ? dv.getUint16(o + i * st + k * 2, true) : dv.getUint8(o + i * st + k)]].name); }
        return [...out]; };
      return { L: chain("L"), R: chain("R"), parentL: nodes[parentOf.get(idx.get("jiggle_ear_L_0"))]?.name, inSkin: ["jiggle_ear_L_0", "jiggle_ear_R_0", "jiggle_ear_L_tip"].every(n => joint.has(n)), joints: skin.joints.length,
               earL: used("ear_L"), earInner: used("ear_inner_L"), tag: used("ear_tag_L"), band: used("ear_band"), horn: used("horn_bull"), extras: nodes.find(x => x.name === "ear_L")?.extras, scene: (J.scenes || [])[0]?.extras?.jiggle,
               face: nodes.find(x => x.extras && x.extras.studioScale)?.extras.studioScale, scale: window.__body.scale, tall: window.__body.st.height / (() => { const P = window.__body.BASEP; let lo = 1e9, hi = -1e9; for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); } return hi - lo; })() };
    }, NAME);
    say(/wrote People/.test(st) && file.L.length === 4 && file.R.length === 4 && file.L.at(-1) === "jiggle_ear_L_tip" && file.parentL === "c_head" && file.inSkin, `Export for Godot: each cow's ear a chain of bones under the head in the file (${file.L.join(" > ")}), in the skeleton with MHR's (${file.joints} joints)`);
    say(file.earL && file.earL.length >= 2 && file.earL.every(n => /^jiggle_ear_L_\d$/.test(n)) && file.earInner?.every(n => /^jiggle_ear_L_\d$/.test(n)) && file.tag?.every(n => /^jiggle_ear_L_\d$/.test(n)), `the ear, its inside and its tag skinned to that chain alone (${(file.earL || []).join(", ")})`);
    say(file.band?.length === 1 && file.band[0] === "c_head" && file.horn?.length === 1 && file.horn[0] === "c_head", "the headband and the horns whole on the head's bone");
    say(file.extras?.jiggle?.chain === "jiggle_ear_L" && file.extras.jiggle.soft > 0 && Array.isArray(file.scene) && file.scene.length === 2, `each chain's softness written with the ear (${JSON.stringify(file.extras?.jiggle)})`);
    say(Math.abs((file.face || 0) - file.scale) < 1e-5 && Math.abs(file.face / file.tall - 1) > 0.1, `the head's scale written with the skin (studioScale ${(+file.face || 0).toFixed(3)}: what the 72 face shapes' moves are times on this head; the body's height over MHR's, which a reader went by before, is ${file.tall.toFixed(3)} on a nine-year-old)`);
    const g = spawnSync("godot", ["--version"], { encoding: "utf8" });
    if (g.status === 0) {
      const r = spawnSync("python3", [path.join(ROOT, "tools", "godot", "jiggle_check.py"), "--person", NAME], { encoding: "utf8", timeout: 900000 });
      const lines = (r.stdout || "").trim().split("\n"); for (const l of lines.filter(l => /BAD|ears|chain|jerk|settle/.test(l))) console.log("     " + l);
      say(/JIGGLE ok/.test(r.stdout || ""), "in Godot the export's ears flop and settle (JIGGLE on it)");
    } else console.log("  --  no godot on this machine: python tools/godot/jiggle_check.py --person _growtest tries the export's ears there");
  }
  if (shot) await page.screenshot({ path: shot });
  say(!errs.length, "no page errors" + (errs.length ? ": " + errs.slice(0, 3).join(" | ") : ""));
} catch (e) {
  await page.screenshot({ path: shot || "growpagetest_fail.png" }).catch(() => null);
  console.log("GROWPAGE FAIL: " + e.message + (errs.length ? "\n  page: " + errs.slice(0, 4).join(" | ") : "")); await browser.close(); process.exit(1);
}
await browser.close();
if (bad.length) { console.log(`GROWPAGE FAIL: ${bad.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`); process.exit(1); }
console.log(`GROWPAGE ok (${((Date.now() - t0) / 1000).toFixed(0)} s)`);

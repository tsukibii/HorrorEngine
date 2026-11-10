// GROWPAGE: the Character Studio's ages, Cutify, monster mode, horns and animal ears, driven in a headless browser on a
// scratch character (_growtest; DECISIONS 2026-11-10, night). An eight-year-old: the height the age's average, the
// head its share of it, the feet on the floor, the eyes in a head nine tenths an adult's; the T-pose on a child; a front
// picture (the page's own head: no one's photo) still bends the face and nothing under the neck, and Young face turned
// down leaves the body's proportions; Cutify grows the eyes and shortens the face, and off it's as it was; saved and
// opened again the same; monster mode: the sliders to ±3, the Creature controls, the height to 3.5 m, every creature
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
try {
  await page.goto(URL);
  await page.waitForFunction(() => window.__body && window.__body.N > 10000 && window.__body.SCULPT, null, { timeout: 180000 });
  await B(n => Promise.all(["front", "side"].map(s => fetch(`api/picture/${n}/${s}/png`, { method: "POST", body: "" })).concat(fetch(`api/people/${n}/face.bin`, { method: "POST", body: "" }))), NAME);
  await page.fill("#newName", NAME); await page.click("#make");
  await page.waitForFunction(n => window.__body.who === n && /starts from the/.test(document.querySelector("#status").textContent), NAME, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await B(() => { const b = window.__body; b.setPose("rest"); document.querySelector('.bases button[data-base="0"]').click(); document.querySelector("#handlesOn").checked = false; });
  await page.waitForTimeout(1500);

  // ---- the adult, then eight
  const adult = await body(), ui = await B(() => ({ age: !!document.querySelector("#ageRows input"), out: document.querySelector("#ageRows output").textContent, min: +document.querySelector("#baseRows .row:last-child input").min, st: window.__body.st.age }));
  say(ui.age && ui.out === "adult" && ui.st.age === 18 && ui.min <= 1.1 && Math.abs(adult.head - 0.1248) < 0.004, `a new character is an adult as before (the head ${(1 / adult.head).toFixed(2)} to the height); the height's slider goes down to ${ui.min} m`);
  await age(8); await page.waitForTimeout(2500);
  const kid = await body();
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
  await B(() => { document.querySelector("#status").textContent = ""; }); await page.click("#save");
  await page.waitForFunction(() => /saved/.test(document.querySelector("#status").textContent), null, { timeout: 60000 });
  const saved = await B(async n => (await fetch(`api/people/${n}`)).json(), NAME);
  say(saved.age?.age === 10 && saved.cute?.on === true && saved.monster === false && saved.height === 1.39, `saved with the character: age ${saved.age?.age}, Cutify ${saved.cute?.on ? "on" : "off"} at ${saved.cute?.amount}, ${saved.height} m`);
  await page.reload(); await page.waitForFunction(() => window.__body && window.__body.SCULPT, null, { timeout: 180000 });
  await page.selectOption("#who", NAME);
  await page.waitForFunction(n => window.__body.who === n && /points/.test(document.querySelector("#hud").textContent), NAME, { timeout: 180000 }); await page.waitForTimeout(4000);
  const again = await B(() => ({ st: window.__body.st.age, cute: window.__body.st.cute, out: document.querySelector("#ageRows output").textContent, on: document.querySelector("#cuteOn").checked, h: window.__body.st.height }));
  say(again.st.age === 10 && again.cute.on && again.out === "10" && again.on && again.h === 1.39, "opened again the same (age 10, Cutify on)");
  await age(18); await tog("#cuteOn", false); await B(() => { document.querySelector("#handlesOn").checked = false; window.__body.setPose("rest"); });

  // ---- monster mode
  await tog("#monsterOn", true); await page.waitForTimeout(800);
  const mon = await B(() => ({ max: +document.querySelector("#sculptRows input").max, creature: [...document.querySelectorAll("#sculptRows details")].find(d => d.querySelector("summary").textContent === "Creature")?.hidden,
    hi: +document.querySelector("#baseRows .row:last-child input").max, lo: +document.querySelector("#baseRows .row:last-child input").min, chips: document.querySelectorAll("#monsterChips button").length, rows: !document.querySelector("#monsterRows").hidden }));
  say(mon.max === 3 && mon.creature === false && mon.hi === 3.5 && mon.lo === 0.4 && mon.chips >= 7 && mon.rows, `monster mode: the sculpt's sliders to ±3, the Creature controls shown, the height ${mon.lo} to ${mon.hi} m, ${mon.chips} creatures to start from`);
  const creatures = [];
  for (const name of await B(() => [...document.querySelectorAll("#monsterChips button")].map(b => b.textContent))) {
    await B(n => [...document.querySelectorAll("#monsterChips button")].find(b => b.textContent === n).click(), name); await page.waitForTimeout(2500);
    const r = await body(), t = await B(() => { const b = window.__body, g = b.MOUTH.parts["upper-teeth"].geometry.attributes.position.array; let lo = 1e9; for (let i = 1; i < g.length; i += 3) lo = Math.min(lo, g[i]); return { fang: lo, teeth: b.st.teeth.fangs, moved: Object.keys(b.st.sculpt).length }; });
    creatures.push({ name, ok: !r.nan && Math.abs(r.hi - r.height) < 0.01 && Math.abs(r.lo) < 0.002 && t.moved > 8 && (t.teeth ? t.fang < -2 : t.fang > -1), h: r.height, heads: 1 / r.head });
  }
  say(creatures.every(c => c.ok), `each a whole body at its own height, its feet on the floor, its fangs when it has them: ${creatures.map(c => `${c.name} ${c.h} m, ${c.heads.toFixed(1)} heads${c.ok ? "" : " (BAD)"}`).join("; ")}`);
  await tog("#monsterOn", false); await page.waitForTimeout(1500);
  const person = await B(() => { const b = window.__body, s = b.st; return { monster: s.monster, most: Math.max(0, ...Object.values(s.sculpt).map(Math.abs)), creature: ["eye_tilt", "ears_point", "snout", "skull_back", "hunch"].map(k => s.sculpt[k] || 0).some(Boolean), h: s.height, max: +document.querySelector("#sculptRows input").max }; });
  say(!person.monster && person.most <= 1 && !person.creature && person.h >= 1.1 && person.h <= 2.1 && person.max === 1, `leaving monster mode: every slider back within a person's range (the most ${person.most}), the creature's own at 0, ${person.h} m`);
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

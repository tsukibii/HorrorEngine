// HAIR2PAGE: the Character Studio's Hair editor v2.0 tab, driven in a headless browser on a scratch character
// (_hair2test; docs/HAIR_V2.md). The tab and its cards there; a style clicked: the hair made by the worker and drawn on
// the character's head (its points within the head's reach, nothing NaN, as many triangles as the detail allows), the
// salon's hair hidden; a slider dragged: a draft at once and the finished hair after, the row marked as moved, what
// differs kept beside the style's name; the hairline's dropdown: fewer pores growing; a fringe's kind bringing its own
// numbers; Undo; a tied style: its tails with the joints of a chain, its ties; a short style: shells; Show the pores;
// saved with the character and opened again the same; the body changed (the height): the hair made again on it, still
// on the head; with EXPORT=1, Export for Godot: the file carries hair_static with its tangents, second UVs and the
// bake's record, the scalp's texture, a tail skinned to its own chain of bones under the head.
// Ends "HAIR2PAGE ok". The Character Studio's server running (BODY_URL for another port).
//   node tools/character/hair2pagetest.mjs [--out DIR]      (--out: pictures of the tab kept there)
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const URL = process.env.BODY_URL || "http://127.0.0.1:8793/", NAME = "_hair2test", EXPORT = !!process.env.EXPORT;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const oi = process.argv.indexOf("--out"), OUT = oi > 0 ? process.argv[oi + 1] : null; if (OUT) fs.mkdirSync(OUT, { recursive: true });
const browser = await req("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1300, height: 860 } })).newPage(); page.setDefaultTimeout(180000);
const click0 = page.click.bind(page); page.click = (s, o) => click0(s, { noWaitAfter: true, ...o });
const errs = [], bad = [], t0 = Date.now();
page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
const say = (ok, what) => { console.log((ok ? "  ok  " : "  BAD ") + what); if (!ok) bad.push(what); };
const B = (f, a) => page.evaluate(f, a);
const shot = async name => { if (OUT) await page.screenshot({ path: path.join(OUT, name + ".png") }); };
// the hair as it's drawn: its meshes by name with their triangles, how far its points are from the head's middle, NaN
const hair = () => B(() => {
  const b = window.__body, H = b.hair2, G = H.group, T = b.THREE, out = { on: H.worn(), visible: G.visible, meshes: {}, nan: 0, far: 0, state: H.state, salon: b.salonHair ? b.salonHair.visible : null };
  b.rig.updateMatrixWorld(true); G.updateMatrixWorld(true);
  const head = b.headBase, v = new T.Vector3(), toRig = new T.Matrix4().copy(b.rig.matrixWorld).invert();
  G.traverse(o => {
    if (!o.isMesh && !o.isPoints) return;
    const P = o.geometry.attributes.position; let far = 0, lo = 1e9, hi = -1e9;
    for (let i = 0; i < P.count; i += 7) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld).applyMatrix4(toRig); if (!Number.isFinite(v.x + v.y + v.z)) out.nan++; far = Math.max(far, Math.hypot(v.x - head.C[0], v.y - head.C[1], v.z - head.C[2])); lo = Math.min(lo, v.y - head.C[1]); hi = Math.max(hi, v.y - head.C[1]); }
    out.far = Math.max(out.far, far);
    out.meshes[o.name] = { tris: o.geometry.index ? o.geometry.index.count / 3 : 0, points: P.count, far, lo, hi, visible: o.visible, jiggle: o.userData.jiggle ? o.userData.jiggle.joints.length : 0, rigid: o.userData.rigid || null, attrs: Object.keys(o.geometry.attributes).sort().join(",") };
  });
  return out;
});
const settled = () => page.waitForFunction(() => { const s = window.__body.hair2.state; return !s.on || (s.shownSeq === s.seq && !s.draft && s.stats) || s.failed; }, null, { timeout: 180000 });
const slide = (label, v, commit = true) => B(([label, v, commit]) => { const r = [...document.querySelectorAll("#hair2Rows .row")].find(x => x.firstChild.textContent === label), i = r.querySelector("input"); i.value = v; i.oninput(); if (commit) i.onchange(); return +i.value; }, [label, v, commit]);
const pick = (label, v) => B(([label, v]) => { const r = [...document.querySelectorAll("#hair2Rows .pick")].find(x => x.firstChild.textContent === label), s = r.querySelector("select"); s.value = v; s.onchange(); }, [label, v]);
const card = id => B(id => document.querySelector(`#hair2Grid .card[data-style="${id}"]`).click(), id);
try {
  await page.addInitScript(() => { window.__plainNew = true; });   // (a new character from MHR's plain halfway base, as this was written on: not the Studio's own start, grow.js NEW_START)
  await page.goto(URL);
  await page.waitForFunction(() => window.__body && window.__body.N > 10000 && window.__body.hair2, null, { timeout: 180000 });
  await page.fill("#newName", NAME); await page.click("#make");
  await page.waitForFunction(n => window.__body.who === n && /starts from the/.test(document.querySelector("#status").textContent), NAME, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await B(() => { window.__body.setPose("rest"); });
  await page.click('#tabs button[data-tab="hair2"]'); await page.waitForTimeout(600);
  const ui = await B(() => ({ shown: !document.querySelector('aside section[data-tab="hair2"]').hidden, cards: document.querySelectorAll("#hair2Grid .card").length, rows: document.querySelectorAll("#hair2Rows .row").length, picks: document.querySelectorAll("#hair2Rows .pick").length, sections: document.querySelectorAll("#hair2Rows details").length, worn: window.__body.hair2.worn() }));
  say(ui.shown && ui.cards >= 30 && ui.rows > 70 && ui.picks >= 12 && ui.sections === 9 && !ui.worn, `the tab: ${ui.cards} styles as cards, ${ui.sections} sections with ${ui.rows} sliders and ${ui.picks} dropdowns; a new character wears none`);

  // ---- a style: the bob
  await card("bob_middle"); await settled();
  let h = await hair();
  const cards = h.meshes.hair_static, st = h.state.stats;
  say(h.on && h.visible && cards && cards.tris > 8000 && cards.tris < 30000 && !h.nan && h.far < 0.32 && h.meshes.hair_scalp && /aDepth,aTangent,aTint/.test(cards.attrs) && /tangent/.test(cards.attrs) && /uv1/.test(cards.attrs),
    `a card clicked: the bob made in ${Math.round(st.total)} ms and drawn on the head (${st.cards} locks, ${cards.tris} triangles, none further than ${(h.far * 100).toFixed(0)} cm from the head's middle), its scalp painted under it`);
  say(st.covered > 0.93, `the scalp ${(st.covered * 100).toFixed(1)}% covered`);
  await shot("bob");

  // ---- a slider: a draft at once, the finished hair after; the row marked, what differs kept
  const before = cards.lo; await slide("Line height", -16);
  await settled(); h = await hair();
  const rec = await B(() => window.__body.hair2.record()), moved = await B(() => [...document.querySelectorAll("#hair2Rows .row.moved")].map(r => r.firstChild.textContent));
  say(h.meshes.hair_static.lo < before - 0.04 && rec.style === "bob_middle" && rec.set.cut && Math.abs(rec.set.cut.line + 0.16) < 1e-6 && Object.keys(rec.set).length === 1 && moved.includes("Line height"),
    `the Line height slider to -16 cm: the hair ${((before - h.meshes.hair_static.lo) * 100).toFixed(1)} cm longer, the row marked, and the character keeps the style's name and {cut: {line}} beside it`);
  // (the engine's own time is what's held: the page's frames are drawn on the CPU here, and a worker's answer waits for them)
  const tD = await B(async () => { const H = window.__body.hair2, r = [...document.querySelectorAll("#hair2Rows .row")].find(x => x.firstChild.textContent === "Volume, sides"), i = r.querySelector("input"), t = performance.now(); i.value = 20; i.oninput();
    while (window.__body.hair2.state.shownSeq < window.__body.hair2.state.seq) await new Promise(ok => setTimeout(ok, 10)); const draft = performance.now() - t, wasDraft = H.state.draft, made = H.state.stats.total; i.onchange();
    while (!(H.state.shownSeq === H.state.seq && !H.state.draft)) await new Promise(ok => setTimeout(ok, 10)); return { draft, wasDraft, made, full: performance.now() - t, fullMade: H.state.stats.total }; });
  say(tD.wasDraft && tD.made < 1500 && tD.fullMade < 3000, `a slider dragged: a draft made in ${Math.round(tD.made)} ms (on screen ${Math.round(tD.draft)} ms after the drag began), the finished hair in ${Math.round(tD.fullMade)} ms (${Math.round(tD.full)} ms after)`);

  // ---- the hairline's dropdown, a fringe's kind, Undo
  const p0 = h.state.stats.pores; await pick("Shape", "receding_3"); await settled(); h = await hair();
  say(h.state.stats.pores < p0 - 40, `the hairline's Shape to a far receded one: ${p0 - h.state.stats.pores} fewer pores grow`);
  await pick("Kind", "blunt"); await settled();
  const fr = await B(() => window.__body.hair2.settings.fringe);
  say(fr.kind === "blunt" && Math.abs(fr.amount - 0.85) < 1e-6 && Math.abs(fr.wispy - 0.25) < 1e-6, "a fringe's kind brings its own numbers (blunt: a full band, blunt ends)");
  await shot("fringe");
  await B(() => { const u = [...document.querySelectorAll("#hair2Rows .bar button")].find(b => b.textContent === "Undo"); u.click(); u.click(); }); await settled();
  const un = await B(() => window.__body.hair2.record());
  say(!un.set.fringe && !un.set.hairline && un.set.cut, "Undo twice: the fringe and the hairline as they were, the longer cut kept");

  // ---- tied hair: tails on chains, ties; short hair: shells; the pores
  await card("twin_tails_low"); await settled(); h = await hair();
  const tl = h.meshes.hair_tail_l, tr = h.meshes.hair_tail_r;
  say(tl && tr && tl.jiggle === 5 && tr.jiggle === 5 && /along/.test(tl.attrs) && h.meshes.tie_l && h.meshes.tie_r && h.meshes.tie_l.rigid === "c_head" && !h.nan,
    `low twin tails: two tails (${tl ? tl.tris : 0} and ${tr ? tr.tris : 0} triangles) each with a chain's five joints, two ties on the head`);
  await shot("twin_tails");

  // ---- a second colour: a split dye's locks carry two colours on their points over a flat atlas (the tab's own picture, not only a file's), and plain hair after it is one shade again
  const colours = () => B(() => {
    const G = window.__body.hair2.group, o = G.children.find(c => c.name === "hair_static"), P = o.geometry.attributes.position, C = o.geometry.attributes.color, U = o.material.uniforms; let l = 0, ln = 0, r = 0, rn = 0, grey = 0;
    for (let i = 0; i < P.count; i++) { const lum = 0.2126 * C.getX(i) + 0.7152 * C.getY(i) + 0.0722 * C.getZ(i); if (Math.abs(C.getX(i) - C.getY(i)) < 1e-6 && Math.abs(C.getY(i) - C.getZ(i)) < 1e-6) grey++; if (P.getX(i) > 0.02) { l += lum; ln++; } else if (P.getX(i) < -0.02) { r += lum; rn++; } }
    return { left: l / Math.max(1, ln), right: r / Math.max(1, rn), grey: grey / P.count, flat: U.rootC.value.equals(U.tipC.value), root: U.rootC.value.getHexString(), tip: U.tipC.value.getHexString() };
  });
  await card("adv_split_hime"); await settled();
  const dy = await colours();
  say(dy.left > dy.right * 4 && dy.flat && dy.grey < 0.9, `a split dye: her left's points ${(dy.left / Math.max(1e-6, dy.right)).toFixed(1)} times as bright as her right's, drawn over one flat colour (#${dy.tip}), ${(100 * (1 - dy.grey)).toFixed(0)}% of the points coloured`);
  await shot("split_dye");
  await card("long_straight"); await settled();
  const pl = await colours();
  say(pl.grey > 0.999 && !pl.flat, `plain hair after it: every point one shade again, the atlas its own roots and lengths (#${pl.root}, #${pl.tip})`);

  await card("m_buzz"); await settled(); h = await hair();
  say(h.meshes.hair_shell && h.meshes.hair_shell.tris > 2000 && !h.meshes.hair_static, `a buzz cut: shells alone (${h.meshes.hair_shell ? h.meshes.hair_shell.tris : 0} triangles), no cards`);
  await card("short_swept"); await settled();
  await B(() => [...document.querySelectorAll("#hair2Rows .bar button")].find(b => b.textContent === "Show the pores").click()); await settled(); h = await hair();
  say(h.meshes["hair2 pores"] && h.meshes["hair2 pores"].points > 600 && h.meshes.hair_static && !h.meshes.hair_static.visible, `Show the pores: ${h.meshes["hair2 pores"] ? h.meshes["hair2 pores"].points : 0} dots on the scalp, the locks hidden`);
  await shot("pores");
  await B(() => [...document.querySelectorAll("#hair2Rows .bar button")].find(b => b.textContent === "Show the pores").click()); await settled();

  // ---- saved with the character, opened again
  await card("bob_bangs"); await settled(); await slide("Waves", 6); await settled();
  const kept = await B(() => window.__body.hair2.record());
  await page.click("#save"); await page.waitForFunction(() => /saved/.test(document.querySelector("#status").textContent));
  const file = JSON.parse(fs.readFileSync(path.join(ROOT, "Content", "Studio", "People", NAME, "character.json"), "utf8"));
  say(file.hair2 && file.hair2.on && file.hair2.style === "bob_bangs" && Math.abs(file.hair2.set.texture.wave - 0.006) < 1e-9, "Save: the character's file keeps hair2 {on, style, set}");
  await page.reload(); await page.waitForFunction(() => window.__body && window.__body.hair2, null, { timeout: 180000 });
  await page.selectOption("#who", NAME); await page.waitForFunction(n => window.__body.who === n && window.__body.hair2.worn() && window.__body.hair2.state.stats, NAME, { timeout: 180000 }); await settled();
  h = await hair(); const again = await B(() => window.__body.hair2.record());
  say(h.on && h.visible && h.meshes.hair_static && JSON.stringify(again) === JSON.stringify(kept), "opened again: the same hair, worn");

  // ---- the body changed: the hair made again on it
  await page.click('#tabs button[data-tab="hair2"]');
  const y0 = await B(() => window.__body.hair2.group.matrix.elements[13]), s0 = h.state.seq;
  await B(() => { const i = document.querySelector("#baseRows .row:nth-child(2) input"); i.value = 1.5; i.oninput(); });
  await page.waitForFunction(s => window.__body.hair2.state.seq > s, s0, { timeout: 60000 }); await settled(); h = await hair();
  const y1 = await B(() => window.__body.hair2.group.matrix.elements[13]);
  say(Math.abs((y0 - y1) - 0.2 * (y0 / 1.7)) < 0.06 && h.far < 0.32 && !h.nan, `the height to 1.5 m: the hair made again on the smaller body, ${((y0 - y1) * 100).toFixed(0)} cm lower with the head`);
  await shot("child");

  if (EXPORT) {
    await card("twin_tails_low"); await settled();
    await page.click("#expPack"); await page.waitForFunction(() => /for Godot \(drag|couldn't|isn't made/.test(document.querySelector("#status").textContent), null, { timeout: 900000 });
    const f = path.join(ROOT, "Content", "Studio", "People", NAME, "export", `${NAME}.glb`), buf = fs.readFileSync(f), jl = buf.readUInt32LE(12), J = JSON.parse(buf.subarray(20, 20 + jl).toString("utf8"));
    const mesh = n => { const node = J.nodes.find(x => x.name === n); return node && J.meshes[node.mesh]; }, prim = n => mesh(n)?.primitives[0];
    const hs = prim("hair_static"), mat = hs && J.materials[hs.material], sc = prim("hair_scalp"), tlp = prim("hair_tail_l"), bones = J.nodes.filter(x => /^jiggle_hair_tail_l/.test(x.name || "")).map(x => x.name);
    say(hs && hs.attributes.TANGENT !== undefined && hs.attributes.TEXCOORD_1 !== undefined && hs.attributes.JOINTS_0 !== undefined && !Object.keys(hs.attributes).some(k => /^_A/.test(k)) && mat && mat.name === "hair_cards" && mat.extras && mat.extras.studioHair && mat.extras.studioHair.settings && mat.occlusionTexture && mat.alphaMode === "MASK",
      "Export for Godot: hair_static with its tangents, second UVs and skin weights, on the hair_cards material with the bake's record and the strands' texture");
    say(sc && J.materials[sc.material].pbrMetallicRoughness.baseColorTexture && J.materials[sc.material].alphaMode === "BLEND", "the painted scalp with its texture, blended");
    say(tlp && bones.length === 5 && bones.includes("jiggle_hair_tail_l_tip") && J.nodes.some(x => x.name === "tie_l"), `a tail skinned to its own chain (${bones.join(", ")}), the ties in the file`);
    const salon = J.nodes.some(x => /salon/.test(x.name || ""));
    say(!salon, "no salon hair in the file while this one is worn");
  }
  say(!errs.length, errs.length ? `page errors: ${errs.slice(0, 4).join(" | ")}` : "no page errors");
} catch (e) { say(false, `the test stopped: ${e.message.split("\n")[0]}`); if (errs.length) console.log(errs.slice(0, 6).join("\n")); }
await browser.close();
console.log(bad.length ? `HAIR2PAGE FAIL (${bad.length}) in ${((Date.now() - t0) / 1000).toFixed(0)} s` : `HAIR2PAGE ok (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(bad.length ? 1 : 0);

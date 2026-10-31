// The street builder in a headless browser (docs/STREET_BUILDER.md §6), driven as a person would: a lane drawn on the map,
// filled with buildings, lamps, poles and clutter; a building picked, its floors changed in the inspector, a sign added
// on its front in the facade view and a photo put behind it; a fence and a vending machine placed (the machine turned to
// the street); a shot kept; undo; saved and read back the same; the .glb exported; a motel and the Bungalow from the
// palette, the Bungalow wearing its set's outside (its own once changed here, the set's again on Follow); and the
// Shibuya lane drawn through its shot. Ends "STREETPAGE ok".
//
//   python tools/director/serve.py          (in another shell)
//   node tools/director/streettest.mjs [shots dir]
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const URL0 = process.env.DESK_URL || "http://127.0.0.1:8780/";
const NAME = "zz_street_test", shots = process.argv[2];
const fail = msg => { console.log("FAIL " + msg); process.exitCode = 1; };
const png = (W, H, rgb) => {                       // a picture of one colour (the photo put behind a building)
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) rgb.forEach((v, k) => { raw[y * (W * 3 + 1) + 1 + x * 3 + k] = v; });
  const crc = b => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c >>> 1 ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const td = Buffer.concat([Buffer.from(t), d]), l = Buffer.alloc(4), c = Buffer.alloc(4); l.writeUInt32BE(d.length); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};
const cleanup = () => { fs.rmSync(path.join(ROOT, "Content/Studio/Streets", NAME), { recursive: true, force: true }); fs.rmSync(path.join(ROOT, "Saved/Streets", NAME), { recursive: true, force: true }); };

const browser = await require("../browser.cjs").launch(chromium);
cleanup();
try {
  const made = await (await fetch(URL0 + `api/street/${NAME}/new`, { method: "POST", body: JSON.stringify({ street: { format: 1, name: NAME, roads: [], buildings: [], things: [], fences: [], shots: [] } }) })).json();
  if (!made.ok) throw new Error("couldn't make the scratch street: " + JSON.stringify(made));
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 }, acceptDownloads: true }), page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/favicon|WebGL|GPU stall/i.test(m.text())) errors.push(m.text()); });
  page.on("dialog", d => d.accept());
  await page.goto(URL0 + `street.html?street=${NAME}`);
  await page.waitForFunction(() => window.__streetReady && window.ST.name, null, { timeout: 120000 });
  const ST = () => page.evaluate(() => JSON.parse(JSON.stringify(window.ST.street)));
  const map = await page.locator("#map").boundingBox();
  const at = async (x, y) => page.evaluate(([x, y]) => { const v = window.ST.view, r = document.querySelector("#map").getBoundingClientRect(); return [(x - v.cx) * v.s + r.width / 2 + r.left, (v.cy - y) * v.s + r.height / 2 + r.top]; }, [x, y]);
  await page.evaluate(() => { window.ST.view = { cx: 0, cy: 0, s: 6 }; });

  // a lane drawn on the map, from its palette button: press, drag, let go
  await page.click("#left >> text=Lane");
  let [ax, ay] = await at(0, -30), [bx, by] = await at(0, 30);
  await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 4 }); await page.mouse.move(bx, by, { steps: 4 }); await page.mouse.up();
  let S = await ST();
  if (S.roads.length !== 1 || Math.abs(S.roads[0].to[1] - S.roads[0].from[1] - 60) > 1) fail("the lane wasn't drawn from end to end: " + JSON.stringify(S.roads));
  // filled: buildings both sides shoulder to shoulder, lamps, poles with wires, clutter
  await page.evaluate(() => { window.ST.sel = { list: "roads", id: window.ST.street.roads[0].id }; document.querySelector("#mix").value = "city"; });
  await page.click("#left >> text=Fill it all");
  S = await ST();
  const poles = S.things.filter(t => t.kind === "pole");
  console.log(`filled: ${S.buildings.length} buildings, ${S.things.length} things (${poles.length} poles)`);
  if (S.buildings.length < 6 || S.things.length < 8) fail(`the fill made too little: ${S.buildings.length} buildings, ${S.things.length} things`);
  if (poles.length > 1 && !poles.slice(0, -1).every(p => p.to)) fail("the poles aren't wired to each other");
  const sides = new Set(S.buildings.map(b => Math.sign(b.at[0] - S.roads[0].from[0])));
  if (sides.size !== 2) fail("the buildings went up on one side only");

  // a building picked on the map, its floors changed in the inspector
  const b0 = S.buildings[0];
  const [px, py] = await at(b0.at[0], b0.at[1]);
  await page.mouse.click(px, py);
  const picked = await page.evaluate(() => window.ST.sel && window.ST.sel.id);
  if (picked !== b0.id) fail(`clicking the building on the map picked ${picked}, not ${b0.id}`);
  const floorsInput = page.locator("#inspector .prop", { has: page.locator("label", { hasText: /^floors$/ }) }).locator("input").first();
  await floorsInput.fill(String(b0.floors + 2)); await floorsInput.dispatchEvent("input");
  S = await ST();
  if (S.buildings[0].floors !== b0.floors + 2) fail(`the floors field didn't change the building: ${S.buildings[0].floors}`);
  // the facade: a sign board clicked onto its front
  await page.mouse.dblclick(px, py);
  await page.waitForFunction(() => !document.querySelector("#facadeBox").hidden, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  await page.click("#facadeBar >> text=Sign board");
  const pv = await page.locator('.panel[data-panel="a"] .pview svg').boundingBox();
  await page.mouse.click(pv.x + pv.width / 2, pv.y + pv.height * 0.55);
  S = await ST();
  const sign = (S.buildings[0].parts || []).slice(-1)[0];
  if (!sign || sign.kind !== "sign" || sign.face !== "front" || !sign.text) fail("the sign wasn't added on the front: " + JSON.stringify(sign));
  // a photo behind its front (loaded from a file, as Paste photo does from the clipboard)
  const photo = path.join(ROOT, "Saved", "streettest_photo.png"); fs.mkdirSync(path.dirname(photo), { recursive: true }); fs.writeFileSync(photo, png(64, 48, [180, 120, 90]));
  await page.locator('.panel[data-panel="a"] .pfile').setInputFiles(photo);
  await page.waitForFunction(id => { const b = window.ST.street.buildings.find(x => x.id === id); return b && b.refs && b.refs.front; }, b0.id, { timeout: 10000 });
  S = await ST();
  const ref = S.buildings[0].refs.front;
  if (!fs.existsSync(path.join(ROOT, "Content/Studio/Streets", NAME, ref.file.split("?")[0]))) fail("the photo wasn't kept beside the street: " + ref.file);
  const shown = await page.waitForFunction(() => { const i = document.querySelector('.panel[data-panel="a"] img.ref'); return i.style.display !== "none" && i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 }).then(() => true, () => false);
  if (!shown) fail("the photo isn't shown behind the front");
  if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, "street_facade.png") }); }

  // back to the map: a fence dragged, a vending machine put by the lane (it turns to face it)
  await page.click("#tabMap");
  await page.click("#left >> text=Wire mesh");
  [ax, ay] = await at(-14, -26); [bx, by] = await at(-14, -18);
  await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, { steps: 5 }); await page.mouse.up();
  await page.click("#left >> text=Vending machine");
  const lane = S.roads[0], q = lane.from[0] + (lane.width / 2 + 1.0);
  [ax, ay] = await at(q, 2.3);
  await page.mouse.click(ax, ay);
  S = await ST();
  const fence = S.fences[0], vend = S.things.find(t => t.kind === "vending" && t.id.startsWith("vending") && Math.abs(t.at[1] - 2.3) < 0.6);
  if (!fence || fence.kind !== "mesh" || Math.abs(fence.to[1] - fence.from[1] - 8) > 0.6) fail("the fence wasn't dragged out: " + JSON.stringify(fence));
  if (!vend) fail("the vending machine wasn't put down by the lane");
  else if (Math.abs(((vend.turn % 360) + 360) % 360 - 270) > 1 && Math.abs(vend.turn + 90) > 1) fail(`the vending machine doesn't face the lane: turned ${vend.turn}`);
  // undo takes the machine back, redo brings it again
  const nThings = S.things.length;
  await page.keyboard.press("Escape"); await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press("Control+z");
  if ((await ST()).things.length !== nThings - 1) fail("undo didn't take the vending machine away");
  await page.keyboard.press("Control+y");
  if ((await ST()).things.length !== nThings) fail("redo didn't bring it back");
  // a shot from the 3D view
  await page.click("#addShot");
  S = await ST();
  if (S.shots.length !== 1 || !(await page.evaluate(() => window.ST.mode.startsWith("shot:")))) fail("+ Shot didn't keep the view and look through it");

  // saved, and read back the same
  await page.keyboard.press("Control+s");
  await page.waitForFunction(() => !window.ST.dirty, null, { timeout: 10000 });
  const disk = JSON.parse(fs.readFileSync(path.join(ROOT, "Content/Studio/Streets", NAME, "street.json"), "utf8"));
  if (JSON.stringify(disk) !== JSON.stringify(await ST())) fail("what was saved isn't what the page holds");
  await page.reload(); await page.waitForFunction(() => window.__streetReady && window.ST.name, null, { timeout: 120000 });
  if (JSON.stringify(await ST()) !== JSON.stringify(disk)) fail("the street read back isn't the one saved");
  // the .glb
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.click("#glb")]);
  const glb = fs.readFileSync(await dl.path());
  if (glb.readUInt32LE(0) !== 0x46546C67 || glb.length < 20000) fail(`the .glb isn't one (${glb.length} bytes)`);
  console.log(`saved and read back; .glb ${Math.round(glb.length / 1024)} KB`);

  // a street bent by its middle dot, then sloped in the inspector; a motel from the palette, its rooms its set's
  await page.click("#tabMap");
  await page.evaluate(() => { window.ST.view = { cx: 0, cy: 0, s: 6 }; window.ST.sel = { list: "roads", id: window.ST.street.roads[0].id }; window.__rebuild(); });
  await page.evaluate(() => document.querySelector("#map").dispatchEvent(new Event("pointerleave")));
  await page.waitForTimeout(200);
  const dot = await page.evaluate(() => { const c = document.querySelector('#map [data-handle="mid0"]'); if (!c) return null; const r = c.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  if (!dot) fail("a picked street has no dot in its middle to bend it by");
  else {
    await page.mouse.move(...dot); await page.mouse.down(); await page.mouse.move(dot[0] + 20, dot[1], { steps: 3 }); await page.mouse.move(dot[0] + 48, dot[1], { steps: 4 }); await page.mouse.up();
    S = await ST();
    const r0 = S.roads[0];
    if (!(Array.isArray(r0.via) && r0.via.length === 1 && Math.abs(r0.via[0][0] - r0.from[0]) > 5)) fail("dragging the street's middle dot didn't bend it there: " + JSON.stringify(r0.via));
    const rise = page.locator("#inspector .prop", { has: page.locator("label", { hasText: /^a slope$/ }) }).locator("input").first();
    await rise.fill("3"); await rise.dispatchEvent("input");
    S = await ST();
    const zs = S.roads[0].z || [];
    if (!(zs.length === 3 && Math.abs(zs[2] - zs[0] - 3) < 0.01 && zs[1] > zs[0] && zs[1] < zs[2])) fail("the slope didn't make the street climb 3 m: " + JSON.stringify(zs));
    else console.log(`bent and sloped: through ${JSON.stringify(S.roads[0].via[0])}, heights ${JSON.stringify(zs)}`);
  }
  if (fs.existsSync(path.join(ROOT, "Content/Studio/Sets/motel_room/story.json"))) {
    await page.click("#left >> text=Motel");
    const [mx, my] = await at(-40, 20); await page.mouse.click(mx, my);
    const synced = await page.waitForFunction(() => { const b = window.ST.street.buildings.find(b => b.style === "motel"); return b && b.inside.rooms.length ? b.id : null; }, null, { timeout: 20000 }).then(h => h.jsonValue(), () => null);
    if (!synced) fail("a motel from the palette didn't read its set's rooms");
    else {
      const glb = Buffer.from(await page.evaluate(() => window.__exportGodot()), "base64"), jl = glb.readUInt32LE(12), J = JSON.parse(glb.subarray(20, 20 + jl).toString("utf8"));
      const marks = J.nodes.filter(n => (n.name || "").startsWith("inside_" + synced));
      const motel = (await ST()).buildings.find(b => b.id === synced), want = (motel.inside.rows || 1) * (motel.inside.floors || 1);
      if (marks.length !== want || !marks.every(n => n.extras && n.extras.set === "motel_room")) fail(`the motel's export has ${marks.length} markers for its ${want} rooms`);
      else console.log(`a motel from the palette: ${motel.inside.rooms.length} rooms from its set, ${marks.length} markers in the .glb`);
    }
  }

  // a set's outside (the scene builder's Outside panel): the Bungalow from the palette wears its set's walls, roof and
  // fittings; changed in the street it keeps its own (Read the set again); Follow the set's outside takes it back
  const bset = path.join(ROOT, "Content/Studio/Sets/bungalow/story.json");
  const bOut = fs.existsSync(bset) ? Object.values(JSON.parse(fs.readFileSync(bset, "utf8")).levels)[0].outside : null;
  if (bOut) {
    await page.click("#left >> text=Bungalow");
    const [bx, by] = await at(30, -30); await page.mouse.click(bx, by);
    const bid = await page.waitForFunction(() => { const b = window.ST.street.buildings.find(b => b.style === "bungalow"); return b && b.inside.from ? b.id : null; }, null, { timeout: 20000 }).then(h => h.jsonValue(), () => null);
    const B0 = bid && (await ST()).buildings.find(b => b.id === bid);
    if (!B0 || B0.roof.kind !== bOut.roof.kind || (B0.parts || []).length !== (bOut.parts || []).length || B0.inside.raise !== bOut.raise) fail("the Bungalow from the palette doesn't wear its set's outside: " + JSON.stringify(B0 && { roof: B0.roof, parts: B0.parts, raise: B0.inside.raise }).slice(0, 300));
    else {
      await page.evaluate(id => { const b = window.ST.street.buildings.find(b => b.id === id); b.roof.pitch = 35; window.ST.sel = { list: "buildings", id }; window.__changed(); }, bid);
      await page.click("#inspector >> text=Read the set again");
      await page.waitForTimeout(400);
      const own = (await ST()).buildings.find(b => b.id === bid);
      await page.click("#inspector >> text=Follow the set's outside");
      await page.waitForTimeout(400);
      const back = (await ST()).buildings.find(b => b.id === bid);
      if (!own.inside.own || own.roof.pitch !== 35) fail("changed in the street, the Bungalow didn't keep its own outside: " + JSON.stringify({ own: own.inside.own, pitch: own.roof.pitch }));
      else if (back.inside.own || back.roof.pitch !== bOut.roof.pitch) fail("Follow the set's outside didn't take it back: " + JSON.stringify({ own: back.inside.own, pitch: back.roof.pitch }));
      else console.log(`the Bungalow wears its set's outside (${B0.roof.kind} roof, ${B0.parts.length} fittings, raised ${B0.inside.raise} m), keeps its own once changed here, follows the set again`);
    }
  }

  // the Shibuya lane through its shot: drawn, not blank, the road's paint where the photo has it
  if (fs.existsSync(path.join(ROOT, "Content/Studio/Streets/shibuya_lane/street.json"))) {
    await page.goto(URL0 + "street.html?street=shibuya_lane&shot=photo");
    await page.waitForFunction(() => window.__streetReady && window.ST.name === "shibuya_lane", null, { timeout: 120000 });
    const look = await page.evaluate(async () => {
      window.__shot("photo", 500, 750); await new Promise(r => setTimeout(r, 300)); window.__shot("photo", 500, 750);
      const gl = document.querySelector("#view canvas"), c = document.createElement("canvas"); c.width = 500; c.height = 750;
      const g = c.getContext("2d"); g.drawImage(gl, 0, 0, gl.width, gl.height, 0, 0, 500, 750);
      const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3));
      const d = g.getImageData(0, 0, 500, 750).data; let lo = 255, hi = 0; for (let i = 0; i < d.length; i += 4 * 97) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; lo = Math.min(lo, v); hi = Math.max(hi, v); }
      // the white line where the photo has it at its foot, and dark road a little right of it
      return { line: px(30, 742), road: px(130, 742), lo, hi };
    });
    const lum = c => (c[0] + c[1] + c[2]) / 3;
    console.log(`shibuya_lane through its shot: the white line ${lum(look.line).toFixed(0)}, the road beside it ${lum(look.road).toFixed(0)}, range ${look.lo.toFixed(0)}..${look.hi.toFixed(0)}`);
    if (look.hi - look.lo < 60) fail("the shot drew next to nothing");
    if (lum(look.line) < lum(look.road) + 40) fail("the white line isn't where the photo has it at the frame's foot");
  }
  if (errors.length) fail("page errors: " + [...new Set(errors)].slice(0, 5).join(" | "));
  fs.rmSync(photo, { force: true });
} catch (e) { fail(e.stack); }
finally { cleanup(); await browser.close(); }
if (!process.exitCode) console.log("STREETPAGE ok");

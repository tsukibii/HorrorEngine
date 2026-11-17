// CUTEEYE: the Cute eye switch in the Character Studio's own page (DECISIONS 2026-11-17, cuter eyes: "have a toggle
// button for this kind of eye called cute-eye"), on a scratch character (_cuteeyetest, as the Studio starts one), in a
// headless browser:
//   - the switch (Skin, Eyes) off on a new character, its opening level;
//   - clicked: the Cute eye shape key at 1 with a single lid (eyegraft.js CUTE_KEYS), the iris at least 36 degrees, Wet
//     eyes at 1, what the eyes were kept (st.eyes.cuteWas); the opening as the graft now has it measured against the
//     picture's outline (Content/Studio/Eyes/cute_outline.json): its outer corner as much higher as the picture's, its
//     points on the outline; the right eye the left mirrored;
//   - the Cute eye slider taken to 0 by hand: the switch shows off; back to 1: on;
//   - clicked again: the eyes as they were (the shape, the iris, dry), nothing kept;
//   - the Cute eye (wet) card (Face, Eye looks): the switch on with it, the card marked;
//   - saved: the character's file says the key, Wet eyes and the card.
//   node tools/character/cuteeyetest.mjs [--out DIR]     (--out: pictures of her left eye, both eyes and the face, off, on and with the card)
// The Character Studio's server running (python tools/character/serve.py; BODY_URL for another port). On a machine with
// a graphics card: GPU=1 in front (tools/browser.cjs). Ends "CUTEEYE ok".
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { register } from "module";
import { fileURLToPath, pathToFileURL } from "url";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."), URL = process.env.BODY_URL || "http://127.0.0.1:8793/";
// (eyegraft.js imports three.js by its bare name, as the pages' import maps give it: the vendored copy here)
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, n) { return s === "three" ? { url: ${JSON.stringify(pathToFileURL(path.join(ROOT, "tools", "director", "vendor", "three.module.min.js")).href)}, shortCircuit: true } : n(s, c); }`));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; }, OUT = opt("--out", null), NAME = "_cuteeyetest";
const EG = await import("./eyegraft.js"), OUTLINE = JSON.parse(fs.readFileSync(path.join(ROOT, "Content", "Studio", "Eyes", "cute_outline.json"), "utf8"));
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let ok = true;
const say = (good, what) => { console.log((good ? "  ok  " : "  BAD ") + what); ok = ok && !!good; };

// the picture's opening for an eye `length` from corner to corner (tools/eye_patch.py cute_target: the same sums): each
// lid as points in the frame of the corners (s along them, h square to them), and the corners' tilt in degrees
function target(length, n = 400) {
  const I = OUTLINE.inner, O = OUTLINE.outer, curve = P => {
    P = [I, ...P, O]; const t = [0]; for (let k = 1; k < P.length; k++) t.push(t[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
    const C = []; for (let j = 0; j < n; j++) { const e = t[t.length - 1] * j / (n - 1); let k = 1; while (k < P.length - 1 && t[k] < e) k++; const f = (e - t[k - 1]) / ((t[k] - t[k - 1]) || 1); C.push([P[k - 1][0] + f * (P[k][0] - P[k - 1][0]), P[k - 1][1] + f * (P[k][1] - P[k - 1][1])]); }
    for (let pass = 0; pass < 36; pass++) { const D = C.map(p => p.slice()); for (let j = 1; j < n - 1; j++) for (const a of [0, 1]) C[j][a] = 0.25 * D[j - 1][a] + 0.5 * D[j][a] + 0.25 * D[j + 1][a]; }
    return C; };
  const M = [(I[0] + O[0]) / 2, (I[1] + O[1]) / 2], k = length / Math.hypot(O[0] - I[0], O[1] - I[1]), th = Math.atan2(-(O[1] - I[1]), O[0] - I[0]), c = Math.cos(th), s = Math.sin(th);
  const to = C => C.map(p => { const x = (p[0] - M[0]) * k, y = -(p[1] - M[1]) * k; return [x * c + y * s, -x * s + y * c]; });
  return { up: to(curve(OUTLINE.upper)), lo: to(curve(OUTLINE.lower)), tilt: th * 180 / Math.PI };
}
// the opening as the page has it (the graft's points where the lids meet the eyeball) against the picture's
function fit(d) {
  const mm = 0.001 * d.scale * d.grow, P = [], sx = d.side === "L" ? 1 : -1;
  for (let i = 0; i < d.ring.length; i++) if (d.ring[i] === 0) P.push({ x: (d.V[i * 3] - d.c[0]) / mm * sx, y: (d.V[i * 3 + 1] - d.c[1]) / mm, u: d.u[i], lid: d.lid[i], moving: d.blink[i] !== 0 });
  const a = P.reduce((q, p) => p.u < q.u ? p : q), b = P.reduce((q, p) => p.u > q.u ? p : q), th = Math.atan2(b.y - a.y, b.x - a.x), c = Math.cos(th), s = Math.sin(th), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const length = Math.hypot(b.x - a.x, b.y - a.y), T = target(length); let sum = 0, most = 0, n = 0;
  for (const p of P) { if (!p.moving) continue; const x = (p.x - mx) * c + (p.y - my) * s, y = -(p.x - mx) * s + (p.y - my) * c; let best = Infinity;
    for (const q of p.lid > 0 ? T.up : T.lo) best = Math.min(best, Math.hypot(q[0] - x, q[1] - y));
    sum += best * best; most = Math.max(most, best); n++; }
  return { tilt: th * 180 / Math.PI, want: T.tilt, length, rms: Math.sqrt(sum / n), most };
}
const browser = await req("../browser.cjs").launch(chromium);
const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 } })).newPage(); page.setDefaultTimeout(600000);
const errs = []; page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
page.on("console", m => { if (m.type() === "error" && /Shader Error/.test(m.text())) errs.push(m.text().slice(0, 400)); });
const B = (f, a) => page.evaluate(f, a), t0 = Date.now();
const settle = async () => { await page.waitForFunction(() => /points/.test(document.querySelector("#hud").textContent) && !/finding|fitting/.test(document.querySelector("#status").textContent), null, { timeout: 600000 }); await page.waitForTimeout(1500); };
const eyes = () => B(() => { const b = window.__body, g = b.graft(), e = b.st.eyes, out = { shape: { ...(e.shape || {}) }, irisSize: e.irisSize, wet: e.wet ?? 0, was: e.cuteWas || null, look: e.look || "", checked: document.querySelector("#cuteEye").checked };
  for (const side of ["L", "R"]) { const o = g.G.sides[side], E = g.E[side]; out[side] = { side, c: E.c, scale: E.scale, grow: E.grow, V: Array.from(g.V[side]), ring: Array.from(o.ring), lid: Array.from(o.lid), u: Array.from(o.u), blink: Array.from(o.blink) }; }
  return out; });
// the view on one eye, both, or the face: the frame `mm` millimetres wide about the eyeballs' middle
const shot = async (tag, which, mm) => {
  if (!OUT) return;
  const box = await page.locator("#view").boundingBox(), w = Math.min(box.width - 320, 760), clip = { x: Math.round(box.x + (box.width - w) / 2), y: Math.round(box.y + 60), width: w, height: Math.round(w * (which === "face" ? 1 : 0.5)) };
  await B(async ([cx, cy, cw, ch, which, mm]) => { const b = window.__body, T = b.THREE, cam = b.camera, g = b.graft(); b.orbit.yaw = 0; b.orbit.pitch = 0;
    for (let pass = 0; pass < 5; pass++) {
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      b.rig.updateMatrixWorld(true); cam.updateMatrixWorld(true);
      const r = b.renderer.domElement.getBoundingClientRect(), cs = (which === "L" ? ["L"] : ["L", "R"]).map(s => new T.Vector3(...g.E[s].c).applyMatrix4(b.rig.matrixWorld));
      const mid = cs.reduce((q, p) => q.add(p), new T.Vector3()).multiplyScalar(1 / cs.length); if (which === "face") mid.y -= 0.03 * b.scale;
      const q = mid.clone().project(cam), x = r.left + (q.x + 1) / 2 * r.width, y = r.top + (1 - q.y) / 2 * r.height, depth = cam.position.distanceTo(mid), mpp = 2 * depth * Math.tan(cam.fov * Math.PI / 360) / r.height;
      const right = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      b.orbit.pan.addScaledVector(right, (x - (cx + cw / 2)) * mpp).addScaledVector(up, -(y - (cy + ch / 2)) * mpp); b.orbit.zoom = Math.min(3, Math.max(0.005, b.orbit.zoom * (mm * 0.001 * g.E.L.scale / mpp) / cw));
    }
    await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, [clip.x, clip.y, clip.width, clip.height, which, mm]);
  await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, `${tag}_${which}.png`), clip });
};
const shots = async tag => { await shot(tag, "L", 52); await shot(tag, "both", 110); await shot(tag, "face", 190); };
try {
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => window.__body && window.__body.SCULPT && window.__body.setCuteEye, null, { timeout: 600000 });
  await page.fill("#newName", NAME); await page.click("#make", { noWaitAfter: true });
  await page.waitForFunction(n => window.__body.who === n && /starts from the/.test(document.querySelector("#status").textContent), NAME, { timeout: 600000 });
  await settle();
  await B(() => { const b = window.__body; document.querySelector("#handlesOn").checked = false; const h = document.querySelector("#viewHelp"); if (h) h.style.display = "none"; b.setPose("rest");
    const s = document.querySelector("#lightSel"); if (s && [...s.options].some(o => o.value === "beauty")) { s.value = "beauty"; s.dispatchEvent(new Event("change")); } });
  await page.click('#views button[data-v="head"]', { noWaitAfter: true }); await settle();
  await B(() => { const c = window.__body.camera; c.fov = 12; c.updateProjectionMatrix(); });
  // ---- off, as a new character starts
  const e0 = await eyes(), f0 = fit(e0.L);
  say(!e0.checked && !(e0.shape.cute > 0) && e0.wet === 0, `a new character: the Cute eye switch off, the eyes dry, the opening's outer corner ${f0.tilt.toFixed(1)} deg higher than its inner (level)`);
  await shots("off");
  // ---- the switch
  await B(() => document.querySelector("#cuteEye").click());   // (its own click: the switch is in the Skin tab, which needn't be the one open) await settle(); await page.waitForTimeout(1500);
  const e1 = await eyes(), f1 = fit(e1.L), keys = EG.CUTE_KEYS;
  say(e1.checked && Object.entries(keys).every(([k, v]) => e1.shape[k] === v), `clicked: on, the shape keys the switch's (${Object.entries(keys).map(([k, v]) => `${k} ${v}`).join(", ")})`);
  say(e1.irisSize >= 36 && e1.wet === 1 && e1.was && e1.was.irisSize === e0.irisSize && e1.was.wet === 0 && !(e1.was.shape.cute > 0), `the iris ${e1.irisSize} degrees (it was ${e0.irisSize}), Wet eyes at ${e1.wet}; what the eyes were kept with the character`);
  say(Math.abs(f1.tilt - f1.want) < 1.5 && f1.tilt - f0.tilt > 15, `the opening diagonal as the picture's: its outer corner ${f1.tilt.toFixed(1)} deg higher (the picture's ${f1.want.toFixed(1)}; it was ${f0.tilt.toFixed(1)})`);
  say(f1.rms < 0.35 && f1.most < 1.0, `and its curve the picture's: where the lids meet the eyeball ${f1.rms.toFixed(2)} mm from the outline (rms), ${f1.most.toFixed(2)} at most, over ${f1.length.toFixed(1)} mm from corner to corner`);
  { const L = e1.L, R = e1.R, mm = 0.001 * L.scale * L.grow; let off = 0, n = 0;
    for (let i = 0; i < L.ring.length; i++) if (L.ring[i] >= 0 && L.ring[i] <= 10) { off = Math.max(off, Math.abs((L.V[i * 3] - L.c[0]) + (R.V[i * 3] - R.c[0])), Math.abs((L.V[i * 3 + 1] - L.c[1]) - (R.V[i * 3 + 1] - R.c[1])), Math.abs((L.V[i * 3 + 2] - L.c[2]) - (R.V[i * 3 + 2] - R.c[2]))); n++; }
    say(off / mm < 0.3, `the two eyes mirrors of each other: the right eye's lids the left's mirrored, ${(off / mm).toFixed(2)} mm apart at most over ${n} points`); }
  await shots("on");
  // ---- the slider by hand
  const slide = async v => { await B(v => { const row = [...document.querySelectorAll("#eyeRows .row")].find(r => r.firstChild?.textContent === "Cute eye"), inp = row.querySelector("input"); inp.value = v; inp.dispatchEvent(new Event("input")); }, v); await page.waitForTimeout(600); };
  await slide(0); const s0 = await eyes(); await slide(1); const s1 = await eyes();
  say(!s0.checked && s1.checked, "the Cute eye slider taken to 0 by hand: the switch shows off; back to 1: on");
  await settle();
  // ---- off again
  await B(() => document.querySelector("#cuteEye").click());   // (its own click: the switch is in the Skin tab, which needn't be the one open) await settle(); await page.waitForTimeout(1500);
  const e2 = await eyes(), f2 = fit(e2.L), same = Object.keys(EG.KEYS0).every(k => (e2.shape[k] ?? 0) === (e0.shape[k] ?? 0));
  say(!e2.checked && same && e2.irisSize === e0.irisSize && e2.wet === 0 && !e2.was && Math.abs(f2.tilt - f0.tilt) < 0.2, `clicked again: the eyes as they were (the shape, the iris ${e2.irisSize}, dry, the opening ${f2.tilt.toFixed(1)} deg), nothing kept`);
  // ---- the card
  await B(() => document.querySelector('#eyeLookCards .card[data-look="cute"]').click()); await settle(); await page.waitForTimeout(3500);
  const e3 = await eyes(), marked = await B(() => document.querySelector('#eyeLookCards .card[data-look="cute"]').classList.contains("on"));
  say(e3.look === "cute" && marked && e3.checked && e3.shape.cute === 1 && e3.wet === 1, "the Cute eye (wet) card: worn and marked, the switch on with it, wet");
  await shots("card");
  // ---- saved
  await B(() => { document.querySelector("#status").textContent = ""; }); await page.click("#save", { noWaitAfter: true });
  await page.waitForFunction(() => /saved/.test(document.querySelector("#status").textContent), null, { timeout: 600000 });
  const file = path.join(ROOT, "Content", "Studio", "People", NAME, "character.json"), kept = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null, ke = kept && (kept.eyes || kept.st?.eyes);
  say(ke && ke.shape?.cute === 1 && ke.wet === 1 && ke.look === "cute", "saved: the character's file says the Cute eye key, Wet eyes and the card");
  if (errs.length) throw new Error("page errors: " + errs.slice(0, 3).join(" | "));
} catch (e) {
  console.log("CUTEEYE FAIL: " + e.message); await browser.close(); process.exit(1);
}
await browser.close();
console.log(ok ? `CUTEEYE ok (${((Date.now() - t0) / 1000).toFixed(0)} s)` : "CUTEEYE FAIL");
process.exit(ok ? 0 : 1);

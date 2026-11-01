// GPUDRAPE: the drape's steps on the graphics card (tailor/drape_gpu.js, the pages' "Use the GPU") on the wardrobe page
// (tools/character/wardrobe.html) in a headless browser with WebGPU. The switch: an outfit hung on the CPU, then on the
// card; the card really used, each garment settled, stretched no more than the CPU's allows and fallen as far, lying
// near the CPU's (the order the card takes the constraints in places the folds a little differently: the skirt's points
// 3 mm apart on the whole, 14 mm for one in ten, measured on the CPU by likeGPU). The kernels: the outfit's first
// hanging garment on the card against the card's own way on the CPU (likeGPU, float64), to float32's round-off.
// Ends "GPUDRAPE ok".
//   node tools/character/tailor/gputest.mjs ["outfit name"]   (the Studio's server running: python tools/character/serve.py; BODY_URL for another port)
// Here (no card) WebGPU runs on SwiftShader's Vulkan, on the CPU: slower than the CPU's own drape. GPU=1 on the user's machine.
import { createRequire } from "module";
const req = createRequire(import.meta.url), { chromium } = req(process.env.PLAYWRIGHT || "playwright");
const URL = (process.env.BODY_URL || "http://127.0.0.1:8793/").replace(/\/?$/, "/"), NAME = process.argv[2] || "t-shirt and skirt";
const browser = await req("../../browser.cjs").launch(chromium, { args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan"] });
const page = await (await browser.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
const errors = [], fails = [];
page.on("pageerror", e => errors.push(e.message));
const say = (ok, what) => { console.log((ok ? "  ok  " : "  BAD ") + what); if (!ok) fails.push(what); };
const hung = async (gpu) => {
  await page.evaluate(g => { const W = window.__wardrobe; document.querySelector("#gpu").checked = g; document.querySelector("#hang").checked = true; W.dress(true); }, gpu);
  await page.waitForFunction(() => window.__wardrobe.made?.stage === "hung" && window.__wardrobe.made.drapes, null, { timeout: 1800000 });
  const m = await page.evaluate(() => window.__wardrobe.made);
  await page.evaluate(g => { window.__gd = window.__gd || {}; window.__gd[g] = window.__wardrobe.LAST.bakes; window.__wardrobe.made.stage = "seen"; }, gpu ? "gpu" : "cpu");
  return m;
};
try {
  await page.goto(URL + "wardrobe.html");
  await page.waitForFunction(() => window.__wardrobe, null, { timeout: 300000 });
  const card = await page.evaluate(async () => { const a = await navigator.gpu?.requestAdapter(); return a ? [a.info?.vendor, a.info?.architecture, a.info?.description].filter(Boolean).join(" ") || "an adapter" : null; });
  say(!!card, `WebGPU on the page: ${card || "none"}`);
  await page.evaluate(n => window.__wardrobe.wear(window.__wardrobe.OUTFITS[n]), NAME);
  await page.waitForFunction(() => window.__wardrobe.made?.stage, null, { timeout: 300000 });
  let t0 = Date.now(); const cpu = await hung(false), tc = Date.now() - t0;
  t0 = Date.now(); const gpu = await hung(true), tg = Date.now() - t0;
  say(gpu.gpu?.used === true, `hung on the card: ${gpu.gpu?.used ? gpu.gpu.name : gpu.gpu?.why}`);
  for (const c of cpu.drapes) {
    const g = gpu.drapes.find(d => d.name === c.name);
    if (!g) { say(false, `${c.name}: no drape on the card`); continue; }
    const info = g.gpu ? `${g.gpu.batches.lengths}+${g.gpu.batches.buttoned}+${g.gpu.batches.bends} batches, ${g.gpu.reads} readbacks` : "not on the card";
    console.log(`  ${c.name.padEnd(14)} CPU ${c.steps} steps ${(c.ms / 1000).toFixed(1)} s, stretch ${c.stretch.p50}/${c.stretch.p90}/${c.stretch.p99}, fell ${(c.fell * 100).toFixed(1)} cm, moving ${c.moving.rms}`);
    console.log(`  ${"".padEnd(14)} GPU ${g.steps} steps ${(g.ms / 1000).toFixed(1)} s, stretch ${g.stretch.p50}/${g.stretch.p90}/${g.stretch.p99}, fell ${(g.fell * 100).toFixed(1)} cm, moving ${g.moving.rms} (${info})`);
    say(!!g.gpu, `${c.name}: its steps ran on the card`);
    say(g.moving.rms < 0.005, `${c.name}: settled on the card (${(g.moving.rms * 1000).toFixed(1)} mm/s)`);
    say(g.stretch.p99 < 1.25 && g.stretch.p99 < c.stretch.p99 + 0.05, `${c.name}: stretched no more than it may (one edge in a hundred ${g.stretch.p99}, the CPU's ${c.stretch.p99})`);
    say(Math.abs(g.fell - c.fell) < 0.03, `${c.name}: fell as far as on the CPU (${(g.fell * 100).toFixed(1)} against ${(c.fell * 100).toFixed(1)} cm)`);
  }
  const far = await page.evaluate(() => {
    const out = {};
    for (const [k, a] of Object.entries(window.__gd.cpu)) {
      const b = window.__gd.gpu[k]; if (!b || b.length !== a.length) { out[k] = null; continue; }   // (cut over a garment that hung differently: other points)
      const d = []; for (let i = 0; i < a.length; i += 3) d.push(Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]));
      d.sort((x, y) => x - y); out[k] = { p50: d[d.length >> 1], p90: d[Math.floor(0.9 * (d.length - 1))], max: d[d.length - 1] };
    }
    return out;
  });
  const mm = v => (v * 1000).toFixed(1);
  for (const [k, d] of Object.entries(far)) {
    if (!d) { console.log(`  --  ${k.slice(0, 6)}: cut over what hung differently on the card (other points): not compared point by point`); continue; }
    say(d.p50 < 0.006 && d.p90 < 0.03, `the card's points near the CPU's (${k.slice(0, 6)}): half within ${mm(d.p50)} mm, nine in ten ${mm(d.p90)} mm, the farthest ${mm(d.max)} mm`);
  }
  console.log(`  the whole hang: CPU ${(tc / 1000).toFixed(1)} s, GPU ${(tg / 1000).toFixed(1)} s (${card})`);
  // the kernels: the first hanging garment on the card and the card's own way on the CPU, in the page
  const K = await page.evaluate(async name => {
    const T = await import("./tailor.js"), DG = await import("./tailor/drape_gpu.js"), W = window.__wardrobe, list = W.OUTFITS[name];
    const B = T.body(W.BODY, W.TRIS), upto = T.plan("gputest", list, W.DESIGNS).findIndex(g => g.drapes) + 1;
    const run = async fn => { const it = T.dressing(B, list.slice(0, upto), W.DESIGNS, { drape: true, body: "gputest", cache: false, gpu: true }); let r, back; while (!(r = it.next(back)).done) back = r.value.gpu ? await fn(r.value.gpu) : undefined; return r.value[upto - 1]; };
    const g = await run(S => DG.drapeGPU(S)), c = await run(S => DG.likeGPU(S));
    if (!g.drape?.gpu) return { name: g.name, why: DG.gpuState().why || "not on the card" };
    const P = g.hung, Q = c.hung, d = []; for (let i = 0; i < P.length; i += 3) d.push(Math.hypot(P[i] - Q[i], P[i + 1] - Q[i + 1], P[i + 2] - Q[i + 2]));
    d.sort((x, y) => x - y);
    return { name: g.name, steps: [g.drape.steps, c.drape.steps], ms: [g.drape.ms, c.drape.ms], p50: d[d.length >> 1], p90: d[Math.floor(0.9 * (d.length - 1))], p99: d[Math.floor(0.99 * (d.length - 1))], max: d[d.length - 1] };
  }, NAME);
  if (K.why) say(false, `the kernels: ${K.name} not on the card (${K.why})`);
  else say(K.p90 < 0.001 && K.p99 < 0.003, `the kernels: ${K.name} on the card as the card's way on the CPU (likeGPU, float64): half within ${mm(K.p50)} mm, nine in ten ${mm(K.p90)}, one in a hundred ${mm(K.p99)}, the farthest ${mm(K.max)} (${K.steps[0]} and ${K.steps[1]} steps; ${(K.ms[0] / 1000).toFixed(1)} s on the card, ${(K.ms[1] / 1000).toFixed(1)} s on the CPU)`);
  say(!errors.length, `no page errors${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
} catch (e) { fails.push(String(e)); console.log("  BAD " + e); }
await browser.close();
console.log(fails.length ? `GPUDRAPE FAIL (${fails.length})` : "GPUDRAPE ok");
process.exit(fails.length ? 1 : 0);

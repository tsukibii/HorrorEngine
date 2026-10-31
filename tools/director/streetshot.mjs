// A street's shot as a picture (the street builder, docs/STREET_BUILDER.md §5): the street drawn through one of its
// shots at the shot's own size, and, when the shot has its photo, the photo, the drawing and the two blended, side by
// side, to see and measure how the drawing frames what the photo does. The desk's server running.
//
//   node tools/director/streetshot.mjs --street shibuya_lane --shot photo [--out Saved/Streets/shibuya_lane/photo.png] [--height 750] [--time night]
//
// Writes <out> (the drawing) and, with a photo, <out>-compare.png (photo | drawing | blended). Needs Playwright.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const URL0 = process.env.DESK_URL || "http://127.0.0.1:8780/";
const street = opt("--street"), shotId = opt("--shot", "photo");
if (!street) { console.log("give --street <name> (and --shot <id>)"); process.exit(2); }
const out = path.resolve(ROOT, opt("--out", `Saved/Streets/${street}/${shotId}.png`));

const browser = await require("../browser.cjs").launch(chromium);
try {
  const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${URL0}street.html?street=${encodeURIComponent(street)}&shot=${encodeURIComponent(shotId)}${opt("--time") ? "&time=" + opt("--time") : ""}`);
  await page.waitForFunction(() => window.__streetReady, null, { timeout: 120000 });
  const info = await page.evaluate(async ({ shotId, height }) => {
    const s = window.ST.street.shots.find(x => x.id === shotId);
    if (!s) return { error: `no shot ${shotId}: ${window.ST.street.shots.map(x => x.id).join(", ")}` };
    const a = Array.isArray(s.aspect) ? s.aspect[0] / s.aspect[1] : 16 / 9, H = height, W = Math.round(H * a);
    window.__shot(shotId, W, H);
    await new Promise(r => setTimeout(r, 400));
    window.__shot(shotId, W, H);
    const gl = document.querySelector("#view canvas"), dpr = gl.width / gl.clientWidth;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    c.getContext("2d").drawImage(gl, 0, 0, gl.width, gl.height, 0, 0, W, H);
    const drawn = c.toDataURL("image/png");
    let compare = null;
    if (s.ref) {
      const img = new Image(); img.src = `/streets/${encodeURIComponent(window.ST.name)}/${s.ref}`;
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => res(); });
      if (img.naturalWidth) {
        const k = document.createElement("canvas"); k.width = W * 3 + 16; k.height = H; const g = k.getContext("2d");
        g.fillStyle = "#000"; g.fillRect(0, 0, k.width, H);
        g.drawImage(img, 0, 0, W, H); g.drawImage(c, W + 8, 0);
        g.drawImage(img, 2 * W + 16, 0, W, H); g.globalAlpha = 0.5; g.drawImage(c, 2 * W + 16, 0); g.globalAlpha = 1;
        compare = k.toDataURL("image/png");
      }
    }
    return { W, H, dpr, drawn, compare, tris: window.ST.pieces.reduce((n, p) => n + Object.values(p.G).reduce((m, g) => m + g.idx.length / 3, 0), 0) };
  }, { shotId, height: +opt("--height", 750) });
  if (info.error) { console.log("FAIL " + info.error); process.exitCode = 1; }
  else {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(info.drawn.split(",")[1], "base64"));
    console.log(`wrote ${path.relative(ROOT, out)} (${info.W}x${info.H}, ${info.tris} triangles)`);
    if (info.compare) { const cmp = out.replace(/\.png$/, "") + "-compare.png"; fs.writeFileSync(cmp, Buffer.from(info.compare.split(",")[1], "base64")); console.log(`wrote ${path.relative(ROOT, cmp)} (the photo | the drawing | the two blended)`); }
  }
  if (errors.length) console.log("page errors: " + errors.slice(0, 5).join(" | "));
} finally { await browser.close(); }

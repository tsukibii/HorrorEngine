// A clip as rows of stick figures: a quick look at what a clip's maker makes, without Godot or the page
// (docs/ANIMATOR_V3.md §7). Each clip is a strip: its frames spread over its length, from her right side (she faces
// right) and from the front, her left limbs blue, her right red, the floor a line.
//   node tools/animator/sticks.mjs --kind sneak [--body normal_woman] [--frames 8] [--views side,front] [--scale 150] [--out sticks.png]
//   node tools/animator/sticks.mjs --clips punch,swing --set strength=1
// Draws the three test bodies' skeletons (bodies.mjs); the pictures are for whoever is writing a clip.
import { writeFileSync } from "fs";
import { createRequire } from "module";
import { testBody, bodyGlb, mhrRigBuffer, TEST_BODIES } from "./bodies.mjs";
import { parseGlb } from "./core/glb.js";
import { prepare, makers, makeClip, settingsFor } from "./core/animate.js";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const bodyName = arg("body", "normal_woman"), kind = arg("kind", null), only = arg("clips", null), N = +arg("frames", 8), out = arg("out", "sticks.png"), SC = +arg("scale", 150), VIEWS = arg("views", "side,front").split(",");
const given = Object.fromEntries((arg("set", "") || "").split(",").filter(Boolean).map(kv => { const [k, v] = kv.split("="); return [k, +v]; }));
if (!TEST_BODIES[bodyName]) { console.error(`no test body "${bodyName}": ${Object.keys(TEST_BODIES).join(", ")}`); process.exit(1); }

const ctx = prepare(parseGlb(bodyGlb(testBody(bodyName))), { mhrRig: mhrRigBuffer() }), { rig, body, X, plan } = ctx, set = settingsFor(ctx.glb, body, given);
let list = makers(rig, body, set, kind ? kind.split(",") : null, X); if (only) { const want = only.split(","); list = list.filter(m => want.includes(m.name)); }
if (!list.length) { console.error("no such clips"); process.exit(1); }

const ix = n => rig.ix.get(n), chain = names => names.map(ix).filter(i => i != null);
const SPINE = chain(["root", "c_spine0", "c_spine1", "c_spine2", "c_spine3", "c_neck", "c_head", "c_head_null"]);
const limb = s => ({ arm: chain([`${s}_clavicle`, `${s}_uparm`, `${s}_lowarm`, `${s}_wrist`, `${s}_middle1`, `${s}_middle_null`]), thumb: chain([`${s}_wrist`, `${s}_thumb1`, `${s}_thumb_null`]),
  leg: chain([`${s}_upleg`, `${s}_lowleg`, `${s}_foot`, `${s}_ball`]) });
const L = limb("l"), R = limb("r"), H = body.height, W = H * 1.25, PAD = 0.12;
const cell = { w: W * SC, h: 0 };
let svg = "", y0 = 0; const cols = N, width = cols * cell.w * VIEWS.length + 20;
for (const m of list) {
  const c = makeClip(rig, body, X, plan, m, set), F = c.frames, n = F.length;
  { let top = 0.3; for (const fr of F) for (let j = 0; j < rig.J.length; j++) top = Math.max(top, fr.solved.P[j * 3 + 1]); cell.h = (top * 1.1 + PAD) * SC; }   // (a strip as tall as the clip stands)
  svg += `<text x="6" y="${y0 + 16}" font-size="14" font-family="monospace">${m.name}  ${((m.loop ? n : n - 1) / m.fps).toFixed(2)} s${m.loop ? " loop" : ""}${m.speed ? `  ${m.speed.toFixed(2)} m/s` : ""}  ${(m.events || []).map(e => `${e.name}@${e.t.toFixed(2)}`).join(" ")}  reach ${c.stats.reach}</text>`;
  y0 += 22;
  for (let k = 0; k < cols; k++) {
    const f = Math.min(n - 1, Math.round(k * (m.loop ? n : n - 1) / (m.loop ? cols : cols - 1))), P = F[f].solved.P, p = j => [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]];
    for (const [view, ox] of VIEWS.map((v, vi) => [v, vi * (cols * cell.w + 20) + k * cell.w])) {
      const cx = ox + cell.w / 2, fy = y0 + cell.h - PAD * SC * 0.5, at = j => { const q = p(j); return [cx + (view === "side" ? q[2] : q[0]) * SC, fy - q[1] * SC]; };
      const line = (js, col, w = 2.2) => js.length > 1 ? `<polyline fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" points="${js.map(j => at(j).map(v => v.toFixed(1)).join(",")).join(" ")}"/>` : "";
      svg += `<line x1="${ox + 4}" y1="${fy}" x2="${ox + cell.w - 4}" y2="${fy}" stroke="#999" stroke-width="1"/>`;
      // (the far side first: from her right side her left limbs are behind; from the front neither is)
      svg += line(L.leg, "#5b8def") + line(L.arm, "#5b8def") + line(L.thumb, "#5b8def", 1.2) + line(SPINE, "#222", 2.8) + line(R.leg, "#e0524a") + line(R.arm, "#e0524a") + line(R.thumb, "#e0524a", 1.2);
      const hd = at(ix("c_head")), ht = at(ix("c_head_null")), r = Math.hypot(ht[0] - hd[0], ht[1] - hd[1]) * 0.55, mx = (hd[0] + ht[0]) / 2, my = (hd[1] + ht[1]) / 2;
      svg += `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="#222" stroke-width="1.6"/>`;
      // the nose: where the head faces
      { const D = F[f].solved.D[ix("c_head")], q = D, v = [0, 0, 1], x = q[0], y = q[1], z = q[2], w = q[3], tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
        const d = [v[0] + w * tx + y * tz - z * ty, v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx], dx = (view === "side" ? d[2] : d[0]) * r * 1.5, dy = -d[1] * r * 1.5;
        svg += `<line x1="${mx.toFixed(1)}" y1="${my.toFixed(1)}" x2="${(mx + dx).toFixed(1)}" y2="${(my + dy).toFixed(1)}" stroke="#222" stroke-width="1.6"/>`; }
      if (view === "side") svg += `<text x="${ox + 6}" y="${y0 + 12}" font-size="10" font-family="monospace" fill="#666">${(f / m.fps).toFixed(2)}</text>`;
    }
  }
  y0 += cell.h + 6;
}
const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y0}" viewBox="0 0 ${width} ${y0}"><rect width="100%" height="100%" fill="#f6f4ef"/>${svg}</svg>`;
if (/\.svg$/.test(out)) { writeFileSync(out, doc); console.log(out); }
else {
  const require = createRequire(import.meta.url), { chromium } = require("playwright"), browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: Math.ceil(width), height: Math.ceil(y0) }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0">${doc}</body>`); await page.screenshot({ path: out }); await browser.close(); console.log(`${out}  ${Math.ceil(width)} x ${Math.ceil(y0)}  (${list.length} clips, ${bodyName})`);
}

// A shot's camera solved from its pins (the street builder, docs/STREET_BUILDER.md §7d): where a point of the street is
// in the photo (`pins`: px 0..1 across and down, `at` in the street) pins the shot down, and the camera that lands
// them best (its eye, where it looks, its lens) is found by Nelder-Mead over SG.pinErrors, from the shot as it is.
//
//   node tools/director/shotfit.mjs --street garden_steps [--shot photo] [--write] [--fix vfov=65,z=1.2] [--tries 8]
//
// Prints the fit (each pin's error) and, with --write, puts the camera into the street's shot. --fix holds a number
// (x, y, z the eye's; yaw, pitch degrees; vfov) where it is. The same every run.
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SG = await import(pathToFileURL(path.join(ROOT, "tools/director/street-gen.js")).href);
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const name = opt("--street"), shotId = opt("--shot", "photo");
if (!name) { console.log("give --street <name> (and --shot <id>)"); process.exit(2); }
const file = path.join(ROOT, "Content/Studio/Streets", name, "street.json"), S = JSON.parse(fs.readFileSync(file, "utf8"));
const shot = (S.shots || []).find(s => s.id === shotId);
if (!shot) { console.log(`no shot ${shotId} in ${name}`); process.exit(2); }
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm3 = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// --cast u,v[@z]: where a pixel of the photo lands on the street through the shot as it is (on the ground, or on the
// plane z = ...): to place what the photo shows by its pixel
if (args.includes("--cast")) {
  const T = SG.terrain(S), a = Array.isArray(shot.aspect) ? shot.aspect[0] / shot.aspect[1] : 16 / 9, t = Math.tan((shot.vfov || 60) * Math.PI / 360);
  const e = shot.eye, l = shot.look, zc = norm3(sub3(e, l)), xc = norm3(cross3([0, 0, 1], zc)), yc = cross3(zc, xc);
  for (let i = 0; i < args.length; i++) if (args[i] === "--cast") {
    const [uv, zs] = args[i + 1].split("@"), [u, v] = uv.split(",").map(Number), dir = norm3(add3(add3(mul3(xc, (u * 2 - 1) * t * a), mul3(yc, (1 - v * 2) * t)), mul3(zc, -1)));
    let hit = null;
    if (zs !== undefined) { const k = (+zs - e[2]) / dir[2]; if (k > 0) hit = add3(e, mul3(dir, k)); }
    else for (let k = 0.05; k < 400; k += 0.02) { const q = add3(e, mul3(dir, k)); if (q[2] <= T.surface(q[0], q[1])) { hit = q; break; } }
    console.log(`  pixel ${u}, ${v}${zs !== undefined ? ` at z ${zs}` : " on the ground"}: ${hit ? hit.map(x => x.toFixed(2)).join(", ") : "nothing (the sky)"}`);
  }
  process.exit(0);
}
if (!(shot.pins || []).length) { console.log(`shot ${shotId} has no pins`); process.exit(2); }
const fixed = Object.fromEntries((opt("--fix", "") || "").split(",").filter(Boolean).map(kv => { const [k, v] = kv.split("="); return [k.trim(), +v]; }));
// the shot as six numbers and back
const d0 = [shot.look[0] - shot.eye[0], shot.look[1] - shot.eye[1], shot.look[2] - shot.eye[2]], L0 = Math.hypot(...d0) || 1;
const start = { x: shot.eye[0], y: shot.eye[1], z: shot.eye[2], yaw: deg(Math.atan2(d0[0], d0[1])), pitch: deg(Math.asin(d0[2] / L0)), vfov: shot.vfov || 60 };
const KEYS = ["x", "y", "z", "yaw", "pitch", "vfov"], free = KEYS.filter(k => !(k in fixed));
const toShot = v => { const p = Object.assign({}, start, fixed); free.forEach((k, i) => { p[k] = v[i]; }); const y = rad(p.yaw), t = rad(p.pitch);
  return Object.assign({}, shot, { eye: [p.x, p.y, p.z], look: [p.x + Math.sin(y) * Math.cos(t) * 20, p.y + Math.cos(y) * Math.cos(t) * 20, p.z + Math.sin(t) * 20], vfov: Math.max(5, Math.min(150, p.vfov)) }); };
const cost = v => { const e = SG.pinErrors(toShot(v)); return e.reduce((a, p) => a + (Number.isFinite(p.err) ? p.err * p.err : 4), 0) / e.length; };
// Nelder-Mead
function nm(f, x0, steps, iters = 4000) {
  const n = x0.length; let X = [x0.slice()]; for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += steps[i]; X.push(x); }
  let F = X.map(f);
  for (let it = 0; it < iters; it++) {
    const o = X.map((_, i) => i).sort((a, b) => F[a] - F[b]); X = o.map(i => X[i]); F = o.map(i => F[i]);
    if (F[n] - F[0] < 1e-14) break;
    const c = Array(n).fill(0); for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) c[k] += X[i][k] / n;
    const xr = c.map((v, k) => v + (v - X[n][k])), fr = f(xr);
    if (fr < F[0]) { const xe = c.map((v, k) => v + 2 * (v - X[n][k])), fe = f(xe); if (fe < fr) { X[n] = xe; F[n] = fe; } else { X[n] = xr; F[n] = fr; } }
    else if (fr < F[n - 1]) { X[n] = xr; F[n] = fr; }
    else { const xc = c.map((v, k) => v + 0.5 * (X[n][k] - v)), fc = f(xc); if (fc < F[n]) { X[n] = xc; F[n] = fc; } else for (let i = 1; i <= n; i++) { X[i] = X[i].map((v, k) => X[0][k] + 0.5 * (v - X[0][k])); F[i] = f(X[i]); } }
  }
  const b = F.indexOf(Math.min(...F)); return { x: X[b], f: F[b] };
}
const steps = { x: 1, y: 1, z: 0.5, yaw: 8, pitch: 6, vfov: 8 };
let best = null;
const tries = +opt("--tries", 8), x0 = free.map(k => start[k]);
let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let t = 0; t < tries; t++) {
  const x = x0.map((v, i) => t === 0 ? v : v + (R() - 0.5) * 2 * steps[free[i]] * 1.5);
  let r = nm(cost, x, free.map(k => steps[k])); r = nm(cost, r.x, free.map(k => steps[k] * 0.2));
  if (!best || r.f < best.f) best = r;
}
const sol = toShot(best.x), E = SG.pinErrors(sol), mean = E.reduce((a, p) => a + p.err, 0) / E.length, worst = E.reduce((a, p) => p.err > a.err ? p : a);
const p = Object.assign({}, start, fixed); free.forEach((k, i) => { p[k] = best.x[i]; });
console.log(`shot ${shotId} of ${name}: eye ${[p.x, p.y, p.z].map(v => v.toFixed(2)).join(", ")}, turned ${p.yaw.toFixed(1)}°, tilted ${p.pitch.toFixed(1)}°, lens ${p.vfov.toFixed(1)}° tall${free.length < 6 ? ` (held: ${Object.keys(fixed).join(", ")})` : ""}`);
console.log(`  ${E.length} pins: ${(mean * 100).toFixed(2)}% of the frame off on average, ${(worst.err * 100).toFixed(2)}% at most (${worst.name})`);
for (const e of E) console.log(`    ${(e.err * 100).toFixed(2).padStart(6)}%  ${e.name}${e.at ? `  (lands at ${e.at.map(v => v.toFixed(3)).join(", ")})` : "  (behind the eye)"}`);
if (args.includes("--write")) {
  shot.eye = sol.eye.map(v => Math.round(v * 1000) / 1000); shot.look = sol.look.map(v => Math.round(v * 1000) / 1000); shot.vfov = Math.round(sol.vfov * 100) / 100;
  fs.writeFileSync(file, JSON.stringify(S, null, 1) + "\n");
  console.log(`  written into ${path.relative(ROOT, file)}`);
}

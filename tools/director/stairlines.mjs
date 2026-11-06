// The ideal lines of a street's stair stacks drawn over a shot's picture (the user, 2026-11-06: a red line over the
// picture, "one straight edge from the foot to the landing's corner, nothing stepping above it"): for every `stairs`
// part with `floors`, each flight's rail line (the inner-corner line + the rail's top, foot to landing) and each
// landing's rail line, and a panel's or parapet's bottom edge, drawn in the street page's own scene as thin red bars
// (2 cm, a hair toward the eye, hidden wherever the street hides them) and pictured through the shot by streetshot.mjs.
// Where the geometry is right, the red lies exactly on the rails' and panels' top edges; anything standing above a
// line shows over the red. The desk's server running.
//
//   node tools/director/stairlines.mjs --street danchi_court --shot close_tower --out overlay.png [--height 720] [--time night]
//
// Writes <out> and <out>.json (the segments, world metres). The same numbers the STREET check holds every stack to
// (street-gen.js stackLineFaults).
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SG = await import(pathToFileURL(path.join(ROOT, "tools/director/street-gen.js")).href);
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const street = opt("--street"), shotId = opt("--shot"), out = path.resolve(ROOT, opt("--out", `Saved/Streets/${street}/${shotId}_lines.png`));
if (!street || !shotId) { console.log("give --street NAME --shot ID [--out overlay.png]"); process.exit(2); }
const S = JSON.parse(fs.readFileSync(path.join(ROOT, "Content/Studio/Streets", street, "street.json"), "utf8"));
const shot = (S.shots || []).find(s => s.id === shotId); if (!shot) { console.log("no shot " + shotId); process.exit(2); }
const num = (v, d) => Number.isFinite(+v) ? +v : d, SIDE_IN = 0.006, E = shot.eye;
const segs = [], TOWARD = 0.025;                                     // each bar this much toward the eye: on the edge it marks, never fighting the face it lies on
const seg = (A, B, what) => { const d = P => { const v = [E[0] - P[0], E[1] - P[1], E[2] - P[2]], l = Math.hypot(...v) || 1; return [P[0] + v[0] / l * TOWARD, P[1] + v[1] / l * TOWARD, P[2] + v[2] / l * TOWARD]; }; segs.push({ a: d(A), b: d(B), what }); };
for (const b of S.buildings || []) for (const p of b.parts || []) {
  if (p.kind !== "stairs") continue;
  const K = SG.PART_KINDS.stairs, w = num(b.w, 8), d = num(b.d, 10), F = SG.faceFrames(-w / 2, -d / 2, w / 2, d / 2, 0)[p.face || "front"];
  const pw = num(p.w, K.w), out2 = num(p.out, K.out), c = F.W / 2 + num(p.x, 0), rows = SG.floorsOf(b).rows;
  const L = SG.stackOf(p, rows, c - pw / 2 + SIDE_IN, c + pw / 2 - SIDE_IN, 0, out2);
  const top = L.railTop, pn = L.pn, bottom = L.style === "steel" ? -0.25 + SIDE_IN : -0.16 + SIDE_IN;
  const P = (u, z, n) => SG.place([F.o[0] + F.U[0] * u + F.N[0] * n, F.o[1] + F.U[1] * u + F.N[1] * n, z], { at: b.at, turn: b.turn });
  const railN = (f, side) => L.rail === "parapet" ? (side === "out" ? f.n1 + 0.06 : side === "inner" ? f.n0 - 0.06 : f.n1 + 0.06) : side === "out" ? L.nB - pn : side === "inner" ? f.n0 + pn : f.n1 - pn;
  for (const st of L.stages) {
    for (const fl of st.flights) {
      const [outer, inner] = fl.rails;
      if (top && outer) seg(P(fl.uF, fl.zF + top, railN(fl, outer === "out" ? "out" : "well")), P(fl.uT, fl.zT + top, railN(fl, outer === "out" ? "out" : "well")), "rail " + L.rail);
      if (top && (inner === "well" || inner === "in")) seg(P(fl.uF, fl.zF + top, railN(fl, "inner")), P(fl.uT, fl.zT + top, railN(fl, "inner")), "rail " + L.rail);
      if ((L.rail === "panel" || L.rail === "parapet") && outer === "out") seg(P(fl.uF, fl.zF + bottom, railN(fl, "out")), P(fl.uT, fl.zT + bottom, railN(fl, "out")), "soffit");
    }
    for (const ld of st.landings) {
      const n = L.rail === "parapet" ? ld.n1 - 0.06 : ld.n1 - pn;
      if (top) seg(P(ld.uIn, ld.z + top, n), P(ld.uEnd, ld.z + top, n), "landing " + L.rail);
      if (L.rail === "panel" || L.rail === "parapet") { const zb = ld.z - (ld.kind === "floor" && L.shaft === "walls" ? 0.5 : L.style === "steel" ? 0.045 : 0.16) + SIDE_IN; seg(P(ld.uIn, zb, n), P(ld.uEnd, zb, n), "slab"); }
    }
  }
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out + ".json", JSON.stringify({ w: 0.02, segs }));
const r = spawnSync(process.execPath, [path.join(ROOT, "tools/director/streetshot.mjs"), "--street", street, "--shot", shotId, "--out", out, "--height", opt("--height", "720"), "--lines", out + ".json", ...(opt("--time") ? ["--time", opt("--time")] : [])], { encoding: "utf8", env: process.env });
process.stdout.write(r.stdout || ""); process.stderr.write(r.stderr || "");
console.log(`${segs.length} lines -> ${path.relative(ROOT, out)}`);
process.exit(r.status || 0);

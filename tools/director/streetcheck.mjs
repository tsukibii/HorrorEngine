// The street builder's check (docs/STREET_BUILDER.md §6): every building style at six seeds, every window and ground
// floor style, every part, roof, road mark, thing and fence builds with no stray number, inside its triangle budget and
// the same twice; a wall's rectangles and its holes tile it exactly; and every street in Content/Studio/Streets is
// well formed (ids, kinds, its poles' wires, its shots) and builds, each shot's pins landing where its photo has them.
// Ends "STREET ok".   node tools/director/streetcheck.mjs [--street NAME]
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const load = async f => { try { return await import(pathToFileURL(path.join(ROOT, f)).href); } catch (e) { if (!(e instanceof SyntaxError)) throw e; return await import("data:text/javascript;base64," + fs.readFileSync(path.join(ROOT, f)).toString("base64")); } };
const SG = await load("tools/director/street-gen.js");
const SP = await (async () => { try { return await import(pathToFileURL(path.join(ROOT, "tools/director/street-presets.js")).href); } catch (e) { return null; } })();
const errs = [], warns = [], args = process.argv.slice(2), only = args.includes("--street") ? args[args.indexOf("--street") + 1] : null;
const BUDGET = { building: 30000, thing: 3000, fence: 6000, road: 6000 };
function sane(label, pieces, budgetOf) {
  let tris = 0;
  for (const p of pieces) {
    if (p.error) { errs.push(`${label}: ${p.id} didn't build: ${p.error}`); continue; }
    let t = 0;
    for (const [slot, g] of Object.entries(p.G)) {
      if (g.pos.length % 3 || g.nrm.length !== g.pos.length || g.uv.length / 2 !== g.pos.length / 3) errs.push(`${label}: ${p.id} ${slot}: its arrays don't agree`);
      if ([...g.pos, ...g.nrm, ...g.uv].some(v => !Number.isFinite(v))) errs.push(`${label}: ${p.id} ${slot}: a stray number`);
      if (g.idx.some(i => i < 0 || i >= g.pos.length / 3)) errs.push(`${label}: ${p.id} ${slot}: an index past its points`);
      for (let i = 0; i < g.nrm.length; i += 3) { const l = Math.hypot(g.nrm[i], g.nrm[i + 1], g.nrm[i + 2]); if (Math.abs(l - 1) > 1e-3) { errs.push(`${label}: ${p.id} ${slot}: a normal not one long`); break; } }
      t += g.idx.length / 3;
    }
    const b = budgetOf && budgetOf(p);
    if (b && t > b) errs.push(`${label}: ${p.id} is ${t} triangles (over ${b})`);
    for (const s of p.signs || []) if (!s.key) errs.push(`${label}: ${p.id}: a sign without its key`);
    tris += t;
  }
  return tris;
}
const once = (label, street) => { const a = SG.build(street), b = SG.build(street); if (JSON.stringify(a.map(p => p.G)) !== JSON.stringify(b.map(p => p.G))) errs.push(`${label}: not the same twice`); return a; };
// 1. the styles, at six seeds each
let nb = 0, tb = 0;
if (SP) for (const style of Object.keys(SP.STYLES)) for (let seed = 1; seed <= 6; seed++) {
  const b = Object.assign({ id: `${style}${seed}`, at: [0, 0], turn: 30 * seed }, SP.makeBuilding(style, seed * 7919));
  tb += sane(`style ${style} seed ${seed}`, once(`style ${style}`, { buildings: [b], ground: false }), () => BUDGET.building); nb++;
  if (!(b.w > 1 && b.d > 1 && b.floors >= 1)) errs.push(`style ${style}: a building with no size`);
}
// 2. every window style on every floor, every ground floor, every part, every roof, setbacks
const base = { id: "t", at: [0, 0], turn: 0, w: 9, d: 10, floors: 4, gh: 3.6, fh: 3.1 };
for (const win of Object.keys(SG.WIN_STYLES)) for (const ground of Object.keys(SG.GROUND_STYLES))
  sane(`windows ${win}, ground ${ground}`, SG.build({ buildings: [Object.assign({}, base, { faces: { front: { win, ground, bands: true }, left: { win }, right: { win }, back: { win } } })], ground: false }), () => BUDGET.building);
for (const kind of Object.keys(SG.PART_KINDS)) for (const face of ["front", "right", "back", "left"])
  sane(`part ${kind} on the ${face}`, SG.build({ buildings: [Object.assign({}, base, { parts: [{ kind, face, x: 1, text: "テスト", win: true }, { kind, face, x: -2, floors: [2, 4], rail: "bars" }] })], ground: false }), () => BUDGET.building);
for (const kind of Object.keys(SG.ROOF_KINDS)) for (const ridge of ["x", "y"])
  sane(`roof ${kind} ${ridge}`, SG.build({ buildings: [Object.assign({}, base, { roof: { kind, ridge, things: Object.keys(SG.ROOF_THINGS).map((k, i) => ({ kind: k, x: i - 2 })) }, tiers: [{ floors: 2, inset: [1.5, 1, 1, 1] }] })], ground: false }), () => BUDGET.building);
// a roof's slopes face up; a building's walls face out
{ const p = SG.build({ buildings: [Object.assign({}, base, { roof: { kind: "hip" } })], ground: false })[0], g = p.G.tiles;
  for (let i = 0; g && i < g.nrm.length; i += 3) if (g.nrm[i + 2] < 0.2) { errs.push("a hip roof's slope faces down"); break; } }
// 3. roads and their marks, crossing; things; fences
const roads = [{ id: "a", from: [0, -30], to: [0, 30], width: 6, walks: [2, 1], edge: [0.5, 0.5], centre: "dashed", marks: Object.keys(SG.MARK_KINDS).map((k, i) => ({ kind: k, at: 3 + i * 4, text: "止まれ" })) },
  { id: "b", from: [-30, 5], to: [30, 5], width: 8, walks: [2.5, 2.5], centre: "yellow" }];
sane("roads", SG.build({ roads, ground: false }), () => BUDGET.road);
{ const a = SG.build({ roads, ground: false })[0], g = a.G.pavement;            // the walks are cut where the other road crosses
  let cut = true; for (let i = 0; g && i < g.pos.length; i += 3) if (Math.abs(g.pos[i + 1] - 5) < 3.5 && g.pos[i + 2] > 0.1 && Math.abs(g.pos[i]) < 3.9) { cut = false; break; }
  if (!cut) errs.push("a road's pavement runs on across the road that crosses it"); }
const things = Object.keys(SG.THING_KINDS).map((k, i) => ({ id: "t" + i, kind: k, at: [i * 2, 0], turn: i * 25, signs: Object.keys(SG.SIGN_KINDS).slice(0, 3), globes: k === "postlamp" ? 2 : 0 }));
things.push({ id: "p1", kind: "pole", at: [0, 10], to: "p2" }, { id: "p2", kind: "pole", at: [25, 12] });
sane("things", SG.build({ things, ground: false }), p => p.type === "wires" ? 2000 : BUDGET.thing);
sane("fences", SG.build({ fences: Object.keys(SG.FENCE_KINDS).map((k, i) => ({ id: "f" + i, kind: k, from: [0, i * 3], to: [7 + i, i * 3 + 2] })), ground: false }), () => BUDGET.fence);
// 4. a wall's rectangles and its holes tile it, nothing twice and nothing missed
{ let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 200; n++) {
    const W = 3 + R() * 9, H = 3, holes = [];
    for (let k = 0; k < 6; k++) { const u0 = R() * (W - 0.6), w = 0.3 + R() * 1.5, z0 = R() * 2.2, h = 0.3 + R() * 0.8; const h0 = { u0, u1: Math.min(W, u0 + w), z0, z1: Math.min(H, z0 + h) }; if (!holes.some(q => q.u0 < h0.u1 && q.u1 > h0.u0 && q.z0 < h0.z1 && q.z1 > h0.z0)) holes.push(h0); }
    const rects = SG.wallRects(W, 0, H, holes), area = rects.reduce((s, [a, b, p, q]) => s + (b - a) * (q - p), 0) + holes.reduce((s, h) => s + (h.u1 - h.u0) * (h.z1 - h.z0), 0);
    if (Math.abs(area - W * H) > 1e-6) { errs.push(`a wall's rectangles don't tile it (${area.toFixed(4)} of ${(W * H).toFixed(4)})`); break; }
  } }
// 5. the streets
const DIR = path.join(ROOT, "Content/Studio/Streets"), KNOWN = { roads: ["id", "from", "to"], buildings: ["id", "at", "w", "d", "floors"], things: ["id", "kind", "at"], fences: ["id", "kind", "from", "to"], shots: ["id", "eye", "look"] };
const names = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(n => fs.existsSync(path.join(DIR, n, "street.json")) && (!only || n === only)) : [];
const report = [];
for (const name of names) {
  let S; try { S = JSON.parse(fs.readFileSync(path.join(DIR, name, "street.json"), "utf8")); } catch (e) { errs.push(`street ${name}: not JSON: ${e.message}`); continue; }
  const L = `street ${name}`, ids = new Set();
  if (S.format !== SG.FORMAT) errs.push(`${L}: format ${S.format}, the builder reads ${SG.FORMAT}`);
  for (const [list, need] of Object.entries(KNOWN)) for (const p of S[list] || []) {
    for (const k of need) if (p[k] === undefined) errs.push(`${L}: a ${list.slice(0, -1)} without ${k}: ${JSON.stringify(p).slice(0, 80)}`);
    if (ids.has(p.id)) errs.push(`${L}: the id ${p.id} twice`); ids.add(p.id);
  }
  for (const b of S.buildings || []) {
    if (b.style && SP && !SP.STYLES[b.style]) warns.push(`${L}: ${b.id}: no style ${b.style}`);
    for (const pt of b.parts || []) if (!SG.PART_KINDS[pt.kind]) errs.push(`${L}: ${b.id}: no part kind ${pt.kind}`);
    for (const [f, r] of Object.entries(b.refs || {})) if (!/^refs\//.test(r.file || "")) errs.push(`${L}: ${b.id}: its ${f} photo isn't in refs/`);
  }
  for (const t of S.things || []) { if (!SG.THING_KINDS[t.kind]) errs.push(`${L}: ${t.id}: no thing kind ${t.kind}`); if (t.to && !(S.things || []).some(q => q.id === t.to && q.kind === "pole")) errs.push(`${L}: ${t.id}: wires to ${t.to}, not a pole here`); }
  for (const f of S.fences || []) if (!SG.FENCE_KINDS[f.kind]) errs.push(`${L}: ${f.id}: no fence kind ${f.kind}`);
  for (const r of S.roads || []) for (const m of r.marks || []) if (!SG.MARK_KINDS[m.kind]) errs.push(`${L}: ${r.id}: no mark kind ${m.kind}`);
  const pieces = SG.build(S), tris = sane(L, pieces, p => BUDGET[p.type] || 20000), st = SG.stats(pieces);
  let pins = "";
  for (const s of S.shots || []) {
    if (!(s.vfov > 1 && s.vfov < 170)) errs.push(`${L}: shot ${s.id}: its lens (vfov ${s.vfov})`);
    const pe = SG.pinErrors(s);
    if (pe.length) {
      const mean = pe.reduce((a, p) => a + p.err, 0) / pe.length, worst = pe.reduce((a, p) => p.err > a.err ? p : a);
      pins += ` shot ${s.id}: ${pe.length} pins, ${(mean * 100).toFixed(1)}% of the frame off on average, ${(worst.err * 100).toFixed(1)}% at most (${worst.name})`;
      if (mean > 0.02 || worst.err > 0.045) errs.push(`${L}: shot ${s.id} has drifted off its photo: ${(mean * 100).toFixed(1)}% on average, ${worst.name} ${(worst.err * 100).toFixed(1)}%`);
    }
  }
  report.push(`  ${name}: ${(S.roads || []).length} roads, ${(S.buildings || []).length} buildings, ${(S.things || []).length} things, ${(S.fences || []).length} fences, ${tris} triangles, ${st.slots} materials.${pins}`);
}
console.log(`${nb} buildings from ${SP ? Object.keys(SP.STYLES).length : 0} styles (${Math.round(tb / Math.max(1, nb))} triangles each on average), ${Object.keys(SG.WIN_STYLES).length} window styles × ${Object.keys(SG.GROUND_STYLES).length} ground floors, ${Object.keys(SG.PART_KINDS).length} parts, ${Object.keys(SG.ROOF_KINDS).length} roofs, ${Object.keys(SG.THING_KINDS).length} things, ${Object.keys(SG.FENCE_KINDS).length} fences; ${names.length} streets:`);
for (const r of report) console.log(r);
for (const w of warns) console.log("warning: " + w);
for (const e of errs.slice(0, 40)) console.log("ERROR: " + e);
console.log(errs.length ? `STREET FAILED (${errs.length})` : "STREET ok");
process.exit(errs.length ? 1 : 0);

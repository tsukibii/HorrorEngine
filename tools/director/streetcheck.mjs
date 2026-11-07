// The street builder's check (docs/STREET_BUILDER.md §6): every building style at six seeds, every window and ground
// floor style, every part, roof, road mark, thing and fence builds with no stray number, inside its triangle budget and
// the same twice, and with no clipping: no two faces of a piece facing the same way in one plane over each other (they'd
// flicker); a wall's rectangles and its holes tile it exactly; a set's outside joins its roofs over any outline (an L,
// a T) and stays over the level's top; and every street in Content/Studio/Streets is well formed (ids, kinds, its poles'
// wires, its shots) and builds, each shot's pins landing where its photo has them.
// Ends "STREET ok".   node tools/director/streetcheck.mjs [--street NAME]
import fs from "fs";
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const load = async f => { try { return await import(pathToFileURL(path.join(ROOT, f)).href); } catch (e) { if (!(e instanceof SyntaxError)) throw e; return await import("data:text/javascript;base64," + fs.readFileSync(path.join(ROOT, f)).toString("base64")); } };
const SG = await load("tools/director/street-gen.js");
const SP = await (async () => { try { return await import(pathToFileURL(path.join(ROOT, "tools/director/street-presets.js")).href); } catch (e) { return null; } })();
const errs = [], warns = [], args = process.argv.slice(2), only = args.includes("--street") ? args[args.indexOf("--street") + 1] : null;
const BUDGET = { building: 30000, thing: 3000, fence: 6000, road: 6000, ground: 400000 };
// clipping: two triangles of a piece facing the same way, one within NEAR of the other's plane where they overlap by
// more than a square centimetre (what flickers as the depth buffer picks between them). Faces down on the ground are
// never seen and don't count.
const NEAR = 0.004, MIN_OVERLAP = 1e-4;
const v3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] };
function clipLeft(poly, a, b) {
  const res = [], side = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
    if (sp >= 0) res.push(p);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); res.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return res;
}
const area2 = P => { let s = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
function clashes(G) {
  const tris = [];
  for (const [slot, g] of Object.entries(G)) for (let i = 0; i < g.idx.length; i += 3) {
    const v = [0, 1, 2].map(k => { const j = g.idx[i + k] * 3; return [g.pos[j], g.pos[j + 1], g.pos[j + 2]]; });
    let n = v3.cross(v3.sub(v[1], v[0]), v3.sub(v[2], v[0])); const l = Math.hypot(...n); if (l < 1e-8) continue; n = n.map(x => x / l);
    tris.push({ slot, v, n, d: v3.dot(n, v[0]) });
  }
  if (!tris.length) return [];
  let zmin = Infinity; for (const t of tris) for (const v of t.v) if (v[2] < zmin) zmin = v[2];   // (no spread: the ground has a hundred thousand)
  const B = new Map(), hits = [];
  for (const t of tris) { const k = t.n.map(x => Math.round(x * 100)).join(",") + "|" + Math.round(t.d / NEAR); if (!B.has(k)) B.set(k, []); B.get(k).push(t); }
  for (const [k, list] of B) {
    const [nk, dk] = k.split("|"), all = list.slice();
    for (const dd of [-1, 1]) { const o = B.get(nk + "|" + (+dk + dd)); if (o) all.push(...o); }
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = list[i], b = all[j];
      if (v3.dot(a.n, b.n) < 0.9995 || b.v.some(p => Math.abs(v3.dot(a.n, v3.sub(p, a.v[0]))) > NEAR)) continue;
      if (a.n[2] < -0.9 && Math.max(...a.v.map(p => p[2])) < zmin + 0.03) continue;
      const u = Math.abs(a.n[2]) < 0.9 ? v3.cross([0, 0, 1], a.n) : v3.cross([1, 0, 0], a.n), ul = Math.hypot(...u), U = u.map(x => x / ul), V = v3.cross(a.n, U);
      const to2 = p => [v3.dot(p, U), v3.dot(p, V)];
      let A = a.v.map(to2), Bq = b.v.map(to2);
      if (area2(A) < 0) A.reverse(); if (area2(Bq) < 0) Bq.reverse();
      let P = A; for (let e = 0; e < 3 && P.length; e++) P = clipLeft(P, Bq[e], Bq[(e + 1) % 3]);
      const ar = P.length >= 3 ? Math.abs(area2(P)) : 0;
      if (ar > MIN_OVERLAP) hits.push({ a: a.slot, b: b.slot, area: ar, at: a.v[0] });
    }
  }
  return hits;
}
{ // the test itself: two slabs' tops in one plane over each other are found, a GAP apart they aren't
  const quad = (z, x0) => ({ pos: [x0, 0, z, x0 + 1, 0, z, x0 + 1, 1, z, x0, 1, z], idx: [0, 1, 2, 0, 2, 3] });
  if (clashes({ a: quad(1, 0), b: quad(1.001, 0.5) }).length < 1) errs.push("the clipping test doesn't find two faces in one plane over each other");
  if (clashes({ a: quad(1, 0), b: quad(1 + SG.GAP, 0.5) }).length) errs.push("the clipping test finds faces a GAP apart");
}
function noClipping(label, p) {
  if (p.type === "inside" || !p.G) return;                            // the stand-in rooms: never exported
  const by = {};
  for (const h of clashes(p.G)) { const k = [h.a, h.b].sort().join(" and "); (by[k] = by[k] || { n: 0, area: 0, at: h.at }).n++; by[k].area += h.area; }
  for (const [k, v] of Object.entries(by)) errs.push(`${label}: ${p.id}: ${k} in one plane over each other (${v.n} places, ${(v.area * 1e4).toFixed(0)} cm², at ${v.at.map(x => x.toFixed(2)).join(", ")}): they'd flicker`);
}
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
    noClipping(label, p);
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
// the stair stacks (DECISIONS 2026-11-06): every form, style, rail and shaft up four floors, beside a walkway and not,
// and the single flights (the older streets' concrete one, the Motel's steel switchback) as one-stage stacks; each
// built clean and on the line rule (the user, 2026-11-06, the red line: nothing of a stack above its rails' lines)
const stackParts = [];
for (const form of ["zigzag", "straight", "dogleg"]) for (const style of ["concrete", "steel"]) for (const rail of ["pickets", "panel", "parapet", "pipe", "none"]) for (const shaft of ["none", "walls"]) for (const gap of [0, 1.3])
  stackParts.push([`stairs ${form} ${style} ${rail} ${shaft}${gap ? " beyond a walkway" : ""}`, { kind: "stairs", face: "front", x: 0, w: 7, out: 1.1, floors: [1, 4], form, style, rail, shaft, gap, walkway: gap > 0 }, gap]);
stackParts.push(["one concrete flight", { kind: "stairs", face: "left", w: 6, h: 3.3, out: 1.2, dir: 1 }, 0], ["one concrete flight the other way", { kind: "stairs", face: "front", w: 6, h: 3.3, out: 1.2, dir: -1 }, 0],
  ["the motel's steel switchback", { kind: "stairs", face: "left", x: 0.7, w: 5.2, h: 3.05, out: 1.1, dir: 1, walkway: true, style: "steel", turn: "u" }, 0], ["a steel flight", { kind: "stairs", face: "front", w: 5, h: 3, out: 1.1, dir: -1, style: "steel" }, 0]);
for (const [label, part, gap] of stackParts) {
  sane(label, SG.build({ buildings: [Object.assign({}, base, { parts: [part, ...(gap > 0 ? [{ kind: "balcony", face: "front", x: 0, w: 9, out: 1.3, floors: [2, 4], rail: "rail", slot: "concrete", walkway: true }] : [])] })], ground: false }), () => BUDGET.building);
  const r = SG.stackLineFaults(part, base);
  if (r.faults.length) errs.push(`${label}: ${r.faults.length} vertices stand above the rails' lines (e.g. ${r.faults[0].slot} ${r.faults[0].over} m over at u ${r.faults[0].u}, n ${r.faults[0].n}, z ${r.faults[0].z})`);
}
for (const kind of Object.keys(SG.ROOF_KINDS)) for (const ridge of ["x", "y"])
  sane(`roof ${kind} ${ridge}`, SG.build({ buildings: [Object.assign({}, base, { roof: { kind, ridge, things: [{ kind: "tank", x: 1 }] }, tiers: [{ floors: 2, inset: [1.5, 1, 1, 1] }] })], ground: false }), () => BUDGET.building);
for (const thing of Object.keys(SG.ROOF_THINGS)) for (const kind of ["flat", "rail", "hip"])   // each thing on its own roof
  sane(`a ${thing} on a ${kind} roof`, SG.build({ buildings: [Object.assign({}, base, { roof: { kind, things: [{ kind: thing, x: 0.5, y: -0.5 }] } })], ground: false }), () => BUDGET.building);
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
// 3b. the rules between pieces (the user, 2026-11-03: "make it that the interior/street editors carry rules to keep
// everything proper"): a street of everything that once met another piece in one plane, built, and never two pieces'
// faces in one plane over each other (SG.between: they flicker in Godot as the depth buffer picks between them).
// Neighbours' canopies, bands, copings, eaves and hips (one set back), balconies cut at a neighbour, a side street's
// pavement over the main road's, a lane run up to a building's side, fences at corners and T's, slabs flush with walls,
// decals on a road's paint and on each other, the ground under it all
{
  const B = (id, at, turn, o) => Object.assign({ id, at, turn }, o);
  const danchi = (id, w, d, floors, at) => B(id, at, 0, { style: "danchi", w, d, floors, gh: 3.3, fh: 2.8, seed: 7, faces: { front: { win: "punched", cols: 5, ground: "shutter", bands: true }, back: { win: "punched" } },
    roof: { kind: "flat", parapet: 0.7 }, parts: [{ kind: "canopy", x: 0, z: 3.2, w: w + 0.6, h: 0.45, out: 2.2 }, { kind: "stairs", face: "left", w: 6, h: 3.3, out: 1.2, dir: 1 },
      { kind: "balcony", face: "front", x: 0, w: w - 1.2, out: 1.3, floors: [2, floors], rail: "rail", slot: "concrete", walkway: true }, { kind: "stairs", face: "front", x: 1, w: 7.4, out: 1.1, floors: [1, floors], form: "zigzag", style: "concrete", rail: "pickets", gap: 1.3, dir: 1, walkway: true }] });   // (the walkway short of the neighbours: their railings never in one line)
  const shop = (id, w, at) => B(id, at, -90, { style: "shotengai", w, d: 11.5, floors: 3, gh: 3.4, fh: 2.8, seed: 3, faces: { front: { win: "punched", ground: "shop" }, back: { win: "punched" } },
    roof: { kind: "flat" }, parts: [{ kind: "sign", x: 0, z: 3.65, w: w - 0.6, h: 0.9, text: "テスト" }, { kind: "awning", x: 0, z: 3.25, w: w - 0.2, h: 0.45, out: 1.3 }] });
  const house = (id, w, d, turn, roof, at) => B(id, at, turn, { style: "house", w, d, floors: 2, gh: 2.9, fh: 2.7, seed: 5, roof, faces: { front: { win: "punched", ground: "door", bands: true } },
    parts: [{ kind: "canopy", x: 0, z: 2.35, w: 1.6, h: 0.12, out: 0.8 }] });
  const machiya = (id, w, at) => B(id, at, -180, { style: "machiya", w, d: 10.5, floors: 2, gh: 2.8, fh: 2.4, seed: 9, roof: { kind: "gable", pitch: 26, over: 1 }, faces: { front: { win: "lattice", ground: "lattice" }, left: { win: "none" }, right: { win: "none" } },
    parts: [{ kind: "eave", z: 2.95, out: 1, h: 0.5 }, { kind: "noren", x: -1.7, z: 1.55, w: 1.3 }] });
  const R = {
    roads: [{ id: "main", from: [-40, 0], to: [40, 0], width: 6, walks: [1.6, 1.6], kerb: 0.15, edge: [0.3, 0.3], marks: [{ kind: "text", text: "止まれ", at: 10, x: 1 }, { kind: "stop", at: 20 }] },
      { id: "side", from: [-17.5, 0], to: [-17.5, 30], width: 5, walks: [0, 1.2], kerb: 0.12 },
      { id: "lane", from: [119.625, -9], to: [119.625, 11.6], width: 4.45, walks: [0.4, 1.1], kerb: 0.15 }],
    buildings: [
      danchi("d1", 18, 11, 4, [-60, 40]), danchi("d2", 15, 9.5, 5, [-43.48, 39.57]), danchi("d3", 15, 9.5, 5, [-28.46, 39.57]),   // d2 set back 32 cm
      shop("s1", 5, [0, 60]), shop("s2", 6.5, [0.25, 65.77]),
      house("h1", 7, 9.5, 0, { kind: "flat", parapet: 0.5 }, [30, 60]), house("h2", 8, 9.5, 0, { kind: "flat", parapet: 0.5 }, [22.48, 60]),
      house("h3", 7.5, 7.5, 90, { kind: "hip", pitch: 27, over: 0.5 }, [60, 60]), house("h4", 7, 9.5, -180, { kind: "hip", pitch: 27, over: 0.5 }, [51.84, 61.64]),
      house("h5", 7, 9, 0, { kind: "gable", pitch: 25, over: 0.6, ridge: "y" }, [60, 80]), house("h6", 7, 9, 0, { kind: "shed", pitch: 12, over: 0.5 }, [67.03, 80]),
      machiya("m1", 8.5, [80, 60]), machiya("m2", 6.5, [87.52, 60]),
      B("f1", [0, 100], 0, { style: "apartment", w: 9, d: 11, floors: 3, gh: 3.1, fh: 2.9, seed: 4, roof: { kind: "flat", parapet: 0.9 },
        parts: [{ kind: "balcony", x: 4.17, w: 3.92, out: 1.1, floors: [2, 4], rail: "solid" }, { kind: "ac", x: 5.6, z: 0.05, out: 0.3, floors: [2, 4] }] }),
      B("f2", [8.52, 100], 0, { style: "apartment", w: 8, d: 11, floors: 3, gh: 3.1, fh: 2.9, seed: 6 }),
      B("end", [128.35, 1.25], -90, { style: "office", w: 20.5, d: 12, floors: 2, gh: 3.1, fh: 3.4, seed: 3 }),   // the lane runs up to its side
      B("set1", [100, 60], 0, { style: "house", w: 10, d: 9, floors: 2, gh: 3.2, fh: 3.0, seed: 23, roof: { kind: "flat", parapet: 0.3 }, tiers: [{ floors: 1, inset: [2, 1.5, 1, 0] }] }),   // a setback flush on a side
      B("set2", [115, 60], 0, { style: "house", w: 10, d: 9, floors: 2, gh: 3.2, fh: 3.0, seed: 23, roof: { kind: "flat", parapet: 0.3 }, tiers: [{ floors: 1, inset: [0, 2, 1.5, 1], edge: "wall" }] }),
    ],
    fences: [
      { id: "fw", kind: "blockmesh", from: [-62, -40], to: [-40, -40], h: 1.9 }, { id: "fs", kind: "mesh", from: [-62, -40], to: [-62, -20], h: 2.4 },
      { id: "c1", kind: "block", from: [-30, -40], to: [-20, -40] }, { id: "c2", kind: "block", from: [-20, -40], to: [-20, -30] },
      { id: "t1", kind: "mesh", from: [-10, -40], to: [10, -40] }, { id: "t2", kind: "block", from: [0, -40], to: [0, -30] },
      { id: "r1", kind: "ribbed", from: [20, -40], to: [30, -40], h: 1.5 }, { id: "r2", kind: "mesh", from: [30, -40], to: [30, -30] },
      { id: "rw", kind: "ribbed", from: [55, -40], to: [65, -40], h: 1.5 }, { id: "lot", kind: "block", from: [70, -40], to: [76.9, -40], h: 0.9 },
      { id: "cw", kind: "block", from: [-30, -70], via: [[-15, -64.5], [0, -63]], to: [15, -64.5], h: 1.8, slot: "concrete" },   // curved (`via`)
      { id: "cm", kind: "mesh", from: [30, -70], via: [[45, -64]], to: [60, -70] }, { id: "cr", kind: "ribbed", from: [70, -70], via: [[80, -66]], to: [90, -70], h: 1.5 },
    ],
    things: [
      { id: "apron", kind: "box", at: [60, -44.95], w: 10, d: 10, h: 0.02, slot: "asphalt" },        // to the ribbed wall's far face
      { id: "forecourt", kind: "box", at: [81.1, -39.2], w: 22.2, d: 2.4, h: 0.02, slot: "concrete" },   // its end on the block wall's
      { id: "planter", kind: "box", at: [-35, -45], w: 1, d: 0.6, h: 0.5 }, { id: "bed", kind: "box", at: [-35, -45], w: 3, d: 2, h: 0.1 },
    ],
    decals: [{ id: "dg", kind: "manhole", at: [-29, -1, 0.004], n: [0, 0, 1], w: 0.75, h: 0.75, rot: -30 },   // on the glyph
      { id: "dd", kind: "oil", at: [-28.7, -1.1, 0.004], n: [0, 0, 1], w: 0.8, h: 0.6 },                     // over the one before
      { id: "ds", kind: "oil", at: [-20, 0, 0.004], n: [0, 0, 1], w: 1.2, h: 0.8 }],                      // over the stop line
  };
  { // a curved wall (a fence's `via`): its cap's top whole, mitred at every joint (no gap; an overlap the clipping test finds)
    const f = { id: "cv", kind: "block", from: [0, 0], via: [[10, 4], [20, 3]], to: [28, -4], h: 1.5 }, p = SG.build({ fences: [f] }).find(q => q.id === "cv"), top = [];
    for (const g of Object.values(p.G)) for (let i = 0; i < g.idx.length; i += 3) { const v = [0, 1, 2].map(k => g.pos.slice(g.idx[i + k] * 3, g.idx[i + k] * 3 + 3)); if (v.every(q => Math.abs(q[2] - 1.56) < 1e-3)) top.push(v); }
    const inTri = (x, y, v) => { const sd = (a, b) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]), d = [sd(v[0], v[1]), sd(v[1], v[2]), sd(v[2], v[0])]; return d.every(e => e >= -1e-9) || d.every(e => e <= 1e-9); };
    const L = SG.fenceLine(f); let miss = 0;
    for (let i = 0; i + 1 < L.length; i++) for (let k = 0; k <= 10; k++) for (const q of [-0.09, 0, 0.09]) {
      const a = L[i], b = L[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], x = a[0] + t[0] * len * k / 10 - t[1] * q, y = a[1] + t[1] * len * k / 10 + t[0] * q;
      if (!top.some(v => inTri(x, y, v))) miss++;
    }
    if (L.length < 8 || miss) errs.push(`a curved wall: ${L.length} points along its curve, its top missing at ${miss} places along it`);
  }
  const P = SG.build(R), hits = SG.between(P);
  sane("the rules street", P, p => BUDGET[p.type] || 20000);
  for (const h of hits.slice(0, 8)) errs.push(`the rules street: ${h.a.join("'s ")} and ${h.b.join("'s ")} in one plane over each other (${(h.area * 1e4).toFixed(0)} cm², at ${h.at.map(v => v.toFixed(2)).join(", ")}): a rule's missing`);
  if (JSON.stringify(R).includes("capFrom")) errs.push("building a street wrote into its fences");
  // and the test finds what's been placed so: two bikes in each other, a slab's top on another's
  const H = SG.between(SG.build({ things: [{ id: "k1", kind: "bike", at: [0, 0], turn: 90 }, { id: "k2", kind: "bike", at: [0, 1.2], turn: 90 },
    { id: "k3", kind: "box", at: [10, 0], w: 2, d: 2, h: 0.02 }, { id: "k4", kind: "box", at: [11, 0], w: 2, d: 2, h: 0.02 }], ground: false }));
  for (const pair of [["k1", "k2"], ["k3", "k4"]]) if (!H.some(h => [h.a[0], h.b[0]].sort().join() === pair.join())) errs.push(`the test between pieces doesn't find ${pair.join(" in ")}`);
}
// 4. a wall's rectangles and its holes tile it, nothing twice and nothing missed
{ let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 200; n++) {
    const W = 3 + R() * 9, H = 3, holes = [];
    for (let k = 0; k < 6; k++) { const u0 = R() * (W - 0.6), w = 0.3 + R() * 1.5, z0 = R() * 2.2, h = 0.3 + R() * 0.8; const h0 = { u0, u1: Math.min(W, u0 + w), z0, z1: Math.min(H, z0 + h) }; if (!holes.some(q => q.u0 < h0.u1 && q.u1 > h0.u0 && q.z0 < h0.z1 && q.z1 > h0.z0)) holes.push(h0); }
    const rects = SG.wallRects(W, 0, H, holes), area = rects.reduce((s, [a, b, p, q]) => s + (b - a) * (q - p), 0) + holes.reduce((s, h) => s + (h.u1 - h.u0) * (h.z1 - h.z0), 0);
    if (Math.abs(area - W * H) > 1e-6) { errs.push(`a wall's rectangles don't tile it (${area.toFixed(4)} of ${(W * H).toFixed(4)})`); break; }
  } }
// 5. a curved street that climbs: through its bend at the bend's height, longer than straight, the ground following it,
// a lamp on its pavement standing on the pavement, a building on the slope carried down to the ground by its plinth,
// a fence's posts each on the ground under it, a pavement cut where a curved street crosses
{
  const hill = { roads: [{ id: "h", from: [0, -30], via: [[12, 0]], to: [0, 30], z: [0, 3, 6], width: 6, walks: [2, 2] }, { id: "x", from: [-35, -30], to: [0, -30], width: 5, walks: [1.5, 1.5] }],
    buildings: [], things: [], fences: [] };
  const f = SG.roadPath(hill.roads[0]), T = SG.terrain(hill), nb = f.nearest(12, 0);
  if (nb.d > 0.05) errs.push(`a curved street misses its bend by ${nb.d.toFixed(3)} m`);
  if (Math.abs(nb.z - 3) > 0.05) errs.push(`a curved street is ${nb.z.toFixed(2)} m up at its 3 m bend`);
  if (!(f.L > 62 && f.L < 75)) errs.push(`a curved street is ${f.L.toFixed(1)} m long (bent through 12 m: 62 to 75)`);
  const walkAt = f.at(nb.s - 8, f.W / 2 + 1), lampZ = T.surface(walkAt[0], walkAt[1]), roadZ = f.z(nb.s - 8);
  if (Math.abs(lampZ - (roadZ + f.kerb)) > 0.02) errs.push(`the pavement's top is ${lampZ.toFixed(2)}, the road's ${roadZ.toFixed(2)} + the kerb`);
  const fr = f.frame(nb.s + 9), bAt = f.at(nb.s + 9, -(f.W / 2 + f.walks[1] + 5.2));
  hill.buildings.push({ id: "hb", at: [bAt[0], bAt[1]], turn: Math.atan2(fr.n[0], -fr.n[1]) * 180 / Math.PI, w: 8, d: 10, floors: 2, gh: 3, fh: 2.8, faces: { front: { win: "punched", ground: "door" } } });
  hill.things.push({ id: "lamp", kind: "lamp", at: [walkAt[0], walkAt[1]] });
  const fa = f.at(10, -(f.W / 2 + f.walks[1] + 0.5)), fb = f.at(25, -(f.W / 2 + f.walks[1] + 0.5));
  hill.fences.push({ id: "fn", kind: "mesh", from: [fa[0], fa[1]], to: [fb[0], fb[1]] });
  const P = SG.build(hill), get = id => P.find(p => p.id === id);
  sane("a curved street that climbs", P, p => BUDGET[p.type] || 20000);
  const minZ = p => { let m = Infinity; for (const g of Object.values(p.G)) for (let i = 2; i < g.pos.length; i += 3) m = Math.min(m, g.pos[i]); return m; };
  if (Math.abs(minZ(get("lamp")) - lampZ) > 0.02) errs.push(`a lamp on a sloped pavement stands at ${minZ(get("lamp")).toFixed(2)}, the pavement's at ${lampZ.toFixed(2)}`);
  const foot = SG.footing(hill.buildings[0], T);
  if (!(foot.z - foot.low > 0.05) || !get("hb").G.plinth) errs.push(`a building on the slope has no plinth (it falls ${(foot.z - foot.low).toFixed(2)} m under it)`);
  else if (Math.abs(minZ(get("hb")) - (foot.low - 0.05)) > 0.02) errs.push(`its plinth reaches ${minZ(get("hb")).toFixed(2)}, the ground under it ${foot.low.toFixed(2)}`);
  const fg = get("fn").G.post, posts = [];
  for (let i = 0; fg && i < fg.pos.length; i += 3) posts.push(fg.pos[i + 2]);
  if (!posts.length || Math.abs(Math.min(...posts) - T.surface(fa[0], fa[1])) > 0.1 || Math.max(...posts) - Math.min(...posts) < 0.5) errs.push("a fence on the slope doesn't step with the ground under its posts");
  const g = get("_ground").G.ground; let near = Infinity;
  let gx = 0, gy = 0, gz = 0;
  for (let i = 0; g && i < g.pos.length; i += 3) { const d = Math.hypot(g.pos[i] - 21, g.pos[i + 1]); if (d < near) { near = d; gx = g.pos[i]; gy = g.pos[i + 1]; gz = g.pos[i + 2]; } }
  if (!(gz > 2 && Math.abs(gz - T.ground(gx, gy) + 0.06) < 0.05)) errs.push(`the ground beside the 3 m bend is at ${gz.toFixed(2)}, not following the street`);
  const xw = get("x").G.pavement; let onRoad = !xw;
  for (let i = 0; xw && i < xw.pos.length; i += 3) { const q = f.nearest(xw.pos[i], xw.pos[i + 1]); if (q.s > 1 && q.s < f.L - 1 && Math.abs(q.q) < f.W / 2 - 0.3) { onRoad = true; break; } }
  if (onRoad) errs.push("a pavement runs across the curved street that crosses it");
}
// 5b. the cache: a piece built again only when its numbers change, and the same as built fresh
{
  const cache = new Map(), town = { roads: roads.slice(0, 1), buildings: [Object.assign({}, base, { id: "c1", at: [9, 0], turn: 90 }), Object.assign({}, base, { id: "c2", at: [-9, 0], turn: -90 })], things: [{ id: "c3", kind: "vending", at: [4, 3] }] };
  const a = SG.build(town, cache); town.buildings[0].floors = 6; const b = SG.build(town, cache);
  if (a.find(p => p.id === "c2") !== b.find(p => p.id === "c2")) errs.push("the cache built an unchanged building again");
  if (a.find(p => p.id === "c1") === b.find(p => p.id === "c1")) errs.push("the cache kept a building whose floors changed");
  if (JSON.stringify(b.map(p => p.G)) !== JSON.stringify(SG.build(town).map(p => p.G))) errs.push("a build from the cache isn't the same as a fresh one");
}
// 5c. a building with a set inside: every outside door and window of the set cut through its shell at its place, a
// marker for every copy (rows x floors), its plan size the shell's, its walls hollow (colliders round its doors)
const SETS_DIR = path.join(ROOT, "Content/Studio/Sets"), setLevel = (set, level) => { const f = path.join(SETS_DIR, set, "story.json"); if (!fs.existsSync(f)) return null; const L = JSON.parse(fs.readFileSync(f, "utf8")).levels || {}; return L[level] || Object.values(L)[0] || null; };
for (const [set, extra] of [["motel_room", { rows: 4, floors: 2 }], ["bungalow", { raise: 0.45 }]]) {
  const lv = setLevel(set); if (!lv) continue;
  const ins = Object.assign({ set, rooms: SG.insideRooms(lv) }, extra), b = Object.assign({ id: set, at: [3, -2], turn: 35, inside: ins }, SG.insideSize({ inside: ins }));
  const P = SG.build({ buildings: [b], ground: false }), L = `the set ${set} inside a building`;
  sane(L, P, () => BUDGET.building);
  if (!P.find(p => p.type === "inside")) errs.push(`${L}: no stand-in rooms`);
  const ol = SG.insideOutline(SG.insideFrame(ins).rooms), holes = ol.edges.reduce((a, e) => a + (e.holes || []).length, 0);
  const outside = ins.rooms.filter(r => r.ceiling !== false).reduce((a, r) => a + (r.openings || []).filter(o => { const nb = ins.rooms.some(q => q !== r && q.ceiling !== false && touches(r, o, q)); return !nb; }).length, 0);
  if (holes < 1 || holes < outside) errs.push(`${L}: ${holes} holes in its shell for ${outside} outside doors and windows`);
  const M = SG.insideMarkers(b, { z: 0, low: 0 }), want = (extra.rows || 1) * (extra.floors || 1);
  if (M.length !== want || !M.every(m => m.meta.set === set)) errs.push(`${L}: ${M.length} markers (${want} copies)`);
  const sz = SG.insideSize(b), bb = (() => { const p = P.find(p => p.type === "building"), lo = [Infinity, Infinity], hi = [-Infinity, -Infinity]; for (const g of Object.values(p.G)) for (let i = 0; i < g.pos.length; i += 3) { lo[0] = Math.min(lo[0], g.pos[i]); hi[0] = Math.max(hi[0], g.pos[i]); } return hi[0] - lo[0]; })();
  void bb; if (!(sz.w > 0 && sz.d > 0)) errs.push(`${L}: no size`);
  const B = SG.blockers({ buildings: [b] }, P)[set];
  if (!B || B.boxes.length < 8) errs.push(`${L}: its walls aren't hollow colliders (${B ? B.boxes.length : 0} boxes)`);
}
// 5d. a set's outside (its level's `outside`, the scene builder's Outside panel): every set's builds clean round its
// rooms, the same twice, its fittings for walls only; and a street's building follows it until it's changed there
for (const set of fs.existsSync(SETS_DIR) ? fs.readdirSync(SETS_DIR) : []) {
  const f = path.join(SETS_DIR, set, "story.json"); if (!fs.existsSync(f)) continue;
  for (const [lid, lv] of Object.entries(JSON.parse(fs.readFileSync(f, "utf8")).levels || {})) {
    if (!lv.outside) continue;
    const L = `the set ${set}'s outside (${lid})`, b = SG.outsideBuilding(lv, lv.outside);
    if (!b) { errs.push(`${L}: no enclosed rooms on its ground floor to build round`); continue; }
    const P = once(L, { buildings: [b], ground: false });
    const tris = sane(L, P, () => BUDGET.building);
    if (!(tris > 50)) errs.push(`${L}: built nothing (${tris} triangles)`);
    if (!SG.ROOF_KINDS[(lv.outside.roof || {}).kind || "hip"]) errs.push(`${L}: no roof kind ${(lv.outside.roof || {}).kind}`);
    for (const pt of lv.outside.parts || []) if (!SG.OUTSIDE_PARTS.includes(pt.kind)) errs.push(`${L}: ${pt.kind} isn't something for a wall`);
    const faces = SG.outsideFaces(lv, lv.outside);
    if (!faces || new Set(Object.values(faces)).size !== 4) errs.push(`${L}: its faces ${JSON.stringify(faces)}`);
  }
}
// 5e. a set whose rooms don't fill a box (an L, a T, steps, two apart): one roof over its outline under every roof kind
// (a flat one's parapet round the outline only, pitched ones joined in valleys), no clipping, and every roof over the
// level's own top (the walls' top, where the level's walls and ceilings end)
{
  const room = (id, at, size) => ({ id, at, size: [...size, 2.4], openings: [] });
  const SHAPES = { L: [room("a", [0, 0], [6, 4]), room("b", [0, 4], [3, 3])], T: [room("a", [0, 0], [9, 3]), room("b", [3, 3], [3, 4])],
    steps: [room("a", [0, 0], [4, 4]), room("b", [4, 1], [3, 4]), room("c", [7, 2], [2, 4])], apart: [room("a", [0, 0], [4, 4]), room("b", [6, 0], [3, 3])],
    U: [room("a", [0, 0], [8, 3]), room("b", [0, 3], [3, 4]), room("c", [5, 3], [3, 4])] };
  const ROOFY = ["tiles", "roof_flat"];
  for (const [shape, rooms] of Object.entries(SHAPES)) for (const kind of Object.keys(SG.ROOF_KINDS)) {
    const b = SG.outsideBuilding({ rooms }, { roof: { kind, pitch: 24, over: 0.6, parapet: 0.6 }, raise: 0.15 }), L = `a set shaped ${shape} under a ${kind} roof`;
    if (!b) { errs.push(`${L}: no building`); continue; }
    const P = once(L, { buildings: [b], ground: false }), shell = P.find(p => p.type === "building"), ins = P.find(p => p.type === "inside");
    sane(L, P, () => BUDGET.building);
    let low = Infinity, top = -Infinity, roofTris = 0;
    for (const s of ROOFY) { const g = shell && shell.G[s]; for (let i = 2; g && i < g.pos.length; i += 3) low = Math.min(low, g.pos[i]); roofTris += g ? g.idx.length / 3 : 0; }
    for (const g of Object.values(ins ? ins.G : {})) for (let i = 2; i < g.pos.length; i += 3) top = Math.max(top, g.pos[i]);
    if (!(roofTris > 0)) errs.push(`${L}: no roof`);
    else if (!(low >= top + 0.1 - 1e-6)) errs.push(`${L}: the roof comes down to ${low.toFixed(3)}, the level's top is ${(top + 0.1).toFixed(3)}`);
  }
}
{
  const out = { look: { wall: "#cfc5b3", tiles: "#3d4148" }, roof: { kind: "hip", pitch: 24, over: 0.8 }, raise: 0.45, parts: [{ kind: "ac", face: "right" }] };
  const b = { id: "t", look: { wall: "#111111" }, roof: { kind: "flat" }, parts: [], inside: { set: "x", rooms: [] } };
  const steps = [["put on", SG.applyOutside(b, out) && b.look.wall === "#cfc5b3" && b.inside.raise === 0.45 && b.parts.length === 1 && !!b.inside.from],
    ["the same again changes nothing", SG.applyOutside(b, JSON.parse(JSON.stringify(out))) === false],
    ["keys in another order are the same outside", SG.applyOutside(b, { raise: 0.45, parts: [{ face: "right", kind: "ac" }], roof: { over: 0.8, pitch: 24, kind: "hip" }, look: { tiles: "#3d4148", wall: "#cfc5b3" } }) === false]];
  b.roof.pitch = 30;
  steps.push(["changed in the street: its own from then on", SG.applyOutside(b, out) && b.inside.own === true && b.roof.pitch === 30]);
  steps.push(["its own: the set's never put on", SG.applyOutside(b, Object.assign({}, out, { raise: 1 })) === false && b.inside.raise === 0.45]);
  delete b.inside.own; delete b.inside.from;
  steps.push(["following the set again", SG.applyOutside(b, out) && b.roof.pitch === 24]);
  steps.push(["a set with no outside leaves it be", SG.applyOutside(b, null) === false && b.roof.pitch === 24]);
  for (const [what, ok] of steps) if (!ok) errs.push(`a set's outside on a street's building: ${what}`);
}
function touches(r, o, q) {                                           // the room behind an opening, if one's there
  const [x0, y0] = r.at, [w, d] = r.size, at = +o.at || 0;
  const p = { n: [x0 + at, y0 + d + 0.05], s: [x0 + at, y0 - 0.05], e: [x0 + w + 0.05, y0 + at], w: [x0 - 0.05, y0 + at] }[o.wall];
  return p && p[0] > q.at[0] && p[0] < q.at[0] + q.size[0] && p[1] > q.at[1] && p[1] < q.at[1] + q.size[1];
}
const budgetOf = (S, p) => p.type === "ground" ? BUDGET.ground : p.type === "road" && (S.roads || []).some(r => r.id === p.id && SG.roadKind(r) === "river") ? BUDGET.river : BUDGET[p.type] || 20000;
// 5f. the outdoors (docs/STREET_NATURE_PLAN.md): a path with a bank rising beside it, a sunken lane with a mossy bank
// after a level strip, two flights of steps climbing their rise (sleepers, stone), hills and a ridge far off on a far
// ground in the forest cover, flats held level, scatters along the lane and in a circle; every new thing and fence (the
// loops above build them all); nothing in one plane
{
  const N = { roads: [
      { id: "path", kind: "path", from: [-10, -40], to: [-10, 40], width: 1.6, surface: "gravel", z: [0, 2], banks: [{ h: 1.5, w: 2 }, null] },
      { id: "lane", kind: "path", from: [0, -40], via: [[6, 0]], to: [0, 40], width: 2.4, surface: "soil", z: [0, -0.5, -1], banks: [{ h: 0.8, w: 2.5, kind: "moss", flat: 0.5 }, { h: 0.6, w: 2, kind: "soil" }] },
      { id: "steps", kind: "steps", from: [14, -10], to: [14, 10], width: 2.6, tread: "sleepers", z: [0, 3.4], rise: 0.17, banks: [{ h: 1, w: 2, kind: "moss" }] },
      { id: "steps2", kind: "steps", from: [20, -10], to: [20, 10], width: 3, tread: "stone", z: [0, 3.4] }],
    terrain: { cell: 1, far: { r: 200, cell: 30, cover: "forest" }, cover: "grass", patches: [{ kind: "soil", at: [16, 0], r: 3 }], hills: [{ at: [-250, 0], r: 150, h: 60 }, { ridge: [[0, 200], [200, 260]], r: 80, h: 90 }], noise: { amp: 0.4, scale: 12, seed: 3 }, flats: [{ at: [40, -30], r: 6, z: 3 }, { poly: [[-40, 20], [-30, 20], [-30, 30], [-40, 30]], z: -2 }] },
    things: [{ id: "b1", kind: "bridge", style: "wood", at: [3, 20], turn: 90, w: 14, d: 2.2, deck: 1.5 }, { id: "b2", kind: "bridge", style: "steel", at: [3, -20], turn: 90, w: 14, d: 3.5, deck: 1.8, piers: 1 }, { id: "b3", kind: "bridge", style: "arch", at: [3, 32], turn: 90, w: 16, d: 3, deck: 2 },
      { id: "lamp", kind: "belllamp", at: [15.8, -11] }, { id: "ch", kind: "chochin", at: [22, 11] }, { id: "sb", kind: "signboard", at: [18, 11], text: "テスト" }, { id: "rk", kind: "rock", at: [-5, 10], w: 1.4, d: 1, h: 0.8 }],
    fences: [{ id: "lr", kind: "lograil", from: [21.8, -12], to: [21.8, 12] }, { id: "sw", kind: "stonewall", from: [18, -12], to: [24, -12] }],
    scatters: [{ id: "grass", along: "lane", side: -1, off: [0.2, 2], every: 1.2, kind: "plant", w: 0.6, h: 0.4, size: [0.7, 1.3], seed: 1 }, { id: "canopy", at: [-60, 0], r: 30, density: 0.02, kind: "canopy", w: 5, h: 5 }] };
  const L = "the outdoors", T = SG.terrain(N), P = once(L, N), get = id => P.find(p => p.id === id), f = SG.roadPath(N.roads[1]);
  sane(L, P, p => budgetOf(N, p));
  const near = (a, b, tol, what) => { if (!(Math.abs(a - b) <= tol)) errs.push(`${L}: ${what}: ${(+a).toFixed(2)}, not ${(+b).toFixed(2)}`); };
  near(T.surface(-10, 0), 1.0, 0.02, "the path's height half way up");                 // its heights 0 to 2 over 80 m
  near(T.ground(-13.3, 0), 2.5, 0.5, "the ground at the path's bank's top (1.5 m over 2 m)");
  near(T.surface(6, 0), -0.5, 0.02, "the lane's level at the bend");
  near(T.ground(1.8, 0), 0.3, 0.45, "the ground at the top of the lane's mossy bank (0.8 m over 2.5 m after a level strip)");
  near(T.ground(5.2, 0), -0.5, 0.03, "the lane's level strip before its bank rises");
  if (T.cover(3.8, 0, false) !== "moss") errs.push(`${L}: the lane's bank wears ${T.cover(3.8, 0, false)}, not moss`);
  near(T.surface(14, -9.9), 0.17, 0.01, "the first sleeper step's tread"); near(T.surface(14, 9.9), 3.4, 0.01, "the top step's tread");
  near(T.ground(40, -30), 3, 0.01, "the ground on a round flat (held at its level)"); near(T.ground(-35, 25), -2, 0.01, "the ground on a polygon flat");
  if (Math.abs(T.ground(40, -30 - 6 - 20) - 3) < 0.3) errs.push(`${L}: the ground 20 m past the flat's edge is still at its level`);
  near(T.relief(-250, 0), 60, 0.5, "the hill's top far off (its relief)"); near(T.relief(100, 230), 90, 0.5, "the ridge's top (its relief)"); near(T.relief(-250, 160), 0, 0.5, "the ground past the hill's foot");
  if (T.cover(16, 0, false) !== "soil" || T.cover(-30, 20, false) !== "grass" || T.cover(-200, 100, true) !== "forest") errs.push(`${L}: the covers: ${T.cover(16, 0, false)}, ${T.cover(-30, 20, false)}, ${T.cover(-200, 100, true)}`);
  const tris = (p, slot) => { const g = p && p.G[slot]; return g ? g.idx.length / 3 : 0; };
  if (tris(get("lane"), "soil") < 20) errs.push(`${L}: the lane's strip: ${tris(get("lane"), "soil")} triangles`);
  if (tris(get("steps"), "sleeper") < 100 || tris(get("steps"), "strap") < 40 || tris(get("steps2"), "stone") < 200) errs.push(`${L}: the steps: ${tris(get("steps"), "sleeper")} sleeper, ${tris(get("steps"), "strap")} strap, ${tris(get("steps2"), "stone")} stone triangles`);
  if (SG.roadPath(N.roads[2]).nSteps !== 20 || SG.roadPath(N.roads[3]).nSteps !== 20) errs.push(`${L}: ${SG.roadPath(N.roads[2]).nSteps} and ${SG.roadPath(N.roads[3]).nSteps} steps for 3.4 m at 0.17 (20)`);
  const gnd = get("_ground"), gt = Object.entries(gnd ? gnd.G : {}).map(([k, g]) => [k, g.idx.length / 3]);
  if (!gnd || !gnd.G.grass || !gnd.G.soil || !gnd.G.forest || tris(gnd, "grass") < 5000) errs.push(`${L}: the ground's covers: ${JSON.stringify(gt)}`);
  const sc = SG.scatterThings(N), onLane = sc.filter(t => { const q = f.nearest(...t.at); return q.s >= 0 && q.s <= f.L && Math.abs(q.q) < f.wAt(q.s) / 2; });
  if (sc.length < 100 || sc.length > 220 || onLane.length || !sc.every(t => P.some(p => p.id === t.id))) errs.push(`${L}: ${sc.length} scattered (${onLane.length} on the lane), ${sc.filter(t => !P.some(p => p.id === t.id)).length} not built`);
  if (JSON.stringify(SG.scatterThings(N)) !== JSON.stringify(sc)) errs.push(`${L}: a scatter isn't the same twice`);
  const B = SG.blockers(N, P);
  if (!B.b1 || B.b1.boxes.length !== 3 || !B.lane || !(B.lane.surface.idx.length > 100) || !B.lr || !B.rk || B.grass_0) errs.push(`${L}: the colliders: a bridge ${B.b1 ? B.b1.boxes.length : 0} boxes, the lane ${B.lane ? B.lane.surface.idx.length / 3 : 0} triangles, a scattered plant ${!!B.grass_0}`);
  const hits = SG.between(P);
  for (const h of hits.slice(0, 6)) errs.push(`${L}: ${h.a.join("'s ")} and ${h.b.join("'s ")} in one plane over each other (${(h.area * 1e4).toFixed(0)} cm², at ${h.at.map(v => v.toFixed(2)).join(", ")})`);
}
// 6. the streets
const DIR = path.join(ROOT, "Content/Studio/Streets"), KNOWN = { roads: ["id", "from", "to"], buildings: ["id", "at", "w", "d", "floors"], things: ["id", "kind", "at"], fences: ["id", "kind", "from", "to"], shots: ["id", "eye", "look"], decals: ["id", "kind", "at", "n"] };
// the decals' kinds, from their maker (tools/streetbake/decals.py: its DECALS table)
const DECAL_KINDS = new Set([...fs.readFileSync(path.join(ROOT, "tools/streetbake/decals.py"), "utf8").matchAll(/^    "([a-z0-9_]+)": \("/gm)].map(m => m[1]));
if (DECAL_KINDS.size < 10) errs.push(`only ${DECAL_KINDS.size} decal kinds read from decals.py`);
{ // a decal: a quad facing out of its surface a GAP off it, the picture the right way up, on a wall and on the ground
  for (const [n, up] of [[[0, -1, 0], [0, 0, 1]], [[0, 0, 1], [0, 1, 0]], [[0.6, 0.8, 0], [0, 0, 1]]]) {
    const g = SG.decalParts({ id: "d", kind: "poster", at: [1, 2, 3], n, w: 0.6, h: 0.8, rot: 0 }).G["decal:poster"];
    const P = i => [g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]], off = P(0).map((v, k) => v - [1, 2, 3][k]).reduce((a, v, k) => a + v * n[k], 0);
    const e1 = P(1).map((v, k) => v - P(0)[k]), e2 = P(2).map((v, k) => v - P(0)[k]), fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const upIn = P(3).map((v, k) => v - P(0)[k]).reduce((a, v, k) => a + v * up[k], 0);   // the picture's top edge up its up
    if (Math.abs(off - SG.GAP) > 1e-6 || fn.reduce((a, v, k) => a + v * n[k], 0) <= 0 || !(upIn > 0.79) || g.uv.join() !== "0,0,1,0,1,1,0,1")
      errs.push(`a decal on ${n}: ${off.toFixed(4)} m off its surface, facing ${fn.map(v => v.toFixed(2))}, ${upIn.toFixed(2)} up`);
  }
}
const names = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(n => fs.existsSync(path.join(DIR, n, "street.json")) && (!only || n === only)) : [];
const report = [];
const PROP_INDEX = (() => { try { const d = JSON.parse(fs.readFileSync(path.join(ROOT, "Content/Studio/Library/index/props.json"), "utf8")); return d.items || d; } catch (e) { return {}; } })();
for (const name of names) {
  let S; try { S = JSON.parse(fs.readFileSync(path.join(DIR, name, "street.json"), "utf8")); } catch (e) { errs.push(`street ${name}: not JSON: ${e.message}`); continue; }
  const L = `street ${name}`, ids = new Set();
  if (S.format !== SG.FORMAT) errs.push(`${L}: format ${S.format}, the builder reads ${SG.FORMAT}`);
  for (const [list, need] of Object.entries(KNOWN)) for (const p of S[list] || []) {
    for (const k of need) if (p[k] === undefined) errs.push(`${L}: a ${list.slice(0, -1)} without ${k}: ${JSON.stringify(p).slice(0, 80)}`);
    if (ids.has(p.id)) errs.push(`${L}: the id ${p.id} twice`); ids.add(p.id);
  }
  for (const t of S.things || []) if (t.prop !== undefined) {         // a made prop in a thing's place (a tree's realistic one)
    const m = /^props\/([a-z0-9_]+)$/.exec(String(t.prop));
    if (!m || !PROP_INDEX[m[1]]) errs.push(`${L}: ${t.id}: its prop ${JSON.stringify(t.prop)} isn't one of the prop generator's (props/<recipe>, Content/Studio/Library/index/props.json)`);
    else if (!fs.existsSync(path.join(ROOT, "Content/Studio/Library/meshes/props", m[1] + ".glb"))) warns.push(`${L}: ${t.id}: ${t.prop} isn't made on this machine (its stand-in shows): python tools/propgen.py make ${m[1]} --library`);
  }
  for (const b of S.buildings || []) {
    if (b.style && SP && !SP.STYLES[b.style] && !(SP.WALKINS || {})[b.style] && b.style !== "set") warns.push(`${L}: ${b.id}: no style ${b.style}`);
    if (b.inside && b.inside.set) {                                   // its rooms are still its set's (the page reads them again on opening)
      const lv = setLevel(b.inside.set, b.inside.level);
      if (!lv) errs.push(`${L}: ${b.id}: its inside is the set ${b.inside.set}, which isn't in Content/Studio/Sets`);
      else if (JSON.stringify(SG.insideRooms(lv)) !== JSON.stringify(b.inside.rooms)) errs.push(`${L}: ${b.id}: the set ${b.inside.set} has changed since the street read it: open the street in the page (it reads it again) and save`);
      const sz = SG.insideSize(b); if (Math.abs(sz.w - b.w) > 0.01 || Math.abs(sz.d - b.d) > 0.01) errs.push(`${L}: ${b.id}: its size ${b.w} x ${b.d} isn't its inside's ${sz.w} x ${sz.d}`);
      if (lv && b.inside.from && !b.inside.own) {                     // it follows its set's outside: still the set's
        const t = JSON.parse(JSON.stringify(b));
        if (SG.applyOutside(t, lv.outside)) errs.push(`${L}: ${b.id}: the set ${b.inside.set}'s outside has changed since the street read it (or was changed here): open the street in the page (it reads it again) and save`);
      }
    }
    for (const pt of b.parts || []) if (!SG.PART_KINDS[pt.kind]) errs.push(`${L}: ${b.id}: no part kind ${pt.kind}`);
    for (const [f, r] of Object.entries(b.refs || {})) if (!/^refs\//.test(r.file || "")) errs.push(`${L}: ${b.id}: its ${f} photo isn't in refs/`);
  }
  for (const t of S.things || []) { if (!SG.THING_KINDS[t.kind]) errs.push(`${L}: ${t.id}: no thing kind ${t.kind}`); if (t.to && !(S.things || []).some(q => q.id === t.to && q.kind === "pole")) errs.push(`${L}: ${t.id}: wires to ${t.to}, not a pole here`); }
  for (const f of S.fences || []) if (!SG.FENCE_KINDS[f.kind]) errs.push(`${L}: ${f.id}: no fence kind ${f.kind}`);
  for (const r of S.roads || []) for (const m of r.marks || []) if (!SG.MARK_KINDS[m.kind]) errs.push(`${L}: ${r.id}: no mark kind ${m.kind}`);
  for (const d of S.decals || []) {
    if (!DECAL_KINDS.has(d.kind)) errs.push(`${L}: ${d.id}: no decal kind ${d.kind}`);
    if (!Array.isArray(d.n) || Math.abs(Math.hypot(...d.n) - 1) > 0.02) errs.push(`${L}: ${d.id}: its normal isn't one long`);
  }
  // every look (a colour, a set, or a set tuned and layered in the paint page): checked by storykit/pbrmix.py, the code
  // that makes them, so the check and the page never disagree on what a look may say
  const looks = [["the street", S.look || {}], ...["roads", "buildings", "things", "fences"].flatMap(l => (S[l] || []).map(x => [x.id, x.look || {}]))]
    .flatMap(([where, look]) => Object.entries(look).map(([slot, v]) => [where, slot, v]));
  if (looks.length) {
    const res = JSON.parse(execFileSync(process.env.PYTHON || "python3", ["-m", "storykit.pbrmix"], { cwd: path.join(ROOT, "Content/Python"), input: JSON.stringify(looks.map(x => x[2])) }).toString());
    looks.forEach(([where, slot, v], i) => {
      for (const e of res[i][0]) errs.push(`${L}: ${where}'s ${slot}: ${e}`);
      for (const w of res[i][1]) warns.push(`${L}: ${where}'s ${slot} wears ${typeof v === "string" ? v : v.set}: ${w} (python tools/street.py library, or your own set)`);
    });
  }
  const pieces = SG.build(S), tris = sane(L, pieces, p => budgetOf(S, p)), st = SG.stats(pieces);
  // what's been placed in one plane with something else (a fence along a wall, two things in each other): the street's
  // own rules keep its pieces apart, this is the street as drawn (the page's Check lists the same)
  const placed = SG.between(pieces);
  if (placed.length) warns.push(`${L}: ${placed.length} place${placed.length > 1 ? "s" : ""} where two things lie in one plane (they'd flicker in Godot; the page's Check finds them): ` +
    placed.slice(0, 4).map(h => `${h.a[0]} and ${h.b[0]}`).join(", ") + (placed.length > 4 ? "..." : ""));
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

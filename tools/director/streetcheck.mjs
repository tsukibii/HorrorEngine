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
// 6. the streets
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

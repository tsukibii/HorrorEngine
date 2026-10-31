// The kit's check: every type at its defaults, every preset and four variations of each build, stays inside its size box, has no stray
// numbers, and is the same from the same seed; a seed changes the gaps; the glb is well formed; the mesh refs agree
// with storykit/kit.py; every kit prop in every game builds; floors laid out by their sets' cells. Ends "KIT ok".
import { execFileSync } from "child_process";
import { loadKit, loadPresets, refOf, games, ROOT } from "./lib.mjs";

const KIT = await loadKit(), PR = loadPresets();
const errs = [], TOL = 0.004;
if (PR.version !== KIT.VERSION) errs.push(`presets.json version ${PR.version} isn't kit.js VERSION ${KIT.VERSION}`);
const tryOne = (label, spec) => {
  let b;
  try { b = KIT.build(spec, PR.presets); } catch (e) { errs.push(`${label}: ${e.message}`); return null; }
  if (!b.parts.length) errs.push(`${label}: no parts`);
  const G = KIT.mesh(b.parts), st = KIT.stats(G);
  for (const g of Object.values(G)) if ([...g.pos, ...g.nrm, ...g.uv].some(v => !Number.isFinite(v))) { errs.push(`${label}: a stray number in the mesh`); break; }
  const { lo, hi } = KIT.bounds(b.parts), [w, d, h] = b.spec.size;
  const box = [[-w / 2, w / 2], [-d / 2, d / 2], [0, h]];
  for (let k = 0; k < 3; k++) if (lo[k] < box[k][0] - TOL || hi[k] > box[k][1] + TOL)
    errs.push(`${label}: pokes out of its size box on ${"xyz"[k]} (${lo[k].toFixed(3)}..${hi[k].toFixed(3)} in ${box[k][0].toFixed(3)}..${box[k][1].toFixed(3)})`);
  const again = KIT.build(spec, PR.presets);
  if (JSON.stringify(again.parts) !== JSON.stringify(b.parts)) errs.push(`${label}: not the same twice`);
  const bin = KIT.glb(G, "t"), dv = new DataView(bin.buffer);
  if (dv.getUint32(0, true) !== 0x46546C67 || dv.getUint32(8, true) !== bin.length) errs.push(`${label}: a bad glb`);
  return { b, st };
};
let n = 0, tris = 0;
for (const t of Object.keys(KIT.TYPES)) { const r = tryOne(`type ${t}`, { type: t }); if (r) n++; }
for (const [name, p] of Object.entries(PR.presets)) {
  const r = tryOne(`preset ${name}`, name); if (!r) continue; n++; tris += r.st.tris;
  if (!p.label) errs.push(`preset ${name}: no label`);
  if (r.st.tris > 60000) errs.push(`preset ${name}: ${r.st.tris} triangles`);
}
// variations: every preset's build and stay in their boxes, the same from the same seed, each one different
let nv = 0;
for (const name of Object.keys(PR.presets)) {
  const full = KIT.withDefaults(KIT.resolve(name, PR.presets));
  const vs = KIT.variations(full, 4, 3);
  if (!vs.length && (KIT.VARY[full.type] || []).length) errs.push(`preset ${name}: no variations`);
  if (JSON.stringify(vs) !== JSON.stringify(KIT.variations(full, 4, 3))) errs.push(`preset ${name}: variations differ from the same seed`);
  vs.forEach((v, i) => { nv++; tryOne(`preset ${name} variation ${i + 1}`, v); });
  const keep = KIT.variations(full, 2, 5, ["layout", "look"]);
  if (keep.some(v => JSON.stringify(v.size) !== JSON.stringify(full.size))) errs.push(`preset ${name}: a variation without "size" changed the size`);
}
// a seed moves the gaps: the same floor from two seeds differs, with the same number of boards
for (const name of ["oak_planks", "tile_600"]) {
  const a = KIT.build({ preset: name, seed: 1 }, PR.presets).parts, b = KIT.build({ preset: name, seed: 2 }, PR.presets).parts;
  if (JSON.stringify(a) === JSON.stringify(b)) errs.push(`${name}: the seed changes nothing`);
}
const g0 = KIT.build({ preset: "tile_600", gap_var: 0 }, PR.presets).parts.filter(p => p.m.startsWith("tile"));
const xs = new Set(g0.map(p => p.size[0].toFixed(5)));
if (xs.size > 3) errs.push(`tile_600 with gap_var 0: tiles of ${xs.size} widths (should be even, bar the cut ones)`);
// the refs: python's and node's agree
const specs = [...Object.keys(PR.presets).slice(0, 12), { preset: "oak_planks", size: [4.25, 3.1, 0.015], seed: 7 }, { type: "rug", size: [2, 1, 0.01], border: 0.1 }];
try {
  const py = JSON.parse(execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0,'Content/Python'); from storykit import kit; print(json.dumps([kit.ref(s) for s in json.loads(sys.argv[1])]))", JSON.stringify(specs)], { cwd: ROOT }).toString());
  specs.forEach((s, i) => { const js = refOf(KIT, s, PR.presets, PR.version); if (js !== py[i]) errs.push(`ref of ${JSON.stringify(s)}: node ${js}, python ${py[i]}`); });
} catch (e) { errs.push("storykit.kit refs: " + e.message.split("\n")[0]); }
// every kit mesh every game's plan needs (props, floors, frames, doors' parts), as the importer would build them
let props = 0;
try {
  const all = JSON.parse(execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0,'Content/Python'); from storykit import kit, storylib as L; print(json.dumps({g: kit.specs(L.load(g)[0]) for g in json.loads(sys.argv[1])}))", JSON.stringify(games())], { cwd: ROOT, maxBuffer: 1 << 26 }).toString());
  for (const [g, items] of Object.entries(all)) for (const it of items) {
    props++; tryOne(`${g} ${it.ref}`, it.kit);
    if (refOf(KIT, it.kit, PR.presets, PR.version) !== it.ref) errs.push(`${g}: ${it.ref} is named otherwise by node`);
  }
} catch (e) { errs.push("the games' kit specs: " + e.message.split("\n")[0]); }
// a kit thing's `mats` (STORY_FORMAT §2) names slots its kit has (a kit door's: its leaf's, handle's or frame's): a slot,
// or the base of a slot's tones (wood for wood_2); every painted piece of every game's plan, grouped by what it's part of
let dressed = 0;
try {
  const py = "import sys,json; sys.path.insert(0,'Content/Python'); from storykit import plan as P, storylib as L\n" +
    "out={}\nfor g in json.loads(sys.argv[1]):\n  for q in P.plan(L.load(g)[0]):\n    sl=[t[8:].split(':')[0] for t in q['tags'] if t.startswith('matslot:')]\n" +
    "    if not sl or q.get('kit') is None: continue\n    own=next((t[5:] for t in q['tags'] if t.startswith('door:')), q['id'])\n" +
    "    e=out.setdefault(g+' '+own, {'slots': set(), 'kits': []}); e['slots'].update(sl); e['kits'].append(q['kit'])\n" +
    "print(json.dumps({k: {'slots': sorted(v['slots']), 'kits': v['kits']} for k, v in out.items()}))";
  const all = JSON.parse(execFileSync("python3", ["-c", py, JSON.stringify(games())], { cwd: ROOT, maxBuffer: 1 << 26 }).toString());
  for (const [who, it] of Object.entries(all)) {
    const have = new Set();
    for (const k of it.kits) { try { for (const sl of Object.keys(KIT.mesh(KIT.build(k, PR.presets).parts))) { have.add(sl); have.add(sl.replace(/_\d+$/, "")); } } catch (e) { } }
    for (const sl of it.slots) { dressed++; if (!have.has(sl)) errs.push(`${who}: mats ${sl}: its kit has no such slot (${[...have].sort().join(", ")})`); }
  }
} catch (e) { errs.push("the games' painted slots: " + e.message.split("\n")[0]); }
// a floor laid out by its set's own cells (the spec's `cells`, plan.py `fitted` from storykit/pbrcells.py; the user,
// 2026-10-31: "make the floors take a material"): the shelf's pavers and tatami mats as the layout, every board inside
// one of the set's cells, the set laid straight across them (the mesh's UVs the layout's metres from its corner: on a
// floor, a floor turned 90 degrees, a wall), a mosaic laid `whole` as one board; node and python name them alike
let fits = 0;
try {
  const C = JSON.parse(execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0,'Content/Python'); from storykit import pbrcells as C; " +
    "print(json.dumps([C.cells('pbr/concrete/Concrete010_1K-PNG'), C.cells('pbr/floor/Tatami004_1K-PNG')]))"], { cwd: ROOT }).toString());
  if (!C[0] || !C[1]) throw new Error("the shelf's pavers or tatami have no cells (numpy and Pillow, the sets in pbr/)");
  const inCell = (c, x0, y0, x1, y1) => {           // a board's box (metres from the layout's corner) inside one of the cells
    const t = c.tile, e = 1e-4;
    return c.rects.some(([u0, v0, u1, v1]) => { const i = Math.floor(x0 / t - u0 + e / t), j = Math.floor(y0 / t - v0 + e / t);
      return x0 >= (i + u0) * t - e && x1 <= (i + u1) * t + e && y0 >= (j + v0) * t - e && y1 <= (j + v1) * t + e; });
  };
  for (const [label, spec, slot, c] of [["pavers on tiles", { preset: "tile_300", size: [2.9, 2.1, 0.01] }, "tile", C[0]],
    ["pavers on tiles turned", { preset: "tile_300", size: [2.9, 2.1, 0.01], angle: 90 }, "tile", C[0]],
    ["pavers on wall tiles", { preset: "wall_tiles", size: [2, 0.01, 2.2] }, "tile", C[0]],
    ["mats on tatami", { preset: "tatami", size: [3.6, 2.7, 0.055] }, "tatami", C[1]]]) {
    const sp = Object.assign({}, spec, { cells: c }), r = tryOne(`fitted: ${label}`, sp); if (!r) continue;
    const s = r.b.spec, wall = s.orient === "wall", swap = +s.angle === 90 && !wall, [U, D, H] = s.size, V = wall ? H : D;
    const boards = r.b.parts.filter(p => p.m === slot || p.m.startsWith(slot + "_"));
    if (boards.length < 4) { errs.push(`fitted ${label}: ${boards.length} boards`); continue; }
    for (const p of boards) {                       // its box in the layout's own metres (turned back when the floor's turned)
      const bx0 = p.at[0] - p.size[0] / 2 + U / 2, bx1 = bx0 + p.size[0], by0 = wall ? p.at[2] : p.at[1] - p.size[1] / 2 + V / 2, by1 = by0 + (wall ? p.size[2] : p.size[1]);
      const [x0, y0, x1, y1] = swap ? [by0, bx0, by1, bx1] : [bx0, by0, bx1, by1];
      if (!inCell(c, x0, y0, x1, y1)) { errs.push(`fitted ${label}: a board at ${p.at.map(v => v.toFixed(3))} isn't inside one of the set's cells`); break; }
    }
    const G = KIT.mesh(r.b.parts); let bad = 0, seen = 0;
    for (const [sl, g] of Object.entries(G)) {
      if (!(sl === slot || sl.startsWith(slot + "_"))) continue;
      for (let i = 0; i < g.pos.length / 3; i++) {   // the face you see: its UVs the layout's metres from its corner
        const n = [g.nrm[i * 3], g.nrm[i * 3 + 1], g.nrm[i * 3 + 2]], x = g.pos[i * 3], y = g.pos[i * 3 + 1], z = g.pos[i * 3 + 2];
        if (!(wall ? Math.abs(n[1]) > 0.9 : n[2] > 0.9)) continue;
        const want = wall ? [x + U / 2, z] : swap ? [y + V / 2, x + U / 2] : [x + U / 2, y + V / 2];
        seen++; if (Math.abs(g.uv[i * 2] - want[0]) > 1e-4 || Math.abs(g.uv[i * 2 + 1] - want[1]) > 1e-4) bad++;
      }
    }
    if (!seen || bad) errs.push(`fitted ${label}: ${bad} of ${seen} face corners off the set's straight UVs`);
    fits += boards.length;
  }
  const whole = tryOne("fitted: a mosaic whole", { preset: "mosaic_50", size: [1.2, 1.2, 0.008], cells: { tile: 1, whole: true } });
  const wb = whole ? whole.b.parts.filter(p => p.m.startsWith("tile")) : [];
  if (wb.length !== 1 || Math.abs(wb[0].size[0] - 1.2) > 0.01) errs.push(`a mosaic laid whole: ${wb.length} boards`);
  const sp = [{ preset: "tile_300", size: [2.9, 2.1, 0.01], cells: C[0] }, { preset: "mosaic_50", cells: { tile: 1, whole: true } }];
  const py = JSON.parse(execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0,'Content/Python'); from storykit import kit; print(json.dumps([kit.ref(s) for s in json.loads(sys.argv[1])]))", JSON.stringify(sp)], { cwd: ROOT, maxBuffer: 1 << 24 }).toString());
  sp.forEach((x, i) => { if (refOf(KIT, x, PR.presets, PR.version) !== py[i]) errs.push(`a fitted floor's ref: node ${refOf(KIT, x, PR.presets, PR.version)}, python ${py[i]}`); });
} catch (e) { errs.push("fitted floors: " + e.message.split("\n")[0]); }
// a door's assembly: storykit/kit.py's DOOR and kit.js's door type agree on their defaults; the leaf turns on its hinges
try {
  const DOOR = JSON.parse(execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0,'Content/Python'); from storykit import kit; print(json.dumps(kit.DOOR))"], { cwd: ROOT }).toString());
  const d = KIT.withDefaults({ type: "door" });
  for (const [k, v] of Object.entries(DOOR)) if (k !== "leaf_t" && JSON.stringify(d[k]) !== JSON.stringify(v)) errs.push(`door default ${k}: kit.py ${JSON.stringify(v)}, kit.js ${JSON.stringify(d[k])}`);
  if (DOOR.leaf_t !== d.size[1]) errs.push(`door thickness: kit.py ${DOOR.leaf_t}, kit.js ${d.size[1]}`);
  const pv = KIT.pivotOf(KIT.withDefaults(KIT.resolve({ preset: "door_panels", hinge: "right" }, PR.presets)));
  if (!(pv[0] > 0.35)) errs.push(`a right-hinged door's pivot isn't on its right edge: ${pv}`);
} catch (e) { errs.push("the door defaults: " + e.message.split("\n")[0]); }
for (const e of errs.slice(0, 40)) console.log("ERROR:", e);
if (errs.length) { console.log(`KIT FAILED (${errs.length})`); process.exit(1); }
console.log(`KIT ok (${Object.keys(KIT.TYPES).length} types, ${Object.keys(PR.presets).length} presets, ${nv} variations, ${tris} triangles in all, ${props} props in the games, ${dressed} slots dressed, ${fits} boards laid by their sets' cells)`);

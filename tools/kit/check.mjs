// The kit's check: every type at its defaults, every preset and four variations of each build, stays inside its size box, has no stray
// numbers, and is the same from the same seed; a seed changes the gaps; the glb is well formed; the mesh refs agree
// with storykit/kit.py; every kit prop in every game builds. Ends "KIT ok".
import { execFileSync } from "child_process";
import { loadKit, loadPresets, refOf, games, ROOT, storySpecs, story } from "./lib.mjs";

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
// a kit thing's `mats` (STORY_FORMAT §2) names slots its kit has: a slot, or the base of a slot's tones (wood for wood_2)
let dressed = 0;
for (const g of games()) for (const it of storySpecs(story(g))) {
  if (!it.mats) continue;
  let slots;
  try { slots = Object.keys(KIT.mesh(KIT.build(it.kit, PR.presets).parts)); } catch (e) { continue; }
  const have = new Set([...slots, ...slots.map(sl => sl.replace(/_\d+$/, ""))]);
  for (const sl of Object.keys(it.mats)) { dressed++; if (!have.has(sl)) errs.push(`${g} ${it.id}: mats ${sl}: its kit has no such slot (${[...have].sort().join(", ")})`); }
}
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
console.log(`KIT ok (${Object.keys(KIT.TYPES).length} types, ${Object.keys(PR.presets).length} presets, ${nv} variations, ${tris} triangles in all, ${props} props in the games, ${dressed} slots dressed)`);

// Writes the kit's meshes for Unreal: every kit mesh a game's plan needs (props, floors, window frames, and each
// door's leaf, handle and frame) as a glb in the library, Content/Studio/Library/meshes/kit/<type>_<hash>.glb: the
// ref the importer's art: tag names (storykit/kit.py). Only missing ones are written; the same spec always makes
// the same file. A door leaf's mesh has its origin on its hinges (TYPES.door.pivot), so it turns round them.
//
//   python tools/kit_build.py --game G            (plans the game, then runs this with --specs; the importer does too)
//   node tools/kit/build.mjs --specs <file.json> [--force]     ([{"ref", "kit"}], from storykit.kit.write_specs)
//   node tools/kit/build.mjs --preset tv_wall_unit --out tv_wall_unit.glb
//   node tools/kit/build.mjs --spec '{"preset":"oak_planks","size":[4,3,0.015]}' --out floor.glb
import fs from "fs";
import path from "path";
import { loadKit, loadPresets, refOf, MESHES, INDEX } from "./lib.mjs";

const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const KIT = await loadKit(), PR = loadPresets();
if (PR.version !== KIT.VERSION) console.log(`warning: presets.json version ${PR.version} but kit.js VERSION ${KIT.VERSION}`);
const pivot = spec => KIT.pivotOf(KIT.withDefaults(KIT.resolve(spec, PR.presets)));

if (opt("--preset") || opt("--spec")) {
  const spec = opt("--preset") ? { preset: opt("--preset") } : JSON.parse(opt("--spec"));
  const b = KIT.build(spec, PR.presets), out = opt("--out") || `${b.spec.type}.glb`;
  fs.writeFileSync(out, KIT.glb(KIT.mesh(b.parts), path.basename(out, ".glb"), pivot(spec)));
  const st = KIT.stats(KIT.mesh(b.parts));
  console.log(`wrote ${out}: ${b.parts.length} parts, ${st.tris} triangles, ${st.slots} materials`);
  process.exit(0);
}
if (!opt("--specs")) { console.log("give --specs <file> (python tools/kit_build.py --game G makes one), or --preset / --spec"); process.exit(2); }
const items = JSON.parse(fs.readFileSync(opt("--specs"), "utf8")), force = args.includes("--force");
fs.mkdirSync(MESHES, { recursive: true });
const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : {};
let made = 0, kept = 0, bad = 0;
for (const it of items) {
  try {
    const ref = refOf(KIT, it.kit, PR.presets, PR.version);
    if (it.ref && it.ref !== ref) throw new Error(`python names it ${it.ref}, node ${ref}: storykit/kit.py and kit.js disagree`);
    const name = ref.split("/")[1], file = path.join(MESHES, name + ".glb");
    if (!force && fs.existsSync(file)) { kept++; continue; }
    const b = KIT.build(it.kit, PR.presets), G = KIT.mesh(b.parts), st = KIT.stats(G);
    fs.writeFileSync(file, KIT.glb(G, name, pivot(it.kit)));
    const [w, d, h] = b.spec.size;
    index[name] = { size_m: [w, h, d], tris: st.tris, kb: Math.round(fs.statSync(file).size / 1024), type: b.spec.type };
    made++;
  } catch (e) { bad++; console.log(`${JSON.stringify(it.kit).slice(0, 80)}: ${e.message}`); }
}
fs.mkdirSync(path.dirname(INDEX), { recursive: true });
fs.writeFileSync(INDEX, JSON.stringify(index, null, 1) + "\n");
console.log(`KIT BUILD ${bad ? "FAILED" : "ok"}: ${made} written, ${kept} already there${bad ? `, ${bad} bad` : ""} (${path.relative(process.cwd(), MESHES)})`);
process.exit(bad ? 1 : 0);

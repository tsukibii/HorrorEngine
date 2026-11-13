// Animator v2: the bake, from the command line (docs/ANIMATOR_V2.md §8).
//
//   node tools/animator/bake.mjs <character.glb> [--out FILE.glb] [--style -1..1] [--strength 0..1] [--weight -1..1]
//                                [--soft 0..1.5] [--bounce 0..1] [--settings FILE.json] [--only walk,run] [--report FILE.json]
//                                [--preview]
//
// The character's clips made from its own body and written into the file (in place when no --out; a file baked
// before is baked again from scratch, with the settings it was last baked with where none are given). Beside a file
// baked in place: <name>.motion.json, what it was baked with and what's in it. --preview: only the soft bones, no
// clips (what the Animator's page shows and animates itself). Prints what it measured and made; ends "BAKE ok".
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseGlb } from "./core/glb.js";
import { animate } from "./core/animate.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", ".."), args = process.argv.slice(2), opt = (k, d = null) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const file = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true) || args[0];
if (!file || file.startsWith("--")) { console.log("node tools/animator/bake.mjs <character.glb> [--out FILE.glb] [--style -1..1] [--strength 0..1] [--weight -1..1] [--soft 0..1.5] [--bounce 0..1] [--settings FILE.json] [--only walk,run]"); process.exit(1); }
const set = opt("--settings") ? JSON.parse(readFileSync(opt("--settings"), "utf8")) : {};
for (const k of ["style", "strength", "weight", "soft", "bounce"]) if (opt("--" + k) != null) set[k] = +opt("--" + k);
const rigFile = join(ROOT, "Content", "Studio", "Bodies", "MHR_lod1_rig.bin"), rb = existsSync(rigFile) ? readFileSync(rigFile) : null;
const t0 = Date.now(), glb = parseGlb(readFileSync(file));
try {
  const preview = args.includes("--preview"), r = animate(glb, { settings: set, mhrRig: rb ? rb.buffer.slice(rb.byteOffset, rb.byteOffset + rb.byteLength) : null, only: opt("--only") ? opt("--only").split(",") : null, rigOnly: preview });
  const out = opt("--out", file), bytes = glb.write(); writeFileSync(out, bytes);
  const rep = { ...r.report, made: new Date().toISOString(), file: out.split(/[\\/]/).pop() };
  if (opt("--report")) writeFileSync(opt("--report"), JSON.stringify(rep, null, 1));
  if (!preview && !opt("--out")) writeFileSync(file.replace(/\.glb$/i, "") + ".motion.json", JSON.stringify({ settings: rep.settings, body: rep.body, clips: rep.clips, soft: rep.soft, made: rep.made }, null, 1));
  console.log(`  body: ${rep.body.height} cm, ${rep.body.weight} kg (build ${rep.body.build}), bust ${rep.body.bust} waist ${rep.body.waist} hips ${rep.body.hips} cm; measured from its ${rep.body.from === "recipe" ? "own unclothed body" : "meshes"}`);
  console.log(`  settings: ${JSON.stringify(rep.settings)}`);
  console.log(`  soft bones: ${rep.soft.map(b => `${b.bone.replace("soft_", "")} ${b.amount}`).join(", ") || "none"} (${rep.softVerts} points of skin and clothes go with them)`);
  for (const [n, c] of Object.entries(rep.clips)) console.log(`  clip ${n.padEnd(14)} ${c.secs.toFixed(2)} s${c.loop ? " loop" : ""}${c.speed ? `, ${c.speed} m/s` : ""}`);
  console.log(`  ${out} (${(bytes.length / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  console.log("BAKE ok");
} catch (e) { console.log("BAKE FAILED: " + (process.env.DEBUG ? e.stack : e.message)); process.exit(1); }

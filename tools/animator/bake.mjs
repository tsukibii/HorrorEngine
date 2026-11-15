// Animator v2: the bake, from the command line (docs/ANIMATOR_V2.md §8).
//
//   node tools/animator/bake.mjs <character.glb> [--out FILE.glb] [--style -1..1] [--strength 0..1] [--weight -1..1]
//                                [--soft 0..1.5] [--bounce 0..1] [--furniture fit|own|person] [--seat M] [--bed M]
//                                [--handle M] [--table M] [--settings FILE.json] [--only walk,run] [--report FILE.json]
//                                [--preview]
//
// The character's clips made from its own body and written into the file (in place when no --out; a file baked
// before is baked again from scratch, with the settings it was last baked with where none are given). Beside a file
// baked in place: <name>.motion.json, what it was baked with and what's in it. --preview: only the soft bones, no
// clips (what the Animator's page shows and animates itself). Prints what it measured and made; ends "BAKE ok".
// --furniture: what her seat, bed, door handle and table are (core/acts.js furniture(): "fit" a person's wherever her
// body can use it, the default; "own" her own size; "person" a person's whatever she is); --seat 0.3: one said in metres.
//
//   node tools/animator/bake.mjs --status [--rebake]
// Every character the Animator's page lists (Exports/characters, Saved/Exports/characters, Saved/Animator/in): baked by
// which version of the Animator, and which want baking again (an older bake plays without what came since; one
// exported again from the Studio since its bake has lost its clips, its settings still beside it in .motion.json).
// --rebake bakes those again in place, each with the settings it was last baked with. Ends "BAKE ok".
import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync, mkdirSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { parseGlb } from "./core/glb.js";
import { animate, VERSION } from "./core/animate.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", ".."), args = process.argv.slice(2), opt = (k, d = null) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const VALUED = ["--out", "--style", "--strength", "--weight", "--soft", "--bounce", "--furniture", "--seat", "--bed", "--handle", "--table", "--settings", "--only", "--report"];
if (args.includes("--status")) { status(args.includes("--rebake")); process.exit(0); }
// the file: the first word that's neither a flag nor a flag's value (`--preview a.glb` took a.glb for --preview's value)
const file = args.find((a, i) => !a.startsWith("--") && !VALUED.includes(args[i - 1]));
if (!file || file.startsWith("--")) { console.log("node tools/animator/bake.mjs <character.glb> [--out FILE.glb] [--style -1..1] [--strength 0..1] [--weight -1..1] [--soft 0..1.5] [--bounce 0..1] [--settings FILE.json] [--only walk,run]"); process.exit(1); }
const set = opt("--settings") ? JSON.parse(readFileSync(opt("--settings"), "utf8")) : {};
for (const k of ["style", "strength", "weight", "soft", "bounce", "seat", "bed", "handle", "table"]) if (opt("--" + k) != null) set[k] = +opt("--" + k);
for (const k of ["style", "strength", "weight", "soft", "bounce", "seat", "bed", "handle", "table"]) if (k in set && !Number.isFinite(set[k])) { console.log(`BAKE FAILED: --${k} wants a number (${opt("--" + k)})`); process.exit(2); }
for (const k of ["seat", "bed", "handle", "table"]) if (k in set && (set[k] < 0.03 || set[k] > 2.5)) { console.log(`BAKE FAILED: --${k} ${set[k]} is in metres (a person's seat is 0.45): between 0.03 and 2.5`); process.exit(2); }
if (opt("--furniture") != null) set.furniture = opt("--furniture");
const rigFile = join(ROOT, "Content", "Studio", "Bodies", "MHR_lod1_rig.bin"), rb = existsSync(rigFile) ? readFileSync(rigFile) : null;
const t0 = Date.now(), glb = parseGlb(readFileSync(file));
try {
  const preview = args.includes("--preview"), r = animate(glb, { settings: set, mhrRig: rb ? rb.buffer.slice(rb.byteOffset, rb.byteOffset + rb.byteLength) : null, only: opt("--only") ? opt("--only").split(",") : null, rigOnly: preview });
  const out = opt("--out", file), bytes = glb.write(); writeFileSync(out + ".baking", bytes); renameSync(out + ".baking", out);   // (whole or not at all: a bake stopped half way left her file half written)
  const rep = { ...r.report, made: new Date().toISOString(), file: out.split(/[\\/]/).pop() };
  if (opt("--report")) writeFileSync(opt("--report"), JSON.stringify(rep, null, 1));
  if (!preview && !opt("--out")) writeFileSync(file.replace(/\.glb$/i, "") + ".motion.json", JSON.stringify({ settings: rep.settings, body: rep.body, furniture: rep.furniture, clips: rep.clips, soft: rep.soft, ...(rep.skipped && rep.skipped.length ? { skipped: rep.skipped } : {}), made: rep.made }, null, 1));
  console.log(`  body: ${rep.body.height} cm, ${rep.body.weight} kg (build ${rep.body.build}), bust ${rep.body.bust} waist ${rep.body.waist} hips ${rep.body.hips} cm; measured from its ${rep.body.from === "recipe" ? "own unclothed body" : "meshes"}`);
  console.log(`  settings: ${JSON.stringify(rep.settings)}`);
  if (rep.furniture) console.log(`  furniture (${rep.furniture.mode}): a seat ${Math.round(rep.furniture.seat * 100)}, a bed ${Math.round(rep.furniture.bed * 100)}, a handle ${Math.round(rep.furniture.handle * 100)}, a table ${Math.round(rep.furniture.table * 100)} cm${rep.clips.sit_down && rep.clips.sit_down.seat && rep.clips.sit_down.seat.high ? ": the seat is high for her, she gets up onto it" : ""}`);
  console.log(`  soft bones: ${rep.soft.map(b => `${b.bone.replace("soft_", "")} ${b.amount}`).join(", ") || "none"} (${rep.softVerts} points of skin and clothes go with them)`);
  for (const [n, c] of Object.entries(rep.clips)) console.log(`  clip ${n.padEnd(14)} ${c.secs.toFixed(2)} s${c.loop ? " loop" : ""}${c.speed ? `, ${c.speed} m/s` : ""}`);
  console.log(`  ${out} (${(bytes.length / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (rep.skipped && rep.skipped.length) console.log(`  not made for this body (it can't do them cleanly): ${rep.skipped.map(x => `${x.name} (${x.why})`).join(", ")}`);
  console.log("BAKE ok");
} catch (e) { console.log("BAKE FAILED: " + (process.env.DEBUG ? e.stack : e.message)); process.exit(1); }


// ---- --status: which characters want baking again ---------------------------------------------------------------------
function glbJson(f) {
  const b = readFileSync(f); if (b.readUInt32LE(0) !== 0x46546c67) return null;
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));
}
function characters() {
  const out = [], seen = new Set(), places = [join(ROOT, "Exports", "characters"), join(ROOT, "Saved", "Exports", "characters")];
  for (const place of places) if (existsSync(place)) for (const d of readdirSync(place, { withFileTypes: true })) {
    const f = join(place, d.name, d.name + ".glb"); if (d.isDirectory() && existsSync(f) && !seen.has(d.name)) { seen.add(d.name); out.push(f); } }
  const opened = join(ROOT, "Saved", "Animator", "in");
  if (existsSync(opened)) for (const n of readdirSync(opened)) if (/\.glb$/i.test(n) && !seen.has(n.slice(0, -4))) { seen.add(n.slice(0, -4)); out.push(join(opened, n)); }
  return out;
}
function status(rebake) {
  const rows = [];
  for (const f of characters()) {
    let rec = null, err = "";
    try { const j = glbJson(f); rec = ((j && (j.scenes || [{}])[j.scene || 0].extras) || {}).hsMotion || null; } catch (e) { err = e.message; }
    const side = f.replace(/\.glb$/i, "") + ".motion.json", last = existsSync(side) ? (() => { try { return JSON.parse(readFileSync(side, "utf8")).settings || null; } catch (e) { return null; } })() : null;
    const v = rec && rec.clips ? rec.version || 1 : 0, settings = (rec && rec.settings) || last;
    const why = err ? `unreadable: ${err}` : v >= VERSION ? "" : v ? `baked by version ${v}: bake again` : last ? "exported again since its bake (its clips are gone): bake again" : "never baked";
    rows.push({ f, name: f.split(/[\\/]/).pop().replace(/\.glb$/i, ""), v, why, settings, stale: !!why && (v > 0 || !!last) && !err });
  }
  console.log(`the Animator is at version ${VERSION}; ${rows.length} character${rows.length === 1 ? "" : "s"}:`);
  for (const r of rows) console.log(`  ${r.why ? (r.stale ? "BAKE " : "  -  ") : "  ok "} ${r.name.padEnd(24)} ${r.v ? "v" + r.v : "  "}  ${relative(ROOT, r.f)}${r.why ? "  (" + r.why + ")" : ""}`);
  const stale = rows.filter(r => r.stale);
  if (!rebake) { console.log(stale.length ? `${stale.length} to bake again: node tools/animator/bake.mjs --status --rebake (each with the settings it was last baked with)` : "nothing to bake again"); console.log("BAKE ok"); return; }
  const tmp = join(ROOT, "Saved", "Animator"); mkdirSync(tmp, { recursive: true });
  let bad = 0;
  for (const r of stale) {
    const sf = join(tmp, `_rebake_${r.name}.json`); writeFileSync(sf, JSON.stringify(r.settings || {}));
    try { execFileSync(process.execPath, [fileURLToPath(import.meta.url), r.f, "--settings", sf], { stdio: ["ignore", "pipe", "pipe"] }); console.log(`  baked again: ${r.name}`); }
    catch (e) { bad++; console.log(`  FAILED: ${r.name}: ${String(e.stdout || e.message).trim().split("\n").pop()}`); }
  }
  console.log(bad ? `BAKE FAILED (${bad} of ${stale.length})` : "BAKE ok");
  if (bad) process.exit(1);
}

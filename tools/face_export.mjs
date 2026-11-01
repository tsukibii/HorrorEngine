// The expression library into a Godot project (DECISIONS 2026-11-01: "a tool to export a facial animation and add it
// into Godot, a facial animation folder; the exporter should export the loopables separately"; docs/GODOT_DIRECTOR.md
// §6c): each expression (Content/Studio/Expressions/<id>/expression.json) sampled as the desk plays it
// (tools/shared/face.js: its rest taken away, its strength, a loop's end crossfaded into its start), mapped onto MHR's
// 72 face shapes (tools/character/arkit_mhr.json, MHR's order from Content/Studio/Bodies/MHR_lod1.bin), 30 frames a
// second, and written as an HSFaceClip the runtime plays (tools/godot/addons/horrorstudio/face.gd): faces/<id>.tres,
// the loops apart in faces/loops/<id>.tres. Only the shapes it moves are kept, by Meta's names.
//   node tools/face_export.mjs --project <folder> [id ...]     (no ids: the whole library; ends FACEEXPORT ok)
//   node tools/face_export.mjs --check                          (FACEEXPORT: every expression baked into a scratch folder,
//                                                                read back, in range, each loop's wrap seamless)
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { sample, toMHR, lengthOf } from "./shared/face.js";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "..");
const LIB = path.join(ROOT, "Content", "Studio", "Expressions");
export const FPS = 30;

/** MHR's 72 face shapes in its order (Meta's names, as the bodies carry them: shape_c_45.. on the plain MHR body) */
export function mhrNames() {
  const b = fs.readFileSync(path.join(ROOT, "Content", "Studio", "Bodies", "MHR_lod1.bin"));
  const n = b.readUInt32LE(0);
  return JSON.parse(b.subarray(4, 4 + n).toString("utf8")).expr_names;
}
/** ARKit's 52 onto MHR's 72, as the desk's /api/expressions/map gives it */
export function theMap() {
  const a = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "character", "arkit_mhr.json"), "utf8")), mhr = mhrNames();
  return { map: a.map, mhr, index: Object.fromEntries(mhr.map((n, i) => [n, i])) };
}
export function library() {
  if (!fs.existsSync(LIB)) return [];
  return fs.readdirSync(LIB).filter(d => fs.existsSync(path.join(LIB, d, "expression.json"))).sort();
}

/** an expression baked: {loop, secs, fps, frames, shapes: [names it moves], w: Float32Array(frames * shapes)}. A capture
 * from its start to its end (both kept); a loop over one round, so its last frame runs into its first */
export function bake(e, M) {
  const loop = !!e.loop, n = e.frames || 1, L = lengthOf(e), k = n / L;        // the capture's frames a second of playing
  let secs = L;
  if (loop) {
    const B = Math.min(n / 2, Math.max(0, +((e.loop || {}).blend ?? 0)) * k);
    secs = (B < 1 ? n : n - B) / k;                                          // one round: the blended end laid over the start
  }
  const frames = loop ? Math.max(2, Math.round(secs * FPS)) : Math.max(2, Math.round(secs * FPS) + 1);
  const step = loop ? secs / frames : secs / (frames - 1);
  const all = [];
  for (let i = 0; i < frames; i++) all.push(toMHR(sample(e, i * step, { loop }), M));
  const keep = M.mhr.map((_, j) => j).filter(j => all.some(w => w[j] > 1e-4));
  const w = new Float32Array(frames * keep.length);
  all.forEach((row, i) => keep.forEach((j, c) => { w[i * keep.length + c] = row[j]; }));
  return { loop, secs, fps: 1 / step, frames, shapes: keep.map(j => M.mhr[j]), w };
}

const str = s => JSON.stringify(String(s));
/** a baked expression as an HSFaceClip resource (Godot's text format) */
export function tres(id, e, b) {
  const nums = Array.from(b.w, v => (Math.round(v * 10000) / 10000).toString()).join(", ");
  return `[gd_resource type="Resource" script_class="HSFaceClip" load_steps=2 format=3]

[ext_resource type="Script" path="res://addons/horrorstudio/face_clip.gd" id="1_face"]

[resource]
script = ExtResource("1_face")
id = ${str(id)}
title = ${str(e.name || id)}
loop = ${b.loop}
secs = ${b.secs.toFixed(5)}
fps = ${b.fps.toFixed(5)}
frames = ${b.frames}
shapes = PackedStringArray(${b.shapes.map(str).join(", ")})
weights = PackedFloat32Array(${nums})
`;
}

/** the library (or the ids given) into <project>/faces/ and faces/loops/; returns [{id, loop, file, secs, shapes}] */
export function exportTo(project, ids = null, M = theMap()) {
  const out = [];
  for (const id of ids && ids.length ? ids : library()) {
    const f = path.join(LIB, id, "expression.json");
    if (!fs.existsSync(f)) throw new Error(`no expression ${id} (${path.relative(ROOT, f)})`);
    const e = JSON.parse(fs.readFileSync(f, "utf8")), b = bake(e, M);
    const dir = path.join(project, "faces", ...(b.loop ? ["loops"] : []));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, id + ".tres");
    for (const other of [path.join(project, "faces", id + ".tres"), path.join(project, "faces", "loops", id + ".tres")])
      if (other !== file && fs.existsSync(other)) fs.rmSync(other);              // a capture made a loop since (or back): one place only
    fs.writeFileSync(file, tres(id, e, b));
    out.push({ id, loop: b.loop, file, secs: b.secs, shapes: b.shapes.length, frames: b.frames });
  }
  return out;
}

/** a .tres written here, read back: {id, loop, secs, fps, frames, shapes, w} */
export function readTres(file) {
  const t = fs.readFileSync(file, "utf8"), get = k => (t.match(new RegExp(`^${k} = (.*)$`, "m")) || [])[1];
  const list = s => s.slice(s.indexOf("(") + 1, s.lastIndexOf(")"));
  return { id: JSON.parse(get("id")), loop: get("loop") === "true", secs: +get("secs"), fps: +get("fps"), frames: +get("frames"),
    shapes: list(get("shapes")).split(", ").filter(Boolean).map(s => JSON.parse(s)), w: list(get("weights")).split(", ").map(Number) };
}

function check() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "faceexport_")), M = theMap(), bad = [];
  const ok = (what, good, why = "") => { console.log((good ? "  ok  " : "  BAD ") + what + (good || !why ? "" : "  " + why)); if (!good) bad.push(what); };
  const ids = library();
  ok(`the library has expressions (${ids.join(", ")})`, ids.length > 0);
  ok(`MHR's 72 face shapes named (${M.mhr.length}), the map onto them (${Object.keys(M.map).length} ARKit curves)`, M.mhr.length === 72 && Object.keys(M.map).length >= 50);
  const done = exportTo(tmp, null, M);
  for (const d of done) {
    const r = readTres(d.file), rows = r.w.length / Math.max(1, r.shapes.length);
    const inRange = r.w.every(v => v >= 0 && v <= 1), moved = r.w.some(v => v > 0.05);
    const known = r.shapes.every(s => M.mhr.includes(s));
    let wrap = 0;                                                             // a loop: its last frame to its first, against its biggest step
    let step = 0;
    if (r.loop) {
      const S = r.shapes.length, at = (i, j) => r.w[i * S + j];
      for (let i = 0; i + 1 < r.frames; i++) for (let j = 0; j < S; j++) step = Math.max(step, Math.abs(at(i + 1, j) - at(i, j)));
      for (let j = 0; j < S; j++) wrap = Math.max(wrap, Math.abs(at(0, j) - at(r.frames - 1, j)));
    }
    const where = path.relative(tmp, d.file);
    ok(`${d.id}: ${where}, ${r.frames} frames (${r.secs.toFixed(2)} s) of ${r.shapes.length} of MHR's shapes, all 0..1, moving` +
      (r.loop ? `, its wrap a step like any other (${wrap.toFixed(3)}, the biggest ${step.toFixed(3)})` : ""),
      rows === r.frames && inRange && moved && known && (r.loop ? where.startsWith(path.join("faces", "loops")) && wrap <= step * 1.5 + 1e-3 : !where.includes("loops")));
  }
  ok("the loops apart (faces/loops/) and the captures in faces/", done.some(d => d.loop) === fs.existsSync(path.join(tmp, "faces", "loops")));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(bad.length ? `FACEEXPORT FAIL (${bad.length})` : "FACEEXPORT ok");
  return bad.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes("--check")) process.exit(check());
  const pi = args.indexOf("--project");
  if (pi < 0 || !args[pi + 1]) {
    console.log("node tools/face_export.mjs --project <a Godot project folder> [id ...]   |   --check");
    process.exit(1);
  }
  const project = path.resolve(args[pi + 1]), ids = args.filter((a, i) => i !== pi && i !== pi + 1 && !a.startsWith("--"));
  if (!fs.existsSync(path.join(project, "project.godot"))) { console.log(`FACEEXPORT FAIL: no project.godot in ${project}`); process.exit(1); }
  const done = exportTo(project, ids);
  for (const d of done) console.log(`  ${d.id}: ${path.relative(project, d.file)} (${d.secs.toFixed(2)} s, ${d.shapes} shapes${d.loop ? ", a loop" : ""})`);
  console.log(`FACEEXPORT ok (${done.length} into ${path.join(project, "faces")})`);
}

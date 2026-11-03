// The little things' effect points for the Director's life parts (docs/GODOT_DIRECTOR_PLAN.md §2): for each life in
// lives.json, a kit thing of its kind built once and its sockets kept as fractions of its size, so a Kettle part
// dropped on any kettle model starts with its spout where a kettle's spout would be (the user drags it after).
//
//   node tools/kit/life_points.mjs        writes GodotPlugins/HorrorStudioDirector/addons/horrorstudio_director/parts/life_points.json
//
// Item space as lifefx.gd reads sockets: x across, y deep, z up from the base; a point's `f` is [x/w, y/d, z/h], `n`
// the way it points. Run it again when the kit's sockets change.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadKit, loadPresets } from "./lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "GodotPlugins/HorrorStudioDirector/addons/horrorstudio_director/parts/life_points.json");
const LIVES = JSON.parse(fs.readFileSync(path.join(ROOT, "Content/Studio/Life/lives.json"), "utf8")).lives;
// a kit thing of each life's kind (lives.json's by_kit and by_preset, read backwards)
const SPECS = {
  kettle: { type: "kettle", style: "jug" }, whistling_kettle: { type: "kettle", style: "whistling" },
  tetsubin: { type: "kettle", style: "tetsubin" }, hob: { type: "hob", style: "ceramic" }, gas_hob: { type: "hob", style: "gas" },
  pot: { type: "pot" }, cup: { type: "cup" }, coffee: { type: "cup", style: "takeaway" }, teapot: { type: "teapot" },
  cigarette: { type: "cigarette", pose: "lying" }, lighter: { type: "lighter", pose: "standing" }, candle: { type: "candle" },
  coil: { type: "coil" }, incense: { type: "incense" }, clock: { type: "clock" }, rice_cooker: { type: "rice_cooker" },
  phone: { type: "phone" }, tap: { type: "tap" }, tv: { type: "panel", face: "screen" }, fridge: { preset: "fridge" },
};

const KIT = await loadKit(), PR = loadPresets();
const out = { about: "made by tools/kit/life_points.mjs from the kit: each life's effect points as fractions of a kit thing's size (f: x across, y deep, z up from the base) and the way each points (n)", lives: {} };
let bad = 0;
for (const life of Object.keys(LIVES)) {
  const spec = SPECS[life];
  if (!spec) { console.log(`${life}: no kit thing named for it`); bad++; continue; }
  try {
    const b = KIT.build(spec, PR.presets), [w, d, h] = b.spec.size, pts = {};
    for (const [name, q] of Object.entries(b.sockets || {})) {
      const at = q.at || [0, 0, 0];
      pts[name] = { f: [at[0] / w, at[1] / d, at[2] / h].map(v => Math.round(v * 1000) / 1000) };
      if (q.n) pts[name].n = q.n.map(v => Math.round(v * 1000) / 1000);
    }
    out.lives[life] = { label: LIVES[life].label || life, size: [w, d, h].map(v => Math.round(v * 1000) / 1000), points: pts };
  } catch (e) { console.log(`${life}: ${e.message}`); bad++; }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`LIFEPOINTS ${bad ? "FAILED" : "ok"}: ${Object.keys(out.lives).length} lives (${path.relative(ROOT, OUT)})`);
process.exit(bad ? 1 : 0);

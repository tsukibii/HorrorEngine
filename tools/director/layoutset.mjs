// a scene builder layout (builder-presets.js PRESETS: the reference layouts, the school's classroom, the school kit's
// buildings) saved as a set, Content/Studio/Sets/<set>/story.json, through the scene builder's own model as the page
// would save it: its level, someone at her spot, a start, a first glance. A set already there keeps everything but its
// level (and her spot in it). node tools/director/layoutset.mjs <layout> [<set>] [--dry]
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BP = await import("./builder-presets.js"), BM = await import("./builder-model.js");
BM.KITS.presets = JSON.parse(fs.readFileSync(path.join(ROOT, "Content/Studio/Kit/presets.json"), "utf8")).presets;
const args = process.argv.slice(2).filter(a => !a.startsWith("--")), dry = process.argv.includes("--dry");
const P = BP.PRESETS.find(p => p.id === args[0]);
if (!P) { console.error(`no layout ${args[0]} (${BP.PRESETS.map(p => p.id).join(", ")})`); process.exit(2); }
const model = BM.presetToModel(P);
const { level, problems } = BM.modelToLevel(model, {});
const all = model.problems.concat(problems);
const props = level.rooms.flatMap(r => r.props || []);
console.log(`${P.id}: ${level.rooms.length} rooms, ${props.length} props (${props.filter(p => p.kit).length} kit things), ${model.floors.length} floors`);
if (all.length) { console.log("problems:\n  " + all.join("\n  ")); process.exit(1); }
const name = args[1] || P.id;
if (dry) process.exit(0);
const her = model.her, home = model.rooms.find(r => her.x > r.x && her.x < r.x + r.w && her.y > r.y && her.y < r.y + r.d && Math.abs(r.z - (her.z || 0)) < 0.3);
const room = level.rooms.find(r => r.id === home.id);
room.props = (room.props || []).concat([{ id: "someone_spot", use: "spot", at: [+(her.x - home.x).toFixed(3), +(her.y - home.y).toFixed(3)], rot: her.yaw }]);
const dir = path.join(ROOT, "Content/Studio/Sets", name), file = path.join(dir, "story.json");
let story = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
if (story) story.levels = { [name]: level };
else story = {
  format: 3,
  game: { id: name, title: P.name, start: "n_start", target_min: 0, voice: "ja", text: "en", clip_max: 8, subtitles: ["en", "zh"], built_with: { engine: "0.6.0", format: 3 } },
  cast: { someone: { name: "Someone", metahuman: null, height: 1.6 } }, items: {}, notes: {}, lines: {}, sounds: {},
  levels: { [name]: level },
  scenes: { s_first: { title: "First words", level: name, stage: { someone: "someone_spot" }, view: level.start, camera: { mode: "soft", look: "someone", cone: [30, 18] },
    clips: [{ id: "c1", who: "someone", ja: "……", en: "...", act: "looks up" }] } },
  stitches: { t_start: { title: "Start", level: name, beats: [{ id: "b_start", when: { start: true }, do: [{ fade: "in", secs: 2 }, { done: true }] }] } },
  flow: { n_start: { type: "stitch", ref: "t_start", next: "n_first" }, n_first: { type: "scene", ref: "s_first", next: "e_end", final: true }, e_end: { type: "ending", kind: "good", title: "The end" } },
  secrets: {},
};
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(file, JSON.stringify(story, null, 1) + "\n");
console.log("wrote", path.relative(ROOT, file));

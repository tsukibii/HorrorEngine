// a scene builder layout (builder-presets.js PRESETS: the reference layouts, the school's classroom, the school kit's
// buildings; or a layout file of your own, `--file spec.json`: the same shape as a PRESETS entry, the cheap way for
// Claude to write a place, .claude/skills/build-map) saved as a set, Content/Studio/Sets/<set>/story.json, through the
// scene builder's own model as the page would save it: its level, someone at her spot, a start, a first glance. A set
// already there keeps everything but its level (and her spot in it).
//   node tools/director/layoutset.mjs <layout> [<set>] [--dry]
//   node tools/director/layoutset.mjs --file spec.json <set> [--dry]      (a file's `repeat`: storeys alike, below)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BP = await import("./builder-presets.js"), BM = await import("./builder-model.js");
BM.KITS.presets = JSON.parse(fs.readFileSync(path.join(ROOT, "Content/Studio/Kit/presets.json"), "utf8")).presets;
// the prop generator's props in the library (a layout's kit `props/<name>`: placed at its size), as the page's /api/library
BM.KITS.props = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, "Content/Studio/Library/index/props.json"), "utf8")))
  .map(([n, i]) => [`props/${n}`, { size: [i.size_m[0], i.size_m[2], i.size_m[1]] }]));          // glTF y up: [w, d, h] as LIB.mesh_size
const argv = process.argv.slice(2), fi = argv.indexOf("--file"), file0 = fi >= 0 ? argv[fi + 1] : null;
const args = argv.filter((a, i) => !a.startsWith("--") && !(fi >= 0 && i === fi + 1)), dry = argv.includes("--dry");
if (file0) args.unshift(null);                                        // the set's name is the first word left
const P = file0 ? JSON.parse(fs.readFileSync(path.resolve(file0), "utf8")) : BP.PRESETS.find(p => p.id === args[0]);
if (!P) { console.error(`no layout ${args[0]} (${BP.PRESETS.map(p => p.id).join(", ")})`); process.exit(2); }
if (file0) { P.id = P.id || args[1]; P.name = P.name || args[1]; if (!args[1]) { console.error("give the set's name after the file"); process.exit(2); } }
// a building's storeys alike (`repeat`; the user, 2026-11-03: "its 1 apartment per floor"): the rooms it names copied up
// to each of its `floors` (a copy's id the room's and `suffix`, "_{n}f" by default, {n} the storey: 2 for the first
// copy), with the doors between them and their windows; `add`: rooms and doors of the copies' own, {n} in their words
// (a landing, its door to a stair shaft through every storey: at the copy's floor by itself); `bare` (the default): no
// kits or wall items, no fittings or kit floors, the lights off (the copies are seen from the street, not walked)
function expandRepeat(P) {
  const R = P.repeat; if (!R) return;
  const ids = new Set(R.rooms || []), bare = R.bare !== false, sub = (v, n) => JSON.parse(JSON.stringify(v).replace(/\{n\}/g, n));
  const suf = n => (R.suffix || "_{n}f").replace(/\{n\}/g, n), rid = (id, n) => ids.has(id) ? id + suf(n) : id;
  const rooms = P.rooms.filter(r => ids.has(r[0])), doors = (P.doors || []).filter(d => ids.has(d[0]) && ids.has(d[1])), wins = (P.windows || []).filter(w => ids.has(w[0]));
  if (rooms.length !== ids.size) throw new Error(`repeat: no room ${[...ids].filter(i => !P.rooms.some(r => r[0] === i)).join(", ")}`);
  P.doors = P.doors || []; P.windows = P.windows || [];
  (R.floors || []).forEach((z, i) => {
    const n = i + 2;
    for (const r of rooms) {
      const o = Object.assign({}, r[7] || {}, { z });
      if (bare) { Object.assign(o, { fixtures: false, light: "off", floorKit: null, ceilKit: null }); if (o.extra) { o.extra = Object.assign({}, o.extra); delete o.extra.props; } }
      P.rooms.push([rid(r[0], n), r[1], r[2] ? `${r[2]} ${n}F` : "", r[3], r[4], r[5], r[6], o]);
    }
    for (const d of doors) { const o = Object.assign({}, d[3] || {}, { z }); if (o.id) o.id += suf(n); P.doors.push([rid(d[0], n), rid(d[1], n), d[2], o]); }
    for (const w of wins) P.windows.push([rid(w[0], n), w[1], w[2], Object.assign({}, w[3] || {})]);
    for (const r of (R.add || {}).rooms || []) { const c = sub(r, n); c[7] = Object.assign({}, c[7] || {}, { z }); P.rooms.push(c); }
    for (const d of (R.add || {}).doors || []) P.doors.push(sub(d, n));
    for (const w of (R.add || {}).windows || []) P.windows.push(sub(w, n));
  });
  delete P.repeat;
}
expandRepeat(P);
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

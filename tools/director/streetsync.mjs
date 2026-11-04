// A street's walk-in buildings read from their sets again, as the street page does when it opens a street (street.js
// syncInside): each building whose `inside.set` names a set (Content/Studio/Sets/<set>) takes the set's level's rooms
// (their doors and windows cut through its outside), its outside (walls, roof, raise, fittings: the scene builder's
// Outside panel, unless the street has its own: `inside.own`) and the size they make. The cheap way to keep a street
// in step with a set changed by hand or by layoutset.mjs (.claude/skills/build-map), no browser needed.
//   node tools/director/streetsync.mjs <street> [--dry]       (STREET then checks it: tools/street.py check)
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SG = await import(pathToFileURL(path.join(ROOT, "tools/director/street-gen.js")).href);
const args = process.argv.slice(2).filter(a => !a.startsWith("--")), dry = process.argv.includes("--dry");
if (!args[0]) { console.log("give a street's name (Content/Studio/Streets/<name>)"); process.exit(2); }
const file = path.join(ROOT, "Content/Studio/Streets", args[0], "street.json");
const S = JSON.parse(fs.readFileSync(file, "utf8"));
let changed = 0;
for (const b of S.buildings || []) {
  const ins = b.inside; if (!ins || !ins.set) continue;
  const sf = path.join(ROOT, "Content/Studio/Sets", ins.set, "story.json");
  if (!fs.existsSync(sf)) { console.log(`${b.id}: no set ${ins.set}`); process.exitCode = 1; continue; }
  const L = JSON.parse(fs.readFileSync(sf, "utf8")).levels || {}, id = ins.level && L[ins.level] ? ins.level : Object.keys(L)[0], lv = L[id];
  const rooms = SG.insideRooms(lv);
  let moved = false;
  if (JSON.stringify(rooms) !== JSON.stringify(ins.rooms) || ins.level !== id) { ins.rooms = rooms; ins.level = id; moved = true; }
  const dressed = SG.applyOutside(b, lv.outside);
  if (moved || dressed) { Object.assign(b, SG.insideSize(b)); changed++; }
  const sz = SG.insideSize(b);
  console.log(`${b.id}: the set ${ins.set} (${rooms.length} rooms${lv.outside ? ", its outside" : ""}${ins.own ? ", the street's own outside" : ""}), ${sz.w} x ${sz.d} m${moved || dressed ? ": read again" : ": as it was"}`);
}
if (changed && !dry) { fs.writeFileSync(file, JSON.stringify(S, null, 1) + "\n"); console.log(`wrote ${path.relative(ROOT, file)}`); }

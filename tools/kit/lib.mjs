// What the kit's node tools share: the generator (tools/director/kit.js, the same file the pages load), the presets,
// and the mesh ref a spec's mesh is written under (storykit/kit.py makes the same one).
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath, pathToFileURL } from "url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PRESETS_FILE = path.join(ROOT, "Content/Studio/Kit/presets.json");
export const MESHES = path.join(ROOT, "Content/Studio/Library/meshes/kit");
export const INDEX = path.join(ROOT, "Content/Studio/Library/index/kit.json");

export async function loadKit() {
  const file = path.join(ROOT, "tools/director/kit.js");
  try { return await import(pathToFileURL(file).href); }
  catch (e) {        // an older node reads a .js file outside a "type": "module" package as CommonJS
    if (!(e instanceof SyntaxError)) throw e;
    return await import("data:text/javascript;base64," + fs.readFileSync(file).toString("base64"));
  }
}
export function loadPresets() { return JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8")); }
export function refOf(KIT, spec, presets, version) {
  const r = KIT.resolve(spec, presets);
  const h = crypto.createHash("sha1").update(`v${version}:` + KIT.canon(r)).digest("hex").slice(0, 12);
  return `kit/${r.type}_${h}`;
}
// every kit spec in a story: the props that carry one (rooms' props, on every level)
export function storySpecs(story) {
  const out = [];
  for (const [lid, lvl] of Object.entries(story.levels || {})) for (const r of lvl.rooms || []) for (const p of r.props || [])
    if (p.kit !== undefined) out.push({ level: lid, room: r.id, id: p.id, kit: p.kit, mats: p.mats });
  return out;
}
export function games() {
  const dir = path.join(ROOT, "Content/Games");
  return fs.readdirSync(dir).filter(g => fs.existsSync(path.join(dir, g, "story.json")));
}
export function story(game) { return JSON.parse(fs.readFileSync(path.join(ROOT, "Content/Games", game, "story.json"), "utf8")); }

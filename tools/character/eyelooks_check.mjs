// EYELOOKS: the eye looks (eyelooks.js) and the eye's two sides held together, no browser (check_all runs it).
//   - every eye look names only what exists: the eyeball's settings (tools/shared/eye.js), each within its slider or one
//     of its choices; the graft's shape keys (eyegraft.js) within theirs; the sculpt's eye controls (sculpt.js); a lash
//     style and look (browlash.js) and its own lash settings; the eye's makeup (skinshader.js); its card's picture there
//     (Content/Studio/Eyes/thumbs/<id>.jpg, a JPEG);
//   - Godot's side says the same as the Studio's (GodotPlugins/HorrorStudioLook, eyes v3): the paint's code in
//     eye_paint.gdshaderinc is tools/shared/eye.js's PAINT function for function (comments and spacing aside), the
//     patterns' and the pupils' order the same, HSEyePaint's defaults the Studio's, its sliders within the Studio's
//     ranges, its styles the Studio's eye styles; and each eye look's ready-made HSEyeLook (addons/horrorstudio_look/
//     eyes/eyes_<id>.tres) holds that look's own eyeball settings.
//   node tools/character/eyelooks_check.mjs [--write]      --write: the ready-made HSEyeLook files made again from eyelooks.js
// Ends "EYELOOKS ok".
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
// (the modules below import three.js by its bare name, as the pages' import maps give it: the vendored copy here)
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, n) { return s === "three" ? { url: ${JSON.stringify(pathToFileURL(path.join(ROOT, "tools", "director", "vendor", "three.module.min.js")).href)}, shortCircuit: true } : n(s, c); }`));
const EL = await import("./eyelooks.js"), EYE = await import("../shared/eye.js"), EG = await import("./eyegraft.js"), BL = await import("./browlash.js"), SK = await import("./skinshader.js");
const PLUGIN = path.join(ROOT, "GodotPlugins", "HorrorStudioLook", "addons", "horrorstudio_look"), write = process.argv.includes("--write");
let ok = true;
const say = (good, what) => { console.log((good ? "  ok  " : "  BAD ") + what); ok = ok && !!good; };
const isHex = v => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

// ---- the looks
const colours = new Set(EYE.EYE_COLOURS.map(c => c[0])), controls = new Map(EYE.EYE_CONTROLS.map(c => [c[0], c])), choices = new Map(EYE.EYE_CHOICES.map(c => [c[0], c[2].map(o => o[0])]));
const FIT = { size: [1, 2.2], depth: [-1, 4], opening: [0.85, 1.2], lidShade: [0, 1], occlusion: [0, 1], tearline: [0, 1] };   // (index.html's eye fit sliders)
const keys = new Map(EG.SHAPE_KEYS.map(k => [k[0], k])), lash = new Map(BL.LASH_CONTROLS.map(c => [c[0], c]));
const feats = new Map(SK.FEATURES.map(f => [f[0], f])), skinCols = new Set(SK.COLOURS.map(c => c[0])), sculptSrc = fs.readFileSync(path.join(ROOT, "tools", "character", "sculpt.js"), "utf8");
const within = (v, lo, hi) => typeof v === "number" && v >= lo - 1e-9 && v <= hi + 1e-9;
for (const [id, L] of Object.entries(EL.EYE_LOOKS)) {
  const bad = [];
  if (!L.label || !L.about) bad.push("no label or about");
  for (const [k, v] of Object.entries(L.eyes || {})) {
    if (colours.has(k)) { if (!isHex(v)) bad.push(`eyes.${k} ${v}: not a colour`); }
    else if (controls.has(k)) { const c = controls.get(k); if (!within(v, c[2], c[3])) bad.push(`eyes.${k} ${v}: outside ${c[2]}..${c[3]}`); }
    else if (choices.has(k)) { if (!choices.get(k).includes(v)) bad.push(`eyes.${k} ${v}: not one of ${choices.get(k).join(", ")}`); }
    else if (FIT[k]) { if (!within(v, ...FIT[k])) bad.push(`eyes.${k} ${v}: outside ${FIT[k].join("..")}`); }
    else bad.push(`eyes.${k}: no such eye setting`);
  }
  for (const [k, v] of Object.entries(L.shape || {})) { const c = keys.get(k); if (!c) bad.push(`shape.${k}: no such shape key`); else if (!within(v, c[2], c[3])) bad.push(`shape.${k} ${v}: outside ${c[2]}..${c[3]}`); }
  for (const [k, v] of Object.entries(L.sculpt || {})) {
    if (!EL.EYE_SCULPT.includes(k)) bad.push(`sculpt.${k}: not one of the eye's controls (${EL.EYE_SCULPT.join(", ")})`);
    else if (!sculptSrc.includes(`["${k}", `)) bad.push(`sculpt.${k}: no such sculpt control`);
    else if (!within(v, -1, 1)) bad.push(`sculpt.${k} ${v}: outside -1..1`);
  }
  if (L.lash) {
    if (L.lash.style && !BL.LASH_STYLES[L.lash.style]) bad.push(`lash.style ${L.lash.style}: no such lash style`);
    if (L.lash.look && !BL.LOOKS[L.lash.look]) bad.push(`lash.look ${L.lash.look}: no such look`);
    for (const [k, v] of Object.entries(L.lash.set || {})) { const c = lash.get(k); if (!c) bad.push(`lash.set.${k}: no such lash setting`); else if (!within(v, c[2], c[3])) bad.push(`lash.set.${k} ${v}: outside ${c[2]}..${c[3]}`); }
  }
  for (const [k, v] of Object.entries(L.makeup || {})) {
    if (!EL.EYE_MAKEUP.includes(k)) bad.push(`makeup.${k}: not the eye's makeup`);
    else if (skinCols.has(k)) { if (!isHex(v)) bad.push(`makeup.${k} ${v}: not a colour`); }
    else if (!feats.has(k)) bad.push(`makeup.${k}: no such makeup setting`);
    else if (!within(v, feats.get(k)[2], feats.get(k)[3])) bad.push(`makeup.${k} ${v}: outside ${feats.get(k)[2]}..${feats.get(k)[3]}`);
  }
  say(!bad.length, `${id} (${L.label}): ${Object.keys(L.eyes || {}).length} eye settings, ${Object.keys(L.shape || {}).length} shape keys, ${Object.keys(L.sculpt || {}).length} sculpt controls, lashes ${L.lash?.style || "as they are"}, ${Object.keys(L.makeup || {}).length} of the eye's makeup` + (bad.length ? ": " + bad.join("; ") : ", every one a control that exists, within its slider"));
  const pic = path.join(ROOT, "Content", "Studio", "Eyes", "thumbs", id + ".jpg"), there = fs.existsSync(pic) ? fs.readFileSync(pic) : null;
  say(there && there.length > 2000 && there[0] === 0xff && there[1] === 0xd8, `its card's picture: Content/Studio/Eyes/thumbs/${id}.jpg` + (there ? ` (${Math.round(there.length / 1024)} KB)` : " is missing (node tools/character/eyelooks.mjs thumbs)"));
}
say(EL.EYE_MAKEUP.every(k => feats.has(k) || skinCols.has(k)), `the eye's makeup (${EL.EYE_MAKEUP.length} settings) all in the skin shader's`);
say(Object.values(BL.LASH_STYLES).every(s => Object.keys(s).every(k => k === "label" || k === "group" || lash.has(k))), `every lash style's settings are lash controls (${Object.keys(BL.LASH_STYLES).length} styles)`);

// ---- Godot's side against the Studio's
const squeeze = code => code.replace(/\/\/[^\n]*/g, "").replace(/\s+/g, "");
const studioSrc = fs.readFileSync(path.join(ROOT, "tools", "shared", "eye.js"), "utf8"), inc = fs.readFileSync(path.join(PLUGIN, "eye_paint.gdshaderinc"), "utf8");
const paint = studioSrc.slice(studioSrc.indexOf("const PAINT = /* glsl */`") + 25, studioSrc.indexOf("`;", studioSrc.indexOf("const PAINT = /* glsl */`")));
const body = (code, from, to) => squeeze(code.slice(code.indexOf(from), to ? code.indexOf(to) : undefined));
const a = body(paint, "float eyeSm(").replace(squeeze("vec3 eyeLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }"), "");
const b = body(inc, "float eyeSm(", "// the flat layout's picture");
let at = 0; while (at < a.length && a[at] === b[at]) at++;
say(a === b, `the paint in Godot (eye_paint.gdshaderinc) is the Studio's (tools/shared/eye.js PAINT), function for function: ${a.length} characters of code` + (a === b ? "" : `; they part at "${a.slice(Math.max(0, at - 30), at + 50)}" against "${b.slice(Math.max(0, at - 30), at + 50)}"`));
const gd = fs.readFileSync(path.join(PLUGIN, "eye_paint.gd"), "utf8");
const listOf = name => JSON.parse(gd.match(new RegExp(`const ${name} := (\\[[^\\n]*\\])`))[1]);
say(JSON.stringify(listOf("PATTERNS")) === JSON.stringify(choices.get("pattern")) && JSON.stringify(listOf("PUPILS")) === JSON.stringify(choices.get("pupilShape")), `the patterns and the pupils in the Studio's order (${choices.get("pattern").length} patterns, ${choices.get("pupilShape").length} pupil shapes)`);
const block = (name, open, close) => { const i = gd.indexOf(`const ${name} := ${open}`), j = gd.indexOf(`\n${close}`, i) < 0 || open === "{" && gd.indexOf("}\n", i) < gd.indexOf(`\n${close}`, i) ? gd.indexOf(close + "\n", i) : gd.indexOf(`\n${close}`, i) + 1; return gd.slice(i + `const ${name} := `.length, j + 1); };
const defaults = JSON.parse(block("DEFAULTS", "{", "}").replace(/\t/g, " ")), offD = Object.entries(defaults).filter(([k, v]) => k in EYE.EYE_DEFAULTS && EYE.EYE_DEFAULTS[k] !== v);
const mine = ["catchLineY", "catchLit"];                // (Godot's own: the wet line's height, the lamps' share: no slider in the Studio)
say(!offD.length && Object.keys(defaults).every(k => k in EYE.EYE_DEFAULTS || mine.includes(k)), `HSEyePaint's defaults are the Studio's (${Object.keys(defaults).length})` + (offD.length ? ": " + offD.map(([k, v]) => `${k} ${v} against ${EYE.EYE_DEFAULTS[k]}`).join(", ") : ""));
const sliders = [...block("CONTROLS", "[", "]").matchAll(/\["(\w+)", "[^"]*", (-?[\d.]+), (-?[\d.]+), ([\d.]+)\]/g)].map(m => [m[1], +m[2], +m[3]]);
const offS = sliders.filter(([k, lo, hi]) => !controls.has(k) || lo < controls.get(k)[2] - 1e-9 || hi > controls.get(k)[3] + 1e-9);
say(sliders.length >= 20 && !offS.length, `its ${sliders.length} sliders are the Studio's, each within the Studio's range` + (offS.length ? ": not " + offS.map(x => x[0]).join(", ") : ""));
const styles = Object.fromEntries([...gd.matchAll(/^\t"(\w+)": \["[^"]*", "[^"]*", (\{[^\n]*\})\],$/gm)].map(m => [m[1], JSON.parse(m[2])]));
const offT = EYE.EYE_STYLES.filter(([id, , , set]) => { const g = styles[id]; if (!g) return true; const plain = Object.fromEntries(Object.entries(set).filter(([k, v]) => EYE.EYE_STYLES[0][3][k] !== v || k === "iris" || k === "iris2")); return Object.entries(g).some(([k, v]) => set[k] !== v) || Object.keys(plain).some(k => !(k in g)); }).map(s => s[0]);
say(!offT.length, `its styles hold the Studio's ${EYE.EYE_STYLES.length} eye styles` + (offT.length ? ": not " + offT.join(", ") : ""));

// ---- the ready-made HSEyeLook of each eye look: its eyeball's own settings (what HSEyePaint takes)
const takes = new Set([...colours, ...controls.keys(), ...choices.keys()]);
const gdv = v => typeof v === "string" ? JSON.stringify(v) : Number.isInteger(v) ? v.toFixed(1) : String(v);
for (const [id, L] of Object.entries(EL.EYE_LOOKS)) {
  const words = Object.fromEntries(Object.entries(L.eyes || {}).filter(([k]) => takes.has(k)));
  const text = `[gd_resource type="Resource" script_class="HSEyeLook" load_steps=2 format=3]\n\n[ext_resource type="Script" path="res://addons/horrorstudio_look/eye_look.gd" id="1"]\n\n[resource]\nscript = ExtResource("1")\ntitle = ${JSON.stringify(L.label)}\nabout = ${JSON.stringify("The Character Studio's eye look of that name, its eyeball alone (the iris, the pupil, the white, the catchlights that stay): on any character's eyes. The lids, the lashes and the makeup are the Studio's to make.")}\npaint = {\n${Object.entries(words).map(([k, v]) => `"${k}": ${gdv(v)}`).join(",\n")}\n}\n`;
  const file = path.join(PLUGIN, "eyes", `eyes_${id}.tres`);
  if (write) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
  say(fs.existsSync(file) && fs.readFileSync(file, "utf8") === text, `its ready-made HSEyeLook (addons/horrorstudio_look/eyes/eyes_${id}.tres) holds its ${Object.keys(words).length} eyeball settings` + (fs.existsSync(file) && fs.readFileSync(file, "utf8") === text ? "" : " (not as eyelooks.js has them: node tools/character/eyelooks_check.mjs --write)"));
}
console.log(ok ? "EYELOOKS ok" : "EYELOOKS FAIL");
process.exit(ok ? 0 : 1);

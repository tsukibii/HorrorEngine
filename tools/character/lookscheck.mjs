// LOOKS: every whole look (looks.js LOOKS: the Character Studio's Face, Look) names only what exists, checked without a
// browser. A look's lash style, brow shape and their colours (browlash.js), its skin and makeup presets and every
// makeup setting it gives (skinshader.js FEATURES and COLOURS), its lipstick's settings (lips.js), every colour a
// colour, every number within its slider. Written after a look named a brow colour that isn't there and the page
// threw when it was worn (LESSONS 2026-11-13). The files that draw (browlash.js, skinshader.js) import three.js, which
// node has not: their tables are read from their source.
//   node tools/character/lookscheck.mjs        ends "LOOKS ok"
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), src = f => fs.readFileSync(path.join(HERE, f), "utf8");
const { LOOKS, NEW_LOOK } = await import("./looks.js"), LIPS = await import("./lips.js");
let bad = 0; const say = (ok, words) => { if (!ok) bad++; console.log((ok ? "  ok  " : "  BAD ") + words); };
const block = (s, start) => { const i = s.indexOf(start); if (i < 0) return ""; let d = 0, j = s.indexOf(start.at(-1), i + start.length - 1); const open = s[j], close = open === "{" ? "}" : "]"; for (let k = j; k < s.length; k++) { if (s[k] === open) d++; else if (s[k] === close && --d === 0) return s.slice(j, k + 1); } return ""; };
const BL = src("browlash.js"), SK = src("skinshader.js");
const keys = b => [...b.matchAll(/^\s{2}"?([A-Za-z0-9_ ()-]+?)"?: \{/gm)].map(m => m[1]);
const lashStyles = keys(block(BL, "export const LASH_STYLES = {")), browShapes = keys(block(BL, "export const BROW_SHAPES = {")), hairLooks = [...BL.matchAll(/^\s{2}((?:lash|brow)_[a-z_]+): \{/gm)].map(m => m[1]);
const feats = new Map([...block(SK, "export const FEATURES = [").matchAll(/^\s*\["([A-Za-z]+)", "[^"]*", (-?[\d.]+), (-?[\d.]+),/gm)].map(m => [m[1], [+m[2], +m[3]]]));
const cols = [...block(SK, "export const COLOURS = [").matchAll(/\["([A-Za-z]+)", "[^"]*", "#[0-9a-fA-F]{6}"\]/g)].map(m => m[1]);
const skinPre = keys(block(SK, "export const SKIN_PRESETS = {")), makePre = keys(block(SK, "export const MAKEUP_PRESETS = {"));
say(lashStyles.length >= 10 && browShapes.length >= 4 && hairLooks.length >= 6 && feats.size >= 30 && cols.length >= 8 && skinPre.length >= 4 && makePre.length >= 8,
  `the tables read from their source: ${lashStyles.length} lash styles, ${browShapes.length} brow shapes, ${hairLooks.length} lash and brow colours, ${feats.size} skin features, ${cols.length} colours, ${skinPre.length} skin presets, ${makePre.length} makeup presets`);
const hex = v => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v), lipNum = new Map([...LIPS.LIP_PAINT, ...LIPS.LIP_SHAPE].map(r => [r[0], [r[2], r[3]]])), wrong = [];
const makeup = (name, m) => { for (const [k, v] of Object.entries(m)) {
  if (cols.includes(k)) { if (!hex(v)) wrong.push(`${name}: makeup ${k} is not a colour (${v})`); }
  else if (feats.has(k)) { const [lo, hi] = feats.get(k); if (!(typeof v === "number" && v >= lo && v <= hi)) wrong.push(`${name}: makeup ${k} ${v} outside ${lo}..${hi}`); }
  else if (k !== "rough") wrong.push(`${name}: no makeup setting ${k}`); } };
for (const [name, L] of Object.entries(LOOKS)) {
  if (!L.about) wrong.push(`${name}: no words`);
  if (L.lash) { if (L.lash.style && !lashStyles.includes(L.lash.style)) wrong.push(`${name}: no lash style ${L.lash.style}`); if (L.lash.look && !hairLooks.includes(L.lash.look)) wrong.push(`${name}: no lash colour ${L.lash.look}`); }
  if (L.brow) { if (L.brow.shape && !browShapes.includes(L.brow.shape)) wrong.push(`${name}: no brow shape ${L.brow.shape}`); if (L.brow.look && !hairLooks.includes(L.brow.look)) wrong.push(`${name}: no brow colour ${L.brow.look}`); }
  if (L.lips) for (const [k, v] of Object.entries(L.lips)) {
    if (k === "on") continue;
    if (k === "colour" || k === "colour2") { if (!hex(v)) wrong.push(`${name}: lips ${k} is not a colour`); }
    else if (!lipNum.has(k)) wrong.push(`${name}: no lipstick setting ${k}`);
    else { const [lo, hi] = lipNum.get(k); if (!(typeof v === "number" && v >= lo && v <= hi)) wrong.push(`${name}: lips ${k} ${v} outside ${lo}..${hi}`); } }
  if (L.eyes) for (const [k, v] of Object.entries(L.eyes)) if (typeof v === "string" && v.startsWith("#") && !hex(v)) wrong.push(`${name}: eyes ${k} is not a colour`); else if (typeof v === "number" && !Number.isFinite(v)) wrong.push(`${name}: eyes ${k}`);
  const S = L.skin; if (S && !S.off) {
    if (S.preset && !skinPre.includes(S.preset)) wrong.push(`${name}: no skin preset ${S.preset}`);
    if (typeof S.makeup === "string") { if (!makePre.includes(S.makeup)) wrong.push(`${name}: no makeup preset ${S.makeup}`); } else if (S.makeup) makeup(name, S.makeup);
    if (S.tweak) makeup(name, S.tweak); }
}
say(!wrong.length, `${Object.keys(LOOKS).length} looks, each naming only what exists (lash styles, brow shapes, their colours, skin and makeup presets, every makeup and lipstick setting within its slider, every colour a colour)${wrong.length ? ": " + wrong.slice(0, 8).join("; ") : ""}`);
say(!!LOOKS[NEW_LOOK], `a new character's look is one of them (${NEW_LOOK})`);
// the lipstick's new parts are off by default (a character from before them is as it was), and the looks after the
// user's references use them
const D = LIPS.LIPS_DEFAULTS, two = Object.entries(LOOKS).filter(([, L]) => L.lips?.inner > 0).map(([k]) => k), wet = Object.entries(LOOKS).filter(([, L]) => L.lips?.shine > 0).map(([k]) => k), low = Object.entries(LOOKS).filter(([, L]) => L.skin?.makeup?.lowerColor).map(([k]) => k);
say(D.inner === 0 && D.shine === 0 && hex(D.colour2) && feats.has("highlight") && cols.includes("lowerColor") && /export const withLower/.test(SK),
  "the lipstick's inner colour and wet shine are off unless a look or a slider sets them; the skin has a highlighter and a lower liner colour of its own (settings from before it take the liner's: withLower)");
say(two.length >= 4 && wet.length >= 3 && low.length >= 4, `${two.length} looks with a two-tone lip (${two.join(", ")}), ${wet.length} with painted glints, ${low.length} with a lower liner in its own colour`);
if (bad) { console.log(`LOOKS FAIL: ${bad}`); process.exit(1); }
console.log("LOOKS ok");

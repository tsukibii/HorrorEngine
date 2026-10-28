// The director's stage: a scene's level in greybox (the same plan the Unreal importer builds), the cast as previs
// figures, and the player's eye. Plays a scene's clips on its elastic timeline with blends, seams and camera moves;
// renders storyboard frames; finds which body parts the player can see; exports the blocking as glTF for Unreal.
import * as THREE from "three";
import * as M from "./motion.js";
import * as K3 from "./kit3.js";
import * as KIT from "./kit.js";
import { BodyFigure } from "./bodies.js";
import { LifeFX } from "./lifefx.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { wearEye } from "../shared/eye.js";
import { stainMaterial } from "./stain.js";
import * as FACE from "../shared/face.js";      // tools/shared (served at /shared: the page sits at the root)
import { layUVs } from "./painted.js";
import { behaviourOf } from "./play/behaviours.js";   // a scene's behave cues play Play's own behaviours (a body track)
import { settingsOf } from "./play/parts.js";
const Y_UP = new THREE.Vector3(0, 1, 0);
// the simple view (the toolbar's Simple, for when the desk lags): every lit surface a plain Lambert of its own colour, no
// textures (but where a texture cuts a shape out, as a hair card's does), no physical shading, the eyes plain, the
// picture at one pixel per pixel; Blender's solid view. The materials come back as they were when it's turned off
const SIMPLE = new WeakMap(), PLAIN_TINT = new THREE.Color(0xb8b8b8);
function simpleOf(m) {
  if (Array.isArray(m)) { const a = m.map(simpleOf); return a.some(Boolean) ? a.map((x, i) => x || m[i]) : null; }
  if (!m || m.userData.simple || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshPhongMaterial || m.isMeshLambertMaterial && m.map)) return null;
  let s = SIMPLE.get(m);
  if (!s) {
    const eye = m.userData.plain && m.userData.plain.map, cut = m.map && (m.alphaTest > 0 || m.transparent);   // the eye keeps its flat paint (no refraction): the gaze still reads
    s = new THREE.MeshLambertMaterial({ color: eye ? 0xffffff : m.map ? PLAIN_TINT.clone().multiply(m.color) : m.color.clone(), map: eye || (cut ? m.map : null), alphaTest: m.alphaTest,
      transparent: m.transparent, opacity: m.opacity, side: m.side, vertexColors: m.vertexColors, depthWrite: m.depthWrite, visible: m.visible });
    s.userData.simple = true; SIMPLE.set(m, s);
  }
  return s;
}
// which way a body faces (radians about up, 0 toward +z): square to the line from its right hip to its left (Kimodo's
// SOMA legs, or the previs thighs)
function facing(p) {
  const l = p["soma:LeftLeg"] || p.thigh_l, r = p["soma:RightLeg"] || p.thigh_r; if (!l || !r) return 0;
  const lv = new THREE.Vector3().subVectors(l, r); lv.y = 0; const f = new THREE.Vector3().crossVectors(lv, Y_UP); return Math.atan2(f.x, f.z);
}

// The studio's CC0 library (Content/Studio/Library, docs/ASSETS.md): what's been fetched, from /api/library. A prop
// tagged art:<ref> shows that mesh in its block (the block stays, invisible, for the visibility test); mat:<ref> puts
// that texture set on a block, tiled by real metres. Anything not fetched stays a grey block. A prop with a kit
// (docs/KIT.md) is drawn from its numbers by kit.js, the presets from /api/kit.
export const LIBRARY = { meshes: new Set(), textures: {}, kit: {} };
export async function loadAssetLibrary() {
  try {
    const r = await (await fetch("/api/library")).json();
    LIBRARY.meshes = new Set(r.meshes || []); LIBRARY.textures = r.textures || {};
  } catch (e) { /* no library: blocks */ }
  try { LIBRARY.kit = (await (await fetch("/api/kit")).json()).presets || {}; } catch (e) { /* no kit presets */ }
  return LIBRARY;
}
// the placeholder things painted on their templates (tools/uv_templates.py, docs/ASSETS.md §7): {prop id: its layout
// (each face's island, which way u and v run) and its picture}; a block that has one wears it, its UVs laid from it
export const PAINTED = { game: null, things: {} };
export async function loadPainted(game) {
  PAINTED.game = game; PAINTED.things = {};
  try { PAINTED.things = (await (await fetch("/api/painted/" + encodeURIComponent(game))).json()).things || {}; } catch (e) { /* nothing painted */ }
  return PAINTED;
}
const paintCache = {};
function paintedMaterial(lay) {
  const key = lay.png + "|" + lay.t;
  if (!paintCache[key]) { const tex = new THREE.TextureLoader().load(`${lay.png}?t=${lay.t}`); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; paintCache[key] = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }); }
  return paintCache[key];
}
const meshCache = {}, matCache = {};
function libMesh(ref) {
  if (!meshCache[ref]) meshCache[ref] = new GLTFLoader().loadAsync(`/library/meshes/${ref}.glb`).then(g => g.scene).catch(() => null);
  return meshCache[ref];
}
export const encPath = p => p.split("/").map(encodeURIComponent).join("/");
function libMaterial(ref) {
  const meta = LIBRARY.textures[ref], key = `${ref}|${meta.stamp || ""}|${meta.orm || ""}|${meta.normal || ""}|${meta.tile_m || 1}`;   // a set changed on the shelf: a new material
  if (matCache[key]) return matCache[key];
  const tl = new THREE.TextureLoader(), maps = meta.maps || {};
  const tex = (k, srgb) => {
    if (!maps[k]) return null;
    const t = tl.load(meta.base ? `${encPath(meta.base)}/${encodeURIComponent(maps[k])}?s=${meta.stamp || ""}` : `/library/textures/${ref}/${maps[k]}`);   // base: a PBR shelf set
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  m.map = tex("albedo", true); m.normalMap = tex("normal"); m.roughnessMap = tex("rough"); m.metalnessMap = tex("metal"); m.aoMap = tex("ao");
  if (meta.orm && meta.base) {         // a packed map (Unreal's ORM, Poly Haven's ARM): AO red, roughness green, metal blue
    const t = !(m.roughnessMap && m.metalnessMap && m.aoMap) && tl.load(`${encPath(meta.base)}/${encodeURIComponent(meta.orm)}?s=${meta.stamp || ""}`);
    if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; m.roughnessMap ||= t; m.metalnessMap ||= t; m.aoMap ||= t; }
  }
  if (m.metalnessMap) m.metalness = 1;
  m.alphaMap = tex("opacity"); if (m.alphaMap) m.alphaTest = 0.5;       // a net, a grille: cut out where it's dark
  if (meta.normal === "dx" && m.normalMap) m.normalScale.set(1, -1);     // DirectX normals: green flipped
  m.userData.tile = meta.tile_m || 1;
  return (matCache[key] = m);
}
function tileUVs(geo, w, h, d, tile) {     // a box's UVs in metres / tile, so a texture keeps its real size on any block
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];  // px nx py ny pz nz
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
  }
  geo.setAttribute("uv1", uv.clone());   // the ao map's channel
}

const EYE = 1.65;
// First person: the camera IS the player's eye. It stands where the player can stand, at the stance's eye height,
// looks within the neck's reach, and never changes lens (docs/DIRECTING.md §1). A shot size is a framing reached by
// DISTANCE: how close the actor comes to the eye (Hall's proxemic zones), at the game's one field of view.
export const EYES = { stand: 1.65, crouch: 1.05, kneel: 1.2, sit: 1.15, lie: 0.3, hide: 1.6 };
export const SEE_THROUGH = 0.6;                   // how see-through a hiding place is from inside, when nothing says
const SLAT_PITCH = 0.06;                           // a hiding place's slats, one every 6 cm
const SLATS = {};
function slatTexture(amount) {                     // horizontal bars, `amount` of each one a gap (an alpha map: white shows)
  const k = Math.round(amount * 20) / 20;
  if (SLATS[k]) return SLATS[k];
  const c = document.createElement("canvas"); c.width = 4; c.height = 64;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 4, 64); g.fillStyle = "#000"; g.fillRect(0, 0, 4, Math.round(64 * k));
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter;
  return (SLATS[k] = t);
}
export const FOV_H = 90;               // the game's horizontal field of view (game.fov overrides)
export const LEAN = 0.35, ZOOM = 0.15, PITCH = 75;   // how far the player leans in (push), the most a held focus narrows, the neck
export function vfov(hfov, aspect) { return 2 * Math.atan(Math.tan(hfov * Math.PI / 360) / aspect) * 180 / Math.PI; }
export const PLAYER_FOV = vfov(FOV_H, 16 / 9);
export const SHOTS = {
  ecu: { near: 0, far: 0.3, dist: "under 0.3 m", zone: "intimate (a violation)", use: "in your face: a breath on you, a bite, the grab, the eye at the keyhole" },
  cu: { near: 0.3, far: 0.55, dist: "0.3-0.55 m", zone: "intimate", use: "a face leaning into yours: a whisper, a threat said quietly, a confession, a kiss" },
  mcu: { near: 0.55, far: 0.9, dist: "0.55-0.9 m", zone: "personal (arm's length)", use: "head and shoulders: talking close, a hand on your shoulder" },
  ms: { near: 0.9, far: 1.6, dist: "0.9-1.6 m", zone: "personal to social", use: "waist up: across a table, a conversation, someone blocking the way" },
  fs: { near: 1.6, far: 3, dist: "1.6-3 m", zone: "social", use: "the whole body: in the doorway, across the room, the pose reads" },
  ws: { near: 3, far: 1e9, dist: "over 3 m", zone: "public", use: "small in the room: at the end of the corridor, in the window, the empty frame" },
  insert: { near: 0.2, far: 0.7, dist: "0.2-0.7 m (an object)", zone: "within reach", use: "an object in your hands or on the table in front of you: the player looks down at it" },
  pov_down: { near: 0, far: 1e9, dist: "-", zone: "-", use: "the player looks down: their hands, a body at their feet, being dragged" },
  pov_up: { near: 0, far: 1e9, dist: "-", zone: "-", use: "the player looks up: something on the ceiling, someone looming over a seated or fallen player" },
};
export function shotFor(d) { return ["ecu", "cu", "mcu", "ms", "fs", "ws"].find(k => d < SHOTS[k].far); }
export const SEAM_SECS = { none: 0, blink: 0.2, glance: 1, flicker: 0.4, occlude: 0.8, cutaway: 1.5, turn: 0, stumble: 1, dip: 2, jcut: 0, heartbeat: 0.6 };

export const s2t = (x, y, z) => new THREE.Vector3(x, z, -y);       // story (x east, y north, z up) -> three (y up)

// the time of day (STORY_FORMAT §3.1; storylib's TIMES, flow_outs, flow_times): a scene's own `time`, else the time it
// was when the flow got there, from the scene it branched from back to game.time
export const TIMES = ["day", "dusk", "night"], TIME_DEFAULT = "night";
export function flowOuts(story, nid) {
  const n = (story.flow || {})[nid] || {}, out = n.next ? [n.next] : [];
  for (const o of n.options || []) if (o.to) out.push(o.to);
  if (n.type === "stitch") {
    const st = (story.stitches || {})[n.ref] || {};
    if (st.timer && st.timer.fail) out.push(st.timer.fail);
    for (const it of story.interrupts || []) { const during = it.during || "all"; if (it.to && (during === "all" || during.includes(n.ref))) out.push(it.to); }
  }
  if (n.type === "scene") out.push(...answerJumps((story.scenes || {})[n.ref]));
  return out;
}
// the cards a scene's answers send the flow to (§9.9 go {node}), from any of its versions (storylib.answer_jumps)
export function answerJumps(sc) {
  const out = [];
  for (const v of [sc || {}, ...Object.values((sc && sc.variants) || {})]) for (const c of v.clips || []) for (const o of (c.reply && c.reply.options) || []) {
    const [g, to] = replyGo(o); if (g === "node" && to && !out.includes(to)) out.push(to);
  }
  return out;
}
// each cast member's model through the flow (STORY_FORMAT §2 a cast member's `models`, §3.1 a scene's; storylib.
// flow_models): a scene's choice carries down every way after it until a later scene picks another or sets it back to
// default, as the time carries. {nid: {before, models, own: {cast id: variant}, mixed: [cast ids whose model depends on
// the way you came, the scene not saying], meets: {cast id: [models]} where ways bringing different ones meet}}; a cast
// member not in it wears the default
export const sceneModels = sc => (sc && sc.models && typeof sc.models === "object" && !Array.isArray(sc.models) ? sc.models : {});
export const wearModels = (m, own) => { const out = Object.assign({}, m); for (const [cid, v] of Object.entries(own || {})) { if (!v || v === "default") delete out[cid]; else out[cid] = v; } return out; };
export function flowModels(story) {
  const flow = story.flow || {}, scenes = story.scenes || {}, came = {};
  const ownOf = n => (n.type === "scene" ? sceneModels(scenes[n.ref]) : {});
  const key = m => JSON.stringify(Object.keys(m).sort().map(k => [k, m[k]]));
  const todo = [[(story.game || {}).start, {}]];
  for (let i = 0; i < todo.length; i++) {   // breadth first, as flowTimes
    const [nid, m] = todo[i]; if (!flow[nid]) continue;
    const seen = came[nid] || (came[nid] = new Map()), k = key(m); if (seen.has(k)) continue; seen.set(k, m);
    const after = wearModels(m, ownOf(flow[nid]));
    for (const to of flowOuts(story, nid)) todo.push([to, after]);
  }
  const preds = {}, afters = {}, out = {};
  for (const k of Object.keys(came)) { afters[k] = [...came[k].values()].map(st => wearModels(st, ownOf(flow[k]))); for (const to of flowOuts(story, k)) (preds[to] = preds[to] || new Set()).add(k); }
  for (const [nid, seen] of Object.entries(came)) {
    const states = [...seen.values()], own = ownOf(flow[nid]), cids = [...new Set(states.flatMap(st => Object.keys(st)))].sort();
    const vals = Object.fromEntries(cids.map(c => [c, [...new Set(states.map(st => st[c] || "default"))].sort()])), meets = {};
    for (const c of cids) if (vals[c].length > 1 && [...(preds[nid] || [])].every(p => new Set((afters[p] || []).map(st => st[c] || "default")).size <= 1)) meets[c] = vals[c];   // where the ways meet
    out[nid] = { before: states[0], models: wearModels(states[0], own), own, mixed: cids.filter(c => !(c in own) && vals[c].length > 1), meets };
  }
  return out;
}
// the body file a cast member wears in a variant, else their default (previs_body, the game's; storylib.model_file)
export function modelFile(story, cid, variant) {
  const c = ((story && story.cast) || {})[cid] || {};
  return (variant && variant !== "default" && (c.models || {})[variant]) || c.previs_body || ((story && story.game) || {}).previs_body || null;
}
// the time of day a task's chapters leave it at (its last `chapter` with a `time`; storylib.chapter_time), or null
export function chapterTime(story, n) {
  if (!n || n.type !== "stitch") return null;
  let out = null;
  const walk = l => { for (const a of l || []) { if (!a || typeof a !== "object") continue; if (a.chapter !== undefined && TIMES.includes(a.time)) out = a.time;
    for (const o of a.options || []) walk(o.do); if (a.todo !== undefined && a.on) for (const x of Object.values(a.on)) walk(x); } };
  for (const b of ((story.stitches || {})[n.ref] || {}).beats || []) walk(b.do);
  return out;
}
export function flowTimes(story) {        // {nid: {time, from (the scene node that set it, or "game"), own, paths}}
  const flow = story.flow || {}, scenes = story.scenes || {}, game = story.game || {}, came = {};
  const ownOf = n => n.type === "scene" ? ((scenes[n.ref] || {}).time || null) : null;
  const todo = [[game.start, game.time || TIME_DEFAULT, "game"]];
  for (let i = 0; i < todo.length; i++) {   // breadth first: the nearest scene before a node wins
    const [nid, t, src] = todo[i]; if (!flow[nid]) continue;
    const seen = came[nid] || (came[nid] = new Map()); if (seen.has(t)) continue; seen.set(t, src);
    const on = ownOf(flow[nid]) || chapterTime(story, flow[nid]);   // a scene's own time, or the one a task's chapter leaves (a night's sleep)
    for (const to of flowOuts(story, nid)) todo.push([to, on || t, on ? nid : src]);
  }
  const out = {};
  for (const [nid, seen] of Object.entries(came)) {
    const own = ownOf(flow[nid]), [t, src] = seen.entries().next().value;
    out[nid] = { time: own || t, from: own ? nid : src, own: !!own, paths: [...seen.keys()].sort() };
  }
  return out;
}
// how each time looks on the desk, as Light Kit does in Unreal: the sky (seen through the windows, and the fog), the
// ambient and the sky's fill, and a soft light in each window of the level (its colour, candela a square metre of
// glass, its reach). Night is a deep blue, never black (DECISIONS 2026-10-23)
export const TIME_LOOK = {
  day:   { sky: 0xb7c6d6, amb: [0xd6dae2, 0.65], hemi: [0xdce7f5, 0x5a4a3a, 0.8], win: [0xeef3ff, 20, 8] },
  dusk:  { sky: 0x2e2030, amb: [0xa08c88, 0.32], hemi: [0xd8a07e, 0x1a1410, 0.38], win: [0xffb27a, 6, 6] },
  night: { sky: 0x070a16, amb: [0x7a86aa, 0.22], hemi: [0x6474ac, 0x0c0a12, 0.24], win: [0x8fa8ff, 1.2, 5] },
};
const yawToThree = rot => (rot + 90) * Math.PI / 180;               // character +Z faces the spot's rot

// how long a Japanese line takes (storylib.ja_secs): kana a mora, kanji about 1.7, pauses for punctuation, at 6.5 morae a second
const JA_PAUSES = { "…": 0.25, "‥": 0.2, "、": 0.25, "。": 0.45, "？": 0.4, "！": 0.3, "?": 0.4, "!": 0.3, "—": 0.3, "―": 0.3 }, JA_SMALL = "ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ";
export function jaSecs(t) {
  let m = 0, p = 0;
  for (const ch of String(t)) { const o = ch.codePointAt(0); if (JA_PAUSES[ch]) p += JA_PAUSES[ch]; else if (JA_SMALL.includes(ch)) continue; else if (o >= 0x3040 && o <= 0x30ff) m += 1; else if ((o >= 0x4e00 && o <= 0x9fff) || (o >= 0x3400 && o <= 0x4dbf)) m += 1.7; else if (/[A-Za-z0-9]/.test(ch)) m += 1 / 3; }
  return m / 6.5 + p + 0.5;
}
export const PLAYS = { hide: ["hidden", "found"], run: ["escaped", "caught"], collect: ["done", "failed"], sneak: ["made_it", "spotted"],
  hold: ["held", "broke"], search: ["found", "out_of_time"], escape: ["out", "caught"] };   // storylib.PLAYS
export const REPLY_SECS = 6, REPLY_ANSWER = 2.5;   // storylib's: she waits this long; a player answers in about this
// her answer to a reply, its lines as clips of their own (their takes: <take id>_<option>, then _2, _3...): `then` is
// one line, or a list of them (a conversation card's answer, STORY_FORMAT §9.9)
export const thenList = o => (Array.isArray(o.then) ? o.then.filter(x => x && typeof x === "object") : o.then && typeof o.then === "object" ? [o.then] : []);
export const thenId = (c, o, n = 0) => `${c.id}_${o.id}${n ? "_" + (n + 1) : ""}`;
export function thenClips(c, o) {
  if (!c._then) Object.defineProperty(c, "_then", { value: {}, enumerable: false, writable: true });
  const key = JSON.stringify(o.then) + c.who, hit = c._then[o.id];        // the same objects while it's unchanged
  if (hit && hit.key === key) return hit.clips;
  return (c._then[o.id] = { key, clips: thenList(o).map((th, n) => Object.assign({ who: c.who }, th, { id: thenId(c, o, n) })) }).clips;
}
export const thenClip = (c, o) => thenClips(c, o)[0];
// where an answer leaves the conversation: ["next"], ["clip", id] (a later line), ["end"], or ["node", id] (another card)
export function replyGo(o) {
  const g = (o && o.go) || "next";
  if (g && typeof g === "object") return g.clip !== undefined ? ["clip", g.clip] : g.node !== undefined ? ["node", g.node] : ["next"];
  return g === "end" ? ["end"] : ["next"];
}
export function eventSecs(ev, story) { return +ev.secs || (ev.type === "choose" && story && (story.format || 2) >= 3 ? 30 : 3); }
export function karmaOf(d) { if (d === undefined || d === null) return {}; return typeof d === "number" ? { karma: d } : Object.assign({}, d); }
export function addKarma(into, d) { for (const [k, v] of Object.entries(karmaOf(d))) into[k] = (into[k] || 0) + +v; return into; }
export function karmaPick(n, karma, story) {             // a flow choice by karma: the first option whose min/max holds
  const axes = Object.keys(((story.game || {}).karma || {}).axes || { karma: 1 });
  for (const o of n.options || []) { const v = karma[o.axis || (axes.includes("karma") ? "karma" : axes[0])] || 0; if ((o.min === undefined || v >= o.min) && (o.max === undefined || v <= o.max)) return o; }
  return (n.options || [])[n.options.length - 1];
}
export function clipSecs(c) {
  if (c.dur) { const tr = c.trim || {}; return Math.max(0.1, +c.dur - +(tr.in || 0) - +(tr.out || 0)); }
  if (c.dur_tts) return +c.dur_tts;
  if (c.ja && /[\u3000-\u9fff]/.test(c.ja)) return Math.max(1.5, jaSecs(c.ja));
  return Math.max(1.5, (c.en || "").length / 12 + 0.6);
}
// the MiniMax image-to-video prompt for a take (storylib.minimax_prompt, docs/VOICES.md)
export function minimaxPrompt(c, cast) {
  const subj = ((cast || {})[c.who] || {}).subject || "she", voice = c.voice || "says", line = `<d>[Japanese] ${c.ja || ""} </d>`;
  if (c.face === false) return `an off-screen voice ${voice}, no one on screen speaks ${line}`;
  const expr = (c.expr || "neutral expression").trim(), art = /^(a|an|the|her|his) /i.test(expr) ? "" : (/^[aeiou]/i.test(expr) ? "an " : "a ");
  let out = `${subj} makes ${art}${expr} while ${subj} ${voice} ${line}`;
  if (c.reply || c.wait_expr) { const w = (c.wait_expr || "hopeful, expectant expression").trim(); out += `, then ${subj} makes ${/^(a|an) /i.test(w) ? "" : /^[aeiou]/i.test(w) ? "an " : "a "}${w} and waits silently`; }
  return out;
}
export const VOICES = ["says", "whispers", "says angrily", "screams", "murmurs", "sobs", "says softly", "says coldly", "says flatly", "pleads", "laughs", "giggles", "says in a trembling voice", "hisses", "gasps", "sings softly", "hums"];
// the expression library as scenes use it (their face rows: STORY_FORMAT §3.7), fetched once a page: each expression
// a scene places, ARKit's map onto MHR's 72 shapes and MHR's face for Studio exports (tools/shared/face.js)
export const FACES = { lib: {}, wait: {}, M: null, F: null };
export function loadFaces(faces) {
  const list = faces || [], jobs = [];
  for (const id of new Set(list.map(p => p.expr).filter(Boolean))) {
    if (FACES.lib[id]) continue;
    jobs.push(FACES.wait[id] = FACES.wait[id] || fetch(`/api/expressions/${encodeURIComponent(id)}`).then(r => r.ok ? r.json() : null).then(e => { if (e) FACES.lib[id] = e; else delete FACES.wait[id]; }).catch(() => { delete FACES.wait[id]; }));
  }
  if (list.length && !FACES.M) jobs.push(FACE.loadMap().then(m => { FACES.M = m; }).catch(() => null));
  if (list.length && !FACES.F) jobs.push(FACE.loadMHRFace().then(f => { FACES.F = f; }).catch(() => null));
  return Promise.all(jobs);
}
export function forgetFace(id) { if (id) { delete FACES.lib[id]; delete FACES.wait[id]; } else { FACES.lib = {}; FACES.wait = {}; } }   // the library changed
// a clip edge's time on a timeline (a face's or a cue's `at`), or undefined when the clip isn't in it
export function edgeTime(segs, at) {
  const s = segs.find(x => x.type === "clip" && !x.answer && x.clip.id === (at || {}).clip);
  return s ? (at.edge === "end" ? s.end : s.start) + (+at.offset || 0) : undefined;
}

// a scene version's face rows laid on its timeline (face.js facePlan), with the expressions loaded so far
export function facePlanOf(v, tl) { return FACE.facePlan(v.faces, at => edgeTime(tl.segs, at), tl.total, FACES.lib); }

export function version(sc) { const v = sc && sc.variants && sc.pick && sc.variants[sc.pick]; return v ? Object.assign({}, sc, v) : (sc || {}); }

// ---- the figure -------------------------------------------------------------------------------------------------
export const RADIUS = { spine_01: 0.12, spine_02: 0.12, spine_03: 0.13, neck_01: 0.05, head: 0.05, clavicle_l: 0.05, clavicle_r: 0.05,
  upperarm_l: 0.05, upperarm_r: 0.05, lowerarm_l: 0.042, lowerarm_r: 0.042, hand_l: 0.035, hand_r: 0.035, hand_end_l: 0.03, hand_end_r: 0.03,
  thigh_l: 0.075, thigh_r: 0.075, calf_l: 0.055, calf_r: 0.055, foot_l: 0.045, foot_r: 0.045, ball_l: 0.04, ball_r: 0.04 };

export class Figure {
  constructor(lib, height, color = 0xc8c2b6) {
    this.lib = lib; this.height = height || 1.7;
    this.group = new THREE.Group();
    this.mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, emissive: 0x15120e });
    this.bones = [];
    for (const j of lib.joints) {
      if (!j.parent || j.name === "head_end") continue;
      const r = RADIUS[j.parent] || 0.04;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 1, 10), this.mat);
      m.userData = { a: j.parent, b: j.name, joint: j.name };
      this.group.add(m); this.bones.push(m);
    }
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), this.mat);
    this.group.add(this.headMesh);
    this.nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.07), this.mat);
    this.group.add(this.nose);
    this.pos = null;
  }
  setColor(c) { this.mat.color.set(c); }
  update(pos) {                                   // pos: joint -> Vector3 in character space
    this.pos = pos;
    const up = new THREE.Vector3(0, 1, 0);
    for (const m of this.bones) {
      const a = pos[m.userData.a], b = pos[m.userData.b];
      if (!a || !b) { m.visible = false; continue; }
      m.visible = true;
      const d = b.clone().sub(a), len = d.length();
      m.position.copy(a).addScaledVector(d, 0.5);
      m.scale.set(1, Math.max(0.001, len), 1);
      m.quaternion.setFromUnitVectors(up, d.normalize());
    }
    if (pos.head && pos.head_end) this.headMesh.position.copy(pos.head).lerp(pos.head_end, 0.45);
    if (pos.head_side && pos.head) {              // the nose points where the head looks
      const f = new THREE.Vector3().crossVectors(pos.head_side.clone().sub(pos.head).setY(0), up).normalize();
      this.nose.position.copy(this.headMesh.position).addScaledVector(f, 0.11);
      this.nose.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f); this.nose.visible = true;
    } else this.nose.visible = false;
  }
  jointWorld(name) { const p = this.pos && this.pos[name]; return p ? this.group.localToWorld(p.clone()) : null; }
  headWorld() { return this.jointWorld("head") ? this.jointWorld("head").lerp(this.jointWorld("head_end"), 0.4) : this.group.position.clone().setY(1.55); }
}

// ---- the stage --------------------------------------------------------------------------------------------------
export class Stage {
  static SOMA = null;            // Kimodo's skeleton (names, parents): the look layer turns SOMA joints too
  static LIVES = null;           // the little things' lives (lives.json): a world with some gets their effects (lifefx.js)
  static showTrackers = true;
  static simple = false;         // the simple view: plain colours, no textures (simpleOf); every stage, the Watch's and Play's too
  constructor(container, lib) {
    this.lib = lib;
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050506);
    this.scene.fog = new THREE.Fog(0x050506, 4, 16);
    this.camera = new THREE.PerspectiveCamera(PLAYER_FOV, 16 / 9, 0.05, 60);
    this.amb = new THREE.AmbientLight(0x8a8f9a, 0.22); this.hemi = new THREE.HemisphereLight(0x9aa0b0, 0x1a1410, 0.25);   // set by the time (setTime)
    this.scene.add(this.amb, this.hemi); this.time = TIME_DEFAULT; this.windows = [];
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.lights = []; this.solid = []; this.cast = {}; this.things = {}; this.level = null;
    this.bodies = {}; this.defaultBody = null;      // loaded body templates by file name (app.js fills them)
    this.free = null;                               // free (orbit) camera state when inspecting from outside
    this.look = { yaw: 0, pitch: 0 };               // the player's own look inside a soft cone
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
  }
  resize() {
    const w = this.container.clientWidth || 640, h = this.container.clientHeight || 360;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%"; this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  setWorld(plan, story, level) {
    this.story = story; this.plan = plan; this.level = level;
    this.things = plan.things;
    this.uncull(); this._rooms = null;                // what Play left out of sight comes back first (cull)
    this.world.clear(); this.lights = []; this.solid = []; this.cast = {}; this.pending = []; this._through = new Set();
    const mats = {
      wall: new THREE.MeshStandardMaterial({ color: 0x55524d, roughness: 0.95 }),
      floor: new THREE.MeshStandardMaterial({ color: 0x3a342d, roughness: 1 }),
      ceiling: new THREE.MeshStandardMaterial({ color: 0x2c2c2e, roughness: 1 }),
      door: new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.8 }),
      prop: new THREE.MeshStandardMaterial({ color: 0x5d6f86, roughness: 0.8 }),
      use: new THREE.MeshStandardMaterial({ color: 0x4f8a5c, roughness: 0.8 }),
      trim: new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.55 }),                 // skirting, cornice, casings
      mirror: new THREE.MeshStandardMaterial({ color: 0xb8c4cc, roughness: 0.05, metalness: 0.9 }),
      screen: new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.2 }),
      paper: new THREE.MeshStandardMaterial({ color: 0xb59a7a, roughness: 0.9 }),
      white: new THREE.MeshStandardMaterial({ color: 0xe4e2dc, roughness: 0.5 }),
    };
    const BY_TAG = { mirror: "mirror", tv: "screen", poster: "paper", calendar: "paper", frame: "paper", board: "white", air_conditioner: "white", light_switch: "white" };
    for (const p of plan.pieces) {
      if (p.level !== level) continue;
      if (["wall", "floor", "ceiling", "door", "mesh"].includes(p.kind)) {
        const hidden = p.tags.includes("hidden");     // built but unseen and not solid, so Play can `show` it
        const [w, d, h] = p.size;
        const geo = p.shape === "cyl" ? new THREE.CylinderGeometry(w / 2, w / 2, h, 16) :
                    p.shape === "sphere" ? new THREE.SphereGeometry(w / 2, 16, 12) : new THREE.BoxGeometry(w, h, d);
        const tagged = BY_TAG[(p.tags.find(t => t.startsWith("tag:")) || "").slice(4)];
        let mat = p.kind === "mesh" ? (p.tags.some(t => t.startsWith("trim:")) ? mats.trim : tagged ? mats[tagged] : p.tags.some(t => t.startsWith("use:")) ? mats.use : mats.prop) : mats[p.kind];
        const matRef = (p.tags.find(t => t.startsWith("mat:")) || "").slice(4), artRef = (p.tags.find(t => t.startsWith("art:")) || "").slice(4);
        if (matRef && LIBRARY.textures[matRef] && p.shape === "box") { mat = libMaterial(matRef); tileUVs(geo, w, h, d, mat.userData.tile); }
        const painted = p.kind === "mesh" && p.shape === "box" && PAINTED.things[p.id];   // painted on its template: its UVs from the layout, at the block's own size
        if (painted) { mat = paintedMaterial(painted); layUVs(geo.attributes.position, geo.attributes.normal, geo.attributes.uv, Object.assign({}, painted, { size: [w, d, h] })); }
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(s2t(...p.pos));
        m.rotation.y = p.yaw * Math.PI / 180;
        m.userData = { id: p.id, kind: p.kind, art: artRef || null, use: (p.tags.find(t => t.startsWith("use:")) || "").slice(4) || null, piece: p };
        if (m.userData.use === "clean") m.material = stainMaterial((p.d || {}).stain, p.id);   // a stain: a blot on what it lies on
        m.visible = !hidden;
        m.userData.doorPart = (p.tags.find(t => t.startsWith("door_part:")) || "").slice(10) || null;
        m.userData.attach = (p.tags.find(t => t.startsWith("attach:")) || "").slice(7) || null;
        if (p.kind === "door" && p.d && p.d.kit) {          // where a kit door turns: its hinge axis, in the block's space
          try {
            const f = KIT.withDefaults(KIT.resolve(p.d.kit, LIBRARY.kit)), pv = KIT.pivotOf(f);
            m.userData.swing = { pivot: new THREE.Vector3(pv[0], 0, -pv[1]), hinge: f.hinge, slide: f.style === "slide" || f.style === "shoji" || (p.d.swing === "slide"), w: f.size[0],
                                 handleZ: f.handle_z, handleIn: f.handle_in };
          } catch (e) { }
        }
        this.world.add(m); if (!p.tags.includes("hollow") && !hidden && m.userData.use !== "clean") this.solid.push(m);     // a door frame: you see and walk through it; a stain: you walk over it
        if (p.tags.some(t => t.startsWith("kit:")) && p.d && p.d.kit !== undefined) this.kitIn(m, p.d.kit, h);
        else if (artRef && LIBRARY.meshes.has(artRef)) this.pending.push(this.dress(m, artRef, [w, h, d], p.tags.includes("real")));
      } else if (p.kind === "light") {
        const kind = (p.d && p.d.kind) || "bulb";
        const [col, inten, dist] = { bulb: [0xffc98a, 2.2, 7], candle: [0xffa84a, 1.0, 3.5], lamp: [0xffd2a0, 1.6, 5], fire: [0xff8a3a, 3, 9] }[kind] || [0xffc98a, 2, 7];
        const l = new THREE.PointLight(col, (p.d && p.d.lit === false) ? 0 : inten, dist, 1.6);
        l.position.copy(s2t(...p.pos));
        l.userData = { id: p.id, room: p.room, base: l.intensity, flicker: (p.d && p.d.flicker) || 0, kind };   // kind: a candle or a fire burns through a power cut
        this.world.add(l); this.lights.push(l);
      } else if (p.kind === "person") {
        const cid = (p.tags.find(t => t.startsWith("cast:")) || "").slice(5);
        const f = this.makeFigure(Object.assign({}, (story.cast || {})[cid] || {}, { height: p.size[2] }), 0x9a8fa8);
        f.update(M.fk(this.lib, M.clonePose(this.lib.poses.idle), p.size[2]).pos);
        f.group.position.copy(s2t(...p.pos)); f.group.rotation.y = yawToThree(p.yaw);
        f.group.visible = !p.tags.includes("hidden");
        f.group.userData.id = p.id;
        this.world.add(f.group);
      }
    }
    for (const [cid, c] of Object.entries(story.cast || {})) {
      const f = this.makeFigure(this.dressed(cid, c));
      f.group.visible = false;
      this.world.add(f.group); this.cast[cid] = f;
    }
    this.windows = [];                     // a soft light just inside every window, into the room (Light Kit Window's sky fill)
    for (const room of ((story.levels || {})[level] || {}).rooms || []) for (const op of room.openings || []) {
      if (!op.window && !((op.sill || 0) > 0.05)) continue;
      const [x0, y0, z0] = room.at, [w, d] = room.size;
      const line = { n: ["y", y0 + d, x0, -1], s: ["y", y0, x0, 1], e: ["x", x0 + w, y0, -1], w: ["x", x0, y0, 1] }[op.wall];
      if (!line) continue;
      const [axis, v, lo, inward] = line, along = lo + op.at, z = z0 + (op.sill || 0) + op.h / 2;
      const at = k => axis === "y" ? [along, v + inward * k, z - (k > 1 ? 0.8 : 0)] : [v + inward * k, along, z - (k > 1 ? 0.8 : 0)];
      const l = new THREE.SpotLight(0xffffff, 1, 6, 1.1, 1, 1.5);
      l.position.copy(s2t(...at(0.05))); l.target.position.copy(s2t(...at(2))); l.userData = { window: room.id, area: op.w * op.h };
      this.world.add(l, l.target); this.windows.push(l);
    }
    this.applyTime();
    if (Stage.LIVES) { this.life = this.life || new LifeFX(this, Stage.LIVES); this.life.attach(); }   // steam, smoke, glows...
  }
  setTime(t) { this.time = TIME_LOOK[t] ? t : TIME_DEFAULT; this.applyTime(); }
  applyTime() {
    const L = TIME_LOOK[this.time] || TIME_LOOK[TIME_DEFAULT];
    this.scene.background.set(L.sky); this.scene.fog.color.set(L.sky);
    this.amb.color.set(L.amb[0]); this.amb.intensity = L.amb[1];
    this.hemi.color.set(L.hemi[0]); this.hemi.groundColor.set(L.hemi[1]); this.hemi.intensity = L.hemi[2];
    for (const l of this.windows) { l.color.set(L.win[0]); l.intensity = L.win[1] * l.userData.area; l.distance = L.win[2]; }
  }

  fileFor(c) { return (c && c.previs_body) || (this.story && this.story.game && this.story.game.previs_body) || this.defaultBody; }
  bodyFor(c) {
    const file = this.fileFor(c);
    return file && file !== "capsules" ? this.bodies[file] : null;
  }
  makeFigure(c, color) {
    const h = +(c.height || 1.7), tpl = this.bodyFor(c);
    let f = null;
    if (tpl) {
      const studio = !!(tpl.userData && tpl.userData.studio);   // a Character Studio character: its own look and its eyes (tools/shared/eye.js), its own shape
      f = new BodyFigure(this.lib, h, tpl, { color, shape: studio ? null : c.shape, keepMaterials: studio });
      if (f.ok && studio) f.model.traverse(o => { if (o.isMesh) wearEye(o); });
      if (!f.ok) { console.warn("body file: bones not found:", f.missing.join(", ")); f = null; }
    }
    f = f || new Figure(this.lib, h, color);
    f.file = tpl ? this.fileFor(c) : null;             // the body it wears (a model switched: made again, setModels)
    return f;
  }
  // a cast member as this scene dresses them: their model (STORY_FORMAT §2 `models`), as setModels says
  dressed(cid, c) { const file = (this.models || {})[cid]; return file ? Object.assign({}, c, { previs_body: file }) : c; }
  // which model each cast member wears now: {cast id: body file} (flowModels, or the Watch's own run); a figure whose
  // body changes is made again where the old one stood
  setModels(map = {}) {
    this.models = map;
    for (const [cid, c] of Object.entries((this.story && this.story.cast) || {})) {
      const old = this.cast[cid]; if (!old) continue;
      const d = this.dressed(cid, c), file = this.bodyFor(d) ? this.fileFor(d) : null;
      if ((old.file || null) === file) continue;
      const f = this.makeFigure(d);
      f.group.position.copy(old.group.position); f.group.quaternion.copy(old.group.quaternion); f.group.visible = old.group.visible;
      (old.group.parent || this.world).add(f.group); if (old.group.parent) old.group.parent.remove(old.group);
      this.cast[cid] = f;
    }
  }

  // ---- a scene's timeline (elastic: every length comes from its clip) ----------------------------------------
  // picks: {clip id: reply option id, or null for silence}; without a pick a reply shows its first option's answer
  timeline(sc, picks = {}) {
    const v = version(sc), clips = v.clips || [], segs = [];
    let t = 0, go = null;
    for (let i = 0; i < clips.length; i++) {          // in order, unless an answer skips ahead, ends it, or leaves for another card (go)
      const c = clips[i];
      if (i && c.seam && SEAM_SECS[c.seam.kind]) { segs.push({ type: "seam", start: t, end: t + SEAM_SECS[c.seam.kind], seam: c.seam, i }); t += SEAM_SECS[c.seam.kind]; }
      const d = clipSecs(c);
      segs.push({ type: "clip", start: t, end: t + d, dur: d, clip: c, i }); t += d;
      const ev = c.event;
      if (ev) { const es = eventSecs(ev, this.story); segs.push({ type: "event", start: t, end: t + es, event: ev, clip: c, i }); t += es; }
      const rp = c.reply;
      if (rp) {                                       // the hanging line's wait, then her answer to the reply picked
        const picked = c.id in picks ? picks[c.id] : ((rp.options || [])[0] || {}).id;
        const o = (rp.options || []).find(x => x.id === (picked === null ? rp.timeout : picked));
        const ws = picked === null ? +(rp.wait || REPLY_SECS) : Math.min(+(rp.wait || REPLY_SECS), REPLY_ANSWER);
        segs.push({ type: "reply", start: t, end: t + ws, reply: rp, clip: c, i, picked }); t += ws;
        if (o) for (const th of thenClips(c, o)) { const td = clipSecs(th); segs.push({ type: "clip", start: t, end: t + td, dur: td, clip: th, i, answer: o.id }); t += td; }
        const [g, to] = replyGo(o);
        if (g === "clip") { const j = clips.findIndex(x => x.id === to); if (j > i) i = j - 1; }   // on from that line
        else if (g === "end" || g === "node") { go = g === "node" ? { node: to, from: c.id, answer: o.id } : null; break; }
      }
    }
    const hold = (v.hold && +v.hold.max) ? +v.hold.max / 2 : 0;
    if (hold) { segs.push({ type: "hold", start: t, end: t + hold }); t += hold; }
    const last = {};                                  // each actor starts a clip where their previous clip left them
    for (const c of clips) {
      this.resolveMoves(v, c);
      Object.defineProperty(c, "_startMove", { value: (last[c.who] || new THREE.Vector3()).clone(), enumerable: false, writable: true, configurable: true });
      const moved = ((c.body && c.body.block) || []).filter(k => k.moveVec);
      if (moved.length) last[c.who] = moved[moved.length - 1].moveVec.clone();
    }
    return { segs, total: t, v, go };                 // go: the card an answer sends the flow to, after the scene
  }
  resolveMoves(v, c) {             // blocking keys that `move` to a spot: the travel in the actor's own frame
    const keys = c.body && c.body.block; if (!keys) return;
    const spot = this.things[(v.stage || {})[c.who]]; if (!spot) return;
    const a = (spot.yaw + 90) * Math.PI / 180;
    for (const k of keys) {
      if (!k.move || !this.things[k.move]) { delete k.moveVec; continue; }
      const tg = this.things[k.move].pos, dx = tg[0] - spot.pos[0], dy = tg[1] - spot.pos[1];
      const w = new THREE.Vector3(dx, 0, -dy);                     // story -> three, then into the actor's frame
      w.applyAxisAngle(new THREE.Vector3(0, 1, 0), -a);
      Object.defineProperty(k, "moveVec", { value: w, enumerable: false, writable: true, configurable: true });
    }
  }

  // the body of clip c at local time t (seconds), in its actor's frame, starting where `start` puts it ({move, yaw}:
  // where their last clip left them, startOf; by default only blocking's own carry)
  clipPose(c, t, dur, files, start = null) {
    const lib = this.lib, body = c.body || {}, h = +((this.story.cast || {})[c.who] || {}).height || 1.7;
    const st = start || { move: c._startMove || new THREE.Vector3(), yaw: 0 };
    let pos = this.ownPose(c, t, dur, files);
    if (pos) {                                                     // a generated motion: turned and moved to where the actor is
      if (st.yaw) for (const n in pos) pos[n].applyAxisAngle(Y_UP, st.yaw);
      for (const n in pos) pos[n].add(st.move);
    } else {
      const u = Math.min(1, Math.max(0, t / Math.max(0.001, dur)));
      const keys = body.block && body.block.length ? body.block : [{ at: 0, pose: "idle" }];
      const p = M.evalBlock(lib, keys, M.remap(body.mods, u, dur) * dur, dur, st.move);
      p.yaw += st.yaw || 0;                                        // facing where a generated turn left them
      const br = Math.sin(t * 2.2) * 0.012;                        // breathing, so nothing is ever a statue
      p.q.spine_02.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), br));
      pos = M.fk(lib, p, h).pos;
    }
    if ((body.layers || []).length) pos = this.layered(c, pos, t, dur, files, h);
    if ((body.mods || []).some(m => m.type === "mirror")) pos = M.mirrorPositions(pos);
    return pos;
  }
  // a clip's layers over its body, in order: each a part of the body (its mask) from a made motion or a pose, over its
  // window of the clip (from..to), faded in and out (a layer at the clip's edge doesn't fade there: the blend does it)
  layered(c, pos, t, dur, files, h) {
    const u = Math.min(1, Math.max(0, t / Math.max(0.001, dur)));
    for (const ly of c.body.layers) {
      const a = +(ly.from ?? 0), b = +(ly.to ?? 1); if (!(b > a) || u < a || u > b) continue;
      const ws = (b - a) * dur, lt = (u - a) * dur, fade = +(ly.fade ?? 0.3);
      let w = +(ly.weight ?? 1);
      if (a > 0 && fade > 0) w *= M.EASES.inout(Math.min(1, lt / fade));
      if (b < 1 && fade > 0) w *= M.EASES.inout(Math.min(1, (ws - lt) / fade));
      if (!(w > 0)) continue;
      let src = null;
      if (ly.file && files && files[ly.file]) {
        const f = files[ly.file], k = f.height ? h / f.height : 1;
        src = M.sampleBaked(f, M.fitTime(ly.fit || "loop", lt / Math.max(0.001, ws), ws, f.pos.length / (f.fps || 30))).pos;
        for (const n in src) src[n].multiplyScalar(k);
      } else if (ly.pose && this.lib.poses[ly.pose]) src = M.fk(this.lib, M.clonePose(this.lib.poses[ly.pose]), h).pos;
      if (src) pos = M.layerPositions(this.lib, pos, src, ly.mask, w, h, Stage.SOMA);
    }
    return pos;
  }
  // a generated motion's own frame at local time t (its file, or the shot list's segments chained), scaled to the cast
  // member, in the clip's own frame (where it starts is clipPose's); null for a blocked clip
  ownPose(c, t, dur, files) {
    const body = c.body || {}, h = +((this.story.cast || {})[c.who] || {}).height || 1.7;
    const u = Math.min(1, Math.max(0, t / Math.max(0.001, dur)));
    const file = body.file && files && files[body.file];
    const segs = (body.segments || []).length && body.segments.some(g => g.file && files && files[g.file]) ? body.segments : null;
    if (segs) return this.chainPose(segs, M.remap(body.mods, u, dur), dur, files, body.fit, h);   // the Kimodo motions made from the shot list, chained (any not made yet held)
    if (!file) return null;
    const src = M.fitTime(body.fit, M.remap(body.mods, u, dur), dur, file.pos.length / (file.fps || 30));
    const pos = M.sampleBaked(file, src).pos, k = file.height ? h / file.height : 1;   // Kimodo's body is 1.76 m: scale to the cast member
    for (const n in pos) pos[n].multiplyScalar(k);
    return pos;
  }
  // how far a generated motion has carried its actor by local time t: the hips' travel over the floor and the turn of
  // the body (the legs' line), from its first frame; null for a blocked clip (blocking moves to marks: evalBlock)
  travel(c, t, dur, files) {
    const a = this.ownPose(c, 0, dur, files); if (!a) return null;
    const b = this.ownPose(c, t, dur, files), hips = p => p["soma:Hips"] || p.pelvis;
    const move = hips(b).clone().sub(hips(a)); move.y = 0;
    return { move, yaw: facing(b) - facing(a) };
  }
  // where an actor stands and faces as a clip begins: where their last clip left them when it was cut ({move: metres
  // in the actor's frame, yaw}): a generated walk carries them on, turning with it; blocking ends where its keys put
  // them. Cached on the timeline
  startOf(tl, seg, files) {
    const cache = tl._starts || (Object.defineProperty(tl, "_starts", { value: new Map(), enumerable: false }), tl._starts);
    if (cache.has(seg)) return cache.get(seg);
    const mine = tl.segs.filter(s => s.type === "clip" && s.clip.who === seg.clip.who), prev = mine[mine.indexOf(seg) - 1];
    let st = { move: (seg.clip._startMove || new THREE.Vector3()).clone(), yaw: 0 };
    if (prev) {
      const pb = prev.clip.body || {}, ps = +pb.secs || prev.dur, cut = this.cutAt(prev, seg), s0 = this.startOf(tl, prev, files);
      const tr = this.travel(prev.clip, cut, ps, files);
      if (tr) st = { move: s0.move.clone().add(tr.move.applyAxisAngle(Y_UP, s0.yaw)), yaw: s0.yaw + tr.yaw };
      else {                                                       // blocked: its keys' travel at the cut, carried from its start
        const keys = pb.block && pb.block.length ? pb.block : [{ at: 0, pose: "idle" }];
        st = { move: M.evalBlock(this.lib, keys, M.remap(pb.mods, cut / Math.max(0.001, ps), ps) * ps, ps, s0.move).move.clone(), yaw: s0.yaw };
      }
    }
    cache.set(seg, st); return st;
  }
  cutAt(prev, seg) {               // how far into its own action (body.secs, after its delay) a clip had got when the next began
    const pb = prev.clip.body || {}, ps = +pb.secs || prev.dur;
    return Math.min(ps, Math.max(0, seg.start - prev.start - (+pb.delay || 0)));
  }
  // an actor's hand-off between two of their clips: their pose as the last one is cut, and as this one begins
  handOff(tl, prev, seg, files) {
    const pb = prev.clip.body || {}, b = seg.clip.body || {};
    return [this.clipPose(prev.clip, this.cutAt(prev, seg), +pb.secs || prev.dur, files, this.startOf(tl, prev, files)),
            this.clipPose(seg.clip, 0, +b.secs || seg.dur, files, this.startOf(tl, seg, files))];
  }

  // a clip's segments played one after another: each starts where the last ended (its root moved there and turned
  // to the last one's facing), blending in inertially over its first 0.25 s; one not made yet holds where the last one
  // ended (or the next one's start) for its seconds, so a clip plays as soon as any of its motions is made; `fit`
  // stretches the chain over the clip
  chainPose(segs, u, dur, files, fit, h) {
    const BL = 0.25;
    const key = segs.map(g => [g.file || "-", g.blend ?? "", g.file ? "" : g.secs].join(":")).join("|") + "@" + h;
    let ch = this._chains && this._chains[key];
    if (ch && segs.some((g, i) => ch.parts[i].f !== (files[g.file] || null))) ch = null;   // a take imported (again) under its name
    if (!ch) {
      const parts = []; let t = 0, off = new THREE.Vector3(), yaw = 0, made = 0;
      const scaled = (part, u) => { const p = M.sampleBaked(part.f, u).pos; for (const n in p) p[n].multiplyScalar(part.k); return p; };
      for (const g of segs) {
        const f = files[g.file] || null;
        if (!f) { parts.push({ f: null, start: t, len: Math.max(0.1, +g.secs || 2), bl: +(g.blend ?? BL) }); t += parts[parts.length - 1].len; continue; }
        const len = f.pos.length / (f.fps || 30), k = f.height ? h / f.height : 1;
        const part = { f, k, start: t, len, bl: +(g.blend ?? BL), yaw: 0, origin: new THREE.Vector3(), off: new THREE.Vector3() };
        const first = scaled(part, 0), last = scaled(part, 1);
        if (made) {                                            // line this one's first frame up with the last one's end
          const r0 = first["soma:Hips"].clone(); r0.y = 0;
          part.yaw = yaw - facing(first); part.origin = r0; part.off = off.clone();
        }
        part.head = this._place(part, first); part.tail = this._place(part, last);   // where it starts and ends, placed
        const re = part.tail["soma:Hips"].clone(); re.y = 0; off = re; yaw = facing(part.tail);
        parts.push(part); t += len; made++;
      }
      for (let i = 0; i < parts.length; i++) if (!parts[i].f) {     // a hold: the last made one's end, or the next one's start
        const prev = parts.slice(0, i).reverse().find(p => p.f), next = parts.slice(i).find(p => p.f);
        parts[i].hold = prev ? prev.tail : next.head;
      }
      ch = { parts, total: t }; (this._chains = this._chains || {})[key] = ch;
    }
    const src = M.fitTime(fit, u, dur, ch.total) * ch.total;
    const i = Math.max(0, ch.parts.findIndex((p, j) => src < p.start + p.len || j === ch.parts.length - 1));
    const p = ch.parts[i], lu = Math.min(1, Math.max(0, (src - p.start) / p.len));
    const clone = q => { const o = {}; for (const n in q) o[n] = q[n].clone(); return o; };
    if (!p.f) return clone(p.hold);
    const raw = M.sampleBaked(p.f, lu).pos; for (const n in raw) raw[n].multiplyScalar(p.k);
    let pos = this._place(p, raw);
    if (i > 0 && p.bl > 0 && src - p.start < p.bl) {           // the join with the last one fades out under this one (its `blend`)
      const q = ch.parts[i - 1], from = q.f ? q.tail : q.hold;
      pos = M.inertialBlend(this.lib, from, p.head, pos, M.EASES.inout((src - p.start) / p.bl), h);
    }
    return pos;
  }
  _place(part, pos) {                                          // a segment's frame -> the chain's frame
    if (!part.yaw && !part.off.lengthSq() && !part.origin.lengthSq()) return pos;
    const out = {}, Y = new THREE.Vector3(0, 1, 0);
    for (const n in pos) out[n] = pos[n].clone().sub(part.origin).applyAxisAngle(Y, part.yaw).add(part.off);
    return out;
  }

  // everything at scene time T: who stands where in what pose, the camera, the cover (black), the subtitle
  // ---- a body track (STORY_FORMAT §3.8, HANDOFF_DIRECTOR_TODO §4): a scene's cues doing `behave` (idle, sit, go,
  // path, patrol, off: Play's own behaviours, play/behaviours.js) drive their cast member from the cue's clip edge
  // until the next one or the shot's end: a state that outlives a clip's motion (after the walk, sit on the chair till
  // the shot ends), a patrol round and round. Replayed at a fixed step from the cue (kept while time moves on, so a
  // scrub back plays it again), starting where the last one left her, else at her mark as her clip had her then
  behaveCues(tl) {                              // {who: [{t, a}]}, in time
    if (tl._bcues) return tl._bcues;
    const out = {};
    for (const cu of tl.v.cues || []) {
      const a = cu.do; if (!a || typeof a.behave !== "string") continue;
      const t = edgeTime(tl.segs, cu.at); if (t === undefined) continue;
      (out[a.behave] = out[a.behave] || []).push({ t, a });
    }
    for (const l of Object.values(out)) l.sort((x, y) => x.t - y.t);
    return tl._bcues = out;
  }
  behaveRt() {                                  // what a behaviour needs of a runtime, from the stage
    if (this._brt && this._brt.things === this.things) return this._brt;
    const st = this, byId = {};
    this.world.traverse(o => { if (o.userData && o.userData.id && !byId[o.userData.id]) byId[o.userData.id] = o; });
    return this._brt = { things: this.things, plan: { things: this.things }, story: this.story, hud: { log() {} }, byId, npcs: {}, emit() {}, caught() {},
      player: { get pos() { return st.camera.position.clone().setY(st.camera.position.y - 1.6); }, hiding: null },
      route(ref) {                               // runtime.route: a level's route or a list of spots, as points
        let r = null, level = null;
        if (Array.isArray(ref)) r = { points: ref };
        else for (const [lid, lv] of Object.entries(st.story.levels || {})) if ((lv.routes || {})[ref]) { r = lv.routes[ref]; level = lid; }
        if (!r) return null;
        const points = [];
        for (const p of r.points || []) { const q = typeof p === "string" ? { at: p } : p, t = st.things[q.at]; if (!t) continue; level = level || t.level; points.push({ pos: s2t(t.pos[0], t.pos[1], t.pos[2] || 0), yaw: t.yaw || 0, wait: +(q.wait || 0), pose: q.pose || null, check: q.check || null }); }
        return points.length ? { level, mode: r.mode || "loop", points } : null;
      } };
  }
  behaveAt(tl, who, cues, k, T, files) {        // the behaviour's npc at T (its pos in three's space, yaw in story degrees, pose, walking)
    const memo = this._bmemo || (this._bmemo = new Map()), key = who + "|" + JSON.stringify(cues.slice(0, k + 1).map(c => [c.t, c.a])) + "|" + JSON.stringify((tl.v.stage || {})[who] || null) + "|" + this.level;
    const cue = cues[k], b = behaviourOf(cue.a.as || "idle"), rt = this.behaveRt();
    let m = memo.get(key);
    if (!m || m.t > T + 1e-6) {
      const from = k > 0 ? this.behaveAt(tl, who, cues, k - 1, cue.t, files) : this.markOf(tl, who, cue.t, files);
      const npc = { cid: who, as: cue.a.as || "idle", s: settingsOf(b || { settings: {} }, cue.a), st: {}, pos: from && from.pos ? from.pos.clone() : null, yaw: from ? from.yaw || 0 : 0,
                    level: (from && from.level) || this.level, pose: (from && from.pose) || "idle", walking: false, t0: cue.t };
      if (b && npc.as !== "off") b.start(npc, rt, npc.s);
      m = { t: cue.t, npc }; memo.set(key, m);
      if (memo.size > 400) memo.delete(memo.keys().next().value);
    }
    const DT = 1 / 30;
    if (b && b.update && m.npc.as !== "off") while (m.t + DT <= T + 1e-9) { b.update(m.npc, rt, DT, m.npc.s); m.t += DT; }
    return m.npc;
  }
  markOf(tl, who, t, files) {                   // where she is when her track takes over: her mark, moved as far as her clip had moved her
    const spot = this.things[(tl.v.stage || {})[who]]; if (!spot) return null;
    const pos = s2t(spot.pos[0], spot.pos[1], spot.pos[2] || 0), yaw = spot.yaw || 0;
    const mine = tl.segs.filter(s => s.type === "clip" && s.clip.who === who), cur = [...mine].reverse().find(s => s.start <= t);
    if (cur) {                                    // the clip's own travel (a Kimodo walk, blocking that moves): its hips, from the mark
      const bd = cur.clip.body || {}, bs = +bd.secs || cur.dur, lt = Math.min(bs, Math.max(0, t - cur.start - (+bd.delay || 0)));
      const p = this.clipPose(cur.clip, lt, bs, files, this.startOf(tl, cur, files)), hip = p && (p.pelvis || p["soma:Hips"]);
      if (hip) pos.add(new THREE.Vector3(hip.x, 0, hip.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawToThree(yaw)));
    }
    return { pos, yaw, level: spot.level || this.level };
  }
  behavePose(npc, who, T, files) {              // as Play draws her (runtime.drawNpcs): her motion, else the pose (walking: the walk over it)
    const lib = this.lib, h = +((this.story.cast || {})[who] || {}).height || 1.7;
    const m = npc.s.motion && (this.story.motions || {})[npc.s.motion], walks = npc.as === "path" || npc.as === "patrol" || npc.as === "go";
    const mp = m && (npc.walking || !walks) ? M.tableMotionPose(lib, m, m.name && files && files[m.name + ".json"], T - (npc.t0 || 0), h, walks) : null;
    if (mp) return mp;
    let p = M.clonePose(lib.poses[npc.pose] || lib.poses.idle);
    if (npc.walking) p = M.walkOverlay(lib, p, T);
    return M.fk(lib, p, h).pos;
  }
  stateAt(tl, T, files, look = { yaw: 0, pitch: 0 }) {
    const v = tl.v, segs = tl.segs;
    let seg = segs.find(s => T >= s.start && T < s.end) || segs[segs.length - 1];
    const clipSeg = seg && (seg.type === "clip" ? seg : [...segs].reverse().find(s => s.type === "clip" && s.start <= T)) || segs.find(s => s.type === "clip");
    const out = { seg, clipSeg, black: 0, sub: null, ja: null, who: null, poses: {}, reach: {}, cam: {} };
    if (!clipSeg) return out;
    const c = clipSeg.clip, local = Math.min(clipSeg.dur, T - clipSeg.start);
    // a body track: a behave cue (STORY_FORMAT §3.8) drives its cast member from its time on, Play's behaviour replayed
    out.place = {};
    const bhv = this.behaveCues(tl);
    for (const [who, cues] of Object.entries(bhv)) {
      let k = -1; for (let i = 0; i < cues.length; i++) if (cues[i].t <= T + 1e-9) k = i;
      if (k < 0 || !this.cast[who]) continue;
      const npc = this.behaveAt(tl, who, cues, k, T, files);
      out.place[who] = { pos: npc.pos ? npc.pos.clone() : null, yaw: npc.yaw || 0, level: npc.level, hidden: npc.as === "off" || !npc.pos };
      if (out.place[who].hidden) continue;
      let pos = this.idleLayer(this.behavePose(npc, who, T, files), who, T, npc.walking ? 0.3 : 1, v.mood);
      const spec = (v.look || {})[who]; if (spec) pos = this.lookLayer(pos, who, spec, tl, T, v);   // the scene's look still turns her head
      out.poses[who] = pos;
    }
    // poses: the speaking clip drives its actor; others idle; blends at clip starts
    for (const who of Object.keys(v.stage || {})) {
      if (out.place[who]) continue;                    // (its body track has her)
      const mine = segs.filter(s => s.type === "clip" && s.clip.who === who);
      const cur = [...mine].reverse().find(s => s.start <= T) || mine[0];
      let pos;
      if (!cur) pos = this.clipPose({ who, body: { block: [{ at: 0, pose: "idle" }] } }, T, 1, files);
      else {
        const bd = cur.clip.body || {}, bs = +bd.secs || cur.dur, lt = Math.min(bs, Math.max(0, T - cur.start - (+bd.delay || 0)));
        pos = this.clipPose(cur.clip, lt, bs, files, this.startOf(tl, cur, files));   // the action over its own length (body.secs), after its delay, from where the last one left them
        const prev = mine[mine.indexOf(cur) - 1];
        const b = cur.clip.body || {}, win = b.bridge ? +(b.bridge.secs || 0.6) : (b.blend ?? 0.25);
        if (prev && T - cur.start < win && win > 0) {   // from the pose the last clip was cut at, not its unplayed end
          const [from, start] = this.handOff(tl, prev, cur, files), w = M.EASES.inout(Math.max(0, (T - cur.start)) / win);
          pos = M.inertialBlend(this.lib, from, start, pos, w, +(this.story.cast[who] || {}).height || 1.7);   // this clip's motion at full speed, the join fading out
        }
      }
      const moving = cur && T < cur.start + cur.dur && ((cur.clip.body || {}).segments || (cur.clip.body || {}).file || ((cur.clip.body || {}).block || []).length > 1);
      pos = this.idleLayer(pos, who, T, moving ? 0.4 : 1, v.mood);             // the procedural idle: never a statue
      const spec = (cur && cur.clip.look) || (v.look || {})[who];
      if (spec) pos = this.lookLayer(pos, who, spec, tl, T, v);                  // the head follows the player or a tracker
      out.poses[who] = pos;
      const r = cur && (cur.clip.body || {}).reach;   // a hand locked onto something: the IK layer over the animation
      if (r && r.to) {
        const u = Math.min(1, Math.max(0, (T - cur.start) / Math.max(0.001, cur.dur)));
        const at = +(r.at ?? 0.5), from = +(r.from ?? Math.max(0, at - 0.25)), until = +(r.until ?? 1);
        const w = u < from ? 0 : u < at ? M.EASES.inout((u - from) / Math.max(1e-3, at - from)) : u <= until ? 1 : Math.max(0, 1 - (u - until) / 0.1);
        const tg = this.reachTarget(r.to, tl.v);
        if (tg && w > 0) out.reach[who] = { hand: r.hand || "right", target: tg, w, offset: r.offset };
      }
    }
    if ((v.faces || []).length && FACES.M) {         // the face rows: MHR's 72 for each face with something on it at T (null: at rest)
      const n = Object.keys(FACES.lib).length;
      if (!tl.facePlan || tl.faceN !== n) { tl.facePlan = FACE.facePlan(v.faces, at => edgeTime(segs, at), tl.total, FACES.lib); tl.faceN = n; }
      out.faces = {};
      for (const who of Object.keys(tl.facePlan)) { const sc = FACE.faceAt(tl.facePlan, who, T); out.faces[who] = sc ? FACE.toMHR(sc, FACES.M) : null; }
    }
    out.trackers = {};
    for (const id of Object.keys(v.trackers || {})) { const p = this.trackerAt(tl, id, T); if (p) out.trackers[id] = p; }
    if (seg.type === "clip") { out.sub = c.en; out.ja = c.ja; out.who = c.who; out.think = !!c.think; }
    if (seg.type === "seam") {
      const k = seg.seam.kind, u = (T - seg.start) / (seg.end - seg.start);
      if (k === "blink") out.black = Math.sin(u * Math.PI);
      if (k === "dip") out.black = Math.min(1, Math.sin(u * Math.PI) * 1.6);
      if (k === "heartbeat") out.black = 0.35 * Math.sin(u * Math.PI);
      if (k === "flicker") out.flicker = 1;
      if (k === "glance" || k === "cutaway") out.glance = { target: seg.seam.look, w: k === "cutaway" ? 1 : Math.sin(u * Math.PI), cut: k === "cutaway" };
      if (k === "stumble") out.shake = 1.2 * Math.sin(u * Math.PI);
    }
    if (seg.type === "event") { out.event = seg.event; out.sub = seg.event.prompt || seg.event.type; }
    // camera: the player's eye at the view spot; the lens from the clip's shot and cam
    const cam = Object.assign({}, v.camera || {}, c.cam || {});
    const u = local / Math.max(0.001, clipSeg.dur);
    // the lens never changes: only a held focus (zoom, at most 15 %) narrows it; push is the player leaning in
    const fov = vfov(+((this.story && this.story.game && this.story.game.fov) || FOV_H), this.camera.aspect || 16 / 9) * (1 - Math.min(ZOOM, +(cam.zoom || 0)) * u);
    out.cam = { fov, lean: Math.min(LEAN, +(cam.push || 0)) * u, roll: +(cam.roll || 0), shake: +(cam.shake || 0) + (out.shake || 0), look: cam.look || (v.camera || {}).look, mode: (v.camera || {}).mode || "free",
                cone: (v.camera || {}).cone || [30, 18], userLook: look, pov: c.shot === "pov_down" ? -35 : c.shot === "pov_up" ? 30 : 0 };
    return out;
  }

  // ---- the layers over the animation: the look (head toward a target, clamped) and the procedural idle ----------
  // joints below a pivot, per skeleton (the previs one, SOMA's): rotating them about the pivot turns that part of the body
  below(pivot) {
    this._below = this._below || {};
    if (this._below[pivot]) return this._below[pivot];
    const kids = {};
    for (const j of this.lib.joints) if (j.parent) (kids[j.parent] = kids[j.parent] || []).push(j.name);
    (kids.head = kids.head || []).push("head_side");
    const sp = Stage.SOMA;
    if (sp) sp.names.forEach((n, i) => { const pi = sp.parents[i]; if (pi >= 0) (kids["soma:" + sp.names[pi]] = kids["soma:" + sp.names[pi]] || []).push("soma:" + n); });
    const out = [], todo = [...(kids[pivot] || [])];
    while (todo.length) { const n = todo.pop(); out.push(n); todo.push(...(kids[n] || [])); }
    return this._below[pivot] = out;
  }
  turnFrom(pos, pivot, q) {      // rotate everything below a pivot about it
    const P = pos[pivot]; if (!P) return;
    for (const n of this.below(pivot)) if (pos[n]) pos[n] = pos[n].clone().sub(P).applyQuaternion(q).add(P);
  }
  facing(pos) {                  // the chest's forward (character space, y up): across the shoulders, crossed with up
    const l = pos["soma:LeftShoulder"] || pos.clavicle_l, r = pos["soma:RightShoulder"] || pos.clavicle_r;
    if (!l || !r) return new THREE.Vector3(0, 0, 1);
    const f = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(l, r).setY(0), new THREE.Vector3(0, 1, 0));
    return f.lengthSq() > 1e-8 ? f.normalize() : new THREE.Vector3(0, 0, 1);
  }
  toActor(v, who, w) {           // a world point -> the actor's own frame (where its stage spot puts it)
    const spot = this.things[(v.stage || {})[who]]; if (!spot) return null;
    return w.clone().sub(s2t(spot.pos[0], spot.pos[1], spot.pos[2])).applyAxisAngle(new THREE.Vector3(0, 1, 0), -yawToThree(spot.yaw));
  }
  trackerAt(tl, id, T) {         // an invisible tracker's world position: its keys ride clip edges, never scene time
    const tr = (tl.v.trackers || {})[id]; if (!tr) return null;
    const h = +(tr.height ?? 1.5), at = to => Array.isArray(to) ? s2t(to[0], to[1], (to[2] ?? 0) + h) : this.things[to] ? s2t(this.things[to].pos[0], this.things[to].pos[1], this.things[to].pos[2] + h) : null;
    const keys = (tr.keys || []).map(k => { const sg = tl.segs.find(s => s.type === "clip" && s.clip.id === k.clip); return { t: sg ? sg.start + (+k.at || 0) * sg.dur : 0, p: at(k.to) }; }).filter(k => k.p).sort((a, b) => a.t - b.t);
    if (!keys.length) return at(tr.at);
    if (T <= keys[0].t) return keys[0].p.clone();
    for (let i = 1; i < keys.length; i++) if (T < keys[i].t) { const a = keys[i - 1], b = keys[i]; return a.p.clone().lerp(b.p, M.EASES.inout((T - a.t) / Math.max(1e-3, b.t - a.t))); }
    return keys[keys.length - 1].p.clone();
  }
  lookLayer(pos, who, spec, tl, T, v) {
    const at = spec.at || "player", lag = +(spec.lag ?? 0.25);
    const w = at === "player" ? this.eyeOf(v) : (v.trackers || {})[at] ? this.trackerAt(tl, at, Math.max(0, T - lag)) : this.targetPos(at);
    const tgt = w && this.toActor(v, who, w); if (!tgt) return pos;
    const head = pos["soma:Head"] || pos.head; if (!head) return pos;
    const fwd = this.facing(pos), dir = tgt.clone().sub(head);
    let yaw = Math.atan2(fwd.z * dir.x - fwd.x * dir.z, fwd.x * dir.x + fwd.z * dir.z) * 180 / Math.PI;
    let pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) * 180 / Math.PI;
    const [ly, up, down] = spec.limit || [70, 20, 30], amt = +(spec.w ?? 1);
    if (Math.abs(yaw) > ly) {                                   // past the limit: hold at the edge, or ease back to forward
      if (spec.past === "snap") { const k = Math.max(0, 1 - (Math.abs(yaw) - ly) / 20); yaw = Math.sign(yaw) * ly * k; pitch *= k; }
      else yaw = Math.sign(yaw) * ly;
    }
    pitch = Math.max(-down, Math.min(up, pitch));
    const out = this.withHeadSide(pos), Y = new THREE.Vector3(0, 1, 0);
    const chains = [[["spine_02", 0.10], ["spine_03", 0.15], ["neck_01", 0.25], ["head", 0.5]],
                    [["soma:Spine2", 0.10], ["soma:Chest", 0.15], ["soma:Neck1", 0.25], ["soma:Neck2", 0.25], ["soma:Head", 0.25]]];
    for (const chain of chains) {
      if (!out[chain[0][0]]) continue;
      let f = fwd.clone();
      for (const [j, k] of chain) {
        const qy = new THREE.Quaternion().setFromAxisAngle(Y, yaw * k * amt * Math.PI / 180);
        f.applyQuaternion(qy);
        const qp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3().crossVectors(f, Y).normalize(), pitch * k * amt * Math.PI / 180);
        this.turnFrom(out, j, qp.multiply(qy));
      }
    }
    return out;
  }
  withHeadSide(pos) {            // the previs skeleton has no eyes: a point to the head's left carries its turn
    if (!pos.head || pos.head_side) return pos;
    const l = pos.clavicle_l || pos["soma:LeftShoulder"], r = pos.clavicle_r || pos["soma:RightShoulder"];
    const left = l && r ? l.clone().sub(r).setY(0).normalize() : new THREE.Vector3(1, 0, 0);
    return Object.assign({}, pos, { head_side: pos.head.clone().addScaledVector(left, 0.1) });
  }
  idleLayer(pos, who, T, amount, mood) {                        // breathing, a weight shift, the head's small moves
    pos = this.withHeadSide(pos);
    if (!amount) return pos;
    const seed = [...who].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 97, calm = { dread: 0.7, intimate: 0.8, panic: 1.6, chase: 1.8, grief: 0.6 }[mood] || 1;
    const n = (f, ph) => Math.sin(T * f * calm + seed * 1.7 + ph) * 0.6 + Math.sin(T * f * 2.3 * calm + seed + ph * 2) * 0.4;
    const out = Object.assign({}, pos), Y = new THREE.Vector3(0, 1, 0), fwd = this.facing(pos), right = new THREE.Vector3().crossVectors(fwd, Y).normalize();
    const breath = Math.sin(T * 2 * Math.PI * 0.24 * calm + seed) * 0.9 * amount * (mood === "panic" || mood === "chase" ? 1.8 : 1);
    for (const j of ["spine_03", "soma:Chest"]) this.turnFrom(out, j, new THREE.Quaternion().setFromAxisAngle(right, breath * Math.PI / 180));
    const sway = n(0.45, 1) * 1.1 * amount;
    for (const j of ["spine_01", "soma:Spine1"]) this.turnFrom(out, j, new THREE.Quaternion().setFromAxisAngle(fwd, sway * Math.PI / 180));
    const hy = n(0.7, 3) * 2.2 * amount, hp = n(0.55, 5) * 1.4 * amount;
    for (const j of ["neck_01", "soma:Neck1"]) this.turnFrom(out, j, new THREE.Quaternion().setFromAxisAngle(right, hp * Math.PI / 180).multiply(new THREE.Quaternion().setFromAxisAngle(Y, hy * Math.PI / 180)));
    return out;
  }

  eyeOf(v) {                     // the player's eye for a scene version: its view spot at its stance's eye height
    const view = this.things[v.view], h = EYES[v.stance || "stand"] || EYE;
    return view ? s2t(view.pos[0], view.pos[1], view.pos[2] + h) : new THREE.Vector3(0, h, 0);
  }
  reachTarget(to, v) {           // a reach target in world space: player_collar, player_face, or a placed thing
    if (to === "player_face" || to === "player_collar") return this.eyeOf(v).add(new THREE.Vector3(0, to === "player_collar" ? -0.25 : -0.05, 0));
    const t = this.things[to];
    return t ? s2t(t.pos[0], t.pos[1], t.pos[2] + (t.size ? t.size[2] / 2 : 0)) : null;
  }
  targetPos(id) {
    if (this.cast[id] && this.cast[id].group.visible) return this.cast[id].headWorld();
    const t = this.things[id];
    if (t) return s2t(t.pos[0], t.pos[1], t.pos[2] + (t.size ? t.size[2] / 2 : 0) + (t.use === "light" ? 0 : 0));
    return null;
  }

  faceOn(f, w72) {               // a figure's face: MHR's 72 shapes on its morphs, or a Studio export's skin (face.js)
    if (!f.model) return;
    if (!f._faceT || f._faceF !== FACES.F) { f._faceT = FACE.faceOf(f.model, FACES.F); f._faceF = FACES.F; }   // (a Studio export's needs MHR's face loaded)
    FACE.setFace(f._faceT, w72); f._faceOn = !!w72;
  }
  apply(tl, state, T) {          // pose the figures, aim the camera, set the lights
    const v = tl.v;
    const through = new Set((v.camera || {}).through || []);           // the props the scene's eye is inside
    for (const id of [...(this._through || [])]) if (!through.has(id)) this.seeThrough(id, 0);
    for (const id of through) if (!(this._through || new Set()).has(id)) this.seeThrough(id, this.seeThroughOf(id));
    this._trk = this._trk || {};
    for (const [id, m] of Object.entries(this._trk)) m.visible = !!(state.trackers || {})[id] && Stage.showTrackers;
    for (const [id, p] of Object.entries(state.trackers || {})) {   // the invisible trackers, shown in the desk only
      if (!this._trk[id]) { this._trk[id] = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0x6fb3d9, wireframe: true })); this.scene.add(this._trk[id]); }
      this._trk[id].position.copy(p); this._trk[id].visible = Stage.showTrackers;
    }
    for (const [cid, f] of Object.entries(this.cast)) {
      const spot = this.things[(v.stage || {})[cid]], pl = (state.place || {})[cid];
      if (pl) {                                    // her body track: where the behaviour has her
        f.group.visible = !pl.hidden && (!pl.level || pl.level === this.level);
        if (!f.group.visible) continue;
        f.group.position.copy(pl.pos); f.group.rotation.y = yawToThree(pl.yaw);
      } else {
        f.group.visible = !!spot;
        if (!spot) continue;
        f.group.position.copy(s2t(spot.pos[0], spot.pos[1], spot.pos[2]));
        f.group.rotation.y = yawToThree(spot.yaw);
      }
      f.group.updateMatrixWorld(true);
      f.reach = {};
      const rc = (state.reach || {})[cid];
      if (rc && f.reachTo) {                      // both hands: either side of the target, along the actor's left
        const hands = rc.hand === "both" ? ["left", "right"] : [rc.hand];
        for (const h of hands) {
          const p = f.group.worldToLocal(rc.target.clone());
          if (rc.hand === "both") p.x += h === "left" ? 0.18 : -0.18;
          if (rc.offset) p.add(new THREE.Vector3(...rc.offset));
          f.reach[h] = { target: p, w: rc.w };
        }
      }
      if (state.poses[cid]) f.update(state.poses[cid]);
      const w72 = (state.faces || {})[cid] || null;
      if (w72 || f._faceOn) this.faceOn(f, w72);
    }
    const eye = this.eyeOf(v), view = this.things[v.view];
    const fwd = view ? new THREE.Vector3(Math.cos(view.yaw * Math.PI / 180), 0, -Math.sin(view.yaw * Math.PI / 180)) : new THREE.Vector3(0, 0, -1);
    let target = this.targetPos(state.cam.look) || eye.clone().add(fwd);
    if (state.cam.lean) { const d = target.clone().sub(eye).setY(0); if (d.lengthSq() > 1e-6) eye.addScaledVector(d.normalize(), state.cam.lean); }
    if (state.glance && this.targetPos(state.glance.target)) target = target.clone().lerp(this.targetPos(state.glance.target), state.glance.w);
    const c = this.camera;
    this._floorY = view ? view.pos[2] : 0;
    this.playerMark(this.free && view ? { eye, target, floor: s2t(view.pos[0], view.pos[1], view.pos[2] + 0.012) } : null);
    if (this.free) { this.applyFree(); }
    else {
      c.position.copy(eye);
      c.lookAt(target);
      if (state.cam.pov) c.rotateX(state.cam.pov * Math.PI / 180);
      if (state.cam.mode !== "hard" && state.cam.userLook) {      // the player's own look, inside the cone
        const [cy, cp] = state.cam.mode === "free" ? [180, 80] : state.cam.cone;
        c.rotateY(-Math.max(-cy, Math.min(cy, state.cam.userLook.yaw)) * Math.PI / 180);
        c.rotateX(Math.max(-cp, Math.min(cp, state.cam.userLook.pitch)) * Math.PI / 180);
      }
      c.rotateZ(state.cam.roll * Math.PI / 180);
      if (state.cam.shake) { const s = state.cam.shake * 0.012; c.rotateX((Math.sin(T * 41) + Math.sin(T * 23)) * s); c.rotateY((Math.sin(T * 37) + Math.sin(T * 19)) * s); }
      c.fov = state.cam.fov;                                         // a cutaway is a head turn, not a lens
      c.updateProjectionMatrix();
    }
    for (const l of this.lights) {
      let k = 1;
      if (l.userData.flicker) k *= 1 - l.userData.flicker * 0.5 * Math.max(0, Math.sin(T * 13.7) * Math.sin(T * 7.3));
      if (state.flicker) k *= 0.05;
      l.intensity = l.userData.base * k;
    }
  }
  render() { this.simplify(); this.renderer.render(this.scene, this.camera); }
  // the simple view also leaves out what Play's eye can't see (cull): the rooms the eye is in, and the rooms seen from
  // them through an opening in view (an archway, a window, an open door or one still swinging), three deep. A room out of
  // sight keeps its walls and doors (a wall belongs to one of the two rooms it parts) and loses its props, floor, ceiling
  // and lights to a layer the camera doesn't draw; every ray still finds them (the game's rules don't change). Its lights
  // out, the light that came through a wall from it goes too: the simple view's look, not the game's
  cull(camera, isOpen) {
    const R = this._rooms || (this._rooms = this.roomsForCull());
    const c = camera.position, x = c.x, y = -c.z, z = c.y, m = 0.35;
    const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const seen = new Map();
    for (const r of R.list) if (x >= r.x0 - m && x <= r.x1 + m && y >= r.y0 - m && y <= r.y1 + m && z >= r.z0 - 0.2 && z <= r.z1 + 0.2) seen.set(r.id, 0);
    const q = [...seen.keys()];
    while (q.length) {
      const id = q.shift(), d = seen.get(id); if (d >= 3) continue;
      for (const p of R.portals[id] || []) if (!seen.has(p.to) && (!p.door || isOpen(p.door)) && fr.intersectsBox(p.box)) { seen.set(p.to, d + 1); q.push(p.to); }
    }
    if (!seen.size) return this.uncull();             // the eye in no room (outside the level): draw it all
    for (const r of R.list) {
      const out = !seen.has(r.id); if (out === !!R.out[r.id]) continue;
      R.out[r.id] = out;
      for (const o of R.objs[r.id] || []) o.traverse(k => k.layers.set(out ? 1 : 0));
    }
  }
  uncull() {
    const R = this._rooms; if (!R) return;
    for (const id of Object.keys(R.out)) if (R.out[id]) { R.out[id] = false; for (const o of R.objs[id] || []) o.traverse(k => k.layers.set(0)); }
  }
  roomsForCull() {                // the level's rooms (story metres), the openings between them, and what goes with each
    const rooms = ((this.story.levels || {})[this.level] || {}).rooms || [], R = { list: [], portals: {}, objs: {}, out: {} };
    for (const r of rooms) { const [x0, y0, z0] = r.at, [w, d, h] = r.size; R.list.push({ id: r.id, x0, y0, z0, x1: x0 + w, y1: y0 + d, z1: z0 + h }); }
    const within = (x, y, z) => R.list.find(r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1 && z >= r.z0 && z <= r.z1);
    for (const r of rooms) for (const op of r.openings || []) {
      const [x0, y0, z0] = r.at, [w, d] = r.size, along = op.wall === "n" || op.wall === "s";
      const [lx, ly] = { n: [op.at, d], s: [op.at, 0], e: [w, op.at], w: [0, op.at] }[op.wall] || [0, 0];
      const [nx, ny] = { n: [0, 1], s: [0, -1], e: [1, 0], w: [-1, 0] }[op.wall] || [0, 0];
      const bot = z0 + (op.sill || 0), top = bot + op.h, cx = x0 + lx, cy = y0 + ly;
      const other = within(cx + nx * 0.25, cy + ny * 0.25, (bot + top) / 2); if (!other || other.id === r.id) continue;
      const hx = along ? op.w / 2 : 0.1, hy = along ? 0.1 : op.w / 2;
      const box = new THREE.Box3(new THREE.Vector3(cx - hx, bot, -(cy + hy)), new THREE.Vector3(cx + hx, top, -(cy - hy)));
      const door = op.door ? op.door.id : null;
      (R.portals[r.id] = R.portals[r.id] || []).push({ to: other.id, door, box });
      (R.portals[other.id] = R.portals[other.id] || []).push({ to: r.id, door, box });
    }
    for (const o of this.world.children) {            // props, floors, ceilings, trim; never walls, doors, their parts, what's set in a wall, or what's picked up and carried
      const p = o.userData && o.userData.piece; if (!p || !p.room || !["mesh", "floor", "ceiling"].includes(p.kind)) continue;
      if ((p.tags || []).some(t => t.startsWith("door_part:") || t === "in_wall") || ["carry", "pickup"].includes(o.userData.use)) continue;
      (R.objs[p.room] = R.objs[p.room] || []).push(o);
    }
    for (const l of this.lights) if (l.userData.room) (R.objs[l.userData.room] = R.objs[l.userData.room] || []).push(l);
    for (const l of this.windows || []) (R.objs[l.userData.window] = R.objs[l.userData.window] || []).push(l);
    return R;
  }
  simplify() {                   // the simple view on (or off again) for whatever the scene holds now
    const on = Stage.simple;
    if (!on && !this._simple) return;
    const pr = on ? 1 : Math.min(2, window.devicePixelRatio || 1);
    if (this.renderer.getPixelRatio() !== pr) { this.renderer.setPixelRatio(pr); this.resize(); }
    this._simple = on;
    this.scene.traverse(o => {
      if (!o.isMesh) return;
      if (on) { if (!o.userData.fullMat) { const s = simpleOf(o.material); if (s) { o.userData.fullMat = o.material; o.material = s; } } }
      else if (o.userData.fullMat) { o.material = o.userData.fullMat; delete o.userData.fullMat; }
    });
  }
  // a thing the eye is inside (a locker, a wardrobe): its walls drawn from inside too, see-through by `amount` (0..1;
  // 0 puts it back). The amount: the thing's `see_through`, else the game's, else SEE_THROUGH
  seeThroughOf(id) { const p = (this.plan.pieces.find(x => x.id === id) || {}).d || {}; return +(p.see_through ?? (this.story.game || {}).see_through ?? SEE_THROUGH); }
  seeThrough(id, amount) {                         // drawn as slats: the gaps are `amount` of each slat's pitch
    const m = this.world.children.find(o => o.userData && o.userData.id === id); if (!m) return;
    m.traverse(o => {
      if (!o.isMesh) return;
      if (!o.userData.solidMat) o.userData.solidMat = o.material;
      if (!amount) { o.material = o.userData.solidMat; return; }
      const slats = slatTexture(amount).clone(), h = (o.geometry.parameters || {}).height || 1.8;
      slats.repeat.set(1, Math.max(4, Math.round(h / SLAT_PITCH))); slats.needsUpdate = true;
      o.material = o.userData.solidMat.clone();
      Object.assign(o.material, { alphaMap: slats, alphaTest: 0.5, side: THREE.DoubleSide });
    });
    this._through = this._through || new Set();
    if (amount) this._through.add(id); else this._through.delete(id);
  }
  async dress(block, ref, [w, h, d], real) {       // a library mesh in its block: real size, or scaled evenly to fit
    const src = await libMesh(ref);                // (like the importer's fit_art), centred, resting on the block's base
    if (!src || block.parent !== this.world) return;
    const g = src.clone(true);
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = real ? 1 : Math.min(...[[w, size.x], [h, size.y], [d, size.z]].filter(([, s]) => s > 0.001).map(([a, s]) => a / s));
    const holder = new THREE.Group(); holder.add(g); g.position.set(-c.x, -box.min.y, -c.z);
    holder.scale.setScalar(k); holder.position.y = -h / 2;
    g.traverse(o => { if (o.isMesh) { o.frustumCulled = false; if (o.material) o.material = o.material.clone(); } });
    block.add(holder); block.material = block.material.clone(); block.material.visible = false;
    block.userData.dressed = true;
    this.render();
  }
  kitIn(block, spec, h) {                          // a kit thing in its block: built from its numbers, base on the block's
    try {
      const g = K3.object(spec, LIBRARY.kit, { shadows: !!this.kitShadows });
      g.position.y = -h / 2; block.add(g);
      block.material = block.material.clone(); block.material.visible = false; block.userData.dressed = true;
    } catch (e) { console.warn("kit " + JSON.stringify(spec) + ": " + e.message); }
  }
  // open every kit door by `deg` (0 to 110): a hinged leaf turns on its hinges toward the side it opens to, its handle
  // and the door's half of each hinge with it; a sliding one slides along its wall
  swing(deg) {
    for (const d of this.solid.filter(m => m.userData.swing && m.parent === this.world)) this.swingDoor(d, deg);
    this.render();
  }
  // one door by `deg` (negative turns it the other way); a door without a kit hinges on its left edge (Play opens it)
  swingDoor(d, deg) {
    const sw = d.userData.swing || { pivot: new THREE.Vector3(-d.geometry.parameters.width / 2, 0, 0), hinge: "left",
                                     slide: ((d.userData.piece || {}).d || {}).swing === "slide", w: d.geometry.parameters.width };
    const kids = this.world.children.filter(o => o.userData && o.userData.attach === d.userData.id);
    for (const o of [d, ...kids]) if (!o.userData.base) o.userData.base = { pos: o.position.clone(), rot: o.rotation.y };
    const b = d.userData.base;
    if (sw.slide) {
      const dx = new THREE.Vector3(-(Math.abs(deg) / 90) * sw.w * 0.95, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), b.rot);
      for (const o of [d, ...kids]) { o.position.copy(o.userData.base.pos).add(dx); o.rotation.y = o.userData.base.rot; }
      return;
    }
    const P = sw.pivot.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), b.rot).add(b.pos);
    const th = deg * Math.PI / 180 * (sw.hinge === "right" ? 1 : -1);
    for (const o of [d, ...kids]) {
      o.position.copy(o.userData.base.pos).sub(P).applyAxisAngle(new THREE.Vector3(0, 1, 0), th).add(P);
      o.rotation.y = o.userData.base.rot + th;
    }
  }
  async assetsReady() { await Promise.all(this.pending || []); this.render(); }

  frame(sc, T, files) {
    const tl = this.timeline(sc); const st = this.stateAt(tl, T, files); this.apply(tl, st, T);
    if (this.life && this.lifeAt) this.life.update(T, this.lifeAt(sc, tl, T));     // the little things as they are at T
    this.render(); return st;
  }

  // from the free camera, the player is a marker: a head looking where the scene's eye looks, a ring where they stand
  playerMark(at) {
    if (!at) { if (this._me) { this._me.visible = false; this._meRing.visible = false; } return; }
    if (!this._me) {
      const m = new THREE.MeshBasicMaterial({ color: 0xd39a45 });
      this._me = new THREE.Group(); this._me.userData.player = true;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 14), m); cone.rotation.x = -Math.PI / 2; cone.position.z = -0.16;
      this._me.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), m), cone);
      this._meRing = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 36), new THREE.MeshBasicMaterial({ color: 0xd39a45, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
      this._meRing.rotation.x = -Math.PI / 2; this.scene.add(this._me, this._meRing);
    }
    this._me.visible = this._meRing.visible = true;
    this._me.position.copy(at.eye); this._me.lookAt(at.target); this._meRing.position.copy(at.floor);
  }
  // what's under a point of the canvas: a cast member (near their body's axis), the player's marker, a placed thing, or
  // the floor; with the point in the story's coordinates (x east, y north, z up)
  pickAt(cx, cy, o = {}) {                         // o.bodies: the cast and the player's marker only (a hover)
    const r = this.renderer.domElement.getBoundingClientRect(), rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.camera);
    const toStory = v => [v.x, -v.z, v.y];
    let best = null;
    for (const [cid, f] of Object.entries(this.cast)) {          // a body: the ray within 0.3 m of the line from its feet to its head
      if (!f.group.visible) continue;
      const a = f.group.position.clone(), b = a.clone().add(new THREE.Vector3(0, f.height || 1.7, 0)), pr = new THREE.Vector3(), ps = new THREE.Vector3();
      const d2 = rc.ray.distanceSqToSegment(a, b, pr, ps), t = pr.distanceTo(rc.ray.origin);
      if (d2 < 0.3 * 0.3 && (!best || t < best.t)) best = { t, hit: { kind: "cast", id: cid, point: toStory(ps.setY(a.y)) } };
    }
    if (this._me && this._me.visible) {             // the player's marker: the ray near the line from its ring up to its head
      const a = this._meRing.position.clone(), b = this._me.position.clone(), pr = new THREE.Vector3(), ps = new THREE.Vector3();
      const d2 = rc.ray.distanceSqToSegment(a, b, pr, ps), t = pr.distanceTo(rc.ray.origin);
      if (d2 < 0.3 * 0.3 && (!best || t < best.t)) best = { t, hit: { kind: "player", point: toStory(a) } };
    }
    if (o.bodies) return best ? best.hit : null;
    const hits = rc.intersectObjects(this.world.children, true).filter(h => h.object.visible && !(h.object.material && h.object.material.opacity === 0));
    for (const h of hits) {
      if (best && h.distance > best.t) break;
      let o = h.object; while (o && !(o.userData && o.userData.id) && o.parent) o = o.parent;
      const u = (o && o.userData) || {};
      if (u.kind === "floor") return { kind: "floor", point: toStory(h.point) };
      if (u.kind === "ceiling") continue;
      if (u.kind === "mesh" || u.kind === "door") return { kind: "thing", id: (u.piece && u.piece.d && u.piece.d.id) || u.id, point: toStory(h.point) };
      break;                                       // a wall: the floor under the mouse, below
    }
    if (best) return best.hit;
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(this._floorY || 0)), p = new THREE.Vector3();
    return rc.ray.intersectPlane(ground, p) ? { kind: "floor", point: toStory(p) } : null;
  }
  // the point on the floor at height z (the story's) under a point of the canvas
  floorAt(cx, cy, z) {
    const r = this.renderer.domElement.getBoundingClientRect(), rc = new THREE.Raycaster(), p = new THREE.Vector3();
    rc.setFromCamera(new THREE.Vector2((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.camera);
    return rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -z), p) ? [p.x, -p.z, p.y] : null;
  }

  // ---- the free camera (inspect the set from outside) --------------------------------------------------------
  setFree(on) {
    for (const m of this.solid) if (m.userData.kind === "ceiling") m.visible = !on;
    this.scene.fog.far = on ? 400 : 16; this.scene.fog.near = on ? 300 : 4;
    if (!on) { this.free = null; return; }
    const c = this.camera.position.clone();
    this.free = { target: c.clone().add(new THREE.Vector3(0, -0.4, -2)), dist: 4.5, yaw: 0.6, pitch: 0.5 };
  }
  applyFree() {
    const f = this.free, c = this.camera;
    c.position.set(f.target.x + f.dist * Math.cos(f.pitch) * Math.sin(f.yaw), f.target.y + f.dist * Math.sin(f.pitch), f.target.z + f.dist * Math.cos(f.pitch) * Math.cos(f.yaw));
    c.lookAt(f.target); c.fov = 60; c.updateProjectionMatrix();
  }

  // ---- framing from the player's eye: how close the subject comes (the shot it really is), the angle, the eyes ----
  framing(sc, files) {
    const tl = this.timeline(sc), out = [];
    for (const seg of tl.segs.filter(s => s.type === "clip")) {
      const c = seg.clip, shot = c.shot === "closeup" ? "cu" : c.shot, f = this.cast[(tl.v.camera || {}).look] || this.cast[c.who];
      if (!f || !(tl.v.stage || {})[c.who]) continue;
      let best = null;                                  // the clip's closest moment decides the framing it reaches
      for (const k of [0.15, 0.5, 0.85, 1]) {
        const T = seg.start + seg.dur * k, st = this.stateAt(tl, T, files); this.apply(tl, st, T);
        f.group.updateMatrixWorld(true); this.camera.updateMatrixWorld(true);
        const head = f.jointWorld("head"); if (!head) continue;
        const d = this.camera.position.distanceTo(head);
        if (!best || d < best.dist) {
          const to = head.clone().sub(this.camera.position);
          const pitch = Math.atan2(to.y, Math.hypot(to.x, to.z)) * 180 / Math.PI;
          const eyesV = head.clone().project(this.camera).y;         // -1 bottom .. 1 top of the frame
          best = { clip: c.id, who: c.who, shot, dist: d, pitch, eyesV, real: shotFor(d), at: k };
        }
      }
      if (best) out.push(Object.assign(best, shot && SHOTS[shot] ? { near: SHOTS[shot].near, far: SHOTS[shot].far } : {}));
    }
    return out;
  }

  // ---- reaches: can the hand get there from where the actor stands? ---------------------------------------------
  reachCheck(sc, files) {
    const tl = this.timeline(sc), out = [];
    for (const seg of tl.segs.filter(s => s.type === "clip")) {
      const r = (seg.clip.body || {}).reach, f = this.cast[seg.clip.who];
      if (!r || !r.to || !f || !f.reachTo) continue;
      const at = +(r.at ?? 0.5), until = +(r.until ?? 1), side = (r.hand || "right") === "left" ? "l" : "r";
      let miss = 0, when = at;
      for (const k of [0, 0.33, 0.66, 1]) {               // the whole hold, not just the moment it lands
        const u = Math.min(0.999, at + (until - at) * k), T = seg.start + seg.dur * u, st = this.stateAt(tl, T, files);
        this.apply(tl, st, T);
        const tg = this.reachTarget(r.to, tl.v), h = f.modelJointWorld(`hand_${side}`);
        if (tg && h && h.distanceTo(tg) > miss) { miss = h.distanceTo(tg); when = u; }
      }
      out.push({ clip: seg.clip.id, who: seg.clip.who, to: r.to, miss, when });
    }
    return out;
  }

  // ---- what the player can see ---------------------------------------------------------------------------------
  visibility(sc, files) {
    const tl = this.timeline(sc), out = [];
    const ray = new THREE.Raycaster();
    for (const seg of tl.segs.filter(s => s.type === "clip")) {
      const who = seg.clip.who, f = this.cast[who];
      const seen = {};
      if (!f || !(tl.v.stage || {})[who]) { out.push({ clip: seg.clip.id, who, offstage: true }); continue; }
      for (const u of [0.1, 0.35, 0.6, 0.9]) {
        const T = seg.start + seg.dur * u, st = this.stateAt(tl, T, files);
        this.apply(tl, st, T);
        f.group.updateMatrixWorld(true);
        this.camera.updateMatrixWorld(true);
        for (const j of this.lib.joints) {
          const w = f.jointWorld(j.name); if (!w) continue;
          const ndc = w.clone().project(this.camera);
          let vis = ndc.z < 1 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1;
          if (vis) {
            const from = this.camera.position, dir = w.clone().sub(from), dist = dir.length();
            ray.set(from, dir.normalize()); ray.far = dist - 0.03;
            const hit = ray.intersectObjects(this.solid, false)[0];
            if (hit) { vis = false; seen[j.name] = seen[j.name] || { by: hit.object.userData.id }; }
          }
          if (vis) seen[j.name] = { vis: true };
        }
      }
      const visible = this.lib.joints.map(j => j.name).filter(n => seen[n] && seen[n].vis);
      const hidden = this.lib.joints.map(j => j.name).filter(n => !(seen[n] && seen[n].vis));
      const why = {};
      for (const n of hidden) why[n] = (seen[n] && seen[n].by) || "out of frame";
      out.push({ clip: seg.clip.id, who, visible, hidden, why });
    }
    return out;
  }

  // ---- storyboard frames ---------------------------------------------------------------------------------------
  thumb(sc, T, files, w = 320, h = 180) {
    if (!this.thumbR) { this.thumbR = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); }
    this.thumbR.setSize(w, h, false);
    const keep = this.free; this.free = null;
    const aspect = this.camera.aspect; this.camera.aspect = w / h;
    const st = this.frame(sc, T, files);
    this.thumbR.render(this.scene, this.camera);
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); this.free = keep;
    let url = this.thumbR.domElement.toDataURL("image/jpeg", 0.8);
    return { url, st };
  }

  // ---- export the blocking for Unreal (glTF: the previs skeleton + one animation per clip) ---------------------
  async exportGLTF(sc, game, sid, GLTFExporter) {
    const lib = this.lib, v = version(sc), fps = 30, clips = [];
    this.timeline(sc);                                // resolves moves and where each clip starts
    const root = new THREE.Group(); root.name = "previs";
    const bones = {}, list = [];
    for (const j of lib.joints) {
      const b = new THREE.Bone(); b.name = j.name; b.position.copy(j.off);
      bones[j.name] = b; list.push(b);
      if (j.parent) bones[j.parent].add(b); else root.add(b);
    }
    // a simple skinned body (a box per bone), so the file imports as a skeletal mesh
    const geo = new THREE.BufferGeometry(), P = [], I = [], W = [], IDX = [];
    let base = 0;
    lib.joints.forEach((j, bi) => {
      if (!j.parent) return;
      const pi = lib.index[j.parent], a = this.restWorld(j.parent), b = this.restWorld(j.name);
      const box = new THREE.BoxGeometry(0.06, 0.06, 0.06); box.translate(...a.clone().lerp(b, 0.5).toArray());
      const pa = box.attributes.position.array; for (let k = 0; k < pa.length; k++) P.push(pa[k]);
      for (let k = 0; k < pa.length / 3; k++) { I.push(pi, 0, 0, 0); W.push(1, 0, 0, 0); }
      for (const ix of box.index.array) IDX.push(ix + base);
      base += pa.length / 3;
    });
    geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(I, 4));
    geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(W, 4));
    geo.setIndex(IDX); geo.computeVertexNormals();
    const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xcccccc }));
    mesh.name = "previs_body";
    root.add(mesh);
    root.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(list));
    for (const c of v.clips || []) {
      if (c.body && (c.body.file || ((c.body.segments || []).length && c.body.segments.every(g => g.file)))) continue;   // generated motions already live in Unreal
      const dur = clipSecs(c), n = Math.max(2, Math.round(dur * fps) + 1), times = [];
      const qv = {}, pv = [];
      for (const j of lib.joints) qv[j.name] = [];
      for (let f = 0; f < n; f++) {
        const t = f / fps; times.push(t);
        const keys = (c.body && c.body.block && c.body.block.length) ? c.body.block : [{ at: 0, pose: "idle" }];
        const p = M.evalBlock(lib, keys, M.remap((c.body || {}).mods, Math.min(1, t / dur), dur) * dur, dur, c._startMove);
        const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw).multiply(p.rootRot);
        for (const j of lib.joints) {
          const q = j.parent ? p.q[j.name] : yawQ.clone().multiply(p.q[j.name]);
          qv[j.name].push(q.x, q.y, q.z, q.w);
        }
        const r = lib.joints[0].off.clone().add(p.root.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw)).add(p.move);
        pv.push(r.x, r.y, r.z);
      }
      const tracks = lib.joints.map(j => new THREE.QuaternionKeyframeTrack(`${j.name}.quaternion`, times, qv[j.name]));
      tracks.push(new THREE.VectorKeyframeTrack(`${lib.joints[0].name}.position`, times, pv));
      clips.push(new THREE.AnimationClip(`${game}_${sid}_${sc.pick || "main"}_${c.id}`, dur, tracks));
    }
    const exporter = new GLTFExporter();
    const glb = await exporter.parseAsync(root, { binary: true, animations: clips });
    return { blob: new Blob([glb], { type: "model/gltf-binary" }), clips: clips.map(c => c.name) };
  }
  restWorld(name) {
    let p = new THREE.Vector3(), j = this.lib.joints[this.lib.index[name]];
    while (j) { p.add(j.off); j = j.parent ? this.lib.joints[this.lib.index[j.parent]] : null; }
    return p;
  }
}

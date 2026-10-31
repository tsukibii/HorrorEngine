// The director's desk: plot a game, block its scenes with bodies and camera, watch it as a storyboard and an animatic,
// leave notes for each other. Reads and writes Content/Games/<Game>/story.json through serve.py.
import { typedAt, glitched } from "./play/typing.js";
import * as M from "./motion.js";
import { Stage, LIBRARY, SHOTS, SEAM_SECS, clipSecs, version, loadAssetLibrary, addMade, LEAN, PITCH, minimaxPrompt, VOICES, eventSecs, karmaOf, addKarma, karmaPick, PLAYS, REPLY_SECS, thenClip, TIMES, TIME_DEFAULT, flowTimes, chapterTime, FACES, loadFaces, forgetFace, edgeTime, facePlanOf, thenClips, thenList, thenId, replyGo, loadPainted, flowModels, modelFile, wearModels, sceneModels, wordOf, holds } from "./stage.js";
import { GLTFExporter } from "./vendor/GLTFExporter.js";
import { bakePreview } from "./bake.js";
import { loadBody, BodyFigure } from "./bodies.js";
import { PlayRuntime } from "./play/runtime.js";
import { chooser, loadTheme, paintLine, docked, besideAt, setName, named, setWords } from "./play/hud.js";
import { applySettings } from "./play/menu.js";
import { beatsEditor, actionList, triggerPill, modal, form, sortable, grip, toast, contextMenu, pick, pickAll, picked, unpick, focusOf, setFocus, CLIP, copyPicks, pasteAtPicks, copyNow, deletePicks, picPick, pickGrid, pickVerb, editAction, condRow } from "./ui.js";
import * as CLIPBOARD from "./clipboard.js";
const { pack, unpack, pasteClips, copyNodes, pasteNodes } = CLIPBOARD;
import { triggerText, actionText, ACTION } from "./commands.js";
import { icon } from "./icons.js";
import { Board, CARD_W, CARD_H } from "./board.js";
import { Database } from "./database.js";
import { DebugPanel } from "./debug.js";
import { openGoto } from "./goto.js";
import { Pictures } from "./pictures.js";
import { wireStageDrag } from "./blocking.js";
import { newThing, roomAt } from "./marks.js";
import { TYPES as KIT_TYPES } from "./kit.js";
import * as SCRIPT from "./screenplay.js";
import { TASKS as QUICK_TASKS, BEATS as QUICK_BEATS, TASK as QUICK_TASK, BEAT as QUICK_BEAT, buildTask, buildBeat } from "./templates.js";
import { lint, byObject } from "./lint.js";
import { merge3, setAt, changedPaths, indexPath } from "./merge.js";
import { placeOf } from "./refs.js";
import { States } from "./life.js";
import { arrows, arrowAt, canCut, setArrow, insertOn, swapNodes, runOf, moveRun } from "./flowedit.js";
import { playShelf, shelfName } from "./sfx.js";
import { ExpressionsPanel, DRAG_TYPE } from "./expressions.js";

const $ = s => document.querySelector(s);
const el = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [n, v] of Object.entries(a)) { if (n === "on") for (const [ev, f] of Object.entries(v)) e.addEventListener(ev, f); else if (n === "style") e.style.cssText = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(n, v === true ? "" : v); } for (const c of k.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
const SEAMS = ["blink", "glance", "flicker", "occlude", "cutaway", "turn", "stumble", "dip", "jcut", "heartbeat", "none"];
const CAMS = ["live", "free", "soft", "hard", "held"], PULLS = ["back", "left", "right", "down", "any"], ENDS = ["good", "bad", "secret", "other"];
const EVENTS = ["struggle", "press", "mash", "hold", "breath", "aim", "choose"], QTE = EVENTS.filter(t => t !== "choose"), TRANS = ["blend", "fade", "cut", "blink", "dip"];
const MOODS = {
  intimate: { text: "Close and slow: they come into your space (CU: under 0.55 m) and stay there, the player leans in a little (push 0.1 to 0.2 m), eye contact into the lens, little or no shake, warm practical light, breath under the line, long clips, seams on turns and blinks.", cone: [20, 12], shot: "cu", push: 0.15 },
  dread: { text: "Far and still: the figure over 3 m away (WS), negative space where something could be, a held look, low hum; make the player wait. Coming closer is the scare.", cone: [30, 18], shot: "ws", push: 0 },
  panic: { text: "In your face and shaking: the threat inside 0.55 m (CU, ECU for the grab), shake 0.3 to 0.6, heartbeat, quick seams (blink, stumble), a little roll; the player gets no time to look away.", cone: [14, 8], shot: "cu", push: 0, shake: 0.4 },
  reveal: { text: "Lead the eye, then hold: a cue on the reveal's side, a slow look-at (the player's head turns, the lens never zooms), the subject lit, a beat of silence before the sting.", cone: [24, 14], shot: "ms", push: 0.08 },
  calm: { text: "Ordinary distance: across a table or at arm's length (MS, MCU), free look, natural light. The breather after a scare, so the next one lands.", cone: [40, 24], shot: "mcu", push: 0 },
  grief: { text: "Close but still: MCU, no push, low light, long holds; let the silence after the line play.", cone: [22, 12], shot: "mcu", push: 0 },
  chase: { text: "Free camera, the player runs; shake, music `chase`; the threat behind and to the side, never in front, closing the distance.", cone: [60, 30], shot: "fs", push: 0, shake: 0.3 },
  aftermath: { text: "Wide, quiet, the room after: WS, slow drift, ringing ears, a dip to black when it's done.", cone: [40, 24], shot: "ws", push: 0 },
};
let S = null, GAME = null, MTIME = 0, DIRTY = false, SEL = null, VTAB = {}, PLAN = null, LIB = null, FILES = {}, FIX = {}, TAKES = {}, MADE = [];   // MADE: the game's generated motions (Motion/*.json), for the clips' picker
let BASE = null;                                  // the story as it was on disk when the desk last loaded or saved it: the merge's base
let MADE_MT = {}, FILE_MT = {};   // when each made motion was written, and when the one in FILES was: a take imported again under its name replaces it
let flowStage = null, watchStage = null, PLAY = null, BODIES = [], PICS = null;
let LIVES = { lives: {} };                        // the little things' lives (Content/Studio/Life/lives.json, life.js)
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- server ---------- */
async function api(path, opt) { const r = await fetch(path, opt); const j = await r.json(); if (!r.ok) { const e = new Error(j.error || r.status); e.status = r.status; e.body = j; throw e; } return j; }
async function boot() {
  try {
    LIB = M.loadLibrary(await api("/api/poses"));
    try { Stage.SOMA = await api("/api/soma"); } catch (e) { }
    try { LIVES = Stage.LIVES = await api("/api/lives"); } catch (e) { }
    const g = await api("/api/games");
    fillGames(g.games);
    GAME = localStorage.getItem("dd.game"); if (!g.games.includes(GAME)) GAME = g.games[0];
    $("#game").value = GAME;
    flowStage = new Stage($("#stageBox"), LIB);
    $("#stageBox").prepend(flowStage.renderer.domElement);
    watchStage = new Stage($("#watchBox"), LIB);
    $("#watchBox").prepend(watchStage.renderer.domElement);
    try { setSimple(localStorage.getItem("dd.simple") === "1"); } catch (e) { }
    try { setLightFx(localStorage.getItem("dd.lightfx") === "1"); } catch (e) { }
    PICS = pictures();
    flowStage.lifeAt = (sc, tl, T) => {                 // a scene's little things: from where they start, its cues up to T
      const W = new States(LIVES, lifeThings()).start(0);
      for (const c of stateCues(tl, sc)) if (c.t <= T) W.set(c.id, c.to, c.t);
      return id => ({ st: W.at(id, T), hist: W.history(id) });
    };
    wireFreeCam();
    wireStageDrag(flowStage, {                     // blocking by mouse on the scene's stage (blocking.js)
      scene: () => { const n = S && S.flow[SEL]; if (!n || n.type !== "scene" || !S.scenes[n.ref]) return null; const sc = S.scenes[n.ref], k = sc.variants ? (VTAB[n.ref] || sc.pick) : null; return { sc, ver: k && sc.variants[k] ? sc.variants[k] : sc, sid: n.ref, lvl: sc.level || Object.keys(S.levels)[0] }; },
      story: () => S, things, name: cid => ((S.cast || {})[cid] || {}).name || cid, status, busy: () => !!PLAY,
      touch: w => { touch(w); if (w) showStage(); renderInspector(); }, menu: (x, y, items, head) => contextMenu(x, y, items, head),
      placed: (id, t) => { if (PLAN && PLAN.things) PLAN.things[id] = t; },
      level: () => flowStage.level, lives: () => LIVES, addThing, setStart: (id, s) => { const p = propById(id); if (!p) return; p.state = s; touch(true); status(`${id} starts ${s}`); } });
    const q = new URLSearchParams(location.search);
    if (q.get("game") && g.games.includes(q.get("game"))) { GAME = q.get("game"); $("#game").value = GAME; }
    if (GAME) await load();
    setInterval(poll, 5000);
    const node = q.get("node");
    if (node && S && S.flow[node]) {
      SEL = node; renderAll(); showStage();
      if (q.get("watch")) { document.querySelector('nav button[data-v="watchView"]').click(); watch(node); }
    }
  } catch (e) { console.error(e); $("#offline").style.display = "block"; status("no server"); }
}
function pictures() {
  const ps = new Stage(document.createElement("div"), LIB);
  ps.thumbR = ps.renderer; ps.render = () => {};      // one GL context: its frames are made by thumb() alone
  Object.defineProperty(ps, "bodies", { get: () => flowStage.bodies }); Object.defineProperty(ps, "defaultBody", { get: () => flowStage.defaultBody });
  return new Pictures({ stage: ps, story: () => S, plan: () => PLAN, files: () => FILES, rev: () => LAST, color: whoColor, load: f => loadFile(f), kit: () => LIBRARY.kit,
    timeOf: sid => { const nid = Object.keys(S.flow).find(k => S.flow[k].type === "scene" && S.flow[k].ref === sid); return (flowTimes(S)[nid] || {}).time || S.game.time || TIME_DEFAULT; } });
}
const pic = (kind, id, o) => PICS ? PICS.img(kind, id, o) : null;
// a little thing's picture: its kit preset's
const thingPic = id => { const q = propById(id), k = q && q.kit, pre = typeof k === "string" ? k : k && k.preset; return pre ? pic("kit", pre) : el("span", { class: "ppk-none" }, "?"); };
function propById(id) { for (const lv of Object.values(S.levels || {})) for (const r of lv.rooms || []) for (const p of r.props || []) if (p.id === id) return p; return null; }
// the stage's right-click: a little thing (a kit preset of the "small" kind), picked from pictures, put where it was
// clicked: on the thing clicked (a table, a counter) or the floor, its front to the player, alive (docs/IMMERSION.md)
function addThing(lvl, p, hit, e, face) {
  const kits = LIBRARY.kit || {}, small = Object.entries(kits).filter(([, q]) => (q.cat || (KIT_TYPES[q.type] || {}).cat) === "small" && (q.mount || (KIT_TYPES[q.type] || {}).mount) !== "wall");
  let anchor = document.querySelector("#thingAnchor"); if (!anchor) { anchor = el("div", { id: "thingAnchor", style: "position:fixed;width:1px;height:1px;pointer-events:none" }); document.body.append(anchor); }
  anchor.style.left = e.clientX + "px"; anchor.style.top = e.clientY + "px";
  pickGrid(anchor, { get: () => null, choices: () => small.map(([n, q]) => [n, q.label]), pic: n => pic("kit", n), title: "a little thing" }, preset => {
    if (!preset) return;
    const room = roomAt((S.levels || {})[lvl], p[0], p[1], p[2]); if (!room) { status("that's outside the rooms"); return; }
    const on = hit.kind === "thing" && (room.props || []).some(q => q.id === hit.id) ? hit.id : null;
    const id = newThing(S, room, p[0], p[1], face, preset, on);
    touch(true); status(`${kits[preset].label}: ${id}${on ? " on " + on : ""} (right-click it for the state it starts in)`);
  });
}
const face = (who, o = {}) => who && who !== "player" && (S.cast || {})[who] ? pic("cast", who, Object.assign({ cls: "face" }, o)) : null;
// a pose picked from pictures (the blocking, the segments' keys, the layers, the Database's motions)
function posePick(obj, key, after) {
  return picPick({ get: () => obj[key], set: v => { obj[key] = v || "idle"; touch(); if (after) after(); }, choices: () => poseNames().map(p => [p, p]), pic: p => pic("pose", p), title: "the pose: click to pick from pictures" });
}
function seekClip(cid) {                          // the stage to a line of the scene shown, where its picture was taken
  const sc = currentScene(); if (!sc) return;
  const s = flowStage.timeline(sc).segs.find(x => x.type === "clip" && x.clip.id === cid && !x.answer); if (!s) return;
  stopPlay(); const T = s.start + s.dur * 0.45; $("#scrub").value = T; scrubTo(T);
}
function fillGames(list) { const sel = $("#game"); sel.innerHTML = ""; for (const n of list) sel.append(el("option", { value: n }, n)); }
async function load() {
  const j = await api("/api/story/" + encodeURIComponent(GAME));
  S = j.story; MTIME = j.mtime; dirty(false); $("#banner").style.display = "none"; UNDO = []; REDO = []; LAST = JSON.stringify(S); BASE = LAST; undoState();
  try { localStorage.setItem("dd.game", GAME); } catch (e) { }
  SEL = SEL && S.flow[SEL] ? SEL : S.game.start;
  try { const nl = M.loadLibrary(await api("/api/poses")); LIB.poses = nl.poses; LIB.names = nl.names; } catch (e) { }   // poses saved since (the demo's pose window, poses.html)
  await replan(); await loadMade(); await loadFiles(); await loadBodies(); await loadAssetLibrary(); await loadPainted(GAME); await loadTakes(); renderAll(); showStage();
  if (!$("#exprPanel").hidden) XP.refresh();             // the expression cards wear this game's bodies
  CHECK.list = []; CHECK.key = null; scheduleCheck(1500);
  offerDraft();
}
/* ---------- the takes (MiniMax videos) on the timeline ---------- */
const takeId = (sid, k, cid) => `${GAME}_${sid}_${k || "main"}_${cid}`;
const isVideo = n => /\.(mp4|mov|webm)$/i.test(n);
function addTake(stem, url, name, file) { const old = TAKES[stem]; if (old && old.video && !isVideo(name)) return; TAKES[stem] = { url, name, video: isVideo(name), file }; }
async function loadTakes() {                       // what intake.py copied to Footage/<Game>/
  for (const k of Object.keys(TAKES)) if (!TAKES[k].file) delete TAKES[k];
  try { const j = await api("/api/takes/" + encodeURIComponent(GAME)); for (const f of j.takes) addTake(f.replace(/\.[^.]+$/, ""), `/takes/${encodeURIComponent(GAME)}/${encodeURIComponent(f)}`, f); } catch (e) { }
}
function pickTakes() {                             // or straight from a folder on disk
  const inp = el("input", { type: "file", multiple: true, webkitdirectory: true, accept: "video/*,audio/*", style: "display:none", on: { change: () => {
    let n = 0; for (const f of inp.files) if (/\.(mp4|mov|webm|wav|mp3|m4a)$/i.test(f.name)) { addTake(f.name.replace(/\.[^.]+$/, ""), URL.createObjectURL(f), f.name, f); n++; }
    inp.remove(); status(`${n} take files loaded`); renderAll(); } } });
  document.body.append(inp); inp.click();
}
function allClips() {                            // every take: the clips, and the answers to replies (<take id>_<option>)
  const out = [];
  for (const [sid, sc] of Object.entries(S.scenes || {})) for (const [k, ver] of (sc.variants ? Object.entries(sc.variants) : [[null, sc]])) for (const c of ver.clips || []) {
    out.push({ sid, k, c, id: takeId(sid, k, c.id) });
    for (const o of (c.reply && c.reply.options) || []) thenList(o).forEach((th, n) => out.push({ sid, k, c: th, id: takeId(sid, k, thenId(c, o, n)), answer: true }));
  }
  for (const [lid, ln] of Object.entries(S.lines || {})) out.push({ sid: null, k: null, c: ln, id: lid, line: true });   // barks and one-off lines
  return out;
}
// the auto-clean: each take's length and dead air (Web Audio), into the clip's dur and trim (storykit/takes.py's numbers)
const TK = { win: 0.02, floor: -38, padIn: 0.08, padOut: 0.15, min: 0.05 };
const WAVES = {};                                 // a take's url -> its length, the dead air at either end, its loudness to draw
async function takeWave(t) {
  if (WAVES[t.url]) return WAVES[t.url];
  const buf = await (t.file ? t.file.arrayBuffer() : fetch(t.url, { cache: "no-store" }).then(r => r.arrayBuffer()));
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 16000, 16000);
  const ab = await ctx.decodeAudioData(buf), d = ab.getChannelData(0), w = Math.max(1, Math.round(ab.sampleRate * TK.win)), loud = [];
  for (let i = 0; i + w <= d.length; i += w) { let s = 0; for (let j = i; j < i + w; j++) s += d[j] * d[j]; const rms = Math.sqrt(s / w); loud.push(rms > 0 && 20 * Math.log10(rms) > TK.floor); }
  const first = loud.indexOf(true), last = loud.lastIndexOf(true), N = 480, per = Math.max(1, Math.floor(d.length / N)), peaks = new Float32Array(N);
  for (let i = 0; i < N; i++) { let m = 0; for (let j = i * per, e = Math.min(d.length, j + per); j < e; j++) { const a = d[j] < 0 ? -d[j] : d[j]; if (a > m) m = a; } peaks[i] = m; }
  return (WAVES[t.url] = { dur: +ab.duration.toFixed(2), lead: first < 0 ? 0 : +(first * TK.win).toFixed(2), tail: first < 0 ? 0 : +Math.max(0, ab.duration - (last + 1) * TK.win).toFixed(2), peaks });
}
async function measureTake(t) { const w = await takeWave(t); return { dur: w.dur, lead: w.lead, tail: w.tail }; }
async function autoClean(keepTrim) {
  const rows = [];
  for (const { c, id } of allClips()) {
    const t = TAKES[id]; if (!t) continue;
    try {
      const m = await cleanTake(c, t, keepTrim);
      rows.push(`${id}: ${m.dur} s${c.trim ? `, trimmed ${c.trim.in || 0} in / ${c.trim.out || 0} out` : ""} → ${clipSecs(c).toFixed(2)} s`);
    } catch (e) { rows.push(`${id}: couldn't read (${e.message})`); }
  }
  if (rows.length) touch(); renderAll(); showStage();
  return rows;
}
const PIPS = {};
function takePip(box) {                            // a take's video in the corner of a stage (hidden, audio only, when Video is off)
  if (PIPS[box]) return PIPS[box];
  const v = el("video", { class: "takepip", playsinline: true }); $(box).append(v); return PIPS[box] = v;
}
function playTake(box, sid, k, c, showVideo) {
  const t = TAKES[takeId(sid, k, c.id)], v = takePip(box);
  if (!t) { v.pause(); v.style.display = "none"; return false; }
  if (v.dataset.src !== t.url) { v.src = t.url; v.dataset.src = t.url; }
  v.style.display = t.video && showVideo ? "block" : "none";
  v.currentTime = +((c.trim || {}).in || 0); v.play().catch(() => { });
  return true;
}
function playLine(lid) {                         // a line outside the scenes (a bark): its take if loaded, else the browser's voice
  const ln = (S.lines || {})[lid], t = TAKES[lid]; if (!ln) return;
  if (t) { const v = takePip("#watchBox"); if (v.dataset.src !== t.url) { v.src = t.url; v.dataset.src = t.url; } v.style.display = "none"; v.currentTime = 0; v.play().catch(() => { }); }
  const sub = el("div", { class: "barksub" }, `${ln.en || ""}`); $("#watchBox").append(sub); setTimeout(() => sub.remove(), 2600);
}
const pickOne = a => a && a.length ? a[Math.floor(Math.random() * a.length)] : null;
function stopTakes() { for (const v of Object.values(PIPS)) { v.pause(); v.style.display = "none"; } }
async function replan() { try { PLAN = await api("/api/plan/" + encodeURIComponent(GAME), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(S) }); addMade(PLAN.made); } catch (e) { status(e.message); } }   // made: the rooms' tuned sets
let replanTimer = null;
function scheduleReplan() { clearTimeout(replanTimer); replanTimer = setTimeout(async () => { await replan(); showStage(); }, 700); }
async function loadMade() {                         // the motions made, and which loaded ones were made again since (dropped: loadFiles fetches them anew)
  try { const j = await api(`/api/kimodo/${encodeURIComponent(GAME)}`); MADE = j.made || []; MADE_MT = j.mtimes || {}; } catch (e) { MADE = []; MADE_MT = {}; }
  for (const f of Object.keys(FILES)) { const n = f.replace(/\.json$/, ""); if (n in MADE_MT && FILE_MT[f] !== MADE_MT[n]) { delete FILES[f]; delete FILE_MT[f]; } }
}
async function loadFile(f) {                       // one motion into FILES (a clip just pointed at it): the stage plays it at once
  if (!f || FILES[f]) return !!FILES[f];
  try { FILES[f] = await api(`/api/motion/${encodeURIComponent(GAME)}/${encodeURIComponent(f)}`); FILE_MT[f] = MADE_MT[f.replace(/\.json$/, "")]; return true; } catch (e) { return false; }
}
// a clip's generated motion: picked from the ones made (Kimodo, motion.py import) or typed; its length against the clip's,
// or why it doesn't play (not made yet: the clip falls back to its blocking)
function motionPick(b, c, segDur) {
  const id = "made_" + c.id + "_" + Math.random().toString(36).slice(2, 7), f = b.file, have = f && FILES[f];
  const made = f && MADE.includes(f.replace(/\.json$/, ""));
  const secs = have ? have.pos.length / (have.fps || 30) : 0;
  const tag = !f ? null : have ? el("span", { class: "ok", title: `${f}: ${secs.toFixed(1)} s of motion over a ${segDur.toFixed(1)} s clip (fit: ${b.fit || "stretch"})` }, ` ✓ ${secs.toFixed(1)} s`)
    : el("span", { class: "err", title: made ? "made but not loaded: Reload" : "no such motion in Motion/: make it in Kimodo (the Kimodo page's shot list), then import it; until then the clip plays its blocking" }, made ? " not loaded" : " not made yet");
  const inp = el("input", { list: id, value: f || "", placeholder: MADE.length ? `pick a motion (${MADE.length} made)` : "none made yet (Kimodo)", style: "width:180px",
    title: "the generated motion this clip plays (Content/Games/<game>/Motion/<name>.json); empty: the blocking keys above",
    on: { change: async e => { const v = e.target.value.trim().replace(/^.*Motion[\\/]/, ""); if (!v) delete b.file; else b.file = /\.json$/.test(v) ? v : v + ".json"; touch(); await loadFile(b.file); renderInspector(); showStage(); } } });
  const browse = el("button", { class: "ppk-b", title: "the made motions, as pictures of their bodies at four moments", on: { click: e => { e.preventDefault(); pickGrid(browse, {
    get: () => b.file || "", blank: "none (the blocking keys)", choices: () => MADE.map(n => [n + ".json", n]), pic: f => pic("motion", f) },
    async v => { if (!v) delete b.file; else b.file = v; touch(); await loadFile(b.file); renderInspector(); showStage(); }); } } }, have ? pic("motion", f) : icon("motion", 14));
  return el("span", { class: "rowi" }, browse, inp, el("datalist", { id }, ...MADE.map(n => el("option", { value: n + ".json" }))), tag);
}
async function loadFiles() {
  for (const m of Object.values(S.motions || {})) if (m.name && MADE.includes(m.name) && !FILES[m.name + ".json"]) await loadFile(m.name + ".json");   // the motions table's takes: Play and the rounds play them
  for (const sc of Object.values(S.scenes || {})) for (const ver of [sc, ...Object.values(sc.variants || {})]) for (const c of ver.clips || []) {
    for (const f of [c.body && c.body.file, ...((c.body && c.body.segments) || []).map(g => g.file)]) {
      if (!f || FILES[f]) continue;
      await loadFile(f);
    }
  }
}
async function loadBodies() {
  try { BODIES = (await api("/api/bodies")).bodies; } catch (e) { BODIES = []; }
  if (!BodyFigure.soma) try { BodyFigure.soma = await api("/api/soma"); } catch (e) { }
  const want = new Set([S.game.previs_body, ...Object.values(S.cast || {}).flatMap(c => [c.previs_body, ...Object.values(c.models || {})])].filter(f => f && f !== "capsules"));   // every model too (§5)
  const def = BODIES.find(f => /^default\./i.test(f)) || BODIES.find(f => !/_hi\./i.test(f) && !f.startsWith("people/")) || null;   // MHR_hi is for exports; a Studio character only when chosen
  if (def) want.add(def);
  for (const f of want) {
    if (!BODIES.includes(f) || flowStage.bodies[f]) continue;
    try {
      const tpl = await loadBody("/bodies/" + f.split("/").map(encodeURIComponent).join("/"));
      if (f.startsWith("people/")) tpl.userData = { studio: f.slice(7) };   // a Character Studio character (its recipe stays in the file: the desk only wears it)
      flowStage.bodies[f] = tpl; watchStage.bodies[f] = tpl;
    }
    catch (e) { console.warn("couldn't load body", f, e); status("couldn't load body " + f); }
  }
  flowStage.defaultBody = watchStage.defaultBody = def;
}
async function save(force) {
  if (!S) return;
  const sent = JSON.stringify(S);
  try { const j = await api("/api/story/" + encodeURIComponent(GAME), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ story: S, mtime: MTIME, force: !!force }) }); MTIME = j.mtime; BASE = sent; dirty(DIRTY && JSON.stringify(S) !== sent); status("saved " + new Date().toLocaleTimeString()); scheduleCheck(300); if (DIRTY) keepDraft(); else dropDraft(); }
  catch (e) {
    if (e.status !== 409) { alert("save failed: " + e.message); return false; }
    if (await syncFromDisk("save")) return save();   // the disk had changes of its own: they're merged in, save the two together
    if (confirm(e.message + "\n\nOK = overwrite with your version, Cancel = keep editing")) return save(true);
    return false;
  }
  return true;
}
// story.json changed on disk (Claude, the scene builder, a Kimodo import): its changes come in. With no edits here it's
// simply the new version; with edits, the two merge (merge.js) and only what both changed differently is asked about.
// Not during a playthrough (right after it), nor while a field is being typed in (a moment later).
let SYNCING = false, SYNC_AFTER_WATCH = null;
async function syncFromDisk(why) {
  if (!GAME || !S || SYNCING) return false;
  if (RUN) { SYNC_AFTER_WATCH = why || "disk"; return false; }
  const ae = document.activeElement;
  if (why !== "save" && ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && !ae.closest(".mdl")) { setTimeout(() => syncFromDisk(why), 2500); return false; }
  SYNCING = true;
  try {
    const d = await api("/api/story/" + encodeURIComponent(GAME));
    if (Math.abs(d.mtime - MTIME) < 0.001) return false;
    const who = why === "builder" ? "the scene builder" : why === "motions" ? "the Kimodo import" : "Claude (or another window)", base = BASE ? JSON.parse(BASE) : d.story;
    const where = changedPaths(base, d.story).map(p => placeOf(d.story, indexPath(d.story, p)).text), uniq = [...new Set(where)];
    const said = uniq.slice(0, 3).join("; ") + (uniq.length > 3 ? ` and ${uniq.length - 3} more` : "");
    if (!DIRTY) {
      S = d.story; BASE = JSON.stringify(S); MTIME = d.mtime; snapshot(); dirty(false);
      if (!S.flow[SEL]) SEL = S.game.start;
      renderAll(); scheduleReplan(); await loadMade(); await loadFiles();
      toast(`${who} changed the story${said ? ": " + said : ""}`, { action: UNDO.length ? { label: "Undo", on: () => undoTo(UNDO, REDO, "undo") } : null });
      return true;
    }
    const r = merge3(base, S, d.story); let value = r.value;
    if (r.conflicts.length) value = await conflicts(r.conflicts, value, d.story, who);
    S = value; BASE = JSON.stringify(d.story); MTIME = d.mtime; snapshot(); dirty(true);
    if (!S.flow[SEL]) SEL = S.game.start;
    renderAll(); scheduleReplan(); await loadMade(); await loadFiles();
    toast(`Changes from ${who} are merged with yours${said ? ": " + said : ""}${r.conflicts.length ? ` (${r.conflicts.length} asked about)` : ""}. Save keeps both.`, { action: { label: "Undo", on: () => undoTo(UNDO, REDO, "undo") } });
    return true;
  } catch (e) { $("#banner").style.display = "block"; status("couldn't bring in the changes on disk: " + e.message); return false; }
  finally { SYNCING = false; }
}
// where both sides changed the same thing differently: keep mine (the default) or take theirs, one by one
async function conflicts(list, value, theirs, who) {
  const short = v => v === undefined ? "(deleted)" : typeof v === "string" ? `“${v.length > 70 ? v.slice(0, 70) + "…" : v}”` : Array.isArray(v) ? `${v.length} item${v.length === 1 ? "" : "s"}` :
    v && typeof v === "object" ? (v.en || v.title || v.label || v.text ? `“${String(v.en || v.title || v.label || v.text).slice(0, 60)}”` : JSON.stringify(v).slice(0, 70) + (JSON.stringify(v).length > 70 ? "…" : "")) : String(v);
  const pick = list.map(() => "mine"), WORDS = { en: "the English", ja: "the Japanese", zh: "the Chinese", title: "the title", label: "the label", who: "who says it", text: "the text",
    prompt: "the prompt", next: "where it goes next", to: "where it goes", xy: "its place on the board", do: "its commands", when: "when it happens", "(order)": "the order" };
  const body = el("div", { class: "conf" }, el("p", { class: "hint" }, `You and ${who} both changed these. Yours stays unless you take theirs.`));
  list.forEach((c, i) => {
    const where = placeOf(value, indexPath(value, c.path)).text || c.path.filter(k => typeof k !== "object").join(" · "), key = c.path.filter(k => typeof k !== "object").slice(-1)[0];
    const b1 = el("button", { class: "on", on: { click: () => { pick[i] = "mine"; b1.classList.add("on"); b2.classList.remove("on"); } } }, "Yours: ", short(c.mine));
    const b2 = el("button", { on: { click: () => { pick[i] = "theirs"; b2.classList.add("on"); b1.classList.remove("on"); } } }, "Theirs: ", short(c.theirs));
    body.append(el("div", { class: "conf-r" }, el("div", { class: "conf-w" }, where, key !== undefined ? el("span", { class: "kv" }, " · " + (WORDS[key] || key)) : null), el("div", { class: "conf-b" }, b1, b2)));
  });
  await modal({ title: `Both changed ${list.length} thing${list.length === 1 ? "" : "s"}`, body, ok: "Apply", cancel: null, wide: true });
  list.forEach((c, i) => { if (pick[i] === "theirs") setAt(value, c.path, c.theirs === undefined ? undefined : JSON.parse(JSON.stringify(c.theirs))); });
  return value;
}
// the scene builder (builder.html) says when it saved a level: reload it here unless there are edits to keep, and
// not in the middle of a playthrough (then right after it)
function openBuilder(level, node) {
  window.open(`builder.html?game=${encodeURIComponent(GAME)}&level=${encodeURIComponent(level || "")}&node=${encodeURIComponent(node || "")}`, "scenebuilder");
}
try {
  new BroadcastChannel("horrorstudio-story").onmessage = async e => {
    const m = e.data || {};
    if (!["saved", "motions"].includes(m.type) || m.game !== GAME) return;
    syncFromDisk(m.type === "motions" ? "motions" : "builder");
  };
} catch (e) { }
async function poll() { if (!GAME || SYNCING) return; try { const j = await api("/api/mtime/" + encodeURIComponent(GAME)); if (j.mtime && Math.abs(j.mtime - MTIME) > 0.001) syncFromDisk(); } catch (e) { } }
function dirty(d) { DIRTY = d; status(d ? "unsaved changes" : "saved"); $("#status").classList.toggle("dirty", d); }
function status(t) { $("#status").textContent = (GAME ? GAME + " · " : "") + t; }
function touch(world) { snapshot(); dirty(true); renderBoard(); if (world) scheduleReplan(); else showStage(); scheduleCheck(); problemsButton(); keepDraft(); }
let UNDO = [], REDO = [], LAST = null;
function snapshot() { const now = JSON.stringify(S); if (LAST !== null && now !== LAST) { UNDO.push(LAST); if (UNDO.length > 150) UNDO.shift(); REDO = []; } LAST = now; undoState(); }
function undoState() { $("#undo").disabled = !UNDO.length; $("#redo").disabled = !REDO.length; }
function undoTo(from, to, what) {
  if (!from.length) { status(`nothing to ${what}`); return; }
  to.push(JSON.stringify(S)); S = JSON.parse(from.pop()); LAST = JSON.stringify(S); keepDraft();
  if (!S.flow[SEL]) SEL = S.game.start;
  dirty(true); renderAll(); scheduleReplan(); undoState(); status(`${what}: ${from.length} more`);
}
window.addEventListener("beforeunload", e => { if (DIRTY) { e.preventDefault(); e.returnValue = ""; } });
window.addEventListener("pagehide", () => { if (DIRTY) { clearTimeout(DRAFT_T); writeDraft(); } });   // the tab closing: the draft now, not in a second
// ---- the draft in the browser: every edit kept (a second after it) until it's saved, so a closed tab or a crash
// loses nothing; opening the game again offers it back, merged with whatever the disk has now
const draftKey = () => "dd.draft." + GAME;
let DRAFT_T = null, DRAFT_FULL = false;
function writeDraft() {
  if (!GAME || !S) return;
  try { if (DIRTY) localStorage.setItem(draftKey(), JSON.stringify({ at: Date.now(), mtime: MTIME, base: BASE, story: LAST })); else localStorage.removeItem(draftKey()); DRAFT_FULL = false; }
  catch (e) { if (!DRAFT_FULL) { DRAFT_FULL = true; toast("The browser has no room left to keep a draft of your edits: save to be safe."); } }
}
function keepDraft() { clearTimeout(DRAFT_T); DRAFT_T = setTimeout(writeDraft, 1000); }
function dropDraft() { clearTimeout(DRAFT_T); try { localStorage.removeItem(draftKey()); } catch (e) { } }
function offerDraft() {
  let d = null; try { d = JSON.parse(localStorage.getItem(draftKey()) || "null"); } catch (e) { }
  if (!d || !d.story) return;
  if (d.story === LAST) { dropDraft(); return; }
  toast(`Edits from ${new Date(d.at).toLocaleString()} were never saved: this browser kept them.`, { ms: 120000, action: { label: "Bring them back", on: () => restoreDraft(d) } });
}
async function restoreDraft(d) {
  const mine = JSON.parse(d.story), disk = S;
  let value = mine;
  if (Math.abs((d.mtime || 0) - MTIME) > 0.001 && d.base) {   // saved since (Claude, another window): the two merged, asking where both changed one thing
    const r = merge3(JSON.parse(d.base), mine, disk); value = r.value;
    if (r.conflicts.length) value = await conflicts(r.conflicts, value, disk, "the version saved since");
  }
  S = value; if (!S.flow[SEL]) SEL = S.game.start;
  touch(true); renderAll(); toast("Your unsaved edits are back: Save keeps them.", { action: { label: "Undo", on: () => undoTo(UNDO, REDO, "undo") } });
}
// ---- the saves kept (Saved/Story/<Game>/history, the last 50): what each was, what's different now, one brought back
async function historyDialog() {
  if (!GAME || !S) return;
  let list = []; try { list = (await api(`/api/history/${encodeURIComponent(GAME)}`)).saves; } catch (e) { alert("couldn't read the saves: " + e.message); return; }
  const fmt = t => new Date(t * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const left = el("div", { class: "hist-list" }), right = el("div", { class: "hist-diff" }, el("p", { class: "muted" }, list.length ? "Pick a save to see what's different from now." : "No saves kept yet: each save keeps the version before it here."));
  let chosen = null;
  const where = (v, p) => { for (const st of [S, v]) { try { const t = placeOf(st, indexPath(st, p)).text; if (t) return t; } catch (e) { } } return p.map(x => typeof x === "object" ? x.id : x).join(" › "); };
  const show = async (it, row) => {
    left.querySelectorAll(".hist-i").forEach(x => x.classList.toggle("on", x === row)); chosen = null;
    right.innerHTML = ""; right.append(el("p", { class: "muted" }, "reading…"));
    const v = (await api(`/api/history/${encodeURIComponent(GAME)}/${it.name}`)).story, ps = [...new Set(changedPaths(v, S).map(p => where(v, p)))];
    chosen = v; right.innerHTML = "";
    right.append(el("h4", {}, `As it was until ${fmt(it.at)}`), el("p", { class: "kv" }, ps.length ? `${ps.length} place${ps.length === 1 ? "" : "s"} differ from the desk now:` : "the same as the desk now"),
      el("ul", { class: "hist-ch" }, ...ps.slice(0, 80).map(w => el("li", {}, w))));
    if (ps.length > 80) right.append(el("p", { class: "kv" }, `and ${ps.length - 80} more`));
  };
  for (const it of list) { const row = el("div", { class: "hist-i", on: { click: () => show(it, row) } }, icon("clock", 13), el("b", {}, fmt(it.at)), el("span", { class: "kv" }, `${Math.max(1, Math.round(it.size / 1024))} KB`)); left.append(row); }
  const ok = await modal({ title: "Saves kept", wide: true, ok: "Bring this version back", body: el("div", { class: "hist" },
    el("p", { class: "hint" }, `Each save keeps the version before it (the last 50, in Saved/Story/${GAME}/history). Bringing one back makes it your unsaved edits: look it over, then Save keeps it and Undo takes it back.`),
    el("div", { class: "hist-cols" }, left, right)) });
  if (!ok || !chosen) return;
  S = JSON.parse(JSON.stringify(chosen)); if (!S.flow[SEL]) SEL = S.game.start;
  touch(true); renderAll(); toast("That version is back as unsaved edits: Save keeps it.", { action: { label: "Undo", on: () => undoTo(UNDO, REDO, "undo") } });
}
const typingNow = () => /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "") || !!window.getSelection().toString();
function copySelection() {
  const f = focusOf();
  if (f === "commands" || f === "beats") { const c = copyPicks(); if (c) { copyNow(c, f === "beats" ? "beat" : "command"); return c; } }
  if (f === "clips") { copyLines(); return CLIP.get(); }
  if (f === "cards" && S && $("#flowView").classList.contains("on")) { copyCards(); return CLIP.get(); }
  return null;
}
function pasteSelection(clip) {
  if (!S || !clip) return false;
  if (clip.kind === "nodes") return $("#flowView").classList.contains("on") ? pasteCards(clip) : false;
  if (clip.kind === "clips") return pasteLines(clip, picked("clips").slice(-1)[0] || null);
  if (pasteAtPicks(clip, S)) return true;
  const n = S.flow[SEL];                           // nothing picked: beats at the end of the task shown
  if (clip.kind === "beats" && n && n.type === "stitch") { const st = S.stitches[n.ref]; st.beats = st.beats || []; const { pasteBeats } = CLIPBOARD; st.beats.push(...pasteBeats(S, clip.items)); touch(); renderInspector(); return true; }
  toast(clip.kind === "commands" ? "Click a command or a beat, then paste: the commands go after it" : "Open a task to paste beats into it", { ms: 4000 });
  return false;
}
document.addEventListener("copy", e => { if (typingNow()) return; const c = copySelection(); if (c) { e.clipboardData.setData("text/plain", JSON.stringify(c, null, 1)); e.preventDefault(); } });
document.addEventListener("paste", e => {
  if (typingNow() || document.querySelector(".mdl")) return;
  const t = e.clipboardData.getData("text/plain"), c = (t && unpack(t)) || CLIP.get();
  if (c && pasteSelection(c)) { e.preventDefault(); if (t && unpack(t)) CLIP.set(c, { system: false }); }
});
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D") && !typingNow() && !document.querySelector(".mdl")) {   // duplicate what's picked
    e.preventDefault(); const f = focusOf();
    if (f === "cards") { const ids = pickedCards(); if (ids.length) pasteCards(copyNodes(S, ids, BOARD.pos), [BOARD.pos[ids[0]].x + 40, BOARD.pos[ids[0]].y + 40]); }
    else if (f === "clips") { const ls = picked("clips"); if (ls.length) pasteLines(pack("clips", ls, { scene: (CLIPS_OF.get(ls[0]) || {}).sid }), ls[ls.length - 1]); }
    else { const c = copyPicks(); if (c) pasteAtPicks(c, S); }
  }
  if (e.key === "Escape" && !document.querySelector(".mdl,.bmenu") && !RUN) { unpick(); if (SELS.size > 1) { SELS = new Set([SEL]); renderBoard(); } }
  if (e.key === "Delete" && !typingNow() && !document.querySelector(".mdl") && focusOf() === "commands") { e.preventDefault(); deletePicks(); }
  if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "");
  if ((e.ctrlKey || e.metaKey) && !typing && !RUN && (e.key === "z" || e.key === "Z" || e.key === "y")) {   // the text box keeps its own undo
    e.preventDefault(); if (e.key === "y" || e.shiftKey) undoTo(REDO, UNDO, "redo"); else undoTo(UNDO, REDO, "undo");
  }
});

/* ---------- story helpers ---------- */
const things = () => (PLAN && PLAN.things) || {};
const spots = lvl => Object.entries(things()).filter(([k, v]) => v.use === "spot" && (!lvl || v.level === lvl)).map(([k]) => k);
const placed = lvl => Object.entries(things()).filter(([k, v]) => v.kind !== "room" && (!lvl || v.level === lvl)).map(([k]) => k);
const castIds = () => Object.keys(S.cast || {});
const poseNames = () => (LIB ? LIB.names : ["idle"]);
function sceneSecs(sc) { const v = version(sc); let t = 0; (v.clips || []).forEach((c, i) => { t += clipSecs(c) + (i && c.seam ? SEAM_SECS[c.seam.kind] || 0 : 0) + (c.event ? eventSecs(c.event, S) : 0) + replySecs(c); }); return t; }
function replySecs(c) { const rp = c.reply; if (!rp) return 0; const o = (rp.options || []).find(x => thenList(x).length); return Math.min(+(rp.wait || REPLY_SECS), 2.5) + (o ? thenList(o).reduce((s, th) => s + clipSecs(th), 0) : 0); }
function nodeRef(n) { return n.type === "scene" ? S.scenes[n.ref] : n.type === "stitch" ? S.stitches[n.ref] : null; }
function notesHost(nid) { const n = S.flow[nid]; return nodeRef(n) || n; }
function openNotes(obj) { return (obj && obj.notes || []).filter(x => !x.done).length; }
function eventResults(ev) { if (!ev) return []; if (ev.type === "choose") return (ev.options || []).map(o => o.id); return ev.type === "struggle" ? ["escape", "caught"] : ["success", "fail"]; }
/* ---------- problems: the live checks as you edit (lint.js), and the story check's after it runs ---------- */
let LINT = [], LINT_KEY = null, LINT_PLAN = null, LINT_OBJ = new Map();
const CHECK = { busy: false, again: false, at: 0, ok: null, summary: "", list: [], key: null };
function lintNow() {
  if (!S) return [];
  if (LINT_KEY === LAST && LINT_PLAN === PLAN && LAST !== null) return LINT;
  LINT = lint(S, { things: things(), poses: poseNames(), secs: c => clipSecs(c), lives: LIVES }).map(p => Object.assign(p, { src: "desk" }));
  LINT_KEY = LAST; LINT_PLAN = PLAN; LINT_OBJ = byObject(LINT);
  problemsButton(); return LINT;
}
function allProblems() { return [...lintNow(), ...(CHECK.key === LAST ? CHECK.list : CHECK.list.map(p => Object.assign({}, p, { stale: true })))]; }
function problems(nid) { return allProblems().filter(p => p.at && p.at.node === nid && !(p.src === "check" && p.sev === "warn")); }
function marks(obj) { lintNow(); return LINT_OBJ.get(obj) || null; }
function marksIn(beat) { const st = S.flow[SEL] && S.flow[SEL].type === "stitch" ? S.flow[SEL].ref : null; return allProblems().filter(p => p.at && p.at.beat === beat && p.at.stitch === st); }
const TIME_MARK = { day: "☀", dusk: "◐", night: "☾" };   // a scene's time on the board and in the pickers
function newId(prefix, table) { let i = 1; while (table[prefix + i]) i++; return prefix + i; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

/* ---------- what the editing parts (ui.js) can pick from: the story's lines, items, flags, things, routes... ---------- */
let CTX_LEVEL = null, CTX_BEATS = [];
function storyFlags() {
  const out = new Set(), walk = x => {
    if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(walk);
    for (const [k, v] of Object.entries(x)) {
      if ((k === "flag" || k === "unflag") && typeof v === "string" && v) out.add(v);
      else if (k === "if" && Array.isArray(v)) v.forEach(f => typeof f === "string" && out.add(f.replace(/^!/, "")));
      else if (v && typeof v === "object") walk(v);
    }
  };
  walk(S); return [...out].sort();
}
function todosOf() { const out = {}; const walk = l => { for (const a of l || []) { if (!a) continue; if (typeof a.todo === "string") { out[a.todo] = a; for (const x of Object.values(a.on || {})) walk(x); } for (const o of a.options || []) walk(o.do); } }; for (const st of Object.values(S.stitches || {})) for (const b of st.beats || []) walk(b.do); return out; }
function asksOf() { const out = {}; for (const st of Object.values(S.stitches || {})) for (const b of st.beats || []) for (const a of b.do || []) if (a.ask) out[a.ask] = a; return out; }
const CTX = {
  refs(kind) {
    const lv = CTX_LEVEL, T = f => Object.entries(things()).filter(([, t]) => (!lv || t.level === lv) && f(t))
      .map(([id, t]) => [id, t.room && t.room !== id ? `${id} · ${t.room}` : id]).sort((a, b) => a[0].localeCompare(b[0]));
    if (kind.startsWith("askanswer:")) { const a = asksOf()[kind.slice(10)]; return a ? (a.options || []).map(o => [o.id, o.label || o.id]) : []; }
    if (kind.startsWith("lifestate:")) { const t = things()[kind.slice(10)], L = t && t.life ? LIVES.lives[t.life] : null; return L ? L.states.map(s => [s.id, s.id]) : []; }
    switch (kind) {
      case "line": return Object.entries(S.lines || {}).map(([id, l]) => [id, `${id} · ${l.who ? ((S.cast || {})[l.who] || {}).name || l.who : ""}: ${(l.en || l.ja || "").slice(0, 60)}`]);
      case "sound": return Object.keys(S.sounds || {}).map(k => [k, k]);
      case "item": return Object.entries(S.items || {}).map(([k, v]) => [k, v.name || k]);
      case "note": return Object.entries(S.notes || {}).map(([k, v]) => [k, v.title || k]);
      case "counter": return Object.entries(S.game.counters || {}).map(([k, v]) => [k, v.label ? `${k} · ${v.label}` : k]);
      case "axis": return Object.keys(((S.game.karma || {}).axes) || { karma: {} }).map(k => [k, k]);
      case "scene": return Object.entries(S.scenes || {}).map(([k, v]) => [k, v.title ? `${v.title} (${k})` : k]);
      case "cast": return Object.entries(S.cast || {}).map(([k, v]) => [k, v.name || k]);
      case "spot": return T(t => t.use === "spot");
      case "thing": return T(t => t.kind !== "room");
      case "door": return T(t => t.kind === "door");
      case "light": return T(t => t.use === "light");
      case "room": return T(t => t.kind === "room");
      case "zone": return T(t => t.kind === "room" || t.use === "trigger");
      case "locker": return T(t => t.use === "locker");
      case "stain": return T(t => t.use === "clean");
      case "breaker": return T(t => t.use === "breaker");
      case "carry": return T(t => t.use === "carry");
      case "die": return T(t => t.use === "roll");
      case "table": return T(t => t.use === "game");
      case "life": return T(t => !!t.life).map(([id, l]) => [id, `${l} · ${things()[id].life}`]);
      case "route": return Object.entries(S.levels || {}).filter(([l]) => !lv || l === lv).flatMap(([, v]) => Object.keys(v.routes || {}).map(r => [r, r]));
      case "beat": return CTX_BEATS.map(b => [b.id, `${b.id}: ${triggerText(b.when, CTX.name)}`]);
      case "ask": return Object.entries(asksOf()).map(([k, a]) => [k, a.text ? `${k} · ${a.text}` : k]);
      case "todo": return Object.entries(todosOf()).map(([k, a]) => [k, a.text ? `${a.text} (${k})` : k]);
      case "pose": return poseNames().map(p => [p, p]);
      case "motion": return Object.keys(S.motions || {}).map(k => [k, k]);
      case "flag": return storyFlags().map(f => [f, f]);
      case "secret": return Object.entries(S.secrets || {}).map(([k, v]) => [k, v.hint ? `${k} · ${v.hint}` : k]);
      case "node": return Object.entries(S.flow || {}).map(([k, n]) => [k, `${nodeTitle(k, n)} (${k})`]);
    }
    return [];
  },
  pic(kind, id) { if (id === undefined) return kind === "cast" || kind === "pose" || kind === "life"; return kind === "cast" ? face(id) || el("span", { class: "ppk-none" }, "?") : kind === "life" ? thingPic(id) : pic(kind, id); },
  name(kind, v) {
    if (v === undefined || v === null || v === "") return "…";
    if (kind === "line") { const l = (S.lines || {})[v]; return l ? `“${(l.en || l.ja || v).slice(0, 48)}”` : v; }
    if (kind === "item") return ((S.items || {})[v] || {}).name || v;
    if (kind === "note") return `“${((S.notes || {})[v] || {}).title || v}”`;
    if (kind === "scene") return `“${((S.scenes || {})[v] || {}).title || v}”`;
    if (kind === "cast") return ((S.cast || {})[v] || {}).name || v;
    if (kind === "counter") return ((S.game.counters || {})[v] || {}).label || v;
    if (kind === "todo") { const t = todosOf()[v]; return t && t.text ? `“${t.text}”` : v; }
    return String(v);
  },
  changed() { touch(); },
  rerender() { const sc = $("#inspector").scrollTop; renderInspector(); $("#inspector").scrollTop = sc; },
  marks, marksIn,                                  // problems on a command, a trigger or a beat (ui.js marks them)
  story: () => S,                                  // for the paste's new ids (clipboard.js)
  creates: kind => ["line", "item", "note", "sound", "counter", "secret", "motion", "cast"].includes(kind),   // "+ New…" in their pickers
  create: kind => DB.quickNew(kind),
};
// a command list's array, written back into the story only when it changes (no empty lists left behind): obj[key],
// and obj itself into parent[pkey] once it holds something
function slot(obj, key, parent = null, pkey = null) {
  const arr = obj[key] || [];
  return [arr, Object.assign({}, CTX, { changed() {
    if (arr.length) { obj[key] = arr; if (parent) parent[pkey] = obj; }
    else { delete obj[key]; if (parent && parent[pkey] === obj && !Object.keys(obj).length) delete parent[pkey]; }
    touch();
  } })];
}
// the old JSON box, kept behind "Advanced" for what the forms don't cover yet
const advanced = (...kids) => el("details", { class: "advanced" }, el("summary", {}, "Advanced: edit as JSON"), ...kids);

/* ---------- the flow board ---------- */
function karmaLabel(o) { const a = o.axis && o.axis !== "karma" ? o.axis + " " : ""; return o.min !== undefined && o.max !== undefined ? `${a}${o.min}..${o.max}` : o.min !== undefined ? `${a}≥ ${o.min}` : o.max !== undefined ? `${a}≤ ${o.max}` : "else"; }
function outs(id) {              // the arrows out of a card, labelled (flowedit.arrows: each with where it lives, `at`)
  const n = S.flow[id]; if (!n) return [];
  const label = a => {
    const [k, i] = a.at;
    if (k === "option") { const o = n.options[i]; return o.label || o.result || (o.if ? o.if.join("&") : n.by === "karma" ? karmaLabel(o) : n.by === "count" ? (o.count ? o.count + " " : "") + karmaLabel(o) : "else"); }
    if (k === "timer") return "⏱ " + (S.stitches[n.ref].timer.secs || "") + " s";
    if (k === "interrupt") return "☠ " + (S.interrupts[i].label || S.interrupts[i].id);
    if (k === "answer") return "↪ " + (a.option.label || a.option.id);   // an answer that leaves for another card (§9.9 go)
    return "";
  };
  return arrows(S, id).filter((a, i, all) => a.to && (a.kind !== "answer" || all.findIndex(b => b.kind === "answer" && b.to === a.to) === i)).map(a => Object.assign(a, { label: label(a) }));
}
// the board (board.js): what's on a card, and what moving, connecting and adding do to the story
let BOARD = null;
function cardOf(id, n) {
  const ref = nodeRef(n), times = flowTimes(S); let meta = "";
  if (n.type === "scene" && ref) { const v = version(ref), ft = times[id], om = Object.entries(sceneModels(ref)); meta = `${(v.clips || []).length} clips · ${Math.round(sceneSecs(ref))} s` + (ref.mood ? " · " + ref.mood : "") + (ref.variants ? ` · ${Object.keys(ref.variants).length} var` : "") + (ft ? " · " + TIME_MARK[ft.time] + (ft.own ? " " + ft.time : "") : "")
    + (om.length ? " · " + om.map(([c, m]) => `${((S.cast || {})[c] || {}).name || c}: ${m}`).join(", ") : ""); }   // the models it picks (§5)
  if (n.type === "stitch" && ref) meta = (ref.play ? `${ref.play.type} round` : `${(ref.beats || []).length} beats`) + ` · ~${ref.target_min || "?"} min` + (ref.timer ? ` · ⏱${ref.timer.secs}s` : "");
  if (n.type === "choice") meta = "by " + n.by; if (n.type === "ending") meta = n.kind;
  const probs = problems(id), nn = openNotes(notesHost(id)), worst = probs.some(p => p.sev === "error") ? "var(--bad)" : "var(--warn)";
  const v = n.type === "scene" && ref ? version(ref) : null, first = v && (v.clips || [])[0];
  const who = v ? [...new Set((v.clips || []).map(c => c.who).filter(w => w && w !== "player" && (S.cast || {})[w]))].slice(0, 3) : [];
  return { title: probs.map(p => (p.sev === "error" ? "✖ " : "⚠ ") + p.text).join("\n"), kids: [
    first ? pic("line", [n.ref, ref.variants ? ref.pick : null, first.id], { cls: "cardpic" }) : null,
    el("div", { class: "t" }, icon({ scene: "film", stitch: "task", choice: "choice", ending: "ending" }[n.type] || "box", 11), " ", n.type === "stitch" ? "task" : n.type, id === S.game.start ? " · start" : "",
      who.length ? el("span", { class: "faces" }, ...who.map(w => face(w, { title: (S.cast[w] || {}).name || w }))) : null),
    el("div", { class: "n" }, nodeTitle(id, n)),
    el("div", { class: "m" }, id + (meta ? " · " + meta : "")),
    probs.length ? el("span", { class: "badge", style: `background:${worst};color:${worst === "var(--bad)" ? "#fff" : "#000"}` }, "!" + probs.length) : nn ? el("span", { class: "badge" }, "✎" + nn) : null] };
}
// {cast id: body file} for the models a node's cast wear ({cast id: variant}, flowModels); everyone else their default
function modelFiles(models) { const out = {}; for (const [cid, v] of Object.entries(models || {})) { const f = modelFile(S, cid, v); if (f) out[cid] = f; } return out; }
function nodeTitle(id, n) { const ref = nodeRef(n); return (ref && ref.title) || n.title || n.prompt || (n.type === "choice" ? `choice by ${n.by}${n.of ? " of " + n.of : ""}` : id); }
let SELS = new Set();                              // the cards picked together (Ctrl or Shift click, a box): copied, moved, deleted together
function selectNode(id, { add = false } = {}) {
  setFocus("cards");
  if (add) { if (SELS.has(id) && SELS.size > 1) { SELS.delete(id); if (SEL === id) SEL = [...SELS].pop(); } else { SELS.add(id); if (SEL) SELS.add(SEL); SEL = id; } }
  else { SELS = new Set([id]); SEL = id; }
  renderBoard(); renderInspector(); showStage();
}
const pickedCards = () => (SELS.size > 1 ? [...SELS] : [SEL]).filter(id => id && S.flow[id]);
function copyCards(ids = pickedCards()) { return ids.length ? copyNow(copyNodes(S, ids, BOARD ? BOARD.pos : {}), "card") : false; }
function pasteCards(clip, at) {
  if (!clip || clip.kind !== "nodes") return false;
  freezeLayout();
  const p = at || (BOARD && BOARD.mouse) || (BOARD ? BOARD.toWorld(BOARD.host.getBoundingClientRect().left + BOARD.host.clientWidth / 2, BOARD.host.getBoundingClientRect().top + BOARD.host.clientHeight / 2) : [0, 0]);
  const made = pasteNodes(S, clip, p);
  SELS = new Set(made); SEL = made[0]; touch(true); renderInspector(); showStage(); if (BOARD) BOARD.center(made[0]);
  toast(`Pasted ${made.length} card${made.length === 1 ? "" : "s"}: connect ${made.length === 1 ? "it" : "them"} where ${made.length === 1 ? "it goes" : "they go"}`, { ms: 5000 });
  return made.length;
}
function removeCards(ids) {
  if (ids.length < 2) return removeNode(ids[0]);
  if (!confirm(`Delete ${ids.length} nodes (${ids.join(", ")})? Their scenes and tasks stay in the file.`)) return;
  for (const id of ids) delete S.flow[id]; leaveActs(ids); SELS = new Set(); if (!S.flow[SEL]) SEL = S.game.start; touch(); renderInspector(); showStage();
}
const ACT_COLORS = ["#8a63d2", "#2f9e8f", "#c98a2b", "#c0473f", "#3f7fbf", "#7a8a3a"];
async function makeAct(ids) {
  const v = { title: "" }, body = form([{ key: "title", label: "The act's name", kind: "text", ph: "Act 1: the house" }], v, CTX);
  if (!await modal({ title: `An act of ${ids.length} card${ids.length === 1 ? "" : "s"}`, body, ok: "Make it" })) return;
  S.frames = S.frames || [];
  for (const f of S.frames) f.nodes = (f.nodes || []).filter(x => !ids.includes(x));
  S.frames = S.frames.filter(f => f.nodes.length);
  let n = 1; while (S.frames.some(f => f.id === "f_act" + n)) n++;
  S.frames.push({ id: "f_act" + n, title: v.title.trim() || "Act " + n, color: ACT_COLORS[(n - 1) % ACT_COLORS.length], nodes: ids });
  freezeLayout(); touch(); renderBoard();
}
function frameMenu(fid, x, y) {
  const f = (S.frames || []).find(z => z.id === fid); if (!f) return;
  const ids = pickedCards().filter(id => !(f.nodes || []).includes(id)), folded = BOARD.folded().has(fid);
  contextMenu(x, y, [
    { label: folded ? "Open it" : "Fold it into one card", icon: folded ? "chevron" : "down", on: () => BOARD.fold(fid, !folded) },
    { label: "Rename", icon: "edit", on: async () => { const v = { title: f.title }; if (await modal({ title: "The act's name", body: form([{ key: "title", label: "Name", kind: "text" }], v, CTX) })) { f.title = (v.title || "").trim() || f.title; touch(); renderBoard(); } } },
    { label: "Pick its cards", icon: "check", on: () => { SELS = new Set(f.nodes); SEL = f.nodes[0]; setFocus("cards"); renderBoard(); renderInspector(); } },
    ids.length ? { label: `Add the ${ids.length} picked card${ids.length === 1 ? "" : "s"}`, icon: "plus", on: () => { for (const g of S.frames) g.nodes = g.nodes.filter(z => !ids.includes(z)); f.nodes.push(...ids); S.frames = S.frames.filter(g => g.nodes.length); touch(); renderBoard(); } } : null,
    "-",
    ...ACT_COLORS.map((c, i) => ({ label: ["violet", "teal", "amber", "red", "blue", "olive"][i], icon: "box", on: () => { f.color = c; touch(); renderBoard(); } })),
    "-",
    { label: "Ungroup (the cards stay)", icon: "x", danger: true, on: () => { S.frames = S.frames.filter(z => z !== f); if (!S.frames.length) delete S.frames; touch(); renderBoard(); } }], `act “${f.title}”`);
}
function cardMenu(id, x, y, at) {
  if (!id) return contextMenu(x, y, [                // the board itself
    ...[["scene", "film", "Scene"], ["stitch", "task", "Task"], ["choice", "choice", "Choice"], ["ending", "ending", "Ending"]].map(([t, ic, l]) => ({ label: "Add a " + l.toLowerCase() + " here", icon: ic, on: () => createNode(t, at, null) })),
    "-", { label: "Paste here", icon: "plus", kbd: "Ctrl+V", disabled: !CLIP.has("nodes"), on: () => pasteCards(CLIP.get(), at) },
    { label: "Fit everything", icon: "fit", kbd: "F", on: () => BOARD.fit() }, { label: "Tidy the layout", icon: "tree", on: () => BOARD.tidy() }], "The board");
  if (!SELS.has(id)) selectNode(id);
  const n = S.flow[id], ids = pickedCards(), many = ids.length > 1;
  contextMenu(x, y, [
    n.type === "scene" || n.type === "stitch" ? { label: "Watch from here", icon: "play", on: () => { openView("watchView"); watch(id); } } : null,
    n.type !== "ending" ? { label: "Watch from here with a state…", icon: "gear", hint: "the debug panel: the flags, counters, karma and items to start with", on: () => { openView("watchView"); DBG.node = id; DBG.toggle(true); } } : null,
    { label: "Make it the start", icon: "flag", disabled: S.game.start === id, on: () => { S.game.start = id; touch(); renderInspector(); } },
    ids.length === 2 && ids.every(k => ["scene", "stitch"].includes((S.flow[k] || {}).type)) ? { label: "Swap their places in the flow", icon: "flow", hint: "what led to each leads to the other, each goes on where the other went", on: () => { freezeLayout(); if (swapNodes(S, ids[0], ids[1])) { status(`${ids[0]} ⇄ ${ids[1]}`); touch(); renderInspector(); } } } : null,
    !many && (n.type === "scene" || n.type === "stitch") && n.next ? { label: "Cut what comes after", icon: "x", hint: "its next goes: a stub to drag onto a card later", on: () => { setArrow(S, id, ["next"], null); touch(); renderInspector(); } } : null,
    "-",
    { label: many ? `Copy ${ids.length} cards` : "Copy", icon: "copy", kbd: "Ctrl+C", on: () => copyCards(ids) },
    { label: "Paste here", icon: "plus", kbd: "Ctrl+V", disabled: !CLIP.has("nodes"), on: () => pasteCards(CLIP.get(), at) },
    { label: many ? `Duplicate ${ids.length} cards` : "Duplicate", icon: "copy", kbd: "Ctrl+D", on: () => pasteCards(copyNodes(S, ids, BOARD.pos), [BOARD.pos[ids[0]].x + 40, BOARD.pos[ids[0]].y + 40]) },
    many ? null : { label: "Rename", icon: "edit", on: () => renameNode(id) },
    { label: many ? "Make an act of these" : "Make an act of it", icon: "box", hint: "a coloured frame behind them, with a name: moved and folded together", on: () => makeAct(ids) },
    (S.frames || []).some(f => (f.nodes || []).some(n => ids.includes(n))) ? { label: "Take out of its act", icon: "x", on: () => { for (const f of S.frames) f.nodes = f.nodes.filter(n => !ids.includes(n)); S.frames = S.frames.filter(f => f.nodes.length); if (!S.frames.length) delete S.frames; touch(); renderBoard(); } } : null,
    "-",
    { label: many ? `Delete ${ids.length} cards` : "Delete", icon: "x", danger: true, kbd: "Del", on: () => removeCards(ids) }], many ? `${ids.length} cards` : nodeTitle(id, n));
}
function freezeLayout() {                          // the first node moved: every node keeps where it is now
  if (!BOARD || Object.values(S.flow).every(n => Array.isArray(n.xy))) return;
  for (const [id, p] of Object.entries(BOARD.layout())) if (S.flow[id] && !Array.isArray(S.flow[id].xy)) S.flow[id].xy = [Math.round(p.x), Math.round(p.y)];
}
// an arrow on the board, clicked or right-clicked (HANDOFF_DIRECTOR_TODO §2): cut it (its card keeps a stub to drag
// onto a card later, what came after stays on the board as a loose chain), put a new card on it, or move the picked
// run of cards onto it; dragging an arrow by its end onto another card re-points it (Board's repoint)
function arrowMenu(from, at, x, y, xy) {
  const a = arrowAt(S, from, at); if (!a) return;
  const ids = pickedCards(), run = ids.length && !ids.includes(from) && !ids.includes(a.to) ? runOf(S, ids) : null;
  const ins = (t, l, ic) => ({ label: `Insert a ${l} here`, icon: ic, on: () => insertCard(from, at, t, xy) });
  contextMenu(x, y, [
    canCut(at) ? { label: "Cut here", icon: "x", hint: "its card keeps a stub to drag onto a card when it's ready; what came after stays on the board", on: () => { setArrow(S, from, at, null); status(`${from}: cut (drag its stub onto a card to join it again)`); touch(); renderInspector(); } } : null,
    { label: "Point it at another card…", icon: "link", hint: "or drag the arrow by its end onto the card", on: () => toast("Drag the arrow by its end (near the arrowhead) onto the card it should go to") },
    "-", ins("scene", "scene", "scene"), ins("talk", "conversation", "ask"), ins("stitch", "task", "task"), ins("choice", "choice", "choice"),
    run ? "-" : null,
    run ? { label: run.length > 1 ? `Move the ${run.length} picked cards here` : `Move “${nodeTitle(run[0], S.flow[run[0]])}” here`, icon: "move", hint: "out of where they are (what led into them goes on to what came after them) and onto this arrow", on: () => {
      freezeLayout(); if (moveRun(S, run, from, at)) { status(`${run.join(" › ")} moved after ${from}`); touch(); renderInspector(); } else toast("Can't move them there") } } : null,
  ], `${nodeTitle(from, S.flow[from])} → ${a.to ? nodeTitle(a.to, S.flow[a.to]) : "…"}`);
}
function insertCard(from, at, type, xy) {          // a new card put on an arrow, where the arrow was clicked
  const f = S.flow[from], cur = nodeRef(f || {}), lvl = (cur && cur.level) || Object.keys(S.levels)[0];
  freezeLayout();
  const nid = newId("n_", S.flow), node = newNodeOf(type, lvl, null);
  if (xy) node.xy = [Math.round((xy[0] - CARD_W / 2) / 8) * 8, Math.round((xy[1] - CARD_H / 2) / 8) * 8];
  if (!insertOn(S, from, at, nid, node)) return;
  SEL = nid; SELS = new Set([nid]); touch(); renderInspector(); showStage();
}
function connectNodes(from, to) {
  const n = S.flow[from]; if (!n || from === to) return;
  if (n.type === "ending") return;
  if (n.type === "choice") { (n.options = n.options || []).push({ label: "", to }); status(`${from}: a new option to ${to} (say when it's taken)`); SEL = from; }
  else { n.next = to; status(`${from} → ${to}`); }
  touch(); renderInspector();
}
function newNodeOf(type, lvl, next) {
  if (type === "talk") {                           // a conversation: a scene whose line is a hanging line with two answers (§9.9)
    const node = newNodeOf("scene", lvl, next), sc = S.scenes[node.ref], c = sc.clips[0];
    sc.title = "New conversation"; c.shot = "mcu";
    c.reply = { wait: 6, timeout: null, options: [{ id: "yes", label: "", then: { ja: "", en: "" } }, { id: "no", label: "", then: { ja: "", en: "" } }] };
    return node;
  }
  if (type === "scene") { const sid = newId("s_", S.scenes); S.scenes[sid] = { title: "New scene", level: lvl, mood: "dread", stage: {}, camera: { mode: "soft", look: castIds()[0] || null, cone: [30, 18] }, clips: [{ id: "c1", who: castIds()[0] || "", ja: "", en: "", act: "", shot: "ms", body: { block: [{ at: 0, pose: "idle" }] } }] }; return { type, ref: sid, next }; }
  if (type === "stitch") { const tid = newId("t_", S.stitches); S.stitches[tid] = { title: "New task", level: lvl, goal: "", target_min: 5, beats: [{ id: "b_" + tid.slice(2) + "_start", when: { start: true }, do: [{ objective: "…" }, { done: true }] }] }; return { type, ref: tid, next }; }
  if (type === "choice") return { type, by: "act", prompt: "", options: next ? [{ label: "A", when: { use: "" }, to: next }, { label: "B", when: { use: "" }, to: next }] : [] };
  return { type, kind: "good", title: "An ending" };
}
function createNode(type, xy, from) {             // dropped on the board (from the palette, or off a node's port)
  const f = from && S.flow[from], cur = nodeRef(f || S.flow[SEL] || {}), lvl = (cur && cur.level) || Object.keys(S.levels)[0];
  freezeLayout();
  const nid = newId(type === "ending" ? "e_" : "n_", S.flow), node = newNodeOf(type, lvl, null);
  if (xy) node.xy = [Math.round(xy[0] / 8) * 8, Math.round(xy[1] / 8) * 8];
  S.flow[nid] = node;
  if (f) { if (f.type === "choice") (f.options = f.options || []).push({ label: "", to: nid }); else f.next = nid; }
  SEL = nid; touch(); renderInspector(); showStage();
}
function leaveActs(ids) {                          // nodes gone: out of their acts too (an empty act goes)
  if (!S.frames) return; for (const f of S.frames) f.nodes = (f.nodes || []).filter(n => !ids.includes(n));
  S.frames = S.frames.filter(f => f.nodes.length); if (!S.frames.length) delete S.frames;
}
function removeNode(id) {
  if (!S.flow[id] || !confirm(`Delete node ${id}? (its scene or task stays in the file)`)) return;
  delete S.flow[id]; leaveActs([id]); if (SEL === id) SEL = S.game.start; touch(); renderInspector(); showStage();
}
function renderBoard() {
  if (!S) return;
  if (!BOARD) BOARD = new Board($("#board"), { story: () => S, game: () => GAME, selected: () => SEL, select: selectNode, card: cardOf, outs, multi: () => SELS,
    moved: all => { for (const [id, xy] of Object.entries(all)) if (S.flow[id]) S.flow[id].xy = xy; touch(); },
    connect: connectNodes, create: createNode, remove: () => removeCards(pickedCards()), context: cardMenu, quick: (id, at) => quickTask(id, at),
    arrow: arrowMenu, repoint: (from, at, to) => { if (setArrow(S, from, at, to)) { status(`${from} → ${to}`); touch(); renderInspector(); } },
    pickMany: ids => { SELS = new Set(ids); SEL = ids[0]; setFocus("cards"); renderBoard(); renderInspector(); showStage(); },
    frameMenu, join: (fid, id) => { for (const f of S.frames || []) f.nodes = (f.nodes || []).filter(x => x !== id); const f = (S.frames || []).find(x => x.id === fid); if (f) { f.nodes.push(id); toast(`${nodeTitle(id, S.flow[id])} is in “${f.title}” now`, { ms: 3000 }); } } });
  BOARD.render(); renderOutline();
}
// the side of the board: the palette (drag a node onto the board, or click to add one after the selected node) and
// the story's outline (every node in reading order; click to go to it)
function renderOutline() {
  const side = $("#flowSide"); if (!side || !S) return;
  const q = side.querySelector(".ol-search") ? side.querySelector(".ol-search").value : "", focus = document.activeElement && document.activeElement.classList.contains("ol-search");
  side.innerHTML = "";
  side.append(el("div", { class: "side-h" }, "Add to the story"), el("div", { class: "palette" },
    ...[["scene", "film", "Scene", "an actor scene: lines, takes, bodies"], ["stitch", "task", "Task", "the player's task between scenes"], ["choice", "choice", "Choice", "where the story branches"], ["ending", "ending", "Ending", "an ending (good, bad, a death)"]].map(([t, ic, l, tip]) =>
      el("div", { class: "pchip " + t, draggable: "true", title: `drag onto the board, or click to add after the selected node: ${tip}`,
        on: { dragstart: e => { e.dataTransfer.setData("text/x-node", t); e.dataTransfer.effectAllowed = "copy"; }, click: () => addNode(t) } }, icon(ic, 15), l))));
  const qOpen = (() => { try { return localStorage.getItem("dd.quickOpen") !== "0"; } catch (e) { return true; } })();
  side.append(el("details", { class: "quick", open: qOpen || null, on: { toggle: e => { try { localStorage.setItem("dd.quickOpen", e.target.open ? "1" : "0"); } catch (x) { } } } },
    el("summary", { class: "side-h" }, "Quick tasks"),
    el("div", { class: "qlist" }, QUICK_TASKS.map(t => el("div", { class: "qchip", draggable: "true", title: `${t.hint}: drag onto the board, or click to add after the selected node`,
      on: { dragstart: e => { e.dataTransfer.setData("text/x-quick", t.id); e.dataTransfer.effectAllowed = "copy"; }, click: () => quickTask(t.id, null, SEL) } }, icon(t.icon, 14), t.label)))));
  const search = el("input", { class: "ol-search", placeholder: "Find a node…", value: q, on: { input: () => renderOutline() } });
  const order = [], seen = new Set(), queue = [S.game.start];
  while (queue.length) { const id = queue.shift(); if (!S.flow[id] || seen.has(id)) continue; seen.add(id); order.push(id); for (const o of outs(id)) queue.push(o.to); }
  for (const id of Object.keys(S.flow)) if (!seen.has(id)) order.push(id);
  const list = el("div", { class: "outline" }), ql = q.trim().toLowerCase();
  for (const id of order) {
    const n = S.flow[id], title = nodeTitle(id, n);
    if (ql && !(title + " " + id).toLowerCase().includes(ql)) continue;
    list.append(el("div", { class: `ol-i ${n.type}${SEL === id ? " sel" : ""}${seen.has(id) ? "" : " lost"}`, title: seen.has(id) ? id : id + ": not reached from the start",
      on: { click: () => { selectNode(id); BOARD && BOARD.center(id); } } }, el("span", { class: "dot" }), el("span", { class: "ol-t" }, title), el("span", { class: "ol-id" }, id)));
  }
  side.append(el("div", { class: "side-h" }, "The story", el("span", { class: "muted" }, ` · ${Object.keys(S.flow).length}`)), search, list);
  if (focus) { search.focus(); search.setSelectionRange(search.value.length, search.value.length); }
}

/* ---------- small form helpers ---------- */
function field(label, ...inputs) { return el("div", { class: "row" }, el("label", {}, label), ...inputs); }
function txt(obj, key, o = {}) {
  const i = el("input", { class: o.w ? "w" : "", value: obj[key] ?? "", placeholder: o.ph || "", title: o.title || "", style: o.style || "", on: { change: e => { const v = e.target.value; if (o.num) { if (v === "") delete obj[key]; else obj[key] = +v; } else { if (v === "" && o.drop) delete obj[key]; else obj[key] = v === "" && o.nullable ? null : v; } touch(o.world); o.after && o.after(); } } });
  if (o.num) { i.type = "number"; i.step = o.step || "any"; }
  return i;
}
function sel(obj, key, choices, o = {}) {
  const s = el("select", { title: o.title || "", on: { change: e => { const v = e.target.value; if (v === "" && o.drop) delete obj[key]; else obj[key] = v === "" ? (o.nullable ? null : "") : v; touch(o.world); o.after && o.after(); } } });
  if (o.blank !== false) s.append(el("option", { value: "" }, o.blank || "—"));
  for (const c of choices) { const [v, l] = Array.isArray(c) ? c : [c, c]; s.append(el("option", { value: v, selected: obj[key] === v }, l)); }
  return s;
}
function chk(obj, key, label, after) { return el("label", { class: "kv" }, el("input", { type: "checkbox", checked: !!obj[key], on: { change: e => { if (e.target.checked) obj[key] = true; else delete obj[key]; touch(); after && after(); } } }), " " + label); }
function jsonArea(obj, key, label, o = {}) {
  const ta = el("textarea", { style: o.small ? "min-height:44px" : "", on: { change: e => { try { const t = e.target.value.trim(); if (t) obj[key] = JSON.parse(t); else delete obj[key]; e.target.style.outline = ""; touch(o.world); o.after && o.after(); } catch (x) { e.target.style.outline = "1px solid var(--bad)"; status("JSON error in " + label + ": " + x.message); } } } });
  ta.value = obj[key] === undefined ? "" : JSON.stringify(obj[key], null, o.compact ? 0 : 1);
  return el("div", {}, el("div", { class: "kv" }, label), ta);
}

/* ---------- the inspector ---------- */
function renderInspector() {
  const box = $("#inspector"); box.innerHTML = ""; CTX_LEVEL = null; CTX_BEATS = [];
  if (!S || !SEL || !S.flow[SEL]) { box.append(el("p", { class: "muted" }, "Select a node.")); return; }
  const n = S.flow[SEL], nodeIds = Object.keys(S.flow);
  box.append(el("h2", {}, `${n.type} · ${SEL}`), el("div", { class: "row" },
    n.type === "scene" || n.type === "stitch" ? el("button", { class: "primary", title: "the Watch from this node on, as the game plays it", on: { click: () => { const nid = SEL; document.querySelector('nav button[data-v="watchView"]').click(); watch(nid); } } }, "▶ Watch from here") : null,
    el("button", { on: { click: () => { S.game.start = SEL; touch(); renderInspector(); } } }, "Make start"),
    el("button", { on: { click: () => renameNode(SEL) } }, "Rename"),
    el("button", { on: { click: () => { if (confirm("Delete node " + SEL + "? (its scene or stitch stays in the file)")) { delete S.flow[SEL]; SEL = S.game.start; touch(); renderInspector(); } } } }, "Delete")));
  if (n.type === "scene" || n.type === "stitch") {
    const cur = nodeRef(n), lvl = (cur && cur.level) || Object.keys(S.levels || {})[0];
    if (lvl) box.append(el("div", { class: "row" }, el("button", { title: "Open this script's level in the scene builder: its marks shown, the ones this node uses highlighted. Save there and this page reloads it.",
      on: { click: () => openBuilder(lvl, SEL) } }, `Edit environment (${lvl}) ↗`)));
    const table = n.type === "scene" ? S.scenes : S.stitches;
    box.append(field("ref", sel(n, "ref", Object.keys(table), { after: () => { renderInspector(); showStage(); } })), field("next", sel(n, "next", nodeIds)));
    const ref = table[n.ref];
    if (ref) (n.type === "scene" ? sceneEditor : stitchEditor)(box, ref, n.ref); else box.append(el("p", { class: "err" }, "no " + n.type + " " + n.ref));
  }
  if (n.type === "choice") choiceEditor(box, n, nodeIds);
  if (n.type === "ending") {
    const words = el("textarea", { rows: 3, placeholder: "the title card's words under its title, as long as they need (an epilogue); {name} and the game's words filled in", on: { change: e => { if (e.target.value.trim()) n.text = e.target.value; else delete n.text; touch(); } } });
    words.value = n.text || "";
    box.append(field("title", txt(n, "title", { w: true })), field("words", words), field("kind", sel(n, "kind", ENDS)), field("", chk(n, "short_ok", "short ok (an early death: exempt from the playtime minimum)")));
  }
  box.append(el("h2", {}, "Grow the flow"), el("div", { class: "row" }, el("span", { class: "muted" }, "add after this:"), ...["scene", "stitch", "choice", "ending"].map(t => el("button", { on: { click: () => addNode(t) } }, "+ " + t))));
  notesEditor(box, notesHost(SEL), SEL);
}
const QUICK_RESULTS = { hide: ["hidden", "found"], run: ["escaped", "caught"] };
async function quickFill(tpl, kind) {           // the blanks, with what it will build shown as it's filled
  const values = {}, lvls = Object.keys(S.levels || {}), lv = { level: (nodeRef(S.flow[SEL] || {}) || {}).level || lvls[0] };
  CTX_LEVEL = lv.level;
  const fields = tpl.blanks.map(b => Object.assign({ opt: true }, b)), prev = el("div", { class: "qprev" });
  const show = () => {
    const T = JSON.parse(JSON.stringify(S)); prev.innerHTML = "";
    const beats = kind === "task" ? (buildTask(T, tpl, values, lv).stitch.beats || []) : [buildBeat(T, tpl, values)];
    if (kind === "task" && tpl.round) prev.append(el("div", { class: "qrow" }, icon("hide", 13), ` a ${tpl.round} round: ${(QUICK_RESULTS[tpl.round] || []).join(" or ")} decides what's next`));
    for (const b of beats) prev.append(el("div", { class: "qrow" }, icon("clock", 13), el("b", {}, " When " + triggerText(b.when, CTX.name)), (b.do || []).map(a => el("div", { class: "qdo" }, "· " + actionText(a, CTX.name)))));
    if (!beats.length && !tpl.round) prev.append(el("div", { class: "kv" }, "(nothing yet)"));
  };
  const body = el("div", {}, el("p", { class: "hint" }, tpl.hint[0].toUpperCase() + tpl.hint.slice(1) + ". Leave a blank and the Problems list will say what's missing."),
    kind === "task" && lvls.length > 1 ? form([{ key: "level", label: "In the level", kind: "choice", opts: lvls }], lv, CTX, () => { CTX_LEVEL = lv.level; }) : null,
    form(fields, values, CTX, show), el("div", { class: "frm-l", style: "margin-top:12px" }, "It makes"), prev);
  body.addEventListener("input", show); body.addEventListener("change", show); show();
  const ok = await modal({ title: (kind === "task" ? "Quick task: " : "Quick beat: ") + tpl.label, body, ok: "Make it", wide: true });
  return ok ? { values, level: lv.level } : null;
}
async function quickTask(id, at, after) {
  const tpl = QUICK_TASK[id]; if (!tpl || !S) return;
  const got = await quickFill(tpl, "task"); if (!got) return;
  const r = buildTask(S, tpl, got.values, { level: got.level }), nid = r.id("n_" + tpl.id), node = { type: "stitch", ref: r.tid, next: null };
  const prevNode = after && S.flow[after];
  if (!at && BOARD) { freezeLayout(); const p = BOARD.pos[after] || { x: 0, y: 0 }; at = [Math.round(p.x + 214), Math.round(p.y + 84)]; }
  else if (at) freezeLayout();
  if (at) node.xy = at = at.map(Math.round);
  if (prevNode && "next" in prevNode) { node.next = prevNode.next || null; prevNode.next = nid; }
  S.flow[nid] = node;
  if (r.round) {                                 // what decides the way on: a result choice after the round
    const cid = r.id("n_" + tpl.id + "_result"), go = node.next || "";
    S.flow[cid] = { type: "choice", by: "result", of: nid, options: QUICK_RESULTS[r.round].map(x => ({ result: x, to: go })), xy: at ? [at[0] + 214, at[1]] : undefined };
    if (!S.flow[cid].xy) delete S.flow[cid].xy;
    node.next = cid;
  }
  SEL = nid; SELS = new Set([nid]); touch(true); renderInspector(); showStage(); if (BOARD) BOARD.center(nid);
  toast(`${tpl.label}: made. What's still blank shows in the Problems list.`, { ms: 6000 });
}
async function quickBeat(id, st) {
  const tpl = QUICK_BEAT[id]; if (!tpl) return;
  const got = await quickFill(tpl, "beat"); if (!got) return;
  st.beats = st.beats || []; st.beats.push(buildBeat(S, tpl, got.values)); touch(); renderInspector();
  setTimeout(() => flashIn(`[data-beat="${st.beats[st.beats.length - 1].id}"]`), 50);
}
function renameNode(old) {
  const nid = prompt("New id for this node", old); if (!nid || nid === old || S.flow[nid]) return;
  S.flow[nid] = S.flow[old]; delete S.flow[old];
  for (const m of Object.values(S.flow)) { if (m.next === old) m.next = nid; for (const o of m.options || []) if (o.to === old) o.to = nid; if (m.of === old) m.of = nid; }
  for (const st of Object.values(S.stitches || {})) if (st.timer && st.timer.fail === old) st.timer.fail = nid;
  for (const it of S.interrupts || []) if (it.to === old) it.to = nid;
  for (const sc of Object.values(S.scenes || {})) for (const v of [sc, ...Object.values(sc.variants || {})]) for (const c of v.clips || []) for (const o of (c.reply && c.reply.options) || []) if (o.go && o.go.node === old) o.go.node = nid;   // answers that leave for it (§9.9)
  for (const f of S.frames || []) f.nodes = (f.nodes || []).map(n => (n === old ? nid : n));
  if (S.game.start === old) S.game.start = nid; SEL = nid; touch(); renderInspector();
}
function addNode(type) {
  const n = S.flow[SEL], nid = newId(type === "ending" ? "e_" : "n_", S.flow), cur = nodeRef(n), lvl = (cur && cur.level) || Object.keys(S.levels)[0]; let node;
  if (type === "scene") { const sid = newId("s_", S.scenes); S.scenes[sid] = { title: "New scene", level: lvl, mood: "dread", stage: {}, camera: { mode: "soft", look: castIds()[0] || null, cone: [30, 18] }, clips: [{ id: "c1", who: castIds()[0] || "", ja: "", en: "", act: "", shot: "ms", body: { block: [{ at: 0, pose: "idle" }] } }] }; node = { type, ref: sid, next: n.next || null }; }
  if (type === "stitch") { const tid = newId("t_", S.stitches); S.stitches[tid] = { title: "New task", level: lvl, goal: "", target_min: 5, beats: [{ id: "b_" + tid.slice(2) + "_start", when: { start: true }, do: [{ objective: "…" }, { done: true }] }] }; node = { type, ref: tid, next: n.next || null }; }
  if (type === "choice") node = { type, by: "act", prompt: "", options: [{ label: "A", when: { use: "" }, to: n.next || "" }, { label: "B", when: { use: "" }, to: n.next || "" }] };
  if (type === "ending") node = { type, kind: "good", title: "An ending" };
  if (BOARD && Object.values(S.flow).some(x => Array.isArray(x.xy))) { freezeLayout(); const p = BOARD.pos[SEL] || { x: 0, y: 0 }; node.xy = [Math.round(p.x + 214), Math.round(p.y + 84)]; }
  S.flow[nid] = node; if ("next" in n) n.next = nid; SEL = nid; touch(); renderInspector(); showStage(); if (BOARD) BOARD.center(nid);
}

function sceneEditor(box, sc, sid) {
  const lvl = sc.level || Object.keys(S.levels)[0]; CTX_LEVEL = lvl;
  const lv0 = sc.level || Object.keys(S.levels)[0], ft0 = flowTimes(S)[SEL];
  const setting = el("details", { class: "setting", open: localStorage.getItem("dd.settingOpen") === "1" ? true : null, on: { toggle: e => { try { localStorage.setItem("dd.settingOpen", e.target.open ? "1" : "0"); } catch (x) { } } } },
    el("summary", {}, el("b", {}, "Setting the scene"), el("span", { class: "kv" }, ` · ${lv0}${sc.view ? " · from " + sc.view : ""}${sc.stance && sc.stance !== "stand" ? " · " + sc.stance : ""}${sc.mood ? " · " + sc.mood : ""}${ft0 ? " · " + TIME_MARK[ft0.time] + " " + ft0.time : ""} · ${(sc.camera || {}).mode || "free"} camera`)));
  box.append(el("h2", {}, "Scene"), field("title", txt(sc, "title", { w: true })), setting);
  setting.append(
    field("level", sel(sc, "level", Object.keys(S.levels || {}), { after: showStage })), field("view", sel(sc, "view", spots(lvl), { title: "where the player stands", after: showStage }), "stance", sel(sc, "stance", ["stand", "crouch", "kneel", "sit", "lie", "hide"], { drop: true, title: "the player's eye height (sit: standing people loom; lie: everything looms)", after: showStage })));
  const mood = MOODS[sc.mood];
  setting.append(field("mood", sel(sc, "mood", Object.keys(MOODS), { after: renderInspector }), mood ? el("button", { on: { click: () => applyMood(sc) } }, "apply to camera and clips") : null),
    mood ? el("div", { class: "kv", style: "margin:0 0 4px 70px" }, mood.text) : null);
  // the time of day: the scene's own, or the time it was (the scene it branched from, back to the game's start)
  const ft = flowTimes(S)[SEL], was = ft && !ft.own ? ft : null, from = was && was.from !== "game" ? nodeRef(S.flow[was.from]) : null;
  const before = was ? `as before: ${was.paths.join(" or ")} (${was.from === "game" ? "the game's start" : "from " + ((from && from.title) || was.from)})` : "as before (the scene it branched from)";
  // each cast member's model: the scene's own pick, else as the flow brings it, down every branch after it (§3.1 models)
  const fm = flowModels(S)[SEL] || { before: {}, mixed: [] }, dressed = castIds().filter(cid => Object.keys((S.cast[cid] || {}).models || {}).length);
  if (dressed.length) setting.append(field("models", ...dressed.flatMap(cid => {
    const c = S.cast[cid], hold = { v: sceneModels(sc)[cid] || "" }, mixed = fm.mixed.includes(cid);
    return [el("span", { class: "kv" }, (c.name || cid) + " "), sel(hold, "v", [["default", "default"], ...Object.keys(c.models).map(k => [k, k])], {
      blank: mixed ? "as before: depends on the way you came (pick one)" : `as before: ${fm.before[cid] || "default"}`, title: "the model from this scene on; left as before, the one the scene it branched from gave",
      after: () => { if (hold.v) (sc.models = sc.models || {})[cid] = hold.v; else if (sc.models) { delete sc.models[cid]; if (!Object.keys(sc.models).length) delete sc.models; } touch(); renderInspector(); showStage(); } })];
  })));
  setting.append(field("time", sel(sc, "time", TIMES.map(t => [t, TIME_MARK[t] + " " + t]), { blank: before, drop: true, title: "day, dusk or night from this scene on; left as before, it keeps the time of the scene it branched from", after: () => { renderBoard(); renderInspector(); showStage(); } })));
  sc.camera = sc.camera || { mode: "free" };
  setting.append(field("camera", sel(sc.camera, "mode", CAMS, { blank: false }), " look ", sel(sc.camera, "look", [...castIds(), ...placed(lvl)], { nullable: true, after: showStage }),
    " cone ", el("input", { type: "number", value: (sc.camera.cone || [30, 18])[0], style: "width:52px", on: { change: e => { sc.camera.cone = [+e.target.value, (sc.camera.cone || [30, 18])[1]]; touch(); } } }), "°×",
    el("input", { type: "number", value: (sc.camera.cone || [30, 18])[1], style: "width:52px", on: { change: e => { sc.camera.cone = [(sc.camera.cone || [30, 18])[0], +e.target.value]; touch(); } } }), "°"),
    field("look", sceneLookEditor(sc, lvl)),
    field("trackers", trackersEditor(sc, lvl)),
    field("through", throughEditor(sc, lvl)),
    field("in / out", sel(sc.enter = sc.enter || Object.assign({}, BLEND), "kind", TRANS, { blank: false }), txt(sc.enter, "secs", { num: true }), " → ", sel(sc.exit = sc.exit || Object.assign({}, BLEND), "kind", TRANS, { blank: false }), txt(sc.exit, "secs", { num: true })),
    field("hold", "min ", txt(sc.hold = sc.hold || {}, "min", { num: true }), " max ", txt(sc.hold, "max", { num: true }), " s after the last clip"));
  // versions
  const vs = sc.variants ? Object.keys(sc.variants) : [];
  const vt = VTAB[sid] && sc.variants && sc.variants[VTAB[sid]] ? VTAB[sid] : (sc.pick || vs[0] || null);
  const tabs = el("div", { class: "tabs" });
  if (vs.length) {
    for (const k of vs) tabs.append(el("button", { class: k === vt ? "on" : "", on: { click: () => { VTAB[sid] = k; renderInspector(); showStage(); } } }, `${k}${k === sc.pick ? " ★" : ""} ${sc.variants[k].label || ""}`));
    tabs.append(el("button", { on: { click: () => { sc.pick = vt; touch(); renderInspector(); } } }, "★ play this one"),
      el("button", { on: { click: () => { const k = String.fromCharCode(97 + vs.length); sc.variants[k] = JSON.parse(JSON.stringify(sc.variants[vt])); sc.variants[k].label = "copy of " + vt; VTAB[sid] = k; touch(); renderInspector(); } } }, "+ variant"));
  } else tabs.append(el("button", { on: { click: () => { sc.variants = { a: { label: "first try", stage: sc.stage || {}, clips: sc.clips || [], cues: sc.cues || [] } }; delete sc.clips; delete sc.stage; delete sc.cues; sc.pick = "a"; touch(); renderInspector(); } } }, "Try variants of this scene"));
  box.append(el("h2", {}, "Versions"), tabs);
  const ver = vt ? sc.variants[vt] : sc;
  if (vt) box.append(field("label", txt(ver, "label", { w: true })));
  ver.stage = ver.stage || {};
  for (const who of castIds()) box.append(field("stage " + who, sel(ver.stage, who, spots(lvl), { blank: "(off stage)", after: () => { if (!ver.stage[who]) delete ver.stage[who]; showStage(); } })));
  // the timeline
  ver.clips = ver.clips || [];
  const pv = vt ? Object.assign({}, sc, ver) : sc;
  const tl = flowStage ? flowStage.timeline(pv) : { segs: [], total: 1 }, total = tl.total || 1;
  const bar = el("div", { class: "timeline", id: "tlbar" });
  for (const s of tl.segs) {
    if (s.type === "seam") bar.append(el("div", { class: "seam", style: `left:${s.start / total * 100}%`, title: "seam: " + s.seam.kind }));
    if (s.type === "reply") bar.append(el("div", { class: "seg", style: `left:${s.start / total * 100}%;width:${(s.end - s.start) / total * 100}%;background:#2c3f4d`, title: "reply: she waits for your answer" }, "↔"));
    if (s.type === "clip") bar.append(el("div", { class: "seg" + (s.clip.dur ? "" : " est"), style: `left:${s.start / total * 100}%;width:${s.dur / total * 100}%`, title: `${s.clip.id}: ${s.dur.toFixed(1)} s` }, s.clip.id + (s.clip.shot ? " · " + s.clip.shot : "")));
    if (s.type === "clip") {                                           // its blend in from the same actor's last clip, drawn over its start
      const prev = [...tl.segs.slice(0, tl.segs.indexOf(s))].reverse().find(p => p.type === "clip" && p.clip.who === s.clip.who), b = s.clip.body || {};
      const win = b.bridge ? +(b.bridge.secs || 0.6) : +(b.blend ?? 0.25);
      if (prev && win > 0) bar.append(el("div", { class: "blendw", style: `left:${s.start / total * 100}%;width:${Math.min(win, s.dur) / total * 100}%`, title: `${b.bridge ? "in-between" : "blend"} ${win} s from ${prev.clip.id} (${s.clip.who})` }));
    }
    if (s.type === "event") bar.append(el("div", { class: "seg ev", style: `left:${s.start / total * 100}%;width:${(s.end - s.start) / total * 100}%`, title: "event " + s.event.type }, "⚡" + s.event.type));
  }
  const starts = {}, ends = {}; for (const s of tl.segs) if (s.type === "clip") { starts[s.clip.id] = s.start; ends[s.clip.id] = s.end; }
  const rows = [-1e9, -1e9];                         // cue labels in two rows, so ones close together don't overlap
  (ver.cues || []).map((cu, i) => { const a = cu.at || {}, base = a.edge === "end" ? ends[a.clip] : starts[a.clip]; return base === undefined ? null : { cu, i, a, pct: Math.max(0, Math.min(100, (base + (+a.offset || 0)) / total * 100)) }; })
    .filter(Boolean).sort((x, y) => x.pct - y.pct).forEach(({ cu, i, a, pct }) => {
      const word = Object.keys(cu.do || {})[0] || "cue", room = word.length * 1.1 + 1.5, row = pct - rows[0] >= room ? 0 : pct - rows[1] >= room ? 1 : -1;
      if (row >= 0) rows[row] = pct;
      bar.append(el("div", { class: "cue", "data-i": i, title: `${cu.do ? actionText(cu.do, CTX.name) : "a cue"}\nat the ${a.edge || "start"} of ${a.clip}${+a.offset ? ` ${a.offset > 0 ? "+" : ""}${a.offset} s` : ""} · drag it along the clips`, style: `left:${pct}%` },
        row < 0 ? null : el("span", { style: row ? "top:-14px" : "" }, word)));
    });
  bar.append(el("div", { class: "playhead", id: "playhead", style: "left:0%" }));
  wireTimeline(bar, tl, ver, total);
  box.append(el("h2", {}, `Clips · ${total.toFixed(1)} s`), bar, faceRows(sid, ver, pv, tl, total), bodyRows(sid, ver, pv, tl, total), el("div", { class: "kv" }, "click or drag on it to scrub · drag a cue along it: it rides the clip edge it's nearest (snapped onto it when close; Shift for none) · double-click to add a cue there · striped = estimated length · red = an event · light wedge = a blend in from the actor's last clip · under it a face row per character: drag an expression from the Expressions tab onto one"));
  const script = el("div", { class: "script" });
  ver.clips.forEach((c, i) => script.append(clipCard(sc, ver, c, i, lvl, sid)));
  sortable(script, ver.clips, "clip", CTX, ".clip");
  box.append(script, typeLine(sc, ver, sid), el("div", { class: "row" }, el("button", { class: "a-add big", on: { click: () => { const id = newClipId(ver), last = ver.clips[ver.clips.length - 1]; ver.clips.push({ id, who: last ? last.who : castIds()[0] || "", ja: "", en: "", act: "", shot: last ? last.shot : "mcu", seam: ver.clips.length ? { kind: "blink" } : undefined, body: { block: [{ at: 0, pose: "idle" }] } }); OPEN[sid] = { id, tab: "line" }; touch(); CTX.rerender(); } } }, icon("plus", 14), " Add a line"),
    el("button", { title: "the whole scene as a script, typed or pasted: Name: words, (acting notes); lines still there keep their takes and bodies", on: { click: () => scriptDialog(ver) } }, icon("edit", 14), " Edit as text"),
    el("span", { class: "muted" }, "one clip = one take of " + (S.game.clip_max || 10) + " s or less; long speeches are several clips joined by seams · drag a row to move it · drop a take's video on its row")));
  box.append(el("h2", {}, "Cues"), el("p", { class: "kv" }, "A command at a clip's start or end (a door slams as she turns): it rides the clip, so a longer take carries it."), cuesEditor(ver),
    el("h2", {}, "When the scene ends"), actionList(...slot(sc, "sets"), { empty: "nothing" }));
  box.append(advanced(jsonArea(ver, "cues", "cues: [{at: {clip, edge: start|end, offset}, do: {action}}]"), jsonArea(sc, "sets", "sets: actions when the scene ends")));
}
// what each actor's head follows for the whole scene (STORY_FORMAT §9.6); a clip's own look (its Camera tab) wins
function sceneLookEditor(sc, lvl) {
  const box = el("div", { class: "looks" }), onStage = new Set([sc, ...Object.values(sc.variants || {})].flatMap(v => Object.keys(v.stage || {})));
  const who = castIds().filter(c => onStage.has(c)), list = who.length ? who : castIds();
  for (const cid of list) {
    const lk = (sc.look || {})[cid] || {}, lim = lk.limit || [70, 20, 30];
    const follows = [["player", "the player"], ...Object.keys(sc.trackers || {}).map(t => [t, "tracker " + t]), ...castIds().filter(x => x !== cid).map(x => [x, (S.cast[x] || {}).name || x]), ...placed(lvl)];
    const at = el("select", {}, el("option", { value: "" }, "nothing (the body's own)"), follows.map(f => { const [v, l] = Array.isArray(f) ? f : [f, f]; return el("option", { value: v, selected: lk.at === v }, l); }));
    const num = (v, ph, w = 46) => el("input", { type: "number", value: v ?? "", placeholder: ph, style: `width:${w}px` });
    const yaw = num(lim[0], "70"), up = num(lim[1], "20"), down = num(lim[2], "30"), lag = num(lk.lag, "0.25"), wgt = num(lk.w, "1");
    const past = el("select", {}, ["hold", "snap"].map(x => el("option", { value: x, selected: (lk.past || "hold") === x }, x)));
    const row = el("div", { class: "cuerow", title: "the head turns toward it within the limits; the turn shared down the spine" }, el("b", { style: `color:${whoColor(cid)};min-width:52px` }, (S.cast[cid] || {}).name || cid), "follows", at,
      "yaw ±", yaw, "up", up, "down", down, "past", past, "lag", lag, "w", wgt);
    row.addEventListener("change", () => {
      if (!at.value) { if (sc.look) { delete sc.look[cid]; if (!Object.keys(sc.look).length) delete sc.look; } }
      else {
        const o = { at: at.value, limit: [+yaw.value || 70, +up.value || 20, +down.value || 30], past: past.value };
        if (lag.value !== "") o.lag = +lag.value; if (wgt.value !== "") o.w = +wgt.value;
        sc.look = sc.look || {}; sc.look[cid] = o;
      }
      touch();
    });
    box.append(row);
  }
  return box;
}
// invisible boxes a head can follow: a height, and keys that ride clip edges (a spot, a thing or a point)
function trackersEditor(sc, lvl) {
  const box = el("div", { class: "trackers" }), clips = (version(sc).clips || []).map(c => c.id), spotsHere = placed(lvl);
  const redo = () => { touch(); CTX.rerender(); };
  for (const [tid, tr] of Object.entries(sc.trackers || {})) {
    const keys = tr.keys = tr.keys || [];
    const card = el("div", { class: "trk" }, el("div", { class: "cuerow" }, icon("target", 14), el("b", {}, tid), "height", txt(tr, "height", { num: true, step: "0.1", style: "width:56px" }), "m",
      el("span", { class: "grow" }), el("button", { class: "ghost", title: "remove this tracker", on: { click: () => { delete sc.trackers[tid]; if (!Object.keys(sc.trackers).length) delete sc.trackers; redo(); } } }, icon("x", 13))));
    keys.forEach((k, i) => {
      const pt = Array.isArray(k.to), to = el("select", { on: { change: e => { if (e.target.value === "__xyz") k.to = [0, 0, 1]; else k.to = e.target.value; redo(); } } },
        el("option", { value: "" }, "choose…"), spotsHere.map(x => el("option", { value: x, selected: k.to === x }, x)), el("option", { value: "__xyz", selected: pt }, "a point (x, y, z)…"));
      card.append(el("div", { class: "cuerow" }, el("span", { class: "kv" }, "on"), sel(k, "clip", clips, { blank: false }), "at", txt(k, "at", { num: true, step: "0.1", style: "width:52px" }), "of it, at", to,
        pt ? el("input", { value: k.to.join(", "), style: "width:120px", title: "metres in the level: x east, y north, z up", on: { change: e => { const v = e.target.value.split(/[\s,]+/).filter(Boolean).map(Number); if (v.length === 3 && v.every(x => !isNaN(x))) { k.to = v; touch(); } } } }) : null,
        el("button", { class: "ghost", title: "remove this key", on: { click: () => { keys.splice(i, 1); redo(); } } }, icon("x", 13))));
    });
    card.append(el("button", { class: "a-add", on: { click: () => { keys.push({ clip: clips[0] || "c1", at: keys.length ? 1 : 0, to: spotsHere[0] || [0, 0, 1] }); redo(); } } }, icon("plus", 13), " key"));
    box.append(card);
  }
  box.append(el("button", { class: "a-add", title: "an invisible box a head can follow (STORY_FORMAT §9.6); the stage shows it as a small blue wire box", on: { click: () => {
    sc.trackers = sc.trackers || {}; let n = 1; while (sc.trackers["t_track" + n]) n++;
    sc.trackers["t_track" + n] = { height: 1.6, keys: [{ clip: clips[0] || "c1", at: 0, to: spotsHere[0] || [0, 0, 1] }] }; redo();
  } } }, icon("plus", 13), " tracker"));
  return box;
}
// the props the camera sees through (a locker's slats): chips, picked from what's placed
function throughEditor(sc, lvl) {
  const cam = sc.camera, list = cam.through || [], box = el("span", { class: "chips" });
  list.forEach((t, i) => box.append(el("span", { class: "chip" }, t, el("button", { class: "x", on: { click: () => { list.splice(i, 1); if (!list.length) delete cam.through; touch(); CTX.rerender(); } } }, "×"))));
  box.append(el("select", { title: "the camera sees through these (a locker's slats)", on: { change: e => { if (e.target.value) { cam.through = [...list, e.target.value]; touch(); CTX.rerender(); } } } },
    el("option", { value: "" }, list.length ? "+ another" : "+ a prop the camera sees through"), placed(lvl).filter(x => !list.includes(x)).map(x => el("option", { value: x }, x))));
  return box;
}
// the scene's timeline by mouse: a click or a drag scrubs the stage; a cue dragged along it rides the clip edge it's
// dropped nearest (snapped onto the edge when close, else an offset from it: never a time of its own); a double-click
// adds a cue there (what it does from the palette)
// a timeline's clip edges and the nearest one to a moment (a start before an end at the same moment): what a cue or a
// face placed by mouse rides, snapped onto it within 8 pixels of the box it's on (Shift: never), else an offset from it
function edgeFinder(tl, total) {
  const edges = []; for (const s of tl.segs) if (s.type === "clip" && !s.answer) edges.push({ t: s.start, clip: s.clip.id, edge: "start" }, { t: s.end, clip: s.clip.id, edge: "end" });
  if (!edges.length) return null;
  const near = (T, free, px) => {
    let best = edges[0]; for (const e of edges) { const d = Math.abs(T - e.t) - Math.abs(T - best.t); if (d < -1e-6 || (Math.abs(d) <= 1e-6 && e.edge === "start" && best.edge === "end")) best = e; }
    const tol = free ? 0 : 8 / Math.max(1, px) * total, off = Math.abs(T - best.t) < tol ? 0 : +(T - best.t).toFixed(1);
    return { clip: best.clip, edge: best.edge, offset: off, t: best.t + off };
  };
  return { edges, near,
    tAt: (box, x) => { const r = box.getBoundingClientRect(); return Math.max(0, Math.min(total, (x - r.left) / r.width * total)); },
    label: at => `the ${at.edge || "start"} of ${at.clip}${+at.offset ? ` ${at.offset > 0 ? "+" : "−"} ${Math.abs(at.offset)} s` : ""}`,
    atOf: at => Object.assign({ clip: at.clip, edge: at.edge }, at.offset ? { offset: at.offset } : {}) };
}
function wireTimeline(bar, tl, ver, total) {
  const E = edgeFinder(tl, total); if (!E) return;
  const tAt = x => E.tAt(bar, x), near = (T, free) => E.near(T, free, bar.getBoundingClientRect().width), label = E.label;
  bar.addEventListener("mousedown", e => {
    if (e.button !== 0) return;
    const cue = e.target.closest(".cue");
    if (cue) {
      e.preventDefault(); e.stopPropagation();
      const cu = (ver.cues || [])[+cue.dataset.i]; if (!cu) return;
      const tip = el("div", { class: "cuetip" }); let at = null;
      const move = ev => { at = near(tAt(ev.clientX), ev.shiftKey); cue.style.left = tip.style.left = (at.t / total * 100) + "%"; tip.textContent = label(at); if (!tip.isConnected) bar.append(tip); };
      const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); tip.remove();
        if (at) { cu.at = { clip: at.clip, edge: at.edge }; if (at.offset) cu.at.offset = at.offset; touch(); CTX.rerender(); } else flashIn(`[data-cuerow="${cue.dataset.i}"]`); };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); return;
    }
    const go = ev => { const T = tAt(ev.clientX); stopPlay(); $("#scrub").value = T; scrubTo(T); };
    go(e); const up = () => { window.removeEventListener("mousemove", go); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", go); window.addEventListener("mouseup", up);
  });
  bar.addEventListener("dblclick", async e => {
    if (e.target.closest(".cue")) return;
    const at = near(tAt(e.clientX), e.shiftKey), verb = await pickVerb("action", `A cue at ${label(at)}: what happens?`); if (!verb) return;
    const d = ACTION[verb], a = d.make(), v = d.fields.length ? await editAction(a, CTX, { isNew: true }) : a; if (!v) return;
    (ver.cues = ver.cues || []).push({ at: Object.assign({ clip: at.clip, edge: at.edge }, at.offset ? { offset: at.offset } : {}), do: v }); touch(); CTX.rerender();
  });
}
// a scene's body tracks (STORY_FORMAT §3.8, HANDOFF_DIRECTOR_TODO §4): a row per character, each of their behave cues a
// block from its clip edge to the next one or the shot's end: what Play's behaviour has them do from there (stand at a
// spot, sit, walk to a spot and stay, a route round and round, off), over whatever their clips' bodies did. Dragged
// along, a block rides the nearest clip edge; a click opens it; a double-click adds one there
const BODYROWS = {};
function behaveWords(a) {
  const m = a.motion ? ` ↻ ${a.motion}` : "", as = a.as || "idle";
  return (as === "idle" ? `stand${a.at ? " at " + a.at : ""}${a.pose && a.pose !== "idle" ? ", " + a.pose : ""}` : as === "sit" ? `sit${a.at ? " at " + a.at : ""}` :
    as === "go" ? `→ ${a.to || "…"}${(a.via || []).length ? " via " + a.via.join(", ") : ""}${a.then === "sit" ? ", sits" : ""}` : as === "path" ? `route ${Array.isArray(a.route) ? a.route.join(" › ") : a.route || "…"}${a.mode ? " (" + a.mode + ")" : ""}` :
    as === "patrol" ? `patrol ${(a.routes || []).join(", ")}` : as === "off" ? "off the stage" : as) + m;
}
function bodyRows(sid, ver, pv, tl, total) {
  const box = el("div", { class: "facerows bodyrows" }), E = edgeFinder(tl, total); if (!E || !S.cast) return box;
  const cues = ver.cues || [], name = w => (S.cast[w] || {}).name || w;
  const mine = w => cues.map((cu, i) => ({ cu, i, t: edgeTime(tl.segs, cu.at) })).filter(x => x.cu.do && x.cu.do.behave === w && x.t !== undefined).sort((x, y) => x.t - y.t);
  const rows = [...new Set([...Object.keys(pv.stage || {}), ...cues.filter(cu => cu.do && typeof cu.do.behave === "string").map(cu => cu.do.behave), ...(BODYROWS[sid] || [])])].filter(w => S.cast[w]);
  for (const w of rows) {
    const track = el("div", { class: "ftrack btrack", "data-who": w, title: `${name(w)}'s body: double-click where she starts something (standing at a spot, sitting, walking to a spot, a route); her clips' bodies play till then` },
      el("span", { class: "fwho", style: `color:${whoColor(w)}` }, name(w) + " · body"));
    const list = mine(w);
    list.forEach((x, k) => {
      const t1 = k + 1 < list.length ? list[k + 1].t : total, wd = Math.max(1e-3, t1 - x.t);
      track.append(el("div", { class: "fblk bblk", "data-i": x.i, title: `${actionText(x.cu.do, CTX.name)}\nfrom ${E.label(x.cu.at || {})} till ${k + 1 < list.length ? "the next" : "the shot's end"} · click: open · drag: along the clips`,
        style: `left:${x.t / total * 100}%;width:${wd / total * 100}%` }, el("span", {}, behaveWords(x.cu.do))));
    });
    track.addEventListener("dblclick", async e => {
      if (e.target.closest(".fblk")) return;
      const at = E.near(E.tAt(track, e.clientX), e.shiftKey, track.getBoundingClientRect().width);
      const a = { behave: w, as: "idle" }; if ((pv.stage || {})[w]) a.at = pv.stage[w];
      const v = await editAction(a, CTX, { isNew: true }); if (!v) return;
      (ver.cues = ver.cues || []).push({ at: E.atOf(at), do: v }); touch(); CTX.rerender();
    });
    track.addEventListener("mousedown", e => {        // a block dragged along the clips (it rides the edge it's dropped nearest), or clicked open
      const b = e.target.closest(".bblk"); if (!b || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const cu = cues[+b.dataset.i]; if (!cu) return;
      const x0 = e.clientX, grab = E.tAt(track, x0) - (edgeTime(tl.segs, cu.at) || 0), tip = el("div", { class: "cuetip" }); let at = null;
      const move = ev => {
        if (!at && Math.abs(ev.clientX - x0) < 4) return;
        at = E.near(Math.max(0, E.tAt(track, ev.clientX) - grab), ev.shiftKey, track.getBoundingClientRect().width);
        b.style.left = tip.style.left = (at.t / total * 100) + "%"; tip.textContent = E.label(at); if (!tip.isConnected) track.append(tip);
      };
      const up = async () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); tip.remove();
        if (at) { cu.at = E.atOf(at); touch(); CTX.rerender(); return; }
        const v = await editAction(cu.do, CTX); if (v) { cu.do = v; touch(); CTX.rerender(); } };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    });
    box.append(track);
  }
  const others = castIds().filter(c => !rows.includes(c));
  if (others.length) box.append(el("select", { class: "fadd", title: "a body row for someone not on this scene's stage (she can walk in)", on: { change: e => { if (!e.target.value) return; (BODYROWS[sid] = BODYROWS[sid] || []).push(e.target.value); CTX.rerender(); } } },
    el("option", { value: "" }, "+ a body row for…"), others.map(c => el("option", { value: c }, name(c)))));
  return box;
}
// a scene's face rows (EXPRESSIONS_PLAN §2, STORY_FORMAT §3.7): a row per character on its stage, under the clips. An
// expression dragged from the Expressions tab lands where it's dropped, riding the nearest clip edge as a cue does
// (never a time of its own); a block dragged along moves it; a click opens its settings under the rows. A block is
// what plays: its own length (or stretched to its secs), a loop until the next one takes over, its fades in and out
// (the darker ends); where nothing is placed the face is at rest
let EXLIST = null, EXBY = null;                        // the library's cards (names, lengths, loops), fetched again when it changes
const FACETRIED = new Set(), FACEROWS = {}, FACESEL = {};   // expressions asked for once; per scene, rows added by hand and the placement open
function exprList() { return EXLIST || (EXLIST = api("/api/expressions").then(r => r.expressions || []).catch(() => []).then(l => { EXBY = Object.fromEntries(l.map(x => [x.id, x])); return l; })); }
function libraryChanged() { EXLIST = EXBY = null; FACETRIED.clear(); forgetFace(); }
async function pickExpr(title) {                       // an expression from the library, by name (loops marked)
  const list = await exprList();
  if (!list.length) { toast("No expressions yet: Import a video of a face in the Expressions tab."); return null; }
  let close = null;
  const find = el("input", { type: "search", placeholder: "find…", on: { input: () => { const q = find.value.trim().toLowerCase(); for (const b of box.children) b.hidden = !!q && !b.textContent.toLowerCase().includes(q); } } });
  const box = el("div", { class: "xp-pickl" }, list.map(x => el("button", { class: "ghost", "data-id": x.id, title: `${(+x.secs || 0).toFixed(1)} s${x.loop ? ", a loop" : ""}`, on: { click: () => close(x.id) } }, (x.loop ? "↻ " : "") + x.name)));
  const r = await modal({ title, body: el("div", {}, find, box), ok: null, ready: c => { close = c; } });
  return typeof r === "string" ? r : null;
}
function faceRows(sid, ver, pv, tl, total) {
  const box = el("div", { class: "facerows" }), E = edgeFinder(tl, total); if (!E || !S.cast) return box;
  const shown = pv.faces || [], own = () => (ver.faces = ver.faces || JSON.parse(JSON.stringify(shown)));   // a variant's own list: the scene's copied in on its first change
  if (!EXBY) exprList().then(() => CTX.rerender());
  const want = shown.map(p => p.expr).filter(id => id && !FACES.lib[id] && !FACETRIED.has(id));
  if (want.length) { want.forEach(id => FACETRIED.add(id)); loadFaces(shown).then(() => { CTX.rerender(); if (!PLAY) scrubTo(+$("#scrub").value || 0); }); }
  const rows = [...new Set([...Object.keys(pv.stage || {}), ...shown.map(f => f.who), ...(FACEROWS[sid] || [])])].filter(w => S.cast[w]);
  const plan = facePlanOf(pv, tl), ends = new Map(); for (const l of Object.values(plan)) for (const it of l) ends.set(it.p, it);
  const name = w => (S.cast[w] || {}).name || w;
  for (const w of rows) {
    const track = el("div", { class: "ftrack", "data-who": w, title: `${name(w)}'s face: drop an expression from the Expressions tab here` }, el("span", { class: "fwho", style: `color:${whoColor(w)}` }, name(w)));
    shown.forEach((p, i) => {
      if (p.who !== w) return;
      const s0 = edgeTime(tl.segs, p.at); if (s0 === undefined) return;
      const it = ends.get(p), x = (EXBY || {})[p.expr] || {}, loop = !!(p.loop ?? x.loop);
      const e0 = Math.min(total, it ? it.E : s0 + (+p.secs || +x.secs || 2)), wd = Math.max(1e-3, e0 - s0);
      const fin = it ? it.fin : +(p.in ?? 0.25), fout = it ? it.fout : +(p.out ?? 0.3), gone = EXBY && !x.id;
      track.append(el("div", { class: "fblk" + (loop ? " loop" : "") + (FACESEL[sid] === i ? " sel" : "") + (gone ? " gone" : ""), "data-i": i, "data-expr": p.expr,
        title: `${x.name || p.expr}${loop ? " (a loop)" : ""}${gone ? ": not in the library" : ""}\nfrom ${E.label(p.at || {})} · ${wd.toFixed(1)} s\nclick: its settings · drag: along the clips`,
        style: `left:${s0 / total * 100}%;width:${wd / total * 100}%` },
        el("i", { class: "fin", style: `width:${Math.min(100, fin / wd * 100)}%` }), el("i", { class: "fout", style: `width:${Math.min(100, fout / wd * 100)}%` }),
        el("span", {}, (x.name || p.expr) + (loop ? " ↻" : ""))));
    });
    track.addEventListener("dblclick", async e => {     // or picked from a list, placed where it's double-clicked
      if (e.target.closest(".fblk")) return;
      const at = E.near(E.tAt(track, e.clientX), e.shiftKey, track.getBoundingClientRect().width), id = await pickExpr(`${name(w)}'s face from ${E.label(at)}`); if (!id) return;
      const L = own(); L.push({ who: w, expr: id, at: E.atOf(at) }); FACESEL[sid] = L.length - 1; touch(); CTX.rerender();
    });
    track.addEventListener("dragover", e => { if (![...e.dataTransfer.types].includes(DRAG_TYPE)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; track.classList.add("over"); });
    track.addEventListener("dragleave", () => track.classList.remove("over"));
    track.addEventListener("drop", e => {
      track.classList.remove("over"); const id = e.dataTransfer.getData(DRAG_TYPE); if (!id) return; e.preventDefault();
      const at = E.near(E.tAt(track, e.clientX), e.shiftKey, track.getBoundingClientRect().width), L = own();
      L.push({ who: w, expr: id, at: E.atOf(at) }); FACESEL[sid] = L.length - 1; touch(); CTX.rerender();
    });
    track.addEventListener("mousedown", e => {        // a block dragged along the clips (it rides the edge it's dropped nearest), or clicked open
      const b = e.target.closest(".fblk"); if (!b || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const i = +b.dataset.i, x0 = e.clientX, grab = E.tAt(track, x0) - (edgeTime(tl.segs, shown[i].at) || 0), tip = el("div", { class: "cuetip" }); let at = null;
      const move = ev => {
        if (!at && Math.abs(ev.clientX - x0) < 4) return;
        at = E.near(Math.max(0, E.tAt(track, ev.clientX) - grab), ev.shiftKey, track.getBoundingClientRect().width);
        b.style.left = tip.style.left = (at.t / total * 100) + "%"; tip.textContent = E.label(at); if (!tip.isConnected) track.append(tip);
      };
      const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); tip.remove();
        if (at) { own()[i].at = E.atOf(at); FACESEL[sid] = i; touch(); } else FACESEL[sid] = FACESEL[sid] === i ? null : i;
        CTX.rerender(); };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    });
    box.append(track);
  }
  const others = castIds().filter(c => !rows.includes(c));
  if (others.length) box.append(el("select", { class: "fadd", title: "a face row for someone not on this scene's stage", on: { change: e => { if (!e.target.value) return; (FACEROWS[sid] = FACEROWS[sid] || []).push(e.target.value); CTX.rerender(); } } },
    el("option", { value: "" }, "+ a face row for…"), others.map(c => el("option", { value: c }, name(c)))));
  const i = FACESEL[sid], p = shown[i];
  if (p) {                                             // the open placement's settings
    const at = p.at || {}, x = (EXBY || {})[p.expr] || {};
    const set = (k, v) => { const q = own()[i]; if (v === "" || v === null || v === undefined || Number.isNaN(v)) delete q[k]; else q[k] = v; touch(); CTX.rerender(); };
    const setAt = (k, v) => { const q = own()[i]; q.at = Object.assign({}, q.at, { [k]: v }); if (!q.at.offset) delete q.at.offset; touch(); CTX.rerender(); };
    const num = (k, ph, step, title) => el("input", { type: "number", step, min: "0", value: p[k] ?? "", placeholder: ph, title, style: "width:58px", on: { change: e => set(k, e.target.value === "" ? "" : +e.target.value) } });
    const pick = el("select", { on: { change: e => set("expr", e.target.value) } }, (EXBY && !EXBY[p.expr] ? [el("option", { value: p.expr, selected: true }, p.expr + " (not in the library)")] : []),
      Object.values(EXBY || {}).map(y => el("option", { value: y.id, selected: y.id === p.expr }, y.name + (y.loop ? " ↻" : ""))));
    const loop = el("input", { type: "checkbox", checked: !!(p.loop ?? x.loop), on: { change: e => set("loop", e.target.checked === !!x.loop ? undefined : e.target.checked) } });
    box.append(el("div", { class: "cuerow fform" }, el("b", { style: `color:${whoColor(p.who)}` }, name(p.who)), "wears", pick, "from the",
      el("select", { on: { change: e => setAt("edge", e.target.value) } }, ["start", "end"].map(v => el("option", { value: v, selected: (at.edge || "start") === v }, v))), "of",
      el("select", { on: { change: e => setAt("clip", e.target.value) } }, (pv.clips || []).map(c => el("option", { value: c.id, selected: at.clip === c.id }, `${c.id}: ${(c.en || c.ja || "").slice(0, 24)}`))),
      el("input", { type: "number", step: "0.1", value: at.offset ?? "", placeholder: "0", title: "seconds after it (or before, negative)", style: "width:58px", on: { change: e => setAt("offset", +e.target.value || 0) } }), "s ·",
      "length", num("secs", "its own", "0.1", "seconds on the row: a stretched expression, or how long a loop runs (blank: its own length; a loop until the next one)"), "s",
      el("label", { class: "kv", title: "played over and over (a loop card loops by itself)" }, loop, " loop"),
      "· blend in", num("in", "0.25", "0.05", "seconds it fades in over (from rest, or from the one before)"), "out", num("out", "0.3", "0.05", "seconds it fades out over (into rest; one that runs into the next crossfades over the next one's blend in)"),
      "· weight", num("w", "1", "0.05", "how strongly it shows (0 to 2)"), "speed", num("speed", "1", "0.05", "faster or slower than its length"),
      el("button", { class: "ghost", title: "take it off the row", on: { click: () => { const L = own(); L.splice(i, 1); if (!L.length) delete ver.faces; FACESEL[sid] = null; touch(); CTX.rerender(); } } }, icon("x", 14))),
      condRow(p, CTX, "worn only if", { own: () => own()[i] }));   // his version and hers at the same lines (§9.14)
  }
  return box;
}
function cuesEditor(ver) {
  const box = el("div", {}), cues = ver.cues || [], ids = (ver.clips || []).map(c => [c.id, `${c.id}: ${(c.en || c.ja || "").slice(0, 28)}`]);
  cues.forEach((cu, i) => {
    cu.at = cu.at || { clip: (ver.clips[0] || {}).id, edge: "start" };
    const list = [cu.do];                              // one command, edited as a list of one
    const one = actionList(list, Object.assign({}, CTX, { changed() { cu.do = list[0]; if (!cu.do) cues.splice(i, 1); if (!cues.length) delete ver.cues; touch(); } }), { empty: "no command" });
    one.querySelector(".a-add") && list.length && one.querySelector(".a-add").remove();
    box.append(el("div", { class: "cuerow", "data-cuerow": i }, "at the", sel(cu.at, "edge", [["start", "start"], ["end", "end"]], { blank: false }), "of", sel(cu.at, "clip", ids, { blank: false, after: () => CTX.rerender() }),
      txt(cu.at, "offset", { num: true, step: "0.1", ph: "0", style: "width:58px", title: "seconds after (or before, negative)" }), "s:", el("div", { style: "flex:1;min-width:260px" }, one),
      el("button", { class: "ghost", title: "delete this cue", on: { click: () => { cues.splice(i, 1); if (!cues.length) delete ver.cues; touch(); CTX.rerender(); } } }, icon("x", 14))));
  });
  box.append(el("button", { class: "a-add", on: { click: () => { ver.cues = cues; cues.push({ at: { clip: (ver.clips[0] || {}).id, edge: "start", offset: 0 }, do: { sound: "" } }); touch(); CTX.rerender(); } } }, icon("plus", 14), " Add a cue"));
  return box;
}
function applyMood(sc) {
  const m = MOODS[sc.mood]; if (!m) return;
  sc.camera = Object.assign(sc.camera || {}, { cone: m.cone });
  for (const ver of [sc, ...Object.values(sc.variants || {})]) for (const c of ver.clips || []) {
    if (!c.shot) c.shot = m.shot;
    c.cam = c.cam || {};
    if (m.push && c.cam.push === undefined) c.cam.push = m.push;
    if (m.shake && c.cam.shake === undefined) c.cam.shake = m.shake;
    if (!Object.keys(c.cam).length) delete c.cam;
  }
  touch(); renderInspector();
}
function copyText(t, btn) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { if (btn) { const o = btn.textContent; btn.textContent = "copied"; setTimeout(() => btn.textContent = o, 900); } }, () => prompt("Copy:", t)); }
// format 3: the Japanese pass and the MiniMax take (docs/STORY_FORMAT.md §9.2, docs/VOICES.md)
function takeSec(c) {
  const sec = el("div", { class: "sec" });
  sec.append(txt(c, "ja_note", { w: true, ph: "delivery: how it's said, as a film director would give it", drop: true }),
    txt(c, "zh", { w: true, ph: "中文字幕 (from the Japanese)", drop: true }),
    txt(c, "en_draft", { w: true, ph: "the English draft (kept for reference)", drop: true }),
    el("div", { class: "row" }, el("span", { class: "lab" }, "MiniMax"), txt(c, "expr", { ph: "expression, as visible movement: a frightened expression, eyes wide…", drop: true, style: "flex:1", after: renderInspector }),
      sel(c, "voice", VOICES, { blank: "says", drop: true, after: renderInspector })));
  const p = minimaxPrompt(c, S.cast), b = el("button", { title: "copy the prompt for MiniMax", on: { click: e => copyText(p, e.target) } }, "copy");
  sec.append(el("div", { class: "row" }, el("code", { style: "flex:1;white-space:normal;font-size:12px" }, p), b));
  return sec;
}
function takeRow(sc, c, sid) {             // the take against the director's action: trim the dead air, set the action's length
  const k = sc.variants ? (VTAB[sid] || sc.pick) : null, t = TAKES[takeId(sid, k, c.id)];
  c.trim = c.trim || {}; c.body = c.body || {};
  const r = el("div", { class: "sec row" }, el("span", { class: "lab" }, "take"), el("span", { class: t ? "ok" : "muted", title: takeId(sid, k, c.id) }, t ? "✓ " + t.name : "none yet"),
    t ? el("button", { on: { click: () => { const v = takePip("#stageBox"); playTake("#stageBox", sid, k, c, true); const end = clipSecs(c); setTimeout(() => v.pause(), end * 1000); } } }, "▶ take") : null,
    "trim in", txt(c.trim, "in", { num: true, step: "0.05", style: "width:64px", title: "seconds of dead air cut from the take's start", after: renderInspector }),
    "out", txt(c.trim, "out", { num: true, step: "0.05", style: "width:64px", title: "seconds cut from the take's end", after: renderInspector }),
    el("span", { class: "lab" }, "action"), txt(c.body, "secs", { num: true, step: "0.1", ph: clipSecs(c).toFixed(1), style: "width:56px", title: "the body's length against the take (empty: the clip's length)" }),
    "delay", txt(c.body, "delay", { num: true, step: "0.1", ph: "0", style: "width:52px", title: "the body starts this long after the take" }));
  if (!Object.keys(c.trim).length) delete c.trim;
  return r;
}
// a take's waveform with its trims as handles, after an audio editor's: drag the in and the out over the dead air (they
// snap to where the voice starts and stops, the dashed lines; Shift for none), the body's span under it (drag it to start
// the action later, its right end to make it shorter); a double-click plays the take from there to the out
function waveEditor(c, t) {
  const H = 64, BODY = 12, cv = el("canvas", { class: "wave", title: "drag the in or the out (Shift: no snapping) · drag the body's bar, or its right end · double-click to play from there" });
  const info = el("div", { class: "kv wave-i" }, "reading the take…"), box = el("div", { class: "wavebox" }, cv, info);
  let w = null, cw = 600, playT = null;
  const dpr = Math.min(2, window.devicePixelRatio || 1), tr = () => c.trim || {};
  const X = s => s / w.dur * cw, T = x => Math.max(0, Math.min(w.dur, x / cw * w.dur));
  const span = () => { const a = +(tr().in || 0), b = w.dur - +(tr().out || 0), bd = c.body || {}, len = b - a, bs = a + Math.min(len, +(bd.delay || 0)); return { a, b, len, bs, be: bs + (+bd.secs || len) }; };
  const draw = () => {
    if (!w) return; cw = cv.clientWidth || 600; const ch = H + BODY + 8;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#151518"; g.fillRect(0, 0, cw, ch);
    const { a, b, bs, be } = span(), mid = H / 2;
    for (let i = 0; i < cw; i++) { const t0 = i / cw * w.dur, p = w.peaks[Math.min(w.peaks.length - 1, Math.floor(i / cw * w.peaks.length))] || 0, hh = Math.max(0.5, p * (H / 2 - 3)); g.fillStyle = t0 >= a && t0 <= b ? "#d39a45" : "#5b4a33"; g.fillRect(i, mid - hh, 1, hh * 2); }
    g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(0, 0, X(a), H); g.fillRect(X(b), 0, cw - X(b), H);
    g.setLineDash([3, 3]); g.strokeStyle = "#6fb3d9"; g.beginPath();
    for (const v of [w.lead, w.dur - w.tail]) { g.moveTo(Math.round(X(v)) + 0.5, 0); g.lineTo(Math.round(X(v)) + 0.5, H); }
    g.stroke(); g.setLineDash([]);
    for (const x of [X(a), X(b)]) { g.fillStyle = "#f0c27a"; g.fillRect(x - 1.5, 0, 3, H); g.beginPath(); g.moveTo(x - 6, 0); g.lineTo(x + 6, 0); g.lineTo(x, 8); g.fill(); }
    const x0 = X(bs), x1 = Math.min(X(be), X(b)), over = be > b + 0.01;
    g.fillStyle = "#3d2e5c"; g.fillRect(x0, H + 4, Math.max(2, x1 - x0), BODY); g.strokeStyle = "#8a6cc8"; g.strokeRect(x0 + 0.5, H + 4.5, Math.max(2, x1 - x0) - 1, BODY - 1);
    g.fillStyle = "#cbb8f0"; g.font = "10px system-ui,sans-serif"; g.fillText(over ? "body (cut at the out)" : "body", x0 + 4, H + 13.5);
    g.fillStyle = "#8a6cc8"; g.fillRect(x1 - 3, H + 4, 3, BODY);
    if (playT !== null) { g.fillStyle = "#fff"; g.fillRect(X(playT), 0, 1.5, H); }
    info.textContent = `the take ${w.dur.toFixed(2)} s · in ${a.toFixed(2)} · out ${(w.dur - b).toFixed(2)} · the clip ${clipSecs(c).toFixed(2)} s · the body ${(Math.min(be, b) - bs).toFixed(2)} s, from +${(bs - a).toFixed(2)}`;
  };
  const snap = (v, list, tol) => { for (const x of list) if (Math.abs(v - x) < tol) return x; return v; };
  const apply = (kind, t2, dx, free) => {
    const tol = free ? 0 : w.dur * 8 / cw;
    if (kind === "in" || kind === "out") {
      c.trim = c.trim || {};
      if (kind === "in") { const v = +Math.max(0, snap(Math.min(t2, w.dur - +(c.trim.out || 0) - 0.1), [0, Math.max(0, w.lead - TK.padIn)], tol)).toFixed(2); if (v) c.trim.in = v; else delete c.trim.in; }
      else { const v = snap(Math.max(t2, +(c.trim.in || 0) + 0.1), [w.dur, Math.min(w.dur, w.dur - w.tail + TK.padOut)], tol), o = +Math.max(0, w.dur - v).toFixed(2); if (o) c.trim.out = o; else delete c.trim.out; }
      if (!Object.keys(c.trim).length) delete c.trim;
    } else {
      c.body = c.body || {}; const { a, b, len } = span();
      if (kind === "body") { const secs = Math.min(len, +c.body.secs || len), st = +Math.max(0, Math.min(len - 0.1, t2 - dx - a)).toFixed(2); if (st) c.body.delay = st; else delete c.body.delay; if (+c.body.secs && st + secs > len) c.body.secs = +Math.max(0.2, len - st).toFixed(2); }
      else { const st = a + +(c.body.delay || 0), v = +Math.max(0.2, snap(Math.min(b, t2), [b], tol) - st).toFixed(2); if (!c.body.delay && Math.abs(v - len) < 0.005) delete c.body.secs; else c.body.secs = v; }
    }
  };
  cv.addEventListener("mousedown", e => {
    if (!w || e.button !== 0) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, { a, b, bs, be } = span();
    let kind = null, dx = 0;
    if (y > H + 2) { if (Math.abs(x - Math.min(X(be), X(b))) < 7) kind = "bend"; else if (x >= X(bs) && x <= Math.min(X(be), X(b))) { kind = "body"; dx = T(x) - bs; } }
    else if (Math.abs(x - X(a)) < 8) kind = "in"; else if (Math.abs(x - X(b)) < 8) kind = "out";
    if (!kind) return;
    e.preventDefault();
    const move = ev => { apply(kind, T(ev.clientX - r.left), dx, ev.shiftKey); draw(); };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); touch(); renderInspector(); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  });
  cv.addEventListener("mousemove", e => { if (!w) return; const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, { a, b, bs, be } = span();
    cv.style.cursor = y > H + 2 ? (Math.abs(x - Math.min(X(be), X(b))) < 7 ? "ew-resize" : x >= X(bs) && x <= X(be) ? "grab" : "default") : (Math.abs(x - X(a)) < 8 || Math.abs(x - X(b)) < 8 ? "ew-resize" : "pointer"); });
  cv.addEventListener("dblclick", e => {                // the take from here to the out, a line running over it
    if (!w) return; const r = cv.getBoundingClientRect(), from = T(e.clientX - r.left), { b } = span(), v = takePip("#stageBox");
    if (v.dataset.src !== t.url) { v.src = t.url; v.dataset.src = t.url; }
    v.currentTime = from; v.play().catch(() => { });
    const tick = () => { if (!cv.isConnected || v.paused) { playT = null; draw(); return; } if (v.currentTime >= b) { v.pause(); playT = null; draw(); return; } playT = v.currentTime; draw(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  takeWave(t).then(x => { w = x; requestAnimationFrame(draw); }, e => { info.textContent = "couldn't read the take: " + e.message; });
  new ResizeObserver(() => draw()).observe(cv);
  return box;
}
// a scene as a script (RPG Maker's message list): each clip one row (who, the line, its shot, take, motion, event),
// dragged to reorder; the open one shows its tabs. A take's video dropped on its row is stored under its take id
const OPEN = {};                                   // per scene: the clip open in the script, and its tab
const CLIP_TABS = [["line", "Line"], ["take", "Take"], ["camera", "Camera"], ["body", "Body"], ["event", "Event"], ["reply", "Reply"]];
function clipRow(sc, ver, c, i, sid, open) {
  const max = S.game.clip_max || 10, secs = clipSecs(c), k = sc.variants ? (VTAB[sid] || sc.pick) : null, t = TAKES[takeId(sid, k, c.id)], b = c.body || {};
  const segs = b.segments || [], made = segs.filter(g => g.file && FILES[g.file]).length;
  const chips = [
    c.shot ? el("span", { class: "lchip", title: SHOTS[c.shot] ? `${SHOTS[c.shot].zone}: ${SHOTS[c.shot].use}` : "" }, c.shot.toUpperCase()) : null,
    i && c.seam ? el("span", { class: "lchip dim", title: "how the cut into this clip is hidden" }, c.seam.kind) : null,
    el("span", { class: "lchip " + (t ? "ok" : "dim"), title: t ? "take: " + t.name : "no take yet: drop its video on this row" }, icon("film", 11), t ? " ✓" : " —"),
    b.file || segs.length ? el("span", { class: "lchip " + ((b.file && FILES[b.file]) || (segs.length && made === segs.length) ? "ok" : "dim"), title: segs.length ? `${made} of ${segs.length} Kimodo segments made` : b.file }, icon("motion", 11), segs.length ? ` ${made}/${segs.length}` : " ✓") : null,
    c.event ? el("span", { class: "lchip ev", title: "an event: " + c.event.type }, icon("trick", 11), " " + c.event.type) : null,
    c.reply ? el("span", { class: "lchip rp", title: "a hanging line: the player replies" }, icon("ask", 11), " reply") : null];
  const pm = marks(c);
  if (pm) chips.unshift(el("span", { class: "lchip " + (pm.some(p => p.sev === "error") ? "bad" : "warn"), title: pm.map(p => p.text).join("\n") }, icon("alert", 11), " " + pm.length));
  const row = el("div", { class: "lrow", title: open ? "click to close" : "click to open its tabs; drop a take's video here",
    on: { click: e => { if (e.target.closest("button,select,input,.grip")) return; if (e.ctrlKey || e.metaKey || e.shiftKey) { pick("clips", c, { add: true }); return; } pick("clips", c); OPEN[sid] = open ? null : { id: c.id, tab: (OPEN[sid] || {}).tab || "line" }; CTX.rerender(); },
      contextmenu: e => { e.preventDefault(); lineMenu(e, sc, ver, c, i, sid, open); } } },
    el("span", { class: "lnum" }, i + 1),
    el("span", { class: "lpicw", title: "what the player sees on this line: click to show it on the stage", on: { click: e => { e.stopPropagation(); seekClip(c.id); } } }, pic("line", [sid, k, c.id])),
    el("span", { class: "who " + (c.who === "player" ? "pl" : "") }, face(c.who), ((S.cast || {})[c.who] || {}).name || c.who || "?"),
    el("span", { class: "ltext" }, el("span", { class: "en" }, c.en || c.ja || "(no line yet)"), c.en && c.ja ? el("span", { class: "ja" }, c.ja) : null),
    el("span", { class: "lchips" }, ...chips),
    el("span", { class: "lsecs" + (secs > max ? " err" : ""), title: secs > max ? `over ${max} s: split it into two clips` : (c.dur ? "the take's length" : "estimated") }, secs.toFixed(1) + " s"),
    el("button", { class: "ghost", title: "play from this clip", on: { click: () => playScene(sc, ver, c.id) } }, icon("play", 13)),
    el("button", { class: "ghost", title: "duplicate this clip", on: { click: () => { const cp = JSON.parse(JSON.stringify(c)); cp.id = newClipId(ver); ver.clips.splice(i + 1, 0, cp); touch(); CTX.rerender(); } } }, icon("copy", 13)),
    el("button", { class: "ghost", title: "delete this clip", on: { click: () => { if (confirm("Delete clip " + c.id + "?")) { ver.clips.splice(i, 1); touch(); CTX.rerender(); } } } }, icon("x", 13)));
  return row;
}
const CLIPS_OF = new WeakMap();                   // a line: its scene, version and scene id (for the paste)
function lineMenu(e, sc, ver, c, i, sid, open) {
  if (!picked("clips").includes(c)) pick("clips", c);
  const ls = picked("clips"), many = ls.length > 1;
  contextMenu(e.clientX, e.clientY, [
    { label: open ? "Close it" : "Open its tabs", icon: "edit", on: () => { OPEN[sid] = open ? null : { id: c.id, tab: "line" }; CTX.rerender(); } },
    { label: "Play from here", icon: "play", on: () => playScene(sc, ver, c.id) },
    "-",
    { label: many ? `Copy ${ls.length} lines` : "Copy", icon: "copy", kbd: "Ctrl+C", on: () => copyLines() },
    { label: "Paste after", icon: "plus", kbd: "Ctrl+V", disabled: !CLIP.has("clips"), on: () => pasteLines(CLIP.get(), c) },
    { label: "Duplicate", icon: "copy", kbd: "Ctrl+D", on: () => pasteLines(pack("clips", many ? ls : [c], { scene: sid }), many ? ls[ls.length - 1] : c) },
    { label: "Add a line after", icon: "plus", on: () => { const nc = { id: newClipId(ver), who: c.who, ja: "", en: "", seam: { kind: "blink" } }; ver.clips.splice(ver.clips.indexOf(c) + 1, 0, nc); OPEN[sid] = { id: nc.id, tab: "line" }; touch(); CTX.rerender(); } },
    "-",
    { label: many ? `Delete ${ls.length} lines` : "Delete", icon: "x", danger: true, on: () => { const go = many ? ls : [c]; if (!confirm(`Delete ${go.map(x => x.id).join(", ")}?`)) return; for (const x of go) ver.clips.splice(ver.clips.indexOf(x), 1); unpick(); touch(); CTX.rerender(); } }],
    many ? `${ls.length} lines` : `line ${c.id}`);
}
function copyLines() { const ls = picked("clips"); if (!ls.length) return false; const at = CLIPS_OF.get(ls[0]); return copyNow(pack("clips", ls, { scene: at ? at.sid : null }), "line"); }
function pasteLines(clip, after) {               // after a line (the last picked, or the open one), or at the end of the scene shown
  if (!clip || clip.kind !== "clips") return false;
  let at = after && CLIPS_OF.get(after);
  if (!at) { const n = S.flow[SEL]; if (!n || n.type !== "scene") return false; const sc = S.scenes[n.ref], k = sc.variants ? (VTAB[n.ref] || sc.pick) : null; at = { sc, ver: k ? sc.variants[k] : sc, sid: n.ref }; }
  const ver = at.ver; ver.clips = ver.clips || [];
  const items = pasteClips(ver, clip.items, { scene: at.sid, fromScene: clip.scene || null }), i = after ? ver.clips.indexOf(after) + 1 : ver.clips.length;
  if (i > 0) for (const x of items) if (!x.seam) x.seam = { kind: "blink" };
  ver.clips.splice(i, 0, ...items); pickAll("clips", items); touch(); CTX.rerender();
  return items.length;
}
// screenplay typing (screenplay.js): "Mari: You came." under the script adds a line, "(she steps back)" a note to the
// last one; a draft pasted there, or the whole scene as text (Edit as text), goes through a preview first
const scriptOpts = () => ({ cast: S.cast || {}, clipMax: S.game.clip_max || 10, secs: c => clipSecs(c) });
let TYPE_FOCUS = false;
function typeLine(sc, ver, sid) {
  const last = (ver.clips || [])[(ver.clips || []).length - 1], who = last ? (last.who === "player" ? "You" : ((S.cast || {})[last.who] || {}).name || last.who) : ((S.cast || {})[castIds()[0]] || {}).name || "Mari";
  const inp = el("input", { class: "typeline", placeholder: `Type a line: “${who}: what they say” · “(an acting note)” · Enter adds it · paste a whole draft`,
    on: { keydown: e => {
      if (e.key !== "Enter" || !inp.value.trim()) return; e.preventDefault();
      const t = inp.value.trim(), note = t.match(/^[(（](.*)[)）]$/);
      if (note) {                                  // a note for the line open, else the last one
        const c = (OPEN[sid] && ver.clips.find(x => x.id === OPEN[sid].id)) || ver.clips[ver.clips.length - 1]; if (!c) { status("a note needs a line before it"); return; }
        c.act = [c.act, note[1].trim()].filter(Boolean).join("; "); TYPE_FOCUS = true; touch(); CTX.rerender(); status(`the acting note on ${c.id}`); return;
      }
      const r = SCRIPT.parse(t, scriptOpts());
      if (!r.lines.length) { status(r.warns[0] || "write it as “Name: what they say”"); return; }
      ver.clips = ver.clips || [];
      for (const l of r.lines) { const c = { id: newClipId(ver), who: l.who }; for (const k of ["ja", "en", "act", "shot"]) if (l[k]) c[k] = l[k]; if (ver.clips.length) c.seam = { kind: "blink" }; c.body = { block: [{ at: 0, pose: "idle" }] }; ver.clips.push(c); }
      TYPE_FOCUS = true; touch(); CTX.rerender();
      status(r.warns.length ? r.warns.join(" · ") : `added: ${r.lines.map(l => l.en || l.ja).join(" / ")}`);
    },
    paste: e => {                                  // a draft of several lines: the preview, to add after the last line
      const t = (e.clipboardData || window.clipboardData).getData("text"); if (!/\n/.test(t.trim())) return;
      e.preventDefault(); scriptDialog(ver, SCRIPT.toText(ver.clips || [], S.cast || {}) + "\n" + t.trim());
    } } });
  if (TYPE_FOCUS) { TYPE_FOCUS = false; setTimeout(() => { inp.focus(); inp.scrollIntoView({ block: "nearest" }); }, 0); }
  return el("div", { class: "typerow" }, icon("say", 14), inp);
}
async function scriptDialog(ver, text) {
  const ta = el("textarea", { class: "scripttext", spellcheck: "false" }), prev = el("div", { class: "scriptprev" }), sum = el("div", { class: "kv" });
  ta.value = text !== undefined ? text : SCRIPT.toText(ver.clips || [], S.cast || {});
  const nid = list => { let n = (ver.clips || []).length + 1; while (list.some(c => c.id === "c" + n) || (ver.clips || []).some(c => c.id === "c" + n)) n++; return "c" + n; };
  const draw = () => {
    const r = SCRIPT.parse(ta.value, scriptOpts()), copy = JSON.parse(JSON.stringify(ver.clips || [])), a = SCRIPT.applyTo(copy, r.lines, nid);
    prev.innerHTML = "";
    for (const l of r.lines) prev.append(el("div", { class: "sp-row", style: `--who:${whoColor(l.who)}` }, el("span", { class: "who" }, face(l.who), l.who === "player" ? "you" : ((S.cast || {})[l.who] || {}).name || l.who),
      el("span", { class: "sp-t" }, el("span", {}, l.en || l.ja || ""), l.ja && l.en ? el("span", { class: "ja" }, l.ja) : null, l.act ? el("span", { class: "sp-act" }, `(${l.act})`) : null),
      l.shot ? el("span", { class: "lchip" }, l.shot.toUpperCase()) : null, l.split ? el("span", { class: "lchip dim", title: "a long line split at its sentences" }, "part " + l.split) : null,
      el("span", { class: "lsecs" }, clipSecs(l).toFixed(1) + " s")));
    const gone = (ver.clips || []).filter(c => !a.clips.some(x => x.id === c.id)), takes = gone.filter(c => TAKES[takeId(SEL_SID(), sceneK(), c.id)]);
    sum.textContent = `${r.lines.length} lines: ${a.kept} as they were · ${a.changed} with new words (their takes and bodies kept) · ${a.added} new · ${a.removed} gone` + (takes.length ? ` (${takes.map(c => c.id).join(", ")} had a take)` : "");
    for (const w of r.warns) prev.append(el("div", { class: "warnc" }, w));
    return a;
  };
  ta.addEventListener("input", draw); draw();
  const ok = await modal({ title: "The scene as a script", wide: true, ok: "Apply", body: el("div", { class: "scriptdlg" },
    el("p", { class: "hint" }, "One line a clip: “Mari: words”, or “Mari: 日本語 / English”; “(an acting note)” under a line; a shot at the end: [CU]. You, Me or I is the player. A line too long for a take is split at its sentences."),
    el("div", { class: "scriptcols" }, ta, prev), sum) });
  if (!ok) return;
  const a = draw(); ver.clips = a.clips;
  for (const c of ver.clips) if (!c.body) c.body = { block: [{ at: 0, pose: "idle" }] };
  touch(); CTX.rerender(); status(sum.textContent);
}
const SEL_SID = () => (S.flow[SEL] || {}).ref, sceneK = () => { const sc = S.scenes[SEL_SID()]; return sc && sc.variants ? (VTAB[SEL_SID()] || sc.pick) : null; };
function newClipId(ver) { let n = (ver.clips || []).length + 1; while ((ver.clips || []).some(x => x.id === "c" + n)) n++; return "c" + n; }
async function dropTake(e, sc, c, sid) {          // a take's video (or audio) dropped on its clip: Footage/<game>/<take id>.<ext>
  const f = [...(e.dataTransfer.files || [])].find(x => /\.(mp4|mov|webm|wav|mp3|m4a)$/i.test(x.name));
  if (!f) { status("drop a video or audio file (mp4, mov, webm, wav, mp3, m4a)"); return; }
  const k = sc.variants ? (VTAB[sid] || sc.pick) : null, id = takeId(sid, k, c.id), name = id + f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
  status(`saving ${f.name} as ${name}…`);
  try {
    await api(`/api/take/${encodeURIComponent(GAME)}/${encodeURIComponent(name)}`, { method: "POST", body: f });
    await loadTakes(); const t = TAKES[id]; if (t) delete WAVES[t.url];
    if (t) { try { await cleanTake(c, t); } catch (x) { } }
    touch(); CTX.rerender(); status(`take ${name} on ${c.id}: ${clipSecs(c).toFixed(1)} s`);
  } catch (x) { alert("couldn't save the take: " + x.message); }
}
async function dropLineTake(f, lid) {
  const m = f.name.match(/\.(mp4|mov|webm|wav|mp3|m4a)$/i), ln = (S.lines || {})[lid];
  if (!m || !ln) { status("drop a video or audio file (mp4, mov, webm, wav, mp3, m4a)"); return; }
  try {
    await api(`/api/take/${encodeURIComponent(GAME)}/${encodeURIComponent(lid + "." + m[1].toLowerCase())}`, { method: "POST", body: f });
    await loadTakes(); if (TAKES[lid]) delete WAVES[TAKES[lid].url]; if (TAKES[lid]) { try { await cleanTake(ln, TAKES[lid]); } catch (x) { } }
    touch(); status(`take for ${lid}: ${clipSecs(ln).toFixed(1)} s`);
  } catch (x) { alert("couldn't save the take: " + x.message); }
}
async function dropTakes(files) {                 // many takes at once (the Takes page): each matched to its clip by name
  const byId = Object.fromEntries(allClips().map(x => [x.id, x])), rows = [];
  for (const f of files) {
    const m = f.name.match(/^(.+)\.(mp4|mov|webm|wav|mp3|m4a)$/i); if (!m) { rows.push(`${f.name}: not a video or audio file`); continue; }
    const hit = byId[m[1]], lineHit = (S.lines || {})[m[1]];
    if (!hit && !lineHit) { rows.push(`${f.name}: no clip or line has that take id`); continue; }
    try {
      await api(`/api/take/${encodeURIComponent(GAME)}/${encodeURIComponent(m[1] + "." + m[2].toLowerCase())}`, { method: "POST", body: f });
      rows.push(`${f.name}: stored`);
    } catch (x) { rows.push(`${f.name}: ${x.message}`); }
  }
  await loadTakes();
  for (const f of files) { const id = f.name.replace(/\.[^.]+$/, ""); if (TAKES[id]) delete WAVES[TAKES[id].url]; }
  for (const f of files) { const id = f.name.replace(/\.[^.]+$/, ""), hit = byId[id]; if (hit && TAKES[id]) try { await cleanTake(hit.c, TAKES[id]); } catch (x) { } }
  touch(); renderClips(); status(rows.filter(r => r.endsWith("stored")).length + " takes stored");
  if (rows.some(r => !r.endsWith("stored"))) alert(rows.join("\n"));
}
async function cleanTake(c, t, keepTrim) {        // the take's length and the dead air at either end, into dur and trim
  const m = await measureTake(t); c.dur = m.dur;
  if (!(keepTrim && c.trim)) { const tr = {}, a = +(m.lead - TK.padIn).toFixed(2), b = +(m.tail - TK.padOut).toFixed(2); if (a >= TK.min) tr.in = a; if (b >= TK.min) tr.out = b; if (Object.keys(tr).length) c.trim = tr; else delete c.trim; }
  return m;
}
function clipCard(sc, ver, c, i, lvl, sid) {
  const max = S.game.clip_max || 10, over = clipSecs(c) > max, open = !!(OPEN[sid] && OPEN[sid].id === c.id);
  if (i) c.seam = c.seam || { kind: "blink" };
  const card = el("div", { class: "clip line" + (over ? " over" : "") + (open ? " open" : "") + (picked("clips").includes(c) ? " picked" : ""), "data-clip": c.id, "data-pick": "clips", style: `--who:${whoColor(c.who)}` });
  card._obj = c; CLIPS_OF.set(c, { sc, ver, sid });
  card.append(el("div", { class: "lhead" }, grip(card, ver.clips, i, "clip"), clipRow(sc, ver, c, i, sid, open)));
  card.addEventListener("dragover", e => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); card.classList.add("droptake"); } });
  card.addEventListener("dragleave", e => { if (!card.contains(e.relatedTarget)) card.classList.remove("droptake"); });
  card.addEventListener("drop", e => { if (![...e.dataTransfer.types].includes("Files")) return; e.preventDefault(); e.stopPropagation(); card.classList.remove("droptake"); dropTake(e, sc, c, sid); });
  const fx = FIX[`${sid}.${c.id}`];
  if (fx) for (const f of fx) card.append(el("div", { class: "fix" }, f.text, f.apply ? el("button", { on: { click: () => { f.apply(); delete FIX[`${sid}.${c.id}`]; touch(); renderInspector(); } } }, f.label || "Apply") : null));
  if (!open) return card;
  const tab = OPEN[sid].tab || "line", has = { take: !!TAKES[takeId(sid, sc.variants ? (VTAB[sid] || sc.pick) : null, c.id)], event: !!c.event, reply: !!c.reply, body: !!((c.body || {}).segments || (c.body || {}).file || ((c.body || {}).block || []).length > 1) };
  card.append(el("div", { class: "ltabs" }, ...CLIP_TABS.map(([k, l]) => el("button", { class: (k === tab ? "on" : "") + (has[k] ? " has" : ""), on: { click: () => { OPEN[sid].tab = k; CTX.rerender(); } } }, l))));
  const pane = el("div", { class: "lpane" }); card.append(pane);
  if (tab === "line") {
    const oldTake = takeId(sid, sc.variants ? VTAB[sid] || sc.pick : null, c.id);
    pane.append(el("div", { class: "row" }, el("span", { class: "lab" }, "id"), txt(c, "id", { style: "width:62px", title: "the clip's id: its take is found by it (game_scene_version_id)", after: () => { if (TAKES[oldTake]) alert(`The take ${TAKES[oldTake].name} was found by the old id: rename the file to ${takeId(sid, sc.variants ? VTAB[sid] || sc.pick : null, c.id)} too, or it won't match.`); OPEN[sid].id = c.id; renderInspector(); } }),
      el("span", { class: "lab" }, "who"), sel(c, "who", [...castIds(), "player"], { blank: false, title: "who speaks or acts in this clip", after: () => { if (c.who !== "player") delete c.think; renderInspector(); } }),
      c.who === "player" ? chk(c, "think", "a thought (shown, never said)", renderInspector) : null,
      c.think ? chk(c, "breaks", "breaks off (a memory flicker)", renderInspector) : null,
      el("span", { class: "lab" }, "length"), txt(c, "dur", { num: true, ph: clipSecs(c).toFixed(1), style: "width:64px", title: "the take's length (seconds); empty = estimated", after: renderInspector }), el("span", { class: over ? "err" : "kv" }, over ? `> ${max} s: split it` : "s")));
    pane.append(txt(c, "en", { w: true, ph: (S.game || {}).voice === "none" ? "the line (typed on screen)" : "English subtitle", after: renderInspector }),
      (S.game || {}).voice === "none" && !c.ja ? null : txt(c, "ja", { w: true, ph: "日本語 (what gets recorded)", after: renderInspector }), txt(c, "act", { w: true, ph: "acting note for the take" }),
      c.think ? txt(c, "retype", { w: true, drop: true, ph: "then erased and retyped as… (its words become these: Natsuki. → Natsu.)", after: renderInspector }) : null,
      condRow(c, CTX, "said only if"));                // a line left out unless it holds (§9.14)
    if ((S.format || 2) >= 3) pane.append(takeSec(c));
  }
  if (tab === "take") {
    const tk = TAKES[takeId(sid, sc.variants ? (VTAB[sid] || sc.pick) : null, c.id)];
    pane.append(takeRow(sc, c, sid), tk ? waveEditor(c, tk) : null, el("div", { class: "dropzone", on: {
      click: () => { const inp = el("input", { type: "file", accept: "video/*,audio/*", style: "display:none", on: { change: () => { if (inp.files[0]) dropTake({ dataTransfer: { files: inp.files } }, sc, c, sid); inp.remove(); } } }); document.body.append(inp); inp.click(); } } },
      icon("upload", 18), el("div", {}, el("b", {}, "Drop this clip's take here"), el("div", { class: "kv" }, `or click to choose it: its video or audio, saved as ${takeId(sid, sc.variants ? (VTAB[sid] || sc.pick) : null, c.id)} and measured (its length, the dead air at either end)`))));
  }
  if (tab === "camera") {
    const lk = c.look || {}, looks = ["player", ...Object.keys(sc.trackers || {}), ...castIds().filter(x => x !== c.who), ...placed(lvl)];
    pane.append(el("div", { class: "sec row" }, el("span", { class: "lab" }, "look"),
      sel({ at: c.look ? lk.at || "player" : "" }, "at", looks, { blank: "(the scene's, or none)", after: () => {}, title: "what the head follows: the player, a tracker, someone, a thing" }),
      "yaw ±", el("input", { type: "number", value: (lk.limit || [70])[0], style: "width:50px" }), "up", el("input", { type: "number", value: (lk.limit || [70, 20])[1], style: "width:46px" }), "down", el("input", { type: "number", value: (lk.limit || [70, 20, 30])[2], style: "width:46px" }),
      "past", sel({ past: lk.past || "hold" }, "past", ["hold", "snap"], { blank: false }),
      el("span", { class: "kv" }, c.look ? "" : "(set by choosing what it follows)")));
    { const r = pane.lastChild; r.addEventListener("change", () => { const s = r.querySelectorAll("select"), n = r.querySelectorAll("input"); if (!s[0].value) delete c.look; else c.look = { at: s[0].value, limit: [+n[0].value, +n[1].value, +n[2].value], past: s[1].value }; touch(); }); }
    // seam, shot, camera
    const look = [...castIds(), ...placed(lvl)];
    const sec1 = el("div", { class: "sec row" });
    if (i) { c.seam = c.seam || { kind: "blink" }; sec1.append(el("span", { class: "lab" }, "seam in"), sel(c.seam, "kind", SEAMS, { blank: false, after: renderInspector }), ["glance", "cutaway"].includes(c.seam.kind) ? sel(c.seam, "look", look, { blank: "look at…" }) : null); }
    sec1.append(el("span", { class: "lab" }, "shot"), sel(c, "shot", Object.entries(SHOTS).map(([k, v]) => [k, `${k} · ${v.dist}`]), { drop: true, title: c.shot && SHOTS[c.shot] ? `${SHOTS[c.shot].zone}: ${SHOTS[c.shot].use}` : "how close the actor comes to the player's eye" }));
    c.cam = c.cam || {};
    sec1.append(el("span", { class: "lab" }, "cam"), "lean", txt(c.cam, "push", { num: true, step: "0.05", style: "width:48px", title: "the player leans in over the clip, metres (up to 0.35)" }), "zoom", txt(c.cam, "zoom", { num: true, step: "0.01", style: "width:48px", title: "a held focus narrows the view a little (0 to 0.15); framing is distance, not lens" }),
      "roll", txt(c.cam, "roll", { num: true, style: "width:44px" }), "shake", txt(c.cam, "shake", { num: true, step: "0.1", style: "width:44px" }), "look", sel(c.cam, "look", look, { drop: true }));
    pane.append(sec1);

  }
  if (tab === "event") {
    if (c.reply) pane.append(el("p", { class: "kv" }, "This clip has a reply: a clip has a reply or an event, not both (put the event on the next clip)."));
    // event (QTE)
    const evs = el("div", { class: "sec row" }, el("span", { class: "lab" }, "event"));
    const evHolder = { type: c.event ? c.event.type : "" };
    const evList = ["choose", ...QTE.filter(t => t === evHolder.type).map(t => [t, t + " (deprecated)"])];   // quick-time events are deprecated (DECISIONS 2026-10-27): only a clip that has one shows it
    evs.append(sel(evHolder, "type", evList.map(t => (t === "choose" ? ["choose", "choose (a dialogue answer)"] : t)), { blank: "none", after: () => { if (!evHolder.type) delete c.event; else c.event = Object.assign({ secs: 3, prompt: "" }, c.event || {}, { type: evHolder.type }); if (evHolder.type === "choose" && !c.event.options) { c.event.options = [{ id: "a", label: "Say something" }, { id: "b", label: "Say nothing" }]; } touch(); renderInspector(); } }));
    if (c.event && QTE.includes(c.event.type)) pane.append(el("p", { class: "kv warn" }, `A ${c.event.type} is a quick-time event: deprecated, they break the immersion. Make it a choose (a dialogue answer), or take the event off.`));
    if (c.event) {
      const e = c.event;
      evs.append("secs", txt(e, "secs", { num: true, style: "width:48px" }), "warn", txt(e, "warn", { num: true, step: "0.1", style: "width:48px", title: "seconds of warning sign before it (Little Hope's indicator)" }), txt(e, "prompt", { ph: "on-screen prompt" }));
      if (e.type === "struggle") evs.append("pull", sel(e, "pull", PULLS, { blank: false }), "need", txt(e, "need", { num: true, step: "0.1", style: "width:48px" }));
      if (e.type === "mash") evs.append("need", txt(e, "need", { num: true, step: "0.1", style: "width:48px" }));
      if (["press", "mash", "hold"].includes(e.type)) evs.append("key", txt(e, "key", { ph: "E", style: "width:40px" }));
      pane.append(evs);
      if (e.type === "choose") {                                  // the answers (timed: the default when time runs out)
        e.options = e.options || [];
        const ob = el("div", { class: "sec" }, el("span", { class: "lab" }, "answers"));
        e.options.forEach((o, oi) => ob.append(el("div", { class: "row" }, txt(o, "label", { ph: "what the player picks", style: "flex:1", after: renderInspector }), txt(o, "id", { style: "width:90px", title: "its id (a result choice after the scene branches on it)" }),
          e.options.length > 2 ? el("button", { class: "ghost", title: "remove", on: { click: () => { e.options.splice(oi, 1); touch(); renderInspector(); } } }, icon("x", 14)) : null)));
        ob.append(el("div", { class: "row" }, el("button", { on: { click: () => { e.options.push({ id: "opt" + (e.options.length + 1), label: "" }); touch(); renderInspector(); } } }, icon("plus", 14), " answer"),
          el("span", { class: "lab" }, "when time runs out"), sel(e, "default", e.options.map(o => [o.id, o.label || o.id]), { blank: false })));
        pane.append(ob);
      }
      const on = e.on || {}, rb = el("div", { class: "sec" });
      for (const res of eventResults(e)) {
        const [arr, cx] = slot(on, res, e, "on");
        rb.append(el("div", { class: "result" }, el("div", { class: "result-h" }, "If the result is ", el("b", {}, res)), actionList(arr, cx, { empty: "nothing (a result choice after the scene can branch on it)" })));
      }
      pane.append(rb);
    } else pane.append(evs);

  }
  if (tab === "reply") pane.append(c.event ? el("p", { class: "kv" }, "This clip has an event: a clip has a reply or an event, not both (put the reply on the clip before).") : replyEditor(c, ver, i));
  if (tab === "body") {
    // body
    c.body = c.body || {};
    const b = c.body, bodySec = el("div", { class: "sec" });
    if ((S.format || 2) < 3 || b.prompt) bodySec.append(el("div", { class: "row" }, el("span", { class: "lab" }, "body"), txt(b, "prompt", { w: true, ph: "Kimodo prompt (what the body does, in plain words)", drop: true })));
    else bodySec.append(el("div", { class: "row" }, el("span", { class: "lab" }, "body"), el("span", { class: "kv" }, "the blocking below plays until the Kimodo segments under it are made")));
    b.block = b.block || [];
    const kt = el("table", {}, el("tr", {}, ...["at (0..1)", "pose", "ease in", "walk", "move to", ""].map(h => el("th", {}, h))));
    b.block.forEach((k, ki) => kt.append(el("tr", {}, el("td", { style: "width:64px" }, txt(k, "at", { num: true, step: "0.05" })), el("td", {}, posePick(k, "pose", renderInspector)),
      el("td", {}, sel(k, "ease", M.EASE_NAMES, { blank: "inout", drop: true })), el("td", { style: "width:40px" }, el("input", { type: "checkbox", checked: !!k.walk, on: { change: e => { if (e.target.checked) k.walk = true; else delete k.walk; touch(); } } })),
      el("td", {}, sel(k, "move", spots(lvl), { drop: true })), el("td", { style: "width:28px" }, el("button", { on: { click: () => { b.block.splice(ki, 1); touch(); renderInspector(); } } }, "×")))));
    bodySec.append(kt, el("div", { class: "row" }, el("button", { on: { click: () => { c.body = b; b.block = b.block || []; const last = b.block[b.block.length - 1]; b.block.push({ at: last ? Math.min(1, +(last.at || 0) + 0.3) : 0, pose: last ? last.pose : "idle", ease: "inout" }); touch(); renderInspector(); } } }, "+ key"),
      el("span", { class: "lab" }, "fit"), sel(b, "fit", M.FITS, { blank: "stretch", drop: true, title: "when a generated motion and the take differ in length" }),
      el("span", { class: "lab" }, "blend"), txt(b, "blend", { num: true, step: "0.05", ph: "0.25", style: "width:52px", title: "seconds of crossfade from the previous clip" }),
      chk(b, "bridge", "in-between", renderInspector), el("span", { class: "lab" }, "motion"), motionPick(b, c, clipSecs(c))));
    if ((S.format || 2) >= 3 || (b.segments || []).length) bodySec.append(segmentsEditor(sid, c, b, lvl));
    bodySec.append(layersEditor(c, b));
    // modifiers
    b.mods = b.mods || [];
    const mt = el("div", {});
    b.mods.forEach((m, mi) => { const r = el("div", { class: "row" }, el("span", { class: "lab" }, "mod"), sel(m, "type", Object.keys(M.MOD_TYPES), { blank: false, after: renderInspector })); for (const f of M.MOD_TYPES[m.type] || []) r.append(f, txt(m, f, { num: true, step: "0.05", style: "width:52px" })); r.append(el("button", { on: { click: () => { b.mods.splice(mi, 1); touch(); renderInspector(); } } }, "×")); mt.append(r); });
    bodySec.append(mt, el("div", { class: "row" }, el("button", { on: { click: () => { c.body = b; b.mods = b.mods || []; b.mods.push({ type: "ease", in: 0.2, out: 0.2 }); touch(); renderInspector(); } } }, "+ modifier"),
      el("span", { class: "kv" }, "ease (in/out s) · speed · ramp · hold (at, secs) · snap (creep then strike) · twitch (uncanny stutter) · trim · loop · mirror")));
    if (!b.block.length) delete b.block; if (!b.mods.length) delete b.mods;
    pane.append(bodySec);

  }
  if (c.cam && !Object.keys(c.cam).length) delete c.cam;
  if (c.body && !Object.keys(c.body).length) delete c.body;
  return card;
}
const WHO_COLORS = ["#e07aa8", "#6fb3d9", "#d9a441", "#3fb3a2", "#9b7be0", "#e0805a"];
function whoColor(who) { if (who === "player") return "#a8a59c"; const i = castIds().indexOf(who); return WHO_COLORS[(i < 0 ? 0 : i) % WHO_COLORS.length]; }
// a hanging line (STORY_FORMAT §9.9): she asks and waits; the player answers (two answers, or three); each gets her line back
// a conversation card's choice row (STORY_FORMAT §9.9): she waits, the player picks an act with the thought behind it,
// and each answer has her reply (a line or a few) and where the talk goes then: on, a later line, its end, a card
function replyEditor(c, ver, ci) {
  const fresh = id => ({ id, label: "", then: { ja: "", en: "" } });
  if (!c.reply) return el("div", {}, el("p", { class: "kv" }, "A reply makes this a hanging line: she asks, then waits while the player picks what to do (an act, and the thought behind it). Each answer gets her reply back, a line or a few (their own takes, named after this clip's and the answer's), and says where the talk goes then: on to the next line, a later one, its end, or another card."),
    el("button", { on: { click: () => { c.reply = { wait: 6, timeout: null, options: [fresh("yes"), fresh("no")] }; touch(); CTX.rerender(); } } }, icon("plus", 14), " Make this a hanging line"));
  const rp = c.reply, box = el("div", { class: "reply" }), clips = (ver && ver.clips) || [];
  rp.options = rp.options || [];
  box.append(el("div", { class: "row" }, el("span", { class: "lab" }, "she waits"), txt(rp, "wait", { num: true, ph: "6", style: "width:58px", title: "2 to 15 s" }), "s, then",
    sel({ t: rp.timeout || "" }, "t", rp.options.map(o => [o.id, `answers your silence with “${o.label || o.id}”'s reply`]), { blank: "carries on (no answer)", after: function () { } })));
  box.lastChild.querySelector("select").addEventListener("change", e => { rp.timeout = e.target.value || null; touch(); });
  box.append(el("div", { class: "row" }, el("span", { class: "lab" }, "her face"), txt(c, "wait_expr", { w: true, ph: "the face she holds while she waits (MiniMax): a hopeful, expectant expression", drop: true })));
  const redo = () => { touch(); renderInspector(); };
  rp.options.forEach((o, oi) => {
    const lines = thenList(o), setLines = arr => { if (arr.length) o.then = arr.length === 1 ? arr[0] : arr; else delete o.then; redo(); };
    const id = el("input", { value: o.id || "", style: "width:72px", title: "its id: her reply's takes are this clip's take id + _ + this (then _2, _3)", on: { change: e => {
      const v = e.target.value.trim(); if (!v || rp.options.some(x => x !== o && x.id === v)) { e.target.value = o.id; return; }
      if (rp.timeout === o.id) rp.timeout = v; o.id = v; redo(); } } });
    const head = el("div", { class: "row" }, el("b", { class: "side", title: "the key that picks it" }, rp.options.length <= 2 ? (oi ? "Right" : "Left") : String(oi + 1)),
      txt(o, "label", { ph: "the act: what you do (Greet, Lie, Stay quiet)", style: "flex:1", after: renderInspector }), id,
      oi ? el("button", { class: "small", title: "earlier in the list", on: { click: () => { rp.options.splice(oi - 1, 0, ...rp.options.splice(oi, 1)); redo(); } } }, "↑") : null,
      el("button", { class: "small", title: "take this answer out", on: { click: () => { rp.options.splice(oi, 1); if (rp.timeout === o.id) rp.timeout = null; redo(); } } }, icon("x", 14)));
    const opt = el("div", { class: "ropt" }, head,
      el("div", { class: "row" }, el("span", { class: "lab" }, "you think"), txt(o, "think", { ph: "the thought behind it, under the act (She's cold, I should let her in)", style: "flex:1", drop: true })),
      condRow(o, CTX, "offered only if"));             // an answer offered by what's happened (§9.14)
    if (!lines.length) opt.append(el("div", { class: "row muted" }, el("span", { class: "lab" }, "she says"), "nothing back"));
    lines.forEach((th, n) => opt.append(
      el("div", { class: "row" }, el("span", { class: "lab" }, n ? "and" : "she says"), sel(th, "who", castIds(), { drop: true, blank: c.who || "she", title: "who says it: the one who asked, unless it's someone else" }),
        txt(th, "ja", { ph: "日本語", style: "flex:1" }), txt(th, "en", { ph: "English", style: "flex:1" }),
        el("button", { class: "small", title: "take this line out of her reply", on: { click: () => setLines(lines.filter(x => x !== th)) } }, icon("x", 14))),
      el("div", { class: "row" }, el("span", { class: "lab" }, "MiniMax"), txt(th, "expr", { ph: "her expression", style: "flex:1", drop: true }), sel(th, "voice", VOICES, { drop: true, blank: "voice…" }))));
    // where the talk goes after her reply: on (the default), skip ahead to a later line, end it, or leave for a card
    const [g, to] = replyGo(o), cur = g === "clip" || g === "node" ? `${g}:${to}` : g;
    const later = clips.slice(ci + 2).filter(x => x.id), go = el("select", { title: "where the conversation goes after her reply", on: { change: e => {
      const v = e.target.value; if (v === "next") delete o.go; else if (v === "end") o.go = "end"; else { const k = v.indexOf(":"); o.go = { [v.slice(0, k)]: v.slice(k + 1) }; } redo(); } } });
    go.append(el("option", { value: "next", selected: cur === "next" }, "Next: on to the next line"), el("option", { value: "end", selected: cur === "end" }, "End the conversation"));
    const sk = el("optgroup", { label: "Skip to a later line" }), gn = el("optgroup", { label: "Go to a card on the board" });
    const words = x => `Skip to ${x.id}: ${x.who || ""} “${(x.en || x.ja || "").slice(0, 32)}”`;
    for (const x of later) sk.append(el("option", { value: "clip:" + x.id, selected: cur === "clip:" + x.id }, words(x)));
    if (g === "clip" && !later.some(x => x.id === to)) sk.append(el("option", { value: cur, selected: true }, `${to} (not a later line)`));
    for (const [nid, n] of Object.entries(S.flow)) gn.append(el("option", { value: "node:" + nid, selected: cur === "node:" + nid }, `Go to ${nodeTitle(nid, n)} (${nid})`));
    if (g === "node" && !S.flow[to]) gn.append(el("option", { value: cur, selected: true }, `${to} (not on the board)`));
    if (sk.children.length) go.append(sk); go.append(gn);
    opt.append(el("div", { class: "row" }, el("span", { class: "lab" }, "then"), go, el("span", { class: "grow" }),
      el("button", { class: "small", title: "another line in her reply (its own take)", on: { click: () => setLines([...lines, { ja: "", en: "" }]) } }, icon("plus", 14), " a line")),
      el("div", {}, el("span", { class: "lab" }, "picking it also does"), actionList(...slot(o, "sets"), { empty: "nothing (most replies set nothing: they're there so it feels like you)" })));
    box.append(opt);
  });
  const add = () => { const ids = new Set(rp.options.map(o => o.id)); let n = rp.options.length + 1; while (ids.has("opt" + n)) n++; rp.options.push(fresh("opt" + n)); redo(); };
  box.append(el("div", { class: "row" },
    el("button", { class: "small", title: "as many as the moment needs: an L.A. Noire close-up has three (warm, probing, evasive...)", on: { click: add } }, icon("plus", 14), " Add answer"),
    rp.options.length > 3 ? el("span", { class: "muted" }, `${rp.options.length} answers: a close-up reads best with two or three`) : null,
    el("span", { class: "grow" }), el("button", { class: "danger small", on: { click: () => { if (confirm("Take the reply off this clip?")) { delete c.reply; delete c.wait_expr; touch(); CTX.rerender(); } } } }, "No reply")));
  return box;
}
// ---- a clip's Kimodo segments (STORY_FORMAT §9.5): one behaviour each, made in Kimodo's demo from the shot list and
// chained here; each says whether it's made (its length) or not (the clip holds a pose for its seconds meanwhile)
const SEG_SKIP = new Set(["slowly", "quickly", "then", "and", "is", "the", "a", "an", "her", "his", "their", "its", "very", "suddenly", "carefully", "softly", "still", "to", "into", "at"]);
const SEG_DIRS = new Set(["forward", "back", "backward", "backwards", "left", "right", "up", "down", "away", "in", "out", "around", "over", "off"]);
function segName(sid, c, n, prompt) {          // <game>_<scene>_<clip>_<nn>_<verb> (KIMODO.md §3), the verb from the prompt
  const w = (prompt || "").toLowerCase().replace(/^(a|an)\s+([a-z-]+\s+){0,3}?person\s+/, "").match(/[a-z]+/g) || [];
  const ws = w.filter(x => !SEG_SKIP.has(x)), i = ws.findIndex((x, k) => !/ing$/.test(x) || k === ws.length - 1);
  const v = i < 0 ? "move" : ws[i].replace(/ies$/, "y").replace(/(ss|sh|ch|x)es$/, "$1").replace(/([^s])s$/, "$1");
  const d = ws.slice(i + 1, i + 3).find(x => SEG_DIRS.has(x));
  const low = x => String(x).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return [low(GAME), low(sid.replace(/^s_/, "")), low(c.id), String(n).padStart(2, "0"), (v + (d || "")).slice(0, 20)].join("_");
}
function segmentsEditor(sid, c, b, lvl) {
  const segs = b.segments || [], box = el("div", { class: "segs" });
  const made = segs.filter(g => g.file && FILES[g.file]).length, total = segs.reduce((t, g) => t + (+g.secs || 0), 0);
  const redo = () => { touch(); renderInspector(); };
  box.append(el("div", { class: "row" }, el("span", { class: "lab" }, "Kimodo"),
    el("span", { class: "kv" }, segs.length ? `${segs.length} segment${segs.length > 1 ? "s" : ""}, ${made} made · ${total.toFixed(1)} s for the clip's ${clipSecs(c).toFixed(1)} s` : "no segments: the blocking plays (one segment per behaviour, 2 to 10 s)"),
    sel(b, "tier", ["simple", "activity", "action"], { blank: "tier…", drop: true, title: "the animation budget: simple (80% of the game's motion), activity (15%), action (5%)" }),
    chk(b, "hero", "hero"), el("a", { href: `kimodo.html?game=${encodeURIComponent(GAME)}`, target: "kimodo", title: "the shot list: every motion to make in Kimodo's demo, its constraints and save name" }, "shot list ↗")));
  segs.forEach((g, gi) => {
    const f = g.file && FILES[g.file], person = /^(A|An) ([A-Za-z-]+ ){0,3}person\b/.test(g.prompt || "");
    const state = f ? el("span", { class: "ok", title: `${g.file}: made and on this segment` }, `✓ ${(f.pos.length / (f.fps || 30)).toFixed(1)} s`)
      : el("span", { class: "muted", title: MADE.includes(g.name) ? "made: Import on the shot list puts it here" : "not made yet: the clip holds a pose for its seconds" }, MADE.includes(g.name) ? "made: import" : "to make");
    const pathRow = el("span", { class: "row" }, el("span", { class: "lab" }, "path"), ...(g.path || []).map((sp, pi) => el("span", { class: "chip", title: "a mark the root travels through (the demo's 2D root path)" }, sp,
      el("button", { class: "x", on: { click: () => { g.path.splice(pi, 1); if (!g.path.length) delete g.path; redo(); } } }, "×"))),
      sel({ v: "" }, "v", spots(lvl), { blank: "+ mark", title: "add a stage mark to the root's path", after: () => {} }));
    pathRow.lastChild.addEventListener("change", e => { if (!e.target.value) return; (g.path = g.path || []).push(e.target.value); redo(); });
    const keyRow = el("span", { class: "row" }, el("span", { class: "lab" }, "keys"), ...(g.keys || []).map((k, ki) => el("span", { class: "chip" }, posePick(k, "pose", redo), "@", txt(k, "at", { num: true, step: "0.05", style: "width:46px", title: "where in the segment (0..1)" }),
      el("button", { class: "x", on: { click: () => { g.keys.splice(ki, 1); if (!g.keys.length) delete g.keys; redo(); } } }, "×"))),
      el("button", { title: "a full-body key from the pose library, for a pose Kimodo doesn't know", on: { click: () => { (g.keys = g.keys || []).push({ at: g.keys.length ? 1 : 0, pose: "idle" }); redo(); } } }, "+ key"));
    box.append(el("div", { class: "seg-card" },
      el("div", { class: "row" }, el("b", {}, `${gi + 1}`), state, txt(g, "name", { style: "width:210px", title: "its save name in Kimodo: <game>_<scene>_<clip>_<nn>_<verb>" }),
        el("button", { title: "name it by the shot list's rule, from its prompt", on: { click: () => { g.name = segName(sid, c, gi + 1, g.prompt); redo(); } } }, "↻"),
        txt(g, "secs", { num: true, step: "0.5", style: "width:52px", title: "seconds, 2 to 10: one behaviour" }), "s",
        chk(g, "loop", "loop"), chk(g, "in_place", "in place"),
        "blend", txt(g, "blend", { num: true, step: "0.05", ph: "0.25", style: "width:56px", title: "seconds it blends in from the segment before (inertial: this one plays at full speed while the join fades)" }),
        el("button", { title: "move up", on: { click: () => { if (gi) { [segs[gi - 1], segs[gi]] = [segs[gi], segs[gi - 1]]; redo(); } } } }, "↑"),
        el("button", { title: "move down", on: { click: () => { if (gi < segs.length - 1) { [segs[gi + 1], segs[gi]] = [segs[gi], segs[gi + 1]]; redo(); } } } }, "↓"),
        el("button", { title: "delete this segment", on: { click: () => { if (!confirm(`Delete segment ${g.name}?`)) return; segs.splice(gi, 1); if (!segs.length) delete b.segments; redo(); } } }, "×")),
      el("div", { class: "row" }, txt(g, "prompt", { w: true, ph: "A person … (one behaviour, standing alone; never where to look)", after: renderInspector }), person ? null : el("span", { class: "err", title: "Kimodo's prompts start \"A person\" (or \"A scared person\"...)" }, "A person …")),
      el("div", { class: "row" }, pathRow, keyRow, el("span", { class: "lab" }, "motion"), motionPick(g, c, +g.secs || 0))));
  });
  box.append(el("div", { class: "row" }, el("button", { on: { click: () => { b.segments = b.segments || []; const n = b.segments.length + 1; b.segments.push({ name: segName(sid, c, n, "A person moves"), prompt: "A person ", secs: 3 }); if (!b.tier) b.tier = "simple"; redo(); } } }, "+ segment"),
    el("span", { class: "kv" }, "each one behaviour of 2 to 10 s, chained here; ↻ names it from its prompt")));
  return box;
}
// ---- a clip's layers (STORY_FORMAT §3.5 `layers`): a part of the body from another motion or a pose, over this one
function layersEditor(c, b) {
  const box = el("div", {}), redo = () => { touch(); renderInspector(); };
  (b.layers || []).forEach((ly, li) => {
    const kind = { k: ly.file ? "motion" : "pose" };
    box.append(el("div", { class: "row" }, el("span", { class: "lab" }, "layer"),
      sel(ly, "mask", M.MASK_NAMES, { blank: false, title: "the part of the body it plays: upper (from the waist up), arms, left_arm, right_arm, head" }),
      sel(kind, "k", ["pose", "motion"], { blank: false, title: "a pose from the library, or a made motion", after: () => { if (kind.k === "pose") { delete ly.file; delete ly.fit; ly.pose = ly.pose || "idle"; } else { delete ly.pose; } redo(); } }),
      kind.k === "pose" ? posePick(ly, "pose", redo) : motionPick(ly, c, clipSecs(c)),
      "from", txt(ly, "from", { num: true, step: "0.05", ph: "0", style: "width:48px", title: "where in the clip it comes in (0..1)" }),
      "to", txt(ly, "to", { num: true, step: "0.05", ph: "1", style: "width:48px", title: "where it goes (0..1)" }),
      "fade", txt(ly, "fade", { num: true, step: "0.05", ph: "0.3", style: "width:48px", title: "seconds it eases in and out (not at the clip's edges: the clip's blend does that)" }),
      "weight", txt(ly, "weight", { num: true, step: "0.1", ph: "1", style: "width:48px", title: "how much of it (0..1)" }),
      kind.k === "motion" ? sel(ly, "fit", M.FITS, { blank: "loop", drop: true, title: "the motion against the layer's window: loop it, play it once and hold, stretch it..." }) : null,
      el("button", { title: "delete this layer", on: { click: () => { b.layers.splice(li, 1); if (!b.layers.length) delete b.layers; redo(); } } }, "×")));
  });
  box.append(el("div", { class: "row" }, el("button", { on: { click: () => { (b.layers = b.layers || []).push({ mask: "upper", pose: "idle" }); redo(); } } }, "+ layer"),
    el("span", { class: "kv" }, "a part of the body from another motion or a pose, over this one: arms held over a walk, a gesture, the head")));
  return box;
}
function stitchEditor(box, st, tid) {
  box.append(el("h2", {}, "Stitch (player task)"), field("title", txt(st, "title", { w: true })), field("goal", txt(st, "goal", { w: true, ph: "what the player is doing" })),
    field("level", sel(st, "level", Object.keys(S.levels || {}), { after: showStage })), field("target", txt(st, "target_min", { num: true }), " min of play (typical)"),
    field("template", sel(st, "template", ["fetch", "code", "power", "chore", "peephole", "hide", "escape", "explore", "loop", "ritual", "run", "collect", "sneak", "hold", "search"], { drop: true })));
  const hasT = !!st.timer;
  box.append(field("timer", el("label", { class: "kv" }, el("input", { type: "checkbox", checked: hasT, on: { change: e => { if (e.target.checked) st.timer = { secs: 30, label: "", fail: S.game.start }; else delete st.timer; touch(); renderInspector(); } } }), " timed"),
    hasT ? txt(st.timer, "secs", { num: true }) : null, hasT ? "s, on timeout go to" : null, hasT ? sel(st.timer, "fail", Object.keys(S.flow), { blank: false }) : null, hasT ? txt(st.timer, "label", { ph: "on-screen label" }) : null));
  const its = (S.interrupts || []).filter(it => it.during === "all" || (it.during || []).includes(tid));
  if (its.length) box.append(el("div", { class: "kv" }, "trigger cutscenes here: ", ...its.flatMap((i, j) => [j ? "; " : "",
    el("a", { href: "#", title: "open it in the Database", on: { click: e => { e.preventDefault(); openDb("interrupts", i.id); } } }, `${i.label || i.id} → ${i.to}`)])));
  CTX_LEVEL = st.level || Object.keys(S.levels || {})[0] || null; CTX_BEATS = st.beats = st.beats || [];
  box.append(el("h2", {}, "Gameplay round"), roundEditor(st),
    el("h2", {}, "Beats"), el("p", { class: "kv" }, "When something happens, do these: drag a beat or a command by its grip to move it, double-click a command to change it."),
    beatsEditor(st.beats, CTX, { secrets: CTX.refs("secret") }),
    el("button", { class: "a-add big qbeat", title: "a whole beat from a few blanks: a jump scare, a knock, the lights dying, a door slamming, a whisper, a line, a checkpoint",
      on: { click: e => { const r = e.currentTarget.getBoundingClientRect(); contextMenu(r.left, r.bottom + 4, QUICK_BEATS.map(t => ({ label: t.label, icon: t.icon, hint: t.hint, on: () => quickBeat(t.id, st) })), "Quick beats"); } } }, icon("wand", 14), " Quick beat"),
    advanced(jsonArea(st, "play", "play (the round)", { small: true, compact: true }), jsonArea(st, "beats", "beats (STORY_FORMAT §4)")));
}
// a gameplay round (STORY_FORMAT §9.8): hide, run, collect...: its rule, timer, places, the seeker, and what each result does
function roundEditor(st) {
  if (!st.play) return el("div", { class: "row" }, el("span", { class: "kv" }, "Not a round: the beats below are the task."),
    el("button", { on: { click: () => { st.play = { type: "hide", secs: 40, rule: "", spots: [], on: {} }; touch(); CTX.rerender(); } } }, icon("plus", 14), " Make it a gameplay round (hide, run, collect…)"));
  const p = st.play, box = el("div", { class: "round" }), redo = () => { touch(); CTX.rerender(); };
  box.append(form([
    { key: "type", label: "Round", kind: "choice", opts: Object.keys(PLAYS), labels: { hide: "hide (hidden or found)", run: "run (escaped or caught)", collect: "collect (done or failed)", sneak: "sneak (made it or spotted)", hold: "hold (held or broke)", search: "search (found or out of time)", escape: "escape (out or caught)" } },
    { key: "secs", label: "Seconds", kind: "number", ph: "40" }, { key: "rule", label: "The rule (one line)", kind: "text", ph: "Hide before she finishes counting to ten" },
    { key: "warn", label: "What warns the player", kind: "text", ph: "she counts out loud, eyes covered", opt: true }, { key: "seeker", label: "Who hunts", kind: "cast", opt: true },
  ], p, CTX, redo));
  box.addEventListener("change", () => touch());
  const spots = p.spots = p.spots || [], chips = el("span", { class: "chips" });
  spots.forEach((x, i) => chips.append(el("span", { class: "chip" }, x, el("button", { class: "x", on: { click: () => { spots.splice(i, 1); redo(); } } }, "×"))));
  const add = el("select", { on: { change: e => { if (e.target.value) { spots.push(e.target.value); redo(); } } } }, el("option", { value: "" }, "+ add a place"), ...CTX.refs("thing").filter(([v]) => !spots.includes(v)).map(([v, l]) => el("option", { value: v }, l)));
  box.append(el("div", { class: "frm-r" }, el("span", { class: "frm-l" }, "Hiding places, targets"), el("span", { class: "chips" }, chips, add)));
  const on = p.on || {};
  for (const res of PLAYS[p.type] || []) {
    const [arr, cx] = slot(on, res, p, "on");
    box.append(el("div", { class: "result" }, el("div", { class: "result-h" }, "If the result is ", el("b", {}, res.replace(/_/g, " "))), actionList(arr, cx, { empty: "nothing more (a result choice after the task can branch on it)" })));
  }
  box.append(el("div", { class: "row" }, el("span", { class: "grow" }), el("button", { class: "danger small", on: { click: () => { if (confirm("Stop this task being a gameplay round?")) { delete st.play; redo(); } } } }, "Not a round")));
  return box;
}
function choiceEditor(box, n, nodeIds) {
  box.append(el("h2", {}, "Choice"), field("by", sel(n, "by", ["act", "flag", "result", "karma", "count"], { blank: false, after: renderInspector, title: "what picks the branch: the player's act, flags set, an event's result, karma, or a counter (game.counters)" })), field("prompt", txt(n, "prompt", { w: true })));
  if (n.by === "result") box.append(field("of", sel(n, "of", nodeIds.filter(k => S.flow[k].type === "scene"), { after: renderInspector })));
  const ev = n.by === "result" && S.flow[n.of] && S.scenes[S.flow[n.of].ref] ? (version(S.scenes[S.flow[n.of].ref]).clips || []).filter(c => c.event).map(c => c.event).pop() : null;
  const tb = el("table", {}, el("tr", {}, el("th", {}, "label"), el("th", {}, n.by === "act" ? "when (trigger JSON)" : n.by === "flag" ? "if flags (comma)" : n.by === "karma" ? "karma min · max (last: otherwise)" : n.by === "count" ? "counter min · max (last: otherwise)" : "result"), el("th", {}, "to"), el("th", {})));
  (n.options = n.options || []).forEach((o, i) => {
    let cond;
    if (n.by === "act") cond = triggerPill({ get: () => o.when, set: v => { o.when = v; } }, CTX, { prefix: "" });
    else if (n.by === "flag") cond = el("input", { class: "w", value: (o.if || []).join(","), placeholder: "(last option: otherwise)", on: { change: e => { const v = e.target.value.trim(); if (v) o.if = v.split(",").map(s => s.trim()); else delete o.if; touch(); } } });
    else if (n.by === "karma") cond = el("span", { class: "row" }, txt(o, "min", { num: true, ph: "min", style: "width:60px", drop: true }), txt(o, "max", { num: true, ph: "max", style: "width:60px", drop: true }), txt(o, "axis", { ph: "axis", style: "width:70px", drop: true }));
    else if (n.by === "count") cond = el("span", { class: "row" }, sel(o, "count", Object.keys(S.game.counters || {}), { blank: "counter…", drop: true }), txt(o, "min", { num: true, ph: "min", style: "width:60px", drop: true }), txt(o, "max", { num: true, ph: "max", style: "width:60px", drop: true }));
    else cond = sel(o, "result", eventResults(ev), { blank: false });
    tb.append(el("tr", {}, el("td", {}, txt(o, "label", { ph: "label" })), el("td", {}, cond), el("td", {}, sel(o, "to", nodeIds)), el("td", {}, el("button", { on: { click: () => { n.options.splice(i, 1); touch(); renderInspector(); } } }, "×"))));
  });
  box.append(tb, el("button", { on: { click: () => { n.options.push({ label: "", to: "" }); touch(); renderInspector(); } } }, "+ option"));
}
function notesEditor(box, host, nid) {
  host.notes = host.notes || [];
  box.append(el("h2", {}, "Notes on " + nid));
  for (const x of host.notes) box.append(noteEl(x));
  const by = el("select", {}, el("option", { value: "user" }, "from you"), el("option", { value: "claude" }, "from Claude"));
  const ta = el("textarea", { placeholder: "An idea, a change you want, a question for Claude…", style: "min-height:52px" });
  box.append(ta, el("div", { class: "row" }, by, el("button", { on: { click: () => { if (!ta.value.trim()) return; host.notes.push({ by: by.value, text: ta.value.trim(), at: today() }); touch(); renderInspector(); } } }, "Add note")));
  if (!host.notes.length) delete host.notes;
}
function noteEl(x, where) {
  return el("div", { class: "note" + (x.done ? " done" : "") }, el("div", { class: "by " + (x.by || "") }, (x.by === "claude" ? "Claude" : "You") + " · " + (x.at || "") + (where ? " · " + where : "")),
    el("div", {}, x.text), el("label", { class: "kv" }, el("input", { type: "checkbox", checked: !!x.done, on: { change: e => { x.done = e.target.checked; touch(); if ($("#notesView").classList.contains("on")) renderNotes(); } } }), " done"));
}
/* ---------- the stage under the board ---------- */
function currentScene() { const n = S && S.flow[SEL]; if (!n || n.type !== "scene") return null; const sc = S.scenes[n.ref]; if (!sc) return null; const vt = VTAB[n.ref]; return vt && sc.variants && sc.variants[vt] ? Object.assign({}, sc, sc.variants[vt], { pick: vt }) : sc; }
function showStage() {
  if (!flowStage || !PLAN || !S) return;
  stopPlay();
  const n = S.flow[SEL]; const ref = n && nodeRef(n);
  const lvl = (ref && ref.level) || Object.keys(S.levels)[0];
  flowStage.setWorld(PLAN, S, lvl);
  flowStage.setTime((flowTimes(S)[SEL] || {}).time || S.game.time || TIME_DEFAULT);
  flowStage.setModels(modelFiles((flowModels(S)[SEL] || {}).models));   // each cast member's model as the flow brings it here
  const sc = currentScene();
  if (sc) { const tl = flowStage.timeline(sc); $("#scrub").max = tl.total.toFixed(2); scrubTo(+$("#scrub").value || 0);
    const fs = version(sc).faces; if ((fs || []).some(p => p.expr && !FACES.lib[p.expr]) || (fs && fs.length && !FACES.M)) loadFaces(fs).then(() => { if (currentScene() === sc && !PLAY) scrubTo(+$("#scrub").value || 0); }); }   // its faces, once the expressions are in
  else { // a stitch or choice: the level from its start spot
    const start = things()[S.levels[lvl].start]; const fake = { view: S.levels[lvl].start, camera: { mode: "free" }, clips: [{ id: "x", who: "", en: "" }], stage: {} };
    if (start) { flowStage.frame(fake, 0, FILES); paintOv("#stageOv", { sub: null, who: (ref && ref.title) || SEL, black: 0, tag: n ? n.type : "" }); }
  }
}
function scrubTo(T) {
  const sc = currentScene(); if (!sc) return;
  flowStage.soundOn = !!PLAY && $("#wThings").checked;          // the things' sounds while the scene plays, not while it's scrubbed
  const st = flowStage.frame(sc, T, FILES);
  if (PLAY && st.clipSeg && st.seg && st.seg.type === "clip" && PLAY.clip !== st.clipSeg.clip) { PLAY.clip = st.clipSeg.clip; const n = S.flow[SEL]; playTake("#stageBox", n.ref, sc.variants ? sc.pick : null, PLAY.clip, $("#wVideo").checked); }
  if (PLAY && st.seg && st.seg.type !== "clip" && PLAY.clip) { PLAY.clip = null; stopTakes(); }
  const tl = flowStage.timeline(sc);
  $("#sTime").textContent = `${T.toFixed(1)} / ${tl.total.toFixed(1)} s`;
  const ph = $("#playhead"); if (ph) ph.style.left = (T / tl.total * 100) + "%";
  paintOv("#stageOv", { sub: st.sub, who: st.clipSeg ? `${st.clipSeg.clip.id} · ${st.clipSeg.clip.shot || "free"} · ${st.who || ""}` : "", black: st.black, tag: st.seg ? (st.seg.type === "seam" ? "seam: " + st.seg.seam.kind : st.seg.type === "event" ? "⚡ " + st.seg.event.type : "") : "" });
}
function paintOv(sel, o) {
  const ov = $(sel); ov.querySelector(".sub").textContent = named(o.sub) || ""; ov.querySelector(".who").textContent = o.who || "";
  if (sel === "#watchOv") paintLine(watchHud().line, o.sub, !o.think && o.speaker && (((S && S.cast) || {})[o.speaker] || {}).name || (o.think ? "" : o.speaker), o.think, o.glitch);   // the Watch's subtitles are the game's footer (a thought: the player's own, set apart)
  ov.querySelector(".black").style.opacity = o.black || 0; ov.querySelector(".tag").textContent = o.tag || "";
}
function playScene(sc, ver, fromClip) {
  stopPlay();
  const pv = ver && ver !== sc ? Object.assign({}, sc, ver) : currentScene() || sc;
  const tl = flowStage.timeline(pv);
  let T = 0, endT = tl.total;
  if (fromClip) { const s = tl.segs.find(s => s.type === "clip" && s.clip.id === fromClip); if (s) { T = Math.max(0, s.start - 0.5); endT = s.end + 0.3; } }
  let last = performance.now();
  PLAY = { stop: false };
  const loop = now => { if (!PLAY || PLAY.stop) return; T += (now - last) / 1000; last = now; if (T > endT) { stopPlay(); return; } $("#scrub").value = T; scrubTo(T); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
function stopPlay() { if (PLAY) PLAY.stop = true; PLAY = null; stopTakes(); if (flowStage) { flowStage.soundOn = false; if (flowStage.life && flowStage.life.sound) flowStage.life.sound.stop(); } }
function wireFreeCam() {
  const c = flowStage.renderer.domElement; let drag = null;
  c.addEventListener("mousedown", e => { if (flowStage.free) drag = [e.clientX, e.clientY]; });
  window.addEventListener("mouseup", () => drag = null);
  window.addEventListener("mousemove", e => { if (!drag || !flowStage.free) return; flowStage.free.yaw -= (e.clientX - drag[0]) * 0.01; flowStage.free.pitch = Math.max(-0.2, Math.min(1.4, flowStage.free.pitch + (e.clientY - drag[1]) * 0.01)); drag = [e.clientX, e.clientY]; scrubTo(+$("#scrub").value); });
  c.addEventListener("wheel", e => { if (!flowStage.free) return; e.preventDefault(); flowStage.free.dist = Math.max(1, Math.min(14, flowStage.free.dist * (e.deltaY > 0 ? 1.1 : 0.9))); scrubTo(+$("#scrub").value); }, { passive: false });
}

/* ---------- the body check: what the player sees, length mismatches, joins ---------- */
function checkBodies() {
  const sc = currentScene(); if (!sc) return alert("Select a scene");
  const sid = S.flow[SEL].ref, ver = version(sc), vis = flowStage.visibility(sc, FILES);
  for (const k of Object.keys(FIX)) if (k.startsWith(sid + ".")) delete FIX[k];
  const tl = flowStage.timeline(sc), clipSegs = tl.segs.filter(s => s.type === "clip");
  const visBy = Object.fromEntries(vis.map(v => [v.clip, v]));
  const frameBy = Object.fromEntries(flowStage.framing(sc, FILES).map(f => [f.clip, f]));
  const reachBy = Object.fromEntries(flowStage.reachCheck(sc, FILES).map(r => [r.clip, r]));
  clipSegs.forEach((seg, i) => {
    const c = seg.clip, out = [], v = visBy[c.id], key = `${sid}.${c.id}`;
    if (v && !v.offstage) {
      const hiddenGroups = Object.entries(M.GROUPS).filter(([g, js]) => js.every(j => v.hidden.includes(j))).map(([g]) => g);
      const why = [...new Set(Object.values(v.why))].filter(w => w !== "out of frame");
      out.push({ text: `The player sees: ${Object.entries(M.GROUPS).filter(([g]) => !hiddenGroups.includes(g)).map(([g]) => g).join(", ") || "nothing"}` + (hiddenGroups.length ? ` · hidden: ${hiddenGroups.join(", ")}${why.length ? " (behind " + why.join(", ") + ")" : " (out of frame)"} — no need to fix those` : "") });
    }
    const fr = frameBy[c.id];
    if (fr) {                          // first person: framing is distance; the lens never changes (DIRECTING.md §1)
      const who = (S.cast[fr.who] || {}).name || fr.who, d = fr.dist.toFixed(2), real = fr.real;
      const ang = fr.pitch > 12 ? `, looking up ${Math.round(fr.pitch)}° (${who} looms)` : fr.pitch < -12 ? `, looking down ${Math.round(-fr.pitch)}°` : "";
      if (Math.abs(fr.pitch) > PITCH) out.push({ text: `The player would have to look ${fr.pitch > 0 ? "up" : "down"} ${Math.round(Math.abs(fr.pitch))}° to see ${who}'s face: past the neck's ${PITCH}°. Restage (a step back, or change the player's stance).` });
      if (!fr.shot) out.push({ text: `Closest, ${who} is ${d} m from the player's eye: that frames as ${real.toUpperCase()} (${SHOTS[real].zone})${ang}.`, label: `Label it ${real}`, apply: () => { c.shot = real; } });
      else if (fr.far !== undefined && fr.shot !== "insert" && !fr.shot.startsWith("pov")) {
        const mid = (fr.near + Math.min(fr.far, fr.near + 1.5)) / 2;
        if (fr.dist > fr.far) {
          const lean = fr.dist - mid;
          out.push(Object.assign({ text: `A ${fr.shot.toUpperCase()} needs ${who} within ${fr.far} m of the player's eye; closest here is ${d} m, which frames as ${real.toUpperCase()}${ang}. In first person the lens can't narrow: bring ${who} in (a move key to a mark about ${mid.toFixed(2)} m away), ${lean <= LEAN ? "let the player lean in, " : ""}or call it what it is.` },
            lean <= LEAN ? { label: `Lean in ${lean.toFixed(2)} m`, apply: () => { c.cam = Object.assign(c.cam || {}, { push: +lean.toFixed(2) }); } } : { label: `Label it ${real}`, apply: () => { c.shot = real; } }));
        } else if (fr.dist < fr.near) {
          out.push({ text: `${who} comes to ${d} m: closer than a ${fr.shot.toUpperCase()} (from ${fr.near} m), so it frames as ${real.toUpperCase()}${ang}.`, label: `Label it ${real}`, apply: () => { c.shot = real; } });
        } else if (ang) out.push({ text: `${fr.shot.toUpperCase()} at ${d} m${ang}.` });
      }
    }
    const rc = reachBy[c.id];
    if (rc && rc.miss > 0.08) out.push({ text: `${(S.cast[rc.who] || {}).name || rc.who}'s hand stops ${Math.round(rc.miss * 100)} cm short of ${rc.to} (at ${Math.round(rc.when * 100)} % of the clip): out of arm's reach from the mark. Bring the mark about ${Math.round(rc.miss * 100)} cm closer (or a pose key that leans in).` });
    const b = c.body || {}, file = b.file && FILES[b.file];
    if (file) {
      const src = file.pos.length / (file.fps || 30), r = seg.dur / src;
      if ((b.fit || "stretch") === "stretch" && (r > 1.25 || r < 0.8))
        out.push({ text: `The take is ${seg.dur.toFixed(1)} s but the motion ${src.toFixed(1)} s: stretching ×${r.toFixed(2)} will look ${r > 1 ? "slow" : "hurried"}.`, label: r > 1 ? "Hold the end (+breathing)" : "Speed up with ease", apply: () => { if (r > 1) b.fit = "hold"; else { b.mods = b.mods || []; b.mods.push({ type: "ease", in: 0.15, out: 0.15 }); } } });
    }
    const prev = [...clipSegs.slice(0, i)].reverse().find(s => s.clip.who === c.who);
    if (prev && v && !v.offstage) {
      const [a, z] = flowStage.handOff(tl, prev, seg, FILES);      // as the last clip is cut, and as this one begins
      const joints = v.visible.length ? v.visible : LIB.joints.map(j => j.name);
      const d = M.poseDistance(a, z, joints), covered = c.seam && ["blink", "glance", "cutaway", "dip", "flicker", "occlude", "stumble"].includes(c.seam.kind);
      if (d > 0.08) {
        const win = d > 0.25 ? 0.7 : 0.4;
        out.push({ text: `The pose jumps ${Math.round(d * 100)} cm (visible joints) from ${prev.clip.id} into ${c.id}` + (covered ? `, under the ${c.seam.kind} seam: a ${win} s blend hides the rest.` : ": no seam covers it."),
          label: d > 0.25 ? "Add an in-between" : `Blend ${win} s`, apply: () => { c.body = c.body || {}; if (d > 0.25) c.body.bridge = { secs: win }; else c.body.blend = win; } });
      }
    }
    if ((b.block || []).some(k => k.ease === "snap") && !["panic", "reveal"].includes(sc.mood)) out.push({ text: "A snap (a sudden strike) in a calm scene: is that the scare you want here?" });
    if (out.length) FIX[key] = out;
  });
  renderInspector(); showStage();
}

/* ---------- glTF export ---------- */
async function exportGLTF() {
  const sc = currentScene(); if (!sc) return alert("Select a scene");
  const sid = S.flow[SEL].ref;
  const { blob, clips } = await flowStage.exportGLTF(sc, GAME, sid, GLTFExporter);
  const name = `${GAME}_${sid}_${sc.pick || "main"}_blocking.glb`;
  const r = await fetch(`/api/export/${encodeURIComponent(GAME)}/${encodeURIComponent(name)}`, { method: "POST", body: blob });
  const j = await r.json();
  status(`exported ${clips.length} clips -> ${j.path || name}`);
}

/* ---------- storyboard ---------- */
async function renderStoryboard() {
  const v = $("#boardView"); v.innerHTML = "";
  v.append(el("h2", {}, "Storyboard"), el("p", { class: "muted" }, "Every node in flow order: scenes as frames from the player's eye (one per clip, plus seam looks), tasks, choices and endings. This is the reference Claude builds to in Unreal."),
    el("div", { class: "row" }, el("button", { class: "primary", on: { click: drawBoard } }, "Draw the storyboard"), el("span", { id: "sbProg", class: "muted" })));
  v.append(el("div", { id: "sb" }));
}
async function drawBoard() {
  const host = $("#sb"); host.innerHTML = "";
  const order = [], seen = new Set(), q = [S.game.start];
  while (q.length) { const id = q.shift(); if (!S.flow[id] || seen.has(id)) continue; seen.add(id); order.push(id); for (const o of outs(id)) q.push(o.to); }
  for (const id of Object.keys(S.flow)) if (!seen.has(id)) order.push(id);
  let k = 0;
  for (const nid of order) {
    k++; $("#sbProg").textContent = `${k}/${order.length}`;
    const n = S.flow[nid], ref = nodeRef(n), box = el("div", { class: "sb-node" }), strip = el("div", { class: "sb-strip" });
    box.append(el("h3", {}, `${nid} · ${n.type}` + (ref && ref.title ? ` · ${ref.title}` : n.title ? ` · ${n.title}` : "") + (ref && ref.mood ? ` · ${ref.mood}` : "")));
    if (n.type === "scene" && ref) {
      flowStage.setWorld(PLAN, S, ref.level || Object.keys(S.levels)[0]);
      const tl = flowStage.timeline(ref);
      if (ref.enter) strip.append(el("div", { class: "sb-card" }, el("b", {}, "IN"), el("div", {}, `${ref.enter.kind} ${ref.enter.secs || ""} s`)));
      for (const s of tl.segs) {
        if (s.type === "clip") {
          const T = s.start + s.dur * 0.45, { url } = flowStage.thumb(ref, T, FILES, 400, 225), c = s.clip;
          strip.append(el("div", { class: "sb-frame" }, el("img", { src: url }), el("div", {}, el("b", {}, `${c.id}`), ` · ${c.shot || "free"} · ${s.dur.toFixed(1)} s${c.dur ? "" : " est"}`),
            el("div", { class: "line" }, `${c.who}: “${c.en || ""}”`), c.act ? el("div", { class: "muted" }, c.act) : null,
            c.body && c.body.block ? el("div", { class: "muted" }, "body: " + c.body.block.map(b => b.pose + (b.ease === "snap" ? "!" : "")).join(" → ")) : null));
        }
        if (s.type === "seam") {
          const { url } = flowStage.thumb(ref, (s.start + s.end) / 2, FILES, 400, 225);
          strip.append(el("div", { class: "sb-frame", style: "width:150px" }, el("img", { src: url }), el("div", { class: "muted" }, `seam: ${s.seam.kind}${s.seam.look ? " → " + s.seam.look : ""}`)));
        }
        if (s.type === "event") strip.append(el("div", { class: "sb-card", style: "border-color:var(--bad)" }, el("b", {}, "⚡ " + s.event.type), el("div", {}, s.event.prompt || ""), el("div", { class: "muted" }, `${eventSecs(s.event, S)} s · results: ${eventResults(s.event).join(", ")}`),
          ...(s.event.type === "choose" ? (s.event.options || []).map(o => el("div", { class: "muted" }, `${o.id === s.event.default ? "⏱ " : ""}${o.label}${o.karma !== undefined ? "  (karma " + JSON.stringify(o.karma) + ")" : ""}`)) : [])));
      }
    } else if (n.type === "stitch" && ref) {
      const its = (S.interrupts || []).filter(it => it.during === "all" || (it.during || []).includes(n.ref));
      strip.append(el("div", { class: "sb-card", style: "width:520px;border-color:var(--stitch)" }, el("b", {}, "PLAYER TASK" + (ref.template ? " · " + ref.template : "")), el("div", {}, ref.goal || ((ref.beats || []).flatMap(b => b.do || []).find(a => a.objective) || {}).objective || ""), el("div", { class: "muted" }, `~${ref.target_min || "?"} min · ${(ref.beats || []).length} beats`),
        ref.timer ? el("div", { class: "warnc" }, `⏱ ${ref.timer.secs} s ${ref.timer.label || ""} → fail: ${ref.timer.fail}`) : null,
        its.length ? el("div", { class: "err" }, "☠ " + its.map(i => `${i.label || i.id} → ${i.to}`).join("; ")) : null));
    } else if (n.type === "choice") strip.append(el("div", { class: "sb-card", style: "width:520px;border-color:var(--choice)" }, el("b", {}, `CHOICE by ${n.by}`), el("div", {}, n.prompt || ""), ...(n.options || []).map(o => el("div", { class: "muted" }, `→ ${o.label || o.result || (n.by === "karma" ? "karma " + karmaLabel(o) : (o.if || ["otherwise"]).join("&"))}: ${o.to}`))));
    else strip.append(el("div", { class: "sb-card", style: "border-color:var(--ending)" }, el("b", {}, `ENDING · ${n.kind}`), el("div", {}, n.title || "")));
    box.append(strip); host.append(box);
    await new Promise(r => setTimeout(r, 0));
  }
  $("#sbProg").textContent = `${order.length} nodes`;
  window.__boardDone = true;
  showStage();
}

/* ---------- the animatic (Watch) ---------- */
let RUN = null;
setWords(w => S ? wordOf(S, w, RUN ? RUN.flags : new Set(), RUN ? RUN.counters : {}) : null);   // {her}: the game's words, by the run's flags and counters (§9.14)
const sleep = ms => new Promise(r => { const t = setTimeout(r, ms); RUN && RUN.timers.push(t); });
function wclear() { $("#watchBox").querySelectorAll(".wcard,.qte,.warnmark").forEach(e => e.remove()); }
async function fade(to, secs) { const b = $("#watchOv .black"), from = +b.style.opacity || 0, t0 = performance.now(), d = Math.max(0.05, secs) * 1000; while (RUN) { const u = Math.min(1, (performance.now() - t0) / d); b.style.opacity = from + (to - from) * u; if (u >= 1) break; await new Promise(r => requestAnimationFrame(r)); } }
function wclock() { if (RUN) { $("#wClock").textContent = `story time ${Math.floor(RUN.secs / 60)}:${String(Math.round(RUN.secs % 60)).padStart(2, "0")}`; $("#wKarma").textContent = " · karma " + (Object.entries(RUN.karma).map(([k, v]) => (k === "karma" ? "" : k + " ") + (v > 0 ? "+" : "") + v).join(" ") || "0"); } }
// achievements (STORY_FORMAT §9.13): a secret found, an ending reached or a flag set unlocks one, said in the corner
function achieved(nid) {
  if (!RUN || !S.achievements) return;
  RUN.achieved = RUN.achieved || new Set();
  for (const [id, a] of Object.entries(S.achievements)) {
    const f = a.for || {}, sec = f.secret && (S.secrets || {})[f.secret];
    if (RUN.achieved.has(id) || !(f.ending ? f.ending === nid : sec ? RUN.flags.has(sec.flag) : f.flag ? RUN.flags.has(f.flag) : false)) continue;
    RUN.achieved.add(id);
    let box = $("#watchBox .wachs"); if (!box) { box = el("div", { class: "wachs" }); $("#watchBox").append(box); }
    const card = el("div", { class: "wach" }, el("div", { class: "muted" }, "ACHIEVEMENT"), el("b", {}, a.title || id), a.text ? el("div", { class: "muted" }, a.text) : null);
    box.append(card); setTimeout(() => card.remove(), 6000);
  }
}
function karmaAct(acts, t) { for (const a of acts || []) { if (a.flag) RUN.flags.add(a.flag); if (a.karma !== undefined) addKarma(RUN.karma, a.karma); if (a.count) RUN.counters[a.count] = a.set !== undefined ? +a.set : (RUN.counters[a.count] || 0) + +(a.add ?? 1); if (a.state && RUN.lives) RUN.lives.set(a.state, a.to, t ?? RUN.secs); if (a.skip && RUN.lives) RUN.lives.skip(t ?? RUN.secs, +a.skip); } wclock(); }
// the little things with a life (docs/IMMERSION.md): {id: {life, d}}, their dicts from the story, their lives from the plan
function lifeThings() {
  const out = {}, th = things();
  for (const lv of Object.values(S.levels || {})) for (const r of lv.rooms || []) for (const p of r.props || []) if (th[p.id] && th[p.id].life) out[p.id] = { life: th[p.id].life, d: p };
  return out;
}
// the run's little things drawn as they are at time T (the next render shows them)
function lifeTick(stage, T) { if (stage.life && RUN && RUN.lives) stage.life.update(T, id => ({ st: RUN.lives.at(id, T), hist: RUN.lives.history(id) })); }
// a scene's cues that set a state, at their times on its timeline (a clip's start or end, plus its offset)
function stateCues(tl, ver) {
  const out = [];
  for (const cu of ver.cues || []) {
    if (!cu.do || !(cu.do.state || cu.do.skip)) continue;
    const a = cu.at || {}, sg = tl.segs.find(s => s.type === "clip" && s.clip.id === a.clip && !s.answer);
    if (sg) out.push({ t: (a.edge === "end" ? sg.end : sg.start) + (+a.offset || 0), id: cu.do.state, to: cu.do.to, skip: +cu.do.skip || 0 });
  }
  return out.sort((x, y) => x.t - y.t);
}
// a sound cue in the Watch: off the shelf, placed at the cast member or thing it names (else where you are)
function watchSound(c) {
  const n = shelfName(((S.sounds || {})[c.sound] || {}).file); if (!n) return;
  const o = c.at && ((watchStage.cast || {})[c.at] || (watchStage.byId || {})[c.at]), pos = o && o.getWorldPosition ? o.getWorldPosition(o.position.clone()) : null;     // (a spare vector)
  playShelf(n, pos ? { pos, camera: watchStage.camera } : {});
}
// a scene's skin cues (§9.8: a cast member wet, sweating, dripping, oiled), at their times on its timeline
function skinCues(tl, ver) {
  const out = [];
  for (const cu of ver.cues || []) {
    if (!cu.do || !cu.do.skin) continue;
    const a = cu.at || {}, sg = tl.segs.find(s => s.type === "clip" && s.clip.id === a.clip && !s.answer);
    if (sg) out.push({ t: (a.edge === "end" ? sg.end : sg.start) + (+a.offset || 0), who: cu.do.skin, a: cu.do });
  }
  return out.sort((x, y) => x.t - y.t);
}
function watchSkin(c) { const s = watchStage.setSkin(c.who, c.a); if (RUN && RUN.play) (RUN.play.skinWet = RUN.play.skinWet || {})[c.who] = s; }
// a scene's sound cues, at their times on its timeline: the ones off the sound shelf play in the Watch (sfx.js)
function soundCues(tl, ver) {
  const out = [];
  for (const cu of ver.cues || []) {
    if (!cu.do || !cu.do.sound) continue;
    const a = cu.at || {}, sg = tl.segs.find(s => s.type === "clip" && s.clip.id === a.clip && !s.answer);
    if (sg) out.push({ t: (a.edge === "end" ? sg.end : sg.start) + (+a.offset || 0), sound: cu.do.sound, at: cu.do.at });
  }
  return out.sort((x, y) => x.t - y.t);
}
// the Watch's footer: the Play HUD's footer in the game's theme (or the one picked), so scene subtitles, replies and
// timed choices look as they will in the game: the speaker over the line, the options in their panel under it
let WHUD = null;
function watchHud() {
  const th = $("#wTheme").value || (S && S.game || {}).ui_theme || "glass";
  if (!WHUD || !WHUD.root.isConnected) {
    const root = el("div", { class: "play-hud free" }, el("div", { class: "ph-focus" })), footer = el("div", { class: "ph-footer" }), line = el("div", { class: "ph-line" });
    footer.append(line); root.append(footer); $("#watchBox").append(root); applySettings(root); WHUD = { root, footer, line, theme: null };
  }
  if (WHUD.theme !== th) { loadTheme(th); WHUD.root.dataset.theme = WHUD.theme = th; }
  return WHUD;
}
// a choice in the Watch sits at the bottom centre under the line, the camera's focus on whoever asks, as in Play
function choiceBox(spec, pick, who) {
  const c = chooser(spec, pick), root = watchHud().root, f = who && watchStage.cast[who];
  const fl = docked(root, c, f ? () => besideAt(watchStage.camera, f, root.clientWidth, root.clientHeight) : null);
  return { box: { remove: fl.remove }, c };
}
// a reply: two or three answers (each with its thought under it, if it has one); she waits (her idle keeps going), then carries on
function runReply(rp, frame, who) {
  freePointer();
  return new Promise(resolve => {
    const secs = +(rp.wait || REPLY_SECS), opts = (rp.options || []).filter(o => holds(o, RUN.flags, RUN.counters)), t0 = performance.now();   // offered by what's happened (§9.14)
    const { box, c } = choiceBox({ options: opts.map(o => ({ label: o.label || o.id, think: o.think })), timed: false }, i => finish(opts[i].id), who);   // waits for an answer (DECISIONS 2026-10-30)
    let done = false;
    const finish = id => { if (done) return; done = true; window.removeEventListener("keydown", c.keys, true); box.remove(); resolve(id); };
    window.addEventListener("keydown", c.keys, true);
    const tick = () => { if (done) return; if (!RUN) return finish(null); frame(Math.min((performance.now() - t0) / 1000, secs)); requestAnimationFrame(tick); };   // her wait as recorded, then held
    requestAnimationFrame(tick);
  });
}
const LOOK = { yaw: 0, pitch: 0, moved: 0 };
function wireLook() {
  const box = $("#watchBox");
  box.addEventListener("mousemove", e => {
    if (document.pointerLockElement === box) {        // walking's locked pointer: the look follows the mouse's moves
      LOOK.yaw = Math.max(-35, Math.min(35, LOOK.yaw + e.movementX * 0.12)); LOOK.pitch = Math.max(-20, Math.min(20, LOOK.pitch - e.movementY * 0.12)); LOOK.moved = performance.now(); return; }
    const r = box.getBoundingClientRect(); LOOK.yaw = ((e.clientX - r.left) / r.width - 0.5) * 70; LOOK.pitch = -((e.clientY - r.top) / r.height - 0.5) * 40; LOOK.moved = performance.now(); });
}
const BLEND = { kind: "blend", secs: 0.8 };        // a scene's enter and exit when it names none (STORY_FORMAT §3.1)
async function watchScene(sc, nid, sid, k) {
  const lvl = sc.level || Object.keys(S.levels)[0];
  if ((sc.faces || []).length) await loadFaces(sc.faces);   // the expressions its face rows place
  if (watchStage.level !== lvl) watchStage.setWorld(PLAN, S, lvl);   // a scene on the level you're in keeps it as play left it
  const picks = {}, replied = new Set();
  let tl = watchStage.timeline(sc, picks);
  const en = sc.enter || BLEND, cam = watchStage.camera;
  const live = (sc.camera || {}).mode === "live", lrt = live && RUN.play;   // live: the eye stays the player's (play's runtime keeps the look and the walk)
  const from = { p: cam.position.clone(), q: cam.quaternion.clone(), fov: cam.fov, black: +$("#watchOv .black").style.opacity || 0 };
  watchStage.apply(tl, watchStage.stateAt(tl, 0, FILES), 0, { noCamera: live });
  if (lrt) lrt.liveStart();
  if (live) { if (from.black > 0.01) await fade(0, en.kind === "cut" ? 0.05 : (en.secs || 0.6)); else $("#watchOv .black").style.opacity = 0; }
  else if (en.kind === "blend") await blendIn(tl, from, +(en.secs || 0.8));
  else { watchStage.render(); if (en.kind !== "cut") await fade(0, en.secs || 0.6); else $("#watchOv .black").style.opacity = 0; }
  let T = 0, last = performance.now(), spoken = null, warned = null;
  const cues = stateCues(tl, sc), t0 = RUN ? RUN.secs : 0;   // the little things set by its cues, at their clip edges
  const sounds = soundCues(tl, sc);                         // and its sounds, off the shelf
  const skins = skinCues(tl, sc);                           // and its cast's skin, wet or oiled
  while (RUN && T < tl.total) {
    await new Promise(r => requestAnimationFrame(r));
    if (!RUN) break;                                       // stopped while it waited for the frame
    const now = performance.now(), dtf = (now - last) / 1000; T += dtf; last = now;
    while (cues.length && cues[0].t <= T && RUN.lives) { const c = cues.shift(); if (c.skip) RUN.lives.skip(t0 + c.t, c.skip); else RUN.lives.set(c.id, c.to, t0 + c.t); }
    while (sounds.length && sounds[0].t <= T) { const c = sounds.shift(); if (T - c.t < 0.5) watchSound(c); }
    while (skins.length && skins[0].t <= T) watchSkin(skins.shift());
    const st = watchStage.stateAt(tl, T, FILES, LOOK);
    if (st.seg && st.seg.type === "event" && !RUN.done.has(st.seg)) { RUN.done.add(st.seg); const ev = st.seg.event, res = await runEvent(ev); RUN.results[nid] = res; karmaAct((ev.on || {})[res]);
      if (ev.type === "choose") { const o = (ev.options || []).find(x => x.id === res); if (o && o.karma !== undefined) { addKarma(RUN.karma, o.karma); RUN.answers.push(`${o.label} (${JSON.stringify(o.karma)})`); } }
      RUN.secs += eventSecs(ev, S); wclock(); T = st.seg.end; last = performance.now(); continue; }
    if (st.seg && st.seg.type === "reply" && !replied.has(st.seg.clip.id)) {
      const c = st.seg.clip, T0 = st.seg.start; replied.add(c.id); stopTakes();
      const tw = watchStage.timeline(sc, Object.assign({}, picks, { [c.id]: null }));     // waiting: the whole wait, her idle running
      const id = await runReply(c.reply, u => { const tt = T0 + u, s2 = watchStage.stateAt(tw, tt, FILES, LOOK); watchStage.apply(tw, s2, tt, { noCamera: live }); if (lrt) lrt.liveTick(0.016); watchStage.render();
        paintOv("#watchOv", { sub: c.en, speaker: c.who, who: `${sc.title || ""} · ${c.who || ""}` }); }, c.who);    // the question stays up, the options under it, while she waits
      picks[c.id] = id;
      const o = (c.reply.options || []).find(x => x.id === (id === null ? c.reply.timeout : id));
      if (o) karmaAct(o.sets);
      RUN.answers.push(`${c.id}: ${o ? o.label : "(silence)"}`);
      tl = watchStage.timeline(sc, picks);
      const rs = tl.segs.find(s => s.type === "reply" && s.clip.id === c.id); T = rs ? rs.end : T; last = performance.now(); continue;
    }
    const nextEv = tl.segs.find(s => s.type === "event" && s.start > T && s.event.warn && s.start - T < +s.event.warn);
    if (nextEv && warned !== nextEv) { warned = nextEv; const w = el("div", { class: "warnmark" }, "!"); $("#watchBox").append(w); setTimeout(() => w.remove(), +nextEv.event.warn * 1000); }
    watchStage.apply(tl, st, T, { noCamera: live }); if (lrt) lrt.liveTick(Math.min(0.05, dtf)); lifeTick(watchStage, t0 + T); watchStage.render();
    let sub = st.sub, glitch = 0;
    if (st.typing) { const y = st.typing, s = typedAt(named(y.text), { retype: y.retype && named(y.retype), breaks: y.breaks }, y.t); glitch = s.glitch; sub = glitch ? glitched(s.shown, glitch, Math.floor(y.t * 20)) : s.shown; }   // a thought typing itself out (§9.15)
    paintOv("#watchOv", { sub, glitch, speaker: st.clipSeg ? st.who : "", think: st.think, who: st.clipSeg ? `${sc.title || ""} · ${st.who || ""}` : "", black: st.black, tag: st.seg && st.seg.type === "seam" ? "" : "" });
    if (st.clipSeg && spoken !== st.clipSeg) { spoken = st.clipSeg; playTake("#watchBox", sid, k, st.clipSeg.clip, $("#wVideo").checked); }
    if (st.seg && st.seg.type !== "clip") stopTakes();
    if (RUN.skip) { RUN.skip = false; const ne = tl.segs.find(s => (s.type === "event" && s.start > T && !RUN.done.has(s)) || (s.type === "reply" && s.start > T && !replied.has(s.clip.id))); if (ne) { T = ne.start; continue; } break; }   // dev skip: to the next event or reply, else the scene's end
  }
  if (RUN) while (cues.length && RUN.lives) { const c = cues.shift(); if (c.skip) RUN.lives.skip(t0 + c.t, c.skip); else RUN.lives.set(c.id, c.to, t0 + c.t); }   // skipped to its end: its states still change
  if (RUN) while (skins.length) watchSkin(skins.shift());
  if (lrt) lrt.liveEnd();
  stopTakes(); paintLine(watchHud().line, "");          // the scene's last line goes with it (play may follow straight on)
  if (!RUN) return;
  RUN.secs += tl.total; wclock();
  karmaAct(sc.sets);
  const ex = sc.exit || BLEND;
  if (ex.kind !== "blend") await fade(1, ex.kind === "cut" ? 0.05 : ex.secs || 0.6);   // a blend: what follows carries on from this view
  return tl.go ? tl.go.node : null;                     // the card an answer sent the flow to, if one did
}
// the view eases from where the eye was (the player walking, or the last scene) into the scene's first framing; the
// figures hold their first pose meanwhile; any black lifts with it
async function blendIn(tl, from, secs) {
  const c = watchStage.camera, t0 = performance.now();
  while (RUN) {
    const u = Math.min(1, (performance.now() - t0) / 1000 / Math.max(0.05, secs)), k = u * u * (3 - 2 * u);
    watchStage.apply(tl, watchStage.stateAt(tl, 0, FILES, LOOK), 0);
    const to = { p: c.position.clone(), q: c.quaternion.clone(), fov: c.fov };
    c.position.lerpVectors(from.p, to.p, k); c.quaternion.slerpQuaternions(from.q, to.q, k); c.fov = from.fov + (to.fov - from.fov) * k; c.updateProjectionMatrix();
    watchStage.render(); $("#watchOv .black").style.opacity = from.black * (1 - k);
    if (u >= 1) break;
    await new Promise(r => requestAnimationFrame(r));
  }
}
const freePointer = () => { if (document.pointerLockElement) document.exitPointerLock(); };     // a card or a QTE needs the pointer
function runChoose(ev) {              // a choice: it waits for the player's answer (DECISIONS 2026-10-30: no timed choices)
  freePointer();
  return new Promise(resolve => {
    const opts = ev.options || [];
    const { box, c } = choiceBox({ options: opts.map(o => ({ label: o.label || o.id, think: o.think })), timed: false }, i => finish(opts[i].id));
    paintLine(watchHud().line, ev.prompt);                                          // the question is the footer's line
    let done = false;
    const finish = id => { if (done) return; done = true; window.removeEventListener("keydown", c.keys, true); box.remove(); paintLine(watchHud().line, ""); resolve(id); };
    window.addEventListener("keydown", c.keys, true);
    const tick = () => { if (done) return; if (!RUN) return finish(ev.default); requestAnimationFrame(tick); };   // only a stopped run ends it
    requestAnimationFrame(tick);
  });
}
function runEvent(ev) {
  if (ev.type === "choose") return runChoose(ev);
  freePointer();
  return new Promise(resolve => {
    const secs = eventSecs(ev, S), box = el("div", { class: "qte" }), bar = el("div", { class: "bar" }, el("div", {})), key = (ev.key || "E").toUpperCase();
    let done = false, score = 0, held = false, t0 = performance.now(), lastMove = null;
    const finish = r => { if (done) return; done = true; window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("mousemove", mv); window.removeEventListener("mousedown", md); box.remove(); resolve(r); };
    const mash = () => { score += 1 / Math.max(4, (ev.need || 0.6) * 20); };       // mash and struggle: presses, `need` sets how many
    const kd = e => { if (ev.type === "struggle" && !e.repeat && (e.key.toUpperCase() === key || e.code === "Space")) { e.preventDefault(); return mash(); }
      if (e.key.toUpperCase() !== key) return; if (ev.type === "press") finish("success"); if (ev.type === "mash" && !e.repeat) mash(); if (ev.type === "hold") held = true; };
    const md = e => { if (ev.type === "struggle" && e.button === 0) mash(); };       // a struggle: E, Space or the left button, as fast as you can
    const ku = e => { if (ev.type === "hold" && e.key.toUpperCase() === key && held) finish("fail"); };
    const mv = e => { if (ev.type === "breath") { if (lastMove && Math.hypot(e.movementX, e.movementY) > 6) finish("fail"); lastMove = 1; } };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("mousemove", mv); window.addEventListener("mousedown", md);
    const label = { press: `Press <${key}>`, mash: `Mash <${key}>`, hold: `Hold <${key}>`, breath: "Keep still (don't move the mouse)", aim: "Click the mark", struggle: `Mash <${key}> or click!` }[ev.type];
    box.append(el("div", { style: "font-size:20px" }, ev.prompt || ""), ...(label ? [el("div", { class: "key" }, label)] : []), bar);
    if (ev.type === "aim") { const dot = el("button", { style: "position:fixed;width:26px;height:26px;border-radius:13px;background:var(--bad);left:" + (30 + Math.random() * 40) + "%;top:" + (25 + Math.random() * 35) + "%", on: { click: () => finish("success") } }); box.append(dot); }
    $("#watchBox").append(box);
    const tick = () => { if (done || !RUN) return finish("fail");
      const u = (performance.now() - t0) / (secs * 1000);
      bar.firstChild.style.width = (ev.type === "mash" || ev.type === "struggle" ? Math.min(100, score * 100) : Math.max(0, 100 - u * 100)) + "%";
      if (score >= 1) return finish(ev.type === "struggle" ? "escape" : "success");
      if (u >= 1) { if (ev.type === "hold") return finish(held ? "success" : "fail"); if (ev.type === "breath") return finish("success"); if (ev.type === "struggle") return finish("caught"); return finish("fail"); }
      requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}
// a round's seeker in the Watch, behind its card: her `loops` by the round's phase (count, then search, then chase;
// found when she finds you), each the motions table's take when made, its stand-in blocking until then, else a pose
// for the role; seen from where the last scene on this level left the player, she where it left her (else in front
// of the player, facing them)
function roundSeeker(pl, lvl) {
  const cid = pl.seeker, th = things(); if (!cid || !watchStage.cast[cid] || !RUN) return null;
  let spot = null, view = null;                  // where the last scene on this level left her, and the player
  for (const nid of [...RUN.trail].reverse()) {
    const n = S.flow[nid], sc = n && n.type === "scene" && S.scenes[n.ref]; if (!sc) continue;
    const v = version(sc), sp = (v.stage || {})[cid];
    if (!view && v.view && th[v.view] && th[v.view].level === lvl) view = v.view;
    if (sp && th[sp] && th[sp].level === lvl) { spot = sp; break; }
  }
  const start = view || S.levels[lvl].start, at = th[spot || start]; if (!at) return null;
  watchStage.frame({ view: start, camera: { mode: "soft", look: spot ? cid : null }, clips: [{ id: "x", who: "", en: "" }], stage: spot ? { [cid]: spot } : {} }, 0, FILES);
  const a = (at.yaw || 0) * Math.PI / 180, P = spot ? [at.pos[0], at.pos[2] || 0, -at.pos[1]]   // her spot, else 2.4 m in front of the player, turned to them
    : [at.pos[0] + Math.cos(a) * 2.4, at.pos[2] || 0, -(at.pos[1] + Math.sin(a) * 2.4)], R = ((spot ? at.yaw || 0 : (at.yaw || 0) + 180) + 90) * Math.PI / 180;
  const h = +((S.cast || {})[cid] || {}).height || 1.7, t0 = performance.now(), loops = pl.loops || {};
  const seek = { phase: "count", stopped: false, stop() { this.stopped = true; } };
  const tick = () => {
    const f = watchStage.cast[cid]; if (seek.stopped || !RUN || !f) return;
    const t = (performance.now() - t0) / 1000, ph = seek.phase, mid = loops[ph] || (ph === "chase" ? loops.search : null) || loops.idle, m = mid && (S.motions || {})[mid];
    let pos = m ? M.tableMotionPose(LIB, m, m.name && FILES[m.name + ".json"], t, h, ph === "search" || ph === "chase") : null;
    if (!pos) { let p = M.clonePose(LIB.poses[M.ROLE_POSE[ph]] || LIB.poses.idle); if (ph === "search" || ph === "chase") p = M.walkOverlay(LIB, p, t * (ph === "chase" ? 1.6 : 1)); pos = M.fk(LIB, p, h).pos; }
    f.group.position.set(...P); f.group.rotation.y = R; f.group.visible = true; f.group.updateMatrixWorld(true);
    f.update(pos); watchStage.render(); requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return seek;
}
async function watchStitch(st, nid, n) {
  paintOv("#watchOv", { black: +$("#watchOv .black").style.opacity || 0 });
  const lvl = st.level || Object.keys(S.levels)[0];
  if ($("#wPlay").checked && !st.play) return playStitch(st, n, lvl);
  watchStage.setWorld(PLAN, S, lvl);
  watchStage.frame({ view: S.levels[lvl].start, camera: { mode: "free" }, clips: [{ id: "x", who: "", en: "" }], stage: {} }, 0, FILES);
  await fade(0.25, 0.5);
  const mins = +(st.target_min || 3);
  for (const b of st.beats || []) if (!b.secret || $("#wSecrets").checked) for (const a of b.do || []) { if (a.flag) RUN.flags.add(a.flag); if (a.karma !== undefined && !b.optional) addKarma(RUN.karma, a.karma); if (a.state && RUN.lives) RUN.lives.set(a.state, a.to, RUN.secs); if (a.skip && RUN.lives) RUN.lives.skip(RUN.secs, +a.skip); }
  const its = (S.interrupts || []).filter(it => it.during === "all" || (it.during || []).includes(n.ref));
  if (st.play) {                                   // a round of gameplay: did it go your way?
    const pl = st.play, results = PLAYS[pl.type] || ["success", "fail"], seek = roundSeeker(pl, lvl);
    const res = await new Promise(done => {
      const bar = el("div", { class: "rbar", style: "width:320px;margin:8px auto" }, el("div", {})), t0 = performance.now();
      const card = el("div", { class: "wcard" + (seek ? " round" : "") }, el("div", { class: "muted" }, `GAMEPLAY · ${pl.type}${st.template ? " · " + st.template : ""}`), el("div", { class: "big" }, st.title || ""),
        el("div", {}, pl.rule || ""), pl.warn ? el("div", { class: "muted" }, "warning: " + pl.warn) : null, (pl.spots || []).length ? el("div", { class: "muted" }, "where: " + pl.spots.join(", ")) : null,
        bar, el("div", { class: "muted" }, `${pl.secs} s · how did it go?`),
        pl.seeker ? el("div", { class: "muted" }, `seeker: ${pl.seeker}${pl.loops ? " · loops: " + Object.entries(pl.loops).map(([r, m]) => `${r} ${m}`).join(", ") : ""}`) : null,
        el("div", {}, ...results.map((r, i) => el("button", { class: i ? "" : "primary", style: "margin:4px", on: { click: () => done(r) } }, r.replace(/_/g, " ")))));
      $("#watchBox").append(card);
      const bk = pl.barks || {}, said = new Set();       // her lines through the round: counting, searching, close
      const tk = () => { if (!RUN || !card.isConnected) return; const u = (performance.now() - t0) / 1000 / +pl.secs; bar.firstChild.style.width = Math.max(0, 100 - u * 100) + "%";
        if (seek) seek.phase = u < 0.35 ? "count" : u < 0.7 ? "search" : "chase";
        for (const [at, m] of [[0, "start"], [0.02, "count"], [0.35, "search"], [0.7, "near"]]) if (u >= at && !said.has(m) && bk[m]) { said.add(m); playLine(pickOne(bk[m])); }
        if (u >= 1) return done(results[0]); requestAnimationFrame(tk); }; tk();
      if ($("#wFast").checked) sleep(2000).then(() => done(results[0]));
    });
    if (seek && res !== results[0]) { seek.phase = "found"; await sleep($("#wFast").checked ? 300 : 1400); }   // she finds you
    if (seek) seek.stop();
    wclear(); RUN.results[nid] = res; karmaAct((pl.on || {})[res]); RUN.answers.push(`${st.title || nid}: ${res}`);
    if (res === results[0] && (pl.barks || {}).lost) playLine(pickOne(pl.barks.lost));
    if (res !== results[0] && (pl.spots || []).length > 1) {          // where she caught you: a death can depend on it (pick_by found_at)
      RUN.foundAt = await new Promise(done => { const c2 = el("div", { class: "wcard" }, el("div", { class: "muted" }, "WHERE DID SHE FIND YOU?"),
        ...pl.spots.map(sp => el("button", { class: "primary", style: "margin:4px", on: { click: () => { c2.remove(); done(sp); } } }, sp.replace(/_/g, " ")))); $("#watchBox").append(c2); });
    } else if (res !== results[0] && (pl.spots || []).length === 1) RUN.foundAt = pl.spots[0];
    RUN.secs += +pl.secs; wclock(); await fade(1, 0.4);
    return n.next;
  }
  const result = await new Promise(res => {
    const timer = el("div", { class: "timer" });
    const card = el("div", { class: "wcard" }, el("div", { class: "muted" }, "PLAYER TASK" + (st.template ? " · " + st.template : "")), el("div", { class: "big" }, st.title || ""),
      el("div", {}, st.goal || ((st.beats || []).flatMap(b => b.do || []).find(a => a.objective) || {}).objective || ""),
      el("div", { class: "muted" }, `about ${mins} min of play`), st.timer ? el("div", {}, timer, el("div", { class: "muted" }, st.timer.label || "timed")) : null,
      el("button", { class: "primary", on: { click: () => res({ to: n.next }) } }, "Task done →"),
      ...its.map(it => el("button", { style: "border-color:var(--bad)", on: { click: () => res({ to: it.to, interrupt: true }) } }, "☠ " + (it.label || it.id))));
    $("#watchBox").append(card);
    if (st.timer) { const t0 = performance.now(); const tk = () => { if (!RUN || !card.isConnected) return; const left = st.timer.secs - (performance.now() - t0) / 1000; timer.textContent = Math.max(0, left).toFixed(1); if (left <= 0) return res({ to: st.timer.fail, timeout: true }); requestAnimationFrame(tk); }; tk(); }
    if ($("#wFast").checked && !st.timer) sleep(2000).then(() => res({ to: n.next }));
  });
  wclear();
  RUN.secs += result.timeout ? +st.timer.secs : mins * 60; wclock();
  await fade(1, 0.4);
  return result.to;
}
// Play mode (play/runtime.js): the tasks walked. One runtime for the whole run, so what you carry and the doors you
// opened stay; after a scene you carry on from where it left your eye (no cut back to a spot)
function playRt() {
  if (!RUN.play) {
    RUN.play = new PlayRuntime(watchStage, S, PLAN, $("#watchBox"), { run: RUN, game: GAME, fade, setTime: t => { RUN.time = t; watchStage.setTime(t); }, playScene: sid => playTriggered(sid), quit: () => stopWatch(), theme: $("#wTheme").value || null, settings: { crouch: { mode: $("#wCrouch").value } }, files: FILES,
      onBeat: (st, b, secs) => DBG.fired(st, b, secs), onFlag: () => achieved() });
    for (const i of RUN.items || []) RUN.play.items.add(i);   // what a start from the debug panel holds
  }
  return RUN.play;
}
function playPlace(rt, lvl) {
  const a = RUN.afterScene; RUN.afterScene = null;
  if (a && a.level === lvl) rt.placeFromCamera(lvl, a.cam);
  else if (rt.level !== lvl) rt.placeAt(lvl, S.levels[lvl].start);
  else rt.enterLevel(lvl);
}
async function playTriggered(sid) {                 // a beat's `scene`: blended in from the player, then back to play
  const sc0 = S.scenes[sid]; if (!sc0 || !RUN) return;
  watchStage.setModels(modelFiles(wearModels(RUN.models || {}, sceneModels(sc0))));   // its own models while it plays (not carried: it isn't on the board)
  await watchScene(version(sc0), sid, sid, sc0.variants ? sc0.pick : null);
  if (RUN) watchStage.setModels(modelFiles(RUN.models));
  return { level: version(sc0).level || Object.keys(S.levels)[0], cam: watchStage.camera };
}
async function playStitch(st, n, lvl) {
  const rt = playRt(), t0 = performance.now();
  playPlace(rt, lvl);
  const its = (S.interrupts || []).filter(it => it.during === "all" || (it.during || []).includes(n.ref));
  const go = rt.runStitch(st, n, its);
  await fade(0, 0.5);
  const r = await go;
  rt.hold();
  RUN.secs += (performance.now() - t0) / 1000; wclock();
  const nx = S.flow[r.to];
  if (r.timeout || !nx || nx.type === "ending" || (nx.type === "stitch" && (S.stitches[nx.ref] || {}).play)) await fade(1, 0.4);   // a scene blends from here, walking goes on
  return r.to;
}
async function playChoice(n) {
  const rt = playRt();
  playPlace(rt, rt.level || (RUN.afterScene && RUN.afterScene.level) || Object.keys(S.levels)[0]);
  const go = rt.runChoice(n);
  await fade(0, 0.4);
  const o = await go;
  rt.hold();
  return o;
}
function watchChoice(n) {
  return new Promise(res => { const card = el("div", { class: "wcard" }, el("div", { class: "muted" }, "THE PLAYER DECIDES (by acting)"), el("div", { class: "big" }, n.prompt || ""), ...(n.options || []).map(o => el("button", { class: "primary", on: { click: () => { card.remove(); res(o); } } }, o.label || JSON.stringify(o.when)))); $("#watchBox").append(card); });
}
/* ---------- the branch map: every node reached keeps its checkpoint; a death lets the player return to one ---------- */
const PKEY = () => `dd.progress.${GAME}`;
function progress() { try { return JSON.parse(localStorage.getItem(PKEY()) || "{}"); } catch (e) { return {}; } }
function saveProgress(p) { try { localStorage.setItem(PKEY(), JSON.stringify(p)); } catch (e) { } }
function snapOf(R) {                                 // a checkpoint: the run as it is, the pocket and the little things too (a retry after a death keeps them)
  const rt = R.play, T = rt ? rt.now() : R.secs;
  return { secs: R.secs, flags: [...R.flags], results: R.results, karma: R.karma, counters: R.counters, answers: R.answers, trail: R.trail, todo: R.todo || [], name: R.name, models: R.models || {},
    items: [...((rt && rt.items) || R.items || [])],
    states: R.lives ? Object.fromEntries(Object.keys(R.lives.things).map(id => [id, (R.lives.at(id, T) || {}).state]).filter(([, st]) => st)) : {} };
}
function reach(nid) {                              // the first arrival's state is the checkpoint
  const p = progress(); p.visited = p.visited || {};
  if (!p.visited[nid]) p.visited[nid] = snapOf(RUN);
  if (S.flow[nid].type === "ending") p.endings = [...new Set([...(p.endings || []), nid])];
  saveProgress(p);
}
async function watch(fromNid, snap) {
  if (!S) return;
  stopWatch();
  RUN = { secs: 0, flags: new Set(), results: {}, timers: [], trail: [], done: new Set(), karma: {}, counters: {}, answers: [], items: new Set() };
  if (watchStage) watchStage.setSkin(null);                 // everyone's skin dry again (the `skin` word)
  RUN.lives = new States(LIVES, lifeThings()).start(0);   // the little things: their states through the whole run
  watchStage.soundOn = $("#wThings").checked;
  if (snap) Object.assign(RUN, JSON.parse(JSON.stringify(snap)), { flags: new Set(snap.flags || []), timers: [], done: new Set(), trail: [...(snap.trail || [])], items: new Set(snap.items || []) });
  for (const [id, to] of Object.entries((snap && snap.states) || {})) RUN.lives.set(id, to, 0, "start");   // the little things as the nodes before it leave them (a scene's cue: the TV to static)
  RUN.name = setName(RUN.name || (S.game || {}).player_name, true);   // {name}: the game's until the player types theirs (a `name` action)
  watchStage.runState = RUN;                            // its flags and counters: the lines and faces it leaves out (§9.14)
  DBG.reset();
  wclock();
  $("#watchOv .black").style.opacity = 1;
  let nid = fromNid || S.game.start, guard = 0;
  RUN.time = (flowTimes(S)[nid] || {}).time || S.game.time || TIME_DEFAULT; watchStage.setTime(RUN.time);   // from any node: its time
  if (!(snap && snap.models)) RUN.models = Object.assign({}, (flowModels(S)[nid] || {}).before);   // and the models the flow brings there (a checkpoint keeps its own)
  while (RUN && nid && S.flow[nid] && guard++ < 300) {
    const n = S.flow[nid]; reach(nid); achieved(nid); RUN.trail.push(nid); $("#wTrail").textContent = RUN.trail.join(" › ");
    if (n.type === "scene" && (S.scenes[n.ref] || {}).time) { RUN.time = S.scenes[n.ref].time; watchStage.setTime(RUN.time); }   // a scene's own time, from here on
    if (n.type === "scene") RUN.models = wearModels(RUN.models || {}, sceneModels(S.scenes[n.ref]));   // a scene's models, from here on
    watchStage.setModels(modelFiles(RUN.models));
    if (n.type === "scene") { let sc0 = S.scenes[n.ref] || {};
      if (sc0.pick_by === "found_at" && RUN.foundAt && (sc0.variants || {})[RUN.foundAt]) sc0 = Object.assign({}, sc0, { pick: RUN.foundAt });   // the death where she caught you
      const to = await watchScene(version(sc0), nid, n.ref, sc0.variants ? sc0.pick : null); nid = (to && S.flow[to]) ? to : n.next;   // an answer may send the flow to another card (§9.9 go)
      if (RUN) RUN.afterScene = (version(sc0).camera || {}).mode === "live" ? null : { level: version(sc0).level || Object.keys(S.levels)[0], cam: watchStage.camera.clone() }; }   // a live scene left the eye where it is
    else if (n.type === "stitch") { const ct = chapterTime(S, n); nid = await watchStitch(S.stitches[n.ref] || {}, nid, n); if (RUN && ct) { RUN.time = ct; watchStage.setTime(ct); } }   // a chapter's time from here on
    else if (n.type === "choice") {
      if (n.by === "act" && $("#wPlay").checked) nid = (await playChoice(n)).to;
      else if (n.by === "act") { paintOv("#watchOv", { black: +$("#watchOv .black").style.opacity || 0 }); await fade(0.3, 0.3); nid = (await watchChoice(n)).to; }
      else if (n.by === "result") nid = (n.options.find(o => o.result === RUN.results[n.of]) || n.options[0]).to;
      else if (n.by === "karma") nid = karmaPick(n, RUN.karma, S).to;
      else if (n.by === "count") nid = (n.options.find(o => { const v = RUN.counters[o.count] || 0; return (o.min === undefined || v >= o.min) && (o.max === undefined || v <= o.max); }) || n.options[n.options.length - 1]).to;
      else nid = (n.options.find(o => (o.if || []).every(f => f.startsWith("!") ? !RUN.flags.has(f.slice(1)) : RUN.flags.has(f))) || n.options[n.options.length - 1]).to;
    } else {
      const death = n.kind === "death", rt = n.retry && S.flow[n.retry];
      freePointer();
      $("#watchOv .black").style.opacity = death ? 0.8 : 0.6; paintOv("#watchOv", { sub: "", who: "" });
      $("#watchBox").append(el("div", { class: "wcard" + (death ? " death" : "") }, el("div", { class: "muted" }, death ? "YOU DIED" : "ENDING · " + (n.kind || "")), el("div", { class: "big" }, n.title || nid),
        n.text ? el("div", { class: "etext" }, named(n.text)) : null,   // its title card's words, as long as they need (§9.14)
        el("div", { class: "muted" }, `${(RUN.secs / 60).toFixed(1)} min of story time on this path`), el("div", { class: "muted" }, "karma " + JSON.stringify(RUN.karma) + (Object.keys(RUN.counters).length ? " · " + JSON.stringify(RUN.counters) : "") + (RUN.answers.length ? " · " + RUN.answers.join("; ") : "")),
        el("div", {}, rt ? el("button", { class: "primary", style: "margin:4px", on: { click: () => { const p = progress(); watch(n.retry, (p.visited || {})[n.retry]); } } }, "Return to: " + ((nodeRef(rt) || {}).title || rt.title || n.retry)) : null,
          el("button", { style: "margin:4px", on: { click: () => openBranches(n.retry || nid) } }, "Branch map"))));
      window.__watchEnd = n.title || nid; break;
    }
  }
  if (RUN && !nid && RUN.trail.length) {           // the flow's cut here (sliced on the board, §2): said, not a silent stop
    const last = RUN.trail[RUN.trail.length - 1];
    freePointer(); $("#watchOv .black").style.opacity = 0.6; paintOv("#watchOv", { sub: "", who: "" });
    $("#watchBox").append(el("div", { class: "wcard" }, el("div", { class: "muted" }, "THE FLOW'S CUT HERE"), el("div", { class: "big" }, nodeTitle(last, S.flow[last] || {})),
      el("div", { class: "muted" }, "nothing comes after this card yet: drag its stub onto the card that does"),
      el("div", {}, el("button", { class: "primary", style: "margin:4px", on: { click: () => { stopWatch(); openView("flowView"); selectNode(last); if (BOARD) BOARD.center(last); } } }, "Show it on the board"))));
    window.__watchEnd = "cut:" + last;
  }
}
function openBranches(hl) { document.querySelector('nav button[data-v="branchView"]').click(); renderBranches(hl); }
function renderBranches(hl) {
  const v = $("#branchView"); v.innerHTML = ""; if (!S) return;
  const p = progress(), seen = p.visited || {}, ends = new Set(p.endings || []);
  const ids = Object.keys(S.flow), allEnds = ids.filter(k => S.flow[k].type === "ending");
  v.append(el("div", { class: "row" }, el("h2", { style: "margin:0" }, "Branch map"),
    el("span", { class: "muted" }, `${ids.filter(k => seen[k]).length} / ${ids.length} reached · endings ${allEnds.filter(k => ends.has(k)).length} / ${allEnds.length} · click a reached node to play from it (its state as you first got there)`),
    el("button", { on: { click: () => { if (confirm("Forget every branch reached in " + GAME + "?")) { saveProgress({}); renderBranches(); } } } }, "Reset progress")));
  const pos = BOARD ? BOARD.layout() : {}, wrap = el("div", { class: "bmap" }); let W = 0, Hh = 0;
  for (const q of Object.values(pos)) { W = Math.max(W, q.x + 220); Hh = Math.max(Hh, q.y + 90); }
  let svg = `<svg width="${W}" height="${Hh}" style="position:absolute;left:0;top:0">`;
  for (const id of ids) for (const o of outs(id)) { const a = pos[id], t = pos[o.to]; if (!a || !t) continue; const both = seen[id] && seen[o.to];
    svg += `<path d="M${a.x + 176},${a.y + 27} C${a.x + 206},${a.y + 27} ${t.x - 30},${t.y + 27} ${t.x},${t.y + 27}" stroke="${both ? "#9a978f" : "#3a3a42"}" fill="none" stroke-width="${both ? 2 : 1.2}" ${both ? "" : 'stroke-dasharray="4 4"'}/>`; }
  wrap.innerHTML = svg + "</svg>"; wrap.style.width = W + "px"; wrap.style.height = Hh + "px";
  for (const id of ids) {
    const n = S.flow[id], q = pos[id], got = !!seen[id], ref = nodeRef(n);
    const choiceName = { result: "what happened", karma: "who you've been (karma)", count: "how many times", flag: "what you found", act: "what you do" }[n.by];
    const title = got ? ((ref && ref.title) || n.title || n.prompt || (n.type === "choice" ? choiceName : "") || id) : "?";
    const kind = n.type === "ending" ? (n.kind === "death" ? "death" : "ending · " + n.kind) : n.type === "stitch" && ref && ref.play ? "gameplay · " + ref.play.type : n.type;
    const card = el("div", { class: `bcard ${n.type}${got ? " got" : " locked"}${id === hl ? " hl" : ""}${n.kind === "death" ? " deathc" : ""}`, style: `left:${q.x}px;top:${q.y}px`, title: got ? "play from here" : "not reached yet",
      on: { click: () => { if (!got) return; document.querySelector('nav button[data-v="watchView"]').click(); watch(id, seen[id]); } } },
      el("div", { class: "t" }, kind), el("div", { class: "n" }, title), got && n.type === "ending" && ends.has(id) ? el("div", { class: "m" }, "seen") : null);
    wrap.append(card);
  }
  v.append(wrap);
  window.__branchDone = true;
}
function stopWatch() { stopTakes(); if (watchStage) { watchStage.soundOn = false; watchStage.runState = null; if (watchStage.life && watchStage.life.sound) watchStage.life.sound.stop(); } if (RUN) { RUN.timers.forEach(clearTimeout); if (RUN.play) RUN.play.stop(); RUN = null; } wclear(); paintOv("#watchOv", {});
  if (SYNC_AFTER_WATCH) { const w = SYNC_AFTER_WATCH; SYNC_AFTER_WATCH = null; syncFromDisk(w); } }
document.addEventListener("keydown", e => { if (e.key === "Escape" && RUN && $("#wSkip").checked && !(RUN.play && RUN.play.active)) RUN.skip = true; });   // in Play, Esc pauses

/* ---------- takes and notes ---------- */
function renderClips() {
  const v = $("#clipsView"); v.innerHTML = ""; if (!S) return; const max = S.game.clip_max || 10; let rec = 0, all = 0;
  const ANS = new Set();
  const v3 = (S.format || 2) >= 3, prompts = [], loaded = allClips().filter(x => TAKES[x.id]).length;
  const tb = el("table", {}, el("tr", {}, ...["take id", "scene", "ver", "clip", "who", "ja", "en", "act", "shot", "event", "secs", "seam in", ...(v3 ? ["MiniMax prompt", ""] : [])].map(h => el("th", {}, h))));
  for (const [sid, sc] of Object.entries(S.scenes || {})) {
    const vers = sc.variants ? Object.entries(sc.variants) : [[null, sc]];
    for (const [k, ver] of vers) (ver.clips || []).flatMap(c => [c, ...((c.reply && c.reply.options) || []).flatMap(o => thenClips(c, o)).map(t => { ANS.add(t); return t; })]).forEach((c, i) => {
      all++; if (c.dur) rec++;
      tb.append(el("tr", { style: clipSecs(c) > max ? "background:#4a1f1c" : "" }, el("td", {}, `${GAME}_${sid}_${k || "main"}_${c.id}`), el("td", {}, sid), el("td", {}, (k || "main") + (k && k === sc.pick ? " ★" : "")), el("td", {}, c.id), el("td", {}, c.who || ""),
        el("td", {}, c.ja || ""), el("td", {}, c.en || ""), el("td", { class: "muted" }, c.act || ""), el("td", {}, c.shot || ""), el("td", {}, c.event ? c.event.type : ""),
        el("td", { class: c.dur ? "ok" : "muted", title: TAKES[`${GAME}_${sid}_${k || "main"}_${c.id}`] ? "take loaded" : "" }, (TAKES[`${GAME}_${sid}_${k || "main"}_${c.id}`] ? "▶ " : "") + clipSecs(c).toFixed(1) + (c.dur ? "" : " est") + (c.trim ? ` (trim ${c.trim.in || 0}/${c.trim.out || 0})` : "")), el("td", {}, ANS.has(c) ? "answer" : i ? (c.seam ? c.seam.kind : "MISSING") : "—"),
        ...(v3 ? (() => { const p = minimaxPrompt(c, S.cast); prompts.push(`${GAME}_${sid}_${k || "main"}_${c.id}\n${p}`); return [el("td", { style: "font-size:12px" }, p), el("td", {}, el("button", { on: { click: e => copyText(p, e.target) } }, "copy"))]; })() : [])));
    });
  }
  for (const [lid, ln] of Object.entries(S.lines || {})) {        // barks and one-off lines: takes named by the line id
    all++; if (ln.dur) rec++;
    const pr = minimaxPrompt(ln, S.cast); if (v3) prompts.push(`${lid}\n${pr}`);
    tb.append(el("tr", {}, el("td", {}, lid), el("td", { class: "muted" }, "(line)"), el("td", {}), el("td", {}), el("td", {}, ln.who || ""), el("td", {}, ln.ja || ""), el("td", {}, ln.en || ""),
      el("td", { class: "muted" }, ln.ja_note || ""), el("td", {}), el("td", {}, ln.face === false ? "heard" : ""), el("td", { class: ln.dur ? "ok" : "muted" }, (TAKES[lid] ? "▶ " : "") + (ln.dur ? (+ln.dur).toFixed(1) : "est")), el("td", {}, "—"),
      ...(v3 ? [el("td", { style: "font-size:12px" }, pr), el("td", {}, el("button", { on: { click: e => copyText(pr, e.target) } }, "copy"))] : [])));
  }
  const drop = el("div", { class: "dropzone wide", on: {
    dragover: e => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); drop.classList.add("over"); } }, dragleave: () => drop.classList.remove("over"),
    drop: async e => { e.preventDefault(); drop.classList.remove("over"); await dropTakes([...e.dataTransfer.files]); } } },
    icon("upload", 20), el("div", {}, el("b", {}, "Drop take files here"), el("div", { class: "kv" }, "videos or audio named by their take id (as in the first column): each is stored in Footage/" + GAME + "/ and measured (its length, the dead air at either end). One clip's take can also be dropped on its row in the scene.")));
  v.append(el("h2", {}, `Takes · ${rec}/${all} recorded`), el("p", { class: "muted" }, "Record each row as one MiniMax clip, named by its take id (.wav and .mp4), starting and ending on the anchor frame. Then drop them below (or: python tools/intake.py --game " + GAME + " <folder>)."), drop,
    v3 ? el("div", { class: "row" }, el("button", { on: { click: e => copyText(prompts.join("\n\n"), e.target) } }, "copy every prompt"), el("span", { class: "muted" }, "or python tools/story.py --game " + GAME + " minimax")) : null,
    el("div", { class: "row" }, el("button", { on: { click: pickTakes } }, "Load takes folder…"), el("span", { class: loaded ? "ok" : "muted" }, `${loaded} take files on the timeline`),
      el("button", { class: "primary", disabled: !loaded, title: "measure each take: its length and the dead air at either end, into dur and trim; the subtitles, body and cues follow", on: { click: async () => { const out = $("#cleanOut"); out.textContent = "measuring…"; const rows = await autoClean(false); $("#cleanOut") && ($("#cleanOut").textContent = rows.join("\n") || "no takes matched a take id"); } } }, "Auto-clean"),
      el("button", { disabled: !loaded, title: "measure the lengths again, keeping trims you set by hand", on: { click: async () => { const rows = await autoClean(true); $("#cleanOut") && ($("#cleanOut").textContent = rows.join("\n")); } } }, "re-measure (keep my trims)")),
    el("pre", { id: "cleanOut", class: "muted", style: "white-space:pre-wrap" }), tb);
}
function renderNotes() {
  const v = $("#notesView"); v.innerHTML = ""; if (!S) return; S.board = S.board || []; const all = [];
  for (const [nid] of Object.entries(S.flow)) { const h = notesHost(nid); for (const x of h.notes || []) all.push([x, nid]); }
  for (const x of S.board) all.push([x, "board"]);
  const open = all.filter(([x]) => !x.done), done = all.filter(([x]) => x.done);
  v.append(el("h2", {}, `Open notes · ${open.length}`), el("p", { class: "muted" }, "Leave a note here or on any node and tell Claude \"read the notes\"; Claude answers with notes of its own and ticks what's done."));
  for (const [x, w] of open) v.append(noteEl(x, w));
  const ta = el("textarea", { placeholder: "A note for the whole game…", style: "min-height:60px;max-width:700px" }), by = el("select", {}, el("option", { value: "user" }, "from you"), el("option", { value: "claude" }, "from Claude"));
  v.append(el("h2", {}, "Board"), ta, el("div", { class: "row" }, by, el("button", { on: { click: () => { if (!ta.value.trim()) return; S.board.push({ by: by.value, text: ta.value.trim(), at: today() }); touch(); renderNotes(); } } }, "Add to the board")));
  if (done.length) { v.append(el("h2", {}, `Done · ${done.length}`)); for (const [x, w] of done) v.append(noteEl(x, w)); }
}

/* ---------- the Problems panel: every problem, the story check's too; click one to go there ---------- */
const liveCheck = () => { try { return localStorage.getItem("dd.checkLive") !== "0"; } catch (e) { return true; } };
let checkTimer = null;
function scheduleCheck(ms) {                       // the story check on the story as it is now, once editing pauses
  if (!S || (ms === undefined && !liveCheck())) return;
  clearTimeout(checkTimer); checkTimer = setTimeout(runCheck, ms === undefined ? 8000 : ms);
}
async function runCheck() {
  if (!S || !GAME) return;
  if (CHECK.busy) { CHECK.again = true; return; }
  CHECK.busy = true; const key = LAST, game = GAME; problemsButton();
  try {
    const j = await api("/api/storycheck/" + encodeURIComponent(game), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(S) });
    if (game === GAME) { CHECK.list = checkList(j.errors, j.warnings); CHECK.ok = j.ok; CHECK.summary = j.summary; CHECK.at = Date.now(); CHECK.key = key; }
  } catch (e) { CHECK.summary = "the story check couldn't run: " + e.message; }
  CHECK.busy = false; renderBoard(); problemsButton();
  if (CHECK.again) { CHECK.again = false; runCheck(); }
}
const checkList = (errors, warnings) => [...(errors || []).map(t => ({ sev: "error", text: t, src: "check", at: checkPlace(t) })), ...(warnings || []).map(t => ({ sev: "warn", text: t, src: "check", at: checkPlace(t) }))];
function checkPlace(msg) {                         // the story check names its place first: a beat, a scene and its clip, a node, an entry, a thing
  const toks = msg.split(/[^A-Za-z0-9_]+/).filter(Boolean), th = things();
  const beatAt = id => { for (const [tid, st] of Object.entries(S.stitches || {})) { const i = (st.beats || []).findIndex(b => b.id === id); if (i >= 0) return ["stitches", tid, "beats", i]; } return null; };
  for (const t of toks) {
    const b = beatAt(t); if (b) return placeOf(S, b);
    if ((S.scenes || {})[t]) { const m = msg.match(/clip (\w+)/), cl = version(S.scenes[t]).clips || [], i = m ? cl.findIndex(c => c.id === m[1]) : -1; return placeOf(S, i >= 0 ? ["scenes", t, "clips", i] : ["scenes", t]); }
    if ((S.stitches || {})[t]) return placeOf(S, ["stitches", t]);
    if ((S.flow || {})[t]) return placeOf(S, ["flow", t]);
    for (const tb of ["lines", "motions", "items", "notes", "sounds", "cast", "secrets"]) if ((S[tb] || {})[t]) return placeOf(S, [tb, t]);
    const ii = (S.interrupts || []).findIndex(x => x.id === t); if (ii >= 0) return placeOf(S, ["interrupts", ii]);
    if (th[t]) return { text: `level ${th[t].level} · ${t}`, level: th[t].level };
  }
  return { text: "the story" };
}
function problemsButton() {
  const b = $("#probCount"); if (!b || !S) return;
  const all = allProblems(), e = all.filter(p => p.sev === "error").length, w = all.length - e;
  b.textContent = e ? e : w ? w : "✓"; b.className = "pcount " + (e ? "err" : w ? "warn" : "ok");
  $("#problemsBtn").title = `${e} error${e === 1 ? "" : "s"}, ${w} warning${w === 1 ? "" : "s"}` + (CHECK.busy ? " · the story check is running" : CHECK.summary ? " · " + CHECK.summary : "");
  if ($("#problems")) renderProblems();
}
function toggleProblems(force) {
  const on = $("#problems"); if (on && force !== true) { on.remove(); return; }
  if (!on) { document.body.append(el("div", { id: "problems", class: "ppanel" })); renderProblems(); }
}
function renderProblems() {
  const box = $("#problems"); if (!box || !S) return; box.innerHTML = "";
  const all = allProblems(), e = all.filter(p => p.sev === "error"), w = all.filter(p => p.sev !== "error");
  const ago = CHECK.at ? Math.round((Date.now() - CHECK.at) / 1000) : null;
  box.append(el("div", { class: "pp-h" }, icon("alert", 15), el("b", {}, "Problems"), el("span", { class: "muted" }, `${e.length} error${e.length === 1 ? "" : "s"} · ${w.length} warning${w.length === 1 ? "" : "s"}`), el("span", { class: "grow" }),
    el("button", { class: "ghost", title: "close", on: { click: () => toggleProblems() } }, icon("x", 14))),
    el("div", { class: "pp-sub" }, el("label", { class: "chk", title: "the full story check (every path played) a few seconds after you stop editing" },
      el("input", { type: "checkbox", checked: liveCheck(), on: { change: ev => { try { localStorage.setItem("dd.checkLive", ev.target.checked ? "1" : "0"); } catch (x) { } if (ev.target.checked) scheduleCheck(); } } }), " the story check as I edit"),
      el("button", { class: "small", disabled: CHECK.busy, on: { click: () => runCheck() } }, CHECK.busy ? "running…" : "Run it now"),
      el("span", { class: "kv" }, CHECK.busy ? "the story check is running…" : CHECK.at ? `${CHECK.ok ? "✓ " : ""}${CHECK.summary.replace(/^STORY /, "")}${CHECK.key !== LAST ? " · before your last edit" : ""} · ${ago < 60 ? ago + " s" : Math.round(ago / 60) + " min"} ago` : CHECK.summary || "not run yet")));
  const list = el("div", { class: "pp-list" });
  const row = p => el("div", { class: "pp-row " + (p.sev === "error" ? "err" : "warn") + (p.stale ? " stale" : ""), title: p.src === "check" ? "from the story check" : "from the desk's own checks", on: { click: () => goToProblem(p) } },
    el("span", { class: "pp-i" }, icon(p.sev === "error" ? "x" : "alert", 13)), el("span", { class: "pp-t" }, el("span", {}, p.text), el("span", { class: "pp-at" }, (p.at && p.at.text) || "", p.src === "check" ? " · the story check" : "")));
  if (!all.length) list.append(el("div", { class: "pp-none" }, icon("check", 16), " Nothing wrong found."));
  if (e.length) list.append(el("div", { class: "pp-g" }, "Errors"), ...e.map(row));
  if (w.length) list.append(el("div", { class: "pp-g" }, "Warnings"), ...w.map(row));
  box.append(list);
}
function goToProblem(p) {
  const at = p.at || {};
  if (at.node && S.flow[at.node]) {
    if ($("#watchView").classList.contains("on") || !$("#flowView").classList.contains("on")) openView("flowView");
    if (at.clip && at.scene) { const path = p.path || []; OPEN[at.scene] = { id: at.clip, tab: path.includes("event") ? "event" : path.includes("reply") ? "reply" : path.includes("body") ? "body" : /seam/.test(p.text) ? "camera" : /take|over the/.test(p.text) ? "take" : "line" }; if (at.variant) VTAB[at.scene] = at.variant; }
    selectNode(at.node); if (BOARD) BOARD.center(at.node);
    setTimeout(() => flashIn(at.clip ? `[data-clip="${at.clip}"]` : at.beat ? `[data-beat="${at.beat}"]` : null), 50);
  } else if (at.level) openBuilder(at.level);
  else if (at.db) openDb(at.db, at.id);
  else openDb("game");
}
function flashIn(sel) {
  if (!sel) return; const e = $("#inspector").querySelector(sel); if (!e) return;
  e.scrollIntoView({ block: "center", behavior: "smooth" }); e.classList.add("flash"); setTimeout(() => e.classList.remove("flash"), 1800);
}

/* ---------- wiring ---------- */
function renderAll() { renderBoard(); renderInspector(); if ($("#clipsView").classList.contains("on")) renderClips(); if ($("#notesView").classList.contains("on")) renderNotes(); if ($("#dbView").classList.contains("on")) DB.render(); notesBadge(); }
function notesBadge() {                            // what's left on the desk for the other one to read
  if (!S) return; let n = (S.board || []).filter(x => !x.done).length; for (const nid of Object.keys(S.flow)) n += openNotes(notesHost(nid));
  $("#notesBadge").textContent = n || ""; $("#notesBadge").title = n ? `${n} open note${n > 1 ? "s" : ""}` : "";
}
function openView(v) { document.querySelector(`nav button[data-v="${v}"]`).click(); }
function openDb(tab, id) { openView("dbView"); DB.open(tab, id); }
document.querySelectorAll("nav button").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll("nav button").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("on", v.id === b.dataset.v));
  if (b.dataset.v === "branchView") renderBranches(); if (b.dataset.v === "clipsView") renderClips(); if (b.dataset.v === "notesView") renderNotes(); if (b.dataset.v === "boardView") renderStoryboard(); if (b.dataset.v === "dbView") DB.render();
  if (b.dataset.v !== "watchView") stopWatch(); if (b.dataset.v === "flowView") { flowStage.resize(); showStage(); } if (b.dataset.v === "watchView") watchStage.resize();
}));
$("#save").onclick = () => save();
$("#reload").onclick = () => { if (!DIRTY || confirm("Drop your unsaved edits?")) { dropDraft(); load(); } };
$("#history").onclick = () => historyDialog();
$("#bannerReload").onclick = () => load();
$("#game").onchange = e => { if (DIRTY && !confirm("Drop unsaved edits?")) { e.target.value = GAME; return; } if (DIRTY) dropDraft(); GAME = e.target.value; SEL = null; FILES = {}; if (BOARD) BOARD.viewSet = false; load(); };
$("#newGame").onclick = async () => { const name = prompt("New game's name (letters and digits, e.g. LanternHouse)"); if (!name) return; try { const j = await api("/api/new/" + encodeURIComponent(name), { method: "POST" }); fillGames(j.games); GAME = name; $("#game").value = name; SEL = null; await load(); } catch (e) { alert(e.message); } };
$("#gameSettings").onclick = () => { if (S) openDb(); };
$("#undo").onclick = () => undoTo(UNDO, REDO, "undo");
$("#redo").onclick = () => undoTo(REDO, UNDO, "redo");
$("#playtest").onclick = () => { if (!S) return; openView("watchView"); watch(); };
const TOOLS = [                                    // the desk's other pages, each told the game
  { page: "builder.html", label: "Scene builder", icon: "build", win: "scenebuilder", hint: "a level as a floor plan: rooms, doors, windows, walked from the player's eye" },
  { page: "kimodo.html", label: "Kimodo shot list", icon: "motion", hint: "every motion to make in the demo: prompt, length, constraints, save name" },
  { page: "shape.html", label: "Shape the cast", icon: "person", hint: "each cast member's body (MHR), for the desk and MetaHuman" },
  { page: "poses.html", label: "Poses", icon: "motion", hint: "the pose library the blocking uses" },
  { page: "bodies.html", label: "Bodies", icon: "person", hint: "how a body file in Content/Studio/Bodies follows the blocking" },
  { page: "flesh.html", label: "Fat suit", icon: "wand", hint: "the soft-body experiment (docs/FLESH.md)" },
  { page: "guide.html", label: "The guide", icon: "notes", win: "deskguide", hint: "how to use the desk, every part of it, with pictures" },
];
$("#toolsMenu").onclick = e => {
  document.querySelectorAll(".bmenu").forEach(m => m.remove());
  const r = e.currentTarget.getBoundingClientRect(), m = el("div", { class: "bmenu", style: `left:${Math.round(r.left)}px;top:${Math.round(r.bottom + 4)}px` }, el("div", { class: "bmenu-h" }, "Tools"));
  for (const t of TOOLS) {
    const b = el("button", { class: "bmenu-i", title: t.hint, on: { click: () => { m.remove(); window.open(`${t.page}?game=${encodeURIComponent(GAME || "")}`, t.win || "_blank"); } } }, el("span", { class: "tbi" }), t.label);
    b.querySelector(".tbi").replaceWith(icon(t.icon, 15)); m.append(b);
  }
  document.body.append(m);
  setTimeout(() => window.addEventListener("mousedown", function off(ev) { if (!m.contains(ev.target)) { m.remove(); window.removeEventListener("mousedown", off); } }), 0);
};
for (const b of document.querySelectorAll("[data-ic]")) b.prepend(icon(b.dataset.ic, 16));
$("#keysHelp").onclick = () => {
  const sec = (t, rows) => el("div", { class: "helpsec" }, el("h4", {}, t), ...rows.map(([k, v]) => el("div", { class: "helprow" }, el("kbd", {}, k), el("span", {}, v))));
  modal({ title: "Keys and help", wide: true, ok: "Close", cancel: null, body: el("div", { class: "help" },
    el("p", { class: "helpguide" }, icon("notes", 15), el("a", { href: "guide.html", target: "deskguide" }, "Open the guide"), el("span", { class: "kv" }, " · every part of the desk, in the order you'd use it, with pictures")),
    sec("The desk", [["Ctrl+K", "go to anything: a card, a line by its words, a beat, a flag, an item, or an action such as Playtest"], ["Ctrl+S", "save"], ["Ctrl+Z", "undo (outside a text box; 150 edits back)"], ["Ctrl+Shift+Z · Ctrl+Y", "redo"],
      ["Problems", "what's wrong, found as you edit: click one to go there"], ["Playtest", "the game from the start, as the player plays it"], ["Check · Unreal", "the story and level checks; the game built in Unreal"],
      ["Simple", "the simple view, when the desk lags: plain colours, no textures (kept in this browser)"], ["Lighting", "the light effects (shafts, patterns, sweeps, leaks, wet skin) drawn on the desk; off by default: the lighting is made in Godot"]]),
    sec("The flow board", [["drag a card", "move it (the layout is kept in the story)"], ["drag its ●", "onto another card to connect them, or onto empty space for a new one"], ["palette", "drag Scene, Task, Choice or Ending onto the board"], ["double-click", "empty space: add a card there"], ["wheel · drag the background", "zoom · pan"], ["F · M · Delete", "fit everything · the minimap · remove the selected card"],
      ["Shift+drag · Ctrl+click", "pick several cards: a box, or one more"], ["right-click", "a card, an act or the board: copy, paste, duplicate, make an act, remove"],
      ["Ctrl+C · Ctrl+V · Ctrl+D", "copy · paste · duplicate what's picked (cards, lines, beats, commands; between games too)"], ["an act", "drag its title to move it with its cards; fold it to one card; drop a card in to join"],
      ["Quick tasks", "a locked door and its key, a note, a chase… dragged onto the board, a few blanks filled"]]),
    sec("A task's beats", [["When … pill", "click to choose when the beat happens"], ["+ Add a command", "the palette: type to search, Enter picks"], ["grip ⋮⋮", "drag a command or a beat to move it, into another beat too"], ["double-click", "a command: edit it"], ["+ New…", "in a picker: make the line, item or sound there and then"], ["Quick beat", "a jump scare, a knock, the lights dying… from a few blanks"]]),
    sec("A scene", [["a row", "one line: click it for its tabs (Line, Take, Camera, Body, Event, Reply)"], ["grip ⋮⋮", "drag lines to reorder them"], ["drop a file", "a take's video or audio on its line: stored, measured, trimmed"]]),
    sec("The Database", [["tabs", "the game's settings, cast, items, notes, sounds, lines, motions, flags and counters, secrets, trigger cutscenes"], ["Used in …", "every place an entry is used: click one to go there"], ["Rename", "a new id, changed everywhere it's used"]]),
    sec("The Watch", [["WASD · arrows", "move"], ["mouse", "look (click the view to lock it)"], ["left click · Shift", "use anything · run"], ["E · wheel · G", "the inventory shown or hidden · turn it · put down the one in your hand"], ["C", "crouch (toggle or hold: the Watch bar)"], ["F", "the flashlight, once you have one"], ["hold the left button", "scrub a stain away"], ["Esc", "pause (dev: skips a scene, when ticked)"], ["F9 · Debug", "every flag, counter and item live, the beats as they fire; before it plays, the state to start from"]]),
    sec("The stage", [["drag someone", "across the floor onto a spot (the rings; let go near one) or a new mark there, facing the player"], ["right-click", "the floor: put someone here, the player stands here, a new mark; someone: the camera follows them, off the stage"],
      ["Free cam", "drag to orbit, wheel to zoom; the player is the orange marker: drag it to where the scene is seen from"]])) });
};
$("#check").onclick = async () => {
  if (DIRTY && !(await save())) { status("not saved: nothing run"); return; }   // never check or bake a version that isn't on disk
  toggleProblems(true); CHECK.busy = true; problemsButton();
  try {
    const j = await api("/api/check/" + encodeURIComponent(GAME), { method: "POST" }), lines = j.output.split("\n");
    CHECK.list = checkList(lines.filter(l => l.startsWith("ERROR: ")).map(l => l.slice(7)), lines.filter(l => l.startsWith("warning: ")).map(l => l.slice(9)));
    CHECK.ok = /STORY ok/.test(j.output) && /LEVEL ok/.test(j.output); CHECK.summary = lines.filter(l => /^(STORY|LEVEL) /.test(l)).join(" · ") || "no answer"; CHECK.at = Date.now(); CHECK.key = LAST;
  } catch (e) { CHECK.summary = "the checks couldn't run: " + e.message; }
  CHECK.busy = false; renderBoard(); problemsButton();
};
$("#problemsBtn").onclick = () => toggleProblems();
// the simple view (the toolbar's Simple): plain colours, no textures, the eyes plain, on every stage (stage.js simpleOf);
// kept in this browser
function setSimple(on) {
  Stage.simple = !!on; $("#simpleView").classList.toggle("on", Stage.simple);
  try { localStorage.setItem("dd.simple", Stage.simple ? "1" : ""); } catch (e) { }
  for (const st of [flowStage, watchStage]) if (st) st.render();
}
$("#simpleView").onclick = () => { setSimple(!Stage.simple); status(Stage.simple ? "simple view: plain colours, no textures" : "full view"); };
// the light effects (the toolbar's Lighting; DECISIONS 2026-10-30): off, the desk lights its rooms plainly (the lamps, the windows' fill) and leaves
// the shafts, patterns, sweeps, leak strips and wet skin to Godot; on, it draws them too, for a look. Kept in this browser
function setLightFx(on) {
  Stage.plainLight = !on; $("#lightFx").classList.toggle("on", !!on);
  try { localStorage.setItem("dd.lightfx", on ? "1" : ""); } catch (e) { }
  for (const st of [flowStage, watchStage]) if (st && st.story && st.plan) { try { st.setWorld(st.plan, st.story, st.levelId || Object.keys(st.story.levels)[0]); } catch (e) { } }
}
$("#lightFx").onclick = () => { setLightFx(Stage.plainLight); status(Stage.plainLight ? "plain lighting: the lamps alone, as the desk is for the gameplay" : "the light effects drawn: shafts, patterns, sweeps, leaks, wet skin"); };
$("#godot").onclick = async () => {                 // the game as a Godot project (docs/GODOT_EXPORT.md): the bake first, then the export, zipped, with its guide
  if (DIRTY && !(await save())) { status("not saved: nothing exported"); return; }
  const box = $("#inspector"); box.innerHTML = ""; box.append(el("h2", {}, "Export to Godot"), el("p", { class: "muted", id: "gdState" }, "recording the scenes…"));
  stopWatch(); await loadFiles(); await loadMade(); if (!PLAN) await replan();
  try {                                        // the Watch, recorded (bake.js): what the Godot scenes play
    const saveBody = (who, blob) => fetch(`/api/export/${encodeURIComponent(GAME)}/Body_${encodeURIComponent(who)}.glb`, { method: "POST", body: blob });
    const pv = await bakePreview(watchStage, S, PLAN, FILES, 30, (i, n, id) => { $("#gdState").textContent = `recording the scenes… ${i + 1}/${n} (${id})`; }, GLTFExporter, saveBody);
    await api("/api/preview/" + encodeURIComponent(GAME), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pv) });
  } catch (e) { $("#gdState").className = "err"; $("#gdState").textContent = "The recording failed: " + e.message; return; }
  $("#gdState").textContent = "writing the project (the kit's meshes, then Godot's one-time import of it, headless: a minute or two)…";
  let j; try { j = await api("/api/godot/export/" + encodeURIComponent(GAME), { method: "POST" }); }
  catch (e) { $("#gdState").className = "err"; $("#gdState").textContent = "The export failed: " + e.message; if (e.body && e.body.output) box.append(el("pre", {}, e.body.output)); return; }
  $("#gdState").textContent = j.ok ? `Exported. The project is the folder ${j.dir}: open its project.godot in Godot 4.7 (Import, or drop the folder on the project list). The same as a zip: ${j.zip} (${j.kb} KB).` : "The export failed.";
  if (j.guide) box.append(el("p", {}, el("a", { href: j.guide, target: "_blank" }, "Open the project's guide"), " (it's inside the zip too: guide/index.html)"));
  if (j.kept && j.kept.length) box.append(el("p", { class: "muted" }, `Kept yours (changed since the last export): ${j.kept.join(", ")}. The desk's new version of each is beside it as <name>.desk.<ext>.`));
  box.append(el("pre", {}, (j.output || "").split("\n").slice(-20).join("\n")));
};
{ // the divider between the board and the stage: dragged, and kept
  const sp = $("#split"), panel = $("#stagePanel"); let h0 = null; try { h0 = +localStorage.getItem("dd.stageH"); } catch (e) { }
  if (h0 > 120) panel.style.height = h0 + "px";
  sp.addEventListener("mousedown", e => {
    e.preventDefault(); const y0 = e.clientY, start = panel.getBoundingClientRect().height; sp.classList.add("on");
    const mv = ev => { panel.style.height = Math.max(160, Math.min(window.innerHeight - 260, start - (ev.clientY - y0))) + "px"; flowStage && flowStage.resize(); };
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); sp.classList.remove("on"); try { localStorage.setItem("dd.stageH", Math.round(panel.getBoundingClientRect().height)); } catch (x) { } showStage(); };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  });
}
$("#sPlay").onclick = () => { const sc = currentScene(); if (sc) playScene(sc); };
$("#sStop").onclick = stopPlay;
$("#scrub").oninput = e => { stopPlay(); scrubTo(+e.target.value); };
$("#sFree").onclick = e => { flowStage.setFree(!flowStage.free); e.target.classList.toggle("on", !!flowStage.free); scrubTo(+$("#scrub").value); };
$("#sFix").onclick = checkBodies;
$("#sExport").onclick = exportGLTF;
$("#wStart").onclick = () => watch();
$("#wStop").onclick = stopWatch;
wireLook();
const DBG = new DebugPanel($("#watchView"), {
  run: () => RUN, story: () => S, flags: () => storyFlags(), name: CTX.name, title: id => nodeTitle(id, S.flow[id]),
  nodes: () => Object.entries(S.flow).filter(([, n]) => n.type !== "ending").map(([id, n]) => [id, `${nodeTitle(id, n)} (${id})`]),
  watch: (nid, snap) => { openView("watchView"); watch(nid, snap); },
  go: (st, beat) => { const tid = Object.keys(S.stitches).find(k => S.stitches[k] === st), node = Object.keys(S.flow).find(k => S.flow[k].ref === tid); if (node) goToProblem({ at: { node, stitch: tid, beat }, text: "" }); },
});
$("#wDebug").onclick = () => DBG.toggle();
// go to anything (Ctrl+K): a card, a line, a beat, an entry, a flag, or one of the desk's actions
function goto() {
  if (!S) return;
  openGoto({ story: () => S, name: CTX.name, title: id => nodeTitle(id, S.flow[id]), flags: () => storyFlags(),
    goNode: id => { if (!id) return; openView("flowView"); selectNode(id); if (BOARD) BOARD.center(id); },
    goClip: (node, sid, k, cid) => goToProblem({ at: { node, scene: sid, variant: k, clip: cid }, text: "", path: [] }),
    goBeat: (node, tid, bid) => goToProblem({ at: { node, stitch: tid, beat: bid }, text: "", path: [] }),
    goDb: (tab, id) => openDb(tab, id),
    actions: () => [
      { label: "Playtest from the start", hint: "the Watch", keys: "play run test", on: () => $("#playtest").click() },
      { label: "Save", hint: "Ctrl+S", on: () => save() }, { label: "Check the story", hint: "the story and level checks", on: () => $("#check").click() },
      { label: "Problems", hint: "what's wrong, found as you edit", on: () => toggleProblems(true) },
      { label: "Database", hint: "the game's tables", on: () => openDb() }, { label: "Takes", hint: "every take to record", on: () => openView("clipsView") },
      { label: "Storyboard", on: () => openView("boardView") }, { label: "Branches", on: () => openView("branchView") }, { label: "Notes", on: () => openView("notesView") },
      { label: "Saves kept", hint: "the history: what changed, bring one back", keys: "history versions restore", on: () => historyDialog() },
      { label: "Undo", hint: "Ctrl+Z", on: () => undoTo(UNDO, REDO, "undo") }, { label: "Redo", hint: "Ctrl+Shift+Z", on: () => undoTo(REDO, UNDO, "redo") },
      { label: "Fit the board", hint: "F", on: () => { openView("flowView"); BOARD && BOARD.fit(); } },
      { label: "Keys and help", on: () => $("#keysHelp").click() },
      ...TOOLS.map(t => ({ label: t.label, hint: "opens " + t.page, on: () => window.open(`${t.page}?game=${encodeURIComponent(GAME || "")}`, t.win || "_blank") }))] });
}
$("#gotoBtn").onclick = goto;
document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K") && !document.querySelector(".mdl-back")) { e.preventDefault(); goto(); } });
document.addEventListener("keydown", e => { if (e.key === "F9" && $("#watchView").classList.contains("on")) { e.preventDefault(); DBG.toggle(); } });
const DB = new Database($("#dbView"), {
  story: () => S, game: () => GAME, ctx: CTX, touch, status, whoColor, takes: () => TAKES, playLine, dropTake: dropLineTake, secs: c => clipSecs(c),
  prompt: ln => minimaxPrompt(ln, S.cast), copy: copyText, voices: VOICES, eases: M.EASE_NAMES, poses: () => poseNames(), times: TIMES, timeMark: TIME_MARK, timeDefault: TIME_DEFAULT,
  bodies: () => [["capsules", "capsule figure"], ...BODIES.map(f => f.startsWith("people/") ? [f, `${f.slice(7)} (Character Studio)`] : f)], afterBody: async () => { await loadBodies(); showStage(); },
  pic: (kind, id, cls) => pic(kind, id, { cls }), posePick, made: () => MADE,
  nodes: () => Object.entries(S.flow).map(([id, n]) => [id, `${nodeTitle(id, n)} (${id})`]), redraw: () => { renderBoard(); showStage(); },
  page: name => `${name}?game=${encodeURIComponent(GAME || "")}`,
  goNode: nid => { openView("flowView"); selectNode(nid); if (BOARD) BOARD.center(nid); },
  goLevel: lid => openBuilder(lid),
});
// the right side's tabs: the Inspector, and the expression library (expressions.js, docs/EXPRESSIONS_PLAN.md)
async function ensureBody(f) {                         // a body loaded into the stages' templates on demand (a Studio export no one wears yet)
  if (!f || f === "capsules" || flowStage.bodies[f]) return;
  const tpl = await loadBody("/bodies/" + f.split("/").map(encodeURIComponent).join("/"));
  if (f.startsWith("people/")) tpl.userData = { studio: f.slice(7) };
  flowStage.bodies[f] = tpl; watchStage.bodies[f] = tpl;
}
const XP = new ExpressionsPanel($("#exprPanel"), { stage: () => flowStage, story: () => S, ensureBody, M, bodies: async () => (await api("/api/bodies")).bodies,
  changed: () => { libraryChanged(); if (currentScene()) renderInspector(); } });   // the library changed (an import, a loop, a rename): the face rows read it again
function rightTab(r, draw = true) {
  for (const b of document.querySelectorAll("#rtabs button")) b.classList.toggle("on", b.dataset.r === r);
  $("#inspector").hidden = r !== "inspector"; $("#exprPanel").hidden = r !== "exprPanel";
  try { localStorage.setItem("dd.rtab", r); } catch (e) { }
  if (r === "exprPanel" && draw && S) XP.refresh();
}
for (const b of document.querySelectorAll("#rtabs button")) b.onclick = () => rightTab(b.dataset.r);
{ const ib = $('#rtabs button[data-r="inspector"]'), ours = e => [...e.dataTransfer.types].includes(DRAG_TYPE);   // an expression card dragged over the Inspector's tab opens it: dropped on a face row there
  ib.addEventListener("dragenter", e => { if (ours(e)) rightTab("inspector"); }); ib.addEventListener("dragover", e => { if (ours(e)) e.preventDefault(); }); }
try { if (localStorage.getItem("dd.rtab") === "exprPanel") rightTab("exprPanel", false); } catch (e) { }   // drawn once a game has loaded (load())
window.__dd = { get S() { return S; }, XP, rightTab, get board() { return BOARD; }, get PLAN() { return PLAN; }, get FILES() { return FILES; }, get DIRTY() { return DIRTY; }, replan, get play() { return RUN && RUN.play; }, get run() { return RUN; }, openBuilder, get flowStage() { return flowStage; }, get watchStage() { return watchStage; }, watch: (nid, snap) => watch(nid, snap), stopWatch: () => stopWatch(), renderInspector: () => renderInspector(), checkBodies, loadBodies: () => loadBodies(), setSimple: on => setSimple(on), exportGLTF, drawBoard, DB, openDb, touch: w => touch(w), problems: () => allProblems(), select: id => { SEL = id; renderBoard(); renderInspector(); showStage(); }, models: () => flowModels(S) };
boot();

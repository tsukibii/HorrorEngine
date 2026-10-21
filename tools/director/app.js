// The director's desk: plot a game, block its scenes with bodies and camera, watch it as a storyboard and an animatic,
// leave notes for each other. Reads and writes Content/Games/<Game>/story.json through serve.py.
import * as M from "./motion.js";
import { Stage, SHOTS, SEAM_SECS, clipSecs, version, loadAssetLibrary, LEAN, PITCH, minimaxPrompt, VOICES, eventSecs, karmaOf, addKarma, karmaPick, PLAYS, REPLY_SECS, thenClip } from "./stage.js";
import { GLTFExporter } from "./vendor/GLTFExporter.js";
import { bakePreview } from "./bake.js";
import { loadBody, BodyFigure } from "./bodies.js";
import { PlayRuntime } from "./play/runtime.js";

const $ = s => document.querySelector(s);
const el = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [n, v] of Object.entries(a)) { if (n === "on") for (const [ev, f] of Object.entries(v)) e.addEventListener(ev, f); else if (n === "style") e.style.cssText = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(n, v === true ? "" : v); } for (const c of k.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
const SEAMS = ["blink", "glance", "flicker", "occlude", "cutaway", "turn", "stumble", "dip", "jcut", "heartbeat", "none"];
const CAMS = ["free", "soft", "hard", "held"], PULLS = ["back", "left", "right", "down", "any"], ENDS = ["good", "bad", "secret", "other"];
const EVENTS = ["struggle", "press", "mash", "hold", "breath", "aim", "choose"], TRANS = ["fade", "cut", "blink", "dip"];
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
let S = null, GAME = null, MTIME = 0, DIRTY = false, SEL = null, VTAB = {}, PLAN = null, LIB = null, FILES = {}, FIX = {}, TAKES = {};
let flowStage = null, watchStage = null, PLAY = null, BODIES = [];
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- server ---------- */
async function api(path, opt) { const r = await fetch(path, opt); const j = await r.json(); if (!r.ok) { const e = new Error(j.error || r.status); e.status = r.status; e.body = j; throw e; } return j; }
async function boot() {
  try {
    LIB = M.loadLibrary(await api("/api/poses"));
    try { Stage.SOMA = await api("/api/soma"); } catch (e) { }
    const g = await api("/api/games");
    fillGames(g.games);
    GAME = localStorage.getItem("dd.game"); if (!g.games.includes(GAME)) GAME = g.games[0];
    $("#game").value = GAME;
    flowStage = new Stage($("#stageBox"), LIB);
    $("#stageBox").prepend(flowStage.renderer.domElement);
    watchStage = new Stage($("#watchBox"), LIB);
    $("#watchBox").prepend(watchStage.renderer.domElement);
    wireFreeCam();
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
function fillGames(list) { const sel = $("#game"); sel.innerHTML = ""; for (const n of list) sel.append(el("option", { value: n }, n)); }
async function load() {
  const j = await api("/api/story/" + encodeURIComponent(GAME));
  S = j.story; MTIME = j.mtime; dirty(false); $("#banner").style.display = "none";
  try { localStorage.setItem("dd.game", GAME); } catch (e) { }
  SEL = SEL && S.flow[SEL] ? SEL : S.game.start;
  await replan(); await loadFiles(); await loadBodies(); await loadAssetLibrary(); await loadTakes(); renderAll(); showStage();
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
    for (const o of (c.reply && c.reply.options) || []) if (o.then) out.push({ sid, k, c: o.then, id: takeId(sid, k, `${c.id}_${o.id}`), answer: true });
  }
  for (const [lid, ln] of Object.entries(S.lines || {})) out.push({ sid: null, k: null, c: ln, id: lid, line: true });   // barks and one-off lines
  return out;
}
// the auto-clean: each take's length and dead air (Web Audio), into the clip's dur and trim (storykit/takes.py's numbers)
const TK = { win: 0.02, floor: -38, padIn: 0.08, padOut: 0.15, min: 0.05 };
async function measureTake(t) {
  const buf = await (t.file ? t.file.arrayBuffer() : fetch(t.url).then(r => r.arrayBuffer()));
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 16000, 16000);
  const ab = await ctx.decodeAudioData(buf), d = ab.getChannelData(0), w = Math.max(1, Math.round(ab.sampleRate * TK.win)), loud = [];
  for (let i = 0; i + w <= d.length; i += w) { let s = 0; for (let j = i; j < i + w; j++) s += d[j] * d[j]; const rms = Math.sqrt(s / w); loud.push(rms > 0 && 20 * Math.log10(rms) > TK.floor); }
  const first = loud.indexOf(true), last = loud.lastIndexOf(true);
  return { dur: +ab.duration.toFixed(2), lead: first < 0 ? 0 : +(first * TK.win).toFixed(2), tail: first < 0 ? 0 : +Math.max(0, ab.duration - (last + 1) * TK.win).toFixed(2) };
}
async function autoClean(keepTrim) {
  const rows = [];
  for (const { c, id } of allClips()) {
    const t = TAKES[id]; if (!t) continue;
    try {
      const m = await measureTake(t); c.dur = m.dur;
      if (!(keepTrim && c.trim)) { const tr = {}, a = +(m.lead - TK.padIn).toFixed(2), b = +(m.tail - TK.padOut).toFixed(2); if (a >= TK.min) tr.in = a; if (b >= TK.min) tr.out = b; if (Object.keys(tr).length) c.trim = tr; else delete c.trim; }
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
  else speak(ln.ja);
  const sub = el("div", { class: "barksub" }, `${ln.en || ""}`); $("#watchBox").append(sub); setTimeout(() => sub.remove(), 2600);
}
const pickOne = a => a && a.length ? a[Math.floor(Math.random() * a.length)] : null;
function stopTakes() { for (const v of Object.values(PIPS)) { v.pause(); v.style.display = "none"; } }
async function replan() { try { PLAN = await api("/api/plan/" + encodeURIComponent(GAME), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(S) }); } catch (e) { status(e.message); } }
let replanTimer = null;
function scheduleReplan() { clearTimeout(replanTimer); replanTimer = setTimeout(async () => { await replan(); showStage(); }, 700); }
async function loadFiles() {
  for (const sc of Object.values(S.scenes || {})) for (const ver of [sc, ...Object.values(sc.variants || {})]) for (const c of ver.clips || []) {
    for (const f of [c.body && c.body.file, ...((c.body && c.body.segments) || []).map(g => g.file)]) {
      if (!f || FILES[f]) continue;
      try { FILES[f] = await api(`/api/motion/${encodeURIComponent(GAME)}/${encodeURIComponent(f)}`); } catch (e) { }
    }
  }
}
async function loadBodies() {
  try { BODIES = (await api("/api/bodies")).bodies; } catch (e) { BODIES = []; }
  if (!BodyFigure.soma) try { BodyFigure.soma = await api("/api/soma"); } catch (e) { }
  const want = new Set([S.game.previs_body, ...Object.values(S.cast || {}).map(c => c.previs_body)].filter(f => f && f !== "capsules"));
  const def = BODIES.find(f => /^default\./i.test(f)) || BODIES.find(f => !/_hi\./i.test(f)) || null;   // MHR_hi is for exports
  if (def) want.add(def);
  for (const f of want) {
    if (!BODIES.includes(f) || flowStage.bodies[f]) continue;
    try { const tpl = await loadBody("/bodies/" + encodeURIComponent(f)); flowStage.bodies[f] = tpl; watchStage.bodies[f] = tpl; }
    catch (e) { console.warn("couldn't load body", f, e); status("couldn't load body " + f); }
  }
  flowStage.defaultBody = watchStage.defaultBody = def;
}
async function save(force) {
  if (!S) return;
  try { const j = await api("/api/story/" + encodeURIComponent(GAME), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ story: S, mtime: MTIME, force: !!force }) }); MTIME = j.mtime; dirty(false); status("saved " + new Date().toLocaleTimeString()); }
  catch (e) { if (e.status === 409) { if (confirm(e.message + "\n\nOK = overwrite with your version, Cancel = keep editing (then Reload)")) save(true); } else alert("save failed: " + e.message); }
}
// the scene builder (builder.html) says when it saved a level: reload it here unless there are edits to keep, and
// not in the middle of a playthrough (then right after it)
let RELOAD_AFTER_WATCH = false;
function openBuilder(level, node) {
  window.open(`builder.html?game=${encodeURIComponent(GAME)}&level=${encodeURIComponent(level || "")}&node=${encodeURIComponent(node || "")}`, "scenebuilder");
}
try {
  new BroadcastChannel("horrorstudio-story").onmessage = async e => {
    const m = e.data || {};
    if (m.type !== "saved" || m.game !== GAME) return;
    if (DIRTY) { $("#banner").style.display = "block"; return; }
    if (RUN) { RELOAD_AFTER_WATCH = true; status("the scene builder saved " + m.level + ": it loads when this playthrough ends"); return; }
    await load(); status(`environment ${m.level} reloaded from the scene builder`);
  };
} catch (e) { }
async function poll() { if (!GAME) return; try { const j = await api("/api/mtime/" + encodeURIComponent(GAME)); if (j.mtime && Math.abs(j.mtime - MTIME) > 0.001) $("#banner").style.display = "block"; } catch (e) { } }
function dirty(d) { DIRTY = d; status(d ? "unsaved changes" : "saved"); $("#status").classList.toggle("dirty", d); }
function status(t) { $("#status").textContent = (GAME ? GAME + " · " : "") + t; }
function touch(world) { dirty(true); renderBoard(); if (world) scheduleReplan(); else showStage(); }
window.addEventListener("beforeunload", e => { if (DIRTY) { e.preventDefault(); e.returnValue = ""; } });
document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); } });

/* ---------- story helpers ---------- */
const things = () => (PLAN && PLAN.things) || {};
const spots = lvl => Object.entries(things()).filter(([k, v]) => v.use === "spot" && (!lvl || v.level === lvl)).map(([k]) => k);
const placed = lvl => Object.entries(things()).filter(([k, v]) => v.kind !== "room" && (!lvl || v.level === lvl)).map(([k]) => k);
const castIds = () => Object.keys(S.cast || {});
const poseNames = () => (LIB ? LIB.names : ["idle"]);
function sceneSecs(sc) { const v = version(sc); let t = 0; (v.clips || []).forEach((c, i) => { t += clipSecs(c) + (i && c.seam ? SEAM_SECS[c.seam.kind] || 0 : 0) + (c.event ? eventSecs(c.event, S) : 0) + replySecs(c); }); return t; }
function replySecs(c) { const rp = c.reply; if (!rp) return 0; const o = (rp.options || []).find(x => x.then); return Math.min(+(rp.wait || REPLY_SECS), 2.5) + (o ? clipSecs(o.then) : 0); }
function nodeRef(n) { return n.type === "scene" ? S.scenes[n.ref] : n.type === "stitch" ? S.stitches[n.ref] : null; }
function notesHost(nid) { const n = S.flow[nid]; return nodeRef(n) || n; }
function openNotes(obj) { return (obj && obj.notes || []).filter(x => !x.done).length; }
function eventResults(ev) { if (!ev) return []; if (ev.type === "choose") return (ev.options || []).map(o => o.id); return ev.type === "struggle" ? ["escape", "caught"] : ["success", "fail"]; }
function problems(nid) {
  const n = S.flow[nid], p = [], max = S.game.clip_max || 10;
  if (n.type === "scene") { const sc = S.scenes[n.ref]; if (!sc) return ["missing scene " + n.ref]; (version(sc).clips || []).forEach((c, i) => { if (clipSecs(c) > max) p.push(`${c.id} over ${max} s`); if (i && !c.seam) p.push(`${c.id} has no seam`); }); }
  if (n.type === "stitch" && !S.stitches[n.ref]) p.push("missing stitch " + n.ref);
  if (n.next && !S.flow[n.next]) p.push("next " + n.next + " missing");
  for (const o of n.options || []) if (!S.flow[o.to]) p.push("option to " + o.to + " missing");
  return p;
}
function newId(prefix, table) { let i = 1; while (table[prefix + i]) i++; return prefix + i; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

/* ---------- the flow board ---------- */
function karmaLabel(o) { const a = o.axis && o.axis !== "karma" ? o.axis + " " : ""; return o.min !== undefined && o.max !== undefined ? `${a}${o.min}..${o.max}` : o.min !== undefined ? `${a}≥ ${o.min}` : o.max !== undefined ? `${a}≤ ${o.max}` : "else"; }
function outs(id) {
  const n = S.flow[id]; if (!n) return [];
  const o = n.options ? n.options.map(o => ({ to: o.to, label: o.label || o.result || (o.if ? o.if.join("&") : n.by === "karma" ? karmaLabel(o) : n.by === "count" ? (o.count ? o.count + " " : "") + karmaLabel(o) : "else") })) : n.next ? [{ to: n.next, label: "" }] : [];
  if (n.type === "stitch" && S.stitches[n.ref]) {
    const st = S.stitches[n.ref];
    if (st.timer && st.timer.fail) o.push({ to: st.timer.fail, label: "⏱ " + (st.timer.secs || "") + " s", kind: "timer" });
    for (const it of S.interrupts || []) if (it.during === "all" || (it.during || []).includes(n.ref)) o.push({ to: it.to, label: "☠ " + (it.label || it.id), kind: "interrupt" });
  }
  return o;
}
function layout() {
  const pos = {}, col = {}, order = [], start = S.game.start, q = [[start, 0]], seen = new Set();
  while (q.length) { const [id, c] = q.shift(); if (!S.flow[id]) continue; if (seen.has(id)) continue; seen.add(id); col[id] = c; order.push(id); for (const t of outs(id)) q.push([t.to, c + 1]); }
  const maxc = Math.max(0, ...Object.values(col));
  for (const id of Object.keys(S.flow)) if (!seen.has(id)) { col[id] = maxc + 1; order.push(id); }
  const rows = {};
  for (const id of order) { const c = col[id]; rows[c] = rows[c] || 0; pos[id] = { x: 20 + c * 206, y: 20 + rows[c] * 82 }; rows[c]++; }
  return pos;
}
function renderBoard() {
  if (!S) return;
  const b = $("#board"); b.querySelectorAll(".card").forEach(c => c.remove());
  const pos = layout(), svg = $("#edges");
  let W = 0, H = 0; for (const p of Object.values(pos)) { W = Math.max(W, p.x + 220); H = Math.max(H, p.y + 90); }
  svg.setAttribute("width", W); svg.setAttribute("height", H);
  let paths = '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="#666"/></marker></defs>';
  for (const id of Object.keys(S.flow)) {
    const a = pos[id];
    for (const o of outs(id)) {
      const t = pos[o.to]; if (!a || !t) continue;
      const x1 = a.x + 176, y1 = a.y + 27, x2 = t.x, y2 = t.y + 27, back = x2 <= x1;
      const d = back ? `M${x1},${y1} C${x1 + 60},${y1 - 70} ${x2 - 60},${y2 - 70} ${x2},${y2}` : `M${x1},${y1} C${x1 + 30},${y1} ${x2 - 30},${y2} ${x2},${y2}`;
      const col = o.kind === "interrupt" ? "#a33" : o.kind === "timer" ? "#a80" : "#555";
      paths += `<path d="${d}" stroke="${col}" fill="none" stroke-width="1.6" ${o.kind ? 'stroke-dasharray="5 4"' : ""} marker-end="url(#ar)"/>`;
      if (o.label) paths += `<text x="${(x1 + x2) / 2 - 20}" y="${(y1 + y2) / 2 - 4}" fill="${o.kind ? col : "#c98a2b"}" font-size="10">${esc(o.label).slice(0, 26)}</text>`;
    }
  }
  svg.innerHTML = paths;
  for (const [id, n] of Object.entries(S.flow)) {
    const p = pos[id], ref = nodeRef(n); let meta = "";
    if (n.type === "scene" && ref) { const v = version(ref); meta = `${(v.clips || []).length} clips · ${Math.round(sceneSecs(ref))} s` + (ref.mood ? " · " + ref.mood : "") + (ref.variants ? ` · ${Object.keys(ref.variants).length} var` : ""); }
    if (n.type === "stitch" && ref) meta = `${(ref.beats || []).length} beats · ~${ref.target_min || "?"} min` + (ref.timer ? ` · ⏱${ref.timer.secs}s` : "");
    if (n.type === "choice") meta = "by " + n.by; if (n.type === "ending") meta = n.kind;
    const probs = problems(id), nn = openNotes(notesHost(id));
    b.append(el("div", { class: `card ${n.type}${SEL === id ? " sel" : ""}`, style: `left:${p.x}px;top:${p.y}px`, title: probs.join("\n"), on: { click: () => { SEL = id; renderBoard(); renderInspector(); showStage(); } } },
      el("div", { class: "t" }, n.type + (id === S.game.start ? " · start" : "")), el("div", { class: "n" }, (ref && ref.title) || n.title || n.prompt || id),
      el("div", { class: "m" }, id + (meta ? " · " + meta : "")),
      probs.length ? el("span", { class: "badge", style: "background:var(--bad);color:#fff" }, "!" + probs.length) : nn ? el("span", { class: "badge" }, "✎" + nn) : null));
  }
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
  const box = $("#inspector"); box.innerHTML = "";
  if (!S || !SEL || !S.flow[SEL]) { box.append(el("p", { class: "muted" }, "Select a node.")); return; }
  const n = S.flow[SEL], nodeIds = Object.keys(S.flow);
  box.append(el("h2", {}, `${n.type} · ${SEL}`), el("div", { class: "row" },
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
  if (n.type === "ending") box.append(field("title", txt(n, "title", { w: true })), field("kind", sel(n, "kind", ENDS)), field("", chk(n, "short_ok", "short ok (an early death: exempt from the playtime minimum)")));
  box.append(el("h2", {}, "Grow the flow"), el("div", { class: "row" }, el("span", { class: "muted" }, "add after this:"), ...["scene", "stitch", "choice", "ending"].map(t => el("button", { on: { click: () => addNode(t) } }, "+ " + t))));
  notesEditor(box, notesHost(SEL), SEL);
}
function renameNode(old) {
  const nid = prompt("New id for this node", old); if (!nid || nid === old || S.flow[nid]) return;
  S.flow[nid] = S.flow[old]; delete S.flow[old];
  for (const m of Object.values(S.flow)) { if (m.next === old) m.next = nid; for (const o of m.options || []) if (o.to === old) o.to = nid; if (m.of === old) m.of = nid; }
  for (const st of Object.values(S.stitches || {})) if (st.timer && st.timer.fail === old) st.timer.fail = nid;
  for (const it of S.interrupts || []) if (it.to === old) it.to = nid;
  if (S.game.start === old) S.game.start = nid; SEL = nid; touch(); renderInspector();
}
function addNode(type) {
  const n = S.flow[SEL], nid = newId(type === "ending" ? "e_" : "n_", S.flow), lvl = Object.keys(S.levels)[0]; let node;
  if (type === "scene") { const sid = newId("s_", S.scenes); S.scenes[sid] = { title: "New scene", level: lvl, mood: "dread", stage: {}, camera: { mode: "soft", look: castIds()[0] || null, cone: [30, 18] }, clips: [{ id: "c1", who: castIds()[0] || "", ja: "", en: "", act: "", shot: "ms", body: { block: [{ at: 0, pose: "idle" }] } }] }; node = { type, ref: sid, next: n.next || null }; }
  if (type === "stitch") { const tid = newId("t_", S.stitches); S.stitches[tid] = { title: "New task", level: lvl, goal: "", target_min: 5, beats: [{ id: "b_" + tid.slice(2) + "_start", when: { start: true }, do: [{ objective: "…" }, { done: true }] }] }; node = { type, ref: tid, next: n.next || null }; }
  if (type === "choice") node = { type, by: "act", prompt: "", options: [{ label: "A", when: { use: "" }, to: n.next || "" }, { label: "B", when: { use: "" }, to: n.next || "" }] };
  if (type === "ending") node = { type, kind: "good", title: "An ending" };
  S.flow[nid] = node; if ("next" in n) n.next = nid; SEL = nid; touch(); renderInspector(); showStage();
}

function sceneEditor(box, sc, sid) {
  const lvl = sc.level || Object.keys(S.levels)[0];
  box.append(el("h2", {}, "Scene"), field("title", txt(sc, "title", { w: true })),
    field("level", sel(sc, "level", Object.keys(S.levels || {}), { after: showStage })), field("view", sel(sc, "view", spots(lvl), { title: "where the player stands", after: showStage }), "stance", sel(sc, "stance", ["stand", "crouch", "kneel", "sit", "lie", "hide"], { drop: true, title: "the player's eye height (sit: standing people loom; lie: everything looms)", after: showStage })));
  const mood = MOODS[sc.mood];
  box.append(field("mood", sel(sc, "mood", Object.keys(MOODS), { after: renderInspector }), mood ? el("button", { on: { click: () => applyMood(sc) } }, "apply to camera and clips") : null),
    mood ? el("div", { class: "kv", style: "margin:0 0 4px 70px" }, mood.text) : null);
  sc.camera = sc.camera || { mode: "free" };
  box.append(field("camera", sel(sc.camera, "mode", CAMS, { blank: false }), " look ", sel(sc.camera, "look", [...castIds(), ...placed(lvl)], { nullable: true, after: showStage }),
    " cone ", el("input", { type: "number", value: (sc.camera.cone || [30, 18])[0], style: "width:52px", on: { change: e => { sc.camera.cone = [+e.target.value, (sc.camera.cone || [30, 18])[1]]; touch(); } } }), "°×",
    el("input", { type: "number", value: (sc.camera.cone || [30, 18])[1], style: "width:52px", on: { change: e => { sc.camera.cone = [(sc.camera.cone || [30, 18])[0], +e.target.value]; touch(); } } }), "°"),
    field("look", jsonArea(sc, "look", "the head's look for the whole scene, per actor: {\"mari\": {\"at\": \"player\", \"limit\": [70, 20, 30], \"past\": \"hold\"}} (a clip's own look wins)", { small: true, compact: true })),
    field("trackers", jsonArea(sc, "trackers", "invisible trackers a head can follow: {\"t_shadow\": {\"height\": 1.6, \"keys\": [{\"clip\": \"c1\", \"at\": 0, \"to\": \"a_spot\"}, {\"clip\": \"c2\", \"at\": 1, \"to\": [x, y, z]}]}} (keys ride clip edges)", { small: true, compact: true })),
    field("through", el("input", { value: (sc.camera.through || []).join(","), placeholder: "props the camera sees through (a locker's slats), comma list", style: "width:320px",
      on: { change: e => { const v = e.target.value.split(",").map(x => x.trim()).filter(Boolean); if (v.length) sc.camera.through = v; else delete sc.camera.through; touch(); } } })),
    field("in / out", sel(sc.enter = sc.enter || { kind: "fade", secs: 0.6 }, "kind", TRANS, { blank: false }), txt(sc.enter, "secs", { num: true }), " → ", sel(sc.exit = sc.exit || { kind: "fade", secs: 0.6 }, "kind", TRANS, { blank: false }), txt(sc.exit, "secs", { num: true })),
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
    if (s.type === "event") bar.append(el("div", { class: "seg ev", style: `left:${s.start / total * 100}%;width:${(s.end - s.start) / total * 100}%`, title: "event " + s.event.type }, "⚡" + s.event.type));
  }
  const starts = {}, ends = {}; for (const s of tl.segs) if (s.type === "clip") { starts[s.clip.id] = s.start; ends[s.clip.id] = s.end; }
  for (const cu of ver.cues || []) { const a = cu.at || {}, base = a.edge === "end" ? ends[a.clip] : starts[a.clip]; if (base === undefined) continue; bar.append(el("div", { class: "cue", style: `left:${Math.max(0, Math.min(100, (base + (+a.offset || 0)) / total * 100))}%` }, el("span", {}, Object.keys(cu.do || {})[0] || "cue"))); }
  bar.append(el("div", { class: "playhead", id: "playhead", style: "left:0%" }));
  box.append(el("h2", {}, `Clips · ${total.toFixed(1)} s`), bar, el("div", { class: "kv" }, "striped = estimated length · red = an event (QTE) · cues ride on clip edges, so a longer take carries them"));
  ver.clips.forEach((c, i) => box.append(clipCard(sc, ver, c, i, lvl, sid)));
  box.append(el("div", { class: "row" }, el("button", { on: { click: () => { ver.clips.push({ id: "c" + (ver.clips.length + 1), who: castIds()[0] || "", ja: "", en: "", act: "", shot: "mcu", seam: ver.clips.length ? { kind: "blink" } : undefined, body: { block: [{ at: 0, pose: "idle" }] } }); touch(); renderInspector(); } } }, "+ clip"),
    el("span", { class: "muted" }, "one clip = one take of " + (S.game.clip_max || 10) + " s or less; long speeches are several clips joined by seams")));
  box.append(jsonArea(ver, "cues", "cues: [{at: {clip, edge: start|end, offset}, do: {action}}]"), jsonArea(sc, "sets", "sets: actions when the scene ends"));
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
    "trim in", txt(c.trim, "in", { num: true, step: "0.05", style: "width:56px", title: "seconds of dead air cut from the take's start", after: renderInspector }),
    "out", txt(c.trim, "out", { num: true, step: "0.05", style: "width:56px", title: "seconds cut from the take's end", after: renderInspector }),
    el("span", { class: "lab" }, "action"), txt(c.body, "secs", { num: true, step: "0.1", ph: clipSecs(c).toFixed(1), style: "width:56px", title: "the body's length against the take (empty: the clip's length)" }),
    "delay", txt(c.body, "delay", { num: true, step: "0.1", ph: "0", style: "width:52px", title: "the body starts this long after the take" }));
  if (!Object.keys(c.trim).length) delete c.trim;
  return r;
}
function clipCard(sc, ver, c, i, lvl, sid) {
  const max = S.game.clip_max || 10, over = clipSecs(c) > max;
  const card = el("div", { class: "clip" + (over ? " over" : "") });
  card.append(el("h3", {}, txt(c, "id", { style: "width:46px" }), sel(c, "who", [...castIds(), "player"], { blank: false }),
    txt(c, "dur", { num: true, ph: clipSecs(c).toFixed(1), style: "width:60px", title: "the take's length (seconds); empty = estimated", after: renderInspector }), el("span", { class: over ? "err" : "kv" }, over ? `> ${max} s: split it` : "s"),
    el("button", { on: { click: () => playScene(sc, ver, c.id) } }, "▶ clip"),
    el("button", { title: "move up", on: { click: () => { if (i) { [ver.clips[i - 1], ver.clips[i]] = [ver.clips[i], ver.clips[i - 1]]; touch(); renderInspector(); } } } }, "↑"),
    el("button", { title: "delete", on: { click: () => { if (confirm("Delete clip " + c.id + "?")) { ver.clips.splice(i, 1); touch(); renderInspector(); } } } }, "×")));
  card.append(txt(c, "en", { w: true, ph: "English subtitle", after: renderInspector }), txt(c, "ja", { w: true, ph: "日本語 (what gets recorded)", after: renderInspector }), txt(c, "act", { w: true, ph: "acting note for the take" }));
  if ((S.format || 2) >= 3) card.append(takeSec(c));
  card.append(takeRow(sc, c, sid));
  card.append(el("div", { class: "sec" }, jsonArea(c, "reply", "reply (left and right): {\"wait\": 6, \"timeout\": null, \"options\": [{\"id\": \"good\", \"label\": \"Good.\", \"ja\": \"よかったよ。\", \"then\": {\"ja\": \"…\", \"en\": \"…\", \"expr\": \"…\", \"voice\": \"says softly\"}, \"sets\": []}, {…}]}", { small: true, compact: true }),
    c.reply ? txt(c, "wait_expr", { w: true, ph: "the face she holds while she waits (MiniMax): a hopeful, expectant expression", drop: true }) : null));
  const lk = c.look || {}, looks = ["player", ...Object.keys(sc.trackers || {}), ...castIds().filter(x => x !== c.who), ...placed(lvl)];
  card.append(el("div", { class: "sec row" }, el("span", { class: "lab" }, "look"),
    sel({ at: c.look ? lk.at || "player" : "" }, "at", looks, { blank: "(the scene's, or none)", after: () => {}, title: "what the head follows: the player, a tracker, someone, a thing" }),
    "yaw ±", el("input", { type: "number", value: (lk.limit || [70])[0], style: "width:50px" }), "up", el("input", { type: "number", value: (lk.limit || [70, 20])[1], style: "width:46px" }), "down", el("input", { type: "number", value: (lk.limit || [70, 20, 30])[2], style: "width:46px" }),
    "past", sel({ past: lk.past || "hold" }, "past", ["hold", "snap"], { blank: false }),
    el("button", { title: "set this clip's look", on: { click: e => { const r = e.target.parentNode, s = r.querySelectorAll("select"), n = r.querySelectorAll("input"); if (!s[0].value) delete c.look; else c.look = { at: s[0].value, limit: [+n[0].value, +n[1].value, +n[2].value], past: s[1].value }; touch(); renderInspector(); } } }, c.look ? "update" : "set")));
  // seam, shot, camera
  const look = [...castIds(), ...placed(lvl)];
  const sec1 = el("div", { class: "sec row" });
  if (i) { c.seam = c.seam || { kind: "blink" }; sec1.append(el("span", { class: "lab" }, "seam in"), sel(c.seam, "kind", SEAMS, { blank: false, after: renderInspector }), ["glance", "cutaway"].includes(c.seam.kind) ? sel(c.seam, "look", look, { blank: "look at…" }) : null); }
  sec1.append(el("span", { class: "lab" }, "shot"), sel(c, "shot", Object.entries(SHOTS).map(([k, v]) => [k, `${k} · ${v.dist}`]), { drop: true, title: c.shot && SHOTS[c.shot] ? `${SHOTS[c.shot].zone}: ${SHOTS[c.shot].use}` : "how close the actor comes to the player's eye" }));
  c.cam = c.cam || {};
  sec1.append(el("span", { class: "lab" }, "cam"), "lean", txt(c.cam, "push", { num: true, step: "0.05", style: "width:48px", title: "the player leans in over the clip, metres (up to 0.35)" }), "zoom", txt(c.cam, "zoom", { num: true, step: "0.01", style: "width:48px", title: "a held focus narrows the view a little (0 to 0.15); framing is distance, not lens" }),
    "roll", txt(c.cam, "roll", { num: true, style: "width:44px" }), "shake", txt(c.cam, "shake", { num: true, step: "0.1", style: "width:44px" }), "look", sel(c.cam, "look", look, { drop: true }));
  card.append(sec1);
  // event (QTE)
  const evs = el("div", { class: "sec row" }, el("span", { class: "lab" }, "event"));
  const evHolder = { type: c.event ? c.event.type : "" };
  evs.append(sel(evHolder, "type", EVENTS, { blank: "none", after: () => { if (!evHolder.type) delete c.event; else c.event = Object.assign({ secs: 3, prompt: "" }, c.event || {}, { type: evHolder.type }); if (evHolder.type === "choose" && !c.event.options) { c.event.options = [{ id: "a", label: "Say something" }, { id: "b", label: "Say nothing" }]; c.event.default = "b"; } touch(); renderInspector(); } }));
  if (c.event) {
    const e = c.event;
    evs.append("secs", txt(e, "secs", { num: true, style: "width:48px" }), "warn", txt(e, "warn", { num: true, step: "0.1", style: "width:48px", title: "seconds of warning sign before it (Little Hope's indicator)" }), txt(e, "prompt", { ph: "on-screen prompt" }));
    if (e.type === "struggle") evs.append("pull", sel(e, "pull", PULLS, { blank: false }), "need", txt(e, "need", { num: true, step: "0.1", style: "width:48px" }));
    if (e.type === "mash") evs.append("need", txt(e, "need", { num: true, step: "0.1", style: "width:48px" }));
    if (["press", "mash", "hold"].includes(e.type)) evs.append("key", txt(e, "key", { ph: "E", style: "width:40px" }));
    card.append(evs);
    if (e.type === "choose") card.append(jsonArea(e, "options", "options [{id, label}] (timed: the default is taken when time runs out)", { small: true, compact: true }), field("default", sel(e, "default", (e.options || []).map(o => o.id))));
    card.append(jsonArea(e, "on", `on: {${eventResults(e).join(", ")}: [actions]} (flags, doors…; a result choice after the scene branches on it)`, { small: true, compact: true }));
  } else card.append(evs);
  // body
  c.body = c.body || {};
  const b = c.body, bodySec = el("div", { class: "sec" });
  bodySec.append(el("div", { class: "row" }, el("span", { class: "lab" }, "body"), txt(b, "prompt", { w: true, ph: "Kimodo prompt (what the body does, in plain words)", drop: true })));
  b.block = b.block || [];
  const kt = el("table", {}, el("tr", {}, ...["at (0..1)", "pose", "ease in", "walk", "move to", ""].map(h => el("th", {}, h))));
  b.block.forEach((k, ki) => kt.append(el("tr", {}, el("td", { style: "width:64px" }, txt(k, "at", { num: true, step: "0.05" })), el("td", {}, sel(k, "pose", poseNames(), { blank: false })),
    el("td", {}, sel(k, "ease", M.EASE_NAMES, { blank: "inout", drop: true })), el("td", { style: "width:40px" }, el("input", { type: "checkbox", checked: !!k.walk, on: { change: e => { if (e.target.checked) k.walk = true; else delete k.walk; touch(); } } })),
    el("td", {}, sel(k, "move", spots(lvl), { drop: true })), el("td", { style: "width:28px" }, el("button", { on: { click: () => { b.block.splice(ki, 1); touch(); renderInspector(); } } }, "×")))));
  bodySec.append(kt, el("div", { class: "row" }, el("button", { on: { click: () => { c.body = b; b.block = b.block || []; const last = b.block[b.block.length - 1]; b.block.push({ at: last ? Math.min(1, +(last.at || 0) + 0.3) : 0, pose: last ? last.pose : "idle", ease: "inout" }); touch(); renderInspector(); } } }, "+ key"),
    el("span", { class: "lab" }, "fit"), sel(b, "fit", M.FITS, { blank: "stretch", drop: true, title: "when a generated motion and the take differ in length" }),
    el("span", { class: "lab" }, "blend"), txt(b, "blend", { num: true, step: "0.05", ph: "0.25", style: "width:52px", title: "seconds of crossfade from the previous clip" }),
    chk(b, "bridge", "in-between", renderInspector), el("span", { class: "lab" }, "file"), txt(b, "file", { ph: "Motion/… (generated)", drop: true, style: "width:180px" })));
  // modifiers
  b.mods = b.mods || [];
  const mt = el("div", {});
  b.mods.forEach((m, mi) => { const r = el("div", { class: "row" }, el("span", { class: "lab" }, "mod"), sel(m, "type", Object.keys(M.MOD_TYPES), { blank: false, after: renderInspector })); for (const f of M.MOD_TYPES[m.type] || []) r.append(f, txt(m, f, { num: true, step: "0.05", style: "width:52px" })); r.append(el("button", { on: { click: () => { b.mods.splice(mi, 1); touch(); renderInspector(); } } }, "×")); mt.append(r); });
  bodySec.append(mt, el("div", { class: "row" }, el("button", { on: { click: () => { c.body = b; b.mods = b.mods || []; b.mods.push({ type: "ease", in: 0.2, out: 0.2 }); touch(); renderInspector(); } } }, "+ modifier"),
    el("span", { class: "kv" }, "ease (in/out s) · speed · ramp · hold (at, secs) · snap (creep then strike) · twitch (uncanny stutter) · trim · loop · mirror")));
  if (!b.block.length) delete b.block; if (!b.mods.length) delete b.mods;
  card.append(bodySec);
  const fx = FIX[`${sid}.${c.id}`];
  if (fx) for (const f of fx) card.append(el("div", { class: "fix" }, f.text, f.apply ? el("button", { on: { click: () => { f.apply(); delete FIX[`${sid}.${c.id}`]; touch(); renderInspector(); } } }, f.label || "Apply") : null));
  if (!Object.keys(c.cam).length) delete c.cam;
  if (!Object.keys(c.body).length) delete c.body;
  return card;
}
function stitchEditor(box, st, tid) {
  box.append(el("h2", {}, "Stitch (player task)"), field("title", txt(st, "title", { w: true })), field("goal", txt(st, "goal", { w: true, ph: "what the player is doing" })),
    field("level", sel(st, "level", Object.keys(S.levels || {}), { after: showStage })), field("target", txt(st, "target_min", { num: true }), " min of play (typical)"),
    field("template", sel(st, "template", ["fetch", "code", "power", "hide", "escape", "explore", "loop", "ritual", "run", "collect", "sneak", "hold", "search"], { drop: true })));
  const hasT = !!st.timer;
  box.append(field("timer", el("label", { class: "kv" }, el("input", { type: "checkbox", checked: hasT, on: { change: e => { if (e.target.checked) st.timer = { secs: 30, label: "", fail: S.game.start }; else delete st.timer; touch(); renderInspector(); } } }), " timed"),
    hasT ? txt(st.timer, "secs", { num: true }) : null, hasT ? "s, on timeout go to" : null, hasT ? sel(st.timer, "fail", Object.keys(S.flow), { blank: false }) : null, hasT ? txt(st.timer, "label", { ph: "on-screen label" }) : null));
  const its = (S.interrupts || []).filter(it => it.during === "all" || (it.during || []).includes(tid));
  if (its.length) box.append(el("div", { class: "kv" }, "trigger cutscenes here: " + its.map(i => `${i.label || i.id} → ${i.to}`).join("; ")));
  const list = el("div", {});
  for (const b of st.beats || []) list.append(el("div", { class: "muted" }, `• ${b.id}: when ${JSON.stringify(b.when)} → ${(b.do || []).map(a => Object.keys(a)[0]).join(", ")}${b.optional ? " (optional)" : ""}${b.secret ? " (secret)" : ""}`));
  box.append(el("h2", {}, "Gameplay"), jsonArea(st, "play", `play: {"type": "${Object.keys(PLAYS).join("|")}", "secs": 40, "rule": "one line a child could say", "warn": "what tells you it's coming", "spots": [...], "on": {"found": [{"count": "found"}]}} (a result choice after it branches)`, { small: true, compact: true }));
  box.append(el("h2", {}, "Beats"), list, jsonArea(st, "beats", "beats (STORY_FORMAT §4)"));
}
function choiceEditor(box, n, nodeIds) {
  box.append(el("h2", {}, "Choice"), field("by", sel(n, "by", ["act", "flag", "result", "karma"], { blank: false, after: renderInspector })), field("prompt", txt(n, "prompt", { w: true })));
  if (n.by === "result") box.append(field("of", sel(n, "of", nodeIds.filter(k => S.flow[k].type === "scene"), { after: renderInspector })));
  const ev = n.by === "result" && S.flow[n.of] && S.scenes[S.flow[n.of].ref] ? (version(S.scenes[S.flow[n.of].ref]).clips || []).filter(c => c.event).map(c => c.event).pop() : null;
  const tb = el("table", {}, el("tr", {}, el("th", {}, "label"), el("th", {}, n.by === "act" ? "when (trigger JSON)" : n.by === "flag" ? "if flags (comma)" : n.by === "karma" ? "karma min · max (last: otherwise)" : "result"), el("th", {}, "to"), el("th", {})));
  (n.options = n.options || []).forEach((o, i) => {
    let cond;
    if (n.by === "act") cond = el("input", { class: "w", value: JSON.stringify(o.when || {}), on: { change: e => { try { o.when = JSON.parse(e.target.value); e.target.style.outline = ""; touch(); } catch (x) { e.target.style.outline = "1px solid var(--bad)"; } } } });
    else if (n.by === "flag") cond = el("input", { class: "w", value: (o.if || []).join(","), placeholder: "(last option: otherwise)", on: { change: e => { const v = e.target.value.trim(); if (v) o.if = v.split(",").map(s => s.trim()); else delete o.if; touch(); } } });
    else if (n.by === "karma") cond = el("span", { class: "row" }, txt(o, "min", { num: true, ph: "min", style: "width:60px", drop: true }), txt(o, "max", { num: true, ph: "max", style: "width:60px", drop: true }), txt(o, "axis", { ph: "axis", style: "width:70px", drop: true }));
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
function gameEditor() {
  const box = $("#inspector"); box.innerHTML = ""; const g = S.game;
  box.append(el("h2", {}, "Game · " + GAME), field("title", txt(g, "title", { w: true })),
    field("playtime", "typical ≥", txt(g, "target_min", { num: true }), "min · fast player ≥", txt(g, "fast_min", { num: true, ph: "120" }), "min"),
    el("div", { class: "kv", style: "margin-left:70px" }, "Cutscenes can't be skipped; tasks can be done fast. Steam refunds under 2 hours, so the fastest normal path must stay over fast_min."),
    field("takes", "≤", txt(g, "clip_max", { num: true }), "s a clip · voice", txt(g, "voice", { style: "width:40px" }), "text", txt(g, "text", { style: "width:40px" })));
  const bodyChoices = [["capsules", "capsule figure"], ...BODIES];
  box.append(el("h2", {}, "Bodies in the desk"), field("default", sel(g, "previs_body", bodyChoices, { blank: BODIES.length ? "first file in Bodies" : "capsule figure", drop: true, after: async () => { await loadBodies(); showStage(); } })),
    el("div", { class: "kv", style: "margin-left:70px" }, BODIES.length ? `Content/Studio/Bodies: ${BODIES.join(", ")}` : "Drop a rigged human (Manny exported from Unreal, a Mixamo character, a MetaHuman body: .fbx or .glb) into Content/Studio/Bodies and reload; see its README."));
  box.append(el("h2", {}, "Cast"));
  for (const [cid, c] of Object.entries(S.cast || {})) box.append(field(cid, txt(c, "name", { ph: "name" }), "height", txt(c, "height", { num: true, step: "0.01", world: true }), "body", sel(c, "previs_body", bodyChoices, { blank: "game default", drop: true, after: async () => { await loadBodies(); showStage(); } }), txt(c, "metahuman", { ph: "MetaHuman Blueprint path (later)", nullable: true }), el("button", { on: { click: () => { if (confirm("Remove " + cid + "?")) { delete S.cast[cid]; touch(true); gameEditor(); } } } }, "×")));
  box.append(el("button", { on: { click: () => { const id = prompt("cast id (snake_case)"); if (id && !S.cast[id]) { S.cast[id] = { name: id, height: 1.7, metahuman: null }; touch(true); gameEditor(); } } } }, "+ cast member"));
  box.append(el("h2", {}, "Trigger cutscenes (interrupts)"), el("div", { class: "kv" }, 'Alien Isolation style: [{"id", "label", "when": {"pickup": "doll"}, "during": ["t_search"] | "all", "to": "n_doll"}]. The checks play each one; bait is skipped on the main path.'),
    jsonArea(S, "interrupts", "interrupts"), el("h2", {}, "Secrets"), jsonArea(S, "secrets", "secrets {id: {flag, hint}}"),
    el("h2", {}, "Reusable motions"), jsonArea(S, "motions", "motions {id: {who, prompt, secs, loop, block}}"));
}

/* ---------- the stage under the board ---------- */
function currentScene() { const n = S && S.flow[SEL]; if (!n || n.type !== "scene") return null; const sc = S.scenes[n.ref]; if (!sc) return null; const vt = VTAB[n.ref]; return vt && sc.variants && sc.variants[vt] ? Object.assign({}, sc, sc.variants[vt], { pick: vt }) : sc; }
function showStage() {
  if (!flowStage || !PLAN || !S) return;
  stopPlay();
  const n = S.flow[SEL]; const ref = n && nodeRef(n);
  const lvl = (ref && ref.level) || Object.keys(S.levels)[0];
  flowStage.setWorld(PLAN, S, lvl);
  const sc = currentScene();
  if (sc) { const tl = flowStage.timeline(sc); $("#scrub").max = tl.total.toFixed(2); scrubTo(+$("#scrub").value || 0); }
  else { // a stitch or choice: the level from its start spot
    const start = things()[S.levels[lvl].start]; const fake = { view: S.levels[lvl].start, camera: { mode: "free" }, clips: [{ id: "x", who: "", en: "" }], stage: {} };
    if (start) { flowStage.frame(fake, 0, FILES); paintOv("#stageOv", { sub: null, who: (ref && ref.title) || SEL, black: 0, tag: n ? n.type : "" }); }
  }
}
function scrubTo(T) {
  const sc = currentScene(); if (!sc) return;
  const st = flowStage.frame(sc, T, FILES);
  if (PLAY && st.clipSeg && st.seg && st.seg.type === "clip" && PLAY.clip !== st.clipSeg.clip) { PLAY.clip = st.clipSeg.clip; const n = S.flow[SEL]; playTake("#stageBox", n.ref, sc.variants ? sc.pick : null, PLAY.clip, $("#wVideo").checked); }
  if (PLAY && st.seg && st.seg.type !== "clip" && PLAY.clip) { PLAY.clip = null; stopTakes(); }
  const tl = flowStage.timeline(sc);
  $("#sTime").textContent = `${T.toFixed(1)} / ${tl.total.toFixed(1)} s`;
  const ph = $("#playhead"); if (ph) ph.style.left = (T / tl.total * 100) + "%";
  paintOv("#stageOv", { sub: st.sub, ja: st.ja, who: st.clipSeg ? `${st.clipSeg.clip.id} · ${st.clipSeg.clip.shot || "free"} · ${st.who || ""}` : "", black: st.black, tag: st.seg ? (st.seg.type === "seam" ? "seam: " + st.seg.seam.kind : st.seg.type === "event" ? "⚡ " + st.seg.event.type : "") : "" });
}
function paintOv(sel, o) {
  const ov = $(sel); ov.querySelector(".sub").textContent = o.sub || ""; ov.querySelector(".ja").textContent = o.ja || ""; ov.querySelector(".who").textContent = o.who || "";
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
function stopPlay() { if (PLAY) PLAY.stop = true; PLAY = null; stopTakes(); }
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
      const a = flowStage.clipPose(prev.clip, prev.dur, prev.dur, FILES), z = flowStage.clipPose(c, 0, seg.dur, FILES);
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
const sleep = ms => new Promise(r => { const t = setTimeout(r, ms); RUN && RUN.timers.push(t); });
function wclear() { $("#watchBox").querySelectorAll(".wcard,.qte,.warnmark").forEach(e => e.remove()); }
async function fade(to, secs) { const b = $("#watchOv .black"), from = +b.style.opacity || 0, t0 = performance.now(), d = Math.max(0.05, secs) * 1000; while (RUN) { const u = Math.min(1, (performance.now() - t0) / d); b.style.opacity = from + (to - from) * u; if (u >= 1) break; await new Promise(r => requestAnimationFrame(r)); } }
function speak(text) { if (!$("#wSpeak").checked || !window.speechSynthesis || !text) return; const u = new SpeechSynthesisUtterance(text); u.lang = "ja-JP"; speechSynthesis.cancel(); speechSynthesis.speak(u); }
function wclock() { if (RUN) { $("#wClock").textContent = `story time ${Math.floor(RUN.secs / 60)}:${String(Math.round(RUN.secs % 60)).padStart(2, "0")}`; $("#wKarma").textContent = " · karma " + (Object.entries(RUN.karma).map(([k, v]) => (k === "karma" ? "" : k + " ") + (v > 0 ? "+" : "") + v).join(" ") || "0"); } }
function karmaAct(acts) { for (const a of acts || []) { if (a.flag) RUN.flags.add(a.flag); if (a.karma !== undefined) addKarma(RUN.karma, a.karma); if (a.count) RUN.counters[a.count] = a.set !== undefined ? +a.set : (RUN.counters[a.count] || 0) + +(a.add ?? 1); } wclock(); }
// a reply: left and right, the Japanese over the English; she waits (her idle keeps going), then carries on
function runReply(rp, frame) {
  return new Promise(resolve => {
    const secs = +(rp.wait || REPLY_SECS), opts = (rp.options || []).slice(0, 2), t0 = performance.now();
    const box = el("div", { class: "reply" }), bar = el("div", { class: "rbar" }, el("div", {}));
    let done = false;
    const finish = id => { if (done) return; done = true; window.removeEventListener("keydown", kd); box.remove(); resolve(id); };
    const kd = e => { const k = e.key.toLowerCase(); if ((k === "arrowleft" || k === "a") && opts[0]) finish(opts[0].id); if ((k === "arrowright" || k === "d") && opts[1]) finish(opts[1].id); };
    opts.forEach((o, i) => box.append(el("button", { class: "ropt " + (i ? "right" : "left"), title: o.sets && o.sets.length ? "sets " + JSON.stringify(o.sets) : "", on: { click: () => finish(o.id) } },
      el("div", { class: "rja" }, o.ja || ""), el("div", { class: "ren" }, o.label || o.id))));
    box.append(bar); $("#watchBox").append(box); window.addEventListener("keydown", kd);
    const tick = () => { if (done) return; if (!RUN) return finish(null); const u = (performance.now() - t0) / 1000; frame(u); bar.firstChild.style.width = Math.max(0, 100 - u / secs * 100) + "%"; if (u >= secs) return finish(null); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}
const LOOK = { yaw: 0, pitch: 0, moved: 0 };
function wireLook() {
  const box = $("#watchBox");
  box.addEventListener("mousemove", e => { const r = box.getBoundingClientRect(); LOOK.yaw = ((e.clientX - r.left) / r.width - 0.5) * 70; LOOK.pitch = -((e.clientY - r.top) / r.height - 0.5) * 40; LOOK.moved = performance.now(); });
}
async function watchScene(sc, nid, sid, k) {
  watchStage.setWorld(PLAN, S, sc.level || Object.keys(S.levels)[0]);
  const picks = {}, replied = new Set();
  let tl = watchStage.timeline(sc, picks);
  const en = sc.enter || { kind: "fade", secs: 0.6 };
  watchStage.apply(tl, watchStage.stateAt(tl, 0, FILES), 0); watchStage.render();
  if (en.kind !== "cut") await fade(0, en.secs || 0.6); else $("#watchOv .black").style.opacity = 0;
  let T = 0, last = performance.now(), spoken = null, warned = null;
  while (RUN && T < tl.total) {
    await new Promise(r => requestAnimationFrame(r));
    const now = performance.now(); T += (now - last) / 1000; last = now;
    const st = watchStage.stateAt(tl, T, FILES, LOOK);
    if (st.seg && st.seg.type === "event" && !RUN.done.has(st.seg)) { RUN.done.add(st.seg); const ev = st.seg.event, res = await runEvent(ev); RUN.results[nid] = res; karmaAct((ev.on || {})[res]);
      if (ev.type === "choose") { const o = (ev.options || []).find(x => x.id === res); if (o && o.karma !== undefined) { addKarma(RUN.karma, o.karma); RUN.answers.push(`${o.label} (${JSON.stringify(o.karma)})`); } }
      RUN.secs += eventSecs(ev, S); wclock(); T = st.seg.end; last = performance.now(); continue; }
    if (st.seg && st.seg.type === "reply" && !replied.has(st.seg.clip.id)) {
      const c = st.seg.clip, T0 = st.seg.start; replied.add(c.id); stopTakes();
      const tw = watchStage.timeline(sc, Object.assign({}, picks, { [c.id]: null }));     // waiting: the whole wait, her idle running
      const id = await runReply(c.reply, u => { const tt = T0 + u, s2 = watchStage.stateAt(tw, tt, FILES, LOOK); watchStage.apply(tw, s2, tt); watchStage.render();
        paintOv("#watchOv", { sub: c.en, ja: c.ja, who: `${sc.title || ""} · ${c.who || ""}` }); });                 // the question stays up while she waits
      picks[c.id] = id;
      const o = (c.reply.options || []).find(x => x.id === (id === null ? c.reply.timeout : id));
      if (o) karmaAct(o.sets);
      RUN.answers.push(`${c.id}: ${o ? o.label : "(silence)"}`);
      tl = watchStage.timeline(sc, picks);
      const rs = tl.segs.find(s => s.type === "reply" && s.clip.id === c.id); T = rs ? rs.end : T; last = performance.now(); continue;
    }
    const nextEv = tl.segs.find(s => s.type === "event" && s.start > T && s.event.warn && s.start - T < +s.event.warn);
    if (nextEv && warned !== nextEv) { warned = nextEv; const w = el("div", { class: "warnmark" }, "!"); $("#watchBox").append(w); setTimeout(() => w.remove(), +nextEv.event.warn * 1000); }
    watchStage.apply(tl, st, T); watchStage.render();
    paintOv("#watchOv", { sub: st.sub, ja: st.ja, who: st.clipSeg ? `${sc.title || ""} · ${st.who || ""}` : "", black: st.black, tag: st.seg && st.seg.type === "seam" ? "" : "" });
    if (st.clipSeg && spoken !== st.clipSeg) { spoken = st.clipSeg; if (!playTake("#watchBox", sid, k, st.clipSeg.clip, $("#wVideo").checked)) speak(st.clipSeg.clip.ja); }
    if (st.seg && st.seg.type !== "clip") stopTakes();
    if (RUN.skip) { RUN.skip = false; const ne = tl.segs.find(s => (s.type === "event" && s.start > T && !RUN.done.has(s)) || (s.type === "reply" && s.start > T && !replied.has(s.clip.id))); if (ne) { T = ne.start; continue; } break; }   // dev skip: to the next event or reply, else the scene's end
  }
  stopTakes();
  if (!RUN) return;
  RUN.secs += tl.total; wclock();
  karmaAct(sc.sets);
  const ex = sc.exit || { kind: "fade", secs: 0.6 };
  await fade(1, ex.kind === "cut" ? 0.05 : ex.secs || 0.6);
}
function runEvent(ev) {
  return new Promise(resolve => {
    const secs = eventSecs(ev, S), box = el("div", { class: "qte" }), bar = el("div", { class: "bar" }, el("div", {})), key = (ev.key || "E").toUpperCase();
    let done = false, score = 0, held = false, t0 = performance.now(), lastMove = null;
    const finish = r => { if (done) return; done = true; window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); window.removeEventListener("mousemove", mv); box.remove(); resolve(r); };
    const kd = e => { if (e.key.toUpperCase() !== key) return; if (ev.type === "press") finish("success"); if (ev.type === "mash") score += 1 / Math.max(4, (ev.need || 0.6) * 20); if (ev.type === "hold") held = true; };
    const ku = e => { if (ev.type === "hold" && e.key.toUpperCase() === key && held) finish("fail"); };
    let drag = null;
    const mv = e => { if (ev.type === "breath") { if (lastMove && Math.hypot(e.movementX, e.movementY) > 6) finish("fail"); lastMove = 1; }
      if (ev.type === "struggle") { if (e.buttons & 1) { if (drag) { const dir = { back: [0, 1], down: [0, 1], left: [-1, 0], right: [1, 0] }[ev.pull || "back"]; const d = dir ? Math.max(0, (e.clientX - drag[0]) * dir[0] + (e.clientY - drag[1]) * dir[1]) : Math.hypot(e.clientX - drag[0], e.clientY - drag[1]); score += d / 1200; } drag = [e.clientX, e.clientY]; } else drag = null; } };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku); window.addEventListener("mousemove", mv);
    const label = { press: `Press <${key}>`, mash: `Mash <${key}>`, hold: `Hold <${key}>`, breath: "Keep still (don't move the mouse)", aim: "Click the mark", struggle: `Drag the mouse ${ev.pull || "back"}!`, choose: "" }[ev.type];
    box.append(el("div", { style: "font-size:20px" }, ev.prompt || ""), ...(label ? [el("div", { class: "key" }, label)] : []), bar);
    if (ev.type === "choose") { const left = el("div", { class: "muted" }); box.append(left); const t1 = performance.now(); const cd = () => { if (done) return; left.textContent = `${Math.max(0, secs - (performance.now() - t1) / 1000).toFixed(0)} s · on time out: ${((ev.options || []).find(o => o.id === ev.default) || {}).label || ev.default}`; requestAnimationFrame(cd); }; cd();
      for (const o of ev.options || []) box.append(el("button", { class: "primary", style: "margin:4px;display:block;width:100%", title: o.karma !== undefined ? "karma " + JSON.stringify(o.karma) : "", on: { click: () => finish(o.id) } }, o.label, o.ja ? el("div", { class: "muted", style: "font-size:12px" }, o.ja) : null)); }
    if (ev.type === "aim") { const dot = el("button", { style: "position:fixed;width:26px;height:26px;border-radius:13px;background:var(--bad);left:" + (30 + Math.random() * 40) + "%;top:" + (25 + Math.random() * 35) + "%", on: { click: () => finish("success") } }); box.append(dot); }
    $("#watchBox").append(box);
    const tick = () => { if (done || !RUN) return finish("fail");
      const u = (performance.now() - t0) / (secs * 1000);
      bar.firstChild.style.width = (ev.type === "mash" || ev.type === "struggle" ? Math.min(100, score / (ev.type === "struggle" ? +(ev.need || 0.6) : 1) * 100) : Math.max(0, 100 - u * 100)) + "%";
      if (ev.type === "mash" && score >= 1) return finish("success");
      if (u >= 1) { if (ev.type === "hold") return finish(held ? "success" : "fail"); if (ev.type === "breath") return finish("success"); if (ev.type === "struggle") return finish(score >= +(ev.need || 0.6) ? "escape" : "caught"); if (ev.type === "choose") return finish(ev.default); return finish("fail"); }
      requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}
async function watchStitch(st, nid, n) {
  paintOv("#watchOv", { black: +$("#watchOv .black").style.opacity || 0 });
  const lvl = st.level || Object.keys(S.levels)[0];
  if ($("#wPlay").checked && !st.play) return playStitch(st, n, lvl);
  watchStage.setWorld(PLAN, S, lvl);
  watchStage.frame({ view: S.levels[lvl].start, camera: { mode: "free" }, clips: [{ id: "x", who: "", en: "" }], stage: {} }, 0, FILES);
  await fade(0.25, 0.5);
  const mins = +(st.target_min || 3);
  for (const b of st.beats || []) if (!b.secret || $("#wSecrets").checked) for (const a of b.do || []) { if (a.flag) RUN.flags.add(a.flag); if (a.karma !== undefined && !b.optional) addKarma(RUN.karma, a.karma); }
  const its = (S.interrupts || []).filter(it => it.during === "all" || (it.during || []).includes(n.ref));
  if (st.play) {                                   // a round of gameplay: did it go your way?
    const pl = st.play, results = PLAYS[pl.type] || ["success", "fail"];
    const res = await new Promise(done => {
      const bar = el("div", { class: "rbar", style: "width:320px;margin:8px auto" }, el("div", {})), t0 = performance.now();
      const card = el("div", { class: "wcard" }, el("div", { class: "muted" }, `GAMEPLAY · ${pl.type}${st.template ? " · " + st.template : ""}`), el("div", { class: "big" }, st.title || ""),
        el("div", {}, pl.rule || ""), pl.warn ? el("div", { class: "muted" }, "warning: " + pl.warn) : null, (pl.spots || []).length ? el("div", { class: "muted" }, "where: " + pl.spots.join(", ")) : null,
        bar, el("div", { class: "muted" }, `${pl.secs} s · how did it go?`),
        pl.seeker ? el("div", { class: "muted" }, `seeker: ${pl.seeker}${pl.loops ? " · loops: " + Object.entries(pl.loops).map(([r, m]) => `${r} ${m}`).join(", ") : ""}`) : null,
        el("div", {}, ...results.map((r, i) => el("button", { class: i ? "" : "primary", style: "margin:4px", on: { click: () => done(r) } }, r.replace(/_/g, " ")))));
      $("#watchBox").append(card);
      const bk = pl.barks || {}, said = new Set();       // her lines through the round: counting, searching, close
      const tk = () => { if (!RUN || !card.isConnected) return; const u = (performance.now() - t0) / 1000 / +pl.secs; bar.firstChild.style.width = Math.max(0, 100 - u * 100) + "%";
        for (const [at, m] of [[0, "start"], [0.02, "count"], [0.35, "search"], [0.7, "near"]]) if (u >= at && !said.has(m) && bk[m]) { said.add(m); playLine(pickOne(bk[m])); }
        if (u >= 1) return done(results[0]); requestAnimationFrame(tk); }; tk();
      if ($("#wFast").checked) sleep(2000).then(() => done(results[0]));
    });
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
  if (!RUN.play) RUN.play = new PlayRuntime(watchStage, S, PLAN, $("#watchBox"), { run: RUN, fade, theme: $("#wTheme").value || null, settings: { crouch: { mode: $("#wCrouch").value } } });
  return RUN.play;
}
function playPlace(rt, lvl) {
  const a = RUN.afterScene; RUN.afterScene = null;
  if (a && a.level === lvl) rt.placeFromCamera(lvl, a.cam);
  else if (rt.level !== lvl) rt.placeAt(lvl, S.levels[lvl].start);
  else rt.enterLevel(lvl);
}
async function playStitch(st, n, lvl) {
  const rt = playRt(), t0 = performance.now();
  playPlace(rt, lvl);
  const its = (S.interrupts || []).filter(it => it.during === "all" || (it.during || []).includes(n.ref));
  const go = rt.runStitch(st, n, its);
  await fade(0, 0.5);
  const r = await go;
  rt.pause();
  RUN.secs += (performance.now() - t0) / 1000; wclock();
  await fade(1, 0.4);
  return r.to;
}
async function playChoice(n) {
  const rt = playRt();
  playPlace(rt, rt.level || (RUN.afterScene && RUN.afterScene.level) || Object.keys(S.levels)[0]);
  const go = rt.runChoice(n);
  await fade(0, 0.4);
  const o = await go;
  rt.pause();
  return o;
}
function watchChoice(n) {
  return new Promise(res => { const card = el("div", { class: "wcard" }, el("div", { class: "muted" }, "THE PLAYER DECIDES (by acting)"), el("div", { class: "big" }, n.prompt || ""), ...(n.options || []).map(o => el("button", { class: "primary", on: { click: () => { card.remove(); res(o); } } }, o.label || JSON.stringify(o.when)))); $("#watchBox").append(card); });
}
/* ---------- the branch map: every node reached keeps its checkpoint; a death lets the player return to one ---------- */
const PKEY = () => `dd.progress.${GAME}`;
function progress() { try { return JSON.parse(localStorage.getItem(PKEY()) || "{}"); } catch (e) { return {}; } }
function saveProgress(p) { try { localStorage.setItem(PKEY(), JSON.stringify(p)); } catch (e) { } }
function snapOf(R) { return { secs: R.secs, flags: [...R.flags], results: R.results, karma: R.karma, counters: R.counters, answers: R.answers, trail: R.trail }; }
function reach(nid) {                              // the first arrival's state is the checkpoint
  const p = progress(); p.visited = p.visited || {};
  if (!p.visited[nid]) p.visited[nid] = snapOf(RUN);
  if (S.flow[nid].type === "ending") p.endings = [...new Set([...(p.endings || []), nid])];
  saveProgress(p);
}
async function watch(fromNid, snap) {
  if (!S) return;
  stopWatch();
  RUN = { secs: 0, flags: new Set(), results: {}, timers: [], trail: [], done: new Set(), karma: {}, counters: {}, answers: [] };
  if (snap) Object.assign(RUN, JSON.parse(JSON.stringify(snap)), { flags: new Set(snap.flags || []), timers: [], done: new Set(), trail: [...(snap.trail || [])] });
  wclock();
  $("#watchOv .black").style.opacity = 1;
  let nid = fromNid || S.game.start, guard = 0;
  while (RUN && nid && S.flow[nid] && guard++ < 300) {
    const n = S.flow[nid]; reach(nid); RUN.trail.push(nid); $("#wTrail").textContent = RUN.trail.join(" › ");
    if (n.type === "scene") { let sc0 = S.scenes[n.ref] || {};
      if (sc0.pick_by === "found_at" && RUN.foundAt && (sc0.variants || {})[RUN.foundAt]) sc0 = Object.assign({}, sc0, { pick: RUN.foundAt });   // the death where she caught you
      await watchScene(version(sc0), nid, n.ref, sc0.variants ? sc0.pick : null); nid = n.next;
      if (RUN) RUN.afterScene = { level: version(sc0).level || Object.keys(S.levels)[0], cam: watchStage.camera.clone() }; }
    else if (n.type === "stitch") nid = await watchStitch(S.stitches[n.ref] || {}, nid, n);
    else if (n.type === "choice") {
      if (n.by === "act" && $("#wPlay").checked) nid = (await playChoice(n)).to;
      else if (n.by === "act") { paintOv("#watchOv", { black: +$("#watchOv .black").style.opacity || 0 }); await fade(0.3, 0.3); nid = (await watchChoice(n)).to; }
      else if (n.by === "result") nid = (n.options.find(o => o.result === RUN.results[n.of]) || n.options[0]).to;
      else if (n.by === "karma") nid = karmaPick(n, RUN.karma, S).to;
      else if (n.by === "count") nid = (n.options.find(o => { const v = RUN.counters[o.count] || 0; return (o.min === undefined || v >= o.min) && (o.max === undefined || v <= o.max); }) || n.options[n.options.length - 1]).to;
      else nid = (n.options.find(o => (o.if || []).every(f => f.startsWith("!") ? !RUN.flags.has(f.slice(1)) : RUN.flags.has(f))) || n.options[n.options.length - 1]).to;
    } else {
      const death = n.kind === "death", rt = n.retry && S.flow[n.retry];
      $("#watchOv .black").style.opacity = death ? 0.8 : 0.6; paintOv("#watchOv", { sub: "", who: "" });
      $("#watchBox").append(el("div", { class: "wcard" + (death ? " death" : "") }, el("div", { class: "muted" }, death ? "YOU DIED" : "ENDING · " + (n.kind || "")), el("div", { class: "big" }, n.title || nid),
        el("div", { class: "muted" }, `${(RUN.secs / 60).toFixed(1)} min of story time on this path`), el("div", { class: "muted" }, "karma " + JSON.stringify(RUN.karma) + (Object.keys(RUN.counters).length ? " · " + JSON.stringify(RUN.counters) : "") + (RUN.answers.length ? " · " + RUN.answers.join("; ") : "")),
        el("div", {}, rt ? el("button", { class: "primary", style: "margin:4px", on: { click: () => { const p = progress(); watch(n.retry, (p.visited || {})[n.retry]); } } }, "Return to: " + ((nodeRef(rt) || {}).title || rt.title || n.retry)) : null,
          el("button", { style: "margin:4px", on: { click: () => openBranches(n.retry || nid) } }, "Branch map"))));
      window.__watchEnd = n.title || nid; break;
    }
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
  const pos = layout(), wrap = el("div", { class: "bmap" }); let W = 0, Hh = 0;
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
function stopWatch() { stopTakes(); if (RUN) { RUN.timers.forEach(clearTimeout); if (RUN.play) RUN.play.stop(); RUN = null; } window.speechSynthesis && speechSynthesis.cancel(); wclear(); paintOv("#watchOv", {});
  if (RELOAD_AFTER_WATCH && !DIRTY) { RELOAD_AFTER_WATCH = false; load().then(() => status("environment reloaded from the scene builder")); } }
document.addEventListener("keydown", e => { if (e.key === "Escape" && RUN && $("#wSkip").checked) RUN.skip = true; });

/* ---------- takes and notes ---------- */
function renderClips() {
  const v = $("#clipsView"); v.innerHTML = ""; if (!S) return; const max = S.game.clip_max || 10; let rec = 0, all = 0;
  const ANS = new Set();
  const v3 = (S.format || 2) >= 3, prompts = [], loaded = allClips().filter(x => TAKES[x.id]).length;
  const tb = el("table", {}, el("tr", {}, ...["take id", "scene", "ver", "clip", "who", "ja", "en", "act", "shot", "event", "secs", "seam in", ...(v3 ? ["MiniMax prompt", ""] : [])].map(h => el("th", {}, h))));
  for (const [sid, sc] of Object.entries(S.scenes || {})) {
    const vers = sc.variants ? Object.entries(sc.variants) : [[null, sc]];
    for (const [k, ver] of vers) (ver.clips || []).flatMap(c => [c, ...((c.reply && c.reply.options) || []).filter(o => o.then).map(o => { const t = thenClip(c, o); ANS.add(t); return t; })]).forEach((c, i) => {
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
  v.append(el("h2", {}, `Takes · ${rec}/${all} recorded`), el("p", { class: "muted" }, "Record each row as one MiniMax clip, named by its take id (.wav and .mp4), starting and ending on the anchor frame. Then: python tools/intake.py --game " + GAME + " <folder>."),
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

/* ---------- wiring ---------- */
function renderAll() { renderBoard(); renderInspector(); if ($("#clipsView").classList.contains("on")) renderClips(); if ($("#notesView").classList.contains("on")) renderNotes(); }
document.querySelectorAll("nav button").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll("nav button").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("on", v.id === b.dataset.v));
  if (b.dataset.v === "branchView") renderBranches(); if (b.dataset.v === "clipsView") renderClips(); if (b.dataset.v === "notesView") renderNotes(); if (b.dataset.v === "boardView") renderStoryboard();
  if (b.dataset.v !== "watchView") stopWatch(); if (b.dataset.v === "flowView") { flowStage.resize(); showStage(); } if (b.dataset.v === "watchView") watchStage.resize();
}));
$("#save").onclick = () => save();
$("#reload").onclick = () => { if (!DIRTY || confirm("Drop your unsaved edits?")) load(); };
$("#bannerReload").onclick = () => load();
$("#game").onchange = e => { if (DIRTY && !confirm("Drop unsaved edits?")) { e.target.value = GAME; return; } GAME = e.target.value; SEL = null; FILES = {}; load(); };
$("#newGame").onclick = async () => { const name = prompt("New game's name (letters and digits, e.g. LanternHouse)"); if (!name) return; try { const j = await api("/api/new/" + encodeURIComponent(name), { method: "POST" }); fillGames(j.games); GAME = name; $("#game").value = name; SEL = null; await load(); } catch (e) { alert(e.message); } };
$("#gameSettings").onclick = () => { if (S) gameEditor(); };
$("#check").onclick = async () => {
  if (DIRTY) await save();
  const box = $("#inspector"); box.innerHTML = ""; box.append(el("h2", {}, "Checks"), el("p", { class: "muted" }, "running…"));
  const j = await api("/api/check/" + encodeURIComponent(GAME), { method: "POST" }); box.innerHTML = "";
  const okk = /STORY ok/.test(j.output) && /LEVEL ok/.test(j.output);
  box.append(el("h2", {}, "Checks"), el("p", { class: okk ? "ok" : "err" }, okk ? "All checks pass." : "Something to fix:"), el("pre", {}, j.output), el("button", { on: { click: renderInspector } }, "Back to the node"));
};
$("#generate").onclick = async () => {
  if (DIRTY) await save();
  const box = $("#inspector"); box.innerHTML = ""; box.append(el("h2", {}, "Generate in Unreal"), el("p", { class: "muted", id: "genState" }, "baking the scenes…"));
  stopWatch(); await loadFiles(); if (!PLAN) await replan();
  try {                                        // the Watch, recorded: what Unreal's preview plays (bake.js)
    const saveBody = (who, blob) => fetch(`/api/export/${encodeURIComponent(GAME)}/Body_${encodeURIComponent(who)}.glb`, { method: "POST", body: blob });
    const pv = await bakePreview(watchStage, S, PLAN, FILES, 30, (i, n, id) => { $("#genState").textContent = `baking the scenes… ${i + 1}/${n} (${id})`; }, GLTFExporter, saveBody);
    await api("/api/preview/" + encodeURIComponent(GAME), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pv) });
  } catch (e) { $("#genState").className = "err"; $("#genState").textContent = "The bake failed: " + e.message; return; }
  $("#genState").textContent = "running the checks…";
  const j = await api("/api/unreal/generate/" + encodeURIComponent(GAME), { method: "POST" });
  box.append(el("pre", {}, (j.checks || []).join("\n")));
  const st = $("#genState");
  if (!j.ok) { st.className = "err"; st.textContent = j.error; return; }
  st.textContent = j.how === "started" ? "Starting the editor with the build (the first open takes a few minutes)…" : "Building in the open editor…";
  const t0 = Date.now();
  const poll = async () => {
    const r = await api("/api/unreal/status/" + encodeURIComponent(GAME));
    if (r.state === "done") {
      st.className = r.ok ? "ok" : "err";
      st.textContent = r.ok ? `Built: ${Object.entries(r.levels || {}).map(([k, v]) => `${k} (${v.pieces} pieces)`).join(", ")}. ${r.open || ""} is open in Unreal.` : "Failed: " + (r.errors || []).join("; ");
      if (r.trace) box.append(el("pre", {}, r.trace));
      return;
    }
    st.textContent = `${r.state === "building" ? "Building in Unreal" : "Waiting for Unreal"}… ${Math.round((Date.now() - t0) / 1000)} s`;
    setTimeout(poll, 2000);
  };
  poll();
};
$("#sPlay").onclick = () => { const sc = currentScene(); if (sc) playScene(sc); };
$("#sStop").onclick = stopPlay;
$("#scrub").oninput = e => { stopPlay(); scrubTo(+e.target.value); };
$("#sFree").onclick = e => { flowStage.setFree(!flowStage.free); e.target.classList.toggle("on", !!flowStage.free); scrubTo(+$("#scrub").value); };
$("#sFix").onclick = checkBodies;
$("#sExport").onclick = exportGLTF;
$("#wStart").onclick = () => watch();
$("#wStop").onclick = stopWatch;
wireLook();
window.__dd = { get S() { return S; }, get PLAN() { return PLAN; }, get play() { return RUN && RUN.play; }, get run() { return RUN; }, openBuilder, get flowStage() { return flowStage; }, checkBodies, exportGLTF, drawBoard, select: id => { SEL = id; renderBoard(); renderInspector(); showStage(); } };
boot();

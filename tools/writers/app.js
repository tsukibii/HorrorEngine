// The writers' room's page (docs/WRITERS_ROOM.md): you write the story as a flowchart: shapes from the palette, joined
// by arrows, each holding your gist (what happens, who, where, the lines you have, the talks' answers). The inspector
// edits what's picked; About holds the brief and the story's heart, Cast & places who and where, Faces the MiniMax post
// prompts. Every change is saved (the server keeps the versions) and undoable here; Build turns it into a rough,
// working outline in the director, and Claude reads it all (room.py show, room.py now).
import { Chart, SHAPES, ICONS } from "./canvas.js";

const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "on") for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else if (k === "class") e.className = v;
    else if (k === "value") e.value = v ?? "";
    else if (k === "checked") e.checked = !!v;
    else if (k === "style") e.setAttribute("style", v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
const api = async (path, body) => {
  const r = await fetch("/api/" + path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
};
const clone = o => JSON.parse(JSON.stringify(o));
const q = s => `“${s}”`;
function toast(text, bad = false) {
  const t = $("#toast"); t.textContent = text; t.classList.toggle("bad", bad); t.classList.add("on");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), bad ? 7000 : 2600);
}

// ---- the state ---------------------------------------------------------------------------------------------------
let SID = null, P = null, CHECK = { errors: [], warnings: [], minutes: [0, 0] }, LIB = {};
let TAB = "flow", UNDO = [], REDO = [], BASE = null, SAVE_T = 0, NOW_T = 0, CHART = null;
const params = new URLSearchParams(location.search);
const POINTS = ["scene", "talk", "task", "chapter"];
const TYPE_COLOR = { start: "#6cc58a", scene: "#6fb3d9", talk: "#e07a90", task: "#e3a64e", chapter: "#a185e6", choice: "#d8d2c6", secret: "#e5b450", ending: "#d4655c", note: "#e8d27c" };

// ---- the session: load, save, undo -------------------------------------------------------------------------------
async function open(sid) {
  const r = await api("session/" + encodeURIComponent(sid));
  SID = sid; P = r.prototype; CHECK = r; BASE = JSON.stringify(P); UNDO = []; REDO = [];
  try { localStorage.setItem("writers.last", sid); } catch (e) { }
  const u = new URL(location.href); u.searchParams.set("s", sid); history.replaceState(null, "", u);
  $("#title").value = P.title || "";
  CHART.viewSet = false; CHART.sel = { nodes: new Set(), edges: new Set(), frames: new Set() };
  setTab(params.get("tab") || "flow");
}
// a change: the snapshot before it goes on the undo stack once, the save waits for a pause
function changed(redraw = true) {
  if (!P) return;
  if (BASE !== null && !SAVE_T) { UNDO.push(BASE); if (UNDO.length > 150) UNDO.shift(); REDO = []; }
  clearTimeout(SAVE_T); SAVE_T = setTimeout(flush, 600);
  $("#saved").textContent = "editing…";
  if (redraw && TAB === "flow") CHART.render();
}
async function flush() {
  clearTimeout(SAVE_T); SAVE_T = 0;
  if (!P) return;
  const now = JSON.stringify(P);
  if (now === BASE) { $("#saved").textContent = "saved"; return; }
  try {
    const r = await api("session/" + encodeURIComponent(SID), { prototype: P });
    BASE = now; CHECK = r; $("#saved").textContent = "saved";
    renderBar(); if (TAB === "flow") CHART.render();
  } catch (e) { $("#saved").textContent = "not saved"; toast(e.message, true); }
}
async function undo(back = true) {
  await flush();
  const from = back ? UNDO : REDO, to = back ? REDO : UNDO;
  if (!from.length) return toast(back ? "nothing to undo" : "nothing to redo");
  to.push(JSON.stringify(P));
  P = JSON.parse(from.pop()); BASE = null;
  const s = JSON.stringify(P);
  try { CHECK = await api("session/" + encodeURIComponent(SID), { prototype: P }); } catch (e) { toast(e.message, true); }
  BASE = s; $("#title").value = P.title || "";
  const ids = new Set((P.nodes || []).map(n => n.id)), es = new Set((P.edges || []).map(x => x.id)), fs = new Set((P.frames || []).map(x => x.id));
  const sel = CHART.sel; for (const id of [...sel.nodes]) if (!ids.has(id)) sel.nodes.delete(id); for (const id of [...sel.edges]) if (!es.has(id)) sel.edges.delete(id); for (const id of [...sel.frames]) if (!fs.has(id)) sel.frames.delete(id);
  renderAll(); toast(back ? "undone" : "redone");
}

// ---- the tabs ----------------------------------------------------------------------------------------------------
function setTab(t) {
  TAB = t;
  for (const b of document.querySelectorAll("#tabs button")) b.classList.toggle("on", b.dataset.tab === t);
  for (const id of ["flow", "about", "people", "faces"]) $("#" + id).classList.toggle("hidden", id !== t);
  renderAll();
}
function renderAll() {
  if (!P) return;
  if (TAB === "flow") { CHART.render(); renderInspector(); }
  if (TAB === "about") renderAbout();
  if (TAB === "people") renderPeople();
  if (TAB === "faces") renderFaces();
  renderBar(); tellNow();
}

// ---- small form pieces -------------------------------------------------------------------------------------------
function input(obj, key, attrs = {}, after) {
  return el("input", Object.assign({ value: obj[key] ?? "", on: { input: e => { obj[key] = attrs.type === "number" ? (e.target.value === "" ? 0 : +e.target.value) : e.target.value; changed(); if (after) after(); } } }, attrs));
}
function area(obj, key, rows = 3, ph = "", after) {
  return el("textarea", { rows, placeholder: ph, value: obj[key] ?? "", on: { input: e => { obj[key] = e.target.value; changed(); if (after) after(); } } });
}
function select(obj, key, opts, after, blank) {
  return el("select", { on: { change: e => { obj[key] = e.target.value; changed(); if (after) after(); } } },
    blank !== undefined ? el("option", { value: "" }, blank) : null,
    ...opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; const x = el("option", { value: v }, l); if (String(obj[key] ?? "") === String(v)) x.selected = true; return x; }));
}
const lab = (text, ...kids) => [el("label", {}, text), ...kids];
const del = (fn, title = "remove") => el("button", { class: "ghost", title, on: { click: fn } }, "✕");
function list(arr, draw, add, addLabel, max = 99, after) {
  const box = el("div");
  const redraw = () => box.replaceChildren(...arr.map((x, i) => el("div", { class: "item" }, draw(x, i, () => { arr.splice(i, 1); changed(); redraw(); if (after) after(); }))),
    arr.length < max ? el("button", { class: "ghost add", on: { click: () => { arr.push(add()); changed(); redraw(); if (after) after(); } } }, "+ " + addLabel) : null);
  redraw(); return box;
}
const castOf = () => P.cast || (P.cast = []);
const placesOf = () => P.places || (P.places = []);
const nameOf = id => (castOf().find(c => c.id === id) || {}).name || id;
const placeName = id => (placesOf().find(x => x.id === id) || {}).name || id;
const subjectOf = who => (castOf().find(c => c.id === who) || {}).subject || "she";
const node = id => (P.nodes || []).find(n => n.id === id);
const outsOf = id => (P.edges || []).filter(e => e.from === id);
const insOf = id => (P.edges || []).filter(e => e.to === id);
function forSubject(prompt, subject) {
  if (subject !== "he") return prompt || "";
  return String(prompt || "").replace(/\bher\b/g, "his").replace(/\bherself\b/g, "himself").replace(/\bshe\b/g, "he");
}
function faceOf(id) { return (P.faces || []).find(f => f.id === id) || LIB[id] || null; }
function snakeOf(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "") || "x"; }
function allIds() {
  return new Set([...(P.nodes || []).map(n => n.id), ...castOf().map(c => c.id), ...placesOf().map(x => x.id), ...(P.faces || []).map(f => f.id), ...(P.feats || []).map(a => a.id)]);
}
function freeId(prefix, taken = allIds()) { let n = 1; const w = prefix === "note" ? 1 : 2; while (taken.has(prefix + String(n).padStart(w, "0"))) n++; return prefix + String(n).padStart(w, "0"); }
function freeEdgeId() { const ids = new Set((P.edges || []).map(e => e.id)); let n = 1; while (ids.has("a" + n)) n++; return "a" + n; }
const PREFIX = { scene: "p", talk: "p", task: "p", chapter: "p", choice: "c", secret: "s", ending: "e", note: "note", start: "start" };

// someone new, a place new: named here, made there
async function newCast(after) {
  const name = el("input", { placeholder: "a name: Hana" }), subj = el("select", {}, el("option", { value: "she" }, "she"), el("option", { value: "he" }, "he"));
  if (!(await dialog("Someone new", [...lab("Name", name), ...lab("She or he", subj)], "Add"))) return null;
  const id = freeIdFor(name.value);
  castOf().push({ id, name: name.value.trim() || id, subject: subj.value, role: "", look: "", wants: "", hides: "", tells: "" });
  changed(); if (after) after(id); return id;
}
async function newPlace(after) {
  const name = el("input", { placeholder: "a place: The kitchen" });
  if (!(await dialog("A new place", [...lab("Name", name)], "Add"))) return null;
  const id = freeIdFor(name.value);
  placesOf().push({ id, name: name.value.trim() || id, look: "" });
  changed(); if (after) after(id); return id;
}
function freeIdFor(text) { const base = snakeOf(text).slice(0, 30) || "x", ids = allIds(); let id = base, n = 2; while (ids.has(id)) id = `${base}_${n++}`; return id; }

// a face: the library's or the story's own, picked by id, its prompt shown for who wears it; "New face…" writes one
function facePicker(obj, key, who) {
  const box = el("div", { class: "facepick" });
  const draw = () => {
    const f = faceOf(obj[key]);
    const own = (P.faces || []).map(x => [x.id, `${x.id} (this story's)`]), lib = Object.values(LIB).map(x => [x.id, `${x.id}: ${x.name}`]);
    const s = el("select", { on: { change: async e => {
      if (e.target.value === "__new") { const id = await newFace(who); if (id) obj[key] = id; changed(false); draw(); return; }
      obj[key] = e.target.value; changed(false); draw(); } } },
      el("option", { value: "" }, "— no face yet —"),
      own.length ? el("optgroup", { label: "This story's faces" }, ...own.map(([v, l]) => el("option", { value: v, selected: v === obj[key] }, l))) : null,
      el("optgroup", { label: "The library" }, ...lib.map(([v, l]) => el("option", { value: v, selected: v === obj[key] }, l))),
      el("option", { value: "__new" }, "+ New face…"));
    if (obj[key] && !f) s.prepend(el("option", { value: obj[key], selected: true }, `${obj[key]} (missing)`));
    box.replaceChildren(s, f ? el("div", { class: "prompt", title: "the MiniMax post prompt" }, forSubject(f.prompt, subjectOf(who)), el("span", { class: "muted", style: "font-style:normal" }, `  · ${f.secs || 4} s${f.loop ? " · loops " + f.loop.join("–") : ""}`)) : null);
  };
  draw(); return box;
}
async function newFace(who) {
  const id = el("input", { placeholder: "a short id: hana_door_wait" }), prompt = el("textarea", { rows: 3, placeholder: "her eyes roll up as she bites her lower lip, she nervously looks down and then back at the viewer." });
  const secs = el("input", { type: "number", value: 6, min: 4, max: 10 });
  const ok = await dialog("A new face", [el("p", { class: "muted" }, "A MiniMax post prompt: what the face does in 4 seconds, two or three moves, the last one held. Present tense, lower case, no speech."),
    ...lab("Id", id), ...lab("The prompt", prompt), ...lab("Seconds once stretched (4 to 10)", secs)], "Add");
  if (!ok) return null;
  const fid = snakeOf(id.value) || "face";
  if (allIds().has(fid)) { toast(`the id ${fid} is taken`, true); return null; }
  (P.faces = P.faces || []).push({ id: fid, prompt: prompt.value.trim(), secs: +secs.value || 6, loop: null, for: who || "" });
  return fid;
}
function dialog(title, body, okLabel = "OK", wide = false) {
  return new Promise(res => {
    const m = $("#modal");
    const close = v => { m.classList.remove("on"); m.replaceChildren(); document.removeEventListener("keydown", kd); res(v); };
    const kd = e => { if (e.key === "Escape") close(false); if (e.key === "Enter" && e.target.tagName === "INPUT" && okLabel !== null) { e.preventDefault(); close(true); } };
    document.addEventListener("keydown", kd);
    m.replaceChildren(el("div", { class: "dlg", style: wide ? "width:min(860px,94vw)" : "" }, el("div", { class: "dh" }, el("span", {}, title), el("button", { class: "ghost", on: { click: () => close(false) } }, "✕")),
      el("div", { class: "db" }, ...body), okLabel === null ? null : el("div", { class: "df" }, el("button", { on: { click: () => close(false) } }, "Cancel"), el("button", { class: "go", on: { click: () => close(true) } }, okLabel))));
    m.classList.add("on");
    const first = m.querySelector("input,textarea"); if (first) setTimeout(() => first.focus(), 0);
    m.onclick = e => { if (e.target === m) close(false); };
  });
}

// ---- the chart: new shapes and arrows, what a shape shows --------------------------------------------------------
function make(type, x, y) {
  if (type === "start" && (P.nodes || []).some(n => n.type === "start")) { toast("the story has its start already"); return null; }
  const id = type === "start" ? "start" : freeId(PREFIX[type] || "x"), n = { id, type, x, y, title: type === "start" ? "Start" : "" };
  const near = (P.nodes || []).filter(m => POINTS.includes(m.type)).slice(-1)[0] || {};
  if (POINTS.includes(type)) Object.assign(n, { text: "", who: [], where: near.where || "", minutes: { scene: 3, talk: 3, task: 4, chapter: 1 }[type] });
  if (type === "talk") n.talk = { line: { who: "", text: "" }, listen: "", options: [{ id: "a", say: "", karma: 0, tell: "", face: "" }, { id: "b", say: "", karma: 0, tell: "", face: "" }], reveals: "" };
  if (type === "task") n.tasks = [{ id: "t1", text: "", who: "", done: "", fails: "" }];
  if (type === "chapter") n.chapter = { title: "", sub: "", time: "night" };
  if (type === "choice") Object.assign(n, { by: "player", question: "" });
  if (type === "secret") Object.assign(n, { find: "", shows: "", achievement: { title: "", text: "", hidden: false } });
  if (type === "ending") Object.assign(n, { kind: (P.nodes || []).some(m => m.type === "ending" && m.kind === "intended") ? "other" : "intended", text: "", how: "", achievement: { title: "", text: "", hidden: true } });
  if (type === "note") Object.assign(n, { text: "", color: "yellow" });
  return n;
}
function talkUpstream(id) {                        // the nearest talk on the way to a shape (an answer choice's default)
  const seen = new Set(), todo = [id];
  while (todo.length) { const k = todo.shift(); if (seen.has(k)) continue; seen.add(k); for (const e of insOf(k)) { const a = node(e.from); if (a && a.type === "talk") return a; todo.push(e.from); } }
  return null;
}
function isRest(c, e) { const w = e.when || {}; return c.by === "karma" ? w.min == null && w.max == null : c.by === "answer" ? !w.talk : false; }
function makeEdge(from, to) {
  const a = node(from), b = node(to); if (!a || !b) return null;
  if (a.type === "note" || b.type === "note") { toast("a note takes no arrows"); return null; }
  if (b.type === "start") { toast("nothing leads into the start"); return null; }
  if (a.type === "ending") { toast("an ending is where it stops: no arrow out"); return null; }
  const e = { id: freeEdgeId(), from, to, label: "" };
  if (a.type === "choice" && a.by && a.by !== "player") {
    const others = outsOf(from), rest = others.some(x => isRest(a, x));
    if (a.by === "karma") e.when = !others.length ? { min: 2 } : !rest ? {} : others.some(x => (x.when || {}).max != null) ? { min: 4 } : { max: -2 };
    else { const t = talkUpstream(from), used = new Set(others.map(x => (x.when || {}).answer)); const o = t && ((t.talk || {}).options || []).find(x => !used.has(x.id));
      e.when = !rest && others.length ? {} : t && o ? { talk: t.id, answer: o.id } : {}; }
  }
  return e;
}
function makeFrame(x, y, w, h) { const ids = new Set((P.frames || []).map(f => f.id)); let n = 1; while (ids.has("act" + n)) n++; return { id: "act" + n, title: `Act ${n}`, x, y, w, h, color: ["#8a63d2", "#3f8fc9", "#c98a2b", "#4fae7c", "#c0473f"][(n - 1) % 5] }; }
function edgeText(e) {
  const a = node(e.from) || {}, w = e.when || {};
  if (a.type === "choice" && a.by === "karma") return w.min != null && w.max != null ? `karma ${w.min} to ${w.max}` : w.min != null ? `karma ≥ ${w.min}` : w.max != null ? `karma ≤ ${w.max}` : "the rest";
  if (a.type === "choice" && a.by === "answer") { if (!w.talk) return "the rest"; const t = node(w.talk), o = ((t && t.talk) || {}).options || []; const x = o.find(y => y.id === w.answer); return `said ${q(x ? (x.say || x.id) : w.answer)}`; }
  return e.label || "";
}
function card(n) {
  const sh = SHAPES[n.type] || SHAPES.scene, kids = [];
  const t = n.type === "note" ? null : el("div", { class: "sh-title", "data-ph": n.type === "start" ? "Start" : n.type === "choice" ? "the question" : "a title" }, n.type === "choice" ? (n.question || n.title || "") : (n.title || ""));
  if (n.type === "start") return { kids: [t], title: "where the story begins" };
  if (n.type === "note") return { kids: [el("div", { class: "sh-text", "data-ph": "a note" }, n.text || "")], cls: "c-" + (n.color || "yellow"), title: "a note (double-click to write)" };
  const by = n.type === "choice" ? { player: "the player decides", karma: "karma decides", answer: "an answer decides" }[n.by || "player"] : n.type === "ending" ? (n.kind === "intended" ? "the intended" : "") : "";
  kids.push(el("div", { class: "sh-head" }, el("span", { class: "ic" }, ICONS[n.type]), sh.label + (by ? " · " + by : ""), POINTS.includes(n.type) ? el("span", { class: "m" }, `${n.minutes ?? ""} min`) : null), t);
  const gist = n.type === "secret" ? n.find : n.text;
  if (gist && n.type !== "choice") kids.push(el("div", { class: "sh-text" }, gist));
  const chips = [];
  if (n.where) chips.push(el("span", { class: "chip" }, "⌂ " + placeName(n.where)));
  for (const w of n.who || []) chips.push(el("span", { class: "chip who" }, nameOf(w)));
  if (n.type === "talk") { const o = (n.talk || {}).options || []; chips.push(el("span", { class: "chip" }, `${o.length} answer${o.length === 1 ? "" : "s"}`)); }
  if (n.type === "task") chips.push(el("span", { class: "chip" }, `${(n.tasks || []).length} to do`));
  if (n.type === "chapter" && n.chapter && (n.chapter.title || n.chapter.sub)) chips.push(el("span", { class: "chip" }, [n.chapter.title, n.chapter.sub].filter(Boolean).join(" · ")));
  if ((n.type === "secret" || n.type === "ending") && (n.achievement || {}).title) chips.push(el("span", { class: "chip ach" }, "🏆 " + n.achievement.title));
  if ((n.lines || []).length) chips.push(el("span", { class: "chip" }, `${n.lines.length} line${n.lines.length > 1 ? "s" : ""}`));
  if (chips.length) kids.push(el("div", { class: "sh-meta" }, ...chips));
  return { kids, cls: n.type === "ending" && n.kind === "intended" ? "intended" : "", title: sh.hint };
}
function problemsOf() {                            // the shapes the check has something to say about: their marks
  const out = {}, ids = new Set((P.nodes || []).map(n => n.id));
  const mark = (s, kind) => { const m = String(s).match(/^(\w+) (\w+)/); if (m && ids.has(m[2]) && out[m[2]] !== "error") out[m[2]] = kind; };
  for (const e of CHECK.errors || []) mark(e, "error");
  for (const w of CHECK.warnings || []) mark(w, "warn");
  return out;
}

// ---- the inspector: what's picked --------------------------------------------------------------------------------
function renderInspector() {
  const box = $("#inspector"), s = CHART.sel;
  if (TAB !== "flow" || !P) return;
  const n = s.nodes.size === 1 && !s.edges.size ? node([...s.nodes][0]) : null;
  const e = s.edges.size === 1 && !s.nodes.size ? (P.edges || []).find(x => x.id === [...s.edges][0]) : null;
  const f = s.frames.size === 1 && !s.nodes.size && !s.edges.size ? (P.frames || []).find(x => x.id === [...s.frames][0]) : null;
  if (n) return inspectNode(box, n);
  if (e) return inspectEdge(box, e);
  if (f) return inspectFrame(box, f);
  if (s.nodes.size > 1) return inspectMany(box, s);
  box.replaceChildren(el("div", { class: "ih" }, el("span", { class: "t" }, "The chart")),
    el("section", { class: "help" },
      el("p", {}, "Write the story as shapes joined by arrows: drag a shape from the left onto the chart (or double-click the chart), then drag from one of its dots to the next shape."),
      el("ul", {},
        el("li", {}, el("b", {}, "Scene"), ": a cutscene from your eye. ", el("b", {}, "Talk"), ": a close-up, she asks and your answer shows on her face. ", el("b", {}, "Task"), ": a to-do list. ", el("b", {}, "Chapter"), ": a night ends."),
        el("li", {}, el("b", {}, "Choice"), ": an arrow for each way (the player's act, karma, or an earlier answer decides); the ways join again."),
        el("li", {}, el("b", {}, "Secret"), ": an arrow in from where it's found, one out to where the story picks up. ", el("b", {}, "Ending"), ": three by default."),
        el("li", {}, el("b", {}, "Acts"), ": drag Act onto the chart, or pick some shapes and put an act round them.")),
      el("p", { class: "muted" }, "Double-click a shape to retitle it, an arrow to label it. Shift-drag picks several; Delete removes; Ctrl+C, Ctrl+V, Ctrl+D copy, paste, duplicate; Ctrl+Z undoes; F fits; the wheel zooms.")));
}
function inspectHead(title, color, ...buttons) {
  return el("div", { class: "ih" }, color ? el("span", { class: "type-dot", style: `background:${color}` }) : null, el("span", { class: "t" }, title), ...buttons);
}
function arrowsOut(n) {                            // a shape's arrows on, each a link to what it leads to
  const os = outsOf(n.id); if (!os.length) return null;
  return el("div", {}, el("h3", {}, "Leads to"), ...os.map(e => { const t = node(e.to) || {};
    return el("div", { class: "arrow-row" }, el("a", { href: "#", on: { click: ev => { ev.preventDefault(); CHART.pick({ edges: [e.id] }); } } }, "→ "), el("a", { href: "#", on: { click: ev => { ev.preventDefault(); CHART.pick({ nodes: [t.id] }); CHART.center(t.id); } } }, `${ICONS[t.type] || ""} ${t.title || t.question || t.id}`),
      edgeText(e) ? el("span", { class: "muted" }, " · " + edgeText(e)) : null, el("span", { class: "grow" }), del(() => { P.edges = P.edges.filter(x => x !== e); changed(); renderInspector(); }, "remove the arrow")); }));
}
function whoChips(n) {
  return el("div", { class: "chips" }, ...castOf().map(c => el("label", {}, el("input", { type: "checkbox", checked: (n.who || []).includes(c.id),
    on: { change: ev => { n.who = (n.who || []).filter(x => x !== c.id); if (ev.target.checked) n.who.push(c.id); changed(); } } }), c.name || c.id)),
    el("button", { class: "ghost small", on: { click: () => newCast(id => { (n.who = n.who || []).push(id); changed(); renderInspector(); }) } }, "+ someone new"));
}
function placePick(n) {
  const s = select(n, "where", placesOf().map(x => [x.id, x.name || x.id]), null, "— where —");
  s.append(el("option", { value: "__new" }, "+ a new place…"));
  s.addEventListener("change", async () => { if (s.value === "__new") { n.where = ""; await newPlace(id => { n.where = id; changed(); }); renderInspector(); } });
  return s;
}
function inspectNode(box, n) {
  const color = TYPE_COLOR[n.type], body = [], re = () => { CHART.render(); renderInspector(); };
  const buttons = [n.type !== "start" ? el("button", { class: "ghost", title: "a copy beside it (Ctrl+D)", on: { click: () => { CHART.copy(); CHART.paste(); } } }, "⧉") : null,
    el("button", { class: "ghost danger", title: "remove it (Delete)", on: { click: () => CHART.remove() } }, "🗑")];
  if (n.type === "start") {
    body.push(el("p", { class: "muted" }, "Where the story begins: one arrow from here to the first moment."), arrowsOut(n));
    return box.replaceChildren(inspectHead("● the start", color, ...buttons), el("section", {}, ...body));
  }
  if (n.type === "note") {
    body.push(...lab("The note (for whoever reads the chart, Claude too)", area(n, "text", 6, "anything: an idea, a question, a thing to remember")),
      el("label", {}, "Colour"), el("div", { class: "swatches" }, ...["yellow", "pink", "blue", "green"].map(c => el("button", { class: "swatch c-" + c + (n.color === c ? " on" : ""), on: { click: () => { n.color = c; changed(); renderInspector(); } } }))));
    return box.replaceChildren(inspectHead("✎ a note", color, ...buttons), el("section", {}, ...body));
  }
  if (POINTS.includes(n.type)) {
    body.push(el("div", { class: "types" }, ...POINTS.map(t => el("button", { class: "tbtn" + (n.type === t ? " on" : ""), style: `--tc:${TYPE_COLOR[t]}`, title: SHAPES[t].hint,
      on: { click: () => { if (n.type === t) return; const m = make(t, n.x, n.y); for (const k of ["talk", "tasks", "chapter"]) if (m[k] && !n[k]) n[k] = m[k]; n.type = t; n.minutes = n.minutes ?? m.minutes; changed(); re(); } } }, ICONS[t] + " " + SHAPES[t].label))));
    body.push(...lab("Title", input(n, "title", { placeholder: "a few words" })), ...lab("What happens", area(n, "text", 5, "the gist, in your own words")));
    body.push(el("div", { class: "two" }, el("div", {}, ...lab("Where", placePick(n))), el("div", { style: "max-width:90px" }, ...lab("Minutes", input(n, "minutes", { type: "number", min: 0, max: 15, step: 0.5 })))));
    body.push(...lab("Who's in it", whoChips(n)));
    if (n.type === "talk") body.push(...talkEditor(n));
    if (n.type === "task") body.push(el("h3", {}, "To do"), list(n.tasks = n.tasks || [], (k, i, rm) => [el("div", { class: "ihead" }, input(k, "text", { placeholder: "as the list says it: Restock the vending machine" }), del(rm)),
      el("div", { class: "two" }, el("div", {}, ...lab("Asked by", select(k, "who", castOf().map(c => [c.id, c.name || c.id]), null, "nobody"))), el("div", {}, ...lab("Can it fail?", input(k, "fails", { placeholder: "how (or leave it empty)" })))),
      ...lab("Done when", input(k, "done", { placeholder: "what ticks it" }))], () => ({ id: freeId("t", new Set((n.tasks || []).map(x => x.id))), text: "", who: "", done: "", fails: "" }), "to-do", 12, () => CHART.render()));
    if (n.type === "chapter") { n.chapter = n.chapter || { title: "", sub: "", time: "night" };
      body.push(el("h3", {}, "The chapter card"), el("div", { class: "two" }, el("div", {}, ...lab("Title", input(n.chapter, "title", { placeholder: "Night 2" }))),
        el("div", {}, ...lab("Under it", input(n.chapter, "sub", { placeholder: "23:40" }))), el("div", {}, ...lab("From here on", select(n.chapter, "time", ["day", "dusk", "night"]))))); }
    body.push(el("h3", {}, "Lines (the ones you have)"), list(n.lines = n.lines || [], (ln, k, rm) => [el("div", { class: "ihead" }, select(ln, "who", [...castOf().map(c => [c.id, c.name || c.id]), ["player", "you"]], null, "— who —"), del(rm)),
      input(ln, "text", { placeholder: "one sentence, 12 words at most" }), el("details", {}, el("summary", {}, "her face"), facePicker(ln, "face", ln.who))],
      () => ({ who: (n.who || [])[0] || "", text: "", face: "" }), "line", 99, () => CHART.render()));
    body.push(el("details", { class: "more" }, el("summary", {}, "More: what the player does, the shot, a note for Claude"),
      ...lab("What the player does", area(n, "player", 2)), ...lab("The shot (from the player's eye)", input(n, "shot", { placeholder: "across the low table, her face at arm's length" })),
      ...lab("A note for Claude", area(n, "notes", 2))));
  }
  if (n.type === "choice") {
    body.push(...lab("The question", input(n, "question", { placeholder: "Dryer 6 is running by itself. Where do you go?" }, () => CHART.render())),
      el("label", {}, "Decided by"), el("div", { class: "types" }, ...[["player", "the player (by doing)"], ["karma", "karma (what the answers added up to)"], ["answer", "an earlier answer"]].map(([b, l]) =>
        el("button", { class: "tbtn" + ((n.by || "player") === b ? " on" : ""), on: { click: () => { if ((n.by || "player") === b) return; n.by = b; decideBy(n); changed(); re(); } } }, l))));
    body.push(el("h3", {}, "Its ways (its arrows)"), ...outsOf(n.id).map(e => wayEditor(n, e)), el("p", { class: "muted small" }, "Draw an arrow from the choice for another way."));
  }
  if (n.type === "secret") {
    const src = insOf(n.id)[0], back = outsOf(n.id)[0];
    body.push(...lab("Title", input(n, "title", { placeholder: "Turned Away" })), ...lab("How it's found", area(n, "find", 2, "behind the photo in its frame on the counter")),
      ...lab("What it shows", area(n, "shows", 3, "a second photo, and a note in her hand")),
      el("p", { class: "muted small" }, src ? `Found after ${(node(src.from) || {}).title || src.from}` : "Draw an arrow into it from the point it's found after.", " · ",
        back ? `picks up at ${(node(back.to) || {}).title || back.to}` : "and one out to where the story picks up."), ...achEditor(n));
  }
  if (n.type === "ending") {
    body.push(...lab("Title", input(n, "title", { placeholder: "Ready at Three" })), el("label", {}, "Kind"), el("div", { class: "types" }, ...[["intended", "★ the intended ending"], ["other", "another ending"]].map(([k, l]) =>
      el("button", { class: "tbtn" + ((n.kind || "other") === k ? " on" : ""), on: { click: () => { n.kind = k; if (k === "intended") for (const m of P.nodes) if (m !== n && m.type === "ending" && m.kind === "intended") m.kind = "other"; changed(); re(); } } }, l))),
      ...lab("The ending cutscene", area(n, "text", 5, "what happens")), ...lab("How a player gets here", area(n, "how", 2)), ...achEditor(n));
  }
  if (!["choice", "secret", "ending"].includes(n.type)) { const a = arrowsOut(n); if (a) body.push(a); }
  box.replaceChildren(inspectHead(`${ICONS[n.type]} ${n.id} · ${SHAPES[n.type].label.toLowerCase()}`, color, ...buttons), el("section", {}, ...body));
}
function decideBy(c) {                            // a choice's arrows, made to say what decides them now
  const os = outsOf(c.id), t = c.by === "answer" ? talkUpstream(c.id) : null, answers = ((t || {}).talk || {}).options || [];
  os.forEach((e, i) => {
    delete e.when;
    if (c.by === "karma") e.when = i === os.length - 1 ? {} : i === 0 ? { min: 2 } : i === 1 ? { max: -2 } : { min: 2 + 2 * i };
    if (c.by === "answer") e.when = i === os.length - 1 || !answers[i] ? {} : { talk: t.id, answer: answers[i].id };
  });
}
function achEditor(n) {
  const a = n.achievement = n.achievement || { title: "", text: "", hidden: n.type === "ending" };
  return [el("h3", {}, "🏆 Its achievement"), el("div", { class: "two" }, el("div", {}, ...lab("Title", input(a, "title", {}, () => CHART.render()))), el("div", {}, ...lab("The hint", input(a, "text", { placeholder: "a hint that doesn't spoil" })))),
    el("label", { class: "chips" }, el("label", {}, el("input", { type: "checkbox", checked: a.hidden, on: { change: e => { a.hidden = e.target.checked; changed(false); } } }), " hidden until it's unlocked"))];
}
function talkEditor(n) {
  const t = n.talk = n.talk || { line: { who: "", text: "" }, listen: "", options: [], reveals: "" }, who = (t.line || {}).who || (n.who || [])[0];
  t.line = t.line || { who: "", text: "" };
  return [el("h3", {}, "The close-up"), el("div", { class: "hint muted small" }, "She asks; you answer; her face answers before her words do. The faces carry the truth."),
    ...lab("Who asks, and what", el("div", { class: "two ask" }, select(t.line, "who", castOf().map(c => [c.id, c.name || c.id]), () => renderInspector(), "— who —"), input(t.line, "text", { placeholder: "Walt said three sharp. When's he back?" }))),
    el("details", {}, el("summary", {}, "her face while she waits"), facePicker(t, "listen", who)),
    list(t.options = t.options || [], (o, k, rm) => [el("div", { class: "ihead" }, el("b", {}, `Answer ${o.id}`), del(rm)),
      input(o, "say", { placeholder: "what you say (2 to 8 words)" }),
      el("div", { class: "two" }, el("div", { style: "max-width:80px" }, ...lab("Karma", input(o, "karma", { type: "number", min: -3, max: 3 }))), el("div", {}, ...lab("Remembered as (a flag)", input(o, "sets", { placeholder: "told_the_truth" })))),
      ...lab("What her face does", input(o, "tell", { placeholder: "her smile stays, her eyes slide to the door" })),
      el("details", {}, el("summary", {}, "the face (a MiniMax post prompt)"), facePicker(o, "face", who))],
      () => ({ id: "abc"[t.options.length] || "d", say: "", karma: 0, tell: "", face: "", sets: "" }), "answer", 3, () => CHART.render()),
    ...lab("What reading her face here tells you", area(t, "reveals", 2))];
}
function wayEditor(c, e) {
  const t = node(e.to) || {}, w = e.when = e.when || {}, by = c.by || "player", row = [];
  const go = el("a", { href: "#", on: { click: ev => { ev.preventDefault(); CHART.pick({ nodes: [t.id] }); CHART.center(t.id); } } }, `→ ${ICONS[t.type] || ""} ${t.title || t.question || t.id}`);
  if (by === "player") { delete e.when; row.push(input(e, "label", { placeholder: "what the player does: Open dryer 6" }, () => CHART.edges()), ...lab("Remembered as (a flag)", input(e, "sets", { placeholder: "checked_the_dryer" }))); }
  if (by === "karma") {
    const mode = w.min != null ? "min" : w.max != null ? "max" : "rest", v = el("input", { type: "number", value: w.min ?? w.max ?? "", style: "width:70px", disabled: mode === "rest" });
    const s = el("select", {}, ...[["min", "karma at least"], ["max", "karma at most"], ["rest", "the rest"]].map(([k, l]) => el("option", { value: k, selected: k === mode }, l)));
    const apply = () => { delete w.min; delete w.max; if (s.value !== "rest") w[s.value] = v.value === "" ? (s.value === "min" ? 2 : -2) : +v.value; v.disabled = s.value === "rest"; if (s.value !== "rest" && v.value === "") v.value = w[s.value]; changed(); };
    s.addEventListener("change", apply); v.addEventListener("input", apply);
    row.push(el("div", { class: "two" }, s, v));
  }
  if (by === "answer") {
    const talks = (P.nodes || []).filter(m => m.type === "talk"), tk = node(w.talk);
    const ts = el("select", {}, el("option", { value: "" }, "the rest (no answer named)"), ...talks.map(m => el("option", { value: m.id, selected: m.id === w.talk }, `${m.id} ${m.title || ""}`)));
    const as = el("select", { disabled: !tk }, ...(((tk || {}).talk || {}).options || []).map(o => el("option", { value: o.id, selected: o.id === w.answer }, `${o.id}: ${o.say || "…"}`)));
    ts.addEventListener("change", () => { if (!ts.value) { delete w.talk; delete w.answer; } else { w.talk = ts.value; w.answer = ((node(ts.value).talk || {}).options || [{}])[0].id; } changed(); renderInspector(); });
    as.addEventListener("change", () => { w.answer = as.value; changed(); });
    row.push(el("div", { class: "two" }, ts, as));
  }
  return el("div", { class: "item way" }, el("div", { class: "ihead" }, go, del(() => { P.edges = P.edges.filter(x => x !== e); changed(); renderInspector(); }, "remove this way")), ...row);
}
function inspectEdge(box, e) {
  const a = node(e.from) || {}, b = node(e.to) || {}, body = [];
  body.push(el("p", {}, el("a", { href: "#", on: { click: ev => { ev.preventDefault(); CHART.pick({ nodes: [a.id] }); } } }, `${ICONS[a.type] || ""} ${a.title || a.question || a.id}`), "  →  ",
    el("a", { href: "#", on: { click: ev => { ev.preventDefault(); CHART.pick({ nodes: [b.id] }); } } }, `${ICONS[b.type] || ""} ${b.title || b.question || b.id}`)));
  if (a.type === "choice") body.push(wayEditor(a, e));
  else body.push(...lab("A label (shown on the arrow)", input(e, "label", { placeholder: b.type === "secret" ? "if found" : "" }, () => CHART.edges())));
  if (b.type === "secret") body.push(el("p", { class: "muted small" }, "An arrow into a secret: it's found after this point (the curious find it, the rest go straight on)."));
  box.replaceChildren(inspectHead("an arrow", null, el("button", { class: "ghost danger", title: "remove it (Delete)", on: { click: () => CHART.remove() } }, "🗑")), el("section", {}, ...body));
}
function inspectFrame(box, f) {
  box.replaceChildren(inspectHead("▭ an act", f.color, el("button", { class: "ghost danger", title: "remove the act (its shapes stay)", on: { click: () => CHART.remove() } }, "🗑")),
    el("section", {}, ...lab("Title", input(f, "title", { placeholder: "Night 1: The key ring" })), el("label", {}, "Colour"),
      el("div", { class: "swatches" }, ...["#8a63d2", "#3f8fc9", "#c98a2b", "#4fae7c", "#c0473f", "#7c8594"].map(c => el("button", { class: "swatch" + (f.color === c ? " on" : ""), style: `background:${c}`, on: { click: () => { f.color = c; changed(); renderInspector(); } } }))),
      el("p", { class: "muted small" }, `${CHART.inside(f).length} shapes inside. Drag its title to move it with them, its corner to resize it.`)));
}
function inspectMany(box, s) {
  box.replaceChildren(inspectHead(`${s.nodes.size} shapes picked`, null),
    el("section", {}, el("div", { class: "actions" },
      el("button", { on: { click: () => CHART.frameAround(s.nodes) } }, "▭ Put an act round them"),
      el("button", { on: { click: () => { CHART.copy(); toast("copied: Ctrl+V pastes"); } } }, "Copy"),
      el("button", { class: "danger", on: { click: () => CHART.remove() } }, "Remove them"))));
}

// ---- the bar: the time, the counts, the problems ------------------------------------------------------------------
function renderBar() {
  const bar = $("#bar"); if (!bar || !P) return;
  const [lo, hi] = CHECK.minutes || [0, 0], target = (P.brief || {}).minutes || 60, ne = (CHECK.errors || []).length, nw = (CHECK.warnings || []).length;
  const count = t => (P.nodes || []).filter(n => t.includes(n.type)).length;
  bar.replaceChildren(
    el("span", {}, el("b", {}, lo === hi ? Math.round(hi) : `${Math.round(lo)}–${Math.round(hi)}`), ` of ${target} min`),
    el("span", {}, el("b", {}, count(POINTS)), " points"), el("span", {}, el("b", {}, count(["choice"])), " choices"),
    el("span", {}, el("b", {}, count(["secret"])), " secrets"), el("span", {}, el("b", {}, count(["ending"])), " endings"),
    el("span", { class: "probs" + (ne ? " bad" : nw ? " warn" : ""), title: "what the check says: click to see it", on: { click: () => $("#problems").classList.toggle("hidden") } },
      ne || nw ? `${ne} problem${ne === 1 ? "" : "s"}, ${nw} note${nw === 1 ? "" : "s"} ▴` : "✓ no problems"),
    el("span", { class: "grow" }),
    el("span", { id: "zoomPct", class: "muted" }, Math.round(CHART.view.z * 100) + "%"),
    el("button", { class: "ghost", title: "zoom out", on: { click: () => CHART.zoomBy(0.8) } }, "−"), el("button", { class: "ghost", title: "zoom in", on: { click: () => CHART.zoomBy(1.25) } }, "+"),
    el("button", { class: "ghost", title: "fit the whole chart (F)", on: { click: () => CHART.fit() } }, "Fit"));
  const pr = $("#problems");
  pr.replaceChildren(...(CHECK.errors || []).map(e => el("div", { class: "e", on: { click: () => goProblem(e) } }, "● " + e)),
    ...(CHECK.warnings || []).map(w => el("div", { class: "w", on: { click: () => goProblem(w) } }, "○ " + w)));
  if (!ne && !nw) pr.classList.add("hidden");
  $("#hint").classList.toggle("hidden", (P.nodes || []).length > 1);
}
function goProblem(text) {
  const m = String(text).match(/^(\w+) (\w+)/);
  if (m && node(m[2])) { setTab("flow"); CHART.pick({ nodes: [m[2]] }); CHART.center(m[2]); }
  else if (m && (P.edges || []).some(e => e.id === m[2])) { setTab("flow"); CHART.pick({ edges: [m[2]] }); }
  else if (/^cast|^place/.test(text)) setTab("people");
  else if (/^feat|^the story/.test(text)) setTab("about");
}

// ---- About: the brief, the story's heart, the feats --------------------------------------------------------------
function renderAbout() {
  const b = P.brief = P.brief || {}, st = P.story = P.story || {};
  st.ladder = st.ladder || [];
  $("#about").replaceChildren(el("div", { class: "form" },
    el("h2", {}, "The game"),
    ...lab("What kind of game is it? The everyday situation, and what isn't quite right.", area(b, "kind", 3, "A distant friend invites you over for the weekend, and something isn't quite right…")),
    el("div", { class: "row" }, el("div", {}, ...lab("Minutes on a first playthrough", input(b, "minutes", { type: "number", min: 20, max: 180 }))), el("div", {}, ...lab("It starts at", select(st, "time", ["day", "dusk", "night"])))),
    el("h2", {}, "Reference stories"),
    el("div", { class: "hint" }, "Real events, stories, articles, notes from your research: anything the story borrows its truth from."),
    area(b, "references", 8, "…"),
    el("h2", {}, "The story's heart"),
    ...lab("Logline", input(st, "logline")), ...lab("The hook: why a player relates to it", area(st, "hook", 2)),
    ...lab("The truth: what's really going on", area(st, "truth", 4)),
    el("label", {}, "The ladder: how the strange is made believable, step by step (an ordinary explanation first, then a pattern, then the detail nothing explains)"),
    list(st.ladder, (s, i, rm) => [el("div", { class: "ihead" }, el("input", { value: s, on: { input: e => { st.ladder[i] = e.target.value; changed(false); } } }), del(rm))], () => "", "step"),
    el("div", { class: "row" }, el("div", {}, ...lab("Tone", input(st, "tone"))), el("div", {}, ...lab("What karma measures here", input(st, "karma", { placeholder: "how much of the truth you let yourself see" })))),
    ...lab("The setting", area(st, "setting", 2)), ...lab("The player: who you are", input(st, "player")),
    el("h2", {}, "Notes"), area(b, "notes", 4, "anything else: the mood, what to avoid, ideas for later"),
    el("h2", {}, "Feats"), el("div", { class: "hint" }, "Achievements for doing something (read every note, never lie to her). The secrets' and the endings' own are on their shapes."),
    list(P.feats = P.feats || [], (a, i, rm) => [el("div", { class: "ihead" }, input(a, "title", { placeholder: "a title: Clean Counter" }), del(rm)), ...lab("The hint", input(a, "text", { placeholder: "Finish every chore on the sheet." })),
      el("label", { class: "chips" }, el("label", {}, el("input", { type: "checkbox", checked: a.hidden, on: { change: e => { a.hidden = e.target.checked; changed(false); } } }), " hidden until it's unlocked"))],
      () => ({ id: freeId("feat"), title: "", text: "", hidden: false }), "feat")));
}

// ---- Cast & places ----------------------------------------------------------------------------------------------
function renderPeople() {
  const rows = (arr, fields, make_, label) => list(arr, (x, i, rm) => [el("div", { class: "ihead" }, el("b", {}, x.name || x.id || "?"), el("span", { class: "muted small" }, x.id), del(rm)),
    ...fields.map(([k, l, kind]) => kind === "area" ? [el("label", {}, l), area(x, k, 2)] : kind === "subject" ? [el("label", {}, l), select(x, k, ["she", "he"])] : [el("label", {}, l), input(x, k)]).flat()], make_, label);
  $("#people").replaceChildren(el("div", { class: "form" },
    el("h2", {}, "Cast"), el("div", { class: "hint" }, "Who's in it: the shapes pick from here (and “+ someone new” there adds here)."),
    rows(castOf(), [["name", "Name"], ["subject", "She or he", "subject"], ["role", "Who they are to you"], ["look", "Look"], ["wants", "Wants"], ["hides", "Hides"], ["tells", "How the face gives them away", "area"]],
      () => ({ id: freeId("cast"), name: "", subject: "she", role: "", look: "", wants: "", hides: "", tells: "" }), "cast member"),
    el("h2", {}, "Places"), el("div", { class: "hint" }, "Where it happens: Build makes a greybox room for each."),
    rows(placesOf(), [["name", "Name"], ["look", "What it looks like", "area"]], () => ({ id: freeId("place"), name: "", look: "" }), "place")));
}

// ---- the faces ---------------------------------------------------------------------------------------------------
function renderFaces() {
  const used = new Map(), push = (id, u) => (used.get(id) || used.set(id, []).get(id)).push(u);
  for (const n of P.nodes || []) {
    (n.lines || []).forEach((l, i) => l.face && push(l.face, { where: `${n.id} line ${i + 1}`, who: l.who, id: n.id }));
    const t = n.talk; if (!t) continue;
    const who = (t.line || {}).who || (n.who || [])[0];
    if (t.listen) push(t.listen, { where: `${n.id} listening`, who, id: n.id });
    for (const o of t.options || []) if (o.face) push(o.face, { where: `${n.id} answer ${o.id}`, who, id: n.id });
  }
  const copy = text => navigator.clipboard.writeText(text).then(() => toast("copied the prompt"));
  const row = (id, f, uses) => {
    const who = (uses[0] || {}).who || f.for, own = (P.faces || []).includes(f);
    return el("div", { class: "face" }, el("div", { class: "id" }, id, el("small", {}, `${own ? "this story's" : "the library's"} · ${f.secs || 4} s${f.loop ? " · loops " + f.loop.join("–") : ""}`)),
      el("div", {}, own ? area(f, "prompt", 2) : el("div", { class: "p" }, forSubject(f.prompt, subjectOf(who))),
        el("div", { class: "used" }, ...(uses.length ? ["used at ", ...uses.flatMap((u, k) => [k ? ", " : "", el("a", { href: "#", on: { click: ev => { ev.preventDefault(); setTab("flow"); CHART.pick({ nodes: [u.id] }); CHART.center(u.id); } } }, u.where)])] : ["not used yet"]),
          ...(f.tags || []).map(t => el("span", { class: "tag", style: "margin-left:6px" }, t)))),
      el("button", { class: "ghost", title: "copy the MiniMax post prompt", on: { click: () => copy(forSubject(f.prompt, subjectOf(who))) } }, "copy"));
  };
  const story = [...used.entries()].map(([id, uses]) => { const f = faceOf(id); return f ? row(id, f, uses) : el("div", { class: "face" }, el("div", { class: "id" }, id), el("div", { class: "p", style: "color:#ff9b9b" }, "missing: not in the library or this story's faces")); });
  const filter = el("input", { placeholder: "filter the library: a word, a tag (listen, tell, warm, unsettling, sad, fear)", style: "width:100%;margin:6px 0 10px" });
  const libBox = el("div");
  const drawLib = () => { const w = filter.value.toLowerCase(); libBox.replaceChildren(...Object.values(LIB).filter(f => !w || (f.id + " " + f.name + " " + f.prompt + " " + (f.tags || []).join(" ") + " " + f.use).toLowerCase().includes(w)).map(f => row(f.id, f, used.get(f.id) || []))); };
  filter.addEventListener("input", drawLib); drawLib();
  const own = (P.faces || []).filter(f => !used.has(f.id));
  $("#faces").replaceChildren(el("div", { class: "faces" },
    el("div", { class: "form", style: "max-width:none;padding:0 0 10px" }, el("h2", {}, `Faces in this story (${used.size})`),
      el("div", { class: "hint" }, "Every face the talks and lines name, as its MiniMax post prompt (copy appends it to your own prompt for the character). Generate 4 seconds; stretch it to its length and loop its held part in the expression tool.")),
    ...story, ...own.map(f => row(f.id, f, [])),
    el("div", { class: "form", style: "max-width:none;padding:18px 0 0" }, el("h2", {}, `The library (${Object.keys(LIB).length})`)), filter, libBox));
}

// ---- what the page shows, for Claude in Claude Code (room.py now) --------------------------------------------------
function tellNow() {
  if (!P) return;
  const s = CHART.sel, v = { session: SID, title: P.title, tab: TAB, selected: [...s.nodes], arrows: [...s.edges], acts: [...s.frames] };
  clearTimeout(NOW_T); NOW_T = setTimeout(() => api("now", v).catch(() => { }), 400);
}

// ---- sessions, build ---------------------------------------------------------------------------------------------
async function sessionsDialog(first = false) {
  const r = await api("sessions");
  const title = el("input", { placeholder: "a working title" }), kind = el("textarea", { rows: 2, placeholder: "what kind of game: a distant friend invites you over and something isn't quite right" });
  let chose = null;
  const rows = r.sessions.map(s => el("div", { class: "sess", on: { click: () => { chose = s.id; $("#modal").querySelector(".go").click(); } } },
    el("div", { class: "t" }, el("div", {}, s.title || s.id), el("small", {}, `${s.points} points · ${s.minutes} min · ${s.updated.replace("T", " ")}${s.built ? " · built as " + s.built : ""}`)), el("span", { class: "muted" }, "Open")));
  const ok = await dialog(first ? "The writers' room" : "Sessions", [
    el("div", { class: "hint muted", style: "margin-bottom:8px" }, "A session is one game's story, written as a flowchart: its points, its choices, its secrets, its endings. Start a new one, or open one."),
    el("label", {}, "New"), title, kind,
    rows.length ? el("label", { style: "margin-top:16px" }, "Open") : null, ...rows], "New session");
  if (chose) return open(chose);
  if (!ok) return;
  const n = await api("sessions", { title: title.value.trim() || "Untitled", kind: kind.value.trim() });
  await open(n.prototype.id);
}
async function buildDialog() {
  if (!P) return;
  await flush();
  const camel = (P.title || "Game").replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join("") || "Game";
  const game = el("input", { value: (P.built || {}).game || (/^[A-Z]/.test(camel) ? camel : "G" + camel) }), force = el("input", { type: "checkbox", checked: !!(P.built || {}).game });
  const errs = (CHECK.errors || []).length;
  const ok = await dialog("Build it in the director", [
    el("p", { class: "muted" }, "A rough, working outline of the game from your chart: Content/Games/<Game>/story.json (a greybox room per place, each shape as its scene or task, the talks as close-ups with your answers, the choices, the secrets, the endings, the achievements, laid out on the director's board as you drew it), with BUILD.md, what Claude does next to make it the game, and faces.md, the faces to make."),
    ...lab("The game's folder name", game),
    el("label", { class: "chips", style: "margin-top:10px" }, el("label", {}, force, " build over it if it exists (its story goes into the desk's history first)")),
    errs ? el("p", { style: "color:#ff9b9b" }, `${errs} problem${errs > 1 ? "s" : ""} on the chart: fix them first (the bar at the bottom lists them).`) : null], "Build");
  if (!ok) return;
  try {
    const r = await api("build/" + encodeURIComponent(SID), { game: game.value.trim(), force: force.checked });
    P.built = { game: r.game }; BASE = JSON.stringify(P);
    const bad = r.check && !r.check.ok;
    await dialog(bad ? "Built, but the story check fails" : "Built", [el("p", {}, r.message),
      bad ? el("p", { style: "color:#ff9b9b" }, ...(r.check.errors || []).map(e => el("div", {}, e))) : null,
      el("p", {}, el("a", { href: `http://127.0.0.1:8780/?game=${encodeURIComponent(r.game)}`, target: "_blank" }, "Open it in the director"), " (the desk's server running)"),
      el("p", { class: "muted" }, `Then, in Claude Code: “build ${r.game} from its BUILD.md”.`)], null);
  } catch (e) { toast(e.message, true); }
}
function contextMenu(id, cx, cy, at) {             // right-click: on a shape, what to do with it; on the chart, what to add
  if (!id) {
    const m = CHART.menu(cx, cy, t => CHART.add(t, at[0], at[1]));
    m.append(el("div", { class: "cmenu-sep" }), el("button", { class: "cmenu-i", on: { click: () => { m.remove(); CHART.paste(0, 0, at); } } }, "Paste here"),
      el("button", { class: "cmenu-i", on: { click: () => { m.remove(); CHART.fit(); } } }, "Fit the chart"));
    return;
  }
  document.querySelectorAll(".cmenu").forEach(x => x.remove());
  const m = el("div", { class: "cmenu", style: `left:${cx}px;top:${cy}px` }, el("div", { class: "cmenu-h" }, CHART.sel.nodes.size > 1 ? `${CHART.sel.nodes.size} shapes` : (node(id) || {}).title || id),
    CHART.sel.nodes.size === 1 ? el("button", { class: "cmenu-i", on: { click: () => { m.remove(); CHART.editTitle(id); } } }, "Retitle") : null,
    el("button", { class: "cmenu-i", on: { click: () => { m.remove(); CHART.copy(); CHART.paste(); } } }, "Duplicate"),
    el("button", { class: "cmenu-i", on: { click: () => { m.remove(); CHART.copy(); toast("copied"); } } }, "Copy"),
    el("button", { class: "cmenu-i", on: { click: () => { m.remove(); CHART.frameAround(CHART.sel.nodes); } } }, "Put an act round " + (CHART.sel.nodes.size > 1 ? "them" : "it")),
    el("button", { class: "cmenu-i danger", on: { click: () => { m.remove(); CHART.remove(); } } }, "Remove"));
  document.body.append(m);
  const off = ev => { if (!m.contains(ev.target)) { m.remove(); window.removeEventListener("mousedown", off, true); } };
  setTimeout(() => window.addEventListener("mousedown", off, true), 0);
}

// ---- the palette ---------------------------------------------------------------------------------------------------
function renderPalette() {
  const items = [...Object.entries(SHAPES).map(([t, s]) => [t, s.label, s.hint]), ["frame", "Act", "a frame round a group of shapes: a night, a chapter of the story"]];
  $("#palette").replaceChildren(el("div", { class: "pal-h" }, "Shapes"), ...items.map(([t, l, hint]) => el("div", { class: "pal-i " + t, draggable: "true", title: hint + " (drag it onto the chart, or click)", style: `--tc:${TYPE_COLOR[t] || "#8a63d2"}`,
    on: { dragstart: e => { e.dataTransfer.setData("text/x-shape", t); e.dataTransfer.effectAllowed = "copy"; },
          click: () => { const [x, y] = CHART.middle(); if (t === "frame") CHART.frameDrop(x, y); else CHART.add(t, x, y); } } },
    el("span", { class: "ic" }, ICONS[t]), l)),
    el("div", { class: "pal-foot muted" }, "drag onto the chart"));
}

// ---- start ---------------------------------------------------------------------------------------------------------
async function init() {
  CHART = new Chart($("#chart"), {
    doc: () => P, onPick: () => { renderInspector(); tellNow(); }, changed: () => { changed(false); renderInspector(); renderBar(); },
    card, edgeText, edgeEditable: e => { const a = node(e.from) || {}; return !(a.type === "choice" && a.by && a.by !== "player"); },
    make, makeEdge, makeFrame, problems: problemsOf, ids: type => freeId(PREFIX[type] || "x"), context: contextMenu,
    zoomed: z => { const p = $("#zoomPct"); if (p) p.textContent = Math.round(z * 100) + "%"; } });
  renderPalette();
  for (const b of document.querySelectorAll("#tabs button")) b.addEventListener("click", () => setTab(b.dataset.tab));
  $("#title").addEventListener("input", e => { if (P) { P.title = e.target.value; changed(false); } });
  $("#undo").addEventListener("click", () => undo(true)); $("#redo").addEventListener("click", () => undo(false));
  $("#sessionsBtn").addEventListener("click", () => sessionsDialog());
  $("#buildBtn").addEventListener("click", buildDialog);
  document.addEventListener("keydown", e => {
    const typing = e.target.closest("input,textarea,select") || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); undo(!e.shiftKey); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); undo(false); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); flush(); }
  });
  window.addEventListener("beforeunload", () => { if (SAVE_T) flush(); });
  window.addEventListener("resize", () => { if (TAB === "flow" && P) CHART.render(); });
  const lib = await api("library"); LIB = Object.fromEntries(lib.faces.map(f => [f.id, f]));
  let sid = params.get("s");
  if (!sid) try { sid = localStorage.getItem("writers.last"); } catch (e) { }
  if (sid) { try { await open(sid); } catch (e) { sid = null; } }
  if (!sid) sessionsDialog(true);
}
init();
window.__wr = { get P() { return P; }, get check() { return CHECK; }, get chart() { return CHART; }, get tab() { return TAB; }, open, setTab, undo, flush };

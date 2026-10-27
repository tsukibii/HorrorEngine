// The writers' room's page (docs/WRITERS_ROOM.md): a session's brief, its river, its bible and its faces, edited by
// hand or by the assistant beside them; every change saved (the server keeps the versions) and undoable here.
import { River, COLOR, ICON } from "./river.js";

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
let SID = null, P = null, CHECK = { errors: [], warnings: [], minutes: 0 }, LIB = {}, SETTINGS = null, STATUS = null;
let TAB = "brief", SEL = null, JOB = null, UNDO = [], REDO = [], BASE = null, SAVE_T = 0, NOW_T = 0, RIVER = null;
const params = new URLSearchParams(location.search);
const FAKE = params.has("fake");

// ---- the session: load, save, undo -------------------------------------------------------------------------------
async function open(sid) {
  const r = await api("session/" + encodeURIComponent(sid));
  SID = sid; P = r.prototype; CHECK = r; BASE = JSON.stringify(P); UNDO = []; REDO = []; SEL = null;
  try { localStorage.setItem("writers.last", sid); } catch (e) { }
  const u = new URL(location.href); u.searchParams.set("s", sid); history.replaceState(null, "", u);
  $("#title").value = P.title || "";
  if (r.busy) follow(r.busy);
  setTab(P.points && P.points.length ? (params.get("tab") || "river") : "brief", true);
  renderChat();
}
// a change from the page: the snapshot before it goes on the undo stack once, the save waits for a pause in the typing
function changed(redraw = true) {
  if (!P) return;
  if (BASE !== null && !SAVE_T) { UNDO.push(BASE); if (UNDO.length > 100) UNDO.shift(); REDO = []; }
  clearTimeout(SAVE_T); SAVE_T = setTimeout(flush, 700);
  $("#saved").textContent = "editing…";
  if (redraw) renderRiver();
}
async function flush() {
  clearTimeout(SAVE_T); SAVE_T = 0;
  if (!P) return;
  const now = JSON.stringify(P);
  if (now === BASE) { $("#saved").textContent = "saved"; return; }
  try {
    const r = await api("session/" + encodeURIComponent(SID), { prototype: P });
    BASE = now; CHECK = r; $("#saved").textContent = "saved";
    renderBar();
  } catch (e) { $("#saved").textContent = "not saved"; toast(e.message, true); }
}
async function reload(pushUndo) {
  const r = await api("session/" + encodeURIComponent(SID));
  if (pushUndo && pushUndo !== JSON.stringify(r.prototype)) { UNDO.push(pushUndo); REDO = []; }
  P = r.prototype; CHECK = r; BASE = JSON.stringify(P);
  $("#title").value = P.title || "";
  renderAll();
}
async function undo(back = true) {
  if (JOB) return toast("wait for the assistant to finish");
  await flush();
  const from = back ? UNDO : REDO, to = back ? REDO : UNDO;
  if (!from.length) return toast(back ? "nothing to undo" : "nothing to redo");
  to.push(JSON.stringify(P));
  const chat = P.chat;                                 // the conversation stays: Undo takes back changes, not what was said
  P = JSON.parse(from.pop()); P.chat = chat; BASE = null;
  const s = JSON.stringify(P);
  try { const r = await api("session/" + encodeURIComponent(SID), { prototype: P }); CHECK = r; } catch (e) { toast(e.message, true); }
  BASE = s; renderAll(); toast(back ? "undone" : "redone");
}

// ---- the tabs ----------------------------------------------------------------------------------------------------
function setTab(t, quiet) {
  TAB = t;
  for (const b of document.querySelectorAll("#tabs button")) b.classList.toggle("on", b.dataset.tab === t);
  for (const id of ["brief", "river", "bible", "faces"]) $("#" + id).classList.toggle("hidden", id !== t);
  if (t !== "river") $("#inspector").classList.add("hidden");
  renderAll(quiet);
}
function renderAll() {
  if (!P) return;
  if (TAB === "brief") renderBrief();
  if (TAB === "river") { renderRiver(true); renderInspector(); }
  if (TAB === "bible") renderBible();
  if (TAB === "faces") renderFaces();
  renderBar(); renderChat(); tellNow();
}

// ---- small form pieces -------------------------------------------------------------------------------------------
function input(obj, key, attrs = {}, after) {
  return el("input", Object.assign({ value: obj[key] ?? "", on: { input: e => { obj[key] = attrs.type === "number" ? (e.target.value === "" ? 0 : +e.target.value) : e.target.value; changed(attrs.redraw !== false); if (after) after(); } } }, attrs));
}
function area(obj, key, rows = 3, ph = "", after) {
  return el("textarea", { rows, placeholder: ph, value: obj[key] ?? "", on: { input: e => { obj[key] = e.target.value; changed(); if (after) after(); } } });
}
function select(obj, key, opts, after, blank) {
  const s = el("select", { on: { change: e => { obj[key] = e.target.value; changed(); if (after) after(); } } },
    blank !== undefined ? el("option", { value: "" }, blank) : null,
    ...opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; const x = el("option", { value: v }, l); if (String(obj[key] ?? "") === String(v)) x.selected = true; return x; }));
  return s;
}
const lab = (text, ...kids) => [el("label", {}, text), ...kids];
const castOf = () => ((P.bible || {}).cast || []);
const placesOf = () => ((P.bible || {}).places || []);
const subjectOf = who => (castOf().find(c => c.id === who) || {}).subject || "she";
function forSubject(prompt, subject) {
  if (subject !== "he") return prompt || "";
  return String(prompt || "").replace(/\bher\b/g, "his").replace(/\bherself\b/g, "himself").replace(/\bshe\b/g, "he");
}
function faceOf(id) { return (P.faces || []).find(f => f.id === id) || LIB[id] || null; }
function allPoints() {
  const out = [];
  for (const p of P.points || []) { out.push({ p, fork: null, way: null }); for (const w of ((p.fork || {}).ways || [])) for (const x of w.points || []) out.push({ p: x, fork: p, way: w }); }
  return out;
}
const pointById = id => allPoints().find(x => x.p.id === id) || { p: null };
function nextId(prefix, taken) { let n = 1; while (taken.has(prefix + String(n).padStart(2, "0"))) n++; return prefix + String(n).padStart(2, "0"); }
const allIds = () => new Set([...allPoints().map(x => x.p.id), ...(P.secrets || []).map(s => s.id), ...(P.endings || []).map(e => e.id), ...castOf().map(c => c.id),
  ...placesOf().map(x => x.id), ...(P.acts || []).map(a => a.id), ...(P.faces || []).map(f => f.id), ...(P.achievements || []).map(a => a.id)]);

// a face: the library's or the story's own, picked by id, its prompt shown for who wears it; "New face…" writes one
function facePicker(obj, key, who) {
  const box = el("div");
  const draw = () => {
    const f = faceOf(obj[key]);
    const own = (P.faces || []).map(x => [x.id, `${x.id} (this story's)`]), lib = Object.values(LIB).map(x => [x.id, `${x.id}: ${x.name}`]);
    const s = el("select", { on: { change: async e => {
      if (e.target.value === "__new") { const id = await newFace(who); if (id) obj[key] = id; changed(false); draw(); return; }
      obj[key] = e.target.value; changed(false); draw(); } } },
      el("option", { value: "" }, "— a face —"),
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
  const fid = (id.value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^[^a-z]+/, "") || "face") ;
  if (allIds().has(fid)) { toast(`the id ${fid} is taken`, true); return null; }
  (P.faces = P.faces || []).push({ id: fid, prompt: prompt.value.trim(), secs: +secs.value || 6, loop: null, for: who || "" });
  return fid;
}
function dialog(title, body, okLabel = "OK", wide = false) {
  return new Promise(res => {
    const m = $("#modal");
    const close = v => { m.classList.remove("on"); m.replaceChildren(); document.removeEventListener("keydown", kd); res(v); };
    const kd = e => { if (e.key === "Escape") close(false); };
    document.addEventListener("keydown", kd);
    m.replaceChildren(el("div", { class: "dlg", style: wide ? "width:min(860px,94vw)" : "" }, el("div", { class: "dh" }, el("span", {}, title), el("button", { class: "ghost", on: { click: () => close(false) } }, "✕")),
      el("div", { class: "db" }, ...body), okLabel === null ? null : el("div", { class: "df" }, el("button", { on: { click: () => close(false) } }, "Cancel"), el("button", { class: "go", on: { click: () => close(true) } }, okLabel))));
    m.classList.add("on");
    m.onclick = e => { if (e.target === m) close(false); };
  });
}

// ---- the brief ---------------------------------------------------------------------------------------------------
function renderBrief() {
  const b = P.brief = P.brief || {}; b.endings = b.endings || ["", "", ""];
  while (b.endings.length < 3) b.endings.push("");
  const drafted = P.endings || [], names = ["The intended ending", "Another ending", "A third ending"];
  const be = SETTINGS ? (SETTINGS.backend === "local" ? `a local model (${SETTINGS.ollama.model})` : SETTINGS.backend === "fake" ? "the stand-in" : `Claude (${SETTINGS.model.replace("claude-", "")})`) : "the assistant";
  $("#brief").replaceChildren(el("div", { class: "form" },
    el("h2", {}, "The game"),
    ...lab("What kind of game is it? The everyday situation, and what isn't quite right.", area(b, "kind", 3, "A distant friend invites you over for the weekend, and something isn't quite right…")),
    el("div", { class: "row" }, el("div", {}, ...lab("Minutes on a first playthrough", input(b, "minutes", { type: "number", min: 20, max: 180, redraw: false })))),
    el("h2", {}, "Reference stories"),
    el("div", { class: "hint" }, "Real events, stories, articles, notes from your research: anything the story can borrow its truth from. Paste as much as you like."),
    area(b, "references", 10, "…"),
    el("h2", {}, "Notes"),
    area(b, "notes", 3, "Anything else: the mood, a scene you already see, what to avoid."),
    el("h2", {}, "The endings"),
    el("div", { class: "hint" }, "Three by default: the one you intend, and two others. Leave any empty and the assistant suggests it from the references."),
    el("div", { class: "ends" }, ...[0, 1, 2].map(i => {
      const d = drafted.filter(e => i === 0 ? e.kind === "intended" : e.kind !== "intended")[i === 0 ? 0 : i - 1];
      return el("div", { class: "end" + (i === 0 ? " intended" : "") }, el("b", {}, names[i]),
        el("textarea", { rows: 4, value: b.endings[i] || "", placeholder: i === 0 ? "What should happen, if the player understands." : "(empty: suggested)", on: { input: e => { b.endings[i] = e.target.value; changed(false); } } }),
        d ? el("div", { class: "made" }, `${d.by === "user" ? "Drafted" : "Suggested"}: `, el("b", { style: "display:inline;color:inherit" }, d.title), `: ${d.what || ""}`) : null);
    })),
    el("div", { class: "actions" },
      el("button", { class: "go", on: { click: () => draft(["bible", "river", "details"]) } }, P.points && P.points.length ? "Draft the story again" : "Draft the story"),
      el("button", { on: { click: () => draft(["endings"]) } }, "Suggest endings"),
      el("span", { class: "muted" }, "or one stage:"),
      el("button", { class: "ghost", on: { click: () => draft(["bible"]) } }, "Bible"),
      el("button", { class: "ghost", on: { click: () => draft(["river"]) } }, "River"),
      el("button", { class: "ghost", on: { click: () => draft(["details"]) } }, "Details"),
      el("span", { class: "muted" }, `with ${be}`)),
    P.points && P.points.length ? el("div", { class: "hint", style: "margin-top:10px" }, "Drafting again replaces the river and its details (Undo brings them back).") : null));
}

// ---- the river ---------------------------------------------------------------------------------------------------
function problemIds() {
  const ids = new Set();
  for (const e of CHECK.errors || []) { const m = e.match(/\bpoint (\w+)|^(\w+) (line|answer|listening)/); if (m) ids.add(m[1] || m[2]); }
  return ids;
}
function renderRiver(refit) {
  if (!P || TAB !== "river") return;
  if (!RIVER) RIVER = new River($("#map"), { onSelect: s => { select_(s); }, onHover: tip });
  $("#riverEmpty").classList.toggle("hidden", !!(P.points || []).length);
  RIVER.draw(P, { selected: SEL, problems: problemIds(), refit: refit && !RIVER.vb });
}
function select_(s) { SEL = s; renderRiver(); renderInspector(); tellNow(); }
function tip(info, e) {
  const t = $("#tip");
  if (!info) { t.style.display = "none"; return; }
  t.replaceChildren(el("b", {}, info.title), el("div", { class: "k" }, info.kind), el("div", { style: "white-space:pre-wrap" }, info.text || ""));
  const r = $("#river").getBoundingClientRect();
  t.style.display = "block";
  const x = e.clientX - r.left + 16, y = e.clientY - r.top + 14;
  t.style.left = Math.min(x, r.width - 360) + "px"; t.style.top = Math.min(y, r.height - 150) + "px";
}
function renderBar() {
  const bar = $("#riverBar"); if (!bar || !P) return;
  const m = CHECK.minutes ?? 0, target = (P.brief || {}).minutes || 60, ne = (CHECK.errors || []).length, nw = (CHECK.warnings || []).length;
  bar.replaceChildren(
    el("span", {}, el("b", {}, Math.round(m)), ` of ${target} min`),
    el("span", {}, el("b", {}, (P.points || []).length), " points"),
    el("span", {}, el("b", {}, (P.secrets || []).length), " secrets"),
    el("span", {}, el("b", {}, (P.endings || []).length), " endings"),
    el("span", { class: "probs" + (ne ? " bad" : ""), on: { click: () => $("#problems").classList.toggle("hidden") } }, ne || nw ? `${ne} problem${ne === 1 ? "" : "s"}, ${nw} note${nw === 1 ? "" : "s"} ▴` : "no problems"),
    el("span", { class: "legend" }, ...Object.entries(COLOR).map(([k, c]) => el("span", {}, el("i", { style: `background:${c}` }), k)),
      el("span", {}, el("i", { style: "background:#e5b450" }), "secret")),
    el("button", { class: "ghost", title: "fit the whole river (double-click the map)", on: { click: () => RIVER && RIVER.fit() } }, "Fit"));
  const pr = $("#problems");
  pr.replaceChildren(...(CHECK.errors || []).map(e => el("div", { class: "e", on: { click: () => goProblem(e) } }, "● " + e)),
    ...(CHECK.warnings || []).map(w => el("div", { class: "w", on: { click: () => goProblem(w) } }, "○ " + w)));
  if (!ne && !nw) pr.classList.add("hidden");
}
function goProblem(text) {
  const m = text.match(/\bpoint (\w+)|^(\w+) (line|answer|listening)|secret (\w+)|ending (\w+)/);
  if (!m) return;
  if (m[1] || m[2]) select_({ kind: "point", id: m[1] || m[2] });
  else if (m[4]) select_({ kind: "secret", id: m[4] });
  else if (m[5]) select_({ kind: "ending", id: m[5] });
}

// ---- the inspector: a point, a secret, an ending -------------------------------------------------------------------
function renderInspector() {
  const box = $("#inspector");
  if (TAB !== "river" || !SEL) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  if (SEL.kind === "point") return inspectPoint(box);
  if (SEL.kind === "secret") return inspectSecret(box);
  if (SEL.kind === "ending") return inspectEnding(box);
}
function head(title, color, ...buttons) {
  return el("div", { class: "ih" }, color ? el("span", { class: "type-dot", style: `background:${color}` }) : null, el("span", { class: "t" }, title), ...buttons,
    el("button", { class: "ghost", title: "close (Esc)", on: { click: () => select_(null) } }, "✕"));
}
function list(arr, draw, add, addLabel, max = 99) {
  const box = el("div");
  const redraw = () => {
    box.replaceChildren(...arr.map((x, i) => el("div", { class: "item" }, draw(x, i, () => { arr.splice(i, 1); changed(); redraw(); }))),
      arr.length < max ? el("button", { class: "ghost", on: { click: () => { arr.push(add()); changed(); redraw(); } } }, "+ " + addLabel) : null);
  };
  redraw(); return box;
}
const del = fn => el("button", { class: "ghost", title: "remove", on: { click: fn } }, "✕");
function inspectPoint(box) {
  const { p, fork, way } = pointById(SEL.id);
  if (!p) { SEL = null; box.classList.add("hidden"); return; }
  const main = P.points.includes(p), arr = way ? way.points : P.points, i = arr.indexOf(p);
  const castOpts = castOf().map(c => [c.id, c.name || c.id]), placeOpts = placesOf().map(x => [x.id, x.name || x.id]);
  const re = () => { renderInspector(); renderRiver(); };
  const move = d => { const j = i + d; if (j < 0 || j >= arr.length) return; arr.splice(i, 1); arr.splice(j, 0, p); changed(); re(); };
  const addAfter = () => {
    const id = way ? p.id + "x" : nextId("p", allIds());
    const n = { id: allIds().has(id) ? nextId(p.id + "_", allIds()) : id, act: p.act, type: "scene", title: "New point", where: p.where || "", who: [], minutes: 3, what: "", player: "", fork: null };
    if (way) delete n.act;
    arr.splice(i + 1, 0, n); changed(); select_({ kind: "point", id: n.id });
  };
  const remove = async () => { if (!(await dialog("Remove this point?", [el("p", {}, `${p.id} ${q(p.title || "")}${main && p.fork ? " and its fork's ways" : ""} goes (Undo brings it back).`)], "Remove"))) return;
    arr.splice(i, 1); for (const s of P.secrets || []) if (s.after === p.id) s.after = (arr[i - 1] || arr[0] || {}).id; changed(); select_(null); };
  const body = [
    ...lab("Title", input(p, "title")),
    el("div", { class: "two" }, el("div", {}, ...lab("Type", select(p, "type", ["scene", "talk", "task", "chapter", "choice"], re))),
      main ? el("div", {}, ...lab("Act", select(p, "act", (P.acts || []).map(a => [a.id, a.title || a.id])))) : null,
      el("div", {}, ...lab("Minutes", input(p, "minutes", { type: "number", min: 0, max: 15, step: 0.5 })))),
    el("div", { class: "two" }, el("div", {}, ...lab("Where", select(p, "where", placeOpts, null, "—")))),
    ...lab("Who's in it", el("div", { class: "chips" }, ...castOf().map(c => el("label", {}, el("input", { type: "checkbox", checked: (p.who || []).includes(c.id),
      on: { change: e => { p.who = (p.who || []).filter(x => x !== c.id); if (e.target.checked) p.who.push(c.id); changed(); } } }), c.name || c.id)))),
    ...lab("What happens", area(p, "what", 4)),
    ...lab("What the player does", area(p, "player", 2)),
    ...lab("The shot (from the player's eye)", input(p, "shot", { placeholder: "across the low table, her face at arm's length", redraw: false })),
    el("h3", {}, "Lines"),
    list(p.lines = p.lines || [], (ln, k, rm) => [el("div", { class: "ihead" }, select(ln, "who", [...castOpts, ["player", "you"]]), del(rm)),
      input(ln, "text", { placeholder: "one sentence, 12 words at most", redraw: false }), facePicker(ln, "face", ln.who)], () => ({ who: (p.who || [])[0] || "", text: "", face: "" }), "line"),
  ];
  if (p.type === "talk" || p.talk) {
    if (!p.talk) body.push(el("h3", {}, "The talk"), el("button", { on: { click: () => { p.talk = { line: { who: (p.who || [])[0] || "", text: "" }, listen: "listening_guarded", options: [
      { id: "a", say: "", face: "", tell: "", karma: 0, sets: "" }, { id: "b", say: "", face: "", tell: "", karma: 0, sets: "" }], reveals: "" }; changed(); re(); } } }, "Make it an L.A. Noire close-up"));
    else {
      const t = p.talk, who = t.line.who || (p.who || [])[0];
      body.push(el("h3", {}, "The talk: an L.A. Noire close-up"), el("div", { class: "hint muted", style: "font-size:12px" }, "She says it; you answer; her face answers first. The faces carry the truth."),
        ...lab("She says", el("div", { class: "two" }, select(t.line, "who", castOpts), input(t.line, "text", { redraw: false }))),
        ...lab("Her face while she waits for your answer", facePicker(t, "listen", who)),
        list(t.options = t.options || [], (o, k, rm) => [el("div", { class: "ihead" }, el("b", {}, `Answer ${o.id}`), del(rm)),
          input(o, "say", { placeholder: "what you say (2 to 8 words)", redraw: false }),
          el("label", {}, "Her face's answer"), facePicker(o, "face", who),
          el("label", {}, "What her face gives away"), input(o, "tell", { redraw: false }),
          el("div", { class: "two" }, el("div", {}, ...lab("Karma", input(o, "karma", { type: "number", min: -3, max: 3 }))), el("div", {}, ...lab("Remembered as (a flag)", input(o, "sets", { redraw: false }))))],
          () => ({ id: "abc"[t.options.length] || "d", say: "", face: "", tell: "", karma: 0, sets: "" }), "answer", 3),
        ...lab("What reading her faces here tells an attentive player", area(t, "reveals", 2)),
        el("button", { class: "ghost", on: { click: () => { delete p.talk; changed(); re(); } } }, "Remove the talk"));
    }
  }
  if (p.type === "task" || (p.tasks || []).length) {
    body.push(el("h3", {}, "To do"), list(p.tasks = p.tasks || [], (k, n, rm) => [el("div", { class: "ihead" }, input(k, "text", { placeholder: "as the list says it" }), del(rm)),
      el("div", { class: "two" }, el("div", {}, ...lab("Asked by", select(k, "who", castOpts, null, "nobody")))), ...lab("Ticked when", input(k, "done", { redraw: false })), ...lab("Failed when (if ever)", input(k, "fails", { redraw: false }))],
      () => ({ id: nextId("task", new Set((p.tasks || []).map(x => x.id))), text: "", who: "", done: "", fails: "" }), "task"));
  }
  if (p.type === "chapter") {
    p.chapter = p.chapter || { title: "", sub: "", time: "night" };
    body.push(el("h3", {}, "The chapter card"), el("div", { class: "two" }, el("div", {}, ...lab("Title", input(p.chapter, "title", { placeholder: "Saturday", redraw: false }))),
      el("div", {}, ...lab("Under it", input(p.chapter, "sub", { placeholder: "22:10", redraw: false }))), el("div", {}, ...lab("Then", select(p.chapter, "time", ["day", "dusk", "night"])))));
  }
  if (p.type === "choice" && main) {
    if (!p.fork) body.push(el("h3", {}, "The fork"), el("button", { on: { click: () => {
      const ids = allIds(); p.fork = { question: "", ways: ["a", "b"].map(w => ({ id: "way_" + w, label: w === "a" ? "One way" : "The other", sets: "", points: [{ id: (ids.has(p.id + w) ? p.id + w + "1" : p.id + w), type: "scene", title: "New point", where: p.where || "", who: [], minutes: 3, what: "", player: "" }] })) };
      changed(); re(); } } }, "Make it a fork (two ways that join the river again)"));
    else body.push(el("h3", {}, "The fork"), ...lab("The question", input(p.fork, "question", { redraw: false })),
      ...p.fork.ways.map(w => el("div", { class: "item" }, el("div", { class: "ihead" }, input(w, "label"), del(() => { p.fork.ways.splice(p.fork.ways.indexOf(w), 1); if (!p.fork.ways.length) p.fork = null; changed(); re(); })),
        ...lab("Remembered as (a flag)", input(w, "sets", { redraw: false })),
        el("div", { class: "chips", style: "margin-top:6px" }, ...(w.points || []).map(x => el("label", { style: "cursor:pointer", on: { click: () => select_({ kind: "point", id: x.id }) } }, (ICON[x.type] || "") + " " + (x.title || x.id))),
          el("button", { class: "ghost", on: { click: () => { const id = nextId(p.id + "_", allIds()); w.points.push({ id, type: "scene", title: "New point", where: p.where || "", who: [], minutes: 3, what: "", player: "" }); changed(); select_({ kind: "point", id }); } } }, "+ point")))),
      el("button", { class: "ghost", on: { click: () => { p.fork.ways.push({ id: nextId("way_", allIds()), label: "Another way", sets: "", points: [{ id: nextId(p.id + "_", allIds()), type: "scene", title: "New point", where: "", who: [], minutes: 3, what: "", player: "" }] }); changed(); re(); } } }, "+ way"));
  }
  if (main) {
    const after = (P.secrets || []).filter(s => s.after === p.id);
    body.push(el("h3", {}, "Secrets after this point"), el("div", { class: "chips" }, ...after.map(s => el("label", { style: "cursor:pointer", on: { click: () => select_({ kind: "secret", id: s.id }) } }, "★ " + (s.title || s.id))),
      el("button", { class: "ghost", on: { click: () => { const id = nextId("s", allIds()); (P.secrets = P.secrets || []).push({ id, after: p.id, title: "A secret", find: "", shows: "", achievement: "" }); changed(); select_({ kind: "secret", id }); } } }, "+ secret")));
  }
  box.replaceChildren(head(`${p.id} · ${p.type}${way ? " · way " + (way.label || way.id) : ""}`, COLOR[p.type],
    el("button", { class: "ghost", title: "earlier", on: { click: () => move(-1) } }, "↑"), el("button", { class: "ghost", title: "later", on: { click: () => move(1) } }, "↓"),
    el("button", { class: "ghost", title: "a new point after this one", on: { click: addAfter } }, "+"), el("button", { class: "ghost danger", title: "remove", on: { click: remove } }, "🗑")),
    el("section", {}, ...body));
}
function inspectSecret(box) {
  const s = (P.secrets || []).find(x => x.id === SEL.id); if (!s) { SEL = null; box.classList.add("hidden"); return; }
  const mains = (P.points || []).slice(0, -1).map(p => [p.id, `${p.id} ${p.title || ""}`]);
  box.replaceChildren(head(`★ secret ${s.id}`, "#e5b450", el("button", { class: "ghost danger", on: { click: () => { P.secrets.splice(P.secrets.indexOf(s), 1); changed(); select_(null); } } }, "🗑")),
    el("section", {}, el("div", { class: "hint muted", style: "font-size:12px;margin-top:8px" }, "A side stream for the curious: found after its point, it shows something, unlocks its achievement, and the story picks up at the next main point."),
      ...lab("Title", input(s, "title")), ...lab("After the point", select(s, "after", mains)), ...lab("How it's found", area(s, "find", 2)), ...lab("What it shows", area(s, "shows", 3)),
      ...lab("Its achievement", input(s, "achievement"))));
}
function inspectEnding(box) {
  const e = (P.endings || []).find(x => x.id === SEL.id); if (!e) { SEL = null; box.classList.add("hidden"); return; }
  const r = e.rule = e.rule || { by: "karma" };
  const talks = allPoints().filter(x => x.p.talk).map(x => [x.p.id, `${x.p.id} ${x.p.title || ""}`]);
  const t = (pointById(r.point).p || {}).talk;
  const re = () => { renderInspector(); renderRiver(); };
  box.replaceChildren(head(`${e.kind === "intended" ? "★ the intended ending" : "an ending"}`, e.kind === "intended" ? "#e5b450" : "#4fa3d9"),
    el("section", {}, ...lab("Title", input(e, "title")),
      ...lab("Kind", select(e, "kind", [["intended", "the intended ending"], ["other", "another ending"]], () => { if (e.kind === "intended") for (const x of P.endings) if (x !== e) x.kind = "other"; re(); })),
      ...lab("The ending cutscene", area(e, "what", 4)), ...lab("How a player gets here", area(e, "how", 2)),
      el("h3", {}, "How the story picks it"),
      ...lab("By", select(r, "by", [["karma", "karma (what the answers added up to)"], ["answer", "an answer at a talk"]], () => { if (r.by === "karma") { delete r.point; delete r.option; } else { delete r.min; delete r.max; } re(); })),
      ...(r.by === "answer" ? [...lab("At the talk", select(r, "point", talks, re, "—")), ...lab("The answer", select(r, "option", ((t || {}).options || []).map(o => [o.id, `${o.id}: ${o.say}`]), null, "—"))]
        : [el("div", { class: "two" }, el("div", {}, ...lab("Karma at least", el("input", { type: "number", value: r.min ?? "", placeholder: "—", on: { input: ev => { if (ev.target.value === "") delete r.min; else r.min = +ev.target.value; changed(); } } }))),
          el("div", {}, ...lab("Karma at most", el("input", { type: "number", value: r.max ?? "", placeholder: "—", on: { input: ev => { if (ev.target.value === "") delete r.max; else r.max = +ev.target.value; changed(); } } })))),
          el("div", { class: "muted", style: "font-size:12px;margin-top:6px" }, "Neither: the ending for the rest.")]),
      el("div", { class: "muted", style: "font-size:12px;margin-top:12px" }, e.by === "user" ? "Your ending." : "Suggested by the assistant.")));
}

// ---- the bible ---------------------------------------------------------------------------------------------------
function renderBible() {
  const b = P.bible = P.bible || {};
  const rows = (arr, fields, make, label) => list(arr, (x, i, rm) => [el("div", { class: "ihead" }, el("b", {}, x.id || "?"), del(rm)),
    ...fields.map(([k, l, kind]) => kind === "area" ? [el("label", {}, l), area(x, k, 2)] : kind === "subject" ? [el("label", {}, l), select(x, k, ["she", "he"])] : [el("label", {}, l), input(x, k, { redraw: false })]).flat()], make, label);
  b.ladder = b.ladder || [];
  $("#bible").replaceChildren(el("div", { class: "form" },
    el("h2", {}, "The story"),
    ...lab("Logline", input(b, "logline", { redraw: false })), ...lab("The hook: why a player relates to it", area(b, "hook", 2)),
    ...lab("The truth: what's really going on", area(b, "truth", 4)),
    el("label", {}, "The ladder: from ordinary to the truth, step by step"),
    list(b.ladder, (s, i, rm) => [el("div", { class: "ihead" }, el("input", { value: s, on: { input: e => { b.ladder[i] = e.target.value; changed(false); } } }), del(rm))], () => "", "step"),
    el("div", { class: "row" }, el("div", {}, ...lab("Tone", input(b, "tone", { redraw: false }))), el("div", {}, ...lab("It starts at", select(b, "time", ["day", "dusk", "night"])))),
    ...lab("The setting", area(b, "setting", 2)), ...lab("The player", input(b, "player", { redraw: false })), ...lab("What karma measures in this story", input(b, "karma", { redraw: false })),
    el("h2", {}, "Cast"),
    rows(b.cast = b.cast || [], [["name", "Name"], ["subject", "She or he", "subject"], ["role", "Role"], ["look", "Look"], ["wants", "Wants"], ["hides", "Hides"], ["tells", "How the face gives them away", "area"]],
      () => ({ id: nextId("cast", allIds()), name: "", subject: "she", role: "", look: "", wants: "", hides: "", tells: "" }), "cast member"),
    el("h2", {}, "Places"),
    rows(b.places = b.places || [], [["name", "Name"], ["look", "Look", "area"]], () => ({ id: nextId("place", allIds()), name: "", look: "" }), "place"),
    el("h2", {}, "Acts"),
    rows(P.acts = P.acts || [], [["title", "Title"]], () => ({ id: nextId("a", allIds()), title: "" }), "act"),
    el("h2", {}, "Achievements"),
    list(P.achievements = P.achievements || [], (a, i, rm) => [el("div", { class: "ihead" }, input(a, "title", { placeholder: "title", redraw: false }), del(rm)),
      ...lab("The hint", input(a, "text", { redraw: false })),
      el("div", { class: "two" }, el("div", {}, ...lab("For", select(a, "for", [["feat", "a feat"], ...(P.secrets || []).map(s => ["secret:" + s.id, "the secret " + (s.title || s.id)]), ...(P.endings || []).map(e => ["ending:" + e.id, "the ending " + (e.title || e.id)])]))),
        el("div", {}, el("label", {}, "Hidden"), el("label", { class: "chips" }, el("input", { type: "checkbox", checked: a.hidden, on: { change: e => { a.hidden = e.target.checked; changed(false); } } }), " hidden until unlocked")))],
      () => ({ id: nextId("ach", allIds()), title: "", text: "", for: "feat", hidden: false }), "achievement")));
}

// ---- the faces ---------------------------------------------------------------------------------------------------
function renderFaces() {
  const used = new Map();
  for (const { p } of allPoints()) {
    (p.lines || []).forEach((l, i) => l.face && (used.get(l.face) || used.set(l.face, []).get(l.face)).push({ where: `${p.id} line ${i + 1}`, who: l.who, id: p.id }));
    const t = p.talk; if (!t) continue;
    const who = (t.line || {}).who || (p.who || [])[0];
    if (t.listen) (used.get(t.listen) || used.set(t.listen, []).get(t.listen)).push({ where: `${p.id} listening`, who, id: p.id });
    for (const o of t.options || []) if (o.face) (used.get(o.face) || used.set(o.face, []).get(o.face)).push({ where: `${p.id} answer ${o.id}`, who, id: p.id });
  }
  const copy = text => navigator.clipboard.writeText(text).then(() => toast("copied the prompt"));
  const row = (id, f, uses) => {
    const who = (uses[0] || {}).who || f.for, own = (P.faces || []).includes(f);
    return el("div", { class: "face" }, el("div", { class: "id" }, id, el("small", {}, `${own ? "this story's" : "the library's"} · ${f.secs || 4} s${f.loop ? " · loops " + f.loop.join("–") : ""}`)),
      el("div", {}, own ? area(f, "prompt", 2) : el("div", { class: "p" }, forSubject(f.prompt, subjectOf(who))),
        el("div", { class: "used" }, ...(uses.length ? ["used at ", ...uses.flatMap((u, k) => [k ? ", " : "", el("a", { href: "#", on: { click: ev => { ev.preventDefault(); setTab("river"); select_({ kind: "point", id: u.id }); } } }, u.where)])] : ["not used yet"]),
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
      el("div", { class: "hint" }, "Every face the dialogue uses, as its MiniMax post prompt (copy appends it to your own prompt for the character). Generate 4 seconds; stretch it to its length and loop its held part in the expression tool.")),
    ...story, ...own.map(f => row(f.id, f, [])),
    el("div", { class: "form", style: "max-width:none;padding:18px 0 0" }, el("h2", {}, `The library (${Object.keys(LIB).length})`)), filter, libBox));
}

// ---- the assistant -----------------------------------------------------------------------------------------------
function viewNow() {
  const out = { session: SID, title: P && P.title, tab: TAB };
  if (SEL) {
    out.selected = SEL.id; out.selected_kind = SEL.kind;
    if (SEL.kind === "point") { const { p } = pointById(SEL.id); if (p) out.selected_title = p.title; }
  }
  return out;
}
function tellNow() {
  const v = viewNow(), s = $("#sees");
  const what = TAB === "river" ? (SEL ? `the river · ${SEL.kind} ${SEL.id}${v.selected_title ? " " + q(v.selected_title) : ""}` : "the river") : `the ${TAB}`;
  s.textContent = "Sees: " + what;
  clearTimeout(NOW_T); NOW_T = setTimeout(() => api("now", v).catch(() => { }), 400);
}
function renderChat() {
  const box = $("#msgs"); if (!P) return;
  box.replaceChildren(...(P.chat || []).map(m => el("div", { class: "msg " + m.role }, m.text,
    m.done && m.done.length ? el("div", { class: "done" }, "✓ " + m.done.join(", ")) : null)));
  if (!(P.chat || []).length) box.append(el("div", { class: "muted", style: "font-size:12.5px;line-height:1.5" }, "Ask about the story, or for a change. The assistant sees the brief, the bible, the river and the point you've picked; what it changes is applied at once (Undo takes it back)."));
  box.scrollTop = box.scrollHeight;
}
async function send() {
  const t = $("#say"), msg = t.value.trim(); if (!msg || !P) return;
  if (JOB) return toast("the assistant is still working");
  await flush();
  t.value = "";
  (P.chat = P.chat || []).push({ role: "user", text: msg });
  renderChat();
  try {
    const j = await api("chat/" + encodeURIComponent(SID), { message: msg, view: viewNow() });
    follow(j.id, JSON.stringify(Object.assign(clone(P), { chat: P.chat.slice(0, -1) })));
  } catch (e) { toast(e.message, true); P.chat.pop(); renderChat(); }
}
async function draft(stages) {
  if (!P || JOB) return;
  await flush();
  if (stages.includes("river") && (P.points || []).length && !(await dialog("Draft again?", [el("p", {}, "This replaces the river and its details with a new draft. Undo brings this one back.")], "Draft"))) return;
  if (stages.includes("details") && !(P.acts || []).length && !stages.includes("river")) return toast("draft the river first", true);
  try { const j = await api("draft/" + encodeURIComponent(SID), { stages }); follow(j.id, BASE); }
  catch (e) { toast(e.message, true); }
}
// a job: its progress in the panel, the session reloaded as each stage lands, the snapshot before it on the undo stack
async function follow(jid, before) {
  JOB = jid; document.body.classList.add("busy");
  $("#work").classList.remove("hidden"); $("#stop").classList.remove("hidden"); $("#send").disabled = true;
  let seen = "";
  while (JOB === jid) {
    let j;
    try { j = await api("job/" + encodeURIComponent(jid)); } catch (e) { break; }
    $("#work").replaceChildren(...j.log.slice(-8).map((l, i, a) => el("div", { class: "line" + (i === a.length - 1 && j.status === "running" ? " now" : "") }, i === a.length - 1 && j.status === "running" ? el("span", { class: "spin" }) : null, l.text)),
      ...(j.error ? [el("div", { class: "err" }, j.error)] : []));
    const stamp = String(j.log.length);
    if (j.kind.startsWith("draft") && stamp !== seen) { seen = stamp; try { const r = await api("session/" + encodeURIComponent(SID)); P = r.prototype; CHECK = r; BASE = JSON.stringify(P); renderAll(); } catch (e) { } }
    if (j.status !== "running") {
      JOB = null; document.body.classList.remove("busy"); $("#stop").classList.add("hidden"); $("#send").disabled = false;
      await reload(before);
      if (j.status === "done") {
        toast(j.kind === "chat" ? "the assistant answered" : "drafted");
        if (j.kind.startsWith("draft") && (P.points || []).length && TAB === "brief" && j.kind.includes("river")) setTab("river");
        if (j.result && j.result.couldnt && j.result.couldnt.length) toast("couldn't: " + j.result.couldnt.join("; "), true);
        setTimeout(() => $("#work").classList.add("hidden"), 4000);
      } else if (j.status === "failed") toast(j.error || "failed", true);
      else toast("stopped");
      break;
    }
    await new Promise(r => setTimeout(r, 700));
  }
}

// ---- sessions, settings, build ------------------------------------------------------------------------------------
async function sessionsDialog(first = false) {
  const r = await api("sessions");
  const title = el("input", { placeholder: "a working title" }), kind = el("textarea", { rows: 2, placeholder: "what kind of game: a distant friend invites you over and something isn't quite right" });
  let chose = null;
  const rows = r.sessions.map(s => el("div", { class: "sess", on: { click: () => { chose = s.id; $("#modal").querySelector(".go").click(); } } },
    el("div", { class: "t" }, el("div", {}, s.title || s.id), el("small", {}, `${s.points} points · ${s.minutes} min · ${s.updated.replace("T", " ")}${s.built ? " · built as " + s.built : ""}`)), el("span", { class: "muted" }, "Open")));
  const ok = await dialog(first ? "The writers' room" : "Sessions", [
    el("div", { class: "hint muted", style: "margin-bottom:8px" }, "A session is one game's story, prototyped: a brief, a river, three endings. Start a new one, or open one."),
    el("label", {}, "New"), title, kind,
    rows.length ? el("label", { style: "margin-top:16px" }, "Open") : null, ...rows], "New session");
  if (chose) return open(chose);
  if (!ok) return;
  const n = await api("sessions", { title: title.value.trim() || "Untitled", kind: kind.value.trim() });
  await open(n.prototype.id);
  setTab("brief");
}
async function loadSettings() { const r = await api("settings"); SETTINGS = r.settings; STATUS = r.status; drawSwitch(); }
function drawSwitch() {
  for (const b of document.querySelectorAll("#model button")) b.classList.toggle("on", SETTINGS && b.dataset.b === (SETTINGS.backend === "fake" ? "claude" : SETTINGS.backend));
  const s = STATUS || {}, claudeOk = (s["claude-api"] || {}).ok || (s["claude-code"] || {}).ok;
  $("#model").title = SETTINGS && SETTINGS.backend === "local" ? `a local model: ${SETTINGS.ollama.model} (${(s.local || {}).why || ""})` : `Claude: ${claudeOk ? "ready" : "not set up"}`;
}
async function setBackend(b) {
  const r = await api("settings", { backend: b }); SETTINGS = r.settings; STATUS = r.status; drawSwitch();
  const st = b === "local" ? STATUS.local : (STATUS["claude-api"].ok ? STATUS["claude-api"] : STATUS["claude-code"]);
  toast(b === "local" ? `local: ${SETTINGS.ollama.model}${st.ok ? "" : " (" + st.why + ")"}` : `Claude${st.ok ? "" : ": " + st.why}`, !st.ok);
  if (TAB === "brief") renderBrief();
}
async function settingsDialog() {
  await loadSettings();
  const s = clone(SETTINGS), st = STATUS;
  const line = (ok, name, why) => el("div", { class: "stat " + (ok ? "ok" : "no") }, el("b", {}, ok ? "✓ " : "✗ "), `${name}: ${why}`);
  const body = [
    line(st["claude-api"].ok, "Claude through the API", st["claude-api"].why + (st["claude-api"].ok ? "" : " (python tools/writers/room.py setup, then ANTHROPIC_API_KEY)")),
    line(st["claude-code"].ok, "Claude through Claude Code", st["claude-code"].why),
    line(st.local.ok, `a local model (${s.ollama.model})`, st.local.why),
    ...lab("Who writes", select(s, "backend", [["claude", "Claude"], ["local", "a local model (Ollama)"], ...(FAKE ? [["fake", "the stand-in (tests)"]] : [])])),
    ...lab("Claude, through", select(s, "claude_via", [["auto", "the API when it's set up with a key, else Claude Code"], ["api", "the API"], ["code", "Claude Code (your login, no key)"]])),
    el("div", { class: "two", style: "display:flex;gap:10px" }, el("div", { style: "flex:1" }, ...lab("Claude's model", select(s, "model", [["claude-opus-5-5", "Claude Opus 5.5"], ["claude-sonnet-5-5", "Claude Sonnet 5.5"], ["claude-fable-5-1", "Claude Fable 5.1"]]))),
      el("div", { style: "flex:1" }, ...lab("Effort", select(s, "effort", ["low", "medium", "high", "xhigh", "max"])))),
    el("div", { class: "two", style: "display:flex;gap:10px" }, el("div", { style: "flex:2" }, ...lab("Ollama", input(s.ollama, "url", { redraw: false }))),
      el("div", { style: "flex:1" }, ...lab("Local model", st.local.models && st.local.models.length ? select(s.ollama, "model", st.local.models) : input(s.ollama, "model", { redraw: false }))))];
  if (!(await dialog("Who writes with you", body, "Save"))) return;
  const r = await api("settings", s); SETTINGS = r.settings; STATUS = r.status; drawSwitch(); toast("saved");
}
async function buildDialog() {
  if (!P) return;
  await flush();
  const camel = (P.title || "Game").replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join("") || "Game";
  const game = el("input", { value: (P.built || {}).game || camel }), force = el("input", { type: "checkbox", checked: !!(P.built || {}).game });
  const errs = (CHECK.errors || []).length;
  const ok = await dialog("Build it in the director", [
    el("p", { class: "muted" }, "A rough, working outline of the game: Content/Games/<Game>/story.json (a greybox room per place, the scenes with their lines, the talks with her faces, the to-do lists, the chapters, the forks, the secrets, the three endings), with BUILD.md, what Claude does next to make it the game, and faces.md, the MiniMax prompts to make."),
    ...lab("The game's folder name", game),
    el("label", { class: "chips", style: "margin-top:10px" }, force, " build over it if it exists (its story goes into the desk's history first)"),
    errs ? el("p", { style: "color:#ff9b9b" }, `${errs} problem${errs > 1 ? "s" : ""} in the prototype: fix them first (the river's bar lists them).`) : null], "Build");
  if (!ok) return;
  try {
    const r = await api("build/" + encodeURIComponent(SID), { game: game.value.trim(), force: force.checked });
    P.built = { game: r.game };
    await dialog("Built", [el("p", {}, r.message), el("p", {}, el("a", { href: `http://127.0.0.1:8780/?game=${encodeURIComponent(r.game)}`, target: "_blank" }, "Open it in the director"), " (the desk's server running)"),
      el("p", { class: "muted" }, `Then, in Claude Code: “build ${r.game} from its BUILD.md”.`)], null);
  } catch (e) { toast(e.message, true); }
}

// ---- start ---------------------------------------------------------------------------------------------------------
async function init() {
  for (const b of document.querySelectorAll("#tabs button")) b.addEventListener("click", () => setTab(b.dataset.tab));
  for (const b of document.querySelectorAll("#model button")) b.addEventListener("click", () => setBackend(b.dataset.b));
  $("#title").addEventListener("input", e => { if (P) { P.title = e.target.value; changed(false); } });
  $("#undo").addEventListener("click", () => undo(true)); $("#redo").addEventListener("click", () => undo(false));
  $("#gear").addEventListener("click", settingsDialog);
  $("#sessionsBtn").addEventListener("click", () => sessionsDialog());
  $("#buildBtn").addEventListener("click", buildDialog);
  $("#send").addEventListener("click", send);
  $("#stop").addEventListener("click", () => JOB && api("cancel/" + encodeURIComponent(JOB), {}));
  $("#say").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
  $("#chatFold").addEventListener("click", () => $("#chat").classList.toggle("fold"));
  document.addEventListener("keydown", e => {
    const typing = e.target.closest("input,textarea,select");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); undo(!e.shiftKey); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); flush(); }
    else if (e.key === "Escape" && !typing && SEL && !$("#modal").classList.contains("on")) select_(null);
  });
  window.addEventListener("beforeunload", () => { if (SAVE_T) flush(); });
  const lib = await api("library"); LIB = Object.fromEntries(lib.faces.map(f => [f.id, f]));
  await loadSettings();
  let sid = params.get("s");
  if (!sid) try { sid = localStorage.getItem("writers.last"); } catch (e) { }
  if (sid) { try { await open(sid); } catch (e) { sid = null; } }
  if (!sid) sessionsDialog(true);
}
init();
window.__wr = { get P() { return P; }, get check() { return CHECK; }, get sel() { return SEL; }, get tab() { return TAB; }, get job() { return JOB; }, get river() { return RIVER; },
  open, setTab, select: select_, undo, flush, draft, send, reload };

// The Director Manager's page (docs/GODOT_DIRECTOR_PLAN.md §4, DECISIONS 2026-11-01): a Director game's story,
// director/director.json in its Godot project, written without JSON. Quests in play order (their steps, when each is
// done, the wrong thing given, what comes next by condition), people (their conversations, the states that move
// them), moments (when, if, do), states (while, set), endings, facts, achievements, the saves, and Coverage (what the
// scene has that the story never names, what it names that the scene hasn't got, what's wrong).
// The commands and triggers are the desk's own (tools/director/commands.js, its forms and lists in ui.js), over the
// project's ids (the plugin's index); conditions have an editor of their own here (core/cond.gd's shapes).
import { h, modal, toast, actionList, triggerPill, form } from "/desk/ui.js";
import { ACTIONS, TRICKS } from "/desk/commands.js";
import { icon } from "/desk/icons.js";
import { coverage, AUTO } from "/coverage.js";

// the Director's words over the desk's: a line is written in place (no lines table)
for (const d of ACTIONS) for (const f of d.fields) if (f.kind === "line") f.kind = "longtext";
for (const k of Object.keys(TRICKS)) for (const f of TRICKS[k]) if (f.kind === "line") f.kind = "longtext";

const Q = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
let P = null, S = null, dirty = false, stamp = 0, cov = null;
const UI = { tab: "quests", quest: 0, person: null };
try { Object.assign(UI, JSON.parse(localStorage.getItem("hsdm_ui") || "{}")); } catch (e) { /* a private window */ }
const keepUI = () => { try { localStorage.setItem("hsdm_ui", JSON.stringify(UI)); } catch (e) { /* no storage */ } };

const TABS = [["quests", "Quests"], ["people", "People"], ["moments", "Moments"], ["states", "States"], ["endings", "Endings"],
  ["facts", "Facts"], ["achievements", "Achievements"], ["coverage", "Coverage"], ["saves", "Saves"]];
const arr = x => (Array.isArray(x) ? x : []);
const isObj = x => x && typeof x === "object" && !Array.isArray(x);

// ---- the project ---------------------------------------------------------------------------------------------------
const project = () => (P && P.project) || Q.get("project") || "";
async function api(path, body) {
  const r = await fetch(`/api/${path}?project=${encodeURIComponent(project())}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  return r.json();
}
async function load() {
  const p = await api("project");
  if (p.error) { $("page").replaceChildren(h("p", { class: "empty" }, p.error)); return; }
  P = p; S = p.story; stamp = p.stamp; dirty = false;
  for (const k of ["quests", "states", "moments", "endings", "achievements"]) if (!Array.isArray(S[k])) S[k] = [];
  if (!isObj(S.talk)) S.talk = {};
  if (!isObj(S.facts)) S.facts = {};
  $("proj").textContent = P.name; $("path").textContent = P.project; document.title = `${P.name} · Director Manager`;
  if (p.problem) toast(p.problem);
  render();
}
async function save() {
  const r = await api("story", { story: S });
  if (r.ok) { dirty = false; stamp = r.stamp; mark(); toast("Saved director/director.json"); } else toast("Not saved: " + (r.error || "?"));
}
function mark() {
  $("state").textContent = dirty ? "unsaved" : "saved"; $("state").className = "state" + (dirty ? " dirty" : "");
  cov = coverage(S, P);
  const pr = $("probs"); pr.textContent = cov.errors ? `${cov.errors} to fix` : cov.warnings ? `${cov.warnings} to look at` : "all good";
  pr.className = "probs" + (cov.errors ? " bad" : cov.warnings ? " warn" : "");
}
function changed() { dirty = true; mark(); }
const ctx = { refs: kind => refs(kind), name: (kind, v) => (v === undefined || v === null || v === "" ? "—" : v === "*" ? "anything" : String(v)),
  changed, rerender: () => render(), story: () => ({}) };

// ---- the ids, by kind -------------------------------------------------------------------------------------------------
const ids = k => (P.ids[k] || []).slice().sort();
const uniq = a => [...new Set(a.filter(x => x !== undefined && x !== null && x !== ""))];
const pairs = a => uniq(a).map(v => [v, v]);
const lifeOf = id => { for (const k of Object.keys(P.ids)) if (k.startsWith("life:") && P.ids[k].includes(id)) return k.slice(5); return null; };
const steps = () => S.quests.flatMap(q => arr(q.steps).map(s => s.id));
const people = () => uniq([...ids("actor"), ...Object.keys(S.talk)]).sort();
function factNames() {
  const out = new Set(Object.keys(S.facts));
  for (const f of (cov || coverage(S, P)).facts) out.add(f.name);
  for (const t of ids("thing")) out.add("used:" + t);
  for (const it of ids("item")) out.add("picked:" + it);
  for (const n of ids("note")) out.add("read:" + n);
  for (const a of ids("area")) out.add("entered:" + a);
  for (const s of steps()) out.add("step:" + s);
  for (const q of S.quests) out.add("done:" + q.id);
  for (const [who, list] of Object.entries(S.talk)) for (const t of arr(list)) { out.add("talked:" + t.id); out.add("heard:" + t.id);
    for (const ln of arr(t.lines)) for (const a of arr(ln.answers)) out.add(`answered:${t.id}:${a.id}`); }
  return [...out].sort();
}
function refs(kind) {
  if (kind.startsWith("lifestate:")) return pairs(P.lives[lifeOf(kind.slice(10))] || []);
  switch (kind) {
    case "thing": case "table": case "die": case "carry": return pairs(ids("thing"));
    case "door": return pairs(ids("door"));
    case "spot": return pairs(ids("spot"));
    case "cast": return pairs(ids("actor"));
    case "zone": return pairs(ids("area"));
    case "room": return pairs(ids("room"));
    case "item": return pairs([...ids("item"), ...S.quests.flatMap(q => arr(q.steps).map(s => (isObj(s.done) && s.done.gave !== "*" ? s.done.gave : null)))]);
    case "note": return pairs(ids("note"));
    case "light": return pairs(ids("light"));
    case "life": return pairs(ids("life"));
    case "route": case "routes": return pairs(ids("path"));
    case "motion": return pairs(ids("motion"));
    case "counter": return pairs(ids("counter"));
    case "sound": return pairs(P.sounds);
    case "flag": return pairs(factNames());
    case "scene": return Object.entries(S.talk).flatMap(([w, l]) => arr(l).map(t => [`talk__${w}__${t.id}`, `${w}: ${t.id}`]));
    case "todo": case "anytodo": return pairs(steps());
    case "beat": return pairs(S.moments.map(m => "m_" + m.id));
    default: return [];
  }
}
const targets = () => uniq([...ids("actor"), ...ids("thing"), ...ids("door"), ...ids("light"), ...ids("life")]).sort();
const kindOf = id => (ids("actor").includes(id) ? "person" : ids("door").includes(id) ? "door" : ids("light").includes(id) ? "light" : lifeOf(id) ? "life" : "thing");
const goTargets = () => [["", "—"], ...S.quests.map(q => [q.id, "quest " + (q.title || q.id)]), ...S.endings.map(e => [e.id, "ending " + (e.title || e.id)])];
function freshId(base, taken) { let n = 1; while (taken.includes(`${base}_${n}`)) n++; return `${base}_${n}`; }
const allIds = () => [...S.quests.map(q => q.id), ...steps(), ...S.endings.map(e => e.id), ...S.moments.map(m => m.id), ...Object.values(S.talk).flatMap(l => arr(l).map(t => t.id)), ...S.achievements.map(a => a.id)];

// ---- small inputs -----------------------------------------------------------------------------------------------------
function inp(o, k, { ph = "", num = false, area = false, w = null, after = null } = {}) {
  const set = v => { if (v === "" || v === null || (num && isNaN(v))) delete o[k]; else o[k] = v; changed(); if (after) after(); };
  if (area) return h("textarea", { rows: 2, placeholder: ph, on: { input: e => set(e.target.value) } }, o[k] ?? "");
  return h("input", { value: o[k] ?? "", placeholder: ph, type: num ? "number" : "text", step: num ? "any" : null, class: num ? "num" : null,
    style: w ? `width:${w}` : null, on: { change: e => set(num ? parseFloat(e.target.value) : e.target.value) } });
}
function sel(o, k, options, { blank = null, after = null } = {}) {
  const s = h("select", { on: { change: e => { if (e.target.value === "") delete o[k]; else o[k] = e.target.value; changed(); if (after) after(); } } });
  const opts = blank !== null ? [["", blank], ...options] : options;
  if (o[k] !== undefined && o[k] !== "" && !opts.some(([v]) => v === o[k])) opts.push([o[k], o[k] + " (not in the scene)"]);
  for (const [v, l] of opts) s.append(h("option", { value: v, selected: o[k] === v || (o[k] === undefined && v === "") ? true : null }, l));
  return s;
}
function chk(o, k, label, { dflt = false } = {}) {
  return h("label", { class: "chip" }, h("input", { type: "checkbox", checked: (o[k] ?? dflt) ? true : null,
    on: { change: e => { if (e.target.checked === dflt) delete o[k]; else o[k] = e.target.checked; changed(); } } }), " " + label);
}
const row = (label, ...kids) => h("div", { class: "row" }, h("label", { class: "l" }, label), ...kids);
const datalist = (id, values) => h("datalist", { id }, values.map(v => h("option", { value: v })));
function listArr(o, k) { if (!Array.isArray(o[k])) o[k] = []; return o[k]; }
function actions(o, k, empty = "Nothing yet.") {
  const a = listArr(o, k);
  const c = Object.assign({}, ctx, { changed() { if (!o[k].length) delete o[k]; changed(); }, rerender: () => render() });
  return actionList(a, c, { empty });
}
function moveBtns(list, i, after) {
  return [h("button", { class: "ghost small", title: "move up", on: { click: () => { if (i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; changed(); after ? after(i - 1) : render(); } } } }, "▲"),
    h("button", { class: "ghost small", title: "move down", on: { click: () => { if (i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; changed(); after ? after(i + 1) : render(); } } } }, "▼")];
}
const delBtn = (what, fn) => h("button", { class: "ghost small danger", title: "delete " + what, on: { click: async () => { if (await modal({ title: `Delete ${what}?`, body: h("p", {}, "It goes from the story (Ctrl+Z isn't here: Reload before saving brings it back)."), ok: "Delete" })) { fn(); changed(); render(); } } } }, icon("x", 14));

// ---- conditions (core/cond.gd) ------------------------------------------------------------------------------------------
const CLAUSES = [["fact", "a fact (something done, or a flag)"], ["quest", "a quest is the one on"], ["done", "a quest is done"], ["step", "a step is ticked"],
  ["has", "an item is held"], ["count", "a counter"], ["karma", "karma"], ["ending", "an ending was reached"]];
function parseClause(c) {
  if (typeof c === "string") return c.startsWith("!") ? { kind: "fact", v: c.slice(1), not: true } : { kind: "fact", v: c, not: false };
  if (!isObj(c)) return { kind: "raw", v: c };
  if (c.not !== undefined && Object.keys(c).length === 1) { const x = parseClause(c.not); if (x.kind !== "raw") { x.not = !x.not; return x; } return { kind: "raw", v: c }; }
  for (const k of ["fact", "quest", "done", "step", "has", "ending"]) if (c[k] !== undefined && Object.keys(c).length === 1) return { kind: k, v: String(c[k]), not: false };
  if (c.count !== undefined) return { kind: "count", v: c.count, at_least: c.at_least, at_most: c.at_most, not: false };
  if (c.karma !== undefined) return { kind: "karma", at_least: (c.karma || {}).at_least, at_most: (c.karma || {}).at_most, not: false };
  return { kind: "raw", v: c };
}
function parseCond(c) {
  if (c === undefined || c === null || c === "") return { mode: "all", items: [] };
  if (Array.isArray(c)) return { mode: "all", items: c.map(parseClause) };
  if (isObj(c) && Array.isArray(c.all) && Object.keys(c).length === 1) return { mode: "all", items: c.all.map(parseClause) };
  if (isObj(c) && Array.isArray(c.any) && Object.keys(c).length === 1) return { mode: "any", items: c.any.map(parseClause) };
  return { mode: "all", items: [parseClause(c)] };
}
function clauseJSON(x) {
  if (x.kind === "raw") return x.v;
  if (x.kind === "fact") return (x.not ? "!" : "") + x.v;
  let j;
  if (x.kind === "count") { j = { count: x.v }; if (x.at_least !== undefined) j.at_least = x.at_least; if (x.at_most !== undefined) j.at_most = x.at_most; }
  else if (x.kind === "karma") { j = { karma: {} }; if (x.at_least !== undefined) j.karma.at_least = x.at_least; if (x.at_most !== undefined) j.karma.at_most = x.at_most; }
  else j = { [x.kind]: x.v };
  return x.not ? { not: j } : j;
}
function buildCond(mode, items) {
  if (!items.length) return undefined;
  if (items.length === 1) return clauseJSON(items[0]);
  return { [mode]: items.map(clauseJSON) };
}
const range = x => [x.at_least !== undefined ? `≥ ${x.at_least}` : "", x.at_most !== undefined ? `≤ ${x.at_most}` : ""].filter(Boolean).join(" and ");
function clauseText(x) {
  const n = x.not ? "not " : "";
  switch (x.kind) {
    case "fact": return n + x.v;
    case "quest": return `${n}quest ${x.v} is on`;
    case "done": return `${n}quest ${x.v} done`;
    case "step": return `${n}step ${x.v} ticked`;
    case "has": return `${n}holding ${x.v}`;
    case "ending": return `${n}ending ${x.v} reached`;
    case "count": return `${n}${x.v} ${range(x)}`;
    case "karma": return `${n}karma ${range(x)}`;
    default: return JSON.stringify(x.v);
  }
}
async function askClause() {
  const d = { kind: "fact", v: "", not: false };
  const dl = "dl_" + Math.random().toString(36).slice(2);
  const vals = { fact: factNames(), quest: S.quests.map(q => q.id), done: S.quests.map(q => q.id), step: steps(), has: refs("item").map(p => p[0]),
    ending: S.endings.map(e => e.id), count: ids("counter") };
  const body = h("div", {});
  const draw = () => {
    body.replaceChildren(
      row("Is it", (() => { const s = h("select", { on: { change: e => { d.kind = e.target.value; d.v = ""; draw(); } } }); for (const [v, l] of CLAUSES) s.append(h("option", { value: v, selected: d.kind === v ? true : null }, l)); return s; })()),
      d.kind !== "karma" ? row(d.kind === "fact" ? "Fact" : "Which", h("input", { list: dl, value: d.v, placeholder: d.kind === "fact" ? "read:letter, used:kettle, gave:mug:mari…" : "", on: { input: e => { d.v = e.target.value; } } }), datalist(dl, vals[d.kind] || [])) : null,
      ["count", "karma"].includes(d.kind) ? row("At least", h("input", { type: "number", step: "any", class: "num", on: { input: e => { d.at_least = e.target.value === "" ? undefined : parseFloat(e.target.value); } } }),
        h("label", { class: "l" }, "at most"), h("input", { type: "number", step: "any", class: "num", on: { input: e => { d.at_most = e.target.value === "" ? undefined : parseFloat(e.target.value); } } })) : null,
      row("", h("label", { class: "chip" }, h("input", { type: "checkbox", checked: d.not ? true : null, on: { change: e => { d.not = e.target.checked; } } }), " NOT: it must not be so")),
      d.kind === "fact" ? h("p", { class: "hint" }, "The game writes these as the player plays: " + Object.keys(AUTO).filter(p => p !== "@").map(p => p + "…").join(", ") + "; or a flag of your own (a moment's Set flag, an answer's sets).") : null);
  };
  draw();
  if (!(await modal({ title: "Only if…", body }))) return null;
  if (d.kind !== "karma" && !String(d.v).trim()) return null;
  d.v = String(d.v).trim();
  return d;
}
function condEd(o, k, label = "only if") {
  const c = parseCond(o[k]);
  const put = () => { const v = buildCond(c.mode, c.items); if (v === undefined) delete o[k]; else o[k] = v; changed(); render(); };
  const box = h("div", { class: "cond" }, label ? h("span", { class: "hint" }, label) : null);
  if (!c.items.length) box.append(h("span", { class: "hint" }, "always"));
  c.items.forEach((x, i) => {
    if (i > 0) box.append(h("button", { class: "ghost mode", title: "all of them, or any one", on: { click: () => { c.mode = c.mode === "all" ? "any" : "all"; put(); } } }, c.mode === "all" ? "and" : "or"));
    box.append(h("span", { class: "chip" + (x.not ? " neg" : "") }, clauseText(x), h("button", { class: "x", title: "take it away", on: { click: () => { c.items.splice(i, 1); put(); } } }, "×")));
  });
  box.append(h("button", { class: "ghost small", on: { click: async () => { const x = await askClause(); if (x) { c.items.push(x); put(); } } } }, icon("plus", 12), " add"));
  return box;
}

// ---- triggers: the desk's, or a condition becoming true --------------------------------------------------------------------
function trigEd(o, k, { prefix = "When", optional = false } = {}) {
  const w = o[k], box = h("div", { class: "trig" });
  if (isObj(w) && "holds" in w) {
    box.append(h("span", { class: "hint" }, prefix + " this becomes true:"), condEd(w, "holds", ""),
      h("button", { class: "ghost small", title: "a thing that happens instead", on: { click: () => { delete o[k]; changed(); render(); } } }, "an event instead"));
    return box;
  }
  box.append(triggerPill({ get: () => o[k], set: v => { o[k] = v; } }, ctx, { prefix }));
  box.append(h("button", { class: "ghost small", title: "when something becomes true (a fact, a quest done...), not a thing happening",
    on: { click: () => { o[k] = { holds: [] }; changed(); render(); } } }, "or once…"));
  if (optional && w) box.append(h("button", { class: "ghost small", title: "none", on: { click: () => { delete o[k]; changed(); render(); } } }, icon("x", 12)));
  return box;
}

// ---- the page -------------------------------------------------------------------------------------------------------------
function render() {
  if (!S) return;
  const page = $("page"), top = page.scrollTop;
  mark();
  const counts = { quests: S.quests.length, people: people().length, moments: S.moments.length, states: S.states.length, endings: S.endings.length,
    facts: cov.facts.length, achievements: S.achievements.length, coverage: cov.problems.length, saves: (P.saves.slots || []).length };
  $("tabs").replaceChildren(...TABS.map(([id, label]) => h("button", { class: UI.tab === id ? "on" : null, "data-tab": id, on: { click: () => { UI.tab = id; keepUI(); render(); } } },
    h("span", {}, label), h("span", { class: "n" }, String(counts[id] ?? "")))));
  const view = { quests: viewQuests, people: viewPeople, moments: viewMoments, states: viewStates, endings: viewEndings, facts: viewFacts,
    achievements: viewAchievements, coverage: viewCoverage, saves: viewSaves }[UI.tab] || viewQuests;
  page.replaceChildren(...[view()].flat(Infinity).filter(x => x !== null && x !== undefined && x !== false));
  if (!P.indexed) page.prepend(h("div", { class: "card" }, h("b", {}, "No ids from the scene yet. "), "Open the project in Godot and save its scenes once (the plugin writes their ids then); the pickers here list them."));
  page.scrollTop = top;
}

// ---- quests ------------------------------------------------------------------------------------------------------------------
function viewQuests() {
  const qs = S.quests;
  if (UI.quest >= qs.length) UI.quest = Math.max(0, qs.length - 1);
  const list = h("div", { class: "list" }, qs.map((q, i) => h("div", { class: "item" + (i === UI.quest ? " on" : ""), "data-quest": q.id, on: { click: () => { UI.quest = i; keepUI(); render(); } } },
    h("span", { class: "t" }, `${i + 1}. ${q.title || q.id}`), h("span", { class: "s" }, `${arr(q.steps).length}`))),
    h("button", { class: "small", "data-act": "new-quest", on: { click: () => { const id = freshId("q", allIds()); qs.push({ id, title: "New quest", objective: "", steps: [] }); UI.quest = qs.length - 1; changed(); render(); } } }, icon("plus", 12), " New quest"));
  const q = qs[UI.quest];
  return [h("h2", {}, "Quests"), h("p", { class: "lead" }, "Played one at a time, in this order. A step only counts while its quest is the one on. What comes next can depend on what the player has done."),
    h("div", { class: "split" }, list, q ? questEd(q, UI.quest) : h("p", { class: "empty" }, "No quests yet: a free roam with the moments, conversations and states."))];
}
function questEd(q, i) {
  const qs = S.quests;
  const head = h("div", { class: "card" }, h("h3", {}, icon("task", 16), q.title || q.id, h("span", { class: "grow" }), ...moveBtns(qs, i, j => { UI.quest = j; render(); }),
    delBtn("this quest", () => { qs.splice(i, 1); UI.quest = Math.max(0, i - 1); })),
    row("Id", inp(q, "id", { after: render })), row("Title", inp(q, "title", { ph: "The key", w: "320px" })), row("Objective", inp(q, "objective", { ph: "shown at the top left", w: "420px" })),
    row("Plays on", sel(q, "map", pairs(ids("level")), { blank: "the level before it" }), h("label", { class: "l" }, "starting at"), sel(q, "start_at", pairs(ids("spot")), { blank: "where the player is" })),
    row("Finishes", sel(q, "finish", [["steps", "when all its steps are done"], ["any", "on its first step done (a choice by what they do)"], ["never", "when a moment says so (Finish the task)"]], { blank: null }),
      chk(q, "checkpoint", "a checkpoint as it starts", { dflt: true })),
    row("Time limit", inp(q, "time_limit", { num: true, ph: "s" }), h("label", { class: "l" }, "then"), sel(q, "on_timeout", goTargets().slice(1), { blank: "—" })),
    cardEd(q));
  const stepsBox = h("div", { class: "card steps" }, h("h3", {}, icon("todo", 16), "Steps (the to-do list)"),
    arr(q.steps).map((s, j) => stepEd(q, s, j)),
    h("button", { class: "small", "data-act": "new-step", on: { click: () => { listArr(q, "steps").push({ id: freshId("s", allIds()), text: "Something to do" }); changed(); render(); } } }, icon("plus", 12), " Add a step"));
  const acts = h("div", { class: "card" }, h("h3", {}, icon("event", 16), "As it starts"), actions(q, "on_start"), h("h3", { style: "margin-top:12px" }, icon("event", 16), "When it's done"), actions(q, "on_done"));
  const after = qs[i + 1] ? `the next quest, ${qs[i + 1].title || qs[i + 1].id}` : S.endings[0] ? `the first ending, ${S.endings[0].title || S.endings[0].id}` : "nothing yet (add an ending)";
  const next = h("div", { class: "card" }, h("h3", {}, icon("choice", 16), "What comes next"),
    arr(q.next).map((n, j) => h("div", { class: "row" }, h("span", { class: "hint" }, j === 0 ? "If" : "else if"), condEd(n, "if", ""), h("span", { class: "hint" }, "go to"),
      sel(n, "go", goTargets().slice(1), { blank: "—" }), ...moveBtns(q.next, j), h("button", { class: "ghost small", on: { click: () => { q.next.splice(j, 1); if (!q.next.length) delete q.next; changed(); render(); } } }, icon("x", 12)))),
    h("div", { class: "row" }, h("span", { class: "hint" }, `Otherwise: ${after}.`)),
    h("button", { class: "small", on: { click: () => { listArr(q, "next").push({ if: [], go: "" }); changed(); render(); } } }, icon("plus", 12), " Add a way, by what's been done"));
  return h("div", {}, head, stepsBox, acts, next);
}
function cardEd(q) {
  if (!isObj(q.card)) return row("Chapter card", h("button", { class: "small", on: { click: () => { q.card = { title: q.title || "", sub: "", time: "" }; changed(); render(); } } }, icon("plus", 12), " a card before it"));
  return row("Chapter card", inp(q.card, "title", { ph: "Night 1" }), inp(q.card, "sub", { ph: "23:40" }),
    sel(q.card, "time", [["day", "day"], ["dusk", "dusk"], ["night", "night"]], { blank: "the time it was" }),
    h("button", { class: "ghost small", on: { click: () => { delete q.card; changed(); render(); } } }, icon("x", 12)));
}
function stepEd(q, s, j) {
  const g = isObj(s.done) && s.done.gave !== undefined && s.done.gave !== "*";
  return h("div", { class: "card sub", "data-step": s.id },
    h("div", { class: "row" }, h("b", {}, `${j + 1}.`), inp(s, "text", { ph: "Put the kettle on", w: "340px" }), h("span", { class: "hint" }, "id"), inp(s, "id", { w: "120px", after: render }),
      h("span", { class: "grow" }), ...moveBtns(q.steps, j), delBtn("this step", () => { q.steps.splice(j, 1); })),
    row("Done when", trigEd(s, "done", { prefix: "" })),
    row("Fails when", trigEd(s, "fail", { prefix: "", optional: true })),
    row("", inp(s, "secs", { num: true, ph: "secs" }), h("span", { class: "hint" }, "to do it in"), chk(s, "hidden", "hidden (it counts, unseen)"),
      h("span", { class: "hint" }, "asked by"), sel(s, "who", pairs(ids("actor")), { blank: "—" })),
    g ? row("The wrong thing", isObj(s.wrong) ? h("span", { class: "row" }, h("span", { class: "hint" }, "she says"), inp(s.wrong, "say", { ph: "Nah, that's not what I want.", w: "280px" }),
      chk(s.wrong, "fail", "and the step fails"), h("button", { class: "ghost small", on: { click: () => { delete s.wrong; changed(); render(); } } }, icon("x", 12)))
      : h("button", { class: "small", on: { click: () => { s.wrong = { say: "Nah, that's not what I want." }; changed(); render(); } } }, icon("plus", 12), " an answer for anything else given")) : null);
}

// ---- people: their conversations and their states ---------------------------------------------------------------------------
function viewPeople() {
  const ps = people();
  if (!UI.person || !ps.includes(UI.person)) UI.person = ps[0] || null;
  const list = h("div", { class: "list" }, ps.map(p => h("div", { class: "item" + (p === UI.person ? " on" : ""), "data-person": p, on: { click: () => { UI.person = p; keepUI(); render(); } } },
    h("span", { class: "t" }, p), h("span", { class: "s" }, `${arr(S.talk[p]).length} talks`))));
  if (!ps.length) list.append(h("p", { class: "empty" }, "No characters in the scene yet (an HSActor)."));
  const p = UI.person;
  return [h("h2", {}, "People"), h("p", { class: "lead" }, "Clicking someone plays the first of her conversations whose condition holds (a once-only one goes when it's been heard out). Where she is and what she does are her states."),
    h("div", { class: "split" }, list, p ? personEd(p) : h("span", {}))];
}
function personEd(p) {
  const talks = S.talk[p] || [];
  const box = h("div", {});
  talks.forEach((t, i) => box.append(talkEd(p, talks, t, i)));
  box.append(h("button", { class: "small", "data-act": "new-talk", on: { click: () => { (S.talk[p] = S.talk[p] || []).push({ id: freshId(`t_${p}`, allIds()), lines: [{ text: "…" }] }); changed(); render(); } } }, icon("plus", 12), " Add a conversation"));
  const mine = S.states.map((st, i) => [st, i]).filter(([st]) => isObj(st.set) && st.set[p]);
  box.append(h("div", { class: "card" }, h("h3", {}, icon("spot", 16), "Her states"),
    mine.length ? mine.map(([st, i]) => h("div", { class: "row" }, h("span", { class: "hint" }, `${i + 1}. while`), condEd(st, "while", ""), h("span", {}, stateText(st.set[p])))) : h("p", { class: "empty" }, "None: she stays as the scene has her."),
    h("button", { class: "small", on: { click: () => { S.states.push({ while: [], set: { [p]: { do: "idle" } } }); UI.tab = "states"; changed(); render(); } } }, icon("plus", 12), " a state for her")));
  return box;
}
const stateText = v => (isObj(v) ? Object.entries(v).map(([k, x]) => `${k} ${Array.isArray(x) ? x.join(", ") : x}`).join(" · ") : "");
function talkEd(p, talks, t, i) {
  return h("div", { class: "card", "data-talk": t.id },
    h("h3", {}, icon("dialogue", 16), t.id, h("span", { class: "grow" }), ...moveBtns(talks, i), delBtn("this conversation", () => { talks.splice(i, 1); if (!talks.length) delete S.talk[p]; })),
    row("Id", inp(t, "id", { w: "160px", after: render }), chk(t, "once", "once only")),
    row("Offered", condEd(t, "if", "when")),
    h("div", {}, arr(t.lines).map((ln, j) => lineEd(p, t, ln, j))),
    h("button", { class: "small", on: { click: () => { listArr(t, "lines").push({ text: "" }); changed(); render(); } } }, icon("plus", 12), " Add a line"));
}
function lineEd(p, t, ln, j) {
  const who = [[p, p], ...ids("actor").filter(a => a !== p).map(a => [a, a]), ["player", "the player (a thought)"]];
  return h("div", { class: "card sub" },
    h("div", { class: "row" }, sel(ln, "who", who.slice(1), { blank: p }), inp(ln, "text", { ph: "what's said", w: "420px" }), h("span", { class: "grow" }), ...moveBtns(t.lines, j),
      h("button", { class: "ghost small", on: { click: () => { t.lines.splice(j, 1); changed(); render(); } } }, icon("x", 12))),
    row("Said", condEd(ln, "if", "only if")),
    row("As it starts", actions(ln, "do", "nothing")),
    arr(ln.answers).map((a, k) => h("div", { class: "row" }, h("span", { class: "hint" }, `Answer ${k + 1}`), inp(a, "label", { ph: "Yes", w: "120px" }), h("span", { class: "hint" }, "id"), inp(a, "id", { w: "90px" }),
      condEd(a, "if", "offered if"), h("span", { class: "hint" }, "sets"),
      h("input", { value: arr(a.sets).join(", "), placeholder: "promised, …", style: "width:140px", on: { change: e => { const v = e.target.value.split(",").map(x => x.trim()).filter(Boolean); if (v.length) a.sets = v; else delete a.sets; changed(); } } }),
      h("span", { class: "hint" }, "karma"), inp(a, "karma", { num: true }), h("span", { class: "hint" }, "her reply"),
      h("input", { value: arr(a.reply).join(" / "), placeholder: "Then go. / Quickly.", style: "width:220px", on: { change: e => { const r = e.target.value.split("/").map(x => x.trim()).filter(Boolean); if (r.length) a.reply = r; else delete a.reply; changed(); } } }),
      h("span", { class: "hint" }, "then"), sel(a, "go", goTargets().slice(1), { blank: "on" }),
      h("button", { class: "ghost small", on: { click: () => { ln.answers.splice(k, 1); if (!ln.answers.length) delete ln.answers; changed(); render(); } } }, icon("x", 12)))),
    arr(ln.answers).length < 2 ? h("button", { class: "ghost small", on: { click: () => { listArr(ln, "answers").push({ id: freshId("a", arr(ln.answers).map(x => x.id)), label: "" }); changed(); render(); } } }, icon("plus", 12), " an answer") : null);
}

// ---- moments ----------------------------------------------------------------------------------------------------------------
function viewMoments() {
  return [h("h2", {}, "Moments"), h("p", { class: "lead" }, "When something happens, if what's been done allows it, then: the scares, the thoughts, the sounds, the lights. Once a playthrough unless you say every time."),
    S.moments.map((m, i) => h("div", { class: "card", "data-moment": m.id },
      h("h3", {}, icon("event", 16), m.id, h("span", { class: "grow" }), ...moveBtns(S.moments, i), delBtn("this moment", () => { S.moments.splice(i, 1); })),
      row("Id", inp(m, "id", { w: "160px", after: render }), chk(m, "once", "once a playthrough", { dflt: true }), m.once === false ? h("span", { class: "row" }, h("span", { class: "hint" }, "every"), inp(m, "every", { num: true, ph: "1" }), h("span", { class: "hint" }, "s at most")) : null),
      row("When", trigEd(m, "when", { prefix: "" })),
      row("If", condEd(m, "if", "")),
      row("Only during", duringEd(m)),
      row("Then", actions(m, "do", "nothing yet")))),
    h("button", { class: "small", "data-act": "new-moment", on: { click: () => { S.moments.push({ id: freshId("moment", allIds()), when: null, do: [] }); changed(); render(); } } }, icon("plus", 12), " Add a moment")];
}
function duringEd(m) {
  const d = arr(m.during);
  return h("div", { class: "cond" }, d.length ? d.map((q, i) => h("span", { class: "chip" }, q, h("button", { class: "x", on: { click: () => { d.splice(i, 1); if (!d.length) delete m.during; changed(); render(); } } }, "×"))) : h("span", { class: "hint" }, "the whole game"),
    (() => { const pick = {}; return sel(pick, "x", S.quests.filter(q => !d.includes(q.id)).map(q => [q.id, q.title || q.id]), { blank: "+ a quest", after: () => { if (pick.x) { listArr(m, "during").push(pick.x); changed(); render(); } } }); })());
}

// ---- states ------------------------------------------------------------------------------------------------------------------
const DO = [["idle", "stands"], ["sit", "sits"], ["go", "walks to a spot"], ["path", "walks a path"], ["patrol", "patrols paths"], ["off", "isn't there"]];
function viewStates() {
  return [h("h2", {}, "States"), h("p", { class: "lead" }, "What the world looks like while something holds: who is where doing what, what's shown, locked or lit. Worked out again after every change and every load; a later state's settings over an earlier one's."),
    S.states.map((st, i) => h("div", { class: "card", "data-state": String(i) },
      h("h3", {}, icon("spot", 16), `State ${i + 1}`, h("span", { class: "grow" }), ...moveBtns(S.states, i), delBtn("this state", () => { S.states.splice(i, 1); })),
      row("While", condEd(st, "while", "")),
      Object.keys(st.set || {}).map(tg => setEd(st, tg)),
      row("", (() => { const pick = {}; return sel(pick, "x", targets().filter(t => !(st.set || {})[t]).map(t => [t, `${t} (${kindOf(t)})`]), { blank: "+ who or what",
        after: () => { if (pick.x) { (st.set = st.set || {})[pick.x] = kindOf(pick.x) === "person" ? { do: "idle" } : { shown: true }; changed(); render(); } } }); })())
    )),
    h("button", { class: "small", "data-act": "new-state", on: { click: () => { S.states.push({ while: [], set: {} }); changed(); render(); } } }, icon("plus", 12), " Add a state")];
}
function setEd(st, tg) {
  const v = st.set[tg], k = kindOf(tg), tri = (key, opts) => sel(v, key, opts, { blank: "—" });
  const bools = (key, yes, no) => { const o = { x: v[key] === undefined ? "" : v[key] ? "1" : "0" }; return sel(o, "x", [["1", yes], ["0", no]], { blank: "—", after: () => { if (o.x === undefined) delete v[key]; else v[key] = o.x === "1"; } }); };
  const kids = [];
  if (k === "person") kids.push(tri("do", DO), h("span", { class: "hint" }, "at"), tri("at", pairs(ids("spot"))), v.do === "go" ? [h("span", { class: "hint" }, "to"), tri("to", pairs(ids("spot")))] : null,
    v.do === "path" ? [h("span", { class: "hint" }, "path"), tri("path", pairs(ids("path")))] : null,
    v.do === "patrol" ? [h("span", { class: "hint" }, "paths"), h("input", { value: arr(v.paths).join(", "), placeholder: ids("path").join(", "), on: { change: e => { const a = e.target.value.split(",").map(x => x.trim()).filter(Boolean); if (a.length) v.paths = a; else delete v.paths; changed(); } } })] : null,
    h("span", { class: "hint" }, "watching"), bools("sees", "watches for the player", "doesn't"), h("span", { class: "hint" }, "motion"), tri("motion", pairs(ids("motion"))),
    h("span", { class: "hint" }, "seen"), bools("shown", "shown", "hidden"));
  else if (k === "door") kids.push(bools("locked", "locked", "unlocked"), bools("open", "open", "shut"));
  else if (k === "light") kids.push(tri("light", [["on", "on"], ["off", "off"], ["flicker", "flickering"], ["dim", "dim"]]));
  else if (k === "life") kids.push(h("span", { class: "hint" }, "its state"), tri("state", pairs(P.lives[lifeOf(tg)] || [])), bools("shown", "shown", "hidden"));
  else kids.push(bools("shown", "shown", "hidden"));
  return row(tg, ...kids.flat().filter(Boolean), h("button", { class: "ghost small", on: { click: () => { delete st.set[tg]; changed(); render(); } } }, icon("x", 12)));
}

// ---- endings, facts, achievements --------------------------------------------------------------------------------------------
function viewEndings() {
  return [h("h2", {}, "Endings"), h("p", { class: "lead" }, "Where a way through the story stops: its card's title and words. A death offers a retry from the last checkpoint."),
    S.endings.map((e, i) => h("div", { class: "card", "data-ending": e.id }, h("h3", {}, icon("ending", 16), e.title || e.id, h("span", { class: "grow" }), ...moveBtns(S.endings, i), delBtn("this ending", () => { S.endings.splice(i, 1); })),
      row("Id", inp(e, "id", { w: "160px", after: render }), sel(e, "kind", [["good", "good"], ["bad", "bad"], ["neutral", "neutral"], ["secret", "secret"], ["death", "death (a retry)"]], { blank: null })),
      row("Title", inp(e, "title", { ph: "Morning", w: "320px" })), row("Words", inp(e, "text", { area: true, ph: "what its card says under the title" })))),
    h("button", { class: "small", "data-act": "new-ending", on: { click: () => { S.endings.push({ id: freshId("e", allIds()), kind: "good", title: "", text: "" }); changed(); render(); } } }, icon("plus", 12), " Add an ending")];
}
function viewFacts() {
  return [h("h2", {}, "Facts"), h("p", { class: "lead" }, "What the conditions ask about, where each comes from and where it's asked. The game writes most of them as the player plays; name your own here (a hidden tracker for an achievement, say)."),
    h("table", { class: "cov" }, h("tr", {}, h("th", {}, "Fact"), h("th", {}, "Asked in"), h("th", {}, "Set by"), h("th", {}, "About"), h("th", {}, "Hidden")),
      cov.facts.map(f => { const d = S.facts[f.name] || {};
        return h("tr", { "data-fact": f.name }, h("td", {}, f.name), h("td", { class: "hint" }, f.read.join("; ") || "—"), h("td", { class: f.set.length ? "hint" : "sev-warn" }, f.set.join("; ") || "nothing yet"),
          h("td", {}, h("input", { value: d.about || "", style: "width:220px", on: { change: e => { (S.facts[f.name] = S.facts[f.name] || {}).about = e.target.value; changed(); } } })),
          h("td", {}, h("input", { type: "checkbox", checked: d.hidden ? true : null, on: { change: e => { (S.facts[f.name] = S.facts[f.name] || {}).hidden = e.target.checked; changed(); } } }))); })),
    h("button", { class: "small", style: "margin-top:10px", on: { click: async () => { const d = { name: "", about: "" }; const body = h("div", {}, row("Name", inp(d, "name", { ph: "cups_poured" })), row("About", inp(d, "about", { w: "260px" })));
      if (await modal({ title: "Name a fact", body }) && d.name) { S.facts[d.name] = { about: d.about || "" }; changed(); render(); } } } }, icon("plus", 12), " Name a fact")];
}
function viewAchievements() {
  return [h("h2", {}, "Achievements"), h("p", { class: "lead" }, "Each unlocked when its condition holds (the game keeps achievement:<id> as a fact). The id is the Steam API name; Steam itself comes later."),
    S.achievements.map((a, i) => h("div", { class: "card", "data-achievement": a.id }, h("h3", {}, a.title || a.id, h("span", { class: "grow" }), delBtn("this achievement", () => { S.achievements.splice(i, 1); })),
      row("Id", inp(a, "id", { w: "200px", ph: "ACH_GOOD_HOST", after: render }), chk(a, "hidden", "hidden until unlocked")),
      row("Title", inp(a, "title", { w: "260px" })), row("Hint", inp(a, "text", { w: "420px", ph: "doesn't spoil it" })), row("When", condEd(a, "when", "")))),
    h("button", { class: "small", on: { click: () => { S.achievements.push({ id: freshId("ACH", allIds()), title: "", text: "", when: [] }); changed(); render(); } } }, icon("plus", 12), " Add an achievement")];
}

// ---- coverage and saves ---------------------------------------------------------------------------------------------------------
function viewCoverage() {
  const KN = { actor: "Characters", thing: "Things", door: "Doors", area: "Areas", room: "Rooms", item: "Items", note: "Notes", spot: "Spots", path: "Paths", light: "Lights", life: "Little things" };
  return [h("h2", {}, "Coverage"), h("p", { class: "lead" }, "What's wrong, what the story names that the scene hasn't got, and what the scene has that the story never names (yet)."),
    h("div", { class: "card" }, h("h3", {}, "To fix and to look at"), cov.problems.length ? h("table", { class: "cov" }, cov.problems.map(p => h("tr", {}, h("td", { class: "sev-" + p.sev }, p.sev === "error" ? "✕" : "⚠"), h("td", {}, p.text))))
      : h("p", { class: "ok" }, "Nothing wrong found.")),
    h("div", { class: "card", "data-cov": "unused" }, h("h3", {}, "In the scene, not in the story"),
      h("div", { class: "kinds" }, Object.entries(cov.unused).filter(([, l]) => l.length).map(([k, l]) => h("div", { class: "card sub", "data-kind": k }, h("h3", {}, `${KN[k] || k} (${l.length})`), l.map(v => h("span", { class: "chip" }, v))))),
      Object.values(cov.unused).every(l => !l.length) ? h("p", { class: "ok" }, "Everything in the scene is in the story.") : null)];
}
function viewSaves() {
  const sv = P.saves || { slots: [] }, np = { from: (sv.next_play || {}).from || "", flags: arr((sv.next_play || {}).flags).join(", ") };
  const when = t => (t ? new Date(t * 1000).toLocaleString() : "");
  return [h("h2", {}, "Saves"), h("p", { class: "lead" }, `The game's saves (${P.user}). A new game always starts from nothing; delete a save to clear it.`),
    h("div", { class: "card" }, h("h3", {}, "Saved games"), sv.slots.length ? h("table", { class: "cov" }, h("tr", {}, h("th", {}, "Slot"), h("th", {}, "Where"), h("th", {}, "When"), h("th", {})),
      sv.slots.map(s => h("tr", {}, h("td", {}, s.slot), h("td", {}, s.where), h("td", { class: "hint" }, when(s.at)),
        h("td", {}, h("button", { class: "small danger", on: { click: async () => { const r = await api("delete_save", { file: s.file, slot: s.slot }); P.saves = r.saves; render(); } } }, "Delete")))))
      : h("p", { class: "empty" }, "No saves yet."),
      sv.slots.length ? h("button", { class: "small danger", on: { click: async () => { if (await modal({ title: "Delete every save?", body: h("p", {}, "The next game starts from nothing."), ok: "Delete" })) { for (const f of uniq(sv.slots.map(s => s.file))) await api("delete_save", { file: f }); load(); } } } }, "Delete every save") : null),
    h("div", { class: "card" }, h("h3", {}, "The next play starts at"),
      row("Quest", sel(np, "from", S.quests.map(q => [q.id, q.title || q.id]), { blank: "the start" })),
      row("With the facts", h("input", { value: np.flags, placeholder: "read:letter, picked:bedroom_key", style: "width:360px", on: { change: e => { np.flags = e.target.value; } } })),
      h("div", { class: "row" }, h("button", { class: "small", on: { click: async () => { const r = await api("next_play", { from: np.from, flags: np.flags.split(",").map(x => x.trim()).filter(Boolean) }); P.saves = r.saves; toast(np.from ? "The next F5 starts at " + np.from : "The next F5 starts at the start"); render(); } } }, "Set"),
        h("span", { class: "hint" }, sv.next_play ? `Set: ${sv.next_play.from} (${arr(sv.next_play.flags).length} facts)` : "Not set: F5 starts at the start.")))];
}

// ---- the header, the keys, the file changing under it -------------------------------------------------------------------------------------
$("save").addEventListener("click", save);
$("reload").addEventListener("click", async () => { if (!dirty || await modal({ title: "Reload?", body: h("p", {}, "Your unsaved changes go."), ok: "Reload" })) load(); });
$("probs").addEventListener("click", () => { UI.tab = "coverage"; keepUI(); render(); });
document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); } });
addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
setInterval(async () => {                                  // written by someone else (Claude, a second page): taken in when there's nothing unsaved
  if (!P) return;
  const r = await api("stamp").catch(() => null);
  if (r && r.stamp && r.stamp !== stamp) { if (!dirty) { await load(); toast("director/director.json changed on disk: taken in"); } else { stamp = r.stamp; toast("director/director.json changed on disk: Reload to take it in (your unsaved changes go)"); } }
}, 3000);
window.hsdm = { get S() { return S; }, get P() { return P; }, get cov() { return cov; }, save, load, render };
load();

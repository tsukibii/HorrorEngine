// The Database, after RPG Maker's: the game's own tables as tabs (the game's settings, the cast, items, notes, sounds,
// lines, motions, flags and counters, secrets, trigger cutscenes), each a list on the left and the chosen entry's form
// on the right, with every place the story uses it (refs.js): click one to go there. A new entry gets its id once,
// checked against the whole file; a rename moves every use with it. Nothing is typed as JSON.
//   new Database(host, D).render(): D is the desk (app.js): the story, touch() after an edit, the pickers' lists.
import { h, modal, triggerPill, sortable, grip } from "./ui.js";
import { icon } from "./icons.js";
import { KINDS, usesOf, flagsOf, renameRef, allIds, ID_RE, placeOf, tableOf } from "./refs.js";
import { shelf, shelfName, pickShelf, preview } from "./sfx.js";

const TABS = [
  { id: "game", label: "Game", icon: "gear", hint: "The game's own settings: its length, the player's lens, the language of the takes, where it starts." },
  { id: "cast", label: "Cast", icon: "person", kind: "cast", noun: "cast member", name: "name",
    hint: "The people in the game. Their lines, motions, stages and trackers name them by id; each has a body for the desk." },
  { id: "items", label: "Items", icon: "item", kind: "item", noun: "item", name: "name",
    hint: "What the player picks up and carries: a key, a doll. A level places one as a pickup; a door can be locked by one." },
  { id: "notes", label: "Notes", icon: "note", kind: "note", noun: "note", name: "title",
    hint: "Letters, diary pages, signs: what the player reads. A level places one with use: note." },
  { id: "sounds", label: "Sounds", icon: "sound", kind: "sound", noun: "sound",
    hint: "Sound effects by name: one off the Studio's CC0 sound shelf (sfx/<name>, heard in Play and the Watch), or the game's own file in its Audio folder in Unreal." },
  { id: "lines", label: "Lines", icon: "say", kind: "line", noun: "line", name: "en", nameLabel: "English",
    hint: "Voice outside the scenes: barks in play, a whisper, a line a command says. Each is one take, named by its id." },
  { id: "motions", label: "Motions", icon: "motion", kind: "motion", noun: "motion",
    hint: "Body animations used again and again: idles, walks, searches. The Kimodo shot list makes them." },
  { id: "state", label: "Flags & counters", icon: "flag",
    hint: "Flags are named facts (a command sets one, a beat or a choice waits for it); counters count; karma axes measure how the player treats someone." },
  { id: "secrets", label: "Secrets", icon: "eye", kind: "secret", noun: "secret", name: "hint",
    hint: "Easter eggs: a flag the player sets by finding something, and the hint the branch map shows." },
  { id: "interrupts", label: "Trigger cutscenes", icon: "trick", noun: "trigger cutscene", name: "label",
    hint: "Something the player does during a task jumps the flow to a scene, as in Alien Isolation: taking the doll, being caught." },
];
const TAB = Object.fromEntries(TABS.map(t => [t.id, t]));
const THEMES = ["glass", "glass-rose", "neumorph", "plain"];
const SHAPE_START = { box: "0.1 0.1 0.1", cyl: "0.05 0.1", sphere: "0.05", plane: "0.2 0.3", stairs: "1 3 2.6", asset: "", person: "" };
const SHAPES = { box: ["width", "depth", "height"], cyl: ["radius", "height"], sphere: ["radius"], plane: ["width", "height"], stairs: ["width", "depth", "height"],
  asset: ["library ref", "scale"], person: ["cast member", "pose"] };
const LANGS = ["en", "zh", "ko", "es", "pt", "fr", "de", "ru", "id", "th", "vi"];
const slug = s => String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "n$1").slice(0, 32);
const clone = o => JSON.parse(JSON.stringify(o));
const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };

export class Database {
  constructor(host, D) { this.host = host; this.D = D; this.tab = store.get("dd.dbTab", "game"); if (!TAB[this.tab]) this.tab = "game"; this.pick = {}; this.q = {}; }
  get S() { return this.D.story(); }
  open(tab, id) { if (TAB[tab]) this.tab = tab; if (id !== undefined) this.pick[this.tab] = id; this.render(); }
  changed(world) { this.D.touch(world); this.renderList(); }
  retitle(t) { const e = this.formBox && this.formBox.querySelector(".db-head h3"); if (e) e.textContent = t; }   // a name changed: the form keeps its focus
  render() {
    const S = this.S; this.host.innerHTML = ""; if (!S) return;
    store.set("dd.dbTab", this.tab);
    const tabs = h("div", { class: "db-tabs" }, h("div", { class: "db-title" }, icon("data", 16), " Database"));
    for (const t of TABS) {
      const n = this.count(t.id);
      tabs.append(h("button", { class: "db-tab" + (t.id === this.tab ? " on" : ""), title: t.hint, on: { click: () => this.open(t.id) } },
        icon(t.icon, 15), h("span", {}, t.label), n === null ? null : h("span", { class: "n" }, n)));
    }
    this.listBox = h("div", { class: "db-list" }); this.formBox = h("div", { class: "db-form" });
    this.host.append(h("div", { class: "db" + (this.tab === "game" ? " nolist" : "") }, tabs, this.listBox, this.formBox));
    this.renderList(); this.renderForm();
  }
  count(tab) {
    const S = this.S, t = TAB[tab];
    if (tab === "game") return null;
    if (tab === "state") return Object.keys(flagsOf(S)).length + Object.keys(S.game.counters || {}).length + Object.keys(this.axes()).length;
    if (tab === "interrupts") return (S.interrupts || []).length;
    return Object.keys(tableOf(S, t.kind) || {}).length;
  }
  axes() { return ((this.S.game.karma || {}).axes) || { karma: { min: -10, max: 10 } }; }

  /* ---- the list ---- */
  entries() {
    const S = this.S, D = this.D, cast = id => ((S.cast || {})[id] || {}).name || id;
    switch (this.tab) {
      case "cast": return Object.entries(S.cast || {}).map(([id, c]) => ({ id, label: c.name || id, sub: id, dot: D.whoColor(id), pic: D.pic ? () => D.pic("cast", id, "face") : null }));
      case "items": return Object.entries(S.items || {}).map(([id, v]) => ({ id, label: v.name || id, sub: id }));
      case "notes": return Object.entries(S.notes || {}).map(([id, v]) => ({ id, label: v.title || id, sub: id }));
      case "sounds": return Object.entries(S.sounds || {}).map(([id, v]) => ({ id, label: id, sub: v.file || "" }));
      case "lines": return Object.entries(S.lines || {}).map(([id, v]) => ({ id, label: v.en || v.ja || "(empty)", sub: `${id} · ${v.who === "player" ? "you" : cast(v.who)}`, dot: D.whoColor(v.who), take: !!D.takes()[id] }));
      case "motions": return Object.entries(S.motions || {}).map(([id, v]) => ({ id, label: id, sub: `${v.who ? cast(v.who) : "anyone"} · ${v.secs || "?"} s${v.loop ? " · loop" : ""}`, pic: D.pic ? () => D.pic("table", id, "mot") : null }));
      case "secrets": return Object.entries(S.secrets || {}).map(([id, v]) => ({ id, label: v.hint || id, sub: `${id} · flag ${v.flag || "…"}` }));
      case "interrupts": return (S.interrupts || []).map((it, i) => ({ id: it.id || String(i), label: it.label || it.id || "(no label)", sub: it.id || "" }));
      case "state": {
        const fl = flagsOf(S), ax = this.axes();
        return [{ group: "Flags" }, ...Object.keys(fl).sort().map(f => ({ id: "flag:" + f, label: f, sub: `${fl[f]} use${fl[f] > 1 ? "s" : ""}`, ic: "flag" })),
          { group: "Counters" }, ...Object.entries(S.game.counters || {}).map(([id, c]) => ({ id: "counter:" + id, label: c.label || id, sub: id, ic: "count" })),
          { group: "Karma axes" }, ...Object.entries(ax).map(([id, a]) => ({ id: "axis:" + id, label: a.label || id, sub: `${id} · ${a.min ?? -10}..${a.max ?? 10}${(S.game.karma || {}).axes ? "" : " (the default)"}`, ic: "heart" }))];
      }
    }
    return [];
  }
  renderList() {
    const box = this.listBox; if (!box) return; box.innerHTML = ""; if (this.tab === "game") return;
    const t = TAB[this.tab], all = this.entries(), q = (this.q[this.tab] || "").toLowerCase();
    const search = h("input", { class: "db-search", placeholder: "Search…", value: this.q[this.tab] || "", on: { input: e => { this.q[this.tab] = e.target.value; this.renderList(); const s = this.listBox.querySelector(".db-search"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); } } });
    const items = h("div", { class: "db-items" });
    if (!all.some(x => !x.group && x.id === this.pick[this.tab]) && all.some(x => !x.group)) this.pick[this.tab] = all.find(x => !x.group).id;   // gone (deleted, undone): the first
    for (const x of all) {
      if (x.group) { items.append(h("div", { class: "db-group" }, x.group)); continue; }
      if (q && !(x.label + " " + x.sub).toLowerCase().includes(q)) continue;
      const row = h("div", { class: "db-item" + (x.id === this.pick[this.tab] ? " on" : ""), title: x.sub, on: { click: () => { this.pick[this.tab] = x.id; this.renderList(); this.renderForm(); } } },
        x.pic ? x.pic() : x.dot ? h("span", { class: "dot", style: `background:${x.dot}` }) : x.ic ? icon(x.ic, 13) : null,
        h("span", { class: "db-l" }, h("span", { class: "t" }, x.label), h("span", { class: "sub" }, x.sub)), x.take ? h("span", { class: "lchip ok", title: "its take is in Footage" }, "take") : null);
      if (this.tab === "interrupts") { const i = (this.S.interrupts || []).findIndex((it, j) => (it.id || String(j)) === x.id); row.prepend(grip(row, this.S.interrupts, i, "interrupt")); }
      items.append(row);
    }
    if (!all.some(x => !x.group)) items.append(h("div", { class: "db-none" }, `No ${t.label.toLowerCase()} yet.`));
    if (this.tab === "interrupts" && this.S.interrupts) sortable(items, this.S.interrupts, "interrupt", { changed: () => this.D.touch(), rerender: () => this.renderList() }, ".db-item");
    const add = this.tab === "state"
      ? h("div", { class: "db-adds" }, h("button", { on: { click: () => this.newCounter() } }, icon("plus", 13), " Counter"), h("button", { on: { click: () => this.newAxis() } }, icon("plus", 13), " Karma axis"))
      : h("button", { class: "db-new", on: { click: () => this.newEntry() } }, icon("plus", 14), ` New ${t.noun}`);
    box.append(search, items, add);
  }

  /* ---- the form ---- */
  renderForm() {
    const box = this.formBox; box.innerHTML = ""; const S = this.S, t = TAB[this.tab];
    box.append(h("p", { class: "hint" }, t.hint));
    if (this.tab === "game") { box.append(this.gameForm()); return; }
    const id = this.pick[this.tab];
    if (this.tab === "state") { if (id) box.append(this.stateForm(id)); else box.append(h("div", { class: "db-empty" }, "Pick a flag, a counter or a karma axis.")); return; }
    if (this.tab === "interrupts") { const it = (S.interrupts || []).find((x, j) => (x.id || String(j)) === id); if (it) box.append(this.interruptForm(it)); else box.append(this.empty(t)); return; }
    const table = tableOf(S, t.kind) || {}, e = table[id];
    if (!e) { box.append(this.empty(t)); return; }
    box.append(this.head(t, id, e), this[t.id + "Form"](e, id), this.uses(t.kind, id));
  }
  empty(t) { return h("div", { class: "db-empty" }, h("div", {}, `No ${t.noun} chosen.`), h("button", { class: "primary", on: { click: () => this.newEntry() } }, icon("plus", 14), ` New ${t.noun}`)); }
  head(t, id, e, { kind = t.kind, label, rename = true, del = true, dup = true, ic = t.icon } = {}) {
    return h("div", { class: "db-head" }, h("span", { class: "db-ic" }, icon(ic, 18)), h("h3", {}, label || (t.name && e[t.name]) || id), h("span", { class: "db-id", title: "its id: what the story names it by" }, id),
      h("span", { class: "grow" }),
      rename ? h("button", { title: "a new id, changed everywhere the story uses it", on: { click: () => this.rename(kind, id) } }, icon("edit", 13), " Rename") : null,
      dup ? h("button", { title: "a copy under a new id", on: { click: () => this.duplicate(id) } }, icon("copy", 13), " Duplicate") : null,
      del ? h("button", { class: "danger", on: { click: () => this.remove(kind, id) } }, icon("x", 13), " Delete") : null);
  }
  // where the story uses it: one row a place, clicked to go there
  uses(kind, id) {
    const S = this.S, list = usesOf(S, kind, id), box = h("div", { class: "db-uses" });
    const rows = new Map();
    for (const r of list) {
      const p = placeOf(S, r.path), what = kind === "flag" ? flagUse(r) : "", key = p.text + "|" + what;
      if (rows.has(key)) rows.get(key).n++; else rows.set(key, { p, what, n: 1 });
    }
    for (const { p, what, n } of rows.values()) box.append(h("div", { class: "db-use", title: p.node ? "open it on the board" : p.level ? "open the level in the scene builder" : "", on: { click: () => this.go(p) } },
      icon(p.node ? (S.flow[p.node] || {}).type === "stitch" ? "task" : (S.flow[p.node] || {}).type === "scene" ? "scene" : "flow" : p.level ? "build" : (TAB[p.db] || {}).icon || "data", 13), h("span", { class: "grow" }, p.text),
      what ? h("span", { class: "lchip" }, what) : null, n > 1 ? h("span", { class: "muted" }, "×" + n) : null));
    return h("div", {}, h("div", { class: "db-sec" }, list.length ? `Used in ${rows.size} place${rows.size > 1 ? "s" : ""}` : "Used nowhere yet"),
      list.length ? box : h("p", { class: "muted" }, "Nothing in the story names it yet."));
  }
  go(p) { if (p.node) this.D.goNode(p.node); else if (p.level) this.D.goLevel(p.level); else if (p.db) this.open(p.db, p.id); }

  /* ---- the fields: each writes straight into the story (Ctrl+Z undoes it) ---- */
  f(obj, key, o = {}) {           // a text or number input; empty drops the key
    const i = h(o.long ? "textarea" : "input", { value: o.long ? null : obj[key] ?? "", placeholder: o.ph || "", class: o.num ? "num" : "", rows: o.long ? o.rows || 3 : null, on: { change: e => {
      const v = o.long ? e.target.value : e.target.value.trim(), t = o.into ? o.into() : obj;
      if (v === "") { if (o.nullable) t[key] = null; else delete t[key]; } else t[key] = o.num ? +v : v;
      this.changed(o.world); o.after && o.after(); } } });
    if (o.long) i.value = obj[key] ?? "";
    if (o.num) { i.type = "number"; i.step = o.step || "any"; if (o.min !== undefined) i.min = o.min; if (o.max !== undefined) i.max = o.max; }
    return i;
  }
  sel(obj, key, choices, o = {}) {
    const s = h("select", { on: { change: e => { const v = e.target.value; if (v === "") { if (o.nullable) obj[key] = null; else delete obj[key]; } else obj[key] = v; this.changed(o.world); o.after && o.after(); } } });
    if (o.blank !== false) s.append(h("option", { value: "" }, o.blank || "—"));
    let found = false;
    for (const c of choices) { const [v, l] = Array.isArray(c) ? c : [c, c]; const op = h("option", { value: v }, l); if (obj[key] === v) { op.selected = true; found = true; } s.append(op); }
    if (obj[key] && !found) s.append(h("option", { value: obj[key], selected: true }, obj[key] + " (not found)"));
    return s;
  }
  chk(obj, key, label, o = {}) {
    const on = o.on === undefined ? true : o.on, cur = o.on === undefined ? !!obj[key] : obj[key] === o.on;
    return h("label", { class: "chk" }, h("input", { type: "checkbox", checked: cur, on: { change: e => { if (e.target.checked) obj[key] = on; else if (o.off !== undefined) obj[key] = o.off; else delete obj[key]; this.changed(o.world); o.after && o.after(); } } }), " " + label);
  }
  row(label, ...kids) { return h("label", { class: "frm-r" }, h("span", { class: "frm-l" }, label), h("span", { class: "rowi" }, ...kids)); }
  sec(t) { return h("div", { class: "db-sec" }, t); }

  /* ---- the game ---- */
  gameForm() {
    const S = this.S, g = S.game, D = this.D, v3 = (S.format || 2) >= 3;
    const subs = h("input", { value: (g.subtitles || []).join(", "), placeholder: "en", title: "the subtitle languages, in order: " + LANGS.join(", "), on: { change: e => {
      const l = e.target.value.split(/[\s,]+/).filter(Boolean); if (l.length) g.subtitles = l; else delete g.subtitles; this.changed(); } } });
    return h("div", { class: "frm" },
      h("div", { class: "db-head" }, h("span", { class: "db-ic" }, icon("gear", 18)), h("h3", {}, g.title || D.game()), h("span", { class: "db-id" }, D.game()), h("span", { class: "muted" }, `format ${S.format || 2}`)),
      this.sec("The game"),
      this.row("Title", this.f(g, "title", { after: () => this.retitle(g.title || D.game()) })),
      this.row("Playtime", "typical ≥", this.f(g, "target_min", { num: true, ph: "150" }), "min · fast player ≥", this.f(g, "fast_min", { num: true, ph: "120" }), "min"),
      h("p", { class: "hint tight" }, "Cutscenes can't be skipped; tasks can be done fast. Steam refunds under 2 hours, so the fastest normal path must stay over the fast minimum."),
      this.row("Starts at", this.sel(g, "start", D.nodes(), { blank: false }), this.sel(g, "time", D.times.map(t => [t, D.timeMark[t] + " " + t]), { blank: `${D.timeMark[D.timeDefault]} ${D.timeDefault} (when unset)`, after: () => D.redraw() })),
      v3 ? this.row("Deaths", this.chk(g, "no_death", "no deaths: an ending only from a karma choice or a final node", { on: true, off: undefined })) : null,
      this.sec("The player"),
      this.row("Lens", this.f(g, "fov", { num: true, ph: "90" }), "° across (the one lens; never on a clip)"),
      this.row("HUD theme", this.sel(g, "ui_theme", THEMES, { blank: "glass (when unset)" })),
      this.row("Hiding places", this.f(g, "see_through", { num: true, step: "0.05", min: 0, max: 1, ph: "0.3" }), "of a locker's slats are gaps (0..1), when the locker doesn't say"),
      this.sec("Takes and languages"),
      this.row("A take", "≤", this.f(g, "clip_max", { num: true, ph: v3 ? "8" : "10" }), "s (one MiniMax clip)"),
      this.row("Spoken in", this.f(g, "voice", { ph: "ja" }), "subtitled in", this.f(g, "text", { ph: "en" })),
      v3 ? this.row("Subtitles", subs) : null,
      this.sec("Bodies in the desk"),
      this.row("Default body", this.sel(g, "previs_body", D.bodies(), { blank: D.bodies().length > 1 ? "first file in Bodies" : "capsule figure", after: () => D.afterBody() })),
      h("p", { class: "hint tight" }, D.bodies().length > 1 ? "Content/Studio/Bodies holds: " + D.bodies().slice(1).map(b => Array.isArray(b) ? b[1] : b).join(", ") + ". A Character Studio character's Export for desk / Unreal shows here too, for a cast member." : "Drop a rigged human (.fbx or .glb) into Content/Studio/Bodies, or export a character from the Character Studio, and reload."));
  }

  // a cast member's other looks (STORY_FORMAT §2 `models`): named variants, each a body, the body above the default; a
  // scene picks one (its Models picker in Setting the scene) and every scene after it wears it until one picks another
  modelsEditor(c, id) {
    const D = this.D, ms = c.models || {}, box = h("span", { class: "db-models" });
    const picks = fn => { for (const sc of Object.values(this.S.scenes || {})) if (sc.models && id in sc.models) fn(sc); };
    for (const k of Object.keys(ms)) {
      const name = h("input", { value: k, style: "width:110px", title: "its name, as scenes pick it", on: { change: e => {
        const v = e.target.value.trim(); if (!v || v === "default" || (v !== k && v in ms)) { e.target.value = k; return; }
        c.models = Object.fromEntries(Object.entries(ms).map(([x, f]) => [x === k ? v : x, f])); picks(sc => { if (sc.models[id] === k) sc.models[id] = v; });   // the scenes that pick it follow
        this.changed(); this.renderForm(); } } });
      box.append(h("span", { class: "db-model" }, name, this.sel(ms, k, D.bodies(), { blank: false, after: () => D.afterBody() }),
        h("button", { class: "ghost", title: "take it out (the scenes that pick it carry on as the flow brings them)", on: { click: e => { e.preventDefault();
          delete ms[k]; if (!Object.keys(ms).length) delete c.models; picks(sc => { if (sc.models[id] === k) { delete sc.models[id]; if (!Object.keys(sc.models).length) delete sc.models; } });
          this.changed(); this.renderForm(); D.afterBody(); } } }, icon("x", 13))));
    }
    box.append(h("button", { class: "small", title: "another look of theirs (lilac eyes, wet, hurt...): a body each, picked per scene", on: { click: e => { e.preventDefault();
      let n = 1; while (("look " + n) in ms) n++;
      (c.models = c.models || {})["look " + n] = c.previs_body || D.bodies().map(b => (Array.isArray(b) ? b[0] : b)).find(f => f !== "capsules") || "capsules";
      this.changed(); this.renderForm(); D.afterBody(); } } }, icon("plus", 13), " Add a model"));
    return box;
  }

  /* ---- each table's form ---- */
  castForm(c, id) {
    const D = this.D, m = c.measures;
    return h("div", { class: "frm" },
      D.pic ? h("div", { class: "db-portrait" }, D.pic("cast", id, "portrait"), h("p", { class: "hint" }, "their desk body, as the player meets them: the body below, the height, the skin tone and the shape all show here")) : null,
      this.row("Name", this.f(c, "name", { after: () => this.retitle(c.name || id) })),
      (this.S.format || 2) >= 3 ? this.row("Subject", this.sel(c, "subject", [["she", "she"], ["he", "he"]], { blank: "—" }), h("span", { class: "muted" }, "for the MiniMax prompts")) : null,
      this.row("Height", this.f(c, "height", { num: true, step: "0.01", world: true }), "m"),
      this.row("Body in the desk", this.sel(c, "previs_body", D.bodies(), { blank: "the game's default", after: () => D.afterBody() })),
      this.row("Models", this.modelsEditor(c, id)),
      this.row("Skin", h("input", { type: "color", value: c.skin || "#c8a089", on: { change: e => { c.skin = e.target.value; this.changed(); } } }),
        c.skin ? h("button", { class: "ghost", title: "no skin tone", on: { click: () => { delete c.skin; this.changed(); this.renderForm(); } } }, icon("x", 13)) : h("span", { class: "muted" }, "not set")),
      this.row("Shape", h("span", { class: "muted" }, c.shape ? `${c.shape.length} identity numbers` + (m ? ` · ${m.height || "?"} cm, waist ${m.waist || "?"}, hips ${m.hips || "?"}` : "") : "the average body"),
        h("a", { href: D.page("shape.html"), target: "_blank" }, h("button", {}, "Shape the body ↗"))),
      this.row("MetaHuman", this.f(c, "metahuman", { ph: "the MetaHuman Blueprint's path (later)", nullable: true })));
  }
  itemsForm(it, id) {
    const parts = String(it.shape || "").split(/\s+/).filter(Boolean), kind = SHAPES[parts[0]] ? parts[0] : "box", args = parts.slice(1);
    const nums = h("span", { class: "rowi" });
    const write = () => { const vals = [...nums.querySelectorAll("input,select")].map(x => x.value.trim()); it.shape = [kindSel.value, ...vals].join(" ").trim(); this.changed(true); };
    const draw = k => {
      nums.innerHTML = "";
      SHAPES[k].forEach((lab, i) => {
        if (k === "person" && i === 0) { const s = h("select", { on: { change: write } }); for (const [cid, c] of Object.entries(this.S.cast || {})) s.append(h("option", { value: cid, selected: args[0] === cid }, c.name || cid)); nums.append(s); return; }
        nums.append(h("input", { value: args[i] ?? "", placeholder: lab, title: lab + (["radius", "width", "depth", "height"].includes(lab) ? " (m)" : ""), class: k === "asset" && i === 0 ? "" : "num", on: { change: write } }));
      });
    };
    const kindSel = h("select", { on: { change: e => { const k = e.target.value; args.length = 0; args.push(...(k === "person" ? [Object.keys(this.S.cast || {})[0] || "", "stand"] : SHAPE_START[k].split(" ").filter(Boolean))); draw(k); write(); } } },
      Object.keys(SHAPES).map(k => h("option", { value: k, selected: k === kind }, k)));
    draw(kind);
    return h("div", { class: "frm" },
      this.row("Name", this.f(it, "name", { after: () => this.retitle(it.name || id) })),
      this.row("Shape", kindSel, nums), h("p", { class: "hint tight" }, "metres; asset is a CC0 library mesh at its real size (cc0.py props)"),
      this.row("Inspect", this.chk(it, "inspect", "turned over in the hand when picked up")),
      this.row("Flashlight", this.chk(it, "torch", "F lights the way once the player has it (it goes in the pocket, not the row)")));
  }
  notesForm(n, id) {
    return h("div", { class: "frm" }, this.row("Title", this.f(n, "title", { after: () => this.retitle(n.title || id) })), this.row("Text", this.f(n, "text", { long: true, rows: 7 })),
      h("div", { class: "paper" }, h("div", { class: "pt" }, n.title || ""), h("div", {}, n.text || "")));
  }
  soundsForm(s) {
    const name = shelfName(s.file), info = h("span", { class: "muted" });
    if (name) shelf().then(all => { const x = all[name]; info.textContent = x ? `${x.category} · ${x.secs.toFixed(1)} s${x.loop ? " · loop" : ""} · ${x.tags.join(", ")}` : "not on the shelf"; });
    return h("div", { class: "frm" },
      this.row("File", this.f(s, "file", { ph: "sfx/door_slam_01", after: () => { this.renderList(); this.renderForm(); } }),
        name ? h("button", { title: "hear it", on: { click: e => { e.preventDefault(); preview(name); } } }, icon("play", 13)) : null),
      this.row("Shelf", h("button", { on: { click: async e => { e.preventDefault(); const n = await pickShelf(name); if (n) { s.file = "sfx/" + n; this.changed(); this.renderForm(); } } } }, icon("sound", 14), " From the shelf…"), info),
      h("p", { class: "hint tight" }, "sfx/<name> plays a CC0 sound off the Studio's shelf (Content/Studio/SFX; python tools/sfx.py list) in Play and the Watch. Anything else is the game's own file under its Audio folder in Unreal (/Game/Games/<Game>/Audio)."));
  }
  linesForm(ln, id) {
    const S = this.S, D = this.D, subs = (S.game.subtitles || ["en"]).filter(x => x !== "en"), t = D.takes()[id], v3 = (S.format || 2) >= 3;
    const who = [["player", "the player"], ...Object.entries(S.cast || {}).map(([k, c]) => [k, c.name || k])];
    const drop = h("div", { class: "dropzone", title: "or click to pick the file", on: {
      click: () => { const i = h("input", { type: "file", accept: "video/*,audio/*" }); i.onchange = async () => { if (i.files[0]) { await D.dropTake(i.files[0], id); this.renderForm(); this.renderList(); } }; i.click(); },
      dragover: e => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); drop.classList.add("over"); } }, dragleave: () => drop.classList.remove("over"),
      drop: async e => { e.preventDefault(); drop.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) { await D.dropTake(f, id); this.renderForm(); this.renderList(); } } } },
      icon("upload", 18), h("div", {}, h("b", {}, t ? "Drop a new take to replace it" : "Drop the take here"), h("div", { class: "kv" }, `a video or audio file: it's kept as Footage/${D.game()}/${id}.<ext> and measured`)));
    const p = v3 ? D.prompt(ln) : null;
    return h("div", { class: "frm" },
      this.row("Who", this.sel(ln, "who", who, { blank: false, after: () => this.renderList() })),
      this.row("Japanese", this.f(ln, "ja", { ph: "the line as recorded" })),
      v3 ? this.row("How it's said", this.f(ln, "ja_note", { ph: "breath, pace, where the pause falls" })) : null,
      this.row("English", this.f(ln, "en", { ph: "the subtitle", after: () => this.renderList() })),
      ...subs.map(l => this.row("Subtitle " + l, this.f(ln, l))),
      v3 ? this.row("Expression", this.f(ln, "expr", { ph: "visible movement: eyes wide, lips trembling" })) : null,
      v3 ? this.row("Voice", this.sel(ln, "voice", D.voices, { blank: "says" })) : null,
      this.row("Mood", this.f(ln, "mood", { ph: "eerie" })),
      this.row("Seen", this.chk(ln, "face", "heard only (no face video)", { on: false })),
      this.sec("The take"),
      h("div", { class: "rowi" }, h("button", { on: { click: () => D.playLine(id) } }, icon("play", 13), t ? " Play the take" : " Hear it (the browser's voice)"),
        h("span", { class: ln.dur ? "ok" : "muted" }, ln.dur ? `${D.secs(ln).toFixed(1)} s recorded` : `about ${D.secs(ln).toFixed(1)} s at speaking pace`)),
      drop,
      p ? h("div", { class: "rowi", style: "margin-top:8px" }, h("span", { class: "frm-l" }, "MiniMax"), h("code", { class: "grow" }, p), h("button", { on: { click: e => D.copy(p, e.target) } }, "copy")) : null);
  }
  motionsForm(m, id) {
    const S = this.S, D = this.D, v3 = (S.format || 2) >= 3, block = m.block || [];
    const keys = h("div", { class: "db-keys" });
    const drawKeys = () => {
      keys.innerHTML = "";
      block.forEach((b, i) => keys.append(h("div", { class: "rowi" }, h("span", { class: "muted" }, "at"), this.f(b, "at", { num: true, step: "0.05", min: 0, max: 1 }),
        D.posePick ? D.posePick(b, "pose", () => this.changed()) : this.sel(b, "pose", D.poses(), { blank: false }), this.sel(b, "ease", D.eases, { blank: "inout (default)" }),
        h("button", { class: "ghost", title: "remove this key", on: { click: () => { block.splice(i, 1); if (!block.length) delete m.block; this.changed(); drawKeys(); } } }, icon("x", 13)))));
      keys.append(h("button", { class: "a-add", on: { click: () => { m.block = block; block.push({ at: block.length ? 1 : 0, pose: "idle", ease: block.length ? "inout" : undefined }); if (!block[block.length - 1].ease) delete block[block.length - 1].ease; this.changed(); drawKeys(); } } }, icon("plus", 13), " key"));
    };
    drawKeys();
    const suggest = `${String(D.game()).toLowerCase()}_${m.who || "anyone"}_${id}`, made = m.name && (D.made ? D.made() : []).includes(m.name);
    return h("div", { class: "frm" },
      D.pic ? h("div", { class: "db-portrait" }, D.pic("table", id, "strip"), h("p", { class: "hint" }, made ? "its Kimodo take, at four moments" : (m.block || []).length ? "its stand-in (the blocking below), at four moments: the desk plays it until the Kimodo take is made" : "not made yet and no stand-in: give it blocking below to see it in the desk")) : null,
      this.row("Who", this.sel(m, "who", Object.entries(S.cast || {}).map(([k, c]) => [k, c.name || k]), { blank: "anyone", after: () => this.renderList() })),
      this.row("Prompt", this.f(m, "prompt", { long: true, rows: 2, ph: v3 ? "A person stands still, breathing slowly…" : "stands still, breathing slowly" })),
      v3 ? h("p", { class: "hint tight" }, "Kimodo's words: start “A person …”, one action, what the body does (docs/KIMODO.md)") : null,
      this.row("Length", this.f(m, "secs", { num: true, step: "0.5", after: () => this.renderList() }), "s", this.chk(m, "loop", "loops", { after: () => this.renderList() }), this.chk(m, "in_place", "in place (the game moves it)")),
      this.row("Kimodo name", this.f(m, "name", { ph: suggest }), m.name ? null : h("button", { title: "the name the shot list saves it under", on: { click: () => { m.name = suggest; this.changed(); this.renderForm(); } } }, "use " + suggest)),
      this.row("Blocking", keys), h("p", { class: "hint tight" }, "the desk's stand-in until the Kimodo take is in: a pose at each moment, 0 to 1 of its length"));
  }
  secretsForm(s, sid) {
    const id = "fl" + Math.random().toString(36).slice(2, 8), fl = Object.keys(flagsOf(this.S)).sort();
    return h("div", { class: "frm" },
      this.row("Flag", h("input", { value: s.flag || "", list: id, placeholder: "the flag finding it sets", on: { change: e => { s.flag = e.target.value.trim(); this.changed(); this.renderList(); } } }), h("datalist", { id }, fl.map(f => h("option", { value: f })))),
      this.row("Hint", this.f(s, "hint", { ph: "the back of the kitchen photo", after: () => this.retitle(s.hint || sid) })));
  }
  interruptForm(it) {
    const S = this.S, D = this.D, t = TAB.interrupts, ctx = Object.assign({}, D.ctx, { changed: () => this.changed(), rerender: () => this.renderForm() });
    const all = it.during === undefined || it.during === "all", chips = h("span", { class: "chips" });
    if (!all) {
      it.during.forEach((tid, i) => chips.append(h("span", { class: "chip" }, ((S.stitches || {})[tid] || {}).title || tid, h("button", { class: "x", on: { click: () => { it.during.splice(i, 1); if (!it.during.length) it.during = "all"; this.changed(); this.renderForm(); } } }, "×"))));
      const add = h("select", { on: { change: e => { if (e.target.value) { it.during.push(e.target.value); this.changed(); this.renderForm(); } } } }, h("option", { value: "" }, "+ a task"),
        Object.entries(S.stitches || {}).filter(([k]) => !it.during.includes(k)).map(([k, st]) => h("option", { value: k }, st.title || k)));
      chips.append(add);
    }
    const idIn = h("input", { value: it.id || "", class: "id", on: { change: e => { const v = e.target.value.trim(); if (!ID_RE.test(v) || (v !== it.id && allIds(S).has(v))) { e.target.value = it.id || ""; D.status("an id is snake_case and unique in the file"); return; } this.pick.interrupts = it.id = v; this.changed(); this.renderList(); } } });
    return h("div", {},
      this.head(t, it.id || "", it, { rename: false, dup: false, del: false, label: it.label || it.id }),
      h("div", { class: "frm" },
        this.row("Label", this.f(it, "label", { after: () => this.retitle(it.label || it.id) })),
        this.row("When", triggerPill({ get: () => it.when, set: v => { it.when = v; } }, ctx, { prefix: "When", after: () => this.renderForm() })),
        this.row("During", h("label", { class: "chk" }, h("input", { type: "checkbox", checked: all, on: { change: e => { it.during = e.target.checked ? "all" : []; this.changed(); this.renderForm(); } } }), " every task"), chips),
        this.row("Jumps to", this.sel(it, "to", D.nodes(), { blank: "choose a node…", after: () => D.redraw() })),
        this.row("Id", idIn)),
      h("div", { class: "rowi", style: "margin-top:14px" }, h("button", { class: "danger", on: { click: async () => {
        if (!await modal({ title: "Delete this trigger cutscene?", body: h("p", {}, it.label || it.id), ok: "Delete" })) return;
        S.interrupts.splice(S.interrupts.indexOf(it), 1); if (!S.interrupts.length) delete S.interrupts; this.pick.interrupts = null; this.changed(); this.render(); } } }, icon("x", 13), " Delete")));
  }
  stateForm(sel) {
    const S = this.S, [kind, id] = [sel.slice(0, sel.indexOf(":")), sel.slice(sel.indexOf(":") + 1)];
    if (kind === "flag") return h("div", {}, h("div", { class: "db-head" }, h("span", { class: "db-ic" }, icon("flag", 18)), h("h3", {}, id), h("span", { class: "grow" }),
      h("button", { title: "a new name, everywhere the story uses this flag", on: { click: () => this.rename("flag", id) } }, icon("edit", 13), " Rename everywhere")),
      h("p", { class: "hint" }, "A flag exists while the story uses it: a command sets it, a beat or a choice waits for it. Rename it here to fix a typo everywhere at once."), this.uses("flag", id));
    if (kind === "counter") {
      const c = (S.game.counters || {})[id]; if (!c) return h("div", { class: "db-empty" }, "gone");
      return h("div", {}, this.head(TAB.state, id, c, { kind: "counter", ic: "count", label: c.label || id, dup: false }),
        h("div", { class: "frm" }, this.row("Label", this.f(c, "label", { ph: "times she found you", after: () => this.retitle(c.label || id) }))),
        h("p", { class: "hint" }, "A command changes it (+1, or set to a number); a flow choice by count branches on it."), this.uses("counter", id));
    }
    const ax = this.axes(), a = ax[id]; if (!a) return h("div", { class: "db-empty" }, "gone");
    const own = () => { if (!(S.game.karma && S.game.karma.axes)) S.game.karma = Object.assign(S.game.karma || {}, { axes: { karma: { min: -10, max: 10 } } }); return S.game.karma.axes[id]; };
    const edit = (key, o) => this.f(a, key, Object.assign({ into: own, after: () => this.retitle(own().label || id) }, o));
    return h("div", {}, this.head(TAB.state, id, a, { kind: "axis", ic: "heart", label: a.label || id, dup: false, rename: id !== "karma", del: id !== "karma" }),
      h("div", { class: "frm" }, this.row("Label", edit("label", { ph: "how you treat Mari" })), this.row("Range", edit("min", { num: true, ph: "-10" }), "to", edit("max", { num: true, ph: "10" }))),
      h("p", { class: "hint" }, id === "karma" ? "The default axis: a plain number in a karma command counts on it." : "A karma command or a choice's answer moves it; a flow choice by karma branches on it."), this.uses("axis", id));
  }

  /* ---- new, rename, duplicate, delete ---- */
  async askId(title, { name = null, nameLabel = "Name", initial = "", flag = false } = {}) {
    const S = this.S, taken = allIds(S), draft = { name: "", id: initial }, msg = h("div", { class: "kv" });
    let touched = !!initial;
    const idIn = h("input", { value: initial, class: "id", placeholder: "snake_case", on: { input: e => { draft.id = e.target.value.trim(); touched = true; check(); } } });
    const check = () => {
      const v = draft.id, bad = !ID_RE.test(v) ? "lower-case letters, digits and _, starting with a letter" : !flag && v !== initial && taken.has(v) ? `${v} is already used in this game` : "";
      msg.textContent = bad || (flag && v !== initial && flagsOf(S)[v] ? `the flag ${v} exists: the two become one` : "✓ free"); msg.className = "kv " + (bad ? "err" : "ok"); return !bad;
    };
    const body = h("div", { class: "frm" },
      name !== null ? this.row(nameLabel, h("input", { on: { input: e => { draft.name = e.target.value; if (!touched) { draft.id = slug(e.target.value); idIn.value = draft.id; check(); } } } })) : null,
      this.row("Id", idIn), msg);
    check();
    for (;;) {
      if (!await modal({ title, body, ok: initial ? "Rename" : "Create" })) return null;
      if (check()) return draft;
    }
  }
  // a new entry for a picker elsewhere (a command's form): made, and its id handed back
  quickNew(kind) { return kind === "counter" ? this.newCounter({ quiet: true }) : this.newEntry(TABS.find(t => t.kind === kind).id, { quiet: true }); }
  async newEntry(tab = this.tab, { quiet = false } = {}) {
    const S = this.S, t = TAB[tab], cast0 = Object.keys(S.cast || {})[0] || "player", v3 = (S.format || 2) >= 3;
    const d = await this.askId(`New ${t.noun}`, { name: t.name ? "" : null, nameLabel: t.nameLabel || (t.name ? t.name[0].toUpperCase() + t.name.slice(1) : "Name") }); if (!d) return null;
    const nm = d.name.trim(), make = {
      cast: () => ({ name: nm || d.id, height: 1.65, metahuman: null }),
      items: () => ({ name: nm || d.id, shape: "box 0.1 0.1 0.1", inspect: true }),
      notes: () => ({ title: nm || d.id, text: "" }),
      sounds: () => ({ file: "SFX/" + d.id }),
      lines: () => ({ who: cast0, ja: "", en: nm }),
      motions: () => ({ who: Object.keys(S.cast || {})[0], prompt: v3 ? "A person stands still, breathing slowly" : "stands still, breathing slowly", secs: 4, loop: true }),
      secrets: () => ({ flag: "found_" + d.id, hint: nm }),
    }[tab];
    if (tab === "interrupts") { (S.interrupts = S.interrupts || []).push({ id: d.id, label: nm || d.id, when: { pickup: Object.keys(S.items || {})[0] || "" }, during: "all", to: S.game.start }); }
    else { const tb = S[t.id] = S[t.id] || {}, e = make(); for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k]; tb[d.id] = e; }
    this.pick[tab] = d.id;
    if (quiet) { this.D.touch(true); this.D.status(`${t.noun} ${d.id} added: the Database has the rest of it`); return d.id; }
    this.changed(true); this.render(); return d.id;
  }
  async newCounter({ quiet = false } = {}) {
    const d = await this.askId("New counter", { name: "", nameLabel: "Label" }); if (!d) return null;
    const S = this.S; S.game.counters = Object.assign(S.game.counters || {}, { [d.id]: d.name.trim() ? { label: d.name.trim() } : {} });
    this.pick.state = "counter:" + d.id;
    if (quiet) { this.D.touch(); return d.id; }
    this.changed(); this.render(); return d.id;
  }
  async newAxis() {
    const d = await this.askId("New karma axis", { name: "", nameLabel: "Label" }); if (!d) return;
    const S = this.S; S.game.karma = S.game.karma || {}; S.game.karma.axes = S.game.karma.axes || { karma: { min: -10, max: 10 } };
    S.game.karma.axes[d.id] = Object.assign({ min: -10, max: 10 }, d.name.trim() ? { label: d.name.trim() } : {});
    this.pick.state = "axis:" + d.id; this.changed(); this.render();
  }
  async rename(kind, id) {
    const S = this.S, n = usesOf(S, kind, id).length, d = await this.askId(`Rename the ${KINDS[kind].label} ${id}`, { initial: id, flag: kind === "flag" });
    if (!d || d.id === id) return;
    if (kind === "line" && this.D.takes()[id] && !await modal({ title: "Its take keeps its name", body: h("p", {}, `The take file is named by the line's id: rename Footage/${this.D.game()}/${id}.* to ${d.id}.* as well, or drop the take on the line again.`), ok: "Rename anyway" })) return;
    try { renameRef(S, kind, id, d.id); } catch (e) { await modal({ title: "Can't rename it", body: h("p", {}, e.message), cancel: null }); return; }
    this.pick[this.tab] = this.tab === "state" ? `${kind}:${d.id}` : d.id;
    this.changed(true); this.render(); this.D.status(`${id} is now ${d.id}: ${n} use${n === 1 ? "" : "s"} moved with it`);
  }
  async duplicate(id) {
    const S = this.S, t = TAB[this.tab], tb = tableOf(S, t.kind), taken = allIds(S);
    let nu = id + "_copy", i = 2; while (taken.has(nu)) nu = `${id}_copy${i++}`;
    const e = clone(tb[id]); delete e.dur; delete e.trim;     // a copied line has no take of its own yet
    if (t.name && e[t.name]) e[t.name] += " (copy)";
    const out = {}; for (const [k, v] of Object.entries(tb)) { out[k] = v; if (k === id) out[nu] = e; }
    for (const k of Object.keys(tb)) delete tb[k]; Object.assign(tb, out);
    this.pick[this.tab] = nu; this.changed(true); this.render();
  }
  async remove(kind, id) {
    const S = this.S, n = usesOf(S, kind, id).length;
    if (!await modal({ title: `Delete ${id}?`, body: h("p", {}, n ? `It's used in ${n} place${n > 1 ? "s" : ""} (listed under the form). Those uses stay and the checks will point at them.` : "Nothing uses it."), ok: "Delete" })) return;
    if (kind === "counter") { delete S.game.counters[id]; if (!Object.keys(S.game.counters).length) delete S.game.counters; }
    else if (kind === "axis") delete S.game.karma.axes[id];
    else delete tableOf(S, kind)[id];
    this.pick[this.tab] = null; this.changed(true); this.render();
  }
}
// what a use does with its flag
function flagUse(r) {
  const p = r.path;
  if (p.includes("if")) return r.token === "!" ? "only if not" : "only if";
  if (r.key === "unflag") return "clears it";
  if (p.includes("when")) return "waits for it";
  if (p[0] === "secrets") return "the secret's";
  if (r.token === "flag:") return "unlocks a door";
  return "sets it";
}

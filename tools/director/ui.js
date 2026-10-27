// The desk's building blocks for editing without JSON, after RPG Maker's event editor: a dialog, the command palette
// (search, the commands in groups), a form made from a command's fields (each a list of what exists: lines, doors,
// spots, flags...), lists you drag to reorder (and from one list to another), the action list (rows that read as
// sentences; a question's answers as branches under it), the trigger pill and the beat card. Everything is driven by
// commands.js. ctx (app.js): refs(kind) -> [[value, label]], name(kind, value) -> a short label, changed() after an
// edit, rerender() to redraw.
import { icon } from "./icons.js";
import { ACTIONS, TRIGGERS, ACTION, TRIGGER, GROUPS, verbOfAction, verbOfTrigger, actionText, triggerText, fieldsOf } from "./commands.js";
import { pack, pasteCommands, pasteBeats } from "./clipboard.js";

export const h = (t, a = {}, ...k) => {
  const e = document.createElement(t);
  for (const [n, v] of Object.entries(a)) {
    if (n === "on") for (const [ev, f] of Object.entries(v)) e.addEventListener(ev, f);
    else if (n === "style") e.style.cssText = v;
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(n, v === true ? "" : v);
  }
  for (const c of k.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const GROUP = Object.fromEntries(GROUPS.map(g => [g.id, g]));
export const groupColor = verb => (GROUP[(ACTION[verb] || {}).group] || {}).color || "#888";

// ---- a dialog: resolves true (OK, Enter) or null (Cancel, Esc, the backdrop) ------------------------------------------
export function modal({ title, body, ok = "OK", cancel = "Cancel", wide = false, danger = null, extra = null, focus = true, ready = null }) {
  return new Promise(res => {
    const close = v => { back.remove(); document.removeEventListener("keydown", key, true); res(v); };
    const key = e => {
      if ([...document.querySelectorAll(".mdl-back")].pop() !== back) return;    // a dialog over a dialog: the top one answers
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(null); }
      else if (e.key === "Enter" && !e.shiftKey && !/^(TEXTAREA|SELECT|BUTTON)$/.test((e.target || {}).tagName) && ok) { e.preventDefault(); e.stopPropagation(); close(true); }
    };
    const foot = h("div", { class: "mdl-f" }, danger ? h("button", { class: "danger", on: { click: () => close("danger") } }, danger) : null, extra, h("span", { class: "grow" }),
      cancel ? h("button", { on: { click: () => close(null) } }, cancel) : null, ok ? h("button", { class: "primary", on: { click: () => close(true) } }, ok) : null);
    const box = h("div", { class: "mdl" + (wide ? " wide" : ""), role: "dialog" },
      h("div", { class: "mdl-h" }, h("span", {}, title), h("button", { class: "ghost", title: "close (Esc)", on: { click: () => close(null) } }, icon("x", 14))),
      h("div", { class: "mdl-b" }, body), foot);
    const back = h("div", { class: "mdl-back", on: { mousedown: e => { if (e.target === back) close(null); } } }, box);
    document.body.append(back); document.addEventListener("keydown", key, true);
    if (focus) setTimeout(() => { const f = box.querySelector(".mdl-b input:not([type=checkbox]),.mdl-b select,.mdl-b textarea"); if (f) f.focus(); }, 30);
    if (ready) ready(close);
  });
}

// ---- what's picked to copy (commands, beats, lines: by their objects), the desk's clipboard, the right-click menu ---
const PICK = { kind: null, objs: new Set() };
let FOCUS = null;                                  // where the last click was: commands, beats, clips or cards (what Ctrl+C copies)
export const focusOf = () => FOCUS, setFocus = k => { FOCUS = k; };
export function pick(kind, obj, { add = false } = {}) {
  if (PICK.kind !== kind || !add) { PICK.kind = kind; PICK.objs = new Set(); }
  if (add && PICK.objs.has(obj)) PICK.objs.delete(obj); else PICK.objs.add(obj);
  FOCUS = kind; markPicks();
}
export function pickAll(kind, objs) { PICK.kind = kind; PICK.objs = new Set(objs); FOCUS = kind; markPicks(); }
export function picked(kind) {                     // in the order they're shown
  if (PICK.kind !== kind) return [];
  const shown = [...document.querySelectorAll(`[data-pick="${kind}"]`)].map(e => e._obj).filter(o => PICK.objs.has(o));
  return shown.length ? shown : [...PICK.objs];
}
export function unpick() { PICK.kind = null; PICK.objs = new Set(); markPicks(); }
function markPicks() { for (const e of document.querySelectorAll("[data-pick]")) e.classList.toggle("picked", PICK.objs.has(e._obj)); }
export const CLIP = {                              // kept across the desk's pages and a reload; on the system clipboard as JSON too
  v: null,
  get() { if (this.v) return this.v; try { const t = localStorage.getItem("dd.clip"); return t ? JSON.parse(t) : null; } catch (e) { return null; } },
  set(v, { system = true } = {}) {
    this.v = v; try { localStorage.setItem("dd.clip", JSON.stringify(v)); } catch (e) { }
    if (system) try { navigator.clipboard.writeText(JSON.stringify(v, null, 1)).catch(() => { }); } catch (e) { }
  },
  has(kind) { const c = this.get(); return !!c && c.kind === kind; },
};
const LIST_OF = new WeakMap(), BEATS_OF = new WeakMap();      // a command: its list and that list's ctx; a beat: its task's beats
export function contextMenu(x, y, items, head = null) {
  document.querySelectorAll(".bmenu").forEach(m => m.remove());
  const m = h("div", { class: "bmenu cmenu", style: `left:${x}px;top:${y}px`, on: { contextmenu: e => e.preventDefault() } }, head ? h("div", { class: "bmenu-h" }, head) : null);
  for (const it of items) {
    if (!it) continue;
    if (it === "-") { m.append(h("div", { class: "bmenu-sep" })); continue; }
    m.append(h("button", { class: "bmenu-i" + (it.danger ? " danger" : ""), disabled: it.disabled || null, title: it.hint || null, on: { click: () => { m.remove(); it.on(); } } },
      icon(it.icon || "box", 14), h("span", { class: "grow" }, it.label), it.kbd ? h("kbd", {}, it.kbd) : null));
  }
  document.body.append(m);
  const r = m.getBoundingClientRect();              // kept on screen
  if (r.right > innerWidth - 6) m.style.left = Math.max(6, innerWidth - r.width - 6) + "px";
  if (r.bottom > innerHeight - 6) m.style.top = Math.max(6, innerHeight - r.height - 6) + "px";
  const off = ev => { if (ev.type === "keydown" && ev.key !== "Escape") return; if (ev.type === "mousedown" && m.contains(ev.target)) return; m.remove(); for (const t of ["mousedown", "keydown", "wheel"]) window.removeEventListener(t, off, true); };
  setTimeout(() => { for (const t of ["mousedown", "keydown", "wheel"]) window.addEventListener(t, off, true); }, 0);
  return m;
}
// Ctrl+C on commands or beats: what's picked, packed for the clipboard; Ctrl+V: after the last one picked
export function copyPicks() {
  if (FOCUS === "commands") { const l = picked("commands"); return l.length ? pack("commands", l) : null; }
  if (FOCUS === "beats") { const l = picked("beats"); return l.length ? pack("beats", l) : null; }
  return null;
}
export function pasteAtPicks(clip, story) {
  if (!clip) return false;
  const lastCmd = picked("commands").slice(-1)[0], lastBeat = picked("beats").slice(-1)[0];
  if (clip.kind === "commands" && lastCmd && LIST_OF.has(lastCmd)) { const { arr, ctx } = LIST_OF.get(lastCmd); return pasteInto(arr, arr.indexOf(lastCmd) + 1, pasteCommands(story, clip.items), ctx, "commands"); }
  if (clip.kind === "commands" && lastBeat && BEATS_OF.has(lastBeat)) { const { ctx } = BEATS_OF.get(lastBeat); lastBeat.do = lastBeat.do || []; return pasteInto(lastBeat.do, lastBeat.do.length, pasteCommands(story, clip.items), ctx, "commands"); }
  if (clip.kind === "beats" && lastBeat && BEATS_OF.has(lastBeat)) { const { beats, ctx } = BEATS_OF.get(lastBeat); return pasteInto(beats, beats.indexOf(lastBeat) + 1, pasteBeats(story, clip.items), ctx, "beats"); }
  return false;
}
export function deletePicks() {                    // Del on picked commands
  const l = picked("commands").filter(a => LIST_OF.has(a)); if (!l.length) return false;
  const ctxs = new Set(); for (const a of l) { const { arr, ctx } = LIST_OF.get(a); const i = arr.indexOf(a); if (i >= 0) arr.splice(i, 1); ctxs.add(ctx); }
  unpick(); const c = [...ctxs][0]; for (const x of ctxs) x.changed(); c.rerender(); return true;
}
function pasteInto(arr, at, items, ctx, kind) { arr.splice(at, 0, ...items); ctx.changed(); pickAll(kind, items); ctx.rerender(); markPicks(); return items.length; }
const copied = (n, what) => toast(`Copied ${n} ${what}${n === 1 ? "" : "s"}: paste with Ctrl+V or a right-click`, { ms: 4000 });
export function copyNow(clip, what) { if (!clip) return false; CLIP.set(clip); copied(clip.items.length, what); return true; }

// ---- a toast: a line at the bottom that goes by itself, with one thing to do about it ---------------------------------
export function toast(text, { action = null, ms = 9000 } = {}) {
  let box = document.querySelector(".toasts"); if (!box) { box = h("div", { class: "toasts" }); document.body.append(box); }
  const t = h("div", { class: "toast" }, h("span", {}, text), action ? h("button", { class: "small", on: { click: () => { t.remove(); action.on(); } } }, action.label) : null,
    h("button", { class: "ghost", title: "close", on: { click: () => t.remove() } }, icon("x", 12)));
  box.append(t); setTimeout(() => t.remove(), ms);
  while (box.children.length > 3) box.firstChild.remove();
  return t;
}

// ---- the command palette: every command by group, a search box (type and Enter) -----------------------------------
export function pickVerb(kind = "action", title) {
  const defs = kind === "action" ? ACTIONS.filter(d => !d.rare) : TRIGGERS;
  return new Promise(res => {
    let chosen = null;
    const tiles = [], search = h("input", { class: "pal-search", placeholder: kind === "action" ? "Search commands: door, flag, scene…" : "Search: enter, pick up, caught…" });
    const tile = d => {
      const t = h("button", { class: "tile", title: d.hint || d.label, style: `--g:${kind === "action" ? groupColor(d.verb) : "var(--accent)"}`,
        on: { click: () => { chosen = d.verb; done(); } } }, h("span", { class: "tile-ic" }, icon(d.icon, 18)), h("span", { class: "tile-l" }, d.label));
      t._d = d; tiles.push(t); return t;
    };
    const body = h("div", { class: "pal" }, search);
    if (kind === "action") for (const g of GROUPS) {
      const ds = defs.filter(d => d.group === g.id); if (!ds.length) continue;
      body.append(h("div", { class: "pal-g" }, h("div", { class: "pal-gh", style: `color:${g.color}` }, g.label), h("div", { class: "pal-tiles" }, ds.map(tile))));
    }
    else body.append(h("div", { class: "pal-tiles" }, defs.map(tile)));
    const filter = () => {
      const s = search.value.trim().toLowerCase();
      for (const t of tiles) t.style.display = !s || (t._d.label + " " + t._d.verb + " " + (t._d.hint || "")).toLowerCase().includes(s) ? "" : "none";
      for (const g of body.querySelectorAll(".pal-g")) g.style.display = [...g.querySelectorAll(".tile")].some(t => t.style.display !== "none") ? "" : "none";
    };
    search.addEventListener("input", filter);
    search.addEventListener("keydown", e => { if (e.key === "Enter") { const t = tiles.find(t => t.style.display !== "none"); if (t) { e.preventDefault(); e.stopPropagation(); chosen = t._d.verb; done(); } } });
    let done = () => {};
    modal({ title: title || (kind === "action" ? "Add a command" : "When should it happen?"), body, ok: null, wide: true, ready: c => { done = () => c(true); } }).then(() => res(chosen));
    setTimeout(() => search.focus(), 30);
  });
}

// ---- a form from fields: each field an input of its kind, bound to obj --------------------------------------------
const BLANK = "", NEW = "__new__";
const NOUN = { line: "line", item: "item", note: "note", sound: "sound", counter: "counter", secret: "secret", motion: "motion", cast: "cast member" };
function options(sel, list, cur, blank) {
  if (blank !== false) sel.append(h("option", { value: BLANK }, blank || "—"));
  let found = false;
  for (const [v, l] of list) { const o = h("option", { value: v }, l); if (String(v) === String(cur)) { o.selected = true; found = true; } sel.append(o); }
  if (cur !== undefined && cur !== null && cur !== "" && cur !== true && !found) sel.append(h("option", { value: cur, selected: true }, `${cur} (not found)`));
}
export function fieldInput(f, obj, ctx, redraw) {
  const k = f.key, cur = obj[k];
  const set = v => { if (v === undefined || v === BLANK || v === null || (typeof v === "number" && isNaN(v))) { if (f.verb) obj[k] = f.kind === "light" ? null : ""; else delete obj[k]; } else obj[k] = v; };
  switch (f.kind) {
    case "text": return h("input", { value: cur ?? "", placeholder: f.ph || "", on: { input: e => set(e.target.value) } });
    case "longtext": return h("textarea", { rows: 2, placeholder: f.ph || "", on: { input: e => set(e.target.value) } }, cur ?? "");
    case "number": return h("input", { type: "number", step: "any", value: cur ?? "", placeholder: f.ph || "", class: "num", on: { input: e => set(e.target.value === "" ? undefined : +e.target.value) } });
    case "bool": return h("label", { class: "chk" }, h("input", { type: "checkbox", checked: !!cur, on: { change: e => set(e.target.checked ? true : undefined) } }), " yes");
    case "choice": {
      if (!f.opt && (cur === undefined || cur === "")) set(f.opts[0]);   // no blank to show: the first is what it is
      const s = h("select", { on: { change: e => { set(e.target.value); if (redraw) redraw(); } } }); options(s, f.opts.map(o => [o, (f.labels || {})[o] || o]), obj[k], f.opt ? "—" : false); return s;
    }
    case "flag": {
      const id = "fl" + Math.random().toString(36).slice(2, 8);
      return h("span", {}, h("input", { list: id, value: cur ?? "", placeholder: "a flag's name (new or used before)", on: { input: e => set(e.target.value.trim()) } }),
        h("datalist", { id }, ctx.refs("flag").map(([v]) => h("option", { value: v }))));
    }
    case "karma": {
      const axes = ctx.refs("axis"), axis = typeof cur === "number" || cur === undefined ? "karma" : Object.keys(cur)[0], amt = typeof cur === "number" ? cur : (cur || {})[axis] ?? 1;
      const s = h("select", {}), n = h("input", { type: "number", step: "any", value: amt, class: "num" });
      options(s, axes.length ? axes : [["karma", "karma"]], axis, false);
      const upd = () => { const a = s.value, v = +n.value || 0; obj[k] = a === "karma" ? v : { [a]: v }; };
      s.addEventListener("change", upd); n.addEventListener("input", upd);
      return h("span", { class: "rowi" }, s, n);
    }
    case "trigger": {                            // a trigger inside a command (a task's `ticks`, `fails`): its pill, or none
      const box = h("span", { class: "rowi" });
      const draw = () => {
        box.replaceChildren(obj[k] ? triggerPill({ get: () => obj[k], set: v => { obj[k] = v; } }, ctx, { prefix: "", after: draw }) :
          h("button", { type: "button", on: { click: async () => { const v = await editTrigger({ start: true }, ctx); if (v) { obj[k] = v; draw(); } } } }, icon("plus", 14), " when…"),
        obj[k] ? h("button", { type: "button", class: "ghost", title: "none", on: { click: () => { delete obj[k]; draw(); } } }, icon("x", 14)) : "");
      };
      draw(); return box;
    }
    case "anyone": case "anylocker": case "anycarry": case "anytodo": {
      const any = { anyone: "anyone", anylocker: "any hiding place", anycarry: "anything", anytodo: f.all || "all of them" }[f.kind], kind = { anyone: "cast", anylocker: "locker", anycarry: "carry", anytodo: "todo" }[f.kind];
      const s = h("select", { on: { change: e => { obj[k] = e.target.value === "*" ? true : e.target.value; } } });
      s.append(h("option", { value: "*", selected: cur === true || cur === undefined }, `(${any})`));
      options(s, ctx.refs(kind), cur === true ? undefined : cur, false);
      return s;
    }
    case "facing": { const s = h("select", { on: { change: e => set(e.target.value) } }); options(s, [["player", "the player"], ...ctx.refs("cast"), ...ctx.refs("thing")], cur, "—"); return s; }
    case "routes": {
      const list = Array.isArray(cur) ? cur : (obj[k] = []), box = h("span", { class: "chips" });
      const draw = () => {
        box.innerHTML = "";
        list.forEach((r, i) => box.append(h("span", { class: "chip" }, ctx.name("route", r), h("button", { class: "x", on: { click: () => { list.splice(i, 1); draw(); } } }, "×"))));
        const s = h("select", { on: { change: e => { if (e.target.value) { list.push(e.target.value); draw(); } } } }); options(s, ctx.refs("route"), undefined, "+ add a route"); box.append(s);
      };
      draw(); return box;
    }
    case "many": {                                 // several of a kind (f.of): chips, and a list to add one more
      const list = Array.isArray(cur) ? cur : (obj[k] = []), box = h("span", { class: "chips" });
      const draw = () => {
        box.innerHTML = "";
        list.forEach((r, i) => box.append(h("span", { class: "chip" }, ctx.name(f.of, r), h("button", { class: "x", on: { click: () => { list.splice(i, 1); draw(); box.dispatchEvent(new Event("input", { bubbles: true })); } } }, "×"))));
        const s = h("select", { on: { change: e => { if (e.target.value) { list.push(e.target.value); draw(); box.dispatchEvent(new Event("input", { bubbles: true })); } } } }); options(s, ctx.refs(f.of).filter(([v]) => !list.includes(v)), undefined, "+ add one"); box.append(s);
      };
      draw(); return box;
    }
    case "answer": { const s = h("select", { on: { change: e => set(e.target.value) } }); options(s, (obj.options || []).map(o => [o.id, o.label || o.id]), cur, "—"); return s; }
    case "askanswer": { const s = h("select", { on: { change: e => set(e.target.value) } }); options(s, ctx.refs("askanswer:" + (obj.answered || "")), cur, "(any answer)"); return s; }
    case "lifestate": { const s = h("select", { on: { change: e => set(e.target.value) } }); options(s, ctx.refs("lifestate:" + (obj.state || "")), cur, "choose…"); return s; }   // the states of the thing chosen
    default: {                                   // what exists of the kind, and "+ New…" to make one there and then (ctx.create)
      if (ctx.pic && ctx.pic(f.kind)) return picPick({ get: () => obj[k], set: v => { set(v || undefined); if (redraw) redraw(); }, choices: () => ctx.refs(f.kind), pic: id => ctx.pic(f.kind, id),
        blank: f.opt ? "—" : null, create: ctx.creates && ctx.creates(f.kind) ? () => ctx.create(f.kind) : null, createLabel: `New ${NOUN[f.kind] || f.kind}…` });
      const fill = v => { s.innerHTML = ""; options(s, ctx.refs(f.kind), v, f.opt ? "—" : "choose…"); if (ctx.creates && ctx.creates(f.kind)) s.append(h("option", { value: NEW }, `+ New ${NOUN[f.kind] || f.kind}…`)); };
      const s = h("select", { on: { change: async e => {
        if (e.target.value === NEW) { const id = await ctx.create(f.kind); fill(id || obj[k]); if (id) set(id); if (redraw) redraw(); return; }
        set(e.target.value); if (redraw) redraw(); } } });
      fill(cur); return s;
    }
  }
}
// ---- a picker with pictures, after RPG Maker's face and character pickers: a button with the chosen one's picture and
// name; a click opens every choice as a picture in a grid, searchable (type), Enter or a click picks, Esc closes
//   picPick({ get, set, choices: () => [[id, label]], pic: id => <img>, blank, title, create: async () => id, createLabel })
export function picPick(o) {
  const b = h("button", { class: "ppk", type: "button", title: o.title || "" });
  const draw = () => {
    b.innerHTML = ""; const v = o.get(), hit = o.choices().find(([id]) => String(id) === String(v));
    if (v) b.append(o.pic(v)); b.append(h("span", { class: "ppk-l" }, hit ? hit[1] : v ? `${v} (not found)` : o.blank || "choose…"), icon("down", 11));
  };
  b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); pickGrid(b, o, v => { o.set(v); draw(); }); });
  draw(); return b;
}
export function pickGrid(anchor, o, done) {
  document.querySelectorAll(".ppk-pop").forEach(x => x.remove());
  const q = h("input", { class: "ppk-q", placeholder: "Search…" }), grid = h("div", { class: "ppk-grid" });
  const pop = h("div", { class: "ppk-pop", on: { mousedown: e => e.stopPropagation() } }, q, grid);
  const close = () => { pop.remove(); for (const t of ["mousedown", "wheel"]) window.removeEventListener(t, off, true); window.removeEventListener("keydown", key, true); };
  const off = e => { if (!pop.contains(e.target)) close(); };
  const tile = (id, l, img) => h("button", { class: "ppk-t" + (String(id) === String(o.get() ?? "") ? " on" : ""), type: "button", title: l, on: { click: () => { close(); done(id); } } },
    img || h("span", { class: "ppk-none" }, "—"), h("span", { class: "ppk-tl" }, l));
  const fill = () => {
    grid.innerHTML = ""; const w = q.value.trim().toLowerCase();
    if (o.blank && !w) grid.append(tile("", o.blank, null));
    for (const [id, l] of o.choices()) if (!w || `${id} ${l}`.toLowerCase().includes(w)) grid.append(tile(id, l, o.pic(id)));
    if (o.create && !w) grid.append(h("button", { class: "ppk-t new", type: "button", on: { click: async () => { close(); const id = await o.create(); if (id) done(id); } } }, icon("plus", 18), h("span", { class: "ppk-tl" }, o.createLabel || "New…")));
    if (!grid.children.length) grid.append(h("div", { class: "kv", style: "padding:10px" }, "Nothing called that."));
  };
  const key = e => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); const t = grid.querySelector(".ppk-t:not(.new)"); if (t) t.click(); }
  };
  q.addEventListener("input", fill);
  document.body.append(pop); fill();
  const r = anchor.getBoundingClientRect(), pr = pop.getBoundingClientRect();      // under the button, kept on screen
  pop.style.left = Math.max(6, Math.min(r.left, innerWidth - pr.width - 6)) + "px";
  pop.style.top = (r.bottom + pr.height + 6 < innerHeight ? r.bottom + 4 : Math.max(6, r.top - pr.height - 4)) + "px";
  setTimeout(() => { for (const t of ["mousedown", "wheel"]) window.addEventListener(t, off, true); window.addEventListener("keydown", key, true); q.focus(); }, 0);
  return pop;
}
export function form(fields, obj, ctx, redraw) {
  return h("div", { class: "frm" }, fields.map(f => h("label", { class: "frm-r" }, h("span", { class: "frm-l" }, f.label), fieldInput(f, obj, ctx, redraw))));
}

// ---- editing one command (or trigger) in a dialog: a draft, kept only on OK ---------------------------------------
const clone = o => JSON.parse(JSON.stringify(o));
function clean(o, fields) { for (const f of fields) if (!f.verb && (o[f.key] === "" || o[f.key] === undefined || (Array.isArray(o[f.key]) && !o[f.key].length && f.opt))) delete o[f.key]; return o; }
export async function editAction(a, ctx, { isNew = false } = {}) {
  const verb = verbOfAction(a), d = ACTION[verb]; if (!d) return null;
  const draft = clone(a), body = h("div", {});
  let had = d.more ? d.more(draft).map(f => f.key) : [];
  const draw = () => {
    body.innerHTML = "";
    if (d.hint) body.append(h("p", { class: "hint" }, d.hint));
    const fs = fieldsOf(d, draft), now = d.more ? d.more(draft).map(f => f.key) : [];
    for (const k of had) if (!now.includes(k) && !d.fields.some(f => f.key === k)) delete draft[k];   // another trick or way of behaving: the old one's fields go
    had = now;
    body.append(form(fs, draft, ctx, draw));
    if (verb === "ask") body.append(answersEditor(draft, ctx));
    body.append(h("div", { class: "preview" }, icon(d.icon, 14), " ", actionText(draft, ctx.name)));
  };
  draw();
  for (const ev of ["input", "change"]) body.addEventListener(ev, () => { const p = body.querySelector(".preview"); if (p) p.lastChild.textContent = " " + actionText(draft, ctx.name); });   // a select's input comes before its change sets it
  const r = await modal({ title: (isNew ? "Add: " : "Edit: ") + d.label, body, ok: isNew ? "Add" : "OK" });
  return r ? clean(draft, fieldsOf(d, draft)) : null;
}
function answersEditor(a, ctx) {             // an ask's answers: id, label, Japanese; their commands are edited in the list
  const box = h("div", { class: "answers" }, h("div", { class: "frm-l" }, "Answers (2 to 4; each runs its own commands, in the list)"));
  const draw = () => {
    box.querySelectorAll(".ans").forEach(e => e.remove());
    (a.options || []).forEach((o, i) => box.append(h("div", { class: "ans rowi" },
      h("input", { value: o.label || "", placeholder: "the answer, as shown", on: { input: e => { o.label = e.target.value; if (!o._idSet) o.id = slug(e.target.value) || o.id; } } }),
      h("input", { value: o.ja || "", placeholder: "日本語 (optional)", on: { input: e => { if (e.target.value) o.ja = e.target.value; else delete o.ja; } } }),
      h("input", { value: o.id || "", class: "id", title: "its id (for `answered`)", on: { input: e => { o.id = e.target.value; o._idSet = true; } } }),
      (a.options.length > 2) ? h("button", { class: "ghost", title: "remove this answer", on: { click: () => { a.options.splice(i, 1); draw(); } } }, icon("x", 14)) : null)));
    if ((a.options || []).length < 4) box.append(h("button", { class: "ans", on: { click: () => { (a.options = a.options || []).push({ id: "answer" + (a.options.length + 1), label: "", do: [] }); draw(); } } }, icon("plus", 14), " answer"));
  };
  draw(); return box;
}
const slug = s => String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);

export async function editTrigger(w, ctx, { title = "When should it happen?" } = {}) {
  let draft = clone(w || { start: true });
  const body = h("div", { class: "trg" });
  const draw = () => {
    body.innerHTML = "";
    const verb = verbOfTrigger(draft), d = TRIGGER[verb];
    const grid = h("div", { class: "pal-tiles small" }, TRIGGERS.map(t => h("button", { class: "tile" + (t.verb === verb ? " on" : ""), on: { click: () => { draft = t.make(); draw(); } } },
      h("span", { class: "tile-ic" }, icon(t.icon, 16)), h("span", { class: "tile-l" }, t.label))));
    body.append(grid);
    if (d && d.nest) body.append(nestEditor(draft[verb], ctx, draw));
    else if (d) body.append(form(d.fields, draft, ctx, draw));
    body.append(h("div", { class: "preview" }, icon("clock", 14), " When ", triggerText(draft, ctx.name)));
  };
  draw();
  for (const ev of ["input", "change"]) body.addEventListener(ev, () => { const p = body.querySelector(".preview"); if (p) p.lastChild.textContent = triggerText(draft, ctx.name); });
  const r = await modal({ title, body, wide: true });
  return r ? draft : null;
}
function nestEditor(list, ctx, redraw) {         // all / any: triggers, each with its own pill
  const box = h("div", { class: "nest" });
  list.forEach((w, i) => box.append(h("div", { class: "rowi" }, triggerPill({ get: () => w, set: v => { list[i] = v; redraw(); } }, ctx, { prefix: "" }),
    list.length > 1 ? h("button", { class: "ghost", on: { click: () => { list.splice(i, 1); redraw(); } } }, icon("x", 14)) : null)));
  box.append(h("button", { on: { click: () => { list.push({ start: true }); redraw(); } } }, icon("plus", 14), " another"));
  return box;
}
// a trigger as a pill: "When the player enters the hall"; click to change it. slot: {get, set}
export function triggerPill(slot, ctx, { prefix = "When", after = null } = {}) {
  const w = slot.get(), d = TRIGGER[verbOfTrigger(w)], pm = w && ctx.marks ? ctx.marks(w) : null;
  return h("button", { class: "pill" + (pm ? " bad" : ""), title: pm ? pm.map(p => p.text).join("\n") : "click to change when it happens", on: { click: async () => { const v = await editTrigger(slot.get(), ctx); if (v) { slot.set(v); ctx.changed(); (after || ctx.rerender)(); } } } },
    icon(d ? d.icon : "clock", 14), h("span", {}, (prefix ? prefix + " " : "") + (w ? triggerText(w, ctx.name) : "(choose when)")));
}

// ---- lists you drag: rows by their grip, to another place in the list or into another list of the same kind ---------
let DRAG = null;
export function sortable(box, arr, kind, ctx, rowSel) {
  const marker = h("div", { class: "drop-at" });
  const rows = () => [...box.children].filter(e => e.matches && e.matches(rowSel));
  const at = y => { const rs = rows(); for (let i = 0; i < rs.length; i++) { const r = rs[i].getBoundingClientRect(); if (y < r.top + r.height / 2) return i; } return rs.length; };
  box.addEventListener("dragover", e => {
    if (!DRAG || DRAG.kind !== kind) return;
    e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move";
    const i = at(e.clientY), rs = rows(), ref = rs[i];
    if (ref) box.insertBefore(marker, ref); else { const last = rs[rs.length - 1]; if (last) last.after(marker); else box.prepend(marker); }
  });
  box.addEventListener("dragleave", e => { if (!box.contains(e.relatedTarget)) marker.remove(); });
  box.addEventListener("drop", e => {
    if (!DRAG || DRAG.kind !== kind) return;
    e.preventDefault(); e.stopPropagation(); marker.remove();
    let j = at(e.clientY); const { arr: from, i } = DRAG; DRAG = null;
    if (from === arr && (j === i || j === i + 1)) return;
    const [x] = from.splice(i, 1); if (from === arr && i < j) j--;
    arr.splice(j, 0, x); ctx.changed(); ctx.rerender();
  });
}
export function grip(row, arr, i, kind) {
  const g = h("span", { class: "grip", title: "drag to move" }, icon("grip", 14));
  g.addEventListener("mousedown", () => { row.draggable = true; });
  g.addEventListener("mouseup", () => { row.draggable = false; });
  row.addEventListener("dragstart", e => {                 // only its own drag: a command's bubbles up through its beat
    if (e.target !== row) return;
    e.stopPropagation(); DRAG = { arr, i, kind }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", kind); row.classList.add("dragging");
  });
  row.addEventListener("dragend", e => { if (e.target !== row) return; row.draggable = false; row.classList.remove("dragging"); DRAG = null; document.querySelectorAll(".drop-at").forEach(m => m.remove()); });
  return g;
}

// ---- the action list: a beat's `do`, an event's results, an answer's commands ---------------------------------------
export function actionList(arr, ctx, { empty = "Nothing yet.", depth = 0 } = {}) {
  const box = h("div", { class: "alist" + (depth ? " nested" : "") });
  arr.forEach((a, i) => {
    const verb = verbOfAction(a), d = ACTION[verb];
    const edit = async () => { const v = await editAction(a, ctx); if (v) { arr[i] = v; ctx.changed(); ctx.rerender(); } };
    const pm = ctx.marks ? ctx.marks(a) : null;      // the live checks' problems on this command
    const row = h("div", { class: "arow" + (pm ? (pm.some(p => p.sev === "error") ? " bad" : " warnrow") : "") + (PICK.objs.has(a) ? " picked" : ""), "data-pick": "commands", style: `--g:${groupColor(verb)}`, title: pm ? pm.map(p => p.text).join("\n") : null });
    row._obj = a; LIST_OF.set(a, { arr, ctx });
    const dup = () => { arr.splice(i + 1, 0, ...pasteCommands(ctx.story ? ctx.story() : {}, [a])); ctx.changed(); ctx.rerender(); };
    const del = () => { const ps = picked("commands").filter(x => arr.includes(x)), go = ps.includes(a) && ps.length > 1 ? ps : [a]; for (const x of go) arr.splice(arr.indexOf(x), 1); unpick(); ctx.changed(); ctx.rerender(); };
    row.addEventListener("click", e => { if (e.target.closest("button,.grip")) return; e.stopPropagation(); pick("commands", a, { add: e.ctrlKey || e.metaKey || e.shiftKey }); });
    row.addEventListener("contextmenu", e => {
      e.preventDefault(); e.stopPropagation(); if (!PICK.objs.has(a)) pick("commands", a);
      const n = picked("commands").length;
      contextMenu(e.clientX, e.clientY, [
        d && (d.fields.length || d.more) ? { label: "Edit", icon: "edit", kbd: "double-click", on: edit } : null,
        { label: n > 1 ? `Copy ${n} commands` : "Copy", icon: "copy", kbd: "Ctrl+C", on: () => copyNow(copyPicks(), "command") },
        { label: "Paste after", icon: "plus", kbd: "Ctrl+V", disabled: !CLIP.has("commands"), on: () => pasteAtPicks(CLIP.get(), ctx.story ? ctx.story() : {}) },
        { label: "Insert a command above", icon: "plus", on: async () => { const vb = await pickVerb("action"); if (!vb) return; const dd = ACTION[vb], x = dd.make(); const v = dd.fields.length ? await editAction(x, ctx, { isNew: true }) : x; if (v) { arr.splice(arr.indexOf(a), 0, v); ctx.changed(); ctx.rerender(); } } },
        { label: "Duplicate", icon: "copy", kbd: "Ctrl+D", on: dup },
        "-",
        { label: n > 1 ? `Delete ${n} commands` : "Delete", icon: "x", danger: true, kbd: "Del", on: del }]);
    });
    row.append(grip(row, arr, i, "action"), h("span", { class: "a-ic" }, icon(d ? d.icon : "box", 14)),
      h("span", { class: "a-t", title: "double-click to edit", on: { dblclick: edit } }, actionText(a, ctx.name)),
      h("span", { class: "a-tools" },
        d && (d.fields.length || d.more) ? h("button", { class: "ghost", title: "edit", on: { click: edit } }, icon("edit", 14)) : null,
        h("button", { class: "ghost", title: "duplicate", on: { click: dup } }, icon("copy", 14)),
        h("button", { class: "ghost", title: "delete", on: { click: () => { arr.splice(i, 1); ctx.changed(); ctx.rerender(); } } }, icon("x", 14))));
    box.append(row);
    if (d && d.outcomes) for (const [res, label] of d.outcomes) {   // a task's “when it's ticked” and “when it's failed”, as branches
      const sub = (a.on || {})[res] || [], cx = Object.assign({}, ctx, { changed() { a.on = a.on || {}; if (sub.length) a.on[res] = sub; else delete a.on[res]; if (!Object.keys(a.on).length) delete a.on; ctx.changed(); } });
      box.append(h("div", { class: "branch" }, h("div", { class: "br-h" }, icon("chevron", 12), " " + label), actionList(sub, cx, { empty: "nothing happens", depth: depth + 1 })));
    }
    if (d && d.branches) for (const o of a[d.branches] || []) {      // an ask's answers, each with its commands, as branches
      const sub = o.do || [], cx = Object.assign({}, ctx, { changed() { if (sub.length) o.do = sub; else delete o.do; ctx.changed(); } });
      box.append(h("div", { class: "branch" }, h("div", { class: "br-h" }, icon("chevron", 12), ` When “${o.label || o.id}”`), actionList(sub, cx, { empty: "nothing happens", depth: depth + 1 })));
    }
  });
  if (!arr.length) box.append(h("div", { class: "a-empty" }, empty));
  box.append(h("button", { class: "a-add", on: { click: async () => {
    const verb = await pickVerb("action"); if (!verb) return;
    const d = ACTION[verb], a = d.make();
    const v = d.fields.length ? await editAction(a, ctx, { isNew: true }) : a;
    if (v) { arr.push(v); ctx.changed(); ctx.rerender(); }
  } } }, icon("plus", 14), " Add a command"));
  sortable(box, arr, "action", ctx, ".arow");
  return box;
}

// ---- a beat as an event page: when, only if, its commands -------------------------------------------------------
export function beatCard(b, i, beats, ctx, { secrets = [] } = {}) {
  b.do = b.do || [];
  const card = h("div", { class: "beat" + (PICK.objs.has(b) ? " picked" : ""), "data-beat": b.id, "data-pick": "beats" });
  card._obj = b; BEATS_OF.set(b, { beats, ctx });
  const bad = ctx.marksIn ? ctx.marksIn(b.id) : [];
  const story = () => (ctx.story ? ctx.story() : {});
  const dupBeat = () => { beats.splice(beats.indexOf(b) + 1, 0, ...pasteBeats(story(), [b])); ctx.changed(); ctx.rerender(); };
  card.addEventListener("click", e => { if (e.target.closest("button,select,input,label,.arow,.pill,.chip,.a-add,.grip")) return; pick("beats", b, { add: e.ctrlKey || e.metaKey || e.shiftKey }); });
  card.addEventListener("contextmenu", e => {
    if (e.target.closest(".arow")) return;
    e.preventDefault(); if (!PICK.objs.has(b)) pick("beats", b);
    const n = picked("beats").length;
    contextMenu(e.clientX, e.clientY, [
      { label: n > 1 ? `Copy ${n} beats` : "Copy the beat", icon: "copy", kbd: "Ctrl+C", on: () => copyNow(copyPicks(), "beat") },
      { label: "Paste beats after", icon: "plus", kbd: "Ctrl+V", disabled: !CLIP.has("beats"), on: () => pasteAtPicks(CLIP.get(), story()) },
      { label: "Paste commands into it", icon: "plus", disabled: !CLIP.has("commands"), on: () => { unpick(); pick("beats", b); pasteAtPicks(CLIP.get(), story()); } },
      { label: "Duplicate", icon: "copy", kbd: "Ctrl+D", on: dupBeat },
      "-",
      { label: n > 1 ? `Delete ${n} beats` : "Delete the beat", icon: "x", danger: true, on: () => { const go = n > 1 ? picked("beats") : [b]; if (confirm(`Delete ${go.map(x => x.id).join(", ")}?`)) { for (const x of go) beats.splice(beats.indexOf(x), 1); unpick(); ctx.changed(); ctx.rerender(); } } }]);
  });
  const flags = b.if || [];
  const ifRow = h("div", { class: "beat-if" }, h("span", { class: "lab" }, "only if"),
    flags.map((f, j) => h("span", { class: "chip" + (f.startsWith("!") ? " neg" : ""), title: f.startsWith("!") ? "this flag must NOT be set" : "this flag must be set" },
      (f.startsWith("!") ? "not " : "") + f.replace(/^!/, ""), h("button", { class: "x", on: { click: () => { flags.splice(j, 1); if (!flags.length) delete b.if; ctx.changed(); ctx.rerender(); } } }, "×"))),
    h("button", { class: "ghost small", on: { click: async () => {
      const draft = { flag: "", not: false }, body = h("div", {}, form([{ key: "flag", label: "Flag", kind: "flag" }, { key: "not", label: "must NOT be set", kind: "bool" }], draft, ctx));
      if (await modal({ title: "Only if a flag…", body }) && draft.flag) { (b.if = b.if || []).push((draft.not ? "!" : "") + draft.flag); ctx.changed(); ctx.rerender(); }
    } } }, icon("plus", 12), flags.length ? "" : " a flag"));
  card.append(h("div", { class: "beat-h" }, grip(card, beats, i, "beat"),
    triggerPill({ get: () => b.when, set: v => { b.when = v; } }, ctx),
    bad.length ? h("span", { class: "pmark " + (bad.some(p => p.sev === "error") ? "err" : "warn"), title: bad.map(p => p.text).join("\n") }, icon("alert", 12), " " + bad.length) : null,
    h("span", { class: "grow" }),
    h("button", { class: "ghost", title: "duplicate this beat", on: { click: dupBeat } }, icon("copy", 14)),
    h("button", { class: "ghost", title: "delete this beat", on: { click: () => { if (confirm(`Delete beat ${b.id}?`)) { beats.splice(i, 1); ctx.changed(); ctx.rerender(); } } } }, icon("x", 14))));
  ifRow.append(h("span", { class: "grow" }),
    h("label", { class: "chk small", title: "the task can end without it" }, h("input", { type: "checkbox", checked: !!b.optional, on: { change: e => { if (e.target.checked) b.optional = true; else delete b.optional; ctx.changed(); } } }), " optional"),
    secrets.length ? (() => { const s = h("select", { class: "small secret", title: "a secret this beat finds", on: { change: e => { if (e.target.value) b.secret = e.target.value; else delete b.secret; ctx.changed(); } } }); options(s, secrets, b.secret, "no secret"); return s; })() : null,
    h("span", { class: "beat-id", title: "its id (for “after another beat”)" }, b.id));
  card.append(
    ifRow, actionList(b.do, ctx, { empty: "No commands: add what happens." }));
  return card;
}
export function nextId(list, base = "b_") {
  const stem = String(base).replace(/_?\d+$/, "") || "b";
  let n = 1; while (list.some(x => x.id === `${stem}_${n}`)) n++;
  return `${stem}_${n}`;
}
export function beatsEditor(beats, ctx, opts = {}) {
  const box = h("div", { class: "beats" });
  beats.forEach((b, i) => box.append(beatCard(b, i, beats, ctx, opts)));
  if (!beats.length) box.append(h("div", { class: "a-empty big" }, "No beats yet. A beat is: when something happens (the task starts, the player enters a room, picks something up), do these commands."));
  box.append(h("button", { class: "a-add big", on: { click: async () => {
    const w = await editTrigger(beats.length ? { enter: "" } : { start: true }, ctx, { title: "A new beat: when should it happen?" }); if (!w) return;
    beats.push({ id: nextId(beats, "b"), when: w, do: [] }); ctx.changed(); ctx.rerender();
  } } }, icon("plus", 14), " New beat"));
  sortable(box, beats, "beat", ctx, ".beat");
  return box;
}

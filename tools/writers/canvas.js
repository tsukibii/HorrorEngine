// The writers' room's chart (docs/WRITERS_ROOM.md §2): your story as shapes joined by arrows, where you put them, like
// a flowchart tool. Shapes come from the palette (dragged on, or clicked to add in the middle of the view); drag a
// shape to move it (the picked ones move together); drag from one of its four dots to another shape for an arrow, or
// into empty space to pick what to make there, joined to it. Double-click a shape to retitle it, an arrow to label it,
// the background to add a shape there. Acts are frames behind groups of shapes: dragged by their title (what's inside
// comes along), resized by their corner. Drag the background (or with the middle button) to pan, the wheel to zoom,
// Shift-drag to pick several in a box; Delete, Ctrl+C, Ctrl+V, Ctrl+D, Ctrl+A, the arrow keys to nudge, F to fit.
// app.js owns the story: it makes new shapes and arrows (their ids, their fields), says what a shape shows, and keeps
// every change (undo, save); this draws and points.

export const SHAPES = {
  start: { label: "Start", w: 130, hint: "where the story begins (one)" },
  scene: { label: "Scene", w: 210, hint: "people talk to you: a cutscene from your eye" },
  talk: { label: "Talk", w: 210, hint: "an L.A. Noire close-up: she asks, you answer, her face answers first" },
  task: { label: "Task", w: 210, hint: "light gameplay: a to-do list, something to find or do" },
  chapter: { label: "Chapter", w: 190, hint: "a night ends: you sleep, a title card, the time of day" },
  choice: { label: "Choice", w: 190, hint: "a decision: the player's, karma's, or an earlier answer's; an arrow for each way" },
  secret: { label: "Secret", w: 190, hint: "a side stream for the curious: found after a point, it shows something and comes back" },
  ending: { label: "Ending", w: 200, hint: "an ending cutscene (three by default: the intended one and two others)" },
  note: { label: "Note", w: 190, hint: "a sticky note for whoever reads the chart (Claude too)" },
};
export const ICONS = { start: "●", scene: "▶", talk: "◉", task: "☐", chapter: "☾", choice: "◇", secret: "★", ending: "■", note: "✎", frame: "▭" };
const SNAP = 10, PAD = 40;
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "on") for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else if (k === "class") e.className = v;
    else if (k === "style") e.setAttribute("style", v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const snap = v => Math.round(v / SNAP) * SNAP;

export class Chart {
  // cb: doc() -> the prototype; onPick(sel) (the picked shapes, arrows and frames changed); changed(what) (an edit
  //     is done: save it, undo can take it back); card(node) -> {kids, cls, title} (what a shape shows);
  //     edgeText(edge) -> its label; make(type, x, y) -> a new shape (not yet in the story); makeEdge(from, to) -> a
  //     new arrow (not yet in it); makeFrame(x, y, w, h) -> a new act frame; problems() -> {id: "error"|"warn"};
  //     ids(prefix) -> a free id like it (pasting)
  constructor(host, cb) {
    this.host = host; this.cb = cb; this.view = { x: 60, y: 60, z: 1 }; this.size = {}; this.clip = null;
    this.sel = { nodes: new Set(), edges: new Set(), frames: new Set() };
    host.innerHTML = ""; host.tabIndex = 0; host.classList.add("chart");
    this.world = el("div", { class: "cworld" });
    this.frameLayer = el("div", { class: "cframes" });
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); this.svg.classList.add("cedges");
    this.nodeLayer = el("div", { class: "cnodes" });
    this.world.append(this.frameLayer, this.svg, this.nodeLayer);
    host.append(this.world);
    this.wire();
  }
  key() { return "writers.view." + ((this.cb.doc() || {}).id || ""); }
  loadView() { try { const v = JSON.parse(localStorage.getItem(this.key()) || "null"); if (v && isFinite(v.z)) { this.view = v; return true; } } catch (e) { } return false; }
  saveView() { try { localStorage.setItem(this.key(), JSON.stringify(this.view)); } catch (e) { } }
  apply() {
    const v = this.view;
    this.world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.z})`;
    this.host.style.backgroundSize = `${20 * v.z}px ${20 * v.z}px`; this.host.style.backgroundPosition = `${v.x}px ${v.y}px`;
    if (this.cb.zoomed) this.cb.zoomed(v.z);
  }
  nodes() { return (this.cb.doc() || {}).nodes || []; }
  edgesOf() { return (this.cb.doc() || {}).edges || []; }
  framesOf() { return (this.cb.doc() || {}).frames || []; }
  node(id) { return this.nodes().find(n => n.id === id); }
  box(id) { const n = this.node(id), s = this.size[id] || { w: (SHAPES[(n || {}).type] || {}).w || 200, h: 80 }; return n ? { x: +n.x || 0, y: +n.y || 0, w: s.w, h: s.h } : null; }

  // ---- drawing ----
  render() {
    const P = this.cb.doc(); if (!P) return;
    if (this.editing) return this.edges();          // a title being typed on the chart: the shapes stay as they are
    const probs = this.cb.problems ? this.cb.problems() : {};
    this.frameLayer.replaceChildren(...this.framesOf().map(f => el("div", { class: "cframe" + (this.sel.frames.has(f.id) ? " sel" : ""), "data-frame": f.id,
      style: `left:${f.x}px;top:${f.y}px;width:${f.w}px;height:${f.h}px;--fc:${f.color || "#8a63d2"}` },
      el("div", { class: "cframe-h", title: "an act: drag its title to move it with what's inside, double-click to rename" }, el("span", { class: "t" }, f.title || "An act")),
      el("div", { class: "cframe-r", title: "drag to resize" }))));
    this.nodeLayer.replaceChildren(...this.nodes().map(n => {
      const c = this.cb.card(n), sh = SHAPES[n.type] || SHAPES.scene;
      const d = el("div", { class: `shape ${n.type}${this.sel.nodes.has(n.id) ? " sel" : ""}${probs[n.id] ? " p-" + probs[n.id] : ""}${c.cls ? " " + c.cls : ""}`,
        "data-id": n.id, title: c.title || "", style: `left:${+n.x || 0}px;top:${+n.y || 0}px;width:${sh.w}px` }, ...c.kids);
      if (n.type !== "note") for (const side of ["n", "e", "s", "w"]) d.append(el("span", { class: "port " + side, title: "drag to another shape for an arrow (or into empty space for a new one)" }));
      return d;
    }));
    for (const d of this.nodeLayer.children) this.size[d.dataset.id] = { w: d.offsetWidth, h: d.offsetHeight };
    this.edges();
    if (!this.viewSet) { this.viewSet = true; if (!this.loadView()) this.fit(); else this.apply(); }
  }
  // where an arrow leaves one shape and meets the other: the sides facing each other
  route(a, b) {
    const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 }, dx = bc.x - ac.x, dy = bc.y - ac.y;
    let p1, p2, n1, n2;
    if (Math.abs(dx) >= Math.abs(dy) * 0.9) { const s = dx >= 0 ? 1 : -1; p1 = { x: s > 0 ? a.x + a.w : a.x, y: ac.y }; p2 = { x: s > 0 ? b.x : b.x + b.w, y: bc.y }; n1 = { x: s, y: 0 }; n2 = { x: -s, y: 0 }; }
    else { const s = dy >= 0 ? 1 : -1; p1 = { x: ac.x, y: s > 0 ? a.y + a.h : a.y }; p2 = { x: bc.x, y: s > 0 ? b.y : b.y + b.h }; n1 = { x: 0, y: s }; n2 = { x: 0, y: -s }; }
    const d = Math.max(30, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.42);
    const c1 = { x: p1.x + n1.x * d, y: p1.y + n1.y * d }, c2 = { x: p2.x + n2.x * d, y: p2.y + n2.y * d };
    const mid = { x: 0.125 * p1.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * p2.x, y: 0.125 * p1.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * p2.y };
    return { d: `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`, mid };
  }
  edges(extra = "") {
    let W = 0, H = 0;
    for (const n of this.nodes()) { const b = this.box(n.id); W = Math.max(W, b.x + b.w + 400); H = Math.max(H, b.y + b.h + 400); }
    for (const f of this.framesOf()) { W = Math.max(W, f.x + f.w + 400); H = Math.max(H, f.y + f.h + 400); }
    this.svg.setAttribute("width", W); this.svg.setAttribute("height", H);
    let s = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#8b8b96"/></marker>
      <marker id="ahs" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#e7b04a"/></marker></defs>`;
    for (const e of this.edgesOf()) {
      const a = this.box(e.from), b = this.box(e.to); if (!a || !b) continue;
      const r = this.route(a, b), sel = this.sel.edges.has(e.id), to = this.node(e.to) || {}, secret = to.type === "secret" || (this.node(e.from) || {}).type === "secret";
      s += `<path class="ehit" data-edge="${esc(e.id)}" d="${r.d}"/>`;
      s += `<path class="edge${sel ? " sel" : ""}${secret ? " secret" : ""}" d="${r.d}" marker-end="url(#${sel ? "ahs" : "ah"})"/>`;
      const label = this.cb.edgeText(e);
      if (label) {
        const w = Math.min(220, 12 + label.length * 6.4);
        s += `<g class="elabel${sel ? " sel" : ""}" data-edge="${esc(e.id)}" transform="translate(${r.mid.x},${r.mid.y})"><rect x="${-w / 2}" y="-10" width="${w}" height="20" rx="10"/><text text-anchor="middle" y="4">${esc(label.length > 34 ? label.slice(0, 33) + "…" : label)}</text></g>`;
      }
    }
    this.svg.innerHTML = s + extra;
  }

  // ---- the view ----
  extent() {
    const rs = this.nodes().map(n => { const b = this.box(n.id); return [b.x, b.y, b.x + b.w, b.y + b.h]; }).concat(this.framesOf().map(f => [f.x, f.y, f.x + f.w, f.y + f.h]));
    if (!rs.length) return null;
    return [Math.min(...rs.map(r => r[0])), Math.min(...rs.map(r => r[1])), Math.max(...rs.map(r => r[2])), Math.max(...rs.map(r => r[3]))];
  }
  fit() {
    const ex = this.extent(), w = this.host.clientWidth || 1000, h = this.host.clientHeight || 600;
    if (!ex) { this.view = { x: 60, y: 60, z: 1 }; this.apply(); return; }
    const [x0, y0, x1, y1] = ex, z = Math.max(0.2, Math.min(1.1, Math.min((w - 2 * PAD) / (x1 - x0 + 1), (h - 2 * PAD) / (y1 - y0 + 1))));
    this.view = { z, x: (w - (x1 - x0) * z) / 2 - x0 * z, y: (h - (y1 - y0) * z) / 2 - y0 * z };
    this.apply(); this.saveView();
  }
  zoomBy(f, mx, my) {
    const v = this.view, z = Math.max(0.2, Math.min(2, v.z * f));
    if (mx === undefined) { mx = this.host.clientWidth / 2; my = this.host.clientHeight / 2; }
    v.x = mx - (mx - v.x) * (z / v.z); v.y = my - (my - v.y) * (z / v.z); v.z = z; this.apply(); this.saveView();
  }
  center(id) {
    const b = this.box(id); if (!b) return;
    const v = this.view; v.x = this.host.clientWidth / 2 - (b.x + b.w / 2) * v.z; v.y = this.host.clientHeight / 2 - (b.y + b.h / 2) * v.z; this.apply(); this.saveView();
  }
  middle() { const v = this.view; return [(this.host.clientWidth / 2 - v.x) / v.z, (this.host.clientHeight / 2 - v.y) / v.z]; }
  toWorld(cx, cy) { const r = this.host.getBoundingClientRect(), v = this.view; return [(cx - r.left - v.x) / v.z, (cy - r.top - v.y) / v.z]; }
  toClient(x, y) { const r = this.host.getBoundingClientRect(), v = this.view; return [r.left + v.x + x * v.z, r.top + v.y + y * v.z]; }

  // ---- picking ----
  pick(sel, add = false) {
    if (!add) this.sel = { nodes: new Set(), edges: new Set(), frames: new Set() };
    for (const k of ["nodes", "edges", "frames"]) for (const id of (sel && sel[k]) || []) { if (add && this.sel[k].has(id)) this.sel[k].delete(id); else this.sel[k].add(id); }
    this.render(); this.cb.onPick(this.sel);
  }
  clear() { this.pick(null); }
  picked() { return this.sel; }

  // ---- edits ----
  add(type, x, y, from) {                        // a new shape there (its middle at x, y), joined from `from` if given
    const n = this.cb.make(type, 0, 0); if (!n) return null;
    const w = (SHAPES[type] || SHAPES.scene).w;
    n.x = snap(x - w / 2); n.y = snap(y - 40);
    const P = this.cb.doc(); P.nodes.push(n);
    if (from) { const e = this.cb.makeEdge(from, n.id); if (e) P.edges.push(e); }
    this.sel = { nodes: new Set([n.id]), edges: new Set(), frames: new Set() };
    this.render(); this.cb.changed("add"); this.cb.onPick(this.sel);
    if (type !== "start") setTimeout(() => this.editTitle(n.id), 0);
    return n;
  }
  connect(from, to) {
    const P = this.cb.doc();
    if (from === to || P.edges.some(e => e.from === from && e.to === to)) return;
    const e = this.cb.makeEdge(from, to); if (!e) return;
    P.edges.push(e); this.sel = { nodes: new Set(), edges: new Set([e.id]), frames: new Set() };
    this.render(); this.cb.changed("connect"); this.cb.onPick(this.sel);
  }
  remove() {                                      // the picked: shapes (with their arrows), arrows, frames (not what's in them)
    const P = this.cb.doc(), s = this.sel;
    if (!s.nodes.size && !s.edges.size && !s.frames.size) return;
    P.nodes = P.nodes.filter(n => !s.nodes.has(n.id));
    P.edges = P.edges.filter(e => !s.edges.has(e.id) && !s.nodes.has(e.from) && !s.nodes.has(e.to));
    P.frames = (P.frames || []).filter(f => !s.frames.has(f.id));
    this.clear(); this.cb.changed("remove");
  }
  copy() {
    const P = this.cb.doc(), ids = this.sel.nodes; if (!ids.size) return false;
    this.clip = { nodes: P.nodes.filter(n => ids.has(n.id) && n.type !== "start"), edges: P.edges.filter(e => ids.has(e.from) && ids.has(e.to)) };
    this.clip = JSON.parse(JSON.stringify(this.clip));
    try { localStorage.setItem("writers.clip", JSON.stringify(this.clip)); } catch (e) { }
    return true;
  }
  paste(dx = 30, dy = 30, at = null) {           // what was copied, again: new ids, the arrows between them kept (at: its corner there)
    let clip = this.clip; if (!clip) try { clip = JSON.parse(localStorage.getItem("writers.clip") || "null"); } catch (e) { }
    if (!clip || !clip.nodes.length) return;
    if (at) { dx = at[0] - Math.min(...clip.nodes.map(n => +n.x || 0)); dy = at[1] - Math.min(...clip.nodes.map(n => +n.y || 0)); }
    const P = this.cb.doc(), map = {}, fresh = JSON.parse(JSON.stringify(clip));
    for (const n of fresh.nodes) { const id = this.cb.ids(n.type); map[n.id] = id; n.id = id; n.x = snap(+n.x + dx); n.y = snap(+n.y + dy); P.nodes.push(n); }
    for (const e of fresh.edges) { const x = this.cb.makeEdge(map[e.from], map[e.to]); if (x) { Object.assign(x, { label: e.label || "", when: e.when, sets: e.sets }); P.edges.push(x); } }
    this.clip = JSON.parse(JSON.stringify(fresh));             // the next paste lands further on
    this.sel = { nodes: new Set(Object.values(map)), edges: new Set(), frames: new Set() };
    this.render(); this.cb.changed("paste"); this.cb.onPick(this.sel);
  }
  nudge(dx, dy) {
    if (!this.sel.nodes.size) return;
    for (const n of this.nodes()) if (this.sel.nodes.has(n.id)) { n.x = (+n.x || 0) + dx; n.y = (+n.y || 0) + dy; }
    this.render(); this.cb.changed("move");
  }
  frameAround(ids) {                              // an act round the picked shapes
    const bs = [...ids].map(id => this.box(id)).filter(Boolean); if (!bs.length) return;
    const x0 = Math.min(...bs.map(b => b.x)) - 30, y0 = Math.min(...bs.map(b => b.y)) - 60, x1 = Math.max(...bs.map(b => b.x + b.w)) + 30, y1 = Math.max(...bs.map(b => b.y + b.h)) + 30;
    const f = this.cb.makeFrame(snap(x0), snap(y0), snap(x1 - x0), snap(y1 - y0)); if (!f) return;
    const P = this.cb.doc(); (P.frames = P.frames || []).push(f);
    this.sel = { nodes: new Set(), edges: new Set(), frames: new Set([f.id]) };
    this.render(); this.cb.changed("frame"); this.cb.onPick(this.sel);
    setTimeout(() => this.editFrame(f.id), 0);
  }

  // ---- typing on the chart ----
  editTitle(id) {                                 // the shape's title (a note's text) typed where it is
    const d = this.nodeLayer.querySelector(`.shape[data-id="${CSS.escape(id)}"]`), n = this.node(id); if (!d || !n) return;
    const t = d.querySelector(n.type === "note" ? ".sh-text" : ".sh-title"); if (!t) return;
    const key = n.type === "note" ? "text" : "title", was = n[key] || "";
    this.editing = id;
    t.textContent = was; t.contentEditable = "true"; t.classList.add("editing"); t.focus();
    const r = document.createRange(); r.selectNodeContents(t); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    let over = false;                               // once: Enter's commit, then the blur it causes, is one edit
    const done = keep => { if (over) return; over = true; t.removeEventListener("keydown", kd); t.removeEventListener("blur", bl); t.contentEditable = "false"; this.editing = null;
      if (keep) { const v = t.innerText.replace(/\s+$/g, ""); if (v !== was) { n[key] = v; this.cb.changed("title"); } } this.render(); this.cb.onPick(this.sel); };
    const kd = e => { e.stopPropagation(); if (e.key === "Enter" && (n.type !== "note" || !e.shiftKey)) { e.preventDefault(); done(true); } if (e.key === "Escape") { e.preventDefault(); done(false); } };
    const bl = () => done(true);
    t.addEventListener("keydown", kd); t.addEventListener("blur", bl);
  }
  editEdge(id) {                                  // an arrow's label, typed at its middle
    const e = this.edgesOf().find(x => x.id === id); if (!e) return;
    const a = this.box(e.from), b = this.box(e.to); if (!a || !b) return;
    if (this.cb.edgeEditable && !this.cb.edgeEditable(e)) { this.cb.onPick(this.sel); return; }
    const m = this.route(a, b).mid, [cx, cy] = this.toClient(m.x, m.y);
    const inp = el("input", { class: "elabel-edit", value: e.label || "", placeholder: "what the player does", style: `left:${cx - 110}px;top:${cy - 14}px` });
    document.body.append(inp); inp.focus(); inp.select();
    let over = false;
    const done = keep => { if (over) return; over = true; inp.remove(); if (keep && inp.value.trim() !== (e.label || "")) { e.label = inp.value.trim(); this.cb.changed("label"); } this.render(); this.cb.onPick(this.sel); };
    inp.addEventListener("keydown", ev => { ev.stopPropagation(); if (ev.key === "Enter") done(true); if (ev.key === "Escape") done(false); });
    inp.addEventListener("blur", () => done(true));
  }
  editFrame(id) {
    const f = this.framesOf().find(x => x.id === id), d = this.frameLayer.querySelector(`[data-frame="${CSS.escape(id)}"] .t`); if (!f || !d) return;
    this.editing = id;
    d.textContent = f.title || ""; d.contentEditable = "true"; d.focus();
    const r = document.createRange(); r.selectNodeContents(d); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    let over = false;
    const done = keep => { if (over) return; over = true; d.contentEditable = "false"; d.removeEventListener("keydown", kd); d.removeEventListener("blur", bl); this.editing = null; if (keep && d.textContent.trim() !== (f.title || "")) { f.title = d.textContent.trim(); this.cb.changed("frame"); } this.render(); this.cb.onPick(this.sel); };
    const kd = e => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); done(true); } if (e.key === "Escape") done(false); };
    const bl = () => done(true);
    d.addEventListener("keydown", kd); d.addEventListener("blur", bl);
  }
  menu(cx, cy, pick, title = "Add here") {        // what to make: the shapes, by type
    document.querySelectorAll(".cmenu").forEach(m => m.remove());
    const has = this.nodes().some(n => n.type === "start");
    const m = el("div", { class: "cmenu", style: `left:${cx}px;top:${cy}px` }, el("div", { class: "cmenu-h" }, title),
      ...Object.entries(SHAPES).filter(([t]) => t !== "start" || !has).map(([t, s]) =>
        el("button", { class: "cmenu-i " + t, title: s.hint, on: { click: () => { m.remove(); pick(t); } } }, el("span", { class: "ic" }, ICONS[t]), " " + s.label)));
    document.body.append(m);
    const r = m.getBoundingClientRect(); if (r.bottom > innerHeight) m.style.top = Math.max(8, innerHeight - r.height - 8) + "px"; if (r.right > innerWidth) m.style.left = Math.max(8, innerWidth - r.width - 8) + "px";
    const off = ev => { if (!m.contains(ev.target)) { m.remove(); window.removeEventListener("mousedown", off, true); } };
    setTimeout(() => window.addEventListener("mousedown", off, true), 0);
    return m;
  }

  // ---- pointing ----
  wire() {
    const host = this.host;
    host.addEventListener("wheel", e => { e.preventDefault(); const r = host.getBoundingClientRect();
      if (e.ctrlKey || Math.abs(e.deltaY) > 0 && !e.shiftKey) this.zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
      else { this.view.x -= e.deltaX || e.deltaY; this.apply(); this.saveView(); } }, { passive: false });
    host.addEventListener("mousedown", e => {
      if (e.target.isContentEditable) return;
      host.focus({ preventScroll: true });
      const port = e.target.closest(".port"), shape = e.target.closest(".shape"), edge = e.target.closest("[data-edge]");
      const fh = e.target.closest(".cframe-h"), fr = e.target.closest(".cframe-r");
      if (e.button === 1) return this.pan(e);
      if (e.button !== 0) return;
      if (e.detail >= 2) return this.double(e);    // the second press of a double-click (a redraw on the first
                                                   // replaces what was clicked, so the browser's dblclick may never come)
      if (port && shape) return this.link(e, shape.dataset.id);
      if (shape) return this.drag(e, shape.dataset.id);
      if (edge) { e.preventDefault(); return this.pick({ edges: [edge.dataset.edge] }, e.shiftKey || e.ctrlKey || e.metaKey); }
      if (fr) return this.resizeFrame(e, fr.parentNode.dataset.frame);
      if (fh) return this.dragFrame(e, fh.parentNode.dataset.frame);
      if (e.shiftKey) return this.boxPick(e);
      return this.pan(e, true);
    });
    host.addEventListener("dblclick", e => e.preventDefault());
    host.addEventListener("contextmenu", e => {
      e.preventDefault();
      const shape = e.target.closest(".shape");
      if (shape && !this.sel.nodes.has(shape.dataset.id)) this.pick({ nodes: [shape.dataset.id] });
      if (this.cb.context) this.cb.context(shape ? shape.dataset.id : null, e.clientX, e.clientY, this.toWorld(e.clientX, e.clientY));
    });
    host.addEventListener("dragover", e => { if ([...e.dataTransfer.types].includes("text/x-shape")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } });
    host.addEventListener("drop", e => {
      const t = e.dataTransfer.getData("text/x-shape"); if (!t) return;
      e.preventDefault(); const [x, y] = this.toWorld(e.clientX, e.clientY);
      if (t === "frame") return this.frameDrop(x, y);
      this.add(t, x, y);
    });
    host.addEventListener("keydown", e => {
      if (e.target !== host) return;
      const k = e.key, mod = e.ctrlKey || e.metaKey;
      if (k === "Delete" || k === "Backspace") { e.preventDefault(); this.remove(); }
      else if (mod && k.toLowerCase() === "a") { e.preventDefault(); this.pick({ nodes: this.nodes().map(n => n.id) }); }
      else if (mod && k.toLowerCase() === "c") { if (this.copy()) e.preventDefault(); }
      else if (mod && k.toLowerCase() === "v") { e.preventDefault(); this.paste(); }
      else if (mod && k.toLowerCase() === "d") { e.preventDefault(); if (this.copy()) this.paste(); }
      else if (k.startsWith("Arrow") && this.sel.nodes.size) { e.preventDefault(); const s = e.shiftKey ? SNAP : 1; this.nudge(k === "ArrowLeft" ? -s : k === "ArrowRight" ? s : 0, k === "ArrowUp" ? -s : k === "ArrowDown" ? s : 0); }
      else if (!mod && (k === "f" || k === "F")) { e.preventDefault(); this.fit(); }
      else if (k === "Escape") { this.clear(); document.querySelectorAll(".cmenu").forEach(m => m.remove()); }
      else if (k === "Enter" && this.sel.nodes.size === 1) { e.preventDefault(); this.editTitle([...this.sel.nodes][0]); }
    });
  }
  double(e) {                                     // a double-click: retitle a shape, label an arrow, rename an act, or add here
    e.preventDefault();
    const shape = e.target.closest(".shape"), edge = e.target.closest("[data-edge]"), fh = e.target.closest(".cframe-h");
    if (shape) return this.editTitle(shape.dataset.id);
    if (edge) { this.sel = { nodes: new Set(), edges: new Set([edge.dataset.edge]), frames: new Set() }; return this.editEdge(edge.dataset.edge); }
    if (fh) return this.editFrame(fh.parentNode.dataset.frame);
    const [x, y] = this.toWorld(e.clientX, e.clientY);
    this.menu(e.clientX, e.clientY, t => this.add(t, x, y));
  }
  frameDrop(x, y) { const f = this.cb.makeFrame(snap(x - 220), snap(y - 40), 440, 260); if (!f) return; const P = this.cb.doc(); (P.frames = P.frames || []).push(f);
    this.sel = { nodes: new Set(), edges: new Set(), frames: new Set([f.id]) }; this.render(); this.cb.changed("frame"); this.cb.onPick(this.sel); setTimeout(() => this.editFrame(f.id), 0); }
  pan(e, clickClears = false) {
    e.preventDefault(); const v = this.view, sx = e.clientX, sy = e.clientY, ox = v.x, oy = v.y; let moved = false;
    this.host.classList.add("panning");
    const mv = ev => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 3) moved = true; v.x = ox + ev.clientX - sx; v.y = oy + ev.clientY - sy; this.apply(); };
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); this.host.classList.remove("panning"); this.saveView();
      if (!moved && clickClears && (this.sel.nodes.size || this.sel.edges.size || this.sel.frames.size)) this.clear(); };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
  boxPick(e) {
    e.preventDefault(); const r = this.host.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
    const box = el("div", { class: "cbox" }); this.host.append(box);
    const rect = ev => [Math.min(sx, ev.clientX), Math.min(sy, ev.clientY), Math.abs(ev.clientX - sx), Math.abs(ev.clientY - sy)];
    const mv = ev => { const [x, y, w, h] = rect(ev); Object.assign(box.style, { left: x - r.left + "px", top: y - r.top + "px", width: w + "px", height: h + "px" }); };
    const up = ev => {
      window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); box.remove();
      const [x, y, w, h] = rect(ev), [ax, ay] = this.toWorld(x, y), [bx, by] = this.toWorld(x + w, y + h);
      const ids = this.nodes().filter(n => { const b = this.box(n.id); return b.x < bx && b.x + b.w > ax && b.y < by && b.y + b.h > ay; }).map(n => n.id);
      this.pick({ nodes: ids }, e.ctrlKey || e.metaKey);
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
  drag(e, id) {                                   // a shape (and the others picked with it) moved; a click picks it
    const add = e.shiftKey || e.ctrlKey || e.metaKey, sx = e.clientX, sy = e.clientY;
    if (e.target.isContentEditable) return;
    e.preventDefault();
    const group = this.sel.nodes.has(id) && !add ? [...this.sel.nodes] : [id];
    const p0 = Object.fromEntries(group.map(k => { const n = this.node(k); return [k, { x: +n.x || 0, y: +n.y || 0 }]; }));
    const els = Object.fromEntries(group.map(k => [k, this.nodeLayer.querySelector(`.shape[data-id="${CSS.escape(k)}"]`)]));
    let moved = false;
    const mv = ev => {
      const dx = (ev.clientX - sx) / this.view.z, dy = (ev.clientY - sy) / this.view.z;
      if (!moved && Math.hypot(dx, dy) * this.view.z < 4) return;
      if (add) return;
      if (!moved && !this.sel.nodes.has(id)) { this.sel = { nodes: new Set([id]), edges: new Set(), frames: new Set() }; this.cb.onPick(this.sel); }
      moved = true;
      for (const k of group) { const n = this.node(k); n.x = p0[k].x + dx; n.y = p0[k].y + dy; const d = els[k]; if (d) { d.classList.add("lifting"); d.style.left = n.x + "px"; d.style.top = n.y + "px"; } }
      this.edges();
    };
    const up = () => {
      window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up);
      if (!moved) { this.pick({ nodes: [id] }, add); return; }
      for (const k of group) { const n = this.node(k); n.x = snap(n.x); n.y = snap(n.y); }
      this.render(); this.cb.changed("move");
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
  inside(f) {                                     // the shapes whose middles are in an act's frame
    return this.nodes().filter(n => { const b = this.box(n.id), cx = b.x + b.w / 2, cy = b.y + b.h / 2; return cx > f.x && cx < f.x + f.w && cy > f.y && cy < f.y + f.h; }).map(n => n.id);
  }
  dragFrame(e, fid) {                             // an act by its title: what's inside comes along; a click picks it
    e.preventDefault();
    const f = this.framesOf().find(x => x.id === fid); if (!f) return;
    const ids = this.inside(f), sx = e.clientX, sy = e.clientY, f0 = { x: f.x, y: f.y }, p0 = Object.fromEntries(ids.map(k => { const n = this.node(k); return [k, { x: +n.x, y: +n.y }]; }));
    let moved = false;
    const mv = ev => {
      const dx = (ev.clientX - sx) / this.view.z, dy = (ev.clientY - sy) / this.view.z;
      if (!moved && Math.hypot(dx, dy) * this.view.z < 4) return;
      moved = true; f.x = f0.x + dx; f.y = f0.y + dy;
      for (const k of ids) { const n = this.node(k); n.x = p0[k].x + dx; n.y = p0[k].y + dy; }
      this.render();
    };
    const up = () => {
      window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up);
      if (!moved) return this.pick({ frames: [fid] }, e.shiftKey);
      f.x = snap(f.x); f.y = snap(f.y); for (const k of ids) { const n = this.node(k); n.x = snap(n.x); n.y = snap(n.y); }
      this.render(); this.cb.changed("move");
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
  resizeFrame(e, fid) {
    e.preventDefault(); e.stopPropagation();
    const f = this.framesOf().find(x => x.id === fid); if (!f) return;
    const sx = e.clientX, sy = e.clientY, w0 = f.w, h0 = f.h;
    const mv = ev => { f.w = Math.max(160, w0 + (ev.clientX - sx) / this.view.z); f.h = Math.max(100, h0 + (ev.clientY - sy) / this.view.z); this.render(); };
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); f.w = snap(f.w); f.h = snap(f.h); this.render(); this.cb.changed("frame"); };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
  link(e, from) {                                 // an arrow from a shape's dot: onto another shape, or into empty space
    e.preventDefault(); e.stopPropagation();
    const a = this.box(from);
    const mv = ev => {
      const [x, y] = this.toWorld(ev.clientX, ev.clientY), r = this.route(a, { x: x - 1, y: y - 1, w: 2, h: 2 });
      this.edges(`<path class="edge drawing" d="${r.d}"/><circle cx="${x}" cy="${y}" r="4" fill="#e7b04a"/>`);
      this.nodeLayer.querySelectorAll(".shape.target").forEach(c => c.classList.remove("target"));
      const over = document.elementFromPoint(ev.clientX, ev.clientY), c = over && over.closest(".shape");
      if (c && c.dataset.id !== from) c.classList.add("target");
    };
    const up = ev => {
      window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up);
      this.nodeLayer.querySelectorAll(".shape.target").forEach(c => c.classList.remove("target")); this.edges();
      const over = document.elementFromPoint(ev.clientX, ev.clientY), c = over && over.closest(".shape");
      if (c && c.dataset.id && c.dataset.id !== from) return this.connect(from, c.dataset.id);
      if (over && this.host.contains(over)) { const [x, y] = this.toWorld(ev.clientX, ev.clientY); this.menu(ev.clientX, ev.clientY, t => this.add(t, x, y, from), "Add, joined"); }
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
}

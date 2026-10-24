// The flow board, the desk's map of the story: nodes where you put them (`xy`, kept in the story), a wrapped
// auto-layout until you move one; pan (drag the background, or with the middle button) and zoom (the wheel, around
// the pointer; Fit shows everything); drag a node to move it; drag from its port (the dot on its right) to another
// node to connect them, or into empty space for a new node there; drop a node type from the palette to add one.
// app.js says what's on a card and what each change does to the story (the callbacks), so this stays the map's own.
import { icon } from "./icons.js";

export const CARD_W = 176, CARD_H = 56;
const COL = 214, ROW = 84, BAND_GAP = 46, PAD = 24, SNAP = 8, READ_Z = 0.85;   // READ_Z: the zoom a board opens at (cards readable)
const el = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [n, v] of Object.entries(a)) { if (n === "on") for (const [ev, f] of Object.entries(v)) e.addEventListener(ev, f); else if (n === "style") e.style.cssText = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(n, v === true ? "" : v); } for (const c of k.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };

export class Board {
  // cb: story(), selected(), select(id), card(id, n) -> {cls, kids, title}, outs(id) -> [{to, label, kind}],
  //     moved({id: [x, y]}) (every node's place, once any is moved), connect(from, to), create(type, [x, y], from|null)
  constructor(host, cb) {
    this.host = host; this.cb = cb; this.view = { x: 0, y: 0, z: 1 }; this.pos = {};
    host.innerHTML = ""; host.tabIndex = 0;
    this.world = el("div", { class: "bworld" });
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); this.svg.id = "edges";
    this.world.append(this.svg); host.append(this.world);
    this.tools = el("div", { class: "btools" },
      el("button", { class: "ghost", title: "zoom in", on: { click: () => this.zoomBy(1.25) } }, icon("zoomin", 16)),
      el("button", { class: "ghost", title: "zoom out", on: { click: () => this.zoomBy(0.8) } }, icon("zoomout", 16)),
      el("button", { class: "ghost", title: "fit everything (F)", on: { click: () => this.fit() } }, icon("fit", 16)),
      el("button", { class: "ghost", title: "tidy: lay the nodes out again in reading order", on: { click: () => this.tidy() } }, icon("tree", 16)));
    let seen = false; try { seen = localStorage.getItem("dd.board.hinted") === "1"; } catch (e) { }
    if (!seen) host.append(el("div", { class: "bhint" }, "drag a node to move it · drag its dot to connect · double-click empty space to add · wheel to zoom · drag the background to pan · F fits",
      el("button", { class: "ghost", title: "got it", on: { click: e => { e.target.closest(".bhint").remove(); try { localStorage.setItem("dd.board.hinted", "1"); } catch (x) { } } } }, icon("x", 12))));
    host.append(this.tools);
    this.wire();
  }
  key() { return "dd.board." + (this.cb.game() || ""); }
  loadView() { try { const v = JSON.parse(localStorage.getItem(this.key()) || "null"); if (v && isFinite(v.z)) { this.view = v; return true; } } catch (e) { } return false; }
  saveView() { try { localStorage.setItem(this.key(), JSON.stringify(this.view)); } catch (e) { } }
  apply() { const v = this.view; this.world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.z})`; this.host.style.backgroundSize = `${18 * v.z}px ${18 * v.z}px`; this.host.style.backgroundPosition = `${v.x}px ${v.y}px`; }

  // ---- where each node sits: its xy, else the wrapped reading-order layout ----
  layout() {
    const S = this.cb.story(), flow = S.flow, ids = Object.keys(flow), auto = this.autoLayout(), pos = {};
    for (const id of ids) pos[id] = Array.isArray(flow[id].xy) ? { x: +flow[id].xy[0], y: +flow[id].xy[1] } : auto[id];
    return pos;
  }
  autoLayout() {
    const S = this.cb.story(), flow = S.flow, col = {}, order = [], q = [[S.game.start, 0]], seen = new Set();
    while (q.length) { const [id, c] = q.shift(); if (!flow[id] || seen.has(id)) continue; seen.add(id); col[id] = c; order.push(id); for (const t of this.cb.outs(id)) q.push([t.to, c + 1]); }
    const maxc = Math.max(0, ...Object.values(col));
    for (const id of Object.keys(flow)) if (!seen.has(id)) { col[id] = maxc + 1; order.push(id); }
    const K = Math.max(3, Math.floor(((this.host.clientWidth || 900) / READ_Z - PAD) / COL)), rows = {}, bandRows = {};   // lines of text: as wide as the board reads
    for (const id of order) { const c = col[id]; rows[c] = (rows[c] || 0) + 1; const b = Math.floor(c / K); bandRows[b] = Math.max(bandRows[b] || 0, rows[c]); }
    const top = {}; let y = PAD; for (let b = 0; b <= Math.floor((maxc + 1) / K); b++) { top[b] = y; y += (bandRows[b] || 0) * ROW + BAND_GAP; }
    const used = {}, pos = {};
    for (const id of order) { const c = col[id], b = Math.floor(c / K), r = used[c] = (used[c] || 0); used[c]++; pos[id] = { x: PAD + (c % K) * COL, y: top[b] + r * ROW }; }
    return pos;
  }
  tidy() {                                     // lay everything out again (and keep it), in reading order
    const S = this.cb.story(); for (const n of Object.values(S.flow)) delete n.xy;
    const auto = this.autoLayout(), all = {}; for (const [id, p] of Object.entries(auto)) all[id] = [p.x, p.y];
    this.cb.moved(all); this.render(); this.fit();
  }

  // ---- drawing ----
  render() {
    const S = this.cb.story(); if (!S) return;
    this.pos = this.layout();
    this.world.querySelectorAll(".card").forEach(c => c.remove());
    for (const [id, n] of Object.entries(S.flow)) {
      const p = this.pos[id], c = this.cb.card(id, n), sel = this.cb.selected() === id;
      const card = el("div", { class: `card ${n.type}${sel ? " sel" : ""}${c.cls ? " " + c.cls : ""}`, "data-id": id, title: c.title || "", style: `left:${p.x}px;top:${p.y}px` }, ...c.kids);
      if (n.type !== "ending") card.append(el("span", { class: "port", title: "drag to another node to connect (or into empty space for a new one)" }));
      this.world.append(card);
    }
    this.edges();
    if (!this.viewSet) { this.viewSet = true; if (!this.loadView()) this.home(); else this.apply(); }
  }
  edges(extra = "") {
    const S = this.cb.story(), pos = this.pos;
    let W = 0, H = 0; for (const p of Object.values(pos)) { W = Math.max(W, p.x + CARD_W + 80); H = Math.max(H, p.y + CARD_H + 80); }
    this.svg.setAttribute("width", W + 400); this.svg.setAttribute("height", H + 400);
    let paths = '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="#77777f"/></marker></defs>';
    for (const id of Object.keys(S.flow)) {
      const a = pos[id];
      for (const o of this.cb.outs(id)) {
        const t = pos[o.to]; if (!a || !t) continue;
        const x1 = a.x + CARD_W, y1 = a.y + CARD_H / 2, x2 = t.x, y2 = t.y + CARD_H / 2, back = x2 < x1 - 10;
        const dx = Math.max(40, Math.abs(x2 - x1) / 2);
        const d = back ? `M${x1},${y1} C${x1 + 70},${y1} ${x2 - 70},${y2} ${x2},${y2}` : `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
        const col = o.kind === "interrupt" ? "#b04a42" : o.kind === "timer" ? "#b0862a" : "#66666f";
        paths += `<path d="${d}" stroke="${col}" fill="none" stroke-width="1.7" ${o.kind ? 'stroke-dasharray="5 4"' : ""} marker-end="url(#ar)" opacity=".9"/>`;
        if (o.label) { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 5; paths += `<text x="${mx}" y="${my}" text-anchor="middle" fill="${o.kind ? col : "#d39a45"}" font-size="10.5" paint-order="stroke" stroke="#121214" stroke-width="3">${esc(o.label).slice(0, 26)}</text>`; }
      }
    }
    this.svg.innerHTML = paths + extra;
  }
  // ---- the view ----
  fit() {
    const ps = Object.values(this.pos); if (!ps.length) return;
    const x0 = Math.min(...ps.map(p => p.x)), y0 = Math.min(...ps.map(p => p.y)), x1 = Math.max(...ps.map(p => p.x + CARD_W)), y1 = Math.max(...ps.map(p => p.y + CARD_H));
    const w = this.host.clientWidth || 900, h = this.host.clientHeight || 400, z = Math.max(0.3, Math.min(1.1, Math.min((w - 40) / (x1 - x0 + 1), (h - 50) / (y1 - y0 + 1))));
    this.view = { z, x: (w - (x1 - x0) * z) / 2 - x0 * z, y: Math.max(16, (h - (y1 - y0) * z) / 2) - y0 * z };
    this.apply(); this.saveView();
  }
  home() {                                     // readable, from the story's start (Fit shows everything)
    const ps = Object.values(this.pos); if (!ps.length) return;
    const x0 = Math.min(...ps.map(p => p.x)), y0 = Math.min(...ps.map(p => p.y));
    this.view = { z: READ_Z, x: 16 - x0 * READ_Z, y: 16 - y0 * READ_Z }; this.apply(); this.saveView();
  }
  zoomBy(f, mx, my) {
    const v = this.view, z = Math.max(0.25, Math.min(2, v.z * f)); if (mx === undefined) { mx = this.host.clientWidth / 2; my = this.host.clientHeight / 2; }
    v.x = mx - (mx - v.x) * (z / v.z); v.y = my - (my - v.y) * (z / v.z); v.z = z; this.apply(); this.saveView();
  }
  center(id) {
    const p = this.pos[id]; if (!p) return;
    const v = this.view; v.x = this.host.clientWidth / 2 - (p.x + CARD_W / 2) * v.z; v.y = this.host.clientHeight / 2 - (p.y + CARD_H / 2) * v.z; this.apply(); this.saveView();
  }
  toWorld(cx, cy) { const r = this.host.getBoundingClientRect(), v = this.view; return [(cx - r.left - v.x) / v.z, (cy - r.top - v.y) / v.z]; }

  // ---- pointing ----
  wire() {
    const host = this.host;
    host.addEventListener("wheel", e => { e.preventDefault(); const r = host.getBoundingClientRect(); this.zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    host.addEventListener("mousedown", e => {
      const port = e.target.closest(".port"), card = e.target.closest(".card");
      if (e.button === 1 || (e.button === 0 && !card && !e.target.closest(".btools,.bmenu"))) return this.pan(e);
      if (e.button !== 0) return;
      if (port) return this.link(e, port.parentNode.dataset.id);
      if (card) return this.drag(e, card);
    });
    host.addEventListener("dblclick", e => { if (!e.target.closest(".card,.btools")) { const [x, y] = this.toWorld(e.clientX, e.clientY); this.menu(e.clientX, e.clientY, type => this.cb.create(type, [x, y], null)); } });
    host.addEventListener("dragover", e => { if ([...e.dataTransfer.types].includes("text/x-node")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } });
    host.addEventListener("drop", e => {
      const type = e.dataTransfer.getData("text/x-node"); if (!type) return;
      e.preventDefault(); const [x, y] = this.toWorld(e.clientX, e.clientY); this.cb.create(type, [x - CARD_W / 2, y - CARD_H / 2], null);
    });
    host.addEventListener("keydown", e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "f" || e.key === "F") { e.preventDefault(); this.fit(); }
      if ((e.key === "Delete" || e.key === "Backspace") && this.cb.selected()) { e.preventDefault(); this.cb.remove(this.cb.selected()); }
    });
  }
  pan(e) {
    e.preventDefault(); const v = this.view, sx = e.clientX, sy = e.clientY, ox = v.x, oy = v.y; this.host.classList.add("panning");
    const mv = ev => { v.x = ox + ev.clientX - sx; v.y = oy + ev.clientY - sy; this.apply(); };
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); this.host.classList.remove("panning"); this.saveView(); };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
  drag(e, card) {
    const id = card.dataset.id, sx = e.clientX, sy = e.clientY, p0 = Object.assign({}, this.pos[id]); let moved = false;
    const mv = ev => {
      const dx = (ev.clientX - sx) / this.view.z, dy = (ev.clientY - sy) / this.view.z;
      if (!moved && Math.hypot(dx, dy) * this.view.z < 4) return;
      moved = true; card.classList.add("lifting");
      this.pos[id] = { x: p0.x + dx, y: p0.y + dy }; card.style.left = this.pos[id].x + "px"; card.style.top = this.pos[id].y + "px"; this.edges();
    };
    const up = () => {
      window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); card.classList.remove("lifting");
      if (!moved) { this.cb.select(id); this.host.focus({ preventScroll: true }); return; }
      const all = {}; for (const [k, p] of Object.entries(this.pos)) all[k] = [Math.round(p.x / SNAP) * SNAP, Math.round(p.y / SNAP) * SNAP];
      this.cb.moved(all);
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
  link(e, from) {
    e.preventDefault(); e.stopPropagation();
    const a = this.pos[from], x1 = a.x + CARD_W, y1 = a.y + CARD_H / 2;
    const mv = ev => { const [x, y] = this.toWorld(ev.clientX, ev.clientY); this.edges(`<path d="M${x1},${y1} C${x1 + 60},${y1} ${x - 60},${y} ${x},${y}" stroke="var(--accent)" stroke-width="2" fill="none" stroke-dasharray="6 4"/><circle cx="${x}" cy="${y}" r="4" fill="var(--accent)"/>`);
      this.world.querySelectorAll(".card.target").forEach(c => c.classList.remove("target")); const over = document.elementFromPoint(ev.clientX, ev.clientY); const c = over && over.closest(".card"); if (c && c.dataset.id !== from) c.classList.add("target"); };
    const up = ev => {
      window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); this.edges();
      this.world.querySelectorAll(".card.target").forEach(c => c.classList.remove("target"));
      const over = document.elementFromPoint(ev.clientX, ev.clientY), c = over && over.closest(".card");
      if (c && c.dataset.id !== from) return this.cb.connect(from, c.dataset.id);
      if (over && this.host.contains(over)) { const [x, y] = this.toWorld(ev.clientX, ev.clientY); this.menu(ev.clientX, ev.clientY, type => this.cb.create(type, [x, y - CARD_H / 2], from)); }
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
  menu(cx, cy, pick) {                          // what to make here: a scene, a task, a choice, an ending
    document.querySelectorAll(".bmenu").forEach(m => m.remove());
    const m = el("div", { class: "bmenu", style: `left:${cx}px;top:${cy}px` }, el("div", { class: "bmenu-h" }, "Add here"),
      ...[["scene", "film", "Scene"], ["stitch", "task", "Task"], ["choice", "choice", "Choice"], ["ending", "ending", "Ending"]].map(([t, ic, l]) =>
        el("button", { class: "bmenu-i " + t, on: { click: () => { m.remove(); pick(t); } } }, icon(ic, 14), " " + l)));
    document.body.append(m);
    const off = ev => { if (!m.contains(ev.target)) { m.remove(); window.removeEventListener("mousedown", off, true); } };
    setTimeout(() => window.addEventListener("mousedown", off, true), 0);
  }
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// The flow board, the desk's map of the story: nodes where you put them (`xy`, kept in the story), a wrapped
// auto-layout until you move one; pan (drag the background, or with the middle button) and zoom (the wheel, around
// the pointer; Fit shows everything); drag a node to move it; drag from its port (the dot on its right) to another
// node to connect them, or into empty space for a new node there; drop a node type from the palette to add one.
// Acts (the story's `frames`) are coloured frames behind groups of cards: dragged by their title (the cards come
// along), folded into one card. Shift-drag on the background picks the cards in a box; the minimap shows the whole.
// app.js says what's on a card and what each change does to the story (the callbacks), so this stays the map's own.
import { icon } from "./icons.js";

export const CARD_W = 176, CARD_H = 56;
const COL = 214, ROW = 84, BAND_GAP = 46, PAD = 24, SNAP = 8, READ_Z = 0.85;   // READ_Z: the zoom a board opens at (cards readable)
const FRAME_PAD = 16, FRAME_HEAD = 30;
const el = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [n, v] of Object.entries(a)) { if (n === "on") for (const [ev, f] of Object.entries(v)) e.addEventListener(ev, f); else if (n === "style") e.style.cssText = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(n, v === true ? "" : v); } for (const c of k.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
const TYPE_COLOR = { scene: "#8a63d2", stitch: "#2f9e8f", choice: "#c98a2b", ending: "#c0473f" };

export class Board {
  // cb: story(), selected(), select(id, {add}), multi() -> the ids picked together, card(id, n) -> {cls, kids, title},
  //     outs(id) -> [{to, label, kind}], moved({id: [x, y]}) (every node's place, once any is moved), connect(from, to),
  //     create(type, [x, y], from|null), remove(), context(id | null, clientX, clientY, [x, y]) (the right-click),
  //     quick(templateId, [x, y]), pickMany(ids) (a box drawn), frameMenu(frameId, clientX, clientY),
  //     join(frameId, nodeId) (a card dropped inside an act it isn't in)
  constructor(host, cb) {
    this.host = host; this.cb = cb; this.view = { x: 0, y: 0, z: 1 }; this.pos = {}; this.hide = {}; this.foldPos = {};
    host.innerHTML = ""; host.tabIndex = 0;
    this.world = el("div", { class: "bworld" });
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); this.svg.id = "edges";
    this.world.append(this.svg); host.append(this.world);
    this.tools = el("div", { class: "btools" },
      el("button", { class: "ghost", title: "zoom in", on: { click: () => this.zoomBy(1.25) } }, icon("zoomin", 16)),
      el("button", { class: "ghost", title: "zoom out", on: { click: () => this.zoomBy(0.8) } }, icon("zoomout", 16)),
      el("button", { class: "ghost", title: "fit everything (F)", on: { click: () => this.fit() } }, icon("fit", 16)),
      el("button", { class: "ghost", title: "tidy: lay the nodes out again in reading order", on: { click: () => this.tidy() } }, icon("tree", 16)),
      el("button", { class: "ghost", title: "the minimap (M)", on: { click: () => this.toggleMini() } }, icon("map", 16)));
    let seen = false; try { seen = localStorage.getItem("dd.board.hinted") === "1"; } catch (e) { }
    if (!seen) host.append(el("div", { class: "bhint" }, "drag a node to move it · drag its dot to connect · Shift-drag to pick several · right-click for more · wheel to zoom · F fits",
      el("button", { class: "ghost", title: "got it", on: { click: e => { e.target.closest(".bhint").remove(); try { localStorage.setItem("dd.board.hinted", "1"); } catch (x) { } } } }, icon("x", 12))));
    host.append(this.tools);
    let mini = true; try { mini = localStorage.getItem("dd.board.mini") !== "0"; } catch (e) { }
    this.mini = el("canvas", { class: "bmini", width: 168, height: 104, title: "the whole board: click or drag to look there (M hides it)" }); if (!mini) this.mini.style.display = "none";
    host.append(this.mini);
    this.wire();
  }
  key() { return "dd.board." + (this.cb.game() || ""); }
  loadView() { try { const v = JSON.parse(localStorage.getItem(this.key()) || "null"); if (v && isFinite(v.z)) { this.view = v; return true; } } catch (e) { } return false; }
  saveView() { try { localStorage.setItem(this.key(), JSON.stringify(this.view)); } catch (e) { } }
  apply() { const v = this.view; this.world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.z})`; this.host.style.backgroundSize = `${18 * v.z}px ${18 * v.z}px`; this.host.style.backgroundPosition = `${v.x}px ${v.y}px`; this.drawMini(); }

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

  // ---- acts: frames behind groups of cards, folded into one card (folding is the board's view, kept per game) ----
  frames() { const S = this.cb.story(); return (S && Array.isArray(S.frames) ? S.frames : []).filter(f => f && f.id); }
  folded() { try { return new Set(JSON.parse(localStorage.getItem("dd.folded." + (this.cb.game() || "")) || "[]")); } catch (e) { return new Set(); } }
  fold(id, on) { const f = this.folded(); if (on) f.add(id); else f.delete(id); try { localStorage.setItem("dd.folded." + (this.cb.game() || ""), JSON.stringify([...f])); } catch (e) { } this.render(); }
  members(f) { return ((f && f.nodes) || []).filter(id => this.pos[id]); }
  frameBox(ids) {
    const ps = ids.map(id => this.pos[id]);
    const x0 = Math.min(...ps.map(p => p.x)), y0 = Math.min(...ps.map(p => p.y)), x1 = Math.max(...ps.map(p => p.x + CARD_W)), y1 = Math.max(...ps.map(p => p.y + CARD_H));
    return { x: x0 - FRAME_PAD, y: y0 - FRAME_PAD - FRAME_HEAD, w: x1 - x0 + 2 * FRAME_PAD, h: y1 - y0 + 2 * FRAME_PAD + FRAME_HEAD };
  }
  at(id) { return this.hide[id] ? this.foldPos[this.hide[id]] : this.pos[id]; }   // where a node's edges go: its act's card, folded

  // ---- drawing ----
  render() {
    const S = this.cb.story(); if (!S) return;
    this.pos = this.layout();
    this.world.querySelectorAll(".card,.bframe").forEach(c => c.remove());
    const folded = this.folded(); this.hide = {}; this.foldPos = {};
    for (const f of this.frames()) if (folded.has(f.id)) for (const id of this.members(f)) this.hide[id] = f.id;
    for (const f of this.frames()) {             // the acts, behind the edges and the cards
      const ids = this.members(f); if (!ids.length) continue;
      const color = f.color || "#8a63d2";
      if (folded.has(f.id)) {
        const p = { x: Math.min(...ids.map(id => this.pos[id].x)), y: Math.min(...ids.map(id => this.pos[id].y)) }; this.foldPos[f.id] = p;
        const types = ids.reduce((m, id) => { const t = S.flow[id].type; m[t] = (m[t] || 0) + 1; return m; }, {});
        this.world.append(el("div", { class: "card folded", "data-frame": f.id, title: "an act, folded: double-click to open it, drag to move it", style: `left:${p.x}px;top:${p.y}px;--fc:${color}` },
          el("div", { class: "t" }, icon("box", 11), " act"), el("div", { class: "n" }, f.title || f.id),
          el("div", { class: "m" }, `${ids.length} cards · ${Object.entries(types).map(([t, n]) => `${n} ${t === "stitch" ? "task" : t}${n > 1 ? "s" : ""}`).join(", ")}`)));
        continue;
      }
      const b = this.frameBox(ids);
      this.world.insertBefore(el("div", { class: "bframe", "data-frame": f.id, style: `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;--fc:${color}` },
        el("div", { class: "bframe-h", title: "drag to move the act with its cards · right-click for its menu" },
          el("button", { class: "bframe-fold", title: "fold it into one card" }, icon("down", 12)), el("span", { class: "bframe-t" }, f.title || f.id), el("span", { class: "bframe-n" }, ids.length))), this.svg);
    }
    for (const [id, n] of Object.entries(S.flow)) {
      if (this.hide[id]) continue;
      const p = this.pos[id], c = this.cb.card(id, n), sel = this.cb.selected() === id, multi = this.cb.multi ? this.cb.multi() : null;
      const many = multi && multi.size > 1 && multi.has(id);
      const card = el("div", { class: `card ${n.type}${sel ? " sel" : ""}${many ? " multi" : ""}${c.cls ? " " + c.cls : ""}`, "data-id": id, title: c.title || "", style: `left:${p.x}px;top:${p.y}px` }, ...c.kids);
      if (n.type !== "ending") card.append(el("span", { class: "port", title: "drag to another node to connect (or into empty space for a new one)" }));
      this.world.append(card);
    }
    this.edges();
    if (!this.viewSet) { this.viewSet = true; if (!this.loadView()) this.home(); else this.apply(); }
    this.drawMini();
  }
  edges(extra = "") {
    const S = this.cb.story(), pos = this.pos;
    let W = 0, H = 0; for (const p of Object.values(pos)) { W = Math.max(W, p.x + CARD_W + 80); H = Math.max(H, p.y + CARD_H + 80); }
    this.svg.setAttribute("width", W + 400); this.svg.setAttribute("height", H + 400);
    let paths = '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="#77777f"/></marker></defs>';
    for (const id of Object.keys(S.flow)) {
      const a = this.at(id);
      for (const o of this.cb.outs(id)) {
        const t = this.at(o.to); if (!a || !t) continue;
        if (this.hide[id] && this.hide[id] === this.hide[o.to]) continue;      // inside a folded act
        const x1 = a.x + CARD_W, y1 = a.y + CARD_H / 2, x2 = t.x, y2 = t.y + CARD_H / 2, back = x2 < x1 - 10;
        const dx = Math.max(40, Math.abs(x2 - x1) / 2);
        const d = back ? `M${x1},${y1} C${x1 + 70},${y1} ${x2 - 70},${y2} ${x2},${y2}` : `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
        const col = o.kind === "interrupt" ? "#b04a42" : o.kind === "timer" ? "#b0862a" : o.kind === "answer" ? "#6f8fd0" : "#66666f";
        paths += `<path d="${d}" stroke="${col}" fill="none" stroke-width="1.7" ${o.kind ? 'stroke-dasharray="5 4"' : ""} marker-end="url(#ar)" opacity=".9"/>`;
        if (o.label && !this.hide[id]) { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 5; paths += `<text x="${mx}" y="${my}" text-anchor="middle" fill="${o.kind ? col : "#d39a45"}" font-size="10.5" paint-order="stroke" stroke="#121214" stroke-width="3">${esc(o.label).slice(0, 26)}</text>`; }
      }
    }
    this.svg.innerHTML = paths + extra;
  }
  // ---- the minimap: every card (an act folded as one), the acts, and the part the board shows ----
  toggleMini() { const on = this.mini.style.display === "none"; this.mini.style.display = on ? "" : "none"; try { localStorage.setItem("dd.board.mini", on ? "1" : "0"); } catch (e) { } this.drawMini(); }
  miniMap() {
    const ex = this.extent(); if (!ex) return null;
    const v = this.view, w = this.host.clientWidth || 900, h = this.host.clientHeight || 400, vx0 = -v.x / v.z, vy0 = -v.y / v.z, vx1 = vx0 + w / v.z, vy1 = vy0 + h / v.z;
    const x0 = Math.min(vx0, ex[0]) - 20, y0 = Math.min(vy0, ex[1]) - 20, x1 = Math.max(vx1, ex[2]) + 20, y1 = Math.max(vy1, ex[3]) + 20;
    const s = Math.min(this.mini.width / (x1 - x0), this.mini.height / (y1 - y0));
    return { x0, y0, s, view: [vx0, vy0, vx1, vy1] };
  }
  drawMini() {
    if (!this.mini || this.mini.style.display === "none") return;
    const m = this.miniMap(), g = this.mini.getContext("2d"); g.clearRect(0, 0, this.mini.width, this.mini.height); if (!m) return;
    const S = this.cb.story(), X = x => (x - m.x0) * m.s, Y = y => (y - m.y0) * m.s;
    for (const f of this.frames()) { const ids = this.members(f); if (!ids.length || this.foldPos[f.id]) continue; const b = this.frameBox(ids); g.fillStyle = (f.color || "#8a63d2") + "33"; g.fillRect(X(b.x), Y(b.y), b.w * m.s, b.h * m.s); }
    for (const [id, p] of Object.entries(this.pos)) { if (this.hide[id]) continue; g.fillStyle = TYPE_COLOR[(S.flow[id] || {}).type] || "#888"; g.fillRect(X(p.x), Y(p.y), Math.max(2, CARD_W * m.s), Math.max(2, CARD_H * m.s)); }
    for (const [fid, p] of Object.entries(this.foldPos)) { const f = this.frames().find(x => x.id === fid) || {}; g.fillStyle = f.color || "#8a63d2"; g.fillRect(X(p.x), Y(p.y), CARD_W * m.s, CARD_H * m.s); }
    const [a, b, c, d] = m.view; g.strokeStyle = "#d9a441"; g.lineWidth = 1.5; g.strokeRect(X(a) + 0.5, Y(b) + 0.5, (c - a) * m.s, (d - b) * m.s);
  }
  // ---- the view ----
  extent() {                                     // what's drawn: the cards and the acts' frames (their titles too)
    const rs = Object.entries(this.pos).filter(([id]) => !this.hide[id]).map(([, p]) => [p.x, p.y, p.x + CARD_W, p.y + CARD_H]);
    for (const p of Object.values(this.foldPos)) rs.push([p.x, p.y, p.x + CARD_W, p.y + CARD_H]);
    for (const f of this.frames()) { const ids = this.members(f); if (ids.length && !this.foldPos[f.id]) { const b = this.frameBox(ids); rs.push([b.x, b.y, b.x + b.w, b.y + b.h]); } }
    if (!rs.length) return null;
    return [Math.min(...rs.map(r => r[0])), Math.min(...rs.map(r => r[1])), Math.max(...rs.map(r => r[2])), Math.max(...rs.map(r => r[3]))];
  }
  fit() {
    const ex = this.extent(); if (!ex) return;
    const [x0, y0, x1, y1] = ex;
    const w = this.host.clientWidth || 900, h = this.host.clientHeight || 400, z = Math.max(0.3, Math.min(1.1, Math.min((w - 40) / (x1 - x0 + 1), (h - 50) / (y1 - y0 + 1))));
    this.view = { z, x: (w - (x1 - x0) * z) / 2 - x0 * z, y: Math.max(16, (h - (y1 - y0) * z) / 2) - y0 * z };
    this.apply(); this.saveView();
  }
  home() {                                     // readable, from the story's start (Fit shows everything)
    const ex = this.extent(); if (!ex) return;
    const [x0, y0] = ex;
    this.view = { z: READ_Z, x: 16 - x0 * READ_Z, y: 16 - y0 * READ_Z }; this.apply(); this.saveView();
  }
  zoomBy(f, mx, my) {
    const v = this.view, z = Math.max(0.25, Math.min(2, v.z * f)); if (mx === undefined) { mx = this.host.clientWidth / 2; my = this.host.clientHeight / 2; }
    v.x = mx - (mx - v.x) * (z / v.z); v.y = my - (my - v.y) * (z / v.z); v.z = z; this.apply(); this.saveView();
  }
  center(id) {
    const p = this.at(id) || this.pos[id]; if (!p) return;
    const v = this.view; v.x = this.host.clientWidth / 2 - (p.x + CARD_W / 2) * v.z; v.y = this.host.clientHeight / 2 - (p.y + CARD_H / 2) * v.z; this.apply(); this.saveView();
  }
  lookAt(x, y) { const v = this.view; v.x = this.host.clientWidth / 2 - x * v.z; v.y = this.host.clientHeight / 2 - y * v.z; this.apply(); this.saveView(); }
  toWorld(cx, cy) { const r = this.host.getBoundingClientRect(), v = this.view; return [(cx - r.left - v.x) / v.z, (cy - r.top - v.y) / v.z]; }

  // ---- pointing ----
  wire() {
    const host = this.host;
    host.addEventListener("wheel", e => { if (e.target === this.mini) return; e.preventDefault(); const r = host.getBoundingClientRect(); this.zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    host.addEventListener("mousedown", e => {
      if (e.target === this.mini) return this.miniDrag(e);
      const port = e.target.closest(".port"), card = e.target.closest(".card"), head = e.target.closest(".bframe-h");
      if (e.button === 0 && e.target.closest(".bframe-fold")) { e.preventDefault(); return this.fold(e.target.closest(".bframe").dataset.frame, true); }
      if (e.button === 0 && head) return this.dragGroup(e, this.members(this.frames().find(f => f.id === head.parentNode.dataset.frame)));
      if (e.button === 0 && card && card.classList.contains("folded")) return this.dragGroup(e, this.members(this.frames().find(f => f.id === card.dataset.frame)));
      if (e.button === 0 && e.shiftKey && !card && !e.target.closest(".btools,.bmenu,.bhint")) return this.boxPick(e);
      if (e.button === 1 || (e.button === 0 && !card && !e.target.closest(".btools,.bmenu"))) return this.pan(e);
      if (e.button !== 0) return;
      if (port) return this.link(e, port.parentNode.dataset.id);
      if (card) return this.drag(e, card);
    });
    host.addEventListener("mousemove", e => { this.mouse = this.toWorld(e.clientX, e.clientY); });
    host.addEventListener("contextmenu", e => {
      if (e.target.closest(".btools,.bmenu") || e.target === this.mini) return;
      e.preventDefault();
      const fr = e.target.closest(".bframe-h,.card.folded");
      if (fr && this.cb.frameMenu) return this.cb.frameMenu(fr.closest("[data-frame]").dataset.frame, e.clientX, e.clientY);
      const card = e.target.closest(".card");
      if (this.cb.context) this.cb.context(card ? card.dataset.id : null, e.clientX, e.clientY, this.toWorld(e.clientX, e.clientY));
    });
    host.addEventListener("dblclick", e => {
      const folded = e.target.closest(".card.folded"); if (folded) return this.fold(folded.dataset.frame, false);
      if (!e.target.closest(".card,.btools,.bframe-h") && e.target !== this.mini) { const [x, y] = this.toWorld(e.clientX, e.clientY); this.menu(e.clientX, e.clientY, type => this.cb.create(type, [x, y], null)); }
    });
    host.addEventListener("dragover", e => { const t = [...e.dataTransfer.types]; if (t.includes("text/x-node") || t.includes("text/x-quick")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } });
    host.addEventListener("drop", e => {
      const type = e.dataTransfer.getData("text/x-node"), quick = e.dataTransfer.getData("text/x-quick"); if (!type && !quick) return;
      e.preventDefault(); const [x, y] = this.toWorld(e.clientX, e.clientY), at = [x - CARD_W / 2, y - CARD_H / 2];
      if (quick) { if (this.cb.quick) this.cb.quick(quick, at); } else this.cb.create(type, at, null);
    });
    host.addEventListener("keydown", e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "f" || e.key === "F") { e.preventDefault(); this.fit(); }
      if ((e.key === "m" || e.key === "M") && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.toggleMini(); }
      if ((e.key === "Delete" || e.key === "Backspace") && this.cb.selected()) { e.preventDefault(); this.cb.remove(this.cb.selected()); }
    });
  }
  pan(e) {
    e.preventDefault(); const v = this.view, sx = e.clientX, sy = e.clientY, ox = v.x, oy = v.y; this.host.classList.add("panning");
    const mv = ev => { v.x = ox + ev.clientX - sx; v.y = oy + ev.clientY - sy; this.apply(); };
    const up = () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); this.host.classList.remove("panning"); this.saveView(); };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
  miniDrag(e) {                                   // the minimap: the board looks where it's clicked, and follows a drag
    e.preventDefault(); e.stopPropagation();
    const go = ev => { const m = this.miniMap(); if (!m) return; const r = this.mini.getBoundingClientRect(); this.lookAt(m.x0 + (ev.clientX - r.left) / m.s, m.y0 + (ev.clientY - r.top) / m.s); };
    go(e);
    const up = () => { window.removeEventListener("mousemove", go); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", go); window.addEventListener("mouseup", up);
  }
  boxPick(e) {                                   // Shift-drag on the background: the cards in the box are picked
    e.preventDefault(); const r = this.host.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
    const box = el("div", { class: "bsel" }); this.host.append(box);
    const rect = ev => [Math.min(sx, ev.clientX), Math.min(sy, ev.clientY), Math.abs(ev.clientX - sx), Math.abs(ev.clientY - sy)];
    const mv = ev => { const [x, y, w, h] = rect(ev); Object.assign(box.style, { left: x - r.left + "px", top: y - r.top + "px", width: w + "px", height: h + "px" }); };
    const up = ev => {
      window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); box.remove();
      const [x, y, w, h] = rect(ev), [ax, ay] = this.toWorld(x, y), [bx, by] = this.toWorld(x + w, y + h);
      const ids = Object.entries(this.pos).filter(([id, p]) => !this.hide[id] && p.x < bx && p.x + CARD_W > ax && p.y < by && p.y + CARD_H > ay).map(([id]) => id);
      if (ids.length && this.cb.pickMany) this.cb.pickMany(ids);
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
  dragGroup(e, ids) {                            // an act by its title, or folded: its cards move together
    e.preventDefault(); if (!ids.length) return;
    const S = this.cb.story(), sx = e.clientX, sy = e.clientY, p0 = Object.fromEntries(ids.map(k => [k, Object.assign({}, this.pos[k])])); let moved = false;
    const mv = ev => {                             // drawn by writing the cards' places into their xy as they go
      const dx = (ev.clientX - sx) / this.view.z, dy = (ev.clientY - sy) / this.view.z;
      if (!moved && Math.hypot(dx, dy) * this.view.z < 4) return;
      moved = true; for (const k of ids) S.flow[k].xy = [p0[k].x + dx, p0[k].y + dy]; this.render();
    };
    const up = () => {
      window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); if (!moved) return;
      const all = {}; for (const [k, p] of Object.entries(this.layout())) all[k] = [Math.round(p.x / SNAP) * SNAP, Math.round(p.y / SNAP) * SNAP];
      this.cb.moved(all);
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
  drag(e, card) {                               // the picked cards move together when one of them is dragged
    const id = card.dataset.id, sx = e.clientX, sy = e.clientY, add = e.ctrlKey || e.metaKey || e.shiftKey, multi = this.cb.multi ? this.cb.multi() : null;
    const group = multi && multi.size > 1 && multi.has(id) ? [...multi].filter(k => this.pos[k] && !this.hide[k]) : [id], p0 = Object.fromEntries(group.map(k => [k, Object.assign({}, this.pos[k])]));
    const cards = Object.fromEntries(group.map(k => [k, this.world.querySelector(`.card[data-id="${CSS.escape(k)}"]`)])); let moved = false;
    const mv = ev => {
      const dx = (ev.clientX - sx) / this.view.z, dy = (ev.clientY - sy) / this.view.z;
      if (!moved && Math.hypot(dx, dy) * this.view.z < 4) return;
      if (add) return;                             // Ctrl or Shift: picking, not moving
      moved = true;
      for (const k of group) { const c = cards[k]; this.pos[k] = { x: p0[k].x + dx, y: p0[k].y + dy }; if (c) { c.classList.add("lifting"); c.style.left = this.pos[k].x + "px"; c.style.top = this.pos[k].y + "px"; } }
      this.edges();
    };
    const up = ev => {
      window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); for (const c of Object.values(cards)) if (c) c.classList.remove("lifting");
      if (!moved) { this.cb.select(id, { add }); this.host.focus({ preventScroll: true }); return; }
      if (this.cb.join && group.length === 1) {   // dropped inside an act it isn't in: it joins it
        const [x, y] = this.toWorld(ev.clientX, ev.clientY);
        const into = this.frames().find(f => { if (this.foldPos[f.id] || (f.nodes || []).includes(id)) return false; const ids = this.members(f); if (!ids.length) return false; const b = this.frameBox(ids); return x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h; });
        if (into) this.cb.join(into.id, id);
      }
      const all = {}; for (const [k, p] of Object.entries(this.pos)) all[k] = [Math.round(p.x / SNAP) * SNAP, Math.round(p.y / SNAP) * SNAP];
      this.cb.moved(all);
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
  link(e, from) {
    e.preventDefault(); e.stopPropagation();
    const a = this.pos[from], x1 = a.x + CARD_W, y1 = a.y + CARD_H / 2;
    const mv = ev => { const [x, y] = this.toWorld(ev.clientX, ev.clientY); this.edges(`<path d="M${x1},${y1} C${x1 + 60},${y1} ${x - 60},${y} ${x},${y}" stroke="var(--accent)" stroke-width="2" fill="none" stroke-dasharray="6 4"/><circle cx="${x}" cy="${y}" r="4" fill="var(--accent)"/>`);
      this.world.querySelectorAll(".card.target").forEach(c => c.classList.remove("target")); const over = document.elementFromPoint(ev.clientX, ev.clientY); const c = over && over.closest(".card"); if (c && c.dataset.id && c.dataset.id !== from) c.classList.add("target"); };
    const up = ev => {
      window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); this.edges();
      this.world.querySelectorAll(".card.target").forEach(c => c.classList.remove("target"));
      const over = document.elementFromPoint(ev.clientX, ev.clientY), c = over && over.closest(".card");
      if (c && c.dataset.id && c.dataset.id !== from) return this.cb.connect(from, c.dataset.id);
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

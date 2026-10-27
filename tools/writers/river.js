// The river: a prototype drawn as a map (docs/WRITERS_ROOM.md §6). The main points along one meandering river, their
// acts as bands behind them, a fork splitting the river into its ways and joining it again at the next main point,
// the secrets as dotted streams above it with a star (their achievement), the three endings fanning out at the mouth
// (the intended one gold), the minutes under the points. The wheel zooms, dragging pans, a double-click fits it all.
const NS = "http://www.w3.org/2000/svg";
export const COLOR = { scene: "#6fb3d9", talk: "#e07a90", task: "#e3a64e", chapter: "#a185e6", choice: "#ebe5da" };
export const ICON = { scene: "▶", talk: "◉", task: "☐", chapter: "☾", choice: "⑂" };
const GOLD = "#e5b450", GAP = 96, PX = 20, X0 = 110;

const mk = (tag, attrs = {}, parent = null) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  if (parent) parent.append(e);
  return e;
};
const meander = i => Math.sin(i * 1.15) * 10;

// where everything goes: the main points by their minutes (never closer than GAP), a fork's ways spread above and
// below between it and the next main point, the secrets' arcs, the endings after the last point
export function layout(P) {
  const pts = P.points || [], nodes = [], ways = [], acts = new Map();
  let last = null, cum = 0;
  pts.forEach((p, i) => {
    const x = last === null ? X0 : Math.max(last + GAP, X0 + cum * PX);
    const n = { id: p.id, p, x, y: meander(i), main: true, cum, i };
    nodes.push(n);
    cum += +p.minutes || 0;
    last = x;
    const fw = (p.fork && p.fork.ways) || [];
    if (fw.length) {
      const k = fw.length, spread = fw.map((_, j) => (j - (k - 1) / 2) * (k === 2 ? 172 : 104));
      let longest = 0, most = 0;
      fw.forEach((w, j) => {
        const way = { w, fork: n, y: spread[j], nodes: [] };
        let mins = 0;
        (w.points || []).forEach((q, m) => {
          const wn = { id: q.id, p: q, x: x + GAP * (m + 1), y: spread[j], main: false, way: w, fork: p, cum: cum + mins };
          mins += +q.minutes || 0;
          way.nodes.push(wn); nodes.push(wn);
        });
        longest = Math.max(longest, mins); most = Math.max(most, (w.points || []).length);
        ways.push(way);
      });
      cum += longest;
      last = x + most * GAP;
    }
    const a = acts.get(p.act) || { id: p.act, x1: Infinity, x2: -Infinity };
    a.x1 = Math.min(a.x1, x); a.x2 = Math.max(a.x2, last); acts.set(p.act, a);
  });
  const main = nodes.filter(n => n.main), byId = new Map(nodes.map(n => [n.id, n]));
  const secrets = [], lanes = [];
  for (const s of P.secrets || []) {                          // above the river, stacked where they overlap
    const a = byId.get(s.after); if (!a || !a.main) continue;
    const b = main[a.i + 1]; if (!b) continue;
    let lane = 0; while ((lanes[lane] || []).some(r => r[0] < b.x && a.x < r[1])) lane++;
    (lanes[lane] = lanes[lane] || []).push([a.x, b.x]);
    secrets.push({ s, a, b, top: -128 - lane * 34 });
  }
  const end = main[main.length - 1], endings = [];
  if (end) {
    const es = P.endings || [], order = [...es].sort((x, y) => (y.kind === "intended") - (x.kind === "intended"));
    const ys = order.length === 1 ? [0] : order.length === 2 ? [0, 120] : [0, -130, 130, -260, 260];
    order.forEach((e, j) => endings.push({ e, x: end.x + 230, y: (ys[j] ?? j * 120) + end.y, from: end }));
  }
  const xEnd = endings.length ? end.x + 230 : last ?? X0;
  return { nodes, main, ways, secrets, endings, acts: [...acts.values()], minutes: cum, xEnd, byId };
}

// a smooth line through points (Catmull-Rom as cubic Béziers)
function smooth(pts) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
const curve = (a, b) => { const mx = (a[0] + b[0]) / 2; return `M${a[0]},${a[1]} C${mx},${a[1]} ${mx},${b[1]} ${b[0]},${b[1]}`; };

function wrap(text, n = 17, lines = 2) {
  const out = [], words = String(text || "").split(/\s+/);
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > n && cur) { out.push(cur); cur = w; if (out.length === lines) break; }
    else cur = (cur + " " + w).trim();
  }
  if (out.length < lines && cur) out.push(cur);
  if (out.length === lines && words.join(" ").length > out.join(" ").length) out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, "…");
  return out;
}

export class River {
  constructor(svg, { onSelect, onHover } = {}) {
    Object.assign(this, { svg, onSelect, onHover });
    this.vb = null; this.L = null; this.px = null;
    this.wire();
    new ResizeObserver(() => this.resized()).observe(svg);
  }
  wire() {
    const s = this.svg;
    let drag = null;
    s.addEventListener("wheel", e => {
      e.preventDefault(); if (!this.vb) return;
      const p = this.toSvg(e.clientX, e.clientY), k = Math.pow(1.0015, e.deltaY);
      const w = Math.min(Math.max(this.vb[2] * k, 260), 9000), h = w * this.vb[3] / this.vb[2];
      this.vb = [p.x - (p.x - this.vb[0]) * w / this.vb[2], p.y - (p.y - this.vb[1]) * h / this.vb[3], w, h];
      this.apply();
    }, { passive: false });
    s.addEventListener("pointerdown", e => {
      if (e.target.closest("[data-hit]")) return;
      drag = { x: e.clientX, y: e.clientY, vb: [...this.vb], moved: false }; s.classList.add("drag"); s.setPointerCapture(e.pointerId);
    });
    s.addEventListener("pointermove", e => {
      if (!drag) return;
      const r = s.getBoundingClientRect(), k = this.vb[2] / r.width;
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
      this.vb = [drag.vb[0] - (e.clientX - drag.x) * k, drag.vb[1] - (e.clientY - drag.y) * k, drag.vb[2], drag.vb[3]]; this.apply();
    });
    const up = e => { if (drag && !drag.moved && !e.target.closest("[data-hit]") && this.onSelect) this.onSelect(null); drag = null; s.classList.remove("drag"); };
    s.addEventListener("pointerup", up); s.addEventListener("pointercancel", up);
    s.addEventListener("dblclick", e => { if (!e.target.closest("[data-hit]")) this.fit(); });
  }
  // the map's area changed (the inspector opened, the window): the same scale, the same middle, more or less shown
  resized() {
    const r = this.svg.getBoundingClientRect();
    if (!this.vb || !this.px || !r.width || !r.height) return;
    const k = this.vb[2] / this.px[0], cx = this.vb[0] + this.vb[2] / 2, cy = this.vb[1] + this.vb[3] / 2;
    this.vb = [cx - r.width * k / 2, cy - r.height * k / 2, r.width * k, r.height * k];
    this.px = [r.width, r.height]; this.apply();
  }
  toSvg(cx, cy) { const pt = this.svg.createSVGPoint(); pt.x = cx; pt.y = cy; return pt.matrixTransform(this.svg.getScreenCTM().inverse()); }
  apply() {
    if (!this.vb) return;
    const r = this.svg.getBoundingClientRect(); if (r.width) this.px = [r.width, r.height];
    this.svg.setAttribute("viewBox", this.vb.map(v => v.toFixed(1)).join(" "));
  }
  fit() {
    if (!this.L) return;
    const r = this.svg.getBoundingClientRect(), x1 = -30, x2 = this.L.xEnd + 200, y1 = -310, y2 = 280;
    const w = x2 - x1, h = y2 - y1, aspect = (r.width || 1200) / (r.height || 600);
    this.vb = w / h > aspect ? [x1, (y1 + y2) / 2 - w / aspect / 2, w, w / aspect] : [(x1 + x2) / 2 - h * aspect / 2, y1, h * aspect, h];
    this.apply();
  }

  // the whole map, from the prototype; selected: {kind, id}; problems: ids with an error
  draw(P, { selected = null, problems = new Set(), refit = false } = {}) {
    const s = this.svg, L = this.L = layout(P);
    s.replaceChildren();
    const defs = mk("defs", {}, s);
    const g1 = mk("linearGradient", { id: "water", x1: "0", x2: "1", y1: "0", y2: "0" }, defs);
    mk("stop", { offset: "0", "stop-color": "#2a5f8f" }, g1); mk("stop", { offset: "1", "stop-color": "#4fa3d9" }, g1);
    const glow = mk("filter", { id: "glow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs);
    mk("feGaussianBlur", { stdDeviation: "4", result: "b" }, glow);
    const fm = mk("feMerge", {}, glow); mk("feMergeNode", { in: "b" }, fm); mk("feMergeNode", { in: "SourceGraphic" }, fm);
    const acts = mk("g", {}, s), water = mk("g", {}, s), streams = mk("g", {}, s), ends = mk("g", {}, s), dots = mk("g", {}, s);

    // the acts: bands behind their points, titled at the top
    const actTitle = Object.fromEntries((P.acts || []).map(a => [a.id, a.title]));
    L.acts.forEach((a, i) => {
      if (!isFinite(a.x1)) return;
      const x = a.x1 - GAP / 2, w = a.x2 - a.x1 + GAP;
      mk("rect", { x, y: -300, width: w, height: 560, rx: 14, fill: i % 2 ? "#ffffff05" : "#ffffff09" }, acts);
      const t = mk("text", { x: x + 14, y: -276, fill: "#8a909c", "font-size": 13, "letter-spacing": "0.08em" }, acts);
      t.textContent = (actTitle[a.id] || a.id || "").toUpperCase();
    });

    // the river: main points joined, except across a fork (its ways carry it)
    const main = L.main, seg = [];
    let run = [];
    main.forEach(n => {
      run.push([n.x, n.y]);
      if (n.p.fork && (n.p.fork.ways || []).length) { if (run.length > 1) seg.push(run); run = []; }   // its ways carry the river on
    });
    if (run.length > 1) seg.push(run);
    for (const r of seg) { mk("path", { d: smooth(r), fill: "none", stroke: "url(#water)", "stroke-width": 16, "stroke-linecap": "round", opacity: 0.9 }, water);
      mk("path", { d: smooth(r), fill: "none", stroke: "#bfe3ff", "stroke-width": 1.5, opacity: 0.25, "stroke-dasharray": "2 14" }, water); }
    for (const w of L.ways) {                                   // a fork's way: from its fork point, through its points, to the next main point
      const nxt = main[main.indexOf(w.fork) + 1], pts = [[w.fork.x, w.fork.y], ...w.nodes.map(n => [n.x, n.y])];
      const d = [curve(pts[0], pts[1] || pts[0])];
      for (let i = 1; i < pts.length - 1; i++) d.push(curve(pts[i], pts[i + 1]).replace(/^M[^C]*/, ` L${pts[i][0]},${pts[i][1]} `));
      if (nxt) d.push(curve(pts[pts.length - 1], [nxt.x, nxt.y]).replace(/^M[^C]*/, ` L${pts[pts.length - 1][0]},${pts[pts.length - 1][1]} `));
      mk("path", { d: d.join(""), fill: "none", stroke: "url(#water)", "stroke-width": 10, "stroke-linecap": "round", opacity: 0.8 }, water);
      const t = mk("text", { x: (w.fork.x + (w.nodes[0] || w.fork).x) / 2 + 10, y: w.y + (w.y < 0 ? -16 : 26), fill: "#9fc6e6", "font-size": 12, "text-anchor": "middle" }, water);
      t.textContent = w.w.label || w.w.id;
    }

    // the secrets: dotted streams over the river, a star at the top
    for (const sc of L.secrets) {
      const { a, b, top } = sc, mx = (a.x + b.x) / 2, sel = selected && selected.kind === "secret" && selected.id === sc.s.id;
      const hit = mk("g", { "data-hit": "secret:" + sc.s.id, style: "cursor:pointer" }, streams);
      mk("path", { d: `M${a.x},${a.y - 20} C${a.x + 20},${top} ${mx - 40},${top} ${mx},${top} S${b.x - 20},${top} ${b.x},${b.y - 20}`, fill: "none", stroke: GOLD,
        "stroke-width": sel ? 3 : 2, "stroke-dasharray": "4 6", opacity: sel ? 1 : 0.7 }, hit);
      mk("circle", { cx: mx, cy: top, r: 15, fill: "#1b1a14", stroke: GOLD, "stroke-width": sel ? 2.5 : 1.5, filter: sel ? "url(#glow)" : null }, hit);
      const st = mk("text", { x: mx, y: top + 5, "text-anchor": "middle", "font-size": 15, fill: GOLD }, hit); st.textContent = "★";
      const t = mk("text", { x: mx, y: top - 22, "text-anchor": "middle", "font-size": 12, fill: "#e5d3a6" }, hit); t.textContent = sc.s.title || sc.s.id;
      this.hover(hit, () => ({ title: "★ " + (sc.s.title || sc.s.id), kind: `secret · after ${sc.s.after} · achievement: ${sc.s.achievement || "none"}`, text: `${sc.s.find || ""}${sc.s.shows ? ": " + sc.s.shows : ""}` }));
      hit.addEventListener("click", () => this.onSelect && this.onSelect({ kind: "secret", id: sc.s.id }));
    }

    // the endings: the river's mouth, fanning out
    for (const en of L.endings) {
      const { e, x, y, from } = en, intended = e.kind === "intended", sel = selected && selected.kind === "ending" && selected.id === e.id;
      mk("path", { d: curve([from.x, from.y], [x - 70, y]), fill: "none", stroke: intended ? GOLD : "url(#water)", "stroke-width": intended ? 12 : 9, opacity: intended ? 0.75 : 0.65, "stroke-linecap": "round" }, ends);
      const hit = mk("g", { "data-hit": "ending:" + e.id, style: "cursor:pointer" }, ends);
      mk("rect", { x: x - 72, y: y - 22, width: 190, height: 44, rx: 22, fill: intended ? "#2a2414" : "#161b24", stroke: intended ? GOLD : "#4b6a8a",
        "stroke-width": sel ? 3 : 1.5, filter: sel ? "url(#glow)" : null }, hit);
      const t = mk("text", { x: x + 23, y: y + 1, "text-anchor": "middle", "font-size": 13, fill: intended ? "#f3dca0" : "#d5dbe4", "font-weight": 600 }, hit);
      t.textContent = (e.title || e.id).slice(0, 24);
      const r = e.rule || {}, rule = r.by === "karma" ? `karma ${r.min !== undefined && r.min !== null ? "≥ " + r.min : ""}${r.max !== undefined && r.max !== null ? "≤ " + r.max : ""}`.trim().replace(/^karma$/, "karma: the rest")
        : r.by === "answer" ? `answer ${r.option} at ${r.point}` : "no rule yet";
      const k = mk("text", { x: x + 23, y: y + 15, "text-anchor": "middle", "font-size": 10.5, fill: "#8a909c" }, hit); k.textContent = (intended ? "intended · " : "") + rule;
      this.hover(hit, () => ({ title: (intended ? "★ " : "") + (e.title || e.id), kind: `${intended ? "the intended ending" : "an ending"} · ${rule}`, text: `${e.what || ""}${e.how ? "\nHow: " + e.how : ""}` }));
      hit.addEventListener("click", () => this.onSelect && this.onSelect({ kind: "ending", id: e.id }));
    }

    // the points
    for (const n of L.nodes) {
      const p = n.p, c = COLOR[p.type] || "#999", sel = selected && selected.kind === "point" && selected.id === p.id;
      const hit = mk("g", { "data-hit": "point:" + p.id, transform: `translate(${n.x},${n.y})`, style: "cursor:pointer" }, dots);
      if (sel) mk("circle", { r: 27, fill: "none", stroke: GOLD, "stroke-width": 2, filter: "url(#glow)" }, hit);
      mk("circle", { r: n.main ? 20 : 16, fill: "#151920", stroke: c, "stroke-width": 3 }, hit);
      const ic = mk("text", { y: 5, "text-anchor": "middle", "font-size": n.main ? 15 : 12, fill: c }, hit); ic.textContent = ICON[p.type] || "?";
      const opts = ((p.talk || {}).options || []).length;
      for (let k = 0; k < opts; k++) mk("circle", { cx: -6 + k * 6, cy: 13, r: 1.8, fill: c }, hit);
      if ((p.tasks || []).length) { const tk = mk("text", { x: 15, y: -12, "font-size": 10, fill: c }, hit); tk.textContent = p.tasks.length; }
      if (problems.has(p.id)) mk("circle", { cx: 15, cy: -15, r: 4.5, fill: "#ff6b6b", stroke: "#151920", "stroke-width": 1.5 }, hit);
      const lines = wrap(p.title, n.main ? 17 : 15);
      lines.forEach((l, k) => { const t = mk("text", { y: 38 + k * 14, "text-anchor": "middle", "font-size": 12, fill: sel ? "#fff4d6" : "#d8d2c6" }, hit); t.textContent = l; });
      const m = mk("text", { y: -28, "text-anchor": "middle", "font-size": 10.5, fill: "#6e7480" }, hit);
      m.textContent = `${Math.round(n.cum)}′${p.minutes ? " +" + p.minutes : ""}`;
      this.hover(hit, () => ({ title: `${ICON[p.type] || ""} ${p.title || p.id}`, kind: `${p.id} · ${p.type} · ${p.minutes || 0} min${p.where ? " · " + p.where : ""}${(p.who || []).length ? " · " + p.who.join(", ") : ""}`,
        text: (p.what || "") + (p.talk ? `\n“${(p.talk.line || {}).text || ""}”` : "") + ((p.tasks || []).length ? "\nTo do: " + p.tasks.map(t => t.text).join("; ") : "") }));
      hit.addEventListener("click", () => this.onSelect && this.onSelect({ kind: "point", id: p.id }));
    }
    // the start
    if (L.main.length) {
      const f = L.main[0];
      const t = mk("text", { x: f.x - 64, y: f.y + 4, "text-anchor": "end", "font-size": 11, fill: "#6e7480", "letter-spacing": "0.12em" }, water); t.textContent = "START";
      mk("path", { d: `M${f.x - 58},${f.y} L${f.x - 22},${f.y}`, stroke: "url(#water)", "stroke-width": 16, opacity: 0.5, "stroke-linecap": "round" }, water);
    }
    if (!this.vb || refit) this.fit(); else this.apply();
    return L;
  }
  hover(el, info) {
    el.addEventListener("pointerenter", e => this.onHover && this.onHover(info(), e));
    el.addEventListener("pointermove", e => this.onHover && this.onHover(info(), e));
    el.addEventListener("pointerleave", () => this.onHover && this.onHover(null));
  }
}

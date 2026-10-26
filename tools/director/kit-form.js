// A kit spec's numbers as a form (the kit maker and the scene builder's selection panel): one row per param of its
// type, in the units people think in (millimetres for gaps and bevels), rows for cabinet columns, recesses and parts.
import * as KIT from "./kit.js";

const r5 = v => Math.round(v * 1e5) / 1e5;
function inp(type, v, on, step) {
  const i = document.createElement("input"); i.type = type; if (step) i.step = step;
  if (type === "checkbox") { i.checked = !!v; i.onchange = () => on(i.checked); } else { i.value = v; i.onchange = () => on(type === "number" ? +i.value : i.value); }
  return i;
}
function sel(v, opts, on) {
  const s = document.createElement("select");
  for (const o of opts) s.append(new Option(Array.isArray(o) ? o[1] : String(o), Array.isArray(o) ? o[0] : String(o)));
  s.value = String(v); s.onchange = () => on(typeof opts[0] === "number" ? +s.value : s.value); return s;
}
const slotSel = (v, on) => sel(v, Object.keys(KIT.SLOTS), on);
function row(cls, ...xs) { const d = document.createElement("div"); d.className = cls; d.append(...xs); return d; }
function nums(arr, on, step = 0.01, k = 1) {
  return row("kf-nums", ...arr.map((v, i) => inp("number", r5(v * k), x => { const a = arr.slice(); a[i] = x / k; on(a); }, step)));
}
function table(list, cols, on, make) {
  if (cols.some(c => c[2] === "xyz")) return cards(list, cols, on, make);
  const box = row("kf-table");
  const head = row("kf-tr kf-th", ...cols.map(c => Object.assign(document.createElement("span"), { textContent: c[1] })), document.createElement("span"));
  box.append(head);
  list.forEach((it, i) => {
    const cells = cols.map(([k, , kind, opts]) => {
      const set = v => { const l = clone(list); l[i][k] = v; on(l); };
      if (kind === "pick") return sel(it[k] ?? opts[0], opts, set);
      if (kind === "slot") return slotSel(it[k] || "body", set);
      if (kind === "xyz") return nums(it[k] || [0, 0, 0], set, 0.005);
      return inp("number", it[k] ?? 0, set, kind === "int" ? 1 : 0.01);
    });
    const tools = row("kf-rowtools");
    const dup = Object.assign(document.createElement("button"), { textContent: "⧉", title: "duplicate" }); dup.onclick = () => { const l = clone(list); l.splice(i + 1, 0, clone(it)); on(l); };
    const del = Object.assign(document.createElement("button"), { textContent: "✕", title: "remove" }); del.onclick = () => { const l = clone(list); l.splice(i, 1); on(l); };
    tools.append(dup, del);
    box.append(row("kf-tr", ...cells, tools));
  });
  const add = Object.assign(document.createElement("button"), { textContent: "+ add" }); add.onclick = () => on([...clone(list), make()]);
  box.append(add);
  return box;
}
// one small card per row, for rows with xyz cells (free parts): label and value side by side
function cards(list, cols, on, make) {
  const box = row("kf-cards");
  list.forEach((it, i) => {
    const card = row("kf-card"), g = row("kf-grid");
    for (const [k, label, kind, opts] of cols) {
      const set = v => { const l = clone(list); l[i][k] = v; on(l); };
      const input = kind === "pick" ? sel(it[k] ?? opts[0], opts, set) : kind === "slot" ? slotSel(it[k] || "body", set)
        : kind === "xyz" ? nums(it[k] || [0, 0, 0], set, 0.005) : inp("number", it[k] ?? 0, set, 0.005);
      g.append(lab(label), input);
    }
    const tools = row("kf-rowtools");
    const n = Object.assign(document.createElement("span"), { textContent: `#${i + 1}`, className: "kf-n" });
    const dup = Object.assign(document.createElement("button"), { textContent: "⧉ duplicate" }); dup.onclick = () => { const l = clone(list); l.splice(i + 1, 0, clone(it)); on(l); };
    const del = Object.assign(document.createElement("button"), { textContent: "✕ remove" }); del.onclick = () => { const l = clone(list); l.splice(i, 1); on(l); };
    tools.append(n, dup, del);
    card.append(tools, g); box.append(card);
  });
  const add = Object.assign(document.createElement("button"), { textContent: "+ add a part" }); add.onclick = () => on([...clone(list), make()]);
  box.append(add);
  return box;
}
const clone = v => JSON.parse(JSON.stringify(v));
const COL_KINDS = ["door", "doors", "drawers", "open", "glass", "panel", "void"];

// form(spec, onChange): spec is a full spec (type, size, every param); onChange gets a new full spec
export function form(spec, onChange, o = {}) {
  const T = KIT.TYPES[spec.type], box = document.createElement("div"); box.className = "kf";
  const set = (k, v) => { const s = clone(spec); s[k] = v; onChange(s); };
  const grid = row("kf-grid");
  if (!o.noSize) grid.append(lab("size w × d × h, m"), nums(spec.size, v => set("size", v.map(x => Math.max(0.001, x))), 0.01));
  const wide = [];
  for (const [k, label, def, kind, extra] of T.params) {
    const v = spec[k] ?? def;
    if (kind === "cols") { wide.push(lab(label), table(v, [["k", "kind", "pick", COL_KINDS], ["w", "width (0 auto)"], ["n", "shelves / drawers", "int"], ["split", "upper part, m"], ["up", "upper", "pick", COL_KINDS]], x => set(k, x), () => ({ k: "door", w: 0, n: 0, split: 0, up: "door" }))); continue; }
    if (kind === "holes") { wide.push(lab(label), table(v, [["x", "from left"], ["z", "from floor"], ["w", "width"], ["h", "height"], ["depth", "depth"], ["shelves", "shelves", "int"]], x => set(k, x), () => ({ x: 0.2, z: 1, w: 0.6, h: 0.6, depth: 0.15, shelves: 0 }))); continue; }
    if (kind === "parts") { wide.push(lab(label), table(v, [["s", "shape", "pick", ["box", "cyl"]], ["at", "base at x, y, z", "xyz"], ["size", "w, d, h", "xyz"], ["m", "material", "slot"], ["b", "bevel"], ["rz", "turn °"]], x => set(k, x), () => ({ s: "box", at: [0, 0, 0], size: [0.1, 0.1, 0.1], m: "body", b: 0 }))); continue; }
    let input;
    if (kind === "mm") input = inp("number", r5(v * 1000), x => set(k, x / 1000), 0.1);
    else if (kind === "m") input = inp("number", r5(v), x => set(k, x), 0.005);
    else if (kind === "int") input = inp("number", v, x => set(k, Math.round(x)), 1);
    else if (kind === "num" || kind === "deg") input = inp("number", v, x => set(k, x), kind === "deg" ? 1 : 0.05);
    else if (kind === "pick") input = sel(v, extra, x => set(k, x));
    else if (kind === "bool") input = inp("checkbox", v, x => set(k, x));
    else if (kind === "slot") input = slotSel(v, x => set(k, x));
    else if (kind === "m2") input = nums(v, x => set(k, x), 0.01);
    else if (kind === "n2") input = nums(v, x => set(k, x.map(q => Math.max(0, Math.round(q)))), 1);
    else if (kind === "preset") input = sel(v || "none", [["none", "(none)"], ...Object.entries(o.presets || {}).filter(([, p]) => p.type === extra).map(([n, p]) => [n, p.label])], x => set(k, x));
    else if (kind === "m4") input = nums(v, x => set(k, x), 0.01);
    else if (kind === "text") input = inp("text", v ?? "", x => set(k, x));
    else input = inp("text", v, x => set(k, x));
    if (k === "seed") { const reroll = Object.assign(document.createElement("button"), { textContent: "🎲", title: "a new seed" }); reroll.onclick = () => set("seed", 1 + Math.floor(Math.random() * 9999)); input = row("kf-nums", input, reroll); }
    grid.append(lab(label + (kind === "mm" ? ", mm" : kind === "m" || kind === "m2" || kind === "m4" ? ", m" : "")), input);
  }
  box.append(grid, ...wide);
  return box;
}
function lab(t) { const l = document.createElement("label"); l.textContent = t; return l; }

// the keys of a full spec that differ from what its preset (or type) gives: what a story needs to keep
export function overrides(full, presetName, presets) {
  const base = KIT.withDefaults(KIT.resolve(presetName ? { preset: presetName } : { type: full.type }, presets));
  const out = presetName ? { preset: presetName } : { type: full.type };
  for (const [k, v] of Object.entries(full)) if (k !== "type" && JSON.stringify(v) !== JSON.stringify(base[k])) out[k] = clone(v);
  return out;
}
export const CSS = `.kf-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 8px;align-items:center}.kf label{font-size:12px;color:#9a9890}
.kf input[type=number]{width:72px}.kf-nums{display:flex;gap:3px}.kf-table{margin:4px 0 8px;font-size:12px}.kf-tr{display:flex;gap:3px;align-items:center;margin:2px 0}
.kf-th span{flex:1;color:#9a9890;font-size:11px}.kf-cards{margin:4px 0 8px}.kf-card{border:1px solid #33333b;border-radius:5px;padding:4px 6px;margin:4px 0}
.kf-card .kf-rowtools{display:flex;gap:4px;align-items:center;margin-bottom:3px}.kf-n{color:#9a9890;font-size:11px;margin-right:auto}.kf-card .kf-nums input{width:64px}.kf-tr>*{flex:1;min-width:0}.kf-tr input[type=number]{width:100%}.kf-tr .kf-nums input{width:56px}.kf-rowtools{flex:0 0 auto;display:flex;gap:2px}`;

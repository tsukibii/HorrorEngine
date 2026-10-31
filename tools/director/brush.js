// The paint bucket's brush (docs/STREET_PAINT.md §1, docs/SCENE_BUILDER.md §9): the PBR shelf as pictures by category
// (the project's pbr/, your own sets, your attached folders; the first library made in code folded away) and the
// brush that tunes the set picked (a tint, brightness, contrast, saturation, hue, a fade, its shine and relief, its
// size and turn) and layers over it (another set in patches or by its own mask: moss, prints, scuffs; decals scattered
// over it; the bake's wear where there's a bake: grime, streaks, worn edges, damp). One brush for the street paint
// page and the scene builder's Paint. What it paints with is a look: "#rrggbb", "pbr/<set>" or a set with what's done
// to it (a look object, storykit/pbrmix.py's words), which the desk's server makes into a set of its own (street3.js
// prepareLooks), so what's seen is what Blender bakes and Godot gets.
import * as S3 from "./street3.js";

export const CAT_ORDER = ["road", "asphalt", "concrete", "wall", "building", "roofing_tiles", "metal", "plastic", "gravel", "floor", "foliage", "effects"];
const LIB_ORDER = ["walls", "tiles", "siding", "concrete", "metal", "roofs", "roads", "pavements", "other", "your sets"];
export const catName = c => String(c || "your sets").replace(/_/g, " ");
export const encPath = p => p.split("/").map(encodeURIComponent).join("/");
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
  for (const c of kids) e.append(c);
  return e;
}
// a look in a few words: the set's label and what's done to it, a colour as itself
export function lookName(v, none = "its own colour") {
  if (!v) return none;
  if (S3.isLookObj(v)) {
    const m = S3.SHELF.sets[v.set] || {}, n = (v.layers || []).length;
    const bits = [v.tint && "tinted", v.fade && "faded", v.contrast !== undefined && v.contrast !== 1 && "contrast", n && `${n} layer${n > 1 ? "s" : ""}`].filter(Boolean);
    return (m.label || v.set.split("/").pop()) + ` (${bits.join(", ") || "tuned"})`;
  }
  return v.startsWith("pbr/") ? ((S3.SHELF.sets[v] || {}).label || v.split("/").pop()) : v;
}
// a set worth showing as a card: not a made one (the brush shows those), not the first procedural library's leftovers
const shown = ref => !ref.startsWith("pbr/_made/") && !(ref.startsWith("pbr/Procedural/") && !ref.startsWith("pbr/Procedural/jp_"));

const ADJ = [["brightness", "brightness", 0, 2, 0.01, 1], ["contrast", "contrast", 0, 2.5, 0.01, 1], ["saturation", "saturation", 0, 2, 0.01, 1],
  ["hue", "hue", -180, 180, 1, 0], ["fade", "fade", 0, 1, 0.01, 0], ["roughness", "roughness", 0, 2, 0.01, 1], ["bump", "relief", 0, 3, 0.01, 1], ["scale", "size", 0.25, 4, 0.05, 1]];
const LAYER_SET = ["pbr/foliage/Moss002_1K-PNG", "pbr/effects/Fingerprints006_1K-PNG"];
const fmt = v => Math.abs(v) >= 10 ? String(Math.round(v)) : String(Math.round(v * 100) / 100);

// opts: lib (the cards' box), box (the brush's box), wear (offer the bake's wear layers: a street has a bake, a room
// hasn't), onPick() (a card or a colour was picked), onChange(value) (the brush changed: tune what it's tuning, make
// the set), target() (what the brush tunes, in words, or "")
export class Brush {
  constructor(opts) {
    this.o = Object.assign({ wear: true, onPick() { }, onChange() { }, target: () => "" }, opts);
    this.mat = null; this.colour = null; this.brush = null; this.live = true;
  }
  value() {
    if (this.colour) return this.colour;
    const b = this.brush; if (!b || !b.set) return null;
    const out = { set: b.set };
    for (const [k, , , , , d] of ADJ) if (b[k] !== undefined && Math.abs(b[k] - d) > 1e-6) out[k] = b[k];
    if (b.turn) out.turn = b.turn;
    if (b.tint) { out.tint = b.tint; if (b.tint_amount !== undefined && b.tint_amount !== 1) out.tint_amount = b.tint_amount; }
    if (b.layers && b.layers.length) out.layers = b.layers.map(L => Object.fromEntries(Object.entries(L).filter(([, v]) => v !== "" && v !== undefined)));
    return Object.keys(out).length === 1 ? out.set : out;
  }
  pick(ref) { this.mat = ref; this.brush = { set: ref }; this.colour = null; this.o.onPick(); this.library(); this.panel(); return this.brush; }
  useColour(hex) { this.colour = hex; this.mat = null; this.brush = null; this.o.onPick(); this.library(); this.panel(); }
  clear() { this.colour = this.mat = null; this.brush = null; this.library(); this.panel(); }
  take(v) {                                                          // picked up from a surface: the brush becomes what's on it
    if (S3.isLookObj(v)) { this.mat = v.set; this.brush = JSON.parse(JSON.stringify(v)); this.colour = null; }
    else if (typeof v === "string" && v.startsWith("pbr/")) { this.mat = v; this.brush = { set: v }; this.colour = null; }
    else if (v) { this.colour = v; this.mat = null; this.brush = null; }
    this.library(); this.panel();
  }
  changed() { const v = this.value(); this.o.onChange(v); this.panel(); }

  // ---- the library: the shelf by category, a card a set ----
  library() {
    const box = this.o.lib; if (!box) return;
    box.innerHTML = "";
    const groups = {}, old = {};
    for (const [ref, m] of Object.entries(S3.SHELF.sets)) {
      if (ref.startsWith("pbr/_made/")) continue;                     // a tuned look's set: the brush shows it
      if (ref.startsWith("pbr/Procedural/")) { if (ref.startsWith("pbr/Procedural/jp_")) (old[m.group || "other"] ||= []).push([ref, m]); continue; }
      (groups[m.category || "your sets"] ||= []).push([ref, m]);
    }
    const rank = k => { const i = CAT_ORDER.indexOf(k); return i < 0 ? 100 : i; };
    for (const g of Object.keys(groups).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))) box.append(el("h3", {}, catName(g)), this.cards(groups[g]));
    if (Object.keys(old).length) {                                   // the first library, procedural: kept, folded away
      const det = el("details", { class: "old" }, el("summary", {}, "made in code (the first library)"));
      for (const g of Object.keys(old).sort((a, b) => LIB_ORDER.indexOf(a) - LIB_ORDER.indexOf(b))) det.append(el("h3", {}, g), this.cards(old[g]));
      box.append(det);
    }
    if (!Object.keys(groups).length && !Object.keys(old).length) box.append(el("p", {}, "No PBR sets on the shelf (pbr/ in the project, or assets/pbr)"));
  }
  cards(list) {
    const grid = el("div", { class: "grid" });
    for (const [ref, m] of list.sort((a, b) => (a[1].label || a[0]).localeCompare(b[1].label || b[0]))) {
      const pic = ref.startsWith("pbr/Procedural/jp_") ? `${encPath(m.base)}/_lit.jpg` : `${encPath(m.base)}/${encodeURIComponent(m.thumb || m.maps.albedo)}`;
      const card = el("div", { class: "card" + (this.mat === ref && !this.colour ? " on" : ""), title: `${m.label || ref}\n${ref}, ${m.tile_m} m a repeat${m.source ? ", " + m.source : ""}`, "data-ref": ref },
        el("img", { src: `${pic}?s=${m.stamp || ""}`, loading: "lazy", alt: "" }), el("span", {}, m.label || ref.split("/").pop()));
      card.onclick = () => this.pick(ref);
      grid.append(card);
    }
    return grid;
  }

  // ---- the brush: the set picked, tuned and layered (a look object: STREET_PAINT §2) ----
  slider(obj, k, label, lo, hi, step, d) {
    const val = obj[k] ?? d, out = el("output", {}, fmt(val));
    const r = el("input", { type: "range", min: lo, max: hi, step, value: val });
    r.oninput = () => { out.textContent = fmt(+r.value); };
    r.onchange = () => { obj[k] = +r.value; this.changed(); };
    r.ondblclick = () => { obj[k] = d; this.changed(); };
    return el("div", { class: "sl", title: `double-click: back to ${d}` }, el("span", {}, label), r, out);
  }
  tintRow(obj, fallback) {
    const on = el("input", { type: "checkbox" }), col = el("input", { type: "color", value: obj.tint || fallback });
    on.checked = !!obj.tint;
    on.onchange = () => { obj.tint = on.checked ? col.value : ""; this.changed(); };
    col.onchange = () => { obj.tint = col.value; on.checked = true; this.changed(); };
    return el("div", { class: "row" }, el("label", { title: "its colour becomes this one, its light and dark kept" }, on, " tint"), col);
  }
  setOptions() {
    const by = {};
    for (const [ref, m] of Object.entries(S3.SHELF.sets)) if (shown(ref)) (by[m.category || "your sets"] ||= []).push([ref, m]);
    return Object.keys(by).sort().map(c => { const g = document.createElement("optgroup"); g.label = catName(c); for (const [ref, m] of by[c]) g.append(new Option(m.label || ref.split("/").pop(), ref)); return g; });
  }
  layerUI(b, L, i) {
    const box = el("div", { class: "layer" });
    const del = el("button", { title: "take this layer off", onclick: () => { b.layers.splice(i, 1); this.changed(); } }, "×");
    const up = el("button", { title: "under the one before it", onclick: () => { if (i > 0) { [b.layers[i - 1], b.layers[i]] = [b.layers[i], b.layers[i - 1]]; this.changed(); } } }, "↑");
    if (L.wear) {
      const k = el("select", {}, ...[["grime", "grime"], ["streaks", "rain streaks"], ["edges", "worn edges"], ["damp", "damp patches"]].map(([v, t]) => new Option(t, v)));
      k.value = L.wear; k.onchange = () => { L.wear = k.value; this.changed(); };
      box.append(el("div", { class: "top" }, el("small", { class: "dim" }, "wear"), k, up, del), this.slider(L, "amount", "amount", 0, 2, 0.05, 1),
        el("small", { class: "dim" }, this.o.wear ? "Blender's wear on this surface (and Godot's): 0 none, 1 as the street wears, 2 twice. Seen in its render."
          : "the street's bake wears it; a room has no bake, so it does nothing here"));
      return box;
    }
    if (L.decal) {                                                   // a decal scattered over it: the street's decals, as a layer
      const k = el("select", {}, ...Object.entries(S3.DECALS.list).map(([v, d]) => new Option(d.label || v, v)));
      k.value = L.decal; k.onchange = () => { L.decal = k.value; this.changed(); };
      const spin = el("input", { type: "checkbox" }); spin.checked = !!L.spin; spin.onchange = () => { L.spin = spin.checked ? 1 : 0; this.changed(); };
      const aff = el("select", { title: "what it changes" }, ...[["all", "colour and shine"], ["colour", "colour only"], ["shine", "shine only"]].map(([v, t]) => new Option(t, v)));
      aff.value = L.affects || "all"; aff.onchange = () => { L.affects = aff.value; this.changed(); };
      box.append(el("div", { class: "top" }, el("small", { class: "dim" }, "decals"), k, up, del), el("div", { class: "row" }, el("label", { title: "each turned at random" }, spin, " turned"), aff),
        this.slider(L, "count", "how many", 1, 30, 1, 3), this.slider(L, "size", "their size", 0.2, 3, 0.05, 1), this.slider(L, "amount", "amount", 0, 1, 0.01, 1), this.slider(L, "seed", "seed", 1, 50, 1, 1));
      return box;
    }
    const s = el("select", {}, ...this.setOptions()); s.value = L.set; s.onchange = () => { L.set = s.value; this.changed(); };
    const mask = el("select", { title: "where it lies" }, ...[["patches", "in patches"], ["own", "by its own mask"], ["own+patches", "its mask, in patches"], ["all", "all over"]].map(([v, t]) => new Option(t, v)));
    mask.value = L.mask || "patches"; mask.onchange = () => { L.mask = mask.value; this.changed(); };
    const aff = el("select", { title: "what it changes" }, ...[["all", "colour, shine, relief"], ["shine", "shine and relief"], ["colour", "colour only"]].map(([v, t]) => new Option(t, v)));
    aff.value = L.affects || "all"; aff.onchange = () => { L.affects = aff.value; this.changed(); };
    box.append(el("div", { class: "top" }, s, up, del), el("div", { class: "row" }, mask, aff), this.slider(L, "amount", "amount", 0, 1, 0.01, 1));
    if ((L.mask || "patches").includes("patches"))
      box.append(this.slider(L, "coverage", "coverage", 0, 1, 0.01, 0.5), this.slider(L, "size", "patches m", 0.1, 5, 0.05, 1), this.slider(L, "softness", "softness", 0, 1, 0.01, 0.5), this.slider(L, "seed", "seed", 1, 50, 1, 1));
    box.append(this.slider(L, "scale", "its size", 0.25, 4, 0.05, 1), this.tintRow(L, "#5a6a3a"), this.slider(L, "brightness", "brightness", 0, 2, 0.01, 1));
    return box;
  }
  panel() {
    const box = this.o.box, b = this.brush; if (!box) return;
    box.hidden = !b || !b.set || !!this.colour;
    if (box.hidden) return;
    box.innerHTML = "";
    const v = this.value(), ref = S3.lookRef(v), m = S3.SHELF.sets[ref] || S3.SHELF.sets[b.set] || {};
    const pic = m.base ? `${encPath(m.base)}/${encodeURIComponent(m.thumb || (m.maps || {}).albedo || "")}?s=${m.stamp || ""}` : "";
    box.append(el("div", { class: "head" }, el("img", { src: pic, alt: "" }), el("b", {}, lookName(v)),
      el("button", { title: "the set as it comes", onclick: () => { this.brush = { set: b.set }; this.changed(); } }, "reset")));
    box.append(this.tintRow(b, "#a09890"), this.slider(b, "tint_amount", "tint amount", 0, 1, 0.01, 1));
    for (const [k, lab, lo, hi, st, d] of ADJ) box.append(this.slider(b, k, lab, lo, hi, st, d));
    const turn = el("select", {}, ...[0, 90, 180, 270].map(a => new Option(a + "°", a))); turn.value = String(b.turn || 0);
    turn.onchange = () => { b.turn = +turn.value; this.changed(); };
    box.append(el("div", { class: "row" }, "turned", turn));
    box.append(el("h3", {}, "layers over it"));
    (b.layers || []).forEach((L, i) => box.append(this.layerUI(b, L, i)));
    const add = [
      el("button", { title: "another set over this one: moss, prints, scuffs, stains", onclick: () => { (b.layers ||= []).push({ set: LAYER_SET.find(r => S3.SHELF.sets[r]) || b.set, amount: 0.6, mask: "patches", coverage: 0.3, size: 0.8, seed: b.layers.length + 1 }); this.changed(); } }, "+ a set over it"),
      el("button", { title: "decals scattered over it, a few each repeat: scuffs, prints, gum, cracks, stains, stickers", onclick: () => { (b.layers ||= []).push({ decal: S3.DECALS.list.scuffs ? "scuffs" : Object.keys(S3.DECALS.list)[0], count: 3, seed: b.layers.length + 1 }); this.changed(); } }, "+ decals")];
    if (this.o.wear) add.push(el("button", { title: "the bake's grime, rain streaks, worn edges or damp on this surface", onclick: () => { (b.layers ||= []).push({ wear: "grime", amount: 1.5 }); this.changed(); } }, "+ wear"));
    box.append(el("div", { class: "row" }, ...add));
    const live = el("input", { type: "checkbox" }); live.checked = this.live; live.onchange = () => { this.live = live.checked; };
    box.append(el("div", { class: "row" }, el("label", { title: "changes here go onto the surface painted or picked up last" }, live, ` tune ${this.o.target() || "the last surface painted"}`)));
  }
}

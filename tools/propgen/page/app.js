// The prop generator's page (docs/PROPGEN.md §13). Every recipe a card with its picture; a card opens into a form of
// its settings, built from the recipe itself (colours as colour pickers, shares as sliders, words, and the lists the
// generator knows: designs, fonts, liquids, finishes, a family's kinds); its texture with the islands drawn on it,
// where a click puts your picture (a decal), and a PBR set off the shelf per material; the made prop in 3D. Make runs
// tools/propgen.py in the background (variations: one seed after another), Save writes the recipe as `from` its base
// and what differs. window.__pp is the page's state, for its check (tools/propgen/pagetest.mjs).
import { makeViewer } from "/page/view3d.js";

const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (k === "value") e.value = v;
    else if (k === "checked") e.checked = !!v;
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function api(p, body) {
  const r = await fetch(p, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
let toastT = 0;
function toast(msg, bad = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show" + (bad ? " bad" : "");
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.className = ""; }, bad ? 7000 : 3500);
}

const SHARE = new Set(["amount", "fill", "opacity", "burn", "alpha", "soot", "patina", "rust", "puff", "scrape", "limescale", "crazing", "crackle",
  "grime", "dirt", "dust", "scratches", "edges", "stains", "fade", "age_amount", "taper", "squash", "spread", "buckle", "wrinkle", "twist_amt"]);
const LIQUID_FAMS = new Set(["ware", "cookware", "sink"]);
const ART_FAMS = new Set(["can", "bottle", "cup", "sheet", "box", "ware", "charm", "pills"]);
const S = {
  list: [], choices: null, shelf: [], pics: [], fam: "", q: "", name: null, rec: null, raw: null, spec: null, orig: null, base: null,
  meta: null, tab: "settings", decal: -1, smudge: -1, pic: null, busy: new Set(), viewer: null, aspect: {}, job: null, smudges: [],
};
window.__pp = S;

// ---- the gallery -------------------------------------------------------------------------------------------------------

async function loadList() {
  const d = await api("/api/recipes");
  S.list = d.recipes;
  renderFams();
  renderGallery();
}

function renderFams() {
  const counts = {};
  for (const r of S.list) counts[r.family] = (counts[r.family] || 0) + 1;
  const box = $("#fams");
  box.innerHTML = "";
  const fams = Object.keys(S.choices.families).filter(f => counts[f]);
  for (const f of ["", ...fams]) {
    box.append(el("button", { class: S.fam === f ? "on" : "", onclick: () => { S.fam = f; renderFams(); renderGallery(); } },
      f ? `${f} ${counts[f]}` : `all ${S.list.length}`));
  }
}

function card(r) {
  const badges = [];
  if (S.busy.has(r.name)) badges.push(el("span", { class: "badge busy" }, "making…"));
  else if (r.unsaved) badges.push(el("span", { class: "badge unsaved" }, "made, not a recipe"));
  else if (r.edited) badges.push(el("span", { class: "badge edited" }, "made with changes"));
  return el("div", { class: "card" + (r.name === S.name ? " sel" : ""), "data-name": r.name, title: r.label || r.name, onclick: () => open(r.name) },
    r.thumb ? el("img", { src: r.thumb, loading: "lazy", alt: r.name }) : el("div", { class: "ph" }, "not made yet"),
    ...badges, el("div", { class: "nm" }, r.name), el("div", { class: "lb" }, r.label || ""));
}

function renderGallery() {
  const q = S.q.trim().toLowerCase();
  const shown = S.list.filter(r => (!S.fam || r.family === S.fam) &&
    (!q || [r.name, r.family, r.label].join(" ").toLowerCase().includes(q)));
  const box = $("#gallery");
  box.innerHTML = "";
  const order = Object.keys(S.choices.families);
  const groups = {};
  for (const r of shown) (groups[r.family] = groups[r.family] || []).push(r);
  for (const f of [...order, ...Object.keys(groups).filter(f => !order.includes(f))]) {
    if (!groups[f]) continue;
    box.append(el("h3", {}, f), el("div", { class: "cards" }, groups[f].map(card)));
  }
  if (!shown.length) box.append(el("div", { class: "hint" }, "Nothing matches."));
}

// ---- a recipe opened ---------------------------------------------------------------------------------------------------

async function open(name, keepSpec = false) {
  if (!keepSpec && S.spec && name !== S.name && dirty() && !confirm(`Leave your changes to ${S.name}?`)) return;
  const d = await api(`/api/recipe/${encodeURIComponent(name)}`);
  S.name = name;
  S.raw = d.raw;
  S.meta = d.meta;
  S.rec = S.list.find(r => r.name === name) || null;
  if (!keepSpec) {
    S.orig = clone(d.spec);
    S.spec = clone(d.spec);
    S.base = d.raw ? name : null;
    S.decal = -1;
  }
  $("#editor").classList.remove("empty");
  $("#as").value = name;
  $("#seed").value = S.spec.seed ?? 0;
  renderHead();
  renderTab();
  renderGallery();
  updateDirty();
}

function renderHead() {
  const r = S.rec, m = S.meta;
  const th = $("#ed-thumb");
  if (r && r.thumb) { th.src = r.thumb; th.style.visibility = ""; } else th.style.visibility = "hidden";
  $("#ed-name").textContent = S.name + (S.raw ? "" : "  (made, not a recipe)");
  $("#ed-label").value = S.spec.label || "";
  const bits = [S.spec.family];
  if (S.raw && S.raw.from) bits.push(`from ${S.raw.from}`);
  if (m) bits.push(`${m.tris} triangles`, `${m.size_m.map(v => Math.round(v * 1000)).join(" × ")} mm`, `made in ${m.secs} s`);
  else bits.push("not made yet");
  $("#ed-info").textContent = bits.join(" · ");
}

function dirty() { return S.spec && !same(S.spec, S.orig); }
function updateDirty() {
  $("#dirty").textContent = dirty() ? (S.raw ? "Changed since it was opened: Make to see it, Save to keep it in its recipe." :
    "Changed since it was opened: Make to see it, Save as new to keep it as a recipe.") : "";
  $("#save").disabled = !S.raw;
  $("#delete").disabled = !S.raw;
  $("#library").disabled = !S.meta;
}
function changed() {
  updateDirty();
  if (S.tab === "json") renderJSON();
}

function getAt(path) {
  let o = S.spec;
  for (const k of path) { if (o == null) return undefined; o = o[k]; }
  return o;
}
function setAt(path, v, render = false) {
  let o = S.spec;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (o[k] === null || typeof o[k] !== "object") o[k] = typeof path[i + 1] === "number" ? [] : {};
    o = o[k];
  }
  o[path[path.length - 1]] = v;
  changed();
  if (render) renderTab();
}
function delAt(path) {
  const parent = path.length > 1 ? getAt(path.slice(0, -1)) : S.spec, k = path[path.length - 1];
  if (Array.isArray(parent)) parent.splice(k, 1); else delete parent[k];
  changed();
  renderTab();
}

// ---- the settings form, built from the recipe --------------------------------------------------------------------------

function optionsFor(path, v) {
  const C = S.choices, k = path[path.length - 1], fam = S.spec.family;
  if (typeof k === "number") return null;
  if (k === "design") return C.designs;
  if (/font$/.test(k)) return C.fonts;
  if (k === "kind" && path[path.length - 2] === "liquid") return C.liquids;
  if (k === "liquid" && typeof v === "string") return C.liquids;
  if (k === "finish") return C.finishes;
  if (k === "age") return C.ages;
  if (k === "pose") return C.poses;
  if (k === "metal" && typeof v === "string" && !v.startsWith("#")) return C.metals;
  if (path.length === 1 && C.families[fam] && C.families[fam].options[k]) return C.families[fam].options[k];
  return null;
}
const isPicture = (path, v) => path[path.length - 1] === "image" || (path.length === 1 && path[0] === "logo" && typeof v === "string") ||
  (path.length === 2 && path[0] === "pictures" && typeof v === "string");
const isColour = v => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

function picSelect(value, onpick) {
  const s = el("select", { onchange: () => onpick(s.value || null) }, el("option", { value: "" }, "— none —"));
  const known = new Set();
  for (const p of S.pics) { s.append(el("option", { value: p.path }, p.name)); known.add(p.path); }
  if (value && !known.has(value)) s.append(el("option", { value }, value));
  s.value = value || "";
  return s;
}

function plainInput(path, v) {
  const k = path[path.length - 1], opts = optionsFor(path, v);
  if (typeof v === "boolean") return el("input", { type: "checkbox", checked: v, onchange: e => setAt(path, e.target.checked) });
  if (typeof v === "number") {
    const share = SHARE.has(k) && v >= 0 && v <= 1;
    const num = el("input", { type: "number", step: Number.isInteger(v) && !share ? 1 : 0.01, value: v,
      oninput: e => { const x = parseFloat(e.target.value); if (!isNaN(x)) { setAt(path, x); if (rng) rng.value = x; } } });
    const rng = share ? el("input", { type: "range", min: 0, max: 1, step: 0.01, value: v, oninput: e => { num.value = e.target.value; setAt(path, parseFloat(e.target.value)); } }) : null;
    return rng ? el("span", { class: "list" }, rng, num) : num;
  }
  if (isColour(v)) {
    const txt = el("input", { type: "text", value: v, style: "max-width:90px", onchange: e => { if (isColour(e.target.value)) { col.value = e.target.value; setAt(path, e.target.value); } } });
    const col = el("input", { type: "color", value: v, oninput: e => { txt.value = e.target.value; setAt(path, e.target.value); } });
    return el("span", { class: "list" }, col, txt);
  }
  if (isPicture(path, v)) return picSelect(v, p => setAt(path, p));
  if (opts) {
    const s = el("select", { onchange: e => setAt(path, e.target.value) }, opts.map(o => el("option", { value: o }, o)));
    if (v != null && !opts.includes(v)) s.append(el("option", { value: v }, v));
    s.value = v ?? "";
    return s;
  }
  if (typeof v === "string") {
    if (v.length > 40 || v.includes("\\n") || v.includes("\n"))
      return el("textarea", { rows: 2, value: v, oninput: e => setAt(path, e.target.value) });
    return el("input", { type: "text", value: v, oninput: e => setAt(path, e.target.value) });
  }
  return el("input", { type: "text", placeholder: "null (type a value)", value: v === null ? "" : JSON.stringify(v),
    onchange: e => { let x = e.target.value; try { x = JSON.parse(x); } catch { /* a word */ } setAt(path, x === "" ? null : x); } });
}

function removable(path) { return !(path.length === 1 && ["family", "kind"].includes(path[0])); }
const xbtn = path => el("button", { class: "x", title: "take it out of the recipe", onclick: e => { e.stopPropagation(); delAt(path); } }, "×");

function fieldRow(path, v, parent) {
  const k = path[path.length - 1];
  const name = typeof k === "number" ? `${path[path.length - 2]} ${k + 1}` : k;
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    const fs = el("fieldset", {}, el("legend", {}, name, removable(path) ? xbtn(path) : null));
    for (const [kk, vv] of Object.entries(v)) fieldRow([...path, kk], vv, fs);
    fs.append(el("div", { class: "adds" }, el("button", { onclick: () => addKey(path) }, "+ a setting here")));
    parent.append(fs);
    return;
  }
  if (Array.isArray(v) && v.length && v.every(x => x !== null && typeof x === "object" && !Array.isArray(x))) {
    const fs = el("fieldset", {}, el("legend", {}, name, xbtn(path)));
    v.forEach((x, i) => fieldRow([...path, i], x, fs));
    fs.append(el("div", { class: "adds" }, el("button", { onclick: () => { v.push(clone(v[v.length - 1])); changed(); renderTab(); } }, `+ another`)));
    parent.append(fs);
    return;
  }
  const row = el("div", { class: "row" }, el("label", { title: path.join(".") }, name));
  if (Array.isArray(v)) row.append(el("div", { class: "list" }, v.map((x, i) => plainInput([...path, i], x))));
  else row.append(plainInput(path, v));
  if (removable(path)) row.append(xbtn(path));
  parent.append(row);
}

function addKey(path) {
  const key = prompt("The setting's name (as the family's docstring or PROPGEN.md §3 has it):");
  if (!key) return;
  const raw = prompt(`${key}: its value as JSON (a number, "words", true, {"a": 1}, [1, 2])`, "0.5");
  if (raw === null) return;
  let v = raw;
  try { v = JSON.parse(raw); } catch { /* a word */ }
  setAt([...path, key], v, true);
}

function renderSettings() {
  const box = $("#tab-settings");
  box.innerHTML = "";
  const fam = S.spec.family, F = S.choices.families[fam] || { doc: "" };
  const doc = F.doc.split("\n\n")[0].replace(/\s+/g, " "), cut = doc.search(/[.:](\s|$)/);
  box.append(el("details", { class: "hint" }, el("summary", {}, cut > 0 ? doc.slice(0, cut + 1) : doc), cut > 0 ? doc.slice(cut + 1) : ""));
  const skip = new Set(["family", "label", "seed", "pbr", "decals", "logo"]);
  const keys = Object.keys(S.spec).filter(k => !skip.has(k)).sort((a, b) => (a === "kind" ? -1 : b === "kind" ? 1 : 0));
  for (const k of keys) fieldRow([k], S.spec[k], box);
  const adds = el("div", { class: "adds" });
  if (LIQUID_FAMS.has(fam) && !S.spec.liquid) adds.append(el("button", { onclick: () => setAt(["liquid"], { kind: "tea", fill: 0.7 }, true) }, "+ a liquid in it"));
  if (ART_FAMS.has(fam) && !S.spec.art) adds.append(el("button", { onclick: () => setAt(["art"], { design: S.choices.designs[0] }, true) }, "+ a print (art)"));
  if (!S.spec.wear) adds.append(el("button", { onclick: () => setAt(["wear"], { grime: 0.2, dirt: 0.1 }, true) }, "+ wear"));
  adds.append(el("button", { onclick: () => addKey([]) }, "+ a setting…"),
    el("button", { onclick: () => switchTab("texture") }, "Pictures, logos and PBR sets →"));
  box.append(adds);
}

// ---- the texture: its islands, pictures placed on them, PBR sets per material -------------------------------------------

function picUrl(path) {
  if (typeof path === "string" && path.startsWith("smudge/")) return `/smudges/${path.slice(7)}.png`;
  const p = S.pics.find(x => x.path === path);
  return p ? p.url : null;
}

// ---- what size a picture wants: the texture's pixels a millimetre there, twice over (a close-up, or a texture twice
// the size, still sharp; bigger is fine, it's scaled down), rounded up to 16
function pxPerMm(island) {
  const M = S.meta, isl = M && M.islands[island];
  if (!isl) return 0;
  const px = ((M.materials || {})[isl.mat] || {}).px || 1024;
  return (isl.rect[2] - isl.rect[0]) * px / isl.mm[0];
}
function wants(island, wmm, hmm) {
  const s = island === "*" ? Math.max(...Object.keys(S.meta.islands).map(pxPerMm)) : pxPerMm(island);
  const r = v => Math.max(64, Math.ceil(v * s * 2 / 16) * 16);
  return [r(wmm), r(hmm)];
}
function sizeNote(island, wmm, hmm, what) {
  const [w, h] = wants(island, wmm, hmm);
  return el("span", { class: "wants", title: `${wmm.toFixed(0)} × ${hmm.toFixed(0)} mm on the prop, at ${pxPerMm(island === "*" ? Object.keys(S.meta.islands)[0] : island).toFixed(1)} texture pixels a mm; ` +
    "twice that so it's sharp up close. Bigger is fine (it's scaled down); smaller goes soft." }, `${w} × ${h} px${what ? ", " + what : ""}`);
}

// ---- the prop's own pictures (meta.json's slots, docs/PROPGEN.md §15): each swapped for yours, turned off, or the
// generator's own; the drawn one cropped from the texture as a template at the size it wants
function slotCrop(sl, scale = 1) {
  const M = S.meta, isl = M.islands[sl.island], files = M.textures[isl.mat];
  const [W, H] = isl.mm, [u0, v0, u1, v1] = isl.rect, [x0, y0, w, h] = sl.box;
  const [tw, th] = wants(sl.island, w, h);
  const cv = el("canvas", { class: "crop", width: Math.round(scale === 1 ? Math.min(96, 96 * w / Math.max(w, h)) : tw),
    height: Math.round(scale === 1 ? Math.min(96, 96 * h / Math.max(w, h)) : th) });
  const im = new Image();
  cv.ready = new Promise(res => {
    im.onload = () => {
      const iw = im.naturalWidth, ih = im.naturalHeight;
      const sx = (u0 + x0 / W * (u1 - u0)) * iw, sy = (1 - (v0 + (y0 + h) / H * (v1 - v0))) * ih;
      cv.getContext("2d").drawImage(im, sx, sy, w / W * (u1 - u0) * iw, h / H * (v1 - v0) * ih, 0, 0, cv.width, cv.height);
      res(cv);
    };
    im.onerror = () => res(cv);
  });
  im.src = `/props/${encodeURIComponent(M.name)}/${files[0]}?v=${M._mtime || 0}`;
  return cv;
}
function setPicture(id, val, opts) {
  const pics = S.spec.pictures || (S.spec.pictures = {});
  const cur = pics[id];
  if (val === "") delete pics[id];
  else if (val === "off") pics[id] = false;
  else if (opts) pics[id] = Object.assign(typeof cur === "object" && cur ? cur : { image: typeof cur === "string" ? cur : val }, opts);
  else pics[id] = typeof cur === "object" && cur ? Object.assign(cur, { image: val }) : val;
  if (!Object.keys(pics).length) delete S.spec.pictures;
  changed();
  renderTexture();
}
function slotRows() {
  const M = S.meta, box = el("div", { class: "slots" });
  const pics = S.spec.pictures || {};
  for (const sl of M.slots || []) {
    const isl = M.islands[sl.island];
    if (!isl) continue;
    const cur = pics[sl.id], p = cur && typeof cur === "object" ? cur : typeof cur === "string" ? { image: cur } : null;
    const sel = el("select", { onchange: () => setPicture(sl.id, sel.value) },
      el("option", { value: "" }, "the generator's own"), el("option", { value: "off" }, "nothing there"),
      ...S.pics.map(x => el("option", { value: x.path }, x.name)));
    if (p && !S.pics.some(x => x.path === p.image)) sel.append(el("option", { value: p.image }, p.image));
    sel.value = cur === false ? "off" : p ? p.image : "";
    const cut = ["logo", "flourish", "stamp", "text"].includes(sl.kind);
    const round = isl.wrap && sl.box[2] >= isl.mm[0] * 0.95;
    const what = (cut ? "PNG, transparent round it" : "PNG or JPEG") + (round || sl.kind === "pattern" ? ", seamless left to right" : "");
    const tmpl = el("a", { class: "tmpl", href: "#", title: "The generator's own picture there, at the size it wants: paint over it", onclick: e => {
      e.preventDefault();
      slotCrop(sl, 2).ready.then(c => { const a = el("a", { href: c.toDataURL("image/png"), download: `${M.name}_${sl.id.replace(".", "_")}.png` }); document.body.append(a); a.click(); a.remove(); });
    } }, "template");
    const num = (k, step, dflt) => el("label", { class: "dim" }, k + " ", el("input", { type: "number", step, value: p && p[k] !== undefined ? p[k] : dflt,
      onchange: e => setPicture(sl.id, p.image, { [k]: parseFloat(e.target.value) }) }));
    box.append(el("div", { class: "slot", "data-slot": sl.id },
      p ? el("img", { src: picUrl(p.image) || "", alt: "" }) : slotCrop(sl),
      el("div", { class: "who" }, el("b", {}, sl.id), el("span", { class: "dim" }, ` ${sl.kind}: ${sl.about || ""}`),
        el("div", {}, sizeNote(sl.island, sl.box[2], sl.box[3], what), " ", tmpl)),
      sel,
      p ? el("select", { onchange: e => setPicture(sl.id, p.image, { fit: e.target.value }) }, ["contain", "cover", "stretch"].map(f => el("option", { value: f, selected: (p.fit || "contain") === f }, f))) : null,
      p ? num("scale", 0.05, 1) : null,
      p ? el("label", { class: "dim" }, "tint ", el("input", { type: "color", value: p.tint || "#ffffff", onchange: e => setPicture(sl.id, p.image, { tint: e.target.value }) })) : null));
  }
  return box;
}

// a decal's or a smudge's row picked (a click on the texture then moves it); a click on one of its controls doesn't
// draw the tab again, which would take the control's focus
function pickRow(kind, i, e) {
  if (kind === "decal") { S.decal = i; S.smudge = -1; } else { S.smudge = i; S.decal = -1; }
  if (e.target.closest("input,select,button,label,a")) {
    document.querySelectorAll("#tab-texture .decal").forEach(r => r.classList.remove("sel"));
    e.currentTarget.classList.add("sel");
    return;
  }
  renderTexture();
}

// ---- smudges: stains laid over the paint (the built-in shelf, or your own: transparent round it, or dark on white)
function largestIsland() {
  let best = null, area = -1;
  for (const [n, i] of Object.entries(S.meta.islands)) if (i.mm[0] * i.mm[1] > area) { best = n; area = i.mm[0] * i.mm[1]; }
  return best;
}
function addSmudge(path) {
  const list = S.spec.smudges || (S.spec.smudges = []);
  const isl = largestIsland(), I = S.meta.islands[isl], base = S.smudges.find(m => m.path === path);
  list.push({ image: path, island: isl, x: +(I.mm[0] / 2).toFixed(1), y: +(I.mm[1] / 2).toFixed(1), w: Math.min(base ? base.w : 40, I.mm[0] * 0.6, I.mm[1] * 0.9) });
  S.smudge = list.length - 1;
  S.decal = -1;
  changed();
  renderTexture();
}
function smudgeRows(box) {
  const list = S.spec.smudges || [];
  const islands = Object.keys(S.meta.islands);
  list.forEach((m, i) => {
    const base = S.smudges.find(x => x.path === m.image) || {};
    const set = (k, v) => { if (v === "" || v === null || (typeof v === "number" && isNaN(v))) delete m[k]; else m[k] = v; changed(); renderTexture(); };
    const num = (k, step, dflt) => el("label", { class: "dim" }, k + " ", el("input", { type: "number", step, value: m[k] ?? dflt ?? "", onchange: e => set(k, parseFloat(e.target.value)) }));
    const isl = el("select", { onchange: e => set("island", e.target.value) }, el("option", { value: "*" }, "any part"), islands.map(n => el("option", { value: n }, n)));
    isl.value = m.island || "*";
    const img = el("select", { onchange: e => set("image", e.target.value) }, S.smudges.map(x => el("option", { value: x.path }, x.name.replace("_", " "))),
      S.pics.map(x => el("option", { value: x.path }, x.name)));
    if (![...S.smudges, ...S.pics].some(x => x.path === m.image)) img.append(el("option", { value: m.image }, m.image));
    img.value = m.image;
    const w = m.w ?? base.w ?? 40;
    box.append(el("div", { class: "decal smudge" + (i === S.smudge ? " sel" : ""), onclick: e => pickRow("smudge", i, e) },
      el("img", { src: picUrl(m.image) || "", alt: "" }), img, isl,
      (m.count || 1) > 1 ? null : num("x", 0.5), (m.count || 1) > 1 ? null : num("y", 0.5), num("w", 0.5, w), (m.count || 1) > 1 ? null : num("rot", 5, 0),
      num("strength", 0.05, 0.8), num("count", 1, 1),
      el("select", { onchange: e => set("blend", e.target.value) }, ["multiply", "mix"].map(b => el("option", { value: b, selected: (m.blend || base.blend || "multiply") === b }, b))),
      num("rough", 0.05, base.rough ?? ""),
      sizeNote(m.island || "*", w, w, "transparent round it"),
      el("button", { class: "x", onclick: e => { e.stopPropagation(); list.splice(i, 1); if (!list.length) delete S.spec.smudges; S.smudge = -1; changed(); renderTexture(); } }, "×")));
  });
}
function aspectOf(path) {
  if (S.aspect[path] !== undefined || !path) return S.aspect[path] || 1;
  S.aspect[path] = 1;
  const u = picUrl(path);
  if (u) {
    const im = new Image();
    im.onload = () => { S.aspect[path] = im.naturalHeight / im.naturalWidth; if (S.tab === "texture") renderTexture(); };
    im.src = u;
  }
  return 1;
}

function placeDecal(island, x, y) {
  const decals = S.spec.decals || (S.spec.decals = []);
  const isl = S.meta.islands[island];
  if (S.decal >= 0 && decals[S.decal]) {
    Object.assign(decals[S.decal], { island, x: +x.toFixed(1), y: +y.toFixed(1) });
  } else {
    const image = S.pic || (S.pics[0] && S.pics[0].path);
    if (!image) { toast("Drop a picture below first: it's what goes there", true); return; }
    decals.push({ image, island, x: +x.toFixed(1), y: +y.toFixed(1), w: +Math.min(isl.mm[0] / 3, 60).toFixed(1) });
    S.decal = decals.length - 1;
  }
  changed();
  renderTexture();
}

function atlas(mat, files) {
  const M = S.meta, v = M._mtime || 0;
  const wrap = el("div", { class: "atlas", "data-mat": mat });
  wrap.append(el("img", { src: `/props/${encodeURIComponent(M.name)}/${files[0]}?v=${v}`, alt: mat, draggable: "false" }));
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 1 1");
  svg.setAttribute("preserveAspectRatio", "none");
  for (const [name, isl] of Object.entries(M.islands)) {
    if (isl.mat !== mat) continue;
    const [u0, v0, u1, v1] = isl.rect;
    const r = document.createElementNS(NS, "rect");
    Object.entries({ x: u0, y: 1 - v1, width: u1 - u0, height: v1 - v0, class: "isl", "data-island": name }).forEach(([a, b]) => r.setAttribute(a, b));
    r.setAttribute("vector-effect", "non-scaling-stroke");
    const t = document.createElementNS("http://www.w3.org/2000/svg", "title");
    t.textContent = `${name}: ${isl.mm[0]} × ${isl.mm[1]} mm`;
    r.append(t);
    svg.append(r);
  }
  (S.spec.decals || []).forEach((d, i) => {
    const isl = M.islands[d.island];
    if (!isl || isl.mat !== mat) return;
    const [u0, v0, u1, v1] = isl.rect;
    const a = aspectOf(d.image), [W, H] = isl.mm;
    let w = d.w ?? W / 3, h = d.h ?? w * a, x = d.x ?? W / 2, y = d.y ?? H / 2;
    if (d.fit === "stretch") [w, h, x, y] = [W, H, W / 2, H / 2];
    else if (d.fit === "width") [w, h, x] = [W, W * a, W / 2];
    else if (d.fit === "height") [w, h, y] = [H / a, H, H / 2];
    const cu = u0 + (x / W) * (u1 - u0), cv = v0 + (y / H) * (v1 - v0);
    const du = (w / isl.mm[0]) * (u1 - u0), dv = (h / isl.mm[1]) * (v1 - v0);
    const r = document.createElementNS(NS, "rect");
    Object.entries({ x: cu - du / 2, y: 1 - cv - dv / 2, width: du, height: dv, class: "dec" + (i === S.decal ? " sel" : "") }).forEach(([a, b]) => r.setAttribute(a, b));
    r.setAttribute("vector-effect", "non-scaling-stroke");
    svg.append(r);
  });
  for (const sl of M.slots || []) {
    const isl = M.islands[sl.island];
    if (!isl || isl.mat !== mat) continue;
    const [u0, v0, u1, v1] = isl.rect, [W, H] = isl.mm, [x0, y0, w, h] = sl.box;
    const r = document.createElementNS(NS, "rect");
    Object.entries({ x: u0 + x0 / W * (u1 - u0), y: 1 - (v0 + (y0 + h) / H * (v1 - v0)), width: w / W * (u1 - u0), height: h / H * (v1 - v0), class: "slotbox" }).forEach(([a, b]) => r.setAttribute(a, b));
    r.setAttribute("vector-effect", "non-scaling-stroke");
    const t = document.createElementNS(NS, "title");
    t.textContent = `${sl.id}: ${sl.about || sl.kind}`;
    r.append(t);
    svg.append(r);
  }
  (S.spec.smudges || []).forEach((m, i) => {
    const isl = M.islands[m.island];
    if (!isl || isl.mat !== mat || (m.count || 1) > 1) return;
    const [u0, v0, u1, v1] = isl.rect, [W, H] = isl.mm, w = m.w ?? 40;
    const c = document.createElementNS(NS, "ellipse");
    Object.entries({ cx: u0 + (m.x ?? W / 2) / W * (u1 - u0), cy: 1 - (v0 + (m.y ?? H / 2) / H * (v1 - v0)), rx: w / 2 / W * (u1 - u0), ry: w / 2 / H * (v1 - v0),
      class: "smu" + (i === S.smudge ? " sel" : "") }).forEach(([a, b]) => c.setAttribute(a, b));
    c.setAttribute("vector-effect", "non-scaling-stroke");
    svg.append(c);
  });
  wrap.append(svg);
  wrap.addEventListener("click", e => {
    const b = wrap.getBoundingClientRect(), sx = (e.clientX - b.left) / b.width, sy = (e.clientY - b.top) / b.height;
    for (const [name, isl] of Object.entries(M.islands)) {
      if (isl.mat !== mat) continue;
      const [u0, v0, u1, v1] = isl.rect;
      if (sx >= u0 && sx <= u1 && 1 - sy >= v0 && 1 - sy <= v1) {
        const x = ((sx - u0) / (u1 - u0)) * isl.mm[0], y = ((1 - sy - v0) / (v1 - v0)) * isl.mm[1];
        const sm = (S.spec.smudges || [])[S.smudge];
        if (sm) {
          Object.assign(sm, { island: name, x: +x.toFixed(1), y: +y.toFixed(1) });
          delete sm.count;
          changed();
          renderTexture();
        } else placeDecal(name, x, y);
        return;
      }
    }
    toast("That's between islands: nothing of the prop is painted there");
  });
  return wrap;
}

function pbrRow(mat) {
  const cur = (S.spec.pbr || {})[mat];
  const c = cur ? (typeof cur === "string" ? { set: cur } : cur) : null;
  const set = (patch) => {
    const now = Object.assign({ set: c ? c.set : S.shelf[0] && S.shelf[0].ref }, c || {}, patch);
    if (!now.set) { const p = S.spec.pbr || {}; delete p[mat]; if (!Object.keys(p).length) delete S.spec.pbr; changed(); renderTexture(); return; }
    S.spec.pbr = S.spec.pbr || {};
    S.spec.pbr[mat] = now;
    changed();
    renderTexture();
  };
  const sel = el("select", { onchange: e => set({ set: e.target.value || null }) }, el("option", { value: "" }, "— its own paint —"),
    S.shelf.map(s => el("option", { value: s.ref }, s.ref.slice(4))));
  sel.value = c ? c.set : "";
  const sw = c && S.shelf.find(s => s.ref === c.set);
  const row = el("div", { class: "pbrrow" }, el("span", { class: "dim" }, "PBR set"), sel, sw ? el("img", { src: sw.thumb, alt: "" }) : null);
  if (c) {
    row.append(el("label", { class: "dim" }, "tile m ", el("input", { type: "number", step: 0.05, value: c.tile ?? (sw && sw.tile_m) ?? 1, onchange: e => set({ tile: parseFloat(e.target.value) }) })),
      el("label", { class: "dim" }, "over its paint ", el("input", { type: "range", min: 0, max: 1, step: 0.05, value: c.alpha ?? 1, onchange: e => set({ alpha: parseFloat(e.target.value) }) })),
      el("label", { class: "dim" }, "tint ", el("input", { type: "color", value: c.tint || "#ffffff", onchange: e => set({ tint: e.target.value === "#ffffff" ? undefined : e.target.value }) })));
  }
  if (!S.shelf.length) row.append(el("span", { class: "dim" }, "(the shelf is empty: assets/pbr, or propgen.py pbr-add)"));
  return row;
}

function fitSel(d) {
  const s = el("select", { title: "where it goes on its island", onclick: e => e.stopPropagation(),
    onchange: e => { if (e.target.value) d.fit = e.target.value; else delete d.fit; changed(); renderTexture(); } },
    [["", "placed"], ["stretch", "over all of it"], ["width", "its width"], ["height", "its height"]].map(([v, t]) => el("option", { value: v }, t)));
  s.value = d.fit || "";
  return s;
}

// what a picture over a whole island should be: the pixels the texture holds there, twice that for a close-up, its shape,
// and whether it goes round (a band's left and right edges meet at the back)
function islandRows(mat) {
  const M = S.meta, px = ((M.materials || {})[mat] || {}).px || 1024;
  const rows = el("div", { class: "islands" });
  for (const [name, isl] of Object.entries(M.islands)) {
    if (isl.mat !== mat) continue;
    const [u0, v0, u1, v1] = isl.rect, pw = Math.round((u1 - u0) * px), ph = Math.round((v1 - v0) * px);
    const shape = isl.mm[0] >= isl.mm[1] ? `${(isl.mm[0] / isl.mm[1]).toFixed(2)} : 1` : `1 : ${(isl.mm[1] / isl.mm[0]).toFixed(2)}`;
    rows.append(el("div", { class: "isl-row", "data-island": name },
      el("b", {}, name),
      el("span", { class: "dim" }, `${isl.mm[0]} × ${isl.mm[1]} mm, shaped ${shape}`),
      el("span", { title: `the texture holds ${pw} × ${ph} px there at ${px}; for a ${px * 2} texture (a close-up) twice that` },
        `picture ${pw * 2} × ${ph * 2} px or more`),
      isl.wrap ? el("span", { class: "wraps", title: "a band round the prop: the picture's left and right edges meet at the back" }, "goes round: seamless left to right if it's a pattern") : null,
      el("button", { onclick: () => wrapIsland(name) }, "Wrap a picture over it")));
  }
  return rows;
}

function wrapIsland(island) {
  const image = S.pic || (S.pics[0] && S.pics[0].path);
  if (!image) { toast("Drop a picture below first: it's what goes over it", true); return; }
  const decals = S.spec.decals || (S.spec.decals = []);
  decals.push({ image, island, fit: "stretch" });
  S.decal = decals.length - 1;
  changed();
  renderTexture();
}

function decalRows(box) {
  const decals = S.spec.decals || [];
  const islands = S.meta ? Object.keys(S.meta.islands) : [];
  decals.forEach((d, i) => {
    const num = (k, step = 1) => el("label", { class: "dim" }, k + " ", el("input", { type: "number", step, value: d[k] ?? "",
      onchange: e => { const x = parseFloat(e.target.value); if (isNaN(x)) delete d[k]; else d[k] = x; changed(); renderTexture(); } }));
    const isl = el("select", { onchange: e => { d.island = e.target.value; changed(); renderTexture(); } }, islands.map(n => el("option", { value: n }, n)));
    if (!islands.includes(d.island)) isl.append(el("option", { value: d.island }, d.island));
    isl.value = d.island;
    const u = picUrl(d.image);
    box.append(el("div", { class: "decal" + (i === S.decal ? " sel" : ""), onclick: e => pickRow("decal", i, e) },
      u ? el("img", { src: u, alt: "" }) : null, picSelect(d.image, p => { d.image = p; changed(); renderTexture(); }), isl, fitSel(d),
      !d.fit || d.fit === "height" ? num("x", 0.5) : null, !d.fit || d.fit === "width" ? num("y", 0.5) : null, d.fit ? null : num("w", 0.5),
      num("alpha", 0.05), num("rough", 0.05),
      el("label", { class: "dim", title: "A flourish: copies spread along the part" }, "repeat ", el("input", { type: "number", step: 1, min: 1, value: d.repeat ?? 1,
        onchange: e => { const n = parseInt(e.target.value, 10); if (n > 1) d.repeat = n; else delete d.repeat; changed(); renderTexture(); } })),
      d.repeat > 1 ? el("label", { class: "dim" }, el("input", { type: "checkbox", checked: !!d.mirror, onchange: e => { if (e.target.checked) d.mirror = true; else delete d.mirror; changed(); } }), " every other mirrored") : null,
      el("label", { class: "dim", title: "A flourish in each corner, each mirrored to face its corner" }, el("input", { type: "checkbox", checked: !!d.corners,
        onchange: e => { if (e.target.checked) d.corners = true; else delete d.corners; changed(); renderTexture(); } }), " corners"),
      el("label", { class: "dim" }, el("input", { type: "checkbox", checked: !!d.flip, onchange: e => { if (e.target.checked) d.flip = true; else delete d.flip; changed(); } }), " mirrored"),
      S.meta && S.meta.islands[d.island] ? sizeNote(d.island, d.fit === "stretch" || d.fit === "width" ? S.meta.islands[d.island].mm[0] : (d.w ?? S.meta.islands[d.island].mm[0] / 3),
        d.fit === "stretch" || d.fit === "height" ? S.meta.islands[d.island].mm[1] : (d.h ?? (d.w ?? S.meta.islands[d.island].mm[0] / 3) * aspectOf(d.image)), "") : null,
      el("button", { class: "x", onclick: e => { e.stopPropagation(); decals.splice(i, 1); if (!decals.length) delete S.spec.decals; S.decal = -1; changed(); renderTexture(); } }, "×")));
  });
}

async function uploadFiles(files) {
  for (const f of files) {
    if (!/^image\/(png|jpeg)$/.test(f.type)) { toast(`${f.name}: a PNG or a JPEG`, true); continue; }
    const data = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
    const p = await api("/api/upload", { name: f.name, data });
    S.pics = (await api("/api/pictures")).images;
    S.pic = p.path;
    if (S.decal >= 0 && S.spec.decals && S.spec.decals[S.decal]) { S.spec.decals[S.decal].image = p.path; changed(); }
    toast(`${p.name}: in ${p.path}`);
  }
  renderTexture();
}

function renderTexture() {
  const box = $("#tab-texture");
  box.innerHTML = "";
  const M = S.meta;
  box.append(el("div", { class: "hint" }, "Click on the texture to put the picked picture there (a decal: it goes where that part of the prop is), " +
    "or wrap one over a whole part from the list under it (your own label: the folds, dents, wear and baked detail still go on top). " +
    "Pick a decal in the list to move it with a click. A PBR set off the shelf covers a material's own paint. Then Make."));
  if (!M || !M.islands) {
    box.append(el("div", { class: "hint bad" }, "Make it once: its texture's layout (the islands) comes from the last make."));
  } else {
    for (const [mat, files] of Object.entries(M.textures)) {
      const info = (M.materials || {})[mat] || {};
      box.append(el("div", { class: "mat" }, el("h4", {}, `${mat}`, el("span", { class: "dim" }, ` ${info.kind || ""}, ${info.px || ""} px`)),
        pbrRow(mat), atlas(mat, files), islandRows(mat)));
    }
  }
  if (M && (M.slots || []).length) {
    box.append(el("h4", {}, "Its own pictures", el("span", { class: "dim" }, " (dashed on the texture): swap each for yours, or turn it off")), slotRows());
  } else if (M && M.islands) {
    box.append(el("h4", {}, "Its own pictures"), el("div", { class: "hint" }, "This one draws no logo or picture of its own: wrap a part, or put pictures, flourishes and smudges on it below."));
  }
  box.append(el("h4", {}, "Pictures on it (decals and flourishes)"));
  const list = el("div");
  decalRows(list);
  if (!(S.spec.decals || []).length) list.append(el("div", { class: "hint" }, "None yet: click on the texture above. A flourish is one repeated along a part or put in its corners."));
  box.append(list);
  if (M && M.islands) {
    box.append(el("h4", {}, "Smudges", el("span", { class: "dim" }, " over the paint, under the wear: pick one to move it with a click on the texture")));
    const sl = el("div");
    smudgeRows(sl);
    box.append(sl, el("div", { class: "pics shelf" }, S.smudges.map(m => el("div", { class: "pic", title: `${m.name.replace("_", " ")}: ${m.about} (${m.blend})`, onclick: () => addSmudge(m.path) },
      el("img", { src: m.url, alt: m.name }))), el("span", { class: "dim" }, "← click one to add it; or add one of your pictures as a smudge: ",
      el("button", { onclick: () => { const p = S.pic || (S.pics[0] && S.pics[0].path); if (p) addSmudge(p); else toast("Drop a picture below first", true); } }, "the picked picture"))));
  }
  box.append(el("h4", {}, "Your pictures"));
  const input = el("input", { type: "file", accept: "image/png,image/jpeg", multiple: true, hidden: true, onchange: e => uploadFiles(e.target.files) });
  const drop = el("div", { class: "drop", onclick: () => input.click() }, "Drop a PNG or a JPEG here (a logo, a label, a sticker; transparent where it should be cut out), or click to choose", input);
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); uploadFiles(e.dataTransfer.files); });
  box.append(drop, el("div", { class: "pics" }, S.pics.map(p => el("div", { class: "pic" + (p.path === S.pic ? " sel" : ""), title: p.path,
    onclick: () => { S.pic = p.path; if (S.decal >= 0 && S.spec.decals && S.spec.decals[S.decal]) { S.spec.decals[S.decal].image = p.path; changed(); } renderTexture(); } },
    el("img", { src: p.url, alt: p.name }))), S.pics.length ? null : el("span", { class: "dim" }, "none yet")));
}

// ---- 3D and JSON --------------------------------------------------------------------------------------------------------

async function renderView() {
  const info = $("#view-info");
  if (!S.meta) { info.textContent = "Not made yet: Make it to see it here."; if (S.viewer) S.viewer.clear(); return; }
  if (!S.viewer) {
    S.viewer = makeViewer($("#view3d"));
    if (!S.viewer) { info.textContent = "This browser has no WebGL."; return; }
  }
  info.textContent = "loading…";
  try {
    const glb = (S.meta.files || []).find(f => f.endsWith(".glb"));
    const r = await S.viewer.load(`/props/${encodeURIComponent(S.meta.name)}/${glb}?v=${S.meta._mtime || 0}`);
    S.viewInfo = r;
    info.innerHTML = "";
    const spin = el("input", { type: "checkbox", onchange: e => S.viewer.setSpin(e.target.checked) });
    info.append(el("label", {}, spin, " turn"), `   ${Math.round(r.tris)} triangles · ${r.size.map(v => Math.round(v * 1000)).join(" × ")} mm` +
      (r.sockets.length ? ` · sockets: ${r.sockets.join(", ")}` : "") + "   (drag to turn, wheel to zoom, double-click to frame)");
  } catch (e) {
    info.textContent = "Couldn't load it: " + e.message;
  }
}

function renderJSON() {
  $("#json").value = JSON.stringify(S.spec, null, 1);
  $("#json-err").textContent = "";
}

function renderTab() {
  for (const t of ["settings", "texture", "view", "json"]) $("#tab-" + t).hidden = t !== S.tab;
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === S.tab));
  if (!S.spec) return;
  if (S.tab === "settings") renderSettings();
  else if (S.tab === "texture") renderTexture();
  else if (S.tab === "view") renderView();
  else renderJSON();
}
function switchTab(t) { S.tab = t; renderTab(); }

// ---- making, saving ------------------------------------------------------------------------------------------------------

async function watch(job, names, then) {
  S.busy = new Set([...S.busy, ...names]);
  renderGallery();
  const box = $("#job"), log = $("#job-log"), head = $("#job-head");
  box.hidden = false;
  log.textContent = "";
  let from = 0, state = "queued";
  S.job = { id: job, state, names };
  while (true) {
    await new Promise(r => setTimeout(r, 700));
    let j;
    try { j = await api(`/api/job/${job}?from=${from}`); } catch { continue; }
    from = j.lines;
    if (j.log.length) { log.textContent += j.log.join("\n") + "\n"; log.scrollTop = log.scrollHeight; }
    state = j.state;
    const secs = j.started ? Math.round(((j.ended || Date.now() / 1000) - j.started)) : 0;
    head.textContent = `${j.kind} ${names.join(", ")}: ${state}${secs ? ` (${secs} s)` : ""}`;
    S.job.state = state;
    if (state === "done" || state === "failed") break;
  }
  for (const n of names) S.busy.delete(n);
  await loadList();
  if (state === "done") { toast(`made ${names.join(", ")}`); if (then) await then(); }
  else toast(`${names.join(", ")}: it failed (the log says why)`, true);
  S.job.finished = true;
}

async function make() {
  const name = $("#as").value.trim() || S.name;
  if (!/^[a-z0-9_][a-z0-9_\-]{0,80}$/.test(name)) { toast("Make as: lower case letters, digits, _ and -", true); return; }
  const seed = parseInt($("#seed").value || "0", 10) || 0;
  const n = parseInt($("#vars").value, 10) || 1;
  const spec = clone(S.spec);
  spec.seed = seed;
  S.spec.seed = seed;
  const body = { name, spec, seeds: n > 1 ? Array.from({ length: n }, (_, i) => seed + i * 101) : [seed], formats: $("#allfmt").checked ? "glb,fbx,obj,blend" : "glb" };
  if ($("#tex").value) body.tex = parseInt($("#tex").value, 10);
  let r;
  try { r = await api("/api/make", body); } catch (e) { toast(e.message, true); return; }
  const madeSpec = clone(S.spec);
  await watch(r.job, r.names, async () => {
    const first = r.names[0];
    if (first === S.name) {                              // the same prop: what was made is now what's shown
      const d = await api(`/api/recipe/${encodeURIComponent(first)}`);
      S.meta = d.meta;
      S.rec = S.list.find(x => x.name === first) || null;
      renderHead(); renderTab(); updateDirty();
    } else {                                             // another name (or variations): open what was made, its base kept
      const base = S.base || (S.raw ? S.name : null);
      await open(first, true);
      S.spec = clone(madeSpec);
      S.spec.seed = (r.names.length > 1 ? seed : seed);
      S.orig = clone(S.spec);
      S.base = base;
      renderHead(); renderTab(); updateDirty();
    }
  });
}

async function save(asNew) {
  const name = asNew ? $("#as").value.trim() : S.name;
  if (!/^[a-z0-9_][a-z0-9_\-]{0,80}$/.test(name || "")) { toast("A name: lower case letters, digits, _ and -", true); return; }
  if (asNew && S.list.some(r => r.name === name && r.raw) && !confirm(`${name} is a recipe already: write over it?`)) return;
  const spec = clone(S.spec);
  spec.label = $("#ed-label").value;
  const base = asNew ? (S.base || (S.raw ? S.name : null)) : null;
  try {
    const r = await api("/api/save", { name, spec, base });
    toast(`${name} saved into presets.json` + (r.raw.from ? ` (from ${r.raw.from} and what differs)` : ""));
  } catch (e) { toast(e.message, true); return; }
  await loadList();
  S.spec = spec;
  S.orig = clone(spec);
  await open(name, true);
  S.orig = clone(S.spec);
  S.base = name;
  updateDirty();
}

async function del() {
  if (!S.raw || !confirm(`Take the recipe ${S.name} out of presets.json? (A copy of the file is kept in Saved/Props/_history.)`)) return;
  try { await api("/api/delete", { name: S.name }); } catch (e) { toast(e.message, true); return; }
  toast(`${S.name}: out of presets.json`);
  await loadList();
  S.name = null; S.spec = null; S.orig = null; S.meta = null; S.raw = null;
  $("#editor").classList.add("empty");
  renderGallery();
}

async function library() {
  try {
    const r = await api("/api/library", { names: [S.name] });
    toast(`in the library as ${r.as.join(", ")}: a story places it with "shape": "asset ${r.as[0]}"`);
  } catch (e) { toast(e.message, true); }
}

// ---- wiring --------------------------------------------------------------------------------------------------------------

async function boot() {
  const [c, sh, pics, smu] = await Promise.all([api("/api/choices"), api("/api/shelf"), api("/api/pictures"), api("/api/smudges")]);
  S.smudges = smu.smudges || [];
  S.choices = c;
  S.shelf = sh.sets || [];
  S.pics = pics.images || [];
  await loadList();
  $("#search").addEventListener("input", e => { S.q = e.target.value; renderGallery(); });
  $("#refresh").addEventListener("click", async () => { S.pics = (await api("/api/pictures")).images; S.shelf = (await api("/api/shelf")).sets || []; await loadList(); toast("read again"); });
  $("#make-unmade").addEventListener("click", async () => {
    const names = S.list.filter(r => !r.made && r.raw).map(r => r.name);
    if (!names.length) { toast("Every recipe is made."); return; }
    if (!confirm(`Make ${names.length}: ${names.slice(0, 8).join(", ")}${names.length > 8 ? "…" : ""}?`)) return;
    const r = await api("/api/make", { names });
    watch(r.job, r.names);
  });
  document.querySelectorAll("#tabs button").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  $("#ed-label").addEventListener("input", e => { S.spec.label = e.target.value; changed(); });
  $("#seed").addEventListener("change", e => { S.spec.seed = parseInt(e.target.value || "0", 10) || 0; changed(); });
  $("#roll").addEventListener("click", () => { const s = Math.floor(Math.random() * 10000); $("#seed").value = s; S.spec.seed = s; changed(); });
  $("#make").addEventListener("click", make);
  $("#save").addEventListener("click", () => save(false));
  $("#saveas").addEventListener("click", () => save(true));
  $("#delete").addEventListener("click", del);
  $("#library").addEventListener("click", library);
  $("#json-apply").addEventListener("click", () => {
    try {
      const v = JSON.parse($("#json").value);
      if (!v || typeof v !== "object" || !v.family) throw new Error("a recipe has its family");
      S.spec = v;
      changed();
      toast("the JSON is the recipe now");
    } catch (e) { $("#json-err").textContent = e.message; }
  });
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (S.spec) (S.raw ? save(false) : save(true)); }
  });
  window.addEventListener("beforeunload", e => { if (dirty()) { e.preventDefault(); e.returnValue = ""; } });
  const want = new URLSearchParams(location.search).get("open");
  if (want) await open(want);
  window.__pp.ready = true;
}

Object.assign(window.__pp, { open, make, save, placeDecal, switchTab, loadList, api });
boot().catch(e => toast("The page couldn't start: " + e.message, true));

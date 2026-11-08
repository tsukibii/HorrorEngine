// The prop generator's page (docs/PROPGEN.md §13). Every recipe a card with its picture; a card opens into a form of
// its settings, built from the recipe itself (colours as colour pickers, shares as sliders, words, and the lists the
// generator knows: designs, fonts, liquids, finishes, a family's kinds); its texture and pictures in the picture editor
// (picedit.js, §17: Figma's way, the cuts, pictures dragged onto the parts, a PBR set per material); the made prop in
// 3D. Make runs tools/propgen.py in the background (variations: one seed after another), Save writes the recipe as
// `from` its base and what differs. window.__pp is the page's state, for its check (tools/propgen/pagetest.mjs).
import { makeViewer } from "/page/view3d.js";
import { renderEditor } from "/page/picedit.js";
import { $, el, clone, same, api, toast } from "/page/util.js";

const SHARE = new Set(["amount", "fill", "opacity", "burn", "alpha", "soot", "patina", "rust", "puff", "scrape", "limescale", "crazing", "crackle",
  "grime", "dirt", "dust", "scratches", "edges", "stains", "fade", "age_amount", "taper", "squash", "spread", "buckle", "wrinkle", "twist_amt"]);
const LIQUID_FAMS = new Set(["ware", "cookware", "sink"]);
const ART_FAMS = new Set(["can", "bottle", "cup", "sheet", "box", "ware", "charm", "pills"]);
const S = {
  list: [], choices: null, shelf: [], pics: [], fam: "", q: "", name: null, rec: null, raw: null, spec: null, orig: null, base: null,
  meta: null, tab: "settings", pic: null, busy: new Set(), viewer: null, job: null, smudges: [], ed: null,
  kept: null, onlyCustom: false, bare: new Set(), grp: "",
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
  const counts = {}, custom = r => r.custom;
  for (const r of S.list) counts[r.family] = (counts[r.family] || 0) + 1;
  const box = $("#fams");
  box.innerHTML = "";
  const nc = S.list.filter(custom).length;
  box.append(el("button", { class: "custom" + (S.onlyCustom ? " on" : ""), title: "only the props your own pictures go on: cans, bottles, cups, boxes, paper, books, pill bottles, appliances, charms, ware (docs/PROPGEN.md §25)",
    onclick: () => { S.onlyCustom = !S.onlyCustom; renderFams(); renderGallery(); } }, `✎ customizable ${nc}`));
  // a family that's a tab of its own (its module's TAB: the retro pack, PROPGEN §29) right after "all", the rest after it
  const tabs = (S.choices.tabs || []).filter(f => counts[f]);
  const fams = [...tabs, ...Object.keys(S.choices.families).filter(f => !tabs.includes(f))]
    .filter(f => counts[f] && (!S.onlyCustom || S.list.some(r => r.family === f && r.custom)));
  for (const f of ["", ...fams]) {
    box.append(el("button", { class: (S.fam === f ? "on" : "") + (tabs.includes(f) ? " tab" : ""), "data-fam": f,
      title: tabs.includes(f) ? `${f}: a tab of its own, its recipes by group (docs/PROPGEN.md §29)` : "",
      onclick: () => { S.fam = f; S.grp = ""; renderFams(); renderGallery(); } },
      f ? `${f} ${counts[f]}` : `all ${S.list.length}`));
  }
}

// a recipe's group (the retro pack's camp, gas station, road...): its sub-heading under its family, and a chip to show it alone
const groupOf = r => (r.spec && r.spec.group) || "";

function card(r) {
  const badges = [];
  if (S.busy.has(r.name)) badges.push(el("span", { class: "badge busy" }, "making…"));
  else if (r.unsaved) badges.push(el("span", { class: "badge unsaved" }, "made, not a recipe"));
  else if (r.edited) badges.push(el("span", { class: "badge edited" }, "made with changes"));
  else if (r.stale) badges.push(el("span", { class: "badge edited", title: "its kept picture is of an older recipe: Make it to see this one" }, "older picture"));
  let pic;
  const extra = [];
  if (r.thumb) {
    const v = r.variants && r.variants.bare;
    pic = el("img", { src: v && S.bare.has(r.name) ? v.thumb : r.thumb, loading: "lazy", alt: r.name });
    if (v) extra.push(el("button", { class: "chip var" + (S.bare.has(r.name) ? "" : " on"), title: `its picture with or ${v.label}: switch it off in the recipe's cushion box to make it so`,
      onclick: e => { e.stopPropagation(); S.bare.has(r.name) ? S.bare.delete(r.name) : S.bare.add(r.name); renderGallery(); } }, S.bare.has(r.name) ? "no cushions" : "cushions"));
  } else pic = el("div", { class: "ph" }, "not made yet");
  if (r.custom) extra.push(el("span", { class: "custom", title: "customizable: open it and its Texture & pictures tab to lay your own pictures on it, seen on its own picture before it's made" }, "✎"));
  if (r.thumb_from === "saved" && !S.busy.has(r.name)) extra.push(el("span", { class: "kept", title: "the picture kept in the project (Content/Studio/Props/thumbs): not made on this machine yet" }, "kept"));
  return el("div", { class: "card" + (r.name === S.name ? " sel" : ""), "data-name": r.name, title: r.label || r.name, onclick: () => open(r.name) },
    pic, ...badges, ...extra, el("div", { class: "nm" }, r.name), el("div", { class: "lb" }, r.label || ""));
}

function renderGallery() {
  const q = S.q.trim().toLowerCase();
  const inFam = S.list.filter(r => (!S.fam || r.family === S.fam) && (!S.onlyCustom || r.custom) &&
    (!q || [r.name, r.family, r.label, groupOf(r)].join(" ").toLowerCase().includes(q)));
  const shown = inFam.filter(r => !S.grp || groupOf(r) === S.grp);
  const box = $("#gallery");
  box.innerHTML = "";
  // a tab's groups as chips over its cards
  const gcount = {};
  for (const r of inFam) if (S.fam && groupOf(r)) gcount[groupOf(r)] = (gcount[groupOf(r)] || 0) + 1;
  if (Object.keys(gcount).length > 1) {
    box.append(el("div", { class: "groups" }, ["", ...Object.keys(gcount)].map(g => el("button", { class: S.grp === g ? "on" : "", "data-grp": g,
      onclick: () => { S.grp = g; renderGallery(); } }, g ? `${g} ${gcount[g]}` : `all ${inFam.length}`))));
  }
  const tabs = S.choices.tabs || [];
  const order = [...tabs, ...Object.keys(S.choices.families).filter(f => !tabs.includes(f))];
  const fams = {};
  for (const r of shown) (fams[r.family] = fams[r.family] || []).push(r);
  for (const f of [...order, ...Object.keys(fams).filter(f => !order.includes(f))]) {
    if (!fams[f]) continue;
    box.append(el("h3", {}, f));
    const byGroup = {};
    for (const r of fams[f]) (byGroup[groupOf(r)] = byGroup[groupOf(r)] || []).push(r);
    const names = Object.keys(byGroup);
    if (names.length === 1 && !names[0]) box.append(el("div", { class: "cards" }, fams[f].map(card)));
    else for (const g of names) box.append(el("h4", {}, g || "other"), el("div", { class: "cards" }, byGroup[g].map(card)));
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
  S.kept = d.kept || null;                               // a customizable prop not made here: what the project keeps of it
  S.rec = S.list.find(r => r.name === name) || null;
  if (!keepSpec) {
    S.orig = clone(d.spec);
    S.spec = clone(d.spec);
    S.base = d.raw ? name : null;
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
  else bits.push(S.kept ? "not made here (its picture kept in the project)" : "not made yet");
  if (r && r.custom) bits.push("✎ customizable: Texture & pictures, seen on its own picture before it's made");
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
  const F = C.families[fam], dotted = path.filter(p => typeof p !== "number").join(".");
  if (F && F.options[dotted]) return F.options[dotted];                     // a family's own choices, nested ones by their dotted key
  if (path.length === 1 && F && F.options[k]) return F.options[k];
  return null;
}
// a list's entries named (a family's LABELS: a table's size as length, width and height)
function labelsFor(path) {
  const F = S.choices.families[S.spec.family];
  return (F && F.labels && F.labels[path.filter(p => typeof p !== "number").join(".")]) || null;
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

// a family's setting that can be switched off with its settings kept: its FIELDS entry a box with an "on" (a chair's
// cushions: the switch in the box's title; off greys the rest; a recipe's false or true becomes the box when switched)
function switchOf(path, v) {
  if (path.length !== 1) return null;
  const F = S.choices.families[S.spec.family], own = F && F.fields && F.fields[path[0]];
  if (!own || typeof own !== "object" || Array.isArray(own) || !("on" in own)) return null;
  if (typeof v === "boolean" || v === null) return own;
  return v && typeof v === "object" && !Array.isArray(v) ? own : null;
}

function fieldRow(path, v, parent) {
  const k = path[path.length - 1];
  const name = typeof k === "number" ? `${path[path.length - 2]} ${k + 1}` : k;
  const own = switchOf(path, v);
  if (own) {
    const box = v && typeof v === "object", on = box ? v.on !== false : !!v;
    const sw = el("input", { type: "checkbox", class: "sw", checked: on, title: `${name} on or off (off keeps its settings for when it's back on)`,
      onchange: e => box ? setAt([...path, "on"], e.target.checked, true) : setAt(path, e.target.checked ? { ...clone(own), on: true } : false, true) });
    const fs = el("fieldset", { class: "switch" + (on ? "" : " off") }, el("legend", {}, sw, name, removable(path) ? xbtn(path) : null));
    if (box) {
      for (const [kk, vv] of Object.entries(v)) if (kk !== "on") fieldRow([...path, kk], vv, fs);
      fs.append(el("div", { class: "adds" }, el("button", { onclick: () => addKey(path) }, "+ a setting here")));
    } else if (!on) fs.append(el("div", { class: "hint" }, `none: switch it on for ${name} with the family's settings`));
    parent.append(fs);
    return;
  }
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
  const labs = Array.isArray(v) ? labelsFor(path) : null;
  if (Array.isArray(v)) row.append(el("div", { class: "list" }, v.map((x, i) => labs && labs[i]
    ? el("span", { class: "lab", title: labs[i] }, el("small", {}, labs[i]), plainInput([...path, i], x))
    : plainInput([...path, i], x))));
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
  const own = (F && F.fields) || {}, missing = Object.keys(own).filter(k => !(k in S.spec));
  if (missing.length) {                                // the family's own settings not in the recipe yet, each with its example
    const pick = el("select", { class: "addfield", title: "a setting this family takes, added with an example value",
      onchange: e => { const k = e.target.value; if (k) setAt([k], clone(own[k]), true); } },
      el("option", { value: "" }, "+ a setting of this family…"), missing.map(k => el("option", { value: k }, k)));
    adds.append(pick);
  }
  adds.append(el("button", { onclick: () => addKey([]) }, missing.length ? "+ another setting…" : "+ a setting…"),
    el("button", { onclick: () => switchTab("texture") }, "Pictures, logos and PBR sets →"));
  box.append(adds);
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
  document.body.classList.toggle("wide", S.tab === "texture" && !!S.spec);
  if (!S.spec) return;
  if (S.tab === "settings") renderSettings();
  else if (S.tab === "texture") renderEditor({ S, changed });
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
      S.kept = d.kept || null;
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
  S.name = null; S.spec = null; S.orig = null; S.meta = null; S.kept = null; S.raw = null;
  $("#editor").classList.add("empty");
  document.body.classList.remove("wide");
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

Object.assign(window.__pp, { open, make, save, switchTab, loadList, api });
boot().catch(e => toast("The page couldn't start: " + e.message, true));

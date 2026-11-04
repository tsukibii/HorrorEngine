// The prop generator's page (docs/PROPGEN.md §13). Every recipe a card with its picture; a card opens into a form of
// its settings, built from the recipe itself (colours as colour pickers, shares as sliders, words, and the lists the
// generator knows: designs, fonts, liquids, finishes, a family's kinds); its texture and pictures in the picture editor
// (picedit.js, §17: Figma's way, the cuts, pictures dragged onto the parts, a PBR set per material); the made prop in
// 3D. Make runs tools/propgen.py in the background (variations: one seed after another), Save writes the recipe as
// `from` its base and what differs. window.__pp is the page's state, for its check (tools/propgen/pagetest.mjs).
import { makeViewer } from "/page/view3d.js";
import { renderEditor } from "/page/picedit.js";
import { $, el, clone, same, api, toast } from "/page/util.js";
import { loadImage, loadPasses, spotsOf, makePic, lay, toRecipe } from "/page/sticker.js";

const SHARE = new Set(["amount", "fill", "opacity", "burn", "alpha", "soot", "patina", "rust", "puff", "scrape", "limescale", "crazing", "crackle",
  "grime", "dirt", "dust", "scratches", "edges", "stains", "fade", "age_amount", "taper", "squash", "spread", "buckle", "wrinkle", "twist_amt"]);
const LIQUID_FAMS = new Set(["ware", "cookware", "sink"]);
const ART_FAMS = new Set(["can", "bottle", "cup", "sheet", "box", "ware", "charm", "pills"]);
const S = {
  list: [], choices: null, shelf: [], pics: [], fam: "", q: "", name: null, rec: null, raw: null, spec: null, orig: null, base: null,
  meta: null, tab: "settings", pic: null, busy: new Set(), viewer: null, job: null, smudges: [], ed: null,
  sticker: null, passes: new Map(), spotPick: {}, place: {}, bare: new Set(),
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
  else if (r.stale) badges.push(el("span", { class: "badge edited", title: "its kept picture is of an older recipe: Make it to see this one" }, "older picture"));
  let pic;
  const extra = [];
  if (S.sticker && r.stickers) {                       // your picture laid on it (docs/PROPGEN.md §25)
    pic = el("canvas", { class: "stk", width: 400, height: 300 });
    stickerLater(r, pic);
    extra.push(el("button", { class: "chip spot", title: "where your picture goes: click for the next place (open the prop to place it by hand)",
      onclick: e => { e.stopPropagation(); S.spotPick[r.name] = (S.spotPick[r.name] || 0) + 1; delete S.place[r.name]; stickerLater(r, pic, true); } }, "…"));
  } else if (r.thumb) {
    const v = r.variants && r.variants.bare;
    pic = el("img", { src: v && S.bare.has(r.name) ? v.thumb : r.thumb, loading: "lazy", alt: r.name });
    if (v) extra.push(el("button", { class: "chip var" + (S.bare.has(r.name) ? "" : " on"), title: `its picture with or ${v.label}: switch it off in the recipe's cushion box to make it so`,
      onclick: e => { e.stopPropagation(); S.bare.has(r.name) ? S.bare.delete(r.name) : S.bare.add(r.name); renderGallery(); } }, S.bare.has(r.name) ? "no cushions" : "cushions"));
  } else pic = el("div", { class: "ph" }, "not made yet");
  if (r.thumb_from === "saved" && !S.busy.has(r.name)) extra.push(el("span", { class: "kept", title: "the picture kept in the project (Content/Studio/Props/thumbs): not made on this machine yet" }, "kept"));
  return el("div", { class: "card" + (r.name === S.name ? " sel" : ""), "data-name": r.name, title: r.label || r.name, onclick: () => open(r.name) },
    pic, ...badges, ...extra, el("div", { class: "nm" }, r.name), el("div", { class: "lb" }, r.label || ""));
}

// ---- your picture tried on the props (docs/PROPGEN.md §25) ----------------------------------------------------------------
// Every card with sticker passes (made here, or the picture kept in the project) shows your picture laid on it: in its
// own logo or picture slot (what it drew there taken away first), else on the part most seen as a sticker. A card's
// corner button moves it to the next place; an opened prop places it by hand and puts it into the recipe.

function passesOf(r) {
  const key = r.name + "|" + (r.thumb || "");
  if (!S.passes.has(key)) {
    S.passes.set(key, api(`/api/stickers/${encodeURIComponent(r.name)}`).then(info => loadPasses(info).then(P => {
      P.info = info; P.spots = spotsOf(P); return P;
    })));
  }
  return S.passes.get(key);
}

function defaultPlace(spot) {
  return spot.kind === "slot" ? { spot, scale: 1, dx: 0, dy: 0, flip: false, replace: true }
    : { spot, x: spot.x, y: spot.y, w: spot.w, rot: 0, flip: false };
}

function placementFor(name, P) {
  if (!P.spots.length) return null;
  const own = S.place[name];
  if (own && P.spots.some(s => s.key === own.spot.key)) return own;
  const n = P.spots.length, k = (((S.spotPick[name] || 0) % n) + n) % n;
  return defaultPlace(P.spots[k]);
}

function spotName(spot) { return spot.kind === "slot" ? spot.id.split(".").pop() : spot.island; }

const stkQueue = [];
let stkBusy = false;
const stkSeen = new IntersectionObserver(es => {
  for (const e of es) if (e.isIntersecting) { stkSeen.unobserve(e.target); stkQueue.push(e.target.__stk); runStickers(); }
}, { rootMargin: "300px" });
function stickerLater(r, cv, now = false) {
  cv.__stk = [r, cv];
  if (now) { stkQueue.unshift(cv.__stk); runStickers(); } else stkSeen.observe(cv);
}
async function runStickers() {
  if (stkBusy) return;
  stkBusy = true;
  while (stkQueue.length) {
    const [r, cv] = stkQueue.shift();
    if (!cv.isConnected || !S.sticker) continue;
    try { await paintSticker(r, cv); } catch (e) { cv.title = "couldn't lay it: " + e.message; }
    await new Promise(res => setTimeout(res, 0));
  }
  stkBusy = false;
}
async function paintSticker(r, cv) {
  const P = await passesOf(r), pl = placementFor(r.name, P);
  cv.width = P.W; cv.height = P.H;
  cv.getContext("2d").putImageData(pl ? lay(P, { ...pl, finish: S.sticker.finish }, S.sticker.pic) : new ImageData(new Uint8ClampedArray(P.base), P.W, P.H), 0, 0);
  cv.dataset.spot = pl ? pl.spot.key : "";
  const chip = cv.parentNode && cv.parentNode.querySelector(".spot");
  if (chip) { chip.textContent = pl ? "⟳ " + spotName(pl.spot) : "nowhere"; chip.title = pl ? `${pl.spot.label}: click for the next place` : "nowhere on its picture to lay it"; }
}
function repaintCard(name) {
  const cv = document.querySelector(`.card[data-name="${CSS.escape(name)}"] canvas.stk`);
  const r = S.list.find(x => x.name === name);
  if (cv && r) stickerLater(r, cv, true);
}

async function setSticker(src) {
  try {
    const url = src instanceof File ? URL.createObjectURL(src) : src.url;
    const img = await loadImage(url);
    S.sticker = { name: src.name, url, path: src instanceof File ? null : src.path, file: src instanceof File ? src : null,
      pic: makePic(img), finish: (S.sticker && S.sticker.finish) || "satin" };
  } catch (e) { toast("That picture couldn't be read: " + e.message, true); return; }
  S.place = {};
  renderTry(); renderGallery(); renderSticker();
}
function stickerOff() { S.sticker = null; S.place = {}; renderTry(); renderGallery(); renderSticker(); }

function renderTry() {
  const box = $("#try");
  box.innerHTML = "";
  const file = el("input", { type: "file", accept: "image/*", hidden: true, onchange: e => e.target.files[0] && setSticker(e.target.files[0]) });
  const pick = el("select", { title: "one of your pictures (Content/Studio/Props/images)", onchange: e => {
    const p = S.pics.find(x => x.path === e.target.value);
    if (e.target.value === "__file") file.click(); else if (p) setSticker(p);
    e.target.value = ""; } },
  el("option", { value: "" }, S.sticker ? "another picture…" : "Try a picture on them…"), el("option", { value: "__file" }, "from a file…"),
  S.pics.map(p => el("option", { value: p.path }, p.name)));
  box.append(file, pick);
  if (!S.sticker) return;
  box.append(el("img", { class: "try-mini", src: S.sticker.url, alt: "", title: S.sticker.name }),
    el("select", { title: "the picture's finish: a matt paper sticker, satin, or a glossy vinyl one", onchange: e => {
      S.sticker.finish = e.target.value; renderGallery(); renderSticker(); } },
    ["matte", "satin", "gloss"].map(f => el("option", { value: f, selected: S.sticker.finish === f }, f))),
    el("button", { class: "x", title: "take your picture off them", onclick: stickerOff }, "×"));
}

async function renderSticker() {
  const box = $("#ed-sticker");
  box.innerHTML = "";
  box.hidden = !(S.sticker && S.rec && S.rec.stickers && S.spec);
  if (box.hidden) return;
  let P;
  try { P = await passesOf(S.rec); } catch (e) { box.append(el("div", { class: "hint" }, "Its sticker passes couldn't be read: " + e.message)); return; }
  if (!P.spots.length) { box.append(el("div", { class: "hint" }, "Nowhere on its picture to lay it: none of its parts is seen enough.")); return; }
  const name = S.name, pl = S.place[name] = S.place[name] || clone1(placementFor(name, P));
  const cv = el("canvas", { class: "stk-big", width: P.W, height: P.H });
  const draw = () => { cv.getContext("2d").putImageData(lay(P, { ...pl, finish: S.sticker.finish }, S.sticker.pic), 0, 0); repaintCard(name); };
  const s = P.islands[pl.spot.isl], ctl = el("div", { class: "ctl" });
  const row = (label, input, title) => ctl.append(el("label", { title: title || "" }, label), input);
  const num = (k, min, max, step, title) => {
    const out = el("span", { class: "val" }, fmt(pl[k]));
    const inp = el("input", { type: "range", min, max, step, value: pl[k] ?? 0, oninput: e => { pl[k] = +e.target.value; out.textContent = fmt(pl[k]); draw(); } });
    row(k, el("span", { class: "rng" }, inp, out), title);
  };
  const sel = (k, opts, title) => row(k, el("select", { onchange: e => { pl[k] = e.target.value || undefined; draw(); } },
    opts.map(o => el("option", { value: o, selected: (pl[k] || "") === o }, o || "(its own)"))), title);
  const chk = (k, title) => row(k, el("input", { type: "checkbox", checked: !!pl[k], onchange: e => { pl[k] = e.target.checked; draw(); } }), title);
  row("where", el("select", { onchange: e => { const sp = P.spots.find(x => x.key === e.target.value); S.place[name] = defaultPlace(sp); renderSticker(); } },
    P.spots.map(sp => el("option", { value: sp.key, selected: sp.key === pl.spot.key }, sp.label))), "its own picture slots first, then its parts as a sticker anywhere on them");
  if (pl.spot.kind === "slot") {
    const [, , bw, bh] = pl.spot.box;
    sel("fit", ["", "contain", "cover", "stretch", "tile"], "contain: its own shape inside the slot; cover: filling it; stretch; tile: repeated");
    num("scale", 0.1, 3, 0.05);
    num("dx", -bw, bw, 0.5, "mm across");
    num("dy", -bh, bh, 0.5, "mm up");
    row("rot", el("select", { onchange: e => { pl.rot = +e.target.value; draw(); } },
      [0, 90, 180, 270].map(a => el("option", { value: a, selected: +(pl.rot ?? pl.spot.rot ?? 0) === a }, a + "°"))), "quarter turns, anticlockwise");
    chk("flip");
    if (P.ground) chk("replace", "take away what the prop drew there, as Make does when your picture goes in its slot");
  } else {
    const [W, H] = s.mm;
    num("x", 0, W, 0.5, "its middle, mm across the part");
    num("y", 0, H, 0.5, "its middle, mm up the part");
    num("w", 2, Math.max(W, H), 0.5, "its width, mm");
    num("rot", -180, 180, 1, "degrees anticlockwise");
    sel("fit", ["", "contain", "cover", "stretch", "width", "height"], "over the whole part instead of by its size");
    chk("flip");
  }
  box.append(el("div", { class: "stk-head" }, el("b", {}, "Your picture on it"), el("span", { class: "dim" }, ` ${S.sticker.name} · ${P.info.from === "made" ? "on the made prop" : "on its kept picture"}`)),
    el("div", { class: "stk-row" }, cv, ctl),
    el("div", { class: "adds" }, el("button", { class: "primary", onclick: () => stickToRecipe(pl), title: "write it into the recipe (pictures or decals): Make makes it so" }, "Put it in the recipe"),
      el("button", { onclick: () => { delete S.place[name]; renderSticker(); } }, "Reset")));
  draw();
}
const clone1 = pl => Object.assign({}, pl);
const fmt = v => (v === undefined || v === null ? "" : Math.abs(v) >= 10 ? String(Math.round(v)) : String(Math.round(v * 100) / 100));

async function pictureData(file) {
  if (/^image\/(png|jpeg)$/.test(file.type)) return new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(file); });
  const img = await loadImage(URL.createObjectURL(file)), cv = el("canvas", { width: img.naturalWidth, height: img.naturalHeight });
  cv.getContext("2d").drawImage(img, 0, 0);
  return cv.toDataURL("image/png");
}

async function stickToRecipe(pl) {
  let path = S.sticker.path;
  try {
    if (!path) {
      const up = await api("/api/upload", { name: S.sticker.file.name, data: await pictureData(S.sticker.file) });
      path = S.sticker.path = up.path;
      S.pics = (await api("/api/pictures")).images || S.pics;
      renderTry();
    }
  } catch (e) { toast("Couldn't keep the picture: " + e.message, true); return; }
  const add = toRecipe({ ...pl, finish: S.sticker.finish }, path);
  if (add.pictures) S.spec.pictures = Object.assign({}, S.spec.pictures || {}, add.pictures);
  else S.spec.decals = [...(S.spec.decals || []), ...add.decals];
  changed();
  renderTab();
  toast(add.pictures ? `in its ${Object.keys(add.pictures)[0]} slot (pictures): Make to see it made, Save to keep it` :
    `a sticker on ${add.decals[0].island} (decals): Make to see it made, Save to keep it`);
}

function renderGallery() {
  stkSeen.disconnect();                                 // the cards are drawn anew: their pictures laid again as they come into view
  stkQueue.length = 0;
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
  }
  $("#editor").classList.remove("empty");
  $("#as").value = name;
  $("#seed").value = S.spec.seed ?? 0;
  renderHead();
  renderTab();
  renderGallery();
  renderSticker();
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
  renderTry();
  const gal = $("#gallery");
  gal.addEventListener("dragover", e => { if ([...e.dataTransfer.items].some(i => i.kind === "file")) { e.preventDefault(); gal.classList.add("drop"); } });
  gal.addEventListener("dragleave", () => gal.classList.remove("drop"));
  gal.addEventListener("drop", e => {
    gal.classList.remove("drop");
    const f = [...e.dataTransfer.files].find(x => x.type.startsWith("image/"));
    if (f) { e.preventDefault(); setSticker(f); }
  });
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

Object.assign(window.__pp, { open, make, save, switchTab, loadList, api, setSticker, stickerOff, passesOf, renderSticker });
boot().catch(e => toast("The page couldn't start: " + e.message, true));

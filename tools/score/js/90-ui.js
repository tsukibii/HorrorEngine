// The score room's page: the cue library, a cue's settings, the variations to pick from, the favourites (the
// palette the desk will read) and the sequence strip. Everything kept is a cue id, its settings and a seed: the
// notes are written again from them (writeCue), so a palette is a few kilobytes and plays anywhere.
"use strict";

const $ = id => document.getElementById(id);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k === "value") el.value = v;
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

const INST_COLOR = { piano: "#e6e3dc", strings: "#d9a441", trem: "#e07a3f", pizz: "#9fd36b", harp: "#6fb3d9", glock: "#b7a6ff", xylo: "#ff9fd0",
  marimba: "#e0b080", bells: "#9ee6e0", flute: "#7fe0a0", flute_stac: "#5cc080", horn: "#d0704f", timpani: "#a07850", guitar: "#c9a06b", steel: "#a9c0d0", drums: "#8a8a92" };
const SPACE_IDS = ["room", "corridor", "basement", "closet", "hut", "hall", "cave", "forest", "meadow", "dungeon"];
const TONICS = range(0, 12).map(pcName);
const LS = { get(k, d) { try { const v = localStorage.getItem("score." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("score." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } } };

const UI = {
  cue: null, params: {}, seed: 1, vars: [], base: null,
  scope: "studio", palette: null, seq: [], dirty: false, saveTimer: 0,
  playing: null,                                     // {take, canvas, el}
};

const newId = p => p + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
const today = () => new Date().toISOString().slice(0, 10);
const fmtParam = (sp, v) => sp.kind === "key" ? keyName(v) : sp.kind === "num" ? (Math.round(v * 100) / 100).toString() : String(v);
const status = (text, cls) => { const s = $("status"); s.textContent = text; s.className = cls || ""; };
const emptyPalette = scope => ({ format: "horrorstudio-score-palette", version: 1, scope, favourites: [], sequences: [] });

// ---- the piano roll ----
function drawRoll(cv, take, pos = -1) {
  const g = cv.getContext("2d"), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const notes = take.ev.filter(e => e.inst !== "drums"), drums = take.ev.filter(e => e.inst === "drums");
  let lo = 127, hi = 0;
  for (const e of notes) { lo = Math.min(lo, e.midi); hi = Math.max(hi, e.midi); }
  if (lo > hi) { lo = 48; hi = 72; }
  lo -= 2; hi += 2;
  const drumH = drums.length ? 10 : 0, top = 3, bot = H - drumH - 3;
  const X = t => t / Math.max(0.5, take.secs) * W, Y = m => bot - (m - lo) / Math.max(1, hi - lo) * (bot - top);
  // bar lines when it has a beat
  if (take.tempo) {
    const bar = 60 / take.tempo * ((take.meter && take.meter[0]) || 4);
    g.strokeStyle = "#1d1d22"; g.lineWidth = 1;
    if (take.secs / bar < 80) for (let t = 0; t < take.secs; t += bar) { g.beginPath(); g.moveTo(X(t) + 0.5, 0); g.lineTo(X(t) + 0.5, H); g.stroke(); }
  }
  for (const m of take.marks) if (!m.text.startsWith("hit:")) { g.strokeStyle = "#3a3550"; g.beginPath(); g.moveTo(X(m.t) + 0.5, 0); g.lineTo(X(m.t) + 0.5, H); g.stroke(); }
  const nh = Math.max(2, Math.min(5, (bot - top) / Math.max(1, hi - lo)));
  for (const e of notes) {
    g.globalAlpha = 0.35 + 0.65 * (e.vel / 127);
    g.fillStyle = INST_COLOR[e.inst] || "#ccc";
    const w = Math.max(1.5, X(e.dur != null ? e.dur : 1.2));
    g.fillRect(X(e.t), Y(e.midi) - nh / 2, w, nh);
  }
  g.fillStyle = INST_COLOR.drums;
  for (const e of drums) { g.globalAlpha = 0.4 + 0.6 * (e.vel / 127); g.fillRect(X(e.t), H - drumH, 2, drumH - 2); }
  g.globalAlpha = 1;
  g.fillStyle = "#ff5b4f";
  for (const p of take.hits) { g.fillRect(X(p.t) - 1, 0, 2, H); }
  if (pos >= 0) { g.fillStyle = "#ffffff"; g.fillRect(X(pos), 0, 1.5, H); }
}
function rollCanvas(take, w = 600, hgt = 180) {
  const cv = h("canvas", { width: w, height: hgt, title: "click to play from here" });
  drawRoll(cv, take);
  cv.addEventListener("click", ev => { const r = cv.getBoundingClientRect(); playTake(take, cv, cv.closest(".card,.fav"), (ev.clientX - r.left) / r.width * take.secs); });
  return cv;
}
function legendFor(take) {
  return h("div", { class: "legend" }, takeInstruments(take).map(k => [h("i", { style: "background:" + (INST_COLOR[k] || "#ccc") }), k]),
    take.hits.length ? [h("i", { style: "background:#ff5b4f" }), "hit " + take.hits.map(x => x.t.toFixed(2) + " s").join(", ")] : null);
}

// ---- playing ----
async function playTake(take, canvas, el, from = 0) {
  stopAll();
  try {
    status("loading " + takeInstruments(take).filter(k => !Engine.loaded(k)).join(", ") + "...");
    await Engine.play(take, from);
    status("playing " + (take.cue || "") + " (" + take.secs.toFixed(1) + " s)");
  } catch (e) { status("can't play: " + e.message, "bad"); console.error(e); return; }
  UI.playing = { take, canvas, el };
  if (el) el.classList.add("playing");
  requestAnimationFrame(tick);
}
function stopAll() {
  Engine.stop();
  const p = UI.playing;
  if (p) { if (p.el) p.el.classList.remove("playing"); if (p.canvas) drawRoll(p.canvas, p.take); }
  UI.playing = null;
}
function tick() {
  const p = UI.playing;
  if (!p) return;
  const pos = Engine.position();
  if (pos < 0) { stopAll(); status(UI.dirty ? "unsaved" : "ready"); return; }
  if (p.canvas) drawRoll(p.canvas, p.take, pos);
  requestAnimationFrame(tick);
}
Engine.onProgress = (key, done, total) => { $("loading").textContent = done < total ? "samples: " + key + " " + done + "/" + total : ""; };

// ---- the cue library ----
function renderLib() {
  const q = $("filter").value.trim().toLowerCase(), box = $("cuelist");
  box.innerHTML = "";
  const counts = {};
  for (const f of UI.palette.favourites) counts[f.cue] = (counts[f.cue] || 0) + 1;
  for (const [fam, name] of Object.entries(FAMILIES)) {
    const cues = Object.values(CUES).filter(c => c.family === fam && (!q || (c.label + " " + c.uses.join(" ") + " " + c.desc + " " + c.refs).toLowerCase().includes(q)));
    if (!cues.length) continue;
    box.append(h("h2", { class: "fam-" + fam }, name));
    for (const c of cues) box.append(h("div", { class: "cue" + (UI.cue === c ? " on" : ""), onclick: () => selectCue(c.id), title: c.desc },
      counts[c.id] ? h("span", { class: "n" }, "★" + counts[c.id]) : null, c.label, h("small", {}, c.uses.join(", "))));
  }
}

function selectCue(id, params, seed) {
  const c = CUES[id];
  if (!c) return;
  stopAll();
  UI.cue = c; UI.params = cueParams(c, params || {}); UI.seed = seed != null ? seed : (LS.get("seed." + id, 1));
  UI.vars = []; UI.base = null;
  LS.set("cue", id);
  $("cuehead").innerHTML = "";
  $("cuehead").append(h("h3", { class: "fam-" + c.family }, c.label), h("div", { class: "desc" }, c.desc),
    h("div", { class: "uses" }, "for: ", c.uses.map(u => h("span", { class: "tag" }, u))), h("div", { class: "refs" }, "after: " + c.refs));
  renderParams(); renderCards(); renderLib();
}

function renderParams() {
  const c = UI.cue, box = $("params");
  box.innerHTML = "";
  for (const [k, sp] of Object.entries(c.params || {})) {
    const v = UI.params[k];
    if (sp.kind === "num") {
      const out = h("span", { class: "v" }, fmtParam(sp, v));
      box.append(h("div", { class: "prm" }, h("label", {}, sp.label || k),
        h("input", { type: "range", min: sp.min, max: sp.max, step: sp.step, value: v, oninput: e => { UI.params[k] = +e.target.value; out.textContent = fmtParam(sp, +e.target.value); } }), out));
    } else if (sp.kind === "choice") {
      box.append(h("div", { class: "prm" }, h("label", {}, sp.label || k),
        h("select", { onchange: e => { UI.params[k] = e.target.value; } }, sp.opts.map(o => h("option", { value: o, selected: o === v }, o)))));
    } else if (sp.kind === "key") {
      const modes = uniq(sp.modes.concat(v.mode));
      box.append(h("div", { class: "prm key" }, h("label", {}, "key"),
        h("select", { onchange: e => { UI.params[k] = { ...UI.params[k], tonic: +e.target.value }; } }, TONICS.map((n, i) => h("option", { value: i, selected: i === v.tonic }, n))),
        h("select", { onchange: e => { UI.params[k] = { ...UI.params[k], mode: e.target.value }; } }, modes.map(m => h("option", { value: m, selected: m === v.mode }, m.replace(/_/g, " "))))));
    }
  }
  $("seed").value = UI.seed;
}

// ---- variations ----
function makeVariations() {
  const n = clamp(+$("count").value || 8, 2, 24), spread = +$("spread").value;
  UI.base = JSON.parse(JSON.stringify(UI.params));
  const seed0 = (UI.seed * 7919 + Date.now()) >>> 0;
  UI.vars = variations(UI.cue.id, UI.base, n, spread, seed0).map((v, i) => ({ ...v, n: i + 1, take: writeCue(UI.cue.id, v.params, v.seed) }));
  renderCards();
  status(n + " variations of " + UI.cue.label + " (spread " + spread + ")");
}
function diffText(base, p) {
  if (!base) return "";
  const c = UI.cue, out = [];
  for (const [k, sp] of Object.entries(c.params || {})) {
    const a = base[k], b = p[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    out.push((sp.label || k).replace(/ \(.*\)/, "") + " " + fmtParam(sp, b));
  }
  return out.length ? out.join(" · ") : "same settings, new notes";
}
function renderCards() {
  const box = $("cards");
  box.innerHTML = "";
  // the settings themselves first, as card 0
  const main = writeCue(UI.cue.id, UI.params, UI.seed);
  box.append(cardFor({ n: 0, params: UI.params, seed: UI.seed, take: main }, true));
  for (const v of UI.vars) box.append(cardFor(v));
}
function isKept(cueId, params, seed) { return UI.palette.favourites.some(f => f.cue === cueId && f.seed === seed && JSON.stringify(f.params) === JSON.stringify(params)); }
function cardFor(v, isMain) {
  const take = v.take, kept = isKept(UI.cue.id, v.params, v.seed);
  const cv = rollCanvas(take);
  const card = h("div", { class: "card" + (kept ? " kept" : "") },
    h("div", { class: "top" }, h("b", {}, isMain ? "the settings" : "#" + v.n), h("span", {}, take.secs.toFixed(1) + " s" + (take.key ? " · " + keyName(take.key) : "") + (take.tempo ? " · " + Math.round(take.tempo) + " bpm" : "")),
      h("span", { class: "dim" }, "seed " + v.seed)),
    h("div", { class: "diff" }, isMain ? "" : diffText(UI.base, v.params)),
    cv, legendFor(take),
    h("div", { class: "bar" },
      h("button", { onclick: () => playTake(take, cv, card) }, "▶"),
      h("button", { class: kept ? "on" : "", title: "keep in the palette", onclick: e => { keep(UI.cue.id, v.params, v.seed); card.classList.add("kept"); e.target.classList.add("on"); } }, "★ Keep"),
      isMain ? null : h("button", { title: "make these the settings, then vary them again", onclick: () => { UI.params = JSON.parse(JSON.stringify(v.params)); UI.seed = v.seed; renderParams(); makeVariations(); } }, "More like this"),
      isMain ? null : h("button", { title: "make these the settings", onclick: () => { UI.params = JSON.parse(JSON.stringify(v.params)); UI.seed = v.seed; renderParams(); renderCards(); } }, "Use"),
      h("button", { title: "MIDI file", onclick: () => downloadBytes(Engine.index ? Engine.midi(take) : MIDI.write({ notes: [], tempos: [] }), fileBase(UI.cue.id, v.seed) + ".mid") }, "MIDI"),
      h("button", { title: "render a WAV in this room", onclick: e => renderWavTo(take, fileBase(UI.cue.id, v.seed) + ".wav", e.target) }, "WAV")));
  card._take = take; card._v = v;
  return card;
}
const fileBase = (cueId, seed, name) => (name ? name.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") : cueId + "_" + seed).slice(0, 60);
async function renderWavTo(take, name, btn, upload) {
  const was = btn && btn.textContent;
  if (btn) { btn.disabled = true; btn.textContent = "rendering..."; }
  try {
    await Engine.init();
    const bytes = await Engine.renderWav(take, $("space").value);
    if (upload) {
      const r = await fetch("/api/render/" + encodeURIComponent(UI.scope) + "/" + encodeURIComponent(name), { method: "PUT", body: bytes });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.status);
      const mid = Engine.midi(take, name);
      await fetch("/api/render/" + encodeURIComponent(UI.scope) + "/" + encodeURIComponent(name.replace(/\.wav$/, ".mid")), { method: "PUT", body: mid });
      status("baked " + j.path);
    } else { downloadBytes(bytes, name, "audio/wav"); status("rendered " + name); }
  } catch (e) { status("render failed: " + e.message, "bad"); console.error(e); }
  if (btn) { btn.disabled = false; btn.textContent = was; }
}

// ---- the palette ----
function keep(cueId, params, seed, extra = {}) {
  if (isKept(cueId, params, seed)) { status("already kept"); return null; }
  const c = CUES[cueId], take = writeCue(cueId, params, seed);
  const same = UI.palette.favourites.filter(f => f.cue === cueId).length;
  const fav = Object.assign({ id: newId("f"), name: c.label + " " + (same + 1), cue: cueId, family: c.family, params: JSON.parse(JSON.stringify(params)), seed,
    secs: Math.round(take.secs * 100) / 100, hits: take.hits.map(x => ({ t: Math.round(x.t * 1000) / 1000, label: x.label })), print: takePrint(take),
    space: $("space").value, uses: c.uses.slice(0, 2), stars: 0, note: "", made: today() }, extra);
  UI.palette.favourites.unshift(fav);
  changed();
  status("kept " + fav.name);
  return fav;
}
function changed() { UI.dirty = true; status("unsaved", "dirty"); clearTimeout(UI.saveTimer); UI.saveTimer = setTimeout(savePalette, 600); renderPalette(); renderLib(); }
async function savePalette() {
  const pal = UI.palette;
  LS.set("palette." + UI.scope, pal);
  try {
    const r = await fetch("/api/palette/" + encodeURIComponent(UI.scope), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pal) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.status);
    UI.dirty = false; status("saved " + j.path);
  } catch (e) { status("kept in this browser only (" + e.message + "): Export to keep it", "dirty"); }
}
async function loadPalette(scope) {
  UI.scope = scope; LS.set("scope", scope);
  let pal = null;
  try { const r = await fetch("/api/palette/" + encodeURIComponent(scope)); if (r.ok) pal = await r.json(); } catch (e) { /* no server */ }
  if (!pal) pal = LS.get("palette." + scope, null);
  UI.palette = pal && pal.favourites ? pal : emptyPalette(scope);
  UI.palette.sequences = UI.palette.sequences || [];
  UI.seq = [];
  renderPalette(); renderLib(); renderSeq();
  if (UI.cue) renderCards();
}
function stars(f) {
  return h("span", { class: "stars", title: "how much you like it" }, [1, 2, 3].map(i => h("span", { class: f.stars >= i ? "on" : "", onclick: () => { f.stars = f.stars === i ? i - 1 : i; changed(); } }, "★")));
}
function renderPalette() {
  const box = $("favs"), q = $("favfilter").value.trim().toLowerCase(), sort = $("favsort").value;
  box.innerHTML = "";
  let favs = UI.palette.favourites.filter(f => !q || (f.name + " " + f.cue + " " + (f.uses || []).join(" ") + " " + f.note).toLowerCase().includes(q));
  if (sort === "stars") favs = favs.slice().sort((a, b) => (b.stars || 0) - (a.stars || 0));
  else if (sort === "cue") favs = favs.slice().sort((a, b) => a.cue.localeCompare(b.cue));
  $("favcount").textContent = UI.palette.favourites.length ? "(" + UI.palette.favourites.length + ")" : "";
  if (!favs.length) box.append(h("div", { class: "hint" }, UI.palette.favourites.length ? "nothing matches" : "Nothing kept yet: ★ a variation you like."));
  for (const f of favs) box.append(favCard(f));
}
function favCard(f) {
  const c = CUES[f.cue];
  if (!c) return h("div", { class: "fav" }, "unknown cue " + f.cue + " (", f.name, ")");
  const take = writeCue(f.cue, f.params, f.seed), drift = f.print && f.print !== takePrint(take);
  let cv = null;
  const el = h("div", { class: "fav" },
    h("div", { class: "top" }, h("input", { class: "name", value: f.name, onchange: e => { f.name = e.target.value; changed(); } }), stars(f)),
    h("div", { class: "meta" }, h("span", { class: "fam-" + c.family }, c.label), " · " + take.secs.toFixed(1) + " s · seed " + f.seed + (take.key ? " · " + keyName(take.key) : ""),
      drift ? h("b", { style: "color:var(--warn)", title: "the cue's generator changed since this was kept: its notes are different now" }, " · changed") : null),
    h("input", { class: "uses", placeholder: "for (comma separated): her room, the turn...", value: (f.uses || []).join(", "), onchange: e => { f.uses = e.target.value.split(",").map(s => s.trim()).filter(Boolean); changed(); } }),
    h("textarea", { placeholder: "note (where it goes, what to change)", value: f.note || "", onchange: e => { f.note = e.target.value; changed(); } }),
    h("div", { class: "row" },
      h("button", { onclick: () => { if (!cv) { cv = rollCanvas(take, 600, 120); el.insertBefore(cv, el.lastChild); } playTake(take, cv, el); } }, "▶"),
      h("button", { title: "open its settings", onclick: () => { selectCue(f.cue, f.params, f.seed); } }, "Open"),
      h("button", { title: "open it and make variations of it", onclick: () => { selectCue(f.cue, f.params, f.seed); makeVariations(); } }, "Vary"),
      h("button", { title: "add to the sequence", onclick: () => { UI.seq.push({ fav: f.id, gap: 0 }); renderSeq(); } }, "+ Seq"),
      h("button", { title: "MIDI", onclick: () => downloadBytes(Engine.midi(take, f.name), fileBase(f.cue, f.seed, f.name) + ".mid") }, "MIDI"),
      h("button", { title: "WAV in the room it was kept in", onclick: e => renderWavTo(take, fileBase(f.cue, f.seed, f.name) + ".wav", e.target) }, "WAV"),
      h("button", { title: "render WAV and MIDI into the palette's Music/renders/ folder (for Unreal)", onclick: e => renderWavTo(take, fileBase(f.cue, f.seed, f.name) + ".wav", e.target, true) }, "Bake"),
      h("button", { title: "remove from the palette", onclick: () => { if (confirm("Remove " + f.name + "?")) { UI.palette.favourites = UI.palette.favourites.filter(x => x !== f); changed(); } } }, "✕")));
  return el;
}

// ---- the sequence strip ----
function seqTake(items) {
  const parts = items.map(it => { const f = UI.palette.favourites.find(x => x.id === it.fav); return f && CUES[f.cue] ? { take: writeCue(f.cue, f.params, f.seed), gap: +it.gap || 0 } : null; }).filter(Boolean);
  return parts.length ? chainTakes(parts) : null;
}
function renderSeq() {
  const box = $("seq");
  box.innerHTML = "";
  if (!UI.seq.length) box.append(h("span", { class: "hint" }, "+ Seq on a favourite adds it here"));
  UI.seq.forEach((it, i) => {
    const f = UI.palette.favourites.find(x => x.id === it.fav);
    box.append(h("span", { class: "chip" }, i ? h("input", { type: "number", step: 0.25, value: it.gap, title: "gap before (s)", onchange: e => { it.gap = +e.target.value; renderSeq(); } }) : null,
      f ? f.name : "(gone)", h("button", { onclick: () => { UI.seq.splice(i, 1); renderSeq(); } }, "×")));
  });
  const take = seqTake(UI.seq), cv = $("seqroll");
  if (take) drawRoll(cv, take); else cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
  const sb = $("seqs");
  sb.innerHTML = "";
  for (const s of UI.palette.sequences) sb.append(h("div", { class: "fav" }, h("div", { class: "top" }, h("b", {}, s.name), h("span", { class: "hint" }, s.items.length + " cues")),
    h("div", { class: "row" }, h("button", { onclick: () => { UI.seq = JSON.parse(JSON.stringify(s.items)); $("seqname").value = s.name; renderSeq(); } }, "Load"),
      h("button", { onclick: () => { const t = seqTake(s.items); if (t) playTake(t, null, null); } }, "▶"),
      h("button", { onclick: e => { const t = seqTake(s.items); if (t) renderWavTo(t, fileBase("", 0, s.name) + ".wav", e.target, true); } }, "Bake"),
      h("button", { onclick: () => { UI.palette.sequences = UI.palette.sequences.filter(x => x !== s); changed(); renderSeq(); } }, "✕"))));
}

// ---- wiring ----
async function boot() {
  for (const id of SPACE_IDS) $("space").append(h("option", { value: id }, SPACES[id].name + " (" + SPACES[id].desc + ")"));
  $("space").value = LS.get("space", "room");
  $("space").onchange = () => { LS.set("space", $("space").value); Engine.setSpace($("space").value); };
  Engine.space = $("space").value;
  $("scope").append(h("option", { value: "studio" }, "Studio (every game)"));
  try { const r = await fetch("/api/games"); if (r.ok) for (const g of (await r.json()).games) $("scope").append(h("option", { value: g }, g)); } catch (e) { /* no server */ }
  const scope = LS.get("scope", "studio");
  $("scope").value = [...$("scope").options].some(o => o.value === scope) ? scope : "studio";
  $("scope").onchange = async () => { if (UI.dirty) await savePalette(); loadPalette($("scope").value); };
  await loadPalette($("scope").value);
  $("filter").oninput = renderLib;
  $("favfilter").oninput = renderPalette; $("favsort").onchange = renderPalette;
  $("spread").oninput = () => { $("spreadv").textContent = (+$("spread").value).toFixed(2); };
  $("spread").oninput();
  $("play").onclick = () => { const cv = $("cards").firstChild && $("cards").firstChild.querySelector("canvas"); playTake(writeCue(UI.cue.id, UI.params, UI.seed), cv, $("cards").firstChild); };
  $("stop").onclick = stopAll;
  $("seed").onchange = () => { UI.seed = Math.max(0, Math.floor(+$("seed").value || 0)); LS.set("seed." + UI.cue.id, UI.seed); renderCards(); };
  $("reseed").onclick = () => { UI.seed = Math.floor(Math.random() * 1e6); $("seed").value = UI.seed; LS.set("seed." + UI.cue.id, UI.seed); renderCards(); };
  $("keep").onclick = () => { keep(UI.cue.id, UI.params, UI.seed); renderCards(); };
  $("reset").onclick = () => { UI.params = cueParams(UI.cue, {}); renderParams(); renderCards(); };
  $("vary").onclick = makeVariations;
  // a slider or choice changed: card 0 (the settings) follows
  $("params").addEventListener("change", () => renderCards());
  $("exportPal").onclick = () => downloadBytes(new TextEncoder().encode(JSON.stringify(UI.palette, null, 1)), "palette-" + UI.scope + ".json", "application/json");
  $("importPal").onclick = () => $("importFile").click();
  $("importFile").onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const pal = JSON.parse(await file.text());
      if (pal.format !== "horrorstudio-score-palette") throw new Error("not a score palette");
      let added = 0;
      for (const f of pal.favourites || []) if (!UI.palette.favourites.some(x => x.id === f.id)) { UI.palette.favourites.push(f); added++; }
      for (const s of pal.sequences || []) if (!UI.palette.sequences.some(x => x.id === s.id)) UI.palette.sequences.push(s);
      changed(); status("imported " + added + " favourites");
    } catch (err) { status("import failed: " + err.message, "bad"); }
    e.target.value = "";
  };
  $("seqplay").onclick = () => { const t = seqTake(UI.seq); if (t) playTake(t, $("seqroll"), null); };
  $("seqkeep").onclick = () => { if (!UI.seq.length) return; UI.palette.sequences.unshift({ id: newId("s"), name: $("seqname").value || "sequence " + (UI.palette.sequences.length + 1), items: JSON.parse(JSON.stringify(UI.seq)), made: today() }); changed(); renderSeq(); };
  $("seqclear").onclick = () => { UI.seq = []; renderSeq(); };
  document.addEventListener("keydown", e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const d = e.code.match(/^Digit([1-9])$/);
    if (d) {
      const card = $("cards").children[+d[1]];
      if (!card) return;
      if (e.shiftKey) { keep(UI.cue.id, card._v.params, card._v.seed); card.classList.add("kept"); }
      else playTake(card._take, card.querySelector("canvas"), card);
      e.preventDefault();
    } else if (e.code === "Space") { $("play").click(); e.preventDefault(); }
    else if (e.code === "KeyS" || e.code === "Escape") stopAll();
    else if (e.code === "KeyV") makeVariations();
  });
  selectCue(CUES[LS.get("cue", "")] ? LS.get("cue", "") : "her_theme");
  status("ready");
  window.__scoreReady = true;
}
boot();

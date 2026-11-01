// The wardrobe (docs/WARDROBE_PLAN.md, the user 2026-11-02: "a clothing specific tab where we can create outfits on a
// dummy, have it run really well in real time and then load those outfits onto our actual model"): the default model's
// body (halfway between the bases, 1.70 m: what a new character and the outfit pictures wear) as a plain dummy, so only
// the clothes cost to draw; the tailor in its worker, which keeps every garment it made (tailor.js dressing), so a change
// re-makes only that garment and what's worn over it; the drape off until asked. Outfits start from the presets or My
// outfits and are saved to Content/Studio/Clothes/my_outfits.json (with a picture from this view) for the Studio.
import * as THREE from "three";
import * as SC from "./sculpt.js";
import * as LOOK from "./tailor/look.js";
import { SURFACES, PATTERNS } from "./tailor/fabric.js";
import { edited } from "./tailor.js";

const $ = s => document.querySelector(s);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const status = (t, cls = "") => { const s = $("#status"); s.textContent = t; s.className = cls; };
const api = (u, body) => fetch(u, body === undefined ? {} : { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }).then(r => r.ok ? r.json() : Promise.reject(new Error(`${u}: ${r.status}`)));

// ---- the dummy: the default model's body (thumbs.mjs defaultBody, node.mjs mhrBody) --------------------------------
const buf = await (await fetch("bodies/MHR_lod1.bin")).arrayBuffer();
const hl = new DataView(buf).getUint32(0, true), H = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
const N = H.points, BASEP = new Float32Array(buf.slice(H.points_at, H.points_at + N * 12)), TRIS = new Uint32Array(buf.slice(H.triangles_at, H.triangles_at + H.triangles * 12));
function f16(at, count) {
  const h = new Uint16Array(buf, at, count), out = new Float32Array(count);
  for (let i = 0; i < count; i++) { const x = h[i], s = x & 0x8000 ? -1 : 1, e = (x >> 10) & 31, f = x & 1023; out[i] = s * (e === 0 ? f * 5.960464477539063e-8 : e === 31 ? (f ? NaN : Infinity) : Math.pow(2, e - 15) * (1 + f / 1024)); }
  return out;
}
const SHAPES = f16(H.shapes_at, H.shapes * N * 3);
const BASES = await fetch("bodies/MHR_presets.json").then(r => r.ok ? r.json() : {}).catch(() => ({}));
function dummyBody(height = 1.7) {
  const [a, b] = H.groups?.body || [0, 0], f = BASES.presets?.feminine || [], m = BASES.presets?.masculine || [];
  const P = Float32Array.from(BASEP);
  for (let k = a; k < b; k++) { const w = ((f[k] || 0) + (m[k] || 0)) / 2; if (!w) continue; const o = k * N * 3; for (let i = 0; i < P.length; i++) P[i] += w * SHAPES[o + i]; }
  let lo = 1e9, hi = -1e9; for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); }
  const s = height / (hi - lo); for (let i = 0; i < P.length; i += 3) { P[i] *= s; P[i + 1] = (P[i + 1] - lo) * s; P[i + 2] *= s; }
  const sculpt = {}; for (const [k, v] of Object.entries(BASES.sculpt?.feminine || {})) sculpt[k] = v / 2;
  for (const c of SC.buildSculpt({ P: BASEP, T: TRIS, lm: () => [0, 1.6, 0.1] }).controls.filter(c => c.group === "Body")) {
    const v = (sculpt[c.id] || 0) * s; if (!v) continue;
    for (let q = 0; q < c.idx.length; q++) { const i = c.idx[q] * 3; P[i] += v * c.d[q * 3]; P[i + 1] += v * c.d[q * 3 + 1]; P[i + 2] += v * c.d[q * 3 + 2]; }
  }
  return P;
}
const BODY = dummyBody();

// ---- the view -----------------------------------------------------------------------------------------------------
const view = $("#view"), renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); view.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x202125);
const camera = new THREE.PerspectiveCamera(26, 1, 0.02, 100), key = new THREE.DirectionalLight(0xffffff, 1.6);
scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3530, 0.8), camera); camera.add(key); key.position.set(1, 1.4, 2);
{
  const env = new THREE.Scene(); env.add(new THREE.Mesh(new THREE.BoxGeometry(12, 8, 12), new THREE.MeshBasicMaterial({ color: 0x2c2d33, side: THREE.BackSide })));
  for (const [x, y, z, w, h, k] of [[-3, 2.5, 3, 3, 2, 5], [3.5, 1.5, 2, 2, 3, 2.5], [0, 3.9, 0, 5, 5, 1.2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k * 0.96), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 1.4, 0); env.add(m);
  }
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(env, 0.04).texture;
}
const g0 = new THREE.BufferGeometry(); g0.setAttribute("position", new THREE.BufferAttribute(BODY, 3)); g0.setIndex(new THREE.BufferAttribute(TRIS, 1)); g0.computeVertexNormals();
const dummy = new THREE.Mesh(g0, new THREE.MeshStandardMaterial({ color: 0xb8aea4, roughness: 0.75 })); scene.add(dummy);
const GARMENTS = new THREE.Group(); scene.add(GARMENTS);
const orbit = { yaw: 0.35, pitch: 0.05, dist: 4.4, target: new THREE.Vector3(0, 0.95, 0) };
function place() { const { yaw, pitch, dist, target } = orbit; camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist); camera.lookAt(target); }
function resize() { const r = view.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(view); resize();
let drag = null;
renderer.domElement.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, pan: e.button !== 0 || e.shiftKey }; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener("pointermove", e => {
  if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if (drag.pan) { const r = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); orbit.target.addScaledVector(r, -dx * orbit.dist * 0.0012); orbit.target.y += dy * orbit.dist * 0.0012; }
  else { orbit.yaw -= dx * 0.008; orbit.pitch = Math.max(-1.2, Math.min(1.2, orbit.pitch + dy * 0.006)); }
});
renderer.domElement.addEventListener("pointerup", () => { drag = null; });
renderer.domElement.addEventListener("wheel", e => { e.preventDefault(); orbit.dist = Math.max(0.5, Math.min(9, orbit.dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });
renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());
(function frame() { place(); renderer.render(scene, camera); requestAnimationFrame(frame); })();

// ---- the clothes --------------------------------------------------------------------------------------------------
const [D, O, P, M] = await Promise.all([api("api/clothes/designs.json"), api("api/clothes/outfits.json"), api("api/pbr").catch(() => ({})), api("api/clothes/my_outfits.json").catch(() => ({}))]);
const DESIGNS = D.designs || {}, SHELF = P.sets || {};
let MINE = { outfits: M.outfits || {}, meta: M.meta || {} };
const st = { clothes: [] }, SHAPE = new Map();
const pieceOf = c => edited(DESIGNS[c.design], c.edit).piece || {};
function pbrOf(c) {                                    // as the Studio's: a garment's PBR set off the shelf, its repeat, its tint
  const ref = c.pbr ?? DESIGNS[c.design]?.pbr, m = ref && SHELF[ref]; if (!m) return null;
  return { ref, base: "pbrfile/" + ref.replace(/^pbr\//, "").split("/").map(encodeURIComponent).join("/"), maps: m.maps, normal: m.normal, orm: m.orm, tile_m: c.pbrTile ?? (m.tile_m && m.tile_m !== 2 ? m.tile_m : 0.3), tint: !!(c.pbrTint ?? m.tint) };
}
const lookOf = c => { const d = DESIGNS[c.design] || {}; return { color: c.color, surface: c.surface ?? d.surface, trim: d.trimSurface, pattern: c.pattern ?? d.pattern, denier: c.denier ?? d.denier, prints: c.prints || [], parts: c.parts, pbr: pbrOf(c), crease: { ...(d.crease || {}), ...(c.crease || {}) } }; };
const KEEP = ["surface", "pattern", "prints", "parts", "pbr", "denier", "crease"];   // what an outfit's third field carries (outfits.json's look)
const entryOf = c => { const look = {}; for (const k of KEEP) if (c[k] !== undefined) look[k] = c[k]; return [c.design, c.color, ...(Object.keys(look).length || c.edit ? [look] : []), ...(c.edit ? [c.edit] : [])]; };

const W = new Worker("./tailor/worker.js", { type: "module" });
let JOB = 0, sent = 0, timer = 0, made = { ms: 0 };
function dress(now = false) {                           // the outfit to the tailor, a moment after the last change
  clearTimeout(timer);
  timer = setTimeout(() => {
    const list = st.clothes.filter(c => DESIGNS[c.design]).map(c => [c.design, c.color, lookOf(c), c.edit]), id = ++JOB;
    if (!list.length) { clearGarments(); return status("nothing worn"); }
    sent = performance.now(); status("making…");
    W.postMessage({ id, key: "wardrobe-dummy", P: BODY.slice(), T: TRIS, list, designs: DESIGNS, drape: $("#hang").checked, have: [...SHOWN.keys()] });
  }, now ? 0 : 180);
}
const SHOWN = new Map();                               // a garment's made key -> its meshes, kept while it's worn as it is (nothing sent or built again)
function clearGarments() { for (const m of GARMENTS.children) { m.geometry.dispose(); m.material.dispose(); } GARMENTS.clear(); SHOWN.clear(); }
W.onmessage = e => {
  const { id, garments, error, progress, stage } = e.data;
  if (id !== JOB) return;
  if (error) return status("the tailor failed: " + error.split("\n")[0], "bad");
  if (progress) return status(`hanging ${progress.name} (${progress.k + 1} of ${progress.of}) ${Math.round(progress.frac * 100)}%`);
  const recv = performance.now() - sent, keep = new Map();
  for (const g of garments) keep.set(g.made, g.parts ? g.parts.map(q => LOOK.mesh(q, g.name, g.look)) : SHOWN.get(g.made) || []);
  const reused = new Set(garments.filter(g => !g.parts).map(g => g.made));
  for (const [k, ms] of SHOWN) if (!reused.has(k)) for (const m of ms) { m.geometry.dispose(); m.material.dispose(); }   // (what's no longer worn as it was)
  GARMENTS.clear(); SHOWN.clear();
  for (const [k, ms] of keep) { SHOWN.set(k, ms); for (const m of ms) GARMENTS.add(m); }
  const fresh = !SHAPE.size || [...SHAPE.keys()].join() !== garments.map(g => g.name).join();
  SHAPE.clear(); for (const g of garments) SHAPE.set(g.name, g.handles || []);
  made = { ms: performance.now() - sent, tailor: recv, stage, sent: garments.filter(g => g.parts).length };
  status(`${garments.length} garment${garments.length === 1 ? "" : "s"} in ${(made.ms / 1000).toFixed(2)} s` + (stage === "cut" ? ", hanging…" : ""), "ok");
  if (fresh && !document.activeElement?.matches?.("input[type=range]")) drawWorn();
};
$("#hang").onchange = () => dress(true);

// ---- the list of what's worn --------------------------------------------------------------------------------------
const fmt = (v, step) => (+v).toFixed(Math.max(0, -Math.floor(Math.log10(step))));
function slider(box, label, lo, hi, step, val, onInput, help = "") {
  const inp = el("input", { type: "range", min: lo, max: hi, step, value: val }), out = el("output", { textContent: fmt(val, step) });
  inp.oninput = () => { out.textContent = fmt(inp.value, step); onInput(+inp.value); };
  box.append(el("div", { className: "row", title: help }, el("span", { textContent: label }), inp, out));
}
function setEdit(c, h, v) {                            // a handle's value into the garment's own edits, as the Studio keeps them
  c.edit = c.edit || {}; let o = c.edit;
  for (const k of h.path.slice(0, -1)) o = o[k] = (o[k] && typeof o[k] === "object") ? o[k] : {};
  o[h.path[h.path.length - 1]] = h.kind === "height" ? `${h.anchor}${v >= 0 ? "+" : "-"}${Math.abs(v).toFixed(3)}` : +v.toFixed(4);
}
function restyle(c) {                                  // a colour, fabric or pattern: the materials only, nothing made again
  const L = lookOf(c);
  for (const m of GARMENTS.children) if (m.userData.garment === c.design) { m.material.dispose(); m.material = LOOK.material(m.userData.q, L); }
}
function drawWorn() {
  $("#worn").replaceChildren(...st.clothes.map((c, i) => {
    const d = DESIGNS[c.design] || {}, p = pieceOf(c), box = el("div", { className: "garment" });
    const col = el("input", { type: "color", value: c.color }); col.oninput = () => { c.color = col.value; restyle(c); };
    const up = el("button", { textContent: "↑", title: "worn under the one before" }), x = el("button", { textContent: "×", title: "take it off" });
    up.onclick = () => { if (i) { [st.clothes[i - 1], st.clothes[i]] = [st.clothes[i], st.clothes[i - 1]]; drawWorn(); dress(); } };
    x.onclick = () => { st.clothes.splice(i, 1); drawWorn(); dress(); };
    box.append(el("div", { className: "top" }, el("span", { textContent: d.label || c.design }), col, up, x));
    const look = el("details", {}, el("summary", { textContent: "Fabric and pattern" }));
    const fab = el("select", {}, ...Object.entries(SURFACES).map(([k, v]) => el("option", { value: k, textContent: v[0], selected: k === (c.surface ?? d.surface ?? "flat") })));
    fab.onchange = () => { c.surface = fab.value; restyle(c); };
    const pat0 = c.pattern ?? d.pattern ?? { kind: "none" }, pat = el("select", {}, ...Object.entries(PATTERNS).map(([k, v]) => el("option", { value: k, textContent: v[0], selected: k === (pat0.kind || "none") })));
    pat.onchange = () => { c.pattern = { kind: pat.value, colors: (c.pattern || pat0).colors || [c.color, "#20242c", "#a83a3a"], size: (c.pattern || pat0).size || 0.04 }; restyle(c); };
    look.append(el("div", { className: "line" }, el("small", { textContent: "fabric" }), fab, el("small", { textContent: "pattern" }), pat));
    const shape = el("details", { open: true }, el("summary", { textContent: "Shape" }));
    if (p.kind !== "shoe") slider(shape, "Fit", 0, 2, 0.05, p.fit ?? 1, v => { c.edit = { ...(c.edit || {}), fit: v }; dress(); }, "0 skin tight, 1 as designed, 2 loose");
    for (const h of SHAPE.get(c.design) || []) {
      const [lo, hi, step] = h.kind === "height" ? [+(h.value - 0.4).toFixed(2), +(h.value + 0.4).toFixed(2), 0.005] : h.key === "neck" ? [0, 0.2, 0.002] : h.key === "sleeve" ? [0.06, 0.7, 0.005] : [0, 0.8, 0.01];
      slider(shape, h.label, lo, hi, step, h.value, v => { setEdit(c, h, v); dress(); });
    }
    if ((p.legs && p.kind !== "shoe" && d.slot !== "feet" && !p.brief) || p.kind === "skirt") {   // folds by seed (WARDROBE_PLAN 2), the waist snug: shorts, trousers, skirts (not socks or shoes)
      const fo = p.folds || {}, put = v => { c.edit = c.edit || {}; c.edit.folds = { ...(pieceOf(c).folds || {}), ...v }; dress(); };
      slider(shape, "Folds (mm)", 0, 25, 0.5, (fo.depth ?? 0) * 1000, v => put({ depth: +(v / 1000).toFixed(4) }), "folds standing out, growing to this at the hem");
      slider(shape, "How many", 2, 9, 1, fo.count ?? 5, v => put({ count: v }));
      slider(shape, "Gap (A-line)", 0, 2, 0.05, fo.gap ?? (p.kind === "skirt" ? 0.3 : 0.6), v => put({ gap: v }), "the cloth standing off the leg under the folds, a share of their depth");
      const seed = el("button", { textContent: `New folds (seed ${fo.seed ?? 1})` });
      seed.onclick = () => { put({ seed: (pieceOf(c).folds?.seed ?? 1) + 1, depth: pieceOf(c).folds?.depth || 0.008 }); drawWorn(); };
      const back = el("button", { textContent: "Back one" }); back.onclick = () => { put({ seed: Math.max(1, (pieceOf(c).folds?.seed ?? 1) - 1) }); drawWorn(); };
      shape.append(el("div", { className: "line" }, seed, back));
    }
    const reset = el("button", { textContent: "As designed" }); reset.onclick = () => { delete c.edit; drawWorn(); dress(); }; shape.append(reset);
    box.append(look, shape);
    return box;
  }));
}

// ---- outfits: the presets and mine --------------------------------------------------------------------------------
function drawOutfits() {
  const sel = $("#outfitSel"), byGroup = {};
  for (const [n, list] of Object.entries(O.outfits || {})) (byGroup[O.meta?.[n]?.group || (/^(lingerie|underwear):/.test(n) ? "underwear" : "casual")] ||= []).push(n);
  sel.replaceChildren(el("optgroup", { label: "Mine" }, ...Object.keys(MINE.outfits).map(n => el("option", { value: "mine:" + n, textContent: n }))),
    ...Object.entries(byGroup).map(([g, ns]) => el("optgroup", { label: g }, ...ns.map(n => el("option", { value: "preset:" + n, textContent: n })))));
  $("#mine").replaceChildren(...Object.keys(MINE.outfits).map(n => {
    const del = el("button", { className: "del", textContent: "×", title: "delete it from My outfits" });
    del.onclick = async () => { if (!confirm(`Delete "${n}" from My outfits?`)) return; MINE = await api("api/clothes/myoutfits", { delete: n }); drawOutfits(); };
    return el("div", { className: "line" }, el("span", { textContent: n, style: "flex:1" }), del);
  }));
}
function wear(list) {
  st.clothes = list.map(([design, color, look, edit]) => ({ design, color: color || DESIGNS[design]?.color || "#888888", ...(look || {}), ...(edit ? { edit: JSON.parse(JSON.stringify(edit)) } : {}) }));
  SHAPE.clear(); drawWorn(); dress(true);
}
$("#wear").onclick = () => { const v = $("#outfitSel").value, [kind, ...rest] = v.split(":"), n = rest.join(":"); wear((kind === "mine" ? MINE.outfits : O.outfits)[n] || []); if (kind === "mine") $("#saveName").value = n; };
$("#designSel").replaceChildren(...Object.entries(DESIGNS).sort((a, b) => (a[1].label || a[0]).localeCompare(b[1].label || b[0])).map(([k, d]) => el("option", { value: k, textContent: d.label || k })));
$("#add").onclick = () => { const design = $("#designSel").value; st.clothes = st.clothes.filter(c => c.design !== design).concat([{ design, color: $("#newColor").value }]); drawWorn(); dress(); };
$("#save").onclick = async () => {
  const name = $("#saveName").value.trim(); if (!name) return status("a name first", "bad");
  if (O.outfits?.[name]) return status("that's a preset's name: give it another", "bad");
  if (!st.clothes.length) return status("nothing worn", "bad");
  orbit.yaw = 0.35; orbit.pitch = 0.05; orbit.dist = 4.4; orbit.target.set(0, 0.95, 0); place(); renderer.render(scene, camera);
  const thumb = picture();
  MINE = await api("api/clothes/myoutfits", { name, list: st.clothes.map(entryOf), thumb });
  drawOutfits(); status(`saved "${name}" to My outfits`, "ok");
};
function picture() {                                   // the card's picture: this view, 240 x 360, as the outfit pictures are
  const c = document.createElement("canvas"); c.width = 240; c.height = 360;
  const src = renderer.domElement, a = 240 / 360, w = Math.min(src.width, src.height * a), h = w / a;
  c.getContext("2d").drawImage(src, (src.width - w) / 2, (src.height - h) / 2, w, h, 0, 0, 240, 360);
  return c.toDataURL("image/jpeg", 0.86);
}
drawOutfits();
status("the dummy's ready: pick an outfit or add a garment", "ok");
window.__wardrobe = { st, get made() { return made; }, GARMENTS, wear, dress, drawWorn, get MINE() { return MINE; }, DESIGNS, OUTFITS: O.outfits };

// The street paint page (docs/STREET_PAINT.md), after the prop generator's page: a street from the street builder in
// 3D, the PBR sets (the project's pbr/ by category, your own in assets/pbr; the first library made in code folded away)
// and the decals (decals.py) as pictures. Pick a set, tune it in the brush (a tint, brightness, contrast, saturation,
// hue, a fade, its shine and relief, its size and turn) and layer over it (another set in patches or by its own mask:
// moss, prints, scuffs; the bake's wear: grime, streaks, worn edges, damp), then click a surface to paint it: this
// building's (road's, thing's) surface, or every one like it on the street (a piece's `look`, or the street's: the
// street builder's own words, so it shows there too). A tuned look is a set the desk's server makes (storykit/
// pbrmix.py), so what's seen here is what Blender bakes and Godot gets. Zoom in and lay decals, move them, size and turn
// them. Save, then run the street through Blender from the page (`street.py look` for its shot beside its photo, `bake`
// for Godot) with its log and its pictures.
import * as THREE from "three";
import * as SG from "./street-gen.js";
import * as S3 from "./street3.js";
import { Brush, lookName, el, encPath } from "./brush.js";

const $ = s => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const ST = { name: "", S: null, mtime: 0, dirty: false, undo: [], redo: [], mode: "paint", scope: "one",
  target: null, decal: null, sel: null, pieces: [], lights: [], light: Q.get("light") || "day", busy: false };
window.PT = ST;
const status = (t, cls = "") => { const s = $("#status"); s.textContent = t; s.className = cls; };
const t2s = v => [v.x, -v.z, v.y];                                   // three's space -> the street's (z up)
const r3 = v => Math.round(v * 1000) / 1000;
const LISTS = ["roads", "buildings", "things", "fences", "decals"];

// ---- the view -------------------------------------------------------------------------------------------------------
const viewEl = $("#view");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
viewEl.prepend(renderer.domElement);
const scene = new THREE.Scene(), look = new S3.Look(scene), mats = new S3.Materials();
const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 4000);
const BUILT = new Map();
let root = null;
const hl = new THREE.Group(); scene.add(hl);                         // what a click would paint, lit up
const HL = new THREE.MeshBasicMaterial({ color: 0xd9a441, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
const SELMAT = new THREE.MeshBasicMaterial({ color: 0x6fb3d9, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
const ghost = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.65, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
ghost.visible = false; scene.add(ghost);
const orbit = { t: [0, 0, 1.5], yaw: 0.5, pitch: 0.32, dist: 28 };
function sizeTo() { const W = viewEl.clientWidth, H = viewEl.clientHeight, c = renderer.domElement; if (c._w !== W || c._h !== H) { renderer.setSize(W, H, true); c._w = W; c._h = H; } return [W, H]; }
function eye() { const cp = Math.cos(orbit.pitch); return [orbit.t[0] + Math.sin(orbit.yaw) * cp * orbit.dist, orbit.t[1] - Math.cos(orbit.yaw) * cp * orbit.dist, orbit.t[2] + Math.sin(orbit.pitch) * orbit.dist]; }
let frame = 0;
function render() { if (!frame) frame = requestAnimationFrame(() => { frame = 0; draw(); }); }
function draw() {
  if (!ST.S) return;
  const [W, H] = sizeTo();
  camera.aspect = W / Math.max(1, H);
  const s = shot();
  if (s) { camera.fov = s.vfov || 60; camera.position.copy(S3.s2t(...s.eye)); camera.up.set(0, 1, 0); camera.lookAt(S3.s2t(...s.look)); }
  else { camera.fov = 55; camera.position.copy(S3.s2t(...eye())); camera.up.set(0, 1, 0); camera.lookAt(S3.s2t(...orbit.t)); }
  camera.updateProjectionMatrix();
  look.follow(camera);
  look.lamps(ST.lights, t2s(camera.position));
  renderer.render(scene, camera);
}
const shot = () => { const id = $("#shot").value; return id && ST.S && (ST.S.shots || []).find(x => x.id === id); };
window.addEventListener("resize", render);

// ---- the street -----------------------------------------------------------------------------------------------------
function rebuild() {
  ST.pieces = SG.build(ST.S, BUILT);
  const g = S3.group(ST.S, ST.pieces, mats, { shadows: true, prev: root ? root.userData.chunks : null });
  if (root) scene.remove(root);
  root = g; scene.add(root);
  ST.lights = S3.lightsOf(ST.pieces);
  look.set(ST.light, renderer, SG.bounds2(ST.S));
  mats.setTime(look.time);
  const bad = ST.pieces.filter(p => p.error);
  if (bad.length) status(`couldn't build ${bad.map(p => p.id).join(", ")}: ${bad[0].error}`, "bad");
  selected(); render();
}
function itemOf(id) {
  if (!ST.S || !id) return null;
  for (const list of LISTS) { const item = (ST.S[list] || []).find(x => x.id === id); if (item) return { list, item }; }
  return null;
}
const nameOf = it => it ? `${it.item.name || it.item.id} (${it.list.slice(0, -1)})` : "the street";
function lookOn(id, slot) { const it = itemOf(id); return (it && (it.item.look || {})[slot]) || (ST.S.look || {})[slot] || ""; }

async function loadStreets() {
  const r = await (await fetch("/api/streets")).json(), sel = $("#street");
  sel.innerHTML = "";
  for (const n of r.streets || []) sel.append(new Option(n, n));
  const want = Q.get("street") || localStorage.getItem("paint.street") || (r.streets || [])[0];
  if (want) { sel.value = want; await openStreet(want); }
}
async function openStreet(name) {
  if (ST.dirty && !confirm("Leave the unsaved paint on " + ST.name + "?")) { $("#street").value = ST.name; return; }
  const r = await fetch(`/api/street/${encodeURIComponent(name)}`);
  if (!r.ok) { status("no street " + name, "bad"); return; }
  const j = await r.json();
  Object.assign(ST, { name, S: j.street, mtime: j.mtime, dirty: false, undo: [], redo: [], sel: null });
  try { localStorage.setItem("paint.street", name); } catch (e) { /* private window */ }
  const sh = $("#shot"); sh.innerHTML = ""; sh.append(new Option("orbit", ""));
  for (const s of ST.S.shots || []) sh.append(new Option("shot: " + (s.name || s.id), s.id));
  BUILT.clear(); if (root) { scene.remove(root); root = null; }
  frameStreet();
  rebuild(); poll(true);
  S3.prepareLooks(ST.S, () => { if (ST.name === name) rebuild(); });   // tuned looks: their made sets, then drawn
  status(`${name}: ${(ST.S.buildings || []).length} buildings, ${(ST.S.decals || []).length} decals`);
  $("#toStreet").href = "street.html?street=" + encodeURIComponent(name);
}
function frameStreet() {
  const b = SG.bounds2(ST.S) || [-20, -20, 20, 20];
  orbit.t = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 2];
  orbit.dist = Math.max(15, Math.hypot(b[2] - b[0], b[3] - b[1]) * 0.75);
}
async function save() {
  if (!ST.S) return false;
  let r = await fetch(`/api/street/${encodeURIComponent(ST.name)}`, { method: "PUT", body: JSON.stringify({ street: ST.S, mtime: ST.mtime }) });
  if (r.status === 409 && confirm("The street changed on disk since it was opened here (the street builder?). Save over it?"))
    r = await fetch(`/api/street/${encodeURIComponent(ST.name)}`, { method: "PUT", body: JSON.stringify({ street: ST.S, force: true }) });
  if (!r.ok) { status("not saved", "bad"); return false; }
  ST.mtime = (await r.json()).mtime; ST.dirty = false; status("saved", "good");
  return true;
}
function changed(msg) { ST.dirty = true; status("unsaved: " + msg, "dirty"); }
function pushUndo() { ST.undo.push(JSON.stringify(ST.S)); if (ST.undo.length > 100) ST.undo.shift(); ST.redo.length = 0; }
function undo(redo = false) {
  const from = redo ? ST.redo : ST.undo, to = redo ? ST.undo : ST.redo;
  if (!from.length) return;
  to.push(JSON.stringify(ST.S)); ST.S = JSON.parse(from.pop());
  if (ST.sel && !(ST.S.decals || []).some(d => d.id === ST.sel)) ST.sel = null;
  changed(redo ? "redone" : "undone"); rebuild(); selUI();
  S3.prepareLooks(ST.S, () => rebuild());
}

// ---- the brush (brush.js: the shelf's cards, the set tuned and layered) and the decals ------------------------------
const targetName = () => { const t = ST.target; if (!t) return ""; return t.all ? "every " + t.slot : nameOf(itemOf(t.id)) + "'s " + t.slot; };
let tuneAt = 0;
function brushChanged(v) {                                         // changes go onto the surface painted or picked up last
  if (BR.live && ST.target && v) {
    if (performance.now() - tuneAt > 900) pushUndo();                // a run of changes is one undo
    tuneAt = performance.now();
    setLook(ST.target, v);
    changed(`${targetName()}: ${lookName(v)}`);
    rebuild();
  }
  if (S3.isLookObj(v)) {
    status("making the set…", "dirty");
    S3.prepareLooks({ look: { brush: v }, ...(BR.live && ST.target ? ST.S : {}) }, () => { rebuild(); BR.panel(); status(ST.dirty ? "unsaved: " + lookName(v) : lookName(v), ST.dirty ? "dirty" : ""); });
  }
}
const BR = new Brush({ lib: $("#lib"), box: $("#brush"), wear: true, target: targetName, onChange: brushChanged,
  onPick: () => { ST.target = null; setMode("paint"); hud(null); } });
function decalsUI() {
  const box = $("#decals"); box.innerHTML = "";
  const by = {};
  for (const [k, d] of Object.entries(S3.DECALS.list)) (by[d.on] ||= []).push([k, d]);
  for (const on of ["wall", "any", "ground"]) {
    if (!by[on]) continue;
    box.append(el("h3", {}, on === "any" ? "anywhere" : "on " + (on === "wall" ? "a wall" : "the ground")));
    const grid = el("div", { class: "grid" });
    for (const [k, d] of by[on]) {
      const card = el("div", { class: "card" + (ST.decal === k ? " on" : ""), title: `${d.label}, ${d.size[0]} x ${d.size[1]} m` },
        el("img", { src: `/decals/${encodeURIComponent(d.file)}`, loading: "lazy", alt: "", style: "object-fit:contain" }), el("span", {}, d.label));
      card.onclick = () => { ST.decal = k; setMode("decal"); decalsUI(); };
      grid.append(card);
    }
    box.append(grid);
  }
}
function setMode(m) {
  ST.mode = m;
  $("#modePaint").classList.toggle("on", m === "paint"); $("#modeDecal").classList.toggle("on", m === "decal");
  $("#paintPanel").hidden = m !== "paint"; $("#decalPanel").hidden = m !== "decal";
  if (m !== "decal") { ST.sel = null; ghost.visible = false; }
  hl.clear(); selected(); selUI(); render();
}

// ---- picking ---------------------------------------------------------------------------------------------------------
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function hitAt(e, skipDecals = false) {
  if (!root) return null;
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const objs = [];
  root.traverse(o => { if (o.isMesh && !o.name.includes("inside") && !(skipDecals && o.material.userData.decal)) objs.push(o); });
  for (const h of ray.intersectObjects(objs, false)) {
    const id = S3.pieceAt(h);
    if (!id || id.endsWith("__inside")) continue;
    return Object.assign(h, { id, slot: h.object.userData.slot });
  }
  return null;
}
// the triangles of a chunk's mesh that belong to `want(pieceId)`, as a mesh of their own (its own copy of the points)
function partOf(o, want, mat) {
  const R = o.userData.ranges || [], idx = o.geometry.index.array, P = o.geometry.attributes.position.array, out = [];
  for (const [t0, n, id] of R) if (want(id)) for (let i = t0 * 3; i < (t0 + n) * 3; i++) { const k = idx[i] * 3; out.push(P[k], P[k + 1], P[k + 2]); }
  if (!out.length) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  return new THREE.Mesh(g, mat);
}
function clearGroup(g) { for (const c of [...g.children]) { c.geometry.dispose(); g.remove(c); } }
let hoverKey = "";
function hover(h) {
  const key = h ? `${h.id}|${h.slot}|${ST.scope}` : "";
  if (key === hoverKey) return;
  hoverKey = key; clearGroup(hl);
  if (!h || ST.mode !== "paint" || h.object.material.userData.decal) { hud(h); render(); return; }
  const every = ST.scope === "all" || !itemOf(h.id);
  root.traverse(o => {
    if (!o.isMesh || o.userData.slot !== h.slot) return;
    const m = partOf(o, every ? (id => !(itemOf(id) && (itemOf(id).item.look || {})[h.slot])) : (id => id === h.id), HL);
    if (m) hl.add(m);
  });
  hud(h); render();
}
function hud(h) {
  const box = $("#hud");
  if (!h) { box.textContent = ST.mode === "paint" ? (BR.value() ? `paint with ${lookName(BR.value())}: click a surface` : "pick a material on the left") : ST.decal ? `click to lay ${S3.DECALS.list[ST.decal]?.label || ST.decal}` : "pick a decal on the left"; return; }
  const it = itemOf(h.id);
  if (h.object.material.userData.decal) { box.textContent = `${S3.DECALS.list[h.object.material.userData.decal]?.label || "a decal"}: click to select it`; return; }
  const now = lookOn(h.id, h.slot), every = ST.scope === "all" || !it;
  box.textContent = `${every ? "every " + h.slot + " on the street" : nameOf(it) + ": its " + h.slot} · now ${lookName(now)}`
    + (ST.mode === "paint" ? ` · click: ${BR.value() ? lookName(BR.value()) : "pick a material first"}, Alt-click: pick this one up` : "");
}

// ---- painting ----------------------------------------------------------------------------------------------------------
function setLook(t, value) {                                       // a look on a target: {id, slot, all}
  const it = t.all ? null : itemOf(t.id);
  if (!it) { ST.S.look = ST.S.look || {}; if (value) ST.S.look[t.slot] = value; else delete ST.S.look[t.slot]; return; }
  const x = it.item; x.look = x.look || {};
  if (value) x.look[t.slot] = value; else delete x.look[t.slot];
  if (x.inside && x.inside.from) x.inside.own = true;              // a walk-in building painted here keeps its own outside
}
function paint(h, value) {
  if (!h || h.object.material.userData.decal) return;
  const it = itemOf(h.id);
  if (it && it.list === "decals") return;
  pushUndo();
  const t = { id: h.id, slot: h.slot, all: ST.scope === "all" || !it };
  setLook(t, value);
  ST.target = value ? t : null;
  changed(`${t.all ? "every " + h.slot : nameOf(it) + "'s " + h.slot}: ${lookName(value)}`);
  hoverKey = ""; rebuild(); hover(h); BR.panel();
  if (S3.isLookObj(value)) S3.prepareLooks(ST.S, () => { rebuild(); BR.panel(); });
}
function pickUp(h) {
  const v = lookOn(h.id, h.slot), it = itemOf(h.id);
  ST.target = { id: h.id, slot: h.slot, all: !(it && (it.item.look || {})[h.slot] !== undefined) };
  BR.take(v);
  if (typeof v === "string" && v.startsWith("#")) $("#colour").value = v;
  status(`picked up ${lookName(v)}: the brush tunes ${targetName()}`);
}

// ---- decals ------------------------------------------------------------------------------------------------------------
function newId() { const ids = new Set(); for (const l of LISTS) for (const x of ST.S[l] || []) ids.add(x.id); let i = 1; while (ids.has("d" + i)) i++; return "d" + i; }
function decalAt(h, kind) {
  const n = h.face.normal.clone().transformDirection(h.object.matrixWorld), info = S3.DECALS.list[kind] || {};
  const [w, hh] = info.size || [1, 1];
  const ns = t2s(n), ground = ns[2] > 0.7;
  const rot = ground ? Math.round(((-orbit.yaw * 180 / Math.PI) % 360) / 15) * 15 : 0;    // on the ground: upright to the view
  return { id: newId(), kind, at: t2s(h.point).map(r3), n: ns.map(r3), w, h: hh, rot };
}
function placeGhost(h) {
  if (!h || ST.mode !== "decal" || !ST.decal || ST.sel) { ghost.visible = false; return; }
  const d = decalAt(h, ST.decal), P = SG.decalParts(d).G[`decal:${d.kind}`];
  if (!P) { ghost.visible = false; return; }
  const v = i => S3.s2t(P.pos[i * 3], P.pos[i * 3 + 1], P.pos[i * 3 + 2]);
  const g = new THREE.BufferGeometry().setFromPoints([v(0), v(1), v(2), v(3)]);
  g.setIndex([...P.idx]); g.setAttribute("uv", new THREE.Float32BufferAttribute(P.uv, 2));
  ghost.geometry.dispose(); ghost.geometry = g;
  const t = mats.get(`decal:${d.kind}`, "").map;
  if (ghost.material.map !== t) { ghost.material.map = t; ghost.material.needsUpdate = true; }
  ghost.visible = true;
}
function selDecal() { return ST.sel && (ST.S.decals || []).find(d => d.id === ST.sel); }
function selected() {
  clearGroup(sel);
  const d = selDecal(); if (!d || !root) return;
  root.traverse(o => { if (o.isMesh && o.material.userData.decal) { const m = partOf(o, id => id === d.id, SELMAT); if (m) sel.add(m); } });
}
const sel = new THREE.Group(); scene.add(sel);
function selUI() {
  const box = $("#selPanel"), d = selDecal();
  box.hidden = !d; if (!d) return;
  box.innerHTML = "";
  const info = S3.DECALS.list[d.kind] || {};
  const num = (k, step, min, max) => { const i = el("input", { type: "number", step, min, max, value: d[k], style: "width:64px" }); i.onchange = () => { pushUndo(); d[k] = Math.max(min, Math.min(max, +i.value || 0)); changed("a decal"); rebuild(); }; return i; };
  box.append(el("b", {}, info.label || d.kind), el("div", { class: "row" }, "w", num("w", 0.05, 0.05, 20), "h", num("h", 0.05, 0.05, 20), "turn", num("rot", 15, -360, 360)),
    el("div", { class: "row" }, el("button", { onclick: () => removeDecal() }, "take it off"), el("small", { class: "dim" }, "drag it to move it; the wheel sizes it; R turns it")));
}
function removeDecal() { const d = selDecal(); if (!d) return; pushUndo(); ST.S.decals = ST.S.decals.filter(x => x !== d); ST.sel = null; changed("a decal taken off"); rebuild(); selUI(); }

// ---- the mouse --------------------------------------------------------------------------------------------------------
let drag = null;
const cv = renderer.domElement;
cv.addEventListener("contextmenu", e => e.preventDefault());
cv.addEventListener("pointerdown", e => {
  cv.setPointerCapture(e.pointerId);
  if (e.button === 2 || e.button === 1) { drag = { kind: e.button === 1 || e.shiftKey ? "pan" : "turn", x: e.clientX, y: e.clientY, moved: 0 }; return; }
  if (e.button !== 0 || !ST.S) return;
  if (shot()) { $("#shot").value = ""; }                               // painting from a shot: carry on from where it looks
  const h = hitAt(e);
  if (ST.mode === "paint") {
    if (!h) return;
    if (e.altKey) { pickUp(h); return; }
    const v = BR.value();
    if (v) paint(h, v);
    return;
  }
  // decals: one under the pointer is picked (and dragged); else a new one is laid
  if (h && h.object.material.userData.decal) { ST.sel = h.id; selected(); selUI(); pushUndo(); drag = { kind: "decal", moved: 0, x: e.clientX, y: e.clientY }; render(); return; }
  if (h && ST.decal) {
    const d = decalAt(hitAt(e, true) || h, ST.decal);
    pushUndo(); (ST.S.decals = ST.S.decals || []).push(d); ST.sel = d.id;
    changed(`laid ${S3.DECALS.list[d.kind]?.label || d.kind}`); ghost.visible = false; rebuild(); selUI();
    return;
  }
  ST.sel = null; selected(); selUI(); render();
});
cv.addEventListener("pointermove", e => {
  if (drag && drag.kind === "turn") { orbit.yaw += (e.clientX - drag.x) * 0.006; orbit.pitch = Math.max(-0.2, Math.min(1.45, orbit.pitch + (e.clientY - drag.y) * 0.005)); drag.x = e.clientX; drag.y = e.clientY; $("#shot").value = ""; render(); return; }
  if (drag && drag.kind === "pan") {
    const k = orbit.dist * 0.0016, dx = e.clientX - drag.x, dy = e.clientY - drag.y, c = Math.cos(orbit.yaw), s = Math.sin(orbit.yaw);
    orbit.t[0] += (-dx * c - dy * s) * k; orbit.t[1] += (-dx * s + dy * c) * k;   // the ground dragged under the pointer
    drag.x = e.clientX; drag.y = e.clientY; $("#shot").value = ""; render(); return;
  }
  if (drag && drag.kind === "decal") {
    const d = selDecal(), h = hitAt(e, true);
    if (d && h) { const nd = decalAt(h, d.kind); d.at = nd.at; d.n = nd.n; drag.moved++; changed("a decal moved"); rebuild(); }
    return;
  }
  const h = hitAt(e);
  hover(h); placeGhost(h && !h.object.material.userData.decal ? h : null); render();
});
cv.addEventListener("pointerup", e => { if (drag && drag.kind === "decal" && !drag.moved) ST.undo.pop(); drag = null; cv.releasePointerCapture(e.pointerId); });
cv.addEventListener("wheel", e => {
  e.preventDefault();
  const d = ST.mode === "decal" && selDecal();
  if (d) { const k = e.deltaY > 0 ? 1 / 1.08 : 1.08; d.w = r3(Math.max(0.05, d.w * k)); d.h = r3(Math.max(0.05, d.h * k)); changed("a decal sized"); rebuild(); selUI(); return; }
  const h = hitAt(e);
  const f = e.deltaY > 0 ? 1.12 : 1 / 1.12;
  if (h && f < 1) { const p = t2s(h.point); orbit.t = orbit.t.map((v, i) => v + (p[i] - v) * 0.12); }
  orbit.dist = Math.max(1.5, Math.min(800, orbit.dist * f)); $("#shot").value = ""; render();
}, { passive: false });
cv.addEventListener("dblclick", e => { const h = hitAt(e); if (h) { orbit.t = t2s(h.point); orbit.dist = Math.max(3, orbit.dist * 0.6); $("#shot").value = ""; render(); } });
window.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(e.shiftKey); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); undo(true); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); return; }
  if (e.key === "1") setMode("paint");
  if (e.key === "2") setMode("decal");
  const d = selDecal();
  if (d && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); removeDecal(); }
  if (d && e.key.toLowerCase() === "r") { pushUndo(); d.rot = ((d.rot || 0) + (e.shiftKey ? -15 : 15)) % 360; changed("a decal turned"); rebuild(); selUI(); }
  if (e.key === "Escape") { ST.sel = null; selected(); selUI(); render(); }
});

// ---- Blender -------------------------------------------------------------------------------------------------------------
async function runBlender(cmd) {
  if (!ST.S) return;
  if (ST.dirty && !(await save())) return;
  const body = { cmd, quick: $("#quick").checked, godot: $("#godot").checked, shot: $("#shot").value || ((ST.S.shots || [])[0] || {}).id || "" };
  const r = await fetch(`/api/streetbake/${encodeURIComponent(ST.name)}`, { method: "POST", body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) { status(j.error || "Blender didn't start", "bad"); return; }
  status(`Blender: ${cmd} ${ST.name}…`); show(j); setTimeout(poll, 1200);
}
async function poll(once = false) {
  if (!ST.name) return;
  const j = await (await fetch(`/api/streetbake/${encodeURIComponent(ST.name)}`)).json();
  show(j);
  if (j.running && !once) setTimeout(poll, 1500);
  else if (j.running) setTimeout(poll, 1500);
  else if (j.cmd && !once) status(j.code === 0 ? "Blender's done: its pictures are on the right" : "Blender stopped: see its log", j.code === 0 ? "good" : "bad");
}
function show(j) {
  $("#log").textContent = j.log && j.log.length ? j.log.join("\n") : j.cmd ? "…" : "nothing run yet";
  $("#log").scrollTop = 1e9;
  $("#lookBtn").disabled = $("#bakeBtn").disabled = !!j.running;
  const box = $("#pics"); box.innerHTML = "";
  for (const p of (j.pictures || []).slice(0, 12)) {
    const url = `/streetout/${encodeURIComponent(ST.name)}/${encodeURIComponent(p.file)}?t=${p.mtime}`;
    const a = el("a", { href: url, target: "_blank" }, el("img", { src: url, loading: "lazy", alt: "" }), el("small", {}, p.file));
    a.onclick = ev => { ev.preventDefault(); const b = $("#big"); b.src = url; b.hidden = false; };
    box.append(a);
  }
  const best = (j.pictures || []).find(p => /^compare/.test(p.file)) || (j.pictures || [])[0];
  if (best && $("#big").hidden) { $("#big").src = `/streetout/${encodeURIComponent(ST.name)}/${encodeURIComponent(best.file)}?t=${best.mtime}`; $("#big").hidden = false; }
}

// ---- the page ------------------------------------------------------------------------------------------------------------
$("#street").onchange = e => openStreet(e.target.value);
$("#shot").onchange = () => render();
$("#light").value = ST.light;
$("#light").onchange = e => { ST.light = e.target.value; look.set(ST.light, renderer, SG.bounds2(ST.S)); mats.setTime(look.time); render(); };
$("#undo").onclick = () => undo(); $("#redo").onclick = () => undo(true); $("#save").onclick = () => save();
$("#modePaint").onclick = () => setMode("paint"); $("#modeDecal").onclick = () => setMode("decal");
for (const r of document.querySelectorAll("input[name=scope]")) r.onchange = e => { ST.scope = e.target.value; hoverKey = ""; };
$("#useColour").onclick = () => BR.useColour($("#colour").value);
$("#clear").onclick = () => { BR.clear(); ST.clearing = true; status("click a surface to take its paint off", "dirty"); };
$("#lookBtn").onclick = () => runBlender("look"); $("#bakeBtn").onclick = () => runBlender("bake");
window.addEventListener("beforeunload", e => { if (ST.dirty) { e.preventDefault(); e.returnValue = ""; } });
// clearing: a click with nothing picked and "clear" pressed takes the paint off
cv.addEventListener("pointerdown", e => { if (ST.clearing && e.button === 0 && ST.mode === "paint" && !BR.value()) { const h = hitAt(e); if (h) paint(h, null); } }, true);

(async function boot() {
  await Promise.all([S3.loadShelf(), S3.loadDecals()]);
  BR.library(); decalsUI(); hud(null);
  await loadStreets();
  window.__paintReady = true;
})();
// for the page's check (paintcheck): pick, paint and lay by the view's fractions, as a person would
window.__paint = {
  at(fx, fy) { const r = cv.getBoundingClientRect(); return hitAt({ clientX: r.left + fx * r.width, clientY: r.top + fy * r.height }); },
  paintAt(fx, fy, ref, scope = "one") { ST.scope = scope; const h = this.at(fx, fy); if (h) paint(h, ref); return h && { id: h.id, slot: h.slot }; },
  pickAt(fx, fy) { const h = this.at(fx, fy); if (h) pickUp(h); return h && { id: h.id, slot: h.slot }; },
  brush(set) { ST.target = null; BR.mat = set; BR.brush = { set }; BR.colour = null; BR.panel(); return BR.brush; },
  tune(fn) { fn(BR.brush); BR.changed(); return BR.value(); },
  made: () => S3.prepareLooks(ST.S),
  lookRef: v => S3.lookRef(v),
  decalAt(fx, fy, kind) { const h = this.at(fx, fy); if (!h) return null; const d = decalAt(h, kind); pushUndo(); (ST.S.decals = ST.S.decals || []).push(d); changed("a decal"); rebuild(); return d; },
  view(o) { Object.assign(orbit, o); $("#shot").value = ""; draw(); },
  shot(id) { $("#shot").value = id; draw(); },
  draw, save, rebuild, undo,
};

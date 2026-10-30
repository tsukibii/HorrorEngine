// The street builder (docs/STREET_BUILDER.md): the outside world the enterable buildings (the scene builder's) are put
// into: streets, the outsides of buildings, lamps, poles and wires, fences and the clutter of a lived-in street, low
// poly and quick to fill. The map (from above), the picked building's front and side flat on (each with a photo
// behind it to trace), a 3D view to orbit, walk or look through a shot matched to a photo, and the inspector.
// It reads and writes Content/Studio/Streets/<name>/street.json through the desk's server; street-gen.js builds it,
// street3.js draws it, street-presets.js holds the building styles.
import * as THREE from "three";
import * as SG from "./street-gen.js";
import * as S3 from "./street3.js";
import * as SP from "./street-presets.js";
import { GLTFExporter } from "./vendor/GLTFExporter.js";

const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "on") for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else if (k === "class") e.className = v;
    else if (k === "style") e.style.cssText = v;
    else if (k in e && typeof v !== "string") e[k] = v;
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
const r2 = v => Math.round(v * 100) / 100, r1 = v => Math.round(v * 10) / 10, deg = r => r * 180 / Math.PI, rad = d => d * Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const api = async (url, opts) => { const r = await fetch(url, opts); const j = await r.json().catch(() => ({})); if (!r.ok && r.status !== 409) throw new Error(j.error || r.status); return Object.assign(j, { _status: r.status }); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function status(t, cls) { const s = $("#status"); s.textContent = t; s.className = cls || ""; }
function toast(t) { const e = $("#toast"); e.textContent = t; e.classList.add("on"); clearTimeout(e._h); e._h = setTimeout(() => e.classList.remove("on"), 2600); }

const LISTS = ["roads", "buildings", "things", "fences", "shots"];
const ST = window.ST = {
  name: null, street: null, mtime: 0, dirty: false, names: [],
  sel: null,                 // {list, id}, with part (a building's part's index), or face + floor (a floor of a face)
  tool: null,                // what the next click places: {what: road|building|thing|fence|part, ...}
  undo: [], redo: [], snap: 0.1,
  view: { cx: 0, cy: 0, s: 6 },                                   // the map: its middle in metres, px a metre
  mode: "orbit", orbit: { yaw: 0.5, pitch: 0.55, dist: 70, t: [0, 0, 0] }, walk: { x: 0, y: -12, yaw: 0, pitch: 0 },
  pieces: [], lights: [], ready: false,
};
const Q = new URLSearchParams(location.search);

// ---- the street on disk ---------------------------------------------------------------------------------------------
async function loadNames() {
  const j = await api("/api/streets");
  ST.names = j.streets || [];
  const sel = $("#street"); sel.innerHTML = "";
  for (const n of ST.names) sel.append(new Option(n, n));
  sel.append(new Option("+ new street…", "__new"));
}
async function open(name) {
  const j = await api("/api/street/" + encodeURIComponent(name));
  ST.name = name; ST.street = normal(j.street); ST.mtime = j.mtime; ST.dirty = false; ST.sel = null; ST.undo = []; ST.redo = []; BUILT.clear();
  try { localStorage.setItem("street.name", name); } catch (e) { }
  $("#street").value = name; $("#time").value = ST.street.time || "dusk";
  frameMap(); frameOrbit(); fillModes();
  ST.mode = Q.get("shot") && (ST.street.shots || []).some(s => s.id === Q.get("shot")) ? "shot:" + Q.get("shot") : "orbit";
  $("#mode").value = ST.mode;
  rebuild(); drawMap(); inspect(); viewTools();
  status(`${name}: ${count()}`);
}
function normal(S) {
  S = S || SP.blankStreet("street");
  for (const k of LISTS) S[k] = Array.isArray(S[k]) ? S[k] : [];
  S.look = S.look || {}; S.time = S.time || "dusk";
  return S;
}
const count = () => { const S = ST.street; return `${S.roads.length} streets, ${S.buildings.length} buildings, ${S.things.length} things, ${S.fences.length} fences, ${S.shots.length} shots`; };
async function save() {
  if (!ST.name) return;
  const body = { street: ST.street, mtime: ST.mtime };
  let j = await api("/api/street/" + encodeURIComponent(ST.name), { method: "PUT", body: JSON.stringify(body) });
  if (j._status === 409) {
    if (!confirm("The street changed on disk since it was opened (Claude edited it?). Save over it anyway?")) return;
    j = await api("/api/street/" + encodeURIComponent(ST.name), { method: "PUT", body: JSON.stringify(Object.assign(body, { force: true })) });
  }
  ST.mtime = j.mtime; ST.dirty = false; status(`saved ${ST.name}: ${count()}`);
}
async function newStreet() {
  const name = (prompt("A name for the new street (small letters, digits and _), e.g. old_town or station_road") || "").trim();
  if (!name) { $("#street").value = ST.name || ""; return; }
  if (!/^[a-z][a-z0-9_]{0,40}$/.test(name)) { alert("small letters, digits and _, starting with a letter"); $("#street").value = ST.name || ""; return; }
  const j = await api("/api/street/" + name + "/new", { method: "POST", body: JSON.stringify({ street: SP.blankStreet(name) }) });
  if (j.error) { alert(j.error); return; }
  await loadNames(); await open(name);
}

// ---- undo, and every change -----------------------------------------------------------------------------------------
function pushUndo() { ST.undo.push(JSON.stringify(ST.street)); if (ST.undo.length > 150) ST.undo.shift(); ST.redo = []; }
function undo() { if (!ST.undo.length) return; ST.redo.push(JSON.stringify(ST.street)); ST.street = normal(JSON.parse(ST.undo.pop())); afterRestore(); }
function redo() { if (!ST.redo.length) return; ST.undo.push(JSON.stringify(ST.street)); ST.street = normal(JSON.parse(ST.redo.pop())); afterRestore(); }
function afterRestore() { if (ST.sel && !find(ST.sel)) ST.sel = null; changed(); }
let rebuildTimer = 0, rebuildAt = 0;
// opts.inspector false: a field's own edit (don't redraw the form under the cursor); opts.soon: a drag (at most 8 a second)
function changed(opts = {}) {
  ST.dirty = true; ST.version = (ST.version || 0) + 1;
  drawMap();
  if (opts.inspector !== false) inspect();
  clearTimeout(rebuildTimer);
  const wait = opts.soon ? Math.max(0, 120 - (performance.now() - rebuildAt)) : 60;
  rebuildTimer = setTimeout(rebuild, wait);
  status(`unsaved: ${count()}`, "dirty");
}
const find = sel => sel && (ST.street[sel.list] || []).find(p => p.id === sel.id);
const selected = () => find(ST.sel);
function select(sel) { ST.sel = sel; drawMap(); inspect(); highlight(); renderFacades(); render(); }
function allIds() { const s = new Set(); for (const k of LISTS) for (const p of ST.street[k]) s.add(p.id); return s; }
function newId(prefix) { const ids = allIds(); let n = 1; while (ids.has(prefix + n)) n++; return prefix + n; }

// ---- the 3D view ----------------------------------------------------------------------------------------------------
const viewEl = $("#view");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
viewEl.prepend(renderer.domElement);
const scene = new THREE.Scene();
const look = new S3.Look(scene);
const mats = new S3.Materials();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 4000);
const selBox = new THREE.Box3Helper(new THREE.Box3(), 0xd9a441); selBox.visible = false; scene.add(selBox);
let root = null;
// a renderer's canvas resized only when it has to (setting a canvas's size, even to the same, throws its buffer away)
function sizeTo(r, W, H) { const c = r.domElement; if (c._w !== W || c._h !== H) { r.setSize(W, H, true); c._w = W; c._h = H; } }
function dispose(o) { o.traverse(x => { if (x.geometry) x.geometry.dispose(); }); }
// a piece is built again only when its own numbers change (BUILT), and a chunk merged again only when one of its pieces
// did (street3's group keeps the rest): a big street stays quick to drag things about in
const BUILT = new Map();
function rebuild() {
  rebuildAt = performance.now();
  ST.pieces = SG.build(ST.street, BUILT);
  const g = S3.group(ST.street, ST.pieces, mats, { shadows: true, prev: root ? root.userData.chunks : null });
  if (root) scene.remove(root);
  root = g; scene.add(root);
  ST.lights = S3.lightsOf(ST.pieces);
  look.set(ST.street.time, renderer, SG.bounds2(ST.street));
  mats.setTime(look.time);
  const errs = ST.pieces.filter(p => p.error);
  if (errs.length) status(`couldn't build ${errs.map(p => p.id).join(", ")}: ${errs[0].error}`, "bad");
  highlight(); render(); renderFacades();
  ST.built = (ST.built || 0) + 1;
}
function highlight() {
  const p = selected(); selBox.visible = false;
  if (!p || !root || ST.sel.list === "shots") return;
  const ix = root.userData.index[p.id]; if (!ix) return;
  selBox.box.min.set(...ix.lo); selBox.box.max.set(...ix.hi); selBox.visible = true;
}
const shotOf = mode => mode && mode.startsWith("shot:") ? ST.street.shots.find(s => s.id === mode.slice(5)) : null;
function eyeNow() {                                                  // where the eye is, story space
  const s = shotOf(ST.mode);
  if (s) return s.eye;
  if (ST.mode === "walk") return [ST.walk.x, ST.walk.y, 1.65 + surfaceAt(ST.walk.x, ST.walk.y)];
  const o = ST.orbit, c = Math.cos(o.pitch);
  return [o.t[0] - Math.sin(o.yaw) * c * o.dist, o.t[1] - Math.cos(o.yaw) * c * o.dist, o.t[2] + Math.sin(o.pitch) * o.dist];
}
// the ground under a point: a road, a pavement's top, the lots between (street-gen's terrain, kept until the street changes)
let TER = null, TERof = null;
function terrain() { if (TERof !== ST.street || !TER || TER.v !== ST.version) { TER = SG.terrain(ST.street); TER.v = ST.version; TERof = ST.street; } return TER; }
const surfaceAt = (x, y) => terrain().surface(x, y);
let viewRect = { x: 0, y: 0, w: 1, h: 1 };
function render() {
  if (!ST.street) return;
  const W = viewEl.clientWidth, H = viewEl.clientHeight;
  sizeTo(renderer, W, H);
  const s = shotOf(ST.mode);
  let rect = { x: 0, y: 0, w: W, h: H };
  if (s) {                                                           // a shot: letterboxed to its aspect
    const a = shotAspect(s), k = Math.min(W / a, H);
    rect = { w: Math.round(k * a), h: Math.round(k), x: 0, y: 0 }; rect.x = Math.round((W - rect.w) / 2); rect.y = Math.round((H - rect.h) / 2);
    camera.fov = s.vfov || 60; camera.aspect = rect.w / rect.h;
    camera.position.copy(S3.s2t(...s.eye)); camera.up.set(0, 1, 0); camera.lookAt(S3.s2t(...s.look));
  } else {
    camera.fov = ST.mode === "walk" ? 70 : 50; camera.aspect = W / Math.max(1, H);
    const e = eyeNow(); camera.position.copy(S3.s2t(...e)); camera.up.set(0, 1, 0);
    if (ST.mode === "walk") { const w = ST.walk, c = Math.cos(w.pitch); camera.lookAt(S3.s2t(e[0] + Math.sin(w.yaw) * c, e[1] + Math.cos(w.yaw) * c, e[2] + Math.sin(w.pitch))); }
    else camera.lookAt(S3.s2t(...ST.orbit.t));
  }
  camera.updateProjectionMatrix();
  viewRect = rect;
  look.follow(camera);
  renderer.setScissorTest(true);
  renderer.setViewport(0, 0, W, H); renderer.setScissor(0, 0, W, H); renderer.setClearColor(0x000000, 1); renderer.clear();
  renderer.setViewport(rect.x, H - rect.y - rect.h, rect.w, rect.h); renderer.setScissor(rect.x, H - rect.y - rect.h, rect.w, rect.h);
  renderer.render(scene, camera);
  renderer.setScissorTest(false);
  const img = $("#shotRef");
  if (s && s.ref) {
    const src = refUrl(s.ref); if (img.dataset.src !== src) { img.src = src; img.dataset.src = src; }
    Object.assign(img.style, { display: "block", left: rect.x + "px", top: rect.y + "px", width: rect.w + "px", height: rect.h + "px", opacity: (s.op ?? 0.5) });
  } else img.style.display = "none";
  const hud = $("#viewHud");
  hud.textContent = s ? `${s.name || s.id} · lens ${r1(s.vfov || 60)}° tall · eye ${s.eye.map(r2).join(", ")}${$("#shotAdjust").checked ? " · drag to turn, WASD to move, Q/E down/up, wheel the lens" : ""}`
    : ST.mode === "walk" ? "walking: WASD or the arrows, Shift runs, drag to look · at the player's eye (1.65 m)" : "drag to orbit, right-drag to pan, wheel to zoom · click a thing to pick it · double-click to walk from there";
  ST.frames = (ST.frames || 0) + 1;
}
const shotAspect = s => { const a = s.aspect || [16, 9]; return Array.isArray(a) ? a[0] / a[1] : +a || 16 / 9; };
const refUrl = f => { const [p, q] = String(f).split("?"); return `/streets/${encodeURIComponent(ST.name)}/${p.split("/").map(encodeURIComponent).join("/")}${q ? "?" + q : ""}`; };
let lampsAt = null;
function placeLamps(force) {                                         // the nearest lamps light up (a pool: no shader rebuilds)
  const e = eyeNow();
  if (!force && lampsAt && Math.hypot(e[0] - lampsAt[0], e[1] - lampsAt[1]) < 4) return;
  lampsAt = e; look.lamps(ST.lights, e, 16);
}
const _render = render;
// every frame drawn: the nearest lamps first
function renderAll() { placeLamps(); _render(); }

// the 3D view's mouse and keys
let vdrag = null;
const keys = new Set();
renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());
renderer.domElement.addEventListener("pointerdown", e => {
  viewEl.focus();
  vdrag = { x: e.clientX, y: e.clientY, b: e.button, moved: false, o: JSON.parse(JSON.stringify(ST.orbit)), w: { ...ST.walk }, s: shotOf(ST.mode) ? JSON.parse(JSON.stringify(shotOf(ST.mode))) : null, undone: false };
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener("pointermove", e => {
  if (!vdrag) return;
  const dx = e.clientX - vdrag.x, dy = e.clientY - vdrag.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) vdrag.moved = true;
  if (!vdrag.moved) return;
  const s = shotOf(ST.mode);
  if (s && $("#shotAdjust").checked) {                               // turning a shot
    if (!vdrag.undone) { pushUndo(); vdrag.undone = true; }
    const d = [vdrag.s.look[0] - vdrag.s.eye[0], vdrag.s.look[1] - vdrag.s.eye[1], vdrag.s.look[2] - vdrag.s.eye[2]], L = Math.hypot(...d) || 1;
    const k = rad(s.vfov || 60) / viewRect.h;
    const yaw = Math.atan2(d[0], d[1]) + dx * k, pitch = clamp(Math.asin(d[2] / L) + dy * k, -1.4, 1.4);
    s.look = [s.eye[0] + Math.sin(yaw) * Math.cos(pitch) * L, s.eye[1] + Math.cos(yaw) * Math.cos(pitch) * L, s.eye[2] + Math.sin(pitch) * L].map(v => Math.round(v * 1000) / 1000);
    ST.dirty = true; render(); inspectSoon(); drawMap(); return;
  }
  if (ST.mode === "walk") { ST.walk.yaw = vdrag.w.yaw + dx * 0.005; ST.walk.pitch = clamp(vdrag.w.pitch - dy * 0.005, -1.3, 1.3); renderAll(); return; }
  if (s) return;
  if (vdrag.b === 2 || e.shiftKey) {
    const k = ST.orbit.dist / 700, yaw = ST.orbit.yaw;
    const right = [Math.cos(yaw), -Math.sin(yaw)], fwd = [Math.sin(yaw), Math.cos(yaw)];
    ST.orbit.t = [vdrag.o.t[0] - right[0] * dx * k + fwd[0] * dy * k, vdrag.o.t[1] - right[1] * dx * k + fwd[1] * dy * k, vdrag.o.t[2]];
  } else { ST.orbit.yaw = vdrag.o.yaw + dx * 0.006; ST.orbit.pitch = clamp(vdrag.o.pitch + dy * 0.006, 0.03, 1.5); }
  renderAll(); drawMap();
});
renderer.domElement.addEventListener("pointerup", e => {
  const d = vdrag; vdrag = null;
  if (d && !d.moved && d.b === 0) pick3d(e);
  if (d && d.undone) { inspect(); changed({ inspector: true }); }
});
renderer.domElement.addEventListener("dblclick", e => {
  const hit = ray(e); if (!hit) return;
  const p = hit.point; ST.walk.x = p.x; ST.walk.y = -p.z; ST.walk.yaw = ST.mode === "orbit" ? ST.orbit.yaw : ST.walk.yaw; ST.walk.pitch = 0;
  setMode("walk");
});
renderer.domElement.addEventListener("wheel", e => {
  e.preventDefault();
  const s = shotOf(ST.mode);
  if (s && $("#shotAdjust").checked) { pushUndo(); s.vfov = r2(clamp((s.vfov || 60) * (e.deltaY > 0 ? 1.02 : 1 / 1.02), 8, 120)); ST.dirty = true; render(); inspectSoon(); drawMap(); return; }
  if (ST.mode === "orbit") { ST.orbit.dist = clamp(ST.orbit.dist * (e.deltaY > 0 ? 1.12 : 1 / 1.12), 3, 900); renderAll(); drawMap(); }
}, { passive: false });
function ray(e) {
  if (!root) return null;
  const r = renderer.domElement.getBoundingClientRect(), x = e.clientX - r.left - viewRect.x, y = e.clientY - r.top - viewRect.y;
  if (x < 0 || y < 0 || x > viewRect.w || y > viewRect.h) return null;
  const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(x / viewRect.w * 2 - 1, -(y / viewRect.h) * 2 + 1), camera);
  const hits = rc.intersectObject(root, true).filter(h => h.object.visible);
  return hits[0] || null;
}
function pick3d(e) {
  const h = ray(e), id = h && S3.pieceAt(h), ix = id && root.userData.index[id];
  if (!ix || ix.type === "ground" || ix.type === "wires") { select(null); return; }
  select({ list: { road: "roads", building: "buildings", thing: "things", fence: "fences" }[ix.type], id });
}
viewEl.addEventListener("keydown", e => {
  if (["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(e.key.toLowerCase()) && (ST.mode === "walk" || (shotOf(ST.mode) && $("#shotAdjust").checked))) {
    keys.add(e.key.toLowerCase()); e.preventDefault(); e.stopPropagation(); loop();
  }
});
viewEl.addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
viewEl.addEventListener("blur", () => keys.clear());
let looping = false, lastT = 0, adjustUndone = false;
function loop() {
  if (looping) return; looping = true; lastT = performance.now();
  const step = (t) => {
    const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
    if (!keys.size) { looping = false; adjustUndone = false; inspect(); return; }
    const run = keys.has("shift") ? 4.5 : 1.6, f = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
    const sd = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0), turn = (keys.has("arrowright") ? 1 : 0) - (keys.has("arrowleft") ? 1 : 0), up = (keys.has("e") ? 1 : 0) - (keys.has("q") ? 1 : 0);
    const s = shotOf(ST.mode);
    if (s) {
      if (!adjustUndone) { pushUndo(); adjustUndone = true; }
      const d = [s.look[0] - s.eye[0], s.look[1] - s.eye[1]], L = Math.hypot(...d) || 1, fw = [d[0] / L, d[1] / L], rt = [fw[1], -fw[0]], k = dt * (keys.has("shift") ? 2 : 0.6);
      const mv = [fw[0] * f * k + rt[0] * sd * k, fw[1] * f * k + rt[1] * sd * k, up * k];
      s.eye = s.eye.map((v, i) => Math.round((v + mv[i]) * 1000) / 1000); s.look = s.look.map((v, i) => Math.round((v + mv[i]) * 1000) / 1000);
      ST.dirty = true; drawMap();
    } else {
      const w = ST.walk; w.yaw += turn * dt * 1.6;
      w.x += (Math.sin(w.yaw) * f + Math.cos(w.yaw) * sd) * run * dt; w.y += (Math.cos(w.yaw) * f - Math.sin(w.yaw) * sd) * run * dt;
      drawMap();
    }
    renderAll(); requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function setMode(m) {
  ST.mode = m; $("#mode").value = m; viewTools(); lampsAt = null; renderAll(); drawMap();
  if (m === "walk") viewEl.focus();
}
function fillModes() {
  const sel = $("#mode"); sel.innerHTML = "";
  sel.append(new Option("orbit", "orbit"), new Option("walk (player's eye)", "walk"));
  for (const s of ST.street.shots) sel.append(new Option("shot: " + (s.name || s.id), "shot:" + s.id));
  sel.value = ST.mode;
}
function viewTools() {
  const s = shotOf(ST.mode); $("#shotTools").hidden = !s;
  if (s) { $("#shotOp").value = Math.round((s.op ?? 0.5) * 100); $("#shotNote").textContent = s.ref ? "" : "no photo yet: Photo… or Ctrl+V"; }
}
function frameOrbit() {
  const b = SG.bounds2(ST.street) || [-20, -20, 20, 20];
  ST.orbit.t = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 0]; ST.orbit.dist = clamp(Math.hypot(b[2] - b[0], b[3] - b[1]) * 1.1, 20, 600);
  ST.walk.x = ST.orbit.t[0]; ST.walk.y = b[1] + 3;
}
let inspTimer = 0;
const inspectSoon = () => { clearTimeout(inspTimer); inspTimer = setTimeout(inspect, 200); };

// ---- the map: the street from above (an SVG redrawn on every change) ---------------------------------------------
const svg = $("#map");
let MW = 800, MH = 600;
const W2S = (x, y) => [(x - ST.view.cx) * ST.view.s + MW / 2, (ST.view.cy - y) * ST.view.s + MH / 2];
const S2W = (px, py) => [(px - MW / 2) / ST.view.s + ST.view.cx, ST.view.cy - (py - MH / 2) / ST.view.s];
const pts = P => P.map(p => W2S(p[0], p[1]).map(v => v.toFixed(1)).join(",")).join(" ");
function frameMap() {
  const b = SG.bounds2(ST.street) || [-20, -20, 20, 20], box = svg.getBoundingClientRect();
  MW = box.width || 800; MH = box.height || 600;
  ST.view.cx = (b[0] + b[2]) / 2; ST.view.cy = (b[1] + b[3]) / 2;
  ST.view.s = clamp(Math.min(MW / (b[2] - b[0] + 16), MH / (b[3] - b[1] + 16)), 1.5, 80);
}
const THING_COLOURS = { Lights: "#e8c060", "Poles and wires": "#b0aca4", "Shop and street": "#7fb3d5", Road: "#e08a50", People: "#d58fb5" };
const FENCE_COLOURS = { mesh: "#9aa3aa", wood: "#a0784f", panel: "#c6cacd", block: "#a6a39c", blockmesh: "#a6a39c", rail: "#7d8288", bamboo: "#b4a36a", slats: "#8a6a4a" };
function drawMap() {
  if (!ST.street) return;
  const box = svg.getBoundingClientRect(); MW = box.width || MW; MH = box.height || MH;
  const S = ST.street, out = [], s = ST.view.s, sel = ST.sel || {};
  // the grid: 1 m when close, 10 m always
  const [x0, y1] = S2W(0, 0), [x1, y0] = S2W(MW, MH);
  for (const step of s > 9 ? [1, 10] : [10]) {
    const c = step === 10 ? "#26262c" : "#1c1c21";
    for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) { const [px] = W2S(x, 0); out.push(`<line x1="${px}" y1="0" x2="${px}" y2="${MH}" stroke="${c}"/>`); }
    for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) { const [, py] = W2S(0, y); out.push(`<line x1="0" y1="${py}" x2="${MW}" y2="${py}" stroke="${c}"/>`); }
  }
  // roads: the walks first, then every carriageway over them (a crossing shows as road); a strip along a road's curve
  const paths = S.roads.map(r => [r, SG.roadPath(r)]);
  const band = (f, q0, q1) => f.S.map(sv => f.at(sv, q0)).concat(f.S.slice().reverse().map(sv => f.at(sv, q1)));
  const along = (f, q) => f.S.map(sv => W2S(...f.at(sv, q)).map(v => v.toFixed(1)).join(",")).join(" ");
  for (const [r, f] of paths) for (const [side, ww] of [[1, f.walks[0]], [-1, f.walks[1]]]) if (ww > 0.01)
    out.push(`<polygon points="${pts(band(f, side * f.W / 2, side * (f.W / 2 + ww)))}" fill="#4f4c47" data-list="roads" data-id="${esc(r.id)}"/>`);
  for (const [r, f] of paths) {
    const on = sel.list === "roads" && sel.id === r.id;
    out.push(`<polygon points="${pts(band(f, -f.W / 2, f.W / 2))}" fill="#2f3237" stroke="${on ? "#d9a441" : "none"}" stroke-width="2" data-list="roads" data-id="${esc(r.id)}"/>`);
    if (r.centre && r.centre !== "none") out.push(`<polyline points="${along(f, 0)}" fill="none" stroke="${r.centre === "yellow" ? "#d89a3a" : "#bbb"}" stroke-dasharray="${r.centre === "dashed" ? `${5 * s},${5 * s}` : "none"}" stroke-width="1" pointer-events="none"/>`);
    const [el0, er0] = Array.isArray(r.edge) ? r.edge : [r.edge || 0, r.edge || 0];
    for (const [q, on2] of [[f.W / 2 - el0, el0 > 0], [-f.W / 2 + er0, er0 > 0]]) if (on2) out.push(`<polyline points="${along(f, q)}" fill="none" stroke="#ddd" stroke-width="1" pointer-events="none"/>`);
    for (const m of r.marks || []) { const [mx, my] = W2S(...f.at((+m.at || 0) + 0.5, -(+m.x || 0))); out.push(`<text x="${mx}" y="${my}" font-size="10" fill="#eee" text-anchor="middle">${esc(m.kind === "text" ? m.text || "止まれ" : m.kind === "stop" ? "▬" : m.kind === "zebra" ? "▥" : m.kind === "diamond" ? "◇" : "↑")}</text>`); }
    const pz = SG.roadPoints(r), sloped = pz.some(p => Math.abs(p[2]) > 1e-3);
    if (s > 3) { const [mx, my] = W2S(...f.at(f.L / 2, 0)); out.push(`<text x="${mx}" y="${my - 4}" font-size="11" fill="#8a8a92" text-anchor="middle">${esc(r.name || r.id)}</text>`); }
    if (on) {                                                         // its points (drag; double-click a bend to take it out) and, between them, a dot that adds one
      const ctl = roadCtl(r), sOf = ctl.map(c => f.nearest(c[0], c[1]).s);
      for (let i = 0; i + 1 < ctl.length; i++) { const [hx, hy] = W2S(...f.at((sOf[i] + sOf[i + 1]) / 2, 0)); out.push(`<circle cx="${hx}" cy="${hy}" r="5" fill="#141417" stroke="#d9a441" stroke-width="1.5" data-handle="mid${i}" style="cursor:copy"><title>drag to bend the street here</title></circle>`); }
      ctl.forEach((c, i) => { const [hx, hy] = W2S(c[0], c[1]); out.push(`<circle cx="${hx}" cy="${hy}" r="${i === 0 || i === ctl.length - 1 ? 7 : 6}" fill="#d9a441" stroke="#000" data-handle="pt${i}" style="cursor:move"><title>${i === 0 ? "its start" : i === ctl.length - 1 ? "its end" : "a bend: drag it, double-click to take it out"}${sloped ? ` (${r2(pz[i][2])} m up)` : ""}</title></circle>`); if (sloped && s > 2) out.push(`<text x="${hx + 9}" y="${hy - 6}" font-size="10" fill="#d9a441">${r2(pz[i][2])} m</text>`); });
      const [hx, hy] = W2S(...f.at(f.L / 2, f.W / 2)); out.push(`<rect x="${hx - 5}" y="${hy - 5}" width="10" height="10" fill="#d9a441" stroke="#000" data-handle="width" style="cursor:ew-resize"><title>drag to widen</title></rect>`);
    }
  }
  // fences
  for (const fn of S.fences) {
    const [a, b] = [W2S(...fn.from), W2S(...fn.to)], on = sel.list === "fences" && sel.id === fn.id;
    out.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${on ? "#d9a441" : FENCE_COLOURS[fn.kind] || "#999"}" stroke-width="${on ? 5 : 3.5}" stroke-dasharray="${fn.kind === "mesh" || fn.kind === "blockmesh" ? "6,3" : "none"}" data-list="fences" data-id="${esc(fn.id)}" style="cursor:move"/>`);
    if (on) for (const h of ["from", "to"]) { const [hx, hy] = W2S(...fn[h]); out.push(`<circle cx="${hx}" cy="${hy}" r="6" fill="#d9a441" stroke="#000" data-handle="${h}" style="cursor:move"/>`); }
  }
  // buildings: the footprint, its front edge thick
  for (const b of S.buildings) {
    const fp = SG.footprint(b), on = sel.list === "buildings" && sel.id === b.id, col = (b.look && /^#/.test(b.look.wall || "") ? b.look.wall : "#bdb8ae");
    out.push(`<polygon points="${pts(fp)}" fill="${col}" fill-opacity="0.82" stroke="${on ? "#d9a441" : "#111"}" stroke-width="${on ? 2.5 : 1}" data-list="buildings" data-id="${esc(b.id)}" style="cursor:move"/>`);
    const [fa, fb] = [W2S(...fp[0]), W2S(...fp[1])];
    out.push(`<line x1="${fa[0]}" y1="${fa[1]}" x2="${fb[0]}" y2="${fb[1]}" stroke="${on ? "#d9a441" : "#e8e3d8"}" stroke-width="3" pointer-events="none"/>`);
    if (s > 2.5) { const [cx, cy] = W2S(...b.at); out.push(`<text x="${cx}" y="${cy + 4}" font-size="${clamp(s * 1.3, 9, 13)}" fill="#141414" text-anchor="middle">${b.floors || 1}F</text>`); }
    if (on) {
      fp.forEach((c, i) => { const [hx, hy] = W2S(...c); out.push(`<rect x="${hx - 5}" y="${hy - 5}" width="10" height="10" fill="#d9a441" stroke="#000" data-handle="c${i}" style="cursor:nwse-resize"/>`); });
      const [rx, ry] = W2S(...SG.place([0, -b.d / 2 - Math.max(1.5, 18 / s), 0], b));
      out.push(`<circle cx="${rx}" cy="${ry}" r="6" fill="#6fb3d9" stroke="#000" data-handle="rot" style="cursor:grab"><title>drag to turn (Shift: free)</title></circle>`);
    }
  }
  // wires between poles
  for (const t of S.things) if (t.kind === "pole" && t.to) { const q = S.things.find(x => x.id === t.to); if (q) { const [a, b] = [W2S(...t.at), W2S(...q.at)]; out.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#555" stroke-width="1" pointer-events="none"/>`); } }
  // things
  for (const t of S.things) {
    const K = SG.THING_KINDS[t.kind] || {}, [cx, cy] = W2S(...t.at), on = sel.list === "things" && sel.id === t.id, r = Math.max(4, 0.35 * s);
    const [fx, fy] = W2S(...SG.place([0, -Math.max(0.8, 10 / s), 0], t));
    out.push(`<line x1="${cx}" y1="${cy}" x2="${fx}" y2="${fy}" stroke="${on ? "#d9a441" : "#666"}" stroke-width="1" pointer-events="none"/>`);
    out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${THING_COLOURS[K.cat] || "#aaa"}" stroke="${on ? "#d9a441" : "#111"}" stroke-width="${on ? 2.5 : 1}" data-list="things" data-id="${esc(t.id)}" style="cursor:move"><title>${esc(K.label || t.kind)} (${esc(t.id)})</title></circle>`);
    if (s > 7) out.push(`<text x="${cx}" y="${cy + 3}" font-size="8" fill="#111" text-anchor="middle">${esc((K.label || t.kind)[0])}</text>`);
    if (on) out.push(`<circle cx="${fx}" cy="${fy}" r="5" fill="#6fb3d9" stroke="#000" data-handle="rot" style="cursor:grab"/>`);
  }
  // shots: the eye and what it sees
  for (const sh of S.shots) {
    const on = sel.list === "shots" && sel.id === sh.id, [ex, ey] = W2S(sh.eye[0], sh.eye[1]);
    const d = [sh.look[0] - sh.eye[0], sh.look[1] - sh.eye[1]], yaw = Math.atan2(d[0], d[1]), hf = Math.atan(Math.tan(rad(sh.vfov || 60) / 2) * shotAspect(sh)), L = 14;
    const a = W2S(sh.eye[0] + Math.sin(yaw - hf) * L, sh.eye[1] + Math.cos(yaw - hf) * L), b = W2S(sh.eye[0] + Math.sin(yaw + hf) * L, sh.eye[1] + Math.cos(yaw + hf) * L);
    out.push(`<polygon points="${ex},${ey} ${a[0]},${a[1]} ${b[0]},${b[1]}" fill="#6fb3d9" fill-opacity="${on ? 0.25 : 0.12}" stroke="#6fb3d9" stroke-width="${on ? 1.5 : 0.7}" pointer-events="none"/>`);
    out.push(`<rect x="${ex - 6}" y="${ey - 6}" width="12" height="12" rx="2" fill="#6fb3d9" stroke="${on ? "#d9a441" : "#000"}" stroke-width="${on ? 2 : 1}" data-list="shots" data-id="${esc(sh.id)}" style="cursor:move"><title>shot ${esc(sh.name || sh.id)}</title></rect>`);
    if (on) { const [lx, ly] = W2S(sh.look[0], sh.look[1]); out.push(`<circle cx="${lx}" cy="${ly}" r="6" fill="#6fb3d9" stroke="#000" data-handle="look" style="cursor:grab"><title>where it looks</title></circle>`); }
  }
  // the 3D view's eye
  { const e = eyeNow(), [ex, ey] = W2S(e[0], e[1]); const yaw = ST.mode === "walk" ? ST.walk.yaw : ST.mode === "orbit" ? ST.orbit.yaw : null;
    if (!ST.mode.startsWith("shot:")) { out.push(`<circle cx="${ex}" cy="${ey}" r="4" fill="#e08bb0" pointer-events="none"/>`); if (yaw !== null) { const [fx, fy] = W2S(e[0] + Math.sin(yaw) * 3, e[1] + Math.cos(yaw) * 3); out.push(`<line x1="${ex}" y1="${ey}" x2="${fx}" y2="${fy}" stroke="#e08bb0" stroke-width="1.5" pointer-events="none"/>`); } } }
  // what a click would place
  if (ghost) out.push(ghost);
  // a scale bar
  const bar = s > 20 ? 1 : s > 5 ? 5 : s > 2 ? 10 : 50;
  out.push(`<line x1="12" y1="${MH - 14}" x2="${12 + bar * s}" y2="${MH - 14}" stroke="#aaa" stroke-width="2"/><text x="${14 + bar * s}" y="${MH - 10}" font-size="11" fill="#aaa">${bar} m</text>`);
  svg.innerHTML = out.join("");
}
let ghost = "";
const roadCtl = r => [r.from, ...(Array.isArray(r.via) ? r.via : []), r.to];

// snapping: a building faces the nearest street, its front on the pavement's back edge, its sides against its neighbours
function nearRoad(x, y, reach = 8) {
  let best = null;
  for (const r of ST.street.roads) {
    const f = SG.roadPath(r), nq = f.nearest(x, y);
    if (nq.s < -reach || nq.s > f.L + reach) continue;
    const side = nq.q >= 0 ? 1 : -1, edge = f.W / 2 + f.walks[side > 0 ? 0 : 1], d = Math.abs(nq.q) - edge;
    if (d > reach) continue;
    if (!best || Math.abs(d) < Math.abs(best.d)) best = { r, f, s: nq.s, q: nq.q, side, edge, d };
  }
  return best;
}
const facing = (dx, dy) => r1(deg(Math.atan2(dx, -dy)));               // the turn that points a piece's front along (dx, dy)
const snapV = v => Math.round(v / ST.snap) * ST.snap;
function snapBuilding(b, x, y, free) {
  if (free) { b.at = [snapV(x), snapV(y)]; return; }
  const nr = nearRoad(x, y, b.d + 6);
  if (!nr) { b.at = [snapV(x), snapV(y)]; return; }
  const { f, side, edge } = nr, q = side * (edge + b.d / 2 + (+b.setback || 0));
  let sv = snapV(nr.s);
  // against a neighbour on the same side: within 0.8 m, touch it
  for (const o of ST.street.buildings) {
    if (o === b || o.id === b.id) continue;
    const on = f.nearest(o.at[0], o.at[1]);
    if (Math.sign(on.q) !== side || Math.abs(Math.abs(on.q) - Math.abs(q)) > 6) continue;
    const ohw = (Math.abs(Math.sin(rad(o.turn - b.turn))) > 0.5 ? o.d : o.w) / 2;
    for (const target of [on.s + ohw + b.w / 2, on.s - ohw - b.w / 2]) if (Math.abs(sv - target) < 0.8) sv = target;
  }
  const fr = f.frame(sv), p = f.at(sv, q);
  b.at = [r2(p[0]), r2(p[1])];
  b.turn = facing(-side * fr.n[0], -side * fr.n[1]);
}
const KERB_THINGS = new Set(["lamp", "lantern", "postlamp", "pole", "sign", "mirror", "bollard", "cone"]);
const WALL_THINGS = new Set(["vending", "postbox", "bike", "ac", "crates", "pot", "bin", "bench"]);
function snapThing(t, x, y, free) {
  const nr = !free && (KERB_THINGS.has(t.kind) || WALL_THINGS.has(t.kind)) ? nearRoad(x, y, 2.5) : null;
  if (!nr || nr.d > 0.3) { t.at = [snapV(x), snapV(y)]; return; }
  const { f, side } = nr, walk = f.walks[side > 0 ? 0 : 1];
  let q;
  if (KERB_THINGS.has(t.kind)) q = side * (f.W / 2 + Math.min(0.4, walk / 2));
  else q = side * (f.W / 2 + Math.max(walk / 2, walk - (t.kind === "vending" ? 0.42 : t.kind === "bike" ? 0.35 : 0.3)));
  const sv = snapV(nr.s), fr = f.frame(sv), p = f.at(sv, q);
  t.at = [r2(p[0]), r2(p[1])];
  t.turn = t.kind === "bike" ? r1(deg(Math.atan2(fr.t[1], fr.t[0]))) : t.kind === "pole" ? r1(deg(Math.atan2(fr.n[1], fr.n[0]))) : facing(-side * fr.n[0], -side * fr.n[1]);
}

// the map's mouse
let mdrag = null;
svg.addEventListener("contextmenu", e => e.preventDefault());
svg.addEventListener("pointerdown", e => {
  const [mx, my] = mouseMap(e), [wx, wy] = S2W(mx, my);
  svg.setPointerCapture(e.pointerId);
  if (ST.tool && e.button === 0) { mdrag = { kind: "place", from: [snapV(wx), snapV(wy)], x0: mx, y0: my }; return; }
  const h = e.target.getAttribute("data-handle"), id = e.target.getAttribute("data-id"), list = e.target.getAttribute("data-list");
  if (h && ST.sel && e.button === 0) {
    pushUndo();
    let hh = h;
    if (/^mid\d+$/.test(h)) {                                         // a new bend between two points, held by the mouse
      const r = selected(), i = +h.slice(3), pz = SG.roadPoints(r);
      r.via = Array.isArray(r.via) ? r.via : [];
      r.via.splice(i, 0, [r2(wx), r2(wy)]);
      if (pz.some(q => Math.abs(q[2]) > 1e-6)) { const z = SG.roadPoints(Object.assign({}, r, { z: [pz[0][2], pz[pz.length - 1][2]] })); r.z = pz.map(q => r2(q[2])); r.z.splice(i + 1, 0, r2((pz[i][2] + pz[i + 1][2]) / 2)); void z; }
      hh = "pt" + (i + 1);
    }
    mdrag = { kind: "handle", h: hh, sel: ST.sel, orig: JSON.parse(JSON.stringify(selected())), w0: [wx, wy] };
    return;
  }
  if (id && e.button === 0) {
    if (!ST.sel || ST.sel.id !== id || ST.sel.list !== list) select({ list, id });
    mdrag = { kind: "move", list, id, orig: JSON.parse(JSON.stringify(find({ list, id }))), w0: [wx, wy], pushed: false };
    return;
  }
  mdrag = { kind: "pan", x0: mx, y0: my, v: { ...ST.view }, moved: false };
});
svg.addEventListener("pointermove", e => {
  const [mx, my] = mouseMap(e), [wx, wy] = S2W(mx, my);
  if (ST.tool && (!mdrag || mdrag.kind === "place")) { ghost = ghostOf(wx, wy, mdrag && mdrag.kind === "place" ? mdrag.from : null); drawMap(); }
  if (!mdrag) return;
  if (mdrag.kind === "pan") {
    if (Math.abs(mx - mdrag.x0) + Math.abs(my - mdrag.y0) > 3) mdrag.moved = true;
    ST.view.cx = mdrag.v.cx - (mx - mdrag.x0) / ST.view.s; ST.view.cy = mdrag.v.cy + (my - mdrag.y0) / ST.view.s; drawMap(); return;
  }
  if (mdrag.kind === "move") {
    const p = find(mdrag); if (!p) return;
    const dx = wx - mdrag.w0[0], dy = wy - mdrag.w0[1];
    if (!mdrag.pushed) { if (Math.hypot(dx, dy) * ST.view.s < 3) return; pushUndo(); mdrag.pushed = true; }
    const o = mdrag.orig;
    if (mdrag.list === "buildings") snapBuilding(Object.assign(p, { turn: o.turn }), o.at[0] + dx, o.at[1] + dy, e.altKey);
    else if (mdrag.list === "things") snapThing(Object.assign(p, { turn: o.turn }), o.at[0] + dx, o.at[1] + dy, e.altKey);
    else if (mdrag.list === "roads" || mdrag.list === "fences") { const d = [snapV(dx), snapV(dy)]; p.from = [r2(o.from[0] + d[0]), r2(o.from[1] + d[1])]; p.to = [r2(o.to[0] + d[0]), r2(o.to[1] + d[1])]; if (o.via) p.via = o.via.map(v => [r2(v[0] + d[0]), r2(v[1] + d[1])]); }
    else if (mdrag.list === "shots") { const d = [snapV(dx), snapV(dy)]; p.eye = [r2(o.eye[0] + d[0]), r2(o.eye[1] + d[1]), o.eye[2]]; p.look = [r2(o.look[0] + d[0]), r2(o.look[1] + d[1]), o.look[2]]; }
    changed({ soon: true, inspector: false }); return;
  }
  if (mdrag.kind === "handle") { dragHandle(mdrag, wx, wy, e); changed({ soon: true, inspector: false }); }
});
svg.addEventListener("pointerup", e => {
  const d = mdrag; mdrag = null;
  if (!d) return;
  const [mx, my] = mouseMap(e), [wx, wy] = S2W(mx, my);
  if (d.kind === "pan" && !d.moved && e.button === 0) select(null);
  if (d.kind === "place") { placeTool(d.from, [snapV(wx), snapV(wy)], Math.hypot(mx - d.x0, my - d.y0) > 6, e); return; }
  if (d.kind === "move" || d.kind === "handle") { inspect(); rebuild(); }
});
svg.addEventListener("pointerleave", () => { if (ghost) { ghost = ""; drawMap(); } });
svg.addEventListener("wheel", e => {
  e.preventDefault();
  const [mx, my] = mouseMap(e), [wx, wy] = S2W(mx, my);
  ST.view.s = clamp(ST.view.s * (e.deltaY > 0 ? 1 / 1.15 : 1.15), 0.8, 120);
  const [nx, ny] = S2W(mx, my); ST.view.cx += wx - nx; ST.view.cy += wy - ny; drawMap();
}, { passive: false });
svg.addEventListener("dblclick", e => {                              // (the pointer is captured: find what's under it)
  const under = document.elementsFromPoint(e.clientX, e.clientY), bend = under.find(x => x.getAttribute && /^pt\d+$/.test(x.getAttribute("data-handle") || ""));
  if (bend && ST.sel && ST.sel.list === "roads") {
    const r = selected(), i = +bend.getAttribute("data-handle").slice(2), n = roadCtl(r).length;
    if (i > 0 && i < n - 1) { pushUndo(); r.via.splice(i - 1, 1); if (Array.isArray(r.z) && r.z.length === n) r.z.splice(i, 1); if (!r.via.length) delete r.via; changed(); }
    return;
  }
  const t = under.find(x => x.getAttribute && x.getAttribute("data-list") === "buildings");
  if (t) { select({ list: "buildings", id: t.getAttribute("data-id") }); tab("facade"); }
});
function mouseMap(e) { const r = svg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function dragHandle(d, wx, wy, e) {
  const p = find(d.sel), o = d.orig; if (!p) return;
  if (d.sel.list === "buildings") {
    if (d.h === "rot") { let t = deg(Math.atan2(wx - o.at[0], -(wy - o.at[1]))); if (!e.shiftKey) t = Math.round(t / 15) * 15; p.turn = r1(t); return; }
    const k = +d.h.slice(1), opp = SG.footprint(o)[(k + 2) % 4];        // the far corner stays put
    const a = rad(o.turn || 0), c = Math.cos(a), sn = Math.sin(a), lx = (wx - opp[0]) * c + (wy - opp[1]) * sn, ly = -(wx - opp[0]) * sn + (wy - opp[1]) * c;
    const w = Math.max(2, snapV(Math.abs(lx))), dd = Math.max(2, snapV(Math.abs(ly)));
    const mlx = Math.sign(lx || 1) * w / 2, mly = Math.sign(ly || 1) * dd / 2;
    p.w = r2(w); p.d = r2(dd); p.at = [r2(opp[0] + mlx * c - mly * sn), r2(opp[1] + mlx * sn + mly * c)];
    return;
  }
  if (d.sel.list === "things" && d.h === "rot") { let t = deg(Math.atan2(wx - o.at[0], -(wy - o.at[1]))); if (!e.shiftKey) t = Math.round(t / 15) * 15; p.turn = r1(t); return; }
  if (d.sel.list === "roads" && /^pt\d+$/.test(d.h)) {                    // one of its points: the ends snap to another road's
    const i = +d.h.slice(2), ctl = roadCtl(p), last = ctl.length - 1;
    let pt = [snapV(wx), snapV(wy)], z = null;
    if (!e.altKey && (i === 0 || i === last)) for (const r of ST.street.roads) if (r.id !== p.id) {
      for (const [k, c] of roadCtl(r).entries()) if (Math.hypot(c[0] - wx, c[1] - wy) < 1.5) { pt = c.slice(0, 2); z = SG.roadPoints(r)[k][2]; }
      if (z === null) { const f = SG.roadPath(r), nq = f.nearest(wx, wy); if (nq.s > 0 && nq.s < f.L && Math.abs(nq.q) < 1.2) { const c = f.at(nq.s, 0); pt = [r2(c[0]), r2(c[1])]; z = nq.z; } }
    }
    if (i === 0) p.from = pt; else if (i === last) p.to = pt; else p.via[i - 1] = pt;
    if (z !== null && Math.abs(z) > 1e-6) { p.z = SG.roadPoints(p).map(q => r2(q[2])); p.z[i] = r2(z); }
    return;
  }
  if ((d.sel.list === "roads" || d.sel.list === "fences") && (d.h === "from" || d.h === "to")) {
    let pt = [snapV(wx), snapV(wy)];
    if (!e.altKey) for (const r of ST.street.roads) if (r.id !== p.id) for (const end of [r.from, r.to]) if (Math.hypot(end[0] - wx, end[1] - wy) < 1.5) pt = end.slice();
    const other = d.h === "from" ? p.to : p.from;
    if (e.shiftKey) { const dx = pt[0] - other[0], dy = pt[1] - other[1]; if (Math.abs(dx) > Math.abs(dy)) pt[1] = other[1]; else pt[0] = other[0]; }
    p[d.h] = [r2(pt[0]), r2(pt[1])]; return;
  }
  if (d.sel.list === "roads" && d.h === "width") { const q = Math.abs(SG.roadPath(o).nearest(wx, wy).q); p.width = r2(Math.max(2, snapV(q * 2))); return; }
  if (d.sel.list === "shots" && d.h === "look") { p.look = [r2(wx), r2(wy), o.look[2]]; }
}

// ---- placing: the palette's tools ------------------------------------------------------------------------------------
function setTool(t) {
  ST.tool = t; ghost = "";
  for (const b of document.querySelectorAll(".pal button, #facadeBar button")) b.classList.toggle("tool", !!t && b.dataset.tool === toolKey(t));
  $("#centreHint").textContent = t ? (t.what === "part" ? `click on the front or the side to put ${PARTS_A(t.kind)} there (Esc stops)` : t.what === "road" || t.what === "fence" ? "drag on the map from one end to the other (or click for one 30 m long); Esc stops" : `click on the map to put it there; it turns to face the street (Alt: free); Esc stops`) : "";
  drawMap();
}
const PARTS_A = k => "a " + (SG.PART_KINDS[k] || {}).label?.toLowerCase();
const toolKey = t => t ? [t.what, t.kind || t.style || ""].join(":") : "";
function ghostOf(wx, wy, from) {
  const t = ST.tool; if (!t) return "";
  if (t.what === "road" || t.what === "fence") {
    if (!from) { const [x, y] = W2S(wx, wy); return `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#d9a441"/>`; }
    const [a, b] = [W2S(...from), W2S(snapV(wx), snapV(wy))];
    return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#d9a441" stroke-width="${t.what === "road" ? Math.max(3, (t.width || 6) * ST.view.s) : 3}" stroke-opacity="0.5" pointer-events="none"/>`;
  }
  if (t.what === "building") { const b = Object.assign({ id: "_ghost", turn: 0 }, t.proto); snapBuilding(b, wx, wy, false); return `<polygon points="${pts(SG.footprint(b))}" fill="#d9a441" fill-opacity="0.3" stroke="#d9a441" pointer-events="none"/>`; }
  if (t.what === "thing") { const th = { kind: t.kind, turn: 0 }; snapThing(th, wx, wy, false); const [x, y] = W2S(...th.at); return `<circle cx="${x}" cy="${y}" r="${Math.max(4, 0.35 * ST.view.s)}" fill="#d9a441" fill-opacity="0.5" pointer-events="none"/>`; }
  return "";
}
function placeTool(from, to, dragged, e) {
  const t = ST.tool; if (!t) return;
  pushUndo();
  let sel = null;
  if (t.what === "road") {
    if (!dragged) to = [from[0], from[1] + 30];
    const r = Object.assign({ id: newId("road"), from, to }, JSON.parse(JSON.stringify(t.proto)));
    ST.street.roads.push(r); sel = { list: "roads", id: r.id };
  } else if (t.what === "fence") {
    if (!dragged) to = [from[0] + 6, from[1]];
    const f = { id: newId("fence"), kind: t.kind, from, to }; ST.street.fences.push(f); sel = { list: "fences", id: f.id };
  } else if (t.what === "building") {
    const b = Object.assign({ id: newId("b") }, JSON.parse(JSON.stringify(t.proto)), { turn: 0 });
    snapBuilding(b, from[0], from[1], e.altKey); ST.street.buildings.push(b); sel = { list: "buildings", id: b.id };
    t.proto = SP.makeBuilding(t.style, Math.floor(Math.random() * 1e9));   // the next one differs
  } else if (t.what === "thing") {
    const th = Object.assign({ id: newId(t.kind) , kind: t.kind, turn: 0 }, t.extra || {});
    snapThing(th, from[0], from[1], e.altKey); ST.street.things.push(th); sel = { list: "things", id: th.id };
  }
  if (!e.shiftKey) setTool(null);
  ST.sel = sel; changed();
}

// ---- the palette (left) ------------------------------------------------------------------------------------------------
const ROADS = {
  street: { label: "Street", note: "two ways, a pavement each side", proto: { width: 6, walks: [2, 2], kerb: 0.15, edge: [0, 0], centre: "dashed", marks: [] } },
  lane: { label: "Lane", note: "one way, narrow: a white line for walkers, a pavement on one side", proto: { width: 4.6, walks: [0, 1.8], kerb: 0.15, edge: [0.8, 0], centre: "none", marks: [] } },
  alley: { label: "Alley", note: "no pavements, no lines", proto: { width: 3.2, walks: [0, 0], kerb: 0.15, edge: [0, 0], centre: "none", marks: [] } },
  avenue: { label: "Wide road", note: "two lanes each way, wide pavements", proto: { width: 12, walks: [3.5, 3.5], kerb: 0.18, edge: [0.6, 0.6], centre: "yellow", marks: [] } },
  oldroad: { label: "Old town road", note: "stone setts, a gutter each side, no kerb", proto: { width: 6.5, walks: [0.6, 0.6], kerb: 0.05, edge: [0, 0], centre: "none", surface: "asphalt", walk: "gravel", marks: [] } },
};
function palette() {
  const L = $("#left"); L.innerHTML = "";
  const btn = (t, label, title, colour) => el("button", { "data-tool": toolKey(t), title, on: { click: () => setTool(ST.tool && toolKey(ST.tool) === toolKey(t) ? null : t) } }, colour ? el("i", { style: `background:${colour}` }) : null, label);
  L.append(el("h2", {}, "Streets"), el("div", { class: "pal" }, ...Object.entries(ROADS).map(([k, R]) => btn({ what: "road", kind: k, proto: R.proto, width: R.proto.width }, R.label, R.note, "#3a3d42"))));
  L.append(el("h2", {}, "Buildings"), el("div", { class: "pal" }, ...Object.entries(SP.STYLES).map(([k, S]) => btn({ what: "building", style: k, proto: SP.makeBuilding(k, 7 + k.length) }, S.label, `${S.note} (after ${S.ref})`, "#bdb8ae"))));
  const cats = {};
  for (const [k, K] of Object.entries(SG.THING_KINDS)) (cats[K.cat] = cats[K.cat] || []).push([k, K]);
  for (const [cat, list] of Object.entries(cats)) L.append(el("h2", {}, cat), el("div", { class: "pal" }, ...list.map(([k, K]) => btn({ what: "thing", kind: k }, K.label, K.note, THING_COLOURS[cat]))));
  L.append(el("h2", {}, "Fences and walls"), el("div", { class: "pal" }, ...Object.entries(SG.FENCE_KINDS).map(([k, K]) => btn({ what: "fence", kind: k }, K.label, K.note, FENCE_COLOURS[k]))));
  const mix = el("select", { id: "mix" }, ...Object.entries(SP.MIXES).map(([k, M]) => new Option(M.label, k)));
  L.append(el("h2", {}, "Fill a street"), el("div", { class: "hint" }, "Pick a street, then:"),
    el("div", { class: "prop" }, el("label", {}, "kind"), mix),
    el("div", { class: "pal one", style: "margin-top:4px" },
      el("button", { title: "Both sides of the picked street lined with buildings of this kind, shoulder to shoulder (skips what's already there)", on: { click: () => fillStreet($("#mix").value, { buildings: true }) } }, "Buildings both sides"),
      el("button", { title: "Lamps along both kerbs (lanterns on a shopping street)", on: { click: () => fillStreet($("#mix").value, { lamps: true }) } }, "Lamps along it"),
      el("button", { title: "Utility poles down one side with their wires", on: { click: () => fillStreet($("#mix").value, { poles: true }) } }, "Poles and wires"),
      el("button", { title: "The clutter of a lived-in street: bikes, machines, pots, crates, AC units...", on: { click: () => fillStreet($("#mix").value, { clutter: true }) } }, "Clutter (bikes, pots...)"),
      el("button", { class: "primary", title: "All of it at once", on: { click: () => fillStreet($("#mix").value, { buildings: true, lamps: true, poles: true, clutter: true }) } }, "Fill it all")));
  L.append(el("h2", {}, "Keys"), el("div", { class: "hint" }, el("kbd", {}, "Del"), " removes, ", el("kbd", {}, "R"), " turns, ", el("kbd", {}, "Ctrl+D"), " copies, arrows nudge, ", el("kbd", {}, "Ctrl+V"), " pastes a photo, ", el("kbd", {}, "Esc"), " stops placing; double-click a building for its facade."));
}

// ---- filling a street: buildings shoulder to shoulder, lamps, poles and wires, clutter ------------------------------
const sat = (A, B) => {                                               // two convex polygons overlap (separating axes)
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], n = [b[1] - a[1], a[0] - b[0]];
    const pa = A.map(p => p[0] * n[0] + p[1] * n[1]), pb = B.map(p => p[0] * n[0] + p[1] * n[1]);
    if (Math.max(...pa) <= Math.min(...pb) + 1e-6 || Math.max(...pb) <= Math.min(...pa) + 1e-6) return false;
  }
  return true;
};
const shrink = (P, k) => { const c = [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length]; return P.map(p => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k]); };
// a road's corridor (carriageway and pavements) as convex pieces, one between each two of its points
function roadQuads(r) { const f = SG.roadPath(r), a = -f.W / 2 - f.walks[1], b = f.W / 2 + f.walks[0], out = []; for (let i = 0; i + 1 < f.S.length; i++) out.push([f.at(f.S[i], a), f.at(f.S[i + 1], a), f.at(f.S[i + 1], b), f.at(f.S[i], b)].map(p => [p[0], p[1]])); return out; }
function fillStreet(mix, what) {
  const r = ST.sel && ST.sel.list === "roads" ? selected() : ST.street.roads.length === 1 ? ST.street.roads[0] : null;
  if (!r) { toast("Pick a street first (click it on the map)"); return; }
  pushUndo();
  const f = SG.roadPath(r), R = SG.rng((Date.now() & 0xffffff) ^ 0x5eed), E = SP.EDGES[mix] || SP.EDGES.city, made = { buildings: 0, things: 0 };
  const P = (sv, q) => { const p = f.at(sv, q); return [r2(p[0]), r2(p[1])]; }, N = sv => f.frame(sv).n, T = sv => f.frame(sv).t;
  const quads = ST.street.roads.map(o => [o, roadQuads(o)]);
  const blocked = (poly, self) => quads.some(([, Q]) => Q.some(q => sat(shrink(poly, 0.98), q))) || ST.street.buildings.some(o => o !== self && sat(shrink(poly, 0.98), SG.footprint(o)));
  if (what.buildings) for (const side of [1, -1]) {
    const edge = f.W / 2 + f.walks[side > 0 ? 0 : 1];
    let sv = 0.3;
    while (sv < f.L - 3) {
      const style = SP.pickStyle(R, mix), b = Object.assign({ id: newId("b") }, SP.makeBuilding(style, Math.floor(R() * 1e9), { abandoned: mix === "abandoned" }));
      if (sv + b.w > f.L - 0.2) b.w = r2(Math.max(3.5, f.L - 0.2 - sv));
      if (sv + b.w > f.L - 0.2) break;
      const q = side * (edge + b.d / 2 + (R() < 0.25 ? r2(R() * 0.4) : 0));
      const n = N(sv + b.w / 2); b.at = P(sv + b.w / 2, q); b.turn = facing(-side * n[0], -side * n[1]);
      if (blocked(SG.footprint(b), b)) { sv += 1; continue; }
      ST.street.buildings.push(b); made.buildings++;
      sv += b.w + (R() < 0.3 ? r2(R() * 0.5) : 0.02);
    }
  }
  const thing = (kind, sv, q, turn, extra = {}) => { const t = Object.assign({ id: newId(kind), kind, at: P(sv, q), turn }, extra); ST.street.things.push(t); made.things++; return t; };
  if (what.lamps) for (const side of [1, -1]) {
    const walk = f.walks[side > 0 ? 0 : 1], q = side * (f.W / 2 + (walk > 0.3 ? Math.min(0.4, walk / 2) : -0.3));
    for (let sv = E.every / 2 + (side < 0 ? E.every / 2 : 0); sv < f.L - 1; sv += E.every) thing(E.lamp, sv, q, facing(-side * N(sv)[0], -side * N(sv)[1]), E.lamp === "lantern" ? { text: "" } : {});
  }
  if (what.poles && E.poles) {
    const side = f.walks[0] >= f.walks[1] ? 1 : -1, walk = f.walks[side > 0 ? 0 : 1], q = side * (f.W / 2 + (walk > 0.3 ? Math.min(0.45, walk / 2) : -0.35));
    let prev = null;
    for (let sv = 4; sv < f.L - 2; sv += 26) { const t = thing("pole", sv, q, r1(deg(Math.atan2(N(sv)[1], N(sv)[0]))), { trans: R() < 0.3 }); if (prev) prev.to = t.id; prev = t; }
  }
  if (what.clutter) for (const side of [1, -1]) {
    const walk = f.walks[side > 0 ? 0 : 1], back = f.W / 2 + walk;
    for (let sv = 2 + R() * 4; sv < f.L - 2; sv += 2.5 + R() * 6) {
      const kind = E.clutter[Math.floor(R() * E.clutter.length)];
      const t = { kind, turn: 0 }; const q = side * (walk > 0.5 ? back - (kind === "vending" ? 0.42 : 0.35) : f.W / 2 - 0.4);
      const turn = kind === "bike" ? r1(deg(Math.atan2(T(sv)[1], T(sv)[0]))) : facing(-side * N(sv)[0], -side * N(sv)[1]);
      void t; thing(kind, sv, q, turn, kind === "crates" ? { n: 1 + Math.floor(R() * 3) } : kind === "car" ? { style: "van" } : {});
    }
  }
  toast(`made ${made.buildings} buildings and ${made.things} things along ${r.id}`);
  changed();
}

// ---- the facade view: the picked building's front and a side, flat on ---------------------------------------------
const PANELS = [...document.querySelectorAll(".panel")].map((rootEl, i) => {
  const P = { i, root: rootEl, view: rootEl.querySelector(".pview"), canvas: rootEl.querySelector("canvas"), svg: rootEl.querySelector("svg"), img: rootEl.querySelector("img.ref"),
    face: i === 0 ? "front" : "right", vs: null, key: null, moving: false };
  P.renderer = new THREE.WebGLRenderer({ canvas: P.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  P.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  P.renderer.toneMapping = THREE.AgXToneMapping;
  const sel = rootEl.querySelector(".pface");
  for (const f of ["front", "right", "back", "left"]) sel.append(new Option(f, f));
  sel.value = P.face; sel.onchange = () => { P.face = sel.value; P.vs = null; renderFacades(); };
  const B = cls => rootEl.querySelector(cls);
  B(".ppaste").onclick = () => pasteFromClipboard(P);
  B(".pload").onclick = () => B(".pfile").click();
  B(".pfile").onchange = e => { const f = e.target.files[0]; if (f) setFaceRef(P, f); e.target.value = ""; };
  B(".pop").oninput = e => { const r = faceRef(P); if (r) { r.op = +e.target.value / 100; ST.dirty = true; drawPanel(P); } };
  B(".ptop").onchange = e => { const r = faceRef(P); if (r) { r.top = e.target.checked; ST.dirty = true; drawPanel(P); } };
  B(".pmove").onclick = () => { P.moving = !P.moving; B(".pmove").classList.toggle("on", P.moving); drawPanel(P); };
  B(".pfit").onclick = () => { const r = faceRef(P), b = selected(); if (!r || !b) return; pushUndo(); const fi = faceInfo(b, P.face); r.x = 0; r.z = 0; r.w = r2(fi.W); changed({ inspector: false }); };
  B(".pdrop").onclick = () => { const b = selected(); if (!b || !b.refs || !b.refs[P.face]) return; pushUndo(); delete b.refs[P.face]; changed({ inspector: false }); };
  P.view.addEventListener("pointerenter", () => { hoverPanel = P; });
  P.view.addEventListener("dragover", e => e.preventDefault());
  P.view.addEventListener("drop", e => { e.preventDefault(); const f = [...e.dataTransfer.files].find(x => x.type.startsWith("image/")); if (f) setFaceRef(P, f); });
  panelMouse(P);
  return P;
});
let hoverPanel = null;
const fscene = new THREE.Scene();
fscene.add(new THREE.HemisphereLight(0xf2f4f8, 0x55504a, 1.6));
const fsun = new THREE.DirectionalLight(0xffffff, 1.6); fscene.add(fsun, fsun.target);
let fgroup = null, fkey = "";
function faceInfo(b, name) {
  const fr = SG.faceFrames(-b.w / 2, -b.d / 2, b.w / 2, b.d / 2, 0)[name], fl = SG.floorsOf(b);
  return { F: fr, W: fr.W, H: fl.height, rows: fl.rows, tiers: fl.tiers };
}
const faceRef = P => { const b = selected(); return b && ST.sel.list === "buildings" && b.refs ? b.refs[P.face] : null; };
function facadeBuilding() {                                           // the picked building alone, at the middle, unturned
  const b = ST.sel && ST.sel.list === "buildings" ? selected() : null; if (!b) return null;
  const copy = Object.assign(JSON.parse(JSON.stringify(b)), { at: [0, 0], turn: 0 });
  const key = JSON.stringify(copy) + "|" + JSON.stringify(ST.street.look);
  if (key !== fkey) {
    if (fgroup) { fscene.remove(fgroup); dispose(fgroup); }
    const pieces = SG.build({ buildings: [copy], ground: false, look: ST.street.look });
    fgroup = S3.group({ buildings: [copy], look: ST.street.look }, pieces, mats, {}); fscene.add(fgroup); fkey = key;
  }
  return b;
}
function renderFacades() {
  if ($("#facadeBox").hidden) return;
  const b = facadeBuilding();
  for (const P of PANELS) drawPanel(P, b);
  $("#centreHint").textContent = ST.tool && ST.tool.what === "part" ? $("#centreHint").textContent : b ? `${b.id}: ${SP.STYLES[b.style]?.label || "building"}, ${b.floors} floors, ${r2(b.w)} × ${r2(b.d)} m · click a floor to set its windows, click a part to change it` : "pick a building on the map (or in the 3D view) to see its front and side";
}
function drawPanel(P, b = ST.sel && ST.sel.list === "buildings" ? selected() : null) {
  const W = P.view.clientWidth, H = P.view.clientHeight;
  sizeTo(P.renderer, W, H); P.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  P.root.querySelector(".pnote").textContent = b ? `${r2(faceInfo(b, P.face).W)} m wide` : "";
  if (!b) { P.renderer.clear(); P.svg.innerHTML = ""; P.img.style.display = "none"; return; }
  const fi = faceInfo(b, P.face), top = fi.H + ((b.roof && b.roof.kind && !["flat", "rail", "none"].includes(b.roof.kind)) ? 3 : 1.5);
  const key = b.id + P.face;
  if (!P.vs || P.key !== key) { P.key = key; const s = Math.min(W / (fi.W + 3), H / (top + 2)); P.vs = { uc: fi.W / 2, zc: top / 2, s }; }
  const vs = P.vs;
  // the camera: square on to the face from outside, orthographic, metres to pixels by vs.s
  const F = fi.F, mid = [F.o[0] + F.U[0] * vs.uc, F.o[1] + F.U[1] * vs.uc, vs.zc];
  const cam = new THREE.OrthographicCamera(-W / 2 / vs.s, W / 2 / vs.s, H / 2 / vs.s, -H / 2 / vs.s, 0.1, 300);
  cam.position.copy(S3.s2t(mid[0] + F.N[0] * 120, mid[1] + F.N[1] * 120, mid[2])); cam.up.set(0, 1, 0); cam.lookAt(S3.s2t(...mid)); cam.updateProjectionMatrix();
  fsun.position.copy(S3.s2t(mid[0] + F.N[0] * 40 - F.U[0] * 25, mid[1] + F.N[1] * 40 - F.U[1] * 25, mid[2] + 35)); fsun.target.position.copy(S3.s2t(...mid));
  P.renderer.setClearColor(0x000000, 0); P.renderer.render(fscene, cam);
  // the photo: under the building (the canvas is see-through round it) or over it
  const ref = b.refs && b.refs[P.face], u2x = u => (u - vs.uc) * vs.s + W / 2, z2y = z => H / 2 - (z - vs.zc) * vs.s;
  if (ref && ref.file) {
    const src = refUrl(ref.file);
    if (P.img.dataset.src !== src) { P.img.src = src; P.img.dataset.src = src; P.img.onload = () => drawPanel(P); }
    const asp = P.img.naturalWidth ? P.img.naturalHeight / P.img.naturalWidth : 0.75, wpx = ref.w * vs.s, hpx = wpx * asp;
    Object.assign(P.img.style, { display: "block", left: u2x(ref.x || 0) + "px", top: (z2y((ref.z || 0)) - hpx) + "px", width: wpx + "px", height: hpx + "px", opacity: ref.top ? (ref.op ?? 0.55) : 1, zIndex: ref.top ? 2 : 0 });
    P.canvas.style.zIndex = 1; P.canvas.style.opacity = ref.top ? 1 : (1 - (ref.op ?? 0.55) * 0.6);
    P.root.querySelector(".pop").value = Math.round((ref.op ?? 0.55) * 100); P.root.querySelector(".ptop").checked = !!ref.top;
  } else { P.img.style.display = "none"; P.canvas.style.opacity = 1; }
  P.svg.style.zIndex = 3;
  // the overlay: the outline, the floors, the parts, the handles
  const o = [], sel = ST.sel || {};
  o.push(`<rect x="${u2x(0)}" y="${z2y(fi.H)}" width="${fi.W * vs.s}" height="${fi.H * vs.s}" fill="none" stroke="#d9a44155" data-face="1"/>`);
  for (const r of fi.rows) {
    const y = z2y(r.z0), on = sel.face === P.face && sel.floor === r.k;
    o.push(`<rect x="${u2x(0)}" y="${z2y(r.z0 + r.h)}" width="${fi.W * vs.s}" height="${r.h * vs.s}" fill="${on ? "#d9a44122" : "transparent"}" stroke="${on ? "#d9a441" : "none"}" data-floor="${r.k}" style="cursor:pointer"/>`);
    o.push(`<line x1="${u2x(0) - 30}" y1="${y}" x2="${u2x(0)}" y2="${y}" stroke="#666" pointer-events="none"/><text x="${u2x(0) - 28}" y="${z2y(r.z0 + r.h / 2) + 4}" font-size="11" fill="#9a978f" pointer-events="none">${r.k}F</text>`);
  }
  (b.parts || []).forEach((p, i) => {
    if ((p.face || "front") !== P.face) return;
    for (const rc of partRects(b, p, fi)) {
      const on = sel.part === i;
      o.push(`<rect x="${u2x(rc[0])}" y="${z2y(rc[3])}" width="${Math.max(3, (rc[2] - rc[0]) * vs.s)}" height="${Math.max(3, (rc[3] - rc[1]) * vs.s)}" fill="${on ? "#d9a44133" : "#6fb3d911"}" stroke="${on ? "#d9a441" : "#6fb3d9aa"}" stroke-width="${on ? 2 : 1}" data-part="${i}" data-base="${rc[4]}" style="cursor:move"><title>${esc((SG.PART_KINDS[p.kind] || {}).label || p.kind)}${p.text ? ": " + esc(p.text) : ""}</title></rect>`);
      if (on) for (const [cx, cz, h] of [[rc[2], rc[3], "ne"], [rc[0], rc[1], "sw"], [rc[2], rc[1], "se"], [rc[0], rc[3], "nw"]]) o.push(`<rect x="${u2x(cx) - 5}" y="${z2y(cz) - 5}" width="10" height="10" fill="#d9a441" stroke="#000" data-phandle="${h}" data-base="${rc[4]}" style="cursor:nwse-resize"/>`);
    }
  });
  // the building's own handles: its top (floors) and its right edge (width)
  o.push(`<rect x="${u2x(fi.W / 2) - 16}" y="${z2y(fi.H) - 5}" width="32" height="10" rx="3" fill="#6fb3d9" stroke="#000" data-bhandle="top" style="cursor:ns-resize"><title>drag up or down: floors</title></rect>`);
  o.push(`<rect x="${u2x(fi.W) - 5}" y="${z2y(fi.H / 2) - 16}" width="10" height="32" rx="3" fill="#6fb3d9" stroke="#000" data-bhandle="right" style="cursor:ew-resize"><title>drag: ${P.face === "front" || P.face === "back" ? "width" : "depth"}</title></rect>`);
  if (ref && P.moving) {                                              // the photo's own handles while moving it
    const asp = P.img.naturalWidth ? P.img.naturalHeight / P.img.naturalWidth : 0.75, x = u2x(ref.x || 0), y = z2y(ref.z || 0), wpx = ref.w * vs.s, hpx = wpx * asp;
    o.push(`<rect x="${x}" y="${y - hpx}" width="${wpx}" height="${hpx}" fill="#6fb3d911" stroke="#6fb3d9" stroke-dasharray="6,4" data-photo="body" style="cursor:move"/>`);
    o.push(`<rect x="${x + wpx - 7}" y="${y - hpx - 7}" width="14" height="14" fill="#6fb3d9" stroke="#000" data-photo="corner" style="cursor:nesw-resize"/>`);
  }
  P.svg.innerHTML = o.join("");
}
// a part's rectangles on its face (one a floor it repeats on): [u0, z0, u1, z1, the floor's base]
function partRects(b, p, fi) {
  const K = SG.PART_KINDS[p.kind] || {}, bases = Array.isArray(p.floors) ? fi.rows.filter(r => r.k >= p.floors[0] && r.k <= (p.floors[1] || p.floors[0])).map(r => r.z0) : [0];
  const w0 = +(p.w ?? K.w), w = p.kind === "eave" && !w0 ? fi.W + 0.4 : w0, h = +(p.h ?? K.h), c = fi.W / 2 + (+p.x || 0);
  return bases.map(zb => {
    const z = zb + (+(p.z ?? K.z) || 0);
    if (p.kind === "vsign") return [c - 0.09, z, c + 0.09, z + h, zb];
    if (p.kind === "pipe") return [c - 0.06, z, c + 0.06, z + h, zb];
    if (p.kind === "eave" || p.kind === "awning") return [c - w / 2, z - h, c + w / 2, z, zb];
    return [c - w / 2, z, c + w / 2, z + h, zb];
  });
}
function panelMouse(P) {
  let d = null;
  const at = e => { const r = P.svg.getBoundingClientRect(), vs = P.vs; return [(e.clientX - r.left - r.width / 2) / vs.s + vs.uc, (r.height / 2 - (e.clientY - r.top)) / vs.s + vs.zc]; };
  P.svg.addEventListener("pointerdown", e => {
    const b = ST.sel && ST.sel.list === "buildings" ? selected() : null; if (!b || !P.vs) return;
    P.svg.setPointerCapture(e.pointerId);
    const [u, z] = at(e), fi = faceInfo(b, P.face), t = e.target;
    if (ST.tool && ST.tool.what === "part" && e.button === 0) { addPart(b, P.face, ST.tool.kind, u, z, fi, e.shiftKey); return; }
    if (e.button !== 0 || e.altKey) { d = { kind: "pan", x: e.clientX, y: e.clientY, vs: { ...P.vs } }; return; }
    if (t.dataset.photo) { const r = faceRef(P); if (r) { pushUndo(); d = { kind: "photo", h: t.dataset.photo, r0: { ...r }, u, z }; } return; }
    if (t.dataset.bhandle) { pushUndo(); d = { kind: "building", h: t.dataset.bhandle, b0: JSON.parse(JSON.stringify(b)), u, z, fi }; return; }
    if (t.dataset.phandle) { pushUndo(); const i = ST.sel.part; d = { kind: "presize", h: t.dataset.phandle, i, p0: { ...b.parts[i] }, base: +t.dataset.base, u, z, fi }; return; }
    if (t.dataset.part) { const i = +t.dataset.part; if (ST.sel.part !== i) { ST.sel = { list: "buildings", id: b.id, part: i }; inspect(); renderFacades(); } d = { kind: "pmove", i, p0: { ...b.parts[i] }, u, z, pushed: false }; return; }
    if (t.dataset.floor) { ST.sel = { list: "buildings", id: b.id, face: P.face, floor: +t.dataset.floor }; inspect(); renderFacades(); return; }
    if (P.moving) return;
    d = { kind: "pan", x: e.clientX, y: e.clientY, vs: { ...P.vs } };
    if (ST.sel.part !== undefined || ST.sel.floor !== undefined) { ST.sel = { list: "buildings", id: b.id }; inspect(); renderFacades(); }
  });
  P.svg.addEventListener("pointermove", e => {
    if (!d || !P.vs) return;
    const b = selected(); if (!b) return;
    const [u, z] = at(e);
    if (d.kind === "pan") { P.vs.uc = d.vs.uc - (e.clientX - d.x) / P.vs.s; P.vs.zc = d.vs.zc + (e.clientY - d.y) / P.vs.s; drawPanel(P, b); return; }
    if (d.kind === "photo") { const r = faceRef(P); if (d.h === "body") { r.x = r2(d.r0.x + u - d.u); r.z = r2(d.r0.z + z - d.z); } else r.w = r2(Math.max(0.5, d.r0.w + (u - d.u))); ST.dirty = true; drawPanel(P, b); return; }
    if (d.kind === "pmove") {
      const p = b.parts[d.i]; if (!d.pushed) { if (Math.hypot(u - d.u, z - d.z) * P.vs.s < 3) return; pushUndo(); d.pushed = true; }
      p.x = r2(Math.round(((+d.p0.x || 0) + u - d.u) / 0.05) * 0.05); p.z = r2(Math.round(((+(d.p0.z ?? SG.PART_KINDS[p.kind].z) || 0) + z - d.z) / 0.05) * 0.05);
      changed({ soon: true, inspector: false }); return;
    }
    if (d.kind === "presize") {
      const p = b.parts[d.i], K = SG.PART_KINDS[p.kind], w0 = +(d.p0.w ?? K.w) || (d.fi.W + 0.4), h0 = +(d.p0.h ?? K.h), x0 = +d.p0.x || 0, z0 = +(d.p0.z ?? K.z) || 0, du = u - d.u, dz = z - d.z;
      const east = d.h.includes("e"), north = d.h.includes("n"), hang = p.kind === "eave" || p.kind === "awning";
      const w = Math.max(0.1, w0 + (east ? du : -du)); p.w = r2(w); p.x = r2(x0 + (east ? du : du) / 2);
      if (hang) { const h = Math.max(0.05, h0 + (north ? -dz : dz) * (north ? 1 : 1)); p.h = r2(north ? h0 : Math.max(0.05, h0 - dz)); if (north) p.z = r2(z0 + dz); void h; }
      else { if (north) p.h = r2(Math.max(0.1, h0 + dz)); else { p.h = r2(Math.max(0.1, h0 - dz)); p.z = r2(z0 + dz); } }
      changed({ soon: true, inspector: false }); return;
    }
    if (d.kind === "building") {
      if (d.h === "top") { const n = Math.max(1, Math.round((z - (+b.gh || 3.1)) / (+b.fh || 3.1)) + 1); if (n !== b.floors) { b.floors = n; changed({ soon: true, inspector: false }); } }
      else {                                                         // its width (front or back) or depth (a side), the left edge kept
        const along = P.face === "front" || P.face === "back", key = along ? "w" : "d", v = Math.max(2, Math.round(u / 0.1) * 0.1), dv = v - d.b0[key];
        const F = d.fi.F, a = rad(b.turn || 0), U = [F.U[0] * Math.cos(a) - F.U[1] * Math.sin(a), F.U[0] * Math.sin(a) + F.U[1] * Math.cos(a)];
        b[key] = r2(v); b.at = [r2(d.b0.at[0] + U[0] * dv / 2), r2(d.b0.at[1] + U[1] * dv / 2)];
        changed({ soon: true, inspector: false });
      }
    }
  });
  P.svg.addEventListener("pointerup", () => { const k = d && d.kind; d = null; if (k && k !== "pan") { inspect(); rebuild(); } });
  P.svg.addEventListener("wheel", e => {
    e.preventDefault(); if (!P.vs) return;
    const [u, z] = at(e); P.vs.s = clamp(P.vs.s * (e.deltaY > 0 ? 1 / 1.15 : 1.15), 2, 400);
    const [u2, z2] = at(e); P.vs.uc += u - u2; P.vs.zc += z - z2; drawPanel(P);
  }, { passive: false });
}
function addPart(b, face, kind, u, z, fi, keep) {
  const K = SG.PART_KINDS[kind]; if (!K) return;
  pushUndo();
  const row = fi.rows.find(r => z >= r.z0 && z < r.z0 + r.h) || fi.rows[fi.rows.length - 1];
  const p = { kind, face, x: r2(u - fi.W / 2) };
  const sitsOnFloor = ["door", "shopfront", "shutter", "opening", "stairs", "balcony", "ac"].includes(kind);
  if (kind === "eave") { p.x = 0; p.z = r2(row.z0); }
  else if (kind === "pipe") { p.z = 0; p.h = r2(fi.H); }
  else if (sitsOnFloor) p.z = r2(row.z0 + (kind === "shopfront" ? 0.12 : 0));
  else p.z = r2(Math.max(0, z - (K.h || 1) / 2));
  if (kind === "sign" || kind === "vsign") p.text = kind === "vsign" ? "カラオケ" : "ラーメン";
  b.parts = b.parts || []; b.parts.push(p);
  ST.sel = { list: "buildings", id: b.id, part: b.parts.length - 1 };
  if (!keep) setTool(null);
  changed();
}
function facadeBar() {
  const bar = $("#facadeBar"); bar.innerHTML = "";
  bar.append(el("span", { class: "hint", style: "margin-right:4px" }, "Add:"));
  for (const [k, K] of Object.entries(SG.PART_KINDS)) {
    const t = { what: "part", kind: k };
    bar.append(el("button", { "data-tool": toolKey(t), title: K.note, on: { click: () => { if (!(ST.sel && ST.sel.list === "buildings")) { toast("Pick a building first"); return; } setTool(ST.tool && toolKey(ST.tool) === toolKey(t) ? null : t); } } }, K.label));
  }
}

// ---- photos: pasted or loaded, kept beside the street (refs/, not in git) -------------------------------------------
async function uploadRef(file, base) {
  const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "");
  const name = `${base}.${ext}`;
  const j = await api(`/api/street/${encodeURIComponent(ST.name)}/ref/${encodeURIComponent(name)}`, { method: "POST", body: file });
  if (j.error) throw new Error(j.error);
  return "refs/" + name + "?v=" + Date.now();
}
async function setFaceRef(P, file) {
  const b = ST.sel && ST.sel.list === "buildings" ? selected() : null;
  if (!b) { toast("Pick a building first: the photo goes on its " + P.face); return; }
  try {
    const f = await uploadRef(file, `${b.id}_${P.face}`);
    pushUndo(); b.refs = b.refs || {};
    const old = b.refs[P.face], fi = faceInfo(b, P.face);
    b.refs[P.face] = old ? Object.assign(old, { file: f }) : { file: f, x: 0, z: 0, w: r2(fi.W * 1.1), op: 0.55, top: false };
    P.moving = true; P.root.querySelector(".pmove").classList.add("on");
    changed({ inspector: false }); toast(`the photo is behind the ${P.face}: Move photo to line the building up with it`);
  } catch (e) { status("the photo didn't save: " + e.message, "bad"); }
}
async function setShotRef(file) {
  const s = shotOf(ST.mode); if (!s) return;
  try {
    const f = await uploadRef(file, `shot_${s.id}`);
    pushUndo(); s.ref = f; s.op = s.op ?? 0.5;
    const img = new Image(); img.onload = () => { s.aspect = [img.naturalWidth, img.naturalHeight]; changed(); viewTools(); }; img.src = refUrl(f);
    changed(); viewTools(); toast("the photo is over the shot: tick adjust, then drag and move until they line up");
  } catch (e) { status("the photo didn't save: " + e.message, "bad"); }
}
async function pasteFromClipboard(P) {
  try {
    const items = await navigator.clipboard.read();
    for (const it of items) for (const t of it.types) if (t.startsWith("image/")) { const blob = await it.getType(t); return P ? setFaceRef(P, blob) : setShotRef(blob); }
    toast("No picture on the clipboard: copy one, then press Ctrl+V over where it goes");
  } catch (e) { toast("Press Ctrl+V with the pointer over where the photo goes"); }
}
document.addEventListener("paste", e => {
  const f = [...(e.clipboardData || {}).files || []].find(x => x.type.startsWith("image/"));
  if (!f) return;
  e.preventDefault();
  if (!$("#facadeBox").hidden && hoverPanel) setFaceRef(hoverPanel, f);
  else if (shotOf(ST.mode)) setShotRef(f);
  else if (ST.sel && ST.sel.list === "buildings") { tab("facade"); setFaceRef(PANELS[0], f); }
  else toast("Pick a building (its front gets the photo) or look through a shot (Photo…) first");
});

// ---- the inspector (right, under the view) ------------------------------------------------------------------------
const insp = $("#inspector");
const SLOT_LABELS = { wall: "walls", wall2: "ground floor walls", trim: "trim, slabs, sills", frame: "window frames", glass: "glass", roof: "roof", tiles: "roof tiles", door: "doors",
  shutter: "shutters", concrete: "concrete", metal: "metal", rail: "railings", awning: "awnings", wood_dark: "dark timber", lattice: "lattice", asphalt: "road", pavement: "pavements",
  kerb: "kerbs", paint: "road paint", ground: "ground", roof_flat: "flat roofs", chainlink: "wire mesh", boards: "fence boards", panel: "metal panels", blocks: "block walls", bamboo: "bamboo", post: "posts", pole: "poles", steel: "steel" };
function field(label, input, note) { return el("div", { class: "prop" }, el("label", { title: note || "" }, label), input); }
function num(obj, key, opts = {}) {
  const v = obj[key] ?? opts.def ?? "";
  return el("div", { class: "row" }, el("input", { type: "number", step: opts.step ?? 0.1, min: opts.min, max: opts.max, value: v === "" ? "" : r2(v), style: opts.wide ? "width:80px" : "",
    on: { input: e => { if (e.target.value === "") return; let x = +e.target.value; if (opts.int) x = Math.round(x); if (opts.min !== undefined) x = Math.max(opts.min, x); edit(() => { obj[key] = x; opts.after && opts.after(x); }); } } }), opts.unit ? el("small", {}, opts.unit) : null);
}
function pick(obj, key, choices, opts = {}) {
  const s = el("select", { on: { change: e => edit(() => { obj[key] = opts.numeric ? +e.target.value : e.target.value; opts.after && opts.after(); }, opts.redraw) } });
  for (const [k, v] of Object.entries(choices)) s.append(new Option(v, k));
  s.value = obj[key] ?? opts.def ?? Object.keys(choices)[0];
  return s;
}
function text(obj, key, opts = {}) { return el("input", { type: "text", value: obj[key] ?? "", placeholder: opts.ph || "", on: { input: e => edit(() => { obj[key] = e.target.value; }) } }); }
function check(obj, key, label, opts = {}) { return el("label", { class: "row" }, el("input", { type: "checkbox", checked: !!(obj[key] ?? opts.def), on: { change: e => edit(() => { obj[key] = e.target.checked; }, opts.redraw) } }), label); }
let editPushed = 0;
function edit(fn, redraw = false) {
  if (performance.now() - editPushed > 900) pushUndo();               // typing in one field is one undo
  editPushed = performance.now();
  fn(); changed({ inspector: !!redraw });
}
function section(title, ...kids) { return el("div", { class: "sec" }, el("h3", {}, ...[].concat(title)), ...kids); }
function lookRow(owner, slot) {                                      // a surface: its colour, or a set from the shelf
  owner.look = owner.look || {};
  const cur = owner.look[slot], base = SG.SLOTS[slot] ? SG.SLOTS[slot][0] : "#888888";
  const colour = el("input", { type: "color", value: /^#[0-9a-f]{6}$/i.test(cur || "") ? cur : base, on: { input: e => edit(() => { owner.look[slot] = e.target.value; }) } });
  const shelf = el("select", { style: "max-width:150px", on: { change: e => edit(() => { if (e.target.value) owner.look[slot] = e.target.value; else if ((owner.look[slot] || "").startsWith("pbr/")) delete owner.look[slot]; }, true) } }, new Option("colour", ""));
  for (const ref of Object.keys(S3.SHELF.sets).sort()) shelf.append(new Option(ref.slice(4), ref));
  shelf.value = (cur || "").startsWith("pbr/") ? cur : "";
  const reset = el("button", { title: "back to the default", on: { click: () => edit(() => { delete owner.look[slot]; }, true) } }, "↺");
  return field(SLOT_LABELS[slot] || slot, el("div", { class: "row" }, colour, shelf, cur ? reset : null));
}
function inspect() {
  insp.innerHTML = "";
  if (!ST.street) return;
  const p = selected();
  if (!p) { inspectStreet(); return; }
  ({ roads: inspectRoad, buildings: inspectBuilding, things: inspectThing, fences: inspectFence, shots: inspectShot })[ST.sel.list](p);
}
function head(title, p, list) {
  return el("div", { class: "row", style: "display:flex;gap:6px;align-items:center" }, el("div", { class: "big" }, title),
    el("input", { type: "text", value: p.id, title: "its id (unique in the street)", style: "width:110px", on: { change: e => { const v = e.target.value.trim().replace(/[^A-Za-z0-9_]/g, "_"); if (!v || allIds().has(v)) { e.target.value = p.id; return; } pushUndo(); for (const t of ST.street.things) if (t.to === p.id) t.to = v; p.id = v; ST.sel.id = v; changed(); } } }),
    el("button", { title: "a copy beside it (Ctrl+D)", on: { click: duplicate } }, "Copy"), el("button", { title: "remove it (Del)", on: { click: remove } }, "Remove"));
}
function inspectStreet() {
  const S = ST.street;
  insp.append(el("div", { class: "big" }, "The street: " + ST.name), el("div", { class: "hint" }, count()));
  insp.append(field("about", text(S, "about", { ph: "what this place is" })));
  insp.append(section("Surfaces everywhere", el("div", { class: "hint" }, "A colour or a set from the PBR shelf on every surface of a kind (a building's own beats it)."),
    ...["asphalt", "pavement", "kerb", "ground", "wall", "tiles", "roof_flat", "chainlink", "boards", "blocks", "panel"].map(s => lookRow(S, s))));
  insp.append(section("Start here", el("div", { class: "hint" },
    "1. Streets: pick one on the left, drag on the map. 2. Fill a street: click it, then Fill it all (left). 3. Click a building: change its floors, windows, roof; double-click it for its front and side, where you add balconies, signs, boxes, doors... and paste a photo behind it. 4. Walk it: View, walk. 5. A shot: + Shot, then Photo… to match a picture.")));
}
function inspectRoad(r) {
  insp.append(head("Street", r));
  const f = SG.roadPath(r);
  insp.append(field("length", el("span", { class: "hint" }, `${r1(f.L)} m (drag its ends on the map; drag the dot in its middle to bend it)`)));
  insp.append(field("road width", num(r, "width", { step: 0.1, min: 2, unit: "m (kerb to kerb)" })));
  r.walks = Array.isArray(r.walks) ? r.walks : [2, 2]; r.edge = Array.isArray(r.edge) ? r.edge : [0, 0];
  insp.append(field("pavements", el("div", { class: "row" }, "left", num(r.walks, 0, { min: 0, step: 0.1 }), "right", num(r.walks, 1, { min: 0, step: 0.1 }), el("small", {}, "m"))));
  insp.append(field("kerb", num(r, "kerb", { step: 0.01, min: 0, unit: "m high" })));
  insp.append(field("white lines", el("div", { class: "row" }, "left", num(r.edge, 0, { min: 0, step: 0.1 }), "right", num(r.edge, 1, { min: 0, step: 0.1 }), el("small", {}, "m in from the edge (0: none)"))));
  insp.append(field("middle line", pick(r, "centre", { none: "none", dashed: "dashed", solid: "solid", yellow: "orange (no passing)" })));
  insp.append(field("surface", el("div", { class: "row" }, pick(r, "surface", { asphalt: "asphalt", gravel: "gravel", pavement: "paving" }, { def: "asphalt" }), "walks", pick(r, "walk", { pavement: "paving", gravel: "gravel", asphalt: "asphalt" }, { def: "pavement" }))));
  // its heights: each of its points', the street climbing smoothly between them (the ground, the buildings and the
  // things beside it follow)
  const pz = SG.roadPoints(r), ctl = roadCtl(r), hs = pz.map(q => r2(q[2]));
  const setZ = (i, v) => edit(() => { const z = SG.roadPoints(r).map(q => r2(q[2])); z[i] = v; if (z.every(x => !x)) delete r.z; else r.z = z; });
  const numIn = (v, on, step = 0.1) => el("input", { type: "number", step, value: v, on: { input: e => { if (e.target.value !== "") on(+e.target.value); } } });
  insp.append(section(["Heights", el("span", { class: "hint" }, "metres up at its points: it climbs smoothly between them")],
    ...ctl.map((c, i) => field(i === 0 ? "at its start" : i === ctl.length - 1 ? "at its end" : `at bend ${i}`, el("div", { class: "row" }, numIn(hs[i], v => setZ(i, v)), el("small", {}, "m")))),
    field("a slope", el("div", { class: "row" }, "it rises", numIn(r2(hs[hs.length - 1] - hs[0]), v => edit(() => { const d = [0]; for (let i = 1; i < ctl.length; i++) d.push(d[i - 1] + Math.hypot(ctl[i][0] - ctl[i - 1][0], ctl[i][1] - ctl[i - 1][1])); const L = d[d.length - 1] || 1; r.z = d.map(x => r2(hs[0] + v * x / L)); if (r.z.every(x => !x)) delete r.z; }), 0.5),
      el("small", {}, "m from start to end"), el("button", { on: { click: () => { pushUndo(); delete r.z; changed(); } } }, "Level it"))),
    el("div", { class: "hint" }, `A street's end dropped on another street takes its height there. ${f.L > 0 ? `Steepest: ${r1(steepest(f))}%` : ""}`)));
  r.marks = r.marks || [];
  const marks = el("div", { class: "list" });
  r.marks.forEach((m, i) => marks.append(el("div", { class: "prop", style: "grid-template-columns:70px 1fr" }, el("label", {}, SG.MARK_KINDS[m.kind] || m.kind),
    el("div", { class: "row" }, "at", num(m, "at", { step: 0.5, unit: "m" }), "across", num(m, "x", { step: 0.1 }), m.kind === "text" ? text(m, "text") : null,
      el("button", { on: { click: () => { pushUndo(); r.marks.splice(i, 1); changed(); } } }, "✕")))));
  const add = k => el("button", { on: { click: () => { pushUndo(); r.marks.push(k === "text" ? { kind: "text", text: "止まれ", at: r1(Math.max(0, f.L - 12)) } : { kind: k, at: r1(Math.max(0, f.L - (k === "stop" ? 4 : 8))) }); changed(); } } }, "+ " + SG.MARK_KINDS[k]);
  insp.append(section(["Marks on the road", el("span", { class: "hint" }, "at: metres from its first end")], marks, el("div", { class: "chips" }, ...Object.keys(SG.MARK_KINDS).map(add))));
  insp.append(section("Fill it", el("div", { class: "hint" }, "Use Fill a street on the left: buildings both sides, lamps, poles and wires, clutter.")));
}
function steepest(f) { let m = 0; for (let i = 0; i + 1 < f.P.length; i++) m = Math.max(m, Math.abs(f.P[i + 1][2] - f.P[i][2]) / ((f.S[i + 1] - f.S[i]) || 1)); return m * 100; }
function inspectBuilding(b) {
  const sel = ST.sel, S = SP.STYLES[b.style] || {};
  insp.append(head(S.label || "Building", b));
  if (sel.part !== undefined && b.parts && b.parts[sel.part]) { inspectPart(b, b.parts[sel.part], sel.part); return; }
  if (sel.floor !== undefined) { inspectFloor(b, sel.face, sel.floor); return; }
  insp.append(field("style", el("div", { class: "row" }, pick(b, "style", Object.fromEntries(Object.entries(SP.STYLES).map(([k, v]) => [k, v.label]))),
    el("button", { title: "a new building of this style in its place (the same frontage)", on: { click: () => { pushUndo(); const nb = SP.makeBuilding(b.style, Math.floor(Math.random() * 1e9)); const keep = { id: b.id, at: b.at, turn: b.turn, w: b.w, refs: b.refs }; for (const k of Object.keys(b)) delete b[k]; Object.assign(b, nb, keep); changed(); } } }, "New one"),
    el("button", { title: "another throw of the dice for which windows are lit", on: { click: () => edit(() => { b.seed = Math.floor(Math.random() * 1e6); }) } }, "Shuffle lights"))));
  insp.append(field("size", el("div", { class: "row" }, num(b, "w", { min: 2, unit: "wide" }), num(b, "d", { min: 2, unit: "deep (m)" }))));
  insp.append(field("floors", el("div", { class: "row" }, num(b, "floors", { min: 1, step: 1, int: true }), "ground", num(b, "gh", { min: 2, step: 0.1 }), "others", num(b, "fh", { min: 2, step: 0.1, unit: "m" }))));
  insp.append(field("turned", el("div", { class: "row" }, num(b, "turn", { step: 15, unit: "°" }), el("button", { on: { click: () => { pushUndo(); snapBuilding(b, b.at[0], b.at[1], false); changed(); } } }, "Face the street"))));
  b.faces = b.faces || {}; const fr = b.faces.front = b.faces.front || {};
  insp.append(section("Front", field("windows", el("div", { class: "row" }, pick(fr, "win", SG.WIN_STYLES, { def: "punched" }), "per floor", num(fr, "cols", { min: 0, step: 1, int: true }))),
    field("window size", el("div", { class: "row" }, num(fr, "ww", { def: 1.3, step: 0.1 }), "×", num(fr, "wh", { def: 1.4, step: 0.1 }), "sill", num(fr, "sill", { def: 0.85, step: 0.05, unit: "m" }))),
    field("ground floor", pick(fr, "ground", SG.GROUND_STYLES, { def: "same" })),
    field("lit at night", el("div", { class: "row" }, el("input", { type: "range", min: 0, max: 100, value: Math.round((fr.lit ?? 0.45) * 100), on: { input: e => edit(() => { fr.lit = +e.target.value / 100; }) } }), check(fr, "bands", "floor bands"))),
    el("div", { class: "hint" }, "Click a floor in the Facade view to give it windows of its own.")));
  const side = (name) => { const s = b.faces[name] = b.faces[name] || {}; return field(name, el("div", { class: "row" }, pick(s, "win", SG.WIN_STYLES, { def: name === "back" ? "small" : "none" }), num(s, "cols", { min: 0, step: 1, int: true }))); };
  insp.append(section("Sides and back", side("left"), side("right"), side("back"), el("div", { class: "hint" }, "Sides next to a neighbour are usually blank.")));
  b.roof = b.roof || { kind: "flat" };
  const rf = b.roof;
  insp.append(section("Roof", field("roof", pick(rf, "kind", SG.ROOF_KINDS, { def: "flat", redraw: true })),
    ["gable", "hip", "shed"].includes(rf.kind) ? field("slope", el("div", { class: "row" }, num(rf, "pitch", { def: 24, step: 1, unit: "°" }), "eaves out", num(rf, "over", { def: 0.45, step: 0.05, unit: "m" }), pick(rf, "ridge", { x: "ridge along the front", y: "ridge front to back" }, { def: "x" }))) : null,
    rf.kind === "flat" ? field("parapet", num(rf, "parapet", { def: 0.9, step: 0.1, unit: "m" })) : null,
    field("on the roof", el("div", { class: "chips" }, ...(rf.things || []).map((t, i) => el("button", { title: "remove", on: { click: () => { pushUndo(); rf.things.splice(i, 1); changed(); } } }, (SG.ROOF_THINGS[t.kind] || t.kind) + " ✕")),
      ...Object.entries(SG.ROOF_THINGS).map(([k, v]) => el("button", { on: { click: () => { pushUndo(); rf.things = rf.things || []; const n = rf.things.length; rf.things.push(Object.assign({ kind: k, x: r2((n % 3 - 1) * b.w / 4), y: r2((Math.floor(n / 3) % 2 ? 1 : -1) * b.d / 5) }, k === "billboard" ? { text: "HOTEL" } : {})); changed(); } } }, "+ " + v))))));
  b.tiers = b.tiers || [];
  insp.append(section(["Setbacks", el("button", { on: { click: () => { pushUndo(); b.tiers.push({ floors: 1, inset: [1.5, 1, 1, 1] }); changed(); } } }, "+ a floor set back")],
    ...b.tiers.map((t, i) => field("set back " + (i + 1), el("div", { class: "row" }, num(t, "floors", { min: 1, step: 1, int: true, unit: "floors, in by" }), ...["front", "right", "back", "left"].map((k, j) => el("span", { title: k }, num(t.inset, j, { min: 0, step: 0.5 }))), el("button", { on: { click: () => { pushUndo(); b.tiers.splice(i, 1); changed(); } } }, "✕"))))));
  b.parts = b.parts || [];
  insp.append(section(["On the walls", el("button", { on: { click: () => tab("facade") } }, "open the facade")],
    el("div", { class: "list" }, ...b.parts.map((p, i) => el("div", { class: "it", on: { click: () => { ST.sel = { list: "buildings", id: b.id, part: i }; inspect(); renderFacades(); } } },
      el("span", {}, `${(SG.PART_KINDS[p.kind] || {}).label || p.kind}${p.text ? ": " + p.text : ""}`), el("small", {}, `${p.face || "front"}${Array.isArray(p.floors) ? `, floors ${p.floors[0]}–${p.floors[1]}` : ""}`)))),
    b.parts.length ? null : el("div", { class: "hint" }, "Nothing yet: in the Facade view, pick a part (balcony, box, sign...) and click on the wall.")));
  const used = new Set(); const piece = ST.pieces.find(x => x.id === b.id); if (piece) for (const s of Object.keys(piece.G)) used.add(SG.slotBase(s));
  insp.append(section("Materials", el("div", { class: "hint" }, "A colour, or a set from the PBR shelf (its real size kept)."),
    ...["wall", "wall2", "trim", "frame", "glass", "door", "shutter", "tiles", "roof_flat", "concrete", "metal", "rail", "awning", "wood_dark", "lattice"].filter(s => used.has(s)).map(s => lookRow(b, s))));
}
function inspectFloor(b, face, k) {
  const f = (b.faces = b.faces || {})[face] = b.faces[face] || {};
  f.floors = f.floors || {};
  const own = f.floors[k];
  insp.append(el("div", { class: "hint" }, `Floor ${k} of the ${face}.`), el("button", { on: { click: () => { ST.sel = { list: "buildings", id: b.id }; inspect(); renderFacades(); } } }, "← the whole building"));
  if (!own) {
    insp.append(section("Its windows", el("div", { class: "hint" }, `It has the ${face}'s windows (${SG.WIN_STYLES[f.win || "punched"] || f.win}).`),
      el("button", { on: { click: () => { pushUndo(); f.floors[k] = { win: k === 1 ? (f.ground && f.ground !== "same" ? "punched" : f.win || "punched") : f.win || "punched" }; changed(); } } }, "Give it windows of its own")));
    return;
  }
  const o = typeof own === "string" ? (f.floors[k] = { win: own }) : own;
  insp.append(section("Its own windows", field("windows", el("div", { class: "row" }, pick(o, "win", SG.WIN_STYLES), "per floor", num(o, "cols", { min: 0, step: 1, int: true }))),
    field("size", el("div", { class: "row" }, num(o, "ww", { def: f.ww ?? 1.3 }), "×", num(o, "wh", { def: f.wh ?? 1.4 }), "sill", num(o, "sill", { def: f.sill ?? 0.85, step: 0.05 }))),
    k === 1 ? field("ground floor", pick(o, "ground", SG.GROUND_STYLES, { def: "same" })) : null,
    el("button", { on: { click: () => { pushUndo(); delete f.floors[k]; changed(); } } }, "Back to the face's windows")));
}
function inspectPart(b, p, i) {
  const K = SG.PART_KINDS[p.kind] || {};
  insp.append(el("div", { class: "row", style: "display:flex;gap:6px;margin:4px 0" }, el("b", {}, K.label || p.kind), el("span", { class: "hint" }, K.note || ""),
    el("button", { on: { click: () => { ST.sel = { list: "buildings", id: b.id }; inspect(); renderFacades(); } } }, "← building"),
    el("button", { on: { click: () => { pushUndo(); b.parts.splice(i, 0, JSON.parse(JSON.stringify(p))); const c = b.parts[i + 1]; c.x = r2((+c.x || 0) + (+c.w || K.w || 1) + 0.3); ST.sel = { list: "buildings", id: b.id, part: i + 1 }; changed(); } } }, "Copy"),
    el("button", { on: { click: () => { pushUndo(); b.parts.splice(i, 1); ST.sel = { list: "buildings", id: b.id }; changed(); } } }, "Remove")));
  insp.append(field("on the", pick(p, "face", { front: "front", right: "right side", back: "back", left: "left side" }, { def: "front", redraw: true })));
  insp.append(field("place", el("div", { class: "row" }, "across", num(p, "x", { def: 0, step: 0.05 }), "up", num(p, "z", { def: K.z, step: 0.05, unit: "m" }))));
  insp.append(field("size", el("div", { class: "row" }, num(p, "w", { def: K.w, step: 0.05 }), "×", num(p, "h", { def: K.h, step: 0.05 }), K.out !== undefined ? "out" : null, K.out !== undefined ? num(p, "out", { def: K.out, step: 0.05 }) : null, el("small", {}, "m"))));
  const every = Array.isArray(p.floors);
  insp.append(field("repeat", el("div", { class: "row" }, el("label", {}, el("input", { type: "checkbox", checked: every, on: { change: e => edit(() => {
    const fi = faceInfo(b, p.face || "front");
    if (e.target.checked) { const row = fi.rows.find(r => (+p.z || 0) >= r.z0 && (+p.z || 0) < r.z0 + r.h) || fi.rows[0]; p.floors = [row.k, fi.rows.length]; p.z = r2((+p.z || 0) - row.z0); }
    else { const row = fi.rows.find(r => r.k === p.floors[0]) || fi.rows[0]; p.z = r2((+p.z || 0) + row.z0); delete p.floors; }
  }, true) } }), " on every floor"), every ? el("span", { class: "row" }, "from", num(p.floors, 0, { min: 1, step: 1, int: true }), "to", num(p.floors, 1, { min: 1, step: 1, int: true })) : null)));
  if (p.kind === "sign" || p.kind === "vsign") {
    insp.append(field("words", text(p, "text")), field("colours", el("div", { class: "row" }, "letters", el("input", { type: "color", value: p.fg || "#ffffff", on: { input: e => edit(() => { p.fg = e.target.value; }) } }), "board", el("input", { type: "color", value: p.bg || "#202024", on: { input: e => edit(() => { p.bg = e.target.value; }) } }), check(p, "lit", "lit", { def: true }))),
      field("written", pick(p, "dir", { h: "across", v: "top to bottom", r: "turned (up the board)" }, { def: p.kind === "vsign" ? "v" : "h" })));
  }
  if (p.kind === "balcony") insp.append(field("its edge", pick(p, "rail", { solid: "a solid parapet", rail: "a railing", bars: "bars" }, { def: "solid" })));
  if (p.kind === "bay") insp.append(field("windows", el("div", { class: "row" }, check(p, "win", "on its front"), "per floor", num(p, "cols", { def: 1, step: 1, int: true }), check(p, "rail", "railing on top"))));
  if (p.kind === "stairs") insp.append(field("climbs", pick(p, "dir", { 1: "to the right", "-1": "to the left" }, { def: 1, numeric: true })));
  if (["window", "lattice_window", "glassblock", "shopfront"].includes(p.kind)) insp.append(field("lit", check(p, "lit", "lit at night", { def: p.kind === "shopfront" })));
  if (["lamp", "lantern"].includes(p.kind)) insp.append(field("light", el("div", { class: "row" }, el("input", { type: "color", value: p.color || "#ffd9a0", on: { input: e => edit(() => { p.color = e.target.value; }) } }), "power", num(p, "power", { def: p.kind === "lamp" ? 4 : 5, step: 1 }))));
  if (!K.hole) insp.append(field("material", el("div", { class: "row" }, pick(p, "slot", Object.fromEntries([["", "(its own)"], ...Object.keys(SG.SLOTS).filter(s => !SG.SLOTS[s][3] || SG.SLOTS[s][3] === "t").map(s => [s, SLOT_LABELS[s] || s])]), { def: "" }))));
}
function inspectThing(t) {
  const K = SG.THING_KINDS[t.kind] || {};
  insp.append(head(K.label || t.kind, t), el("div", { class: "hint" }, K.note || ""));
  insp.append(field("place", el("div", { class: "row" }, "x", num(t.at, 0, { step: 0.1 }), "y", num(t.at, 1, { step: 0.1 }), "turned", num(t, "turn", { step: 15, unit: "°" }))));
  insp.append(field("height", num(t, "h", { def: K.h, step: 0.05, unit: "m" })));
  if (t.kind === "lamp") insp.append(field("lamp", el("div", { class: "row" }, "arm", num(t, "arm", { def: 1.4, step: 0.1 }), check(t, "cool", "cool white (LED)"), "power", num(t, "power", { def: 30, step: 5 }))));
  if (t.kind === "lantern") insp.append(field("lanterns", el("div", { class: "row" }, pick(t, "heads", { 1: "one", 2: "two" }, { def: 2, numeric: true }), "plate", text(t, "text", { ph: "ほんちょう (empty: none)" }))));
  if (t.kind === "pole") {
    const others = Object.fromEntries([["", "(no wires)"], ...ST.street.things.filter(x => x.kind === "pole" && x.id !== t.id).map(x => [x.id, x.id])]);
    insp.append(field("wires to", pick(t, "to", others, { def: "" })), field("", check(t, "trans", "a transformer")));
  }
  if (t.kind === "postbox") insp.append(field("shape", pick(t, "style", { round: "round (old)", square: "square" }, { def: "round" })));
  if (t.kind === "car") insp.append(field("car", el("div", { class: "row" }, pick(t, "style", { van: "van", kei: "small (kei)", sedan: "saloon" }, { def: "van" }))));
  if (t.kind === "person") insp.append(field("pose", el("div", { class: "row" }, pick(t, "pose", { stand: "standing", walk: "walking" }, { def: "stand" }), check(t, "bag", "a bag"))));
  if (t.kind === "sign") {
    t.signs = Array.isArray(t.signs) ? t.signs : ["stop"];
    insp.append(field("signs", el("div", { class: "chips" }, ...Object.entries(SG.SIGN_KINDS).map(([k, v]) => el("label", {}, el("input", { type: "checkbox", checked: t.signs.includes(k), on: { change: e => edit(() => { t.signs = e.target.checked ? [...t.signs, k].slice(-3) : t.signs.filter(x => x !== k); }) } }), v)))));
  }
  if (t.kind === "box") insp.append(field("size", el("div", { class: "row" }, num(t, "w", { def: 1 }), "×", num(t, "d", { def: 1, unit: "m" }))));
  if (t.kind === "crates") insp.append(field("stacked", num(t, "n", { def: 3, step: 1, int: true })));
  insp.append(field("material", pick(t, "slot", Object.fromEntries([["", "(its own)"], ...Object.keys(SG.SLOTS).filter(s => !SG.SLOTS[s][3]).map(s => [s, SLOT_LABELS[s] || s])]), { def: "" })));
}
function inspectFence(f) {
  const K = SG.FENCE_KINDS[f.kind] || {};
  insp.append(head(K.label || "Fence", f), el("div", { class: "hint" }, K.note || ""));
  insp.append(field("kind", pick(f, "kind", Object.fromEntries(Object.entries(SG.FENCE_KINDS).map(([k, v]) => [k, v.label])), { redraw: true })));
  insp.append(field("length", el("span", { class: "hint" }, `${r1(Math.hypot(f.to[0] - f.from[0], f.to[1] - f.from[1]))} m (drag its ends; Shift keeps it square)`)));
  insp.append(field("height", num(f, "h", { def: K.h, step: 0.1, unit: "m" })));
  insp.append(field("posts every", num(f, "step", { def: K.step, step: 0.1, unit: "m" })));
  f.look = f.look || {};
  const slots = { mesh: ["chainlink", "post"], wood: ["boards", "wood"], panel: ["panel", "post"], block: ["blocks", "concrete"], blockmesh: ["blocks", "chainlink", "post"], rail: ["post"], bamboo: ["bamboo", "wood_dark"], slats: ["wood", "wood"] }[f.kind] || [];
  insp.append(section("Materials", ...[...new Set(slots)].map(s => lookRow(f, s))));
}
function inspectShot(s) {
  insp.append(head("Shot", s));
  insp.append(field("name", text(s, "name", { ph: "what it is" })));
  insp.append(field("eye", el("div", { class: "row" }, ...[0, 1, 2].map(i => num(s.eye, i, { step: 0.05 })), el("small", {}, "m (z: its height)"))));
  const d = [s.look[0] - s.eye[0], s.look[1] - s.eye[1], s.look[2] - s.eye[2]], L = Math.hypot(...d) || 1, yaw = r1(deg(Math.atan2(d[0], d[1]))), pitch = r1(deg(Math.asin(d[2] / L)));
  const aim = { yaw, pitch };
  const setAim = () => { const y = rad(aim.yaw), p = rad(aim.pitch), D = 20; s.look = [r2(s.eye[0] + Math.sin(y) * Math.cos(p) * D), r2(s.eye[1] + Math.cos(y) * Math.cos(p) * D), r2(s.eye[2] + Math.sin(p) * D)]; };
  insp.append(field("looks", el("div", { class: "row" }, "turned", num(aim, "yaw", { step: 0.5, after: setAim }), "up", num(aim, "pitch", { step: 0.5, after: setAim, unit: "°" }))));
  insp.append(field("lens", el("div", { class: "row" }, num(s, "vfov", { def: 60, step: 0.5, min: 5, unit: "° tall" }), el("small", {}, `(${r1(18 / Math.tan(rad(s.vfov || 60) / 2) * (shotAspect(s) < 1 ? 1 : 1 / 1))} mm on the long side)`))));
  insp.append(field("frame", pick(s, "aspect", { "16,9": "16:9", "2,3": "2:3 (portrait)", "3,2": "3:2", "4,3": "4:3", "3,4": "3:4 (portrait)", "9,16": "9:16 (phone)", "1,1": "1:1" }, { def: "16,9", redraw: true })));
  if (!Array.isArray(s.aspect)) s.aspect = String(s.aspect || "16,9").split(",").map(Number);
  insp.lastChild.querySelector("select").value = s.aspect.join(",");
  insp.lastChild.querySelector("select").onchange = e => edit(() => { s.aspect = e.target.value.split(",").map(Number); }, true);
  insp.append(field("photo", el("div", { class: "row" }, el("span", { class: "hint" }, s.ref ? s.ref.split("?")[0] : "none"), el("button", { on: { click: () => setMode("shot:" + s.id) } }, "Look through it"))));
  insp.append(el("div", { class: "hint", style: "margin-top:6px" }, "Matching a photo: look through the shot, Photo… (or Ctrl+V), set see to half, tick adjust, then drag, WASD and the wheel until the street lines up. The lens is the photo's: a phone's main camera is about 67° tall in portrait."));
}
function duplicate() {
  const p = selected(); if (!p || ST.sel.part !== undefined) return;
  pushUndo();
  const c = JSON.parse(JSON.stringify(p)); c.id = newId(p.id.replace(/\d+$/, "") || "x");
  if (ST.sel.list === "buildings") { const a = rad(p.turn || 0); c.at = [r2(p.at[0] + Math.cos(a) * p.w), r2(p.at[1] + Math.sin(a) * p.w)]; c.seed = Math.floor(Math.random() * 1e6); }
  else if (ST.sel.list === "things") c.at = [r2(p.at[0] + 1), p.at[1]];
  else if (ST.sel.list === "roads" || ST.sel.list === "fences") { c.from = [p.from[0] + 3, p.from[1]]; c.to = [p.to[0] + 3, p.to[1]]; }
  else if (ST.sel.list === "shots") { c.eye = [p.eye[0] + 1, p.eye[1], p.eye[2]]; c.look = [p.look[0] + 1, p.look[1], p.look[2]]; delete c.ref; }
  ST.street[ST.sel.list].push(c); ST.sel = { list: ST.sel.list, id: c.id };
  if (ST.sel.list === "shots") fillModes();
  changed();
}
function remove() {
  const p = selected(); if (!p) return;
  pushUndo();
  if (ST.sel.part !== undefined) { p.parts.splice(ST.sel.part, 1); ST.sel = { list: "buildings", id: p.id }; changed(); return; }
  ST.street[ST.sel.list] = ST.street[ST.sel.list].filter(x => x !== p);
  for (const t of ST.street.things) if (t.to === p.id) delete t.to;
  if (ST.sel.list === "shots") { if (ST.mode === "shot:" + p.id) ST.mode = "orbit"; fillModes(); }
  ST.sel = null; changed();
}

// ---- tabs, the header, keys -------------------------------------------------------------------------------------------
function tab(which) {
  const f = which === "facade";
  $("#tabMap").classList.toggle("on", !f); $("#tabFacade").classList.toggle("on", f);
  $("#mapBox").hidden = f; $("#facadeBox").hidden = !f;
  if (ST.tool && (ST.tool.what === "part") !== f) setTool(null);
  if (f) { for (const P of PANELS) P.vs = null; requestAnimationFrame(renderFacades); } else requestAnimationFrame(drawMap);
}
$("#tabMap").onclick = () => tab("map"); $("#tabFacade").onclick = () => tab("facade");
$("#street").onchange = e => { if (e.target.value === "__new") newStreet(); else { if (ST.dirty && !confirm("Leave this street without saving?")) { e.target.value = ST.name; return; } open(e.target.value); } };
$("#time").onchange = e => { pushUndo(); ST.street.time = e.target.value; ST.dirty = true; look.set(ST.street.time, renderer, SG.bounds2(ST.street)); mats.setTime(look.time); lampsAt = null; renderAll(); status("unsaved: the time of day", "dirty"); };
$("#snap").onchange = e => { ST.snap = +e.target.value; };
$("#undo").onclick = undo; $("#redo").onclick = redo; $("#save").onclick = () => save().catch(e => status(e.message, "bad"));
$("#glb").onclick = async () => {
  try {
    const bin = await S3.exportGlb(root, GLTFExporter), a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bin], { type: "model/gltf-binary" })); a.download = `${ST.name}.glb`; a.click();
    toast(`${ST.name}.glb: ${SG.stats(ST.pieces).tris} triangles`);
  } catch (e) { status("export failed: " + e.message, "bad"); }
};
$("#mode").onchange = e => setMode(e.target.value);
$("#addShot").onclick = () => {
  pushUndo();
  const e = eyeNow(), dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const d = [dir.x, -dir.z, dir.y], id = newId("shot");
  const s = { id, name: id, eye: e.map(r2), look: e.map((v, i) => r2(v + d[i] * 20)), vfov: r1(camera.fov), aspect: [16, 9] };
  ST.street.shots.push(s); fillModes(); ST.sel = { list: "shots", id }; setMode("shot:" + id); changed();
};
$("#shotPhoto").onclick = () => $("#shotFile").click();
$("#shotFile").onchange = e => { const f = e.target.files[0]; if (f) setShotRef(f); e.target.value = ""; };
$("#shotOp").oninput = e => { const s = shotOf(ST.mode); if (s) { s.op = +e.target.value / 100; ST.dirty = true; render(); } };
$("#shotAdjust").onchange = () => { render(); if ($("#shotAdjust").checked) viewEl.focus(); };
window.addEventListener("keydown", e => {
  const typing = /input|select|textarea/i.test(document.activeElement.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save().catch(er => status(er.message, "bad")); return; }
  if (typing) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); duplicate(); return; }
  if (document.activeElement === viewEl && (ST.mode === "walk" || (shotOf(ST.mode) && $("#shotAdjust").checked))) return;
  if (e.key === "Escape") { if (ST.tool) setTool(null); else select(null); return; }
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(); return; }
  const p = selected(); if (!p) return;
  if (e.key.toLowerCase() === "r" && (ST.sel.list === "buildings" || ST.sel.list === "things") && ST.sel.part === undefined) { pushUndo(); p.turn = r1(((p.turn || 0) + (e.shiftKey ? -90 : 90)) % 360); changed(); return; }
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
  if (arrows && ST.sel.part === undefined) {
    e.preventDefault(); pushUndo(); const k = e.shiftKey ? 1 : ST.snap, [dx, dy] = arrows.map(v => v * k);
    if (p.at) p.at = [r2(p.at[0] + dx), r2(p.at[1] + dy)];
    if (p.from) { p.from = [r2(p.from[0] + dx), r2(p.from[1] + dy)]; p.to = [r2(p.to[0] + dx), r2(p.to[1] + dy)]; }
    if (p.eye) { p.eye = [r2(p.eye[0] + dx), r2(p.eye[1] + dy), p.eye[2]]; p.look = [r2(p.look[0] + dx), r2(p.look[1] + dy), p.look[2]]; }
    changed({ soon: true });
  }
});
window.addEventListener("beforeunload", e => { if (ST.dirty) { e.preventDefault(); e.returnValue = ""; } });
new ResizeObserver(() => { drawMap(); renderAll(); renderFacades(); }).observe(document.body);

// ---- off it goes ----------------------------------------------------------------------------------------------------
(async () => {
  palette(); facadeBar();
  await S3.loadShelf();
  try {
    await loadNames();
    const want = Q.get("street") || (() => { try { return localStorage.getItem("street.name"); } catch (e) { return null; } })();
    if (!ST.names.length) { await api("/api/street/my_street/new", { method: "POST", body: JSON.stringify({ street: SP.blankStreet("my_street") }) }); await loadNames(); }
    await open(ST.names.includes(want) ? want : ST.names[0]);
    if (Q.get("facade")) { const b = ST.street.buildings.find(x => x.id === Q.get("facade")); if (b) { select({ list: "buildings", id: b.id }); tab("facade"); } }
    if (Q.get("time")) { ST.street.time = Q.get("time"); $("#time").value = ST.street.time; look.set(ST.street.time, renderer, SG.bounds2(ST.street)); mats.setTime(look.time); }
    placeLamps(true); renderAll();
  } catch (e) { status("the server didn't answer: python tools/director/serve.py (" + e.message + ")", "bad"); }
  ST.ready = true; window.__streetReady = true;
})();
// for the checks: the street's group, a build now, the build cache emptied
window.__root = () => root; window.__rebuild = () => rebuild(); window.__clearCache = () => { BUILT.clear(); if (root) { for (const v of root.userData.chunks.values()) S3.disposeChunk(v.group); root.userData.chunks = new Map(); } };
// for the checks: draw a shot at a size, straight away
window.__shot = (id, w, h) => {
  const s = ST.street.shots.find(x => x.id === id); if (!s) return false;
  ST.mode = "shot:" + s.id; viewEl.style.width = w + "px"; viewEl.style.height = h + "px"; viewEl.style.flex = "none";
  lampsAt = null; placeLamps(true); render(); return true;
};

// The scene builder: a top-down floor plan of a level (rooms, doors, sliding doors, windows) on a grid the size of
// Unreal's (1 m squares, 20 cm lines) or a Japanese 910 mm module, with the reference layouts in builder-presets.js,
// and the same level seen from the player's eye at the game's field of view: walk it before it's built.
// It reads and writes the story's levels (docs/STORY_FORMAT.md §2) through the desk's server; the model is in
// builder-model.js. docs/SCENE_BUILDER.md.
import * as THREE from "three";
import * as M from "./motion.js";
import { Stage, vfov, EYES, s2t, SHOTS, shotFor, FOV_H, loadAssetLibrary, LIBRARY } from "./stage.js";
import { loadBody, BodyFigure } from "./bodies.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { FBXLoader } from "./vendor/FBXLoader.js";
import { KINDS, OPENINGS, PRESETS, JO, MODULE, STOREY, WALL_ITEMS, FINISH, KNOWN_LOOKS, FLOOR_BY_KIND } from "./builder-presets.js";
import * as BM from "./builder-model.js";
import * as KIT from "./kit.js";
import { form as kitForm, overrides as kitOverrides, CSS as KIT_CSS } from "./kit-form.js";

const $ = s => document.querySelector(s);
const SVGNS = "http://www.w3.org/2000/svg";
const api = async (url, opts) => { const r = await fetch(url, opts); const j = await r.json(); if (!r.ok && r.status !== 409) throw new Error(j.error || r.status); return Object.assign(j, { _status: r.status }); };
const r2 = v => Math.round(v * 100) / 100;
const SHOT_NAMES = { ecu: "an extreme close-up", cu: "a close-up", mcu: "a medium close-up", ms: "a medium shot", fs: "a full shot", ws: "a wide shot" };

const B = {
  game: null, story: null, mtime: 0, level: null, target: null,
  model: null, floor: 0, sel: null, tool: "select", snap: 0.1, grid: "m",
  view: { cx: 4, cy: 4, s: 60 },            // the plan's centre (m) and its scale (px a metre)
  undo: [], redo: [], plan: null, planStory: null, exported: null, dirty: false,
  itemKind: "poster", refs: [], ref: null, measure: null,
  focus: null, others: {},                  // the script node whose marks are highlighted; other games' stories
};
const Q = new URLSearchParams(location.search);
let STORY_CH = null;
try { STORY_CH = new BroadcastChannel("horrorstudio-story"); } catch (e) { }
let LIB = null, stage = null, herFig = null, lampLight = null;

function status(t, cls) { const s = $("#status"); s.textContent = t; s.className = cls || ""; }
const floorZ = () => B.model.floors[B.floor] ?? 0;
const snapV = v => Math.round(v / B.snap) * B.snap;

// ---- loading ----
async function loadGames() {
  const g = await api("/api/games");
  const sel = $("#game");
  sel.innerHTML = "";
  for (const name of g.games || g) sel.append(new Option(name, name));
  const want = Q.get("game") || localStorage.getItem("builder.game");
  if (want && [...sel.options].some(o => o.value === want)) sel.value = want;
  await loadGame(sel.value);
}
async function loadGame(game) {
  B.game = game; localStorage.setItem("builder.game", game);
  const j = await api("/api/story/" + encodeURIComponent(game));
  B.story = j.story; B.mtime = j.mtime;
  const sel = $("#level"); sel.innerHTML = "";
  for (const l of Object.keys(B.story.levels || {})) sel.append(new Option(l, l));
  sel.append(new Option("+ new level…", "__new"));
  const asked = B.game === Q.get("game") && Q.get("level") && B.story.levels[Q.get("level")] ? Q.get("level") : null;
  const lv = asked || Object.keys(B.story.levels || {})[0];
  if (Q.get("node") && B.story.flow && B.story.flow[Q.get("node")]) B.focus = Q.get("node");
  if (lv) { sel.value = lv; openLevel(lv); }
  loadOthers();
  $("#fovNote").textContent = `fov ${B.story.game.fov || FOV_H}° (game.fov)`;
  await setupFigure();
}
function openLevel(name) {
  B.level = name; B.target = name;
  B.model = BM.levelToModel(B.story, name);
  afterLoad(`level ${name}: ${B.model.rooms.length} rooms`);
}
function openPreset(id) {
  const P = PRESETS.find(p => p.id === id);
  if (!P) return;
  if (B.dirty && !confirm("Replace the plan with the layout? (Undo brings it back.)")) return;
  pushUndo();
  let name = "home_" + P.id, i = 2;
  while (B.story.levels[name]) name = "home_" + P.id + "_" + i++;
  B.model = BM.uniquify(BM.presetToModel(P), BM.takenIds(B.story, name), name);
  B.target = name;
  const sel = $("#level");
  if (![...sel.options].some(o => o.value === name)) sel.insertBefore(new Option(name + " (new)", name), sel.lastChild);
  sel.value = name;
  afterLoad(`layout: ${P.name}. ${P.note}`);
  B.dirty = true;
}
function afterLoad(msg) {
  B.sel = null; B.floor = 0; B.measure = null;
  B.model.items = B.model.items || []; B.model.finish = Object.assign({}, FINISH, B.model.finish || {});
  for (const op of B.model.ops) if (!op.ref) { const m = B.refs.find(r => r.type === op.type && Math.abs(r.w + 2 * (+r.gap || 0) - op.w) < 0.003 && Math.abs(r.h + 2 * (+r.gap || 0) - op.h) < 0.003); if (m) op.ref = m.name; }
  renderFinish();
  frame(); renderFloors(); changed(false); status(msg);
}
function frame() {                         // fit the plan in view
  const rs = B.model.rooms;
  if (!rs.length) return;
  const x0 = Math.min(...rs.map(r => r.x)), x1 = Math.max(...rs.map(r => r.x + r.w)), y0 = Math.min(...rs.map(r => r.y)), y1 = Math.max(...rs.map(r => r.y + r.d));
  const box = $("#plan").getBoundingClientRect();
  B.view.cx = (x0 + x1) / 2; B.view.cy = (y0 + y1) / 2;
  B.view.s = Math.max(20, Math.min(160, Math.min(box.width / (x1 - x0 + 2.5), box.height / (y1 - y0 + 2.5))));
}

// ---- undo ----
const snapshot = () => JSON.stringify({ m: B.model, f: B.floor });
function pushUndo() { if (!B.model) return; B.undo.push(snapshot()); if (B.undo.length > 120) B.undo.shift(); B.redo = []; }
function restore(s) { const o = JSON.parse(s); B.model = o.m; B.floor = Math.min(o.f, B.model.floors.length - 1); B.sel = null; renderFloors(); changed(); }
function undo() { if (!B.undo.length) return; B.redo.push(snapshot()); restore(B.undo.pop()); }
function redo() { if (!B.redo.length) return; B.undo.push(snapshot()); restore(B.redo.pop()); }

// ---- every change: export, draw, replan (debounced) ----
let replanTimer = 0;
function changed(dirty = true) {
  if (dirty) B.dirty = true;
  B.exported = BM.modelToLevel(B.model, B.story);
  draw(); renderProps(); renderStats();
  clearTimeout(replanTimer); replanTimer = setTimeout(replan, 220);
  if (B.dirty) status("unsaved: " + (B.exported.problems[0] || "Save to story writes it"), "dirty");
}
function storyWithLevel() {
  const s = JSON.parse(JSON.stringify(B.story));
  s.levels = Object.assign({}, s.levels, { [B.target]: B.exported.level });
  return s;
}
async function replan() {
  const s = storyWithLevel();
  try {
    const j = await api("/api/plan/" + encodeURIComponent(B.game), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    if (j.error) throw new Error(j.error);
    B.plan = j; B.planStory = s;
    stage.setWorld(j, s, B.target);
    addLamp(); placeHer(); doors(); placeRefs(); draw(); render3d();
  } catch (e) { status(e.message, "bad"); }
}

// ---- the plan (SVG, drawn in screen pixels: x east, y north is up) ----
const svg = $("#plan");
const sx = x => (x - B.view.cx) * B.view.s + svg.clientWidth / 2;
const sy = y => -(y - B.view.cy) * B.view.s + svg.clientHeight / 2;
const wx = px => (px - svg.clientWidth / 2) / B.view.s + B.view.cx;
const wy = py => -(py - svg.clientHeight / 2) / B.view.s + B.view.cy;
function el(tag, attrs = {}, parent = svg) { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent.append(e); return e; }
const onFloor = r => Math.abs(r.z - floorZ()) < 0.3;
const spans = r => r.z < floorZ() - 0.3 && r.z + r.h > floorZ() + 1.0;    // a stairwell seen from the floor above
const visibleRooms = () => B.model.rooms.filter(r => onFloor(r) || spans(r));

function draw() {
  if (!B.model) return;
  svg.innerHTML = "";
  const W = svg.clientWidth, H = svg.clientHeight;
  // grid: 1 m squares with 20 cm lines (Unreal's prototype grid), or the 910 mm module with its halves
  const [minor, major] = B.grid === "jp" ? [MODULE / 2, MODULE] : [0.2, 1];
  const gx0 = wx(0), gx1 = wx(W), gy0 = wy(H), gy1 = wy(0);
  let d1 = "", d2 = "";
  if (B.view.s * minor > 5) for (let x = Math.floor(gx0 / minor) * minor; x < gx1; x += minor) d1 += `M${sx(x)} 0V${H}`;
  if (B.view.s * minor > 5) for (let y = Math.floor(gy0 / minor) * minor; y < gy1; y += minor) d1 += `M0 ${sy(y)}H${W}`;
  for (let x = Math.floor(gx0 / major) * major; x < gx1; x += major) d2 += `M${sx(x)} 0V${H}`;
  for (let y = Math.floor(gy0 / major) * major; y < gy1; y += major) d2 += `M0 ${sy(y)}H${W}`;
  el("path", { d: d1, stroke: "#1d1d23", "stroke-width": 1 });
  el("path", { d: d2, stroke: "#2a2a33", "stroke-width": 1 });
  el("path", { d: `M${sx(0)} 0V${H}M0 ${sy(0)}H${W}`, stroke: "#3a3a46", "stroke-width": 1 });
  // the floor below, faint
  if (B.floor > 0) for (const r of B.model.rooms.filter(r => Math.abs(r.z - B.model.floors[B.floor - 1]) < 0.3))
    el("rect", { x: sx(r.x), y: sy(r.y + r.d), width: r.w * B.view.s, height: r.d * B.view.s, fill: "none", stroke: "#3b3b45", "stroke-dasharray": "4 4" });
  // rooms
  for (const r of visibleRooms()) {
    const K = KINDS[r.kind] || KINDS.other, sel = B.sel && B.sel.room === r.id;
    const g = el("g", { "data-room": r.id, style: "cursor:move" });
    el("rect", { x: sx(r.x), y: sy(r.y + r.d), width: r.w * B.view.s, height: r.d * B.view.s, fill: K.color, "fill-opacity": spans(r) ? 0.12 : (r.ceiling ? 0.33 : 0.18),
                 stroke: sel ? "#d9a441" : "none", "stroke-width": 2, "data-room": r.id }, g);
    if (spans(r)) { el("path", { d: `M${sx(r.x)} ${sy(r.y)}L${sx(r.x + r.w)} ${sy(r.y + r.d)}M${sx(r.x)} ${sy(r.y + r.d)}L${sx(r.x + r.w)} ${sy(r.y)}`, stroke: K.color, "stroke-opacity": 0.5 }, g); }
    const fs = Math.max(9, Math.min(13, B.view.s * 0.2));
    if (r.w * B.view.s > 34 && r.d * B.view.s > 22) {
      const cx = sx(r.x + r.w / 2), cy = sy(r.y + r.d / 2);
      const roomy = r.w * B.view.s > 120;          // narrow rooms get the short label
      const t = el("text", { x: cx, y: cy - fs * 0.4, "text-anchor": "middle", fill: "#ece8df", "font-size": fs }, g);
      t.textContent = roomy ? (r.name || K.en) + " " + K.ja : K.ja;
      const t2 = el("text", { x: cx, y: cy + fs * 0.85, "text-anchor": "middle", fill: "#b9b4aa", "font-size": fs * 0.85 }, g);
      t2.textContent = OUT(r) ? `${r2(r.w)} × ${r2(r.d)} m` : roomy ? `約${(BM.jo(r)).toFixed(1)}帖 · ${BM.area(r).toFixed(1)} m²` : `${BM.jo(r).toFixed(1)}帖`;
    }
  }
  // walls and props as the plan builds them (the importer's own pieces)
  if (B.plan) {
    const z0 = floorZ() + 1.0;
    let dw = "";
    for (const p of B.plan.pieces) {
      if (p.level !== B.target) continue;
      const [w, d, h] = p.size, [x, y, z] = p.pos;
      const rot = Math.abs(((p.yaw % 180) + 180) % 180 - 90) < 1;
      const ww = rot ? d : w, dd = rot ? w : d;
      if (p.kind === "wall" && z - h / 2 <= z0 && z + h / 2 >= z0) dw += `M${sx(x - ww / 2)} ${sy(y + dd / 2)}h${ww * B.view.s}v${dd * B.view.s}h${-ww * B.view.s}z`;
      else if (p.kind === "mesh" && Math.abs(z - h / 2 - floorZ()) < 1.2 && z + h / 2 > floorZ() && !p.tags.includes("surface") && !p.tags.includes("in_wall") && !/_kt_/.test(p.id))
        el("rect", { x: sx(x - ww / 2), y: sy(y + dd / 2), width: ww * B.view.s, height: dd * B.view.s, fill: "#6d7d92", "fill-opacity": 0.55, stroke: "#9fb0c6", "stroke-width": 0.8 });
    }
    el("path", { d: dw, fill: "#d8d4ca" });
  }
  // openings
  for (const op of B.model.ops) {
    if (Math.abs(op.z - floorZ()) > 0.3 && !(op.z < floorZ() && op.z + op.h > floorZ())) continue;
    drawOpening(op);
  }
  for (const k of B.model.kits || []) drawKit(k);
  const selKit = B.sel && B.sel.kit && (B.model.kits || []).find(q => q.id === B.sel.kit);
  if (selKit && onFloor(roomOf(selKit.room) || {})) kitHandles(selKit);
  for (const it of B.model.items || []) drawItem(it);
  if ($("#marks").checked) drawMarks();
  drawPeople();
  if (B.measure) drawMeasure();
  if (B.sel && B.sel.room) handles(B.model.rooms.find(r => r.id === B.sel.room));
  // the scale: a bar and what a square is
  const bar = B.grid === "jp" ? MODULE : 1;
  el("path", { d: `M16 ${H - 18}h${bar * B.view.s}M16 ${H - 22}v8M${16 + bar * B.view.s} ${H - 22}v8`, stroke: "#d9a441", "stroke-width": 2 });
  el("text", { x: 22 + bar * B.view.s, y: H - 14, fill: "#d9a441", "font-size": 12 }).textContent = B.grid === "jp" ? "910 mm (1 module; a tatami is 2)" : "1 m (one square)";
}
const OUT = r => ["balcony", "garden", "common", "engawa"].includes(r.kind);

function drawOpening(op) {
  const sel = B.sel && B.sel.op === op.id;
  const a0 = op.c - op.w / 2, a1 = op.c + op.w / 2;
  const P = (a, off = 0) => op.axis === "y" ? [sx(a), sy(op.v + off)] : [sx(op.v + off), sy(a)];
  const g = el("g", { "data-op": op.id, style: "cursor:pointer" });
  const [p0, p1] = [P(a0), P(a1)];
  el("line", { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], stroke: "#141417", "stroke-width": Math.max(5, 0.14 * B.view.s), "data-op": op.id }, g);
  const col = sel ? "#d9a441" : op.type === "window" ? "#7fc0e6" : op.type === "arch" ? "#9a978f" : "#e0a65a";
  if (op.type === "window") {
    for (const o of [-0.03, 0.03]) { const [q0, q1] = [P(a0, o), P(a1, o)]; el("line", { x1: q0[0], y1: q0[1], x2: q1[0], y2: q1[1], stroke: col, "stroke-width": 1.5 }, g); }
  } else if (op.type === "slide") {
    const m = (a0 + a1) / 2;
    for (const [s0, s1, o] of [[a0, m + 0.04, -0.03], [m - 0.04, a1, 0.03]]) { const [q0, q1] = [P(s0, o), P(s1, o)]; el("line", { x1: q0[0], y1: q0[1], x2: q1[0], y2: q1[1], stroke: col, "stroke-width": 3 }, g); }
  } else if (op.type === "door") {
    // the leaf swings into the room that holds the door (in) or out of it: its hinge at the low end
    const host = hostOf(op), side = host ? sideSign(op, host) : 1, way = (op.swing === "out" ? -1 : 1) * side;
    const h0 = P(a0), tip = P(a0, way * op.w);
    el("line", { x1: h0[0], y1: h0[1], x2: tip[0], y2: tip[1], stroke: col, "stroke-width": 2 }, g);
    const rr = op.w * B.view.s;
    const sweep = (op.axis === "y" ? way > 0 : way < 0) ? 1 : 0;
    el("path", { d: `M${tip[0]} ${tip[1]}A${rr} ${rr} 0 0 ${sweep} ${p1[0]} ${p1[1]}`, fill: "none", stroke: col, "stroke-width": 1, "stroke-dasharray": "3 3" }, g);
  } else {
    el("line", { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], stroke: col, "stroke-width": 1, "stroke-dasharray": "2 3" }, g);
  }
  el("line", { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], stroke: "transparent", "stroke-width": 14, "data-op": op.id }, g);
}
function hostOf(op) {
  const lv = B.exported && B.exported.level;
  if (!lv) return null;
  for (const r of lv.rooms) for (const o of r.openings || []) if ((o.door && o.door.id === op.id) || (!o.door && Math.abs(BM.wallLine(roomOf(r.id), o.wall).lo + o.at - op.c) < 0.01 && BM.wallLine(roomOf(r.id), o.wall).axis === op.axis && Math.abs(BM.wallLine(roomOf(r.id), o.wall).v - op.v) < 0.01)) return roomOf(r.id);
  return null;
}
const roomOf = id => B.model.rooms.find(r => r.id === id);
function sideSign(op, room) { return op.axis === "y" ? (room.y + room.d / 2 > op.v ? 1 : -1) : (room.x + room.w / 2 > op.v ? 1 : -1); }

function handles(r) {
  if (!r || !(onFloor(r) || spans(r))) return;
  const pts = { nw: [r.x, r.y + r.d], n: [r.x + r.w / 2, r.y + r.d], ne: [r.x + r.w, r.y + r.d], e: [r.x + r.w, r.y + r.d / 2],
                se: [r.x + r.w, r.y], s: [r.x + r.w / 2, r.y], sw: [r.x, r.y], w: [r.x, r.y + r.d / 2] };
  for (const [k, [x, y]] of Object.entries(pts)) el("rect", { x: sx(x) - 5, y: sy(y) - 5, width: 10, height: 10, fill: "#d9a441", "data-handle": k,
    style: `cursor:${{ n: "ns", s: "ns", e: "ew", w: "ew", ne: "nesw", sw: "nesw", nw: "nwse", se: "nwse" }[k]}-resize` });
  const lab = el("text", { x: sx(r.x + r.w / 2), y: sy(r.y + r.d) - 8, "text-anchor": "middle", fill: "#d9a441", "font-size": 12 });
  lab.textContent = `${r2(r.w)} m`;
  const lab2 = el("text", { x: sx(r.x + r.w) + 8, y: sy(r.y + r.d / 2), fill: "#d9a441", "font-size": 12 });
  lab2.textContent = `${r2(r.d)} m`;
}

// the player (their field of view, cut by the walls at eye height) and her, with how she'd read from here
function drawPeople() {
  const p = B.model.player, h = B.model.her;
  if (Math.abs(p.z - floorZ()) < 0.6) {
    const pts = visibility(p);
    el("path", { d: "M" + pts.map(([x, y]) => `${sx(x)} ${sy(y)}`).join("L") + "Z", fill: "#d9a441", "fill-opacity": 0.13, stroke: "#d9a441", "stroke-opacity": 0.35 });
    person(p, "#d9a441", "player", "you");
  }
  if ($("#showHer").checked && Math.abs(h.z - floorZ()) < 0.6) {
    person(h, "#e08bb0", "her", herName());
    if (Math.abs(p.z - h.z) < 0.6) {
      const dist = Math.hypot(h.x - p.x, h.y - p.y);
      el("line", { x1: sx(p.x), y1: sy(p.y), x2: sx(h.x), y2: sy(h.y), stroke: "#e08bb0", "stroke-dasharray": "4 4", "stroke-opacity": 0.6 });
      el("text", { x: (sx(p.x) + sx(h.x)) / 2 + 6, y: (sy(p.y) + sy(h.y)) / 2 - 6, fill: "#e08bb0", "font-size": 12 }).textContent = `${dist.toFixed(1)} m`;
    }
  }
}
function person(o, col, key, label) {
  // the body from above at its real size: shoulders 45 cm across, 25 cm deep, the nose showing where it faces
  const a = o.yaw * Math.PI / 180, g = el("g", { "data-person": key, style: "cursor:grab" });
  const c = [sx(o.x), sy(o.y)];
  el("ellipse", { cx: c[0], cy: c[1], rx: 0.225 * B.view.s, ry: 0.125 * B.view.s, transform: `rotate(${-(o.yaw - 90)} ${c[0]} ${c[1]})`, fill: col, "fill-opacity": 0.85, "data-person": key }, g);
  el("circle", { cx: c[0], cy: c[1], r: 0.1 * B.view.s, fill: "#222", "data-person": key }, g);
  el("line", { x1: c[0], y1: c[1], x2: c[0] + Math.cos(a) * 0.3 * B.view.s, y2: c[1] - Math.sin(a) * 0.3 * B.view.s, stroke: col, "stroke-width": 2 }, g);
  el("circle", { cx: c[0] + Math.cos(a) * 0.5 * B.view.s, cy: c[1] - Math.sin(a) * 0.5 * B.view.s, r: 5, fill: col, "data-turn": key, style: "cursor:crosshair" }, g);
  el("text", { x: c[0] + 10, y: c[1] + 18, fill: col, "font-size": 11 }, g).textContent = label;
}
function herName() { const c = Object.entries(B.story.cast || {})[0]; return c ? (c[1].name || c[0]) : "her"; }

// 2D rays against the built walls (and the props tall enough to block the eye)
function visibility(p) {
  const fov = (B.story.game.fov || FOV_H), n = 72, eye = p.z + EYES[$("#eye").value];
  const boxes = (B.plan ? B.plan.pieces : []).filter(q => q.level === B.target && (q.kind === "wall" || q.kind === "mesh") && q.pos[2] - q.size[2] / 2 <= eye && q.pos[2] + q.size[2] / 2 >= eye)
    .map(q => { const rot = Math.abs(((q.yaw % 180) + 180) % 180 - 90) < 1; const w = rot ? q.size[1] : q.size[0], d = rot ? q.size[0] : q.size[1]; return [q.pos[0] - w / 2, q.pos[1] - d / 2, q.pos[0] + w / 2, q.pos[1] + d / 2]; });
  const pts = [[p.x, p.y]];
  for (let i = 0; i <= n; i++) {
    const a = (p.yaw - fov / 2 + fov * i / n) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
    let t = 12;
    for (const [x0, y0, x1, y1] of boxes) {
      let t0 = 0, t1 = t;
      for (const [o, dd, lo, hi] of [[p.x, dx, x0, x1], [p.y, dy, y0, y1]]) {
        if (Math.abs(dd) < 1e-9) { if (o < lo || o > hi) { t0 = 1; t1 = 0; } continue; }
        let u0 = (lo - o) / dd, u1 = (hi - o) / dd; if (u0 > u1) [u0, u1] = [u1, u0];
        t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
      }
      if (t0 <= t1 && t0 > 0.02) t = Math.min(t, t0);
    }
    pts.push([p.x + dx * t, p.y + dy * t]);
  }
  return pts;
}

// ---- mouse on the plan ----
let drag = null;
svg.addEventListener("mousedown", e => {
  const t = e.target, x = wx(e.offsetX), y = wy(e.offsetY);
  if (B.tool === "measure" && e.button === 0) { const p = snapPt(x, y); B.measure = { a: p, b: p }; drag = { kind: "measure" }; draw(); return; }
  if (B.tool === "item" && e.button === 0) { addItem(x, y); return; }
  if (B.tool === "kit" && e.button === 0) { addKit(x, y); return; }
  if (B.tool === "fit" && e.button === 0) { addItem(x, y, B.fitPreset); return; }
  if (B.tool !== "select" && e.button === 0) { addOpening(x, y); return; }
  if (t.dataset.item) { B.sel = { item: t.dataset.item }; const it = B.model.items.find(i => i.id === t.dataset.item); pushUndo(); drag = { kind: "item", it, a0: it.a, p: wallCoord(it, x, y) }; changed(false); return; }
  if (t.dataset.khandle) { const k = B.model.kits.find(q => q.id === B.sel.kit); const [su, sv] = t.dataset.khandle.split(",").map(Number); pushUndo();
    drag = { kind: "kresize", k, su, sv, x0: k.x, y0: k.y, size: k.size.slice(), spec: JSON.parse(JSON.stringify(k.spec)) }; return; }
  if (t.dataset.kit) { B.sel = { kit: t.dataset.kit }; const k = B.model.kits.find(q => q.id === t.dataset.kit); pushUndo(); drag = { kind: "kit", k, x0: k.x, y0: k.y, x, y }; changed(false); return; }
  if (t.dataset.handle) { const r = roomOf(B.sel.room); pushUndo(); drag = { kind: "resize", h: t.dataset.handle, r, start: { x: r.x, y: r.y, w: r.w, d: r.d }, x, y }; return; }
  if (t.dataset.turn) { pushUndo(); drag = { kind: "turn", who: t.dataset.turn }; return; }
  if (t.dataset.person) { pushUndo(); const o = B.model[t.dataset.person]; drag = { kind: "person", who: t.dataset.person, dx: o.x - x, dy: o.y - y }; return; }
  if (t.dataset.op) { B.sel = { op: t.dataset.op }; const op = B.model.ops.find(o => o.id === t.dataset.op); pushUndo(); drag = { kind: "op", op, c0: op.c, a: op.axis === "y" ? x : y }; changed(false); return; }
  if (t.dataset.room) { const r = roomOf(t.dataset.room); B.sel = { room: r.id }; pushUndo(); drag = { kind: "move", r, start: { x: r.x, y: r.y }, x, y }; changed(false); return; }
  B.sel = null; drag = { kind: "pan", cx: B.view.cx, cy: B.view.cy, px: e.clientX, py: e.clientY }; changed(false);
});
window.addEventListener("mousemove", e => {
  if (!drag) return;
  const rect = svg.getBoundingClientRect(), x = wx(e.clientX - rect.left), y = wy(e.clientY - rect.top);
  if (drag.kind === "pan") { B.view.cx = drag.cx - (e.clientX - drag.px) / B.view.s; B.view.cy = drag.cy + (e.clientY - drag.py) / B.view.s; draw(); return; }
  if (drag.kind === "move") {
    const r = drag.r;
    r.x = snapV(drag.start.x + x - drag.x); r.y = snapV(drag.start.y + y - drag.y);
    magnetMove(r);
  } else if (drag.kind === "resize") {
    const r = drag.r, s = drag.start, h = drag.h;
    if (h.includes("e")) r.w = Math.max(0.5, snapV(s.w + x - drag.x));
    if (h.includes("n")) r.d = Math.max(0.5, snapV(s.d + y - drag.y));
    if (h.includes("w")) { const nx = snapV(s.x + x - drag.x); r.w = Math.max(0.5, s.x + s.w - nx); r.x = s.x + s.w - r.w; }
    if (h.includes("s")) { const ny = snapV(s.y + y - drag.y); r.d = Math.max(0.5, s.y + s.d - ny); r.y = s.y + s.d - r.d; }
    magnetResize(r, h);
  } else if (drag.kind === "measure") {
    B.measure.b = snapPt(x, y); draw(); return;
  } else if (drag.kind === "kresize") {
    resizeKit(drag, x, y, e.shiftKey);
  } else if (drag.kind === "kit") {
    const k = drag.k; k.x = r2(Math.round((drag.x0 + x - drag.x) / 0.05) * 0.05); k.y = r2(Math.round((drag.y0 + y - drag.y) / 0.05) * 0.05);
    if (BM.mountOf(k.spec) === "back" && !e.altKey) snapKit(k, 0.3);
  } else if (drag.kind === "item") {
    drag.it.a = Math.round((drag.a0 + wallCoord(drag.it, x, y) - drag.p) / 0.05) * 0.05;
  } else if (drag.kind === "op") {
    drag.op.c = Math.round((drag.c0 + (drag.op.axis === "y" ? x : y) - drag.a) / 0.05) * 0.05;
  } else if (drag.kind === "person") {
    const o = B.model[drag.who]; o.x = r2(x + drag.dx); o.y = r2(y + drag.dy); o.z = floorZ();
  } else if (drag.kind === "turn") {
    const o = B.model[drag.who]; o.yaw = Math.round(Math.atan2(y - o.y, x - o.x) * 180 / Math.PI / 5) * 5;
  }
  B.exported = BM.modelToLevel(B.model, B.story);
  draw(); if (drag.kind === "person" || drag.kind === "turn") { placeHer(); render3d(); }
});
window.addEventListener("mouseup", () => { if (!drag) return; const k = drag.kind; drag = null; if (k !== "pan" && k !== "measure") changed(); });
svg.addEventListener("wheel", e => {
  e.preventDefault();
  const x = wx(e.offsetX), y = wy(e.offsetY), f = Math.exp(-e.deltaY * 0.0015);
  B.view.s = Math.max(12, Math.min(260, B.view.s * f));
  B.view.cx = x - (e.offsetX - svg.clientWidth / 2) / B.view.s; B.view.cy = y + (e.offsetY - svg.clientHeight / 2) / B.view.s;
  draw();
}, { passive: false });

// edges snap to other rooms' edges within 20 cm, so rooms meet exactly and share their walls
function magnetMove(r) {
  const others = visibleRooms().filter(o => o !== r);
  let best = [0.2, 0], bestY = [0.2, 0];
  for (const o of others) {
    for (const [a, b] of [[r.x, o.x], [r.x, o.x + o.w], [r.x + r.w, o.x], [r.x + r.w, o.x + o.w]]) if (Math.abs(b - a) < best[0]) best = [Math.abs(b - a), b - a];
    for (const [a, b] of [[r.y, o.y], [r.y, o.y + o.d], [r.y + r.d, o.y], [r.y + r.d, o.y + o.d]]) if (Math.abs(b - a) < bestY[0]) bestY = [Math.abs(b - a), b - a];
  }
  r.x = r2(r.x + best[1]); r.y = r2(r.y + bestY[1]);
}
function magnetResize(r, h) {
  const others = visibleRooms().filter(o => o !== r);
  const near = (v, list) => { let b = null; for (const t of list) if (Math.abs(t - v) < 0.2 && (b === null || Math.abs(t - v) < Math.abs(b - v))) b = t; return b; };
  const xs = others.flatMap(o => [o.x, o.x + o.w]), ys = others.flatMap(o => [o.y, o.y + o.d]);
  if (h.includes("e")) { const t = near(r.x + r.w, xs); if (t !== null) r.w = r2(t - r.x); }
  if (h.includes("w")) { const t = near(r.x, xs); if (t !== null) { r.w = r2(r.x + r.w - t); r.x = t; } }
  if (h.includes("n")) { const t = near(r.y + r.d, ys); if (t !== null) r.d = r2(t - r.y); }
  if (h.includes("s")) { const t = near(r.y, ys); if (t !== null) { r.d = r2(r.y + r.d - t); r.y = t; } }
}

function addOpening(x, y) {
  let best = null;
  for (const r of visibleRooms()) for (const wl of BM.WALLS) {
    const ln = BM.wallLine(r, wl), a = ln.axis === "y" ? x : y, off = Math.abs((ln.axis === "y" ? y : x) - ln.v);
    if (off > 0.35 || a < ln.lo + 0.1 || a > ln.hi - 0.1) continue;
    if (!best || off < best.off) best = { ln, a, off, r };
  }
  if (!best) { status("click on a wall to put it there", "bad"); return; }
  const ref = B.tool === "ref" ? B.ref : null;
  if (B.tool === "ref" && !ref) { status("load a reference model first (References, left)", "bad"); return; }
  const type = ref ? ref.type : B.tool, D = OPENINGS[type];
  const gap = ref ? (+ref.gap || 0) : 0;
  const w = ref ? ref.w + 2 * gap : Math.min(D.w, best.ln.hi - best.ln.lo - 0.2);
  if (w > best.ln.hi - best.ln.lo - 0.12) { status(`the ${r2(w)} m ${type} doesn't fit on that ${r2(best.ln.hi - best.ln.lo)} m wall`, "bad"); return; }
  const c = Math.min(Math.max(Math.round(best.a / 0.05) * 0.05, best.ln.lo + w / 2 + 0.06), best.ln.hi - w / 2 - 0.06);
  let id = type === "arch" ? "arch" : type === "window" ? "window" : "door", i = 1;
  const base = best.r.id + "_" + id;
  while (B.model.ops.some(o => o.id === base + "_" + i)) i++;
  pushUndo();
  const op = BM.newOpening(type, base + "_" + i, best.ln, r2(c), floorZ(), ref ? { w: r2(w), h: r2(ref.h + 2 * gap), sill: type === "window" ? r2(ref.sill - gap) : 0 } : { w });
  if (ref) op.ref = ref.name;
  B.model.ops.push(op);
  B.sel = { op: op.id };
  changed();
}

function addRoom(kind) {
  const K = KINDS[kind];
  let i = 1; while (roomOf(kind + (i > 1 ? "_" + i : ""))) i++;
  const id = kind + (i > 1 ? "_" + i : "");
  pushUndo();
  const r = BM.newRoom(kind, id, snapV(B.view.cx - K.size[0] / 2), snapV(B.view.cy - K.size[1] / 2), floorZ());
  if (kind === "stairs") r.h = r2(STOREY + 2.4);
  B.model.rooms.push(r); B.sel = { room: id };
  changed();
}

// ---- the left panel ----
function renderTools() {
  const box = $("#tools"); box.innerHTML = "";
  for (const [t, label, tip] of [["select", "Select / move"], ["door", "Door"], ["slide", "Sliding door"], ["arch", "Opening"], ["window", "Window"],
                                  ["ref", "Reference cut-out", "cut a wall to the reference model chosen under References"], ["item", "Wall item", "a mirror, a poster, a TV... on the wall you click"],
                                  ["kit", "Furniture", "cabinets, built-ins, beds, sofas, tables, rugs, curtains, downlights: click in a room (ones that stand against a wall go to the nearest)"],
                                  ["fit", "Wall fitting", "switch plates, sockets, panels, vents: click near a wall"],
                                  ["measure", "Measure", "drag to measure (it snaps like a room)"]]) {
    const b = document.createElement("button"); b.textContent = label; b.className = B.tool === t ? "on" : ""; if (tip) b.title = tip;
    b.onclick = () => { B.tool = t; if (t !== "measure") B.measure = null; svg.style.cursor = t === "select" ? "default" : "crosshair"; renderTools(); draw(); };
    box.append(b);
  }
  if (B.tool === "item") {
    const sel = document.createElement("select"); sel.style.width = "100%"; sel.style.marginTop = "4px";
    for (const [k, W] of Object.entries(WALL_ITEMS)) sel.append(new Option(`${W.en} (${W.size[0] * 100}×${W.size[1] * 100} cm)`, k));
    sel.value = B.itemKind; sel.onchange = () => { B.itemKind = sel.value; };
    box.append(sel);
  }
  if (B.tool === "kit" || B.tool === "fit") {
    const sel = kitSelect(B.tool === "fit" ? (p, m) => m === "wall" : (p, m) => !["wall", "opening", "room-floor", "room-ceiling", "door"].includes(m),
                          B.tool === "fit" ? B.fitPreset : B.kitPreset, v => { if (B.tool === "fit") B.fitPreset = v; else B.kitPreset = v; });
    sel.style.width = "100%"; sel.style.marginTop = "4px";
    const a = document.createElement("a"); a.href = "kit.html"; a.target = "kitmaker"; a.textContent = "Kit maker ↗"; a.className = "hint"; a.title = "make your own presets (they show here once saved; reload this page)";
    box.append(sel, a);
  }
  if (B.tool === "ref") {
    const n = document.createElement("div"); n.className = "hint"; n.style.marginTop = "4px";
    n.textContent = B.ref ? `Cutting ${B.ref.name}: ${r2(B.ref.w * 100)} × ${r2(B.ref.h * 100)} cm${B.ref.type === "window" ? `, sill ${r2(B.ref.sill * 100)} cm` : ""}. Click a wall.` : "Load a model under References first.";
    box.append(n);
  }
  const kb = $("#kinds"); kb.innerHTML = "";
  for (const [k, K] of Object.entries(KINDS)) {
    const b = document.createElement("button"); b.style.borderLeftColor = K.color;
    b.innerHTML = `${K.en}<small>${K.ja}</small>`; b.title = `${K.en} ${K.ja}: ${K.size[0]} × ${K.size[1]} m`;
    b.onclick = () => addRoom(k); kb.append(b);
  }
}
function field(label, input) { const l = document.createElement("label"); l.textContent = label; return [l, input]; }
function num(v, on, step = 0.05) { const i = document.createElement("input"); i.type = "number"; i.step = step; i.value = r2(v); i.onchange = () => { pushUndo(); on(+i.value); changed(); }; return i; }
function txt(v, on) { const i = document.createElement("input"); i.type = "text"; i.value = v || ""; i.onchange = () => { pushUndo(); on(i.value.trim()); changed(); }; return i; }
function pick(v, opts, on) { const s = document.createElement("select"); for (const o of opts) s.append(new Option(Array.isArray(o) ? o[1] : o, Array.isArray(o) ? o[0] : o)); s.value = v; s.onchange = () => { pushUndo(); on(s.value); changed(); }; return s; }
function check(v, label, on) { const l = document.createElement("label"); const i = document.createElement("input"); i.type = "checkbox"; i.checked = !!v; i.onchange = () => { pushUndo(); on(i.checked); changed(); }; l.append(i, " " + label); return l; }

function renderProps() {
  const box = $("#props"); box.innerHTML = ""; box.className = "";
  $("#kitbox").innerHTML = "";
  const grid = document.createElement("div"); grid.className = "prop";
  if (B.sel && B.sel.room) {
    const r = roomOf(B.sel.room);
    if (!r) { B.sel = null; return renderProps(); }
    const K = KINDS[r.kind] || KINDS.other;
    const head = document.createElement("div"); head.innerHTML = `<b>${r.name || K.en}</b> <span class="hint">${K.ja} · 約${BM.jo(r).toFixed(1)}帖 · ${BM.area(r).toFixed(1)} m²</span>`;
    box.append(head);
    grid.append(...field("id", txt(r.id, v => renameRoom(r, v))), ...field("kind", pick(r.kind, Object.entries(KINDS).map(([k, K]) => [k, `${K.en} ${K.ja}`]), v => { r.kind = v; r.floor = KINDS[v].floor; })),
      ...field("name", txt(r.name, v => { r.name = v; })),
      ...field("x, y", wrap(num(r.x, v => { r.x = v; }), num(r.y, v => { r.y = v; }))), ...field("w × d", wrap(num(r.w, v => { r.w = Math.max(0.3, v); }), num(r.d, v => { r.d = Math.max(0.3, v); }))),
      ...field("height", num(r.h, v => { r.h = Math.max(0.5, v); })), ...field("floor", pick(r.floor, ["wood", "stone", "carpet", "tile", "dirt", "metal", "water"], v => { r.floor = v; })),
      ...field("light", pick(r.light, ["off", "dark", "dim", "lit"], v => { r.light = v; })));
    if (r.kind === "stairs") grid.append(...field("climbs", pick(r.dir, [["n", "north ↑"], ["e", "east →"], ["s", "south ↓"], ["w", "west ←"]], v => { r.dir = v; })));
    box.append(grid);
    const walls = document.createElement("div"); walls.className = "walls";
    walls.append("open sides:", ...BM.WALLS.map(wl => check(r.open.includes(wl), wl, on => { r.open = on ? [...r.open, wl] : r.open.filter(x => x !== wl); })));
    box.append(walls, check(r.ceiling, "ceiling", v => { r.ceiling = v; }), document.createElement("br"),
      check(r.fixtures, "built-ins (kitchen, bath, toilet, shoe cabinet, stairs)", v => { r.fixtures = v; }));
    box.append(surfaceEditor(r), lookEditor(r));
    const del = document.createElement("button"); del.textContent = "Remove room"; del.onclick = () => removeSel(); box.append(document.createElement("br"), del);
    const props = (r.extra.props || []).filter(p => !p.id.startsWith(r.id + "_fx_"));
    if (props.length) { const n = document.createElement("div"); n.className = "hint"; n.textContent = `${props.length} props from the story stay in this room (room space: they move with it).`; box.append(n); }
  } else if (B.sel && B.sel.op) {
    const op = B.model.ops.find(o => o.id === B.sel.op);
    if (!op) { B.sel = null; return renderProps(); }
    const host = hostOf(op);
    const head = document.createElement("div"); head.innerHTML = `<b>${{ door: "Door", slide: "Sliding door", arch: "Opening", window: "Window" }[op.type]}</b> <span class="hint">${host ? "on " + host.id : "not on a built wall"}</span>`;
    box.append(head);
    grid.append(...field("id", txt(op.id, v => { if (v && !B.model.ops.some(o => o.id === v)) { op.id = v; B.sel.op = v; } })),
      ...field("type", pick(op.type, ["door", "slide", "arch", "window"], v => { op.type = v; op.swing = v === "slide" ? "slide" : (op.swing === "slide" ? "in" : op.swing); if (v === "window" && !op.sill) { op.sill = 0.9; op.h = 1.1; } if (v !== "window") op.sill = 0; })),
      ...field("width", num(op.w, v => { op.w = Math.max(0.3, v); })), ...field("height", num(op.h, v => { op.h = Math.max(0.3, v); })));
    if (op.type === "window") grid.append(...field("sill", num(op.sill, v => { op.sill = Math.max(0, v); })));
    if (op.type === "door") grid.append(...field("swings", pick(op.swing, [["in", "into its room"], ["out", "out of it"]], v => { op.swing = v; })));
    if (op.type === "door" || op.type === "slide") grid.append(...field("locked by", txt(op.locked_by, v => { op.locked_by = v || null; })));
    box.append(grid);
    if (op.type === "door" || op.type === "slide") box.append(check(op.creak, "creaks", v => { op.creak = v; }));
    if (op.type === "window") box.append(windowEditor(op));
    if (op.type === "door" || op.type === "slide") box.append(doorEditor(op));
    const del = document.createElement("button"); del.textContent = "Remove"; del.onclick = () => removeSel(); box.append(document.createElement("br"), del);
  } else if (B.sel && B.sel.item) {
    const it = (B.model.items || []).find(i => i.id === B.sel.item);
    if (!it) { B.sel = null; return renderProps(); }
    const fitting = it.kind === "fit", P = fitting && it.kit && LIBRARY.kit[it.kit.preset];
    const head = document.createElement("div"); head.innerHTML = `<b>${fitting ? (P ? P.label : "Wall fitting") : WALL_ITEMS[it.kind].en}</b> <span class="hint">on ${it.room}'s ${it.wall} wall</span>`;
    box.append(head);
    if (fitting) grid.append(...field("fitting", kitSelect((p, m) => m === "wall", it.kit && it.kit.preset, v => { pushUndo(); const n = BM.newFitting(v, it.id, it.room, it.wall, it.a); Object.assign(it, { w: n.w, h: n.h, t: n.t, z: n.z, kit: n.kit }); changed(); })));
    else grid.append(...field("kind", pick(it.kind, Object.entries(WALL_ITEMS).map(([k, W]) => [k, W.en]), v => { const W = WALL_ITEMS[v]; it.kind = v; [it.w, it.h, it.t] = W.size; it.z = W.z; delete it.kit; it.id = it.id.replace(/_wi_[a-z0-9]+_/, `_wi_${v}_`); B.sel.item = it.id; })));
    grid.append(
      ...field("width", num(it.w, v => { it.w = Math.max(0.02, v); }, 0.01)), ...field("height", num(it.h, v => { it.h = Math.max(0.01, v); }, 0.01)),
      ...field("off the wall", num(it.t, v => { it.t = Math.max(0.002, v); }, 0.005)), ...field("middle at", num(it.z, v => { it.z = Math.max(it.h / 2, v); }, 0.05)));
    box.append(grid);
    const del = document.createElement("button"); del.textContent = "Remove"; del.onclick = () => removeSel(); box.append(document.createElement("br"), del);
  } else if (B.sel && B.sel.kit) {
    const k = (B.model.kits || []).find(q => q.id === B.sel.kit);
    if (!k) { B.sel = null; return renderProps(); }
    kitPanel(box, grid, k);
  } else { box.className = "hint"; box.textContent = "Nothing selected. Click a room, a door, a wall item or a piece of furniture."; }
}
function wrap(...xs) { const d = document.createElement("div"); d.style.display = "flex"; d.style.gap = "4px"; d.append(...xs); return d; }
function renameRoom(r, v) {
  if (!v || !/^[a-z][a-z0-9_]*$/.test(v) || roomOf(v)) { status("ids are snake_case and unique", "bad"); return; }
  const used = JSON.stringify(Object.assign({}, B.story, { levels: {} })).includes(`"${r.id}"`);
  if (used && !confirm(`Scenes or stitches name "${r.id}". Rename it anyway? (They'd need changing too.)`)) return;
  BM.renameItems(B.model, r.id, v);
  r.id = v; B.sel = { room: v };
}
function removeSel() {
  if (!B.sel) return;
  pushUndo();
  if (B.sel.room) { B.model.rooms = B.model.rooms.filter(r => r.id !== B.sel.room); B.model.items = (B.model.items || []).filter(i => i.room !== B.sel.room); B.model.kits = (B.model.kits || []).filter(k => k.room !== B.sel.room); }
  else if (B.sel.item) B.model.items = B.model.items.filter(i => i.id !== B.sel.item);
  else if (B.sel.kit) B.model.kits = B.model.kits.filter(k => k.id !== B.sel.kit);
  else B.model.ops = B.model.ops.filter(o => o.id !== B.sel.op);
  B.sel = null; changed();
}

function renderFloors() {
  const box = $("#floors"); box.innerHTML = "";
  B.model.floors.forEach((z, i) => {
    const b = document.createElement("button"); b.textContent = `${i + 1}F`; b.title = `floor at ${z} m`;
    b.className = i === B.floor ? "on" : ""; b.onclick = () => { B.floor = i; B.sel = null; renderFloors(); draw(); renderProps(); };
    box.append(b);
  });
  const add = document.createElement("button"); add.textContent = "+"; add.title = `add a floor ${STOREY} m above the top one`;
  add.onclick = () => { pushUndo(); B.model.floors.push(r2(B.model.floors[B.model.floors.length - 1] + STOREY)); B.floor = B.model.floors.length - 1; renderFloors(); changed(); };
  box.append(add);
}

// ---- stats: what the plan can hold ----
function renderStats() {
  renderScript();
  const st = BM.stats(B.model, B.exported.level), box = $("#stats");
  const fl = Object.entries(st.floorArea).sort((a, b) => a[0] - b[0]).map(([z, a], i) => `${i + 1}F ${a.toFixed(0)} m²`).join(", ");
  const rows = [
    ["Floor area", `${st.total.toFixed(0)} m² indoors (${(st.total / JO).toFixed(0)}帖)${st.floors > 1 ? ": " + fl : ""}`],
    ["Rooms, doors", `${st.rooms} rooms, ${st.doors} doors`],
    ["Ways round", st.loops > 0 ? `${st.loops} loop${st.loops > 1 ? "s" : ""}: a chase can circle (hide and seek, being followed)` : "no loop: every chase ends in a dead end (a flat; add a second door between two rooms for one)"],
    ["Hiding places", `${st.hiding} (closets, oshiire, storage, the bath)`],
    ["Dead ends", st.dead.length ? st.dead.join(", ") : "none"],
    ["Unreachable", st.unreachable.length ? st.unreachable.join(", ") : "none: every room is reached from the start"],
  ];
  box.innerHTML = rows.map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join("");
  const p = B.exported.problems;
  if (p.length) box.innerHTML += `<b style="color:var(--warn)">To fix</b><span style="color:var(--warn)">${p.join("; ")}</span>`;
}

// ---- checks and saving ----
async function runChecks() {
  const s = storyWithLevel();
  const j = await api("/api/worldcheck/" + encodeURIComponent(B.target), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
  const box = $("#msgs"); box.innerHTML = "";
  for (const e of j.errors) box.innerHTML += `<div class="e">✕ ${esc(e)}</div>`;
  for (const w of j.warnings.slice(0, 12)) box.innerHTML += `<div class="w">! ${esc(w)}</div>`;
  if (!j.errors.length) box.innerHTML = `<div class="ok">✓ the story and level checks pass on this plan</div>` + box.innerHTML;
  window.__lastCheck = j;
  return j;
}
const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
async function save(force) {
  const j = await runChecks();
  if (j.errors.length && !force && !confirm(`${j.errors.length} check error(s), the first: ${j.errors[0]}\n\nSave anyway?`)) return;
  const s = storyWithLevel();
  const r = await api("/api/story/" + encodeURIComponent(B.game), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ story: s, mtime: B.mtime, force }) });
  if (r._status === 409) { if (confirm(r.error + "\n\nOverwrite?")) return save(true); return; }
  B.story = s; B.mtime = r.mtime; B.dirty = false; B.level = B.target;
  const sel = $("#level"); for (const o of sel.options) if (o.value === B.target) o.textContent = B.target;
  status(`saved level ${B.target} into ${B.game}/story.json (the previous file is in Saved/Story/${B.game}/history); an open desk reloads it`);
  if (STORY_CH) STORY_CH.postMessage({ type: "saved", game: B.game, level: B.target });
  renderScript();
}

// ---- the player's eye (the desk's own stage: the same pieces the importer builds) ----
async function setupFigure() {
  if (!BodyFigure.soma) try { BodyFigure.soma = await api("/api/soma"); } catch (e) { }
  try {
    const bodies = (await api("/api/bodies")).bodies || [];
    const def = bodies.find(f => /^default\./i.test(f)) || bodies.find(f => !/_hi\.|_lod/i.test(f));
    if (def && !stage.bodies[def]) { stage.bodies[def] = await loadBody("/bodies/" + encodeURIComponent(def)); stage.defaultBody = def; }
  } catch (e) { console.warn("body", e); }
  replan();
}
function doors() { stage.world.traverse(o => { if (o.userData && (o.userData.kind === "door" || o.userData.doorPart === "handle")) o.visible = !$("#doorsOpen").checked; }); }
function addLamp() {
  lampLight = new THREE.PointLight(0xfff1dc, 1.6, 10, 1.5);
  stage.world.add(lampLight);
  stage.world.add(new THREE.AmbientLight(0x9aa0aa, 0.35));
  stage.scene.fog = new THREE.Fog(0x050506, 6, 22);
}
function placeHer() {
  if (!stage || !B.planStory) return;
  for (const f of Object.values(stage.cast)) f.group.visible = false;
  const [cid, c] = Object.entries(B.planStory.cast || {})[0] || [];
  if (!cid || !$("#showHer").checked) return;
  const f = stage.cast[cid], h = B.model.her;
  if (!f) return;
  f.update(M.fk(LIB, M.clonePose(LIB.poses.idle), +(c.height || 1.62)).pos);
  f.group.position.copy(s2t(h.x, h.y, h.z)); f.group.rotation.y = (h.yaw + 90) * Math.PI / 180;
  f.group.visible = true;
}
const look = { pitch: -4 };
function render3d() {
  if (!stage || !B.model) return;
  const p = B.model.player, eye = EYES[$("#eye").value], aspect = stage.camera.aspect || 16 / 9;
  stage.camera.fov = vfov(B.story.game.fov || FOV_H, aspect); stage.camera.updateProjectionMatrix();
  stage.camera.position.copy(s2t(p.x, p.y, p.z + eye));
  const a = p.yaw * Math.PI / 180, pt = look.pitch * Math.PI / 180;
  stage.camera.lookAt(s2t(p.x + Math.cos(a) * Math.cos(pt), p.y + Math.sin(a) * Math.cos(pt), p.z + eye + Math.sin(pt)));
  if (lampLight) { lampLight.visible = $("#lamp").checked; lampLight.position.copy(stage.camera.position); }
  stage.render();
  const h = B.model.her, d = Math.hypot(h.x - p.x, h.y - p.y);
  const v = s2t(h.x, h.y, h.z + 1.5).project(stage.camera), inView = v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1;
  const room = BM.roomAt(B.model, p.x, p.y, p.z);
  $("#viewHud").innerHTML = `${room ? (room.name || KINDS[room.kind].en) + " " + KINDS[room.kind].ja : "outside"} · eye ${(eye).toFixed(2)} m · fov ${B.story.game.fov || FOV_H}°` +
    ($("#showHer").checked && Math.abs(h.z - p.z) < 0.6 ? `<br>${herName()}: ${d.toFixed(1)} m away, ${SHOT_NAMES[shotFor(d)]}${inView ? "" : " (out of view)"}` : "") +
    `<br><span style="color:#aaa">click here, then WASD or arrows to walk, drag to look</span>`;
}

// walking: the built walls and props stop you; a step up to 35 cm is taken (stairs), down any height
const view = $("#view");
const keys = new Set();
view.addEventListener("keydown", e => { if (/^(Key[WASDQE]|Arrow)/.test(e.code)) { keys.add(e.code); e.preventDefault(); if (keys.size === 1) requestAnimationFrame(walk); } });
view.addEventListener("keyup", e => keys.delete(e.code));
view.addEventListener("blur", () => keys.clear());
let lastT = 0;
function walk(t) {
  if (!keys.size) { lastT = 0; changedPlayer(); return; }
  const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016; lastT = t;
  const p = B.model.player, a = p.yaw * Math.PI / 180, sp = 1.4 * dt;
  let f = 0, s = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) f += 1; if (keys.has("KeyS") || keys.has("ArrowDown")) f -= 1;
  if (keys.has("KeyA")) s += 1; if (keys.has("KeyD")) s -= 1;
  if (keys.has("ArrowLeft") || keys.has("KeyQ")) p.yaw += 90 * dt; if (keys.has("ArrowRight") || keys.has("KeyE")) p.yaw -= 90 * dt;
  const dx = (Math.cos(a) * f - Math.sin(a) * s) * sp, dy = (Math.sin(a) * f + Math.cos(a) * s) * sp;
  for (const [mx, my] of [[dx, 0], [0, dy]]) {
    const nx = p.x + mx, ny = p.y + my, z = ground(nx, ny, p.z);
    if (z !== null && !blocked(nx, ny, z)) { p.x = nx; p.y = ny; p.z = z; }
  }
  const fi = B.model.floors.findIndex(z => Math.abs(z - p.z) < 0.6);
  if (fi >= 0 && fi !== B.floor) { B.floor = fi; renderFloors(); }
  draw(); render3d();
  requestAnimationFrame(walk);
}
function changedPlayer() { B.exported = BM.modelToLevel(B.model, B.story); renderStats(); B.dirty = true; }
function solids(z) {
  return (B.plan ? B.plan.pieces : []).filter(q => q.level === B.target && (q.kind === "wall" || q.kind === "mesh") && !q.tags.includes("hollow") && !q.tags.some(t => t.startsWith("door_part:")) && q.pos[2] + q.size[2] / 2 > z + 0.36 && q.pos[2] - q.size[2] / 2 < z + 1.7);
}
function box2(q) { const rot = Math.abs(((q.yaw % 180) + 180) % 180 - 90) < 1; const w = rot ? q.size[1] : q.size[0], d = rot ? q.size[0] : q.size[1]; return [q.pos[0] - w / 2, q.pos[1] - d / 2, q.pos[0] + w / 2, q.pos[1] + d / 2]; }
function blocked(x, y, z) {
  const R = 0.22;
  return solids(z).some(q => { const [x0, y0, x1, y1] = box2(q); const cx = Math.max(x0, Math.min(x, x1)), cy = Math.max(y0, Math.min(y, y1)); return Math.hypot(x - cx, y - cy) < R; });
}
function ground(x, y, z) {
  let g = null;
  for (const r of B.model.rooms) if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.d && r.z <= z + 0.36) g = g === null ? r.z : Math.max(g, r.z);
  for (const q of (B.plan ? B.plan.pieces : [])) {
    if (q.level !== B.target || q.kind !== "mesh" || q.tags.includes("hollow") || q.tags.some(t => t.startsWith("door_part:"))) continue;
    const [x0, y0, x1, y1] = box2(q), top = q.pos[2] + q.size[2] / 2;
    if (x > x0 && x < x1 && y > y0 && y < y1 && top <= z + 0.36 && (g === null || top > g)) g = top;
  }
  return g;
}
let lookDrag = null;
view.addEventListener("mousedown", e => { lookDrag = { x: e.clientX, y: e.clientY, yaw: B.model.player.yaw, pitch: look.pitch }; view.focus(); });
window.addEventListener("mousemove", e => {
  if (!lookDrag) return;
  B.model.player.yaw = lookDrag.yaw - (e.clientX - lookDrag.x) * 0.25;
  look.pitch = Math.max(-60, Math.min(60, lookDrag.pitch - (e.clientY - lookDrag.y) * 0.25));
  draw(); render3d();
});
window.addEventListener("mouseup", () => { if (lookDrag) { lookDrag = null; changedPlayer(); } });

// ---- keys on the page ----
document.addEventListener("keydown", e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.target === view) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
  if (e.key === "Delete" || e.key === "Backspace") { removeSel(); e.preventDefault(); return; }
  if (e.key === "Escape") { B.tool = "select"; B.measure = null; renderTools(); B.sel = null; changed(false); return; }
  const kk = B.sel && B.sel.kit && B.model.kits.find(q => q.id === B.sel.kit);
  if (kk && e.key.toLowerCase() === "r") { pushUndo(); kk.rot = (kk.rot + (e.shiftKey ? 270 : 90)) % 360; changed(); return; }
  const kmv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
  if (kk && kmv) { pushUndo(); kk.x = r2(kk.x + kmv[0] * 0.05); kk.y = r2(kk.y + kmv[1] * 0.05); changed(); e.preventDefault(); return; }
  const r = B.sel && B.sel.room && roomOf(B.sel.room);
  if (r && e.key.toLowerCase() === "r") { pushUndo(); [r.w, r.d] = [r.d, r.w]; changed(); return; }
  const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
  if (r && mv) { pushUndo(); r.x = r2(r.x + mv[0] * B.snap); r.y = r2(r.y + mv[1] * B.snap); changed(); e.preventDefault(); }
});

// ---- boot ----
async function boot() {
  for (const P of PRESETS) $("#preset").append(new Option(P.name, P.id));
  $("#preset").onchange = () => { const v = $("#preset").value; $("#preset").value = ""; if (v.startsWith("other:")) { const [, g, l] = v.split(":"); openOther(g, l); } else openPreset(v); };
  $("#marks").onchange = () => draw();
  await loadAssetLibrary().catch(() => { });
  BM.KITS.presets = LIBRARY.kit;
  const css = document.createElement("style"); css.textContent = KIT_CSS; document.head.append(css);
  $("#game").onchange = () => loadGame($("#game").value);
  $("#level").onchange = () => {
    const v = $("#level").value;
    if (v === "__new") {
      const name = prompt("The new level's id (snake_case):", "home");
      if (!name || !/^[a-z][a-z0-9_]*$/.test(name) || B.story.levels[name]) { $("#level").value = B.target; return; }
      B.target = name; BM.uniquify(B.model, BM.takenIds(B.story, name), name);
      $("#level").insertBefore(new Option(name + " (new)", name), $("#level").lastChild); $("#level").value = name; changed();
    } else if (B.story.levels[v]) { if (!B.dirty || confirm("Open " + v + "? Unsaved changes here are lost.")) openLevel(v); else $("#level").value = B.target; }
    else { B.target = v; changed(); }
  };
  $("#snap").onchange = () => { B.snap = +$("#snap").value; };
  $("#grid").onchange = () => { B.grid = $("#grid").value; if (B.grid === "jp" && B.snap < 0.4) { B.snap = 0.455; $("#snap").value = "0.455"; } draw(); };
  $("#undo").onclick = undo; $("#redo").onclick = redo;
  $("#check").onclick = runChecks; $("#save").onclick = () => save(false);
  for (const id of ["#eye", "#lamp", "#showHer", "#doorsOpen"]) $(id).onchange = () => { placeHer(); doors(); draw(); render3d(); };
  renderTools();
  $("#planImage").onclick = savePlanImage;
  $("#refFile").onchange = e => { for (const f of e.target.files) loadRef(f); e.target.value = ""; };
  try { B.refs = JSON.parse(localStorage.getItem("builder.refs") || "[]"); } catch (e) { B.refs = []; }
  renderRefs();
  LIB = M.loadLibrary(await api("/api/poses"));
  stage = new Stage($("#view"), LIB);
  new ResizeObserver(() => { draw(); render3d(); }).observe($("#planBox"));
  new ResizeObserver(() => render3d()).observe($("#view"));
  $("#scaleNote").innerHTML = `A square is 1 m with 20 cm lines, as Unreal's prototype grid (or the 910 mm module: two make a tatami's length). The bodies are real size: Kimodo's SOMA skeleton stands 1.76 m with its eyes at 1.65 m, the player's eye here (docs/STORY_FORMAT.md §0); on the plan a person is 45 cm across the shoulders. Rooms read in 帖 at ${JO} m² as Japanese listings give them.`;
  await loadGames();
  window.__builderReady = true;
}
window.B = B; window.BM = BM;
window.builder = { openPreset, changed, save, runChecks, addRoom, addItem, loadRef, placeRefs, setTool: t => { B.tool = t; renderTools(); }, addOpening: (x, y, t) => { B.tool = t; addOpening(x, y); B.tool = "select"; }, render3d, undo, openOther, nodesHere, focusIds, addKit, snapKit, addCurtains, varyKit,
  resizeKitBy: (id, su, sv, x, y) => { const k = B.model.kits.find(q => q.id === id); pushUndo(); resizeKit({ k, su, sv, x0: k.x, y0: k.y, size: k.size.slice(), spec: JSON.parse(JSON.stringify(k.spec)) }, x, y); changed(); return k; }, setKitPreset: (t, v) => { if (t === "fit") B.fitPreset = v; else B.kitPreset = v; renderTools(); } };
boot().catch(e => { console.error(e); status(e.message, "bad"); });

// ---- wall items ----
const WALL_T = 0.1;
function itemRoom(it) { return roomOf(it.room); }
function wallCoord(it, x, y) { const r = itemRoom(it); return it.wall === "n" || it.wall === "s" ? x - r.x : y - r.y; }
function itemRect(it) {                 // world x0 y0 x1 y1 of its footprint against the wall
  const r = itemRoom(it), ln = BM.wallLine(r, it.wall), c = ln.lo + it.a, f = WALL_T / 2, t = Math.max(it.t, 0.03);
  if (it.wall === "n") return [c - it.w / 2, ln.v - f - t, c + it.w / 2, ln.v - f];
  if (it.wall === "s") return [c - it.w / 2, ln.v + f, c + it.w / 2, ln.v + f + t];
  if (it.wall === "e") return [ln.v - f - t, c - it.w / 2, ln.v - f, c + it.w / 2];
  return [ln.v + f, c - it.w / 2, ln.v + f + t, c + it.w / 2];
}
const ITEM_COL = { mirror: "#bfd6e6", tv: "#202228", poster: "#c79a6b", frame: "#c79a6b", calendar: "#e6dcc8", ac: "#f2f2ee", board: "#f2f2ee", clock: "#d9a441", shelf: "#a07a45", switch: "#f2f2ee" };
function drawItem(it) {
  const r = itemRoom(it);
  if (!r || !(onFloor(r))) return;
  const [x0, y0, x1, y1] = itemRect(it), sel = B.sel && B.sel.item === it.id;
  const g = el("g", { "data-item": it.id, style: "cursor:pointer" });
  el("rect", { x: sx(x0), y: sy(y1), width: (x1 - x0) * B.view.s, height: (y1 - y0) * B.view.s, fill: ITEM_COL[it.kind] || "#ccc", stroke: sel ? "#d9a441" : "#111", "stroke-width": sel ? 2 : 1, "data-item": it.id }, g);
  el("rect", { x: sx(x0) - 4, y: sy(y1) - 4, width: (x1 - x0) * B.view.s + 8, height: (y1 - y0) * B.view.s + 8, fill: "transparent", "data-item": it.id }, g);
}
function addItem(x, y, fitPreset) {
  // the room you clicked in, and its wall nearest the click
  const r = BM.roomAt(B.model, x, y, floorZ());
  if (!r) { status("click inside a room, near the wall", "bad"); return; }
  const d = { s: y - r.y, n: r.y + r.d - y, w: x - r.x, e: r.x + r.w - x };
  const wall = Object.entries(d).sort((a, b) => a[1] - b[1])[0][0];
  if (d[wall] > 0.6) { status("click nearer the wall (within 60 cm)", "bad"); return; }
  if (r.open.includes(wall)) { status("that side is open: no wall to hang it on", "bad"); return; }
  const a = Math.round(((wall === "n" || wall === "s") ? x - r.x : y - r.y) / 0.05) * 0.05;
  const idOf = i => fitPreset ? `${r.id}_wf_${i}` : `${r.id}_wi_${B.itemKind}_${i}`;
  let i = 1; while ((B.model.items || []).some(it => it.id === idOf(i))) i++;
  pushUndo();
  const it = fitPreset ? BM.newFitting(fitPreset, idOf(i), r.id, wall, a) : BM.newItem(B.itemKind, idOf(i), r.id, wall, a);
  B.model.items.push(it); B.sel = { item: it.id };
  changed();
}

// ---- measuring ----
function snapPt(x, y) { return [Math.round(x / 0.05) * 0.05, Math.round(y / 0.05) * 0.05]; }
function drawMeasure() {
  const [a, b] = [B.measure.a, B.measure.b], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  el("line", { x1: sx(a[0]), y1: sy(a[1]), x2: sx(b[0]), y2: sy(b[1]), stroke: "#6fb3d9", "stroke-width": 2 });
  for (const p of [a, b]) el("circle", { cx: sx(p[0]), cy: sy(p[1]), r: 3, fill: "#6fb3d9" });
  const t = el("text", { x: (sx(a[0]) + sx(b[0])) / 2 + 8, y: (sy(a[1]) + sy(b[1])) / 2 - 8, fill: "#6fb3d9", "font-size": 13 });
  t.textContent = `${L.toFixed(2)} m` + (L > 0.4 ? ` (${(L / MODULE).toFixed(1)} modules)` : "");
}

// ---- the finish: skirting, cornice, door casings, lights ----
function renderFinish() {
  const box = $("#finish"); if (!box || !B.model) return;
  const f = B.model.finish; box.innerHTML = "";
  const cm = (label, key, tip) => { const i = num(f[key] * 100, v => { f[key] = Math.max(0, v) / 100; renderFinish(); }, 0.5); i.title = tip; const l = document.createElement("label"); l.textContent = label; l.title = tip; return [l, i]; };
  const grid = document.createElement("div"); grid.className = "prop";
  grid.append(...cm("skirting, cm", "skirting", "the board along the foot of every wall (0: none); Japanese homes: 4 to 8 cm"),
              ...cm("cornice, cm", "cornice", "a moulding where the wall meets the ceiling (mawaribuchi; 0: none)"),
              ...cm("door casing, cm", "casing", "the frame round every door and opening, both sides (0: none)"),
              ...cm("threshold, cm", "threshold", "a strip across a doorway where the floor changes, wood to tile (0: none)"));
  const floors = document.createElement("button"); floors.textContent = "Floors by room kind";
  floors.title = "every room without a floor gets its kind's: planks in the living rooms, tatami in a washitsu, tiles in the wet rooms, stone in the genkan";
  floors.onclick = () => { pushUndo(); let n = 0; for (const r of B.model.rooms) if (!r.floorKit && FLOOR_BY_KIND[r.kind]) { r.floorKit = { preset: FLOOR_BY_KIND[r.kind] }; n++; } changed(); status(`${n} rooms got a floor`); };
  const doorsAll = document.createElement("button"); doorsAll.textContent = "Doors in every doorway";
  doorsAll.title = "a panelled door on hinges (with its frame and handle) in every hinged doorway, a flush slider in every sliding one; each door's kind and handle are yours to change";
  doorsAll.onclick = () => { pushUndo(); let n = 0; for (const op of B.model.ops) if ((op.type === "door" || op.type === "slide") && !(op.extra || {}).kit) { op.extra = Object.assign({}, op.extra, { kit: { preset: op.type === "slide" ? "door_slide" : "door_panels" } }); n++; } changed(); status(`${n} doorways got a door`); };
  const frames = document.createElement("button"); frames.textContent = "Frames in every window";
  frames.onclick = () => { pushUndo(); let n = 0; for (const op of B.model.ops) if (op.type === "window" && !op.frame) { op.frame = { preset: "window_slide" }; n++; } changed(); status(`${n} windows got a frame`); };
  box.append(grid,
    check(f.lights, "a ceiling light in every room", v => { f.lights = v; renderFinish(); }), document.createElement("br"),
    check(f.switches, "its switch by the door (an interactable)", v => { f.switches = v; renderFinish(); }), document.createElement("br"), floors, " ", frames, " ", doorsAll);
}

// ---- reference models: a window or a door you'll place in Unreal, measured here so the wall is cut to fit ----
function saveRefs() { localStorage.setItem("builder.refs", JSON.stringify(B.refs.map(({ obj, ...r }) => r))); }
async function loadRef(file) {
  const url = URL.createObjectURL(file);
  try {
    const obj = /\.fbx$/i.test(file.name) ? await new FBXLoader().loadAsync(url) : (await new GLTFLoader().loadAsync(url)).scene;
    let box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
    let scale = Math.max(size.x, size.y, size.z) > 10 ? 0.01 : 1;            // a file in centimetres (Unreal, most FBX)
    obj.scale.multiplyScalar(scale);
    let rotY = 0;
    if (size.z > size.x) { obj.rotation.y = Math.PI / 2; rotY = 90; }        // its width along x, its depth along z
    obj.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(obj); size = box.getSize(new THREE.Vector3());
    const name = file.name.replace(/\.[^.]+$/, "");
    const old = B.refs.find(r => r.name === name);
    const guess = size.y > 1.75 ? (size.x > 1.3 ? "slide" : "door") : "window";
    const ref = Object.assign(old || { name, type: guess, sill: guess === "window" ? 0.9 : 0, gap: 0 }, { w: r2s(size.x), h: r2s(size.y), d: r2s(size.z), scale, rotY, obj });
    if (!old) B.refs.push(ref);
    B.ref = ref; B.tool = "ref"; saveRefs(); renderRefs(); renderTools(); placeRefs(); render3d();
    status(`${name}: ${ref.w * 100} × ${ref.h * 100} cm, ${ref.d * 100} cm deep${scale !== 1 ? " (read as centimetres)" : ""}. Click a wall to cut it.`);
  } catch (e) { status("couldn't read " + file.name + ": " + e.message, "bad"); }
}
const r2s = v => Math.round(v * 1000) / 1000;
function renderRefs() {
  const box = $("#refs"); if (!box) return; box.innerHTML = "";
  if (!B.refs.length) { box.innerHTML = '<div class="hint">None yet. A window or door model you\'ll use in Unreal (.glb, .gltf, .fbx): the wall is cut to its exact size; it\'s shown in the 3D view and never saved into the story.</div>'; return; }
  for (const ref of B.refs) {
    const d = document.createElement("div"); d.style.cssText = "border:1px solid var(--line);border-radius:4px;padding:4px;margin-bottom:4px" + (B.ref === ref ? ";border-color:var(--accent)" : "");
    const t = document.createElement("div"); t.innerHTML = `<b>${esc(ref.name)}</b> <span class="hint">${ref.obj ? "" : "(size only: load the file again to see it)"}</span>`;
    const g = document.createElement("div"); g.className = "prop";
    const n = (v, on, step = 0.5) => { const i = document.createElement("input"); i.type = "number"; i.step = step; i.value = r2(v * 100); i.onchange = () => { on(+i.value / 100); saveRefs(); renderRefs(); renderTools(); }; return i; };
    const tp = document.createElement("select"); for (const o of ["window", "door", "slide"]) tp.append(new Option(o, o)); tp.value = ref.type; tp.onchange = () => { ref.type = tp.value; saveRefs(); renderTools(); };
    g.append(...field("type", tp), ...field("w × h, cm", wrap(n(ref.w, v => { ref.w = v; }), n(ref.h, v => { ref.h = v; }))),
             ...field("sill, cm", n(ref.sill, v => { ref.sill = v; })), ...field("gap, mm", (() => { const i = document.createElement("input"); i.type = "number"; i.step = 1; i.value = (ref.gap || 0) * 1000; i.title = "clearance all round between the model and the cut (0: a tight fit)"; i.onchange = () => { ref.gap = +i.value / 1000; saveRefs(); renderTools(); }; return i; })()));
    const use = document.createElement("button"); use.textContent = "Cut with it"; use.onclick = () => { B.ref = ref; B.tool = "ref"; renderRefs(); renderTools(); };
    const fit = document.createElement("button"); fit.textContent = "Refit cuts"; fit.title = "every opening cut with this model takes its size again";
    fit.onclick = () => { pushUndo(); for (const op of B.model.ops) if (op.ref === ref.name) { op.w = r2(ref.w + 2 * (ref.gap || 0)); op.h = r2(ref.h + 2 * (ref.gap || 0)); if (op.type === "window") op.sill = r2(ref.sill - (ref.gap || 0)); } changed(); };
    const rm = document.createElement("button"); rm.textContent = "×"; rm.onclick = () => { B.refs = B.refs.filter(x => x !== ref); if (B.ref === ref) B.ref = null; saveRefs(); renderRefs(); };
    d.append(t, g, use, fit, rm); box.append(d);
  }
}
function placeRefs() {
  if (!stage) return;
  for (const o of stage.world.children.filter(c => c.userData && c.userData.ref)) stage.world.remove(o);
  for (const op of B.model.ops) {
    const ref = op.ref && B.refs.find(r => r.name === op.ref && r.obj);
    if (!ref) continue;
    const o = ref.obj.clone(true), holder = new THREE.Group();
    const box = new THREE.Box3().setFromObject(o), c = box.getCenter(new THREE.Vector3());
    o.position.sub(c); holder.add(o); holder.userData.ref = true;
    const zc = op.z + (op.type === "window" ? op.sill + (ref.gap || 0) : (ref.gap || 0)) + ref.h / 2;
    holder.position.copy(op.axis === "y" ? s2t(op.c, op.v, zc) : s2t(op.v, op.c, zc));
    if (op.axis === "x") holder.rotation.y = Math.PI / 2;
    stage.world.add(holder);
  }
}

// ---- the plan as a picture (SVG: open it anywhere, or as a backdrop in Unreal) ----
function savePlanImage() {
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", SVGNS); clone.setAttribute("width", svg.clientWidth); clone.setAttribute("height", svg.clientHeight);
  const bg = document.createElementNS(SVGNS, "rect"); bg.setAttribute("width", "100%"); bg.setAttribute("height", "100%"); bg.setAttribute("fill", "#141417");
  clone.insertBefore(bg, clone.firstChild);
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${B.target || "plan"}_${B.floor + 1}F.svg`; a.click();
}

// ---- the script on this level: its marks on the plan, its scenes and stitches, played in the desk ----
function nodesHere() {
  const st = B.story, out = [];
  const only = Object.keys(st.levels || {}).length === 1 ? Object.keys(st.levels)[0] : null;
  for (const [nid, n] of Object.entries(st.flow || {})) {
    const ref = n.type === "scene" ? (st.scenes || {})[n.ref] : n.type === "stitch" ? (st.stitches || {})[n.ref] : null;
    if (!ref) continue;
    const lvl = ref.level || only;
    if (lvl === B.target || (lvl === B.level && B.target === B.level)) out.push({ nid, n, ref, title: ref.title || n.ref });
  }
  return out;
}
function focusIds() {
  if (!B.focus || !B.story.flow[B.focus]) return new Set();
  const n = B.story.flow[B.focus], ref = n.type === "scene" ? B.story.scenes[n.ref] : B.story.stitches[n.ref];
  const txt = JSON.stringify(ref || {}), ids = new Set();
  for (const m of txt.matchAll(/"([a-z][a-z0-9_]*)"/g)) ids.add(m[1]);
  return ids;
}
function drawMarks() {
  if (!B.plan) return;
  const hot = focusIds(), z0 = floorZ();
  for (const p of B.plan.pieces) {
    if (p.level !== B.target || Math.abs(p.pos[2] - (p.kind === "mesh" ? p.size[2] / 2 : 0) - z0) > 1.2) continue;
    const use = (p.tags.find(t => t.startsWith("use:")) || "").slice(4);
    const id = p.id;
    if (p.kind === "spot" || p.kind === "start") {
      const a = (p.yaw || 0) * Math.PI / 180, x = sx(p.pos[0]), y = sy(p.pos[1]), on = hot.has(id) || hot.has((p.d || {}).id);
      const col = p.kind === "start" ? "#d9a441" : on ? "#ff6b5a" : "#8fd18f";
      el("path", { d: `M${x + Math.cos(a) * 9} ${y - Math.sin(a) * 9}L${x + Math.cos(a + 2.5) * 6} ${y - Math.sin(a + 2.5) * 6}L${x + Math.cos(a - 2.5) * 6} ${y - Math.sin(a - 2.5) * 6}Z`, fill: col, "fill-opacity": on ? 1 : 0.8 });
      if ((B.view.s > 40 || on) && p.kind !== "start") el("text", { x: x + 8, y: y - 6, fill: col, "font-size": on ? 11 : 9 }).textContent = id;
    } else if (p.kind === "light" && !id.endsWith("_fx_light")) {
      el("circle", { cx: sx(p.pos[0]), cy: sy(p.pos[1]), r: 5, fill: "none", stroke: "#ffd27a", "stroke-width": 1.5 });
    } else if (p.kind === "mesh" && use && use !== "spot") {
      const on = hot.has(id), x = sx(p.pos[0]), y = sy(p.pos[1]);
      el("path", { d: `M${x} ${y - 6}L${x + 6} ${y}L${x} ${y + 6}L${x - 6} ${y}Z`, fill: on ? "#ff6b5a" : "#6fb3d9", "fill-opacity": 0.9 });
      if (B.view.s > 60 || on) el("text", { x: x + 8, y: y + 4, fill: on ? "#ff6b5a" : "#6fb3d9", "font-size": 9 }).textContent = `${id} (${use})`;
    }
  }
}
function renderScript() {
  const box = $("#script"); if (!box || !B.story) return;
  const here = nodesHere();
  box.innerHTML = "";
  if (!here.length) { box.innerHTML = `<div class="hint">No scene or stitch is set on ${esc(B.target || "this level")} yet${B.target !== B.level ? " (it's new: save it, then give scenes this level)" : ""}.</div>`; return; }
  for (const { nid, n, title } of here) {
    const row = document.createElement("div"); row.style.cssText = "display:flex;gap:4px;align-items:center;margin:2px 0";
    const lab = document.createElement("span"); lab.style.flex = "1"; lab.innerHTML = `<span class="hint">${n.type}</span> ${esc(title)}`;
    if (B.focus === nid) lab.style.color = "#ff6b5a";
    const show = document.createElement("button"); show.textContent = "marks"; show.title = "highlight the spots and things this one uses";
    show.onclick = () => { B.focus = B.focus === nid ? null : nid; renderScript(); draw(); };
    const play = document.createElement("button"); play.textContent = "▶ in the desk"; play.title = "play it in the director's desk (save first to see your edits there)";
    play.onclick = async () => {
      if (B.dirty && B.target === B.level && confirm("Save the level first, so the desk plays your edits?")) await save(false);
      window.open(`index.html?game=${encodeURIComponent(B.game)}&node=${encodeURIComponent(nid)}&watch=1`, "desk");
    };
    row.append(lab, show, play); box.append(row);
  }
}

// ---- another game's level as a start ----
async function loadOthers() {
  const games = (await api("/api/games")).games.filter(g => g !== B.game);
  const sel = $("#preset");
  sel.querySelectorAll("optgroup.other").forEach(o => o.remove());
  const grp = document.createElement("optgroup"); grp.label = "From another game's script"; grp.className = "other";
  for (const g of games) {
    try { const j = await api("/api/story/" + encodeURIComponent(g)); B.others[g] = j.story; for (const l of Object.keys(j.story.levels || {})) grp.append(new Option(`${g}: ${l}`, `other:${g}:${l}`)); } catch (e) { }
  }
  if (grp.children.length) sel.append(grp);
}
function openOther(game, level) {
  const st = B.others[game];
  if (!st || !st.levels[level]) return;
  if (B.dirty && !confirm("Replace the plan with " + game + "'s " + level + "? (Undo brings it back.)")) return;
  pushUndo();
  let name = level, i = 2;
  while (B.story.levels[name]) name = `${level}_${i++}`;
  B.model = BM.uniquify(BM.borrowLevel(st, level), BM.takenIds(B.story, name), name);
  B.target = name;
  const sel = $("#level");
  if (![...sel.options].some(o => o.value === name)) sel.insertBefore(new Option(name + " (new)", name), sel.lastChild);
  sel.value = name;
  afterLoad(`${game}'s ${level}: its rooms, doors, trim and plain props (what you use, people and the start stay with ${game})`);
  B.dirty = true;
}

// ---- a room's look: texture sets for its floor, walls, ceiling and trim ----
function lookEditor(r) {
  const wrapEl = document.createElement("div"); wrapEl.style.marginTop = "6px";
  const look = r.extra.look || {};
  const opts = [...new Set([...Object.keys(LIBRARY.textures || {}), ...KNOWN_LOOKS, ...Object.values(look)])].filter(Boolean).sort();
  const g = document.createElement("div"); g.className = "prop";
  for (const part of ["floor", "walls", "ceiling", "trim"]) {
    const sel = pick(look[part] || "", [["", "(grey)"], ...opts.map(o => [o, o.replace(/^ambientcg\//, "") + (LIBRARY.textures && LIBRARY.textures[o] ? "" : " (not fetched)")])], v => {
      r.extra.look = Object.assign({}, r.extra.look || {}); if (v) r.extra.look[part] = v; else delete r.extra.look[part];
      if (!Object.keys(r.extra.look).length) delete r.extra.look;
    });
    g.append(...field(part, sel));
  }
  const same = document.createElement("button"); same.textContent = `Same look for every ${(KINDS[r.kind] || KINDS.other).en.toLowerCase()}`;
  same.onclick = () => { pushUndo(); for (const o of B.model.rooms) if (o.kind === r.kind && o !== r) { if (r.extra.look) o.extra.look = JSON.parse(JSON.stringify(r.extra.look)); else delete o.extra.look; } changed(); };
  const h = document.createElement("div"); h.className = "hint"; h.textContent = "Look (texture sets; fetch more with cc0.py textures <word> and get)";
  wrapEl.append(h, g, same);
  return wrapEl;
}

// ---- the kit (docs/KIT.md): furniture and built-ins placed in rooms, fittings on walls, floors, ceiling steps, window frames ----
function kitSelect(filter, value, on) {
  const sel = document.createElement("select"), by = {};
  for (const [n, p] of Object.entries(LIBRARY.kit || {})) {
    let m; try { m = BM.mountOf({ preset: n }); } catch (e) { continue; }
    if (!filter(p, m)) continue;
    const cat = p.cat || (KIT.TYPES[p.type] || {}).cat || "furniture"; (by[cat] = by[cat] || []).push([n, p]);
  }
  for (const [cat, title] of Object.entries(KIT.CATS)) {
    if (!by[cat]) continue;
    const g = document.createElement("optgroup"); g.label = title;
    for (const [n, p] of by[cat]) g.append(new Option(p.label + (p.user ? " (yours)" : ""), n));
    sel.append(g);
  }
  if (value && [...sel.options].some(o => o.value === value)) sel.value = value; else if (sel.options.length) on(sel.value);
  sel.onchange = () => on(sel.value);
  return sel;
}
function addKit(x, y) {
  const r = BM.roomAt(B.model, x, y, floorZ());
  if (!r) { status("click inside a room", "bad"); return; }
  const preset = B.kitPreset;
  if (!preset || !LIBRARY.kit[preset]) { status("pick what to place first", "bad"); return; }
  let i = 1; while ((B.model.kits || []).some(k => k.id === `${r.id}_kt_${preset}_${i}`)) i++;
  pushUndo();
  const k = BM.newKit(preset, `${r.id}_kt_${preset}_${i}`, r.id, r2(Math.round((x - r.x) / 0.05) * 0.05), r2(Math.round((y - r.y) / 0.05) * 0.05));
  const mount = BM.mountOf(k.spec);
  if (mount === "ceiling") k.z = +(r.h - k.size[2]).toFixed(4);
  if (mount === "on") {                                  // a cushion: on whatever's under it, at its seat
    const under = kitUnder(r, x - r.x, y - r.y, k.id);
    if (under) { k.z = +restHeight(under).toFixed(3); k.extra = Object.assign({}, k.extra, { on: under.id }); k.rot = under.rot; }
  }
  if (mount === "back") snapKit(k, 99);
  (B.model.kits = B.model.kits || []).push(k); B.sel = { kit: k.id };
  changed();
}
// against the nearest wall within `reach` m: its back to the wall, its front to the room
function snapKit(k, reach = 0.3) {
  const r = roomOf(k.room); if (!r) return;
  const T = WALL_T / 2 + 0.002, rot = ((k.rot % 360) + 360) % 360, [w, d] = k.size;
  const dist = { s: k.y, n: r.d - k.y, w: k.x, e: r.w - k.x };
  const wl = Object.keys(dist).filter(x => !r.open.includes(x)).sort((a, b) => dist[a] - dist[b])[0];
  if (!wl || dist[wl] - d / 2 - T > reach) return;
  k.rot = BM.FACE[wl];
  const half = d / 2 + T, along = wl === "n" || wl === "s" ? [k.x, w / 2, r.w] : [k.y, w / 2, r.d];
  const a = Math.min(Math.max(along[0], along[1] + T), along[2] - along[1] - T);
  if (wl === "n") { k.y = r2(r.d - half); k.x = r2(a); } else if (wl === "s") { k.y = r2(half); k.x = r2(a); }
  else if (wl === "e") { k.x = r2(r.w - half); k.y = r2(a); } else { k.x = r2(half); k.y = r2(a); }
  void rot;
}
function kitCorners(k) {
  const r = roomOf(k.room), a = k.rot * Math.PI / 180, ax = [Math.cos(a), Math.sin(a)], ay = [-Math.sin(a), Math.cos(a)], [w, d] = k.size;
  const c = (u, v) => [r.x + k.x + ax[0] * u + ay[0] * v, r.y + k.y + ax[1] * u + ay[1] * v];
  return { box: [c(-w / 2, -d / 2), c(w / 2, -d / 2), c(w / 2, d / 2), c(-w / 2, d / 2)], front: [c(-w / 2, -d / 2), c(w / 2, -d / 2)] };
}
function drawKit(k) {
  const r = roomOf(k.room);
  if (!r || !onFloor(r)) return;
  const { box, front } = kitCorners(k), sel = B.sel && B.sel.kit === k.id, ceil = BM.mountOf(k.spec) === "ceiling";
  const g = el("g", { "data-kit": k.id, style: "cursor:move" });
  el("polygon", { points: box.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" "), fill: ceil ? "none" : "#c9b48f", "fill-opacity": 0.5, stroke: sel ? "#d9a441" : "#e8dcc2",
    "stroke-width": sel ? 2 : 1, "stroke-dasharray": ceil ? "3 3" : "none", "data-kit": k.id }, g);
  el("line", { x1: sx(front[0][0]), y1: sy(front[0][1]), x2: sx(front[1][0]), y2: sy(front[1][1]), stroke: sel ? "#d9a441" : "#f6eedd", "stroke-width": 3, "data-kit": k.id }, g);
  const P = LIBRARY.kit[(k.spec || {}).preset];
  if (B.view.s * Math.min(k.size[0], k.size[1]) > 26) {
    const cx = box.reduce((s, p) => s + p[0], 0) / 4, cy = box.reduce((s, p) => s + p[1], 0) / 4;
    el("text", { x: sx(cx), y: sy(cy) + 3, "text-anchor": "middle", fill: "#f6eedd", "font-size": 9 }, g).textContent = (P ? P.label : k.spec.type || "kit").split(/[,:(]/)[0].slice(0, 22);
  }
}
function kitPanel(box, grid, k) {
  const P = LIBRARY.kit[(k.spec || {}).preset], full = (() => { try { return KIT.withDefaults(KIT.resolve(Object.assign({}, k.spec, { size: k.size }), LIBRARY.kit)); } catch (e) { return null; } })();
  const head = document.createElement("div"); head.innerHTML = `<b>${P ? P.label : "Kit thing"}</b> <span class="hint">in ${k.room} · R turns it, the arrows nudge it</span>`;
  box.append(head);
  grid.append(...field("id", txt(k.id, v => { if (v && !B.model.kits.some(q => q.id === v)) { k.id = v.startsWith(k.room + "_kt_") ? v : `${k.room}_kt_${v}`; B.sel.kit = k.id; } })),
    ...field("x, y", wrap(num(k.x, v => { k.x = v; }), num(k.y, v => { k.y = v; }))),
    ...field("up from floor", num(k.z, v => { k.z = Math.max(0, v); })), ...field("faces", pick(String(k.rot), [["0", "south ↓"], ["90", "east →"], ["180", "north ↑"], ["270", "west ←"]], v => { k.rot = +v; })),
    ...field("w × d × h", wrap(...[0, 1, 2].map(i => Object.assign(num(k.size[i], v => { k.size[i] = Math.max(0.005, v); }, 0.01), { style: "width:50px" })))));
  box.append(grid);
  if (full) {
    kitBox(`${P ? P.label : KIT.TYPES[full.type].label}: its numbers`, kitForm(full, nf => { pushUndo(); const o = kitOverrides(nf, (k.spec || {}).preset, LIBRARY.kit); delete o.size; k.spec = o; k.size = nf.size.slice(); changed(); }, { noSize: true, presets: LIBRARY.kit }));
  }
  const row = document.createElement("div"); row.style.cssText = "display:flex;gap:4px;margin-top:6px;flex-wrap:wrap";
  const sn = document.createElement("button"); sn.textContent = "Back to the wall"; sn.onclick = () => { pushUndo(); snapKit(k, 99); changed(); };
  const vy = document.createElement("button"); vy.textContent = "🎲 Vary"; vy.title = "another layout and other details, the same size (Ctrl+Z goes back)";
  vy.onclick = () => varyKit(k);
  const mk = document.createElement("button"); mk.textContent = "Open in the kit maker ↗";
  mk.onclick = () => window.open("kit.html#" + encodeURIComponent(JSON.stringify(Object.assign({}, k.spec, { size: k.size }))), "kitmaker");
  const del = document.createElement("button"); del.textContent = "Remove"; del.onclick = () => removeSel();
  row.append(vy, sn, mk, del); box.append(row);
}
// a room's floor (a pattern of tiles, planks or tatami with real gaps) and its ceiling step
function surfaceEditor(r) {
  const d = document.createElement("div"); d.style.marginTop = "6px";
  const g = document.createElement("div"); g.className = "prop";
  const opt = mount => [["", "(none)"], ...Object.entries(LIBRARY.kit || {}).filter(([n]) => BM.mountOf({ preset: n }) === mount).map(([n, p]) => [n, p.label])];
  g.append(...field("floor", pick((r.floorKit || {}).preset || "", opt("room-floor"), v => { r.floorKit = v ? { preset: v } : null; })),
           ...field("ceiling", pick((r.ceilKit || {}).preset || "", opt("room-ceiling"), v => { r.ceilKit = v ? { preset: v } : null; })));
  d.append(g);
  if (r.floorKit) {
    let full = null; try { full = KIT.withDefaults(KIT.resolve(r.floorKit, LIBRARY.kit)); } catch (e) { }
    if (full) {
      const same = document.createElement("button"); same.textContent = `This floor in every ${(KINDS[r.kind] || KINDS.other).en.toLowerCase()}`;
      same.onclick = () => { pushUndo(); for (const o of B.model.rooms) if (o.kind === r.kind) o.floorKit = JSON.parse(JSON.stringify(r.floorKit)); changed(); };
      kitBox(`${r.name || r.id}'s floor: the gaps, the seed, the pattern`, kitForm(full, nf => { pushUndo(); const o = kitOverrides(nf, r.floorKit.preset, LIBRARY.kit); delete o.size; r.floorKit = o; changed(); }, { noSize: true, presets: LIBRARY.kit }), same);
    }
  }
  return d;
}
function windowEditor(op) {
  const d = document.createElement("div"); d.style.marginTop = "6px";
  const g = document.createElement("div"); g.className = "prop";
  const opts = [["", "(none: a hole)"], ...Object.entries(LIBRARY.kit || {}).filter(([n]) => BM.mountOf({ preset: n }) === "opening").map(([n, p]) => [n, p.label])];
  g.append(...field("frame", pick((op.frame || {}).preset || "", opts, v => { op.frame = v ? { preset: v } : null; })));
  d.append(g);
  if (op.frame) {
    let full = null; try { full = KIT.withDefaults(KIT.resolve(op.frame, LIBRARY.kit)); } catch (e) { }
    if (full) {
      kitBox(`${op.id}'s frame (its size is the window's)`, kitForm(full, nf => { pushUndo(); const o = kitOverrides(nf, op.frame.preset, LIBRARY.kit); delete o.size; op.frame = o; changed(); }, { noSize: true, presets: LIBRARY.kit }));
    }
  }
  const cur = document.createElement("button"); cur.textContent = "Add curtains"; cur.title = "pleated curtains on a rail near the ceiling, wider than the window, in front of its sill";
  cur.onclick = () => addCurtains(op);
  d.append(cur);
  return d;
}
function addCurtains(op) {
  const s = BM.sides(B.model, op).find(x => x.holds) || BM.sides(B.model, op)[0];
  if (!s) { status("this window isn't on a wall", "bad"); return; }
  const r = s.room, preset = LIBRARY.kit.curtain_blackout ? "curtain_blackout" : Object.keys(LIBRARY.kit).find(n => BM.mountOf({ preset: n }) === "back");
  let i = 1; while ((B.model.kits || []).some(k => k.id === `${r.id}_kt_curtain_${i}`)) i++;
  pushUndo();
  const k = BM.newKit(preset, `${r.id}_kt_curtain_${i}`, r.id, 0, 0);
  const stool = op.frame ? (() => { try { return KIT.withDefaults(KIT.resolve(op.frame, LIBRARY.kit)).stool || 0; } catch (e) { return 0; } })() : 0;
  k.size = [r2(op.w + 0.4), r2(Math.max(0.08, k.size[1])), r2(r.h - 0.03)];
  const off = WALL_T / 2 + stool + k.size[1] / 2 + 0.02, a = s.at;
  k.rot = BM.FACE[s.wall];
  if (s.wall === "n") { k.x = a; k.y = r.d - off; } else if (s.wall === "s") { k.x = a; k.y = off; } else if (s.wall === "e") { k.x = r.w - off; k.y = a; } else { k.x = off; k.y = a; }
  k.x = r2(k.x); k.y = r2(k.y);
  (B.model.kits = B.model.kits || []).push(k); B.sel = { kit: k.id };
  changed();
}
// the selected thing's kit numbers, in the wide panel under the 3D view
function kitBox(title, ...els) {
  const box = $("#kitbox"), h = document.createElement("h2"); h.textContent = title;
  box.append(h, ...els);
}

// the selected kit thing's handles: its corners resize width and depth together, its sides' middles one each; the
// opposite corner or side stays where it is (so one against a wall keeps its back there). Shift: by the millimetre.
function kitHandles(k) {
  const r = roomOf(k.room), a = k.rot * Math.PI / 180, ax = [Math.cos(a), Math.sin(a)], ay = [-Math.sin(a), Math.cos(a)], [w, d] = k.size;
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const u = su * w / 2, v = sv * d / 2, X = sx(r.x + k.x + ax[0] * u + ay[0] * v), Y = sy(r.y + k.y + ax[1] * u + ay[1] * v);
    const corner = su && sv, cur = corner ? "nwse-resize" : "ew-resize";
    if (corner) el("rect", { x: X - 4.5, y: Y - 4.5, width: 9, height: 9, fill: "#d9a441", stroke: "#111", "data-khandle": `${su},${sv}`, style: `cursor:${cur}` });
    else el("circle", { cx: X, cy: Y, r: 4.5, fill: "#d9a441", stroke: "#111", "data-khandle": `${su},${sv}`, style: `cursor:${cur}` });
  }
}
function resizeKit(dr, x, y, fine) {
  const k = dr.k, r = roomOf(k.room), a = k.rot * Math.PI / 180, ax = [Math.cos(a), Math.sin(a)], ay = [-Math.sin(a), Math.cos(a)];
  const cx = r.x + dr.x0, cy = r.y + dr.y0, px = x - cx, py = y - cy, u = px * ax[0] + py * ax[1], v = px * ay[0] + py * ay[1];
  const [w0, d0] = dr.size, q = val => Math.max(0.05, Math.round(val / (fine ? 0.001 : 0.01)) * (fine ? 0.001 : 0.01));
  let cu = 0, cv = 0, w = w0, d = d0;
  if (dr.su) { const uf = -dr.su * w0 / 2; w = q(Math.abs(u - uf)); cu = uf + dr.su * w / 2; }
  if (dr.sv) { const vf = -dr.sv * d0 / 2; d = q(Math.abs(v - vf)); cv = vf + dr.sv * d / 2; }
  k.size = [+w.toFixed(3), +d.toFixed(3), dr.size[2]];
  k.x = +(dr.x0 + ax[0] * cu + ay[0] * cv).toFixed(3); k.y = +(dr.y0 + ax[1] * cu + ay[1] * cv).toFixed(3);
  try {                                                  // free parts scale with their box
    const full = KIT.withDefaults(KIT.resolve(Object.assign({}, dr.spec, { size: dr.size }), LIBRARY.kit));
    if (full.type === "parts") { const f = k.size.map((v2, i) => v2 / dr.size[i]); k.spec = Object.assign({}, dr.spec, { parts: full.parts.map(p => KIT.scalePart(p, f)) }); }
  } catch (e) { }
}
// another take on a kit thing: its layout and details from a new seed, its size kept
function varyKit(k) {
  let full; try { full = KIT.withDefaults(KIT.resolve(Object.assign({}, k.spec, { size: k.size }), LIBRARY.kit)); } catch (e) { status(e.message, "bad"); return; }
  k._vary = (k._vary || 0) + 1;
  const v = KIT.variations(full, 1, k._vary, ["layout", "look"])[0];
  if (!v) { status("nothing of this kind varies but its size", "bad"); return; }
  pushUndo();
  const o = kitOverrides(v, (k.spec || {}).preset, LIBRARY.kit); delete o.size;
  k.spec = o; changed();
  status(`a variation of ${(LIBRARY.kit[(k.spec || {}).preset] || {}).label || "it"} (🎲 again for another, Ctrl+Z to go back)`);
}

// the kit thing under a point (room space), the highest first: what a cushion lands on
function kitUnder(r, x, y, not) {
  let best = null;
  for (const q of B.model.kits || []) {
    if (q.room !== r.id || q.id === not || BM.mountOf(q.spec) === "ceiling") continue;
    const a = -q.rot * Math.PI / 180, dx = x - q.x, dy = y - q.y, u = dx * Math.cos(a) - dy * Math.sin(a), v = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(u) <= q.size[0] / 2 && Math.abs(v) <= q.size[1] / 2 && (!best || restHeight(q) > restHeight(best))) best = q;
  }
  return best;
}
// where things rest on a kit thing: a sofa's seat, a bed's mattress, a table's top...
function restHeight(q) {
  let f; try { f = KIT.withDefaults(KIT.resolve(Object.assign({}, q.spec, { size: q.size }), LIBRARY.kit)); } catch (e) { return q.z + q.size[2]; }
  const top = f.type === "sofa" ? f.seat_h : f.type === "bed" ? f.top : f.size[2];
  return q.z + top;
}
// a doorway's door from the kit: its kind, hinge side and handle; the rest of its numbers under the 3D view
function doorEditor(op) {
  const d = document.createElement("div"); d.style.marginTop = "6px";
  const g = document.createElement("div"); g.className = "prop";
  const kit = (op.extra || {}).kit || null, set = v => { op.extra = Object.assign({}, op.extra); if (v) op.extra.kit = v; else delete op.extra.kit; };
  const of = type => Object.entries(LIBRARY.kit || {}).filter(([, p]) => p.type === type).map(([n, p]) => [n, p.label]);
  g.append(...field("door", pick((kit || {}).preset || "", [["", "(a plain slab)"], ...of("door")], v => set(v ? Object.assign({}, kit || {}, { preset: v }) : null))));
  if (kit) {
    let full = null; try { full = KIT.withDefaults(KIT.resolve(kit, LIBRARY.kit)); } catch (e) { }
    if (full) {
      g.append(...field("hinges on", pick(full.hinge, [["left", "the left"], ["right", "the right"]], v => set(Object.assign({}, kit, { hinge: v })))),
               ...field("handle", pick(full.handle || "none", [["none", "(none)"], ...of("handle")], v => set(Object.assign({}, kit, { handle: v })))));
      kitBox(`${op.id}: the door's numbers (its size is the doorway's)`, kitForm(full, nf => { pushUndo(); const o = kitOverrides(nf, kit.preset, LIBRARY.kit); delete o.size; set(o); changed(); }, { noSize: true, presets: LIBRARY.kit }));
    }
  }
  const hint = document.createElement("div"); hint.className = "hint";
  hint.textContent = kit ? "In Unreal: the leaf turns on its hinges, the handle is its own mesh on it, the frame is in the wall; all tagged door:" + op.id : "A door from the kit: panels, glass, louvres, shoji, sliders; hinges and a handle you can swap.";
  d.append(g, hint);
  return d;
}

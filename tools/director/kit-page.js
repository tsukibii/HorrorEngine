// The kit maker (kit.html): pick a preset or a type, change its numbers, see it beside a person under a raking light
// (the gaps and bevels are what a bake turns into a real room), keep it as a preset, explode it into free parts, or
// export it. Presets live in Content/Studio/Kit/presets.json through the desk's server (GET/PUT /api/kit).
import * as THREE from "three";
import * as KIT from "./kit.js";
import * as K3 from "./kit3.js";
import { form, overrides, CSS } from "./kit-form.js";

const $ = s => document.querySelector(s);
const K = { presets: {}, version: 1, name: null, spec: null, obj: null };
const api = async (url, opts) => { const r = await fetch(url, opts); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); return j; };
function status(t, bad) { const s = $("#status"); s.textContent = t; s.className = bad ? "bad" : ""; }
$("#kfcss").textContent = CSS;

// ---- the view ------------------------------------------------------------------------------------------------------
const view = $("#view");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
view.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2a2a2f);
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
const hemi = new THREE.HemisphereLight(0xdfe6ee, 0x403a33, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.01;
scene.add(sun, sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.position.y = -0.0005; scene.add(ground);
const grid = new THREE.GridHelper(20, 200, 0x55555d, 0x45454c); grid.position.y = 0.0002; scene.add(grid);
const grid1 = new THREE.GridHelper(20, 20, 0x77777f, 0x6a6a72); grid1.position.y = 0.0004; scene.add(grid1);
const person = new THREE.Group();                 // a plain 1.62 m figure: head, body, legs
{ const m = new THREE.MeshStandardMaterial({ color: 0x9a8fa8, roughness: 0.8 });
  const part = (g, y) => { const o = new THREE.Mesh(g, m); o.position.y = y; o.castShadow = true; person.add(o); };
  part(new THREE.SphereGeometry(0.105, 16, 12), 1.5); part(new THREE.CapsuleGeometry(0.17, 0.42, 6, 12), 1.07); part(new THREE.CapsuleGeometry(0.09, 0.62, 6, 10), 0.4); }
scene.add(person);
const boxHelper = new THREE.Box3Helper(new THREE.Box3(), 0xd9a441); scene.add(boxHelper);
const orbit = { yaw: -0.6, pitch: 0.38, dist: 3, target: new THREE.Vector3(0, 0.6, 0) };
function place() {
  const c = Math.cos(orbit.pitch);
  camera.position.set(orbit.target.x + Math.sin(orbit.yaw) * c * orbit.dist, orbit.target.y + Math.sin(orbit.pitch) * orbit.dist, orbit.target.z + Math.cos(orbit.yaw) * c * orbit.dist);
  camera.lookAt(orbit.target);
}
function resize() { const w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); render(); }
function render() { place(); placeHandles(); renderer.render(scene, camera); }
window.addEventListener("resize", resize);
let drag = null;
view.addEventListener("contextmenu", e => e.preventDefault());
view.addEventListener("mousedown", e => {
  const hd = e.button === 0 && pickHandle(e);
  if (hd) { startResize(hd, e); return; }
  drag = { x: e.clientX, y: e.clientY, b: e.button, yaw: orbit.yaw, pitch: orbit.pitch, t: orbit.target.clone() };
});
window.addEventListener("mouseup", () => { drag = null; if (resizing) endResize(); });
window.addEventListener("mousemove", e => {
  if (resizing) { moveResize(e); return; }
  if (!drag) { hoverHandle(e); return; }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (drag.b === 2 || e.shiftKey) {
    const k = orbit.dist / 600, right = new THREE.Vector3().subVectors(camera.position, orbit.target).cross(camera.up).normalize();
    orbit.target.copy(drag.t).addScaledVector(right, dx * k).addScaledVector(camera.up, dy * k);
  } else { orbit.yaw = drag.yaw - dx * 0.008; orbit.pitch = Math.max(-0.2, Math.min(1.5, drag.pitch + dy * 0.008)); }
  render();
});
view.addEventListener("wheel", e => { e.preventDefault(); orbit.dist = Math.max(0.08, Math.min(60, orbit.dist * Math.exp(e.deltaY * 0.0012))); render(); }, { passive: false });
function fit() {
  if (!K.obj) return;
  const [w, d, h] = K.obj.userData.built.spec.size, r = Math.max(w, d, h, 0.05);
  orbit.target.set(0, h / 2, 0); orbit.dist = r * 1.9 + 0.1; render();
}
function lights() {
  const rake = $("#rake").checked, [w, d, h] = K.obj ? K.obj.userData.built.spec.size : [1, 1, 1], r = Math.max(w, d, h, 0.5);
  sun.visible = true; sun.intensity = rake ? 2.4 : 1.2; hemi.intensity = rake ? 0.55 : 1.1;
  sun.position.set(-r * 1.6, rake ? r * 0.55 : r * 2.5, r * 1.3); sun.target.position.set(0, 0, 0);
  const cam = sun.shadow.camera; cam.left = cam.bottom = -r * 1.4; cam.right = cam.top = r * 1.4; cam.near = 0.01; cam.far = r * 8; cam.updateProjectionMatrix();
}

// ---- the thing -----------------------------------------------------------------------------------------------------
function show(spec, name) {
  K.spec = spec; if (name !== undefined) K.name = name;
  if (K.obj) { scene.remove(K.obj); K3.dispose(K.obj); }
  let b;
  try { b = KIT.build(spec, K.presets); } catch (e) { status(e.message, true); return; }
  K.obj = K3.object(b, K.presets, { shadows: true }); scene.add(K.obj);
  const [w, d, h] = b.spec.size;
  boxHelper.box.set(new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, h, d / 2)); boxHelper.visible = $("#box").checked;
  person.position.set(-w / 2 - 0.45, 0, 0); person.visible = $("#person").checked;
  const p = K.name && K.presets[K.name], T = KIT.TYPES[b.spec.type];
  $("#title").textContent = p ? `${p.label}  ·  ${K.name}` : K.varOf && K.presets[K.varOf] ? `A variation of ${K.presets[K.varOf].label.toLowerCase()}` : `New ${T.label.toLowerCase()}`;
  $("#form").innerHTML = ""; $("#form").append(form(b.spec, s => show(s)));
  $("#warn").textContent = [...new Set(b.warn)].join("; ");
  const G = KIT.mesh(b.parts), st = KIT.stats(G);
  $("#slots").innerHTML = Object.keys(G).sort().map(sl => `<span><i style="background:#${KIT.SLOTS[KIT.slotOf(sl)][0].toString(16).padStart(6, "0")}"></i>${sl}</span>`).join("");
  $("#stats").innerHTML = `${T.label}: ${b.parts.length} parts, ${st.tris.toLocaleString()} triangles, ${st.slots} materials. ${(w * 100).toFixed(1)} × ${(d * 100).toFixed(1)} × ${(h * 100).toFixed(1)} cm (w × d × h); its front faces you when the person stands to its left.${p && p.z ? ` Hangs ${p.z} m up.` : ""}`;
  $("#json").value = JSON.stringify(overrides(b.spec, p ? K.name : null, K.presets));
  for (const b2 of document.querySelectorAll(".cat button")) b2.classList.toggle("on", b2.dataset.name === K.name);
  lights(); render();
  try { history.replaceState(null, "", "#" + encodeURIComponent(JSON.stringify(K.name && JSON.stringify(spec) === JSON.stringify(KIT.withDefaults(KIT.resolve(K.name, K.presets))) ? { preset: K.name } : spec))); } catch (e) { }
}
function openPreset(name) { K.varOf = null; show(KIT.withDefaults(KIT.resolve(name, K.presets)), name); fit(); if ($("#vars").style.display === "block") showVariations(1); }

function renderList() {
  const q = $("#search").value.trim().toLowerCase(), box = $("#presets"); box.innerHTML = "";
  const by = {};
  for (const [n, p] of Object.entries(K.presets)) {
    if (q && !(n + " " + p.label).toLowerCase().includes(q)) continue;
    const cat = p.cat || KIT.TYPES[p.type].cat; (by[cat] = by[cat] || []).push([n, p]);
  }
  for (const [cat, title] of Object.entries(KIT.CATS)) {
    if (!by[cat]) continue;
    const d = document.createElement("div"); d.className = "cat"; d.innerHTML = `<h3>${title}</h3>`;
    for (const [n, p] of by[cat]) {
      const b = document.createElement("button"); b.dataset.name = n; b.innerHTML = `${p.label}${p.user ? " <small>(yours)</small>" : ""}`; b.title = n;
      b.onclick = () => { setTab("edit"); openPreset(n); }; d.append(b);
    }
    box.append(d);
  }
}

// ---- the catalogue: every preset, rendered once ----------------------------------------------------------------------
async function catalogue() {
  const box = $("#cat"); box.innerHTML = "";
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(380, 280); r.shadowMap.enabled = true;
  const cam = new THREE.PerspectiveCamera(35, 380 / 280, 0.01, 100);
  const by = {};
  for (const [n, p] of Object.entries(K.presets)) { const cat = p.cat || KIT.TYPES[p.type].cat; (by[cat] = by[cat] || []).push([n, p]); }
  for (const [cat, title] of Object.entries(KIT.CATS)) {
    if (!by[cat]) continue;
    const h = document.createElement("h3"); h.textContent = title; const g = document.createElement("div"); g.className = "grid"; box.append(h, g);
    for (const [n, p] of by[cat]) {
      if (K.obj) scene.remove(K.obj);
      const o = K3.object(n, K.presets, { shadows: true }); scene.add(o);
      const [w, d, hh] = o.userData.built.spec.size, rr = Math.max(w, d, hh, 0.05);
      person.visible = false; boxHelper.visible = false;
      const ceil = (p.mount || KIT.TYPES[p.type].mount).includes("ceiling");
      cam.position.set(-rr * 0.9, ceil ? -rr * 0.5 + hh : hh * 0.6 + rr * 0.55, rr * 1.3); cam.lookAt(0, hh * 0.45, 0);
      const keep = K.obj; K.obj = o; lights(); K.obj = keep;
      r.render(scene, cam);
      scene.remove(o); K3.dispose(o);
      const st = KIT.stats(KIT.mesh(o.userData.built.parts));
      const f = document.createElement("figure"); f.innerHTML = `<img src="${r.domElement.toDataURL("image/jpeg", 0.85)}"><figcaption>${p.label}<small>${n} · ${(w * 100).toFixed(0)}×${(d * 100).toFixed(0)}×${(hh * 100).toFixed(0)} cm · ${st.tris.toLocaleString()} tris</small></figcaption>`;
      f.onclick = () => { setTab("edit"); openPreset(n); }; g.append(f);
      await new Promise(res => setTimeout(res, 0));
    }
  }
  r.dispose();
  if (K.obj) scene.add(K.obj);
  person.visible = $("#person").checked; boxHelper.visible = $("#box").checked; lights(); render();
}
function setTab(t) {
  $("#tabEdit").classList.toggle("on", t === "edit"); $("#tabCat").classList.toggle("on", t === "cat");
  $("#cat").style.display = t === "cat" ? "block" : "none";
  if (t === "cat" && !$("#cat").childElementCount) catalogue();
}

// ---- actions -------------------------------------------------------------------------------------------------------
async function savePreset() {
  const name = prompt("Preset name (letters, digits, _):", K.name && K.presets[K.name] && K.presets[K.name].user ? K.name : (K.name ? K.name + "_2" : K.varOf ? K.varOf + "_v" + K.varSeed : K.spec.type + "_mine"));
  if (!name) return;
  if (!/^[a-z][a-z0-9_]*$/.test(name)) { status("a preset name is lower-case letters, digits and _", true); return; }
  if (K.presets[name] && !K.presets[name].user && !confirm(`${name} is one of the studio's presets. Replace it?`)) return;
  const old = (K.name && K.presets[K.name]) || (K.varOf && K.presets[K.varOf]);
  const label = prompt("Its label:", old ? old.label + (name !== K.name ? " (mine)" : "") : KIT.TYPES[K.spec.type].label) || name;
  const body = Object.assign({ label, cat: (old && old.cat) || KIT.TYPES[K.spec.type].cat, user: true }, old && old.mount ? { mount: old.mount } : {}, old && old.z !== undefined ? { z: old.z } : {}, K.spec);
  const j = await api("/api/kit/preset/" + name, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  K.presets = j.presets; K.name = name; renderList(); show(K.spec, name);
  status(`saved preset ${name}: the scene builder lists it`);
  $("#cat").innerHTML = "";
}
function exportGlb() {
  const b = KIT.build(K.spec, K.presets), name = K.name || b.spec.type;
  const blob = new Blob([KIT.glb(KIT.mesh(b.parts), name)], { type: "model/gltf-binary" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name + ".glb"; a.click();
  status(`exported ${name}.glb (metres, Y up, the front facing +Z)`);
}
function explode() {
  const b = KIT.build(K.spec, K.presets);
  if (b.parts.length > 400 && !confirm(`${b.parts.length} parts: that's a long list. Explode anyway?`)) return;
  show({ type: "parts", size: b.spec.size.slice(), parts: KIT.explode(b) }, null);
  status("exploded: every part is a row now (move, resize, recolour, remove; ⧉ duplicates)");
}

async function boot() {
  const j = await api("/api/kit");
  K.presets = j.presets; K.version = j.version;
  for (const [t, T] of Object.entries(KIT.TYPES)) $("#newType").append(new Option(T.label, t));
  $("#newType").onchange = () => { const t = $("#newType").value; $("#newType").value = ""; if (t) { setTab("edit"); show(KIT.withDefaults({ type: t }), null); fit(); } };
  $("#search").oninput = renderList;
  $("#tabEdit").onclick = () => setTab("edit"); $("#tabCat").onclick = () => setTab("cat");
  $("#person").onchange = () => { person.visible = $("#person").checked; render(); };
  $("#box").onchange = () => { boxHelper.visible = $("#box").checked; render(); };
  $("#rake").onchange = () => { lights(); render(); };
  $("#fit").onclick = fit; $("#savePreset").onclick = () => savePreset().catch(e => status(e.message, true));
  $("#glb").onclick = exportGlb; $("#explode").onclick = explode;
  $("#varsBtn").onclick = () => showVariations(1);
  $("#vMore").onclick = () => showVariations(K.varSeed + 1);
  $("#vClose").onclick = () => { $("#vars").style.display = "none"; };
  for (const id of ["#vSize", "#vLayout", "#vLook"]) $(id).onchange = () => showVariations(K.varSeed);
  $("#handles").onchange = () => render();
  $("#apply").onclick = () => { try { const s = JSON.parse($("#json").value); const r = KIT.resolve(s, K.presets); show(KIT.withDefaults(r), s.preset || null); } catch (e) { status(e.message, true); } };
  $("#copy").onclick = () => { navigator.clipboard && navigator.clipboard.writeText($("#json").value); status("copied"); };
  renderList(); resize();
  let start = null;
  try { start = location.hash.length > 1 ? JSON.parse(decodeURIComponent(location.hash.slice(1))) : null; } catch (e) { }
  if (start) { const r = KIT.resolve(start, K.presets); show(KIT.withDefaults(r), start.preset || null); fit(); }
  else openPreset(K.presets.tv_wall_unit ? "tv_wall_unit" : Object.keys(K.presets)[0]);
  if (new URLSearchParams(location.search).get("cat")) setTab("cat");
  status(`${Object.keys(K.presets).length} presets, ${Object.keys(KIT.TYPES).length} types`);
  window.__kitReady = true;
}
window.kitmaker = { K, show, openPreset, catalogue, setTab, explode, render, resizeTo, showVariations, handleAt,
  screenOf: m => { const v = m.position.clone().project(camera), r = view.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; } };
boot().catch(e => { status("no server: " + e.message, true); console.error(e); });

// ---- handles: drag the corners and edges of the size box to resize it ---------------------------------------------
// top corners: width and depth together; the right and front edges' middles: one each; the top's middle: height.
// The thing stays centred on its base, so a corner moves both its sides. Shift drags by the millimetre.
const HANDLES = [];
const hMat = new THREE.MeshBasicMaterial({ color: 0xd9a441, depthTest: false, transparent: true, opacity: 0.95 });
const hHot = new THREE.MeshBasicMaterial({ color: 0xffe2a0, depthTest: false });
for (const [mode, sx, sz, ty] of [["xz", -1, -1], ["xz", 1, -1], ["xz", 1, 1], ["xz", -1, 1], ["x", 1, 0], ["x", -1, 0], ["z", 0, 1], ["z", 0, -1], ["y", 0, 0]]) {
  const m = new THREE.Mesh(mode === "y" ? new THREE.ConeGeometry(0.5, 1, 4) : mode === "xz" ? new THREE.BoxGeometry(1, 1, 1) : new THREE.SphereGeometry(0.55, 10, 8), hMat);
  m.renderOrder = 999; m.userData = { mode, sx, sz }; scene.add(m); HANDLES.push(m);
}
let resizing = null, hot = null;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function placeHandles() {
  const on = $("#handles") && $("#handles").checked && K.obj && $("#cat").style.display !== "block";
  const [w, d, h] = on ? K.obj.userData.built.spec.size : [0, 0, 0], k = orbit.dist * 0.012;
  for (const m of HANDLES) {
    m.visible = !!on; if (!on) continue;
    const { mode, sx, sz } = m.userData;
    m.position.set(sx * w / 2, h + (mode === "y" ? k * 1.4 : 0), sz * d / 2);
    m.scale.setScalar(k);
    m.material = m === hot ? hHot : hMat;
  }
}
function rayAt(e) { const r = view.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); return ray; }
function pickHandle(e) { const hits = rayAt(e).intersectObjects(HANDLES.filter(m => m.visible)); return hits.length ? hits[0].object : null; }
function hoverHandle(e) { const h = pickHandle(e); if (h !== hot) { hot = h; view.style.cursor = h ? (h.userData.mode === "y" ? "ns-resize" : "move") : "default"; render(); } }
function handleAt(mode, sx = 1, sz = 1) { return HANDLES.find(m => m.userData.mode === mode && (mode === "y" || ((m.userData.sx === sx || !m.userData.sx) && (m.userData.sz === sz || !m.userData.sz)))); }
function startResize(hd, e) {
  const [w, d, h] = K.obj.userData.built.spec.size;
  const plane = hd.userData.mode === "y"
    ? new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(camera.position.x, 0, camera.position.z).normalize(), new THREE.Vector3(0, 0, 0))
    : new THREE.Plane(new THREE.Vector3(0, 1, 0), -h);
  resizing = { hd, plane, start: [w, d, h], spec: JSON.parse(JSON.stringify(K.spec)) };
  moveResize(e);
}
function moveResize(e) {
  const p = new THREE.Vector3();
  if (!rayAt(e).ray.intersectPlane(resizing.plane, p)) return;
  const { mode } = resizing.hd.userData, snap = e.shiftKey ? 0.001 : 0.01, q = v => Math.max(0.01, Math.round(v / snap) * snap);
  const [w, d, h] = resizing.start, size = [w, d, h];
  if (mode === "xz" || mode === "x") size[0] = q(Math.abs(p.x) * 2);
  if (mode === "xz" || mode === "z") size[1] = q(Math.abs(p.z) * 2);
  if (mode === "y") size[2] = q(p.y);
  resizeTo(size, true);
}
// a new size: parts scale with it (free parts), every other type fills it; live = rebuild the mesh only
function resizeTo(size, live) {
  const base = resizing ? resizing.spec : K.spec, spec = JSON.parse(JSON.stringify(base));
  spec.size = size.map(v => +v.toFixed(4));
  if (spec.type === "parts") { const f = spec.size.map((v, k) => v / base.size[k]); spec.parts = (base.parts || []).map(q => KIT.scalePart(q, f)); }
  if (live) {
    K.spec = spec;
    if (K.obj) { scene.remove(K.obj); K3.dispose(K.obj); }
    K.obj = K3.object(spec, K.presets, { shadows: true }); scene.add(K.obj);
    const [w, d, h] = spec.size;
    boxHelper.box.set(new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, h, d / 2));
    person.position.set(-w / 2 - 0.45, 0, 0);
    $("#hud").textContent = `${(w * 100).toFixed(1)} × ${(d * 100).toFixed(1)} × ${(h * 100).toFixed(1)} cm`;
    lights(); render();
  } else show(spec);
}
function endResize() { const s = K.spec; resizing = null; $("#hud").textContent = ""; show(s); }

// ---- variations: six other takes on the thing being edited --------------------------------------------------------
let thumbR = null;
function thumb(spec) {
  if (!thumbR) { thumbR = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); thumbR.setSize(260, 190); thumbR.shadowMap.enabled = true; }
  const cam = new THREE.PerspectiveCamera(35, 260 / 190, 0.01, 100), keep = K.obj;
  const o = K3.object(spec, K.presets, { shadows: true }); if (keep) keep.visible = false; scene.add(o);
  const vis = HANDLES.map(m => m.visible); HANDLES.forEach(m => { m.visible = false; }); const pv = person.visible, bv = boxHelper.visible; person.visible = false; boxHelper.visible = false;
  const [w, d, h] = o.userData.built.spec.size, r = Math.max(w, d, h, 0.05), ceil = KIT.TYPES[spec.type].mount.includes("ceiling");
  cam.position.set(-r * 0.9, ceil ? h - r * 0.5 : h * 0.6 + r * 0.55, r * 1.3); cam.lookAt(0, h * 0.45, 0);
  K.obj = o; lights(); K.obj = keep;
  thumbR.render(scene, cam);
  scene.remove(o); K3.dispose(o); if (keep) keep.visible = true;
  HANDLES.forEach((m, i) => { m.visible = vis[i]; }); person.visible = pv; boxHelper.visible = bv; lights();
  return thumbR.domElement.toDataURL("image/jpeg", 0.85);
}
function showVariations(seed) {
  K.varSeed = seed;
  const groups = [["#vSize", "size"], ["#vLayout", "layout"], ["#vLook", "look"]].filter(([id]) => $(id).checked).map(([, g]) => g);
  const from = K.spec, of = K.name || K.varOf;
  const vs = KIT.variations(from, 6, seed, groups);
  const strip = $("#vStrip"); strip.innerHTML = "";
  $("#vars").style.display = "block";
  if (!vs.length) { strip.innerHTML = `<span class="hint">Nothing of this kind varies with those ticked.</span>`; return vs; }
  vs.forEach((v, i) => {
    const f = document.createElement("figure"), [w, d, h] = v.size;
    f.innerHTML = `<img src="${thumb(v)}"><figcaption>${(w * 100).toFixed(0)}×${(d * 100).toFixed(0)}×${(h * 100).toFixed(0)} cm${v.cols ? " · " + v.cols.map(c => c.k).join(", ") : v.seats ? " · " + v.seats + " seats" : v.pattern ? " · " + v.pattern : ""}</figcaption>`;
    f.onclick = () => { K.varOf = of; show(v, null); fit(); status(`a variation of ${of || "this"}: change it, then Save as preset to keep it`); };
    f.dataset.i = i; strip.append(f);
  });
  render();
  return vs;
}

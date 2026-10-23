// The PBR shelf (docs/ASSETS.md §6): your texture sets in assets/pbr/<name>/ (or <category>/<name>/), browsed and tried
// on a sphere, a cube, a room corner and a close-up at their real size (tile_m: the metres one repeat covers). Each map
// is found by its file name's last word (denim1_albedo.png, _normal-dx, _roughness...) or chosen by hand (meta.json's
// by_hand). The desk's server and the Character Studio's both serve this page.
import * as THREE from "three";

const $ = s => document.querySelector(s);
const encPath = p => p.split("/").map(encodeURIComponent).join("/");
const S = { sets: {}, root: "", cat: "", q: "", sel: null, shape: "sphere", off: new Set() };
const MAPS = [["albedo", "colour"], ["normal", "normal"], ["rough", "rough"], ["metal", "metal"], ["ao", "AO"], ["height", "disp"], ["opacity", "opacity"]];

function status(t, bad) { const s = $("#status"); s.textContent = t; s.className = bad ? "bad" : ""; }
const url = (m, f) => `${encPath(m.base)}/${encodeURIComponent(f)}?s=${m.stamp || ""}`;

async function load() {
  status("scanning the shelf...");
  try {
    const r = await (await fetch("/api/pbr")).json();
    S.sets = r.sets || {}; S.root = r.root || "";
    status(`${Object.keys(S.sets).length} sets in ${S.root}`);
  } catch (e) { status("the server didn't answer: python3 tools/director/serve.py (or the Character Studio's)", true); }
  if (S.sel && !S.sets[S.sel]) S.sel = null;
  if (!S.sel) S.sel = Object.keys(S.sets).sort()[0] || null;
  drawLeft(); select(S.sel);
}

// ---- the left: categories and the sets as swatches ----------------------------------------------------------------
function drawLeft() {
  const counts = {};
  for (const m of Object.values(S.sets)) { const top = (m.category || "").split("/")[0] || "(none)"; counts[top] = (counts[top] || 0) + 1; }
  const cats = $("#cats"); cats.innerHTML = "";
  const filed = Object.keys(counts).some(c => c !== "(none)");     // sets a folder each with no categories: no chips, no headings
  for (const c of filed ? ["", ...Object.keys(counts).sort()] : []) {
    const b = document.createElement("button"); b.className = S.cat === c ? "on" : "";
    b.innerHTML = c ? `${c} <small>${counts[c]}</small>` : `all <small>${Object.keys(S.sets).length}</small>`;
    b.onclick = () => { S.cat = c; drawLeft(); }; cats.append(b);
  }
  const list = $("#list"); list.innerHTML = "";
  const groups = {};
  for (const [ref, m] of Object.entries(S.sets).sort()) {
    const cat = m.category || "(none)";
    if (S.cat && cat.split("/")[0] !== S.cat) continue;
    if (S.q && !ref.toLowerCase().includes(S.q)) continue;
    (groups[cat] = groups[cat] || []).push([ref, m]);
  }
  if (!Object.keys(S.sets).length) {
    list.innerHTML = `<div class="empty">The shelf is empty. Put sets under <code>${S.root}</code>, a folder each (its maps named like <code>denim1_albedo.png</code>, <code>denim1_normal-dx.png</code>; in category folders if you like; or the ZIP as it downloads), then Rescan. <code>python tools/pbr.py demo</code> makes five to try.</div>`;
    return;
  }
  for (const [cat, rows] of Object.entries(groups)) {
    const g = document.createElement("div"); g.className = "group";
    g.innerHTML = filed ? `<h3>${cat}</h3>` : "";
    const grid = document.createElement("div"); grid.className = "grid";
    for (const [ref, m] of rows) {
      const f = document.createElement("figure"); f.className = ref === S.sel ? "on" : ""; f.title = ref;
      f.innerHTML = `<img loading="lazy" src="${url(m, m.thumb)}"><figcaption>${ref.split("/").pop()}</figcaption>`;
      f.onclick = () => select(ref); f.dataset.ref = ref;
      grid.append(f);
    }
    g.append(grid); list.append(g);
  }
}

// ---- the right: the set's maps, its size, where it came from, where it goes in Unreal ------------------------------
function drawRight() {
  const R = $("#right"), m = S.sets[S.sel];
  if (!m) { R.innerHTML = `<div class="hint">Pick a set.</div>`; return; }
  const name = S.sel.split("/").pop();
  R.innerHTML = `<h2>${name}</h2>
    <div class="hint">Ref <code>${S.sel}</code>: a room's look (the scene builder lists it) or a prop's <code>mat</code>.</div>
    <h2>Maps</h2><div class="maps" id="maps"></div>
    <div class="hint">Each map by its name's last word, or chosen by hand under it (saved at once to meta.json). Click a map to try the set without it. ${m.normal === "dx" ? "The normal is DirectX (Unreal's own): the desk flips its green." : "The normal is OpenGL: Unreal flips its green on import."}${m.arm ? `<br><span class="warn">${m.arm}</span>` : ""}</div>
    <h2>Size</h2>
    <div class="kv"><span>one repeat</span><div><input id="tile" type="number" min="0.05" max="50" step="0.05" value="${m.tile_m}" style="width:80px"> m <small style="color:var(--dim)">(a plank floor 1 to 2.5, bricks 1 to 1.5, plaster 2 to 3)</small></div></div>
    <h2>Where it came from</h2>
    <div class="kv"><span>source</span><input id="source" value="${m.source || ""}"><span>url</span><input id="url" value="${m.url || ""}"><span>licence</span><input id="licence" value="${m.licence || ""}"><span>note</span><input id="note" value="${m.note || ""}"></div>
    <div style="margin-top:8px"><button class="primary" id="save">Save</button> <span class="hint" id="saved"></span></div>
    <h2>In Unreal</h2>
    <div class="hint">The importer checks for <code>${m.unreal}</code> when a level using it is built, and if Unreal hasn't got it (or a map changed since), imports the maps into that folder and makes the material instance of M_StudioSurface. <code>storykit.surfaces.sync_pbr()</code> does the whole shelf at once.</div>
    <h2>Kimodo</h2>
    <div class="hint">The stage sent to Kimodo stays boxes: no materials go with it.</div>`;
  const maps = $("#maps"), hand = m.by_hand || {};
  for (const [k, label] of [...MAPS, ["orm", "packed ORM"]]) {
    const f = document.createElement("figure"), file = k === "orm" ? m.orm : m.maps[k];
    f.className = !file || S.off.has(k) ? "off" : ""; f.title = file || `no ${label} map`;
    f.innerHTML = file ? `<img loading="lazy" src="${url(m, file)}"><figcaption>${label} · ${file.split(".").pop()}</figcaption>` : `<div style="aspect-ratio:1"></div><figcaption>${label}: none</figcaption>`;
    if (file) f.querySelector("img").onclick = () => { S.off.has(k) ? S.off.delete(k) : S.off.add(k); drawRight(); dress(); };
    // by hand: which file (or none) over what the names say; the normal also says whose convention it is
    const keys = k === "normal" ? ["normal", "normal_dx"] : [k], mine = keys.find(x => x in hand);
    const pick = document.createElement("select"); pick.title = `the ${label} map: by its name, or a file chosen by hand`;
    pick.innerHTML = `<option value="*">${mine ? "by name" : "by name ✓"}</option><option value="">none</option>` + (m.files || []).map(x => `<option>${x}</option>`).join("");
    pick.value = mine ? hand[mine] : "*";
    pick.onchange = () => setHand(m, keys, pick.value === "*" ? null : { [k === "normal" && m.normal === "dx" ? "normal_dx" : k]: pick.value });
    pick.style.cssText = "width:100%;font-size:11px;padding:0 2px";
    f.append(pick);
    if (k === "normal" && file) {
      const gd = document.createElement("select"); gd.title = "OpenGL (green up: three.js, Blender) or DirectX (green down: Unreal)";
      gd.innerHTML = `<option value="gl">OpenGL</option><option value="dx">DirectX</option>`; gd.value = m.normal;
      gd.onchange = () => setHand(m, keys, { [gd.value === "dx" ? "normal_dx" : "normal"]: file });
      gd.style.cssText = "width:100%;font-size:11px;padding:0 2px"; f.append(gd);
    }
    maps.append(f);
  }
  $("#tile").oninput = () => { const v = +$("#tile").value; if (v >= 0.05) { m.tile_m = v; dress(); } };
  $("#save").onclick = async () => {
    const body = { tile_m: +$("#tile").value, source: $("#source").value, url: $("#url").value, licence: $("#licence").value, note: $("#note").value };
    const r = await fetch(`/api/pbr/${encPath(S.sel.slice(4))}`, { method: "POST", body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { $("#saved").textContent = j.error; return; }
    Object.assign(m, j); $("#saved").textContent = "saved to meta.json";
  };
}

// a map chosen by hand (or given back to its name): saved to the set's meta.json, the set read again
async function setHand(m, keys, v) {
  const hand = { ...(m.by_hand || {}) };
  for (const k of keys) delete hand[k];
  Object.assign(hand, v || {});
  const r = await fetch(`/api/pbr/${encPath(S.sel.slice(4))}`, { method: "POST", body: JSON.stringify({ by_hand: hand }) });
  const j = await r.json();
  if (!r.ok) return status(j.error, true);
  for (const k of ["maps", "orm", "arm", "normal", "by_hand", "stamp", "files"]) { if (k in j) m[k] = j[k]; else delete m[k]; }
  status(`${S.sel}: ${Object.entries(m.maps).map(([k, f]) => `${k} ${f}`).join(", ")}`);
  drawRight(); dress();
}

function select(ref) {
  S.sel = ref; S.off.clear();
  for (const f of document.querySelectorAll(".grid figure")) f.className = f.dataset.ref === ref ? "on" : "";
  drawRight(); dress();
}

// ---- the 3D view ---------------------------------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true;
$("#view").append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1d1d22);
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 50);
scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x3a3128, 0.7));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 }); scene.add(sun, sun.target);
const holder = new THREE.Group(); scene.add(holder);
const cam = { yaw: 0.6, pitch: 0.25, dist: 2.6, target: new THREE.Vector3(0, 0.5, 0) };
const texCache = {};

function texture(m, k) {
  const file = k === "orm" ? m.orm : m.maps[k]; if (!file || S.off.has(k)) return null;
  const key = url(m, file);
  if (!texCache[key]) {
    const t = new THREE.TextureLoader().load(key, () => dress());     // clones are made per surface: remake them once it's here
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (k === "albedo") t.colorSpace = THREE.SRGBColorSpace;
    texCache[key] = t;
  }
  return texCache[key];
}

// one material per surface size, so each keeps the set's real size: repeat = metres / tile_m
function material(m, wm, hm) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  const set = (slot, k) => { const t = texture(m, k); if (!t) return; const c = t.clone(); c.repeat.set(wm / m.tile_m, hm / m.tile_m); c.needsUpdate = true; mat[slot] = c; };
  set("map", "albedo"); set("normalMap", "normal"); set("roughnessMap", "rough"); set("metalnessMap", "metal"); set("aoMap", "ao"); set("displacementMap", "height");
  // a packed map (Unreal's ORM, Poly Haven's ARM): AO red, roughness green, metal blue, as three reads them
  if (!mat.roughnessMap) set("roughnessMap", "orm"); if (!mat.metalnessMap) set("metalnessMap", "orm"); if (!mat.aoMap) set("aoMap", "orm");
  if (mat.metalnessMap) mat.metalness = 1;
  set("alphaMap", "opacity"); if (mat.alphaMap) mat.alphaTest = 0.5;      // a net, lace: cut out where it's dark
  if (!mat.map) mat.color.set(0x888888);
  if (mat.normalMap && m.normal === "dx") mat.normalScale.set(1, -1);     // DirectX normals: green flipped for three
  mat.displacementScale = +$("#disp").value; mat.displacementBias = -mat.displacementScale / 2;
  return mat;
}

function mesh(geo, mat, at, rot) {
  const o = new THREE.Mesh(geo, mat); o.castShadow = o.receiveShadow = true;
  if (at) o.position.set(...at); if (rot) o.rotation.set(...rot);
  holder.add(o); return o;
}

function dress() {
  for (const o of [...holder.children]) { holder.remove(o); o.geometry.dispose(); }
  const m = S.sets[S.sel];
  $("#hud").textContent = m ? `${S.sel} · one repeat ${m.tile_m} m · drag to turn, wheel to zoom` : "";
  if (!m) { draw(); return; }
  const flat = mat => { mat.displacementMap = null; return mat; };
  if (S.shape === "sphere") {                       // 1 m across: round it is π m, top to bottom π/2 m
    mesh(new THREE.SphereGeometry(0.5, 256, 128), material(m, Math.PI, Math.PI / 2), [0, 0.5, 0]);
    Object.assign(cam, { target: new THREE.Vector3(0, 0.5, 0), dist: cam.shape === "sphere" ? cam.dist : 2.6 });
  } else if (S.shape === "cube") {                  // 1 m: the size a crate or a wall's metre reads at
    mesh(new THREE.BoxGeometry(1, 1, 1), flat(material(m, 1, 1)), [0, 0.5, 0]);
    Object.assign(cam, { target: new THREE.Vector3(0, 0.5, 0), dist: cam.shape === "cube" ? cam.dist : 3 });
  } else if (S.shape === "room") {                  // a 3 x 3 m corner, 2.5 m high, with a 1.7 m figure for scale
    mesh(new THREE.PlaneGeometry(3, 3), flat(material(m, 3, 3)), [0, 0, 0], [-Math.PI / 2, 0, 0]);
    mesh(new THREE.PlaneGeometry(3, 2.5), flat(material(m, 3, 2.5)), [0, 1.25, -1.5]);
    mesh(new THREE.PlaneGeometry(3, 2.5), flat(material(m, 3, 2.5)), [-1.5, 1.25, 0], [0, Math.PI / 2, 0]);
    const fig = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.8 });
    mesh(new THREE.CapsuleGeometry(0.17, 1.36, 6, 16), fig, [-0.85, 0.85, -0.95]);
    Object.assign(cam, cam.shape === "room" ? {} : { target: new THREE.Vector3(-0.3, 1, -0.3), dist: 4.2, yaw: 0.75, pitch: 0.28 });
  } else {                                          // a 1.2 m patch under a low light: the normal and the gaps
    mesh(new THREE.PlaneGeometry(1.2, 1.2, 384, 384), material(m, 1.2, 1.2), [0, 0, 0], [-Math.PI / 2, 0, 0]);
    Object.assign(cam, cam.shape === "plane" ? {} : { target: new THREE.Vector3(0, 0, 0), dist: 1.3, yaw: 0.3, pitch: 0.75 });
  }
  cam.shape = S.shape;
  draw();
}

let t0 = performance.now();
function place() {
  const t = $("#orbit").checked ? (performance.now() - t0) / 1000 : 0;
  const low = S.shape === "plane" ? 0.5 : 2.2;
  sun.position.set(Math.cos(t * 0.6) * 3, low + 1.2, Math.sin(t * 0.6) * 3 + 1);
  sun.target.position.copy(cam.target);
  const c = Math.cos(cam.pitch);
  camera.position.set(cam.target.x + Math.sin(cam.yaw) * c * cam.dist, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * c * cam.dist);
  camera.lookAt(cam.target);
}
function draw() {
  const v = $("#view"), w = v.clientWidth, h = v.clientHeight;
  if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio())) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  place(); renderer.render(scene, camera);
}
function loop() { if ($("#orbit").checked) draw(); requestAnimationFrame(loop); }

let drag = null;
renderer.domElement.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY]; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener("pointermove", e => {
  if (!drag) return;
  cam.yaw -= (e.clientX - drag[0]) * 0.008; cam.pitch = Math.max(-0.2, Math.min(1.45, cam.pitch + (e.clientY - drag[1]) * 0.006));
  drag = [e.clientX, e.clientY]; draw();
});
renderer.domElement.addEventListener("pointerup", () => { drag = null; });
renderer.domElement.addEventListener("wheel", e => { e.preventDefault(); cam.dist = Math.max(0.3, Math.min(12, cam.dist * (e.deltaY > 0 ? 1.1 : 0.9))); draw(); }, { passive: false });
addEventListener("resize", draw);

for (const b of document.querySelectorAll("[data-shape]")) b.onclick = () => {
  S.shape = b.dataset.shape; for (const o of document.querySelectorAll("[data-shape]")) o.classList.toggle("on", o === b); dress();
};
$("#disp").oninput = dress; $("#orbit").onchange = draw;
$("#q").oninput = () => { S.q = $("#q").value.toLowerCase(); drawLeft(); };
$("#rescan").onclick = load;
{ // the way back: to the tool that opened the shelf (the scene builder by default; the Character Studio's server rewrites it)
  const back = document.querySelector('header a[href="builder.html"]'), from = new URLSearchParams(location.search).get("from");
  if (back && from === "kit") Object.assign(back, { href: "kit.html", textContent: "kit maker" });
}

window.__pbrScene = scene;
window.__pbr = { get S() { return S; }, select, shape: s => document.querySelector(`[data-shape="${s}"]`).click(), draw, load,
  stop: () => { $("#orbit").checked = false; draw(); } };
load(); loop();

// The salon (docs/SALON_PLAN.md): hair made of locks laid on an MHR head, against a reference video whose frames lock to
// the view. salonlib.js has the locks and the collider, salonref.js the reference's cameras; this is the page.
import * as THREE from "three";
import * as SL from "./salonlib.js";
import * as SR from "./salonref.js";
import * as FFD from "./ffd.js";
import * as SP from "./salonphys.js";
import { PRESETS, buildPreset } from "./salonpresets.js";
import { padding as padOf } from "./salonpad.js";
import { GLTFExporter } from "./vendor/GLTFExporter.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { LOOKS, DEFAULT_LOOK, UV_SPAN, makeAtlas, albedo, linear } from "./hairtex.js";
import { hairUniforms, applyLook, lightHair, hairMaterial, atlasTexture, albedoTexture } from "./hairshader.js";

const $ = s => document.querySelector(s);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const status = (t, cls = "") => { const s = $("#status"); s.textContent = t; s.className = cls; };
const api = async (u, body) => { const r = await fetch(u, body === undefined ? {} : { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status); return j; };
const slider = (box, label, min, max, step, val, fn, title = "") => {
  const inp = el("input", { type: "range", min, max, step, value: val, title }), out = el("output", { textContent: val });
  inp.oninput = () => { out.textContent = inp.value; fn(+inp.value); };
  box.append(el("div", { className: "row" }, el("span", { textContent: label, title }), inp, out));
  return v => { inp.value = v; out.textContent = +(+v).toFixed(3); };
};
const tick = (box, label, val, fn, title = "") => { const c = el("input", { type: "checkbox", checked: val, title }); c.onchange = () => fn(c.checked); box.append(el("label", { className: "tick", title }, c, label)); return v => { c.checked = v; }; };
const Q = new URLSearchParams(location.search);
const enc = encodeURIComponent;
// where the hair is kept: on the character it's drawn on (People/<name>/salon/), or with no character, as a hairstyle in
// the library (Content/Studio/Hair/<name>/: to start other characters from)
const styleName = () => $("#hairName").value.trim().replace(/[^A-Za-z0-9_-]/g, "_");
function where() {
  const p = st.head.person;
  if (p) return { name: p, url: f => `api/people/${enc(p)}/salon/${f}`, path: f => `Content/Studio/People/${p}/salon/${f}`, on: p };
  const n = styleName(); if (!n) throw new Error("a hairstyle's name first (Start from)");
  return { name: n, url: f => `api/hair/${n}/${f}`, path: f => `Content/Studio/Hair/${n}/${f}`, on: null };
}

// ---- the state (what salon.json holds) --------------------------------------------------------------------------------
const st = {
  version: 1,
  head: { preset: "feminine", height: 1.7, person: null },           // person: a Character Studio character (its body), or a base body
  reference: { name: null, on: true, opacity: 0.55, keyed: true, behind: false, lock: true, fit: structuredClone(SR.DEFAULT_FIT) },
  mirror: { on: false, seam: 0 },
  look: { color: "#2b1d16", byLock: false, guides: false, scalp: true, hair: DEFAULT_LOOK, custom: {} },   // hair: a look (hairtex.js), custom: its colours and numbers changed
  groups: [{ id: "g1", name: "Hair", visible: true }],
  layering: false,                     // layer by height: hair rooted higher lies over hair rooted lower
  locks: [],
  scalp: { on: true, thickness: 0.7, soft: 0.012, colour: null },   // the darkened scalp: under the hair, its roots' colour (or its own), no shine
  roots: { lift: 40, length: 0.02, vary: 0.4 },                     // how hair comes out of the head (salonlib.js's rootBend)
  volume: { thicken: 1, padding: false, thickness: 0.4, smooth: 0.5, blend: 1 },   // Thicken; the base's padding (salonpad.js); Clip blend
};
SL.setRoots(st.roots); SL.setThicken(st.volume.thicken);
let ACTIVE_GROUP = "g1", SELECTED = null, TOOL = "select";

// ---- the scene --------------------------------------------------------------------------------------------------------
const view = $("#view");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(devicePixelRatio); renderer.setClearColor(0x1b1c20, 1);
view.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 30); camera.matrixAutoUpdate = false;
const key = new THREE.DirectionalLight(0xffffff, 2.0); scene.add(key, key.target); scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const fillL = new THREE.DirectionalLight(0xb8c4ff, 0.6); scene.add(fillL, fillL.target);
const HAIR = new THREE.Group(); HAIR.matrixAutoUpdate = false; scene.add(HAIR);            // local -> world
const BAKEG = new THREE.Group(); BAKEG.matrixAutoUpdate = false; scene.add(BAKEG);          // the bake previewed: the same place, apart from the editing hair
const HANDLES = new THREE.Group(); HAIR.add(HANDLES);
let HEAD = null, HF = null, COL = null, LOCAL_PTS = null;
const HFMAT = new THREE.Matrix4(), RIG = new THREE.Matrix4();            // the head's frame; the head's motion (world)
let VW = 1, VH = 1;
function resize() { VW = view.clientWidth; VH = view.clientHeight; renderer.setSize(VW, VH, false); Object.assign(OVL_CAM, { left: 0, right: VW, top: VH, bottom: 0 }); OVL_CAM.updateProjectionMatrix(); draw(); }
new ResizeObserver(resize).observe(view);

// the view: a free orbit round the head, or locked onto the reference frame nearest to it
const orbit = { yaw: 0.35, pitch: 0.08, dist: 0.85, zoom: 1, pan: [0, 0] };
let SNAP = null;                       // the reference camera the view is on (null: free)
function headTarget() { return HF ? SR.toWorld(HF, [0, 0.01, 0]) : [0, 1.6, 0]; }
function freeCamera() {
  const c = headTarget(), d = orbit.dist;
  const p = [c[0] + d * Math.sin(orbit.yaw) * Math.cos(orbit.pitch), c[1] + d * Math.sin(orbit.pitch), c[2] + d * Math.cos(orbit.yaw) * Math.cos(orbit.pitch)];
  const f = SL.norm(SL.sub(c, p)), r = SL.norm(SL.cross(f, [0, 1, 0])), dn = SL.cross(f, r);
  const R = [r, dn, f], t = SR.MV(R, p).map(x => -x);
  const fy = VH / 2 / Math.tan(15 * Math.PI / 180) * orbit.zoom;
  return { R, t, fx: fy, fy, cx: VW / 2 + orbit.pan[0], cy: VH / 2 + orbit.pan[1] };
}
function setCamera(R, t, fx, fy, cx, cy) {
  const C = SR.centre(R, t);
  // OpenCV rows (right, down, forward) -> three's camera axes (x right, y up, looking down -z)
  camera.matrix.set(R[0][0], -R[1][0], -R[2][0], C[0], R[0][1], -R[1][1], -R[2][1], C[1], R[0][2], -R[1][2], -R[2][2], C[2], 0, 0, 0, 1);
  camera.matrixWorld.copy(camera.matrix); camera.matrixWorldInverse.copy(camera.matrix).invert();
  const P = SR.projection(fx, fy, cx, cy, VW, VH);
  camera.projectionMatrix.set(...P[0], ...P[1], ...P[2], ...P[3]); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  const h = headTarget(); key.target.position.set(...h); fillL.target.position.set(...h);   // the key above the camera's shoulder, a cool fill from the other side
  key.position.set(C[0] + R[0][0] * 0.5, C[1] + 0.9, C[2] + R[0][2] * 0.5); fillL.position.set(h[0] - R[0][0], h[1], h[2] - R[0][2]);
  lightHair(HAIRU, key.position.clone().sub(key.target.position), null, fillL.position.clone().sub(fillL.target.position), null);
}

// ---- the reference ----------------------------------------------------------------------------------------------------
// The frame is drawn as a grid of GRID x GRID cells in view pixels (an orthographic overlay), each vertex where its
// pixel lands once the reference's cube (ffd.js) has bent the space it shows: the pixel's ray meets the cube's
// ellipsoid (the hair's volume, roughly), that point is moved by the cube and projected back. With the cube at rest the
// grid is the flat picture.
let REF = null, CAMS = [], TEX = {};
const OVL = new THREE.Scene(), OVL_CAM = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1), GRID = 24;
const OVL_MESH = (() => {
  const g = new THREE.BufferGeometry(), n = (GRID + 1) ** 2, idx = [];
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) { const a = r * (GRID + 1) + c; idx.push(a, a + GRID + 1, a + 1, a + 1, a + GRID + 1, a + GRID + 2); }
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  m.frustumCulled = false; m.visible = false; OVL.add(m); return m;
})();
async function loadReference(name) {
  st.reference.name = name || null; REF = null; CAMS = []; TEX = {};
  if (!name) { OVL_MESH.visible = false; refPanel(); draw(); return; }
  REF = await api(`api/refs/${encodeURIComponent(name)}/reference.json`);
  if (!st.reference.fitFor || st.reference.fitFor !== name) { st.reference.fit = Object.assign(structuredClone(SR.DEFAULT_FIT), REF.fit || {}); st.reference.fitFor = name; }
  if (!st.reference.fit.cube) st.reference.fit.cube = cubeRoundHair();
  recam(); refPanel(); draw();
}
// the cube's start: round the reference's hair (its carved box, through the fit), or round the head and shoulders
function cubeRoundHair() {
  const f = st.reference.fit, hb = REF && REF.hull_box;
  if (!hb) return FFD.makeCube([-0.17, -0.4, -0.2], [0.17, 0.2, 0.17]);
  const Rf = SR.MM(SR.Ry((f.turn || 0) * Math.PI / 180), SR.Rx(-(f.height || 0) * Math.PI / 180)), k = f.scale || 1, o = f.offset || [0, 0, 0];
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const x of [hb.min[0], hb.max[0]]) for (const y of [hb.min[1], hb.max[1]]) for (const z of [hb.min[2], hb.max[2]]) {
    const q = SR.MV(Rf, [x, y, z]).map((v, a) => k * v + o[a]); for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], q[a]); hi[a] = Math.max(hi[a], q[a]); }
  }
  return FFD.makeCube(lo.map(v => +v.toFixed(4)), hi.map(v => +v.toFixed(4)));
}
function recam() { CAMS = REF ? SR.cameras(REF, st.reference.fit) : []; }
function texture(cam) {
  const file = st.reference.keyed && cam.keyed ? cam.keyed : cam.file, k = `${st.reference.name}/${file}`;
  if (!TEX[k]) {
    const im = new Image(), t = new THREE.Texture(im);
    t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    im.onload = () => { t.needsUpdate = true; t.userData.loaded = true; draw(); };
    im.src = `api/refs/${encodeURIComponent(st.reference.name)}/${file}`; TEX[k] = t;
  }
  return TEX[k];
}
function snapView() {
  SNAP = null;
  if (!REF || !st.reference.on || !st.reference.lock || !HF) return;
  const fc = freeCamera(), dir = SR.toLocal(HF, SR.centre(fc.R, fc.t));
  SNAP = SR.nearest(CAMS, dir, 3);
}
// where a frame pixel (in the camera's own pixels) lands in the view, through the cube
function landing(cam, u, v, cube, rest) {
  const k = VH / cam.H * orbit.zoom, cx = VW / 2 + orbit.pan[0], cy = VH / 2 + orbit.pan[1];
  if (!rest) {
    const d = SR.MV(SR.T(cam.R), [(u - cam.K[2]) / cam.K[0], (v - cam.K[3]) / cam.K[1], 1]), o = SR.centre(cam.R, cam.t);
    const X = FFD.deform(cube, FFD.ellipsoidHit(cube, o, d)), c = SR.MV(cam.R, X).map((x, a) => x + cam.t[a]);
    if (c[2] > 1e-4) { u = cam.K[0] * c[0] / c[2] + cam.K[2]; v = cam.K[1] * c[1] / c[2] + cam.K[3]; }
  }
  return [cx + (u - cam.K[2]) * k, cy + (v - cam.K[3]) * k];
}
function placeOverlay() {
  if (!SNAP || !st.reference.on) { OVL_MESH.visible = false; $("#frameTag").textContent = REF && st.reference.on && !st.reference.lock ? "reference unlocked: turn freely" : ""; return false; }
  const tex = texture(SNAP), cube = st.reference.fit.cube, rest = !cube || FFD.isRest(cube);
  const P = OVL_MESH.geometry.attributes.position, UV = OVL_MESH.geometry.attributes.uv, [s, dx, dy] = SNAP.nudge;
  for (let r = 0; r <= GRID; r++) for (let c = 0; c <= GRID; c++) {
    const i = r * (GRID + 1) + c, uo = c / GRID * SNAP.W, vo = r / GRID * SNAP.H;
    // the image's pixel (a photo's nudge: scaled and shifted, which K already carries); a mirrored frame's pixel u
    // shows the picture's W - u
    const [x, y] = landing(SNAP, uo * s + dx, vo * s + dy, cube, rest);
    P.setXYZ(i, x, VH - y, 0); UV.setXY(i, SNAP.mirrored ? 1 - c / GRID : c / GRID, 1 - r / GRID);
  }
  P.needsUpdate = true; UV.needsUpdate = true;
  OVL_MESH.material.map = tex; OVL_MESH.material.opacity = st.reference.opacity; OVL_MESH.material.needsUpdate = OVL_MESH.userData.tex !== tex; OVL_MESH.userData.tex = tex;
  OVL_MESH.visible = !!tex.userData.loaded; OVL_MESH.userData.flipped = SNAP.mirrored;
  $("#frameTag").textContent = `frame ${SNAP.name}${SNAP.mirrored ? " mirrored" : ""}  az ${SNAP.az.toFixed(0)}°  el ${SNAP.el.toFixed(0)}°`;
  return OVL_MESH.visible;
}

// the reference's cube drawn and pulled (the Fit tool): its face lines, a handle on every surface point
const CUBE = new THREE.Group(); HAIR.add(CUBE);
function activeCube() {
  if (TOOL === "fit" && REF && st.reference.on && st.reference.fit && st.reference.fit.cube) return { cube: st.reference.fit.cube, sym: !!st.reference.cubeSym, kind: "ref" };
  return null;
}
const stretchedPt = (cube, p) => { const m = FFD.centre(cube), sv = cube.stretch || [1, 1, 1]; return p.map((x, a) => m[a] + (x - m[a]) * sv[a]); };
function drawCube() {
  CUBE.clear();
  const ac = activeCube(); if (!ac) return;
  const cube = ac.cube, mat = new THREE.LineBasicMaterial({ color: ac.kind === "fill" ? 0x7fd0ff : 0xffa040, transparent: true, opacity: 0.75, depthTest: false });
  for (const L of FFD.lines(cube)) { const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(L.map(p => new THREE.Vector3(...stretchedPt(cube, p)))), mat); ln.renderOrder = 11; CUBE.add(ln); }
  const sizes = { corner: 0.006, edge: 0.0048, face: 0.0055 }, colours = { corner: 0xffffff, edge: 0xffc070, face: 0x6fd0ff };
  for (const h of FFD.handles(cube)) {
    const hot = HOVER_CUBE && HOVER_CUBE.join() === [h.i, h.j, h.k].join();
    const m = new THREE.Mesh(new THREE.SphereGeometry(sizes[h.kind], 10, 8), new THREE.MeshBasicMaterial({ color: hot ? 0xff5050 : colours[h.kind], depthTest: false }));
    m.position.set(...stretchedPt(cube, cube.pts[FFD.idx(cube, h.i, h.j, h.k)])); m.renderOrder = 12; CUBE.add(m);
  }
}
let HOVER_CUBE = null;
function cubeHandleAt(e) {
  const ac = activeCube(); if (!ac) return null;
  const [mx, my] = rel(e); let best = null, bd = 12;
  for (const h of FFD.handles(ac.cube)) { const [sx, sy] = screenOf(stretchedPt(ac.cube, ac.cube.pts[FFD.idx(ac.cube, h.i, h.j, h.k)])), d = Math.hypot(sx - mx, sy - my); if (d < bd) { bd = d; best = [h.i, h.j, h.k]; } }
  return best;
}
// a cube point pulled to q (where it's drawn, i.e. stretched): stored unstretched; symmetric: its mirror too
function pullCube(ijk, q, ac = activeCube() || { cube: st.reference.fit.cube, sym: !!st.reference.cubeSym }) {
  const cube = ac.cube, m = FFD.centre(cube), sv = cube.stretch || [1, 1, 1];
  const un = q.map((x, a) => m[a] + (x - m[a]) / sv[a]);
  cube.pts[FFD.idx(cube, ...ijk)] = un;
  if (ac.sym) {
    const [i2, j2, k2] = FFD.mirrorOf(cube, ...ijk);
    if (i2 !== ijk[0]) cube.pts[FFD.idx(cube, i2, j2, k2)] = [2 * m[0] - un[0], un[1], un[2]];
    else cube.pts[FFD.idx(cube, ...ijk)][0] = FFD.rest(cube, ...ijk)[0];
  }
  FFD.settle(cube);
}

// ---- the darkened scalp -----------------------------------------------------------------------------------------------
// Under the hair, the scalp in the roots' colour (unlit: no shine), so the hair doesn't look sparse: the illusion of
// depth. Thickness is its opacity, sparse to full; it fades out over `soft` at the hairline (the scalp's edge: the
// forehead, the temples, the sideburns, round the ears, the nape). A copy of the head's scalp triangles, lifted 0.5 mm.
let SCALPM = null, SCALP_DIRTY = true;
function drawScalp() {
  if (!SCALP_DIRTY) return; SCALP_DIRTY = false;
  if (SCALPM) { SCALPM.parent?.remove(SCALPM); SCALPM.geometry.dispose(); SCALPM.material.dispose(); SCALPM = null; }
  const sc = st.scalp; if (!sc || !sc.on || !HEAD || !LOCAL_PTS || !st.locks.length) return;   // no hair, no darkening: a bald head is bare
  const g = scalpGeometry(sc); if (!g) return;
  SCALPM = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  SCALPM.renderOrder = 1; SCALPM.userData.alpha = scalpAlphas(sc); SCALPM.visible = !BAKEVIEW; HEAD.add(SCALPM); HAIRV++;
}
function scalpAlphas(sc) {                                             // per head vertex: how much scalp shows there
  const n = LOCAL_PTS.length / 3, a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = [LOCAL_PTS[i * 3], LOCAL_PTS[i * 3 + 1], LOCAL_PTS[i * 3 + 2]], d = SL.sub(p, COL.C); if (SL.len(d) > 0.17) continue;
    const az = Math.abs(Math.atan2(p[0], p[2] - COL.C[2])) * 180 / Math.PI;
    if (az > 58 && az < 110 && Math.abs(p[0]) > 0.077 && p[1] < 0.045) continue;   // the ear's flap
    const m = p[1] - SL.scalpLimit(az), t = Math.max(0, Math.min(1, m / Math.max(1e-4, sc.soft)));
    a[i] = sc.thickness * t * t * (3 - 2 * t);
  }
  return a;
}
function scalpGeometry(sc, local = false) {                            // the scalp's triangles (head space, or the hair's local)
  const P = HEAD.geometry.attributes.position, N = HEAD.geometry.attributes.normal, T = MHR.tris, A = scalpAlphas(sc);
  const c = new THREE.Color().setRGB(...linear(sc.colour || look().root), THREE.LinearSRGBColorSpace);
  const map = new Map(), pos = [], col = [], idx = [];
  const vert = i => { if (map.has(i)) return map.get(i); const k = pos.length / 3, q = [P.getX(i) + N.getX(i) * 0.0005, P.getY(i) + N.getY(i) * 0.0005, P.getZ(i) + N.getZ(i) * 0.0005];
    pos.push(...(local ? SR.toLocal(HF, q) : q)); col.push(c.r, c.g, c.b, A[i]); map.set(i, k); return k; };
  for (let t = 0; t < T.length; t += 3) { const a = T[t], b = T[t + 1], d = T[t + 2]; if (A[a] <= 0 && A[b] <= 0 && A[d] <= 0) continue; idx.push(vert(a), vert(b), vert(d)); }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx);
  return g;
}
function scalpPanel() {
  const box = $("#scalpbox"); if (!box) return; box.innerHTML = "";
  box.append(el("p", { className: "note", textContent: "The scalp under the hair in the roots' colour, no shine: the hair looks fuller and deeper. Thickness takes it from sparse to full; Soft edge fades it at the hairline." }));
  const sc = st.scalp, set = () => { SCALP_DIRTY = true; draw(); };
  const t = el("div"); tick(t, "Darken the scalp", sc.on, v => { sc.on = v; set(); }); box.append(t);
  slider(box, "Thickness", 0, 1, 0.05, sc.thickness, v => { sc.thickness = v; set(); }, "sparse (0) to full (1)");
  slider(box, "Soft edge", 0, 0.03, 0.001, sc.soft, v => { sc.soft = v; set(); }, "how far in from the hairline it fades, m");
  const c = el("input", { type: "color", value: sc.colour || look().root, title: "the scalp's colour (the hair's roots' colour unless set)", oninput: () => { sc.colour = c.value; set(); } });
  box.append(el("div", { className: "row" }, el("span", { textContent: "Colour" }), c, sc.colour ? el("button", { textContent: "x", title: "back to the roots' colour", onclick: () => { sc.colour = null; set(); scalpPanel(); } }) : el("span")));
}

// ---- the head ---------------------------------------------------------------------------------------------------------
let MHR = null;
const f16 = x => { const s = x & 0x8000 ? -1 : 1, e = (x >> 10) & 31, f = x & 1023; return s * (e === 0 ? f * 5.960464477539063e-8 : e === 31 ? 0 : Math.pow(2, e - 15) * (1 + f / 1024)); };
async function loadMHR() {
  if (MHR) return MHR;
  const buf = await (await fetch("bodies/MHR_lod1.bin")).arrayBuffer();
  const hl = new DataView(buf).getUint32(0, true), H = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  const N = H.points;
  MHR = { H, N, base: new Float32Array(buf, H.points_at, N * 3), tris: new Uint32Array(buf, H.triangles_at, H.triangles * 3), h16: new Uint16Array(buf, H.shapes_at, H.shapes * N * 3),
          presets: (await (await fetch("bodies/MHR_presets.json")).json()).presets || {} };
  return MHR;
}
function bodyOf(w, height) {                                          // MHR with identity weights w, feet on the floor, `height` tall
  const m = MHR, N = m.N, P = Float32Array.from(m.base);
  w.forEach((a, k) => { if (!a) return; const o = k * N * 3; for (let i = 0; i < N * 3; i++) P[i] += a * f16(m.h16[o + i]); });
  let lo = Infinity, hi = -Infinity; for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); }
  const S = height / (hi - lo);
  for (let i = 0; i < P.length; i += 3) { P[i] *= S; P[i + 1] = (P[i + 1] - lo) * S; P[i + 2] *= S; }
  return P;
}
// the character the hair is drawn on (the Character Studio's): the body it saved (body.bin: its face on, no expression),
// or, never saved there since its face, its weights and height
let PERSON = null;
async function personBody(name) {
  await loadMHR();
  const c = await api(`api/people/${enc(name)}`);
  const r = await fetch(`api/people/${enc(name)}/body.bin?v=${Date.now()}`);
  if (r.ok) return { name, body: new Float32Array(await r.arrayBuffer()), face: true, height: c.height };
  if (!c.weights) throw new Error(`${name} has no body yet: save it in the Character Studio`);
  return { name, body: bodyOf(c.weights, c.height || 1.7), face: false, height: c.height };
}
async function buildHead() {
  const m = await loadMHR();
  if (HEAD) { scene.remove(HEAD); HEAD.geometry.dispose(); }
  const N = m.N, P = st.head.person && PERSON?.name === st.head.person ? Float32Array.from(PERSON.body) : bodyOf(m.presets[st.head.preset] || [], st.head.height);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(P, 3)); g.setIndex(new THREE.BufferAttribute(m.tris, 1)); g.computeVertexNormals();
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(N * 3).fill(1), 3));
  HEAD = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x9a9690, roughness: 0.75, vertexColors: true })); HEAD.matrixAutoUpdate = false; scene.add(HEAD);
  HF = SR.headFrame(P, REF?.local?.anchors || SR.DEFAULT_ANCHORS);
  const B = HF.B, s = HF.S;
  HFMAT.set(B[0][0] * s, B[0][1] * s, B[0][2] * s, HF.C[0], B[1][0] * s, B[1][1] * s, B[1][2] * s, HF.C[1], B[2][0] * s, B[2][1] * s, B[2][2] * s, HF.C[2], 0, 0, 0, 1);
  applyRig();
  LOCAL_PTS = new Float32Array(P.length);
  for (let i = 0; i < N; i++) { const q = SR.toLocal(HF, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); LOCAL_PTS.set(q, i * 3); }
  const ci = (REF?.local?.anchors || SR.DEFAULT_ANCHORS).chin * 3, chin = SR.toLocal(HF, [P[ci], P[ci + 1], P[ci + 2]])[1];
  COL = new SL.Collider(LOCAL_PTS, { chin, tris: m.tris });
  tintScalp();
  for (const l of st.locks) DIRTY.add(l.id);
  SCALP_DIRTY = true;
  draw();
}
function tintScalp() {
  if (!HEAD) return;
  const c = HEAD.geometry.attributes.color, on = st.look.scalp && TOOL !== "select" && TOOL !== "fit";
  for (let i = 0; i < c.count; i++) { const p = [LOCAL_PTS[i * 3], LOCAL_PTS[i * 3 + 1], LOCAL_PTS[i * 3 + 2]]; const s = on && SL.onScalp(p, COL.C); c.setXYZ(i, s ? 0.75 : 1, s ? 0.88 : 1, s ? 1.15 : 1); }
  c.needsUpdate = true;
}

// ---- drawing the locks ------------------------------------------------------------------------------------------------
const MESHES = {}, DIRTY = new Set(), EVAL = {};
// the hair's look: one strand atlas, one set of uniforms every hair material shares (a look changed restyles them all)
const look = () => Object.assign({}, LOOKS[st.look.hair] || LOOKS[DEFAULT_LOOK], st.look.custom || {});
const ATLAS = makeAtlas(), HAIRU = hairUniforms(atlasTexture(ATLAS), LOOKS[DEFAULT_LOOK]);
const HAIR_MAT = hairMaterial(HAIRU), PREVIEW_MAT = hairMaterial(HAIRU, { transparent: true, opacity: 0.7 });
for (const m of [HAIR_MAT, PREVIEW_MAT]) m.userData.shared = true;
const disposeOf = o => { o.geometry?.dispose(); if (o.material && !o.material.userData?.shared) o.material.dispose(); };
// a lock's tint for the shader: its own colour, or the debug colours (w = 1 replaces the look's colour), else none
function tintOf(l, i) { const hex = st.look.byLock ? PALETTE[i % PALETTE.length] : l.color; return hex ? [...linear(hex), 1] : [1, 1, 1, 0]; }
// along each card: the direction the strands run (two vertices a sample)
// the shader's depth (0.028 the outermost, 0 deep in the hair): how far each vertex is under the hair's outer surface
// (salonlib.js's Envelope, of all the hair shown), or until there is one, its distance off the body
let ENV = null;
const depthsOf = pos => { const d = []; for (let i = 0; i < pos.length; i += 3) { const p = [pos[i], pos[i + 1], pos[i + 2]]; d.push(ENV ? 0.028 - Math.min(0.028, ENV.under(p)) : COL ? COL.depth(p) : 0.03); } return d; };
function shadeDepths() {                                               // the outer surface again, every card's depth from it
  const shown = isShown(); ENV = new SL.Envelope(COL);
  for (const l of st.locks) if (shown(l) && EVAL[l.id]) ENV.add(EVAL[l.id]);
  for (const id in MESHES) for (const o of MESHES[id].children) if (o.userData.role === "cards") { const A = o.geometry.attributes.aDepth; A.array.set(depthsOf(o.geometry.attributes.position.array)); A.needsUpdate = true; }
}
function cardTangents(guides) { const t = []; for (const G of guides) { const n = G.pts.length; for (let k = 0; k < n; k++) { const d = SL.norm(SL.sub(G.pts[Math.min(n - 1, k + 1)], G.pts[Math.max(0, k - 1)])); t.push(...d, ...d); } } return t; }
const PALETTE = ["#c8553d", "#4f86c6", "#6dae63", "#d9a441", "#a46cc8", "#4fb3b3", "#d97a9a", "#8f9d4a"];
function lockColour(l, i) { return st.look.byLock ? PALETTE[i % PALETTE.length] : (l.color || look().tip); }
// a lock's ribbons (two vertices a guide sample) and its strands' lines, as flat position arrays
function cardPositions(guides) {
  const pos = [];
  for (const G of guides) for (let k = 0; k < G.pts.length; k++) { const h = SL.mul(G.across[k], G.width[k] / 2); pos.push(...SL.sub(G.pts[k], h), ...SL.add(G.pts[k], h)); }
  return pos;
}
function strandPositions(l, guides) { const pos = []; for (const s of SL.strandsOf(l, guides)) for (let k = 1; k < s.length; k++) pos.push(...s[k - 1], ...s[k]); return pos; }
function buildLockMesh(l, i, laid = null) {
  const guides = laid || SL.evaluate(l, COL); EVAL[l.id] = guides;
  const grp = new THREE.Group(); grp.userData.lock = l.id;
  if (l.render === "strands") {                                      // thin lines in the look's colours (the inner ones too)
    const strands = SL.strandsOf(l, guides), cols = [], k0 = look(), tint = tintOf(l, i), r = SL.rng(5);
    const root = tint[3] ? tint.slice(0, 3).map(x => x * 0.45) : linear(k0.root), tip = tint[3] ? tint.slice(0, 3) : SL.mul(SL.add(linear(k0.tip), linear(k0.spec2)), 0.6);
    for (const s of strands) { const inner = !tint[3] && r() < k0.innerAmount, c1 = inner ? linear(k0.inner) : tip, br = 0.6 + 0.4 * r();
      for (let k = 1; k < s.length; k++) { const a = Math.min(1, (k - 1) / (s.length - 1) / k0.rootLength), b = Math.min(1, k / (s.length - 1) / k0.rootLength);
        for (const f of [a, b]) cols.push(...[0, 1, 2].map(x => (root[x] + (c1[x] - root[x]) * f) * br)); } }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(strandPositions(l, guides), 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true })); m.userData.role = "strands"; grp.add(m);
  } else {
    const uv = [], tints = [], idx = [], tint = tintOf(l, i);
    guides.forEach((G, j) => {
      const base = j * G.pts.length * 2, n = G.pts.length, u0 = (j * 0.37) % 1;
      for (let k = 0; k < n; k++) { const v = G.t ? G.t[k] : k / (n - 1); uv.push(u0, v, u0 + UV_SPAN, v); tints.push(...tint, ...tint); }
      for (let k = 0; k < n - 1; k++) { const a = base + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(cardPositions(guides), 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("aTangent", new THREE.Float32BufferAttribute(cardTangents(guides), 3)); g.setAttribute("aTint", new THREE.Float32BufferAttribute(tints, 4)); g.setIndex(idx); g.computeVertexNormals();
    g.setAttribute("aDepth", new THREE.Float32BufferAttribute(depthsOf(g.attributes.position.array), 1));
    const m = new THREE.Mesh(g, HAIR_MAT); m.userData.role = "cards"; grp.add(m);
  }
  if (st.look.guides || l.id === SELECTED) {
    guides.forEach((G, j) => { const g = new THREE.BufferGeometry().setFromPoints(G.pts.map(p => new THREE.Vector3(...p))); const ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color: l.id === SELECTED ? 0xffd27a : 0x6f7a8a, depthTest: l.id !== SELECTED })); ln.userData = { role: "guide", j }; grp.add(ln); });
  }
  return grp;
}
// a swinging lock drawn where the physics has it (same vertices, new positions)
function poseLockMesh(l, posed, laid = null) {
  const grp = MESHES[l.id]; if (!grp) return;
  const guides = laid || SL.evaluate(posed, COL);
  for (const o of grp.children) {
    const P = o.geometry.attributes.position;
    const src = o.userData.role === "cards" ? cardPositions(guides) : o.userData.role === "strands" ? strandPositions(l, guides) : guides[o.userData.j] ? guides[o.userData.j].pts.flat() : null;
    if (!src || src.length !== P.array.length) continue;
    P.array.set(src); P.needsUpdate = true;
    if (o.userData.role === "cards") { o.geometry.computeVertexNormals(); const T = o.geometry.attributes.aTangent; T.array.set(cardTangents(guides)); T.needsUpdate = true; }
  }
}
// the shown hair as it's drawn: with Layer by height on, lowest root first, each laid over the ones before; the covers
// (the finishing helper's hair) always last, over all the rest, layers on or off. list: the shown locks (or their posed
// copies); fixed: guides already laid for locks that haven't moved. A map id -> guides, or null when nothing's layered.
// With a base (Volume: groups ticked as base), the base is laid first, its smooth outside found (salonpad.js's hull, BASE),
// and every other lock is pushed out of it by Clip blend (1: it lies on the base; 0: it may sink into it).
const inBase = l => st.groups.some(g => g.base && g.id === l.group);
const layOrder = list => list.slice().sort((a, b) => (inBase(b) - inBase(a)) || (!!a.cover - !!b.cover) || (st.layering ? SL.rootHeight(a) - SL.rootHeight(b) : 0) || (a.id < b.id ? -1 : 1));
let BASE = null, BASE_DIRTY = true;
function baseFrom(laid) {                                              // the base's padding and hull, from its laid guides
  if (!BASE_DIRTY && BASE) return BASE;
  const V = st.volume, guides = st.locks.filter(l => inBase(l) && !(l.physics && l.physics.on)).map(l => laid.get(l.id) || EVAL[l.id]).filter(Boolean);
  BASE = guides.length ? padOf(guides, COL, { thickness: V.thickness, smooth: V.smooth }) : null; BASE_DIRTY = false;
  return BASE;
}
function onBase(hull, under) {                                         // a layer push, then out of the base by Clip blend
  const k = st.volume.blend ?? 1;
  return { C: COL.C, push: p => {
    const q = under ? under.push(p) : p; if (!k || q[1] < COL.chin - 0.03) return q;
    const d = SL.sub(q, COL.C), r = SL.len(d), R = hull.at(SL.mul(d, 1 / r)); if (!R || r >= R + 0.0015) return q;
    return SL.mix(q, SL.add(COL.C, SL.mul(d, (R + 0.0015) / r)), k);
  } };
}
function layOut(list, fixed = null) {
  const based = st.groups.some(g => g.base);
  if (!st.layering && !list.some(l => l.cover) && !based) return null;
  const layers = new SL.Layers(COL), out = new Map();
  let hull = null;
  for (const l of layOrder(list)) {
    if (based && !hull && !inBase(l)) { const B = baseFrom(out); hull = B ? B.hull : null; }   // the base is laid: its outside
    const lay = st.layering || l.cover ? layers : null, push = hull && !inBase(l) ? onBase(hull, lay) : lay;
    const g = fixed && fixed.has(l.id) ? fixed.get(l.id) : SL.evaluate(l, COL, push);
    layers.add(g); out.set(l.id, g);
  }
  if (based) baseFrom(out);
  return out;
}
const isShown = () => { const vis = Object.fromEntries(st.groups.map(g => [g.id, g.visible])); return l => l.visible && vis[l.group] !== false; };
function refreshLocks() {
  const ids = new Set(st.locks.map(l => l.id));
  if (st.locks.some(l => DIRTY.has(l.id) && inBase(l)) || [...DIRTY].some(id => !ids.has(id))) BASE_DIRTY = true;   // the base changed: its outside again
  if ((st.layering || st.locks.some(l => l.cover) || (BASE_DIRTY && st.groups.some(g => g.base))) && DIRTY.size) for (const l of st.locks) DIRTY.add(l.id);   // a change re-lays the layers (all of them: simple, quick enough)
  for (const id of Object.keys(MESHES)) if (!ids.has(id) || DIRTY.has(id)) { HAIR.remove(MESHES[id]); MESHES[id].traverse(disposeOf); delete MESHES[id]; delete EVAL[id]; }
  const shown = isShown(), laid = st.locks.some(l => !MESHES[l.id]) ? layOut(st.locks.filter(l => shown(l) || inBase(l))) : null;   // a hidden base still holds the rest up
  const rebuilt = st.locks.some(l => !MESHES[l.id]);
  st.locks.forEach((l, i) => {
    if (!MESHES[l.id]) { MESHES[l.id] = buildLockMesh(l, i, laid && laid.get(l.id) || null); HAIR.add(MESHES[l.id]); }
    MESHES[l.id].visible = shown(l);
  });
  if (rebuilt) { shadeDepths(); PAD_DIRTY = true; HAIRV++; }
  DIRTY.clear();
  drawHandles();
}
let HOVER = null;
function drawHandles() {
  HANDLES.clear();
  const l = lockById(SELECTED); if (!l || TOOL !== "select") return;
  const geo = new THREE.SphereGeometry(0.0045, 10, 8);
  for (const h of SL.handles(l)) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: h.root ? 0x5aa65a : HOVER && HOVER.join() === h.path.join() ? 0xffffff : 0xd9a441, depthTest: false }));
    m.renderOrder = 10; m.position.set(...h.p); HANDLES.add(m);
  }
  if (l.type === "sheet") {                                          // the root line drawn along the scalp
    const g = new THREE.BufferGeometry().setFromPoints(l.root.map(p => new THREE.Vector3(...p)));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x5aa65a, depthTest: false })); line.renderOrder = 10; HANDLES.add(line);
  }
  drawReach();
}
// the pull's reach (Blender's proportional circle): a ring round where the handle taken was, in the view's plane, and
// every handle it takes, brighter the more it moves
function drawReach() {
  const at = DRAG && DRAG.kind === "handle" ? { id: DRAG.lock, path: DRAG.path } : HOVER && SELECTED ? { id: SELECTED, path: HOVER } : null;
  if (!PULL.on || !at) return;
  const start = DRAG && DRAG.kind === "handle" ? DRAG.start : SL.pullStart(st.locks);
  const g = (start[at.id] || []).find(h => h.key === at.path.join()); if (!g) return;
  const n = new THREE.Vector3(); camera.getWorldDirection(n);
  const f = SL.norm(SR.MV(SR.T(HF.B), n.toArray())), u = SL.norm(SL.cross(f, Math.abs(f[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), v = SL.cross(f, u);
  const ring = [...Array(65)].map((_, i) => { const a = i / 64 * Math.PI * 2; return new THREE.Vector3(...SL.add(g.p, SL.add(SL.mul(u, Math.cos(a) * PULL.size), SL.mul(v, Math.sin(a) * PULL.size)))); });
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineBasicMaterial({ color: 0xe8e8e8, depthTest: false, transparent: true, opacity: 0.8 }));
  line.renderOrder = 11; HANDLES.add(line);
  const dot = new THREE.SphereGeometry(0.0025, 8, 6), lo = new THREE.Color(0x7a4e14), hi = new THREE.Color(0xffe08a);
  for (const x of SL.pullWeights(start, at, g.p, pullOpts())) {
    if (x.id === at.id && x.key === g.key) continue;
    const l = lockById(x.id), h = l && SL.handles(l).find(q => q.path.join() === x.key); if (!h) continue;
    const m = new THREE.Mesh(dot, new THREE.MeshBasicMaterial({ color: lo.clone().lerp(hi, x.w), depthTest: false }));
    m.renderOrder = 12; m.position.set(...h.p); HANDLES.add(m);
  }
}

// the placing preview: a lock that isn't in the state yet
let PREVIEW = null;
function showPreview(l) {
  if (PREVIEW) { HAIR.remove(PREVIEW); PREVIEW.traverse(disposeOf); PREVIEW = null; }
  if (!l) return;
  PREVIEW = buildLockMesh(l, st.locks.length);
  PREVIEW.traverse(o => { if (o.material === HAIR_MAT) o.material = PREVIEW_MAT; else if (o.material && !o.material.userData?.shared) { o.material.transparent = true; o.material.opacity = 0.75; } });
  HAIR.add(PREVIEW);
}
let ROOTLINE = null;
function showRootLine(pts) {
  if (ROOTLINE) { HAIR.remove(ROOTLINE); ROOTLINE.geometry.dispose(); ROOTLINE = null; }
  if (!pts || pts.length < 1) return;
  ROOTLINE = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color: 0x5aa65a, depthTest: false }));
  ROOTLINE.renderOrder = 10; HAIR.add(ROOTLINE);
}

// ---- the head's motion and the physics ----------------------------------------------------------------------------------
// Turn, nod, shake and walk move the head and the hair together about the neck; the locks with physics on lag, swing and
// settle back to their style (salonphys.js). Still stops the head; the swinging settles.
let MOTION = "still", SIM = null, SIM_DIRTY = true, T0 = performance.now(), PLAYING = false;
function rigAt(t) {
  const w = 2 * Math.PI, e = new THREE.Euler(), off = new THREE.Vector3();
  if (MOTION === "turn") e.set(0, 0.7 * Math.sin(w * 0.5 * t), 0);
  else if (MOTION === "nod") e.set(0.3 * Math.sin(w * 0.7 * t), 0, 0);
  else if (MOTION === "shake") e.set(0, 0.45 * Math.sin(w * 1.8 * t), 0);
  else if (MOTION === "walk") { e.set(0.04 * Math.sin(w * 1.8 * t), 0.08 * Math.sin(w * 0.9 * t), 0.05 * Math.sin(w * 0.9 * t)); off.set(0, 0.03 * Math.abs(Math.sin(w * 0.9 * t)), 0); }
  const piv = HF ? new THREE.Vector3(...SR.toWorld(HF, [0, -0.11, -0.02])) : new THREE.Vector3();
  return new THREE.Matrix4().makeTranslation(-piv.x, -piv.y, -piv.z).premultiply(new THREE.Matrix4().makeRotationFromEuler(e)).premultiply(new THREE.Matrix4().makeTranslation(piv.x + off.x, piv.y + off.y, piv.z + off.z));
}
function applyRig() {
  if (HEAD) { HEAD.matrix.copy(RIG); HEAD.matrixWorldNeedsUpdate = true; }
  HAIR.matrix.copy(RIG).multiply(HFMAT); HAIR.matrixWorldNeedsUpdate = true;
  BAKEG.matrix.copy(HAIR.matrix); BAKEG.matrixWorldNeedsUpdate = true;
}
function physicsLocks() { return st.locks.filter(l => l.physics && l.physics.on && l.visible); }
function stepPhysics(t) {
  if (SIM_DIRTY || !SIM) { SIM = new SP.Sim(physicsLocks(), COL); SIM_DIRTY = false; }
  RIG.copy(rigAt(t)); applyRig();
  const M = HAIR.matrix.clone(), Mi = M.clone().invert(), v = new THREE.Vector3();
  const toW = p => v.set(p[0], p[1], p[2]).applyMatrix4(M).toArray(), toL = p => v.set(p[0], p[1], p[2]).applyMatrix4(Mi).toArray();
  const e = RIG.elements, Rr = [[e[0], e[4], e[8]], [e[1], e[5], e[9]], [e[2], e[6], e[10]]];
  SIM.step(toW, toL, Rr, t, 1 / 60);
  for (const l of st.locks) if (SIM.has(l.id) && MESHES[l.id]) poseLockMesh(l, SIM.pose(l, toL));
  return { toL };
}
function setMotion(m) {
  MOTION = m; for (const b of document.querySelectorAll("#movebox button[data-m]")) b.classList.toggle("on", b.dataset.m === m);
  if (!PLAYING) { PLAYING = true; T0 = performance.now(); requestAnimationFrame(play); }
}
let STILL_SINCE = 0;
function play(now) {
  const t = (now - T0) / 1000;
  stepPhysics(t); render();
  const rustling = physicsLocks().some(l => l.physics.rustle > 0);
  STILL_SINCE = MOTION === "still" && !rustling ? (STILL_SINCE || now) : 0;
  if (STILL_SINCE && now - STILL_SINCE > 2500) {                       // settled (2.5 s still, whatever the frame rate): the style drawn exactly, the loop off
    PLAYING = false; STILL_SINCE = 0; RIG.identity(); applyRig(); SIM && SIM.reset(); for (const l of physicsLocks()) DIRTY.add(l.id); draw(); return;
  }
  requestAnimationFrame(play);
}
// ---- the cover: the finishing helper ----------------------------------------------------------------------------------
// Hair over the gaps (Finish): a parting along the head's middle (the mirror's seam, so a side parting moves it), each
// root a Y: up through the hair to its top, then out to both sides over it, as long as the hair rooted highest on the
// head (Length changes it). Show it previews the Y's; Make the hair adds them (group Cover, laid over all the other
// hair) and lets them fall onto it (gravity on for them alone). salonlib.js's partingCover.
const COVER = { show: false, from: 0.1, to: 0.6, length: null };
let COVERM = null;
function hairOver() {                                                  // a point lifted onto the hair shown (not covers)
  const map = new SL.Layers(COL); for (const l of layOrder(st.locks.filter(isShown()).filter(l => !l.cover))) if (EVAL[l.id]) map.add(EVAL[l.id]);
  return p => map.push(p);
}
function topLength() {                                                 // how long the hair rooted highest is (its middle guide)
  const l = st.locks.filter(isShown()).filter(l => !l.cover).sort((a, b) => SL.rootHeight(b) - SL.rootHeight(a))[0];
  const G = l && (EVAL[l.id] || SL.evaluate(l, COL)); return G ? SL.length(G[G.length >> 1].pts) : 0.15;
}
const coverLocks = () => SL.partingCover(COL, { seam: st.mirror.seam, from: COVER.from, to: COVER.to, length: COVER.length ?? topLength(), over: hairOver(), group: "cover" });
function drawCover() {
  if (COVERM) { HAIR.remove(COVERM); COVERM.traverse(disposeOf); COVERM = null; }
  if (!COVER.show) return;
  const locks = coverLocks(); if (!locks.length) return;
  const line = (pts, color) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(SL.catmull(pts).map(p => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color, depthTest: false })); l.renderOrder = 10; return l; };
  COVERM = new THREE.Group();
  for (const l of locks) { for (const E of l.edges) COVERM.add(line(E, 0x9cc4ff)); COVERM.add(line(l.root, 0x5aa65a)); }
  HAIR.add(COVERM);
}
function makeCoverHair() {
  render();
  const locks = coverLocks(); if (!locks.length) return null;
  remember();
  if (!st.groups.find(g => g.id === "cover")) st.groups.push({ id: "cover", name: "Cover", visible: true });
  st.locks.push(...locks);
  COVER.show = false; drawCover(); SELECTED = null; locksPanel(); selPanel(); coverPanel(); render();
  startDrop(locks.map(l => l.id));
  return locks;
}
function coverPanel() {
  const box = $("#coverbox"); if (!box) return; box.innerHTML = "";
  box.append(el("p", { className: "note", textContent: "Hair over the gaps: a parting along the head's middle (the mirror's seam), each root a Y, up through the hair to its top and out to both sides over it. Make the hair: it lies over all the other hair and falls onto it (switch gravity off to keep it)." }));
  const set = () => { drawCover(); draw(); };
  const t = el("div"); tick(t, "Show the parting", COVER.show, v => { COVER.show = v; set(); coverPanel(); }, "the Y's it would make, before making them"); box.append(t);
  slider(box, "From", 0, 100, 1, Math.round(COVER.from * 100), v => { COVER.from = v / 100; set(); }, "% along the head's middle where it starts: 0 the front hairline, 100 the nape");
  slider(box, "To", 0, 100, 1, Math.round(COVER.to * 100), v => { COVER.to = v / 100; set(); }, "% along the head's middle where it ends");
  slider(box, "Length", 2, 80, 0.5, +((COVER.length ?? topLength()) * 100).toFixed(1), v => { COVER.length = v / 100; set(); }, "cm each side reaches: at first, as long as the hair rooted highest on the head");
  box.append(el("button", { textContent: "Make the hair", onclick: makeCoverHair }));
}

// ---- gravity: all the hair falls -------------------------------------------------------------------------------------------
// The switch drops every visible lock (physics or not): nothing holds it to its style, it falls and lies on the head and
// shoulders or hangs. Every step is recorded; the slider goes back to any of them; switching off (or Keep this frame)
// makes the frame shown the hair's shape, to refine by hand (undo takes it back). salonphys.js's Sim, drop mode.
// What's shown is what's kept: a twin is drawn as its original's fall mirrored (it falls only when its original is
// hidden), and with Layer by height on, every frame is laid in layers as the kept hair will be.
let DROP = null;
const ID3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], IDP = p => p;
function startDrop(only = null) {                                     // only: the ids that fall (a cover); the rest stays, in their way
  if (BAKEVIEW) previewBake(false);
  if (MOTION !== "still") setMotion("still");
  RIG.identity(); applyRig(); render();
  const all = st.locks.filter(isShown()), locks = only ? all.filter(l => only.includes(l.id)) : all;
  const ids = new Set(locks.map(l => l.id)), twin = l => l.mirror_of && ids.has(l.mirror_of);
  const down = SL.norm(SR.MV(SR.T(HF.B), [0, -1, 0]));               // the world's down in the head's space
  let col = COL;
  if (only) {                                                          // the hair that stays is a layer they land on
    const map = new SL.Layers(COL); for (const l of layOrder(all.filter(l => !ids.has(l.id)))) if (EVAL[l.id]) map.add(EVAL[l.id]);
    col = { push: (p, gap) => { const [q, m] = COL.push(p, gap), r = map.push(q); return [r, m || r !== q]; } };
  }
  // hair rubs where it touches the head or the hair (it stays where it lies, slides where it's steep): Friction
  DROP = { sim: new SP.Sim(locks.filter(l => !twin(l)), col, { drop: true, down, strength: st.dropStrength ?? 1, friction: st.dropFriction ?? 1, rootHold: st.dropRootHold ?? 0.5 }), twins: locks.filter(twin), only, frames: [], frame: 0, running: true };
  DROP.sim.step(IDP, IDP, ID3, 0, 0); DROP.frames.push(DROP.sim.snapshot());
  dropPanel(); requestAnimationFrame(dropLoop);
}
function showDropFrame(i) {
  if (!DROP) return;
  DROP.frame = Math.max(0, Math.min(DROP.frames.length - 1, i)); DROP.sim.restoreFrame(DROP.frames[DROP.frame]);
  const posed = dropPoses(), shown = st.locks.filter(l => isShown()(l) || inBase(l));   // laid as the kept hair will be (the still hair as it is)
  if ([...posed.keys()].some(id => inBase(lockById(id)))) BASE_DIRTY = true;           // the base falling: its outside each frame
  const laid = layOut(shown.map(l => posed.get(l.id) || l), new Map(shown.filter(l => !posed.has(l.id) && EVAL[l.id]).map(l => [l.id, EVAL[l.id]])));
  for (const [id, p] of posed) poseLockMesh(lockById(id), p, laid ? laid.get(id) : null);
  const sl = $("#dropFrame"); if (sl) { sl.max = DROP.frames.length - 1; sl.value = DROP.frame; } const o = $("#dropTime"); if (o) o.textContent = `${(DROP.frame / 30).toFixed(1)} s`;
}
function dropPoses() {                                                // every lock shown, where the fall has it (the sim's frame)
  const out = new Map();
  for (const l of st.locks) if (DROP.sim.has(l.id)) out.set(l.id, DROP.sim.pose(l, IDP));
  for (const t of DROP.twins) { const o = out.get(t.mirror_of); if (o) out.set(t.id, Object.assign(SL.mirrored(o, st.mirror.seam, COL, t.id), { group: t.group, visible: t.visible })); }
  return out;
}
function dropLoop() {
  if (!DROP || !DROP.running) return;
  if (DROP.frame !== DROP.frames.length - 1) DROP.frames.length = DROP.frame + 1;   // run on from a frame gone back to
  for (let k = 0; k < 2; k++) DROP.sim.step(IDP, IDP, ID3, 0, 1 / 60);
  DROP.frames.push(DROP.sim.snapshot()); showDropFrame(DROP.frames.length - 1); render();
  if (DROP.frames.length >= 360) { DROP.running = false; dropPanel(); return; }      // 12 s: it has long since settled
  requestAnimationFrame(dropLoop);
}
function pauseDrop() { if (DROP) { DROP.running = false; dropPanel(); } }
function runDrop() { if (DROP && !DROP.running) { DROP.running = true; dropPanel(); requestAnimationFrame(dropLoop); } }
function keepDrop() {                                                  // the frame shown becomes the hair's shape
  if (!DROP) return;
  remember();
  DROP.sim.restoreFrame(DROP.frames[DROP.frame]);
  for (const l of st.locks) {
    if (!DROP.sim.has(l.id)) continue;                                // twins drawn from their originals follow them
    let o = l, posed = DROP.sim.pose(l, IDP);
    if (l.mirror_of && lockById(l.mirror_of)) { o = lockById(l.mirror_of); posed = SL.mirrored(posed, st.mirror.seam, null, o.id); }   // a twin that fell alone: onto its original, mirrored back
    const roots = o.type === "strand" ? [o.pts[0]] : o.type === "bundle" ? [o.spine[0]] : o.edges.map(E => E[0]);   // the roots stay exactly
    if (o.type === "strand") { o.pts = posed.pts; o.pts[0] = roots[0]; }
    else if (o.type === "bundle") { o.spine = posed.spine; o.spine[0] = roots[0]; }
    else { o.edges = posed.edges; o.edges.forEach((E, j) => { E[0] = roots[j]; }); }
    changed(o);
  }
  DROP = null; dropPanel(); draw();
}
function revertDrop() { DROP = null; for (const l of st.locks) DIRTY.add(l.id); dropPanel(); draw(); }
function dropPanel() {
  const box = $("#dropbox"); if (!box) return; box.innerHTML = "";
  box.append(el("p", { className: "note", textContent: DROP && DROP.only ? "The cover is falling onto the hair. Slide back to any moment; switch off (or Keep this frame) and that's its shape." : "Gravity on: all the hair falls and lies or hangs. Slide back to any moment; switch off (or Keep this frame) and that's the hair's shape, then pull up what should stick up." }));
  const sw = el("button", { textContent: DROP ? "Gravity: on" : "Gravity: off", className: DROP ? "on" : "", onclick: () => DROP ? keepDrop() : startDrop() }); sw.id = "dropSwitch"; box.append(sw);
  slider(box, "Strength", 0.2, 2, 0.1, st.dropStrength ?? 1, v => { st.dropStrength = v; if (DROP) DROP.sim.strength = v, DROP.sim.items.forEach(it => { it.ph.gravity = v; }); }, "how hard gravity pulls (1: the real thing)");
  slider(box, "Root hold", 0, 1, 0.05, st.dropRootHold ?? 0.5, v => { st.dropRootHold = v; if (DROP) DROP.sim.rootHold = v; }, "how stiff the roots are: their first few cm keep their comb while the rest falls (0: nothing holds them)");
  slider(box, "Friction", 0, 1.5, 0.05, st.dropFriction ?? 1, v => { st.dropFriction = v; if (DROP) DROP.sim.friction = v; }, "how much hair sticks where it touches the head or the hair (0: it slides round the head to its lowest; 1: it stays on slopes under 45 degrees)");
  if (!DROP) return;
  const fr = el("input", { type: "range", min: 0, max: DROP.frames.length - 1, step: 1, value: DROP.frame, id: "dropFrame", title: "the moments recorded: slide back to one", oninput: () => { pauseDrop(); showDropFrame(+fr.value); render(); } });
  box.append(el("div", { className: "row" }, el("span", { textContent: "Moment" }), fr, el("output", { id: "dropTime", textContent: `${(DROP.frame / 30).toFixed(1)} s` })));
  box.append(DROP.running ? el("button", { textContent: "Pause", onclick: pauseDrop }) : el("button", { textContent: "Run on", onclick: runDrop }),
             el("button", { textContent: "Keep this frame", onclick: keepDrop }), el("button", { textContent: "Back to before", onclick: revertDrop }));
}
function movePanel() {
  const box = $("#movebox"); if (!box) return; box.innerHTML = "";
  box.append(el("h4", { textContent: "Gravity" }), Object.assign(el("div"), { id: "dropbox" })); dropPanel();
  box.append(el("h4", { textContent: "Swing" }), el("p", { className: "note", textContent: "Tick Physics on a lock (Selected) to let it swing. The head's motions show it; Still lets it settle back to its style." }));
  for (const m of ["still", "turn", "nod", "shake", "walk"]) { const b = el("button", { textContent: m, onclick: () => setMotion(m) }); b.dataset.m = m; b.classList.toggle("on", m === MOTION); box.append(b); }
}

// ---- the bake: the swinging locks each a skinned mesh on its chains' bones, everything else one simplified mesh -------
const BAKE_ALONG = 8, BAKE_ALONG_PHYS = 12;
const resampleGuide = (G, m) => { const n = G.pts.length, ix = [...Array(m)].map((_, i) => Math.round(i * (n - 1) / (m - 1))); return { pts: ix.map(i => G.pts[i]), across: ix.map(i => G.across[i]), width: ix.map(i => G.width[i]), u: G.u, t: G.t && ix.map(i => G.t[i]) }; };
function cardsGeometry(guides, colour) {                                // plain arrays: positions, uvs, colours, triangles
  const pos = cardPositions(guides), uv = [], col = [], idx = [], c = colour ? new THREE.Color(colour) : new THREE.Color(1, 1, 1);
  guides.forEach((G, j) => { const n = G.pts.length, base = j * n * 2, u0 = (j * 0.37) % 1;
    for (let k = 0; k < n; k++) { const v = G.t ? G.t[k] : k / (n - 1); uv.push(u0, v, u0 + UV_SPAN, v); col.push(c.r, c.g, c.b, c.r, c.g, c.b); }
    for (let k = 0; k < n - 1; k++) { const a = base + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  return { pos, uv, col, idx };
}
function geometryOf(parts) {                                            // cards merged into one BufferGeometry
  const pos = [], uv = [], col = [], idx = [], g = new THREE.BufferGeometry();
  for (const q of parts) { const base = pos.length / 3; pos.push(...q.pos); uv.push(...q.uv); col.push(...q.col); for (const i of q.idx) idx.push(base + i); }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// the cards' look in the file: the strand atlas with the look's colours baked in (glTF can't carry the hair shader; its
// numbers ride in the material's extras for a runtime that has one), cut out at 0.4 (glTF's MASK); the vertex colours
// are white unless a lock has its own colour
function bakeMat() {
  const k = look(), cards = new THREE.MeshStandardMaterial({ name: "hair_cards", map: albedoTexture(ATLAS, albedo(ATLAS, k)), alphaTest: 0.4, vertexColors: true, roughness: 0.42, side: THREE.DoubleSide });
  cards.userData = { look: k, shader: "tools/character/hairshader.js (Kajiya-Kay, shifted per strand; the atlas's R brightness, G strand, B clump, A coverage)" };
  return cards;
}
function liveVertices() {                                               // what the salon draws now (the "before")
  let n = 0; for (const M of [...Object.values(MESHES), PADM].filter(Boolean)) M.traverse(o => { if (o.isMesh && o.geometry) n += o.geometry.attributes.position.count; }); if (SCALPM) n += SCALPM.geometry.attributes.position.count; return n;
}
let BAKED = null;
function buildBake(name) {                                             // the bake's scene and numbers, nothing written
  const vis = Object.fromEntries(st.groups.map(g => [g.id, g.visible])), shown = st.locks.filter(l => (l.visible && vis[l.group] !== false) || inBase(l));   // a hidden base is still the hair
  const statics = [], skinned = [], summary = { about: "the salon's bake (tools/character/salon.js): one static mesh, one skinned mesh per lock with physics; the head's local space (metres on MHR's base head: the origin between the ears, X the character's left, Y up, Z forward)", name, physics: [], static: {}, head: { C: HF.C, B: HF.B, S: HF.S, person: st.head.person, preset: st.head.person ? null : st.head.preset, height: st.head.person ? PERSON?.height : st.head.height } };
  shown.forEach((l, i) => {
    const guides = EVAL[l.id] || SL.evaluate(l, COL), colour = l.color || null;   // the look is in the atlas; a lock's own colour tints it
    if (l.physics && l.physics.on) skinned.push([l, guides.map(G => resampleGuide(G, BAKE_ALONG_PHYS)), colour]);
    else statics.push(cardsGeometry(guides.map(G => resampleGuide(G, BAKE_ALONG)), colour));
  });
  if (st.volume.padding) {                                             // the padding: with the still hair
    if (PAD_DIRTY || !PAD) refreshPadding();
    if (PAD && PAD.cards.length) { statics.push(cardsGeometry(PAD.cards.map(G => resampleGuide(G, BAKE_ALONG)), null)); summary.padding = { cards: PAD.cards.length, thickness: st.volume.thickness, smooth: st.volume.smooth }; }
  }
  const root = new THREE.Group(); root.name = "hair"; root.userData = { salon: summary.about };
  const mat = bakeMat();
  if (statics.length) { const m = new THREE.Mesh(geometryOf(statics), mat); m.name = "hair_static"; root.add(m); summary.static = { vertices: m.geometry.attributes.position.count, triangles: m.geometry.index.count / 3 }; }
  if (st.scalp && st.scalp.on && st.locks.length) {                    // the darkened scalp: its own mesh, unlit, its alpha by vertex
    const g = scalpGeometry(st.scalp, true);
    if (g) { const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ name: "hair_scalp", vertexColors: true, transparent: true, depthWrite: false })); m.name = "hair_scalp"; root.add(m); summary.scalp = { vertices: g.attributes.position.count, thickness: st.scalp.thickness }; }
  }
  for (const [l, guides, colour] of skinned) {
    const q = cardsGeometry(guides, colour), geo = geometryOf([q]), sk = SP.skinOf(l, guides), J = sk.J;   // colour: the lock's own, or none
    const si = [], sw = [];
    sk.weights.forEach(G => G.forEach(w => { for (let side = 0; side < 2; side++) { const ws = w.slice(0, 4); while (ws.length < 4) ws.push([0, 0]); const tot = ws.reduce((a, x) => a + x[1], 0) || 1; si.push(...ws.map(x => x[0])); sw.push(...ws.map(x => x[1] / tot)); } }));
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
    const bones = [], tag = (l.name || l.type).replace(/[^A-Za-z0-9_]/g, "_");
    sk.chains.forEach((P, c) => P.forEach((p, j) => { const b = new THREE.Bone(); b.name = `${tag}_c${c}_j${j}`; const prev = j ? P[j - 1] : [0, 0, 0]; b.position.set(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]); if (j) bones[c * J + j - 1].add(b); bones.push(b); }));
    const mesh = new THREE.SkinnedMesh(geo, mat); mesh.name = `hair_${tag}`;
    for (let c = 0; c < sk.chains.length; c++) mesh.add(bones[c * J]);
    mesh.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones));
    const ph = Object.assign({}, SP.DEFAULTS, l.physics);
    mesh.userData = { lock: l.name || l.type, physics: { stiffness: ph.stiffness, damping: ph.damping, gravity: ph.gravity, rustle: ph.rustle, hold: SP.holdOf(ph.stiffness) }, chains: sk.chains.length, joints: J };
    root.add(mesh);
    summary.physics.push({ lock: l.name || l.type, type: l.type, chains: sk.chains.length, joints: J, bones: bones.length, vertices: geo.attributes.position.count, physics: mesh.userData.physics });
  }
  summary.before = { vertices: liveVertices() };
  summary.after = { vertices: (summary.static.vertices || 0) + summary.physics.reduce((a, x) => a + x.vertices, 0) };
  return { root, summary };
}
async function bakeFile(name) {                                        // the bake as the file holds it: the binary glTF
  render(); if (st.volume.padding && (PAD_DIRTY || !PAD)) refreshPadding();   // the hair as it is now: laid, padded
  const { root, summary } = buildBake(name);
  const glb = await new Promise((ok, bad) => new GLTFExporter().parse(root, ok, bad, { binary: true }));
  root.traverse(o => { o.geometry?.dispose(); });
  return { glb, summary };
}
async function bake() {
  const at = where(), { glb, summary } = await bakeFile(at.name);
  await fetch(at.url("salon.glb"), { method: "POST", body: glb }).then(r => { if (!r.ok) throw new Error("the GLB wasn't saved"); });
  await api(at.url("salon_bake.json"), JSON.stringify(summary, null, 1));
  summary.glb_bytes = glb.byteLength; BAKED = summary; bakePanel();
  status(at.on ? `baked onto ${at.on} (${at.path("salon.glb")}): the Character Studio wears it (Hair: made in the salon)` : `baked ${at.path("salon.glb")}`, "ok");
  return summary;
}
// Preview the bake: the file it would write, read back (GLTFLoader) and shown alone, the editing hair and its live scalp
// hidden; made again a moment after anything changes the hair. Left-drag turns the head; a drawing tool ends it.
let BAKEVIEW = null, BAKEVIEW_TIMER = null, HAIRV = 0;                   // HAIRV: counts the hair's changes (locks, padding, scalp, look)
function showOnly(bake) { HAIR.visible = !bake; if (SCALPM) SCALPM.visible = !bake; BAKEG.visible = bake; }
function disposeBake() { BAKEG.traverse(o => { o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach(m => { m.map?.dispose(); m.dispose(); }); }); BAKEG.clear(); }
async function previewBake(on) {
  clearTimeout(BAKEVIEW_TIMER);
  if (!on) { BAKEVIEW = null; disposeBake(); showOnly(false); bakePanel(); draw(); return null; }
  const { glb, summary } = await bakeFile(st.head.person || null);
  const gltf = await new Promise((ok, bad) => new GLTFLoader().parse(glb, "", ok, bad));
  let skinned = 0, bones = 0, meshes = 0; gltf.scene.traverse(o => { if (o.isSkinnedMesh) skinned++; if (o.isBone) bones++; if (o.isMesh) { meshes++; o.frustumCulled = false; } });
  disposeBake(); BAKEG.add(gltf.scene); showOnly(true);
  BAKEVIEW = { v: HAIRV, summary, bytes: glb.byteLength, meshes, skinned, bones }; bakePanel(); draw();
  return { meshes, skinned, bones };
}
function previewStale() { if (BAKEVIEW && BAKEVIEW.v !== HAIRV) { BAKEVIEW.v = HAIRV; clearTimeout(BAKEVIEW_TIMER); BAKEVIEW_TIMER = setTimeout(() => { if (BAKEVIEW) previewBake(true).catch(e => status(e.message, "bad")); }, 400); } }
function bakePanel() {
  const box = $("#bakebox"); if (!box) return; box.innerHTML = "";
  const who = st.head.person;
  const pv = el("button", { textContent: BAKEVIEW ? "Preview the bake: on" : "Preview the bake", className: BAKEVIEW ? "on" : "", title: "only the bake shown, as it would be written (the hair you edit hidden); made again as you change things; a drawing tool ends it",
    onclick: () => previewBake(!BAKEVIEW).catch(e => status(e.message, "bad")) }); pv.id = "previewBake";
  box.append(pv, el("button", { textContent: who ? `Bake onto ${who}` : "Bake the hairstyle", onclick: () => bake().catch(e => status(e.message, "bad")) }));
  const n = BAKEVIEW ? BAKEVIEW.summary : BAKED;
  if (n) box.append(el("p", { className: "note", textContent: `${BAKEVIEW ? "Preview" : "Baked"}: ${n.before.vertices} vertices live -> ${n.after.vertices}: one still mesh of ${n.static.vertices || 0}, ${n.physics.length} swinging (${n.physics.map(p => `${p.lock}: ${p.bones} bones`).join(", ") || "none"}); ${Math.round((BAKEVIEW ? BAKEVIEW.bytes : n.glb_bytes) / 1024)} KB` }));
  box.append(el("p", { className: "note", textContent: (who ? `Bake puts the hair on ${who} (Content/Studio/People/${who}/salon/salon.glb): the Character Studio wears it (Hair: made in the salon), and so will the director's desk; ${who} goes to Unreal from there, finished, rigged and animated, hair and all. `
    : "Bake writes the hairstyle's mesh (Content/Studio/Hair/<name>/salon.glb); pick a character at the top to bake the hair onto it. ") +
    "In it: every lock with physics its own skinned mesh on bones along its chains (a sheet three chains, a strand or bundle one), everything else (and the padding, while it's ticked in Volume) merged into one mesh with fewer points along each card, and the darkened scalp." }));
}

// ---- the frame ---------------------------------------------------------------------------------------------------------
let PENDING = false;
function draw() { if (PENDING) return; PENDING = true; requestAnimationFrame(() => { PENDING = false; render(); }); }
function render() {
  if (!HF) { renderer.autoClear = true; renderer.render(scene, camera); return; }
  snapView();
  if (SNAP) {
    const w = SR.worldCamera(SNAP, HF), k = VH / SNAP.H * orbit.zoom;
    setCamera(w.R, w.t, SNAP.K[0] * k, SNAP.K[1] * k, VW / 2 + orbit.pan[0], VH / 2 + orbit.pan[1]);
  } else { const f = freeCamera(); setCamera(f.R, f.t, f.fx, f.fy, f.cx, f.cy); }
  refreshLocks(); drawCube(); drawScalp(); if (PAD_DIRTY) schedulePadding(); previewStale();
  const ovl = placeOverlay();
  renderer.autoClear = false; renderer.setClearColor(0x1b1c20, 1); renderer.clear();
  if (ovl && st.reference.behind) renderer.render(OVL, OVL_CAM);
  renderer.clearDepth(); renderer.render(scene, camera);
  if (ovl && !st.reference.behind) renderer.render(OVL, OVL_CAM);
}

// ---- picking ----------------------------------------------------------------------------------------------------------
const ray = new THREE.Raycaster();
function rayAt(x, y) {
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
  return ray;
}
function headAt(x, y) {                                              // the point on the body under the cursor, local
  if (!HEAD) return null;
  const hit = rayAt(x, y).intersectObject(HEAD, false)[0];
  return hit ? SR.toLocal(HF, hit.point.toArray()) : null;
}
function screenOf(p) {                                               // a local point to view pixels
  const w = new THREE.Vector3(...SR.toWorld(HF, p)).project(camera);
  return [(w.x + 1) / 2 * VW, (1 - w.y) / 2 * VH, w.z];
}
function onPlane(x, y, through) {                                    // the cursor on the plane through a local point, facing the view
  const r = rayAt(x, y), p = new THREE.Vector3(...SR.toWorld(HF, through)), n = new THREE.Vector3(); camera.getWorldDirection(n);
  const hit = r.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n, p), new THREE.Vector3());
  return hit ? SR.toLocal(HF, hit.toArray()) : null;
}
const rel = e => { const r = renderer.domElement.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
function handleAt(e) {
  const l = lockById(SELECTED); if (!l) return null;
  const [mx, my] = rel(e); let best = null, bd = 12;
  for (const h of SL.handles(l)) { const [sx, sy] = screenOf(h.p), d = Math.hypot(sx - mx, sy - my); if (d < bd) { bd = d; best = h; } }
  return best;
}
function lockAt(e) {
  const [mx, my] = rel(e); let best = null, bd = 9;
  const vis = Object.fromEntries(st.groups.map(g => [g.id, g.visible]));
  for (const l of st.locks) {
    if (!l.visible || vis[l.group] === false || !EVAL[l.id]) continue;
    for (const G of EVAL[l.id]) for (let k = 0; k < G.pts.length; k += 2) { const [sx, sy, z] = screenOf(G.pts[k]); if (z > 1) continue; const d = Math.hypot(sx - mx, sy - my); if (d < bd) { bd = d; best = l; } }
  }
  return best;
}

// ---- undo -------------------------------------------------------------------------------------------------------------
const UNDO = [], REDO = [];
const snapshot = () => JSON.stringify({ locks: st.locks, groups: st.groups, fit: st.reference.fit, layering: st.layering, scalp: st.scalp, roots: st.roots, volume: st.volume });
function remember() { UNDO.push(snapshot()); if (UNDO.length > 200) UNDO.shift(); REDO.length = 0; }
function restore(s) { SIM_DIRTY = true; const o = JSON.parse(s); if ("layering" in o) st.layering = o.layering; st.locks = o.locks; st.groups = o.groups; if (o.scalp) { st.scalp = o.scalp; SCALP_DIRTY = true; scalpPanel(); } if (o.roots) { st.roots = o.roots; SL.setRoots(st.roots); rootsPanel(); } if (o.volume) { st.volume = o.volume; SL.setThicken(st.volume.thicken); volumePanel(); } if (o.fit && REF) { st.reference.fit = o.fit; recam(); refPanel(); } for (const l of st.locks) DIRTY.add(l.id); if (!lockById(SELECTED)) SELECTED = null; locksPanel(); selPanel(); draw(); }
function undo() { if (!UNDO.length) return; REDO.push(snapshot()); restore(UNDO.pop()); }
function redo() { if (!REDO.length) return; UNDO.push(snapshot()); restore(REDO.pop()); }
$("#undo").onclick = undo; $("#redo").onclick = redo;

// ---- the locks --------------------------------------------------------------------------------------------------------
const lockById = id => st.locks.find(l => l.id === id) || null;
function changed(l) {                                                // a lock edited: its twins follow
  DIRTY.add(l.id); SIM_DIRTY = true;
  st.locks = SL.syncTwins(st.locks, st.mirror.seam, COL);
  for (const t of st.locks) if (t.mirror_of === l.id) DIRTY.add(t.id);
}
function changedMany(ids) {                                          // several locks edited: the twins synced once
  if (!ids.length) return;
  for (const id of ids) DIRTY.add(id); SIM_DIRTY = true;
  st.locks = SL.syncTwins(st.locks, st.mirror.seam, COL);
  const set = new Set(ids); for (const t of st.locks) if (set.has(t.mirror_of)) DIRTY.add(t.id);
}
function addLock(l) {
  remember();
  if (SELECTED) DIRTY.add(SELECTED);
  l.group = ACTIVE_GROUP; st.locks.push(l);
  if (st.mirror.on) { const m = SL.mirrored(l, st.mirror.seam, COL); m.group = ACTIVE_GROUP; st.locks.push(m); }
  SELECTED = l.id; locksPanel(); selPanel(); draw();
  return l;
}
function deleteLock(id) {
  remember();
  st.locks = st.locks.filter(l => l.id !== id && l.mirror_of !== id);
  for (const l of st.locks) if (l.mirror_of && !lockById(l.mirror_of)) l.mirror_of = null;
  if (SELECTED === id) SELECTED = null; locksPanel(); selPanel(); draw();
}
function original(l) { return l.mirror_of ? lockById(l.mirror_of) || l : l; }

// ---- the tools --------------------------------------------------------------------------------------------------------
const TOOLS = [["select", "Select (V)", "v"], ["strand", "Strand (S)", "s"], ["sheet", "Sheet (L)", "l"], ["bundle", "Bundle (B)", "b"], ["bline", "Bundle line (D)", "d"], ["fit", "Fit ref (F)", "f"]];
const HINTS = {
  select: "Click a lock to select it; drag a handle to shape it (Alt-drag: towards you or away). The handles in the ring move with it, less the farther they are: the wheel while dragging grows (down) or shrinks (up) the ring, O turns it off. Drag the empty view to turn the head; the wheel zooms.",
  strand: "Click a root on the blue scalp, then click where the strand ends. The wheel bows it out (sag) while you place it.",
  sheet: "Drag a root line along the blue scalp, let go, then click where the sheet ends. The wheel spreads or gathers the end.",
  bundle: "Click a root on the blue scalp, then click the tip. The wheel sets the root's width while you place it.",
  bline: "Drag a line along the blue scalp: it's the bundle's width (its diameter). Let go, then click the tip. The wheel makes it an oval (its height) while you place it.",
  fit: "Drag the picture to move it over the head (the wheel scales it), or pull the cube's points to bend it: corners white, edges orange, faces' middles blue (Alt: towards you).",
};
const PLACE = { stage: 0, root: null, line: [], sag: 0, spread: 0.05, r0: 0.015, height: 1, last: null };
function setTool(t) {
  if (BAKEVIEW && t !== "select") previewBake(false);
  TOOL = t; resetPlace();
  for (const b of document.querySelectorAll("#tools button")) b.classList.toggle("on", b.dataset.t === t);
  $("#hint").textContent = HINTS[t] + (st.mirror.on && t !== "select" && t !== "fit" ? "  Mirror is on: the other side follows." : "");
  tintScalp(); draw();
}
function resetPlace() { PLACE.stage = 0; PLACE.root = null; PLACE.line = []; PLACE.last = null; PLACE.sag = 0;   // every new lock starts flat on the head (the wheel bows it while placing)
  showPreview(null); showRootLine(null); }
for (const [t, label] of TOOLS) { const b = el("button", { textContent: label, onclick: () => setTool(t) }); b.dataset.t = t; $("#tools").append(b); }

function previewFrom(e) {
  if (!PLACE.stage) return null;
  const anchor = TOOL === "sheet" || TOOL === "bline" ? SL.along(PLACE.line, 0.5) : PLACE.root;
  // over the body the end lies on it (hair resting on the face, the shoulders, the chest); in the air, on the plane
  // through the root facing the view
  // (only a hit near the root's depth: from the front, a click on the chest means the chest, not the back of the head's
  // hair reaching round to it)
  const n = new THREE.Vector3(); camera.getWorldDirection(n); const fwd = SR.MV(SR.T(HF.B), n.toArray());
  let onBody = headAt(e.clientX, e.clientY);
  if (onBody && Math.abs(SL.dot(SL.sub(onBody, anchor), fwd)) > 0.1) onBody = null;
  const end = onBody ? COL.push(onBody, 0.008)[0] : onPlane(e.clientX, e.clientY, anchor); if (!end) return null;
  PLACE.last = [e.clientX, e.clientY];
  if (TOOL === "strand") return SL.makeStrand(PLACE.root, end, COL, { sag: PLACE.sag });
  if (TOOL === "bundle") return SL.makeBundle(PLACE.root, end, COL, { sag: PLACE.sag, r0: PLACE.r0 });
  if (TOOL === "sheet") return SL.makeSheet(PLACE.line, end, PLACE.spread, COL, { sag: PLACE.sag * 0.7 });
  if (TOOL === "bline") return SL.makeBundleLine(PLACE.line, end, COL, { sag: PLACE.sag, height: PLACE.height });
  return null;
}
function scalpAt(e) { const p = headAt(e.clientX, e.clientY); return p && (e.shiftKey || SL.onScalp(p, COL.C)) ? COL.surface(p) : null; }

let DRAG = null;
// the pull (Blender's proportional editing, salonlib.js): on (O), the falloff, the reach (the wheel while dragging; Page
// Up and Down), just the lock taken or all the hair shown
const PULL = { on: true, falloff: "smooth", size: 0.08, only: false };   // 8 cm: a long strand's handles are 6 cm apart
const shownIds = () => { const vis = Object.fromEntries(st.groups.map(g => [g.id, g.visible])); return st.locks.filter(l => l.visible && vis[l.group] !== false).map(l => l.id); };
const pullOpts = () => ({ size: PULL.on ? PULL.size : 0, falloff: PULL.falloff, only: PULL.only, ids: shownIds(), seam: st.mirror.seam, col: COL });
function pullNow() {                                                   // the drag's pull again, from where the handles started
  const moved = SL.pull(st.locks, DRAG.start, { id: DRAG.lock, path: DRAG.path }, DRAG.to, pullOpts());
  changedMany([...new Set([...moved, ...DRAG.moved])]); DRAG.moved = moved;
}
function reach(up, fine) {
  PULL.size = SL.growReach(PULL.size, up, fine);
  $("#hint").textContent = `reach ${(PULL.size * 100).toFixed(1)} cm (${PULL.falloff.replace("_", " ")})`;
  if (DRAG && DRAG.kind === "handle" && DRAG.to) pullNow();
  pullPanel(); drawHandles(); draw();
}
const cv = renderer.domElement;
cv.addEventListener("contextmenu", e => e.preventDefault());
cv.addEventListener("pointerdown", e => {
  cv.setPointerCapture(e.pointerId);
  const orbitOnly = e.button !== 0 || !!BAKEVIEW;                       // previewing the bake: the view only turns
  if (!orbitOnly && TOOL === "fit") {
    const h = cubeHandleAt(e);
    if (h) { remember(); DRAG = { kind: "cube", ijk: h, y: e.clientY }; return; }
    remember(); DRAG = { kind: "fit", x: e.clientX, y: e.clientY }; return;
  }
  if (!orbitOnly && TOOL === "select") {
    const h = handleAt(e);
    if (h) { remember(); DRAG = { kind: "handle", path: h.path, lock: SELECTED, x: e.clientX, y: e.clientY, alt: e.altKey, start: SL.pullStart(st.locks), moved: [], to: null }; drawHandles(); draw(); return; }
    const l = lockAt(e);
    if (l) { select(l.id); return; }
  }
  if (!orbitOnly && (TOOL === "strand" || TOOL === "bundle")) {
    if (PLACE.stage === 0) { const p = scalpAt(e); if (p) { PLACE.root = p; PLACE.stage = 1; showPreview(previewFrom(e)); draw(); return; } }
    else { const l = previewFrom(e); if (l) { resetPlace(); addLock(l); } return; }
  }
  if (!orbitOnly && (TOOL === "sheet" || TOOL === "bline")) {
    if (PLACE.stage === 0) { const p = scalpAt(e); if (p) { PLACE.line = [p]; DRAG = { kind: "rootline" }; showRootLine(PLACE.line); draw(); return; } }
    else { const l = previewFrom(e); if (l) { resetPlace(); addLock(l); } return; }
  }
  DRAG = { kind: "orbit", x: e.clientX, y: e.clientY };
});
cv.addEventListener("pointermove", e => {
  if (!DRAG) {
    if (PLACE.stage) { showPreview(previewFrom(e)); draw(); }
    else if (TOOL === "fit") { const h = cubeHandleAt(e); if ((h && h.join()) !== (HOVER_CUBE && HOVER_CUBE.join())) { HOVER_CUBE = h; draw(); } }
    else if (TOOL === "select" && SELECTED) { const h = handleAt(e); const p = h ? h.path : null; if ((p && p.join()) !== (HOVER && HOVER.join())) { HOVER = p; drawHandles(); draw(); } }
    return;
  }
  if (DRAG.kind === "orbit") {
    orbit.yaw -= (e.clientX - DRAG.x) * 0.008; orbit.pitch = Math.max(-1.2, Math.min(1.2, orbit.pitch + (e.clientY - DRAG.y) * 0.006));
    DRAG.x = e.clientX; DRAG.y = e.clientY; draw();
  } else if (DRAG.kind === "rootline") {
    const p = scalpAt(e); if (p && SL.len(SL.sub(p, PLACE.line[PLACE.line.length - 1])) > 0.008) { PLACE.line.push(p); showRootLine(PLACE.line); draw(); }
  } else if (DRAG.kind === "handle") {
    const l = lockById(DRAG.lock); if (!l) return;
    const h = SL.handles(l).find(x => x.path.join() === DRAG.path.join()); if (!h) return;
    let to;
    if (e.altKey) {                                                  // towards or away from the view
      const n = new THREE.Vector3(); camera.getWorldDirection(n); const nl = SL.norm(SR.MV(SR.T(HF.B), n.toArray()));
      to = SL.add(h.p, SL.mul(nl, (e.clientY - DRAG.y) * 0.0015)); DRAG.y = e.clientY;
    } else to = onPlane(e.clientX, e.clientY, h.p);
    if (!to) return;
    DRAG.to = to; pullNow(); draw();                                   // the handle and those in reach (a twin's: its original's)
  } else if (DRAG.kind === "cube") {
    const cube = st.reference.fit.cube, m = FFD.centre(cube), sv = cube.stretch || [1, 1, 1];
    const p = cube.pts[FFD.idx(cube, ...DRAG.ijk)].map((x, a) => m[a] + (x - m[a]) * sv[a]);
    let to;
    if (e.altKey) { const n = new THREE.Vector3(); camera.getWorldDirection(n); const nl = SL.norm(SR.MV(SR.T(HF.B), n.toArray())); to = SL.add(p, SL.mul(nl, (e.clientY - DRAG.y) * 0.0015)); DRAG.y = e.clientY; }
    else to = onPlane(e.clientX, e.clientY, p);
    if (to) { pullCube(DRAG.ijk, to); draw(); }
  } else if (DRAG.kind === "fit" && SNAP) {
    const dx = e.clientX - DRAG.x, dy = e.clientY - DRAG.y; DRAG.x = e.clientX; DRAG.y = e.clientY;
    const k = VH / SNAP.H * orbit.zoom, fv = SNAP.K[0] * k, c = SR.centre(SNAP.R, SNAP.t), depth = Math.hypot(...c);
    const o = st.reference.fit.offset, R = SNAP.R;
    for (let i = 0; i < 3; i++) o[i] += (R[0][i] * dx + R[1][i] * dy) * depth / fv;
    orbit.pan[0] += dx; orbit.pan[1] += dy;                          // the picture follows the cursor, the head stays
    recam(); fitPanelSync(); draw();
  }
});
cv.addEventListener("pointerup", e => {
  if (DRAG && DRAG.kind === "rootline") {
    if (PLACE.line.length === 1) {                                   // a click, no drag: a short line across the view
      const p = PLACE.line[0], n = new THREE.Vector3(); camera.getWorldDirection(n);
      const a = SL.norm(SL.cross(SR.MV(SR.T(HF.B), n.toArray()), COL.normal(p)));
      PLACE.line = [COL.surface(SL.sub(p, SL.mul(a, 0.015))), p, COL.surface(SL.add(p, SL.mul(a, 0.015)))];
    }
    PLACE.stage = 1; showRootLine(PLACE.line); showPreview(previewFrom(e)); draw();
  }
  const wasHandle = DRAG && DRAG.kind === "handle";
  if (DRAG && DRAG.kind === "fit") saveFitHint();
  DRAG = null;
  if (wasHandle) { if (lockById(SELECTED)) selPanel(); drawHandles(); draw(); }
});
cv.addEventListener("wheel", e => {
  e.preventDefault();
  const s = Math.sign(e.deltaY);
  if (DRAG && DRAG.kind === "handle") { if (PULL.on && s) reach(s > 0, e.shiftKey); return; }   // Blender's: down grows the reach, up shrinks it
  if (PLACE.stage) {
    if (TOOL === "strand") PLACE.sag = Math.max(-0.6, Math.min(1.2, PLACE.sag - s * 0.05));
    if (TOOL === "sheet") PLACE.spread = Math.max(0.005, Math.min(0.3, PLACE.spread * (s < 0 ? 1.12 : 1 / 1.12)));
    if (TOOL === "bundle") PLACE.r0 = Math.max(0.003, Math.min(0.06, PLACE.r0 * (s < 0 ? 1.12 : 1 / 1.12)));
    if (TOOL === "bline") PLACE.height = Math.max(0.1, Math.min(2, PLACE.height * (s < 0 ? 1.1 : 1 / 1.1)));
    $("#hint").textContent = TOOL === "strand" ? `sag ${PLACE.sag.toFixed(2)}` : TOOL === "sheet" ? `spread ${(PLACE.spread * 100).toFixed(1)} cm` : TOOL === "bline" ? `height ${Math.round(PLACE.height * 100)}% of the width` : `root width ${(PLACE.r0 * 200).toFixed(1)} cm`;
    if (PLACE.last) showPreview(previewFrom({ clientX: PLACE.last[0], clientY: PLACE.last[1] }));
    draw(); return;
  }
  if (TOOL === "fit" && SNAP) { st.reference.fit.scale *= s < 0 ? 1.02 : 1 / 1.02; recam(); fitPanelSync(); draw(); return; }
  if (e.shiftKey && SNAP) { stepFrame(s); return; }
  if (SNAP) orbit.zoom = Math.max(0.5, Math.min(6, orbit.zoom * (s < 0 ? 1.1 : 1 / 1.1)));
  else orbit.dist = Math.max(0.25, Math.min(3, orbit.dist * (s < 0 ? 1 / 1.1 : 1.1)));
  draw();
}, { passive: false });
addEventListener("keydown", e => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName) && !((e.ctrlKey || e.metaKey) && e.target.type !== "text")) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (e.key === "Escape") { resetPlace(); draw(); return; }
  if (e.key === "PageUp" || e.key === "PageDown") { e.preventDefault(); if (PULL.on) reach(e.key === "PageUp", e.shiftKey); return; }
  if (e.key.toLowerCase() === "o" && !e.ctrlKey) { PULL.on = !PULL.on; pullPanel(); drawHandles(); draw(); return; }
  if ((e.key === "Delete" || e.key === "Backspace") && SELECTED) { deleteLock(original(lockById(SELECTED)).id); return; }
  const t = TOOLS.find(x => x[2] === e.key.toLowerCase()); if (t && !e.ctrlKey) setTool(t[0]);
  if (e.key === "ArrowRight" && SNAP) stepFrame(1); if (e.key === "ArrowLeft" && SNAP) stepFrame(-1);
});

// the next frame round the turn: the view turned onto it
function stepFrame(s) {
  const real = CAMS.filter(c => !c.mirrored || st.reference.fit.mirror).sort((a, b) => a.az - b.az);
  let i = real.findIndex(c => c.i === SNAP.i && c.mirrored === SNAP.mirrored); if (i < 0) i = 0;
  const c = real[(i + s + real.length) % real.length];
  lookFrom(c);
}
function lookFrom(c) {                                               // the free orbit turned to a camera's direction
  const w = SR.worldCamera(c, HF), t = headTarget(), d = SL.sub(w.C, t);
  orbit.yaw = Math.atan2(d[0], d[2]); orbit.pitch = Math.atan2(d[1], Math.hypot(d[0], d[2])); draw();
}

// ---- panels -----------------------------------------------------------------------------------------------------------
let fitSet = {};
function fitPanelSync() { const f = st.reference.fit; if (f.cube && f.cube.stretch) { fitSet.sx?.(f.cube.stretch[0]); fitSet.sy?.(f.cube.stretch[1]); fitSet.sz?.(f.cube.stretch[2]); } fitSet.scale?.(f.scale); fitSet.turn?.(f.turn); fitSet.height?.(f.height); fitSet.sweep?.(f.sweep); fitSet.x?.(f.offset[0] * 100); fitSet.y?.(f.offset[1] * 100); fitSet.z?.(f.offset[2] * 100); }
function saveFitHint() { status("the fit is kept with the hair when you save", ""); }
async function refPanel() {
  const box = $("#refbox"); box.innerHTML = "";
  const sel = el("select"); sel.append(el("option", { value: "", textContent: "(none)" }));
  const list = await api("api/refs").catch(() => ({ refs: [] }));
  for (const r of list.refs) sel.append(el("option", { value: r.name, textContent: `${r.name} (${r.frames} ${r.kind === "photos" ? "photos" : "frames"}, ${Math.round(r.sweep || 0)}°)` }));
  sel.value = st.reference.name || ""; sel.onchange = () => loadReference(sel.value);
  box.append(el("div", { className: "row" }, el("span", { textContent: "Reference" }), sel, el("span")));
  const R = st.reference;
  const t = el("div");
  tick(t, "show", R.on, v => { R.on = v; draw(); }); tick(t, "lock to the frames", R.lock, v => { R.lock = v; draw(); }, "the view snaps onto the frame shot from nearest where you look");
  tick(t, "hair only", R.keyed, v => { R.keyed = v; draw(); }, "the keyed frames (the backdrop taken out) when the reference has them");
  tick(t, "behind the head", R.behind, v => { R.behind = v; draw(); }, "the picture under the head instead of over it");
  box.append(t);
  slider(box, "Opacity", 0.05, 1, 0.05, R.opacity, v => { R.opacity = v; draw(); });
  if (!REF) return;
  const f = R.fit;
  box.append(el("p", { className: "note", textContent: "The fit: drag the picture with the Fit tool (the wheel scales it), or the sliders. It's saved with the hair." }));
  fitSet.scale = slider(box, "Scale", 0.5, 2, 0.01, f.scale, v => { f.scale = v; recam(); draw(); }, "the reference's size against the head");
  fitSet.x = slider(box, "Left-right", -10, 10, 0.1, f.offset[0] * 100, v => { f.offset[0] = v / 100; recam(); draw(); }, "cm");
  fitSet.y = slider(box, "Up-down", -10, 10, 0.1, f.offset[1] * 100, v => { f.offset[1] = v / 100; recam(); draw(); }, "cm");
  fitSet.z = slider(box, "Front-back", -10, 10, 0.1, f.offset[2] * 100, v => { f.offset[2] = v / 100; recam(); draw(); }, "cm");
  fitSet.turn = slider(box, "Turn", -180, 180, 1, f.turn, v => { f.turn = v; recam(); draw(); }, "turn the video under the head until the front frame faces the face");
  fitSet.height = slider(box, "Camera height", -40, 40, 0.5, f.height, v => { f.height = v; recam(); draw(); }, "degrees: the video's camera above or below where it was found");
  fitSet.sweep = slider(box, "Sweep", 0.5, 1.5, 0.01, f.sweep, v => { f.sweep = v; recam(); draw(); }, "the turn's degrees scaled (a video that turned less or more than found)");
  slider(box, "Use up to", 30, 360, 5, f.cover ?? 360, v => { f.cover = v; recam(); draw(); }, "degrees of the turn to use from the front frame: a video that only reached the side, or a bad second half; the rest is mirrored");
  const t2 = el("div");
  tick(t2, "the other way round", f.flip, v => { f.flip = v; recam(); draw(); }, "the video turned the other way");
  tick(t2, "mirror the missing side", f.mirror, v => { f.mirror = v; recam(); draw(); }, "angles the video never reached show the mirrored frame");
  box.append(t2);
  box.append(el("h4", { textContent: "The cube" }), el("p", { className: "note", textContent: "The reference inside a cube: with the Fit tool, pull a corner (white), an edge (orange) or a face's middle (blue) to bend the picture where that side of the cube faces you; Alt-drag towards or away from you. Corners and edges are shared, so they bend every view that sees them." }));
  const c2 = el("div");
  tick(c2, "symmetric", !!R.cubeSym, v => { R.cubeSym = v; }, "a pull on one side pulls the other side's same point, mirrored");
  box.append(c2);
  const cs = f.cube.stretch || (f.cube.stretch = [1, 1, 1]);
  fitSet.sx = slider(box, "Width", 0.7, 1.4, 0.01, cs[0], v => { remember(); cs[0] = v; draw(); }, "the whole cube stretched left-right about its middle");
  fitSet.sy = slider(box, "Height", 0.7, 1.4, 0.01, cs[1], v => { remember(); cs[1] = v; draw(); }, "up-down");
  fitSet.sz = slider(box, "Depth", 0.7, 1.4, 0.01, cs[2], v => { remember(); cs[2] = v; draw(); }, "front-back");
  box.append(el("button", { textContent: "Reset the cube", title: "every point back where it started", onclick: () => { remember(); f.cube = FFD.makeCube(f.cube.min, f.cube.max); refPanel(); draw(); } }),
             el("button", { textContent: "Cube round the hair", title: "a new cube on the reference's hair as it sits now (the bends are lost)", onclick: () => { remember(); f.cube = null; f.cube = cubeRoundHair(); refPanel(); draw(); } }));
  box.append(el("h4", { textContent: "" }));
  box.append(el("button", { textContent: "Glue again", title: "back to the automatic fit", onclick: () => { R.fit = Object.assign(structuredClone(SR.DEFAULT_FIT), REF.fit || {}); R.fit.cube = cubeRoundHair(); orbit.pan = [0, 0]; orbit.zoom = 1; recam(); refPanel(); draw(); } }),
             el("button", { textContent: "Front", onclick: () => lookFrom(CAMS.find(c => !c.mirrored)) }),
             el("button", { textContent: "◀ frame", onclick: () => SNAP && stepFrame(-1) }), el("button", { textContent: "frame ▶", onclick: () => SNAP && stepFrame(1) }));
}
function mirrorPanel() {
  const box = $("#mirrorbox"); box.innerHTML = "";
  tick(box, "Mirror", st.mirror.on, v => { st.mirror.on = v; setTool(TOOL); }, "new locks get a twin across the seam that follows them");
  slider(box, "Seam", -4, 4, 0.1, st.mirror.seam * 100, v => { st.mirror.seam = v / 100; st.locks = SL.syncTwins(st.locks, st.mirror.seam, COL); for (const l of st.locks) if (l.mirror_of) DIRTY.add(l.id); draw(); }, "cm off the head's middle: a seam parallel to the middle for a side parting");
}
// ---- the starting points: hairstyles laid out rough, finished by gravity (salonpresets.js) -----------------------------
function applyPreset(id, fall = false) {
  remember();
  if (id === "bald") {                                                 // a bald head: no locks, one empty group, the scalp bare
    st.locks = []; st.groups = [{ id: "g1", name: "Hair", visible: true }]; st.layering = false; ACTIVE_GROUP = "g1"; SELECTED = null;
    SCALP_DIRTY = true; locksPanel(); selPanel(); render();
    status("Bald: no hair (Undo brings it back); draw locks or pick a preset to start one", "ok");
    return { locks: [], groups: st.groups };
  }
  const P = buildPreset(id, COL);
  st.locks = P.locks; st.groups = P.groups; st.layering = P.layering; ACTIVE_GROUP = st.groups[0].id; SELECTED = null;
  if (P.roots) { Object.assign(st.roots, P.roots); SL.setRoots(st.roots); rootsPanel(); }   // short hair lifts less at the root
  for (const l of st.locks) DIRTY.add(l.id);
  locksPanel(); selPanel(); render();
  if (fall) startDrop();
  status(`${PRESETS.find(p => p.id === id).label}: ${fall ? "falling; switch gravity off to keep it" : "press Gravity (Move) to let it fall into shape"}`, "ok");
  return P;
}
function presetPanel() {
  const box = $("#presetbox"); if (!box) return; box.innerHTML = "";
  box.append(el("p", { className: "note", textContent: "A hairstyle laid out rough, in layers, to be finished by gravity: make it, let it fall, switch gravity off when it looks right. It replaces the hair (undo brings it back)." }));
  const sel = el("select");
  sel.append(el("option", { value: "bald", textContent: "Bald (no hair)" }));
  for (const who of ["women", "men"]) { const g = el("optgroup", { label: who === "women" ? "Women" : "Men" }); for (const p of PRESETS.filter(p => p.who === who)) g.append(el("option", { value: p.id, textContent: `${p.label} (${Math.round(p.length * 100)} cm)` })); sel.append(g); }
  box.append(el("div", { className: "row" }, el("span", { textContent: "Style" }), sel, el("span")));
  box.append(el("button", { textContent: "Make it", onclick: () => applyPreset(sel.value) }), el("button", { textContent: "Make it and let it fall", onclick: () => applyPreset(sel.value, true) }));
}
// ---- volume: the hair filled out for the bake ---------------------------------------------------------------------------
// The base: the groups ticked as the base in Locks (none ticked: all the hair shown), its still locks (physics ones are
// left out: they swing). Its padding (salonpad.js) fills it out into one smooth mass of cards following the hair; shown
// while Padding is ticked, baked with the still hair. The check: how much of the scalp the hair covers, with and without
// the padding, and where locks clip into each other (the red dots).
let PAD = null, PADM = null, PAD_DIRTY = true, PAD_TIMER = null, CHECK = null, CLIPM = null;
const baseGroups = () => st.groups.filter(g => g.base).map(g => g.id);
function baseLocks() {
  const b = baseGroups(), shown = isShown();
  return st.locks.filter(l => !(l.physics && l.physics.on) && (b.length ? b.includes(l.group) : shown(l)));
}
// the base alone, baked: its still locks and its padding as one mesh, salon_base.glb; then hide it and add the swinging
// flourishes, which sit on it by Clip blend
async function bakeBase() {
  const at = where();
  if (!baseGroups().length) throw new Error("tick the base's groups in Locks first");
  render(); if (PAD_DIRTY || (st.volume.padding && !PAD)) refreshPadding();
  const parts = baseLocks().map(l => cardsGeometry((EVAL[l.id] || []).map(G => resampleGuide(G, BAKE_ALONG)), l.color || null));
  if (st.volume.padding && PAD && PAD.cards.length) parts.push(cardsGeometry(PAD.cards.map(G => resampleGuide(G, BAKE_ALONG)), null));
  const root = new THREE.Group(); root.name = "hair_base";
  const m = new THREE.Mesh(geometryOf(parts), bakeMat()); m.name = "hair_base"; root.add(m);
  const glb = await new Promise((ok, bad) => new GLTFExporter().parse(root, ok, bad, { binary: true }));
  await fetch(at.url("salon_base.glb"), { method: "POST", body: glb }).then(r => { if (!r.ok) throw new Error("the base wasn't saved"); });
  const out = { groups: baseGroups(), locks: baseLocks().length, padding: st.volume.padding && PAD ? PAD.cards.length : 0, vertices: m.geometry.attributes.position.count, glb_bytes: glb.byteLength };
  status(`baked the base: ${at.path("salon_base.glb")} (${out.locks} locks, ${out.padding} padding cards, ${out.vertices} vertices)`, "ok");
  return out;
}
function showBase(on) { remember(); for (const g of st.groups) if (g.base) g.visible = on; PAD_DIRTY = true; locksPanel(); volumePanel(); draw(); }
function schedulePadding() { clearTimeout(PAD_TIMER); PAD_TIMER = setTimeout(() => { refreshPadding(); draw(); }, DROP ? 600 : 200); }
function refreshPadding() {
  PAD_DIRTY = false;
  if (PADM) { HAIR.remove(PADM); PADM.traverse(disposeOf); PADM = null; }
  if (CLIPM) { HAIR.remove(CLIPM); CLIPM.traverse(disposeOf); CLIPM = null; }
  if (!COL) return;
  const V = st.volume, base = baseLocks().filter(l => EVAL[l.id]), based = st.groups.some(g => g.base);
  PAD = !V.padding || !base.length ? null : based ? BASE : padOf(base.map(l => EVAL[l.id]), COL, { thickness: V.thickness, smooth: V.smooth });
  if (PAD && PAD.cards.length) { PADM = cardsMesh(PAD.cards); PADM.visible = base.some(isShown()); HAIR.add(PADM); }
  HAIRV++;
  CHECK = checkHair();
  if (V.clips && CHECK.clips.length) {
    const g = new THREE.BufferGeometry().setFromPoints(CHECK.clips.map(p => new THREE.Vector3(...p)));
    CLIPM = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xff3b30, size: 6, sizeAttenuation: false, depthTest: false })); CLIPM.renderOrder = 12; HAIR.add(CLIPM);
  }
  const out = $("#volcheck"); if (out) out.textContent = checkText();
}
// cards on the hair shader, from guides (the padding's)
function cardsMesh(guides) {
  const uv = [], tints = [], idx = [];
  guides.forEach((G, j) => { const n = G.pts.length, base = j * n * 2, u0 = (j * 0.37) % 1;
    for (let k = 0; k < n; k++) { const v = G.t ? G.t[k] : k / (n - 1); uv.push(u0, v, u0 + UV_SPAN, v); tints.push(0, 0, 0, 0, 0, 0, 0, 0); }
    for (let k = 0; k < n - 1; k++) { const a = base + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(cardPositions(guides), 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("aTangent", new THREE.Float32BufferAttribute(cardTangents(guides), 3)); g.setAttribute("aTint", new THREE.Float32BufferAttribute(tints, 4)); g.setIndex(idx); g.computeVertexNormals();
  g.setAttribute("aDepth", new THREE.Float32BufferAttribute(depthsOf(g.attributes.position.array), 1));
  const grp = new THREE.Group(), m = new THREE.Mesh(g, HAIR_MAT); m.userData.role = "cards"; grp.add(m); grp.userData.padding = true;
  return grp;
}
// the check: the scalp covered (the head's scalp vertices with hair over them), without and with the padding, and where
// cards of two locks cross within a millimetre of each other's height (they clip), one dot a 2.5-degree bin
function checkHair() {
  const shown = st.locks.filter(isShown()), env = new SL.Envelope(COL);
  for (const l of shown) if (EVAL[l.id]) env.add(EVAL[l.id]);
  const scalp = []; for (let i = 0; i < LOCAL_PTS.length; i += 3) { const q = [LOCAL_PTS[i], LOCAL_PTS[i + 1], LOCAL_PTS[i + 2]]; if (SL.onScalp(q, COL.C) && SL.len(SL.sub(q, COL.C)) < 0.17) scalp.push(q); }
  const cover = e => scalp.filter(q => e.under(q) > 0.001).length / Math.max(1, scalp.length);
  const before = cover(env); let after = before;
  if (PAD) { for (const G of PAD.cards) env.add([G]); after = cover(env); }
  const bins = new Map(), clips = [];
  for (const l of shown) for (const G of EVAL[l.id] || []) G.pts.forEach((p, k) => {
    if (!k || p[1] < COL.chin - 0.03) return; const d = SL.sub(p, COL.C), r = SL.len(d), e = Math.round(Math.asin(d[1] / r) * 72), a = Math.round(Math.atan2(d[0], d[2]) * 72 / Math.max(0.2, Math.cos(Math.asin(d[1] / r)))), key = e + "," + a;
    const L = bins.get(key) || []; if (!L.done && L.some(([id, rr]) => id !== l.id && Math.abs(rr - r) < 0.001)) { L.done = true; clips.push(p); } L.push([l.id, r]); bins.set(key, L);
  });
  return { before, after, clips, cards: PAD ? PAD.cards.length : 0 };
}
const checkText = () => CHECK ? `the scalp covered ${(CHECK.before * 100).toFixed(0)}%${PAD ? ` (with the padding's ${CHECK.cards} cards, ${(CHECK.after * 100).toFixed(0)}%)` : ""}; ${CHECK.clips.length} places where locks clip into each other` : "";
function volumePanel() {
  const box = $("#volbox"); if (!box) return; box.innerHTML = "";
  const V = st.volume, set = (k, v) => { V[k] = v; SL.setThicken(V.thicken); for (const l of st.locks) DIRTY.add(l.id); PAD_DIRTY = true; BASE_DIRTY = true; draw(); };
  slider(box, "Thicken", 0.5, 3, 0.05, V.thicken, v => set("thicken", v), "every strand's card this many times as wide (1: as made); the strands stay where they are");
  box.append(el("p", { className: "note", textContent: "Padding fills the base out into one smooth mass: its gaps closed, its outside smoothed, cards following the hair under the outer locks. The base: the groups ticked ▣ in Locks (none: all the hair shown); locks with physics are left out. It's baked with the still hair." }));
  const pt = el("div"); tick(pt, "Padding (preview)", !!V.padding, v => { V.padding = v; PAD_DIRTY = true; draw(); }, "show the padding; it's in the bake while this is ticked"); box.append(pt);
  const rebase = () => { BASE_DIRTY = true; PAD_DIRTY = true; if (st.groups.some(g => g.base)) for (const l of st.locks) DIRTY.add(l.id); draw(); };
  slider(box, "Thickness", 0, 1, 0.05, V.thickness, v => { V.thickness = v; rebase(); }, "how full: 0 just fills the gaps under the outer hair; 1 lifts the mass 1.2 cm and adds deeper layers");
  slider(box, "Smooth", 0, 1, 0.05, V.smooth, v => { V.smooth = v; rebase(); }, "how smooth the mass's outside curve is, and how wide a gap it closes");
  const ct = el("div"); tick(ct, "Show where it clips", !!V.clips, v => { V.clips = v; PAD_DIRTY = true; draw(); }, "red dots where two locks' cards cross at the same height"); box.append(ct);
  box.append(Object.assign(el("p", { className: "note", textContent: checkText() }), { id: "volcheck" }));
  const b = st.groups.filter(g => g.base);
  box.append(el("h4", { textContent: "The base" }), el("p", { className: "note", textContent: b.length ? `${b.map(g => g.name).join(", ")}: bake it, hide it, and add the flourishes; the rest sits on it by Clip blend.` : "Tick groups ▣ in Locks to make them the base: bake a good base shape first, then hide it and add the flourishes." }));
  slider(box, "Clip blend", 0, 1, 0.05, V.blend ?? 1, v => { V.blend = v; for (const l of st.locks) if (!inBase(l)) DIRTY.add(l.id); draw(); }, "how the hair outside the base meets it: 1 lies on it, 0 may sink into it, between partly");
  if (b.length) {
    const hidden = b.every(g => !g.visible);
    box.append(el("button", { textContent: "Bake the base", onclick: () => bakeBase().catch(e => status(e.message, "bad")) }), el("button", { textContent: hidden ? "Show the base" : "Hide the base", onclick: () => showBase(hidden) }));
  }
}
function rootsPanel() {
  const box = $("#rootbox"); if (!box) return; box.innerHTML = "";
  box.append(el("p", { className: "note", textContent: "How hair comes out of the head, every lock: it leaves the scalp at an angle the way it goes and bends over, whatever gravity does." }));
  const R = st.roots, set = (k, v) => { R[k] = v; SL.setRoots(R); for (const l of st.locks) DIRTY.add(l.id); draw(); };
  slider(box, "Lift", 0, 80, 1, R.lift, v => set("lift", v), "degrees off the scalp the hair leaves it (0: it lies flat from the root)");
  slider(box, "Bend", 0.5, 5, 0.1, +(R.length * 100).toFixed(1), v => set("length", v / 100), "cm from the root to where it has bent over into the lock");
  slider(box, "Natural", 0, 1, 0.05, R.vary, v => set("vary", v), "how much each guide's root differs from the next (its lift and its way)");
}
function pullPanel() {
  const box = $("#pullbox"); if (!box) return; box.innerHTML = "";
  const t = el("div"); tick(t, "Proportional (O)", PULL.on, v => { PULL.on = v; pullPanel(); drawHandles(); draw(); }, "a pulled handle takes the handles near it along, less the farther they are (Blender's proportional editing)"); box.append(t);
  const fs = el("select"); for (const [k, label] of [["smooth", "Smooth"], ["sphere", "Sphere"], ["root", "Root"], ["inverse_square", "Inverse square"], ["sharp", "Sharp"], ["linear", "Linear"], ["constant", "Constant"]]) fs.append(el("option", { value: k, textContent: label }));
  fs.value = PULL.falloff; fs.onchange = () => { PULL.falloff = fs.value; drawHandles(); draw(); };
  box.append(el("div", { className: "row" }, el("span", { textContent: "Falloff", title: "how the pull fades with distance" }), fs, el("span")));
  slider(box, "Reach", 0.2, 50, 0.1, +(PULL.size * 100).toFixed(1), v => { PULL.size = v / 100; drawHandles(); draw(); }, "cm: the ring's radius (the wheel while dragging: down grows it, up shrinks it; Shift finer; Page Up and Down)");
  const o = el("div"); tick(o, "This lock only", PULL.only, v => { PULL.only = v; drawHandles(); draw(); }, "only the handles of the lock you pull, not the hair round it"); box.append(o);
}
function locksPanel() {
  if (COVER.length == null) coverPanel();                             // the cover's Length follows the top hair until it's set
  const box = $("#locks"); box.innerHTML = "";
  for (const g of st.groups) {
    const eye = el("span", { className: "eye", textContent: g.visible ? "◉" : "○", title: "show or hide the group", onclick: () => { g.visible = !g.visible; locksPanel(); draw(); } });
    const base = el("span", { className: "eye", textContent: g.base ? "▣" : "□", title: "in the base (the mass the padding fills out, baked first)", onclick: () => { remember(); g.base = !g.base; PAD_DIRTY = true; BASE_DIRTY = true; for (const l of st.locks) DIRTY.add(l.id); locksPanel(); volumePanel(); draw(); } });
    const row = el("div", { className: "grp" + (g.id === ACTIVE_GROUP ? " active" : "") }, eye, base, el("b", { textContent: g.name, style: "cursor:pointer", title: "new locks go here", onclick: () => { ACTIVE_GROUP = g.id; locksPanel(); } }));
    box.append(row);
    st.locks.filter(l => l.group === g.id).forEach(l => {
      const e2 = el("span", { className: "eye", textContent: l.visible ? "◉" : "○", onclick: ev => { ev.stopPropagation(); l.visible = !l.visible; locksPanel(); draw(); } });
      box.append(el("div", { className: "lock" + (l.id === SELECTED ? " sel" : ""), onclick: () => select(l.id) }, e2,
        el("span", { className: l.mirror_of ? "twin" : "", textContent: `${l.name || l.type}` }), el("span", { className: "note", textContent: l.type + (l.render === "strands" ? " · strands" : "") + (l.physics && l.physics.on ? " · swings" : "") })));
    });
  }
  const lt = el("div"); tick(lt, "Layer by height", !!st.layering, v => { remember(); st.layering = v; for (const l of st.locks) DIRTY.add(l.id); draw(); }, "hair rooted higher always lies over hair rooted lower, like real hair"); box.append(lt);
  box.append(el("button", { textContent: "New group", onclick: () => { const id = "g" + (st.groups.length + 1) + Date.now().toString(36).slice(-3); st.groups.push({ id, name: `Group ${st.groups.length + 1}`, visible: true }); ACTIVE_GROUP = id; locksPanel(); } }));
}
function select(id) { SELECTED = id; for (const l of st.locks) DIRTY.add(l.id); locksPanel(); selPanel(); draw(); }
function selPanel() {
  const box = $("#selbox"); box.innerHTML = "";
  const l = lockById(SELECTED); stepHint("selected", l ? l.name || l.type : "the lock you picked");
  if (!l) { box.append(el("p", { className: "note", textContent: "Nothing selected." })); return; }
  const o = original(l), edit = fn => v => { remember(); fn(v); changed(o); draw(); };
  const name = el("input", { type: "text", value: l.name || "", onchange: () => { l.name = name.value; locksPanel(); } });
  box.append(el("div", { className: "row" }, el("span", { textContent: "Name" }), name, el("span")));
  if (l.mirror_of) box.append(el("p", { className: "note", textContent: "A mirror twin: it follows its original. Edits here change both." }));
  const rs = el("select"); for (const v of ["cards", "strands"]) rs.append(el("option", { value: v, textContent: v === "cards" ? "cards (stylised)" : "strands (realism)" }));
  rs.value = o.render; rs.onchange = () => edit(v => { o.render = v; })(rs.value);
  box.append(el("div", { className: "row" }, el("span", { textContent: "Drawn as" }), rs, el("span")));
  if (o.type === "strand") slider(box, "Width", 0.001, 0.03, 0.0005, o.width, edit(v => { o.width = v; }), "the card's width, m (a single hair is about 1 mm)");
  if (o.type !== "strand") slider(box, "Guides", 2, 16, 1, o.guides, edit(v => { o.guides = v; }));
  if (o.type === "bundle") { slider(box, "Root radius", 0.002, 0.06, 0.001, o.r0, edit(v => { o.r0 = v; })); slider(box, "Tip radius", 0, 0.06, 0.001, o.r1, edit(v => { o.r1 = v; }));
    slider(box, "Height", 0.1, 2, 0.05, o.height ?? 1, edit(v => { o.height = v; }), "its other axis, as a share of its width: 1 round, less a flatter oval, more a taller one"); }
  slider(box, "Taper", 0, 1, 0.05, o.taper, edit(v => { o.taper = v; }), "how much thinner the tip is");
  if (o.type !== "bundle") {                                          // a bundle's volume for strands and sheets
    slider(box, "Thickness", 0, 1, 0.05, o.thickness ?? 0, edit(v => { o.thickness = v; }), "flat (0) to round (1): a dome over the lock as high as half its width, like a bundle");
    slider(box, "Thickness taper", 0, 1, 0.05, o.thicknessTaper ?? 1, edit(v => { o.thicknessTaper = v; }), "how much the thickness thins towards the tip (1: to nothing)");
  }
  const ph = o.physics || (o.physics = Object.assign({}, SP.DEFAULTS));
  const pt = el("div"); tick(pt, "Physics (it swings)", !!ph.on, v => { remember(); ph.on = v; changed(o); SIM_DIRTY = true; selPanel(); locksPanel(); draw(); }, "the lock swings with the head and settles back to its style; baked as its own skinned mesh"); box.append(pt);
  if (ph.on) {
    slider(box, "Floppy-stiff", 0, 1, 0.05, ph.stiffness, v => { ph.stiffness = v; changed(o); SIM_DIRTY = true; }, "how hard it's held to its style");
    slider(box, "Gravity", 0, 2, 0.1, ph.gravity, v => { ph.gravity = v; changed(o); SIM_DIRTY = true; }, "how far it hangs down when the head tilts");
    slider(box, "Rustle", 0, 1, 0.05, ph.rustle, v => { ph.rustle = v; changed(o); SIM_DIRTY = true; if (v) setMotion(MOTION); }, "a wind with no direction: a little sway both ways");
  }
  if (o.render === "strands") slider(box, "Strands", 1, 400, 1, o.density, edit(v => { o.density = v; }));
  const c = el("input", { type: "color", value: o.color || look().tip, title: "this lock's own colour (instead of the hair's look)", onchange: () => edit(v => { o.color = v; })(c.value) });
  box.append(el("div", { className: "row" }, el("span", { textContent: "Own colour" }), c, o.color ? el("button", { textContent: "x", title: "back to the hair's look", onclick: () => { edit(() => { o.color = null; })(); selPanel(); } }) : el("span")));
  box.append(el("button", { textContent: "Onto the scalp", title: "its points near the head laid down on it (hair made before lies above the scalp)", onclick: () => { remember(); SL.hug(o, COL); changed(o); draw(); } }),
             el("button", { textContent: "All onto the scalp", title: "every lock's points near the head laid down on it", onclick: () => { remember(); for (const l of st.locks) if (!l.mirror_of) { SL.hug(l, COL); changed(l); } draw(); } }));
  box.append(el("button", { textContent: "Duplicate", onclick: () => { const d = structuredClone(o); d.id = SL.newId(); d.mirror_of = null; d.name = (o.name || o.type) + " copy"; SL.moveLock(d, [0.01, 0, 0]); addLock(d); } }),
             el("button", { textContent: "Mirror once", title: "a twin across the seam that doesn't follow", onclick: () => { const m = SL.mirrored(o, st.mirror.seam, COL); m.mirror_of = null; m.name = (o.name || o.type) + " mirrored"; remember(); m.group = o.group; st.locks.push(m); locksPanel(); draw(); } }),
             l.mirror_of ? el("button", { textContent: "Break the mirror", onclick: () => { remember(); l.mirror_of = null; l.name = l.name.replace(" (mirror)", ""); locksPanel(); selPanel(); } }) : "",
             el("button", { textContent: "Delete", onclick: () => deleteLock(o.id) }));
}
function restyle() { applyLook(HAIRU, look()); SCALP_DIRTY = true; HAIRV++; for (const l of st.locks) if (l.render === "strands") DIRTY.add(l.id); draw(); }
function characterPanel() {                                           // the body the hair is drawn on
  const box = $("#charbox"); if (!box) return; box.innerHTML = "";
  stepHint("character", st.head.person || "a base body"); stepHint("bake", st.head.person ? `onto ${st.head.person}` : "as a hairstyle");
  if (st.head.person) {
    box.append(el("p", { className: "note", textContent: PERSON?.face
      ? `${st.head.person}'s body and face, as the Character Studio saved them (${PERSON.height ?? "?"} m). Change them there, save, and open the character here again; then bake again.`
      : `${st.head.person}'s body from its weights, without its face: open it in the Character Studio and Save once, so the salon gets the face too.` }));
    box.append(el("a", { href: "index.html", target: "_blank", textContent: "Open the Character Studio" }));
    return;
  }
  box.append(el("p", { className: "note", textContent: "No character: a base body. Pick a character at the top to draw on its own body and face; the hair is kept on it." }));
  const ps = el("select"); for (const k of Object.keys(MHR?.presets || { feminine: 1 })) ps.append(el("option", { value: k, textContent: k }));
  ps.value = st.head.preset; ps.onchange = () => { st.head.preset = ps.value; buildHead(); };
  box.append(el("div", { className: "row" }, el("span", { textContent: "Body" }), ps, el("span")));
  slider(box, "Height", 1.4, 2.0, 0.01, st.head.height, v => { st.head.height = v; buildHead(); }, "m");
}
function lookPanel() {                                                  // the hair's look: a preset, then its colours and numbers by hand (kept in st.look.custom)
  const box = $("#lookbox"); if (!box) return; box.innerHTML = "";
  const ls = el("select"); for (const [k, v] of Object.entries(LOOKS)) ls.append(el("option", { value: k, textContent: v.label }));
  ls.value = st.look.hair; ls.onchange = () => { st.look.hair = ls.value; st.look.custom = {}; restyle(); lookPanel(); };
  box.append(el("div", { className: "row" }, el("span", { textContent: "Hair look" }), ls, el("span")));
  const k0 = look(), set = (key, v) => { st.look.custom[key] = v; restyle(); };
  for (const [key, label, title] of [["root", "Roots", "the colour at the roots and deep inside"], ["tip", "Lengths", "the colour along the lengths"], ["spec1", "Shine", "the sharp highlight's colour"], ["spec2", "Sheen", "the broad, tinted highlight"], ["inner", "Inner strands", "a hidden colour on a few strands"]]) {
    const c = el("input", { type: "color", value: k0[key], title, oninput: () => set(key, c.value) });
    box.append(el("div", { className: "row" }, el("span", { textContent: label, title }), c, el("span")));
  }
  slider(box, "Inner amount", 0, 0.4, 0.01, k0.innerAmount, v => set("innerAmount", v), "how many strands are the inner colour");
  slider(box, "Glossy", 0, 2, 0.05, k0.shine, v => set("shine", v), "how strong the highlights are");
  slider(box, "Highlight", -0.3, 0.3, 0.01, k0.shift1, v => { set("shift1", v); set("shift2", v + 0.19); }, "where the highlights sit along the strands (towards the roots or the tips)");
  slider(box, "Streaks", 0, 1, 0.05, k0.shiftNoise, v => set("shiftNoise", v), "how much each strand's highlight wanders: smooth band to broken streaks");
  const t = el("div");
  tick(t, "colour by lock", st.look.byLock, v => { st.look.byLock = v; for (const l of st.locks) DIRTY.add(l.id); draw(); }, "each lock its own colour, to see them apart");
  tick(t, "guides", st.look.guides, v => { st.look.guides = v; for (const l of st.locks) DIRTY.add(l.id); draw(); });
  tick(t, "show the scalp", st.look.scalp, v => { st.look.scalp = v; tintScalp(); draw(); }, "where roots go, tinted while a tool is armed");
  box.append(t);
}

// ---- the steps (the side panel) -------------------------------------------------------------------------------------------
// Dropdowns in the order the work goes, closed until opened; which are open is remembered in this browser. Each one's
// hint says what it's for, or what it's on now (the character, the lock picked).
const STEP_KEY = "salon:open";
try { const open = JSON.parse(localStorage.getItem(STEP_KEY) || "[]"); for (const d of document.querySelectorAll("details.step")) d.open = open.includes(d.dataset.step); } catch (e) { }
for (const d of document.querySelectorAll("details.step")) d.addEventListener("toggle", () => {
  try { localStorage.setItem(STEP_KEY, JSON.stringify([...document.querySelectorAll("details.step[open]")].map(x => x.dataset.step))); } catch (e) { }
});
function stepHint(step, text) { const h = document.querySelector(`details.step[data-step="${step}"] .hint`); if (h) h.textContent = text; }

// ---- save and load ----------------------------------------------------------------------------------------------------
// The hair is kept on the character it's drawn on (Save: People/<name>/salon/salon.json); a hairstyle (Start from) is
// hair kept to start other characters from (Content/Studio/Hair/<name>/), laid onto whatever head is shown.
async function listHair() { const s = $("#hairList"); s.innerHTML = ""; const r = await api("api/salon").catch(() => ({ hair: [] })); for (const n of r.hair) s.append(el("option", { value: n, textContent: n })); }
async function listPeople() {
  const r = await api("api/people").catch(() => ({ people: [] }));
  $("#person").replaceChildren(el("option", { value: "", textContent: "none: a base body" }), ...r.people.map(p => el("option", { value: p.name, textContent: p.name + (p.baked ? " (hair baked)" : p.hair ? " (hair)" : "") })));
  $("#person").value = st.head.person || "";
}
async function save() {
  const at = where();
  await api(at.url("salon.json"), JSON.stringify(st, null, 1));
  status(at.on ? `saved ${at.on}'s hair (${at.path("salon.json")}); Bake puts it on ${at.on}` : `saved the hairstyle ${at.path("salon.json")}`, "ok");
  if (at.on) listPeople(); else listHair();
}
async function saveStyle() {                                           // the hair as a hairstyle, whoever it's on
  const n = styleName(); if (!n) throw new Error("a hairstyle's name first");
  const o = JSON.parse(JSON.stringify(st)); o.head.person = null;
  await api(`api/hair/${n}/salon.json`, JSON.stringify(o, null, 1));
  status(`saved the hairstyle Content/Studio/Hair/${n}/salon.json`, "ok"); listHair();
}
async function applyHair(o, person) {                                 // a salon.json onto the page; the head: `person`'s body, or the saved base
  Object.assign(st.head, o.head || {}); st.head.person = person || null; Object.assign(st.mirror, o.mirror || {}); Object.assign(st.look, o.look || {});
  st.groups = o.groups?.length ? o.groups : st.groups; st.locks = o.locks || []; st.layering = !!o.layering; ACTIVE_GROUP = st.groups[0].id; SELECTED = null;
  Object.assign(st.reference, o.reference || {});
  st.scalp = Object.assign({ on: true, thickness: 0.7, soft: 0.012, colour: null }, o.scalp || {}); SCALP_DIRTY = true;   // (an old save's glow and fill are left behind)
  st.roots = Object.assign({ lift: 40, length: 0.02, vary: 0.4 }, o.roots || {}); SL.setRoots(st.roots);
  st.volume = Object.assign({ thicken: 1, padding: false, thickness: 0.4, smooth: 0.5, blend: 1 }, o.volume || {}); BASE_DIRTY = true; SL.setThicken(st.volume.thicken); PAD_DIRTY = true;
  UNDO.length = 0; REDO.length = 0;
  await buildHead(); if (st.reference.name) { st.reference.fitFor = st.reference.name; await loadReference(st.reference.name); }
  SIM_DIRTY = true; BAKED = null; delete st.look.showBake; if (BAKEVIEW) await previewBake(false); st.look.hair = st.look.hair || DEFAULT_LOOK; st.look.custom = st.look.custom || {}; applyLook(HAIRU, look());
  allPanels(); draw();
}
async function load(name) {                                           // a hairstyle, onto the head shown (a character keeps its body)
  const o = await api(`api/hair/${enc(name)}/salon.json`);
  await applyHair(o, st.head.person); $("#hairName").value = name;
  status(st.head.person ? `the hairstyle ${name} on ${st.head.person}: Save keeps it on ${st.head.person}` : `loaded the hairstyle ${name}`, "ok");
}
async function openPerson(name) {                                     // a character: its body, and its hair if it has some (else the hair shown stays, to put on it)
  if (!name) { st.head.person = null; PERSON = null; await buildHead(); characterPanel(); bakePanel(); $("#person").value = ""; status("a base body (Save keeps the hair as a hairstyle)", "ok"); return; }
  PERSON = await personBody(name);
  const r = await fetch(`api/people/${enc(name)}/salon/salon.json?v=${Date.now()}`);
  if (r.ok) await applyHair(await r.json(), name);
  else { st.head.person = name; await buildHead(); applyPreset("bald"); characterPanel(); bakePanel(); }   // no hair of its own yet: it starts bald
  $("#person").value = name;
  status(`${name}${PERSON.face ? "" : " (no face yet: save it in the Character Studio)"}: ${r.ok ? "its hair" : "no hair of its own yet: it starts bald (Start from: a preset or a hairstyle)"}`, PERSON.face ? "ok" : "bad");
}
function allPanels() { characterPanel(); refPanel(); presetPanel(); mirrorPanel(); pullPanel(); locksPanel(); selPanel(); rootsPanel(); coverPanel(); volumePanel(); scalpPanel(); movePanel(); lookPanel(); bakePanel(); }
$("#saveHair").onclick = () => save().catch(e => status(e.message, "bad"));
$("#saveStyle").onclick = () => saveStyle().catch(e => status(e.message, "bad"));
$("#loadHair").onclick = () => $("#hairList").value && load($("#hairList").value).catch(e => status(e.message, "bad"));
$("#person").onchange = () => openPerson($("#person").value).catch(e => status(e.message, "bad"));

// ---- start ------------------------------------------------------------------------------------------------------------
(async () => {
  try {
    await loadMHR(); await buildHead(); characterPanel(); lookPanel(); presetPanel(); mirrorPanel(); pullPanel(); locksPanel(); selPanel(); rootsPanel(); coverPanel(); volumePanel(); scalpPanel(); movePanel(); bakePanel(); setTool("select"); await listHair(); await listPeople();
    if (Q.get("person")) await openPerson(Q.get("person"));
    if (Q.get("hair")) await load(Q.get("hair"));
    else if (Q.get("ref")) await loadReference(Q.get("ref")); else await refPanel();
    resize(); status("ready", "ok");
    window.__salon.ready = true;
  } catch (e) { status(e.message, "bad"); console.error(e); }
})();

// for the tests and the renders
window.__salon = { st, SL, SR, orbit, get SNAP() { return SNAP; }, get CAMS() { return CAMS; }, get COL() { return COL; }, get HF() { return HF; }, get EVAL() { return EVAL; },
  get selected() { return SELECTED; }, ready: false, canvas: renderer.domElement, setTool, select, addLock, deleteLock, lookFrom, stepFrame, recam, draw, render, refPanel, locksPanel, selPanel, buildHead,
  screenOf, headAt, save, load, saveStyle, openPerson, get PERSON() { return PERSON; }, where, FFD, pullCube, scalpPanel, scalpInfo: () => SCALPM ? { vertices: SCALPM.geometry.attributes.position.count, alpha: SCALPM.userData.alpha, opacity: SCALPM.material.opacity, colour: Array.from(SCALPM.geometry.attributes.color.array.slice(0, 3)), visible: SCALPM.visible } : null,
  PULL, pullPanel, rootsPanel, volumePanel, volume: { refresh: refreshPadding, get pad() { return PAD; }, get check() { return CHECK; }, get base() { return BASE; }, baseLocks, bakeBase, showBase }, presets: { list: PRESETS, apply: applyPreset }, cover: { settings: COVER, make: makeCoverHair, preview: coverLocks, topLength }, coverPanel,
  setMotion, bake, previewBake, get BAKEVIEW() { return BAKEVIEW; }, get BAKEG() { return BAKEG; }, drop: { start: startDrop, keep: keepDrop, revert: revertDrop, pause: pauseDrop, run: runDrop, show: showDropFrame, get state() { return DROP && { frames: DROP.frames.length, frame: DROP.frame, running: DROP.running }; } }, look, restyle, HAIRU, ATLAS, LOOKS, get PLAYING() { return PLAYING; },
  bakeCheck: () => {                                                  // the loaded bake's first skinned mesh: its bind pose, then its root bone turned
    let mesh = null; BAKEG.traverse(o => { if (o.isSkinnedMesh && !mesh) mesh = o; }); if (!mesh) return null;
    BAKEG.updateMatrixWorld(true); mesh.skeleton.update();
    const P = mesh.geometry.attributes.position, v = new THREE.Vector3(), w = new THREE.Vector3(), rest = [];
    let bind = 0; for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); w.copy(v); mesh.applyBoneTransform(i, w); bind = Math.max(bind, w.distanceTo(v)); rest.push(w.clone()); }
    const root = mesh.skeleton.bones[0]; root.rotation.x += 0.3; BAKEG.updateMatrixWorld(true); mesh.skeleton.update();
    let moveTip = 0, moveRoot = 0; const n = P.count;
    for (let i = 0; i < n; i++) { w.fromBufferAttribute(P, i); mesh.applyBoneTransform(i, w); const d = w.distanceTo(rest[i]), k = Math.floor(i / 2) % 12; if (k === 11) moveTip = Math.max(moveTip, d); if (k === 0) moveRoot = Math.max(moveRoot, d); }
    root.rotation.x -= 0.3; BAKEG.updateMatrixWorld(true);
    return { name: mesh.name, bones: mesh.skeleton.bones.length, bind, moveTip, moveRoot };
  }, get SIM() { return SIM; }, get MOTION() { return MOTION; }, stepPhysics, MESHES,
  tipOffset: id => { const l = lockById(id); if (!SIM || !l) return 0; const Mi = HAIR.matrix.clone().invert(), v = new THREE.Vector3(); return SIM.tipOffset(l, p => v.set(...p).applyMatrix4(Mi).toArray()); },
  overlay: () => ({ visible: OVL_MESH.visible, flipped: !!OVL_MESH.userData.flipped, loaded: !!(OVL_MESH.material.map && OVL_MESH.material.map.userData.loaded), pos: Array.from(OVL_MESH.geometry.attributes.position.array) }), cameraPosition: () => [camera.matrixWorld.elements[12], camera.matrixWorld.elements[13], camera.matrixWorld.elements[14]], loadReference, changed, undo, redo, remember, place: PLACE,
  localPoints: () => LOCAL_PTS, dirtyAll: () => { for (const l of st.locks) DIRTY.add(l.id); SCALP_DIRTY = true; } };

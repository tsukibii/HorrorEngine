// The salon (docs/SALON_PLAN.md): hair made of locks laid on an MHR head, against a reference video whose frames lock to
// the view. salonlib.js has the locks and the collider, salonref.js the reference's cameras; this is the page.
import * as THREE from "three";
import * as SL from "./salonlib.js";
import * as SR from "./salonref.js";
import * as FFD from "./ffd.js";

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

// ---- the state (what salon.json holds) --------------------------------------------------------------------------------
const st = {
  version: 1,
  head: { preset: "feminine", height: 1.7 },
  reference: { name: null, on: true, opacity: 0.55, keyed: true, behind: false, lock: true, fit: structuredClone(SR.DEFAULT_FIT) },
  mirror: { on: false, seam: 0 },
  look: { color: "#2b1d16", byLock: false, guides: false, scalp: true },
  groups: [{ id: "g1", name: "Hair", visible: true }],
  locks: [],
};
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
const HANDLES = new THREE.Group(); HAIR.add(HANDLES);
let HEAD = null, HF = null, COL = null, LOCAL_PTS = null;
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

// the cube drawn and pulled (the Fit tool): its face lines, a handle on every surface point
const CUBE = new THREE.Group(); HAIR.add(CUBE);
function drawCube() {
  CUBE.clear();
  const cube = st.reference.fit && st.reference.fit.cube;
  if (!cube || !REF || !st.reference.on || TOOL !== "fit") return;
  const mat = new THREE.LineBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.75, depthTest: false });
  const stretched = p => { const m = FFD.centre(cube), sv = cube.stretch || [1, 1, 1]; return p.map((x, a) => m[a] + (x - m[a]) * sv[a]); };
  for (const L of FFD.lines(cube)) { const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(L.map(p => new THREE.Vector3(...stretched(p)))), mat); ln.renderOrder = 11; CUBE.add(ln); }
  const sizes = { corner: 0.006, edge: 0.0048, face: 0.0055 }, colours = { corner: 0xffffff, edge: 0xffc070, face: 0x6fd0ff };
  for (const h of FFD.handles(cube)) {
    const hot = HOVER_CUBE && HOVER_CUBE.join() === [h.i, h.j, h.k].join();
    const m = new THREE.Mesh(new THREE.SphereGeometry(sizes[h.kind], 10, 8), new THREE.MeshBasicMaterial({ color: hot ? 0xff5050 : colours[h.kind], depthTest: false }));
    m.position.set(...stretched(cube.pts[FFD.idx(cube, h.i, h.j, h.k)])); m.renderOrder = 12; CUBE.add(m);
  }
}
let HOVER_CUBE = null;
function cubeHandleAt(e) {
  const cube = st.reference.fit && st.reference.fit.cube; if (!cube || TOOL !== "fit") return null;
  const [mx, my] = rel(e); let best = null, bd = 12, m = FFD.centre(cube), sv = cube.stretch || [1, 1, 1];
  for (const h of FFD.handles(cube)) { const p = cube.pts[FFD.idx(cube, h.i, h.j, h.k)].map((x, a) => m[a] + (x - m[a]) * sv[a]); const [sx, sy] = screenOf(p), d = Math.hypot(sx - mx, sy - my); if (d < bd) { bd = d; best = [h.i, h.j, h.k]; } }
  return best;
}
// a cube point pulled to q (where it's drawn, i.e. stretched): stored unstretched; with "symmetric", its mirror too
function pullCube(ijk, q) {
  const cube = st.reference.fit.cube, m = FFD.centre(cube), sv = cube.stretch || [1, 1, 1];
  const un = q.map((x, a) => m[a] + (x - m[a]) / sv[a]);
  cube.pts[FFD.idx(cube, ...ijk)] = un;
  if (st.reference.cubeSym) {
    const [i2, j2, k2] = FFD.mirrorOf(cube, ...ijk);
    if (i2 !== ijk[0]) cube.pts[FFD.idx(cube, i2, j2, k2)] = [2 * m[0] - un[0], un[1], un[2]];
    else cube.pts[FFD.idx(cube, ...ijk)][0] = FFD.rest(cube, ...ijk)[0];   // on the middle plane: it stays there
  }
  FFD.settle(cube);
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
async function buildHead() {
  const m = await loadMHR();
  if (HEAD) { scene.remove(HEAD); HEAD.geometry.dispose(); }
  const w = m.presets[st.head.preset] || [], N = m.N, P = Float32Array.from(m.base);
  w.forEach((a, k) => { if (!a) return; const o = k * N * 3; for (let i = 0; i < N * 3; i++) P[i] += a * f16(m.h16[o + i]); });
  let lo = Infinity, hi = -Infinity; for (let i = 1; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); }
  const S = st.head.height / (hi - lo);
  for (let i = 0; i < P.length; i += 3) { P[i] *= S; P[i + 1] = (P[i + 1] - lo) * S; P[i + 2] *= S; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(P, 3)); g.setIndex(new THREE.BufferAttribute(m.tris, 1)); g.computeVertexNormals();
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(N * 3).fill(1), 3));
  HEAD = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x9a9690, roughness: 0.75, vertexColors: true })); scene.add(HEAD);
  HF = SR.headFrame(P, REF?.local?.anchors || SR.DEFAULT_ANCHORS);
  const B = HF.B, s = HF.S;
  HAIR.matrix.set(B[0][0] * s, B[0][1] * s, B[0][2] * s, HF.C[0], B[1][0] * s, B[1][1] * s, B[1][2] * s, HF.C[1], B[2][0] * s, B[2][1] * s, B[2][2] * s, HF.C[2], 0, 0, 0, 1);
  HAIR.matrixWorldNeedsUpdate = true;
  LOCAL_PTS = new Float32Array(P.length);
  for (let i = 0; i < N; i++) { const q = SR.toLocal(HF, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); LOCAL_PTS.set(q, i * 3); }
  const ci = (REF?.local?.anchors || SR.DEFAULT_ANCHORS).chin * 3, chin = SR.toLocal(HF, [P[ci], P[ci + 1], P[ci + 2]])[1];
  COL = new SL.Collider(LOCAL_PTS, { chin });
  tintScalp();
  for (const l of st.locks) DIRTY.add(l.id);
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
const strandTex = (() => {                                           // a card's alpha: streaks of strands, frayed at the tip
  const W = 64, H = 256, c = el("canvas", { width: W, height: H }), g = c.getContext("2d"), r = SL.rng(3);
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { const x = r() * W, w = 0.6 + r() * 1.6, end = H * (0.78 + 0.22 * r()), a = 0.55 + 0.45 * r();
    const gr = g.createLinearGradient(0, 0, 0, end); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.85, `rgba(255,255,255,${a})`); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(x, 0, w, end); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
})();
const PALETTE = ["#c8553d", "#4f86c6", "#6dae63", "#d9a441", "#a46cc8", "#4fb3b3", "#d97a9a", "#8f9d4a"];
function lockColour(l, i) { return st.look.byLock ? PALETTE[i % PALETTE.length] : (l.color || st.look.color); }
function buildLockMesh(l, i) {
  const guides = SL.evaluate(l, COL); EVAL[l.id] = guides;
  const grp = new THREE.Group(); grp.userData.lock = l.id;
  const col = new THREE.Color(lockColour(l, i));
  if (l.render === "strands") {
    const strands = SL.strandsOf(l, guides), pos = [], cols = [];
    for (const s of strands) for (let k = 1; k < s.length; k++) {
      pos.push(...s[k - 1], ...s[k]);
      const a = 0.55 + 0.45 * (k - 1) / (s.length - 1), b = 0.55 + 0.45 * k / (s.length - 1);
      cols.push(col.r * a, col.g * a, col.b * a, col.r * b, col.g * b, col.b * b);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    grp.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true })));
  } else {
    const pos = [], uv = [], cols = [], idx = [];
    guides.forEach((G, j) => {
      const base = pos.length / 3, n = G.pts.length, u0 = (j * 0.37) % 1;
      for (let k = 0; k < n; k++) {
        const h = SL.mul(G.across[k], G.width[k] / 2), a = SL.sub(G.pts[k], h), b = SL.add(G.pts[k], h), v = k / (n - 1);
        pos.push(...a, ...b); uv.push(u0, v, u0 + 0.5, v);
        const s = 0.5 + 0.5 * Math.min(1, v * 3); cols.push(s, s, s, s, s, s);
      }
      for (let k = 0; k < n - 1; k++) { const a = base + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(idx); g.computeVertexNormals();
    grp.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0, side: THREE.DoubleSide, alphaMap: strandTex, alphaTest: 0.4, vertexColors: true })));
  }
  if (st.look.guides || l.id === SELECTED) {
    for (const G of guides) { const g = new THREE.BufferGeometry().setFromPoints(G.pts.map(p => new THREE.Vector3(...p))); grp.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: l.id === SELECTED ? 0xffd27a : 0x6f7a8a, depthTest: l.id !== SELECTED }))); }
  }
  return grp;
}
function refreshLocks() {
  const ids = new Set(st.locks.map(l => l.id));
  for (const id of Object.keys(MESHES)) if (!ids.has(id) || DIRTY.has(id)) { HAIR.remove(MESHES[id]); MESHES[id].traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); delete MESHES[id]; delete EVAL[id]; }
  const vis = Object.fromEntries(st.groups.map(g => [g.id, g.visible]));
  st.locks.forEach((l, i) => {
    if (!MESHES[l.id]) { MESHES[l.id] = buildLockMesh(l, i); HAIR.add(MESHES[l.id]); }
    MESHES[l.id].visible = l.visible && vis[l.group] !== false;
  });
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
}

// the placing preview: a lock that isn't in the state yet
let PREVIEW = null;
function showPreview(l) {
  if (PREVIEW) { HAIR.remove(PREVIEW); PREVIEW.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); PREVIEW = null; }
  if (!l) return;
  PREVIEW = buildLockMesh(l, st.locks.length);
  PREVIEW.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = 0.75; } });
  HAIR.add(PREVIEW);
}
let ROOTLINE = null;
function showRootLine(pts) {
  if (ROOTLINE) { HAIR.remove(ROOTLINE); ROOTLINE.geometry.dispose(); ROOTLINE = null; }
  if (!pts || pts.length < 1) return;
  ROOTLINE = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color: 0x5aa65a, depthTest: false }));
  ROOTLINE.renderOrder = 10; HAIR.add(ROOTLINE);
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
  refreshLocks(); drawCube();
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
const snapshot = () => JSON.stringify({ locks: st.locks, groups: st.groups, fit: st.reference.fit });
function remember() { UNDO.push(snapshot()); if (UNDO.length > 200) UNDO.shift(); REDO.length = 0; }
function restore(s) { const o = JSON.parse(s); st.locks = o.locks; st.groups = o.groups; if (o.fit && REF) { st.reference.fit = o.fit; recam(); refPanel(); } for (const l of st.locks) DIRTY.add(l.id); if (!lockById(SELECTED)) SELECTED = null; locksPanel(); selPanel(); draw(); }
function undo() { if (!UNDO.length) return; REDO.push(snapshot()); restore(UNDO.pop()); }
function redo() { if (!REDO.length) return; UNDO.push(snapshot()); restore(REDO.pop()); }
$("#undo").onclick = undo; $("#redo").onclick = redo;

// ---- the locks --------------------------------------------------------------------------------------------------------
const lockById = id => st.locks.find(l => l.id === id) || null;
function changed(l) {                                                // a lock edited: its twins follow
  DIRTY.add(l.id);
  st.locks = SL.syncTwins(st.locks, st.mirror.seam, COL);
  for (const t of st.locks) if (t.mirror_of === l.id) DIRTY.add(t.id);
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
const TOOLS = [["select", "Select (V)", "v"], ["strand", "Strand (S)", "s"], ["sheet", "Sheet (L)", "l"], ["bundle", "Bundle (B)", "b"], ["fit", "Fit ref (F)", "f"]];
const HINTS = {
  select: "Click a lock to select it; drag a handle to shape it (Alt-drag: towards you or away). Drag the empty view to turn the head; the wheel zooms.",
  strand: "Click a root on the blue scalp, then click where the strand ends. The wheel bows it out (sag) while you place it.",
  sheet: "Drag a root line along the blue scalp, let go, then click where the sheet ends. The wheel spreads or gathers the end.",
  bundle: "Click a root on the blue scalp, then click the tip. The wheel sets the root's width while you place it.",
  fit: "Drag the picture to move it over the head (the wheel scales it), or pull the cube's points to bend it: corners white, edges orange, faces' middles blue (Alt: towards you).",
};
const PLACE = { stage: 0, root: null, line: [], sag: 0.2, spread: 0.05, r0: 0.015, last: null };
function setTool(t) {
  TOOL = t; resetPlace();
  for (const b of document.querySelectorAll("#tools button")) b.classList.toggle("on", b.dataset.t === t);
  $("#hint").textContent = HINTS[t] + (st.mirror.on && t !== "select" && t !== "fit" ? "  Mirror is on: the other side follows." : "");
  tintScalp(); draw();
}
function resetPlace() { PLACE.stage = 0; PLACE.root = null; PLACE.line = []; PLACE.last = null; showPreview(null); showRootLine(null); }
for (const [t, label] of TOOLS) { const b = el("button", { textContent: label, onclick: () => setTool(t) }); b.dataset.t = t; $("#tools").append(b); }

function previewFrom(e) {
  if (!PLACE.stage) return null;
  const anchor = TOOL === "sheet" ? SL.along(PLACE.line, 0.5) : PLACE.root;
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
  return null;
}
function scalpAt(e) { const p = headAt(e.clientX, e.clientY); return p && (e.shiftKey || SL.onScalp(p, COL.C)) ? COL.surface(p) : null; }

let DRAG = null;
const cv = renderer.domElement;
cv.addEventListener("contextmenu", e => e.preventDefault());
cv.addEventListener("pointerdown", e => {
  cv.setPointerCapture(e.pointerId);
  const orbitOnly = e.button !== 0;
  if (!orbitOnly && TOOL === "fit") {
    const h = cubeHandleAt(e);
    if (h) { remember(); DRAG = { kind: "cube", ijk: h, y: e.clientY }; return; }
    remember(); DRAG = { kind: "fit", x: e.clientX, y: e.clientY }; return;
  }
  if (!orbitOnly && TOOL === "select") {
    const h = handleAt(e);
    if (h) { remember(); DRAG = { kind: "handle", path: h.path, lock: SELECTED, x: e.clientX, y: e.clientY, alt: e.altKey }; return; }
    const l = lockAt(e);
    if (l) { select(l.id); return; }
  }
  if (!orbitOnly && (TOOL === "strand" || TOOL === "bundle")) {
    if (PLACE.stage === 0) { const p = scalpAt(e); if (p) { PLACE.root = p; PLACE.stage = 1; showPreview(previewFrom(e)); draw(); return; } }
    else { const l = previewFrom(e); if (l) { resetPlace(); addLock(l); } return; }
  }
  if (!orbitOnly && TOOL === "sheet") {
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
    const target = original(l), mirrored = target !== l;
    const h = SL.handles(l).find(x => x.path.join() === DRAG.path.join()); if (!h) return;
    let to;
    if (e.altKey) {                                                  // towards or away from the view
      const n = new THREE.Vector3(); camera.getWorldDirection(n); const nl = SL.norm(SR.MV(SR.T(HF.B), n.toArray()));
      to = SL.add(h.p, SL.mul(nl, (e.clientY - DRAG.y) * 0.0015)); DRAG.y = e.clientY;
    } else to = onPlane(e.clientX, e.clientY, h.p);
    if (!to) return;
    if (mirrored) { to = SL.reflectPoint(to, st.mirror.seam); }
    SL.dragHandle(target, DRAG.path, to, COL);
    changed(target); draw();
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
  if (DRAG && DRAG.kind === "handle") { const l = lockById(DRAG.lock); if (l) { selPanel(); } }
  if (DRAG && DRAG.kind === "fit") saveFitHint();
  DRAG = null;
});
cv.addEventListener("wheel", e => {
  e.preventDefault();
  const s = Math.sign(e.deltaY);
  if (PLACE.stage) {
    if (TOOL === "strand") PLACE.sag = Math.max(-0.6, Math.min(1.2, PLACE.sag - s * 0.05));
    if (TOOL === "sheet") PLACE.spread = Math.max(0.005, Math.min(0.3, PLACE.spread * (s < 0 ? 1.12 : 1 / 1.12)));
    if (TOOL === "bundle") PLACE.r0 = Math.max(0.003, Math.min(0.06, PLACE.r0 * (s < 0 ? 1.12 : 1 / 1.12)));
    $("#hint").textContent = TOOL === "strand" ? `sag ${PLACE.sag.toFixed(2)}` : TOOL === "sheet" ? `spread ${(PLACE.spread * 100).toFixed(1)} cm` : `root width ${(PLACE.r0 * 200).toFixed(1)} cm`;
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
function locksPanel() {
  const box = $("#locks"); box.innerHTML = "";
  for (const g of st.groups) {
    const eye = el("span", { className: "eye", textContent: g.visible ? "◉" : "○", title: "show or hide the group", onclick: () => { g.visible = !g.visible; locksPanel(); draw(); } });
    const row = el("div", { className: "grp" + (g.id === ACTIVE_GROUP ? " active" : "") }, eye, el("b", { textContent: g.name, style: "cursor:pointer", title: "new locks go here", onclick: () => { ACTIVE_GROUP = g.id; locksPanel(); } }));
    box.append(row);
    st.locks.filter(l => l.group === g.id).forEach(l => {
      const e2 = el("span", { className: "eye", textContent: l.visible ? "◉" : "○", onclick: ev => { ev.stopPropagation(); l.visible = !l.visible; locksPanel(); draw(); } });
      box.append(el("div", { className: "lock" + (l.id === SELECTED ? " sel" : ""), onclick: () => select(l.id) }, e2,
        el("span", { className: l.mirror_of ? "twin" : "", textContent: `${l.name || l.type}` }), el("span", { className: "note", textContent: l.type + (l.render === "strands" ? " · strands" : "") })));
    });
  }
  box.append(el("button", { textContent: "New group", onclick: () => { const id = "g" + (st.groups.length + 1) + Date.now().toString(36).slice(-3); st.groups.push({ id, name: `Group ${st.groups.length + 1}`, visible: true }); ACTIVE_GROUP = id; locksPanel(); } }));
}
function select(id) { SELECTED = id; for (const l of st.locks) DIRTY.add(l.id); locksPanel(); selPanel(); draw(); }
function selPanel() {
  const box = $("#selbox"); box.innerHTML = "";
  const l = lockById(SELECTED); if (!l) { box.append(el("p", { className: "note", textContent: "Nothing selected." })); return; }
  const o = original(l), edit = fn => v => { remember(); fn(v); changed(o); draw(); };
  const name = el("input", { type: "text", value: l.name || "", onchange: () => { l.name = name.value; locksPanel(); } });
  box.append(el("div", { className: "row" }, el("span", { textContent: "Name" }), name, el("span")));
  if (l.mirror_of) box.append(el("p", { className: "note", textContent: "A mirror twin: it follows its original. Edits here change both." }));
  const rs = el("select"); for (const v of ["cards", "strands"]) rs.append(el("option", { value: v, textContent: v === "cards" ? "cards (stylised)" : "strands (realism)" }));
  rs.value = o.render; rs.onchange = () => edit(v => { o.render = v; })(rs.value);
  box.append(el("div", { className: "row" }, el("span", { textContent: "Drawn as" }), rs, el("span")));
  if (o.type === "strand") slider(box, "Width", 0.001, 0.03, 0.0005, o.width, edit(v => { o.width = v; }), "the card's width, m (a single hair is about 1 mm)");
  if (o.type !== "strand") slider(box, "Guides", 2, 16, 1, o.guides, edit(v => { o.guides = v; }));
  if (o.type === "bundle") { slider(box, "Root radius", 0.002, 0.06, 0.001, o.r0, edit(v => { o.r0 = v; })); slider(box, "Tip radius", 0, 0.06, 0.001, o.r1, edit(v => { o.r1 = v; })); }
  slider(box, "Taper", 0, 1, 0.05, o.taper, edit(v => { o.taper = v; }), "how much thinner the tip is");
  if (o.render === "strands") slider(box, "Strands", 1, 400, 1, o.density, edit(v => { o.density = v; }));
  const c = el("input", { type: "color", value: o.color || st.look.color, onchange: () => edit(v => { o.color = v; })(c.value) });
  box.append(el("div", { className: "row" }, el("span", { textContent: "Colour" }), c, el("span")));
  box.append(el("button", { textContent: "Duplicate", onclick: () => { const d = structuredClone(o); d.id = SL.newId(); d.mirror_of = null; d.name = (o.name || o.type) + " copy"; SL.moveLock(d, [0.01, 0, 0]); addLock(d); } }),
             el("button", { textContent: "Mirror once", title: "a twin across the seam that doesn't follow", onclick: () => { const m = SL.mirrored(o, st.mirror.seam, COL); m.mirror_of = null; m.name = (o.name || o.type) + " mirrored"; remember(); m.group = o.group; st.locks.push(m); locksPanel(); draw(); } }),
             l.mirror_of ? el("button", { textContent: "Break the mirror", onclick: () => { remember(); l.mirror_of = null; l.name = l.name.replace(" (mirror)", ""); locksPanel(); selPanel(); } }) : "",
             el("button", { textContent: "Delete", onclick: () => deleteLock(o.id) }));
}
function headPanel() {
  const box = $("#headbox"); box.innerHTML = "";
  const ps = el("select"); for (const k of Object.keys(MHR?.presets || { feminine: 1 })) ps.append(el("option", { value: k, textContent: k }));
  ps.value = st.head.preset; ps.onchange = () => { st.head.preset = ps.value; buildHead(); };
  box.append(el("div", { className: "row" }, el("span", { textContent: "Body" }), ps, el("span")));
  slider(box, "Height", 1.4, 2.0, 0.01, st.head.height, v => { st.head.height = v; buildHead(); }, "m");
  const c = el("input", { type: "color", value: st.look.color, onchange: () => { st.look.color = c.value; for (const l of st.locks) DIRTY.add(l.id); draw(); } });
  box.append(el("div", { className: "row" }, el("span", { textContent: "Hair colour" }), c, el("span")));
  const t = el("div");
  tick(t, "colour by lock", st.look.byLock, v => { st.look.byLock = v; for (const l of st.locks) DIRTY.add(l.id); draw(); }, "each lock its own colour, to see them apart");
  tick(t, "guides", st.look.guides, v => { st.look.guides = v; for (const l of st.locks) DIRTY.add(l.id); draw(); });
  tick(t, "show the scalp", st.look.scalp, v => { st.look.scalp = v; tintScalp(); draw(); }, "where roots go, tinted while a tool is armed");
  box.append(t);
}

// ---- save and load ----------------------------------------------------------------------------------------------------
async function listHair() { const s = $("#hairList"); s.innerHTML = ""; const r = await api("api/salon").catch(() => ({ hair: [] })); for (const n of r.hair) s.append(el("option", { value: n, textContent: n })); }
async function save() {
  const name = $("#hairName").value.trim().replace(/[^A-Za-z0-9_-]/g, "_");
  if (!name) return status("a name first", "bad");
  const out = st;
  await api(`api/hair/${name}/salon.json`, JSON.stringify(out, null, 1));
  status(`saved Content/Studio/Hair/${name}/salon.json`, "ok"); listHair();
}
async function load(name) {
  const o = await api(`api/hair/${encodeURIComponent(name)}/salon.json`);
  Object.assign(st.head, o.head || {}); Object.assign(st.mirror, o.mirror || {}); Object.assign(st.look, o.look || {});
  st.groups = o.groups?.length ? o.groups : st.groups; st.locks = o.locks || []; ACTIVE_GROUP = st.groups[0].id; SELECTED = null;
  Object.assign(st.reference, o.reference || {});
  $("#hairName").value = name; UNDO.length = 0; REDO.length = 0;
  await buildHead(); if (st.reference.name) { st.reference.fitFor = st.reference.name; await loadReference(st.reference.name); }
  refPanel(); mirrorPanel(); locksPanel(); selPanel(); headPanel(); status(`loaded ${name}`, "ok"); draw();
}
$("#saveHair").onclick = () => save().catch(e => status(e.message, "bad"));
$("#loadHair").onclick = () => $("#hairList").value && load($("#hairList").value).catch(e => status(e.message, "bad"));

// ---- start ------------------------------------------------------------------------------------------------------------
(async () => {
  try {
    await loadMHR(); await buildHead(); headPanel(); mirrorPanel(); locksPanel(); selPanel(); setTool("select"); await listHair();
    if (Q.get("hair")) await load(Q.get("hair"));
    else if (Q.get("ref")) await loadReference(Q.get("ref")); else await refPanel();
    resize(); status("ready", "ok");
    window.__salon.ready = true;
  } catch (e) { status(e.message, "bad"); console.error(e); }
})();

// for the tests and the renders
window.__salon = { st, SL, SR, orbit, get SNAP() { return SNAP; }, get CAMS() { return CAMS; }, get COL() { return COL; }, get HF() { return HF; }, get EVAL() { return EVAL; },
  get selected() { return SELECTED; }, ready: false, canvas: renderer.domElement, setTool, select, addLock, deleteLock, lookFrom, stepFrame, recam, draw, render, refPanel, locksPanel, selPanel, buildHead,
  screenOf, headAt, save, load, FFD, pullCube, overlay: () => ({ visible: OVL_MESH.visible, flipped: !!OVL_MESH.userData.flipped, loaded: !!(OVL_MESH.material.map && OVL_MESH.material.map.userData.loaded), pos: Array.from(OVL_MESH.geometry.attributes.position.array) }), cameraPosition: () => [camera.matrixWorld.elements[12], camera.matrixWorld.elements[13], camera.matrixWorld.elements[14]], loadReference, changed, undo, redo, remember, place: PLACE,
  dirtyAll: () => { for (const l of st.locks) DIRTY.add(l.id); } };

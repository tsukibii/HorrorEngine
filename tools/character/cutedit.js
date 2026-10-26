// cutedit.js: the Clothes tab's edit mode (DECISIONS 2026-10-27). Editing a garment used to cut and hang the whole
// outfit again at every change, minutes a slider; here nothing is cut: each worn garment is drawn as a film on the body
// itself with its cut lines (tailor/guides.js: the cut's value at every point of the skin, which line is nearest, how
// far off the skin the cloth will sit), a skirt as its rings, and the Studio's handles are found on the body alone, so
// a slider or a drag moves a line at once; Bake cuts and hangs the cloth. The film rides the body as it's shown (the
// view's pose, a sculpt, an expression): its points are the shown body's own, lifted along its normals by the ease.
import * as THREE from "three";
import { frame } from "./tailor/frame.js";
import { normals } from "./tailor/mesh.js";
import { guide, KINDS } from "./tailor/guides.js";
import * as WEIGHTS from "./tailor/weights.js";
import * as PO from "./pose.js";

/** the films' colours by what the garment is, and the lines' by which line they are (the Studio's handles' hues) */
export const SLOT_HUE = { under: 0xff7a8a, top: 0x7ee08a, bottom: 0xffd166, full: 0x7ee0d0, legs: 0xc58bff, feet: 0xff9f5e, jacket: 0x5ec8ff };
export const LINE_HUE = { "": 0xffffff, neck: 0x7ee08a, open: 0x7ee08a, sleeve: 0x5ec8ff, hem: 0xffd166, waist: 0xffd166, legs: 0x5ec8ff, shoe: 0xff9f5e, under: 0xff7a8a };

const VS = `
attribute float aV; attribute float aK; attribute float aLift;
varying float vV; varying float vK;
void main() { vV = aV; vK = aK; vec3 p = position + normal * aLift; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const FS = `
precision highp float;
uniform vec3 uColor; uniform float uAlpha; uniform vec3 uLines[9];
varying float vV; varying float vK;
void main() {
  if (vV < 0.0) discard;                                            // off the cloth
  float w = fwidth(vV) * 1.4;                                        // the cut line: a couple of pixels along the edge, whatever the zoom
  float line = 1.0 - smoothstep(w, w * 2.2, vV);
  int k = int(vK + 0.5); vec3 lc = uLines[k < 0 ? 0 : (k > 8 ? 8 : k)];
  gl_FragColor = vec4(mix(uColor, lc, line), mix(uAlpha, 1.0, line));
}`;

export class CutEditor {
  /** ctx: {rig (the body's group), position (the shown body's BufferAttribute: the films share it), T (its triangles),
      RIG (the rig's BI, BW: skin weights for the rings and handles)} */
  constructor(ctx) {
    this.c = ctx; this.group = new THREE.Group(); this.group.name = "cut guides"; this.group.visible = false; ctx.rig.add(this.group);
    this.index = new THREE.BufferAttribute(ctx.T, 1);
    this.normal = new THREE.BufferAttribute(new Float32Array(ctx.position.array.length), 3);
    this.garments = []; this.made = new Map(); this.frameKey = null; this.F = null; this.N = null; this.skin = null; this.P = null;
    this.lines = Array.from({ length: 9 }, (_, i) => new THREE.Color(LINE_HUE[KINDS[i]] ?? 0xffffff));
  }
  /** the frame (the heights, the arms) of the body as it is, measured once per body */
  measure(P, key) {
    if (key === this.frameKey && this.F) return;
    this.frameKey = key; this.P = P; this.F = frame(P, this.c.T); this.N = normals(P, this.c.T);
    this.skin = this.c.RIG ? WEIGHTS.skinOf(P, this.c.RIG.BI, this.c.RIG.BW) : null;
    this.made.clear();                                             // every guide was on the old body
  }
  /** the worn garments' guides: list = [{design, slot, D (the design with the garment's own edits laid on)}], P the body
      they're cut from (neutral: MHR's own pose, no expression), key its key. Only what changed is made again */
  set(list, P, key) {
    this.measure(P, key);
    const keep = new Set(), unders = [];
    let underKey = "";
    for (const g of list) {
      const k = `${g.design}|${JSON.stringify(g.D.piece)}|${JSON.stringify(g.D.details || [])}|${underKey}`;
      underKey += k.length + ":" + hash(k) + ";";
      let m = this.made.get(k);
      if (!m) { m = this.build(g, guide(this.F, this.P, this.N, this.c.T, g.D, unders.map(u => u.G))); this.made.set(k, m); }
      keep.add(k); unders.push(m); m.key = k; m.design = g.design;
    }
    for (const [k, m] of this.made) if (!keep.has(k)) { this.drop(m); this.made.delete(k); }
    this.garments = list.map((g, i) => ({ design: g.design, handles: unders[i].G.handles, kind: unders[i].G.kind }));
    for (const m of this.made.values()) m.obj.visible = keep.has(m.key);
    this.posedFor = null;                                           // the rings posed afresh
  }
  build(g, G) {
    const m = { G, obj: new THREE.Group(), rings: null };
    m.obj.name = "guide " + g.design; this.group.add(m.obj);
    const hue = new THREE.Color(SLOT_HUE[g.slot] ?? 0xdddddd);
    if (G.kind === "film") {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", this.c.position); geo.setAttribute("normal", this.normal); geo.setIndex(this.index);
      geo.setAttribute("aV", new THREE.BufferAttribute(G.V, 1)); geo.setAttribute("aK", new THREE.BufferAttribute(Float32Array.from(G.K), 1)); geo.setAttribute("aLift", new THREE.BufferAttribute(G.lift, 1));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.6);   // never culled (its points are the body's)
      const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
                                            uniforms: { uColor: { value: hue }, uAlpha: { value: 0.42 }, uLines: { value: this.lines } } });
      const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 8; mesh.frustumCulled = false; m.obj.add(mesh); m.film = mesh;
    } else {                                                        // a skirt: its rings, and four lines down them
      const { pts, rows, NA } = G.rings, idx = [];
      for (let r = 0; r < rows; r++) for (let k = 0; k < NA; k++) { idx.push(r * NA + k, r * NA + (k + 1) % NA); if (r + 1 < rows && k % (NA / 4) === 0) idx.push(r * NA + k, (r + 1) * NA + k); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(Float32Array.from(pts), 3)); geo.setIndex(idx);
      const col = new Float32Array(pts.length), top = new THREE.Color(LINE_HUE.waist), low = new THREE.Color(LINE_HUE.hem);
      for (let r = 0; r < rows; r++) { const c = r === 0 ? top : r === rows - 1 ? low : hue; for (let k = 0; k < NA; k++) col.set([c.r, c.g, c.b], (r * NA + k) * 3); }
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthTest: false }));
      lines.renderOrder = 9; lines.frustumCulled = false; m.obj.add(lines); m.rings = { lines, rest: Float32Array.from(pts), skin: null };
    }
    return m;
  }
  drop(m) { this.group.remove(m.obj); m.obj.traverse(o => { if (o.geometry && o !== m.film) o.geometry.dispose(); o.material?.dispose?.(); }); if (m.film) m.film.geometry.dispose(); }
  /** the films' normals from the body as it's shown (NP: its normals now), the rings in the body's pose (X: pose.js's
      turns, or null in MHR's own) */
  pose(X, NP) {
    if (!this.group.visible) return;
    this.normal.array.set(NP); this.normal.needsUpdate = true;
    const key = X ? Array.from(X.J2, v => v.toFixed(5)).join() : "rest";
    if (key === this.posedFor) return;
    this.posedFor = key;
    for (const m of this.made.values()) {
      if (!m.rings || !m.obj.visible) continue;
      const a = m.rings.lines.geometry.attributes.position;
      if (!X || !this.skin) { a.array.set(m.rings.rest); a.needsUpdate = true; continue; }
      const k = m.rings.skin || (m.rings.skin = WEIGHTS.transfer(this.skin, m.rings.rest));
      PO.skinWith(X, k.index, k.weight, m.rings.rest, a.array); a.needsUpdate = true;
    }
  }
  show(on) { this.group.visible = on; if (on) this.posedFor = null; }
  clear() { for (const m of this.made.values()) this.drop(m); this.made.clear(); this.garments = []; }
}
function hash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0; return h.toString(36); }

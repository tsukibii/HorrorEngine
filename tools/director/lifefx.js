// The little things' effects on the desk's stage (docs/IMMERSION.md §4): steam and smoke, an ember burning a cigarette
// back, LEDs and digits, a hob's rings glowing, flames, a cup filling while its kettle pours, a drip and a running tap,
// a clock's hands and pendulum, a rattling lid, a screen's static or programme, a phone buzzing. Each is a function of
// the run's time and the thing's states (life.js: `at` for now, `history` for what was going on when a puff was
// born), so a scrubbed scene shows the right frame and steam lingers after the kettle clicks off. Nothing here adds a
// light (a candle lights the story's own `light`), so no shader is rebuilt mid-scene.
//   const fx = new LifeFX(stage, lives); fx.attach();   after the stage builds a world
//   fx.update(T, id => ({st: States.at(id, T), hist: States.history(id)}))   every frame, after the stage's apply
import * as THREE from "three";
import { stateDef } from "./life.js";
import { LifeSound } from "./lifesound.js";

const t3 = a => new THREE.Vector3(a[0], a[2], -a[1]);           // item space (x, y, z up) -> the kit group's (three's)
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const sm = x => x * x * (3 - 2 * x), clamp01 = x => Math.max(0, Math.min(1, x));
function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i; return (hash(i, seed) * (1 - sm(f)) + hash(i + 1, seed) * sm(f)) * 2 - 1; }   // smooth, -1..1
export const FX = ["steam", "smoke", "ember", "burn", "led", "digits", "glow", "flame", "fill", "pour", "drip", "stream", "hands", "pendulum", "rattle", "screen", "buzz", "light"];

// an fx's value at an age in its state: a number, or [from, to] over the state's secs (or its own `secs`), eased
export function valueAt(v, age, secs, ease = 1) {
  if (!Array.isArray(v)) return +v;
  const k = secs ? Math.pow(clamp01(age / secs), ease) : 0;
  return v[0] + (v[1] - v[0]) * k;
}

// ---- shared pictures: a soft round glow, a candle's flame ------------------------------------------------------
let GLOW = null, FLAME = null, GAS = null;
function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function glowTex() {
  if (GLOW) return GLOW;
  const c = canvas(64, 64), g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.2, "rgba(255,255,255,0.55)"); r.addColorStop(0.55, "rgba(255,255,255,0.12)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return (GLOW = new THREE.CanvasTexture(c));
}
function flameTex() {                                       // a teardrop: a white-yellow core, an orange skirt, a blue foot
  if (FLAME) return FLAME;
  const c = canvas(64, 128), g = c.getContext("2d");
  const drop = (w, h, cy, fill) => { g.beginPath(); g.moveTo(32, cy - h * 0.62); g.bezierCurveTo(32 + w * 0.55, cy - h * 0.2, 32 + w * 0.5, cy + h * 0.36, 32, cy + h * 0.38); g.bezierCurveTo(32 - w * 0.5, cy + h * 0.36, 32 - w * 0.55, cy - h * 0.2, 32, cy - h * 0.62); g.fillStyle = fill; g.fill(); };
  g.filter = "blur(4px)"; drop(52, 120, 70, "rgba(255,120,30,0.55)");
  g.filter = "blur(3px)"; drop(34, 92, 76, "rgba(255,190,80,0.9)");
  g.filter = "blur(2px)"; drop(18, 50, 90, "rgba(255,250,225,1)");
  g.filter = "blur(3px)"; g.fillStyle = "rgba(80,120,255,0.6)"; g.beginPath(); g.ellipse(32, 112, 10, 6, 0, 0, Math.PI * 2); g.fill();
  return (FLAME = new THREE.CanvasTexture(c));
}

function gasTex() {                                         // a gas flame: a blue cone, a paler inner one
  if (GAS) return GAS;
  const c = canvas(32, 64), g = c.getContext("2d"), cone = (w, h, fill) => { g.beginPath(); g.moveTo(16 - w, 62); g.quadraticCurveTo(16 - w * 0.9, 62 - h * 0.6, 16, 62 - h); g.quadraticCurveTo(16 + w * 0.9, 62 - h * 0.6, 16 + w, 62); g.closePath(); g.fillStyle = fill; g.fill(); };
  g.filter = "blur(2px)"; cone(13, 58, "rgba(40,90,255,0.75)"); g.filter = "blur(1px)"; cone(7, 30, "rgba(150,210,255,0.95)");
  return (GAS = new THREE.CanvasTexture(c));
}
// ---- puffs: soft round points born on a schedule from a socket (steam, the broken top of smoke) -----------------
const PUFF_VS = `attribute float size; attribute float alpha; uniform float scale; varying float vA;
void main() { vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.0, size * scale / -mv.z); gl_Position = projectionMatrix * mv; }`;
const PUFF_FS = `uniform vec3 color; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c) * 2.0; if (d > 1.0) discard; gl_FragColor = vec4(color, exp(-d * d * 4.0) * vA); }`;
class Puffs {
  // o: {color, rate (births a second at full), life (s), size [from, to] (m), rise (m/s), speed (m/s out of the socket),
  //     spread (m/s sideways), curl (m), alpha, add}
  constructor(parent, o) {
    this.o = o; this.N = Math.ceil(o.rate * o.life * 1.3) + 2;
    const g = new THREE.BufferGeometry();
    for (const [k, n] of [["position", 3], ["size", 1], ["alpha", 1]]) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(this.N * n), n));
    this.mat = new THREE.ShaderMaterial({ uniforms: { color: { value: new THREE.Color(o.color) }, scale: { value: 500 } }, vertexShader: PUFF_VS, fragmentShader: PUFF_FS,
      transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 5; parent.add(this.pts);
  }
  // T: now; origin and dir in world space; rateAt(tb) 0..1: how much was coming out when a puff was born
  update(T, origin, dir, rateAt, seed, scale, area = null) {
    const o = this.o, N = this.N, R = o.rate, g = this.pts.geometry, P = g.attributes.position.array, S = g.attributes.size.array, A = g.attributes.alpha.array;
    for (let k = 0; k < N; k++) {
      let n = Math.floor((T * R - k) / N), tb = (n * N + k) / R;
      if (tb > T) { n--; tb = (n * N + k) / R; }
      const a = T - tb, h = hash(seed * 131 + k, n), life = o.life * (0.7 + 0.6 * hash(seed * 131 + k, n + 7)), r = rateAt(tb);
      if (a < 0 || a > life || h >= r) { A[k] = 0; continue; }
      const u = a / life, tau = 0.25, out = (o.speed || 0.1) * tau * (1 - Math.exp(-a / tau));
      const ph = hash(seed * 131 + k, n + 3) * 6.283, curl = (o.curl || 0.02) * Math.pow(a, 1.4), sx = (hash(seed * 131 + k, n + 5) - 0.5) * (o.spread || 0.04), sz = (hash(seed * 131 + k, n + 9) - 0.5) * (o.spread || 0.04);
      let ox = 0, oz = 0;
      if (area) { const phi = hash(seed * 131 + k, n + 13) * 6.283, rho = area.ring ? area.ring : Math.sqrt(hash(seed * 131 + k, n + 15)) * area.disc; ox = Math.cos(phi) * rho; oz = Math.sin(phi) * rho; }
      P[k * 3] = origin.x + ox + dir.x * out + Math.sin(a * 2.3 + ph) * curl + sx * a;
      P[k * 3 + 1] = origin.y + dir.y * out + (o.rise || 0.2) * a * (0.8 + 0.4 * hash(seed * 131 + k, n + 11));
      P[k * 3 + 2] = origin.z + oz + dir.z * out + Math.cos(a * 1.9 + ph) * curl + sz * a;
      S[k] = o.size[0] + (o.size[1] - o.size[0]) * Math.pow(u, 0.6);
      A[k] = o.alpha * Math.min(1, a / 0.12) * (1 - u) * (1 - u * 0.4);
    }
    g.attributes.position.needsUpdate = g.attributes.size.needsUpdate = g.attributes.alpha.needsUpdate = true;
    this.mat.uniforms.scale.value = scale;
  }
  dispose() { this.pts.geometry.dispose(); this.mat.dispose(); this.pts.removeFromParent(); }
}
// a thread of smoke: a cigarette's or an incense stick's, a thin blue line from the tip that sways and breaks into
// curls as it rises (the line through puffs born one after another, so it's smooth); its top as soft puffs
class Thread {
  constructor(parent, o) {
    this.o = o; this.M = Math.ceil(o.rate * o.life);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.M * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.M * 4), 4));
    this.line = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    this.line.frustumCulled = false; this.line.renderOrder = 5; parent.add(this.line);
    this.top = new Puffs(parent, { color: o.color, rate: 6, life: 2.6, size: [0.01, 0.07], rise: 0.12, speed: 0.02, spread: 0.03, curl: 0.03, alpha: 0.12 * (o.alpha || 1) });
    this.col = new THREE.Color(o.color);
  }
  update(T, origin, rateAt, seed, scale) {
    const o = this.o, M = this.M, R = o.rate, g = this.line.geometry, P = g.attributes.position.array, C = g.attributes.color.array, b0 = Math.floor(T * R);
    for (let j = 0; j < M; j++) {
      const tb = (b0 - j) / R, a = Math.max(0, T - tb), r = rateAt(tb);
      const sway = 0.012 * Math.pow(a, 1.5) * (1 + noise1(tb * 0.4, seed)), th = 6.283 * noise1(tb * 0.25, seed + 3) + a * 2.2;
      P[j * 3] = origin.x + Math.cos(th) * sway; P[j * 3 + 1] = origin.y + (o.rise || 0.16) * a; P[j * 3 + 2] = origin.z + Math.sin(th) * sway;
      C[j * 4] = this.col.r; C[j * 4 + 1] = this.col.g; C[j * 4 + 2] = this.col.b;
      C[j * 4 + 3] = (o.alpha || 0.5) * clamp01(r) * Math.min(1, a / 0.05) * Math.pow(1 - a / o.life, 1.6);
    }
    g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = true;
    this.top.update(T, new THREE.Vector3(origin.x, origin.y + (o.rise || 0.16) * o.life * 0.6, origin.z), new THREE.Vector3(0, 1, 0), tb => rateAt(tb - o.life * 0.6), seed + 17, scale);
  }
  dispose() { this.line.geometry.dispose(); this.line.material.dispose(); this.line.removeFromParent(); this.top.dispose(); }
}

// ---- a little thing on the stage: its block, its kit (sockets, slot meshes) and the effects its life can show -------
class Item {
  constructor(fx, id, th, block, kit) {
    Object.assign(this, { fx, id, th, block, kit, d: ((block.userData.piece || {}).d) || {} });
    this.life = th.life; this.def = (fx.lives.lives || {})[th.life] || { states: [] };
    this.S = (kit && kit.userData.built && kit.userData.built.sockets) || {};
    this.slots = {}; if (kit) for (const m of kit.children) if (m.userData.slot) this.slots[m.userData.slot] = m;
    this.seed = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 9973;
    this.parts = {}; this.home = { p: block.position.clone(), q: block.quaternion.clone() };
  }
  sock(name) { return this.S[name] || null; }
  // a socket in world space: its point, and the way it points
  world(q) {
    const k = this.kit || this.block, p = k.localToWorld(t3(q.at));
    const n = q.n ? t3(q.n).transformDirection(k.matrixWorld) : new THREE.Vector3(0, 1, 0);
    return { p, n };
  }
  // the sockets an fx's `at` names: "ring" and "digit" are the hob's rings that are on (its `rings`, else the ones a
  // thing stands on, else the first)
  socks(at) {
    if (at === "ring" || at === "digit") return this.rings().map(i => this.S[`${at}_${i}`]).filter(Boolean);
    const q = this.S[at]; return q ? [q] : [];
  }
  rings() {
    if (Array.isArray(this.d.rings)) return this.d.rings;
    if (this.onMe && this.onMe.length) return this.onMe;
    return this.S.ring_1 ? [1] : [];
  }
  // the fx of a kind at a socket in a state (or null)
  fxIn(state, kind, at) { const sd = stateDef(this.fx.lives, this.life, state); return ((sd && sd.fx) || []).find(f => f.fx === kind && (at === undefined || f.at === at)) || null; }
  // how much of a kind at a socket was going on at time t (0..1 or its value), from the history
  rateAt(hist, kind, at, key = "rate") {
    return tb => {
      let i = hist.length - 1; while (i > 0 && hist[i].t > tb) i--;   // before its first, it was as it started
      if (i < 0) return 0;
      const h = hist[i], f = this.fxIn(h.state, kind, at); if (!f) return 0;
      const secs = f.secs ?? (stateDef(this.fx.lives, this.life, h.state) || {}).secs;
      return clamp01(valueAt(f[key] ?? 1, tb - h.t, secs, f.ease || 1));
    };
  }
  // the materials of its slot meshes, its own (cloned once) so lighting or clipping one thing leaves the rest
  own(slot) { const m = this.slots[slot]; if (!m) return null; if (!m.userData.ownMat) { m.material = m.material.clone(); m.userData.ownMat = true; } return m; }
  part(key, make) { return this.parts[key] || (this.parts[key] = make()); }
  dispose() {
    for (const p of Object.values(this.parts)) { if (p.dispose) p.dispose(); else { p.removeFromParent && p.removeFromParent(); p.traverse && p.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } }
    this.parts = {};
  }
}

export class LifeFX {
  constructor(stage, lives) { this.stage = stage; this.lives = lives || { lives: {} }; this.items = []; }
  attach() {
    if (this.sound) this.sound.stop();                  // a new world: the old one's sounds end
    for (const it of this.items) it.dispose();
    this.items = [];
    this.stage.renderer.localClippingEnabled = true;      // a cigarette burns back by clipping its paper
    const things = (this.stage.plan && this.stage.plan.things) || {};
    for (const o of this.stage.world.children) {
      const id = o.userData && o.userData.id, th = id && things[id];
      if (!th || !th.life || !(this.lives.lives || {})[th.life]) continue;
      const kit = o.children.find(c => c.userData && c.userData.built) || null;
      this.items.push(new Item(this, id, th, o, kit));
    }
    const by = Object.fromEntries(this.items.map(i => [i.id, i]));
    for (const it of this.items) {                      // what stands on a hob: the ring nearest it is the one that's on
      const hob = by[it.d.on]; if (!hob || !hob.S.ring_1) continue;
      const p = it.block.getWorldPosition(new THREE.Vector3()); let best = null;
      for (let i = 1; hob.S[`ring_${i}`]; i++) { const d = hob.world(hob.S[`ring_${i}`]).p.distanceTo(p); if (!best || d < best[1]) best = [i, d]; }
      if (best) (hob.onMe = hob.onMe || []).push(best[0]);
    }
    this.by = by;
  }
  // live(id) -> {st: the state now (life.js at), hist: [{t, state}]} or null
  update(T, live) {
    if (!this.items.length) return;
    const cam = this.stage.camera, h = this.stage.renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    const scale = h / (2 * Math.tan(cam.fov * Math.PI / 360));
    const now = this.items.map(it => [it, live(it.id)]).filter(([, L]) => L && L.st);
    for (const [it, L] of now) if ((it.def.states || []).some(s => (s.fx || []).some(f => f.fx === "pour"))) this.pour(it, L.st, T);   // what's lifted, first
    for (const [it, L] of now) {
      try { this.item(it, L.st, L.hist || [], T, scale); } catch (e) { console.warn("lifefx " + it.id + ": " + e.message); }
    }
    // their sounds (lifesound.js), while the stage wants them (the Watch, Play, the scene editor playing)
    if (this.stage.soundOn) (this.sound = this.sound || new LifeSound()).update(T, now.map(([it, L]) => ({ id: it.id, pos: it.block.getWorldPosition(new THREE.Vector3()), st: L.st, hist: L.hist || [], def: it.def })), cam);
    else if (this.sound) this.sound.stop();
  }
  item(it, st, hist, T, scale) {
    const fxNow = (st.def && st.def.fx) || [], has = (kind, at) => fxNow.find(f => f.fx === kind && (at === undefined || f.at === at)) || null;
    const world = this.stage.world;
    // the kinds this life can show at all (in any state), each drawn by its own rule below
    const all = new Map(); for (const s of it.def.states || []) for (const f of s.fx || []) all.set(f.fx + "@" + (f.at || ""), f);
    for (const [key, f] of all) {
      const kind = f.fx;
      if (kind === "steam" || kind === "smoke") {
        const qs = it.socks(f.at); if (!qs.length) continue;
        const rate = it.rateAt(hist, kind, f.at);
        qs.forEach((q, i) => {
          const w = it.world(q), dir = kind === "steam" ? w.n : new THREE.Vector3(0, 1, 0);
          if (kind === "steam") {
            const fine = !!f.fine, P = it.part(key + i, () => new Puffs(world, fine ? { color: 0xeef2f6, rate: 14, life: 2.0, size: [0.008, 0.05], rise: 0.08, speed: 0.03, spread: 0.015, curl: 0.02, alpha: 0.14 }
              : { color: 0xf2f4f7, rate: 48, life: 1.8, size: [0.016, 0.13], rise: 0.22, speed: 0.4, spread: 0.05, curl: 0.04, alpha: 0.13 }));
            const k = this.scaleOf(it), area = f.at === "steam" || f.at === "lid" ? { ring: (q.r || 0.05) * 0.92 * k } : f.at === "rim" ? { disc: (q.r || 0.03) * 0.85 * k } : null;
            P.update(T, w.p, dir, rate, it.seed + i, scale, area);
          } else {
            const P = it.part(key + i, () => new Thread(world, { color: 0xaab4c2, rate: 30, life: 2.2, rise: 0.15, alpha: 0.55 }));
            const p = kind === "smoke" && q === it.S.tip ? this.tipNow(it, st).p : w.p;
            P.update(T, p, rate, it.seed + i, scale);
          }
        });
      } else if (kind === "led" || kind === "ember") {
        const q = it.sock(f.at); if (!q) continue;
        const on = has(kind, f.at), part = it.part(key, () => {
          const g = new THREE.Group(), r = q.r || 0.002;
          const dot = new THREE.Mesh(new THREE.CircleGeometry(r, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
          const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
          glow.scale.setScalar(r * (kind === "ember" ? 9 : 10)); g.add(dot, glow); g.userData = { dot, glow }; world.add(g); return g;
        });
        if (!on) { part.visible = false; continue; }
        const col = new THREE.Color(kind === "ember" ? 0xff5a14 : on.color || "#3c8cff");
        let k = 1;
        if (kind === "ember") k = 0.75 + 0.25 * noise1(T * 1.7, it.seed) + 0.3 * Math.max(0, noise1(T * 0.23, it.seed + 5) - 0.5);
        if (on.blink) k *= Math.sin(T * Math.PI * 2 / (+on.blink || 1)) > 0 ? 1 : 0.08;
        const w = kind === "ember" ? this.tipNow(it, st) : it.world(q);
        part.visible = true; part.position.copy(w.p);
        part.userData.dot.material.color.copy(col).multiplyScalar(0.6 + 0.6 * k);
        part.userData.dot.lookAt(w.p.clone().add(w.n)); part.userData.dot.visible = kind === "led";
        part.userData.glow.material.color.copy(col); part.userData.glow.material.opacity = 0.9 * k;
      } else if (kind === "burn") {
        this.burn(it, st);
      } else if (kind === "digits") {
        for (const [i, q] of it.socks(f.at).entries()) {
          const part = it.part(key + i, () => {
            const c = canvas(128, 64), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
            const m = new THREE.Mesh(new THREE.PlaneGeometry(q.w || 0.012, q.h || 0.018), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }));
            m.userData = { c, tex, text: null }; world.add(m); return m;
          });
          const on = has(kind, f.at);
          part.visible = !!on;
          if (!on) continue;
          const sd = st.def || {}, text = on.text === "level" ? String(it.d.level ?? 6) : on.text !== undefined ? String(on.text)
            : on.count === "down" ? (() => { const left = Math.max(0, (st.secs || 0) - st.age); return `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`; })()
            : on.value ? Math.round(valueAt(on.value, st.age, on.secs ?? sd.secs ?? st.secs)) + (on.unit || "") : "";
          if (text !== part.userData.text) this.drawDigits(part, text, f.at === "lcd" ? "lcd" : "#ff2a1a");
          const w = it.world(q), up = q.up ? t3(q.up).transformDirection((it.kit || it.block).matrixWorld) : new THREE.Vector3(0, 1, 0);
          part.position.copy(w.p).addScaledVector(w.n, 0.0004);
          part.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, w.n).normalize(), up, w.n));
        }
      } else if (kind === "glow") {
        const rate = it.rateAt(hist, "glow", f.at, "level"), level = rate(T);
        for (const i of it.rings()) {
          const q = it.S[`ring_${i}`]; if (!q || !q.slot) continue;           // only a ceramic hob's elements glow
          const m = it.own(q.slot);
          const flick = 0.92 + 0.08 * noise1(T * 3 + i, it.seed);
          if (m) { m.material.emissive.setHex(0xff3008); m.material.emissiveIntensity = 2.2 * level * flick; m.material.color.setHex(level > 0.02 ? 0x3a1004 : 0x120d0c); }
          const part = it.part(key + i, () => { const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xff4010, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })); p.rotation.x = -Math.PI / 2; world.add(p); return p; });
          const w = it.world(q); part.position.copy(w.p).add(new THREE.Vector3(0, 0.002, 0)); part.scale.setScalar(q.r * 3.2 * this.scaleOf(it)); part.material.opacity = 0.55 * level * flick; part.visible = level > 0.01;
        }
      } else if (kind === "flame") {
        const on = has("flame", f.at);
        const qs = it.socks(f.at);
        qs.forEach((q, i) => {
          if (f.kind === "gas") {
            const part = it.part(key + i, () => { const g = new THREE.Group(); for (let j = 0; j < 22; j++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gasTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); s.center.set(0.5, 0.05); g.add(s); } world.add(g); return g; });
            part.visible = !!on; if (!on) return;
            const w = it.world(q), r = (q.r || 0.04) * this.scaleOf(it);
            part.children.forEach((s, j) => { const a = j / part.children.length * Math.PI * 2, fl = 0.75 + 0.25 * noise1(T * 9 + j * 3.1, it.seed);
              s.position.set(w.p.x + Math.cos(a) * r * 1.02, w.p.y - 0.006, w.p.z + Math.sin(a) * r * 1.02); s.scale.set(0.011, 0.024 * fl, 1); s.material.opacity = 0.9; });
          } else {
            const part = it.part(key + i, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); s.center.set(0.5, 0.12); world.add(s); return s; });
            part.visible = !!on; if (!on) return;
            const w = it.world(q), big = f.kind === "lighter" ? 0.8 : 1, fl = 1 + 0.12 * noise1(T * 7, it.seed) + 0.06 * noise1(T * 23, it.seed + 1);
            part.position.copy(w.p).add(new THREE.Vector3(0.0015 * noise1(T * 3, it.seed + 2), 0, 0.0015 * noise1(T * 3.3, it.seed + 4)));
            part.scale.set(0.011 * big * (2 - fl), 0.034 * big * fl, 1);
          }
        });
      } else if (kind === "fill") {
        this.fill(it, st, T);
      } else if (kind === "drip" || kind === "stream") {
        this.water(it, st, kind, f, T, key);
      } else if (kind === "hands") {
        this.hands(it, st);
      } else if (kind === "pendulum") {
        const q = it.S.pendulum, m = it.slots[(q || {}).slot]; if (!q || !m) continue;
        const on = has("pendulum"), Tp = 2 * Math.PI * Math.sqrt((q.len || 0.25) / 9.81), run = (st.spent && st.spent[st.state]) || 0;
        const ang = on ? 0.09 * Math.sin(2 * Math.PI * run / Tp) : 0;
        this.turn(m, t3(q.at), new THREE.Vector3(0, 0, -1), ang);
      } else if (kind === "rattle") {
        const q = it.S.lid, m = q && it.slots[q.slot]; if (!m) continue;
        const on = has("rattle"), k = on ? Math.max(0, noise1(T * 11, it.seed) * noise1(T * 4.3, it.seed + 1)) : 0;
        m.position.set(0, k * 0.003, 0); m.rotation.set(k * 0.03 * noise1(T * 7, it.seed + 2), 0, k * 0.03 * noise1(T * 6, it.seed + 3));
      } else if (kind === "screen") {
        this.screen(it, has("screen"), T, key);
      } else if (kind === "buzz") {
        const on = has("buzz"), burst = on && (T % 2) < 0.9;
        it.block.position.copy(it.home.p); if (burst) it.block.position.add(new THREE.Vector3(noise1(T * 60, it.seed) * 0.0012, 0, noise1(T * 57, it.seed + 1) * 0.0012));
      } else if (kind === "light") {
        const l = this.stage.lights.find(x => x.userData.id === it.d.light);
        if (l && !has("light")) l.intensity = 0;
      }
    }
  }
  scaleOf(it) { const k = it.kit || it.block; return new THREE.Vector3().setFromMatrixScale(k.matrixWorld).x || 1; }
  // turn a slot mesh about a pivot (the kit group's space) on an axis
  turn(m, pivot, axis, ang) {
    const q = new THREE.Quaternion().setFromAxisAngle(axis, ang);
    m.quaternion.copy(q); m.position.copy(pivot).sub(pivot.clone().applyQuaternion(q));
  }
  // a clock: its hands from the time its kit shows, run on by the seconds it has been running
  hands(it, st) {
    const q = it.S.hub; if (!q || !q.hands) return;
    const run = (st.spent && st.spent.running) || 0, h0 = q.hands.h, m0 = q.hands.m, s0 = q.hands.s ?? 0;
    const axis = new THREE.Vector3(0, 0, -1), pivot = t3(q.at);
    const ang = { h: h0 + run / 120, m: m0 + run / 10, s: s0 + Math.floor(run) * 6 };     // 30° an hour, 6° a minute, the second hand ticks
    for (const [k, slot] of Object.entries(q.slots || {})) {
      const m = slot && it.slots[slot]; if (!m) continue;
      const a0 = q.hands[k]; if (a0 === undefined) continue;
      this.turn(m, pivot, axis, (ang[k] - a0) * Math.PI / 180);
    }
  }
  // where a burning tip is now: back from the kit's tip by what has burnt (its `lit` time over the life's secs)
  burnt(it, st) {
    const q = it.S.tip; if (!q || !q.len) return 0;
    const lit = (st.spent && st.spent.lit) || 0, secs = ((stateDef(this.lives, it.life, "lit") || {}).secs) || 420;
    const own = it.d.secs && it.d.secs.lit;
    return q.len * clamp01(lit / (own || secs)) * 0.97;
  }
  tipNow(it, st) {
    const q = it.S.tip, w = it.world(q), b = this.burnt(it, st) * this.scaleOf(it);
    return { p: w.p.clone().addScaledVector(w.n, -b - (q.r || 0.004) * 0.1), n: w.n };
  }
  burn(it, st) {
    const q = it.S.tip; if (!q || !q.len) return;
    const w = it.world(q), k = this.scaleOf(it), b = this.burnt(it, st) * k, r = (q.r || 0.004) * k, n = w.n.clone();
    const p0 = w.p.clone().addScaledVector(n, -b);              // the burn line
    // clip what's past it (the paper, the kit's own ash and end) inside a box round the cigarette's end only, so the
    // butts beside it in the ashtray stay whole
    const side = new THREE.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(), up = new THREE.Vector3().crossVectors(side, n);
    const planes = [new THREE.Plane().setFromNormalAndCoplanarPoint(n.clone().negate(), p0)];
    for (const v of [side, up]) for (const sg of [1, -1]) planes.push(new THREE.Plane().setFromNormalAndCoplanarPoint(v.clone().multiplyScalar(sg), p0.clone().addScaledVector(v, sg * r * 1.6)));
    planes.push(new THREE.Plane().setFromNormalAndCoplanarPoint(n.clone(), w.p.clone().addScaledVector(n, 0.03)));
    for (const s of ["cig", "ash", "ash_2", "tobacco"]) { const m = b > 0.0002 ? it.own(s) : it.slots[s]; if (m && m.userData.ownMat) { m.material.clippingPlanes = b > 0.0002 ? planes : null; m.material.clipIntersection = true; } }
    // the ash it leaves, dropping every 11 mm, and the charred ring at the line
    const ash = it.part("burn:ash", () => { const g = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.96, 1, 14), new THREE.MeshStandardMaterial({ color: 0x8e8b86, roughness: 1 })); this.stage.world.add(g); return g; });
    const len = b > 0.0003 ? (b % (0.011 * k)) + 0.0006 : 0;
    ash.visible = len > 0.0004;
    if (ash.visible) { ash.position.copy(p0).addScaledVector(n, len / 2); ash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); ash.scale.set(r * 0.97, len, r * 0.97); }
  }
  // a cup's tea: the inside of the cup filled to its level (the inner wall's profile, turned), the liquid's colour
  fill(it, st, T) {
    const q = it.S.inner; if (!q || !q.prof) return;
    const f = (st.def && st.def.fx || []).find(x => x.fx === "fill");
    const level = f ? valueAt(f.level, st.age, f.secs ?? st.secs, f.ease || 1) : 0, prof = q.prof, z0 = prof[0][1], z1 = prof[prof.length - 1][1], z = z0 + (z1 - z0) * clamp01(level);
    const part = it.part("fill", () => { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0x9a5a22, roughness: 0.08, transparent: true, opacity: 0.94 })); (it.kit || it.block).add(m); m.userData.z = null; return m; });
    part.visible = level > 0.005;
    if (!part.visible) return;
    const col = (this.lives.liquids || {})[it.d.liquid || "tea"] || "#9a5a22"; part.material.color.set(col);
    if (it.d.liquid === "water") part.material.opacity = 0.45;
    if (part.userData.z !== null && Math.abs(part.userData.z - z) < 0.0003) return;
    part.userData.z = z;
    const pts = [new THREE.Vector2(0, z0)];
    for (const [r, zz] of prof) { if (zz >= z) break; pts.push(new THREE.Vector2(r * 0.985, zz)); }
    let rz = prof[0][0]; for (let i = 0; i + 1 < prof.length; i++) if (prof[i][1] <= z && prof[i + 1][1] >= z) { const k = (z - prof[i][1]) / ((prof[i + 1][1] - prof[i][1]) || 1); rz = prof[i][0] + (prof[i + 1][0] - prof[i][0]) * k; }
    pts.push(new THREE.Vector2(rz * 0.985, z), new THREE.Vector2(0, z));
    part.geometry.dispose(); part.geometry = new THREE.LatheGeometry(pts, 40);
    part.position.set(q.at[0], 0, -q.at[1]);
  }
  // a pour: the cup's `from` kettle or teapot lifted over it and tipped, a stream from its spout into the cup, then
  // put back. Over the cup's filling state (its age), so it scrubs
  pour(it, st, T) {
    const src = this.by[it.d.from], on = (st.def && st.def.fx || []).some(x => x.fx === "pour");
    const stream = it.part("pour:stream", () => { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0xc9dde3, roughness: 0.05, transparent: true, opacity: 0.75 })); this.stage.world.add(m); return m; });
    if (!src || !src.S.spout) { stream.visible = false; return; }
    const secs = st.secs || 4, u = on ? clamp01(st.age / secs) : 0, lift = on ? sm(clamp01(u / 0.22)) * (1 - sm(clamp01((u - 0.82) / 0.18))) : 0;
    src.block.position.copy(src.home.p); src.block.quaternion.copy(src.home.q);
    if (lift <= 0) { stream.visible = false; src.lifted = false; return; }
    // where its spout must be: over the cup's rim, 9 cm up; the thing turned so the spout tips 35° down
    src.block.updateMatrixWorld(true);
    const rim = it.world(it.S.rim || it.S.inner), sp = src.world(src.S.spout), centre = src.block.getWorldPosition(new THREE.Vector3());
    const hor = sp.n.clone().setY(0); if (hor.lengthSq() < 1e-6) hor.set(1, 0, 0); hor.normalize();
    const axis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), hor).normalize(), tilt = new THREE.Quaternion().setFromAxisAngle(axis, 0.62 * lift);
    const off = sp.p.clone().sub(centre).applyQuaternion(tilt), target = rim.p.clone().add(new THREE.Vector3(0, 0.09, 0)).sub(hor.clone().multiplyScalar(0.01));
    const want = target.sub(off), now = centre.clone().lerp(want, lift);
    src.block.position.copy(src.block.parent.worldToLocal(now)); src.block.quaternion.premultiply(tilt); src.block.updateMatrixWorld(true);
    // the stream: out of the spout, falling into the cup (only once it's tipped far enough)
    const sp2 = src.world(src.S.spout), flow = clamp01((lift - 0.6) / 0.4);
    stream.visible = flow > 0.05;
    if (!stream.visible) return;
    const pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * 0.14; pts.push(sp2.p.clone().addScaledVector(hor, 0.25 * a).add(new THREE.Vector3(0, -4.9 * a * a, 0))); }
    const bottom = rim.p.y - 0.02; for (const p of pts) p.y = Math.max(p.y, bottom);
    stream.geometry.dispose(); stream.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.0022 * flow + 0.0008, 6, false);
    stream.material.color.set(it.d.liquid && it.d.liquid !== "water" ? (this.lives.liquids || {})[it.d.liquid] || "#c9dde3" : "#c9dde3");
  }
  // a drip (a drop every `every` seconds falls to what's under the spout, a ring where it lands) or a running tap
  water(it, st, kind, f, T, key) {
    const q = it.S.spout; if (!q) return;
    const on = (st.def && st.def.fx || []).find(x => x.fx === kind), w = it.world(q);
    if (it.floor === undefined) {                         // what's under the spout: found once
      const ray = new THREE.Raycaster(w.p.clone().add(new THREE.Vector3(0, -0.01, 0)), new THREE.Vector3(0, -1, 0), 0, 1.2);
      const hit = ray.intersectObjects(this.stage.solid.filter(m => m !== it.block), false)[0];
      it.floor = hit ? hit.point.y : w.p.y - 0.35;
    }
    const fall = Math.max(0.03, w.p.y - it.floor);
    if (kind === "drip") {
      const every = +(on ? on.every : f.every) || 2.6, tf = Math.sqrt(2 * fall / 9.81);
      const drop = it.part(key + ":d", () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd6e6ee, roughness: 0.02, transparent: true, opacity: 0.8 })); this.stage.world.add(m); return m; });
      const ring = it.part(key + ":r", () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24), new THREE.MeshBasicMaterial({ color: 0xd6e6ee, transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; this.stage.world.add(m); return m; });
      if (!on) { drop.visible = ring.visible = false; return; }
      const n = Math.floor(T / every), a = T - n * every - 0.8;      // a drop swells 0.8 s at the spout, then falls
      drop.visible = a < tf; ring.visible = a >= tf && a < tf + 0.35;
      if (a < 0) { drop.position.copy(w.p); drop.scale.setScalar(0.5 + 0.5 * clamp01(1 + a / 0.8)); }
      else if (a < tf) { drop.position.copy(w.p).add(new THREE.Vector3(0, -4.905 * a * a, 0)); drop.scale.set(0.85, 1.25, 0.85); }
      if (ring.visible) { const u = (a - tf) / 0.35; ring.position.set(w.p.x, it.floor + 0.001, w.p.z); ring.scale.setScalar(0.004 + 0.022 * u); ring.material.opacity = 0.5 * (1 - u); }
    } else {
      const col = it.part(key + ":c", () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10, 6, true), new THREE.MeshStandardMaterial({ color: 0xd6e6ee, roughness: 0.02, transparent: true, opacity: 0.55, side: THREE.DoubleSide })); this.stage.world.add(m); return m; });
      col.visible = !!on; if (!on) return;
      col.position.set(w.p.x + 0.0006 * noise1(T * 13, it.seed), (w.p.y + it.floor) / 2, w.p.z); col.scale.set(0.0042, fall, 0.0042);
    }
  }
  // a screen: static (snow) or a programme (a TV), lit (a phone's lock screen), a call coming in
  screen(it, on, T, key) {
    const part = it.part(key, () => {
      const q = it.S.screen, c = canvas(128, 96), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      let w = 0.1, h = 0.06, pos, quat;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      if (q) { w = q.w; h = q.h; }
      else {                                           // a kit panel (a TV): its screen face, from the screen slot's bounds
        const s = it.slots.screen; if (s) { s.geometry.computeBoundingBox(); const b = s.geometry.boundingBox; w = b.max.x - b.min.x; h = b.max.y - b.min.y; m.userData.front = new THREE.Vector3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.max.z + 0.0006); }
      }
      m.scale.set(w, h, 1); m.userData.c = c; m.userData.tex = tex; m.userData.q = q; (it.kit || it.block).add(m);
      if (q) { m.position.copy(t3(q.at)).addScaledVector(t3(q.n), 0.0003); const up = t3(q.up || [0, 0, 1]), n = t3(q.n); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, n).normalize(), up, n)); }
      else if (m.userData.front) m.position.copy(m.userData.front);
      return m;
    });
    part.visible = !!on; if (!on) return;
    const c = part.userData.c, g = c.getContext("2d"), W = c.width, H = c.height, frame = Math.floor(T * 15);
    if (part.userData.frame === frame && part.userData.mode === on.mode) return;
    part.userData.frame = frame; part.userData.mode = on.mode;
    if (on.mode === "static") {
      const img = g.createImageData(W, H);
      for (let i = 0; i < W * H; i++) { const v = hash(i, frame) * 200 + 30; img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v * 1.05; img.data[i * 4 + 3] = 255; }
      g.putImageData(img, 0, 0);
      g.fillStyle = "rgba(0,0,0,0.25)"; for (let y = (frame * 3) % 6; y < H; y += 6) g.fillRect(0, y, W, 2);
    } else if (on.mode === "on") {                     // a programme seen from across the room: shifting blocks of colour
      const k = Math.floor(T / 3.1);
      for (let i = 0; i < 6; i++) { const hue = (hash(k, i) * 360) | 0, x = hash(k, i + 9) * W, y = hash(k, i + 19) * H; g.fillStyle = `hsl(${hue},${30 + hash(k, i + 3) * 40}%,${25 + hash(k, i + 4) * 35}%)`; g.fillRect(x - W * 0.4, y - H * 0.4, W * 0.8, H * 0.8); }
      g.fillStyle = `rgba(255,255,255,${0.05 + 0.05 * Math.sin(T * 9)})`; g.fillRect(0, 0, W, H);
    } else {                                           // a phone: its lock screen, or a call coming in (着信)
      const call = on.mode === "call", gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, call ? "#0f2a1c" : "#1c2340"); gr.addColorStop(1, call ? "#08130d" : "#3a2440"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = "#e9eef5"; g.textAlign = "center"; g.font = "bold 22px sans-serif"; g.fillText(call ? "着信" : "02:47", W / 2, H * 0.38);
      if (call) { const r = 10 + 4 * Math.abs(Math.sin(T * 4)); g.beginPath(); g.arc(W / 2, H * 0.7, r, 0, Math.PI * 2); g.fillStyle = "#4ade80"; g.fill(); }
    }
    part.userData.tex.needsUpdate = true;
  }
  drawDigits(m, text, color) {
    const c = m.userData.c, g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    if (color === "lcd") { g.fillStyle = "rgba(255,186,96,0.92)"; g.fillRect(0, 0, c.width, c.height); color = "#2a1606"; }   // an LCD: its backlight, dark digits
    g.font = `bold ${text.length > 4 ? 34 : 46}px monospace`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "rgba(60,10,8,0.35)"; if (/^[0-9:°]+$/.test(text)) g.fillText(text.replace(/[0-9]/g, "8"), c.width / 2, c.height / 2 + 2);   // the unlit segments
    g.shadowColor = color; g.shadowBlur = 10; g.fillStyle = color; g.fillText(text, c.width / 2, c.height / 2 + 2);
    m.userData.text = text; m.userData.tex.needsUpdate = true;
  }
  // put every moved thing back (a pour's kettle, a phone's buzz) and hide the effects: a stage leaving a scene
  reset() { for (const it of this.items) { it.block.position.copy(it.home.p); it.block.quaternion.copy(it.home.q); } }
  dispose() { for (const it of this.items) it.dispose(); this.items = []; }
}

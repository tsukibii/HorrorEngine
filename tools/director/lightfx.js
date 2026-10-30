// The desk's own drawing of two Light Kit pieces the Godot side has (docs/GODOT_LOOK.md §1, DECISIONS 2026-10-29):
//   - a light's `pattern` (caustics, leaves, blinds, clouds): HSPattern's four light functions (pattern.gdshader, the
//     same maths) drawn in JavaScript into a loop of small textures, one a frame at load, then cycled back and forth
//     over `period` seconds and laid on the surface the light is aimed at (a quad found by a ray from the light, lit
//     as the light is: its colour, its flicker, out when it's off). three.js can project a spot's map only through its
//     shadow camera, and shadow maps broke every shader of the stage on the user's card (ANGLE on Vulkan, 2026-10-29),
//     so the desk draws no shadows: the sweep's lamp slides without them (Godot's has them);
//   - a window's `shaft` (HSShaft): a box laid along the window's light with a see-through additive material whose
//     density is the fog shader's (full at the window, fading along the beam and at its sides, dust as slow clumps).
// Nothing here is the story's: it only draws what the words already say.
import * as THREE from "three";

const KINDS = { caustics: 0, leaves: 1, blinds: 2, clouds: 3 };
const SCALES = { caustics: 0.6, leaves: 0.8, blinds: 0.08, clouds: 4.0 };   // pattern.gd's SCALES
const SPEEDS = { caustics: 0.4, leaves: 0.5, blinds: 0.0, clouds: 0.15 };  // pattern.gd's SPEEDS

const fract = x => x - Math.floor(x);
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const sm = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, k) => a + (b - a) * k;
const hash21 = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  return mix(mix(hash21(ix, iy), hash21(ix + 1, iy), fx), mix(hash21(ix, iy + 1), hash21(ix + 1, iy + 1), fx), fy);
}
function fbm(x, y, octaves, sx, sy) {
  let n = 0, a = 0.5;
  for (let o = 0; o < octaves; o++) { n += a * vnoise(x, y); const nx = x * 2.07 + sx, ny = y * 2.07 + sy; x = nx; y = ny; a *= 0.5; }
  return n;
}

// one frame of the pattern at moment t, as pattern.gdshader draws it: a value 0..1 per pixel
export function patternPixels(kind, s, metres, t, px = 128) {
  const k = KINDS[kind] ?? 0, scale = Math.max(+(s.scale ?? SCALES[kind] ?? 0.6), 0.01), speed = +(s.speed ?? SPEEDS[kind] ?? 0.4);
  const open = clamp01(+(s.open ?? 0.5)), angle = (+(s.angle || 0)) * Math.PI / 180;
  const out = new Uint8Array(px * px * 4);
  for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
    const u = (i + 0.5) / px, w = (j + 0.5) / px, ux = (u - 0.5) * metres, uy = (w - 0.5) * metres;
    let v = 1;
    if (k === 1) {                                                      // leaves
      const px_ = ux / scale * 3, py_ = uy / scale * 3, tt = t * speed;
      const wx = 0.12 * Math.sin(tt * 1.3 + py_ * 0.9), wy = 0.12 * Math.cos(tt * 1.1 + px_ * 0.8);
      const n = fbm(px_ + wx, py_ + wy, 3, 13.7 + wx, 7.3 + wy);
      const cut = mix(0.68, 0.42, open);
      v = mix(0.06, 1, sm(cut - 0.05, cut + 0.05, n));
    } else if (k === 2) {                                               // blinds
      const sl = ux * Math.cos(angle) + uy * Math.sin(angle), f = fract(sl / Math.max(scale, 0.005));
      v = mix(0.04, 1, 1 - sm(open - 0.06, open + 0.06, f));
    } else if (k === 3) {                                               // clouds
      const n = fbm(ux / scale + t * speed, uy / scale + t * speed * 0.37, 5, 5.3, 9.1);
      const cover = mix(0.35, 0.65, open);
      v = mix(1, 0.35, sm(cover - 0.08, cover + 0.08, n));
    } else {                                                            // caustics
      const tt = t * speed; let acc = 0;
      for (let layer = 0; layer < 2; layer++) {
        const m = layer === 0 ? 1 : 1.7;
        let qx = ux / scale * m + layer * 3.1, qy = uy / scale * m + layer * 1.7;
        qx += 0.2 * Math.sin(qy * 2.3 + tt); qy += 0.2 * Math.cos(qx * 2.1 - tt * 0.8);
        const ix = Math.floor(qx), iy = Math.floor(qy), fx = qx - ix, fy = qy - iy;
        let d1 = 8, d2 = 8;
        for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
          const cx = ix + x, cy = iy + y;
          const h1 = fract(Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453), h2 = fract(Math.sin(cx * 269.5 + cy * 183.3) * 43758.5453);
          const ox = 0.5 + 0.4 * Math.sin(tt * 0.7 + 6.2831853 * h1), oy = 0.5 + 0.4 * Math.sin(tt * 0.7 + 6.2831853 * h2);
          const dx = x + ox - fx, dy = y + oy - fy, d = Math.sqrt(dx * dx + dy * dy);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        acc += (1 - sm(0, 0.12, d2 - d1)) * (layer === 0 ? 0.7 : 0.45);
      }
      const base = mix(0.05, 0.5, open);
      v = base + (1.2 - base) * clamp01(acc);
    }
    const r = Math.sqrt((u - 0.5) * (u - 0.5) + (w - 0.5) * (w - 0.5)) * 2;   // the cone's own edge
    v *= 1 - sm(0.8, 1, r);
    const b = Math.round(clamp01(v) * 255), o = (j * px + i) * 4;
    out[o] = out[o + 1] = out[o + 2] = b; out[o + 3] = 255;
  }
  return out;
}

// the loop of frames a patterned light throws (HSPattern): drawn one a tick at load, then cycled back and forth, on a
// quad laid where the light lands (the first tick finds the surface with a ray from the light; else the aim point)
export class PatternLoop {
  constructor(spot, s, aimDistance) {
    this.spot = spot; this.kind = KINDS[s.pattern] !== undefined ? s.pattern : "caustics"; this.s = s;
    this.px = +(s.size || 128); this.wanted = this.kind === "blinds" ? 1 : +(s.frames || 40); this.period = +(s.period || 5);
    this.metres = 2 * Math.max(aimDistance, 0.1) * Math.tan(spot.angle);
    this.frames = []; this.clock = 0; this.shown = -1;
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.metres, this.metres), this.mat);
    this.mesh.visible = false; this.mesh.renderOrder = 4; this.mesh.userData.pattern = true;
    this.placed = false;
  }
  // on the surface the light lands on: the ray from the light through its aim against the stage's solid things
  place(solid) {
    const from = this.spot.position.clone(), to = this.spot.target.position.clone(), dir = to.sub(from), len = dir.length(); dir.normalize();
    const ray = new THREE.Raycaster(from, dir, 0.05, len + 6), hits = solid && solid.length ? ray.intersectObjects(solid, false) : [];
    const hit = hits.find(h => h.face);
    let at = this.spot.target.position.clone(), n = dir.clone().negate();
    if (hit) { at = hit.point.clone(); n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld); if (n.dot(dir) > 0) n.negate(); }
    this.mesh.position.copy(at).addScaledVector(n, 0.008);
    this.mesh.lookAt(at.clone().add(n));
    this.placed = true;
  }
  // k: how lit the light is now (its intensity over its base: the flicker, the power, a lamp off)
  tick(dt, solid, k = 1) {
    if (!this.placed) this.place(solid);
    if (this.frames.length < this.wanted) {                                  // one frame a tick, as Godot draws them
      const t = (this.frames.length / this.wanted) * this.period;
      const tex = new THREE.DataTexture(patternPixels(this.kind, this.s, this.metres, t, this.px), this.px, this.px, THREE.RGBAFormat);
      tex.needsUpdate = true; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
      this.frames.push(tex);
    }
    if (!this.frames.length) return;
    this.clock += dt;
    const n = this.frames.length; let idx = 0;
    if (n > 1) { const u = (this.clock / this.period) % 2, kk = u < 1 ? u : 2 - u; idx = Math.max(0, Math.min(n - 1, Math.floor(kk * n))); }
    if (idx !== this.shown) { this.shown = idx; this.mat.map = this.frames[idx]; this.mat.needsUpdate = true; }
    const lit = Math.max(0, Math.min(1.5, k));
    this.mat.color.copy(this.spot.color).multiplyScalar(0.3 * lit); this.mesh.visible = lit > 0.02;   // added over the lit surface: a third keeps the caustics' bright edges from blowing out
  }
  dispose() { for (const f of this.frames) f.dispose(); this.frames = []; this.mat.dispose(); this.mesh.geometry.dispose(); }
}

// a window's light shaft (HSShaft): the beam as a box the window's size laid `reach` metres along its light, drawn
// see-through and additive, its density the fog shader's (the ends, the sides, the dust's clumps sinking)
const SHAFT_VERT = `varying vec3 vLocal; varying vec3 vWorld;
void main() { vLocal = position; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SHAFT_FRAG = `uniform vec3 color; uniform float strength; uniform float dust; uniform float drift; uniform float time; uniform vec3 size;
varying vec3 vLocal; varying vec3 vWorld;
void main() {
  vec3 uvw = vLocal / size + 0.5;                                        // 0..1 in the box; the beam runs along -z from the window at z = +0.5
  float along = 1.0 - uvw.z;
  float ends = smoothstep(0.0, 0.08, along) * (1.0 - smoothstep(0.45, 1.0, along));
  vec2 side = abs(uvw.xy - 0.5) * 2.0;
  float edge = (1.0 - smoothstep(0.6, 1.0, side.x)) * (1.0 - smoothstep(0.6, 1.0, side.y));
  vec3 p = vWorld * 3.0 + vec3(0.0, -time * drift * 3.0, 0.0);
  float motes = 0.5 + 0.5 * sin(p.x * 3.1 + sin(p.y * 2.3 + time * 0.2) * 2.0) * sin(p.z * 2.7 + sin(p.x * 1.9 - time * 0.15) * 2.0);
  float fine = 0.5 + 0.5 * sin(p.x * 11.0 + time * 0.3) * sin(p.y * 13.0 - time * 0.2) * sin(p.z * 9.0);
  float clumps = mix(1.0, 0.4 + 1.2 * motes, dust) * mix(1.0, 0.7 + 0.6 * fine, dust * 0.5);
  float a = strength * ends * edge * clumps * 0.22;
  gl_FragColor = vec4(color * a, a);
}`;
export class Shaft {
  // from: the window's middle just inside; to: where its light aims; w, h the opening's; k the story's strength
  constructor(from, to, w, h, k, opts = {}) {
    const reach = +(opts.reach || 3), dir = to.clone().sub(from).normalize();
    this.size = new THREE.Vector3(w * 1.15, h * 1.15, reach);
    this.mat = new THREE.ShaderMaterial({ vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, uniforms: { color: { value: new THREE.Color(0xffffff) }, strength: { value: k }, dust: { value: +(opts.dust ?? 0.5) }, drift: { value: +(opts.drift ?? 0.12) }, time: { value: 0 }, size: { value: this.size } } });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z), this.mat);
    this.mesh.position.copy(from).addScaledVector(dir, reach / 2);
    this.mesh.lookAt(this.mesh.position.clone().sub(dir));                // the box's +z toward the window: the beam runs down -z
    this.mesh.renderOrder = 5; this.mesh.userData.shaft = true; this.mesh.frustumCulled = true;
    this.k = k;
  }
  // the beam only as bright as the window's light (the time of day): light 0..1 of a full day
  light(color, amount) { this.mat.uniforms.color.value.set(color); this.mat.uniforms.strength.value = this.k * Math.max(0, Math.min(1.5, amount)); this.mesh.visible = amount > 0.02; }
  tick(T) { this.mat.uniforms.time.value = T; }
}

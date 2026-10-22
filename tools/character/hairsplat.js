// The hair builder's splat: Gaussians riding a cage (lattice.js). Each Gaussian keeps its piece and its place in it
// (trilinear coordinates in the piece's nodes), the pieces' nodes live in a float texture, and the vertex shader puts
// every Gaussian back from them each frame: moved, stretched, bent, jiggled. Drawn as instanced quads with the hair
// shading of splats.js (the UE4 approximation of Marschner along the long axis), composited back to front by the
// pieces' row bands. Paint and erase change the arrays and rebuild the textures.
//   const h = new HairSplat(data /* Float32Array, 14 per Gaussian */, lattice);  h.lock();  h.updateNodes();  h.sort(camera)
import * as THREE from "three";

const GW = 2048, NW = 1024;
const VERT = `
precision highp float;
uniform sampler2D gdata; uniform float GH;
uniform sampler2D nodes; uniform float NH;
uniform sampler2D pieces; uniform float PW;
uniform vec2 viewport; uniform float uSigma; uniform float uOpacity;
uniform vec3 lightDir; uniform vec3 lightColor; uniform float ambient; uniform float roughness; uniform float shift; uniform float specular; uniform float backlit;
uniform vec3 tint; uniform float uSelected; uniform float uDim;
attribute float aId; attribute vec2 corner;
varying vec2 vLocal; varying vec3 vColor; varying float vAlpha;
vec4 tex(float k) { float t = aId * 4.0 + k; float x = mod(t, ${GW}.0); float y = floor(t / ${GW}.0); return texture2D(gdata, vec2((x + 0.5) / ${GW}.0, (y + 0.5) / GH)); }
vec3 node(float i) { float x = mod(i, ${NW}.0); float y = floor(i / ${NW}.0); return texture2D(nodes, vec2((x + 0.5) / ${NW}.0, (y + 0.5) / NH)).xyz; }
vec4 piece(float p, float k) { return texture2D(pieces, vec2((p * 2.0 + k + 0.5) / PW, 0.5)); }
mat3 quatMat(vec4 q) {
  float w = q.x, x = q.y, y = q.z, z = q.w;
  return mat3(1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y + w * z), 2.0 * (x * z - w * y),
              2.0 * (x * y - w * z), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z + w * x),
              2.0 * (x * z + w * y), 2.0 * (y * z - w * x), 1.0 - 2.0 * (x * x + y * y));
}
float Hair_g(float B, float Theta) { return exp(-0.5 * Theta * Theta / (B * B)) / (2.5066 * B); }
float Hair_F(float CosTheta) { float F0 = 0.04652; return F0 + (1.0 - F0) * pow(1.0 - CosTheta, 5.0); }
vec3 hairShade(vec3 base, vec3 L, vec3 V, vec3 T) {
  float VoL = dot(V, L);
  float SinThetaL = clamp(dot(T, L), -1.0, 1.0), SinThetaV = clamp(dot(T, V), -1.0, 1.0);
  float CosThetaD = cos(0.5 * abs(asin(SinThetaV) - asin(SinThetaL)));
  vec3 Lp = L - SinThetaL * T, Vp = V - SinThetaV * T;
  float CosPhi = dot(Lp, Vp) * inversesqrt(dot(Lp, Lp) * dot(Vp, Vp) + 1e-4);
  float CosHalfPhi = sqrt(clamp(0.5 + 0.5 * CosPhi, 0.0, 1.0));
  float n_prime = 1.19 / CosThetaD + 0.36 * CosThetaD;
  float r2 = roughness * roughness;
  vec3 S = vec3(0.0);
  float Mp = Hair_g(r2 * 1.4142, SinThetaL + SinThetaV + shift * 2.0);
  float Np = 0.25 * CosHalfPhi;
  float Fp = Hair_F(sqrt(clamp(0.5 + 0.5 * VoL, 0.0, 1.0)));
  S += vec3(Mp * Np * Fp * specular * 2.0) * mix(1.0, backlit, clamp(-VoL, 0.0, 1.0));
  Mp = Hair_g(r2 * 0.5, SinThetaL + SinThetaV - shift);
  float a = 1.0 / n_prime, h = CosHalfPhi * (1.0 + a * (0.6 - 0.8 * CosPhi));
  float f = Hair_F(CosThetaD * sqrt(clamp(1.0 - h * h, 0.0, 1.0)));
  Fp = (1.0 - f) * (1.0 - f);
  vec3 Tp = pow(base, vec3(0.5 * sqrt(max(1.0 - h * h * a * a, 0.0)) / CosThetaD));
  Np = exp(-3.65 * CosPhi - 3.98);
  S += Mp * Np * Fp * Tp * backlit;
  Mp = Hair_g(r2 * 4.0, SinThetaL + SinThetaV - shift * 4.0);
  f = Hair_F(CosThetaD * 0.5); Fp = (1.0 - f) * (1.0 - f) * f;
  Tp = pow(base, vec3(0.8 / CosThetaD));
  Np = exp(17.0 * CosPhi - 16.78);
  S += Mp * Np * Fp * Tp;
  return S;
}
void main() {
  vec4 t0 = tex(0.0), t1 = tex(1.0), t2 = tex(2.0), t3 = tex(3.0);
  float pid = t0.x, u = t0.y, v = t0.z, w = t0.w; vec3 sc0 = t1.xyz; float op = t1.w * uOpacity; vec4 q = t2; vec3 base = t3.xyz; float alive = t3.w;
  vec4 pa = piece(pid, 0.0), pb = piece(pid, 1.0);
  float at = pa.x, rows = pa.y; vec3 stretch = vec3(pa.z, pa.w, pb.x); float selected = pb.y;
  // the place in the piece: rows from the top, four corners a row
  float rf = clamp(v, 0.0, 1.0) * (rows - 1.0); float r0 = min(floor(rf), rows - 2.0); float f = rf - r0;
  vec3 a0 = node(at + r0 * 4.0), b0 = node(at + r0 * 4.0 + 1.0), c0 = node(at + r0 * 4.0 + 2.0), d0 = node(at + r0 * 4.0 + 3.0);
  vec3 a1 = node(at + r0 * 4.0 + 4.0), b1 = node(at + r0 * 4.0 + 5.0), c1 = node(at + r0 * 4.0 + 6.0), d1 = node(at + r0 * 4.0 + 7.0);
  vec3 top = mix(mix(a0, b0, u), mix(c0, d0, u), w), bot = mix(mix(a1, b1, u), mix(c1, d1, u), w);
  vec3 centre = mix(top, bot, f);
  if (v > 1.0 || v < 0.0) { float over = v > 1.0 ? v - 1.0 : v; centre += (bot - top) * (rows - 1.0) * over; }
  // the piece's frame for the Gaussian's shape: its row direction and its x and z edges
  vec3 ex = normalize(mix(b0, b1, f) - mix(a0, a1, f)), ez = normalize(mix(c0, c1, f) - mix(a0, a1, f)), ey = normalize(top - bot);
  mat3 Fm = mat3(ex, ey, ez);
  vec3 sc = sc0 * uSigma * stretch;
  mat3 Rw = Fm * quatMat(q);
  mat3 M = mat3(Rw[0] * sc.x, Rw[1] * sc.y, Rw[2] * sc.z);
  mat3 cov = M * transpose(M);
  mat3 W = mat3(modelViewMatrix);
  mat3 C = W * cov * transpose(W);
  vec4 tc = modelViewMatrix * vec4(centre, 1.0);
  float tz = -tc.z;
  if (tz < 0.02 || alive < 0.5) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); vAlpha = 0.0; vLocal = vec2(0.0); vColor = vec3(0.0); return; }
  float fx = projectionMatrix[0][0] * viewport.x * 0.5, fy = projectionMatrix[1][1] * viewport.y * 0.5;
  vec3 J0 = vec3(fx / tz, 0.0, fx * tc.x / (tz * tz)), J1 = vec3(0.0, fy / tz, fy * tc.y / (tz * tz));
  float a = dot(J0, C * J0) + 0.3, b = dot(J0, C * J1), c = dot(J1, C * J1) + 0.3;
  float mid = 0.5 * (a + c), d = sqrt(max(mid * mid - (a * c - b * b), 0.01));
  float l1 = mid + d, l2 = max(mid - d, 0.01);
  vec2 v1 = abs(b) > 1e-6 ? normalize(vec2(b, l1 - a)) : (a >= c ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
  vec2 v2 = vec2(-v1.y, v1.x);
  vec2 px = corner.x * 3.0 * sqrt(l1) * v1 + corner.y * 3.0 * sqrt(l2) * v2;
  vec4 clip = projectionMatrix * tc;
  gl_Position = clip + vec4(px.x * 2.0 / viewport.x * clip.w, px.y * 2.0 / viewport.y * clip.w, 0.0, 0.0);
  vLocal = corner * 3.0;
  float smax = max(sc.x, max(sc.y, sc.z));
  vec3 axis = normalize(mat3(modelMatrix) * (sc.x == smax ? Rw[0] : (sc.y == smax ? Rw[1] : Rw[2])));
  vec3 wc = (modelMatrix * vec4(centre, 1.0)).xyz;
  vec3 V = normalize(cameraPosition - wc), L = normalize(lightDir);
  vec3 bl = pow(base * tint, vec3(2.2));
  vec3 S = hairShade(bl, L, V, axis);
  vec3 n = normalize(V - axis * dot(axis, V));
  vec3 local = sqrt(bl) * (dot(n, L) + 1.0) / 12.566;
  vec3 col = (S + local) * lightColor + ambient * bl;
  col = mix(col, col * uDim, 1.0 - selected);                      // the other pieces dimmed when one is selected
  vColor = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  vAlpha = op;
}`;
const FRAG = `
precision highp float;
varying vec2 vLocal; varying vec3 vColor; varying float vAlpha;
void main() { float g = exp(-0.5 * dot(vLocal, vLocal)); float a = vAlpha * g; if (a < 0.004) discard; gl_FragColor = vec4(vColor * a, a); }`;

export const FLOATS = 14;      // x y z, sx sy sz, qw qx qy qz, r g b, opacity

export class HairSplat {
  constructor(data, lattice) {
    this.data = Float32Array.from(data);                 // the Gaussians as saved (rest positions: where they are when the cage is at rest)
    this.lattice = lattice;
    this.alive = new Uint8Array(this.n).fill(1);
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: { gdata: { value: null }, GH: { value: 1 }, nodes: { value: null }, NH: { value: 1 }, pieces: { value: null }, PW: { value: 2 }, viewport: { value: new THREE.Vector2(1, 1) },
        uSigma: { value: 1 }, uOpacity: { value: 1 }, lightDir: { value: new THREE.Vector3(1, 1.4, 2).normalize() }, lightColor: { value: new THREE.Color(1, 1, 1) },
        ambient: { value: 0.3 }, roughness: { value: 0.35 }, shift: { value: 0.035 }, specular: { value: 0.5 }, backlit: { value: 1 }, tint: { value: new THREE.Color(1, 1, 1) },
        uSelected: { value: -1 }, uDim: { value: 1 } } });
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    g.setAttribute("corner", new THREE.Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false;
    this.lock();
  }

  get n() { return this.data.length / FLOATS; }
  set(name, v) { const u = this.mat.uniforms[name]; if (u) { if (u.value instanceof THREE.Color) u.value.set(v); else if (u.value instanceof THREE.Vector3) u.value.copy(v); else u.value = v; } }
  viewport(w, h) { this.mat.uniforms.viewport.value.set(w, h); }
  light(dir) { this.mat.uniforms.lightDir.value.copy(dir); }

  // every Gaussian into its piece: the textures rebuilt
  lock() {
    const n = this.n, L = this.lattice, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = this.data[i * FLOATS]; pos[i * 3 + 1] = this.data[i * FLOATS + 1]; pos[i * 3 + 2] = this.data[i * FLOATS + 2]; }
    const { piece, uvw } = L.lock(pos);
    this.piece = piece; this.uvw = uvw;
    const GH = Math.max(1, Math.ceil(n * 4 / GW));
    const gd = new Float32Array(GW * GH * 4);
    this.buckets = new Map();
    for (let i = 0; i < n; i++) {
      const o = i * FLOATS, b = i * 16, p = L.pieces[piece[i]];
      gd[b] = piece[i]; gd[b + 1] = uvw[i * 3]; gd[b + 2] = uvw[i * 3 + 1]; gd[b + 3] = uvw[i * 3 + 2];
      gd[b + 4] = this.data[o + 3]; gd[b + 5] = this.data[o + 4]; gd[b + 6] = this.data[o + 5]; gd[b + 7] = this.data[o + 13];
      gd[b + 8] = this.data[o + 6]; gd[b + 9] = this.data[o + 7]; gd[b + 10] = this.data[o + 8]; gd[b + 11] = this.data[o + 9];
      gd[b + 12] = this.data[o + 10]; gd[b + 13] = this.data[o + 11]; gd[b + 14] = this.data[o + 12]; gd[b + 15] = this.alive[i];
      const band = Math.min(p.rows - 2, Math.max(0, Math.floor(Math.max(0, Math.min(1, uvw[i * 3 + 1])) * (p.rows - 1))));
      const key = piece[i] * 64 + band;
      (this.buckets.get(key) || this.buckets.set(key, []).get(key)).push(i);
    }
    if (this.gtex) this.gtex.dispose();
    this.gtex = new THREE.DataTexture(gd, GW, GH, THREE.RGBAFormat, THREE.FloatType); this.gtex.needsUpdate = true;
    this.mat.uniforms.gdata.value = this.gtex; this.mat.uniforms.GH.value = GH;
    this.ids = new Float32Array(n); for (let i = 0; i < n; i++) this.ids[i] = i;
    this.idAttr = new THREE.InstancedBufferAttribute(this.ids, 1); this.idAttr.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute("aId", this.idAttr); this.geo.instanceCount = n;
    this.order = [...this.buckets.keys()];
    // the nodes' texture and the pieces'
    const NH = Math.max(1, Math.ceil(L.total / NW));
    this.ndata = new Float32Array(NW * NH * 4);
    if (this.ntex) this.ntex.dispose();
    this.ntex = new THREE.DataTexture(this.ndata, NW, NH, THREE.RGBAFormat, THREE.FloatType);
    this.mat.uniforms.nodes.value = this.ntex; this.mat.uniforms.NH.value = NH;
    const PW = L.pieces.length * 2;
    this.pdata = new Float32Array(PW * 4);
    if (this.ptex) this.ptex.dispose();
    this.ptex = new THREE.DataTexture(this.pdata, PW, 1, THREE.RGBAFormat, THREE.FloatType);
    this.mat.uniforms.pieces.value = this.ptex; this.mat.uniforms.PW.value = PW;
    this.updateNodes();
  }

  // the lattice's nodes now into the texture, and each piece's stretch and selection
  updateNodes(selected = null) {
    const L = this.lattice, D = this.ndata;
    for (const p of L.pieces) {
      for (let k = 0; k < p.nodes.length / 3; k++) { const o = (p.at + k) * 4; D[o] = p.nodes[k * 3]; D[o + 1] = p.nodes[k * 3 + 1]; D[o + 2] = p.nodes[k * 3 + 2]; }
      const s = L.stretch(p), i = L.pieces.indexOf(p), o = i * 8;
      this.pdata[o] = p.at; this.pdata[o + 1] = p.rows; this.pdata[o + 2] = s[0]; this.pdata[o + 3] = s[1];
      this.pdata[o + 4] = s[2]; this.pdata[o + 5] = selected === null || selected === p.id ? 1 : 0;
    }
    this.ntex.needsUpdate = true; this.ptex.needsUpdate = true;
  }

  // back to front by the pieces' row bands (the band's middle from the nodes, through the model matrix)
  sort(camera) {
    const L = this.lattice, V = camera.matrixWorldInverse.elements, M = this.mesh.matrixWorld.elements, keys = this.order;
    const depth = key => {
      const p = L.pieces[Math.floor(key / 64)], band = key % 64, N = p.nodes;
      let x = 0, y = 0, z = 0;
      for (let r = band; r <= band + 1; r++) for (let c = 0; c < 4; c++) { const o = (r * 4 + c) * 3; x += N[o]; y += N[o + 1]; z += N[o + 2]; }
      x /= 8; y /= 8; z /= 8;
      const wx = M[0] * x + M[4] * y + M[8] * z + M[12], wy = M[1] * x + M[5] * y + M[9] * z + M[13], wz = M[2] * x + M[6] * y + M[10] * z + M[14];
      return V[2] * wx + V[6] * wy + V[10] * wz + V[14];
    };
    keys.sort((a, b) => depth(a) - depth(b));
    let w = 0;
    for (const k of keys) for (const i of this.buckets.get(k)) this.ids[w++] = i;
    this.idAttr.needsUpdate = true;
  }

  // where every live Gaussian is now, in the model's frame (the deformed cage applied): for the brush and the bake
  positions() {
    const L = this.lattice, n = this.n, out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const p = L.pieces[this.piece[i]], q = L.map(p, this.uvw[i * 3], this.uvw[i * 3 + 1], this.uvw[i * 3 + 2]);
      out[i * 3] = q[0]; out[i * 3 + 1] = q[1]; out[i * 3 + 2] = q[2];
    }
    return out;
  }

  // the deformation baked into the Gaussians themselves (before the cage changes shape: unlock)
  bake() {
    const pos = this.positions(), L = this.lattice;
    for (let i = 0; i < this.n; i++) {
      const o = i * FLOATS, s = L.stretch(L.pieces[this.piece[i]]);
      this.data[o] = pos[i * 3]; this.data[o + 1] = pos[i * 3 + 1]; this.data[o + 2] = pos[i * 3 + 2];
      this.data[o + 3] *= s[0]; this.data[o + 4] *= s[1]; this.data[o + 5] *= s[2];
    }
  }

  // paint: Gaussians added (an array of 14-float records); erase: indices dropped. Both relock.
  add(records) {
    const extra = Float32Array.from(records), d = new Float32Array(this.data.length + extra.length);
    d.set(this.data); d.set(extra, this.data.length); this.data = d;
    const a = new Uint8Array(this.n).fill(1); a.set(this.alive); this.alive = a;
    this.lock();
  }
  erase(indices) {
    for (const i of indices) this.alive[i] = 0;
    for (const i of indices) this.gtex.image.data[i * 16 + 15] = 0;
    this.gtex.needsUpdate = true;
  }
  compact() {                                           // the erased ones really gone
    const keep = []; for (let i = 0; i < this.n; i++) if (this.alive[i]) keep.push(i);
    const d = new Float32Array(keep.length * FLOATS);
    keep.forEach((i, k) => d.set(this.data.subarray(i * FLOATS, i * FLOATS + FLOATS), k * FLOATS));
    this.data = d; this.alive = new Uint8Array(keep.length).fill(1); this.lock();
  }

  dispose() { this.geo.dispose(); this.mat.dispose(); for (const t of [this.gtex, this.ntex, this.ptex]) t && t.dispose(); }
}

// A hair splat glued to clay clumps (tools/character/gshair/clumps.py) drawn in three.js. Each clump is a short chain
// with wig.js's spring physics (pinned at the scalp, gravity, held loosely to its rest shape, kept off the head); every
// Gaussian keeps its centre, rotation and scales in its chain's frame, so the splat is rebuilt from the moving chains
// on the GPU: the chain's joints and frames go into a small float texture each step, the Gaussians sit in a big one.
// Each Gaussian is an instanced quad: the vertex shader projects its 3D covariance to the screen (the EWA Jacobian, as
// 3DGS), spans the quad over three sigmas and shades it with a hair model (the UE4 approximation of Marschner: R, TT
// and TRT lobes along the Gaussian's long axis, plus the paper's local scattering term), the fragment is the Gaussian
// falloff, composited back to front (premultiplied alpha) in the order of the chain segments' depth.
//   const h = new SplatHair(json, bin, push, scale);  h.step(dt, M, Minv, set);  h.sort(camera);  scene.add(h.mesh)
import * as THREE from "three";
import { Wig } from "./wig.js";

const GW = 2048;           // the Gaussian texture's width in texels; 5 texels per Gaussian
const VERT = `
precision highp float;
uniform sampler2D gdata; uniform float GH;
uniform sampler2D guides; uniform float J; uniform float K;
uniform vec2 viewport; uniform float uScale; uniform float uSigma; uniform float uOpacity;
uniform vec3 lightDir; uniform vec3 lightColor; uniform float ambient; uniform float roughness; uniform float shift; uniform float specular; uniform float backlit;
uniform vec3 tint;
attribute float aId; attribute vec2 corner;
varying vec2 vLocal; varying vec3 vColor; varying float vAlpha;
vec4 tex(float k) { float t = aId * 5.0 + k; float x = mod(t, ${GW}.0); float y = floor(t / ${GW}.0); return texture2D(gdata, vec2((x + 0.5) / ${GW}.0, (y + 0.5) / GH)); }
vec3 gtex(float c, float i) { return texture2D(guides, vec2((i + 0.5) / (J * 3.0), (c + 0.5) / K)).xyz; }
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
  vec4 t0 = tex(0.0), t1 = tex(1.0), t2 = tex(2.0), t3 = tex(3.0), t4 = tex(4.0);
  float clump = t0.x, u = t0.y; vec3 off = vec3(t0.z, t0.w, t1.x) * uScale; vec3 sc = t1.yzw * uScale * uSigma;
  vec4 q = t2; vec3 base = t3.xyz; float op = t3.w * uOpacity, occ = t4.x;
  float j0 = min(floor(u), J - 2.0), f = u - j0;
  vec3 p = mix(gtex(clump, j0 * 3.0), gtex(clump, j0 * 3.0 + 3.0), f);
  vec3 T = normalize(mix(gtex(clump, j0 * 3.0 + 1.0), gtex(clump, j0 * 3.0 + 4.0), f));
  vec3 N = normalize(mix(gtex(clump, j0 * 3.0 + 2.0), gtex(clump, j0 * 3.0 + 5.0), f));
  N = normalize(N - T * dot(N, T)); vec3 B = cross(T, N);
  mat3 F = mat3(T, N, B);
  vec3 centre = p + F * off;
  mat3 Rw = F * quatMat(q);
  mat3 M = mat3(Rw[0] * sc.x, Rw[1] * sc.y, Rw[2] * sc.z);
  mat3 cov = M * transpose(M);
  mat3 W = mat3(viewMatrix);
  mat3 C = W * cov * transpose(W);
  vec4 tc = viewMatrix * vec4(centre, 1.0);
  float tz = -tc.z;
  if (tz < 0.02) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); vAlpha = 0.0; vLocal = vec2(0.0); vColor = vec3(0.0); return; }
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
  // the shading: along the Gaussian's long axis
  float smax = max(sc.x, max(sc.y, sc.z));
  vec3 axis = sc.x == smax ? Rw[0] : (sc.y == smax ? Rw[1] : Rw[2]);
  vec3 V = normalize(cameraPosition - centre), L = normalize(lightDir);
  vec3 bl = pow(base * tint, vec3(2.2));
  vec3 S = hairShade(bl, L, V, axis);
  vec3 n = normalize(V - axis * dot(axis, V));
  float lum = dot(bl, vec3(0.2126, 0.7152, 0.0722)) + 1e-3;
  vec3 local = sqrt(bl) * (dot(n, L) + 1.0) / 12.566 * pow(bl / lum, vec3(occ));
  vec3 col = (S + local) * lightColor * occ + ambient * bl * occ;
  vColor = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  vAlpha = op;
}`;
const FRAG = `
precision highp float;
varying vec2 vLocal; varying vec3 vColor; varying float vAlpha;
void main() {
  float g = exp(-0.5 * dot(vLocal, vLocal));
  float a = vAlpha * g;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * a, a);
}`;

export class SplatHair {
  // json: splat.json; bin: splat.bin (ArrayBuffer); push: (p, gap) => [q, moved] in the body's frame; scale: the body's
  constructor(json, bin, push, scale = 1) {
    this.h = json; const K = json.clumps, J = json.joints, M = json.gaussians;
    const D = new Float32Array(bin);
    if (D.length !== M * 17) throw new Error(`splat.bin: ${D.length} floats for ${M} Gaussians`);
    const strands = json.guides.map(g => ({ pts: g, pin: 1, bang: false, tail: false, spin: null }));
    this.wig = new Wig(strands, push, json.head.C, scale, Math.random, 1);
    this.restN = json.frames.N;
    // the Gaussians into a texture: 5 texels each
    const GH = Math.ceil(M * 5 / GW);
    const gd = new Float32Array(GW * GH * 4);
    this.buckets = new Map();                       // (clump, segment) -> [ids]
    for (let i = 0; i < M; i++) {
      const o = i * 17, b = i * 20;
      gd.set(D.subarray(o, o + 17), b);             // clump, u, off3, scales3, quat4, rgb3, op, occ
      const key = D[o] * (J - 1) + Math.min(Math.floor(D[o + 1]), J - 2);
      (this.buckets.get(key) || this.buckets.set(key, []).get(key)).push(i);
    }
    this.gtex = new THREE.DataTexture(gd, GW, GH, THREE.RGBAFormat, THREE.FloatType); this.gtex.needsUpdate = true;
    this.data = new Float32Array(J * 3 * K * 4);
    this.tex = new THREE.DataTexture(this.data, J * 3, K, THREE.RGBAFormat, THREE.FloatType); this.tex.needsUpdate = true;
    // one quad, instanced
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    g.setAttribute("corner", new THREE.Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.ids = new Float32Array(M); for (let i = 0; i < M; i++) this.ids[i] = i;
    this.idAttr = new THREE.InstancedBufferAttribute(this.ids, 1); this.idAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aId", this.idAttr); g.instanceCount = M;
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: { gdata: { value: this.gtex }, GH: { value: GH }, guides: { value: this.tex }, J: { value: J }, K: { value: K }, viewport: { value: new THREE.Vector2(1, 1) },
        uScale: { value: 1 }, uSigma: { value: 1 }, uOpacity: { value: 1 }, lightDir: { value: new THREE.Vector3(1, 1.4, 2).normalize() }, lightColor: { value: new THREE.Color(1, 1, 1) },
        ambient: { value: 0.3 }, roughness: { value: 0.35 }, shift: { value: 0.035 }, specular: { value: 0.5 }, backlit: { value: 1 }, tint: { value: new THREE.Color(1, 1, 1) } } });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false;
    this.M = M; this.K = K; this.J = J; this.ready = false;
    this.seg = new Float32Array(K * (J - 1) * 3);
    this.order = [...this.buckets.keys()];
  }

  set(name, v) { const u = this.mat.uniforms[name]; if (u) { if (u.value instanceof THREE.Color) u.value.set(v); else if (u.value instanceof THREE.Vector3) u.value.copy(v); else u.value = v; } }
  light(dir) { this.mat.uniforms.lightDir.value.copy(dir); }
  viewport(w, h) { this.mat.uniforms.viewport.value.set(w, h); }

  // one physics step, then the chains' joints and frames into the texture (parallel transport from the root's frame)
  step(dt, M, Minv, set) {
    this.wig.step(dt, M, Minv, set);
    const { J, K } = this, P = this.wig.P, D = this.data;
    const rot = v => [M[0] * v[0] + M[4] * v[1] + M[8] * v[2], M[1] * v[0] + M[5] * v[1] + M[9] * v[2], M[2] * v[0] + M[6] * v[1] + M[10] * v[2]];
    const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    for (let c = 0; c < K; c++) {
      const at = this.wig.chains[c].at, pt = j => [P[(at + j) * 3], P[(at + j) * 3 + 1], P[(at + j) * 3 + 2]];
      let N = rot(this.restN[c][0]);
      for (let j = 0; j < J; j++) {
        const a = pt(Math.max(0, j - 1)), b = pt(Math.min(J - 1, j + 1));
        const T = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
        const d = N[0] * T[0] + N[1] * T[1] + N[2] * T[2]; N = norm([N[0] - T[0] * d, N[1] - T[1] * d, N[2] - T[2] * d]);
        const q = pt(j), o = (c * J * 3 + j * 3) * 4;
        D[o] = q[0]; D[o + 1] = q[1]; D[o + 2] = q[2]; D[o + 4] = T[0]; D[o + 5] = T[1]; D[o + 6] = T[2]; D[o + 8] = N[0]; D[o + 9] = N[1]; D[o + 10] = N[2];
        if (j < J - 1) { const n = pt(j + 1), s = (c * (J - 1) + j) * 3; this.seg[s] = (q[0] + n[0]) / 2; this.seg[s + 1] = (q[1] + n[1]) / 2; this.seg[s + 2] = (q[2] + n[2]) / 2; }
      }
    }
    this.tex.needsUpdate = true; this.ready = true;
  }

  // back to front by the chain segments' depth (a Gaussian's depth is its segment's: close enough within a clump)
  sort(camera) {
    const V = camera.matrixWorldInverse.elements, keys = this.order, seg = this.seg;
    const depth = k => { const s = k * 3, x = seg[s], y = seg[s + 1], z = seg[s + 2]; return V[2] * x + V[6] * y + V[10] * z + V[14]; };   // view z: more negative is farther
    keys.sort((a, b) => depth(a) - depth(b));
    let w = 0;
    for (const k of keys) for (const i of this.buckets.get(k)) this.ids[w++] = i;
    this.idAttr.needsUpdate = true;
  }

  measure(Minv) { return this.wig.measure(Minv); }
  local(Minv) { return this.wig.local(Minv); }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); this.tex.dispose(); this.gtex.dispose(); }
}

// the head's collision from splat.json's head (its radial field and the body's slices), in the body's frame:
// (p, gap) => [q, moved]
export function headPush(head) {
  const C = head.C, X = head.X, U = head.U, F = head.F, R = head.radii, EL = R.length, AZ = R[0].length, body = head.body;
  return (p, gap) => {
    let q = [p[0], p[1], p[2]], moved = false;
    const d = [q[0] - C[0], q[1] - C[1], q[2] - C[2]], r = Math.hypot(...d) || 1e-9;
    const el = Math.asin(Math.max(-1, Math.min(1, (d[0] * U[0] + d[1] * U[1] + d[2] * U[2]) / r)));
    const az = Math.atan2(d[0] * X[0] + d[1] * X[1] + d[2] * X[2], d[0] * F[0] + d[1] * F[1] + d[2] * F[2]);
    const a = Math.min(AZ - 1, Math.floor((az + Math.PI) / (2 * Math.PI) * AZ)), e = Math.min(EL - 1, Math.floor((el + Math.PI / 2) / Math.PI * EL));
    const Rh = R[e][a];
    if (el > -0.4 && Rh > 0 && r < Rh + gap) { const k = (Rh + gap) / r; q = [C[0] + d[0] * k, C[1] + d[1] * k, C[2] + d[2] * k]; moved = true; }
    if (body) {
      const row = Math.floor((body.y0 - q[1]) / body.step);
      if (row >= 0 && row < body.rows && body.count[row] > 0) {
        const dx = q[0] - body.mid[row][0], dz = q[2] - body.mid[row][1];
        const sec = Math.floor((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI) * body.sectors) % body.sectors;
        const Rb = body.radii[row][sec], rr = Math.hypot(dx, dz) || 1e-9;
        if (Rb > 0 && rr < Rb + gap) { const k = (Rb + gap) / rr; q[0] = body.mid[row][0] + dx * k; q[2] = body.mid[row][1] + dz * k; moved = true; }
      }
    }
    return [q, moved];
  };
}

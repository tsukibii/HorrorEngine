// Strand hair in the Character Studio, batched like an anime game's (hair_batch.py): a few hundred guide chains get the
// physics (wig.js's clumps), and every drawn strand is rebuilt from its guide on the GPU: the guides' joints and frames
// go into a small float texture each frame, each strand point keeps its offset and tangent in its guide's frame. Drawn
// as lines with a hair shader: two highlights along the strand (Kajiya-Kay), darker roots, the inside of the hair darker.
import * as THREE from "three";
import { Wig } from "./wig.js";

const VERT = `
uniform sampler2D guides; uniform float J; uniform float K;
attribute float aClump; attribute float aU; attribute float aOcc; attribute float aV;
attribute vec3 aOff; attribute vec3 aTan;
varying vec3 vTan; varying vec3 vPos; varying float vOcc; varying float vV;
vec3 tex(float i) { return texture2D(guides, vec2((i + 0.5) / (J * 3.0), (aClump + 0.5) / K)).xyz; }
void main() {
  float j0 = min(floor(aU), J - 2.0), f = aU - j0;
  vec3 p = mix(tex(j0 * 3.0), tex(j0 * 3.0 + 3.0), f);
  vec3 T = normalize(mix(tex(j0 * 3.0 + 1.0), tex(j0 * 3.0 + 4.0), f));
  vec3 N = normalize(mix(tex(j0 * 3.0 + 2.0), tex(j0 * 3.0 + 5.0), f));
  N = normalize(N - T * dot(N, T)); vec3 B = cross(T, N);
  vec3 pos = p + T * aOff.x + N * aOff.y + B * aOff.z;
  vTan = normalize(T * aTan.x + N * aTan.y + B * aTan.z); vPos = pos; vOcc = aOcc; vV = aV;
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}`;
const FRAG = `
uniform vec3 color; uniform vec3 lightDir; uniform vec3 rootDark; uniform float ambient; uniform float shine;
varying vec3 vTan; varying vec3 vPos; varying float vOcc; varying float vV;
void main() {
  vec3 T = normalize(vTan), L = normalize(lightDir), V = normalize(cameraPosition - vPos), H = normalize(L + V);
  float TL = dot(T, L), diff = sqrt(max(0.0, 1.0 - TL * TL));
  float TH1 = dot(normalize(T + 0.08 * V), H), TH2 = dot(normalize(T - 0.12 * V), H);
  float spec1 = pow(sqrt(max(0.0, 1.0 - TH1 * TH1)), 220.0) * 0.5 * shine;   // the white, sharp one
  float spec2 = pow(sqrt(max(0.0, 1.0 - TH2 * TH2)), 40.0) * 1.2 * shine;    // the coloured, broad one, shifted
  float root = 1.0 - rootDark.z * (1.0 - smoothstep(rootDark.x, rootDark.y + 0.001, vV));
  vec3 c = color * (ambient + (1.0 - ambient) * diff) * root * vOcc + (vec3(spec1) + color * spec2) * vOcc * vOcc * root;
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}`;

export class StrandHair {
  // head: batch.json; bin: batch.bin (ArrayBuffer); push: the body's collision (hair.js's, the body's frame); C: the
  // skull's middle; scale: the body's scale
  constructor(head, bin, push, C, scale) {
    this.h = head; const J = head.joints, K = head.clumps, n = head.strands, p = head.points;
    const D = new Float32Array(bin);
    // the guides become wig chains: pinned at the root (two joints: the scalp holds the start of a lock)
    const strands = head.guides.map(g => ({ pts: g, pin: 2, bang: false, tail: false, spin: null }));
    this.wig = new Wig(strands, push, C, scale, Math.random, 1);
    this.restT = head.frames.T; this.restN = head.frames.N;
    // the lines: every segment of every strand drawn, its two ends
    const segs = n * (p - 1), A = (k, size) => new Float32Array(segs * 2 * size);
    const aClump = A(0, 1), aU = A(0, 1), aOcc = A(0, 1), aV = A(0, 1), aOff = A(0, 3), aTan = A(0, 3);
    let w = 0;
    for (let s = 0; s < n; s++) for (let k = 0; k + 1 < p; k++) for (const q of [k, k + 1]) {
      const i = (s * p + q) * 9;
      aClump[w] = D[i]; aU[w] = D[i + 1]; aOff.set(D.subarray(i + 2, i + 5), w * 3); aTan.set(D.subarray(i + 5, i + 8), w * 3);
      aOcc[w] = D[i + 8]; aV[w] = q / (p - 1); w++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs * 2 * 3), 3));   // unused: the shader places them
    for (const [name, arr, size] of [["aClump", aClump, 1], ["aU", aU, 1], ["aOcc", aOcc, 1], ["aV", aV, 1], ["aOff", aOff, 3], ["aTan", aTan, 3]])
      g.setAttribute(name, new THREE.BufferAttribute(arr, size));
    this.data = new Float32Array(J * 3 * K * 4);
    this.tex = new THREE.DataTexture(this.data, J * 3, K, THREE.RGBAFormat, THREE.FloatType);
    this.tex.needsUpdate = true;
    const c = head.colour, rd = c.root_dark;
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: {
      guides: { value: this.tex }, J: { value: J }, K: { value: K }, color: { value: new THREE.Color(...c.rgb.map(v => Math.pow(v, 2.2))) },
      lightDir: { value: new THREE.Vector3(1, 1.4, 2).normalize() }, rootDark: { value: new THREE.Vector3(rd.start, rd.end, rd.strength) },
      ambient: { value: 0.35 }, shine: { value: 0.35 } } });
    this.mesh = new THREE.LineSegments(g, this.mat); this.mesh.frustumCulled = false;
    this.ready = false;
  }

  setColor(hex) { this.mat.uniforms.color.value.set(hex).convertSRGBToLinear(); }
  get colorHex() { const c = this.h.colour.rgb.map(v => Math.round(Math.min(1, v) * 255)); return "#" + c.map(v => v.toString(16).padStart(2, "0")).join(""); }

  // one physics step, then the guides' joints and frames into the texture (parallel transport from the root's frame,
  // turned with the body)
  step(dt, M, Minv, set) {
    this.wig.step(dt, M, Minv, set);
    const { J, K } = { J: this.h.joints, K: this.h.clumps }, P = this.wig.P, D = this.data;
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
      }
    }
    this.tex.needsUpdate = true; this.ready = true;
  }

  light(dir) { this.mat.uniforms.lightDir.value.copy(dir); }
  measure(Minv) { return this.wig.measure(Minv); }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); this.tex.dispose(); }
}

// The salon's hair shader (docs/SALON.md, The look): the strand atlas (hairtex.js) on the cards, lit like hair. Two
// highlights after Kajiya and Kay, each strand's tangent shifted along the card's normal (Scheuermann's trick from
// ATI's hair, as Unreal's and most games' hair do): a sharp pale one shifted towards the root, a broad tinted one
// towards the tip, every strand's shift its own so the highlights break into streaks. Soft wrapped diffuse, dark roots,
// the inner colour on the strands the atlas picks, a cool rim. Cut out softly (alpha to coverage).
//
//   const U = hairUniforms(atlasTexture, look)   shared by every hair material; applyLook(U, look) restyles them all
//   hairMaterial(U)   the cards' material
//   lightHair(U, keyDir, keyColour, fillDir, fillColour)   each frame, the world's light directions
import * as THREE from "three";
import { linear } from "./hairtex.js";

const VERT = /* glsl */`
attribute vec3 aTangent;
attribute vec4 aTint;
attribute float aDepth;
varying vec3 vN; varying vec3 vT; varying vec3 vW; varying vec2 vUv; varying vec4 vTint; varying float vOcc;
void main() {
  vOcc = 0.42 + 0.58 * smoothstep(0.002, 0.028, aDepth);          // inner layers (near the skin) in the outer ones' shade
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal); vT = normalize(mat3(modelMatrix) * aTangent);
  vUv = uv; vTint = aTint;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FRAG = /* glsl */`
uniform sampler2D atlas;
uniform vec3 rootC, tipC, innerC, spec1C, spec2C, rimC, keyDir, keyC, fillDir, fillC, ambientC;
uniform float innerAmt, shine, gloss1, gloss2, shift1, shift2, shiftNoise, rimAmt, rootLen, alphaCut;
varying vec3 vN; varying vec3 vT; varying vec3 vW; varying vec2 vUv; varying vec4 vTint; varying float vOcc;
float kk(vec3 T, vec3 H, float g) { float th = dot(T, H); return pow(sqrt(max(0.0, 1.0 - th * th)), g); }
void main() {
  vec4 at = texture2D(atlas, vUv); float v = vUv.y;
  if (at.a < alphaCut * 0.4) discard;
  vec3 V = normalize(cameraPosition - vW);
  vec3 N = normalize(vN); if (dot(N, V) < 0.0) N = -N;
  vec3 T = normalize(vT);
  float root = smoothstep(0.0, rootLen, v);
  vec3 base = mix(rootC, tipC, root) * (0.45 + 0.55 * at.r) * (0.6 + 0.8 * at.b);   // each strand, each clump its own shade
  float inner = step(1.0 - innerAmt, at.g) * step(0.001, innerAmt);
  base = mix(base, innerC * (0.7 + 0.3 * at.r) * mix(0.4, 1.0, root), inner);
  base = mix(base, vTint.rgb * (0.45 + 0.55 * at.r) * mix(0.45, 1.0, root), vTint.a);   // a lock's own colour, or the debug colours
  float sh = (at.g - 0.5) * shiftNoise + (at.b - 0.5) * shiftNoise * 0.6;
  vec3 T1 = normalize(T + N * (shift1 + sh)), T2 = normalize(T + N * (shift2 + sh));
  vec3 col = ambientC * base;
  for (int i = 0; i < 2; i++) {
    vec3 L = i == 0 ? keyDir : fillDir; vec3 Lc = i == 0 ? keyC : fillC;
    float NdL = dot(N, L), diff = clamp((NdL + 0.6) / 1.6, 0.0, 1.0), vis = smoothstep(-0.25, 0.35, NdL);
    vec3 H = normalize(L + V);
    float s1 = kk(T1, H, gloss1), s2 = kk(T2, H, gloss2) * (0.35 + 0.65 * at.b);
    vec3 spec = (spec1C * s1 * 0.6 + mix(spec2C, innerC * 0.8, inner) * s2 * 0.3) * shine * (i == 0 ? 1.0 : 0.3);   // the fill light's highlights faint
    col += Lc * (base * diff + vis * spec * mix(0.25, 1.0, root) * vOcc);
  }
  // a soft sheen from where you look (a studio's light all round), broken into streaks clump by clump
  float sv = kk(normalize(T + N * (shift2 + sh)), V, 18.0) * (0.15 + 0.85 * at.b * at.b);
  col += mix(spec2C, innerC * 0.8, inner) * sv * 0.35 * shine * mix(0.3, 1.0, root) * vOcc;
  col *= vOcc;
  col += rimC * rimAmt * pow(1.0 - abs(dot(N, V)), 3.0) * (0.5 + 0.5 * at.r) * vOcc;
  float alpha = smoothstep(alphaCut - 0.15, alphaCut + 0.15, at.a);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const C = hex => new THREE.Color().setRGB(...linear(hex), THREE.LinearSRGBColorSpace);
export function hairUniforms(atlas, look) {
  const U = {
    atlas: { value: atlas }, rootC: { value: new THREE.Color() }, tipC: { value: new THREE.Color() }, innerC: { value: new THREE.Color() },
    spec1C: { value: new THREE.Color() }, spec2C: { value: new THREE.Color() }, rimC: { value: new THREE.Color() },
    innerAmt: { value: 0 }, shine: { value: 1 }, gloss1: { value: 120 }, gloss2: { value: 24 }, shift1: { value: -0.06 }, shift2: { value: 0.1 },
    shiftNoise: { value: 0.4 }, rimAmt: { value: 0.15 }, rootLen: { value: 0.3 }, alphaCut: { value: 0.4 },
    keyDir: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() }, keyC: { value: new THREE.Color(1.15, 1.12, 1.08) },
    fillDir: { value: new THREE.Vector3(-0.6, 0.1, 0.3).normalize() }, fillC: { value: new THREE.Color(0.28, 0.31, 0.38) }, ambientC: { value: new THREE.Color(0.22, 0.22, 0.24) },
  };
  applyLook(U, look);
  return U;
}
export function applyLook(U, k) {
  U.rootC.value.copy(C(k.root)); U.tipC.value.copy(C(k.tip)); U.innerC.value.copy(C(k.inner));
  U.spec1C.value.copy(C(k.spec1)); U.spec2C.value.copy(C(k.spec2)); U.rimC.value.copy(C(k.rim));
  U.innerAmt.value = k.innerAmount; U.shine.value = k.shine; U.gloss1.value = k.gloss1; U.gloss2.value = k.gloss2;
  U.shift1.value = k.shift1; U.shift2.value = k.shift2; U.shiftNoise.value = k.shiftNoise; U.rimAmt.value = k.rimAmount; U.rootLen.value = k.rootLength;
}
export function lightHair(U, keyDir, keyColour, fillDir, fillColour) {
  U.keyDir.value.copy(keyDir).normalize(); U.fillDir.value.copy(fillDir).normalize();
  if (keyColour) U.keyC.value.copy(keyColour); if (fillColour) U.fillC.value.copy(fillColour);
}
export function hairMaterial(U, o = {}) {
  const m = new THREE.ShaderMaterial({ uniforms: Object.assign({}, U), vertexShader: VERT, fragmentShader: FRAG,
    side: THREE.DoubleSide, alphaToCoverage: true, transparent: !!o.transparent, opacity: o.opacity ?? 1 });
  m.userData.hair = true;
  return m;
}
// a texture from the atlas bytes (data) or the baked albedo (for the glTF: a canvas, which the exporter can write as PNG)
export function atlasTexture(atlas) {
  const t = new THREE.DataTexture(atlas.data, atlas.W, atlas.H, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.flipY = false;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  return t;
}
export function albedoTexture(atlas, rgba) {
  const c = document.createElement("canvas"); c.width = atlas.W; c.height = atlas.H;
  c.getContext("2d").putImageData(new ImageData(rgba, atlas.W, atlas.H), 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.flipY = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

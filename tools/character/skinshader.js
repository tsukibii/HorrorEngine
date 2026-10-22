// Procedural skin for the Character Studio: the body's colour and fine relief made in the shader from where each point
// sits on the body (its rest position, metres), so there are no UV seams. Every feature is its own layer with its own
// amount: mottling (the blotchy red under the skin), grain, pores (darker dots and a little relief, strongest on the
// nose and cheeks), freckles (where: the nose and cheeks, or spreading over the body), flush (cheeks, nose, ears), faint
// veins, and translucency (a red glow where light passes through: rims, ears). With a photo skin, its coverage mask
// lays the picture over the face and the procedural skin carries the rest; how much of each is its own slider.
// The technique follows the usual layered-noise skins (Vulpinii/skin-texture among them); the code here is ours.
import * as THREE from "three";

export const FEATURES = [   // [key, label, lo, hi, step, default, help]
  ["mottle", "Mottling", 0, 1, 0.01, 0.45, "Blotches of red under the skin, a few centimetres across."],
  ["grain", "Grain", 0, 1, 0.01, 0.35, "Fine light and dark variation, about a millimetre."],
  ["pores", "Pores", 0, 1, 0.01, 0.4, "Darker dots with a little relief; strongest on the nose and cheeks."],
  ["poreSize", "Pore spacing (mm)", 0.6, 4, 0.1, 1.6, "Smaller is finer; they fade out when they get smaller than a pixel."],
  ["freckles", "Freckles", 0, 1, 0.01, 0, "How many."],
  ["freckleSize", "Freckle size (mm)", 1, 8, 0.1, 3, ""],
  ["spread", "Freckle spread", 0, 1, 0.01, 0.15, "0 the nose and cheeks only, 1 everywhere."],
  ["flush", "Flush", 0, 1, 0.01, 0.35, "Redder cheeks, nose and ears."],
  ["veins", "Veins", 0, 1, 0.01, 0.1, "Faint blue lines under thin skin."],
  ["translucency", "Translucency", 0, 1, 0.01, 0.35, "Red light through the skin at the rims and the ears."],
  ["photo", "Photo on the face", 0, 1, 0.01, 1, "With a photo skin: how much of the picture shows inside its mask."],
  ["over", "Procedural over the photo", 0, 1, 0.01, 0.35, "How much of the procedural detail (pores, grain) shows on the photo."],
];
export const DEFAULTS = { on: false, ...Object.fromEntries(FEATURES.map(f => [f[0], f[5]])), freckleColor: "#8a5a3c", flushColor: "#c4555a" };

const COMMON = `
uniform float uProc, uMottle, uGrain, uPores, uPoreSize, uFreckles, uFreckleSize, uSpread, uFlush, uVeins, uSSS, uPhoto, uOver, uHasPhoto;
uniform vec3 uTone, uFreckleCol, uFlushCol, uNose, uCheekL, uCheekR, uEarL, uEarR, uFaceC;
uniform float uScale;
uniform sampler2D uPhotoMap, uPhotoMask;
varying vec3 vObj; varying vec2 vSkinUv;
float skinH;
float h31(vec3 p) { p = fract(p * vec3(0.1031, 0.1137, 0.1279)); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 h33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.9375; }
// the distance to the nearest of one random point per cell, and that cell's own random number
vec2 cells(vec3 p) {
  vec3 i = floor(p), f = fract(p); float d = 9.0, id = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(x, y, z), c = i + o, q = o + h33(c) - f; float e = dot(q, q);
    if (e < d) { d = e; id = h31(c + 7.7); }
  }
  return vec2(sqrt(d), id);
}
float near(vec3 p, vec3 c, float r) { vec3 d = (p - c) / (r * uScale); return exp(-dot(d, d)); }
vec3 proceduralSkin(vec3 base, vec3 p) {
  float px = length(fwidth(p));                                     // metres per pixel here: fine detail fades below it
  float face = near(p, uFaceC, 0.09);
  float tzone = max(near(p, uNose, 0.025), max(near(p, uCheekL, 0.035), near(p, uCheekR, 0.035)));
  vec3 c = base;
  float m = smoothstep(0.42, 0.78, fbm(p * 22.0));                  // mottling
  c = mix(c, c * vec3(1.08, 0.86, 0.84), uMottle * m);
  float gfade = 1.0 - smoothstep(0.0006, 0.0015, px);
  float g = vnoise(p * 900.0) - 0.5;                                 // grain
  c *= 1.0 + g * 0.14 * uGrain * gfade;
  float ps = uPoreSize * 0.001, pfade = 1.0 - smoothstep(ps * 0.35, ps * 0.9, px);
  vec2 pc = cells(p / ps);                                           // pores
  float pore = (1.0 - smoothstep(0.05, 0.3, pc.x)) * step(0.25, pc.y) * (0.45 + 0.55 * max(tzone, face * 0.6)) * pfade;
  c *= 1.0 - 0.1 * uPores * pore;                                    // mostly relief: only a little darker
  skinH = -pore * uPores;
  float fs = uFreckleSize * 0.001; vec2 fc = cells(p / fs + 3.1);    // freckles
  float where = mix(max(tzone, near(p, uNose, 0.05)) * face, 1.0, uSpread);
  float edge = fc.x + 0.35 * (vnoise(p / fs * 2.5) - 0.5);           // soft, uneven edges
  float spot = (1.0 - smoothstep(0.2, 0.55, edge)) * step(1.0 - uFreckles * 0.7, fc.y) * where;
  c = mix(c, uFreckleCol, clamp(spot * (0.25 + 0.45 * h31(floor(p / fs + 3.1))), 0.0, 1.0) * step(0.001, uFreckles));
  float fl = max(max(near(p, uCheekL, 0.03), near(p, uCheekR, 0.03)), max(near(p, uNose, 0.016) * 0.8, max(near(p, uEarL, 0.025), near(p, uEarR, 0.025))));
  c = mix(c, c * uFlushCol * 1.6, uFlush * fl * 0.5);                 // flush
  float v = 1.0 - abs(fbm(p * 38.0) * 2.0 - 1.0);                    // veins: thin ridges of the noise
  c = mix(c, c * vec3(0.78, 0.86, 1.08), uVeins * pow(v, 10.0) * 0.8);
  return c;
}`;

// the material's shader, with the skin added; uniforms are shared so sliders only change numbers
export function procedural(material) {
  const u = {
    uProc: { value: 0 }, uMottle: { value: 0 }, uGrain: { value: 0 }, uPores: { value: 0 }, uPoreSize: { value: 1.6 }, uFreckles: { value: 0 },
    uFreckleSize: { value: 3 }, uSpread: { value: 0 }, uFlush: { value: 0 }, uVeins: { value: 0 }, uSSS: { value: 0 }, uPhoto: { value: 1 },
    uOver: { value: 0.35 }, uHasPhoto: { value: 0 }, uTone: { value: new THREE.Color() }, uFreckleCol: { value: new THREE.Color() },
    uFlushCol: { value: new THREE.Color() }, uNose: { value: new THREE.Vector3() }, uCheekL: { value: new THREE.Vector3() },
    uCheekR: { value: new THREE.Vector3() }, uEarL: { value: new THREE.Vector3() }, uEarR: { value: new THREE.Vector3() },
    uFaceC: { value: new THREE.Vector3() }, uScale: { value: 1 }, uPhotoMap: { value: null }, uPhotoMask: { value: null } };
  material.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec2 skinUv; varying vec3 vObj; varying vec2 vSkinUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position; vSkinUv = skinUv;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + COMMON)
      .replace("#include <color_fragment>", `skinH = 0.0;
if (uProc > 0.5) {
  vec3 base = uTone;
  vec3 skinP = proceduralSkin(base, vObj);
  if (uHasPhoto > 0.5) {                                             // the picture inside its mask, the procedural skin outside
    vec3 ph = texture2D(uPhotoMap, vSkinUv).rgb;
    float mk = texture2D(uPhotoMask, vSkinUv).r * uPhoto;
    vec3 detail = proceduralSkin(ph, vObj) / max(ph, vec3(0.02));     // the procedural detail as a ratio, laid on the photo
    vec3 phd = ph * mix(vec3(1.0), detail, uOver);
    skinH *= mix(1.0, uOver, mk);
    diffuseColor.rgb = mix(skinP, phd, mk);
  } else diffuseColor.rgb = skinP;
}
#include <color_fragment>`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
if (uProc > 0.5) {                                                   // the pores' relief, from how the height changes across the pixel
  vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), r1 = cross(sy, normal), r2 = cross(normal, sx);
  float det = dot(sx, r1); vec2 dh = vec2(dFdx(skinH), dFdy(skinH)) * 0.0004;
  normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
if (uProc > 0.5) {                                                   // light through the skin: the rims, the ears
  float rim = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 2.5);
  float ears = max(near(vObj, uEarL, 0.03), near(vObj, uEarR, 0.03));
  totalEmissiveRadiance += vec3(0.55, 0.12, 0.08) * uSSS * (0.35 * rim + 0.5 * ears) * diffuseColor.rgb;
}`);
  };
  material.customProgramCacheKey = () => "studio-skin";
  return u;
}

// the settings into the uniforms; landmarks (lm(i): a point on the body now) place the flush and the pores' T-zone
export function update(u, set, tone, lm, scale) {
  u.uProc.value = set.on ? 1 : 0;
  u.uMottle.value = set.mottle; u.uGrain.value = set.grain; u.uPores.value = set.pores; u.uPoreSize.value = set.poreSize;
  u.uFreckles.value = set.freckles; u.uFreckleSize.value = set.freckleSize; u.uSpread.value = set.spread; u.uFlush.value = set.flush;
  u.uVeins.value = set.veins; u.uSSS.value = set.translucency; u.uPhoto.value = set.photo; u.uOver.value = set.over;
  u.uTone.value.set(tone).convertSRGBToLinear(); u.uFreckleCol.value.set(set.freckleColor).convertSRGBToLinear();
  u.uFlushCol.value.set(set.flushColor).convertSRGBToLinear(); u.uScale.value = scale;
  if (lm) {
    const v = i => new THREE.Vector3(...lm(i));
    u.uNose.value.copy(v(4)); u.uCheekL.value.copy(v(425)); u.uCheekR.value.copy(v(205));
    const out = (a, b) => v(a).add(v(a).sub(v(b)).multiplyScalar(0.12)).add(new THREE.Vector3(0, 0, -0.02 * scale));
    u.uEarL.value.copy(out(454, 234)); u.uEarR.value.copy(out(234, 454));
    u.uFaceC.value.copy(v(4).add(v(10)).multiplyScalar(0.5));
  }
}

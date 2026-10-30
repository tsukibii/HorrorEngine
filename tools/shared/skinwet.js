// skinwet.js: the story's `skin` word on a three.js skin (STORY_FORMAT §9.8; the Godot side is the look plugin's
// skin_wet.gdshader, GODOT_LOOK §5, the same maths): a wet layer over a MeshStandardMaterial or MeshPhysicalMaterial,
// the desk's clay MHR body, a Studio export's skin (over its skinLit) or the figure of cylinders.
// - wet (0..1): a sweat film: a sheen everywhere (the roughness down to 40 % of its own), the skin a touch darker;
// - sweat (0..1): beads standing on the skin (little domes over the UV, each a glint: roughness near zero, the normal
//   bent over the dome);
// - drips (0..1): runs down the skin (down the UV's v), wet inside;
// - oil (0..1): oiled up (a smooth gloss over all of it, the colour deeper).
// The gloss is water's and oil's own 4 % reflection (swGloss, read by skinlight.js's highlight when both are on).
//
//   SKIN_WET                 the settings' defaults (and sweat's scale: beads per UV unit, their size)
//   skinWet(material)        patch the material (after its own onBeforeCompile); returns its uniforms
//   setSkinWet(material, s)  its settings ({wet, sweat, drips, oil}, any subset)
//   wetOf(material)          what it wears now

export const SKIN_WET = { wet: 0, sweat: 0, drips: 0, oil: 0, scale: 160, size: 0.5, oilRough: 0.14 };

const PARS = `
#define SW_GLOSS
uniform float swWet, swSweat, swDrips, swOil, swScale, swSize, swOilRough;
float swGloss = 0.0;
vec2 swSlope = vec2(0.0);
float swHash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 swHash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float swBeads(vec2 uv, out vec2 slope) {               // cells over the UV, a dome in some: its coverage, the dome's slope
  slope = vec2(0.0);
  if (swSweat <= 0.0) return 0.0;
  vec2 q = uv * swScale, i = floor(q);
  float best = 0.0;
  for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
    vec2 cell = i + vec2(float(dx), float(dy)), h = swHash22(cell);
    if (h.x > swSweat * 0.85) continue;
    vec2 centre = cell + 0.2 + 0.6 * swHash22(cell + 3.1);
    float rad = (0.12 + 0.3 * h.y) * swSize * 0.9;
    vec2 d = q - centre; float r = length(d);
    float cover = 1.0 - smoothstep(rad - 0.04, rad, r);
    if (cover > best) { best = cover; float t = clamp(r / max(rad, 1e-3), 0.0, 1.0); slope = (r > 1e-4 ? d / r : vec2(0.0)) * t * cover; }
  }
  return best;
}
float swDripsAt(vec2 uv) {                             // lanes along u, each a streak of some length from a start
  if (swDrips <= 0.0) return 0.0;
  float lanes = 40.0, lane = floor(uv.x * lanes), h = swHash12(vec2(lane, 11.0));
  if (h > swDrips * 0.7) return 0.0;
  float lx = fract(uv.x * lanes) - 0.5, w = 0.08 + 0.1 * swHash12(vec2(lane, 5.0));
  float top = swHash12(vec2(lane, 9.0)) * 0.6, len = 0.15 + 0.45 * swHash12(vec2(lane, 7.0));
  float inlane = 1.0 - smoothstep(w * 0.7, w, abs(lx + 0.04 * sin(uv.y * 60.0 + lane)));
  float inlen = smoothstep(top, top + 0.05, uv.y) * (1.0 - smoothstep(top + len - 0.05, top + len, uv.y));
  return inlane * inlen;
}
`;
const LAYER = `
{
  #ifdef USE_UV
    vec2 swUv = vUv;
  #else
    vec2 swUv = vec2(0.0);
  #endif
  vec2 swS; float swBead = swBeads(swUv, swS), swRun = swDripsAt(swUv);
  float swFilm = clamp(swWet + swRun * 0.9, 0.0, 1.0), swG = max(swFilm * 0.75, swOil);
  diffuseColor.rgb *= mix(1.0, 0.86, swFilm);                                              // wet skin reads darker
  diffuseColor.rgb = mix(diffuseColor.rgb, pow(diffuseColor.rgb, vec3(1.18)) * 1.04, swOil);   // oil: the colour deeper
  roughnessFactor *= mix(1.0, 0.4, swFilm);
  roughnessFactor = mix(roughnessFactor, swOilRough, swOil * 0.85);
  roughnessFactor = mix(roughnessFactor, 0.03, swBead);
  swGloss = max(swBead, swG); swSlope = swS * 0.45;
}
`;
const BUMP = `
if (swSlope.x != 0.0 || swSlope.y != 0.0) {           // the beads' domes on the normal (a frame from the screen's derivatives: the beads are tiny)
  vec3 swT = normalize(dFdx(-vViewPosition)), swB = normalize(cross(normal, swT));
  normal = normalize(normal + swT * swSlope.x + swB * swSlope.y);
}
`;

export function skinWet(material) {
  if (material.userData.skinWet) return material.userData.skinWet;
  const u = { swWet: { value: SKIN_WET.wet }, swSweat: { value: SKIN_WET.sweat }, swDrips: { value: SKIN_WET.drips }, swOil: { value: SKIN_WET.oil },
              swScale: { value: SKIN_WET.scale }, swSize: { value: SKIN_WET.size }, swOilRough: { value: SKIN_WET.oilRough } };
  const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey;
  material.onBeforeCompile = function (shader, renderer) {
    if (prev) prev.call(this, shader, renderer);
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + PARS)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n" + LAYER)
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n" + BUMP);
  };
  material.customProgramCacheKey = () => (prevKey ? prevKey.call(material) : "") + "|skinwet1";
  material.defines = Object.assign({}, material.defines, { USE_UV: "" });    // the beads and the drips live on the UV
  material.userData.skinWet = u;
  material.needsUpdate = true;
  return u;
}

export function setSkinWet(material, s = {}) {
  const u = material.userData.skinWet; if (!u) return;
  for (const [k, n] of [["wet", "swWet"], ["sweat", "swSweat"], ["drips", "swDrips"], ["oil", "swOil"], ["scale", "swScale"], ["size", "swSize"]])
    if (s[k] !== undefined && s[k] !== null) u[n].value = Math.max(0, +s[k]);
}

export const wetOf = material => { const u = material.userData.skinWet; return u ? { wet: u.swWet.value, sweat: u.swSweat.value, drips: u.swDrips.value, oil: u.swOil.value } : null; };

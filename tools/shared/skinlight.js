// skinlight.js: skin lit the way HumanShaders' skin shader lights it (github.com/matmadness/HumanShaders, MIT,
// Copyright (c) 2025 MatMADNESS: its lighting rebuilt here for three.js; none of its textures or head scans), for the
// Character Studio's skin and a Studio export's skin on the desk (DECISIONS 2026-10-28, back). Over three's physical
// lights, each light:
// - lights the skin per colour through normals smoothed by different amounts (red the smoothest: red light travels
//   furthest under the skin before it comes out again), each wrapped past the terminator by a smoothstep, so a
//   shadow's edge is soft and warm, not grey;
// - shines through the thin parts (ears, nostrils, fingers, lips) toward the eye, coloured by a ramp from dark red to
//   orange (translucency);
// - gives two GGX highlights, the second broader (the skin's fine roughness under the oil), from Specular's f0.
// The light from the room (the environment), the clear coat (the oily T-zone, glass skin) and the shadows stay three's.
//
//   SKIN_LIT                 the settings and their defaults: smooth (0..10: how far each colour's normal is smoothed),
//                            fall (0.7..2: the falloff's softness), spec (0..1), double (the second highlight), trans
//                            (0..2: translucency), wrap (0..1: how far light reaches past the terminator), on; and two
//                            for the game alone (Godot's HSSkin, docs/GODOT_LOOK.md §5g; drawn here as before): depth
//                            (0..3: the skin's depth layer, warm light from under the skin round the eyes, the nose,
//                            the mouth and the ears; 0 off) and ears (1: the ears share it; 0 for hair over them)
//   skinLit(material, o)     patch a MeshStandardMaterial or MeshPhysicalMaterial (after its own onBeforeCompile):
//                            o.thin "attr" (a per-vertex `skinThin`, 0 thick .. 1 thin) or "map" (the metalness map's
//                            blue: an export's ORM, its metalness 0); returns its uniforms
//   setSkinLit(material, s)  its settings (a studioSkin record, or SKIN_LIT's keys)
//   recordOf(s)              the settings as an export carries them (extras.studioSkin)

export const SKIN_LIT = { on: 1, smooth: 5, fall: 1, spec: 0.5, double: 1, trans: 0.75, wrap: 0.5, depth: 1, ears: 1 };
export const SKIN_LIT_VERSION = 1;

const PARS = `
uniform float slOn, slSmooth, slFall, slSpec, slDouble, slTrans, slWrap;
vec3 slSmoothN;
float slThin;
vec3 slRamp(float x) {                                 // the translucency's colour: black, deep red, orange (HumanShaders' gradient)
  x = clamp(x, 0.0, 1.0);
  return x < 0.2 ? mix(vec3(0.0), vec3(0.9987, 0.0, 0.0899), x / 0.2) : mix(vec3(0.9987, 0.0, 0.0899), vec3(1.0, 0.4545, 0.0101), (x - 0.2) / 0.8);
}
float slDGGX(float NdotH, float a) { float a2 = a * a, d = 1.0 + (a2 - 1.0) * NdotH * NdotH; return a2 / (PI * d * d); }
float slGGGX(float NdotL, float NdotV, float a) { return 0.5 / max(1e-4, mix(2.0 * NdotL * NdotV, NdotL + NdotV, a)); }
void RE_Direct_Skin(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
  if (slOn < 0.5) { RE_Direct_Physical(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight); return; }
  vec3 L = directLight.direction, N = geometryNormal, V = geometryViewDir;
  float k = clamp(slSmooth / 10.0, 0.0, 1.0);          // each colour's normal toward the surface's own (no pores, no relief)
  vec3 nr = normalize(mix(N, slSmoothN, k)), ng = normalize(mix(N, slSmoothN, k * 0.8)), nb = normalize(mix(N, slSmoothN, k * 0.7));
  float w = slWrap, f = slFall;
  vec3 wrapped = vec3(smoothstep(0.4 / f, 1.2 * f, dot(nr, L) * w + 1.0 - w),
                      smoothstep(0.425 / f, 1.2 * f, dot(ng, L) * w + 1.0 - w),
                      smoothstep(0.44 / f, 1.2 * f, dot(nb, L) * w + 1.0 - w));
  reflectedLight.directDiffuse += wrapped * directLight.color * BRDF_Lambert(material.diffuseColor);
  float td = dot(V, -(L + N * 0.4));                   // light coming through toward the eye
  if (td > 0.0 && slTrans > 0.0) reflectedLight.directDiffuse += td * slRamp(slThin * td * slTrans) * directLight.color * BRDF_Lambert(material.diffuseColor);
  #ifdef USE_CLEARCOAT
    float dotNLcc = saturate(dot(geometryClearcoatNormal, L));
    clearcoatSpecularDirect += dotNLcc * directLight.color * BRDF_GGX_Clearcoat(L, V, geometryClearcoatNormal, material);
  #endif
  vec3 H = normalize(V + L);
  float NdotL = saturate(dot(N, L)), NdotV = saturate(dot(N, V)), NdotH = saturate(dot(N, H)), LdotH = saturate(dot(L, H));
  #ifdef SW_GLOSS
    vec3 f0 = vec3(0.04 * mix(slSpec * slSpec, 1.0, swGloss));   // the wet layer's own 4 % (skinwet.js) where it lies
  #else
    vec3 f0 = vec3(0.04 * slSpec * slSpec);
  #endif
  float f90 = clamp(50.0 * f0.g, 0.0, 1.0), m = 1.0 - LdotH, m5 = m * m * m * m * m;
  vec3 F = f0 + (f90 - f0) * m5;
  float a = material.roughness * material.roughness;
  vec3 spec = NdotL * slDGGX(NdotH, a) * slGGGX(NdotL, NdotV, a) * F;
  if (slDouble > 0.5) spec = mix(NdotL * slDGGX(NdotH, a + 0.3) * slGGGX(NdotL, NdotV, a + 0.3) * F, spec, 0.6) * 2.0;
  reflectedLight.directSpecular += max(spec, 0.0) * directLight.color;
}
#undef RE_Direct
#define RE_Direct RE_Direct_Skin
`;

export function skinLit(material, o = {}) {
  const thin = o.thin === "map" ? "map" : "attr";
  const u = { slOn: { value: SKIN_LIT.on }, slSmooth: { value: SKIN_LIT.smooth }, slFall: { value: SKIN_LIT.fall }, slSpec: { value: SKIN_LIT.spec },
              slDouble: { value: SKIN_LIT.double }, slTrans: { value: SKIN_LIT.trans }, slWrap: { value: SKIN_LIT.wrap } };
  const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey;
  material.onBeforeCompile = function (shader, renderer) {
    if (prev) prev.call(this, shader, renderer);
    Object.assign(shader.uniforms, u);
    if (thin === "attr") {
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float skinThin;\nvarying float vSlThin;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSlThin = skinThin;");
    }
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>" + (thin === "attr" ? "\nvarying float vSlThin;" : ""))
      .replace("#include <lights_physical_pars_fragment>", "#include <lights_physical_pars_fragment>\n" + PARS)
      .replace("#include <lights_fragment_begin>", `slSmoothN = nonPerturbedNormal;
${thin === "attr" ? "slThin = vSlThin;" : "#ifdef USE_METALNESSMAP\n slThin = texture2D(metalnessMap, vMetalnessMapUv).b;\n#else\n slThin = 0.0;\n#endif"}
#include <lights_fragment_begin>`);
  };
  material.customProgramCacheKey = () => (prevKey ? prevKey.call(material) : "") + "|skinlit-" + thin + SKIN_LIT_VERSION;
  material.userData.skinLit = u;
  material.needsUpdate = true;
  return u;
}

export function setSkinLit(material, s = {}) {
  const u = material.userData.skinLit; if (!u) return;
  for (const [k, n] of [["on", "slOn"], ["smooth", "slSmooth"], ["fall", "slFall"], ["spec", "slSpec"], ["double", "slDouble"], ["trans", "slTrans"], ["wrap", "slWrap"]])
    if (s[k] !== undefined && s[k] !== null) u[n].value = +s[k];
}

export const recordOf = s => Object.assign({ version: SKIN_LIT_VERSION }, Object.fromEntries(Object.keys(SKIN_LIT).map(k => [k, s[k] ?? SKIN_LIT[k]])));

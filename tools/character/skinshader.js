// Procedural skin for the Character Studio: the body's colour and fine relief made in the shader from where each point
// sits on the body (its rest position, metres), so there are no UV seams. Every feature is its own layer with its own
// amount, in four groups: skin (mottling, grain, pores, freckles, flush, veins, translucency, evenness, a dewy glow on
// the high planes, an oily T-zone), age (a sallow, duller, rougher skin with bigger pores, wrinkles placed from the face's
// landmarks: forehead, frown lines, crow's feet, smile lines, marionette lines, under the eyes; age spots), makeup
// (foundation, blush from the cheekbone to under the eyes, lips with a gradient and gloss, eyeliner with a wing,
// eyeshadow, aegyo-sal) and the photo (laid on the face through its coverage mask). Roughness and a clear coat change
// across the face too (the material is MeshPhysicalMaterial). Presets in docs/research/skin.md. Our own code.
import * as THREE from "three";

export const FEATURES = [   // [key, label, lo, hi, step, default, help, group]
  ["mottle", "Mottling", 0, 1, 0.01, 0.3, "Blotches of red under the skin, a few centimetres across.", "Skin"],
  ["grain", "Grain", 0, 1, 0.01, 0.3, "Fine light and dark variation, about a millimetre.", "Skin"],
  ["pores", "Pores", 0, 1, 0.01, 0.3, "Darker dots with a little relief; strongest on the nose and cheeks.", "Skin"],
  ["poreSize", "Pore spacing (mm)", 0.6, 4, 0.1, 1.3, "Smaller is finer; they fade out when they get smaller than a pixel.", "Skin"],
  ["freckles", "Freckles", 0, 1, 0.01, 0, "How many.", "Skin"],
  ["freckleSize", "Freckle size (mm)", 1, 8, 0.1, 3, "", "Skin"],
  ["spread", "Freckle spread", 0, 1, 0.01, 0.15, "0 the nose and cheeks only, 1 everywhere.", "Skin"],
  ["flush", "Flush", 0, 1, 0.01, 0.3, "Redder cheeks, nose and ears.", "Skin"],
  ["veins", "Veins", 0, 1, 0.01, 0.08, "Faint blue lines under thin skin.", "Skin"],
  ["translucency", "Translucency", 0, 1, 0.01, 0.45, "Red light through the skin at the rims and the ears.", "Skin"],
  ["evenness", "Evenness", 0, 1, 0.01, 0.2, "Tones down the mottling, grain, flush, veins and spots together (glass skin is even).", "Skin"],
  ["dewy", "Dewy", 0, 1, 0.01, 0.2, "A soft, broad glow on the high planes: cheekbones, nose bridge, forehead, chin (glass skin).", "Skin"],
  ["oil", "Oily T-zone", 0, 1, 0.01, 0, "Patchy shine on the forehead, nose and chin: smaller, brighter highlights.", "Skin"],
  ["age", "Age", 0, 1, 0.01, 0, "0 young, 1 seventy and over: sallower, duller, rougher, bigger pores, less light through the skin.", "Age"],
  ["wrinkles", "Wrinkles", 0, 1, 0.01, 0.6, "How deep the age's wrinkles are (forehead, frown lines, crow's feet, smile and marionette lines, under the eyes).", "Age"],
  ["spots", "Age spots", 0, 1, 0.01, 0.4, "Brown spots that come with age.", "Age"],
  ["foundation", "Foundation", 0, 1, 0.01, 0, "Evens and lightens the face's tone.", "Makeup"],
  ["blush", "Blush", 0, 1, 0.01, 0, "", "Makeup"],
  ["blushPlace", "Blush placement", 0, 1, 0.01, 0.2, "0 on the cheekbones (Korean), 1 high under the eyes and over the nose (Japanese igari).", "Makeup"],
  ["lips", "Lip colour", 0, 1, 0.01, 0, "", "Makeup"],
  ["lipGradient", "Lip gradient", 0, 1, 0.01, 0.5, "0 the whole lip, 1 a tint in the middle fading out (gradient lips).", "Makeup"],
  ["lipGloss", "Lip gloss", 0, 1, 0.01, 0.3, "", "Makeup"],
  ["liner", "Eyeliner", 0, 1, 0.01, 0, "", "Makeup"],
  ["wing", "Liner wing", -1, 1, 0.01, -0.3, "−1 a puppy liner angled down, +1 a cat wing up.", "Makeup"],
  ["shadow", "Eyeshadow", 0, 1, 0.01, 0, "", "Makeup"],
  ["aegyo", "Aegyo-sal", 0, 1, 0.01, 0, "The soft highlight just under the lower lashes.", "Makeup"],
  ["pigment", "Pigment mixing", 0, 1, 0.01, 1, "0 makeup and the photo sit on the skin like an overlay; 1 they are pigment: they filter the skin's own colour (a tint that follows the base tone), skin and lips taking more than a lid, and a little of it hiding the base like paint.", "Makeup"],
  ["pigStrength", "Pigment strength", 0, 3, 0.05, 1.4, "How much light the pigment takes out of the skin under it (its density).", "Makeup"],
  ["photo", "Photo on the face", 0, 1, 0.01, 1, "With a photo skin: how much of the picture shows inside its mask.", "Photo"],
  ["over", "Procedural over the photo", 0, 1, 0.01, 0.35, "How much of the procedural detail (pores, grain, age) shows on the photo.", "Photo"],
];
export const COLOURS = [["freckleColor", "Freckle colour", "#8a5a3c"], ["flushColor", "Flush colour", "#c4555a"], ["blushColor", "Blush colour", "#e2737e"],
  ["lipColor", "Lip colour", "#c23a4f"], ["linerColor", "Liner colour", "#2a1c18"], ["shadowColor", "Eyeshadow colour", "#9a6a5a"]];
export const DEFAULTS = { on: false, pigmentOn: false, ...Object.fromEntries(FEATURES.map(f => [f[0], f[5]])), ...Object.fromEntries(COLOURS.map(c => [c[0], c[2]])) };

// presets (docs/research/skin.md §6, starting points tuned by eye): skin and age set the skin's layers and its roughness
export const SKIN_PRESETS = {
  "young glass": { rough: 0.32, mottle: 0.08, grain: 0.15, pores: 0.12, poreSize: 1.0, flush: 0.25, translucency: 0.55, veins: 0.05, evenness: 0.7, dewy: 0.6, oil: 0, age: 0, spots: 0 },
  "natural young": { rough: 0.42, mottle: 0.25, grain: 0.3, pores: 0.3, poreSize: 1.2, flush: 0.3, translucency: 0.45, veins: 0.08, evenness: 0.3, dewy: 0.25, oil: 0, age: 0.08, spots: 0.1 },
  "adult": { rough: 0.48, mottle: 0.4, grain: 0.35, pores: 0.45, poreSize: 1.5, flush: 0.35, translucency: 0.38, veins: 0.12, evenness: 0.15, dewy: 0.1, oil: 0.1, age: 0.35, wrinkles: 0.4, spots: 0.25 },
  "50 and over": { rough: 0.55, mottle: 0.5, grain: 0.45, pores: 0.6, poreSize: 1.9, flush: 0.3, translucency: 0.28, veins: 0.25, evenness: 0, dewy: 0.05, oil: 0.05, age: 0.6, wrinkles: 0.6, spots: 0.45 },
  "70 and over": { rough: 0.62, mottle: 0.55, grain: 0.55, pores: 0.7, poreSize: 2.3, flush: 0.25, translucency: 0.2, veins: 0.4, evenness: 0, dewy: 0, oil: 0, age: 0.9, wrinkles: 0.85, spots: 0.7 },
};
export const MAKEUP_PRESETS = {
  "none": { foundation: 0, blush: 0, lips: 0, liner: 0, shadow: 0, aegyo: 0 },
  "natural Korean": { foundation: 0.5, blush: 0.3, blushPlace: 0.2, blushColor: "#ea8a80", lips: 0.75, lipGradient: 0.8, lipGloss: 0.5, lipColor: "#d23d55",
                      liner: 0.55, wing: -0.6, linerColor: "#3a2620", shadow: 0.2, shadowColor: "#b0806a", aegyo: 0.4 },
  "Japanese igari": { foundation: 0.35, blush: 0.45, blushPlace: 0.95, blushColor: "#ec6f7c", lips: 0.55, lipGradient: 0.6, lipGloss: 0.3, lipColor: "#d8566a",
                      liner: 0.3, wing: -0.2, linerColor: "#3a2620", shadow: 0.15, shadowColor: "#c48a80", aegyo: 0.25 },
  "soft glam": { foundation: 0.7, blush: 0.35, blushPlace: 0.05, blushColor: "#d9806a", lips: 0.85, lipGradient: 0.05, lipGloss: 0.2, lipColor: "#b64a5a",
                 liner: 0.75, wing: 0.6, linerColor: "#1c1412", shadow: 0.55, shadowColor: "#8a5a48", aegyo: 0.2 },
  "pale horror": { foundation: 0.6, blush: 0, lips: 0.35, lipGradient: 0.3, lipGloss: 0.1, lipColor: "#7a4a52", liner: 0.4, wing: 0, linerColor: "#201818",
                   shadow: 0.6, shadowColor: "#5a4a58", aegyo: 0 },
};

const LIDS = {   // MediaPipe's eyelid rings, outer corner to inner (the character's left eye is +x)
  UL: [263, 466, 388, 387, 386, 385, 384, 398, 362], UR: [33, 246, 161, 160, 159, 158, 157, 173, 133],
  LL: [263, 249, 390, 373, 374, 380, 381, 382, 362], LR: [33, 7, 163, 144, 145, 153, 154, 155, 133] };
const POINTS = { uNose: 4, uCheekL: 425, uCheekR: 205, uBoneL: 280, uBoneR: 50, uForehead: 151, uBrowMid: 9, uBridge: 6, uChin: 152,
  uMouthL: 291, uMouthR: 61, uLipTop: 0, uLipBot: 17, uAlaL: 358, uAlaR: 129, uEyeOutL: 263, uEyeOutR: 33, uLidCL: 386, uLidCR: 159, uLowCL: 374, uLowCR: 145 };

const COMMON = `
uniform float uProc, uPigOn, uScale, uHasPhoto, uHasTouch, uHasPig, ${FEATURES.map(f => "uf_" + f[0]).join(", ")};
uniform vec3 uTone, uPhotoTone, ${COLOURS.map(c => "uc_" + c[0]).join(", ")};
uniform vec3 ${Object.keys(POINTS).join(", ")}, uEarL, uEarR, uFaceC, uMouthC, uRight, uUp, uFwd;
uniform vec3 uLidUL[9], uLidUR[9], uLidLL[9], uLidLR[9];
uniform sampler2D uPhotoMap, uPhotoMask, uTouchPaint, uTouchMask, uTouchPig, uLayOv, uLayPig, uLaySurf, uLayGlow;
uniform float uHasLay, uShowSel;
varying float vSel;
varying vec3 vObj; varying vec2 vSkinUv;
float skinH, skinRough, skinCoat, skinCoatR = -1.0, skinSm = 0.0;   // skinSm: a layer's smoothing (evens out the pores, grain and relief)
float h31(vec3 p) { p = fract(p * vec3(0.1031, 0.1137, 0.1279)); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 h33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s / 0.9375; }
vec2 cells(vec3 p) {                         // the distance to the nearest random point of a cell, and that cell's own number
  vec3 i = floor(p), f = fract(p); float d = 9.0, id = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(x, y, z), c = i + o, q = o + h33(c) - f; float e = dot(q, q);
    if (e < d) { d = e; id = h31(c + 7.7); }
  }
  return vec2(sqrt(d), id);
}
float near(vec3 p, vec3 c, float r) { vec3 d = (p - c) / (r * uScale); return exp(-dot(d, d)); }
float seg(vec3 p, vec3 a, vec3 b) { vec3 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
float line9(vec3 p, vec3 L[9]) { float d = 9.0; for (int k = 0; k < 8; k++) d = min(d, seg(p, L[k], L[k + 1])); return d; }
float groove(float d, float w) { return exp(-(d * d) / (w * w * uScale * uScale)); }
// pigment, not overlay: the colour pc as a film of density a on the base c. Light goes through it twice, so the base is
// multiplied by pc^(a*strength) (dark skin keeps its depth, a pale yellow on dark skin barely shows, like a highlighter)
// and a little of the pigment hides the base like paint. uf_pigment 0 is the old overlay, 1 is the pigment.
vec3 tint(vec3 c, vec3 pc, float a, float take) {
  vec3 over = mix(c, pc, clamp(a, 0.0, 1.0));
  float pm = uf_pigment * uPigOn;                              // the Pigment toggle (off: the plain overlay)
  if (pm < 0.001) return over;
  vec3 film = c * pow(max(pc, vec3(0.002)), vec3(a * take * uf_pigStrength));
  film = mix(film, pc, clamp(a * 0.25 * take, 0.0, 1.0));
  return mix(over, film, pm);
}
float front(vec3 p) { return smoothstep(-0.08 * uScale, -0.055 * uScale, dot(p - uFaceC, uFwd)); }   // the face's own side, not through the head (uFaceC is forward, by the nose: the cheeks sit 4-5 cm behind it)

// the age's wrinkles: their depth at p (0..), placed from the landmarks
float wrinkles(vec3 p) {
  float s = uScale, w = 0.0;
  vec3 d = p - uForehead;                                            // forehead: a few long horizontal lines
  w += near(p, uForehead + uUp * 0.012 * s, 0.03) * pow(0.5 + 0.5 * sin(dot(d, uUp) / (0.0065 * s) * 6.2832 + 2.0 + 0.8 * vnoise(p * 25.0)), 6.0) * (0.6 + 0.4 * vnoise(p * 40.0));
  w += 0.8 * (groove(seg(p, uBrowMid + uRight * 0.004 * s, uBrowMid + uRight * 0.0035 * s + uUp * 0.013 * s), 0.0007)   // frown lines
            + groove(seg(p, uBrowMid - uRight * 0.004 * s, uBrowMid - uRight * 0.0035 * s + uUp * 0.013 * s), 0.0007));
  for (int k = 0; k < 2; k++) {
    float side = k == 0 ? 1.0 : -1.0;
    vec3 eo = k == 0 ? uEyeOutL : uEyeOutR, al = k == 0 ? uAlaL : uAlaR, mc = k == 0 ? uMouthL : uMouthR;
    vec3 e = p - eo; float x = dot(e, uRight) * side, u = dot(e, uUp), r = length(vec2(x, u)) / s;   // crow's feet
    w += 0.6 * step(0.0, x) * smoothstep(0.004, 0.009, r) * (1.0 - smoothstep(0.012, 0.019, r)) * pow(abs(sin(atan(u, x) * 5.0 + 0.6)), 8.0);
    w += 1.2 * groove(seg(p, al + uRight * side * 0.003 * s, mc + uRight * side * 0.005 * s + uUp * 0.002 * s), 0.0014);   // smile lines
    w += groove(seg(p, mc + uRight * side * 0.002 * s, mc + uRight * side * 0.004 * s - uUp * 0.016 * s), 0.0011);       // marionette
  }
  w += 0.7 * (groove(line9(p + uUp * 0.0065 * s, uLidLL), 0.0011) + groove(line9(p + uUp * 0.0065 * s, uLidLR), 0.0011));   // under the eyes
  return w * front(p);
}

vec3 proceduralSkin(vec3 base, vec3 p) {
  float px = length(fwidth(p)), s = uScale;
  float even = (1.0 - 0.8 * uf_evenness) * (1.0 - skinSm), age = uf_age;
  float face = near(p, uFaceC, 0.09);
  float tzone = max(near(p, uNose, 0.025), max(near(p, uCheekL, 0.035), near(p, uCheekR, 0.035)));
  vec3 c = base;
  c = mix(c, c * vec3(1.0, 0.95, 0.82) * 0.96, age * 0.6);          // older: sallower, duller
  float m = smoothstep(0.42, 0.78, fbm(p * 22.0));                  // mottling
  c = mix(c, c * vec3(1.08, 0.86, 0.84), uf_mottle * even * m);
  float g = vnoise(p * 900.0) - 0.5;                                 // grain
  c *= 1.0 + g * 0.14 * uf_grain * even * (1.0 - smoothstep(0.0006, 0.0015, px));
  float ps = uf_poreSize * 0.001 * (1.0 + 0.4 * age), pfade = 1.0 - smoothstep(ps * 0.15, ps * 0.4, px);   // pores only up close: a few pixels each
  vec2 pc = cells(p / ps);                                           // pores
  float pore = (1.0 - smoothstep(0.05, 0.3, pc.x)) * step(0.25, pc.y) * (0.45 + 0.55 * max(tzone, face * 0.6)) * pfade * (1.0 - skinSm);
  c *= 1.0 - 0.1 * uf_pores * pore;
  float fs = uf_freckleSize * 0.001; vec2 fc = cells(p / fs + 3.1);  // freckles
  float where = mix(max(tzone, near(p, uNose, 0.05)) * face, 1.0, uf_spread);
  float spot = (1.0 - smoothstep(0.2, 0.55, fc.x + 0.35 * (vnoise(p / fs * 2.5) - 0.5))) * step(1.0 - uf_freckles * 0.7, fc.y) * where;
  c = mix(c, uc_freckleColor, clamp(spot * (0.25 + 0.45 * h31(floor(p / fs + 3.1))), 0.0, 1.0) * step(0.001, uf_freckles));
  vec2 ac = cells(p / (0.007 * s) + 9.1);                            // age spots
  float aspot = (1.0 - smoothstep(0.15, 0.45, ac.x)) * step(1.0 - 0.3 * uf_spots * age, ac.y);
  c = mix(c, c * vec3(0.74, 0.6, 0.48), aspot * 0.7 * even);
  float fl = max(max(near(p, uCheekL, 0.03), near(p, uCheekR, 0.03)), max(near(p, uNose, 0.016) * 0.8, max(near(p, uEarL, 0.025), near(p, uEarR, 0.025))));
  c = mix(c, c * uc_flushColor * 1.6, uf_flush * even * fl * 0.5);  // flush
  float v = 1.0 - abs(fbm(p * 38.0) * 2.0 - 1.0);                    // veins: thin ridges of the noise
  c = mix(c, c * vec3(0.78, 0.86, 1.08), (uf_veins + 0.3 * age) * even * pow(v, 10.0) * 0.8);
  float wr = wrinkles(p) * age * uf_wrinkles * (1.0 - skinSm);                        // wrinkles: darker grooves with relief
  c *= 1.0 - 0.12 * clamp(wr, 0.0, 1.5);
  skinH = -pore * uf_pores - 1.6 * wr;
  float hp = max(max(near(p, uBoneL, 0.022), near(p, uBoneR, 0.022)), max(near(p, uBridge, 0.012), max(near(p, uForehead, 0.02), 0.7 * near(p, uChin, 0.012))));
  float tz = max(max(near(p, uForehead, 0.03), near(p, uBridge, 0.015)), max(near(p, uNose, 0.018), 0.8 * near(p, uChin, 0.015)));
  float oilPatch = smoothstep(0.35, 0.7, fbm(p * 90.0));
  skinRough = (1.0 + 0.25 * age) * (1.0 - 0.5 * uf_dewy * hp) * (1.0 - 0.45 * uf_oil * tz * oilPatch);
  skinCoat = 0.03 + 0.35 * uf_dewy * hp + 0.5 * uf_oil * tz * oilPatch;
  return c;
}

// makeup, over the skin (and the photo)
vec3 makeup(vec3 c, vec3 p) {
  float s = uScale, fr = front(p);
  float fd = uf_foundation * near(p, uFaceC, 0.085) * fr;           // foundation: even, a little lighter
  c = mix(c, mix(c, uTone * 1.06, 0.5), fd * 0.6);
  vec3 low = mix(uLowCL, uLowCR, 0.0);
  float bl = 0.0;                                                    // blush: cheekbone (0) to under the eyes and over the nose (1)
  for (int k = 0; k < 2; k++) {
    vec3 bone = k == 0 ? uBoneL : uBoneR, under = (k == 0 ? uLowCL : uLowCR) - uUp * 0.011 * s;
    bl = max(bl, near(p, mix(bone, under, uf_blushPlace), 0.022 + 0.008 * uf_blushPlace));
  }
  bl = max(bl, uf_blushPlace * 0.6 * near(p, uBridge - uUp * 0.004 * s, 0.011));
  c = mix(c, c * uc_blushColor * 1.5, clamp(uf_blush * bl * fr * 0.7, 0.0, 1.0));
  vec3 dm = p - uMouthC; float lx = dot(dm, uRight), lu = dot(dm, uUp);  // lips
  float rx = length(uMouthL - uMouthR) * 0.5, top = dot(uLipTop - uMouthC, uUp), bot = -dot(uLipBot - uMouthC, uUp);
  float t = abs(lx) / max(rx, 1e-4), hgt = (lu > 0.0 ? top : bot) * (1.0 - t * t * t);
  float lipm = (1.0 - smoothstep(-0.0006 * s, 0.0008 * s, abs(lu) - hgt)) * (1.0 - smoothstep(0.92, 1.04, t)) * fr;
  float grad = 1.0 - uf_lipGradient * clamp(length(vec2(t, lu / max(lu > 0.0 ? top : bot, 1e-4))) * 1.1, 0.0, 1.0);
  c = tint(c, uc_lipColor, clamp(uf_lips * lipm * grad, 0.0, 1.0), 1.3);
  skinRough *= 1.0 - 0.45 * uf_lipGloss * uf_lips * lipm;
  skinCoat += 0.45 * uf_lipGloss * uf_lips * lipm;
  for (int k = 0; k < 2; k++) {
    float side = k == 0 ? 1.0 : -1.0;
    vec3 outer = k == 0 ? uLidUL[0] : uLidUR[0], lidc = k == 0 ? uLidCL : uLidCR;
    float du = k == 0 ? line9(p, uLidUL) : line9(p, uLidUR);
    float outw = clamp(dot(p - lidc, uRight) * side / (0.012 * s) + 0.5, 0.0, 1.0);   // thicker toward the outer corner
    float w = (0.0006 + 0.0007 * outw) * s;
    vec3 tip = outer + uRight * side * 0.0065 * s + uUp * uf_wing * 0.0035 * s;
    float wingd = seg(p, outer, tip), ww = 0.0008 * s * (1.0 - clamp(dot(p - outer, uRight) * side / (0.0065 * s), 0.0, 1.0));
    float ln = max(1.0 - smoothstep(w, w + 0.0005 * s, du), 1.0 - smoothstep(ww, ww + 0.0004 * s, wingd));
    float above = step(-0.0005 * s, dot(p - lidc, uUp));            // eyeshadow: from the lid up toward the brow
    float sh = exp(-pow(du / (0.0065 * s), 2.0)) * above * near(p, lidc + uUp * 0.004 * s, 0.016);
    c = mix(c, c * uc_shadowColor * 1.3, clamp(uf_shadow * sh, 0.0, 1.0));
    float dl = k == 0 ? line9(p + uUp * 0.0035 * s, uLidLL) : line9(p + uUp * 0.0035 * s, uLidLR);   // aegyo-sal: under the lashes
    float ag = exp(-pow(dl / (0.0021 * s), 2.0));
    c = mix(c, c * 1.12 + 0.02, uf_aegyo * ag * 0.6);
    skinCoat += 0.2 * uf_aegyo * ag;
    c = tint(c, uc_linerColor, clamp(uf_liner * ln * fr, 0.0, 1.0), 1.0);
  }
  return c;
}`;

// the material's shader, with the skin added; uniforms are shared so sliders only change numbers
export function procedural(material) {
  const u = { uProc: { value: 0 }, uPigOn: { value: 0 }, uScale: { value: 1 }, uHasPhoto: { value: 0 }, uTone: { value: new THREE.Color() }, uPhotoTone: { value: new THREE.Color(1, 1, 1) },
              uPhotoMap: { value: null }, uPhotoMask: { value: null },
              uHasTouch: { value: 0 }, uTouchPaint: { value: null }, uTouchMask: { value: null }, uHasPig: { value: 0 }, uTouchPig: { value: null },
              uHasLay: { value: 0 }, uShowSel: { value: 0 }, uLayOv: { value: null }, uLayPig: { value: null }, uLaySurf: { value: null }, uLayGlow: { value: null } };   // the layers (layers.js)   // the touch-up (touchup.js)
  for (const f of FEATURES) u["uf_" + f[0]] = { value: f[5] };
  for (const c of COLOURS) u["uc_" + c[0]] = { value: new THREE.Color(c[2]) };
  for (const k of [...Object.keys(POINTS), "uEarL", "uEarR", "uFaceC", "uMouthC", "uRight", "uUp", "uFwd"]) u[k] = { value: new THREE.Vector3() };
  for (const k of Object.keys(LIDS)) u["uLid" + k] = { value: Array.from({ length: 9 }, () => new THREE.Vector3()) };
  material.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec2 skinUv; attribute float selW; varying float vSel; varying vec3 vObj; varying vec2 vSkinUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position; vSkinUv = skinUv; vSel = selW;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + COMMON)
      .replace("#include <color_fragment>", `skinH = 0.0; skinRough = 1.0; skinCoat = 0.0; skinCoatR = -1.0; skinSm = uHasLay > 0.5 ? texture2D(uLayGlow, vSkinUv).a : 0.0;
if (uProc > 0.5) {
  vec3 skinP = proceduralSkin(uTone, vObj);
  if (uHasPhoto > 0.5) {                                             // the picture inside its mask, the procedural skin outside
    float h0 = skinH, r0 = skinRough, c0 = skinCoat;
    vec3 ph = texture2D(uPhotoMap, vSkinUv).rgb;
    float mk = texture2D(uPhotoMask, vSkinUv).r;
    if (uHasTouch > 0.5) mk = clamp(mk + (floor(texture2D(uTouchMask, vSkinUv).r * 255.0 + 0.5) - 128.0) / 127.0, 0.0, 1.0);   // the touch-up's mask edits: grey 128 exactly none
    mk *= uf_photo;
    vec3 detail = proceduralSkin(ph, vObj) / max(ph, vec3(0.02));     // the procedural detail as a ratio, laid on the photo
    vec3 phd = ph * mix(vec3(1.0), detail, uf_over);
    skinH = mix(h0, skinH * uf_over, mk); skinRough = r0; skinCoat = c0;
    vec3 pig = skinP * pow(clamp(ph / max(uPhotoTone, vec3(0.02)), vec3(0.0), vec3(1.25)), vec3(uf_pigStrength / 1.4));   // the picture as a film over this body's own skin: its tone, its lips, its brows
    diffuseColor.rgb = mix(skinP, mix(phd, pig, uf_pigment * uPigOn), mk);
  } else diffuseColor.rgb = skinP;
  diffuseColor.rgb = makeup(diffuseColor.rgb, vObj);
}
if (uHasTouch > 0.5) { vec4 tp = texture2D(uTouchPaint, vSkinUv); diffuseColor.rgb = mix(diffuseColor.rgb, tp.rgb, tp.a); }
if (uHasPig > 0.5 && uPigOn > 0.5) diffuseColor.rgb *= pow(texture2D(uTouchPig, vSkinUv).rgb, vec3(uf_pigStrength / 1.4));   // the pigment strokes: filters, multiplied together   // the touch-up's paint, over all
if (uHasLay > 0.5) {                                                   // the layers above the base: pigment (filters), paint over, then the surface (gloss, relief)
  diffuseColor.rgb *= texture2D(uLayPig, vSkinUv).rgb;
  vec4 lo = texture2D(uLayOv, vSkinUv); diffuseColor.rgb = mix(diffuseColor.rgb, lo.rgb, lo.a);
  vec4 sf = texture2D(uLaySurf, vSkinUv);
  skinRough *= max(sf.r * 4.0, 0.04); skinCoat = clamp(skinCoat + sf.g, 0.0, 1.0); skinH += (sf.b - 0.50196) * 14.0; if (sf.g > 0.01) skinCoatR = 1.0 - sf.a;
}
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.55, 0.1), clamp(vSel, 0.0, 1.0) * 0.55 * uShowSel);   // the selection, shown
#include <color_fragment>`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
if (uProc > 0.5 || uHasLay > 0.5) roughnessFactor = clamp(roughnessFactor * skinRough, 0.06, 1.0);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
if (uProc > 0.5 || uHasLay > 0.5) {                                                   // the relief (pores, wrinkles), from how the height changes across the pixel
  vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), r1 = cross(sy, normal), r2 = cross(normal, sx);
  float det = dot(sx, r1); vec2 dh = vec2(dFdx(skinH), dFdy(skinH)) * 0.00025;
  normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
if (uHasLay > 0.5) totalEmissiveRadiance += texture2D(uLayGlow, vSkinUv).rgb * 0.5 * (0.5 + 0.5 * diffuseColor.r);   // light from within, painted: thin skin, an ear's rim
if (uProc > 0.5) {                                                   // light through the skin: the rims, the ears; less with age
  float rim = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 2.5);
  float ears = max(near(vObj, uEarL, 0.03), near(vObj, uEarR, 0.03));
  totalEmissiveRadiance += vec3(0.55, 0.12, 0.08) * uf_translucency * (1.0 - 0.6 * uf_age) * (0.35 * rim + 0.5 * ears) * diffuseColor.rgb;
}`)
      .replace("#include <lights_physical_fragment>", `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
if (uProc > 0.5 || uHasLay > 0.5) { material.clearcoat = clamp(skinCoat, 0.0, 1.0); if (skinCoatR >= 0.0) material.clearcoatRoughness = clamp(skinCoatR, 0.03, 1.0); }  // the coat: the dewy glow, the oil, the gloss
#endif`);
  };
  material.customProgramCacheKey = () => "studio-skin-6";
  return u;
}

// the settings into the uniforms; landmarks (lm(i): a point on the body now) place everything on the face
export function update(u, set, tone, lm, scale) {
  u.uProc.value = set.on ? 1 : 0; u.uPigOn.value = set.pigmentOn ? 1 : 0; u.uScale.value = scale;
  for (const f of FEATURES) u["uf_" + f[0]].value = set[f[0]] ?? f[5];
  for (const c of COLOURS) u["uc_" + c[0]].value.set(set[c[0]] ?? c[2]);   // three converts the sRGB hex itself
  u.uTone.value.set(tone);
  if (!lm) return;
  const v = i => new THREE.Vector3(...lm(i));
  for (const [k, i] of Object.entries(POINTS)) u[k].value.copy(v(i));
  for (const [k, ids] of Object.entries(LIDS)) ids.forEach((i, j) => u["uLid" + k].value[j].copy(v(i)));
  const out = (a, b) => v(a).add(v(a).sub(v(b)).multiplyScalar(0.12)).add(new THREE.Vector3(0, 0, -0.02 * scale));
  u.uEarL.value.copy(out(454, 234)); u.uEarR.value.copy(out(234, 454));
  u.uFaceC.value.copy(v(4).add(v(10)).multiplyScalar(0.5));
  u.uMouthC.value.copy(v(13).add(v(14)).multiplyScalar(0.5));
  const X = v(454).sub(v(234)).normalize(), U = v(10).sub(v(152)); U.sub(X.clone().multiplyScalar(U.dot(X))).normalize();
  u.uRight.value.copy(X); u.uUp.value.copy(U); u.uFwd.value.crossVectors(X, U);
}

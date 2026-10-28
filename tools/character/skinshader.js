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
  ["linerWidth", "Liner thickness", 0.5, 2.5, 0.01, 1, "The liner's thickness, and its wing's length with it: 1 a fine line, 2 a bold one.", "Makeup"],
  ["linerInner", "Inner corner liner", 0, 1, 0.01, 0, "The liner carried past the inner corner toward the nose, to a sharp point (anime, douyin).", "Makeup"],
  ["lowerLiner", "Lower liner", 0, 1, 0.01, 0, "The liner under the eye too: along the lower lashes' roots (the lower lid's front edge), a band down the skin in the liner's colour (a bold doll's ring, a glam or smoky eye).", "Makeup"],
  ["lowerWidth", "Lower liner thickness", 0.3, 2.5, 0.01, 0.8, "The lower liner's thickness: 0.5 a fine line, 2 a bold band; thicker toward the outer corner, as the upper one.", "Makeup"],
  ["lowerReach", "Lower liner reach", 0, 1, 0.01, 1, "How far along the lower lid it runs from the outer corner: 0.4 the outer part only (smoky), 1 corner to corner.", "Makeup"],
  ["shadow", "Eyeshadow", 0, 1, 0.01, 0, "", "Makeup"],
  ["shadowPlace", "Eyeshadow placement", 0, 1, 0.01, 0, "0 along the whole lid, 1 gathered at the outer corner.", "Makeup"],
  ["shadowSize", "Eyeshadow size", 0.6, 2.2, 0.01, 1, "How far the eyeshadow and the under-eye wash spread: 1 the lid (hidden by long lashes), 1.6 up to the crease and out past the corner (a smoky eye).", "Makeup"],
  ["under", "Under-eye shadow", 0, 1, 0.01, 0, "A wash of colour under the lower lashes, fuller toward the outer corner: with the eyeshadow it rings the eye and draws its shape (the pink round anime eyes).", "Makeup"],
  ["corner", "Inner corner", 0, 1, 0.01, 0, "A dab of colour at the inner corner, with a little shimmer.", "Makeup"],
  ["waterline", "Waterline", 0, 1, 0.01, 0, "The lower lid's rim tinted and wet, corner to corner.", "Makeup"],
  ["aegyo", "Aegyo-sal", 0, 1, 0.01, 0, "The soft highlight just under the lower lashes.", "Makeup"],
  ["pigment", "Pigment mixing", 0, 1, 0.01, 1, "0 makeup and the photo sit on the skin like an overlay; 1 they are pigment: they filter the skin's own colour (a tint that follows the base tone), skin and lips taking more than a lid, and a little of it hiding the base like paint.", "Makeup"],
  ["pigStrength", "Pigment strength", 0, 3, 0.05, 1.4, "How much light the pigment takes out of the skin under it (its density).", "Makeup"],
  ["photo", "Photo on the face", 0, 1, 0.01, 1, "With a photo skin: how much of the picture shows inside its mask.", "Photo"],
  ["over", "Procedural over the photo", 0, 1, 0.01, 0.35, "How much of the procedural detail (pores, grain, age) shows on the photo.", "Photo"],
];
export const COLOURS = [["freckleColor", "Freckle colour", "#8a5a3c"], ["flushColor", "Flush colour", "#c4555a"], ["blushColor", "Blush colour", "#e2737e"],
  ["lipColor", "Lip colour", "#c23a4f"], ["linerColor", "Liner colour", "#2a1c18"], ["shadowColor", "Eyeshadow colour", "#9a6a5a"],
  ["underColor", "Under-eye colour", "#e49aa6"], ["cornerColor", "Inner corner colour", "#f2b4bc"], ["waterColor", "Waterline colour", "#e07f8e"]];
export const SKIN_COLOURS = ["freckleColor", "flushColor"], MAKEUP_COLOURS = ["blushColor", "lipColor", "linerColor", "shadowColor", "underColor", "cornerColor", "waterColor"];   // a preset's groups' colours
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
  // after the user's references (DECISIONS 2026-10-26, night): the pinkish hues round the eye that draw its shape in anime
  // and douyin makeup: a mauve-pink shadow gathered at the outer corner, a pink wash under the lower lashes, a pink inner
  // corner and waterline, a bold winged liner carried to a point at the inner corner, aegyo-sal; a sheer base, blush high
  // under the eyes, pink gradient lips
  "anime pink": { foundation: 0.45, blush: 0.35, blushPlace: 0.8, blushColor: "#ee8ea0", lips: 0.5, lipGradient: 0.7, lipGloss: 0.6, lipColor: "#de6a84",
                  liner: 0.9, wing: 0.45, linerWidth: 1.5, linerInner: 0.7, linerColor: "#151013", shadow: 0.8, shadowPlace: 0.55, shadowColor: "#c8708c",
                  under: 0.75, underColor: "#e8899c", corner: 0.65, cornerColor: "#f4b0bc", waterline: 0.75, waterColor: "#dd7d8f", aegyo: 0.45 },
  // the liner each of the user's three drawn eye shapes carries (DECISIONS 2026-10-26, night; the lashes are browlash.js's
  // fox, halfLidded and roundDoll styles): a fox almond's bold liner thickening to a long wing, with the inner corner
  // drawn out to a long point and a pink inner corner; a half-lidded eye's broad band with a long inner point and a short
  // flick, the pink under-eye bulge lit (aegyo-sal); a round doll's thin liner with small points both ends and pink all
  // round the eye
  "fox liner": { foundation: 0.3, blush: 0.2, blushPlace: 0.5, blushColor: "#e98a98", lips: 0, liner: 0.95, wing: 0.7, linerWidth: 1.6, linerInner: 1, linerColor: "#120f10",
                 shadow: 0.2, shadowPlace: 0.7, shadowColor: "#c99aa6", under: 0.2, underColor: "#e8a5ae", corner: 0.55, cornerColor: "#f4b0bc", waterline: 0.2, waterColor: "#dd8a96", aegyo: 0.2 },
  "half-lidded liner": { foundation: 0.3, blush: 0.25, blushPlace: 0.9, blushColor: "#ec8e9c", lips: 0, liner: 1, wing: 0.25, linerWidth: 2.2, linerInner: 1, linerColor: "#120f10",
                         shadow: 0.3, shadowPlace: 0.3, shadowColor: "#b98c9a", under: 0.5, underColor: "#e9a0ad", corner: 0.25, cornerColor: "#f0b4bc", waterline: 0.3, waterColor: "#d98c98", aegyo: 0.65 },
  "doll pink": { foundation: 0.35, blush: 0.5, blushPlace: 1, blushColor: "#ee8e9e", lips: 0, liner: 0.6, wing: 0.2, linerWidth: 0.8, linerInner: 0.5, linerColor: "#1a1416",
                 shadow: 0.5, shadowPlace: 0, shadowColor: "#e0a2b0", under: 0.7, underColor: "#ec9aa8", corner: 0.5, cornerColor: "#f6b8c2", waterline: 0.4, waterColor: "#e08a98", aegyo: 0.4 },
  // the makeup of the user's second reference (docs/research/lash_reference.md; the lashes are browlash.js's glam,
  // dollVolume and naturalMedium sets): the glam eye's thick black winged liner top and bottom in a dark plum smoke all
  // round the eye, its inner corner lit; the doll volume eye's bold black liner above and below with the lids dark, the
  // waterline lined; the natural eye's thin red-brown tint along the lower waterline on bare skin
  "smoky plum": { foundation: 0.5, blush: 0.25, blushPlace: 0.15, blushColor: "#c98088", lips: 0, liner: 1, wing: 0.55, linerWidth: 1.9, linerInner: 0, linerColor: "#0e0b0d",
                  lowerLiner: 0.85, lowerWidth: 1.2, lowerReach: 0.8, shadow: 0.9, shadowPlace: 0.3, shadowSize: 2, shadowColor: "#7c3c8e", under: 0.8, underColor: "#704078",
                  corner: 0.6, cornerColor: "#f6e6de", waterline: 0.55, waterColor: "#3a2430", aegyo: 0.1 },
  "bold doll liner": { foundation: 0.45, blush: 0.3, blushPlace: 0.6, blushColor: "#e08a94", lips: 0, liner: 1, wing: 0.3, linerWidth: 2.1, linerInner: 0.45, linerColor: "#0a0809",
                       lowerLiner: 1, lowerWidth: 1.5, lowerReach: 1, shadow: 0.7, shadowPlace: 0.15, shadowSize: 1.3, shadowColor: "#4a3a40", under: 0.25, underColor: "#8a6a72",
                       corner: 0.2, cornerColor: "#f0d8d4", waterline: 0.6, waterColor: "#2a1c22", aegyo: 0.2 },
  "tinted waterline": { foundation: 0.15, waterline: 0.65, waterColor: "#b0584a" },
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
uniform vec3 uLidUL[9], uLidUR[9], uLidLL[9], uLidLR[9], uLidFL[9], uLidFR[9];   // the lid lines (MediaPipe's rings), and the upper lids' front edges (index.html's rimOf: where the lashes grow)
uniform vec4 uLidTL[9], uLidTR[9];                                 // the liner's top edge over each: on the skin a liner's width out from the front edge (w: that width there)
uniform vec3 uLowFL[9], uLowFR[9]; uniform vec4 uLowBL[9], uLowBR[9];   // the lower lids' front edges (where the lower lashes grow) and the lower liner's bottom edge under each (w: its width there)
uniform float uCutOn; uniform vec2 uCutL[32], uCutR[32], uCutZ; uniform vec4 uCutBoxL, uCutBoxR;   // the eyes' openings (index.html)
bool inCut(vec2 P[32], vec4 box, vec2 p) {                         // inside an eye's lid outline (a smoothed polygon)
  if (p.x < box.x || p.y < box.y || p.x > box.z || p.y > box.w) return false;
  bool c = false;
  for (int i = 0, j = 31; i < 32; j = i++) if ((P[i].y > p.y) != (P[j].y > p.y) && p.x < (P[j].x - P[i].x) * (p.y - P[i].y) / (P[j].y - P[i].y) + P[i].x) c = !c;
  return c;
}
uniform sampler2D uPhotoMap, uPhotoMask, uTouchPaint, uTouchMask, uTouchPig, uLayOv, uLayPig, uLaySurf, uLayGlow;
uniform float uHasLay, uShowSel, uGlowK;
varying float vSel;
varying vec3 vObj; varying vec2 vSkinUv;
uniform float uMouthOn; uniform vec2 uMouthZ; uniform vec2 uMouthP[32]; uniform vec4 uMouthBox;   // the mouth's opening (index.html)
uniform vec2 uMouthD[16];                                          // the opening's front depth along x: (x, z), corner to corner
float mouthFront(float x) {                                        // how far forward the opening is at x: skin in front of it stays
  float z = uMouthD[0].y;
  for (int i = 0; i < 15; i++) if (x >= min(uMouthD[i].x, uMouthD[i + 1].x) && x <= max(uMouthD[i].x, uMouthD[i + 1].x)) {
    float dx = uMouthD[i + 1].x - uMouthD[i].x; z = mix(uMouthD[i].y, uMouthD[i + 1].y, abs(dx) < 1e-6 ? 0.0 : (x - uMouthD[i].x) / dx); }
  return z;
}
uniform float uLipOn, uLipZ, uLipAmt, uLipGrad, uLipGloss, uLipSoft, uLipLines, uLipDepth, uLipFar, uLipN; uniform vec2 uLipP[32], uLipC; uniform vec3 uLipCol; uniform vec4 uLipBox;   // the lipstick (index.html, lips.js)
float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-14), 0.0, 1.0); return length(pa - ba * h); }
float cutCover(vec2 P[32], vec4 box, vec2 p, float px) {           // the skin at an opening: 0 inside, 1 outside, the edge over a
  if (p.x < box.x - 2.0 * px || p.y < box.y - 2.0 * px || p.x > box.z + 2.0 * px || p.y > box.w + 2.0 * px) return 1.0;   // pixel (px:
  float d = 1e9; for (int i = 0, j = 31; i < 32; j = i++) d = min(d, segD(p, P[j], P[i]));   // a pixel's size here), as alpha to
  return clamp(0.5 + (inCut(P, box, p) ? -d : d) / px, 0.0, 1.0);                           // coverage: no stair-steps
}
float lipSD(vec2 p) {                                              // how far inside the lipstick's outline (+) or outside it (-)
  float d = 1e9; for (int i = 0, j = 31; i < 32; j = i++) d = min(d, segD(p, uLipP[j], uLipP[i]));
  return inCut(uLipP, uLipBox, p) ? d : -d;
}
float skinH, skinRough, skinCoat, skinCoatR = -1.0, skinSm = 0.0;   // skinSm: a layer's smoothing (evens out the pores, grain and relief)
// the fingernails (nails.js): vNail per point (along: 0 the cuticle to 1 the free edge's end, across -1..1, how much it
// faces the finger's back, the finger 0..9 or -1)
uniform float uNailOn, uNailTint, uNailHalf, uNailFree, uNailShine, uNailShape, uNailPaint, uNailStyle, uNailFinish, uNailCover, uNailAccent;
uniform vec3 uNailCol, uNailCol2;
varying vec4 vNail;
float nailM = 0.0, nailRough = 1.0, nailCoat = 0.0, nailCoatR = 0.1, nailMetal = 0.0, nailH = 0.0;
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
// the distance to a line of points carrying a width each, and the width at its nearest point
vec2 line9w(vec3 p, vec4 L[9]) {
  float d = 1e9, w = 0.0;
  for (int k = 0; k < 8; k++) {
    vec3 a = L[k].xyz, ba = L[k + 1].xyz - a, pa = p - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-14), 0.0, 1.0), l = length(pa - ba * h);
    if (l < d) { d = l; w = mix(L[k].w, L[k + 1].w, h); }
  }
  return vec2(d, w);
}
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

// ---- the fingernails, painted on the fingertips ------------------------------------------------------------------------
float nailEnd(float x) {                                       // the free edge's end across the nail, by its shape (1 at the middle)
  float ax = min(abs(x), 1.0), s = uNailShape;
  if (s < 0.5) return 1.0 - 0.05 * pow(ax, 8.0);                // square: straight across, its corners just softened
  if (s < 1.5) return 1.0 - 0.12 * pow(ax, 4.0);                // squoval
  if (s < 2.5) return 1.0 - 0.2 * (1.0 - sqrt(max(1.0 - ax * ax, 0.0)));   // round: an arc
  if (s < 3.5) return 1.0 - 0.3 * ax * ax;                       // oval
  return 1.0 - 0.45 * pow(ax, 1.4);                              // almond: toward a point
}
vec3 paintNail(vec3 c) {
  float x = vNail.y, y = vNail.x, fx = max(fwidth(x), 1e-4), fy = max(fwidth(y), 1e-4), back = clamp(vNail.z, 0.0, 1.0), ax = abs(x);
  float y0 = 0.2 * x * x, y1 = nailEnd(x);                       // the cuticle's arc (lowest in the middle) and the free edge's end
  float m = smoothstep(-fx, fx, 1.0 - ax) * smoothstep(-fy, fy, y - y0) * smoothstep(-fy, fy, y1 - y) * back;
  float inner = min(min((1.0 - ax) * 0.5, y - y0), y1 - y);       // how far inside the plate's edge (nail lengths)
  // round the plate: the skin's folds (the cuticle, the grooves at its sides), a little raised, darker and pinker
  float outd = max(max(ax - 1.0, y0 - y), 0.0), fold = (1.0 - m) * back * exp(-pow(outd / 0.14, 2.0)) * smoothstep(y1 + 0.06, y1 - 0.02, y) * smoothstep(-0.65, -0.45, y);
  c = mix(c, c * vec3(0.93, 0.8, 0.8), 0.45 * fold);
  nailH = 0.35 * fold + 0.9 * smoothstep(-0.015, 0.06, inner) * back;   // the plate a little proud of the folds, its edge rounded over a few pixels (a step would speckle)
  if (m <= 0.0) return c;
  nailM = m;
  // the bare nc: its bed seen through it, pinker; the pale hmoon moon at its base; the free edge past the bed off-white
  vec3 bed = mix(c, c * vec3(1.1, 0.84, 0.86) + vec3(0.05, 0.012, 0.02), uNailTint);
  float hmEdge = y0 + 0.24 * sqrt(max(1.0 - 1.2 * x * x, 0.0)), hmoon = uNailHalf * (1.0 - smoothstep(-fy, 2.0 * fy + 0.03, y - hmEdge));
  float fw = (0.035 + 0.3 * uNailFree) * (1.0 + 0.8 * x * x), ys = y1 - fw;   // the smile line: deeper at the sides
  float tip = smoothstep(-fy, fy, y - ys) * step(0.001, uNailFree + 0.001);
  vec3 nc = mix(bed, mix(bed, vec3(0.98, 0.92, 0.9), 0.6), hmoon);
  nc = mix(nc, vec3(0.97, 0.95, 0.9), 0.85 * tip);
  float rid = 0.6 * sin(x * 29.0 + 1.3) + 0.4 * sin(x * 61.0 + 0.4);   // faint ridges along it
  nc *= 1.0 + 0.012 * rid;
  nc *= 1.0 - 0.1 * smoothstep(0.75, 1.0, ax) * (1.0 - tip); // darker where it curves down at its sides
  nailH += 0.04 * rid * m;                                       // its ridges
  nailRough = mix(0.62, 0.16, uNailShine); nailCoat = mix(0.15, 0.85, uNailShine); nailCoatR = mix(0.4, 0.06, uNailShine);
  if (uNailPaint > 0.5) {                                        // the polish over it
    float id = vNail.w, acc = uNailAccent > 0.5 && (abs(id - 3.0) < 0.5 || abs(id - 8.0) < 0.5) ? 1.0 : 0.0;   // the ring fingers
    vec3 A = acc > 0.5 ? uNailCol2 : uNailCol, B = acc > 0.5 ? uNailCol : uNailCol2, pc = A;
    float st = uNailStyle, a = smoothstep(-fy, fy, y - (y0 + 0.035)) * smoothstep(-fx, fx, 0.96 - ax);   // a hair's margin at the cuticle and the sides
    float ftip = smoothstep(-fy, fy, y - (ys - 0.04));
    if (st < 0.5) { }                                            // full
    else if (st < 1.5) { pc = mix(B, A, ftip); a *= mix(0.45, 1.0, ftip); }   // French: the tip, a sheer pink over the rest
    else if (st < 2.5) a *= smoothstep(-fy, fy + 0.02, y - (hmEdge + 0.02));  // hmoon moon: the moon left bare
    else if (st < 3.5) pc = mix(A, B, smoothstep(0.1, 0.95, y)); // ombré: base to tip
    else if (st < 4.5) a *= ftip;                                // tips
    else { vec2 q = vec2(x * 1.25, y * 2.2) * 1.6; q.x += 0.5 * floor(q.y); vec2 f = fract(q) - 0.5;   // dots
           float r = length(f * vec2(1.0, 1.2)); pc = mix(A, B, 1.0 - smoothstep(0.17 - 0.06, 0.17 + 0.06, r)); }
    a *= uNailCover;
    float fin = uNailFinish, see = fin > 3.5 ? 0.55 : 1.0;      // jelly: the nc shows through
    vec3 coat = pc;
    if (fin > 2.5 && fin < 3.5) {                                // glitter: flakes catching the light
      vec2 g = cells(vec3(x * 9.0, y * 14.0, id * 3.7));
      float flake = (1.0 - smoothstep(0.1, 0.25, g.x)) * step(0.4, g.y);
      coat = mix(pc, mix(pc, vec3(1.0), 0.6) * 1.35, flake * (0.4 + 0.6 * g.y));
    }
    nc = mix(nc, coat, clamp(a * see, 0.0, 1.0));
    float r = fin < 0.5 ? 0.07 : fin < 1.5 ? 0.75 : fin < 2.5 ? 0.12 : fin < 3.5 ? 0.1 : 0.06;
    nailRough = mix(nailRough, r, a); nailCoat = mix(nailCoat, fin > 0.5 && fin < 1.5 ? 0.0 : 1.0, a); nailCoatR = mix(nailCoatR, fin > 0.5 && fin < 1.5 ? 0.6 : 0.03, a);
    if (fin > 1.5 && fin < 2.5) nailMetal = a;                   // chrome: a metal, its colour the reflection's
    nailH += 0.25 * a * smoothstep(0.0, 0.05, inner);             // the polish's own thickness
  }
  return mix(c, nc, m);
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
    vec3 outer = k == 0 ? uLidUL[0] : uLidUR[0], inner = k == 0 ? uLidUL[8] : uLidUR[8], lidc = k == 0 ? uLidCL : uLidCR;
    float du = k == 0 ? line9(p, uLidUL) : line9(p, uLidUR);         // to the upper lid's line, and the lower's
    float dlo = k == 0 ? line9(p, uLidLL) : line9(p, uLidLR);
    float ex = clamp(dot(p - inner, uRight) * side / max(dot(outer - inner, uRight) * side, 1e-4), 0.0, 1.0);   // along the eye: 0 the inner corner, 1 the outer
    float lower = smoothstep(-0.001 * s, 0.001 * s, du - dlo);        // nearer the lower lid than the upper: under the eye (eased over 2 mm: a step drew a line up from the inner corner under a strong wash)
    float outw = clamp(dot(p - lidc, uRight) * side / (0.012 * s) + 0.5, 0.0, 1.0);   // thicker toward the outer corner
    // the liner: the band on the lid's skin between the lashes' roots (the lid's front edge, uLidF*: the rim between the
    // eye and the roots is the lash line's, browlash.js) and a line a liner's width out from them on the skin (uLidT*,
    // thicker toward the outer corner): between two lines the distances to them add up to their separation, outside
    // they add up to more, in any pose of the lid; its wing from the outer corner
    float lw = uf_linerWidth, mm = 0.001 * s;
    float d0 = k == 0 ? line9(p, uLidFL) : line9(p, uLidFR); vec2 d1 = k == 0 ? line9w(p, uLidTL) : line9w(p, uLidTR);
    float ln = 1.0 - smoothstep(d1.y, d1.y + 0.4 * mm, d0 + d1.x);
    float wgl = 0.005 * s * (0.6 + 0.4 * lw);                      // the wing: out and up from the outer corner, tapering to a point
    vec3 tip = outer + uRight * side * wgl + uUp * uf_wing * 0.55 * wgl;
    float wingd = seg(p, outer, tip), ww = (0.00025 + 0.00025 * lw) * s * (1.0 - clamp(dot(p - outer, uRight) * side / wgl, 0.0, 1.0));   // (a flick, not a patch)
    ln = max(ln, 1.0 - smoothstep(ww, ww + 0.0004 * s, wingd));
    // the inner corner's point: the liner carried on past the inner corner toward the nose, a little down, to a sharp point
    float il = 0.0045 * s * uf_linerInner;
    vec3 itip = inner - uRight * side * il - uUp * 0.25 * il;
    float innd = seg(p, inner, itip), iw = 0.0003 * s * lw * (1.0 - clamp(dot(inner - p, uRight) * side / max(il, 1e-5), 0.0, 1.0));
    ln = max(ln, (1.0 - smoothstep(iw, iw + 0.0004 * s, innd)) * step(0.001, uf_linerInner));
    // the lower liner: the same band under the eye, between the lower lashes' roots (the lower lid's front edge, uLowF*:
    // the waterline stays bare between it and the eye) and a line its width down the skin (uLowB*), from the outer
    // corner as far along as its reach, thinning out before the inner corner
    float e0 = k == 0 ? line9(p, uLowFL) : line9(p, uLowFR); vec2 e1 = k == 0 ? line9w(p, uLowBL) : line9w(p, uLowBR);
    float past = -dot(p - inner, uRight) * side / max(dot(outer - inner, uRight) * side, 1e-4);   // how far past the inner corner toward the nose (eye widths)
    float lo = (1.0 - smoothstep(e1.y, e1.y + 0.35 * mm, e0 + e1.x)) * smoothstep(1.0 - uf_lowerReach - 0.08, 1.0 - uf_lowerReach + 0.12, ex) * (1.0 - smoothstep(0.0, 0.06, past));
    float ss = uf_shadowSize;                                         // how far it spreads (a smoky eye's up to the crease and out past the corner)
    float above = smoothstep(-0.0005 * s - 0.0015 * ss * s, 0.0, dot(p - lidc, uUp));   // eyeshadow: from the lid up toward the brow (eased in under the lid's middle: a step drew a straight line across the skin past the inner corner)
    float sh = exp(-pow(du / (0.0065 * ss * s), 2.0)) * above * near(p, lidc + uUp * 0.004 * ss * s, 0.016 * ss);
    sh *= mix(1.0, smoothstep(0.1, 0.8, ex), uf_shadowPlace);        // gathered at the outer corner
    c = mix(c, c * uc_shadowColor * 1.3, clamp(uf_shadow * sh, 0.0, 1.0));
    // under the eye: a wash along the lower lid from the lashes down, fuller toward the outer corner, round the corner
    // itself where it meets the shadow (the halo of colour round an anime eye)
    float un = exp(-pow(dlo / (0.0045 * ss * s), 2.0)) * (0.45 + 0.55 * smoothstep(0.1, 0.8, ex));
    un = max(un * lower, 0.6 * near(p, outer + uRight * side * 0.002 * ss * s - uUp * 0.001 * s, 0.004 * ss));
    c = mix(c, c * uc_underColor * 1.35, clamp(uf_under * un, 0.0, 1.0));
    float cr = near(p, inner - uRight * side * 0.0012 * s, 0.0034) * (1.0 - 0.5 * smoothstep(0.0, 0.004 * s, dot(p - inner, uUp)));   // the inner corner: a dab round it, less above
    c = mix(c, c * uc_cornerColor * 1.4, clamp(uf_corner * cr, 0.0, 1.0));
    skinCoat += 0.3 * uf_corner * cr;                                 // its shimmer
    float wl = exp(-pow(dlo / (0.0007 * s), 2.0)) * lower * smoothstep(0.0, 0.12, ex) * (1.0 - smoothstep(0.8, 1.0, ex)) * (0.7 + 0.3 * (1.0 - ex));   // the waterline: the lower rim, corner to corner
    c = mix(c, c * uc_waterColor * 1.3, clamp(uf_waterline * wl, 0.0, 1.0));
    skinRough *= 1.0 - 0.5 * uf_waterline * wl; skinCoat += 0.4 * uf_waterline * wl;   // wet
    float dl = k == 0 ? line9(p + uUp * 0.0035 * s, uLidLL) : line9(p + uUp * 0.0035 * s, uLidLR);   // aegyo-sal: under the lashes
    float ag = exp(-pow(dl / (0.0021 * s), 2.0));
    c = mix(c, c * 1.12 + 0.02, uf_aegyo * ag * 0.6);
    skinCoat += 0.2 * uf_aegyo * ag;
    c = tint(c, uc_linerColor, clamp(max(uf_liner * ln, uf_lowerLiner * lo) * fr, 0.0, 1.0), 1.0);
  }
  return c;
}`;

// the material's shader, with the skin added; uniforms are shared so sliders only change numbers
export function procedural(material) {
  const u = { uProc: { value: 0 }, uPigOn: { value: 0 }, uScale: { value: 1 }, uHasPhoto: { value: 0 }, uTone: { value: new THREE.Color() }, uPhotoTone: { value: new THREE.Color(1, 1, 1) },
              uPhotoMap: { value: null }, uPhotoMask: { value: null },
              uHasTouch: { value: 0 }, uTouchPaint: { value: null }, uTouchMask: { value: null }, uHasPig: { value: 0 }, uTouchPig: { value: null },
              uHasLay: { value: 0 }, uShowSel: { value: 0 }, uGlowK: { value: 1 }, uLayOv: { value: null }, uLayPig: { value: null }, uLaySurf: { value: null }, uLayGlow: { value: null },
              uCutOn: { value: 0 }, uCutL: { value: Array.from({ length: 32 }, () => new THREE.Vector2()) }, uCutR: { value: Array.from({ length: 32 }, () => new THREE.Vector2()) },
              uCutZ: { value: new THREE.Vector2() }, uCutBoxL: { value: new THREE.Vector4() }, uCutBoxR: { value: new THREE.Vector4() },
              uLipOn: { value: 0 }, uLipZ: { value: 0 }, uLipAmt: { value: 0.8 }, uLipGrad: { value: 0.5 }, uLipGloss: { value: 0.6 }, uLipSoft: { value: 0.001 }, uLipLines: { value: 0.3 },
              uLipDepth: { value: 0.004 }, uLipFar: { value: 0.06 }, uLipN: { value: 300 }, uLipP: { value: Array.from({ length: 32 }, () => new THREE.Vector2()) }, uLipC: { value: new THREE.Vector2() }, uLipCol: { value: new THREE.Color() }, uLipBox: { value: new THREE.Vector4() },
              uNailOn: { value: 0 }, uNailTint: { value: 0.5 }, uNailHalf: { value: 0.5 }, uNailFree: { value: 0.35 }, uNailShine: { value: 0.5 }, uNailShape: { value: 2 },
              uNailPaint: { value: 0 }, uNailStyle: { value: 0 }, uNailFinish: { value: 0 }, uNailCover: { value: 1 }, uNailAccent: { value: 0 }, uNailCol: { value: new THREE.Color() }, uNailCol2: { value: new THREE.Color() },
              uMouthOn: { value: 0 }, uMouthZ: { value: new THREE.Vector2() }, uMouthP: { value: Array.from({ length: 32 }, () => new THREE.Vector2()) }, uMouthBox: { value: new THREE.Vector4() }, uMouthD: { value: Array.from({ length: 16 }, () => new THREE.Vector2()) } };   // the layers (layers.js)   // the touch-up (touchup.js)
  for (const f of FEATURES) u["uf_" + f[0]] = { value: f[5] };
  for (const c of COLOURS) u["uc_" + c[0]] = { value: new THREE.Color(c[2]) };
  for (const k of [...Object.keys(POINTS), "uEarL", "uEarR", "uFaceC", "uMouthC", "uRight", "uUp", "uFwd"]) u[k] = { value: new THREE.Vector3() };
  for (const k of [...Object.keys(LIDS), "FL", "FR"]) u["uLid" + k] = { value: Array.from({ length: 9 }, () => new THREE.Vector3()) };
  for (const k of ["TL", "TR"]) u["uLid" + k] = { value: Array.from({ length: 9 }, () => new THREE.Vector4()) };
  for (const k of ["FL", "FR"]) u["uLow" + k] = { value: Array.from({ length: 9 }, () => new THREE.Vector3()) };   // the lower liner's lines
  for (const k of ["BL", "BR"]) u["uLow" + k] = { value: Array.from({ length: 9 }, () => new THREE.Vector4()) };
  material.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec2 skinUv; attribute float selW; attribute vec4 nail; attribute vec3 objPos; varying float vSel; varying vec3 vObj; varying vec2 vSkinUv; varying vec4 vNail;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = objPos; vSkinUv = skinUv; vSel = selW; vNail = nail;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + COMMON)
      .replace("#include <color_fragment>", `vec2 cutFw = fwidth(vObj.xy); float cutPx = max(max(cutFw.x, cutFw.y), 1e-7), cutA = 1.0;   // a pixel's size, taken before any branch
if (uMouthOn > 0.5 && vObj.z > uMouthZ.x && vObj.z < mouthFront(vObj.x)) cutA = cutCover(uMouthP, uMouthBox, vObj.xy, cutPx);   // the mouth's opening: index.html draws the inside behind it
if (uCutOn > 0.5) { if (vObj.z > uCutZ.x) cutA = min(cutA, cutCover(uCutL, uCutBoxL, vObj.xy, cutPx)); if (vObj.z > uCutZ.y) cutA = min(cutA, cutCover(uCutR, uCutBoxR, vObj.xy, cutPx)); }   // the eyes cut out
if (cutA <= 0.0) discard;
diffuseColor.a = cutA;                                             // the skin is opaque but at the openings' edges (alphaToCoverage)
skinH = 0.0; skinRough = 1.0; skinCoat = 0.0; skinCoatR = -1.0; skinSm = uHasLay > 0.5 ? texture2D(uLayGlow, vSkinUv).a : 0.0;
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
if (uLipOn > 0.5 && vObj.z > uLipZ && vObj.x > uLipBox.x - uLipSoft && vObj.y > uLipBox.y - uLipSoft && vObj.x < uLipBox.z + uLipSoft && vObj.y < uLipBox.w + uLipSoft) {
  float sd = lipSD(vObj.xy), m = smoothstep(-0.5 * uLipSoft, uLipSoft, sd);   // the lipstick: soft at its border
  float gr = mix(1.0, smoothstep(0.0, uLipDepth, sd), uLipGrad);              // a gradient: strongest in the middle
  vec2 far = uLipC + vec2(0.0, vObj.y < uLipC.y ? uLipFar : -uLipFar);   // fine creases square to the lip's border: nearly upright, fanning a little
  float ln = uLipLines * smoothstep(0.6, 0.95, 0.5 + 0.5 * sin(atan(vObj.x - far.x, abs(vObj.y - far.y)) * uLipN + 2.5 * fbm(vObj * 600.0)));
  diffuseColor.rgb = tint(diffuseColor.rgb, uLipCol, clamp(uLipAmt * m * gr, 0.0, 1.0), 1.3) * (1.0 - 0.16 * ln * m);
  skinRough *= 1.0 - 0.7 * uLipGloss * m * (1.0 - 0.5 * ln);
  skinCoat = max(skinCoat, 0.85 * uLipGloss * m * (1.0 - 0.6 * ln));
}
if (uNailOn > 0.5 && vNail.w > -0.5 && vNail.z > 0.001 && vNail.x > -0.7 && vNail.x < 1.1) diffuseColor.rgb = paintNail(diffuseColor.rgb);   // the fingernails
if (uHasTouch > 0.5) { vec4 tp = texture2D(uTouchPaint, vSkinUv); diffuseColor.rgb = mix(diffuseColor.rgb, tp.rgb, tp.a); }
if (uHasPig > 0.5 && uPigOn > 0.5) diffuseColor.rgb *= pow(texture2D(uTouchPig, vSkinUv).rgb, vec3(uf_pigStrength / 1.4));   // the pigment strokes: filters, multiplied together   // the touch-up's paint, over all
if (uHasLay > 0.5) {                                                   // the layers above the base: pigment (filters), paint over, then the surface (gloss, relief)
  diffuseColor.rgb *= texture2D(uLayPig, vSkinUv).rgb;
  vec4 lo = texture2D(uLayOv, vSkinUv); diffuseColor.rgb = diffuseColor.rgb * (1.0 - lo.a) + lo.rgb;   // premultiplied
  vec4 sf = texture2D(uLaySurf, vSkinUv);
  skinRough *= max(sf.r * 4.0, 0.04); skinCoat = clamp(skinCoat + sf.g, 0.0, 1.0); skinH += (sf.b - 0.50196) * 14.0; if (sf.g > 0.01) skinCoatR = 1.0 - sf.a;
}
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.55, 0.1), clamp(vSel, 0.0, 1.0) * 0.55 * uShowSel);   // the selection, shown
#include <color_fragment>`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
if (uProc > 0.5 || uHasLay > 0.5 || uLipOn > 0.5) roughnessFactor = clamp(roughnessFactor * skinRough, 0.06, 1.0);
roughnessFactor = mix(roughnessFactor, nailRough, nailM);`)
      .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 1.0, nailMetal * nailM);   // a chrome polish`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
if (uProc > 0.5 || uHasLay > 0.5 || uNailOn > 0.5) {                                  // the relief (pores, wrinkles, a nail's edge), from how the height changes across the pixel
  vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), r1 = cross(sy, normal), r2 = cross(normal, sx);
  float hh = skinH + nailH, det = dot(sx, r1); vec2 dh = vec2(dFdx(hh), dFdy(hh)) * 0.00025;
  normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
// uGlowK: how much of this light from within shows (1; 0 under the reference light, which shows the skin without it:
// it ignores the lights and glows in the dark, docs/research/skin_v2.md §3, until v2 step 4 makes it light-driven)
if (uHasLay > 0.5) totalEmissiveRadiance += uGlowK * texture2D(uLayGlow, vSkinUv).rgb * 0.5 * (0.5 + 0.5 * diffuseColor.r);   // light from within, painted: thin skin, an ear's rim
if (uProc > 0.5) {                                                   // light through the skin: the rims, the ears; less with age
  float rim = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 2.5);
  float ears = max(near(vObj, uEarL, 0.03), near(vObj, uEarR, 0.03));
  totalEmissiveRadiance += uGlowK * vec3(0.55, 0.12, 0.08) * uf_translucency * (1.0 - 0.6 * uf_age) * (0.35 * rim + 0.5 * ears) * diffuseColor.rgb;
}`)
      .replace("#include <lights_physical_fragment>", `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
if (uProc > 0.5 || uHasLay > 0.5 || uLipOn > 0.5 || uNailOn > 0.5) { material.clearcoat = clamp(skinCoat, 0.0, 1.0); if (skinCoatR >= 0.0) material.clearcoatRoughness = clamp(skinCoatR, 0.03, 1.0); }  // the coat: the dewy glow, the oil, the gloss
if (nailM > 0.0) { material.clearcoat = mix(material.clearcoat, nailCoat, nailM); material.clearcoatRoughness = mix(material.clearcoatRoughness, nailCoatR, nailM); }   // a nail's gloss, a polish's
#endif`);
  };
  material.customProgramCacheKey = () => "studio-skin-15";
  return u;
}

// the settings into the uniforms; landmarks (lm(i): a point on the body now) place everything on the face; rim(side,
// pts, ws, which), when given, finds a lid's front edge at its nine points and the skin ws mm out from it (index.html's
// rimOf: the liner is painted between the two; which "upper", or "lower" for the lower liner, ws mm down the skin);
// without it the edge is taken as a little up (down) and forward of the lid line, fading to it at the corners, and the
// liner's other line straight up (down) from it
export const LID_RINGS = LIDS;
export function update(u, set, tone, lm, scale, rim = null) {
  u.uProc.value = set.on ? 1 : 0; u.uPigOn.value = set.pigmentOn ? 1 : 0; u.uScale.value = scale;
  for (const f of FEATURES) u["uf_" + f[0]].value = set[f[0]] ?? f[5];
  for (const c of COLOURS) u["uc_" + c[0]].value.set(set[c[0]] ?? c[2]);   // three converts the sRGB hex itself
  u.uTone.value.set(tone);
  if (!lm) return;
  const v = i => new THREE.Vector3(...lm(i));
  for (const [k, i] of Object.entries(POINTS)) u[k].value.copy(v(i));
  for (const [k, ids] of Object.entries(LIDS)) ids.forEach((i, j) => u["uLid" + k].value[j].copy(v(i)));
  const X = v(454).sub(v(234)).normalize(), U = v(10).sub(v(152)); U.sub(X.clone().multiplyScalar(U.dot(X))).normalize();
  u.uRight.value.copy(X); u.uUp.value.copy(U); u.uFwd.value.crossVectors(X, U);
  const widths = k => [...Array(9)].map((_, j) => { const ex = 1 - j / 8, t = Math.max(0, Math.min(1, (ex - 0.35) / 0.6)); return (0.7 + 0.8 * t * t * (3 - 2 * t)) * k; });   // a liner's width (mm) at each point: thicker toward the outer corner (j = 0)
  const ws = widths(set.linerWidth ?? 1);
  for (const [k, ids] of [["F", LIDS.UL], ["F", LIDS.UR]].map(([a, b], i) => [a + (i ? "R" : "L"), b])) {
    const side = k === "FL" ? "L" : "R", pts = ids.map(lm), got = rim ? rim(side, pts, ws) : null, F = u.uFwd.value;
    pts.forEach((q, j) => {
      const fade = Math.min(1, j / 2, (8 - j) / 2), w = ws[j] * 0.001 * scale;
      const f = got ? got.front[j] : [q[0] + (U.x * 0.0012 + F.x * 0.002) * scale * fade, q[1] + (U.y * 0.0012 + F.y * 0.002) * scale * fade, q[2] + (U.z * 0.0012 + F.z * 0.002) * scale * fade];
      const t = got ? got.top[j] : [f[0] + U.x * w, f[1] + U.y * w, f[2] + U.z * w];
      u["uLid" + k].value[j].set(f[0], f[1], f[2]);
      u["uLidT" + side].value[j].set(t[0], t[1], t[2], Math.max(0.0002 * scale, Math.hypot(t[0] - f[0], t[1] - f[1], t[2] - f[2])));   // (its w: the lines' separation there)
    });
  }
  // the lower liner's: the lower lid's front edge, where the lower lashes grow (rim(..., "lower")), and the skin its width
  // down from it; without rim, a little down and forward of the lid line, fading to it at the corners
  const wl = widths(set.lowerWidth ?? 0.8);
  for (const side of ["L", "R"]) {
    const pts = LIDS["L" + side].map(lm), got = rim ? rim(side, pts, wl, "lower") : null, F = u.uFwd.value;
    pts.forEach((q, j) => {
      const fade = Math.min(1, j / 2, (8 - j) / 2), w = wl[j] * 0.001 * scale;
      const f = got ? got.front[j] : [q[0] + (-U.x * 0.0006 + F.x * 0.0012) * scale * fade, q[1] + (-U.y * 0.0006 + F.y * 0.0012) * scale * fade, q[2] + (-U.z * 0.0006 + F.z * 0.0012) * scale * fade];
      const b = got ? got.top[j] : [f[0] - U.x * w, f[1] - U.y * w, f[2] - U.z * w];
      u["uLowF" + side].value[j].set(f[0], f[1], f[2]);
      u["uLowB" + side].value[j].set(b[0], b[1], b[2], Math.max(0.0002 * scale, Math.hypot(b[0] - f[0], b[1] - f[1], b[2] - f[2])));
    });
  }
  const out = (a, b) => v(a).add(v(a).sub(v(b)).multiplyScalar(0.12)).add(new THREE.Vector3(0, 0, -0.02 * scale));
  u.uEarL.value.copy(out(454, 234)); u.uEarR.value.copy(out(234, 454));
  u.uFaceC.value.copy(v(4).add(v(10)).multiplyScalar(0.5));
  u.uMouthC.value.copy(v(13).add(v(14)).multiplyScalar(0.5));
}

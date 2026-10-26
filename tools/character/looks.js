// looks.js: whole looks for a character (Character Studio, Face, Look): the eyes, the lips, the teeth and the skin set
// together, each a starting point to tune. "Soft cinematic" is after the user's reference (docs/research/look_reference.md:
// the iris melting into the white, wet eyes, gradient coral lips, bright wet teeth, dewy porcelain skin with a blush
// under the eyes) and new characters start from it. Only the settings named are changed; the face, the body, the
// clothes and the hair are the character's own.
export const LOOKS = {
  "soft cinematic": {
    about: "After the user's reference: dark irises melting into the white, wet eyes (occlusion, a tear line), coral gradient lips with gloss, bright wet teeth, dewy porcelain skin with a blush under the eyes.",
    eyes: { iris: "#2a1810", iris2: "#5a3820", sclera: "#ece8e5", corner: "#e6a0a0", irisSize: 32, pupil: 0.36, fibres: 0.3, limbal: 0.6, limbalWidth: 0.2,
            limbalSoft: 0.6, catch1: 1, catchSize: 0.2, catch2: 0.6, scleraShade: 0.45, cornerPink: 0.45, gloss: 1, lidShade: 0.65, occlusion: 0.5, tearline: 0.5 },
    lips: { on: true, colour: "#d9606c", amount: 0.7, gradient: 0.6, soft: 0.5, gloss: 0.7, lines: 0.3 },
    teeth: { shade: 0.2 },
    skin: { preset: "young glass",
            tweak: { pores: 0.04, grain: 0.06, dewy: 0.5 },          // smoother than the preset: its pores catch the wet coat as specks
            makeup: { foundation: 0.4, blush: 0.5, blushPlace: 0.85, blushColor: "#ec7a84", lips: 0, liner: 0.15, wing: -0.3, linerColor: "#3a2620",
                      shadow: 0.15, shadowColor: "#c48a80", aegyo: 0.3 } },
  },
  "MHR plain": {
    about: "MHR's own look: crisp eyes, no lipstick, the procedural skin off (the photo skin, if any, as it is).",
    eyes: { limbalSoft: 0, occlusion: 0, tearline: 0, lidShade: 0.6 },
    lips: { on: false },
    teeth: { shade: 0.35 },
    skin: { off: true },
  },
};
export const NEW_LOOK = "soft cinematic";                  // what a new character starts from

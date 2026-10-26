// looks.js: whole looks for a character (Character Studio, Face, Look): the eyes, the lips, the teeth and the skin set
// together (and, where a look names them, the lashes and the brows), each a starting point to tune. "Soft cinematic" is after the user's reference (docs/research/look_reference.md:
// the iris melting into the white, wet eyes, gradient coral lips, bright wet teeth, dewy porcelain skin with a blush
// under the eyes) and new characters start from it. Only the settings named are changed; the face, the body, the
// clothes and the hair are the character's own.
export const LOOKS = {
  "soft cinematic": {
    about: "After the user's reference: dark irises melting into the white, wet eyes (occlusion, a tear line), coral gradient lips with gloss, bright wet teeth, dewy porcelain skin with a blush under the eyes.",
    eyes: { iris: "#2a1810", iris2: "#5a3820", sclera: "#ece8e5", corner: "#e6a0a0", irisSize: 32, pupil: 0.33, fibres: 0.3, limbal: 0.6, limbalWidth: 0.2,
            limbalSoft: 0.6, catch1: 1, catchSize: 0.2, catch2: 0.6, scleraShade: 0.45, cornerPink: 0.45, gloss: 1, lidShade: 0.65, occlusion: 0.5, tearline: 0.5 },
    lips: { on: true, colour: "#d9606c", amount: 0.7, gradient: 0.6, soft: 0.5, gloss: 0.7, lines: 0.3 },
    teeth: { shade: 0.2 },
    skin: { preset: "young glass",
            tweak: { pores: 0.04, grain: 0.06, dewy: 0.5 },          // smoother than the preset: its pores catch the wet coat as specks
            makeup: { foundation: 0.4, blush: 0.5, blushPlace: 0.85, blushColor: "#ec7a84", lips: 0, liner: 0.15, wing: -0.3, linerColor: "#3a2620",
                      shadow: 0.15, shadowColor: "#c48a80", aegyo: 0.3 } },
  },
  // after the user's references (DECISIONS 2026-10-26, night: an anime lash set photographed on an eye, and drawn eyes
  // ringed in pink): the anime lashes with the pink eye makeup, on the soft cinematic eyes, lips and skin
  "anime pink": {
    about: "After the user's references: an anime lash set (spikes with gaps between them, long alternating with short, longest at the outer corner, the lower lashes in wisps down the skin), a bold winged liner carried to a point at the inner corner, and the pinkish hues that draw the eye's shape: a mauve-pink shadow at the outer corner, a wash under the lower lashes, a pink inner corner and waterline, aegyo-sal; big dark irises, pink gradient lips, dewy skin.",
    eyes: { iris: "#2a1810", iris2: "#5a3820", sclera: "#ece8e5", corner: "#e6a0a0", irisSize: 35, pupil: 0.4, fibres: 0.3, limbal: 0.65, limbalWidth: 0.2,
            limbalSoft: 0.6, catch1: 1, catchSize: 0.22, catch2: 0.6, scleraShade: 0.45, cornerPink: 0.55, gloss: 1, lidShade: 0.65, occlusion: 0.5, tearline: 0.6 },
    lips: { on: true, colour: "#e06a86", amount: 0.65, gradient: 0.7, soft: 0.55, gloss: 0.8, lines: 0.2 },
    teeth: { shade: 0.2 },
    skin: { preset: "young glass", tweak: { pores: 0.04, grain: 0.06, dewy: 0.5 }, makeup: "anime pink" },   // (skinshader.js's MAKEUP_PRESETS)
    lash: { style: "anime", look: "lash_black" },          // browlash.js's LASH_STYLES, on
  },
  // the three eye shapes the user drew (DECISIONS 2026-10-26, night), as lashes and liner only: the opening stays the
  // scan's own. Each is its lash style (browlash.js) with the liner the drawing gives it (skinshader.js), on the soft
  // cinematic eyes, lips and skin
  "fox almond": {
    about: "After the user's drawing: a fox almond's lashes, a fan swept out to a wing at the outer corner and short at the inner, sparse short lower lashes; a bold liner thickening to a long wing, the inner corner drawn out to a long point and tinted pink. The opening is the character's own.",
    eyes: { irisSize: 33, pupil: 0.38 }, lips: { on: true, colour: "#d9606c", amount: 0.65, gradient: 0.6, soft: 0.5, gloss: 0.7, lines: 0.3 }, teeth: { shade: 0.2 },
    skin: { preset: "young glass", tweak: { pores: 0.04, grain: 0.06, dewy: 0.5 }, makeup: "fox liner" },
    lash: { style: "fox", look: "lash_black" },
  },
  "half-lidded": {
    about: "After the user's drawing: a half-lidded eye's lashes, dense and lying down over the top of the eye as a dark band, no lower lashes; a broad liner with a long inner point and a short outer flick, the under-eye bulge lit and pink. The opening is the character's own (its lids aren't lowered).",
    eyes: { irisSize: 33, pupil: 0.4 }, lips: { on: true, colour: "#d9606c", amount: 0.65, gradient: 0.6, soft: 0.5, gloss: 0.7, lines: 0.3 }, teeth: { shade: 0.2 },
    skin: { preset: "young glass", tweak: { pores: 0.04, grain: 0.06, dewy: 0.5 }, makeup: "half-lidded liner" },
    lash: { style: "halfLidded", look: "lash_black" },
  },
  "round doll": {
    about: "After the user's drawing: a round doll's lashes, short spikes radiating all round the eye, up and out above, down and out below; a thin liner with small points at both corners and pink all round the eye; big irises. The opening is the character's own.",
    eyes: { irisSize: 37, pupil: 0.42, cornerPink: 0.55 }, lips: { on: true, colour: "#e06a86", amount: 0.6, gradient: 0.7, soft: 0.55, gloss: 0.8, lines: 0.2 }, teeth: { shade: 0.2 },
    skin: { preset: "young glass", tweak: { pores: 0.04, grain: 0.06, dewy: 0.5 }, makeup: "doll pink" },
    lash: { style: "roundDoll", look: "lash_black" },
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

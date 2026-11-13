// looks.js: whole looks for a character (Character Studio, Face, Look): the eyes, the lips, the teeth and the skin set
// together (and, where a look names them, the lashes and the brows: a style or shape, `set` over it, a look), each a starting point to tune. "Soft cinematic" is after the user's reference (docs/research/look_reference.md:
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
  // the five lash sets of the user's second reference (docs/research/lash_reference.md: five rendered pairs of eyes, one
  // a row): each its lash set (browlash.js) with the rest of the eye as that row shows it; the irises stay the
  // character's own (the reference's are all violet)
  "older man (sparse lashes)": {
    about: "After the user's second reference, its first row (an old man): short, sparse, thin and nearly straight lashes going grey, a few lower ones; full, bushy ash brows; no makeup; red veins in the whites, the skin seventy and over. The reference's hooded upper lid is the sculpt's Hooded lids (Body).",
    eyes: { veins: 0.55, scleraShade: 0.55, sclera: "#ebe3d6", cornerPink: 0.55, limbalSoft: 0.4, occlusion: 0.55, tearline: 0.35, lidShade: 0.7 },
    lips: { on: false }, teeth: { shade: 0.45 },
    skin: { preset: "70 and over", makeup: "none" },
    lash: { style: "sparse", look: "lash_greying" },
    brow: { shape: "full", set: { length: 8.5, soft: 0.3 }, look: "brow_ash" },
  },
  "glam smoky plum": {
    about: "After the user's second reference, its second row: a glam volume lash set (long, dense, fanned into soft wispy spikes, dense long lower lashes); a thick black winged liner top and bottom in a dark plum smoke all round the eye, the inner corner lit; mauve lips.",
    eyes: { irisSize: 33, pupil: 0.36 }, lips: { on: true, colour: "#a85a6a", amount: 0.7, gradient: 0.3, soft: 0.45, gloss: 0.75, lines: 0.25 }, teeth: { shade: 0.2 },
    skin: { preset: "young glass", tweak: { pores: 0.04, grain: 0.06, dewy: 0.45 }, makeup: "smoky plum" },
    lash: { style: "glam", look: "lash_black" },
  },
  "fluffy mink": {
    about: "After the user's second reference, its third row: a fluffy mink lash set, the fullest (long, soft, criss-crossing), with long fluffy lower lashes, on bare skin: no makeup, a clean eye.",
    eyes: { irisSize: 33, pupil: 0.36 }, lips: { on: true, colour: "#c8727c", amount: 0.35, gradient: 0.5, soft: 0.6, gloss: 0.45, lines: 0.3 }, teeth: { shade: 0.2 },
    skin: { preset: "natural young", makeup: "none" },
    lash: { style: "mink", look: "lash_black" },
  },
  "doll volume": {
    about: "After the user's second reference, its fourth row: a doll volume lash set, very long and dense, swept up together in one long sweep, long lower lashes on a bold lower liner; a bold black liner above and below, the lids dark, the waterline lined.",
    eyes: { irisSize: 35, pupil: 0.38 }, lips: { on: true, colour: "#c06a76", amount: 0.6, gradient: 0.5, soft: 0.5, gloss: 0.7, lines: 0.25 }, teeth: { shade: 0.2 },
    skin: { preset: "young glass", tweak: { pores: 0.04, grain: 0.06, dewy: 0.5 }, makeup: "bold doll liner" },
    lash: { style: "dollVolume", look: "lash_black" },
  },
  "natural medium": {
    about: "After the user's second reference, its fifth row: natural medium lashes (dark, lightly curled, separated, the lower ones thin and short); a thin red-brown tint along the lower waterline on bare skin.",
    eyes: { irisSize: 33, pupil: 0.36 }, lips: { on: true, colour: "#c87a80", amount: 0.3, gradient: 0.5, soft: 0.6, gloss: 0.4, lines: 0.3 }, teeth: { shade: 0.2 },
    skin: { preset: "natural young", makeup: "tinted waterline" },
    lash: { style: "naturalMedium", look: "lash_brown_black" },
  },
  "MHR plain": {
    about: "MHR's own look: crisp eyes, no lipstick, the procedural skin off (the photo skin, if any, as it is).",
    eyes: { limbalSoft: 0, occlusion: 0, tearline: 0, lidShade: 0.6 },
    lips: { on: false },
    teeth: { shade: 0.35 },
    skin: { off: true },
  },
  // the makeup of the user's Daz3D faces (DECISIONS 2026-11-12, make-up enhanced: "analyze the daz images I shared earlier
  // and re-create those makeup looks 1:1 (the same lip gloss, shines etc, )"; docs/research/makeup_reference.md): each a
  // picture's own face, its lips first. What they share: a two-tone lip (a deeper colour where the lips meet under a
  // lighter one, lips.js Inner colour), a wet gloss with small white glints (Wet shine), a red or wine line under the
  // lower lashes (the lower liner's own colour), a flush over the nose, small highlights on the nose and the cupid's
  // bow (Highlighter), pale grey irises, separate dark lashes, straight soft brows
  "porcelain berry": {
    about: "After the twin-tail reference: porcelain skin with a soft pink flush under the eyes and over the nose; a rose lip going to berry where the lips meet, glossed, two white glints on the lower lip; a thin dark liner, a red-brown line under the lower lashes, separate lashes above and below; pale grey eyes.",
    eyes: { iris: "#45484b", iris2: "#8e9294", sclera: "#f1eeeb", corner: "#e6a4a4", irisSize: 36, pupil: 0.4, fibres: 0.45, limbal: 0.85, limbalWidth: 0.16, limbalSoft: 0.5, catch1: 1, catchSize: 0.2, catch2: 0.5,
            scleraShade: 0.4, cornerPink: 0.45, gloss: 1, lidShade: 0.5, occlusion: 0.45, tearline: 0.5 },
    lips: { on: true, colour: "#d88392", colour2: "#8a1f36", inner: 0.9, amount: 0.9, gradient: 0.2, soft: 0.6, gloss: 0.6, lines: 0.1, shine: 0.9, over: 0.4, upper: 0.5, lower: 0.2, corners: 0, bow: 0 },
    teeth: { shade: 0.2 },
    skin: { preset: "young glass", tweak: { pores: 0.03, grain: 0.05, dewy: 0.45 },
            makeup: { foundation: 0.55, blush: 0.45, blushPlace: 0.9, blushColor: "#f09aa6", lips: 0, liner: 0.5, wing: 0.1, linerWidth: 0.8, linerColor: "#1a1214",
                      lowerLiner: 0.85, lowerWidth: 0.55, lowerReach: 0.9, lowerColor: "#8a2c2c", shadow: 0.3, shadowPlace: 0.6, shadowColor: "#b87a78", under: 0.35, underColor: "#e8a0a4",
                      waterline: 0.2, waterColor: "#b85a5a", aegyo: 0.3, highlight: 0.6 } },
    lash: { style: "naturalMedium", look: "lash_black" },
    brow: { shape: "straight", set: { width: 0.72, length: 5, soft: 0.8, powder: 0.35 }, look: "brow_dark_brown" },   // (thin and soft: the pictures' brows are a faint line under a fringe)
  },
  "red satin": {
    about: "After the Christmas reference's left face: warm skin with a peach flush on the cheekbones; a true red lip, darker at the seam, satin with one soft glint; a winged dark liner, a red line under the lower lashes and a red-brown shadow at the outer corner; grey eyes.",
    eyes: { iris: "#44474a", iris2: "#888c8e", sclera: "#efebe7", corner: "#e2a09a", irisSize: 34, pupil: 0.38, fibres: 0.45, limbal: 0.85, limbalWidth: 0.16, limbalSoft: 0.5, catch1: 1, catchSize: 0.18, catch2: 0.5,
            scleraShade: 0.45, cornerPink: 0.45, gloss: 1, lidShade: 0.55, occlusion: 0.5, tearline: 0.5 },
    lips: { on: true, colour: "#c8343c", colour2: "#74121e", inner: 0.6, amount: 0.95, gradient: 0.1, soft: 0.45, gloss: 0.5, lines: 0.15, shine: 0.5, over: 0.4, upper: 0.5, lower: 0.2, corners: 0, bow: 0.1 },
    teeth: { shade: 0.2 },
    skin: { preset: "young glass", tweak: { pores: 0.04, grain: 0.06, dewy: 0.4 },
            makeup: { foundation: 0.5, blush: 0.4, blushPlace: 0.45, blushColor: "#f0907a", lips: 0, liner: 0.7, wing: 0.4, linerWidth: 1, linerColor: "#140e0e",
                      lowerLiner: 0.85, lowerWidth: 0.6, lowerReach: 0.75, lowerColor: "#8e2424", shadow: 0.45, shadowPlace: 0.7, shadowColor: "#b05048", under: 0.4, underColor: "#e08a80",
                      waterline: 0.2, waterColor: "#a84840", aegyo: 0.25, highlight: 0.5 } },
    lash: { style: "defined", look: "lash_black" },
    brow: { shape: "arched", set: { width: 0.7, arch: 0.4, length: 5, soft: 0.6, powder: 0.35 }, look: "brow_dark_brown" },
  },
  "wine doll": {
    about: "After the Christmas reference's right face: a strong pink flush across the nose and under the eyes; a wine lip nearly black-red at the seam, very wet, sharp glints; red all round the eye (a wine lower liner, a rose shadow and wash, a tinted waterline), doll lashes; big pale grey eyes.",
    eyes: { iris: "#4c4f52", iris2: "#989c9e", sclera: "#f1eeeb", corner: "#e6a0a6", irisSize: 38, pupil: 0.42, fibres: 0.45, limbal: 0.85, limbalWidth: 0.16, limbalSoft: 0.5, catch1: 1, catchSize: 0.22, catch2: 0.6,
            scleraShade: 0.4, cornerPink: 0.55, gloss: 1, lidShade: 0.5, occlusion: 0.45, tearline: 0.6 },
    lips: { on: true, colour: "#b83a4c", colour2: "#560d1c", inner: 0.9, amount: 0.9, gradient: 0.3, soft: 0.6, gloss: 0.7, lines: 0.1, shine: 1, over: 0.3, upper: 0.5, lower: 0.2, corners: -0.3, bow: 0 },
    teeth: { shade: 0.2 },
    skin: { preset: "young glass", tweak: { pores: 0.03, grain: 0.05, dewy: 0.5 },
            makeup: { foundation: 0.5, blush: 0.6, blushPlace: 1, blushColor: "#f08a98", lips: 0, liner: 0.55, wing: 0.2, linerWidth: 0.9, linerColor: "#1a1012",
                      lowerLiner: 0.95, lowerWidth: 0.7, lowerReach: 1, lowerColor: "#9a2434", shadow: 0.5, shadowPlace: 0.3, shadowSize: 1.2, shadowColor: "#c06070", under: 0.6, underColor: "#e88a98",
                      corner: 0.3, cornerColor: "#f4b4bc", waterline: 0.3, waterColor: "#b04050", aegyo: 0.4, highlight: 0.7 } },
    lash: { style: "roundDoll", look: "lash_black" },
    brow: { shape: "straight", set: { width: 0.72, length: 5, soft: 0.8, powder: 0.35 }, look: "brow_dark_brown" },   // (thin and soft: the pictures' brows are a faint line under a fringe)
  },
  "neon wing": {
    about: "After the neon reference: a bright pink-red wing drawn out from the outer corner over a pink shadow and under-eye wash, a coral-red lip with a broad wet gloss, dewy skin with highlights on the nose and cheeks; violet-blue eyes, glam lashes.",
    eyes: { iris: "#4a56a0", iris2: "#98a6de", accent: "#dfe4ff", sclera: "#f2f0f2", corner: "#eaa4b0", irisSize: 35, pupil: 0.3, fibres: 0.5, limbal: 0.75, limbalWidth: 0.15, limbalSoft: 0.5, catch1: 1, catchSize: 0.2, catch2: 0.6,
            scleraShade: 0.35, cornerPink: 0.5, gloss: 1, lidShade: 0.5, occlusion: 0.45, tearline: 0.6 },
    lips: { on: true, colour: "#e0405a", colour2: "#9a1630", inner: 0.5, amount: 0.92, gradient: 0.15, soft: 0.5, gloss: 0.75, lines: 0.1, shine: 0.85, over: 0.4, upper: 0.5, lower: 0.3, corners: 0, bow: 0.1 },
    teeth: { shade: 0.15 },
    skin: { preset: "young glass", tweak: { pores: 0.03, grain: 0.05, dewy: 0.6 },
            makeup: { foundation: 0.6, blush: 0.5, blushPlace: 0.7, blushColor: "#f48aa8", lips: 0, liner: 0.9, wing: 0.8, linerWidth: 1.4, linerInner: 0.3, linerColor: "#b81e4e",
                      lowerLiner: 0.5, lowerWidth: 0.5, lowerReach: 0.6, lowerColor: "#e03a6a", shadow: 0.8, shadowPlace: 0.6, shadowSize: 1.4, shadowColor: "#e85a8a", under: 0.6, underColor: "#f07a9a",
                      corner: 0.4, cornerColor: "#f8c0cc", waterline: 0.3, waterColor: "#e07a90", aegyo: 0.5, highlight: 0.85 } },
    lash: { style: "glam", look: "lash_black" },
    brow: { shape: "straight", set: { width: 0.72, length: 5, soft: 0.8, powder: 0.35 }, look: "brow_dark_brown" },   // (thin and soft: the pictures' brows are a faint line under a fringe)
  },
  "smoky nude": {
    about: "After the T-pose reference's face: pale matte skin, hardly a flush; a brown nude lip, matte, darker at the seam; a smoky grey-brown eye, lined above and below; grey-green eyes.",
    eyes: { iris: "#474f49", iris2: "#8a948a", sclera: "#ece9e4", corner: "#d8a09a", irisSize: 33, pupil: 0.32, fibres: 0.5, limbal: 0.8, limbalWidth: 0.16, limbalSoft: 0.5, catch1: 0.8, catchSize: 0.16, catch2: 0.4,
            scleraShade: 0.5, cornerPink: 0.4, gloss: 0.9, lidShade: 0.6, occlusion: 0.5, tearline: 0.4 },
    lips: { on: true, colour: "#8a5a4c", colour2: "#46261f", inner: 0.55, amount: 0.9, gradient: 0.1, soft: 0.5, gloss: 0.15, lines: 0.4, shine: 0, over: 0.3, upper: 0.4, lower: 0.2, corners: 0, bow: 0 },
    teeth: { shade: 0.25 },
    skin: { preset: "young glass", tweak: { pores: 0.06, grain: 0.1, dewy: 0.1 },
            makeup: { foundation: 0.45, blush: 0.1, blushPlace: 0.3, blushColor: "#d89088", lips: 0, liner: 0.75, wing: 0, linerWidth: 1.2, linerColor: "#1a1614",
                      lowerLiner: 0.65, lowerWidth: 0.9, lowerReach: 0.9, lowerColor: "#2a2220", shadow: 0.7, shadowPlace: 0.3, shadowSize: 1.5, shadowColor: "#6a5a58", under: 0.5, underColor: "#7a6a6a",
                      waterline: 0.3, waterColor: "#5a4a48", aegyo: 0, highlight: 0 } },
    lash: { style: "natural", look: "lash_black" },
    brow: { shape: "natural", set: { width: 0.8, length: 5.5, soft: 0.6, powder: 0.4 }, look: "brow_dark_brown" },
  },
};
export const NEW_LOOK = "soft cinematic";                  // what a new character starts from

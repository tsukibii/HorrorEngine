// eyelooks.js: whole eye looks as presets (Character Studio, Face, Eyes: the cards at the top; DECISIONS 2026-11-12,
// eyes v3: "create a thumbnail icon for it similar to the icons we have in our monster presets"). Where a look
// (looks.js) sets a face's makeup, lips and skin too, an eye look is the eye and nothing else: the eyeball's paint (the
// iris, the pupil, the white, the catchlights that stay), the eye's shape (the grafted lids' shape keys and the
// sculpt's eye controls), the lashes, and the makeup that lies on the lids and round the eye (liner, shadow, the
// under-eye, the inner corner, the waterline, aegyo-sal). A card sets them together; every one is a plain slider
// afterwards. The face, the lips, the skin, the brows and the hair are the character's own.
//
//   EYE_LOOKS[id] = { label, about,
//     eyes:   the eyeball's settings (tools/shared/eye.js EYE_COLOURS, EYE_CONTROLS, EYE_CHOICES; and the fit's: lidShade, occlusion, tearline, depth, size),
//     shape:  the grafted eye's shape keys (eyegraft.js SHAPE_KEYS: size, crease, fold, tilt, opening, depth),
//     sculpt: the sculpt's eye controls (sculpt.js: eye_size, eye_spacing, eye_depth, eye_tilt, hooded_lids): only those named are set,
//     lash:   { style (browlash.js LASH_STYLES), set: {its own over the style}, look },
//     makeup: the eye's makeup (skinshader.js: only the keys in EYE_MAKEUP are taken) }
//
// The pictures on the cards are made by `node tools/character/eyelooks.mjs thumbs` into Content/Studio/Eyes/thumbs/.
// EYELOOKS (eyelooks_check.mjs, in check_all) holds every name here to a control that exists.
export const EYE_MAKEUP = ["liner", "wing", "linerWidth", "linerInner", "linerColor", "lowerLiner", "lowerWidth", "lowerReach", "shadow", "shadowPlace", "shadowSize", "shadowColor",
                           "under", "underColor", "corner", "cornerColor", "waterline", "waterColor", "aegyo", "lidGloss", "lidGlitter", "glitterColor"];
export const EYE_SCULPT = ["eye_size", "eye_spacing", "eye_depth", "eye_tilt", "hooded_lids"];   // the sculpt's controls an eye look may set
// the makeup an eye look that names none of it leaves the face with: none round the eye
const BARE = { liner: 0, lowerLiner: 0, shadow: 0, under: 0, corner: 0, waterline: 0, aegyo: 0, lidGloss: 0, lidGlitter: 0 };

export const EYE_LOOKS = {
  // eyes v3 (DECISIONS 2026-11-12): the user's own render (Unity and Blender), two close pictures: big, very dark
  // red-brown irises the pupil melts into, two crisp catchlights on each (a big one up and to the picture's right, a
  // small cool one across from it) and the lower lid's wet line as a thin arc low on the cornea; cool, bluish whites
  // shaded under the upper lid, a pink inner corner; a long almond opening tilted up a little at the outer corner, a
  // thin double lid; a soft dark band of short lashes along the upper lid with a silvery shimmer above it, the lower
  // lashes long and sparse in little points; rose all round the eye, a wet pink waterline and a lit under-eye
  v3: {
    label: "Eyes v3 (dark doll)",
    about: "After your own render: big, very dark red-brown irises the pupil melts into, two crisp catchlights that stay and the lower lid's wet line low on the cornea, cool whites, a long almond opening tilted up at the outer corner with a thin double lid, a soft dark band of short lashes above with a silver shimmer on the lid, long sparse lower lashes in little points, rose round the eye and a wet pink waterline.",
    eyes: { iris: "#200b09", iris2: "#1a0907", accent: "#e8a33a", pupilColor: "#030303", sclera: "#cfd6e2", corner: "#e59aa0", pattern: "natural", pupilShape: "round", pupilTurn: 0,
            irisSize: 32.5, pupil: 0.42, fibres: 0.12, limbal: 0.35, limbalWidth: 0.22, limbalSoft: 0.75, scleraShade: 0.7, socket: 0.3, cornerPink: 0.7, gloss: 1, irisDepth: 0.2, bulge: 1,
            ior: 1.336, caustic: 0.5, irisBright: 0.7, limbusView: 0.5, veins: 0.05, patternAmt: 1,
            catchKeep: 1, catch1: 1, catchSize: 0.095, catchX: 0.27, catchY: 0.42, catch2: 0.7, catch2Size: 0.65, catch2X: -0.3, catch2Y: -0.1, catchLine: 0.35, catchRoom: 0.25, catchGlow: 0,
            whiteBright: 0.52, whiteWarm: -0.5, lidShade: 0.9, occlusion: 0.6, tearline: 0.35 },
    shape: { size: 0.9, crease: 0.2, fold: 0.15, tilt: 0.3, opening: -1.9, depth: 0 },
    sculpt: { eye_size: 1, hooded_lids: 0.45 },
    lash: { style: "v3", look: "lash_ink" },
    makeup: { liner: 0.8, wing: 0.2, linerWidth: 1.5, linerInner: 0.2, linerColor: "#241a1e", shadow: 0.7, shadowPlace: 0.2, shadowSize: 1.5, shadowColor: "#a8485c",
              under: 0.5, underColor: "#d9788a", corner: 0.5, cornerColor: "#f4b0bc", waterline: 0.7, waterColor: "#dd7d8f", aegyo: 0.5, lidGloss: 0.6, lidGlitter: 0.7, glitterColor: "#dfe6f2" },
  },
};
export const eyeMakeup = L => ({ ...BARE, ...Object.fromEntries(Object.entries(L.makeup || {}).filter(([k]) => EYE_MAKEUP.includes(k))) });

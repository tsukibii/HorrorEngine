// The hair editor v2.0's settings (docs/HAIR_V2.md): what a hairstyle is made of, as plain numbers and words, the
// styles to start from, and the table of controls the tab draws its sliders from. A character keeps the style it
// started from and what differs (`{ style, set }`), as a prop keeps its recipe. Lengths and heights in metres on MHR's
// base head (the head's local space: 0 the ears' line, 0.037 the brows, -0.096 the chin, -0.135 the shoulders' tops,
// -0.30 the chest).
import { HAIRLINE_DEFAULTS, HAIRLINES, THINNING, MARKS } from "./pores.js";
import { LOOKS } from "../hairtex.js";

export const DEFAULTS = {
  seed: 1,
  density: 1300,                                         // pores that grow a card (the first so many of the fixed set)
  detail: "medium",                                      // light, medium, high: about 9, 20 and 40 thousand triangles of cards
  hairline: { ...HAIRLINE_DEFAULTS },
  parting: { kind: "middle", offset: 0.035, length: 0.6, angle: 0, width: 0.0018 },   // none, middle, left, right; how far to the side; how far back it runs (0..1); the skin showing (m)
  crown: { x: 0.012, phi: -38, swirl: 0.4 },             // the whorl: to her left (m), round the head from straight over (degrees), how much it turns
  comb: { top: "natural", sides: "down", hold: 0.3 },    // top: natural, back, forward; sides: down, back, forward; hold: how far the comb reaches before gravity (0..1)
  ears: "covered",                                       // covered (hair falls over them), tucked (it goes behind them: the ears show), tucked_left, tucked_right (one ear), clear (cut round them)
  tuckFall: "front",                                     // tucked hair: front (it comes forward under the ear and hangs over the shoulders), back (it stays behind them)
  length: { fringe: 0.09, top: 0.30, sides: 0.26, back: 0.26, nape: 0.16 },
  cut: { mode: "line", line: -0.09, tilt: 0, round: 0, layers: 0, uneven: 0.25, thin: 0.1, wispy: 0.3,   // mode: line (every hair cut where it crosses a height) or length
    tiers: "one", front: -0.07, frontTo: 112, frontSoft: 0.2, overFrom: -0.005 },   // two lengths: "front" (the front and sides cut at `front`, as far round as frontTo degrees, the back at the line) or "over" (a bob at `front` all round over a long nape that keeps the line)
  under: { height: null, length: 0.012, fade: 0.02 },    // an undercut: below this height (base head) the hair is clipped to `length`
  shape: { lift: 22, volume: { top: 0.007, sides: 0.007, back: 0.009 }, turn: 0.35, turnRadius: 0.035, stiff: 0.2, quiff: 0, ahoge: 0, ahogeSide: -0.5 },   // ahoge: a lock standing up out of the top (its size; to her right or left)
  texture: { clump: 0.3, clumpSize: 0.018, wave: 0, waveLength: 0.09, waveStart: 0.3, together: 0.5, curl: 0, curlRadius: 0.012, frizz: 0.15, messy: 0.1, wet: 0, strays: 24 },
  fringe: { kind: "none", line: MARKS.brow + 0.004, width: 46, amount: 0.7, sweep: 0, split: 0.6, curve: 0.4, arch: 0.3, hold: 0.5, uneven: 0.3, wispy: 0.75, choppy: 0, centre: 0, slant: 0, frame: 0, frameLine: MARKS.jaw, frameWispy: 0.85, frameCurl: 0 },   // choppy: each lock its own length; centre: a longer lock between the eyes; slant: longer toward her left (+) or right (-); frameCurl: the face-framing strands wound into a ringlet a side
  ties: { kind: "none", height: 0.5, side: 0.7, offset: 0, part: "all", tight: 0.6, loose: 0,   // offset: one tail round to her left (+) or right (-): a side ponytail; part: all the hair, or the top's only (the rest loose)
    tail: { length: 0.2, thick: 0.013, spread: 0.5, fall: "back", taper: 0.6, stiff: 0.4, sway: 0.5, bun: 0.035 }, tie: { kind: "elastic", colour: "#101010" } },
  look: "soft_black",
  card: { width: 2.3, taper: 0.3 },                      // a card's width in pore spacings; how much it narrows to its tip
  scalp: { shade: 0.95, stubble: 0 },
};

// the hair's colours (hairtex.js's looks, and these): black with a cool, quiet sheen and the browns and greys the
// styles use; root and tip the strands' colours, spec1 the sharp highlight, spec2 the broad one
export const LOOKS2 = {
  soft_black: { label: "Soft black", root: "#050506", tip: "#0e0e11", inner: "#0e0e11", innerAmount: 0, spec1: "#c8ccd6", spec2: "#2a303c", shine: 0.9, gloss1: 200, gloss2: 40, shift1: -0.06, shift2: 0.1, shiftNoise: 0.25, rim: "#353b48", rimAmount: 0.1, rootLength: 0.3 },
  off_black: { label: "Off black, brown in the light", root: "#060504", tip: "#15100d", inner: "#15100d", innerAmount: 0, spec1: "#d8d0c6", spec2: "#3a2d25", shine: 0.85, gloss1: 200, gloss2: 42, shift1: -0.06, shift2: 0.1, shiftNoise: 0.25, rim: "#3d332d", rimAmount: 0.1, rootLength: 0.3 },
  deep_brown: { label: "Deep brown", root: "#0a0605", tip: "#2b1b13", inner: "#2b1b13", innerAmount: 0, spec1: "#e2d2c0", spec2: "#5a3a28", shine: 0.8, gloss1: 190, gloss2: 44, shift1: -0.05, shift2: 0.1, shiftNoise: 0.25, rim: "#4a3628", rimAmount: 0.1, rootLength: 0.3 },
  brown_on_black: { label: "Brown lengths, black roots", root: "#050404", tip: "#4a3021", inner: "#5a3a26", innerAmount: 0.05, spec1: "#ecdcc8", spec2: "#7a5236", shine: 0.8, gloss1: 180, gloss2: 44, shift1: -0.05, shift2: 0.1, shiftNoise: 0.25, rim: "#5a4030", rimAmount: 0.1, rootLength: 0.42 },
  chestnut_soft: { label: "Chestnut", root: "#100705", tip: "#3a1c10", inner: "#4a2414", innerAmount: 0.04, spec1: "#f0d6bc", spec2: "#6a3a22", shine: 0.8, gloss1: 190, gloss2: 44, shift1: -0.05, shift2: 0.1, shiftNoise: 0.25, rim: "#4a2a1a", rimAmount: 0.1, rootLength: 0.3 },
  blonde: { label: "Dark blonde", root: "#2a1d12", tip: "#9a7a4e", inner: "#c8a870", innerAmount: 0.15, spec1: "#fff0d8", spec2: "#c09a60", shine: 0.6, gloss1: 150, gloss2: 38, shift1: -0.05, shift2: 0.1, shiftNoise: 0.25, rim: "#b09060", rimAmount: 0.1, rootLength: 0.35 },
  red: { label: "Dyed red", root: "#1a0606", tip: "#7a1414", inner: "#a02020", innerAmount: 0.1, spec1: "#ffd0c8", spec2: "#b03030", shine: 0.8, gloss1: 190, gloss2: 44, shift1: -0.05, shift2: 0.1, shiftNoise: 0.25, rim: "#8a2a2a", rimAmount: 0.1, rootLength: 0.25 },
  grey: { label: "Grey", root: "#3a3a3c", tip: "#8a8a8e", inner: "#c8c8cc", innerAmount: 0.2, spec1: "#f2f2f4", spec2: "#9a9aa0", shine: 0.6, gloss1: 150, gloss2: 40, shift1: -0.05, shift2: 0.1, shiftNoise: 0.25, rim: "#8a8a90", rimAmount: 0.1, rootLength: 0.25 },
  salt_pepper: { label: "Salt and pepper", root: "#101012", tip: "#2e2e32", inner: "#b8b8bc", innerAmount: 0.3, spec1: "#e8e8ec", spec2: "#55555c", shine: 0.7, gloss1: 170, gloss2: 40, shift1: -0.05, shift2: 0.1, shiftNoise: 0.25, rim: "#55555c", rimAmount: 0.1, rootLength: 0.25 },
  white: { label: "White", root: "#8a8a88", tip: "#dcdcd8", inner: "#f0f0ec", innerAmount: 0.2, spec1: "#ffffff", spec2: "#c8c8c4", shine: 0.5, gloss1: 140, gloss2: 36, shift1: -0.05, shift2: 0.1, shiftNoise: 0.25, rim: "#c0c0bc", rimAmount: 0.1, rootLength: 0.2 },
};
export const ALL_LOOKS = { ...LOOKS2, ...LOOKS };
export const lookOf = s => (typeof s.look === "object" ? s.look : ALL_LOOKS[s.look] || LOOKS2.soft_black);

// a fringe's kind is its numbers to start from (the style's own and the character's go over them)
export const FRINGES = {
  none: { label: "None" },
  blunt: { label: "Blunt", amount: 0.85, wispy: 0.25, uneven: 0.15, sweep: 0, curve: 0.45, arch: 0.25 },
  seethrough: { label: "See-through", amount: 0.22, wispy: 0.9, uneven: 0.6, sweep: 0, curve: 0.5 },
  wispy: { label: "Wispy", amount: 0.5, wispy: 1, uneven: 0.9, sweep: 0, curve: 0.5 },
  swept: { label: "Side-swept", amount: 0.8, wispy: 0.85, uneven: 0.6, sweep: 45, hold: 0.8, curve: 0.5 },
  curtain: { label: "Curtain", amount: 0.7, wispy: 0.85, uneven: 0.5, sweep: 0, split: 0.7, hold: 0.7, curve: 0.6, line: MARKS.eye - 0.01 },
  micro: { label: "Micro", amount: 0.7, wispy: 0.3, uneven: 0.2, line: MARKS.brow + 0.026 },
  over: { label: "Over the eyes", amount: 1, wispy: 0.9, uneven: 0.8, width: 58, line: MARKS.nose, curve: 0.2 },
  choppy: { label: "Choppy (drawn hair's pointed locks)", amount: 0.85, wispy: 0.95, uneven: 0.8, choppy: 0.6, centre: 0.5, curve: 0.45, width: 50, line: MARKS.eye + 0.012 },
};

const P = MARKS;
// Long hair ends with just its tips on the shoulders (a cut's line at -0.14, a tail's length to match: DECISIONS
// 2026-11-12, last; the shoulders' tops are -0.135): longer is a slider away, down to the chest.
export const STYLES = {
  // ---- after the user's five pictures (DECISIONS 2026-11-11)
  bob_middle: { label: "Sleek bob, middle parting", group: "pictures",
    set: { parting: { kind: "middle", length: 0.75, width: 0.0022 }, cut: { mode: "line", line: -0.088, uneven: 0.35, wispy: 0.12 }, shape: { lift: 14, volume: { top: 0.004, sides: 0.006, back: 0.008 }, turn: 0.3, turnRadius: 0.04 },
      texture: { clump: 0.25, frizz: 0.1, strays: 30 }, fringe: { frame: 0.45, frameLine: P.jaw + 0.012 } } },
  twin_tails_low: { label: "Low twin tails, swept fringe", group: "pictures",
    set: { parting: { kind: "left", offset: 0.02, length: 0.35, width: 0.0006 }, cut: { mode: "length", wispy: 0.8, uneven: 0.6, thin: 0.15 }, length: { fringe: 0.1, top: 0.15, sides: 0.13, back: 0.2, nape: 0.12 },
      shape: { lift: 30, volume: { top: 0.011, sides: 0.011, back: 0.008 }, turn: 0.25, turnRadius: 0.03 }, fringe: { kind: "swept", sweep: -38, line: 0.034, amount: 0.75, width: 48, hold: 0.75, curve: 0.5, wispy: 0.95, uneven: 0.8 },
      ties: { kind: "twin", height: 0.08, side: 0.72, tight: 0.55, loose: 0.82, tail: { length: 0.115, thick: 0.014, spread: 0.55, fall: "front", taper: 0.7, sway: 0.6 }, tie: { kind: "scrunchie", colour: "#b3202a" } },
      texture: { clump: 0.45, clumpSize: 0.022, wave: 0.004, waveLength: 0.1, frizz: 0.2, messy: 0.2, strays: 30 }, look: "deep_brown" } },
  waves_side: { label: "Shoulder-length waves, side parting", group: "pictures",
    set: { parting: { kind: "right", offset: 0.032, length: 0.5, width: 0.0012 }, cut: { mode: "line", line: -0.14, layers: 0.25, uneven: 0.7, thin: 0.2, wispy: 0.55 }, length: { top: 0.34, sides: 0.3, back: 0.3, nape: 0.2 },
      shape: { lift: 40, volume: { top: 0.014, sides: 0.02, back: 0.02 }, turn: 0, stiff: 0.25 }, texture: { clump: 0.5, clumpSize: 0.045, wave: 0.017, waveLength: 0.115, waveStart: 0.2, together: 0.75, frizz: 0.25, messy: 0.1, strays: 70 }, look: "off_black" } },
  short_swept: { label: "Short cut, long swept fringe", group: "pictures",
    set: { parting: { kind: "right", offset: 0.04, length: 0.5, width: 0.0008 }, cut: { mode: "length", wispy: 0.8, uneven: 0.5 }, length: { fringe: 0.11, top: 0.09, sides: 0.035, back: 0.04, nape: 0.018 },
      ears: "clear", shape: { lift: 38, volume: { top: 0.012, sides: 0.004, back: 0.006 }, turn: 0, stiff: 0.45 }, fringe: { kind: "swept", sweep: 52, line: P.brow - 0.002, hold: 0.9, curve: 0.5, amount: 0.9, width: 50 },
      hairline: { sideburns: 0.35 }, texture: { clump: 0.5, messy: 0.3 }, look: "off_black" } },
  bob_bangs: { label: "Chin bob, see-through bangs", group: "pictures",
    set: { parting: { kind: "middle", length: 0.42, width: 0.0006 }, crown: { x: 0.006, phi: -34, swirl: 0.3 }, cut: { mode: "line", line: -0.078, uneven: 0.3, wispy: 0.15 }, shape: { lift: 30, volume: { top: 0.011, sides: 0.013, back: 0.014 }, turn: 0.95, turnRadius: 0.03 },
      fringe: { kind: "seethrough", line: 0.04, amount: 0.22, width: 44, curve: 0.5, uneven: 0.6, wispy: 0.9 }, texture: { clump: 0.4, frizz: 0.12, strays: 20 }, look: "brown_on_black" } },
  // ---- women's
  long_straight: { label: "Long and straight, to the shoulders", group: "women",
    set: { parting: { kind: "middle", length: 0.7 }, cut: { mode: "line", line: -0.14, uneven: 0.4, wispy: 0.35, thin: 0.15 }, shape: { lift: 18, volume: { top: 0.006, sides: 0.009, back: 0.011 }, turn: 0.15 }, texture: { clump: 0.3, strays: 40 } } },
  hime: { label: "Hime cut", group: "women",
    set: { parting: { kind: "none" }, comb: { top: "forward" }, cut: { mode: "line", line: -0.14, uneven: 0.15, wispy: 0.2 }, shape: { lift: 16, volume: { top: 0.006, sides: 0.008, back: 0.01 }, turn: 0.1 },
      fringe: { kind: "blunt", line: P.brow + 0.002, amount: 1, width: 40, frame: 1, frameLine: P.jaw + 0.006, frameWispy: 0.15, uneven: 0.1 }, texture: { clump: 0.2, frizz: 0.08, strays: 10 } } },
  ponytail_high: { label: "High ponytail", group: "women",
    set: { parting: { kind: "none" }, comb: { top: "back", sides: "back", hold: 1 }, ties: { kind: "pony", height: 0.78, tight: 0.7, tail: { length: 0.22, thick: 0.016, spread: 0.6, taper: 0.7, sway: 0.7 }, tie: { kind: "elastic", colour: "#141414" } },
      fringe: { kind: "wispy", amount: 0.3, frame: 0.3, frameLine: P.jaw }, texture: { clump: 0.3, strays: 30 } } },
  ponytail_low: { label: "Low ponytail", group: "women",
    set: { parting: { kind: "middle", length: 0.6, width: 0.001 }, ties: { kind: "pony", height: 0.18, tight: 0.45, tail: { length: 0.13, thick: 0.015, spread: 0.4, taper: 0.6, sway: 0.5 }, tie: { kind: "elastic", colour: "#141414" } },
      fringe: { frame: 0.4, frameLine: P.jaw - 0.01 }, texture: { clump: 0.3, strays: 30 } } },
  bun_high: { label: "High bun", group: "women",
    set: { parting: { kind: "none" }, comb: { top: "back", sides: "back", hold: 1 }, ties: { kind: "bun", height: 0.86, tight: 0.75, tail: { bun: 0.04 }, tie: { kind: "none" } }, fringe: { frame: 0.3, frameLine: P.jaw + 0.02 }, texture: { clump: 0.3, strays: 40 } } },
  bun_low: { label: "Low bun", group: "women",
    set: { parting: { kind: "middle", length: 0.65, width: 0.001 }, ties: { kind: "bun", height: 0.2, tight: 0.6, tail: { bun: 0.038 }, tie: { kind: "none" } }, texture: { clump: 0.3, strays: 30 } } },
  half_up: { label: "Half-up", group: "women",
    set: { parting: { kind: "none" }, comb: { top: "back", hold: 0.9 }, cut: { mode: "line", line: -0.14, uneven: 0.4, wispy: 0.4 }, ties: { kind: "half", height: 0.55, tight: 0.6, tail: { length: 0.16, thick: 0.011, spread: 0.5, taper: 0.7 }, tie: { kind: "elastic", colour: "#141414" } },
      shape: { lift: 18, volume: { top: 0.006, sides: 0.01, back: 0.012 }, turn: 0.15 }, fringe: { frame: 0.35 }, texture: { clump: 0.3, strays: 30 } } },
  twin_tails_high: { label: "High twin tails, blunt bangs", group: "women",
    set: { parting: { kind: "middle", length: 1, width: 0.001 }, ties: { kind: "twin", height: 0.78, side: 0.45, tight: 0.7, tail: { length: 0.2, thick: 0.013, spread: 0.5, fall: "back", taper: 0.7, sway: 0.8 }, tie: { kind: "elastic", colour: "#c02040" } },
      fringe: { kind: "blunt", line: P.brow + 0.002, amount: 0.8, frame: 0.6, frameLine: P.jaw + 0.01 }, texture: { clump: 0.3, strays: 20 } } },
  curls_shoulder: { label: "Shoulder-length curls", group: "women",
    set: { parting: { kind: "left", offset: 0.03, length: 0.5, width: 0.001 }, cut: { mode: "line", line: -0.14, layers: 0.4, uneven: 0.8, wispy: 0.6 }, length: { top: 0.3, sides: 0.28, back: 0.28, nape: 0.18 },
      shape: { lift: 45, volume: { top: 0.016, sides: 0.024, back: 0.024 }, turn: 0 }, texture: { clump: 0.8, clumpSize: 0.03, curl: 0.9, curlRadius: 0.011, waveStart: 0.18, frizz: 0.45, messy: 0.2, strays: 80 }, look: "deep_brown" } },
  shaggy: { label: "Shaggy layers, curtain bangs", group: "women",
    set: { parting: { kind: "middle", length: 0.4, width: 0.0008 }, cut: { mode: "line", line: -0.14, layers: 0.75, uneven: 0.9, thin: 0.3, wispy: 0.95 }, length: { top: 0.16, sides: 0.2, back: 0.22, nape: 0.2 },
      shape: { lift: 38, volume: { top: 0.014, sides: 0.014, back: 0.014 }, turn: -0.3, turnRadius: 0.03 }, fringe: { kind: "curtain", amount: 0.6 }, texture: { clump: 0.6, clumpSize: 0.025, wave: 0.006, waveLength: 0.09, together: 0.3, frizz: 0.3, messy: 0.45, strays: 60 }, look: "chestnut_soft" } },
  // ---- long hair with the ears out (DECISIONS 2026-11-12: "the ears aren't covered but the hair is still long (so the ears poke out cutely)")
  ears_long: { label: "Long and straight, tucked behind the ears", group: "ears",
    set: { parting: { kind: "middle", length: 0.7, width: 0.0012 }, ears: "tucked", cut: { mode: "line", line: -0.14, uneven: 0.45, wispy: 0.4, thin: 0.15 }, shape: { lift: 16, volume: { top: 0.005, sides: 0.006, back: 0.01 }, turn: 0.1 },
      hairline: { sideburns: 0.25 }, texture: { clump: 0.3, strays: 30 } } },
  ears_bangs: { label: "Long, see-through bangs and sidelocks, ears out", group: "ears",
    set: { parting: { kind: "middle", length: 0.4, width: 0.0006 }, ears: "tucked", cut: { mode: "line", line: -0.14, uneven: 0.5, wispy: 0.45, thin: 0.15 }, shape: { lift: 22, volume: { top: 0.008, sides: 0.007, back: 0.011 }, turn: 0.2 },
      fringe: { kind: "seethrough", line: 0.038, amount: 0.3, width: 44, curve: 0.5, frame: 0.75, frameLine: P.jaw + 0.004, frameWispy: 0.7 }, hairline: { sideburns: 0.2 }, texture: { clump: 0.35, strays: 30 }, look: "deep_brown" } },
  ears_side: { label: "Side parting, one ear out", group: "ears",
    set: { parting: { kind: "left", offset: 0.034, length: 0.55, width: 0.001 }, ears: "tucked_left", cut: { mode: "line", line: -0.14, layers: 0.2, uneven: 0.6, wispy: 0.5, thin: 0.15 }, length: { top: 0.34, sides: 0.3, back: 0.3, nape: 0.2 },
      shape: { lift: 30, volume: { top: 0.01, sides: 0.011, back: 0.013 }, turn: 0.2, turnRadius: 0.04 }, hairline: { sideburns: 0.25 }, texture: { clump: 0.4, clumpSize: 0.03, wave: 0.006, waveLength: 0.12, waveStart: 0.35, together: 0.7, frizz: 0.2, strays: 40 }, look: "off_black" } },
  ears_waves: { label: "Loose waves, tucked behind the ears", group: "ears",
    set: { parting: { kind: "middle", length: 0.55, width: 0.001 }, ears: "tucked", cut: { mode: "line", line: -0.14, layers: 0.25, uneven: 0.7, wispy: 0.55, thin: 0.2 }, length: { top: 0.34, sides: 0.3, back: 0.3, nape: 0.2 },
      shape: { lift: 30, volume: { top: 0.009, sides: 0.009, back: 0.016 }, turn: 0 }, fringe: { frame: 0.35, frameLine: P.jaw - 0.01, frameWispy: 0.9 }, hairline: { sideburns: 0.2 },
      texture: { clump: 0.5, clumpSize: 0.04, wave: 0.013, waveLength: 0.11, waveStart: 0.3, together: 0.75, frizz: 0.25, strays: 50 }, look: "chestnut_soft" } },
  ears_half_up: { label: "Half-up, ears out", group: "ears",
    set: { parting: { kind: "none" }, comb: { top: "back", hold: 0.9 }, ears: "tucked", tuckFall: "back", cut: { mode: "line", line: -0.14, uneven: 0.4, wispy: 0.4 }, ties: { kind: "half", height: 0.6, tight: 0.6, tail: { length: 0.18, thick: 0.011, spread: 0.5, taper: 0.7 }, tie: { kind: "scrunchie", colour: "#d8c8b0" } },
      shape: { lift: 18, volume: { top: 0.006, sides: 0.007, back: 0.012 }, turn: 0.15 }, fringe: { kind: "wispy", amount: 0.35, frame: 0.4, frameLine: P.jaw }, hairline: { sideburns: 0.2 }, texture: { clump: 0.3, strays: 30 } } },
  // ---- Japanese and Korean styles (DECISIONS 2026-11-12: "front and side hair is above shoulders slightly below ears but then back is longer and other Asian variations")
  sides_short_back_long: { label: "Sides just under the ears, long back", group: "asian",
    set: { parting: { kind: "middle", length: 0.35, width: 0.0006 }, cut: { mode: "line", line: -0.14, tiers: "front", front: -0.068, frontTo: 114, frontSoft: 0.1, uneven: 0.3, wispy: 0.3, thin: 0.1 },
      shape: { lift: 24, volume: { top: 0.008, sides: 0.011, back: 0.012 }, turn: 0.55, turnRadius: 0.03 }, fringe: { kind: "seethrough", line: 0.039, amount: 0.3, width: 44, curve: 0.5 }, texture: { clump: 0.3, strays: 25 } } },
  hime_long: { label: "Hime: sidelocks to the jaw, long back", group: "asian",
    set: { parting: { kind: "none" }, comb: { top: "forward" }, cut: { mode: "line", line: -0.14, tiers: "front", front: -0.062, frontTo: 84, frontSoft: 0, uneven: 0.12, wispy: 0.15 },
      shape: { lift: 16, volume: { top: 0.006, sides: 0.009, back: 0.011 }, turn: 0.1 }, fringe: { kind: "blunt", line: P.brow + 0.002, amount: 1, width: 40, uneven: 0.1 }, texture: { clump: 0.2, frizz: 0.08, strays: 10 } } },
  jellyfish: { label: "Jellyfish cut: a bob over a long nape", group: "asian",
    set: { parting: { kind: "none" }, comb: { top: "forward" }, cut: { mode: "line", line: -0.14, tiers: "over", front: -0.072, overFrom: 0.0, uneven: 0.15, wispy: 0.15 },
      shape: { lift: 24, volume: { top: 0.009, sides: 0.012, back: 0.013 }, turn: 0.6, turnRadius: 0.028 }, fringe: { kind: "blunt", line: P.brow + 0.003, amount: 0.9, width: 44 }, texture: { clump: 0.25, strays: 12 } } },
  wolf_cut: { label: "Wolf cut", group: "asian",
    set: { parting: { kind: "middle", length: 0.3, width: 0.0006 }, cut: { mode: "length", wispy: 0.95, uneven: 0.8, thin: 0.3 }, length: { fringe: 0.1, top: 0.13, sides: 0.14, back: 0.17, nape: 0.075 },
      shape: { lift: 44, volume: { top: 0.016, sides: 0.014, back: 0.013 }, turn: -0.45, turnRadius: 0.025, stiff: 0.3 }, fringe: { kind: "curtain", amount: 0.65, split: 0.75, line: P.eye - 0.004 },
      texture: { clump: 0.6, clumpSize: 0.024, wave: 0.004, waveLength: 0.08, together: 0.3, frizz: 0.3, messy: 0.4, strays: 50 }, look: "off_black" } },
  two_side_up: { label: "Two side up: small twin tails, the rest loose", group: "asian",
    set: { parting: { kind: "middle", length: 0.5, width: 0.0008 }, cut: { mode: "line", line: -0.14, uneven: 0.4, wispy: 0.4, thin: 0.1 }, ties: { kind: "twin_half", height: 0.74, side: 0.62, tight: 0.6, tail: { length: 0.18, thick: 0.009, spread: 0.6, fall: "back", taper: 0.75, sway: 0.8 }, tie: { kind: "scrunchie", colour: "#c8324a" } },
      shape: { lift: 18, volume: { top: 0.006, sides: 0.009, back: 0.011 }, turn: 0.15 }, fringe: { kind: "blunt", line: P.brow + 0.003, amount: 0.8, width: 42, frame: 0.5, frameLine: P.jaw + 0.005, frameWispy: 0.5 }, texture: { clump: 0.3, strays: 20 } } },
  odango: { label: "Odango: twin buns, bangs", group: "asian",
    set: { parting: { kind: "middle", length: 1, width: 0.0008 }, ties: { kind: "buns", height: 0.8, side: 0.42, tight: 0.75, tail: { bun: 0.03 }, tie: { kind: "none" } },
      fringe: { kind: "seethrough", line: 0.04, amount: 0.3, width: 42, frame: 0.6, frameLine: P.jaw + 0.012, frameWispy: 0.7 }, texture: { clump: 0.3, strays: 25 } } },
  korean_long: { label: "Long with C-curl ends, see-through bangs", group: "asian",
    set: { parting: { kind: "middle", length: 0.4, width: 0.0006 }, cut: { mode: "line", line: -0.14, layers: 0.15, uneven: 0.4, wispy: 0.35, thin: 0.12 }, shape: { lift: 26, volume: { top: 0.009, sides: 0.011, back: 0.013 }, turn: 0.85, turnRadius: 0.045 },
      fringe: { kind: "seethrough", line: 0.038, amount: 0.3, width: 44, curve: 0.55, frame: 0.6, frameLine: P.chin + 0.01, frameWispy: 0.6 }, texture: { clump: 0.35, wave: 0.003, waveLength: 0.14, together: 0.8, strays: 30 }, look: "deep_brown" } },
  soto_hane: { label: "Lob with the ends flipped out", group: "asian",
    set: { parting: { kind: "middle", length: 0.35, width: 0.0006 }, cut: { mode: "line", line: -0.115, uneven: 0.35, wispy: 0.4 }, shape: { lift: 26, volume: { top: 0.009, sides: 0.011, back: 0.012 }, turn: -0.8, turnRadius: 0.03 },
      fringe: { kind: "seethrough", line: 0.04, amount: 0.28, width: 44, curve: 0.5 }, texture: { clump: 0.35, strays: 25 }, look: "brown_on_black" } },
  // ---- drawn hair: the twelve of the user's chart (DECISIONS 2026-11-12: "recreate as close as possible a preset for each of these"), row by row
  anime_long: { label: "Long and straight, bangs to the eyes", group: "anime",
    set: { parting: { kind: "none" }, comb: { top: "forward" }, cut: { mode: "line", line: -0.14, uneven: 0.35, wispy: 0.6, thin: 0.1 }, length: { fringe: 0.13 }, shape: { lift: 22, volume: { top: 0.009, sides: 0.012, back: 0.013 }, turn: 0.1 },
      fringe: { kind: "choppy", line: P.eye + 0.01, amount: 0.9, width: 52, choppy: 0.7, centre: 0.8 }, texture: { clump: 0.75, clumpSize: 0.028, frizz: 0.05, strays: 0 }, card: { width: 2.6 } } },
  anime_medium: { label: "Shoulder length, the ends flicked out", group: "anime",
    set: { parting: { kind: "none" }, comb: { top: "forward" }, cut: { mode: "line", line: -0.125, layers: 0.25, uneven: 0.7, wispy: 0.8 }, length: { fringe: 0.13 }, shape: { lift: 28, volume: { top: 0.011, sides: 0.014, back: 0.014 }, turn: -0.6, turnRadius: 0.028 },
      fringe: { kind: "choppy", line: P.eye + 0.012, amount: 0.9, width: 52, choppy: 0.8, centre: 0.6 }, texture: { clump: 0.8, clumpSize: 0.03, frizz: 0.05, messy: 0.15, strays: 0 }, card: { width: 2.6 }, look: "deep_brown" } },
  anime_hime: { label: "Hime: straight bangs, sidelocks to the chin, long back", group: "anime", from: "hime_long",
    set: { cut: { line: -0.14, front: -0.088, frontTo: 82 }, fringe: { line: P.brow - 0.004, width: 44 }, texture: { clump: 0.3, strays: 0 } } },
  anime_long_messy: { label: "Long and tousled, with an ahoge", group: "anime",
    set: { parting: { kind: "none" }, comb: { top: "forward" }, cut: { mode: "line", line: -0.14, layers: 0.45, uneven: 1, wispy: 0.9, thin: 0.2 }, length: { fringe: 0.14, top: 0.3, sides: 0.26, back: 0.28, nape: 0.22 },
      shape: { lift: 34, volume: { top: 0.013, sides: 0.017, back: 0.017 }, turn: -0.45, turnRadius: 0.03, ahoge: 0.8, ahogeSide: -0.6 }, fringe: { kind: "choppy", line: P.eye + 0.004, amount: 0.9, width: 54, choppy: 0.9, centre: 0.7 },
      texture: { clump: 0.8, clumpSize: 0.032, wave: 0.004, waveLength: 0.1, together: 0.3, frizz: 0.1, messy: 0.4, strays: 0 }, card: { width: 2.6 }, look: "chestnut_soft" } },
  anime_side_ponytail: { label: "Side ponytail, straight bangs", group: "anime",
    set: { parting: { kind: "none" }, comb: { top: "back", sides: "back", hold: 1 }, ties: { kind: "pony", height: 0.72, offset: -0.75, tight: 0.7, tail: { length: 0.2, thick: 0.017, spread: 0.8, taper: 0.75, sway: 0.7 }, tie: { kind: "elastic", colour: "#202020" } },
      fringe: { kind: "blunt", line: P.brow - 0.002, amount: 0.9, width: 50, uneven: 0.15 }, texture: { clump: 0.6, clumpSize: 0.026, strays: 0 }, look: "off_black" } },
  anime_bob_one_eye: { label: "Bob, the fringe over one eye", group: "anime",
    set: { parting: { kind: "right", offset: 0.03, length: 0.45, width: 0.0006 }, cut: { mode: "line", line: -0.086, uneven: 0.4, wispy: 0.5 }, length: { fringe: 0.2 }, shape: { lift: 26, volume: { top: 0.01, sides: 0.013, back: 0.013 }, turn: 0.45, turnRadius: 0.028 },
      fringe: { kind: "swept", sweep: -36, slant: 0.95, line: P.eye - 0.012, amount: 0.95, width: 54, hold: 0.85, curve: 0.5, wispy: 0.6, uneven: 0.3, choppy: 0.3 }, texture: { clump: 0.7, clumpSize: 0.03, strays: 0 }, card: { width: 2.6 } } },
  anime_pigtails: { label: "Pigtails, choppy bangs", group: "anime",
    set: { parting: { kind: "middle", length: 1, width: 0.0006 }, ties: { kind: "twin", height: 0.74, side: 0.86, tight: 0.6, tail: { length: 0.15, thick: 0.017, spread: 0.85, fall: "back", taper: 0.95, sway: 0.8 }, tie: { kind: "elastic", colour: "#202020" } },
      length: { fringe: 0.12 }, fringe: { kind: "choppy", line: P.eye + 0.014, amount: 0.9, width: 50, choppy: 0.8, centre: 0.5, frame: 0.6, frameLine: P.jaw + 0.006, frameWispy: 0.8 }, texture: { clump: 0.8, clumpSize: 0.03, strays: 0 }, card: { width: 2.6 }, look: "deep_brown" } },
  anime_short_bob: { label: "Short bob, parted bangs", group: "anime",
    set: { parting: { kind: "middle", length: 0.4, width: 0.0006 }, cut: { mode: "line", line: -0.08, uneven: 0.3, wispy: 0.4 }, length: { fringe: 0.12 }, shape: { lift: 26, volume: { top: 0.01, sides: 0.013, back: 0.013 }, turn: 0.5, turnRadius: 0.026 },
      fringe: { kind: "curtain", amount: 0.9, split: 0.4, hold: 0.8, line: P.eye + 0.002, width: 50, choppy: 0.4 }, texture: { clump: 0.7, clumpSize: 0.03, strays: 0 }, card: { width: 2.6 }, look: "off_black" } },
  anime_drills: { label: "Long, with ringlets in front", group: "anime",
    set: { parting: { kind: "middle", length: 0.45, width: 0.0006 }, cut: { mode: "line", line: -0.14, uneven: 0.3, wispy: 0.5 }, length: { fringe: 0.13 }, shape: { lift: 24, volume: { top: 0.009, sides: 0.012, back: 0.013 }, turn: 0.1 },
      fringe: { kind: "curtain", amount: 0.6, split: 0.7, line: P.eye - 0.002, width: 46, frame: 1, frameLine: -0.135, frameCurl: 0.9 }, texture: { clump: 0.7, clumpSize: 0.03, strays: 0 }, card: { width: 2.6 }, look: "blonde" } },
  anime_buns: { label: "Twin buns, the hair down", group: "anime",
    set: { parting: { kind: "middle", length: 1, width: 0.0006 }, cut: { mode: "line", line: -0.1, uneven: 0.5, wispy: 0.6 }, ties: { kind: "buns", part: "top", height: 0.88, side: 0.55, tight: 0.7, tail: { bun: 0.03 }, tie: { kind: "none" } },
      length: { fringe: 0.12 }, shape: { lift: 24, volume: { top: 0.008, sides: 0.012, back: 0.013 }, turn: 0.3 }, fringe: { kind: "choppy", line: P.eye + 0.012, amount: 0.9, width: 50, choppy: 0.7, centre: 0.6 }, texture: { clump: 0.75, clumpSize: 0.03, strays: 0 }, card: { width: 2.6 } } },
  anime_spiky: { label: "Short and spiky", group: "anime",
    set: { parting: { kind: "none" }, comb: { top: "forward" }, cut: { mode: "length", wispy: 1, uneven: 0.9 }, length: { fringe: 0.13, top: 0.115, sides: 0.11, back: 0.11, nape: 0.075 },
      shape: { lift: 52, volume: { top: 0.02, sides: 0.016, back: 0.016 }, turn: -0.8, turnRadius: 0.022, stiff: 0.55, ahoge: 0.35, ahogeSide: 0.2 }, fringe: { kind: "choppy", line: P.eye + 0.002, amount: 0.95, width: 56, choppy: 1, centre: 1 },
      texture: { clump: 0.9, clumpSize: 0.036, messy: 0.55, frizz: 0.05, strays: 0 }, card: { width: 2.7 }, look: "off_black" } },
  anime_low_tails: { label: "Short, two small low tails", group: "anime",
    set: { parting: { kind: "none" }, comb: { top: "forward" }, cut: { mode: "line", line: -0.07, uneven: 0.5, wispy: 0.6 }, ties: { kind: "twin", height: 0.12, side: 0.78, tight: 0.5, loose: 0.55, tail: { length: 0.085, thick: 0.013, spread: 1.3, fall: "back", taper: 0.75, sway: 0.7 }, tie: { kind: "elastic", colour: "#202020" } },
      length: { fringe: 0.12 }, shape: { lift: 26, volume: { top: 0.01, sides: 0.013, back: 0.012 }, turn: 0.3 }, fringe: { kind: "choppy", line: P.eye + 0.012, amount: 0.9, width: 52, choppy: 0.7, centre: 0.7 }, texture: { clump: 0.75, clumpSize: 0.03, strays: 0 }, card: { width: 2.6 }, look: "deep_brown" } },
  // ---- men's
  m_side_part: { label: "Side parting, short back and sides", group: "men",
    set: { parting: { kind: "left", offset: 0.045, length: 0.55, width: 0.001 }, cut: { mode: "length", wispy: 0.6, uneven: 0.3 }, length: { fringe: 0.07, top: 0.065, sides: 0.02, back: 0.022, nape: 0.01 },
      ears: "clear", shape: { lift: 30, volume: { top: 0.009, sides: 0.003, back: 0.004 }, turn: 0, stiff: 0.5 }, hairline: { shape: "square", sideburns: 0.45 }, comb: { hold: 0.7 }, texture: { clump: 0.4 } } },
  m_crew: { label: "Crew cut", group: "men",
    set: { parting: { kind: "none" }, cut: { mode: "length" }, length: { fringe: 0.02, top: 0.022, sides: 0.008, back: 0.008, nape: 0.005 }, ears: "clear", shape: { lift: 65 }, hairline: { shape: "square", sideburns: 0.3 }, texture: { strays: 0 } } },
  m_buzz: { label: "Buzz cut", group: "men",
    set: { parting: { kind: "none" }, cut: { mode: "length" }, length: { fringe: 0.005, top: 0.005, sides: 0.004, back: 0.004, nape: 0.003 }, ears: "clear", shape: { lift: 75 }, hairline: { shape: "square", sideburns: 0.25, soft: 0.3 }, texture: { strays: 0 } } },
  m_slick_back: { label: "Slicked back", group: "men",
    set: { parting: { kind: "none" }, comb: { top: "back", sides: "back", hold: 1 }, cut: { mode: "length", wispy: 0.5, uneven: 0.3 }, length: { fringe: 0.11, top: 0.11, sides: 0.05, back: 0.06, nape: 0.025 },
      ears: "clear", shape: { lift: 26, volume: { top: 0.011, sides: 0.004, back: 0.005 }, turn: 0, stiff: 0.4, quiff: 0.25 }, hairline: { shape: "m_shape", sideburns: 0.4 }, texture: { clump: 0.55, wet: 0.35, strays: 6 } } },
  m_two_block: { label: "Two-block", group: "men",
    set: { parting: { kind: "none" }, comb: { top: "forward" }, cut: { mode: "length", wispy: 0.8, uneven: 0.5 }, length: { fringe: 0.1, top: 0.105, sides: 0.09, back: 0.08, nape: 0.05 }, under: { height: 0.058, length: 0.006, fade: 0.012 },
      ears: "clear", shape: { lift: 34, volume: { top: 0.012, sides: 0.008, back: 0.008 }, turn: 0.3, turnRadius: 0.025, stiff: 0.35 }, fringe: { kind: "wispy", amount: 0.9, line: P.brow - 0.004, width: 52 }, hairline: { sideburns: 0.3 }, texture: { clump: 0.5, messy: 0.25 } } },
  m_curtains: { label: "Middle-part curtains", group: "men",
    set: { parting: { kind: "middle", length: 0.5, width: 0.001 }, cut: { mode: "length", wispy: 0.8, uneven: 0.4 }, length: { fringe: 0.12, top: 0.115, sides: 0.045, back: 0.05, nape: 0.02 },
      ears: "clear", shape: { lift: 42, volume: { top: 0.013, sides: 0.005, back: 0.006 }, turn: 0.2, stiff: 0.4 }, fringe: { kind: "curtain", amount: 0.85, split: 0.8, line: P.eye - 0.005 }, hairline: { sideburns: 0.35 }, texture: { clump: 0.5, messy: 0.2 } } },
  m_quiff: { label: "Quiff", group: "men",
    set: { parting: { kind: "none" }, comb: { top: "back", sides: "back", hold: 0.9 }, cut: { mode: "length", wispy: 0.7, uneven: 0.4 }, length: { fringe: 0.09, top: 0.085, sides: 0.022, back: 0.025, nape: 0.01 },
      ears: "clear", shape: { lift: 40, volume: { top: 0.014, sides: 0.003, back: 0.004 }, turn: 0, stiff: 0.6, quiff: 0.9 }, hairline: { shape: "square", sideburns: 0.4 }, texture: { clump: 0.55, messy: 0.2, strays: 10 } } },
  m_long: { label: "Long, swept back to the shoulders", group: "men",
    set: { parting: { kind: "middle", length: 0.55, width: 0.001 }, comb: { sides: "back", hold: 0.6 }, cut: { mode: "line", line: -0.14, layers: 0.3, uneven: 0.7, wispy: 0.7 }, length: { top: 0.3, sides: 0.26, back: 0.26, nape: 0.18 },
      shape: { lift: 26, volume: { top: 0.009, sides: 0.011, back: 0.012 }, turn: -0.15 }, hairline: { shape: "m_shape" }, texture: { clump: 0.5, wave: 0.005, waveLength: 0.12, together: 0.4, frizz: 0.3, messy: 0.25, strays: 50 } } },
  m_top_knot: { label: "Top knot, shaved sides", group: "men",
    set: { parting: { kind: "none" }, comb: { top: "back", hold: 1 }, cut: { mode: "length" }, length: { top: 0.2, sides: 0.2, back: 0.2, nape: 0.2 }, under: { height: 0.07, length: 0.004, fade: 0.01 }, ears: "clear",
      ties: { kind: "knot", height: 0.35, tight: 0.8, tail: { bun: 0.026 }, tie: { kind: "elastic", colour: "#101010" } }, hairline: { shape: "square", sideburns: 0.3 }, texture: { clump: 0.4, strays: 8 } } },
  // ---- balding
  receding: { label: "Receding temples", group: "balding", from: "m_side_part", set: { hairline: { shape: "receding_2", sideburns: 0.4 }, length: { top: 0.045, fringe: 0.04 } } },
  thinning_crown: { label: "Thinning crown", group: "balding", from: "m_side_part", set: { hairline: { shape: "m_shape", thinning: "crown", thinAmount: 0.8, thinSize: 0.55 } } },
  horseshoe: { label: "Bald on top", group: "balding",
    set: { parting: { kind: "none" }, cut: { mode: "length" }, length: { fringe: 0.012, top: 0.012, sides: 0.02, back: 0.02, nape: 0.012 }, ears: "clear", hairline: { shape: "receding_3", thinning: "horseshoe", thinAmount: 1, thinSize: 0.5, sideburns: 0.4 }, look: "salt_pepper", texture: { strays: 0 } } },
  shaved: { label: "Shaved, a shadow of stubble", group: "balding",
    set: { parting: { kind: "none" }, cut: { mode: "length" }, length: { fringe: 0.0015, top: 0.0015, sides: 0.0015, back: 0.0015, nape: 0.0012 }, ears: "clear", hairline: { shape: "m_shape", thinning: "top", thinAmount: 0.45, sideburns: 0.2, soft: 0.8 }, scalp: { shade: 0.5, stubble: 0.5 }, texture: { strays: 0 } } },
  comb_over: { label: "Comb-over", group: "balding",
    set: { parting: { kind: "left", offset: 0.062, length: 0.7, width: 0.001 }, comb: { hold: 1 }, cut: { mode: "length", wispy: 0.8 }, length: { fringe: 0.1, top: 0.13, sides: 0.025, back: 0.025, nape: 0.012 }, ears: "clear",
      shape: { lift: 8, volume: { top: 0.003, sides: 0.003, back: 0.004 } }, hairline: { shape: "receding_2", thinning: "top", thinAmount: 0.75, thinSize: 0.6, sideburns: 0.4 }, look: "salt_pepper", texture: { clump: 0.7, wet: 0.3, strays: 4 } } },
  // ---- for our games
  over_face: { label: "Long hair over the face", group: "horror",
    set: { parting: { kind: "none" }, comb: { top: "forward" }, cut: { mode: "line", line: -0.14, uneven: 0.9, thin: 0.3, wispy: 0.9 }, shape: { lift: 10, volume: { top: 0.004, sides: 0.007, back: 0.009 }, turn: 0 },
      fringe: { kind: "over", line: P.chin - 0.03, amount: 1, width: 62, uneven: 1, wispy: 1, curve: 0.15 }, length: { fringe: 0.4 }, texture: { clump: 0.75, clumpSize: 0.022, wet: 0.35, frizz: 0.3, messy: 0.25, strays: 40 } } },
  unkempt: { label: "Unkempt", group: "horror",
    set: { parting: { kind: "right", offset: 0.02, length: 0.3, width: 0.0006 }, cut: { mode: "line", line: -0.14, layers: 0.6, uneven: 1, thin: 0.4, wispy: 1 }, length: { top: 0.2, sides: 0.22, back: 0.24, nape: 0.2 },
      shape: { lift: 36, volume: { top: 0.013, sides: 0.016, back: 0.016 }, turn: 0 }, texture: { clump: 0.65, clumpSize: 0.02, wave: 0.007, waveLength: 0.07, together: 0.1, frizz: 0.8, messy: 0.9, strays: 120 }, look: "off_black" } },
  wet: { label: "Wet", group: "horror",
    set: { parting: { kind: "middle", length: 0.6, width: 0.002 }, cut: { mode: "line", line: -0.14, uneven: 0.8, thin: 0.2, wispy: 0.9 }, shape: { lift: 6, volume: { top: 0.002, sides: 0.004, back: 0.005 }, turn: 0 },
      fringe: { frame: 0.8, frameLine: P.chin }, texture: { clump: 0.9, clumpSize: 0.02, wet: 1, frizz: 0.05, messy: 0.2, strays: 0 }, look: { ...LOOKS2.soft_black, label: "Wet black", shine: 1.6, gloss1: 320 } } },
  // ---- children
  bowl: { label: "Bowl cut", group: "children",
    set: { parting: { kind: "none" }, comb: { top: "forward" }, cut: { mode: "line", line: 0.012, round: -0.5, uneven: 0.15, wispy: 0.2 }, shape: { lift: 28, volume: { top: 0.01, sides: 0.011, back: 0.011 }, turn: 0.6, turnRadius: 0.02 },
      fringe: { kind: "blunt", line: P.brow + 0.006, amount: 1, width: 56, arch: 0.1 }, texture: { clump: 0.25, strays: 10 } } },
  bob_fringe: { label: "Short bob, full fringe", group: "children",
    set: { parting: { kind: "none" }, comb: { top: "forward" }, cut: { mode: "line", line: -0.055, uneven: 0.2, wispy: 0.2 }, shape: { lift: 24, volume: { top: 0.009, sides: 0.011, back: 0.012 }, turn: 0.6, turnRadius: 0.025 },
      fringe: { kind: "blunt", line: P.brow + 0.004, amount: 0.9, width: 46 }, texture: { clump: 0.25, strays: 15 } } },
};
export const GROUPS = { pictures: "From the pictures", women: "Women's", ears: "Women's, long with the ears out", asian: "Japanese and Korean styles", anime: "Drawn hair: the chart's twelve", men: "Men's", balding: "Balding", horror: "For our games", children: "Children's" };

// a style's settings: the defaults, the style it's from, its own, then what the character changed. A fringe's kind
// brings its own numbers in under whatever is set by name
const merge = (a, b) => { const o = Array.isArray(a) ? a.slice() : { ...a }; for (const k in b) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a && a[k] && typeof a[k] === "object" ? merge(a[k], b[k]) : b[k]; return o; };
export function settings(style, set = {}) {
  const chain = []; for (let k = style; k && STYLES[k]; k = STYLES[k].from) chain.unshift(STYLES[k].set || {});
  const own = [...chain, set].reduce(merge, {}), kind = (own.fringe && own.fringe.kind) || DEFAULTS.fringe.kind, fk = { ...(FRINGES[kind] || {}) }; delete fk.label;
  return merge(merge(DEFAULTS, { fringe: fk }), own);
}
// what differs between a style's settings and the settings in hand: what a character keeps beside the style's name
export function differs(style, s) {
  const base = settings(style), walk = (a, b) => { const o = {}; for (const k in b) { if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a && typeof a[k] === "object" && a[k]) { const d = walk(a[k], b[k]); if (Object.keys(d).length) o[k] = d; } else if (!a || a[k] !== b[k]) o[k] = b[k]; } return o; };
  return walk(base, s);
}

// ---- the controls the tab draws (hair2/ui.js), by section. A row: [path, label, "slide", lo, hi, step, k, help] (k: what
// the stored number is times to show it: centimetres and millimetres read as such), [path, label, "pick", [[value, label]...]],
// or [path, label, "colour"]
const cm = 100, mm = 1000;
const opt = o => Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? v : v.label]);
export const CONTROLS = [
  { id: "hairline", label: "Hairline", help: "Where hair grows: the pores inside this edge are alive. Show the pores to see them.", rows: [
    ["hairline.shape", "Shape", "pick", opt(HAIRLINES)],
    ["hairline.height", "Height", "slide", -15, 25, 1, 1, "The whole front edge up or down (mm)."],
    ["hairline.temples", "Temples", "slide", 0, 30, 1, 1, "How far the corners go back (mm): an M."],
    ["hairline.peak", "Peak", "slide", 0, 14, 1, 1, "A point down at the middle (mm)."],
    ["hairline.sideburns", "Sideburns", "slide", 0, 1, 0.05, 1, "None, to down by the earlobe."],
    ["hairline.nape", "Nape", "slide", 0, 1, 0.05, 1, "The back edge: high to low."],
    ["hairline.napeShape", "Nape shape", "pick", [["round", "Round"], ["straight", "Straight"], ["v", "V"]]],
    ["hairline.irregular", "Irregular", "slide", 0, 1, 0.05, 1, "A real hairline wobbles."],
    ["hairline.soft", "Soft edge", "slide", 0, 1, 0.05, 1, "The last centimetre thins into short fine hairs instead of ending in a line."],
    ["hairline.seed", "Variation", "slide", 1, 40, 1, 1, "Another edge of the same shape."],
    ["hairline.thinning", "Thinning", "pick", opt(THINNING)],
    ["hairline.thinAmount", "How thin", "slide", 0, 1, 0.05, 1, ""],
    ["hairline.thinSize", "How wide", "slide", 0, 1, 0.05, 1, ""],
  ] },
  { id: "parting", label: "Parting and direction", help: "Which way the hair is combed.", rows: [
    ["parting.kind", "Parting", "pick", [["none", "None (from the crown)"], ["middle", "Middle"], ["left", "Her left"], ["right", "Her right"]]],
    ["parting.offset", "To the side", "slide", 1, 7, 0.1, cm, "How far from the middle a side parting is (cm)."],
    ["parting.length", "How far back", "slide", 0, 1, 0.05, 1, "Over the forehead only, to all the way to the crown."],
    ["parting.angle", "Angle", "slide", -30, 30, 1, 1, "A parting that runs at a slant (degrees)."],
    ["parting.width", "Skin showing", "slide", 0, 5, 0.1, mm, "The line of scalp along the parting (mm)."],
    ["crown.x", "Crown, side", "slide", -3, 3, 0.1, cm, "The whorl to her left or right (cm)."],
    ["crown.phi", "Crown, back", "slide", -70, -10, 1, 1, "The whorl from the top of the head back (degrees)."],
    ["crown.swirl", "Swirl", "slide", -1, 1, 0.05, 1, "How much the hair turns round the whorl, either way."],
    ["comb.top", "The top", "pick", [["natural", "Falls naturally"], ["back", "Combed back"], ["forward", "Combed forward"]]],
    ["comb.sides", "The sides", "pick", [["down", "Down"], ["back", "Back"], ["forward", "Forward"]]],
    ["ears", "The ears", "pick", [["covered", "Covered"], ["tucked", "Out: the hair tucked behind them"], ["tucked_left", "Out on her left only"], ["tucked_right", "Out on her right only"], ["clear", "Clear (cut round them)"]]],
    ["tuckFall", "Tucked hair falls", "pick", [["front", "Over the shoulders, in front"], ["back", "Behind the shoulders"]]],
    ["comb.hold", "Hold", "slide", 0, 1, 0.05, 1, "How far the comb reaches before gravity takes over: natural to gelled."],
  ] },
  { id: "length", label: "Length and cut", help: "How long each part is, and how the ends are cut.", rows: [
    ["cut.mode", "Cut", "pick", [["line", "To a line (one length)"], ["length", "By length (layered, short cuts)"]]],
    ["cut.line", "Line height", "slide", -30, 4, 0.5, cm, "Where the line is: over the ears (0), the chin (-9.6), the shoulders (-13.5), down to the chest (-30)."],
    ["cut.tilt", "Tilt", "slide", -1, 1, 0.05, 1, "Longer in front (an A-line), or behind."],
    ["cut.round", "Round", "slide", -1, 1, 0.05, 1, "The back's middle lower (a U) or higher."],
    ["cut.layers", "Layers", "slide", 0, 1, 0.05, 1, "From one length to the lengths below."],
    ["cut.tiers", "Two lengths", "pick", [["one", "No: one line"], ["front", "The front and sides shorter, the back long"], ["over", "A bob over a long nape (jellyfish)"]]],
    ["cut.front", "The shorter line", "slide", -20, 4, 0.5, cm, "Where the front and sides (or the bob) end: just under the ears (-6), the chin (-9.6)."],
    ["cut.frontTo", "As far round as", "slide", 40, 150, 1, 1, "Front and sides shorter: how far round the head the shorter line goes (degrees: 70 the sidelocks, 112 behind the ears)."],
    ["cut.frontSoft", "Step or slope", "slide", 0, 1, 0.05, 1, "A step between the two lengths, or a slope from one to the other."],
    ["length.top", "Top", "slide", 0.1, 45, 0.1, cm, "cm"],
    ["length.sides", "Sides", "slide", 0.1, 45, 0.1, cm, "cm"],
    ["length.back", "Back", "slide", 0.1, 45, 0.1, cm, "cm"],
    ["length.nape", "Nape", "slide", 0.1, 30, 0.1, cm, "cm"],
    ["under.height", "Undercut up to", "slide", -5, 9, 0.5, cm, "Clipped short below this height (cm over the ears' line); all the way down: none.", { none: -5 }],
    ["under.length", "Undercut length", "slide", 1, 25, 1, mm, "mm"],
    ["under.fade", "Fade", "slide", 0, 5, 0.1, cm, "How gradually the undercut meets the longer hair (cm)."],
    ["cut.wispy", "Ends", "slide", 0, 1, 0.05, 1, "Blunt to wispy."],
    ["cut.thin", "Thin out", "slide", 0, 0.6, 0.05, 1, "Some hairs cut shorter."],
    ["cut.uneven", "Uneven", "slide", 0, 1, 0.05, 1, ""],
  ] },
  { id: "shape", label: "Shape and volume", help: "How the hair lifts and how full it lies.", rows: [
    ["shape.lift", "Root lift", "slide", 0, 80, 1, 1, "How steeply hair leaves the head (degrees): flat to standing."],
    ["shape.volume.top", "Volume, top", "slide", 1, 35, 1, mm, "How thick the hair lies (mm)."],
    ["shape.volume.sides", "Volume, sides", "slide", 1, 35, 1, mm, ""],
    ["shape.volume.back", "Volume, back", "slide", 1, 35, 1, mm, ""],
    ["shape.turn", "Ends turn", "slide", -1, 1, 0.05, 1, "Out (flipped) to in (curled under)."],
    ["shape.turnRadius", "Turn radius", "slide", 1, 7, 0.1, cm, "cm"],
    ["shape.stiff", "Stiffness", "slide", 0, 1, 0.05, 1, "How slowly a hair bends: soft to stiff (short hair stands)."],
    ["shape.quiff", "Quiff", "slide", 0, 1, 0.05, 1, "The front stands up and goes back."],
    ["shape.ahoge", "Ahoge", "slide", 0, 1, 0.05, 1, "A lock standing up out of the top of the head and curving over."],
    ["shape.ahogeSide", "Ahoge, side", "slide", -1, 1, 0.05, 1, "To her right (-) or her left (+)."],
  ] },
  { id: "texture", label: "Texture", help: "Straight to wavy to curly; locks, frizz, stray hairs.", rows: [
    ["texture.wave", "Waves", "slide", 0, 30, 0.5, mm, "Their size (mm)."],
    ["texture.waveLength", "Wave length", "slide", 4, 16, 0.5, cm, "cm"],
    ["texture.waveStart", "Starts at", "slide", 0, 0.8, 0.05, 1, "How far down the hair waves and curls begin."],
    ["texture.together", "In step", "slide", 0, 1, 0.05, 1, "Each lock on its own, to waves that run across the whole head."],
    ["texture.curl", "Curls", "slide", 0, 1, 0.05, 1, ""],
    ["texture.curlRadius", "Curl size", "slide", 4, 25, 0.5, mm, "mm"],
    ["texture.clump", "Locks", "slide", 0, 0.95, 0.05, 1, "How much hairs gather into locks."],
    ["texture.clumpSize", "Lock size", "slide", 0.8, 6, 0.1, cm, "cm"],
    ["texture.frizz", "Frizz", "slide", 0, 1, 0.05, 1, ""],
    ["texture.messy", "Messy", "slide", 0, 1, 0.05, 1, ""],
    ["texture.wet", "Wet", "slide", 0, 1, 0.05, 1, "Tight locks, flat roots, gloss."],
    ["texture.strays", "Stray hairs", "slide", 0, 160, 2, 1, ""],
  ] },
  { id: "fringe", label: "Fringe", help: "The hair over the forehead, and the strands that frame the face.", rows: [
    ["fringe.kind", "Kind", "pick", opt(FRINGES)],
    ["fringe.line", "Length", "slide", -14, 7, 0.2, cm, "Where it ends: the brows (3.7), the eyes (1.5), the nose (-2), the chin (-9.6)."],
    ["fringe.amount", "Amount", "slide", 0.05, 1, 0.05, 1, "A few hairs (see-through) to a full fringe."],
    ["fringe.width", "Width", "slide", 20, 64, 1, 1, "How far round to the temples (degrees)."],
    ["fringe.sweep", "Sweep", "slide", -70, 70, 1, 1, "To her right or left (degrees)."],
    ["fringe.split", "Split", "slide", 0, 1, 0.05, 1, "A curtain: how far it parts."],
    ["fringe.curve", "Curve", "slide", 0, 1, 0.05, 1, "How it rounds off the forehead."],
    ["fringe.arch", "Arch", "slide", 0, 1, 0.05, 1, "Longer toward the temples."],
    ["fringe.wispy", "Ends", "slide", 0, 1, 0.05, 1, "Blunt to wispy."],
    ["fringe.uneven", "Uneven", "slide", 0, 1, 0.05, 1, ""],
    ["fringe.choppy", "Choppy", "slide", 0, 1, 0.05, 1, "Each lock cut to its own length (with Locks: pointed, drawn-looking bangs)."],
    ["fringe.centre", "Centre lock", "slide", 0, 1, 0.05, 1, "A longer lock between the eyes."],
    ["fringe.slant", "Slant", "slide", -1, 1, 0.05, 1, "Longer toward her left (+) or her right (-): hair over one eye."],
    ["length.fringe", "Longest", "slide", 0.1, 40, 0.1, cm, "A swept fringe's length (cm)."],
    ["fringe.frame", "Face-framing strands", "slide", 0, 1, 0.05, 1, "Strands left hanging in front of the ears."],
    ["fringe.frameLine", "Their length", "slide", -26, 3, 0.5, cm, "The cheek (-2), the jaw (-6.6), the chin (-9.6)."],
    ["fringe.frameCurl", "Ringlets", "slide", 0, 1, 0.05, 1, "The face-framing strands wound into a ringlet a side, hanging from the ears' line to their length."],
  ] },
  { id: "ties", label: "Ties", help: "Ponytails, twin tails, half-up, buns.", rows: [
    ["ties.kind", "Kind", "pick", [["none", "None"], ["pony", "Ponytail"], ["twin", "Twin tails"], ["half", "Half-up"], ["twin_half", "Two side up"], ["bun", "Bun"], ["buns", "Twin buns"], ["knot", "Top knot"]]],
    ["ties.height", "Height", "slide", 0, 1, 0.02, 1, "The nape to the crown."],
    ["ties.side", "Out to the sides", "slide", 0, 1, 0.02, 1, "Twin tails: close behind the head, to out by the ears."],
    ["ties.offset", "To one side", "slide", -1, 1, 0.05, 1, "One tail or bun round to her left (+) or her right (-): a side ponytail."],
    ["ties.part", "Takes", "pick", [["all", "All the hair"], ["top", "The top's hair only (the rest hangs loose)"]]],
    ["ties.tight", "Tightness", "slide", 0, 1, 0.05, 1, ""],
    ["ties.loose", "Left loose in front", "slide", 0, 1, 0.02, 1, "How far round from the face the hair stays out of the ties."],
    ["ties.tail.length", "Tail length", "slide", 3, 45, 0.5, cm, "cm"],
    ["ties.tail.thick", "Tail thickness", "slide", 5, 28, 0.5, mm, "mm"],
    ["ties.tail.spread", "Tail spread", "slide", 0, 1.5, 0.05, 1, ""],
    ["ties.tail.taper", "Tail taper", "slide", 0, 1, 0.05, 1, ""],
    ["ties.tail.fall", "Tails fall", "pick", [["back", "Behind"], ["front", "Over the shoulders"]]],
    ["ties.tail.sway", "Sway", "slide", 0, 1, 0.05, 1, "How freely the tail swings in a game."],
    ["ties.tail.bun", "Bun size", "slide", 1.5, 7, 0.1, cm, "cm"],
    ["ties.tie.kind", "Tie", "pick", [["elastic", "Elastic"], ["scrunchie", "Scrunchie"], ["none", "None"]]],
    ["ties.tie.colour", "Tie colour", "colour"],
  ] },
  { id: "colour", label: "Colour", help: "", rows: [
    ["look", "Look", "pick", opt(ALL_LOOKS)],
    ["scalp.shade", "Shade under the hair", "slide", 0, 1, 0.05, 1, "The roots' colour on the scalp, so no skin shows between hairs."],
    ["scalp.stubble", "Stubble", "slide", 0, 1, 0.05, 1, "A shadow of stubble over the whole scalp."],
  ] },
  { id: "detail", label: "Detail", help: "How much hair there is to draw.", rows: [
    ["density", "Pores", "slide", 400, 2600, 50, 1, "How many pores grow a lock."],
    ["detail", "Detail", "pick", [["light", "Light (about 9,000 triangles)"], ["medium", "Medium (about 20,000)"], ["high", "High (about 40,000)"]]],
    ["card.width", "Lock width", "slide", 1.2, 3.5, 0.1, 1, "In pore spacings: wider covers more."],
    ["card.taper", "Lock taper", "slide", 0, 0.9, 0.05, 1, ""],
    ["seed", "Variation", "slide", 1, 40, 1, 1, ""],
  ] },
];

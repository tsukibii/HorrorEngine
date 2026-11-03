// The street builder's building styles and street mixes (docs/STREET_BUILDER.md §3): each style makes a whole
// building from a seed (its size, floors, colours, windows, signs, roof and the things on it), after the user's
// reference pictures; a mix is the styles a street is filled with. Everything a style makes is written into the
// building, so a building stays as it was when its style changes.
import { rng } from "./street-gen.js";

const pick = (R, a) => a[Math.floor(R() * a.length) % a.length];
const range = (R, a, b, step = 0.1) => Math.round((a + R() * (b - a)) / step) * step;
const chance = (R, p) => R() < p;
const r2 = v => Math.round(v * 100) / 100;

const SHOP_WORDS = ["カラオケ", "居酒屋", "ラーメン", "焼肉", "喫茶", "BAR", "カフェ", "歯科", "整骨院", "質屋", "古着", "薬", "麻雀", "ホテル", "寿司", "スナック", "占い", "manga", "ゲーム", "美容室", "不動産", "居酒屋 鳥よし", "中華"];
const BOARD_WORDS = ["ラーメン 一番", "カラオケ館", "喫茶 ひかり", "Karaoke", "BAR 9", "やきとり", "古本", "クリーニング", "ふとん店", "たばこ", "酒", "薬局", "米", "電器", "美容室 花"];
const SIGN_COLOURS = [["#ffffff", "#c8322b"], ["#1b1b1d", "#f2c230"], ["#ffffff", "#203a78"], ["#ffe9a8", "#1d1d20"], ["#ffffff", "#2d7a46"], ["#ff5aa5", "#1c1c22"], ["#ffffff", "#7b2d8f"], ["#1d1d20", "#f3f1ea"]];
const WALLS_CITY = ["#d9d6cf", "#c9c6bf", "#bfb9ae", "#e4e1da", "#a8a49c", "#d2cbbf", "#8f8c86", "#c4c7c9", "#b8b2a6"];
const WALLS_HOUSE = ["#e8e0cf", "#ddd3bf", "#efe8da", "#d6cbb5", "#e3dccb", "#c9c0ae", "#bfb7a4"];
const WALLS_DARK = ["#3a2c22", "#33271e", "#43332a", "#2c2219"];

function vsign(R, w, z, text) {
  const [fg, bg] = pick(R, SIGN_COLOURS);
  return { kind: "vsign", x: r2((chance(R, 0.5) ? 1 : -1) * (w / 2 - 0.35)), z, h: r2(range(R, 2.4, 5.5)), out: r2(range(R, 0.55, 0.85)), text: text || pick(R, SHOP_WORDS), fg, bg };
}
function board(R, w, z, h = 0.7, text) { const [fg, bg] = pick(R, SIGN_COLOURS); return { kind: "sign", x: 0, z, w: r2(Math.max(1, w - 0.6)), h, text: text || pick(R, BOARD_WORDS), fg, bg }; }

// a style: label, the reference it's after, a note, and make(R) -> the building's fields (no id, at or turn)
export const STYLES = {
  shop: { label: "Shop building", ref: "the Shibuya lane (city)", note: "a shop on the ground floor, offices or bars above, signs sticking out",
    make(R) {
      const w = range(R, 5, 9.5, 0.5), floors = Math.round(range(R, 4, 8, 1)), gh = range(R, 3.8, 4.3), fh = range(R, 3.0, 3.3);
      const parts = [board(R, w, r2(gh - 0.85))];
      if (chance(R, 0.75)) parts.push(vsign(R, w, r2(gh + range(R, 0.2, 2))));
      if (chance(R, 0.3)) parts.push({ kind: "ac", face: "front", x: r2(range(R, -w / 3, w / 3)), z: 0.4, floors: [2, Math.min(4, floors)] });
      return { style: "shop", w, d: range(R, 9, 14, 0.5), floors, gh, fh, seed: Math.floor(R() * 1e6),
        look: { wall: pick(R, WALLS_CITY), wall2: pick(R, ["#3a3a3e", "#55524d", "#2c2d31", "#6d6a64"]) },
        faces: { front: { win: pick(R, ["punched", "punched", "band", "pairs"]), ground: "shop", bands: chance(R, 0.7), lit: range(R, 0.35, 0.75, 0.05), groundSlot: "wall2", sill: range(R, 0.7, 1.0) }, back: { win: "small" } },
        roof: { kind: pick(R, ["flat", "rail"]), things: chance(R, 0.6) ? [{ kind: "tank", x: r2(range(R, -1, 1)), y: 1 }] : [] }, parts };
    } },
  pencil: { label: "Pencil building", ref: "the Shibuya lane (the narrow one)", note: "narrow and tall, a box sticking out on every floor",
    make(R) {
      const w = range(R, 3.4, 5, 0.2), floors = Math.round(range(R, 6, 9, 1)), gh = range(R, 3.6, 4.0), fh = range(R, 2.9, 3.1);
      const bw = r2(w * 0.55), side = chance(R, 0.5) ? 1 : -1;
      return { style: "pencil", w, d: range(R, 8, 12, 0.5), floors, gh, fh, seed: Math.floor(R() * 1e6),
        look: { wall: pick(R, WALLS_CITY), wall2: "#38383c" },
        faces: { front: { win: "tall", cols: 1, ground: "shop", groundSlot: "wall2", lit: range(R, 0.3, 0.7, 0.05) }, back: { win: "small" } },
        roof: { kind: "rail", things: [{ kind: "ac", n: 2 }] },
        parts: [{ kind: "bay", x: r2(side * (w / 2 - bw / 2 - 0.1)), w: bw, h: r2(fh - 0.6), z: 0.3, out: 0.7, floors: [2, floors], win: true, slot: "trim" }, board(R, w, r2(gh - 0.8), 0.6),
          Object.assign(vsign(R, w, r2(gh + 0.5)), { x: r2(-side * (w / 2 - 0.35)) })] };   // the blade on the side the bays leave open
    } },
  office: { label: "Glass office", ref: "the city", note: "bands of glass, a lit lobby, cool light inside",
    make(R) {
      const w = range(R, 8, 14, 0.5), floors = Math.round(range(R, 6, 11, 1));
      return { style: "office", w, d: range(R, 12, 18, 0.5), floors, gh: 4.2, fh: 3.4, seed: Math.floor(R() * 1e6),
        look: { wall: pick(R, ["#9aa0a6", "#c7cbce", "#6f757b", "#d8dadb"]) },
        faces: { front: { win: pick(R, ["band", "glass"]), ground: "glass", bands: true, lit: range(R, 0.3, 0.7, 0.05), cool: 0.85 }, left: { win: "band", lit: 0.4, cool: 0.85 }, right: { win: "band", lit: 0.4, cool: 0.85 }, back: { win: "punched" } },
        roof: { kind: "flat", parapet: 1.2, things: [{ kind: "hut", x: r2(range(R, -2, 2)) }, { kind: "ac", n: 4, y: -2 }] }, parts: [] };
    } },
  tower: { label: "White tower", ref: "the white tower with a glass-block stairwell", note: "white walls, small windows, a stairwell of glass blocks, a hut and an antenna on top",
    make(R) {
      const w = range(R, 8, 11, 0.5), floors = Math.round(range(R, 7, 9, 1)), fh = 2.9, gh = 3.2;
      return { style: "tower", w, d: range(R, 8, 11, 0.5), floors, gh, fh, seed: Math.floor(R() * 1e6),
        look: { wall: pick(R, ["#e9e7e1", "#e2dfd7", "#ecebe6"]), wall2: "#b9b4aa" },
        faces: { front: { win: "small", cols: Math.max(2, Math.round(w / 3)), ground: "door", groundSlot: "wall2", lit: 0.35 }, left: { win: "small", cols: 2, lit: 0.3 }, right: { win: "small", cols: 2, lit: 0.3 }, back: { win: "small" } },
        roof: { kind: "flat", parapet: 0.8, things: [{ kind: "hut", x: r2(w / 2 - 1.8), w: 2.4, d: 2.6, h: 2.4 }, { kind: "antenna", x: r2(w / 2 - 1.8), y: 0.6, h: 2.5 }, { kind: "tank", x: r2(-w / 2 + 1.6) }] },
        parts: [{ kind: "glassblock", x: r2(-w / 2 + 1.3), w: 1.2, h: r2(fh * (floors - 1) - 0.6), z: r2(gh + 0.3) },
                { kind: "window", x: r2(w / 2 - 2.0), w: 2.6, h: 2.2, z: 0.4, floors: [Math.max(2, floors - 3), floors], lit: false },
                { kind: "pipe", face: "left", x: r2(range(R, -2, 2)), h: r2(gh + fh * (floors - 1)) }] };
    } },
  apartment: { label: "Apartment block", ref: "the city's flats", note: "balconies on every floor, AC units, a lit entrance",
    make(R) {
      const w = range(R, 9, 16, 0.5), floors = Math.round(range(R, 4, 7, 1)), fh = 2.9, units = Math.max(2, Math.round(w / 4.5)), uw = w / units;
      const parts = [];
      for (let i = 0; i < units; i++) {
        const x = r2(-w / 2 + uw * (i + 0.5));
        parts.push({ kind: "balcony", x, w: r2(uw - 0.25), out: 1.1, floors: [2, floors], rail: pick(R, ["solid", "solid", "bars"]) });
        if (chance(R, 0.7)) parts.push({ kind: "ac", x: r2(x + uw / 2 - 0.65), z: 0.05, out: 0.3, floors: [2, floors] });
      }
      return { style: "apartment", w, d: range(R, 9, 12, 0.5), floors, gh: 3.1, fh, seed: Math.floor(R() * 1e6),
        look: { wall: pick(R, [...WALLS_HOUSE, "#c8c3b8"]), trim: "#ece9e2" },
        faces: { front: { win: "tall", cols: units, ww: 1.6, wh: 2.0, sill: 0.15, ground: "door", door: 0.5, lit: range(R, 0.3, 0.6, 0.05) }, left: { win: "small", cols: 2 }, right: { win: "small", cols: 2 }, back: { win: "punched", cols: units } },
        roof: { kind: "flat", parapet: 0.9, things: chance(R, 0.5) ? [{ kind: "tank" }] : [] }, parts };
    } },
  house: { label: "House", ref: "the quiet residential street", note: "two storeys of stucco, a door and windows with grilles, a fire box and a meter on the wall",
    make(R) {
      const w = range(R, 6, 9, 0.5), gh = 2.9, fh = 2.7;
      return { style: "house", w, d: range(R, 7, 10, 0.5), floors: 2, gh, fh, seed: Math.floor(R() * 1e6),
        look: { wall: pick(R, WALLS_HOUSE), roof: pick(R, ["#3c3f45", "#4a3f3a", "#2f3a46"]) },
        faces: { front: { win: pick(R, ["punched", "shutters"]), ww: 1.5, wh: 1.2, ground: "door", door: pick(R, [0.2, 0.75]), lit: range(R, 0.2, 0.6, 0.05) }, left: { win: "small", cols: 1 }, right: { win: "small", cols: 1 }, back: { win: "punched", cols: 2 } },
        roof: { kind: pick(R, ["hip", "gable", "flat"]), pitch: range(R, 20, 28, 1), over: 0.5, parapet: 0.5 },
        parts: [{ kind: "canopy", x: 0, z: 2.35, w: 1.6, h: 0.12, out: 0.8, slot: "metal" }, { kind: "block", x: r2(-w / 2 + 0.7), z: 1.3, w: 0.28, h: 0.42, out: 0.14, slot: "red" }, { kind: "block", x: r2(w / 2 - 0.6), z: 1.4, w: 0.32, h: 0.4, out: 0.12, slot: "metal" }] };
    } },
  machiya: { label: "Old wooden house", ref: "the old post town at dusk", note: "dark timber, lattice fronts, a tiled eave between the floors, a deep roof and a lantern",
    make(R) {
      const w = range(R, 6, 10, 0.5), gh = 2.8, fh = 2.4;
      const parts = [{ kind: "eave", z: r2(gh + 0.15), out: 1.0, h: 0.5 }];
      if (chance(R, 0.5)) parts.push({ kind: "lantern", x: r2(range(R, -w / 3, w / 3)), z: 2.2, out: 0.75 });
      if (chance(R, 0.4)) parts.push({ kind: "noren", x: r2((range(R, 0.25, 0.4) - 0.5) * w), z: 1.55, w: 1.3 });
      return { style: "machiya", w, d: range(R, 10, 14, 0.5), floors: 2, gh, fh, seed: Math.floor(R() * 1e6),
        look: { wall: pick(R, WALLS_DARK), trim: "#2a2019", roof: "#3a3d42", wall2: "#d8d0bf" },
        faces: { front: { win: "lattice", ground: "lattice", door: range(R, 0.25, 0.4, 0.05), lit: range(R, 0.3, 0.7, 0.05), sill: 0.5, wh: 1.2 }, left: { win: "none" }, right: { win: "none" }, back: { win: "lattice" } },
        roof: { kind: "gable", pitch: range(R, 22, 28, 1), over: 1.0 }, parts };
    } },
  danchi: { label: "Concrete block", ref: "the abandoned concrete flats", note: "a long concrete block, shutters, a heavy canopy, pipes and an outside stair",
    make(R) {
      const w = range(R, 12, 20, 1), floors = Math.round(range(R, 4, 5, 1)), gh = 3.3, fh = 2.8, abandoned = chance(R, 0.6);
      return { style: "danchi", w, d: range(R, 9, 11, 0.5), floors, gh, fh, seed: Math.floor(R() * 1e6),
        look: { wall: pick(R, ["#bdb6a8", "#a9a397", "#c4bdb0"]), concrete: "#7b776f" },
        faces: { front: { win: "punched", cols: Math.round(w / 3.2), ww: 1.5, wh: 1.2, ground: "shutter", lit: abandoned ? 0.03 : 0.4, bands: true }, left: { win: "small", cols: 1, lit: 0.1 }, right: { win: "none" }, back: { win: "punched", cols: Math.round(w / 3.2) } },
        roof: { kind: "flat", parapet: 0.7, things: [{ kind: "tank", x: r2(w / 2 - 2) }] },
        parts: [{ kind: "canopy", x: 0, z: r2(gh - 0.1), w: r2(w + 0.6), h: 0.45, out: 2.2 }, { kind: "pipe", x: r2(w / 2 - 0.4), h: r2(gh + fh * (floors - 1)) }, { kind: "pipe", x: r2(-w / 6), h: r2(gh + fh * (floors - 1)), z: 0 },
                { kind: "stairs", face: "left", w: 6, h: r2(gh), out: 1.2, dir: 1 }] };
    } },
  // a small Japanese school (the user, 2026-11-01: "consider the hallway and exterior building too (a small japanese
  // school)"; STREET_BUILDER §3): its classroom wing and its gym
  school: { label: "School building (校舎)", ref: "a small Japanese school", note: "two or three storeys of classrooms behind rows of big windows (a bay each, 3 m), the corridor's windows along the back, a flat roof with its fence and water tank, a clock on a tower over the middle, the entrance at one end under a canopy",
    make(R) {
      const bays = Math.round(range(R, 10, 16, 1)), w = bays * 3.0, floors = Math.round(range(R, 2, 3, 1)), gh = 3.8, fh = 3.6, top = gh + fh * (floors - 1);
      const wall = pick(R, ["#ece6d6", "#e7e2d6", "#efe9dc", "#e3ded2"]);
      return { style: "school", w, d: range(R, 10, 11, 0.5), floors, gh, fh, seed: Math.floor(R() * 1e6),
        look: { wall, wall2: pick(R, ["#b8b2a5", "#a9b4ae", "#c4b8a2"]), trim: "#d9d4c8" },
        faces: { front: { win: "punched", cols: bays, ww: 2.4, wh: 1.8, sill: 0.85, bands: true, lit: 0.06, cool: 0.95 },
                 back: { win: "punched", cols: bays, ww: 2.2, wh: 1.5, sill: 0.95, bands: true, lit: 0.04, cool: 0.95 },
                 left: { win: "small", cols: 2, ground: "door", lit: 0.04 }, right: { win: "small", cols: 2, lit: 0.04 } },
        roof: { kind: "rail", things: [{ kind: "tank", x: r2(range(R, -w / 4, w / 4)), y: 1 }, { kind: "hut", x: r2(w / 2 - 3.5) }] },
        parts: [{ kind: "bay", x: 0, z: 0, w: 3.4, h: r2(top + 1.6), out: 0.5, slot: "wall" },                 // the clock tower: the middle bay stood out
                { kind: "clock", x: 0, z: r2(top + 0.05), w: 1.4, h: 1.4, out: 0.62 },
                { kind: "canopy", face: "left", x: 0, z: r2(gh - 1.0), w: 4.2, h: 0.3, out: 2.4 },
                { kind: "pipe", x: r2(-w / 2 + 0.35), h: r2(top) }, { kind: "pipe", x: r2(w / 2 - 0.35), h: r2(top) }] };
    } },
  gym: { label: "School gym (体育館)", ref: "a small Japanese school", note: "one tall hall under a low gable, a band of high windows along each side, doors at its end",
    make(R) {
      const w = range(R, 28, 34, 1), d = range(R, 18, 22, 1);
      return { style: "gym", w, d, floors: 1, gh: range(R, 8, 9.5, 0.5), fh: 3.6, seed: Math.floor(R() * 1e6),
        look: { wall: pick(R, ["#e6e0d2", "#ddd8cb", "#e9e4d8"]), wall2: "#9a958a", roof: pick(R, ["#4a6a7c", "#5b6670", "#6a4a3e"]) },
        faces: { front: { win: "band", wh: 1.6, sill: r2(range(R, 5.2, 6, 0.1)), margin: 1.2, lit: 0.02 }, back: { win: "band", wh: 1.6, sill: 5.6, margin: 1.2, lit: 0.02 },
                 left: { win: "small", cols: 3, ground: "door", lit: 0.02 }, right: { win: "none" } },
        roof: { kind: "gable", pitch: range(R, 12, 16, 1), over: 0.6 }, parts: [] };
    } },
  kiosk: { label: "Kiosk / shed", ref: "the little hut on the Shibuya lane", note: "one storey, a tiled roof, a door, a meter box",
    make(R) {
      const w = range(R, 3, 4.5, 0.5);
      return { style: "kiosk", w, d: range(R, 3, 4.5, 0.5), floors: 1, gh: 2.7, fh: 2.7, seed: Math.floor(R() * 1e6),
        look: { wall: pick(R, ["#e8e6e0", "#d8d5ce"]), roof: "#4a4f57" },
        faces: { front: { win: "punched", ground: "door", door: 0.75, lit: 0.6 }, left: { win: "small", cols: 1 }, right: { win: "none" }, back: { win: "none" } },
        roof: { kind: "hip", pitch: 22, over: 0.45 }, parts: [{ kind: "block", x: r2(-w / 2 + 0.75), z: 0.9, w: 0.6, h: 0.8, out: 0.18, slot: "white" }] };
    } },
  shotengai: { label: "Shopping-street shop", ref: "the shopping street under the mountain", note: "two or three floors, a shop or a shutter, an awning, a big sign board",
    make(R) {
      const w = range(R, 5, 8, 0.5), floors = Math.round(range(R, 2, 3, 1)), gh = 3.4, fh = 2.8, shut = chance(R, 0.3);
      const parts = [board(R, w, r2(gh + 0.25), 0.9)];
      parts.push(chance(R, 0.5) ? { kind: "awning", x: 0, z: r2(gh - 0.15), w: r2(w - 0.2), h: 0.45, out: 1.3, slot: pick(R, ["awning", "awning", "metal"]) } : { kind: "canopy", x: 0, z: r2(gh - 0.25), w: r2(w), h: 0.18, out: 1.6, slot: "metal" });
      if (chance(R, 0.5)) parts.push(vsign(R, w, r2(gh + 0.3)));
      return { style: "shotengai", w, d: range(R, 9, 13, 0.5), floors, gh, fh, seed: Math.floor(R() * 1e6),
        look: { wall: pick(R, [...WALLS_HOUSE, ...WALLS_CITY]), wall2: "#4b4844" },
        faces: { front: { win: "punched", ground: shut ? "shutter" : "shop", groundSlot: "wall2", lit: range(R, 0.3, 0.6, 0.05), closed: shut }, back: { win: "punched" } },
        roof: { kind: pick(R, ["flat", "shed", "gable"]), pitch: 15, over: 0.3, ridge: "x" }, parts };
    } },
};

// a street's mix: the styles it's filled with and how often
export const MIXES = {
  city: { label: "City lane (Shibuya)", styles: { shop: 5, pencil: 3, office: 1.5, tower: 1.5, apartment: 1 } },
  shotengai: { label: "Shopping street", styles: { shotengai: 7, house: 1.5, shop: 1.5 } },
  residential: { label: "Quiet houses", styles: { house: 6, apartment: 2, tower: 1, kiosk: 0.5 } },
  oldtown: { label: "Old post town", styles: { machiya: 9, house: 1 } },
  abandoned: { label: "Abandoned blocks", styles: { danchi: 4, house: 3, shotengai: 2 } },
};
export function pickStyle(R, mix) {
  const S = (MIXES[mix] || MIXES.city).styles, total = Object.values(S).reduce((a, b) => a + b, 0);
  let x = R() * total;
  for (const [k, v] of Object.entries(S)) { x -= v; if (x <= 0) return k; }
  return Object.keys(S)[0];
}
export function makeBuilding(style, seed, extra = {}) {
  const S = STYLES[style] || STYLES.shop, R = rng(seed);
  const b = S.make(R);
  if (style === "house" && extra.abandoned) { b.faces.front.lit = 0; b.faces.front.win = "shutters"; }
  return Object.assign(b, extra.size || {});
}

// the things a street's edge gets, by mix: lamps, poles, clutter
export const EDGES = {
  city: { lamp: "lamp", every: 18, poles: true, clutter: ["vending", "bike", "bike", "bollard", "bin", "crates", "ac", "pot", "bike"] },
  shotengai: { lamp: "lantern", every: 9, poles: true, clutter: ["bike", "pot", "vending", "crates", "bench", "pot"] },
  residential: { lamp: "lamp", every: 22, poles: true, clutter: ["bike", "pot", "pot", "ac", "vending", "postbox"] },
  oldtown: { lamp: "postlamp", every: 14, poles: false, clutter: ["pot", "pot", "bench", "crates", "bin"] },
  abandoned: { lamp: "lamp", every: 25, poles: true, clutter: ["cone", "barrier", "crates", "bin", "ac"] },
};

// a new street's starting point
export function blankStreet(name) {
  return { format: 1, name, about: "", time: "dusk", look: {},
    roads: [{ id: "road1", from: [0, -30], to: [0, 30], width: 6, walks: [2, 2], kerb: 0.15, edge: [0, 0], centre: "dashed", marks: [] }],
    buildings: [], things: [], fences: [], shots: [] };
}

// buildings to walk into (DECISIONS 2026-10-30, later night): their insides are sets from the scene builder (one floor
// each for now); the street builds their outsides round them, the doors the set's own
export const WALKINS = {
  motel: { label: "Motel", set: "motel_room", note: "a row of the same room on two floors, a walkway and a stair up to the upper doors (the set: motel_room)" },
  bungalow: { label: "Bungalow", set: "bungalow", note: "a single-storey house round an engawa, its floor raised, steps up to its doors (the set: bungalow)" },
};
// any set from the scene builder as a building: its outside (walls, roof, fittings) as the set's Outside panel has it,
// read when it's put down (a plain hip roof until then, or if the set has none)
export function walkInSet(set) {
  return { style: "set", w: 8, d: 8, floors: 1, seed: 1, inside: { set, rows: 1, floors: 1, raise: 0.15, rooms: [] },
    look: { wall: "#cfc5b3", trim: "#6b5a49", tiles: "#3d4148" }, roof: { kind: "hip", pitch: 24, over: 0.6 }, parts: [] };
}
export function walkIn(kind) {
  // the motel is the street's own composition (six rooms, two floors, its walkway): it never follows a set's outside
  if (kind === "motel") return { style: "motel", w: 22, d: 6.6, floors: 2, seed: 1, inside: { set: "motel_room", rows: 6, floors: 2, raise: 0.15, rooms: [], own: true },
    look: { wall: "#d9d2c4", trim: "#a39d92", concrete: "#9a968e", rail: "#4d5560" }, roof: { kind: "flat", parapet: 0.6 },
    parts: [{ kind: "balcony", face: "front", x: 0, w: 22, out: 1.3, floors: [2, 2], rail: "rail", slot: "concrete", walkway: true },
            { kind: "stairs", face: "left", x: 0.7, w: 5.2, h: 3.05, out: 1.1, dir: 1, slot: "concrete", walkway: true },
            { kind: "sign", face: "front", x: 0, z: 5.75, w: 4.4, h: 0.9, text: "MOTEL さくら", fg: "#ff6a8a", bg: "#1d1a22" },
            { kind: "lamp", face: "front", x: -9.45, z: 1.95, floors: [1, 2], repeat: 6, gap: 3.6, color: "#ffe2b0", power: 3 },
            { kind: "ac", face: "front", x: -8.55, z: 0, out: 0.32, floors: [1, 2], repeat: 6, gap: 3.6 },
            { kind: "pipe", face: "front", x: -10.9, z: 0, h: 3.05, w: 0.12, out: 1.22, repeat: 7, gap: 3.63, slot: "rail" }] };
  return { style: "bungalow", w: 11, d: 10.1, floors: 1, seed: 1, inside: { set: "bungalow", rows: 1, floors: 1, raise: 0.45, rooms: [] },
    look: { wall: "#cfc5b3", trim: "#6b5a49", tiles: "#3d4148" }, roof: { kind: "hip", pitch: 24, over: 0.8 }, parts: [] };
}

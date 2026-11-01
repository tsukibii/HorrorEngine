// The scene builder's room kinds and reference layouts. Japanese homes are drawn on a 910 mm module (half a tatami's
// length, the shaku-ken grid builders still use) and their rooms are sold in jō (帖): 1.62 m² a jō in listings.
// A layout here is a short recipe: rooms as rectangles [x0, y0, x1, y1] in metres (x east, y north), doors and
// windows named by the rooms they join; the builder turns them into the story's rooms, openings and links.

export const JO = 1.62;           // m² a jō (帖), the size Japanese listings use
export const MODULE = 0.91;       // the 910 mm module
export const STOREY = 2.85;       // floor to floor in a two-storey house (2.4 m ceilings, the floor between)

// kind: label, Japanese, plan colour, footsteps (the format's floor), default size, ceiling height, built-ins
export const KINDS = {
  genkan:   { en: "Entrance", ja: "玄関", color: "#9a8466", floor: "tile", size: [1.4, 1.6], fx: ["shoe_cabinet"] },
  corridor: { en: "Corridor", ja: "廊下", color: "#7b7f86", floor: "wood", size: [1.0, 3.6] },
  ldk:      { en: "LDK", ja: "LDK", color: "#b58b4c", floor: "wood", size: [4.55, 4.55], fx: ["kitchen"] },
  living:   { en: "Living", ja: "リビング", color: "#b58b4c", floor: "wood", size: [3.64, 3.64] },
  dining:   { en: "Dining", ja: "ダイニング", color: "#a9844e", floor: "wood", size: [2.73, 2.73] },
  kitchen:  { en: "Kitchen", ja: "キッチン", color: "#a07a45", floor: "tile", size: [2.73, 1.82], fx: ["kitchen"] },
  washitsu: { en: "Japanese room", ja: "和室", color: "#8f9a5a", floor: "carpet", size: [2.73, 3.64] },
  bedroom:  { en: "Bedroom", ja: "洋室", color: "#6f8fae", floor: "wood", size: [2.73, 3.64] },
  service:  { en: "Service room", ja: "サービスルーム", color: "#6f86a0", floor: "wood", size: [2.73, 3.64] },
  kids:     { en: "Kids' room", ja: "子供部屋", color: "#7d95b8", floor: "wood", size: [2.73, 3.64] },
  study:    { en: "Study", ja: "書斎", color: "#71809a", floor: "wood", size: [1.82, 2.73] },
  bath:     { en: "Bath", ja: "浴室", color: "#5fa0a8", floor: "tile", size: [1.62, 1.62], fx: ["tub"] },
  washroom: { en: "Washroom", ja: "洗面室", color: "#6aa9a0", floor: "tile", size: [1.82, 1.82], fx: ["vanity", "washer"] },
  toilet:   { en: "Toilet", ja: "トイレ", color: "#6fb0b8", floor: "tile", size: [0.91, 1.62], fx: ["toilet"] },
  closet:   { en: "Closet", ja: "クローゼット", color: "#5c5650", floor: "wood", size: [1.82, 0.65] },
  walkin:   { en: "Walk-in closet", ja: "WIC", color: "#5c5650", floor: "wood", size: [1.82, 1.82] },
  oshiire:  { en: "Oshiire", ja: "押入", color: "#5c5650", floor: "wood", size: [1.82, 0.85] },
  storage:  { en: "Storage", ja: "物入", color: "#544f49", floor: "wood", size: [0.91, 0.91] },
  stairs:   { en: "Stairs", ja: "階段", color: "#8d6f8f", floor: "wood", size: [0.91, 3.64] },
  balcony:  { en: "Balcony", ja: "バルコニー", color: "#6b6b6b", floor: "stone", size: [5.46, 1.5], h: 1.1, ceiling: false },
  engawa:   { en: "Engawa", ja: "縁側", color: "#a3895e", floor: "wood", size: [5.46, 0.91], open: ["s"] },
  common:   { en: "Common walkway", ja: "共用廊下", color: "#55595e", floor: "stone", size: [7.28, 1.4], open: ["n"] },
  garden:   { en: "Garden / porch", ja: "ポーチ", color: "#4f6a46", floor: "dirt", size: [3.64, 1.82], h: 2.4, ceiling: false, open: ["n", "e", "w"] },
  garage:   { en: "Garage", ja: "車庫", color: "#5b5b5b", floor: "stone", size: [2.73, 5.46] },
  other:    { en: "Room", ja: "部屋", color: "#777777", floor: "wood", size: [2.73, 2.73] },
  // a school (the user, 2026-11-01: "build out a japanese school for a horror game"; SCENE_BUILDER §10): a classroom is
  // 4 × 5 ken (7.2 × 9 m) under a 3 m ceiling, the corridor along its side 2.4 m wide
  classroom: { en: "Classroom", ja: "教室", color: "#7a8f6a", floor: "wood", size: [7.2, 9.0], h: 3.0 },
  hallway:   { en: "School corridor", ja: "廊下", color: "#8a8d84", floor: "tile", size: [2.4, 9.0], h: 3.0 },
  staffroom: { en: "Staff room", ja: "職員室", color: "#6f7f92", floor: "tile", size: [7.2, 9.0], h: 3.0 },
  entrance:  { en: "School entrance", ja: "昇降口", color: "#8c8270", floor: "stone", size: [7.2, 6.0], h: 3.0 },
  nurse:     { en: "Nurse's office", ja: "保健室", color: "#7f9aa3", floor: "tile", size: [7.2, 6.0], h: 3.0 },
  library:   { en: "Library", ja: "図書室", color: "#8a7a5c", floor: "wood", size: [7.2, 9.0], h: 3.0 },
  gym:       { en: "Gym", ja: "体育館", color: "#9a8a62", floor: "wood", size: [18.0, 28.0], h: 7.0 },
};

// built-ins, so a room reads at its real size from the player's eye: [w, d, h] boxes against a wall with no door
export const FIXTURES = {          // kit: the kit preset it's drawn with (docs/KIT.md), sized to fit
  shoe_cabinet: { size: [0.9, 0.38, 1.0], tag: "shoe_cabinet", kit: "shoe_cabinet" },
  kitchen:      { size: [2.55, 0.65, 0.85], tag: "kitchen_counter", kit: "kitchen_run" },
  tub:          { size: [1.4, 0.8, 0.55], tag: "bathtub" },
  vanity:       { size: [0.75, 0.55, 0.85], tag: "vanity", kit: "vanity_drawers" },
  washer:       { size: [0.64, 0.64, 0.95], tag: "washing_machine", kit: "washing_machine" },
  toilet:       { size: [0.4, 0.7, 0.8], tag: "toilet" },
};

// opening kinds: default width, height, sill
export const OPENINGS = {
  door:   { w: 0.8, h: 2.0, sill: 0 },
  slide:  { w: 1.6, h: 2.0, sill: 0 },
  arch:   { w: 0.9, h: 2.1, sill: 0 },
  window: { w: 1.6, h: 1.1, sill: 0.9 },
};

// A layout: rooms [id, kind, name, x0, y0, x1, y1, {z, h, ...}], doors [a, b, kind, {at: 0..1 along the shared
// stretch, w, h, swing, id}], windows and outside doors [room, wall, kind, {at, w, h, sill}], the player's start and
// a second person ([x, y, yaw]: yaw 90 faces north).
export const PRESETS = [
  {
    id: "1ldk", name: "1LDK mansion, about 52 m²",
    note: "A one-bedroom flat in a mid-rise block: the front door off an open-air walkway, a corridor past the wet rooms (washroom, bath, separate toilet), a bedroom with a walk-in closet, the LDK across the balcony side.",
    rooms: [
      ["common", "common", "Walkway", 0, 8.6, 6.0, 10.0],
      ["genkan", "genkan", "", 2.0, 7.6, 3.1, 8.6],
      ["shoe_room", "storage", "Shoe closet", 3.1, 7.6, 6.0, 8.6],
      ["corridor", "corridor", "", 2.0, 3.4, 3.1, 7.6],
      ["washroom", "washroom", "", 0, 6.6, 2.0, 8.6],
      ["bath", "bath", "", 0, 4.9, 2.0, 6.6],
      ["storage", "storage", "", 0, 3.4, 2.0, 4.9],
      ["toilet", "toilet", "", 3.1, 6.4, 4.1, 7.6],
      ["wic", "walkin", "", 4.1, 6.4, 6.0, 7.6],
      ["bedroom", "bedroom", "Western room", 3.1, 3.4, 6.0, 6.4],
      ["ldk", "ldk", "", 0, 0, 6.0, 3.4],
      ["balcony", "balcony", "", 0, -1.5, 6.0, 0],
    ],
    doors: [
      ["common", "genkan", "door", { id: "front_door", swing: "in" }],
      ["genkan", "corridor", "arch", { w: 0.9 }],
      ["genkan", "shoe_room", "door", { w: 0.7 }],
      ["corridor", "washroom", "door", { w: 0.7 }],
      ["washroom", "bath", "door", { w: 0.7, at: 0.6 }],
      ["corridor", "storage", "door", { w: 0.7 }],
      ["corridor", "toilet", "door", { w: 0.7 }],
      ["corridor", "bedroom", "door", { at: 0.3 }],
      ["bedroom", "wic", "door", { w: 0.7 }],
      ["corridor", "ldk", "door", {}],
      ["ldk", "balcony", "slide", { w: 2.6, at: 0.45 }],
    ],
    windows: [["bedroom", "e", "window", {}], ["ldk", "w", "window", { w: 1.2 }], ["ldk", "e", "window", { w: 1.2 }]],
    items: [["ldk", "n", "ac", 0.2], ["ldk", "n", "tv", 0.75], ["bedroom", "s", "ac", 0.5], ["bedroom", "w", "mirror", 0.75]],
    start: [2.55, 9.3, 270], her: [3.0, 1.6, 90],
  },
  {
    id: "3ldk", name: "3LDK mansion, about 77 m² (your reference)",
    note: "The plan you sent: entrance in the middle of the walkway side, a corridor down the spine, a Western room and a service room either side of the entrance, the wet rooms on one side, a Japanese room opening onto the LDK with fusuma, everything living along the balcony.",
    rooms: [
      ["common", "common", "Walkway", 0, 10.6, 7.28, 12.0],
      ["genkan", "genkan", "", 3.1, 9.0, 4.2, 10.6],
      ["corridor", "corridor", "", 3.1, 4.9, 4.2, 9.0],
      ["yoshitsu", "bedroom", "Western room", 0, 7.45, 3.1, 10.6],
      ["closet_w", "closet", "", 0, 6.8, 3.1, 7.45],
      ["washroom", "washroom", "", 0, 5.4, 3.1, 6.8],
      ["bath", "bath", "", 0, 3.8, 2.2, 5.4],
      ["monoire", "storage", "物入", 2.2, 3.8, 3.1, 5.4],
      ["oshiire", "oshiire", "", 0, 3.1, 3.1, 3.8],
      ["washitsu", "washitsu", "", 0, 0, 3.1, 3.1],
      ["service", "service", "Service room (納戸)", 4.2, 6.7, 7.28, 10.6],
      ["closet_e", "closet", "", 4.2, 6.1, 5.2, 6.7],
      ["toilet", "toilet", "", 4.2, 4.9, 5.2, 6.1],
      ["wic", "walkin", "", 5.2, 4.9, 7.28, 6.7],
      ["ldk", "ldk", "", 3.1, 0, 7.28, 4.9],
      ["balcony", "balcony", "", 0, -1.6, 7.28, 0],
    ],
    doors: [
      ["common", "genkan", "door", { id: "front_door", swing: "in" }],
      ["genkan", "corridor", "arch", { w: 1.0 }],
      ["corridor", "yoshitsu", "door", { at: 0.6 }],
      ["yoshitsu", "closet_w", "slide", { w: 2.4 }],
      ["corridor", "washroom", "door", { w: 0.7 }],
      ["washroom", "bath", "door", { w: 0.7, at: 0.6 }],
      ["ldk", "monoire", "slide", { w: 0.8 }],
      ["washitsu", "oshiire", "slide", { w: 2.4 }],
      ["washitsu", "ldk", "slide", { w: 1.8, swing: "slide" }],
      ["corridor", "service", "door", { at: 0.4 }],
      ["service", "closet_e", "slide", { w: 0.8 }],
      ["service", "wic", "door", { w: 0.7, at: 0.6 }],
      ["corridor", "toilet", "door", { w: 0.7 }],
      ["corridor", "ldk", "door", {}],
      ["ldk", "balcony", "slide", { w: 2.6, at: 0.5 }],
      ["washitsu", "balcony", "slide", { w: 1.8 }],
    ],
    windows: [["yoshitsu", "n", "window", { w: 1.2 }], ["service", "n", "window", { w: 1.2 }], ["ldk", "e", "window", { at: 0.4 }]],
    items: [["ldk", "n", "ac", 0.75], ["ldk", "w", "tv", 0.633], ["yoshitsu", "w", "ac", 0.5], ["service", "e", "clock", 0.5]],
    start: [3.65, 11.3, 270], her: [5.2, 2.0, 90],
  },
  {
    id: "house", name: "Two-storey house, 4LDK, about 140 m² (one house, many events)",
    note: "A detached house (kodate) on a 910 mm grid: downstairs an entrance hall, a Japanese room off the LDK, the wet rooms and a pantry; a living-room stair up to a landing (steep, as Japanese house stairs are), three bedrooms, a study, a second toilet and a balcony. Two floors, a stair, loops through the LDK and the hall: room for hide and seek, chases and a lot of scenes.",
    floors: [0, STOREY],
    rooms: [
      ["porch", "garden", "Porch", 0, 8.19, 3.64, 9.6],
      ["genkan", "genkan", "", 0, 6.37, 1.82, 8.19],
      ["shoe_closet", "storage", "Shoe closet", 0, 5.46, 1.82, 6.37],
      ["under_stair", "storage", "", 0, 3.64, 1.82, 5.46],
      ["hall", "corridor", "Hall", 1.82, 3.64, 3.64, 8.19],
      ["washitsu", "washitsu", "", 0, 0, 3.64, 3.64],
      ["ldk", "ldk", "", 3.64, 0, 9.1, 4.55],
      ["stairs", "stairs", "", 3.64, 4.55, 4.55, 8.19, { h: STOREY + 2.4, dir: "n" }],
      ["washroom", "washroom", "", 4.55, 4.55, 6.37, 6.37],
      ["bath", "bath", "", 4.55, 6.37, 6.37, 8.19],
      ["toilet", "toilet", "", 6.37, 4.55, 7.28, 6.37],
      ["pantry", "storage", "Pantry", 7.28, 4.55, 9.1, 8.19],
      ["closet_1f", "closet", "", 6.37, 6.37, 7.28, 8.19],
      ["engawa", "engawa", "", 0, -0.91, 3.64, 0, { ceiling: false, open: ["s", "w"] }],
      ["landing", "corridor", "Landing", 1.82, 4.55, 3.64, 8.19, { z: STOREY }],
      ["hall2", "corridor", "Upstairs hall", 1.82, 3.64, 6.37, 4.55, { z: STOREY }],
      ["kids1", "kids", "Bedroom 2", 0, 0, 3.64, 3.64, { z: STOREY }],
      ["kids2", "kids", "Bedroom 3", 3.64, 0, 6.37, 3.64, { z: STOREY }],
      ["master", "bedroom", "Main bedroom", 6.37, 0, 9.1, 5.46, { z: STOREY }],
      ["wic", "walkin", "", 6.37, 5.46, 9.1, 7.28, { z: STOREY }],
      ["study", "study", "", 0, 3.64, 1.82, 6.37, { z: STOREY }],
      ["closet_2f", "closet", "", 0, 6.37, 1.82, 8.19, { z: STOREY }],
      ["toilet2", "toilet", "", 4.55, 4.55, 5.46, 7.28, { z: STOREY }],
      ["storage2", "storage", "", 5.46, 4.55, 6.37, 7.28, { z: STOREY }],
      ["balcony", "balcony", "", 0, -1.2, 9.1, 0, { z: STOREY }],
    ],
    doors: [
      ["porch", "genkan", "door", { id: "front_door", swing: "in" }],
      ["genkan", "hall", "arch", { w: 1.2 }],
      ["genkan", "shoe_closet", "door", { w: 0.7 }],
      ["hall", "under_stair", "door", { w: 0.7 }],
      ["hall", "washitsu", "slide", { w: 1.6 }],
      ["hall", "ldk", "door", {}],
      ["washitsu", "ldk", "slide", { w: 2.4 }],
      ["washitsu", "engawa", "slide", { w: 2.4 }],
      ["ldk", "stairs", "arch", { w: 0.8 }],
      ["ldk", "washroom", "door", { w: 0.7 }],
      ["washroom", "bath", "door", { w: 0.7 }],
      ["ldk", "toilet", "door", { w: 0.7 }],
      ["ldk", "pantry", "door", { w: 0.7 }],
      ["pantry", "closet_1f", "door", { w: 0.7, at: 0.5 }],
      ["landing", "stairs", "arch", { w: 0.8, at: 0.88, z: STOREY }],
      ["landing", "hall2", "arch", { w: 1.0, z: STOREY }],
      ["landing", "study", "door", { z: STOREY }],
      ["landing", "closet_2f", "door", { w: 0.7, z: STOREY }],
      ["hall2", "kids1", "door", { z: STOREY }],
      ["hall2", "kids2", "door", { z: STOREY, at: 0.3 }],
      ["hall2", "master", "door", { z: STOREY }],
      ["master", "wic", "door", { w: 0.7, z: STOREY }],
      ["hall2", "toilet2", "door", { w: 0.7, z: STOREY }],
      ["hall2", "storage2", "door", { w: 0.7, z: STOREY }],
      ["master", "balcony", "slide", { w: 1.8, z: STOREY }],
      ["kids1", "balcony", "slide", { w: 1.6, z: STOREY }],
    ],
    windows: [["ldk", "e", "window", {}], ["ldk", "s", "slide", { w: 2.6, at: 0.6 }], ["kids2", "s", "window", {}],
              ["master", "e", "window", {}], ["study", "w", "window", { w: 0.9 }], ["washitsu", "w", "window", { w: 0.9 }]],
    items: [["ldk", "e", "ac", 0.2], ["master", "w", "ac", 0.3], ["master", "n", "mirror", 0.85], ["kids1", "w", "poster", 0.5], ["washitsu", "n", "calendar", 0.2]],
    start: [0.91, 9.1, 270], her: [6.4, 2.2, 90],
  },
  {
    id: "hiraya", name: "Single-storey house round an engawa, about 85 m² (your second reference)",
    note: "The traditional-modern hiraya you sent: a guest room (kyaku-ma) and a living room (i-ma) either side of an entrance passage, a kitchen and the main bedroom behind, a sunroom, engawa verandas front and back, the toilet and wet room in a corner. Sliding doors everywhere: lots of ways round.",
    rooms: [
      ["path", "garden", "Garden path", 4.55, -2.4, 5.46, -0.9, { open: ["s", "e", "w"] }],
      ["engawa_s", "engawa", "Front engawa", 1.0, -0.9, 9.0, 0, { ceiling: false, open: ["s"] }],
      ["entry", "genkan", "Entrance passage", 4.55, 0, 5.46, 3.0],
      ["kyakuma", "washitsu", "Kyaku-ma (guest room)", 1.0, 0, 4.55, 3.0],
      ["ima", "washitsu", "I-ma (living room)", 5.46, 0, 9.0, 3.0],
      ["wet", "washroom", "Wet room", 9.0, 0.6, 10.0, 2.2],
      ["toilet", "toilet", "", 9.0, 2.2, 10.0, 3.0],
      ["storage_w", "storage", "", 0, 0, 1.0, 5.5],
      ["engawa_m", "engawa", "Inner engawa", 4.55, 3.0, 10.6, 3.9, { open: [] }],
      ["kitchen", "kitchen", "", 1.0, 3.0, 4.55, 6.4],
      ["closet_k", "closet", "", 4.55, 3.9, 5.46, 6.4],
      ["master", "washitsu", "Main bedroom", 5.46, 3.9, 8.2, 6.4],
      ["veranda", "living", "Sunroom", 8.2, 3.9, 10.6, 6.4],
      ["engawa_n", "engawa", "Back engawa", 0, 6.4, 10.6, 7.3, { ceiling: false, open: ["n"] }],
    ],
    doors: [
      ["path", "engawa_s", "arch", { w: 0.7 }],
      ["engawa_s", "entry", "slide", { id: "front_door", w: 0.7 }],
      ["entry", "kyakuma", "slide", { w: 1.6 }],
      ["entry", "ima", "slide", { w: 1.6 }],
      ["entry", "engawa_m", "arch", { w: 0.7 }],
      ["kyakuma", "engawa_s", "slide", { w: 2.6 }],
      ["ima", "engawa_s", "slide", { w: 2.6 }],
      ["kyakuma", "kitchen", "slide", { w: 1.6 }],
      ["kyakuma", "storage_w", "slide", { w: 1.6 }],
      ["ima", "engawa_m", "slide", { w: 2.4 }],
      ["ima", "wet", "door", { w: 0.7 }],
      ["engawa_m", "toilet", "door", { w: 0.7 }],
      ["engawa_m", "master", "slide", { w: 1.6 }],
      ["engawa_m", "veranda", "slide", { w: 1.6 }],
      ["engawa_m", "closet_k", "slide", { w: 0.7 }],
      ["kitchen", "engawa_n", "door", { at: 0.3 }],
      ["master", "engawa_n", "slide", { w: 1.8 }],
      ["veranda", "engawa_n", "slide", { w: 1.6 }],
    ],
    windows: [["veranda", "e", "window", { w: 1.8 }], ["kitchen", "w", "window", { w: 1.2 }]],
    start: [5.0, -1.9, 90], her: [7.0, 1.4, 270],
  },
];

// ---- a school (SCENE_BUILDER §10; the user, 2026-11-01, after their Blender classroom) ----------------------------------
const rr = v => Math.round(v * 1000) / 1000;
function mulberry(seed) { let a = (seed >>> 0) ^ 0x9e3779b9; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// a classroom's things as a layout's kits ([room, preset, x, y, rot, {z, size, extra, ...}], room metres), its front (the
// chalkboard) on its north wall, its windows on the west (the students' left), its doors on the east onto the corridor:
// the chalkboard between its cork boards, the platform and the lectern on it, the teacher's desk by the windows, the
// clock and the speaker; rows of desks (cols × rows), each chair pushed in behind its desk a little askew; lockers and a
// back board on the back wall, the cleaning locker in its corner; the frame (columns between the windows, beams across
// under the ceiling, a beam along each long wall over the windows); curtains tied back; two blackboard lights
export function classroomKits(rid, o = {}) {
  const w = o.w ?? 7.2, d = o.d ?? 9.0, H = o.h ?? 3.0, T = 0.05, R = mulberry(o.seed ?? 7), j = a => (R() * 2 - 1) * a, k = [];
  const cols = o.cols ?? 6, rows = o.rows ?? 5, px = o.pitch_x ?? 1.0, py = o.pitch_y ?? 1.05, bays = o.bays ?? [3, 6];
  k.push([rid, "chalkboard", w / 2, d - T - 0.04, 0, { z: 0.95 }]);
  k.push([rid, "kyodan", w / 2, d - T - 0.45, 0]);
  k.push([rid, "lectern", w / 2, d - T - 0.55, 180, { z: 0.18 }]);
  k.push([rid, "teacher_desk", 0.8, d - T - 0.95, 180]);
  k.push([rid, "school_clock", rr(w / 2 + 1.75), d - T - 0.025, 0, { z: 2.25 }]);
  k.push([rid, "school_speaker", w / 2, d - T - 0.06, 0, { z: 2.3 }]);
  const x0 = w / 2 - (cols - 1) / 2 * px, yf = d - 2.45;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = x0 + c * px + j(0.02), y = yf - r * py + j(0.02);
    k.push([rid, "school_desk", rr(x), rr(y), Math.round(j(1))]);
    k.push([rid, "school_chair", rr(x + j(0.04)), rr(y - 0.48 - Math.abs(j(0.04))), 180 + Math.round(j(3))]);
  }
  const lw = 1.8, nl = Math.max(1, Math.floor((w - 1.6) / lw)), lx0 = w - 0.3 - nl * lw;
  for (let i = 0; i < nl; i++) k.push([rid, "school_lockers", rr(lx0 + lw * (i + 0.5)), T + 0.226, 180]);
  k.push([rid, "chalkboard_back", rr(lx0 + nl * lw / 2), T + 0.036, 180]);
  k.push([rid, "cleaning_locker", 0.92, T + 0.259, 180]);
  const bd = o.beam ?? 0.45, ch = rr(H - bd);                   // the columns stand under the beams along the walls
  for (const y of bays) { k.push([rid, "column_classroom", T + 0.101, y, 90, { size: [0.5, 0.2, ch] }]); k.push([rid, "column_classroom", rr(w - T - 0.101), y, 270, { size: [0.5, 0.2, ch] }]); }
  for (const y of [T + 0.126, rr(d - T - 0.126)]) for (const [x, rot] of [[T + 0.101, 90], [rr(w - T - 0.101), 270]]) k.push([rid, "column_classroom", x, y, rot, { size: [0.25, 0.2, ch] }]);
  for (const y of bays) k.push([rid, "beam_classroom", w / 2, y, 0, { z: rr(H - bd), size: [rr(w - 2 * T - 0.82), 0.3, bd] }]);   // across, between them
  for (const [x, rot] of [[T + 0.201, 90], [rr(w - T - 0.201), 270]]) k.push([rid, "beam_classroom", x, d / 2, rot, { z: rr(H - bd), size: [rr(d - 2 * T), 0.4, bd] }]);
  const cu = o.curtain || {};                                    // curtains at each window, sized to it when asked
  for (const y of o.windows ?? [1.5, 4.5, 7.5]) k.push([rid, "curtain_school", T + 0.201 + 0.081, y, 90, Object.assign({ z: cu.z ?? 0.8 }, cu.size ? { size: cu.size } : {})]);
  k.push([rid, "board_light", w / 2, rr(d - 1.05), 0, { z: rr(H - 0.12), size: [3.2, 0.2, 0.12], grid: [2, 1],
    extra: { use: "light", kind: "bulb", lit: true, kelvin: 5000, lumens: 1500 } }]);
  return k;
}
// the corridor's things along a stretch of its walls (room metres): a hydrant box, a notice board, a speaker
function hallwayKits(rid, w, d) {
  const T = 0.05;
  return [[rid, "hydrant_box", T + 0.081, 1.4, 90], [rid, "corkboard", T + 0.011, rr(d - 1.6), 90, { z: 1.1 }],
          [rid, "school_speaker", rr(w / 2), rr(d - T - 0.06), 0, { z: 2.4 }], [rid, "umbrella_stand", rr(w - T - 0.126), rr(d - 1.0), 270]];
}
const CLASSROOM_LOOK = { walls: "#ece6d3", ceiling: "#f3f1ea" };
export const SCHOOL_PRESETS = [
  {
    id: "school_classroom", name: "School: a classroom and its corridor (your Blender classroom, 1:1)",
    note: "The user's Blender classroom: 7.2 × 9 m under a 3 m ceiling, three window bays on the west with curtains tied back, the chalkboard between two cork boards on the north wall over the platform and the lectern, 30 desks in six rows of five, lockers along the back, frosted windows and two sliding doors onto a 2.4 m corridor, wainscot all round, beams across the rock wool ceiling, fluorescent troughs, a basket-weave parquet.",
    rooms: [
      ["classroom", "classroom", "Classroom 2-1", 0, 0, 7.2, 9.0, { light: "bright", extra: { look: CLASSROOM_LOOK } }],
      ["hallway", "hallway", "Corridor", 7.2, -3.0, 9.6, 12.0, { extra: { look: CLASSROOM_LOOK } }],
    ],
    doors: [
      ["hallway", "classroom", "slide", { id: "classroom_front_door", at: 8.175 / 9, w: 0.95, h: 2.0, extra: { kit: { preset: "door_school" } } }],
      ["hallway", "classroom", "slide", { id: "classroom_back_door", at: 1.2 / 9, w: 0.95, h: 2.0, extra: { kit: { preset: "door_school" } } }],
    ],
    windows: [
      ...[1.5, 4.5, 7.5].map(y => ["classroom", "w", "window", { at: y / 9, w: 2.3, h: 1.6, sill: 0.95, frame: { preset: "window_classroom" } }]),
      ["classroom", "e", "window", { at: 2.24 / 9, w: 0.9, h: 1.55, sill: 1.0, frame: { preset: "window_corridor" } }],
      ["classroom", "e", "window", { at: 4.5 / 9, w: 2.3, h: 1.55, sill: 1.0, frame: { preset: "window_corridor" } }],
      ["classroom", "e", "window", { at: 6.95 / 9, w: 1.2, h: 1.55, sill: 1.0, frame: { preset: "window_corridor" } }],
      ...[-1.5, 1.5, 4.5, 7.5, 10.5].map(y => ["hallway", "e", "window", { at: (y + 3) / 15, w: 2.3, h: 1.65, sill: 0.9, frame: { preset: "window_classroom" } }]),
      ["hallway", "n", "window", { at: 0.5, w: 1.4, h: 1.5, sill: 0.9, frame: { preset: "window_wired" } }],
      ["hallway", "s", "window", { at: 0.5, w: 1.4, h: 1.5, sill: 0.9, frame: { preset: "window_wired" } }],
    ],
    kits: [...classroomKits("classroom"), ...hallwayKits("hallway", 2.4, 15)],
    finish: { wainscot: 0.95, skirting: 0.08, casing: 0.05 },
    start: [5.6, 1.1, 180], her: [3.6, 7.75, 270],          // the back aisle, behind the last row, looking along it
  },
];
PRESETS.push(...SCHOOL_PRESETS);
// (the school buildings are pushed after schoolBuilding, at the end)

// ---- a school building (SCENE_BUILDER §10b; the user, 2026-11-01: "the school building needs to be to scale, so the
// actual rooms could fit in, stairs, door way etc", and two photos: "build a kit that could build these 1:1"). Columns
// of modules side by side along x, each a storey's room at its real size on every storey: classrooms (the 1:1
// classroom turned a quarter: its windows on the front, y = 0, the chalkboard at its west end, its two doors on the
// corridor behind it), toilets, an entrance (its glass doors onto a porch), a staff room, a library...; the corridor
// along their back on every storey (its own windows behind, wired glass at its ends); stair shafts (`flights: 2`, a
// dog-leg each storey, builder-model.js) from the ground through every floor (to a penthouse over the roof, `penthouse`
// its height; 0: none, the roof over them), a door onto
// the corridor on each floor, their front a stair tower's (round windows at the half landings, or a strip of glass).
// A column is [kind, {w, out (a stair tower standing out of the front), win, "<storey>": another kind there}].
export const SCHOOL_MODULES = {
  class:    { en: "Classroom", ja: "教室", kind: "classroom", w: 9.0 },
  stair:    { en: "Stairs, a dog-leg in a shaft to the roof", ja: "階段", kind: "stairs", w: 4.2 },
  wc:       { en: "Toilets", ja: "便所", kind: "toilet", w: 4.5 },
  entrance: { en: "Entrance, shoe lockers", ja: "昇降口", kind: "entrance", w: 9.0 },
  staff:    { en: "Staff room", ja: "職員室", kind: "staffroom", w: 13.5 },
  nurse:    { en: "Nurse's office", ja: "保健室", kind: "nurse", w: 9.0 },
  library:  { en: "Library", ja: "図書室", kind: "library", w: 13.5 },
  prep:     { en: "Prep room", ja: "準備室", kind: "storage", w: 4.5 },
  room:     { en: "A room", ja: "部屋", kind: "other", w: 9.0 },
};
// the windows a module has on the front, by its kind: n of them w wide, `gap` between (a column stands in a wide one),
// their sill and height, the frame (a kit preset); a stair's at each half landing (`round`: a porthole)
export const SCHOOL_WINDOWS = {
  class: { n: 3, w: 2.3, h: 1.6, sill: 0.95, gap: 0.7, frame: "window_classroom" },
  wc: { n: 2, w: 1.2, h: 0.9, sill: 1.5, gap: 1.0, frame: "window_corridor" },
  stair: { w: 1.0, h: 1.8, sill: 0.3, round: false, frame: "window_wired" },
  back: { w: 2.3, h: 1.65, sill: 0.9, frame: "window_classroom" },          // the corridor's, on the back
};
const turnKits = (list, rid, len) => list.map(([, preset, x, y, rot, o = {}]) => [rid, preset, rr(len - y), rr(x), (rot + 90) % 360, o]);
function staffKits(rid, w, d) {                                  // the staff room: an island of desks facing in pairs
  const k = [], n = Math.max(1, Math.floor((w - 3.0) / 1.45)), x0 = w / 2 - (n - 1) * 1.45 / 2;
  for (let i = 0; i < n; i++) for (const [y, rot] of [[d / 2 - 0.36, 0], [d / 2 + 0.36, 180]]) k.push([rid, "staff_desk", rr(x0 + i * 1.45), rr(y), rot]);
  for (let i = 0; i < Math.min(4, Math.floor((d - 2) / 0.95)); i++) k.push([rid, "staff_lockers", rr(w - 0.05 - 0.26), rr(1.2 + i * 0.95), 270]);
  return k;
}
function entranceKits(rid, w, d) {                               // the entrance: shoe lockers back to back in rows
  const k = [], rows = Math.max(1, Math.floor((w - 2.4) / 2.2)), x0 = w / 2 - (rows - 1) * 2.2 / 2, n = Math.max(1, Math.floor((d - 3.2) / 1.5));
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) for (const [dx, rot] of [[-0.19, 90], [0.19, 270]])
    k.push([rid, "shoe_lockers", rr(x0 + r * 2.2 + dx), rr(2.0 + 0.75 + i * 1.5), rot]);
  return k;
}
// the two buildings in the user's photos (2026-11-01), as the kit builds them: their rooms; their outside is the set's
// `outside` (the street builder's facade: eaves over the windows, pilasters, the rails, the name on the roof)
export const SCHOOL_BUILDINGS = {
  // the white one: four storeys of ribbon windows behind guard rails under thin eaves, its stair tower standing out at the
  // east end with round windows at the half landings, the school's name in blue on panels along the roof
  white: {
    id: "school_white", name: "School building: four storeys, ribbon windows, a stair tower with round windows (your first photo)",
    note: "A Tokyo-style high school building: 4 storeys at 3.9 m, classrooms 8 × 7.2 m on the front (8 m bays, measured off the photo: a bay is 2.05 storeys wide; ribbons of four sashes behind guard rails), a 2.4 m corridor behind them, toilets, a dog-leg stair at the west end and a stair tower standing 1.2 m out of the front at the east end, its round windows at the half landings, a penthouse on the roof; the entrance, the staff room and the nurse's office on the ground floor.",
    storeys: 4, storey: 3.9, ceiling: 3.0, depth: 7.2, corridor: 2.4,
    columns: [["stair"], ["wc"], ["class", { 1: "staff", w: 8.0 }], ["class", { 1: "entrance", w: 8.0 }], ["class", { 1: "nurse", w: 8.0 }], ["class", { w: 8.0 }],
              ["stair", { w: 5.4, out: 1.2, win: { round: true, w: 1.6, sill: 0.45, at: 0.62, frame: "window_porthole", bar: "window_porthole_bar" } }]],
    win: { class: { n: 4, w: 1.75, h: 2.2, sill: 0.6, gap: 0.1, frame: "window_ribbon" }, staff: { n: 4, w: 1.75, h: 2.2, sill: 0.6, gap: 0.1, frame: "window_ribbon" },
           nurse: { n: 4, w: 1.75, h: 2.2, sill: 0.6, gap: 0.1, frame: "window_ribbon" } }, penthouse: 2.2,
    // its outside (the street's, STREET_BUILDER §5f): white walls, thin eaves over every row of windows, pilasters where the
    // rooms meet, guard rails at the low sills, a parapet with a railing behind it, the name in blue on white panels along
    // the roof over the two east classrooms, a clock between the third and fourth floors, fans in the transoms, pipes.
    // Parts on the main front stand 1.2 m `in` (the tower stands out of it); x from the front's middle (x 23.05)
    outside: {
      look: { wall: "#eceae4", trim: "#f3f2ed", roof_flat: "#9c9991", plinth: "#9a968e", rail: "#c5c9cc", alu: "#c9cdd1", ring: "#8ccbe0", glass: "#4f5f71", curtain: "#ddd1ad" },
      roof: { kind: "flat", parapet: 0.75, rail: true, pent_parapet: 0.15 }, raise: 0.45,
      facade: { eaves: { out: 0.7, t: 0.14, over: 0.05, ends: 0.35, join: 2.0 }, pilasters: { w: 0.8, out: 0.1, gap: 1.2 }, rails: { h: 1.1, out: 0.14 } },
      parts: [
        { kind: "roofsign", x: 9.65, w: 16.5, h: 1.2, z: -1.3, text: "都立夜咲◎高等学校", fg: "#1d4f9c", bg: "#f5f5f1", in: 1.2, back: -0.03 },
        { kind: "clock", x: 1.65, z: 11.55, w: 0.9, h: 0.9, out: 0.24, in: 1.2 },
        ...[9.5, 9.8, -14.05, 17.35].map(x => ({ kind: "pipe", x, w: 0.1, h: 16.6, out: 0.2, in: 1.2 })),
        ...[-14.35, -6.35, 1.65, 9.65].flatMap(b => [2.0, 2.7, 5.95, 6.45].map(dx => ({ kind: "ac", x: Math.round((b + dx) * 100) / 100, z: 2.15, w: 0.4, h: 0.4, out: 0.14, floors: [2, 4], in: 1.2 }))),
      ],
    },
  },
  // the Showa one: three storeys of steel windows, two to a classroom between the columns, a narrow stair between the
  // two blocks with a strip of glass at each half landing
  showa: {
    id: "school_showa", name: "School building: three storeys, steel windows, a stair between two blocks (your second photo)",
    note: "A Showa-era school building: 3 storeys at 3.6 m, classrooms 9 × 7.2 m with two steel windows each between the columns, a 2.4 m corridor behind, a dog-leg stair standing a little out of the front between the two blocks with a tall window at each half landing, another at the east end; the entrance and the staff room on the ground floor.",
    storeys: 3, storey: 3.6, ceiling: 3.0, depth: 7.2, corridor: 2.4, penthouse: 0,
    columns: [["class", { 1: "entrance" }], ["class", { 1: "staff", w: 9.0 }], ["class"], ["class"],
              ["stair", { w: 3.6, out: 0.6, win: { w: 0.9, h: 2.2, sill: 0.25, frame: "window_wired" } }], ["class"], ["class"], ["wc"], ["stair"]],
    win: { class: { n: 2, w: 3.9, h: 1.95, sill: 0.8, gap: 0.6, frame: "window_steel" }, staff: { n: 2, w: 3.9, h: 1.95, sill: 0.8, gap: 0.6, frame: "window_steel" } },
    // its outside: beige render, a thin eave over each window, pilasters between them, the floors' edges, a low parapet;
    // a lean-to of corrugated sheet along the ground floor's west end
    outside: {
      look: { wall: "#c9bda4", trim: "#d3c9b3", roof_flat: "#8e8a82", plinth: "#7d776c", steel_sash: "#4b504c", glass: "#2b333a", tiles: "#4a4d50" },
      roof: { kind: "flat", parapet: 0.6 }, raise: 0.3,
      facade: { eaves: { out: 0.4, t: 0.1, over: 0.08, ends: 0.15, join: 0.4 }, pilasters: { w: 0.5, out: 0.12, gap: 0.5 }, bands: { h: 0.18, out: 0.05 } },
      parts: [
        { kind: "eave", x: -23.4, z: 3.05, w: 17.0, h: 0.6, out: 2.6, slot: "tiles", in: 0.6 },
        { kind: "pipe", x: -1.95, w: 0.1, h: 11.2, out: 0.2 }, { kind: "pipe", x: 1.95, w: 0.1, h: 11.2, out: 0.2 },
      ],
    },
  },
};
export function schoolBuilding(spec) {
  const S = Object.assign({ storey: 3.6, ceiling: 3.0, depth: 7.2, corridor: 2.4, storeys: 3, penthouse: 2.7, furnish: true }, spec);
  const win = Object.assign({}, SCHOOL_WINDOWS, S.win || {}), N = S.storeys, D = S.depth, C = S.corridor, H = S.ceiling;
  const zs = Array.from({ length: N }, (_, f) => rr(f * S.storey));
  const cols = S.columns.map(c => { const [kind, o = {}] = Array.isArray(c) ? c : [c]; return { kind, o, w: o.w ?? SCHOOL_MODULES[kind].w }; });
  let x = 0; for (const c of cols) { c.x0 = rr(x); x += c.w; }
  const L = rr(x), rooms = [], doors = [], windows = [], kits = [], count = {};
  const look = { extra: { look: CLASSROOM_LOOK } }, nid = (k, f) => { const key = `${k}_${f}`; count[key] = (count[key] || 0) + 1; return [`${k}_${f}_${count[key]}`, count[key]]; };
  // the stair shafts: one room from the ground to the penthouse, a door on the corridor on every floor
  const shafts = [];
  cols.filter(c => c.kind === "stair").forEach((c, i) => {
    const id = `stairs_${i + 1}`, out = c.o.out || 0, h = rr(S.penthouse > 0 ? zs[N - 1] + S.storey + S.penthouse : zs[N - 1] + H);   // to a penthouse, or under the roof
    rooms.push([id, "stairs", `Stairs ${i + 1}`, c.x0, rr(-out), rr(c.x0 + c.w), D, { h, dir: "s", flights: 2, light: "dim", extra: { look: CLASSROOM_LOOK } }]);
    shafts.push({ c, id, out });
    for (let f = 0; f <= N; f++) if (f < N || S.penthouse > 0) kits.push([id, "tube_batten", rr(c.w / 2), rr(D + out - 0.05 - 0.036), 0, { z: rr(Math.min(zs[0] + f * S.storey + 2.55, h - 0.3)),
      extra: { use: "light", kind: "bulb", lit: true, kelvin: 4500, lumens: 900 } }]);
    const sw = Object.assign({}, win.stair, c.o.win || {});
    for (let f = 0; f < (S.penthouse > 0 ? N : N - 1); f++) {     // its windows: at each half landing (the far end, the front)
      const sill = rr(zs[f] + S.storey / 2 + sw.sill), w2 = sw.round ? sw.w : sw.w, h2 = sw.round ? sw.w : sw.h;
      windows.push([id, "s", "window", { at: sw.at ?? 0.5, w: w2, h: h2, sill, frame: { preset: sw.round ? (f % 2 && sw.bar ? sw.bar : sw.frame) : sw.frame } }]);
    }
  });
  for (let f = 0; f < N; f++) {
    const z = zs[f], cid = `corridor_${f + 1}`;
    rooms.push([cid, "hallway", `Corridor ${f + 1}F`, 0, D, L, rr(D + C), Object.assign({ z, h: H }, look)]);
    for (const c of cols) {                                    // the corridor's own windows behind each column
      const n = Math.max(1, Math.round(c.w / 3.0));
      for (let i = 0; i < n; i++) windows.push([cid, "n", "window", { at: rr((c.x0 + c.w * (i + 0.5) / n) / L), w: Math.min(win.back.w, c.w / n - 0.6), h: win.back.h, sill: win.back.sill, frame: { preset: win.back.frame } }]);
    }
    for (const wl of ["w", "e"]) windows.push([cid, wl, "window", { at: 0.5, w: Math.min(1.4, C - 0.6), h: 1.5, sill: 0.9, frame: { preset: "window_wired" } }]);
    for (const sh of shafts) doors.push([cid, sh.id, "arch", { z, w: rr(Math.min(2.4, sh.c.w - 0.6)) }]);
    for (const c of cols) {
      if (c.kind === "stair") continue;
      const kind = c.o[f + 1] || c.kind, M = SCHOOL_MODULES[kind], [rid, n] = nid(kind === "class" ? "class" : kind, f + 1);
      const name = kind === "class" ? `Classroom ${f + 1}-${n}` : `${M.en.split(",")[0]} ${f + 1}F${n > 1 ? " " + n : ""}`;
      const fwin = Object.assign({}, win[kind] || win.class, (c.o.win || {})[kind] || {});
      rooms.push([rid, M.kind, name, c.x0, 0, rr(c.x0 + c.w), D, Object.assign({ z, h: H, light: kind === "class" ? "bright" : "dim", fixtures: kind !== "wc" }, look)]);
      // the front's windows, n of them centred with their gaps (the entrance's are doors)
      const n2 = kind === "entrance" ? 0 : Math.max(1, Math.min(fwin.n || 1, Math.floor((c.w - 0.4 + fwin.gap) / (fwin.w + fwin.gap)))), span = n2 * fwin.w + (n2 - 1) * fwin.gap;
      const centres = Array.from({ length: n2 }, (_, i) => c.w / 2 - span / 2 + fwin.w / 2 + i * (fwin.w + fwin.gap));
      for (const xc of centres) windows.push([rid, "s", "window", { at: rr(xc / c.w), w: fwin.w, h: fwin.h, sill: fwin.sill, frame: { preset: fwin.frame } }]);
      // onto the corridor: a classroom's two sliding doors (its front one by the chalkboard) and its frosted windows,
      // any other room's door
      if (kind === "class" || kind === "library" || kind === "staff") {
        for (const [dx, k] of [[0.825, "front"], [c.w - 1.2, "back"]]) doors.push([cid, rid, "slide", { id: `${rid}_${k}_door`, at: rr(dx / c.w), w: 0.95, h: 2.0, extra: { kit: { preset: "door_school" } } }]);
        if (kind === "class") {                                       // its frosted windows onto the corridor, between its doors
          const a = 1.3 + 0.35, b = c.w - 1.2 - 0.475 - 0.35, nw = c.w >= 8.5 ? 3 : 2, ww = rr(Math.min(2.0, (b - a - (nw - 1) * 0.6) / nw));
          if (ww > 0.6) for (let i = 0; i < nw; i++) windows.push([rid, "n", "window", { at: rr((a + ww / 2 + i * (ww + (b - a - nw * ww) / Math.max(1, nw - 1))) / c.w), w: ww, h: 1.55, sill: 1.0, frame: { preset: "window_corridor" } }]);
        }
      } else if (kind === "entrance") doors.push([cid, rid, "arch", { w: rr(Math.min(3.6, c.w - 1.2)) }]);
      else doors.push([cid, rid, kind === "wc" ? "door" : "slide", { id: `${rid}_door`, w: 0.95, h: 2.0, extra: kind === "wc" ? {} : { kit: { preset: "door_school" } } }]);
      if (kind === "entrance") {                                // its glass doors onto a porch out front
        rooms.push(["porch", "garden", "Porch", rr(c.x0 + 1.2), -2.4, rr(c.x0 + c.w - 1.2), 0, { open: ["s", "e", "w"] }]);
        const nd = Math.max(1, Math.floor((c.w - 3.0) / 2.0));
        for (let i = 0; i < nd; i++) doors.push(["porch", rid, "slide", { id: i ? `front_door_${i + 1}` : "front_door", at: rr((i + 0.5) / nd), w: 1.6, h: 2.2, extra: { kit: { preset: "door_glass" } } }]);
      }
      if (!S.furnish) continue;
      if (kind === "class") {                                  // the classroom: the 1:1 one's things, turned
        const local = centres.map(xc => rr(c.w - xc)), gaps = centres.slice(1).map((xc, i) => rr(c.w - (xc + centres[i]) / 2)).filter(() => fwin.gap >= 0.45);
        const head = fwin.sill + fwin.h, beam = rr(Math.max(0.12, Math.min(0.45, H - head - 0.02))), cz = rr(Math.max(0.78, fwin.sill - 0.1)), ctop = Math.min(head + 0.08, H - beam - 0.02);
        kits.push(...turnKits(classroomKits(rid, { w: D, d: c.w, h: H, seed: 7 + f * 13 + n, bays: gaps, windows: local, beam, pitch_x: 0.98,
          curtain: { size: [rr(Math.min(fwin.w + 0.2, fwin.w + fwin.gap - 0.04)), 0.16, rr(ctop - cz)], z: cz } }), rid, c.w));
      } else if (kind === "staff") kits.push(...staffKits(rid, c.w, D));
      else if (kind === "entrance") kits.push(...entranceKits(rid, c.w, D));
    }
    // the corridor's things: a speaker over each classroom's front door, notice boards opposite, a hydrant box a 20 m
    if (S.furnish) {
      for (const c of cols) if ((c.o[f + 1] || c.kind) === "class") { kits.push([cid, "school_speaker", rr(c.x0 + 0.825), rr(0.05 + 0.06), 180, { z: 2.4 }]); kits.push([cid, "corkboard", rr(c.x0 + c.w / 2), rr(C - 0.05 - 0.011), 0, { z: 1.1 }]); }
      for (const c of cols) if ((c.o[f + 1] || c.kind) === "wc") kits.push([cid, "hydrant_box", rr(c.x0 + 0.9), rr(0.05 + 0.081), 180]);
    }
  }
  const ent = rooms.find(r => r[1] === "entrance"), first = rooms.find(r => r[1] === "classroom");
  const start = ent ? [rr(ent[3] + 1.0), 1.0, 90] : [1.0, rr(D + C / 2), 0];
  const her = first ? [rr(first[3] + 1.2), rr(D / 2), 0] : [rr(L / 2), rr(D / 2), 270];
  return { id: S.id, name: S.name, note: S.note, floors: zs, rooms: rooms.map(r => { r[7] = Object.assign({}, r[7]); return r; }),
           doors, windows, kits, finish: Object.assign({ wainscot: 0.95, skirting: 0.08, casing: 0.05 }, S.finish || {}),
           start, her, herZ: first ? (first[7] || {}).z || 0 : 0, outside: S.outside, school: { storey: S.storey, columns: S.columns } };
}

// Things stuck to a wall, real sizes: [w, h, t (out from the wall)] and the height of their middle above the floor.
// They are ordinary props (`<room>_wi_<kind>_<n>`, a box with its `tag`): the art pass gives each its mesh or texture.
export const WALL_ITEMS = {          // size: [width, height, off the wall]; z: its middle; kit: drawn with that preset
  poster:   { en: "Poster (B2)", size: [0.545, 0.758, 0.012], z: 1.5, tag: "poster", kit: "poster_b2" },
  frame:    { en: "Picture frame", size: [0.45, 0.35, 0.025], z: 1.5, tag: "frame", kit: "picture_frame" },
  mirror:   { en: "Mirror", size: [0.45, 1.2, 0.02], z: 1.25, tag: "mirror", kit: "mirror" },
  tv:       { en: "TV, 55\" on the wall", size: [1.23, 0.71, 0.06], z: 1.15, tag: "tv", kit: "tv_55" },
  ac:       { en: "Air conditioner (エアコン)", size: [0.8, 0.25, 0.29], z: 2.05, tag: "air_conditioner", kit: "air_conditioner" },
  clock:    { en: "Wall clock", size: [0.3, 0.3, 0.05], z: 1.9, tag: "clock", kit: "wall_clock" },
  calendar: { en: "Calendar", size: [0.3, 0.45, 0.004], z: 1.55, tag: "calendar", kit: "calendar" },
  board:    { en: "Whiteboard / corkboard", size: [0.9, 0.6, 0.02], z: 1.4, tag: "board", kit: "whiteboard" },
  shelf:    { en: "Wall shelf", size: [0.8, 0.03, 0.22], z: 1.6, tag: "shelf", kit: "wall_shelf" },
  switch:   { en: "Light switch", size: [0.07, 0.12, 0.012], z: 1.2, tag: "light_switch", kit: "switch_jp_1" },
};
// a room's floor by its kind (the layouts and new rooms start with these; "Floors by room kind" fills the rest)
export const FLOOR_BY_KIND = { ldk: "oak_planks", living: "oak_planks", dining: "oak_planks", kitchen: "oak_planks", bedroom: "oak_planks",
  kids: "oak_planks", study: "oak_planks", service: "oak_planks", corridor: "oak_planks", closet: "oak_planks", walkin: "oak_planks", stairs: null,
  washitsu: "tatami", bath: "tile_300", washroom: "tile_300", toilet: "tile_300", genkan: "stone_450", balcony: "deck_boards", engawa: "wide_planks",
  classroom: "parquet_basket", hallway: "vinyl_tiles", staffroom: "vinyl_tiles", entrance: "tile_300", nurse: "vinyl_tiles", library: "parquet_basket", gym: "oak_planks" };
// a room's ceiling by its kind (the school's rock wool boards; the others keep theirs)
export const CEILING_BY_KIND = { classroom: "ceiling_rockwool", hallway: "ceiling_rockwool", staffroom: "ceiling_tbar_600", entrance: "ceiling_rockwool",
  nurse: "ceiling_tbar_600", library: "ceiling_rockwool" };

// a ceiling light's colour temperature by room: warm where people live, cooler where they wash and cook
export const LIGHT_K = { ldk: 3000, living: 2700, dining: 2700, kitchen: 4000, washitsu: 2700, bedroom: 2700, kids: 3000, study: 3500,
  bath: 4000, washroom: 4000, toilet: 3000, genkan: 3000, corridor: 3000, stairs: 3000, service: 3500,
  classroom: 5000, hallway: 4500, staffroom: 5000, entrance: 4500, nurse: 5000, library: 4500, gym: 5000 };

// the finish a new plan starts with: skirting 6 cm, door casings 6 cm, no cornice (Japanese rooms often have a thin
// mawaribuchi: try 3 cm), a 12 mm threshold where the floor changes, a ceiling light in each room with its switch by
// the door
export const FINISH = { skirting: 0.06, cornice: 0, casing: 0.06, threshold: 0.012, lights: true, switches: true, light_fitting: "auto", wainscot: 0 };
// the ceiling light every room gets is a fitting (the user, 2026-10-31: "lights as furniture, rounded LEDs: a circular rim
// with a glass circle, and those kinds of variations"): "auto" picks by the room's floor area, else one preset for all
export const LIGHT_FITTINGS = [["auto", "by the room's size"], ["downlight_100", "downlight 100"], ["downlight_150", "downlight 150"],
  ["led_flush_300", "round LED, flush 300"], ["led_flush_450", "round LED, flush 450"], ["led_dome_500", "round LED, dome 500"], ["led_ring_600", "round LED, ring 600"],
  ["tube_trough", "fluorescent troughs, two tubes (a grid)"], ["tube_trough_1", "fluorescent troughs, one tube (a grid)"], ["tube_louvre", "fluorescent behind louvres (a grid)"]];
// a school's rooms take fluorescent troughs by their kind, a grid of them filling the room (builder-model.js ceilingFitting)
export const FITTING_BY_KIND = { classroom: "tube_trough", hallway: "tube_trough_1", staffroom: "tube_trough", entrance: "tube_trough_1",
  nurse: "tube_trough", library: "tube_trough", gym: "tube_louvre" };
export function autoFitting(area, kind) { return FITTING_BY_KIND[kind] || (area < 3.5 ? "downlight_100" : area < 13 ? "led_flush_300" : "led_dome_500"); }
export const WINDOW_FRAME = "window_slide";     // the frame a new window gets

// texture sets a room can be given (its `look`): the few the studio already uses, plus whatever has been fetched
// into the library (python tools/cc0.py textures <word>, then get): the builder lists both
export const KNOWN_LOOKS = ["ambientcg/WoodFloor041", "ambientcg/Planks012", "ambientcg/Wood049", "ambientcg/Plaster003", "ambientcg/Rust004"];

// the school buildings as layouts (the kit's, SCENE_BUILDER §10b)
PRESETS.push(...Object.values(SCHOOL_BUILDINGS).map(schoolBuilding));

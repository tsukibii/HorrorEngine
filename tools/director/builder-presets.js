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
  washitsu: "tatami", bath: "tile_300", washroom: "tile_300", toilet: "tile_300", genkan: "stone_450", balcony: "deck_boards", engawa: "wide_planks" };

// a ceiling light's colour temperature by room: warm where people live, cooler where they wash and cook
export const LIGHT_K = { ldk: 3000, living: 2700, dining: 2700, kitchen: 4000, washitsu: 2700, bedroom: 2700, kids: 3000, study: 3500,
  bath: 4000, washroom: 4000, toilet: 3000, genkan: 3000, corridor: 3000, stairs: 3000, service: 3500 };

// the finish a new plan starts with: skirting 6 cm, door casings 6 cm, no cornice (Japanese rooms often have a thin
// mawaribuchi: try 3 cm), a 12 mm threshold where the floor changes, a ceiling light in each room with its switch by
// the door
export const FINISH = { skirting: 0.06, cornice: 0, casing: 0.06, threshold: 0.012, lights: true, switches: true };
export const WINDOW_FRAME = "window_slide";     // the frame a new window gets

// texture sets a room can be given (its `look`): the few the studio already uses, plus whatever has been fetched
// into the library (python tools/cc0.py textures <word>, then get): the builder lists both
export const KNOWN_LOOKS = ["ambientcg/WoodFloor041", "ambientcg/Planks012", "ambientcg/Wood049", "ambientcg/Plaster003", "ambientcg/Rust004"];

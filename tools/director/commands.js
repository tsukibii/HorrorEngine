// The desk's commands, as data: every action a beat can `do` and every trigger it can wait for (STORY_FORMAT §4), each
// with a label, an icon, a group, the fields its form asks for and the sentence it reads as, so a task's beats read
// like RPG Maker's event lists and nobody types JSON. A field's `kind` names what the desk lists for it (a line, a
// door, a spot, a flag...: the editor's `refs`); `verb: true` puts the value under the verb itself
// ({"door": "front_door", "set": "lock"}). No DOM here: the editor (ui.js) and the check (cmdtest.mjs) share it.

export const GROUPS = [
  { id: "story", label: "Story", color: "#9b7be0" },
  { id: "state", label: "Flags and items", color: "#d9a441" },
  { id: "world", label: "The house", color: "#3fb3a2" },
  { id: "people", label: "People", color: "#e07aa8" },
  { id: "time", label: "Camera and time", color: "#6fb3d9" },
  { id: "flow", label: "Flow", color: "#a8a59c" },
];
export const MUSIC = ["silence", "calm", "uneasy", "dread", "chase"];
export const LIGHT_SET = ["on", "off", "flicker", "dim", "normal"];   // normal: its own brightness and flicker back, on or off as it is
export const FLICKER_MODES = ["fluorescent", "dying", "candle", "pulse", "custom"];   // a light's flicker modes (tools/shared/flicker.js)
// what someone does in the flashlight's beam (FLASHLIGHT_PLAN §2b): the cast's `beam`, the `beam` action
export const BEAM_DOES = ["nothing", "backs_off", "freezes", "flees", "vanishes", "covers", "comes", "charges"];
export const BEAM_LABELS = { nothing: "nothing (only heard)", backs_off: "backs off", freezes: "freezes", flees: "flees to a spot", vanishes: "vanishes", covers: "covers her eyes", comes: "comes toward it", charges: "charges" };
export const NEAR_SET = ["none", "flicker", "dim", "die"];
export const TORCH_SET = ["on", "off", "flicker", "dead", "works", "dim", "drain"];   // the flashlight: dead flickers it out (F only clicks), works is new batteries, drain sets its charge
export const DOOR_SET = ["lock", "unlock", "open", "close", "slam"];
export const BEHAVE_AS = ["idle", "sit", "path", "patrol", "go", "off"];
// tricks (TRICKS.md §2): each one's own fields
export const TRICKS = {
  knock: [{ key: "at", label: "on", kind: "thing" }, { key: "count", label: "times", kind: "number", ph: "3" }],
  whisper: [{ key: "line", label: "line", kind: "line" }, { key: "at", label: "from", kind: "thing" }],
  slam_behind: [{ key: "door", label: "door", kind: "door" }],
  lights_die: [{ key: "room", label: "room", kind: "room", opt: true }, { key: "light", label: "or one light", kind: "light", opt: true },
    { key: "secs", label: "for (s)", kind: "number", ph: "1" }, { key: "order", label: "how", kind: "choice", opts: ["toward"], labels: { toward: "one by one toward the player" }, opt: true },
    { key: "gap", label: "one by one, apart (s)", kind: "number", ph: "0.4", opt: true }],
  glimpse: [{ key: "figure", label: "figure", kind: "thing" }, { key: "secs", label: "for (s)", kind: "number", ph: "0.6" }],
  jumpscare: [{ key: "figure", label: "figure", kind: "thing" }, { key: "clip", label: "playing (a motion)", kind: "motion", opt: true },
    { key: "expr", label: "its face", kind: "expr", opt: true }, { key: "sound", label: "sound (the big sting if none)", kind: "sound", opt: true },
    { key: "secs", label: "for (s)", kind: "number", ph: "0.8, or its motion's", opt: true }],
  swap: [{ key: "hide", label: "hide", kind: "thing" }, { key: "show", label: "show", kind: "thing" }],
  loop_hall: [{ key: "trigger", label: "at the end of", kind: "zone" }, { key: "back_to", label: "back to", kind: "spot" }],
  cut_away: [{ key: "lookat", label: "look at", kind: "thing" }, { key: "then", label: "then", kind: "text" }],
};
// how each scare reads, in a sentence
const TRICK_TEXT = {
  knock: (a, n) => `a knock on ${n("thing", a.at)}${a.count ? " ×" + a.count : ""}`,
  whisper: (a, n) => `a whisper, ${n("line", a.line)}, from ${n("thing", a.at)}`,
  slam_behind: (a, n) => `${n("thing", a.door)} slams shut behind the player`,
  lights_die: (a, n) => `${a.light ? `${n("thing", a.light)} dies` : `the lights die in ${n("thing", a.room)}`}${a.order === "toward" ? ", one by one toward the player" : ""}${a.secs ? ` for ${a.secs} s` : ""}`,
  glimpse: (a, n) => `a glimpse of ${n("thing", a.figure)}${a.secs ? ` (${a.secs} s)` : ""}`,
  jumpscare: (a, n) => `a jump scare: ${n("thing", a.figure)}${a.clip ? `, playing ${a.clip}` : ""}${a.expr ? `, its face ${n("expr", a.expr)}` : ""}${a.sound ? `, with ${a.sound}` : ""}`,
  swap: (a, n) => `while unseen, ${n("thing", a.hide)} becomes ${n("thing", a.show)}`,
  loop_hall: (a, n) => `the hall loops: the end of ${n("thing", a.trigger)} leads back to ${n("thing", a.back_to)}`,
  cut_away: (a, n) => `a cut away to ${n("thing", a.lookat)}`,
};
export const TRICK_LABELS = { knock: "a knock", whisper: "a whisper", slam_behind: "a door slams behind", lights_die: "the lights die",
  glimpse: "a glimpse", jumpscare: "a jump scare", swap: "a swap while unseen", loop_hall: "the hall loops", cut_away: "a cut away" };
// tricks the palette no longer offers (docs/HORROR_TODO.md 0; the story check warns): the loop isn't in Play yet, and the
// eye is never turned for the player (DIRECTING §1)
export const RETIRED_TRICKS = ["loop_hall", "cut_away"];
// a cast member in play (`behave`): each way's own fields
export const BEHAVE_FIELDS = {
  idle: [{ key: "at", label: "at", kind: "spot" }, { key: "pose", label: "pose", kind: "pose", opt: true }, { key: "face", label: "facing", kind: "facing", opt: true },
    { key: "motion", label: "playing (a motion)", kind: "motion", opt: true }],
  sit: [{ key: "at", label: "on", kind: "spot" }, { key: "pose", label: "pose", kind: "pose", opt: true }, { key: "motion", label: "playing (a motion)", kind: "motion", opt: true }],
  path: [{ key: "route", label: "route", kind: "route" }, { key: "mode", label: "mode", kind: "choice", opts: ["loop", "pingpong", "once"], opt: true },
    { key: "speed", label: "speed (m/s)", kind: "number", ph: "1.1", opt: true }, { key: "from", label: "starting from", kind: "choice", opts: ["nearest", "first"], opt: true },
    { key: "motion", label: "walking (a motion, in place)", kind: "motion", opt: true }],
  patrol: [{ key: "routes", label: "routes", kind: "routes" }, { key: "pick", label: "pick", kind: "choice", opts: ["order", "random"], opt: true },
    { key: "speed", label: "speed (m/s)", kind: "number", ph: "1.1", opt: true }, { key: "motion", label: "walking (a motion, in place)", kind: "motion", opt: true }],
  go: [{ key: "to", label: "to", kind: "spot" }, { key: "then", label: "then", kind: "choice", opts: ["idle", "sit"], labels: { idle: "stands there", sit: "sits there" }, opt: true },
    { key: "via", label: "by way of", kind: "many", of: "spot", opt: true }, { key: "face", label: "facing (standing)", kind: "facing", opt: true },
    { key: "speed", label: "speed (m/s)", kind: "number", ph: "1.1", opt: true }, { key: "motion", label: "walking (a motion, in place)", kind: "motion", opt: true }],
  off: [],
};

const q = s => `“${s}”`;
const plus = n => (n > 0 ? "+" : "") + n;
const span = s => { s = +s || 0; const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h && m ? `${h} h ${m} min` : h ? `${h} h` : m ? `${m} min` : `${s} s`; };

// ---- actions (a beat's `do`) ------------------------------------------------------------------------------------
// n(kind, value): the desk's name for a reference (a line's English, a scene's title, an item's name)
export const ACTIONS = [
  { verb: "objective", label: "Objective", icon: "target", group: "story", hint: "the line the HUD shows as the player's goal",
    fields: [{ key: "objective", label: "Objective", kind: "text", verb: true, ph: "Find the cellar key (empty clears it)" }],
    make: () => ({ objective: "" }), text: a => a.objective ? `Objective: ${q(a.objective)}` : "Clear the objective" },
  { verb: "say", label: "Say a line", icon: "say", group: "story", hint: "a line from the lines table, spoken with its take",
    fields: [{ key: "say", label: "Line", kind: "line", verb: true }], make: () => ({ say: "" }), text: (a, n) => `Say ${n("line", a.say)}` },
  { verb: "think", label: "Think", icon: "think", group: "story", hint: "the player's own thought, as a subtitle",
    fields: [{ key: "think", label: "Thought", kind: "longtext", verb: true, ph: "Her handwriting. Shakier than I remember." },
      { key: "retype", label: "then erased and retyped as", kind: "text", opt: true, ph: "Natsu." },
      { key: "breaks", label: "breaks off (a memory flicker)", kind: "bool", opt: true }],
    make: () => ({ think: "" }), text: a => `Think ${q(a.think || "…")}${a.retype ? `, then retyped as ${q(a.retype)}` : ""}${a.breaks ? ", breaking off" : ""}` },
  { verb: "name", label: "Ask the player's name", icon: "person", group: "story", hint: "a box to type their name in; {name} in any line, thought or answer shows it from then on (game.player_name until then)",
    fields: [{ key: "name", label: "The question", kind: "text", verb: true, ph: "What's your name?" }, { key: "default", label: "if nothing is typed", kind: "text", opt: true, ph: "the game's player name" }],
    make: () => ({ name: "What's your name?" }), text: a => `Ask the player's name${a.name ? " (" + q(a.name) + ")" : ""}${a.default ? `, else ${q(a.default)}` : ""}` },
  { verb: "ask", label: "Ask a question", icon: "ask", group: "story", hint: "2 to 4 answers at the bottom centre under the question; each answer runs its own commands",
    fields: [{ key: "ask", label: "Id", kind: "text", verb: true, ph: "q_stay" }, { key: "text", label: "Question (a thought)", kind: "text", opt: true },
      { key: "line", label: "or a spoken line", kind: "line", opt: true }, { key: "who", label: "beside", kind: "cast", opt: true },
      { key: "on", label: "or at", kind: "thing", opt: true }],
    make: () => ({ ask: "q_new", text: "", options: [{ id: "yes", label: "Yes", do: [] }, { id: "no", label: "No", do: [] }] }),
    text: (a, n) => `Ask ${a.line ? n("line", a.line) : q(a.text || a.ask)}${a.who ? " beside " + n("cast", a.who) : ""}`, branches: "options" },
  { verb: "todo", label: "Add to the to-do list", icon: "check", group: "story", hint: "a task on the HUD's list, ticked off in any order: by a trigger of its own, a Tick command, or failed (a time limit, a trigger, a Fail command)",
    fields: [{ key: "todo", label: "Id", kind: "text", verb: true, ph: "mop_floor" }, { key: "text", label: "What the list says", kind: "text", ph: "Mop the floor" },
      { key: "who", label: "asked by", kind: "cast", opt: true }, { key: "ticks", label: "ticked when", kind: "trigger", opt: true },
      { key: "fails", label: "failed when", kind: "trigger", opt: true }, { key: "secs", label: "fails after (s)", kind: "number", opt: true },
      { key: "hidden", label: "hidden (kept, not on the list)", kind: "bool", opt: true },
      { key: "guide", label: "a marker over what it needs (Godot draws it)", kind: "bool", opt: true }],
    make: () => ({ todo: "task", text: "" }), outcomes: [["done", "When it's ticked"], ["failed", "When it's failed"]],
    text: (a, n) => `${a.hidden ? "Hidden to do" : "To do"}: ${q(a.text || a.todo)}${a.who ? " for " + n("cast", a.who) : ""}${a.ticks ? ", ticked when " + triggerText(a.ticks, n) : ""}${a.secs ? ` · ${a.secs} s` : ""}${a.guide ? " · with a marker" : ""}` },
  { verb: "tick", label: "Tick a task", icon: "check", group: "story", hint: "a task on the to-do list done", fields: [{ key: "tick", label: "Task", kind: "todo", verb: true }],
    make: () => ({ tick: "" }), text: (a, n) => `Tick ${n("todo", a.tick)}` },
  { verb: "fail", label: "Fail a task", icon: "x", group: "story", hint: "a task on the to-do list failed: struck out in red, its “when it's failed” runs",
    fields: [{ key: "fail", label: "Task", kind: "todo", verb: true }], make: () => ({ fail: "" }), text: (a, n) => `Fail ${n("todo", a.fail)}` },
  { verb: "untodo", label: "Take off the to-do list", icon: "x", group: "story", hint: "a task (or every task) off the list",
    fields: [{ key: "untodo", label: "Task", kind: "anytodo", verb: true }], make: () => ({ untodo: true }),
    text: (a, n) => a.untodo === true ? "Clear the to-do list" : `Take ${n("todo", a.untodo)} off the list` },
  { verb: "scene", label: "Play a scene", icon: "scene", group: "story", hint: "a triggered scene: blended in from where the player is, then play goes on",
    fields: [{ key: "scene", label: "Scene", kind: "scene", verb: true }], make: () => ({ scene: "" }), text: (a, n) => `Play scene ${n("scene", a.scene)}` },

  { verb: "flag", label: "Set a flag", icon: "flag", group: "state", hint: "a named fact the story can branch on later",
    fields: [{ key: "flag", label: "Flag", kind: "flag", verb: true }], make: () => ({ flag: "" }), text: a => `Set flag ${a.flag || "…"}` },
  { verb: "unflag", label: "Clear a flag", icon: "unflag", group: "state",
    fields: [{ key: "unflag", label: "Flag", kind: "flag", verb: true }], make: () => ({ unflag: "" }), text: a => `Clear flag ${a.unflag || "…"}` },
  { verb: "give", label: "Give an item", icon: "item", group: "state",
    fields: [{ key: "give", label: "Item", kind: "item", verb: true }], make: () => ({ give: "" }), text: (a, n) => `Give ${n("item", a.give)}` },
  { verb: "take", label: "Take an item", icon: "item", group: "state",
    fields: [{ key: "take", label: "Item", kind: "item", verb: true }], make: () => ({ take: "" }), text: (a, n) => `Take away ${n("item", a.take)}` },
  { verb: "count", label: "Change a counter", icon: "count", group: "state", hint: "game.counters: add to one (1 by default) or set it",
    fields: [{ key: "count", label: "Counter", kind: "counter", verb: true }, { key: "add", label: "add", kind: "number", ph: "1", opt: true },
      { key: "set", label: "or set to", kind: "number", opt: true }],
    make: () => ({ count: "" }), text: (a, n) => `Counter ${n("counter", a.count)} ${a.set !== undefined ? "= " + a.set : plus(+(a.add ?? 1))}` },
  { verb: "karma", label: "Karma", icon: "heart", group: "state", hint: "how the player treats her: plus or minus on an axis",
    fields: [{ key: "karma", label: "Change", kind: "karma", verb: true }], make: () => ({ karma: 1 }),
    text: a => typeof a.karma === "number" ? `Karma ${plus(a.karma)}` : `Karma ${Object.entries(a.karma || {}).map(([k, v]) => `${k} ${plus(v)}`).join(", ")}` },

  { verb: "door", label: "Door", icon: "door", group: "world",
    fields: [{ key: "door", label: "Door", kind: "door", verb: true }, { key: "set", label: "to", kind: "choice", opts: DOOR_SET }],
    make: () => ({ door: "", set: "open" }), text: (a, n) => `${cap(a.set || "open")} ${n("thing", a.door)}` },
  { verb: "open", label: "Open or shut a thing", icon: "door", group: "world", hint: "a lid, a closet's doors, a book's cover: a made prop's parts (PROPGEN §26)",
    fields: [{ key: "open", label: "Thing", kind: "thing", verb: true }, { key: "to", label: "to", kind: "choice", opts: ["open", "shut", "lock", "unlock"] }],
    make: () => ({ open: "", to: "open" }), text: (a, n) => `${cap(a.to || "open")} ${n("thing", a.open)}` },
  { verb: "light", label: "Light", icon: "light", group: "world", hint: "one light, or every light in a room: on, off, flickering, dim; for a while (then back as it was) or for good, fading if you like; normal brings back its own brightness and flicker",
    fields: [{ key: "light", label: "Light", kind: "light", verb: true, opt: true }, { key: "room", label: "or the room", kind: "room", opt: true },
      { key: "set", label: "to", kind: "choice", opts: LIGHT_SET },
      { key: "to", label: "how bright (a dim: 0 to 1)", kind: "number", ph: "0.35", opt: true },
      { key: "mode", label: "its flicker (a flicker)", kind: "choice", opts: FLICKER_MODES, opt: true },
      { key: "secs", label: "for (s), then back as it was", kind: "number", ph: "for good", opt: true },
      { key: "over", label: "fading over (s)", kind: "number", ph: "0", opt: true }],
    make: () => ({ light: null, room: "", set: "off" }),
    text: (a, n) => `${a.room ? "Lights in " + n("thing", a.room) : "Light " + n("thing", a.light)}: ${a.set || "on"}${a.set === "dim" && a.to !== undefined && a.to !== null && a.to !== "" ? ` to ${a.to}` : ""}${a.set === "flicker" && a.mode ? ` (${a.mode})` : ""}${a.secs ? ` for ${a.secs} s` : ""}${a.over ? `, fading over ${a.over} s` : ""}` },
  { verb: "power", label: "The power", icon: "light", group: "world", hint: "the power cut: every electric light in the level dark (candles and fire burn on) and the switches dead, till a breaker (use: breaker) brings it back; or back on",
    fields: [{ key: "power", label: "Power", kind: "choice", verb: true, opts: ["off", "on"] }],
    make: () => ({ power: "off" }), text: a => (a.power === "on" ? "The power comes back" : "The power goes out") },
  { verb: "sweep", label: "A car passes", icon: "light", group: "world", hint: "headlights sweep across the room's ceiling now: a car passes outside its windows that have a sweep (a window's `sweep`; on their own every so often too)",
    fields: [{ key: "sweep", label: "Room", kind: "room", verb: true }],
    make: () => ({ sweep: "" }), text: (a, n) => `A car passes ${a.sweep ? n("room", a.sweep) : "…"}` },
  { verb: "skin", label: "Someone's skin", icon: "person", group: "people", hint: "a cast member's skin wet, sweating, dripping or oiled (0..1 each; left out: unchanged, 0: off): stays on her bodies till set again. The Godot export draws it; the desk's stage doesn't yet",
    fields: [{ key: "skin", label: "Who", kind: "cast", verb: true }, { key: "wet", label: "wet", kind: "number", ph: "0.7", opt: true }, { key: "sweat", label: "sweat", kind: "number", ph: "0.5", opt: true },
      { key: "drips", label: "drips", kind: "number", ph: "0.3", opt: true }, { key: "oil", label: "oil", kind: "number", ph: "0", opt: true }],
    make: () => ({ skin: "", wet: 0.7 }), text: (a, n) => `${cap(n("cast", a.skin))}'s skin: ${["wet", "sweat", "drips", "oil"].filter(k => a[k] != null).map(k => `${k} ${a[k]}`).join(", ") || "…"}` },
  { verb: "torch", label: "Flashlight", icon: "torch", group: "world", hint: "the player's flashlight (an item marked Flashlight in the Database): on, off, a flicker (for a while in a lamp's way), dimming, dead (it flickers out and F only clicks), working again (new batteries) or its battery drained to a charge",
    fields: [{ key: "torch", label: "Flashlight", kind: "choice", verb: true, opts: TORCH_SET },
      { key: "to", label: "how bright, or the charge (dim, drain: 0 to 1)", kind: "number", ph: "0.35", opt: true },
      { key: "mode", label: "its flicker (a flicker)", kind: "choice", opts: FLICKER_MODES, opt: true },
      { key: "secs", label: "for (s)", kind: "number", opt: true },
      { key: "over", label: "over (s)", kind: "number", ph: "0", opt: true }],
    make: () => ({ torch: "flicker" }),
    text: a => `${({ on: "The flashlight comes on", off: "The flashlight goes off", flicker: "The flashlight flickers", dead: "The flashlight dies", works: "The flashlight works again", dim: "The flashlight dims", drain: "The flashlight's battery drains" })[a.torch] || `Flashlight: ${a.torch || "…"}`}${(a.torch === "dim" || a.torch === "drain") && a.to !== undefined && a.to !== null && a.to !== "" ? ` to ${a.to}` : ""}${a.torch === "flicker" && a.mode ? ` (${a.mode})` : ""}${a.secs ? ` for ${a.secs} s` : ""}${a.over ? `, over ${a.over} s` : ""}` },
  { verb: "beam", label: "Someone in the flashlight's beam", icon: "torch", group: "people", hint: "what a cast member does when the flashlight's on her, from now: backs off, freezes, flees to a spot, vanishes, covers her eyes, comes toward it or charges; how long in it first, how bright it must be, how far, how long she keeps away; the lights near her flickering, dimming or dying",
    fields: [{ key: "beam", label: "Who", kind: "cast", verb: true }, { key: "does", label: "does", kind: "choice", opts: BEAM_DOES, labels: BEAM_LABELS },
      { key: "after", label: "after (s) in it", kind: "number", ph: "0.4", opt: true }, { key: "bright", label: "how bright it must be (0 to 1)", kind: "number", ph: "0.3", opt: true },
      { key: "dist", label: "how far (m)", kind: "number", ph: "2.5", opt: true }, { key: "keep", label: "keeps away (s)", kind: "number", ph: "4", opt: true },
      { key: "flee", label: "flees to", kind: "spot", opt: true }, { key: "clip", label: "her move (a motion)", kind: "motion", opt: true },
      { key: "face", label: "her face", kind: "expr", opt: true }, { key: "sound", label: "a sound", kind: "sound", opt: true },
      { key: "near", label: "near her (m): the lights", kind: "number", ph: "0", opt: true }, { key: "near_torch", label: "the flashlight near her", kind: "choice", opts: NEAR_SET, opt: true },
      { key: "near_lamps", label: "the lamps near her", kind: "choice", opts: NEAR_SET, opt: true }],
    make: () => ({ beam: "", does: "backs_off" }),
    text: (a, n) => `${n("cast", a.beam)} in the flashlight's beam: ${BEAM_LABELS[a.does] || a.does || "…"}${a.after ? ` after ${a.after} s` : ""}${a.does === "flees" && a.flee ? ` to ${n("thing", a.flee)}` : ""}${a.near ? `; the lights near her ${a.near} m` : ""}` },
  { verb: "state", label: "Set a thing's state", icon: "life", group: "world", hint: "a little thing to one of its states: the kettle on, the cigarette lit, the clock stopped, the phone ringing (docs/IMMERSION.md)",
    fields: [{ key: "state", label: "Thing", kind: "life", verb: true }, { key: "to", label: "to", kind: "lifestate" }],
    make: () => ({ state: "", to: "" }), text: (a, n) => `${cap(n("thing", a.state))}: ${a.to || "…"}` },
  { verb: "show", label: "Show a thing", icon: "show", group: "world", fields: [{ key: "show", label: "Thing", kind: "thing", verb: true }],
    make: () => ({ show: "" }), text: (a, n) => `Show ${n("thing", a.show)}` },
  { verb: "hide", label: "Hide a thing", icon: "hide", group: "world", fields: [{ key: "hide", label: "Thing", kind: "thing", verb: true }],
    make: () => ({ hide: "" }), text: (a, n) => `Hide ${n("thing", a.hide)}` },
  { verb: "move", label: "Move a thing", icon: "move", group: "world",
    fields: [{ key: "move", label: "Thing", kind: "thing", verb: true }, { key: "to", label: "to", kind: "spot" }],
    make: () => ({ move: "", to: "" }), text: (a, n) => `Move ${n("thing", a.move)} to ${n("thing", a.to)}` },
  { verb: "sound", label: "Sound", icon: "sound", group: "world",
    fields: [{ key: "sound", label: "Sound", kind: "sound", verb: true }, { key: "at", label: "from", kind: "thing", opt: true }],
    make: () => ({ sound: "" }), text: (a, n) => `Sound ${a.sound || "…"}${a.at ? " from " + n("thing", a.at) : ""}` },
  { verb: "music", label: "Music", icon: "music", group: "world", fields: [{ key: "music", label: "Mood", kind: "choice", verb: true, opts: MUSIC }],
    make: () => ({ music: "uneasy" }), text: a => `Music: ${a.music}` },
  { verb: "trick", label: "A scare (trick)", icon: "trick", group: "world", hint: "the composites in TRICKS.md §2: a knock, a glimpse, a door slamming behind",
    fields: [{ key: "trick", label: "Trick", kind: "choice", verb: true, opts: Object.keys(TRICKS).filter(k => !RETIRED_TRICKS.includes(k)), labels: TRICK_LABELS }],
    more: a => TRICKS[a.trick] || [], make: () => ({ trick: "knock", at: "", count: 3 }),
    text: (a, n) => `Scare: ${TRICK_TEXT[a.trick] ? TRICK_TEXT[a.trick](a, n) : a.trick}` },

  { verb: "behave", label: "Someone's behaviour", icon: "person", group: "people", hint: "what a cast member does in play until told otherwise: stand, sit, walk a route, patrol, or leave",
    fields: [{ key: "behave", label: "Who", kind: "cast", verb: true }, { key: "as", label: "does", kind: "choice", opts: BEHAVE_AS },
      { key: "sees", label: "watches for the player", kind: "bool", opt: true }],
    more: a => BEHAVE_FIELDS[a.as || "idle"] || [], make: () => ({ behave: "", as: "idle", at: "" }),
    text: (a, n) => `${n("cast", a.behave)}: ${behaveText(a, n)}${a.motion ? " · playing " + n("motion", a.motion) : ""}${a.sees ? " · watches for you" : ""}` },
  { verb: "expr", label: "A face on someone", icon: "person", group: "people", hint: "an expression from the library on a cast member's face (STORY_FORMAT §4): a capture plays once and her face goes back to the one she rests in, a loop runs until another takes over; as the face she rests in, it stays (none: at rest)",
    fields: [{ key: "who", label: "Who", kind: "cast" }, { key: "expr", label: "wears", kind: "expr", verb: true },
      { key: "rest", label: "as the face she rests in", kind: "bool", opt: true }, { key: "loop", label: "over and over", kind: "bool", opt: true },
      { key: "w", label: "how strong (0 to 2)", kind: "number", ph: "1", opt: true }],
    make: () => ({ expr: "", who: "" }), text: (a, n) => `${cap(n("cast", a.who))}'s face${a.rest ? " at rest" : ""}: ${a.expr ? n("expr", a.expr) : "none"}${a.loop ? ", over and over" : ""}` },
  { verb: "anim", label: "Animate someone", icon: "motion", group: "people", hint: "someone (or a thing) plays a motion once, held where she is, then goes back to what she was doing; turned to face the player or something while it plays, if you like (no motion: she only turns)",
    fields: [{ key: "anim", label: "Who (or a thing)", kind: "thing", verb: true }, { key: "clip", label: "motion", kind: "motion", opt: true },
      { key: "face", label: "turned to", kind: "facing", opt: true }, { key: "secs", label: "for (s)", kind: "number", ph: "its motion's, or 2.5 turned", opt: true },
      { key: "wait", label: "the beat waits for it", kind: "bool", opt: true }],
    make: () => ({ anim: "", clip: "" }),
    text: (a, n) => `Animate ${n("thing", a.anim)}: ${a.clip || (a.face ? "turns" : "…")}${a.face ? ` to ${a.face === "player" ? "the player" : n("thing", a.face)}` : ""}${a.secs ? ` for ${a.secs} s` : ""}` },
  { verb: "shot", label: "Close-up", icon: "camera", group: "people", hint: "the camera holds on someone for a line, then gives the view back",
    fields: [{ key: "shot", label: "Shot", kind: "choice", verb: true, opts: ["closeup"] }, { key: "who", label: "on", kind: "cast" }, { key: "line", label: "for the line", kind: "line", opt: true }],
    make: () => ({ shot: "closeup", who: "" }), text: (a, n) => `Close-up on ${n("cast", a.who)}${a.line ? " for " + n("line", a.line) : ""}` },

  { verb: "wait", label: "Wait", icon: "clock", group: "time", fields: [{ key: "wait", label: "Seconds", kind: "number", verb: true, ph: "1" }],
    make: () => ({ wait: 1 }), text: a => `Wait ${a.wait} s` },
  { verb: "skip", label: "Time skips", icon: "clock", group: "time", hint: "missing time: the little things live through it at once (a clock's hands jump on, the tea goes cold); nothing else moves",
    fields: [{ key: "skip", label: "Seconds skipped", kind: "number", verb: true, ph: "5400 (an hour and a half)" }],
    make: () => ({ skip: 3600 }), text: a => `Time skips ${span(a.skip)}` },
  { verb: "fade", label: "Fade", icon: "fade", group: "time",
    fields: [{ key: "fade", label: "Fade", kind: "choice", verb: true, opts: ["out", "in"] }, { key: "secs", label: "over (s)", kind: "number", ph: "1", opt: true }],
    make: () => ({ fade: "out", secs: 1 }), text: a => `Fade ${a.fade} (${a.secs ?? 1} s)` },
  { verb: "focus", label: "Hold the view (a cutscene)", icon: "eye", group: "time", hint: "a cutscene in the level, no black bars, no skipping: the view kept on someone or something (the player looks round within a cone, drawn back when they look away), closer if you like, the walk slowed; let go by an empty one, or after its most seconds whatever happens (Godot)",
    fields: [{ key: "focus", label: "Hold the view on (empty: let go)", kind: "thing", verb: true },
      { key: "push", label: "lean in (m, up to 0.35)", kind: "number", ph: "0", opt: true }, { key: "zoom", label: "held focus (up to 0.15)", kind: "number", ph: "0", opt: true },
      { key: "walk", label: "walking", kind: "choice", opts: ["slow", "held", "free"], labels: { slow: "slowed", held: "held", free: "free" }, opt: true },
      { key: "max", label: "let go after at most (s)", kind: "number", ph: "20", opt: true }],
    make: () => ({ focus: "" }),
    text: (a, n) => a.focus ? `Hold the view on ${n("thing", a.focus)}${a.push || a.zoom ? ", closer" : ""}${a.walk === "held" ? ", the player still" : a.walk === "free" ? "" : ", walking slowed"}${a.max ? `, ${a.max} s at most` : ""}` : "Let the view go" },
  { verb: "lookat", label: "Turn the view", icon: "eye", group: "time", hint: "the player's view eases to something and holds (keep it short)",
    fields: [{ key: "lookat", label: "Look at", kind: "thing", verb: true }, { key: "secs", label: "for (s)", kind: "number", ph: "1", opt: true },
      { key: "lock", label: "hold the view", kind: "bool", opt: true }],
    make: () => ({ lookat: "", secs: 1 }), text: (a, n) => `Turn the view to ${n("thing", a.lookat)} (${a.secs ?? 1} s)` },
  { verb: "chapter", label: "Chapter card", icon: "film", group: "time", hint: "a title card over the dark (“Night 2”, “23:40” under it): the time of day changes behind it, the game autosaves; a sleeper wakes in their bed",
    fields: [{ key: "chapter", label: "Title", kind: "text", verb: true, ph: "Night 2" }, { key: "sub", label: "under it", kind: "text", ph: "23:40", opt: true },
      { key: "time", label: "the time of day after it", kind: "choice", opts: ["day", "dusk", "night"], opt: true }, { key: "secs", label: "held (s)", kind: "number", ph: "3", opt: true }],
    make: () => ({ chapter: "" }), text: a => `Chapter: ${q(a.chapter || "…")}${a.sub ? " · " + a.sub : ""}${a.time ? ", then " + a.time : ""}${a.save === false ? " (no autosave)" : ""}` },
  { verb: "seq", label: "Level sequence", icon: "scene", group: "time", hint: "an Unreal level sequence by name (a title card on the desk)",
    fields: [{ key: "seq", label: "Sequence", kind: "text", verb: true }], make: () => ({ seq: "" }), text: a => `Sequence ${a.seq || "…"}` },

  { verb: "checkpoint", label: "Checkpoint", icon: "save", group: "flow", fields: [], make: () => ({ checkpoint: true }), text: () => "Checkpoint (save here)" },
  { verb: "done", label: "End the task", icon: "done", group: "flow", hint: "the task is over: the flow goes on to its next node",
    fields: [], make: () => ({ done: true }), text: () => "End the task" },
  { verb: "stalker", label: "Stalker (Unreal)", icon: "person", group: "flow", hint: "the old Unreal-side stalker; on the desk, use Someone's behaviour",
    fields: [{ key: "stalker", label: "Do", kind: "choice", verb: true, opts: ["spawn", "despawn", "patrol", "hunt", "chase"] }, { key: "at", label: "at", kind: "spot", opt: true },
      { key: "route", label: "route", kind: "route", opt: true }], make: () => ({ stalker: "patrol" }), text: a => `Stalker: ${a.stalker}` , rare: true },
];
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function behaveText(a, n) {
  switch (a.as || "idle") {
    case "idle": return `stands at ${n("thing", a.at)}${a.pose ? " (" + a.pose + ")" : ""}${a.face ? ", facing " + (a.face === "player" ? "you" : n("thing", a.face)) : ""}`;
    case "sit": return `sits at ${n("thing", a.at)}`;
    case "path": return `walks ${a.route ? n("route", a.route) : "a route"}${a.mode ? " (" + a.mode + ")" : ""}`;
    case "patrol": return `patrols ${(a.routes || []).map(r => n("route", r)).join(", ") || "…"}${a.pick === "random" ? " (random)" : ""}`;
    case "go": return `walks to ${n("thing", a.to)}${(a.via || []).length ? " by way of " + a.via.map(x => n("thing", x)).join(", ") : ""}${a.then === "sit" ? " and sits" : ""}`;
    case "off": return "leaves";
  }
  return a.as;
}

// ---- triggers (a beat's `when`) ---------------------------------------------------------------------------------
export const TRIGGERS = [
  { verb: "start", label: "The task starts", icon: "play", fields: [], make: () => ({ start: true }), text: () => "the task starts" },
  { verb: "enter", label: "The player enters", icon: "enter", fields: [{ key: "enter", label: "Room or trigger", kind: "zone", verb: true }],
    make: () => ({ enter: "" }), text: (w, n) => `the player enters ${n("thing", w.enter)}` },
  { verb: "exit", label: "The player leaves", icon: "exit", fields: [{ key: "exit", label: "Room or trigger", kind: "zone", verb: true }],
    make: () => ({ exit: "" }), text: (w, n) => `the player leaves ${n("thing", w.exit)}` },
  { verb: "use", label: "The player uses", icon: "hand", fields: [{ key: "use", label: "Thing", kind: "thing", verb: true }],
    make: () => ({ use: "" }), text: (w, n) => `the player uses ${n("thing", w.use)}` },
  { verb: "pickup", label: "The player picks up", icon: "item", fields: [{ key: "pickup", label: "Item", kind: "item", verb: true }],
    make: () => ({ pickup: "" }), text: (w, n) => `the player picks up ${n("item", w.pickup)}` },
  { verb: "read", label: "The player reads", icon: "note", hint: "a note, or a book (use: book): its id, and `page` the left page's number of the spread shown",
    fields: [{ key: "read", label: "Note or book", kind: "note", verb: true }, { key: "page", label: "page", kind: "number", opt: true, ph: "0" }],
    make: () => ({ read: "" }), text: (w, n) => `the player reads ${n("note", w.read)}${w.page !== undefined && w.page !== null && w.page !== "" ? " at page " + w.page : ""}` },
  { verb: "look", label: "The player looks at", icon: "eye", fields: [{ key: "look", label: "Thing", kind: "thing", verb: true },
    { key: "secs", label: "for (s)", kind: "number", ph: "1", opt: true }, { key: "within", label: "within (m)", kind: "number", ph: "8", opt: true }],
    make: () => ({ look: "", secs: 1 }), text: (w, n) => `the player looks at ${n("thing", w.look)} for ${w.secs ?? 1} s` },
  { verb: "after", label: "After another beat", icon: "clock", fields: [{ key: "after", label: "Beat", kind: "beat", verb: true },
    { key: "secs", label: "plus (s)", kind: "number", ph: "0", opt: true }], make: () => ({ after: "", secs: 2 }),
    text: w => `${w.secs ? w.secs + " s " : ""}after ${w.after || "…"}` },
  { verb: "flag", label: "A flag is set", icon: "flag", fields: [{ key: "flag", label: "Flag", kind: "flag", verb: true }],
    make: () => ({ flag: "" }), text: w => `flag ${w.flag || "…"} is set` },
  { verb: "caught", label: "The player is caught", icon: "person", fields: [{ key: "caught", label: "By", kind: "anyone", verb: true }],
    make: () => ({ caught: true }), text: (w, n) => `the player is caught${w.caught === true ? "" : " by " + n("cast", w.caught)}` },
  { verb: "hidden", label: "The player hides", icon: "hide", fields: [{ key: "hidden", label: "In", kind: "anylocker", verb: true }],
    make: () => ({ hidden: true }), text: (w, n) => `the player is hidden${w.hidden === true ? "" : " in " + n("thing", w.hidden)}` },
  { verb: "answered", label: "A question is answered", icon: "ask", fields: [{ key: "answered", label: "Question", kind: "ask", verb: true },
    { key: "option", label: "with", kind: "askanswer", opt: true }], make: () => ({ answered: "" }),
    text: w => `${w.answered || "…"} is answered${w.option ? " " + q(w.option) : ""}` },
  { verb: "carrying", label: "The player carries", icon: "item", fields: [{ key: "carrying", label: "Thing", kind: "anycarry", verb: true }],
    make: () => ({ carrying: true }), text: (w, n) => `the player is carrying ${w.carrying === true ? "anything" : n("thing", w.carrying)}` },
  { verb: "dropped", label: "Something is put down", icon: "move", fields: [{ key: "dropped", label: "Thing", kind: "carry", verb: true },
    { key: "in", label: "in", kind: "zone", opt: true }], make: () => ({ dropped: "" }),
    text: (w, n) => `${n("thing", w.dropped)} is put down${w.in ? " in " + n("thing", w.in) : ""}` },
  { verb: "opened", label: "A thing is open", icon: "door", hint: "holds while its lid, doors or cover are open (use: open, container, book)",
    fields: [{ key: "opened", label: "Thing", kind: "thing", verb: true }], make: () => ({ opened: "" }), text: (w, n) => `${n("thing", w.opened)} is open` },
  { verb: "closed", label: "A thing is shut", icon: "door", hint: "its lid, doors or cover swung or slid shut (use: open, container), or a door closed",
    fields: [{ key: "closed", label: "Thing", kind: "thing", verb: true }], make: () => ({ closed: "" }), text: (w, n) => `${n("thing", w.closed)} is shut` },
  { verb: "placed", label: "Something is put into a container", icon: "move", fields: [{ key: "placed", label: "Thing", kind: "thing", verb: true },
    { key: "in", label: "into", kind: "thing", opt: true }], make: () => ({ placed: "" }),
    text: (w, n) => `${n("thing", w.placed)} is put in${w.in ? "to " + n("thing", w.in) : ""}` },
  { verb: "taken", label: "Something is taken out of a container", icon: "item", fields: [{ key: "taken", label: "Thing", kind: "thing", verb: true },
    { key: "from", label: "out of", kind: "thing", opt: true }], make: () => ({ taken: "" }),
    text: (w, n) => `${n("thing", w.taken)} is taken out${w.from ? " of " + n("thing", w.from) : ""}` },
  { verb: "moved", label: "A moveable comes to rest elsewhere", icon: "move", hint: "pushed over, carried off and put down (use: moveable)",
    fields: [{ key: "moved", label: "Thing", kind: "thing", verb: true }], make: () => ({ moved: "" }), text: (w, n) => `${n("thing", w.moved)} has been moved` },
  { verb: "played", label: "A board game ends", icon: "dice", fields: [{ key: "played", label: "Table", kind: "table", verb: true },
    { key: "result", label: "with", kind: "text", opt: true, ph: "lose" }], make: () => ({ played: "" }),
    text: (w, n) => `the game at ${n("thing", w.played)} ends${w.result ? " " + q(w.result) : ""}` },
  { verb: "rolled", label: "A die is rolled", icon: "dice", fields: [{ key: "rolled", label: "Die", kind: "die", verb: true },
    { key: "face", label: "showing", kind: "number", opt: true }, { key: "at_least", label: "or at least", kind: "number", opt: true }],
    make: () => ({ rolled: "" }), text: (w, n) => `${n("thing", w.rolled)} rolls${w.face ? " a " + w.face : w.at_least ? " " + w.at_least + " or more" : ""}` },
  { verb: "power", label: "The power is on or off", icon: "light", fields: [{ key: "power", label: "Power", kind: "choice", verb: true, opts: ["off", "on"] }],
    make: () => ({ power: "on" }), text: w => `the power is ${w.power || "…"}` },
  { verb: "locked", label: "A door is locked", icon: "door", hint: "holds while it's locked: the player turned its latch (a door's latch), its key not yet used, or a door lock",
    fields: [{ key: "locked", label: "Door", kind: "door", verb: true }], make: () => ({ locked: "" }), text: (w, n) => `${n("thing", w.locked)} is locked` },
  { verb: "peeping", label: "The player looks through a peephole", icon: "eye", fields: [{ key: "peeping", label: "Door", kind: "door", verb: true }],
    make: () => ({ peeping: "" }), text: (w, n) => `the player looks through ${n("thing", w.peeping)}'s peephole` },
  { verb: "torch", label: "The flashlight is switched, runs low, dies or is changed", icon: "torch", fields: [{ key: "torch", label: "It", kind: "choice", verb: true, opts: ["on", "off", "low", "dead", "changed"],
      labels: { on: "is switched on", off: "is switched off", low: "runs low", dead: "dies", changed: "gets new batteries" } }],
    make: () => ({ torch: "on" }), text: w => ({ low: "the flashlight runs low", dead: "the flashlight dies", changed: "the flashlight gets new batteries" })[w.torch] || `the player switches the flashlight ${w.torch || "…"}` },
  { verb: "lit", label: "The flashlight is on someone", icon: "torch", fields: [{ key: "lit", label: "On", kind: "cast", verb: true }, { key: "secs", label: "for (s)", kind: "number", ph: "0.3", opt: true }],
    make: () => ({ lit: "" }), text: (w, n) => `the flashlight is on ${n("cast", w.lit)}${w.secs ? ` for ${w.secs} s` : ""}` },
  { verb: "flashed", label: "Someone is flashed", icon: "torch", fields: [{ key: "flashed", label: "Who", kind: "cast", verb: true }, { key: "times", label: "times", kind: "number", ph: "1", opt: true },
    { key: "within", label: "within (s)", kind: "number", ph: "3", opt: true }],
    make: () => ({ flashed: "" }), text: (w, n) => `${n("cast", w.flashed)} is flashed${w.times > 1 ? ` ${w.times} times` : ""}${w.within ? ` within ${w.within} s` : ""}` },
  { verb: "charge", label: "The flashlight's charge is under", icon: "torch", fields: [{ key: "charge", label: "Under (0 to 1)", kind: "number", verb: true, ph: "0.25" }],
    make: () => ({ charge: 0.25 }), text: w => `the flashlight's charge is under ${w.charge ?? "…"}` },
  { verb: "state", label: "A thing is in a state", icon: "life", fields: [{ key: "state", label: "Thing", kind: "life", verb: true },
    { key: "is", label: "is", kind: "lifestate" }], make: () => ({ state: "", is: "" }), text: (w, n) => `${n("thing", w.state)} is ${w.is || "…"}` },
  { verb: "gave", label: "Something is given to someone", icon: "item", fields: [{ key: "gave", label: "Item (* any)", kind: "item", verb: true },
    { key: "to", label: "to", kind: "cast" }, { key: "except", label: "but not", kind: "item", opt: true }], make: () => ({ gave: "", to: "" }),
    text: (w, n) => `${w.gave === "*" ? "anything" : n("item", w.gave)}${w.except ? " but " + n("item", w.except) : ""} is given to ${n("cast", w.to)}` },   // Godot's runtime only (STORY_FORMAT §4)
  { verb: "arrived", label: "Someone gets there", icon: "person", fields: [{ key: "arrived", label: "Who", kind: "cast", verb: true }, { key: "at", label: "at", kind: "spot", opt: true }],
    make: () => ({ arrived: "" }), text: (w, n) => `${n("cast", w.arrived)} gets to ${w.at ? n("thing", w.at) : "where she was going"}` },
  { verb: "ticked", label: "A task is ticked", icon: "check", fields: [{ key: "ticked", label: "Task", kind: "anytodo", verb: true }],
    make: () => ({ ticked: true }), text: (w, n) => w.ticked === true ? "the to-do list is through" : `${n("todo", w.ticked)} is ticked` },
  { verb: "failed", label: "A task is failed", icon: "x", fields: [{ key: "failed", label: "Task", kind: "anytodo", verb: true }],
    make: () => ({ failed: true }), text: (w, n) => w.failed === true ? "a task on the list is failed" : `${n("todo", w.failed)} is failed` },
  { verb: "all", label: "All of these", icon: "all", fields: [], make: () => ({ all: [{ start: true }] }), text: (w, n) => `all of: ${(w.all || []).map(x => triggerText(x, n)).join(" and ")}`, nest: true },
  { verb: "any", label: "Any of these", icon: "any", fields: [], make: () => ({ any: [{ start: true }] }), text: (w, n) => `any of: ${(w.any || []).map(x => triggerText(x, n)).join(" or ")}`, nest: true },
];

export const ACTION = Object.fromEntries(ACTIONS.map(d => [d.verb, d]));
export const TRIGGER = Object.fromEntries(TRIGGERS.map(d => [d.verb, d]));
export const verbOfAction = a => (a ? Object.keys(a).find(k => ACTION[k]) || Object.keys(a)[0] : null);
export const verbOfTrigger = w => (w ? Object.keys(w).find(k => TRIGGER[k]) || Object.keys(w)[0] : null);
const naming = n => n || ((k, v) => (v === undefined || v === null || v === "" ? "…" : String(v)));
export function actionText(a, n) { const d = ACTION[verbOfAction(a)]; return d ? d.text(a, naming(n)) : JSON.stringify(a); }
export function triggerText(w, n) { const d = TRIGGER[verbOfTrigger(w)]; return d ? d.text(w, naming(n)) : JSON.stringify(w); }
// the fields a command's form shows: its own, then the ones its choice adds (a trick's, a behaviour's)
export const fieldsOf = (d, a) => [...d.fields, ...(d.more ? d.more(a) : [])];

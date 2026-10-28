// Quick events, after RPG Maker's: a whole task, or one beat, built from a few blanks (a key and its door, a note, a
// hiding game's seeker and its places, a chase's way out), so the common shapes of play are one drag and a short form.
// Each is data: its blanks (fields of kinds the desk's pickers know) and what it builds. A blank left empty stays empty,
// and the live checks show it as a problem to fill. No DOM: DESK builds every one on a game and the story check passes.
//   buildTask(S, tpl, values) -> {tid, stitch, after}: the task added to S.stitches (and the level's door locked, for a key)
//   buildBeat(S, tpl, values) -> a beat, its id unique in the file
import { allIds } from "./refs.js";

const T = s => (s || "").trim();
const named = (S, kind, id) => (kind === "item" ? ((S.items || {})[id] || {}).name : kind === "note" ? ((S.notes || {})[id] || {}).title : null) || (id || "").replace(/_/g, " ");
export const TASKS = [
  { id: "key_door", label: "A locked door and its key", icon: "door", template: "fetch",
    hint: "the player finds a key, unlocks a door with it and goes through",
    blanks: [{ key: "title", label: "The task", kind: "text", ph: "The cellar key" }, { key: "item", label: "The key", kind: "item" },
      { key: "door", label: "The door it opens", kind: "door" }, { key: "beyond", label: "The room behind it", kind: "zone" },
      { key: "find", label: "What the player is told", kind: "text", ph: "Find the key to the cellar" }],
    build: (v, S, id) => ({ title: T(v.title) || "The key", template: "fetch", target_min: 4, beats: [
      { id: id("b_key_start"), when: { start: true }, do: [{ objective: T(v.find) || `Find the key to the ${named(S, "door", v.door)}` }] },
      { id: id("b_key_found"), when: { pickup: v.item || "" }, do: [{ think: "This should fit." }, { objective: `Open the ${named(S, "door", v.door)}` }] },
      { id: id("b_key_through"), when: { enter: v.beyond || "" }, do: [{ objective: "" }, { done: true }] }] }),
    level: (v, S) => lockDoor(S, v.door, v.item) },
  { id: "read_note", label: "A note to read", icon: "note", template: "explore",
    hint: "the player looks around, finds a note and reads it; the task ends on what it makes them think",
    blanks: [{ key: "title", label: "The task", kind: "text", ph: "Mari's letter" }, { key: "note", label: "The note", kind: "note" },
      { key: "look", label: "What the player is told", kind: "text", ph: "Look around the hall" }, { key: "thought", label: "What reading it makes them think", kind: "text", ph: "Her handwriting. Shakier than I remember." }],
    build: (v, S, id) => ({ title: T(v.title) || named(S, "note", v.note) || "A note", template: "explore", target_min: 3, beats: [
      { id: id("b_note_start"), when: { start: true }, do: [{ objective: T(v.look) || "Look around" }] },
      { id: id("b_note_read"), when: { read: v.note || "" }, do: [{ think: T(v.thought) || "…" }, { objective: "" }, { done: true }] }] }) },
  { id: "fetch", label: "Find it and bring it", icon: "item", template: "fetch",
    hint: "the player finds something and carries it to where it belongs",
    blanks: [{ key: "title", label: "The task", kind: "text", ph: "The doll's place" }, { key: "item", label: "What to find", kind: "item" },
      { key: "place", label: "Where it goes", kind: "zone" }],
    build: (v, S, id) => { const has = "has_" + (v.item || "it"); return { title: T(v.title) || `Bring the ${named(S, "item", v.item)}`, template: "fetch", target_min: 5, beats: [
      { id: id("b_fetch_start"), when: { start: true }, do: [{ objective: `Find the ${named(S, "item", v.item)}` }] },
      { id: id("b_fetch_got"), when: { pickup: v.item || "" }, do: [{ flag: has }, { objective: `Bring it to the ${named(S, "zone", v.place)}` }] },
      { id: id("b_fetch_done"), when: { enter: v.place || "" }, if: [has], do: [{ take: v.item || "" }, { objective: "" }, { done: true }] }] }; } },
  { id: "timed_escape", label: "Get out before time runs out", icon: "clock", template: "escape",
    hint: "a timer; the way out ends it, running out of time goes to the node you choose",
    blanks: [{ key: "title", label: "The task", kind: "text", ph: "Get out" }, { key: "exit", label: "The way out", kind: "zone" },
      { key: "secs", label: "Seconds", kind: "number", ph: "45" }, { key: "fail", label: "If time runs out, go to", kind: "node" }],
    build: (v, S, id) => ({ title: T(v.title) || "Get out", template: "escape", target_min: 2, timer: { secs: +v.secs || 45, label: T(v.title) || "Get out", fail: v.fail || "" }, beats: [
      { id: id("b_escape_start"), when: { start: true }, do: [{ objective: "Get out!" }, { music: "chase" }] },
      { id: id("b_escape_out"), when: { enter: v.exit || "" }, do: [{ music: "silence" }, { objective: "" }, { done: true }] }] }) },
  { id: "hide_round", label: "Hide and seek", icon: "hide", template: "hide", round: "hide",
    hint: "a round: hide before she finishes counting; hidden or found decides where the story goes",
    blanks: [{ key: "title", label: "The task", kind: "text", ph: "Hide and seek" }, { key: "seeker", label: "Who seeks", kind: "cast" },
      { key: "places", label: "Where to hide", kind: "many", of: "locker" }, { key: "secs", label: "Seconds", kind: "number", ph: "40" },
      { key: "rule", label: "The rule, in one line", kind: "text", ph: "Hide before she finishes counting to ten" }],
    build: v => ({ title: T(v.title) || "Hide and seek", template: "hide", target_min: 2, beats: [],
      play: { type: "hide", secs: +v.secs || 40, rule: T(v.rule) || "Hide before she finishes counting to ten", seeker: v.seeker || undefined, spots: v.places || [], on: {} } }) },
  { id: "chase", label: "A chase", icon: "exit", template: "run", round: "run",
    hint: "a round: run for the way out; escaped or caught decides where the story goes",
    blanks: [{ key: "title", label: "The task", kind: "text", ph: "Run" }, { key: "seeker", label: "Who chases", kind: "cast" },
      { key: "exit", label: "The way out", kind: "thing" }, { key: "secs", label: "Seconds", kind: "number", ph: "30" },
      { key: "rule", label: "The rule, in one line", kind: "text", ph: "Reach the front door before she reaches you" }],
    build: v => ({ title: T(v.title) || "Run", template: "run", target_min: 1, beats: [],
      play: { type: "run", secs: +v.secs || 30, rule: T(v.rule) || "Reach the door before she reaches you", seeker: v.seeker || undefined, spots: v.exit ? [v.exit] : [], on: {} } }) },
  // a request (DECISIONS 2026-10-27, late night): she asks for something and waits for it; when it's done she goes on
  // to where the story carries on (the sofa), and the task ends as she gets there
  { id: "request", label: "Someone asks for something", icon: "person", template: "request",
    hint: "she asks, it goes on the to-do list, she waits; when it's done she walks off to sit (or stand) somewhere and the story goes on from there",
    blanks: [{ key: "title", label: "The task", kind: "text", ph: "Tea for Mari" }, { key: "who", label: "Who asks", kind: "cast" },
      { key: "wait", label: "Where she waits", kind: "spot" }, { key: "line", label: "What she says", kind: "line", opt: true },
      { key: "text", label: "On the list", kind: "text", ph: "Put the kettle on" }, { key: "ticks", label: "Done when", kind: "trigger" },
      { key: "after", label: "Then she goes to", kind: "spot" }, { key: "then", label: "and there she", kind: "choice", opts: ["sit", "idle"], labels: { sit: "sits", idle: "stands" } }],
    build: (v, S, id) => { const task = id("req_" + (T(v.text).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 20) || "task")), who = v.who || ""; return { title: T(v.title) || T(v.text) || "A request", template: "request", target_min: 3, beats: [
      { id: id("b_req_ask"), when: { start: true }, do: [{ behave: who, as: "idle", at: v.wait || "", face: "player" }, ...(v.line ? [{ say: v.line }] : []),
        { todo: task, text: T(v.text) || "…", who, ...(v.ticks ? { ticks: v.ticks } : {}), on: { done: [{ behave: who, as: "go", to: v.after || "", then: v.then || "sit" }] } }] },
      { id: id("b_req_done"), when: { arrived: who, at: v.after || "" }, do: [{ untodo: task }, { done: true }] }] }; } },
  // the small systems of a Chilla's Art night (DECISIONS 2026-10-28, later): a chore of the shift, the power cut, a knock
  { id: "chore", label: "A chore: clean up a mess", icon: "hand", template: "chore",
    hint: "a job on the to-do list: the player scrubs a stain away by holding the click, with the mop or rag in the hand if you name one; ticked, the task is done",
    blanks: [{ key: "title", label: "The task", kind: "text", ph: "Mop the floor" }, { key: "stain", label: "The mess (a stain)", kind: "stain" },
      { key: "with", label: "Cleaned with (in the hand)", kind: "item", opt: true }, { key: "text", label: "On the list", kind: "text", ph: "Mop up the mud" },
      { key: "thought", label: "Clean, what they think", kind: "text", ph: "That's better.", opt: true }],
    build: (v, S, id) => { const text = T(v.text) || `Clean up the ${named(S, "thing", v.stain)}`, task = id("chore_" + slug(text)); return { title: T(v.title) || text, template: "chore", target_min: 2, beats: [
      { id: id("b_chore_start"), when: { start: true }, do: [{ todo: task, text, ticks: { use: v.stain || "" } }] },
      { id: id("b_chore_done"), when: { ticked: task }, do: [...(T(v.thought) ? [{ think: T(v.thought) }] : []), { done: true }] }] }; },
    level: (v, S) => setOn(S, v.stain, "with", v.with, x => x.use === "clean") },
  { id: "lock_up", label: "A chore: lock the door", icon: "door", template: "chore",
    hint: "a job on the to-do list: the player turns the door's latch from inside (the door gets one); locked, the task is done",
    blanks: [{ key: "title", label: "The task", kind: "text", ph: "Lock up" }, { key: "door", label: "The door", kind: "door" },
      { key: "text", label: "On the list", kind: "text", ph: "Lock the front door" }, { key: "thought", label: "Locked, what they think", kind: "text", ph: "There. Nobody's getting in.", opt: true }],
    build: (v, S, id) => { const text = T(v.text) || `Lock the ${named(S, "thing", v.door)}`, task = id("chore_" + slug(text)); return { title: T(v.title) || text, template: "chore", target_min: 1, beats: [
      { id: id("b_lock_start"), when: { start: true }, do: [{ todo: task, text, ticks: { locked: v.door || "" } }] },
      { id: id("b_lock_done"), when: { ticked: task }, do: [...(T(v.thought) ? [{ think: T(v.thought) }] : []), { done: true }] }] }; },
    level: (v, S) => setOn(S, v.door, "latch", true, (x, k) => k === "door" || isDoor(x)) },
  { id: "power_cut", label: "The power cut", icon: "light", template: "power",
    hint: "every bulb and lamp in the level dies (candles and fire burn on) and the switches with it; the player finds the breaker box in the dark and throws it",
    blanks: [{ key: "title", label: "The task", kind: "text", ph: "The power cut" }, { key: "breaker", label: "The breaker box", kind: "breaker" },
      { key: "thought", label: "What it makes them think", kind: "text", ph: "The power's gone. The breaker box is in the hall." },
      { key: "find", label: "What the player is told", kind: "text", ph: "Find the breaker box" }],
    build: (v, S, id) => ({ title: T(v.title) || "The power cut", template: "power", target_min: 3, beats: [
      { id: id("b_power_cut"), when: { start: true }, do: [{ power: "off" }, { think: T(v.thought) || "The power's gone." }, { objective: T(v.find) || "Find the breaker box" }] },
      { id: id("b_power_back"), when: { use: v.breaker || "" }, do: [{ objective: "" }, { done: true }] }] }) },
  { id: "door_knock", label: "A knock at the door (the peephole)", icon: "door", template: "peephole",
    hint: "someone knocks; the player goes to the door and puts their eye to its peephole: nobody there, or someone you name, shown while they look and gone after",
    blanks: [{ key: "title", label: "The task", kind: "text", ph: "Who's there?" }, { key: "door", label: "The door", kind: "door" },
      { key: "count", label: "Knocks", kind: "number", ph: "3" }, { key: "figure", label: "Who's out there (or nobody)", kind: "thing", opt: true },
      { key: "thought", label: "What they think, looking", kind: "text", ph: "Nobody there." }],
    build: (v, S, id) => ({ title: T(v.title) || "Who's there?", template: "peephole", target_min: 2, beats: [
      { id: id("b_knock_knock"), when: { start: true }, do: [{ trick: "knock", at: v.door || "", count: +v.count || 3 }, { objective: "See who's at the door" }] },
      { id: id("b_knock_look"), when: { peeping: v.door || "" }, do: [...(v.figure ? [{ show: v.figure }] : []), { wait: 1.5 }, { think: T(v.thought) || "Nobody there." },
        ...(v.figure ? [{ hide: v.figure }] : []), { objective: "" }, { done: true }] }] }),
    level: (v, S) => setOn(S, v.door, "peephole", true, (x, k) => k === "door" || isDoor(x)) },
];
export const BEATS = [
  { id: "jumpscare", label: "A jump scare on entering", icon: "trick", hint: "a sound to lead the eye, then the figure",
    blanks: [{ key: "zone", label: "When the player enters", kind: "zone" }, { key: "figure", label: "The figure", kind: "thing" }, { key: "sound", label: "The sound first", kind: "sound", opt: true }],
    build: (v, S, id) => ({ id: id("b_scare"), when: { enter: v.zone || "" }, do: [...(v.sound ? [{ sound: v.sound }] : []), { trick: "jumpscare", figure: v.figure || "" }] }) },
  { id: "knock", label: "A knock", icon: "door", hint: "knocking on something, when the player comes into a room",
    blanks: [{ key: "zone", label: "When the player enters", kind: "zone" }, { key: "at", label: "On what", kind: "thing" }, { key: "count", label: "Times", kind: "number", ph: "3" }],
    build: (v, S, id) => ({ id: id("b_knock"), when: { enter: v.zone || "" }, do: [{ trick: "knock", at: v.at || "", count: +v.count || 3 }] }) },
  { id: "lights_die", label: "The lights die", icon: "light", hint: "the room goes dark for a moment as the player comes in",
    blanks: [{ key: "room", label: "In the room", kind: "room" }, { key: "secs", label: "For (s)", kind: "number", ph: "1.5" }],
    build: (v, S, id) => ({ id: id("b_dark"), when: { enter: v.room || "" }, do: [{ trick: "lights_die", room: v.room || "", secs: +v.secs || 1.5 }] }) },
  { id: "slam", label: "A door slams behind", icon: "door", hint: "the door shuts behind the player as they go in",
    blanks: [{ key: "zone", label: "When the player enters", kind: "zone" }, { key: "door", label: "The door", kind: "door" }],
    build: (v, S, id) => ({ id: id("b_slam"), when: { enter: v.zone || "" }, do: [{ trick: "slam_behind", door: v.door || "" }] }) },
  { id: "whisper", label: "A whisper when looked at", icon: "say", hint: "looking at something for a moment, a whisper from somewhere",
    blanks: [{ key: "look", label: "When the player looks at", kind: "thing" }, { key: "line", label: "The whisper", kind: "line" }, { key: "at", label: "From", kind: "thing" }],
    build: (v, S, id) => ({ id: id("b_whisper"), when: { look: v.look || "", secs: 1 }, optional: true, do: [{ trick: "whisper", line: v.line || "", at: v.at || "" }] }) },
  { id: "speaks", label: "She speaks on entering", icon: "say", hint: "a line from the Database as the player comes in",
    blanks: [{ key: "zone", label: "When the player enters", kind: "zone" }, { key: "line", label: "The line", kind: "line" }],
    build: (v, S, id) => ({ id: id("b_says"), when: { enter: v.zone || "" }, do: [{ say: v.line || "" }] }) },
  { id: "checkpoint", label: "A checkpoint", icon: "save", hint: "the game saves when the player gets here",
    blanks: [{ key: "zone", label: "When the player enters", kind: "zone" }],
    build: (v, S, id) => ({ id: id("b_save"), when: { enter: v.zone || "" }, do: [{ checkpoint: true }] }) },
  // the little things (docs/IMMERSION.md): their lives do the rest (the kettle boils by itself, the phone rings on)
  { id: "kettle_on", label: "A kettle put on (it boils by itself)", icon: "life", hint: "as the player comes in, a kettle starts heating: it rumbles, steams and clicks off by itself",
    blanks: [{ key: "zone", label: "When the player enters", kind: "zone" }, { key: "kettle", label: "The kettle", kind: "life" }],
    build: (v, S, id) => ({ id: id("b_kettle"), when: { enter: v.zone || "" }, do: [{ state: v.kettle || "", to: "heating" }] }) },
  { id: "still_burning", label: "A cigarette still burning", icon: "life", hint: "someone was just here: a cigarette burning in the ashtray as the player comes in",
    blanks: [{ key: "zone", label: "When the player enters", kind: "zone" }, { key: "cigarette", label: "The cigarette (or its ashtray)", kind: "life" },
      { key: "thought", label: "What it makes them think", kind: "text", ph: "Still burning. Someone was just here." }],
    build: (v, S, id) => ({ id: id("b_burning"), when: { enter: v.zone || "" }, do: [{ state: v.cigarette || "", to: "lit" }, { wait: 1.5 }, { think: T(v.thought) || "Still burning. Someone was just here." }] }) },
  { id: "phone_rings", label: "The phone rings", icon: "life", hint: "a phone rings as the player comes in; E answers it (a beat that hears the use plays the call)",
    blanks: [{ key: "zone", label: "When the player enters", kind: "zone" }, { key: "phone", label: "The phone", kind: "life" }],
    build: (v, S, id) => ({ id: id("b_ring"), when: { enter: v.zone || "" }, do: [{ state: v.phone || "", to: "ringing" }] }) },
  { id: "tv_on", label: "The TV comes on by itself", icon: "life", hint: "static on the screen as the player comes in",
    blanks: [{ key: "zone", label: "When the player enters", kind: "zone" }, { key: "tv", label: "The TV", kind: "life" }],
    build: (v, S, id) => ({ id: id("b_tv"), when: { enter: v.zone || "" }, do: [{ state: v.tv || "", to: "static" }] }) },
  { id: "torch_flickers", label: "The flashlight flickers", icon: "torch", hint: "as the player comes in, their flashlight stutters, or dies (F only clicks till something says it works)",
    blanks: [{ key: "zone", label: "When the player enters", kind: "zone" }, { key: "how", label: "It", kind: "choice", opts: ["flicker", "dead"], labels: { flicker: "flickers", dead: "dies" } }],
    build: (v, S, id) => ({ id: id("b_torch"), when: { enter: v.zone || "" }, do: [{ torch: v.how || "flicker" }] }) },
  { id: "clock_stops", label: "The clock stops", icon: "life", hint: "looked at for a moment, the clock stops (its tick too)",
    blanks: [{ key: "clock", label: "The clock", kind: "life" }, { key: "thought", label: "What it makes them think", kind: "text", ph: "It's stopped." }],
    build: (v, S, id) => ({ id: id("b_clock"), when: { look: v.clock || "", secs: 2 }, optional: true, do: [{ state: v.clock || "", to: "stopped" }, { think: T(v.thought) || "It's stopped." }] }) },
];
export const TASK = Object.fromEntries(TASKS.map(t => [t.id, t])), BEAT = Object.fromEntries(BEATS.map(b => [b.id, b]));

function ider(S) {                                 // ids unique in the file, and among what's being built
  const taken = allIds(S);
  return stem => { let v = stem, n = 2; while (taken.has(v)) v = `${stem}_${n++}`; taken.add(v); return v; };
}
const slug = s => T(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 20) || "task";
const isDoor = x => "swing" in x || "locked_by" in x || "creak" in x || x.kind === "door";
function setOn(S, id, key, value, where) {        // the level's thing with this id (a prop, an opening's door) gets a field
  if (!id || value === undefined || value === null || value === "") return false;
  const walk = (x, k) => { if (Array.isArray(x)) return x.some(y => walk(y, k)); if (!x || typeof x !== "object") return false;
    if (x.id === id && where(x, k)) { x[key] = value; return true; } return Object.entries(x).some(([kk, y]) => walk(y, kk)); };
  return walk(S.levels || {}, null);
}
const lockDoor = (S, door, item) => setOn(S, door, "locked_by", item, isDoor);   // the level's door gets the key that opens it
export function buildTask(S, tpl, values, { level = null } = {}) {
  const id = ider(S), st = tpl.build(values, S, id), tid = id("t_" + tpl.id);
  st.level = level || Object.keys(S.levels || {})[0];
  if (st.play && st.play.seeker === undefined) delete st.play.seeker;
  (S.stitches = S.stitches || {})[tid] = st;
  if (tpl.level) tpl.level(values, S);
  return { tid, stitch: st, round: tpl.round || null, id };
}
export function buildBeat(S, tpl, values) { return tpl.build(values, S, ider(S)); }

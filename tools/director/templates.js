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
  { id: "clock_stops", label: "The clock stops", icon: "life", hint: "looked at for a moment, the clock stops (its tick too)",
    blanks: [{ key: "clock", label: "The clock", kind: "life" }, { key: "thought", label: "What it makes them think", kind: "text", ph: "It's stopped." }],
    build: (v, S, id) => ({ id: id("b_clock"), when: { look: v.clock || "", secs: 2 }, optional: true, do: [{ state: v.clock || "", to: "stopped" }, { think: T(v.thought) || "It's stopped." }] }) },
];
export const TASK = Object.fromEntries(TASKS.map(t => [t.id, t])), BEAT = Object.fromEntries(BEATS.map(b => [b.id, b]));

function ider(S) {                                 // ids unique in the file, and among what's being built
  const taken = allIds(S);
  return stem => { let v = stem, n = 2; while (taken.has(v)) v = `${stem}_${n++}`; taken.add(v); return v; };
}
function lockDoor(S, door, item) {                 // the level's door gets the key that opens it
  if (!door || !item) return false;
  const walk = x => { if (Array.isArray(x)) return x.some(walk); if (!x || typeof x !== "object") return false; if (x.id === door && ("swing" in x || "locked_by" in x || "creak" in x || x.kind === "door")) { x.locked_by = item; return true; } return Object.values(x).some(walk); };
  return walk(S.levels || {});
}
export function buildTask(S, tpl, values, { level = null } = {}) {
  const id = ider(S), st = tpl.build(values, S, id), tid = id("t_" + tpl.id);
  st.level = level || Object.keys(S.levels || {})[0];
  if (st.play && st.play.seeker === undefined) delete st.play.seeker;
  (S.stitches = S.stitches || {})[tid] = st;
  if (tpl.level) tpl.level(values, S);
  return { tid, stitch: st, round: tpl.round || null, id };
}
export function buildBeat(S, tpl, values) { return tpl.build(values, S, ider(S)); }

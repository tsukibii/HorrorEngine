// Conditions: a beat's or an act choice's `when` (docs/STORY_FORMAT.md §4). The runtime sends events as they happen
// ({type: "enter", id}, {type: "use", id}, {type: "pickup", item}...) and a "tick" every frame for the ones that
// hold over time (a flag, after, look).
import { register, part, verbOf } from "./parts.js";
import { ticked, failed } from "./todo.js";

export function matches(when, ev, rt) {
  const v = verbOf("condition", when);
  return v ? part("condition", v).test(when[v], when, ev, rt) : false;
}

const on = (type, field = "id") => ({ test: (v, w, ev) => ev.type === type && ev[field] === v });
register("condition", "start", { test: (v, w, ev) => ev.type === "start" });
register("condition", "enter", on("enter"));               // a room or a trigger volume
register("condition", "exit", on("exit"));
register("condition", "use", on("use"));
register("condition", "pickup", on("pickup", "item"));
register("condition", "read", on("read", "note"));
register("condition", "caught", { test: (v, w, ev) => ev.type === "caught" && (v === true || v === ev.by) });   // by anyone, or by that cast member
register("condition", "hidden", { test: (v, w, ev, rt) => !!rt.player.hiding && (v === true || v === rt.player.hiding) });   // in any or that hiding place
register("condition", "answered", { test: (v, w, ev) => ev.type === "answered" && ev.ask === v && (w.option === undefined || ev.option === w.option) });   // an ask, any or that answer
register("condition", "flag", { test: (v, w, ev, rt) => rt.flags.has(v) });
register("condition", "after", {                            // another beat ended, plus `secs`
  test: (v, w, ev, rt) => ev.type === "tick" && rt.ended[v] !== undefined && rt.clock - rt.ended[v] >= +(w.secs || 0) });
register("condition", "look", {                             // looked at for `secs`, from within `within` metres
  settings: { secs: 1, within: 8 },
  test: (v, w, ev, rt) => ev.type === "tick" && rt.lookedAt(v, +(w.within ?? 8)) >= +(w.secs ?? 1) });
register("condition", "rolled", {                         // a die settled: any face, `face`, or `at_least`
  test: (v, w, ev) => ev.type === "rolled" && ev.id === v && (w.face === undefined || ev.face === w.face) && (w.at_least === undefined || ev.face >= w.at_least) });
register("condition", "torch", { test: (v, w, ev) => ev.type === "torch" && v === (ev.on ? "on" : "off") });   // the player switched the flashlight (F) on, or off
register("condition", "carrying", { test: (v, w, ev, rt) => !!rt.carried && (v === true || v === rt.carried.id) });   // in the hand (the inventory's one): anything, or that; holds while it is
register("condition", "dropped", {                        // put down (G): anywhere, or `in` a room or a trigger
  test: (v, w, ev) => ev.type === "dropped" && ev.id === v && (w.in === undefined || ev.in.includes(w.in)) });
register("condition", "played", { test: (v, w, ev) => ev.type === "played" && ev.id === v && (w.result === undefined || ev.result === w.result) });   // a board game ended: any result, or that one
register("condition", "state", { test: (v, w, ev, rt) => rt.stateOf(v) === w.is });   // a little thing in that state: holds while it is (docs/IMMERSION.md)
register("condition", "ticked", { test: (v, w, ev, rt) => ticked(rt.todo.list, v) });   // a task ticked, or (true) the list through; holds
register("condition", "failed", { test: (v, w, ev, rt) => failed(rt.todo.list, v) });   // a task failed, or (true) any; holds
register("condition", "arrived", { test: (v, w, ev, rt) => { const n = rt.npcs[v]; return !!(n && n.as === "go" && n.st.arrived && (w.at === undefined || n.st.arrived === w.at)); } });   // she's got where she was going (behave go); holds while she's there
register("condition", "all", { test: (v, w, ev, rt) => v.every(c => matches(c, ev, rt)) });
register("condition", "any", { test: (v, w, ev, rt) => v.some(c => matches(c, ev, rt)) });

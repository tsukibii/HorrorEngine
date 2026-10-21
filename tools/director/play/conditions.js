// Conditions: a beat's or an act choice's `when` (docs/STORY_FORMAT.md §4). The runtime sends events as they happen
// ({type: "enter", id}, {type: "use", id}, {type: "pickup", item}...) and a "tick" every frame for the ones that
// hold over time (a flag, after, look).
import { register, part, verbOf } from "./parts.js";

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
register("condition", "caught", { test: (v, w, ev) => ev.type === "caught" });
register("condition", "flag", { test: (v, w, ev, rt) => rt.flags.has(v) });
register("condition", "after", {                            // another beat ended, plus `secs`
  test: (v, w, ev, rt) => ev.type === "tick" && rt.ended[v] !== undefined && rt.clock - rt.ended[v] >= +(w.secs || 0) });
register("condition", "look", {                             // looked at for `secs`, from within `within` metres
  settings: { secs: 1, within: 8 },
  test: (v, w, ev, rt) => ev.type === "tick" && rt.lookedAt(v, +(w.within ?? 8)) >= +(w.secs ?? 1) });
register("condition", "rolled", {                         // a die settled: any face, `face`, or `at_least`
  test: (v, w, ev) => ev.type === "rolled" && ev.id === v && (w.face === undefined || ev.face === w.face) && (w.at_least === undefined || ev.face >= w.at_least) });
register("condition", "all", { test: (v, w, ev, rt) => v.every(c => matches(c, ev, rt)) });
register("condition", "any", { test: (v, w, ev, rt) => v.some(c => matches(c, ev, rt)) });

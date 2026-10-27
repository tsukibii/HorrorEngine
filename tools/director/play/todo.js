// The to-do list (docs/STORY_FORMAT.md §4, DECISIONS 2026-10-27, late night): a shift's chores, a request, anything
// the player has to do, ticked off in any order. Each task: {id, text, state: open | done | failed}, and what moves it
// by itself: `ticks` (a trigger that ticks it: the kettle boiled), `fails` (a trigger that fails it: she caught you),
// `secs` (it fails when the time's up), `on` ({done: [actions], failed: [actions]}). Kept with the run, so a list goes
// on through the stitches (a night's chores) until `untodo` takes a task, or all of them, off.
import { matches } from "./conditions.js";
import { runAll } from "./actions.js";

export const STATES = ["open", "done", "failed"];

// the list's items, plain data (the run keeps them, a checkpoint copies them)
export function todoAdd(list, a, now) {
  const id = a.todo, old = list.find(t => t.id === id);
  const t = { id, text: a.text || String(id).replace(/_/g, " "), state: "open", at: now };
  for (const k of ["ticks", "fails", "secs", "on", "who"]) if (a[k] !== undefined) t[k] = a[k];
  if (old) Object.assign(old, t); else list.push(t);
  return old || t;
}
export const todoOf = (list, id) => list.find(t => t.id === id) || null;
// `ticked`: that task ticked, or (true) the list through: nothing open, at least one task
export const ticked = (list, v) => v === true ? list.length > 0 && list.every(t => t.state !== "open") : (todoOf(list, v) || {}).state === "done";
// `failed`: that task failed, or (true) any of them
export const failed = (list, v) => v === true ? list.some(t => t.state === "failed") : (todoOf(list, v) || {}).state === "failed";

// in Play: the run's list, its HUD, its own triggers and timers
export class Todo {
  constructor(rt) {
    this.rt = rt;
    this.list = rt.run ? (rt.run.todo = rt.run.todo || []) : [];
    this.show();
  }
  add(a) { todoAdd(this.list, a, this.rt.clock); this.show(true); }
  set(id, state) {                                  // tick or fail an open task: its `on` runs, and it's heard
    const t = todoOf(this.list, id);
    if (!t || t.state !== "open") return;
    t.state = state; this.show(true);
    this.rt.emit({ type: "todo", id, state });
    runAll((t.on || {})[state], this.rt);
  }
  remove(v) {
    if (v === true) this.list.splice(0); else { const i = this.list.findIndex(t => t.id === v); if (i >= 0) this.list.splice(i, 1); }
    this.show();
  }
  event(ev) {                                       // every event: an open task's `ticks` or `fails`, its time running out
    for (const t of this.list.filter(t => t.state === "open")) {
      if (t.ticks && matches(t.ticks, ev, this.rt)) this.set(t.id, "done");
      else if (t.fails && matches(t.fails, ev, this.rt)) this.set(t.id, "failed");
      else if (t.secs && ev.type === "tick" && this.rt.clock - t.at >= +t.secs) this.set(t.id, "failed");
    }
    if (ev.type === "tick" && this.list.some(t => t.state === "open" && t.secs)) this.show();
  }
  show(fresh) {
    this.rt.hud.todo(this.list.map(t => ({ id: t.id, text: t.text, state: t.state,
      left: t.secs && t.state === "open" ? Math.max(0, +t.secs - (this.rt.clock - t.at)) : null })), fresh);
  }
}

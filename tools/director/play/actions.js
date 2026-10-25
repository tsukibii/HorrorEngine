// Actions: a beat's `do`, one verb each (docs/STORY_FORMAT.md §4). A verb with no part yet shows on the HUD's log as
// "not in Play yet", so a stitch still runs end to end and the gap is visible.
import { register, part, verbOf } from "./parts.js";
import { addKarma } from "../stage.js";

export async function run(act, rt) {
  const v = verbOf("action", act);
  if (!v) { rt.hud.log(`not in Play yet: ${Object.keys(act)[0]}`); return; }
  await part("action", v).run(act[v], act, rt);
}
export async function runAll(acts, rt) { for (const a of acts || []) { if (!rt.active) return; await run(a, rt); } }

const lineSecs = t => Math.min(6, 1.2 + String(t || "").length / 14);
register("action", "objective", { run: (v, a, rt) => rt.hud.objective(v) });
register("action", "think", { run: (v, a, rt) => rt.hud.line(v, "", lineSecs(v)) });
register("action", "say", { run: (v, a, rt) => rt.hud.line(a.line || v, a.who ? ((rt.story.cast || {})[a.who] || {}).name || a.who : "", lineSecs(a.line || v)) });
// ask: a question with 2 to 4 answers, floating beside `who` (or at `on`, a thing; else under the reticle) while the
// question (`line`, spoken, or `text`, a thought) is the footer's line. Each answer's `do` runs, and `answered` is heard
// ({"answered": ask id, "option": its id}). `secs` times it; `default` is taken when time runs out
register("action", "ask", {
  run: async (v, a, rt) => {
    const opts = a.options || [], l = a.line && (rt.story.lines || {})[a.line];
    const i = await rt.choose({ prompt: l ? l.en || l.ja : a.text, ja: l && l.en ? l.ja : null, who: a.who || (l && l.who), on: a.on,
      options: opts.map(o => ({ label: o.label || o.id, sub: o.ja })), secs: a.secs, def: Math.max(0, opts.findIndex(o => o.id === a.default)) });
    const o = opts[i]; if (!o) return;
    rt.emit({ type: "answered", ask: v, option: o.id });
    await runAll(o.do, rt);
  },
});
register("action", "flag", { run: (v, a, rt) => rt.setFlag(v) });
register("action", "unflag", { run: (v, a, rt) => rt.flags.delete(v) });
register("action", "give", { run: (v, a, rt) => rt.give(v) });
register("action", "take", { run: (v, a, rt) => rt.items.delete(v) });
register("action", "karma", { run: (v, a, rt) => rt.run && addKarma(rt.run.karma, v) });
register("action", "count", { run: (v, a, rt) => { if (!rt.run) return; const c = rt.run.counters; c[v] = a.set !== undefined ? +a.set : (c[v] || 0) + +(a.add ?? 1); } });
register("action", "state", { run: (v, a, rt) => rt.setState(v, a.to) });      // a little thing to a state: {"state": "kettle", "to": "heating"}
register("action", "show", { run: (v, a, rt) => rt.setVisible(v, true) });
register("action", "hide", { run: (v, a, rt) => rt.setVisible(v, false) });
register("action", "door", { run: (v, a, rt) => rt.door(v, a.set || "open") });
register("action", "light", { run: (v, a, rt) => rt.light(v, a.room, a.set || "on") });
register("action", "wait", { run: (v, a, rt) => rt.wait(+v || 0) });
register("action", "fade", { run: (v, a, rt) => rt.fade(v === "out" ? 1 : 0, +(a.secs ?? 1)) });
register("action", "lookat", { run: (v, a, rt) => rt.lookAt(v, +(a.secs ?? 1)) });
register("action", "sound", { run: (v, a, rt) => rt.hud.log(`♪ ${v}${a.at ? " at " + a.at : ""}`) });
register("action", "music", { run: (v, a, rt) => rt.hud.log(`music: ${v}`) });
register("action", "checkpoint", { run: (v, a, rt) => rt.hud.log("checkpoint") });
register("action", "done", { run: (v, a, rt) => rt.finish() });
register("action", "scene", { run: (v, a, rt) => rt.scene(v) });          // a triggered scene, then play goes on
register("action", "behave", { run: (v, a, rt) => rt.behave(v, a) });      // a cast member's behaviour: {"behave": "mari", "as": "path", "route": ...}

// tricks (docs/TRICKS.md §2): the ones Play can show now; the rest are logged
const TRICKS = {
  slam_behind: (a, rt) => { rt.door(a.door, "slam"); },
  knock: (a, rt) => rt.hud.log(`♪ knock ×${a.count || 3}${a.at ? " at " + a.at : ""}`),
  whisper: (a, rt) => rt.hud.line(rt.lineText(a.line) || "(a whisper)", "", 2.5),
  glimpse: async (a, rt) => { rt.setVisible(a.figure, true); await rt.wait(+(a.secs ?? 0.6)); rt.setVisible(a.figure, false); },
  lights_die: async (a, rt) => { rt.light(null, a.room, "off"); await rt.wait(+(a.secs ?? 1)); rt.light(null, a.room, "on"); },
};
register("action", "trick", { run: (v, a, rt) => (TRICKS[v] ? TRICKS[v](a, rt) : rt.hud.log(`trick not in Play yet: ${v}`)) });

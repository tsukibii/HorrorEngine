// Interactables: what a prop's `use` does when the player uses it (docs/STORY_FORMAT.md §2). Each gives the cursor
// its look and the prompt's label, and every use sends a `use` event (beats and act choices hear it) before its own.
// `cursor` is a name the HUD's theme draws (play/ui/themes/*.css).
import { register, part } from "./parts.js";
import { EYES } from "../stage.js";

export function interactableOf(thing, rt) {
  const u = thing.userData, p = part("interactable", u.kind === "door" ? "door" : u.use);
  if (p) return p;
  return rt && rt.lifeActs && rt.lifeActs(u.id).length ? part("interactable", "life") : null;   // a little thing with something to do
}

const panelText = (title, text) => ({ title, text });
register("interactable", "inspect", {
  settings: { cursor: "look", label: "Look" },
  prompt: (t, rt, s) => ({ cursor: s.cursor, label: s.label }),
  use: (t, rt) => rt.panel(panelText(rt.nameOf(t), (t.userData.piece.d || {}).text || "")),
});
register("interactable", "note", {
  settings: { cursor: "read", label: "Read" },
  prompt: (t, rt, s) => ({ cursor: s.cursor, label: s.label }),
  use: async (t, rt) => {
    const id = (t.userData.piece.d || {}).note, n = (rt.story.notes || {})[id] || {};
    rt.emit({ type: "read", note: id });
    await rt.panel(panelText(n.title || id, n.text || ""));
  },
});
register("interactable", "pickup", {
  settings: { cursor: "take", label: "Take" },
  prompt: (t, rt, s) => ({ cursor: s.cursor, label: s.label }),
  use: (t, rt) => {
    const item = (t.userData.piece.d || {}).item;
    rt.setVisible(t.userData.id, false);
    if (item) { rt.give(item); rt.emit({ type: "pickup", item }); }
  },
});
register("interactable", "door", {
  settings: { cursor: "open", label: "Open", close: "Close", locked: "Locked" },
  prompt: (t, rt, s) => {
    const d = rt.doorOf(t.userData.id);
    if (d.locked && !rt.canUnlock(d)) return { cursor: "locked", label: s.locked };
    return { cursor: s.cursor, label: d.open ? s.close : s.label };
  },
  use: (t, rt, s) => {
    const d = rt.doorOf(t.userData.id);
    if (d.locked) {
      if (!rt.canUnlock(d)) { rt.hud.shake(); rt.hud.line(s.locked + ".", "", 1.2); return; }
      d.locked = false;
      if (d.by && !d.by.startsWith("flag:")) rt.hud.log(`used: ${rt.itemName(d.by)}`);
    }
    rt.door(t.userData.id, d.open ? "close" : "open");
  },
});
register("interactable", "combo", {                // a code lock: the free cursor types it; the right code sets `then`
  settings: { cursor: "use", label: "Enter the code" },
  prompt: (t, rt, s) => ({ cursor: s.cursor, label: rt.flags.has((t.userData.piece.d || {}).then) ? "Open" : s.label }),
  use: async (t, rt) => {
    const d = t.userData.piece.d || {};
    if (rt.flags.has(d.then)) return;
    const got = await rt.panel({ title: rt.nameOf(t), code: String(d.code || "").length || 4 });
    if (got === String(d.code)) { rt.setFlag(d.then); rt.hud.line("It opens.", "", 1.5); }
    else if (got !== null) { rt.hud.shake(); rt.hud.line("Wrong.", "", 1); }
  },
});
register("interactable", "switch", {
  settings: { cursor: "use", label: "Switch" },
  prompt: (t, rt, s) => ({ cursor: s.cursor, label: s.label }),
  use: (t, rt) => rt.light(null, t.userData.piece.room, "toggle"),
});
register("interactable", "sit", {                 // a chair, a sofa, a bed's edge: E sits, E stands (runtime.sit)
  settings: { cursor: "sit", label: "Sit", stand: "Stand up", eye: EYES.sit, secs: 0.6 },
  prompt: (t, rt, s) => ({ cursor: s.cursor, label: rt.player.seat === t ? s.stand : s.label }),
  use: (t, rt, s) => (rt.player.seat === t ? rt.stand(s) : rt.sit(t, s)),
});
register("interactable", "sleep", {               // a bed: E lies the player down on it and the view goes dark (runtime.sleep); the story's beat on its use plays the next chapter
  settings: { cursor: "sit", label: "Sleep", notYet: "Not tired yet", thought: "I'm not tired yet.", eye: 0.14, mattress: 0.55, pitch: 55, secs: 1.1, dark: 1.4, wake: 1.0 },   // eye: over the mattress (at most `mattress` m up); pitch: looking up
  prompt: (t, rt, s) => (rt.ready(t) ? { cursor: s.cursor, label: s.label } : { cursor: "locked", label: s.notYet }),
  use: (t, rt, s) => {                             // not ready (its `if` flags): a thought, and the story hears nothing
    if (!rt.ready(t)) { rt.hud.shake(); rt.hud.line((t.userData.piece.d || {}).not_yet || s.thought, "", 1.6); return false; }
    return rt.sleep(t, s);
  },
});
register("interactable", "roll", {                // a die: E throws it from your hand; its face is read when it settles
  settings: { cursor: "take", label: "Roll", speed: 2.6, lift: 1.2, spin: 14 },  // m/s along the look, m/s up, rad/s
  prompt: (t, rt, s) => (rt.physics && rt.physics.rolling(t) ? { cursor: "none", label: "" } : { cursor: "roll", label: s.label }),
  use: (t, rt, s) => { if (!(rt.physics && rt.physics.rolling(t))) rt.roll(t, s); },
});
register("interactable", "carry", {               // a plushie, a box: hold E to pick it up (runtime.pickUp), hold E again to put it down
  settings: { cursor: "take", label: "Pick up", drop: "Put down", hold: 0.45 },   // hold: the seconds E is held, both ways
  prompt: (t, rt, s) => ({ cursor: s.cursor, label: s.label, hold: true }),
  use: () => {},                                   // a tap does nothing: it takes a hold
});
register("interactable", "game", {                // a table with a board game: E sits you down to play it (runtime.boardGame; the rules in Content/Studio/BoardGames/)
  settings: { cursor: "use", label: "Play", eye: EYES.sit, secs: 0.7, back: 0.22, house: "The dealer" },   // back: the eye from the table's edge, leaning in
  prompt: (t, rt, s) => ({ cursor: s.cursor, label: s.label }),
  use: (t, rt, s) => rt.boardGame(t, s),
});
register("interactable", "hide", {                // a locker, a wardrobe: E gets in (runtime.hide), E gets out
  settings: { cursor: "hide", label: "Hide", leave: "Get out", eye: EYES.hide, secs: 0.7, look: [70, 35] },   // look: yaw, pitch cone (deg)
  prompt: (t, rt, s) => ({ cursor: s.cursor, label: rt.player.hiding === t.userData.id ? s.leave : s.label }),
  use: (t, rt, s) => (rt.player.hiding === t.userData.id ? rt.unhide(s) : rt.hide(t, s)),
});
register("interactable", "locker", Object.assign({}, part("interactable", "hide")));     // the format's word for it
register("interactable", "life", {                // a little thing (docs/IMMERSION.md): E does what its state offers (switch the kettle on, put the cigarette out, pour)
  settings: { cursor: "use" },
  prompt: (t, rt, s) => { const a = rt.lifeActs(t.userData.id)[0]; return { cursor: s.cursor, label: a ? a.label : "" }; },
  use: (t, rt) => { const a = rt.lifeActs(t.userData.id)[0]; if (a) rt.setState(t.userData.id, a.to, "player"); },
});

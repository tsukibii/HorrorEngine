// Interactables: what a prop's `use` does when the player uses it (docs/STORY_FORMAT.md §2). Each gives the cursor
// its look and the prompt's label, and every use sends a `use` event (beats and act choices hear it) before its own.
// `cursor` is a name the HUD's theme draws (play/ui/themes/*.css).
import { register, part } from "./parts.js";
import { EYES } from "../stage.js";

export function interactableOf(thing) {
  const u = thing.userData;
  return part("interactable", u.kind === "door" ? "door" : u.use) || null;
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
register("interactable", "locker", {              // hiding comes with stealth (GAMEPLAY_PLAN §8 step 4); the use is heard now
  settings: { cursor: "hide", label: "Hide" },
  prompt: (t, rt, s) => ({ cursor: s.cursor, label: s.label }),
  use: () => {},
});
register("interactable", "hide", Object.assign({}, part("interactable", "locker")));

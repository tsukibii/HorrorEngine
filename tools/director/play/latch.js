// The latch (DECISIONS 2026-10-28, later: a shift ends locking up): a door with `latch: true` has a thumb turn on the
// face of the room that holds it. A click on the turn locks the door (shut first) or unlocks it, its bar turned across
// or upright and the shelf's latch heard; from that side a click on the locked door unlocks it too. From the other side
// it's locked (its `locked_by` key, if it has one, still opens it). It undoes only its own lock: a door the story locked
// (it slams and locks behind you) or one its key opens stays locked, and the turn won't turn. The story hears
// {"locked": door} while it's locked, by anything.
import * as THREE from "three";
import { register } from "./parts.js";

register("interactable", "latch", {
  settings: { cursor: "use", lock: "Lock", unlock: "Unlock", shut: "Close it first", stuck: "Locked" },
  prompt: (t, rt, s) => { const d = rt.doorOf(t.userData.door);
    return d.open ? { cursor: "locked", label: s.shut } : d.locked && !d.latched ? { cursor: "locked", label: s.stuck } : { cursor: s.cursor, label: d.latched ? s.unlock : s.lock }; },
  use: (t, rt) => { const d = rt.doorOf(t.userData.door); if (!d.open && !(d.locked && !d.latched)) rt.latch(t.userData.door, !d.latched); return false; },   // heard as locked, not a use
});

// the thumb turn on one face of a door's leaf, by its handle (away from the hinge), on a clear disc a hand wide that the
// reticle finds; it rides the leaf as a peephole's lens does (followLeaf)
export function latchFor(door, side) {
  const g = door.geometry.parameters || {}, w = g.width || 0.9, h = g.height || 2.05, d = g.depth || 0.05, sw = door.userData.swing || {};
  const hingeX = sw.pivot ? sw.pivot.x : -w / 2, x = (hingeX <= 0 ? 1 : -1) * Math.max(0, w / 2 - 0.09);
  const z = typeof sw.handleZ === "number" && sw.handleZ > 0.6 && sw.handleZ < 1.4 ? sw.handleZ + 0.16 : 1.12;   // a hand above the handle
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.004, 20), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  const brass = new THREE.MeshStandardMaterial({ color: 0x8a8273, metalness: 0.85, roughness: 0.32 });
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.027, 0.008, 24), brass), bar = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, 0.042), brass);
  bar.position.y = 0.011; rose.add(bar); m.add(rose);                // the bar upright: open; across: locked (turned on its rose)
  m.userData = { id: `${door.userData.id}:latch`, use: "latch", door: door.userData.id, piece: { d: { name: "latch" }, tags: [] },
                 local: new THREE.Vector3(x, -h / 2 + z, side * (d / 2 + 0.006)), side, bar };
  return m;
}
export const turnBar = (latch, locked) => { latch.userData.bar.rotation.y = locked ? Math.PI / 2 : 0; };

// The peephole (DECISIONS 2026-10-28): a door with `peephole` has a little lens in its leaf at eye height, on both
// faces. A click on it puts the eye to it: the view is the other side through a wide lens in a round, dark-rimmed
// hole (hud.css .peep), with a little room to look about; a click, a step or Esc's pause takes the eye away. While the
// eye is there the story's {"peeping": door} holds: the visitor who isn't there, then is.
import * as THREE from "three";
import { register } from "./parts.js";

export const LENS = { z: 1.52, r: 0.011, hit: 0.06, fov: 118 };   // its height on the leaf (m; the door's own `peephole` number over it), its radius, what the reticle finds, the view's vertical angle

register("interactable", "peephole", {
  settings: { cursor: "look", label: "Look through", look: [32, 22], secs: 0.35 },   // look: yaw, pitch room (deg)
  prompt: (t, rt, s) => ({ cursor: s.cursor, label: s.label }),
  use: (t, rt, s) => { rt.peep(t.userData.door, s); return false; },   // the story hears `peeping` while the eye is there, not a use
});

// the lens on each face of a door's leaf: a brass ring round dark glass, on a clear disc a hand wide that the reticle
// finds (a lens a centimetre across is too small to aim at)
export function lensesFor(door, z) {
  const g = door.geometry.parameters || {}, h = g.height || 2.05, d = g.depth || 0.05, out = [];   // the leaf's middle, `z` up from its foot
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(LENS.hit, LENS.hit, 0.004, 20), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(LENS.r, LENS.r * 1.25, 0.012, 20), new THREE.MeshStandardMaterial({ color: 0x8a8273, metalness: 0.85, roughness: 0.32 }));
    const glass = new THREE.Mesh(new THREE.CircleGeometry(LENS.r * 0.55, 16), new THREE.MeshStandardMaterial({ color: 0x0a0c10, metalness: 0.2, roughness: 0.05 }));
    glass.position.y = 0.0065; glass.rotation.x = -Math.PI / 2; ring.add(glass); m.add(ring);
    m.userData = { id: `${door.userData.id}:peephole`, use: "peephole", door: door.userData.id, piece: { d: { name: "peephole" }, tags: [] },
                   local: new THREE.Vector3(0, -h / 2 + z, side * (d / 2 + 0.006)), side };
    out.push(m);
  }
  return out;
}
// each lens rides its leaf (the door swings): its place and turn from the leaf's own every frame
export function followLeaf(lens, door) {
  door.updateMatrixWorld();
  lens.position.copy(door.localToWorld(lens.userData.local.clone()));
  lens.quaternion.copy(door.getWorldQuaternion(new THREE.Quaternion())).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), lens.userData.side * Math.PI / 2));
}

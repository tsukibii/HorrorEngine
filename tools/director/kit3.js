// The kit in three.js: a built kit thing as a Group, a material per slot (shared, flat colours: the look comes later,
// in Unreal). Story space (x, y, z up) becomes three's (x, z, -y), as the stage's s2t; the base sits at y = 0.
import * as THREE from "three";
import * as KIT from "./kit.js";

const MATS = {};
export function material(slot) {
  if (MATS[slot]) return MATS[slot];
  const base = KIT.slotOf(slot), [col, rough = 0.6, metal = 0, op = 1, emit] = KIT.SLOTS[base];
  const m = new THREE.MeshStandardMaterial({ color: col, roughness: rough, metalness: metal, transparent: op < 1, opacity: op, depthWrite: op >= 1,
    emissive: emit ? col : 0x000000, emissiveIntensity: emit ? 0.9 : 0, side: op < 1 ? THREE.DoubleSide : THREE.FrontSide });
  if (base !== slot && !KIT.SLOTS[slot]) {           // a custom slot name: the base colour, nudged so it reads apart
    let h = 0; for (const c of slot) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    m.color.offsetHSL(((h % 100) - 50) / 2000, 0, ((h >> 8) % 20 - 10) / 200);
  }
  return (MATS[slot] = m);
}
export function geometries(G) {
  const out = {};
  for (const [slot, g] of Object.entries(G)) {
    const n = g.pos.length / 3; if (!n) continue;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = g.pos[i * 3]; pos[i * 3 + 1] = g.pos[i * 3 + 2]; pos[i * 3 + 2] = -g.pos[i * 3 + 1];
      nrm[i * 3] = g.nrm[i * 3]; nrm[i * 3 + 1] = g.nrm[i * 3 + 2]; nrm[i * 3 + 2] = -g.nrm[i * 3 + 1];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.uv), 2));
    geo.setIndex(g.idx);
    out[slot] = geo;
  }
  return out;
}
// a spec (or a build) as a Group; {shadows} casts and takes them; userData.built is the build
export function object(specOrBuilt, presets, o = {}) {
  const b = specOrBuilt && specOrBuilt.parts ? specOrBuilt : KIT.build(specOrBuilt, presets);
  const grp = new THREE.Group();
  for (const [slot, geo] of Object.entries(geometries(KIT.mesh(b.parts)))) {
    const m = new THREE.Mesh(geo, material(slot));
    if (o.shadows) { m.castShadow = true; m.receiveShadow = true; }
    m.userData.slot = slot;
    grp.add(m);
  }
  grp.userData.built = b;
  return grp;
}
export function dispose(obj) { obj.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }

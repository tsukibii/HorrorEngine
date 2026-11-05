// Parts that open (docs/PROPGEN.md §26; DECISIONS 2026-11-05, later): a made prop's lid, its doors, a book's cover,
// spread and block, each a node of its own in the glb with `propgen_part` extras (three.js's GLTFLoader keeps a node's
// extras in its userData): its kind (`hinge`: the axis the hinge line, open and shut in degrees; `slide`: the axis
// the way it slides, open and shut in metres; `show`: seen only while open, a book's spread; `hide`: seen only while
// shut, the closed book's block), and `built`, the state the glb holds it in. The runtime keeps each thing's state s,
// 0 shut to 1 open, and moves its parts between them over a moment: the `open`, `container`, `hide` and `book` uses,
// the story's `open` action. The same records on a copy of the thing (a book in the hands). Godot: parts.gd.
import * as THREE from "three";

const val = v => { if (typeof v === "string") { try { return JSON.parse(v); } catch (e) { return v; } } return v; };
const v3 = a => new THREE.Vector3(+a[0] || 0, +a[1] || 0, +a[2] || 0);

// every part under a node: {node, name, kind, axis, pivot, open, shut, built, hideOpen, base: its place and turn as imported}
export function scanParts(root) {
  const out = [];
  root.traverse(n => {
    const p = n.userData && n.userData.propgen_part !== undefined ? val(n.userData.propgen_part) : null;
    if (!p || typeof p !== "object") return;
    out.push({ node: n, name: String(p.name || n.name), kind: String(p.kind || "hinge"), axis: v3(p.axis || [0, 1, 0]).normalize(), pivot: v3(p.pivot || [0, 0, 0]),
               open: +(p.open ?? 1), shut: +(p.shut ?? 0), built: +(p.built ?? 0), hideOpen: !!p.hide_open,
               base: { pos: n.position.clone(), quat: n.quaternion.clone() } });
  });
  return out;
}

// what the prop's root says: a container's inside box (`inside`: [lo, hi] in that root's space, metres, y up), a book's
// page materials (`pages`) and binding (`book`); `root` the node that carries them (null without)
export function infoOf(root) {
  const out = { root: null, inside: null, pages: null, book: null };
  root.traverse(n => {
    if (out.root || !n.userData) return;
    for (const k of ["propgen_inside", "propgen_pages", "propgen_book"]) if (n.userData[k] !== undefined) { out.root = n; out[k.slice(8)] = val(n.userData[k]); }
  });
  return out;
}

// every part at state s (0 shut, 1 open): a hinge turned about its axis, a slide moved along it, a show or a hide part shown or not
export function applyParts(parts, s) {
  for (const p of parts || []) {
    const n = p.node, v = p.shut + s * (p.open - p.shut);
    if (p.kind === "hinge") {
      n.quaternion.setFromAxisAngle(p.axis, (v - p.built) * Math.PI / 180).multiply(p.base.quat); n.position.copy(p.base.pos);
      if (p.hideOpen) n.visible = s < 0.999;
    } else if (p.kind === "slide") n.position.copy(p.base.pos).addScaledVector(p.axis, v - p.built);
    else if (p.kind === "show") n.visible = s > 0.5;
    else if (p.kind === "hide") n.visible = s < 0.5;
  }
}

// the hinges' and slides' sounds off the shelf: {open, close} by what the parts are
export function partSounds(parts, hint = "") {
  if (hint === "book") return { open: "book_open", close: "book_close" };
  if (hint === "container") return { open: "hinge_metal_01", close: "latch" };
  const hinge = parts.some(p => p.kind === "hinge"), slide = parts.some(p => p.kind === "slide");
  if (slide && !hinge) return { open: "drawer_01", close: "drawer_02" };
  return { open: "door_creak_02", close: "door_close_02" };
}

// things (or copies) between their states: a record {parts, openS} moved to `to` over secs (at once with secs 0), done at the end
export class Movers {
  constructor() { this.list = []; }
  go(rec, to, secs, done) {
    this.list = this.list.filter(m => m.rec !== rec);
    const from = +(rec.openS || 0);
    if (secs <= 0 || Math.abs(to - from) < 1e-4) { rec.openS = to; applyParts(rec.parts, to); if (done) done(); return; }
    this.list.push({ rec, from, to, t: 0, secs, done });
  }
  busy(rec) { return this.list.some(m => m.rec === rec); }
  tick(dt) {
    const done = [];
    for (const m of this.list) {
      m.t += dt; const u = Math.min(1, m.t / Math.max(0.01, m.secs)), k = 1 - (1 - u) * (1 - u);
      m.rec.openS = m.from + (m.to - m.from) * k; applyParts(m.rec.parts, m.rec.openS);
      if (u >= 1) done.push(m);
    }
    for (const m of done) { this.list.splice(this.list.indexOf(m), 1); if (m.done) m.done(); }
  }
}

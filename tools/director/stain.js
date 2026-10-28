// A stain (use: clean, DECISIONS 2026-10-28): a flat block drawn as a blot on whatever it lies on, its kind's colour
// and shine, ragged at the edge and patchy inside, drawn in code (no files) and seeded by its id so the same stain
// always looks the same. Play scrubs it away (play/clean.js: its opacity falls as it's cleaned); the desk shows it.
import * as THREE from "three";

// kind -> its colour (sRGB), how much of it covers (0..1), its roughness (wet ones shine)
export const STAINS = {                                 // darker than any floor they lie on: they read as stains, not paint
  dirt: { color: [34, 27, 20], cover: 0.85, rough: 0.95 },
  mud: { color: [30, 20, 12], cover: 0.95, rough: 0.7 },
  blood: { color: [50, 3, 5], cover: 1, rough: 0.28 },
  water: { color: [10, 12, 14], cover: 0.5, rough: 0.08 },
  ash: { color: [24, 23, 22], cover: 0.8, rough: 1 },
};
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function rand(seed) { let a = seed || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the blot: a few overlapping soft discs (its body), splashes round it, and speckle taken out of it (patchy)
function blot(kind, seed, px = 256) {
  const k = STAINS[kind] || STAINS.dirt, r = rand(seed), c = document.createElement("canvas"); c.width = c.height = px;
  const g = c.getContext("2d"), [R, G, B] = k.color;
  const disc = (x, y, rad, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${R},${G},${B},${a})`); gr.addColorStop(0.7, `rgba(${R},${G},${B},${a * 0.85})`); gr.addColorStop(1, `rgba(${R},${G},${B},0)`); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); };
  for (let i = 0; i < 9; i++) disc(px * (0.32 + r() * 0.36), px * (0.32 + r() * 0.36), px * (0.12 + r() * 0.16), k.cover * (0.55 + r() * 0.35));
  for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, d = px * (0.28 + r() * 0.18); disc(px / 2 + Math.cos(a) * d, px / 2 + Math.sin(a) * d, px * (0.01 + r() * 0.035), k.cover * 0.8); }
  g.globalCompositeOperation = "destination-out";                       // patchy: specks of it gone
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.25})`; g.beginPath(); g.arc(r() * px, r() * px, 1 + r() * px * 0.02, 0, Math.PI * 2); g.fill(); }
  g.globalCompositeOperation = "source-over";
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// the material a stain wears: its blot on top, nothing on its sides; drawn over the surface under it (no fighting)
export function stainMaterial(kind, id) {
  const k = STAINS[kind] || STAINS.dirt;
  return new THREE.MeshStandardMaterial({ map: blot(kind, hash(id)), transparent: true, depthWrite: false, roughness: k.rough, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}

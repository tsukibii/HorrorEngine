// The street in three.js (docs/STREET_BUILDER.md): street-gen.js's pieces as meshes (a group a piece, a mesh a
// material slot), each slot a flat colour, a pattern made in code (shutters, roof tiles, paving, chain-link...) or a
// PBR set off the shelf (`pbr/<name>` in the street's `look` or a piece's), at its real size (the UVs are metres);
// the signs' words drawn on canvases; the lamps' lights; the sky and the light by the time of day (day, dusk, night).
// Story space (x, y, z up) becomes three's (x, z, -y), as the stage's s2t.
import * as THREE from "three";
import * as SG from "./street-gen.js";

export const s2t = (x, y, z) => new THREE.Vector3(x, z, -y);
export const TIMES = {
  day: { label: "day", top: "#4f86c9", horizon: "#cfe0ec", ground: "#6d6a64", hemiSky: "#c5d8ec", hemiGround: "#5d5952", hemi: 1.15, sun: 2.6, sunColor: "#fff1df", sunEl: 48, sunAz: 140, lit: 0.08, lamps: false, exposure: 1.0, fog: 0.0035 },
  dusk: { label: "dusk", top: "#aeb2c8", horizon: "#ead3cf", ground: "#3d3a38", hemiSky: "#99b8c4", hemiGround: "#44393a", hemi: 1.6, sun: 0.0, sunColor: "#ffc9a0", sunEl: 4, sunAz: 250, lit: 1.0, lamps: true, exposure: 1.0, fog: 0.0065 },
  night: { label: "night", top: "#04060c", horizon: "#141b29", ground: "#0b0b0c", hemiSky: "#2a3550", hemiGround: "#101012", hemi: 0.22, sun: 0.0, sunColor: "#9fb3ff", sunEl: 40, sunAz: 200, lit: 1.25, lamps: true, exposure: 1.1, fog: 0.012 },
};

// ---- patterns made in code: a canvas each, cached; `tile` the metres one repeat covers --------------------------------
const CANVAS = {};
function canvas(w, h, draw) { const c = typeof document !== "undefined" ? document.createElement("canvas") : null; if (!c) return null; c.width = w; c.height = h; draw(c.getContext("2d"), w, h); return c; }
const PATTERNS = {
  shutter: { tile: 0.6, draw: (g, w, h) => { g.fillStyle = "#b8bec4"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) { g.fillStyle = "#8a9096"; g.fillRect(0, y, w, 2); g.fillStyle = "#cfd4d8"; g.fillRect(0, y + 3, w, 1); } } },
  tiles: { tile: 1.2, draw: (g, w, h) => { g.fillStyle = "#4a4f57"; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, "#2c3036"); gr.addColorStop(0.5, "#5b616a"); gr.addColorStop(1, "#2c3036"); g.fillStyle = gr; g.fillRect(x, 0, 16, h); } for (let y = 0; y < h; y += 20) { g.fillStyle = "rgba(10,10,12,.55)"; g.fillRect(0, y, w, 3); } } },
  pavement: { tile: 1.2, draw: (g, w, h) => { g.fillStyle = "#6f6b64"; g.fillRect(0, 0, w, h); const n = 4, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 100 + ((i * 7 + j * 13) % 5) * 6; g.fillStyle = `rgb(${v + 18},${v + 14},${v + 8})`; g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4); } } },
  glassblock: { tile: 0.76, draw: (g, w, h) => { g.fillStyle = "#7f9399"; g.fillRect(0, 0, w, h); const n = 4, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const gr = g.createRadialGradient(i * s + s / 2, j * s + s / 2, 2, i * s + s / 2, j * s + s / 2, s * 0.7); gr.addColorStop(0, "#dbeef2"); gr.addColorStop(1, "#97b2b9"); g.fillStyle = gr; g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6); } } },
  fan: { tile: 0, draw: (g, w, h) => { g.fillStyle = "#cfcdc8"; g.fillRect(0, 0, w, h); g.fillStyle = "#26282c"; g.beginPath(); g.arc(w / 2, h / 2, w * 0.46, 0, 7); g.fill(); g.strokeStyle = "#8d9096"; g.lineWidth = 3; for (let r = 0.14; r < 0.46; r += 0.08) { g.beginPath(); g.arc(w / 2, h / 2, w * r, 0, 7); g.stroke(); } g.beginPath(); g.moveTo(w * 0.04, h / 2); g.lineTo(w * 0.96, h / 2); g.moveTo(w / 2, h * 0.04); g.lineTo(w / 2, h * 0.96); g.stroke(); } },
  hazard: { tile: 0.5, draw: (g, w, h) => { g.fillStyle = "#e2b52f"; g.fillRect(0, 0, w, h); g.fillStyle = "#1b1b1d"; for (let k = -w; k < w * 2; k += w / 2) { g.beginPath(); g.moveTo(k, h); g.lineTo(k + w / 4, h); g.lineTo(k + w / 4 + h, 0); g.lineTo(k + h, 0); g.fill(); } } },
  panel: { tile: 1.0, draw: (g, w, h) => { g.fillStyle = "#c3c8cc"; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, "#9aa1a7"); gr.addColorStop(0.5, "#dde1e4"); gr.addColorStop(1, "#9aa1a7"); g.fillStyle = gr; g.fillRect(x, 0, 16, h); } } },
  blocks: { tile: 0.8, draw: (g, w, h) => { g.fillStyle = "#7e7b74"; g.fillRect(0, 0, w, h); const bw = w / 2, bh = h / 4; for (let j = 0; j < 4; j++) for (let i = -1; i < 3; i++) { const x = i * bw + (j % 2 ? bw / 2 : 0), v = 150 + ((i + 2) * 5 + j * 3) % 4 * 6; g.fillStyle = `rgb(${v},${v - 3},${v - 9})`; g.fillRect(x + 2, j * bh + 2, bw - 4, bh - 4); } } },
  // cut out: white keeps, black is a hole (the alpha); the colour comes from the slot (or a PBR set over it)
  chainlink: { tile: 0.3, alpha: true, draw: (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); g.strokeStyle = "#fff"; g.lineWidth = 3; const n = 6, s = w / n; for (let i = -n; i < 2 * n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s + h, h); g.stroke(); g.beginPath(); g.moveTo(i * s, h); g.lineTo(i * s + h, 0); g.stroke(); } } },
  boards: { tile: 1.2, alpha: true, draw: (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); const n = 10, s = w / n; for (let i = 0; i < n; i++) g.fillStyle = "#fff", g.fillRect(i * s, 0, s - 2, h); } },
  lattice: { tile: 0.6, alpha: true, draw: (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); const n = 12, s = w / n; g.fillStyle = "#fff"; for (let i = 0; i < n; i++) g.fillRect(i * s, 0, s * 0.45, h); g.fillRect(0, 0, w, 6); } },
  bamboo: { tile: 0.6, alpha: true, draw: (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); const n = 12, s = w / n; for (let i = 0; i < n; i++) { g.fillStyle = "#fff"; g.fillRect(i * s + 1, 0, s - 3, h); g.fillStyle = "#000"; g.fillRect(i * s + 1, ((i * 37) % 9) * 6 + 20, s - 3, 2); } } },
  bars: { tile: 0.44, alpha: true, draw: (g, w, h) => { g.fillStyle = "#000"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; const n = 4, s = w / n; for (let i = 0; i < n; i++) g.fillRect(i * s, 0, 6, h); } },
  grate: { tile: 0.35, alpha: true, draw: (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#000"; const n = 6, s = w / n; for (let i = 0; i < n; i++) g.fillRect(i * s + 4, 4, s - 8, h - 8); } },
};
const TEXCACHE = {};
function patternTexture(name) {
  if (TEXCACHE[name] !== undefined) return TEXCACHE[name];
  const P = PATTERNS[name]; if (!P) return (TEXCACHE[name] = null);
  const c = canvas(128, 128, P.draw); if (!c) return (TEXCACHE[name] = null);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (P.tile) t.repeat.set(1 / P.tile, 1 / P.tile);
  if (!P.alpha) t.colorSpace = THREE.SRGBColorSpace;
  return (TEXCACHE[name] = t);
}

// ---- signs: words on a board, glyphs painted on the road, the road signs' faces ------------------------------------
const FONT = `"IPAGothic", "Noto Sans CJK JP", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif`;
function signCanvas(sg) {
  const ppm = 150, W = Math.max(32, Math.min(1024, Math.round(sg.w * ppm))), H = Math.max(32, Math.min(1024, Math.round(sg.h * ppm)));
  return canvas(W, H, (g) => {
    g.fillStyle = sg.bg || "#202024"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = Math.max(2, Math.min(W, H) * 0.04); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, W - g.lineWidth, H - g.lineWidth);
    const text = String(sg.text || ""); if (!text) return;
    g.fillStyle = sg.fg || "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    if (sg.dir === "v") {                                             // top to bottom, a character a line
      const chars = [...text], n = chars.length, size = Math.min(W * 0.8, (H * 0.9) / n);
      g.font = `bold ${size}px ${FONT}`;
      chars.forEach((ch, i) => g.fillText(ch, W / 2, H * 0.05 + size * (i + 0.5) + (H * 0.9 - size * n) / 2));
    } else if (sg.dir === "r") {                                      // turned a quarter: Latin words up a tall board
      g.save(); g.translate(W / 2, H / 2); g.rotate(Math.PI / 2);               // read top to bottom, as a book's spine
      let size = W * 0.8; g.font = `bold ${size}px ${FONT}`; const m = g.measureText(text).width; if (m > H * 0.9) size *= H * 0.9 / m;
      g.font = `bold ${size}px ${FONT}`; g.fillText(text, 0, 0); g.restore();
    } else {
      const lines = text.split("\n"); let size = H * 0.7 / lines.length; g.font = `bold ${size}px ${FONT}`;
      const m = Math.max(...lines.map(l => g.measureText(l).width)); if (m > W * 0.9) size *= W * 0.9 / m;
      g.font = `bold ${size}px ${FONT}`; lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * size * 1.1));
    }
  });
}
function glyphCanvas(ch) {
  return canvas(128, 128, (g) => { g.fillStyle = "#000"; g.fillRect(0, 0, 128, 128); g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `bold 118px ${FONT}`; g.fillText(ch, 64, 70); });
}
const TSIGN = {
  stop: (g, W, H, back) => { g.beginPath(); g.moveTo(W * 0.02, H * 0.04); g.lineTo(W * 0.98, H * 0.04); g.lineTo(W / 2, H * 0.98); g.closePath(); g.fillStyle = back ? "#8a8f94" : "#fff"; g.fill(); if (back) return; g.beginPath(); g.moveTo(W * 0.1, H * 0.1); g.lineTo(W * 0.9, H * 0.1); g.lineTo(W / 2, H * 0.88); g.closePath(); g.fillStyle = "#c62a24"; g.fill(); g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `bold ${W * 0.2}px ${FONT}`; g.fillText("止まれ", W / 2, H * 0.36); },
  oneway: (g, W, H, back) => { g.fillStyle = back ? "#8a8f94" : "#2b5aa6"; g.fillRect(0, 0, W, H); if (back) return; g.fillStyle = "#fff"; g.beginPath(); g.moveTo(W * 0.08, H * 0.42); g.lineTo(W * 0.72, H * 0.42); g.lineTo(W * 0.72, H * 0.22); g.lineTo(W * 0.94, H * 0.5); g.lineTo(W * 0.72, H * 0.78); g.lineTo(W * 0.72, H * 0.58); g.lineTo(W * 0.08, H * 0.58); g.closePath(); g.fill(); },
  straight: (g, W, H, back) => { g.beginPath(); g.arc(W / 2, H / 2, W * 0.48, 0, 7); g.fillStyle = back ? "#8a8f94" : "#2b5aa6"; g.fill(); if (back) return; g.fillStyle = "#fff"; g.fillRect(W * 0.45, H * 0.36, W * 0.1, H * 0.46); g.beginPath(); g.moveTo(W * 0.3, H * 0.4); g.lineTo(W / 2, H * 0.16); g.lineTo(W * 0.7, H * 0.4); g.closePath(); g.fill(); },
  noentry: (g, W, H, back) => { g.beginPath(); g.arc(W / 2, H / 2, W * 0.48, 0, 7); g.fillStyle = back ? "#8a8f94" : "#c62a24"; g.fill(); if (back) return; g.fillStyle = "#fff"; g.fillRect(W * 0.18, H * 0.42, W * 0.64, H * 0.16); },
  speed30: (g, W, H, back) => { g.beginPath(); g.arc(W / 2, H / 2, W * 0.48, 0, 7); g.fillStyle = back ? "#8a8f94" : "#c62a24"; g.fill(); if (back) return; g.beginPath(); g.arc(W / 2, H / 2, W * 0.38, 0, 7); g.fillStyle = "#fff"; g.fill(); g.fillStyle = "#2b5aa6"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `bold ${W * 0.42}px ${FONT}`; g.fillText("30", W / 2, H * 0.53); },
  walk: (g, W, H, back) => { g.beginPath(); g.arc(W / 2, H / 2, W * 0.48, 0, 7); g.fillStyle = back ? "#8a8f94" : "#2b5aa6"; g.fill(); if (back) return; g.fillStyle = "#fff"; g.beginPath(); g.arc(W * 0.5, H * 0.27, W * 0.07, 0, 7); g.fill(); g.fillRect(W * 0.45, H * 0.35, W * 0.1, H * 0.25); g.fillRect(W * 0.38, H * 0.58, W * 0.08, H * 0.2); g.fillRect(W * 0.54, H * 0.58, W * 0.08, H * 0.2); },
  school: (g, W, H, back) => { g.beginPath(); g.moveTo(W / 2, H * 0.02); g.lineTo(W * 0.98, H / 2); g.lineTo(W / 2, H * 0.98); g.lineTo(W * 0.02, H / 2); g.closePath(); g.fillStyle = back ? "#8a8f94" : "#e8c02e"; g.fill(); if (back) return; g.fillStyle = "#111"; g.beginPath(); g.arc(W * 0.42, H * 0.38, W * 0.06, 0, 7); g.arc(W * 0.6, H * 0.42, W * 0.05, 0, 7); g.fill(); g.fillRect(W * 0.38, H * 0.45, W * 0.08, H * 0.22); g.fillRect(W * 0.56, H * 0.48, W * 0.07, H * 0.18); },
  noparking: (g, W, H, back) => { g.beginPath(); g.arc(W / 2, H / 2, W * 0.48, 0, 7); g.fillStyle = back ? "#8a8f94" : "#c62a24"; g.fill(); if (back) return; g.beginPath(); g.arc(W / 2, H / 2, W * 0.38, 0, 7); g.fillStyle = "#2b5aa6"; g.fill(); g.strokeStyle = "#c62a24"; g.lineWidth = W * 0.09; g.beginPath(); g.moveTo(W * 0.24, H * 0.24); g.lineTo(W * 0.76, H * 0.76); g.stroke(); },
};
function tsignCanvas(kind, back) {
  const f = TSIGN[kind] || TSIGN.stop, W = 192, H = kind === "oneway" ? 64 : kind === "stop" ? 168 : 192;
  return canvas(W, H, (g) => { g.clearRect(0, 0, W, H); f(g, W, H, back); });
}

// ---- the PBR shelf (assets/pbr): its sets, read once from /api/pbr ------------------------------------------------------
export const SHELF = { sets: {}, loaded: false };
export async function loadShelf() {
  try { const r = await (await fetch("/api/pbr")).json(); SHELF.sets = r.sets || {}; } catch (e) { SHELF.sets = {}; }
  SHELF.loaded = true; return SHELF;
}
const encPath = p => p.split("/").map(encodeURIComponent).join("/");
const PBRTEX = {};
function shelfMaps(ref) {
  const m = SHELF.sets[ref]; if (!m) return null;
  const key = `${ref}|${m.stamp || ""}`; if (PBRTEX[key]) return PBRTEX[key];
  const tl = new THREE.TextureLoader(), maps = m.maps || {}, tile = m.tile_m || 1;
  const tex = (k, srgb) => { if (!maps[k]) return null; const t = tl.load(`${encPath(m.base)}/${encodeURIComponent(maps[k])}?s=${m.stamp || ""}`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(1 / tile, 1 / tile); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const out = { map: tex("albedo", true), normalMap: tex("normal"), roughnessMap: tex("rough"), metalnessMap: tex("metal"), aoMap: tex("ao"), dx: m.normal === "dx" };
  if (m.orm && !(out.roughnessMap && out.metalnessMap)) { const t = tl.load(`${encPath(m.base)}/${encodeURIComponent(m.orm)}?s=${m.stamp || ""}`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / tile, 1 / tile); out.roughnessMap ||= t; out.metalnessMap ||= t; }
  return (PBRTEX[key] = out);
}

// ---- materials: a slot with what's put on it (a colour, a set), kept while the street is open. A surface's colour
// rides on its vertices (one material a slot, whatever colour each building's walls are: a big street stays a few
// hundred draws); a lit slot keeps its colour in its material (its glow is that colour) --------------------------------
export class Materials {
  constructor() { this.cache = new Map(); this.time = TIMES.dusk; this.signs = {}; }
  // `over`: the piece's look on this slot, else the street's; a colour "#rrggbb" or "pbr/<name>"; vc: coloured by vertex
  get(slot, over, vc = false) {
    const key = slot + "|" + (over || "") + "|" + (vc ? "v" : "") + (slot.startsWith("sign:") ? "|" + JSON.stringify(this.signs[slot.slice(5)] || {}) : "");
    let m = this.cache.get(key); if (m) return m;
    m = this.make(slot, vc ? (over && over.startsWith("pbr/") ? over : "") : over); m.userData.slot = slot; m.userData.over = over || "";
    if (vc) { m.vertexColors = true; m.color.set("#ffffff"); m.userData.base = "#ffffff"; m.userData.vc = true; }
    this.cache.set(key, m); this.light(m); return m;
  }
  // the material a piece's slot draws with and the colour its vertices carry ([r, g, b], linear)
  forMerge(slot, over) {
    const base = SG.slotBase(slot), S = SG.SLOTS[base] || SG.SLOTS.wall, lit = (S[3] || "").includes("e");
    const special = slot.startsWith("sign:") || slot.startsWith("glyph:") || slot.startsWith("tsign:");
    if (special || lit) return { mat: this.get(slot, over), key: "m|" + slot + "|" + (over || "") + (slot.startsWith("sign:") ? "|" + JSON.stringify(this.signs[slot.slice(5)] || {}) : ""), rgb: WHITE };
    const isCol = !!over && /^#[0-9a-f]{6}$/i.test(over), isPbr = !!over && over.startsWith("pbr/");
    const pattern = (PATTERNS[base] && !PATTERNS[base].alpha) || base === "fan";
    const col = new THREE.Color(isCol ? over : isPbr || pattern ? "#ffffff" : S[0]);
    if (pattern && isCol) col.multiplyScalar(1.25);
    return { mat: this.get(slot, isPbr ? over : "", true), key: "v|" + slot + "|" + (isPbr ? over : ""), rgb: [col.r, col.g, col.b] };
  }
  make(slot, over) {
    const base = SG.slotBase(slot), S = SG.SLOTS[base] || SG.SLOTS.wall, flags = S[3] || "";
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(S[0]), roughness: S[1] ?? 0.8, metalness: S[2] ?? 0 });
    m.userData.lit = flags.includes("e"); m.userData.base = S[0];
    if (slot.startsWith("sign:")) {
      const sg = this.signs[slot.slice(5)] || { text: "", w: 1, h: 1 }, c = signCanvas(sg);
      if (c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; m.map = t; m.color.set("#ffffff"); if (sg.lit) { m.emissiveMap = t; m.userData.lit = true; m.userData.signLit = true; } }
      m.roughness = 0.5;
      return m;
    }
    if (slot.startsWith("glyph:")) {
      const c = glyphCanvas(slot.slice(6));
      if (c) { const t = new THREE.CanvasTexture(c); m.alphaMap = t; m.alphaTest = 0.5; }
      m.color.set(SG.SLOTS.paint[0]); m.roughness = 0.7; m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
      return m;
    }
    if (slot.startsWith("tsign:")) {
      const [, kind, back] = slot.split(":"), c = tsignCanvas(kind, !!back);
      if (c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; m.map = t; m.alphaTest = 0.5; m.transparent = false; m.color.set("#ffffff"); }
      m.roughness = 0.45; m.side = THREE.FrontSide;
      return m;
    }
    const pat = PATTERNS[base] ? patternTexture(base) : null;
    if (pat) { if (PATTERNS[base].alpha) { m.alphaMap = pat; m.alphaTest = 0.5; m.side = THREE.DoubleSide; } else { m.map = pat; m.color.set("#ffffff"); } }
    if (base === "fan") { m.map = patternTexture("fan"); m.color.set("#ffffff"); }
    if (base === "paint" || base === "paint_y") { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
    if (over && /^#[0-9a-f]{6}$/i.test(over)) { m.color.set(over); if (m.map && !PATTERNS[base]?.alpha && base !== "fan") m.color.set(over).multiplyScalar(1.25); m.userData.base = over; }
    else if (over && over.startsWith("pbr/")) {
      const P = shelfMaps(over);
      if (P) { m.map = P.map; m.normalMap = P.normalMap; m.roughnessMap = P.roughnessMap; m.metalnessMap = P.metalnessMap; m.aoMap = P.aoMap; if (m.metalnessMap) m.metalness = 1; if (m.roughnessMap) m.roughness = 1; if (P.dx && m.normalMap) m.normalScale.set(1, -1); m.color.set("#ffffff"); m.userData.pbr = over; }
    }
    return m;
  }
  // how much the lit slots glow at this time of day
  setTime(T) { this.time = T; for (const m of this.cache.values()) this.light(m); }
  light(m) {
    if (!m.userData.lit) return;
    const T = this.time, k = m.userData.signLit ? Math.max(0.35, T.lit) : T.lit;
    if (m.emissiveMap) { m.emissive.set("#ffffff"); m.emissiveIntensity = 0.8 * k; return; }
    m.emissive.set(m.userData.base); m.emissiveIntensity = (m.userData.slot === "lamp" || m.userData.slot === "lamp_cool" ? 1.3 : 0.62) * k;
    if (k < 0.2) { m.color.set(m.userData.base).multiplyScalar(0.5); } else m.color.set(m.userData.base);
  }
  dispose() { for (const m of this.cache.values()) { m.map?.dispose?.(); m.dispose(); } this.cache.clear(); }
}
const WHITE = [1, 1, 1];

// ---- the street as chunks: its pieces gathered by where they stand (CHUNK m squares) and merged by material, so a big
// street is a few hundred draws and each chunk is culled whole when out of view. A mesh's userData.ranges says which
// piece each run of its triangles is (picking); root.userData.index each piece's chunk and bounds (three's space). A
// chunk whose pieces haven't changed since the last build is kept as it was (opts.prev: the last build's chunks).
export const CHUNK = 48;
const SHADOWLESS = new Set(["lamp", "lamp_cool", "lit", "lit_cool", "shop", "lobby", "paper", "vend_lit", "headlight", "taillight", "glass", "asphalt", "pavement", "ground", "paint", "paint_y", "wire"]);
let SERIAL = 0;
function boundsOf(p) {
  if (p._bb) return p._bb;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const g of Object.values(p.G)) for (let i = 0; i < g.pos.length; i += 3) for (let k = 0; k < 3; k++) { const v = g.pos[i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
  return (p._bb = lo[0] === Infinity ? null : { lo, hi });
}
export function disposeChunk(g) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
export function group(S, pieces, mats, opts = {}) {
  const cell = opts.cell || CHUNK, prev = opts.prev || null, root = new THREE.Group(); root.name = S.name || "street";
  const looks = {};
  for (const list of ["roads", "buildings", "things", "fences"]) for (const p of S[list] || []) looks[p.id] = p.look || {};
  for (const p of pieces) for (const sg of p.signs || []) mats.signs[sg.key] = sg;
  const chunks = new Map(), index = {};
  for (const p of pieces) {
    if (!p._n) p._n = ++SERIAL;
    const bb = boundsOf(p); if (!bb) continue;
    const key = p.type === "ground" || p.type === "wires" || p.type === "road" ? p.type + ":" + p.id : `${Math.floor((bb.lo[0] + bb.hi[0]) / 2 / cell)},${Math.floor((bb.lo[1] + bb.hi[1]) / 2 / cell)}`;
    if (!chunks.has(key)) chunks.set(key, []);
    chunks.get(key).push(p);
    index[p.id] = { type: p.type, chunk: key, lo: [bb.lo[0], bb.lo[2], -bb.hi[1]], hi: [bb.hi[0], bb.hi[2], -bb.lo[1]] };
  }
  const lookKey = JSON.stringify(S.look || {}) + "|" + !!opts.shadows, made = new Map();
  for (const [key, list] of chunks) {
    const sig = list.map(p => p._n).join(",") + "|" + lookKey;
    const old = prev && prev.get(key);
    if (old && old.sig === sig) { made.set(key, old); root.add(old.group); continue; }
    const byMat = new Map();
    for (const p of list) {
      const own = looks[p.id] || {};
      for (const [slot, buf] of Object.entries(p.G)) {
        if (!buf.idx.length) continue;
        const base = SG.slotBase(slot), over = own[slot] ?? own[base] ?? (S.look || {})[slot] ?? (S.look || {})[base];
        const { mat, key: mk, rgb } = mats.forMerge(slot, over);
        let M = byMat.get(mk); if (!M) byMat.set(mk, M = { mat, slot: base, pos: [], nrm: [], uv: [], col: [], idx: [], ranges: [] });
        const v0 = M.pos.length / 3, t0 = M.idx.length / 3;
        for (let i = 0; i < buf.pos.length; i += 3) { M.pos.push(buf.pos[i], buf.pos[i + 2], -buf.pos[i + 1]); M.nrm.push(buf.nrm[i], buf.nrm[i + 2], -buf.nrm[i + 1]); M.col.push(rgb[0], rgb[1], rgb[2]); }
        for (let i = 0; i < buf.uv.length; i++) M.uv.push(buf.uv[i]);
        for (let i = 0; i < buf.idx.length; i++) M.idx.push(buf.idx[i] + v0);
        M.ranges.push([t0, buf.idx.length / 3, p.id]);
      }
    }
    const g = new THREE.Group(); g.name = "chunk_" + key.replace(/[^A-Za-z0-9_-]+/g, "_");
    for (const M of byMat.values()) {
      const geo = new THREE.BufferGeometry(), n = M.pos.length / 3;
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(M.pos), 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(M.nrm), 3));
      const uv = new THREE.BufferAttribute(new Float32Array(M.uv), 2); geo.setAttribute("uv", uv); geo.setAttribute("uv1", uv);
      geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(M.col), 3));
      geo.setIndex(new (n > 65535 ? THREE.Uint32BufferAttribute : THREE.Uint16BufferAttribute)(M.idx, 1));
      geo.computeBoundingSphere(); geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, M.mat);
      mesh.name = `${g.name}_${M.slot}`; mesh.userData.ranges = M.ranges; mesh.userData.slot = M.slot;
      if (opts.shadows) { mesh.castShadow = !SHADOWLESS.has(M.slot) && !key.startsWith("ground"); mesh.receiveShadow = !M.slot.startsWith("lit") && !M.mat.userData.signLit; }
      g.add(mesh);
    }
    made.set(key, { sig, group: g }); root.add(g);
  }
  if (prev) for (const [k, v] of prev) if (made.get(k) !== v) disposeChunk(v.group);
  root.userData.chunks = made; root.userData.index = index;
  return root;
}
// which piece a ray hit (a merged mesh's triangle runs)
export function pieceAt(hit) {
  const R = hit && hit.object && hit.object.userData.ranges; if (!R) return null;
  let lo = 0, hi = R.length - 1, f = hit.faceIndex;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (R[m][0] <= f) lo = m; else hi = m - 1; }
  return R[lo] && f < R[lo][0] + R[lo][1] ? R[lo][2] : null;
}
export function lightsOf(pieces) { const out = []; for (const p of pieces) for (const L of p.lights || []) out.push(Object.assign({ piece: p.id }, L)); return out; }

// ---- the sky, the sun, the ambient, the fog: the time of day -----------------------------------------------------
export class Look {
  constructor(scene) {
    this.scene = scene;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.03; scene.add(this.sun, this.sun.target);
    const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
      vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }",
      fragmentShader: "uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vDir; void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizon, bottom, pow(clamp(-h * 4.0, 0.0, 1.0), 0.6)); gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}" });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat); this.sky.renderOrder = -1; this.sky.frustumCulled = false; scene.add(this.sky);
    this.points = []; this.time = TIMES.dusk;
  }
  set(name, renderer, bounds) {
    const T = TIMES[name] || TIMES.dusk; this.time = T;
    const u = this.sky.material.uniforms; u.top.value.set(T.top); u.horizon.value.set(T.horizon); u.bottom.value.set(T.ground);
    this.hemi.color.set(T.hemiSky); this.hemi.groundColor.set(T.hemiGround); this.hemi.intensity = T.hemi;
    this.sun.color.set(T.sunColor); this.sun.intensity = T.sun; this.sun.visible = T.sun > 0.01;
    const b = bounds || [-30, -30, 30, 30], cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, R = Math.max(20, Math.hypot(b[2] - b[0], b[3] - b[1]) / 2 + 10);
    const el = T.sunEl * Math.PI / 180, az = T.sunAz * Math.PI / 180, dir = [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
    this.sun.target.position.copy(s2t(cx, cy, 0)); this.sun.position.copy(s2t(cx + dir[0] * R * 2, cy + dir[1] * R * 2, dir[2] * R * 2));
    const sc = this.sun.shadow.camera; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 1; sc.far = R * 5; sc.updateProjectionMatrix();
    this.scene.fog = T.fog ? new THREE.FogExp2(new THREE.Color(T.horizon).lerp(new THREE.Color(T.top), 0.15), T.fog) : null;
    if (renderer) { renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = T.exposure; }
    return T;
  }
  follow(camera) { this.sky.position.copy(camera.position); }
  // the lamps' lights: at most `max`, the nearest to the eye, on at dusk and night. A pool of `max` lights kept in the
  // scene (the unused ones dark), so moving about never changes the count (which would rebuild every shader)
  lamps(lights, eye, max = 16) {
    while (this.points.length < max) { const pl = new THREE.PointLight(0xffffff, 0, 10, 1.6); this.scene.add(pl); this.points.push(pl); }
    const near = !this.time.lamps ? [] : lights.map(L => ({ L, d: eye ? Math.hypot(L.at[0] - eye[0], L.at[1] - eye[1], L.at[2] - eye[2]) : 0 })).sort((a, b) => a.d - b.d).slice(0, max);
    this.points.forEach((pl, i) => {
      const L = near[i] && near[i].L;
      if (!L) { pl.intensity = 0; return; }
      pl.color.set(L.color || "#ffd6a0"); pl.intensity = (L.power || 10) * (this.time === TIMES.night ? 1.2 : 1); pl.distance = L.dist || 12;
      pl.position.copy(s2t(...L.at));
    });
  }
}

// ---- export: the street as a .glb to drop into a Godot project's folder (docs/STREET_BUILDER.md §5b). Its nodes:
// `visual` (a node a chunk, a mesh a material, the colours on the vertices), `collision` (a `-colonly` mesh a chunk:
// Godot makes each a StaticBody3D with its shape on import: the roads' and the ground's surfaces to walk on, a box a
// building, a fence's bays, the things you'd bump into), `occluders` (`-occonly`: Godot's occlusion culling, inside the
// buildings), `lamps` (the lamps' lights, KHR_lights_punctual: OmniLight3Ds) and `insides` (where a set's level goes in a
// building, with which one in its metadata). Cut-out slots carry their pattern in the colour map's alpha.
export const lampEnergy = power => Math.max(0.3, Math.min(3, (power || 10) / 12));   // a lamp's power (the page's) as Godot's light energy
function exportMaterial(m, made) {
  if (made.has(m)) return made.get(m);
  const e = new THREE.MeshStandardMaterial({ name: `street_${m.userData.slot || "slot"}${m.userData.over && !m.userData.vc ? "_" + m.userData.over.replace(/[^a-z0-9]+/gi, "_") : ""}`,
    color: m.color.clone(), roughness: m.roughness, metalness: m.metalness, map: m.map || null, normalMap: m.normalMap || null, roughnessMap: m.roughnessMap || null, metalnessMap: m.metalnessMap || null,
    emissive: m.emissive.clone(), emissiveIntensity: m.emissiveIntensity, emissiveMap: m.emissiveMap || null, side: m.side, vertexColors: !!m.vertexColors });
  if (m.alphaMap && typeof document !== "undefined") {                // glTF has no alpha map: the pattern goes into the colour map's alpha
    const img = m.alphaMap.image, c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) { const a = d.data[i]; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = a; }
    g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.copy(m.alphaMap.repeat); t.colorSpace = THREE.SRGBColorSpace;
    e.map = t; e.alphaTest = 0.5; e.transparent = false;
  }
  made.set(m, e); return e;
}
// Godot's importer leaves a glTF's vertex colours off the albedo, so the export gives each colour its own material: the
// chunk's mesh keeps one node, a surface a colour (its triangles regrouped by the pieces' runs, which share a colour)
function byColour(m, base, made) {
  const geo = m.geometry, col = geo.attributes.color, idx = geo.index.array, groups = new Map();
  for (const [t0, n] of m.userData.ranges || [[0, idx.length / 3]]) {
    const v = idx[t0 * 3], key = [col.getX(v), col.getY(v), col.getZ(v)].map(x => x.toFixed(4)).join(",");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push([t0, n]);
  }
  const out = new THREE.BufferGeometry();
  for (const k of ["position", "normal", "uv", "uv1"]) if (geo.attributes[k]) out.setAttribute(k, geo.attributes[k]);
  const order = [], mats = [];
  for (const [key, rs] of groups) {
    const start = order.length;
    for (const [t0, n] of rs) for (let k = t0 * 3; k < (t0 + n) * 3; k++) order.push(idx[k]);
    const ck = base.uuid + "|" + key;
    let mat = made.get(ck);
    if (!mat) {
      const [r, g, b] = key.split(",").map(Number); mat = base.clone(); mat.vertexColors = false;
      mat.color.setRGB(Math.min(1, r), Math.min(1, g), Math.min(1, b)); mat.name = `${base.name}_${mat.color.getHexString()}`; made.set(ck, mat);
    }
    out.addGroup(start, order.length - start, mats.length); mats.push(mat);
  }
  out.setIndex(new (geo.attributes.position.count > 65535 ? THREE.Uint32BufferAttribute : THREE.Uint16BufferAttribute)(order, 1));
  return new THREE.Mesh(out, mats);
}
function trisMesh(name, tris) {                                     // story-space triangles as a three mesh
  const pos = new Float32Array(tris.pos.length);
  for (let i = 0; i < tris.pos.length; i += 3) { pos[i] = tris.pos[i]; pos[i + 1] = tris.pos[i + 2]; pos[i + 2] = -tris.pos[i + 1]; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new (pos.length / 3 > 65535 ? THREE.Uint32BufferAttribute : THREE.Uint16BufferAttribute)(tris.idx, 1)); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff00ff })); mesh.name = name; return mesh;
}
export function exportGroup(root, S, pieces, lights, blockers, opts = {}) {
  const out = new THREE.Group(); out.name = (S.name || "street").replace(/[^A-Za-z0-9_]+/g, "_");
  const visual = new THREE.Group(); visual.name = "visual"; out.add(visual);
  const made = new Map();
  for (const ch of root.children) {
    const g = new THREE.Group(); g.name = ch.name;
    for (const m of ch.children) if (m.isMesh) { const c = m.material.vertexColors ? byColour(m, exportMaterial(m.material, made), made) : new THREE.Mesh(m.geometry, exportMaterial(m.material, made)); c.name = m.name; g.add(c); }
    visual.add(g);
  }
  const index = root.userData.index || {}, byChunk = new Map(), occByChunk = new Map();
  for (const [id, B] of Object.entries(blockers)) {
    const key = (index[id] || {}).chunk || "loose";
    if (!byChunk.has(key)) { byChunk.set(key, { pos: [], idx: [] }); occByChunk.set(key, { pos: [], idx: [] }); }
    const T = byChunk.get(key);
    for (const b of B.boxes) SG.boxTris(b, T);
    if (B.surface && B.surface.idx.length) { const v0 = T.pos.length / 3; T.pos.push(...B.surface.pos); for (const i of B.surface.idx) T.idx.push(i + v0); }
    for (const b of B.occ) SG.boxTris(b, occByChunk.get(key));
  }
  const col = new THREE.Group(); col.name = "collision"; out.add(col);
  const occ = new THREE.Group(); occ.name = "occluders"; out.add(occ);
  for (const [key, T] of byChunk) {
    const nm = "chunk_" + key.replace(/[^A-Za-z0-9_]+/g, "_");
    if (T.idx.length) col.add(trisMesh(nm + "-colonly", T));
    const O = occByChunk.get(key); if (opts.occluders !== false && O.idx.length) occ.add(trisMesh(nm + "_occ-occonly", O));
  }
  const lamps = new THREE.Group(); lamps.name = "lamps"; out.add(lamps);
  if (opts.lamps !== false) lights.filter(L => !L.shop).forEach((L, i) => {
    const pl = new THREE.PointLight(new THREE.Color(L.color || "#ffd6a0"), lampEnergy(L.power), L.dist || 12, 2);
    pl.name = `lamp_${L.piece}_${i}`; pl.position.copy(s2t(...L.at)); lamps.add(pl);
  });
  const insides = new THREE.Group(); insides.name = "insides"; out.add(insides);
  for (const m of opts.insides || []) { const o = new THREE.Object3D(); o.name = m.name; o.position.copy(s2t(...m.at)); o.rotation.y = (m.turn || 0) * Math.PI / 180; o.userData = m.meta || {}; insides.add(o); }
  return out;
}
export async function exportGlb(group, GLTFExporter) {
  return new Promise((res, rej) => new GLTFExporter().parse(group, r => res(r), e => rej(e), { binary: true }));
}

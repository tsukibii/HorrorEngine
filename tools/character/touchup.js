// The touch-up: painting on the character's skin in the Character Studio, over the photo skin and the procedural skin.
// Two layers on MHR's UVs, each a canvas: the paint (colour and how much of it: lips, liner, a fixed eye, a hidden
// blemish) and the photo's mask edits (grey 128 no change, lighter shows more of the photo, darker takes it away for
// the procedural skin underneath: a fringe of hair or a shadow baked into the photo, gone). The brush is round on the
// body, not on the texture: its radius in UV comes from the hit triangle's own stretch. Each stroke can be undone;
// Save writes People/<name>/skin_paint.png and skin_touch.png (serve.py).
import * as THREE from "three";

export const SIZE = 2048;
export const BRUSHES = [   // [key, label, help]
  ["paint", "Paint", "The colour, built up by the strength: lips, liner, brows, a fixed eye."],
  ["skin", "Skin", "Takes the photo away under the brush: the procedural skin shows (hair or shadows baked into the picture)."],
  ["photo", "Photo", "Brings the photo back under the brush, or further out than its own mask."],
  ["erase", "Erase", "Takes the paint away (and the mask edits back to none)."],
  ["blur", "Soften", "Blurs the paint and the mask edits under the brush: hard edges, blotches."],
];

export class TouchUp {
  constructor() {
    const mk = fill => { const c = document.createElement("canvas"); c.width = c.height = SIZE; const g = c.getContext("2d", { willReadFrequently: true });
      if (fill) { g.fillStyle = fill; g.fillRect(0, 0, SIZE, SIZE); } return [c, g]; };
    [this.paint, this.pg] = mk(null);
    [this.mask, this.mg] = mk("#808080");
    [this.before, this.bg] = mk(null);           // the layers as the stroke began (for undo)
    [this.beforeM, this.bmg] = mk(null);
    [this.tmp, this.tg] = mk(null);
    this.paintTex = new THREE.CanvasTexture(this.paint); this.paintTex.colorSpace = THREE.SRGBColorSpace;   // flipped like skin.png: row = 1 - v
    this.maskTex = new THREE.CanvasTexture(this.mask);
    this.brush = "paint"; this.color = "#c0485a"; this.size = 4; this.strength = 0.35; this.hard = 0.3;
    this.undo = []; this.stroke = null; this.used = false;
  }

  clear() {
    this.pg.clearRect(0, 0, SIZE, SIZE); this.mg.fillStyle = "#808080"; this.mg.fillRect(0, 0, SIZE, SIZE);
    this.undo = []; this.used = false; this.dirty();
  }
  dirty() { this.paintTex.needsUpdate = true; this.maskTex.needsUpdate = true; }

  async load(paintUrl, maskUrl) {               // what was saved, if anything
    this.clear();
    const img = async url => { try { const r = await fetch(url); if (!r.ok) return null; return await createImageBitmap(await r.blob()); } catch (e) { return null; } };
    const [p, m] = await Promise.all([img(paintUrl), img(maskUrl)]);
    if (p) { this.pg.drawImage(p, 0, 0, SIZE, SIZE); this.used = true; }
    if (m) { this.mg.drawImage(m, 0, 0, SIZE, SIZE); this.used = true; }
    this.dirty();
    return this.used;
  }

  blobs() {
    const b = c => new Promise(res => c.toBlob(res, "image/png"));
    return Promise.all([b(this.paint), b(this.mask)]);
  }

  // a stroke: begin, dabs at hits (uv, and the brush's radius in uv), end
  begin() {
    this.bg.clearRect(0, 0, SIZE, SIZE); this.bg.drawImage(this.paint, 0, 0);
    this.bmg.drawImage(this.mask, 0, 0);
    this.stroke = { x0: SIZE, y0: SIZE, x1: 0, y1: 0, last: null };
  }
  dab(uv, ruv) {
    if (!this.stroke) this.begin();
    const x = uv.x * SIZE, y = (1 - uv.y) * SIZE, r = Math.max(1.5, ruv * SIZE), s = this.stroke;
    if (s.last) {                                // dabs a third of the radius apart along the drag
      const dx = x - s.last[0], dy = y - s.last[1], d = Math.hypot(dx, dy);
      if (d > SIZE * 0.05) { s.last = [x, y]; return this.one(x, y, r); }   // across a UV seam: no line between
      const n = Math.max(1, Math.ceil(d / (r * 0.33)));
      for (let i = 1; i <= n; i++) this.one(s.last[0] + dx * i / n, s.last[1] + dy * i / n, r);
    } else this.one(x, y, r);
    s.last = [x, y];
  }
  one(x, y, r) {
    const s = this.stroke;
    s.x0 = Math.min(s.x0, x - r - 2); s.y0 = Math.min(s.y0, y - r - 2); s.x1 = Math.max(s.x1, x + r + 2); s.y1 = Math.max(s.y1, y + r + 2);
    const grad = (g, rgb, a) => {
      const gr = g.createRadialGradient(x, y, r * this.hard, x, y, r);
      gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); return gr;
    };
    const a = this.strength * 0.35;              // per dab: a stroke builds up
    const b = this.brush;
    if (b === "paint") {
      const h = this.color.replace("#", ""), rgb = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(",");   // the canvas is sRGB
      this.pg.globalCompositeOperation = "source-over"; this.pg.fillStyle = grad(this.pg, rgb, a);
      this.pg.fillRect(x - r, y - r, 2 * r, 2 * r);
    } else if (b === "skin" || b === "photo") {
      this.mg.globalCompositeOperation = "source-over"; this.mg.fillStyle = grad(this.mg, b === "skin" ? "0,0,0" : "255,255,255", a);
      this.mg.fillRect(x - r, y - r, 2 * r, 2 * r);
    } else if (b === "erase") {
      this.pg.globalCompositeOperation = "destination-out"; this.pg.fillStyle = grad(this.pg, "0,0,0", a * 2);
      this.pg.fillRect(x - r, y - r, 2 * r, 2 * r); this.pg.globalCompositeOperation = "source-over";
      this.mg.fillStyle = grad(this.mg, "128,128,128", a * 2); this.mg.fillRect(x - r, y - r, 2 * r, 2 * r);
    } else if (b === "blur") {
      for (const [c, g] of [[this.paint, this.pg], [this.mask, this.mg]]) {
        const k = Math.ceil(r * 1.2), sx = Math.max(0, Math.floor(x - k)), sy = Math.max(0, Math.floor(y - k));
        const w = Math.min(SIZE - sx, 2 * k), h = Math.min(SIZE - sy, 2 * k);
        if (w <= 0 || h <= 0) continue;
        this.tg.clearRect(0, 0, w, h); this.tg.filter = `blur(${Math.max(1, r * 0.25)}px)`; this.tg.drawImage(c, sx, sy, w, h, 0, 0, w, h); this.tg.filter = "none";
        g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip();
        g.globalAlpha = Math.min(1, this.strength * 0.8);
        if (c === this.paint) g.clearRect(sx, sy, w, h);
        g.drawImage(this.tmp, 0, 0, w, h, sx, sy, w, h); g.restore();
      }
    }
    this.used = true; this.dirty();
  }
  end() {
    const s = this.stroke; this.stroke = null;
    if (!s || s.x1 <= s.x0) return;
    const x = Math.max(0, Math.floor(s.x0)), y = Math.max(0, Math.floor(s.y0));
    const w = Math.min(SIZE, Math.ceil(s.x1)) - x, h = Math.min(SIZE, Math.ceil(s.y1)) - y;
    if (w <= 0 || h <= 0) return;
    this.undo.push({ x, y, p: this.bg.getImageData(x, y, w, h), m: this.bmg.getImageData(x, y, w, h) });
    if (this.undo.length > 40) this.undo.shift();
  }
  back() {
    const u = this.undo.pop(); if (!u) return false;
    this.pg.putImageData(u.p, u.x, u.y); this.mg.putImageData(u.m, u.x, u.y); this.dirty();
    return true;
  }
}

// where the pointer is on the body: the hit's uv, and how many uv units a metre is there (its triangle's stretch)
export function hit(raycaster, mesh, uvAttr) {
  const h = raycaster.intersectObject(mesh, false)[0];
  if (!h || !h.face) return null;
  const pos = mesh.geometry.attributes.position, { a, b, c } = h.face;
  const P = [a, b, c].map(i => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  const U = [a, b, c].map(i => new THREE.Vector2().fromBufferAttribute(uvAttr, i));
  const area3 = new THREE.Vector3().subVectors(P[1], P[0]).cross(new THREE.Vector3().subVectors(P[2], P[0])).length();
  const area2 = Math.abs((U[1].x - U[0].x) * (U[2].y - U[0].y) - (U[2].x - U[0].x) * (U[1].y - U[0].y));
  const bc = new THREE.Vector3();
  THREE.Triangle.getBarycoord(h.point, P[0], P[1], P[2], bc);
  const uv = new THREE.Vector2().addScaledVector(U[0], bc.x).addScaledVector(U[1], bc.y).addScaledVector(U[2], bc.z);
  return { uv, perMetre: Math.sqrt(area2 / Math.max(area3, 1e-12)), point: h.point };
}

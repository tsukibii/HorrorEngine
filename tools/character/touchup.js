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
  ["pigment", "Pigment", "A colour as pigment: it filters the skin's own colour, and strokes of two colours mix where they cross (blue over green goes dark teal, two reds a deeper red). Needs the Pigment toggle."],
  ["swatch", "Swatch", "The circle you picked on a reference image (a lipstick, a blush) as the brush: its own colours go on as pigment, and the mixer blends out what's uneven. Needs the Pigment toggle."],
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
    [this.pig, this.ig] = mk("#ffffff");          // the pigment layer: transmittance, white = none. Strokes are composited by *multiply*, so
    [this.beforeI, this.big] = mk(null);          // pigments mix like filters (order doesn't matter): blue x green = dark teal, red x red = deeper red
    this.pigTex = new THREE.CanvasTexture(this.pig); this.pigTex.colorSpace = THREE.SRGBColorSpace;
    this.swatch = null; this.blend = 0.5; this.stamps = new Map(); this.usedPig = false;
    this.paintTex = new THREE.CanvasTexture(this.paint); this.paintTex.colorSpace = THREE.SRGBColorSpace;   // flipped like skin.png: row = 1 - v
    this.maskTex = new THREE.CanvasTexture(this.mask);
    this.brush = "paint"; this.color = "#c0485a"; this.size = 4; this.strength = 0.35; this.hard = 0.3;
    this.undo = []; this.stroke = null; this.used = false;
  }

  clear() {
    this.ig.globalCompositeOperation = "source-over"; this.ig.fillStyle = "#ffffff"; this.ig.fillRect(0, 0, SIZE, SIZE); this.usedPig = false;
    this.pg.clearRect(0, 0, SIZE, SIZE); this.mg.fillStyle = "#808080"; this.mg.fillRect(0, 0, SIZE, SIZE);
    this.undo = []; this.used = false; this.dirty();
  }
  dirty() { this.pigTex.needsUpdate = true; this.paintTex.needsUpdate = true; this.maskTex.needsUpdate = true; }

  async load(paintUrl, maskUrl, pigUrl) {               // what was saved, if anything
    this.clear();
    const img = async url => { try { const r = await fetch(url); if (!r.ok) return null; return await createImageBitmap(await r.blob()); } catch (e) { return null; } };
    const [p, m, q] = await Promise.all([img(paintUrl), img(maskUrl), pigUrl ? img(pigUrl) : null]);
    if (q) { this.ig.drawImage(q, 0, 0, SIZE, SIZE); this.usedPig = this.used = true; }
    if (p) { this.pg.drawImage(p, 0, 0, SIZE, SIZE); this.used = true; }
    if (m) { this.mg.drawImage(m, 0, 0, SIZE, SIZE); this.used = true; }
    this.dirty();
    return this.used;
  }

  blobs() {
    const b = c => new Promise(res => c.toBlob(res, "image/png"));
    return Promise.all([b(this.paint), b(this.mask), b(this.pig)]);
  }

  // a stroke: begin, dabs at hits (uv, and the brush's radius in uv), end
  begin() {
    this.bg.clearRect(0, 0, SIZE, SIZE); this.bg.drawImage(this.paint, 0, 0);
    this.bmg.drawImage(this.mask, 0, 0); this.big.clearRect(0, 0, SIZE, SIZE); this.big.drawImage(this.pig, 0, 0);
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
    } else if (b === "pigment" || b === "swatch") {
      const st = this.stampFor(b), ig = this.ig;
      if (!st) return;
      ig.globalCompositeOperation = "multiply"; ig.save(); ig.translate(x, y); ig.rotate(Math.random() * Math.PI * 2);   // a turn per dab: what's uneven in the swatch averages out
      ig.drawImage(st, -r, -r, 2 * r, 2 * r); ig.restore(); ig.globalCompositeOperation = "source-over"; this.usedPig = true;
    } else if (b === "skin" || b === "photo") {
      this.mg.globalCompositeOperation = "source-over"; this.mg.fillStyle = grad(this.mg, b === "skin" ? "0,0,0" : "255,255,255", a);
      this.mg.fillRect(x - r, y - r, 2 * r, 2 * r);
    } else if (b === "erase") {
      this.pg.globalCompositeOperation = "destination-out"; this.pg.fillStyle = grad(this.pg, "0,0,0", a * 2);
      this.pg.fillRect(x - r, y - r, 2 * r, 2 * r); this.pg.globalCompositeOperation = "source-over";
      this.mg.fillStyle = grad(this.mg, "128,128,128", a * 2); this.mg.fillRect(x - r, y - r, 2 * r, 2 * r);
      this.ig.globalCompositeOperation = "source-over"; this.ig.fillStyle = grad(this.ig, "255,255,255", a * 2); this.ig.fillRect(x - r, y - r, 2 * r, 2 * r);
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
  // the swatch: a circle of a reference image (cx, cy, radius in its pixels) as the brush's own colours
  setSwatch(img, cx, cy, rad) {
    const N = 96, c = document.createElement("canvas"); c.width = c.height = N; const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, cx - rad, cy - rad, 2 * rad, 2 * rad, 0, 0, N, N);
    this.swatch = g.getImageData(0, 0, N, N); this.stamps.clear();
  }
  hex2rgb(h) { h = h.replace("#", ""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); }
  // one dab's pigment: transmittance colour^(density * the falloff); the canvas holds sRGB, and a product of sRGB values is a product in
  // linear light up to the curve's own power law, so multiply is the right mixing. blend pulls the swatch toward its mean (the mixer's
  // smoothing); the dab's density is strength x 0.35 per dab (a stroke builds up) times the colour's own depth.
  stampFor(kind) {
    const key = [kind, this.strength.toFixed(2), this.hard.toFixed(2), this.blend.toFixed(2), kind === "pigment" ? this.color : ""].join("|");
    if (this.stamps.has(key)) return this.stamps.get(key);
    const N = 96, c = document.createElement("canvas"); c.width = c.height = N; const g = c.getContext("2d"), out = g.createImageData(N, N);
    let src = null, mean = null;
    if (kind === "swatch") {
      if (!this.swatch) return null; src = this.swatch.data; mean = [0, 0, 0]; let n = 0;
      for (let i = 0; i < src.length; i += 4) { const x = (i / 4) % N - N / 2, y = Math.floor(i / 4 / N) - N / 2; if (Math.hypot(x, y) > N / 2) continue; for (let k = 0; k < 3; k++) mean[k] += src[i + k] / 255; n++; }
      mean = mean.map(v => v / n);
    }
    const flat = kind === "pigment" ? this.hex2rgb(this.color) : null, a0 = this.strength * 0.35 * 2.2;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const d = Math.hypot(i + 0.5 - N / 2, j + 0.5 - N / 2) / (N / 2), o = (j * N + i) * 4;
      const f = d >= 1 ? 0 : d <= this.hard ? 1 : 1 - (d - this.hard) / (1 - this.hard), fs = f * f * (3 - 2 * f);
      for (let k = 0; k < 3; k++) {
        const col = flat ? flat[k] : src[o + k] / 255 * (1 - this.blend) + mean[k] * this.blend;
        out.data[o + k] = Math.round(255 * Math.pow(Math.max(col, 0.004), a0 * fs));
      }
      out.data[o + 3] = 255;
    }
    g.putImageData(out, 0, 0); this.stamps.set(key, c); return c;
  }
  end() {
    const s = this.stroke; this.stroke = null;
    if (!s || s.x1 <= s.x0) return;
    const x = Math.max(0, Math.floor(s.x0)), y = Math.max(0, Math.floor(s.y0));
    const w = Math.min(SIZE, Math.ceil(s.x1)) - x, h = Math.min(SIZE, Math.ceil(s.y1)) - y;
    if (w <= 0 || h <= 0) return;
    this.undo.push({ x, y, p: this.bg.getImageData(x, y, w, h), m: this.bmg.getImageData(x, y, w, h), i: this.big.getImageData(x, y, w, h) });
    if (this.undo.length > 40) this.undo.shift();
  }
  back() {
    const u = this.undo.pop(); if (!u) return false;
    this.pg.putImageData(u.p, u.x, u.y); this.mg.putImageData(u.m, u.x, u.y); this.ig.putImageData(u.i, u.x, u.y); this.usedPig = true; this.dirty();
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

// Pictures laid onto a prop's thumbnail in the browser (docs/PROPGEN.md §25). A thumbnail's sticker passes say, for
// each of its pixels, which material's texture point it shows (u and v in 12 bits), how much of the pixel the prop
// covers, the light a white matt surface gets there and the gloss of a clear coat. A picture placed on the texture,
// in one of the prop's own picture slots (`pictures`: its logo, its label...) or anywhere on one of its parts (a
// `decals` entry), is looked up at every pixel (four points a pixel, from a mip level its size there), lit as its
// colour x light + gloss, toned by the thumbnail's own curve (tone.js) and laid over the picture; in a slot what the
// prop drew there goes first (the ground picture: its paint with every slot empty). Placed as Make places it
// (paint.py Frame.picture for a slot, build.py lay_pictures for a decal), so what the card shows is what Make makes.
import { agx, DEC, LIN } from "/page/tone.js";

export function loadImage(src) {
  return new Promise((ok, no) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => ok(im);
    im.onerror = () => no(new Error(`couldn't load ${src}`));
    im.src = src;
  });
}

function pixels(img, w, h) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.drawImage(img, 0, 0, w, h);
  return cx.getImageData(0, 0, w, h).data;
}

// ---- a thumbnail's passes ----------------------------------------------------------------------------------------------

// info: {passes, picture, ground, mats, islands {name: {mat, rect, mm, wrap}}, slots [...], px {material: pixels}}
export async function loadPasses(info) {
  const [pi, bi, gi] = await Promise.all([loadImage(info.passes), loadImage(info.picture), info.ground ? loadImage(info.ground) : null]);
  const W = pi.naturalWidth >> 1, H = pi.naturalHeight, n = W * H;
  const raw = pixels(pi, 2 * W, H);
  const P = { W, H, n, u: new Float32Array(n), v: new Float32Array(n), id: new Uint8Array(n), cov: new Float32Array(n),
    E: new Float32Array(n), G: new Float32Array(n), isl: new Int16Array(n).fill(-1),
    base: pixels(bi, W, H), ground: gi ? pixels(gi, W, H) : null, islands: [], slots: [] };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, a = (y * 2 * W + x) * 4, b = a + W * 4;
    const id = raw[b] >> 4;
    if (!id) continue;
    P.id[i] = id;
    P.cov[i] = (raw[b] & 15) / 15;
    P.u[i] = ((raw[a] << 4) | (raw[a + 2] >> 4)) / 4095;
    P.v[i] = ((raw[a + 1] << 4) | (raw[a + 2] & 15)) / 4095;
    P.E[i] = DEC[raw[b + 1]];
    P.G[i] = DEC[raw[b + 2]];
  }
  // the parts (islands) by material, each pixel's part, and how much of each part is seen and where
  const mats = info.mats || [];
  for (const [name, d] of Object.entries(info.islands || {})) {
    const mid = mats.indexOf(d.mat) + 1;
    if (mid > 0) P.islands.push({ name, mat: d.mat, mid, rect: d.rect, mm: d.mm, wrap: !!d.wrap, seen: 0, sx: 0, sy: 0, cs: 0, sn: 0,
      x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, px: (info.px || {})[d.mat] || 1024 });
  }
  const byMat = {};
  P.islands.forEach((s, k) => (byMat[s.mid] = byMat[s.mid] || []).push(k));
  const eps = 0.6 / 4096;
  for (let i = 0; i < n; i++) {
    const m = P.id[i];
    if (!m || !byMat[m]) continue;
    const u = P.u[i], v = P.v[i];
    for (const k of byMat[m]) {
      const r = P.islands[k].rect;
      if (u >= r[0] - eps && u <= r[2] + eps && v >= r[1] - eps && v <= r[3] + eps) { P.isl[i] = k; break; }
    }
    const k = P.isl[i];
    if (k < 0) continue;
    const s = P.islands[k], [x, y] = mmOf(s, u, v);
    s.seen++; s.sy += y; s.y0 = Math.min(s.y0, y); s.y1 = Math.max(s.y1, y);
    if (s.wrap) { const t = 2 * Math.PI * x / s.mm[0]; s.cs += Math.cos(t); s.sn += Math.sin(t); } else { s.sx += x; s.x0 = Math.min(s.x0, x); s.x1 = Math.max(s.x1, x); }
  }
  for (const s of P.islands) {
    if (!s.seen) continue;
    s.cy = s.sy / s.seen;
    if (s.wrap) {                                     // round a band: the middle of what's seen, its spread from the seen arc
      const t = Math.atan2(s.sn, s.cs), R = Math.hypot(s.cs, s.sn) / s.seen;
      s.cx = ((t / (2 * Math.PI)) * s.mm[0] + s.mm[0]) % s.mm[0];
      s.ew = s.mm[0] * Math.min(0.5, Math.sqrt(Math.max(0, 2 * (1 - R))) / Math.PI);
    } else { s.cx = s.sx / s.seen; s.ew = s.x1 - s.x0; }
    s.eh = s.y1 - s.y0;
  }
  // the prop's own picture slots, and how much of each is seen
  for (const sl of info.slots || []) {
    const k = P.islands.findIndex(s => s.name === sl.island);
    if (k < 0) continue;
    P.slots.push(Object.assign({}, sl, { isl: k, seen: 0 }));
  }
  if (P.slots.length) {
    for (let i = 0; i < n; i++) {
      const k = P.isl[i];
      if (k < 0) continue;
      const s = P.islands[k], [x, y] = mmOf(s, P.u[i], P.v[i]);
      for (const sl of P.slots) if (sl.isl === k && inBox(s, sl.box, x, y)) sl.seen++;
    }
  }
  return P;
}

function mmOf(s, u, v) {
  const r = s.rect;
  return [(u - r[0]) / Math.max(r[2] - r[0], 1e-9) * s.mm[0], (v - r[1]) / Math.max(r[3] - r[1], 1e-9) * s.mm[1]];
}

function inBox(s, b, x, y) {
  if (y < b[1] || y > b[1] + b[3]) return false;
  if (x >= b[0] && x <= b[0] + b[2]) return true;
  return s.wrap && ((x + s.mm[0] >= b[0] && x + s.mm[0] <= b[0] + b[2]) || (x - s.mm[0] >= b[0] && x - s.mm[0] <= b[0] + b[2]));
}

const RANK = { logo: 0, picture: 1, stamp: 2, text: 3, flourish: 4, pattern: 5 };

// where a picture can go on this thumbnail, the most fitting first: the prop's own picture slots that are seen (a logo
// before a picture, a stamp, words, a flourish or a pattern), then its parts as decals, the most seen first
export function spotsOf(P) {
  const tot = Math.max(1, P.islands.reduce((a, s) => a + s.seen, 0));
  const slots = P.slots.filter(sl => sl.seen >= 12)
    .sort((a, b) => (RANK[a.kind] ?? 9) - (RANK[b.kind] ?? 9) || b.seen - a.seen)
    .map(sl => ({ key: "slot:" + sl.id, kind: "slot", id: sl.id, isl: sl.isl, box: sl.box, rot: +sl.rot || 0, slotKind: sl.kind, about: sl.about || "",
      label: `${sl.id} (its ${sl.kind}${sl.about ? ": " + sl.about : ""})` }));
  const parts = P.islands.map((s, k) => ({ s, k })).filter(({ s }) => s.seen >= Math.max(40, tot * 0.03))
    .sort((a, b) => b.s.seen - a.s.seen).slice(0, 8)
    .map(({ s, k }) => ({ key: "part:" + s.name, kind: "part", island: s.name, isl: k, x: s.cx, y: s.cy,
      w: Math.max(4, Math.min(s.ew || s.mm[0], (s.eh || s.mm[1]) * 1.6) * 0.55), label: `on ${s.name} (a sticker anywhere on it)` }));
  return [...slots, ...parts];
}

// ---- a picture ready to lay: mip levels of its pixels, linear and premultiplied --------------------------------------------

export function makePic(img, maxSide = 1024) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const k = Math.min(1, maxSide / Math.max(iw, ih));
  let w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
  const d = pixels(img, w, h);
  let px = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3] / 255;
    px[i * 4] = LIN[d[i * 4]] * a; px[i * 4 + 1] = LIN[d[i * 4 + 1]] * a; px[i * 4 + 2] = LIN[d[i * 4 + 2]] * a; px[i * 4 + 3] = a;
  }
  const levels = [{ w, h, px }];
  while (w > 4 && h > 4) {
    const nw = w >> 1, nh = h >> 1, q = new Float32Array(nw * nh * 4);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) for (let c = 0; c < 4; c++) {
      const i0 = ((2 * y) * w + 2 * x) * 4 + c, i1 = ((2 * y + 1) * w + 2 * x) * 4 + c;
      q[(y * nw + x) * 4 + c] = (px[i0] + px[i0 + 4] + px[i1] + px[i1 + 4]) / 4;
    }
    levels.push({ w: nw, h: nh, px: q });
    w = nw; h = nh; px = q;
  }
  return { iw, ih, levels };
}

function sample(L, fx, fy, out) {                 // bilinear at (fx, fy) 0..1 of the level, clamped
  const x = Math.min(Math.max(fx * L.w - 0.5, 0), L.w - 1), y = Math.min(Math.max(fy * L.h - 0.5, 0), L.h - 1);
  const x0 = x | 0, y0 = y | 0, x1 = Math.min(x0 + 1, L.w - 1), y1 = Math.min(y0 + 1, L.h - 1), tx = x - x0, ty = y - y0;
  const p = L.px, a = (y0 * L.w + x0) * 4, b = (y0 * L.w + x1) * 4, c = (y1 * L.w + x0) * 4, d = (y1 * L.w + x1) * 4;
  for (let k = 0; k < 4; k++) out[k] = (p[a + k] * (1 - tx) + p[b + k] * tx) * (1 - ty) + (p[c + k] * (1 - tx) + p[d + k] * tx) * ty;
}

// ---- the placement: where on the part (mm) a point of the picture lies, as Make lays it ---------------------------------

// returns fn(x, y) -> [fx, fy] the picture's point (0..1 from its top left) or null outside it, and its size (mm)
function placer(P, spot, pl, pic) {
  const s = P.islands[spot.isl], Wm = s.mm[0], Hm = s.mm[1];
  const tint = pl.tint ? hexLin(pl.tint) : null;
  let iw = pic.iw, ih = pic.ih;
  if (spot.kind === "slot") {
    const k = ((Math.round(+(pl.rot ?? spot.rot ?? 0) / 90) % 4) + 4) % 4;   // quarter turns, anticlockwise (np.rot90)
    if (k % 2) [iw, ih] = [ih, iw];
    const [bx, by, bw, bh] = spot.box, cx = bx + bw / 2, cy = by + bh / 2;
    const fit = pl.fit || (spot.slotKind === "pattern" || (spot.slotKind === "flourish" && bw >= 4 * bh) ? "tile" : "contain");
    const z = +(pl.scale ?? 1), dx = +(pl.dx || 0), dy = +(pl.dy || 0);
    const unturn = (fx, fy) => {                    // the turned, flipped picture's point -> the picture's own
      if (pl.flip) fx = 1 - fx;
      if (k === 1) return [1 - fy, fx];
      if (k === 2) return [1 - fx, 1 - fy];
      if (k === 3) return [fy, 1 - fx];
      return [fx, fy];
    };
    if (fit === "tile") {
      const s_px = (s.rect[2] - s.rect[0]) * s.px / Wm;              // the texture's pixels a mm on this part
      let tw = pl.tile ? +pl.tile : (bw >= 4 * bh ? bh * iw / ih : iw / (2 * s_px));
      tw *= z;
      if (s.wrap && bw >= Wm * 0.95) tw = Wm / Math.max(1, Math.round(Wm / tw));
      const th = tw * ih / iw, x0 = bx + dx, y0 = by + dy;
      return { tint, at: (x, y) => {
        if (!inBox(s, spot.box, x, y)) return null;
        if (s.wrap && x < bx) x += Wm;
        const fx = (((x - x0) / tw) % 1 + 1) % 1, fy = 1 - ((((y - y0) / th) % 1) + 1) % 1;
        return unturn(fx, fy);
      }, mmw: tw };
    }
    let pw = bw, ph = bh;
    if (fit !== "stretch") { const zz = (fit === "contain" ? Math.min : Math.max)(bw / iw, bh / ih); pw = iw * zz; ph = ih * zz; }
    pw *= z; ph *= z;
    const x0 = cx + dx - pw / 2, y0 = cy + dy - ph / 2;
    return { tint, at: (x, y) => {
      if (fit === "cover" && !inBox(s, spot.box, x, y)) return null;
      let fx = (x - x0) / pw;
      if (s.wrap && (fx < 0 || fx >= 1)) { const f2 = (x + Wm - x0) / pw, f3 = (x - Wm - x0) / pw; fx = f2 >= 0 && f2 < 1 ? f2 : f3; }
      const fy = 1 - (y - y0) / ph;
      return fx >= 0 && fx < 1 && fy >= 0 && fy < 1 ? unturn(fx, fy) : null;
    }, mmw: pw };
  }
  // a decal on the part (build.py lay_pictures)
  const asp = ih / iw, fit = pl.fit;
  let w, h, x, y;
  if (fit === "stretch") [w, h, x, y] = [Wm, Hm, Wm / 2, Hm / 2];
  else if (fit === "width") [w, h, x, y] = [Wm, Wm * asp, Wm / 2, pl.y ?? Hm / 2];
  else if (fit === "height") [w, h, x, y] = [Hm / asp, Hm, pl.x ?? Wm / 2, Hm / 2];
  else if (fit === "cover" || fit === "contain") { w = (fit === "cover" ? Math.max : Math.min)(Wm, Hm / asp); h = w * asp; x = pl.x ?? Wm / 2; y = pl.y ?? Hm / 2; }
  else { w = +(pl.w ?? Wm / 3); h = +(pl.h ?? w * asp); x = +(pl.x ?? Wm / 2); y = +(pl.y ?? Hm / 2); }
  const a = (fit ? 0 : +(pl.rot || 0)) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  return { tint, at: (px, py) => {
    for (const sh of s.wrap ? [0, Wm, -Wm] : [0]) {
      const rx = px + sh - x, ry = py - y;
      const lx = rx * ca + ry * sa, ly = -rx * sa + ry * ca;           // turned back by the decal's angle
      let fx = lx / w + 0.5;
      const fy = 0.5 - ly / h;
      if (fx >= 0 && fx < 1 && fy >= 0 && fy < 1) { if (pl.flip) fx = 1 - fx; return [fx, fy]; }
    }
    return null;
  }, mmw: w };
}

function hexLin(h) {
  const v = parseInt(String(h).slice(1), 16);
  return [LIN[(v >> 16) & 255], LIN[(v >> 8) & 255], LIN[v & 255]];
}

const FINISH = { matte: 0.25, satin: 0.6, gloss: 1.0 };
const SUB = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]];

// the thumbnail with the picture laid on it: an ImageData of the thumbnail's size.
// pl: {spot, fit, scale, dx, dy, rot, flip, tint, x, y, w, h (a decal's), finish: matte|satin|gloss, replace (a slot's
// own drawing taken away under it: true)}
export function lay(P, pl, pic) {
  const { W, H, n } = P;
  const out = new ImageData(new Uint8ClampedArray(P.base), W, H);
  const spot = pl.spot;
  if (!spot || !pic) return out;
  const s = P.islands[spot.isl], R = placer(P, spot, pl, pic), L = pic.levels;
  const gk = FINISH[pl.finish] ?? FINISH.satin, replace = pl.replace !== false && spot.kind === "slot" && !!P.ground;
  const c4 = new Float32Array(4), tone = new Float32Array(3), us = new Float32Array(4), vs = new Float32Array(4);
  const lvlOf = (fw) => Math.min(L.length - 1, Math.max(0, Math.round(Math.log2(Math.max(fw, 1)))));
  const same = (i, j) => j >= 0 && j < n && P.isl[j] === spot.isl && Math.abs(P.u[j] - P.u[i]) < 0.04 && Math.abs(P.v[j] - P.v[i]) < 0.04;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (P.isl[i] !== spot.isl) continue;
    // four points in the pixel: its texture point moved toward the neighbours on the same part (away from the far one)
    const r = x < W - 1 && same(i, i + 1) ? i + 1 : -1, l = x > 0 && same(i, i - 1) ? i - 1 : -1;
    const dn = y < H - 1 && same(i, i + W) ? i + W : -1, up = y > 0 && same(i, i - W) ? i - W : -1;
    const dux = r >= 0 ? P.u[r] - P.u[i] : l >= 0 ? P.u[i] - P.u[l] : 0, dvx = r >= 0 ? P.v[r] - P.v[i] : l >= 0 ? P.v[i] - P.v[l] : 0;
    const duy = dn >= 0 ? P.u[dn] - P.u[i] : up >= 0 ? P.u[i] - P.u[up] : 0, dvy = dn >= 0 ? P.v[dn] - P.v[i] : up >= 0 ? P.v[i] - P.v[up] : 0;
    for (let k = 0; k < 4; k++) { us[k] = P.u[i] + SUB[k][0] * dux + SUB[k][1] * duy; vs[k] = P.v[i] + SUB[k][0] * dvx + SUB[k][1] * dvy; }
    let cr = 0, cg = 0, cb = 0, ca = 0, inb = 0, fx1 = 0, fy1 = 0;
    const pts = [];
    for (let k = 0; k < 4; k++) {
      const [mx, my] = mmOf(s, us[k], vs[k]);
      if (replace && inBox(s, spot.box, mx, my)) inb++;
      pts.push(R.at(mx, my));
    }
    // the mip level: the picture's pixels between neighbouring points
    if (pts[0] && pts[1]) fx1 = Math.hypot((pts[1][0] - pts[0][0]) * L[0].w, (pts[1][1] - pts[0][1]) * L[0].h);
    if (pts[0] && pts[2]) fy1 = Math.hypot((pts[2][0] - pts[0][0]) * L[0].w, (pts[2][1] - pts[0][1]) * L[0].h);
    const Lv = L[lvlOf(Math.max(fx1, fy1))];
    for (let k = 0; k < 4; k++) {
      const p = pts[k];
      if (!p) continue;
      sample(Lv, p[0], p[1], c4);
      cr += c4[0]; cg += c4[1]; cb += c4[2]; ca += c4[3];
    }
    if (ca <= 1e-4 && !inb) continue;
    const o = i * 4, cov = P.cov[i] || 1;
    let br = out.data[o], bg = out.data[o + 1], bb = out.data[o + 2];
    if (inb) {                                       // the slot's own drawing taken away: the ground under it
      const t = (inb / 4) * cov;
      br += (P.ground[o] - br) * t; bg += (P.ground[o + 1] - bg) * t; bb += (P.ground[o + 2] - bb) * t;
    }
    if (ca > 1e-4) {
      let ar = cr / ca, ag = cg / ca, ab = cb / ca;  // its own colour (linear), lit and toned
      if (R.tint) { ar *= R.tint[0]; ag *= R.tint[1]; ab *= R.tint[2]; }
      const E = P.E[i], G = P.G[i] * gk;
      agx(ar * E + G, ag * E + G, ab * E + G, tone);
      const a = (ca / 4) * cov;
      br += (tone[0] * 255 - br) * a; bg += (tone[1] * 255 - bg) * a; bb += (tone[2] * 255 - bb) * a;
    }
    out.data[o] = br; out.data[o + 1] = bg; out.data[o + 2] = bb;
  }
  return out;
}

// the placement as the recipe keeps it: a slot's {"pictures": {"<island>.<name>": {...}}} or a part's {"decals": [...]}
const ROUGH = { matte: 0.8, satin: 0.35, gloss: 0.15 };
const set = v => v !== undefined && v !== null && v !== "" && v !== false;
const r1 = v => (typeof v === "number" ? Math.round(v * 10) / 10 : v);

export function toRecipe(pl, path) {
  if (pl.spot.kind === "slot") {
    const keep = { image: path };
    if (set(pl.fit)) keep.fit = pl.fit;
    if (set(pl.scale) && +pl.scale !== 1) keep.scale = r1(+pl.scale);
    for (const k of ["dx", "dy"]) if (+pl[k]) keep[k] = r1(+pl[k]);
    if (set(pl.rot) && +pl.rot !== (pl.spot.rot || 0)) keep.rot = +pl.rot;
    if (pl.flip) keep.flip = true;
    if (set(pl.tint)) keep.tint = pl.tint;
    if (pl.finish && pl.finish !== "satin") keep.rough = ROUGH[pl.finish];
    return { pictures: { [pl.spot.id]: keep } };
  }
  const d = { image: path, island: pl.spot.island };
  for (const k of ["x", "y", "w"]) if (set(pl[k])) d[k] = r1(+pl[k]);
  if (+pl.rot) d.rot = r1(+pl.rot);
  if (set(pl.fit)) d.fit = pl.fit;
  if (pl.flip) d.flip = true;
  if (set(pl.tint)) d.tint = pl.tint;
  d.rough = ROUGH[pl.finish] ?? 0.35;
  return { decals: [d] };
}

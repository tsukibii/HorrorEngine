// The picture editor's preview on a customizable prop's own picture (docs/PROPGEN.md §25; the user, 2026-11-04: "a
// smart way of previewing what the uploaded image will look like before actually generating it"). The prop's picture
// was rendered with three cheap passes beside it (stage.py): for each of its pixels which material's texture point it
// shows (u and v in 12 bits) and how much of the pixel the prop covers, the light a white matt surface gets there and
// a clear coat's gloss. Your pictures as the editor lays them on the texture (in its own slots, as decals, sheets and
// smudges: what's changed since the make) are looked up at every pixel (four points a pixel, from a mip level of the
// size they are there), lit as their colour x light + gloss, toned by the picture's own curve (tone.js, as stage.py
// toned it) and laid over the picture; under a slot whose picture changed, the prop's picture with its slots empty
// (its ground) shows first. What Make will make, from the same camera, without Blender.
import { agx, DEC, LIN } from "/page/tone.js";

export function loadImage(src) {
  return new Promise((ok, no) => {
    const im = new Image();
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

// info: {passes, picture, ground, mats} (serve.py preview_info)
export async function loadPasses(info) {
  const [pi, bi, gi] = await Promise.all([loadImage(info.passes), loadImage(info.picture), info.ground ? loadImage(info.ground) : null]);
  const W = pi.naturalWidth >> 1, H = pi.naturalHeight, n = W * H;
  const raw = pixels(pi, 2 * W, H);
  const P = { W, H, n, mats: info.mats || [], u: new Float32Array(n), v: new Float32Array(n), id: new Uint8Array(n), cov: new Float32Array(n),
    E: new Float32Array(n), G: new Float32Array(n), base: pixels(bi, W, H), ground: gi ? pixels(gi, W, H) : null };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, a = (y * 2 * W + x) * 4, b = a + W * 4, id = raw[b] >> 4;
    if (!id) continue;
    P.id[i] = id;
    P.cov[i] = (raw[b] & 15) / 15 || 1;
    P.u[i] = ((raw[a] << 4) | (raw[a + 2] >> 4)) / 4095;
    P.v[i] = ((raw[a + 1] << 4) | (raw[a + 2] & 15)) / 4095;
    P.E[i] = DEC[raw[b + 1]];
    P.G[i] = DEC[raw[b + 2]];
  }
  return P;
}

// a texture-sized canvas as mip levels (its pixels, halved down to 32), for looking it up at the size it's seen
export function levels(canvas) {
  const out = [];
  let src = canvas, w = canvas.width, h = canvas.height;
  for (;;) {
    const g = src.getContext("2d", { willReadFrequently: true });
    out.push({ w, h, d: g.getImageData(0, 0, w, h).data });
    if (w <= 32 || h <= 32) break;
    const c = document.createElement("canvas");
    c.width = w >> 1; c.height = h >> 1;
    const cg = c.getContext("2d", { willReadFrequently: true });
    cg.imageSmoothingQuality = "high";
    cg.drawImage(src, 0, 0, c.width, c.height);
    src = c; w = c.width; h = c.height;
  }
  return out;
}

// bilinear at (u, v) (v up) of a level: premultiplied linear colour and its alpha into o (pictures over nothing)
function samplePre(L, u, v, o) {
  const x = Math.min(Math.max(u * L.w - 0.5, 0), L.w - 1), y = Math.min(Math.max((1 - v) * L.h - 0.5, 0), L.h - 1);
  const x0 = x | 0, y0 = y | 0, x1 = Math.min(x0 + 1, L.w - 1), y1 = Math.min(y0 + 1, L.h - 1), tx = x - x0, ty = y - y0, d = L.d;
  o[0] = o[1] = o[2] = o[3] = 0;
  for (const [xx, yy, wgt] of [[x0, y0, (1 - tx) * (1 - ty)], [x1, y0, tx * (1 - ty)], [x0, y1, (1 - tx) * ty], [x1, y1, tx * ty]]) {
    const k = (yy * L.w + xx) * 4, a = d[k + 3] / 255 * wgt;
    if (a <= 0) continue;
    o[0] += LIN[d[k]] * a; o[1] += LIN[d[k + 1]] * a; o[2] += LIN[d[k + 2]] * a; o[3] += a;
  }
}
// bilinear of an opaque level's colour as it's stored (0..1): the smudges that darken, a multiply
function sampleRaw(L, u, v, o) {
  const x = Math.min(Math.max(u * L.w - 0.5, 0), L.w - 1), y = Math.min(Math.max((1 - v) * L.h - 0.5, 0), L.h - 1);
  const x0 = x | 0, y0 = y | 0, x1 = Math.min(x0 + 1, L.w - 1), y1 = Math.min(y0 + 1, L.h - 1), tx = x - x0, ty = y - y0, d = L.d;
  for (let c = 0; c < 3; c++) {
    const a = d[(y0 * L.w + x0) * 4 + c], b = d[(y0 * L.w + x1) * 4 + c], e = d[(y1 * L.w + x0) * 4 + c], f = d[(y1 * L.w + x1) * 4 + c];
    o[c] = ((a * (1 - tx) + b * tx) * (1 - ty) + (e * (1 - tx) + f * tx) * ty) / 255;
  }
}

const SUB = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]];

// The picture with the editor's layers laid on it: an ImageData of the picture's size.
// layers: {material: {over: levels() of your pictures over a transparent texture, or null; mult: levels() of the
// smudges that darken over white, or null; grounds: [[u0, v0, u1, v1]] the slots whose picture changed}}
// gloss: how much of the clear coat's gloss a picture has (a print's 0.6: satin)
export function layOver(P, layers, gloss = 0.6) {
  const { W, H, n } = P;
  const out = new ImageData(new Uint8ClampedArray(P.base), W, H);
  const byId = P.mats.map(m => layers[m] || null);
  if (!byId.some(Boolean)) return out;
  const tone = new Float32Array(3), c = new Float32Array(4), m3 = new Float32Array(3), us = new Float32Array(4), vs = new Float32Array(4);
  const same = (i, j) => P.id[j] === P.id[i] && Math.abs(P.u[j] - P.u[i]) < 0.04 && Math.abs(P.v[j] - P.v[i]) < 0.04;
  const inRects = (R, u, v) => { for (const r of R) if (u >= r[0] && u <= r[2] && v >= r[1] && v <= r[3]) return true; return false; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, id = P.id[i];
    if (!id) continue;
    const L = byId[id - 1];
    if (!L) continue;
    // four points in the pixel: its texture point moved toward its neighbours on the same part (from the far one)
    const r = x < W - 1 && same(i, i + 1) ? i + 1 : -1, l = x > 0 && same(i, i - 1) ? i - 1 : -1;
    const dn = y < H - 1 && same(i, i + W) ? i + W : -1, up = y > 0 && same(i, i - W) ? i - W : -1;
    const dux = r >= 0 ? P.u[r] - P.u[i] : l >= 0 ? P.u[i] - P.u[l] : 0, dvx = r >= 0 ? P.v[r] - P.v[i] : l >= 0 ? P.v[i] - P.v[l] : 0;
    const duy = dn >= 0 ? P.u[dn] - P.u[i] : up >= 0 ? P.u[i] - P.u[up] : 0, dvy = dn >= 0 ? P.v[dn] - P.v[i] : up >= 0 ? P.v[i] - P.v[up] : 0;
    for (let k = 0; k < 4; k++) { us[k] = P.u[i] + SUB[k][0] * dux + SUB[k][1] * duy; vs[k] = P.v[i] + SUB[k][0] * dvx + SUB[k][1] * dvy; }
    const foot = Math.max(Math.hypot(dux, dvx), Math.hypot(duy, dvy));       // the texture's share across a pixel
    let cr = 0, cg = 0, cb = 0, ca = 0, mr = 0, mg = 0, mb = 0, inb = 0;
    const Lo = L.over && L.over[Math.min(L.over.length - 1, Math.max(0, Math.round(Math.log2(Math.max(foot * L.over[0].w / 2, 1)))))];
    const Lm = L.mult && L.mult[Math.min(L.mult.length - 1, Math.max(0, Math.round(Math.log2(Math.max(foot * L.mult[0].w / 2, 1)))))];
    for (let k = 0; k < 4; k++) {
      if (L.grounds && L.grounds.length && inRects(L.grounds, us[k], vs[k])) inb++;
      if (Lo) { samplePre(Lo, us[k], vs[k], c); cr += c[0]; cg += c[1]; cb += c[2]; ca += c[3]; }
      if (Lm) { sampleRaw(Lm, us[k], vs[k], m3); mr += m3[0]; mg += m3[1]; mb += m3[2]; } else { mr += 1; mg += 1; mb += 1; }
    }
    const o = i * 4, cov = P.cov[i];
    let br = out.data[o], bg = out.data[o + 1], bb = out.data[o + 2];
    if (inb && P.ground) {                     // the slot's own drawing taken away: its picture with the slots empty
      const t = (inb / 4) * cov;
      br += (P.ground[o] - br) * t; bg += (P.ground[o + 1] - bg) * t; bb += (P.ground[o + 2] - bb) * t;
    }
    if (mr < 3.99 || mg < 3.99 || mb < 3.99) {  // a smudge darkening it
      br *= 1 - (1 - mr / 4) * cov; bg *= 1 - (1 - mg / 4) * cov; bb *= 1 - (1 - mb / 4) * cov;
    }
    if (ca > 1e-4) {                           // your picture: its own colour, lit there and toned as the picture was
      const er = cr / ca, eg = cg / ca, eb = cb / ca, E = P.E[i], G = P.G[i] * gloss;
      agx(er * E + G, eg * E + G, eb * E + G, tone);
      const a = (ca / 4) * cov;
      br += (tone[0] * 255 - br) * a; bg += (tone[1] * 255 - bg) * a; bb += (tone[2] * 255 - bb) * a;
    }
    out.data[o] = br; out.data[o + 1] = bg; out.data[o + 2] = bb;
  }
  return out;
}

// The picture editor (docs/PROPGEN.md §17), after Figma: the prop's texture as a canvas in the middle with every cut
// drawn where the model's UVs put it, its parts and what's on each as layers on the left over your pictures and the
// smudges to drag in, the picked layer's settings on the right over the prop in 3D, wearing the canvas as it's edited.
//
// A picture dragged onto a part fills it (one with a transparent ground, a logo or a sticker, is placed where it's
// dropped instead); onto one of the prop's own pictures (the dashed boxes) it takes that one's place; a picture the
// texture's shape (your painting over the layout's template), or dropped off the parts or with Shift, lies over the
// whole texture in its layout (a sheet: each part its own piece). The handles move, size and turn what's picked; the
// wheel zooms, dragging the background (or a middle or right drag) pans. Under your pictures is the generator's own
// paint as the last make left it (`_paint.png`), so the canvas is what Make will lay before the wear; Make bakes it in.
// window.__pp.ed is its state, for the page's check (tools/propgen/pagetest.mjs).
import { makeViewer } from "/page/view3d.js";
import { GLTFLoader } from "/vendor/GLTFLoader.js";
import { $, el, clone, same, api, toast } from "/page/util.js";

const NS = "http://www.w3.org/2000/svg";
function sv(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v);
  for (const c of kids) if (c !== null && c !== undefined) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}

let X = null;            // the page: { S, changed }
let E = null;            // the editor's state (window.__pp.ed)
const LAYER_KEYS = ["decals", "sheets", "pictures", "smudges", "pbr"];
const HANDLE = 6;        // a handle's half size on screen (px)

const FITS = [["", "where you put it"], ["stretch", "fill the part (stretched to it)"], ["cover", "fill the part, its shape kept (cut to it)"],
  ["contain", "inside the part, its shape kept"], ["width", "across its width"], ["height", "up its height"]];

// ---- the editor's state --------------------------------------------------------------------------------------------------

function state() {
  const S = X.S;
  if (!S.ed) {
    S.ed = {
      key: null, mat: null, z: 0, ox: 0, oy: 0, sel: null, mode: "design", cuts: true, names: true, undo: [], redo: [],
      drop: null, dragging: null, open: {}, uv: {}, uvKey: null, comp: {}, viewer: null, viewKey: null, imgs: new Map(),
      info: new Map(), tints: new Map(), hover: null, pending: new Set(), op: null, frame: 0, made3d: 0,
    };
  }
  E = S.ed;
  return E;
}
const M_ = () => X.S.meta;
const spec = () => X.S.spec;

function sync() {
  const S = X.S, M = S.meta;
  const key = `${S.name}|${M ? M._mtime : "-"}`;
  if (E.key === key) return;
  const sameProp = E.key && E.key.split("|")[0] === S.name;
  E.key = key;
  if (!sameProp) { E.sel = null; E.undo = []; E.redo = []; E.z = 0; E.mat = null; E.open = {}; }
  E.comp = {};
  E.uv = {};
  E.uvKey = null;
  E.viewKey = null;
  const mats = M && M.textures ? Object.keys(M.textures) : [];
  if (!mats.includes(E.mat)) { E.mat = mats[0] || null; E.z = 0; }
  // a texture made at another size: the view fitted to it again
  const px = E.mat ? texPx(E.mat) : 0;
  if (px !== E.px) { E.px = px; E.z = 0; }
  if (E.sel && !selValid(E.sel)) E.sel = null;
}

function fileUrl(f) { const M = M_(); return `/props/${encodeURIComponent(M.name)}/${f}?v=${M._mtime || 0}`; }
const madeUrl = mat => fileUrl(M_().textures[mat][0]);
const design = mat => (M_().design || {})[mat] || {};
const paintUrl = mat => (design(mat).paint ? fileUrl(design(mat).paint) : null);
const groundUrl = mat => (design(mat).ground ? fileUrl(design(mat).ground) : null);
const texPx = mat => ((M_().materials || {})[mat] || {}).px || 1024;
const mats = () => Object.keys(M_().textures || {});
const onlyMat = () => (mats().length === 1 ? mats()[0] : null);
const partsOf = mat => Object.entries(M_().islands || {}).filter(([, i]) => i.mat === mat);

// ---- pictures: their files, loaded, their size and whether they have a transparent ground ---------------------------------

export function picUrl(path) {
  if (typeof path === "string" && path.startsWith("smudge/")) return `/smudges/${path.slice(7)}.png`;
  const p = X.S.pics.find(x => x.path === path);
  return p ? p.url : null;
}
function image(url) {
  if (!url) return null;
  let r = E.imgs.get(url);
  if (!r) {
    r = { im: new Image(), ok: false, bad: false };
    r.im.onload = () => { r.ok = true; E.info.delete(url); schedule(true); };
    r.im.onerror = () => { r.bad = true; };
    r.im.src = url;
    E.imgs.set(url, r);
  }
  return r.ok ? r.im : null;
}
const picImage = path => image(picUrl(path));
function aspect(path) { const im = picImage(path); return im ? im.naturalHeight / im.naturalWidth : 1; }
function info(path) {
  const url = picUrl(path);
  if (!url) return null;
  if (E.info.has(url)) return E.info.get(url);
  const im = image(url);
  if (!im) return null;
  const n = 48, c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(im, 0, 0, n, n);
  const d = g.getImageData(0, 0, n, n).data;
  let clear = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 200) clear++;
  const r = { w: im.naturalWidth, h: im.naturalHeight, alpha: clear > n * n * 0.03 };
  E.info.set(url, r);
  return r;
}
async function infoNow(path) {
  const url = picUrl(path);
  if (!url) return null;
  for (let i = 0; i < 200; i++) {
    const r = info(path);
    if (r) return r;
    const rr = E.imgs.get(url);
    if (rr && rr.bad) return null;
    await new Promise(res => setTimeout(res, 30));
  }
  return null;
}
// a picture multiplied by a colour (a one-colour logo recoloured), its transparency kept
function tinted(path, tint) {
  const im = picImage(path);
  if (!im || !tint || /^#?f{6}$/i.test(tint)) return im;
  const key = `${path}|${tint}`;
  let c = E.tints.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = im.naturalWidth;
  c.height = im.naturalHeight;
  const g = c.getContext("2d");
  g.drawImage(im, 0, 0);
  g.globalCompositeOperation = "multiply";
  g.fillStyle = tint;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = "destination-in";
  g.drawImage(im, 0, 0);
  E.tints.set(key, c);
  return c;
}
const iw = im => im.naturalWidth || im.width, ih = im => im.naturalHeight || im.height;

// ---- where things are: a part's millimetres (x across from its left, y up from its foot), the texture's texels (from
// its top left) and the screen -----------------------------------------------------------------------------------------------

function rectT(isl, px) { const [u0, v0, u1, v1] = isl.rect; return { x0: u0 * px, y0: (1 - v1) * px, x1: u1 * px, y1: (1 - v0) * px }; }
function mmT(isl, px, x, y) { const r = rectT(isl, px); return [r.x0 + x / isl.mm[0] * (r.x1 - r.x0), r.y1 - y / isl.mm[1] * (r.y1 - r.y0)]; }
function tMM(isl, px, tx, ty) { const r = rectT(isl, px); return [(tx - r.x0) / (r.x1 - r.x0) * isl.mm[0], (r.y1 - ty) / (r.y1 - r.y0) * isl.mm[1]]; }
function perMM(isl, px) { const r = rectT(isl, px); return [(r.x1 - r.x0) / isl.mm[0], (r.y1 - r.y0) / isl.mm[1]]; }
const toS = (tx, ty) => [E.ox + tx * E.z, E.oy + ty * E.z];
const toT = (sx, sy) => [(sx - E.ox) / E.z, (sy - E.oy) / E.z];
function partAt(tx, ty, mat = E.mat) {
  const px = texPx(mat);
  for (const [n, isl] of partsOf(mat)) {
    const r = rectT(isl, px);
    if (tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) return n;
  }
  return null;
}
// a turned box in texels: its corners from its middle (cx, cy), size (w, h) and turn (degrees anticlockwise as seen)
function corners(cx, cy, w, h, rot) {
  const a = -rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [cx + (i * w / 2) * c - (j * h / 2) * s, cy + (i * w / 2) * s + (j * h / 2) * c]);
}
function inPoly(pts, x, y) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

// ---- the layers' geometry, as the generator lays them (build.py lay_pictures, _copies, _smudge; paint.py picture) -------

function decalBox(d) {
  const isl = (M_().islands || {})[d.island];
  if (!isl) return null;
  const [W, H] = isl.mm, a = aspect(d.image), x = d.x ?? W / 2, y = d.y ?? H / 2;
  switch (d.fit) {
    case "stretch": return { x: W / 2, y: H / 2, w: W, h: H, rot: 0 };
    case "width": return { x: W / 2, y, w: W, h: W * a, rot: 0 };
    case "height": return { x, y: H / 2, w: H / a, h: H, rot: 0 };
    case "cover": case "contain": { const w = (d.fit === "cover" ? Math.max : Math.min)(W, H / a); return { x, y, w, h: w * a, rot: 0 }; }
    default: { const w = d.w ?? W / 3; return { x, y, w, h: d.h ?? w * a, rot: d.rot || 0 }; }
  }
}
function copies(d, isl, b) {
  const [W, H] = isl.mm, fl = !!d.flip, { x, y, w, h } = b;
  if (d.corners) {
    const k = d.inset ?? 2;
    return [[k + w / 2, H - k - h / 2, fl, false], [W - k - w / 2, H - k - h / 2, !fl, false], [k + w / 2, k + h / 2, fl, true], [W - k - w / 2, k + h / 2, !fl, true]];
  }
  const n = d.repeat | 0;
  if (n <= 1) return [[x, y, fl, false]];
  const along = d.along || "x", [span, size] = along === "x" ? [W, w] : [H, h], gap = d.gap;
  const step = gap != null ? size + gap : span / n, start = gap != null ? (along === "x" ? x : y) - step * (n - 1) / 2 : step / 2;
  return Array.from({ length: n }, (_, i) => {
    const c = start + i * step, m = fl !== (!!d.mirror && i % 2 === 1);
    return along === "x" ? [c, y, m, false] : [x, c, m, false];
  });
}
function smudgeBase(m) { return X.S.smudges.find(x => x.path === m.image) || {}; }
function smudgeBox(m) {
  const isl = (M_().islands || {})[m.island];
  if (!isl) return null;
  const [W, H] = isl.mm, w = m.w ?? smudgeBase(m).w ?? Math.min(W, H) / 2;
  return { x: m.x ?? W / 2, y: m.y ?? H / 2, w, h: w * aspect(m.image), rot: m.rot || 0 };
}
const scattered = m => (m.count || 1) > 1 || !m.island || m.island === "*";

// the prop's own pictures (meta.json's slots): which key of `pictures` swaps one, and what's there
function slotKey(sl, pics) {
  if (sl.id in pics) return sl.id;
  const re = k => new RegExp("^" + k.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
  return Object.keys(pics).find(k => /[*?]/.test(k) && re(k).test(sl.id)) || null;
}
function slotVal(sl, pics) { const k = slotKey(sl, pics || {}); return k ? pics[k] : undefined; }
const slotPic = v => (v && typeof v === "object" ? v : typeof v === "string" ? { image: v } : null);
const slotFit = sl => (sl.kind === "pattern" || (sl.kind === "flourish" && sl.box[2] >= 4 * sl.box[3]) ? "tile" : "contain");
const slotState = v => (v === false ? "off" : v ? "yours" : "drawn");
// where a slot's picture lies in its box (mm), as paint.py's picture() lays it; tiles: the repeat's size
function slotGeom(sl, p) {
  const isl = M_().islands[sl.island], [bx, by, bw, bh] = sl.box, cx = bx + bw / 2, cy = by + bh / 2;
  const im = picImage(p.image);
  const k = ((Math.round((p.rot ?? sl.rot ?? 0) / 90) % 4) + 4) % 4;
  let w0 = im ? iw(im) : 1, h0 = im ? ih(im) : 1;
  if (k % 2) [w0, h0] = [h0, w0];
  const fit = p.fit || slotFit(sl), z = p.scale ?? 1, dx = p.dx || 0, dy = p.dy || 0;
  if (fit === "tile") {
    const s = perMM(isl, texPx(isl.mat))[0];
    let tw = p.tile ? +p.tile : (bw >= 4 * bh ? bh * w0 / h0 : w0 / (2 * s));
    tw *= z;
    if (isl.wrap && bw >= isl.mm[0] * 0.95) tw = isl.mm[0] / Math.max(1, Math.round(isl.mm[0] / tw));
    return { fit, k, tile: [tw, tw * h0 / w0], x: bx + dx, y: by + dy, w: bw, h: bh, clip: [bx, by, bw, bh] };
  }
  let pw = bw, ph = bh;
  if (fit !== "stretch") { const zz = (fit === "contain" ? Math.min : Math.max)(bw / w0, bh / h0); pw = w0 * zz; ph = h0 * zz; }
  pw *= z;
  ph *= z;
  return { fit, k, x: cx + dx - pw / 2, y: cy + dy - ph / 2, w: pw, h: ph, clip: fit === "cover" ? [bx, by, bw, bh] : null };
}
// a slot's picture turned by quarter turns, mirrored and tinted, as paint.py does before laying it
function slotImage(sl, p) {
  const im = tinted(p.image, p.tint);
  if (!im) return null;
  const k = ((Math.round((p.rot ?? sl.rot ?? 0) / 90) % 4) + 4) % 4;
  if (!k && !p.flip) return im;
  const key = `${p.image}|${p.tint || ""}|${k}|${!!p.flip}`;
  let c = E.tints.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  [c.width, c.height] = k % 2 ? [ih(im), iw(im)] : [iw(im), ih(im)];
  const g = c.getContext("2d");
  g.translate(c.width / 2, c.height / 2);
  g.rotate(-k * Math.PI / 2);                 // numpy's rot90: anticlockwise
  if (p.flip) g.scale(-1, 1);
  g.drawImage(im, -iw(im) / 2, -ih(im) / 2);
  E.tints.set(key, c);
  return c;
}

// ---- the canvas: the paint under your pictures, then the pictures, drawn as Make will lay them ----------------------------

function compose(mat) {
  const M = M_(), S = X.S, px = texPx(mat);
  let c = E.comp[mat];
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = px;
    c.className = "pe-tex";
    E.comp[mat] = c;
  }
  const g = c.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  const made = image(madeUrl(mat));
  if (E.mode === "made") {
    g.clearRect(0, 0, px, px);
    if (made) g.drawImage(made, 0, 0, px, px);
    return c;
  }
  const pu = paintUrl(mat), base = pu ? image(pu) : made;
  g.fillStyle = ((M.materials || {})[mat] || {}).color || "#808080";
  g.fillRect(0, 0, px, px);
  if (base) g.drawImage(base, 0, 0, px, px);
  // the prop's own pictures changed since the make: what's under them (`_ground.png`), then yours
  const pics = S.spec.pictures || {}, madePics = (M.spec && M.spec.pictures) || {};
  const ground = groundUrl(mat) ? image(groundUrl(mat)) : null;
  E.pending = new Set();
  for (const sl of M.slots || []) {
    const isl = M.islands[sl.island];
    if (!isl || isl.mat !== mat || sl.relief) continue;
    const now = slotVal(sl, pics), then = slotVal(sl, madePics);
    if (same(now, then)) continue;
    const [bx, by, bw, bh] = sl.box, [tx0, ty1] = mmT(isl, px, bx, by), [tx1, ty0] = mmT(isl, px, bx + bw, by + bh);
    if (ground) {
      const r = rectT(isl, px), x0 = Math.max(tx0 - 2, r.x0), y0 = Math.max(ty0 - 2, r.y0), x1 = Math.min(tx1 + 2, r.x1), y1 = Math.min(ty1 + 2, r.y1);
      if (x1 > x0 && y1 > y0) g.drawImage(ground, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    }
    const p = slotPic(now);
    if (p) drawSlot(g, sl, p, px);
    else if (now === undefined) E.pending.add(sl.id);      // the generator's own again: drawn by the next make
  }
  for (const sh of S.spec.sheets || []) if ((sh.mat || onlyMat()) === mat) drawSheet(g, sh, mat, px);
  for (const d of S.spec.decals || []) { const isl = M.islands[d.island]; if (isl && isl.mat === mat) drawDecal(g, d, isl, px); }
  for (const m of S.spec.smudges || []) { const isl = M.islands[m.island]; if (isl && isl.mat === mat && !scattered(m)) drawSmudge(g, m, isl, px); }
  return c;
}

function clipPart(g, isl, px) { const r = rectT(isl, px); g.beginPath(); g.rect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); g.clip(); }

function drawDecal(g, d, isl, px) {
  const im = tinted(d.image, d.tint), b = decalBox(d);
  if (!im || !b) return;
  const [kx, ky] = perMM(isl, px);
  g.save();
  clipPart(g, isl, px);
  g.globalAlpha = Math.max(0, Math.min(1, d.alpha ?? 1));
  for (const [cx, cy, fx, fy] of copies(d, isl, b)) {
    const rot = (d.fit ? 0 : b.rot) * (fx === fy ? 1 : -1);
    for (const sh of isl.wrap ? [0, -isl.mm[0], isl.mm[0]] : [0]) {
      const [tx, ty] = mmT(isl, px, cx + sh, cy);
      g.save();
      g.translate(tx, ty);
      g.rotate(-rot * Math.PI / 180);
      g.scale(fx ? -1 : 1, fy ? -1 : 1);
      g.drawImage(im, -b.w * kx / 2, -b.h * ky / 2, b.w * kx, b.h * ky);
      g.restore();
    }
  }
  g.restore();
}

function drawSlot(g, sl, p, px) {
  const isl = M_().islands[sl.island], im = slotImage(sl, p);
  if (!im) return;
  const G = slotGeom(sl, p);
  g.save();
  clipPart(g, isl, px);
  if (G.clip || G.tile) {
    const [cx, cy, cw, ch] = G.clip, [a0, b1] = mmT(isl, px, cx, cy), [a1, b0] = mmT(isl, px, cx + cw, cy + ch);
    g.beginPath();
    g.rect(a0, b0, a1 - a0, b1 - b0);
    g.clip();
  }
  g.globalAlpha = Math.max(0, Math.min(1, p.alpha ?? 1));
  const shifts = isl.wrap ? [0, -isl.mm[0], isl.mm[0]] : [0];
  if (G.tile) {
    const [tw, th] = G.tile, [kx, ky] = perMM(isl, px);
    const i0 = Math.floor((sl.box[0] - G.x) / tw) - 1, i1 = Math.ceil((sl.box[0] + sl.box[2] - G.x) / tw) + 1;
    const j0 = Math.floor((sl.box[1] - G.y) / th) - 1, j1 = Math.ceil((sl.box[1] + sl.box[3] - G.y) / th) + 1;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const [tx, ty] = mmT(isl, px, G.x + i * tw, G.y + (j + 1) * th);
      g.drawImage(im, tx, ty, tw * kx, th * ky);
    }
  } else {
    for (const sh of shifts) {
      const [tx, ty] = mmT(isl, px, G.x + sh, G.y + G.h), [kx, ky] = perMM(isl, px);
      g.drawImage(im, tx, ty, G.w * kx, G.h * ky);
    }
  }
  g.restore();
}

function drawSheet(g, sh, mat, px) {
  const im = tinted(sh.image, sh.tint);
  if (!im) return;
  const [x0, y0, x1, y1] = sh.at || [0, 0, 1, 1], lay = sh.layout;
  g.save();
  g.globalAlpha = Math.max(0, Math.min(1, sh.alpha ?? 1));
  for (const [name, isl] of partsOf(mat)) {
    if (lay && !(name in lay)) continue;
    const old = lay ? lay[name] : isl.rect;
    // the piece of the picture over the part's place when it was laid, in the picture's fractions
    const fx0 = (old[0] - x0) / (x1 - x0), fx1 = (old[2] - x0) / (x1 - x0);
    const fy0 = (1 - old[3] - y0) / (y1 - y0), fy1 = (1 - old[1] - y0) / (y1 - y0);
    const cx0 = Math.max(fx0, 0), cx1 = Math.min(fx1, 1), cy0 = Math.max(fy0, 0), cy1 = Math.min(fy1, 1);
    if (cx1 <= cx0 || cy1 <= cy0) continue;
    const r = rectT(isl, px), W = r.x1 - r.x0, H = r.y1 - r.y0;
    const dx0 = r.x0 + (cx0 - fx0) / (fx1 - fx0) * W, dx1 = r.x0 + (cx1 - fx0) / (fx1 - fx0) * W;
    const dy0 = r.y0 + (cy0 - fy0) / (fy1 - fy0) * H, dy1 = r.y0 + (cy1 - fy0) / (fy1 - fy0) * H;
    g.drawImage(im, cx0 * iw(im), cy0 * ih(im), (cx1 - cx0) * iw(im), (cy1 - cy0) * ih(im), dx0, dy0, dx1 - dx0, dy1 - dy0);
  }
  g.restore();
}

function drawSmudge(g, m, isl, px) {
  const im = tinted(m.image, m.tint), b = smudgeBox(m);
  if (!im || !b) return;
  const [kx, ky] = perMM(isl, px);
  g.save();
  clipPart(g, isl, px);
  g.globalAlpha = Math.max(0, Math.min(1, m.strength ?? 0.8));
  g.globalCompositeOperation = (m.blend || smudgeBase(m).blend || "multiply") === "mix" ? "source-over" : "multiply";
  for (const sh of isl.wrap ? [0, -isl.mm[0], isl.mm[0]] : [0]) {
    const [tx, ty] = mmT(isl, px, b.x + sh, b.y);
    g.save();
    g.translate(tx, ty);
    g.rotate(-b.rot * Math.PI / 180);
    if (m.flip) g.scale(-1, 1);
    g.drawImage(im, -b.w * kx / 2, -b.h * ky / 2, b.w * kx, b.h * ky);
    g.restore();
  }
  g.restore();
}

// ---- the cuts: the model's own UV layout read from the made .glb (the edges only one triangle has are where it's cut),
// and the texture outside every triangle dimmed ------------------------------------------------------------------------------

async function loadUV() {
  const M = M_(), key = E.key;
  if (!M || E.uvKey === key) return;
  E.uvKey = key;
  const glb = (M.files || []).find(f => f.endsWith(".glb"));
  if (!glb) return;
  let gltf;
  try { gltf = await new GLTFLoader().loadAsync(fileUrl(glb)); } catch { return; }
  if (E.key !== key) return;
  const per = {};
  gltf.scene.traverse(o => {
    if (!o.isMesh || /_liquid$/.test(o.name)) return;
    const geo = o.geometry, uv = geo.attributes.uv, ix = geo.index;
    if (!uv) return;
    const ms = [].concat(o.material);
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: ix ? ix.count : uv.count, materialIndex: 0 }];
    for (const gr of groups) {
      const m = ms[gr.materialIndex || 0] || ms[0];
      const mat = (m.name || "").startsWith(M.name + "_") ? m.name.slice(M.name.length + 1) : m.name;
      const T = (per[mat] = per[mat] || []);
      for (let i = gr.start; i < gr.start + gr.count; i++) { const v = ix ? ix.getX(i) : i; T.push(uv.getX(v), uv.getY(v)); }
    }
  });
  for (const [mat, T] of Object.entries(per)) {
    if (!(mat in (M.textures || {}))) continue;
    const cnt = new Map(), q = v => Math.round(v * 262144);
    for (let i = 0; i < T.length; i += 6) {
      for (const [a, b] of [[0, 2], [2, 4], [4, 0]]) {
        const ka = q(T[i + a]) * 1e7 + q(T[i + a + 1]), kb = q(T[i + b]) * 1e7 + q(T[i + b + 1]);
        const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        const e = cnt.get(k);
        if (e) e.n++; else cnt.set(k, { n: 1, s: [T[i + a], T[i + a + 1], T[i + b], T[i + b + 1]] });
      }
    }
    const segs = [];
    for (const e of cnt.values()) if (e.n === 1) segs.push(...e.s);
    const mk = document.createElement("canvas"), n = Math.min(texPx(mat), 1024);
    mk.width = mk.height = n;
    const g = mk.getContext("2d");
    g.fillStyle = g.strokeStyle = "#fff";
    g.lineWidth = 1.2;
    g.beginPath();
    for (let i = 0; i < T.length; i += 6) {
      g.moveTo(T[i] * n, T[i + 1] * n);
      g.lineTo(T[i + 2] * n, T[i + 3] * n);
      g.lineTo(T[i + 4] * n, T[i + 5] * n);
      g.closePath();
    }
    g.fill();
    g.stroke();
    E.uv[mat] = { segs, mask: mk, tris: T.length / 6 };
  }
  stage();
  schedule();
}

// ---- drawing it all: the stage (the canvas, the dimming and the cuts, moved and scaled as one) and the overlay (the parts'
// names, the pictures' outlines, the handles, a drop's target: drawn in screen pixels, so they stay one size) -------------

let raf = 0, rafAll = false, last3d = 0;
function schedule(all = false) {
  rafAll = rafAll || all;
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    const a = rafAll;
    rafAll = false;
    if (!E || !X.S.meta || X.S.tab !== "texture" || !$(".pe")) return;
    if (E.mat) compose(E.mat);
    overlay();
    if (a) renderLayers();
    const now = performance.now();
    if (now - last3d > (E.op ? 120 : 0)) { last3d = now; wear3d(); } else setTimeout(() => schedule(), 130);
  });
}

function stage() {
  const st = $(".pe-stage");
  if (!st || !E.mat) return;
  const px = texPx(E.mat);
  st.style.width = st.style.height = px + "px";
  st.innerHTML = "";
  st.append(compose(E.mat));
  const dim = document.createElement("canvas");
  dim.className = "pe-dim";
  const uv = E.uv[E.mat];
  if (uv) {
    dim.width = dim.height = uv.mask.width;
    const g = dim.getContext("2d");
    g.fillStyle = "rgba(10,10,12,0.62)";
    g.fillRect(0, 0, dim.width, dim.height);
    g.globalCompositeOperation = "destination-out";
    g.drawImage(uv.mask, 0, 0);
    dim.hidden = !E.cuts || E.mode === "made";
    st.append(dim);
    const d = [];
    const s = uv.segs;
    for (let i = 0; i < s.length; i += 4) d.push(`M${(s[i] * px).toFixed(1)} ${(s[i + 1] * px).toFixed(1)}L${(s[i + 2] * px).toFixed(1)} ${(s[i + 3] * px).toFixed(1)}`);
    const svg = sv("svg", { class: "pe-cuts", viewBox: `0 0 ${px} ${px}`, width: px, height: px });
    svg.append(sv("path", { d: d.join(""), "vector-effect": "non-scaling-stroke" }));
    svg.style.display = E.cuts ? "" : "none";
    st.append(svg);
  }
  place();
}

function place() {
  const st = $(".pe-stage");
  if (!st) return;
  if (!E.z) fit();
  st.style.transform = `translate(${E.ox}px, ${E.oy}px) scale(${E.z})`;
  st.classList.toggle("pix", E.z > 2.5);
  const z = $(".pe-zoom");
  if (z) z.textContent = `${Math.round(E.z * 100)}%`;
  overlay();
}

// the view fitted to a box of texels (`to`), or to the parts (a texture's empty corner left out)
function fit(to) {
  const box = $(".pe-canvas");
  if (!box || !E.mat) return;
  const px = texPx(E.mat), W = box.clientWidth || 600, H = box.clientHeight || 500;
  let all = [px, px, 0, 0];
  for (const [, isl] of partsOf(E.mat)) { const r = rectT(isl, px); all = [Math.min(all[0], r.x0), Math.min(all[1], r.y0), Math.max(all[2], r.x1), Math.max(all[3], r.y1)]; }
  if (all[2] <= all[0]) all = [0, 0, px, px];
  else { const m = px * 0.015; all = [Math.max(0, all[0] - m), Math.max(0, all[1] - m), Math.min(px, all[2] + m), Math.min(px, all[3] + m)]; }
  let [x0, y0, x1, y1] = to || all;
  const pad = to ? 40 : 16;
  E.auto = !to;
  E.z = Math.max(0.05, Math.min(16, Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0))));
  E.ox = (W - (x1 - x0) * E.z) / 2 - x0 * E.z;
  E.oy = (H - (y1 - y0) * E.z) / 2 - y0 * E.z;
}
function zoomAt(f, sx, sy) {
  const z = Math.max(0.05, Math.min(32, E.z * f));
  E.auto = false;
  E.ox = sx - (sx - E.ox) * (z / E.z);
  E.oy = sy - (sy - E.oy) * (z / E.z);
  E.z = z;
  place();
}
function zoomTo(sel) {
  const f = frameOf(sel);
  if (!f) return;
  const xs = f.pts.map(p => p[0]), ys = f.pts.map(p => p[1]);
  fit([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
  place();
}

// a layer's frame on the texture (texels): its turned box's corners, its middle, size and turn, and what dragging it does
function frameOf(sel) {
  if (!sel) return null;
  const M = M_(), sp = spec();
  if (sel.kind === "part") {
    const isl = M.islands[sel.island];
    if (!isl) return null;
    const r = rectT(isl, texPx(isl.mat));
    return { mat: isl.mat, pts: corners((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, r.x1 - r.x0, r.y1 - r.y0, 0), handles: false, rot: false };
  }
  if (sel.kind === "decal") {
    const d = (sp.decals || [])[sel.i], b = d && decalBox(d), isl = d && M.islands[d.island];
    if (!b) return null;
    const px = texPx(isl.mat), [kx, ky] = perMM(isl, px), [c0] = copies(d, isl, b), [cx, cy] = mmT(isl, px, c0[0], c0[1]);
    const r = d.fit ? 0 : b.rot * (c0[2] === c0[3] ? 1 : -1);
    return { mat: isl.mat, pts: corners(cx, cy, b.w * kx, b.h * ky, r), cx, cy, w: b.w * kx, h: b.h * ky, rotd: r, handles: true, rot: true };
  }
  if (sel.kind === "smudge") {
    const m = (sp.smudges || [])[sel.i], b = m && !scattered(m) && smudgeBox(m), isl = m && M.islands[m.island];
    if (!b) return null;
    const px = texPx(isl.mat), [kx, ky] = perMM(isl, px), [cx, cy] = mmT(isl, px, b.x, b.y);
    return { mat: isl.mat, pts: corners(cx, cy, b.w * kx, b.h * ky, b.rot), cx, cy, w: b.w * kx, h: b.h * ky, rotd: b.rot, handles: true, rot: true, keep: true };
  }
  if (sel.kind === "slot") {
    const sl = (M.slots || []).find(x => x.id === sel.id), isl = sl && M.islands[sl.island];
    if (!isl) return null;
    const px = texPx(isl.mat), p = slotPic(slotVal(sl, sp.pictures || {}));
    const box = (x, y, w, h) => { const [a0, b1] = mmT(isl, px, x, y), [a1, b0] = mmT(isl, px, x + w, y + h); return { cx: (a0 + a1) / 2, cy: (b0 + b1) / 2, w: a1 - a0, h: b1 - b0 }; };
    const B = box(...sl.box);
    if (p && picImage(p.image)) {
      const G = slotGeom(sl, p);
      const P = G.tile ? B : box(G.x, G.y, G.w, G.h);
      return { mat: isl.mat, pts: corners(P.cx, P.cy, P.w, P.h, 0), box: corners(B.cx, B.cy, B.w, B.h, 0), cx: P.cx, cy: P.cy, w: P.w, h: P.h, rotd: 0,
        handles: !G.tile, rot: false, keep: true };
    }
    return { mat: isl.mat, pts: corners(B.cx, B.cy, B.w, B.h, 0), handles: false, rot: false };
  }
  if (sel.kind === "sheet") {
    const sh = (sp.sheets || [])[sel.i];
    if (!sh) return null;
    const mat = sh.mat || onlyMat(), px = texPx(mat), [x0, y0, x1, y1] = sh.at || [0, 0, 1, 1];
    return { mat, pts: corners((x0 + x1) / 2 * px, (y0 + y1) / 2 * px, (x1 - x0) * px, (y1 - y0) * px, 0), cx: (x0 + x1) / 2 * px, cy: (y0 + y1) / 2 * px,
      w: (x1 - x0) * px, h: (y1 - y0) * px, rotd: 0, handles: true, rot: false };
  }
  return null;
}
function handlesOf(f) {
  if (!f || !f.handles) return [];
  const [a, b, c, d] = f.pts, mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const hs = [["nw", a], ["ne", b], ["se", c], ["sw", d], ["n", mid(a, b)], ["e", mid(b, c)], ["s", mid(c, d)], ["w", mid(d, a)]];
  if (f.rot) {
    const top = mid(a, b), ctr = [f.cx, f.cy], v = [top[0] - ctr[0], top[1] - ctr[1]], L = Math.hypot(...v) || 1, k = 22 / E.z;
    hs.push(["rot", [top[0] + v[0] / L * k, top[1] + v[1] / L * k]]);
  }
  return hs.map(([name, p]) => ({ name, t: p, s: toS(...p) }));
}

function overlay() {
  const svg = $(".pe-over");
  if (!svg || !E.mat || !M_()) return;
  svg.innerHTML = "";
  const M = M_(), sp = spec(), px = texPx(E.mat), box = $(".pe-canvas"), W = box.clientWidth, H = box.clientHeight;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const poly = (pts, cls, extra = {}) => sv("polygon", Object.assign({ points: pts.map(p => toS(...p).map(v => v.toFixed(1)).join(",")).join(" "), class: cls }, extra));
  const sel = E.sel, hov = E.hover;
  // the parts: their outlines when picked or under the pointer, their names
  for (const [n, isl] of partsOf(E.mat)) {
    const r = rectT(isl, px), [sx0, sy0] = toS(r.x0, r.y0), [sx1, sy1] = toS(r.x1, r.y1);
    if (sx1 < 0 || sy1 < 0 || sx0 > W || sy0 > H) continue;
    const on = (sel && sel.kind === "part" && sel.island === n) || (hov && hov.kind === "part" && hov.island === n);
    if (on) svg.append(sv("rect", { x: sx0, y: sy0, width: sx1 - sx0, height: sy1 - sy0, class: "pe-part" + (sel && sel.island === n && sel.kind === "part" ? " sel" : "") }));
    if (E.names && sx1 - sx0 > 44 && sy1 - sy0 > 14) {
      svg.append(sv("text", { x: sx0 + 3, y: sy0 + 11, class: "pe-name" }, sx1 - sx0 > 110 ? `${n} ${isl.mm[0]}×${isl.mm[1]}` : n));
    }
  }
  // the prop's own pictures (dashed boxes): those made again on the next make hatched
  for (const sl of M.slots || []) {
    const isl = M.islands[sl.island];
    if (!isl || isl.mat !== E.mat) continue;
    const f = frameOf({ kind: "slot", id: sl.id });
    const st = slotState(slotVal(sl, sp.pictures || {}));
    svg.append(poly(f.box || f.pts, "pe-slot " + st + (E.pending.has(sl.id) ? " pending" : "")));
  }
  // your pictures and the smudges on this texture
  (sp.decals || []).forEach((d, i) => {
    const isl = M.islands[d.island], b = decalBox(d);
    if (!isl || isl.mat !== E.mat || !b) return;
    const [kx, ky] = perMM(isl, px);
    copies(d, isl, b).forEach(([cx, cy, fx, fy], k) => {
      const [tx, ty] = mmT(isl, px, cx, cy), r = d.fit ? 0 : b.rot * (fx === fy ? 1 : -1);
      svg.append(poly(corners(tx, ty, b.w * kx, b.h * ky, r), "pe-dec" + (k ? " copy" : "")));
    });
  });
  (sp.smudges || []).forEach((m, i) => {
    const isl = M.islands[m.island], b = smudgeBox(m);
    if (!isl || isl.mat !== E.mat || !b || scattered(m)) return;
    const [kx, ky] = perMM(isl, px), [tx, ty] = mmT(isl, px, b.x, b.y);
    svg.append(poly(corners(tx, ty, b.w * kx, b.h * ky, b.rot), "pe-smu"));
  });
  // under the pointer, then the picked one with its handles
  if (hov && hov.kind !== "part" && !same(hov, sel)) {
    const f = frameOf(hov);
    if (f && f.mat === E.mat) svg.append(poly(f.pts, "pe-hov"));
  }
  const f = frameOf(sel);
  if (f && f.mat === E.mat) {
    if (sel.kind !== "part") svg.append(poly(f.pts, "pe-selbox"));
    for (const h of handlesOf(f)) {
      if (h.name === "rot") {
        const top = toS(...handlesOf(f).find(x => x.name === "n").t);
        svg.append(sv("line", { x1: top[0], y1: top[1], x2: h.s[0], y2: h.s[1], class: "pe-rotline" }));
        svg.append(sv("circle", { cx: h.s[0], cy: h.s[1], r: HANDLE, class: "pe-h rot", "data-h": "rot" }));
      } else svg.append(sv("rect", { x: h.s[0] - HANDLE / 1.2, y: h.s[1] - HANDLE / 1.2, width: HANDLE * 1.66, height: HANDLE * 1.66, class: "pe-h", "data-h": h.name }));
    }
  }
  // the part's middle lines a moved picture has snapped to
  if (E.op && E.snap && E.snap.island && M.islands[E.snap.island]) {
    const r = rectT(M.islands[E.snap.island], px);
    if (E.snap.x) { const [a, b] = toS((r.x0 + r.x1) / 2, r.y0), [, d] = toS(0, r.y1); svg.append(sv("line", { x1: a, y1: b, x2: a, y2: d, class: "pe-snap" })); }
    if (E.snap.y) { const [a, b] = toS(r.x0, (r.y0 + r.y1) / 2), [c] = toS(r.x1, 0); svg.append(sv("line", { x1: a, y1: b, x2: c, y2: b, class: "pe-snap" })); }
  }
  // a drag's target
  const D = E.drop;
  if (D) {
    let pts = null;
    if (D.kind === "sheet") pts = corners(px / 2, px / 2, px, px, 0);
    else if (D.kind === "slot") { const sf = frameOf({ kind: "slot", id: D.id }); pts = sf.box || sf.pts; }
    else if (D.island) { const r = rectT(M.islands[D.island], px); pts = corners((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, r.x1 - r.x0, r.y1 - r.y0, 0); }
    if (pts) svg.append(poly(pts, "pe-drop " + D.kind));
  }
}

// ---- editing: every change one step for Ctrl+Z ---------------------------------------------------------------------------

function snap() {
  const sp = spec(), o = {};
  for (const k of LAYER_KEYS) if (sp[k] !== undefined) o[k] = sp[k];
  return JSON.stringify(o);
}
function restore(s) {
  const sp = spec(), o = JSON.parse(s);
  for (const k of LAYER_KEYS) { if (k in o) sp[k] = o[k]; else delete sp[k]; }
}
function tidy() {
  const sp = spec();
  for (const k of ["decals", "sheets", "smudges"]) if (Array.isArray(sp[k]) && !sp[k].length) delete sp[k];
  for (const k of ["pictures", "pbr"]) if (sp[k] && typeof sp[k] === "object" && !Object.keys(sp[k]).length) delete sp[k];
}
function edit(fn) {
  const before = snap();
  const r = fn();
  tidy();
  if (snap() !== before) {
    E.undo.push(before);
    if (E.undo.length > 300) E.undo.shift();
    E.redo = [];
    X.changed();
  }
  if (E.sel && !selValid(E.sel)) E.sel = null;
  refresh();
  return r;
}
function begin() { if (!E.opBefore) E.opBefore = snap(); }
function commit() {
  const b = E.opBefore;
  E.opBefore = null;
  tidy();
  if (b && snap() !== b) { E.undo.push(b); E.redo = []; X.changed(); }
  refresh();
}
function undo() {
  if (!E.undo.length) { toast("Nothing to undo"); return; }
  E.redo.push(snap());
  restore(E.undo.pop());
  afterHistory();
}
function redo() {
  if (!E.redo.length) return;
  E.undo.push(snap());
  restore(E.redo.pop());
  afterHistory();
}
function afterHistory() {
  tidy();
  if (E.sel && !selValid(E.sel)) E.sel = null;
  X.changed();
  E.comp = {};
  stage();
  refresh();
}
function selValid(sel) {
  const sp = spec(), M = M_();
  if (!sel || !M) return false;
  if (sel.kind === "decal") return !!(sp.decals || [])[sel.i];
  if (sel.kind === "smudge") return !!(sp.smudges || [])[sel.i];
  if (sel.kind === "sheet") return !!(sp.sheets || [])[sel.i];
  if (sel.kind === "slot") return (M.slots || []).some(s => s.id === sel.id);
  if (sel.kind === "part") return !!(M.islands || {})[sel.island];
  return false;
}
function layerOf(sel) {
  const sp = spec();
  if (!sel) return null;
  if (sel.kind === "decal") return (sp.decals || [])[sel.i];
  if (sel.kind === "smudge") return (sp.smudges || [])[sel.i];
  if (sel.kind === "sheet") return (sp.sheets || [])[sel.i];
  return null;
}
function matOf(sel) {
  const M = M_(), sp = spec();
  if (!sel) return null;
  if (sel.kind === "part") return (M.islands[sel.island] || {}).mat;
  if (sel.kind === "slot") { const sl = (M.slots || []).find(s => s.id === sel.id); return sl && (M.islands[sl.island] || {}).mat; }
  if (sel.kind === "sheet") { const sh = (sp.sheets || [])[sel.i]; return sh && (sh.mat || onlyMat()); }
  const l = layerOf(sel);
  return l && (M.islands[l.island] || {}).mat;
}
export function select(sel, { zoom = false } = {}) {
  E.sel = sel && selValid(sel) ? sel : null;
  const m = matOf(E.sel);
  if (m && m !== E.mat) { E.mat = m; E.z = 0; stage(); renderBar(); }
  if (E.sel && E.sel.kind === "part") E.open[E.sel.island] = true;
  const l = layerOf(E.sel);
  if (l && l.island) E.open[l.island] = true;
  if (E.sel && E.sel.kind === "slot") { const sl = M_().slots.find(s => s.id === E.sel.id); if (sl) E.open[sl.island] = true; }
  if (zoom && E.sel) zoomTo(E.sel);
  refresh();
}
function refresh() {
  renderLayers();
  renderProps();
  schedule();
  const u = $(".pe-undo"), r = $(".pe-redo");
  if (u) u.disabled = !E.undo.length;
  if (r) r.disabled = !E.redo.length;
}
const r1 = v => Math.round(v * 10) / 10;
const r4 = v => Math.round(v * 10000) / 10000;
const clampTo = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));

// ---- what a dropped picture does ------------------------------------------------------------------------------------------

function onSlotAt(tx, ty) {
  const M = M_(), px = texPx(E.mat);
  let best = null, area = Infinity;
  for (const sl of M.slots || []) {
    const isl = M.islands[sl.island];
    if (!isl || isl.mat !== E.mat) continue;
    const [bx, by, bw, bh] = sl.box, [a0, b1] = mmT(isl, px, bx, by), [a1, b0] = mmT(isl, px, bx + bw, by + bh);
    if (tx >= a0 - 2 && tx <= a1 + 2 && ty >= b0 - 2 && ty <= b1 + 2 && bw * bh < area) { best = sl; area = bw * bh; }
  }
  return best;
}
function dropTarget(e, inf) {
  const b = $(".pe-canvas").getBoundingClientRect(), [tx, ty] = toT(e.clientX - b.left, e.clientY - b.top), M = M_();
  const drag = E.dragging, px = texPx(E.mat);
  if (drag && drag.kind === "smudge") {
    const p = partAt(tx, ty);
    if (!p) return null;
    const [x, y] = tMM(M.islands[p], px, tx, ty);
    return { kind: "smudge", island: p, x, y, label: `a smudge on ${p}` };
  }
  inf = inf || (drag && drag.path ? info(drag.path) : null);
  // the texture's shape: square, the texture's size (or twice, four times: a template painted over), or an opaque one
  // three quarters of it or more (painted and flattened)
  const texLike = inf && Math.abs(inf.w / inf.h - 1) < 0.03 &&
    ([1, 2, 4].some(k => Math.abs(inf.w - px * k) <= px * k * 0.01) || (!inf.alpha && inf.w >= px * 0.75));
  if (e.shiftKey) return { kind: "sheet", label: "over the whole texture, laid in its layout" };
  const p = partAt(tx, ty);
  if (!p) return { kind: "sheet", label: "over the whole texture, laid in its layout (off the parts)" };
  const isl = M.islands[p], [x, y] = tMM(isl, px, tx, ty);
  if (texLike && !e.altKey) return { kind: "sheet", label: "over the whole texture, laid in its layout: it's the texture's shape (Alt: on the part)" };
  const sl = e.altKey ? null : onSlotAt(tx, ty);
  const a = inf ? inf.h / inf.w : null, near = (u, v) => Math.abs(u - v) / v < 0.06;
  // a picture the part's shape (a label, a cover) is for all of the part: unless it's the shape of the box it's on, and
  // that box is only some of the part (a book's cover art), it covers the part, its own pictures and all
  const partShaped = a && !inf.alpha && near(a, isl.mm[1] / isl.mm[0]);
  const slotAll = sl && sl.box[2] * sl.box[3] >= 0.8 * isl.mm[0] * isl.mm[1];
  if (sl && !(partShaped && (slotAll || !near(a, sl.box[3] / sl.box[2])))) {
    return { kind: "slot", id: sl.id, label: `in place of its own ${sl.kind} ${sl.id}${sl.about ? ` (${sl.about})` : ""} · Alt: the whole part` };
  }
  const how = !inf ? "fills it (one with a transparent ground is placed here)" : inf.alpha ? "placed here" : partShaped ? "fills it" : "fills it, its shape kept";
  return { kind: "part", island: p, x, y, label: `${p}, ${isl.mm[0]} × ${isl.mm[1]} mm: ${how}` };
}
function addDecal(island, path, inf, x, y) {
  const isl = M_().islands[island], [W, H] = isl.mm, a = inf ? inf.h / inf.w : 1;
  let d;
  if (inf && inf.alpha) {                  // a logo, a sticker: placed where it was dropped, half the part's size
    const w = Math.min(W, H / a) * 0.5, h = w * a;
    d = { image: path, island, x: r1(clampTo(x ?? W / 2, w / 2, W - w / 2)), y: r1(clampTo(y ?? H / 2, h / 2, H - h / 2)), w: r1(w) };
  } else {                                 // a label, a cover: over all of the part
    d = { image: path, island, fit: Math.abs(a - H / W) / (H / W) < 0.1 ? "stretch" : "cover" };
  }
  const sp = spec();
  sp.decals = [...(sp.decals || []), d];
  return { kind: "decal", i: sp.decals.length - 1 };
}
async function fillPart(n, path) {
  const inf = await infoNow(path), isl = M_().islands[n], a = inf ? inf.h / inf.w : 1;
  let sel = null;
  edit(() => {
    const sp = spec();
    sp.decals = [...(sp.decals || []), { image: path, island: n, fit: Math.abs(a - isl.mm[1] / isl.mm[0]) / (isl.mm[1] / isl.mm[0]) < 0.1 ? "stretch" : "cover" }];
    sel = { kind: "decal", i: sp.decals.length - 1 };
  });
  select(sel);
}
function addSheet(path, inf, mat) {
  const layout = {};
  for (const [n, isl] of partsOf(mat)) layout[n] = isl.rect.slice();
  const sh = { image: path, mat, layout };
  if (inf && Math.abs(inf.w / inf.h - 1) > 0.03) {         // not square: its own shape, as wide or as high as the texture
    const a = inf.h / inf.w;
    sh.at = (a < 1 ? [0, (1 - a) / 2, 1, (1 + a) / 2] : [(1 - 1 / a) / 2, 0, (1 + 1 / a) / 2, 1]).map(r4);
  }
  const sp = spec();
  sp.sheets = [...(sp.sheets || []), sh];
  return { kind: "sheet", i: sp.sheets.length - 1 };
}
function setSlot(sl, path) {
  const sp = spec(), pics = sp.pictures || (sp.pictures = {});
  const key = slotKey(sl, pics) || sl.id, cur = pics[key];
  pics[key] = path === false ? false : cur && typeof cur === "object" ? Object.assign(cur, { image: path }) : path;
  return { kind: "slot", id: sl.id };
}
function addSmudge(island, path, x, y) {
  const isl = M_().islands[island], base = X.S.smudges.find(m => m.path === path);
  const w = Math.min(base ? base.w : 40, isl.mm[0] * 0.6, isl.mm[1] * 0.9);
  const sp = spec();
  sp.smudges = [...(sp.smudges || []), { image: path, island, x: r1(x ?? isl.mm[0] / 2), y: r1(y ?? isl.mm[1] / 2), w: r1(w) }];
  return { kind: "smudge", i: sp.smudges.length - 1 };
}
// a picture (its path in the pictures folder) put where a drop's target says
export async function putPicture(t, path, inf) {
  inf = inf || await infoNow(path);
  if (!t) { toast("That's between the parts: nothing of the prop is painted there", true); return null; }
  const M = M_();
  let sel = null, said = "";
  edit(() => {
    if (t.kind === "slot") {
      const sl = M.slots.find(s => s.id === t.id);
      sel = setSlot(sl, path);
      said = `in place of its own ${sl.kind} ${sl.id}`;
    } else if (t.kind === "sheet") {
      sel = addSheet(path, inf, E.mat);
      said = "over the whole texture, laid in its layout: each part takes its own piece";
    } else if (t.kind === "smudge") {
      sel = addSmudge(t.island, path, t.x, t.y);
      said = `a smudge on ${t.island}`;
    } else {
      sel = addDecal(t.island, path, inf, t.x, t.y);
      const d = spec().decals[sel.i];
      said = d.fit === "stretch" ? `over all of ${t.island}` : d.fit === "cover" ? `over all of ${t.island}, its shape kept (the rest cut off)` : `on ${t.island}`;
    }
  });
  select(sel);
  toast(`${path.split("/").pop()}: ${said}. Ctrl+Z takes it back; Make bakes it in.`);
  return sel;
}

// ---- dragging pictures in: from the shelf on the left, or files from the desktop -------------------------------------------

function label(e, text) {
  const l = $(".pe-label"), b = $(".pe-canvas").getBoundingClientRect();
  if (!l) return;
  if (!text) { l.hidden = true; return; }
  l.hidden = false;
  l.textContent = text;
  l.style.left = Math.min(e.clientX - b.left + 14, b.width - 260) + "px";
  l.style.top = (e.clientY - b.top + 16) + "px";
}
function onDragOver(e) {
  if (!M_() || !M_().islands) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
  const t = dropTarget(e);
  E.drop = t;
  label(e, t ? t.label : "between the parts: nothing painted there");
  overlay();
}
function onDragLeave(e) {
  if (e.relatedTarget && $(".pe-canvas").contains(e.relatedTarget)) return;
  E.drop = null;
  label(e, null);
  overlay();
}
async function onDrop(e) {
  e.preventDefault();
  const drag = E.dragging;
  E.drop = null;
  E.dragging = null;
  label(e, null);
  overlay();
  const ev = { clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey, altKey: e.altKey };
  let path = drag && drag.path;
  if (!path) {
    const files = [...(e.dataTransfer.files || [])];
    if (!files.length) return;
    const up = await upload(files);
    if (!up.length) return;
    path = up[0];
    if (up.length > 1) toast(`${up.length} pictures in your pictures: the first went where it was dropped`);
  }
  if (drag && drag.kind === "smudge") { E.dragging = drag; const t = dropTarget(ev); E.dragging = null; return putPicture(t, path, null); }
  const inf = await infoNow(path);
  return putPicture(dropTarget(ev, inf), path, inf);
}

// pictures into the pictures folder (PNG, JPEG, or a Krita .ora: its Paint layer); their paths
export async function upload(files) {
  const out = [];
  for (const f of files) {
    const ora = /\.ora$/i.test(f.name);
    if (!ora && !/^image\/(png|jpeg)$/.test(f.type)) { toast(`${f.name}: a PNG, a JPEG or a Krita .ora`, true); continue; }
    const data = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
    try {
      const p = await api("/api/upload", { name: f.name, data });
      out.push(p.path);
      if (p.note) toast(p.note);
    } catch (err) { toast(`${f.name}: ${err.message}`, true); }
  }
  if (out.length) {
    X.S.pics = (await api("/api/pictures")).images;
    X.S.pic = out[out.length - 1];
    renderAssets();
  }
  return out;
}

// ---- the pointer on the canvas: pick, move, size, turn, pan ---------------------------------------------------------------

function canvasXY(e) { const b = $(".pe-canvas").getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; }
function hitAt(sx, sy) {
  const M = M_(), sp = spec(), px = texPx(E.mat), [tx, ty] = toT(sx, sy);
  const decs = sp.decals || [];
  for (let i = decs.length - 1; i >= 0; i--) {
    const d = decs[i], isl = M.islands[d.island], b = decalBox(d);
    if (!isl || isl.mat !== E.mat || !b) continue;
    const [kx, ky] = perMM(isl, px);
    for (const [cx, cy, fx, fy] of copies(d, isl, b)) {
      const [ux, uy] = mmT(isl, px, cx, cy), r = d.fit ? 0 : b.rot * (fx === fy ? 1 : -1);
      const pts = corners(ux, uy, b.w * kx, b.h * ky, r), rr = rectT(isl, px);
      if (inPoly(pts, tx, ty) && tx >= rr.x0 && tx <= rr.x1 && ty >= rr.y0 && ty <= rr.y1) return { kind: "decal", i };
    }
  }
  const smu = sp.smudges || [];
  for (let i = smu.length - 1; i >= 0; i--) {
    const f = frameOf({ kind: "smudge", i });
    if (f && f.mat === E.mat && inPoly(f.pts, tx, ty)) return { kind: "smudge", i };
  }
  const sl = onSlotAt(tx, ty);
  if (sl) return { kind: "slot", id: sl.id };
  if (E.sel && E.sel.kind === "sheet") { const f = frameOf(E.sel); if (f && inPoly(f.pts, tx, ty)) return E.sel; }
  const p = partAt(tx, ty);
  return p ? { kind: "part", island: p } : null;
}

function onDown(e) {
  if (!M_() || !M_().islands) return;
  const [sx, sy] = canvasXY(e), cv = $(".pe-canvas");
  cv.focus({ preventScroll: true });
  if (e.button === 1 || e.button === 2 || E.space) { e.preventDefault(); return startPan(e, null); }
  if (e.button !== 0) return;
  const f = frameOf(E.sel);
  if (f && f.mat === E.mat) {
    const h = handlesOf(f).find(h => Math.abs(h.s[0] - sx) <= HANDLE + 3 && Math.abs(h.s[1] - sy) <= HANDLE + 3);
    if (h) return startOp(e, h.name === "rot" ? "rot" : "size", h.name);
  }
  const hit = hitAt(sx, sy);
  if (hit && hit.kind !== "part") {
    if (!same(hit, E.sel)) select(hit);
    if (hit.kind === "slot" && !slotPic(slotVal(M_().slots.find(s => s.id === hit.id), spec().pictures || {}))) return startPan(e, hit);
    return startOp(e, "move");
  }
  startPan(e, hit || "none");
}
function startPan(e, pickOnClick) {
  const [sx, sy] = canvasXY(e), o = { sx, sy, ox: E.ox, oy: E.oy, moved: 0 }, cv = $(".pe-canvas");
  cv.setPointerCapture(e.pointerId);
  cv.classList.add("panning");
  const mv = ev => {
    const [x, y] = canvasXY(ev);
    o.moved = Math.max(o.moved, Math.hypot(x - o.sx, y - o.sy));
    if (o.moved > 3) { E.auto = false; E.ox = o.ox + x - o.sx; E.oy = o.oy + y - o.sy; place(); }
  };
  const up = () => {
    cv.removeEventListener("pointermove", mv);
    cv.removeEventListener("pointerup", up);
    cv.classList.remove("panning");
    if (o.moved <= 3 && pickOnClick) select(pickOnClick === "none" ? null : pickOnClick);
  };
  cv.addEventListener("pointermove", mv);
  cv.addEventListener("pointerup", up);
}

function startOp(e, kind, handle) {
  const sel = E.sel, [sx, sy] = canvasXY(e), cv = $(".pe-canvas");
  const M = M_(), sp = spec();
  let start = null;
  if (sel.kind === "slot") {
    const sl = M.slots.find(s => s.id === sel.id), key = slotKey(sl, sp.pictures || {}) || sl.id, v = (sp.pictures || {})[key];
    start = { key, val: clone(v), sl };
  } else start = clone(layerOf(sel));
  if (sel.kind === "decal" && kind === "move" && start.corners) { toast("A flourish in the corners sits by its inset: set it on the right (its size by the handles)"); return startPan(e, null); }
  E.op = { kind, handle, sx, sy, t0: toT(sx, sy), start, box0: sel.kind === "decal" ? decalBox(start) : sel.kind === "smudge" ? smudgeBox(start) : null, moved: false };
  begin();
  cv.setPointerCapture(e.pointerId);
  const mv = ev => { if (!E.op) return; drag(ev); };
  const up = ev => {
    cv.removeEventListener("pointermove", mv);
    cv.removeEventListener("pointerup", up);
    if (E.op && E.op.moved && E.sel && E.sel.kind === "decal") rehome(E.sel.i);
    E.op = null;
    E.snap = null;
    commit();
  };
  cv.addEventListener("pointermove", mv);
  cv.addEventListener("pointerup", up);
}

// a decal moved off its part onto another of the same texture goes with it: its middle there, its size in mm kept
function rehome(i) {
  const d = spec().decals[i], M = M_(), isl = M.islands[d.island], b = decalBox(d);
  if (!b || d.corners || d.repeat > 1) return;
  const px = texPx(isl.mat), [tx, ty] = mmT(isl, px, b.x, b.y), p = partAt(tx, ty, isl.mat);
  if (!p || p === d.island) return;
  const [x, y] = tMM(M.islands[p], px, tx, ty);
  Object.assign(d, { island: p, x: r1(x), y: r1(y) });
  toast(`moved onto ${p}`);
}

function drag(ev) {
  const op = E.op, sel = E.sel, M = M_();
  const [sx, sy] = canvasXY(ev), [tx, ty] = toT(sx, sy), [tx0, ty0] = op.t0;
  if (!op.moved && Math.hypot(sx - op.sx, sy - op.sy) < 2) return;
  op.moved = true;
  const shift = ev.shiftKey, alt = ev.altKey;
  if (sel.kind === "sheet") {
    const sh = layerOf(sel), px = texPx(sh.mat || onlyMat()), [a0, b0, a1, b1] = op.start.at || [0, 0, 1, 1];
    if (op.kind === "move") {
      let dx = (tx - tx0) / px, dy = (ty - ty0) / px;
      if (shift) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      sh.at = [a0 + dx, b0 + dy, a1 + dx, b1 + dy].map(r4);
    } else {
      const f = { cx: (a0 + a1) / 2 * px, cy: (b0 + b1) / 2 * px, w: (a1 - a0) * px, h: (b1 - b0) * px, rot: 0 };
      const nb = resize(f, op.handle, [tx, ty], shift, alt, false);
      sh.at = [(nb.cx - nb.w / 2) / px, (nb.cy - nb.h / 2) / px, (nb.cx + nb.w / 2) / px, (nb.cy + nb.h / 2) / px].map(r4);
    }
  } else if (sel.kind === "slot") {
    const { key, val, sl } = op.start, p0 = slotPic(val), isl = M.islands[sl.island], px = texPx(isl.mat), [kx, ky] = perMM(isl, px);
    if (!p0) return;
    const pics = spec().pictures, p = Object.assign({}, p0);
    if (op.kind === "move") {
      let dx = (tx - tx0) / kx, dy = -(ty - ty0) / ky;
      if (shift) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      p.dx = r1((p0.dx || 0) + dx);
      p.dy = r1((p0.dy || 0) + dy);
    } else {
      const G = slotGeom(sl, p0), [cx, cy] = mmT(isl, px, G.x + G.w / 2, G.y + G.h / 2);
      const nb = resize({ cx, cy, w: G.w * kx, h: G.h * ky, rot: 0 }, op.handle, [tx, ty], false, true, true);
      p.scale = Math.max(0.05, Math.round((p0.scale ?? 1) * (nb.w / (G.w * kx)) * 100) / 100);
    }
    pics[key] = p;
  } else {
    const L = layerOf(sel), L0 = op.start, b0 = op.box0, isl = M.islands[L0.island], px = texPx(isl.mat), [kx, ky] = perMM(isl, px);
    if (!b0) return;
    // the picked copy's middle (the first): its place on the texture
    const c0 = sel.kind === "decal" ? copies(L0, isl, b0)[0] : [b0.x, b0.y, false, false];
    const flipSign = c0[2] === c0[3] ? 1 : -1;
    if (op.kind === "move") {
      let dx = (tx - tx0) / kx, dy = -(ty - ty0) / ky;
      if (shift) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      let x = b0.x + dx, y = b0.y + dy;
      // the part's middle lines pull it in (Figma's snapping), shown as a guide
      const tol = 6 / (E.z * kx);
      E.snap = {};
      if (Math.abs(x - isl.mm[0] / 2) < tol) { x = isl.mm[0] / 2; E.snap.x = true; }
      if (Math.abs(y - isl.mm[1] / 2) < tol) { y = isl.mm[1] / 2; E.snap.y = true; }
      E.snap.island = L0.island;
      if (sel.kind === "decal") {
        if (L0.fit === "width") L.y = r1(y);
        else if (L0.fit === "height") L.x = r1(x);
        else {
          if (L0.fit === "stretch") { delete L.fit; L.w = r1(b0.w); L.h = r1(b0.h); }
          L.x = r1(x);
          L.y = r1(y);
        }
      } else { L.x = r1(x); L.y = r1(y); delete L.count; }
    } else {
      const [cx, cy] = mmT(isl, px, c0[0], c0[1]);
      const f = { cx, cy, w: b0.w * kx, h: b0.h * ky, rot: (b0.rot || 0) * flipSign };
      if (op.kind === "rot") {
        const [ax, ay] = [tx0 - cx, ty0 - cy], [bx, by] = [tx - cx, ty - cy];
        let r = f.rot - (Math.atan2(by, bx) - Math.atan2(ay, ax)) * 180 / Math.PI;
        if (shift) r = Math.round(r / 15) * 15;
        r = ((r + 180) % 360 + 360) % 360 - 180;
        L.rot = r1(r * flipSign);
        if (!L.rot) delete L.rot;
      } else {
        const nb = resize(f, op.handle, [tx, ty], shift, alt, sel.kind === "smudge");
        const [mx, my] = tMM(isl, px, nb.cx, nb.cy);
        if (sel.kind === "smudge") { L.w = r1(Math.max(1, nb.w / kx)); L.x = r1(mx); L.y = r1(my); delete L.count; }
        else {
          // its middle: the first copy's; a flourish's own place follows from its rules
          const dxm = mx - c0[0], dym = my - c0[1];
          L.w = r1(Math.max(1, nb.w / kx));
          L.h = r1(Math.max(1, nb.h / ky));
          L.x = r1(b0.x + dxm);
          L.y = r1(b0.y + dym);
          if (L0.fit) { delete L.fit; if (b0.rot) L.rot = b0.rot; }
        }
      }
    }
  }
  schedule();
  syncProps();
}

// a turned box's new middle and size, a handle dragged to p (texels): the opposite side stays (Alt: the middle), a corner
// keeps its shape (Shift: free); `keep`: always its shape
function resize(f, h, p, shift, alt, keep) {
  const sxh = h.includes("e") ? 1 : h.includes("w") ? -1 : 0, syh = h.includes("s") ? 1 : h.includes("n") ? -1 : 0;
  const a = -f.rot * Math.PI / 180, ux = [Math.cos(a), Math.sin(a)], uy = [-Math.sin(a), Math.cos(a)];
  const anchor = alt ? [f.cx, f.cy] : [f.cx - sxh * f.w / 2 * ux[0] - syh * f.h / 2 * uy[0], f.cy - sxh * f.w / 2 * ux[1] - syh * f.h / 2 * uy[1]];
  const v = [p[0] - anchor[0], p[1] - anchor[1]], lx = v[0] * ux[0] + v[1] * ux[1], ly = v[0] * uy[0] + v[1] * uy[1];
  const k2 = alt ? 2 : 1;
  let w = f.w, hh = f.h;
  if (sxh) w = Math.max(2, (alt ? Math.abs(lx) : lx * sxh) * k2);
  if (syh) hh = Math.max(2, (alt ? Math.abs(ly) : ly * syh) * k2);
  if ((sxh && syh && !shift) || keep) {
    // its shape kept: the pointer projected onto the diagonal (an edge: the side it moves)
    const ex = sxh ? (alt ? Math.abs(lx) : lx * sxh) * k2 : null, ey = syh ? (alt ? Math.abs(ly) : ly * syh) * k2 : null;
    let k;
    if (ex !== null && ey !== null) k = (ex * f.w + ey * f.h) / (f.w * f.w + f.h * f.h);
    else k = ex !== null ? ex / f.w : ey / f.h;
    k = Math.max(0.02, k);
    w = f.w * k;
    hh = f.h * k;
  }
  const cx = alt ? f.cx : anchor[0] + sxh * w / 2 * ux[0] + syh * hh / 2 * uy[0];
  const cy = alt ? f.cy : anchor[1] + sxh * w / 2 * ux[1] + syh * hh / 2 * uy[1];
  // an edge that kept its shape grows both ways across it
  return { cx: !sxh && keep && !alt ? f.cx : cx, cy: !syh && keep && !alt ? f.cy : cy, w, h: hh };
}

function onWheel(e) {
  if (!M_() || !M_().islands) return;
  e.preventDefault();
  const [sx, sy] = canvasXY(e);
  zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), sx, sy);
}
function onHover(e) {
  if (E.op || !M_() || !M_().islands) return;
  const [sx, sy] = canvasXY(e), [tx, ty] = toT(sx, sy), hit = hitAt(sx, sy), foot = $(".pe-foot");
  if (!same(hit, E.hover)) { E.hover = hit; overlay(); }
  const p = partAt(tx, ty);
  if (foot) {
    if (p) {
      const isl = M_().islands[p], [x, y] = tMM(isl, texPx(E.mat), tx, ty);
      foot.textContent = `${p}: ${isl.mm[0]} × ${isl.mm[1]} mm, here ${x.toFixed(0)} × ${y.toFixed(0)} mm` +
        (hit && hit.kind === "slot" ? ` · its own picture ${hit.id}` : hit && hit.kind !== "part" ? ` · ${hit.kind}` : "") + (isl.wrap ? " · goes round" : "");
    } else foot.textContent = "Drag pictures onto the parts · the wheel zooms, drag the background to pan · Shift-drop: over the whole texture";
  }
}

function onKey(e) {
  if (X.S.tab !== "texture" || !E || !M_() || !M_().islands || !$(".pe")) return;
  if (e.target.closest && e.target.closest("input,select,textarea")) return;
  const mod = e.ctrlKey || e.metaKey, k = e.key;
  if (mod && (k === "z" || k === "Z")) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && (k === "y" || k === "Y")) { e.preventDefault(); redo(); return; }
  if (mod && (k === "d" || k === "D")) { e.preventDefault(); duplicate(); return; }
  if (mod && (k === "]" || k === "[")) { e.preventDefault(); reorder(k === "]" ? 1 : -1); return; }
  if (k === " " && !E.space) { E.space = true; $(".pe-canvas").classList.add("grab"); e.preventDefault(); return; }
  if (k === "Escape") { if (E.sel) select(null); return; }
  if (k === "Delete" || k === "Backspace") { e.preventDefault(); remove(E.sel); return; }
  if (e.shiftKey && (k === "!" || k === "1")) { E.z = 0; place(); return; }
  if (e.shiftKey && (k === "@" || k === "2" || k === '"')) { if (E.sel) zoomTo(E.sel); return; }
  if (k === "+" || k === "=") { const b = $(".pe-canvas"); zoomAt(1.25, b.clientWidth / 2, b.clientHeight / 2); return; }
  if (k === "-" || k === "_") { const b = $(".pe-canvas"); zoomAt(0.8, b.clientWidth / 2, b.clientHeight / 2); return; }
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  if (arrows[k] && E.sel) { e.preventDefault(); nudge(...arrows[k].map(v => v * (e.shiftKey ? 10 : 1))); }
}
function onKeyUp(e) { if (e.key === " ") { E.space = false; const c = $(".pe-canvas"); if (c) c.classList.remove("grab"); } }

function nudge(dx, dy) {
  const sel = E.sel, sp = spec();
  edit(() => {
    if (sel.kind === "decal" || sel.kind === "smudge") {
      const L = layerOf(sel), b = sel.kind === "decal" ? decalBox(L) : smudgeBox(L);
      if (!b || L.corners) return;
      if (L.fit === "stretch") { delete L.fit; L.w = r1(b.w); L.h = r1(b.h); }
      if (L.fit !== "width") L.x = r1(b.x + dx);
      if (L.fit !== "height") L.y = r1(b.y + dy);
    } else if (sel.kind === "slot") {
      const sl = M_().slots.find(s => s.id === sel.id), key = slotKey(sl, sp.pictures || {});
      const p = key && slotPic(sp.pictures[key]);
      if (!p) return;
      sp.pictures[key] = Object.assign({}, p, { dx: r1((p.dx || 0) + dx), dy: r1((p.dy || 0) + dy) });
    } else if (sel.kind === "sheet") {
      const sh = layerOf(sel), px = texPx(sh.mat || onlyMat()), a = sh.at || [0, 0, 1, 1];
      sh.at = [a[0] + dx / px, a[1] - dy / px, a[2] + dx / px, a[3] - dy / px].map(r4);
    }
  });
}
function remove(sel) {
  if (!sel) return;
  const sp = spec();
  if (sel.kind === "slot") {
    const sl = M_().slots.find(s => s.id === sel.id), key = slotKey(sl, sp.pictures || {});
    if (!key) { edit(() => setSlot(sl, false)); toast(`${sl.id}: nothing there now (Ctrl+Z brings it back)`); }
    else if (key === sl.id) { edit(() => { delete sp.pictures[key]; }); toast(`${sl.id}: the generator's own again (drawn by the next make)`); }
    else toast(`${sl.id} takes the picture for every ${sl.name} (${key}): change it there, or untick "every ${sl.name}" on the right`);
    return;
  }
  const list = { decal: "decals", smudge: "smudges", sheet: "sheets" }[sel.kind];
  if (!list) return;
  edit(() => { sp[list].splice(sel.i, 1); });
  select(null);
}
function duplicate() {
  const sel = E.sel, list = sel && { decal: "decals", smudge: "smudges", sheet: "sheets" }[sel.kind];
  if (!list) return;
  const sp = spec(), L = clone(sp[list][sel.i]);
  if (sel.kind !== "sheet") {
    const b = sel.kind === "decal" ? decalBox(L) : smudgeBox(L);
    if (b && !L.fit && !L.corners) { L.x = r1(b.x + 5); L.y = r1(b.y - 5); }
  } else if (L.at) L.at = L.at.map((v, k) => r4(v + (k % 2 ? 0.02 : 0.02)));
  edit(() => { sp[list].splice(sel.i + 1, 0, L); });
  select({ kind: sel.kind, i: sel.i + 1 });
}
function reorder(dir) {
  const sel = E.sel, list = sel && { decal: "decals", smudge: "smudges", sheet: "sheets" }[sel.kind];
  if (!list) return;
  const a = spec()[list], j = sel.i + dir;
  if (j < 0 || j >= a.length) return;
  edit(() => { [a[sel.i], a[j]] = [a[j], a[sel.i]]; });
  select({ kind: sel.kind, i: j });
}

// ---- what size a picture wants: the texture's pixels a millimetre there, twice over, rounded up to 16 ----------------------

function pxPerMm(island) {
  const M = M_(), isl = M && M.islands[island];
  if (!isl) return 0;
  return (isl.rect[2] - isl.rect[0]) * texPx(isl.mat) / isl.mm[0];
}
function wants(island, wmm, hmm) {
  const s = island === "*" ? Math.max(...Object.keys(M_().islands).map(pxPerMm)) : pxPerMm(island);
  const r = v => Math.max(64, Math.ceil(v * s * 2 / 16) * 16);
  return [r(wmm), r(hmm)];
}
function sizeNote(island, wmm, hmm, what) {
  const [w, h] = wants(island, wmm, hmm);
  return el("div", { class: "pe-wants", title: `${wmm.toFixed(0)} × ${hmm.toFixed(0)} mm on the prop at ${pxPerMm(island === "*" ? Object.keys(M_().islands)[0] : island).toFixed(1)} ` +
    "texture pixels a mm; twice that so it's sharp up close. Bigger is fine (it's scaled down); smaller goes soft." }, `wants ${w} × ${h} px${what ? ": " + what : ""}`);
}

// ---- the layers on the left: what's over the whole texture, then each part with its own pictures and yours ---------------

function cropOf(sl, maxW = 40, maxH = 28) {
  const M = M_(), isl = M.islands[sl.island], px = texPx(isl.mat), im = image(paintUrl(isl.mat) || madeUrl(isl.mat));
  const [bx, by, bw, bh] = sl.box, [a0, b1] = mmT(isl, px, bx, by), [a1, b0] = mmT(isl, px, bx + bw, by + bh);
  const k = Math.min(maxW / Math.max(a1 - a0, 1), maxH / Math.max(b1 - b0, 1)), c = document.createElement("canvas");
  c.width = Math.max(1, Math.round((a1 - a0) * k));
  c.height = Math.max(1, Math.round((b1 - b0) * k));
  c.className = "pe-th";
  if (im) c.getContext("2d").drawImage(im, a0 * iw(im) / px, b0 * ih(im) / px, (a1 - a0) * iw(im) / px, (b1 - b0) * ih(im) / px, 0, 0, c.width, c.height);
  return c;
}
function thumbOf(path) {
  const u = picUrl(path);
  return u ? el("img", { class: "pe-th", src: u, alt: "", draggable: "false" }) : el("span", { class: "pe-th none" });
}
const short = p => String(p || "").split("/").pop().replace(/^smudge\//, "");

function renderLayers() {
  const box = $(".pe-layers");
  if (!box || !M_() || !M_().islands || !E.mat) return;
  const keep = box.scrollTop;
  box.innerHTML = "";
  const M = M_(), sp = spec(), mat = E.mat, sel = E.sel;
  const row = (s, kids, extra = {}) => el("div", Object.assign({
    class: "pe-row" + (same(s, sel) ? " sel" : ""), title: "click: pick it · double-click: zoom to it",
    onclick: ev => { ev.stopPropagation(); select(s); }, ondblclick: ev => { ev.stopPropagation(); select(s, { zoom: true }); },
    onmouseenter: () => { E.hover = s; overlay(); }, onmouseleave: () => { E.hover = null; overlay(); },
  }, extra), kids);
  const x = s => el("button", { class: "pe-x", title: "take it out (Delete)", onclick: ev => { ev.stopPropagation(); remove(s); } }, "×");
  const sheets = (sp.sheets || []).map((sh, i) => [sh, i]).filter(([sh]) => (sh.mat || onlyMat()) === mat);
  const spread = (sp.smudges || []).map((m, i) => [m, i]).filter(([m]) => scattered(m) && (!m.island || m.island === "*" || (M.islands[m.island] || {}).mat === mat));
  box.append(el("div", { class: "pe-group" }, "Over the whole texture"));
  if (!sheets.length && !spread.length) box.append(el("div", { class: "pe-empty" }, "Drop one picture the texture's shape (your painting over its template), or drop off the parts or with Shift: it lies over them all."));
  for (const [sh, i] of sheets) {
    const s = { kind: "sheet", i };
    box.append(row(s, [thumbOf(sh.image), el("span", { class: "pe-nm" }, short(sh.image)), el("span", { class: "pe-k" }, "whole texture"), x(s)], { "data-kind": "sheet", "data-i": i }));
  }
  for (const [m, i] of spread) {
    const s = { kind: "smudge", i };
    box.append(row(s, [thumbOf(m.image), el("span", { class: "pe-nm" }, short(m.image)), el("span", { class: "pe-k" }, `scattered ×${m.count || 1}`), x(s)], { "data-kind": "smudge", "data-i": i }));
  }
  const parts = partsOf(mat);
  box.append(el("div", { class: "pe-group" }, `Parts (${parts.length})`));
  for (const [n, isl] of parts) {
    const slots = (M.slots || []).filter(sl => sl.island === n);
    const decs = (sp.decals || []).map((d, i) => [d, i]).filter(([d]) => d.island === n);
    const smus = (sp.smudges || []).map((m, i) => [m, i]).filter(([m]) => m.island === n && !scattered(m));
    const yours = decs.length + smus.length + slots.filter(sl => slotVal(sl, sp.pictures || {}) !== undefined).length;
    const kids = slots.length + decs.length + smus.length;
    const open = E.open[n] ?? (yours > 0 || (parts.length <= 8 && kids <= 6));
    const s = { kind: "part", island: n };
    box.append(row(s, [
      el("button", { class: "pe-caret", title: kids ? "show or hide what's on it" : "", onclick: ev => { ev.stopPropagation(); E.open[n] = !open; renderLayers(); } }, kids ? (open ? "▾" : "▸") : "·"),
      el("span", { class: "pe-nm part" }, n), el("span", { class: "pe-k" }, `${isl.mm[0]} × ${isl.mm[1]}` + (isl.wrap ? " ↻" : "")),
      yours ? el("span", { class: "pe-n", title: "your pictures on it" }, yours) : null], { "data-kind": "part", "data-island": n }));
    if (!open) continue;
    for (const sl of slots) {
      const v = slotVal(sl, sp.pictures || {}), st = slotState(v), p = slotPic(v), ss = { kind: "slot", id: sl.id };
      box.append(row(ss, [p ? thumbOf(p.image) : cropOf(sl), el("span", { class: "pe-nm" }, `${sl.name}`),
        el("span", { class: "pe-k " + st }, st === "yours" ? short(p.image) : st === "off" ? "nothing there" : `its own ${sl.kind}`)],
      { class: "pe-row sub" + (same(ss, sel) ? " sel" : ""), "data-kind": "slot", "data-slot": sl.id }));
    }
    for (const [d, i] of decs) {
      const s2 = { kind: "decal", i };
      box.append(row(s2, [thumbOf(d.image), el("span", { class: "pe-nm" }, short(d.image)),
        el("span", { class: "pe-k" }, d.fit ? (FITS.find(f => f[0] === d.fit) || [0, d.fit])[1].split(" (")[0] : d.corners ? "in its corners" : d.repeat > 1 ? `×${d.repeat}` : "placed"), x(s2)],
      { class: "pe-row sub" + (same(s2, sel) ? " sel" : ""), "data-kind": "decal", "data-i": i }));
    }
    for (const [m, i] of smus) {
      const s3 = { kind: "smudge", i };
      box.append(row(s3, [thumbOf(m.image), el("span", { class: "pe-nm" }, short(m.image)), el("span", { class: "pe-k" }, "smudge"), x(s3)],
        { class: "pe-row sub" + (same(s3, sel) ? " sel" : ""), "data-kind": "smudge", "data-i": i }));
    }
  }
  // pictures on parts the prop no longer has (a part renamed by a change to the recipe)
  const lost = (sp.decals || []).map((d, i) => [d, i]).filter(([d]) => !M.islands[d.island]);
  if (lost.length) {
    box.append(el("div", { class: "pe-group bad" }, "On parts it no longer has"));
    for (const [d, i] of lost) box.append(el("div", { class: "pe-row sub" }, thumbOf(d.image), el("span", { class: "pe-nm" }, short(d.image)), el("span", { class: "pe-k bad" }, d.island),
      el("button", { class: "pe-x", onclick: () => edit(() => { spec().decals.splice(i, 1); }) }, "×")));
  }
  box.scrollTop = keep;
}

// ---- the picked layer's settings on the right ---------------------------------------------------------------------------

const fmt = v => (v === undefined || v === null || Number.isNaN(v) ? "" : typeof v === "number" ? String(Math.round(v * 100) / 100) : v);
function fNum(label, get, set, o = {}) {
  const i = el("input", { type: "number", step: o.step ?? 0.5, min: o.min, max: o.max, value: fmt(get()), placeholder: o.ph ?? "",
    onchange: e => { const v = parseFloat(e.target.value); edit(() => set(Number.isNaN(v) ? undefined : v)); } });
  i._get = get;
  return el("label", { class: "pe-f", title: o.title || "" }, el("span", {}, label), i, o.unit ? el("i", {}, o.unit) : null);
}
function fRange(label, get, set, o = {}) {
  const shown = el("span", { class: "pe-v" }, fmt(get() ?? o.dflt));
  const i = el("input", { type: "range", min: o.min ?? 0, max: o.max ?? 1, step: o.step ?? 0.05, value: get() ?? o.dflt ?? 1,
    oninput: e => { begin(); set(parseFloat(e.target.value)); shown.textContent = e.target.value; schedule(); }, onchange: () => commit() });
  i._get = () => get() ?? o.dflt;
  return el("label", { class: "pe-f", title: o.title || "" }, el("span", {}, label), i, shown);
}
function fSel(label, opts, get, set, o = {}) {
  const s = el("select", { onchange: e => edit(() => set(e.target.value)) }, opts.map(([v, t]) => el("option", { value: v }, t)));
  s.value = get() ?? "";
  if (s.value !== (get() ?? "") && get() != null) { s.append(el("option", { value: get() }, get())); s.value = get(); }
  return el("label", { class: "pe-f", title: o.title || "" }, el("span", {}, label), s);
}
function fCheck(label, get, set, o = {}) {
  return el("label", { class: "pe-f chk", title: o.title || "" }, el("input", { type: "checkbox", checked: !!get(), onchange: e => edit(() => set(e.target.checked)) }), el("span", {}, label));
}
function fColor(label, get, set) {
  const c = el("input", { type: "color", value: get() || "#ffffff", onchange: e => edit(() => set(e.target.value.toLowerCase() === "#ffffff" ? undefined : e.target.value)) });
  return el("label", { class: "pe-f" }, el("span", {}, label), c, get() ? el("button", { class: "pe-mini", title: "no tint", onclick: () => edit(() => set(undefined)) }, "×") : null);
}
function picChoice(label, get, set, extra = []) {
  const opts = [...extra, ...X.S.pics.map(p => [p.path, p.name])];
  if (get() && !opts.some(o => o[0] === get())) opts.push([get(), short(get())]);
  return fSel(label, opts, get, set);
}
const setOr = (o, k, v, dflt) => { if (v === undefined || v === dflt) delete o[k]; else o[k] = v; };
function syncProps() {
  for (const i of document.querySelectorAll(".pe-props input")) {
    if (!i._get || i === document.activeElement) continue;
    const v = i._get();
    i.value = i.type === "range" ? (v ?? i.value) : fmt(v);
  }
}

function renderProps() {
  const box = $(".pe-props");
  if (!box || !M_() || !M_().islands) return;
  box.innerHTML = "";
  const sel = E.sel;
  if (!sel || !selValid(sel)) return matProps(box, true);
  if (sel.kind === "decal") decalProps(box, sel.i);
  else if (sel.kind === "slot") slotProps(box, sel.id);
  else if (sel.kind === "sheet") sheetProps(box, sel.i);
  else if (sel.kind === "smudge") smudgeProps(box, sel.i);
  else if (sel.kind === "part") { partProps(box, sel.island); matProps(box, false); }
}
const head = (thumb, title, sub) => el("div", { class: "pe-head" }, thumb, el("div", {}, el("b", {}, title), sub ? el("div", { class: "dim" }, sub) : null));
const btns = (...b) => el("div", { class: "pe-btns" }, b);
const btn = (t, f, title, cls = "") => el("button", { onclick: f, title: title || "", class: cls }, t);

function decalProps(box, i) {
  const M = M_(), d = spec().decals[i], isl = M.islands[d.island], b = decalBox(d);
  const allParts = Object.entries(M.islands).map(([n, I]) => [n, `${n} (${I.mat})`]);
  box.append(head(thumbOf(d.image), short(d.image), `a picture on ${d.island}`),
    picChoice("Picture", () => d.image, v => { d.image = v; }),
    fSel("On the part", allParts, () => d.island, v => { const I = M.islands[v]; d.island = v; if (!d.fit) { d.x = r1(I.mm[0] / 2); d.y = r1(I.mm[1] / 2); } }),
    fSel("Fit", FITS, () => d.fit || "", v => { setOr(d, "fit", v || undefined); if (v) { delete d.rot; } else if (b) { d.w = r1(b.w); d.h = r1(b.h); d.x = r1(b.x); d.y = r1(b.y); } }));
  const placed = !d.fit;
  if (placed || d.fit === "height" || d.fit === "cover" || d.fit === "contain") box.append(fNum("X", () => decalBox(d)?.x, v => setOr(d, "x", v), { unit: "mm", title: "its middle, across the part from its left" }));
  if (placed || d.fit === "width" || d.fit === "cover" || d.fit === "contain") box.append(fNum("Y", () => decalBox(d)?.y, v => setOr(d, "y", v), { unit: "mm", title: "its middle, up the part from its foot" }));
  if (placed) {
    box.append(fNum("Width", () => decalBox(d)?.w, v => setOr(d, "w", v), { unit: "mm" }),
      fNum("Height", () => decalBox(d)?.h, v => setOr(d, "h", v), { unit: "mm", ph: "its shape", title: "empty: its own shape" }),
      fNum("Turn", () => d.rot || 0, v => setOr(d, "rot", v, 0), { step: 5, unit: "°", title: "degrees anticlockwise (the round handle; Shift: 15° at a time)" }));
    if (d.h !== undefined) box.append(btns(btn("Its own shape", () => edit(() => { delete d.h; }), "its height from its width and the picture's shape")));
  }
  box.append(fRange("Opacity", () => d.alpha, v => setOr(d, "alpha", v, 1), { dflt: 1 }),
    fRange("Roughness", () => d.rough, v => setOr(d, "rough", v, 0.3), { dflt: 0.3, title: "0 a gloss print, 1 matt" }),
    fRange("Metal", () => d.metal, v => setOr(d, "metal", v, 0), { dflt: 0, title: "a foil print" }),
    fNum("Raised", () => d.height, v => setOr(d, "height", v, 0.01), { step: 0.01, unit: "mm", ph: "0.01", title: "how far it stands out (a sticker: 0.1)" }),
    fColor("Tint", () => d.tint, v => setOr(d, "tint", v)),
    fCheck("Mirrored", () => d.flip, v => setOr(d, "flip", v || undefined)));
  const fl = el("details", { class: "pe-more", open: !!(d.repeat > 1 || d.corners) || undefined }, el("summary", {}, "As a flourish: repeated or in the corners"),
    fNum("Repeat", () => d.repeat ?? 1, v => setOr(d, "repeat", v > 1 ? Math.round(v) : undefined), { step: 1, min: 1, title: "copies spread along the part" }),
    fSel("Along", [["x", "across"], ["y", "up"]], () => d.along || "x", v => setOr(d, "along", v, "x")),
    fNum("Gap", () => d.gap, v => setOr(d, "gap", v), { unit: "mm", ph: "spread evenly" }),
    fCheck("Every other mirrored", () => d.mirror, v => setOr(d, "mirror", v || undefined)),
    fCheck("One in each corner", () => d.corners, v => setOr(d, "corners", v || undefined), { title: "each mirrored to face its corner: draw it for the top left" }),
    fNum("Inset", () => d.inset ?? 2, v => setOr(d, "inset", v, 2), { unit: "mm", title: "from the corners" }));
  box.append(fl);
  if (b && isl) box.append(sizeNote(d.island, b.w, b.h, d.fit === "stretch" ? "the part's own shape" : ""));
  box.append(btns(btn("Duplicate", duplicate, "Ctrl+D"), btn("Forward", () => reorder(1), "drawn over the next one (Ctrl+])"),
    btn("Back", () => reorder(-1), "drawn under the one before (Ctrl+[)"), btn("Delete", () => remove(E.sel), "Delete", "danger")));
}

function slotProps(box, id) {
  const M = M_(), sl = M.slots.find(s => s.id === id), isl = M.islands[sl.island], sp = spec();
  const pics = () => sp.pictures || {}, key = () => slotKey(sl, pics()), p = () => slotPic(key() ? pics()[key()] : undefined);
  const set = patch => { const k = key() || sl.id, cur = slotPic(pics()[k]); if (!cur) return; sp.pictures[k] = Object.assign({}, cur, patch); for (const kk of Object.keys(sp.pictures[k])) if (sp.pictures[k][kk] === undefined) delete sp.pictures[k][kk]; };
  const now = slotVal(sl, pics()), st = slotState(now);
  box.append(head(p() ? thumbOf(p().image) : cropOf(sl, 56, 40), sl.id, `its own ${sl.kind}${sl.about ? ": " + sl.about : ""}`),
    picChoice("What's there", () => (st === "yours" ? p().image : st === "off" ? "off" : ""), v => {
      if (v === "") { const k = key(); if (k === sl.id) delete sp.pictures[k]; else if (!k) {} else delete sp.pictures[k]; }
      else if (v === "off") setSlot(sl, false);
      else setSlot(sl, v);
    }, [["", "the generator's own"], ["off", "nothing there"]]));
  const like = (M.slots || []).filter(x => x.name === sl.name), all = like.length > 1 ? `*.${sl.name}` : null;
  if (all && key()) box.append(fCheck(`Every ${sl.name} (${like.length}) at once`, () => key() === all, on => {
    const val = pics()[key()];
    for (const x of like) delete sp.pictures[x.id];
    if (on) sp.pictures[all] = val; else { delete sp.pictures[all]; sp.pictures[sl.id] = val; }
  }, { title: like.map(x => x.id).join(", ") }));
  if (p()) {
    const fit = p().fit || slotFit(sl);
    box.append(fSel("Fit", [["contain", "inside its box, its shape kept"], ["cover", "filling its box (cut to it)"], ["stretch", "stretched to its box"], ["tile", "repeated over its box"]],
      () => fit, v => set({ fit: v === slotFit(sl) ? undefined : v })));
    if (fit === "tile") box.append(fNum("Tile", () => p().tile, v => set({ tile: v }), { unit: "mm", ph: "its own size", title: "a repeat's width" }));
    box.append(fNum("Scale", () => p().scale ?? 1, v => set({ scale: v === 1 ? undefined : v }), { step: 0.05 }),
      fNum("Move across", () => p().dx || 0, v => set({ dx: v || undefined }), { unit: "mm" }),
      fNum("Move up", () => p().dy || 0, v => set({ dy: v || undefined }), { unit: "mm" }),
      fSel("Turn", [["0", "upright"], ["90", "a quarter turn left"], ["180", "upside down"], ["270", "a quarter turn right"]], () => String(((p().rot ?? sl.rot ?? 0) % 360 + 360) % 360),
        v => set({ rot: +v === (sl.rot || 0) ? undefined : +v })),
      fCheck("Mirrored", () => p().flip, v => set({ flip: v || undefined })));
    if (!sl.relief) box.append(fColor("Tint", () => p().tint, v => set({ tint: v })), fRange("Roughness", () => p().rough, v => set({ rough: v }), { dflt: 0.35 }));
  }
  const cut = ["logo", "flourish", "stamp", "text"].includes(sl.kind), round = isl.wrap && sl.box[2] >= isl.mm[0] * 0.95;
  const what = sl.relief ? "pressed in or raised: where it's opaque, or dark on white" : slotFit(sl) === "tile" ? "it repeats: a tile seamless all round" :
    (cut ? "PNG, transparent round it" : "PNG or JPEG") + (round ? ", seamless left to right" : "");
  box.append(sizeNote(sl.island, sl.box[2], sl.box[3], what));
  if (E.pending.has(sl.id)) box.append(el("div", { class: "pe-note" }, "The generator's own drawing comes back here on the next Make (the canvas shows what's under it)."));
  box.append(btns(btn("Its template", () => slotTemplate(sl), "the generator's own drawing there at the size it wants: paint over it"),
    btn("Zoom to it", () => zoomTo({ kind: "slot", id: sl.id }))));
}

function sheetProps(box, i) {
  const sh = spec().sheets[i], mat = sh.mat || onlyMat(), px = texPx(mat);
  const at = () => sh.at || [0, 0, 1, 1];
  const setAt = (k, v) => { const a = at().slice(); a[k] = r4(v / 100); sh.at = a; if (same(sh.at, [0, 0, 1, 1])) delete sh.at; };
  box.append(head(thumbOf(sh.image), short(sh.image), `over the whole ${mat} texture, laid in its layout`),
    picChoice("Picture", () => sh.image, v => { sh.image = v; }),
    el("div", { class: "pe-grid4" },
      fNum("Left", () => at()[0] * 100, v => setAt(0, v ?? 0), { step: 0.5, unit: "%" }), fNum("Top", () => at()[1] * 100, v => setAt(1, v ?? 0), { step: 0.5, unit: "%" }),
      fNum("Right", () => at()[2] * 100, v => setAt(2, v ?? 100), { step: 0.5, unit: "%" }), fNum("Bottom", () => at()[3] * 100, v => setAt(3, v ?? 100), { step: 0.5, unit: "%" })),
    btns(btn("Over all of it", () => edit(() => { delete sh.at; }), "the picture over the whole texture"),
      btn("Its own shape", () => edit(() => { const inf = info(sh.image); if (!inf) return; const a = inf.h / inf.w, [x0, y0, x1] = at(); sh.at = [x0, y0, x1, y0 + (x1 - x0) * a].map(r4); }), "its height from its width and the picture's shape")),
    fRange("Opacity", () => sh.alpha, v => setOr(sh, "alpha", v, 1), { dflt: 1 }),
    fCheck("Its own roughness", () => sh.rough !== undefined, on => setOr(sh, "rough", on ? 0.5 : undefined), { title: "off: the paint's own roughness stays" }));
  if (sh.rough !== undefined) box.append(fRange("Roughness", () => sh.rough, v => { sh.rough = v; }, { dflt: 0.5 }));
  box.append(fColor("Tint", () => sh.tint, v => setOr(sh, "tint", v)));
  const lay = sh.layout || {}, moved = partsOf(mat).filter(([n, isl]) => lay[n] && !same(lay[n].map(r4), isl.rect.map(r4))).map(([n]) => n);
  const missing = partsOf(mat).filter(([n]) => sh.layout && !lay[n]).map(([n]) => n);
  box.append(el("div", { class: "pe-note" }, sh.layout ? `Laid in the layout of ${Object.keys(lay).length} parts: each takes the piece of it that was over it then` +
    (moved.length ? `; ${moved.length} moved since (${moved.slice(0, 4).join(", ")}${moved.length > 4 ? "…" : ""}), each keeping its piece` : "") +
    (missing.length ? `; ${missing.length} new part${missing.length > 1 ? "s" : ""} take none (${missing.slice(0, 3).join(", ")})` : "") + "." :
    "Every part takes what's over it in the texture as it is now."));
  box.append(sizeNote("*", px / Math.max(...Object.keys(M_().islands).map(pxPerMm)), px / Math.max(...Object.keys(M_().islands).map(pxPerMm)), "the texture's own size, twice over"),
    btns(btn("Lay it in the layout as it is now", () => edit(() => { const L = {}; for (const [n, isl] of partsOf(mat)) L[n] = isl.rect.slice(); sh.layout = L; }),
      "the parts take what's over them now (after you've painted over a new template)"),
    btn("Forward", () => reorder(1)), btn("Back", () => reorder(-1)), btn("Delete", () => remove(E.sel), "Delete", "danger")));
}

function smudgeProps(box, i) {
  const M = M_(), m = spec().smudges[i], base = smudgeBase(m);
  const parts = [["*", "any part (scattered)"], ...Object.keys(M.islands).map(n => [n, n])];
  box.append(head(thumbOf(m.image), short(m.image), base.about || "a smudge"),
    fSel("Smudge", [...X.S.smudges.map(x => [x.path, x.name.replace("_", " ")]), ...X.S.pics.map(p => [p.path, p.name])], () => m.image, v => { m.image = v; }),
    fSel("On the part", parts, () => m.island || "*", v => { m.island = v; if (v === "*") m.count = Math.max(2, m.count || 3); }));
  if (!scattered(m)) box.append(fNum("X", () => smudgeBox(m)?.x, v => setOr(m, "x", v), { unit: "mm" }), fNum("Y", () => smudgeBox(m)?.y, v => setOr(m, "y", v), { unit: "mm" }),
    fNum("Turn", () => m.rot || 0, v => setOr(m, "rot", v, 0), { step: 5, unit: "°" }));
  box.append(fNum("Width", () => m.w ?? base.w, v => setOr(m, "w", v), { unit: "mm" }),
    fRange("Strength", () => m.strength, v => setOr(m, "strength", v, 0.8), { dflt: 0.8 }),
    fNum("Count", () => m.count || 1, v => setOr(m, "count", v > 1 ? Math.round(v) : undefined), { step: 1, min: 1, title: "that many scattered at random places, turns and sizes" }),
    fSel("Blend", [["multiply", "darkens toward its colour"], ["mix", "lays its colour"]], () => m.blend || base.blend || "multiply", v => setOr(m, "blend", v, base.blend || "multiply")),
    fRange("Roughness", () => m.rough ?? base.rough, v => setOr(m, "rough", v), { dflt: base.rough ?? 0.5, title: "grease shiny, dust matt" }),
    fNum("Raised", () => m.height || 0, v => setOr(m, "height", v, 0), { step: 0.01, unit: "mm" }),
    fColor("Tint", () => m.tint, v => setOr(m, "tint", v)),
    sizeNote(m.island || "*", m.w ?? base.w ?? 40, m.w ?? base.w ?? 40, "transparent round it"),
    btns(btn("Duplicate", duplicate, "Ctrl+D"), btn("Delete", () => remove(E.sel), "Delete", "danger")));
}

function partProps(box, n) {
  const M = M_(), isl = M.islands[n], px = texPx(isl.mat), [u0, v0, u1, v1] = isl.rect, pw = Math.round((u1 - u0) * px), ph = Math.round((v1 - v0) * px);
  const shape = isl.mm[0] >= isl.mm[1] ? `${(isl.mm[0] / isl.mm[1]).toFixed(2)} : 1` : `1 : ${(isl.mm[1] / isl.mm[0]).toFixed(2)}`;
  const own = (M.slots || []).filter(sl => sl.island === n);
  box.append(head(el("span", { class: "pe-th part" }), n, `a part of the ${isl.mat} texture`),
    el("div", { class: "pe-facts" }, el("div", {}, `${isl.mm[0]} × ${isl.mm[1]} mm, shaped ${shape}`),
      el("div", { title: `the texture holds ${pw} × ${ph} px there; for a close-up or a texture twice the size, twice that` }, `a picture over all of it: ${pw * 2} × ${ph * 2} px or more`),
      isl.wrap ? el("div", { class: "wraps" }, "goes round the prop: a pattern over it wants its left and right edges to meet") : null,
      own.length ? el("div", { class: "dim" }, `its own pictures: ${own.map(s => s.name).join(", ")}`) : null),
    el("label", { class: "pe-f" }, el("span", {}, "Fill it with"), el("select", { onchange: e => { if (e.target.value) fillPart(n, e.target.value); } },
      el("option", { value: "" }, "a picture…"), X.S.pics.map(q => el("option", { value: q.path }, q.name)))),
    btns(btn("Its template", () => partTemplate(n), "the part as it's painted now with its cuts, at the size it wants: paint over it"), btn("Zoom to it", () => zoomTo({ kind: "part", island: n }))));
}

function matProps(box, none) {
  const M = M_(), mat = E.mat, mt = (M.materials || {})[mat] || {};
  if (none) {
    box.append(el("div", { class: "pe-howto" },
      el("b", {}, "Pictures on the prop"),
      el("ul", {},
        el("li", {}, "Drag a picture onto a part: it fills it (one with a transparent ground, a logo or a sticker, is placed where it lands)."),
        el("li", {}, "Onto a dashed box: it takes the place of the prop's own picture there."),
        el("li", {}, "One picture over the whole texture: paint over the Template in Krita and drop it back (or drop any picture off the parts, or with Shift)."),
        el("li", {}, "Pick a picture to move, size and turn it by its handles; Delete, Ctrl+D, Ctrl+Z, the arrows nudge."),
        el("li", {}, "The wheel zooms, drag the background to pan, Shift+1 fits it all. Make bakes it in, the wear over it."))));
  }
  box.append(el("div", { class: "pe-h3 in" }, `The ${mat} texture`, el("span", { class: "dim" }, ` ${mt.kind || ""}, ${mt.px || ""} px`)), pbrRow(mat),
    btns(btn("Template (.ora)", () => template("ora"), "the layout to paint over in Krita: the cuts on a layer of their own over the paint, a Paint layer for you"),
      btn("Template (.png)", () => template("png"), "the paint with the cuts drawn over it")));
  if (!(design(mat).paint)) box.append(el("div", { class: "pe-note" }, "Made before the picture editor: the canvas shows the texture as made (your pictures then baked in). Make it again to see the paint under your pictures."));
}

function pbrRow(mat) {
  const sp = spec(), cur = (sp.pbr || {})[mat], c = cur ? (typeof cur === "string" ? { set: cur } : cur) : null, shelf = X.S.shelf;
  // what changes (inside the field's own step)
  const apply = patch => {
    const now = Object.assign({ set: c ? c.set : shelf[0] && shelf[0].ref }, c || {}, patch);
    for (const k of Object.keys(now)) if (now[k] === undefined) delete now[k];
    if (!now.set) { if (sp.pbr) delete sp.pbr[mat]; return; }
    sp.pbr = sp.pbr || {};
    sp.pbr[mat] = now;
  };
  const sw = c && shelf.find(s => s.ref === c.set);
  const s = el("select", { onchange: e => edit(() => apply({ set: e.target.value || null })) }, el("option", { value: "" }, "— its own paint —"),
    shelf.map(x => el("option", { value: x.ref }, x.ref.slice(4))));
  s.value = c ? c.set : "";
  const row = el("div", { class: "pe-pbr" }, el("label", { class: "pe-f" }, el("span", {}, "PBR set"), s, sw ? el("img", { src: sw.thumb, alt: "" }) : null));
  if (c) row.append(fNum("Tile", () => c.tile ?? (sw && sw.tile_m) ?? 1, v => apply({ tile: v }), { step: 0.05, unit: "m" }),
    fRange("Over its paint", () => c.alpha, v => apply({ alpha: v }), { dflt: 1 }),
    fColor("Tint", () => c.tint, v => apply({ tint: v })),
    el("div", { class: "pe-note" }, "A PBR set is part of the paint under your pictures: Make to see it here."));
  if (!shelf.length) row.append(el("div", { class: "dim" }, "(the shelf is empty: assets/pbr, or propgen.py pbr-add)"));
  return row;
}

// ---- your pictures and the smudges, to drag onto the canvas ------------------------------------------------------------------

function renderAssets() {
  const pics = $(".pe-pics"), smu = $(".pe-smudges");
  if (!pics) return;
  const S = X.S;
  const dragger = (kind, path) => ({
    draggable: "true",
    ondragstart: e => { E.dragging = { kind, path }; e.dataTransfer.setData("text/plain", path); e.dataTransfer.effectAllowed = "copy"; },
    ondragend: () => { E.dragging = null; E.drop = null; const l = $(".pe-label"); if (l) l.hidden = true; overlay(); },
  });
  pics.innerHTML = "";
  for (const p of S.pics) {
    const inf = info(p.path);
    pics.append(el("div", Object.assign({ class: "pe-pic" + (p.path === S.pic ? " sel" : ""), title: `${p.name}${inf ? ` · ${inf.w} × ${inf.h} px${inf.alpha ? " · a transparent ground" : ""}` : ""}\ndrag it onto the texture; a click puts it in the picked layer`,
      "data-path": p.path, onclick: () => usePicture(p.path) }, dragger("picture", p.path)), el("img", { src: p.url, alt: p.name, draggable: "false" })));
  }
  if (!S.pics.length) pics.append(el("div", { class: "pe-empty" }, "None yet: drop PNGs or JPEGs here or onto the texture, or a Krita .ora (its Paint layer)."));
  smu.innerHTML = "";
  for (const m of S.smudges) {
    smu.append(el("div", Object.assign({ class: "pe-pic smudge", title: `${m.name.replace("_", " ")}: ${m.about} (${m.blend})\ndrag it onto a part`, "data-path": m.path }, dragger("smudge", m.path)),
      el("img", { src: m.url, alt: m.name, draggable: "false" })));
  }
}
// a click on one of your pictures: it goes into the picked layer (its picture swapped), else it's the one picked
function usePicture(path) {
  const sel = E.sel, sp = spec();
  X.S.pic = path;
  if (sel && (sel.kind === "decal" || sel.kind === "sheet")) edit(() => { layerOf(sel).image = path; });
  else if (sel && sel.kind === "slot") edit(() => setSlot(M_().slots.find(s => s.id === sel.id), path));
  else if (sel && sel.kind === "part") putPicture({ kind: "part", island: sel.island }, path);
  else toast("Drag it onto a part of the texture (or pick a part first and click it)");
  renderAssets();
  void sp;
}

// ---- the bar over the canvas ---------------------------------------------------------------------------------------------------

function renderBar() {
  const bar = $(".pe-bar");
  if (!bar || !M_() || !M_().islands) return;
  bar.innerHTML = "";
  const ms = mats();
  if (ms.length > 1) bar.append(el("span", { class: "pe-seg" }, ms.map(m => el("button", { class: m === E.mat ? "on" : "", "data-mat": m, title: `the ${m} texture`,
    onclick: () => { E.mat = m; E.z = 0; if (E.sel && matOf(E.sel) !== m) E.sel = null; stage(); renderBar(); refresh(); } }, m))));
  bar.append(el("span", { class: "pe-seg" },
    el("button", { class: E.mode === "design" ? "on" : "", "data-mode": "design", title: "the paint under your pictures and your pictures over it, live: what Make lays before the wear",
      onclick: () => { E.mode = "design"; E.comp = {}; stage(); renderBar(); schedule(true); } }, "Design"),
    el("button", { class: E.mode === "made" ? "on" : "", "data-mode": "made", title: "the texture as it was made, the wear and baked shading on it",
      onclick: () => { E.mode = "made"; E.comp = {}; stage(); renderBar(); schedule(true); } }, "As made")),
    el("label", { class: "pe-tog", title: "the cuts (where the model's surface is cut apart) and what's off the parts dimmed" },
      el("input", { type: "checkbox", checked: E.cuts, onchange: e => { E.cuts = e.target.checked; stage(); } }), "Cuts"),
    el("label", { class: "pe-tog" }, el("input", { type: "checkbox", checked: E.names, onchange: e => { E.names = e.target.checked; overlay(); } }), "Names"),
    el("span", { class: "grow" }),
    el("button", { title: "Zoom out (-)", onclick: () => { const b = $(".pe-canvas"); zoomAt(0.8, b.clientWidth / 2, b.clientHeight / 2); } }, "−"),
    el("span", { class: "pe-zoom" }, `${Math.round(E.z * 100)}%`),
    el("button", { title: "Zoom in (+)", onclick: () => { const b = $(".pe-canvas"); zoomAt(1.25, b.clientWidth / 2, b.clientHeight / 2); } }, "+"),
    el("button", { title: "All of it (Shift+1)", onclick: () => { E.z = 0; place(); } }, "Fit"),
    el("button", { class: "pe-undo", title: "Undo (Ctrl+Z)", disabled: !E.undo.length, onclick: undo }, "↶"),
    el("button", { class: "pe-redo", title: "Redo (Ctrl+Shift+Z)", disabled: !E.redo.length, onclick: redo }, "↷"));
}

// ---- the prop in 3D, wearing the canvas ---------------------------------------------------------------------------------------

async function load3d() {
  const M = M_(), box = $(".pe-3d");
  if (!M || !box) return;
  if (!E.viewer) {
    E.viewer = makeViewer(box, { onPick, distance: 2.1 });
    if (!E.viewer) return;
  } else if (!box.contains(E.viewer.canvas)) box.append(E.viewer.canvas);
  if (E.viewKey === E.key) return;
  E.viewKey = E.key;
  const glb = (M.files || []).find(f => f.endsWith(".glb"));
  if (!glb) return;
  try {
    E.view = await E.viewer.load(fileUrl(glb));
    E.view.ready = true;
  } catch (err) { E.view = { error: err.message }; return; }
  schedule(true);
}
function wear3d() {
  if (!E.viewer || !E.view || !E.view.ready || E.viewKey !== E.key) return;
  const M = M_(), maps = {};
  if (E.mode === "design") for (const m of mats()) maps[`${M.name}_${m}`] = m === E.mat ? E.comp[m] : (E.comp[m] || compose(m));
  E.viewer.setMaps(maps);
  E.viewer.touchMaps();
}
function onPick(hit) {
  const M = M_(), name = hit.material || "", mat = name.startsWith(M.name + "_") ? name.slice(M.name.length + 1) : name;
  if (!(mat in (M.textures || {}))) return;
  const px = texPx(mat), part = partAt(hit.uv[0] * px, hit.uv[1] * px, mat);
  if (!part) return;
  select({ kind: "part", island: part });
  const foot = $(".pe-foot");
  if (foot) foot.textContent = `${part}: picked on the prop in 3D`;
}

// ---- templates to paint over: the whole layout (.ora for Krita, with the cuts on a layer of their own, or a .png), a part's,
// one of its own pictures' ------------------------------------------------------------------------------------------------------

function loaded(url) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("couldn't read " + url)); im.src = url; });
}
function download(blob, name) {
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
const pngOf = c => new Promise(res => c.toBlob(b => b.arrayBuffer().then(a => res(new Uint8Array(a))), "image/png"));
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
// a zip of stored files (OpenRaster's mimetype has to be stored, first)
export function zipStored(files, type = "application/zip") {
  const enc = new TextEncoder(), parts = [], cd = [];
  let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), n = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(12, 0x21, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, n, true); lh.setUint32(22, n, true); lh.setUint16(26, name.length, true);
    parts.push(lh.buffer, name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(14, 0x21, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, n, true); ch.setUint32(24, n, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    cd.push(ch.buffer, name);
    off += 30 + name.length + n;
  }
  const size = cd.reduce((a, b) => a + (b.byteLength ?? b.length), 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, size, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...cd, end.buffer], { type });
}
// the cuts, the own pictures' boxes and the parts' names drawn over a texture-sized canvas
function guideOn(g, mat, px) {
  const M = M_(), lw = Math.max(1, px / 1024), uv = E.uv[mat];
  g.save();
  g.strokeStyle = "#ffd34d";
  g.lineWidth = 1.5 * lw;
  g.beginPath();
  if (uv) for (let i = 0; i < uv.segs.length; i += 4) { g.moveTo(uv.segs[i] * px, uv.segs[i + 1] * px); g.lineTo(uv.segs[i + 2] * px, uv.segs[i + 3] * px); }
  else for (const [, isl] of partsOf(mat)) { const r = rectT(isl, px); g.rect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); }
  g.stroke();
  g.setLineDash([6 * lw, 4 * lw]);
  g.strokeStyle = "#ff9d2e";
  g.lineWidth = lw;
  for (const sl of M.slots || []) {
    const isl = M.islands[sl.island];
    if (!isl || isl.mat !== mat) continue;
    const [bx, by, bw, bh] = sl.box, [a0, b1] = mmT(isl, px, bx, by), [a1, b0] = mmT(isl, px, bx + bw, by + bh);
    g.strokeRect(a0, b0, a1 - a0, b1 - b0);
  }
  g.setLineDash([]);
  g.font = `${Math.round(11 * lw)}px sans-serif`;
  g.textBaseline = "top";
  for (const [n, isl] of partsOf(mat)) {
    const r = rectT(isl, px);
    if (r.x1 - r.x0 < 50 * lw || r.y1 - r.y0 < 14 * lw) continue;
    g.lineWidth = 3 * lw;
    g.strokeStyle = "rgba(0,0,0,0.85)";
    g.fillStyle = "#ffe9a8";
    const t = `${n} ${isl.mm[0]}×${isl.mm[1]}`;
    g.strokeText(t, r.x0 + 3 * lw, r.y0 + 3 * lw);
    g.fillText(t, r.x0 + 3 * lw, r.y0 + 3 * lw);
  }
  g.restore();
}
export async function template(kind = "ora") {
  const M = M_(), mat = E.mat, px = texPx(mat);
  const mk = () => { const c = document.createElement("canvas"); c.width = c.height = px; return c; };
  const base = mk(), guide = mk(), paint = mk(), merged = mk();
  base.getContext("2d").drawImage(await loaded(paintUrl(mat) || madeUrl(mat)), 0, 0, px, px);
  guideOn(guide.getContext("2d"), mat, px);
  const mg = merged.getContext("2d");
  mg.drawImage(base, 0, 0);
  mg.drawImage(guide, 0, 0);
  if (kind === "png") {
    download(new Blob([await pngOf(merged)], { type: "image/png" }), `${M.name}_${mat}_layout.png`);
    toast(`${M.name}_${mat}_layout.png: paint over it, then drop it back onto the texture (it lies over all of it)`);
    return;
  }
  const thumb = document.createElement("canvas"), k = 256 / px;
  thumb.width = thumb.height = Math.round(px * Math.min(1, k));
  thumb.getContext("2d").drawImage(merged, 0, 0, thumb.width, thumb.height);
  const q = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const layers = [["Guide", "data/guide.png", guide, true], ["Paint", "data/paint.png", paint, false], ["Base", "data/base.png", base, false]];
  const stack = ['<?xml version="1.0" encoding="UTF-8"?>', `<image version="0.0.5" w="${px}" h="${px}" xres="72" yres="72">`, " <stack>",
    ...layers.map(([n, src, , locked]) => `  <layer name="${q(n)}" src="${src}" x="0" y="0" opacity="1.0" visibility="visible" composite-op="svg:src-over"${locked ? ' edit-locked="true"' : ""}${n === "Paint" ? ' selected="true"' : ""}/>`),
    " </stack>", "</image>"].join("\n") + "\n";
  const enc = new TextEncoder(), files = [{ name: "mimetype", data: enc.encode("image/openraster") }, { name: "stack.xml", data: enc.encode(stack) }];
  for (const [, src, c] of layers) files.push({ name: src, data: await pngOf(c) });
  files.push({ name: "mergedimage.png", data: await pngOf(merged) }, { name: "Thumbnails/thumbnail.png", data: await pngOf(thumb) });
  const blob = zipStored(files, "image/openraster");
  E.lastTemplate = { name: `${M.name}_${mat}.ora`, size: blob.size };
  download(blob, `${M.name}_${mat}.ora`);
  toast(`${M.name}_${mat}.ora: open it in Krita, paint on Paint (the cuts are on Guide), save, and drop the .ora back onto the texture`);
}
async function partTemplate(n) {
  const M = M_(), isl = M.islands[n], mat = isl.mat, px = texPx(mat), r = rectT(isl, px);
  const [w, h] = wants(n, isl.mm[0], isl.mm[1]);
  const full = document.createElement("canvas");
  full.width = full.height = px;
  const g = full.getContext("2d");
  g.drawImage(await loaded(paintUrl(mat) || madeUrl(mat)), 0, 0, px, px);
  guideOn(g, mat, px);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(full, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 0, 0, w, h);
  download(new Blob([await pngOf(c)], { type: "image/png" }), `${M.name}_${n}.png`);
}
async function slotTemplate(sl) {
  const M = M_(), isl = M.islands[sl.island], px = texPx(isl.mat), [bx, by, bw, bh] = sl.box;
  const [a0, b1] = mmT(isl, px, bx, by), [a1, b0] = mmT(isl, px, bx + bw, by + bh), [w, h] = wants(sl.island, bw, bh);
  const im = await loaded(madeUrl(isl.mat)), c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(im, a0 * iw(im) / px, b0 * ih(im) / px, (a1 - a0) * iw(im) / px, (b1 - b0) * ih(im) / px, 0, 0, w, h);
  download(new Blob([await pngOf(c)], { type: "image/png" }), `${M.name}_${sl.id.replace(".", "_")}.png`);
}

// ---- the editor on the page ---------------------------------------------------------------------------------------------------

function skeleton() {
  const input = el("input", { type: "file", accept: "image/png,image/jpeg,.ora", multiple: true, hidden: true, class: "pe-file", onchange: e => { upload([...e.target.files]); e.target.value = ""; } });
  const pics = el("div", { class: "pe-pics" });
  const left = el("div", { class: "pe-left" },
    el("div", { class: "pe-h3" }, "Layers", el("span", { class: "dim" }, " on this texture")), el("div", { class: "pe-layers" }),
    el("div", { class: "pe-h3" }, "Your pictures", el("button", { class: "pe-mini", title: "add pictures (PNG, JPEG, a Krita .ora)", onclick: () => input.click() }, "+ Add"), input),
    pics, el("div", { class: "pe-h3" }, "Smudges"), el("div", { class: "pe-smudges" }));
  pics.addEventListener("dragover", e => { if (!E.dragging) { e.preventDefault(); pics.classList.add("over"); } });
  pics.addEventListener("dragleave", () => pics.classList.remove("over"));
  pics.addEventListener("drop", e => { if (E.dragging) return; e.preventDefault(); pics.classList.remove("over"); upload([...e.dataTransfer.files]); });
  const cv = el("div", { class: "pe-canvas", tabindex: "0" }, el("div", { class: "pe-stage" }), sv("svg", { class: "pe-over" }),
    el("div", { class: "pe-label", hidden: true }), el("div", { class: "pe-unmade", hidden: true }, "Make it once: the texture's layout (its parts and where it's cut) comes from the last make."));
  cv.addEventListener("pointerdown", onDown);
  cv.addEventListener("pointermove", onHover);
  cv.addEventListener("pointerleave", () => { E.hover = null; overlay(); });
  cv.addEventListener("wheel", onWheel, { passive: false });
  cv.addEventListener("contextmenu", e => e.preventDefault());
  cv.addEventListener("dragover", onDragOver);
  cv.addEventListener("dragleave", onDragLeave);
  cv.addEventListener("drop", onDrop);
  cv.addEventListener("dblclick", e => {
    const [sx, sy] = canvasXY(e), hit = hitAt(sx, sy);
    if (hit) zoomTo(hit); else { E.z = 0; place(); }
  });
  new ResizeObserver(() => { if (!E || !X || !M_() || !M_().islands) return; if (E.auto) E.z = 0; place(); }).observe(cv);
  const root = el("div", { class: "pe" }, left,
    el("div", { class: "pe-mid" }, el("div", { class: "pe-bar" }), cv, el("div", { class: "pe-foot" }, "Drag pictures onto the parts · the wheel zooms, drag the background to pan · Shift-drop: over the whole texture")),
    el("div", { class: "pe-right" }, el("div", { class: "pe-props" }),
      el("div", { class: "pe-h3", title: "the prop wearing the canvas as it's edited: drag to turn it, the wheel to come closer, a click on a part picks it" },
        "On the prop", el("span", { class: "dim" }, "· click a part to pick it")), el("div", { class: "pe-3d" })));
  document.addEventListener("keydown", onKey);
  document.addEventListener("keyup", onKeyUp);
  return root;
}

// the Texture & pictures tab: the editor built once, drawn for the recipe that's open
export function renderEditor(ctx) {
  X = ctx;
  state();
  sync();
  const tab = $("#tab-texture");
  if (!E.root) E.root = skeleton();
  if (E.root.parentNode !== tab) { tab.innerHTML = ""; tab.append(E.root); }
  const M = M_(), made = !!(M && M.islands && M.textures);
  $(".pe-unmade").hidden = made;
  renderAssets();
  if (!made) {
    for (const s of [".pe-layers", ".pe-props", ".pe-bar", ".pe-stage", ".pe-over"]) $(s).innerHTML = "";
    if (E.viewer) E.viewer.clear();
    E.viewKey = null;
    return;
  }
  renderBar();
  stage();
  refresh();
  loadUV();
  load3d();
  requestAnimationFrame(() => { place(); schedule(true); });
}

// for the page's check: where a part's millimetre is on the screen, and the canvas's colour there
Object.assign(window, {
  __pe: {
    toScreen(island, x, y) {
      const isl = M_().islands[island], [tx, ty] = mmT(isl, texPx(isl.mat), x, y), [sx, sy] = toS(tx, ty), b = $(".pe-canvas").getBoundingClientRect();
      return [b.left + sx, b.top + sy];
    },
    colourAt(island, x, y) {
      const isl = M_().islands[island], px = texPx(isl.mat), c = compose(isl.mat), [tx, ty] = mmT(isl, px, x, y);
      return [...c.getContext("2d").getImageData(Math.floor(tx), Math.floor(ty), 1, 1).data.slice(0, 3)];
    },
    handle(name) { const h = handlesOf(frameOf(E.sel)).find(x => x.name === name), b = $(".pe-canvas").getBoundingClientRect(); return h ? [b.left + h.s[0], b.top + h.s[1]] : null; },
    live3d() { return E.viewer ? Object.keys(E.viewer.liveMaps()) : []; },
    cuts(mat) { const u = E.uv[mat || E.mat]; return u ? { segs: u.segs.length / 4, tris: u.tris } : null; },
    putPicture, select, undo, redo, template, upload, zipStored,
  },
});

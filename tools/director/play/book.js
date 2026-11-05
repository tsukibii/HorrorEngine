// A book in the hands (STORY_FORMAT: the `book` use; DECISIONS 2026-11-05, later: "a system for opening up books ...
// writing in the book that looks like handwriting ... an overlay UI on the right with clearer text ... progress the
// text"): the thing taken up as the inspect use takes it (examine.js: itself in front of the eye, over the room), its
// cover swung open on its part (a made prop's: PROPGEN §27), its spread shown with the story's pages written on its page
// materials in a hand (a canvas a page over the page's own paper, the OFL fonts the desk serves from the Godot add-on's
// fonts/), a spread at a time, the pages turned by the arrows, the wheel or a click on either half, the clean text of
// the spread on a column at the right (hud.book), and the book put back closed where it was. Its pages: `pages` (each a
// page, in order) and then its `entries`, each with an `if` (a flag, or a list of them, `!` for not, `item:<id>` for an
// item held, as a bed's `if`) and its text (a form feed, "\f", between an entry's pages), appended in order while the
// condition holds, so what's read grows with the game. The story hears `read` (the book, the left page's number) at
// every spread, and `use` when it's put back. Godot: book.gd, the same.
import * as THREE from "three";
import { Examine, small } from "./examine.js";
import { scanParts, infoOf, applyParts } from "./openable.js";

export const FONTS = { hand: "Caveat-Variable.ttf", hand2: "IndieFlower-Regular.ttf", hand_jp: "Yomogi-Regular.ttf", pen_jp: "ZenKurenaido-Regular.ttf" };
export const OPEN_SECS = 0.45, CLOSE_SECS = 0.32;
const FILL = 0.32, UP = 0.02, LEFT = -0.09, TILT = 1.05;   // in the hands: the open spread this wide (m), about the eye's line, a little left (clear of the column at the right), tilted up to be read
const INK = "#1f2440", PAPER = "#efe9da", X = new THREE.Vector3(1, 0, 0);
const loaded = {};

// the hand's font, loaded once from the desk (/fonts/<file>); `print` and an unknown hand: the HUD's own serif
function fontOf(hand) {
  const file = FONTS[hand];
  if (!file || typeof FontFace === "undefined") return Promise.resolve(null);
  if (!loaded[hand]) {
    const f = new FontFace("hs-" + hand, `url(/fonts/${file})`);
    loaded[hand] = f.load().then(() => { document.fonts.add(f); return "hs-" + hand; }).catch(() => null);
  }
  return loaded[hand];
}

export class Book {
  constructor(rt) { this.rt = rt; this.cur = null; }
  up() { return !!this.cur; }                      // true while a book is open in the hands (Godot's book.up())
  // the pages the book shows now: its own, then every entry whose `if` holds
  pagesOf(t) {
    const d = (t.userData.piece || {}).d || {}, out = [];
    for (const p of d.pages || []) out.push(text(p));
    for (const e of d.entries || []) {
      if (e && typeof e === "object") { if (this.rt.ifHolds(e.if)) for (const pg of text(e).split("\f")) out.push(pg); }
      else out.push(String(e));
    }
    if (!out.length) out.push("");
    return out;
  }
  // the book opened in the hands: its pages drawn, the column up till it's put back
  async open(t, s) {
    const rt = this.rt;
    if (this.cur) return;
    const d = (t.userData.piece || {}).d || {}, id = t.userData.id, title = d.title || rt.nameOf(t), hand = String(d.hand || "hand");
    const pages = this.pagesOf(t), held = small(t);
    const cur = this.cur = { t, pages, at: Math.floor((+d.start || 0) / 2) * 2, rec: null, views: {}, title, hand, held, ex: null };
    let ex = null;
    if (held) {
      ex = cur.ex = rt.examining = new Examine(rt, t);              // in the hands, lying open toward the eye: no turning it
      const copy = ex.turner.children[0], box = new THREE.Box3().setFromObject(copy), size = box.getSize(new THREE.Vector3());
      ex.turner.scale.setScalar(THREE.MathUtils.clamp(FILL / Math.max(size.x, size.y, size.z), 0.4, 4));
      ex.want.setFromAxisAngle(X, TILT); ex.turner.quaternion.copy(ex.want); ex.up = UP; ex.x = LEFT;
      const parts = scanParts(copy);
      if (parts.length) {
        cur.rec = { parts, openS: 0 }; applyParts(parts, 0);
        rt.shelfSound("book_open", id, -4);
        rt.movers.go(cur.rec, 1, OPEN_SECS);
        await rt.wait(OPEN_SECS);
      }
      if (this.cur !== cur) return;
      await this.makeViews(copy, t);
      if (this.cur !== cur) return;
    }
    this.draw();
    rt.emit({ type: "read", book: id, page: cur.at });
    try {
      await rt.modal(() => rt.hud.book({ title, text: this.clean(), hint: s && s.hint, turn: dir => this.turn(dir) }));
      if (this.cur !== cur) return;
      if (ex && cur.rec) { rt.shelfSound("book_close", id, -6); rt.movers.go(cur.rec, 0, CLOSE_SECS); await rt.wait(CLOSE_SECS); }
    } finally {
      for (const v of Object.values(cur.views)) v.tex.dispose();
      if (ex) { ex.end(); if (rt.examining === ex) rt.examining = null; }
      if (this.cur === cur) this.cur = null;
    }
  }
  // the page materials on the copy (the glb's `<prop>_page_l` and `_page_r`): each gets a canvas of its own, the page's
  // paper under the words, as its colour map (flipY off, as the glb's textures are)
  async makeViews(copy, t) {
    const cur = this.cur, info = infoOf(copy), pagesInfo = info.pages && typeof info.pages === "object" ? info.pages : null;
    const font = await fontOf(cur.hand);
    // the copy's meshes beside the thing's own, in order (a clone keeps it): the names are read off the thing's real
    // materials (the simple view swaps a mesh's for plain ones, kept as its fullMat), the canvas goes on the copy's
    const own = []; t.traverse(o => { if (o.isMesh) own.push(o); });
    const mine = []; copy.traverse(o => { if (o.isMesh) mine.push(o); });
    mine.forEach((o, i) => {
      const src = own[i] || o, real = src.userData.fullMat || src.material, names = (Array.isArray(real) ? real : [real]).map(m => String((m && m.name) || ""));
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m, j) => {
        const nm = names[j] || String(m.name || ""), side = nm.endsWith("_page_l") || nm === "page_l" ? "page_l" : nm.endsWith("_page_r") || nm === "page_r" ? "page_r" : "";
        if (!m || !side || cur.views[side]) return;
        const srcMat = Array.isArray(real) ? real[j] : real, tex = (srcMat && srcMat.map) || m.map, img = tex && tex.image;
        const W = (img && (img.width || img.naturalWidth)) || 1024, H = (img && (img.height || img.naturalHeight)) || 1024;
        const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
        const ct = new THREE.CanvasTexture(canvas); ct.flipY = false; ct.colorSpace = THREE.SRGBColorSpace; ct.anisotropy = 4;
        const pi = pagesInfo && pagesInfo[side] ? pagesInfo[side] : {}, rect = pi.rect || [0, 0, 1, 1], mm = pi.mm || [148, 210];
        const x0 = rect[0] * W, x1 = rect[2] * W, y0 = (1 - rect[3]) * H, y1 = (1 - rect[1]) * H, pxmm = (x1 - x0) / Math.max(1, mm[0]);
        cur.views[side] = { canvas, tex: ct, img, font, box: { x: x0 + 8 * pxmm, y: y0 + 14 * pxmm, w: (x1 - x0) - 16 * pxmm, h: (y1 - y0) - 22 * pxmm },
                            size: 6.4 * pxmm * (+((t.userData.piece || {}).d || {}).font_size || 1), gap: 9 * pxmm };
        m.map = ct; if (m.color) m.color.set(0xffffff); m.needsUpdate = true;
      });
    });
  }
  draw() {
    const cur = this.cur; if (!cur) return;
    for (const side of ["page_l", "page_r"]) {
      const v = cur.views[side]; if (!v) continue;
      const i = cur.at + (side === "page_l" ? 0 : 1), words = i < cur.pages.length ? cur.pages[i] : "";
      const c = v.canvas.getContext("2d"); c.setTransform(1, 0, 0, 1, 0, 0);
      if (v.img) { try { c.drawImage(v.img, 0, 0, v.canvas.width, v.canvas.height); } catch (e) { paper(c, v); } } else paper(c, v);
      write(c, words, v); v.text = words;              // (the words on this page's canvas this spread: the checks read them)
      v.tex.needsUpdate = true;
    }
  }
  // the spread's words, plain, for the column at the right
  clean() {
    const cur = this.cur; if (!cur) return "";
    const n = cur.pages.length, parts = [];
    for (const i of [cur.at, cur.at + 1]) if (i < n && String(cur.pages[i]).trim()) parts.push(String(cur.pages[i]));
    const spread = Math.floor(cur.at / 2) + 1, total = Math.floor((n + 1) / 2);
    return parts.join("\n\n") + (total > 1 ? `\n\n— ${spread} / ${total} —` : "");
  }
  // the next spread (dir 1) or the one before (-1); true when it turned
  turn(dir) {
    const cur = this.cur; if (!cur) return false;
    const n = cur.pages.length, last = Math.max(0, Math.floor((n - 1) / 2) * 2), to = Math.max(0, Math.min(last, cur.at + 2 * Math.sign(dir)));
    if (to === cur.at) return false;
    cur.at = to;
    this.rt.shelfSound(["page_turn_01", "page_turn_02", "page_turn_03"][Math.floor(Math.random() * 3)], cur.t.userData.id, -8);
    this.draw(); this.rt.hud.panelText(this.clean());
    this.rt.emit({ type: "read", book: cur.t.userData.id, page: to });
    return true;
  }
}

const text = p => (p && typeof p === "object" ? String(p.text ?? "") : String(p ?? ""));
function paper(c, v) { c.fillStyle = PAPER; c.fillRect(0, 0, v.canvas.width, v.canvas.height); }   // no paper picture (the simple view): plain paper
// the words in the page's box in the hand, wrapped at its width (a word too wide, or Japanese, broken at a character)
function write(c, words, v) {
  if (!String(words || "").trim()) return;
  const b = v.box, size = v.size, gap = Math.max(v.gap, size * 1.25);
  c.font = `${size}px ${v.font ? `"${v.font}", ` : ""}"Source Serif 4", "Noto Serif JP", serif`; c.fillStyle = INK; c.textBaseline = "alphabetic";
  const lines = [];
  for (const para of String(words).split("\n")) {
    const units = /[　-鿿＀-￯]/.test(para) ? [...para] : para.split(/(\s+)/).filter(x => x !== "");
    let line = "";
    for (const u of units) {
      const tryLine = line + u;
      if (c.measureText(tryLine).width <= b.w || !line.trim()) line = tryLine;
      else { lines.push(line.replace(/\s+$/, "")); line = u.trim() ? u : ""; }
    }
    lines.push(line.replace(/\s+$/, ""));
  }
  let y = b.y + size;
  for (const ln of lines) { if (y > b.y + b.h) break; c.fillText(ln, b.x, y); y += gap; }
}

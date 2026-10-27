// expressions.js: the expression library in the desk's Expressions tab (docs/EXPRESSIONS_PLAN.md §1). Cards (the
// character the panel shows them on, at the expression's strongest moment, playing it through on hover; the name under
// it; or names only), dragged out as `application/x-expression` (the timeline's
// face rows take them: step 2); Import: a video sent to the server (tools/face_capture.py solves it), then a preview,
// the clip beside a character playing the face in sync (the default MHR, a cast member in their body, or an exported
// Studio character), its neutral, strength and name; Accept keeps it, Discard throws it away. A card's red x asks first,
// then the server moves it to Saved/Expressions/removed. Clicking a card opens the same preview to change it.
import * as THREE from "three";
import { modal, toast } from "./ui.js";
import { icon } from "./icons.js";
import * as FACE from "/shared/face.js";

const h = (t, a = {}, ...k) => {
  const e = document.createElement(t);
  for (const [n, v] of Object.entries(a)) {
    if (n === "on") for (const [ev, f] of Object.entries(v)) e.addEventListener(ev, f);
    else if (n === "style") e.style.cssText = v;
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(n, v === true ? "" : v);
  }
  for (const c of k.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const keep = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { } return null; };
const api = async (url, o) => { const r = await fetch(url, o), j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; };
export const DRAG_TYPE = "application/x-expression";

// ctx: {stage() (the flow stage: its pose library, makeFigure, its bodies), story() (S), ensureBody(file) (a body loaded
// into the stage's templates), bodies() (every previs_body the server has)}
export class ExpressionsPanel {
  constructor(root, ctx) {
    this.root = root; this.ctx = ctx; this.list = []; this.query = "";
    this.namesOnly = keep("dd.exprNames") === "1";
    this.who = keep("dd.exprWho") || "mhr";              // the character the cards show the expressions on
    this.thumbs = null; this.pics = new Map(); this.exprs = new Map(); this.queue = Promise.resolve();
    this.file = h("input", { type: "file", accept: "video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v", style: "display:none", on: { change: () => { const f = this.file.files[0]; this.file.value = ""; if (f) this.import(f); } } });
    root.append(this.file);
  }
  async refresh() {
    try { this.list = (await api("/api/expressions")).expressions; } catch (e) { this.list = []; }
    this.pics.clear(); this.wearThumbs();               // the character dressed again (a game's cast changes with the game)
    this.render();
  }
  render() {
    const r = this.root; r.querySelectorAll(":scope > :not(input[type=file])").forEach(x => x.remove());
    const names = h("label", { class: "xp-tog", title: "a compact list of names instead of pictures" }, h("input", { type: "checkbox", checked: this.namesOnly || null, on: { change: e => { this.namesOnly = e.target.checked; keep("dd.exprNames", this.namesOnly ? "1" : "0"); this.render(); } } }), " names only");
    const find = h("input", { type: "search", class: "xp-find", placeholder: "find…", value: this.query, on: { input: e => { this.query = e.target.value; this.drawCards(grid); } } });
    const grid = h("div", { class: "xp-grid" + (this.namesOnly ? " names" : "") });
    const on = h("select", { class: "xp-on", title: "the character the cards show the expressions on", on: { change: e => { this.who = e.target.value; keep("dd.exprWho", this.who); this.pics.clear(); this.wearThumbs().then(() => this.drawCards(grid)); } } });
    this.whoOptions().then(opts => { for (const [v, l] of opts) on.append(h("option", { value: v, selected: v === this.who || null }, l)); if (!opts.some(o => o[0] === this.who)) { this.who = "mhr"; on.value = "mhr"; } });
    r.append(h("div", { class: "xp-bar" }, h("button", { class: "primary", id: "xpImport", title: "a video of a face: its expression captured (the head's movement left out), previewed, named, kept", on: { click: () => this.file.click() } }, icon("plus", 13), " Import"), find, names),
      h("div", { class: "xp-bar" }, h("span", { class: "muted" }, "shown on"), on),
      grid, h("p", { class: "kv" }, "Each card is the character at the expression's strongest moment; hover plays it through. Click one to preview, rename or retune it; drag it onto a scene's face row (the timeline). Stored in Content/Studio/Expressions."));
    this.drawCards(grid);
  }
  drawCards(grid) {
    grid.replaceChildren();
    const q = this.query.trim().toLowerCase(), shown = this.list.filter(x => !q || x.name.toLowerCase().includes(q) || x.id.includes(q));
    if (!shown.length) grid.append(h("div", { class: "muted xp-empty" }, this.list.length ? "nothing matches" : "No expressions yet: Import a video of a face."));
    for (const x of shown) grid.append(this.card(x));
  }
  card(x) {
    const cv = this.namesOnly ? null : h("canvas", { width: THUMB, height: THUMB });
    const pic = cv ? h("div", { class: "xp-pic" }, cv) : null;
    const del = h("button", { class: "xp-x", title: "remove this expression", on: { click: e => { e.stopPropagation(); this.remove(x); } } }, "×");
    const c = h("div", { class: "xp-card", draggable: "true", "data-id": x.id, title: `${x.name} · ${(+x.secs || 0).toFixed(1)} s\nclick: preview · drag: onto a face row` },
      pic, h("div", { class: "xp-name" }, x.name, this.namesOnly ? h("span", { class: "muted" }, ` ${(+x.secs || 0).toFixed(1)} s`) : null), del);
    c.addEventListener("dragstart", e => { e.dataTransfer.setData(DRAG_TYPE, x.id); e.dataTransfer.setData("text/plain", x.id); e.dataTransfer.effectAllowed = "copy"; });
    c.addEventListener("click", () => this.open(x));
    if (cv) {                                          // the character at its strongest moment; hover: the whole expression on it
      this.paint(x, cv);
      c.addEventListener("mouseenter", () => this.play(x, cv));
      c.addEventListener("mouseleave", () => { if (this.playing && this.playing.cv === cv) this.playing.stop = true; });
    }
    return c;
  }
  // the cards' pictures: one small view of their own (FacePreview) wearing the panel's character, rendered one at a time
  async whoOptions() {
    const story = this.ctx.story() || {}, people = (await this.ctx.bodies().catch(() => [])).filter(f => f.startsWith("people/"));
    return [["mhr", "the default body (MHR)"], ...Object.entries(story.cast || {}).map(([id, c]) => ["cast:" + id, `${c.name || id} (cast)`]), ...people.map(f => [f, `${f.slice(7)} (Studio export)`])];
  }
  wearThumbs() {
    if (!this.thumbs) this.thumbs = new FacePreview(null, this.ctx, THUMB);
    return (this.queue = this.queue.then(() => this.thumbs.wear(this.who)).catch(() => null));
  }
  expr(x) {
    const k = x.id + "|" + x.stamp;
    if (!this.exprs.has(k)) this.exprs.set(k, api(`/api/expressions/${encodeURIComponent(x.id)}`));
    return this.exprs.get(k);
  }
  paint(x, cv) {
    const k = `${this.who}|${x.id}|${x.stamp}`;
    if (this.pics.has(k)) { cv.getContext("2d").drawImage(this.pics.get(k), 0, 0); return; }
    if (!this.thumbs) this.wearThumbs();
    this.queue = this.queue.then(async () => {
      const [e, M] = await Promise.all([this.expr(x), FACE.loadMap()]);
      this.thumbs.frame(FACE.toMHR(FACE.sample(e, strongest(e) / e.fps), M));
      const shot = document.createElement("canvas"); shot.width = shot.height = THUMB; shot.getContext("2d").drawImage(this.thumbs.renderer.domElement, 0, 0, THUMB, THUMB);
      if (this.thumbs.fig) this.pics.set(k, shot);       // kept only once there's a body in it
      cv.getContext("2d").drawImage(shot, 0, 0);
    }).catch(() => null);
  }
  async play(x, cv) {
    if (this.playing) this.playing.stop = true;
    const run = this.playing = { cv, stop: false };
    await this.queue; const [e, M] = await Promise.all([this.expr(x), FACE.loadMap()]).catch(() => [null, null]);
    if (!e || run.stop) return this.paint(x, cv);
    const t0 = performance.now(), g = cv.getContext("2d");
    const step = () => {
      if (run.stop) { this.paint(x, cv); return; }
      this.thumbs.frame(FACE.toMHR(FACE.sample(e, (performance.now() - t0) / 1000, { loop: true }), M));
      g.drawImage(this.thumbs.renderer.domElement, 0, 0, THUMB, THUMB); requestAnimationFrame(step);
    };
    step();
  }
  async remove(x) {
    const ok = await modal({ title: "Remove this expression?", ok: "Remove", body: h("p", {}, `“${x.name}” leaves the library. It's kept in Saved/Expressions/removed: move its folder back into Content/Studio/Expressions to bring it back.`) });
    if (!ok) return;
    try { await api(`/api/expressions/${encodeURIComponent(x.id)}/remove`, { method: "POST", body: "{}" }); toast(`removed “${x.name}”`); }
    catch (e) { toast("couldn't remove it: " + e.message); }
    this.refresh();
  }
  async import(file) {
    let close = null;
    const waiting = modal({ title: "Reading the face…", ok: null, cancel: null, focus: false, body: h("div", { class: "xp-wait" }, h("div", { class: "xp-spin" }), h("p", {}, `${file.name}: every frame's expression (MediaPipe), the head's movement left out. A few seconds a clip.`)), ready: c => { close = c; } });
    let res = null;
    try { res = await api(`/api/expressions/import?file=${encodeURIComponent(file.name)}`, { method: "POST", body: file }); }
    catch (e) {
      close && close(null); await waiting;
      toast(e.message === "not found" ? "The desk's server is older than the Expressions tab: stop it and start it again (python tools/director/serve.py), then Import."   // the page is read fresh from disk, the server's routes only when it starts
        : "the capture failed: " + e.message, { ms: 20000 });
      return;
    }
    close && close(null); await waiting;
    const guess = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    await this.preview(res.expression, { token: res.token, clip: `/expressions/pending/${res.token}/clip.mp4`, name: "", guess });
  }
  async open(x) {
    let e; try { e = await api(`/api/expressions/${encodeURIComponent(x.id)}`); } catch (err) { toast(err.message); return; }
    await this.preview(e, { id: x.id, clip: x.clip ? `/expressions/${encodeURIComponent(x.id)}/clip.mp4?v=${x.stamp}` : null, name: e.name || x.name });
  }
  // the preview: the clip and the character side by side, in sync; neutral, strength, name; Accept (new) or Save
  async preview(e, o) {
    const fresh = !!o.token, M = await FACE.loadMap().catch(() => null);
    const video = o.clip ? h("video", { src: o.clip, muted: true, loop: true, playsinline: true, autoplay: true, class: "xp-video" }) : h("div", { class: "xp-video muted" }, "no clip");
    if (video.tagName === "VIDEO") video.muted = true;
    const view = h("div", { class: "xp-view" }), note = h("div", { class: "kv xp-note" });
    const who = h("select", { title: "who plays it: the default MHR, a cast member in their own body, or a Studio character as exported" });
    for (const [v, l] of await this.whoOptions()) who.append(h("option", { value: v, selected: v === this.who || null }, l));
    const neutral = h("select", {}, FACE.NEUTRALS.map(([v, l]) => h("option", { value: v, selected: (e.neutral || "first") === v || null }, l)));
    const strength = h("input", { type: "range", min: "0", max: "2", step: "0.05", value: e.strength ?? 1 }), sOut = h("span", { class: "muted" }, (+strength.value).toFixed(2));
    strength.addEventListener("input", () => { sOut.textContent = (+strength.value).toFixed(2); });
    // its length: the seconds the whole capture plays in (slower or faster than filmed, the frames curved between); the
    // video plays at the same rate, so the two stay side by side
    const own = +(e.secs || e.frames / e.fps), len = h("input", { type: "number", min: "0.2", max: "60", step: "0.1", value: (+(e.length || own)).toFixed(2), style: "width:80px" });
    const lenOf = () => Math.max(0.2, Math.min(60, +len.value || own)), rate = h("span", { class: "muted" });
    const relen = () => { const r = own / lenOf(); rate.textContent = `${r < 1 ? "slower" : r > 1 ? "faster" : "as filmed"} (×${r.toFixed(2)}; filmed ${own.toFixed(2)} s)`; if (video.tagName === "VIDEO") video.playbackRate = Math.max(0.0625, Math.min(16, r)); };
    len.addEventListener("input", relen);
    const lenReset = h("button", { class: "ghost", title: "back to the length it was filmed at", on: { click: () => { len.value = own.toFixed(2); relen(); } } }, "as filmed");
    const name = h("input", { type: "text", value: o.name || "", placeholder: o.guess || "a name, e.g. pout and glance", class: "xp-nameIn" });
    const body = h("div", { class: "xp-prev" },
      h("div", { class: "xp-panes" }, h("div", {}, h("div", { class: "kv" }, "the video"), video), h("div", {}, h("div", { class: "kv" }, "on a character"), view)), note,
      h("div", { class: "frm-r" }, h("label", {}, "Character"), who), h("div", { class: "frm-r" }, h("label", { title: "what the face at rest reads as: taken away from every frame" }, "Neutral"), neutral),
      h("div", { class: "frm-r" }, h("label", {}, "Strength"), h("div", { class: "row" }, strength, sOut)),
      h("div", { class: "frm-r" }, h("label", { title: "how many seconds the whole expression takes: its frames slowed or sped up, smooth between them" }, "Length (s)"), h("div", { class: "row" }, len, lenReset, rate)),
      h("div", { class: "frm-r" }, h("label", {}, "Name"), name),
      h("p", { class: "kv" }, `${(+e.secs || 0).toFixed(1)} s · ${e.frames} frames at ${e.fps} fps · ${Object.keys(e.curves || {}).length} channels that move · from ${(e.source || {}).file || "a video"}`));
    const P = new FacePreview(view, this.ctx);
    const setWho = async () => { note.textContent = await P.wear(who.value) || ""; };
    who.addEventListener("change", setWho); setWho();
    const t0 = performance.now(); relen();
    P.run(() => {
      const t = video.tagName === "VIDEO" && !video.paused ? video.currentTime * lenOf() / own : (performance.now() - t0) / 1000;   // the video's time is the filmed one
      return M ? FACE.toMHR(FACE.sample(e, t, { loop: true, neutral: neutral.value, strength: +strength.value, length: lenOf() }), M) : null;
    });
    const ans = await modal({ title: fresh ? "A new expression" : `“${e.name || o.name}”`, wide: true, body, ok: fresh ? "Accept" : "Save", cancel: fresh ? "Discard" : "Close", focus: false });
    P.dispose(); if (video.tagName === "VIDEO") video.pause();
    const nm = name.value.trim() || o.guess || "expression";
    try {
      if (fresh && ans === true) { const r = await api("/api/expressions/accept", { method: "POST", body: JSON.stringify({ token: o.token, name: nm, neutral: neutral.value, strength: +strength.value, length: lenOf() }) }); toast(`“${r.name}” is in the library`); }
      else if (fresh) await api("/api/expressions/discard", { method: "POST", body: JSON.stringify({ token: o.token }) });
      else if (ans === true) await api(`/api/expressions/${encodeURIComponent(o.id)}/set`, { method: "POST", body: JSON.stringify({ name: nm, neutral: neutral.value, strength: +strength.value, length: lenOf() }) });
    } catch (err) { toast(err.message); }
    this.refresh();
  }
}

const THUMB = 192;
/** the frame furthest from the first: an expression's strongest moment (a card's picture) */
export function strongest(e) {
  const cs = Object.values(e.curves || {}); let best = -1, at = 0;
  for (let i = 0; i < (e.frames || 1); i++) { let s = 0; for (const c of cs) s += Math.abs(c[i] - c[0]); if (s > best) { best = s; at = i; } }
  return at;
}

// a character's face in a small view of its own: the body posed at rest, the camera on the face (box: where its
// canvas goes, or null for one kept off the page: the cards' pictures)
export class FacePreview {
  constructor(box, ctx, size = 360) {
    this.box = box; this.ctx = ctx; this.fig = null; this.targets = [];
    this.renderer = new THREE.WebGLRenderer({ antialias: true }); this.renderer.setPixelRatio(box ? Math.min(2, devicePixelRatio || 1) : 1);
    this.renderer.setSize(size, size, false); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = "xp-canvas"; if (box) box.append(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x1d1d22);
    this.scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x302a26, 1.1));
    const key = new THREE.DirectionalLight(0xfff1e0, 2.2); key.position.set(0.6, 1.2, 1.4); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fb7ff, 0.8); rim.position.set(-1, 0.6, -0.8); this.scene.add(rim);
    this.camera = new THREE.PerspectiveCamera(22, 1, 0.02, 20);
  }
  // who: "mhr", "cast:<id>" or a previs_body ("people/<name>"); answers a note (or "") about what it can show
  async wear(who) {
    const st = this.ctx.stage(), story = this.ctx.story() || {};
    if (this.fig) { this.scene.remove(this.fig.group); this.fig = null; this.targets = []; }
    const c = who.startsWith("cast:") ? Object.assign({}, (story.cast || {})[who.slice(5)]) : { height: 1.65, previs_body: who === "mhr" ? st.defaultBody : who };
    if (!c.previs_body) c.previs_body = (story.game || {}).previs_body || st.defaultBody;
    try { await this.ctx.ensureBody(c.previs_body); } catch (e) { return `couldn't load ${c.previs_body}: ${e.message}`; }
    const fig = st.makeFigure(c, 0xc9b3a2);
    if (!fig || !fig.model) return "that character has no body to show (a capsule)";
    this.fig = fig; this.scene.add(fig.group);
    try { fig.update(this.ctx.M.fk(st.lib, this.ctx.M.clonePose(st.lib.poses.idle), fig.height).pos); if (fig.afterPose) fig.afterPose(); } catch (e) { }
    fig.group.updateMatrixWorld(true);
    const head = fig.headWorld ? fig.headWorld() : new THREE.Vector3(0, 1.55, 0);
    this.camera.position.set(head.x, head.y + 0.03, head.z + 0.78); this.camera.lookAt(head.x, head.y + 0.015, head.z); this.camera.updateMatrixWorld();
    this.targets = FACE.faceOf(fig.model, await FACE.loadMHRFace().catch(() => null));
    return this.targets.length ? "" : "this body carries no face shapes: an expression can't play on it (a Studio export gains them when it's exported again: EXPRESSIONS_PLAN §1b)";
  }
  frame(w72) { FACE.setFace(this.targets, w72); this.renderer.render(this.scene, this.camera); }
  run(weights) {
    const loop = () => { if (this.dead) return; FACE.setFace(this.targets, weights()); this.renderer.render(this.scene, this.camera); this.raf = requestAnimationFrame(loop); };
    loop();
  }
  dispose() { this.dead = true; cancelAnimationFrame(this.raf); this.renderer.dispose(); this.renderer.domElement.remove(); }
}

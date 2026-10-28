// The Studio's sound-effect shelf in the desk (docs/SFX.md): CC0 doors, steps, knocks, breaths, stings and room tones
// in Content/Studio/SFX, its index at /api/sfx and its files at /sfx/<file>. A story sound whose file is "sfx/<name>"
// plays off the shelf: in Play (the `sound` command, placed at its `at`), in the Watch (a scene's sound cues on their
// clip edges) and from ▶ in the Database. A sound of the game's own (any other file) lives in Unreal and is only named.
//   await shelf()                         {name: {file, category, tags, secs, loop, credit}}
//   playShelf(name, {pos, camera, db, loop}) -> {stop()}; playStorySound(story, id, opts) -> false if it isn't the shelf's
//   pickShelf(current) -> a name, or null: the shelf in a dialog, searchable, each one heard on a click
import { h, modal } from "./ui.js";
import { icon } from "./icons.js";

let INDEX = null, CTX = null, MASTER = null, PREVIEW = null;
const BUF = {};
export const shelfName = file => typeof file === "string" && file.startsWith("sfx/") ? file.slice(4) : null;
export function shelf() {
  if (!INDEX) INDEX = fetch("/api/sfx").then(r => r.ok ? r.json() : {}).then(j => j.sounds || {}).catch(() => ({}));
  return INDEX;
}
function ctx() {
  if (CTX) return CTX;
  CTX = new (window.AudioContext || window.webkitAudioContext)();
  MASTER = CTX.createGain(); MASTER.gain.value = 0.9; MASTER.connect(CTX.destination);
  const wake = () => { if (CTX.state === "suspended") CTX.resume(); };    // a browser starts sound on a gesture
  window.addEventListener("pointerdown", wake); window.addEventListener("keydown", wake); wake();
  return CTX;
}
async function buffer(name) {
  const s = (await shelf())[name]; if (!s) return null;
  if (!BUF[name]) BUF[name] = fetch("/sfx/" + s.file).then(r => { if (!r.ok) throw new Error(s.file + " " + r.status); return r.arrayBuffer(); }).then(b => ctx().decodeAudioData(b));
  try { return await BUF[name]; } catch (e) { delete BUF[name]; console.warn("sfx", name, e); return null; }
}
// the listener at the camera, looking where it looks (as the little things' sounds do)
function listen(camera) {
  const L = ctx().listener, p = camera.position, f = camera.getWorldDirection(camera.position.clone());
  if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
  else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
}
export async function playShelf(name, o = {}) {
  const buf = await buffer(name); if (!buf) return null;
  const c = ctx(), src = c.createBufferSource(), g = c.createGain();
  src.buffer = buf; src.loop = !!o.loop; g.gain.value = Math.pow(10, (o.db || 0) / 20);
  let out = g;
  if (o.pos && o.camera) {                                 // placed in the room: quieter across it, from its side
    listen(o.camera);
    const p = c.createPanner(); p.panningModel = "equalpower"; p.distanceModel = "inverse"; p.refDistance = 1; p.rolloffFactor = 1.1;
    p.positionX.value = o.pos.x; p.positionY.value = o.pos.y; p.positionZ.value = o.pos.z; g.connect(p); out = p;
  }
  out.connect(MASTER); src.connect(g); src.start();
  return { name, secs: buf.duration, stop() { try { src.stop(); } catch (e) { } } };
}
export async function playStorySound(story, id, o) {
  const s = ((story && story.sounds) || {})[id], n = s && shelfName(s.file);
  return n ? !!(await playShelf(n, o)) : false;
}
export async function preview(name) { if (PREVIEW) PREVIEW.stop(); PREVIEW = name ? await playShelf(name) : null; return PREVIEW; }

// The shelf in a dialog: a search box, the categories as chips, a row a sound (its tags, length, loop); a click picks
// it and plays it, OK keeps it.
export async function pickShelf(current) {
  const all = await shelf(), names = Object.keys(all);
  if (!names.length) { await modal({ title: "The sound shelf", body: h("p", {}, "The shelf is empty: python tools/sfx.py fetch"), cancel: null }); return null; }
  let pick = current && all[current] ? current : null, cat = "";
  const q = h("input", { class: "sfx-q", placeholder: "Search: door, creak, breath, knock…" }), chips = h("div", { class: "sfx-cats" }), list = h("div", { class: "sfx-list" });
  const cats = [...new Set(names.map(n => all[n].category))].sort();
  const drawChips = () => { chips.innerHTML = ""; for (const c of ["", ...cats]) chips.append(h("button", { class: "sfx-chip" + (c === cat ? " on" : ""), type: "button", on: { click: () => { cat = c; drawChips(); fill(); } } }, c || "all")); };
  const fill = () => {
    list.innerHTML = ""; const w = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    for (const n of names) {
      const s = all[n], hay = [n, s.category, ...s.tags].join(" ").toLowerCase();
      if ((cat && s.category !== cat) || !w.every(x => hay.includes(x))) continue;
      list.append(h("div", { class: "sfx-row" + (n === pick ? " on" : ""), title: s.credit, on: { click: e => { pick = n; list.querySelectorAll(".on").forEach(x => x.classList.remove("on")); e.currentTarget.classList.add("on"); preview(n); } } },
        icon("play", 13), h("b", {}, n), h("span", { class: "sfx-t" }, s.tags.join(", ")), h("span", { class: "sfx-s" }, (s.loop ? "loop · " : "") + s.secs.toFixed(1) + " s")));
    }
    if (!list.children.length) list.append(h("p", { class: "muted" }, "Nothing on the shelf called that."));
  };
  q.addEventListener("input", fill); drawChips(); fill();
  const ok = await modal({ title: "A sound off the shelf", wide: true, body: h("div", { class: "sfx-pick" }, h("p", { class: "hint" }, "CC0 sound effects in Content/Studio/SFX (tools/sfx.py). Click one to hear it."), q, chips, list), ok: "Use it" });
  preview(null);
  return ok ? pick : null;
}

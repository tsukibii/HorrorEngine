// The Face page (tools/facecap/serve.py; docs/GODOT_ANIMATION_PLAN.md §3b): the desk's own Expressions panel
// (tools/director/expressions.js: Import a video of a face, the preview beside a character in sync, neutral, strength,
// length, a loop cut from a range, Accept, rename, remove) on a page of its own, its characters made here without the
// desk's stage (the default MHR, or a Character Studio export: tools/director/bodies.js), and For Godot: the library's
// faces ticked and baked into a Godot project's faces/ (the server runs tools/face_export.mjs), what the project has
// already marked. The project comes from ?project= (the Director's Animate tab opens the page with it), the server's
// --project, or the last one used.
import { ExpressionsPanel } from "./expressions.js";
import { BodyFigure, loadBody } from "./bodies.js";
import * as M from "./motion.js";
import { toast } from "./ui.js";
import { wearEye } from "../shared/eye.js";

const $ = s => document.querySelector(s);
const h = (t, a = {}, ...k) => {
  const e = document.createElement(t);
  for (const [n, v] of Object.entries(a)) {
    if (n === "on") for (const [ev, f] of Object.entries(v)) e.addEventListener(ev, f);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(n, v === true ? "" : v);
  }
  for (const c of k.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const keep = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { } return null; };
const api = async (url, o) => { const r = await fetch(url, o), j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; };
const status = t => { $("#fcStatus").textContent = t; };

// what the panel's previews need of a stage: the pose library, the bodies loaded, and a figure made from one (as the
// desk's stage.js makeFigure, without its capsules: no body, no figure)
const stage = {
  lib: null, bodies: {}, defaultBody: null,
  makeFigure(c, color) {
    const file = c.previs_body || this.defaultBody, tpl = file && file !== "capsules" ? this.bodies[file] : null;
    if (!tpl || !this.lib) return null;
    const studio = !!(tpl.userData && tpl.userData.studio);   // a Character Studio character: its own look and its eyes
    const f = new BodyFigure(this.lib, +(c.height || 1.7), tpl, { color, shape: studio ? null : c.shape, keepMaterials: studio });
    if (!f.ok) { console.warn("body file: bones not found:", f.missing.join(", ")); return null; }
    if (studio) f.model.traverse(o => { if (o.isMesh) wearEye(o); });
    f.file = file;
    return f;
  },
};
async function ensureBody(f) {                         // a body loaded on demand (a Studio export picked in "shown on")
  if (!f || f === "capsules" || stage.bodies[f]) return;
  const tpl = await loadBody("/bodies/" + f.split("/").map(encodeURIComponent).join("/"));
  if (f.startsWith("people/")) tpl.userData = { studio: f.slice(7) };
  stage.bodies[f] = tpl;
}

// For Godot: the project, its faces/ now, the library ticked, Send
class ForGodot {
  constructor(root) { this.root = root; this.project = ""; this.recent = []; this.list = []; this.there = new Map(); this.picked = new Set(); this.ok = false; this.why = ""; this.out = null; }
  async init() {
    let r = { projects: [], start: "" };
    try { r = await api("/api/godot/projects"); } catch (e) { }
    this.recent = r.projects || [];
    this.project = new URLSearchParams(location.search).get("project") || r.start || keep("fc.project") || this.recent[0] || "";
  }
  async refresh() {
    try { this.list = (await api("/api/expressions")).expressions; } catch (e) { this.list = []; }
    for (const id of [...this.picked]) if (!this.list.some(x => x.id === id)) this.picked.delete(id);
    await this.look();
    this.render();
  }
  async look() {                                       // the project's faces/ as it is now
    this.there.clear(); this.ok = false; this.why = "";
    try {
      const r = await api("/api/godot/faces?project=" + encodeURIComponent(this.project));
      this.ok = !!r.ok; this.why = r.why || "";
      for (const f of r.faces || []) this.there.set(f.id, f);
    } catch (e) { this.why = e.message; }
  }
  render() {
    const r = this.root;
    r.replaceChildren(h("h2", {}, "For Godot"));
    const inp = h("input", { type: "text", id: "fcProject", list: "fcRecent", value: this.project, placeholder: "~/Games/MyGame", spellcheck: "false",
      on: { change: async e => { this.project = e.target.value.trim(); keep("fc.project", this.project); this.out = null; await this.look(); this.render(); } } });
    r.append(h("label", { class: "kv", for: "fcProject" }, "The Godot project (its folder, with project.godot)"), inp,
      h("datalist", { id: "fcRecent" }, this.recent.map(p => h("option", { value: p }))),
      h("div", { class: "fc-state " + (this.ok ? "ok" : "bad"), id: "fcState" }, this.ok ? `a Godot project: ${this.there.size} face clip${this.there.size === 1 ? "" : "s"} in its faces/` : this.why));
    const rows = h("div", { class: "fc-list", id: "fcList" });
    for (const x of this.list) {
      const there = this.there.get(x.id);
      const cb = h("input", { type: "checkbox", "data-id": x.id, checked: this.picked.has(x.id) || null,
        on: { change: e => { if (e.target.checked) this.picked.add(x.id); else this.picked.delete(x.id); this.render(); } } });
      rows.append(h("label", { class: "fc-row", title: `${x.name}${x.loop ? " (a loop)" : ""} · ${(+x.secs || 0).toFixed(1)} s` }, cb,
        h("span", { class: "fc-nm" }, x.loop ? "↻ " : "", x.name), there ? h("span", { class: "fc-in", title: "already in the project" }, there.loop ? "✓ faces/loops/" : "✓ faces/") : null));
    }
    if (!this.list.length) rows.append(h("div", { class: "muted", style: "padding:6px" }, "No expressions yet: Import a video of a face."));
    const n = this.picked.size;
    r.append(h("div", { class: "fc-bar" }, h("span", { class: "kv" }, "Tick the faces to send"),
      h("button", { class: "small", on: { click: () => { this.picked = new Set(this.list.map(x => x.id)); this.render(); } } }, "All"),
      h("button", { class: "small", on: { click: () => { this.picked.clear(); this.render(); } } }, "None")),
      rows,
      h("button", { class: "primary", id: "fcSend", disabled: !this.ok || !n || null, on: { click: () => this.send() } }, n ? `Send ${n} to the project` : "Send to the project"),
      ...(this.out ? [this.out] : []),
      h("p", { class: "kv" }, "Each face becomes a clip in the project's faces/ (a loop in faces/loops/): a card on the Director's Animate tab, Face side, for a character's resting face, a line's face or a state's. Sent again, it's made again."));
  }
  async send() {
    const ids = this.list.map(x => x.id).filter(id => this.picked.has(id));
    try {
      const r = await api("/api/godot/faces", { method: "POST", body: JSON.stringify({ project: this.project, ids }) });
      this.out = h("div", { class: "fc-out", id: "fcOut" }, r.sent.join("\n"));
      this.recent = [r.project, ...this.recent.filter(p => p !== r.project)];
      this.there.clear(); for (const f of r.faces || []) this.there.set(f.id, f);
      keep("fc.project", this.project);
      toast(`${ids.length} face clip${ids.length === 1 ? "" : "s"} in ${r.project}`);
    } catch (e) { this.out = h("div", { class: "fc-out bad", id: "fcOut" }, e.message); }
    this.render();
  }
}

async function boot() {
  status("loading the body…");
  try { stage.lib = M.loadLibrary(await api("/api/poses")); } catch (e) { status("no pose library: " + e.message); }
  try { BodyFigure.soma = await api("/api/soma"); } catch (e) { }
  let bodies = [];
  try { bodies = (await api("/api/bodies")).bodies; } catch (e) { }
  stage.defaultBody = bodies.find(f => /^default\./i.test(f)) || bodies.find(f => !/_hi\./i.test(f) && !f.startsWith("people/")) || null;   // MHR_hi is for exports
  try { await ensureBody(stage.defaultBody); status(""); } catch (e) { status("couldn't load " + stage.defaultBody + ": " + e.message); }
  const G = new ForGodot($("#godot"));
  await G.init();
  const XP = new ExpressionsPanel($("#exprPanel"), { stage: () => stage, story: () => ({}), ensureBody, M, bodies: async () => (await api("/api/bodies")).bodies,
    changed: () => G.refresh(),                        // the library changed (an import, a loop, a rename): the list again
    hint: "Each card is the character at the expression's strongest moment; hover plays it through. Click one to preview it, rename or retune it, or cut a loop from it. Stored in Content/Studio/Expressions (the desk's Expressions tab shows the same library); For Godot sends them to a project." });
  window.__fc = { XP, G, stage };
  await XP.refresh();
}
boot();

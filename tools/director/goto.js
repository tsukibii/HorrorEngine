// Go to anything (Ctrl+K): one search box over the whole game: its cards, every line by its words, the beats, the
// Database's entries, the flags and counters, and the desk's own actions (Playtest, Save, Check...). Type, arrow keys,
// Enter goes there.
//   openGoto(D): D is the desk (app.js): story(), name, title(id), go* to open each kind of place, actions()
import { h } from "./ui.js";
import { icon } from "./icons.js";
import { triggerText, actionText } from "./commands.js";

const KIND_ICON = { scene: "film", stitch: "task", choice: "choice", ending: "ending", line: "say", beat: "clock", cast: "person", item: "item", note: "note",
  sound: "sound", motion: "motion", secret: "eye", flag: "flag", counter: "count", interrupt: "trick", action: "play", act: "box" };
function index(D) {
  const S = D.story(), out = [], add = (kind, label, sub, go, extra = "") => out.push({ kind, label: String(label || ""), sub, go, hay: (label + " " + sub + " " + extra).toLowerCase() });
  for (const a of D.actions()) add("action", a.label, a.hint || "the desk", a.on, a.keys || "");
  const nodeOf = (type, ref) => Object.keys(S.flow).find(k => S.flow[k].type === type && S.flow[k].ref === ref);
  for (const [id, n] of Object.entries(S.flow || {})) add(n.type, D.title(id), `${n.type === "stitch" ? "task" : n.type} · ${id}`, () => D.goNode(id));
  for (const f of S.frames || []) add("act", f.title || f.id, `act · ${(f.nodes || []).length} cards`, () => D.goNode((f.nodes || [])[0]));
  for (const [sid, sc] of Object.entries(S.scenes || {})) {
    const node = nodeOf("scene", sid), vers = sc.variants ? Object.entries(sc.variants) : [[null, sc]];
    for (const [k, v] of vers) for (const c of v.clips || []) {
      const who = c.who === "player" ? "you" : ((S.cast || {})[c.who] || {}).name || c.who || "?";
      add("line", `${who}: ${c.en || c.ja || "(no words yet)"}`, `scene “${sc.title || sid}”${k ? " (" + k + ")" : ""} · ${c.id}`, () => D.goClip(node, sid, k, c.id), c.ja || "");
    }
  }
  for (const [tid, st] of Object.entries(S.stitches || {})) {
    const node = nodeOf("stitch", tid);
    for (const b of st.beats || []) add("beat", "When " + triggerText(b.when, D.name), `task “${st.title || tid}” · ${b.id}`, () => D.goBeat(node, tid, b.id),
      (b.do || []).map(a => { try { return actionText(a, D.name); } catch (e) { return ""; } }).join(" "));   // found by what it does too
  }
  const db = [["cast", "cast", c => c.name], ["items", "item", x => x.name], ["notes", "note", x => x.title], ["sounds", "sound", x => x.file], ["lines", "line", x => x.en || x.ja], ["motions", "motion", x => x.prompt], ["secrets", "secret", x => x.hint]];
  for (const [tab, kind, label] of db) for (const [id, e] of Object.entries(S[tab] || {})) add(kind, label(e) || id, `Database · ${kind} · ${id}`, () => D.goDb(tab, id), id);
  for (const f of D.flags()) add("flag", f, "Database · flag", () => D.goDb("state", "flag:" + f));
  for (const [id, c] of Object.entries((S.game || {}).counters || {})) add("counter", c.label || id, `Database · counter · ${id}`, () => D.goDb("state", "counter:" + id), id);
  (S.interrupts || []).forEach((it, i) => add("interrupt", it.label || it.id, `Database · trigger cutscene · ${it.id || i}`, () => D.goDb("interrupts", it.id || String(i))));
  return out;
}
function score(e, words) {
  let s = 0;
  for (const w of words) { const i = e.hay.indexOf(w); if (i < 0) return -1; s += i === 0 ? 3 : e.hay[i - 1] === " " || e.hay[i - 1] === "_" ? 2 : 1; }
  const l = e.label.toLowerCase(); if (l.startsWith(words[0])) s += 3; if (l === words.join(" ")) s += 5;
  return s + ({ action: 0.5, scene: 1, stitch: 1, choice: 0.6, ending: 0.6, act: 0.8 }[e.kind] || 0);
}
export function openGoto(D) {
  document.querySelectorAll(".goto-back").forEach(x => x.remove());
  const all = index(D), input = h("input", { class: "goto-in", placeholder: "Go to a card, a line, a beat, a flag, an item… or Playtest, Save, Check" }), list = h("div", { class: "goto-list" });
  const back = h("div", { class: "goto-back mdl-back", on: { mousedown: e => { if (e.target === back) close(); } } }, h("div", { class: "goto mdl" }, h("div", { class: "goto-h" }, icon("search", 16), input, h("kbd", {}, "Esc")), list));
  let shown = [], at = 0;
  const close = () => { back.remove(); document.removeEventListener("keydown", keys, true); };
  const draw = () => {
    const q = input.value.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean);
    shown = (words.length ? all.map(e => [e, score(e, words)]).filter(([, s]) => s >= 0).sort((a, b) => b[1] - a[1]).map(([e]) => e) : all.filter(e => e.kind === "action" || ["scene", "stitch"].includes(e.kind))).slice(0, 60);
    at = Math.min(at, Math.max(0, shown.length - 1)); list.innerHTML = "";
    shown.forEach((e, i) => list.append(h("div", { class: "goto-i" + (i === at ? " on" : ""), on: { mousemove: () => { if (at !== i) { at = i; mark(); } }, click: () => pick(i) } },
      h("span", { class: "goto-ic k-" + e.kind }, icon(KIND_ICON[e.kind] || "box", 14)), h("span", { class: "goto-t" }, h("span", {}, e.label), h("span", { class: "goto-s" }, e.sub)))));
    if (!shown.length) list.append(h("div", { class: "goto-none" }, "Nothing called that."));
  };
  const mark = () => [...list.children].forEach((x, i) => x.classList.toggle("on", i === at));
  const pick = i => { const e = shown[i]; if (!e) return; close(); e.go(); };
  const keys = e => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); at = Math.max(0, Math.min(shown.length - 1, at + (e.key === "ArrowDown" ? 1 : -1))); mark(); const r = list.children[at]; if (r) r.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); pick(at); }
  };
  input.addEventListener("input", () => { at = 0; draw(); });
  document.addEventListener("keydown", keys, true);
  document.body.append(back); draw(); input.focus();                 // at once: what's typed straight after Ctrl+K lands here
}

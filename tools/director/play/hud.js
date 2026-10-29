// The Play HUD (GAMEPLAY_PLAN §4, §10). Plain HTML; every colour, radius and shadow comes from the theme
// (play/ui/themes/<name>.css), so a game can switch themes. Four places, one rule each (play/ui/hud.css says how):
// on the thing (the reticle, and the prompt floating where you'd put your hand), the corners (the game talking:
// objective, timer, log, stance), the footer (people talking; a choice's answers under its question, at the bottom centre), the middle (a card held up to read).
// And what you carry: the inventory's row at the bottom centre when nobody's talking (inventory.js).
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const key = k => mk("span", "ph-key", k);
// the left mouse button, as a key chip (a click uses everything: DECISIONS 2026-10-27, later)
export const MOUSE = '<svg viewBox="0 0 12 16" width="10" height="14" aria-hidden="true"><rect x="1" y="1" width="10" height="14" rx="5" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
  '<path d="M6 1v5.4M1.3 6.4h9.4" stroke="currentColor" stroke-width="1.1" fill="none"/><path d="M6 1.7A4.3 4.3 0 0 0 1.7 6H6z" fill="currentColor"/></svg>';
export const mouseKey = () => { const e = mk("span", "ph-key ph-mouse"); e.innerHTML = MOUSE; e.title = "left click"; return e; };
const FOCUS_MS = 350;                               // a glance doesn't pull focus, a held look does
import { typedAt, glitched } from "./typing.js";
import { applySettings } from "./menu.js";
import { slot, SHOWN } from "./inventory.js";

export function loadTheme(name) {
  let l = document.getElementById("playTheme");
  if (!l) { l = mk("link"); l.id = "playTheme"; l.rel = "stylesheet"; document.head.append(l); }
  l.href = new URL(`./ui/themes/${name}.css`, import.meta.url).href;
}

// the player's name (STORY_FORMAT §4 `name`): {name} in anything shown is it. A run starts it from game.player_name
let NAME = "Alex";
export const DEFAULT_NAME = "Alex";
export function setName(n, reset) { const v = String(n || "").trim(); if (v || reset) NAME = v || DEFAULT_NAME; return NAME; }
export const playerName = () => NAME;
// and the game's own words (STORY_FORMAT §9.14, game.words: {her} by the run's flags and counters), when the desk says how
let WORD = () => null;
export function setWords(fn) { WORD = fn || (() => null); }
export const named = t => typeof t === "string" ? t.replace(/\{name\}/g, NAME).replace(/\{([a-z][a-z0-9_]*)\}/g, (m, w) => { const v = WORD(w); return v === null || v === undefined ? m : v; }) : t;

// a spoken or written line into a footer line: the speaker above, then the words (`think`: the player's own thought,
// set apart). English only: no Japanese over it (DECISIONS 2026-10-27, notes: other languages come from a system that
// changes the whole dialogue, and there's no Japanese audio). The Watch's scenes and Play's lines both paint with this,
// so a subtitle looks the same wherever it comes from
export function paintLine(el, text, who, think, glitch = 0) {
  el.replaceChildren(...(who ? [mk("span", "ph-who", named(who))] : []), mk("span", glitch ? "ph-glitch" : "", named(text) || ""));   // a name can be a word: {her}
  el.classList.toggle("on", !!text); el.classList.toggle("think", !!think);
}

export class Hud {
  constructor(box, theme = "plain") {
    loadTheme(theme);
    this.root = mk("div", "play-hud"); this.root.dataset.theme = theme;
    this.cursor = mk("div", "ph-cursor"); this.cursor.dataset.cursor = "none";
    this.prompt = mk("div", "ph-prompt"); this.shown = "";
    this.obj = mk("div", "ph-objective");
    this.todoEl = mk("div", "ph-todo"); this.tl = mk("div", "ph-tl"); this.tl.append(this.obj, this.todoEl);   // the objective, the to-do list under it
    this.footer = mk("div", "ph-footer");
    this.lineEl = mk("div", "ph-line"); this.footer.append(this.lineEl);
    this.logEl = mk("div", "ph-log");
    this.timerEl = mk("div", "ph-timer");
    this.hint = mk("div", "ph-hint");
    for (const [k, w] of [["Click", "to play"], ["W A S D", "walk"], ["Shift", "run"], [null, "use"], ["E", "inventory"], ["G", "put down"], ["C", "crouch"], ["Esc", "pause"]]) {
      const p = mk("span", "ph-pair"); p.append(k ? key(k) : mouseKey(), mk("span", "", w)); this.hint.append(p);
    }
    this.hint.lastChild.dataset.k = "Esc";
    this.invEl = mk("div", "ph-inv"); this.invRow = mk("div", "ph-inv-row"); this.invName = mk("div", "ph-inv-name"); this.invEl.append(this.invRow, this.invName);
    this.stance = mk("div", "ph-stance");
    this.boardEl = mk("div", "ph-board"); this.flashEl = mk("div", "ph-flash");     // a board game's score; a muzzle's flash
    this.seenEl = mk("div", "ph-seen ph-meter"); this.seenEl.append(mk("div"));
    this.focus = mk("div", "ph-focus");            // the camera's focus: the world softens round what you're about to use
    this.root.append(this.focus, this.tl, this.timerEl, this.boardEl, this.logEl, this.cursor, this.seenEl, this.prompt, this.invEl, this.footer, this.stance, this.hint, this.flashEl);
    box.append(this.root); applySettings(this.root);
    this.lineUntil = 0; this.panelEl = null; this.objTimer = 0;
  }
  remove() { this.root.remove(); }
  // what's under the reticle: its kind (the reticle opens into a ring; `locked` is red and has no key), the verb, the
  // thing's name, and `at` {x, y, flip, bare, fx, fy, clear} where the prompt floats (the HUD's pixels), or null: under
  // the reticle. `clear` (0..1, how near the reticle is to the point) sharpens the prompt; a look held FOCUS_MS pulls
  // the camera's focus onto the thing: the world softens round it (data-focus="thing", the hole at fx, fy). The key
  // chip is the mouse's left button: a click uses it
  setCursor(kind, label, at, name) {
    kind = kind || "none"; this.cursor.dataset.cursor = kind;
    const sig = `${kind}|${label}|${name || ""}`;
    if (sig !== this.shown) {
      this.shown = sig; this.prompt.dataset.cursor = kind;
      const words = mk("span", "ph-words"); words.append(mk("span", "ph-label", label || "")); if (name) words.append(mk("span", "ph-name", name));
      this.prompt.replaceChildren(...(label ? [mk("span", "ph-mark"), ...(kind === "locked" ? [] : [mouseKey()]), words] : []));
    }
    this.prompt.classList.toggle("on", !!label);
    this.prompt.classList.toggle("at", !!at); this.prompt.classList.toggle("flip", !!(at && at.flip)); this.prompt.classList.toggle("bare", !!(at && at.bare));
    this.prompt.style.left = at ? at.x + "px" : ""; this.prompt.style.top = at ? at.y + "px" : "";
    this.prompt.style.setProperty("--ph-clear", at && at.clear !== undefined ? at.clear.toFixed(2) : 1);
    const now = performance.now(); if (!label) this.focusSince = 0; else if (!this.focusSince || sig !== this.focusSig) { this.focusSince = now; this.focusSig = sig; }
    const held = !!label && now - this.focusSince > FOCUS_MS;
    this.root.dataset.focus = held ? "thing" : "";
    if (held) { this.root.style.setProperty("--fx", (at ? at.fx ?? at.x : this.root.clientWidth / 2) + "px"); this.root.style.setProperty("--fy", (at ? at.fy ?? at.y : this.root.clientHeight / 2) + "px"); }
  }
  objective(text) {                                  // a new one says so, then rests dimmer
    if (text && text !== this.obj.textContent) { this.obj.classList.add("fresh"); clearTimeout(this.objTimer); this.objTimer = setTimeout(() => this.obj.classList.remove("fresh"), 4000); }
    this.obj.textContent = named(text) || ""; this.obj.classList.toggle("on", !!text);
  }
  // the to-do list under the objective: [{id, text, state: open | done | failed, who: the asker's name or null, left: seconds or null}]; a ticked task
  // dims with its box ticked, a failed one is struck in the bad colour; `fresh`: something changed, the list says so
  todo(items, fresh) {
    this.todoEl.replaceChildren(...items.map(t => {
      const e = mk("div", "ph-task"); e.dataset.state = t.state; e.dataset.id = t.id;
      e.append(mk("span", "ph-box", t.state === "done" ? "✓" : t.state === "failed" ? "✕" : ""), mk("span", "ph-task-text", named(t.text)));
      if (t.who) e.append(mk("span", "ph-task-who", named(t.who)));     // a request: who asked (a name can be a word)
      if (t.left !== null && t.left !== undefined) e.append(mk("span", "ph-task-left", Math.ceil(t.left) + "s"));
      return e;
    }));
    this.todoEl.classList.toggle("on", items.length > 0);
    if (fresh && items.length) { this.todoEl.classList.add("fresh"); clearTimeout(this.todoTimer); this.todoTimer = setTimeout(() => this.todoEl.classList.remove("fresh"), 3000); }
  }
  // a chapter's title card, held up in the middle over the dark ("Night 2", its sub under it: "23:40"); resolves when gone
  chapter(title, sub, secs) {
    const c = mk("div", "ph-chapter"); c.append(mk("div", "ph-chapter-t", title || ""), ...(sub ? [mk("div", "ph-chapter-s", sub)] : []));
    this.root.append(c); this.root.classList.add("chapter"); void c.offsetWidth; c.classList.add("on");   // the rest of the HUD steps back
    return new Promise(done => setTimeout(() => { c.classList.remove("on"); this.root.classList.remove("chapter"); setTimeout(() => { c.remove(); done(); }, 700); }, 700 + secs * 1000));
  }
  // a line for secs; a thought that types itself out (`how`: breaks, retype; typing.js) redrawn as it types, till
  // another line comes or its time is up
  line(text, who, secs, think, how) {
    cancelAnimationFrame(this.typing || 0); this.typing = 0; this.lineUntil = performance.now() + secs * 1000;
    if (!how || !(how.retype || how.breaks)) return paintLine(this.lineEl, text, who, think);
    const t0 = performance.now(), words = named(text), again = how.retype ? named(how.retype) : null, until = this.lineUntil;
    const step = () => {
      if (performance.now() > until) return;
      const u = (performance.now() - t0) / 1000, s = typedAt(words, { retype: again, breaks: how.breaks }, u);
      paintLine(this.lineEl, s.glitch ? glitched(s.shown, s.glitch, Math.floor(u * 20)) : s.shown, who, think, s.glitch);
      this.typing = s.done ? 0 : requestAnimationFrame(step);
    };
    step();
  }
  log(text) {
    const e = mk("div", "", text); this.logEl.append(e);
    setTimeout(() => e.remove(), 5000);
    while (this.logEl.children.length > 5) this.logEl.firstChild.remove();
  }
  timer(secs) { this.timerEl.textContent = secs === null ? "" : Math.max(0, secs).toFixed(1); }
  board(text) { this.boardEl.textContent = text || ""; }   // a board game's score at the top (null clears it)
  flash() { const e = this.flashEl; e.classList.remove("on"); void e.offsetWidth; e.classList.add("on"); }
  // the inventory's row (play/inventory.js): `list` [{id, name, icon}], `at` the one in the hand, in the middle; the
  // rest either side round the wheel (inventory.slot), at most SHOWN, the farther ones smaller and fainter; its name
  // under it. `shown`: E's choice; `peek`: hidden, it shows for a moment because something changed. Each thing keeps
  // its element, so the row slides as the wheel turns (one coming round the back of the wheel doesn't slide across)
  inventory(list, at, shown, peek, lowered = false) {
    const n = list.length, had = new Map([...this.invRow.children].map(c => [c.dataset.id, c]));
    this.invRow.classList.toggle("lowered", !!lowered);         // the one in the hand lowered (Q): its slot dim
    list.forEach((t, i) => {
      let c = had.get(t.id); had.delete(t.id);
      const d = slot(i, at, n), was = c ? +c.dataset.d : null;
      if (!c) {
        c = mk("div", "ph-inv-i"); c.dataset.id = t.id;
        const img = mk("img"); img.alt = t.name; img.draggable = false; if (t.icon) img.src = t.icon; else img.classList.add("none");
        c.append(img); this.invRow.append(c);
      }
      const jump = was === null || Math.abs(d - was) > 1;
      c.classList.toggle("jump", jump); if (jump) void c.offsetWidth;
      c.dataset.d = d; c.style.setProperty("--d", d); c.style.setProperty("--ad", Math.min(Math.abs(d), 3));
      c.classList.toggle("far", Math.abs(d) > (SHOWN - 1) / 2); c.classList.toggle("held", d === 0);
      if (jump) requestAnimationFrame(() => c.classList.remove("jump"));
    });
    for (const c of had.values()) c.remove();      // put down
    this.invName.textContent = list[at] ? named(list[at].name) : "";
    this.invEl.classList.toggle("on", n > 0 && shown);
    clearTimeout(this.invT);
    if (peek && n > 0 && !shown) { this.invEl.classList.add("peek"); this.invT = setTimeout(() => this.invEl.classList.remove("peek"), 1800); }
    else this.invEl.classList.remove("peek");
  }
  seen(k) {                                         // the suspicion meter: 0 hidden, 1 caught
    this.seenEl.classList.toggle("on", k > 0.01);
    this.seenEl.firstChild.style.width = Math.round(Math.min(1, k) * 100) + "%";
  }
  setStance(s) { this.stance.textContent = s; this.root.dataset.stance = s; }
  locked(on) { this.hint.classList.toggle("on", !on && !this.panelEl); this.root.classList.toggle("free", !on); }
  // the eye at a peephole: the view through a round hole in the dark, the rest of the HUD away
  peep(on) { this.root.classList.toggle("peep", !!on); }
  // a held use's progress (scrubbing: 0..1) as a ring round the reticle; null takes it away
  progress(p) { this.cursor.classList.toggle("progress", p !== null && p !== undefined); if (p !== null && p !== undefined) this.cursor.style.setProperty("--ph-progress", p); }
  // a key the game adds to the hint (the flashlight's F once the player has one), before Esc; once
  hintKey(k, w) {
    if ([...this.hint.children].some(p => p.dataset.k === k)) return;
    const p = mk("span", "ph-pair"); p.dataset.k = k; p.append(key(k), mk("span", "", w));
    this.hint.insertBefore(p, [...this.hint.children].find(x => x.dataset.k === "Esc") || null);
  }
  press() {                                         // the reticle and the key press in when E is used
    for (const e of [this.cursor, this.prompt.querySelector(".ph-key")].filter(Boolean)) { e.classList.add("press"); setTimeout(() => e.classList.remove("press"), 160); }
  }
  modal(el) {                                       // a card or a choice is up: the world's marks step back
    this.panelEl = el; this.root.classList.toggle("modal", !!el); if (el) this.hint.classList.remove("on");
  }
  shake() { for (const e of [this.prompt, this.panelEl].filter(Boolean)) { e.classList.remove("shake"); void e.offsetWidth; e.classList.add("shake"); } }
  tick() {
    if (this.lineUntil && performance.now() > this.lineUntil) {
      this.lineEl.classList.remove("on"); this.lineUntil = 0;
      setTimeout(() => { if (!this.lineEl.classList.contains("on")) this.lineEl.replaceChildren(); }, 300);   // gone from the footer once faded
    }
  }

  // a panel: {title, text} to read, {title, code: n} for a code lock, or {title, name: the default} for the player's
  // name. Resolves with the code typed, true when a text is closed, the name typed (the default when it's left empty or
  // with Esc), or null when it's left (Esc, Close)
  // a thing taken up in the hands (play/examine.js): its name and words under it, a drag anywhere else turns it, Esc,
  // E or the button puts it back
  examine(spec) {
    return new Promise(done => {
      const p = mk("div", "ph-exam"), card = mk("div", "ph-card"), hint = mk("div", "ph-exam-hint", "drag to turn it");
      card.append(mk("div", "ph-title", named(spec.title) || ""));
      if (spec.text) card.append(mk("div", "ph-text", named(spec.text)));
      const back = mk("button", "ph-btn ph-close"); back.append(key("Esc"), mk("span", "", "Put it back (or click)"));
      card.append(back); p.append(hint, card);
      let drag = null, finish;
      p.onpointerdown = e => { if (e.target.closest(".ph-card")) return; drag = { x: e.clientX, y: e.clientY }; p.classList.add("turning"); try { p.setPointerCapture(e.pointerId); } catch (x) { } };
      p.onpointermove = e => { if (!drag) return; moved += Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y); spec.turn(e.clientX - drag.x, e.clientY - drag.y); drag = { x: e.clientX, y: e.clientY }; };
      let moved = 0;
      p.onpointerup = p.onpointercancel = e => { const was = drag; drag = null; p.classList.remove("turning"); if (was && moved < 4 && e.type === "pointerup") finish(); moved = 0; };   // a click (no drag) puts it back, like Esc
      const kd = e => { if (e.key === "Escape" || e.code === "KeyE") { e.preventDefault(); finish(); } };
      finish = () => { window.removeEventListener("keydown", kd, true); p.remove(); this.modal(null); done(true); };
      back.onclick = () => finish();
      window.addEventListener("keydown", kd, true);
      this.modal(p); this.root.append(p);
    });
  }
  panel(spec) {
    return new Promise(done => {
      const p = mk("div", "ph-panel"), card = mk("div", "ph-card");
      let finish;
      card.append(mk("div", "ph-title", named(spec.title) || ""));
      if (spec.name) {
        const inp = mk("input", "ph-name"); inp.type = "text"; inp.maxLength = 20; inp.placeholder = spec.name; inp.autocomplete = "off"; inp.spellcheck = false;
        const ok = mk("button", "ph-btn ph-ok"); ok.append(key("Enter"), mk("span", "", "OK")); ok.onclick = () => finish(inp.value.trim() || spec.name);
        card.append(inp, ok); p.append(card);
        const kd = e => { if (e.key === "Enter") { e.preventDefault(); finish(inp.value.trim() || spec.name); } else if (e.key === "Escape") { e.preventDefault(); finish(spec.name); } else e.stopPropagation(); };
        finish = v => { window.removeEventListener("keydown", kd, true); p.remove(); this.modal(null); done(v); };
        window.addEventListener("keydown", kd, true);
        this.modal(p); this.root.append(p); setTimeout(() => inp.focus(), 30);
        return;
      }
      if (spec.code) {
        let typed = "";
        const shown = mk("div", "ph-code", "·".repeat(spec.code)), pad = mk("div", "ph-pad");
        const show = () => { shown.textContent = typed.padEnd(spec.code, "·"); };
        const press = k => { if (k === "⌫") typed = typed.slice(0, -1); else if (k === "OK") return finish(typed); else if (typed.length < spec.code) typed += k; show(); };
        for (const k of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"]) { const b = mk("button", "ph-btn", k); b.onclick = () => press(k); pad.append(b); }
        card.append(shown, pad);
        p.keys = e => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === "Backspace") press("⌫"); else if (e.key === "Enter") press("OK"); };
      } else card.append(mk("div", "ph-text", named(spec.text) || ""));
      const close = mk("button", "ph-btn ph-close"); close.append(key("Esc"), mk("span", "", spec.name || spec.code ? "Close" : "Close (or click)")); close.onclick = () => finish(spec.code ? null : true);
      card.append(close); p.append(card);
      if (!spec.name && !spec.code) p.onclick = e => { if (!e.target.closest("button")) finish(true); };   // a card of words: a click anywhere puts it away, like Esc
      const kd = e => { if (e.key === "Escape") { e.preventDefault(); finish(null); } else if (p.keys) p.keys(e); };
      finish = v => { window.removeEventListener("keydown", kd, true); p.remove(); this.modal(null); done(v); };
      window.addEventListener("keydown", kd, true);
      this.modal(p); this.root.append(p);
    });
  }

  // a multiple choice (the story's `ask`): the question is the footer's line (who asks it above), the
  // options right under it at the bottom centre (see `docked`), `secs` times it (`def`, an index, when it runs out); the
  // camera's focus holds on whoever asks (spec.anchor() each frame, {x, y, fx, fy, speaker}) or the thing it's about;
  // resolves with the index picked
  choose(spec) {
    return new Promise(done => {
      const c = chooser(Object.assign({ timed: !!spec.secs }, spec), i => finish(i)), kd = c.keys, f = docked(this.root, c, spec.anchor);
      if (spec.prompt) { paintLine(this.lineEl, spec.prompt, spec.who); this.lineUntil = 0; }
      let over = false, t0 = performance.now();
      const tick = () => { if (over) return; const u = (performance.now() - t0) / 1000 / spec.secs; c.bar(1 - u); if (u >= 1) return finish(spec.def ?? 0); requestAnimationFrame(tick); };
      if (spec.secs) requestAnimationFrame(tick);                                   // timed: `def` when it runs out
      const finish = v => { if (over) return; over = true; window.removeEventListener("keydown", kd, true); f.remove(); this.modal(null); if (spec.prompt) this.lineEl.classList.remove("on"); done(v); };
      window.addEventListener("keydown", kd, true);
      this.modal(c.el);
    });
  }
}

// A choice's panel docked at the bottom centre of a `.play-hud` root, in its footer under the line (DECISIONS
// 2026-10-27, notes: the lines are text now, so the question reads straight on into its answers). `anchor()` (or null:
// nobody, nothing) is asked every frame for the camera's focus: it holds on whoever asks, or the thing it's about,
// while the choice is up (data-focus, --fx/--fy). Returns {el, remove()}
export function docked(root, c, anchor) {
  const foot = root.querySelector(".ph-footer") || root, wrap = mk("div", "ph-dock"); wrap.append(c.el); foot.append(wrap);
  let raf = 0;
  const focus = () => {
    const at = (anchor && anchor()) || null;
    root.dataset.focus = !at ? "centre" : at.speaker ? "speaker" : "thing";
    if (at) { root.style.setProperty("--fx", (at.fx ?? at.x) + "px"); root.style.setProperty("--fy", (at.fy ?? at.y) + "px"); }
    raf = requestAnimationFrame(focus);
  };
  focus();
  return { el: wrap, remove: () => { cancelAnimationFrame(raf); wrap.remove(); root.dataset.focus = ""; } };
}
// beside a person: the shoulder on the side of the screen with more room, at shoulder height, the panel outward; the
// focus on their face. `f` a cast figure (the stage's previs Figure or a BodyFigure: both have headWorld and
// jointWorld), `cam` the camera; null when they're behind it
export function besideAt(cam, f, W, H) {
  const s = v => { const q = v.clone().project(cam); return q.z > 1 ? null : { x: (q.x + 1) / 2 * W, y: (1 - q.y) / 2 * H }; };
  const head = f.headWorld(), joint = n => f.jointWorld(n) || Object.assign(head.clone(), { y: head.y - 0.25 });
  const h = s(head), a = s(joint("upperarm_l")), b = s(joint("upperarm_r")); if (!h || !a || !b) return null;
  const right = h.x <= W / 2, sh = right ? (a.x > b.x ? a : b) : (a.x < b.x ? a : b);
  return { x: sh.x + (right ? 28 : -28), y: sh.y, flip: !right, fx: h.x, fy: h.y, speaker: true };
}

// The options of a multiple choice: ONE glass panel, side by side with a dash between each pair (equal columns, so
// the dashes stay centred), the one under the pointer (or the keys: A/D, arrows; 1-9 or Enter/Space picks) bright and
// the rest dimmed. spec {options: [text or {label, think}], timed}; `pick(i)` gets the index. Returns {el, keys, bar}:
// the panel (docked at the bottom centre, see `docked`; the pause menu's Quit keeps it in its own footer), the keydown handler,
// and the timer line (1 full, 0 out). The Play HUD and the desk's Watch (replies, timed choices) both use it.
export function chooser(spec, pick) {
  const box = mk("div", "ph-choice"), opts = [], row = mk("div", "ph-opts"), bar = mk("div", "ph-meter on"), fill = mk("div");
  let at = -1;
  const light = i => { at = i; opts.forEach((o, j) => o.classList.toggle("on", j === i)); box.classList.toggle("lit", i >= 0); };
  (spec.options || []).map(o => (typeof o === "string" ? { label: o } : o)).forEach((o, i) => {
    if (i) row.append(mk("span", "ph-dash"));
    const b = mk("button", "ph-opt" + (o.think ? " thought" : "")); b.append(mk("span", "", named(o.label)));
    if (o.think) b.append(mk("span", "ph-think", named(o.think)));        // the player's thought under the act (an answer's `think`)
    b.onmouseenter = () => light(i); b.onfocus = () => light(i); b.onclick = () => pick(i);
    opts.push(b); row.append(b);
  });
  row.onmouseleave = () => light(-1);
  bar.append(fill); box.append(row); if (spec.timed) box.append(bar);
  const n = opts.length;
  const keys = e => {
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") light(at < 0 ? n - 1 : (at + n - 1) % n);
    else if (k === "arrowright" || k === "d") light(at < 0 ? 0 : (at + 1) % n);
    else if (/^[1-9]$/.test(k) && +k <= n) pick(+k - 1);
    else if ((k === "enter" || k === " ") && at >= 0) pick(at); else return;
    e.preventDefault();
  };
  return { el: box, keys, bar: k => { fill.style.width = Math.max(0, Math.min(1, k)) * 100 + "%"; } };
}

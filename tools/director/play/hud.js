// The Play HUD (GAMEPLAY_PLAN §4, §10). Plain HTML; every colour, radius and shadow comes from the theme
// (play/ui/themes/<name>.css), so a game can switch themes. Four places, one rule each (play/ui/hud.css says how):
// on the thing (the reticle, and the prompt floating where you'd put your hand), the corners (the game talking:
// objective, timer, log, stance), the footer (people talking; choices float on the thing or beside who asks), the middle (a card held up to read).
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const key = k => mk("span", "ph-key", k);
const FOCUS_MS = 350;                               // a glance doesn't pull focus, a held look does
import { applySettings } from "./menu.js";

export function loadTheme(name) {
  let l = document.getElementById("playTheme");
  if (!l) { l = mk("link"); l.id = "playTheme"; l.rel = "stylesheet"; document.head.append(l); }
  l.href = new URL(`./ui/themes/${name}.css`, import.meta.url).href;
}

// a spoken or written line into a footer line: the speaker above, the Japanese small, then the words. The Watch's
// scenes and Play's lines both paint with this, so a subtitle looks the same wherever it comes from
export function paintLine(el, text, who, ja) {
  el.replaceChildren(...(who ? [mk("span", "ph-who", who)] : []), ...(ja ? [mk("span", "ph-ja", ja)] : []), mk("span", "", text || ""));
  el.classList.toggle("on", !!(text || ja));
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
    for (const [k, w] of [["Click", "look around"], ["W A S D", "walk"], ["E", "use"], ["C", "crouch"], ["Esc", "pause"]]) { const p = mk("span", "ph-pair"); p.append(key(k), mk("span", "", w)); this.hint.append(p); }
    this.stance = mk("div", "ph-stance");
    this.boardEl = mk("div", "ph-board"); this.flashEl = mk("div", "ph-flash");     // a board game's score; a muzzle's flash
    this.seenEl = mk("div", "ph-seen ph-meter"); this.seenEl.append(mk("div"));
    this.focus = mk("div", "ph-focus");            // the camera's focus: the world softens round what you're about to use
    this.root.append(this.focus, this.tl, this.timerEl, this.boardEl, this.logEl, this.cursor, this.seenEl, this.prompt, this.footer, this.stance, this.hint, this.flashEl);
    box.append(this.root); applySettings(this.root);
    this.lineUntil = 0; this.panelEl = null; this.objTimer = 0;
  }
  remove() { this.root.remove(); }
  // what's under the reticle: its kind (the reticle opens into a ring; `locked` is red and has no key), the verb, the
  // thing's name, and `at` {x, y, flip, bare, fx, fy, clear} where the prompt floats (the HUD's pixels), or null: under
  // the reticle. `clear` (0..1, how near the reticle is to the point) sharpens the prompt; a look held FOCUS_MS pulls
  // the camera's focus onto the thing: the world softens round it (data-focus="thing", the hole at fx, fy). `hold`: E
  // is held for it (picking up, putting down), the key says so and the ring fills while it's held (hold())
  setCursor(kind, label, at, name, hold) {
    kind = kind || "none"; this.cursor.dataset.cursor = kind;
    const sig = `${kind}|${label}|${name || ""}|${hold ? 1 : 0}`;
    if (sig !== this.shown) {
      this.shown = sig; this.prompt.dataset.cursor = kind;
      const words = mk("span", "ph-words"); words.append(mk("span", "ph-label", label || "")); if (name) words.append(mk("span", "ph-name", name));
      this.prompt.replaceChildren(...(label ? [mk("span", "ph-mark"), ...(kind === "locked" ? [] : [key(hold ? "Hold E" : "E")]), words] : []));
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
    this.obj.textContent = text || ""; this.obj.classList.toggle("on", !!text);
  }
  // the to-do list under the objective: [{id, text, state: open | done | failed, left: seconds or null}]; a ticked task
  // dims with its box ticked, a failed one is struck in the bad colour; `fresh`: something changed, the list says so
  todo(items, fresh) {
    this.todoEl.replaceChildren(...items.map(t => {
      const e = mk("div", "ph-task"); e.dataset.state = t.state; e.dataset.id = t.id;
      e.append(mk("span", "ph-box", t.state === "done" ? "✓" : t.state === "failed" ? "✕" : ""), mk("span", "ph-task-text", t.text));
      if (t.left !== null && t.left !== undefined) e.append(mk("span", "ph-task-left", Math.ceil(t.left) + "s"));
      return e;
    }));
    this.todoEl.classList.toggle("on", items.length > 0);
    if (fresh && items.length) { this.todoEl.classList.add("fresh"); clearTimeout(this.todoTimer); this.todoTimer = setTimeout(() => this.todoEl.classList.remove("fresh"), 3000); }
  }
  line(text, who, secs) { paintLine(this.lineEl, text, who); this.lineUntil = performance.now() + secs * 1000; }
  log(text) {
    const e = mk("div", "", text); this.logEl.append(e);
    setTimeout(() => e.remove(), 5000);
    while (this.logEl.children.length > 5) this.logEl.firstChild.remove();
  }
  timer(secs) { this.timerEl.textContent = secs === null ? "" : Math.max(0, secs).toFixed(1); }
  board(text) { this.boardEl.textContent = text || ""; }   // a board game's score at the top (null clears it)
  flash() { const e = this.flashEl; e.classList.remove("on"); void e.offsetWidth; e.classList.add("on"); }
  hold(k) {                                         // E held: the reticle's ring fills (0..1); null: let go
    this.root.classList.toggle("holding", k !== null && k !== undefined);
    this.cursor.style.setProperty("--ph-hold", Math.max(0, Math.min(1, k || 0)).toFixed(3));
  }
  seen(k) {                                         // the suspicion meter: 0 hidden, 1 caught
    this.seenEl.classList.toggle("on", k > 0.01);
    this.seenEl.firstChild.style.width = Math.round(Math.min(1, k) * 100) + "%";
  }
  setStance(s) { this.stance.textContent = s; this.root.dataset.stance = s; }
  locked(on) { this.hint.classList.toggle("on", !on && !this.panelEl); this.root.classList.toggle("free", !on); }
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

  // a panel: {title, text} to read, or {title, code: n} for a code lock. Resolves with the code typed, true when a
  // text is closed, or null when it's left (Esc, Close)
  panel(spec) {
    return new Promise(done => {
      const p = mk("div", "ph-panel"), card = mk("div", "ph-card");
      let finish;
      card.append(mk("div", "ph-title", spec.title || ""));
      if (spec.code) {
        let typed = "";
        const shown = mk("div", "ph-code", "·".repeat(spec.code)), pad = mk("div", "ph-pad");
        const show = () => { shown.textContent = typed.padEnd(spec.code, "·"); };
        const press = k => { if (k === "⌫") typed = typed.slice(0, -1); else if (k === "OK") return finish(typed); else if (typed.length < spec.code) typed += k; show(); };
        for (const k of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"]) { const b = mk("button", "ph-btn", k); b.onclick = () => press(k); pad.append(b); }
        card.append(shown, pad);
        p.keys = e => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === "Backspace") press("⌫"); else if (e.key === "Enter") press("OK"); };
      } else card.append(mk("div", "ph-text", spec.text || ""));
      const close = mk("button", "ph-btn ph-close"); close.append(key("Esc"), mk("span", "", "Close")); close.onclick = () => finish(spec.code ? null : true);
      card.append(close); p.append(card);
      const kd = e => { if (e.key === "Escape") { e.preventDefault(); finish(null); } else if (p.keys) p.keys(e); };
      finish = v => { window.removeEventListener("keydown", kd, true); p.remove(); this.modal(null); done(v); };
      window.addEventListener("keydown", kd, true);
      this.modal(p); this.root.append(p);
    });
  }

  // a multiple choice (the story's `ask`): the question is the footer's line (who asks it above, its Japanese `ja`, out
  // of the world), `secs` times it (`def`, an index, when it runs out), the options float in
  // the world (see `floating`): beside whoever asks (spec.anchor() each frame, {x, y, flip, fx, fy, speaker}), at the
  // thing it's about, or under the reticle; resolves with the index picked
  choose(spec) {
    return new Promise(done => {
      const c = chooser(Object.assign({ timed: !!spec.secs }, spec), i => finish(i)), kd = c.keys, f = floating(this.root, c, spec.anchor);
      if (spec.prompt) { paintLine(this.lineEl, spec.prompt, spec.who, spec.ja); this.lineUntil = 0; }
      let over = false, t0 = performance.now();
      const tick = () => { if (over) return; const u = (performance.now() - t0) / 1000 / spec.secs; c.bar(1 - u); if (u >= 1) return finish(spec.def ?? 0); requestAnimationFrame(tick); };
      if (spec.secs) requestAnimationFrame(tick);                                   // timed: `def` when it runs out
      const finish = v => { if (over) return; over = true; window.removeEventListener("keydown", kd, true); f.remove(); this.modal(null); if (spec.prompt) this.lineEl.classList.remove("on"); done(v); };
      window.addEventListener("keydown", kd, true);
      this.modal(c.el);
    });
  }
}

// A choice's panel floating in the world, in a `.play-hud` root: the mark on the point (a shoulder, a thing) and the
// panel beside it, kept on the screen and above the footer; `anchor()` (or null: under the middle of the view) is asked
// every frame, so it follows whoever it's beside. The camera's focus holds on them meanwhile (data-focus, --fx/--fy).
// Returns {el, remove()}
export function floating(root, c, anchor) {
  const wrap = mk("div", "ph-float"); wrap.append(mk("span", "ph-mark"), c.el); root.append(wrap);
  let raf = 0;
  const place = () => {
    const W = root.clientWidth, H = root.clientHeight, m = 40, w = wrap.offsetWidth, h = wrap.offsetHeight;
    const at = (anchor && anchor()) || null, centre = !at;
    wrap.classList.toggle("centre", centre); wrap.classList.toggle("flip", !!(at && at.flip));
    let x = centre ? W / 2 : at.x, y = centre ? H * 0.62 : at.y;
    if (!centre) x = at.flip ? Math.max(x, m + w) : Math.min(x, W - m - w);
    y = Math.max(m + h / 2, Math.min(H * 0.72 - h / 2, y));
    wrap.style.left = x + "px"; wrap.style.top = y + "px";
    root.dataset.focus = centre ? "centre" : at.speaker ? "speaker" : "thing";
    if (!centre) { root.style.setProperty("--fx", (at.fx ?? at.x) + "px"); root.style.setProperty("--fy", (at.fy ?? at.y) + "px"); }
    raf = requestAnimationFrame(place);
  };
  place();
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
// the rest dimmed. spec {options: [text or {label, sub}], timed}; `pick(i)` gets the index. Returns {el, keys, bar}:
// the panel (floating in the world, see `floating`; the pause menu's Quit keeps it in its footer), the keydown handler,
// and the timer line (1 full, 0 out). The Play HUD and the desk's Watch (replies, timed choices) both use it.
export function chooser(spec, pick) {
  const box = mk("div", "ph-choice"), opts = [], row = mk("div", "ph-opts"), bar = mk("div", "ph-meter on"), fill = mk("div");
  let at = -1;
  const light = i => { at = i; opts.forEach((o, j) => o.classList.toggle("on", j === i)); box.classList.toggle("lit", i >= 0); };
  (spec.options || []).map(o => (typeof o === "string" ? { label: o } : o)).forEach((o, i) => {
    if (i) row.append(mk("span", "ph-dash"));
    const b = mk("button", "ph-opt"); if (o.sub) b.append(mk("span", "ph-ja", o.sub)); b.append(mk("span", "", o.label));
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

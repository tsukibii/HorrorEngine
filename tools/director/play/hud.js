// The Play HUD (GAMEPLAY_PLAN §4, §10): the cursor that changes with what's under it, the prompt, the objective,
// thoughts and lines, a timer, panels (a note, a thing looked at, a code lock) with the free pointer. Plain HTML; every
// colour, radius and shadow comes from the theme (play/ui/themes/<name>.css), so a game can switch themes.
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

export function loadTheme(name) {
  let l = document.getElementById("playTheme");
  if (!l) { l = mk("link"); l.id = "playTheme"; l.rel = "stylesheet"; document.head.append(l); }
  l.href = new URL(`./ui/themes/${name}.css`, import.meta.url).href;
}

export class Hud {
  constructor(box, theme = "plain") {
    loadTheme(theme);
    this.root = mk("div", "play-hud"); this.root.dataset.theme = theme;
    this.cursor = mk("div", "ph-cursor"); this.cursor.dataset.cursor = "none";
    this.prompt = mk("div", "ph-prompt");
    this.obj = mk("div", "ph-objective");
    this.lineEl = mk("div", "ph-line");
    this.logEl = mk("div", "ph-log");
    this.timerEl = mk("div", "ph-timer");
    this.hint = mk("div", "ph-hint", "Click to look around · WASD walk · E use · C crouch · Esc frees the mouse");
    this.stance = mk("div", "ph-stance");
    this.seenEl = mk("div", "ph-seen"); this.seenEl.append(mk("div", "ph-seen-fill"));
    this.root.append(this.obj, this.timerEl, this.logEl, this.cursor, this.prompt, this.lineEl, this.stance, this.seenEl, this.hint);
    box.append(this.root);
    this.lineUntil = 0; this.panelEl = null;
  }
  remove() { this.root.remove(); }
  setCursor(kind, label) {
    this.cursor.dataset.cursor = kind || "none";
    this.prompt.replaceChildren(...(label ? [mk("span", "ph-key", "E"), mk("span", "ph-label", label)] : []));
    this.prompt.classList.toggle("on", !!label);
  }
  objective(text) { this.obj.textContent = text || ""; this.obj.classList.toggle("on", !!text); }
  line(text, who, secs) {
    this.lineEl.replaceChildren(...(who ? [mk("span", "ph-who", who)] : []), mk("span", "", text || ""));
    this.lineEl.classList.add("on"); this.lineUntil = performance.now() + secs * 1000;
  }
  log(text) {
    const e = mk("div", "", text); this.logEl.append(e);
    setTimeout(() => e.remove(), 5000);
    while (this.logEl.children.length > 6) this.logEl.firstChild.remove();
  }
  timer(secs) { this.timerEl.textContent = secs === null ? "" : Math.max(0, secs).toFixed(1); }
  seen(k) {                                         // the suspicion meter: 0 hidden, 1 caught
    this.seenEl.classList.toggle("on", k > 0.01);
    this.seenEl.firstChild.style.width = Math.round(Math.min(1, k) * 100) + "%";
  }
  setStance(s) { this.stance.textContent = s; this.root.dataset.stance = s; }
  locked(on) { this.hint.classList.toggle("on", !on && !this.panelEl); this.root.classList.toggle("free", !on); }
  press() {                                         // the cursor and the key press in when E is used
    for (const e of [this.cursor, this.prompt.querySelector(".ph-key")].filter(Boolean)) { e.classList.add("press"); setTimeout(() => e.classList.remove("press"), 160); }
  }
  shake() { for (const e of [this.cursor, this.panelEl].filter(Boolean)) { e.classList.remove("shake"); void e.offsetWidth; e.classList.add("shake"); } }
  tick() { if (this.lineUntil && performance.now() > this.lineUntil) { this.lineEl.classList.remove("on"); this.lineUntil = 0; } }

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
      const close = mk("button", "ph-btn ph-close", "Close"); close.onclick = () => finish(spec.code ? null : true);
      card.append(close); p.append(card);
      const kd = e => { if (e.key === "Escape") { e.preventDefault(); finish(null); } else if (p.keys) p.keys(e); };
      finish = v => { window.removeEventListener("keydown", kd, true); p.remove(); this.panelEl = null; done(v); };
      window.addEventListener("keydown", kd, true);
      this.panelEl = p; this.hint.classList.remove("on"); this.root.append(p);
    });
  }

  // a multiple choice (see `chooser`); resolves with the index picked
  choose(spec) {
    return new Promise(done => {
      const c = chooser(spec, i => finish(i)), kd = c.keys;
      const finish = v => { window.removeEventListener("keydown", kd, true); c.el.remove(); this.panelEl = null; done(v); };
      window.addEventListener("keydown", kd, true);
      this.panelEl = c.el; this.hint.classList.remove("on"); this.root.append(c.el);
    });
  }
}

// A multiple choice: ONE panel, the options side by side with a dash between each pair (always centred), the one under
// the pointer (or the keys: A/D, arrows, 1-9, Enter or Space takes the lit one) bright and the rest dimmed. spec
// {prompt, options: [text or {label, sub}]}; `pick(i)` is called with the index. Returns {el, keys, bar(0..1)}: the panel
// to put inside a `.play-hud[data-theme]`, the keydown handler, and a thin timer line under the options. The Play HUD
// and the desk's Watch (replies, timed choices) both use it, so a choice looks the same everywhere.
export function chooser(spec, pick) {
  const p = mk("div", "ph-panel ph-choose"), box = mk("div", "ph-choice"), opts = [], row = mk("div", "ph-opts"), bar = mk("div", "ph-bar", ""), fill = mk("div");
  let at = -1;
  const light = i => { at = i; opts.forEach((o, j) => o.classList.toggle("on", j === i)); box.classList.toggle("lit", i >= 0); };
  if (spec.prompt) box.append(mk("div", "ph-ask", spec.prompt));
  (spec.options || []).forEach((o, i) => {
    if (i) row.append(mk("span", "ph-dash"));
    const b = mk("button", "ph-opt"); if (o.sub) b.append(mk("span", "ph-sub", o.sub)); b.append(mk("span", "", typeof o === "string" ? o : o.label));
    b.onmouseenter = () => light(i); b.onfocus = () => light(i); b.onclick = () => pick(i);
    opts.push(b); row.append(b);
  });
  row.onmouseleave = () => light(-1);
  bar.append(fill); box.append(row); if (spec.timed) box.append(bar); p.append(box);
  const n = opts.length;
  const keys = e => {
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") light(at < 0 ? n - 1 : (at + n - 1) % n);
    else if (k === "arrowright" || k === "d") light(at < 0 ? 0 : (at + 1) % n);
    else if (/^[1-9]$/.test(k) && +k <= n) pick(+k - 1);
    else if ((k === "enter" || k === " ") && at >= 0) pick(at); else return;
    e.preventDefault();
  };
  return { el: p, keys, bar: k => { fill.style.width = Math.max(0, Math.min(1, k)) * 100 + "%"; } };
}

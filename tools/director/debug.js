// The playtest's debug panel, after RPG Maker's F9: while the Watch plays, every flag, counter, karma axis and item
// seen and changed live, the node it's at, and the beats as they fire (click one to open it on the board); before it
// plays, the same panel is the state a playthrough starts from, at the node you choose.
//   new DebugPanel(host, D): D is the desk (app.js): run(), story(), flags(), nodes(), watch(nid, snap), go(node, beat)
import { h } from "./ui.js";
import { icon } from "./icons.js";
import { triggerText, actionText } from "./commands.js";

export class DebugPanel {
  constructor(host, D) { this.host = host; this.D = D; this.start = { flags: new Set(), counters: {}, karma: {}, items: new Set() }; this.node = null; this.log = []; this.box = null; this.timer = null; }
  get open() { return !!this.box; }
  toggle(force) { if (this.box && force !== true) { this.close(); return; } if (!this.box) { this.box = h("div", { class: "dbg" }); this.host.append(this.box); this.timer = setInterval(() => this.tick(), 600); } this.render(); }
  close() { if (this.box) this.box.remove(); this.box = null; clearInterval(this.timer); }
  reset() { this.log = []; if (this.box) this.render(); }
  // while it plays: drawn again only when something it shows changed (a click never lands on a row being replaced);
  // the story clock just ticks
  tick() {
    const R = this.D.run(); if (!this.box) return;
    const st = this.state(), sig = JSON.stringify([!!R, [...st.flags].sort(), st.counters, st.karma, [...st.items].sort(), this.log.length, R ? R.trail.length : 0]);
    if (sig !== this.sig) { this.render(); return; }
    const c = this.box.querySelector(".dbg-clock"); if (c && R) c.textContent = `${Math.floor(R.secs / 60)}:${String(Math.round(R.secs % 60)).padStart(2, "0")} of story`;
  }
  fired(st, b, secs) {                             // a beat fired in Play: the newest first, kept to 40
    this.log.unshift({ st, b, at: secs }); this.log.length = Math.min(this.log.length, 40);
    if (this.box) this.render();
  }
  state() {                                        // what's edited: the playthrough's own, or the one a start from here uses
    const R = this.D.run();
    if (R) return { live: true, flags: R.flags, counters: R.counters, karma: R.karma, items: R.play ? R.play.items : (R.items || new Set()) };
    return Object.assign({ live: false }, this.start);
  }
  render() {
    const box = this.box; if (!box) return;
    const S = this.D.story(); if (!S) return;
    const st = this.state(), R = this.D.run(), axes = Object.entries(((S.game || {}).karma || {}).axes || { karma: { min: -10, max: 10 } });
    const keep = box.querySelector(".dbg-b"), scroll = keep ? keep.scrollTop : 0;
    this.sig = JSON.stringify([!!R, [...st.flags].sort(), st.counters, st.karma, [...st.items].sort(), this.log.length, R ? R.trail.length : 0]);
    box.innerHTML = "";
    const now = R && R.trail.length ? R.trail[R.trail.length - 1] : null, n = now && S.flow[now];
    box.append(h("div", { class: "dbg-h" }, icon("gear", 14), h("b", {}, "Debug"), h("span", { class: "kv" }, st.live ? "the playthrough, live" : "the state a start uses"), h("span", { class: "grow" }), h("kbd", {}, "F9"),
      h("button", { class: "ghost", title: "close (F9)", on: { click: () => this.close() } }, icon("x", 13))));
    const b = h("div", { class: "dbg-b" });
    if (st.live) b.append(h("div", { class: "dbg-now" }, icon("play", 12), " at ", h("b", {}, n ? this.D.title(now) : "—"), h("span", { class: "kv" }, ` · ${now || ""} · `), h("span", { class: "kv dbg-clock" }, `${Math.floor(R.secs / 60)}:${String(Math.round(R.secs % 60)).padStart(2, "0")} of story`)));
    else {                                         // start from here, with this
      const sel = h("select", { on: { change: e => { this.node = e.target.value; } } }, this.D.nodes().map(([id, t]) => h("option", { value: id, selected: id === (this.node || S.game.start) }, t)));
      b.append(h("div", { class: "dbg-sec" }, "Start from"), h("div", { class: "rowi" }, sel,
        h("button", { class: "primary small", on: { click: () => this.D.watch(sel.value, this.snap()) } }, icon("play", 12), " Play from there")));
    }
    const flags = this.D.flags();
    b.append(h("div", { class: "dbg-sec" }, `Flags · ${[...st.flags].length} set`));
    const fl = h("div", { class: "dbg-flags" });
    for (const f of [...new Set([...flags, ...st.flags])].sort()) fl.append(h("label", { class: "dbg-flag" + (st.flags.has(f) ? " on" : "") }, h("input", { type: "checkbox", checked: st.flags.has(f), on: { change: e => { if (e.target.checked) st.flags.add(f); else st.flags.delete(f); this.render(); } } }), " " + f));
    if (!flags.length) fl.append(h("span", { class: "kv" }, "no flags in this game"));
    b.append(fl);
    const num = (obj, key, step, label) => h("div", { class: "dbg-num" }, h("span", { class: "grow" }, label),
      h("button", { class: "small", on: { click: () => { obj[key] = (+obj[key] || 0) - step; this.render(); } } }, "−"), h("b", {}, String(+obj[key] || 0)),
      h("button", { class: "small", on: { click: () => { obj[key] = (+obj[key] || 0) + step; this.render(); } } }, "+"));
    const counters = Object.entries((S.game || {}).counters || {});
    if (counters.length) { b.append(h("div", { class: "dbg-sec" }, "Counters")); for (const [id, c] of counters) b.append(num(st.counters, id, 1, c.label || id)); }
    b.append(h("div", { class: "dbg-sec" }, "Karma"));
    for (const [id, a] of axes) b.append(num(st.karma, id, 1, a.label ? `${id} · ${a.label}` : id));
    const items = Object.entries(S.items || {});
    if (items.length) {
      b.append(h("div", { class: "dbg-sec" }, "Items held" + (st.live && !R.play ? " (in Play only)" : "")));
      const il = h("div", { class: "dbg-flags" });
      for (const [id, it] of items) il.append(h("label", { class: "dbg-flag" + (st.items.has(id) ? " on" : "") }, h("input", { type: "checkbox", checked: st.items.has(id), on: { change: e => { if (e.target.checked) { if (R && R.play) R.play.give(id); else st.items.add(id); } else st.items.delete(id); this.render(); } } }), " " + (it.name || id)));
      b.append(il);
    }
    b.append(h("div", { class: "dbg-sec" }, `Beats fired · ${this.log.length}`));
    if (!this.log.length) b.append(h("div", { class: "kv" }, R ? "none yet (they're listed as they fire in Play)" : "a playthrough lists them here"));
    for (const x of this.log) b.append(h("div", { class: "dbg-beat", title: "open it on the board (the playthrough stops)", on: { click: () => this.D.go(x.st, x.b.id) } },
      h("span", { class: "kv" }, `${Math.floor(x.at / 60)}:${String(Math.round(x.at % 60)).padStart(2, "0")}`), h("b", {}, x.b.id),
      h("span", { class: "dbg-bt" }, "When " + triggerText(x.b.when, this.D.name) + ((x.b.do || [])[0] ? " · " + actionText(x.b.do[0], this.D.name) + ((x.b.do || []).length > 1 ? ` +${x.b.do.length - 1}` : "") : ""))));
    box.append(b); b.scrollTop = scroll;
  }
  snap() { const s = this.start; return { secs: 0, flags: [...s.flags], counters: Object.assign({}, s.counters), karma: Object.assign({}, s.karma), items: [...s.items], results: {}, answers: [], trail: [] }; }
}

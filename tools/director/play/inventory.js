// The inventory (DECISIONS 2026-10-27, later): every thing the player picks up (a click on it: a pickup's item, a thing
// to carry) goes into one row, the newest in the hand. The one in the hand is always in the middle and the rest sit
// either side; the mouse wheel turns the row like a wheel, at most five shown, the ones farther from the middle smaller
// and fading out. E hides the row and shows it again (hidden, it peeks for a moment when something changes); G puts
// the one in the hand down (runtime.drop), Q lowers it out of view and raises it again. The row is drawn by the HUD (hud.inventory); this keeps what's in it, and
// the runtime holds a copy of the thing in the hand (runtime.handTick) and makes its picture (runtime.iconOf).
//   an entry: {id: the thing, item: the story's item it is (or null), name, kind: "pickup" | "carry", level: where it
//             was taken, mesh: a copy of the thing (for the hand, and to set down in another level), icon: its picture}
export const SHOWN = 5;                              // in the row at once: the one in the hand and two either side

export class Inventory {
  constructor(rt) { this.rt = rt; this.list = []; this.at = -1; this.shown = true; this.lowered = false; }   // lowered: the one in the hand out of view (Q), still in the row
  get held() { return this.list[this.at] || null; }
  has(id) { return this.list.some(e => e.id === id); }
  // a new thing: into the row, in the hand
  add(e) { this.list.push(e); this.at = this.list.length - 1; this.draw(true); }
  // out of the row (put down): the next one along comes into the hand
  remove(id) {
    const i = this.list.findIndex(e => e.id === id); if (i < 0) return null;
    const [e] = this.list.splice(i, 1);
    if (!this.list.length) this.at = -1;
    else if (i < this.at || this.at >= this.list.length) this.at = Math.max(0, this.at - 1);
    this.draw(true);
    return e;
  }
  // the wheel: one along either way, round past the ends
  // Q: the one in the hand lowered out of view (its slot dim), or raised again; the wheel raises it too (the user's ask,
  // 2026-10-29: not to see what you carry when you don't want to)
  lower(down) { this.lowered = !!down && !!this.held; this.draw(true); }
  scroll(d) {
    const n = this.list.length;
    if (this.lowered && n) { this.lower(false); return; }
    if (n < 2 || !d) return;
    this.at = ((this.at + Math.sign(d)) % n + n) % n;
    this.draw(true);
  }
  toggle() { this.shown = !this.shown; this.draw(false); }
  draw(peek) { this.rt.hud.inventory(this.list.map(e => ({ id: e.id, name: e.name, icon: e.icon })), this.at, this.shown, peek, this.lowered); }
}

// where each one sits in the row: its steps from the middle round the wheel (0 the one in the hand; the far side of the
// wheel, more than two away, is hidden)
export function slot(i, at, n) {
  let d = ((i - at) % n + n) % n;
  if (d > n / 2) d -= n;
  return d;
}

// The beds under the game on the desk (docs/HORROR_TODO.md 13.1; Godot's beds.gd, the same numbers): the music's mood
// (the story's `music`: calm, uneasy, dread, chase, or silence; tools/score/moods.mjs made them, served at
// /music/<game>/<mood>.ogg, a game's own over the studio's) and the room's tone (a room's `tone`, else `game.tone`, a
// loop off the sound shelf), each a loop crossfading into the next with equal power; `hush` ducks both to nothing so
// the last half second before a sting is silent, then lets them back slowly. One for the whole desk (BEDS), so the
// music carries through scenes and stitches; it ticks itself while anything sounds. `state()` says what's playing.
import { audioOut, shelf, shelfBuffer, urlBuffer } from "../sfx.js";

export const MOODS = ["calm", "uneasy", "dread", "chase"];
export const MUSIC_DB = -6, TONE_DB = -22;           // the music under the game (the moods at -20 LUFS: about -26), a room's hum under everything (about -38)
export const FADE = 2, TONE_FADE = 1.5;              // a mood's crossfade (the music action's `secs`), one room's tone into the next
export const QUIET = 0.5, BACK = 6;                  // a hush's last half second silent; the beds' way back after it
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const off = v => v == null || v === "" || v === "silence" || v === "none";

export class Beds {
  constructor() { this.game = null; this.mood = null; this.tone = null; this.tracks = {}; this.hush_ = null; this.clock = 0; this.timer = null; this.driven = 0; }
  music(m, secs = FADE) {                            // a mood, or silence, crossfading over secs
    const to = off(m) ? null : String(m);
    if (to && !MOODS.includes(to)) return;
    this.mood = to; this.aim("m:", to, secs);
  }
  roomTone(name, secs = TONE_FADE) {                 // a shelf name; none for none
    const to = off(name) ? null : String(name);
    if (to === this.tone) return;
    this.tone = to; this.aim("t:", to, secs);
  }
  hush(secs = 1.5, back = BACK) {                    // its seconds: the caller waits them out before the sting
    secs = Math.max(+secs || 0, QUIET);
    this.hush_ = { t0: this.clock, secs, back: Math.max(+back || 0, 0.1), k0: this.duck() };
    this.wake(); return secs;
  }
  duck() {                                           // how loud the beds are let be now, 0..1
    const h = this.hush_; if (!h) return 1;
    const t = this.clock - h.t0, fall = Math.max(h.secs - QUIET, 0.01);
    if (t < fall) return h.k0 * (1 - smooth(t / fall));
    if (t < h.secs) return 0;
    if (t < h.secs + h.back) return smooth((t - h.secs) / h.back);
    return 1;
  }
  aim(prefix, to, secs) {
    if (to && !this.tracks[prefix + to]) this.tracks[prefix + to] = { kind: prefix, name: to, g: 0, target: 0, rate: 1, src: null, gain: null, loading: null };
    for (const [key, tr] of Object.entries(this.tracks)) {
      if (tr.kind !== prefix) continue;
      tr.target = to && key === prefix + to ? 1 : 0; tr.rate = 1 / Math.max(secs, 0.001);
      if (secs <= 0) tr.g = tr.target;
      if (tr.target > 0) this.start(tr);
    }
    this.wake();
  }
  async start(tr) {                                  // its loop playing (from its start), once its file is in
    if (tr.src || tr.loading) return;
    tr.loading = (async () => {
      let buf = null;
      if (tr.kind === "m:") buf = await urlBuffer(`/music/${encodeURIComponent(this.game || "_")}/${tr.name}.ogg`);
      else if ((await shelf())[tr.name]) buf = await shelfBuffer(tr.name);
      if (!buf || tr.target <= 0) return;
      const { ctx, master } = audioOut();
      tr.gain = ctx.createGain(); tr.gain.gain.value = 0; tr.gain.connect(master);
      tr.src = ctx.createBufferSource(); tr.src.buffer = buf; tr.src.loop = true; tr.src.connect(tr.gain); tr.src.start();
    })().catch(e => console.warn("beds", tr.name, e)).finally(() => { tr.loading = null; });
  }
  drive(dt) { this.driven = performance.now(); this.tick(dt); }   // Play's frame (its clock): a hush ends with the beat's wait
  wake() {                                           // its own tick while anything sounds or moves and Play isn't driving it (the Watch's scenes)
    if (this.timer) return;
    let last = performance.now();
    this.timer = setInterval(() => { const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000); last = now; if (now - this.driven > 200) this.tick(dt); }, 50);
  }
  tick(dt) {
    this.clock += dt;
    const k = this.duck();
    if (this.hush_ && this.clock - this.hush_.t0 >= this.hush_.secs + this.hush_.back) this.hush_ = null;
    let busy = !!this.hush_;
    for (const tr of Object.values(this.tracks)) {
      const step = tr.rate * dt; tr.g = tr.g < tr.target ? Math.min(tr.target, tr.g + step) : Math.max(tr.target, tr.g - step);
      const amp = Math.sin(tr.g * Math.PI / 2) * k, v = Math.pow(10, (tr.kind === "m:" ? MUSIC_DB : TONE_DB) / 20) * amp;   // equal power: two crossfading sum to one
      if (tr.gain) { const { ctx } = audioOut(); tr.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.02); }
      if (tr.g <= 0 && tr.target <= 0) { if (tr.src) { try { tr.src.stop(); } catch (e) { } tr.src.disconnect(); tr.src = null; } }
      else busy = true;
    }
    if (!busy && this.timer) { clearInterval(this.timer); this.timer = null; }
  }
  state() {                                          // the mood and tone, each track's fade (0..1: its loudness is that times the duck), the duck
    const levels = {};
    for (const [key, tr] of Object.entries(this.tracks)) levels[key] = Math.round(Math.sin(tr.g * Math.PI / 2) * 1000) / 1000;
    return { music: this.mood, tone: this.tone, duck: Math.round(this.duck() * 1000) / 1000, levels, hushing: !!this.hush_ };
  }
  stopAll(secs = 1) { this.music(null, secs); this.roomTone(null, secs); this.hush_ = null; }
}
export const BEDS = new Beds();

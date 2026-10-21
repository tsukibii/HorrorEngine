// The player: plays a written cue (a take) live through the sampled instruments, renders it to WAV offline, writes
// it as MIDI. The samples come from Content/Studio/Music/samples (serve.py serves them under samples/), loaded per
// instrument the first time a cue needs it. The same engine will sit in the director's desk (docs/MUSIC.md §5).
"use strict";

// Several cues in a row (the sequence strip: sneak, then the fall, then flustered): one take, each cue's notes
// shifted by where it starts. item: {take, gap (s after the previous one ends; negative overlaps), at (or a fixed start)}.
function chainTakes(items) {
  // the parts keep their levels against each other: the loudest sets the master, the others sit under it note by note
  const top = Math.max(...items.map(it => it.take.gain ?? 0));
  const out = { cue: "chain", gain: top, ev: [], marks: [], hits: [], secs: 0, tempo: items[0] ? items[0].take.tempo : 90, meter: [4, 4], parts: [] };
  let at = 0;
  for (const it of items) {
    const tk = it.take, s = it.at !== undefined ? it.at : Math.max(0, at + (it.gap || 0));
    out.parts.push({ cue: tk.cue, at: s, secs: tk.secs });
    const under = (tk.gain ?? 0) - top;
    for (const e of tk.ev) out.ev.push(Object.assign({}, e, { t: e.t + s, db: (e.db || 0) + under }));
    for (const m of tk.marks) out.marks.push({ t: m.t + s, text: m.text });
    for (const h of tk.hits) out.hits.push({ t: h.t + s, label: h.label });
    out.marks.push({ t: s, text: "cue: " + tk.cue });
    at = s + (it.cut ? Math.min(tk.secs, it.cut) : tk.secs - (tk.tail || 0));
    out.secs = Math.max(out.secs, s + tk.secs);
  }
  out.ev.sort((a, b) => a.t - b.t);
  return out;
}

const Engine = {
  ctx: null, mixer: null, lib: null, index: null, players: {}, playing: null, space: "room", onProgress: null,

  async init(base = "samples/") {
    if (this.ctx) return this;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
    this.index = await (await fetch(base + "instruments.json")).json();
    const root = base.replace(/samples\/$/, "");
    this.lib = new Library(this.index, async path => { const r = await fetch(root + path); if (!r.ok) throw new Error(path + " " + r.status); return r.arrayBuffer(); });
    this.mixer = new Mixer(this.ctx);
    this.mixer.setSpace(this.space, 0, 0);
    return this;
  },

  // the instruments a take needs, loaded (each once; the sampler plays whatever has arrived while the rest load)
  async load(take) {
    const keys = takeInstruments(take).filter(k => this.index[k]);
    await Promise.all(keys.map(k => this.lib.load(k, this.ctx, this.onProgress)));
    return keys;
  },
  loaded(key) { return this.lib && this.lib.ready(key); },

  // the samplers for a mixer (the live one keeps its own; an offline render makes fresh ones on its own mixer)
  playersFor(mixer, keys, cache) {
    const out = cache || {};
    for (const k of keys) {
      if (out[k]) continue;
      const def = this.index[k];
      out[k] = def.kind === "kit" ? new Kit(def, this.lib.buffers, mixer) : new Sampler(k, def, this.lib.buffers, mixer);
    }
    return out;
  },

  // every event of a take onto the mixer's players, from audio time t0; `from` skips what's before it (s)
  schedule(players, take, t0, from = 0, record = false) {
    for (const e of take.ev) {
      if (e.t < from - 0.001) continue;
      const pl = players[e.inst];
      if (!pl) continue;
      const when = t0 + e.t - from;
      if (e.inst === "drums") pl.play(e.piece, e.vel, when, { pan: e.pan, db: e.db, cents: e.cents, record });
      else pl.play(e.midi, e.vel, when, e.dur, { pan: e.pan, db: e.db, cents: e.cents, bend: e.bend, attack: e.attack, release: e.release, reverse: e.reverse, record });
    }
  },

  // the cue's level, at the master after the limiter (the Mixer's own -3 dB plus the cue's gain)
  level(mixer, take, at) { mixer.master.gain.cancelScheduledValues(at); mixer.master.gain.setValueAtTime(dbToGain(-3 + (take.gain ?? 0)), at); },

  setSpace(id) { this.space = id; if (this.mixer) this.mixer.setSpace(id, this.ctx.currentTime, 0.6); },

  async play(take, from = 0) {
    await this.init();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.stop();
    const keys = await this.load(take);
    this.players = this.playersFor(this.mixer, keys, this.players);
    const t0 = this.ctx.currentTime + 0.12;
    this.level(this.mixer, take, t0);
    this.schedule(this.players, take, t0, from);
    this.playing = { take, t0: t0 - from, until: t0 + take.secs - from };
    return this.playing;
  },
  // where the playhead is in the playing take (s), or -1
  position() {
    const p = this.playing;
    if (!p || !this.ctx) return -1;
    const now = this.ctx.currentTime;
    if (now > p.until + 0.3) { this.playing = null; return -1; }
    return Math.max(0, now - p.t0);
  },
  stop() {
    if (!this.ctx) return;
    for (const pl of Object.values(this.players)) if (pl.stopAll) pl.stopAll(this.ctx.currentTime, 0.15);
    // a kit's sources aren't tracked: a fresh kit next time (the old one's last hits ring out under a second)
    delete this.players.drums;
    this.playing = null;
  },

  // A take rendered to a stereo WAV (48 kHz, 16-bit) through the same mixer and hall, faster than real time.
  async renderWav(take, space = this.space) {
    await this.init();
    const keys = await this.load(take);
    const sr = 48000, secs = take.secs + 2.5;
    const off = new OfflineAudioContext(2, Math.ceil(sr * secs), sr);
    const mixer = new Mixer(off);
    mixer.setSpace(space, 0, 0);
    const players = this.playersFor(mixer, keys);
    this.level(mixer, take, 0);
    this.schedule(players, take, 0.05, 0, false);
    const buf = await off.startRendering();
    return wavBytes(buf);
  },

  // A take as a Standard MIDI File: one track per instrument (GM programs), the kit on channel 10, its tempo and
  // the cue's marks and hit points as markers (they line up in a DAW).
  midi(take, name) {
    const kit = this.index && this.index.drums;
    const notes = take.ev.map(e => e.inst === "drums"
      ? { inst: "drums", midi: (kit && kit.pieces[e.piece] && kit.pieces[e.piece].gm) || 38, vel: e.vel, t: e.t, dur: 0.25 }
      : { inst: e.inst, midi: e.midi, vel: e.vel, t: e.t, dur: e.dur != null ? e.dur : 2.5 });
    const marks = take.marks.map(m => ({ t: m.t, text: m.text }));
    return MIDI.write({ notes, tempos: [{ t: 0, bpm: take.tempo || 90, meter: take.meter || [4, 4] }], marks, name: name || "HorrorStudio score: " + take.cue });
  },
};

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
    for (const e of tk.ev) out.ev.push(Object.assign({}, e, { t: e.t + s, db: (e.db || 0) + under }, e.strings || tk.strings ? { strings: e.strings || tk.strings } : {}));
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
  strings: "section",                                   // the string set a take plays with unless it names its own (32-strings.js)

  // once: the context, the instruments' index, the mixer (callers at the same time share the one promise)
  init(base = "samples/") {
    if (this._init) return this._init;
    this._init = (async () => {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
      this.index = await (await fetch(base + "instruments.json")).json();
      const root = base.replace(/samples\/$/, "");
      this.lib = new Library(this.index, async path => { const r = await fetch(root + path); if (!r.ok) throw new Error(path + " " + r.status); return r.arrayBuffer(); });
      this.mixer = new Mixer(this.ctx);
      this.mixer.setSpace(this.space, 0, 0);
      return this;
    })();
    return this._init;
  },

  // the string set an event plays with: its own (a part of a sequence), its take's (a favourite's), or the page's
  setOf(take, e) { return e.strings || take.strings || this.strings; },
  // the instruments a take needs, loaded (each once; the sampler plays whatever has arrived while the rest load)
  async load(take) {
    const keys = uniq(take.ev.filter(e => e.inst !== "fx").flatMap(e => stringInsts(e.inst, this.setOf(take, e)))).filter(k => this.index[k]);
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
      out[k] = def.kind === "kit" ? new Kit(def, this.lib.buffers, mixer, k) : new Sampler(k, def, this.lib.buffers, mixer);
    }
    return out;
  },

  // every event of a take onto the mixer's players, from audio time t0; `from` skips what's before it (s)
  schedule(players, take, t0, from = 0, record = false) {
    const stops = [];
    for (const e of take.ev) {
      if (e.t < from - 0.001) continue;
      const when = t0 + e.t - from;
      if (e.inst === "fx") { if (e.fx === "tapestop") stops.push([when, e.dur]); continue; }
      if (e.piece != null) { const pl = players[e.inst]; if (pl) pl.play(e.piece, e.vel, when, { pan: e.pan, db: e.db, cents: e.cents, record }); continue; }
      // a string part plays on the set's instruments (a stack: each member that holds the note)
      stringMembers(e.inst, e.midi, this.setOf(take, e), this.index).forEach(([k, db], i) => {
        const pl = players[k];
        if (pl) pl.play(e.midi, e.vel, when, e.dur, { pan: e.pan, db: (e.db || 0) + db, cents: e.cents, bend: e.bend, attack: e.attack, release: e.release, reverse: e.reverse, tone: e.tone, record: record && !i });
      });
    }
    // tape stops last: they act on every voice already scheduled to be sounding then
    for (const [when, dur] of stops) for (const pl of Object.values(players)) if (pl.tapeStop) pl.tapeStop(when, dur);
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
    for (const k of Object.keys(this.players)) if (this.players[k] instanceof Kit) delete this.players[k];
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
    const kitOf = e => this.index && this.index[e.inst];
    const notes = take.ev.filter(e => e.inst !== "fx").map(e => e.piece != null
      ? { inst: "drums", midi: (kitOf(e) && kitOf(e).pieces[e.piece] && kitOf(e).pieces[e.piece].gm) || 38, vel: e.vel, t: e.t, dur: 0.25 }
      : { inst: e.inst, midi: e.midi, vel: e.vel, t: e.t, dur: e.dur != null ? e.dur : 2.5 });
    const marks = take.marks.map(m => ({ t: m.t, text: m.text }));
    return MIDI.write({ notes, tempos: [{ t: 0, bpm: take.tempo || 90, meter: take.meter || [4, 4] }], marks, name: name || "HorrorStudio score: " + take.cue });
  },
};

// ---- scoring a scene: the character's actions with times -> cues lined up on them ----
// The way the desk will score a scene from its clips (docs/MUSIC.md §5): each action names what happens ("sneak",
// "trip", "blush", "her theme", a favourite's name); the favourites are searched first (their names and uses), then
// the cues (ids, labels, uses). A cue with a hit point is placed so its first hit lands on the action's time (the
// fall's thud on the landing); one without starts there. Each part ends where the next begins: cut (its notes trimmed
// with a short release), ring (left to overlap) or scratch (a tape stop).

// "4.2 trip @scratch" -> {t: 4.2, act: "trip", end: "scratch"}; lines that don't start with a time are skipped
function parseActions(text) {
  const out = [];
  for (const raw of String(text || "").split(/\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^(\d+(?:\.\d+)?)\s*s?\s+(.+?)(?:\s+@(cut|ring|scratch))?$/i);
    if (m) out.push({ t: +m[1], act: m[2].trim(), end: (m[3] || "cut").toLowerCase() });
  }
  return out.sort((a, b) => a.t - b.t);
}

// what an action means: a favourite ({fav}) or a cue at its defaults; null when nothing matches
function resolveAction(act, favourites = []) {
  const q = act.toLowerCase().trim(), words = q.split(/\s+/);
  const score = (name, tags, extra = "") => {
    name = (name || "").toLowerCase(); tags = (tags || []).map(x => x.toLowerCase());
    if (name === q) return 100;
    if (tags.includes(q)) return 90;
    if (name.includes(q)) return 70;
    if (tags.some(x => x.includes(q) || q.includes(x))) return 60;
    const hay = name + " " + tags.join(" ") + " " + extra.toLowerCase();
    const hit = words.filter(w => w.length > 2 && hay.includes(w)).length;
    return hit ? 20 + 10 * hit / words.length : 0;
  };
  let best = null, bestS = 0;
  for (const f of favourites) { if (!CUES[f.cue]) continue; const s = score(f.name, f.uses) + 5 + (f.stars || 0); if (s > bestS) { best = { fav: f, cue: f.cue, params: f.params, seed: f.seed, label: f.name }; bestS = s; } }
  for (const c of Object.values(CUES)) { const s = Math.max(score(c.id.replace(/_/g, " "), c.uses, c.desc), score(c.label, [])); if (s > bestS) { best = { cue: c.id, params: {}, seed: 1, label: c.label }; bestS = s; } }
  return bestS >= 20 ? best : null;
}

function sceneTake(actions, favourites) {
  const parts = [], missing = [];
  for (const a of actions) {
    const r = resolveAction(a.act, favourites);
    if (!r) { missing.push(a.act); continue; }
    // the action lands on the cue's first hit, unless the cue starts on its action (a sneak, a waltz, a countdown:
    // their hits are on the way or at the end) or the hit is far in
    const take = writeCue(r.cue, r.params, r.seed), h0 = take.hits[0];
    if (r.fav && r.fav.strings) take.strings = r.fav.strings;                 // a favourite keeps the strings it was kept with
    const hit = h0 && CUES[r.cue].align !== "start" && h0.t <= 6 ? h0 : null;
    parts.push({ a, r, take, start: Math.max(0, a.t - (hit ? hit.t : 0)), hit });
  }
  const top = parts.length ? Math.max(...parts.map(p => p.take.gain ?? 0)) : 0;
  const out = { cue: "scene", gain: top, ev: [], marks: [], hits: [], secs: 0, tempo: parts[0] ? parts[0].take.tempo : 90, meter: [4, 4], parts: [], missing };
  parts.forEach((p, i) => {
    const next = parts[i + 1], until = next ? next.start : Infinity, under = (p.take.gain ?? 0) - top;
    for (const e of p.take.ev) {
      const t = e.t + p.start;
      if (t >= until - 0.01 && p.a.end !== "ring") continue;
      const ne = Object.assign({}, e, { t, db: (e.db || 0) + under }, p.take.strings ? { strings: p.take.strings } : {});
      if (p.a.end === "cut" && until < Infinity && ne.piece == null && ne.inst !== "fx") ne.dur = Math.max(0.05, Math.min(ne.dur ?? 3, until - t)), ne.release = Math.min(ne.release ?? 0.3, 0.25);
      out.ev.push(ne);
    }
    if (p.a.end === "scratch" && until < Infinity) out.ev.push({ inst: "fx", fx: "tapestop", t: until - 0.02, dur: 0.22, vel: 1 });
    for (const m of p.take.marks) if (m.t + p.start < until) out.marks.push({ t: m.t + p.start, text: m.text });
    for (const h of p.take.hits) if (h.t + p.start < until) out.hits.push({ t: h.t + p.start, label: h.label });
    out.marks.push({ t: p.a.t, text: "action: " + p.a.act + " -> " + p.r.label });
    const stop = next && p.a.end !== "ring" ? until : p.start + p.take.secs;
    out.parts.push({ act: p.a.act, at: p.a.t, start: p.start, cue: p.r.cue, label: p.r.label, fav: p.r.fav ? p.r.fav.id : null, hit: p.hit ? p.hit.label : null, until: stop });
    out.secs = Math.max(out.secs, stop + (next ? 0.3 : 0));
  });
  out.ev.sort((a, b) => a.t - b.t);
  return out;
}

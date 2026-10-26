// The sampled instruments (music/samples/instruments.json): Meta Piano on every key with its four velocity layers
// crossfaded the way its spec says, the guitar and the VSCO-2 instruments shifted at most a semitone from their
// nearest sample, the drum kit by piece. Every note played is also written to the recorder (the MIDI export).
"use strict";

// GM programs for the MIDI export (channel 10 for the kit)
const GM_PROGRAM = { piano: 0, guitar: 24, harp: 46, glock: 9, marimba: 12, xylo: 13, bells: 14, pizz: 45, strings: 48,
  trem: 44, flute: 73, flute_stac: 73, horn: 60, timpani: 47, celesta: 8, pad: 89,
  // the added instruments (fetch_samples.py): the nearest General MIDI sound each
  viola_sus: 41, viola_trem: 44, viola_pizz: 45, cello_sus: 42, cello_trem: 44, cello_pizz: 45, cbass_sus: 43, cbass_trem: 44, cbass_pizz: 45,
  vln_solo: 40, vln_solo_trem: 44, vln_solo_pizz: 45, trombone: 57, trombone_fall: 57, trombone_buzz: 57, tuba: 58, trumpet_mute: 59,
  bassoon: 70, clarinet: 71, glass: 92, psaltery: 110, vibes_bowed: 92, vibes: 11, kalimba: 108, harpsichord: 6, organ: 19, ocarina: 79 };

// How much of a note reaches the reverb, by its pitch: nothing at E2 and below, all of it from E4 (the user,
// 2026-10-18: low notes in reverb are mud).
const wetFor = midi => clamp((midi - 40) / 24, 0, 1);
// The drums that stay nearly dry (a taiko or a bass drum in the hall is a boom that never ends).
const DRY_DRUMS = new Set(["taiko", "taiko_hand", "taiko_rim", "bass_drum", "bass_roll", "timp_roll", "rumble", "tenor"]);

// HorrorStudio: string colours the samples don't have, faked with filters on the note (docs/MUSIC_RESEARCH.md §2.5):
// sul ponticello (glassy, brittle: the high-passed tremolo with a resonant peak), sul tasto (veiled: low-passed),
// harmonics (pure and thin: only the top), col legno (the wood of the bow: a dry click, played short on pizzicato).
const TONES = {
  ponticello: (ctx, n) => { const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 650; hp.Q.value = 0.9;
    const pk = ctx.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = 4200; pk.Q.value = 1.4; pk.gain.value = 9; return n.connect(hp).connect(pk); },
  tasto: (ctx, n) => { const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1700; lp.Q.value = 0.5; return n.connect(lp); },
  harmonic: (ctx, n) => { const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1400; hp.Q.value = 0.7;
    const hp2 = ctx.createBiquadFilter(); hp2.type = "highpass"; hp2.frequency.value = 1400; hp2.Q.value = 0.7; return n.connect(hp).connect(hp2); },
  legno: (ctx, n) => { const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900; hp.Q.value = 0.8;
    const pk = ctx.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = 2500; pk.Q.value = 2; pk.gain.value = 6; return n.connect(hp).connect(pk); },
};

class Sampler {
  constructor(key, def, buffers, mixer) {
    this.key = key; this.def = def; this.buffers = buffers; this.mixer = mixer; this.ctx = mixer.ctx;
    this.voices = [];
    this.maxVoices = key === "piano" ? 72 : 40;
    const ch = mixer.channel(key, { db: (def.gain_db || 0) + (def.calib_db || 0) });
    this.out = ch.input; this.wetOut = ch.wetIn;
    // zones by layer, sorted by note (they play as their samples arrive: the library loads in the background)
    this.allLayers = (def.layers || [[1, 127]]).map((_, i) => def.zones.filter(z => z.layer === i).sort((a, b) => a.note - b.note));
    this.loaded = false;
  }
  get layers() {
    if (this.loaded) return this.allLayers;
    const ready = this.allLayers.map(zs => zs.filter(z => this.buffers[z.file]));
    if (ready.every((zs, i) => zs.length === this.allLayers[i].length)) this.loaded = true;
    return ready;
  }

  // The zone for a note in one layer: the exact key, else the nearest (ties: the one below, so it is shifted up).
  // Several takes of the same key (round robins: your own samples' _rr1, _rr2...) take turns at random.
  zone(layer, midi) { return this.zoneIn(this.layers[layer], midi); }
  zoneIn(zs, midi) {
    if (!zs || !zs.length) return null;
    let best = zs[0];
    for (const z of zs) if (Math.abs(z.note - midi) < Math.abs(best.note - midi) || (Math.abs(z.note - midi) === Math.abs(best.note - midi) && z.note < midi)) best = z;
    const takes = zs.filter(z => z.note === best.note);
    return takes.length > 1 ? takes[Math.floor(Math.random() * takes.length)] : best;
  }

  // Which layers a velocity sounds, with weights: within 8 steps of a split, the two neighbours crossfade (equal power).
  layerMix(vel) {
    const L = this.def.layers || [[1, 127]];
    const layers = this.layers;
    let i = L.findIndex(([lo, hi]) => vel >= lo && vel <= hi);
    if (i < 0) i = vel < L[0][0] ? 0 : L.length - 1;
    const out = [[i, 1]], xf = 8;
    const [lo, hi] = L[i];
    if (i + 1 < L.length && vel > hi - xf) { const t = (vel - (hi - xf)) / (2 * xf); out[0][1] = Math.cos(t * Math.PI / 2); out.push([i + 1, Math.sin(t * Math.PI / 2)]); }
    else if (i > 0 && vel < lo + xf) { const t = ((lo + xf) - vel) / (2 * xf); out[0][1] = Math.cos(t * Math.PI / 2); out.push([i - 1, Math.sin(t * Math.PI / 2)]); }
    const ok = out.filter(([l]) => layers[l] && layers[l].length);
    if (ok.length) return ok;
    const any = layers.findIndex(zs => zs.length);                   // still loading: whatever layer has arrived
    return any >= 0 ? [[any, 1]] : [];
  }

  // Plays a note: when (audio time), dur (s, null: let it ring out), opts.pan, opts.cents. Returns the voices.
  play(midi, vel, when, dur, opts = {}) {
    vel = clamp(Math.round(vel), 1, 127);
    const L = this.def.layers || [[1, 127]];
    const single = L.length === 1;
    const made = [];
    const mix = this.layerMix(vel), layers = this.layers;
    for (const [layer, w] of mix) {
      const z = this.zoneIn(layers[layer], midi);
      if (!z || w < 0.02) continue;
      const buf = opts.reverse ? reversed(this.buffers[z.file]) : this.buffers[z.file];
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const jitter = (Math.random() * 2 - 1) * 5;                 // the spec's +-5 cents in place of round-robins
      src.playbackRate.value = Math.pow(2, ((midi - z.note) * 100 + (z.tune || 0) + jitter + (opts.cents || 0)) / 1200);
      const g = this.ctx.createGain();
      const [lo, hi] = L[layer];
      // the layers keep their recorded levels; inside one, +-2 dB by velocity. A lone layer takes the whole curve:
      // 0 dB at mezzo-forte (80), about -17 at 30, +8 at 127 (a piano's pp to ff spans about 25 dB)
      const inLayer = single ? clamp(40 * Math.log10(vel / 80), -30, 8) : ((vel - (lo + hi) / 2) / Math.max(1, hi - lo)) * 4;
      const layerDb = (this.def.layer_db && this.def.layer_db[layer]) || 0;
      const amp = w * dbToGain(inLayer + layerDb + (Math.random() * 2 - 1) * 1.5 + (opts.db || 0) + (opts.out ? (this.def.gain_db || 0) + (this.def.calib_db || 0) : 0));
      g.gain.value = amp;
      let node = src.connect(g);
      if (opts.tone && TONES[opts.tone]) node = TONES[opts.tone](this.ctx, node);
      const dryTail = node;
      if (opts.pan) { const p = this.ctx.createStereoPanner(); p.pan.value = clamp(opts.pan, -1, 1); node = node.connect(p); }
      node.connect(opts.out || this.out);
      const wetDest = opts.out ? opts.wetOut : this.wetOut;
      if (wetDest && wetFor(midi) > 0) { const wg = this.ctx.createGain(); wg.gain.value = wetFor(midi); dryTail.connect(wg).connect(wetDest); }
      const t0 = Math.max(when, this.ctx.currentTime);
      const len = buf.duration / src.playbackRate.value;
      if (opts.reverse) {
        // a reversed note swells for `dur` seconds into where its attack was, then stops (a 15 ms fade, no click)
        const swell = Math.min(len, dur || 2), offset = (len - swell) * src.playbackRate.value;
        src.start(t0, offset);
        g.gain.setValueAtTime(amp, t0 + swell - 0.015);
        g.gain.linearRampToValueAtTime(0, t0 + swell);
        src.stop(t0 + swell + 0.01);
        const voice = { src, g, start: t0, end: t0 + swell };
        made.push(voice); this.voices.push(voice);
        continue;
      }
      // HorrorStudio additions: a swell (opts.attack, seconds from silence) and a bend (opts.bend: {semis, at, dur},
      // the playback rate glides by that many semitones: string glissandi, a smile dropping, a sad horn sagging)
      if (opts.attack) { g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(amp, t0 + opts.attack); }
      if (opts.bend) {
        const r0 = src.playbackRate.value, b = opts.bend;
        src.playbackRate.setValueAtTime(r0, t0 + (b.at || 0));
        src.playbackRate.linearRampToValueAtTime(r0 * Math.pow(2, b.semis / 12), t0 + (b.at || 0) + Math.max(0.02, b.dur || 0.5));
      }
      src.start(t0);
      const voice = { src, g, start: t0, end: t0 + len };
      if (dur != null && dur < len) {
        const rel = opts.release ?? this.def.release ?? 0.3;
        const off = t0 + Math.max(0.02, dur);
        g.gain.setValueAtTime(amp, off);
        g.gain.setTargetAtTime(0, off, rel / 4);
        src.stop(off + rel * 1.5);
        voice.end = off + rel * 1.5;
      }
      made.push(voice);
      this.voices.push(voice);
    }
    this.steal(Math.max(when, this.ctx.currentTime));
    if (opts.record !== false) Recorder.note(this.key, midi, vel, when, dur != null ? dur : Math.min(6, made.length ? made[0].end - made[0].start : 2));
    return made;
  }

  // Too many voices sounding at `when`: the oldest of them fades out fast, at `when` (an offline render schedules
  // everything before it plays, so "now" is the new note's time, never the context's clock).
  steal(when) {
    const now = this.ctx.currentTime;
    this.voices = this.voices.filter(v => v.end > now);
    const sounding = this.voices.filter(v => v.start <= when && v.end > when);
    for (let i = 0; sounding.length - i > this.maxVoices; i++) {
      const v = sounding[i];
      try { v.g.gain.cancelScheduledValues(when); v.g.gain.setTargetAtTime(0, when, 0.015); v.src.stop(when + 0.08); v.end = when + 0.08; } catch (e) { /* already stopped */ }
    }
  }

  // A tape stop at `at`: every voice sounding then sags in pitch to a quarter and fades over `dur` (a record scratch
  // ends a romantic swell; the awkward beat). Voices that start later are the cue's business.
  tapeStop(at, dur = 0.25) {
    for (const v of this.voices) {
      if (!(v.start < at && v.end > at)) continue;
      try {
        const r0 = v.src.playbackRate.value;
        v.src.playbackRate.cancelScheduledValues(at); v.src.playbackRate.setValueAtTime(r0, at); v.src.playbackRate.exponentialRampToValueAtTime(r0 * 0.25, at + dur);
        v.g.gain.cancelScheduledValues(at); v.g.gain.setValueAtTime(v.g.gain.value, at); v.g.gain.linearRampToValueAtTime(0, at + dur);
        v.src.stop(at + dur + 0.03); v.end = at + dur + 0.03;
      } catch (e) { /* already stopped */ }
    }
  }

  stopAll(at = this.ctx.currentTime, fade = 0.3) {
    for (const v of this.voices) { try { v.g.gain.setTargetAtTime(0, at, fade / 3); v.src.stop(at + fade * 2); } catch (e) { /* done */ } }
    this.voices = [];
  }
}

// A sample played backwards (made once per sample).
const REVERSED = new WeakMap();
function reversed(buf) {
  if (REVERSED.has(buf)) return REVERSED.get(buf);
  const out = new AudioBuffer({ length: buf.length, numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c).slice(); d.reverse(); out.copyToChannel(d, c); }
  REVERSED.set(buf, out);
  return out;
}

class Kit {
  constructor(def, buffers, mixer, key = "drums") {
    this.key = key; this.def = def; this.buffers = buffers; this.mixer = mixer; this.ctx = mixer.ctx;
    const ch = mixer.channel(key, { db: (def.gain_db || 0) + (def.calib_db || 0), send: key === "drums" ? 0.25 : 0.6 });
    this.out = ch.input; this.wetOut = ch.wetIn;
  }
  has(piece) { return !!this.def.pieces[piece]; }
  play(piece, vel, when, opts = {}) {
    const p = this.def.pieces[piece];
    if (!p) return null;
    vel = clamp(Math.round(vel), 1, 127);
    const layer = p.layers.find(l => vel >= l.vel[0] && vel <= l.vel[1]) || p.layers[p.layers.length - 1];
    const buf = this.buffers[layer.file];
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = Math.pow(2, ((Math.random() * 2 - 1) * 30 + (opts.cents || 0)) / 1200);
    const g = this.ctx.createGain();
    const [lo, hi] = layer.vel;
    g.gain.value = dbToGain(((vel - (lo + hi) / 2) / Math.max(1, hi - lo)) * 6 + (Math.random() * 2 - 1) * 1.5 + (opts.db || 0) + (opts.out ? (this.def.gain_db || 0) + (this.def.calib_db || 0) : 0));
    let node = src.connect(g);
    if (opts.pan) { const pn = this.ctx.createStereoPanner(); pn.pan.value = clamp(opts.pan, -1, 1); node = node.connect(pn); }
    node.connect(opts.out || this.out);
    const wetDest = opts.out ? opts.wetOut : this.wetOut;
    if (wetDest) { const wg = this.ctx.createGain(); wg.gain.value = DRY_DRUMS.has(piece) ? 0.15 : 1; g.connect(wg).connect(wetDest); }
    src.start(Math.max(when, this.ctx.currentTime));
    if (opts.record !== false) Recorder.note(this.key, p.gm || 38, vel, when, Math.min(1, buf.duration));
    return src;
  }
}

// A soft synth for what no sample covers: a warm pad (detuned saws through a low-pass) and a celesta-like bell (FM).
// Marked as placeholders: the real instruments are the samples.
class Synth {
  constructor(key, mixer) { this.key = key; this.mixer = mixer; this.ctx = mixer.ctx; const ch = mixer.channel(key, { db: -10, send: 0.5 }); this.out = ch.input; this.wetOut = ch.wetIn; }
  play(midi, vel, when, dur, opts = {}) {
    const ctx = this.ctx, f = midiToHz(midi), t0 = Math.max(when, ctx.currentTime);
    const d = dur ?? 3;
    const g = ctx.createGain();
    const amp = dbToGain(gainToDb(Math.pow(vel / 127, 1.5)) + (opts.db || 0));
    g.gain.setValueAtTime(0, t0);
    let stopAt;
    if (this.key === "pad") {
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900 + vel * 8; lp.Q.value = 0.4;
      for (const det of [-7, 0, 7]) { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t0); o.stop(t0 + d + 2.5); }
      lp.connect(g);
      g.gain.linearRampToValueAtTime(amp * 0.25, t0 + Math.min(1.5, d * 0.4));
      g.gain.setTargetAtTime(0, t0 + d, 0.6);
      stopAt = t0 + d + 2.5;
    } else {                                                       // celesta: a sine carrier, a 3.5x modulator
      const car = ctx.createOscillator(), modu = ctx.createOscillator(), mg = ctx.createGain();
      car.frequency.value = f; modu.frequency.value = f * 3.5; mg.gain.value = f * 1.2;
      mg.gain.setTargetAtTime(f * 0.1, t0, 0.15);
      modu.connect(mg).connect(car.frequency); car.connect(g);
      g.gain.linearRampToValueAtTime(amp * 0.5, t0 + 0.004);
      g.gain.setTargetAtTime(0, t0 + 0.01, 0.5);
      car.start(t0); modu.start(t0); car.stop(t0 + 3); modu.stop(t0 + 3);
      stopAt = t0 + 3;
    }
    let node = g;
    if (opts.pan) { const p = ctx.createStereoPanner(); p.pan.value = opts.pan; node = g.connect(p); }
    node.connect(opts.out || this.out);
    const wetDest = opts.out ? opts.wetOut : this.wetOut;
    if (wetDest && wetFor(midi) > 0) { const wg = ctx.createGain(); wg.gain.value = wetFor(midi); g.connect(wg).connect(wetDest); }
    if (opts.record !== false) Recorder.note(this.key, midi, vel, when, d);
    return [{ end: stopAt }];
  }
  stopAll() {}
}

// Loads instruments.json's files: `fetchBytes(path)` gives an ArrayBuffer (a URL fetch, or the offline build's
// embedded data). Instruments load on demand, the piano first.
class Library {
  constructor(index, fetchBytes) { this.index = index; this.fetchBytes = fetchBytes; this.buffers = {}; this.loading = {}; this.progress = {}; }
  async load(key, ctx, onProgress) {
    if (this.loading[key]) return this.loading[key];
    const def = this.index[key];
    if (!def) return null;
    const files = def.kind === "kit" ? Object.values(def.pieces).flatMap(p => p.layers.map(l => l.file)) : def.zones.map(z => z.file);
    let done = 0;
    const run = async () => {
      const queue = files.slice();
      const worker = async () => {
        while (queue.length) {
          const f = queue.shift();
          try {
            const bytes = await this.fetchBytes("samples/" + f);
            this.buffers[f] = await ctx.decodeAudioData(bytes);
          } catch (e) { console.warn("sample", f, e); }
          done++;
          this.progress[key] = done / files.length;
          if (onProgress) onProgress(key, done, files.length);
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
      return def;
    };
    this.loading[key] = run();
    return this.loading[key];
  }
  ready(key) { return this.progress[key] === 1; }
}

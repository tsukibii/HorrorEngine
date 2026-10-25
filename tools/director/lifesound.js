// The little things' sounds (docs/IMMERSION.md §3), made in the browser with Web Audio: no files, nothing fetched.
// A state's `sound` plays while it lasts (the kettle's rumble rising, a hob's hum, a clock's tick, a tap running, a
// phone ringing), its `enter` once as it starts (a click, a beep, the igniter, the rice cooker's tune). Each is placed
// where its thing is (a panner each, the listener at the camera), so it's quieter across the room and comes from its
// side. In Unreal they become the game's own sounds (the life's Blueprint).
//   const s = new LifeSound(); s.update(T, [{id, pos: Vector3, st, hist, def}], camera)   every frame; s.stop()
export const SOUNDS = ["switch", "kettle", "kettle_boil", "click", "whistle", "sing", "beep", "hum", "igniter", "gas", "bubble", "boil", "pour",
  "crackle", "flick", "blow", "tick", "tune", "ring", "water", "drip", "static", "murmur"];
const LOOPS = new Set(["kettle", "kettle_boil", "whistle", "sing", "hum", "gas", "bubble", "boil", "pour", "crackle", "tick", "ring", "water", "drip", "static", "murmur"]);
const lvl = (v, age, secs) => Array.isArray(v) ? v[0] + (v[1] - v[0]) * Math.max(0, Math.min(1, secs ? age / secs : 0)) : v ?? 1;

let NOISE = null;
function noiseBuf(ctx) {                               // two seconds of white noise, and brown (integrated) beside it
  if (NOISE && NOISE.ctx === ctx) return NOISE;
  const n = ctx.sampleRate * 2, w = ctx.createBuffer(1, n, ctx.sampleRate), b = ctx.createBuffer(1, n, ctx.sampleRate);
  const W = w.getChannelData(0), B = b.getChannelData(0); let last = 0, seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };
  for (let i = 0; i < n; i++) { W[i] = rnd(); last = (last + 0.02 * W[i]) / 1.02; B[i] = last * 3.5; }
  return (NOISE = { ctx, white: w, brown: b });
}
function src(ctx, kind = "white") { const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx)[kind]; s.loop = true; s.loopStart = Math.random(); s.start(); return s; }
function filt(ctx, type, f, q = 0.7) { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; }
function gain(ctx, g) { const x = ctx.createGain(); x.gain.value = g; return x; }
function chain(...ns) { for (let i = 0; i + 1 < ns.length; i++) ns[i].connect(ns[i + 1]); return ns[ns.length - 1]; }
function blip(ctx, out, t, f0, f1, dur, g, type = "sine") {   // a short tone that slides: a bubble, a plink, a beep
  const o = ctx.createOscillator(), e = ctx.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + Math.min(0.008, dur / 4)); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(e).connect(out); o.start(t); o.stop(t + dur + 0.02);
}
function burst(ctx, out, t, dur, f, g, type = "bandpass", q = 1) {   // a short noise: a click, a tick, a breath
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx).white; const x = filt(ctx, type, f, q), e = ctx.createGain();
  e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(x).connect(e).connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.02);
}

// ---- the loops: each builds into `out` and returns {set(level, age, p), tick(now), stop()} ---------------------------
export const LOOP = {
  kettle(ctx, out) {                                   // the rumble as it heats: brown noise, its low band opening up
    const n = src(ctx, "brown"), lp = filt(ctx, "lowpass", 300, 0.8), bp = filt(ctx, "peaking", 250, 1.2), g = gain(ctx, 0);
    bp.gain.value = 8; chain(n, lp, bp, g, out);
    return { set(l) { g.gain.setTargetAtTime(0.5 * l, ctx.currentTime, 0.3); lp.frequency.setTargetAtTime(220 + 900 * l, ctx.currentTime, 0.4); }, stop() { n.stop(); } };
  },
  kettle_boil(ctx, out) {                              // the roar at the boil: a bright band, fluttering with bubbles
    const n = src(ctx), bp = filt(ctx, "bandpass", 1300, 0.6), lp = filt(ctx, "lowpass", 3500), am = gain(ctx, 0.5), g = gain(ctx, 0);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 17; const lg = gain(ctx, 0.25); lfo.connect(lg).connect(am.gain); lfo.start();
    chain(n, bp, lp, am, g, out);
    return { set(l) { g.gain.setTargetAtTime(0.55 * l, ctx.currentTime, 0.2); }, stop() { n.stop(); lfo.stop(); } };
  },
  whistle(ctx, out) {                                  // two pipes beating, climbing as it goes on, a breath under them
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = gain(ctx, 0), br = src(ctx), bp = filt(ctx, "bandpass", 2300, 4), bg = gain(ctx, 0.15);
    o1.frequency.value = 2050; o2.frequency.value = 2310; const vib = ctx.createOscillator(), vg = gain(ctx, 18); vib.frequency.value = 5.5; vib.connect(vg); vg.connect(o1.frequency); vg.connect(o2.frequency); vib.start();
    o1.connect(g); o2.connect(g); chain(br, bp, bg, g); g.connect(out); o1.start(); o2.start();
    return { set(l, age) { const k = Math.min(1, age / 6); g.gain.setTargetAtTime(0.09 * l * k, ctx.currentTime, 0.4); o1.frequency.setTargetAtTime(2050 + 220 * k, ctx.currentTime, 0.5); o2.frequency.setTargetAtTime(2310 + 240 * k, ctx.currentTime, 0.5); },
      stop() { o1.stop(); o2.stop(); vib.stop(); br.stop(); } };
  },
  sing(ctx, out) {                                     // a tetsubin's song (matsukaze, wind in the pines): a soft breathy hiss
    const n = src(ctx), bp = filt(ctx, "bandpass", 2800, 2), g = gain(ctx, 0), am = gain(ctx, 0.6), lfo = ctx.createOscillator(), lg = gain(ctx, 0.35);
    lfo.frequency.value = 0.3; lfo.connect(lg).connect(am.gain); lfo.start(); chain(n, bp, am, g, out);
    return { set(l) { g.gain.setTargetAtTime(0.22 * l, ctx.currentTime, 0.5); }, stop() { n.stop(); lfo.stop(); } };
  },
  hum(ctx, out) {                                      // mains hum: 100 Hz and its harmonic, a little hiss
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = gain(ctx, 0); o.frequency.value = 100; o2.frequency.value = 200;
    const g2 = gain(ctx, 0.4); o.connect(g); o2.connect(g2).connect(g); g.connect(out); o.start(); o2.start();
    return { set(l) { g.gain.setTargetAtTime(0.035 * l, ctx.currentTime, 0.3); }, stop() { o.stop(); o2.stop(); } };
  },
  gas(ctx, out) {                                      // a gas ring: the hiss and a soft low roar
    const n = src(ctx), hp = filt(ctx, "highpass", 1800), g1 = gain(ctx, 0.25), n2 = src(ctx, "brown"), lp = filt(ctx, "lowpass", 260), g2 = gain(ctx, 0.6), g = gain(ctx, 0);
    chain(n, hp, g1, g); chain(n2, lp, g2, g); g.connect(out);
    return { set(l) { g.gain.setTargetAtTime(0.4 * l, ctx.currentTime, 0.2); }, stop() { n.stop(); n2.stop(); } };
  },
  bubble(ctx, out) {                                   // simmering: bloops now and then over a low wash
    const n = src(ctx, "brown"), lp = filt(ctx, "lowpass", 500), g = gain(ctx, 0); chain(n, lp, g, out); let l = 0, next = 0;
    return { set(x) { l = x; g.gain.setTargetAtTime(0.25 * x, ctx.currentTime, 0.3); },
      tick(now) { while (l > 0.02 && next < now + 0.1) { next = Math.max(next, now) + (0.04 + Math.random() * 0.4) / (0.3 + l); blip(ctx, out, next, 380 + Math.random() * 500, 160 + Math.random() * 120, 0.05 + Math.random() * 0.05, 0.12 * l); } },
      stop() { n.stop(); } };
  },
  boil(ctx, out) {                                     // a rolling boil, the lid's clinks
    const b = LOOP.bubble(ctx, out); let next = 0; b.set(1);
    return { set(l) { b.set(l); }, tick(now) { b.tick(now); while (next < now + 0.1) { next = Math.max(next, now) + 0.15 + Math.random() * 0.5; blip(ctx, out, next, 3200 + Math.random() * 900, 2800, 0.04, 0.05, "triangle"); } }, stop() { b.stop(); } };
  },
  pour(ctx, out) {                                     // pouring: a band of noise whose pitch climbs as the cup fills
    const n = src(ctx), bp = filt(ctx, "bandpass", 500, 3), g = gain(ctx, 0), am = gain(ctx, 0.7), lfo = ctx.createOscillator(), lg = gain(ctx, 0.3);
    lfo.frequency.value = 11; lfo.connect(lg).connect(am.gain); lfo.start(); chain(n, bp, am, g, out);
    return { set(l, age, p) { g.gain.setTargetAtTime(0.5 * l, ctx.currentTime, 0.08); bp.frequency.setTargetAtTime(480 + 1100 * (p || 0), ctx.currentTime, 0.1); }, stop() { n.stop(); lfo.stop(); } };
  },
  crackle(ctx, out) {                                  // paper burning: tiny clicks
    let l = 0, next = 0;
    return { set(x) { l = x; }, tick(now) { while (l > 0 && next < now + 0.1) { next = Math.max(next, now) + 0.05 + Math.random() * 0.6; burst(ctx, out, next, 0.006, 4000, 0.4 * l, "highpass"); } }, stop() { } };
  },
  tick(ctx, out) {                                     // a clock: tick, tock, every second
    let next = 0, k = 0, l = 1;
    return { set(x) { l = x; }, tick(now) { while (next < now + 0.1) { next = Math.max(next, Math.ceil(now)); burst(ctx, out, next, 0.014, k++ % 2 ? 2400 : 3000, 1.4 * l, "bandpass", 6); next += 1; } }, stop() { } };
  },
  ring(ctx, out) {                                     // a phone ringing: a marimba figure, a pause, again; the buzz under it
    let next = 0, l = 1; const notes = [659.3, 784, 987.8, 1318.5, 987.8, 784];
    return { set(x) { l = x; }, tick(now) {
      while (next < now + 0.2) {
        next = Math.max(next, now);
        notes.forEach((f, i) => { blip(ctx, out, next + i * 0.13, f, f * 0.995, 0.22, 0.12 * l); blip(ctx, out, next + i * 0.13, f * 4, f * 4, 0.05, 0.02 * l); });
        const o = ctx.createOscillator(), e = ctx.createGain(); o.type = "square"; o.frequency.value = 160; e.gain.setValueAtTime(0.025 * l, next); e.gain.setValueAtTime(0, next + 0.9);
        o.connect(filt(ctx, "lowpass", 400)).connect(e).connect(out); o.start(next); o.stop(next + 1);
        next += 2.2;
      } }, stop() { } };
  },
  water(ctx, out) {                                    // a tap running into a sink
    const n = src(ctx), bp = filt(ctx, "bandpass", 1500, 0.5), lp = filt(ctx, "lowpass", 5000), am = gain(ctx, 0.8), lfo = ctx.createOscillator(), lg = gain(ctx, 0.15), g = gain(ctx, 0);
    lfo.frequency.value = 7; lfo.connect(lg).connect(am.gain); lfo.start(); chain(n, bp, lp, am, g, out);
    return { set(l) { g.gain.setTargetAtTime(0.45 * l, ctx.currentTime, 0.2); }, stop() { n.stop(); lfo.stop(); } };
  },
  drip(ctx, out) {                                     // a drop landing every few seconds: a plink, when the desk's drop lands
    let done = -1, every = 2.6, l = 1;
    return { set(x, age, p, def) { l = x; every = +((def || {}).every || 2.6); },
      tick(now, T) { const n = Math.floor((T - 1.05) / every) + 1, at = n * every + 1.05; if (n !== done && at - T < 0.15) { done = n; blip(ctx, out, now + Math.max(0, at - T), 1900, 850, 0.09, 0.22 * l); } }, stop() { } };
  },
  static(ctx, out) {                                   // a TV's snow: hiss
    const n = src(ctx), hp = filt(ctx, "highpass", 900), g = gain(ctx, 0); chain(n, hp, g, out);
    return { set(l) { g.gain.setTargetAtTime(0.16 * l, ctx.currentTime, 0.1); }, stop() { n.stop(); } };
  },
  murmur(ctx, out) {                                   // a programme from across the room: voices you can't make out
    const n = src(ctx), bp = filt(ctx, "bandpass", 420, 1.5), bp2 = filt(ctx, "peaking", 1100, 2), am = gain(ctx, 0), g = gain(ctx, 0); bp2.gain.value = 5; chain(n, bp, bp2, am, g, out);
    let next = 0;
    return { set(l) { g.gain.setTargetAtTime(0.4 * l, ctx.currentTime, 0.2); }, tick(now) { while (next < now + 0.2) { next = Math.max(next, now); const d = 0.1 + Math.random() * 0.25; am.gain.setTargetAtTime(Math.random() < 0.2 ? 0 : 0.4 + Math.random() * 0.6, next, 0.03); bp.frequency.setTargetAtTime(300 + Math.random() * 300, next, 0.05); next += d; } }, stop() { n.stop(); } };
  },
};
// ---- the one-shots: played into `out` at time t -------------------------------------------------------------------
export const ONCE = {
  click(ctx, out, t) { burst(ctx, out, t, 0.008, 3000, 0.7, "highpass"); blip(ctx, out, t, 140, 70, 0.05, 0.3); },
  switch(ctx, out, t) { burst(ctx, out, t, 0.006, 2500, 0.45, "highpass"); blip(ctx, out, t + 0.01, 120, 80, 0.03, 0.15); },
  beep(ctx, out, t) { blip(ctx, out, t, 2800, 2790, 0.12, 0.12, "sine"); },
  igniter(ctx, out, t) { for (let i = 0; i < 6; i++) burst(ctx, out, t + i * 0.12, 0.01, 3500, 0.5, "highpass"); burst(ctx, out, t + 0.75, 0.35, 300, 0.4, "lowpass"); },
  flick(ctx, out, t) { burst(ctx, out, t, 0.01, 3200, 0.6, "highpass"); burst(ctx, out, t + 0.02, 0.18, 900, 0.25, "bandpass", 0.8); },
  blow(ctx, out, t) { burst(ctx, out, t, 0.35, 650, 0.5, "bandpass", 0.7); },
  pour(ctx, out, t) { burst(ctx, out, t, 1.2, 800, 0.3, "bandpass", 2); },
  tune(ctx, out, t) {                                  // the rice cooker's little done tune (ours: up and back down)
    [[784, 0], [988, 0.18], [1175, 0.36], [1568, 0.54], [1175, 0.8], [1568, 0.98]].forEach(([f, d]) => blip(ctx, out, t + d, f, f, 0.24, 0.09, "square"));
  },
};

export class LifeSound {
  constructor() { this.ctx = null; this.master = null; this.voices = {}; this.seen = {}; this.lastT = null; this.volume = 0.8; }
  ready() {
    if (this.ctx) return this.ctx.state !== "closed";
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
    const wake = () => { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); };   // a browser starts sound on a gesture
    window.addEventListener("pointerdown", wake); window.addEventListener("keydown", wake); wake();
    return true;
  }
  panner(pos) {
    const p = this.ctx.createPanner(); p.panningModel = "equalpower"; p.distanceModel = "inverse"; p.refDistance = 0.7; p.rolloffFactor = 1.3;
    p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; p.connect(this.master); return p;
  }
  // items: [{id, pos, st, hist, def (the life)}]; T the run's time; camera the listener
  update(T, items, camera) {
    if (!this.ready()) return;
    const ctx = this.ctx, now = ctx.currentTime, L = ctx.listener;
    if (camera) {
      const f = camera.getWorldDirection(camera.position.clone()), p = camera.position;      // (a spare vector for the direction)
      if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
      else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
    }
    const back = this.lastT !== null && T < this.lastT - 0.25; this.lastT = T;
    const want = new Set();
    for (const it of items) {
      const sd = it.st && it.st.def; if (!sd) continue;
      for (const s of sd.sound || []) {
        if (!LOOP[s.sound]) continue;
        const key = it.id + ":" + s.sound; want.add(key);
        let v = this.voices[key];
        if (!v) { const pan = this.panner(it.pos); v = this.voices[key] = { pan, loop: LOOP[s.sound](ctx, pan) }; }
        v.pan.positionX.value = it.pos.x; v.pan.positionY.value = it.pos.y; v.pan.positionZ.value = it.pos.z;
        v.loop.set(lvl(s.level, it.st.age, s.secs ?? it.st.secs), it.st.age, it.st.p, s);
        if (v.loop.tick) v.loop.tick(now, T);
      }
      // what started since the last frame: its `enter` sounds, once (not when the playhead goes back)
      const hist = it.hist || [], n0 = this.seen[it.id] ?? hist.length;
      if (!back) for (const h of hist.slice(n0)) if (T - h.t < 1) {
        const hd = (it.def.states || []).find(x => x.id === h.state);
        for (const e of (hd && hd.enter) || []) if (ONCE[e.sound]) ONCE[e.sound](ctx, this.voices[it.id + ":pan"] || (this.voices[it.id + ":pan"] = this.panner(it.pos)), now + 0.02);
      }
      this.seen[it.id] = hist.length;
    }
    for (const [key, v] of Object.entries(this.voices)) {
      if (!v.loop || want.has(key)) continue;
      try { v.loop.stop(); } catch (e) { }
      v.pan.disconnect(); delete this.voices[key];
    }
  }
  stop() {
    for (const v of Object.values(this.voices)) { try { if (v.loop) v.loop.stop(); (v.pan || v).disconnect(); } catch (e) { } }
    this.voices = {}; this.seen = {}; this.lastT = null;
  }
}

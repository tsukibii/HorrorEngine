// The audio graph: one channel per instrument (level, pan, reverb send) into the music bus, a hall for where the
// listener stands (SPACES: made from a two-bounce trace, no impulse files), a glue compressor and a limiter; the
// game's ambience beds on their own bus beside the music. Works on a live AudioContext or an OfflineAudioContext
// (renders to WAV).
"use strict";

class Mixer {
  constructor(ctx) {
    this.ctx = ctx;
    this.channels = {};
    // the music bus: warmth (a gentle high shelf), glue, make-up
    this.music = ctx.createGain();
    this.duck = ctx.createGain();                      // stingers dip the scene under them
    const shelf = ctx.createBiquadFilter();
    shelf.type = "highshelf"; shelf.frequency.value = 9500; shelf.gain.value = -1.5;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20; glue.knee.value = 12; glue.ratio.value = 2.2; glue.attack.value = 0.03; glue.release.value = 0.3;
    const makeup = ctx.createGain(); makeup.gain.value = dbToGain(6);
    this.music.connect(this.duck).connect(shelf).connect(glue).connect(makeup);
    // the reverb: a send bus, high-passed, into the hall of the space the listener stands in; two convolvers, so a
    // new space's hall crossfades in while the old one fades (setSpace)
    this.verbIn = ctx.createGain();
    this.verbOut = ctx.createGain(); this.verbOut.gain.value = dbToGain(-3);
    // no boomy tails: the reverb hears nothing under about 260 Hz (two high-passes, 24 dB an octave), and the low notes
    // barely reach it in the first place (each note's send falls with its pitch: Sampler, wetFor)
    const verbHp = ctx.createBiquadFilter(); verbHp.type = "highpass"; verbHp.frequency.value = 260; verbHp.Q.value = 0.707;
    const verbHp2 = ctx.createBiquadFilter(); verbHp2.type = "highpass"; verbHp2.frequency.value = 260; verbHp2.Q.value = 0.707;
    this.verbIn.connect(verbHp).connect(verbHp2);
    this.verbs = [0, 1].map(() => {
      const conv = ctx.createConvolver(); conv.normalize = false;      // the hall's level is its own (makeHallFor)
      const gain = ctx.createGain(); gain.gain.value = 0;
      verbHp2.connect(conv).connect(gain).connect(this.verbOut);
      return { conv, gain };
    });
    this.verbNext = 0; this.verbStamp = 0;
    this.verbOut.connect(this.duck);
    // stingers sit over the scene: their own bus after the duck, with a send of their own
    this.stingers = ctx.createGain(); this.stingers.gain.value = dbToGain(-2);
    this.stingersWet = ctx.createGain(); this.stingersWet.gain.value = dbToGain(-2) * 0.35;   // their notes' sends
    this.stingers.connect(shelf);
    this.stingersWet.connect(verbHp);
    // ambience beds bypass the glue (they shouldn't pump the music)
    this.amb = ctx.createGain(); this.amb.gain.value = dbToGain(-6);
    // the sum: limiter, master level, a meter
    this.sum = ctx.createGain();
    makeup.connect(this.sum); this.amb.connect(this.sum);
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
    this.master = ctx.createGain(); this.master.gain.value = dbToGain(-3);
    this.meter = ctx.createAnalyser(); this.meter.fftSize = 2048;
    this.sum.connect(limiter).connect(this.master);
    this.master.connect(this.meter);
    this.master.connect(ctx.destination);
    this.setSpace("meadow", 0, 0);
  }

  // The hall for where the listener stands (SPACES, musicHall): the idle convolver gets the new hall and the sound
  // crossfades into it over `fade` s; the old hall is dropped after (an empty convolver costs nothing).
  setSpace(id, at = this.ctx.currentTime, fade = 1.5) {
    if (!SPACES[id]) id = "meadow";
    if (this.space === id) return this.hall;
    const hall = musicHall(id);
    const next = this.verbs[this.verbNext], prev = this.verbs[this.verbNext ^ 1];
    this.verbNext ^= 1;
    next.conv.buffer = makeHallFor(this.ctx, hall);
    const now = Math.max(at, this.ctx.currentTime);
    if (!fade || this.space === undefined) { next.gain.gain.setValueAtTime(1, now); prev.gain.gain.setValueAtTime(0, now); }
    else {
      next.gain.gain.setTargetAtTime(1, now, fade / 3); prev.gain.gain.setTargetAtTime(0, now, fade / 3);
      if (this.ctx.constructor.name !== "OfflineAudioContext") {
        const stamp = ++this.verbStamp;
        setTimeout(() => { if (this.verbStamp === stamp) prev.conv.buffer = null; }, (fade + 0.8) * 1000);
      }
    }
    this.space = id; this.hall = hall;
    return hall;
  }

  // A channel per instrument: level (dB), pan (-1..1), reverb send (0..1). Notes reach it twice: dry into `input`,
  // and into `wetIn` scaled by their pitch (low notes stay dry), which feeds the shared hall through `send`.
  channel(name, opts = {}) {
    if (this.channels[name]) return this.channels[name];
    const ctx = this.ctx;
    const ch = { name, input: ctx.createGain(), wetIn: ctx.createGain(), level: ctx.createGain(), wetLevel: ctx.createGain(),
      pan: ctx.createStereoPanner(), send: ctx.createGain() };
    ch.input.connect(ch.level).connect(ch.pan).connect(this.music);
    ch.wetIn.connect(ch.wetLevel).connect(ch.send).connect(this.verbIn);
    ch.level.gain.value = ch.wetLevel.gain.value = dbToGain(opts.db ?? 0);
    ch.pan.pan.value = opts.pan ?? 0;
    ch.send.gain.value = opts.send ?? 0.3;
    ch.db = opts.db ?? 0;
    this.channels[name] = ch;
    return ch;
  }

  setChannel(name, { db, pan, send }, at = this.ctx.currentTime, glide = 0.4) {
    const ch = this.channel(name);
    if (db !== undefined) { ch.db = db; ch.level.gain.setTargetAtTime(dbToGain(db), at, glide / 3); ch.wetLevel.gain.setTargetAtTime(dbToGain(db), at, glide / 3); }
    if (pan !== undefined) ch.pan.pan.setTargetAtTime(pan, at, glide / 3);
    if (send !== undefined) ch.send.gain.setTargetAtTime(send, at, glide / 3);
  }

  // Dips the whole music bus (a stinger over the scene), then brings it back.
  duckFor(db, at, hold, release = 0.8) {
    const g = this.duck.gain;
    g.cancelScheduledValues(at);
    g.setTargetAtTime(dbToGain(db), at, 0.04);
    g.setTargetAtTime(1, at + hold, release / 3);
  }

  level() {
    const a = new Float32Array(this.meter.fftSize);
    this.meter.getFloatTimeDomainData(a);
    let peak = 0, ss = 0;
    for (const x of a) { peak = Math.max(peak, Math.abs(x)); ss += x * x; }
    return { peak: gainToDb(peak), rms: gainToDb(Math.sqrt(ss / a.length)) };
  }
}

// ---- where the listener stands: the music's hall from a simplified version of the game's sound physics ----
// The game (game/audio/acoustics.gd, acoustics.json) sends 32 rays from every sound and follows each through four
// bounces, for that sound's rendered tails. Music isn't placed in the world, so its hall stands for where the
// listener is: a box of six faces (the ground, the sky or a ceiling, four walls; a face can be open), each at a
// distance with a material. Two bounces do for music: the first reflections come from the image sources of the
// first and second order (the ground's slap, a wall, a corner; the tree line's faint echo), and what 64 rays still
// hold after two bounces (how many are still boxed in, times what the faces kept) sets the tail: its decay from the
// mean free path and the loss a bounce, its level from the energy left (to the power 0.5, as the game's slot gains).
// Outdoors the production hall (the one under BotW's field piano) stays beneath; indoors the space rules. A space
// is traced in a few milliseconds, once, when it changes (Mixer.setSpace), and its hall is a few seconds of stereo
// samples: a convolver costs about 1% of one core, nothing of the graphics card.
const SPACE_MATERIALS = {   // keep: the energy a bounce keeps (the game's reflect, as a share); dark: how much sooner the highs die; pass: lets sound through (leaves)
  stone: { keep: 0.9, dark: 0.15 }, metal: { keep: 0.9, dark: 0.1 }, water: { keep: 0.8, dark: 0.3 },
  wood: { keep: 0.8, dark: 0.5 }, earth: { keep: 0.55, dark: 0.6 }, grass: { keep: 0.5, dark: 0.7 },
  sand: { keep: 0.45, dark: 0.65 }, cloth: { keep: 0.3, dark: 0.85 }, foliage: { keep: 0.3, dark: 0.8, pass: 0.6 },
};
// A face: [material, metres away], or null for open. walls: right, left, ahead, behind. The ground is 1.6 m under
// the ears; under an open sky the walls reach `top` m up (sound escapes over them).
const SPACES = {
  meadow: { name: "Meadow", desc: "open grass, a tree line far off", floor: ["grass", 1.6], sky: null, top: 14, walls: [["foliage", 30], ["foliage", 44], ["foliage", 36], ["foliage", 60]] },
  forest: { name: "Forest", desc: "trunks and leaves all round", floor: ["earth", 1.6], sky: ["foliage", 8], walls: [["foliage", 5], ["foliage", 7], ["foliage", 6], ["foliage", 9]] },
  shore: { name: "Shore", desc: "sand and the sea, a cliff behind", floor: ["sand", 1.6], sky: null, top: 30, walls: [null, null, null, ["stone", 24]] },
  sea: { name: "At sea", desc: "water all round, nothing comes back", floor: ["water", 1.6], sky: null, top: 0, walls: [null, null, null, null] },
  village: { name: "Village", desc: "huts round a square, open sky", floor: ["earth", 1.6], sky: null, top: 5, walls: [["wood", 7], ["wood", 9], ["stone", 12], ["wood", 16]] },
  hut: { name: "Hut", desc: "a small wooden room", floor: ["wood", 1.6], sky: ["wood", 1.2], walls: [["wood", 2.2], ["cloth", 2.6], ["wood", 1.8], ["wood", 3.2]] },
  hall: { name: "Great hall", desc: "stone walls, a high wooden roof", floor: ["stone", 1.6], sky: ["wood", 9], walls: [["stone", 8], ["stone", 9], ["stone", 15], ["stone", 19]] },
  cave: { name: "Cave", desc: "a big rock chamber", floor: ["stone", 1.6], sky: ["stone", 8], walls: [["stone", 7], ["stone", 13], ["stone", 10], ["stone", 24]] },
  // HorrorStudio's rooms (a house at night): where the score can sit when it's played in the space
  room: { name: "Small room", desc: "a bedroom: plaster, a bed, curtains", floor: ["wood", 1.6], sky: ["stone", 1.0], walls: [["stone", 1.8], ["cloth", 2.2], ["stone", 2.5], ["cloth", 1.6]] },
  corridor: { name: "Hallway", desc: "a long narrow house corridor", floor: ["wood", 1.6], sky: ["stone", 1.0], walls: [["stone", 0.6], ["stone", 0.7], ["wood", 9], ["stone", 5]] },
  basement: { name: "Basement", desc: "concrete, low ceiling, boxes", floor: ["stone", 1.6], sky: ["stone", 0.8], walls: [["stone", 3], ["stone", 4], ["stone", 5], ["wood", 3.5]] },
  closet: { name: "Closet", desc: "hiding among coats: close and muffled", floor: ["wood", 1.6], sky: ["wood", 0.5], walls: [["cloth", 0.4], ["cloth", 0.5], ["wood", 0.5], ["cloth", 0.3]] },
  dungeon: { name: "Dungeon", desc: "a narrow stone corridor", floor: ["stone", 1.6], sky: ["stone", 1.9], walls: [["stone", 1.3], ["stone", 1.7], ["stone", 14], ["stone", 26]] },
};
// The hall under the field piano outdoors (BotW's music carries its own): a 2.4 s tail and a few early reflections
// of its own, a room's worth, as the page had before the spaces.
const PRODUCTION_HALL = { t60: 2.4, level: 1, dark: 0.45, predelay: 0.022,
  taps: [[0.009, 0.14, -0.3], [0.014, 0.12, 0.45], [0.023, 0.1, -0.6], [0.031, 0.09, 0.2], [0.044, 0.07, 0.7], [0.058, 0.06, -0.5], [0.074, 0.05, 0.1]] };
const TAIL_ENERGY = 0.1;   // the production tail's energy a channel (the sum of its squares) at a level of 1
const SOUND_SPEED = 343;

// The present faces as planes: axis (0 x, 1 y, 2 z), sign, distance, material.
function spaceFaces(space) {
  const out = [];
  const add = (axis, sign, face) => { if (face) out.push({ axis, sign, d: face[1], mat: SPACE_MATERIALS[face[0]], name: face[0] }); };
  add(1, -1, space.floor); add(1, 1, space.sky);
  add(0, 1, space.walls[0]); add(0, -1, space.walls[1]); add(2, 1, space.walls[2]); add(2, -1, space.walls[3]);
  return out;
}
// n directions spread evenly over the sphere (Fibonacci, as the game's).
function sphereDirections(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5));
    out.push([r * Math.cos(a), y, r * Math.sin(a)]);
  }
  return out;
}
// Traces a space: the first reflections (image sources of two orders) and the tail (64 rays, two bounces). Returns
// the hall: t60 (s), level (0..1, the tail's), dark (0..1), predelay (s), taps [{t, gain, pan}], openness (the
// share of rays that got away) and `space` (the box's own numbers before the production hall is blended under).
function traceSpace(space, rays = 64, bounces = 2) {
  const faces = spaceFaces(space);
  const top = space.sky ? space.sky[1] : (space.top ?? 14), bottom = -space.floor[1];
  const rng = makeRng(99);
  // where a ray from p along dir meets a face: the nearest plane ahead, if the hit is within the walls' height
  const hit = (p, dir) => {
    let best = null;
    for (const f of faces) {
      const den = dir[f.axis];
      if (Math.abs(den) < 1e-9) continue;
      const t = (f.sign * f.d - p[f.axis]) / den;
      if (t > 1e-6 && (!best || t < best.t)) best = { t, f };
    }
    if (!best) return null;
    const q = [0, 1, 2].map(k => p[k] + dir[k] * best.t);
    if (best.f.axis !== 1 && (q[1] > top + 1e-6 || q[1] < bottom - 1e-6)) return null;    // over the wall: the sky
    return { q, f: best.f, t: best.t };
  };
  let inside = 0, energy = 0, path = 0, hits = 0, dark = 0, darkW = 0;
  for (const d0 of sphereDirections(rays)) {
    let p = [0, 0, 0], dir = d0.slice(), e = 1, kept = true;
    for (let b = 0; b < bounces; b++) {
      const h = hit(p, dir);
      if (!h || (h.f.mat.pass && rng.next() < h.f.mat.pass)) { kept = false; break; }   // got away (or through the leaves)
      hits++; path += h.t; e *= h.f.mat.keep; dark += h.f.mat.dark * e; darkW += e;
      const ax = h.f.axis, back = -Math.sign(dir[ax]);
      dir[ax] = -dir[ax];
      if (h.f.mat.pass) {                                       // leaves scatter: the bounce goes somewhere near
        for (let k = 0; k < 3; k++) dir[k] += (rng.next() - 0.5) * 0.8;
        if (Math.sign(dir[ax]) !== back) dir[ax] = -dir[ax];
        const n = Math.hypot(dir[0], dir[1], dir[2]); dir = dir.map(v => v / n);
      }
      p = h.q;
    }
    if (kept) { inside++; energy += e; }
  }
  const meanE = energy / rays;                                      // the energy left after the bounces, over every ray
  const survive = Math.pow(Math.max(meanE, 1e-4), 1 / bounces);     // a bounce's share (the game's bounce_reflect with its enclosure share)
  const mfp = hits ? path / hits : 60;                              // the mean free path (m)
  const own = { t60: clamp(-6 / Math.log10(clamp(survive, 0.02, 0.97)) * mfp / SOUND_SPEED, 0.08, 6),
    level: Math.sqrt(meanE), dark: darkW ? dark / darkW : 0.5, mfp, predelay: clamp(mfp / SOUND_SPEED, 0.005, 0.06) };
  const openness = 1 - inside / rays;
  // the first reflections: the image sources of the first order (each face) and the second (pairs of faces)
  const taps = [];
  const image = (p, f) => { const q = p.slice(); q[f.axis] = 2 * f.sign * f.d - p[f.axis]; return q; };
  const tap = (q, gain, mats) => {
    const dist = Math.hypot(q[0], q[1], q[2]);
    if (gain / dist < 0.003) return;                                // under -50 dB: not heard
    const t = dist / SOUND_SPEED, pan = clamp(q[0] / dist, -1, 1) * 0.85;
    if (mats.some(m => m.pass)) { for (let k = 0; k < 4; k++) taps.push({ t: t * (1 + (rng.next() - 0.5) * 0.25), gain: gain / dist / 2, pan: clamp(pan + (rng.next() - 0.5) * 0.5, -1, 1) }); }
    else taps.push({ t, gain: gain / dist, pan });
  };
  for (const f of faces) tap(image([0, 0, 0], f), f.mat.keep, [f.mat]);
  const seen = new Set();
  for (const f of faces) for (const g of faces) {
    if (f === g) continue;
    const q = image(image([0, 0, 0], f), g), key = q.map(v => v.toFixed(2)).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    tap(q, f.mat.keep * g.mat.keep, [f.mat, g.mat]);
  }
  const w = Math.sqrt(openness);                                     // open sky: the production hall stays beneath
  for (const [t, gain, pan] of PRODUCTION_HALL.taps) if (w > 0.05) taps.push({ t, gain: gain * w, pan });
  taps.sort((a, b) => a.t - b.t);
  return { t60: lerp(own.t60, PRODUCTION_HALL.t60, w), level: lerp(own.level, PRODUCTION_HALL.level, w), dark: lerp(own.dark, PRODUCTION_HALL.dark, w),
    predelay: lerp(own.predelay, PRODUCTION_HALL.predelay, w), taps, openness, space: own };
}
// A space's hall, worked out once (change SPACES or SPACE_MATERIALS in the console, then clear musicHall.cache).
function musicHall(id) {
  musicHall.cache = musicHall.cache || {};
  if (!musicHall.cache[id]) musicHall.cache[id] = Object.assign({ id, name: SPACES[id].name }, traceSpace(SPACES[id]));
  return musicHall.cache[id];
}

// The hall as an impulse: the first reflections as taps, each from its side, then a tail of noise (decorrelated left
// and right, decaying to -60 dB at t60, its highs closing sooner the darker the space). The tail's energy is set in
// absolute terms (the convolver doesn't normalise): TAIL_ENERGY at a level of 1, a longer tail a little more (a
// cave's air holds more sound), a short one less.
function makeHallFor(ctx, hall) {
  const sr = ctx.sampleRate;
  const last = hall.taps.length ? hall.taps[hall.taps.length - 1].t : 0;
  const len = Math.floor(sr * Math.max(hall.predelay + hall.t60 * 1.05 + 0.1, last + 0.05));
  const buf = ctx.createBuffer(2, len, sr);
  const pre = Math.floor(hall.predelay * sr);
  const a0 = lerp(0.92, 0.5, hall.dark), a1 = lerp(0.25, 0.04, hall.dark);
  let e = 0;
  for (let ch = 0; ch < 2; ch++) {
    const rng = makeRng(1234 + ch * 777), d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const env = Math.exp(-6.91 * t / hall.t60) * Math.min(1, t / 0.004);
      lp += lerp(a0, a1, Math.min(1, t / hall.t60)) * ((rng.next() * 2 - 1) - lp);
      d[i] = lp * env;
      e += d[i] * d[i];
    }
  }
  const want = TAIL_ENERGY * hall.level * hall.level * Math.sqrt(hall.t60 / PRODUCTION_HALL.t60);
  const g = Math.sqrt(want / Math.max(e / 2, 1e-9));
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = pre; i < len; i++) d[i] *= g; }
  const rng = makeRng(4321);
  for (const tp of hall.taps) {
    const i = Math.floor(tp.t * sr);
    if (i + 1 >= len) continue;
    const s = rng.next() < 0.5 ? -1 : 1, th = (tp.pan + 1) * Math.PI / 4, lr = [Math.cos(th), Math.sin(th)];
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); d[i] += s * tp.gain * lr[ch] * 0.7; d[i + 1] += s * tp.gain * lr[ch] * 0.3; }
  }
  return buf;
}

// The ambience beds (the game's loops): each looped, its level eased to a target.
class Beds {
  constructor(mixer) { this.mixer = mixer; this.ctx = mixer.ctx; this.beds = {}; }
  set(name, buffer) {
    if (this.beds[name] || !buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer; src.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0;
    src.connect(g).connect(this.mixer.amb);
    src.start(this.ctx.currentTime + 0.05, Math.random() * buffer.duration);
    this.beds[name] = { src, g, level: 0 };
  }
  level(name, v, glide = 2.5) {
    const b = this.beds[name];
    if (!b) return;
    b.level = v;
    b.g.gain.setTargetAtTime(v, this.ctx.currentTime, glide / 3);
  }
  all(levels, glide) { for (const n of Object.keys(this.beds)) this.level(n, levels[n] || 0, glide); }
}

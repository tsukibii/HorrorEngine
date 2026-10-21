// Horror cues on piano and strings: dread under the exploring, the stalker's ostinato, the music box gone wrong,
// the riser and the sting, the heartbeat while you hide, the chase, the death. Techniques and references:
// docs/MUSIC_RESEARCH.md. Dissonance is the point here: minor seconds, tritones, clusters, pedals that won't resolve.
"use strict";

const DISSONANCE = [[7], [6], [1], [1, 6], [1, 2, 6]];      // over the pedal, by amount: a fifth, a tritone, a minor second, both, a cluster

// Dread drone: a low pedal in the strings with a rub creeping in above, the piano dropping single low notes and the
// odd high "drip". Under exploring a dark house.
CUE("dread_drone", {
  family: "horror", label: "Dread drone", uses: ["dread", "explore", "house at night", "aftermath"],
  desc: "A low string pedal that swells and ebbs, a dissonance creeping in above it, single low piano notes and a high drip now and then.",
  refs: "The Shining (Penderecki's clusters), Silent Hill's room tones, Ringu",
  params: { key: P.key(4, "phrygian", ["phrygian", "locrian", "aeolian"]), len: P.len(20, 8, 40), dissonance: P.amt("dissonance", 0.6), drips: P.amt("piano drips", 0.4), swell: P.amt("swell", 0.6) },
  gen(t, p) {
    const k = p.key, root = 28 + k.tonic + (k.tonic > 7 ? 0 : 12), L = p.len, r = t.rng;
    t.beat(60, [4, 4]);
    const over = DISSONANCE[Math.min(4, Math.floor(p.dissonance * 4.99))];
    for (let s = 0; s < L; s += 7) {                          // the pedal: overlapping swells (each sample note re-sounds softly)
      const d = Math.min(9, L - s + 2);
      t.n("strings", root + 12, s + t.human(0.2), d, 40 + 30 * p.swell, { attack: 2.5, raw: true });
      t.n("strings", root + 19, s + 1.5 + t.human(0.3), d - 1.5, 30 + 20 * p.swell, { attack: 3 });
    }
    over.forEach((iv, i) => {                                 // the rub enters late and stays
      for (let s = L * (0.25 + 0.15 * i); s < L; s += 6) t.n("strings", root + 24 + iv, s + t.human(0.3), Math.min(7, L - s + 1.5), 28 + 25 * p.dissonance, { attack: 3.5 });
    });
    t.n("piano", root, 0.05, null, t.vel(60), { raw: true });
    const drips = Math.round(1 + p.drips * 7);
    for (let i = 0; i < drips; i++) {
      const at = r.range(2, L - 1);
      if (r.chance(0.55)) t.n("piano", root + r.pick([0, 1, 6, 12]), at, null, t.vel(48), { raw: true });
      else t.n("piano", deg(k, r.int(7, 13), 48) + r.pick([0, 0, 1]), at, null, t.vel(38));
    }
    t.end(L);
  },
});

// The stalker: a repeated low two-note figure on the piano (an unsettling meter), pizzicato under it, a string
// pedal that climbs a semitone every few bars. She's somewhere in the house.
CUE("stalker_ostinato", {
  family: "horror", label: "Stalker ostinato", uses: ["stalk", "dread", "searching", "patrol"],
  desc: "A low repeated piano figure in an odd meter (tonic and a minor second or tritone), pizzicato doubling, a string pedal that climbs every few bars.",
  refs: "Halloween's 5/4 piano (in spirit), Jaws' two notes, Insidious' strings",
  params: { key: P.key(2, "phrygian", ["phrygian", "locrian", "harmonic_minor"]), tempo: P.tempo(84, 56, 120), meter: P.pick("meter", ["5/4", "7/8", "4/4", "3/4"], "5/4"),
            interval: P.pick("figure", ["minor 2nd", "tritone", "minor 3rd"]), len: P.len(24, 10, 48), climb: P.amt("climb", 0.6) },
  gen(t, p) {
    const k = p.key, [num, den] = p.meter.split("/").map(Number), spb = t.beat(p.tempo * (den === 8 ? 2 : 1), [num, den]);
    const step = { "minor 2nd": 1, tritone: 6, "minor 3rd": 3 }[p.interval], low = 36 + k.tonic, bar = num * spb;
    const groups = num === 7 ? [0, 2, 4] : num === 5 ? [0, 3] : num === 3 ? [0] : [0, 2];
    let up = 0;
    for (let b = 0, s = 0; s < p.len; b++, s += bar) {
      if (b && b % 4 === 0 && t.rng.chance(p.climb)) up++;
      for (let i = 0; i < num; i++) {
        const accent = groups.includes(i), m = low + up + (i % 2 ? step : 0);
        t.n("piano", m, s + i * spb + t.human(), spb * 0.9, t.vel(accent ? 74 : 56), { raw: true });
        t.n("piano", m + 12, s + i * spb + t.human(), spb * 0.6, t.vel(accent ? 48 : 34));
        if (accent) t.n("pizz", m + 12, s + i * spb + t.human(), 0.3, t.vel(70));
      }
      if (b % 2 === 0) t.n("strings", low + 24 + up, s, bar * 2.1, 40 + 6 * up, { attack: bar * 0.8 });
      if (b % 4 === 3 && up) t.n("trem", low + 31 + up, s, bar, 30 + 8 * up, { attack: bar * 0.6 });
    }
    t.end(p.len);
  },
});

// The music box gone wrong: a sweet waltz in a major key on the glockenspiel and high piano, drifting out of tune,
// one wrong note at the cadence, slowing as it winds down. The yandere's lullaby.
CUE("music_box", {
  family: "horror", label: "Music box gone wrong", uses: ["yandere", "lullaby", "her room", "the turn", "memory"],
  desc: "A sweet music-box waltz (glockenspiel and high piano) that drifts flat, hits a wrong note at the cadence and winds down like a dying spring.",
  refs: "Doki Doki Literature Club's broken lullabies, Higurashi's music box, Silent Hill's lullaby cues",
  params: { key: P.key(5, "ionian", ["ionian", "lydian", "major_pent"]), tempo: P.tempo(80, 60, 104), len: P.len(18, 8, 32), wrongness: P.amt("wrongness", 0.5), winddown: P.amt("wind down", 0.6), strings: P.amt("string bed", 0.3) },
  gen(t, p) {
    const k = p.key, spb0 = t.beat(p.tempo, [3, 4]);
    const tune = [4, 2, 0, 2, 4, 4, 4, -1, 1, 1, 1, -1, 4, 7, 7, -1];      // degrees; -1 a rest (a little lilt of our own)
    const bars = Math.max(4, Math.round(p.len / (3 * spb0)));
    let s = 0;
    for (let b = 0; b < bars; b++) {
      const slow = 1 + (b / bars) ** 2 * p.winddown * 1.2, spb = spb0 * slow;      // the spring running down
      const detune = -p.wrongness * 45 * (b / bars) + t.rng.gauss(0, p.wrongness * 6); // drifting flat
      for (let i = 0; i < 3; i++) {
        const d = tune[(b * 3 + i) % tune.length];
        if (d >= 0) {
          let m = deg(k, d, 84);
          if (b === bars - 2 && i === 0 && t.rng.chance(0.4 + p.wrongness * 0.6)) m += t.rng.pick([1, 6, -1]);   // the wrong note
          t.n("glock", m, s + i * spb + t.human(0.01), spb * 2, t.vel(62), { cents: detune });
          t.n("piano", m, s + i * spb + t.human(0.01), spb * 1.5, t.vel(40), { cents: detune * 0.5 });
        }
      }
      if (b % 2 === 0) t.chord("piano", triad(k, [0, 3, 4, 0][(b / 2) % 4], 60), s, spb * 3, 34, { cents: detune * 0.3 });
      if (p.strings > 0.1 && b % 4 === 0) t.n("strings", deg(k, 0, 72), s, spb * 12, 22 + 30 * p.strings, { attack: spb * 4, cents: detune * 0.2 });
      s += 3 * spb;
    }
    if (p.wrongness > 0.4) t.n("glock", deg(k, 0, 84) + 1, s + spb0, null, t.vel(50), { cents: -60 * p.wrongness });   // one last wrong plink
    t.end(s + spb0 * 2);
  },
});

// The riser: strings sliding up in a cluster, tremolo swelling, the piano hammering faster; then cut to silence
// (the scare lands after) or into a sting.
CUE("riser", {
  family: "horror", label: "Riser", uses: ["tension", "approach", "before the scare", "she's coming"],
  desc: "A string cluster sliding upward with tremolo swelling and the piano repeating faster and faster; it cuts to silence (the scare comes after) or slams into a sting.",
  refs: "Insidious and The Conjuring's rising strings, Psycho's shrieking violins (in spirit)",
  params: { key: P.key(0, "chromatic"), len: P.len(6, 2, 14), ending: P.pick("ending", ["cut", "sting"]), width: P.amt("cluster width", 0.6), accel: P.amt("accelerate", 0.7) },
  gen(t, p) {
    const L = p.len, root = 48 + p.key.tonic, n = 2 + Math.round(p.width * 4);
    t.beat(60);
    for (let i = 0; i < n; i++) {
      t.n("strings", root + 7 + i, 0.05 * i, L, 40 + 6 * i, { attack: L * 0.8, bend: { semis: 5 + i % 3, at: 0.3, dur: L - 0.3 } });
      if (i % 2 === 0) t.n("trem", root + 19 + i, 0.2 + 0.05 * i, L, 38, { attack: L * 0.9, bend: { semis: 7, at: 0.5, dur: L - 0.5 } });
    }
    let s = 0.4, gap = 0.6;                                    // the piano: the same low note, faster and louder
    while (s < L) { t.n("piano", root - 12, s, gap, clamp(50 + 60 * (s / L), 1, 120), { raw: true }); t.n("piano", root - 11, s + gap / 2, gap / 2, clamp(40 + 50 * (s / L), 1, 110), { raw: true }); s += gap; gap = Math.max(0.06, gap * (1 - 0.18 * p.accel)); }
    if (p.ending === "sting") { stingAt(t, root, L, 1); t.end(L + 3); }
    else { t.point(L, "cut: the scare lands here"); t.end(L); }
  },
});

function stingAt(t, root, at, power) {
  const v = 95 + 25 * power;
  for (const iv of [0, 1, 2, 6, 7, 13]) t.n("strings", root + 12 + iv, at, 1.6, v, {});
  for (const iv of [12, 13, 18, 24]) t.n("trem", root + iv, at, 2.4, v - 10, {});
  t.chord("piano", [root - 24, root - 23, root - 18, root - 12, root - 11], at, null, v, { raw: true });
  t.chord("piano", [root + 24, root + 25, root + 31], at, null, v - 20);
  t.hit("bass_drum", at, 127); t.hit("crash", at, 90);
  t.n("timpani", root - 12, at, null, 120);
  t.point(at, "sting");
}

// The sting: the jump scare. A short silence, then everything at once: a string cluster, low and high piano
// clusters, a drum. The silence is part of it.
CUE("sting", {
  family: "horror", label: "Jump-scare sting", uses: ["scare", "jumpscare", "she appears", "found you"],
  desc: "Half a second of nothing, then a fortissimo string cluster with low and high piano clusters and a drum, ringing off into the hall.",
  refs: "Every jump scare since Cat People; Insidious' screeching stings; Ju-On",
  params: { key: P.key(1, "chromatic"), pre: { kind: "num", def: 0.5, min: 0, max: 2, step: 0.1, label: "silence first (s)" }, power: P.amt("power", 0.9), tail: P.amt("tremolo tail", 0.5) },
  gen(t, p) {
    const root = 46 + p.key.tonic;
    t.beat(60);
    stingAt(t, root, p.pre, p.power);
    if (p.tail > 0.1) for (const iv of [13, 14]) t.n("trem", root + iv, p.pre + 0.4, 1 + 3 * p.tail, 50 * p.tail + 20, {});
    t.end(p.pre + 1.5 + 3 * p.tail);
  },
});

// The heartbeat: lub-dub on the timpani and the low piano, speeding up; a high string note held like breath.
// While you hide.
CUE("heartbeat", {
  family: "horror", label: "Heartbeat", uses: ["hiding", "hold your breath", "she's near", "hide"],
  desc: "A lub-dub on timpani and low piano that speeds up over the cue, under a single high string note held like a breath.",
  refs: "The Tell-Tale Heart staging in games; Alien: Isolation's locker scenes",
  params: { key: P.key(9, "aeolian"), from: P.tempo(64, 50, 110), to: P.tempo(118, 60, 170), len: P.len(16, 6, 40), breath: P.amt("held note", 0.6) },
  gen(t, p) {
    const k = p.key, low = 33 + k.tonic;
    t.beat(p.from);
    let s = 0.2;
    while (s < p.len) {
      const u = s / p.len, bpm = p.from + (p.to - p.from) * u * u, spb = 60 / bpm;
      t.n("timpani", low, s, 0.4, t.vel(88 + 20 * u), { raw: true }); t.n("piano", low, s, 0.3, t.vel(60 + 25 * u), { raw: true });
      t.n("timpani", low, s + spb * 0.28, 0.3, t.vel(62 + 20 * u), { raw: true }); t.n("piano", low, s + spb * 0.28, 0.2, t.vel(44 + 20 * u), { raw: true });
      s += spb;
    }
    if (p.breath > 0.1) t.n("trem", deg(k, 7, 72) + (p.breath > 0.6 ? 1 : 0), 1, p.len - 1, 20 + 35 * p.breath, { attack: p.len * 0.6 });
    t.end(p.len);
  },
});

// Hiding: almost nothing. A very high tremolo, a pizzicato note now and then (a creak), and when she's near the
// notes come closer together and a low pedal wakes.
CUE("hiding_tension", {
  family: "horror", label: "Hiding (she's near)", uses: ["hiding", "hide", "search", "near"],
  desc: "A thin high tremolo, sparse low pizzicato taps like creaks, a pedal that wakes and a minor second when she's near.",
  refs: "Alien: Isolation, Outlast's hiding beds, DOORS' Rush warning (the lights' hum)",
  params: { key: P.key(6, "locrian"), len: P.len(20, 8, 40), near: P.amt("how near she is", 0.5), taps: P.amt("creaks", 0.5) },
  gen(t, p) {
    const k = p.key, r = t.rng, hi = 76 + mod(k.tonic, 6);
    t.beat(60);
    t.n("trem", hi, 0, p.len, 22 + 20 * p.near, { attack: 3 });
    if (p.near > 0.3) t.n("trem", hi + 1, p.len * (1 - p.near), p.len * p.near, 20 + 30 * p.near, { attack: 4 });
    if (p.near > 0.2) t.n("strings", 40 + k.tonic, p.len * 0.3, p.len * 0.7, 30 + 30 * p.near, { attack: 5, raw: true });
    const n = Math.round(2 + p.taps * 10 + p.near * 6);
    for (let i = 0; i < n; i++) t.n("pizz", 43 + k.tonic + r.pick([0, 1, 6, 12, 13]), r.range(1, p.len - 0.5), 0.2, t.vel(40 + 30 * p.near));
    t.end(p.len);
  },
});

// The chase: a fast string and piano ostinato in a dark mode, the timpani on the downbeats, the key climbing a
// semitone every few bars. Run.
CUE("chase", {
  family: "horror", label: "Chase", uses: ["chase", "run", "escape", "panic"],
  desc: "Driving sixteenths in the strings and pizzicato over low piano octaves, timpani on the downbeats, the key climbing a semitone every four bars.",
  refs: "Train to Busan's train chases, Kingdom's propulsive strings, The Mimic's chase loops",
  params: { key: P.key(4, "phrygian", ["phrygian", "harmonic_minor", "aeolian"]), tempo: P.tempo(156, 120, 184), len: P.len(20, 8, 48), climb: P.amt("climb", 0.7), drums: P.amt("drums", 0.6) },
  gen(t, p) {
    let k = { ...p.key };
    const spb = t.beat(p.tempo, [4, 4]), bar = 4 * spb, cell = [0, 1, 0, 3, 0, 1, 4, 3];    // degrees of a tight cell
    for (let b = 0, s = 0; s < p.len; b++, s += bar) {
      if (b && b % 4 === 0 && t.rng.chance(p.climb)) k = { ...k, tonic: k.tonic + 1 };
      for (let i = 0; i < 16; i++) {
        const m = deg(k, cell[i % 8], 60);
        t.n(i % 2 ? "pizz" : "strings", m, s + i * spb / 4, spb / 4 * 0.9, t.vel(i % 4 === 0 ? 92 : 70), { release: 0.08 });
      }
      for (let i = 0; i < 4; i++) t.chord("piano", [deg(k, 0, 36), deg(k, 0, 48)], s + i * spb, spb * 0.8, t.vel(i === 0 ? 96 : 78), { raw: true });
      t.n("timpani", deg(k, 0, 36), s, 0.6, t.vel(100), { raw: true });
      if (p.drums > 0.3) { t.hit("taiko", s + 2 * spb, 90 * p.drums); if (b % 2 === 1) t.hit("taiko_hand", s + 3.5 * spb, 70 * p.drums); }
      if (b % 2 === 0) t.n("horn", deg(k, 4, 48), s, bar * 1.8, t.vel(70), { attack: 0.4 });
    }
    t.end(p.len);
  },
});

// The death: a descending chromatic line in octaves on the piano, slowing; the strings fade from a cluster; a last
// low cluster and a bell, then silence.
CUE("death", {
  family: "horror", label: "Death", uses: ["death", "game over", "caught", "the end"],
  desc: "Piano octaves falling chromatically and slowing, strings fading out of a cluster, one last low piano cluster and a tubular bell.",
  refs: "Silent Hill's game-over cues, Resident Evil's 'You died' (in spirit), Hereditary's endings",
  params: { key: P.key(10, "chromatic"), len: P.len(8, 4, 16), bell: P.amt("bell", 0.7), strings: P.amt("strings", 0.6) },
  gen(t, p) {
    const top = 72 + mod(p.key.tonic, 12), L = p.len;
    t.beat(60);
    let s = 0, gap = 0.22, m = top;
    while (s < L * 0.7) { t.chord("piano", [m, m - 12], s, gap * 1.4, t.vel(70 - 30 * (s / L))); s += gap; gap *= 1.12; m -= 1; }
    if (p.strings > 0.1) for (const iv of [0, 1, 3, 6]) t.n("strings", top - 12 + iv, 0, L * 0.8, 30 + 40 * p.strings, { attack: 0.5, bend: { semis: -2, at: L * 0.3, dur: L * 0.5 } });
    t.chord("piano", [m - 24, m - 23, m - 18, m - 12], L * 0.75, null, 70, { raw: true });
    if (p.bell > 0.2) t.n("bells", 60 + mod(m, 12), L * 0.78, null, 50 + 50 * p.bell);
    t.point(L * 0.75, "the last breath");
    t.end(L + 2);
  },
});

// Behind you: a reversed piano swell (inhaled) into a close dissonant chord very high in the strings: a whisper.
CUE("behind_you", {
  family: "horror", label: "Behind you (whisper)", uses: ["behind you", "whisper", "glimpse", "presence"],
  desc: "A piano note swelling backwards like an intake of breath into a hushed, very high cluster in the strings.",
  refs: "Hereditary and The Ring's breathy swells; the reversed-cymbal trick",
  params: { key: P.key(3, "chromatic"), len: P.len(4, 2, 8), height: P.amt("height", 0.7) },
  gen(t, p) {
    const top = 74 + Math.round(p.height * 8) + mod(p.key.tonic, 4), sw = Math.min(2, p.len * 0.5);
    t.beat(60);
    t.n("piano", top - 24, 0, sw, 90, { reverse: true });
    t.n("piano", top - 17, 0, sw, 80, { reverse: true });
    for (const iv of [0, 1, 2]) t.n("strings", top + iv, sw, p.len - sw + 1, 34, { attack: 0.2 });
    t.n("trem", top + 6, sw + 0.1, p.len - sw, 28, { attack: 0.5 });
    t.point(sw, "the whisper");
    t.end(p.len + 1);
  },
});

// The turn: a warm major chord whose top slides down a semitone into minor; the smile dropping.
CUE("the_turn", {
  family: "horror", label: "The turn (smile drops)", uses: ["the turn", "reveal", "yandere", "her mask slips"],
  desc: "A warm major chord on piano and strings; the strings' third slides down into minor and a tritone creeps in under it as the piano goes quiet.",
  refs: "Danganronpa and Squid Game's sweetness turned; the Hitchcock chord bend",
  params: { key: P.key(7, "ionian"), len: P.len(6, 3, 12), bend: P.amt("how far it falls", 0.6) },
  gen(t, p) {
    const k = p.key, [r, th, fi] = triad(k, 0, 60), L = p.len, at = L * 0.35;
    t.beat(70);
    t.chord("piano", [r - 12, r, th, fi, r + 12], 0, at, 64, { roll: 0.03 });
    t.n("strings", r, 0, L, 54, { attack: 0.6 }); t.n("strings", fi, 0, L, 50, { attack: 0.6 });
    t.n("strings", th + 12, 0, L, 54, { attack: 0.6, bend: { semis: -1, at, dur: 1.4 } });                 // the third falls: minor
    if (p.bend > 0.5) t.n("strings", fi + 12, at + 0.4, L - at, 46, { attack: 0.3, bend: { semis: -1, at: 0.2, dur: 1.6 } });  // the fifth too: a tritone
    t.n("strings", r - 12 + 6, at + 1, L - at, 30 + 30 * p.bend, { attack: 1.5 });
    t.point(at, "the smile drops");
    t.end(L + 1);
  },
});

// Creaking house: col-legno-like pizzicato taps, low tremolo swelling in and out, the house settling around you.
CUE("house_creaks", {
  family: "horror", label: "The house settles", uses: ["explore", "dread", "empty house", "night"],
  desc: "Irregular low pizzicato taps like wood settling, low tremolo swelling in and out, a single piano note left hanging.",
  refs: "Ju-On and The Grudge's creaks, Paranormal Activity's sound-design scoring",
  params: { key: P.key(8, "locrian"), len: P.len(18, 8, 36), taps: P.amt("taps", 0.5), swells: P.amt("swells", 0.5) },
  gen(t, p) {
    const k = p.key, r = t.rng, low = 43 + mod(k.tonic, 7);
    t.beat(60);
    const n = Math.round(4 + p.taps * 16);
    for (let i = 0; i < n; i++) { const at = r.range(0, p.len), m = low + r.pick([0, 1, 5, 6, 11]); t.n("pizz", m, at, 0.15, t.vel(45)); if (r.chance(0.3)) t.n("pizz", m + 1, at + r.range(0.05, 0.15), 0.12, t.vel(35)); }
    const sw = Math.round(1 + p.swells * 4);
    for (let i = 0; i < sw; i++) { const at = r.range(0, p.len - 3), d = r.range(2.5, 5); t.n("trem", low + r.pick([0, 1, 12]), at, d, 30 + 25 * p.swells, { attack: d * 0.6 }); }
    t.n("piano", deg(k, 4, 72), r.range(p.len * 0.4, p.len * 0.8), null, t.vel(42));
    t.end(p.len);
  },
});

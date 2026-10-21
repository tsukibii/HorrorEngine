// K-drama cues: the light, comic underscore that follows what a character does (mickey-mousing) and the romantic
// swells. Pizzicato tiptoes, glockenspiel and xylophone giggles, the slide of a fall and its thud, the "dun dun"
// of a shock, the slow-motion piano-and-strings moment. References and the craft: docs/MUSIC_RESEARCH.md.
"use strict";

// Sneaking on tiptoe: staccato pizzicato in a minor key, low on the beat and high off it, flute staccato tiptoes,
// a freeze now and then (the character stops, listens), then on again.
CUE("sneak", {
  family: "kdrama", level: -6, align: "start", label: "Sneaking (tiptoe)", uses: ["sneak", "tiptoe", "creeping up", "spying", "comedy"],
  desc: "Staccato pizzicato tiptoeing in a minor key, flute staccato on the high steps, and freezes where everything stops (the character listens), then carries on.",
  refs: "The classic 'sneaking' cue of K-drama comedies (Strong Woman Do Bong-soon, What's Wrong with Secretary Kim); Mancini's Pink Panther in spirit",
  params: { key: P.key(9, "aeolian", ["aeolian", "dorian", "harmonic_minor"]), tempo: P.tempo(112, 92, 132), len: P.len(12, 6, 30), cheek: P.amt("chromatic cheek", 0.5), freezes: P.amt("freezes", 0.4) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo, [4, 4]), bar = 4 * spb, r = t.rng;
    const line = [0, 2, 4, 2, 0, -1, 0, 4];
    let s = 0;
    for (let b = 0; s < p.len; b++) {
      if (b > 1 && r.chance(p.freezes * 0.5)) {           // a freeze: one tiptoe, then nothing for a beat and a half
        t.n("pizz", deg(k, 4, 72), s, 0.1, t.vel(60)); t.point(s + spb * 0.5, "freeze"); s += spb * 2; continue;
      }
      for (let i = 0; i < 4; i++) {
        t.n("pizz", deg(k, [0, 4, 0, 4][i], 48), s + i * spb + t.human(), 0.12, t.vel(i % 2 ? 58 : 74));
        let m = deg(k, line[(b * 4 + i) % 8], 72);
        if (r.chance(p.cheek * 0.4)) { t.n("pizz", m - 1, s + (i + 0.5) * spb - spb / 8, 0.08, t.vel(52)); }   // a cheeky chromatic lean-in
        t.n("pizz", m, s + (i + 0.5) * spb + t.human(), 0.1, t.vel(62));
        if (i === 3 && r.chance(0.6)) t.n("flute_stac", m + 12, s + (i + 0.5) * spb, 0.1, t.vel(66));
      }
      s += bar;
    }
    t.n("pizz", deg(k, 0, 60), s, 0.2, t.vel(80)); t.n("pizz", deg(k, 0, 48), s, 0.2, t.vel(84));
    t.end(s + 0.6);
  },
});

// Flustered: a quick run up on xylophone and glockenspiel, pizzicato fluttering between two notes, a high bright
// piano chord like a blush.
CUE("flustered", {
  family: "kdrama", level: -4, label: "Flustered (blush)", uses: ["flustered", "embarrassed", "caught staring", "blush", "comedy"],
  desc: "A fast run up the xylophone into a glockenspiel twinkle, pizzicato fluttering between two notes, a bright high piano chord like a blush.",
  refs: "The blush stings of romantic comedies (Business Proposal, Weightlifting Fairy Kim Bok-joo)",
  params: { key: P.key(2, "ionian", ["ionian", "lydian"]), tempo: P.tempo(140, 110, 170), len: P.len(3, 1.5, 6), flutter: P.amt("flutter", 0.6) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo);
    for (let i = 0; i < 8; i++) t.n("xylo", deg(k, i, 72), i * spb / 4, 0.15, t.vel(70 + i * 3));
    t.n("glock", deg(k, 7, 84), 2 * spb, null, t.vel(84)); t.n("glock", deg(k, 9, 84), 2.25 * spb, null, t.vel(74));
    const fl = Math.round(4 + p.flutter * 12);
    for (let i = 0; i < fl; i++) t.n("pizz", deg(k, i % 2 ? 4 : 5, 60), 2 * spb + i * spb / 4, 0.1, t.vel(58));
    t.chord("piano", [deg(k, 0, 72), deg(k, 2, 72), deg(k, 4, 72), deg(k, 6, 72)], 2 * spb, p.len, 52, { roll: 0.02 });
    t.point(2 * spb, "the blush");
    t.end(Math.max(p.len, 2 * spb + fl * spb / 4 + 0.5));
  },
});

// The fall: a slide down the harp and piano, a thud (timpani and bass drum, or a wood block's bonk), then a held
// beat of nothing, and a little "ow" chord.
CUE("slapstick_fall", {
  family: "kdrama", level: -2, label: "Slapstick fall", uses: ["trip", "fall", "pratfall", "bonk", "comedy"],
  desc: "A slide down the harp and piano, a thud on the landing (timpani and bass drum, or a wood-block bonk), a beat of silence, then a small sheepish chord.",
  refs: "The pratfall stings of K-drama comedies; cartoon scoring (Carl Stalling) in spirit",
  params: { key: P.key(0, "ionian"), fall: { kind: "num", def: 0.8, min: 0.3, max: 2, step: 0.1, label: "the fall (s)" }, landing: P.pick("landing", ["thud", "bonk", "crash"]), slide: P.pick("the slide", ["harp run", "slide whistle", "xylophone"]), after: P.amt("sheepish chord", 0.7) },
  gen(t, p) {
    const k = p.key, n = 12;
    t.beat(120);
    if (p.slide === "slide whistle") t.n("flute", 90, 0, p.fall, 84, { raw: true, bend: { semis: -22, at: 0.05, dur: p.fall - 0.05 }, release: 0.05 });
    else if (p.slide === "xylophone") for (let i = 0; i < 16; i++) t.n("xylo", 100 - i, p.fall * i / 16, 0.1, t.vel(78));
    else for (let i = 0; i < n; i++) { const at = p.fall * (i / n) ** 0.8; t.n("harp", deg(k, 14 - i, 60), at, 0.3, t.vel(80)); if (i % 2 === 0) t.n("piano", deg(k, 14 - i, 72), at, 0.2, t.vel(60)); }
    const land = p.fall;
    if (p.landing === "thud") { t.n("timpani", deg(k, 0, 36), land, null, 118, { raw: true }); t.hit("bass_drum", land, 120); }
    else if (p.landing === "bonk") { t.hit("log_lo", land, 120); t.hit("log_hi", land + 0.12, 90); }
    else { t.hit("crash", land, 110); t.hit("bass_drum", land, 110); t.n("piano", deg(k, 0, 36) - 1, land, null, 90, { raw: true }); }
    t.point(land, "the landing");
    if (p.after > 0.2) {
      const at = land + 0.9;
      t.n("pizz", deg(k, 4, 60), at, 0.15, 60); t.n("pizz", deg(k, 3, 60), at + 0.25, 0.15, 56);
      t.chord("piano", [deg(k, 1, 60), deg(k, 3, 60), deg(k, 6, 60)], at + 0.5, 1.2, 40 + 20 * p.after);
    }
    t.end(land + 2.5);
  },
});

// Cute: bouncy glockenspiel and xylophone over a pizzicato oom-pah, a major pentatonic tune, a triangle on four.
// Eating something delicious, a puppy, a happy little walk.
CUE("cute", {
  family: "kdrama", level: -5, label: "Cute (eating, happy walk)", uses: ["cute", "eating", "happy", "aegyo", "comedy"],
  desc: "A bouncy major pentatonic tune on glockenspiel and xylophone over a pizzicato oom-pah bass, flute staccato answers and a triangle on the fourth beat.",
  refs: "The cute cues of Reply 1988 and Extraordinary Attorney Woo; the celesta-and-pizzicato 'aegyo' sound",
  params: { key: P.key(7, "major_pent", ["major_pent", "ionian"]), tempo: P.tempo(120, 100, 140), len: P.len(10, 6, 24), sparkle: P.amt("sparkle", 0.5) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo, [4, 4]), bar = 4 * spb, r = t.rng;
    const bass = { tonic: k.tonic, mode: "ionian" }, prog = [0, 3, 4, 0];
    let s = 0, mel = 0;
    for (let b = 0; s < p.len; b++, s += bar) {
      const ch = prog[b % 4];
      for (let i = 0; i < 4; i++) t.n("pizz", i % 2 ? deg(bass, ch + 4, 48) : deg(bass, ch, 48), s + i * spb, 0.12, t.vel(i % 2 ? 56 : 70));
      for (let i = 0; i < 8; i++) {
        if (r.chance(0.3)) continue;
        mel = clamp(mel + r.pick([-1, 1, 1, 2, -2]), 0, 9);
        t.n(i % 4 === 0 ? "glock" : "xylo", deg(k, mel, 72), s + i * spb / 2 + t.human(), 0.2, t.vel(i % 2 ? 58 : 70));
      }
      if (r.chance(0.5)) t.n("flute_stac", deg(k, mel + 2, 72), s + 3.5 * spb, 0.1, t.vel(60));
      t.hit("triangle", s + 3 * spb, 50 + 30 * p.sparkle);
    }
    t.n("glock", deg(k, 5, 84), s, null, t.vel(80));
    t.end(s + 1);
  },
});

// Smug: a sly pizzicato walking bass creeping chromatically, flute staccato with little leans, a knowing pause.
// Scheming, a smirk, the plan coming together.
CUE("smug", {
  family: "kdrama", level: -6, label: "Smug / scheming", uses: ["smug", "scheming", "smirk", "a plan", "comedy"],
  desc: "A sly walking pizzicato bass that creeps chromatically, flute staccato phrases with little leans, a knowing pause before the last note.",
  refs: "The scheming-rival cues of K-drama comedies; the villain's tango in spirit",
  params: { key: P.key(4, "harmonic_minor", ["harmonic_minor", "dorian"]), tempo: P.tempo(96, 80, 112), len: P.len(10, 6, 20), creep: P.amt("creep", 0.6) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo), bar = 4 * spb, r = t.rng;
    const walk = [0, 2, 3, 4, 4, 3, 2, 1];
    let s = 0;
    for (let b = 0; s < p.len - bar; b++, s += bar) {
      for (let i = 0; i < 4; i++) { let m = deg(k, walk[(b * 4 + i) % 8], 48); if (r.chance(p.creep * 0.35)) m -= 1; t.n("pizz", m, s + i * spb + t.human(), 0.2, t.vel(66)); }
      if (b % 2 === 1) { t.n("flute_stac", deg(k, 4, 72), s + 1.5 * spb, 0.1, 64); t.n("flute_stac", deg(k, 5, 72) - 1, s + 1.75 * spb, 0.1, 56); t.n("flute_stac", deg(k, 4, 72), s + 2 * spb, 0.1, 66); }
    }
    t.point(s + spb, "the smirk");
    t.n("pizz", deg(k, 4, 60), s + 1.5 * spb, 0.2, 70); t.n("pizz", deg(k, 0, 48), s + 2 * spb, 0.3, 82);
    t.end(s + 3 * spb);
  },
});

// The shock: "dun dun dun", three low hits falling (horn, low strings, timpani), a tremolo after, sometimes a fast
// zoom-in of rising strings first.
CUE("shock", {
  family: "kdrama", level: -1, label: "Shock (dun dun dun)", uses: ["shock", "realisation", "twist", "gasp", "comedy", "reveal"],
  desc: "Three heavy hits falling (horn, low strings, piano and timpani together), a string tremolo left hanging; optionally a quick zoom-in rush first.",
  refs: "The dramatic-reveal stings of makjang dramas and comedies alike (Boys Over Flowers, The Penthouse)",
  params: { key: P.key(2, "aeolian"), hits: P.pick("hits", ["3", "2", "1"], "3"), zoom: P.amt("zoom-in first", 0.4), hang: P.amt("tremolo hang", 0.6) },
  gen(t, p) {
    const k = p.key, low = 38 + k.tonic, n = Number(p.hits);
    t.beat(80);
    let s = 0;
    if (p.zoom > 0.3) { for (let i = 0; i < 6; i++) t.n("strings", low + 12 + i * 2, i * 0.06, 0.4, 70); s = 0.6; }
    const steps = [[7, 8, 7], [0, -1], [0]][3 - n];
    steps.forEach((iv, i) => {
      const at = s + i * 0.55;
      t.n("horn", low + 12 + iv, at, 0.45, 110); t.n("strings", low + iv, at, 0.45, 110, { raw: true }); t.chord("piano", [low + iv - 12, low + iv], at, 0.5, 112, { raw: true });
      t.n("timpani", low + iv, at, null, 120, { raw: true });
      t.point(at, "hit " + (i + 1));
    });
    const after = s + n * 0.55;
    if (p.hang > 0.1) { t.n("trem", low + 13, after, 1 + 2.5 * p.hang, 70); t.n("trem", low + 19, after, 1 + 2.5 * p.hang, 60); }
    t.end(after + 1 + 2.5 * p.hang);
  },
});

// Slow motion: the romantic look. Piano arpeggios over the "royal road" or I–V–vi–IV, strings swelling in, a
// glockenspiel sparkle on the downbeat; at the end it can lift a step (the climax key change).
CUE("slowmo_romance", {
  family: "kdrama", level: -5, motif: true, label: "Slow-motion romance", uses: ["romance", "slow motion", "eye contact", "first meeting", "love"],
  desc: "Rolling piano arpeggios over a K-pop ballad progression, strings swelling in under them, a glockenspiel sparkle on the first beat; it may lift a whole step for the last bars.",
  refs: "Goblin, Crash Landing on You, Descendants of the Sun: the OST ballad underscore (piano first, strings rising)",
  params: { key: P.key(5, "ionian"), tempo: P.tempo(72, 58, 86), progression: P.pick("progression", ["royal_road", "pop", "canon", "doo_wop"]), len: P.len(24, 12, 48), lift: P.amt("key change at the end", 0.5), strings: P.amt("strings", 0.7),
            ending: P.pick("ending", ["resolve", "record scratch (the parody)"]) },
  gen(t, p) {
    let k = { ...p.key };
    const spb = t.beat(p.tempo, [4, 4]), bar = 4 * spb, prog = PROGS[p.progression];
    const bars = Math.max(4, Math.round(p.len / bar)), liftAt = p.lift > 0.3 ? bars - 4 : 99;
    for (let b = 0; b < bars; b++) {
      if (b === liftAt) { k = { ...k, tonic: k.tonic + 2 }; t.mark(b * bar, "key change up a step"); }
      const s = b * bar, d = prog[b % prog.length], ch = triad(k, d, 60, 4);
      const pat = [deg(k, d, 48), ch[1], ch[2], ch[0] + 12, ch[1] + 12, ch[2], ch[1], ch[2]];
      pat.forEach((m, i) => t.n("piano", m, s + i * spb / 2 + t.human(0.012), spb * 1.2, t.vel(i === 0 ? 62 : 48)));
      if (b % 2 === 0 || b >= liftAt) t.n("piano", ch[2] + 12, s + t.human(), bar, t.vel(58));
      if (p.strings > 0.1 && b >= 2) { const v = 30 + 40 * p.strings * Math.min(1, b / bars + 0.3); t.n("strings", deg(k, d, 48), s, bar * 1.05, v, { attack: spb, raw: true }); t.n("strings", ch[1] + 12, s, bar * 1.05, v - 6, { attack: spb }); }
      if (b % 4 === 0) t.n("glock", ch[0] + 24, s + t.human(), null, t.vel(54));
      if (p.motif && b >= 1) {                                       // the couple's theme: piano first, the strings take it over half-way
        let off = 0;
        for (const [md, beats] of motifLine(p.motif, 4).filter(x => x[2] === (b - 1) % 8)) {
          const inst = b >= bars / 2 && p.strings > 0.3 ? "strings" : "piano";
          t.n(inst, deg(k, md, 72), s + off * spb + t.human(0.01), beats * spb * 0.95, inst === "strings" ? 44 + 20 * p.strings : t.vel(64), inst === "strings" ? { attack: 0.12 } : {});
          off += beats;
        }
      }
    }
    if (p.ending !== "resolve") {
      // Weightlifting Fairy's joke: the swell is at its height and the needle comes off (research §1.3)
      t.tapeStop(bars * bar - spb, 0.25); t.point(bars * bar - spb, "the scratch");
      t.n("pizz", deg(k, 0, 48), bars * bar + 0.9, 0.2, 56);
      t.end(bars * bar + 2);
      return;
    }
    t.chord("piano", triad(k, 0, 48, 4).concat([deg(k, 0, 72)]), bars * bar, null, 56, { roll: 0.08 });
    t.end(bars * bar + 3);
  },
});

// Heart flutter: a harp glissando up, glockenspiel twinkles and a warm string chord; the eyes meet.
CUE("heart_flutter", {
  family: "kdrama", level: -6, label: "Heart flutter", uses: ["heart flutter", "eye contact", "touch", "romance"],
  desc: "A harp glissando up into glockenspiel twinkles and a warm string chord swelling and fading: the moment the eyes meet.",
  refs: "The eye-contact stings of romantic K-dramas (Hotel del Luna's softer cues, Twenty-Five Twenty-One)",
  params: { key: P.key(4, "lydian", ["lydian", "ionian"]), len: P.len(4, 2, 8), twinkles: P.amt("twinkles", 0.6) },
  gen(t, p) {
    const k = p.key;
    t.beat(70);
    for (let i = 0; i < 14; i++) t.n("harp", deg(k, i, 48), i * 0.045, 1, t.vel(56 + i * 2));
    const tw = Math.round(2 + p.twinkles * 5);
    for (let i = 0; i < tw; i++) t.n("glock", deg(k, t.rng.pick([0, 2, 4, 7, 9]), 84), 0.7 + i * 0.22 + t.human(0.02), null, t.vel(60 - i * 3));
    t.chord("strings", triad(k, 0, 60, 4), 0.6, p.len, 46, { attack: 0.8 });
    t.point(0.65, "the eyes meet");
    t.end(p.len + 1);
  },
});

// The sad flashback: solo piano in a minor key, sparse and rubato, the strings coming in after a few bars.
CUE("sad_flashback", {
  family: "kdrama", level: -8, motif: true, label: "Sad flashback", uses: ["flashback", "sad", "memory", "grief", "regret"],
  desc: "Solo piano in a minor key, sparse and rubato (a melody over broken chords), the strings entering softly after a few bars.",
  refs: "My Mister, Goblin's memory cues, Reply 1988's tender piano themes",
  params: { key: P.key(9, "aeolian"), tempo: P.tempo(64, 50, 76), progression: P.pick("progression", ["ballad_minor", "sad_pop", "lament"]), len: P.len(28, 14, 56), strings: P.amt("strings", 0.5) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo, [4, 4]), bar = 4 * spb, prog = PROGS[p.progression], r = t.rng;
    const bars = Math.max(4, Math.round(p.len / bar));
    let mel = 4, s = 0;
    const line = p.motif ? motifLine(p.motif, 4) : null;
    for (let b = 0; b < bars; b++) {
      const rub = 1 + 0.08 * Math.sin(b * 1.7), barL = bar * rub;         // rubato: bars breathe
      const d = prog[b % prog.length], ch = triad(k, d, 48, 3);
      [deg(k, d, 36), ch[2], ch[1] + 12, ch[2]].forEach((m, i) => t.n("piano", m, s + i * barL / 4 + t.human(0.02), barL / 2, t.vel(i ? 40 : 50), { raw: i === 0 }));
      if (line) { let off = 0; for (const [md, beats] of line.filter(x => x[2] === b % 8)) { t.n("piano", deg(k, md, 72), s + off * barL / 4 + t.human(0.03), beats * barL / 4 * 1.1, t.vel(58)); off += beats; } }
      else {
        const notes = r.int(2, 4);
        for (let i = 0; i < notes; i++) { mel = clamp(mel + r.pick([-1, -1, 1, -2, 2]), 2, 9); t.n("piano", deg(k, mel, 72), s + (i / notes) * barL + t.human(0.03), barL / notes * 1.3, t.vel(58)); }
      }
      if (p.strings > 0.1 && b >= 4) t.n("strings", deg(k, d, 60), s, barL * 1.05, 24 + 30 * p.strings, { attack: barL * 0.4 });
      s += barL;
    }
    t.n("piano", deg(k, 0, 72), s, null, t.vel(50)); t.n("piano", deg(k, 0, 36), s, null, t.vel(46), { raw: true });
    t.end(s + 3);
  },
});

// The comic chase: a galop in two, pizzicato and xylophone racing, horn calls, snare.
CUE("comic_chase", {
  family: "kdrama", level: -3, label: "Comic chase", uses: ["comic chase", "running late", "hurry", "comedy"],
  desc: "A galloping 2/4 in a major key: pizzicato oom-pah racing, xylophone runs, horn calls and a snare keeping it moving.",
  refs: "The running-late montages of K-drama comedies; Offenbach's galop in spirit",
  params: { key: P.key(0, "ionian", ["ionian", "mixolydian"]), tempo: P.tempo(168, 140, 196), len: P.len(12, 6, 30), horn: P.amt("horn calls", 0.6) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo, [2, 4]), bar = 2 * spb, r = t.rng, prog = [0, 4, 0, 4, 3, 0, 4, 0];
    let s = 0;
    for (let b = 0; s < p.len; b++, s += bar) {
      const d = prog[b % 8];
      t.n("pizz", deg(k, d, 48), s, 0.12, 76); t.n("pizz", deg(k, d + 4, 60), s + spb, 0.12, 64);
      t.hit("snare", s + spb, 50); if (b % 2) t.hit("snare", s + 1.5 * spb, 40);
      for (let i = 0; i < 4; i++) t.n("xylo", deg(k, d + [0, 2, 4, 2][i] + (b % 4 === 3 ? i : 0), 72), s + i * spb / 2, 0.1, t.vel(66));
      if (p.horn > 0.3 && b % 4 === 0) { t.n("horn", deg(k, 4, 60), s, spb * 0.9, 80); t.n("horn", deg(k, 7, 60), s + spb, spb * 1.8, 86); }
    }
    t.n("pizz", deg(k, 0, 60), s, 0.2, 90); t.n("xylo", deg(k, 7, 72), s, null, 90);
    t.end(s + 0.8);
  },
});

// Awkward: a held, slightly wrong chord, one plucked note left hanging, a glockenspiel "ding" into the silence.
CUE("awkward", {
  family: "kdrama", level: -6, align: "start", label: "Awkward silence", uses: ["awkward", "silence", "cringe", "comedy"],
  desc: "A thin, slightly wrong string chord, one pizzicato note left hanging, and a single glockenspiel ding dropped into the quiet.",
  refs: "The awkward-pause stings of K-drama comedies; the 'cricket' moment in sitcom scoring",
  params: { key: P.key(5, "lydian"), len: P.len(3, 1.5, 6), how: P.pick("how it starts", ["the hanging chord", "record scratch"]) },
  gen(t, p) {
    const k = p.key;
    t.beat(60);
    if (p.how === "record scratch") {
      // a bright bit of something happy, stopped dead like a needle dragged off the record, then the awkward beat
      const spb = 0.25;
      [0, 2, 4, 7, 4, 2].forEach((d, i) => t.n("xylo", deg(k, d, 72), i * spb, spb, t.vel(80)));
      t.chord("piano", triad(k, 0, 60), 0, 1.6, 62);
      t.n("strings", deg(k, 4, 72), 0, 1.6, 54, { attack: 0.1 });
      t.tapeStop(1.3, 0.22); t.point(1.3, "the scratch");
      t.n("pizz", deg(k, 3, 60), 2.4, 0.2, 54);
      t.n("glock", deg(k, 4, 84), 2.4 + p.len * 0.5, null, 50);
      t.end(2.4 + p.len);
      return;
    }
    t.n("pizz", deg(k, 3, 60), 0, 0.2, 60);
    t.chord("strings", [deg(k, 0, 60), deg(k, 3, 60) + 1, deg(k, 6, 60)], 0.4, p.len - 0.6, 34, { attack: 0.3 });
    t.n("glock", deg(k, 4, 84), p.len * 0.6, null, 56);
    t.point(p.len * 0.6, "ding");
    t.end(p.len + 0.5);
  },
});

// Triumph: a horn fanfare over strings and timpani, I–IV–V–I.
CUE("triumph", {
  family: "kdrama", level: -2, label: "Triumph", uses: ["triumph", "victory", "it worked", "comedy"],
  desc: "A horn fanfare over strings and piano chords with timpani, I–IV–V–I, landing big.",
  refs: "The win moments of K-drama comedies and sports dramas (Twenty-Five Twenty-One's fencing wins)",
  params: { key: P.key(10, "ionian"), tempo: P.tempo(104, 88, 124), len: P.len(6, 4, 12) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo), prog = [0, 3, 4, 0];
    prog.forEach((d, i) => {
      const s = i * 2 * spb;
      t.chord("strings", triad(k, d, 60), s, 2 * spb, 70, { attack: 0.05 });
      t.chord("piano", [deg(k, d, 36)].concat(triad(k, d, 60)), s, 2 * spb, 74, { raw: true });
      t.n("timpani", deg(k, d, 36), s, null, i === 3 ? 115 : 90, { raw: true });
    });
    [[4, 0, 0.5], [4, 0.5, 0.5], [4, 1, 0.5], [7, 1.5, 1.5], [5, 3, 0.5], [6, 3.5, 0.5], [7, 4, 3]].forEach(([d, at, l]) => t.n("horn", deg(k, d, 48), at * 2 * spb / 2, l * spb, 92));
    t.hit("crash", 6 * spb, 80);
    t.point(6 * spb, "the win");
    t.end(Math.max(p.len, 8 * spb + 1.5));
  },
});

// The sad horn: three notes sagging down a semitone each, the last one bending flat (a pout, a sulk, a fail).
CUE("womp_womp", {
  family: "kdrama", level: -3, label: "Sulk (womp womp)", uses: ["sulk", "pout", "fail", "rejected", "comedy"],
  desc: "Three horn notes falling a semitone at a time over a low pizzicato, the last one sagging flat and fading: the sulk.",
  refs: "The 'sad trombone' gag, played on the one horn we have",
  params: { key: P.key(7, "chromatic"), sag: P.amt("sag", 0.7) },
  gen(t, p) {
    const top = 52 + mod(p.key.tonic, 7);
    t.beat(70);
    [0, -1, -2].forEach((iv, i) => t.n("horn", top + iv, i * 0.55, 0.45, 80));
    t.n("horn", top - 3, 1.65, 1.6, 82, { bend: { semis: -0.5 - 1.5 * p.sag, at: 0.4, dur: 1.1 } });
    t.n("pizz", top - 15, 1.65, 0.3, 70);
    t.point(1.65, "the sulk");
    t.end(3.6);
  },
});

// The punchline: under a second. Ba-dum-tss on the kit, a xylophone ta-da, a pizzicato bonk, or a timpani boing
// (the thud bent down).
CUE("punchline", {
  family: "kdrama", level: -2, label: "Punchline (ba-dum-tss)", uses: ["punchline", "joke", "rimshot", "comedy", "tag"],
  desc: "A tag under a second: ba-dum-tss on the kit, a xylophone ta-da, a pizzicato bonk or a timpani boing.",
  refs: "The rimshot; the variety-show sound punctuation K-drama comedy borrows (Running Man, Infinite Challenge captions)",
  params: { key: P.key(0, "ionian"), kind: P.pick("tag", ["ba-dum-tss", "ta-da", "bonk", "boing"]) },
  gen(t, p) {
    const k = p.key;
    t.beat(120);
    if (p.kind === "ba-dum-tss") { t.hit("snare", 0, 96); t.hit("tenor", 0.16, 90); t.hit("bass_drum", 0.32, 100); t.hit("crash", 0.32, 90); t.point(0.32, "tss"); }
    else if (p.kind === "ta-da") { t.n("xylo", deg(k, 4, 72), 0, 0.1, 96); t.chord("xylo", [deg(k, 0, 84), deg(k, 2, 84), deg(k, 4, 84)], 0.2, 0.4, 104); t.n("glock", deg(k, 0, 96), 0.2, null, 70); t.point(0.2, "da"); }
    else if (p.kind === "bonk") { t.n("pizz", deg(k, 0, 48), 0, 0.2, 120); t.hit("log_lo", 0, 110); t.n("pizz", deg(k, 0, 48) - 1, 0.3, 0.2, 90); t.point(0, "bonk"); }
    else { t.n("timpani", deg(k, 4, 36), 0, 1, 112, { bend: { semis: -3, at: 0.02, dur: 0.6 } }); t.point(0, "boing"); }
    t.end(1.2);
  },
});

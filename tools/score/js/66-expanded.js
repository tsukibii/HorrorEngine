// The expanded orchestra: cues written for the instruments added beside Woohill's (docs/MUSIC.md §7.2): the double
// bass, trombones with falls and buzz, the tuba, a muted trumpet, bassoon and clarinet, rubbed wine glasses, a bowed
// psaltery, bowed and soft vibraphone, a kalimba, a harpsichord, a quiet pipe organ, an ocarina and the eerie
// metals kit. The original cues keep their instruments; these are new colours to choose from.
"use strict";

FAMILIES.expanded = "Expanded orchestra";
// where the added instruments sound good (the samples' own ranges, a little inside them)
Object.assign(REG, {
  cbass_sus: [28, 52], cbass_trem: [28, 52], cbass_pizz: [28, 55], vln_solo: [55, 93], cello_sus: [36, 72],
  trombone: [41, 67], trombone_fall: [43, 59], trombone_buzz: [41, 60], tuba: [29, 55], trumpet_mute: [58, 81],
  bassoon: [34, 70], clarinet: [50, 86], glass: [75, 86], psaltery: [70, 90], vibes_bowed: [57, 88], vibes: [53, 89],
  kalimba: [59, 83], harpsichord: [41, 96], organ: [36, 96], ocarina: [69, 86],
});
const M = { kit: "metals" };

// Glass ghost: rubbed wine glasses overlapping high up, a bowed vibraphone chord under them that shifts every few
// seconds, a double bass you barely hear. The glasses gather into a cluster where she is closest.
CUE("glass_ghost", {
  family: "expanded", level: -12, label: "Glass ghost", uses: ["ghost", "presence", "she's here", "memory", "the cold room"],
  desc: "Rubbed wine glasses overlapping high up, a bowed vibraphone chord shifting under them, a double bass felt more than heard; the glasses gather into a cluster where she's closest.",
  refs: "the glass harmonica in ghost films, Hereditary's quiet rooms, Kwaidan's (Takemitsu) cold textures",
  params: { key: P.key(1, "lydian", ["lydian", "aeolian", "whole_tone"]), len: P.len(22, 10, 44), presence: P.amt("presence (the cluster)", 0.6), metal: P.amt("bowed metal", 0.5), floor: P.amt("double bass", 0.3) },
  gen(t, p) {
    const k = p.key, L = p.len, r = t.rng;
    t.beat(60, [4, 4]);
    const peak = L * 0.62, chords = [0, 5, 3, 1];
    for (let s = 0, i = 0; s < L; s += 7, i++) {
      if (p.metal > 0.05) triad(k, chords[i % 4], 57, 3).forEach((m, j) => t.n("vibes_bowed", m, s + j * 0.6 + t.human(0.2), Math.min(8, L - s + 2), 26 + 34 * p.metal, { attack: 2.5 }));
      if (p.floor > 0.05) t.n("cbass_sus", deg(k, chords[i % 4], 28), s, Math.min(8, L - s + 2), 18 + 30 * p.floor, { attack: 3 });
    }
    // the glasses: one at a time, slowly, then more of them nearer the peak
    for (let s = r.range(0.5, 2.5); s < L - 1.5; s += r.range(2.2, 4.2)) {
      const near = 1 - Math.min(1, Math.abs(s - peak) / (L * 0.4)), n = 1 + (near > 0.6 && r.chance(p.presence) ? 2 : 0);
      for (let j = 0; j < n; j++) t.n("glass", deg(k, r.int(0, 6) + j, 72), s + j * 0.35, r.range(4, 7), 30 + 40 * near, { attack: 1.8 });
    }
    // the cluster: three glasses a semitone or a tone apart, where she is
    if (p.presence > 0.2) { [0, 1, 2].forEach(i => t.n("glass", 76 + mod(k.tonic, 12) % 6 + i * (p.presence > 0.6 ? 1 : 2), peak - 0.8 + i * 0.25, 6, 50 + 30 * p.presence, { attack: 0.8, raw: true })); t.point(peak, "she's here"); }
    if (p.metal > 0.4) t.hit("windchimes", peak + 0.6, 40 + 30 * p.metal, M);
    t.end(L);
  },
});

// The psaltery's haunting: a slow wavering tune on the bowed psaltery (each long note sags a little at its end),
// bowed vibraphone chords and a double bass drone. A ghost humming the game's theme.
CUE("psaltery_haunt", {
  family: "expanded", level: -10, motif: true, label: "Psaltery haunting", uses: ["haunted", "ghost humming", "lullaby", "the old house", "her song"],
  desc: "A slow, wavering tune on a bowed psaltery (a singing-saw tone; long notes sag at their ends), bowed vibraphone chords and a double bass drone.",
  refs: "the singing saw in Delicatessen and Twin Peaks, Silent Hill's lullabies, Pan's Labyrinth's lullaby hummed",
  params: { key: P.key(9, "aeolian", ["aeolian", "dorian", "harmonic_minor"]), tempo: P.tempo(54, 40, 72), len: P.len(26, 12, 48), sag: P.amt("sag", 0.5), chords: P.amt("bowed chords", 0.5) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo, [4, 4]), bar = 4 * spb, bars = Math.max(2, Math.round(p.len / bar)), prog = [0, 5, 3, 4];
    const line = p.motif ? motifLine(p.motif, 4) : [[4, 2, 0], [3, 1, 0], [2, 1, 0], [1, 3, 1], [-1, 1, 1], [2, 2, 2], [4, 2, 2], [0, 4, 3], [4, 2, 4], [5, 1, 4], [4, 1, 4], [2, 3, 5], [1, 1, 5], [0, 2, 6], [1, 2, 6], [0, 4, 7]];
    let at = bar * 0.5;
    while (at < bars * bar - spb) for (const [d, beats] of line) {
      if (at >= bars * bar - spb) break;
      const dur = beats * spb;
      t.n("psaltery", deg(k, d + 7, 60), at + t.human(0.03), dur * 0.97, t.vel(58), dur > 1.2 && p.sag > 0.1 ? { attack: 0.25, bend: { semis: -0.35 * p.sag, at: dur * 0.65, dur: dur * 0.3 } } : { attack: 0.15 });
      at += dur;
    }
    for (let b = 0; b < bars; b += 2) {
      const d = prog[(b / 2) % 4];
      t.n("cbass_sus", deg(k, d, 28), b * bar, bar * 2.1, 30, { attack: 1.5 });
      if (p.chords > 0.1) triad(k, d, 57, 3).forEach((m, j) => t.n("vibes_bowed", m, b * bar + j * 0.4, bar * 2, 22 + 30 * p.chords, { attack: 2 }));
    }
    t.n("cbass_sus", deg(k, 0, 28), bars * bar, 4, 30, { attack: 0.5 });
    t.end(bars * bar + 3);
  },
});

// Double-bass dread: a low double bass pedal with tremolo swells, the tuba under it, a bassoon and a low clarinet
// creeping chromatically, a bowed brake drum now and then. Something big is in the basement.
CUE("bass_dread", {
  family: "expanded", level: -13, label: "Double-bass dread", uses: ["basement", "something big", "dread", "underground", "it's below you"],
  desc: "A double bass pedal with tremolo swells, the tuba under it, a bassoon and a low clarinet creeping by semitones, a bowed brake drum now and then.",
  refs: "Jaws' low strings, The Thing (Morricone's pulse), Alien's low winds",
  params: { key: P.key(4, "phrygian", ["phrygian", "locrian", "aeolian"]), len: P.len(24, 10, 48), depth: P.amt("tuba depth", 0.5), creep: P.amt("the creeping line", 0.6), metal: P.amt("bowed metal", 0.4) },
  gen(t, p) {
    const k = p.key, L = p.len, r = t.rng, root = 28 + mod(k.tonic - 4, 12);
    t.beat(60, [4, 4]);
    for (let s = 0; s < L; s += 6.5) {
      t.n("cbass_sus", root, s, Math.min(7.5, L - s + 2), 52, { attack: 1.5, raw: true });
      if (r.chance(0.6)) t.n("cbass_trem", root + r.pick([7, 6, 1]), s + r.range(1.5, 3), 4, 30 + r.int(0, 25), { attack: 2.5, raw: true });
      if (p.depth > 0.1) t.n("tuba", root + 12, s + 0.5, Math.min(6, L - s), 28 + 40 * p.depth, { attack: 2, raw: true });
    }
    if (p.creep > 0.1) {                                       // a line climbing by semitones and slipping back
      let m = root + 12 + 7, s = L * 0.2;
      while (s < L - 2) {
        const inst = r.chance(0.55) ? "bassoon" : "clarinet";
        t.n(inst, inst === "clarinet" ? Math.max(50, m + 12) : m, s, r.range(1.6, 3), 34 + 30 * p.creep, { attack: 0.4, raw: true });
        m += r.chance(0.7) ? 1 : -2; if (m > root + 12 + 14) m -= 5;
        s += r.range(2.2, 3.6) / (0.6 + p.creep);
      }
    }
    if (p.metal > 0.1) for (let s = r.range(4, 8); s < L - 2; s += r.range(7, 12)) { t.hit(r.chance(0.5) ? "brake_bow" : "brake_bow2", s, 40 + 50 * p.metal, M); t.mark(s, "bowed metal"); }
    t.end(L);
  },
});

// Brass falls: a low trombone chorale swelling, then the notes fall away (trombone falls) over the tuba, a buzzing
// growl under the biggest one. The thing is real and it is huge.
CUE("brass_falls", {
  family: "expanded", level: -8, label: "Brass falls", uses: ["reveal", "something big", "doom", "it's real", "the floor drops"],
  desc: "A low trombone chorale swells, then its notes fall away (trombone falls) over a tuba pedal; a buzzing growl under the biggest fall.",
  refs: "Inception's horn blasts (in spirit), Jerry Goldsmith's brass in The Omen, A Quiet Place's low brass",
  params: { key: P.key(2, "aeolian", ["aeolian", "phrygian", "locrian"]), len: P.len(14, 6, 28), menace: P.amt("menace", 0.6), growl: P.amt("growl", 0.5), falls: P.pick("falls", ["one big", "three", "a cascade"]) },
  gen(t, p) {
    const k = p.key, L = p.len, r = t.rng, root = 29 + mod(k.tonic - 5, 12);
    t.beat(60, [4, 4]);
    const swell = Math.max(2.5, L * 0.35);
    [0, 2, 4].forEach((d, i) => t.n("trombone", deg(k, d, 41), 0.1 + i * 0.4, swell + 0.4, 50 + 40 * p.menace, { attack: swell * 0.7 }));
    t.n("tuba", root, 0, L - 1, 46 + 40 * p.menace, { attack: 1.5, raw: true });
    const n = { "one big": 1, three: 3, "a cascade": 6 }[p.falls], first = swell + 0.2;
    for (let i = 0; i < n; i++) {
      const at = first + i * (n > 3 ? 0.45 : 1.6), m = deg(k, 4 - i, 48);
      t.n("trombone_fall", m, at, null, 90 - i * 6, {});
      if (i === 0) {
        t.point(at, "the drop");
        if (p.growl > 0.1) t.n("trombone_buzz", root + 12, at + 0.05, 2.5, 40 + 50 * p.growl, { raw: true });
        t.hit("timp_roll", at - 1.2, 50 + 30 * p.menace); t.hit("bass_drum", at, 100);
      }
    }
    if (L > first + 4) [0, 2].forEach((d, i) => t.n("trombone", deg(k, d, 41) - (i ? 1 : 0), first + 3.5 + i * 0.3, L - first - 3.5, 30 + 30 * p.menace, { attack: 1.5 }));
    t.end(L);
  },
});

// The metal screech: the J-horror sound, a bowed brake drum, a bowed cymbal and a gong scrape rising together into a
// struck hit, then a tail (nothing, the flexatone's wobble or a ratchet's croak). For the frame she appears.
CUE("metal_screech", {
  family: "expanded", level: -2, label: "Metal screech (J-horror)", uses: ["the screech", "ghost appears", "j-horror sting", "ringu", "she appears"],
  desc: "Bowed metal rising (a brake drum, a cymbal, a gong scraped) into a struck hit with a low double bass pluck, then a tail: silence, the flexatone's wobble or a ratchet's croak.",
  refs: "Ringu's grating metallic screech (Kenji Kawai), Ju-On's croak, Penderecki's scraped percussion",
  params: { build: { kind: "num", def: 2.5, min: 0.5, max: 6, step: 0.25, label: "build (s)" }, screech: P.amt("screech", 0.7), tail: P.pick("tail", ["flexatone", "ratchet", "silence", "siren"]) },
  gen(t, p) {
    const b = p.build, r = t.rng;
    t.beat(60, [4, 4]);
    t.hit("cym_bowed", 0, 50 + 40 * p.screech, M);
    if (b > 1) t.hit(r.chance(0.5) ? "brake_bow" : "brake_bow2", b * 0.25, 60 + 40 * p.screech, M);
    if (p.screech > 0.4) t.hit("gong_scrape", Math.max(0, b - 1.6), 70 + 40 * p.screech, M);
    t.hit("brake_hit", b, 120, M); t.hit("metal_hit", b, 100, M);
    t.n("cbass_pizz", 30, b, 1, 120, { raw: true }); t.hit("bass_drum", b, 110);
    t.point(b, "the screech");
    const tail = { flexatone: "flexatone", ratchet: "ratchet", siren: "siren" }[p.tail];
    if (tail) t.hit(tail, b + 0.5, 70 + 30 * p.screech, M);
    t.end(b + (tail ? 4 : 2));
  },
});

// Rattles and wobbles: an uneven pulse of the ratchet's croak, a vibraslap, a flexatone and a bell tree, an ocean
// drum's rush, a stray kalimba note. Something crawling down the hall.
CUE("rattle_crawl", {
  family: "expanded", level: -10, label: "Rattles and wobbles", uses: ["crawling", "the croak", "hallway", "j-horror", "something in the walls"],
  desc: "An uneven pulse of a ratchet's croak, a vibraslap, a flexatone and a bell tree, an ocean drum's rush, a stray kalimba note; it gets closer.",
  refs: "Ju-On's croak (Kayako), Kwaidan's (Takemitsu) percussion, the Grudge's crawl",
  params: { len: P.len(16, 6, 32), density: P.amt("density", 0.5), closer: P.amt("gets closer", 0.6), toy: P.amt("stray kalimba", 0.3) },
  gen(t, p) {
    const L = p.len, r = t.rng, pieces = [["ratchet", 4], ["vibraslap", 2], ["flex_slap", 2], ["belltree", 1], ["ratchet_fast", 1], ["flex_fast", 1]];
    t.beat(60, [4, 4]);
    for (let s = r.range(0, 1); s < L - 0.5; s += r.range(0.9, 2.6) / (0.5 + p.density)) {
      const near = p.closer * s / L;
      t.hit(r.weighted(pieces), s, 40 + 60 * near + r.int(0, 15), Object.assign({ pan: r.range(-0.6, 0.6) * (1 - near) }, M));
    }
    for (let s = 0; s < L; s += 7) t.hit("ocean", s + r.range(0, 1.5), 30 + 30 * p.closer * s / L, M);
    if (p.toy > 0.1) for (let s = r.range(2, 5); s < L - 1; s += r.range(3, 7) / p.toy) t.n("kalimba", r.pick([61, 66, 68, 73, 78]), s, null, 40 + 20 * p.toy, { raw: true, cents: r.range(-25, 25) });
    if (p.closer > 0.5) { t.hit("ratchet", L - 1, 115, M); t.point(L - 1, "right behind you"); }
    t.end(L);
  },
});

// The funeral organ: a quiet pipe organ chorale in four parts, minor and slow, a trombone doubling the bass; on the
// last phrase one chord comes out wrong. A funeral, the shrine, the wedding that shouldn't happen.
CUE("funeral_organ", {
  family: "expanded", level: -8, motif: true, label: "Funeral organ", uses: ["funeral", "shrine", "church", "the wedding", "mourning"],
  desc: "A quiet pipe organ chorale in four parts, slow and minor, a soft trombone doubling the bass; on the last phrase one chord comes out wrong.",
  refs: "Bach chorales played too slowly, The Omen's church, Hereditary's funeral",
  params: { key: P.key(2, "aeolian", ["aeolian", "harmonic_minor", "dorian"]), tempo: P.tempo(48, 36, 66), len: P.len(24, 12, 48), wrong: P.amt("the wrong chord", 0.5), brass: P.amt("trombone", 0.4) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo, [4, 4]), r = t.rng, prog = [0, 3, 4, 0, 5, 3, 1, 4, 0, 5, 3, 4];
    const chords = Math.max(4, Math.round(p.len / (2 * spb)));
    const top = p.motif ? motifLine(p.motif, 4).map(x => x[0]) : null;
    for (let i = 0; i < chords; i++) {
      const at = i * 2 * spb, d = i === chords - 1 ? 0 : prog[i % prog.length], last = i >= chords - 3;
      const ch = triad(k, d, 48, 3);
      let sop = top ? deg(k, top[i % top.length] + 7, 60) : ch[0] + 24;
      const wrongHere = last && i === chords - 2 && r.chance(0.3 + p.wrong * 0.7);
      t.n("organ", deg(k, d, 36), at, 2 * spb * 0.98, t.vel(60), { raw: true });
      [ch[1], ch[2]].forEach(m => t.n("organ", m + (wrongHere ? 1 : 0), at, 2 * spb * 0.98, t.vel(54)));
      t.n("organ", sop, at, 2 * spb * 0.98, t.vel(62));
      if (wrongHere) t.mark(at, "the wrong chord");
      if (p.brass > 0.1) t.n("trombone", deg(k, d, 41), at, 2 * spb * 0.95, 26 + 40 * p.brass, { attack: 0.5 });
    }
    t.n("organ", deg(k, 0, 36), chords * 2 * spb, 4, 58, { raw: true }); t.n("organ", deg(k, 2, 60), chords * 2 * spb, 4, 50);
    t.end(chords * 2 * spb + 4);
  },
});

// The haunted minuet: a harpsichord minuet in minor in the empty ballroom, a bassoon on the bass line, a wrong note
// at the cadence, slowing as if the player were tiring (or dead).
CUE("haunted_minuet", {
  family: "expanded", level: -7, motif: true, label: "Haunted harpsichord", uses: ["the mansion", "the ballroom", "old house", "mock elegance", "dinner with her"],
  desc: "A harpsichord minuet in minor (a tune over broken chords), a bassoon on the bass line, a wrong note at each cadence, slowing towards the end.",
  refs: "Barry Lyndon's sarabande (in spirit), Crimson Peak's ballroom, Bloodborne's music boxes",
  params: { key: P.key(4, "harmonic_minor", ["harmonic_minor", "aeolian", "dorian"]), tempo: P.tempo(112, 84, 140), len: P.len(20, 10, 40), wrong: P.amt("wrong notes", 0.5), slowing: P.amt("slowing", 0.5), bassoon: P.amt("bassoon", 0.5) },
  gen(t, p) {
    const k = p.key, spb0 = t.beat(p.tempo, [3, 4]), r = t.rng, prog = [0, 3, 4, 0, 5, 1, 4, 0];
    const bars = Math.max(8, Math.round(p.len / (3 * spb0)));
    const tune = p.motif ? motifLine(p.motif, 3) : [[4, 1, 0], [2, 1, 0], [4, 1, 0], [5, 2, 1], [3, 1, 1], [4, 1, 2], [2, 1, 2], [0, 1, 2], [1, 3, 3], [2, 1, 4], [4, 1, 4], [7, 1, 4], [6, 2, 5], [4, 1, 5], [2, 1, 6], [1, 1, 6], [6, 1, 6], [0, 3, 7]];
    let at = 0;
    const beatAt = [];                                         // each beat's start, slowing in the last bars
    for (let b = 0; b < bars + 1; b++) for (let i = 0; i < 3; i++) { beatAt.push(at); at += spb0 * (1 + p.slowing * 0.8 * Math.max(0, (b - bars * 0.6) / (bars * 0.4)) ** 2); }
    const T = beat => beatAt[Math.min(beatAt.length - 1, Math.floor(beat))] + (beat % 1) * spb0;
    for (let b = 0; b < bars; b++) {
      const d = prog[b % prog.length], ch = triad(k, d, 52, 3);
      t.n("harpsichord", deg(k, d, 40), T(b * 3), spb0 * 2.5, t.vel(60));
      [ch[0], ch[1], ch[2], ch[1]].forEach((m, i) => i && t.n("harpsichord", m, T(b * 3 + i * 0.75 + 0.25), spb0 * 0.7, t.vel(46)));
      if (p.bassoon > 0.1) t.n("bassoon", deg(k, d, 40), T(b * 3), spb0 * 2.8, 30 + 40 * p.bassoon, { attack: 0.05 });
    }
    let beat = 0;
    while (beat < bars * 3 - 1) for (const [d, beats, bar] of tune) {
      if (beat >= bars * 3 - 1) break;
      const cadence = bar % 4 === 3 && beats >= 2;
      const slip = cadence && r.chance(p.wrong) ? 1 : 0;
      t.n("harpsichord", deg(k, d + 7, 60) + slip, T(beat), beats * spb0 * 0.9, t.vel(70));
      if (slip) t.mark(T(beat), "wrong note");
      beat += beats;
    }
    t.n("harpsichord", deg(k, 0, 40), T(bars * 3), null, 64); t.n("harpsichord", deg(k, 0, 64), T(bars * 3), null, 60);
    t.end(T(bars * 3) + 3);
  },
});

// The kalimba lullaby: the lullaby on a slightly out-of-tune kalimba, soft vibraphone chords, an ocarina answering
// each phrase, a glass shimmer at the end. A child's toy, remembered.
CUE("kalimba_lullaby", {
  family: "expanded", level: -9, motif: true, label: "Kalimba lullaby", uses: ["lullaby", "child", "toy", "memory", "her room"],
  desc: "A lullaby on a slightly out-of-tune kalimba over soft vibraphone chords, an ocarina answering each phrase, wine glasses at the end.",
  refs: "Hotel del Luna's gentle ghosts, Spirited Away's (Hisaishi) small tunes, Coraline's lullabies",
  params: { key: P.key(7, "major_pent", ["major_pent", "ionian", "aeolian"]), tempo: P.tempo(76, 56, 96), len: P.len(20, 10, 40), detune: P.amt("out of tune", 0.4), ocarina: P.amt("ocarina", 0.5) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo, [3, 4]), bar = 3 * spb, r = t.rng, prog = [0, 3, 4, 0];
    const bars = Math.max(4, Math.round(p.len / bar));
    const line = p.motif ? motifLine(p.motif, 3) : [[4, 1, 0], [2, 1, 0], [4, 1, 0], [3, 2, 1], [1, 1, 1], [2, 1, 2], [1, 1, 2], [0, 1, 2], [1, 3, 3], [4, 1, 4], [2, 1, 4], [4, 1, 4], [5, 2, 5], [4, 1, 5], [2, 1, 6], [1, 1, 6], [1, 1, 6], [0, 3, 7]];
    let at = 0;
    while (at < bars * bar - spb) for (const [d, beats, b] of line) {
      if (at >= bars * bar - spb) break;
      t.n("kalimba", deg(k, d, 60), at + t.human(0.012), null, t.vel(64), { cents: r.gauss(0, 25 * p.detune) });
      if (p.ocarina > 0.1 && b % 4 === 3 && beats >= 2) t.n("ocarina", deg(k, d + 4, 72), at + spb, 2 * spb, 30 + 30 * p.ocarina, { attack: 0.2 });
      at += beats * spb;
    }
    for (let b = 0; b < bars; b++) triad(k, prog[b % 4], 55, 3).forEach(m => t.n("vibes", m, b * bar, bar * 1.5, t.vel(38)));
    [0, 2, 4].forEach((d, i) => t.n("glass", deg(k, d, 72), bars * bar + i * 0.3, 5, 40, { attack: 1 }));
    t.end(bars * bar + 5);
  },
});

// Muted trumpet noir: a lonely harmon-muted trumpet over a walking double bass and soft vibraphone chords, a minor
// blues with its flat fifth. A night street, a bar after closing, a detective who shouldn't have come.
CUE("noir_trumpet", {
  family: "expanded", level: -8, label: "Muted trumpet noir", uses: ["night street", "lonely", "the bar", "detective", "rain"],
  desc: "A lonely harmon-muted trumpet over a walking double bass and soft vibraphone chords: a slow minor blues with its flat fifth.",
  refs: "Chinatown (Goldsmith's trumpet), Twin Peaks' jazz, Taxi Driver (Herrmann's saxophone, in spirit)",
  params: { key: P.key(5, "dorian", ["dorian", "aeolian"]), tempo: P.tempo(66, 52, 84), len: P.len(24, 12, 48), trumpet: P.amt("trumpet", 0.7), walk: P.amt("walking bass", 0.6) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo, [4, 4]), bar = 4 * spb, r = t.rng, blues = [0, 0, 3, 0, 4, 3, 0, 4];
    const bars = Math.max(4, Math.round(p.len / bar)), scale = [0, 3, 5, 6, 7, 10];
    for (let b = 0; b < bars; b++) {
      const d = blues[b % 8], root = deg(k, d, 36);
      if (p.walk > 0.1) [0, 7, 10, 6].forEach((iv, i) => t.n("cbass_pizz", root + (i === 3 && r.chance(0.5) ? 11 : iv), b * bar + i * spb + t.human(0.01), spb * 0.9, t.vel(56 + 30 * p.walk) - (i ? 6 : 0)));
      [3, 7, 10].forEach(iv => t.n("vibes", root + 24 + iv, b * bar + spb * (b % 2 ? 1.5 : 0), bar, t.vel(34)));
    }
    if (p.trumpet > 0.1) {
      let at = bar * 0.5 + spb * 0.5;
      while (at < bars * bar - bar) {
        const n = r.int(2, 4);
        for (let i = 0; i < n; i++) {
          const m = 60 + mod(k.tonic, 12) + r.pick(scale) + (r.chance(0.25) ? 12 : 0), dur = i === n - 1 ? r.range(1.5, 2.5) * spb : r.pick([0.5, 1, 1.5]) * spb;
          t.n("trumpet_mute", m, at, dur * 0.95, t.vel(50 + 30 * p.trumpet), i === n - 1 ? { attack: 0.1, bend: { semis: -0.5, at: dur * 0.7, dur: dur * 0.25 } } : {});
          at += dur;
        }
        at += r.range(1.5, 3) * spb;
      }
    }
    t.end(bars * bar + 2);
  },
});

// Solo violin lament: one violin sighing a slow tune (falling seconds that bend at their ends) over a cello chord and
// a double bass root. Her letter, the grief after.
CUE("solo_lament", {
  family: "expanded", level: -9, motif: true, label: "Solo violin lament", uses: ["grief", "her letter", "lament", "she's gone", "the aftermath"],
  desc: "One violin sighing a slow tune (falling seconds that sag at their ends) over held cello chords and a double bass root.",
  refs: "Schindler's List (Williams; the solo violin), Silent Hill 2's 'Theme of Laura' slowed, Oldboy's 'The Last Waltz'",
  params: { key: P.key(2, "aeolian", ["aeolian", "harmonic_minor", "dorian"]), tempo: P.tempo(52, 40, 70), len: P.len(26, 12, 48), sigh: P.amt("sighs", 0.6), cellos: P.amt("cellos", 0.5) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo, [4, 4]), bar = 4 * spb, prog = [0, 5, 3, 4];
    const bars = Math.max(2, Math.round(p.len / bar));
    const line = p.motif ? motifLine(p.motif, 4) : [[4, 2, 0], [3, 2, 0], [2, 3, 1], [1, 1, 1], [2, 2, 2], [0, 2, 2], [1, 4, 3], [5, 2, 4], [4, 2, 4], [3, 3, 5], [2, 1, 5], [1, 2, 6], [-1, 2, 6], [0, 4, 7]];
    let at = bar * 0.5;
    while (at < bars * bar - spb) for (const [d, beats] of line) {
      if (at >= bars * bar - spb) break;
      const dur = beats * spb;
      t.n("vln_solo", deg(k, d + 7, 62), at + t.human(0.02), dur * 0.96, t.vel(66), dur >= 2 * spb && p.sigh > 0.1 ? { attack: 0.3, bend: { semis: -0.4 * p.sigh, at: dur * 0.75, dur: dur * 0.2 } } : { attack: 0.12 });
      at += dur;
    }
    for (let b = 0; b < bars; b++) {
      const d = prog[b % 4];
      t.n("cbass_sus", deg(k, d, 28), b * bar, bar * 1.02, 34, { attack: 0.8 });
      if (p.cellos > 0.1) triad(k, d, 48, 3).forEach(m => t.n("cello_sus", m, b * bar, bar * 1.02, 24 + 30 * p.cellos, { attack: 1.2 }));
    }
    t.n("vln_solo", deg(k, 0, 62), bars * bar, 3.5, 50, { attack: 0.5 }); t.n("cbass_sus", deg(k, 0, 28), bars * bar, 4, 34, { attack: 0.5 });
    t.end(bars * bar + 3);
  },
});

// Siren and chimes: a toy siren whistle rising and falling far off, wind chimes, glockenspiel glissandi up and down,
// a cymbal crescendo; an empty playground at night.
CUE("siren_chimes", {
  family: "expanded", level: -11, label: "Siren and chimes", uses: ["empty playground", "far off", "the wind", "unease", "night outside"],
  desc: "A toy siren whistle rising and falling far off, wind chimes, glockenspiel glissandi up and down, a slow cymbal crescendo into nothing.",
  refs: "Silent Hill's air-raid siren (in spirit, small and far), It Follows' unease, a schoolyard at night",
  params: { len: P.len(18, 8, 36), siren: P.amt("siren", 0.5), chimes: P.amt("chimes", 0.6), swell: P.amt("cymbal swell", 0.5) },
  gen(t, p) {
    const L = p.len, r = t.rng;
    t.beat(60, [4, 4]);
    if (p.siren > 0.1) for (let s = r.range(1, 3); s < L - 3; s += r.range(6, 10)) t.hit("siren", s, 30 + 50 * p.siren, Object.assign({ pan: r.range(-0.8, 0.8) }, M));
    if (p.chimes > 0.1) for (let s = r.range(0, 2); s < L - 2; s += r.range(4, 8) / p.chimes) t.hit(r.chance(0.6) ? "windchimes" : r.chance(0.5) ? "gliss_up" : "gliss_down", s, 30 + 50 * p.chimes, Object.assign({ pan: r.range(-0.5, 0.5) }, M));
    if (p.swell > 0.1) { t.hit("cym_cresc", Math.max(0, L - 4.5), 40 + 50 * p.swell, M); t.mark(L - 0.5, "into nothing"); }
    t.end(L);
  },
});

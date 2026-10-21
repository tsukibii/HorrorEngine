// Romance horror: the cues our games live in, where she is sweet and wrong at once. A love theme with something off
// in it, the sweet music that turns, the yandere waltz with the dread under the floor, the pounding heart that could
// be love or fear, the timed choice's clock, the reply's answer (warm, cold, uncanny), the close moment, the ending.
// The trick of all of them (docs/MUSIC_RESEARCH.md): keep the sweetness honest and let one thing be wrong.
"use strict";

// Her theme: a tender love theme (piano melody over warm left-hand chords) with one wrongness that comes back each
// time the phrase does: an augmented chord where the IV should be, a flattened note in the tune, or a low cluster
// under the cadence. Which one, and how loud, is the parameter.
CUE("her_theme", {
  family: "crossover", label: "Her theme (something off)", uses: ["her theme", "romance", "yandere", "first meeting", "at home with her"],
  desc: "A tender piano love theme over warm chords, with one wrong thing that comes back every phrase: an augmented chord, a flattened note in the tune or a low cluster under the cadence.",
  refs: "Doki Doki Literature Club's 'Your Reality' (sweet piano hiding the wrong), Mirai Nikki's Yuno cues, the 'Ending' piano of Silent Hill 2",
  params: { key: P.key(7, "ionian", ["ionian", "lydian"]), tempo: P.tempo(70, 56, 88), len: P.len(24, 10, 48),
            wrongness: P.pick("the wrong thing", ["augmented chord", "flat note", "low cluster", "all three"]), amount: P.amt("how wrong", 0.4), strings: P.amt("strings", 0.4) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo, [4, 4]), bar = 4 * spb, r = t.rng;
    const prog = [0, 5, 3, 4], tune = [[4, 2], [2, 1], [0, 1], [4, 2], [5, 1], [4, 1], [2, 4], [1, 2], [2, 1], [3, 1], [4, 3], [2, 1], [0, 4]];
    const bars = Math.max(2, Math.round(p.len / bar)), w = p.wrongness, all = w === "all three";
    // the tune, as many times as fits; its fifth note goes flat on every pass after the first ("flat note")
    let s = 0, pass = 0;
    while (s < bars * bar - 2 * spb) {
      let at = s;
      tune.forEach(([d, beats], i) => {
        if (at >= bars * bar) return;
        let m = deg(k, d, 72);
        if ((w === "flat note" || all) && i === 4 && pass > 0 && r.chance(0.4 + p.amount)) { m -= 1; t.mark(at, "the flat note"); }
        t.n("piano", m, at + t.human(0.015), beats * spb * 0.95, t.vel(i === 0 ? 66 : 58));
        at += beats * spb;
      });
      s = at; pass++;
    }
    for (let b = 0; b < bars; b++) {
      const d = prog[b % 4], at = b * bar;
      let ch = triad(k, d, 48, 3);
      if ((w === "augmented chord" || all) && d === 3 && b >= 4 && r.chance(0.5 + p.amount / 2)) { ch = [ch[0], ch[0] + 4, ch[0] + 8]; t.mark(at, "augmented"); }
      t.n("piano", deg(k, d, 36), at + t.human(), bar, t.vel(52), { raw: true });
      ch.forEach((m, i) => t.n("piano", m + 12, at + spb * (1 + i) + t.human(), spb * 2, t.vel(40)));
      if (p.strings > 0.1 && b >= 2) t.n("strings", ch[1] + 12, at, bar * 1.02, 22 + 34 * p.strings, { attack: spb * 1.5 });
      if ((w === "low cluster" || all) && b % 4 === 3) {
        const low = 28 + k.tonic + (k.tonic > 7 ? 0 : 12);
        [0, 1, 2].forEach(i => t.n("piano", low + i, at + 2 * spb + i * 0.03, bar, t.vel(26 + 40 * p.amount), { raw: true }));
        t.mark(at + 2 * spb, "the cluster under her");
      }
    }
    t.chord("piano", triad(k, 0, 60, 4), bars * bar, null, 50, { roll: 0.09 });
    t.end(bars * bar + 3);
  },
});

// Sweet, then wrong: a romance underscore that turns at a point (her smile stays and the music doesn't): the major
// harmony slides a semitone, the strings bend down, a low piano note lands under it all. The turn is a hit point.
CUE("sweet_then_wrong", {
  family: "crossover", label: "Sweet, then wrong", uses: ["the turn", "reveal", "her smile", "yandere", "date"],
  desc: "A warm romance underscore (rolling piano, strings) that turns at the hit: the harmony slides down a semitone, the strings bend down into a cluster, a low note lands.",
  refs: "School Days' last episode, Gone Girl's warm-cold score (Reznor and Ross), the Parasite 'Belt of Faith' turn",
  params: { key: P.key(2, "ionian"), tempo: P.tempo(76, 60, 92), turn_at: P.amt("where it turns (share)", 0.6), len: P.len(16, 8, 32),
            how: P.pick("how it turns", ["slide down", "bend", "stop dead", "music box"]), afterglow: P.amt("what's left after", 0.5) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo, [4, 4]), bar = 4 * spb, prog = PROGS.pop;
    const turn = Math.max(bar * 2, Math.round(p.len * p.turn_at / spb) * spb), end = Math.max(turn + 3, p.len);
    for (let b = 0; b * bar < turn; b++) {
      const at = b * bar, d = prog[b % 4], ch = triad(k, d, 60, 3);
      [deg(k, d, 48), ch[0], ch[1], ch[2], ch[1], ch[0] + 12, ch[2], ch[1]].forEach((m, i) => { if (at + i * spb / 2 < turn) t.n("piano", m, at + i * spb / 2 + t.human(0.01), spb, t.vel(i ? 46 : 58)); });
      if (b >= 1) t.n("strings", ch[2], at, Math.min(bar, turn - at) + 0.1, 40, { attack: spb });
    }
    t.point(turn, "the turn");
    const root = deg(k, 0, 48), low = 28 + k.tonic + (k.tonic > 7 ? 0 : 12);
    t.n("piano", low, turn, null, 92, { raw: true });
    t.n("piano", low + 1, turn + 0.02, null, 70, { raw: true });
    if (p.how === "slide down") {
      [root - 1, root + 3, root + 6].forEach(m => t.n("strings", m, turn, end - turn, 52, { attack: 0.4 }));
      t.n("trem", root + 23, turn + 0.5, end - turn - 0.5, 30 + 30 * p.afterglow, { attack: 2 });
    } else if (p.how === "bend") {
      [root, root + 4, root + 7, root + 12].forEach((m, i) => t.n("strings", m, turn - 0.05, end - turn, 50, { bend: { semis: -(1 + i % 2), at: 0.1, dur: 1.6 } }));
    } else if (p.how === "stop dead") {
      t.mark(turn, "silence"); if (p.afterglow > 0.2) t.n("piano", deg(k, 6, 84) + 1, turn + 2.2, null, 34);
    } else {
      const tune = [0, 2, 4, 2, 0, -1, 4, 6].map(d => deg(k, d, 84));
      tune.forEach((m, i) => t.n("glock", m - (i > 3 ? 1 : 0), turn + 0.6 + i * spb * (0.5 + i * 0.08), null, t.vel(50), { cents: -12 * i }));
    }
    t.end(end + 2);
  },
});

// The yandere waltz: a pretty 3/4 waltz on top (harp or piano, a flute line), and under the floor a low tremolo
// cluster that never stops, getting louder each phrase: she is dancing, the house is not.
CUE("yandere_waltz", {
  family: "crossover", label: "Yandere waltz", uses: ["yandere", "dance", "her room", "dinner with her", "obsession"],
  desc: "A pretty waltz (harp or piano with a flute line) over a low string tremolo cluster that never stops and grows each phrase.",
  refs: "Danganronpa's sweet-menacing waltzes, the Shining ballroom (Al Bowlly over the dread), Mirai Nikki",
  params: { key: P.key(9, "harmonic_minor", ["harmonic_minor", "aeolian", "ionian"]), tempo: P.tempo(132, 100, 168), len: P.len(24, 12, 48),
            top: P.pick("the dance", ["harp", "piano", "glock"]), dread: P.amt("dread under it", 0.5), flute: P.amt("flute line", 0.6) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo, [3, 4]), bar = 3 * spb, prog = [0, 3, 4, 0, 5, 3, 4, 4];
    const bars = Math.max(8, Math.round(p.len / bar)), low = 31 + k.tonic + (k.tonic > 5 ? 0 : 12);
    for (let b = 0; b < bars; b++) {
      const at = b * bar, d = prog[b % 8], ch = triad(k, d, 60, 3);
      t.n(p.top, deg(k, d, 48), at + t.human(), spb * 0.9, t.vel(62));
      [1, 2].forEach(i => t.n(p.top, ch[1] + (i === 2 ? 12 : 0), at + i * spb + t.human(), spb * 0.5, t.vel(44)));
      t.n(p.top, ch[0] + 12, at + spb + t.human(), spb * 0.5, t.vel(42));
      if (p.flute > 0.2 && b % 2 === 0) {
        const line = [ch[2] + 12, ch[1] + 12, ch[0] + 12].map(m => fitReg("flute", m));
        t.n("flute", line[0], at, spb * 2, t.vel(52)); t.n("flute", line[1], at + spb * 2, spb, t.vel(46)); t.n("flute", line[2], at + bar, bar * 0.9, t.vel(48));
      }
      if (b % 4 === 0) {
        const phrase = b / 4, v = 18 + 50 * p.dread * Math.min(1, (phrase + 1) / (bars / 4));
        [0, 1, 6].forEach(i => t.n("trem", low + 12 + i, at, bar * 4 + 0.2, v, { attack: bar, raw: true }));
        if (phrase >= 1 && p.dread > 0.4) t.n("piano", low, at, null, 30 + 40 * p.dread, { raw: true });
      }
    }
    t.n("piano", low, bars * bar, null, 70, { raw: true }); t.n("piano", low + 6, bars * bar + 0.02, null, 56, { raw: true });
    t.point(bars * bar, "the last step");
    t.end(bars * bar + 3);
  },
});

// The pounding heart: a heartbeat on the timpani under a romance chord that won't settle; the pulse quickens,
// the harmony slides between love (a major seventh) and fear (a minor ninth). Is it love or fear? Both.
CUE("pounding_heart", {
  family: "crossover", label: "Pounding heart (love or fear)", uses: ["close to her", "kiss", "she leans in", "hiding with her", "confession"],
  desc: "A heartbeat on the timpani under a held chord that slides between a warm major seventh and a cold minor ninth; the pulse quickens.",
  refs: "Pearl's warm-gone-wrong strings, the 'kiss' cues of Fatal Attraction, Five Hearts Under One Roof's close scenes",
  params: { key: P.key(4, "ionian"), from: P.tempo(64, 50, 90), to: P.tempo(110, 70, 160), len: P.len(14, 6, 30), fear: P.amt("fear over love", 0.5) },
  gen(t, p) {
    const k = p.key, root = deg(k, 0, 48);
    t.beat(p.from, [4, 4]);
    let at = 0.3;
    while (at < p.len) {
      const bpm = lerp(p.from, p.to, at / p.len), spb = 60 / bpm;
      t.n("timpani", root - 12, at, 0.3, t.vel(70)); t.n("timpani", root - 12, at + spb * 0.32, 0.3, t.vel(52));
      at += spb;
    }
    const love = [root, root + 4, root + 7, root + 11, root + 16], fear = [root, root + 3, root + 7, root + 13, root + 15];
    const step = p.len / 4;
    for (let i = 0; i < 4; i++) {
      const cold = t.rng.chance(p.fear * (0.4 + i * 0.2)), ch = cold ? fear : love;
      ch.slice(1).forEach((m, j) => t.n("strings", m, i * step, step + 0.3, 30 + i * 8 - j * 2, { attack: step * 0.5 }));
      if (i === 3 || t.rng.chance(0.5)) t.n("piano", ch[3] + 12, i * step + step * 0.5, null, t.vel(44));
      t.mark(i * step, cold ? "fear" : "love");
    }
    t.point(p.len, "the moment");
    t.end(p.len + 1.5);
  },
});

// The timed choice's clock: pizzicato ticking on the beat (a clock in the room), a string note climbing a semitone
// every few seconds, the ticking doubling for the last stretch. Under a 30-second timed reply.
CUE("timed_choice", {
  family: "crossover", label: "Timed choice (the clock)", uses: ["timed choice", "decision", "reply", "countdown", "interrogation"],
  desc: "Pizzicato ticking like a clock, a string line climbing a semitone every few seconds, the ticks doubling near the end; it stops dead on the hit.",
  refs: "Until Dawn's choice beds, Detroit: Become Human's interrogations, Squid Game's countdown (Jung Jae-il)",
  params: { key: P.key(2, "aeolian"), len: P.len(30, 6, 45), tick: P.tempo(60, 50, 90), climb: P.amt("climb", 0.6), sweet: P.amt("sweetness (a romance over it)", 0.2) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tick, [4, 4]), root = deg(k, 0, 60), r = t.rng;
    for (let at = 0, i = 0; at < p.len - 0.05; i++) {
      const late = at > p.len * 0.75;
      t.n("pizz", root + (i % 2 ? 7 : 0), at, 0.2, t.vel(i % 4 === 0 ? 72 : 56));
      if (late) t.n("pizz", root + 12, at + spb / 2, 0.15, t.vel(48));
      at += spb;
    }
    const steps = Math.max(1, Math.round(p.len / 4)), every = p.len / steps;
    for (let i = 0; i < steps; i++) {
      const up = Math.round(i * (0.3 + p.climb * 0.7));
      t.n("strings", root - 12 + up, i * every, every + 0.2, 34 + i * 4, { attack: 0.8 });
      if (p.climb > 0.5 && i >= steps / 2) t.n("trem", root + up + 12, i * every, every + 0.2, 26 + i * 3, { attack: 1 });
    }
    if (p.sweet > 0.2) for (let at = 0; at < p.len * 0.7; at += 4 * spb) t.n("piano", deg(k, r.pick([2, 4, 6, 7]), 72), at + 2 * spb, null, t.vel(30 + 30 * p.sweet));
    t.point(p.len, "time's up");
    t.end(p.len + 0.4);
  },
});

// Her answer to your reply (2 to 4 s, after a choice): warm (a rolled major chord, a glock sparkle), cold (the same
// chord with its third gone and a low note), uncanny (warm on top, a semitone rub under it), or hurt.
CUE("reply_answer", {
  family: "crossover", label: "Her answer (after a reply)", uses: ["reply", "choice result", "karma", "her mood"],
  desc: "A two-to-four second answer to the player's reply: warm, cold, uncanny (warm on top, a rub under it) or hurt (a falling minor sixth).",
  refs: "Persona's social-link stings, Doki Doki's poem-reaction cues, the K-drama 'reaction shot' sting",
  params: { key: P.key(0, "ionian"), mood: P.pick("her mood", ["warm", "cold", "uncanny", "hurt"]), len: P.len(3, 1.5, 5), size: P.amt("how big", 0.5) },
  gen(t, p) {
    const k = p.key, root = deg(k, 0, 60), v = 48 + 30 * p.size;
    t.beat(80, [4, 4]);
    if (p.mood === "warm") {
      t.chord("harp", [root - 12, root - 5, root, root + 4, root + 7, root + 12], 0, null, v, { roll: 0.05 });
      t.n("strings", root + 4, 0.1, p.len - 0.3, v - 14, { attack: 0.5 });
      t.n("glock", root + 24, 0.32, null, v - 10); t.n("glock", root + 31, 0.5, null, v - 16);
    } else if (p.mood === "cold") {
      t.chord("piano", [root - 12, root - 5, root + 7], 0, null, v - 4);
      t.n("strings", root - 24, 0.05, p.len, v - 10, { attack: 0.3, raw: true });
      t.n("piano", root + 13, 0.9, null, v - 20);
    } else if (p.mood === "uncanny") {
      t.chord("piano", [root, root + 4, root + 7, root + 12], 0, null, v - 6, { roll: 0.03 });
      t.n("trem", root - 11, 0.4, p.len - 0.4, v - 20, { attack: 1.2 });
      t.n("piano", root - 23, 0.9, null, v - 16, { raw: true });
    } else {
      t.n("piano", root + 8, 0, 0.9, v); t.n("piano", root, 0.7, null, v - 8);
      t.n("strings", root + 3, 0.2, p.len - 0.2, v - 16, { attack: 0.4, bend: { semis: -1, at: 1, dur: 1.2 } });
    }
    t.point(0, "her answer");
    t.end(p.len);
  },
});

// The close moment: almost nothing. High piano notes far apart in an open (lydian or pentatonic) colour, a breath of
// strings, long silences; the player's eye is on her face. For intimate first-person close-ups, whispers.
CUE("close_moment", {
  family: "crossover", label: "Close moment (almost nothing)", uses: ["intimate", "whisper", "close-up", "she touches your face", "quiet"],
  desc: "High piano notes far apart in an open colour, a breath of strings, long silences: room for a whisper.",
  refs: "Lost in Translation's quiet cues, Your Name's piano sketches (RADWIMPS), the quiet bed-scene cues of Korean melodrama",
  params: { key: P.key(4, "lydian", ["lydian", "major_pent", "ionian", "dorian"]), len: P.len(16, 6, 32), space: P.amt("silence between", 0.6), breath: P.amt("strings' breath", 0.4) },
  gen(t, p) {
    const k = p.key, r = t.rng, pool = [4, 5, 6, 7, 8, 9, 11].map(d => deg(k, d, 60));
    t.beat(60, [4, 4]);
    let at = 0.4, last = pool[2];
    while (at < p.len - 1) {
      const m = r.chance(0.6) ? last : r.pick(pool);
      t.n("piano", m, at, null, t.vel(38, 4));
      if (r.chance(0.35)) t.n("piano", m - 5 - r.pick([0, 2]), at + 0.25, null, t.vel(30, 3));
      last = pool[clamp(pool.indexOf(m) + r.pick([-1, 1, 2]), 0, pool.length - 1)] || m;
      at += 1.2 + p.space * r.range(1, 3.5);
    }
    if (p.breath > 0.1) for (let s = 1; s < p.len - 2; s += 7) t.n("strings", deg(k, r.pick([0, 4]), 60), s, 6, 18 + 24 * p.breath, { attack: 2.5 });
    t.end(p.len);
  },
});

// The ending: one card for the three endings (good, neutral, bad), a minute or less: the love theme's chords
// slowed, resolved warmly (good), left on the IV (neutral, never home), or turned to minor with the low cluster
// returning and a music-box tag (bad).
CUE("ending", {
  family: "crossover", label: "Ending (good, neutral, bad)", uses: ["ending", "credits", "epilogue", "karma"],
  desc: "The love theme's chords slowed down: resolved warmly (good), left hanging on the IV (neutral), or turned minor with the cluster back and a music-box tag (bad).",
  refs: "Silent Hill 2's endings, To the Moon's 'For River', Ringu's closing cues; the K-drama finale montage swell",
  params: { key: P.key(7, "ionian"), ending: P.pick("ending", ["good", "neutral", "bad"]), tempo: P.tempo(58, 44, 72), len: P.len(30, 16, 60), strings: P.amt("strings", 0.7) },
  gen(t, p) {
    let k = { ...p.key };
    const spb = t.beat(p.tempo, [4, 4]), bar = 4 * spb, bad = p.ending === "bad";
    const prog = bad ? [0, 5, 3, 4, 0, 5, 1, 4] : [0, 4, 5, 3, 0, 4, 3, 3];
    const bars = Math.max(3, Math.round(p.len / bar));
    for (let b = 0; b < bars; b++) {
      if (bad && b === Math.floor(bars / 2)) { k = { tonic: k.tonic, mode: "aeolian" }; t.mark(b * bar, "it turns minor"); }
      const at = b * bar, d = prog[b % 8], ch = triad(k, d, 60, 4);
      t.n("piano", deg(k, d, 36), at, bar, t.vel(54), { raw: true });
      ch.forEach((m, i) => t.n("piano", m, at + spb * 0.5 * i + t.human(0.02), bar - spb * 0.5 * i, t.vel(44)));
      t.n("piano", ch[2] + 12, at + 2 * spb + t.human(), 2 * spb, t.vel(52));
      if (p.strings > 0.1) { t.n("strings", deg(k, d, 48), at, bar + 0.1, 26 + 34 * p.strings * (b / bars + 0.4), { attack: spb, raw: true }); t.n("strings", ch[2] + 12, at, bar + 0.1, 24 + 30 * p.strings * (b / bars), { attack: spb * 2 }); }
    }
    const fin = bars * bar;
    if (p.ending === "good") { t.chord("piano", triad(k, 0, 48, 4).concat([deg(k, 0, 72), deg(k, 4, 72)]), fin, null, 58, { roll: 0.12 }); t.n("glock", deg(k, 0, 84), fin + 0.8, null, 40); }
    else if (p.ending === "neutral") { t.chord("piano", triad(k, 3, 48, 4), fin, null, 50, { roll: 0.1 }); t.mark(fin, "never home"); }
    else {
      const low = 28 + k.tonic + (k.tonic > 7 ? 0 : 12);
      [0, 1, 2].forEach(i => t.n("piano", low + i, fin, null, 72, { raw: true }));
      [0, 2, 4, 2, 0].map(d => deg(p.key, d, 84)).forEach((m, i) => t.n("glock", m, fin + 1.5 + i * 0.5 * (1 + i * 0.15), null, 38, { cents: -15 * i }));
    }
    t.point(fin, "the last chord");
    t.end(fin + 5);
  },
});

// The confession that goes too far: a K-drama ballad swell (the royal road, piano then strings) that keeps rising
// past where it should stop: up a step, then again, then again, the strings turning to tremolo and a flat-second
// suspension creeping into the chords. She loves you. Too much.
CUE("obsession_confession", {
  family: "crossover", label: "Confession (one key change too many)", uses: ["confession", "obsession", "I love you", "too much", "yandere"],
  desc: "A ballad swell (royal road, piano arpeggios then strings) that rises a step, then again, then again; the strings turn to tremolo and a flat second creeps into the chords.",
  refs: "The K-drama last-chorus key change, made sinister; Phantom Thread's too-intense romance (Greenwood); School Days",
  params: { key: P.key(5, "ionian"), tempo: P.tempo(70, 60, 80), lifts: { kind: "num", def: 3, min: 1, max: 5, step: 1, label: "key changes" }, phrase: { kind: "num", def: 2, min: 1, max: 8, step: 1, label: "bars a key" }, tremolo: P.amt("tremolo creep", 0.6) },
  gen(t, p) {
    let k = { ...p.key };
    const spb = t.beat(p.tempo, [4, 4]), bar = 4 * spb, prog = PROGS.royal_road, total = p.phrase * (p.lifts + 1);
    for (let b = 0; b < total; b++) {
      const lvl = Math.floor(b / p.phrase);
      if (b && b % p.phrase === 0) { k = { ...k, tonic: k.tonic + 2 }; t.mark(b * bar, "up a step (" + lvl + ")"); }
      const at = b * bar, d = prog[b % 4], ch = triad(k, d, 60, 4), bass = deg(k, d, 36);
      [bass, ch[0], ch[1], ch[2], ch[3], ch[2], ch[1], ch[0]].forEach((m, i) => t.n("piano", m, at + i * spb / 2 + t.human(0.01), spb, t.vel(46 + 6 * lvl)));
      const v = 34 + 12 * lvl, inst = lvl >= Math.max(1, p.lifts - 1) && p.tremolo > 0.3 ? "trem" : "strings";
      t.n(inst, ch[2] + 12, at, bar + 0.05, v, { attack: lvl ? 0.2 : spb });
      t.n("strings", bass + 12, at, bar + 0.05, v - 8, { attack: spb, raw: true });
      if (lvl >= 2) t.n("strings", ch[0] + 13, at + 2 * spb, 2 * spb, 20 + 10 * lvl, { attack: spb });     // the flat second creeping in
      if (lvl >= 1 && b % p.phrase === 0) t.n("horn", ch[2], at, bar * 2, 50 + 10 * lvl);
    }
    const end = total * bar;
    t.n("piano", 28 + mod(k.tonic, 12), end, null, 100, { raw: true }); t.n("piano", 29 + mod(k.tonic, 12), end, null, 90, { raw: true });
    t.n("trem", deg(k, 0, 72) + 1, end, 2.5, 70); t.point(end, "too much");
    t.end(end + 3);
  },
});

// The ghost lover's lullaby: a tender 6/8 on the nylon guitar with a flute melody and high string harmonics, and
// every few bars a tubular bell too low and too long. A tender scene with something dead.
CUE("ghost_lullaby", {
  family: "crossover", label: "Ghost lover's lullaby", uses: ["ghost", "tender", "lullaby", "memory", "she's dead"],
  desc: "Nylon guitar arpeggios in 6/8, a flute melody, high quiet strings; every few bars a tubular bell, too low and too long.",
  refs: "Hotel del Luna and Goblin's dark cues, Silent Hill 2's 'Theme of Laura' (reprise), Pan's Labyrinth's lullaby (Navarrete)",
  params: { key: P.key(9, "aeolian", ["aeolian", "dorian", "harmonic_minor"]), tempo: P.tempo(60, 48, 76), len: P.len(24, 12, 48), bell: P.amt("the bell", 0.5), flute: P.amt("flute melody", 0.7) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo * 3, [6, 8]), bar = 6 * spb, prog = [0, 5, 3, 4], r = t.rng;
    const bars = Math.max(4, Math.round(p.len / bar)), tune = [4, 3, 2, 1, 2, 4, 0, -1, 2, 1, 0, -1, 1, 0, -2, -1];
    for (let b = 0; b < bars; b++) {
      const at = b * bar, d = prog[b % 4], ch = triad(k, d, 52, 3);
      [deg(k, d, 40), ch[1], ch[2], ch[0] + 12, ch[2], ch[1]].forEach((m, i) => t.n("guitar", m, at + i * spb + t.human(0.01), spb * 2, t.vel(i ? 50 : 62)));
      if (p.flute > 0.2 && b >= 1) {
        const a = tune[(2 * b) % 16], c2 = tune[(2 * b + 1) % 16];
        if (a >= -1) t.n("flute", deg(k, a + 7, 60), at, spb * 3 * 0.95, t.vel(50 + 14 * p.flute));
        if (c2 >= -1) t.n("flute", deg(k, c2 + 7, 60), at + spb * 3, spb * 3 * 0.95, t.vel(46 + 14 * p.flute));
      }
      if (b % 2 === 0) t.n("strings", deg(k, d + 4, 72), at, bar * 2, 20, { attack: bar * 0.6 });
      if (b > 1 && r.chance(p.bell * 0.45)) { t.n("bells", 60 + mod(k.tonic + 6, 12), at + spb * r.int(1, 4), null, 40 + 30 * p.bell, { raw: true }); t.mark(at, "the bell"); }
    }
    t.n("guitar", deg(k, 0, 52), bars * bar, null, 50); t.n("bells", 60 + k.tonic, bars * bar + 0.3, null, 50, { raw: true });
    t.end(bars * bar + 4);
  },
});

// The playground game: a childish tune on the flute (the recorder's stand-in), a snare and claves in the 3-3-7
// sports-day clap, bright and simple, with one note kept wrong. The game she wants to play with you.
CUE("playground_game", {
  family: "crossover", label: "Playground game (one wrong note)", uses: ["her game", "hide and seek", "the rules", "children's game", "cute menace"],
  desc: "A childish flute tune with snare and claves in the 3-3-7 clap rhythm, bright and simple, with one note always a semitone wrong.",
  refs: "Squid Game's 'Way Back Then' (Jung Jae-il: recorder, snare, claps, the kept wrong note), 'Red Light, Green Light'",
  params: { key: P.key(2, "ionian", ["ionian", "major_pent"]), tempo: P.tempo(112, 90, 132), len: P.len(16, 8, 32), wrong: P.amt("the wrong note", 0.7), low: P.amt("the cello under it", 0.3) },
  gen(t, p) {
    const k = p.key, spb = t.beat(p.tempo, [4, 4]), bar = 4 * spb;
    // the tune: (degree, beats); the wrong note is the fifth one, a semitone sharp every time
    const tune = [[4, 1], [4, 1], [2, 0.5], [4, 0.5], [5, 1], [4, 1], [2, 1], [3, 1], [1, 2], [2, 1], [2, 1], [0, 0.5], [2, 0.5], [3, 1], [2, 1], [1, 1], [0, 3]];
    const clap = [0, 1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14];          // 3-3-7 in eighths over two bars, a rest after each group
    const passLen = sum(tune.map(x => x[1])) * spb;
    let at = 0, pass = 0;
    while (pass === 0 || at + passLen * 0.6 < p.len) {
      tune.forEach(([d, beats], i) => {
        let m = deg(k, d, 72);
        if (i === 4 && p.wrong > 0.2) { m += 1; if (pass === 0) t.mark(at, "the wrong note"); }
        t.n(i % 2 && p.tempo > 120 ? "flute_stac" : "flute", m, at, beats * spb * 0.85, t.vel(66));
        at += beats * spb;
      });
      pass++;
    }
    const end = at;
    for (let s = 0; s < end - 0.1; s += 2 * bar) for (const e of clap) { const c = s + e * spb / 2; if (c < end) { t.hit("claves", c, 84 + (e === 0 || e === 4 || e === 8 ? 20 : 0)); if (e === 0 || e === 4) t.hit("snare", c, 70); } }
    if (p.low > 0.2) for (let s = 0; s < end; s += bar) t.n("strings", deg(k, 0, 36) + (Math.floor(s / bar) % 2 ? 1 : 0), s, bar, 24 + 30 * p.low, { attack: 0.3, raw: true });
    t.end(end + 1);
  },
});

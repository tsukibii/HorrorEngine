// The score room's check: every cue across many seeds and its variations writes notes that are whole (finite times,
// notes inside each instrument's samples, real drum pieces, lengths as promised), the same notes twice from the
// same seed, the corruption and "watched" layers included; then the palettes on disk (the studio's and each game's)
// name known cues, and a favourite whose notes changed since it was kept is reported. Ends "SCORE ok".
//
//   node tools/score/check.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const HERE = __dirname, ROOT = path.resolve(HERE, "../..");
const ctx = { console, Math, JSON, Object, Array, Set, Map, TextEncoder, Uint8Array, DataView, ArrayBuffer, Float32Array, Number, String, isFinite, Error, Promise };
vm.createContext(ctx);
const files = fs.readdirSync(path.join(HERE, "js")).filter(f => /^[0-6]\d-.*\.js$/.test(f) || f === "70-player.js").sort();
vm.runInContext(files.map(f => fs.readFileSync(path.join(HERE, "js", f), "utf8")).join("\n;\n") +
  "\n;globalThis.__x = { motifLine, CUES, FAMILIES, writeCue, variations, takePrint, chainTakes, MIDI, parseActions, resolveAction, sceneTake, STRING_SETS, STRING_ROLES, STRING_ADVICE, stringMembers, stringInsts };", ctx, { filename: "score.js" });
const { CUES, FAMILIES, writeCue, variations, takePrint, chainTakes, MIDI, parseActions, resolveAction, sceneTake } = ctx.__x;
const index = JSON.parse(fs.readFileSync(path.join(ROOT, "Content/Studio/Music/samples/instruments.json"), "utf8"));
const problems = [];
const bad = (id, msg) => { if (problems.length < 60) problems.push(id + ": " + msg); };
let notes = 0, takes = 0;

function checkTake(id, w, label) {
  takes++;
  if (!w.ev.length) bad(id, label + " wrote no notes");
  if (!(w.secs > 0) || !isFinite(w.secs)) bad(id, label + " length " + w.secs);
  const len = w.params.len;
  if (len && w.secs > Math.max(len * 1.5, len + 8)) bad(id, label + " runs " + w.secs.toFixed(1) + " s for a length of " + len);
  for (const e of w.ev) {
    notes++;
    if (e.inst === "fx") { if (e.fx !== "tapestop" || !(e.dur > 0)) bad(id, label + " fx " + JSON.stringify(e)); continue; }
    const def = index[e.inst];
    if (!def) { bad(id, label + " unknown instrument " + e.inst); continue; }
    if (e.tone && !["ponticello", "tasto", "harmonic", "legno"].includes(e.tone)) bad(id, label + " tone " + e.tone);
    if (!isFinite(e.t) || e.t < 0) bad(id, label + " note at " + e.t);
    if (!(e.vel >= 1 && e.vel <= 127)) bad(id, label + " velocity " + e.vel);
    if (def.kind === "kit") { if (!def.pieces[e.piece]) bad(id, label + " no " + e.inst + " piece " + e.piece); continue; }
    if (!Number.isInteger(e.midi)) bad(id, label + " note " + e.midi);
    const [lo, hi] = def.range;
    if (e.midi < lo - 7 || e.midi > hi + 7) bad(id, label + " " + e.inst + " " + e.midi + " outside its samples " + lo + "-" + hi);
    if (e.dur != null && !(e.dur > 0)) bad(id, label + " duration " + e.dur);
    if (e.bend && !(isFinite(e.bend.semis) && e.bend.dur > 0)) bad(id, label + " bend " + JSON.stringify(e.bend));
  }
  for (const h of w.hits) if (!(h.t >= 0 && h.t <= w.secs + 0.01)) bad(id, label + " hit " + h.label + " at " + h.t + " past the end");
}

const ids = Object.keys(CUES);
for (const id of ids) {
  const c = CUES[id];
  if (!FAMILIES[c.family]) bad(id, "family " + c.family);
  for (const f of ["label", "desc", "refs"]) if (!c[f]) bad(id, "no " + f);
  if (!Array.isArray(c.uses) || !c.uses.length) bad(id, "no uses");
  for (let s = 0; s < 12; s++) {
    const seed = 1000 + s * 7919;
    const a = writeCue(id, {}, seed), b = writeCue(id, {}, seed);
    if (takePrint(a) !== takePrint(b)) bad(id, "seed " + seed + " not deterministic");
    checkTake(id, a, "seed " + seed);
  }
  // every choice value, the ends of every number, both shared layers
  for (const [k, sp] of Object.entries(c.params)) {
    const vals = sp.kind === "choice" ? sp.opts : sp.kind === "num" ? [sp.min, sp.max] : sp.modes.map(m => ({ tonic: 11, mode: m }));
    for (const v of vals) checkTake(id, writeCue(id, { [k]: v }, 77), k + "=" + JSON.stringify(v));
  }
  checkTake(id, writeCue(id, { corrupt: 1, watched: 1 }, 5), "corrupt+watched");
  if (c.motif) for (let m = 1; m <= 25; m++) checkTake(id, writeCue(id, { motif: m * 37 }, m), "theme " + m * 37);
  const vs = variations(id, {}, 6, 0.8, 42), vs2 = variations(id, {}, 6, 0.8, 42);
  if (JSON.stringify(vs) !== JSON.stringify(vs2)) bad(id, "variations not deterministic");
  vs.forEach((v, i) => checkTake(id, writeCue(id, v.params, v.seed), "variation " + i));
}
// the game's theme: the same pitches in every meter, 8 bars, a half cadence on the fifth and home at the end
for (let m = 1; m <= 200; m++) {
  const l4 = ctx.__x.motifLine(m, 4), l3 = ctx.__x.motifLine(m, 3), l2 = ctx.__x.motifLine(m, 2);
  const pit = l => l.map(x => x[0]).join(",");
  if (pit(l4) !== pit(l3) || pit(l4) !== pit(l2)) bad("theme " + m, "pitches differ between meters");
  for (const [beats, l] of [[4, l4], [3, l3], [2, l2]]) for (let b = 0; b < 8; b++) { const sum = l.filter(x => x[2] === b).reduce((a, x) => a + x[1], 0); if (Math.abs(sum - beats) > 1e-9) bad("theme " + m, "bar " + b + " has " + sum + " beats in " + beats); }
  const last = l4[l4.length - 1][0], halfEnd = l4.filter(x => x[2] === 3).pop()[0];
  if (last !== 0 || halfEnd !== 4) bad("theme " + m, "cadences " + halfEnd + " and " + last);
}

// the string sets (32-strings.js): every member a real instrument, every role in every set, a note anywhere a cue
// writes strings lands on something, the advice names real cues and sets
const { STRING_SETS, STRING_ROLES, STRING_ADVICE, stringMembers, stringInsts } = ctx.__x;
if (!STRING_SETS.section) bad("strings", "no section set (the original)");
for (const [sid, set] of Object.entries(STRING_SETS)) {
  if (!set.label || !set.note) bad("strings " + sid, "needs a label and a note on when it works best");
  for (const role of STRING_ROLES) {
    for (const k of stringInsts(role, sid)) if (!index[k]) bad("strings " + sid, role + " names " + k + ", which isn't in instruments.json");
    for (let m = 24; m <= 100; m++) {
      const ms = stringMembers(role, m, sid, index);
      if (!ms.length || ms.some(([k, db]) => !index[k] || !isFinite(db))) bad("strings " + sid, role + " " + m + " -> " + JSON.stringify(ms));
    }
  }
}
for (const [cue, [sid, why]] of Object.entries(STRING_ADVICE)) {
  if (!CUES[cue]) bad("strings advice", "no cue " + cue);
  if (!STRING_SETS[sid] || !why) bad("strings advice", cue + ": " + sid);
}
// every instrument a note on: what it's best for (the Instruments list)
for (const [k, d] of Object.entries(index)) if (d.added && !d.best) bad("instruments", k + " has no `best`");

// a chain and a MIDI file
const chain = chainTakes([{ take: writeCue("sneak", {}, 1) }, { take: writeCue("slapstick_fall", {}, 2), gap: 0.2 }, { take: writeCue("flustered", {}, 3), gap: -0.3 }]);
if (chain.parts.length !== 3 || !(chain.secs > 5)) bad("chain", JSON.stringify(chain.parts));
const mid = MIDI.write({ notes: chain.ev.filter(e => e.piece == null).map(e => ({ inst: e.inst, midi: e.midi, vel: e.vel, t: e.t, dur: e.dur || 1 })), tempos: [{ t: 0, bpm: 100, meter: [4, 4] }], marks: chain.marks });
if (String.fromCharCode(...mid.slice(0, 4)) !== "MThd") bad("midi", "no header");

// a scene scored from actions: the K-drama trip (sneak, the fall landing at 4.2 s, the blush), and a romance horror beat
const acts = parseActions("0 sneak\n4.2 slapstick fall\n5.5 flustered @ring\n# a comment\nnot an action");
if (acts.length !== 3 || acts[1].t !== 4.2 || acts[2].end !== "ring") bad("scene", "parse " + JSON.stringify(acts));
const sc = sceneTake(acts, []);
const fall = sc.parts.find(p => p.cue === "slapstick_fall");
if (sc.parts.length !== 3 || !fall || Math.abs(sc.hits.find(h => h.label === "the landing").t - 4.2) > 0.01) bad("scene", "the landing isn't on 4.2 s: " + JSON.stringify(sc.parts));
const sneakEnd = sc.parts[0].until;
if (Math.abs(sneakEnd - fall.start) > 0.01) bad("scene", "the sneak doesn't end where the fall starts");
for (const [act, want] of [["trip", "slapstick_fall"], ["blush", "flustered"], ["her theme", "her_theme"], ["jump scare", "sting"], ["hide and seek", null], ["dun dun dun", "shock"]]) {
  const r = resolveAction(act, []);
  if (want && (!r || r.cue !== want)) bad("scene", "'" + act + "' resolves to " + (r && r.cue) + ", not " + want);
}
const favR = resolveAction("trip", [{ id: "f1", name: "My trip", cue: "slapstick_fall", params: { landing: "bonk" }, seed: 9, uses: ["trip"], stars: 2 }]);
if (!favR || !favR.fav) bad("scene", "a favourite named for the action isn't preferred");
checkTake("scene", Object.assign({ params: {} }, sc), "scene");

// the palettes on disk
const palettes = [path.join(ROOT, "Content/Studio/Music/palette.json")];
const games = path.join(ROOT, "Content/Games");
if (fs.existsSync(games)) for (const g of fs.readdirSync(games)) palettes.push(path.join(games, g, "Music/palette.json"));
let favs = 0;
const drift = [];
for (const p of palettes.filter(f => fs.existsSync(f))) {
  const rel = path.relative(ROOT, p);
  let pal;
  try { pal = JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { bad(rel, "not JSON: " + e.message); continue; }
  if (pal.format !== "horrorstudio-score-palette") bad(rel, "format " + pal.format);
  const known = new Set();
  for (const f of pal.favourites || []) {
    favs++; known.add(f.id);
    if (!CUES[f.cue]) { bad(rel, f.name + ": unknown cue " + f.cue); continue; }
    const w = writeCue(f.cue, f.params, f.seed);
    checkTake(f.cue, w, rel + " " + f.name);
    if (f.print && f.print !== takePrint(w)) drift.push(rel + " " + f.name + " (" + f.cue + ")");
  }
  for (const s of pal.sequences || []) for (const it of s.items || []) if (!known.has(it.fav)) bad(rel, "sequence " + s.name + " names a missing favourite " + it.fav);
}

// --catalogue: docs/MUSIC_CUES.md, the cue catalogue written from the cues themselves (so it never drifts)
if (process.argv.includes("--catalogue")) {
  const fmt = sp => sp.kind === "num" ? sp.min + " to " + sp.max + " (" + sp.def + ")" : sp.kind === "choice" ? sp.opts.join(" / ") : sp.modes.map(m => m.replace(/_/g, " ")).join(" / ");
  const out = ["# The score room's cues", "", "Generated by `node tools/score/check.js --catalogue` from the cues themselves (`tools/score/js/6*.js`); don't edit.",
    "Every cue also has the shared settings level (dB), corruption and she's watching (docs/MUSIC.md §3).", ""];
  for (const [fam, name] of Object.entries(FAMILIES)) {
    out.push("## " + name, "");
    for (const c of Object.values(CUES).filter(c => c.family === fam)) {
      const w = writeCue(c.id, {}, 1);
      out.push("### " + c.label + " (`" + c.id + "`)", "", c.desc, "",
        "- **For:** " + c.uses.join(", "), "- **After:** " + c.refs,
        "- **Level:** " + (c.level ?? -6) + " dB; about " + w.secs.toFixed(0) + " s at its defaults" + (w.hits.length ? "; hit points: " + w.hits.map(h => h.label).join(", ") : ""),
        "- **Settings:** " + Object.entries(c.params).filter(([, sp]) => !sp.shared).map(([k, sp]) => (sp.label || k) + " " + fmt(sp)).join("; "), "");
    }
  }
  fs.writeFileSync(path.join(ROOT, "docs/MUSIC_CUES.md"), out.join("\n"));
  console.log("wrote docs/MUSIC_CUES.md");
}

const fams = {};
for (const c of Object.values(CUES)) fams[c.family] = (fams[c.family] || 0) + 1;
console.log("cues " + ids.length + " (" + Object.entries(fams).map(([k, v]) => k + " " + v).join(", ") + "), takes " + takes + ", notes " + notes + ", favourites " + favs);
for (const d of drift) console.log("CHANGED (the generator writes other notes now; re-keep or roll back): " + d);
if (problems.length) { for (const p of problems) console.log("FAIL " + p); process.exit(1); }
console.log("SCORE ok");

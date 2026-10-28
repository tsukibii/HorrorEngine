// DESK: the desk's own logic, without a browser. The live checks (lint.js) find nothing wrong in a game the story
// check passes, and find each fault put in on purpose, at its place (the node, the beat, the line, the level). The
// merge (merge.js) puts the desk's edits and Claude's together, asking only where both changed the same thing.
//   node tools/director/desktest.mjs
import { readFileSync, readdirSync, existsSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// "three" as the desk's page names it (its import map): the vendored copy, so modules that draw can be tested here too
const { register } = await import("module");
const THREE_URL = new URL("./vendor/three.module.min.js", import.meta.url).href;
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, next) { return s === "three" ? { url: ${JSON.stringify(THREE_URL)}, shortCircuit: true } : next(s, c); }`));
const { lint } = await import("./lint.js");
const fails = [], ok = m => console.log("  ok  " + m), fail = m => { fails.push(m); console.log("  FAIL " + m); };
const clone = o => JSON.parse(JSON.stringify(o));
const games = readdirSync(join(ROOT, "Content", "Games")).filter(g => existsSync(join(ROOT, "Content", "Games", g, "story.json")));
const story = g => JSON.parse(readFileSync(join(ROOT, "Content", "Games", g, "story.json"), "utf8"));
const poses = Object.keys(JSON.parse(readFileSync(join(ROOT, "Content", "Studio", "poses.json"), "utf8")).poses);
const thingsOf = S => JSON.parse(execFileSync("python3", ["-c", `import sys, json; sys.path.insert(0, ${JSON.stringify(join(ROOT, "Content", "Python"))})
from storykit import storylib as L, life as LF
th, _ = L.index(json.load(sys.stdin))
print(json.dumps({k: {"kind": t.kind, "use": t.use, "level": t.level, "shape": str(t.d.get("shape", "")), "life": LF.life_of(t.d) if t.kind == "prop" else None} for k, t in th.items()}))`], { input: JSON.stringify(S), encoding: "utf8" }));
const storyCheck = (g, S) => {                     // the story check on a story not saved (story_check.py --story)
  const f = join(tmpdir(), `desk_${g}_${process.pid}.json`); writeFileSync(f, JSON.stringify(S));
  try { return execFileSync("python3", [join(ROOT, "tools", "story_check.py"), "--game", g, "--story", f], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { return (e.stdout || "") + (e.stderr || ""); } finally { rmSync(f, { force: true }); }
};
const secs = c => c.dur ? c.dur - ((c.trim || {}).in || 0) - ((c.trim || {}).out || 0) : 0;
const LIVES = JSON.parse(readFileSync(join(ROOT, "Content", "Studio", "Life", "lives.json"), "utf8"));
const run = (S, th) => lint(S, { things: th, poses, secs, lives: LIVES });

// ---- the live checks
console.log("the live checks (lint.js)");
for (const g of games) {
  const S = story(g), ps = run(S, thingsOf(S)), errs = ps.filter(p => p.sev === "error");
  errs.length ? fail(`${g}: ${errs.length} errors the story check doesn't have: ${errs.slice(0, 3).map(p => p.text + " (" + p.at.text + ")").join("; ")}`)
    : ok(`${g}: no errors, as the story check says (${ps.length} warnings)`);
}
{
  const S0 = story("Sample"), th = thingsOf(S0);
  const nodeOf = ref => Object.keys(S0.flow).find(n => S0.flow[n].ref === ref);
  const expect = (what, change, test) => {
    const S = clone(S0); const hint = change(S); const ps = run(S, th), hit = ps.filter(p => test(p, hint));
    hit.length ? ok(`${what}: ${hit[0].text} (${hit[0].at.text})`) : fail(`${what}: not found among ${ps.length}: ${ps.slice(0, 4).map(p => p.text).join("; ")}`);
  };
  const firstBeat = (S, f) => { for (const [tid, st] of Object.entries(S.stitches)) for (const b of st.beats || []) if (f(b)) return [tid, b]; return []; };
  expect("an item taken out of the Database: the beat that waits for it", S => { delete S.items.cellar_key; return firstBeat(S, b => b.when && b.when.pickup === "cellar_key"); },
    (p, [tid, b]) => p.sev === "error" && p.at.beat === b.id && p.at.node === nodeOf(tid));
  expect("… and the door it locked, in the level", S => { delete S.items.cellar_key; }, p => p.sev === "error" && p.at.level && /locked by cellar_key/.test(p.text));
  expect("… and the pickup that held it", S => { delete S.items.cellar_key; }, p => p.sev === "error" && p.at.level && /picks up cellar_key/.test(p.text));
  expect("a door command naming no door", S => { const [, b] = firstBeat(S, b => (b.do || []).some(a => a.door)); const a = b.do.find(a => a.door); a.door = "no_such_door"; return a; },
    (p, a) => p.sev === "error" && p.obj === a && /isn't a door/.test(p.text));
  expect("a command with nothing chosen", S => { const [, b] = firstBeat(S, () => true); const a = { say: "" }; b.do.push(a); return a; }, (p, a) => p.obj === a && /choose the line/.test(p.text));
  expect("a task nothing ends", S => { const st = S.stitches.t_search; for (const b of st.beats) b.do = (b.do || []).filter(a => !a.done); return "t_search"; },
    (p, tid) => p.sev === "error" && p.at.node === nodeOf(tid) && /nothing ends this task/.test(p.text));
  expect("a node going on to one that's gone", S => { const n = S.game.start; S.flow[n].next = "n_gone"; return n; }, (p, n) => p.sev === "error" && p.at.node === n && /n_gone/.test(p.text));
  expect("an ending nothing reaches", S => { S.flow.e_lost = { type: "ending", kind: "bad", title: "Lost" }; }, p => p.sev === "error" && p.at.node === "e_lost");
  expect("a line with no English", S => { const sc = Object.values(S.scenes).find(s => (s.clips || []).length > 1); delete sc.clips[0].en; return sc.clips[0]; },
    (p, c) => p.sev === "error" && p.obj === c && p.at.clip === c.id);
  expect("a cut with no seam", S => { const sc = Object.values(S.scenes).find(s => (s.clips || []).length > 1); delete sc.clips[1].seam; return sc.clips[1]; },
    (p, c) => p.sev === "error" && p.at.clip === c.id && /no seam/.test(p.text));
  expect("a flag waited for that nothing sets", S => { S.stitches.t_search.beats.push({ id: "b_ghost", when: { flag: "ghost_flag" }, optional: true, do: [] }); },
    p => p.sev === "warn" && /ghost_flag/.test(p.text) && p.at.beat === "b_ghost");

  // a conversation card (STORY_FORMAT §9.9): an answer's reply a few lines, one skipping ahead, one ending the talk, one
  // leaving for a card nothing else leads to; four answers. Nothing wrong with it, as the story check says; then faults
  const talk = S => {
    const c = S.scenes.s_message.clips.find(x => x.reply), os = c.reply.options, later = S.scenes.s_message.clips.slice(S.scenes.s_message.clips.indexOf(c) + 2);
    os[0].then = [Object.assign({ en: "Mm." }, os[0].then || {}), { en: "Then stay a while.", ja: "じゃあ、少しいて。" }];
    os[1].go = { clip: later[later.length - 1].id };
    os.push({ id: "bye", label: "Leave", think: "Not tonight.", then: { en: "Oh. Goodnight, then.", ja: "そう。おやすみ。" }, go: "end" },
      { id: "away", label: "Look away", go: { node: "n_detour" } });
    S.scenes.s_detour = clone(S.scenes.s_game); S.flow.n_detour = { type: "scene", ref: "s_detour", next: S.flow.n_game.next };
    for (const x of S.scenes.s_detour.clips || []) for (const g of (x.body || {}).segments || []) g.reuse = true;   // the same motions as the scene it's copied from
    return c;
  };
  {
    const S = clone(S0); talk(S); const ps = run(S, th), errs = ps.filter(p => p.sev === "error"), lost = ps.filter(p => p.at.node === "n_detour" && /nothing leads/.test(p.text));
    const out = storyCheck("Sample", S), okd = /STORY ok/.test(out) && !/n_detour: no path reaches/.test(out);
    errs.length || lost.length ? fail(`a conversation card: ${[...errs, ...lost].map(p => p.text).join("; ")}`) : !okd ? fail(`a conversation card: the story check says ${out.trim().split("\n").slice(-3).join(" / ")}`)
      : ok(`a conversation card (a reply of two lines, a skip, the end, a card only an answer leads to, four answers): no errors, the story check passes (${out.trim().split("\n").pop()})`);
  }
  expect("an answer that skips back", S => { const c = talk(S); c.reply.options[1].go = { clip: S.scenes.s_message.clips[0].id }; return c; },
    (p, c) => p.sev === "error" && p.at.clip === c.id && /isn't a later line/.test(p.text));
  expect("an answer leaving for a card that's gone", S => { const c = talk(S); c.reply.options[3].go = { node: "n_gone" }; return c; },
    (p, c) => p.sev === "error" && p.at.clip === c.id && /isn't on the board/.test(p.text));
  expect("an answer going somewhere the format hasn't a word for", S => { const c = talk(S); c.reply.options[2].go = "sideways"; return c; },
    (p, c) => p.sev === "error" && p.at.clip === c.id && /next, end, a later line or a card/.test(p.text));
  {
    const S = clone(S0), c = talk(S); c.reply.options[1].go = { clip: S.scenes.s_message.clips[0].id }; c.reply.options[3].go = { node: "n_gone" };
    const out = storyCheck("Sample", S), want = [/a later line of this scene/, /n_gone.*not on the board/];
    want.every(r => r.test(out)) ? ok("… and the story check says both (a skip back, a card that isn't there)") : fail(`the story check on the bad answers: ${out.trim().split("\n").slice(-4).join(" / ")}`);
  }
}

// ---- the flow cut and joined again on the board (flowedit.js, HANDOFF_DIRECTOR_TODO §2)
console.log("the flow cut and joined again (flowedit.js)");
{
  const F = await import("./flowedit.js");
  const S0 = story("Sample"), th = thingsOf(S0);
  const chain = (S, k = 7) => { const out = []; for (let id = S.game.start; id && out.length < k; id = (S.flow[id] || {}).next) out.push(id); return out.join(" › "); };
  const errsOf = S => run(S, th).filter(p => p.sev === "error");
  const checkOk = S => { const out = storyCheck("Sample", S); return /STORY ok/.test(out) ? true : out.trim().split("\n").slice(-3).join(" / "); };
  {  // cut: warnings, not errors; the cards after it loose; joined again, the story as it was
    const S = clone(S0); F.setArrow(S, "n_message", ["next"], null);
    const ps = run(S, th), cut = ps.find(p => p.at.node === "n_message" && /cut here/.test(p.text)), errs = ps.filter(p => p.sev === "error"), loose = ps.filter(p => /\(the flow's cut\)/.test(p.text)).length;
    const c = checkOk(S), cuts = F.cutsOf(S);
    F.setArrow(S, "n_message", ["next"], S0.flow.n_message.next);
    const back = JSON.stringify(S.flow) === JSON.stringify(S0.flow);
    cut && cut.sev === "warn" && !errs.length && c === true && cuts.length === 1 && loose > 3 && back
      ? ok(`cut after “Mari in the hall”: a stub (${cut.text}), ${loose} cards loose as warnings, no errors, the story check passes; joined again, the flow as it was`)
      : fail(`a cut: ${cut ? cut.sev : "not said"}, errors ${errs.map(p => p.text).join("; ")}, story check ${c}, cuts ${cuts.length}, loose ${loose}, back ${back}`);
  }
  {  // a choice's way cut
    const S = clone(S0), ch = Object.keys(S.flow).find(k => S.flow[k].type === "choice" && S.flow[k].by === "act");
    F.setArrow(S, ch, ["option", 0], null);
    const p = run(S, th).find(x => x.at.node === ch && /goes nowhere/.test(x.text)), c = checkOk(S);
    p && p.sev === "warn" && c === true ? ok(`a choice's way cut (${ch}): ${p.text}, a warning; the story check passes`) : fail(`a choice's way cut: ${p ? p.sev : "not said"}, story check ${c}`);
  }
  {  // a card put on an arrow
    const S = clone(S0); S.scenes.s_inserted = clone(S.scenes.s_game); for (const x of S.scenes.s_inserted.clips || []) for (const g of (x.body || {}).segments || []) g.reuse = true;
    F.insertOn(S, "n_arrive", ["next"], "n_inserted", { type: "scene", ref: "s_inserted" });
    const c = checkOk(S), want = "n_arrive › n_inserted › n_message › n_game";
    chain(S).startsWith(want) && !errsOf(S).length && c === true ? ok(`a card put on an arrow: ${chain(S, 4)}; no errors, the story check passes`) : fail(`insert: ${chain(S)}, story check ${c}`);
  }
  {  // two cards swapped, and back
    const S = clone(S0); S.frames = [{ id: "f_a", title: "A", nodes: ["n_message"] }, { id: "f_b", title: "B", nodes: ["n_game"] }];
    const xy = [S.flow.n_message.xy, S.flow.n_game.xy] = [[10, 20], [30, 40]];
    F.swapNodes(S, "n_message", "n_game");
    const one = chain(S, 4), acts = S.frames.map(f => f.nodes[0]).join(), at = JSON.stringify([S.flow.n_message.xy, S.flow.n_game.xy]), c = checkOk(S);
    F.swapNodes(S, "n_message", "n_game");
    const back = chain(S, 4) === chain(S0, 4);
    one === "n_arrive › n_game › n_message › n_hide1" && acts === "n_game,n_message" && at === JSON.stringify([xy[1], xy[0]]) && c === true && back
      ? ok(`two cards swapped: ${one} (their places on the board and their acts too); the story check passes; swapped back, as it was`)
      : fail(`swap: ${one}, acts ${acts}, places ${at}, story check ${c}, back ${back}`);
    const T = clone(S0); F.swapNodes(T, "n_arrive", "n_game");
    T.game.start === "n_game" && chain(T, 4) === "n_game › n_message › n_arrive › n_hide1" ? ok(`… the start too: ${chain(T, 4)}`) : fail(`swap with the start: ${T.game.start} ${chain(T, 4)}`);
  }
  {  // a run of cards moved onto another arrow
    const S = clone(S0), run2 = F.runOf(S, ["n_game", "n_message"]), no = F.runOf(S, ["n_arrive", "n_game"]);
    const moved = F.moveRun(S, ["n_game", "n_message"], "n_hide1", ["next"]), onItself = F.moveRun(clone(S0), ["n_game", "n_message"], "n_game", ["next"]);
    const want = "n_arrive › n_hide1 › n_message › n_game › n_hide1_r";
    String(run2) === "n_message,n_game" && no === null && moved && !onItself && chain(S, 5) === want && !errsOf(S).length
      ? ok(`a run of two cards (picked in any order) moved after the first round: ${chain(S, 5)}; not onto its own arrow; no errors`)
      : fail(`move a run: run ${run2}, not a run ${no}, moved ${moved}, onto itself ${onItself}, ${chain(S, 5)}, errors ${errsOf(S).map(p => p.text).join("; ")}`);
  }
  {  // an answer's jump is an arrow of its own: cut, it goes back to the next line
    const S = clone(S0), c = S.scenes.s_message.clips.find(x => x.reply); c.reply.options[1].go = { node: "n_game" };
    const a = F.arrows(S, "n_message").find(x => x.kind === "answer");
    F.setArrow(S, "n_message", a.at, null);
    a && a.to === "n_game" && !("go" in c.reply.options[1]) ? ok(`an answer's jump is an arrow of its own (${JSON.stringify(a.at)}); cut, the answer goes on to the next line`) : fail(`an answer's arrow: ${JSON.stringify(a)}`);
  }
}

// ---- a cast member's models, picked per scene and carried down the flow (HANDOFF_DIRECTOR_TODO §5)
console.log("a cast member's models (stage.js flowModels, storylib.flow_models)");
{
  const { flowModels, modelFile } = await import("./stage.js"), { renameRef } = await import("./refs.js");
  const S0 = story("Sample"), th = thingsOf(S0);
  const dress = S => { S.cast.mari.models = { wet: "MHR_lod1.fbx" }; S.scenes[S.flow.n_r1_cute.ref].models = { mari: "wet" }; return S; };
  const py = S => JSON.parse(execFileSync("python3", ["-c", `import sys, json; sys.path.insert(0, ${JSON.stringify(join(ROOT, "Content", "Python"))})
from storykit import storylib as L
print(json.dumps(L.flow_models(json.load(sys.stdin))))`], { input: JSON.stringify(S), encoding: "utf8" }));
  {  // the carry: a pick down every way after it; the desk and the story check agree
    const S = dress(clone(S0)), js = flowModels(S), p = py(S);
    const same = Object.keys(js).length === Object.keys(p).length && Object.entries(js).every(([k, v]) => JSON.stringify(v.models) === JSON.stringify((p[k] || {}).models) && JSON.stringify(v.mixed) === JSON.stringify((p[k] || {}).mixed));
    const after = js.n_hide2 || {}, before = js.n_hide1 || {};
    same && (js.n_r1_cute.models.mari === "wet") && !before.models.mari && after.mixed.includes("mari") && modelFile(S, "mari", "wet") === "MHR_lod1.fbx" && modelFile(S, "mari") === S.cast.mari.previs_body
      ? ok(`Mari's wet model picked by “${S.scenes[S.flow.n_r1_cute.ref].title}”: worn there and after it, not before; round 2 reached both ways mixes (${after.mixed}); the desk and storylib agree on all ${Object.keys(js).length} nodes`)
      : fail(`the carry: same ${same}, at the pick ${JSON.stringify(js.n_r1_cute)}, before ${JSON.stringify(before)}, after ${JSON.stringify(after)}`);
  }
  {  // where the ways meet with different models on someone in a scene: a warning, gone once the scene picks one
    const S = dress(clone(S0)), out = storyCheck("Sample", S), w = out.split("\n").filter(l => /the ways meeting here bring mari in different models/.test(l));
    const at = w.map(l => l.split(" ")[2].replace(":", "")), named = w.length ? (w[0].match(/mari is in (.*) after it/) || [])[1] || "" : "";
    const T = dress(clone(S0)), firsts = named.replace(" …", "").split(", ").filter(Boolean);
    let left = true, out2 = "";
    for (let k = 0; k < 6 && left; k++) {             // pick in the scenes it names, as the user would, until it's quiet
      out2 = storyCheck("Sample", T); const w2 = out2.split("\n").find(l => /the ways meeting here bring mari/.test(l)); left = !!w2;
      if (w2) for (const nid of ((w2.match(/mari is in (.*) after it/) || [])[1] || "").replace(" …", "").split(", ")) T.scenes[T.flow[nid].ref].models = { mari: "default" };
    }
    w.length === 1 && at[0] === "n_hide2" && firsts.length && /STORY ok/.test(out) && !left && /STORY ok/.test(out2)
      ? ok(`the ways meet with different models on Mari: one warning, at ${at[0]} where they meet, naming ${named}; picked in the scenes it names, it's gone; the story check passes`)
      : fail(`the meeting warning: ${w.length} (${at.join(",")}) naming ${named}; after picking: ${left ? "still there" : "gone"}; ${out.trim().split("\n").pop()} / ${out2.trim().split("\n").pop()}`);
  }
  {  // a pick naming no model, or no cast member: errors, live and in the story check
    const S = dress(clone(S0)); S.scenes[S.flow.n_message.ref].models = { mari: "dry", ghost: "default" };
    const ps = run(S, th).filter(p => p.sev === "error" && /its models/.test(p.text)), out = storyCheck("Sample", S);
    ps.length === 2 && /has no model 'dry'/.test(out) && /'ghost' isn't in the cast/.test(out) ? ok(`a pick of a model she hasn't and of someone not in the cast: errors (${ps.map(p => p.text).join("; ")}), and the story check's`)
      : fail(`bad picks: live ${ps.map(p => p.text).join("; ") || "none"}; story check ${/has no model/.test(out)} ${/isn't in the cast/.test(out)}`);
  }
  {  // a cast member renamed: the scenes' picks follow
    const S = dress(clone(S0)); renameRef(S, "cast", "mari", "mari2");
    const sc = S.scenes[S.flow.n_r1_cute.ref];
    sc.models && sc.models.mari2 === "wet" && !("mari" in sc.models) ? ok("Mari renamed: the scene's pick moves with her") : fail(`a rename: ${JSON.stringify(sc.models)}`);
  }
}

// ---- a body track (STORY_FORMAT §3.8, HANDOFF_DIRECTOR_TODO §4): a scene's behave cues, checked as Play's behaviours are
console.log("a body track (a scene's behave cues)");
{
  const S0 = story("TestRoom001"), th = thingsOf(S0), sc0 = S0.scenes.s_hello, has = (sc0.cues || []).some(c => c.do && c.do.behave);
  const S = clone(S0), cue = S.scenes.s_hello.cues.find(c => c.do && c.do.behave);
  cue.do.to = "no_spot"; S.scenes.s_hello.cues.push({ at: { clip: "c4", edge: "start" }, do: { behave: "aoi", as: "path", route: "r_nope" } });
  const ps = run(S, th).filter(p => p.sev === "error" && p.at.node === "n_hello" && /no_spot|r_nope/.test(p.text)), out = storyCheck("TestRoom001", S);
  has && ps.length === 2 && /no_spot/.test(out) && /r_nope/.test(out)
    ? ok(`TestRoom001's lobby has one (Aoi walks to the bench and sits); a spot and a route that aren't there: found at the scene's cue (${ps.map(p => p.text).join("; ")}), and by the story check`)
    : fail(`a body track: TestRoom001's lobby has one ${has}; live ${ps.map(p => p.text).join("; ") || "none"}; story check ${/no_spot/.test(out)} ${/r_nope/.test(out)}`);
}

// ---- the merge: the desk's edits and Claude's on disk, from the version both started from
console.log("the merge (merge.js)");
{
  const { merge3, setAt, getAt, same } = await import("./merge.js");
  const S0 = story("Sample"), sc = Object.keys(S0.scenes).find(k => (S0.scenes[k].clips || []).length > 1), st = "t_search";
  const both = (what, fm, ft, test) => { const m = clone(S0), t = clone(S0); fm(m); ft(t); const r = merge3(S0, m, t); const why = test(r, m, t); why === true ? ok(what) : fail(`${what}: ${why}`); };
  both("edits in different places both land, nothing asked", m => { m.scenes[sc].title = "Mine"; }, t => { t.stitches[st].beats[0].do.push({ think: "Theirs." }); },
    r => r.conflicts.length ? `${r.conflicts.length} conflicts` : r.value.scenes[sc].title === "Mine" && r.value.stitches[st].beats[0].do.some(a => a.think === "Theirs.") || "an edit was lost");
  both("the same edit on both sides is no conflict", m => { m.scenes[sc].clips[0].en = "Same."; }, t => { t.scenes[sc].clips[0].en = "Same."; }, r => !r.conflicts.length || "a conflict");
  both("both change one line's words: a conflict, mine kept, theirs offered", m => { m.scenes[sc].clips[0].en = "Mine."; }, t => { t.scenes[sc].clips[0].en = "Theirs."; }, r => {
    if (r.conflicts.length !== 1) return `${r.conflicts.length} conflicts`;
    if (r.value.scenes[sc].clips[0].en !== "Mine.") return "mine wasn't kept";
    const v = clone(r.value); setAt(v, r.conflicts[0].path, r.conflicts[0].theirs); return v.scenes[sc].clips[0].en === "Theirs." || "theirs didn't go in";
  });
  both("beats added on both sides: each kept where it was put", m => { m.stitches[st].beats.push({ id: "b_mine", when: { start: true }, do: [] }); },
    t => { t.stitches[st].beats.splice(2, 0, { id: "b_theirs", when: { start: true }, do: [] }); }, r => {
      const ids = r.value.stitches[st].beats.map(b => b.id), t0 = S0.stitches[st].beats.map(b => b.id);
      return !r.conflicts.length && ids[2] === "b_theirs" && ids[ids.length - 1] === "b_mine" && ids.length === t0.length + 2 || `beats ${ids.join(",")}`;
    });
  both("beats reordered there, a beat edited here: their order, my edit", m => { m.stitches[st].beats[1].optional = true; }, t => { t.stitches[st].beats.reverse(); }, r => {
    const ids = r.value.stitches[st].beats.map(b => b.id), want = [...S0.stitches[st].beats].reverse().map(b => b.id), b1 = S0.stitches[st].beats[1].id;
    return !r.conflicts.length && same(ids, want) && r.value.stitches[st].beats.find(b => b.id === b1).optional === true || `order ${ids.join(",")}`;
  });
  both("a beat deleted here and left alone there stays deleted", m => { m.stitches[st].beats.splice(1, 1); }, () => {}, r => !r.conflicts.length && r.value.stitches[st].beats.length === S0.stitches[st].beats.length - 1 || "it came back");
  both("a beat deleted here but edited there: a conflict", m => { m.stitches[st].beats.splice(1, 1); }, t => { t.stitches[st].beats[1].optional = true; }, r => r.conflicts.length === 1 || `${r.conflicts.length} conflicts`);
  // a real afternoon: cards moved and a line written here, a scene and a motion's prompt from Claude there
  const m = clone(S0), t = clone(S0);
  Object.values(m.flow).forEach((n, i) => { n.xy = [i * 214, 24]; }); m.scenes[sc].clips[0].en = "Edited at the desk.";
  t.scenes.s_new = clone(S0.scenes[sc]); t.scenes.s_new.title = "Claude's new scene"; const mid = Object.keys(t.motions)[0]; t.motions[mid].prompt = "A person stands still, breathing slowly, then looks up";
  const r = merge3(S0, m, t), v = r.value;
  !r.conflicts.length && v.scenes.s_new && v.motions[mid].prompt.endsWith("looks up") && v.scenes[sc].clips[0].en === "Edited at the desk." && Object.values(v.flow).every(n => Array.isArray(n.xy))
    ? ok("an afternoon's edits on both sides merge into one story") : fail(`the afternoon: ${r.conflicts.length} conflicts`);
  getAt(v, ["stitches", st, "beats", { id: S0.stitches[st].beats[0].id }]) ? ok("a path by id finds its beat") : fail("getAt by id");
}

// ---- copy and paste: new ids where they must be unique, the links inside what was copied kept
console.log("copy and paste (clipboard.js)");
{
  const C = await import("./clipboard.js"), { allIds } = await import("./refs.js");
  const S = story("Sample"), th = thingsOf(S), st = S.stitches.t_search;
  const ids0 = allIds(S), bs = C.pasteBeats(S, st.beats.slice(0, 3));
  bs.every(b => !ids0.has(b.id)) && new Set(bs.map(b => b.id)).size === 3 ? ok(`three beats pasted: new ids ${bs.map(b => b.id).join(", ")}`) : fail("pasted beats' ids");
  const withAfter = C.pasteBeats(S, [{ id: "b_one", when: { start: true }, do: [] }, { id: "b_two", when: { after: "b_one", secs: 1 }, do: [] }]);
  withAfter[1].when.after === withAfter[0].id ? ok("a beat's “after” follows the beat it waits for") : fail(`after ${withAfter[1].when.after}`);
  const ask = { ask: "q_stay", text: "Stay?", options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] };
  S.stitches.t_search.beats.push({ id: "b_ask_here", when: { start: true }, optional: true, do: [clone(ask)] });
  const [pa] = C.pasteCommands(S, [ask]);
  pa.ask !== "q_stay" ? ok(`a question pasted where its id is taken gets its own (${pa.ask})`) : fail("ask id kept");
  const sc = Object.keys(S.scenes).find(k => (S.scenes[k].clips || []).length > 1), ver = S.scenes[sc], cl = C.pasteClips(ver, ver.clips.slice(0, 2), { scene: sc, fromScene: sc });
  cl.every(c => !ver.clips.some(x => x.id === c.id) && !c.dur) ? ok(`two lines pasted into their scene: ${cl.map(c => c.id).join(", ")}, without the old take's length`) : fail("pasted clips");
  // cards: a scene and the task after it, pasted as a pair
  const S2 = story("Sample"), pick = Object.keys(S2.flow).filter(n => ["scene", "stitch"].includes(S2.flow[n].type)).slice(1, 3);
  S2.flow[pick[0]].next = pick[1];
  const made = C.pasteNodes(S2, C.copyNodes(S2, pick), [900, 900]);
  const [a, b] = made.map(id => S2.flow[id]);
  made.length === 2 && a.next === made[1] && a.ref !== S2.flow[pick[0]].ref && b.next === null && Array.isArray(a.xy)
    ? ok(`two cards pasted (${made.join(", ")}): their own ${a.type} and ${b.type}, the link between them kept, the one out dropped`) : fail(`pasted cards: ${JSON.stringify(made)}`);
  const ids = []; for (const t of ["cast", "items", "notes", "lines", "sounds", "scenes", "stitches", "flow", "secrets", "motions"]) ids.push(...Object.keys(S2[t] || {}));
  for (const t of Object.values(S2.stitches)) for (const x of t.beats || []) ids.push(x.id);
  ids.length === new Set(ids).size ? ok("every id in the story still unique") : fail("an id twice after the paste");
  const errs = run(S2, th).filter(p => p.sev === "error" && !made.includes(p.at.node));
  errs.length ? fail(`the paste broke something else: ${errs[0].text}`) : ok("nothing outside the pasted cards has a problem");
  C.unpack(JSON.stringify([{ say: "mari_002" }, { flag: "x" }])).kind === "commands" && C.unpack(JSON.stringify(st.beats.slice(0, 2))).kind === "beats" && C.unpack(JSON.stringify(ver.clips.slice(0, 1))).kind === "clips" && C.unpack("hello") === null
    ? ok("plain JSON of commands, beats or lines reads back as them") : fail("unpack");
}

// ---- quick events: every task and beat template built into a game, and the story check passes
console.log("quick events (templates.js)");
{
  const Q = await import("./templates.js");
  const S = story("Sample"), hall = S.levels.house.rooms.find(r => r.id === "hall");   // the day's small systems need a stain, a breaker, a mop and a flashlight
  hall.props.push({ id: "hall_mud", shape: "box 0.7 0.5 0.01", at: [3.0, 1.5], use: "clean", stain: "mud" }, { id: "hall_breaker", shape: "box 0.3 0.1 0.4", at: [3.85, 0.6], z: 1.3, use: "breaker" },
    { id: "hall_mop", shape: "box 0.1 0.1 1.2", at: [0.3, 2.0], use: "pickup", item: "mop" }, { id: "hall_torch", shape: "cyl 0.025 0.18", at: [0.5, 1.0], use: "pickup", item: "flashlight" });
  Object.assign(S.items, { mop: { name: "Mop" }, flashlight: { name: "Flashlight", torch: true } });
  const th = thingsOf(S), of = f => Object.keys(th).filter(k => f(th[k]));
  const room = of(t => t.kind === "room"), door = of(t => t.kind === "door"), locker = of(t => t.use === "locker"), person = of(t => /^person/.test(t.shape || ""));
  const ending = Object.keys(S.flow).find(k => S.flow[k].type === "ending"), back = S.game.start;
  const values = {
    key_door: { title: "The test key", item: "cellar_key", door: "cellar_door", beyond: room[room.length - 1], find: "Find the key" },
    read_note: { note: Object.keys(S.notes)[0], thought: "Shaky." }, fetch: { item: Object.keys(S.items)[1], place: room[1] },
    timed_escape: { exit: room[0], secs: 30, fail: ending }, hide_round: { seeker: Object.keys(S.cast)[0], places: locker.slice(0, 2), secs: 40 },
    chase: { seeker: Object.keys(S.cast)[0], exit: door[0], secs: 25 },
    request: { who: Object.keys(S.cast)[0], wait: of(t => t.use === "spot")[0], text: "Put the kettle on", ticks: { enter: room[1] }, after: of(t => t.use === "spot")[1], then: "sit" },
    chore: { stain: "hall_mud", with: "mop", text: "Mop up the mud", thought: "That's better." }, power_cut: { breaker: "hall_breaker" },
    lock_up: { door: "front_door", text: "Lock the front door", thought: "There." },
    door_knock: { door: "front_door", count: 3, figure: person[0], thought: "Nobody there. Then someone." },
  };
  const made = [];
  for (const tpl of Q.TASKS) {
    const r = Q.buildTask(S, tpl, values[tpl.id] || {}), nid = "n_qe_" + tpl.id;
    S.flow[nid] = { type: "stitch", ref: r.tid, next: back };
    if (r.round) { S.flow[nid].next = nid + "_r"; S.flow[nid + "_r"] = { type: "choice", by: "result", of: nid, options: Object.values({ hide: ["hidden", "found"], run: ["escaped", "caught"] }[r.round]).map(x => ({ result: x, to: back })) }; }
    made.push(nid);
  }
  const bv = { jumpscare: { zone: room[0], figure: person[0], sound: Object.keys(S.sounds)[0] }, knock: { zone: room[0], at: door[0], count: 3 }, lights_die: { room: room[0], secs: 1 },
    slam: { zone: room[0], door: door[0] }, whisper: { look: door[0], line: Object.keys(S.lines)[0], at: door[0] }, speaks: { zone: room[0], line: Object.keys(S.lines)[0] }, checkpoint: { zone: room[0] },
    kettle_on: { zone: "kitchen", kettle: "kitchen_kettle" }, still_burning: { zone: "hall", cigarette: "hall_ash" }, phone_rings: { zone: "study", phone: "study_phone" },
    tv_on: { zone: "study", tv: "study_tv" }, clock_stops: { clock: "kitchen_clock", thought: "2:47. It's stopped." }, torch_flickers: { zone: room[0], how: "dead" } };
  const bst = Q.buildTask(S, Q.TASK.read_note, values.read_note), beats = Q.BEATS.map(t => Object.assign(Q.buildBeat(S, t, bv[t.id] || {}), { optional: true }));
  bst.stitch.beats.push(...beats); S.flow.n_qe_beats = { type: "stitch", ref: bst.tid, next: back }; made.push("n_qe_beats");
  ok(`${Q.TASKS.length} tasks and ${Q.BEATS.length} beats built: ${Q.TASKS.map(t => t.id).join(", ")}; ${Q.BEATS.map(t => t.id).join(", ")}`);
  const fd = S.levels.house.rooms.flatMap(r => r.openings || []).find(o => o.door && o.door.id === "front_door").door;
  hall.props.find(p => p.id === "hall_mud").with === "mop" && fd.peephole === true && fd.latch === true
    ? ok("the chore gave its stain the mop it needs, the knock gave the front door its peephole, locking up its latch") : fail(`the level hooks: the stain's with ${hall.props.find(p => p.id === "hall_mud").with}, the door's peephole ${fd.peephole}, latch ${fd.latch}`);
  const errs = run(S, th).filter(p => p.sev === "error");
  errs.length ? fail(`the live checks: ${errs.slice(0, 3).map(p => p.text + " (" + p.at.text + ")").join("; ")}`) : ok("the live checks find nothing wrong in them");
  const out = storyCheck("Sample", S), last = out.trim().split("\n").pop();
  /STORY ok/.test(last) ? ok(`the story check passes with all of them in: ${last}`) : fail(`the story check: ${out.split("\n").filter(l => l.startsWith("ERROR")).slice(0, 4).join(" · ") || last}`);
  const blank = clone(story("Sample")); Q.buildTask(blank, Q.TASK.key_door, {});
  const left = run(blank, th).filter(p => p.sev === "error" && /choose/.test(p.text));
  left.length >= 2 ? ok(`a quick task with its blanks left: ${left.length} problems saying what to choose (${left[0].text})`) : fail("blanks left didn't show");
}

// ---- the board's acts (frames): the story check reads them, the live checks see one gone wrong
console.log("acts on the board (frames)");
{
  const S = story("Sample"), ids = Object.keys(S.flow).slice(0, 3);
  S.frames = [{ id: "f_act1", title: "Act 1", color: "#8a63d2", nodes: ids }];
  const out = storyCheck("Sample", S).trim().split("\n").pop();
  /STORY ok/.test(out) ? ok(`an act of ${ids.length} cards: the story check passes (${out})`) : fail(`an act: ${out}`);
  const bad = clone(S); bad.frames[0].nodes.push("n_gone"); bad.frames.push({ id: "f_act2", title: "Act 2", color: "red", nodes: [ids[0]] });
  const errs = storyCheck("Sample", bad).split("\n").filter(l => l.startsWith("ERROR")), want = [/n_gone/, /color/, /two acts/];
  want.every(w => errs.some(e => w.test(e))) ? ok(`acts gone wrong: the story check says so (${errs.length} errors)`) : fail(`bad acts: ${errs.join(" · ")}`);
  const ps = run(bad, thingsOf(bad)).filter(p => p.at && /act/.test(p.at.text || ""));
  ps.length >= 2 ? ok(`… and the live checks too: ${ps.map(p => p.text).join("; ")}`) : fail("the live checks on bad acts");
}

// ---- blocking by mouse: the room under a point, a new mark there, which way it faces; the story check passes
console.log("marks on the stage (marks.js)");
{
  const { facingRot, roomAt, newSpot, newThing } = await import("./marks.js");
  const f = [[[0, 0], [1, 0], 0], [[0, 0], [0, 1], 90], [[0, 0], [-1, 0], 180], [[0, 0], [0, -1], 270], [[2, 4.6], [2, 2.2], 270]];
  f.every(([a, b, w]) => facingRot(a, b) === w) ? ok("facing: east 0, north 90, west 180, south 270") : fail("facing: " + f.map(([a, b]) => facingRot(a, b)).join(","));
  const S = story("Sample"), lv = S.levels.house, room = (x, y) => (roomAt(lv, x, y) || {}).id || null;
  room(2, 3) === "hall" && room(2, -1.5) === "porch" && room(50, 50) === null ? ok("the room under a point: hall, porch, none outside") : fail(`rooms: ${room(2, 3)} ${room(2, -1.5)} ${room(50, 50)}`);
  const hall = roomAt(lv, 1, 4.6), id = newSpot(S, "house", hall, 1, 4.6, facingRot([1, 4.6], [2, 2.2]), "hall_mari_spot"), sp = hall.props.find(x => x.id === id);
  id === "hall_mari_spot_2" && sp && sp.at[0] === 1 && sp.at[1] === 4.6 && sp.use === "spot" ? ok(`a new mark: ${id} at ${sp.at} facing ${sp.rot} (its id unique, the room's coordinates)`) : fail("a new mark: " + JSON.stringify(sp));
  S.scenes.s_message.stage.mari = id;
  const vid = newSpot(S, "house", roomAt(lv, 2.5, 1.5), 2.5, 1.5, 90, "hall_view_spot"); S.scenes.s_message.view = vid;
  // a little thing added from the stage: on the table clicked, its front to the player; one on the floor
  const kitchen = roomAt(lv, 1, 7), tid = newThing(S, kitchen, 2.2, 7.9, [2, 6.5], "mug", "kitchen_table"), fid = newThing(S, kitchen, 3.2, 9.0, [2, 6.5], "kettle_whistling");
  const tp = kitchen.props.find(x => x.id === tid), fp = kitchen.props.find(x => x.id === fid);
  tid === "kitchen_mug" && tp.on === "kitchen_table" && tp.at[0] === 2.2 && tp.at[1] === 1.9 && tp.rot === (facingRot([2.2, 7.9], [2, 6.5]) + 90) % 360 && !fp.on
    ? ok(`a little thing from the stage: ${tid} on the table at ${tp.at}, its front to the player (rot ${tp.rot}); ${fid} on the floor`) : fail("newThing: " + JSON.stringify([tp, fp]));
  const out = storyCheck("Sample", S).trim().split("\n").pop();
  /STORY ok/.test(out) ? ok(`Mari and the player on new marks, little things put down: the story check passes (${out})`) : fail("new marks: " + out);
}

// ---- reusable motions: the motions table played (a stand-in looped, held, in place), and behave's motion checked
console.log("reusable motions (motion.js, behave motion)");
{
  const M = await import("./motion.js"), lib = M.loadLibrary(JSON.parse(readFileSync(join(ROOT, "Content", "Studio", "poses.json"), "utf8")));
  const S = story("Sample"), m = S.motions.mari_idle, head = (t, mm = m) => M.tableMotionPose(lib, mm, null, t, 1.62).head;
  const a = head(0), b = head(m.secs / 2), c = head(m.secs), d = head(m.secs * 1.5);
  a && b && a.distanceTo(b) > 1e-3 && a.distanceTo(c) < 1e-6 && b.distanceTo(d) < 1e-6 ? ok(`mari_idle's stand-in plays and loops (its head moves ${(a.distanceTo(b) * 100).toFixed(1)} cm, back at ${m.secs} s)`) : fail("the stand-in's loop");
  const once = Object.assign({}, m, { loop: false }); head(m.secs * 2, once).distanceTo(head(m.secs, once)) < 1e-6 ? ok("… held at its end when it doesn't loop") : fail("a motion that doesn't loop");
  M.tableMotionPose(lib, S.motions.mari_count_wall, null, 1, 1.62) === null ? ok("not made and no stand-in: nothing (the pose plays)") : fail("a motion with nothing to play");
  const fps = 30, n = 61, file = { fps, height: 1.76, joints: ["pelvis", "head"], pos: Array.from({ length: n }, (_, i) => [[i * 0.02, 0.95, 0.4 + i * 0.01], [i * 0.02, 1.6, 0.4 + i * 0.01]]) };
  const p = M.tableMotionPose(lib, { loop: true, in_place: true }, file, 1, 1.76);
  Math.abs(p.pelvis.x) < 1e-6 && Math.abs(p.pelvis.z) < 1e-6 && Math.abs(p.head.y - 1.6) < 1e-6 ? ok("a made take in place: the hips' travel taken away, the height kept") : fail("in place: " + JSON.stringify(p.pelvis));
  const T = clone(S), beat = { id: "b_desk_motion", when: { start: true }, do: [{ behave: "mari", as: "idle", at: "hall_mari_spot", motion: "mari_idle" }, { behave: "mari", as: "path", route: ["hall_mari_spot", "hall_mari_near_spot"], motion: "mari_search_walk" }] };
  const tid = Object.keys(T.stitches).find(k => !T.stitches[k].play); T.stitches[tid].beats.push(beat);
  const out = storyCheck("Sample", T), last = out.trim().split("\n").pop();
  /STORY ok/.test(last) && !/b_desk_motion/.test(out.split("\n").filter(l => l.startsWith("ERROR")).join()) ? ok(`behave with a motion standing and walking: the story check passes (${last})`) : fail("behave motion: " + out.split("\n").filter(l => /ERROR|b_desk_motion/.test(l)).join(" · "));
  beat.do[0].motion = "no_such_motion"; beat.do[1].motion = "mari_idle";
  const o2 = storyCheck("Sample", T).split("\n");
  o2.some(l => l.startsWith("ERROR") && /no_such_motion/.test(l)) && o2.some(l => /mari_idle walks a route: make it in_place/.test(l)) ? ok("… a motion not in the table is an error, one walked without in_place a warning") : fail("behave motion's errors: " + o2.filter(l => /b_desk_motion/.test(l)).join(" · "));
}

// ---- screenplay typing: lines typed or pasted as a script, and the scene's clips kept where the lines are
console.log("screenplay typing (screenplay.js)");
{
  const SP = await import("./screenplay.js"), { clipSecs } = await import("./stage.js");
  const S = story("Sample"), o = { cast: S.cast, clipMax: S.game.clip_max || 10, secs: clipSecs };
  const r = SP.parse(`(she waits at the end of the hall)
Mari: 来てくれたんだ。 / You came. [CU]
You: Mari?
(a long silence)
Mari: 聞いて。今夜、何が聞こえても、誰が地下室からあなたの名前を呼んでも、あのドアは絶対に開けないで。約束して。今すぐ約束して、あの人が戻ってくる前に。お願いだから、ね。
Kenji: Hello?
a line with no speaker`, o);
  const L = r.lines;
  L[0].who === "mari" && L[0].ja === "来てくれたんだ。" && L[0].en === "You came." && L[0].shot === "cu" && L[0].act === "she waits at the end of the hall" ? ok("“Mari: 日本語 / English [CU]” with a note before it: her line, both languages, the shot, the note") : fail("a line: " + JSON.stringify(L[0]));
  L[1].who === "player" && L[1].act === "a long silence" ? ok("“You:” is the player; a note under a line is that line's") : fail("the player's line: " + JSON.stringify(L[1]));
  const parts = L.filter(l => l.split);
  parts.length >= 2 && parts.every(l => clipSecs(l) <= o.clipMax) ? ok(`a line longer than a take: split at its sentences into ${parts.length} clips, each ${o.clipMax} s or less`) : fail("the split: " + JSON.stringify(parts.map(l => [l.ja, clipSecs(l)])));
  r.warns.some(w => /Kenji isn't in the cast/.test(w)) && r.warns.some(w => /no speaker/.test(w)) ? ok("someone not in the cast, and a line with no speaker: warnings, not lines lost silently") : fail("warns: " + r.warns.join(" · "));
  { const t = SP.parse(`"She came back."\nMari: You came.`, o).lines, back = SP.parse(SP.toText(t, S.cast), o).lines;
    t[0].who === "player" && t[0].think === true && t[0].en === "She came back." && !t[1].think && back[0].think === true && back[0].en === "She came back."
      ? ok("a whole line in quotes is the player's thought (think), and comes back as one") : fail("a thought: " + JSON.stringify(t) + " / " + JSON.stringify(back)); }
  const sc = S.scenes.s_message, before = JSON.parse(JSON.stringify(sc.clips));
  const back = SP.parse(SP.toText(sc.clips, S.cast), o).lines;
  back.length === sc.clips.length && back.every((l, i) => l.who === sc.clips[i].who && (l.en || "") === (sc.clips[i].en || "") && (l.ja || "") === (sc.clips[i].ja || "")) ? ok(`a scene as text and back: the same ${back.length} lines`) : fail("the round trip");
  const nid = list => { let n = list.length + 1; while (list.some(c => c.id === "c" + n)) n++; return "c" + n; };
  let t = SP.toText(sc.clips, S.cast).split("\n"); const i2 = t.findIndex(x => x.startsWith("Mari: ") && x.includes(sc.clips[2].en));
  t[i2] = t[i2].replace(sc.clips[2].en, "Father's diary is in the study. It says where the key is."); t.splice(1, 0, "You: Mari, is that you?");
  const a = SP.applyTo(JSON.parse(JSON.stringify(sc.clips)), SP.parse(t.join("\n"), o).lines, nid);
  const kept2 = a.clips.find(c => c.id === sc.clips[2].id);
  a.added === 1 && a.changed === 1 && a.removed === 0 && kept2 && kept2.en.startsWith("Father's diary is in the study. It says") && JSON.stringify(kept2.body) === JSON.stringify(before[2].body)
    ? ok(`an inserted line is new, an edited one keeps its clip (its id, body and camera): ${a.kept} kept, ${a.changed} changed, ${a.added} added`) : fail("applyTo: " + JSON.stringify({ kept: a.kept, changed: a.changed, added: a.added, removed: a.removed }));
  sc.clips = a.clips; for (const c of sc.clips) if (!c.body) c.body = { block: [{ at: 0, pose: "idle" }] };
  const out = storyCheck("Sample", S).trim().split("\n").pop();
  /STORY ok/.test(out) ? ok(`the scene typed again: the story check passes (${out})`) : fail("typed scene: " + out);
}

// ---- the little things' lives: which life a kit thing has (node and python agree), timers, a pot on its hob, a
// cigarette relit, a cup that needs its kettle; the state command checked live and by the story check
console.log("lives (life.js, lives.json)");
{
  const LF = await import("./life.js"), PR = JSON.parse(readFileSync(join(ROOT, "Content", "Studio", "Kit", "presets.json"), "utf8")).presets;
  const names = Object.keys(PR), js = names.map(n => LF.lifeOf({ kit: n }, LIVES, PR));
  const py = JSON.parse(execFileSync("python3", ["-c", `import sys, json; sys.path.insert(0, ${JSON.stringify(join(ROOT, "Content", "Python"))})
from storykit import life as LF
print(json.dumps([LF.life_of({"kit": n}) for n in json.load(sys.stdin)]))`], { input: JSON.stringify(names), encoding: "utf8" }));
  const off = names.filter((n, i) => js[i] !== py[i]);
  !off.length && js.filter(Boolean).length >= 30 ? ok(`every kit preset's life: node and python agree (${js.filter(Boolean).length} of ${names.length} have one)`) : fail("lifeOf differs: " + off.map(n => `${n} ${js[names.indexOf(n)]}/${py[names.indexOf(n)]}`).join(", "));
  const want = { kettle_jug: "kettle", kettle_whistling: "whistling_kettle", tetsubin: "tetsubin", hob_gas_konro: "gas_hob", ashtray_burning: "cigarette", ashtray_glass: null, tv_55: "tv", mirror: null, cigarette_butt: null, lighter: null, lighter_standing: "lighter", takeaway_coffee: "coffee" };
  const bad = Object.entries(want).filter(([n, l]) => LF.lifeOf({ kit: n }, LIVES, PR) !== l);
  !bad.length && LF.lifeOf({ kit: "kettle_jug", life: false }, LIVES, PR) === null && LF.lifeOf({ shape: "box 1 1 1", life: "candle" }, LIVES, PR) === "candle"
    ? ok("a kettle is a kettle, a burning ashtray a cigarette, a butt nothing; life: false switches it off, `life` gives a block one") : fail("lifeOf: " + bad.map(b => b[0]).join(", "));
  // timers: the kettle switched on boils, clicks off and cools
  const W = new LF.States(LIVES, { k: { life: "kettle", d: {} }, h: { life: "hob", d: {} }, p: { life: "pot", d: { on: "h" } },
    c: { life: "cigarette", d: {} }, cup: { life: "cup", d: { from: "k" } }, cup2: { life: "cup", d: { from: "k", acts: false } }, q: { life: "kettle", d: { secs: { heating: 5 } } } }).start(0);
  W.set("k", "heating", 0); W.set("q", "heating", 0);
  const a0 = W.acts("cup", 1).length, q6 = W.at("q", 6).state;          // (time only goes forward: ask in order)
  const seq = [29, 31, 39].map(t => W.at("k", t).state).join(" "), a1 = W.acts("cup", 39).map(a => a.label).join(), a2 = W.acts("cup2", 39).length, end = W.at("k", 200).state;
  seq === "heating boiling boiled" && end === "off" && q6 === "boiling" ? ok(`the kettle by itself: ${seq}, ${end}; its own secs shorten it`) : fail("kettle timers: " + seq + " " + end + " " + q6);
  // a pot on a hob follows it; already on its way it isn't sent back
  const V = new LF.States(LIVES, { h: { life: "hob", d: {} }, p: { life: "pot", d: { on: "h" } } }).start(0);
  V.set("h", "on", 10); const p1 = [11, 51, 81].map(t => V.at("p", t).state); V.set("h", "hot", 100); const p2 = [101, 161, 200].map(t => V.at("p", t).state);
  p1.join() === "heating,simmering,boiling" && p2.join() === "cooling,cold,cold" && V.at("h", 200).state === "off" ? ok(`a pot on its hob: ${p1.join(", ")}; off: ${p2.join(", ")}`) : fail("follows: " + p1.join() + " / " + p2.join());
  const U = new LF.States(LIVES, { h: { life: "hob", d: { state: "on" } }, p: { life: "pot", d: { on: "h" } } }).start(0);
  U.at("p", 1).state === "heating" ? ok("a pot on a hob that starts on starts heating") : fail("follows at the start: " + U.at("p", 1).state);
  // a cigarette put out and lit again burns on from where it was
  const C = new LF.States(LIVES, { c: { life: "cigarette", d: { state: "lit" } } }).start(0);
  C.set("c", "out", 100); C.set("c", "lit", 200); const c1 = C.at("c", 519).state, c2 = C.at("c", 521).state, sp = C.at("c", 521).spent.lit;
  c1 === "lit" && c2 === "out" && Math.abs(sp - 420) < 0.01 ? ok("a cigarette relit burns on from where it was: out 420 s of burning later") : fail(`keep: ${c1} ${c2} ${sp}`);
  // acts: a cup pours only from a ready kettle, and not at all with acts: false
  a0 === 0 && a1 === "Pour" && a2 === 0 ? ok("a cup can be poured once its kettle has boiled (not before, not with acts: false)") : fail(`acts: ${a0} ${a1} ${a2}`);
  // every effect a life names is one the desk draws (lifefx.js), and an effect's value ramps over its state
  const FXM = await import("./lifefx.js"), named = new Set();
  for (const L of Object.values(LIVES.lives)) for (const st of L.states) for (const f of st.fx || []) named.add(f.fx);
  const unknown = [...named].filter(f => !FXM.FX.includes(f));
  !unknown.length && FXM.valueAt([0, 1], 15, 30) === 0.5 && FXM.valueAt([1, 0], 60, 30) === 0 && FXM.valueAt(0.4, 99, 30) === 0.4
    ? ok(`every effect the lives name is drawn on the desk (${named.size}: ${[...named].join(", ")})`) : fail("effects: unknown " + unknown.join(", "));
  // every sound a life names is one the desk makes (lifesound.js)
  const SM = await import("./lifesound.js"), heard = new Set();
  for (const L of Object.values(LIVES.lives)) for (const st of L.states) for (const x of [...(st.sound || []), ...(st.enter || [])]) heard.add(x.sound);
  const deaf = [...heard].filter(x => !SM.SOUNDS.includes(x));
  !deaf.length ? ok(`every sound the lives name is made in the browser (${heard.size})`) : fail("sounds the desk can't make: " + deaf.join(", "));
  // the state command: the live check and the story check
  const S = story("Sample"), hall = S.levels.house.rooms.find(r => r.id === "hall");
  hall.props.push({ id: "t_kettle", kit: "kettle_jug", on: "hall_table", at: [2.9, 5.1], rot: 270 }, { id: "t_hob", kit: "hob_ih_portable", at: [1.0, 5.2], rot: 270 },
    { id: "t_pot", kit: "saucepan", on: "t_hob", at: [1.0, 5.2] }, { id: "t_cup", kit: "mug", on: "hall_table", at: [3.3, 5.0], liquid: "tea", from: "t_kettle" });
  const st = S.stitches[S.flow.n_arrive.ref];
  st.beats.unshift({ id: "b_t_hob", when: { start: true }, do: [{ state: "t_hob", to: "on" }] }, { id: "b_t_tea", when: { state: "t_cup", is: "full" }, do: [{ think: "Tea." }] },
    { id: "b_t_pot", when: { state: "t_pot", is: "boiling" }, do: [{ think: "It boils." }] });
  const th = thingsOf(S), ps = run(S, th).filter(p => p.sev === "error"), out = storyCheck("Sample", S).trim().split("\n").pop();
  !ps.length && /STORY ok/.test(out) ? ok(`a kettle, a hob, a pot on it and a cup of tea in the Sample: no live problems, the walker plays them through (${out})`) : fail("lives story: " + ps.map(p => p.text).join("; ") + " / " + out);
  st.beats[0].do[0].to = "boiling"; st.beats[1].when.is = "spilled";
  const ps2 = run(S, th).filter(p => p.sev === "error").map(p => p.text), out2 = storyCheck("Sample", S);
  ps2.some(t => /boiling isn't one of t_hob's states/.test(t)) && ps2.some(t => /spilled isn't one of t_cup's states/.test(t)) && /t_hob to 'boiling'/.test(out2) && /t_cup is 'spilled'/.test(out2)
    ? ok("a state a thing hasn't got: found live and by the story check, at the beat") : fail("bad states: " + ps2.join("; "));
}

// the to-do list (STORY_FORMAT §4): a task that fails and one that's ticked play through; a tick of a task no stitch lists,
// a trigger inside a task naming nothing, and a ticked trigger of an unknown task are found live and by the story check
{
  const S = story("Pilot"), th = thingsOf(S), st = S.stitches.t_search;
  st.beats.unshift({ id: "b_t_list", when: { start: true }, do: [{ todo: "t_mop", text: "Mop the floor", secs: 30, on: { failed: [{ flag: "t_mop_failed" }] } }, { fail: "t_mop" }] },
    { id: "b_t_after", when: { failed: "t_mop" }, do: [{ think: "Too late." }, { todo: "t_tea", text: "Make the tea", ticks: { enter: "kitchen" } }] },
    { id: "b_t_tea", when: { ticked: "t_tea" }, if: ["t_mop_failed"], do: [{ think: "At least the tea." }] });
  const ps = run(S, th).filter(p => p.sev === "error"), out = storyCheck("Pilot", S).trim().split("\n").pop();
  !ps.length && /STORY ok/.test(out) ? ok(`a task failed (its failed runs, the failed trigger heard), another ticked by its own trigger: no live problems, the walker plays it through (${out})`) : fail("todo story: " + ps.map(p => p.text).join("; ") + " / " + out);
  st.beats[0].do[1] = { tick: "t_nothing" }; st.beats[1].do[1].ticks = { enter: "nowhere" }; st.beats[2].when = { ticked: "t_unknown" };
  const ps2 = run(S, th).filter(p => p.sev === "error").map(p => p.text), out2 = storyCheck("Pilot", S);
  ps2.some(t => /t_nothing isn't a task on the to-do list/.test(t)) && ps2.some(t => /nowhere isn't a room or trigger/.test(t)) && ps2.some(t => /t_unknown isn't a task/.test(t))
    && /tick 't_nothing'/.test(out2) && /enter 'nowhere'/.test(out2) && /ticked 't_unknown'/.test(out2)
    ? ok("a tick of no task, a task's trigger naming nothing, a ticked trigger of no task: found live and by the story check") : fail("bad todos: " + ps2.join("; ") + " / " + out2.split("\n").filter(l => /todo|tick|nowhere/.test(l)).join(" | "));
}

// nights as chapters: a task's chapter with a time carries that time on to the nodes after it, the same on the desk
// (stage.js flowTimes) and in the story check (storylib.flow_times); a chapter's fields are checked
{
  const { flowTimes } = await import("./stage.js");
  const S = story("Pilot"), st = S.stitches.t_search;
  st.beats.push({ id: "b_t_night2", when: { use: "study_bed" }, optional: true, do: [{ chapter: "Morning", sub: "07:10", time: "day" }] });
  const js = flowTimes(S), py = JSON.parse(execFileSync("python3", ["-c", `import sys, json; sys.path.insert(0, ${JSON.stringify(join(ROOT, "Content", "Python"))})
from storykit import storylib as L
print(json.dumps(L.flow_times(json.load(sys.stdin))))`], { input: JSON.stringify(S), encoding: "utf8" }));
  const same = Object.keys(js).every(n => js[n].time === (py[n] || {}).time);
  js.n_search.time === "night" && js.n_knock.time === "day" && js.n_knock.from === "n_search" && same && /STORY ok/.test(storyCheck("Pilot", S))
    ? ok("a chapter's time carries on after its task (day after the search's night), the desk and the story check agree") : fail(`chapter times: ${JSON.stringify({ search: js.n_search, knock: js.n_knock, same })}`);
  st.beats[st.beats.length - 1].do[0] = { chapter: "", time: "noon", secs: 40 };
  const out = storyCheck("Pilot", S);
  /chapter needs its title/.test(out) && /chapter time 'noon'/.test(out) && /chapter secs/.test(out) ? ok("a chapter with no title, a time that isn't one, a card held 40 s: found by the story check") : fail("bad chapter: " + out.split("\n").filter(l => /chapter/.test(l)).join(" | "));
}

// what's shown by what's happened (STORY_FORMAT §9.14, HANDOFF_DIRECTOR_TODO §7): the game's words ({her}), a line, an
// answer and a face by a condition; the desk (stage.js) and the story check (storylib, the walker) agree
console.log("what's shown by what's happened (stage.js holds, wordOf; storylib.holds, word_of)");
{
  const { holds, wordOf, Stage } = await import("./stage.js");
  const S0 = story("TestRoom001");
  S0.game.counters = Object.assign({}, S0.game.counters, { remembered: { label: "times he remembered" } });
  S0.game.words = { her: [{ count: "remembered", min: 2, say: "Natsuki" }, { if: ["took_pill"], say: "Natsuki" }, { say: "Natsu" }] };
  const cases = [[[], {}], [["took_pill"], {}], [[], { remembered: 2 }], [[], { remembered: 1 }]];
  const conds = [{}, { if: ["a"] }, { if: ["!a"] }, { if: ["a", "!b"] }, { count: "n", min: 2 }, { count: "n", max: 1 }, { if: ["a"], count: "n", min: 1, max: 3 }];
  const states = [[[], {}], [["a"], { n: 2 }], [["a", "b"], { n: 1 }], [["b"], { n: 4 }]];
  const py = JSON.parse(execFileSync("python3", ["-c", `import sys, json; sys.path.insert(0, ${JSON.stringify(join(ROOT, "Content", "Python"))})
from storykit import storylib as L
d = json.load(sys.stdin)
print(json.dumps({"words": [L.word_of(d["S"], "her", set(f), c) for f, c in d["cases"]], "holds": [[L.holds(x, set(f), c) for f, c in d["states"]] for x in d["conds"]]}))`], { input: JSON.stringify({ S: S0, cases, conds, states }), encoding: "utf8" }));
  const words = cases.map(([f, c]) => wordOf(S0, "her", new Set(f), c)), hs = conds.map(x => states.map(([f, c]) => holds(x, new Set(f), c)));
  JSON.stringify(words) === JSON.stringify(["Natsu", "Natsuki", "Natsuki", "Natsu"]) && JSON.stringify(py.words) === JSON.stringify(words) && JSON.stringify(py.holds) === JSON.stringify(hs) && wordOf(S0, "nobody", new Set(), {}) === null
    ? ok("{her} by a counter, then a flag, the last the fallback; conditions read alike: the desk and the story check agree") : fail(`words ${JSON.stringify(words)} / ${JSON.stringify(py)}`);
  // a line left out by a flag: a run's timeline skips it, the desk's script (no run) plays every line; an answer by a
  // condition: what's offered first is the default pick
  const S = clone(S0), sc = S.scenes.s_hello, rp = sc.clips.find(c => c.reply).reply;
  sc.clips[0].if = ["took_pill"]; rp.options[0].if = ["!took_pill"];
  const tl = run => Stage.prototype.timeline.call({ story: S, things: {}, runState: run, resolveMoves: Stage.prototype.resolveMoves }, sc);
  const ids = t => t.segs.filter(x => x.type === "clip" && !x.answer).map(x => x.clip.id), pick = t => t.segs.find(x => x.type === "reply").picked;
  const off = tl({ flags: new Set(), counters: {} }), on = tl({ flags: new Set(["took_pill"]), counters: {} }), desk = tl(null);
  const out = storyCheck("TestRoom001", S).trim().split("\n");
  !ids(off).includes("c1") && ids(on).includes("c1") && ids(desk).includes("c1") && pick(off) === "good" && pick(on) === "bad" && pick(desk) === "good"
    && !run(S, thingsOf(S)).some(p => p.sev === "error") && /STORY ok/.test(out.pop())
    ? ok("a line by a flag: left out of a run without it, kept with it and on the desk; an answer by a flag: the first offered is the default; no problems found") : fail(`by a condition: ${JSON.stringify({ off: ids(off), on: ids(on), desk: ids(desk), picks: [pick(off), pick(on), pick(desk)] })} ${out.slice(-3).join(" | ")}`);
  // faults: a counter that isn't one (a line, an answer, a face), every answer with a condition, a word that isn't
  // one, an ending's text that isn't words
  sc.clips[1].count = "nothing"; sc.clips[1].min = 1; rp.options.forEach(o => { o.if = ["took_pill"]; }); rp.options[1].count = "nowt"; rp.options[1].min = 1;
  sc.faces[0].count = "zilch"; sc.faces[0].min = 1; sc.clips[2].en = "Hello, {nobody}."; const end = Object.keys(S.flow).find(k => S.flow[k].type === "ending"); S.flow[end].text = 3;
  const ps = run(S, thingsOf(S)).filter(p => p.sev === "error").map(p => p.text), out2 = storyCheck("TestRoom001", S);
  ps.some(t => /shown by nothing, which isn't a counter/.test(t)) && ps.some(t => /offered by nowt, which isn't a counter/.test(t)) && ps.some(t => /worn by zilch, which isn't a counter/.test(t))
    && /count 'nothing' isn't one of game.counters/.test(out2) && /count 'nowt' isn't one of game.counters/.test(out2) && /count 'zilch' isn't one of game.counters/.test(out2)
    && /every answer has a condition/.test(out2) && /\{nobody\}/.test(out2) && new RegExp(`${end}.*text`).test(out2)
    ? ok("a counter that isn't one (a line, an answer, a face), every answer with a condition, a word that isn't one, an ending's text not words: found live and by the story check")
    : fail("conditions' faults: " + ps.join("; ") + " / " + out2.split("\n").filter(l => /count|condition|nobody|text/.test(l)).join(" | "));
  // a board game's setting by a flag (Concentration: his memory lies off his pills, she lets him win): true or false by
  // the run's flags; a number can't be one; a rename of the flag moves it
  const { boardCtx } = await import("./play/boardgames.js"), { renameRef } = await import("./refs.js");
  const meta = { settings: { pairs: 6, memory_lies: false, lets_win: false } }, set = { memory_lies: "flag:off_pills", lets_win: "!flag:off_pills" };
  const pillsOff = boardCtx({ flags: new Set(["off_pills"]) }, null, meta, set, "Natsuki").settings, pillsOn = boardCtx({ flags: new Set() }, null, meta, set, "Natsuki").settings;
  const tableOf = S => Object.values(S.levels).flatMap(l => [...(l.props || []), ...(l.rooms || []).flatMap(r => r.props || [])]).find(p => p.use === "game");
  const S2 = clone(S0), tbl = tableOf(S2);
  tbl.settings = Object.assign({}, tbl.settings, { rounds: "flag:met_aoi" }); const out3 = storyCheck("TestRoom001", S2);
  const S3 = clone(S0), t3 = tableOf(S3); t3.settings = { seed: 3, extra: "!flag:met_aoi" };
  renameRef(S3, "flag", "met_aoi", "met_her");
  pillsOff.memory_lies === true && pillsOff.lets_win === false && pillsOn.memory_lies === false && pillsOn.lets_win === true && pillsOff.pairs === 6
    && new RegExp(`${tbl.game}'s rounds by a flag is true or false`).test(out3) && t3.settings.extra === "!flag:met_her"
    ? ok("a table's setting by a flag: true or false by the run's flags (and not, with !), a number by a flag refused, the flag's rename moving it")
    : fail(`settings by a flag: ${JSON.stringify({ pillsOff, pillsOn, extra: t3.settings.extra })} ${out3.split("\n").filter(l => /rounds/.test(l)).join(" | ")}`);
}

console.log(fails.length ? `DESK FAILED (${fails.length})` : "DESK ok");
process.exit(fails.length ? 1 : 0);

// DESK: the desk's own logic, without a browser. The live checks (lint.js) find nothing wrong in a game the story
// check passes, and find each fault put in on purpose, at its place (the node, the beat, the line, the level). The
// merge (merge.js) puts the desk's edits and Claude's together, asking only where both changed the same thing.
//   node tools/director/desktest.mjs
import { readFileSync, readdirSync, existsSync } from "fs";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { lint } = await import("./lint.js");
const fails = [], ok = m => console.log("  ok  " + m), fail = m => { fails.push(m); console.log("  FAIL " + m); };
const clone = o => JSON.parse(JSON.stringify(o));
const games = readdirSync(join(ROOT, "Content", "Games")).filter(g => existsSync(join(ROOT, "Content", "Games", g, "story.json")));
const story = g => JSON.parse(readFileSync(join(ROOT, "Content", "Games", g, "story.json"), "utf8"));
const poses = Object.keys(JSON.parse(readFileSync(join(ROOT, "Content", "Studio", "poses.json"), "utf8")).poses);
const thingsOf = S => JSON.parse(execFileSync("python3", ["-c", `import sys, json; sys.path.insert(0, ${JSON.stringify(join(ROOT, "Content", "Python"))})
from storykit import storylib as L
th, _ = L.index(json.load(sys.stdin))
print(json.dumps({k: {"kind": t.kind, "use": t.use, "level": t.level} for k, t in th.items()}))`], { input: JSON.stringify(S), encoding: "utf8" }));
const secs = c => c.dur ? c.dur - ((c.trim || {}).in || 0) - ((c.trim || {}).out || 0) : 0;
const run = (S, th) => lint(S, { things: th, poses, secs });

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

console.log(fails.length ? `DESK FAILED (${fails.length})` : "DESK ok");
process.exit(fails.length ? 1 : 0);

// DESK: the desk's own logic, without a browser. The live checks (lint.js) find nothing wrong in a game the story
// check passes, and find each fault put in on purpose, at its place (the node, the beat, the line, the level).
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

console.log(fails.length ? `DESK FAILED (${fails.length})` : "DESK ok");
process.exit(fails.length ? 1 : 0);

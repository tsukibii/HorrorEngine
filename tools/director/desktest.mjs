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
from storykit import storylib as L
th, _ = L.index(json.load(sys.stdin))
print(json.dumps({k: {"kind": t.kind, "use": t.use, "level": t.level, "shape": str(t.d.get("shape", ""))} for k, t in th.items()}))`], { input: JSON.stringify(S), encoding: "utf8" }));
const storyCheck = (g, S) => {                     // the story check on a story not saved (story_check.py --story)
  const f = join(tmpdir(), `desk_${g}_${process.pid}.json`); writeFileSync(f, JSON.stringify(S));
  try { return execFileSync("python3", [join(ROOT, "tools", "story_check.py"), "--game", g, "--story", f], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { return (e.stdout || "") + (e.stderr || ""); } finally { rmSync(f, { force: true }); }
};
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
  const S = story("Sample"), th = thingsOf(S), of = f => Object.keys(th).filter(k => f(th[k]));
  const room = of(t => t.kind === "room"), door = of(t => t.kind === "door"), locker = of(t => t.use === "locker"), person = of(t => /^person/.test(t.shape || ""));
  const ending = Object.keys(S.flow).find(k => S.flow[k].type === "ending"), back = S.game.start;
  const values = {
    key_door: { title: "The test key", item: "cellar_key", door: "cellar_door", beyond: room[room.length - 1], find: "Find the key" },
    read_note: { note: Object.keys(S.notes)[0], thought: "Shaky." }, fetch: { item: Object.keys(S.items)[1], place: room[1] },
    timed_escape: { exit: room[0], secs: 30, fail: ending }, hide_round: { seeker: Object.keys(S.cast)[0], places: locker.slice(0, 2), secs: 40 },
    chase: { seeker: Object.keys(S.cast)[0], exit: door[0], secs: 25 },
  };
  const made = [];
  for (const tpl of Q.TASKS) {
    const r = Q.buildTask(S, tpl, values[tpl.id] || {}), nid = "n_qe_" + tpl.id;
    S.flow[nid] = { type: "stitch", ref: r.tid, next: back };
    if (r.round) { S.flow[nid].next = nid + "_r"; S.flow[nid + "_r"] = { type: "choice", by: "result", of: nid, options: Object.values({ hide: ["hidden", "found"], run: ["escaped", "caught"] }[r.round]).map(x => ({ result: x, to: back })) }; }
    made.push(nid);
  }
  const bv = { jumpscare: { zone: room[0], figure: person[0], sound: Object.keys(S.sounds)[0] }, knock: { zone: room[0], at: door[0], count: 3 }, lights_die: { room: room[0], secs: 1 },
    slam: { zone: room[0], door: door[0] }, whisper: { look: door[0], line: Object.keys(S.lines)[0], at: door[0] }, speaks: { zone: room[0], line: Object.keys(S.lines)[0] }, checkpoint: { zone: room[0] } };
  const bst = Q.buildTask(S, Q.TASK.read_note, values.read_note), beats = Q.BEATS.map(t => Object.assign(Q.buildBeat(S, t, bv[t.id] || {}), { optional: true }));
  bst.stitch.beats.push(...beats); S.flow.n_qe_beats = { type: "stitch", ref: bst.tid, next: back }; made.push("n_qe_beats");
  ok(`${Q.TASKS.length} tasks and ${Q.BEATS.length} beats built: ${Q.TASKS.map(t => t.id).join(", ")}; ${Q.BEATS.map(t => t.id).join(", ")}`);
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
  const { facingRot, roomAt, newSpot } = await import("./marks.js");
  const f = [[[0, 0], [1, 0], 0], [[0, 0], [0, 1], 90], [[0, 0], [-1, 0], 180], [[0, 0], [0, -1], 270], [[2, 4.6], [2, 2.2], 270]];
  f.every(([a, b, w]) => facingRot(a, b) === w) ? ok("facing: east 0, north 90, west 180, south 270") : fail("facing: " + f.map(([a, b]) => facingRot(a, b)).join(","));
  const S = story("Sample"), lv = S.levels.house, room = (x, y) => (roomAt(lv, x, y) || {}).id || null;
  room(2, 3) === "hall" && room(2, -1.5) === "porch" && room(50, 50) === null ? ok("the room under a point: hall, porch, none outside") : fail(`rooms: ${room(2, 3)} ${room(2, -1.5)} ${room(50, 50)}`);
  const hall = roomAt(lv, 1, 4.6), id = newSpot(S, "house", hall, 1, 4.6, facingRot([1, 4.6], [2, 2.2]), "hall_mari_spot"), sp = hall.props.find(x => x.id === id);
  id === "hall_mari_spot_2" && sp && sp.at[0] === 1 && sp.at[1] === 4.6 && sp.use === "spot" ? ok(`a new mark: ${id} at ${sp.at} facing ${sp.rot} (its id unique, the room's coordinates)`) : fail("a new mark: " + JSON.stringify(sp));
  S.scenes.s_message.stage.mari = id;
  const vid = newSpot(S, "house", roomAt(lv, 2.5, 1.5), 2.5, 1.5, 90, "hall_view_spot"); S.scenes.s_message.view = vid;
  const out = storyCheck("Sample", S).trim().split("\n").pop();
  /STORY ok/.test(out) ? ok(`Mari and the player on new marks: the story check passes (${out})`) : fail("new marks: " + out);
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

console.log(fails.length ? `DESK FAILED (${fails.length})` : "DESK ok");
process.exit(fails.length ? 1 : 0);

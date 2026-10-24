// REFS: the Database's references (refs.js). In every game, every entry (cast members, items, notes, sounds, lines,
// motions, secrets, counters, karma axes, flags) is renamed the way the Database renames it: each keeps its uses
// under the new id, none is left under the old, and the story check still passes on the renamed story with the
// same number of warnings. A use the check reads but refs.js misses fails it ("isn't an item", "isn't in cast"...).
//   node tools/director/refstest.mjs
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { tmpdir } from "os";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const R = await import("./refs.js");
const fails = [], ok = m => console.log("  ok  " + m), fail = m => { fails.push(m); console.log("  FAIL " + m); };
const TMP = mkdtempSync(join(tmpdir(), "refs-"));

// the story check on a story held in a file, as if it were the game's own (its folder for motions and takes)
function check(game, story) {
  const f = join(TMP, game + ".json"); writeFileSync(f, JSON.stringify(story));
  const py = `import sys, json; sys.path.insert(0, ${JSON.stringify(join(ROOT, "tools"))})
import story_check as C
real = C.L.load
C.L.load = lambda g=None: (json.load(open(${JSON.stringify(f)}, encoding="utf-8")), real(g)[1])
sys.argv = ["story_check.py", "--game", ${JSON.stringify(game)}]
C.main()`;
  try { return execFileSync("python3", ["-c", py], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { return (e.stdout || "") + (e.stderr || ""); }
}
const verdict = out => { const m = out.match(/STORY ok \(.*?(\d+) warnings\)/); return m ? { ok: true, warnings: +m[1] } : { ok: false, why: out.split("\n").filter(l => /ERROR|FAILED|Error/.test(l)).slice(0, 4).join(" · ") }; };

for (const g of readdirSync(join(ROOT, "Content", "Games"))) {
  const f = join(ROOT, "Content", "Games", g, "story.json"); if (!existsSync(f)) continue;
  const S0 = JSON.parse(readFileSync(f, "utf8")), S = JSON.parse(JSON.stringify(S0));
  const before = verdict(check(g, S0));
  if (!before.ok) { fail(`${g}: the check fails before any rename (${before.why})`); continue; }
  const entries = [];
  for (const kind of Object.keys(R.KINDS)) {
    const ids = kind === "flag" ? Object.keys(R.flagsOf(S0)) : Object.keys(R.tableOf(S0, kind) || {});
    for (const id of ids) if (!(kind === "axis" && id === "karma")) entries.push([kind, id, R.usesOf(S0, kind, id).length]);
  }
  let moved = 0; const lost = [];
  for (const [kind, id, n] of entries) {
    const nu = "zz_" + id;
    try { moved += R.renameRef(S, kind, id, nu); } catch (e) { lost.push(`${kind} ${id}: ${e.message}`); continue; }
    const now = R.usesOf(S, kind, nu).length, left = R.usesOf(S, kind, id).length;
    if (now !== n || left) lost.push(`${kind} ${id}: ${n} uses before, ${now} after, ${left} left under the old id`);
    if (kind !== "flag" && !(R.tableOf(S, kind) || {})[nu]) lost.push(`${kind} ${id}: not in its table under ${nu}`);
  }
  lost.length ? fail(`${g}: ${lost.slice(0, 4).join("; ")}`) : ok(`${g}: ${entries.length} entries renamed, ${moved} uses moved with them`);
  const after = verdict(check(g, S));
  if (!after.ok) fail(`${g}: the renamed story fails the check: ${after.why}`);
  else if (after.warnings !== before.warnings) fail(`${g}: ${before.warnings} warnings before the renames, ${after.warnings} after`);
  else ok(`${g}: the renamed story passes the check (${after.warnings} warnings, as before)`);
  // a rename back gives the story it started from
  for (const [kind, id] of entries) R.renameRef(S, kind, "zz_" + id, id);
  JSON.stringify(S) === JSON.stringify(S0) ? ok(`${g}: renamed back, the story is as it was`) : fail(`${g}: renamed back, the story differs`);
}
rmSync(TMP, { recursive: true, force: true });
console.log(fails.length ? `REFS FAILED (${fails.length})` : "REFS ok");
process.exit(fails.length ? 1 : 0);

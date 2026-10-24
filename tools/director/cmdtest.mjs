// CMDS: the desk's command table (commands.js) against the story format. Every action and trigger story_check knows
// has a command in the desk (so nothing needs typing as JSON), the desk has none the format lacks, every command and
// trigger in every game reads as a sentence, and each command's starting value names its own verb.
//   node tools/director/cmdtest.mjs
import { readFileSync, readdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const C = await import("./commands.js");
const py = readFileSync(join(ROOT, "tools", "story_check.py"), "utf8");
const set = name => new Set([...py.match(new RegExp(`^${name} = \\{([^}]*)\\}`, "m"))[1].matchAll(/"([a-z_]+)"/g)].map(m => m[1]));
const fails = [], ok = m => console.log("  ok  " + m), fail = m => { fails.push(m); console.log("  FAIL " + m); };

const actions = set("ACTIONS"), triggers = set("TRIGGERS");
const missA = [...actions].filter(v => !C.ACTION[v]), extraA = C.ACTIONS.map(d => d.verb).filter(v => !actions.has(v));
const missT = [...triggers].filter(v => !C.TRIGGER[v]), extraT = C.TRIGGERS.map(d => d.verb).filter(v => !triggers.has(v));
missA.length || extraA.length ? fail(`actions: missing in the desk ${missA.join(", ") || "none"}; not in the format ${extraA.join(", ") || "none"}`) : ok(`all ${actions.size} actions have a command in the desk`);
missT.length || extraT.length ? fail(`triggers: missing in the desk ${missT.join(", ") || "none"}; not in the format ${extraT.join(", ") || "none"}`) : ok(`all ${triggers.size} triggers have one`);
const badMake = [...C.ACTIONS, ...C.TRIGGERS].filter(d => !Object.keys(d.make()).includes(d.verb)).map(d => d.verb);
badMake.length ? fail(`a starting value without its own verb: ${badMake.join(", ")}`) : ok("every command's starting value names its own verb");
const groups = new Set(C.GROUPS.map(g => g.id)), noGroup = C.ACTIONS.filter(d => !groups.has(d.group)).map(d => d.verb);
noGroup.length ? fail(`commands in no group: ${noGroup.join(", ")}`) : ok("every command sits in a palette group");

// every action and trigger in the games reads as a sentence (not the JSON it falls back to)
let na = 0, nt = 0; const raw = [];
const acts = (list, where) => { for (const a of list || []) { if (!a || typeof a !== "object") continue; na++; const t = C.actionText(a); if (t.startsWith("{")) raw.push(`${where}: ${t}`);
  for (const o of Array.isArray(a.options) ? a.options : []) acts(o.do, where); } };
const trig = (w, where) => { if (!w) return; nt++; const t = C.triggerText(w); if (t.startsWith("{")) raw.push(`${where}: ${t}`); for (const x of w.all || w.any || []) trig(x, where); };
for (const g of readdirSync(join(ROOT, "Content", "Games"))) {
  const f = join(ROOT, "Content", "Games", g, "story.json"); if (!existsSync(f)) continue;
  const s = JSON.parse(readFileSync(f, "utf8"));
  for (const [tid, st] of Object.entries(s.stitches || {})) {
    for (const b of st.beats || []) { trig(b.when, `${g} ${tid} ${b.id}`); acts(b.do, `${g} ${tid} ${b.id}`); }
    for (const l of Object.values((st.play || {}).on || {})) acts(l, `${g} ${tid} play`);
  }
  for (const [sid, sc] of Object.entries(s.scenes || {})) for (const v of [sc, ...Object.values(sc.variants || {})]) {
    acts(sc.sets, `${g} ${sid} sets`); for (const cu of v.cues || []) acts([cu.do], `${g} ${sid} cue`);
    for (const c of v.clips || []) for (const l of Object.values((c.event || {}).on || {})) acts(l, `${g} ${sid} ${c.id}`);
  }
  for (const n of Object.values(s.flow || {})) for (const o of n.options || []) if (o.when) trig(o.when, `${g} choice`);
  for (const it of s.interrupts || []) trig(it.when, `${g} interrupt ${it.id}`);
}
raw.length ? fail(`${raw.length} read as JSON: ${raw.slice(0, 4).join(" · ")}`) : ok(`every one in the games reads as a sentence (${na} commands, ${nt} triggers)`);
console.log(fails.length ? `CMDS FAILED (${fails.length})` : "CMDS ok");
process.exit(fails.length ? 1 : 0);

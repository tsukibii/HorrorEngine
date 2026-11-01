// Godot's words for what happens (the HorrorStudio panel's Story tab, docs/GODOT_DIRECTOR.md §6e): the desk's commands
// and triggers (tools/director/commands.js) as the Director has them (words.js, the Manager's too), the conditions'
// clauses and fact words, and examples of how each reads, written as the Director plugin's story/commands.json. Godot
// can't run commands.js's sentences, so story/commands.gd says them in GDScript and DIRECTOR checks every example here
// reads the same there. Run it after changing commands.js or words.js:
//   node tools/director_manager/commands_json.mjs           (writes the file)
//   node tools/director_manager/commands_json.mjs --check   (COMMANDSJSON ok: the file is what this would write)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../..");
const OUT = path.join(ROOT, "GodotPlugins/HorrorStudioDirector/addons/horrorstudio_director/story/commands.json");
const C = await import(path.join(ROOT, "tools/director/commands.js"));
const W = await import(path.join(HERE, "words.js"));
W.directorCommands(C);

const MORE = { trick: "tricks", behave: "behave" };     // a command whose fields grow by a choice (commands.js `more`)
const plain = d => {
  const o = { verb: d.verb, label: d.label };
  for (const k of ["icon", "group", "hint", "rare", "branches", "nest"]) if (d[k] !== undefined) o[k] = d[k];
  o.fields = d.fields;
  o.make = d.make();
  if (d.outcomes) o.outcomes = d.outcomes;
  if (d.more) {
    if (!MORE[d.verb]) throw new Error(`${d.verb}: a command whose fields grow by its choice that commands_json.mjs doesn't know: add it to MORE and to commands.gd fields_of`);
    o.more = MORE[d.verb];
  }
  return o;
};

// ---- examples: each command as made, with every field filled, with each of its choices ----------------------------
const sample = (f, i) => {
  switch (f.kind) {
    case "text": case "longtext": return `words ${i}`;
    case "number": return i + 2;
    case "bool": return true;
    case "choice": return f.opts[0];
    case "many": case "routes": return [`${f.of || "route"}_a`, `${f.of || "route"}_b`];
    case "karma": return 2;
    case "trigger": return { enter: "hall" };
    case "anyone": case "anylocker": case "anycarry": case "anytodo": return `${f.kind.slice(3)}_${i}`;
    default: return `${f.kind}_${i}`;
  }
};
const fill = (base, fields, skip = new Set()) => { const o = { ...base }; fields.forEach((f, i) => { if (!skip.has(f.key)) o[f.key] = sample(f, i); }); return o; };
const examples = [];
const add = (what, value) => {
  const text = what === "action" ? C.actionText(value) : C.triggerText(value);
  if (!examples.some(e => e.what === what && JSON.stringify(e.value) === JSON.stringify(value))) examples.push({ what, value, text });
};
for (const d of C.ACTIONS) {
  add("action", d.make());
  if (d.verb === "trick") { for (const k of Object.keys(C.TRICKS)) { add("action", { trick: k }); add("action", fill({ trick: k }, C.TRICKS[k])); } continue; }
  if (d.verb === "behave") { for (const k of C.BEHAVE_AS) { add("action", { behave: "mari", as: k }); add("action", fill({ behave: "mari", as: k, sees: true }, C.BEHAVE_FIELDS[k])); } continue; }
  const full = fill(d.make(), d.fields);
  add("action", full);
  d.fields.forEach(f => { if (f.kind === "choice") for (const o of f.opts) add("action", { ...full, [f.key]: o }); });
  d.fields.forEach(f => { if (f.opt) { const x = { ...full }; delete x[f.key]; add("action", x); } });
}
add("action", { karma: -1 }); add("action", { karma: { trust: 2, fear: -1 } });
add("action", { count: "found", add: -2 }); add("action", { count: "found", set: 0 });
add("action", { untodo: "mop_floor" }); add("action", { skip: 90 }); add("action", { skip: 5400 }); add("action", { skip: 7200 });
add("action", { chapter: "Night 2", save: false }); add("action", { behave: "mari", as: "idle", at: "sofa", face: "player" });
add("action", { behave: "mari", as: "patrol", routes: ["a", "b"], pick: "random" }); add("action", { behave: "mari", as: "go", to: "door", then: "sit", via: [] });
add("action", { torch: "nonsense" }); add("action", { skin: "mari" }); add("action", { fade: "in", secs: 0 }); add("action", { wait: 1.5 });
for (const d of C.TRIGGERS) {
  add("trigger", d.make());
  const full = fill(d.make(), d.fields);
  add("trigger", full);
  d.fields.forEach(f => { if (f.kind === "choice") for (const o of f.opts) add("trigger", { ...full, [f.key]: o }); });
  d.fields.forEach(f => { if (f.opt) { const x = { ...full }; delete x[f.key]; add("trigger", x); } });
}
add("trigger", { caught: "mari" }); add("trigger", { hidden: "wardrobe" }); add("trigger", { carrying: "box" }); add("trigger", { gave: "*", to: "mari", except: "mug" });
add("trigger", { ticked: "find_key" }); add("trigger", { failed: "find_key" }); add("trigger", { all: [{ enter: "hall" }, { flag: "lit" }] });
add("trigger", { any: [{ use: "kettle" }, { read: "letter" }] }); add("trigger", { rolled: "die", at_least: 4 }); add("trigger", { look: "door", secs: 0 });
// conditions: every clause, both ways
const conds = ["read:letter", "!read:letter", "used:kettle", "gave:mug:mari", "!gave:mug", "answered:t_open:yes", "result:q_hide:found", "!result:q_hide:found",
  "@q_key", "saw_figure", "!saw_figure", "step:find_key", "done:q_key", { quest: "q_key" }, { not: { quest: "q_key" } }, { done: "q_key" }, { step: "find_key" },
  { has: "mug" }, { not: { has: "mug" } }, { ending: "e_morning" }, { count: "found", at_least: 3 }, { count: "found", at_most: 1 }, { not: { count: "found", at_least: 2, at_most: 4 } },
  { karma: { at_least: 2 } }, { karma: { at_most: -1 } }, { all: ["read:letter", { step: "find_key" }] }, { any: ["@q_key", { ending: "e_morning" }] }, ["picked:mug", "!entered:hall"]];
for (const c of conds) {
  const p = W.parseCond(c);
  examples.push({ what: "cond", value: c, text: W.condText(c), mode: p.mode, clauses: p.items.map(W.clauseText), json: W.buildCond(p.mode, p.items) ?? null });
}

const out = {
  about: "Written by tools/director_manager/commands_json.mjs from tools/director/commands.js and tools/director_manager/words.js: don't edit it by hand",
  groups: C.GROUPS, actions: C.ACTIONS.map(plain), triggers: C.TRIGGERS.map(plain),
  tricks: C.TRICKS, trick_labels: C.TRICK_LABELS, behave_fields: C.BEHAVE_FIELDS,
  clauses: W.CLAUSES, fact_words: W.FACT_WORDS, examples,
};
const text = JSON.stringify(out, null, 1) + "\n";
if (process.argv.includes("--check")) {
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (now !== text) { console.log("COMMANDSJSON FAIL: story/commands.json is out of date: node tools/director_manager/commands_json.mjs"); process.exit(1); }
  console.log(`COMMANDSJSON ok (${out.actions.length} commands, ${out.triggers.length} triggers, ${examples.length} examples)`);
} else {
  fs.writeFileSync(OUT, text);
  console.log(`wrote ${path.relative(ROOT, OUT)}: ${out.actions.length} commands, ${out.triggers.length} triggers, ${examples.length} examples`);
}

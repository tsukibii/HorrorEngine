// BOARD: every board game's rules (Content/Studio/BoardGames/, and any game's own BoardGames/) played offline, hundreds
// of times each, with seeded dice and random choices on a table that only pretends: each game's `meta` is one line of
// JSON (story_check reads it), its id its file's name; every play ends, with one of its results; every result it
// declares comes up in some play (with the settings below for the ones only a setting reaches). Ends "BOARD ok".
//
//   node tools/director/play/boardtest.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { rng, helpers } from "./boardgames-ctx.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PLAYS = 300, STEPS = 5000;
const EXTRA = {                                   // settings that reach the results the defaults don't (or rarely do)
  russian_roulette: [{ refuse: true }, { spin: "every", first: "random", rounds: 2 }, { first: "them", chambers: 3 }],
  high_dice: [{ rounds: 3, dice: 3 }],
  chohan: [{ rounds: 3 }],
  shell_game: [{ swaps: 12, speed: 3 }],
  spin_the_cup: [{ reach: 15 }],
  blackjack: [{ dealer_stands: 19 }],
};
const fail = m => { console.error("BOARD FAIL: " + m); process.exit(1); };

function fakeCtx(meta, settings, seed) {
  const random = rng(seed), pick = rng(seed * 7919 + 13);
  let steps = 0;
  const step = () => { if (++steps > STEPS) throw new Error(`still going after ${STEPS} steps`); };
  const piece = () => new Proxy({}, { get: (o, k) => (k === "then" ? undefined : () => { step(); return Promise.resolve(); }) });
  return Object.assign(helpers(random), {
    settings: { ...meta.settings, ...settings }, you: "You", them: "Mari", seed,
    say: async () => step(), wait: async () => step(), score: () => {},
    choose: async (text, options) => { step(); if (!options || !options.length) throw new Error(`"${text}" has no options`); return Math.floor(pick() * options.length); },
    table: { die: piece, card: piece, cup: piece, ball: piece, revolver: piece, clear: () => {} },
  });
}

const dirs = [path.join(ROOT, "Content/Studio/BoardGames"), ...fs.readdirSync(path.join(ROOT, "Content/Games")).map(g => path.join(ROOT, "Content/Games", g, "BoardGames"))].filter(d => fs.existsSync(d));
let games = 0;
for (const dir of dirs) {
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".js") && !f.startsWith("_")).sort()) {
    const id = f.slice(0, -3), text = fs.readFileSync(path.join(dir, f), "utf8"), line = text.match(/^export const meta = (\{.*\});$/m);
    if (!line) fail(`${f}: no one-line meta (export const meta = {...JSON...};)`);
    let meta; try { meta = JSON.parse(line[1]); } catch (e) { fail(`${f}: its meta isn't JSON: ${e.message}`); }
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    if (JSON.stringify(mod.meta) !== JSON.stringify(meta)) fail(`${f}: the meta line and the module's meta differ`);
    if (meta.id !== id || !meta.title || !Array.isArray(meta.results) || !meta.results.length || new Set(meta.results).size !== meta.results.length || typeof meta.settings !== "object")
      fail(`${f}: meta needs id (${id}), title, results (unique) and settings`);
    if (typeof mod.default !== "function") fail(`${f}: export default async function play(ctx)`);
    const seen = {};
    for (const settings of [{}, ...(EXTRA[id] || [])]) {
      for (const k of Object.keys(settings)) if (!(k in meta.settings)) fail(`${f}: the test's setting ${k} isn't in its meta`);
      for (let n = 1; n <= PLAYS; n++) {
        let r;
        try { r = await mod.default(fakeCtx(meta, settings, n)); } catch (e) { fail(`${id} ${JSON.stringify(settings)} seed ${n}: ${e.message}`); }
        if (!meta.results.includes(r)) fail(`${id} ${JSON.stringify(settings)} seed ${n}: ended ${JSON.stringify(r)}, not one of ${meta.results.join(", ")}`);
        seen[r] = (seen[r] || 0) + 1;
      }
    }
    const missing = meta.results.filter(r => !seen[r]);
    if (missing.length) fail(`${id}: never ended ${missing.join(", ")}`);
    console.log(`  ok  ${id.padEnd(17)} ${meta.title}: ${meta.results.map(r => `${r} ${seen[r]}`).join(", ")}`);
    games++;
  }
}
if (!games) fail("no board games found");
console.log("BOARD ok");

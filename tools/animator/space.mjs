// The room her clips take up, measured (docs/ANIMATION_RULES.md; DECISIONS 2026-11-14, later: "interior, furniture and
// street rules ... so if I use claude to model in the future it can stick to rules that dont break the animations").
// Every clip a body is given is made by the Animator from that body; this plays each on the test bodies (bodies.mjs:
// three adults, three children, five creatures), skins the body at every frame and says how far any of her skin gets
// from where she stands: in front, behind, to her sides, up. For the clips that use furniture, from the furniture:
// in front of a seat's edge, behind it, along a bed, at a door. The rules' numbers are these, rounded up.
//
//   node tools/animator/space.mjs                 prints the tables
//   node tools/animator/space.mjs --write         also writes Content/Studio/Animation/space.json (what the rules quote)
//   node tools/animator/space.mjs --check         SPACE: the file is what the clips measure today (within 1.5 cm)
//   node tools/animator/space.mjs --body imp      one body
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { testBody, bodyGlb, mhrRigBuffer, TEST_BODIES, CHILD_BODIES, CREATURE_BODIES } from "./bodies.mjs";
import { parseGlb } from "./core/glb.js";
import { prepare, makers, makeClip, settingsFor } from "./core/animate.js";
import { furniture } from "./core/acts.js";
import { Q } from "./core/m.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", ".."), FILE = join(ROOT, "Content", "Studio", "Animation", "space.json");
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; }, MHR = mhrRigBuffer(), r2 = v => +v.toFixed(2);
const ALL = [...Object.keys(TEST_BODIES), ...Object.keys(CHILD_BODIES), ...CREATURE_BODIES], names = opt("--body") ? opt("--body").split(",") : ALL;
// what's measured: [group, clips, kinds to make]
const GROUPS = [["stand", ["idle_loop"], ["idle"]], ["walk", ["walk_loop"], ["walk"]], ["run", ["run_loop"], ["run"]], ["sneak", ["sneak_loop", "crouch_loop"], ["sneak"]],
  ["crawl", ["crawl_loop", "crawl_idle_loop"], ["crawl"]], ["scuttle", ["scuttle_loop"], ["crawl", "creature"]], ["creep", ["creep_loop", "creep_idle_loop"], ["creature"]],
  ["sit", ["sit_down", "sit_loop", "stand_up"], ["sit"]], ["bed", ["lie_down", "sleep_loop", "get_up"], ["sleep"]], ["door_push", ["open_push"], ["open"]], ["door_pull", ["open_pull"], ["open"]], ["door_slide", ["open_slide"], ["open"]],
  ["reach_low", ["reach_low"], ["reach"]], ["reach_mid", ["reach_mid"], ["reach"]], ["reach_high", ["reach_high"], ["reach"]], ["peek", ["peek_out", "peek_loop", "peek_back"], ["peek"]],
  ["scare", ["scare_lunge", "scare_loom", "scare_snap", "scare_claw"], ["scare"]], ["punch", ["punch"], ["fight"]], ["swing", ["swing"], ["fight"]], ["knock", ["knock"], ["acting"]], ["cower", ["cower_loop"], ["acting"]]];

function measure(name) {
  const tb = testBody(name), ctx = prepare(parseGlb(bodyGlb(tb)), { mhrRig: MHR }), R = ctx.rig, b = ctx.body, set = settingsFor(ctx.glb, b, {});
  const slot = tb.joints.map(j => R.ix.get(j.name)), nv = tb.P.length / 3, pick = []; for (let i = 0; i < nv; i += 3) pick.push(i);   // (a third of her skin's points: within a centimetre of all of them)
  // a frame's skin: each picked point by its heaviest bones, from the joints as the frame has them
  const skin = (F, each) => { const P = F.solved.P, D = F.solved.D;
    for (const i of pick) { let x = 0, y = 0, z = 0;
      for (let k = 0; k < 4; k++) { const w = tb.BW[i * 4 + k]; if (w <= 0) continue; const j = slot[tb.BI[i * 4 + k]], at = R.J[j].at, v = Q.rot(D[j], [tb.P[i * 3] - at[0], tb.P[i * 3 + 1] - at[1], tb.P[i * 3 + 2] - at[2]]);
        x += w * (P[j * 3] + v[0]); y += w * (P[j * 3 + 1] + v[1]); z += w * (P[j * 3 + 2] + v[2]); }
      each(x, y, z); } };
  const made = {}; for (const m of makers(R, b, set, null, ctx.X)) made[m.name] = m;
  const out = { height: r2(b.height), shoulder: r2(b.shoulderY + b.floor), leg: r2(b.leg), arm: r2(b.upper + b.fore), furniture: furniture(b, set), own: furniture(b, { furniture: "own" }), clips: {} };
  for (const [g, clipNames] of GROUPS) { const box = { x0: 9, x1: -9, y1: -9, z0: 9, z1: -9 }, bands = { low: -9, mid: -9, high: -9 }; let meta = null, secs = 0, speed = 0;
    for (const cn of clipNames) { const m = made[cn]; if (!m) continue; const c = makeClip(R, b, ctx.X, ctx.plan, m, set); meta = meta || m.meta; secs += c.frames.length / m.fps; speed = m.speed || speed;
      const step = c.frames.length > 90 ? 2 : 1, drift = m.speed ? m.speed / m.fps : 0;      // (a gait's body is kept where it is: the clip moves her along)
      for (let f = 0; f < c.frames.length; f += step) skin(c.frames[f], (x, y, z) => { if (x < box.x0) box.x0 = x; if (x > box.x1) box.x1 = x; if (y > box.y1) box.y1 = y; if (z < box.z0) box.z0 = z; if (z > box.z1) box.z1 = z;
        const k = y < 0.55 * b.height / 1.63 ? "low" : y < 0.85 * b.height / 1.63 ? "mid" : "high"; if (z > bands[k]) bands[k] = z; }); }
    if (box.x1 < -8) continue;
    const e = { wide: r2(Math.max(-box.x0, box.x1) * 2), left: r2(box.x1), right: r2(-box.x0), front: r2(box.z1), back: r2(-box.z0), up: r2(box.y1) };
    if (speed) e.speed = r2(speed);
    const sb = meta && (meta.seat || meta.bed);
    if (sb) Object.assign(e, { height: sb.height, high: !!sb.high, before: r2(box.z1 - sb.edge), behind: r2(sb.edge - box.z0), before_low: r2(bands.low - sb.edge), before_mid: r2(bands.mid - sb.edge), before_high: r2(bands.high - sb.edge), stands: r2(-sb.edge) });
    if (meta && meta.bed) Object.assign(e, { head: meta.bed.head.map(r2), to_head: r2(box.x1), to_feet: r2(-box.x0) });
    if (meta && meta.door) Object.assign(e, { handle: meta.door.handle.map(r2), travel: meta.door.travel.map(r2), stands: r2(meta.door.handle[2]), behind: r2(-box.z0) });
    if (meta && meta.reach) Object.assign(e, { at: meta.reach.at.map(r2) });
    if (meta && meta.peek) Object.assign(e, { edge: meta.peek.edge.map(r2) });
    if (meta && meta.scare) e.reach = r2(meta.scare.reach || 0);
    if (meta && meta.punch) e.at = meta.punch.at.map(r2);
    if (meta && meta.knock) e.at = meta.knock.at.map(r2);
    out.clips[g] = e; }
  return out;
}

const t0 = Date.now(), got = {}; for (const n of names) got[n] = measure(n);
const cm = v => v == null ? "" : Math.round(v * 100);
const show = (title, rows) => { console.log("\n" + title); for (const r of rows) console.log("  " + r); };
show("standing and moving (cm): how wide, in front of and behind where she stands, how tall; a gait's speed", names.map(n => `${n.padEnd(13)} ${cm(got[n].height)} tall  ` + ["stand", "walk", "run", "sneak", "creep", "crawl", "scuttle"].map(g => { const e = got[n].clips[g]; return e ? `${g} ${cm(e.wide)}w ${cm(e.front)}f ${cm(e.back)}b ${cm(e.up)}h${e.speed ? ` ${e.speed}m/s` : ""}` : ""; }).join(" | ")));
show("a seat (cm): its height; she stands this far in front of its edge; her body gets this far in front of the edge (below the knee, at table height, above it), this far behind it, this wide, this high", names.map(n => { const e = got[n].clips.sit; return `${n.padEnd(13)} seat ${cm(e.height)}${e.high ? " (high)" : ""} stands ${cm(e.stands)}  before ${cm(e.before)} (low ${cm(e.before_low)}, mid ${cm(e.before_mid)}, high ${cm(e.before_high)})  behind ${cm(e.behind)}  wide ${cm(e.wide)}  up ${cm(e.up)}`; }));
show("a bed (cm): its height; before and behind its edge; along it toward her head and toward her feet from where she sits; her head's place", names.map(n => { const e = got[n].clips.bed; return `${n.padEnd(13)} bed ${cm(e.height)}${e.high ? " (high)" : ""}  before ${cm(e.before)}  behind ${cm(e.behind)}  to her head ${cm(e.to_head)}  to her feet ${cm(e.to_feet)}  head at ${e.head.map(cm).join(", ")}  up ${cm(e.up)}`; }));
show("a door (cm): the handle from where she stands (to her right, up, ahead); her hand goes with it; her body behind where she stands, wide, up", names.map(n => ["door_push", "door_pull", "door_slide"].map(g => { const e = got[n].clips[g]; return `${g === "door_push" ? n.padEnd(13) : " ".repeat(13)} ${g.slice(5).padEnd(5)} handle ${e.handle.map(cm).join(", ")}  travel ${e.travel.map(cm).join(", ")}  front ${cm(e.front)} behind ${cm(e.behind)} wide ${cm(e.wide)} up ${cm(e.up)}`; }).join("\n  ")));
show("a thing taken (cm): where it is from where she stands (to her right, up, ahead)", names.map(n => `${n.padEnd(13)} ` + ["reach_low", "reach_mid", "reach_high"].map(g => { const e = got[n].clips[g]; return `${g.slice(6)} ${e.at.map(cm).join(", ")} (front ${cm(e.front)}, up ${cm(e.up)})`; }).join(" | ")));
show("a peek, scares, blows, a knock (cm)", names.map(n => { const c = got[n].clips; return `${n.padEnd(13)} peek: the wall's end at ${c.peek.edge.map(cm).join(", ")}, left ${cm(c.peek.left)} right ${cm(c.peek.right)} front ${cm(c.peek.front)} | scares: front ${cm(c.scare.front)} wide ${cm(c.scare.wide)} up ${cm(c.scare.up)} | punch front ${cm(c.punch.front)} | swing front ${cm(c.swing.front)} up ${cm(c.swing.up)} wide ${cm(c.swing.wide)} | knock at ${c.knock.at.map(cm).join(", ")}`; }));
console.log(`\n  ${names.length} bodies in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (args.includes("--write")) { writeFileSync(FILE, JSON.stringify({ _note: "The room her clips take up, metres: node tools/animator/space.mjs --write (docs/ANIMATION_RULES.md quotes it; --check holds it)", bodies: got }, null, 1)); console.log("  " + FILE); }
if (args.includes("--check")) {
  const errs = []; if (!existsSync(FILE)) errs.push("no Content/Studio/Animation/space.json: node tools/animator/space.mjs --write");
  else { const kept = JSON.parse(readFileSync(FILE, "utf8")).bodies;
    for (const n of names) { if (!kept[n]) { errs.push(`${n} isn't in the file`); continue; }
      for (const [g, e] of Object.entries(got[n].clips)) { const k = (kept[n].clips || {})[g]; if (!k) { errs.push(`${n} ${g}: not in the file`); continue; }
        for (const [key, v] of Object.entries(e)) { const a = [].concat(v), bb = [].concat(k[key] ?? NaN); if (typeof a[0] !== "number") { if (String(v) !== String(k[key])) errs.push(`${n} ${g} ${key}: ${v}, the file says ${k[key]}`); continue; }
          if (a.some((x, i) => !(Math.abs(x - bb[i]) <= 0.015))) errs.push(`${n} ${g} ${key}: ${a.join(", ")} now, the file says ${bb.join(", ")}`); } } } }
  for (const e of errs.slice(0, 20)) console.log("ERROR: " + e);
  console.log(errs.length ? `SPACE FAILED (${errs.length}): the clips changed; node tools/animator/space.mjs --write, then bring docs/ANIMATION_RULES.md's numbers up to date` : "SPACE ok");
  process.exit(errs.length ? 1 : 0);
}

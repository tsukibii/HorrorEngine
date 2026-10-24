// Russian roulette: a revolver with `chambers` chambers and `rounds` live rounds. You and they take turns: lift it,
// pull the trigger. `spin`: "once" (the cylinder spun before the first pull) or "every" (before each pull). `first`:
// "you", "them" or "random". `refuse`: you may put the gun down instead (the result "refused").
// Ends "lose" when the round is yours, "win" when it's theirs.
export const meta = {"id": "russian_roulette", "title": "Russian roulette", "players": 2, "results": ["win", "lose", "refused"], "settings": {"chambers": 6, "rounds": 1, "spin": "once", "first": "you", "refuse": false}};

export default async function play(ctx) {
  const s = ctx.settings, n = Math.max(2, s.chambers | 0), live = Array(n).fill(false), gun = ctx.table.revolver([0, 0.02]);
  for (let k = Math.max(1, Math.min(n, s.rounds | 0)); k > 0;) { const i = ctx.int(n); if (!live[i]) { live[i] = true; k--; } }
  let turn = s.first === "random" ? (ctx.random() < 0.5 ? "you" : "them") : s.first === "them" ? "them" : "you", at = ctx.int(n);
  await ctx.say(`${n} chambers. ${s.rounds > 1 ? s.rounds + " rounds" : "One round"}.`);
  await gun.spin();
  for (;;) {
    if (s.spin === "every") { at = ctx.int(n); await gun.spin(); }
    if (turn === "you") {
      const i = await ctx.choose("Your turn.", s.refuse ? ["Pull the trigger", "Put the gun down"] : ["Pull the trigger"]);
      if (i === 1) { await ctx.say("You put the gun down."); return "refused"; }
    } else await ctx.say(`${ctx.them} lifts the gun.`);
    await gun.aim(turn);
    const bang = live[at]; at = (at + 1) % n;
    await gun.fire(bang, turn);
    if (bang) return turn === "you" ? "lose" : "win";
    await ctx.say("Click.");
    turn = turn === "you" ? "them" : "you";
  }
}

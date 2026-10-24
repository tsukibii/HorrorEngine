// Find the ball (the shell game): a ball goes under one of three cups, they're swapped `swaps` times, faster with `speed`,
// and you pick a cup.
export const meta = {"id": "shell_game", "title": "Find the ball", "players": 1, "results": ["win", "lose"], "settings": {"swaps": 6, "speed": 1}};

export default async function play(ctx) {
  const s = ctx.settings, X = [-0.12, 0, 0.12], cups = X.map(x => ctx.table.cup([x, 0.04])), ball = ctx.table.ball([0, 0.04]);
  let under = 1;                                              // the cup the ball is under (an index into cups)
  const where = cups.map((c, i) => i);                        // where[cup] = its place (0 left, 1 middle, 2 right)
  await ctx.say(`${ctx.them} puts the ball under the middle cup.`);
  for (const c of cups) await c.cover();
  ball.hide();
  for (let k = 0; k < Math.max(1, s.swaps | 0); k++) {
    const a = ctx.int(3), b = (a + 1 + ctx.int(2)) % 3, secs = Math.max(0.12, 0.5 / Math.max(0.2, s.speed) * (1 - k * 0.05));
    await Promise.all([cups[a].move([X[where[b]], 0.04], { secs, arc: 0.05 }), cups[b].move([X[where[a]], 0.04], { secs, arc: -0.05 })]);
    [where[a], where[b]] = [where[b], where[a]];
  }
  const pick = await ctx.choose("Which cup?", ["Left", "Middle", "Right"]), cup = cups[where.indexOf(pick)];
  ball.place([X[where[under]], 0.04]); ball.show();
  await cup.lift();
  if (cups[under] === cup) { await ctx.say("The ball."); return "win"; }
  await ctx.say("Empty."); await cups[under].lift();
  return "lose";
}

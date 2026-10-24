// High dice: you and they each roll `dice` dice; the higher total takes the round, a tie is rolled again. The first to
// win `rounds` rounds wins.
export const meta = {"id": "high_dice", "title": "High dice", "players": 2, "results": ["win", "lose"], "settings": {"dice": 2, "rounds": 1}};

export default async function play(ctx) {
  const s = ctx.settings, n = Math.max(1, Math.min(4, s.dice | 0)), need = Math.max(1, s.rounds | 0);
  const row = y => Array.from({ length: n }, (_, i) => ctx.table.die([(i - (n - 1) / 2) * 0.06, y]));
  const mine = row(-0.07), theirs = row(0.09);
  const roll = async dice => { let t = 0; for (const d of dice) { const f = 1 + ctx.int(6); t += f; await d.roll(f); } return t; };
  let won = 0, lost = 0;
  while (won < need && lost < need) {
    ctx.score(need > 1 ? `You ${won} · ${ctx.them} ${lost}` : null);
    await ctx.choose("Your roll.", ["Roll the dice"]);
    const a = await roll(mine);
    await ctx.say(`${a}.`);
    await ctx.say(`${ctx.them} rolls.`);
    const b = await roll(theirs);
    if (a === b) { await ctx.say(`${b}. A tie: again.`); continue; }
    if (a > b) won++; else lost++;
    await ctx.say(`${b}. ${a > b ? "Yours." : "Theirs."}`);
  }
  ctx.score(null);
  return won >= need ? "win" : "lose";
}

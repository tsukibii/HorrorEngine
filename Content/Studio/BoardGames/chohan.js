// Chō-han (丁半): the dealer shakes two dice in a cup and turns it down onto the table; you call chō (even) or han
// (odd), and the cup lifts. Calls go on until `rounds` are right (a win) or `rounds` are wrong (a loss).
export const meta = {"id": "chohan", "title": "Chō-han", "players": 1, "results": ["win", "lose"], "settings": {"rounds": 1}};

export default async function play(ctx) {
  const need = Math.max(1, ctx.settings.rounds | 0), cup = ctx.table.cup([0, 0.04]), dice = [ctx.table.die([-0.018, 0.04]), ctx.table.die([0.02, 0.05])];
  let right = 0, wrong = 0;
  await cup.cover();
  while (right < need && wrong < need) {
    ctx.score(need > 1 ? `Right ${right} · wrong ${wrong}` : null);
    await cup.lift(); await cup.shake();
    const f = [1 + ctx.int(6), 1 + ctx.int(6)];
    await cup.cover(); for (let i = 0; i < 2; i++) await dice[i].set(f[i]);   // under the cup: unseen
    await ctx.say(`${ctx.them}: "Chō or han?"`);
    const even = (await ctx.choose("Your call.", ["Chō (even)", "Han (odd)"])) === 0;
    await cup.lift();
    const ok = ((f[0] + f[1]) % 2 === 0) === even;
    if (ok) right++; else wrong++;
    await ctx.say(`${f[0]} and ${f[1]}: ${(f[0] + f[1]) % 2 === 0 ? "chō" : "han"}. ${ok ? "You called it." : "Wrong."}`);
  }
  ctx.score(null);
  return right >= need ? "win" : "lose";
}

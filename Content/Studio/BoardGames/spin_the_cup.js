// Spin the cup: a cup on its side is spun on the table and stops pointing at someone: you, or them. Between the two it's
// spun again. The result is whoever it points at ("you" or "them"): what that means is the story's (a truth, a drink,
// a dare).
export const meta = {"id": "spin_the_cup", "title": "Spin the cup", "players": 2, "results": ["you", "them"], "settings": {"reach": 50}};

export default async function play(ctx) {
  const reach = Math.max(10, Math.min(90, ctx.settings.reach)), cup = ctx.table.cup([0, 0.04], { side: true });
  for (;;) {
    await ctx.choose("Spin it.", ["Spin the cup"]);
    const a = ctx.random() * 360;                              // where it stops: 0 points at you, 180 at them
    await cup.spin(a);
    const off = d => Math.abs(((a - d) % 360 + 540) % 360 - 180);
    if (off(0) <= reach) { await ctx.say("It points at you."); return "you"; }
    if (off(180) <= reach) { await ctx.say(`It points at ${ctx.them}.`); return "them"; }
    await ctx.say("It stops between you. Again.");
  }
}

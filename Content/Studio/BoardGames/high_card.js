// High card: you and they each draw a card from a shuffled deck; the higher wins (ace high), a tie draws again.
import { deck, high, nameOf } from "./_lib.js";
export const meta = {"id": "high_card", "title": "High card", "players": 2, "results": ["win", "lose"], "settings": {}};

export default async function play(ctx) {
  const cards = ctx.shuffle(deck()), pile = [-0.2, 0.1];
  for (;;) {
    await ctx.choose("Draw a card.", ["Draw"]);
    const a = cards.pop(), b = cards.pop(), mine = ctx.table.card(a, pile, false), theirs = ctx.table.card(b, pile, false);
    await mine.move([-0.05, -0.05]); await mine.flip();
    await ctx.say(`${nameOf(a)}.`);
    await theirs.move([0.05, 0.1]); await theirs.flip();
    if (high(a) === high(b)) { await ctx.say(`${ctx.them}: ${nameOf(b)}. A tie: again.`); continue; }
    await ctx.say(`${ctx.them}: ${nameOf(b)}. ${high(a) > high(b) ? "Yours." : "Theirs."}`);
    return high(a) > high(b) ? "win" : "lose";
  }
}

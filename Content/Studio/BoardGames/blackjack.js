// Blackjack against them as the dealer: two cards each, one of theirs face down. Hit or stand; over 21 loses at once.
// They turn their card and draw until `dealer_stands` or more. Nearer 21 wins; the same is a push.
import { deck, blackjack, nameOf } from "./_lib.js";
export const meta = {"id": "blackjack", "title": "Blackjack", "players": 2, "results": ["win", "lose", "push"], "settings": {"dealer_stands": 17}};

export default async function play(ctx) {
  const cards = ctx.shuffle(deck()), pile = [-0.22, 0.12], you = [], them = [], down = [];
  const deal = async (hand, y, up) => { const c = cards.pop(), p = ctx.table.card(c, pile, false); hand.push(c); await p.move([-0.07 + hand.length * 0.04, y]); if (up) await p.flip(); else down.push(p); return c; };
  await deal(you, -0.06, true); await deal(them, 0.1, true); await deal(you, -0.06, true); await deal(them, 0.1, false);
  await ctx.say(`${ctx.them} shows ${nameOf(them[0])}.`);
  while (blackjack(you) < 21) {
    ctx.score(`You ${blackjack(you)}`);
    if ((await ctx.choose(`You have ${blackjack(you)}.`, ["Hit", "Stand"])) === 1) break;
    const c = await deal(you, -0.06, true);
    await ctx.say(`${nameOf(c)}.`);
  }
  const mine = blackjack(you);
  ctx.score(null);
  if (mine > 21) { await ctx.say(`${mine}: over.`); return "lose"; }
  for (const p of down) await p.flip();
  while (blackjack(them) < ctx.settings.dealer_stands) await deal(them, 0.1, true);
  const theirs = blackjack(them);
  await ctx.say(`${ctx.them} has ${theirs}${theirs > 21 ? ": over" : ""}. You have ${mine}.`);
  return theirs > 21 || mine > theirs ? "win" : mine < theirs ? "lose" : "push";
}

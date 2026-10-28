// Shinkei suijaku (神経衰弱, Concentration): pairs of cards face down on the table; turn two over, a pair is yours and
// you go again, else they're turned back and it's the other one's turn; whoever holds more pairs at the end wins. For
// The Visitor (HANDOFF_DIRECTOR_TODO §7): `memory_lies` (a card you've seen can be another when you turn it again:
// your memory lies) and `lets_win` (she misses the pairs she knows: she lets you win); `memory` is how much of what's
// been turned over she keeps. The story takes the result from there (the loser answers a question).
import { SUITS, RANKS, nameOf } from "./_lib.js";
export const meta = {"id": "shinkei_suijaku", "title": "Shinkei suijaku (Concentration)", "players": 2, "results": ["win", "lose", "draw"], "settings": {"pairs": 6, "memory": 0.6, "memory_lies": false, "lets_win": false}};

const COLS = 4, GAP_X = 0.09, GAP_Y = 0.115;

export default async function play(ctx) {
  const s = ctx.settings, n = Math.max(2, Math.min(10, Math.round(+s.pairs || 6)));
  const ranks = ctx.shuffle(RANKS).slice(0, n);
  const cards = ctx.shuffle(ranks.flatMap((rank, i) => [{ rank, suit: SUITS[i % 2] }, { rank, suit: SUITS[i % 2 + 2] }]));   // a pair: one rank, two suits
  const rows = Math.ceil(cards.length / COLS), at = i => [((i % COLS) - (COLS - 1) / 2) * GAP_X, (Math.floor(i / COLS) - (rows - 1) / 2) * GAP_Y + 0.05];
  const pieces = cards.map((c, i) => ctx.table.card(c, at(i), false));
  const down = new Set(cards.map((_, i) => i)), seenByYou = new Set(), herMemory = new Map(), held = { you: 0, them: 0 };
  const label = i => `row ${Math.floor(i / COLS) + 1} · card ${(i % COLS) + 1}`;
  const score = () => ctx.score(`${ctx.you} ${held.you} · ${ctx.them} ${held.them}`);
  const remember = i => { if (ctx.random() < +(s.memory ?? 0.6)) herMemory.set(i, cards[i].rank); };
  const lie = async i => {                           // your memory lies: the card you saw here slides off, another in its place
    const others = [...down].filter(j => j !== i && !seenByYou.has(j) && cards[j].rank !== cards[i].rank);
    if (!others.length) return false;
    const j = others[ctx.int(others.length)];
    await Promise.all([pieces[i].move(at(j)), pieces[j].move(at(i))]);
    [cards[i], cards[j]] = [cards[j], cards[i]]; [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    herMemory.delete(i); herMemory.delete(j);
    return true;
  };
  const turn = async i => { await pieces[i].flip(); seenByYou.add(i); remember(i); };
  const back = async (...is) => { await ctx.wait(0.6); for (const i of is) await pieces[i].flip(); };
  const take = async (who, a, b) => {
    down.delete(a); down.delete(b); held[who]++;
    const pile = who === "you" ? [-0.36, -0.22 + held.you * 0.004] : [0.36, 0.32 + held.them * 0.004];
    await pieces[a].move(pile); await pieces[b].move(pile); score();
  };
  score();
  let you = true;
  while (down.size) {
    if (you) {
      const open = [...down];
      let a = open[await ctx.choose("Turn a card over.", open.map(label))];
      if (s.memory_lies && seenByYou.has(a) && ctx.random() < 0.4 && await lie(a)) await ctx.say("Wasn't it there?");
      await turn(a);
      const rest = [...down].filter(j => j !== a);
      const b = rest[await ctx.choose(`${nameOf(cards[a])}. And another.`, rest.map(label))];
      await turn(b);
      if (cards[a].rank === cards[b].rank) { await ctx.say(`${nameOf(cards[b])}. A pair.`); await take("you", a, b); continue; }
      await ctx.say(`${nameOf(cards[b])}. No.`); await back(a, b); you = false;
    } else {
      // what she turns: a pair she knows (unless she lets you win), else one she doesn't know and, if she knows its
      // match, that; otherwise another she doesn't know
      const known = [...herMemory].filter(([i]) => down.has(i)), byRank = {};
      for (const [i, r] of known) (byRank[r] = byRank[r] || []).push(i);
      const pair = Object.values(byRank).find(l => l.length >= 2);
      let a, b;
      const unknown = () => { const u = [...down].filter(j => !herMemory.has(j) && j !== a); return u.length ? u[ctx.int(u.length)] : [...down].filter(j => j !== a)[0]; };
      if (pair && !s.lets_win) [a, b] = pair;
      else {
        a = unknown();
        const m = known.find(([i, r]) => i !== a && r === cards[a].rank);
        if (m && !s.lets_win) b = m[0];
        else { const wrong = [...down].filter(j => j !== a && (!s.lets_win || cards[j].rank !== cards[a].rank)); b = wrong.length ? wrong[ctx.int(wrong.length)] : unknown(); }
      }
      await pieces[a].flip(); remember(a); seenByYou.add(a);
      await pieces[b].flip(); remember(b); seenByYou.add(b);
      if (cards[a].rank === cards[b].rank) { await ctx.say(`${nameOf(cards[a])}, ${nameOf(cards[b])}. Mine.`, "them"); await take("them", a, b); continue; }
      await ctx.say(`${nameOf(cards[a])}, ${nameOf(cards[b])}.`, "them"); await back(a, b); you = true;
    }
  }
  ctx.score(null);
  const r = held.you > held.them ? "win" : held.you < held.them ? "lose" : "draw";
  await ctx.say(r === "win" ? `${held.you} to ${held.them}. You win.` : r === "lose" ? `${held.you} to ${held.them}. ${ctx.them} wins.` : `${held.you} each.`);
  return r;
}

// What the rules share (README.md): a deck of cards, the cards' values and names.
export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const deck = () => SUITS.flatMap(suit => RANKS.map(rank => ({ rank, suit })));
export const high = c => (c.rank === "A" ? 14 : RANKS.indexOf(c.rank) + 1);          // ace high
export const nameOf = c => `${c.rank}${c.suit}`;
export function blackjack(hand) {                    // the best total: aces count 11 until that goes over 21
  let v = 0, aces = 0;
  for (const c of hand) { const r = RANKS.indexOf(c.rank) + 1; if (r === 1) { aces++; v += 11; } else v += Math.min(10, r); }
  while (v > 21 && aces) { v -= 10; aces--; }
  return v;
}

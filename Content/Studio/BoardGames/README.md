# Board games: the rules

A table in a level can hold a board game (`use: "game"`, docs/STORY_FORMAT.md §2): the player uses it (E), sits down
at its long side (the half they came from), leaning in over the top, and the game's rules play it out; then they stand up again and the story
hears `{"played": table, "result": ...}`. Each game is **one file here**, its rules in plain JavaScript: the rules
decide everything (whose turn, what the dice say, who won) and say so through `ctx`. They never touch three.js: the
desk (`tools/director/play/boardgames.js`) turns what they ask for into lines, choices floating at the table and
pieces moving on it, and the BOARD test (`node tools/director/play/boardtest.mjs`) plays every game hundreds of times
on a table that only pretends.

A game of its own goes in `Content/Games/<Game>/BoardGames/` (the same shape; it wins over one here with the same
name). Files starting `_` are helpers, not games (`_lib.js`: a deck of cards, their values and names).

## The games here

| id | What | Results | Settings |
|---|---|---|---|
| `russian_roulette` | a revolver, turns at pulling the trigger | `win` (theirs), `lose` (yours), `refused` | `chambers` 6, `rounds` 1, `spin` `once`/`every`, `first` `you`/`them`/`random`, `refuse` false |
| `high_dice` | each rolls the dice, the higher total takes the round | `win`, `lose` | `dice` 2, `rounds` 1 (first to) |
| `chohan` | 丁半: two dice under a cup, call even (chō) or odd (han) | `win`, `lose` | `rounds` 1 (right calls to win, or wrong ones to lose) |
| `spin_the_cup` | a cup spun on its side stops pointing at someone | `you`, `them` | `reach` 50 (degrees either side that count as pointing) |
| `shell_game` | find the ball under one of three swapped cups | `win`, `lose` | `swaps` 6, `speed` 1 |
| `high_card` | a card each, the higher wins (ace high) | `win`, `lose` | none |
| `blackjack` | against the dealer: hit or stand, nearer 21 | `win`, `lose`, `push` | `dealer_stands` 17 |

Every game also takes `seed` (a number): the same seed plays the same game, for a scripted moment or a test.

## A new game

```js
// Odd one out: a line on what it is, its settings and its results.
export const meta = {"id": "odd_one_out", "title": "Odd one out", "players": 2, "results": ["win", "lose"], "settings": {"rounds": 3}};

export default async function play(ctx) {
  const die = ctx.table.die([0, 0]);
  await ctx.choose("Your throw.", ["Throw"]);
  const f = 1 + ctx.int(6);
  await die.roll(f);
  return f % 2 ? "win" : "lose";
}
```

- `meta` is **one line of JSON** (the story check reads it without running JavaScript): `id` (the file's name),
  `title`, `players`, `results` (every way it can end; the story's `played` triggers name them), `settings` (each with
  its default; a table's `settings` overrides them, and the check refuses any other name).
- `play(ctx)` is async and returns one of the results. Make sure it always ends: BOARD fails a game that runs on.
- Then `node tools/director/play/boardtest.mjs`: every result has to come up in its plays (if one only comes with a
  setting, add that setting to the test's `EXTRA` list).

## ctx

| | |
|---|---|
| `ctx.settings` | the meta's settings, then the table's |
| `ctx.you`, `ctx.them` | "You", and the name of who they play (the table's `vs`, a cast member; "The dealer" with none) |
| `ctx.random()`, `ctx.int(n)`, `ctx.shuffle(list)` | chance: 0..1, 0..n-1, a shuffled copy; seeded by `seed` |
| `await ctx.say(text, who)` | a line in the footer, as long as it takes to read; `who` "them" puts their name over it |
| `await ctx.choose(text, options)` | the index of the option picked (the text is the footer's line, the options float at the table) |
| `await ctx.wait(secs)` | a pause, on the game's clock (the pause menu holds it) |
| `ctx.score(text)` | a line at the top of the screen ("You 1 · Mari 2"); null clears it |
| `ctx.table` | the pieces, placed at `[x, y]`: metres from the table's middle, x to the player's right, y away from them |

The pieces (each call's promise ends when its movement does):

| | |
|---|---|
| `table.die([x, y])` | `await d.roll(face)` tumbles onto that face; `await d.set(face)` turns it there unseen (under a cup) |
| `table.card(card, [x, y], up)` | a card (`{rank, suit}`, `_lib.js`), face up or down; `await c.move([x, y])`, `await c.flip()` |
| `table.cup([x, y])` | upside down, lifted at first: `await u.cover()` puts it down over what's there, `u.lift()`, `u.shake()`, `u.move([x, y], {secs, arc})` |
| `table.cup([x, y], {side: true})` | lying on its side: `await u.spin(degrees)` spins it and stops it pointing there (0 at you, 180 at them) |
| `table.ball([x, y])` | `b.hide()`, `b.show()`, `b.place([x, y])` |
| `table.revolver([x, y])` | `await g.spin()` (the cylinder), `await g.aim("you" or "them")`, `await g.fire(live, who)` (a live round flashes; at you, the screen goes black for a moment) |
| `table.clear()` | everything off the table (it's cleared when the game ends anyway) |

Not in Unreal yet: there the table is a greybox block tagged `use:game` until the StoryRunner grows the same parts
(docs/GAMEPLAY_PLAN.md §10).

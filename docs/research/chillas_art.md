# Chilla's Art's games against ours: what a small team ships, and what we're missing (2026-10-27)

The user's ask (DECISIONS 2026-10-27, late): "a quick research study on Chilla's Art horror games and their gameplay
mechanics and see if we are missing anything; realistically the game should be pretty simple: discover things,
interact, choose dialogue options, no more quick time events; I'm an indie dev, I can't implement as much as
something like Dark Anthology."

**How sure this is.** The web gave news pieces, store pages and a few reviews, not mechanics breakdowns (the Japanese
interview at gendai.media couldn't be reached from the cloud session). Points marked **(sourced)** come from them;
points marked **(known)** are from general knowledge of the games and should be checked against a playthrough before
we build to them.

## 1. What their games are

- **Two brothers, short games, fast** (sourced): many short horror games (The Convenience Store, The Closing Shift,
  Night Security, The Kidnap, Parasocial, Shinkansen 0, Karaoke, Snowed Under...), each about 40 minutes to 1.5 hours
  (The Convenience Store: "about 40 minutes"), cheap (Night Security ¥920).
- **A walking simulator with small puzzles** (sourced): explore, use what you find; the lore told by what's left
  around: newspaper clippings, diaries, symbolic objects; the ending left to the player's reading.
- **Psychological, slow, then terror** (sourced): "a very slow burn to just complete terror"; J-horror dread more than
  jump scares; "the feeling that someone is present" (Night Security).
- **Everyday Japan and a job** (sourced): the first two are built round a shift (a convenience store, closing a
  restaurant); Night Security patrols an empty building at night; The Kidnap a boy searching for his sister on a
  rainy night.
- **Two or three endings** (sourced): good and bad (The Convenience Store: 2, a third on Switch; Night Security: 2;
  Parasocial: several); in Shinkansen 0 the NPCs guide you to the good or the bad one.
- **The look** (sourced): a VHS and CRT filter (The Kidnap), autosave every chapter, "turn the lights off and wear a
  headset".
- **One idea per game** (sourced): Shinkansen 0 is anomaly spotting (after The Exit 8), Snowed Under digging and tool
  upgrades, Karaoke has mini-games, Parasocial a VTuber's stream.
- **The loop inside a shift** (known): a short to-do list (restock the shelves, take out the rubbish, mop, serve the
  customer at the till), done in any order; the night ends, you go home and sleep, the next night is a little wrong;
  your phone gets messages and calls; a stranger keeps coming back; it ends in a short run or a hide, then the news
  report or the note that tells you what really happened.
- **What they don't do** (known): no quick-time events to speak of, no combat, no inventory management, no skill
  checks, no stats; the controls are walk, look, interact, sometimes run or crouch, and answers to a few questions.

## 2. Against ours

| In their games | Ours | Gap |
|---|---|---|
| Walk, look, interact (E) | Play: walk, look, crouch, E; doors, pickups, notes, `inspect`, switches, sit, keypads (`combo`) | none |
| Clues: notes, newspapers, diaries | `note` / `read`, `inspect`, secrets, the little things (a TV, a phone, a clock) | none |
| Dialogue with NPCs, a few answers | `ask` in play, `reply` (a hanging line), `choose`; the cast's behaviours (`path`, `patrol`, `sit`) | none |
| Two or three endings by what you did | endings, secrets, flags, counters, karma, choices by flag/result/act | none |
| Hiding, a short chase or run | `hide`, `locker`, the chase and hide-and-seek templates, timed escape | none |
| Checkpoints, autosave per chapter | `checkpoint` (a quick beat), save slots in the pause menu | small: autosave at a chapter |
| A VHS / CRT look | UltraVHS (Unreal), the desk's VHS preview (docs/VHS.md) | none |
| **A shift's to-do list**, done in any order | one `objective` at a time; counters | **missing**: a checklist on the HUD (S) |
| **A phone in your pocket**: texts and calls | a phone that rings as a little thing (on a table) | **missing**: messages and calls on the HUD (S-M) |
| **Nights as chapters**: go home, sleep, Night 2 | scenes keep their time of day; `fade` | **missing**: sleep in a bed → a title card ("Night 2"), autosave (S) |
| **A visitor at the counter / the door** | behaviours, `ask`, `give`, the knock template | **missing**: a "visitor" quick event (walks in, asks, waits, leaves) (S) |
| The truth told at the end (a news report, a letter) | endings as scenes, notes | small: an ending's epilogue card (S) |
| Anomaly spotting (Shinkansen 0, after The Exit 8) | none | optional: a loop template (M) |
| CCTV monitors (Night Security) | none | optional: sit at a monitor, switch cameras (M) |
| Quick-time events | had six kinds | **deprecated** (this commit): `choose` only |

S: a day or two each; M: about a week.

## 3. What I'd add (smallest first, the user picks)

1. **The to-do list**: an objective with several items ticked off in any order (`objective` with `list`), on the HUD
   under the goal; a beat's `done` ticks one. The whole "work shift" shape rides on it.
2. **Nights as chapters**: a `sleep` interactable on a bed (fade, a title card "Night 2 · 23:40", the time of day, an
   autosave), and a `title` action for any chapter card. The game then reads as days that get worse.
3. **The pocket phone**: `message {from, text}` (a buzz, a text on the HUD, kept in a list on Tab) and `call {who,
   line | scene}` (answer or ignore: a `choose` with the silence as one answer). Cheap, and the most Chilla's Art thing
   there is.
4. **A visitor**: a quick event that walks someone in to a spot, asks their question (`ask`), waits for `give` or an
   answer, and walks out; the stranger who comes back three times changing a little each time.
5. **The epilogue card** on an ending: a newspaper, a letter or a news report, read before the credits.

Not worth it now: the anomaly loop and CCTV monitors (each a game of its own: when a game is built round one), any
inventory beyond what you carry, stats, combat, more mini-games than the board games we have.

## 4. Keeping it indie

What makes theirs work is the order of the night more than mechanics: something ordinary to do, the same place made
wrong a little each time, a stranger, a question you answer, one run at the end. Our desk already does the hard part
(scenes timed to lines, the stage, the flow, endings). The five above are each small, and they're the shape their
games share; everything else stays out.

## Sources

- [Chilla's Art: A rising duo of indie horror games (Foothill Dragon Press)](https://foothilldragonpress.org/277753/a-latest/chillas-art-a-rising-duo-of-indie-horror-games/)
- [Chilla's Art horror games (Tokyo Weekender)](https://www.tokyoweekender.com/entertainment/tech-trends/chillas-art-horror-games/)
- [The Convenience Store (Wikipedia)](https://en.wikipedia.org/wiki/The_Convenience_Store) · [Steam](https://store.steampowered.com/app/1228520/The_Convenience_Store/) · [itch.io comments](https://chill-my-art.itch.io/the-convenience-store/comments?before=19) · [Time Extension (Switch)](https://www.timeextension.com/games/switch-eshop/convenience_store)
- [Night Security announced (Automaton)](https://automaton-media.com/en/indie-games/20230403-18313/) · [Night Security (AppBank, JP)](https://www.appbank.net/2023/07/05/game/2504717.php) · [Siliconera](https://www.siliconera.com/new-chillas-art-j-horror-game-will-be-night-security/)
- [The Kidnap announced (Automaton)](https://automaton-media.com/en/news/20230911-21516/) · [Game*Spark (JP)](https://www.gamespark.jp/article/2023/11/01/135544.html) · [Famitsu (JP)](https://www.famitsu.com/news/202310/30322311.html)
- [Parasocial released (Automaton)](https://automaton-media.com/en/news/20230825-21107/) · [Parasocial story and endings (Gamer Journalist)](https://gamerjournalist.com/chillas-art-parasocial-story-and-ending-explained/)
- [Shinkansen 0 (Automaton)](https://automaton-media.com/en/news/chillas-arts-new-horror-game-shinkansen-0-coming-to-steam-on-march-22/) · [the anomaly-spotting game (Automaton)](https://automaton-media.com/en/news/20240126-26226)
- [Okaeri (TV Tropes)](https://www.tvtropes.org/pmwiki/pmwiki.php/VideoGame/Okaeri) · [Snowed Under (Phúc Anh, VN)](https://www.phucanh.vn/snowed-under.html) · [Chilla's Art (pixiv dictionary, JP)](https://dic.pixiv.net/a/Chilla's_art)

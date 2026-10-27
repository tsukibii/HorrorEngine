---
name: build-game
description: Turn a writers' room chart the user has checked into the game in the director (Content/Games/<Game>/story.json) - a greybox room per place, each shape its scene or task, the talks as close-ups, the choices, secrets and endings, every thing a block of its size to swap for the real one in the Database. Use when the user says a chart looks good and wants it in the director.
argument-hint: <session> [GameName]
---

# /build-game: the chart → the director

The chart is the user's story, checked by them on the writers' room's page. This makes it a rough, working game on
the director's desk, where they refine everything: blocks swapped for real things, the place laid out, the lines
written in full. It plays from the start to every ending before you hand it over.

Asked with: $ARGUMENTS

## 1. Which chart, which game

- The session: as named, or the one `/chart` made last (`python tools/writers/room.py list`, the newest).
- The game's folder: as named, or the title in CamelCase (`Come Over` → `ComeOver`). A game never references another
  game's folder (CLAUDE.md); building over a game that wasn't built from this chart needs the user's yes (`--force`).

## 2. Build

```
python tools/writers/room.py build <id> --game <Game>
python tools/check_all.py --game <Game>
```

- Build writes `Content/Games/<Game>/story.json` (`game.draft: true`, lines as text: `game.voice: "none"`), `BUILD.md`
  (what's left, shape by shape, each with its script as written) and `faces.md` (the expression videos to make).
- STORY, LEVEL and SHOTS must pass. A failure is the build's to fix (tools/writers/build.py), never by hand-editing the
  story: write the lesson in docs/LESSONS.md if it took a second try.
- `python tools/story.py --game <Game> flow` and `rooms`: read it against the chart. Every shape is there, every thing
  the chart names is a block in the room it's first used in, every choice has its ways.

## 3. Hand it over

- The desk: `python tools/director/serve.py`, then `http://127.0.0.1:8780/?game=<Game>`. Its board is laid out as the
  chart was; the Watch plays it, Play walks it.
- Tell them in a few lines: what was built, where the blocks are (the Database's things: the real one goes in there),
  and the first few boxes of BUILD.md as what could come next.
- Then stop. BUILD.md is a menu, not a queue: ask what they're doing now (CLAUDE.md).

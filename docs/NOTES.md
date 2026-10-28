# Writing a game in your notes

Write the game any way you like, in any notepad. Then give it to Claude with what you roughly want, and Claude turns
it into the writers' room's chart for you to look over (DECISIONS 2026-10-27, later).

```
/chart ~/notes/come_over.txt  about an hour, three endings, the true one only if you never lie to her
```

When the chart looks right:

```
/build-game come-over
```

That makes it a rough, working game on the director's desk, every thing a block of its size. You refine it there:
real things in place of the blocks, the place laid out, the lines in full.

## A few marks that help (all optional)

Write however it comes. These just make it quicker to read:

| Mark | Means |
|---|---|
| `( Opening )` | a new part of the story starts |
| `"I should clean up"` | your own thought |
| `Ji: "You came."` | someone says it (`Ji: (she looks away) "You came."` with what her face does) |
| `*open door*` | something you do, or a sound (`*knock, knock*`) |
| `[ Greet ] She's cold, let her in --- [ Question ] Is this her?` | your answers: the act, then your thought |
| `// make this scarier` | a note to Claude, not part of the story |

Anything else (a task, a hidden timer, a secret, how an ending is reached), just say it in words. Claude asks about
what isn't clear and leaves sticky notes on the chart for what it had to decide.

The commands are `.claude/skills/chart/SKILL.md` and `.claude/skills/build-game/SKILL.md`; the script Claude writes
your notes out in is `.claude/skills/chart/script.md`.

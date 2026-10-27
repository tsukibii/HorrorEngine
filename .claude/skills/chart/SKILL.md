---
name: chart
description: Turn the user's story notes, written any way they like in a notepad (or pasted), into a writers' room chart they can inspect (a session in Content/Prototypes). Use when the user passes their notes or a story file and says what they roughly want, asks for it as a chart or a "writer block game", or wants a chart made this way changed.
argument-hint: <notes file, or the notes pasted> [what you roughly want]
---

# /chart: the user's notes → the writers' room chart

The user writes the game however they like, in a notepad (DECISIONS 2026-10-27, later): their lines, their thoughts,
what happens, their answers, in their own marks or none. You turn it into the writers' room chart for them to inspect.
You don't build the game here: that's `/build-game`, once they say the chart looks good.

Asked with: $ARGUMENTS

## 1. Read

- Their notes, whole: the file named above, or what they pasted. And what they roughly want (length, endings, tone).
- `script.md` beside this file: the script you write it out in, and what the import makes of each line.
- docs/NOTES.md: the few marks suggested to them (they may use them, their own, or none).
- If not read this session: the top of docs/DECISIONS.md, and docs/WRITING.md (horror romance in first person) for
  what bears on this story.

## 2. Write the script

Write it to `Saved/Writers/<name>.script.txt` (Saved/ isn't tracked; the session keeps the script it was made from).

- **Their words stay theirs.** Every line, thought, answer and description they wrote goes in as they wrote it; fix
  only a typo that is plainly one. Don't add lines they didn't write: where the notes say something happens without
  its words ("she tells him about the accident"), write what happens as a plain line, not made-up dialogue.
- **The structure is yours.** Parts where the place, the time or the situation changes; what the player does as acts
  (`*open door*`); what they're asked to do as tasks; the branches as conditions; secrets with their `Find:`; endings
  with how they're reached (an answer, karma, or what you do).
- **Things are names.** Every object the player touches is a thing in a few words (`the photo album`), sized when it
  isn't obvious (`(large)`). They become blocks of that size, swapped for the real ones in the director.
- **Say what you decided.** A guess (where a scene happens, an ending's condition they didn't give, an answer's karma)
  is a `Note:` line where it applies: a sticky note on the chart they'll see. Never invent a plot turn, a character or
  an ending: ask (a `Note:`, and in your reply).
- **What they roughly want** shapes the structure (how many endings, how they're decided, the karma). Don't pad to a
  length: the chart counts the minutes (the bar on the page; an hour's game is 45 to 75), so say if it's far off.
- Their own marks map onto the script's (`( Part )`, `"thought"`, `Name: "line"`, `*act*`, `[ Answer ] thought`).

## 3. Import and check

```
python tools/writers/room.py list                                          # an existing session?
python tools/writers/room.py import Saved/Writers/<name>.script.txt --notes <their notes file> -v
python tools/writers/room.py import Saved/Writers/<name>.script.txt --into <id> --notes <their notes file>   # made again
python tools/writers/room.py show <id>                                      # the chart as text, its problems
```

- The report prints every line's role; a `!` under a line is something it couldn't read. Fix the script and import
  again (`--into`) until there are none, and the chart has no problems (`show` lists them).
- Read `show` against their notes: every part there, in order; each branch, secret and ending where they meant it.
- `--notes` keeps their own notes beside the chart (`Content/Prototypes/<id>/notes.txt`); pasted notes: write them to
  `Saved/Writers/<name>.notes.txt` first.

## 4. Hand it over

- The page: `python tools/writers/serve.py`, then `http://127.0.0.1:8795/?s=<id>`. A page already open takes the new
  chart in by itself (a click on a shape shows its script in the inspector).
- Tell them in a few lines: the session, what the parts became, the choices and endings and what decides them, what
  you decided for them (the sticky notes), and your questions. Don't paste the script.
- Then stop: `/build-game` once they say it looks good.

## Changing it later

- They changed the chart on the page: `python tools/writers/room.py script <id>` prints it as a script as it is now,
  their changes in. Change that, and import it `--into <id>`: what they moved stays where they put it.
- They changed their notes: compare with `Content/Prototypes/<id>/notes.txt`, change the script from `room.py script
  <id>` (so their changes on the page stay), import it `--into <id>` with the new `--notes`.

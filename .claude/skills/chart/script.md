# The chart's script (Claude's, from the user's notes)

The user writes the game any way they like, in a notepad (DECISIONS 2026-10-27, later: "I should just be able to
write the game out anyway I want in notepad ... and then we will use Claude to convert it into a writer block game").
Claude writes their notes out as this script (`/chart`, SKILL.md beside this), and `python tools/writers/room.py
import` makes it the writers' room's chart (docs/WRITERS_ROOM.md §9): every part its shapes, every choice its arrows,
every thing you touch a block of its size. `/build-game` takes the chart into the director. **Things are names, not
assets**: a "kettle" is a small block called kettle until the Database puts the real one in, in its real place.

The script grew out of the user's own way of writing (their first example reads as they wrote it: `room.py check`), so
the marks they use most likely map straight onto it; docs/NOTES.md is the short list suggested to them.

## 1. An example

```
Title: Come Over
Starts: night
Ji (she): my oldest friend, back after ten years
@ Apartment: my flat, small and too warm

( Opening )

Internal monologue
"Ji should be arriving soon, I should probably clean up the apartment"

Hidden Timed Task (2 min) - Clean up

*knock, knock*

"That must be her"

*open door*

She is standing, she smiles and leans in for a hug, she pulls back

*Enter Name*

Ji: "X! It's been so long, I barely recognise you."

[ Greet +1 ] She's probably cold, I should let her inside --- [ Question ] Is this what she looked like.

[ Greet ]
Ji: (her face softens, she looks down and smiles) "You haven't changed at all."

[ Question ]
Ji: (her smile stays but her eyes go still) "...Is something wrong?"
"Her voice is right. Her face is almost right."

( Tea )
...
( Ending: Morning ) if karma 2+
...
( Ending: The Door ) otherwise
...
```

## 2. The sheet

**Parts of the story**

| Write | It becomes |
|---|---|
| `( Opening )` | a part of the story: its shapes on the chart, in a frame with its title when it makes more than one |
| `( Ending: The Door )` | an ending. `True ending:`, `Good ending:` or `Main ending:` is the intended one; `Ending:`, `Bad ending:` and the rest are the others. Three by default |
| `( Secret: The Other Photo )` | a secret: found after the part before it (`Find:` says how), then the story picks up at the next part |
| `( Chapter: Night 2 · 23:40 )` | a chapter card: the night ends, the title over the dark, the time under it, and the time of day after it (23:40 is night) |
| `( Dinner ) if [ Question ]` | a part only some players get: those who answered Question (the nearest answer with that name before it) |
| `( Morning ) if karma 2+` · `if karma -2 or less` | by karma, what the answers added up to |
| `( Run ) if *run to the door*` | by what the player does there and then (a choice by doing) |
| `( The Long Way ) otherwise` | everyone else. Parts with conditions next to each other are the ways of one choice; after them everyone carries on. Answers and karma can mix (an answer first, then karma for the rest: a choice for each, in the order they come); what you do can't mix with either |
| `@ Kitchen` | from here on it happens in the kitchen (each place is a grey room, joined in a row) |

**Words**

| Write | It becomes |
|---|---|
| `"Words"` | your own thought (the inner monologue). `Internal monologue` on the line before is fine, and changes nothing |
| `Ji: "Words"` | Ji says it |
| `Ji: (she looks away) "Words"` | with what her face does (a face for MiniMax: what you can see, no words) |
| `You: "Words"` | you say it out loud (the player is mostly silent: your answers are acts, below) |
| `X` in a line | your name, once you've typed it (`*Enter Name*`) |
| a plain line | what happens, as you'd see it: "She is standing, she smiles and leans in for a hug" |

**Things you do** (between stars: the game waits until you do it; in play every one is a click on the thing)

| Write | In the game |
|---|---|
| `*open door*` · `*close the door*` | the door opens or closes |
| `*pick up the key*` · `*take the phone*` | it goes into your inventory (the row E shows) |
| `*put down the box*` · `*put the box on the shelf*` · `*give the cup to Ji*` | you put down (or hand over) what you have |
| `*read the letter*` | a note to read; the plain lines right after it are what it says |
| `*look at the photo*` · `*check the window*` | you look at it; the plain lines right after it are what you see |
| `*sit on the sofa*` · `*sit down*` | you sit (and stand up again) |
| `*sleep*` · `*go to bed*` | you lie down in the bed, the view goes dark (a chapter card after it) |
| `*hide in the closet*` | you get in (and out) |
| `*turn on the light*` · `*switch off the lamp*` | a switch |
| `*go to the kitchen*` | walking into that place |
| `*wash the dishes*` · `*turn on the kettle*` · anything else | using that thing (a stand-in until it's built) |

**What happens round you** (between stars too)

| Write | It becomes |
|---|---|
| `*knock, knock*` · `*phone rings*` · `*glass breaks*` | a sound: the nearest one on the sound shelf |
| `*lights flicker*` · `*lights go out*` · `*lights come back*` | the room's light |
| `*music: dread*` | the music: silence, calm, uneasy, dread, chase |
| `*fade to black*` | a moment passes |
| `*Ji sits on the sofa*` · `*she walks in*` | what someone else does (starts with a name, she, he or they) |
| `*Enter Name*` | you type your name |
| `*wait 3s*` · `*pause*` | a pause |
| `*save*` | an autosave |

**Things** (any name after a verb is a thing; the same name is the same thing)

| Size | What it is |
|---|---|
| small | in one hand: picked up (a key, a phone, a cup, a letter) |
| medium | both hands: picked up and carried (a box, a bag, a bucket, a chair) |
| large | stays where it is: used there (a table, a bed, a fridge, a closet) |

Guessed from the word; to be sure, put it after the thing: `*pick up the box (large)*`, or `(s)`, `(m)`, `(l)`.

**Tasks**

| Write | It becomes |
|---|---|
| `Task - Clean up` | on your list; what's written after it waits until it's done |
| `Timed task (3 min) - Clean up` | what's after it comes when the time is up, done or not (not done: failed) |
| `Hidden timed task (2 min) - Clean up` | the same, but not on the list: you only know from your thoughts |
| `Request from Ji - Make tea` | she asks: her name beside it on the list |
| `Task - Wash the dishes` | a task that's a thing to do is done by doing it (using the dishes) |

Tasks one after another make one list, done in any order.

**The player's answers**

| Write | It becomes |
|---|---|
| `[ Greet ] She's probably cold, I should let her inside --- [ Question ] Is this what she looked like.` | two or three answers: the act in brackets, your thought after it (each on its own line works too) |
| `[ Greet +1 ]` · `[ Question -1 ]` | karma, -3 to 3 (none is 0) |
| `[ Greet ]` alone on a line | what happens after that answer: up to the next `[ Answer ]`, `[ Either way ]` or the next part. Her first line there is her reply, her face first |
| `[ Either way ]` | everyone again, whatever they answered |
| `[ *open the door* ] It's just Ji --- [ *hide in the closet* ] Not again` | a choice by doing: you go and do one |

**The rest**

| Write | It becomes |
|---|---|
| `Find: *look behind the mirror*` | in a secret: how it's found |
| `Achievement: Turned Away - Some photos hide a second one` | an achievement (in a secret or an ending: theirs; anywhere else: unlocked there) |
| `Note: I guessed this happens in the kitchen` | a sticky note on the chart: what you decided for the user, or a question for them |
| `// anything` | ignored |

At the top, before the first part (all optional): `Title:`, `Starts: night` (day, dusk, night), `Name: Alex` (your
name until you type one), `Player:` (who you are), `Kind:`, `Logline:`, `Tone:`, `References:`, a line per person
(`Ji (she): who she is`), a line per place (`@ Apartment: what it's like`).

**Copied from the user's notes as it is, it still reads:** curly quotes, a dash turned into a long dash (`—`), `...`
turned into `…`, a bullet at a line's start, capitals anywhere, extra spaces and blank lines.

## 3. What the import does with it

`Content/Python/storykit/chartscript.py` reads a script into the prototype (format 3, docs/WRITERS_ROOM.md §7):

- **A part becomes its shapes**, cut where it changes between playing and watching: what you do (`*verbs*`, tasks,
  waits) is a **task** shape, what someone says or does is a **scene**; a scene that ends in your answers is a
  **talk**, its question the last line someone said before them. Thoughts, sounds and lights stay in whichever they're
  in. A part's first shape takes its title, the next ones "Title · what"; `@ Place` starts a new shape there.
- Each shape keeps what was written as its **steps**, in order (`say`, `you`, `think`, `see`, `cast`, `sound`,
  `light`, `music`, `fade`, `act`, `todo`, `name`, `wait`, `save`, `feat`).
- **Answers:** a talk's options (`say` the act, `think` the thought, `karma`); a block after an answer gives the option
  her reply (`then`, its face) from its first line by her, and anything more becomes shapes of their own after a
  choice by that answer, joining again after the blocks.
- **Conditions:** parts with `if` next to each other make one choice shape (by an answer, by karma or by doing); with
  no `otherwise`, the rest go on to the next part. Answers and karma mixed make a choice for each (an answer first, its
  rest on to the one by karma).
- **Things** (the prototype's `items`: id, name, size, the place it's first used in, its kind: door, pickup, carry,
  note, inspect, seat, bed, hideout, switch) from every `*verb thing*`, task and find.
- **The layout:** columns along the story wrapped into rows like lines of text (a part's shapes kept in one row), the
  ways of a choice in lanes under it, secrets above, endings stacked.
- **Read into a session again** (`--into`), a shape keeps its id and its place: by its id, then (a shape drawn on the
  page) by its type and title, then by the arrow that reaches it; a choice keeps its title and question.
- A **report** line by line: what each line became, and what it couldn't read.
- `chartscript.write(P)` is the other way, the chart as a script (`room.py script ID`): what was drawn on the page reads
  back as the same story.

Build (docs/WRITERS_ROOM.md §5, `/build-game`) turns steps into the director's words: a task's steps into one stitch, a new beat after
each thing you do (`{"use": door}`, `{"pickup": key}`, `{"read": letter}`, `{"hidden": closet}`, `{"enter": kitchen}`,
the list through: `{"ticked": true}`); a scene's into clips (thoughts as `think` clips, plain lines as each clip's
`act`, sounds and lights as cues on its clips' edges), cut into scene, stitch, scene where it stops for you (your name,
a thing to do); things as blocks of their size with their use (a small one on a stand), doors in the room's wall;
sounds off the shelf by their words.

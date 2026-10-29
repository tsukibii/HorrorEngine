# TestRoom001: the lab

A test game, not a story (DECISIONS 2026-10-28, back): a lab whose rooms each test one thing the format has, so the
desk and an Unreal build can be held to the same checklist. Every station is a task (a stitch) whose **to-do list is
its checklist**: each task ticks by itself when the thing it names happens (`ticks`), and the station ends when its
list is through. Play it in the desk's Play mode (Watch, **walk the tasks**) and read the list as you go; a task that
won't tick is the bug. `node tools/director/testroom.mjs` (TESTROOM) plays it through the same way, start to end.

It's built from `Content/Games/TestRoom001/story.json` like any game: `python tools/story.py --game TestRoom001 flow`
for the order, `show <id>` for a station. Different from the Pilot on purpose: its own building, its own cast (Aoi, a
tester), two levels.

## The building

**Level `lab`:** a yard (dirt, outdoors) to the south; the lobby (tile) through the front door (a peephole, a latch, a
creak); north of it a corridor (wood, 30 m) with six rooms on each side and an atrium (stone, 4 m high) at the far
end. West, south to north: keys (with a locked closet), store (with a vault behind a keypad), rest, games, library,
bath (water). East: power, kitchen, chores (with a back door onto a back yard), dark, workshop (metal), court (outdoors,
through an archway). The lobby's trim (skirting, cornice, casings, thresholds) is the level's. **Level `annex`:** a
hall (metal, dark), a room (carpet) and outside.

## The stations

| # | Node | Where | What it tests (the format's words) | Its checklist |
|---|---|---|---|---|
| 1 | `n_arrive` | yard, lobby | walking, running (Shift), crouching (C), footsteps by floor (dirt, tile), a door opened by a click, `enter` a room, `fade`, `music`, `objective`, `after`, the puddle under the yard's lamp throwing its light up the wall (a `pattern` light: caustics, `aim`ed at the wall), a reflection probe in every room | Open the front door · Walk into the lobby |
| – | `n_hello` | lobby (its windows throw light `shaft`s into the haze; a car `sweep`s past the first every half minute, 2.5 m out: inside the yard) | a scene: her name a word (`{guide}`: "the guide" till the scene sets `met_aoi`, then "Aoi"; `game.words`, STORY_FORMAT §9.14), `stage`, `view`, soft camera, a `look` and a `tracker`, seams (`blink`, `glance`), a reply with its thoughts and karma (`sets`) as a conversation card (three answers: Ready's reply two lines and `go` past the line for Not great, Say nothing's `end`; STORY_FORMAT §9.9), a body track (a `behave` cue: from her second line Aoi walks to the bench and sits there till the shot ends; §3.8), the player's thought (`think`) typing itself out and retyped (`retype`: Easy. becomes Fine.; §9.15), cues on clip edges (a sound, a light flicker, a `state`: the kitchen's TV to static), a face row (`faces`: an expression, then a loop of its held part to the end), `sets` | (watched) |
| 2 | `n_front` | lobby | `behave idle` (Aoi outside), the `knock` trick, the peephole (`peeping`), the latch (`locked`), a line said (`say`) | Look through the peephole · Shut the door and lock it |
| 3 | `n_doors` | keys, closet, store, vault | a sliding door, a door `locked_by` an item (the brass key), `pickup`, a `note` read, a `combo` keypad setting a flag that unlocks a `locked_by: flag:` door, `slam_behind`, `exit` | Find the brass key · Open the closet · Read the vault code · Open the vault · Take the fuse |
| 4 | `n_power` | power | `power` off (every bulb and lamp dark, the candle burning on, the switch dead), a breaker (`power: on`), a `switch` and its `light`, a candle's life (blow it out), `light` flicker, a light's flicker `mode` (the lamp a dying tube; the corridor's second lamp a fluorescent), `all` | Throw the breaker · Switch the light on · Blow out the candle |
| 5 | `n_store` | store | `lights_die`, three pickups in the inventory's row (E, the wheel), `carry` (a box) put down with G in a trigger (`dropped` `in`), a plushie (`carrying`) | Take tin A, B, C · Carry the box to the shelf · Pick up the plushie |
| 6 | `n_kitchen` | kitchen | the little things' lives (a kettle boils by itself, a cup poured from it, a cigarette put out, a TV turned off, a hob heating a pot, a phone made to ring and answered), a request (`todo` with `who`, `behave go` to a chair, `arrived`) | Put the kettle on (Aoi) · Pour a cup · Put the cigarette out · Turn the TV off · Turn the hob on · Answer the phone |
| 7 | `n_chores` | chores | `clean` with a mop (and without one), a feat flag (an achievement), a door's `latch` | Take the mop · Mop up the mud · Scrub the blood · Lock the back door |
| 8 | `n_rest` | rest | `whisper`, `sit` (a chair), a triggered `scene` (the sofa), `name` typed and `{name}` said, a task ticked by its beat once the name's said (`tick`) | Sit on the chair · Sit on the sofa |
| 9 | `n_games` | games | `roll` (a die, its face heard: `rolled`; a six is an achievement), a board `game` (chō-han with Aoi: `played`, `result`), `ask` (answered, karma) | Roll the die · Play chō-han · Answer Aoi |
| 10 | `n_dark` | dark | a room with its light off, the flashlight (`torch` item, F, `torch` on, `flicker`, `dead`, `works`), `show` (batteries), a `glimpse` led by a sound, `if` | Find the flashlight · Switch it on · Find the batteries · Get out |
| 11 | `n_library` | library | `note`, examining a small `inspect` thing in the hands (the photo turned over), a big one's card (the bookshelf), `look` (the painting two seconds), a **secret** (`secret` beats, `show`), an **interrupt** (taking the doll: `n_doll`, its scene, a bad ending) | Read the diary · Turn the photo over · Look at the bookshelf · Look at the painting |
| 12 | `n_bath` | bath | footsteps on water, a tap's life, a `locker` (`hidden`), the look-away `swap`, a task ticked by its beat (`tick`: the station ends with you in the locker, the next scene taking the eye from there) | Turn the tap on · Hide in the locker |
| – | `n_talk` | workshop | a scene with `variants` (`pick`), a timed choice with karma (`event: choose`), `enter` fade, a cam `push`, bodies (`block`, Kimodo `segments`, tiers, `hero`), cues (`music`, `light` dim), `sets` an objective | (watched) |
| 14 | `n_hide` | workshop | a gameplay round (`play: hide`: its seeker, loops, barks, spots), a result choice; found: the death scene picked by where (`pick_by: found_at`, a `reach` for the player), `count`, a **death** with `retry` and the branch map | (the round's card: hidden or found) |
| 15 | `n_run` | corridor | a timed task (`timer`, its `fail` a death), `music` chase | Get to the atrium |
| 16 | `n_sneak` | atrium | `behave path` on a route (`pingpong`, waits, poses, a locker it `check`s), `sees` (the meter, `caught`), a safe zone, a task that `fails`, a `jumpscare` led by a sound | Reach the far corner unseen |
| 17 | `n_sleep` | rest | `sleep` in a bed with an `if` (the chores done), a `chapter` card that changes the time to night, a `state` (the lobby clock stops), `checkpoint` | Sleep in the bed |
| – | `n_night` | rest | a scene at night (`time`), `enter` dip, an hour and a half skipped (`skip`: the kitchen clock's hands jump on); by what's happened (§9.14): a line kept by the chores done and one left out, an answer offered by the painting found and one not (the chores), Aoi's face by the painting | (watched) |
| 18 | `n_annex` | annex | a memory flicker (a thought that `breaks` off, §9.15), another level, `power` off there, `checkpoint`, `use_on` (the fuse into the fusebox), a note | Put the fuse in · Read the note |
| – | `n_final` | annex | a choice by act (leave by the door, or sit with Aoi: `e_stay`), a flag choice (the secret's scene, `n_egg`, blending back), a karma choice: Passed (karma 2 or more), Failed (-2 or less), Inconclusive | (the ending) |

Endings: Passed (its title card's words, with the name typed: §9.14), Inconclusive, Failed (karma), Stayed (an act), She
wanted her back (the doll), Found and Too slow (deaths with retries). Achievements: one per ending, the secret, the clean feat, a six.

## What the desk doesn't do yet (and the room still has)

- `stalker`, `shot`, `seq`, `anim`, `move`, `loop_hall`, `cut_away`: not in TestRoom001 (Play says "not in Play yet"
  for them; `behave` is Play's word for the cast in play).
- The `play` rounds are cards with buttons on the desk ("did you manage to hide?"); in Unreal each is a template
  Blueprint (RUNNER_SPEC.md).

## Playing it

On the desk: open TestRoom001, Watch, tick **walk the tasks**, Start. The objective names the station; the list under
it is what to do. **Simple** (the toolbar) draws only the rooms you can see, for a slow machine. Any station can be
started on its own from the board ("Watch from here with a state…"), giving it what the stations before it leave
(the brass key, the fuse, chores_done: TESTROOM's `LEAVES`).

TESTROOM: `node tools/director/testroom.mjs [--from n_station]` with the desk's server running. It writes the desk's
reference for an Unreal build to `Saved/Story/TestRoom001/reference/` (the state after each station, a picture of
each): docs/UNREAL_NEXT.md says how it's used.

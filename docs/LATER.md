# Later: things that would pay off down the road

Suggestions, not decisions (2026-10-24, the experiments branch). Each says what it saves. The user picks; DECISIONS.md
records what's chosen.

## Making a game faster

- **A "what's missing" board in the desk.** Per game: clips without a take, takes without a face, segments without a
  Kimodo file, cast without a person, props without art, rooms without a look, shots that fail review. One page that says
  what's left before the game is playable undressed, each line a click to the place to fix it. Saves hunting.
- **Take intake from MiniMax's downloads.** Point it at the downloads folder; it matches each file to the clip whose
  prompt made it (the prompt is already generated per clip), renames it to the take id, trims it and solves its face.
  Saves the most tedious step of every game.
- **Subtitles timed from the takes.** The Japanese line and its English timed to the voice's own pauses (the dead-air
  measure already exists), so subtitles never run ahead of a speaker.
- **Placeholder voices that keep the timing honest.** The browser's TTS stands in today; a local Japanese TTS
  (VOICEVOX is free and local) gives clip lengths close to the real takes before MiniMax is run.

## Keeping it working while things change quickly

- **Picture snapshots.** The checks already render (contact sheets); keep one per check and compare the next run's
  pixels to it (a small difference score). A change that silently breaks the eyes, the hair or a shot shows up as a
  red number, not weeks later.
- **One command for every check that needs a browser.** STUDIO, SALON, TAILOR, BUILDER, PLAY, FACEPAGE: start the two
  servers, run them in turn (never at once), stop the servers, print one line each. Today each is run by hand.
- **PLAY on the game's clock everywhere.** Its newest version waits on the game's clock in most steps; the rest of its
  wall-clock waits make it fail on slow machines (the cloud runs it in software).

## Characters

- **The shell normals for the salon's bake** (docs/research/hair_cards_unreal.md §1): the biggest single improvement
  to how the hair reads, in Unreal and in the preview, and a bake-time change only.
- **One character file the desk, the salon and Unreal all read**: the Studio's `character.json`, `body.bin`,
  `salon.glb` and the clothes export, with a receipt (what made each and when), so a character is never half-updated
  in one tool.
- **LODs for faraway characters**: MHR's LOD 2 to 4 for figures more than a few metres away (the clothes and hair
  simplified with them); the games are first person, so most of the cast is far most of the time.
- **Five more lash styles after the user's second reference** (docs/research/lash_reference.md, 2026-10-26, night):
  sparse thin lashes for men and older faces (with a greying look), a glam volume set with a smoky plum makeup, a fluffy
  mink set, a doll volume set with a lower liner, a natural medium set with a tinted waterline. Needs a painted liner on
  the lower lid and brown and grey lash looks. Saves making them by hand per character.

## Unreal

- **A round-trip check**: Generate, play the preview in the editor, capture the same frames as the desk's Watch and
  compare them. Proves "what the desk shows is what Unreal plays" with numbers.
- **Budgets per game**: triangles, materials, lights, texture memory, the time a frame takes on the 3090, written down
  per scene and checked by Generate, so a horror game's dark corners don't hide a slow frame.
- **The look last, per game**: UltraVHS and LightKit are ready to enable; a per-game `look` block (VHS preset, day or
  night, grade) that Generate applies keeps it text, like everything else.

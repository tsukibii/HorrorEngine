The starter scripts of the by-hand guides (guides/first_game, guides/tutorial_v2): copied into a Godot project as
res://starter/ by tools/godot_byhand.py. Yours to change.

  player.tscn, player.gd   the player: WASD, Shift runs, the mouse looks, E uses (or puts a note away), F the
                           flashlight, Esc frees the mouse; it steps up a tread or a kerb; stops when the Story ends;
                           its footsteps a stride walked, the floor's own (footsteps.gd, the Sound node)
  flashlight.gd            the player's flashlight (on its Eye/Flashlight): batteries that run down, a bulb's or an
                           LED's curve, low and dead, spare sets going in by themselves; beam_on(point), weighed by
                           its cookie; its AirBeam child (the Look plugin's HSBeam) draws the beam in the air (an
                           HSAtmosphere sets how thick the air is) and gives the light a flashlight's cookie
  interior.gd              on an interior's instance: stood at a street's marker, its doors opened with E, its lamps,
                           its windows' glass letting light through (no shadow from it);
                           room_box(room) and fit_area(area, room): an area the size of one of its rooms
  door.gd                  a door from an interior's export swinging on its hinge (interior.gd puts it on every door);
                           locked by an item or a fact (the scene builder's lock comes with the export)
  story.gd                 the Story node: the objective, the to-do list, lines, a note's card, the pocket, facts,
                           the ending
  sound.gd                 the Sound node: the music by mood (music/), a room's tone, the hush before a scare; and
                           the sound physics (Woohill's): every sound it plays (play, step, shaped) traced through the
                           rooms, muffled through walls and doors, the room's reverb as rendered tails (sfx/_tails),
                           an echo; the buses World, SFX, Foley, Events, Tone, Verb, Echo, Muffled, Music, Body
  acoustics.gd, .json      the sound physics' tracer (rays for occlusion and reflections) and its table: what each
                           material reflects and muffles, the reverb's four lengths, a floor's footsteps
  footsteps.gd             a step every stride walked (Woohill's)
  fear.gd                  the Fear node: how afraid you are (her near, a scare), a heartbeat, breathing, the world
                           dulled, a vignette, the flashlight's beam shaking; each its own switch; ring() after a bang
  behind_you.gd            the steps behind you: yours answered a beat later from behind, one step too many when you
                           stop; start() from a signal, or by itself now and then while you're afraid
  room_tone.gd             an Area3D: a room's tone while the player's in it
  event_area.gd            an Area3D: walked into, an objective, tasks added or ticked, a line, a fact, the music, the
                           air's fog rolled to a level (the scene's HSAtmosphere), the end
  scare_area.gd            an Area3D: walked into (or fire() from a signal), the lights go out, dim, flicker or go out
                           one by one, for good or for a while; someone appears (for a moment: a jump scare); a sting;
                           a hush first; the fog rolled in; the tape breaking up for a moment (the scene's HSTape)
  pickup.gd                a thing picked up with E into the Story's pocket (batteries: a spare set)
  note.gd                  a thing read with E: its words on the Story's card
  light_shy.gd             under a character: she backs off, freezes, vanishes or comes when the flashlight holds her;
                           lit, flashed, flashed_twice to wire anything to
  presence.gd              under a character: the signs that she's near, the lights by her and your flashlight dipping
                           (under the flash limit), static rising on a radio, a false alarm now and then; warn()
  glimpse.gd               a figure at the corner of your eye: there only 30 to 42 degrees off where you look, gone as
                           you turn to it (in a lamp's blink), silent, once; arm() from a signal
  closer.gd                a figure that moves only while it's unseen, mark by mark toward you, then right behind you;
                           caught when you turn round, gone in a blink; arm() from a signal
  arms_down.gd             under a Character Studio character: its arms down by its sides
  lights.gd, reach.gd      helpers the others use: lights switched, dimmed, flickered and blinked as the Look plugin
                           keeps them, a collider round a thing you use

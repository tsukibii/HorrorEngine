The starter scripts of the by-hand guides (guides/first_game, guides/tutorial_v2): copied into a Godot project as
res://starter/ by tools/godot_byhand.py. Yours to change.

  player.tscn, player.gd   the player: WASD, Shift runs, the mouse looks, E uses (or puts a note away), F the
                           flashlight, Esc frees the mouse; it steps up a tread or a kerb; stops when the Story ends;
                           its footsteps a stride walked, the floor's own (footsteps.gd, the Sound node); its eye never
                           draws render layer 19 (what's only in mirrors); a seat sits it down, lays it down or
                           hides it; doing(): standing, walking, running, sitting, lying or hiding; Space holds your
                           breath (8 s at most, then a gasp); its steps, a run and a gasp are noises (noise.gd)
  flashlight.gd            the player's flashlight (on its Eye/Flashlight): batteries that run down, a bulb's or an
                           LED's curve, low and dead, spare sets going in by themselves; beam_on(point), weighed by
                           its cookie; its AirBeam child (the Look plugin's HSBeam) draws the beam in the air (an
                           HSAtmosphere sets how thick the air is) and gives the light a flashlight's cookie
  interior.gd              on an interior's instance: stood at a street's marker, its doors opened with E, its lamps,
                           its windows' glass and its kit lamps' shades letting light through (no shadow from them);
                           room_box(room) and fit_area(area, room): an area the size of one of its rooms
  door.gd                  a door from an interior's export swinging on its hinge (interior.gd puts it on every door);
                           locked by an item or a fact (the scene builder's lock comes with the export)
  story.gd                 the Story node: the objective, the to-do list, lines, a note's card, the pocket, facts,
                           the ending; holds(): what `needs` says (task:x done, on:x on the list and not done yet,
                           item:x, a fact, ! for not)
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
  cue.gd                   a cue: something that happens when everything you set is so. Where you look (the event's
                           spot in the middle, a side, a corner or the edge of your view, with a tolerance; in view,
                           out of view), what the story says (needs: on:x for a task you're on), what you're doing
                           (sitting, lying in bed, walking...), the flashlight, how near, for how long, a chance;
                           then someone there for a moment with a sound and an animation, gone in a blink (a jump
                           scare), and/or a line, a task, a fact, the music, a target's fire()
  seat.gd                  somewhere to sit, lie down or hide: E there and back up; its box on collision layer 2,
                           which only E's aim finds (your body, the sound and sight pass through it)
  noise.gd                 a noise: Noises.make(tree, where, how loud); your steps, a run, a door, a gasp make one,
                           and everything listening (the group hs_listener) hears it as far as its ears reach
  searcher.gd              under a copy of her: hunting by ear once armed; heard, she listens, comes for the places
                           to hide nearest the noise and stands at one breathing (the close pass); held breath halves
                           her chance of finding you, a light on makes it certain; found, she pulls you out; then
                           back to her post; seen in the open while she looks (or a chase); a number of
                           searches, or stop()
  chase.gd                 under a copy of her: after you at about your run speed, along the way she saw you go
                           (no navigation mesh); a door you shut holds her 2 s; 6 s out of her sight and she's lost
                           you (her searcher searches there); caught, a fright; safe rooms she won't follow you into;
                           20 to 40 s at most; the chase mood, then the hush; start() from a signal, or a searcher's
  steam_mirror.gd          writing in the steam: a mirror (the Look plugin's HSMirrorSurface) fogs over from the
                           bottom, the words a finger left on it showing as it comes; it holds, then clears; fire()
                           from a cue or a signal
  cold_area.gd             an Area3D where it's freezing: your breath shows (the Look plugin's HSBreath at your eye,
                           seen only where a light reaches it) and its window panes frost up from the bottom edge
                           while you watch; out again, the breath stops and the frost thaws
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
  mirror_figure.gd         a figure only in the mirror (layer 19: gone when you turn round to her), or there and
                           missing from it (layer 20); arm() from a signal
  shadow_pass.gd           a shadow that isn't yours: a figure that only casts a shadow crossing behind you when a
                           lamp's behind you and a wall ahead; arm() from a signal
  door_feet.gd             the light under a door and someone's feet walking into it, standing, walking away; it sits
                           itself under its door; arm() from a signal
  uncanny.gd               under a character: one thing wrong; her blink off, a smile with no eyes in it (MHR's
                           shapes), her head bent too far, her steps copying yours
  dread.gd                 the night's director: its intensity from the scares, small moments between the story's
                           beats while it builds, a peak held, then quiet; safe rooms; gentle, normal, relentless
  dread_moment.gd          a small moment where it stands (a sound off the shelf, a target's fire()): its tier,
                           weight, cooldown, distance and where (behind you, in view, out of sight)
  menace.gd                under her: a gauge filling while you're near her and see her; full, she withdraws a
                           while and the director relaxes
  arms_down.gd             under a Character Studio character: its arms down by its sides
  lights.gd, reach.gd      helpers the others use: lights switched, dimmed, flickered and blinked as the Look plugin
                           keeps them, a collider round a thing you use

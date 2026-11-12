The starter scripts of the by-hand guides (guides/first_game, guides/tutorial_v2): copied into a Godot project as
res://starter/ by tools/godot_byhand.py. Yours to change.

  player.tscn, player.gd   the player: WASD, Shift runs, the mouse looks, E uses (or puts a note away), F the
                           flashlight, Esc frees the mouse; it steps up a tread or a kerb; stops when the Story ends;
                           its footsteps a stride walked, the floor's own (footsteps.gd, the Sound node); its eye never
                           draws render layer 19 (what's only in mirrors); a seat sits it down, lays it down or
                           hides it, the eye easing there over settle_secs and turning only as far as a head does; doing(): standing, walking, running, sitting, lying or hiding; Space holds your
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
                           item:x, a fact, ! for not); the pocket counts and knows each thing's name and model
                           (give(id, name, model, count), count_of, take), shown as an HSHud's inventory row when the
                           scene has one (Tab, the wheel); the player's cash (pay, earn: the laptop's shop);
                           eating: a pocket thing made eatable (set_eatable(item, restores, secs): food.gd, a shop
                           item marked Eatable, a Sanity node's foods) is eaten by holding the left button with it
                           in the hand, a meter filling over its seconds (2), then it's gone; not with a gun up
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
                           air's fog rolled to a level (the scene's HSAtmosphere), a character's look (look_of:
                           her or her HSLookSwitch; her_look: a look's name, or default: other eyes, another skin,
                           the cloak; the cue has the same two), the end
  scare_area.gd            an Area3D: walked into (or fire() from a signal), the lights go out, dim, flicker or go out
                           one by one, for good or for a while; someone appears (for a moment: a jump scare); a sting;
                           a hush first; the fog rolled in; the tape breaking up for a moment (the scene's HSTape)
  cue.gd                   a cue: something that happens when everything you set is so. Where you look (the event's
                           spot in the middle, a side, a corner or the edge of your view, with a tolerance; in view,
                           out of view), what the story says (needs: on:x for a task you're on), what you're doing
                           (sitting, lying in bed, walking...), the flashlight, how near, for how long, a chance;
                           then someone there for a moment with a sound and an animation, gone in a blink (a jump
                           scare), and/or a line, a task, a fact, the music, a target's fire()
                           (head_m: her head over her feet, 1.5 m; set it for a child or a creature)
  seat.gd                  somewhere to sit, lie down or hide: E there and back up. It works out where your eye
                           goes from the furniture: its own meshes, the model it's dropped onto, or what's under it
                           (an interior's bed or chair). Lying: the middle of the bed, 0.30 m in from its head end
                           (the headboard's), 0.22 m over where you lie, a head on a large pillow. Sitting: a seated
                           eye over the seat, facing away from its back. View: seat_height (a stool), view_offset,
                           view_turn_deg, flip, fit off (the eye where the node is). An interior's bed, solid as
                           one box to its headboard, gets a truer solid so you can lie low on it. In the editor an
                           orange camera shows the eye. Its box is on collision layer 2, which only E's aim finds
  seat_bed.tscn, seat_chair.tscn, seat_stool.tscn
                           a seat ready to drag onto a bed, a chair or a stool in the Scene tree
  noise.gd                 a noise: Noises.make(tree, where, how loud); your steps, a run, a door, a gasp make one,
                           and everything listening (the group hs_listener) hears it as far as its ears reach
  searcher.gd              under a copy of her: hunting by ear once armed; heard, she listens, comes for the places
                           to hide nearest the noise and stands at one breathing (the close pass); held breath halves
                           her chance of finding you, a light on makes it certain; found, she pulls you out; then
                           back to her post; seen in the open while she looks (or a chase); a number of
                           searches, or stop()
                           (head_m: her head over her feet, 1.5 m; set it for a child or a creature)
  chase.gd                 under a copy of her: after you at about your run speed, along the way she saw you go
                           (no navigation mesh); a door you shut holds her 2 s; 6 s out of her sight and she's lost
                           you (her searcher searches there); caught, a fright; safe rooms she won't follow you into;
                           20 to 40 s at most; the chase mood, then the hush; start() from a signal, or a searcher's
                           (head_m: her head over her feet, 1.5 m; set it for a child or a creature)
  steam_mirror.gd          writing in the steam: a mirror (the Look plugin's HSMirrorSurface) fogs over from the
                           bottom, the words a finger left on it showing as it comes; it holds, then clears; fire()
                           from a cue or a signal
  cold_area.gd             an Area3D where it's freezing: your breath shows (the Look plugin's HSBreath at your eye,
                           seen only where a light reaches it) and its window panes frost up from the bottom edge
                           while you watch; out again, the breath stops and the frost thaws
  pickup.gd                a thing picked up with E into the Story's pocket with a copy of its model (batteries: a
                           spare set); `cash`: money, the Story's cash goes up by it
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
                           (head_m: her head over her feet, 1.5 m; set it for a child or a creature)
  hunt.gd                  being hunted, as a hidden quest: pick the hunter and its kind (haunting: she never touches
                           you; stalking: caught is a fright; lethal: caught, you die and come back at the
                           checkpoint); what starts it (needs, or fire()) and ends it (a time, a task, a safe room,
                           her shot down); stages; she rushes only by the rules you tick (in the dark, you ran...)
                           after a tell; the facts hunt:<name> and hunt:<name>:<stage>
  hunt_spot.gd             a Marker3D where a hunt can have her do something: watch, dart (run across ahead of you
                           to another marker), peek, wait, ambush (in its box), follow, pass (cloaked), door, decoy,
                           custom; each by its own rule of what you can see; her move or animation there
  moves.gd                 under a character: a clip for each thing she does (idle, walk, run, stalk, watch, peek,
                           lunge...): a Kimodo .npz from res://animations/ put onto her own skeleton when the game
                           starts, an animation file, or one her model has by name; played by how fast she goes
  checkpoint.gd            an area: the Story keeps where you are and what you've done; dying puts you back there
  sanity.gd                a sanity meter: worn down by the dark, her near, a hunt, every scare; mended by sitting,
                           lying down, eating and sleep (lie on a bed); what stops sleep (a task on the list, a
                           hunt, a script); the facts sanity:uneasy, sanity:shaken, sanity:breaking for anything's
                           Needs; hunts and the night's director go faster as it falls (their sanity_sync)
  food.gd                  something to eat or drink: E takes it into the pocket as eatable (restores, eat_secs,
                           count); then hold the left button to eat it (story.gd)
  flicker_lit.gd           under her: the light that's turned on her flickers (a lamp whose light reaches her, your
                           flashlight when its beam is on her); never the moon, a light in the group hs_ambient or
                           one in `ignore`; flicker (three dips a second at most), dim, or die (out after a while,
                           and out a while longer once it's off her); `enabled` the switch
  shown.gd                 on a thing (or a child of it): it's there, or it isn't. `shown` is how it starts; it comes
                           and goes by fire() (an area's, a cue's or a moment's Target: toggle, show or hide), by the
                           Story's words (Shown When "task:key", "on:key", a flag; Hidden When), or appear() and
                           vanish(); when_unseen: only while you can't see it; also (more things with it), swap_with
                           (things there only while it isn't: the table laid another way), fade_secs. Nothing is
                           deleted: hidden, its own colliders off with it
  flag_switch.gd           a node that switches flags: "+name" on, "-name" off, "~name" flipped; by fire(), or by
                           itself when the Story's words come to hold (When "task:key"). A flag is just a name:
                           type a new one and it exists; anything's Needs can ask for it ("name", "!name"). The
                           Story does the same without a node: Task Flags ("key: +table_gone, -lights_ok";
                           "added key: +searching") and Flags Start
  moved.gd                 on a thing: once you've seen it, and only while you can't, it changes: turned to face
                           you, moved to its next mark, nudged, tipped over or gone; a chance each time you look
                           away, its `needs` (sanity:uneasy), a cooldown, at most `times`
  gaslight.gd              one node: the game's words lying for a moment (a task on the list reads something else,
                           a line nothing said, a pickup you already have, the objective's letters out of order),
                           then as they were; only while its `needs` hold (sanity:shaken), sooner as sanity falls
  close_call.gd            under the character who hunts you: she nearly has you. When she's about to catch you
                           while you reload (or your gun's just clicked empty, or the Story's words say you're busy,
                           or she'd have found you hiding), by a chance she falters: still coming, slower, lunging,
                           never quite there until you're done, and a moment for your shot. Never longer than
                           max_secs; one a chase; less likely as your sanity falls. call_it("the door", 2.0)
  sight.gd                 a helper: what the player's eye can see (in the frame, nothing in the way)
  arms_down.gd             under a Character Studio character: its arms down by its sides
  lights.gd, reach.gd      helpers the others use: lights switched, dimmed, flickered and blinked as the Look plugin
                           keeps them, a collider round a thing you use

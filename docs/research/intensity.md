# More intense: sound and the body, the threat's pacing and its signs, the uncanny seen

The user (DECISIONS 2026-11-08, later): "Any other atmospheric horror elements you can think of adding? Research some
more things that could elevate our simple game to a more intense level".

This note covers what the earlier notes don't:
- docs/DIRECTING.md §3: suspense over surprise, the false scare, silence before a scare;
- docs/research/dread_structure.md: the dread curve over a night and a game;
- docs/research/jump_scares.md: the startle, its numbers, and §8's plan (an **edge test** for glimpses, **figures that
  move unseen**, a **pool of scares** without repeats, **sound placed behind the player**, the flash limit). This
  note gives that plan its numbers and doesn't repeat it;
- docs/research/simple_loops.md: loop games (The Exit 8), change blindness, a night-by-night plan;
- docs/research/story_in_objects.md: documents, books, containers;
- docs/research/eye_candy.md: the air, the beam, dust, and the catalogue (the TV's light, eyeshine, moths...);
- docs/HORROR_TODO.md: the motel's list (the phone, CCTV, hiding under the bed, the door tried from outside, being
  heard).

What's new is three things: **sound and the player's own body**, **pacing the fear and the threat's warning signs**,
and **the uncanny seen** (the corner of the eye, what moves unseen, mirrors, shadows, the cold, wrong faces).

**How it was gathered.** Three research passes at once, about 260 web searches in all. Several sources don't open
from the cloud session (pmc.ncbi.nlm.nih.gov, gamedeveloper.com, docs.godotengine.org, archive.nt2.uqam.ca), so **a
quote is the search engine's extract of the page linked**. Godot's audio details were read in the 4.7 branch's
source. "(mine)" marks an inference; "weak" or "unverified" marks a claim found once, on a fan wiki, or from a summary.
The starting numbers for timings and angles are the researchers' unless a source is named: values to tune in play.

## 1. Sound and the player's body

**The strongest finding.** Sound alone raises arousal: players of Amnesia reached 90 bpm with the sound on and 77
without it, with no enemy near (Usher 2013). Sounds from behind, rising sounds, rough sounds and a fast heartbeat each
push it higher. The weakest evidence is for infrasound.

### 1.1 Rooms that sound like their walls (reverb by material)

- **Why.** Tile rings, a stairwell trails, carpet is dead. Small virtual rooms were rated calmer and safer than large
  ones, and sounds behind the listener more arousing (Tajadura-Jiménez et al. 2010; the room-size effect didn't hold
  for threatening sounds). So a hiding place should sound close and dry, the corridor after it exposed (mine).
- **In Godot 4.7.** An Area3D per room with `reverb_bus_enabled`, `reverb_bus_name` by the room's material (buses
  `Rev_Tile`, `Rev_Concrete`, `Rev_Carpet`, `Rev_Small`) and `reverb_bus_amount` 0.2 to 0.5. Each bus an
  AudioEffectReverb, not at its defaults (a concert hall: predelay 150 ms, room size 0.8) but a predelay of 20 to 40 ms,
  damping 0.1 for tile and 0.8 for carpet.
- **Two traps in the source.**
  - The area that applies is the one round the sound's **source**, not round the listener.
  - An area with only its reverb on sends the sound to that bus alone: also turn on `audio_bus_override` (bus `SFX`)
    and set the reverb's dry to 0.
- **Ours.** The rooms are already boxes (the light zones, the interior export's `trigger_<room>__volume` markers). The
  by-hand player has **no footsteps at all** yet (`starter/player.gd`), and the export's are played flat
  (`play.gd`, `shelf_sound(name, null, …)`), so no area touches them: footsteps in 3D at the feet come first.
- Effort S to M. Pitfall: too much reverb blurs the quiet cues.

### 1.2 The threat heard through walls and floors (occlusion)

- **Why.** Sounds from outside the field of view are located faster and feel worse (Asutay & Västfjäll 2015). Resident
  Evil 2's director: Mr. X's footsteps are never faked; if you hear them, he's near. The Bunker's stalker crawls in the
  walls, and reviewers could tell by ear when it was close.
- **In Godot 4.7.** A ray from the camera to the sounds that matter, each physics frame; each wall or shut door between
  takes 6 to 10 dB off and dulls it.
  - The player's own filter (`attenuation_filter_cutoff_hz`, a high shelf) only deepens with distance, so it can't
    muffle a sound just behind a door.
  - The researcher's workaround: `emission_angle_enabled` with a 0.1° cone puts the listener outside the cone almost
    always, and `emission_angle_filter_attenuation_db` (about −30 dB above `attenuation_filter_cutoff_hz` 800) becomes
    a per-sound occlusion knob, set by the ray. An undocumented use: to try.
  - Steps on the floor above: played from above the ceiling, low-passed so only the thumps come through.
- Effort M. Pitfall: honest cues are worth more than fake ones; a sound that says she's near should mean it.

### 1.3 Behind you (binaural)

- **Godot 4.7 only pans left and right** (a proposal of 30 Oct 2026: the nodes "use only panning"), so a sound behind
  sounds like one in front.
- Hellblade's voices were recorded on a binaural dummy head and circle the head. Resident Evil 7 is often called
  binaural; no source was found for that (Capcom credits Yamaha's ViReal headphone processing).
- **Steam Audio** is Apache-2.0, the whole SDK open since 4.5.2 (February 2024; Valve's release builds use Intel's
  closed IPP, which is optional). For Godot:
  - **Nexus Resonance** (`undomick/godot-nexus-resonance`): MIT, v1.1.0 of 17 Sep 2026, binaries for Windows, Linux and
    macOS, for Godot 4.6 and up; occlusion, sound through walls, baked reflections, paths round obstacles, binaural.
    The researcher's reading of its page; GitHub's other repositories don't open from this session, so not checked
    again. To test on 4.7.
  - `stechyo/godot-steam-audio` (MIT, Godot 4.4, alpha) was archived on 7 Oct 2026.
- Effort M to try, L to ship; it helps on headphones only. Without it: "behind" sounds placed behind-left or
  behind-right and duller. A whisper circling the head needs it.

### 1.4 Which sounds frighten

- **Roughness.** A scream's loudness flutters 30 to 150 times a second, which speech barely does; rough sounds are
  rated more alarming and reach the amygdala (Arnal et al. 2015). Horror scores carry more noisy, scream-like sounds
  (Blumstein et al. 2010, 102 films). Distortion raised arousal in music heard alone, but over a calm picture it only
  made the music feel worse (2012): the picture decides.
  - Build, offline in `tools/sfx.py`: her signature sound and the stings with their loudness modulated at 40 to 80 Hz,
    and sudden drops of an octave (Godot has no tremolo to do it live).
- **Looming.** A rising sound is heard as closer and louder than it is, and reaches the amygdala (Bach et al. 2008): a
  swell over 1 to 3 s before a reveal (`volume_db` tweened, its filter opening).
- **Low, not infrasound.** The evidence is weak: Tandy & Lawrence (1998) is one room with a 19 Hz fan; Wiseman's 2003
  concert (22% more "unusual experiences") was never peer-reviewed; French et al. (2009, 79 people) found no effect;
  Scatterty et al. (2026, 36 people, 18 Hz) found more cortisol and irritability, unnoticed, but no more anxiety. And
  headphones and laptops can't play it. A 30 to 60 Hz rumble with its 2nd to 4th harmonics (the ear fills in the low
  note), and the pad's rumble.
- **Silence and masking.** Toprac & Abdel-Meguid (2011), sounds varied in a test level: loud sounds timed to something
  seen caused fear; medium-loud ones anxiety; unseen, untimed ones suspense; quiet ones failed, masked by the rest.
  - Build: a faint cue ducks the music and the room's tone (an AudioEffectCompressor on Music and SFX, its `sidechain`
    a `Cue` bus). When she's near, the little things' ticks and hums stop.
- **Her sound gets its own slider and an on-screen sign.** Silent Hill 2's remake drew complaints for a radio static
  too loud with no slider.

### 1.5 Sound tricks

- **The behind-you layer.** P.T. plays a second set of footsteps behind yours, and a camera hack found Lisa held just
  out of view behind the player.
  - Steps that copy yours 0.3 s late and take one step too many when you stop; a sound in the room you just left; a
    door shutting out of sight; knocks that probe the walls (Darkwood's nights) or answer yours.
  - Build: a phantom AudioStreamPlayer3D 2 to 4 m behind the camera, another floor's sound than yours, only while the
    camera faces away with no line of sight, about once every 10 to 15 minutes. This is jump_scares §8.7.
  - Pitfalls: unless they're clearly someone else's steps it reads as a bug; random events go stale (Visage's door
    slams are "much less terrifying as the game progresses"). Leave evidence afterwards, and sometimes it's really her.

### 1.6 The player's body

- **Breathing, and holding it.** Outlast's Philippe Morin: "if you do it too much, then for some players it will become
  a disconnect". Dead Space (2023) drives Isaac's breathing and heart rate all the time and lets them recover slowly.
  In Alien: Isolation you hold your breath in a locker while the alien sniffs; too long and Amanda gasps.
  - Build: calm, hurried and panicked breathing loops (the shelf has `breath`, `breath_02`, `breath_close`) on a `Body`
    bus, crossfaded by running and fear. Hidden, the player holds a key: the breath stops, the room's small sounds
    rise; 8 to 12 s of air (less when afraid), then a gasp she can hear.
- **The fear value and the stress mix.** A fast heartbeat, heard or felt, raised anxiety and heart rate in two studies
  (Wang et al. 2023). Of 157 police officers after shootings, 84% reported sound dimming and 79% tunnel vision (Artwohl
  2002; self-report). Alien: Isolation's mix while sneaking favours "Amanda's sounds – footsteps and clothing – and the
  alien".
  - Build: one `fear` value (her distance, being seen, a chase, hiding) drives:
    - a heartbeat at 60 to 140 bpm, a little irregular, falling back over 10 to 20 s, a pad's pulse on each beat;
    - a `World` bus over Music and SFX whose low-pass falls toward 1.5 kHz and −4 dB, the `Body` bus untouched;
    - a light vignette.
  - Pitfall: heartbeats draw steady complaints from players with anxiety or misophonia, and one Dead Space player found
    no off switch: the `Body` bus gets its own slider and a toggle.
- **A trembling beam.** The body's tremor runs at 8 to 12 Hz, and adrenaline raises it (mixed evidence). 0.2 to 0.5° of
  8 to 10 Hz noise on the flashlight's aim, scaled by fear, **the light only, never the camera** (Xbox Accessibility
  Guideline 117: camera shake optional). No game found doing exactly this.
- **Ears after a bang.** The `World` bus muffled to 600 Hz, back over 4 s. A ringing tone only as an option: tinnitus
  sufferers say such tones set it off (CoD MWII, Horizon Forbidden West and F1 23 added switches).
- **What Frictional learned.** Amnesia's sanity meter had no real fail state; Thomas Grip: "most of the urgency around
  that meter is entirely in players' heads". Rebirth tied fear to an illness and has a switch for its distortions; The
  Bunker dropped sanity for the stalker. So: **tie the body's effects to a real threat, and leave the screen's shape
  and the lens alone.**
- **The player's own breath** (opt-in only): Alien: Isolation could hear you through Kinect or the PlayStation Camera.
  Godot: `audio/driver/enable_input`, an AudioStreamMicrophone on a muted bus with AudioEffectCapture, its level
  against a calibrated floor. Effort M.

## 2. Pacing the fear

### 2.1 A dread director

- **Left 4 Dead's Director** (secondhand: the fan wiki, Valve's wiki, AiGameDev): it tracks each player's intensity and
  acts on the highest, cycling **Build Up** (until a peak near 0.9 of 1), **Sustain Peak** (3 to 5 s), **Peak Fade**,
  then **Relax** (30 to 45 s, or until the players move on); it spawns out of sight, neither too near nor too far.
- **Alien: Isolation** pairs a director with the alien's own AI. The director always knows where you are and hints to
  the alien now and then; the alien must find you itself. Its **menace gauge** rises with the alien's nearness and
  with whether you can see or hear it; at a threshold the alien goes backstage, into the vents, for a while. Gary
  Napper: "As soon as the player can predict a pattern in the Alien, it stops being scary."
- **Small games.** The Mortuary Assistant's haunt system "builds your experience when you first load in" and remembers
  what you've seen. In Visage, sanity drains in the dark and the events come more often and worse as it falls. In
  Five Nights at Freddy's, each animatronic rolls against its level every 3 to 5 s (fan datamining, weak).
- **For us** (the researcher's design; mine where it meets ours): the story's scripted beats stay; a director fills
  the gaps between them.
  - **A moment** (`dread_moment.gd` beside anything with `fire()`: a scare area with `walk_in` off, an event area):
    a `tier` (1 a creak or a far door; 2 steps above, a knock, a light dying; 3 a shadow crossing, her glimpse), a
    `weight`, a `cooldown` (120 to 300 s), `once`, `needs`, a distance band, and **where**: behind, in view, out of
    sight (the camera's frustum and a ray).
  - **The director** (`dread.gd`): intensity rises with what the story says (a scare +0.35, flashed twice +0.3, lit
    +0.1) and falls 0.01 a second; a peak at 0.85 held 4 s, then Relax 30 to 60 s; moments 25 to 70 s apart, jittered;
    quiet in safe rooms, paused under a card, the menu or a scene; the night's set drawn at load
    (`RandomNumberGenerator.rand_weighted`), never the same kind twice running, and what fired kept so the next run
    differs. This is jump_scares §8.5's pool, run by intensity.
  - **Her menace** (`menace.gd`): +0.05 a second within 8 m, +0.15 in view, +0.3 in a round; at 1 she withdraws
    (the farthest spot, or gone) for 60 to 120 s while the director holds Relax.
- Effort M (her menace alone S). Pitfalls: a steady gap reads as a clock; tier-1 noise becomes wallpaper; a glimpse in
  plain view is an entrance, not a glimpse.

### 2.2 The sweet spot

- Andersen, Schjoedt, Price, Rosas, Scrivner & Clasen (2020) put heart monitors on 110 visitors to a haunted house:
  fear rose with the large swings of heart rate, **enjoyment followed an inverted U** over the small, quick ones.
  Andersen: "If people are not very scared, they do not enjoy the attraction as much, and the same happens if they are
  too scared." Players differ: adrenaline junkies push their arousal up, white-knucklers damp it (Clasen et al. 2019).
- A threat with a cue gives a short burst of fear; an unpredictable one lasting anxiety (Grillon's NPU-threat studies).
  Nine of 32 people took a bigger shock sooner rather than wait for it (Berns 2006): dread itself is the cost.
- **So** (mine): many short, moderate peaks with recovery between them, not a flat high; mostly cued encounters, a few
  with no warning so the unease never quite lifts; no warning left hanging. A *Gentle / Normal / Relentless* setting
  on the director's peak and Relax; Relax longer when the player has spent most of the last two minutes hiding.
  Pitfall: tuning it to your own nerves, long since used to it.

## 3. Signs that it's near

- Bernard Perron's "Sign of a Threat" (2004): a warning trades the jolt for suspense (its abstract only; Hitchcock on
  anticipation as its epigraph).
- **Silent Hill's radio** hisses louder as monsters come near, gives no direction, and can be switched off. **Fatal
  Frame's filament** glows by the ghost and brighter as you face it. **Alien: Isolation's tracker** blurs the room
  while raised: "the motion tracker gives you information on the box but we take away information in the background".
- **Phasmophobia** (its wiki): during a hunt the lights and flashlights within 10 m on the ghost's floor flicker;
  freezing rooms read below 0 °C and your breath shows; hunts last 15 to 60 s after a 1 to 5 s grace and come at least
  25 s apart.
- **For us**, `presence.gd` on her: within 10 m on her floor the lights flicker (through `lights.gd`; the flashlight
  already flickers near her), a radio's, the TV's or the room phone's static rises by distance along a curve, breath
  shows within 4 m (§6) and the fog thickens a touch; a lead of 1.5 s; a false alarm one time in ten; whether walls
  stop it. Effort S.
- Pitfalls: a reliable cue that shows direction becomes radar and ends surprise; a cue that never pays off is ignored.

## 4. The everyday threat, and being hunted

- **Fears to Fathom** (one developer, Rayll; each episode "narrated by the ones who survived"): a boy home alone with a
  prowler outside; Norwood Hitchhike, a 19-year-old at a motel after car trouble; Woodbury Getaway, a man who says he's
  Rick while the real Rick is texting you. It stays "almost entirely within the world of the mundane" (Dread Central):
  plausibility, ambiguity, chores as its spine.
  - **For a hotel or a motel, as tier 2 and 3 moments** (S each): three knocks, then nothing; a knock at the connecting
    door; the handle tried from outside (HORROR_TODO 6); a car idling, its lights sweeping the curtains (HSHeadlightSweep),
    a car door, steps along the walkway that stop at your door; the next room's TV cutting out as you near the wall; a
    shadow crossing the light under the door. Pitfalls: explaining him too early; nothing impossible before the turn.
- **Hiding while searched for.** Alien: Isolation (hold your breath, lean back), Outlast (pulled out of a hiding
  place), Amnesia (monsters give up after "a minute or two", weak), Resident Evil 2's Mr. X (random routes after losing
  you; footsteps that tell his distance and echo from another room; Clea's developer: steps too soft give false safety,
  too loud send players to closets for nothing). Alien: Isolation's writer: "By the time it was perfect, it was like,
  'Oh, wow, everything takes a lot longer!'"
  - `searcher.gd` (HORROR_TODO 5 and 9 feed it): on hearing you she listens 3 to 6 s, walks to where you were and checks
    the one or two nearest hiding places (25 to 45 s in all); a **close pass**, stopped 1 to 1.5 m from you for 2 to 4 s,
    breathing, then leaving so you hear her go; holding your breath halves the chance she finds you; a hiding place
    used three times is the first she checks. Effort M.
    *Built for games made by hand (2026-11-08, night): the starter's `searcher.gd` and `noise.gd` as above, a shut
    door on her way opened, found once a search (pulled out, in your face), seen in the open 7 m with your light on
    and 3 m without, then back to her post; tutorial v2's linen closet (§22).*
- **Chases.** Outlast 2 kept its chases "just the right length"; no designer gives seconds (Phasmophobia's 15 to 60 s
  hunts the nearest anchor, weak). `chase.gd` for the format's rounds: 20 to 40 s; her speed 0.9 to 1.0 of your run; a
  door you shut costs her 2 s and a bang; 6 s out of her sight and she searches instead; always a sure way out (a lit
  room, the stair door she won't pass); the chase mood, then a hush. Effort M. Pitfalls: searches you can't survive,
  chases learned by heart, long waits in a wardrobe.
  *Built for games made by hand (2026-11-08, night): the starter's `chase.gd` as above, along your trail where she
  saw you go (no navigation mesh), the searcher's sight starting it and its search taking over when she's lost you;
  tutorial v2's corridor, the stairwell the way out (§22).*

## 5. The uncanny seen

### 5.1 The corner of the eye

- **Why.** The edge of vision sees little detail but is most sensitive to flicker, most at 20 to 50° from the centre
  (Tyler 1987; debated). Threat gets through out there: fearful faces at 15° and 30° were answered faster than neutral
  ones (Rigoulot 2011), fear was detected out to 40° (Bayle 2011), and the amygdala answered in about 80 ms (Bayle
  2009). First-person players look mostly at the screen's centre.
- With our 90° lens a figure 30 to 42° off centre lands about 15 to 23° from the player's eye on a 27-inch screen at
  65 cm.
- The Mortuary Assistant: "you may see something out of the corner of your eye, and it won't move until you turn to
  look at it". Ghostwatch hid its ghost in 13 shots; viewers have found about 8.
- **The rule** (jump_scares §8.2's edge test, with numbers): shown only 30 to 42° off the view's centre, in shadow, 5 to
  15 m away, one small motion (leaning out of a doorway); held 0.5 to 1.5 s; gone once the view swings toward it
  (faster than about 60° a second) or comes within 25°, and only behind something, out of frame or in a lamp's
  flicker (100 to 200 ms), never in clear view. **No sting**, or it's a jump scare. A few an hour, each somewhere new;
  never a clue that's needed (low-vision players miss them). Effort S.

### 5.2 What moves while you're not looking

- The Weeping Angels' and SCP-173's rule; mannequins and dolls; a room changed behind you (P.T.; Layers of Fear's rooms
  "change from under you"); a figure closer each time you look (Japan's daruma-san ga koronda). A strong design record,
  no lab evidence. Condemned's department store: "I would turn around to see more mannequins than before, inching
  their way towards me, although I never saw them physically move."
- **Unseen** means all three: outside the camera's view widened by about 15°, rays to its head and feet blocked, and no
  live mirror facing it. (VisibleOnScreenNotifier3D ignores walls without occlusion culling; our exports have
  occluders.)
- **Closer each time** (jump_scares §8.4, with numbers): marks at 12, 8, 5 and 2.5 m; a step after 1.5 s unseen, the
  head turned a little further toward you each time; a lamp's flicker as the blink; **the last mark 0.35 m behind the
  player's eye**, silent (§5.6). A room changes while its HSLightZone has it unseen. Slender's cost of looking, for us:
  the tape's noise rising while she's in view.
- Effort S for a figure, M for rooms. Pitfalls: Layers of Fear (2023) repeats its tricks "ad nauseum"; a mirror or a
  shadow can give a move away.

### 5.3 Mirrors

- **Why.** A copy of your own movement that doesn't match reads as someone else: when a robot touched people's backs
  half a second after their own reach, about 30% felt someone behind them (Blanke 2014). Silent Hill 3's mirror room;
  What Lies Beneath's "You know" in the steam.
- **Ours** (`mirror.gd`: a mirror's camera draws the player camera's mask without layer 20 and its own layer):
  - **Missing from the mirror** works today: put her on layer 20. Effort S.
  - **Only in the mirror** needs a layer the player's camera skips and the mirrors' cameras add back (line 92). All 20
    are allotted (1 everything, 2 to 10 the zones, 11 to 19 the mirrors, 20 the hidden), so it costs one mirror layer,
    say 19: **the user's call**. Whether a camera's mask hides that mesh's shadow is untested: off, or kept as the clue.
    *Built (2026-11-08, night, the user's yes): layer 19, the mirrors now 11 to 18; `HSMirror.only_in_mirrors` turns
    her shadow off (whether the eye would see it stays untested: off is safe), the starter's `mirror_figure.gd`,
    tutorial v2's bath.*
  - **Writing in the steam** (M): a `fog` uniform on the mirror's shader and a mask of the writing that fogs
    differently (real: grease changes how glass fogs, Rayleigh 1911). *Built (2026-11-08, night): HSMirror's
    `set_steam` and `write` (GODOT_LOOK §5m), the starter's `steam_mirror.gd`, tutorial v2's bath mirror (308).*
  - **The reflection out of step** (L): needs a body for the player, on the mirror-only layer, 0.3 to 0.5 s late. The
    starter's player has no mesh: the mirrors show nobody in front of them today.
- Pitfall: after the first, players watch every mirror. Few.

### 5.4 Shadows and silhouettes

- P.T. (a camera hack: Lisa always behind you; pass a light and your shadow is hers). Nosferatu's shadow on the stairs.
- **A shadow with no body** (S): a figure 0.5 to 1 m behind the player with `cast_shadow = SHADOWS_ONLY`, a lamp behind
  it. The player casts no shadow, so the one on the wall ahead can't be yours.
- **Feet under the door** (S): a line of light under 304's door (an emissive strip if the corridor's light can't reach
  it) and two dark bars that slide in, stop 3 to 5 s and leave.
- **A shoji or a frosted bath door** (S): `backlight_enabled` on its material, a light behind it, a shadows-only figure
  between (untested: the screen must cast no shadow itself). Slide it open: nothing.
- **Lightning** (M), within the flash limits: a real flash is 3 to 5 strokes about 60 ms apart, too many. ITU-R
  BT.1702 and Ofcom bar more than three flashes a second over a quarter of the screen (a swing of 20 cd/m² or more
  while the darker frame is under 160 cd/m²); WCAG 2.3.1 the same unless small or dim; Xbox's guideline 118 about a
  fifth of the screen and stricter for red. So one stroke and at most two re-brightenings on a glow that never dips
  more than a tenth of white, then at least a second of dark; the figure there only while the flash lights it; thunder
  about 3 s a kilometre later; a setting to tone flashes down. These limits apply to every flicker in this note.

### 5.5 The cold

- Breath shows when 34 °C breath, saturated, mixes with the room's air and the mix passes saturation (a contrail's
  mixing line; an analogy, no study of breath found): commonly below about 7 °C, warmer in damp air (the researcher's
  rough sum: near-saturated air at 10 to 15 °C). Frost and mist start at a pane's bottom edge, its coldest part.
  Phasmophobia shows breath in a freezing room (players say below 5 °C).
- **Build** (M): a `cold` word, on a room or a moment, switches on puffs at the mouth (a MultiMesh of the Look plugin's
  `puff.gdshader`, 15 cm ahead of and 10 cm under the eye, every 3 to 5 s, lit by the beam) and a frost mask on the
  window pane's shader rising from the bottom edge. Faint near the camera; saved for the cold spot, or it reads as
  weather. (eye_candy.md's "breath in the cold", now with a source.)
  *Built (2026-11-08, night) for games made by hand: the Look plugin's `HSBreath` (lit by direct lights only and
  added: a flashlight's beam shows the breath where it crosses it, the dark hides it) and `HSGlass.frost`, the
  starter's `cold_area.gd`, tutorial v2's end window (GODOT_LOOK §5l). The story format's `cold` word is still to do.*

### 5.6 Wrong bodies and faces

- **Why.**
  - Characters whose upper face doesn't move were rated more uncanny, most in fear, sadness, surprise and disgust
    (Tinwell 2011); one that didn't startle at a scream was rated most uncanny and read as a psychopath (Tinwell 2013).
  - The eyes tell us a face is alive (Looser & Wheatley 2010). The uncanny valley showed only when a realistic face
    had one abnormal feature, such as strange eyes (Seyama & Nagayama 2007). Our MHR faces are realistic enough.
  - People blink about 17 times a minute at rest and 26 talking (Bentivoglio 1997); pupils answer light in 0.2 to 0.29 s.
- **The dead stare** (S): her idle blink off (HSBlink); her pupils don't narrow in the beam while the living
  characters' do, on the reflex's timing; she doesn't flinch.
- **The wrong smile** (S): mouthSmile (AU12) with cheekSquint (AU6) at 0, the brows and lids still; any of the
  library's clips played under an upper-face mask.
- **The walk and the stillness** (S to M):
  - Ringu filmed Rie Inō walking backwards, jerkily, and ran the film in reverse: a Kimodo walk played backwards
    (`AnimationPlayer.play_backwards`).
  - Kairo's ghost wobbles toward a still camera with no cut. Kiyoshi Kurosawa: Japanese ghosts "don't do anything",
    and "you're stuck with it forever". Konaka's rules (a publisher's summary): no shots from the ghost's view, she
    never speaks; its emblem an actor "just standing there".
  - Ma (間) in practice (mine): a still figure held in plain view for 10 to 20 s.
  - Corrections to the brief: Takako Fuji, Kayako, is an actress, not a contortionist; she credits Takashi Shimizu
    with the movements, and the croak is Shimizu's own voice.
- **Posture** (S): the head bent sideways past the neck's normal 42° or turned past 70° (a bone override, or
  LookAtModifier3D with its limits off); facing the corner (The Blair Witch Project); hair over the face; no feet
  (Maruyama Ōkyo's yūrei, 1750).
- **Too close** (S): Hall's intimate zone ends at about 45 cm. Patient SM, with no amygdalae, had no sense of personal
  space; controls stood nearly twice as far away (Kennedy 2009). People kept more distance from virtual characters who
  met their gaze (Bailenson 2003). Her last mark 0.3 to 0.4 m from the player's eye, looking at it, silent.
- **Mimicry** (S): at the end of the corridor she steps when you step and stops when you stop.
- Pitfall: **one wrong thing per face**. Pile them up and she reads as a monster, not a person.

## 6. Against ours

| Element | What we have | What it lacks |
|---|---|---|
| Footsteps | the export's, by floor, flat (not placed) | the by-hand player has none; placed at the feet |
| Room reverb | none | an Area3D per room on reverb buses by material |
| Occlusion | none | rays and the per-sound filter; the floor above |
| Binaural | panning only (Godot) | Nexus Resonance to try, headphones only |
| Her sound, looming | the shelf's monsters and weird sounds | roughness made offline; swells before a reveal |
| Silence | the hush before a sting | faint cues ducking the beds; the little things quiet near her |
| Behind you | `sound` at a place | the phantom steps, the room you left (jump_scares §8.7) |
| The body | nothing | breath by fear, held while hiding; heartbeat, World bus, vignette, the beam's tremor; settings |
| A director | scripted moments; story_check's spacing | moments by intensity, cooldown and where the eye is; her menace |
| Warning signs | the flashlight flickers near her | lights within 10 m, static by distance, breath, false alarms |
| The everyday | knocks on the shelf, HSHeadlightSweep | the motel's moments as director cards |
| Hunted | hide-and-seek and chase rounds | the search's close pass, held breath, doors that cost her time |
| The periphery | glimpse (a jump scare) | the edge rule (§5.1) |
| Unseen moves | `swap` | the full "unseen" test, marks, closer each time |
| Mirrors | real mirrors, layers | layer 20 trick (works); mirror-only layer (a decision); steam writing |
| Shadows | lights, shadows | shadows-only figures, feet under a door, shoji, lightning |
| Cold | puffs, panes | a `cold` word: breath, frost |
| Faces | 72 shapes, expressions, HSBlink | the dead stare, the wrong smile, posture, mimicry |

## 7. What I'd build first

Mine, from the three shortlists, ranked by intensity for the effort. Each would land in the by-hand starter kit and
the Look plugin first (the tutorials' path), then as a story word for the desk's export where it fits (a word, its
runner and story_check in one commit, as the rules say).

**Built so far** (2026-11-08, night: the user, "feel free to work on the rest and include them as part of the new
tutorial too"; the starter kit and tutorial v2's §22): 1 (`footsteps.gd`, `behind_you.gd`), 2 (`presence.gd`; the
breath near her waits for the cold), 4 (`glimpse.gd`, `closer.gd`), 6 (Woohill's sound physics: `acoustics.gd`,
`sound.gd`), 8 (`fear.gd`), 10's occlusion and 5 (`mirror_figure.gd` with the Look plugin's layer 19,
`shadow_pass.gd`, `door_feet.gd`), 3 (`uncanny.gd`: the dead stare and the wrong smile, with §5.6's posture and
mimicry; the pupils' answer to the beam waits, for there's no pupil reflex for the living to differ from yet), 9
(`dread.gd`, `dread_moment.gd`, `menace.gd`; the night's set and its memory across runs not yet: the starter has no
saves), §4's everyday moments for a hotel, and 10's lightning (the Look plugin's `HSLightning`, within the limits
above), and 7 and 10's searches (`noise.gd`, `searcher.gd`, `seat.gd`'s hiding pose and the player's held breath:
tutorial v2's linen closet) and chases (`chase.gd`). Not yet for the desk's export: no story words.

1. **Footsteps in 3D, and the behind-you layer** (S). The player's steps by floor at the feet (the by-hand player has
   none), then the phantom steps copying them 0.3 s late, one step too many, a door shutting out of sight.
2. **Presence signs** (S): lights flickering within 10 m on her floor, static rising on a radio, the TV or the phone,
   breath near her, a false alarm now and then.
3. **The dead stare and the wrong smile** (S): no blink, pupils that don't answer the beam, no flinch; AU12 without AU6.
4. **The edge figure and closer-each-time** (S): §5.1's rule and §5.2's marks, ending 35 cm behind you.
5. **The shadow that isn't yours, feet under the door, missing from the mirror** (S each).
6. **Room reverb by material** (S to M): the stairwell trails, the bath rings, the corridor is dead.
7. **Breath, held while hiding** (S to M), with HORROR_TODO 5's hiding.
8. **The fear value and the stress mix** (M): heartbeat, the World bus dulling, a vignette, the beam's tremor, each
   with its setting.
9. **The dread director and her menace** (M): the moments by intensity, cooldown and where the eye is; a Gentle,
   Normal or Relentless setting.
10. **Lightning, the cold, occlusion, searches and chases** (M each).
11. **Later**: writing in the steam, the reflection out of step (needs a body), Nexus Resonance on headphones, the
    microphone (opt-in).

**Decisions for the user**: a layer for "only in the mirror" (one of the mirrors' nine); whether the player gets a
body (the out-of-step reflection, a shadow of their own); headphones-first sound (Nexus Resonance) or not.

**What not to add**: a sanity meter that warps the screen or the lens (Frictional moved away from it); a constant high
(the inverted U); a warning that points the way (radar); more than one wrong thing on a face; any body sound or
tremor without its own off switch.

## Sources

**Sound and the body**
- Usher, "How Does In-Game Audio Affect Players?": https://www.gamedeveloper.com/audio/how-does-in-game-audio-affect-players-
- Godot 4.7 source: AudioStreamPlayer3D https://github.com/godotengine/godot/blob/4.7/scene/3d/audio_stream_player_3d.cpp ; Area3D https://github.com/godotengine/godot/blob/4.7/scene/3d/physics/area_3d.cpp ; AudioEffectReverb https://github.com/godotengine/godot/blob/4.7/servers/audio/effects/audio_effect_reverb.cpp ; AudioEffectCompressor https://github.com/godotengine/godot/blob/4.7/servers/audio/effects/audio_effect_compressor.cpp
- Godot docs, Area3D: https://docs.godotengine.org/en/4.2/classes/class_area3d.html ; AudioStreamMicrophone: https://docs.godotengine.org/en/stable/classes/class_audiostreammicrophone.html
- godot-proposals discussion 15720 ("only panning"): https://github.com/godotengine/godot-proposals/discussions/15720
- Tajadura-Jiménez et al. 2010, When Room Size Matters: https://research.chalmers.se/en/publication/123392
- Famitsu on RE7's GDC 2017 sound talk: https://www.famitsu.com/news/201703/13128851.html
- Asutay & Västfjäll 2015, sounds outside the visual field: https://research.chalmers.se/en/publication/211514
- PC Gamer, RE2's director on Mr. X's footsteps: https://www.pcgamer.com/resident-evil-2s-director-talks-mr-xs-ai-scary-footsteps-and-the-dmx-mod/
- MP1st, Amnesia: The Bunker review: https://mp1st.com/reviews/amnesia-the-bunker-review-hide-and-dont-seek
- GameGeeker, Hellblade review: https://gamegeeker.com/games/hellblade-senuas-sacrifice/review
- Capcom IR, RE7 and Yamaha ViReal: https://www.capcom.co.jp/ir/english/news/html/e180406.html
- Phoronix, Steam Audio SDK fully open under Apache 2.0: https://phoronix.com/news/Steam-Audio-SDK-Fully-Open
- ValveSoftware/steam-audio: https://github.com/ValveSoftware/steam-audio ; build instructions (IPP optional): https://valvesoftware.github.io/steam-audio/doc/capi/build-instructions.html
- Nexus Resonance: https://github.com/undomick/godot-nexus-resonance ; stechyo/godot-steam-audio (archived): https://github.com/stechyo/godot-steam-audio
- Arnal et al. 2015, screams and roughness: https://neurosciencenews.com/acoustic-properties-fear-scream-2257/
- Blumstein, Davitian & Kaye 2010: https://eprints.kingston.ac.uk/id/eprint/17660 ; Blumstein, Bryant & Kaye 2012: https://eprints.kingston.ac.uk/id/eprint/24741
- Bach et al. 2008, rising sound intensity and the amygdala: https://boris.unibe.ch/21529/
- Automaton, Silent Hill 2 remake's radio: https://automaton-media.com/en/tips/the-importance-of-silent-hill-2-remake-radio-and-how-to-get-the-radio-silence-achievement/
- Boston Globe, infrasound and haunted places: https://www.bostonglobe.com/ideas/2016/10/28/this-place-haunted-got-this-weird-vibe/YaJksKwtwoBAWJXVgl1KuI/story.html ; NBC News (Wiseman 2003): https://www.nbcnews.com/news/amp/wbna3077192 ; French et al. 2009: https://research.gold.ac.uk/4209 ; Scatterty et al. 2026: https://www.eurekalert.org/news-releases/1124671
- RTINGS, headphone bass: https://www.rtings.com/headphones/tests/sound-quality/bass-frequency-response ; laptop roll-off: https://mic-tests.github.io/bass-test ; missing-fundamental bass (Aalto): https://aaltodoc.aalto.fi/items/28f25581-3beb-49e4-8418-506dcb5b3446
- Toprac & Abdel-Meguid 2011: https://www.igi-global.com/chapter/causing-fear-suspense-anxiety-using/46792
- Vice, the silence of RE7: https://www.vice.com/en/article/the-scariest-thing-in-resident-evil-7-is-the-silence
- AV Club, P.T. ten years later: https://www.avclub.com/pt-10-year-anniversary-look-behind-you-explained
- Darkwood's nights (a player's account): https://accordion-sprout-l88t.squarespace.com/blog/497-words-about-surviving-3-nights-in-darkwood
- Rely on Horror, Visage review: https://relyonhorror.com/reviews/review-visage
- Game Informer 2013, Red Barrels interview: https://gameinformer.com/games/outlast/b/pc/archive/2013/04/25/discussing-mainstream-horror-and-influences-with-red-barrels.aspx
- 80.lv, Dead Space remake (ALIVE): https://80.lv/articles/dead-space-remake-new-gameplay-released/
- Steam discussion, Alien: Isolation holding breath: https://steamcommunity.com/app/214490/discussions/0/490123727975047044
- Xbox Tavern, Song of Horror review: https://www.xboxtavern.com/song-of-horror-review
- Wang et al. 2023, a fast heartbeat by vibration and audio: https://eprints.gla.ac.uk/305397
- Artwohl 2002: https://www.ncjrs.gov/App/Publications/abstract.aspx?ID=197365 ; its figures: https://aele.org/no-recall.html
- Kotaku AU, Alien: Isolation's sound: https://www.kotaku.com.au/?p=674149
- Steam threads on heartbeats: https://steamcommunity.com/app/381210/discussions/5/364040961436833401 ; https://steamcommunity.com/app/1693980/discussions/0/3770111056974930909
- Physiologic tremor: https://en.wikipedia.org/wiki/Physiologic_tremor ; Xbox Accessibility Guideline 117: https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117
- Tinnitus options: https://primagames.com/tips/how-does-the-tinnitus-setting-work-in-cod-modern-warfare-2-answered ; https://gamepur.com/?p=300573 ; https://forums.ea.com/discussions/f1-games-franchise-discussion-en/high-pitched-sounds-triggering-my-chronic-tinnitus-and-giving-me-headaches/8534494
- Game Developer, Amnesia's sanity and lying to players: https://www.gamedeveloper.com/design/-i-amnesia-i-dev-makes-the-case-for-why-lying-to-players-is-sometimes-good-game-design
- PC Gamer, Amnesia: Rebirth's illness: https://www.pcgamer.com/amnesia-rebirth-trades-sanity-for-a-strange-illness-inspired-by-soma ; its accessibility: https://www.gamepressure.com/amnesia-rebirth/accessibility/z2f408
- GamingBolt, The Bunker has no sanity: https://gamingbolt.com/amnesia-the-bunker-doesnt-have-a-sanity-mechanic-but-maintains-the-interplay-between-darkness-and-light
- TechRadar, the tech of Alien: Isolation: https://techradar.com/news/gaming/the-technology-of-fear-how-alien-isolation-will-scare-you-back-to-the-1970s-1267946/2 ; GamingBolt, Alien: Isolation 2's microphone: https://gamingbolt.com/?p=655980
- Ekman & Lankoski 2009 (record): https://research.aalto.fi/en/publications/hair-raising-entertainment-emotion-sound-and-structure-in-silent-/ ; Garner, Grimshaw & Abdel Nabi 2010: https://vbn.aau.dk/en/publications/a-preliminary-experiment-to-assess-the-fear-value-of-preselected-

**Pacing, signs, the everyday, being hunted**
- The Director (Left 4 Dead Wiki): https://left4dead.fandom.com/wiki/The_Director
- 11 Secrets about Left 4 Dead's AI Director (AiGameDev): https://www.cs.drexel.edu/~so367/teaching/2012/CS680/papers/11%20Secrets%20about%20LEFT%204%20DEAD%e2%80%99s%20AI%20Director%20and%20its%20Procedural%20Zombie%20Population%20%7c%20AiGameDev.com.pdf
- L4D2 EMS, Spawning Infected (Valve Developer Wiki): https://developer.valvesoftware.com/wiki/L4D2_EMS/Appendix:_Spawning_Infected
- Revisiting the AI of Alien: Isolation: https://www.gamedeveloper.com/design/revisiting-the-ai-of-alien-isolation ; The Perfect Organism: https://www.gamedeveloper.com/design/the-perfect-organism-the-ai-of-alien-isolation
- DualShockers, "unpredictable": https://www.dualshockers.com/alien-isolation-developers-describe-gameplay-as-unpredictable/ ; TechRadar: https://www.techradar.com/news/gaming/the-technology-of-fear-how-alien-isolation-will-scare-you-back-to-the-1970s-1267946
- PC Gamer, Alien: Isolation hands-on: https://www.pcgamer.com/alien-isolation-hands-on-pc-gamer-vs-the-monster ; "way too long": https://www.pcgamer.com/games/horror/alien-isolation-is-way-too-long-because-its-xenomorph-got-way-too-smart-at-the-time-it-didnt-seem-that-long
- The Mortuary Assistant interview (mirror): https://ick.com/?p=125322 ; Wikipedia: https://en.wikipedia.org/wiki/The_Mortuary_Assistant
- Visage (Wikipedia): https://en.wikipedia.org/wiki/Visage_(video_game) ; Freddy's AI levels (Ludo guide): https://www.ludo.guide/guide/five-nights-at-freddys/meet-freddy-and-the-gang
- APS, Playing with Fear: https://www.psychologicalscience.org/observer/playing-with-fear ; Andersen et al. 2020: https://pmc.ncbi.nlm.nih.gov/articles/PMC7734554
- Psychology Today, three kinds of fans: https://www.psychologytoday.com/us/blog/morbid-minds/202110/how-3-types-of-fans-benefit-from-horror ; PsyPost on Clasen et al.: https://www.psypost.org/2021/01/study-suggests-the-paradoxical-enjoyment-of-horror-media-serves-an-evolutionary-function-59127
- Schmitz & Grillon 2012, the NPU-threat test: https://pmc.ncbi.nlm.nih.gov/articles/PMC3446242 ; Berns et al. 2006: https://pubmed.ncbi.nlm.nih.gov/16675703/
- Perron 2004, Sign of a Threat: https://archive.nt2.uqam.ca/ludicine/sites/ludicine.ca/files/Perron_Cosign_2004/index.pdf
- Silent Hill's radio: https://www.gosugamers.net/entertainment/news/77521-halloween-gaming-an-ode-to-silent-hill-s-unsung-hero-creepy-radio-static
- Camera Obscura (Fatal Frame Wiki): https://fatalframe.fandom.com/wiki/Camera_Obscura
- Phasmophobia Wiki, Hunt: https://phasmophobia.fandom.com/wiki/Hunt ; Light: https://phasmophobia.fandom.com/wiki/Light ; breath: https://progameguides.com/phasmophobia/does-seeing-your-breath-in-phasmophobia-mean-freezing-temps/
- Dread Central on Fears to Fathom: https://www.dreadcentral.com/editorials/483398/ultra-indie-spotlight-sunday-fears-to-fathom-shows-how-terrifying-the-ordinary-can-be-2/ ; Wikipedia: https://en.wikipedia.org/wiki/Fears_to_Fathom ; Norwood Hitchhike: https://rayll.itch.io/fears-to-fathom-ep2 ; Woodbury Getaway: https://dotesports.com/indies/news/fears-to-fathom-woodbury-getaway-story-and-ending-explained
- CGMagazine, Outlast preview: https://www.cgmagonline.com/articles/previews/outlast-e3-2013-preview/ ; the chase in Outlast 2: https://gamedeveloper.com/audio/the-art-of-the-chase-level-design-and-player-orientation-in-i-outlast-2-i-
- Amnesia Wiki, Hiding: https://amnesia.fandom.com/wiki/Hiding ; MagicGameWorld (weak): https://www.magicgameworld.com/?p=33571
- Clea's devlog, Mr X's lessons: https://invertmouse.itch.io/clea/devlog/66966/mr-xs-lessons ; GamesRadar, The Bunker's generator: https://www.gamesradar.com/amnesia-the-bunker-generator

**The uncanny seen**
- Anstis lab, peripheral acuity: https://anstislab.ucsd.edu/?p=488 ; flicker fusion by eccentricity (Tyler 1987 cited): https://web.stanford.edu/~brookek/uploads/PerceptualModel_SIG2021_paper.pdf
- Rigoulot et al. 2011: https://mcgill.ca/pell_lab/files/pell_lab/rigoulot_et_al._2011_0.pdf ; Bayle et al. 2011: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3123373/ ; Bayle et al. 2009: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2785432/
- CS:GO gaze: https://arxiv.org/pdf/1812.03200 ; Gameluster on The Mortuary Assistant: https://gameluster.com/review-the-mortuary-assistant-i-see-dead-people/
- Ghostwatch: https://en.wikipedia.org/wiki/Ghostwatch ; spot the ghost: https://www.the-medium-is-not-enough.com/2008/11/ghostwatch_spot_the_ghost.php
- Blink (Doctor Who): https://en.wikipedia.org/wiki/Blink_(Doctor_Who) ; SCP – Containment Breach: https://en.wikipedia.org/wiki/SCP_%E2%80%93_Containment_Breach ; red light, green light: https://en.wikipedia.org/wiki/Red_light,_green_light
- Game Informer, Condemned's mannequins: https://gameinformer.com/b/features/archive/2012/11/02/moments-the-stalking-mannequins-of-condemned ; Den of Geek, Bloober Team: https://www.denofgeek.com/games/blair-witch-developer-bloober-team-interview/ ; WellPlayed, Layers of Fear (2023): https://www.well-played.com.au/layers-of-fear-2023-review/
- P.T. (Wikipedia): https://en.wikipedia.org/wiki/P.T._(video_game) ; Slender (Giant Bomb): https://giantbomb.com/wiki/Games/Slender_The_Eight_Pages
- Godot docs: VisibleOnScreenNotifier3D https://docs.godotengine.org/en/4.3/classes/class_visibleonscreennotifier3d.html ; GeometryInstance3D https://docs.godotengine.org/en/latest/classes/class_geometryinstance3d.html ; BaseMaterial3D https://docs.godotengine.org/en/4.2/classes/class_basematerial3d.html ; LookAtModifier3D https://docs.godotengine.org/en/4.4/classes/class_lookatmodifier3d.html
- Blanke 2014: https://www.livescience.com/48649-ghost-illusion-created-with-new-robot.html ; https://actu.epfl.ch/news/neuroscientists-awaken-ghosts-hidden-in-our-cortex
- TechRaptor, Silent Hill 3: https://techraptor.net/content/15-years-later-silent-hill-3-is-still-as-disturbing-as-ever ; What Lies Beneath: https://en.wikipedia.org/wiki/What_Lies_Beneath
- Rayleigh 1911, Breath Figures: https://www.nature.com/articles/086516a0.pdf ; mirrors keeping writing: https://boards.straightdope.com/t/how-do-mirrors-retain-anything-thats-written-on-them/600426
- P.T.'s Lisa behind you: https://gamesradar.com/a-pt-camera-hack-reveals-lisa-is-always-behind-you-and-its-absolutely-terrifying ; https://www.gamerevolution.com/news/593419-pt-silent-hills-secret-discovered
- Nosferatu's shadow: https://blogs.exeter.ac.uk/doingfilmhistory/?p=1335
- Rakov, lightning parameters: https://iee.usp.br/sites/default/files/biblioteca/producao/2013/Livros/Rakov.pdf ; ITU-R BT.1702-3: https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-3-202311-I!!PDF-E.pdf ; Ofcom: https://www.ofcom.org.uk/__data/assets/pdf_file/0021/16248/gn_flash.pdf ; WCAG 2.3.1: https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html ; XAG 118: https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/118 ; NWS, thunder: https://www.weather.gov/safety/lightning-science-thunder
- Breath and frost: https://www.farmersalmanac.com/?p=442461 ; Kärcher, contrails: https://discovery.ucl.ac.uk/id/eprint/1495182/1/Karcher_Microphysical_pathway.pdf ; Napier, cold glazing edges: https://napier-repository.worktribe.com/OutputFile/283727 ; BWF, condensation: https://www.bwf.org.uk/?p=33584 ; Phasmophobia's freezing temperatures: https://dotesports.com/phasmophobia/guides/what-is-considered-freezing-temps-in-phasmophobia
- Tinwell et al. 2011: https://vbn.aau.dk/ws/files/63140615/Facial_expression_of_emotion_and_perception.pdf ; Tinwell, Abdel Nabi & Charlton 2013: https://ub-ir.bolton.ac.uk/esploro/outputs/journalArticle/Perception-of-psychopathy-and-the-Uncanny/9913397408841
- Looser & Wheatley 2010: https://scholar.harvard.edu/sites/scholar.harvard.edu/files/celooser/files/looserwheatleypsychsci.pdf ; Seyama & Nagayama 2007: https://www.scilit.net/publications/ac1b989349b75009de3af18b714e5034
- Bentivoglio et al. 1997: https://pubmed.ncbi.nlm.nih.gov/9399231/ ; the pupil's latency: https://iro.uiowa.edu/esploro/outputs/journalArticle/Latency-of-the-pupil-light-reflex/9983979981802771 ; Ekman, Davidson & Friesen 1990, the Duchenne smile: https://ffri.hr/~ibrdar/komunikacija/seminari/Ekman,%201990%20-%20Duchenne%20smile.pdf
- Ring: https://en.wikipedia.org/wiki/Ring_(film) ; Ju-On: The Grudge: https://en.wikipedia.org/wiki/Ju-On:_The_Grudge ; Takako Fuji: https://en.wikipedia.org/wiki/Takako_Fuji
- Kairo: https://sites.middlebury.edu/vfms24/2024/12/03/kairo-anatomy-of-the-scariest-scene-ever ; https://tvtropes.org/pmwiki/pmwiki.php/YMMV/Kairo ; https://cinema.wisc.edu/?p=1083 ; Kurosawa interview: https://reverseshot.org/interviews/entry/1503/kiyoshi-kurosawa
- Konaka's 恐怖の作法: https://www.eslite.com/product/10012117772682621989001 ; Kyoto University on J-horror and Konaka: https://repository.kulib.kyoto-u.ac.jp/dspace/bitstream/2433/275976/1/kjcms_1_23.pdf ; Ma: https://en.wikipedia.org/wiki/Ma_(negative_space)
- The Ghost of Oyuki: https://en.wikipedia.org/wiki/The_Ghost_of_Oyuki ; cervical range of motion: https://avesis.iku.edu.tr/yayin/e6a38307-12a9-4526-9d9f-efa478dba5e1/normative-values-for-cervical-and-lumbar-range-of-motion-in-healthy-young-adults
- The Blair Witch Project's ending: https://www.looper.com/145176/blair-witch-project-ending-explained/ ; proxemics: https://en.wikipedia.org/wiki/Proxemics ; Kennedy 2009: https://www.sciencedaily.com/releases/2009/08/090830192041.htm ; Bailenson et al. 2003: https://vhil.stanford.edu/publications/avatars-and-agents/interpersonal-distance-immersive-virtual-environments

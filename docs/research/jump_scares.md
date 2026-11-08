# Jump scares done well: what makes a startle land, and what our tools need

The user (DECISIONS 2026-11-07): "Can you research some more jump scare game stuff, how its done well and come up with
what we'd need to add (if anything)."

This note is about the startle itself and builds on what we already have:
- docs/DIRECTING.md §3: suspense beats surprise, the false scare then the real one, silence before a scare, stingers
  rarely, the threat finds you;
- docs/research/dread_structure.md: the dread curve and where each scare word goes;
- story_check's spacing: 60 s between minor scares, 240 s between major ones (`MINOR_GAP`, `SCARE_GAP`).

**How it was gathered.** About a hundred web searches, a few checked again by hand (the prepulse numbers, Alan Wake 2's
option, the workload study, the flash guidelines). Some sites don't open from the cloud session (gamedeveloper.com,
pcgamer.com, ncbi), so **a quote is the search engine's extract of the page linked**, as in dread_structure.md.
"(mine)" marks an inference. "Unverified" marks a claim found once or only on a fan wiki.

## 1. What the designers say

1. **The threat matters more than the hit.**
   - Thomas Grip (Frictional): "the most important aspect of jump scares is the threat of them." They work as a fail
     state the player dreads without the play stopping, and players get used to them when overused.
   - Philippe Morin (Red Barrels): "Good jump scares should stay with you, putting you in a state of discomfort for the
     whole game." The build-up stretches until the player nearly wants the scare to happen (Game Developer's
     paraphrase).
2. **Let the player find it; don't take the camera.**
   - Brian Clarke (The Mortuary Assistant) didn't want to "forcefully take your camera, show you something, and a loud
     jump-scare sound". He made "passive jump scares" that don't react "until you looked at it": "like watching a movie
     and noticing something in the background".
   - Capcom: Shinji Mikami's rules for RE1, as Hideki Kamiya passed them on in tweets (machine-translated), had jump
     scares "against the rules (although he was not completely against them)".
   - Our own rule is already this: the eye is never turned for the player (DIRECTING §1, DECISIONS 2026-10-29).
3. **Repetition kills it; randomness and variety buy the first run.**
   - Mark Hadley made Slender Man's appearances random because he felt Amnesia's scripting "negated its horror".
   - Kyle Rowley on Alan Wake 2's jump scares: "I feel like we kind of overdid it a little bit looking back".
   - The critics of Layers of Fear: "only so many times we can turn around to find our surroundings transformed …
     before we grow immune".
   - Dead Space and Outlast were read as formulas: a health pack before a vent means a necromorph; "you may even find
     yourself correctly guessing where the next scare will appear" (GameSpot on Outlast).
   - Grip on Alien: Isolation: a monster becomes "really lame when players are under a desk, 1 meter away, looking
     straight at it".
4. **Sound sets it up, then gets out of the way.**
   - Winifred Phillips (GDC 2017): drones, winds and rumbles should "come and go", and a semi-silence is eerier than a
     total one.
   - Valerio Sbravatti: the silence clears "the sound field for the blast".
   - Robert Baird: lowering the sound first leaves the audience "more vulnerable to sudden loud noises", and a false
     alarm still startles.
5. **A threat has to be able to hurt, sooner or later.** Grip again: "Some kind of death must happen sooner or later,
   though, or the player will quickly realize that the monster is harmless."
6. **It's made by playtesting.** Craig Hubbard on F.E.A.R.'s scares: "pretty organic and iterative", with "tons and tons
   of playtesting".

**Film's words:**
- **The Lewton bus** (Cat People, 1942): a silent street, then a bus hissing in like a cat: the false alarm.
- **The mirror scare**: a cabinet closes and someone is behind. Its "anti" version holds the payoff back a beat.
- **The threat scene** (Baird): someone threatened by something offscreen.

**Where the eye goes.** The Aarhus lab's eye tracking found that before a scare viewers' gaze wanders the frame
(faces, a fireplace) and misses where the threat comes from.

## 2. Scares taken apart

| Game | Setup and trigger | The hit and after | The lesson (mine) |
|---|---|---|---|
| Resident Evil (1996), the dogs through the window | a corridor seen from fixed cameras; the dog comes as you pass the window (sources differ: the first pass or the way back) | glass, a dog, a second window, a fight | the place learnt as safe, then broken on the way back |
| F.E.A.R., the ladder | climbing turns the view to face the ladder | a figure there (accounts differ: Alma or Fettel) | it works by taking the camera, which we don't do |
| Dead Space, the vents | "fear emitters": up to four layers of music rising as an enemy nears | the vent bursts | music tied to distance is good; the vent pattern shows through by the second hour |
| Doom 3, the monster closets | a panel opens ahead, a hidden one behind | infamous; id dropped them for Rage | a pattern learnt in minutes |
| P.T. | the threat is behind you all along (a camera hack shows Lisa following); the radio says "look behind you" | the player's own turn; after a catch, turning has a random chance of a scare | the scare is triggered by the player's own looking |
| Outlast | seen climbing into a locker or under a bed, you're dragged out and killed | the night vision showing a face | hiding has a cost; also "a predictable jump scare extravaganza" |
| Alien: Isolation | nothing scripted: a "menace gauge" from its distance, line of sight and the tracker | at its peak it's sent "backstage" into the vents | the system paces itself; relief is built in |
| Five Nights at Freddy's | each animatronic rolls against its level on a tick (fan wiki numbers, unverified) | the fail state is the scare; when the power dies, Freddy's lit face and the music box | a random roll, likelier hour by hour |
| Layers of Fear | sounds behind you make you turn | the room has changed; nothing attacks | turn-around changes wear out |
| Condemned, the mannequins | they move only while unseen; each flash shows more of them closer | fakes out once or twice, then they swarm | the player's looking is the mechanic |
| Silent Hill 3, the mirror room | the door locks | the reflection freezes and bleeds | the reflection is your own |
| Silent Hill 4, the peephole | the hole makes you the neighbour's watcher | a haunting writes on it | the narrowed view, the eye committed |
| Fatal Frame | the camera's viewfinder | the best shot is the second the ghost is closest | you're made to look when it's worst |
| The Mortuary Assistant | passive scares wait to be looked at; procedurally chosen, the game remembering what you've seen and showing others next time (Wikipedia; about a hundred in the pool by an interview's extract, unverified) | some scares are clues | a pool, drawn without repeats and remembered |
| MADiSON | an instant camera's flash lights the room for a moment | what the flash shows; photos change the scene | the reveal by your own light (critics: a cliché) |

## 3. The startle: the numbers

- **Fast.**
  - The startle blink comes in about 20 to 40 ms, the head in 60 to 120 ms (secondary source).
  - In one study a voluntary reaction to a sound took 127 ms, against 186 ms to a light.
- **The attack is what startles, more than the loudness.**
  - Labs use about 100 dB of white noise, yet blinks come at 50 to 70 dB(A) with noise and a fast rise (Blumenthal and
    Goode 1991).
  - The response falls as the rise slows over 2.5, 10 and 25 ms (Blumenthal 1988).
  - In rats, a 140 dB sound with a slow rise didn't startle at all.
  - (mine) A sting must reach full level within about 10 ms. A swell builds tension; it doesn't startle.
- **It habituates.**
  - The steepest drop comes over the first 2 to 10 repeats.
  - The boost from a bad context keeps working through a whole series (Bradley, Lang and Cuthbert 1993).
  - (mine) The same kind of scare is half spent in a few goes; vary what, where and how, not only when.
- **Fear makes it bigger.**
  - The startle is larger while waiting for a threat, and grows the longer the threat lasts. It drops at once when the
    safe signal comes (Grillon 1991, 1993).
  - Darkness raises it (Grillon 1997), and so do unpleasant pictures.
  - Threats at unpredictable times raise it; knowing exactly when the loud sound comes shrinks it.
- **Prepulse inhibition: a small sound just before kills it.**
  - A weak sound 30 (some say 20) to 500 ms before the loud one cuts the startle, most at about 120 ms, by up to about
    65% in healthy people.
  - Beyond 500 ms a warning raises the startle instead (prepulse facilitation; most at 4.5 to 6 s in one study).
  - A sound inhibits more than a light at short gaps, and even a 50 dB tone inhibits.
  - (mine) Keep **the last half second before the hit silent**: no creak, no footstep, no click, no music pickup, no
    whoosh's tail. TRICKS.md's "lead the eye: a sound, light or movement 0.5 to 2 s before every reveal" holds if the
    sound starts a second or more ahead and stops before the hit. A light or a movement as the lead costs nothing.
- **Seeing.** Flicker and movement stand out more in peripheral vision; sensitivity to flicker peaks 20 to 50° off the
  centre (SIGGRAPH 2021). (mine) That's the edge of a 90° view, where TRICKS.md already puts the glimpse.
- **Hearing where.** A sound coming closer is overestimated and moves people more than one going away, and sounds from
  behind are more arousing.
- **In games.**
  - Vachiratamporn: a scare frightens more when the player is already in suspense, and heart rate read the player's
    state with up to 90% accuracy (timing the scares by it made no significant difference).
  - Terkildsen, Engelst and Clasen 2023, "Work hard, scare hard?" (n = 60): the body's arousal at a jump scare rose in a
    straight line with the difficulty of the task in hand, though players' own ratings didn't. **A scare during a chore
    lands harder.**
  - A haunted house of 110 visitors: fear grows with large heart-rate swings, while enjoyment peaks at moderate ones,
    an inverted U.

## 4. Pacing

- **Films:** about ten jump scares a film in recent decades (Where's the Jump, 250 films).
- **Random within a window, with a rest:**
  - FNAF's roll gets likelier through the night;
  - Phasmophobia's hunts come at random below half sanity, at least 25 s apart (fan wiki);
  - Alien: Isolation's gauge sends the alien away at its peak;
  - Left 4 Dead's director builds up, holds the peak a few seconds, then relaxes (the often-quoted length of the rest
    couldn't be confirmed).
- **Ours:** dread_structure.md §3 gives each shift's budget. The check spaces scares by the walker's times, but
  nothing spaces them **in play**, where a triggered scare and a random one could pile up.
- **The release** (mine, from Grillon): the alarm drops when the safe signal comes, so make the safe moment
  unmistakable: a lamp on, the bed, a door latched.

## 5. Settings for players

- **Alan Wake 2**, update 1.15 (January 2024): "Added option to choose between Low and Normal horror flash visual and
  audio intensity". It turns them down; it doesn't remove them.
- **Dead Space (2023):** *Show content warning*, a popup before disturbing content, and *Hide disturbing scenes*, which
  blurs the worst of it with the sound left on. Both are off by default and can be changed at any time.
- **SOMA's Safe Mode and Amnesia: Rebirth's Adventure Mode:** monsters don't attack unless provoked. Rebirth also turns
  off its fear system and brightens the darkest places; the story is unchanged.
- **Phobia modes:**
  - Grounded: a slider from spiders losing their legs to smooth orbs;
  - Lethal Company: the spider drawn as the red word "SPIDER".
- **"No jump scares"** is a tag in the Family Gaming Database: "no sudden loud noises or popping-up scary visuals … or
  the option to disable them".
- **Flashing:**
  - WCAG 2.3.1: no more than three flashes in any second.
  - Xbox's guideline 118 fails more than about three flashes a second over a large share of the screen (about a fifth
    by its summary; WCAG counts a quarter of any 10° of the view). Saturated red, where R / (R + G + B) is 0.8 or more,
    fails sooner. Every game should be tested.
  - (mine) Our flicker modes, the lights dying, the tape's glitch and the flashlight's low-battery strobe
    (FLASHLIGHT_PLAN: about 1.8 a second) all need to stay under three a second.

## 6. The technique families, and our words for them

| Technique | Why it works | What we have | What's missing |
|---|---|---|---|
| seen only in the mirror | behind you without turning; the reflection is yours | real mirrors (the look plugin's `mirror.gd`) | a layer only the mirror's camera draws (with CCTV's: HORROR_TODO 3) |
| the peephole | the view narrowed, the eye committed; someone looking back, or nobody | `peephole`, the `peeping` trigger | nothing but a ready-made card: a face shown only while peeping |
| the lights-out reveal | darkness raises the startle; the dark hides the move | `lights_die`, `power` | the figure moved while it's dark: closer when they come back |
| the glimpse at the edge | the edge sees movement best; deniable | `glimpse` (shown for `secs`) | the edge rule TRICKS.md asks for (20 to 50° off the centre) and gone the moment it's looked at |
| closer each time you look away | the player's own looking is the mechanic | `swap` (one thing for another) | a figure stepping mark by mark while unseen; a `swap` that never fires in view |
| passive (waits to be looked at) | the player finds it | the `look` trigger (the crosshair on it for `secs`) | a jumpscare held until its spot is looked at |
| the flashlight dying | darkness with an alibi | `torch` `dead` | FLASHLIGHT_PLAN: the charge as the alibi |
| only through a camera | the device protects and reveals | none | CCTV (HORROR_TODO 3) |
| the fake-out, then the real one | a false alarm still startles, and the guard drops | sounds off the shelf | the check's 60 s gap warns on the pair: a declared fake-out |
| the death scare | big once, smaller every retry | a round's caught, death and retry, her caught move | caught scares that vary, short, back in play fast |
| footsteps behind | behind and coming closer arouse most | the cast's steps, a `sound` at a place | a sound placed by the player (behind, to one side); steps that keep the player's pace and stop when they stop |
| the phone | a mechanism with rules, thinning night by night | none analogue | HORROR_TODO 2 |

## 7. Checked in our code

- **`jumpscare`** (actions.gd, actions.js) shows the figure with its clip, face and sting (`sting_big`) for 0.8 s. The
  camera is never taken (good), but nothing waits for the player's eye or puts the figure where they look.
- **`glimpse`** is only shown for `secs`: not kept to the edge, and not gone when looked at.
- **`swap`** waits while either thing is seen, but swaps anyway after `secs` (8 by default), in view or not.
- **`seen`** (play.gd `in_view`) asks whether a thing's centre is on the screen. It ignores walls, the thing's size and
  the light on it, and counts nothing seen in a mirror or through a peephole.
- **The `look` trigger** reads the crosshair's target over time: Clarke's passive scare is half there.
- **`music` only logs**, on the desk and in Godot, and no room tone plays (the shelf has 24 ambiences, six of them room
  tones). So the silence before a sting, the first tool of all, has nothing to silence.
- **`hud.shake()`** is empty, so TRICKS.md's flinch (0.1 s, 2°) isn't there.
- **The tape's shader** has `glitch`, `tracking_error` and `dropouts`, but no story word drives them at a scare.
- **There's no random wait or random pick** in a moment's actions, and **no spacing in play**.

## 8. What to add (HORROR_TODO 13)

Mine, from the above, smallest first within each.

1. **Sound that can go quiet** (the foundation; medium).
   - Music and room tone actually played, on their own buses, on the desk and in Godot: the score room's palette cues
     by `music`, and a room's `tone` off the shelf's room tones.
   - `hush`: the bed ducked over 1 to 3 s, the last half second clean, the sting, then the bed back slowly. As a word,
     and before every `jumpscare` by itself (Godot's compressor `sidechain` or the buses' volumes).
   - The shelf's stings measured for their attack (`sfx.py`: sharp hits apart from swells).
2. **A better "seen"** (medium).
   - `seen` counting the thing's bounds, a wall in the way (a ray to a few points) and the light on it, and the views
     through mirrors, peepholes and screens.
   - An **edge** test, degrees off the centre: a glimpse shown at 25 to 50° and gone the moment the eye turns toward it.
   - `swap` that never fires in view.
   - New triggers: **turned round** (more than a set angle within a second, or facing away from a spot) and **seen,
     then gone** (looked at, then out of sight).
3. **Scares that wait for the eye** (small): a `jumpscare` held until its spot is looked at (Clarke's passive scare),
   or put where the player is looking, never turning the eye.
4. **Figures that move unseen** (small to medium): a figure stepping mark by mark toward the player while unseen
   (closer each time), and while the lights are out (closer when they come back).
5. **Chance and variety** (small).
   - A random wait (`after` with a shortest and a longest).
   - A pool of scares picked at random without repeats and kept with the save (The Mortuary Assistant).
   - The check warning at the same trick three times in a night (habituation within 2 to 10).
6. **Spacing in play** (small).
   - Minor and major scares kept apart while playing as the check keeps them apart in the flow, so triggered and random
     ones can't pile up.
   - A declared fake-out (`fake` on a beat) the check lets its real scare follow inside the gap.
7. **Sound placed by the player** (small): `sound` `at: "behind"` (left, right, a distance), and footsteps that follow
   the player's own pace from behind and stop when they stop.
8. **The flinch** (small): a short head jolt with the sting (TRICKS.md's 0.1 s, 2°) and the tape's glitch for a moment.
   Never a turn or a change of lens.
9. **Death that stays scary** (small): the caught scare varied (her clips and faces from a list without repeats),
   short, and back in play fast.
10. **Settings and safety** (small).
    - A *Scares* setting in the pause menu: Normal or Reduced (the sting's level capped and its attack softened, the
      flinch and the glitch off).
    - A flash limit of three a second on every flicker (lamps, the lights dying, the torch, the tape).
    - An optional content warning before the game starts (not an ending card: those are no, DECISIONS 2026-10-27).
    - A check that counts flashes in the playtests' recorded frames.
11. **A scare log** (small): when each scare fired in a playthrough, written by the playtests (PLAY, TESTROOM,
    GDTESTROOM), so a night's curve can be read off and set against dread_structure.md's.

**What not to add:** a forced look (`cut_away`, the `glance` seam: DIRECTING §1), quick-time escapes (deprecated,
DECISIONS 2026-10-27), or more of one kind of scare. The research says variety, timing and silence count, not volume.

## Sources

Quotes are search engines' extracts of these pages.

- Designers: [PC Gamer, what horror game creators think about jump scares](https://pcgamer.com/what-horror-game-creators-think-about-jump-scares) (Grip, Morin) · [Game Developer, the time and place for jump scares](https://gamedeveloper.com/design/the-time-and-place-for-jump-scares-according-to-horror-devs) · [Dread Central, Brian Clarke](https://www.dreadcentral.com/interviews/434748/the-mortuary-assistant-developer-shares-how-he-constructs-his-terrifyingly-good-scares-watch/) · [Mulderville, Brian Clarke](https://mulderville.net/en/events/3049/the-mortuary-assistant-brian-clarke-on-bringing-his-indie-horror-game-to-the-big-screen) · [The Mortuary Assistant (Wikipedia)](https://en.wikipedia.org/wiki/The_Mortuary_Assistant) · [Automaton, Mikami's rules via Kamiya](https://automaton-media.com/en/news/20240207-26883/) · [Slender: The Eight Pages (Wikipedia)](https://en.wikipedia.org/wiki/Slender:_The_Eight_Pages) · [GamesRadar, Alan Wake 2 "overdid it"](https://gamesradar.com/games/survival-horror/alan-wake-2-overdid-it-a-little-bit-with-its-jump-scares-admits-game-director-kyle-rowley) · [DSOGaming, Grip on Alien: Isolation](https://www.dsogaming.com/news/frictional-games-dev-on-alien-isolation-horror-game-suffers-from-two-major-horror-design-issues) · [Bloody Disgusting, Frictional on death](https://bloody-disgusting.com/news/3292474/frictional-wants-postpone-death-soma/) · [Game Developer, Layers of Fear's level design](https://gamedeveloper.com/audio/terrifying-players-with-unstable-level-design-in-i-layers-of-fear-i-) · [Nintendo Life, Layers of Fear 2](https://nintendolife.com/reviews/switch-eshop/layers_of_fear_2) · [Dread Central, F.E.A.R. 2 Q&A](https://www.dreadcentral.com/news/9383/f-e-a-r-2-q-a/) · [Winifred Phillips, jarring jolts](https://gamedeveloper.com/audio/composing-video-game-music-to-build-suspense-part-2-jarring-jolts) and [semi-silence](https://gamedeveloper.com/audio/composing-video-game-music-to-build-suspense-part-5-semi-silence)
- Scholars and film: [Offscreen on Robert Baird](https://offscreen.com/view/engineering-shock-part-1) · [Baird's dissertation](https://www.ideals.illinois.edu/items/20304) · [Acosta and Sears, Frontiers 2026](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1569394/full) · [Perron, COSIGN 2004](https://archive.nt2.uqam.ca/ludicine/sites/ludicine.ca/files/Perron_Cosign_2004/index.pdf) · [Sbravatti, Projections 2019](https://doi.org/10.3167/proj.2019.130104) · [Cat People (Wikipedia)](https://en.wikipedia.org/wiki/Cat_People_(1942_film)) · [Mirror Scare (TV Tropes)](https://tvtropes.org/pmwiki/pmwiki.php/Main/MirrorScare) · [Recreational Fear Lab, where attention goes](https://cc.au.dk/recreational-fear-lab/blog/view/artikel/boo-aaah-an-investigation-of-where-our-attention-is-guided-during-a-jump-scare-sequence-1)
- Games: [Kotaku, RE's window dog](https://kotaku.com/the-window-dog-and-other-tricks-from-the-resident-evil-1829740027) · [Game Informer, Dead Space's sound](https://www.gameinformer.com/b/features/archive/2009/12/11/feature-noises-in-the-dark-exploring-the-sounds-of-dead-space.aspx) · [Engadget, Rage without monster closets](https://www.engadget.com/2009-08-16-id-rage-wont-have-doom-3s-monster-closets.html) · [GamesRadar, P.T.'s camera hack](https://www.gamesradar.com/a-pt-camera-hack-reveals-lisa-is-always-behind-you-and-its-absolutely-terrifying) · [P.T. (Wikipedia)](https://en.wikipedia.org/wiki/P.T._(video_game)) · [GameSpot, Outlast review](https://www.gamespot.com/reviews/outlast-review/1900-6413987/) · [Game Developer, the AI of Alien: Isolation](https://www.gamedeveloper.com/design/the-perfect-organism-the-ai-of-alien-isolation) · [FNaFapedia, Freddy](https://fnafapedia.fandom.com/wiki/Freddy_Fazbear?oldid=4345) · [Game Informer, Condemned's mannequins](https://gameinformer.com/b/features/archive/2012/11/02/moments-the-stalking-mannequins-of-condemned.aspx) · [Silent Hill wiki, Room 302](https://silenthill.fandom.com/wiki/Room_302) · [Fatal Frame wiki, Camera Obscura](https://fatalframe.fandom.com/wiki/Camera_Obscura) · [MADiSON (Wikipedia)](https://en.wikipedia.org/wiki/Madison_(video_game))
- The startle: [Startle response (Wikipedia)](https://en.wikipedia.org/wiki/Startle_response) · [Prepulse inhibition (Wikipedia)](https://en.wikipedia.org/wiki/Prepulse_inhibition) · [Blumenthal and Goode 1991](https://doi.org/10.1111/j.1469-8986.1991.tb02198.x) · [Faunce, Blumenthal and Waugh 2022](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9539862/) · [prepulse facilitation thesis](https://bura.brunel.ac.uk/bitstream/2438/25489/4/FullText.pdf) · [Böhmelt, Schell and Dawson 1999](https://works.bepress.com/anne_schell/56) · [Neuhoff 1998](https://ideas.repec.org/a/nat/nature/v395y1998i6698d10.1038_25862.html) · [Tajadura-Jiménez 2010](https://pure.royalholloway.ac.uk/en/publications/embodied-auditory-perception-the-emotional-impact-of-approaching-/) · [SIGGRAPH 2021, flicker in the periphery](https://web.stanford.edu/~brookek/uploads/PerceptualModel_SIG2021_paper.pdf) · [Vachiratamporn et al.](https://doi.org/10.1007/s12193-014-0153-4) · [Terkildsen, Engelst and Clasen 2023](https://doi.org/10.1145/3611021) · [Andersen et al. 2020, the haunted house](https://pmc.ncbi.nlm.nih.gov/articles/PMC7734554)
- Pacing: [Where's the Jump, jump scares a film](https://wheresthejump.com/do-modern-horror-movies-contain-more-jump-scares-than-older-movies/) · [Phasmophobia wiki, Hunt](https://phasmophobia.fandom.com/wiki/Hunt)
- Settings: [Kotaku, Alan Wake 2 update 1.15](https://kotaku.com/alan-wake-2-115-update-jump-scare-option-level-select-1851213619) · [TechRadar, the same](https://www.techradar.com/gaming/consoles-pc/alan-wake-2s-latest-update-adds-chapter-selection-lets-you-tune-horror-flash-visuals-and-more) · [EA, accessibility in Dead Space](https://www.ea.com/news/accessibility-and-player-choice-in-dead-space) · [Engadget, Amnesia: Rebirth's Adventure Mode](https://www.engadget.com/amnesia-rebirth-adventure-mode-214522535.html) · [GamesRadar, Grounded's arachnophobia mode](https://www.gamesradar.com/grounded-arachnophobia-mode-lets-you-turn-spiders-into-legless-blobs-and-everything-in-between) · [Family Gaming Database, No Jump Scares](https://www.familygamingdatabase.com/search/accessibility/212-No+Jump+Scares) · [Xbox Accessibility Guideline 118](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/118) · [WCAG 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)

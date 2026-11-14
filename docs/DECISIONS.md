# Decisions

The user's answers, newest first. They override the plan, the research and the docs.

## 2026-11-14, the tutorial is updated in bulk, later (the user, on the flags and things branch)

- **"make a note for what we'll need to updatge in the tutorial and then make a pr. I have otehr parallel branches
  that will need updated for tutoria lso will leave that to do in a bulk new branch later"**
- So: a branch that changes what tutorial v2 shows doesn't touch the tutorial; it adds a section to
  `docs/TUTORIAL_TODO.md`. The tutorial, its builder and TUTORIAL2 are brought up to date once, on a branch of their own.

## 2026-11-14, flags and things: the markers tied to everything else (the user, once the marker system was merged)

- **"review and enhance the horrorplugin, especially on how to easily tie in the marker system with other elements
  (interactables), maybe create a new tab for global flags that can be filtered off of quests or maybe there are
  non-global flags too, if I make a marker that depends on a flag to walk, it should be easy for me to use that flag
  elsewhere too for other game logic e.g. can only itneract with door if this flag is also on etc. Consdier what we
  mgiht be missing from or horrro engine plugin for godot and build it."**
- **"The goal is to make an insanely fast workflow to build games"**
- **What it settles** (docs/FLAGS.md is the review, the design and the plan with its checkboxes):
  - **"the horrorplugin"** is read as before (2026-11-13): the family a by-hand project gets, and this work goes into
    the Markers plugin, as more tabs beside NPC Markers.
  - **A flag stays one name everywhere.** The point of the request is that a marker's flag can be used by a door, so
    flags are never fenced in. "Global" and "non-global" are **whose a flag is, worked out from who uses it**: one
    quest's, one character's, or the game's (a thing uses it, or two characters). The Flags tab filters by that, and
    a flag can be pinned to a quest (then using it elsewhere is a Problem, not a wall).
  - **Any thing can ask and can switch**, with one node, **Logic** (`HSLogic`), in the three lines a marker has:
    *Works only when* → *When* (it's used, one of its signals, by itself) → *Then* (flags, a task, a line, a sound,
    things fired). The starter's player asks a thing's Logic before it uses it: one place, so every thing with a
    `use()` is covered, the other plugins' too.
  - **Nobody types a flag's name twice**: every place a condition is written offers the scene's flags, tasks and
    things carried (the tabs, and the Inspector for any script's `needs`), and a flag renamed moves every use.
  - **What was missing, built**: a Flags tab (every flag with who turns it on and who needs it), a Things tab (cards
    that make the selected node a pickup, a note, an area...; the scene's things in one list; Set up the scene), F7
    listing the flags in play.

## 2026-11-14, the markers' conversations: the prior style, not a new panel (the user, on the first picture of it in play)

The picture: Alex in the room and, at the foot of the screen, a dark rounded panel with "Alex", "Looking for
something?" and two boxed rows, "1 The book on the shelf" and "2 Never mind", with "W / S choose  E answer" under them.

- **"Why did we switch to a new panel style for choices. Keep it the prior style."**
- The prior style is the user's own of 2026-10-30, evening (below: "The choice back to one line"), which the UI
  plugin's HUD has drawn since: the question as the line at the foot of the view, the answers on one line under it
  with a dash between, the one pointed at white and the other dimmed, **no panel** (and 2026-11-08: "glass: no panel
  to see"), **no numbers** ("we don't want 1 or 2 to select"), a click or A / D (or the arrows) and Enter, two answers
  at the most. The Markers plugin had drawn a box of its own instead, and listed "use the HUD's" under Later. Wrong
  way round: what's already decided is used first.
- **So**: a marker's conversation is drawn by the scene's `HSHud` when it has one (its `line`, its `choose`, its
  reticle's ring and prompt), and when it has none the plugin draws that same footer itself, number for number. Lines
  come one after another, each for as long as it takes to read, as lines do in the games (E or a click hurries them;
  E never picks an answer). The prompt over someone you can talk to is the ring with the verb and the name under it,
  not a box. Problems warns past two answers.
- **A rule from it**: nothing new is drawn on the game's screen while the UI plugin already draws that thing.

## 2026-11-13, the marker system: a character's whole part in the game placed as markers (the user, with a mock-up)

The mock-up: a Godot editor with a bottom panel "NPC Path & Animation Sequencer" (an NPC list, a quest dropdown with
New and Delete, the selected marker's type, "Boolean Flags Trigger" checkboxes, start and end positions, a 360° "Face
Direction" dial, Add and Remove Marker) and, in the room, pins "1 Walk → 1-End", "2 Interact: grabbing object from
shelf", "3 Walk", "4 Sit: sitting in sofa" joined by arrows; "NPC: Path" beside "NPC: Alex" in the scene tree.

- **"I justed merged this into main. I want you to enhance horrorengine plugin, create a new tab for
  creating/scripting animations throughout the game + when we can interact with the character."**
- **"I create a very rough (2d illustrated viewport but transalate it to 3d when your making it) idea of what I want,
  I want to be able to place markers in the scene for each npc I add, the markers correspond with the quests, however
  if I dont end the quest marker with a disappear the positioning of the npc should continue for the next quest."**
- **"I basically want to be able to place different types of markers for npcs like walk, and have a start and end
  point (should be able to add curved pathing), or idle, or interact (like them grabbing something), these
  animations/events for markers are triggered based of order, if a boolean flag is true e.g. maybe the next marker
  only triggers after we interact with the idle event, then we interact and they reach for something from the shelf.
  Should be able to chain them so they grab something, walk to the sofa, and sit. I want to be be able to toggle
  visibility to view only one npcs markers or multiple, should be an easy way to distinguish, the marker should also
  show the orientation of the character."**
- **"treat my requirement as a rough unrefined requirement ... considering what a user who is not that good at code
  would need to be easily able to make all the npc stuff in a game with drag and drop markers, different types of
  markers, chaining and anything else we may have missed. consider things like marker walk speed, we already can
  import characters with animations but we might want to modify the speed of the looped animation ... how quickly
  does it take for them to get from point a to b, consider easing into the next animation ... Then come up with a
  design, then a plan, then start working through the plan checkbox by checkbox, the goal is that even a young child
  would know how to use it and be able to make the whole npc stuff of the game."**
- **"Consider marker to make a character 'disappear' and not be rendered (shouldnt use gpu/cpu while this is toggled
  on basically equivalent to deleted but they still exist and can be toggled back on). Feel free to make the markers
  look better, the ui I designed is just a very rough draft, you should make the ui as easy to see and use as
  possible."**
- **"Consider also how we can trigger custom animations for certain markers e.g. if I do want to use a kimodo dance
  for an event marker how do I add the dance for that npc, so maybe the npc starts by idle, I talk to it, I trigger a
  flag on, that flag is on so the npc moves to their room, then the npc triggers dance, consider how we can use the
  walk marker for stairs too so they dont clip through."**
- **"Also consider branching, what if I want an idle but based on player choice in dialogue it will branch to them
  walking to a different location, then we should have separate event markers based off which flag got turned on
  based on player choice, consider how we deal with this so theres no bugs or issues, thats why its important you plan
  the system first, the ui shouldnt be fully opaque but not too transparent either, consider a tester so we can ...
  preview each markers npc interaction in the viewport to see how it looks."**
- **"Consider also how to design markers later to work with our jump scare system for monster npcs etc, consider
  marker stuff for toggle the eye shaders and skin shaders for monsters too ... the future markers that sequence after
  should inherit the npcs current state, consider how we can add custom facial expressions for each markers point and
  for interactions I want to be able to determine by flags which expression they preview. So although the character
  interact system is diff, if a marker has "player interactable on", then we can say which dialogue to play through at
  this point, and link the choices to flags which change the expressions of the character."**
- **"Consider flags for is shot too, if we want to sequence a shotgun scene later for monsters if we beat the monster
  early we shouldnt be able to go to the next sequential markers if we dont want to (maybe the monster is immortal and
  that part just determines the ending). Consider everything we need to basically make this plugin be able to make the
  game as easily as possible. Make a new branch for this work called marker-system."**
- **What it settles** (docs/MARKERS.md is the design and the plan with its checkboxes): a new plugin for games built
  by hand, **HorrorStudio Markers**, its tab **NPC Markers** along the bottom. Beside each character an `HSNpc` node
  holds her quests and, in each, her markers as nodes. A marker is *Starts when* → what she does → *then*; a Walk
  marker is where she walks **to** (it starts from wherever she is: nothing can jump); her state (place, facing, sat,
  hidden, face, look, what she holds) is carried from marker to marker and quest to quest. "Wait until" is a marker's
  *Starts when*; "only if" is a **Choice** with ways: the two are kept apart, which is where branching bugs come from.
  You talk to her at any marker with *You can talk to her* on: its conversation's answers switch flags and faces, and
  a Choice after it takes the way of the answer. Quests are in order and she never goes back up the list. Disappear
  hides her and switches her processing off. Being shot sets `shot:<id>` and `down:<id>`; what going down means (her
  quest stops, she's gone for good, she can't be killed) is hers to say. A tester plays any marker on a copy of her in
  the 3D view. **Which plugin**: "horrorengine plugin" is read as the family of plugins a by-hand project gets; a new
  one beside them, as the weapons and the devices each were, not a part of the Director (whose games are a different
  runtime).
- **From the mock-up itself** (2026-11-14: the picture could only be looked at after the design had been written from
  the user's words): its markers are map pins with the kind's drawing in them and "1, Walk" beside them; its panel has
  a "Face Direction" dial, the start and end positions as numbers and the flags as tick boxes. All four were built as
  drawn. Its pins are coloured by kind; ours by character, since the user's words ask for "an easy way to distinguish"
  whose markers are whose, and the kind is the drawing in the pin. Its "NPC: Alex (Guard)" is why the tab's labels
  name the character or nobody, never "her".

## 2026-11-13, the hands and the jiggle: the Animator's first feedback (the user, with a screenshot)

- **"Very good, some feedback. Enhance the hand positioning in walk and run animations (and any others), as you can
  see in the screenshot for running the palms arent really rotated correctly, when you run the palms would be towards
  the body not towards the ground."** (The screenshot: the chubby woman in the Animator's page, running, her hands
  flat in front of her hips with the palms down.)
- **"For soft jiggle see if you can emulate the following free open source plugins style
  https://godotengine.org/asset-library/asset/1595"** (the asset library's 1595 is **JiggleBones (4.0)**: BauxiteDev,
  Cory Petkovsek, Yael Atletl; MIT. Its page couldn't be opened from the cloud session (godotengine.org isn't in the
  session's allowed hosts); its repository's README and script were read.)
- **What it settles**: a hand's turn is counted from the body, so a palm faces the body however the arm is carried;
  a hand at rest is a hand at rest (not a rig's rest pose) and a running hand a loose fist; a runner's arms are
  driven back, the hand from the hip to the chest; a bent arm's forearm is turned to point ahead before the whole
  arm is carried out. The run's rise and fall became a smooth bounce on the way (it fell 3 cm in one frame at each
  landing: found by what hung from it). Each soft bone is a **jiggle bone**, JiggleBones' way written again (a rod
  from where the flesh is rooted, a weight that keeps going, stiffness, damping, the bone turned to point at it),
  baked into the clips and swung **live in Godot** by the look plugin (`HSSoftJiggle`), so it answers a stop, a turn
  and a clip of the user's own. One departure from the plugin, on purpose: damping is against the body, not the
  world (on a rod of a few centimetres a drag against the world leans every soft bone back at walking pace). A fifth
  slider, **Bounce**: the plugin's damping. None of the plugin's code is in the project; it's named where its way is
  used. docs/ANIMATOR_V2.md §4 to §7 and §10, docs/GODOT_LOOK.md §5w.

## 2026-11-13, animation v2: our own animation system, made from each character's body (the user)

- **"I merged in main. I'm not actually a fan of kimodo animations. Realistically I don't need that many animations
  so I want you to create an extremely unique, original, animation system for my godot games that has animations for
  walking, running, opening, reaching, sitting, sleeping, idle."**
- **"Ideally you make a very simple UI for the animation system that as some basic slider for users, for neatural to
  feminine walking."**
- **"This new original system should be able to see the character we created in studio, and each characters
  animartion slightly differs based off their weight, proportions etc, so a bustier female character walks different
  than a skinny woman, same for men, the most important think about this semi produceral system is that the
  characters feel like theyre effected by the physics of their weight (aswell as a slider for strength), and they
  avoid clipping against their own body. I dont need the animation to be fully procudural since that is intensive to
  calculate, however maybe a new tool with a new tab in dashboard where we can import the exported godot model into
  animatorv2, and choose the modfiers."**
- **"My ideal workflow is that the exported characters once in blender, will utilize their own custom aniamtions
  which we can just event in like walk from here to here, pick this up, etcc , that are synced to quests . However we
  still can import ustom animations for certain events (tat wont be related to walking, more like dancing, or stuff
  like that)."** ("in blender" is read as "in Godot": there is no Blender step in this.)
- **"First thik about how you could do this smartly, I assume in the animation craetor it will check the body
  proportions and calcualte the animations based of feminine, masculine, strength, weight (proportions) to avoid hand
  clipping and thigh clipping, maybe we can even consider baking in more generic physics for the fat etc into the
  animations so if the chasracter has a bit of chub wer have some light squishyness (that effects clothing too etc),
  or thifck thighs rather than making the characters walk really wide an unrealistic we would add some squish between
  the thighs as they pass through."**
- **"I imagine how we would work this is, I export my studio godot character, then the animation new tool lets me
  import them and modify the sliders etc, then we bake all the animations in (ready for the godot horror engine to
  use out of the box), then we can either import the characterd irectly into godot or if we use director tool ,
  director tool will use the animations the model comes with rather than the curren tones."**
- **"You dont need to simulate for mathematical realism, just for asthetic trickery, as in it looks like theyre real
  people, almost like we are watching dark anthology series (without the mocap) . Call this new branch animation-v2 .
  Think of the best way to acheive our goalss. For testing just do a skinny man, normal woman, chubby woman. Add some
  soft light physics to bust and hips too"**
- And while it was being built: **"make sure to keep facial epressions as a seperate entity how we alradyu handle (so
  we can mix and match body aniamtions with expressions)"**: a body clip moves bones only (the body's and the soft
  tissue's), never a face shape, a blink or an eye bone; ANIMATOR holds every baked clip to that.
- **What it settles**: the branch is `animation-v2` (from main, which has pull request #28). Kimodo is no longer the
  way a character gets its everyday moves: those are made here, per character, from its own body, and baked into
  its file; Kimodo's reader stays for anyone's own clips. A clip from somewhere else (a dance) is still brought in
  by name. The test characters are a skinny man, a normal woman and a chubby woman. docs/ANIMATOR_V2.md.

## 2026-11-13, two heads: two head cards and their hairstyles after two pictures (the user, with two pictures)

- **"Create two head presets that match the head shape and hairstyle (seperate hthe hairstyle preset into the hair v2
  tab) , for both images. Start by analyzing the images and building strong references that make it easy for you to
  use as references for the presets. Then build them. Be as 1:1 as possible for the proprtions, especialyl with the
  2nd image since it gives a good side/quater view."**
- **"btw when Is ay head presets i mean eyelid shape and nose and lip shape too"**: a head card is the whole face. It
  now sets the lids' shape (the grafted eye's shape keys) and a lip shape when it's picked, beside the skull, jaw
  and nose it carries; every head card, the four older ones too (each with the lip shape made after the same face).
- The first heads were fitted by machine (a face detector on the front picture, an outline match on the side one).
  The user, on seeing them: **"From a reference Id dont think youve analyzed the original images well enough, the
  faces you make look like parody distortions"**. Then: **"just note You are allowed to change the head and neck
  shpes to make it match better for rhtese presets"**; **"I dont know if you realise this (but you made ah ookked
  nose which neither images have),k but the 2 images are different people"**; and on a slim-jawed version held to
  the front picture's numbers: **"this looks too disformed , instead of doing 1:1, try match teh angle and profile
  only 1:1, but for the other angles use common sense and asthetisism, you dont want disfigured ooking female
  heads"**.
- **What that settles, for any head made from a picture**: read the picture by hand (and a picture of a head we
  already have, the same way) before any fit; match a picture **from its own angle only** (a front picture's front,
  a side picture's profile); from every other angle the head is judged as a head: well formed, attractive, no slider
  at an extreme. No hooked nose: a longer nose in a profile is a tip that stands out, never one pulled down. Two
  pictures of two people are two heads, not one base twice.
- **Built** (branch `more-body-presets`: no branch was named; it is the open presets branch): the head cards **v2
  fox** (the front picture: a slim oval face to a small chin, long half-lidded lifted eyes, a small straight nose, a
  sharp bow over a full lower lip) and **v2 pixie** (the side picture, held to its profile: a small nose turned up
  over a short upper lip, big round eyes, full lips set forward, a small chin set back, a soft jaw line), each with
  MHR head weights of its own (a slimmer lower face: the first heads to have them) and v2female's sculpt moved a
  little; two sliders the profile asked for, **Nose base** and **Jaw line**; the lip shapes v2 fox and v2 pixie;
  the hair editor v2.0 styles **fox_long** and **pixie_tail** in a group of their own, and a second colour as **one
  streak in the fringe**. docs/CHARACTER_STUDIO.md §2n, docs/HAIR_V2.md §10d, docs/research/headfit/two_heads.md.
- The pictures stay out of git (`Saved/Heads/ref/h1.png`, `h2.png`).

## 2026-11-13, more body presets: the low-poly character's physique (the user, with a picture)

- **"can you make a new branch off of main, called more-body-presets. And for the body presets tab make a physique
  that matches this low poly shape (thich t highs, skinny waist, adjustable anime style bust), note I dont want it to
  be low poly, Im just giving you this reference because I want to creaete a higher res version of an old character
  I made"**
- The picture: a low-poly torso from under the bust to above the knee, seen from three quarters in front and three
  quarters behind: a very small waist, wide hips that are widest where the thighs begin, thick thighs tapering to the
  knee, a large round seat. Kept out of git (`Saved/Body/ref/lowpoly.png`).
- **The branch** is `more-body-presets`, from main (which has pull request #27: the preset cards, the mouth, eyes v3).
- **What this sets:**
  - A fourth body card, **v2 pear**, matching the picture's proportions on a smooth body (docs/CHARACTER_STUDIO.md
    §2m). What "matches" was held to: the picture's own measure, the waist's width against the widest row's in each
    of its two views.
  - **The bust is the Anime switch's**, as asked ("adjustable anime style bust"): the card turns Anime on and sets
    the Bust slider to a start (1.5); from there it is the character's own, −2 flat to 3 very full. It is the one
    slider a body card sets; every other body card leaves the character's sliders alone, as before.
  - A new slider for everyone, **Hips & thighs** (Body): the lower body as one shape. The card needed it: the
    existing Hips, Seat and Thighs each swell a band of their own and, pushed this far, leave creases between them.
- **My readings, to be overruled if wrong:** the limbs' lengths are bodyv2's (the picture shows none of them), the
  height 1.63 m; the legs stand apart as MHR's do (the picture's are together: a pose, not a body); new characters
  still start on bodyv2.
- **The user, on the first candidates' front and side pictures: "Notice how sharp the angle is aroudn the waist to
  hips, we said we are moving away from low poly so make it more curved and natural like a realistic human body"**
  - So: **the picture gives the proportions, not the outline.** The first version matched its two width ratios and,
    with them, its corners: a straight run from the waist out to a point at the hip and straight back in (the outline
    turned 34 degrees within 4 cm there; bodyv2's and v2 hourglass's turn 17 and 18).
  - What changed: Hips & thighs is a long curve now (a long rise from the waist, a level stretch over the hip, a
    longer fall to the knee, measured from a smooth line), the seat grows evenly so it stays round, and the body
    carries less of the narrow Waist band and no thinned Thighs. The outline turns 17 degrees at the most; the waist
    is 0.49 and 0.52 of the widest row (the picture's 0.47 and 0.49): a little less extreme, on purpose.
  - GROW holds the curve (the turn), not only the ratios.

## 2026-11-13, the merge (the user, the morning after better mouths)

- **"ca you merge better-mouths back into the branch it was forked from, spin up a pr, then merge eyes-v3 into it
  too,"**
- `better-mouths` merged into `make-up-enhanced` (the branch it came from); the pull request is `make-up-enhanced`
  into `main` (tsukibii/HorrorEngine#27); `eyes-v3` (from `main`, beside the other two) merged into `make-up-enhanced`
  as well, so the one pull request carries all three.
- **My reading, to be overruled if wrong:** the pull request is into `main`, and it is not merged: that is the
  user's to do.
- **What the merge had to reconcile:** both sides added Studio doc sections numbered 2h and 2i: eyes v3's are now
  **§2k** (eye looks) and **§2l** (the lashes on the skin), make-up enhanced's stay §2h and §2i, the mouth §2j. The
  skin's makeup keeps both sides' additions (the highlighter and the lower liner's own colour; the lid's gloss and
  glitter): the lower liner is drawn in its own colour under the upper one, after the lid's gloss and glitter.

## 2026-11-13, better mouths: a v2 mouth interior, a real tongue, little gum, v2 lips (the user, with a picture)

- **"Can you branch off thr current branch you've been working on and call it better-mouths . Your goal is make a v2
  mouth interior that's more feminine and looks 1:1 with the image shared, even the person realistic tongue, note i
  hate gummy smiles, so for the big smile gums shouldn't be visible too much ( a little is okay), see if you can
  build. A new v2 lip shape too that rumbles the daz3d lips (vreate some variations) again only focus on female. If
  your overplayed open mouth matches the image 1:1  in 3d model shape, and is close in texture  then you can pass this
  new branch and will merge it into the current branch in the morning"**
- The picture: the neon reference's mouth close up, in a big open smile (the upper teeth showing under the lip, a
  rose tongue filling the mouth behind the lower teeth's tips, no gum). Kept out of git (`Saved/Mouth/ref/m1.jpg`).
- **The branch** is `better-mouths`, from `make-up-enhanced`.
- **What this sets:**
  - A **v2 mouth**: a young woman's teeth, a gum that a smile hardly shows ("i hate gummy smiles": a little is
    fine), a tongue that looks like one. New characters wear it; a character from before keeps its mouth.
  - **v2 lip shapes** after the Daz3D lips, with variations. Women's only.
  - **The test that passes the branch**: the open mouth laid over the picture matches it in shape, and is close in
    texture. So the branch carries the overlay and its numbers, not my word for it.
- **My readings, to be overruled if wrong:** "rumbles" is "resembles"; "overplayed" is "overlaid"; the open smile is
  also wanted as an expression to pick (it is what the overlay is made with).
- **Where the overlay got** (docs/CHARACTER_STUDIO.md §2j has the table; under the picture's light, ours laid on hers
  by the lips' outer points with nothing stretched): the lips' outer points within 1.8 mm, the opening 56.4 x 18.9 mm
  on hers 56.6 x 18.4 with the outlines sharing 0.82, teeth 25% and tongue 66% of the opening on her 22% and 63%, the
  teeth 45.7 mm across on her 45.1, no gum in either. Not 1:1: her smile is a little crooked and ours even, her
  teeth's edges run together, her skin and light are a render's. **Whether that passes is the user's call**: the
  side by side was sent to them, not kept in git (her picture isn't).

## 2026-11-13, the lashes (the user, with a marked picture, while eyes v3 was being checked)

- **"Once you're done I want you to fix the eyebrow issues that all eyelashes have where they don't sit on top of the
  skin (light clipping in the red circles), come up with a solution that knows how to place the eyelashes in more
  realistic manner and then bakes it for godot, eyelids only ever close / blink so it shouldn't be too intricate with
  the eyelid motions."**
- **The picture:** EYESV3's sheet on a phone, the eyes v3 character's eye in Godot, two red rings on the upper lid:
  a patch of skin showing in the dark lash band toward the outer corner, and along the lid's middle the band broken,
  a line of light skin between it and the eye.
- **My reading:** "eyebrow" is the eyelashes (the rings are on the lash line; the brows aren't in the picture). The
  ask is for every lash set, not only eyes v3's: lashes and the lash line that are on top of the lid's skin, placed
  from the skin itself, and baked into the export so Godot has nothing to work out; the lids only blink, so the
  blink's steps are all that has to be held.
- **What it was** (looked at close, with the lashes hidden and shown; measured on the export): the lashes are built
  from a few lines along each lid and swung with the lid as it shuts, while the skin they stand on is a mesh bent its
  own way by the eye's shape keys, the sculpt and the blink. A lash's root sat under the skin, so the hair seemed to
  start in mid air a millimetre down the lid; the lash line's strip cut chords under the lid's rounded rim. On the
  eyes v3 character 2,440 of the lashes' 21,398 points near the skin were under it at rest, 3,794 with the eye shut
  (1.2 mm deep), and 54 of the lash line's 330.
- **Built the same day** (`tools/character/lashfit.js`, docs/CHARACTER_STUDIO.md §2l): after the lashes are made they
  are fitted to the lids' own skin as it is in that state: the lash line's every point put on the nearest skin, a
  hair's breadth off it; every point of a lash that is under the skin (or nearer than a hair's breadth) lifted out to
  it, the rest of the lash left as made. **Baked for Godot as the export's last step** (`bakeLashFit`): the file's
  own skin round the eyes is put together in each state of the blink as Godot will put it together, the file's lashes
  and lash line are fitted to it there, and their blink targets written again from the fitted states, so each target
  holds lashes lying on the lid as it is at that weight: nothing for Godot to do. (The Studio's own fit per state
  wasn't enough: a file moves each lash whole with its root through the blink, which put some back under the shut
  lid.) Where the two lids' margins press together, shut, a lash between them has no place a hair's breadth off
  either and is hidden by both: it's put on the skin it's under, between the two, and counted. LASHFIT (`node tools/character/lashfit_check.mjs [--person NAME]`)
  holds it on a made-up lid and on an export, at rest and at every twentieth of the blink.

## 2026-11-12, make-up enhanced: presets as cards, three more heads, two more bodies, then the makeup (the user)

- **"Create a new branch called make-up enhanced. before you research and work on the make up, is there any reason we
  dont have the new face shape as a preset thumbnail similar to the monster presets ?If w can have it as a thumbnail
  preset that we default to just do that, same with the body (body preset shouldnt override the face), maybe create
  some thumbnail categories for, monster as we have now (untouched), heads, and bodies. For heads can you look through
  our previous daz references (I think there were 4 heads) and make an aligned one for 3 of them . For bodies, keep the
  new v2, but also create alterations of the v2 where its more skinny (sports muscular woman), and more hourglass one.
  I dont need any male presets , just focus on feminity. For makeup, I want better makeup, analyze the daz images I
  shared earlier and re-create those makeup looks 1:1 (the same lip gloss, shines etc, )"**
- **The branch** is `make-up-enhanced` (a branch's name can't hold a space), from main after pull request 26.
- **The answer to "is there any reason":** no good one. v2female and bodyv2 were built as two more Base buttons with
  a switch each, off for new characters, because when they were made nobody had asked for the default to change
  (DECISIONS 2026-11-12, v2female; a T-pose reference). Nothing technical stood in the way of cards.
- **What this sets:**
  - The Body tab has **Presets** in three categories: **Heads**, **Bodies**, **Monsters**. Monsters are the creature
    cards as they were, nothing about them changed. The two Base buttons and the two switches are gone: their
    presets are cards.
  - **A head preset changes the head and the neck only; a body preset changes the body only.** Neither sets a
    slider of the character's own. Each category has a *Plain* card (MHR's feminine base).
  - **New characters start on v2female's head and bodyv2's body**, on the feminine base, 1.63 m. Characters saved
    before keep what they had (a file with the old `v2` and `b2` opens on the same two presets).
  - **Heads:** three more, each held to one of the other Daz faces as v2female was to hers.
  - **Bodies:** bodyv2 stays; two alterations of it: slimmer and athletic (a sporty, toned woman), and more
    hourglass. **No male presets**: femininity only.
  - **Makeup** after that: the Daz pictures' makeup looks re-created 1:1 (the lip gloss, the shines).
- **My readings, to be overruled if wrong:** the presets are what the *feminine end* of the base becomes, so picking
  a card on the Average or Masculine base moves the base to Feminine (and says so); a body card doesn't change the
  height you set; Neck length is the one slider a body preset may carry (how high it carries the head): bodyv2 has
  it from its picture.
## 2026-11-12, eyes v3 (the user, with two pictures of their own render)

- **"Create a new branch called eyes-v3, see if you can re-create in our studio creator -> godot (including optimizing
  our already use of the godot eye shader we made) and re-create this eye look 1:1 > Its a screenshot of what I was
  able to create in Unity + Blender. Your objective is to create that exact eye look including the eyelashes and
  eyelids and exact eyes (Pupils, the whites), your goal is to get as close to 1:1. For the new eye worker I want you
  to create a thumbnail icon for it similar to the icons we have in our monster presets. Once you accomplish this eye
  look, make it easy to modify some things via sliders (different iris shape / patterns, colors etc). Your main
  objective is to get this exact eye look in godot, for the eye preset try get the exact eye shape too on the
  metahuman. I gave you image 2 in case you want to reference the face / head shape too in your quest to get that eye
  look."**
- **The pictures** (kept out of git, `Saved/Eyes/ref/eyes.png` and `face.png`: they have to be sent again in a new
  session): both eyes close, and the face. Big, very dark red-brown irises the pupil melts into; on each two crisp
  catchlights (a big one up and to the picture's right of the pupil, a small cool one across from it, the same side in
  both eyes) and a thin bright arc low on the cornea, just above the lower lid; cool, bluish whites shaded under the
  upper lid, a pink inner corner; a long almond opening, its outer corner a little higher, the upper lid resting low
  over the iris with a thin fold close above the lashes; the upper lashes a soft dark band more than hairs, a silver
  shimmer on the lid above them; the lower lashes long, fine and sparse, in little points down the skin; rose round
  the eye, a wet pink waterline. The face: porcelain skin, a blunt black fringe and two tails.
- **What this sets:**
  - **The look is to be matched in Godot**, from a character made in the Character Studio and exported: the eyeball
    (iris, pupil, white, catchlights), the lids' shape and the lashes. Godot is the objective; the Studio is where it
    is made.
  - **The eye look is a preset in the Studio with a picture on a card**, as the creatures are.
  - **Sliders afterwards**: the iris's colours, its pattern, the pupil's shape and the rest changed easily, in the
    Studio (it has them) and in Godot.
  - **The Godot eye shader may be reworked** for it, and made cheaper where it can be.
- **My readings** (to be overruled if wrong): "the new eye worker" is the eye look's preset (the card); "the
  metahuman" is our own MHR character (the v2female base: the picture's face is the Daz character's the hair editor's
  twin tails were matched on); the sliders are wanted in Godot too, since Godot is the objective.
- **Built the same day and the next, on `eyes-v3`** (docs/GODOT_LOOK.md §5v, docs/CHARACTER_STUDIO.md §2k):
  - **Godot's eye shader, v3**: the eye's axes read once per vertex and everything else worked out from the eye's own
    shape per pixel (a true sphere's shine whatever the mesh, an eye drawn that can differ from the mesh); **catchlights
    that stay** (two lights that follow the camera reflected in the cornea, the lower lid's wet line under them, lit by
    whatever light reaches the eye, or glowing by themselves); the room's own lamps dimmed in the cornea when asked;
    the white's brightness and warmth (cool below 0); the eyeball's room behind the lids as a push of its vertices, so
    the depth test throws out what the lids hide before the shader runs (it wrote its depth per pixel before).
  - **`HSEyePaint`**: the Studio's own paint (iris, pupil, limbus, white) ported to Godot's shading language and held
    to the Studio's by a check; a change to any number draws the eye's picture again, once, into a small viewport, so
    the eye costs what it cost. **`HSEyePicker`**: the sliders (the look viewer's Eye sliders), `HSEyeLook` a saved
    eye, the HSCharacterLook node's Eye paint in the Inspector.
  - **The Studio**: eye looks as cards with pictures (Face, Eye looks: `eyelooks.js`, `eyelooks.mjs thumbs`), the
    first of them **Eyes v3 (dark doll)**; a lash style of its own (a soft band above, points below: Lower lashes in
    points); lid gloss and lid glitter in the makeup; the Opening shape key down to -2.5 (a heavy lid); the beauty
    light.

## 2026-11-12, the ringlets (the user, with a screenshot, while the styles were being gone through)

- **"Not sure if you caught it but the curls look like they float rather than come from the head/hair"**, with the
  side view of *Long, with ringlets in front* before and after the look's change: the ringlet in front of the cheek,
  its top a blunt coil at the nose's height, no hair leading into it.
- I had not caught it. **What this sets:** a ringlet has to read as hair that comes from the head: a lock from the
  hairline, wound up. Not a coil hung beside the face.
- **Done the same day** (docs/HAIR_V2.md §3.7): each side's face-framing strands are one gathered lock that ends in
  a point, the ringlet begins at that point as thin as the lock and opens into the coil over three centimetres, it
  is kept off the body by its own width at each height (no step sideways at its top), and its colour goes on from
  the lock's, not from the roots' shade. On *Long, with ringlets in front* the lock hangs free from the temple, so
  the ringlet hangs in front of the ear at the edge of the side hair. HAIR2 holds it (two lines).

## 2026-11-12, the lessons into every style (the user)

- **"Can you take everything you've learnt from the last hairstyles and enhance improve v2 hairstyles"**
- **What this sets:** what the two Daz3D hairstyles taught (`daz_twin_tails`, `daz_bob`: docs/HAIR_V2.md §10, §10b)
  goes into the hair editor v2.0's other styles, not only into the two that were matched. The hairstyles named are
  the same ones; none is removed or renamed.
- **My reading of "everything you've learnt"** (to be overruled if it's wrong): the settings those two needed and no
  older style uses (tied hair that hangs and has body, tails as brushes, sidelocks that hang free, a fringe closed
  at its middle, a bob tucked under, the fuller Volume), and the way of working (a style judged by its pictures
  from four sides before and after, not by its numbers).

## 2026-11-12, a T-pose reference: base bodyv2, and its hairstyle (the user, with a picture)

- **"I just made this t pose reference for what the body should look like (I added clothes to keep it appropriate
  since daz3d does show nudity), once you're done with hair and face feel free to create a base bodyv2 that aims to
  get these exact proportions, 1:1 but don't calculate the clothing (mostly the cardigan and sneakers), as a goal try
  recreate this exact hairstyle too so you can see if it's possible to get a 1:1, for reference this mesh is the
  medium size (slightly chubbier side) so imagine the bust and waist width sliders around mid for this basebodyv2."**
- **The picture:** a Daz3D character from the front in a T-pose, the whole body: a short black bob with a side-swept
  fringe over her right eye, glasses, a brown knit cardigan to the hips, black leggings, white sneakers. Kept out of
  git (`Saved/Body/ref/t1.jpg`: it has to be sent again in a new session).
- **What this sets:**
  - **A base `bodyv2`** in the Character Studio: a body base whose proportions are this picture's, measured, 1:1
    (the head against the body, the neck, the shoulders' width and height, the arms, the torso, the hips, the legs).
    The clothes are not the body: the cardigan's thickness and looseness and the sneakers' soles are taken off the
    measures; the leggings are skin tight and count as the body.
  - **Where its sliders sit:** this body is the medium size, slightly on the chubbier side. On bodyv2 that build is
    the middle: the Bust and the waist's width at about 0 are this body, so a slimmer and a fuller character are
    each a slider's half away.
  - **Its hairstyle** as a hair editor v2.0 style, held to the picture the way the twin tails are: can it be 1:1.
  - **When:** after the hair and the face in hand.
- **And, a moment later: "Note when I say proportions for v2 I mean thighs and legs too and hands and feet."** So
  bodyv2 is the whole body's proportions, not the torso's alone: the thighs' and the calves' widths and lengths (the
  leggings are skin tight: what the picture shows is the leg), the hands' and the feet's size (the feet under the
  sneakers: their length from the shoe's, less the shoe).
- **Not decided here (my reading, to be checked with the user if it matters):** whether bodyv2 replaces v2female's
  body or stands beside it. Built as its own base beside the others, v2female's head on it, nothing removed.
- **Built the same day** (docs/CHARACTER_STUDIO.md §2g): a fifth base button and a switch, *what the feminine end's
  body becomes*. MHR's body shapes and the Studio's sliders fitted to the picture's own measures (the legs' widths
  at 42 heights within 0.28 cm, the trunk under the cardigan within 0.84, the wrists, the eyes, the chin, the knee
  within a centimetre). Round it: bust 101 cm, waist 82, hips 113 on a 163 cm body.
- **Three things the picture cannot settle, said so the user can overrule them:**
  1. **Her arms are about a sixth shorter than a real person's of her height** (the wrists 58 cm from her middle;
     MHR's 66). The cuffs' ends are straight, so the arms lie in the picture's plane, and its round buttons are
     round, so it is not stretched: I took the picture at its word (Arm length -1.75). If that is the pose or the
     camera, it is one slider.
  2. **Front to back.** There is no side picture. The belly's, the bust's and the seat's depths are a medium
     build's for these widths, chosen by me.
  3. **The hands and the feet.** Her hands are half closed in long cuffs and her feet are in sneakers: ours end where
     her fingers do and stand inside her shoes; their sliders are left at 0.
- **Found on the way and fixed for everyone:** the elbow and the ankle never followed an arm or a leg made longer or
  shorter (their skin is on twist bones, so the rig found them no ring). They do now, along the limb's own line.
- **Its hairstyle** (docs/HAIR_V2.md §10b): `daz_bob`, on bodyv2. The outline is within about half a centimetre of
  hers from the crown to the tips, which is all a head 160 px tall can say; the fringe's locks and the tips are not
  hers. So: the shape, yes; a 1:1 of the locks needs a close-up of the head. It needed one new slider, *Tuck under*
  (a bob's sides lying in toward the jaw), and the Volume sliders to go to 60 mm.

## 2026-11-12, necks: a slider to make them shorter (the user)

- **"If we don't already have a modifier make sure we add a modifier / slider in general to make necks shorter, I've
  noticed most of the models look like they have unrealistic turtle length necks, which is fine since some people
  have long necks but a lot of Asian people don't."**
- **There was one:** *Neck length* (grow.js, a proportion: the head comes down whole and the neck's skin with it, the
  shoulders stay). It was filed under Proportions, away from the neck's other sliders, with a help text of five
  words. **Now:** it is listed in **Body**, right after Neck and Neck width, and says what it does: -1 is about
  2.5 cm off an adult's neck (the chin 4.2 cm over the pit of the neck where the feminine base has 6.6), +1 as much
  longer. Its circle on the neck's front is as it was.
- **Measured, the chin over the pit of the neck** (bodies at their own heights): feminine 6.6 cm (0.32 of the head's
  height), average 6.2 (0.29), masculine 5.3 (0.23), **v2female 7.5 (0.39)**. So the long one was the base I made:
  its short lower face had raised the chin a centimetre and left that centimetre on the neck, and its neck is slim,
  which reads longer still.
- **v2female carries Neck length -0.35 now:** the head 0.8 cm lower, the chin 6.7 cm over the pit of the neck
  (0.34 of its head; the feminine base 6.6). Held to the pictures, not to taste. In the front picture, by the fitted
  camera, her collar's top edge on her left shoulder is at 316 px (columns 880 to 960); our bare shoulder was at 330,
  a centimetre under it, and is at 316 now. The skin has to be under the cloth, so that picture alone says -0.25 or
  so; in the three-quarter picture her bare shoulder is higher than ours even at -0.4 (her arm may be up there: it
  says -0.4 to -0.6, or a pose). -0.35 is between the two. The T-pose reference of the same day, read roughly, has
  the chin about 6.8 cm over the pit of the neck.
- **The other bases are left as they are:** by these numbers they are not long, and the user's "which is fine".
- **A rule for me from this:** when one part is made shorter, say where the length went. The lower face got shorter
  by lifting the chin; the neck took it up and nobody asked it to.

## 2026-11-12, v2female's neck and shoulders (the user, on seeing the base, twice)

- **"Could you modify the shoulders and base of neck to match that shape of the head and thinner neck, looks a bit
  uncanny when it should look more feminine."** I answered it from my own idea of feminine: a longer neck, the
  shoulders sloped and narrowed, and showed that.
- **"Instead of doing the long neck in a similar way you're matching the face and hair to the original, try match the
  neck shape to the shoulders in a same way."**
- **What this sets:** the neck and its join to the shoulders are held to the user's pictures, as the face and the hair
  are: measured in the fitted frames, not styled. The long neck and the sloped, narrowed shoulders are taken out.
- **What the pictures say** (the front one and the three-quarter one; docs/CHARACTER_STUDIO.md §2f): her neck is a
  straight column from under the ears to the collar, about 9.3 cm across where ours was 10.2 to 11 and flared at its
  top; her shoulders' line is where MHR's already was, within the thickness of her collar (her head sits close on
  her shoulders: nothing like a long neck); the rise from shoulder to neck is a little lower beside the neck.
- **What the base carries now:** Neck width -0.7, reaching up under the ears and behind the jaw; Neck base -0.3;
  the shoulders as the feminine base's. From the chin's level to 2.5 cm under it the neck is within about half a
  centimetre of hers.
- **Left in as sliders, not used by the base:** Shoulder slope (made for the first answer). Neck base is used.
- **A rule for me from this:** when the user says a part looks wrong and there is an original, the original is
  measured before anything is designed. "More feminine" was a description of the fault, not a brief.

## 2026-11-12, v2female (the user: "lets create a v2female base")

- **"lets create a v2female base."** After the finding below (the 1:1): the error left by the twin tails' ties is the
  head's and the neck's, not the hair's.
- **What this sets:** v2female is a base in the Character Studio's Body tab now, beside Feminine, Average and
  Masculine (docs/CHARACTER_STUDIO.md §2f). It is *what the feminine end becomes*: the feminine base's body, and a
  sculpt of its own for the head and the neck (a slender neck, a short narrow lower face, eyes larger and further
  apart, a smaller nose and mouth), after the proportions of the user's Daz3D characters. A button picks it; a switch
  under the buttons turns it on or off for a character already made. As asked ("which still allows face sculpting
  etc"), it is a starting point and nothing is locked: every identity slider, every sculpt control, the ages, Cutify,
  Monster mode, Anime, a face fitted to a picture all go on top of it, as on any base.
- **What had to be made for it:** two controls the sculpt lacked, both for anyone. MHR's neck could not be slimmed
  (the sculpt's *Neck* is the throat under the jaw alone; the feminine base's neck is 10.3 cm across at its
  narrowest): **Neck width** (Body) makes the whole neck slimmer or thicker about its own axis, from the shoulders
  to under the jaw and the skull. And nothing narrowed a face toward its chin without leaving a ledge: **Face taper**
  (Face) narrows the face from the eyes down, every height in the same proportion.
- **Corrected the same day, and why it matters:** the first version carried Neck width at -1 (a neck of 7.4 cm), from
  a width I had read off her picture by eye as "about 7.5". Laid against two of her pictures with fitted cameras, both
  edges of her neck are there and it is 1.27 times as wide as her eyes are apart; ours at -1 was 1.10, and dented at
  the nape from the side. The base carries **-0.4** (9.0 cm on the 1.63 m body GROW measures, 1.34) now, a face 1 cm shorter under the eyes and narrower with it, a
  smaller mouth. The landmarks land 3.4 and 2.8 mm off in the two pictures (4.7 and 3.7 before).
- **Mine, not the user's:** it is **off for new characters**, which start where they always did (halfway between the
  bases). Nobody asked for the default to change; say so if every new character should start on it. Characters saved
  before are untouched (the base is kept with the character as `v2`, absent when off).
- **Not judged yet:** the look of it. It is held to two pictures by the places of the eyes, the nose, the mouth, the
  chin and the ears and by the jaw's and the neck's outlines, bald and unlit as she never is; her eyes are far larger
  than the base's, her right ear leans more, her shoulders begin lower. The user's eye is the judge.

## 2026-11-12, the 1:1 (the user, on the first matched comparisons of the Daz twin tails: be a perfectionist; a v2female base)

- **"I need you to be even more of a perfectionist, for this image your goal is to re-create a 1:1 of that hairstyle
  meaning including the volume, curvatures etc, this is so you can figure out the system for aesthetic hair and apply
  that later to the rest of our styles, I really need you to be a perfectionist for the above style."** The image: the
  fifth Daz picture (the blunt fringe, low twin tails, long sidelocks; the same hair in the first and in the second's
  right half).
- **What this sets:** that one hairstyle is the target, every part of it, and it is held to its picture, not to my
  description of it. The work goes: a rig that puts her picture and ours in one frame (the same camera, the same
  scale, her outline over ours, numbers by height), a written list of what differs, the biggest first; where the
  system can't make a part, the system is changed. What is learnt is then carried to the other styles; that part is
  not done yet. docs/HAIR_V2.md §10 is the state: what is matched, by how much, and what isn't.
- **"If required to make these hairstyles work feel free to create a better preset base head shape called v2female
  (which still allows face sculpting etc)."**
- **What this sets:** a base called v2female may be made. So far the hair engine has not needed one: hair grows on any
  body. What it is used for now is the comparison: the pictures are matched on a body with the proportions of the
  user's Daz characters, kept as plain sculpt values under that name (`tools/character/grow.js` `V2FEMALE`: the
  feminine base, a shorter rounder face, a full bust; `bodyByName("v2female")` in node). As a base to pick in the
  Character Studio's Body tab it is **not built yet**; it is the next step there, with every slider still moving
  from it. *(Built since: the entry above.)*
- **Found since, and it meets the user's condition ("if required"):** it is required. The error left by the tie in
  both pictures is the head's: at the tie's height her head is about 9.1 cm wide and her neck 7.5, the test body
  13.0 and 12.0, and the sculpt's jaw and neck at their furthest move that by 2 mm (HAIR_V2 §10, item 8). A base
  with a lower face and a neck of that kind is the next piece of work; the hair by the tie is not judged closer
  than 2 cm until it exists.

## 2026-11-12, the sides (the user, on the first whole pictures of the Daz baseline: the sides' curve and volume)

- **"You're making the bangs really good but note that I really want you to be able to emulate the curvature of the
  sides, look at the first image screenshot you made and compare it to the curve and volume of her sides, we really
  want to have a system that can emulate that daz3d hair look as 1:1 as possible."** Said of the baseline of the
  fifth picture (blunt fringe, low twin tails), as it is and drawn crisply.
- **What this sets:** the fringe's direction is right to carry on with; the sides come first now. Her hair comes down
  from the crown round the side of the head in a curve and tucks in to a low tie; ours beside it is a wide flat
  shape with a corner at ear level. The system has to be able to make her sides, not only this one style: a setting
  that only happens to fit one picture isn't it.
- **Where it stands:** nothing built for it yet; this much found. Her side, traced on her picture: out gently from
  the top, widest at eye level, in by about a centimetre and a half to a small tie under the ear. Ours as first
  made (a hood, widest at the tie) was my settings: a thick tail, the tie far back, pulled tight. With the sliders
  there are (ears covered, the tie right at the ear and at its lowest, a thin tail, the hair left loose) the side
  comes close to hers from the front and from three quarters. What it can't do: show her ear below the side hair
  (with the ears out, the tied hair goes round the ear in a kinked detour), and shape the volume (one handle, loose
  to tight). Those two are the work for this.

## 2026-11-12, after the very last (the user: exact replicas of their Daz3D hairstyles; be extremely critical)

- **"Can you create these hairstyles. Be extremely critical, unlike the other hair styles if something is preventing
  you from getting a 1:1 of these ones you need to update the v2 hair system so they can be achieved (or even make a
  new v2B system), I want an exact replica of these hairstyles I made in daz3d, you can see they look similar to the
  particle system we already use so its up to you to figure out how to actually get each of these hairstyles, they
  should be modifiable (strands length, etc)."** Five pictures, seven hairstyles (kept in `Saved/Hair2/daz/ref/`,
  never in git): piecey blunt bangs with a red streak, long thin sidelocks and low twin tails; long straight hair
  with long wispy bangs and sidelocks; full blunt bangs with low twin tails and red ties; long straight hair with
  see-through bangs and the ears out; blunt bangs with the hair gathered at the sides under red ornaments with
  tassels, and sidelocks (that picture is small and soft: whether there are buns under the ornaments can't be seen
  in it); a short rounded bob with full bangs; full blunt bangs with red streaks, long low twin tails in front of
  the shoulders and thin sidelocks. Read at full size they are four kinds: the blunt fringe with low twin tails and
  long thin sidelocks (three of them: hair from the crown with no parting, the fringe dense above and in separate
  locks below, small ties); long loose straight hair with a see-through fringe (two); the bob; the ornaments.
- **What this sets:** these are held to their pictures, side by side, with what still differs written down each
  round; a likeness that is "recognisable" is not enough here. Where the system is what stands in the way, the system
  changes. Every style stays a style of the editor: its lengths and the rest on sliders.
- **Where it stands (not built):** a first baseline of the last picture beside the picture. The shape is roughly
  there; it is far from a replica. Tested, not assumed: the editor pushed to its limits (high detail, 2600 pores,
  narrow cards, 120 loose strands: twice the triangles) barely changes how the hair reads. That showed only that more
  cards don't help; I first wrote here that real strands over the cards were therefore needed, which it didn't show.
  Tried since: the same cards drawn crisply (no dithered coverage, no side fade, no softness) turn the fringe from a
  see-through haze into a dark mass whose edge breaks into separate tips, by eye, in one still picture, not yet at
  the reference's own scale. So how the cards are drawn matters more than how many there are, and whether real
  strands are needed at all (for the sidelocks, the tails' edges, flyaways) is not decided. Also needed, and these
  stand: a way to dye one chosen lock
  (the red streak: the streaks there are put red on the sides and tails instead); a fringe that is dense above and
  parts into strands below. The choice between changing v2 and a v2B was left to Claude; this is its finding, the
  user hasn't seen the pictures yet. The pictures here are 960 x 720 on a CPU: some of the softness is the renderer.

## 2026-11-12, the very last (the user: an Advanced category, about five intricate, aesthetic women's styles)

- **"Can you experiment with more intricate/advanced pores and curves like the references (for the same hair) to get
  more advanced hairstyles as shown in the images, have this under an advanced category. Try create maybe 5 very
  aesthetic female hairstyles (you dont need to do the spikes but a few strands might add some realism)."** And, of
  the four pictures: **"note the images I passed you is just 1 reference image with different in-progress angles."**
  One hairstyle, then: its guide curves over the scalp sweeping into a bun, its long strands in front of the ear, the
  strands standing out of a bun, and the render (violet over black, a heavy blunt fringe, two buns, long tendrils).
- **What it asks of the editor**, each a setting with its slider: tied hair that leaves its roots the way it's combed
  and bends round to its tie (Sweep), or winds in to it (Swirl); strands standing out of a bun, soft to spiky; the
  face-framing strands gathered into pointed tendrils, each its own length, with an S along them; thin wisps left out
  by the ears; a heavier fringe that can round down at its sides; and a second colour: all of it, streaks, the
  underside, the top, the front pieces, the fringe, one half, the ends, with the roots or the ends left natural.
- **Where it stands (in the tree, not finished, not committed as done):** six styles under *Advanced*. The second
  colour is drawn in Godot and in the Studio's tab. By Godot's pictures two are right (half-up buns with blonde front
  pieces; a dip-dyed ponytail), and four have faults left: both bun styles' streaks still show card-shaped flecks
  close up, the underside colour fans out at the nape, a platinum half is flat and chalky. Spikes were not asked for;
  the strands are.

## 2026-11-12, last (the user: long hair ends with just its tips on the shoulders)

- **"Can you modify the long hairs so they're just barely on the shoulders (just the tips)."** So every long style's
  cut is at the shoulders (`cut.line: -0.14`; the shoulders' tops are -0.135): twenty-four styles brought up, the
  tails of the tied ones shortened to match (their tips at the shoulders), the ringlets to the shoulder. This is the
  styles' own lengths, not a wall: the sliders still go down to the chest (the go, 2026-11-11). It also brings the
  first rule back ("dont make the hair too much longer than shoulder height as this may cause clipping with clothing
  later").

## 2026-11-12, later (the user, while the hair editor v2.0 was being built: Japanese and Korean styles, and a chart of twelve drawn hairstyles)

- **"Can you do some more Asian variations where the girls front and side hair is above shoulders slightly below ears
  but then back is longer and other Asian variations."** So a cut can have **two lengths** (`cut.tiers`): *the front
  and sides shorter, the back long* (the shorter line as far round the head as `frontTo`, a step or a slope) or *a bob
  over a long nape* (the jellyfish cut: everything cut at the shorter line but the hair that grows on the low back of
  the head). And a tie can take **the top's hair only** (`ties.part`, and the kind *Two side up*). Eight styles in a
  group of their own (*Japanese and Korean styles*): sides just under the ears with a long back; hime with sidelocks to
  the jaw; the jellyfish cut; a wolf cut; two side up; odango; long with C-curl ends and see-through bangs; a lob with
  the ends flipped out.
- **"Can you try recreate as close as possible a preset for each of these more animals hairstyles"** (read as *anime*:
  the picture is a drawing chart of twelve hairstyles, three by four; it stays on the user's side, not in git). A
  preset for each, in a group of their own (*Drawn hair: the chart's twelve*), row by row: long and straight with
  bangs to the eyes; shoulder length with the ends flicked out; hime; long and tousled with an ahoge; a side ponytail
  with straight bangs; a bob with the fringe over one eye; pigtails; a short bob with parted bangs; long with ringlets
  in front; twin buns with the hair down; short and spiky; short with two small low tails. What they needed that the
  engine didn't have, all sliders now: a **choppy** fringe (each lock its own length) with a longer **centre lock**; a
  fringe's **slant** (longer toward one side: hair over one eye); a tail **to one side** (`ties.offset`: a side
  ponytail); **ringlets** (`fringe.frameCurl`: the face-framing strands wound into a drill a side); an **ahoge**.
  A look-alike is the user's to judge, part by part (LESSONS): Godot's pictures of the twelve are in
  `Saved/Hair2/t5*.jpg` while they were made; the cards' pictures are the thumbs.

## 2026-11-12 (the user, while the hair editor v2.0 was being built: long hair with the ears out)

- **"Could you do some female hairstyles where the ears aren't covered but the hair is still long (so the ears poke out
  cutely), a couple of variations."** So the ears have a third way to be worn beside *covered* and *clear*:
  **tucked** (`ears: "tucked"`, or one ear: `tucked_left`, `tucked_right`): the hair that comes down the side of the
  head turns back along the hairline, passes over the ear's top and falls behind it, never across it; what grows in
  front of the ear below its top stays as a few short wisps. And where the tucked hair goes then is a choice
  (`tuckFall`): **over the shoulders, in front** (it comes forward under the ear and hangs in front of the shoulder to
  its cut: long hair seen from the front, the ears out above it) or **behind the shoulders**.
- **Five styles** in a group of their own (*Women's, long with the ears out*): long and straight; see-through bangs
  with sidelocks (the ear between the sidelock and the lengths); a side parting with one ear out; loose waves; half-up.
  Judged in Godot's pictures as the rest are (`Saved/Hair2/t3.jpg` while they were made).

## 2026-11-11, the go (the user: build the hair editor v2.0, all of it, until it looks really good in Godot)

- **The answer to the plan's questions**: **"v2 should be in the character creator studio tab, let it reach the chest
  (might be ok for some clothing, we can adjust always with a slider the length), 3 sure, 4 sure. Start working on
  everything and dont stop until it looks really good inside godot and runs well."** So:
  - **It's a tab of the Character Studio** (Hair editor v2.0, beside the salon's Hair tab), as planned.
  - **Hair may reach the chest**: the length is a slider, and its end is the chest (loose hair and tails both), not the
    collarbones the plan had. The first rule ("not too much longer than shoulder height") is now the styles' default
    lengths, not a wall.
  - **About 20,000 triangles of hair** by default: yes. **Braids, beards, hair under hats**: later, yes.
  - **No stops for review**: the plan's "stop for the user's answer" after each sheet is lifted by the user. Build
    every step; judge it in Godot's own pictures until it looks really good there; measure that it runs well (the
    Studio's regeneration time, the triangles and the frame's cost in Godot).

## 2026-11-11, after the very last (the user: a hair editor v2.0, planned before it's built)

- **The ask**, with five reference pictures (a sleek middle-part bob, low twin tails with a swept fringe,
  shoulder-length waves from a side parting, a short cut with a long swept fringe, a chin bob with see-through bangs):
  **"Analyse our character studio hair creator, I really love how I can make the hair and it looks really good in
  godot but there are often small gaps etc, can you make a new tab called hair editor v2.0, instead of me having to
  create the strands, add pre defined hair pores all around the head and sliders I can adjust to change the shape.
  Aim to be able to re-create all the hair styles in the images provided. Maybe vary the hair line pore shape so we
  can get slight variations (this should be a dropdown), your goal is to be able to recreate each hair in the image
  1:1 and preview it in godot to make sure it looks good."**
- **A new tab, not the Hair tab**: "the hair maker shouldn't exist in the current hair tab, should be a full on new
  tab like clothes etc". The salon stays as it is.
- **What it must reach**: "pigtails, tied up hair, curly long hair etc ... replicate/simulate each of the hairstyles
  in the images + more (more traditional male ones, balding, long)".
- **A length cap**: "don't make the hair too much longer than shoulder height as this may cause clipping with clothing
  later".
- **Plan first**: "Come up with the detailed plan first on how you will achieve this new hair creator, then ask me to
  start on implementation." So nothing is built: **docs/HAIR_V2_PLAN.md** is the plan (the salon analysed, the
  pictures taken apart, the design, the tab's controls, the build in steps with a stop for the user's answer after
  the first sheet, the checks, the limits).
- **Claude's calls in the plan, the user's to overturn** (its §5): v2 beside the salon with a switch on each character
  for which hair is worn; loose hair to the collarbones at most, tails up to about 25 cm from their tie (picture 2's
  reach the chest); the first sheet is picture 1's bob, picture 4's short cut, a man's side parting and a thinning
  crown, with the hairline shapes as dots on the head; about 20,000 triangles of hair by default; braids, beards and
  hair under hats later. The pictures stay on the user's side, not in git (other people's renders).

## 2026-11-12, the bed (the user: "Why does the blanket and pillows float above the bed")

- **Why**: the kit's bed (`tools/director/kit.js` `bedGen`), not the seats. Measured in the hotel's export: the duvet
  was a stiff lens 6 cm thick ending level with the mattress's rounded edge (its rim at 0.448 m, the mattress's edge
  top at 0.449 m and falling away), so a line of shadow ran under it all round; and a pillow's pinched rim is at half
  its height, so with its belly on the mattress its rim stood 6 to 7 cm above it.
- **Fixed in the generator** (every bed in every set and game, on its next build or export): the duvet lies 2.5 cm
  into the mattress and **hangs down its sides and its foot** onto the frame (three thin panels, inside the bed's own
  size: no collider or layout changes); a pillow's rim rests 3 cm over the mattress with its belly pressed in.
- The ready-made hotel floor was **made again** (`godot_byhand.py ready`), and the tutorial's pictures that show the
  bed. KIT passes.

## 2026-11-12, after the intensifiers (the user: things that disappear and come back, and flags a quest can switch)

- **"if we dont have already can you create a script that makes objects disappear (not deleted just disappear
  visually), so we can trigger an event that makes it look like the table looks different or something is missing,
  we should also be able to make objects appear back, and be able to start them in game from either state, so I can
  reuse the same droppable script for appearing. Appearing can be quest based or flag event based, ideally quests
  can trigger variable flags on/off, should be easy to make new flags."** We had only pieces (a scare area's Appear
  and Hide, `moved.gd`'s vanish). Now, in the starter kit:
  - **`shown.gd`**, one script for both ways, on a thing or as a child of it. **`shown`** is how it starts (there or
    not). It changes by **`fire()`** (any area's, cue's, scare's or moment's Target, or a signal: `on_fire` toggle,
    show or hide), by **the Story's words** (`shown_when`: there while they hold: `task:key` once that task's ticked,
    `on:key` while it's on the list, a flag's name, `!flag`; `hidden_when` the other way), or from a script
    (`appear()`, `vanish()`, `set_shown`, `toggle`). **`when_unseen`**: only while you can't see it, so you look back
    and it's different. **`also`**: more things with it. **`swap_with`**: things there only while it isn't (the same
    table laid another way, in the same place). `fade_secs`. Nothing is deleted: it's hidden and its own colliders
    are off with it.
  - **Flags.** A flag is a fact the Story keeps, on or off; **a new one needs no list: the first thing that names
    it makes it.** The Story got `set_flag(name, on)`, `toggle_flag`, `switch_flags("+a, -b, ~c")`, the signal
    `unflagged`, **`flags_start`** (on when the game starts) and **`task_flags`**: what a task switches, a line each:
    `"key: +table_gone, -lights_ok"` when it's ticked, `"added key: +searching"` when it's put on the list.
  - **`flag_switch.gd`**, a node for the same: its `flags` (`+name`, `-name`, `~name`), done by `fire()` or by itself
    when the Story's words come to hold (`when = "task:key"`), `again`, `needs`.
- MIND plays them. **Not done**: a piece of an interior's export stays solid when hidden (it's part of its room's one
  collider; a prop you placed yourself isn't); Director and desk games.
- **"include it as part of the tutorial v2"** (the next message). In tutorial v2's game and its guide (§23, *Things
  that aren't where they were*): the hotel's **slippers**. A pair just inside 304's door; once the knocks have come
  (the fact `knocked_304`) and only while you can't see either place, it's gone and a pair is beside the bed, toes to
  it (`hidden_when`, `when_unseen`, `swap_with`). And a pair outside 308's door that isn't there when you come up
  (`shown` off): there once 304's found, by the flag `checked_in`, which the Story's Task Flags switch on when
  `find304` is ticked. TUTORIAL2 plays both; a picture of the pair by the bed. The flag switch node is described
  there, not placed.

## 2026-11-12, after the seats (the user: more intensifiers; a light that flickers on her, phasing, "am I going crazy")

- **"an npc, if you flash a light it has a boolean that if a light faces it the light flickers (including
  flashlights) but not counting maybe atmospheric lighting like moonlight."** The starter's **`flicker_lit.gd`**,
  under her: `enabled` is the boolean. Every lamp whose light **reaches her** (in its reach, in a spot's cone,
  nothing solid between) and your flashlight when **its beam is on her** falter, and are themselves again the moment
  they're off her. Never a DirectionalLight3D (the moon, the sun), a light in the group `hs_ambient`, or one in
  `ignore`. Three ways: `flicker` (dips, at most 2.5 a second: the flash limit), `dim` (it sinks while it's on her),
  `die` (it fails, goes out after `die_after`, and stays out `dead_secs` once it's off her). It differs from
  `presence.gd`, which flickers the lights *near* her whether they're on her or not.
- **"some effect for phasing in and out of the reality/world so it's almost like the creature is in the world but
  disappears but not super abruptly ... some kind of horror-ish one."** The look plugin's **`HSPhase`** and
  `creature_phase.gdshader` (GODOT_LOOK §5s): she comes apart in thin level slices that jump sideways, drains to her
  own shadow, and the slices go one by one; back the same way. `phase_out`, `phase_in`, `stutter` (torn a moment,
  nothing gone), `blink`, `phase_to(where)`, `next_place`, `fire`. Gone, she's hidden.
- **"Any other useful horror elements? Things that make the player think (am I going crazy)."** Built, three:
  - **`moved.gd`** (starter): a thing that isn't where you left it. Once you've seen it and only while you can't, it
    turns to face you, goes to its next mark, is nudged, tipped over or gone. One chance each time you look away.
  - **`gaslight.gd`** (starter): the game's own words lying for a moment: a task on the list reads something else,
    a line nothing said, a pickup you already have, the objective's letters out of order; then as they were. Only
    while its `needs` hold (`sanity:shaken`), sooner as sanity falls. Nothing is really changed.
  - **`HSUnease`** (look plugin, GODOT_LOOK §5t): the picture itself: the view's edges swimming while its middle
    stays still, a second picture drifting, something dark growing in from the corners, the colour going. By the
    Sanity node, or by hand; `most` a player's cap; nothing in it flashes.
- **MIND** (`python tools/godot/mind_check.py`) plays the scripts and the two nodes headless and draws and measures
  the two shaders; `--pictures` makes the look guide's two sheets.
- **Not in tutorial v2's game** (the user didn't ask this time): the look guide and the starter's README say how.
- **Suggested, not built** (the user picks): eyes in the dark (two glints that go when your beam finds them), a
  sound from the room you just left (your own actions echoed late: a door, a drawer), a corridor that's one door
  longer on the way back, a mirror that's a beat late, a photo or a painting whose figure has moved, a clock that
  ran while you looked away, a save or pause menu line that's wrong once, a second set of footprints in the wet,
  your flashlight's beam finding a shadow with nobody to cast it (`shadow_pass.gd` is half of that), a phone that
  rings and is dead when you lift it.

## 2026-11-12, after the close calls (the user: the camera on a bed and a chair, and eating by holding the button)

- **"can you make sure the camera adjust appropriately if we are on a chair or bed (sort of how a pov head would be,
  maybe slightly hovering above the bed as if the persons head was on a large pillow, if we drop a bed interactable
  on a bed prop it should calculate it based off the middle of the bed + height + length), similar with chairs though
  since we can have stools maybe make the drop script have a height / pos adjuster for view."** The starter's
  **`seat.gd` works the eye out from the furniture** (its `fit`, on by default; pose hiding is always as placed):
  - **Which furniture**: its `furniture` when set; the node's own meshes (the script on the prop); the model it's a
    child of (**`seat_bed.tscn`, `seat_chair.tscn`, `seat_stool.tscn`** to drag onto a model in the Scene tree); else
    the furniture under it in an interior's export (its piece of meshes found by a ray down); else the solid box
    under it.
  - **Lying**: the middle of the bed across, 0.30 m in from its head end, 0.22 m over where you lie (the highest
    surface in the bed's middle: the blanket), facing its foot. The head end is the one with a headboard; with none,
    the end behind the node's own facing; `flip` the other.
  - **Sitting**: the seat's middle, a seated eye 0.75 m over it (scaled by the player's own eye height), facing away
    from its back (the side that stands over the seat along its whole length); no back, the node's own facing.
  - **Adjusters** (the View group): `seat_height` (from the furniture's foot: a bar stool that's only a tall box),
    `view_offset` (right, up, back), `view_turn_deg`, `flip`, `look_limit_deg`, `fit` off.
  - **A head**: the eye eases onto the seat and up again (the player's `settle_secs`, 0.35), and turns only so far
    there (75° each side and 5° down lying; 125° sitting; a stool free).
  - **In the editor** an orange camera shows where the eye will be (the script is a `@tool`), when the furniture is
    a model in the scene.
  - **Found on the way**: an interior's export makes each piece of furniture solid as **one box to its top**, a bed's
    to its headboard (0.95 m), so tutorial v2's bed had your eye 0.5 m over the mattress. A seat whose eye would be
    inside that box now takes its twelve triangles out of the room's collider and puts a truer solid in (to where
    you lie, plus each side that stands over it). Only when the box is found whole; otherwise the player still
    lifts the eye over the lid, as before.
  - Tutorial v2's bed and chair are now nodes "anywhere over" their furniture (its §23); a new picture from the
    pillow. **SEATS** (`python tools/godot/seat_check.py`) plays all of it on furniture made of boxes.
- **"for us to eat something it has to be in our inventory, has to be 'eatable', and we have to hold left click
  (should be an eat meter that fills up, roughly 2 seconds to start with to eat it), once eating it should
  disappear."** Eating is the **Story's** now (it owns the pocket): `set_eatable(item, restores, secs)` marks a
  pocket thing; with it **in the hand** (the HUD row's middle; with no HUD row, the first eatable thing in the
  pocket) the **left button held** fills a meter under the middle of the view over its seconds (`eat_secs`, 2), then
  one is gone from the pocket and the Sanity node mended. Let go early: nothing. One a hold. **Not while a gun is
  up** (the click is the gun's; Q lowers it), a card is up, or the laptop has the mouse.
  - What makes a thing eatable: **`food.gd`** (E now takes it into the pocket instead of eating it: `restores`,
    `eat_secs`, `count`), an **HSShopItem's Eaten group** (`eatable`, `restores`, `eat_secs`; the catalog's soda,
    water and burger are), or a Sanity node's `foods`.
  - **Gone**: eating a food.gd thing with E where it lies, and the Sanity node's C key (`eat_key`).
    `sanity.eat_item(item)` is a script's instant eat.
- **Not done**: the interior export itself still writes the one box (the scene builder's `levelexport.js`: a bed's
  collider should be its mattress and headboard; then the seat's swap isn't needed); a prop's own box collider to its
  headboard isn't swapped (only a room's merged collider is); no eating sound is on the shelf (`eat_sound` is empty);
  no picture of the eat meter in the guide; Director and desk games.

## 2026-11-12, after the sanity meter (the user: sanity in the tutorial, and close calls)

- **"Sure wire it to the tutorial."** Tutorial v2's game has a **Sanity** node now: its scares cost 0.03 each, the
  laptop's soda, water and burger mend it (C eats one out of the pocket), the desk chair and 304's bed rest you, and
  **you can't sleep until she's shot** (`no_sleep = ["!shot_her"]`; lying down says "You can't sleep. Not while she's
  out there."; a running hunt stops it too). Shot, lie down in 304's bed: asleep, awake with it full. The hunt and
  the night's director speed up as it falls, by themselves. The guide's §31, part 6.
- **"can we also add some 'fake' just about made it feelings. The game doesn't need to be mathematically fair, just
  needs to feel like it is, e.g. a monster is running towards us as I'm shooting it, I'm about to kill it, but run
  out of shells, so I reload, normally it would reach me before I reload and I'd die but if x criteria is met or x
  chance it somewhat slows down or acts in a way that seems like it's about to kill me but gives me just enough time
  for reload to finish and I shoot it. It doesn't have to be with shooting either, hiding etc, just needs to feel
  intense, the core about horror is intensity and atmosphere and how much it draws you in."** Built as the starter's
  **`close_call.gd`**: a node under the character who hunts you (beside her `chase.gd` or `searcher.gd`, or a
  `hunt.gd`'s hunter; they find it by themselves).
  - **When** (each a switch): your gun is being **reloaded**; the beat between the click on an **empty gun** and the
    reload; **while** the Story's words hold (`on:fuse`: you're at the fuse box); **hiding**, the time her search
    would have found you (she leans in, stays `linger` seconds longer, and goes); or a script's
    `call_it("the door", 2.0)`.
  - **What she does**: from `hold_m` (2.8 m) she's slower the nearer she is, a crawl by `stop_m` (1.3 m), playing
    her `lunge` move with her breath at your ear, and her chase can't catch you while it lasts. It ends `grace`
    (0.5 s) after what you were doing is done, which is your shot. Miss, or take longer than `max_secs` (4 s), and
    she comes on at full speed and has you.
  - **How often**: `chance` 0.75, the first one in a game sure, one a chase, 40 s between them, only while its
    `needs` hold, and **less likely as sanity falls** (`sanity_sync`: half as likely at nothing). So it's the
    criteria and the chance the user asked for, and a low sanity means fewer rescues.
  - **Measured** (HUNT, with the weapons plugin's real double: its reload takes 1.42 s): started with her 3.2 m off,
    without a close call she catches you mid-reload; with one she falters, comes no nearer than 1.7 m, both shells
    are in, and if you then don't shoot she has you.
  - In tutorial v2 one sits under the one you shoot at the end and one under the hunt's stalker, both with Hiding
    off (that night's search is meant to find you when you gasp). The guide's §31, part 7.
- **Not done**: other kinds of near miss (a door that shuts with her hand in it, the last shell always the one that
  drops her, a hiding place she checks second), a close call for the Director's or the desk's games, a picture of
  one in the guide. The close call isn't told to the player anywhere, on purpose.

## 2026-11-12, the last (the user: a sanity meter, and hunts and events synced to it)

- **"Could we add a sanity bar/meter to the game, things like eating food, resting (sitting, sleeping at night) fix
  sanity, things can prevent from sleeping e.g. current quest might have something toggled as cant sleep; have a way
  to sync the hunts and events to the sanity so we can increase things and make things harder as sanity goes
  down."** Built in the starter kit (games made by hand):
  - **`sanity.gd`**: one node, a number 0 to 1 and a thin meter at the top right. **Down**: the dark, her near and in
    the open, a hunt running, every scare, time, dying; each its own number. **Up**: sitting (to 0.7), lying down (to
    0.8), eating, sleep (to full).
  - **Food**: `food.gd` on a thing, eaten with E; or pocket things listed in the node's `foods`, eaten with C (the
    laptop's shop already sells food into the pocket).
  - **Sleep**: lying on a bed for `sleep_after` seconds. **What stops it**: `no_sleep`, a list of the Story's words
    (any holding: `on:<task>` is "while this task is on the list", which is the quest's toggle), a hunt running,
    `block_sleep(why)` from a script, `sleep_needs` not holding ("night": the games by hand have no clock, so night
    is a fact the game sets).
  - **Synced by facts**: `sanity:uneasy` (under 0.75), `sanity:shaken` (under 0.5), `sanity:breaking` (under 0.25),
    set and taken back as it moves. Every Needs in the starter kit reads them: cues, scare and event areas, moments,
    hunt spots, a hunt's own start, a look.
  - **Synced by pace**: `hunt.gd` and `dread.gd` got `sanity_sync`. As sanity falls a hunt's spots come closer
    together, its stages sooner, her aggression up faster, the rest between rushes shorter, the warning shorter (never
    under a second), and under 0.25 she can rush a stage early. The director's moments come closer together. With no
    Sanity node in the scene nothing changes.
  - **At nothing**: a target's `fire()`, or death and back at the checkpoint with half.
- **SANITY** (`python tools/godot/sanity_check.py`) plays all of it headless; HUNT and TUTORIAL2 still pass.
- **Not in tutorial v2's game** (it is since the entry above): its guide has a short note (§31, Sanity). Not done: hunger, hallucinations of its
  own (the facts turn the existing glimpses and cues on), the meter in the UI plugin's HUD style, a save of it at a
  checkpoint, Director and desk games.

## 2026-11-12, after the plan (the user: build the hunt, Kimodo clips on its behaviours, a hunt in tutorial v2)

- **"dont need to watch the pr as your the only one who will be committing to it"**: the pull request isn't watched.
- **"I like your plan, consider how to attach animations to the behaviours (from kimodo), implement this plan and
  then update tutorial v2 to have a brief hunting phase before the final shotgun one."** Built for games made by hand
  (the starter kit; docs/HUNT_PLAN.md says what's built and what isn't):
  - **`hunt.gd`**: one node owns a hunt. The hunter; `haunting`, `stalking` or `lethal`; started by its `needs` or
    `start()`; ended by a time, the Story's words (`task:gun`), a safe room, her shot down; hidden, with a task
    revealed at the first sighting if wanted; stages with the facts `hunt:<name>` and `hunt:<name>:<n>`; the rush
    only by ticked rules (dark, ran, stared, back) from a stage on, after a tell, with a rest after.
  - **`hunt_spot.gd`**: markers round the map, ten kinds (watch, dart, peek, wait, ambush, follow, pass, door, decoy,
    custom), each playable only when what you can see allows it.
  - **Animations on the behaviours: `moves.gd`.** A node under a character with a clip per move (idle, walk, run,
    stalk, crawl, watch, peek, search, lunge, kill, hit, and any more). **A clip is a Kimodo .npz dropped in
    `res://animations/`**, retargeted onto her own skeleton when the game starts by the Director's reader and
    retarget, which every by-hand project now carries (`res://kimodo/`, copied by `godot_byhand.py`); or an animation
    file; or one her model has, by name. Walks are made in place and played by her real speed. No clip: the move
    falls back (stalk to walk to nothing) and she slides. The hunt and its spots ask for moves by name; a spot can
    name its own move or animation.
  - **Dying in a game by hand**: the Story's `checkpoint()`, `die()`, `revive()` (tasks, facts, pocket, cash, doors,
    where you stood) and `checkpoint.gd`; a lethal hunt keeps one when it starts and goes on a stage lower.
  - **Dark** means your flashlight off or dead and no lamp that's on reaching you with nothing in the way; the hunt's
    `lit_by` says which lamp, when she won't come.
- **Tutorial v2 §31, The hunt**: from an order at the laptop until the gun's in your hands. A third copy of her
  (Stalker) with a Moves node and her `hunting` look for the tell; six spots (her run past 304's open door seen from
  inside, the stair end, the vending corner, the linen door, a knock at 302, behind you); `stalking`, the rush in the
  dark from stage 3, room 304 safe. TUTORIAL2 plays it; one picture (`hunt_past`).
- **Not done**: navigation and marker paths (she can't yet cut through another room to get ahead of you), the
  Director's cards, a story word for desk games. No Kimodo clips are in the repo: the tutorial's stalker slides until
  the user makes them (the prompts are in §31).

## 2026-11-12, after the pull request (the user: being hunted, as a hidden quest)

- **"Can you consider how we could make an interesting horror sequence of being hunted ... a 'hidden' quest called
  survive the hunt ... select an npc that is hunting you ... behaviours (animations), jump scaring events, paths,
  hidden hunt event boxes around the map ... goes invisible ... 'kill' the player if it touches them ... designed in a
  way where the player can survive them too ... we don't want the creatures just running up to you, maybe if it's dark
  they would ... run past you very quickly into another room ... 'hunts' that basically act like haunting events,
  maybe you need to complete a task to get them to stop e.g. turn the power back on."**
- **A plan, not built: docs/HUNT_PLAN.md.** One `Hunt` node that owns it (who hunts, the kind: haunting, stalking,
  lethal; hidden or revealed; what starts and ends it; stages), **hunt spots** round the map picked at the director's
  pace (watch, dart across ahead of you, peek, ambush, follow, a cloaked pass, a door, a decoy, wait), **rush rules**
  (she keeps her distance; she rushes only in the dark, at your back, when you run or make noise, and always after a
  tell), **death and checkpoints for a game by hand** with the ways to live listed and checked, **hauntings** that end
  on a task (the power cut), **the cloak as a state** with what gives her away (a water shell among them), what's
  under it (navigation or marks, her moves) and a build order.
- **It waits on four answers** (HUNT_PLAN §9): the haunting first or the lethal hunt, what death is in a game by
  hand, which game it's first for, and whether there are clips for a hunter yet.

## 2026-11-12, the very last (the user: the shells merged in, a quest for being shot with one, a pull request)

- **"create a pr, merge in more-shotgun-shells into this branch"**. `more-shotgun-shells` (the love heart and water
  shells) is merged into `claude/jolly-darwin-9t8hkc`; CLAUDE.md, CONTINUE and this file kept both sides. The pull
  request is the branch into main.
- **"maybe add some question or drag and drop thing that we can do quests to have npcs be hit by the easter egg love
  shells or water shells (a way to check if someone did it), e.g. an npc gets shot with love, then it ticks that flag
  as true"**. Built in the weapons plugin: **`HSShotWith`** (`quest/shot_with.gd`), a node to put under a character
  (beside her HSHitReact or HSShootable) or anything with a collider. A shot of the kind it names landing on her
  (**Shell**: heart, water, buckshot, explosive, harmless, harmful, any, or a kind of your own by its id; a **Part**
  of her; so many **Pellets**; so many **Times**; only while its **Needs** hold) sets a **Fact** in the Story, ticks a
  task, says a line, sets an objective, adds tasks, fires a target and turns her look (the look switch under her,
  back after a while). Two ready-made to drag onto someone: `quest/loved.tscn`, `quest/soaked.tscn`.
- **The way to check is the fact.** Anything's Needs takes it (a door, an area, a cue, a quest marker, a look), a
  script asks `Story.is_set("her_loved")`, the node says `done`, `count`, `last`, and `HSShotWith.was(her)`.
- **It listens to the guns itself**, not to HSHitReact's or HSShootable's signals: only the gun's hit records carry
  the shell's kind when the shot hurts, so one node covers the easter eggs and the real shells, and works on
  something with neither of the two. An explosive's blast reaching her counts as that shell.
- **For games built by hand** (the starter's Story). A Director or desk game has no word for it: a fact such as
  `shot:<who>:<kind>` recorded by the brain would be the way, with the runner, the check and STORY_FORMAT together.
  Not built.
- **SHOTWITH** (`python tools/godot/shot_with_check.py`): the real gun, shells and Story in a small by-hand project.
- **Not in tutorial v2**: the weapons guide has it (§10, *A quest for being shot with something*).

## 2026-11-12, last (the user: how to use it, in the tutorial)

- **"Add information how to use this in tutorial html"**. In **guides/tutorial_v2**, a new **§30, Her looks: other
  eyes, another skin, the cloak** (the sections after it are now §31 to §34): the look viewer and what each of its
  controls does, saving two looks as files, an HSLookSwitch under her, a fact changing her (a look's Needs:
  `knocked_304`, her eyes black after the knocks), an event changing her (LightsOut's `scared` to the hunter's switch:
  her eyes lit in the dark), F8 while you play, the script lines, what the cloak can't do. **Built into the
  tutorial's own game**, as its other sections are: `tools/godot/tutorial_v2.py` writes the two looks and the two
  switches into `main.tscn`, TUTORIAL2 plays them (by a fact, by an event, by hand), and `--pictures` makes the
  section's four pictures (two from the game, two from the look viewer: `viewer` in `--only`).
- **Its pictures are the Character Studio's grey alien**, where the tutorial's other pictures are the stand-in: the
  stand-in has no eyes to change. Said in the section.
- **The Look plugin's guide** (`guides/look_plugin`, §8 People) has the cloak, the eye looks and the switch too, with
  two pictures, and its preset list and count brought up to 80.
- **Seen here, not from this**: on this machine a fresh TUTORIAL2 run says the ready-made floor differs from the set
  as it exports here (9 room volume markers); with `--reuse` (which skips that comparison) it passes. READYMADE in
  check_all passes. Not looked into.

## 2026-11-12, later (the user: a tool to toggle looks, and events and quests that change them)

- **"Can you make a tool that let's us toggle between the eyes and skin shades (allows us to use default too), we
  should be able to make events or quests trigger different looks"**. Built in the look plugin (GODOT_LOOK §5r):
  - **A look** is a file (`HSLookPreset`, a `.tres`): a skin (**default**, a creature skin, the cloak), eyes
    (**default**, an eye look), their colours and amounts.
  - **The tool** is two things. **The look viewer** (`addons/horrorstudio_look/tools/look_viewer.tscn`: F6, or
    Project > Tools > HorrorStudio: look viewer): a character from the project, every skin and eye look toggled beside
    her, Default, the lamp off to see what glows, stripes behind her to see the cloak, walking, Save as a look. And
    **the same panel over the running game** (F8, debug builds) for every character with a switch.
  - **`HSLookSwitch`** under a character keeps her looks and turns her from one to another (the old fading out, the
    new in; default exactly her own). **Quests**: a look's `needs` in the starter Story's words (`task:dinner`, a fact,
    `!`...): worn while they hold. **Events**: the starter's event area and cue have `look_of` and `her_look`; a cue's
    or a shootable's `target` calls the switch's `fire()`; from a script `set_look("angry")`, `default()`.
  - **For games built by hand** (the starter kit's Story). A Director or desk game has no word for a cast member's
    look yet: it wants a story word (`look`), not built; said to the user.
  - The check is LOOKSWITCH. It caught the starter cue's own `look` (where the player looks): the new word is
    `her_look` in both scripts.

## 2026-11-12 (the user: ghost events, the cloak, creepy eyes, what "Freddy" needs)

- **"Come up with some extra things we could add to our godot horrorengine, e.g. since we are making paranormal games
  we might want to be able to create ghostly-eventors, e.g. objects within this range might fly off the table (some
  light physics), ghostly eventors should function based off flags ... items that are flung shouldn't clip out of the
  scene. ... if I have an animation of an npc opening a door what if I want a door to open easily in sync with when
  their hand touches the door, or a cupboard ..."**, and what a game like *My Sister's Imaginary Friend Freddy* (a
  grey alien in the house while you look after your sister: Tamagotchi chores first, the paranormal bleeding in)
  would need, as *"drag and drop scripts that would help set the atmosphere"*. **A plan, not built**:
  **docs/GHOST_EVENTS_PLAN.md**. A ghost event is one node with `needs` (the flags), a trigger, what it does and what
  it tells the Fear node and the director; the two described in detail (the poltergeist's fling, which throws each
  thing to a place inside the room instead of with a force and watches it there; `touch_sync`, where the door follows
  the hand instead of a clock, and which opens a door "by itself" when the actor is cloaked); a catalogue of forty
  more against what the project already has; a **haunt level** (0 to 5) every event reads, so the paranormal bleeds
  in by one setting; Freddy's missing half (the sister's needs, a day, counting chores, cooking and food props,
  look-at, a routine); a build order and four questions. Waiting on the user's pick.
- **"can you also add a new one that emulates that 'invisibility cloaking' effect that the predators in the predators
  use"**. Built: the creature skin **`cloak`** (GODOT_LOOK §5p), a shader of its own that draws the room behind her
  bent through her shape in nested shells, on everything she has, nearly gone standing still and rippling when she
  moves, no light of her own; `eyes: true` and `shadow: true` for two eyes in the air and a shadow with nobody
  casting it; and the node **`HSCloak`** (`cloak()`, `reveal()`, `flicker()`, `fire()`), which makes it come and go
  in crackling patches. Its limits are in §5p (see-through things behind her aren't in it: in fog or a beam she's a
  hole). CREATURESKIN holds it.
- **"consider adding some glowing eye shaders or creepy eye effects, spiral eyes, glowing eyes (adjustable color),
  black eye, love hearts inside the eyes"**. Built: **`HSEyeFx`** (GODOT_LOOK §5q), thirteen looks drawn by the eye's
  own shader behind the cornea: glow (any colour), black, void, white, blind, bloodshot, spiral, hearts, star, slit,
  cross, dilated, pinprick; on the HSCharacterLook node its Creepy eyes row; a preset each. A new check, EYEFX.
- **Tried on the Studio's grey alien** (`creatures.mjs make --only alien --export`, made here: 1.25 m): every eye
  look, the cloak, and the two together (cloaked, his eyes glowing). Seen and left: his own black eyes go white under
  a strong lamp close by, with the eye shader as it was (LATER).

## 2026-11-11, after the very last (the user: two goofy kinds of shell, easter eggs; the branch `more-shotgun-shells`)

- **"Look at our shotgun asset and our bullets/muzzle/eplosive types of ammo, add a couple of new goofy ammo types, love
  hearts (this wouldnt damage the npc but have some kind of cute effect), water shells (water splashes), just some fun
  easter egg ones. call this branch more-shotgun-shells"**. So the weapons plugin has two more kinds of shell
  (`GodotPlugins/HorrorStudioWeapons`, its README's *The easter egg shells*; the guide's section 8):
  - **Both are harmless**, and that is one switch: an HSShellType whose `damage` is 0. What it hits is pushed a little
    and marked as its impact says, but an HSHitReact isn't wounded, staggered or brought nearer to going down, an
    HSShootable doesn't count it, an HSBlowUp isn't dented or broken; each says `touched(info)` instead, with the kind's
    `touch` word. A kind also has its own `fire_sound` (no blast) and `ring_scale` (no ringing in the ears) now.
  - **Love hearts** (`shells/heart.tres`): seven hearts in a wide cone. A small pink flash, pink smoke and hearts out of
    the muzzle that float up (a muzzle look's `spark_sprite`: each spark a picture, `muzzle/sprite.gdshader`). Where
    each lands, a pink heart printed on the wall, upright, glowing a few seconds, gone after sixteen, and hearts
    floating up from it; nothing of the wall missing. **The cute effect on someone** (`touch` "charm"): she's smitten,
    stood where she is for `charm_s` (2.5 s: whatever moves her waits, as in a stagger, with no shove) with hearts
    floating up over her head and a run of little bells, then comes on as before.
  - **Water** (`shells/water.tres`): nine splashes. No flash, no light: a pale spray and mist. Each splash throws drops
    and mist and leaves a wet patch that runs down a wall and dries in 24 s. Someone hit is soaked (`touch` "soak"): a
    start, dripping for `soak_s`, her skin wet if she wears the Look plugin's skin. **And it puts things out** (mine,
    not asked for: easy to take back, `douse_m` 0): an explosive's embers, a made candle's flame (HSPropFX), anything in
    the group `hs_flame` with `douse()`, within 40 cm of a splash.
  - **They're easter eggs**: not in a gun's kinds until some are in the pocket (a pickup with its `shell`, or
    `add_shells`). Nothing in tutorial v2 or the laptop's shop sells them yet: the user's to place.
  - **Their props** are the prop generator's, customizable as the others (`shell_12ga_heart`, `_heart_spent`,
    `shells_box_5_heart`, `shell_12ga_water`, `_water_spent`, `shells_box_5_water`: PROPGEN §31; a hull's `mark` and
    `motif` and a box's `picture` can be a heart or a drop). Their maps `tools/weapon_fx.py` (a heart, heart prints, wet
    patches), their sounds `tools/weapon_sounds.py` (`--only` makes just the new ones). WEAPONS plays them (§8k); the
    guide's pictures are Godot's.
  - **Found on the way, and fixed** (not asked for; it changes what every shot looks like): every impact's dust, chips
    and sparks, the ichor's droplets, a broken thing's bits and a shot-out lamp's sparks had been coming out at the
    scene's origin instead of at the hit since the weapons were built (a one-shot particle emitter throws its first
    particles as it enters the tree, before it was placed: LESSONS). They come out where the shot lands now. The
    guide's older pictures were taken with the fault and aren't redrawn here.

## 2026-11-11, the very last (the user: fix the library garments' limits)

- **"fix all the limits"**, each with its answer:
  - **Toes through a shoe**: *"if godot hides the toes then we dont care (if the dissolve works e.g. hides anything
    poking out /clipping above the shoe layer)"*. So the Studio's view stays as it is, and **what a garment covers is
    hidden in the export**: the skin under it (MakeHuman's own list for it and what its cloth covers on this body:
    `tailor/library.js` `cover`: cloth over the point within 4 cm, or the point standing through it by under 12 mm,
    the cloth facing as the skin does, 3 cm inside the cloth's edges, 8 mm where it lies snug), left out of the file
    as the tailor's covered skin is; and **a garment's own triangles under the opaque layers over it** (`trim`: a sock
    inside a shoe, briefs under a dress; the tailor's own garments under a library one too, in the page).
  - **The ballet dress**: *"remove the ballet dress all together"*. `mindfront_ballet_dress_the_swan` is out of the
    picks, its files and its bake out of git: 89 garments.
  - **Gravity**: *"add a gravity modifier that I can click, default should be fairly light gravity just to get it to
    curve against the shape of the body properly"*. A worn library garment has a **Gravity** switch (on by default) and
    *How much* (0.3 light, the default; 1 heavy): `hang`, a light cloth step after the fit: cloth lying snug stays,
    cloth standing off the body falls, its threads keeping their lengths (drawn in a little, so it lies to the body's
    curves), never into the skin, no point further than 5 cm. Shoes and hats don't fall. Saved as the garment's
    `gravity` when it isn't the default. (No prints or patterns on a library garment yet: not asked for here.)
  - **Skin specks at the hips**: *"similar to our anti clipping clothing we should have it that if skin clips through
    in godot that it dissolves 'hides' so the clothing is visible instead , clothin should move along the body though
    for walk animations (bend etc)"*. The covered skin is left out of the export (above), and the clothes are skinned
    to the skeleton by the skin's own bones round them. **Measured in Godot** (`tools/godot/library_check.py`,
    GDLIBRARY): an export in a dress over briefs, socks in flats, put through a stride, sitting, a bend, arms raised
    and a twist: the clothes move with the bones (up to 52 cm sitting), and the skin left in the file stands through
    cloth at 70 of 91 266 points (0.08%, 1.6 mm at most, at snug edges), the same in every pose.

## 2026-11-11, the last (the user: the new outfits in other PBR sets and colours, editable in the Studio; main merged)

- **"can you show me some of the new outfits with different pbrs and colors, (make sure we can edit them in the
  studio), also can you then merge in main into this branch, resolve merge conflicts"**. So:
  - **Library garments are worn and edited in the Character Studio now** (they were only the prototype's):
    - **A bake, once a garment** (`python tools/clothing_library.py bake`, `storykit/clothfit.py`: the prototype's
      stage 1): the garment carried from MakeHuman's base mesh onto MHR's average body at rest and written as
      `assets/clothing/_mhr/<id>.bin` (its points, its own UVs, a second UV in metres, the skin it hides). Needs numpy
      and scipy; the 90 picked ones are baked and in git (29 MB, `git add -f`), with the registration it uses
      (`Content/Studio/Clothes/library/hm08_mhr.npz`: MakeHuman's base mesh on MHR's, made once by the prototype's
      register.py; the base mesh is MakeHuman's, CC0).
    - **The fit in the Studio's own JavaScript** (`tools/character/tailor/library.js`: the prototype's stage 2): the
      baked garment carried onto the character's body (the dress form the tailor cuts on) and put outside the skin, in
      about a tenth of a second; within 0.3 mm of the prototype's Python on the same body. It follows the view's pose
      by the skin's bones round it, as the tailor's clothes do.
    - **In layers, lightly** (`layerOf`, `dress`): underwear, legwear, shoes, bottoms, tops and dresses, jackets, by
      the catalogue's group and the garment's name; an upper one is set outside the ones under it where they lie
      together, then the lower one is pressed in where it still stood through (a skirt's waistband through a top's
      hem). Shoes and hats keep their shape. **The tailor's own garments count too** (by their slot: under, legs, feet,
      bottom, top, full, jacket): they don't move, the library's go outside the ones under them and are pressed in
      under the ones over them (our tights under a library dress, our t-shirt over a library skirt). Not the
      prototype's whole rule set: no hiding of what's covered, no outfit rules.
    - **In the Clothes tab**: a *Library garments* section, the garments as cards with their own pictures by group; a
      click puts one on or takes it off. Under *Worn*: its colour (a tint on its own texture: white leaves it as
      painted), *Its own texture* on or off, and off it one of our fabrics or a PBR set off the shelf with its repeat
      and tint. Saved with the character (`{design: "lib:<id>", library: <id>, color, own, surface, pbr...}`).
    - **Export for Godot carries them**: skinned on MHR's skeleton, their colours baked on their own layout, the PBR
      set's other maps on the second UV, one sheet seen from both sides; the export's `CREDITS.md` names the ones to
      credit (tried: a CC BY 4.0 dress and CC0 flats).
  - **The pictures** (sent): twelve looks in the Studio's own view, four outfits each as painted and in our satin,
    denim, tweed, rib, leather, corduroy and fleece sets or tinted (`tools/character/libraryshots.mjs` makes them
    from a list).
  - **Limits, said to the user**: toes can show through a shoe in the Studio's view (the export leaves that skin
    out); a garment with soft alpha (the tutu's tulle) is cut out hard; a library garment is fitted, not hung by
    gravity; no prints or patterns on one yet.
  - **Main merged** (PR #23, tutorial v2's floor ready-made): conflicts in CLAUDE.md, CONTINUE, DECISIONS, LESSONS and
    check_all.py, both sides kept.

## 2026-11-11, last (the user: CC-BY clothing may ship; a credits file)

- **"Yes Im happy to ship with CC-BY, create a new .md file for storing credits so I can add them later when Im done
  with my game"** (after asking which garments are CC-BY). So:
  - **CC-BY clothing may ship, with a credit.** The asset rule is now "CC0, ours, or CC-BY with its line in
    docs/CREDITS.md". This answers the question left open below; it roughly triples the usable library (210 more
    garments and shoes in MakeHuman's packs) and brings in almost all the dresses, the coat and the jackets.
  - **docs/CREDITS.md** is the new file: every CC-BY garment tested so far with its author and licence as its own
    file says (Mindfront CC BY 4.0, punkduck CC BY 3.0 and 4.0, Elvaerwyn CC-BY with no version given, sonicteam998
    CC BY 3.0), a column to tick as a garment is used in a game, the CC0 ones for the record, a block to paste into
    a credits screen, and where the project's other licences are written down for the end of a game.
  - A thing that asks for credit gets its line there in the commit that brings it in.
  - Not changed by this: the fan costumes and the AGPL-marked suit in the same packs stay out; the garment files
    still aren't in the repo (the packs are to be downloaded; that question is still open).
- **"Can we import the rest of the CC-BY garments into our projects (the full community packs)"**. Yes, as far as
  this session can reach (`tools/clothing_library.py`):
  - **The catalogue is in**: `Content/Studio/Clothes/library/index.json`, every thing to wear in MakeHuman's 40
    clothing packs (491: 191 CC0, 297 CC-BY, 3 refused by name), each with its author, licence, own page and pack,
    read from MakeHuman's website source on GitHub. docs/CREDITS.md now lists all 297 CC-BY ones with their pages.
  - **The files are fetched, not tracked**: 2.6 GB into `assets/clothing/` by `python tools/clothing_library.py
    fetch`, as the PBR shelf's sets are (too big for git; read as: the user's own decision on that shelf carried
    over, to be changed if they want the garments in git).
  - **Not downloaded yet**: MakeHuman's two file servers are blocked from this session. A cloud environment
    "HorrorEngine" that allows them was made (approved by the user), but a running session can't move onto it: the
    fetch is one command on the user's machine, or in a new session started on that environment.
- **"When you export the characters can you export a .md for godot can you include a .md that contains whos cc outfits
  we used so I can credit just hte ones used"**. Every character exported for Godot now carries its own credits
  (`storykit/clothcredits.py`): `CREDITS.md` in `Exports/characters/<name>/` (`<name>.credits.md` in a Director
  project's `game/people/`; `<body>.credits.md` beside the prototype's .glb): the library garments that character
  wears which ask for a credit, with author, licence, page and the lines to paste; the CC0 ones; a refused one
  flagged; the tailor's own as ours. A Studio character has no library garments until the fit moves into the Studio,
  so today its file says there is nothing to credit; a worn library garment will say so with `library` in the
  character's `clothes`.
- **"Yeah i think we might aswell  s tick with the fetch, can yu create a pr for this branch, once I merge in Ikll want
  to just manually move this downloaded folder into my main branch so I dont need to redownload when I switchc to main
  branch, maybe have it git ignore the newer fetched files (you can keepw hatevers alrady added in for now)"**. So:
  - **The fetch stays the way**: the garment files are never committed; `assets/clothing/` is in `.gitignore` (the
    whole folder, the kept zips too). Nothing under it is tracked, so nothing had to be taken out.
  - **What is tracked stays tracked**: the catalogue (`Content/Studio/Clothes/library/index.json`) and
    docs/CREDITS.md; a fetch's `scan` rewrites those two with each garment's own licence version, to be committed.
  - **Switching branches keeps the download**: an ignored or untracked folder is left where it is by a checkout. In
    one working folder there is nothing to move; in a second clone, the folder is moved into its `assets/`, or
    `$STUDIO_CLOTHING` points both at one place.
  - **A pull request for this branch** was opened at the user's ask.
- **"Ive noticed the download (fetch) is sper slow, its only 3mb in 5 min, can you apss me some screenshoits of the
  packs and ill just pick wahatever outfits I want and then youll add to only fetch those ones"**. So:
  - **Pictures to pick from**: every garment's own thumbnail (MakeHuman's website source on GitHub has one a garment)
    on eighteen numbered sheets, sent to the user; a garment's number is its place in the catalogue.
    `python tools/clothing_library.py sheets` makes them again (into `Saved/Clothing/sheets`; needs Pillow), with what's
    picked and what's on disk marked.
  - **The picks are a tracked file**, `Content/Studio/Clothes/library/picks.json` (`pick 12 40 <name> ...`,
    `pick --remove`, `pick` alone lists them; a refused garment isn't picked). Any machine fetches the same ones.
  - **`fetch` gets only the picked garments** once something is picked (`--all` for every pack, pack names for whole
    packs, `--only` for garments without picking them). A garment is cut out of its pack's zip **on the server**: the
    zip's list of files read by a byte range, then only that garment's folder, four connections at a time
    (`--connections`), with a line of progress every five seconds. A dress costs its own megabytes (7 to 11 MB for the
    system pack's ones), not its pack's hundreds. A server that gives no ranges gets the whole pack downloaded and
    only the picked folders unpacked.
  - **Not tried against MakeHuman's servers** (blocked from this session): tried on the real system pack's zip served
    from this machine at 150 KB/s a connection (three garments: 26 MB of 424 MB, 50 s) and held by CLOTHLIB on a
    made-up pack. If their servers refuse ranges, the fallback is the slow whole pack: to be told.
  - **Waiting on the user's numbers**; then `pick` them and commit picks.json. (Answered, next.)
- **"If possible can you just add the following into our project"**, then the numbers 3, 14, 15, 19, 19, 20, 32, 33,
  38, 40, 47, 254, 364, 427, 428, 414, 416, 281, 291, 248, 228, 362, 363, 233, 372, 311, 345, 346, 339, 337, 336,
  420-467, 470-491. So:
  - **They are the project's picks**: `Content/Studio/Clothes/library/picks.json`, 98 garments (the 19 given twice
    once) from 19 packs: 60 underwear, swimwear and legwear, 12 suits and outfits, 10 dresses, 6 shoes, 4 skirts, 3
    tops, 3 trousers; 30 CC0 and 68 CC-BY (their lines are already in docs/CREDITS.md); none of the refused three.
    About 400 MB by each pack's share, where their packs whole are 1.5 GB and the library 2.6 GB.
  - **Read as: picked, not committed as files.** The garment files still come by `fetch` on the user's machine
    (MakeHuman's servers don't answer from this session, and the user chose the fetch over files in git one message
    before). If they meant the files in the repo, they'll say.
  - **A garment's folder by its nearest name**: the catalogue's names are the pack pages'; an uploader's folder can
    differ a little (the mirrors have `Elvs_Crochet_Baby_Doll1` for `elvs_crochet_baby_doll`). The fetch and the scan
    now take the exact name first, then the nearest in the pack (best pairs first, a folder to one garment), and say
    so (`taken as ...`); what still isn't found is listed with the names near it.
- **"why is the download speed 100KB/s when I have 900mbps internet"**, then **"Can you just download them into our
  branch yourself ? I dont mind commiting them up since its only 400mb"**, then **"I added it to the cloud environment.
  note the new mirror is way faster"**. So:
  - **The picked garments are in git**: `assets/clothing/<pack>/clothes/<garment>/`, 90 garments, 486 MB (more than
    the 400 MB guessed from each pack's share: three of Mindfront's dresses are 25 to 50 MB each). The folder stays in
    `.gitignore`; the picks were added with `git add -f`, so **anything fetched later is ignored** until it's added the
    same way (the user's earlier "have it git ignore the newer fetched files").
  - **The faster mirror is first**: `files.makehumancommunity.org` (the pages' second mirror) gave 3.5 MB/s from the
    cloud session where the user had 100 KB/s from `files2`; `fetch` now tries it first (`--mirror files2` for the
    other). The user allowed that host on the Default cloud environment; byte ranges work there: all 98 came in one
    run, every folder found by its exact name.
  - **Eight of the 98 picked are held back, not committed** (taken out of picks.json, marked refused in the catalogue):
    - **Seven whose own file says AGPL3** where their page says CC0 or CC-BY: `kwnet_at_pantyhose01`,
      `marco_105_armsleeve02`, `marco_105_stocking01`, `marco_105_stocking02`, `jaldmic_stockings`,
      `punkduck_bandeau_bra`, `punkduck_string_4`. It is the line the old MakeClothes exporter wrote by default
      ("# license AGPL3 (see also .../external_tools_license.html)") and the author's page is probably what they
      meant, but a file that says AGPL isn't shipped on a guess. The user's call to overrule.
    - **`culturalibre_el_chapulin_colorado`**: the costume of a television character (El Chapulín Colorado, its heart
      emblem and antennae), someone else's character; `chapulin` is on the refuse list now.
    - Kept, said to the user: `culturalibre_heroine_suit_7` is a blue top and a red skirt with a yellow hem, close to
      a comic heroine's colours with no emblem.
  - **The stricter licence is the one credited** (`storykit/clothcredits.py` `licence_of`): a file that says CC BY
    where the page says CC0 is credited (`punkduck_strappy_lace_thong`, CC BY 4.0); a page that says CC-BY where the
    file says CC0 is still credited (`joepal_plain_bra`, `tiomegamanx_skintight_body_suit_female`). docs/CREDITS.md
    now carries each fetched garment's own licence version (27 CC BY 3.0, 11 CC BY 4.0, the rest no version).

## 2026-11-11, later (the user: the fitted outfits clip; clothing layers, a dissolve in Godot, main merged, our PBR sets, pantyhose, fishnets and socks)

- **"Some issues, some of the des igns show clear clipping, can you set smart rules so skirts are  always below the
  waistband, maybe add clothing layers so that if a piece of clothign is higher in the layer the layer below can ne ver
  clip through (maybe we can do some dissolve effect thast hides it in godot too), can you look at the latest main and
  merge it in as we added some new proportions and a new design, test using our custom pbrs on these outfits too.  Test
  using the pantyhose, fishnet tights and socks too,"** (with a picture of the fit test's skirt, its waistband through
  the sweater's hem). Done in the prototype (docs/research/clothing_v2/fit_test.md §7; `proto/layers.py`, `wear.py`):
  - **Layers.** Every garment has a kind (from its name and its shape on the average body) and a layer from the kind:
    legwear 15, socks 16, shoes 20, **bottoms 30, tops 40** (so a skirt or trousers are always under a top's hem; an
    outfit's `tuck` puts tops under bottoms instead), dresses and suits 40, jackets 60, coats 70. An outfit can give a
    garment its own layer.
  - **A lower layer can't come through a higher one**, two ways at once: each garment is set outside the ones under it
    (cloth against cloth, the lower giving most of a conflict, the upper the rest; a shoe never bent), and **what a
    layer covers isn't drawn at all** from 3.5 cm inside the covering garment's edge (1.2 cm under shoes and socks), the
    tailor's own rule for skin (TAILOR §3d) carried to cloth under cloth, so in a pose nothing is there to come
    through.
  - **The dissolve in Godot** (`proto/godot/cover.gdshader`, GDLAYERS): the covered part of a mesh goes out over 2 cm
    by a dither instead of ending in a line. Each mesh's vertex colours say what hides it by band (bottoms, tops,
    outerwear, legwear and shoes), so a game that takes a coat off turns that band down and what was under it
    dissolves back, nothing baked again. Pictured in Godot 4.7: a coat over six garments, the coat off, half way.
  - **Main merged** (PR #22: Anime's bust and dress form, the red sweater dress). Tested on Anime at Bust 2.1 and -2,
    a girl of ten and a boy of fourteen, and with the red sweater dress under a library coat.
  - **Our PBR sets** on the layered outfits (the baked fabric sets, at their real size by the metre UV, tinted) and
    **the tailor's pantyhose, fishnet tights and socks** (knee, crew, over the knee) under library skirts and into
    library shoes: `layers_pbr.jpg`, `layers_legwear.jpg`.
  - Still a prototype: nothing in the Studio, at rest only (not walked), `proto/check.py` (LAYERS) its check.
- **"When it comes to the top and skirt it seems yo uregressed, you had it fixed in the firs screenshot, but somehow
  broke it as can be seen in screenshot 2 where the skirt clips out of the gray sweater"** (mid-session, two of the
  session's own pictures). True: the second picture was the same skirt and sweater with pantyhose added under them, and
  a reworked solver took the tights' turned edge at the waist for a surface the skirt and sweater were under. Fixed the
  same hour (which way is out is now the body's own outward direction, never the cloth's faces), the same view sent
  back, and LAYERS now runs that outfit with and without the tights (LESSONS).
- **"Once your done with the current stuff caan you confirm if we kept in the other metahum CC 4.0 stuff you found eg
  dresses, cocktail dresses, if they work with the new layering system etc"**. Both answered (fit_test §7.5):
  - **Kept**: how to fit and layer them, their pictures and each one's author and licence are in the repo; **the
    garment files themselves are not**, and never were (the six Mindfront dresses are CC BY 4.0, punkduck's cocktail
    dress and qipao CC BY 3.0, Elvaerwyn's four CC-BY: not CC0, so they wait on the credits-screen answer). They are
    fetched again by two `git clone` lines in `proto/README.md`.
  - **They work with the layers**: all twelve dresses, each worn with legwear under it and a jacket or cardigan over
    it, end with nothing coming through (`layers_dresses.jpg`).
- **"just to interrupt, if therye wearing a dress dont worry about making them wear a coat,  Ican see it look distorted
  but we want to create some light rules for outfitting just ot not have to deal with harder clipping and mesh
  distortion"** (while a wide-sleeved dress under a coat was being forced to work). So **an outfit has light rules,
  and what they refuse isn't worn** (`layers.rules`, `layers.too_full`; the run says why):
  - by kind: one bottom (a skirt or trousers), one jacket, one coat, one pair of shoes, one legwear; a dress or a suit
    is the top and the bottom (no separate top, skirt or trousers with it); **no coat over a dress**;
  - by measure: nothing is worn over a garment too full to go under it (over 2% of it standing more than 5 cm
    outside: a fitted jacket over wide hanging sleeves);
  - and no garment is ever bent to make room: no point moves further than 5 cm from where it was fitted. Under a hem
    that reaches the floor the shoes aren't drawn.
  The squeeze-it-in rule that was half built is dropped.

## 2026-11-11 (the user: Cloth2Tex as a second clothing system, a CloV2 tab; then what's newer and free)

- **"Evaluate and determine whether we could upgrade our clothing system with the following option instead
  https://github.com/HumanAIGC/Cloth2Tex , instead of replacing it we'd simple add a new cloV2 tab , if we could use this
  how much vram etc would it require to run the repo , U know the repo doesnt give us phase 2 (fine textures) but im ok
  using our exiting textrues + pbrs"**. Read at source (docs/research/clothing_v2/cloth2tex.md): **no**. It makes no
  garments: it ships nine fixed meshes (GPL-3.0: they can't ship in a game, and they fit no body) and its whole output is
  a 512 px texture for one of them from a front and a back photo, with holes down every seam, which its phase 2, never
  released, was to repair. So its garments with our textures keep nothing of it but those meshes. Every photo needs its
  landmarks clicked by hand (the detector was held back); one commit, 2023-12, and nothing since. **About 2 GB of VRAM**
  (worked out from the code's tensors, not measured: no graphics card in the session). The idea worth keeping is a
  garment's look from photos, which our own flat panels make a 2D warp (a print the size of a panel), no renderer and no
  GPU. Nothing built.
- **"I notice that repo is 3 years old, have there been any better advacnes for easier clothing for 3d game models ?
  research into any free alternatives"**. Read as: research only, then the user picks (docs/research/clothing_v2.md, its
  notes in docs/research/clothing_v2/). In short: nothing that generates clothing beats ready-made garments for us. The
  sewing-pattern generators all end at the draping step that failed here in October; the image-to-3D models make an
  object, not a garment on a body (worth it only for one-off bags and hats); the photo-to-texture models are stopped by
  their licences or need a 48 GB card.
- **"To add I dont actually care about generating procedural cloting, if you can find a repo or source to get good 3d
  clothing designs and create an algorithm to apply that clothing to any of our models (make it fit), and allow custom
  pbrs ,png decals etc that is also fine, id rather have better already designed clothing with lots of options than
  generating crappy clothing"**. So the research turned from generators to **a library of ready-made garments and a
  fit**.
  - **The source**: MakeHuman's community clothing, all in one format on one base body: 129 garments and shoes and 56
    accessories under CC0, 210 and 73 more under CC-BY (a credit line in the game).
  - **The fit, tested** (docs/research/clothing_v2/fit_test.md, its scripts in `proto/` beside it, its pictures
    `fit_*.jpg`): MakeHuman's base body registered onto MHR's once (4 s), then 48 garments fitted with no failure and nothing adjusted
    by hand, fifteen of them on two to five of the Studio's seven test bodies; our own fabric at real size on one of them (a
    second UV in metres, the garment's own seams kept as a layer) and a studio print PNG on its back.
  - **Not done by the test**: layering between two library garments, bridging on heavy bodies, motion. A prototype
    only: no check, nothing in the Studio.
- **"Can you see if you can find some more korean/japanese smart casual designs, uniforms, dresses, suits."**
  (docs/research/clothing_v2/korean_japanese.md). The packs have the plain half: suits (8 under CC0), office wear, a
  shirt with a tie, cardigans, slacks, pleated plaid skirts, 55 dresses. Nothing specifically Japanese or Korean is in
  them (no sailor uniform, gakuran, hanbok, kimono). The lead: Style3D's free garments on Sketchfab (school uniforms,
  business suits, shirt-and-skirt sets, dresses; CC Attribution on most, by search summaries: each page's licence to be
  read before use). No free hanbok, kimono or yukata was found.
- **Not decided: the user picks** (the first answered since: yes, 2026-11-11, last). Whether CC-BY garments may ship with a credits screen (the rule today is CC0 or
  ours); whether the fit becomes a CloV2 tab in the Studio; which garments come in first.

## 2026-11-11, after the latest (the user: tutorial v2's map pre-built, the Godot part alone)

- **The ask**: **"I dont want to build the map myself for tutorial 2, can you pre-build it so i can just do the godot
  part of the tutorial"**. Read as: the hotel floor (guides/tutorial_v2 §3 to §8, the scene builder) comes made, so the
  tutorial starts at §9, The project, with nothing to do in the scene builder or the desk.
- **Built**: **the floor ready-made, in git**: `Exports/interiors/hotel_floor/` (`hotel_floor.glb`, its README, what
  made it), the set `hotel_floor` exported as the scene builder's Export for Godot does. §9's two commands
  (`godot_byhand.py new`, `exports --link`) put it in the project as `exports/interiors/hotel_floor/hotel_floor.glb`.
  The only export kept in git (45 MB, nearly all its textures: the biggest file in the repository); every other export
  is still made on the machine. Exporting the set yourself writes over it (`git checkout Exports/interiors/hotel_floor`
  puts it back).
  - **Kept current**: its `ready.json` records the set's fingerprint and the .glb's signature (what it holds: nodes,
    places, shapes, materials, metadata). Not its bytes: the browser writes a level's pictures in a different order
    each time, so two exports of one set never match byte for byte (LESSONS). `python tools/godot_byhand.py ready` makes
    it again (the desk's server running) and keeps the old bytes when nothing in it changed, so git only sees a new
    .glb when there is one; READYMADE (`ready --check`, in CHECKS) fails when the set has changed since, or the .glb
    isn't the one recorded; TUTORIAL2 holds it to the export it makes itself.
  - **The guide**: §2 opens with it (the floor is ready-made: skip to §9), the contents mark §3 to §8 optional, §9
    says the floor's in the project at once. And a slip fixed on the way: §3 had you make a new set called
    `hotel_floor`, which the scene builder refuses (that name is the finished set's); it's `my_hotel` now, with §8 saying
    to read `my_hotel` wherever the guide says `hotel_floor` after that.
- **Checked here**: a project made as §9 says, opened by Godot 4.7 through the link: the start on the stairwell's
  landing, 304 locked by `key_304` and the six others by `flag:never`, the colliders under the start, her spot, and
  every node the tutorial's steps use (TUTORIAL2's list); then TUTORIAL2 whole.
- **Not in it**: her (still a Character Studio export of yours, or the stand-in §20 describes), and nothing of the
  Godot part done for you: the user asked to do that part.
## 2026-11-11, latest (the user: the new Bust slider kept as an Anime switch, the red knit dress kept; no look-alike preset)

- **The ask** (with a Daz3D screenshot of a character in a red ribbed turtleneck dress): **"could we make a 'korean
  anime' proportion preset, that's vaguely like the character shown in the screenshot (can we also recreate the same
  dress), try get it as 1:1 as possible and make it so it's easily adjustable (we should be able to make the woman more
  flat too but also more busty like the image ... maybe make it about 60% as busty as the image given that being too
  busty might cause clipping issues), try re-create that kind of face and makeup look too and create a hair preset
  that matches my image"**.
- **On the first bust** (an annotated screenshot, ticks on the front view, red lines on the side views): **"from the
  front angle it looks perfect, but as you go towards a side view it looks unnaturally pointy, it should feel more how
  a waterballoon would sit rather than a fine point"**. The bust was rebuilt from that: not a bigger bump but a ball
  hung in the skin from the breast's root, resting on the ribs, its weight low (CHARACTER_STUDIO §2e).
- **Then the stop: "for the latest work on recreating the korean character I dislike everything we've done aside from
  the new red clothing fabric and the new bust slider, keep the new bust slider as an 'anime' toggleable, and the
  clothing, don't worry about creating a preset for the 1:1 character anymore"**. So:
  - **Kept, as a switch: Anime** (Character Studio, Body, under Cutify). On, a **Bust** slider under it runs from −2
    to 3: −2 a flat chest, 0 the body's own, 1 the plain slider's top, and past 1 a full, heavy bust that hangs like a
    water balloon (2 large; 3 about the picture's, so 2 to 2.2 is the "60% as busty" asked for). Clothes are cut on a
    dress form of it, so they go over a full bust without tearing or showing skin (TAILOR §1j). **Off (the default),
    the Bust is the plain slider it always was, −1 to 1**: every character made before is the same, and a character
    saved with Anime on that's switched off has its Bust brought back into that range.
  - **Kept: the red knit.** A new fabric, **Rib knit, chunky** (`chunky`: a sweater's wide ribs, eight 6 mm ribs a
    tile), and the dress as an outfit in Casual, **"casual: red sweater dress"**: a long turtleneck sweater
    (`sweater-dress`: a folded rib neck, rib cuffs) hanging free over a straight skirt of the same knit
    (`sweater-dress-skirt`), both designs usable alone and in any colour.
  - **Taken out, all of it**: the figure preset and its cards, the face look and makeup made after the picture, the
    face controls made for it (face size, jawline), the hair preset and its hairstyle, the figures tool. **No preset
    of the 1:1 character**: not to be picked up again unless the user asks.
- **Read as, for next time**: a look-alike of a picture is the user's to judge, part by part. Show a rough of each part
  (a body sheet, a face sheet, the hair) before building the next on it, and don't finish a whole character on a
  first guess (LESSONS).

## 2026-11-11, later (the user: weird skins for the monsters, in Godot)

- **"once your done with this could we create some more weird skin shaders/textures for the monster characters that we
  can apply in godot, e.g. a chrome silver skin, a pearlescent skin, some kind of greasy shader"**. Built in the look
  plugin as **creature skins** (docs/GODOT_LOOK.md §5o, guides/look_plugin §8): eleven looks that go on a character's
  skin in place of the skin shader: **chrome** (polished silver), **mirror**, **pearl**, **greasy**, **slime**, **black
  oil**, **porcelain** (cracked), **ember** (glowing cracks), **stone**, **scales**, **wax**.
  - **How they're put on**: under the character, the `HSCharacterLook` node's **Creature skin** row (the look, Amount,
    Tint, Extend), or a ready-made preset dragged under her (`presets/creature_chrome.tscn` ...), or a line of script
    (`HSCreatureSkin.wear($Demon, "chrome")`). They keep what her skin had (its colour as far as the look leaves it,
    its pores, its creases); her horns and ears take the look too; her eyes, teeth, hair and clothes never.
  - **Read as**: shaders, not baked textures: one shader, each look its numbers, so a look can be recoloured (chrome
    with a gold tint), mixed with her own skin (Amount, for a skin that turns) and changed while the game runs. The
    patterns (smears, cracks, scales) are drawn by the shader at their real size.
  - **Chrome is two looks** on purpose. A real mirror shows only its room, and in a dark room it's a black figure with
    glints; `chrome` keeps a sixth of its light as a surface so it reads silver under any lamp, and `mirror` is the
    pure one for a level with a sky or a reflection probe. Neither glows: in the dark they're as dark as the room.
  - Held by CREATURESKIN (`python tools/godot/creature_skin_check.py`); the sheet
    `docs/godot_sheets/2026-11-11_creature_skins.jpg` (the demon from the Studio's presets in each).

## 2026-11-11 (the user: the creatures as presets, and Godot's side of them)

- **"can you add presets for the monster-ish shapes you made so I can use them, fix anything that needs fixed for
  godot too"**. Read as: the seven creatures were chips that only showed with Monster mode on and only set a shape, so
  they weren't something to pick up and use; make them presets in the Studio's own sense (pictures, one click, a whole
  creature) and make sure what comes out of them works in Godot.
  - **The creatures are cards** (Body, under Monster mode, there whether it's on or not): Goblin, Ghoul, Ogre, Grey
    alien, Demon, Hag, Imp, each a picture of it. A click makes the character that creature and switches Monster mode
    on: its shape, height, build and teeth as before, and now **its look**: a skin colour on the procedural skin, its
    eyes, lips, stained teeth, and the demon's and the imp's horns. Everything it sets is a slider that's still yours.
    **With its look** off gives the shape alone on the character's own skin; **Face only** gives its head on the
    character's own body. The card worn is marked and kept with the character. (docs/CHARACTER_STUDIO.md §2d.)
  - **As characters, and for Godot**: `node tools/character/creatures.mjs make` makes each a character of its own
    (`creature_goblin` ... in the Studio's list), `--export` also exports each for Godot. The cards' pictures are
    kept in the project (`Content/Studio/Creatures/thumbs/`, `creatures.mjs thumbs` makes them again).
  - **Fixed for Godot: a Studio character's face moves** (docs/GODOT_DIRECTOR.md §6c; GDFACES holds it). It didn't:
    the bake that gives the Godot copy MHR's 72 face shapes skipped every export made since the blink (it took the
    blink's own morph targets for "baked already"), the runtime's face player drove one mesh and left the lashes
    behind, and an expression's closed eyes fought the blinker. Now the 72 go in beside the blink, every mesh that
    carries them is driven, and the lids are handed to the blinker. And one more found by measuring: MHR's shapes are
    made for MHR's eyes, so on a Studio character a look down or a squint slid the lids into the eyeballs and the eye
    showed through them (up to 138 mm2 on a test character); the desk puts that right every frame, Godot had nothing,
    so the bake now keeps the lids off the eyes in each shape (0.000 mm2 through a lid after it), and the look
    plugin's eye is drawn a little deeper than it is while the face moves its lids, which covers what several shapes
    at once (a smile) still slid in: as much as that character's own face wants, measured by the bake (2 mm on a plain
    face, none on a demon whose lids never reach its eyes), and nothing at rest.
    Characters already in a Godot project want their copy made again: Export for Godot in the Studio, or `python
    tools/godot_director.py install <project>`, or the game's next export.
  - **Fixed for Godot: a creature or a child can be shot at.** The weapons plugin's hitboxes were an adult's thickness
    on any skeleton (a head 20 cm across on an imp, a chest 28 cm through on an ogre of 2.6 m, where a shot at his side
    passed through). They're measured from her own bones now (legs, arms, shoulders, the head by its own length: a
    child's head stays an adult's), an adult keeping exactly what it had; `girth` on the node for a belly (HITBOXES).
    And the starter kit's hunter, chase, menace and cue take a `head_m` (1.5 m as before) for a short or a tall one.
  - **Checked on the creatures in Godot**: the demon, the goblin and the ogre made from the presets and exported go
    through the look, the faces and the skins. What that found is in the two lines above and in the eye's room being
    each character's own; nothing else of the Godot side assumed an adult (the Director's Kimodo retarget already
    scales a motion's travel by the legs).

## 2026-11-10, night (the user: younger characters, Cutify, monster mode, more horns and animal ears)

- **"Currently we are restricted to making older characters in the studio creator, I want you to add compatibility to
  do the following. A toggle for monster mode (where we can modify and exaggerate features - especially facial
  features for creating creatures) / making younger npcs 8-18 age, I think the main issue is the height selector only
  allows us to create 18+ characters, I may decide to have a game which is about a family being haunted by a
  poltergeist so need the ability to make younger npcs, I dont need very young just 8+, maybe allow the face to be more
  'cuter' softer, so maybe a seperate toggleable 'cutify', but we should still be able to import image to face /
  enhance the horns and add different type, add cow ears an animal ears to the props, maybe create it in a way that
  when I export it to godot i could add a jiggle bone (doesnt exist yet) to the ears e.g so they flop when the
  character moves."** In the Character Studio (docs/CHARACTER_STUDIO.md §2d):
  - **Ages 8 to 17** (Body, Age; 18 is the adult the Studio always made, and every character saved before is one). The
    height slider's floor was a symptom: a child isn't a small adult. The age sets the body's proportions from the
    growth charts (the head's share of the height: a sixth and a half at eight where MHR's adult is an eighth; legs that
    run ahead of the torso toward twelve; a narrow, straight build; a girl's and a boy's builds the same at eight and
    parting through puberty) and a short, soft face, and moving it sets the height to the age's average (the height
    slider goes down to 1.1 m and stays yours). **The head is the unit**: nothing of an age moves a point of the head
    against another; the body under it is what's scaled. So a face fitted to a picture, the expressions, the eyes, the
    teeth, the lashes and the hair work on a child as they did, and **image to face still works** (the age goes on after
    the fit, like the sculpt); **Young face** turns the age's own face down when a child's picture already gives it.
  - **Cutify**: a switch of its own with an amount (Body, under the age), at any age: bigger eyes (the iris with them),
    a shorter, rounder face, fuller cheeks, a smaller nose, mouth and chin. Also after a picture's fit.
  - **Monster mode**: a switch over the sculpt. On, every sculpt slider and circle goes three times as far, the height
    runs from 0.4 to 3.5 m, the **Creature** controls show (pointed ears, slanted eyes, a snout, a long skull, a hunch)
    beside new ones a person can use too (Proportions: head size, neck, torso, leg and arm length, hands, feet,
    fingers; the face's length, a round face, the eyes' size, spacing and depth, the ears' size and how far they stand
    out; bust, seat), and seven creatures to start from (goblin, ghoul, ogre, grey alien, demon, hag, imp: sliders
    yours to move on). Fangs and pointed teeth (Face, Mouth). Off, everything comes back into a person's range (asked first).
  - **Horns**, thirteen kinds where there were two (a devil's, budding stubs, an oni's, a unicorn's, a bull's, a cow's,
    a goat's, a gazelle's ringed lyre, a kudu's corkscrew, a ram's spiral, a demon's great horns, a dragon's, antlers
    with tines): their growth rings real ridges, their colour from base to tip and their grain drawn in code, their
    length, thickness, spread, curl and lean sliders. **Animal ears**, thirteen kinds where there were three (bunny, lop
    bunny, cat, fox, wolf, bear, mouse, **cow** (with its tag), goat, sheep, deer, a dog's floppy ones, a pig's), on a
    headband or growing from the head, each with Flop.
  - **Ready for a jiggle bone, and the jiggle bone**: read as "make the export ready, the jiggle doesn't exist yet".
    Export for Godot gives every ear a chain of bones of its own under the head (`jiggle_<name>_0` ... `_tip`), the ear
    skinned along it; a plain viewer shows them still. And the look plugin now has the jiggle: **HSJiggle**
    (docs/GODOT_LOOK.md §5n), Godot's own SpringBoneSimulator3D on every chain named so; HSCharacterLook and the game's
    cast put it on by themselves. Horns ride the head whole.
  - **Open for you**: the look of a child's face and of each creature on your card (the numbers are tables in
    `tools/character/grow.js`); how floppy the ears should be in Godot (HSJiggle's `amount`).
  - **Hair on a head that changes** (ours, so a character with hair can be given an age): the salon's bake now rides
    the head, placed again by how the head has moved and been sized since it was baked (the character records the head
    its hair was made on). It isn't made again: hair that lay on the shoulders was shaped on the body it had, and
    Hair, Bake does that.

## 2026-11-10, after that (the user: tutorial v2 to use every system)

- **"make a new branch called update-tutorialv2, that implements (gets the user to imeplmenet) every feature we've
  created so far so we can see whats missing, the gameplay itself doesnt need to be long, just needs to use every
  system to make sure verything works as expected (I will follow the tutorial and give feeedback in the pr)"**. So the
  branch `update-tutorialv2` (from `main`, the laptop merged): guides/tutorial_v2 grows the beats that use what came
  after it (the HUD and its markers, the pocket and cash, the laptop's shop and delivery, the shotgun, things that break,
  her shot, made props' effects), short, in Room 304's night; TUTORIAL2 plays them; and the guide gets a table of every
  system with where the tutorial uses it, or why it doesn't (what's missing). The user follows it and answers in the PR.

## 2026-11-10, after the last (the user: what's in a parcel flies to you and the box is gone)

- **"Instead of showing the items inside it, when we press e to open it should be like items absorbed towards the
  player (think minecraft drop item colelction) that get sucked intoward the player and the box poofs disappears, this
  is so we can create the illusion of bigger items like shotgun fitting inside"**. So E on a parcel: the box jumps, its
  flaps burst open and it's gone in a puff of card dust and bits; out of the puff each thing pops up at its own size
  (a shotgun as big as it is), turns in the air a moment, then is pulled to the player, faster as it comes, shrinking
  into them with a pop, into the pocket as it arrives. Nothing is shown inside the box any more. A parcel to leave
  behind open and empty is a switch (`keep_box`), the things flying to the player all the same.

## 2026-11-10, last (the user: the laptop's goods delivered in a box, things to unlock, pages)

- **"Some things I want added . An option to chjoose a spawn location for the bought items, create an 'amazon' package
  box for the arrived goods, and unboxed (press e to unbox/add to inventory) / make it easy to decide what item are
  buyable / make the items unlockable by quests that are done (flags) / do a ? for non unlocked items, create a next
  page for the buying item (rather than scrolling down), should have prev and next page, maybe a number system 1,2,3
  where the current page has brackets [2]"**. So, on the branch `laptop`:
  - **Delivery**: the laptop's `deliver_to` (a Marker3D or any Node3D: where what's bought arrives; none, and it goes
    straight into the pocket as before), `delivery_secs` (how long it takes) and arriving only where the player isn't
    looking; it comes as **a parcel**, a shipping carton like the ones online shops send, our own (no Amazon smile, no
    brand of anyone's: the shop's own name printed on it), a new customizable prop generator recipe (the prop standard:
    the `parcel` family, its four top flaps parts that open, its tape, its shipping label and its print its own
    pictures); **E on it unboxes it**: the tape cut, the flaps open, what's inside shown a moment and put into the
    pocket with its models (the HUD's row), the empty box left open.
  - **What's for sale**: each thing's `for_sale` switch in its file (off: not in the shop at all), and a laptop's own
    `sells` list (only these ids, when it has one).
  - **Unlocked by what's been done**: a thing's `needs`, in the starter Story's words (`task:<id>` a quest's task done,
    a fact set, `item:<name>`, `!` for not, several apart by commas); until it holds the thing is a **?** in the shop
    (no model, `???`, not to be ordered, its `locked_text` said when it's picked), or left out (`show_locked` off);
    newly unlocked, it's marked NEW.
  - **Pages, not scrolling**: the Order tab a page at a time (`page_size`, six by default; a category never shares a
    page, its name the page's heading), `< PREV` and `NEXT >` and the pages' numbers between them, the one shown in
    brackets: `1 [2] 3`.

## 2026-11-10, later still (the user: a laptop to order things on, in a green terminal)

- **"Make a new branch called laptop, similar to what we did for the retro props analyze and enhance the laptop and
  mosue model, then make it usable so when a player itneracts with it the camere a zooms in on the screen and a usable
  ui appears, for now we want a basic generic ui inside the laptop that has a order tab, a player can order items with
  cash they have, make it so its easy to add items to the system using the exisiing inventory system where we display
  the actual model in the slot thats visible, make iut so its easy to add items to the system, keep it as part of the
  horror engine as a preset scene(godot prefab) object. make the art style the typical green matrix style terminal
  look"** (with their model, `PSX STYLE Low Poly LAPTOP & MOUSE.fbx`). The branch `laptop`, made from `weapon-system`
  (its pull request not merged yet).
  - **The model, analysed and enhanced** (PROPGEN §32): a laptop (its base, its lid open 125°, the screen sunk behind a
    bezel) and a mouse, 10 times too big, 172 triangles, wearing two pictures off the web (a keyboard photo, a mouse
    maker's product shot) that aren't ours to ship: kept in `Content/Studio/Props/models/laptop_mouse.fbx` with them taken
    out, and made into the `computer` family's customizable recipes `laptop`, `laptop_shut` and `computer_mouse` at their
    real sizes, every surface painted here: real keys with their legends (the ones you play with polished), a touchpad,
    grilles, ports, feet and vents, a webcam, the maker's crescent, a sticker and an asset tag on the lid (yours to swap),
    the screen a surface of its own for the game's picture, the lid a part on its hinge; the mouse made round, its wheel,
    its grip, the sensor's red glow underneath. **Batteries** for its shop to sell (the flashlight's spares): the `cell`
    family (PROPGEN §33), customizable, `battery_aa` and the two-pack `batteries_aa_2`.
  - **Usable, as a prefab**: a new Godot plugin, **HorrorStudio Devices** (`GodotPlugins/HorrorStudioDevices`, in every
    project `godot_byhand.py` makes), its prefab `laptop/laptop.tscn` (the laptop and its mouse, **HSLaptop**). E on it
    (the starter's player): a shut lid opens, the player stops, the view goes in square to the screen (a camera of its
    own, 40 degrees, the screen nine tenths of the view), the mouse is the terminal's pointer through the glass; Esc, E
    or LOG OFF back. The terminal (HSTerminal) is **green phosphor on black** in a pixel font (VT323, OFL), square
    frames, the code's rain behind it and alone on the screen when nobody's at it, its boot's lines the first time,
    the glass's rows, glow and flicker; tabs HOME, ORDER and LOG (more by `add_tab`).
  - **The Order tab**: the catalog's things as cards, **each its own model** in the green through the UI plugin's
    `HSModelSlot` (the HUD's inventory row's own slot, pulled out so both use it), its price and stock; picked, large and
    turning, how many, the total, ORDER. **The cash** is the starter's Story node's (`cash`, `pay`, `earn`; a pickup with
    `cash` is money lying about); an order goes **into the existing pocket** with its model (`give(id, title, model,
    count)`), which counts now and shows as an HSHud's inventory row (Tab, the wheel, up a moment when something comes in);
    batteries become the flashlight's spares. Too dear or sold out, it says so.
  - **Easy to add a thing**: one `HSShopItem` file (id, title, about, price, count, stock, category, model, model turn),
    in a catalog's list or simply saved in the catalog's folder. The plugin's own catalog (NIGHT-MART) sells six made
    props: AA batteries, a votive candle, painkillers, water, a soda, a burger. The guide: `guides/laptop/`.

## 2026-11-10, later (the user: both systems)

- **"Sorry no, i didnt literally mean instead of, I want both systems."** HSBlowUp (things that break when they're
  shot) and HSHitReact (someone who bleeds black ichor) both stay in the weapons plugin, side by side: a shot breaks
  what it hits and wounds whoever it hits. Nothing is removed, and the question below is answered.

## 2026-11-10 (the user: characters shot, no blood; then an oozy ichor for the tape)

- **"Now instead of a breaking items system can you create a reactive system for characters/enemies to be shot, but
  dont do blood, instead create some form of demonic dark smoke and dark splatters like black blood."** Researched
  first (docs/research/hit_reactions.md). Read as a new system beside HSBlowUp, not in its place (both stay: the
  user's answer above). Built as **HSHitReact** (`react/hit_react.gd` in the weapons plugin), a node put under a character:
  - **Where she's hit**: capsules on her bones (MHR's names, a mannequin's, Mixamo's) on collision layer 11, which the
    gun's pellets and a blast see (`HSGun.SHOT_MASK`) and the player never bumps into; a stand-in of meshes gets one
    capsule and its part by the height. The head takes twice the damage, an arm or a leg 0.6.
  - **Her reaction**: a flinch on springs on top of her animation (HSFlinch, a SkeletonModifier3D: the bone hit thrown
    away from the shot, the spine back, the head a beat later, a knee giving); a stagger counter (most of a close shot)
    holding her where she is against whatever moves her and shoving her back.
  - **No blood**: black ichor, glossy so the flashlight catches it, embers in it: a wound on her riding her bone, drops,
    the spray behind her, drips down a wall (`fx/ichor_*`, made in code); **dark smoke** out of every wound, rising and
    trailing after her as she moves (the muzzle's smoke made black).
  - **Down**: what moves her stopped; she chars over with burning edges, crumbles into the smoke and is gone, a pool of
    ichor where she stood (or vanish, ragdoll, nothing); `restore()`. Its sounds made in code (`ichor_hit`,
    `ichor_down`): **listen to them**.
- **"Once your done can you look into adding some kind of shader for the black gothic blood that will fit our vhs
  camhybrid look and look eery and oozy."** Looked into (docs/research/ooze.md), then built as **HSOoze**
  (`react/ooze.gd` and its shaders in the weapons plugin): every mark of hers is black liquid with a shader of its own,
  projected onto what it lands on and lit there. It spreads as it lands and creeps on, drips run down a wall slowing to
  a stop with bulging heads, a pool's tendrils creep out as it ages, a wound oozes down her; thick it's black glossy
  domes with an oil's sheen and the room seen in their rounded edges, thin a deep oxblood; it crawls, beats slowly and
  smoulders. On the camhybrid tape it reads by its shine and its movement. It can be placed by hand (a wall that
  weeps); off Forward+, and with the look's `ooze` off, the flat decals stay. **Look at it in your own rooms**: its
  sheen, gloss, beat and drips are the look's to change.

## 2026-11-09, after the smoke (the user: things that blow up when they're shot)

- **"Could you create a shader/script called blownUp or something that lets any object we attach be blow up by shotgun
  shots, e.g. a kettle, a box, but it should look like the object itself got destroyed not just a generic animation."**
  Researched first (docs/research/breaking_props.md). Built as **HSBlowUp** (`blowup/blow_up.gd` in the weapons plugin,
  named as the plugin names things), a node put under any object:
  - **The object itself**: its own meshes are cut into pieces when it loads, in a worker thread (HSFracture: recursive
    plane slicing, each cut filled), so nothing is cut at the shot. Its own materials stay on every piece; the broken
    faces are drawn by what it's made of (`blowup/inside.gdshader`, the "shader" half of the ask).
  - **By material** (HSBreakKind, `blowup/kinds/`): ceramic and glass shatter, metal tears into a few crumpled sheets
    and dents first, card tears and lets its contents and lid go whole, wood splinters along its grain, plastic
    cracks, stone crumbles; guessed from the object when not given. A hollow kind (a kettle, a box) breaks as a thin
    wall, never as a solid block.
  - **The shot**: small pieces where it was hit, bigger ones away from it, thrown along the shot; the pellets' holes on
    the pieces; dust, chips, splinters, glints, paper or sparks; a liquid splashed and pooling; its sound made in code.
    The explosive's blast breaks it all to small pieces and scorches the broken faces. Weaker shots dent it and wear it
    down.
  - **After**: the pieces come to rest on the floor and stay (the mess left), kicked by your feet; `restore()` puts it
    back; `preview` shows the pieces in the editor.
  - The made kettle and mug (`electric_kettle`, `mug_stoneware`, the prop generator's customizable recipes) ship in the
    plugin's `models/` beside the box of shells, to try it on.

## 2026-11-09, after the last (the user: the smoke trails look fake)

- **"In the screenshot the smoke trails look a bit unrealistic and fake and show sharp lines, enhance it, research how
  to do realistic smoke if required first in godot"** (with four of the weapons guide's pictures: broken open, a shell
  popping in, the tape, the trail: the trail a flat band, two straight strips meeting in a sharp V, a cut-off end).
  Researched first (docs/research/muzzle_smoke.md). The trail rebuilt to that recipe:
  - **Motion:** it drifts in a curl-noise field that ramps in as it ages, so it curls, spreads and rises without
    piling up.
  - **Shape:** it's smoothed through its points (no sharp corners), split into strands that part as they age, and its
    ends taper.
  - **The shader:** world-space noise instead of noise stretched along the ribbon (the streaks), a soft profile across
    each strand, subtractive erosion that frays it as it ages, faded where it meets a wall or the gun (soft particles)
    and near the lens, drawn premultiplied.

## 2026-11-09, last (the user: the double barrel alone, how it looks with the muzzle, what a wall should show)

- **"Note I don't want the single barrel shotgun, only the double barrel one, inspect how it looks with the muzzle and
  what kind of wall damage it should have."** The pump-action shotgun is gone from the weapons plugin: its class, model,
  icon and its two sounds (the pump back and forward); **HSDoubleBarrel is the shotgun**. What both guns shared is
  **HSGun** (`gun.gd`, abstract: carried, raised, aimed, lowered, run with; the kinds of shell, the shot, the muzzles,
  the hulls in the room, the HUD); the double fills in its fire, its reload and its marks. `shotgun.gd` stays only as
  the double under its old path, so a scene made before still loads. The pickup's `kind` is `double` (or `shells`; an
  old `shotgun` gives the double). The pump's prop recipes (`shotgun_pump`, `shotgun_pump_black`) stay in the prop
  generator as props. The double's chambers now follow a script's `loaded`, as the pump's tube did.
- **How it looks with the muzzle**, inspected in the corridor at night:
  - The right barrel's flash reads as the user's star.
  - The left barrel's, a quarter second later, was a white ball: the first shot's smoke, still in front of the muzzle,
    lit by the second flash and its puffs summed to white.
  - Fixed: the smoke now hides a little of what's behind it as it covers (premultiplied: a thick cloud glows its lit
    colour instead of summing), and a flash beside it lights it no brighter than `smoke_light_cap` (0.5). The second
    star now reads through the first's smoke. The dust at an impact still only adds light.
  - The hulls flicked out over the shoulder could fall through a wall beside you (LESSONS); they move by three rays
    now.
- **What kind of wall damage it should have** (docs/research/shotgun_damage.md, from pattern tests and forensic
  references):
  - Each barrel has its own choke: the right improved cylinder (0.9°), the left modified (0.7°).
  - The pattern spreads from the muzzle: about 6 cm across 2.5 m out, 11 cm at 4.5 m, 22 cm at 9 m.
  - Pellets landing within 1.6 cm of each other tear one hole (`fx/blast_*`: the paper torn back in flaps, the plaster
    broken out, cracks): at an arm's length the whole charge is one hole; across a room, a torn middle with holes round
    it; down a corridor, each pellet its own crater.
  - The smoke's soot within 40 cm of the muzzle (`fx/soot_0`), the powder's grains within 90 cm (`fx/grains_0`).
  - The wad's own dent from 1.5 to 5 m (`fx/wad_0`).
  - On concrete, stone and steel the lead smears (`fx/smear_*`) instead of going in.
  - Not built: pellets through a thin wall into the next room, ricochets, the wad lying on the floor.

## 2026-11-09, latest (the user: a muzzle flash, a muzzle system, two kinds of shell, and what a shot leaves)

- **"Can you create a muzzle flare for the shotgun (the closest one that leaves a trail of smoke behind), as well as a
  generic muzzle system that can be used later for other guns but also integrate this technique into it: 'How I made
  it: Each "wing" of the muzzle flash is a series of slightly elongated intersecting spheres with their front culled.
  In the shader I used the dot product of the view normal with the surface normal to blend a noise texture that is
  triplanar mapped onto the sphere. The blend function is a burn'"** (with two pictures: guns firing in a Godot view,
  the nearest leaving grey smoke behind it; a flash as a star of noisy petals, white-yellow in their middles, orange
  and red where they burn out). Built in the weapons plugin as **HSMuzzle** (`muzzle/muzzle.gd`, any gun's muzzle:
  its -Z along the barrel, `fire(look)`) playing an **HSMuzzleFlash** (`muzzle/muzzle_flash.gd`, a resource: the wings
  round the bore (a STAR, or a BURST for a ball of fire), each a run of elongated spheres that intersect, a plume out
  of the bore, a core; their colours, energy, the noise, the burn, the erosion; the light; sparks; the smoke thrown out
  and **the trail**: smoke left behind wherever the muzzle goes, a ribbon through where it's been, rising and spreading).
  The user's way exactly: the spheres one MultiMesh laid out again every shot, **fronts culled**, the noise
  (`fx/flash_noise.png`) **mapped triplanar** on each sphere, **burnt by the facing** (the view's normal dotted with the
  surface's) through **a colour burn**, 1 - (1 - noise) / facing (`muzzle/flash.gdshaderinc`): the noise itself where a
  sphere faces the eye, eaten away toward its rim, then a ramp from red to orange to white-yellow; drawn added (a
  glow, the default) or solid (`blend`). The smoke's light capped (`smoke_light.gdshaderinc`: lit by the flash from a
  few centimetres it glowed as a ball the size of the room; LESSONS).
- **"In the future I will want to have different types of particle effects depending on the type of shell the player
  uses, so make sure it's easily expandable/modifiable, for now can you create two types of systems, a normal shell
  and explosive shell."** **HSShellType** (`shells/shell_type.gd`): a kind of shell as a resource, its pellets and
  their spread, push and damage, its recoil and noise, **its muzzle flash, its impact, its shell models**; the plugin's
  two, `shells/buckshot.tres` (the normal one) and `shells/explosive.tres` (one slug that bursts where it lands, a
  bigger, fiercer flash with more sparks). A new kind is a duplicated resource. The guns keep every shell's kind: the
  tube's in order, the chamber's, each of the double's barrels'; the pocket by kind (`spare` the kind loaded next's,
  the others in `pocket`); **T** picks the kind R loads; the shells' marks in their kinds' colours. The explosive
  shell, its fired hull and a box of five as customizable recipes (the prop standard: `shell_12ga_explosive`,
  `shell_12ga_explosive_spent`, `shells_box_5_explosive`, PROPGEN §31); the pickup's `shell` takes a kind and its box.
- **"Can you also create a response (so if we shoot a wall we should visually see the effect and maybe a pbr mask to
  make it like pieces are missing from whatever was shot)."** **HSImpact** (`impacts/impact.gd`, what a hit does) played
  by **HSImpacts** (`impacts/impacts.gd`, one in a scene): every pellet a **crater**, a Decal with three maps made from
  one height field (`tools/weapon_fx.py`, WEAPONFX: the albedo the material under the surface where pieces are gone and
  black down the hole, the normal map leaning into it so the light finds its walls, the ORM's occlusion darkening its
  depths), tinted by what was hit (its `hs_surface`, the sound physics' `acoustic`, the starter's rooms: plaster,
  concrete, wood, tile, metal, carpet...), the surface's dust and chips flying (wood splinters, metal sparks and only a
  dent); the explosive shell's **blast**: a scorched crater with cracks and embers glowing in it, a ball of fire (an
  HSMuzzle laid out as a burst), what's in its reach and its sight pushed and told (`shot(info)`, `blast`, `damage`
  falling to its edge; an HSShootable counts it), the view shaken, heard far, the ears ringing, its sound
  (`shell_burst`, WEAPONSOUNDS).

## 2026-11-09, later still (the user: a customizable cartridge prop, and a guide to the customizer)

- **"can you make a cartlidge [cartridge] prop for the shells that I can customize similar to cans and books. Can you
  also make a guide on how to use to prop customizer"**. Read as the shells' own box (a cartridge box, what the shells
  come in) and the shells themselves, both customizable as cans and books are: a new customizable family, **`ammo`**
  (PROPGEN §31): the 12-gauge shell moved in from the weapon family, its hull now printed along its length (brand,
  load, a mark) and its head stamped round the primer, each one of its own pictures (`hull.brand`, `hull.load`,
  `hull.mark`, `base.stamp`); and **a printed card box of shells** (`kind: "box"`: five lying side by side, or
  twenty-five standing heads up, any count; its lid hinged with a tuck flap, a part that opens; the shells inside),
  its lid, front, back, ends, bottom and flap printed with its own pictures (`lid.brand`, `lid.gauge`, `lid.load`,
  `lid.specs`, `lid.count`, `lid.art`, `front.brand`...). Recipes `shell_12ga`, `shell_12ga_spent`, `shells_box_5`,
  `shells_box_5_open`, `shells_box_25`; every brand made up (HARROW). The weapons plugin's box of shells
  (`HSWeaponPickup`, kind shells) is now `shells_box_5`, two shells spilled beside it, `lid_open` to show it open.
- **The guide**: `guides/prop_customizer/` (in `guides/index.html`): the prop generator's page from opening it to
  making and keeping a prop, its pictures the real page driven in a headless browser (`tools/propgen/guide_shots.mjs`,
  GUIDEPROPS) on the box of shells and a shell, with two example pictures to try it with (`examples/`).

## 2026-11-09, later (the user: a v2 double barrel, from their own model)

- **"Can you make a v2 double barrel shotgun, wher[e] only the barrel is visible in frame, unless we reload then it
  splits in two within frame and two shells pop in."** Built as **HSDoubleBarrel** in the weapons plugin (`double.gd`,
  an HSShotgun): held low so only its barrels are in the view, their muzzles toward its middle, the breech and the
  action under the frame's bottom edge; left click fires the right barrel (the front trigger), then the left (the rear
  one), then clicks; R brings it up near the eye and breaks it open there on its hinge (the top lever over, the barrels
  dropping away to the left, the stock down to the right: a V in the middle of the view with the chambers at its point),
  the ejectors flick the fired hulls up and out past your face, a live shell stays where it is, a shell pops into each
  empty chamber from behind the breech, and it snaps shut and goes back down (1.6 s for two); a click during it stops
  the loading and fires once it's shut. The pickup's `kind` double. Three sounds made in code (`double_open`,
  `double_close`, `double_flick`: WEAPONSOUNDS). WEAPONS checks it (`weapons_double_test.gd`) and pictures it
  (`weapons_double_shots.gd`).
- **"Ive modelled a reference for you to use for the double barrel, use it as a base and enhance it with better pbr
  textures similar so it matches our existing asthethic"** (with `dbl_barrel.fbx`, mid-build): the user's model took the
  place of the one made in code. It lives in `Content/Studio/Props/models/dbl_barrel.fbx` and the `weapon` family's
  kind `double` reads it (PROPGEN §30): at its real size (28" barrels, the gun 1.08 m), cut into the parts that move
  (the barrels with the fore-end on the hinge pin found in its knuckle, the top lever, the two triggers), its sockets
  measured on it (each bore's axis, the breech faces, the muzzles), **its barrels made round** (its eight-sided tubes
  rebuilt with 32 sides at their own bore, wall, taper and length: in first person the barrels are what's in the view;
  `round: 0` keeps the model's own), and painted by each texel's place to match the pump gun: blued steel polished
  along the barrels with their bores dark, a matted rib and a brass bead, the action case-hardened and faded, walnut
  (the pump's wood: rings, fibres, streaks, pores) checkered at the wrist and on the fore-end, an ebonite butt plate;
  then worn and baked as every made prop is.

## 2026-11-09 (the user: a shotgun held in first person, on the branch `weapon-system`)

- **"Make a new branch called weapon-system, create a shot gun asset and have its pov in godots horror engine similar
  to the screenshot, it should be equitable [equippable], can shoot, and reloads like a shotgun with shells entering
  it, spend 3 hours on it, if you think you're done early analyse and refine it through diff perspectives."** The
  screenshot: a dim, cold hotel corridor at night, a dark pump gun coming in from the lower right with its barrel
  toward the middle of the view, soft as on tape. Built as **HorrorStudio Weapons**, a Godot plugin of its own
  (`GodotPlugins/HorrorStudioWeapons/`, README and CLAUDE.md as the others; every project made by hand gets it):
  `HSShotgun` under the player's camera (held low on the right, the barrel's line on the view's middle 4 m ahead,
  swaying, bobbing, kicking, never through a wall), left click fires nine pellets (holes, dust, things pushed, a
  `shot(info)` on what's hit, the flash and smoke, the noise every listener hears, the ears ringing), the pump racked by
  itself (the hull out of the ejection port and onto the floor), R reloads a shell at a time through the loading port, Q
  lowers and raises it, and `HSWeaponPickup` the gun or a box of shells taken with E. The assets by the prop standard
  (HORROR_TODO): the prop generator's `weapon` family (PROPGEN §30: `shotgun_pump` with its pump, bolt face and trigger
  as parts and its sockets, `shotgun_pump_black`, `shell_12ga`, `shell_12ga_spent`); the sounds made in code
  (`tools/weapon_sounds.py`). The check WEAPONS (`tools/godot/weapons_check.py`).
- **"Just to add I don't need a hand holding the gun"** (mid-build): the gloved hands made in code (a hand on the pump,
  one on the wrist) were taken out; the gun is held by no one, as in the reference, and in the reload each shell rises by
  itself from under the gun, its nose into the loading port, and is pushed on into the tube.
- **Refined from other sides** (the user's "analyse and refine it through diff perspectives"): the feel (the view's
  kick settling back by itself, a little aside; the gun rocking back with the pump, carried low while running), aiming on the right button (the
  barrel straight ahead under the eye with the stock out of view, the lens 58°, the cone tighter), the tape's 4:3 picture
  (the gun and its shells drawn in), the shells as marks in the UI plugin's colours, four spare shells to start with
  (every one counts), holes that stay on what they hit (a door, a crate), a sound for each pickup, the gun shown in the
  editor where it'll be held, **HSShootable** (something to shoot: gone a while like a ghost, shoved, a cry, a line, a
  target fired; `hit`, `down`), the sound levels measured (the shot 13 to 25 dB over the action), and a guide
  (`guides/weapons/`). Measured against the screenshot side by side, the hold was brought in to match it: the muzzle
  just under the middle of the view and the gun dropping steeply to the bottom edge (`hold` 0.14, -0.165, -0.34;
  `aim_at_m` 1.1), the carried flashlight's beam kept on the middle of the view (`beam_at_m`).

## 2026-11-08 (the user: a better quest marker, and the rest of the UI, on the branch `ui-v3`)

- **"Make an enhanced ui quest marker (something that tells the player where to go/who to speak to), so even if it's in
  another room we can roughly see it (but it's more faint, and gets less transparent the closer we get), keep it the
  diamond shape but see how you can enhance aesthetics without making it distract from the horror vibe. See what else
  can be enhanced in the ui and do it as part of this new branch called ui-v3."** Built as ui-v3 (STORY_FORMAT §4, the
  marker; `marker.gd`): the marker's strength is one rule, the nearer the clearer (nearly opaque inside 3 m, a faint
  floor from 36 m, gone by 72 m) and about half as strong with the building between (play.gd's `guide_clear`: a ray
  against walls, floors, ceilings and doors, a few times a second), so it shows roughly through the rooms; it stays the
  diamond (corners barely rounded, a glass tint, a stem that fades out, a small core and the name near, no glow); a
  small diamond with a chevron points to it from the screen's edge once it's been out of view a moment; the pause menu's
  Quest marker (Off, Subtle, Clear). The standing rules held: flat, vector, one stroke, nothing that pops; the
  player's eye is never moved for them. The check GDUI (`tools/godot/ui_check.py`) holds it; `tests/uishot.gd` and
  `demo/hudlab.gd` are the pictures (the game, and the HUD alone over a picture). The rest of the HUD came with it, to
  the desk's own design (play/ui/hud.css) and quieted: the corners rest at 74% and come up on a change (OBJECTIVE, TO DO,
  rows kept so a tick draws its line across; a marked task's bullet is the marker's diamond), the reticle a dot that
  opens into a ring, lines in a serif over a scrim, toasts that ease, the keys as chips (they ran off the screen),
  the chapter card with a diamond rule, the dark closing in while hidden, the pause menu's small capitals.
- **"I think the glassmorphism panel actually removes some of the immersion, consider a style where the panel isn't as
  noticeable and the text is there"** (mid-build): the frosted card was dropped for **no panel at all**: the glass
  themes' panels are ghosts (no fill, no border, no shadow); a card is its words in a serif with the world dimmed a
  little and a soft, edgeless dark behind them (`halo.gdshader`); the inventory's band the same, no border; the menu's
  page just its rows. (The `neumorph` and `plain` themes keep their surfaces: they are their look.)
- **"I forgot to mention the ui should be part of the godot plugin for horrorengine"** (mid-build): the UI now lives in
  a plugin of its own, **HorrorStudio UI** (`GodotPlugins/HorrorStudioUI/addons/horrorstudio_ui/`, README and CLAUDE.md
  as the others): `HSHud`, the marker, the themes, the pause menu and typing moved out of the runtime add-on into it
  (the runtime uses them by path, as it uses the Look plugin); the export, the Director's install and the by-hand
  projects all copy it in and enable it; a game made by hand adds an `HSHud` and puts an `HSQuestMarker` on what to
  point at, its theme and quest marker setting in Project Settings. GDUI has a by-hand half.

## 2026-11-08, night, later (the user: a mechanic for jump scares by what's so, for other events too)

- **The ask**: "can you add another mechanic if we dont have it for jump scares, with variabels like is player looking
  at the events direction (can check if its looking on the sides of the frame, corners, or middle + range of acceptance
  so it doesnt have to be exact), is player on x quest, is player doing certain action e.g. is player in bed or
  sitting, if criteria met can show a brief jumpscare, can be an npc + sound + animation + disappears after x seconds
  etc, can also use this mecchanism for non jumpscares too".
- **What we had**:
  - the by-hand starter kit's scare area: walked into, or fired by a signal;
  - glimpse.gd: an angle off where you look, not a part of the frame;
  - the dread director's moments: behind, in view or out of sight;
  - the story format's `look` trigger (looked at for some seconds within a distance) and its `sit` and `sleep` uses.
- **What we didn't have**: a part of the frame with a tolerance, being on a task as a condition, what the player's
  doing (sitting, lying in bed) as a condition, or one piece that checks all of it and then plays someone, a sound
  and an animation and takes them away.
- **Read as**: a new starter kit piece, `cue.gd`, plus a seat to sit or lie on (`seat.gd`; the player gets a pose
  and `doing()`) and the Story's `on:<task>` ("on that quest": the task on the list and not done). It goes into
  tutorial v2 as two cues:
  - a jump scare from 304's bed: her on the ceiling in the corner of your view;
  - one that isn't a scare: knocks at 304's door while you sit and watch the TV.
- The desk's story format and the Director keep their own `look` and `sit`; the cue's conditions can go there too
  if the user wants.

## 2026-11-08 (the user: the retro pack into the prop generator, enhanced, in a tab of its own; the branch `retro-enhance`)

- **"I made a new folder called retro inside branch retro-enhance. I want you to analyse the old 3 models I made in the
  past, add them to the prop tool but with a more adjusted to match our style of higher quality textures pbrs/materials
  etc, and smoothign if requried for more low poly psx."** Then: a quality reference off about fifteen of the best
  props; each model checked for whether its vertices and mesh are good enough; those that pass enhanced where needed
  ("more pbr, style match with our current game style props"); and "a new genre/tab in our prop tool called retro".
  The folder holds two packs of 3D models (193 .glb), read as "the old 3D models".
- **What came of it** (the same day, docs/PROPGEN.md §29): the bar (`tools/propgen/quality.py`: fifteen made props
  measured, `Content/Studio/Props/quality_reference.json`); the audit (`propgen.py quality audit`, every file's nearest
  LOD judged: 168 pass, one fails (Gas_Station/Trash.glb, a photo of litter folded into an 8-triangle pyramid), the
  heavy poles' LOD1 taken; `Content/Studio/Props/retro_audit.json`, the review by eye with its notes in
  `retro_review.json`); the `retro` family (the model kept, low poly smoothed by angle, its texture given base colour,
  ORM and normal by what each part is, a shelf set's grain at real size, baked occlusion and the made props' wear);
  174 recipes `retro_*` in eight groups; the page's Retro tab first in its bar with the groups as chips. Notes for
  before a game ships: Light_Sign says V-Power Racing (Shell's), the cooker carries INMETRO's mark, three posters are
  real campaign posters, the conifers' cut log ends are a Textures.com texture.

## 2026-11-08, night (the user: build it; the reverb from Woohill; into the tutorial)

- **The ask**: "I think for reverb you can lift the system we made in Woohill repo, feel free to work on the rest and
  include them as part of the new tutorial too".
- **Read as**:
  - the sound of rooms is Woohill's sound physics (`tsukibii/woohill`: `game/audio/acoustics.gd` rays for occlusion
    and reflections into four reverb slots, `cinema_mix.gd` the buses and each play's shape, `sound_bank.gd` the tails
    and echoes, `footsteps.gd` a step a stride, `tools/sfx/tails.py` the tails rendered offline), lifted into the
    by-hand starter kit;
  - "the rest" is docs/research/intensity.md §7, built in steps (a commit each);
  - "the new tutorial" is tutorial v2 (Room 304), which gets each step.
- **Its three decisions, taken by me since "feel free"** (say if not):
  - only in the mirror: the mirrors' last layer (19) becomes the reflection-only layer;
  - the player gets no body yet (the out-of-step reflection waits);
  - Nexus Resonance (binaural) waits; the mix pans as Godot does.

## 2026-11-08, later (the user: more atmospheric horror, researched)

- **The ask**: "Any other atmospheric horror elements you can think of adding? Research some more things that could
  elevate our simple game to a more intense level".
- **Read as**: research only, then the user picks (docs/research/intensity.md). What's researched already isn't
  repeated (jump scares, the dread curve, loop games, story in objects, the eye candy catalogue, HORROR_TODO); this
  covers what isn't: sound and the player's own body, pacing and the threat's warning signs, the uncanny seen.

## 2026-11-08 (the user: a better flashlight and the level's air: "a beam in a fog", a fog level, dust; eye candy first)

- **The ask**: "Anyway we could work on a better flashlight + level atmosphere system, you know when we put a light in
  real life in the woods it's more like a beam in a fog, maybe have a fog level adjuster and dust particle visible,
  before you do anything do eye candy research meaning the little visual things that make the game feel more immersion
  and then work on this, include this system part of the tutorial too".
- **Read as**:
  1. research first: docs/research/eye_candy.md;
  2. then build the system;
  3. then put it into tutorial v2.
- **The research found** (the fog lab, measured in Godot 4.7):
  - The balanced look's haze (0.009 at anisotropy 0.55) leaves the flashlight's beam **invisible** from the player's
    eye: 0 out of 255 in the air 6 m out. The forward-scattering 0.55 takes about 90% of the beam a holder would see.
  - Godot's froxel fog only draws a soft glow, and froxels at 128 cost 9.5× for an edge 2 px sharper.
  - A beam drawn by its own shader with a flashlight's cookie reads as a beam, costs a quarter of the froxels' time and
    leaves no ghost.
  - Dust motes show only in light, but need a back lobe to glint in your own beam and a knee so the moon doesn't
    speckle the sky.
- **To build** (the note's §2.4):
  - **HSAtmosphere**, the fog level: one number, ground mist drifting on the wind, dust, `fog_to` for moments, presets;
  - **HSBeam**, a light's beam in that air, on the flashlight by default; the flashlight's own froxel fog energy off;
  - **the flashlight's cookie**: a hot core, a ring, the spill;
  - **HSDust**, motes lit by every light.
- **Then eye candy A**: the TV lighting the room, a pickup's glint in the beam, eyeshine, moths round a lamp, dust
  shaken down.
- **Then into tutorial v2**: the atmosphere and the eye candy, with the Look nodes it doesn't use yet (the tape, a
  shaft, a pattern light, a puddle, a leak, her look).
- **Later the same day**: "The dust motes look too stylized, can you research on making better more realistic motes".
  Researched (docs/research/eye_candy.md §2.3b):
  - dust is flat flakes and lint, which flash as they tumble;
  - it's white in the light's colour;
  - the eye sees sharp points where a camera sees soft discs;
  - it rides slow air in eddies (curl noise);
  - sizes vary widely.

  The motes were rebuilt that way.

## 2026-11-07, night (the user: "tutorial v2": a hotel floor from the scene builder to a story built by hand in Godot)

- **The ask**: "can you make a tutorial that goes from modelling an interior for a floor in a hotel to building out the
  story from scratch in godot using our plugin (not director), should make use of every aspect we've added so far, its
  basically a tutorial, call it tutorial v2 in the html guide we made". Read as: the by-hand route (the Look plugin and
  the starter scripts, no Director), a second tutorial beside guides/first_game, its card in guides/index.html titled
  Tutorial v2.
- **Built**: `guides/tutorial_v2/` (Room 304). It covers:
  - the hotel floor modelled in the scene builder: two floors, a dog-leg stairwell, rooms, doors locked by a key's name
    and for good, windows, furniture, lamps, paint;
  - exported for Godot;
  - a by-hand project lit with the Look plugin: light zones, flickering tubes, a dying bulb, rain and a street lamp, a
    car's lights, a CRT, a mirror, a wet floor, blood;
  - the story built from the starter kit: a to-do list, a note, a key, batteries, moments, music by mood, room tones,
    lights that dim and come back or go out one by one, the flashlight on batteries, a character who backs off from
    the light, the hush before a jump scare, the fire door's ending.
- **What it needed**: the set `hotel_floor` (its `layout.py` and `layout.json`); a door's lock in the interior export
  (extras `locked_by`, kept by door.gd); the starter kit grown with story, sound, room_tone, event_area, pickup, note,
  flashlight, light_shy, lights and reach, with door.gd, scare_area.gd, player.gd and interior.gd extended (the first
  game unchanged, FIRSTGAME); `godot_byhand.py new` giving a project the sound shelf (`sfx/`) and the moods (`music/`);
  TUTORIAL2 (`tools/godot/tutorial_v2.py`) building it as the steps say and playing it through, with the pictures (Godot's
  and the scene builder's).
- Not in it: the Director (the user's "not director"), the street (a hotel floor stands alone; the first tutorial
  covers streets), made props (they need Blender to make; mentioned under where to go next).

## 2026-11-07, later (the user: "go for it": the lights, then the flashlight, then the sound that can go quiet)

- Asked which to build first ("the lights fix, then the flashlight, then music, room sound and the hush, since most of
  the other scare features depend on it"), the user: **"go for it"**. So: HORROR_TODO 0 (lights that dim and come
  back), then FLASHLIGHT_PLAN §1 and §2 (the flashlight on batteries, characters that feel its light), then HORROR_TODO
  13's first (music and room tone played, the hush before a sting), one step a commit with its TestRoom001 station.
- **The lights, built** (HORROR_TODO 0): `light` with `to`, `secs`, `over` (not `fade`: the screen's own verb, which
  the story check reads as a second command), `mode` and `set: normal`; a timed change laid over the light's own state
  and gone by itself, `on` and `normal` bringing back its own brightness and flicker; `lights_die` on one `light` or a
  room, `order: "toward"` with its `gap`, every light back as it was; a Director state's light let go back as the
  level has it; the Scares cards *A light dims* (the light nearest where it lands, `{light}`) and *The lights die one
  by one*; the desk's quick beat *A light dims*; `loop_hall` and `cut_away` out of the palette (the check warns).
- **The flashlight on batteries, built** (FLASHLIGHT_PLAN §1, but its props): a `battery` on the flashlight item, a
  bulb's or an LED's beam by its charge, `low`/`dead`/`changed` heard, `battery` items as sets changed by themselves,
  the pause menu's charge and change, the story's `dim`, `drain` and timed `flicker`; the condition is
  `{"charge": 0.25}` (a number, as the editors' forms take).
- **Characters that feel the light, built** (FLASHLIGHT_PLAN §2, but `avoids`): the beam tested against the cast and
  the things a trigger names, `lit` and `flashed` heard, the cast's `beam` (backs off, freezes, flees, vanishes,
  covers her eyes, comes, charges; `near` making the lights round her flicker, dim or die) and the `beam` action, the
  sight's `torch` (the light gives you away); in the Director the character's Feels light rows and four People cards
  dragged onto her, a Reactions card dropped on her firing when the flashlight is on her.
- **The sound that can go quiet, built** (HORROR_TODO 13.1, jump_scares.md §8): the story's `music` plays at last,
  each mood (calm, uneasy, dread, chase) a bed rendered from the score room's own cues by `tools/score/moods.mjs`
  (`Content/Studio/Music/moods/`, a game's own `Music/moods/` over them; MOODS), looped and crossfading with equal
  power, kept with the run; a room's `tone` (a loop off the sound shelf, `game.tone` the default, `none` silence)
  crossfading room to room; the `hush` action (the beds down to nothing, the last half second silent, the beat waiting
  it out, then back over `back` seconds) and the jumpscare's `quiet` (`game.quiet` for every one). Music on the Music
  bus, the tone on SFX (both made when a project hasn't them, so the pause menu's rows work); owned by the main scene
  (Godot's `beds.gd`, the desk's `play/beds.js`), so the music carries through scenes; on the play's clock, so a hush
  ends with its beat's wait even on slow frames. Sounds in the room (the shelf's, the little things') aren't hushed:
  they're the world's. The Director: a room's Tone, the game's Tone and Quiet, the Music and Hush commands.

## 2026-11-07 (the user: a list to build for a motel game; jump scares researched; a flashlight on batteries; characters that feel its light)

- **The question first**: "Can you think of some game elements we should add that we might be missing. Do we have an
  easy drag and drop way to maybe cause an event to dim the light temporarily e.g. if quest x and player triggered
  event y light turns off or dims (we can select which light). What other elements would be good to make a horror
  game ... imagine we are restricted to making a game that takes place inside a motel or hotel based off current
  mechanics what else could help keep the game interesting for 1-2 hours." The answer: a moment (WHEN, ONLY IF quest
  X, THEN Light) picks one light by its node's name and turns it off, on, flickering or dim, and the Scares card *The
  lights die* darkens a room for a moment; but **dim and flicker never go back** (`on` leaves a light at 35% or still
  flickering: play.gd `light`, runtime.js `light`), *the lights die* is a whole room's and turns every light in it on
  after, a Director state's light isn't let go when its condition stops, and `loop_hall`, `cut_away` and `stalker` are
  in the panel's palette but Godot only logs them. Then ten things a motel game lacks.
- **"We can ignore 7 since we don't have audio dialogue, can ignore 10 too. Rest add as a list to implement but note
  anything that doesn't exist like vending machine or whatever needs to conform to the standard of existing props like
  logo-able cans etc and need to be easily customizable."** So: the ear to the wall (7) and the log of everything read
  (10) are dropped; the rest is a list to build, **docs/HORROR_TODO.md**, the lights' fix first; every prop it needs
  that doesn't exist yet (a vending machine, an ice machine, a landline, door numbers, a neon sign, the batteries...)
  is a **prop generator recipe of a customizable family** (PROPGEN §25, as the cans, the bottles and the rice cooker:
  `CUSTOM = True`, the maker's mark a `brand` or your `logo`, every print a slot your picture replaces in the picture
  editor, PBR sets per material, parts that open where the real thing's do, sockets for what glows, its kept picture
  and passes, made into the library and Godot), or a kit thing with its `mats` where the kit makes it (a door's chain,
  a bed on legs).
- **"Can you research some more jump scare game stuff, how its done well and come up with what we'd need to add (if
  anything)."** docs/research/jump_scares.md, its last section folded into HORROR_TODO.
- **"Can you design a flashlight that's battery powered and has flicker mechanics etc, we also want mechanics where a
  npc might not like light so backs off (so we need a drag and drop thing for npcs to basically let them know if
  someone is flashing a light at them so we can trigger reactions or mechanics off of that)."** Designed in
  **docs/FLASHLIGHT_PLAN.md**: a charge that drains while it's on, an old bulb's beam yellowing and dimming or an LED's
  step down, flickering as it runs low, batteries found and changed, the story's flicker and dim with a length;
  characters and things that feel the beam (`lit`, `flashed`), a reaction of their own dropped onto them in the
  Director (backs off, freezes, flees, vanishes, covers her eyes, comes toward it, charges) and any moment off it.
  Not built: waiting on the user's yes.

## 2026-11-06, last (the user: the rivers scrapped; the foliage and rocks kept as props, for gardens)

- **"Scrap the rivers, keep all the foliage and rocks you made as props to generate. I'll use them for gardens."** So:
  the street builder's river (its bed, water, banks of stone and concrete, white water, falls, the rocks in it) is
  gone, with the three river streets (`river_town`, `mountain_stream`, `park_brook`) and the park (`park_stream`);
  paths, steps, the ground's hills and flats, scatters, the bridges, lamps, boards, log rails and stone walls stay
  (a garden's); the two step streets (`garden_steps`, `shrine_steps`) stay as what they are. The prop generator's
  **foliage** (the trees, bushes and the blade plants: PROPGEN §18) and **rocks** (§28) stay as recipes to generate,
  for the user's gardens (`python tools/propgen.py make <names> --library`, or the prop generator's page).

## 2026-11-06, later (the user: the 1:1 dropped; a simple park with a stream; new rocks after a Blender tutorial)

- **"Ok, forget the 1:1 now, a lot of the environments you made look ugly (except for the new realistic plants they
  look great), can you create a simple park with a small river stream. Maybe work on modelling some new rocks, research
  a Blender creating realistic rocks tutorial first."** So: the five matched streets stay as they are (the 1:1 work is
  done with, not to be polished); what looks good is the realistic props (the trees and the blade plants); the next
  step is a park that looks good, not one that matches a photo, and real rocks before it.
- **What came of it** (the same day): docs/research/rocks.md (what Blender's own rock generator and the tutorials do,
  and what we take); the prop generator's **rock family** (PROPGEN §28: a boulder, a rock, a river stone, a slab, a
  patch of pebbles, a cluster; granite, basalt, sandstone, limestone, slate, river; moss, lichen, a wet line); the
  street builder's rivers and banks took the made rocks, and the **park** `park_stream` was built round a stream
  (both scrapped the same day: the next entry; a thing's `fit` and `top` for a prop stay).

## 2026-11-06, later (the user: "I want a system for building these kind of stairs": exterior stair stacks)

- **Three photos** of Japanese exterior stairs, and "I want a system for building these kind of stairs":
  1. A TV still of a three-storey apartment block (a danchi): open walkways along the front on every floor with white
     picket railings, the slab edges painted light blue; the stair in front of the walkways: one straight concrete
     flight a storey, each in the other of two lanes side by side and climbing back the other way, so the two
     flights cross in an X from the street (a scissor stair), landing on the walkway at alternate ends through
     openings in its railing; white pickets on the flights; a curved amber canopy over the mailboxes at the foot.
  2. A stock photo of a modern mid-rise: a dog-leg stair stacked up the building's side in a recess between a tiled wall
     and a column, two flights a storey with a half landing at the turn, the landings' fronts solid metal panels with
     big rounded corners under a thin handrail, a downpipe beside it.
  3. A stock photo of a tall apartment tower: a steel dog-leg stair stacked up an open concrete shaft, two flights a
     storey with pickets (vertical bars), a thick concrete landing slab at every floor between the shaft's side walls,
     the floor numbers painted by each landing.
- **Built as the street builder's stair stacks** (STREET_BUILDER §5c): the `stairs` part's `floors: [a, b]` climbs the
  building's floors a stage a storey, in a `form` (zigzag, straight, dogleg), a `style` (concrete, steel), a `rail`
  (pickets, panel, parapet, pipe, none), a `shaft` (none, walls) and `gap` m off the wall, beyond a walkway, whose
  railing opens where the landings meet it; the reference street `danchi_court` has the three. The floor numbers and
  the curved canopy aren't built (words on a wall need a texture; the canopy slab stands in).

## 2026-11-06 (the user: the street builder outdoors, the branch `street-nature`)

- **"For street builder I want a new more nature park update, create a branch called street-nature. And using our
  standard for realistic trees and foliage and streets build tools that let you build the following styles. Create a
  plan and then your acceptance criteria is being able to re-create 1:1 framing/shots in our style of each of the
  photos above, note this includes rivers too, the river doesn't need to be moving or anything (we will later create a
  shader for it in Godot, not part of this branch though). Try make sure you can do accurate 1:1s so create foliage,
  fences, stone steps that are needed. Go through it image by image, we are trying to do the 1:1 recreation similar to
  how we did the first street app one."** Five photos: timber sleeper steps up a garden with forest grass and a bell
  light; stone steps up a shrine hill with a log rail, moss and ferns; a river town from above with a red arched bridge;
  a mountain town's stream with a concrete revetment and a blue bridge; a park brook with a timber footbridge.
- **How it came out** (the same day, docs/STREET_NATURE_PLAN.md, STREET_BUILDER §7d): roads of a kind (path, steps,
  river) with banks, the ground's hills and covers on a far grid, scatters, rocks, bridges, a bell light, a paper
  lantern, a notice board, log rails and stone walls, an overcast sky; the prop generator's blade plants (forest grass,
  sedge, flax, reeds, ferns, PROPGEN §18); each photo matched the Shibuya lane's way, with a shot solver
  (`shotfit.mjs`: the camera from pins, the scene placed by casting pixels through it); the five streets' shots pinned
  within STREET's tolerance (0.3 to 1.5% of the frame). The photos stay on the user's machine (`refs/`); the drawings
  are `docs/street_sheets/2026-11-06_nature_five.jpg`. Not this branch's: the river's shader, clouds.

## 2026-11-06 (the user: stairs from points, not presets; winders for tight spaces; the motel's switchback)

- **"Any smarter way we can do stairs indoors (what if they need to be more strongly angled due to tighter spaces)?
  What about outdoor U-turn stairs (motels don't tend to have one direct stair, tends to be two with a platform U-turn
  in the middle)?"** Asked which to build, the user picked sane steep flights (the riser count by the 2R + G rule) and
  turning stairs with winders for indoors, and the motel's switchback along the end wall; then:
- **"Could you create some smart system where the stairs aren't pre-defined but you select end + start points or
  start + mid + end points and they get generated to our rules?"** Built as **stairs from points** (KIT.md §11b,
  STORY_FORMAT §2 `stairs`): a prop names the foot, the top and the points on the way; a point straight on is a
  landing, to the side a quarter turn (a house's winders, three fan treads round a newel: the new `winder` kit; else a
  landing), back the way you came a half turn with a platform across both lanes; the risers by 2R + G = 63 cm within
  the style's limits (a house's riser up to 23 cm, tread no shallower than 18; an apartment's 20 and 23; a motel's 20
  and 26), the treads from the runs, a warning when the rules object. kit.js and storykit/stairs.py lay out the same
  (KIT compares them); the plan makes the flights, landings and winders with their collider steps; the scene builder's
  Stairs tool clicks the way and its inspector shows the risers, treads and pitch. TestRoom001's station 19 climbs a
  stairwell drawn as three points and comes down a house's L with winders drawn as three.

## 2026-11-05, night (the user: stairs of three kinds, floors in the scene builder, climbing in Godot; the branch `gameplay-enhancements`)

- **"Make a new branch called gameplay-enhancements, model different types of stairs (outdoor motel level stairs,
  apartment stairs, interior stairs), update the interior builder so it can support multiple floor levels, make sure
  in Godot we can go up and down the stairs without bugs and it feels good gameplay-wise."** Built on
  `gameplay-enhancements`:
  - **The kit's `stairs`** (KIT.md §11): one flight with its rails and a landing, in four styles with a preset each:
    `house` (a wooden box stair: closed risers and stringers, a soffit, a wall rail; `stairs_house_open` one side
    open with balusters and newels), `apartment` (a concrete flight on its slab, nosing strips, a steel pipe rail on
    posts), `motel` (steel channel stringers, pan treads filled with concrete, a picket guard rail both sides, a
    landing on an edge channel) and `steel` (an apāto's outside stair: checker plates, open risers). **Its collision
    is its steps**: the plan tags the mesh hollow and adds collider boxes for the steps, the landing and the rails
    (kit.js and kit.py make the same numbers; the desk, the Godot export and Export for Godot honour them).
  - **The street's outside stairs** get a `style`: `steel` (the motel's: stringers, pan treads, a picket rail, a
    landing with legs; `hill_motel` wears it) beside the concrete one with a parapet; the walkway button makes steel.
  - **The scene builder's floors** (SCENE_BUILDER §1): named by level (B1, 1F, 2F), added above or below, a floor's
    height set (its rooms, doors and windows move; stairs rooms reach the floor above again), a floor copied up with
    everything in it, an empty one removed; a stairs room picks its *stairs* style and a *landing at the top* (the
    room words `stair`, `landing`), straight flights and dog-legs as kit stairs.
  - **Climbing in Godot** (play.gd, and the desk's runtime.js the same): the export's own box collision never got
    onto a steep house stair at all (the tread two risers up stands within the radius before the feet are on the
    next: the simulation stuck at the foot); now a block is walked onto when its top is a step above the ground
    where the player touches it. The eye glides over every riser (a tenth of a second, every engine's stair
    smoothing); a riser climbed counts toward the footstep's stride (a footfall a tread); the feet rest on anything
    within 6 cm of the centre (a hair's gap between a landing and its wall was a hole three metres deep). The
    Director's physics mode (a floating capsule) climbed already and glides the same.
  - **TestRoom001's station 19** (`n_stairs`, after the workshop scene): a dog-leg stairwell up to a gallery, a house
    stair down, measured in Godot and on the desk: the feet's height at each landing, never stuck, the eye never
    jumping a riser in a frame. Pictured from the player's eye by day and night:
    `docs/godot_sheets/2026-11-05_stairs.jpg`.


## 2026-11-05, latest (the user: the hanging clothes scrapped)

- **"The clothing on the hangers looks bad, just scrap it, all we need is the folded clothing for the suitcase."**
  The `clothes` family keeps `folded` and `stack` (the tee, the sweater, the stack; a pickup that goes into a
  suitcase); its `hanging` kind, the three recipes (`clothes_hanging_shirt`, `_dress`, `_jacket`) and the garments
  on the closets' rails are gone (the rail stays, bare; the shelf's stack and the oshiire's futons stay).

## 2026-11-05, later (the user: the CRT to do; research on simple games that build to dread; suitcases, closets, moveable things and books as parts)

- **"Let's note to do 9."** Candidate 9 of docs/research/sakura_rabbit.md, the CRT screen seen close, is to build
  (the look plugin's `crt.gdshader` on a screen's glass). The other nine stay on the list.
- **"Can you come up with some more research notes, I want my games to be simple but build up to a story / uncovery /
  dread."** Three notes: docs/research/dread_structure.md (how short horror games build dread over their running
  time: the designers' rules, the games' beats measured, a curve for 2.5 to 3 hours), docs/research/story_in_objects.md
  (uncovering a story through documents, books and containers: the rules, a book whose entries are gated by what's
  happened, what persists in a container) and docs/research/simple_loops.md (one loop, a night or a shift, escalating
  into story and dread night by night; the numbers).
- **"For props and Godot I want you to make the following props with workable in-game systems using our drag and drop
  horror engine. Suitcases that can open (and a system for placing items into them, opening them, closing them,
  placement carrying through; think how users can pick up, open them, drop them in), do a variation of 3 different
  types of suitcases and should be easily modifiable. Sliding closet doors, clothing closets, closets with opening
  doors. In Godot add a drag and drop system so we can pick up chairs and place them/drop them etc ... we might want a
  drag and drop element to make objects moveable e.g. if I walk into it it should move, fall over etc, but if we pick
  up and place we should be able to save its default vertical orientation; the direction a chair would face would be
  based off how we picked it up. Create a system for opening up books, in Godot being able to place writing in the
  book that looks like handwriting, being able to inspect objects (orientate them in hand but not equip into
  inventory so they always default back to where they were picked up from). Make sure our models adhere to the
  quality of our other props, feel free to create new Blender PBRs for anything required. An example for a suitcase
  would be a journal, some folded-up clothing. How I imagine opening a book: we can inspect the book (open to the
  page, allow going forward 1 page) and on the right side we have an overlay UI (similar to what we have now when
  reading notes but exclusive to book type props) where we show the UI on the right with clearer text for people who
  don't want to read the book font. Should have a system so I can progress the text, e.g. quest completed, next time
  I open the book I see different text."** Built on `sakura-rabbit-research`: the prop generator's parts that open
  (a lid or a door as its own node on a hinge or a slide, PROPGEN), the `suitcase` family (three kinds), folded
  clothes, the `closet` family (a hinged wardrobe, a sliding closet, an oshiire), an openable `book`; in the
  runtime and the Director the words `open`, `container`, `moveable` and `book` (STORY_FORMAT), with TestRoom001's
  stations for them. Inspecting is the `inspect` use as it was (a small thing taken up, turned, put back where it
  was).
- **How it came out** (the same day): a made prop's lid, doors or cover are **parts** (PROPGEN §26: a glb node each
  at its hinge or on its track, swung or slid by the runtime), the prop placed by its size shut; three suitcases
  (`suitcase_hardshell`, `_softside`, `_vintage`), folded clothes, three closets (`closet_wardrobe`,
  `_sliding`, `_oshiire`) and three openable journals (`journal_diary`, `_notebook`, `_jp`: their pages baked blank,
  written at play in a hand, PROPGEN §27), all in the library (`shape: "asset props/<name>"`). The words: `open`
  (`opened` holds, `closed` is heard), `container` (`placed`, `taken`, `holds`), `moveable` (a RigidBody3D: shoved
  when walked into, picked up upright and put down facing as held: `moved`, `dropped`), `book` (`pages`, `entries`
  with an `if`, `hand`, `read` with its `page`), in Godot, on the desk and in the Director (Opens, Container,
  Moveable, Book; a book's text typed with `===` between pages and `@if` lines for the entries). TestRoom001's station
  13, the things room behind the library, plays them all (GDTESTROOM, TESTROOM). The CRT screen: the look plugin's
  `crt.gdshader` (GODOT_LOOK).

## 2026-11-05 (the user: Sakura Rabbit's Unity experiments as candidates; the branch `sakura-rabbit-research`)

- **"I have a lot of tokens to use up before Sunday, can you create a new branch called sakura-rabbit-research, and
  research some experiments Sakura Rabbit has made in Unity that might be well suited for aesthetics in our engine
  (either studio, or gameplay etc), especially anything on designing clothing via shaders etc; if you find some good
  candidates list them, otherwise we will move on to other research."** The research (docs/research/sakura_rabbit.md):
  ten candidates ranked, the clothing ones first (hosiery and skin-tight layers painted by the skin shader with denier,
  stretch, the view's angle and the band's squeeze; wet clothes; wrinkles that move with the joints and the expression;
  dissolve transitions for a change of clothes, a cover creeping over the skin and a ghost's dissipation; fingers and
  ropes pressing into the skin), then the room that changes, snow as a weather, fabric detail maps, a CRT screen, heels
  by a slider and lids that follow the gaze; for each what she showed, how it is most likely done (nothing is stated in
  public: her files are paid and learning-only, so the ideas are built our way), what we have and what we'd build. Read
  from search extracts: the session's network allows GitHub and little else. **Not decided**: the user picks.

## 2026-11-04, after the wood (the user: the flat's curtains and chairs, a cleaner street)

- **"Can you also update the map to use the new prop style curtains we made, also can we use the non cushion
  versions of chairs in this map. Also remove the bicycles and bins from the outside as they don't look [right], can
  you remove the weird bed that's inside the cupboard/closet too. Just keep the bed in the bedroom and futon in the
  spare room."** maison_1f's windows wear the prop generator's curtains, each made for its window
  (`curtain_maison_bedroom`: blackout drapes, blue-grey, a little below the sill; `curtain_maison_living`: linen to
  the floor; `curtain_maison_washitsu`: a white sheer to the sill), set down from their `box_m` in place of the kit's;
  its chairs bare (`chair_desk_oak`, `zaisu_walnut`: `cushion.on: false`, their pads' settings kept); the oshiire's
  folded futon gone (the bed in the bedroom, the futon in the washitsu); maison_lane's two bikes and two empty plant
  pots at the entrance (the "bins") gone.

## 2026-11-04, latest (the user: real wood in the flat)

- **"If you look at the map you made for the interior, the wooden inside floor tiles look very fake. Can you now
  update the interior so it uses the latest tables and chairs with wood textures, and update and make a custom PBR for
  Japanese wooden floors; aim to capture the realism of the PBRs that we imported from other sources so nothing stands
  out too much and looks more cohesive."** Our own wood sets, made by code (`tools/woodpbr.py`, ASSETS §6) in the
  imported ambientCG sets' shape (2K: colour, GL normal, roughness, occlusion, displacement; a meta.json with the
  repeat) and in git beside them: Japanese sheet flooring (`pbr/floor/FlooringOak001`, light natural oak;
  `FlooringOak002`, stained; `FlooringBirch001`) and glued furniture panels (`pbr/wood/WoodOak001`, `WoodWalnut001`),
  each board its own cut of a log, their colours and roughness kept to measured wood (WOODPBR). maison_1f's wood
  rooms wear `FlooringOak001`, the kit's boards laid where the set's are; its bedroom desk and chair and its living
  room's zataku and zaisu are the prop generator's tables and chairs wearing the oak and walnut sets (`desk_oak`,
  `chair_desk_oak`, `zataku_walnut`, `zaisu_walnut`), with the bed's frame, the genkan's step, the TV board and the
  tokonoma dressed to match (SCENE_BUILDER §10d).

## 2026-11-04, later night (the user: customizable props, not logos on everything)

- **"I think I misrepresented what I meant by logo. I don't mean I want a logo on the models, I mean I want to be able
  to customize certain props that should be customizable, e.g. cans, books, and want a smart way of previewing what the
  uploaded image (the Figma UI thing we did) will look like before actually generating it. I don't care about actual
  logos or marking our models, only for props that we should be able to modify. Plants etc. don't need it; the only
  time a 'logo' matters is if it's an appliance where we want to fake it having a logo, like the rice cookers."** The
  gallery's *Try a picture on them…* is gone. Customizable families say so (`CUSTOM = True`: can, bottle, cup, box,
  sheet, book, pills, appliance, charm, ware; ✎ and a filter on the page). In the picture editor a customizable prop's
  pictures are seen **on its own picture** as they're laid (*Its picture* beside *3D*), lit as Make will light them,
  before Make; and before it's made here at all, from what the project keeps of it (its parts, slots and paint). Only
  customizable props keep their passes and textures (PROPGEN §25).

## 2026-11-04, night (the user: the cafe chair a stool, cushions switched off, every prop's thumbnail)

- **"This one looks a bit weird and the circle isn't attached to all four legs, you can get rid of the small circle
  and backrest and make this a stool instead."** The `cafe` style is a bentwood café stool: a round seat on a bent
  ring, four bent legs inside the ring touching it and the seat, flaring to their feet; `chair_cafe` is `stool_cafe`.
- **"Make sure pillows are toggleable so we can gen versions without pillow."** `cushion.on: false` makes a chair
  bare and keeps the pads' settings: the page's switch in the cushion box's title; every cushioned chair's kept
  picture has one without its cushions too (the card's *cushions* chip).
- **"Can you pre-add (prerender and save) thumbnails for each ... a thumbnail (prerendered image) for each prop but do
  it in a clever way that we can preview what custom stickers would look like on props like cans etc."** Every
  recipe's picture kept in `Content/Studio/Props/thumbs/` (`propgen.py thumbs`), shown on the cards before anything
  is made; beside each, its sticker passes (the light a white matt surface gets at each pixel, a clear coat's gloss,
  and which texture point it sees), so the page lays any picture of yours onto any card in the browser, in the prop's
  own logo slot or as a sticker on a part, lit and toned as the render was, and puts it into the recipe for Make
  (PROPGEN §25).

## 2026-11-04, evening (the user: tables and chairs, and the prop generator on the dashboard)

- **"Similar research: could you create a prop gen for tables and chairs. For tables take a length/width/height
  input; first research generic table styles (wooden) and shapes, then simple modelling techniques, then adding micro
  details (not too many, but cracks, wood grain, scratches, mostly bumps, as I still want to be able to overlay custom
  types of wood PBRs)."** The research (docs/research/tables_chairs.md); the `table` family (PROPGEN §23): `size`
  [length, width, height], eight styles, top shapes and edges, each part rounded for the bake and chamfered for the
  game mesh and unwrapped along its grain, the wood's flaws as relief only (a wood set of your own lies over them).
- **"For chairs currently they don't really look quite right: create some basic chair styles; all chairs should be
  able to support having simple cushions; research via our curtain technique emulating pillows and cushions to custom
  shapes (puffy soft physics and stuff that gets baked); a bit of realism while keeping the poly count low (more polys
  for the sim, then bake and simplify before the final export)."** The `chair` family (PROPGEN §24): eight styles,
  every one taking seat and back pads shaped to it (`families/cushion.py`: the bedding's bag to any outline, filled firm
  between a floor and a ceiling, a coarse mesh of the same outline baked from the dense one), ties round the posts.
- **"Feel free to update the prop gen UI to accommodate for this, also add prop gen to the top in the dashboard
  wrapper so it's easier to navigate (beside studio/interior etc)."** The page reads a family's own `FIELDS` (a
  picker of the settings it takes, each with an example), `CHOICES` (dropdowns, nested ones by their dotted key) and
  `LABELS` (a table's size as length, width, height); the dashboard's start tiles have the prop generator, its page
  moved to port 8799 (the face mocap page had 8797 too).

## 2026-11-04, afternoon (the user: a curtain generator)

- **"Could you try work on a curtain generator prop that uses a bit of drape physics to get more natural curtains,
  ideally the curtain gen prop has fields for how many sides (1 curtain or 2 on each side), you add the height and
  length of the window and it generates curtains to use. Research first for the easiest technique."** The research
  (docs/research/curtains.md): shape the hung curtain from its heading's own geometry, then let the cloth settle with
  tethers to the heading (so it can't stretch) and a tie-back's ring; the prop generator's `curtain` family
  (PROPGEN §22): `window` [w, h], `sill`, `panels` 1 or 2, a heading, `length`, `open`, `tie`, a rail or a pole, a
  fabric; six recipes.

## 2026-11-04, morning (the user: pillows and blankets for the maison flat)

- **"Can you make proper better prop pillows and blankets and then add them to this level."** The prop generator's
  `bedding` family (PROPGEN §21): pillows, cushions, blankets and folded futons made by a cloth simulation (sewn,
  filled, laid over what they're on, folded), their small folds and quilting drawn into the detail mesh and baked;
  six recipes (a buckwheat makura, a bed pillow, a tufted zabuton, a kakebuton turned back on its futon, a comforter
  on the single bed, a futon folded for the oshiire). In maison_1f: the washitsu's futon under the kakebuton with the
  makura, bedroom 1's bed under the comforter with its pillow (the kits' own pillows and duvet off), the folded futon
  in the oshiire, the living room's three zabuton the tufted ones; the washitsu's low table and its cushion went to
  make room for the futon.

## 2026-11-04, small hours (the user: a map-building guide for Claude, and a map from their floor plan)

- **"Create an optimized guide for claude (yourself) on how to use interior and street tool to build a coherent map
  so it's as token efficient as possible."** The skill `/build-map` (`.claude/skills/build-map/`: the steps in
  SKILL.md, the formats compact in reference.md): a layout file into a set (`layoutset.mjs --file`, its `repeat` for
  storeys alike), a street file synced with it (`streetsync.mjs`), the checks by their last lines, the plan and the
  map as one picture each (`plan_view.py --floor`, `tools/godot/map_shots.py`: the set in its street pictured by
  Godot, a contact sheet). Claude never reads a set's story.json, a street.json or the builders' code whole for it.
- **"Design me a map for a short video game which uses image 1 as the floor plan, furnish the place (some basic
  Japanese style furnishing), use PBRs we have where possible."** The set `maison_1f` (Maison Shirasagi): image 1's
  flat as drawn (bedroom 1 with its closet and L-shaped entry, bedroom 2 a washitsu with its tokonoma in the L's foot
  and its oshiire, the bath as a unit bath, the kitchen open to the living room), a genkan carved from the kitchen's
  corner with its front door (a peephole, a latch) onto the block's entrance hall (mailboxes, the glass doors out
  locked by a flag). Furnished from the kit; walls in plaster, the washitsu's a tinted plaster, the bath's white
  plastic, the genkan's floor 30 cm pavers, the tatami's weave, the gate's rusting paint (all sets in git).
- **"We should be located on the ground floor, exterior should be similar to image 2."** A white rendered block of
  four storeys, one flat a floor (the floors above the same flat, bare), tall narrow windows on its stair front, a
  railing on the flat roof, a canopy, the name plate and a lamp over the glass entrance; image 2's brown balconied
  flats beside it.
- **"We should have stairs going upstairs but a gate should be locked preventing the player from going up."** A
  dog-leg stair in its shaft from the entrance hall to the fourth floor behind `gate_bars` (a new kit door: a steel
  gate of bars), locked by `flag:upstairs_open`; the flight up lit, the next landing's light flickering.
- **"The game should be on a curved street ... opposite the small apartment complex should be a curved concrete wall
  with more fancier buildings behind, some street style trees; we won't actually be going outside the interior
  apartment so the street will only be visible from the side windows."** The street `maison_lane`: a lane bending
  round the block's corner, so its front and the flat's south windows both face it; on the bend's far side a curved
  board-formed concrete wall (fences can curve now: `via`) with an old estate under kawara and two modern villas
  behind, street trees down the far walk, poles and their wires on the near side, the bend's mirror. The flat's
  garden screen kept low (0.8 m) so the road shows from the ground floor; the windows' glass exported clear (12 %, as
  the game export's).
- **"Can you use the realistic version of the trees."** The street's trees are the prop generator's realistic ones
  (`zelkova_real` down the far walk, `black_pine_real` in the estate's garden): a street `tree` now names the made prop
  that stands in its place (`prop`), on the page and in Export for Godot (STREET_BUILDER §7c).

## 2026-11-03, night (the user: rules in the editors, exports for Godot, guides)

- **"Is this something that's easy to have as an implemented fix on any interior design or street design? How do I
  prevent future rooms from having this issue."** Then: **"Don't need to update any of the existing maps etc, just make
  it that the interior/street editors carry rules to keep everything proper."** No street.json or set is edited. The
  interiors already build their walls without two rooms' faces in one plane (plan.py's corners, HSRoom's) and the scene
  builder's Check runs LEVEL with those rules; check_all now runs LEVEL on every set too. The street builder's generator
  keeps two pieces apart by construction (STREET_BUILDER §5e: the ground under it all, neighbours' parts and roofs half
  way, pavements meeting once, fences joined at corners, things inset, decals over what's under them); what's placed in
  one plane anyway (a fence along a wall, two things in each other) the street page's **Check** lists, and STREET warns
  about in the saved streets (left as drawn).
- **"Make sure when I export interiors/streets/character models that instead of an export to Unreal/Director there is an
  export to Godot. So if I decide to build the game completely in Godot instead of through Director I can, just have an
  exports folder with sub folders for each to get exported to by default so I can drag and drop them into my Godot
  project."** An `Exports/` folder at the project's root, `interiors/`, `streets/` and `characters/` in it.
- **"Make a guide on setting up Godot for manual creation as well as an HTML guide on using a plugin and maybe a basic
  tutorial for your first game that tells you how to set up each part (interior, street and character) to make your
  first basic game."** In `guides/`.

## 2026-11-03, later evening (the user: lines down the walls)

- **"Looks good"** (the skin and the clothes). **"Could you investigate why we get weird lighting seams (vertical lines
  in the wall)… they kind of flicker as I move."** TestRoom001's corridor: half way between its doors, where each side
  room's dividing wall met the corridor's. A room's north and south walls ran half a wall past their corners and ended
  on the corridor wall's face: two rooms' faces in one plane, z-fighting. They now stop inside the wall that fills the
  corner, capped where it fills it only part of the way up, in the export's plan and in the Director's HSRoom alike
  (GODOT_EXPORT §3c). The Director's rooms had the same in their floors: two rooms' floors overlapping under the wall
  between them, flickering in its doorway; they meet on the wall's middle now. LEVEL and FROMDESK check it.

## 2026-11-03, evening (the user, playing main: the skin and the clothes)

- **"The subsurface scattering seems too strong in game (looks uncanny)."** Their picture: orange rings round the
  eyes, the nose's wings and the lips, the ear lit up red. The skin's depth layer (GODOT_LOOK §5g) is now about a third
  of its first strength, and the lamps' light through thin skin (HumanShaders' translucency, whose ramp starts at pure
  red) at half; GDPORTRAIT fails a glow (no point warmed more than 25%, the ear 30%). The Studio's Depth (game) still
  goes to 3 for a character that wants more.
- **"Clothing clips in different poses (see elbow area), any simple fixes to stop clothing from clipping?"** The simple
  fix games use: the skin an opaque garment hides is left out of the Studio's export (a bent elbow can't come through
  a sleeve when there's no elbow under it); the skin near a garment's edges, under see-through clothes and the feet
  stay (TAILOR.md §3d).

## 2026-11-03, later (the user: `Director-Godot` into main)

- **"Make a PR for this, it looks good and merge in main and resolve conflicts if any exist."** Main (150 commits since
  the branch left it on 2026-10-31: the streets, the prop generator, the clothes, the eyes, the school, the trees) was
  merged into `Director-Godot` first, both sides kept in every conflict (CLAUDE.md's table row by row, the docs' new
  entries side by side, check_all's studio checks together), checked, and the branch merged into main by its pull
  request.

## 2026-11-03 (the user, after trying the Animate tab)

- **"1 tested and works, 2, just go chronologically."** The Animate tab (step 1) works in their own hands. The plan's
  steps go in order from here: the Face page (2), a character's moves (3), On stage (4), paths and patrols (5),
  reactions and scares (6), cutscenes in the level (7), each checked and pushed.

## 2026-11-02, night (the user's answers to the animation plan)

- **Clips: "Kimodo & whatever tooling we are using in director to upload the face videos (if we haven't separated that
  tool out of director tool let's make it a separate page so I can save the facial mocap), make sure I can mix facial
  data with kimodo animations in godot."** So the library takes Kimodo's `.npz` and Godot clips first (FBX and glTF
  later), and the face videos get **a page of their own** (the desk's Expressions import, out of the desk), saving
  the face mocap and making it a Godot face clip; a body clip and a face clip play together on one character.
- **"Nah, I'll just manually move over what I need every project, keep an empty folder for face expressions and
  animations."** No shared studio folder: every new project gets `res://animations/` and `res://faces/`, empty.
- **On stage carried until a later quest changes it**: "sure, go with your suggestion".
- **Cutscenes: "no black bars, not skippable, I'm moving away from cutscenes that feel out of the level, everything
  should feel like it's happening in your gameplay. Cutscenes should have a soft lock… keep the camera focused on the
  spot or NPC that is the target… maybe even allow a camera style zoom in. Need a safety lock though so we don't get
  some glitch where we lock the player into the cutscene forever."** So a cutscene is a moment in the level with a
  **soft lock** on its target (the view drawn back to it, the player still in their body), its zoom the format's
  lean-in and held focus (`push`, `zoom`: the lens never changes, DIRECTING §1), and a **safety release** that always
  frees the player.
- **"Sure"** to starting with the library, the moves and On stage.

## 2026-11-02, evening (the user: animation made easy, by quest)

- **"Anything you can think we could do to make animation, patrol/walking, cinematic animations easy based on
  'quest', should we add an animation and facial animation tab to store animations, these can be project specific,
  how do I easily be like at this point npc is doing this, then if quest complete they get up and walk here with this
  animation, you can talk to them here, they have this expression etc, jump scare plays this… an easy drag and drop
  animation system, ideally I can just drag animations into the folders… come up with a good plan first."** The plan
  is **docs/GODOT_ANIMATION_PLAN.md**: a library of body and face clips filled by dropping files into
  `res://animations/` and `res://faces/` (retargeted onto MHR on import), an **Animate** tab of cards, a character's
  **moves** (PATTERNS_PLAN's motion set), **On stage** per quest (who's where doing what, her face, whether you can
  talk to her, carried until changed, the in-between played by itself), paths, reactions, scares, cutscenes and faces
  by drag and drop. Not built: waiting on the user's answers (its §10) and yes.

## 2026-11-02, later (the user: the story as a flowchart)

- **"Would it be hard for you to make a story flowchart tab where we can basically see the story in a flowchart… we
  don't need the little stuff, only a flowchart of the quests' flow, we also want to make sure we can label easter egg
  quests (special hidden quests that might just be jump scares or certain animations). We should be allowed to set up
  the quests too in this flow (without the detail)… set the branching up in the flowchart… a quest where it's the normal
  path but if you find the easter egg you can maybe skip a bunch of quests and jump straight to another one… then I
  don't have to manually look through 1 by 1 in story and try see prerequisites."** Offered as a main screen in Godot's
  editor beside 2D, 3D and Script, in three steps (the chart; setting up quests and branches in it; easter eggs and
  skips), the user said "go for it". **Story Flow** (GODOT_DIRECTOR §6f): step 1, the chart; step 2, setting the quests
  and their branches up in it; step 3, **easter eggs**: a quest marked `egg`, found during the quests that point at it
  by a WHEN, playing its thing once, then the game going on or a jump ahead (a skip). An egg has no steps of its own
  (they'd hold up the quest it's found in); eggs chain by an ONLY IF on another's `done:`.

## 2026-11-02 (the user: an intro first, quests that aren't lists, and a marker over what to interact with)

- **"Can we update the story so it always starts with a quest1 which is intro, quests shouldn't all be task based"**
  and **"without ripping off the exact same UI element, can you make one that suits our style that helps the player
  know what to interact with… toggle in the UI that we want a helper (identifier)… lightly bounce up and down (in a
  fluid hypnotic motion)… optional… useful for non-list based quests e.g. talk"** (with a picture of a game's yellow
  triangle over a thing). Built in two steps: **the marker** (a todo's `guide`, STORY_FORMAT §4: at first a small gem
  on a thread in the HUD theme's accent, bobbing on a slow sine while its core and glow breathe a beat behind, made
  plainer below; a step's *Show a marker over it* in the Story tab and the Manager; Godot's runtime draws it, the
  desk's Play not yet), then
  **the intro and quests that aren't lists** (a quest's opening, its to-do list shown or not; every Director file
  starting with an Intro quest).
- **"Could you simplify the UI, I actually preferred the duller version you had, and maybe instead of an intricate
  design have it more like a vectorish style"** (with a picture of the marker's first try, pale and thin): the marker
  is a flat glyph now, in the theme's accent as it is (no longer deepened): a diamond's outline on a short stem
  pointing down at the thing, one stroke, no fill, no glow, no pulsing core. It still bobs on its slow sine.

## 2026-11-01, evening (the user: a friendlier panel in Godot)

- **"Is it possible to create a new UI type of panel in Godot as part of the plugin that is more visually friendly,
  category sorted and will sync to the scripts, so I have visual things to drag and drop onto objects or I could just
  click an object and then the UI will have assign to object"**, then **"start by showing me a rough Figma style UI
  design, focus on clarity and ease of use… a plugin that would allow a layman to make a game code free (like Unreal's
  nodes do but even easier), ideally a category for a player prefab so we can just add a player into the starting
  level or testing levels"**: the design is the canvas "Director Panel Design" (five boards: the editor with the
  panel, assigning, the Player, the story as when/if/then sentences, the pieces). The user: "looks good", then "work
  through everything": built in four steps (the Build panel; the Player category; the Story tab; the guide and the
  checks), each checked and pushed (GODOT_DIRECTOR §6e).
- **"For quests do we have talk to as a quest"**: it was there (a step done when she's clicked, or when a conversation
  is heard out: the sample's quest Mari), but two pickers deep and read by a conversation's id. Offered a first-class
  *Talk to…* in the Story tab and the Manager, the user said "ye": who, then when it counts (she's clicked, she's
  heard out, one of her conversations heard out, by its title or first line), kept as the facts the game already writes
  (`talked:`, `heard:`; `heard:<person>` added), read in the same words in both (`words.js`).

## 2026-11-01, later (the user: the desk's games in the new system)

- **"Can we make sure that when we export from director to godot it now follows this format/new system too (if you
  haven't already)"**: a game written on the desk comes into Godot as a Director project, the new system all through:
  the desk's levels as the Director's own nodes, its story as the Director file (each task a quest, its beats moments,
  its endings; the cutscenes and the desk's choices kept as the desk had them), editable in the dock and the Manager:
  `python tools/godot_director.py from-desk <Game>` (GODOT_DIRECTOR §6d). Read as (Claude's call, theirs to change):
  a second way out of the desk, beside the export (`godot_export.py`, the desk's Godot button), which stays as it was
  for its checks and the levels already lit by hand in its versions. Checked by playing the Pilot and TestRoom001
  through on the Director projects as their exports' checks play them (FROMDESK).

## 2026-11-01 (the user: the Director as a puppeteer)

Asked what the Director still lacks against the desk's stories (the little things, interrupts, lines and answers by
what's happened, secrets and achievements, and the smaller ones), the user answered with the shape they want; the plan
is docs/GODOT_DIRECTOR_PLAN.md, waiting on their yes to it.

- **Logic as droppable parts**: "some kind of folder that contains the logic for all these parts as droppables, so I
  can just select an object in the scene (let's say it's a kettle), place a kettle script (the smoke's position should
  be adjustable too, since the exit...), so I can basically make any prop an interactable"; inspecting (picked up for a
  moment, turned round) a droppable too.
- **One world, a director that watches**: "for now our games will be more linear like Chilla's, with just secret
  endings and easter egg scenes in between. Ideally I don't want so much jumping from level to level, but a
  director/watcher script that tracks the whole game's story and quests and checks if the player has done this: should
  they continue, or branch and continue; we never load new levels (unless we change map, e.g. the player gets into a
  car which takes them to a new level); the director just triggers events." Branching that skips ahead ("if this
  happens go here") is for future games.
- **Unlocked by what's been done**: lines and answers by the same state: "has the player done this, if so they can now
  do this", easter eggs needing extra things ("did they do z, or enter x"). A thing used for a quest counts only while
  that quest is the active one ("turn the light on then off: even if we did that before the quest, we wouldn't want the
  quest to complete instantly"); quests are linear, one at a time; a finished task stays, crossed out with a single
  line.
- **Steam achievements later, planned for now**: "build everything around the idea that we will have Steam
  achievements using the existing Godot plugin, unlocked like the director's system, except their criteria might be
  more hidden: variables that are tracked but the player doesn't see as quests". Not built yet.
- **Failing a to-do** is needed: taking too long, or giving someone the wrong thing ("they asked for lemonade and you
  gave them beer"), and optionally not a fail at all: "they just say nah, that's not what I want".
- **Not wanted** (for now): skipping time, answers on a timer, board games (built per game when needed), kit props in
  one click (the user imports their own objects); the odds and ends later.
- **Kimodo's fingers retargeted**, and **faces without the desk**: "a tool to export a facial animation and add it into
  Godot (we'd just have a facial animation folder); the exporter should export the loopables separately."
- **The characters' animation, paths and patrols managed by the director's state.**
- **The plan's §9, answered**: "Just work your way through this in the cleanest best way for yourself": the story
  nodes give way to the Director file (one way to write the story, the scene left as the world), built in the
  plan's order (parts, the Director in the game, the Manager, fingers, faces; achievements designed for, not built).
- **The director's UI**: "a UI-friendly director for Godot; I don't even mind you creating an HTML tools folder that
  lets us manage and save over our Godot stuff via a nice UI". The director "doesn't attach itself directly to anything
  in game (it just sits in the game's main area; a new save should reset, or have a way to manage saves), but we assign
  what things relate to via id: if npc 2 is here and tasks 224, 422 are completed then make npc 2 be here"; "a helper
  tool to see what ids/things haven't been assigned anything in game, so we can figure out what we're missing";
  dialogue managed by the same id state; "the director script just puppeteers the whole game (if that's what makes
  sense; if this is a bad system, make something better)".

## 2026-10-31 (the user: a guide to the Director)

- **"Can you make a .html guide on how to use this tool, if we dont have a dedicated guide folder we should"**: the
  studio's guides get a folder of their own, `guides/` (its `index.html` lists them all, the desk's and the
  export's too, which stay where they are). The first is the Director's, `guides/director/index.html`: start to
  finish with pictures Godot makes of the sample (`python tools/godot_director.py guide`), copied into every Director
  project's `guide/` and opened by the dock's Guide button.

## 2026-10-30, night (the user: "Director-Godot")

- **The game built in Godot itself, no desk in between**: "the goal of this tool is to make a plugin for Godot, so
  rather than going from Director -> Export to Godot, we have all the easy drag and drop functionality and filesystem
  set up that we can just rapidly build out the game in godot without a middle man... I don't need to go through
  director anymore, instead I can just look through my writer block notes and build the game as I want in godot."
  So a third plugin of ours, **HorrorStudio Director** (`GodotPlugins/HorrorStudioDirector`, docs/GODOT_DIRECTOR.md):
  drag-and-drop nodes for the level (rooms, doors, things to take, read, use, hide in or sit on, triggers, spots,
  paths, characters) and for the story (chapters, tasks with their to-do lists, events, dialogue, choices, endings),
  a dock to see and rearrange it all, and the runtime the export already ships underneath: the scene's nodes are
  compiled into the same story the runtime plays, so the controls, the interactions, the HUD, the menu and the saves
  are the export's, one runtime for both. The branch is `Director-Godot`, as asked.
- **"Pre-packaged with all the control system/interactions"**: the runtime add-on (`tools/godot/addons/horrorstudio`)
  comes with the plugin; a Director game moves the player with Godot's own physics (`game.collision: physics`), so
  whatever the user builds or imports in Godot (CSG, a model with its collision) stops them and takes the cursor's
  click; the export keeps its boxes (the desk's parity).
- **Events the user makes**: "I want to be able to make my own events (for jumpscares etc) very easily too, like if
  person moves on this area after they've ticked off these other boolean flags then we trigger this": an event is a
  node: *when* (the player enters an area, uses or takes a thing, a flag is set...), *if* (flags set, flags not set,
  items held), *then* (the actions: a jumpscare, a sound, a light, a line, a flag...), once or every time, at any time
  or only during a task; templates for the common ones.
- **"The most easy to use management system for event tracking, quest tracking, where you are tracking"**: the dock's
  Story tab is the quest log (chapters, their tasks and to-do lists, in play order, dragged to reorder), Events lists
  every event as a sentence, Flags shows where each flag is set and where it's checked (and the ones never set), and
  while the game runs from the editor the dock shows where the player is and the flags as they're set; F9 in the game
  shows the same.
- **"If we can create a godot -> kimodo link that would be amazing"**: a room and a character in Godot sent to
  Kimodo's demo as its stage (the same stage file `kimodo.py stage` writes from a story), and the motion saved there
  (NPZ) brought back as a Godot animation on the character's own skeleton, ready to play by an event or as the
  character's idle and walk.

## 2026-11-02, night (the user: potted plants and vines, on `procedural-trees`)

- **"Could you make some indoor small potted plants with these techniques + the techniques we already use for bowl
  shaped props (maybe do some cubed ones), I'd say make 15 variations, from small to medium (stuff that could sit on a
  table to on the floor), after that can you make some vine patterns (should be seamless so I can just place vines on
  exterior buildings etc, maybe 2/3 variations)"**: the prop generator's `plant` family (PROPGEN §19: a pot turned
  with a real wall or cut as a cube planter, the tree family's growth and leaf cards on its soil; eighteen `pot_*`
  recipes, an aloe on a table to a ficus on the floor) and `propgen.py vines` (§20: five seamless vine sets, a metre
  a repeat, on the project's shelf as `pbr/foliage/vine_*`, laid over any wall's set as a layer by its own mask in
  the street paint).

## 2026-11-02, evening (the user: trees, on `procedural-trees`)

- **"Similar to our prop system can you see if you can incorporate this blender library (its for older versions so may
  need to manually update to the same one you use for props), and create a tree prop generator, trees dont need to be
  massive, just stuff that would be in urban streets, make some variations"**, pointing at
  https://github.com/steven-ray/modular_tree (a fork of Maxime Herpin's Modular Tree for Blender 3.x). Mtree 4's
  core is C++ (MIT) under a GPL add-on, built against each Blender's Python and stopped at 3.2; its growth is ported
  to plain numpy Python instead (`tools/propgen/mtree.py`, nothing to compile, Blender 4.2 and 5.x) and the prop
  generator grew a `tree` family (PROPGEN §18): urban street trees (zelkova, ginkgo, cherry, camphor, plane, maple,
  crape myrtle, black pine, a dead one) by season, with stakes and a tree pit, sixteen recipes to start from.
  Built on the branch `procedural-trees`.
- **"In main I just pushed up some new pbrs for bark, and leaves ... Do these steps separately, every tree should use
  the more real bark pbr. But for leaves create a more realistic category where you use patterns made from the pbrs I
  shared with you for the leaves"**: step one, every species' bark is one of the three ambientCG bark sets by
  default (`pbr/bark/`, PROPGEN §18; the drawn tile stays behind `"bark": {"pbr": null}`); step two, a realistic
  category of trees whose leaf cards are sprays laid from the leaf sets' own leaves (`pbr/leaf/`).
- **"can you create some smaller thinner trees that don't go as tall as a double floor house (and their branches are
  up at 80-90 degree angles so less chance of clipping into the house. call these trees small trees, big trees won't
  be placed beside houses"**: the tree family's `habit: upright` and the ten `small_*` recipes (4 to 4.8 m, 1.6 to
  2.5 m across, PROPGEN §18); `street_dress.py` puts a small tree beside a house and a big one only where no building
  is within `--room` metres.
- **"Just for testing, can you take one of the small streets we've designed in the street creator (I think the single
  road curved one), and add some trees and judge it from aestheticism. Also using the techniques you already have
  could you create some small bushes and shrubs as normal roads and paths normally have a little bit of shrubs poking
  out from paths etc"**: the hill road (`hill_motel`, the one road that bends and climbs) dressed by
  `tools/godot/street_dress.py` and pictured by day and night (`docs/godot_sheets/2026-11-02_hill_motel_dressed.jpg`,
  the judgement in PROPGEN §18); bushes as the tree family's `azalea` (clipped to a ball or a hedge's box), `shrub`
  and `grass` kinds, nine recipes.
- **"make sure generated trees also look good in night both dark night (flashlight style), or more of a blue hue
  atmospheric night"**: `propgen.py godot --night` pictures any prop in Godot under the game's blue moonlit night
  and in the dark under the player's flashlight from the player's eye (PROPGEN §18); the sixteen trees' sheet is
  `docs/godot_sheets/2026-11-02_trees_night.jpg`.

## 2026-11-02, later (the user: the GPU, on `clothing-refiner`)

- **"Instead of re-writing the WebGPU compute for cpu, can you just make a toggle for (use gpu), so I can test it, I
  can later let you use my local claude to run more optimizations"**: *Use the GPU* in the wardrobe and the Studio's
  Clothes tab runs the drape's steps on the card (WebGPU, `tailor/drape_gpu.js`); off, or with no WebGPU, the CPU's
  drape exactly as before. A test switch, remembered per browser, not saved with characters; tuning it is for a local
  session on the 3090 (TAILOR §1i).

## 2026-11-02 (the user: the wardrobe, on `clothing-refiner`)

- **"I notice the clothing modification is very laggy, is there anything we can do to maybe isolate the processing or
  utilize more of my GPU (RTX 3090), like create a clothing edit tab"**; **"a clothing specific tab where we can create
  outfits on a dummy, have it run really well in real time and then load those outfits onto our actual model (be able
  to save outfits sort of how you already have preset ones)"**; **"a bagginess/looseness modifier ... look at those
  shorts, the lines around the thighs and the folds ... a modifier where we just go through various seeds till we get a
  fold style we like (while keeping it tight at the waist), the looseness is just a small gap"**; **"a skirt that only
  goes down slightly below waist/crotch, want to test if those kind of skirts clip less and look more natural"**;
  **"make a note to not affect/mess up anything we've made so far, this should be progressive"**. The plan and its
  ticks: docs/WARDROBE_PLAN.md. Every existing design, outfit and character dresses as before; the new parts are new
  fields, designs and a page.

## 2026-11-01, late night (the user, on the prop generator's pictures)

- **The prop editor's pictures, Figma's way**: "the prop editor is great but a bit hard to use when wanting custom
  images etc, could you make the editor more like figma where maybe there is a panel that shows what the image your
  using its and where the cuts are and then I can either just drag one large image or small ones to fit in the cut
  areas etc. Do this in a new branch called enhance-prop-editor". The page's Texture & pictures tab is now the picture
  editor (PROPGEN §17): the texture with the model's own cuts, its parts and pictures as layers, pictures dragged onto
  a part (they fill it), onto one of its own pictures (they take its place) or over the whole texture (one large
  image, a sheet: each part its own piece), handles, undo, the prop in 3D wearing the canvas, a Krita template out and
  back in. Built on the branch `enhance-prop-editor`.

## 2026-11-01, late night (the user: the sneakers' soles, on `clothing-refiner`)

- **"The sneakers you made are pretty not great especially the soles, look at the [sandal OBJ] to see how the geometry
  can be done better ... I don't mind the boxy retro look either, the main issue is the soles don't look normal, soles
  should almost just be an extension of the normal shape but extruded down (so it can have diff texture)"**: every
  shoe's sole is now the upper's own outline carried down, with grooves and real heel blocks (TAILOR §1h). The OBJ stays
  out of the project (only looked at).
- **"Clean up the weird bulgy/bumpiness, it makes it look like it was made in sculpt tool, should look well
  polished"**: the shoes' shells polished, round heels, the pieces kept off the sole (TAILOR §1h).

## 2026-11-01, late night (the user: the skin's depth into the eyes' pull request, then main)

- **"Can you merge subsurace-scattering-exp into this pr and make sure it works, take a screenshot with the updated
  eyes and sus scatter."** Merged into `eye-enhancements` (tsukibii/HorrorEngine#7): the skin's depth keeps
  GODOT_LOOK §5g, the eyes' wet layer is §5h. Checked together on a fresh export; the sheet
  `docs/godot_sheets/2026-11-01_eyes_depth.jpg`.
- **"can you resolve all conflicts and merge in main too"**: main (the school, tsukibii/HorrorEngine#8) merged into
  `eye-enhancements`; the two met only in DECISIONS and CONTINUE, both kept.

## 2026-11-01, night (the user: cozy and gothic clothes, bigger busts, on `clothing-refiner`)

- **"Note you've been making bras on models that have a flat chest, maybe you should review it with bigger busts"**:
  the cups grow with the breast (TAILOR §1g), reviewed on the full feminine body too.
- **"Make some more cozy clothing following the principles of being able to animate easily without worrying about
  clipping"**: socks in every size, slightly creased and heavier, knee-highs; a raincoat with a reflective plasticky
  look; black loafers; a sneaker designer like the tee's prints (rim highlights, sole colours, a logo, small stickers);
  gothic designs, a spider web fishnet and a mesh fabric rendered in Blender; gothic clothes and props (horns, bunny
  ears), props placed by x, y, z sliders and turns, PBR sets on props. The plan and its ticks: docs/COZY_GOTHIC_PLAN.md.
- **"By rain coat I mean the smaller wind ones, that are almost like hoodies but more of a plasticky texture"**: a
  hooded, zipped rain jacket in PVC, not a long coat.

## 2026-11-01, night (the user, on a small private school)

- **A small private school, one storey, in Tokyo concrete**: "using your knowledge of modern architecture can you create a
  small private school that consists of 1 level, 2 classrooms, 1 lunch area and 1 reception, its a private school that
  is like those remote towns ones that don't have many grades and allow kids to study in the same grade but separate
  maybe by very young and young, give it a rural japanese look". Shown timber references first, then: "not timber for
  now, I like the concrete style, something that would look in place in tokyo (since our street designer was based of
  that kind of japanese tokyo street design)". Built as the set `school_tokyo` (SCENE_BUILDER §10c) and the street
  `tokyo_school`: exposed concrete round a courtyard, the two mixed-year classes (years 1-3, 4-6), the lunch room, the
  reception at the entrance; timber is for later.

## 2026-11-01, evening (the user: the bikinis, on `clothing-refiner`)

- **"Everything looks good, except the women's bikini, thongs (they sort of vertically sit below the waist like boxers
  sit above the waist for men which doesn't look correct as they tend to follow the curve of the hip bone)"**, with a
  string bikini's top and bottom as OBJs and a guide to fitting them. Built: the waistline's `hip` lift (TAILOR §1g),
  every thong, tanga, G-string and bikini brief re-cut on it, a string bikini and a halter triangle top after the OBJs.
  The OBJs themselves stay out of the project (only looked at).
- **"Why do the bras look painted on, also why does the red one attach to nothing around the neck, can you use the bra
  obj model I gave you as a reference to the right way to make bras"**: the halter's strings as tubes pulled taut off
  the body, round the neck, a band and a bow; every bra's cups spanning the breast, with a thickness (TAILOR §1g).
- **"The bras are way too low"**: the fold under the breast found where its underside eases onto the ribs, the cups
  higher (TAILOR §1g).

## 2026-11-01, later (the user: the clothing review, on `clothing-refiner`)

- **"Some of your trousers are baggy at the waist band ... waistband on shorts, pants, anything that's lower body even
  baggy always needs to be skin tight or the pants wouldn't stay on"; "pants shouldn't dent so harshly inwards at the
  knees"; "consider animation ability, we aren't going to do cloth physics so don't want things overly baggy to the point
  clothing will clip through for generic walks"; "a lot of the clothes have a weird butt crack dent"; "even baggy stuff
  like hoodies need to feel like they're fitted, it's the creases etc that create the illusion of bagginess"; "make it
  easy to make custom tees (front prints, back prints)"; "we don't need super unique clothing, just daily outfits normal
  humans wear: smart casual, casual, business, uniforms, pyjamas and bikinis ... really nailing the reusable simple
  elements and let fabric and colour take care of the rest"; "review the current clothing, list a plan to enhance
  everything, and tick as you go".** The plan and its ticks: docs/CLOTHING_PLAN.md.

## 2026-11-01, later (the user, on the school's building)

- **The building is its rooms, to scale**: "Just note the school building needs to be to scale, so the actual rooms
  could fit in, stairs, door way etc." Then two photos of school buildings (a white four-storey one with a stair tower
  of round windows and its name on the roof; a beige Showa one at dusk): "I think the issue is I didn't give you visual
  references for the building, try build a kit that could build these 1:1." So a school's building is a set of real
  rooms on every storey, laid out from modules (classrooms, corridor, dog-leg stairs in shafts, toilets, entrance,
  staff room: SCENE_BUILDER §10b), and the street builds its outside storey by storey round exactly those rooms, the
  facade (eaves, pilasters, guard rails, the name on the roof) from them (STREET_BUILDER §5f). Both photos are rebuilt
  as sets and streets with shots matched to them.
- **The PBR classroom waits for the build**: "Once you're done with the build can you create a 1:1 ref using the pbrs
  instead to see if it helps realism" (asked during the first school build).

## 2026-11-01 (the user: the clothes refined, on `clothing-refiner`)

- **"Inspired by the image of Japanese smart casual outfits create some of these, I think currently what makes our
  clothes bland is we are missing creases, natural fabric kinda style that could be emulated via PBR techniques etc so
  add a crease gen as well (basically how we emulate wrinkles on faces)."** Done (TAILOR §1d, §1f): the creases as a
  height in the garment's shader (folds at the bends, drag lines, the press, seams, hems, the fabric's crinkle), a
  Creases slider and a Pressed crease switch per garment, baked into the export's normal map; the Smart casual tab with
  fifteen outfits and nine new cuts; linen, crepe and flannel as drawn surfaces.
- **"Similar to what we did for props and buildings can you create some procedural materials with blender for the
  clothing in the studio, stuff like cotton, etc."** Done (TAILOR §1e): 26 fabrics as node groups of threads,
  stitches, fibres and grain at their real size, baked in Blender into tileable PBR sets
  (`tools/fabric_bake.py`, `assets/pbr/Procedural/fabric_*`), first in the Studio's PBR picker, tinted by the garment's
  colour.

- **"The bottom of the light blue and white trousers you made looks deformed, should just cleanly sit above the
  shoes"** and **"The baggy trousers shouldn't bend into the knees, as that doesn't make logical sense"**: the wide
  trousers' legs are a straight column from under the seat (`legs.straight`, TAILOR §2), held as cut by the drape, their
  hem clean above the shoe; no knee folds on loose legs, no cloth wrinkles on shoes.
- **No low poly clothes.** Asked to try a PS1-style low poly genre of clothing (decimated garments, chunky texels, a
  dither), then, seeing it: **"Nah the low poly looks ugly ... let's avoid the low poly then."** It was taken out
  before it was committed; don't offer it again.

## 2026-11-01 (the user: the eyes in Godot, on `eye-enhancements`)

- **"Can you make a new branch called eye-enhancements, I dont want to modify too much about the exported eyes, but
  enhance the use of the existing godot shader, atm the eyes look kind of lifeless and scary, it doesnt seem like we
  are applying the eye wetness etc correctly."** Measured on a fresh export with the grafted eyes: the iris read black
  (a bug: Godot turned the iris's bowl upside down, so its lower half faced away from a lamp above), the whites a flat
  grey (the guessed lid ellipse and the socket's shade over a paint at 0.58), and HumanShaders' eye wetness wasn't used
  at all. Done on the Godot side only, the export as it was (GODOT_LOOK §5h): the bowl fixed; **the eye's wet layer**
  (HumanShaders' eye wetness and MetaHuman's eye occlusion as each eyeball's material overlay: the real lids found in
  the depth buffer, a warm shade by them, deeper under the upper lid, the lid's edge melted into the eye) in place of
  the ellipse, the socket's shade halved; the white's light wrapped warm with a little scattering; a crisp catchlight.

## 2026-11-01, later (the user, on the skin's depth elsewhere)

- **The depth past the face's core, gently**: asked "you think we should add some slight SS to cheeks? or anywhere
  else that helps add life?", offered (not a patch on the cheeks: that's blush, the Studio's Flush) a warm edge where
  the skin turns away from the eye, the creases everywhere warm instead of grey, the fingers lit through like the ears,
  the lips; "sounds good, do that". Each gentle by default with its own slider (GODOT_LOOK §5g; HSCharacterLook's
  "Skin depth's parts").

## 2026-11-01 (the user, on the skin's depth; branch `subsurace-scattering-exp`)

- **Subsurface scattering round the face's core, for baked light**: with two pictures of Blender's subsurface
  scattering (a cube glowing orange toward its edges, Suzanne red in her eye sockets and ears): "do we currently use any
  subsurface scattering? I think that's maybe why the characters' skin looks a bit lifeless ... could we add this kind
  of subsurface scattering just around the core parts, eyes, nose ... most of the lights are baked in game, I don't
  even really care about it being realtime and changing, I just want that skin depth kind of feeling around the core
  wrinkle/skin/map; see if you can come up with a simple enhancement for our existing skin shaders". We had HumanShaders'
  scattering, but per lamp, which baked light never reaches. Built (GODOT_LOOK §5g): the skin's depth layer, warm light
  from under the skin round the eyes, the nose, the mouth and the ears (MHR's depth map, most in the creases), the
  occlusion red instead of grey there, thin skin lit through, for the ambient a baked level gives as much as for a lamp.
- **The ears switchable**: "if you add it to the ears make it toggleable, since some NPCs' hair covers their ears". Per
  character: the Character Studio's Skin light, **Ear glow (game)** (and **Depth (game)**), carried by the export; off,
  the ears take none of it and the lamps' light through them goes too. `HSCharacterLook` can override it in Godot.

## 2026-11-01 (the user, on a school)

- **A Japanese school for a horror game, in the tools we have**: "In the existing prop maker/furniture maker/interior
  etc I'd like to have the capabilities to build out a japanese school for a horror game", with a render and a wireframe
  of a classroom they made in Blender. "Use the existing tools to create generators"; "recreate all the parts to be
  able to create a 1:1 of the reference images"; "consider the hallway and exterior building too (a small japanese
  school)". The furniture and fittings are kit types (KIT §10), the rooms the scene builder's (SCENE_BUILDER §10), the
  outside the street builder's (STREET_BUILDER).
- **Books in the prop maker, with covers of your own**: "for the prop maker similar to how we can use custom logos
  maybe allow that for books, books should be able to fit well on desks and inside shelves". A `book` family whose
  covers, spines and pages are the prop's own pictures to swap (PROPGEN §16), at real paper sizes, rows and stacks
  made to fit a box; furniture says where things go on and in it (its places), and the scene builder puts books there.

## 2026-10-31, small hours (the user, on the floors)

- **Kit floors take a material**: "yes make the floors take a material" (offered: a kit floor dressed rather than taken
  up when its room's floor is painted). Painting a floor paints its kit floor's boards (and the room's own floor under
  them); a set that paints its own tiles, boards or mats lays the kit floor out by them, its real gaps in the set's
  seams (found in the set's maps: storykit/pbrcells.py); a plain set gives each board its own cut; a mosaic too fine to
  build lies as one board. The gaps (and a tatami's borders) can be painted on their own.

## 2026-10-31, small hours (the user, on the lights)

- **Lights as furniture, no light sources exported**: "we don't need to export actual Godot light sources, I'd rather
  take lights as furniture approach, maybe stick to rounded LED types of lights for simplicity (where it's a circular rim
  that sits above the ceiling with a glass circle and those kinds of variations)". A story light can have a fitting
  (`kit`): the kit's round LEDs (recessed downlights, flush panels, a dome, a ring); the scene builder puts one on every
  ceiling it lights (by the room's size, or one picked in Finish). In Godot a light with a fitting is the fitting and
  a node, no light source: its glass glows as the story has the light, and the user's own lights put under the node
  follow it (switch, power cut, flicker). Lights without a fitting are as they were.

## 2026-10-31, late night (the user, on the fittings and doors)

- **Fittings and doors take PBRs too**: "make it so we can add PBRs to those, given that we could use the plastic PBR
  for light switches etc". The fittings the scene builder makes (the switch by the door, the built-ins, the stairs, a
  window's frame) and doors (a plain door's slab, a kit door's leaf, handle and frame by slot) are painted like
  furniture, and what's painted on a fitting is kept though the finish makes it again (SCENE_BUILDER §9). A door's set
  rides with it as it swings, in Godot too (`<Name>_obj.tres`, GODOT_EXPORT §3b).

## 2026-10-31, night (the user: "do whatever's best")

- Asked which follow-up next (furniture taking sets, or a street's materials as named files), the user left it to
  Claude. **Furniture first**: a kit thing's slots take a set, a colour or a tuned set (`mats`, STORY_FORMAT §2), the
  scene builder's Paint dresses them with a click, the Godot export gives them the game's `<Name>_uv.tres` (the set laid
  by the kit's metre UVs). **A street's materials stay the street's**: each is a set times a building's colour (and the
  street's own wear atlas after the bake), already one material per set and colour inside its .glb; Godot's Extract
  Materials writes them out by name when wanted (GODOT_EXPORT §3b).

## 2026-10-31, evening (the user, on the interiors, local PBRs and the export's materials)

- **The paint bucket in the interiors**: "am I able to use the paint bucket thing in my interiors, if we haven't hooked
  up our PBRs can we". It wasn't (the paint page was streets only; a room took a plain set from a picker). Now the scene
  builder has **Paint**: the same brush (`brush.js`, shared with the street paint page) on a level's floors, walls,
  ceilings, trim, blocks and outside; a room's look and a block's `mat` take a colour or a tuned set like a street's
  slot (STORY_FORMAT §1, SCENE_BUILDER §9). A room's walls are its own side: a shared wall's other side is lined with
  the other room's look.
- **A PBR local**: "add a PBR local, where I can attach a local folder and use PBRs from it and we export to Godot with
  those". Folders of yours attached to the shelf where they are (the shelf page's *Your folders*): their sets
  `pbr/<name>/<set>`, nothing written in them (ASSETS §6); the Godot export copies what a game uses into the game.
- **One material a set in the export, by its name**: "if multiple parts use the same PBR it should be smart enough to
  only export that material for Godot once and re-use it; maybe when we export we have a separate material folder using
  the name of the material, so even later on we can just ref that one PBR mat for many parts". `game/materials/<Name>.tres`
  a set, its maps beside it, every piece on every level wearing it by reference (GODOT_EXPORT §3b).

## 2026-10-31, afternoon (the user, with their PBR sets)

- **The materials are PBR sets**: "I realise without PBRs we can't achieve the fake photorealistic look, I pushed up a
  branch for you to merge into this one called pbrs, implement these PBRs into the paint bucket style". Merged: 37
  ambientCG sets (CC0, 1K) in git at `pbr/<category>/<set>`, the shelf reads them, the paint page's library is them
  by category (the procedural library folded away), each with its real size in its meta.json (ASSETS §6).
- **Layers over them**: "come up with a layering tool system where we could layer some of the stuff you made with the
  PBRs too (mainly decals, added wear etc), the actual materials should be PBRs". A look is a set with layers: another
  set over it (in patches or by its own mask, its colour, shine or relief) and the bake's wear per surface (grime,
  streaks, edges, damp); decals lie over any of it (STREET_PAINT §3b).
- **Tint controls**: "see if we can modify the tint of the colour (fade it out, make it more contrast etc)". Tint,
  brightness, contrast, saturation, hue, fade, roughness, relief, size and turn, all made into a set of its own by one
  function, so the page, Blender and Godot match.
- **The 1:1 photo again, with PBRs**: "re-create the 1:1 image we've been using using the PBRs to check how much more
  realistic it looks (pick the appropriate PBRs that match roughly the actual colour)".

## 2026-10-31, late morning (the user, on the research, the road and the light)

- **The light is the user's, baked by hand in Godot**: first "I don't think I want to use LightmapGI, I will want the
  other one that starts with V", then "don't worry about VoxelGI or whatever, I will manually take care of light baking
  in Godot, you just need to worry about being able to export to Godot so I can use it and roughly have the collisions
  accurate for buildings and floor so I don't fall through". No GI tooling of ours: the street exports to Godot with
  its colliders (STREET_TEXTURING §3, §4).
- **Road paint part of the road**: "the print on the road looks like it's floating above the road because of the shadow
  effect, when it should look part of the road". Road paint and decals cast no shadow anywhere (the street builder's
  view, Blender, Godot), the lines lie 5 mm over the asphalt and a mark 5 mm over them, stacked only where marks overlap
  (STREET_BUILDER §5d).

## 2026-10-31, morning (the user, while the paint tool was built)

- **Wear and tear in every material**: "can you also create pbrs/bump maps for the textures/materials as well as
  procedural wear and tear. In reality there's no perfectly smooth things, and things get weird and tear and chips or
  smudges, fingerprints etc, that's what adds to the realism". Every library material and finish wears its
  imperfections as it's baked (smudges, fingerprints, scratches, chips, cracks, dents, splits), every set has its
  height map beside its normal map, and seven decals put wear where it happens (STREET_PAINT §3, §4).

## 2026-10-31, night (the user, on `prop-gen-tool`)

- **No part of a prop see-through in Godot**: the user saw the rice cooker's bottom through its sides. Faces are
  judged by measure now (PROPGEN fails a case when more than 1.5% of what's seen from outside is a face's back), not by
  Cycles' previews, which draw both sides.
- **Every prop's pictures swappable on the page, with a size for each**: "Make sure for each type of prop we can
  generate that we can easily swap out logos, decals, flourishes, smudges, etc (recommend image size for everything) in
  the wrapper". So each logo, picture, ornament, stamp and print a prop's paint draws is a slot of its own
  (`pictures`), decals repeat as flourishes, smudges are built in or yours, and every one shows the size it wants
  (PROPGEN §15, docs/PROPGEN_PICTURES.md).

## 2026-10-31, evening (the user, on `prop-gen-tool`)

- **Enhancers for the props, in Godot, easy to switch off**: "consider if there are some simple shaders/enhancers for
  some of the props ... like how do we make the led panel in the rice cooker glow ... make them part of the export for
  godot (they should be exported as godot ready objects and come with shaders/enhancers that can easily be toggled
  off)". So emission maps for what glows (LEDs, the LCD's backlight, embers), `propgen_fx` in each glb, the look
  plugin's `HSPropFX` (glow, a candle's flame and light, incense smoke, steam, wax; each a switch, a kind off for a
  whole project in its settings), the game putting one on every made prop, and a `.tscn` beside every glb ready to
  drop in (PROPGEN.md §14).
- **The rice cooker's panel**: "looks like it's clipping through the white at the bottom", then "still doesn't
  conform to the natural shape, seems like it's larger than the lid, maybe just change the placement to be on the
  lid". It's a thin pane on the lid's front now, bent to the lid's dome, inside its rounded edge.
- **The pots' handles**: "the handle pokes out a bit too much": their ends go into the wall now.

## 2026-10-31, before dawn (the user, on texturing the streets for real)

- **Research first: faking photorealism like Battlefront**: "do some research on how we could fake photo-realism (think
  of the new Star Wars Battlefront games look); we will be using a vhs effect so it doesn't need to be hyper detailed,
  but fake the textures and materials and even fake pbr bumps (can be procedural) and add a photo realism effect".
  docs/research/photoreal.md: right values, right light (the sky's bounce baked: LightmapGI with a live sun, Battlefront
  II's split), right flaws; little spent on micro detail.
- **A paint tool, like the prop tool**: "a simple python script wrapper tool (similar to what that prop-tool is doing),
  where I can paintbucket paint on the materials and then zoom in to add decals"; "pre-make a bunch of building, street,
  roof tile etc materials to paintbucket, based off the Japanese materials in the real photos"; "only worry about the
  exterior street designer parts, although I would like to be able to override any object imported from the interior
  tool's exterior".
- **As photoreal as can be, 1:1 with the Shibuya photo**: "it doesn't literally have to be 1:1 with the same decals, but
  material wise it should almost trick you you're looking at something real, without hard shaders and lighting (it can
  be baked in like Star Wars Battlefront, the latest one)".

## 2026-10-31, small hours, later (the user, on the bungalow's roof)

- **Never any clipping**: "in the individual house one it looks like there is clipping on the roof (wall top lines
  peeking through) etc, refine the system so we never see clipping". Walk-in roofs are boxed, 1 cm over the level's
  top; roofs over an L or a T are joined into one; the whole generator keeps faces out of each other's planes by rule;
  STREET fails on any two faces of a piece in one plane over each other (STREET_BUILDER §5d).

## 2026-10-31, later (the user, on `prop-gen-tool`)

- **A page over the prop generator, with thumbnails**: "how do you add varying textures and logos to generations,
  could you make a wrapper for these python scripts with thumbnails". So `tools/propgen/serve.py` (port 8797,
  PROPGEN.md §13): every recipe as its picture, a form built from the recipe, pictures clicked onto the texture where
  they should go, PBR sets per material, variations by seed, 3D, saved as recipes. And two keys every family takes
  now: `decals` (a picture on any island) and `pbr` (a PBR set over a material), so logos and textures aren't only
  where a family had a print.
- **Before that** (the same day): "what if I want to generate a cup that can be empty or filled with tea/green
  tea/black tea etc, or add custom logos to electronics". The teas as liquid kinds, a `color` that reaches the
  surface, a `logo` on the appliances; an empty or full cup is one prop, its fill set per copy in Godot.

## 2026-10-31 (the user, on `prop-gen-tool`)

- **More of the prop generator, the occult and the kitchen**: "Can you add some more occult props, wax candles,
  altars, japanese occult stuff, add some better cooking pots and maybe do a better textured version of the rice
  cooker and kettle, make some better sinks etc". So new families, nothing made before changed (as the night's rule
  says): `candle`; talismans as a design (`ofuda`) and `charm` (ema, omamori), `rope` (a shimenawa), `doll` (a
  wara-ningyo, a kokeshi), `shrine` (a hokora, a sanbō, an orin, a kōro, an offering table); `cookware`, `appliance` (a
  rice cooker, an electric kettle), `sink`. Altars are put together from those pieces; a butsudan or a kamidana is
  furniture (the kit's), and masks and statues want a sculpt (PROPGEN.md §12).
- **Liquid inside, Half-Life: Alyx's way, and a pill bottle** (earlier the same night): "an effect that makes it look
  like there is liquid inside ... a godot shader that uses the shape of the bottles interior", "a pill container
  that's slightly tinted (or easily tintable), with a sticker that's easy to change ... and have tablets inside too".
  The liquid node and its fill table, HSLiquid in the look plugin (PROPGEN.md §10), and the `pills` family.

## 2026-10-31, small hours (the user, after the street's textures)

- **The shop door readable**: asked what the thin dark lines in the shop windows were (a glass door's two uprights),
  "yeah make it more readable". The door has its frame all round, a kick plate, a push bar and its own darker pane.
- **Enterable buildings designed whole in the scene builder**: "the map will be a mix of enterable buildings made via
  our previous interior tool, and the non-enterable ones made for the street designer; could you enhance the interior
  designer too so we can make roofs etc that will help match the style of our street designs. Ideally I can import an
  interior designed space into the street, then build the rest around it. In reality we probably will only have a few
  buildings that we can enter". The scene builder's Outside panel (SCENE_BUILDER §8): the street's styles, walls, roof,
  raise, front and fittings, seen round the building, kept as the level's `outside`; the street builder's palette has
  every set, and its building wears the set's outside until it's changed in the street (STREET_BUILDER §5c).

## 2026-10-31, past midnight (the user, on texturing the streets)

- **The most aesthetic surfaces, wear and decals**: "when it comes to texturing the streets, what would be the most
  aesthetic way to do it; for wear and tear and decals etc, is the best way to do it similar to how we are doing it in
  the prop-gen-tool branch; can you make a test Blender baked texture render, try to imitate the photo reference".
  Answered in docs/STREET_TEXTURING.md: finishes that tile at their real size, the street's own wear in one low-res
  atlas (the prop generator's idea at a street's scale), decals next; the test is the Shibuya lane through its shot.
- **Procedural first, PBR optional**: "investigate if you can use procedural textures (and bake them in) instead of
  importing PBRs; if PBRs are needed find them or make it optional so it's easy to texture the model/street how we
  want to". The finishes are Blender nodes baked onto the PBR shelf (`assets/pbr/Procedural`); a street's
  finish.json puts a set of your own on any slot or material.
- **Street → Blender → Godot, with easy collision**: "I think a street -> blender -> godot workflow could work well
  because we could add foliage easily then, but something to consider is how would we add easy collision".
  `tools/street.py bake`: the .glb and the .blend (its Foliage collection kept between bakes), the street's colliders
  by name, Godot's own suffixes for what's added (STREET_TEXTURING §4).

## 2026-10-30, night (the user, on a branch of its own: `prop-gen-tool`)

- **A prop generator like the Free Street Litter Sampler's**: "Figure out ... how they did it ... I want a tool for
  making small props easily too ... I have blender locally so am ok with having a tool where we export the props
  from". Their note: "All meshes and textures are generated by our own Python scripts in Blender. No image or 3D
  generator was used." So `tools/propgen.py` (docs/PROPGEN.md): Python in Blender, the shapes from measurements, the
  damage and the print by code, the detail baked; the sampler's twenty kinds of litter remade with our own brands.
- **Into Godot**: "Make sure that we can export these models to godot once you're done". Made props go into the
  library as `props/<name>` (a story's `asset props/<name>`), the Godot export copies them; GDPROPS reads their
  materials back in Godot 4.7.
- **TestRoom001's things as generators**: "create prop gen tools for those kind of designs so we can design our own
  utensils (diff metal scratch patterns), kitchen stuff, key shapes, etc, no rough edges, we don't want props to look
  low poly, but try keep poly count down by being smart. If these elements don't fit the gen tool though tell me".
  The utensil, key and ware families and the metal finishes; rounded edges kept in normal maps baked from a detailed
  copy; PROPGEN.md §7 says what fits and what doesn't.
- **Our own furniture worn, PBR sets underneath**: "import furniture we've designed in our interiors and add
  scratches, dents, etc (similar to how you add the crush pattern) ... baking it in", "a selectable pbr uploader so if
  I want to attach custom pbrs before we bake and overlay textures onto we can". The `import` family (a file or a kit
  preset), PBR shelf sets by triplanar projection, `propgen.py pbr` and `pbr-add`.
- **"If any of this conflicts with what you already designed above just make new tools instead"**: everything after
  went in as new families and options; nothing made before changed.

## 2026-10-30, later night (the user, after the street builder's first round)

- **Into Godot by hand, by dropping a file**: "as long as the export is as simple as drag and drop into a godot folder
  I don't mind handling that part manually". The .glb carries its colliders, occluders, lamps and the insides' places
  (STREET_BUILDER §5b); GDSTREET imports it in Godot 4.7 as the user would.
- **Slopes and curves**: "add slopes and curved". A street is a smooth curve through its points, each with its height;
  the ground and everything on it follow.
- **Big streets**: "for big streets handle that how you think we should". Chunks merged by material, a piece rebuilt only
  when it changes, occluders for Godot.
- **The interiors in the street**: "consider how we can integrate the interiors we designed into the street map... a
  motel... sync the door shape and let a player enter, exit; we also need stairs so they could reach the second floor,
  maybe gates... we will stick to 1 floor for our game interiors for now; the other scenario is a bungalow; I don't know
  if the interior builder already builds the exterior". It doesn't (plain 10 cm walls in the room's own colours, a flat
  ceiling slab, no roof): the street builds the outside round a set's level (STREET_BUILDER §5c).

## 2026-10-30, night (the user, starting the street builder on `buildings-streets`)

- **A street builder, apart from the scene builder**: "make a new branch called buildings-streets. The goal will be to
  be able to create aesthetic but low-poly buildings and streets like this; this should be a new tool in the dashboard,
  not the existing interior building one: it's for building the map we'd place the enterable buildings into
  (enterable buildings are ones we build with the current tool); this new one is more for aesthetics". So
  `tools/director/street.html` (docs/STREET_BUILDER.md), its streets in `Content/Studio/Streets/<name>/street.json`.
- **Very simple to use**: "very simple to use like our existing tools for building things (easy to add protrusions,
  windows, doors, roofs etc), should have the ability to paste in a front and side view reference, should be super
  easy to use that even a layman can use it". The facade view: the front and a side flat on, a photo pasted behind
  each, parts clicked onto the wall, floors by dragging the roof.
- **The first reference matched, 1:1 framing**: "try make the tool and recreate the shot in image 1, 1:1 (without the
  photorealism but with the same framing and composition)". `shibuya_lane`, its shot `photo`, held to the photo by
  pins (STREET).
- **More kinds of buildings and streets, and the things in them**: after five more references (a white tower with a
  glass-block stairwell, a quiet stucco house front, a shopping street of lantern lamps under a mountain, abandoned
  concrete flats with shutters, an old post town at dusk): "don't worry about foliage for now, but if you could add
  simple assets for street lamps and other stuff like that it would be great, also fences, different types of fences,
  metal mesh, long, wooden; should be easy to apply PBR to but also be low poly count. We want the overall maps to feel
  tight and filled so the user doesn't feel isolated but instead cozy, even in horror creepy games". So a building
  style per reference, lamps, poles and wires, street things, eight fences, every surface a slot that takes a PBR set
  at its real size, and *Fill a street*: buildings shoulder to shoulder, lamps, wires and clutter in one click.

## 2026-10-31, the night, the last (the user: the base mesh's eyes for everyone, the add-on removed, on `realism-enhancer-skin`)

- **"I've confirmed the default 'eye stitch' process is just using Blender's default human model ... can you just
  modify the base loaded mesh that we edit so it has those eyes from the start (I don't care about the old eyes as the
  new ones are way better and the eyeballs sit way better)."** Yes: the graft is every character's eyes. The user
  checked that the head in the add-on's file is Blender Studio's Human Base Meshes body (CC0, `GEO-body_female_realistic`), so
  `Content/Studio/Bodies/MHR_eyes.bin` is committed; the Studio wears it with no switch and no Make button (MHR's cut
  lids only if the file is missing); `eye_patch.py make` takes the bundle's .blend (`vendor/human_base_meshes/`,
  git-ignored, or `--blend`). The shape keys' base preset is "Default".
- **"Could we just update our model for eyebrows and eyelashes to be inspired by them ... and then scrap/remove the add-on
  ones entirely as it's annoying to have to go to Blender to bake it ... I found many tutorials using their technique
  for getting the curve ... enhance our eyebrows and eyelash system we already use and remove the add-on."** Done: the brows
  and lashes by hand (`groom.js`) took the technique (Blender's own hair node groups: trims along the edges, clumps
  toward guide hairs, noise, the curl's profile toward the tip, wide length randomness; docs/research/brows_lashes.md,
  in our own words and numbers); the add-on's bake, its Studio panel, Start from the add-on's brows, its bake tool, its Studio loader, its notes and its
  check are removed. The old transfer branch on the remote is left for
  the user to delete (asked).

- **"I think I get confused cus the UI is split so apart, I'd almost rather just have a tab for eyelashes/eyebrows
  before hair."** Done: the Studio's **Brows & lashes** tab, between Layers and Hair: first the fine hairs (shaped on the
  face: the editor's handles and brushes, the old "by hand"), then the clumped ones (sliders and styles only); the Face
  tab keeps the look, the pictures, the fit and the mouth.

## 2026-10-31, the night, later (the user: the grafted eyes on our faces, on `realism-enhancer-skin`)

- **"Before you continue one thing you could maybe do is look how the eyes are modelled in the default .blend and make
  ours match the upper face shape (but still let the face shape be modified ...), if that's even possible, then you can
  just use the default .blend eyebrow as starter (which is placed correctly) and modify based off that, I don't mind
  adding more vertices around the eyes."** The brows: Start from the add-on's brows (CHARACTER_STUDIO §2b), the handles on
  the add-on's own outline. Then: **"is there any way we could use the eye shape and eyelid shape that the base mesh has in our
  modifiable version ... in ours the eyelids look like thin skin bending over the eye whereas the base mesh's eyelids actually
  look like meaty flesh that curves in, ideally we want that look for the eyes, eyelid shape and then make it modifiable
  through some basic shape keys ... the eyes don't need to be massively adjustable (just more asian or caucasian etc and
  size)."** Yes: **the grafted eyes** (CHARACTER_STUDIO §2c, `tools/eye_patch.py`, `eyegraft.js`): the base mesh's eye region grafted
  onto MHR's face (its own loops, about 2,400 points an eye where MHR has about 550), riding MHR's triangles, its own
  blink; in the Studio first, off by default (Skin, Eyes, the grafted eyes). The shape keys and the export next.
- **The licence of the base mesh's head**: the add-on's pack is CC BY-SA 4.0, but its demo head looks like Blender Studio's Human Base
  Meshes body (CC0: the same object names, `GEO-body_female_realistic` and its `.eye.L`/`.eye.R`). Until it's compared
  with the bundle itself (www.blender.org is blocked in the cloud sessions; the user can allow it or download the
  bundle), the graft stays on the machine: `Content/Studio/Bodies/MHR_eyes.bin` is git-ignored, made by
  `python tools/eye_patch.py make`.
- **"Can you make sure in the final versions we don't have that weird gray makeup stripe pattern thing on the closed
  eyelids (should just blend in with the rest of the skin color but maybe make it possible to apply makeup (eye shadow)
  onto that closed eyelid part"**: the shut lid reads the photo softly, near the photo's own skin tone, and the skin and
  its makeup are worked out on the open lid laid flat, so eyeshadow covers the shut lid (CHARACTER_STUDIO §2c).

## 2026-10-31, the night (the user: brows and lashes by hand, on `realism-enhancer-skin`)

- **"The texture of the procedural eye lashes looks really good but the design you generated is very bad, they move up
  too upwards, look at the reference photos of the unskinned face and then how they apply eyelashes and eyebrows, that's
  the kind of look we are aiming for."** With four references: a brow close up, an eye at three-quarter, an eye from the
  front (MetaHuman's), a MetaHuman head without its hair. Then: **"Could you make an easy eyebrow editor tool where I
  manually can add and adjust the eyebrows and eyelashes inside an easy wrapper?"** Built (CHARACTER_STUDIO §2b): Face,
  Brows & lashes by hand, Edit on the face (handles on the brows' edges and the lashes' tips, Mirror, brushes, a blink,
  styles and sliders), the hairs at the add-on's thickness and look, the lashes forward and swept out (defaults tuned on the
  references), saved with the character, carried by the export. The add-on's bake stays as an option.

## 2026-10-31, later (the user: the eyes, the brows and lashes, on `realism-enhancer-skin`)

- **"Can we get the eyes to be more like Unreal Engine's MetaHuman ... atm it looks too stylized/dolly and pops out too
  much, I want to keep all the patterns for the iris etc we made. Can you analyze the eyebrows and eyelashes too ... our
  eyelashes poke out too much and are probably too long."** Measured (docs/research/eyes.md §7). Then: **"it seems
  like currently we can't get on par with MetaHuman's capabilities for eyes and eyebrows and eyelashes. So let's do a
  hybrid approach where I will make a batch of variations of MetaHuman faces, and we run some kind of smart algorithm to
  stretch the faces into our existing human modifiable models ... forget about the changes you may have made to eyes,
  eyelashes, eyebrows so far. Keep the skin stuff you did for Godot though."** Then, **before committing to that:**
  "look through git if there is anyone who has figured out how to do MetaHuman-like eyebrows and eyelashes
  procedurally ... check if there are alt pathways." The hybrid face plan is **on hold**, the user's call.
- **"I'd be happy to use a third-party procedural hair add-on and bake it onto the model before exporting to Godot if you can
  figure out how to get it to work."** Built (since removed): the add-on's generators run headless in Blender's module on a
  character's export, the lashes tidied, pinned to MHR's triangles, worn by the Character Studio (Face, **Bake with
  the add-on**), carried by the export to the desk and Godot. **the add-on's pack is CC BY-SA 4.0:** its .blend stays out of
  git (vendor/, the user's download; it came in on a branch of its own, the old transfer branch, still on the remote:
  ask before deleting it); credit the add-on; hair it grows is shared under its terms.
- **"Make sure the eyes don't clip through the eyelids ... make sure the eyes can close properly without clipping. I
  think I might have told you to go back on the eye fixes you did, make sure that the eyes don't look like white
  paint and follow Unreal's MetaHuman inspired coloring and wetness so the eyes look more natural in game."** The
  eye's lighting work brought back (the socket's shade in the Studio and Godot, Godot's own `light()` for the cornea's
  coat and catchlight; not the earlier lash styles or the "realistic" look); the blink put in the export and played in
  Godot with the lids kept off the eyes all the way and met when shut; the whites darker and warm; the tear line's
  glint in Godot (GODOT_LOOK §5f; EYELIDS).

## 2026-10-31 (the user: the hair, after the skin, on `realism-enhancer-skin`)

- **"Can you now work on the hair part. Making better hair that looks similar to Unreal's MetaHuman (if possible),
  probably a shader/texture we need to bake when we do our current hair."** Built, for their review (GODOT_LOOK §5e):
  the salon's bake carries the hair as a volume (each card vertex's shell normal and occlusion from the hairstyle in a
  density grid with the head solid, the tangent along each strand, where across its card it is, each strand's numbers in
  the occlusion slot, a `studioHair` record), the Character Studio's export keeps it and gives brows and lashes the same
  numbers, and Godot's HSHair wears it from the file's records: soft dithered coverage under TAA, the roots fading in,
  tapered card sides, two highlights with glints in the salon look's colours, light through from behind, a scatter, the
  occlusion. Found and fixed on the way: the darkened scalp and the brows' fill showed white in Godot (the importer
  drops an unlit material's vertex colours); a character whose name holds "hair" had the hair shader on its skin; the
  emissive slot, tried first for the strand numbers, glowed in plain Godot. Kept on the same branch as the skin.

## 2026-10-30, night (the user: the Studio's characters less like dolls, on `realism-enhancer-skin`)

- **"Take our studio creations for director/godot and make them look less like dolls and more like Unreal's
  MetaHumans; we have a plugin that's supposed to make the skin look more realistic but I'm not noticing a huge
  effect; if I go really close to the model it does look more real but the pores look way too large and not enough
  micro detail."** With their screenshot of a Studio character and a sheet of MetaHuman faces. Then, once they've
  reviewed it: "a better hair texturer too for studio so baked hair looks more realistic like MetaHuman".
- **"I am 100% ok with adding an extra step after studio where we take the model into Blender and add realistic
  procedural skin (presets for old, young, normal etc), lips, etc and baking them along with data for rough maps etc
  and then bringing that into Godot if that's the best workflow, but if there is an easier one feel free."** Claude's
  call, for their review: **no Blender step.** The finest detail can't be baked on MHR's shared UVs at a size a game
  carries (a face's texel is 0.35 mm in the export's normal map; a pore 0.15 to 0.35 mm, a furrow 0.02), so, as
  MetaHuman's tiling micro normal does, it's drawn live in Godot at its true size: **the skin's detail layer**
  (GODOT_LOOK §5d: pores, furrows, the lips' lines, the colour's unevenness, from tiles `tools/skin_detail.py` makes once,
  placed by MHR's region map), with **presets young, natural, adult and old** picked from the Studio's own age and pores
  (or named on `HSCharacterLook`); what is the character's own, **its occlusion**, goes into the Studio's existing
  export bake. Found on the way and fixed: HumanShaders' micro tile lay five times too big on MHR's UVs (the user's "pores
  way too large"), Godot's screen-space scattering at HumanShaders' strength blurred the whole face to wax, and the
  eyes glowed (now the lids' shadow and a white at 0.85). The desk stays plain (DECISIONS 2026-10-30, night).

## 2026-10-30, evening (the user, after finding the sun's leak and the flicker's flashes)

- **Unreal removed**: "I'm okay to merge this into main... before you do, remove all the remaining bloatware from
  Unreal as we aren't going to use Unreal (the director's Unreal button too if it's easy); I think the Unreal stuff
  slows down our test suite". Gone: the `.uproject`, `Config/`, `Source/`, `Plugins/` (UnrealClaude), `.mcp.json`,
  `UnrealPlugins/` (UltraVHS's numpy reference and measures kept, moved to `tools/ultravhs/`), the editor-only
  storykit modules (importer, generate, shots, surfaces, skin, people), `unreal_link`, `unreal_plugins`, `metahuman`,
  `glass_skin`, `package_game`, `ueeye.mjs`, the class map, the glass-skin set, SETUP.md and setup.py's Unreal steps
  (its Kimodo steps kept), the Unreal docs (UNREAL_FLOW, UNREAL_NEXT, RUNNER_SPEC, MCP_TOOLS, METAHUMAN_ROUTE), the
  desk's Unreal button and its routes. All of it is in git history.
- **A GTX 1060 is the target, with the realism look and its atmosphere, well optimised**: "what if we aim for 1060,
  we want that realism look with atmosphere but very well optimized". So `balanced` is the default look (no SSIL, SSR
  at 48 steps, a thinner haze, shadows at 4096 and 16 bits with the medium filter; the menu's Shadows Medium).
- **A base project set up by default**: "when I start a new Godot project I also have to manually enable TAA etc and
  all the other settings that make the game look pretty including the camhybrid; set up a base project settings with
  everything that makes things look good (not the most intensive, a balanced one) so things don't look too sharp".
  The plugin applies the balanced project settings when it's enabled; the export writes them; `look_balanced.tscn`
  brings the environment, the camhybrid tape and the grade in one drop.
- **The choice back to one line**: after a glass panel and then a glow on hover ("it pops out too much and breaks the
  horror immersion"): "go back to our original of --- between the choices but keep it to 2 choices max, close to the
  bottom of the frame, below the question; we don't want 1 or 2 to select: click with the mouse or move between the
  choices with A or D (or the arrow keys) + Enter". The answers on one line with a dash between, the one pointed at
  white and the other dimmed; no numbers; the story check warns past two answers.
- **Light zones instead of lights placed and tuned by Claude**: "couldn't you just add some simple presets for
  different room lights with a cubed area affected (similar to how VoxelGI looks), the zone is what will be affected
  by lighting; I'm totally ok limiting architecture designs in my game to cubes/rectangles/boxes". `HSLightZone` and
  the room_* presets; the export puts a zone in every room.

## 2026-10-30, afternoon (the user, after trying the effect nodes)

- **The window sun fitted to its window**: "the window sun can be enhanced so we can adjust the root to match the
  window size and make it look like it's coming from the window (atm it just looks like it floats out of the
  window)". The shaft is the window's rectangle swept along the sunlight, sized to the opening by an outline in the
  editor, landing on the floor, its light aimed through the opening (GODOT_LOOK §0).
- **No quick-time events: a choice waits for the player**: "can we remove quick time events, just have it require a
  user to make a choice, move the panel lower too so it's more aesthetic". No countdown on any choice (a scene's
  choice, a reply, an ask, a round's result); `default`, an ask's `secs` and a reply's `timeout` are no longer used
  (the check warns); silence is an option of its own. The panel sits near the screen's foot while it's up.
- **Only what can be seen is drawn**: "can we add optimization to the engine/default exports so we only render what
  we can see (the typical game optimization trick)". The export's levels carry occluders (GODOT_EXPORT §8).

## 2026-10-30, noon (the user, after the lightmap bake took hours in the cloud)

- **"I think this isn't practical. What we should do is I manually handle the lighting, you make a plugin that's easy
  to drag and drop the effects you've created and modify/customize them, and when we import a scene into Godot we don't
  worry about lighting."** So the export writes no lighting of its own (no VoxelGI, probes or lightmaps; the bake
  pipeline built that morning dropped before its commit); the story's lamps and windows stay. The look plugin's
  effects become nodes to drag in and tune (GODOT_LOOK §0). This supersedes the morning's baked approach below.
- **"Instead of on each export we overwrite the folder, we incrementally go up a version so I can copy and paste some
  of the prior setup (e.g. the lighting nodes) from a previous project."** Every export is a new folder,
  `Saved/Godot/<Game>_v001`, `_v002`... (GODOT_EXPORT §8); the checks keep a scratch folder of their own.
- **"Similar to the vhs: camcorder var, could we add `lighting: off` meaning we can play and test our scenes without
  any lighting, but it's not pitch dark because lighting doesn't matter in this demo mode (almost like a viewport
  play test)."** `game.lighting`: `on` (the default) or `off` (STORY_FORMAT §9.1).
- **"The multiple choice intro dialogue doesn't work (I can't click anything), and I don't like the layout separated
  with ---: it should be a glass panel like the other objects, with numbered rows (1. 2. 3.) to select, hover the
  mouse over one to click."** Done in Godot: hud.gd's choice is the theme's glass panel with a row per option.

## 2026-10-30, morning, after the night's batch

- **"Is there a way to just bake the lighting (for windowed areas), and for rooms just make the lighting with
  different variations (light switches off, all on, 1 by 1 on/off), to help performance too and to stop the lighting
  shifting around? That's the reason we added those lighting effects for later, so we could bake the more realistic
  lighting and use tricks for reflectiveness later." "Let's go baked approach because it will be more performative
  on lower end machines anyway."** So the Godot side moves to **baked lighting** (LightmapGI; GODOT_LOOK §1e): the
  windows, the sun, the moon and the sky baked per time of day the level plays at; the lamps real-time for their
  direct light and shadows (switches, the power cut, flicker, dying bulbs all still work) with their bounce baked;
  one map per level per time with the lamps on and one with them off (the power cut), swapped at run time; a
  single lamp switched off leaves its baked bounce (accepted, the common cheat; no map per combination). With a
  level's lightmaps present the rooms' VoxelGIs and SSIL are off; screen-space reflections and the per-room
  reflection probes stay for the shiny tricks. The bake runs on the user's card after the export (the desk's
  Godot button, `godot_export.py --bake`), in the cloud on the CPU renderer for the checks. The shafts stay cards.

## 2026-10-30, night, from their second Godot run (the user asleep)

- **"Realistically you can disable all the shaders and lighting effects in director tool, we only need director
  tool for the gameplay etc, actual lighting etc should be set up in Godot (for the test room though you can allow
  director tool to just set up some generic lighting spots like you currently are but we don't need detailed
  shadows or anything in director tool)."** So the desk lights its rooms plainly by default: the lamps and the
  windows' fill as point and spot lights, no shadow maps (it never had them), and none of the light effects it
  mirrored from Godot (the windows' shafts, the lights' patterns, the headlight sweeps, the leaks' strips, wet
  skin): `Stage.plainLight`, the toolbar's Lighting button turning the effects on for a look, kept in the browser.
  New lighting work goes to the Godot side (GodotPlugins/HorrorStudioLook, the runtime add-on), not the desk.
- **"Fix the new weird lighting bug: the lights change based off what direction I look at, too noticeable (gets
  darker when I look down), and I see bright gaps come through on the floor and disappear as I move and look."**
  The iris's range cut to one stop, SSIL pared back, the rooms' VoxelGIs sized by the room, the windows' shafts
  faint at night and faded at the floor (GODOT_LOOK §1, GODOT_EXPORT §8).
- **"The characters/NPCs seem a bit overlit inside the game (their skin glows too bright)."** GDPEOPLE now measures
  the lit face against the export's own plain material under the same lights and holds the skin shader within
  0.85 to 1.15 of it.
- **"Work on post processing so the game feels more professional, specifically more color grading and making sure
  characters/npcs look more real and less like bright plastic."** A film-style grade over every game's picture
  (HSPost, GODOT_LOOK §1d: `cinema` by default, `game.grade` to pick another or none), the skin's gloss softened
  (§5).
- **"I don't see dialogue in Godot for cutscenes."** Found by a new GDTESTROOM check (the line's label visible with
  words in it through the lobby scene): a scene holds the player (`play.hold`), and hold hid the whole HUD, the
  footer with the lines in it. Now only the play HUD steps back (the objective, the prompt, the inventory, the log)
  and the footer stays: the lines, who says them, a reply's choices. The menu's `paused` is once each way too, and
  its Subtitles on/off row is gone: the lines are the dialogue (no voices), never a thing to switch off.

## 2026-10-29, night, after the local run (the Godot thread)

- **"We are scrapping voiced lines from the game for now (might add a typewriter sound effect as the text appears
  later, but only after game testing, if I want it)."** So no takes' audio in the Godot export (GODOT_EXPORT §8's
  "voices" step is skipped), no MiniMax voice work; the lines are text, typed out as they are (EXPRESSIONS_PLAN's
  typewriter blip waits for a playtest and their yes).
- **"Let's skip the motion sets for now until I actually make some Kimodo motions; I will tell you when I've made
  some basic sets."** So the motion sets on the stand-ins (PERFORMANCE_PLAN §2, PATTERNS_PLAN §5) wait: nothing
  built for them in the desk or in Godot until the user says their basic sets exist; the cast's stand-ins keep the
  blocking pose and the behaviours' stubs.
- **"Make a note to scrap any goals for Unreal; we are going to use Godot 100% for this project now: Unreal is too
  heavy and currently can't be used in cloud sessions."** Every Unreal goal is dropped: no StoryRunner, no
  `storykit.generate` or `importer` work, no UNREAL_NEXT, no UltraVHS or Light Kit plugin work beyond what the Godot
  side ports from them, no MetaHuman route (the Character Studio's MHR characters are the cast). The Unreal docs,
  plugins and code stay in the repo as history and as the source of the numbers the Godot side matches
  (`UnrealPlugins/UltraVHS/Tools/measure.py`, Light Kit's curves). The Godot export is the game. CLAUDE.md's header
  says so.

## 2026-10-29, the user's first Godot run (the test room on their machine)

- **"The intro cutscene feels too choppy: we can tell we are cutting to a new shot, I want one fluid scene. The
  player's location should remain the same as when it started, the player can still look around; standing, look
  around and walk (stop hard-locking them); sitting, not behind the sitting direction, but a 180° look."** So the
  new camera mode `live` (STORY_FORMAT §3, DIRECTING §1): the eye stays the player's own, no cuts, no shots, the
  cast acting in the room; the test room's lobby scene is live. `soft` and `hard` stay for scenes that must be framed.
- **"A way to unequip an item from our slot so we don't see it as if we are carrying it."** Q lowers the thing in
  the hand out of view (it stays in the row, its slot dim) and raises it; the wheel raises it too.
- **"Left clicking doesn't close anything."** The card is a Control under the pointer and ate the click before the
  runtime saw it; taken in `_input` now.
- **"Even unequipping still shows the item held"**: Godot's hand copy was shown again every frame; it hides while
  lowered now.
- **"The Godot export should be a bit more organised in the level: sub categories e.g. walls, furniture, ground."**
  Every level's nodes sit in folders by kind: Ground, Walls, Ceilings, Doors, Things, Lights, Glass, Triggers,
  Spots, People, GI (the runtime reads through them: `game.pieces()`).
- **"I love the camcorder VHS effect but it's a tad too much: the fisheye a tiny bit too strong, the blurring too
  much on objects that are closer; close to something it should be almost sharp, still some softening: call it
  `camhybrid`."** The new preset: half the fisheye, the tape's own blur a third, and the softener (`HSSoften`, a
  depth-aware post-process on the camera): sharp to 0.9 m but for a quarter pixel, fully soft from 7 m.
- **"camhybrid is buggy: the LED UI doesn't work, we don't see steam when turning things on."** The softener had
  been a quad reading the screen texture (the opaque pass only) and painted over every transparent thing; it's a
  CompositorEffect after the transparents now, and the test room checks a digit and the kettle's steam survive it.
- **"camhybrid needs strengthening towards camcorder: I like the sharpening and the reduction of fisheye, but we
  over-reduced to the point it lost its aesthetic; give me five screenshots to pick from."** Five strengths between
  the two pictured (`docs/godot_sheets/2026-10-29_camhybrid_pick.jpg`). **"Something between B and C"**: their
  midpoint is `camhybrid` (fisheye 0.062, blur 0.88, the softener half a pixel at 0.85 m to 1.55 px at 5.75 m).
- **"The shadows feel a bit rough even with anti-aliasing and TAA: hard edges on the front door at the top."** The
  shadow maps' filter was Godot's default (soft low) over a 4096 atlas shared by twenty lights: soft high over 8192
  now, the lights with a size and a blur, the menu's Shadows row wired (GODOT_LOOK §1).
- **"You can see the rain diffractions on the puddle, I really like that, but the circle stylised rain droplets
  break the immersion: we are aiming for realism, not stylisation."** The splashes draw no ring now: a landing glint,
  a wet sheen and a few thrown droplets, and the wet floor's own ripple rings bend the reflection per pixel
  (GODOT_LOOK §4).
- **"Build all five (the Light Kit pieces the Godot side lacked), flicker modes and patterns first."** In that
  order: the flicker modes (`mode` on a light: fluorescent, dying, candle, pulse, custom; the same curves on the desk
  and in Godot), the light patterns, the shafts with dust, the headlight sweeps, the adaptive exposure. Built that
  evening (GODOT_LOOK §1): `mode` on a light; `pattern` with `aim` on a light (Godot projects only through a shadowed
  spot: found there); `shaft` and `sweep` on a window, the `sweep` action; the iris with any look but plain.

- **"Let's remove the forced turn away (look up) after we interact with the person; in general let's make a note to
  avoid that effect, as upon testing it breaks immersion."** The rule, for every runtime and every stitch: the
  player's eye is never moved for them after an interaction; a scene hands the eye back exactly where its camera
  ended, a card leaves it where it was. (DIRECTING §1 carries it.) The moment: the lobby scene's `glance` seam, the
  camera eased up to the lamp while Aoi walked to the bench and back to her: "it forcefully made us look at the
  ceiling after we interact with the npc and they move to sit down, then makes us look back at them". So the seams
  that move the eye, `glance` and `cutaway`, are **deprecated** (a STORY warning, like the quick-time events; the
  runtimes still play old ones) and the three games' glances are blinks now.
- Reading a thing (`inspect`, a note): the "Look" dot and word don't sit over the card, and **a left click puts the
  card away** as Esc does (a name or a code card still waits for its keys). The desk the same (a click with no drag).
- **A thing looked at stays where it is in Godot** (the shelf had vanished while its card was up: the desk takes a
  small thing up in the hands, Godot showed the card and hid the thing even when it was a shelf).
- Noted, to look at later: a square patch of light under a distant counter that goes when you come close (the
  VoxelGI's cells seen from afar, most likely; GODOT_LOOK §7).

## 2026-10-29, the user's return (the Godot button: a plain project, no windows)

- "When I click Godot, it just launches in headless 3 times and closes (via director), is there a way to just export
  it as an individual godot project to manually load into godot?" The three launches were the guide's pictures
  (`--pictures`, added that morning) and the import. The button now writes only the project folder
  (`Saved/Godot/<G>/`, its `project.godot` opened by hand in Godot 4.7) and the zip; the pictures stay a CLI option.

## 2026-10-29, afternoon (the look in Godot, the inventory as models, our plugins in a folder)

- **The inventory shows the things themselves**, "the 3D model scaled down into an inventory-size slot, only the ones
  showing rendered", not pictures (the user: more common than rendering inventory photos). Built: `hud.gd`'s row.
- **Then, while the user is away (about seven hours):** "the shades we made for rain reflections, rain, reflective
  materials inspired by Chilla's Art" ported to Godot; "a default anti-aliasing and the most aesthetic settings for
  pseudo realism (baked realism lighting with overplayed effects like blood and reflective surfaces to trick the
  brain; our games are pretty small scale)"; "a realistic sweaty wet skin filter and shader, and oiled up"; "implement
  that human shader repo"; and **"instead of exporting the plugins and having them inside GitHub, keep our plugins
  in a folder that gets passed in"**: `GodotPlugins/HorrorStudioLook/`, copied into every export (docs/GODOT_LOOK.md).
- Claude's call on the way to say it in a story: the new word `skin` (STORY_FORMAT §9.8: a cast member's `wet`,
  `sweat`, `drips`, `oil`), played by the Godot export, recorded by the desk; the user may want it elsewhere.
- Claude's calls later that morning (the user still away): the desk's stage draws `skin` too (skinwet.js); **every
  kit mirror reflects for real** in Godot (HSMirror: a second camera into a viewport, the glass projecting its
  view; a mirror's own wall and itself kept out of its picture, so two mirrors in one room is for later; a second
  render of the room per mirror in view: a bathroom's worth, not a hall of them); rain splashes where it lands; in
  the rain's room the rain is heard all round you and every step is a wet one, on the desk too; a level's own
  `weather` over the game's and a room's own `wet` (a bathroom's floor without rain: STORY_FORMAT §2); a cast member
  out in the rain wets by herself and dries indoors, the `skin` word overriding; the desk's
  Godot button has Godot make the guide's pictures when it's on the machine (seconds on a card). LightmapGI stays
  out: its bake is editor-only in 4.7.

## 2026-10-28, late night (Godot: Claude's picks, parity first)

- **"Do whatever you think is right, keep working on this till the test demo director is 1:1 in Godot"** (the
  controls fine-tuned later): the goal is the desk's Play of the Pilot and TestRoom001 playing the same in Godot
  (GDPLAY, the test room's stations), then the rest of GODOT_PLAN §6.
- Claude's picks on GODOT_EXPORT §4: **numbered folders with the act first**, never renumbering a folder the user has
  files in without saying so; **animations baked** from the desk's bake; **GDScript only** in the export.
- Claude's call on the order: **parity first, editability second**: the first exports keep the story's data as data
  (the runtime reads it) and the levels as `.tscn`; the Inspector resources for beats and the AnimationPlayer
  timelines come once the Pilot plays the same (GODOT_EXPORT §3 stands as the shape to reach).

## 2026-10-28, night (Godot: start; GDScript)

- **Start the Godot work** ("I merged in main, pull it in and start working on this"): main (`dev-002`) merged into
  `godot-support`; the plan's order (GODOT_PLAN §8) from its analysis step.
- **Godot 4.7 set up on the cloud first** ("first figure out how to set up godot mono 4.7 on yours"): Woohill's way
  (`tools/godot_setup.sh`, `tools/godot/check.sh`: GODOT ok, headless and a picture under xvfb on lavapipe).
- **GDScript, Claude's call** ("decide yourself whether to use gdscript or c#; since our games are math light we can
  do gdscript if you think it's fine"): GDScript (GODOT_PLAN §3: the tested runtime is the desk's JS, no .NET in the
  cloud, the user edits inside the editor; the user's Mono build runs it unchanged).

## 2026-10-28, later (Godot: a project per game, everything Unreal never got, a guide in each)

- **When the branch starts, build out for Godot all the shaders and effects never built out for Unreal** ("build out
  all the shaders and effects we never built out for unreal for godot"): docs/GODOT_PLAN.md §6.
- **The initial time goes into analysing the most efficient way to do it** ("spend your initial time analysing the
  most efficient way to do this"), before building: §5, §8.
- **Export makes a Godot project per game, ideally as a .zip** ("maybe clicking export creates a new godot project
  .zip, rather than the unreal approach one project for all games (because godot is more lightweight)").
- **The project's folders and sequence are easy to work in Godot's editor** ("the folder structure and sequencing
  needs to be very ui friendly in godot so I can easily modify everything after exporting").
- **An .html guide in each project** ("a .html app/tutorial on how to modify and edit anything in godot for each
  project including guides on adding new inbetween scenes, porting over new animations etc"): §7.
- **Still not started:** the user says when; the dev branch lands first.
- Claude's calls inside that: the shared things go into each project as copies so it stands alone; a re-export must
  keep what the user changed in Godot by hand (part of the analysis); the guide's pictures made by driving Godot, as
  GUIDE does the desk's. From the lighting talk the same day: baked first (a bake per lighting state of a room,
  swapped), VoxelGI only where a light moves; the three-way trial is proposed, not agreed (§4).

## 2026-10-28 (Godot: a branch, HumanShaders, the port to come)

- **A `godot-support` branch, with HumanShaders in a plugins folder** ("make a new branch called godot-support,
  incorporate this plugin (pull this into a plugins folder) https://github.com/matmadness/HumanShaders"):
  `GodotPlugins/HumanShaders/`, upstream's shader folder unchanged (UPSTREAM.md).
- **Later, the Character Studio is translated onto these shaders, keeping the colours and patterns we designed** ("we
  will want to translate later the character creator to use these shaders however maintain the colors, and patterns we
  designed in character creator"): docs/GODOT_PLAN.md §2.
- **Not now:** the user's large dev branch lands first, and what it adds gets ported too.
- **Godot 4.7 Mono** ("that will let you port the c language stuff easier"): C# for the C++ port.
- Claude's calls inside that: only upstream's `HumanShaders/` folder came across, not its demo project or its head
  scans (Digital Emily 2's licence isn't stated; Infinite is CC BY 3.0); its textures are MIT and CC BY 4.0, so a game
  that ships them credits matmadness. Our eye keeps its refracting cornea (HumanShaders' eye only does parallax).
## 2026-10-28, later night (the long checks on the user's machine)

- **Ask for a local run when I'm here**: "how much faster would the run be locally ? If its significant (I have an
  rtx3090) then make a note to start asking me to just do the run locally (make a do run .md for claude local) as
  40min waiting is bizarre if im not afk". It is: one frame of the Character Studio takes about a second here
  (SwiftShader on four CPU cores) and a few milliseconds on a 3090, so STUDIO's 50 minutes should come down to perhaps
  5 to 10 (an estimate). When the user is around, the cloud session pushes once the offline checks pass and asks for
  the browser checks to be run there (docs/RUN_LOCALLY.md, `GPU=1`); when they're away, it runs them itself.

## 2026-10-28, night (the Character Studio: the eyes from the side, the hair's bake, the nose, the face's bake)

- **The eyes from the side**: they vanished in profile; "keep the illusion that its more flat from the side", "it
  needs to arch around the top and bottom of whatever visible point, not bulge out in the middle", matched to the
  user's red masks and smoothed ("we dont want an amateur roughly ugly mask"): an invisible arched mask behind each
  opening.
- **The hair dull after its bake**: leave it, "I think that will be a shader thing we will do later in unreal maybe".
- **A small nose** ("even dragging everything low still has a fat nose that sticks out from side profile") and
  **the face's proportions baked** ("So I can remove the reference image for image to face once Im done"): Nose size,
  Nose projection; Bake the face.

## 2026-10-28, night (texture templates for the placeholder things)

- **UV templates for Krita**: "for small untextured things that we get physically/proportionally correct could you
  export a uv map (and a guide layer for the sides) so I can just import it into krita and texture. If its photos
  though consider that I might want the frame to be pbr so Id only want to export the actual photograph part". In
  docs/HANDOFF_DIRECTOR_TODO.md §6 (the blocks are made by the director's build, so the template and the block's UVs
  are built together there): a box as a cross net on one scale, a plane front and back, a photo's print alone (its
  frame a PBR set); an OpenRaster file per thing with Guide, Paint and Base layers; a painted PNG saved beside it
  becomes its texture.

## 2026-10-28, evening (placeholder things)

- **Flat boxes and planes for now**: "For items like pills and cards, they should just be flat boxes or planes for now
  and I will add the textures/models later myself". In docs/HANDOFF_DIRECTOR_TODO.md §3: small things stay plain
  blocks or planes at their real size, the card game's cards plain planes.

## 2026-10-28, later afternoon (a character's models per scene, carried down the flow)

- **No eye swap**: "We dont need eye swap, I can just export the same model twice with diff eyes".
- **Models per character, overridden per scene and carried on**: "we might in database want to make a group per
  character so I can add diff models for their diff states and have it always use default, but in scenes be able to
  override which one to use, however it should be continuous so if in a later scene I say use y, then the rest of the
  scenes that branch from that use that one, until I go to a later scene and default it back, then the rest after that
  one go to default". In docs/HANDOFF_DIRECTOR_TODO.md §5, after the way the time of day carries down the flow.

## 2026-10-28, afternoon (the director's to-do, for after the merge)

- **Not on this branch**: "you dont have to work on this in this branch but I will merge this branch into the other
  one and you need to give me a to do". docs/HANDOFF_DIRECTOR_TODO.md is it.
- **Rough outlines, refined on the desk**: "ideally I want the writer block to be just a very rough outline, I will
  refine the actual stuff by playing through, editing in between, modifying, is there a way for me to slice a flow (to
  stop it continuing), then re-attach it to another."
- **Writer to director**: "only move the dialogue, tasks, gameplay element of that shot/scene, no adding animations to
  the npcs etc, you can just give them an easily changeable starting position and they'll stay still".
- **State through a shot, patrols**: "if I animate them walking somewhere, once the animation is done, I in the same
  shot might want them sitting on a chair for the rest of the shot, or in the same shot add patrols (which can be a
  generic looped walk, stand, or patrol through premade animations that are specific). If this is missing add it as a
  pass down to next session".

## 2026-10-28, early afternoon (The Visitor: written as amnesia)

- **The writing rethought**: "dialogue like this makes no sense: [ Welcome ] Natsu came back. Tell her --- And breaks
  the immersion because its too abrupt, the player has no clue whats going on yet, it needs to unfold almost like the
  player has amnesia".
- Done: the session `the-visitor` written again in that voice. His thoughts know only what's in front of him and what
  his body remembers; facts come from outside (the list, her lines, the props, the officer, the phone), once each; his
  answers are small reactions ending on a question ("Twelve years since what?", "Why do I see trees?"). The abstract
  gets a How it's written section; LESSONS the rule.

## 2026-10-28, noon (The Visitor: the player never speaks)

- **Only acts and thoughts for the player**: "we shouldnt have dialogue in this style ... Its fine for the npcs to have
  dialogue like that but players dialogue is always stuff like [ Greet ] She looks cold, welcome her inside ---
  [ Question ] She looks different. So inner monologue, player can imagine what they said."
- Done in the session `the-visitor`: his one spoken line at the door is now a choice (`[ Welcome ] Natsu came back.
  Tell her --- [ Stare ] Twelve years. Is it really her?`), the garden's answer reads as a thought, and a note on the
  chart says he never speaks. LESSONS has the rule.

## 2026-10-28, late morning (The Visitor's chart as pseudo-code)

- **Less text, Chilla's Art's way**: "its a bit too detailed like a novel, needs to be more chillas art game style and
  not hyper text heavy"; "opening is just you in the apartment, you spend 1 minute looking around when a to do quest
  comes up (Clean up the apartment before x arrives)"; "I dont want things like 'shes soaked', since I dont want to make
  a seperate model, writer block needs to be written almost like a pseudo code format where we only talk about literal
  things not narrative type of writing since this isnt a book".
- Claude's calls inside that: the session `the-visitor` written again as terse script (literal actions, short lines,
  sounds as cues, notes for the director); the cold open and the phone call at the start gone (a minute's free look,
  then the timed clean-up on the list, its timer hidden); the rain, the towel, her wet shoes and the change of clothes
  gone; the same structure and endings. docs/LESSONS.md has the rule.

## 2026-10-28, mid-morning (The Visitor's abstract approved; the flow charted)

- **The abstract approved**: "I think this is a strong start (we can always refine later)". Step 3 begun: the flow as
  the writers' room's chart, `/chart` from `docs/game_research/TheVisitor/02_abstract.md`, session `the-visitor`.
- Claude's calls inside that (sticky notes on the chart): karma stands for his clarity (a pill +1, a pill left -1,
  leaning into the romance or lying to Ren -1, everything else 0), so the endings read Stay if `[ Watch her sleep ]`
  (offered only at karma -5 or less), Okuribi at karma 1+, Thank You for Tonight otherwise; the garden in two versions
  by karma (hers after a pill, his otherwise); the pill moments as answers to his mother's remembered voice, standing
  in for the timed to-do the director will make; her name a variable; the soy-sauce tea secret left as a note beside
  the salt one (the chart can't hold two secrets in a row).

## 2026-10-28, morning (The Visitor: he is the reason she died)

- **The truth rewritten**: "instead of her accidentally dying in your youth the player actually was the reason for her
  death, he found out she was dating/seeing someone else and they got in a fight in a forest, you pushed her and she
  slipped and fell in the river and got swept away, you didnt mean to actually kill her but ultimately you were the
  reason she died (almost like an argument that spirals out), she was your childhood crush but she saw you as a
  brother".
- Claude's calls inside that, in the abstract's fifth pass (waiting for the user's yes): they were sixteen (he's 28
  now, Natsuki 23); the boy was Shun Sakamoto, whom the town suspected for years while his mother's "home by eleven"
  covered Haruki; the fight on the path through the shrine woods above the river after the fireworks ("you're like my
  brother"), a shove, her geta slipping, the bank, the river; the echo: Natsuki also calls him brother and also has
  someone (Ren, who phones at 01:30, his lines about her boyfriend left out off the pills); the endings' pieces
  rewritten (Okuribi: the Tanabata wish "I wish Haru-kun will always be my big brother" and Shun's word that he
  followed them; Thank You for Tonight: the guilt and the jealousy in his diary; the dark ending renamed Stay, its last
  line "This time, she stayed.").

## 2026-10-28, before dawn (The Visitor: no reflections, ending slots, a card game, the garden, a real visit)

- **No reflections**: "I dont like 'the night window and the bathroom mirror, you see her real brown eyes and her real
  expression.' as it will be harder to program and why would we watch her while shes in the bathroom."
- **The endings as slots**: "Modify the endings so you just create a generic cutscene slot that I can easily modify
  for each ending (so just give a rough outline so when we move from writer to director I can customize the whole last
  part), add an ending title card though after where we will add more info." (This supersedes 2026-10-27's "no ending
  cards" for this game: the cutscene, then a title card.)
- **The answers to the three calls**: the other ending is Thank You for Tonight ("Sounds good"); the body in the
  dark ending is Natsuki's ("yes, dark ending"); he let go at the weir ("Sure, thats okay for now").
- **A card game**: "For each flow to keep the game interesting we should add maybe a simple card game (using standard
  cards), but based on what flow your going into is what will determine some of the options and results in the card
  game."
- **The garden, not the lanterns**: "rework the lantern part, I dont want to model a lantern, maybe have it more casual
  like we go to the small garden outside and see her smoking and theres a more intimate discussion."
- **A real visit**: "sprinkle multiple small moments like making her tea, maybe later she gets hungry and we make her a
  ramen, things that basically make it feel more real and how a visit would go. Basically the game needs to feel like
  your there but with amnesia and dont know why but it feels memorable and relatable enough that it convinces you".
- Claude's calls inside that, in the abstract's fourth pass (waiting for the user's yes): off his pills the truth
  comes from the world, not the glass (her card, the officer, her mother phoning for "Natsuki", her bag), and her real
  faces are seen only after a pill or in the dark ending's flashes; the card game is shinkei-suijaku (Concentration,
  "nervous breakdown"), the loser answering a question, his memory lying and her letting him win off his pills; the
  small moments (a towel, her shoes stuffed with newspaper, tea, a watermelon chilled and salted, somen, cards, her
  cigarette in the little garden, a vending-machine can, ramen at midnight, the futon), most with a memory flicker
  that breaks off; Natsumi's piece in Okuribi is a Tanabata wish on paper.

## 2026-10-28, small hours (The Visitor: the pills decide what you see; three endings, three pieces of the truth)

- **His version of her**: "if he's off his pills we will have different facial expressions for some parts (he will
  think she likes him, think the new joker joaquin phoenix movie where he is creating a false romance scenario)".
- **The secret, dark ending**: "the cops show up to say heard a disturbance, they go into the bedroom to find the body
  lying and tell you to get on your knees (they pull out a gun at you), you have some weird inner monologue and the
  game ends."
- **No confession**: "The good ending shouldnt be you confessing, because you as the player dont actually know what
  happened and are trying to figure it out yourself, maybe whether you take the pills or not determines the name you
  call her (variable), and if your off the pills you never see her correct you."
- **The other ending, undecided**: her finding his diary (guilt at living the lie) and picking up a knife as she walks
  towards him, "or the visit goes normal, you have fun, she never learns the truth and leaves and thanks you the next
  day."
- **Little branching**: "Maybe we dont need to care about major branching dialogue (that can be for easter eggs and
  learning stuff yourself, maybe write the story where we only get a clear picture of what actually happened if we do
  all 3 endings, so even if she found your diary it wont tell the player the full picture just maybe a page about your
  guilty feelings etc but not the cause)."
- Claude's calls inside that, in the abstract's third pass (waiting for the user's yes): his illness rewrites her and
  only her (her name, eyes, faces, corrections, a few warmer lines), while the card, the officer and every reflection
  stay true; two expression tracks for a dozen key moments; endings by the pill tasks (two or more: Okuribi, her side
  of the truth; otherwise Thank You for Tonight, his diary page; never a pill, the romance leaned into and her room
  entered at two: Don't Let Go, the police, the night itself in flashes); the truth at the weir: he held her wrist and
  let go; the pill in her cup and the mother's lie as a told story are gone.

## 2026-10-28, late night (The Visitor: an honest sister, names one letter apart, no police, the pills as tasks)

- **The user's answers to the abstract's calls**: the twist, the visitor as the lost girl's sister ("Sure"); the
  player's name fixed as Haruki ("sure"); the secret ending: "Maybe not taking your pills + something else (we have to
  do list quest occasionally to take pills)".
- **The intended ending rethought**: "We need to rethink the intended ending, calling cops would make sense since it
  happened in childhool." (Read as: the police don't fit, it happened when they were children.)
- **The door's question**: "the question could be she looks a lot younger than you last remember?"
- **An honest sister**: "Maybe the sister isnt trying to trick the player but actually the player is too mentally ill
  to realise its the sister so she reacts confused. Maybe the sisters should have very similar names for this
  purpose".
- Claude's calls inside that, in the abstract's second revision (waiting for the user's yes): they were thirteen (a
  child under 14 can't be charged in Japan), now 25, and the sister is 21; Natsumi and Natsuki, called Natsu and
  Ko-natsu, so her card, her "it's me, Natsu" and the officer's "Natsuki-chan" all read both ways; off his pills he
  sees her with Natsumi's lilac eyes and some of her lines retype into her sister's name, while reflections and his
  pills show her own brown eyes; the intended ending is Okuribi (the truth told, her parents phoned, the sending-off
  fire lit late, the pills taken, her eyes brown); the secret ending needs every pill task failed, the one-word call
  answered "moshi moshi" and Natsumi's geta set on the altar, and ends with him taking the pills once she's gone home.

## 2026-10-28, night (The Visitor's abstract revised: a summer day, lilac eyes, clues about yourself)

- **The user's notes on the abstract**: "lets make a summer day rather than new year, instead of a mole let it be a
  different eye color (Lets say Lilac), today would have been the aniversarry of her disappearence, your mother who
  protected you also has passed away."
- **Clues about yourself**: "The dialogue needs to be written where not only are we getting clues from her, but also
  our dialogue choices and what we can ask/do gives us clues about ourselves."
- Claude's calls inside that, in the revised abstract (still waiting for the user's yes): 16 August, the last day of
  Obon, when the dead go back, and the night Natsumi vanished in 2014 during the river festival; she slipped on the
  weir (her geta's strap snapped, the omen), not through ice; his mother's first Obon; the visitor's lilac is coloured
  contacts over brown eyes (one lost in the bath: one lilac eye, one brown); a second mystery about him: the answers
  he's offered, his true answers to her probes, thoughts that rewrite themselves, his scarred palms, his own notes,
  and the cucumber horse he made for Natsumi, kept as memories that decide how much truth he can tell at the end;
  lanterns on the river in place of the bells, one floating upstream.

## 2026-10-28, evening (a new game, The Visitor: research, an abstract, then the flow; branch `game-research-001`)

- **A branch and a folder for game research**: "Don't use dev-002 branch, but forked off it, make a new branch called
  game-research-001, and make a new folder to store these game research." The folder is `docs/game_research/`, one
  folder per game (its README has the three steps).
- **The game, The Visitor**: "based in japan, an old female friend/crush comes to visit you, things start to go
  weird"; "mostly based in just 1 apartment (mid sized, 2 bedrooms (1 guest), 1 bathroom, 1 kitchen + living room in
  same room)".
- **Three steps**: "Research: find real life scenarios or stories for inspiration. Come up with an abstract. Once I
  approve the abstract come up with the writer block flow for the game."
- **The opening**: "inner monologue about cleaning up the apartment, if you dont clean it she will comment on it when
  she comes in", "a hidden timer of 2min or whatever", "2 achievements for clean/messy"; "start off with inner
  monologue of whats happening today".
- **The player answers with acts and thoughts**: "very inner monologue / action rather than dialogue options e.g.
  [ Greet ] She's proabbly cold I should let her inside ? --- [ Question ] Did she always look like this ?"
- **The play**: "little tasks and dialogue to discover whats happening", "similar to chillas games where you lift,
  click itneract", "her dialogue to be heavily using mocapped expressions almost like LA Noire", "I dont want big
  actionny horror run scenes", "very to do list"; "your dialogue options and analysing their expressiosn helps guide
  to the end".
- **Length**: "take at least 1 hour to beat (we dont let peopel skim dialogue as its appears + typewriter effect for
  her)".
- **The spins**: "hints at people going missing making the player think shes involved but the twist is it turns out
  you were the villian (at least for one ending)"; "paranormal stuff and weird behaviour/tells for her"; "a kind of
  shutter island thing where we are being led to believe one narrative but it might not be the answer"; "maybe we
  think that she is possessed but it turns out the viewer is schizoprhenic (hinted via medications in the bathroom
  cupboard etc)".
- **Three endings**: "the intended ending, the other way it could have gone, and a secret hidden ending".
- **Secrets as achievements**: "easter eggs and slight branch off flows that come back to main ... good steam
  achievements", such as "you make her tea, but you can possible add a weird ingredient to the tea and she will comment
  on it tasting funny".
- **Names and lines**: "appropriate english/japanese names (japanese names written in their english format)";
  dialogue "written in a way that makes you think she was a childhood friend, but also simple enough that we can later
  use claude to translate the locale to Japanese".
- Claude's proposals, **waiting for the user's yes** (docs/game_research/TheVisitor/02_abstract.md, its five calls at
  the end): New Year's Eve in a fictional Iwate river town; the visitor is the lost girl's younger sister playing her
  (Shutter Island's role-play), so "Did she always look like this?" is both the illness and the truth; reading her face
  is the theme (the narrator's reading bent by paranoia, her face the evidence); three optional doses of his
  medication that quiet the hallucinations, the same pill able to go into her tea; no smartphones (a landline, a
  payphone, a postcard), as decided on 2026-10-27; Haruki, Natsumi, Fuyumi and Akiko, the four seasons.

## 2026-10-28, back (expression loops go; skin like HumanShaders; Unreal next; a test room)

- **Expression loops: go** (task #6, held for the user's word): "expression loops is fine to do".
- **Skin v2 changes course**: "for skin v2 ignore what you've done; what we want is something like the skin shader in
  this Godot repo https://github.com/matmadness/HumanShaders, and I should be able to preview/bake it in when I
  export." So: HumanShaders' skin (its shader code is MIT; its head scans aren't ours and stay out) rebuilt in the
  Character Studio on our procedural skin, previewed there, and baked into the export so the desk and Unreal can light
  it the same way. The research note (docs/research/skin_v2.md) stays as background; its plan is set aside; the
  reference (film) light stays as an option.
- **Unreal, next local session**: "make a note what we need to do for the next local session I do".
- **A test room**: "make a testroom001 (diff than pilot) in director and have it test every functionality added so far
  so we can check if we can re-create it in Unreal Engine accurately."

## 2026-10-28, later (five hours alone: Chilla's Art's small systems, else skin v2)

- **The brief while away**: "I'm going afk, if there are any other simple game systems we are missing for Chilla's Art
  style horror games feel free to add them. If you can't think of any can you research aesthetic realistic skin
  (basically procedural skin v2 but more real like MetaHuman skin and the screenshots provided). Give yourself 5 hours
  to work on whatever." With three stills: a young East Asian woman's face under a soft key light on dark, her lips in
  close-up (fine lip lines, wet highlights), her eye and nose in close-up (pores, sparkle, a wet tear line).
  Built from it: the flashlight (F), cleaning (a stain scrubbed away by holding the click), the peephole, the power cut (a breaker box),
  footsteps by the room's floor, the player's and the cast's (the format's `floor` always said it sets them; Play now plays them),
  examining (a small thing you look at taken up in your hands and turned), a door's latch (lock up
  from inside), quick events for each on the desk (a chore, lock up, the power cut, a knock, the flashlight flickering), and the notes route for all of
  them (the chart script and the build know stains, breakers, peepholes, flashlights, the power and locking a door); the skin research in
  docs/research/skin_v2.md (the stills measured, the plan in eight steps), its first step's light as an option in the
  Character Studio (reference (film)); the rest of v2 unbuilt, the user's call.

## 2026-10-28 (the controls' symbols, our own)

- **The pause menu's control symbols, more original**: "Modify the controls UI symbols to be a bit more original". The
  layout stays (the controls on the left, their words beside them); the symbols are the Studio's own: each key a
  frosted tile standing on its lip, its legend in the middle; W A S D a pad round the dot that is you; the mouse a
  pebble without a cable, the button or the wheel it means lit; and beside each, in the theme's accent, what it does as
  the HUD shows it (the reticle's ring, the inventory's row, a thing set down, speed lines, your eye coming down).

## 2026-10-27, later (your notes any way you like, Claude makes the chart; an inventory; the controls on Esc)

- **Write any way; Claude turns it into the chart** (the syntax was the wrong approach): "I just realised the syntax
  script to writer is the wrong approach, I should just be able to write the game out anyway I want in notepad (but
  I'll try be clear with what happens, maybe suggest a couple of symbols), and then we will use Claude to convert it
  into a writer block game, maybe just make yourself an .md so I can run the command and maybe a claude folder for
  storing these kind of claude tools, basically I'd just pass you what I wrote and roughly want, you'd make that into
  the writer block flow chart so I can inspect, if that looks good you convert it into the director tool and that's
  where I start refining everything, swapping out block objects for real ones". So `/chart` and `/build-game`
  (`.claude/skills/`), docs/NOTES.md the few marks suggested; the syntax stays as Claude's own script
  (`.claude/skills/chart/script.md`, what the chart is read from), and the writers' room's Notes tab is gone.
- **A place designed first**: "maybe I can predesign a studio before you make the game in director so you can use
  that as a background reference to place objects".
- **Simple horror-game controls and an inventory**: "game should have G for drop (typical simple horror game
  mechanics), don't need gravity mechanics, we do want an inventory system, maybe change E to be inventory (if
  something else is already that) and we have left click for all interactables, inventory should be a very simple one
  row with each item that's been picked up in it, press E to hide it (current equipped item should always be
  centered, so basically it kind of scrolls through, we can see all the items on the left and right, if the player
  somehow picks up too many items the row should almost be like a hidden wheel where some items disappear when they
  are too far from the centered equipped so we always show a max of 5 items at once) though I will try limit to what
  can be picked up at any point. Have the items in front of a frosted glass, gradient UI without a border."
- **Esc shows the controls**: "When we press escape we should see controller options on the left side similar to
  image 1" (outlined keys: WASD movement, the mouse to interact, the inventory, Shift run, C crouch).

## 2026-10-27, notes (the whole story written on the phone; choices at the bottom centre)

- **The story written in the phone's notes app, imported into the writers' room**: "I want to be able to write out the
  whole story in notes on my phone and import it into writers app into a fully fledged story as I like writing on my
  phone ... come up with a syntax system I can use and I write my whole script in notes". Things are names, not assets:
  "items etc should be treated as variable names which are small/medium block items that will be replaced with the
  real visual, location etc later"; "basic Chilla's type actions to do with items, open, close".
- **The player answers with an act and a thought, not a line**: "rather than writing player dialogue for optional
  answers/responses I like more of a `[ Greet ] She's probably cold, I should let her inside --- [ Question ] She looks
  different`. So for player it's the action as a response with a bit of internal monologue". Their own example
  (thoughts in quotes, `*knock, knock*`, `*open door*`, `Hidden Timed Task - Clean up`, `*Enter Name*`, X for the
  name) is the syntax's base: now Claude's script, `.claude/skills/chart/script.md` (superseded above: the user writes any way).
- **Choices at the bottom centre**: "We will need to update the UI since we moved away from voice acted lines to
  multiple choice and player choices to be at the bottom centred of the frame (with padding) so it flows better". Every
  choice (a reply, an `ask`, a timed choice, a board game's call) sits under its question in the footer, at the bottom
  centre; the camera's focus still holds on whoever asks.
- **No Japanese over the English**: "we no longer need the japanese dialogue /text above the english since we will
  have a system for changing the entire dialogue and no japanese audio". The HUD (Play and the Watch) shows the lines
  and the answers in English only; the pause menu's "Japanese over the English" and the Watch's "speak the Japanese"
  are gone; the bake gives Unreal's preview no Japanese. A clip's `ja` stays in the format for the voiced games already
  written (the desk still edits it there, and hides it in a game with `voice: "none"`); other languages come later
  from a system that swaps the whole dialogue (EXPRESSIONS_PLAN §3's string tables).

## 2026-10-27, the change of course (the writers' room is yours: a flowchart you draw)

- **The story is written by the user, as a flowchart**: "I want to change the writers room so the entire story gets
  written by me and flow (using drag and drop things like lucid chart that make it easy for claude to set it up later
  in director tool). No longer do I want ai to generate the story etc, I will write the jist myself."
- Claude's calls inside that: no model runs in the writers' room at all (the drafting stages, the assistant and the
  Claude/local switch are gone: `gen.py`, `llm.py`, `claude_api.py`, `fake.py`); the river map becomes a chart you
  draw (docs/WRITERS_ROOM.md §2): shapes dragged from a palette (start, scene, talk, task, chapter, choice, secret,
  ending, note), arrows from their dots, acts as frames, the inspector for the gist and the details; the prototype's
  format 2 (nodes, edges, frames), the first format upgraded as it's read; **Build stays** (the chart into a rough,
  working outline, its board laid out as the chart was) with BUILD.md for Claude, and Claude reads the chart with
  `room.py show`; the faces stay (a MiniMax post prompt picked per line and answer, optional); the example session
  "Ticket 114" (the old assistant's draft) kept as a chart.

## 2026-10-27, last thing (a dashboard; the writers' room; one-hour relatable games)

- **A dashboard for every tool**: "an easy UI dashboard to launch and stop all of the tools (like the terminal but an
  actual ui dash ... python dashboard.py and then it handles the rest of the tools ... it should sit in the root
  folder)". Built: `dashboard.py`.
- **The writers' room** (docs/WRITERS_ROOM.md): "before we even start working inside the director or character creator
  I want a new AI/Claude/LocalLLM (toggleable) assistant for writing scripts/flows/storyboard/rough scene setup";
  sessions loaded or new; the type of game and reference stories ("real life things that happened or stories to use
  as reference"); Claude works it into a flowchart that Claude can later build in the director: "the workflow turns
  into a refinement in director whereas this new tool is just prototyping ... director has too much clutter, I just
  want to be able to see the rough flow chart of the story and what happens and how it ends and follow the
  rivers/points". "Claude can see what the tool does and is showing."
- **Three endings by default**: "the intended ending, and two others that I can input or get you to suggest off by the
  reference stories".
- **One hour, played again**: "1 hour playthrough with replayability to get the other endings or secret paths"; away
  from Five Hearts Under One Roof's cut-off branches: "secret parts will just jump you to the next main point (but you
  got to see an easter egg / unlock a secret achievement) so the game should feel like you're watching a story
  unfold".
- **Faces as MiniMax post prompts, 4 seconds**, for the dialogue and cinematics, in this form: "her eyes roll up as she
  bites her lower lip, she nervously looks down and then back at the viewer"; "I don't really want to have to
  prompt/generate for more than 4 seconds videos ... compress the expressions into 4 seconds and we manually will
  extend it in the expression tool ... realistically 8-10 seconds"; a library of generic reusable ones.
- **Loops and blends in the expression tool**: "in the expression selector I can also see a timeline and create a
  loopable [part], meaning afterwards we can drag a loopable version of the same expression and it motion tweens a loop
  of the selected timeline. If I drag multiple expressions I should be able to blend/tween between them so it doesn't
  instantly jump to default static expression" (EXPRESSIONS_PLAN §2b).
- **L.A. Noire for the multiple choice**: "you can learn of the story's main intentions via looking at how the
  character's face reacts to what you say (these scenes should be planned for more intimate close up moments)".
- **Build**: "when I'm happy with the prototype I click build, and it will build a super rough (non refined) but
  working outline of the game inside director ... Claude should be able to refine and make it workable in director";
  how is Claude's call: a working outline and a `BUILD.md` handoff (WRITERS_ROOM §7).
- **The niche**: "the games need to make it feel relatable ... we mostly will focus on relatable stories like a distant
  friend invites you over and something isn't quite right ... if it is more bizarre you need to make it flow that we
  make the person believe this bizarre thing somehow actually managed to happen ... an interactive story that's got
  light gameplay that matters and affects the story but isn't too confusing, with more niche easter eggs for the
  players that like to discover and figure things out, which unlock achievements".

## 2026-10-27, late night (the study's five: a to-do list that can fail, nights as chapters, requests; no phones, no ending cards)

The user's answers to docs/research/chillas_art.md §3:
- **1, the to-do list: build it**, "that can be the quest tracker, we should also have a feature for if you failed a
  task in the to do list". Built: `todo`, `tick`, `fail`, `untodo`, the `ticked` and `failed` triggers; a task ticks
  or fails by itself (`ticks`, `fails`, `secs`), a failed one stays struck out in red (STORY_FORMAT §4).
- **2, nights as chapters: "sounds good"** (sleep in a bed, a title card, the time of day, an autosave).
- **3, the pocket phone: no**. "I don't like mobile phones; if we do use them we will have more analogue ones" (a
  landline, a payphone, a pager: never a smartphone in the pocket).
- **4, a visitor: yes, as an easy request system on the to-do list**: "where something is requested, it waits for it
  to complete, then it leaves. Leaving doesn't need to be the scene, it could basically be [the] character / NPC, if
  they are a main one, carries out to the next 'shot', e.g. they asked us to do something in the kitchen while standing
  waiting for us to do it, we do it, next shot is them walking towards the couch and sitting and we continue the next
  sequence."
- **5, the epilogue card: no**. "I don't want ending cards, I will have ending cutscenes."

## 2026-10-27, late (no more quick-time events; keep the game simple)

- **Quick-time events deprecated**: "update the pilot and from the game deprecate for now the spam e or drag etc types
  of events, they break the immersion"; "realistically the game should be pretty simple, discover things, interact,
  choose dialogue options, no more quick time events etc, I need to remember I'm an indie dev so I can't implement as
  much as something like Dark Anthology". `press`, `mash`, `hold`, `breath`, `aim` and `struggle` are deprecated (the
  story check warns, the desk offers only `choose`); the Pilot's grab and locker are dialogue choices now.
- **A quick study of Chilla's Art's games** against what we have: docs/research/chillas_art.md (what's missing, each
  small; the user picks).

## 2026-10-27, night (English text with a blip, an expression library, faces on the timeline, look-at by angle)

- **English, with a system to swap in a country's own lines**: "I will be moving away from Japanese and sticking to
  English (though keep a system so we can replace dialogue with country specific easily)".
- **No spoken dialogue: text with a typewriter blip**: "just have the text and maybe add an undertale text
  sound/typewriter sound where we play a micro audio snippet per sentence (maybe work out sentence length + some formula
  for how many times to repeat the snippet of vocal effect)".
- **A library of mocapped expressions instead of talking faces**, placed on the timeline: "in the timeline I can place
  facial expressions from my library and even blend between multiple ones (like a new timeline row for facial
  expressions assigned to a character + ability to add more rows for other characters)", "looped expressions or
  reaction expressions for non cinematics", and **eyes and head that follow the player inside an angle**: "watch the
  player for that scene if the player is in lets say x radius e.g. 90 degree radius (from front), otherwise they go back
  to looking at whatever they're pathing or defaulted to".
- **Importing**: "pass in a video of a face, we process that mocap face expression data and then I can preview it
  against a default character or an actor we have in our game (or even just manually select a character we have
  exported), I should be able to name the expressions"; the library on the right of the storyboard planner, thumbnails
  that play on hover with the name below or names only, dragged onto the timeline; Import: pick a video, wait, a preview,
  name it, Accept; delete by a red x on the thumbnail with an "are you sure". **The capture tracks the whole face (eyes,
  mouth...) but not the head** (Kimodo moves the head). The user's test video: a 3 s MiniMax clip.
- Claude's calls inside that: docs/EXPRESSIONS_PLAN.md (steps 1 to 5); the library built first (step 1), Studio-wide
  (`Content/Studio/Expressions/`), the curves tracked and the face videos and posters git-ignored like the face page's
  pictures; the raw scores kept so Neutral (first frame, quietest, none) and Strength stay choices; a removed expression
  moved to `Saved/Expressions/removed/`, not deleted outright.

## 2026-10-27, evening (the export carries the Studio's colours; branch `dev-002`)

- **A character exported for the desk had no colours** (the user put a Studio character on the Pilot's Mari: "why are
  the colors for the character missing (no skin, no clothing)"), then **"build it on this branch"** (`dev-002`, the
  merge of the four branches). The Studio's colours are drawn in shaders (the procedural skin, the tailor's fabric, the
  hair shader of the brows and lashes) and glTF carries none, so the skin and the clothes came out white and the lashes
  without a material. Now the export bakes what the shaders draw into textures (`tools/character/albedo.js`,
  docs/CHARACTER_STUDIO.md §3.1).
- Claude's calls inside that: the colour **before the light** only (gloss, the dewy glow, the pores' relief and the
  glow through the skin are left to the renderer, the desk's or Unreal's); the skin at 4096 px on MHR's own UVs; each
  garment part on its own islands at about 2 mm a pixel with its fabric metres kept as a second UV for a PBR set's
  other maps; brows and lashes as the salon bakes hair (the atlas in the look's colours, cut out).
- Earlier the same day, on the salon's retro look ("after I toggle psx dither I see it but once I bake the hair ... it
  disappears"): the dither is a screen effect; the bake paints it into the strand atlas, where filtering averages it
  away. Left as it is ("the explanation was fine"); in a game it's a post-process or the hair material's.

## 2026-10-27, later (the designer clothes reviewed as a lead art engineer)

- **"Review the new clothes and improve, some don't look natural"**: every designer outfit on contact sheets, five
  views and a close one, judged by eye and fixed (docs/TAILOR.md §2b has what read wrong and the rules). What changed:
  jackets and coats get a built shoulder (`ease.shoulder`) and bridge the body instead of hugging it; the blazers meant
  to be worn open are cut open (`blazer-open`, the pink oversized one, the coat), their lapels falling open; the
  turtleneck's collar is soft; the coat's sleeves hang (a turned cuff no longer holds the wrist); the jeans keep their
  cut at the ankle; the hood lies flat with a rolled rim; the lined lace, the silk and the satin tiles are quiet on a
  big surface; the knee boots have a boot's shaft, a heel and a top band. The office and school blazers gained the
  shoulder too (they stay closed).

## 2026-10-27 (the clothes: an edit mode, the designer collection, pictures; branch `clothing-expanded` off main)

- **Editing a garment must be instant** ("clothing is extremely laggy to modify, realistically I can't modify it as it
  takes 2 minutes to update the change; if we could make a basic non-physics edit mode, which shows the guide lines of
  the clothing piece, and I can modify that (length, sleeves, fit/tightness etc.), and when I'm done click bake and it
  creates the new version based off those guidelines"): the Clothes tab's **Edit the cut (no cloth)**: every worn
  garment as a film on the body with its cut lines (the hem, the neckline, a front opening, the sleeves' ends, the
  waist, the legs' end; a skirt as its rings), the handles and the Shape sliders (Fit among them) moving a line at once
  with nothing cut or hung; **Bake** cuts the clothes to the lines and hangs them. The old way stays with the mode off.
- **New stylish clothes under a Designer tab, one outfit per reference image** ("add some new stylish clothing under a
  tab called designer maybe and add the clothes/outfits shown in the reference images, try create one for each"):
  twelve outfits (one for the lace jeogori, four for the street looks, one for the rainy-day coat, two for the modern
  hanbok, four for the menswear) and the designs they needed, in `Content/Studio/Clothes/`, on their own tab in the
  outfit picker (Designer, Studio, Underwear).
- **Pictures instead of names for the outfits** ("instead of just words could we update the presets so there is a
  thumbnail using the default model with the outfit"): every outfit a picture of the default model (a new character's
  body, halfway between the bases, 1.70 m) wearing it, hung by gravity, made by `tools/character/tailor/thumbs.mjs`
  into `Content/Studio/Clothes/thumbs/` (every design alone too) and shown as cards in the Clothes tab.
- Claude's calls inside that: the guides are the cutter's own lines evaluated on the skin (`tailor/guides.js`), so a
  slider in the edit mode shows exactly what the tailor will cut, and a film's edge is drawn in the shader so it follows
  the pose and the zoom; what the references needed in the tailor: a wrap front (`open.shift`, a jeogori's diagonal with
  its collar band along it), a neckline that climbs the neck (`neck.rise`, the turtleneck), a skirt that never narrows
  from its top (`straight`, a chima gathered under the bust) and one open down the front (`open.gap`, the long coat's
  skirts, worn under its top as two garments), a lined lace and a sequin fabric, the knee-high boots cut as a shell
  (lofted from the foot they cut into the calf); hats as accessories (a beret, a cap, a bucket hat, a beanie, on the
  head's own outline) brought by the outfit that wears one, sunglasses the same; what the pictures can't show: those
  hats and sunglasses (they need the face's landmarks), a bag, a scarf.

## 2026-10-26, past midnight (more instruments, swappable strings, sound effects in the flow)

- **Add every CC0 instrument we can find for horror** ("add everything you can"), after the search for open
  libraries of horror strings and sound effects: 28 more instruments from VSCO-2 CE and VCSL, the same CC0 libraries
  as Woohill's, fetched by `tools/score/fetch_samples.py` (docs/MUSIC.md §7). No open library records horror string
  effects (clusters, scrapes, col legno) under CC0, so those stay as the score room's filters (`tone`) and the bowed
  and scraped metals.
- **Notes on which sound works best, and the strings easy to swap so the user decides by ear.** The string sets
  (section, full, low, solo, eerie, glass) each come with a note. The cue says which set it suits, and every
  instrument has a note on what it's for in the Instruments list.
- **New instruments only in the expanded scorer.** The original 42 cues keep Woohill's instruments (only the string
  set changes who plays their strings). The new instruments have their own twelve cues, the Expanded orchestra family.
- **Sound effects aren't part of the orchestra, but they're in the flow.** They're a shelf of their own,
  `Content/Studio/SFX` (`tools/sfx.py`, docs/SFX.md): a story sound names one as `sfx/<name>`, the Database picks and
  plays it, Play and the Watch play it. The score room doesn't touch them.
- Claude's calls inside that: CC0 or ours only (CC-BY packs like ObsydianX's drones and anything that can't be
  shared as files, Philharmonia's and Sonniss's, were left out). The Pilot's and the Sample's placeholder sounds now
  point at the shelf. Sounds that no single file covered were built from parts (three knocks, steps through the
  ceiling, stings from metal hits) and the answering machine's beep was made from a sine.

## 2026-10-26, later still (easier hair editing in the salon)

- **Every pain point of docs/SALON_REVIEW.md is built, and the flow made easy** ("off of main create a new branch
  called easier-hair-editing, first make a list of hard points/difficulties for users to make hair given the current
  system and then list them for me to enhance", then, on the list: "Add all the above and make the flow easy to use"):
  the nineteen items, on `easier-hair-editing`, in the review's order. The user's own three: **the end of a lock as a
  vector** ("I select the first line, and then we drag a single vector point to determine the length and orientation
  and click okay when happy with the look"), **a side view** ("have a side view available, so we can view the points
  from diff angles and modify") and **the pull kept to a lock, its twin or its group** ("when working on 1 strand, I
  would like to be able to modify/lock the strand or mirror group so when I use select drag and select a large effect
  radius, I only effect the hair in that group/mirror rather than every strand we've created").
- Claude's calls inside that: the pull's **scope** defaults to the lock and its mirror twin (the ring lights only what
  the scope takes, so a reach never surprises); a **locked** lock or group is left alone by pulls, Gravity and the
  cover but still drawn, picked and laid over; a lock is committed by its end click as before and stays **in hand**
  with its arrow until OK or Enter (the fast path keeps its two clicks), Delete removes it; the arrow's drag turns and
  scales the lock about its root, keeping the shaping done by hand (points that lay on the body lie on it again, the
  rest keep their distance), instead of redrawing it; the view buttons live in the header (nothing over the view steals a
  click); Split's right pane starts as the character's left side; picking takes the lock nearest in depth and never one
  the head hides, a click again cycles; a sheet's root line slides by its middle and stretches by an end; the draft
  replaces rather than merges (the salon has no second editor); dragging a lock's body swings it about its root (Shift
  slides), with Blender's R and G as the keyboard way; several picked (Ctrl-click, a box) narrows the pull to them.

## 2026-10-26, last thing (the rest of the lashes: the second reference's five sets)

- **The five lash sets of the user's second reference, made** ("I realised I forgot to make all the eyelashes, earlier I
  provided a future ref photo in the other session to make more eyelashes, can you make a new branch eyelash-more and
  create the rest"; the photo, five rendered pairs of eyes, is written up in docs/research/lash_reference.md): lash
  styles in a group of their own, **sparse, thin (men, older)**, **glam volume**, **fluffy mink**, **doll volume** and
  **natural medium**, each also a whole look (older man (sparse lashes), glam smoky plum, fluffy mink, doll volume,
  natural medium), and what they needed: a **lower liner** (the painted liner along the lower lashes' roots too: its
  amount, thickness and reach), lash looks **brown**, **greying** and **grey**, the makeup presets **smoky plum**, **bold
  doll liner** and **tinted waterline**, and **Hooded lids** in the sculpt for the reference's old man.
- Claude's calls inside that: made from the write-up (the photo never came into the repo), judged on renders of the
  Studio's eyes from the front, three-quarters, close and the side with a violet iris like the reference's; the looks
  leave the irises as they are (the reference's violet is its render's); the older man's look ages the skin to seventy
  and over, puts the brows on full and ash, a little red in the whites, no makeup, and the lashes greying (dark hairs
  with pale tips, about a third grey all along), but leaves the hooded lid to the sculpt (a look never changes the
  face's shape); Hooded lids never touches the lid's own edge (nothing within 2.8 mm of the line the eye is cut along
  moves), so the opening, the rim and the lashes' roots stay, and the skin gathers into a fold without turning over;
  the doll volume's lashes sweep up and out together rather than standing straight up (a fence, on the first render);
  the plum is a saturated one (a dull plum read grey-brown on skin) and spreads up to the crease (Eyeshadow size: under
  the glam lashes the lid's own shadow didn't show); the eyeshadow's lower edge and the under-eye wash's are eased (as
  hard steps they drew straight lines across the skin beside the inner corner once the shadow spread wider: the looks
  made before change only there); the upper lashes' slider runs to 240 (a fluffy
  mink set is about 200); a masculine base still starts with the lashes off, as every new character does.

## 2026-10-26, late night (iris patterns and pupil shapes)

- **Patterns inside the iris and pupils of other shapes, after the user's references, a heart among them** ("could you
  design some other types of pupil shapes inspired by these references (I'm talking about the interior pattern inside
  the iris), including a love heart shaped pupil one as seen in image 3": violet irises with an orange-gold sunburst
  round the pupil, with electric pink streaks, with a fiery ring like a corona, a grey iris with a jagged violet ring;
  gold, green, magenta, red and dark brown irises; a pink iris with a black heart for a pupil; a real grey-blue iris
  close up). The eye now has an **iris pattern** (natural, sunburst, lightning, nebula, crypts, halo) in an accent
  colour, and a **pupil shape** (round, heart, slit, bar, star, diamond, cross, crescent, flower, ring, two, none) in a
  colour of its own; and **styles** after the references that set the colours, the pattern and the pupil together.
- Claude's calls inside that: the shapes drawn as distance fields, so they stay sharp at any size and grow and shrink
  with Pupil size; the pale ring round the pupil follows its shape; a few shapes for horror the references didn't
  show (a hollow ring, two pupils, none) and styles for them (Hypnotised, Two pupils, Possessed); a character made
  before keeps its eyes exactly as they were (natural, round). Everything is in the shared eye, so the desk shows it
  and an export carries it to Unreal in its baked paint.

## 2026-10-26, night (eyes like MetaHuman's: the Studio, the desk, Unreal)

- **The eye is made MetaHuman's way, in the Studio and wherever the character goes** ("experiment with applying this eye
  to our eye in studio so we can use it in director ... we should be able to export the character with this eye into
  unreal", after the research in docs/research/eyes.md): the iris on a plane behind a refracting cornea, the cornea
  reflecting the lights, the iris lit as a bowl; our own code after RoboPoets' Godot eye and O3DE's (MIT, Apache or MIT),
  shared by the Studio and the desk (`tools/shared/eye.js`). On for every character; Refracting cornea off brings back
  the painted eye.
- **The desk gets a simple view for when it lags**: textures off, a plain gray viewport like Blender's solid view.
- **The export carries the eye into Unreal.**
- Claude's calls inside that: with the refracting cornea the catchlights are the lights' own reflections (the painted
  ones only with it off); the pupil's default a little smaller (the cornea magnifies it about a tenth, as a real one
  does); the paint drawn by the shader in Epic's flat layout and baked into a texture for files. The desk wears a
  Studio character as a cast member's body (`previs_body: "people/<name>"`, its export): its own look and shape, the
  cast member's height, its eyes refracting as in the Studio. The simple view is the toolbar's Simple: plain colours,
  no textures but cut-outs, the eyes their flat paint, one pixel per pixel, remembered by the browser. In a file the
  lids rest on the eyes (the skin round each opening brought forward up to 3 to 4 mm onto the eyeball, as real lids
  lie, rather than the eyeball pushed back and dented): from the front it's the Studio's face; from the side the lower
  lid sits a little further forward than the Studio draws it. And the Studio's left inner corner, which showed a
  diamond of eyeball on every character (the smoothed lid line crossed itself), is a clean corner now. In Unreal the
  eye is our own material (M_StudioEye, made from text: Epic's eye material and textures are Epic content), on the
  Clear Coat model with the refraction in Custom nodes; a cast member who is a Studio character goes across as that
  character in Generate's preview and in the level. Written without the editor here: its first run is checked by eye
  (UNREAL_FLOW §1d).

## 2026-10-26, night (anime lashes and the pink eye makeup after the user's references)

- **Lashes like the user's references** ("create eyelashes that look like ref images": a drawing of three pairs of eyes
  with long spiky lashes, a bold liner and pink round the eyes, and a photo of an anime lash set on an eye: separate
  spikes with gaps between them, long ones alternating with short, the outer ones longest and swept out, the lower
  lashes in thin spikes pointing down the skin), **as presets in the style dropdown** ("have them as female or add a
  dropdown for presets or something"): three anime styles (an anime lash set, drawn manhwa wisps, an anime doll ringed in
  short spikes) beside the natural ones, grouped; three new sliders behind them (Spiky clumps, Long and short, Lower
  lashes down) so any style can be pushed either way.
- **A makeup preset for the pinkish hues round the eye** ("observe the little colors around the eye lash that emphasize
  the eye's shape ... add a make up preset that emulates this exact look for eyes"): **anime pink**, in the Skin tab's
  makeup presets, and a whole look of the same name (Face, Look) that puts the anime lashes on with it. New makeup
  layers for it: an under-eye wash, the inner corner, the waterline, the eyeshadow's placement, the liner's thickness
  and its point past the inner corner.
- **The lashes exactly like the anime lash set, as far as the renderer can** ("It doesn't look anywhere as good as
  this, we want the eyelashes to be exactly like this style if possible, tell me if it isn't"): the first spiky lashes
  were wedge cards and read as solid black triangles; every lash is now one fine hair (a thin card with one strand of
  the lashes' own atlas), hundreds an eye, in clusters that draw to points, long, medium and short clusters in turn,
  a short fringe under them, clusters crossing, the outer ones swept up and out, the lower lashes in small clusters
  down the skin: judged on the Studio's eye close-up against the photo, open, three-quarters and shut. What the
  renderer can't give: the photo's soft focus and the hairs' glint under a real light; what's left to the user's eye:
  the hairs' thickness and count, how far the spikes rise, the lower lashes' length (all sliders).
- **No skin between the lashes' roots, and lashes that turn with a blink** ("fix the little gaps that show skin where
  eyelash should be. Also consider how the eye should be when the eyes blink, it shouldn't disappear but should now
  angle towards the viewer. Feel free to create more vertex points or create a bendy bone system for each eyelash so
  it bends along the eyelid's movement"): the lash line is a dense fringe over the whole rim and a little up the lid
  (its own mesh and atlas), and each lash's frame is set on the open lid and turned with the lid about the eyeball's
  middle as it shuts, with the margin's droop, so a shut eye's lashes point at the viewer and a little down, still on
  their rim (a bendy bone a lash, in effect: one turn about the lid's line per root).
- **Shut, the lashes stay on the upper lid, and no dark patch on the lid** ("The eyelash has moved to the bottom eye lid
  in this photo when it should be aligned with the upper one, what is that dark patch above the eyelash on the eyelid?
  It doesn't look good"): the margin's droop had been applied to the rim the lashes grow from too, which put their
  roots below the seam; the rim now swings with the margin alone (the roots level with the seam and forward of it,
  the upper lid's own edge) and the droop is on the hairs' direction only. The patch was the painted liner, found by
  rays on the shut lid's bulge, and a wing twice too fat: the liner's lines now come from the open lid swung with the
  margin like the lashes, a thin line along their roots in any pose, and the wing is a flick.
- **The lower lashes neither angular nor fading** ("could you fix the bottom eyelashes though, they seem to look too
  angular and partially blend/fade away in the skin"; Claude circled the inner, middle and outer thirds and the user
  confirmed: "matches what I see, for solution do whatever is most aesthetic and technically correct"): each lower
  lash is one hair rooted at the margin's front edge (the waterline shows between the eye and the lashes, as in a real
  eye and the reference; the stretch across the margin ran toward the viewer and kinked down into an L), leaving along
  the skin over the edge and easing into its own direction (no corner), at most 57° down (clear of the skin under the
  eye); the lash atlas's strand is a solid core thinning to the tip and black to the end (a soft core mipped down to a
  few pixels went grey over the whole card; a fading tip dissolved into the skin), which made the upper lashes crisper
  and blacker too.
- **No skin at the corners of the upper lid, and the lower roots on one line** ("we improved the bottom but made the
  upper worse again, see in green circles gaps of skin where it makes it look eyelashes is clipping through when it
  should sit/bend/curve above it. See the red line, that should be the guide line for the roots of the lower
  eyelashes": the corners of the upper lid circled, a line drawn along the lower lid's margin): both came from the rim
  the lashes lie over being faded to nothing at the corners; it now runs to the corners (searched square to the lid's
  own line, a far pick on the wrong skin dropped, a corner that finds nothing filled from its neighbour), the lashes
  root on it all round, the innermost 7% of the upper lid carries none, and the lower roots follow the margin's front
  edge as one smooth line, corner to corner, where the user drew theirs.
- **Three eye shapes, as lashes only** ("could you now go and make presets for the following shapes": a drawing of
  three pairs of eyes; Claude masked the left eyes in green and named them fox almond, half-lidded and round doll; the
  user: "you don't need to worry about the openings since it won't work if I use image to face scan path, just focus on
  the overall eyelash shape and direction"): three lash styles in a group of their own (the fox's fan swept out to a
  wing, long at the outer corner and short at the inner; the half-lidded's dense lashes down over the eye in a band;
  the doll's short spikes radiating all round) and three whole looks that add the liner each drawing carries (the
  wing, the inner point, the pinks). The opening is never changed: a character's own, from the scan.
- **For later: five more lash styles after a second reference** ("For later (save as a reference for now) I want us to
  make these eyelash shapes too as seen in this image (thin ones for men etc)": five rendered pairs of eyes: an old
  man's sparse thin lashes, a glam volume set with smoky plum makeup, a fluffy mink set, a doll volume set with a lower
  liner, a natural medium set with a tinted waterline). Written up in docs/research/lash_reference.md with a style
  sketched for each; not made yet.
- Claude's calls inside that: the painted liner was all but invisible before (it ran along the lid line, which lies
  under the lashes and the eye's cut); it's now painted from the lashes' roots up the lid, between two lines found on
  the skin, so it hugs the lashes in any pose. The old "Doll (anime)" style is relabelled "Doll (full, dense)"; a style
  now sets every lash slider, so switching styles never leaves another's spikes behind. The new lashes and the makeup
  were judged on renders of the Studio's eye close-up against the references (an anime lash set reads as spikes at
  16× the roots' spacing between them; the lower lashes 62° down the skin).

## 2026-10-26, evening (the T-pose's neck upright; lashes over the lid's rim)

- **The T-pose's neck stands upright, like the user's reference** ("I like the new tpose ... but the neck is too curved
  forward, to the point it looks uncanny ... it should be more aligned like image 2 (the real life neck reference if
  possible)": a real woman's profile, her neck nearly upright). MHR's rest pose carries the head 6 to 7.5 cm ahead of
  the shoulders; in the T-pose the body under the head moves forward, the head staying exactly where it is, until the
  ear is over the shoulder's top. Only the view: the A-pose (MHR's own) and everything written stay as they were.
- **No bare skin between the eye and the lashes** ("the eyelashes have a large curved gap where the skin shows ... fix
  it so the eyelashes curve along the skin in that area", a close-up with the band circled): the lashes lie over the
  lid's rounded rim from the eye to its front edge, along its skin, and lift from there, as real lashes grow from the
  lid's front edge; the lash line lies on the same strip.

## 2026-10-26, later (slim default bodies; clothes tailored after the user's references)

- **The default bodies are slim and young, after the user's references** ("why do we default to a chubby model ... can
  you make the default physique for genders more like these examples": five pictures, slim young women in a school
  uniform, an office blouse and pencil skirt, a skirt suit and a loose shirt with shorts, and a slim, athletic young
  man in a t-shirt and trousers). The Feminine and Masculine bases are refitted (`mhr.py presets`): the woman slim
  with a flat stomach and a gentle hourglass (about 83/57/93 cm at 1.62 m), the man slim and athletic with a V (a
  78 cm waist at 1.76 m). New characters start halfway between the two, no longer at MHR's own average (a heavy body:
  a 91 cm waist at 1.70 m). The heads are kept exactly as they were, so faces, photo fits and hair made on a base stay;
  characters made before take the new bodies.
- **The clothes look professional, like the references** ("Clothing should look more aesthetic like these examples
  including how they wrap around the body"): cut close and following the waist, a blouse tucked smooth into a high
  waist, a pencil skirt over the hips, a fitted blazer, crisp pleats; the drape's fullness only enough for soft folds.
- Claude's calls inside that: what MHR's shapes can't do (its average belly) a base carries as a sculpt; the bases'
  measures are written down in `mhr.py`; the sleeves end at the wrist by MHR's own joints (they were 6 cm off either
  way on the new bodies).

## 2026-10-26 (clothes hang: a cloth simulation, baked; a fit down to skin tight)

- **The clothes looked dead** ("Can you enhance the clothing it looks death"): smooth shells round the body, the bust
  and the belly showing through as if painted on, nothing hanging. They are now **simulated: hung by gravity and
  baked** ("add clothing sim +gravity + bake to get a more realistic shape"). This replaces 2026-10-23's "the cloth
  doesn't need to be properly simulated". The Character Studio hangs every garment that hangs over the body and the
  clothes under it, in MHR's own pose, and keeps what it falls to with the character, so the desk and Unreal get the
  hung clothes (docs/TAILOR.md §1c).
- **A garment can be made skin tight** ("add more of a skin tight slider"): each garment has a **Fit**, 0 skin tight
  to 1 as designed to 2 loose.
- Claude's calls inside that: the fabrics' weights and stiffnesses are real ones (a t-shirt's jersey 0.18 kg/m², denim
  stiffer), tops are held round the neckline and bottoms by the waistband, a top worn under trousers or a skirt is
  tucked into them, a buttoned front stays closed, ribbed cuffs and hems hold, and a fit under a quarter doesn't hang.

## 2026-10-25, evening (the Character Studio: a T-pose to shape in, a flat stomach)

- **The Character Studio shows the body in a T-pose** (after the user's reference, a rigged woman standing with her
  arms level and her legs straight): MHR's own A-pose (the arms 48° down, the elbows bent, the hands forward) made it
  hard to judge a body while shaping it. The pose is only the view: the character stays in MHR's own pose in its
  files, its exports, on the desk and in Unreal, and the A-pose is a switch in the view bar.
- **A stomach can be truly flat:** MHR's average body has a belly its identity sliders can't take back (the flattest
  takes 1 cm of 3), so the sculpt has a Belly control: all the way down, a flat stomach; up, a rounder belly.

## 2026-10-24, evening (NPC states parked; the desk made easy, like RPG Maker)

- **No NPC states or behaviour patterns for the first few games:** what a cast member does in play is sequenced in the
  story (beats with `behave`, the play rounds' own phases), which is enough; docs/PATTERNS_PLAN.md stays as a plan for
  a later game that needs an NPC reacting on her own (a free-roaming stalker).
- **The director's desk should be much easier to use:** an intuitive, drag-and-drop tool in the spirit of RPG Maker MV
  (Claude as lead designer and UI artist): no JSON to type, things picked from lists of what exists, commands that
  read like sentences, drag to place, connect and reorder.

## 2026-10-24, small hours (day and night; the look's plugins; accessories; plushies and board games)

- **Each scene is day or night, chosen on the desk:** a scene starts at whatever time the scene it branched from was,
  and can be changed by hand (STORY_FORMAT §3.1 `time`; dusk too, Light Kit has it). A game starts at `game.time`;
  unset, that's **night** (Claude's call: the studio's games so far are dark interiors; change it on the desk's Game
  page). In Unreal, Light Kit's sky follows the scene's time.
- **The VHS filter has a night mode:** at night black records as a cool blue, (0.02, 0.03, 0.05), instead of the
  camcorder's warm lift, which fought the deep-blue night. Light Kit's sky turns it on at Night.
- **Baked day and night are two bakes** (a Lighting Scenario each); only the Dynamic sky changes time in play.
- **The plugins should be easy to bring into Unreal** (UltraVHS and Light Kit), and there should be a **guide to set
  scenes up in Blender** with the same effects.
- **The Character Studio gets a tab for facial accessories** (piercings, glasses, stickers and whatever else can be
  made), and **a saved character keeps enough to come back into the Studio and be changed** after it has gone to the
  desk and to Unreal, never starting from scratch.
- **The desk's game gets physics anyone can script:** plushies the player carries (hold E to pick up, hold E to drop)
  that jiggle like a plushie, on simple imported objects with plushie physics applied, extensible to other physics
  later; and **board games in the world** with predefined rules that are easy to add (Claude writes each game's rules,
  kept in storage: simple card games, dice, spin the cup, Russian roulette).

## 2026-10-24, late night (the look: after the user's reference)

- **The Character Studio's default look follows the user's reference** (three frames from a Unity viewport: eyes,
  face, lips and teeth; docs/research/look_reference.md): the iris melting into the white, wet eyes, gradient lipstick
  with a guide and an on/off switch, wet teeth translucent at their edges, hair with soft edges. New characters start
  from it ("soft cinematic", `tools/character/looks.js`); Face, Look applies it (or "MHR plain") to any character.
- **The lips' and mouth's lines stay MHR's own when an expression tucks the lower lip** (a pucker's creases are fine);
  at rest the lower lip curls into the mouth (Lower lip curl) instead of ending in a hard line.

## 2026-10-24, night (the desk plays the undressed game; Unreal dresses it)

- **The undressed, unprocessed game is playable in the director's desk; Unreal is for cleaning up, decals, advanced
  lighting, effects and UI.** Characters, their motions and faces, and how each scene plays are set up in the desk.
- **Face mocap is set up in the desk:** after the scene, set the characters, load the Kimodo motions, say whether it
  plays as a cinematic, gameplay or a hybrid, then the takes (video with voice) under the timeline and one click puts
  their faces on whoever speaks. Conversations by interaction, triggered sequences and the rest get the same ease
  (docs/PERFORMANCE_PLAN.md, a plan: not built yet).
- **Work while the user is away goes on `claude/experiments-afk`.**

## 2026-10-24, evening (character creator v3: the branches together)

- **The work moves to `claude/character-creator-v3`**, forked from v2, with the tailor (`port-woodhill-clothing`) and
  `claude/practical-tesla-zncon6` merged in; `glassmorphism-theme` went in later the same day, as asked (90 minutes on).
- **The tailor replaces the GarmentCode garment tool for good:** the old tool isn't kept alongside it. The sculpt's
  body (and a photo's face) is what the tailor cuts the clothes from, and they refit when the sculpt changes.

## 2026-10-24, later (circles on the body, a smoother bake, the view's buttons)

- **Shape by hand, with circles on the body** (after the user's references: a game's face editor and body editor):
  each circle a named control MHR's shapes don't give (the forehead's height first: the user's forehead was too big),
  both sides at once; dragging one moves its sliders, which turn **green while it's held**. Face circles in the Head
  view, the body's in the Body view.
- **A face fitted to a photo must keep the eye fix** (the user's bug report: the eye distorted with a face scan).
- **The bake can be smoothed:** sharp edges and spikes taken out in the bake only (Smooth curves, Tame flyaways); and a
  **retro look** that hides imperfections: unlit, flat colour, colour steps, the PSX's dither.
- **The view turns with the middle mouse everywhere** (as in Blender; Shift pans), and nothing on the page goes back by
  a slip (the mouse's back button, right-click, Backspace); leaving with unsaved work asks first.

## 2026-10-24 (the eyes on the model's own lids)

- **The eye's cut starts on MHR's sculpted lids, not MediaPipe's points:** the landmarks mapped onto MHR sit inside its
  lids (the opening came out about half the size of the model's). The opening is found in the mesh (the strip its
  blink squeezes shut), and the eyelid line's sliders adjust that. Lines saved against MediaPipe's points start
  again from zero.

## 2026-10-23 (a word for questions in play)

- **`ask` joins the format:** a stitch's beat asks the player something in play, the answers floating beside who
  asks or at the thing; an answer runs its own actions and is heard as `answered`. STORY_FORMAT §4.

## 2026-10-23 (choices float in the world)

- **Every interaction is in the world, the talking isn't:** a choice's panel floats beside whoever asks (at their
  shoulder, on the side of the frame with more room, so their face stays clear; the focus on them), at the thing it's
  about, or under the reticle when it's about neither. The question, like every line, stays in the footer.
- The pause menu's Quit keeps its choice in the menu (the game asking, not the world).

## 2026-10-23 (the camera person; the UI is what the lens is on)

- **A direction to lean on (not every game yet): the player is the one holding the camera** (a friend filming,
  someone on a shoot), the footage on tape. Not as harsh as the research's noisiest frame: a blend. docs/VHS.md is
  how to set it up.
- **The UI is clean because the camera is focused on it:** a held look pulls focus onto the thing (the world softens
  round it), the floating prompt sharpens as the reticle nears its point, answering someone keeps the subject sharp and
  softens the edges, a card softens everything. Built on the desk (`.ph-focus`); Unreal does it with the camera's focus.

## 2026-10-23 (the pause menu)

- **Esc in Play pauses:** the world holds (clock, timers, NPCs) and the lights go out (the frame flickers down to nearly
  black, like a dying bulb); the menu is drawn over the dark: Resume, Save game (an autosave row and three slots,
  overwrite asks), Settings (Display, Graphics, Audio), Quit (a footer choice: Stay, Quit to title, Quit to desktop).
- **Settings step, never slide:** ‹ value › with A/D or a click; levels are ten dashes. Each setting names what it is
  in Unreal (a console variable, a scalability group, a sound class): play/menu.js `SETTINGS` is the reference for
  Unreal's menu. The desk applies brightness and the subtitle settings; the rest wait for Unreal.

## 2026-10-23 (the HUD's four places; prompts float on the thing)

- **Anything done in the world floats on the thing:** the prompt sits where your hand goes (a door's handle, on your
  side of the leaf, though the whole door takes E; a pickup's or a note's middle), with the key, the verb and the
  thing's name (an item, a note's title). Kept above the footer; the reticle is a dot that opens into a ring.
- **Conversations and choices are an overlaid footer:** the speaker's name above the line, the Japanese small over the
  words, the options in their panel under the question, on one soft scrim that's there only while someone talks. The
  Watch's scene subtitles are the same footer.
- **The rest:** the corners are the game talking (objective, timer, log, stance); a note or a code lock is a card in
  the middle. One type scale, two voices (a serif for what people say and write, a sans for the game), one key chip,
  one thin-line meter. play/ui/hud.css says the four places at its top.
- **Romance-only games use the same layout:** themes change colours only; `glass-rose` is the warm one.

## 2026-10-23 (the Play UI is glass, not neumorphic)

- **The default Play HUD theme is `glass`:** frosted glass slabs with a little 3D (tilt, a thick lower edge), simple
  click-me buttons, no sliders. It sits under a VHS lost-footage grade in Unreal later.
- **Only the choices (and the reading and code cards) get a glass panel;** all other text is boxless with a soft, edge-fading blur behind it. The glass is nearly invisible on purpose (faint tint, soft blur, hairline edge); the weight and a liquid, chromatic
  shader come in Unreal. Every chip sits on one frame (`--ph-margin`, `--ph-pad`, `--ph-gap`): objective top-left,
  timer and log top-right, stance bottom-left, subtitles and choices bottom-centre.
- **A multiple choice is two panels:** the question in its own panel above, then ONE panel with the options side by side with centred dashes between them; the one under the
  pointer (or A/D, arrows, 1-9) brightens and the rest dim (`hud.choose`, `rt.choose`). The desk's Watch uses it too (replies, timed `choose` events), so a choice looks the same everywhere; the `chooser` in play/hud.js builds it. No new story word.

## 2026-10-23 (light: real day, a blue night, cheap tricks)

- **Realistic day and night by simple, cheap tricks**, as drag-and-drop pieces for any project (UnrealPlugins/LightKit),
  working with PBR textures and some baked lighting. Day like the VHS test's smooth, soft shadows.
- **Games start with day and night only. Night is a deep, pretty blue that feels real, never pitch black** (pitch
  black is a windowless building, not night).
- **Not as blurry as Chilla's Art:** the camcorder look (UltraVHS's Camcorder) is the aim; borrow their reflections
  (metal, wet ground, moving reflections) and visible light (the moonlit strip on the ground).

## 2026-10-23 (plugins for any project; the VHS look)

- **`UnrealPlugins/` holds plugins that work in any Unreal project**, not only HorrorStudio; each comes with
  instructions for Claude to add it to a project.
- **The first is UltraVHS**, a rebuild of the user's lost "ultra realistic VHS" preset from a capture of it: a natural
  camcorder look with a handheld camera (head bob). C++ is fine.

## 2026-10-23, night (the eyelid line by hand)

- **The eye's cut is set by hand, not guessed:** every one of the lid's 16 points has a slider (mm), both eyes mirrored
  unless unlinked, the line drawn on the face while it's set. **Save as default** keeps it for every character without
  its own line (`Content/Studio/People/defaults.json`, local). The built-in start: MediaPipe's points, the lower lid
  1 mm down (MHR's lower lid has a ledge MediaPipe's line sits on top of).

## 2026-10-23, evening (character creator v2: eyes that fill, brows and lashes on the hair shader)

- **The work moves to `claude/character-creator-v2`**, forked from the character creator branch.
- **Eyes always fill their opening, in any face pose;** they move with the gaze, a blink shuts them. The eye plane and
  vertex-based cuts are dropped (DECISIONS above, docs/LESSONS.md).
- **Brows and lashes are a new tool on the salon's hair shader** (not the old hair.js cards, removed): lashes rooted on
  the lid's edge, following the lid's rotation with a simple squash, no physics; brows flatter and simpler, on the
  skin. The look aimed at: the user's reference pictures (natural fine lashes, defined clumped lashes, soft straight
  brows). **New characters start with no brows and no lashes.**

## 2026-10-23 (the Hair tab is the salon; the Studio's own hair is scrapped)

- **The Studio's Hair tab opens the salon** on the character in hand: the salon's UI and steps inside the Studio,
  the character fixed by the Studio, its bake worn when you leave the tab. Only the salon makes hair now.
- **Scrapped:** the Studio's hair styles and wig (`wig.js`), the Perm library (`tools/perm.py`, `perm_run.py`, PERM),
  the photo match, fit and batching (`hair_match.py`, `hair_fit.py`, `hair_batch.py`), the GPU strands
  (`strands.js`) and the model wig (`wigify.js`). Brows and lashes stay, switched in the Face tab.
- **The salon has a bald start and a Bald preset** (no locks, no scalp shade).
- **Eyes: cut out, an eyeball behind.** Not the eye plane (tried and dropped the same day). The head's closed shell is
  cut out inside the lid outline; the eyeball behind each opening gets a size that grows from its pupil back into the
  head (it fills the opening, never clips out), and a pupil size.

## 2026-10-23, evening (PBR sets: one folder at the root, a viewer in the Studio)

- **PBR sets live in `assets/pbr/` at the project's root**, a folder each, and nothing inside it is tracked by git.
  The shelf's first place, `Content/Studio/PBR`, is still read so nothing there goes missing; new sets go to
  `assets/pbr`.
- **Maps are found by the naming the user's sets use** (`denim1_albedo.png`, `_ao`, `_height`, `_metallic`,
  `_normal-dx`, `_roughness`: the last word of the name) **and can be chosen by hand** when the names say wrong.
- **A PBR viewer in the Character Studio** (its top bar's **PBR** button: each set on a sphere, cube, room corner and
  close-up), so the sets don't have to be opened by hand to see them.
- **A colour mask over a set isn't wanted for now**: the tint (the garment's colour over the set) is enough.

## 2026-10-23, later (our own clothes: the tailor, after Woohill; GarmentCode removed)

- **The GarmentCode garment maker is taken out** (its drapes were bad, and it's bloat we don't need): gone are
  `tools/garment.py`, the Studio's `clothes.py`, `drape.py` and `make_designs.py`, the GarmentCode designs and
  outfits, Mari's patterns in the Pilot, the server's routes, the launcher lines and the setup step.
- **Clothes are our own generator, inspired by Woohill's character creator**, with far more polygons for our
  realistic bodies. The cloth doesn't need to be properly simulated: the aim is **a bit better than PSX-style
  clothing**. Success is a typical work uniform, a t-shirt, pants, shorts and a skirt.

## 2026-10-23 (the Gaussian splat is removed)

- **The hair splat is taken out of the repo**, not kept as a reference layer: the salon doesn't use it. Gone: the
  splat and clay pages (`gshair.html`, `hairbuilder.html` and their scripts and tests), the splat, the clay, the wig
  shell and the hair builder's presets in `tools/character/gshair/`, the server's routes for them, their launcher
  lines and docs/GSHAIR.md. **Kept, because the salon's reference needs it:** the video to frames, the key, the
  cameras and the reference in the head's space (`tools/gshair.py`, the name is historical), and its check.

## 2026-10-22, evening (characters stay editable at every stage; one app with a top bar)

- **A character stays editable at every stage, baked or not.** While a character lives in the Character Studio (and
  after it goes to Unreal), every stage keeps what it was made from and the settings that made it: the pictures, the
  body's weights, the face's settings, the skin's layers, the hair's source and its fit, each garment's design and how
  it was draped. A bake (a texture, a draped garment, batched strands, an export) is only ever made from those, never
  over them, and says what it was made from, so it can be made again after an edit and a stale one shows.
  docs/CHARACTER_STUDIO.md §2 and §3.
- **The Character Studio becomes one app**: no typing page addresses. A bar across the top swaps between the steps
  and the editing stages (body, face, skin, paint, hair, clothes, motion, look, export), and the pages that live on the
  desk today (face mesh, body shape, flesh, poses, pigment) move in as stages. docs/CHARACTER_STUDIO.md §4.
- **Hair:** the salon is the route (below: hair drawn by hand on the character, baked onto it). The Gaussian splat
  with its clay clumps was tried on the salon's branch and set aside (docs/GSHAIR.md, docs/research/hair_splats.md);
  in the one app the salon is the Hair stage.

## 2026-10-22, final (hair goes onto characters; only finished characters go to Unreal)

- **Hair is added to the characters built in the Character Studio**, not made for Unreal on its own: the salon draws on
  a character's own body and face, keeps the hair with it and bakes it onto it; the Character Studio wears it.
- **The order:** the character in the Character Studio, its hair in the salon, then the character used in the director's
  desk; **only the final characters, rigged and with their animations, are exported to Unreal.**

## 2026-10-22, last (the salon's cover)

- **Gaps are covered by a Y parting, not a plane:** along the head's middle, each root a Y (one root, strands going
  left and right) lying over all the other hair, as long as the hair rooted highest (the user's characters have no
  spiky anime hair, so that's enough), and it falls with gravity. A placed plane was tried and dropped. No combing yet.

## 2026-10-22, latest (the salon's scalp, layers and gravity)

- **The fill is dropped** (the trace, the orange glow, the mass of hair): under the hair shader it doesn't look good.
  In its place **the scalp is darkened**: a flat colour under the hair (no shine, no shader), with a thickness (its
  opacity) from sparse to full, so the hair looks fuller and deeper.
- Hair **lies on the scalp** (it floated above it), and the scalp takes roots on the **sideburns**.
- **Layer by height** is a toggle: hair that grows higher always lies over the hair below it, like real hair.
- **A gravity switch** drops all the hair: it falls naturally, the user picks the moment, switches it off and refines
  by hand what should stick up.
- **The handle pull is Blender's proportional editing**: the wheel grows and shrinks the area a pull moves, the
  effect fading with distance.

## 2026-10-22, later still (the salon, not the splat)

- **The Gaussian splat route was worth testing and isn't good enough** (docs/GSHAIR.md: the splat, the clay, the hand
  builder). It stays in the repo as a reference layer only. **Hair is drawn by hand in a virtual salon** on the head
  or the clothed body: vector locks (a strand, a sheet from a root line with the ends' spread on the wheel, a bundle),
  shaped by their handles and a few sliders, in groups to hide and show; stylised by default, realism as an option;
  physics only on the locks the user marks; never clipping the body or clothes; fake volume from a scalp cap with a
  thickness; brows and lashes as variations; easier than Blender. The plan: docs/SALON_PLAN.md (Blender's hair read
  first, as research, never copied). The animation refiner comes later (per clip physics, keyed poses).
- The footage is about 0.4 MP and soft; stylised realism (Arcane-like) is the look; the humans no longer go to Unreal.
- **Physics is game-grade:** a few locks jiggle with the head, wind is a rustle with no direction, nothing clips; no
  more than that. **The salon must be layman-easy and fun, like a character creator:** never a blank head (a wall of
  cuts first), the reference in the room, tracing the outline over it as the main act, galleries with pictures for
  the fringe, sidelocks, tails, length, colour; handles and word sliders, no numbers; East Asian styles first.
- **The video stays the reference, as a locked overlay:** a camera per frame in the head's space; turning the view
  snaps to the nearest frame, laid half-transparent over the head, so the reference is right from every angle; a
  video that only reaches the side is mirrored onto the other side. The reference's scale, position and the orbit's
  lock to the view (front frame, direction, sweep, height) are always adjustable by hand; a green screen is optional,
  the overlay is transparent anyway. **Mirror is a toggle with a seam:** the middle
  by default, or the user's own (moved sideways, or drawn on the scalp); hair placed on one side is twinned on the
  other until the link is broken.

## 2026-10-21 (buttons, not dragging; the struggle is mashed; hiding works)

- **Interactables are buttons** (E, or a click): no Amnesia-style dragging of doors and drawers, no sliders. A hiding
  place's see-through is a number (`see_through` on the locker, `game.see_through` for the game).
- **The grab's struggle is mashed:** E, Space or the left button as fast as you can, not dragging the mouse away.
  `pull` stays as the way she's thrown off and the camera leans.
- **Hiding must work in Play** (the Pilot's locker didn't): E gets in, you watch the room through the slats, E gets
  out.
- The Play UI doesn't look its best yet: touch-ups come much later, with the other polish.

## 2026-10-22, later (Perm, not DiffLocks; lock points; the look we want)

- **DiffLocks is dropped:** its checkpoints need an account, and the user won't register. Removed from the repo
  (delete `vendor/difflocks/` if it was set up). **Perm** replaces it (Yale and Adobe, ICLR 2025: MIT code, checkpoints
  and 343 fitted artist hairstyles on the authors' public links, no account): a hairstyle library to browse and blend,
  matched to a photo by its hair's outline. Non-commercial on its data's side, which fits the free games. Run sealed off
  the network like DiffLocks was.
- **The look:** hybrid realism, a bit low-poly but aesthetic, beyond PSX, the way MHR looks; characters that light well
  in medium shots from the player's eye. Hair: East Asian hairstyles first. Skin: glass and youthful skin as well as
  old, oily skin, makeup presets. A touch-up painting tool over the projected face. Clothes: lock points on the body
  (no more pants at the ankles) and presets: shirt and trousers, school uniforms.

## 2026-10-22 (hair from a photo with DiffLocks; batched like an anime game; DiffLocks since dropped, above)

- **The games are free, never sold** (itch.io at most, no payments, tips or donations): an experiment. On that basis
  **DiffLocks** (a picture to about 100k strands; Meshcapade and MPI, non-commercial licence: "non-commercial artistic
  projects" allowed) is used for hair from a photo. Its code, checkpoints and output stay local (`vendor/difflocks/`,
  `Content/Studio/People/`, both git-ignored); the user registers for the checkpoints themselves. Hair it made is marked
  in the character's files, so it can be found and replaced if a game ever earns anything. No sexual content with it.
- **It runs with no network at all** (a sealed network namespace), so nothing it or MediaPipe does can leave the
  machine; `tools/difflocks.py audit` lists every place in its code that could reach out.
- **Hair is batched like an anime game's:** the strands grouped into clumps, each clump one guide with a short bone
  chain, and only the chains get physics; every strand follows its clump. docs/research/hair.md.

## 2026-10-21 (our own characters: MHR first, one app for everything character)

- **Characters are built on MHR, not MetaHuman** (docs/MHR_PIPELINE_RESEARCH.md): MetaHuman Creator proved restricting
  and slow. This replaces the 2026-10-20 routes that made every final character a MetaHuman (Kimodo onto the
  MetaHumans, clothing through MetaHuman's Outfit Asset): Kimodo's motions go onto our MHR characters, garments onto
  MHR bodies. MetaHuman stays only as an optional branch for a hero face if the close-up A/B (T7) says so.
- **One app for everything character** (`tools/character/`, the Character Studio): body, face from photos, the
  expressions, hair and clothing as they come, Kimodo's motions played on the character, and the export to Unreal.
  It grows out of the body editor. Avoid ComfyUI and other outside apps where we can.
- The work goes on its own branch, `claude/character-studio`, off the face branch.

## 2026-10-21 (scenes blend; triggered scenes)

- **Scenes blend in and out by default** (the view eases from the player's eye, no black). A hard cut or a fade is
  still allowed when a scene needs one (`enter`/`exit` kind).
- **A new kind of scene, triggered by what the player does** (walking into a place, sitting down, using a thing):
  the `scene` action in a stitch's beat. It blends in from where the player is, and play goes on after it.

## 2026-10-21 (what to borrow, gaze, parts that extend)

- **Borrow Chilla's Art's mechanics** (short first-person Japanese horror: everyday chores as the tasks, the same place
  coming back changed). **Not Dark Pictures** (it doesn't fit). Firewatch's talk-while-walking is already the plan.
- **A Florence-like tracker:** small interactions feed a tracker that can change interactive scenes or gameplay scenes,
  or send the flow down another branch.
- **Amnesia's physical interaction, yes:** drag doors and drawers and handle things with the cursor; the neumorphic UI
  blends with it, with small animations (a press, a shake).
- **Romance gaze, yes:** in interactive cinematics and gameplay, cast members turn their head to look at the player by
  a ratio (how much of the turn the head takes), an IK-style look.
- Later, not now: Emily Is Away's chat (a future romance horror), Edith Finch's per-vignette play.
- **Every part is extendable by settings, not copies:** one function with more variables or options, never a second
  function that does nearly the same thing.

## 2026-10-21 (Play mode: the look last, physics things, a cursor, CSS UI)

- **Unreal doesn't have to match the desk's look.** Post-processing and the look come last, per game (a game may go
  more romance than horror). The desk -> Unreal match is about layout, timing and blocking, not colour.
- **The Pilot is only the transfer test.** No more work on its story, notes or picks.
- **Things you can interact with have physics**, tested first with a large die: a roll can unlock an easter-egg scene
  or a side path that branches off and **rejoins the main line later**. The goal is a narrative with no hard cuts
  that flows naturally, where the player's choices fill in the gaps.
- **The in-game UI is made on the desk first** and may move to Unreal if we like it: no hands yet, so a **cursor that
  changes with what you're looking at**, styled **neumorphic** (buttons that pop out, as if the world were a touch
  screen you click). The styling stays **CSS**, themed per game, so a game can switch themes. Mini-games can grow
  out of the same style.
- Later, not now: the Unreal preview locks the camera; Play mode frees it.
- **GAMEPLAY_PLAN §9 answered:** the cursor sits at the centre and changes with what's under it, and using a thing
  (the die, a drawer, a note) frees the pointer to click and drag in that close-up (Esc or walking away hands back);
  crouch is toggle by default, hold in settings; being seen fills a short suspicion meter (about 1 to 1.5 s, drains out
  of sight) before `caught`; in an interactive cinematic, if the player walks away she pauses, calls them back and picks
  up where she stopped; a patrol checks a hiding place only where a route point says so; see-through is per hiding
  place with a game default; the first UI theme is the light neumorphic kit as in the user's image.

## 2026-10-21 (gameplay: Resident Evil 7 feel, desk first)

- **Rough gameplay is made in the director's desk first** (a Play mode you walk through), then Unreal. The plan:
  docs/GAMEPLAY_PLAN.md; the next session starts there.
- **Never a hard cut:** gameplay, interactive cinematics (walk around while they talk), soft and full cinematics
  blend into each other; cinematics can still hold timed moments (choose A or B).
- **NPCs run simple behaviours, not AI:** idle, sit, walk a route, patrol by cycling set routes the story can change;
  talking to them gives a few lines (first time, again, a reminder of the task) or starts a scene or a choice.
  Routes can run in gameplay and in interactive cinematics. Mini-games later.
- **The first game needs crouch and hide:** hiding places whose door goes see-through by an amount set with a
  slider, safe zones where the player can't be spotted, patrols on predetermined routes.
- **Easy to extend:** every gameplay part is a small registered module (conditions, actions, behaviours,
  interactables, player abilities), so torches, the player's hands and more come later as new parts. The same
  system must serve a romance game.

## 2026-10-21 (Generate: the desk to Unreal with no Claude in between)

- **When the user is done on the desk they press Generate, and Unreal has a previewable game with no Claude in
  between.** Claude helps later, inside Unreal. The first goal: the newest Pilot, every block, piece of furniture
  and light, 1:1 in Unreal, and its scenes previewable.
- **No voices yet** (the dialogue voice tooling comes later): the MVP plays the scenes with subtitles only.
- **Gameplay is UI selectables for now,** as in the desk's Watch (task cards, results and choices as buttons); the
  real gameplay is refined later.
- `scene-builder` is merged into `main` (it changes the desk -> Unreal flow).

## 2026-10-21 (animation first, the dialogue fits the motion, and Claude asks)

- **The default order is the draft script, then the Kimodo motions, then the Japanese and English dialogue.** The user
  is not a native Japanese speaker, so they choreograph to the English draft and the lines are written afterwards to
  fit each motion's mood and length. The face and voice takes (MiniMax, then the face mocap) come last. Dialogue-first
  is still allowed for a scene where the line is the point.
- **Lines are written in increments of 7 seconds or less** (MiniMax gives up to 8 s of audio; 7 leaves padding), the
  way game voice actors deliver them: a beat at a time, never a whole speech in one go. Set `game.clip_max` to 7.
- **A motion that runs short is not stretched: the line is rewritten** (an action scene is short anyway). A motion
  that runs long gets a waiting loop (standing, waiting for a reply) that the user adds, which `fit: loop` / `hold`
  already carry.
- **No hard rules about order.** The pipeline is a menu of steps. At the start of a session Claude reads the notes and
  the story state, asks what the user is doing now, and does only that step. It does not move on by itself.

## 2026-10-21 (UnrealClaude's scripts)

- **Claude sees UnrealClaude's Python tools, and scripts in this project run without asking** (`--show-scripts
  --auto-approve`: `execute_script`, `cleanup_scripts`, `get_script_history` listed; `bAutoApproveScripts=True` in
  `Config/DefaultEditor.ini`; the editor logs each script). `run_console_command` stays hidden.

## 2026-10-21 (the studio runs on Linux)

- **Everything runs on the user's Omarchy machine** (Arch Linux, Hyprland, RTX 3090): Unreal 5.8.3's Linux prebuilt
  (stable at level 0, `../unreal-omarchy/docs/RESEARCH.md`), Kimodo, the desk. No Windows: setup.py, SETUP.md and the
  commands for the user are for Linux (bash, uv, Epic's bundled clang instead of Visual Studio). The `.uproject` goes
  in this repo's folder.
- **The project is `HorrorEngine`** (the user made it so), First Person C++, adopted into this folder. **Epic's
  template stays as the playable test level**, untouched and the start map, until the user says otherwise; it is never
  committed (the repo is public). First goals: Claude set up in the project (UnrealClaude), then the Pilot from the
  desk to Unreal as a 1:1 copy.

## 2026-10-21 (hair: Sisir for our own cuts, Fab for the rest)

- **Sisir is the tool to try for custom hairstyles** (free standalone, Windows: draw guides on the archetype groom
  head, a procedural stack grows the groom, Alembic out, bind in Unreal as a wardrobe item). Styles that exist on
  Fab are bought, not made (docs/METAHUMAN_LOOKS.md §3.3 and §3.5). The first Sisir-to-Unreal run goes in LESSONS.md.

## 2026-10-21 (music: the score room)

- **Woohill's music engine comes over as the score room** (`tools/score/`, docs/MUSIC.md), an HTML app now that can
  be plugged into the director later (no Godot tool). Its job: more horror-style piano and string orchestrations, and
  K-drama fun cues that score what the character is doing (typical K-drama TV: the sneak, the fall, the blush, the
  slow-motion look). It makes variations and the user chooses the favourites, which go into a palette per game (and a
  studio one). Built on research into K-drama and horror scoring and the shows and films whose music fits our
  instruments (docs/MUSIC_RESEARCH.md). Each game gets its own mini soundtrack, part procedural and reacting to what
  the player does, when it plugs into the desk and Unreal (docs/MUSIC.md §5).

## 2026-10-21 (horror romance, deaths back, the branch map, replies, simple gameplay)

These change the 2026-10-20 entries below where they disagree.
- **The player can die again** (no dying took the gameplay out). Instead of game over, **a death opens the branch
  map**: the player picks which branch to return to, and sees which branches they've missed. It works like
  *Five Hearts Under One Roof*'s scene and branch viewer (jump, skip, replay), **without its stat gates**. The
  desk works the same way.
- **The genre is horror romance:** obsession and yandere, as in Japanese anime and games (others may be prompted).
  First person is shaped by it: the intimate moments are written and staged for the player's eye.
- **Replies:** dialogue choices that mostly change the line she says back (left or right, the English with the
  Japanese over it, as the desk shows them). Each one can be just immersion (she answers, then the scene goes on with
  the line it was always going to say) or set something that opens a branch later.
- **Hanging lines:** she asks and waits, with her face, for the answer; not forever: past a few seconds her answer to
  your reply is skipped and the scene carries on with the next line it would have said anyway. The writing has to
  feel like a conversation even when the player's replies are the quiet guy's short ones: it has to feel like you.
- **Simple gameplay, for the Roblox generation:** hide or run, tick boxes, nothing that needs a hard decision or a
  hard puzzle. Hide and seek where being found is cute the first times and then not (found three times and it's
  over), chases, collect-while-she-patrols, sneak while she isn't looking. On the desk it's a card before the next
  scene ("did you manage to hide?"); in Unreal the built-in tools and Claude flesh it out.
- **Unreal later:** reverb that sounds like real houses and rooms, for immersion.
- **Later, not now:** lift the music tool from the woohill repo (live procedural orchestration) and make it part
  procedural per game: each game gets its chords, flourishes and a mini soundtrack that reacts to what the player does.

## 2026-10-20 (pipeline v2: the user's answers)

- **Endings are good, neutral and bad**; "evil" is the bad one. **Easter eggs** aren't karma: they come from what the
  player found and blend back into the main story.
- **The MiniMax prompt** is `she makes a <expression> while she <voice> <d>[Japanese] <line> </d>` (`[Japanese]`
  written literally). Claude supplies the expression and the voice; the user handles the rest of MiniMax's format.
- **Voices:** try more than says, whispers, says angrily and screams; keep a list of what's been tested and works
  (docs/VOICES.md).
- **The blocking loader into Kimodo's demo and the Loop tool are the user's** (built locally): nothing to build here.
- "Work on it until you can't do anything else without me": the branch builds everything that can be built and
  checked without the editor, the RTX 3090 or the user's takes.

## 2026-10-20 (pipeline v2: how a game is made from now on)

- **The workflow** (docs/PIPELINE.md v2, built on branch `pipeline-v2` by docs/PIPELINE_V2_PLAN.md):
  1. The user's outline and rough cast in the desk.
  2. A local model drafts the English script; Claude reviews and glues.
  3. The user refines.
  4. Claude's Japanese pass (as a professional film would say it), with English and Chinese subtitles translated
     from the Japanese, and a MiniMax image-to-video prompt per take.
  5. The takes on the desk's timeline, with an auto-clean that fits the director's parts to them.
  6. The motions made by the user in Kimodo's demo from Claude's shot list, imported back by name.
  7. Unreal: the blocked game playable, the MetaHumans, the face mocap, the gameplay with a crosshair.
  8. Art, QA, ship. The engine and its mechanics are versioned so each game is quicker than the last.
- **The kind of game:** a dark anthology in first person (Resident Evil 7 meets Japanese monster and psychological
  horror), carried by mood. The ending comes from **karma**: how the player responded and reacted, in timed choices
  (30 s), not what they found. **No dying**: a missed task guides the player gently on; only the final ending may
  kill the hero. Branching and simple acting scenes after *Five Hearts Under One Roof*.
- **Takes are 7 to 8 seconds** (MiniMax's audio holds for 7 to 9): the Japanese is written in beats that stitch (a
  line, a pause or an expression, a short question). `clip_max` 8.
- **Motions:** 80% simple life-to-life, 15% activity, 5% action and horror, a few detailed ones and the final
  ending's; the detail comes from the face mocap. Each Kimodo motion is one behaviour of at least 2 seconds
  (docs/KIMODO.md). The head's look is a layer on top (trackers, clamped), not Kimodo's job.
- **The first game is a 15 to 20 minute itch.io game**, to test every stage once.
- **Extras:** a procedural idle so characters stay alive outside the interactive parts; a script generator on a
  local model (Qwen3.6-27B on the RTX 3090) with Claude for the reviews and the glue.
- The work runs on its own branch beside SETUP (which continues on the user's machine).

## 2026-10-20 (Kimodo's motions onto the MetaHumans)

- **The body motions made with Kimodo in the desk go onto the user's rigged MetaHumans in Unreal** (no talking: the
  faces come from the takes). Unreal's IK Retargeter does it: Kimodo's SOMA skeleton and its skinned body as FBX,
  one IK Rig and one retargeter to MetaHuman made once, then every motion batch-retargeted onto each MetaHuman's
  body by a generated script (`tools/retarget.py`, docs/ANIMATION.md §1b). The FBX side is tested exact; the editor
  side is the first run's job (SETUP S12).

## 2026-10-20 (clothing: generated, live physics)

- **Clothing is made on the go and its physics stays live:** garments as GarmentCode programs sized by the cast
  member's measures, into Unreal's Outfit Asset (Chaos Cloth, parametric resizing) through a template Dataflow
  graph; simulated at runtime, so a body change is a re-evaluation, not a rebake; ML Cloth is the optional bake,
  scripted (docs/METAHUMAN_ROUTE.md §6). `tools/garment.py` makes the pattern and the placed panels (tested on
  Mari's t-shirt); the Unreal import is the first run's job.

## 2026-10-20 (the MetaHuman route: design here, make it there)

- **We don't compete with MetaHuman; the desk edits MetaHumans.** A body is designed in the desk (the Shape page,
  the Lines tool, a skin tone) and sent to MetaHuman Creator as *numbers* through its 5.8 Python API (parametric
  body constraints, skin settings, auto-rig, assembly), not as a mesh; only a shape the parametric model can't make
  goes as a conform from the desk's OBJ. The rigged body comes back as the desk's previs body (no face rig in the
  desk). Jiggle is Kawaii Physics on the MetaHuman body, set up from the Fat suit page's export; the sculpt tools are
  not ported into Unreal (docs/METAHUMAN_ROUTE.md). `tools/metahuman.py` writes the editor script; untested until the
  user runs it (SETUP S12).

## 2026-10-20 (sculpting lines)

- **Sculpt the fat suit by its silhouette:** vertical lines over every soft part with points to pull in or out,
  proportional editing with a scroll-set radius, cut to add points, grouped by part; only the fat suit moves, never
  inside the lean body (docs/FLESH.md §5, the Lines tool).

## 2026-10-20 (breast shape: shelved)

- **The teardrop shape is shelved:** the desk's mesh has too few points across a breast for a real crease and
  underside (three ways tried, docs/FLESH.md §5). The round volumes stay; the shape comes from MetaHuman and the
  jiggle from Kawaii Physics, set up as a ball in fat: a stiff core bone and a loose fat bone.

## 2026-10-20 (the refiner, jiggle by area, more vertices)

- **Edit the fat suit by hand:** a transparent brush (like the creator's paint tool) paints volume (stronger or
  weaker) and jiggle; per-area jiggle amounts (bust, butt, thighs, belly, arms) take any value, absurd ones too, for
  testing.
- **More vertices for round volumes:** MHR's LOD 1 and LOD 0 (73,639 vertices) are selectable on the page. LOD 0
  makes the volumes round like water balloons; LOD 2 stays the default for speed in the browser.

## 2026-10-20 (jiggle slider, the hourglass, faces)

- **A jiggliness slider**, the soft-bone presets as its medium.
- **A slightly chubby hourglass** to see a run cycle: MHR's sliders plus sculpted volumes and a cinched waist
  (docs/FLESH.md §5); exportable as an OBJ for MetaHuman's body conform.
- **Faces come from MetaHuman, bodies from the desk:** a MetaHuman character is a head and a body conformed
  separately, so the head is made in MetaHuman Creator (or from a sculpted head through Mesh to MetaHuman) and the
  body comes from the desk's export (docs/ANIMATION.md §3).

## 2026-10-20 (soft bones: look right, touch things)

- **Jiggle should look right, not simulate tissue:** breasts move like a water balloon, as one object; per-point
  springs contorted. Soft regions are now short spring chains the mesh is skinned to, after EZSoftBone (Unity, MIT;
  Unreal's Kawaii Physics works the same way), and they collide with the world (floor, walls, boxes, balls) and the
  arms (docs/FLESH.md §5).
- **Spread:** a touch or a swing bends the whole mound and the skin around it; the body under and around the fat
  takes a share that grows with the fat's depth, most for breasts and buttocks.

## 2026-10-20 (water balloons on a flat base)

- **Breasts and buttocks as volumes:** a flat base body (Mari, chest and backside solved flat) with the breasts and
  buttocks added as water-balloon volumes in litres, to study how they move (docs/FLESH.md §4). For realism, on a
  featureless mannequin with technical cameras; nothing sexualised.

## 2026-10-20 (the fat suit experiment)

- **Jiggle and sag from body fat:** a character is a lean body wearing a fat suit (the same MHR mesh solved lean);
  the gap is the fat's thickness, and mass, stiffness, ringing, sag and support all follow from it (docs/FLESH.md,
  the desk's Fat suit page). An experiment first; the desk and Unreal later.

## 2026-10-20 (no clipping, IK, squash; procedural animation later)

- **Bodies mustn't clip through themselves:** a hybrid layer over the animation (FK from the motion, IK for reaches
  and collisions), with collision shapes from each character's own body, so a heavier character's arms rest wider.
  Plus contact squash. The hips leaning back was a retarget bug (fixed: the trunk turns from its rest, not by aiming).
- **Later, on local Claude:** procedural animation from batches of generated variations (docs/PROCEDURAL.md): what
  stays the same becomes the core, what varies becomes controls, contacts are IK.

## 2026-10-20 (Kimodo from source, the whole MHR skeleton, late)

- **Kimodo is built from its repo with uv, not Docker:** Docker images go to the system drive; uv keeps Python, the
  packages and the models in one folder (`setup.py kimodo [--home DIR]`, default `vendor/kimodo`), with NVIDIA's
  pinned versions.
- **Drive the whole MHR skeleton:** fingers, toes, neck chain and twist bones, from Kimodo's 77-joint SOMA output;
  no face (that's MetaHuman Animator's job). The blocking goes to Kimodo as full-body keyframes so generated motion
  keeps the approved staging.

## 2026-10-20 (first-person framing, MHR bodies, night)

- **The player is the camera (Resident Evil style):** shot types are only what the player's own eye can see from
  where they can stand. A shot size is how close the actor comes (Hall's zones: CU is a face inside 0.55 m), never a
  lens: one field of view for the game, `push` is leaning in (0.35 m at most), `zoom` at most 15 % for a held focus,
  the eye at the stance's height (`stance`), looks within the neck (75°), view spots only where a player can stand.
  The desk, `story_check` and the shot review enforce it; the pilot was restaged (Mari steps up to whisper).
- **MHR instead of the basic figure:** Meta's Momentum Human Rig (Apache-2.0, so it ships) is the desk's default
  body, with a **body shape editor** (the Shape page: 45 identity sliders, fit to widths) so characters are designed
  in the desk; their `shape` plays in the storyboard and exports (OBJ, closed, at height) as the base for a
  MetaHuman's mesh conform, where the fine detail is done.

## 2026-10-20 (bodies and the CC0 library, evening)

- **A more real body in the desk:** the storyboard plays the blocking on a real rigged human when one is in
  `Content/Studio/Bodies/` (Manny or Quinn exported from the project, a Mixamo character, each cast member's MetaHuman
  body), found by bone names, A-pose or T-pose, scaled to the cast member. Those files are licensed for our use, not
  for sharing: they stay local and never go in a zip. The capsule figure stays as the fallback.
- **The awesome-cc0 list is part of the studio** (`docs/assets/awesome-cc0.md`), for Claude to texture and replace
  textures later: a shared CC0 library (`Content/Studio/Library/`), story fields to use it (`shape: asset`, `art`,
  `mat`, a room's `look`), `tools/cc0.py` to find, fetch and record, the desk and the importer to show it
  (docs/ASSETS.md). The Base Mesh's 900 props are indexed by name and size; ambientCG is fetched by the tool; Poly
  Haven by hand (its API's terms want a licence for commercial use, though the assets are CC0).

## 2026-10-20 (the director, later that day)

- **The director's desk is where the game is made first:** start a new game there, plot it, block every body and
  shot, and watch it as the finished storyboard. Fix it there before Unreal. Claude in Unreal builds to the desk's
  storyboard and blocking.
- **Cutscenes can't be skipped** (that's how the 2-hour minimum holds); timed events can be done faster, so the
  player feels they have a choice (The Dark Pictures, Resident Evil Village). The checks count both.
- **Trigger cutscenes:** taking something you shouldn't can end the game (Alien Isolation).
- **Bodies play in sequence in the desk with blends between them,** judged only by what the player can see (feet
  behind a table don't matter). There's a fixer for mismatches: extend, hold, loop, pad, or an in-between.
- **Easing modifiers for jumpscares** and other moves text-to-motion handles badly (snap, hold, twitch, ease).

## 2026-10-20 (the studio)

- **One project for every game** (no new project per game: shaders and setup take too long). Each game is a
  folder; packaging takes only one game's maps and the assets they use (docs/STUDIO.md).
- **Claude's editor assistant is UnrealClaude** (github.com/Natfii/UnrealClaude), with the UE 5.8 compile fix from
  its pull request 48 merged in.
- **Spine first:** block the story scenes with the MetaHuman actors first; once they flow, stitch the player's
  tasks between them (docs/PIPELINE.md).
- **Branching is allowed:** good, bad and secret endings, easter eggs, occasional branching scenes that rejoin the
  main story; several prototype versions (variants) of one moment to choose between.
- **Timing must be elastic:** a longer take mustn't break the prototyped flow.
- **A director's desk** (an HTML app, the user and Claude both use it) to plot everything first and pass ideas back
  and forth with notes; the game is then built to match it.
- **The order of polish:** the user replaces stand-ins with MetaHumans, then faces (mocap from the takes), then
  bodies.
- **Takes are limited to 10 s per clip:** seams get hidden with soft camera locks (a look cone with margins, forced
  look-aways), blinks and other horror-friendly tricks (docs/TRICKS.md).
- **A hybrid IK grab:** an actor grabs and pulls; the player can pull back with the mouse; she stumbles naturally
  (partial physics, not a full ragdoll).
- **Body animation from prompts:** NVIDIA's Kimodo (the user remembered "an NVIDIA tool"); Claude prompts and
  checks, the user does the face mocap and final touches (docs/ANIMATION.md).

## 2026-10-19 (the kit)

- **Engine:** Unreal Engine, the latest (5.8 or later: the official MCP plugin needs 5.8). The user installs it;
  the kit sets up the rest.
- **The games:** short first-person horror, 2 hours minimum (aim for 2.5 to 3, past Steam's refund window).
  Game one is linear and Amnesia-like (pick things up, learn, unfold a story), not choice-driven like the Dark
  Pictures anthology. Choices may come later.
- **The split:** the user writes rough stories, makes the MetaHumans, records the dialogue with MiniMax in
  **Japanese** (it sounds better; English subtitles) and generates close-up face videos. Claude refines the
  story, writes the script, blocks out and builds the game, makes the animations (text-to-motion API) and does
  the refinement.
- **Faces:** generated close-up video → facial mocap (MetaHuman Animator from mono video), instead of a webcam.
  Compare it with audio-driven animation in the pilot (SETUP S11).
- **Blockout:** blocks, spheres and T-pose stand-ins, replaced by art later. Cheap horror tricks hide the joins:
  forced looks at faces, look-aways while things change, sound, creaks.
- **Aim:** a game every 1 to 2 months, once the pipeline is built.
- **Review:** Claude reviews the game's frames from the player's eye, by measurable rules (clipping, framing,
  light on the subject, stand-ins in view) and film-directing sense, using the shot review in the dictionary.
- **Business:** Steam (30 % cut, $100 a game). Unreal's 5 % royalty applies only past $1M gross per product.
  Speak to an accountant about a limited company and VAT (UK).

# Decisions

The user's answers, newest first. They override the plan, the research and the docs.

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

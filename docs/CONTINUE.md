# Continue: the next session

Written 2026-10-24 (small hours, the user away; brought up to date in the afternoon and the evening, twice on
2026-10-25, on 2026-10-26 (`easier-hair-editing`, the salon's editing; `eyelash-more`, the second reference's five
lash sets), on 2026-10-27 on `clothing-expanded`, and last on `dev-002`: the four merged, the export's colours, the
dashboard and the writers' room; 2026-10-28 the flashlight, cleaning, the peephole, the power cut, footsteps, the
latch, examining, skin v2; then TestRoom001, the Unreal note, the skin after HumanShaders and expression loops; and
on `game-research-001`: The Visitor's research, abstract and chart, the director's to-do; merged into `dev-002` and
the to-do built there, with the Studio's eyes from the side, a small nose and the face's bake; 2026-10-28 and 29 on
`godot-support`: the Godot export, its runtime, its look, the look plugin; 2026-10-30 and 31 on `buildings-streets`: the
street builder, its paint and the PBR sets, with `prop-gen-tool` merged in; 2026-11-01 the school on
`claude/laughing-goldberg-6l5of3`, merged, then the prop generator's picture editor on `enhance-prop-editor`; 2026-10-30
to 2026-11-03 on `Director-Godot`: the Director in Godot, its panel, Story Flow and the animation steps, merged into
main on 2026-11-03 with main's own work since 2026-10-31 brought in; then the skin's depth softened and the skin under
clothes hidden on `claude/festive-euler-o7axpl`, the walls meeting, the editors' rules, Export for Godot and the
by-hand guides, merged; then on the same branch from main the map-building skill and the user's floor plan as a map, its
bedding, curtains, tables and chairs, the props' kept pictures, real wood in the flat and its curtains; 2026-11-05 on
`sakura-rabbit-research`: the Sakura Rabbit research note, then the three notes on dread, the CRT, and the props and
systems that open, hold, move and are read; 2026-11-05, night, on `gameplay-enhancements`: the kit's stairs, the scene
builder's floors, the street's steel stair, climbing in Godot and on the desk; 2026-11-08 on
`claude/friendly-newton-9o2xey`, from the user's `retro-enhance`: the retro pack in the prop generator; 2026-11-09 and
10 the weapons and the laptop, merged; 2026-11-10 on `update-tutorialv2`: tutorial v2 using every system, merged;
2026-11-10, night, and 11 on `claude/nifty-tesla-dc904q`: children, Cutify, monster mode, horns and animal ears in the
Character Studio, then the creature presets and a Studio character's face in Godot, then the Anime switch and the red
knit dress; then on `claude/beautiful-cray-a622xx`: tutorial v2's floor ready-made; 2026-11-11 on
`claude/compassionate-babbage-3bnfqx`: the clothing research (Cloth2Tex, ready-made garments, the fit test, the
clothing library), merged; then on `claude/ecstatic-dijkstra-6ixk71`: the hair editor v2.0, planned, then built (2026-11-12).
Read this after CLAUDE.md's start
list (DECISIONS, notes, SETUP), then **ask the user what they're doing now**; §4 is the menu,
not an order. Overwrite this file at the end of the next session.

## Where it stopped last (2026-11-12, the 1:1 and v2female, `claude/ecstatic-dijkstra-6ixk71`): one Daz hairstyle held to its picture; the v2female base

Read DECISIONS 2026-11-12, "the 1:1", first: the user wants **one** hairstyle (the fifth Daz picture: blunt fringe,
low twin tails behind the ears, long sidelocks) re-created 1:1, volume and curves, "to figure out the system for
aesthetic hair and apply that later to the rest of our styles", and offered a base head **v2female**, then asked
for it ("lets create a v2female base").

- **Built** (docs/HAIR_V2.md §3.7, §3.8, §10): tied hair that hangs to its tie (Drape, Gather, Puff, Fullness, Tie
  lower), a route for it round an ear that's out, tails as brushes (Fan, Flat, lean out, Strands), a fringe closed at
  its middle, a look that can ask more of its bake, the style `daz_twin_tails` in a group of its own, HAIR2's
  assertions for each, the test body `v2female` in node. The older 65 styles are the same hair by hair.
- **The rig** is scratch (her pictures stay out of git): §10 says how to rebuild it (the body, the camera, the scale
  2.16, the roll 8.5, eye-middle on eye-middle, the outline by height).
- **Matched:** the side from above the ear to 3 cm over the tie within 0.3 cm, the ears out, the tie's place, the
  tails' kind and length, the fringe's line, the sidelocks' length.
- **The look** went in after (the hair shader's `streak`: the first highlight lock by lock; `gloss_black` asks for
  it): black with bright streak bundles in the rig. Left of it: ours is striped evenly, hers has larger dark areas
  and a faint teal; the Studio's own shader has no `streak`.
- **A second side** (her first picture) has a fitted camera now: 28 degrees to her left, 7 below, 14.5 px a
  centimetre (the scratch `fitcam.mjs`: seven landmarks off `v2female`'s surface; `rig/compare2.py` maps her
  picture into our frame and measures the edge behind the ear). The back of the head's hair hangs and is swept
  round the head to the tie. Ours against hers there: 0.4 to 0.8 cm too narrow behind the ear's upper half, within
  0.2 to under the lobe, 0.4 to 2 cm too wide by the tie. *Fullness at the back* (`ties.back`) is built and **not
  used** (it costs more by the tie than it gains). **What to build:** ours carries its width too low; the hanging
  hair should come in sooner from a fuller top (a bulb, not a pear), judged in both frames at once.
- **The tails** leave their ties almost plumb now and the lean builds below: inside her outlines on both sides,
  0.8 to 0.9 cm wide of hers right under the tie (from 2).
- **Not matched, in order** (§10's list): the last 3 cm over the tie, the fringe's pieces, the sidelocks as ribbons and the plait, the red
  streaks, strands across the ear, her first picture's view (a fuller bulb behind the ear), the back.
- **The v2female base is built** (DECISIONS 2026-11-12, v2female; docs/CHARACTER_STUDIO.md §2f): a fourth base
  button and a switch in the Body tab, *what the feminine end becomes*: the feminine body, with sixteen plain sculpt
  values for the head and the neck (`MHR_presets.json` `sculpt.v2female`), every slider still moving from it; and
  the control it needed, **Neck width** (the whole neck about its own axis; the neck 10.3 cm to 7.4). GROW and
  GROWPAGE (`QUICK=1`) hold it. Off for new characters (nobody asked for the default to change). **Ask the user
  for a local STUDIO and GROWPAGE** (docs/RUN_LOCALLY.md): here only GROWPAGE's quick half was run.
- **Next: the rig on the new head.** Everything in HAIR_V2 §10 was measured on the test body before the base (the
  feminine base with a Cutify-like sculpt). Both cameras have to be fitted again (the scratch `rig2/fit.mjs`: ten
  landmarks of her front picture, seven of the other, against the body's own: MediaPipe's points through
  `MHR_landmarks.json`, the ear as `sculpt.js` finds it), then both outlines measured again, then the hair by the
  tie. A first fit of the front picture on the new head: 14 degrees to her right, 8 above, rolled 7, the points
  5.5 px off (4 mm): her eyes are still further apart than v2female's and her ear leans out more at its top.
- **Then:** the other six Daz hairstyles; the
  new settings carried to the older styles (their cards made again).

## Before that (2026-11-12, later, `claude/ecstatic-dijkstra-6ixk71`): two asks in progress, neither finished

Read DECISIONS 2026-11-12, "the very last", "after the very last" and "the sides", first. All three are the user's;
the second is the one they stressed ("be extremely critical ... an exact replica"), and the third is where they
pointed next: the fringe is going the right way, the **sides' curve and volume** come first now (part 3 below).

**1. The Advanced category (in the tree; faults left).** Six styles (`adv_*`, group `advanced`) after the user's one
reference (four pictures of one hairstyle at stages). New in the engine, each a setting with a slider: a second colour
(`dye`; HAIR_V2 §3.11), tied hair's Sweep and Swirl, a bun as a coil with loose strands, tendrils, wisps by the ears,
a heavier fringe and its Arch both ways (HAIR_V2 §3.7, §3.8).
- *Checked*: HAIR2 (65 styles, with lines for all of the above; `HAIR2_VERBOSE=1` shows what each measured),
  HAIR2PAGE (with a split dye in the tab), GDHAIR2 (the nine key styles' figures the same as before the change: no
  dyed style is among them), LOOKPLUGIN (after a new uniform in the look plugin's hair shader, `spec2_own`, 0 unless a
  bake's record asks: a dyed lock's broad highlight in its own colour; its hair stage passes). The brows' and lashes'
  shader includes the same file and no check draws it without a Studio export: drawn once by hand on a quad beside
  the head's hair shader and one broken on purpose (it compiled and drew; the broken one was reported).
- Before the push: CHECKS ok and GDPLAY ok, and HAIR2PAGE again on the tree as pushed. GDTESTROOM not run (it doesn't
  pass in a cloud container: no recorded bodies there).
- *Wrong, known* (HAIR_V2 §9): card-shaped flecks in the streaks of both bun styles close up (one cause found by
  measuring and fixed, the rest unexplained); the long waves' underside colour fans out at the nape; a platinum half
  chalky in Godot; scalp showing at a pulled-back hairline. The Studio's own shader has no own-colour highlight.

**2. The user's Daz3D hairstyles, exact (not built).** Five pictures, seven hairstyles, in `Saved/Hair2/daz/ref/`
(not in git, and `Saved/` doesn't survive a session: ask the user for them again). What's known:
- A baseline of the last picture beside it (`Saved/Hair2/daz/r0`, `r1_strandtest.jpg`): the shape roughly, far from a
  replica. Eight differences listed in DECISIONS and HAIR_V2 §9.
- **Tested: more cards don't help** (the editor at its limits, twice the triangles: hardly a change). **Tested
  after: how they're drawn does** (`--hair '{"hashed":false,"side_fade":0.0,"soft":0.0}'` at 1600 x 1200,
  `Saved/Hair2/daz/x1/fringe_drawn.jpg`): the fringe a dark mass with separate tips where it was a haze. By eye, one
  still, not at the reference's scale, nothing known in motion. Whether real thin strands are needed as well is not
  decided (I first wrote that they were: the first test didn't show it). If they are, `hair_fine.gdshader` (the
  brows' and lashes': blended at true coverage) is where to look first. A crisp setting belongs in a bake's own
  `settings`, not in the plugin's defaults: those are every character's.
- Also missing: a way to dye one chosen lock (a red streak in a fringe); a fringe dense above that parts into strands
  below; a tendril that hangs on past where it meets the body (it stops on the shoulder now).
- The tails were my setting, not the system: with `texture.wave` 0 they hang as the picture's do.
- The order meant: the same comparison at the reference's own scale and in black with its sheen, then decide on
  strands; the fringe in locks; the one-lock dye; the sidelocks; then each hairstyle against its picture,
  side by side, with what still differs written down each round.

**3. The sides (the user's direction; nothing built, this much found).** Her side hair (the fifth picture) comes
out gently from the top, is widest at eye level and curves in by about a centimetre and a half to a small tie under
the ear, a rounded lit surface, the ear's lower half showing. Found, with pictures from the front and three quarters
beside hers (`Saved/Hair2/daz/s1/`): *ears covered*, `ties.side` 1, `ties.height` 0, a tail 8 mm thick and
`ties.tight` 0 come close to it; a thick tail and a tie further back made the first baseline's flat-sided hood (a
tie stands a centimetre and the tail's thickness off the skin). The two things it can't do are the work: show the
ear (with *ears out* and a tie under the ear the tied hair is **broken in the engine as pushed**: the rule that
keeps hair off a tucked ear, extended to tied hair in this session, lifts points straight up onto the ear's
outline, and strands bound for a tie on its far side shuttle along the outline and never arrive: HAIR_V2 §9; high
ties aren't caught; not fixed; the fix meant is to push a point out of the outline the way it lies from the ear's
middle, and for her look to keep clear only the ear's lower half) and shape
the side's volume (on tied hair only Tightness thickens it, a centimetre at the most, evenly; the Volume sliders
and Sweep do nothing to it). Judge by pictures from both views; the outline's numbers were once met by a wrong
shape.

**4. A zigzag in the tendrils (found in the pushed Advanced styles; fixed).** Strands from far down the temple's
edge were gathered into a lock and jogged across to it. Now a strand joins the nearest lock's guide within reach,
or stays plain (HAIR_V2 §3.7; HAIR2 holds it; 61 of the 65 styles the same hair by hair, four with three or four
face-framing strands moved). Left: the messy bun's waved tendrils still turn sharply near their tips; the space buns
have no gathered tendrils (two strands a side under their wide fringe).

**In the tools, not yet used for a conclusion**: `hair2_check.py shots --drift DEG:N` (after a shot, N frames with
the camera turned DEG a frame, each kept: for seeing whether hair drawn crisply shimmers in motion). Frames were
made once for the baseline as it is and crisp; they were not analysed (the sides came first).

**5. The styles' cards were distorted (found, fixed, made again).** `hair2_check.py` drew every picture 960 x 720
whatever `--size` said (its scratch project's window isn't resizable), and `thumbs` squeezed that into a square: the
59 cards committed before were a quarter too narrow. Now a project per picture size and an error when a picture
isn't the size asked for (tried at 512 x 512, 960 x 720 and 1600 x 1200). All 65 cards in
`Content/Studio/Hair2/thumbs/` made again and looked at: none cropped. Two of the new ones (the messy bun, the high
ponytail) hide their bun and tail behind the head from the card's view.

**Tools, as found**: `thumbs --out` still writes the tracked thumbnails. Run LOOKPLUGIN in the background with a long
limit and no pipe: it takes over half an hour on a CPU (thirty minutes in, it was still on its first stage here and
had given no verdict; that stage's own hair pictures gave lit 1.143 times dull at the crown, over the 1.05 it asks:
my sum from its pictures, not its line).

## Where it stopped last (2026-11-12, `claude/ecstatic-dijkstra-6ixk71`): the hair editor v2.0, built

From main (PR #24 merged). The user's go (DECISIONS 2026-11-11, the go): "v2 should be in the character creator studio
tab, let it reach the chest ... Start working on everything and dont stop until it looks really good inside godot and
runs well"; and while it was built (DECISIONS 2026-11-12): long women's styles with the ears out.

- **docs/HAIR_V2.md** is what's built (docs/HAIR_V2_PLAN.md the plan it came from). In short: the Character Studio has
  a **Hair editor v2.0** tab beside the salon's Hair tab (untouched). Hair is **grown** from 4096 fixed, ranked pores
  on MHR's scalp (`Content/Studio/Hair2/pores.bin`) by an engine of plain arrays (`tools/character/hair2/`): a
  hairline from a dropdown, thinning, each hair traced (comb, lie, fall; the rules in the trace), cut, textured, tied;
  out as cards with the salon bake's finish, short hair as shells, the scalp painted from the pores. A character keeps
  `hair2: { on, style, set }`; the hair is made again on any body. 59 styles as cards; nine sections of sliders.
- **In Godot**: Export for Godot carries it (HSHair wears the locks by their record, `hair_shell.gdshader` the shells,
  HSJiggle the tails' chains; GODOT_LOOK §5p). *Preview in Godot* in the tab pictures the head and hair with Godot
  without exporting the character.
- **The ears out** (2026-11-12): `ears: "tucked"` (both or one ear) and `tuckFall` (over the shoulders in front, or
  behind them); five styles in their own group.
- **Japanese and Korean styles, and the chart's twelve drawn ones** (2026-11-12, later): a cut of two lengths
  (`cut.tiers`), ties of the top's hair only and to one side, a choppy fringe with a centre lock, a fringe's slant,
  ringlets, an ahoge; eight and twelve styles in two more groups (59 styles in all). The chart and the user's five
  pictures are on the user's side, not in git.
- **Long hair ends with just its tips on the shoulders** in every style (2026-11-12, last): the sliders still go to
  the chest.
- **Checks**: HAIR2 (in check_all), HAIR2PAGE (the Studio's server running; `EXPORT=1` for the export), GDHAIR2
  (`python tools/godot/hair2_check.py`; `sheets`, `shots`, `thumbs` for looking).
- **What it found on the way** (LESSONS 2026-11-12): HSHair's root fade bared the scalp on grown hair (a bake now
  carries its own settings); Volume has to act where the hair is; a rule for hair has to start at the root.
- **Not there** (HAIR_V2 §9): braids, beards, hair under hats (the user: later); clothes in the distance grid; a
  tail's chain colliding with the body in Godot.
- **What could come next**: the user's own look at the five picture styles beside their pictures (a look-alike is
  theirs to judge, part by part: LESSONS), in the Studio and with Preview in Godot; a local run of HAIR2PAGE and
  GDHAIR2 on their 3090 (docs/RUN_LOCALLY.md: the browser draws on the CPU here); braids.
- The salon, its files and every baked hair are untouched. GDTESTROOM still stops at station 6 in this container (no
  bake bodies here: below), GDPLAY ok.

## Before that (2026-11-11, `claude/compassionate-babbage-3bnfqx`, merged in PR #24): ready-made clothing fitted to our bodies, researched and tested, then worn in layers

Research and a prototype, from main (PR #21, then PR #22 merged in); nothing in the Studio changed. The user asked
five things (DECISIONS 2026-11-11, both sections): whether Cloth2Tex could be a second clothing system, a CloV2 tab;
what's newer and free; then "I dont actually care about generating procedural cloting ... id rather have better
already designed clothing with lots of options"; then more Korean and Japanese smart casual, uniforms, dresses,
suits; then, seeing the fitted outfits clip, **clothing layers** ("the layer below can never clip through"), a
dissolve in Godot, main merged, our PBR sets on them, and the pantyhose, fishnet tights and socks; then whether the
library's dresses were kept and work with the layers, and **light rules for outfitting** ("if they're wearing a dress
dont worry about making them wear a coat").

- **docs/research/clothing_v2.md** is the report; its notes are in `docs/research/clothing_v2/`: `cloth2tex.md` (read at
  source: no), `sewing_patterns.md`, `mesh_generators.md`, `photo_to_look.md` (the generators and texturing models: none
  beats ready-made garments; their licence traps), `tools_and_assets.md` (**MakeHuman's community clothing is the one
  free library**: 129 CC0 garments and shoes, 210 CC-BY; where the files are), `fit_and_skin.md` (the fit's algorithm
  from MakeHuman's and Blender's own code, weights, hidden skin, layering, a second UV in metres, decals),
  `korean_japanese.md` (what the packs have for those; Style3D's free garments on Sketchfab the lead).
- **The fit test** (`clothing_v2/fit_test.md`, scripts `clothing_v2/proto/`, pictures `clothing_v2/fit_*.jpg`): MakeHuman's
  base body registered onto MHR once, 48 garments fitted with nothing adjusted by hand (fifteen of them on two to five of the Studio's
  seven test bodies), the tailor's own plaid on a library jacket at real size, a studio print on its back. A prototype:
  not on the launcher.
- **The layers** (fit_test §7; `proto/layers.py`, `wear.py`, `tailor_parts.mjs`, `glb.py`, `godot/`; pictures
  `clothing_v2/layers_*.jpg`): a kind and a layer a garment (bottoms 30 under tops 40, jackets 60, coats 70; legwear,
  socks and shoes under them), each garment set outside the ones under it, cloth against cloth, and what a layer
  covers left out from 3.5 cm inside its edge. Library garments worn with the tailor's pantyhose, fishnets, socks and
  the red sweater dress; on the baked PBR fabric sets; on Anime at Bust 2.1 (its dress form) and -2, a girl of ten, a
  boy of fourteen. **In Godot 4.7**: `cover.gdshader` dissolves the covered part out by a dither, and a band switched
  off (a coat taken off) brings back what it hid. Two checks, run by hand because they need the fetched garments:
  `python proto/check.py <work dir>` (LAYERS: the outfits that clipped, the fault counted without the layers and gone
  with them) and `python proto/godot_test.py ...` (GDLAYERS). `proto/pictures.py` makes every picture again.
- **The dresses and the outfit rules** (fit_test §7.5, `layers_dresses.jpg`): the twelve library dresses (Mindfront's
  six CC BY 4.0, punkduck's cocktail dress and qipao CC BY 3.0, Elvaerwyn's four CC-BY) each worn with legwear under
  and a jacket or cardigan over, nothing through. **None of the garment files are in the repo yet** (the packs are
  still to be downloaded); `proto/README.md` has the `git clone` lines that fetch the tested ones again. **Light rules**, what they
  refuse not worn (`layers.rules`, `layers.too_full`): one bottom, one jacket, one coat; a dress or a suit is the top
  and the bottom; **no coat over a dress**; nothing over a garment too full to go under it (2% of it more than 5 cm
  outside); no point moved further than 5 cm; shoes not drawn under a hem that reaches the floor.
- **What the layers don't do yet**: nothing was walked (the covers are made at rest; garments skinned from the same
  skin should keep them, untested); a hem that crosses pleats is a little wavy; on Anime's full bust the cloth covers
  and layers but stretches over it; the look plugin's skin shader and the Studio's export don't write or read the
  covers yet (the prototype's glb and shader do).
- **This session's network** let through GitHub and little else: arxiv.org, sketchfab.com, huggingface.co and
  MakeHuman's file servers were blocked, so licences on those are from search summaries and say so.

**CC-BY clothing may ship** (the user, DECISIONS 2026-11-11, last): each such garment has its line in
**docs/CREDITS.md** (author, licence, a column to tick when it's used in a game, a block for the credits screen).

**The clothing library** (`tools/clothing_library.py`, CLOTHLIB in check_all): the catalogue of MakeHuman's 40
clothing packs is tracked (`Content/Studio/Clothes/library/index.json`, 491 things to wear), docs/CREDITS.md lists the
CC-BY ones (294 after the refusals below), and every character export writes its own `CREDITS.md` (`storykit/clothcredits.py`). **The 2.6 GB of
files are not downloaded yet**: the file servers are blocked from the Default cloud environment. Either the user runs
`python tools/clothing_library.py fetch` on their machine, or a session is started on the cloud environment
"HorrorEngine" (made 2026-11-11, it allows the two servers) and runs it there. After a fetch, `scan` writes each
garment's own licence version into the catalogue and the credits: commit those two files. The fetch has not been run
against the real servers: its unpacking and scanning were tried on the system pack and one dress from other sources.
**The files stay out of git** (the user, 2026-11-11: "stick with the fetch"): `assets/clothing/` is ignored, so the
download survives a switch of branch in the same folder; a pull request for this branch is open
(tsukibii/HorrorEngine#24). **Their servers are slow** (3 MB in five minutes for the user), so the user picks: eighteen
numbered sheets of every garment were sent (`clothing_library.py sheets` makes them again) and **the user picked 98**.
**90 of them are in git** (`assets/clothing/<pack>/clothes/<garment>/`, 486 MB, added with `git add -f`: the folder is
still ignored, so later fetches stay out until added the same way), fetched in the cloud session once the user allowed
`files.makehumancommunity.org` on the Default environment (the faster mirror, tried first now; byte ranges work).
**Eight are held back** for the user's word: seven whose own file says AGPL3 where the page says CC0 or CC-BY (the old
MakeClothes default line), and a television character's costume (DECISIONS 2026-11-11, the last). `picks.json` lists
the 90. **They are worn in the Character Studio now** (DECISIONS 2026-11-11, the last): baked onto MHR's average
(`clothing_library.py bake`, `assets/clothing/_mhr/`, in git), fitted in JavaScript (`tailor/library.js`), in light
layers, shown as cards in the Clothes tab's *Library garments*, their colour, own texture, fabric or PBR set under
*Worn*, saved with the character and carried by Export for Godot with the credits. Checks: LIBRARY (node, in
check_all), LIBRARYPAGE (the page). They are layered against the tailor's own garments too (by slot; only the library's move). **Since (the very
last)**: a Gravity switch on each (a light fall by default), what a garment covers hidden in the export (the skin
under it, the layers under it), the ballet dress removed (89 garments), and GDLIBRARY: the export posed in Godot, the
clothes following the bones, 0.08% of the skin through cloth. **Next for them**: prints and patterns on one, soft
alpha, the covered skin hidden in the Studio's own view, a real walk animation in the game.

**Next, by the user's answers**: (1) answered: yes; (2) the packs downloaded on their
machine (`files.makehumancommunity.org`, or by MPFB2 in Blender); (3) then the build, in this order: the importer and
the fit in the Studio's own JavaScript (the registration kept as a file), the layers as the prototype has them
(`proto/layers.py` is the reference: port it, with its check), bridging for loose garments and skirts, weights and a
walk test with the covers on (`tailor/motion.mjs`), the look (second UV, the detail layer, decals baked by
`albedo.js`), the covers written by Export for Godot and read by the look plugin's skin and cloth, the tab. A placement
step for garments with no source body (Style3D's) comes after.

## Beside it (2026-11-11, after the latest, `claude/beautiful-cray-a622xx`, merged in PR #23, merged into this branch): tutorial v2's floor ready-made

The user, following tutorial v2: **"I dont want to build the map myself for tutorial 2, can you pre-build it so i can
just do the godot part of the tutorial"** (DECISIONS 2026-11-11, after the latest). So:

- **The floor is in git, made**: `Exports/interiors/hotel_floor/` (`hotel_floor.glb`, README.txt, export.json,
  ready.json), the set `hotel_floor` exported as the scene builder's button does. The guide's §9 commands
  (`godot_byhand.py new ~/Games/Room304 --name "Room 304"`, then `exports ~/Games/Room304 --link`) put it in the
  project, and the user starts at §10 in Godot. It's the only export in git: 45 MB, the biggest file in the repository.
- **Kept current**: `ready.json` holds the set's fingerprint and the .glb's signature (what it holds, not its bytes: a
  browser export's pictures come out in a new order each time, LESSONS). `python tools/godot_byhand.py ready` makes it
  again (the desk's server running), keeping the old bytes when nothing changed; READYMADE (`ready --check`, in CHECKS)
  fails when the set's changed since; TUTORIAL2 holds it to its own fresh export. **When the hotel's set or the level
  exporter changes, run `ready` and commit what it says changed.**
- **The guide** (guides/tutorial_v2): §2 opens with a tip (the floor's ready-made: skip to §9), §3 to §8 are marked
  optional, §9 says the floor's there at once; §3's new set is `my_hotel` now (`hotel_floor` is taken: the builder
  refused it, a slip since the guide was written) and §8 says to read `my_hotel` for `hotel_floor` from there on.
- **Checked here**: CHECKS (READYMADE in it, and its four cases: a reformatted set passes, a changed one fails, the same
  export with other bytes passes, another level over it fails), a project made as §9 says and imported by Godot through
  the link (the start, the locks, the colliders, her spot, every node TUTORIAL2 needs), TUTORIAL2.

**For the user**: pull, then §9's two commands; Godot imports the floor on the first open (its textures unpacked beside
it, `hotel_floor_0.png`..., kept out of git). Her is still theirs to make (or §20's stand-in).

## Beside it (2026-11-11, latest, `claude/nifty-tesla-dc904q`, merged in PR #22): Anime (the Bust from flat to very full) and the red knit dress
The user asked for a look-alike of a Daz3D character (proportions, the red ribbed turtleneck dress, the face and
makeup, the hair, "as 1:1 as possible"), reviewed the first bust ("unnaturally pointy ... how a waterballoon would
sit"), and then stopped it: **"I dislike everything we've done aside from the new red clothing fabric and the new bust
slider, keep the new bust slider as an 'anime' toggleable, and the clothing, don't worry about creating a preset for
the 1:1 character anymore"** (DECISIONS 2026-11-11, latest). So two things are in the project and nothing else of it:

- **Anime** (Character Studio, Body, under Cutify): a switch. On, a **Bust** slider under it runs −2 to 3 (the same
  value as Sculpt, Body, Bust): −2 a flat chest, 0 the body's own, past 1 a full bust that hangs (a ball in the skin
  from the breast's root, its weight low; 2 large, 3 about the picture's). **Off, the default, the Bust is the plain
  −1 to 1 slider, to the bit what it was.** CHARACTER_STUDIO §2e; `sculpt.js` `bustShape`.
- **Clothes over a full bust** are cut on a **dress form** (the hollow under the bust closed; TAILOR §1j). The body
  shown, saved and exported is the hanging one.
- **The red knit**: the fabric **Rib knit, chunky** (`chunky`) and the outfit **"casual: red sweater dress"** in
  Casual (a long turtleneck sweater over a straight skirt of the same knit: `sweater-dress`, `sweater-dress-skirt`).
- **Taken out**: the figure preset and its cards, the face look, the face controls made for it, the hair preset, the
  figures tool. **No 1:1 preset**: don't pick it up again unless the user asks.

**The picture**: `docs/studio_sheets/2026-11-11_anime_bust.jpg` (the switch and its slider; the body with Anime off at
Bust 1, on at −2, 2 and 3; the red sweater dress on the plain body and on Bust 2).

**For the user's eye, on the card** (drawn on the CPU here):
- the Anime Bust at 2, 2.2 and 3 from the side and three quarter, bare and under the red dress and a t-shirt;
- the knit under a full bust: the cloth creases hard where it turns in under the bust (LATER: a tent in the form's
  place would smooth it; say if it should cling less or more);
- the flat end (−2) on the feminine base.

**Run here** (the cloud, on the CPU): CHECKS, GROW, POSE, TAILOR (with its new full-bust case), GROWPAGE (QUICK),
WARDROBE, and the Anime switch driven in the page by hand (off and on, its slider and the sculpt's moving each other,
no clothes cut again while the Bust is plain, the dress worn, saved, opened again). **Not run here: STUDIO** (50
minutes on the CPU): the page's script changed (the switch, the body's form for the tailor), so it wants a run on the
card (docs/RUN_LOCALLY.md).

**Not done** (LATER, "A full bust, further"): it doesn't move in play (no bones, where the ears have chains); nothing
lifts it (a bra sits on the form); the cloth under it is cut from little; MHR's chest is coarse at the slider's top.

## Before that (2026-11-11, `claude/nifty-tesla-dc904q`): the creatures as presets, a face that moves in Godot, creature skins

Two asks from the user on the same branch, after the ages and monster mode below (DECISIONS 2026-11-11, both entries).

**"add presets for the monster-ish shapes you made so I can use them, fix anything that needs fixed for godot too"**
- **The creatures are cards** in the Character Studio (Body, under Monster mode, always there): Goblin, Ghoul, Ogre,
  Grey alien, Demon, Hag, Imp, each a picture. A click is the whole creature: shape, height, build, teeth and **its
  look** (a skin colour on the procedural skin, eyes, lips, horns for the demon and the imp). *With its look* and *Face
  only* under them. `node tools/character/creatures.mjs make [--only goblin,ogre] [--export]` makes each a character
  of its own (`creature_<id>`) and its Godot export; `thumbs` makes the cards' pictures again
  (`Content/Studio/Creatures/thumbs/`). CHARACTER_STUDIO §2d.
- **A Studio character's face moves in Godot** (GODOT_DIRECTOR §6c, GODOT_LOOK §5f; GDFACES). It didn't: the face
  bake skipped every export made since the blink, face.gd drove one mesh, an expression's closed eyes fought the
  blinker. And once it moved, the eyes came through the lids (MHR's shapes are for MHR's eyes): the bake now keeps the
  lids off the eyeballs in each shape, measures how much room that character's mixed expressions still want and writes
  it in her copy (`lidRoom`), and the look plugin's eye is drawn that much deeper while her lids move (her blinker
  turns it on and off; at rest the eye is the Studio's to the pixel). **Characters already in a Godot project want
  their copy made again** (Export for Godot, `godot_director.py install`, or the game's next export).
- **A creature or a child can be shot at**: the weapons plugin's hitboxes are sized by her own bones (HITBOXES); the
  starter kit's hunter, chase, menace and cue take a `head_m`.

**"some more weird skin shaders/textures for the monster characters that we can apply in godot, e.g. a chrome silver
skin, a pearlescent skin, some kind of greasy shader"**
- **Creature skins** in the look plugin (GODOT_LOOK §5o, guides/look_plugin §8; CREATURESKIN): eleven looks on a
  character's skin in place of the skin shader: chrome, mirror, pearl, greasy, slime, oil, porcelain, ember, stone,
  scales, wax. On the `HSCharacterLook` node's **Creature skin** row, as presets (`presets/creature_<look>.tscn`) or
  `HSCreatureSkin.wear(node, "chrome")`; Amount (a skin that turns), Tint (chrome in gold), Extend (her horns and ears).

**Run here** (the cloud, on the CPU): CHECKS, GROW, GROWPAGE (QUICK), FACEMORPHS, GDFACES (on `_studiotest`,
`_growtest`, the demon, the goblin, the ogre; `--pictures` on `_studiotest`), EYELIDS, GDPEOPLE, GDPLAY, DIRECTOR,
EXPORTS, CREATURESKIN (on the demon), LOOKPLUGIN `--nodes`, HITBOXES, WEAPONS, TUTORIAL2 (its test read a stand-in's
`Head` node and stopped on a machine that has `_studiotest`, where she is the export: it measures her head's bone
now); GDTESTROOM but station 13 (made props need Blender, as before here).

**The pictures**: `docs/studio_sheets/2026-11-11_creature_cards.jpg` (the seven cards),
`docs/godot_sheets/2026-11-11_faces.jpg` (a face at rest, smiling, squinting down: MHR's moves alone, baked, as a game
wears her), `docs/godot_sheets/2026-11-11_creature_skins.jpg` (the looks on balls; the demon in each).

**For the user's eye, on the card** (everything here was drawn on the CPU):
- each creature card's look in the Studio (`MONSTERS` in grow.js: the tone, the skin preset and its tweak, the eyes);
- the creature skins on a real creature in a real level: chrome and mirror want something to mirror (a sky, a
  reflection probe); the looks' numbers are `HSCreatureSkin.LOOKS`; the greasy smears and the slime are the two I'd
  look at first;
- an expression on a character in Godot (the story's `expr`, or the Director's Animate tab's Face cards): the lids
  over the eyes in a close-up, on a plain face and on a creature;
- a creature shot at: the ogre's and the imp's hitboxes, `girth` for the ogre's belly.

**Not done, and why**: the creature skins' patterns break at MHR's UV seams (LATER: the rest place per corner); the
story's `skin` word doesn't name a creature skin yet (a desk game's cast: the format, its check and the desk's command
in one commit); 88 blend shapes on a 136,000-corner skin are 240 MB on the card a character (LATER: the head cut from
the body in the copy); the starter kit's hunter still sees from `head_m` as set by hand, not measured.

**Next, if the user wants it**: more creature presets and skins (both are a dictionary entry each); the Studio's
creature cards naming the Godot skin they want; tails and wings on HSJiggle's chains; the eyes turning in Godot (a
glance, look-at).

## Before that (2026-11-10, night, `claude/nifty-tesla-dc904q`): children, Cutify, monster mode, horns and ears that flop

The user: "we are restricted to making older characters in the studio creator ... a toggle for monster mode ... making
younger npcs 8-18 age ... maybe a separate toggleable 'cutify', but we should still be able to import image to face ...
enhance the horns and add different type, add cow ears and animal ears ... when I export it to godot I could add a
jiggle bone (doesn't exist yet) to the ears so they flop" (DECISIONS 2026-11-10, night). Built, all in the Character
Studio and the look plugin (docs/CHARACTER_STUDIO.md §2d, docs/GODOT_LOOK.md §5n):

- **`tools/character/grow.js`**: proportions (parts of the body sized against the rest on MHR's rig, before the
  height's scale), the ages' table, Cutify, the creatures. **The head is the unit**: an age scales the body under the
  head, so nothing made on the head needed changing and a picture still fits the face on a child.
- **Body tab**: Age (8 to 17, or the adult; sets the height to the age's average; Young face), Cutify (a switch and an
  amount), Monster mode (the sliders and circles to ±3, the height 0.4 to 3.5 m, the Creature controls, seven creatures
  as chips), new sliders (Proportions; Face length, Round face, Eye size, spacing and depth, Ear size, Ears out; Bust,
  Seat). Face, Mouth: Fangs, Pointed teeth.
- **Accessories**: `horns.js`: thirteen horns, thirteen animal ears (a cow's with its tag), on a headband or from the
  head, Flop.
- **The export**: each ear a chain of bones under the head (`jiggle_ear_L_0` ... `_tip`), horns whole on the head.
  **HSJiggle** in the look plugin springs them (Godot's SpringBoneSimulator3D); HSCharacterLook and the game's cast put
  it on by themselves.
- **Hair rides the head**: a bake made on an adult follows the head to a child's (the character records the head its
  hair was baked on, `hairHead`; `placeHair` in index.html); a bake on no head we know is left and the view says so.
- **The head's scale in the export** (`studioScale` on the skin's node): the 72 face shapes sized by the head, not by
  the body's height (the desk's `face.js`, the Godot bake `face_morphs.mjs`; older files as before).
- **Checks**: GROW (in check_all), GROWPAGE (the page, a scratch character `_growtest`), JIGGLE (Godot, headless);
  TAILOR and POSE now run on two children as well (every design cuts on an eight-year-old).

**Run here** (the cloud, on the CPU): CHECKS, GROW, POSE, TAILOR (104 designs on nine bodies), FACEMORPHS, GROWPAGE,
JIGGLE, LOOKPLUGIN `--nodes`, GDPLAY, PEOPLE (`PERSON=_growtest`: a child with ears and horns on the desk), SALON,
GROOM and EXPRESSIONS ok; GDTESTROOM ok from the start to station 11 and from 12 (`--from n_bath`) to the end, with the
desk's bake made first (`node tools/godot/bake.mjs --game TestRoom001`), station 13 failing as it does on any fresh
container (the suitcase's and closets' made props need Blender).

**STUDIO**, which hadn't been run to its end since late October (three of its steps had gone stale, none from this
work):
- its brows and lashes step looked in the Face tab (the brows have had their own since 2026-10-31) and clicked the
  panel's first two switches (the fine hairs' since groom.js): fixed, it passes;
- **"the eyes from the side" fails, and fails the same on the code before this branch** (`7d80d01`, a second server
  on a worktree: the same pixel counts): from 75° and 85° the white is 36% and 35% of the opening on a fresh character
  where the step wants over 40 (12 to 15% later in the full run, after the steps that set the eyes' softening). The
  number is from 2026-10-28, before the grafted lids and the soft look; whether the eye or the number is wrong is the
  user's to say on the card. Left as it was;
- every other step passes on this branch: 1 to 29 and "the eyes softened" in the full run (`ONLY='^(?!the eyes from
  the side)'` runs all but the one), the eleven from "the eye refracts" to the export for the desk as a group on a
  fresh character, and the last two (the baked colours, cleared pictures) with the lipstick, clothes and brows steps
  before them, which they need. In the full run the click that opens "the eye refracts" once waited past its thirty
  seconds (the page's thread busy on this CPU); alone it passes.
- EXPRESSIONS' face row step selected the body row as well (`ftrack btrack`): fixed, it passes to its end.

**For the card** (docs/RUN_LOCALLY.md): STUDIO in one go, and the pictures to judge by eye.

**Found on the way, and fixed the next day** (2026-11-11, below): a Studio export's face in Godot didn't move
(the bake skipped every export made since the blink, face.gd drove one mesh, the lids fought the blinker).

**The pictures**: `docs/studio_sheets/2026-11-10_ages_cutify.jpg`, `2026-11-10_creatures.jpg`, `2026-11-10_horns_ears.jpg`,
`2026-11-10_child_hair.jpg` (a salon preset baked on a nine-year-old, riding her head at eight, fourteen and grown);
in Godot `docs/godot_sheets/2026-11-10_ears_jiggle.jpg`.

**For the user's eye, on the card** (nothing here was judged on a real GPU: the pictures were drawn on the CPU):
- an eight-, a twelve- and a fifteen-year-old of each base: the head's size, the build, the face (`CHILD_BODY`,
  `CHILD_FACE` and the table in grow.js are the numbers to change);
- Cutify at 0.6 and 1 on an adult and on a child (`CUTE`);
- each creature chip (`MONSTERS`), and the sliders at 3: where a field breaks before its limit, `REACH` takes a number;
- the horns' and ears' sizes and places on a real character with hair (they're made on the bare scalp);
- the ears in Godot: HSJiggle's `amount` and `gravity` (how floppy), on a character that walks.

**Next, if the user wants it**: hair made again by itself when the body under it changes (today the bake rides the
head: what lay on the shoulders needs Hair, Bake); the outfits' pictures on a child; children's sizes in the wardrobe
(clothes cut for a child keep an adult's ease in centimetres); younger than eight; tails and wings on the same chains
(HSJiggle springs any `jiggle_` chain); the creatures' skin (the procedural skin's greens and greys as looks); the
desk's stand-in bodies by age; the salon's own frame on a child's short face (it sizes the hair by the face's height,
chin to crown, which an age shortens by a twentieth: presets may want a little more volume there).

## Before that (2026-11-10, `update-tutorialv2`): tutorial v2 uses every system, and says what's missing

The branch `update-tutorialv2`, made from main with `laptop` merged (PR #20). The user: "make a new branch called
update-tutorialv2, that implements (gets the user to imeplmenet) every feature we've created so far so we can see whats
missing, the gameplay itself doesnt need to be long, just needs to use every system to make sure verything works as
expected (I will follow the tutorial and give feeedback in the pr)" (DECISIONS 2026-11-10, after that). Built:

- **guides/tutorial_v2**, six new sections after the cues (§24 to §29): the UI plugin's HUD and quest markers (by the
  to-do list), money and the laptop (the game's own catalog: the plugin's six and three files in `shop/items`; the
  shotgun a ? till the knocks, the explosive shells till the gun's come), a parcel at 304's door, the shotgun, things that
  break and glow (the kettle's LED and steam, the mug's tea, a candle, the entry's bulb), shooting her who hunts; §32
  **every system in it**, a table of each and where, and **what a game by hand can't do yet** (parts that open, a book,
  faces, moves, the HUD's words, E's prompt, the pause menu, the runtime's interactables, a street). Ten new pictures.
- **TUTORIAL2** plays all of it after the jump scare (`every_system()` in `tutorial_v2_test.gd`), and the markers at the
  start and at the note.
- **The glue the tutorial needed**: HSShopItem's In the hands (`gun`, `shells`, `shell`) and `tick` (the shop gives the
  weapons plugin's gun its gun and shells); HSQuestMarker's `needs` (the Story's words) and `shown()`; HSHud's `keys` (the
  game's key chips in place of the runtime's); a quest marker over each parcel (`mark_parcels`, HSPackage `marker`).
- **Two bugs the tutorial found**: a hidden character's hitboxes stopped pellets (her waiting at 308's door: now off while
  she's hidden, HSHitReact `_sync_boxes`); shot down, the starter's searcher hid her at once so her dissolve was never
  seen (searcher.gd's `stop()` leaves one `hs_down` to HSHitReact).
- Checks: CHECKS, TUTORIAL2, GDUI, LAPTOP, WEAPONS ok.

**Next**: the user follows the tutorial by hand and answers in the PR. Then, by their answers, the missing list (§32):
likely the HUD's words fed by the Story and E's prompt first (small), then parts that open and books in the starter kit.

## Before that (2026-11-10, `laptop`): a laptop to sit at, a green terminal, a shop that fills the pocket, parcels at the door

The branch `laptop`, made from `weapon-system` (its pull request, PR #19, not merged yet: this one stacks on it). The
user: "Make a new branch called laptop, similar to what we did for the retro props analyze and enhance the laptop and
mouse model, then make it usable so when a player interacts with it the camera zooms in on the screen and a usable ui
appears ... a order tab, a player can order items with cash they have ... using the existing inventory system where we
display the actual model in the slot that's visible ... make it so its easy to add items ... a preset scene (godot
prefab) object ... the typical green matrix style terminal look" (DECISIONS 2026-11-10, later still). Built:

- **The model** (PROPGEN §32): their FBX analysed (a laptop open at 125° and a mouse, 10 times too big, 172 triangles, two
  web photos packed in: taken out, `Content/Studio/Props/models/laptop_mouse.fbx`), the `computer` family's customizable
  `laptop`, `laptop_shut`, `computer_mouse`: real size, edges bevelled, everything painted in code (keys and legends,
  touchpad, grilles, ports, feet, vents, webcam, the lid's crescent, sticker and asset tag; the screen its own material),
  the lid on its hinge; the mouse subdivided round, its wheel, grip and red sensor. **Batteries** for the shop: the `cell`
  family (PROPGEN §33), `battery_aa`, `batteries_aa_2`.
- **HorrorStudio Devices** (`GodotPlugins/HorrorStudioDevices`, README, CLAUDE.md; in every `godot_byhand.py` project):
  the prefab `laptop/laptop.tscn` (HSLaptop): E, the zoom in, the green terminal (HSTerminal: VT323, the code's rain, the
  boot, HOME, ORDER, LOG), clicks through the glass, Esc/E/LOG OFF back; the Order tab's cards each the thing's own model
  (`HSModelSlot`, pulled out of the HUD's inventory row into the UI plugin so both use it) in the green; orders paid from
  the Story's cash into the pocket with their models; `HSShopItem` files in a catalog's list or folder; six made props for
  sale; sounds made in code (`tools/device_sounds.py`).
- **The starter**: `story.gd`'s pocket counts and keeps each thing's name and model, shows as an HSHud's row (Tab, the
  wheel), and holds the cash (`pay`, `earn`); `pickup.gd` gives its model and can be cash.
- **LAPTOP** (`tools/godot/laptop_check.py`, `laptop_test.gd`, `laptop_scene.gd`, `laptop_shots.gd`) and the guide
  `guides/laptop/` (eleven pictures Godot drew).

Then the user's next four (DECISIONS 2026-11-10, last: "an option to choose a spawn location for the bought items,
create an 'amazon' package box for the arrived goods, and unboxed (press e to unbox/add to inventory) / make it easy to
decide what item are buyable / make the items unlockable by quests that are done (flags) / do a ? for non unlocked
items, create a next page ... prev and next page ... [2]"), built:

- **The parcel** (PROPGEN §34): the prop generator's customizable `parcel` family, a corrugated carton from its size,
  its four flaps parts that open (the long ones over the short ones), its tape cut along the seam, a shipping label, the
  shop's print (NIGHT-MART, made up; no one's smile): `parcel`, `parcel_small`, `parcel_open`; the plugin's
  `models/parcel.glb`.
- **Delivery**: the laptop's `deliver_to` (a Marker3D), `deliver_place`, `delivery_secs`, `when_unseen`, `knock`,
  `package`; orders wait, then are left there in parcels (`delivery/package.tscn`, `HSPackage`) while the place isn't
  seen; **E unboxes one** (the tape, the flaps, what's inside shown, then into the pocket with its models; Empty.),
  `take_on_open` off for two presses; a parcel placed by hand with its `items`. Sounds: knock, thud, tape, flaps.
- **What's for sale**: each thing's `for_sale`, a laptop's `sells`; **locked**: a thing's `needs` (the Story's words:
  `task:<id>`, a fact, `item:`, `!`), a ? till then (`???`, its `locked_text`, not to be ordered; `show_locked` off: not
  there), NEW once unlocked; `unlock(id)` from a script.
- **Pages**: the Order tab six cards a page (`page_size`), a category a page, `< PREV`, `1 [2] 3`, `NEXT >`, the arrow
  keys. LAPTOP now 18 steps; the guide's new sections (pages, locked, delivery) with nineteen pictures.
- **Unboxing as a pickup** (the user, after: "items absorbed towards the player (think minecraft drop item collection)
  ... and the box poofs disappears ... the illusion of bigger items like shotgun fitting inside"): E bursts the parcel in
  a puff of card dust and bits, each thing pops out at its own size, hangs a moment, is pulled into the player shrinking
  with a pop and pocketed as it arrives; the parcel freed; `keep_box` leaves it open and empty. LAPTOP 19 steps (a shotgun
  out of a parcel by hand); the guide's unboxing pictures.

**Next, if the user wants it**: their eye on it in their own rooms and on their tape (its brightness, the green, the rain,
how close the view goes; the parcel's print and where it's left); a courier's steps and a doorbell for the delivery, a
parcel that's wrong (something in it nobody ordered), more tabs (mail, a camera feed, files with the story's clues),
typing into it (a search, a password), the export and the Director's projects copying the plugin in, more devices on
the same terminal (a CRT, a phone), and their ear on its sounds.

## Where it stopped last (2026-11-09 and 10, `weapon-system`): a shotgun held in first person, things that break, someone shot

PR #18 merged into main; this branch is new from it (the user: "make a new branch called weapon-system, create a shot
gun asset and have its pov in godots horror engine similar to the screenshot", then "I don't need a hand holding the
gun"; DECISIONS 2026-11-09). Its pull request into main is PR #19 (https://github.com/tsukibii/HorrorEngine/pull/19):
TUTORIAL2, FIRSTGAME and GDPROPS weren't run on the branch. Built:

- **The assets** by the prop standard: the prop generator's `weapon` family (PROPGEN §30): `shotgun_pump` (a riot
  gun's sizes, its pump sliding, the bolt's face shown only while the action's shut, the trigger on its hinge, sockets
  for the muzzle, ejection port, loading port, chamber, flashlight...), `shotgun_pump_black` (synthetic),
  `shell_12ga` and `shell_12ga_spent`; PROPGEN's cases have the gun and a shell. The sounds in code:
  `tools/weapon_sounds.py`.
- **HorrorStudio Weapons**, a Godot plugin (`GodotPlugins/HorrorStudioWeapons/`, README, CLAUDE.md, `img/`): `HSShotgun`
  under the player's camera, no hands; held low on the right, the barrel's line on the view's middle; fire, the pump
  racked by itself (hulls falling and rolling by rays), the reload a shell at a time from under the gun into the loading
  port, a click during it fires as soon as it can, Q lowers it, the flashlight carried under the barrel; `HSWeaponPickup`
  the gun or a box of shells. `godot_byhand.py` copies and enables it in every project made by hand.
- **WEAPONS** (`tools/godot/weapons_check.py`): built into tutorial v2's hotel corridor and played headless; `--pictures`.
- **Held as in the reference**: set side by side with the user's screenshot, the muzzle just under the middle of the
  view and the gun dropping steeply to the bottom edge (`hold` 0.14, -0.165, -0.34; `aim_at_m` 1.1), the carried
  flashlight's beam on the middle of the view (`beam_at_m` 12).
- **Reviewed** by an independent read of the scripts; its ten real findings fixed and held by WEAPONS (LESSONS
  2026-11-09: hiding with `visible` and `hs_hidden`, never disabling; `hs_lit` for a light out for good; springs in
  substeps; a shake kept when another script moves the node).
- **Refined** (the user's "refine it through diff perspectives"): the kick settling back, the gun rocking with the
  pump, carried low while running, aiming on the right button, the tape's 4:3, the shells as marks, holes staying on doors and crates, pickup
  sounds, the editor's preview, `HSShootable` (shot: gone a while, shoved, a cry, a line, a target; `hit`, `down`), and
  the guide `guides/weapons/index.html` (its pictures WEAPONS's).

- **The v2, a double barrel** (the user: "only the barrel is visible in frame, unless we reload then it splits in two
  within frame and two shells pop in"; then their own model, `dbl_barrel.fbx`, "use it as a base and enhance it with
  better pbr textures"; DECISIONS 2026-11-09, later): `HSDoubleBarrel` (`double.gd`) on `shotgun_double`, the prop
  generator's kind `double` reading the user's model from `Content/Studio/Props/models/` (its real size, its barrels
  made round, its parts and sockets measured on it, blued, case-hardened, checkered walnut: PROPGEN §30); only its
  barrels in the view, the right barrel then the left, R breaks it open near the eye (a V with the chambers in the
  middle of the view), the hulls flicked out past your face, a shell popping into each chamber, shut. WEAPONS's double
  half and its pictures (double_*.jpg); PROPGEN's cases have it.

- **Cartridges you can customize, and a guide** (the user: "a cartlidge prop for the shells that I can customize similar
  to cans and books", "a guide on how to use the prop customizer"; DECISIONS 2026-11-09, later still): the `ammo`
  family (PROPGEN §31, customizable): the shell (moved from the weapon family) printed along its hull and stamped, and a
  printed card box of shells (five lying, twenty-five standing, its lid a part that opens); `shell_12ga`,
  `shell_12ga_spent`, `shells_box_5` (the weapons plugin's box of shells now, `lid_open`), `shells_box_5_open`,
  `shells_box_25`. The guide `guides/prop_customizer/` (GUIDEPROPS makes its pictures from the real page). A quarter-turned
  slot's wanted size and template turned upright (sizes.py, picedit.js).

- **The muzzle flash, a muzzle system, two kinds of shell and what a shot leaves** (the user, with two pictures: "a
  muzzle flare for the shotgun (the closest one that leaves a trail of smoke behind)", "a generic muzzle system that
  can be used later for other guns" with their technique (each wing a series of slightly elongated intersecting spheres,
  fronts culled, a noise triplanar on each blended by the view's normal dotted with the surface's, the blend a burn),
  shell kinds easy to add ("a normal shell and explosive shell"), and "a response... a pbr mask to make it like pieces
  are missing"; DECISIONS 2026-11-09, latest). In the weapons plugin: `HSMuzzle` + `HSMuzzleFlash` (`muzzle/`: the wings
  as one MultiMesh of spheres laid out each shot, the burn in `flash.gdshaderinc`, added or solid, the light with its
  haze kept low, sparks, puffs, **the smoke trail** left behind as the gun moves, smoke's light capped and a faint glow
  of its own), `HSShellType` (`shells/`: buckshot and explosive; the tube, chamber, barrels and pocket keep kinds; T),
  `HSImpact` + `HSImpacts` (`impacts/`: a crater decal with albedo, normal and ORM from one height field, tinted by the
  surface, dust and chips; the explosive's blast: fireball, scorch with embers, push, damage, shake, noise), the maps
  by `tools/weapon_fx.py` (WEAPONFX, in check_all), the burst's sound; the explosive shell, its hull and box as
  customizable recipes (`shell_12ga_explosive`, `_spent`, `shells_box_5_explosive`). WEAPONS checks it all (§8f, §8g,
  the double's §7b) and pictures it (`trail`, `explosive`, `blast`, `scorch`, `flash_parts`); the guide's
  sections 8 to 10. The lab used to tune the look was a throwaway script in the check's project; `muzzle_shots.gd`
  keeps its useful part (the flash taken apart).

- **The double barrel alone, how it looks with the muzzle, what a wall shows** (the user: "I don't want the single
  barrel shotgun, only the double barrel one, inspect how it looks with the muzzle and what kind of wall damage it should
  have"; DECISIONS 2026-11-09, last). The pump gun is gone from the plugin (its class, model, icon and two sounds; its
  recipes stay as props). `HSGun` (`gun.gd`, abstract) is what both shared; `HSDoubleBarrel` extends it; `shotgun.gd` is
  the double under the old path. Inspected in the corridor: the second barrel's flash was a white ball in the first's
  smoke; the puffs are premultiplied now and capped at `smoke_light_cap`, and it reads. The damage
  (docs/research/shotgun_damage.md): each barrel's own choke, the pattern spread from the muzzle, pellets within 1.6 cm
  torn into one hole (`fx/blast_*`), the powder's soot and grains close up (`fx/soot_0`, `fx/grains_0`), the wad's
  dent from 1.5 m (`fx/wad_0`), lead smears on hard walls (`fx/smear_*`); `HSImpacts.last_shot`. A hull could fall or
  roll through a wall (the door's collider stops short of its jamb): three rays now (LESSONS). One WEAPONS test for the
  double (`weapons_double_test.gd` folded in, §8g the damage) and one set of pictures (`fire_left`, `open`, `pop`,
  `damage_*`).

- **The smoke trail made to read as smoke** (the user, with four of the guide's pictures: "the smoke trails look a bit
  unrealistic and fake and show sharp lines, enhance it, research how to do realistic smoke if required first in godot";
  DECISIONS 2026-11-09, after the last). Researched (docs/research/muzzle_smoke.md), then rebuilt:
  - The trail drifts in curl noise ramping in with age.
  - It's soft sprites along a smoothed curve, in strands that part (a strip folded in the curls).
  - The trail and the puffs read one warped noise in the world, eroded as they age, so they agree (beads, rope and
    grit before).
  - Soft particles against walls and the lens.
  - A still barrel sends up a curling thread.
  The probe `Saved/Godot/_weapons/trail_probe.gd` (five moments, before and after); the guide's pictures made again.

- **Things that break when they're shot** (the user: "a shader/script called blownUp or something that lets any object
  we attach be blow up by shotgun shots, e.g. a kettle, a box, but it should look like the object itself got destroyed
  not just a generic animation"; DECISIONS 2026-11-09, after the smoke). Researched (docs/research/breaking_props.md),
  then **HSBlowUp** (`blowup/`): the object's own meshes cut when it loads in a worker thread (HSFracture: recursive
  plane slicing, the cuts filled, hollow kinds' walls never filled), its own materials on every piece and the inside's
  shader on the broken faces, small pieces near the hit by region growing, thrown along the shot, the holes with them;
  dents below its strength; the pieces rigid (4.5 cm and over, colliders at least 6 cm, laid onto the floor at rest) or
  by rays; contents and lids whole, a liquid pooling; kinds as resources (`HSBreakKind`: ceramic, glass, wood, metal,
  cardboard, plastic, stone, guessed); break and landing sounds made in code (`tools/weapon_sounds.py`); `preview` in
  the editor. The made kettle and mug ship in `models/`. WEAPONS §8i holds it; the guide's section 11 and its six
  `blowup_*` pictures. Probes: `Saved/Godot/_weapons/blow_probe.gd`, `blow_shots_probe.gd`, `mug_probe.gd`,
  `blast_probe.gd`.

- **Someone who bleeds black ichor** (the user: "now instead of a breaking items system can you create a reactive
  system for characters/enemies to be shot, but dont do blood, instead create some form of demonic dark smoke and dark
  splatters like black blood"; DECISIONS 2026-11-10; HSBlowUp kept beside it: the user wants both). Researched
  (docs/research/hit_reactions.md), then **HSHitReact** (`react/`): hitboxes on her bones on layer 11 (`HSGun.SHOT_MASK`
  for the gun and a blast), the head twice and a limb 0.6; a flinch on springs after her animation (`HSFlinch`, a
  SkeletonModifier3D); a stagger counter holding her against whatever moves her and shoving her back; black glossy
  ichor with embers (`fx/ichor_*`: a wound on her bone, drops, the spray behind her, drips down a wall) and black smoke
  out of each wound trailing after her (the muzzle's smoke made black, after the shove: LESSONS); down, she chars,
  crumbles into the smoke and is gone, a pool (or vanish, ragdoll, nothing); `ichor_hit` and `ichor_down` made in code.
  WEAPONS §8j on MHR's body (`bodies/MHR.fbx`) and a stand-in; the guide's section 12, `react_*` pictures. Probes:
  `Saved/Godot/_weapons/react_probe.gd`, `react_shots_probe.gd`. And HSBlowUp's pieces no longer fall through a
  level's one-sided floor about one run in five (`_unsink`; `mug_fall_probe.gd`).

- **The ichor alive** (the user, while HSHitReact was being made: "once your done can you look into adding some kind of
  shader for the black gothic blood that will fit our vhs camhybrid look and look eery and oozy"). Looked into
  (docs/research/ooze.md), then **HSOoze** (`react/ooze.gd`, `ooze_<kind>.gdshader` over `ooze.gdshaderinc` and
  `ooze_frag.gdshaderinc`): a box projected onto what it covers, the surface from the depth buffer and lit there
  (`LIGHT_VERTEX`); the shape a field in the shader (a spray spreading and creeping, drips running down a wall and
  stopping, a pool's tendrils, a wound oozing, a drop); black glossy domes with an oil's sheen and the room in their rims,
  oxblood where thin, a slow beat, embers; HSHitReact's marks (`_mark`: decals off Forward+ or with the look's `ooze`
  off). Tuned in a lab of its own, `Saved/Godot/_ooze_lab/` (`ooze_probe.gd`, `dbg_probe.gd`, `step_probe.gd`; its
  scripts and the work before it in the session's scratchpad). WEAPONS §8j checks it; the guide's ichor-alive part and
  four `ooze_*` pictures.

**Next, if the user wants it**: their eye on the ooze in their own rooms and on their own tape (its sheen, gloss, beat,
drips and tendrils are the look's), the ooze smeared when walked through and dripping off a ceiling; their ear on the
ichor and break sounds (made in code, never heard here) and their eye on how things break in their own rooms (a kind's `coarse`, `speed`, `crumple_m`); metal tearing into petals, Voronoi cells,
pieces breaking again, a broken thing kept broken in a save. Their eye on the flash and the damage in their own lighting (the flash's `energy`,
the smoke's `smoke_glow`, `smoke_light_cap`, density and the trail's turbulence, strands and erosion, the impact's `merge_m`, `soot_m`, `powder_m`, `wad_m` are the
knobs), pellets through a thin wall into the next room and ricochets off concrete (docs/research/shotgun_damage.md §5),
the gun in tutorial v2 itself (found in a room, her an HSShootable that's gone a while when shot, the searcher coming
at the noise), the export and the Director's projects copying the plugin in (nothing in the runtime uses it yet), a
melee shove, more shell kinds (slugs, dragon's breath, rock salt for ghosts) as duplicated resources, more weapons
extending HSGun (a revolver, a hunting rifle) with HSMuzzles at their muzzles.

## Where it stopped last (2026-11-08, `claude/optimistic-tesla-q01qg6`): the air built and in tutorial v2

**Merged** (2026-11-08, the user: "make a pr for this, then merge in" `ui-v3` and `claude/friendly-newton-9o2xey`):
this branch is [PR #18](https://github.com/tsukibii/HorrorEngine/pull/18), with both merged in; their notes are below.
`ui-v3` moved the HUD, the marker, the themes, the pause menu and typing into `GodotPlugins/HorrorStudioUI`, so this
branch's music beds, `beds.gd`, read the pause menu's settings from `res://addons/horrorstudio_ui/menu.gd` now.
`claude/friendly-newton-9o2xey` brought the prop generator's retro family and its quality bar; it shares only docs
with this branch.

The user asked for a better flashlight and the level's air: "a beam in a fog", a fog level adjuster, dust in the
light, eye candy researched first, the system then put into tutorial v2 (DECISIONS 2026-11-08). Later the same day:
"The dust motes look too stylized".

- **The research**: docs/research/eye_candy.md (§2 the fog lab measured; §2.3b realistic motes; §3 the catalogue).
- **Built in the Look plugin** (GODOT_LOOK §5j):
  - `HSAtmosphere`: the fog level as one number, mist, wind, dust, `fog_to`, presets;
  - `HSBeam`: a light's beam drawn by its own cone shader, with a flashlight's cookie;
  - `HSDust`: tumbling flakes and lint on a curl-noise flow, seen only against the dark (each mote reads the screen
    behind it: over a lit wall it fades, and it never pushes a pixel into the glow);
  - `HSAirZone`;
  - 11 presets (52 in all);
  - `HSLightZone` takes each light's fitting glass with it in the game (what glows within 0.3 m: out, dimmed and
    flickering with its light; the nearest light that's on gets it; an exported game's story lights left to play.gd).
- **The starter kit**: the flashlight wears the beam and the cookie (`beam_on` weighs by it); `event_area.gd` and
  `scare_area.gd` roll the fog (`fog`, `fog_seconds`); `scare_area.gd` breaks the tape up for a moment (`tape`,
  `tape_for`).
- **Tutorial v2's §13 The air**: the hotel's haze and dust, the stairwell's dustier air zone, the beam in it, the fog
  rolling in when the corridor goes dark; with the Look nodes it hadn't used: the street lamp's shaft through the
  stairwell window, the leak under it and the puddle in its light, the leaves on 304's wall, her wet look, the tape at
  the jump. Its play test checks each (and the tubes' glass going out with them); two new pictures (`landing`, `air`).
- **Checked**: LOOKPLUGIN (`demo/air.gd`; `demo/zones.gd` now with a fitting's glass), TUTORIAL2, FIRSTGAME.

Then the user asked for more atmospheric horror, researched (DECISIONS 2026-11-08, later): docs/research/intensity.md (sound and the body, pacing and the threat's signs, the uncanny seen; §7 what to build first, §7's three decisions for the user). Nothing of it built: the user picks.

**Then (2026-11-08, night) the user: "for reverb you can lift the system we made in Woohill repo, feel free to work on the rest and include them as part of the new tutorial too".** Built in steps, a commit each (the tasks: sound physics; the body and the behind-you layer; her presence and the uncanny; the dread director; lightning, the cold and steam; being hunted), each into tutorial v2. Done so far: **the sound physics** (Woohill's: the starter's `acoustics.gd`, `sound.gd`'s mix and `play`/`step`/`shaped`, `footsteps.gd`; the tails by `tools/sfx.py tails`; the interior export's room markers carrying `floor` and `mats`; TUTORIAL2 checks the stairwell rings 3x the corridor and a knock behind 304's shut door is muffled); **the body and the steps behind you** (the starter's `fear.gd`: a heartbeat off the shelf's made `heart_beat`, breathing, the world dulled, the vignette, the beam's tremor, each a switch; `behind_you.gd`; tutorial v2's new §22 Making it intense); **her signs, the corner of the eye and closer each time** (the starter's `presence.gd` under her: the lights within 10 m on her floor and the flashlight dipping under the flash limit, the vending table's radio hissing, a false alarm, `warn`; `glimpse.gd`: her at 308's door after the note, only 30 to 42° off, gone as you turn to it in Tube5's blink; `closer.gd`: out of 304's bath mark by mark while unseen, then 0.35 m behind you, caught, gone in the lamp's blink, the Fear node's scare; `lights.gd` `set_flicker` and `blink`; §22's three new parts and two pictures, `glimpse` and `closer`; `tutorial_v2.py --only` draws only some pictures); **only in the mirror** (the Look plugin: render layer 19 drawn by the mirrors' cameras alone, the mirrors now 11 to 18, `HSMirror.only_in_mirrors`/`never_in_mirrors`; a mirror's own wall now kept out of its picture, which it wasn't for an export's walls (their `-colonly` colliders hold no mesh) nor the demo's; LOOKPLUGIN counts a box on each layer and its "mirror in a mirror" measure honest again; the starter's `mirror_figure.gd`, the player's eye leaving 19 out; tutorial v2: her in 304's tub, in the bath's mirror only); **a shadow that isn't yours and feet under the door** (the starter's `shadow_pass.gd` and `door_feet.gd`; tutorial v2: someone crossing behind you on 304's wall once she's gone from the mirror, the floor lamp now in its shade, 1.4 m up, where the guide always said; the light under 308's door and the feet in it once the corridor's dark); **something wrong with her** (the starter's `uncanny.gd`: her blink off, the smile with no eyes in it, her head bent, her steps copying yours; HSBlink no longer stops on a primitive mesh; tutorial v2: Her bent and walking when you walk, the closer's figure smiling); **the night's director and her menace** (the starter's `dread.gd`, `dread_moment.gd`, `menace.gd`; scare_area.gd marks what it hides; tutorial v2: six small moments round the floor, the stairwell safe, her menace); **lightning** (the Look plugin's `HSLightning` and `HSLightningStorm`, its preset, LOOKPLUGIN's lightning stage measuring the flash limits; tutorial v2: the storm low in the west, in through the end window and down the corridor, someone there in the first flash, the shelf's thunder); **the cold** (the Look plugin's `HSBreath` and `HSBreathPuffs`: breath lit by direct lights only and added, so a flashlight's beam shows it and the dark hides it; frost on the glass, `HSGlass.frost`, `HSWindowPane.frost` live; LOOKPLUGIN's cold stage; the starter's `cold_area.gd`; tutorial v2: the metre by the end window, your breath and the glass frosting up); **writing in the steam** (the Look plugin's HSMirror `set_steam` and `write`, `HSMirrorSurface.steam`/`.writing`; LOOKPLUGIN's steam stage; the starter's `steam_mirror.gd`; tutorial v2: once she's gone from the bath's mirror, a moment looking into it and it fogs over, 308 in it).

**Then the user, mid-run (2026-11-08, night, later): a mechanic for jump scares by what's so, for other events too.** Built as
the starter's **`cue.gd`** (DECISIONS: where you look as a region of the frame, middle, sides, top and bottom, corners,
the edge, with a tolerance; the Story's `on:<task>`, "on that quest"; what you're doing, sitting or lying in bed among
them; the flashlight, a distance band, how long, a chance; then someone for a moment with a sound and an animation,
gone in a blink, or the story's side for a cue that isn't a scare) with **`seat.gd`** (sit or lie down; the player's
`pose`, `settle`, `rise`, `doing()`). Tutorial v2's §23: her face down on 304's ceiling in the corner of your view
as you lie in the bed; three knocks at 304's door as you sit at the desk watching the static. TUTORIAL2 checks both,
what mustn't set them off (standing, looking straight at her place, the window), the frame's regions and the timings.
Not done: the desk's story format and the Director have their own `look` trigger and `sit`/`sleep` uses, without the
frame's regions or what the player's doing; ask the user before carrying the cue's conditions there.

**Being hunted, first step** (intensity.md §4, HORROR_TODO 5): the starter's **`noise.gd`** (a noise heard by the
group `hs_listener`: the player's steps, a run, a door, a gasp), **`searcher.gd`** (a copy of her armed in her other
self's place; heard, she listens 3 to 6 s, comes for the places to hide nearest the noise, opening a shut door on the
way, and stands at one 2 to 4 s breathing, 1 to 1.5 m from you: the close pass; held breath halves her chance, a light
on makes it certain; found, you're pulled out and she's in your face, once a search; seen in the open 7 m lit, 3 m
dark; back to her post; `searches`; `stop()`; the director held back while she's out), `seat.gd`'s `hiding` pose and
the player's held breath (Space, 8 s, then a gasp). Tutorial v2's §22 *Hiding while she searches*: once the corridor's
dark she hunts from 308's door; the linen closet's far corner to hide in; one search, then back into 308; the jump
scare stops her. TUTORIAL2 checks both runs (not found with your breath held; the gasp, found, pulled out).

**Chases** (intensity.md §4): the starter's **`chase.gd`** (after you at 0.95 of your run along the way she saw you
go, no navigation mesh: your trail, and a step on the way you were heading where she lost you; a door you shut holds
her 2 s and a bang, a locked one for good; 6 s out of her sight and she's lost you, her searcher searching there;
caught, the searcher's fright; `safe_rooms` she won't follow you into; 20 to 40 s at most; the chase mood, then the
hush and the mood before; `start()` from a signal or the searcher's sight, `stop()`); the searcher's `chase`, `hold`,
`search_at`, `give_up`, `catch`, and no place behind a locked door, no walk to a noise through a wall. Tutorial v2's
§22 *A chase*: seen in the open while she searches, she's after you; the stairwell is the way out. TUTORIAL2 checks
the run to the stairwell (her speed, the gap, the mood), 304's door holding her 2 s, and being lost.

That ends the run's list (the user's "the rest" of intensity.md §7; its 11, later, still later: the reflection out of
step needs a body, Nexus Resonance waits). Not done for the desk's story format: a `cold` word (the export's runtime
and Play), nor lightning's, nor hiding's held breath, the close pass, noises or a chase like this one (the format's
`hide` use and its hide-and-seek and chase rounds have none of them): ask the user before carrying them there.

Next:
0. **The user's pick from intensity.md §7** (the first five are small: footsteps in 3D and the behind-you layer, presence signs, the dead stare, the edge figure and closer-each-time, the shadow that isn't yours).
1. **Eye candy A** (research §4): the TV lighting the room, a pickup's glint, eyeshine, moths, dust shaken down.
2. **The export's torch** (play.gd: a hot spot and a spill) has no beam yet. It wants the story's `air` word (the
   level's fog, a room's) with the desk's side, the check and STORY_FORMAT in one commit; GDPLAY, GDTESTROOM, DIRECTOR.
3. **The scene builder's round fitting in a room with fittings of its own**: the hotel corridor has a round LED from
   the Finish under its third tube batten (builder-model.js adds one to every room with a ceiling). A room whose own
   kit lights are ceiling fittings (not a blackboard's) could skip it; the zone hands that glass to the third tube
   meanwhile.
4. **GDTESTROOM fails at station 13** (2026-11-08): the tee is taken and its task ticks, but `t13_pack` (put into the
   suitcase) never does. It fails the same with the last commit's Look plugin, so it isn't the air's change; it
   wants a look at the runtime's `container` use and `tests/gdtestroom.gd`'s station (`--from n_things` runs it alone).

## Beside it (2026-11-08, `ui-v3`, merged in PR #18): the quest marker v3, the HUD quieted, the UI a plugin

The user (DECISIONS 2026-11-08): a better quest marker (seen roughly through the rooms, fainter far off and behind walls,
clearer the nearer, still the diamond), "see what else can be enhanced in the ui"; then, while it was built, no glass
panels ("the panel isn't as noticeable and the text is there") and "the ui should be part of the godot plugin for
horrorengine". Two commits on `ui-v3`:
- **The marker** (`marker.gd`, play.gd `guide_clear`/`guide_ctx`): strength a log-scale function of distance (nearly opaque
  inside 3 m, a faint floor from 36 m, gone by 72), about half as strong behind walls (a throttled ray against walls,
  floors, ceilings and doors: furniture isn't "another room"), a small core and the thing's name near, a pointer on an
  ellipse toward it once it's been out of view a moment, the pause menu's Quest marker (Off, Subtle, Clear).
- **The HUD** to the desk's design (play/ui/hud.css), quieted: OBJECTIVE and TO DO resting at 74% and up on a change, rows
  kept so a tick eases (the marked task's bullet is the marker's diamond), the reticle a dot that opens into a ring, lines
  in a serif over a scrim, chips for the keys (the old row ran off the screen), toasts, the chapter card centred with a
  diamond rule, the dark while hidden, the menu's small capitals. **No panels**: the glass themes' panels are ghosts, a card
  is its words with a soft edgeless dark behind (`halo.gdshader`), the inventory's row has no border.
- **A plugin**: `GodotPlugins/HorrorStudioUI/addons/horrorstudio_ui/` (hud, marker, quest_marker = `HSQuestMarker`, theme,
  menu, typing, halo, plugin.gd with Project Settings `horrorstudio/ui`); the runtime uses it by path; the export, the
  Director's install and the by-hand projects copy it in; a game by hand adds an `HSHud` and `HSQuestMarker`s.
- **GDUI** (`python tools/godot/ui_check.py`, headless, ~20 s): the marker's rules and every piece above in the Pilot, then
  the by-hand half. Pictures: `--pictures` (the game, 1080p under xvfb), the plugin's `demo/hudlab.gd` (the HUD alone over a
  picture, seconds each).
Checks run here: GDUI, GDPLAY, GDEXPORT, DIRECTOR, FROMDESK, CHECKS ok; GDTESTROOM from `n_chores` and from `n_bath` the same
as main (stations 6 and 13 fail on main too in a cloud checkout: they need the local Studio character export and made
props; `--from n_bath` passes whole). FIRSTGAME and EXPORTS need the desk's server and local files: run them on the user's
machine.
Not done, if the user wants it: the **desk's Play HUD** (browser) has none of this; **the Director guide's pictures**
(`guides/director/img`) show the old HUD (`godot_director.py guide` makes them again); the serif is a **system font chain**
(the proxy blocked a font download: an OFL serif bundled in the plugin would make it the same on every machine); a
per-game default for the quest marker (a `game.marker` word would grow STORY_FORMAT, the check and the runtime together).

## Beside it (2026-11-08, `claude/friendly-newton-9o2xey` from the user's `retro-enhance`, merged in PR #18): the retro pack

The user (DECISIONS 2026-11-08): their old low-poly models in `retro/` (193 .glb: *3D_Retro_World 0.01* and *Utility
Infrastructure*) into the prop generator, held to a quality bar made from about fifteen of the best props, each model
checked as good enough or not, those that pass enhanced to our PBR style (smoothed where low poly), and a new tab
called retro. Done (docs/PROPGEN.md §29):

- **The bar**: `tools/propgen/quality.py` measures any .glb with numpy alone (geometry; each material's maps, texel
  density, the base colour's range and detail, roughness and its spread, occlusion, the normal map's relief);
  `python tools/propgen.py quality reference` made `Content/Studio/Props/quality_reference.json` from fifteen props.
- **The audit**: `quality audit` judged every file's nearest LOD (`Content/Studio/Props/retro_audit.json`, the review
  by eye in `retro_review.json`): 168 pass, one fails (Gas_Station/Trash.glb: a photo of litter on an 8-triangle
  pyramid); the two heavy poles take their LOD1.
- **The family** `retro` (`families/retro.py`) and **174 recipes** `retro_*` in eight groups; the page's **Retro**
  tab first in its bar, its groups as chips; their kept pictures in `Content/Studio/Props/thumbs/`; before and after
  sheets in `docs/prop_sheets/2026-11-08_retro_*.jpg`.
- **After** (made at the thumbnails' 1024; the recipes' 2048 ones double the density): every material of all 174 has base colour, ORM and normal (0 of 232 had them); the gaps against the bar went from 1,565 to 594; texel density up in every group (camp 319 to 1,278 px/m, the gas station 142 to 1,024, the trees 397 to 848, the rocks 45 to 100: a 5 to 8 m rock on one texture); roughness now varies (0 to 0.02-0.07 spread), relief in every normal map, no texel black (the darkest 0.000 to about 0.05). What's left against the bar is mostly what scale and the pack's own look decide: one texture over a 10 m road or wall can't reach a prop's density, concrete and asphalt at 0.9 roughness sit just over the bar's 0.88, the pack's blacks a shade under our darkest, its palette more saturated than ours (kept: it's the pack's). Godot 4.7 imports them as they should be (GDPROPS on 22 of them: materials, cut-outs, glass, the glows).
- **Found on the way**: Blender turned every 16-bit PNG linear when read (all the shelf's ambientCG normal maps): the
  sets' normal maps had been tilted about 37 degrees wherever a family laid one (cedar_real's bark measured 42 degrees
  of mean tilt, 7 once fixed); fixed in `paint.read_image` (LESSONS). Every tree recipe lays a bark set and the
  realistic ones a leaf set: their kept pictures are of the old make; `python tools/propgen.py thumbs <the tree family's
  names> --make` on the user's machine renews them.
- **Notes for before a game ships** (in the audit): Light_Sign says V-Power Racing (Shell's), the cooker carries
  INMETRO's mark, three gas-station posters are real campaign posters, the conifers' cut log ends are a Textures.com
  texture.

Worth doing next, if the user wants: the ice box's lid as a part that opens (a `container` in play: the pack has the
lid as its own file), the trees' billboards as a far LOD in Godot, a tiling material for the road and wall kit pieces
(one texture over 10 m can't reach the props' density), the posters and the V-Power sign swapped for our own pictures.

## Where it stopped before (2026-11-07, night, `claude/optimistic-tesla-q01qg6`): Tutorial v2, Room 304

The user asked for "tutorial v2": a hotel floor modelled in the scene builder, then the story built by hand in Godot
with the Look plugin (not the Director), using every aspect so far (DECISIONS 2026-11-07, night). Built:
`guides/tutorial_v2/index.html` (23 sections, 20 pictures), the set `hotel_floor` (`layout.py` writes its
`layout.json`), the grown starter kit (`guides/first_game/starter/`: story, sound, room_tone, event_area, pickup, note,
flashlight, light_shy, lights, reach; door, scare_area, player, interior extended), a door's `locked_by` in the
interior export, `godot_byhand.py new` with `sfx/` and `music/`, and TUTORIAL2 (`python tools/godot/tutorial_v2.py
[--pictures] [--keep DIR] [--reuse]`, the desk's server running: the game built as the steps say and played through
headless, every step checked).

- Checks: TUTORIAL2, FIRSTGAME, CHECKS and EXPORTS ok.
- Her pictures are a stand-in figure: no Character Studio export on this machine. With `_studiotest` (STUDIO) or
  another export, the check uses it.
- The rain barely shows at night in a software-rendered picture; a look on the user's card would say more.

## Where it stopped last (2026-11-07, `claude/optimistic-tesla-q01qg6`): a motel game's list, the flashlight's plan, jump scares

**The question.** The user asked what a horror game set in a motel lacks with our mechanics, and whether a light can be
dimmed for a while by drag and drop when a quest and an event line up.

**The light answer.** A moment (WHEN, ONLY IF quest X, THEN Light) picks one light by its node's name, and *The lights
die* darkens a room for a moment. But **dim and flicker never go back**: `on` leaves a light at 35% or still
flickering (play.gd `light`, runtime.js `light`). *The lights die* turns every light in the room on after, and a
Director state's light isn't let go. `loop_hall`, `cut_away` and `stalker` are in the panel's palette but Godot only
logs them.

**The user's answers** (DECISIONS 2026-11-07): items 7 and 10 dropped, the rest a list. Three docs, none of it
built:
- **docs/HORROR_TODO.md**, the list:
  - 0 lights that dim and come back, first;
  - 1 the walkway that loops, 2 an analogue phone, 3 CCTV, 4 numbers and signs, 5 hiding under the bed and behind the
    shower curtain, 6 the door tried from outside and its chain, 8 the motel's machines alive, 9 being heard;
  - 11 and 12 the flashlight, 13 jump scares.

  At its top, **the prop standard**: every new prop a customizable prop generator recipe (PROPGEN §25, as the cans
  are), with a table of the new props.
- **docs/FLASHLIGHT_PLAN.md**: batteries, a bulb's or an LED's curve, flicker; `lit`, `flashed`, a cast member's
  `beam` reaction; the Director's *Feels the light* card. Waiting on the user's yes.
- **docs/research/jump_scares.md**, the research:
  - the designers' rules: the threat over the hit, the player finds the scare, repetition kills it;
  - fifteen scares taken apart;
  - the startle's numbers: the attack matters more than the loudness; a sound 30 to 500 ms before the hit cuts it by
    up to two thirds, so the last half second is silent;
  - pacing, and players' settings with the flash limit.

  Its §8 is HORROR_TODO 13: sound that can go quiet, a better "seen", scares that wait for the eye, figures that move
  unseen, chance and spacing, the flinch, settings, a scare log.

**Found while answering:**
- the `music` action only logs, on the desk and in Godot: no music or room tone plays in play, so there's no silence
  to make before a sting;
- `hud.gd` `shake()` is empty;
- the tape shader has `glitch`, `tracking_error` and `dropouts` with no story word to drive them.

**Next, if the user says yes:** HORROR_TODO's order (0, then the flashlight, then the small ones), each with its
TestRoom001 station.

**Then "go for it"** (DECISIONS 2026-11-07, later): HORROR_TODO 0 built.
- **The words:** `light` `to`, `secs`, `over` (not `fade`), `mode`, `normal`; a timed change laid over the light's own
  state (play.gd `light_k`, runtime.js `lightK`); `lights_die` `light`, `order: "toward"`, `gap`.
- **The Director:** a state's light let go; the cards *A light dims* (`{light}`, build_tab.gd `nearest_light`) and
  *The lights die one by one*.
- **The desk:** the quick beat *A light dims*.
- **TestRoom001:** stations 4 and 5.
- **commands_json.mjs** no longer makes an example without its command's verb.
- **Checks here:**
  - CHECKS, DESK, CMDS, DIRECTOR, GDPLAY and FROMDESK ok.
  - GDTESTROOM ok through station 12 and from 14 to the end. Station 13 fails the same on the code before the change: the
    suitcase's and closets' made meshes aren't in a fresh container (`propgen.py make ... --library` needs Blender).
  - Station 6 needs the desk's bake (`node tools/godot/bake.mjs --game TestRoom001`, the desk's server running) for
    Aoi's skin, as before.
  - GDTESTROOM `--from n_power` fails at the hand-placed mains light on the code before the change too (it wants the
    run from the start).

  - The desk: TESTROOM ok through station 12 and from 14 to the end, PLAY ok.

**FLASHLIGHT_PLAN §1 built** (the flashlight on batteries):
- the curves in `tools/shared/torchbeam.js` and `tools/godot/addons/horrorstudio/torch_beam.gd` (DESK tests the curves);
- the battery on torch.js's Torch and play.gd's torch: the drain, `low`, `dead`, `rest`, the change by itself, the story's
  `dim`, `drain` and timed `flicker`;
- batteries (`battery` items) into the pocket;
- the pause menus' charge and *Change the batteries*;
- the conditions' `torch` low/dead/changed and `charge`;
- the Director's Flashlight fields and Batteries card;
- TestRoom001 station 10 (desk and Godot ok).

Not yet: its props (1f), the change's own sounds, `game.torch_meter`.

**FLASHLIGHT_PLAN §2 built** (characters that feel the light):
- `beam_watch` and `beam_at` on both runtimes;
- the cast's `beam`, the `beam` action, `lit`, `flashed`, the sight's `torch`, `near`;
- the Director's Feels light rows, the People cards (a card kind `actor`: build_tab.gd `set_actor`, `actor_landed`,
  plugin.gd `pending_actor`) and a Reactions card dropped on a character (`_lit_moment`);
- TestRoom001 station 10 (desk and Godot ok).

Not yet: `in_light` and `avoids` (2c).

**Checks here for the three steps:**
- CHECKS, DESK, CMDS, DIRECTOR, GDPLAY, FROMDESK (Pilot) ok.
- TestRoom001 station 10, desk and Godot, ok.
- `from-desk TestRoom001 --force --play` fails at WALLS (2) and at station 4's fitting bulb ("the export shouldn't make it a
  light source"). It fails the same on the code before 2026-11-07 (2fecbeb), so it was already broken: worth a look.

**HORROR_TODO 13.1 built** (the sound that can go quiet):
- **the moods:** the story's `music` words as beds made from the score room's cues by `tools/score/moods.mjs` (calm
  `close_moment`, uneasy `house_creaks`, dread `dread_drone`, chase `chase`), at −20 LUFS in
  `Content/Studio/Music/moods/` (a game's own `Music/moods/` over them), copied into every export's and Director
  project's `game/music/`; MOODS (check_all);
- **the players:** Godot's `beds.gd` on the main scene (the Music and SFX buses made when missing), the desk's
  `play/beds.js` (`BEDS`, served at `/music/<G>/<mood>.ogg`); looped, equal power crossfades, the run keeps its mood,
  on the play's clock;
- **the words:** a room's `tone` and `game.tone` (a loop off the shelf, `none`), the `hush` action (`back`), the
  jumpscare's `quiet` and `game.quiet`; the check knows each; the commands *Music* (its crossfade) and *Hush before a
  sting*;
- **the Director:** HSRoom's Tone, HSGame's Tone and Quiet, from-desk carrying them; the guide's paragraph;
- **TestRoom001:** the game's `room_tone_01`, the corridor's, the atrium's hum, the yards' wind, the dark room none;
  station 15's hush after the run, station 16's jump scare `quiet` 1.5.

- **the desk's editors:** the Database's Sound rows (the game's room tone, its quiet), the scene builder's room `tone`.
- **Checks here:** CHECKS (MOODS in it), DESK (the beds' numbers: the hush's curve, the crossfade's power), CMDS,
  DIRECTOR, GDEXPORT, GDPLAY, FROMDESK (Pilot) ok; GDTESTROOM and TESTROOM ok from station 10 to 12 and 14 to the end
  (13 needs the made props, as before), PLAY ok.

Not yet: the shelf's stings measured for their attack (13.1's last line); the rest of 13. On the user's machine, a
listen: the moods' levels under the game (music −6 dB, room tone −22 dB: `beds.gd`, `play/beds.js`) are set by
measurement, not by ear.

## Before that (2026-11-06, last, `street-nature`): the rivers scrapped, the foliage and rocks kept as props

The user (DECISIONS 2026-11-06, last): "Scrap the rivers, keep all the foliage and rocks you made as props to generate.
I'll use them for gardens." Done: the street builder's river kind is gone (its bed, water, stone and concrete banks,
white water, falls, rocks in it, the page's River and its inspector, the fixture's river), with the three river streets
and the park; paths, steps, banks (grass, soil, moss, a level strip), the ground's hills, flats and covers, scatters,
the bridges, lamps, boards, log rails and stone walls, the smooth ground and the lawn tiles stay; the two step streets
stay (`docs/street_sheets/2026-11-06_steps_two.jpg`). The props the user will use for gardens: the blade plants and the
realistic trees (PROPGEN §18) and the rock family (§28, docs/research/rocks.md), all recipes in presets.json with
their thumbnails; on their machine `python tools/propgen.py make hakone_grass hakone_green sedge_evergold flax_bronze
fern_clump reed_clump meadow_tuft rock_boulder rock_mossy rock_basalt rock_sandstone rock_slab stone_river
stone_river_wet rocks_cluster pebbles_river --library` (the trees as before).

Worth doing next, if the user wants: more garden props (a stepping-stone row, a stone lantern, a tsukubai basin, a
bamboo fence, more rock kinds), the moss as cushions rather than paint, a grass PBR set of our own for lawns.

## Before that (2026-11-06, `street-nature`): the street builder outdoors, five photos matched

The user's ask (DECISIONS 2026-11-06): a nature park update for the street builder on the branch `street-nature`,
with the acceptance that each of five photos is re-created 1:1 in our style (rivers included, no water shader yet).
Built: docs/STREET_NATURE_PLAN.md, then STREET_BUILDER §7d: roads of a kind (path, steps, river) with banks, the
ground's hills, ridges, noise, covers and far grid, scatters, the new things and fences, the overcast time, the
page's palette, inspectors and map for them; the prop generator's blade plants (PROPGEN §18: hakone_grass,
sedge_evergold, flax_bronze, fern_clump, reed_clump, meadow_tuft, hakone_green); `shotfit.mjs` (a shot's camera from
its pins; a pixel cast onto the street); the five streets `garden_steps`, `shrine_steps`, `river_town`,
`mountain_stream`, `park_brook`, each with its shot `photo` pinned (STREET ok: 0.3 to 1.5% of the frame); the
drawings in `docs/street_sheets/2026-11-06_nature_five.jpg`. The photos are in each street's `refs/` on the cloud
machine only (git-ignored): paste them into the shots on the user's machine (the page's Photo…) to see the overlays.

Checks run here before the push: STREET (the outdoors fixture and the five streets' pins), STREETPAGE (a river, a path
and a scatter on the page), GDSTREET on `garden_steps`, `park_brook`, `mountain_stream` and `shibuya_lane` (Godot
installed by `tools/godot_setup.sh`: a body stands on a river's bed, on a flight's treads, on a path), PROPGEN and THUMBS
after the tree family's change. GDSTREET found the mountain town's houses in the terrain's noise and on the road behind
them (LESSONS): a bank now holds its level to its end, and `terrain.flats` (areas held level) carry the town's floor.
The props were made here with Blender's module
(`tools/retarget.py setup`); on the user's machine `python tools/propgen.py make hakone_grass sedge_evergold
flax_bronze fern_clump reed_clump meadow_tuft hakone_green camphor_real zelkova_real cedar_real cherry_real
small_hornbeam_real shrub_real grass_tuft --library` puts them in the library (the stand-ins show until then).

Worth doing with the user: look at the five overlays with the photos pasted in; the river's shader in Godot (their
next step, said so); clouds in the sky; a forest cover with more than one tile; the canopy scatter as real trees where
near; a stair street between houses; GDSTREET on every nature street.

## Where it stopped last (2026-11-06, later, `gameplay-enhancements`): exterior stair stacks

The user's ask (DECISIONS 2026-11-06, later): three photos of Japanese exterior stairs, "I want a system for building
these kind of stairs". Built in the street builder (STREET_BUILDER §5c): the `stairs` part's `floors: [a, b]` climbs
the building's floors a stage a storey, `form` zigzag (one flight a storey, crossing in an X, landing at alternate
ends: the danchi's), straight or dogleg (two flights a storey, a half platform: the tower's and the mid-rise's),
`style` concrete or steel, `rail` pickets, panel (solid, rounded corners, a handrail), parapet, pipe or none,
`shaft: "walls"` (side walls, thick floor slabs), `gap` m beyond a walkway whose railing opens where the landings
meet it (`stackCuts`); `stackLayout` in street-gen.js is one function for the geometry (`stackGen`) and the colliders
(a ramp a flight, a box a landing, the walls). The page's stairs inspector (up the building's floors, form, rail,
shaft, off the wall), *+ walkway and a zigzag stair* on an inside building, the danchi preset's stair a stack. STREET
builds every form × style × rail × shaft, beside a walkway and not, and its rules street has a zigzag beyond a
walkway; the reference street `danchi_court` has the three photos' stairs with a shot of each (pictured by Godot in
`Saved/Streets/danchi_court/godot_<shot>.png`). The clipping rule took most of the work, and the first zigzag (both
flights in one lane, crossing) needed offset after offset to pass it until the photo was read again: a scissor
stair's flights are in two lanes, so the lower flight's railing clears the flight above; then the hacks went and
the rest was a parapet outside the treads, bars ending inside posts, posts 12 mm off the stringers' ends, the
flights' rail line the landings' (LESSONS).

**The polish pass** (the user: "the rails don't align with the top but poke out; go through everything"): close
shots of every stack showed the rails and the steel stringers one riser high (built from the first tread's nose, not
the floor), pickets floating over the treads and landing in risers' planes, no beam under the landings for the
stringers, a sawtooth soffit under concrete flights, panels floating 10 cm over the treads, a rail bar's end against
a post's face, columns rising past the last landing at their end: all fixed. Then the user's red line over the
picture ("the standard for your refinement is weak... one straight edge from the foot to the landing's corner,
nothing stepping above it; create these ideal angle overlays, then work on your stair maker until you accomplish a
clean look"). Done in three parts (STREET_BUILDER §5c's details): (1) **the rails rebuilt as bands** cut vertically
at their ends, every end one of a few kinds (a flight's rail runs into the landing's in one line through a post
under the joint; a foot's post under the band, cut to the slope; a free end's capped post the band butts; the well
corner at every landing's inner edge: capped posts on the slab's edge with a cross band, cross panel or cross
parapet; the columns as the landings' corner posts, flush with the slabs); the dog-leg's inner flight got its well
rail, a lane beyond a walkway its inner rail; (2) **the line rule as a check**: `stackLineFaults` builds a stack
alone and lets no vertex stand 4 mm above the rail's top line over its flight or landing; STREET holds every form,
style, rail and shaft to it, and the single flights, which are now one-stage stacks of the same system (`stackOf`:
the older streets' concrete flight and the motel's switchback laid out where they were); (3) **the overlays drawn in
the scene**: `stairlines.mjs` puts the ideal lines into the street page as thin red bars through `streetshot.mjs
--lines`, hidden where the street hides them (a flat projection showed hidden lines through walls and couldn't be
judged), so the red lies on the edges or shows what stands above:
`docs/godot_sheets/2026-11-06_stair_lines.jpg` has the four close shots. The kit's interior stairs got the straight
rail on the inner-corner line too (KIT.md §11, the kit VERSION 8; GDTESTROOM ok on it). STREET ok, GDSTREET on the
stair street and the motel, the Godot pictures made again (`2026-11-06_stair_stacks.jpg`).

**Known here:** STREETPAGE (`node tools/director/streettest.mjs`) fails in this cloud checkout on a 404 for
`shibuya_lane/refs/shot_photo.webp`, the Shibuya shot's reference photo, which `refs/` keeps out of git; the page
itself opens every street clean (a probe with a 404 logger), and the stairs inspector's stack fields and the zigzag
walkway button were driven in a browser. It passes where the refs are (the user's machine).

**Could come next:** the kit's interior stairs held to the same line rule as a check (today by eye on the
`2026-11-05_stairs.jpg` sheet: their rail is on the line, their posts and ends are the older kind); floor numbers by
each landing (a texture: the sign parts' way); the danchi's curved canopy; a stack as a kit thing for interiors (the
same layout indoors); the Blender bake's finishes on a stack (the steel's paint, the concrete); a GDSTREET walk up a
stack (today it checks the colliders are there); the walkway's railing opened for a dog-leg's floor landing too.

## Where it stopped last (2026-11-05, night, `gameplay-enhancements`): stairs, floors, climbing

The user's ask (DECISIONS 2026-11-05, night): a branch `gameplay-enhancements`; model different types of stairs
(outdoor motel stairs, apartment stairs, interior stairs); the interior builder supporting multiple floor levels; and
going up and down stairs in Godot without bugs, feeling good. Built:

- **The kit's `stairs`** (KIT.md §11, `tools/director/kit.js` `stairsGen`, `stairsBoxes`; kit.py `STAIRS`,
  `stairs_boxes`; the presets `stairs_house`, `stairs_house_open`, `stairs_apartment`, `stairs_motel`, `stairs_steel`;
  the slots `concrete`, `checker`; the kit maker's new Stairs category): one flight with treads, risers, stringers or a
  slab, rails (balusters, pickets or a pipe on posts), a wall rail and a landing, the box `top` m on above the top
  tread. **Its collision is its steps**: plan.py gives the mesh `hollow` and adds `collider` pieces (unseen, solid:
  stage.js, Play's `blocks()`, godot.py, levelexport); KIT compares kit.js's and kit.py's boxes.
- **The street's outside stairs** (`street-gen.js` PART_KINDS.stairs `style`): `steel` (the motel's) beside `concrete`;
  the walkway button makes steel; `hill_motel` restyled; STREET's no-clipping rule met (pans inset in the channels,
  pickets between the rails, the rails stopping short of the landing's own post).
- **The scene builder** (builder.js `renderFloors`, `fitStairs`, `setFloorZ`, `copyFloorUp`; builder-model.js
  `stairsProp`, `doglegProps`, `STAIR_PRESET`, `STAIR_ROT`, `STAIR_TOP`; the room words `stair`, `landing` in
  ROOM_KEYS and STORY_FORMAT): floors named by level, added above or below, a floor's height set, a floor copied up,
  removed; a stairs room's style and landing; straight flights and dog-legs as kit stairs.
- **Climbing** (play.gd `push_out`, `ground_at` with `SUPPORT`, `glide_step`, `eye_pos`, `ability_steps`; runtime.js
  and steps.js the same): the contact-point rule, the feet's 6 cm reach, the eye's glide, a footfall a tread
  (GODOT_EXPORT §7). A numeric simulation first showed the old rule stuck at the foot of a steep stair.
- **TestRoom001's station 19** (`n_stairs` between `n_talk` and `n_hide`: the stairwell, the gallery, the back stairs,
  the back room; gdtestroom.gd `turn_to`, `climb`; testroom.mjs `turnTo`, `climb`): passes in Godot (GDTESTROOM from
  n_stairs) and on the desk.
- Fixes on the way: the level check lets hollow things stand in a doorway's clearance; the shots sheet keeps a room's
  entrance camera 0.3 m off its walls and ignores hollow boxes; LESSONS has the gap-under-the-feet lesson.

**Then, the same night (DECISIONS 2026-11-06): stairs from points.** The user: "a smart system where the stairs aren't
pre-defined but you select end + start points or start + mid + end points and they get generated to our rules."
Built: the `stairs` prop (STORY_FORMAT §2: `from`, `to`, `via`, `w`, `style`, `turn`, `rail`, `wall_rail`), the layout
in kit.js `stairsLayout` and `storykit/stairs.py` (KIT compares five cases), the `winder` kit type (`winder_house`,
`winder_apartment`) with its collision cells, the plan's `stairs_pieces`, the story index's box from the layout, the
story check's rules, the scene builder's Stairs tool (`stairsPoint`, `drawStairs`, the inspector; BUILDER drives it),
TestRoom001's two stairs redrawn as points (a half turn with a platform, an L with winders), the motel's switchback
(`turn: "u"` on the street's steel stairs part: two flights along the end wall, the platform, two ramps and the
platform as colliders). KIT.md §11b has the rules. On the checks' way: the kit's `top` allowance clamped by what
the risers need (a winder's treads stood 7 cm high: kit.js `stairsTop`, `winderTop`, kit.py the same; the kit VERSION
7), the desk's climb test timing its frames as the runtime does (a false 4 cm jump under load), the preset's floors
copied into the model (the builder test's reopen waited forever), a clicked stair's selection carrying its room under
its own key (`stairsRoom`: with `room` the inspector showed the room and Delete took it), and BUILDER's Stairs-tool
step in a stair hall it adds to the house (the house's 0.91 m stairs room can't turn); LESSONS has the first three.

**Known before this branch:** FROMDESK (`godot_director.py from-desk TestRoom001 --force --play`) fails at station 4
on the branch's base commit too (the power bulb's fitting: the desk conversion makes the light a Light3D source; the
conversion never learned light fittings, GODOT_EXPORT §3b): its WALLS check passes with the stairwell's rooms, and
the other Godot checks (GDEXPORT, GDPLAY, GDTESTROOM, DIRECTOR, GDSTREET) pass here.

**Could come next:** the desk conversion's light fittings (above); winders at a half turn (six fan treads round the
well); a spiral from the same fans; the points dragged on the plan; the street's stairs from points too (the kit
drawn in the street's own geometry); a stair's own railing round a stairwell's
opening in the floor above (a room's floor with a hole); `HSStairs` for the Director (a flight from numbers in GDScript
with step colliders, for a world built by hand in Godot); the dog-leg's landings railed along the well; the kit stair
drawn in the street builder's own stairs part (one generator for both); a slower walk on stairs if the user wants it
(`walk.stairs`); pictures of the stairs in the guides.


## Where it stopped last (2026-11-05, later, `sakura-rabbit-research`): suitcases, closets, moveable things, books, the CRT

The user's ask (DECISIONS 2026-11-05, later): note candidate 9 (the CRT) to do; more research on simple games that
build to a story, uncovery and dread; and, as props with workable systems in the drag-and-drop engine: suitcases that
open and hold things (three kinds), sliding and hinged closets, a drag-and-drop moveable (a chair shoved when walked
into, picked up upright, placed facing as held), books opened in the hands with handwriting and a clearer panel at the
right, their text progressing with the game; inspecting as it was. Built:

- **Research:** docs/research/dread_structure.md, story_in_objects.md, simple_loops.md (the rules, the numbers, a
  dread curve by the minute, a six-night plan, the book that writes itself).
- **Parts that open** (PROPGEN §26): a made prop's lid, doors or cover cut out of its game mesh as glb nodes of their
  own at their hinge or track (`th.assemble`, `th.part`, `th.inside`; `propgen_part` extras), the prop placed by its
  size shut; families `suitcase` (hardshell, softside, vintage), `clothes` (folded, a stack; the hanging ones scrapped),
  `closet` (a wardrobe, a sliding closet, an oshiire); the openable `book` (§27: `journal_diary`, `_notebook`, `_jp`,
  pages baked blank); the twelve in the library with kept pictures; the OFL hands in `tools/propgen/fonts/` and the
  runtime's `fonts/`. The bake fills missed texels (`fill_misses`). The garments on wire hangers (three recipes, and
  four on each closet's rail) were scrapped at the user's word: "the clothing on the hangers looks bad".
- **The words** (STORY_FORMAT): uses `open`, `container`, `moveable`, `book`; triggers `opened` (holds), `closed`,
  `placed`, `taken`, `moved`, `read` with `page`; the action `open` (to open, shut, lock, unlock). Godot's add-on:
  `parts.gd`, `book.gd`, play.gd's containers (contents kept as children through closing and carrying), moveables
  (a RigidBody3D shoved by the walk the player asks for, blocked or not; picked up upright; put down where the look
  meets the floor), hiding in a closet (its doors round you); the desk's Play the same (`openable.js`, `book.js`:
  the fork's report in this session); the Director's parts Opens, Container, Moveable, Book (GODOT_DIRECTOR §3c; a
  book's text typed with `===` between pages and `@if` lines), its words in the Story tab (`story/commands.gd`); the
  story check and its walker know them all.
- **TestRoom001 station 13** (docs/games/TestRoom001.md): the things room behind the library; played in Godot from
  the library station to the end (GDTESTROOM from `n_things`: ok). A library prop at its real size is
  `shape: "asset props/<name>"` (`art` dresses a block: LESSONS).
- **The CRT screen** (the look plugin's `crt.gdshader`, `HSCrtScreen`, its preset; GODOT_LOOK): the fork's report in
  this session says what it measured.

What was still running or open when this was written (see the last commits' messages for how they ended): the full
GDTESTROOM from the start on this cloud machine needs the test room's bake (`node tools/godot/bake.mjs --game
TestRoom001`, the desk's server up) for the kitchen station's skin check, which a bare clone hasn't got; the DIRECTOR
check after `commands.gd` learned the new words; THUMBS and PROPGEN after the last remakes; the browser checks (TESTROOM
with station 13, DESK, CMDS, LOOKPLUGIN with the CRT) are for the user's machine (`GPU=1`).

Worth doing with the user: play station 13 in Godot themselves (the chair's shove strength, the book's hand and
size, the panel); a suitcase's `holds` and where things land in it; the CRT on the kitchen TV; then the candidates
still on the Sakura Rabbit list.

## Before that (2026-11-05, `sakura-rabbit-research`): Sakura Rabbit's experiments as candidates

The user's ask (DECISIONS 2026-11-05): a branch of its own and research into Sakura Rabbit's Unity experiments that
would suit our look, clothing by shaders first. The note is docs/research/sakura_rabbit.md: ten candidates ranked
(hosiery painted by the skin shader with stretch and the band's squeeze; wet clothes; wrinkles that move; dissolve
transitions; contact deformation; the room that changes; snow; fabric detail maps; a CRT screen; heels and lids), each
with what she showed, the likely how (inferred: nothing is public), what we have and what we'd build; §12 the order that
pays soonest. Nothing is built; nothing of hers is usable (learning-only files).

Worth doing with the user: pick the candidates (or none, and move on to other research, as they said); if they want the
articles read in full, allow 80.lv, hitmarker.net, unity.com, 3dvf.com, sakura-rabbit.fanbox.cc and learn.u3d.cn in the
cloud environment's network settings (the session could reach GitHub only) and re-read the note against them.

## Before that (2026-11-04, after the wood, `claude/festive-euler-o7axpl`): the flat's curtains, bare chairs, a cleaner street

The user's ask (DECISIONS 2026-11-04, after the wood): the prop generator's curtains in the map, the chairs without
their cushions, the bicycles and bins off the street, the folded futon out of the oshiire.

- **Curtains made for each window** (PROPGEN §22): `curtain_maison_bedroom` (blackout, blue-grey, a little below the
  sill), `curtain_maison_living` (linen to the floor), `curtain_maison_washitsu` (a white sheer to the sill), set down
  in the layout from their `box_m` (SCENE_BUILDER §10d) in place of the kit's, at seeds that hang clean (LESSONS: a
  pucker that stays put is the seed's); **hollow** (the family's `HOLLOW = True`, the library index's `hollow`,
  storykit/plan.py's tag: no collider in the exports or Play, out of LEVEL's overlap test).
- **The chairs bare**: `chair_desk_oak` and `zaisu_walnut` with `cushion.on: false` (their pads kept); the bedroom's
  desk, chair and lamp 10 cm further from the window.
- **The oshiire empty**; **maison_lane** without its two bikes and two empty plant pots (the "bins").

Worth doing with the user: plants in pots by the entrance if they want the corner dressed again (`plant` family,
`props/pot_*`); a lace behind the bedroom's and living room's drapes (a second, sheer curtain on a rail nearer the
window: the two simulated apart, so their folds would need a gap between rails).

## Before that (2026-11-04, latest, the same branch): real wood in the flat

The user's ask (DECISIONS 2026-11-04, latest): the flat's wood floors looked fake; the latest tables and chairs with
wood textures in the interior, and a custom PBR for Japanese wooden floors as real as the imported sets.

- **Our own wood sets** (`tools/woodpbr.py`, ASSETS §6; WOODPBR in check_all): `pbr/floor/FlooringOak001_2K-JPG`
  (light natural oak sheet flooring, 2P: 303 x 1818 mm sheets of two boards, staggered), `FlooringOak002` (stained),
  `FlooringBirch001`; `pbr/wood/WoodOak001_2K-JPG`, `WoodWalnut001_2K-JPG` (edge-glued furniture panels). 2K JPGs in
  ambientCG's names, each board its own cut of a log, tileable, the floors' boards found as cells.
- **maison_1f** (SCENE_BUILDER §10d): the wood rooms' kit planks wear `FlooringOak001`, laid by its cells; the
  bedroom's `desk_oak` and `chair_desk_oak`, the living room's `zataku_walnut` and `zaisu_walnut` (new recipes, in the
  library, their pictures kept) replace the kit's desk, dining chair and low table; the bed's frame and the genkan's
  step in `WoodOak001`, the TV board and the tokonoma in `WoodWalnut001`; a bigger rug. Godot's pictures:
  `Saved/Godot/_map/maison_1f/shots_day/sheet.jpg` (before: `shots_day_before/`).
- **A kit's `mats` in a layout file** dress it now (`builder-model.js` `presetToModel` puts them on the thing, where
  Paint keeps them): they had sat in its spec, read by nothing, so the flat's curtains never wore their colours.

Worth doing with the user: walk it in Godot and say whether the floor's tone and gloss sit with the plaster and the
tatami; `FlooringOak002` or `FlooringBirch001` are a word away (a room's `_fx_floor` mats); more woods (ash, cherry,
pine, a wide-plank floor, a parquet) are a few numbers each in `woodpbr.py`'s SETS; the kitchen could take a small
dining set (`table_*`, `chair_*` with `"pbr": {"wood": ...}`).

## Before that (2026-11-04, later night, the same branch): customizable props previewed in the picture editor

The user's asks (DECISIONS 2026-11-04, night and later night): the café chair a stool, cushions toggleable, every
prop's picture pre-rendered; then, more exactly, customizing only the props meant to be (cans, books, appliances'
fake brands) with the uploaded picture previewed in the picture editor before it's made.

- **`stool_cafe`** (was `chair_cafe`): a bentwood stool; **`cushion.on`**: false keeps a chair bare with its pads'
  settings (the switch in the cushion box's title); a cushioned chair's card shows it without them too.
- **Every recipe's picture kept** in `Content/Studio/Props/thumbs/` (PROPGEN §25), the cards' before anything is made.
- **Customizable families** (`CUSTOM = True`: can, bottle, cup, box, sheet, book, pills, appliance, charm, ware): ✎ on
  their cards and a filter; in the picture editor **Its picture** shows the prop's own rendered picture with your
  pictures laid on it (the sticker passes beside every preview: `stage.py`, `page/preview.js`, toned by `tone.py` /
  `page/tone.js`), live, before Make, and before it's made here at all from what's kept of it (its parts, slots and
  paint at 512 px: `serve.py kept_meta`). THUMBS in check_all; PROPPAGE drives it on a made ema and a kept can.

Worth doing with the user: their own labels on the cans, books and the rice cooker's lid, then Make, and the made
prop against what its picture showed; whether more families are customizable (`CUSTOM = True` in a family's module,
then `python tools/propgen.py thumbs --make <its recipes>`); a closer preview (the passes are half the preview's size:
a rice cooker's lid logo is small in them) would mean rendering them at full size.

## Before that (2026-11-04, evening, the same branch): tables, chairs and their cushions

The user's ask (DECISIONS 2026-11-04, evening): research first, then table and chair generators, cushions by the
cloth, the prop generator's page for them and on the dashboard.

- **The research** (docs/research/tables_chairs.md): table bases, sizes, tops and edges; game furniture mid-poly
  (chamfers, weighted normals, a bake of the rounded copy), UVs along the grain; wood's micro detail as bumps under a
  set of your own; chair styles and sizes; cushions filled by pressure, simulated dense, a light mesh baked from it.
- **The `table` family** (PROPGEN §23) and **the `chair` family** (§24) on `families/furniture.py` (board, turned,
  bent, top; the wood's colour and flaws) and `families/cushion.py` (pads to any outline). Fifteen recipes in the
  library: `table_dining`, `table_farmhouse`, `table_midcentury`, `table_trestle`, `table_pedestal`,
  `table_chabudai`, `table_kitchen_painted`, `chair_dining`, `chair_ladderback`, `chair_windsor`, `stool_cafe`,
  `chair_school`, `stool_kitchen`, `bench_wood`, `zaisu_lacquer`. PROPGEN's cases `table_farmhouse`, `chair_dining`.
- **The page** reads a family's `FIELDS`, `CHOICES` (nested by dotted keys) and `LABELS`; the curtain family has them
  too. **The dashboard**: the prop generator among the start tiles; its page on port 8799 now (8797 is the face mocap
  page's: they couldn't both run).

Worth doing with the user: lay their own wood sets over the tables and chairs (`"pbr": {"wood": "pbr/Wood/<set>"}` in
a recipe, or the page's PBR picker on the material `wood`; `rot` 90 if a set's grain runs up its picture) and see the
flaws hold under them; put the chairs and tables in the maison flat in place of the kit's (the kitchen's dining set,
the bedroom desk's chair); more styles are a few lines each in `chair.py` `_build` or `table.py`'s STYLES. The
bedding's long hem islands still hold its textures to about a third of a texel a millimetre (LESSONS, the curtains).

## Before that (2026-11-04, afternoon, the same branch): a curtain generator

The user's ask (DECISIONS 2026-11-04, afternoon): a curtain prop with "a bit of drape physics", one panel or two, made
from the window's width and height; research first for the easiest technique.

- **The research** (docs/research/curtains.md): what makes a curtain read (the heading sets the folds at its fullness,
  they relax toward a heavier hem, stack-back, tie-backs, the length), three ways (simulate from flat, shape by
  numbers, or shape it and let it settle) and the one chosen: the hung shape from the heading's own geometry, then the
  prop generator's cloth settled with **tethers** to the heading (long range attachments: the cloth can't stretch)
  and a tie-back as a ring drawn in.
- **The `curtain` family** (PROPGEN §22, `tools/propgen/families/curtain.py`; `sim.Cloth.step` takes a caller's own
  constraint, `extra`): `window`, `sill`, `panels` (1 or 2, `side`), `heading` (pinch, wave, grommet, gather, flat),
  `length` (sill, below, floor, puddle, mm), `open`, `tie`, `rod` (rail, track, pole, none), `fabric` (sheer, cotton,
  linen, blackout, velvet), `cover`. Six recipes: `curtain_pair`, `curtain_tied`, `curtain_sheer`,
  `curtain_grommet`, `curtain_wave`, `curtain_velvet_old`, in the library; PROPGEN's case `curtain_tied`. About two
  minutes each to make (the 2048 bake).

Worth doing with the user: put them up in the maison flat in place of the kit's curtains (a layout places a library
prop where its `box_m` falls: the window's middle on the wall's face, turned to the room; a Japanese window's usual
pair is a sheer behind drapes: two props, the sheer's `rod.out` 120 and the drapes' 200); a window's own sizes from
the set (the bedroom's 2400 x 1300 over an 800 sill). Making them on the user's machine: `python tools/propgen.py make
curtain_pair curtain_tied curtain_sheer curtain_grommet curtain_wave curtain_velvet_old --library`.

## Before that (2026-11-04, morning, the same branch): bedding for the flat

The user's ask (DECISIONS 2026-11-04, morning): "proper better prop pillows and blankets", then into the map.

- **The prop generator's `bedding` family** (PROPGEN §21, `tools/propgen/families/bedding.py`): a cloth simulation
  (`sim.Cloth` in `tools/propgen/sim.py`, the paper's PBD with thickness, self-collision, rounded boxes and a floor
  with friction, pressure for a filled bag, `hinge` rolling a fold round the layers inside it) gives each its form;
  the small folds, the quilting's puff, the stitches and the cover's print go into the detail mesh and the paint,
  baked as every prop's. Six recipes: `makura_sobakawa`, `pillow_bed`, `zabuton_real`, `kakebuton_turned` (on the kit
  futon on tatami), `comforter_bed` (on `bed_single`), `futon_folded`; in the library (the index ships, the meshes are
  made: `python tools/propgen.py make <names>` then `library <names>` on the user's machine, about a minute each).
  PROPGEN's cases: `pillow_bed`, `futon_folded`, `kakebuton_turned`.
- **In maison_1f**: the washitsu's futon with the kakebuton and the makura (its low table and cushion gone for room),
  bedroom 1's bed with the comforter and pillow, the folded futon in the oshiire, the living room's zabuton. Layouts
  place library props (`props/<name>` as a kit), a blanket by its `box_m` over its bed; LEVEL skips a door's
  clearance inside a closet or an oshiire. Pictures: `map_shots.py` with the shots `15_futon`, `16_bed`, `17_oshiire`.

Worth doing with the user: look at the bedding in Godot under their own light (the folds are in the normal maps:
they show under a lamp at a grazing angle more than in the flat day light here); more bedding is a recipe away
(another cover's `pattern` and colours, `mode: rumpled` for a slept-in bed, a `cushion` for a sofa; a blanket for
another support takes its boxes as `on`). The folded futon's layers show dark seams at their sides (the hem's
rounding): a gentler hem if the user finds them too strong.

## Before that (2026-11-04, small hours, branch `claude/festive-euler-o7axpl` from main): the map skill, image 1 as a map

The user's two asks (DECISIONS 2026-11-04), after tsukibii/HorrorEngine#13 was merged:

- **A token-efficient guide for Claude** to build a coherent map with the interior and street tools: the skill
  `/build-map` (`.claude/skills/build-map/SKILL.md` the steps, `reference.md` the formats compact). Its tools:
  `layoutset.mjs --file` (a layout file as a set; `repeat` for storeys alike), `streetsync.mjs` (a street's insides
  read again without the page), `plan_view.py --floor`, `streetcheck.mjs --street`, `tools/godot/map_shots.py` (the
  set in its street pictured by Godot, a contact sheet: MAPSHOTS).
- **The map**: the set `maison_1f` (the user's image 1, furnished Japanese, four storeys alike, the stairs behind a
  locked barred gate; `layout.json` its source, `shots.json` its pictures) in the street `maison_lane` (a lane round the
  block's corner, a curved board-formed concrete wall, an estate and villas behind it, street trees). SCENE_BUILDER
  §10d, STREET_BUILDER §7c. The pictures: `python tools/godot/map_shots.py --set maison_1f --street maison_lane
  --shots Content/Studio/Sets/maison_1f/shots.json` (the desk's server running).
- What the map found in the builders, fixed with a rule each (every older set and game's walls compared before and
  after: identical but where wrong): open plans read back walled by the scene builder's page (so its export walled
  the kitchen off), a corner half filled by another room's wall, openings one over another on a stair shaft (they
  walled up the gate, and the two schools' upper stair arches: LEVEL says *walled up* now), a setback flush on a side
  and a terrace's parapet at its corners (street), the poles' wires, the export's milky glass (12 % now, as the game
  export's). Fences curve (`via`), and the kit has `gate_bars`.

Worth doing with the user: walk the flat in Godot (Exports: `node tools/director/levelexport.mjs --game set:maison_1f`
and `node tools/director/streetexport.mjs --street maison_lane`, the flat at the street's marker
`inside_maison_1_1`, as guides/first_game) and light it by hand; the look's haze is thick across a street (the
balanced preset is tuned for rooms): the far side of the lane greys out by day. The trees are the realistic ones
(the user's ask during the work): `zelkova_real` and `black_pine_real` made by the prop generator (Blender's module,
`python tools/retarget.py setup`, about 25 s a tree) and put in the library; on the user's machine `python
tools/propgen.py make zelkova_real black_pine_real` then `python tools/propgen.py library zelkova_real
black_pine_real` before the street's export, or its stand-ins show (STREET warns). The toilet in the unit bath is a
box (no kit for one yet). BUILDER passed here; STREETPAGE passes but for the 404 that was there before (a PBR set
missing from this machine's shelf), and once its *Fill a street* clashed a drain pipe with a neighbour's rail (the
fill is random: a generator rule still to find).

## Before that (2026-11-03, night): rules, exports, guides

The user's three asks (DECISIONS 2026-11-03, night), each a commit:

- **The editors carry the rules** (no existing map edited): the street generator keeps two pieces apart by
  construction (STREET_BUILDER §5e: the ground under it all, neighbours' parts and roofs half way to each other,
  pavements meeting once, fences joined at corners, things inset, decals over what's under them); the street page's
  **Check** lists what's placed in one plane anyway; STREET builds a street of every old clash (35 with the old
  generator, none now) and warns about the saved streets' placed pairs (the reference town's fences along b41, b42
  and through b47's door; the school's bike racks: the user's to move, or not). The interiors had their rules already
  (plan.py's corners, LEVEL), and check_all runs LEVEL on every set now.
- **Export for Godot** everywhere, into `Exports/` (`interiors/`, `streets/`, `characters/`, a README each): the scene
  builder's new button (`levelexport.js`), the street page's (was Export .glb), the Character Studio's (was Export for
  desk / Unreal: its copy gets MHR's face shapes baked). EXPORTS imports them into a fresh Godot project.
- **The guides**: `guides/godot_by_hand/` (setting up), `guides/look_plugin/` (the Look plugin), `guides/first_game/`
  (a first game: the Bungalow in the hill motel street, a character, the starter scripts in `guides/first_game/starter/`,
  a player that steps up). `tools/godot_byhand.py new|install|exports` sets a project up. FIRSTGAME builds the first game
  as the guide says from the real exports and plays it through; `--pictures` draws the guides' pictures by Godot.

Worth doing with the user: open `guides/first_game/index.html` and follow it on their machine (GPU, the real PBR shelf:
here the sets' textures aren't baked, so the pictures show the studio's colours); the browser checks STREETPAGE and
STUDIO touch the changed pages (STREETPAGE passed here but for a 404 that was there before: a PBR set missing from
this machine's shelf). The Bungalow's garden path stands 45 cm over the street (the set's raise): the starter's player
steps up it; a ramp in the set would suit a player without a step-up.

## Before that (2026-11-03, later evening): walls meeting

The user's lines down TestRoom001's corridor walls (DECISIONS 2026-11-03, later evening): two rooms' wall faces in
one plane, z-fighting, where each room's dividing wall met the corridor. Fixed in `plan.py` (the export, the desk)
and in the Director's `HSRoom` (GODOT_EXPORT §3c), whose floors overlapped in doorways the same way (fixed too); LEVEL
and FROMDESK's WALLS check it. Open: TestRoom001 played as a Director project stops at station 4, its bulb's fitting
(the conversion, `director_desk.py`, doesn't know main's lights with fittings of 2026-10-31: a merge gap, not walls). A desk game's export picks it
up on its next export; a Director project when the plugin is installed into it again (`godot_director.py install`,
or `from-desk --force` for a converted one). Before that, the skin and the clothes (below).

## Before that (2026-11-03, evening): the skin in the game and the clothes in poses

The user, playing main, asked for two fixes (DECISIONS 2026-11-03, evening). **The skin looked uncanny in the game**
(orange rings round the eyes, the nose and the lips, a red ear): the skin's depth layer is now about a third of its
first strength and the lamps' light through thin skin at half (GODOT_LOOK §5g, *Toned down*; the sheet
`docs/godot_sheets/2026-11-03_skin_softer.jpg`); GDPORTRAIT fails a glow now. Nothing to re-export: the look plugin
carries it, so a game's next export (or the plugin copied into a Director project) has it. **Clothes clipped at the
elbows in poses:** the Studio's export now leaves out the skin an opaque garment hides (TAILOR §3d), so a character
needs **exporting again** from the Character Studio for it; the desk's capsules measure the clothes where the skin's
gone. Worth trying in the user's own game: the same character, re-exported, in the poses that showed it. If cloth
still crosses cloth (a shirt under a jacket) or the skin near a cuff, that's next (§3d's last line).

## Before that (2026-11-03, branch `Director-Godot`): animation steps 1 to 7, the Animate tab, the Face page, moves, On stage, paths, reactions, cutscenes

The user tried the Animate tab ("tested and works") and asked to go through the plan's steps in order (DECISIONS
2026-11-03). **Step 2, the Face page, is built** (`tools/facecap`, GODOT_DIRECTOR §6g): the desk's Expressions import
as a page of its own (port 8797, the desk's server loaded as a module so the library's endpoints are shared), Import a
video of a face, the preview on the default MHR or a Studio export, Accept into the library, a loop from a range; **For
Godot** sends the picked faces into a project's `faces/`; the Animate tab's Face side opens it for its project.
FACEMOCAP checks it. **Step 3, a character's moves, is built** (GODOT_DIRECTOR §6g): idle, walk, run, sitting down,
sitting, getting up, talk, listen and look round, set on the Animate tab (a card's menu, her moves' rows, Fill the
empty ones from the library) and played by the runtime by what she's doing, an empty one falling back to another she
has. **Step 4, On stage, is built** (GODOT_DIRECTOR §6g): a quest's line per character in the Story tab (where she
is, what she does, her face, the conversation she offers), carried on until a later quest changes it, the in-between
walked by itself from her moves, Show on stage in the 3D view, chips on Story Flow's cards. **Step 5, paths, is
built**: a path's stops each with a clip (This object lists them; a card dropped on a stop), and walks between places
going through doorways (a spot each side of every door, the brain's `way`). **Step 6, reactions and scares, is
built**: the Reactions cards (turns to look, flinches, screams, points, waves) filled in for the nearest character,
her clip swapped by an Animate card dropped on the area, `anim` played as a reaction (held, turned to the player and
back), the jumpscare's clip, face and sound, a Caught move. **Step 7, cutscenes in the level, is built**: a moment
played as a cutscene (the Story tab's CUTSCENE row and timeline), the runtime's `focus` (a soft lock in a cone, a lean
in and a held focus, the walk slowed, the safety release at its max, its target gone, an ending). The plan's seven steps
are done; next is the user's to say (step 8 is later: FBX and glTF clips, the cast's lanes in Story Flow, PATTERNS_PLAN's
styles), after a playtest of these on their machine.

### Step 1 (2026-11-02, night): the library and the Animate tab

The user asked for an easy drag-and-drop animation system by quest; the plan is docs/GODOT_ANIMATION_PLAN.md, with
their answers (DECISIONS 2026-11-02, night: Kimodo and the desk's face-video tool, face and body mixed in Godot, a new
project's folders empty, cutscenes in the level with a soft lock and a safety release, start with the library, moves
and On stage). **Step 1 is built** (GODOT_DIRECTOR §6g): `animations/` and `faces/` in every project (empty; `new
--sample` brings the sample's two faces, `from-desk` its story's; `godot_director.py faces <project> [id ...]` brings
more), `core/library.gd` reading them, and the panel's **Animate** tab: the clips as cards by role (a Kimodo card
drawn as its own figure, played on hover), a click or a drag onto a character for her idle, her walk, hers for the
story, or a preview in the 3D view (in memory, never saved), a face on her face shapes at the same time. The Kimodo
tab imports into the library. On the way the check found the sample's Kimodo idle had always been one frozen pose
(LESSONS): Mari breathes and looks round now.

Next, in the plan's order (ask first): **2, the Face page** (the desk's face-video import as a page of its own with
Save and For Godot), **3, moves** (a character's slots by role, every behaviour playing them), **4, On stage** (what
each person does during each quest, the in-between played by itself). To ask the user: the Animate tab in their own
hands (the cards, the drag onto a character, the preview), whether a card's figure is enough of a picture or they
want each on a grey MHR body.

## Before that (2026-11-02, branch `Director-Godot`): talk to, the marker, an intro first

After the panel (below), three asks, each checked and pushed (DECISIONS 2026-11-01, evening, and 2026-11-02):
- **Talk to…** as a quest step and a moment's WHEN (the Story tab and the Manager): who, then when it counts (she's
  clicked, heard out, or one conversation heard out); the facts `talked:` and `heard:` by person or conversation.
- **The marker** (a todo's `guide`, STORY_FORMAT §4; Godot's `marker.gd`): a step's *Show a marker over it*, over what
  its WHEN names or a thing, person or area picked. The user then asked for it plainer ("the duller version… more like
  a vectorish style"): a flat diamond's outline on a short stem in the theme's accent as it is, bobbing on a slow
  sine. The desk's Play doesn't draw it yet.
- **An intro first, quests that aren't lists**: every new Director file starts with an Intro quest (`finish:
  "opening"`: over once what happens as it starts is; `list: false`); a quest's steps shown as a to-do list or not
  (`list`), so a talk quest needs only the marker; after the last quest with no ending, a free roam. The sample's
  Intro is a thought and a pause; its talk quest has no objective and no list.

Then **Story Flow** (DECISIONS 2026-11-02, later; GODOT_DIRECTOR §6f), the user's "a story flowchart tab… so I don't
have to look through them one by one to see the prerequisites", in three steps: a main screen beside 2D, 3D and
Script with every quest and ending as a card and the arrows as the game plays them (a card's prerequisites on the
right); setting the quests and their branches up in it (new cards, titles, ways dragged, conditions picked, Delete,
Number them by the flow); and **easter eggs** (a quest marked `egg`: found during the quests that point at it, its
thing played once, then the game going on or a jump ahead).

To ask the user: Story Flow in their own hands (with a mouse and a real screen: the cards' size, the wrapped rows, the
arrows round the cards), whether the Manager should get the chart too, the marker's look in their own play, and
whether the desk's Play should draw the marker.

## 0. Where it stopped (2026-11-01, evening, branch `Director-Godot`): the HorrorStudio panel

The user asked for a friendlier panel in Godot (DECISIONS 2026-11-01, evening): category sorted, synced to the
scripts, drag and drop onto objects or click an object and assign. The design is the canvas "Director Panel Design"
(https://claude.ai/artifact/Q21Wv6misQnt5LwkZgNfRs, five boards: Main, Assign, Player, Story, Pieces); the user said
"looks good", then "work through everything". **Built in four steps, each checked and pushed** (GODOT_DIRECTOR §6e,
the guide's §2, §3 and §8):
1. **Build** (`editor/panel.gd`, `build_tab.gd`, `glyphs.gd`, `inspector.gd`, `parts/catalog.json`): the panel along
   the bottom (an EditorDock), picture cards in categories, a click in front of the camera, a drag onto a model (the
   mouse's ray on its triangles, collider or not), a model selected and one click; This object in words; the
   Inspector's box; a window into a room; Scares as an area and its moment. The dock's Add tab went.
2. **Player** (`level/player_start.gd`, `level/checkpoint.gd`): the Player start, the Test start (F6, Play from here,
   Try it on a thing: a test begins at the first quest in the Test start's level, the player kept there), the
   Checkpoint (an autosave each time it's walked into); `game.player` {run, crouch, eye} in the format, the story
   check, Godot's runtime and the desk's.
3. **Story** (`editor/story_tab.gd`, `story/commands.gd`): the quests in order, their steps and moments as WHEN /
   ONLY IF / THEN sentences with a picker for each blue word, how often, what it reads as, Try this moment, Show it in
   the 3D view; ready-made moments clicked or dropped onto an area or a door; every change on the editor's undo. **The
   same words as the Manager**: `tools/director_manager/words.js` (conditions as words, "they've read letter", now
   the Manager's chips too) and the desk's `commands.js`, written for Godot by `tools/director_manager/commands_json.mjs`
   (run it after changing either: DIRECTOR fails on a stale `story/commands.json` or a sentence that reads differently).
4. **The guide and the checks**: the guide's panel parts and pictures (38, each at its own size in the page), and
   DIRECTOR driving every tab of the panel (Build, the Player category, Story, Test).

Not measured here: the panel with a real GPU and a mouse (everything is driven by code in the headless editor, and
pictured under lavapipe); a real drag from the panel into the 3D view (the check drops the preset the way the view
does). GDTESTROOM's station 6 fails in this container as before (no bake bodies). To ask the user: does the bottom
slot have room for them (the Story tab scrolls there; the panel's ⋮ floats it on a second screen), which ready-made
moments they want next, and whether the Story tab should also edit conversations, states and a quest's next (the
Manager does them now).

## 0a. Where it stopped (2026-11-01, branch `Director-Godot`)

The user answered what the Director still lacks (DECISIONS 2026-11-01): the game as state, puppeteered by one
Director over things with ids, logic as droppable parts, an HTML Director Manager, faces exported without the desk,
Kimodo's fingers, Steam achievements planned for. **docs/GODOT_DIRECTOR_PLAN.md** is the plan, written and waiting
on their yes (its §9), given: "work your way through this in the cleanest best way". **Built so far**: step 1, the
parts (droppables, the little things with their markers, the crossed-out step); step 2, the Director in the game (the
Director file `director/director.json` with its quests, states, moments, conversations, endings, achievements; the
brain `run/brain.gd`; the story nodes and the Story, Events and Flags tabs removed for the dock's Director tab; giving,
`gave`, in the runtime; the sample remade); step 3, the Director Manager (`tools/director_manager`: a page over a
Godot project, the desk's commands and triggers, its own condition editor, Coverage, the saves; MANAGERPAGE); then
**Inspect in the hands in Godot** (the user's "pick up temporarily to inspect, turn around": `play.gd` `examine` as
the desk's examine.js, drawn over the room by its silhouette's depth pushed back first; a thing's model named `art` at
play, so the hand's copy and the kit's slots find it) and **the guide rewritten** (`guides/director`: parts, the
Director file, facts, moments, conversations, states, the Manager; 34 pictures, the Manager's by
`tools/director_manager/guide_shots.mjs`); then **Kimodo's fingers** (`kimodo/retarget.gd`: each finger bone aimed
along SOMA's segment, the hand turned by SOMA's own palm; 32 MHR finger bones at 0.00°). GDTESTROOM's station 6 fails
in this container as before (no stand-in bodies here; the stations before and after pass); then **faces, part one**
(`tools/face_export.mjs`: the expression library baked as HSFaceClips into a project's `faces/`, the loops apart in
`faces/loops/`, FACEEXPORT in CHECKS; the story format's `expr` action, played by the runtime's `face.gd` on the mesh
carrying MHR's face shapes and by the desk's `play/faces.js`; an HSActor's `expression` (her resting face), a state's
and a line's `expr`, the Manager's pickers; the scene player now runs a cue's instant actions too, so a Director
line's own commands play). Then **faces, part two** without touching the Character Studio: `tools/face_morphs.mjs` bakes MHR's 72 face shapes into a
Studio export's copy for Godot (`game/people/`, by `install` and the desk game's export) from its corners' MHR points,
sparse morph targets by Meta's names, lash cards turned about their eye (FACEMORPHS; Godot reads 72 blend shapes);
the runtime's mesh scrub keeps a rebuilt mesh's blend shapes now. **The plan's five steps are built.** Not yet: the
eyes turned by the gaze and the lids kept off the eyeballs on a Studio character in Godot (the desk's); in-game Load;
a moment that ends a quest early; Steam. Untested here: a real Studio export through face_morphs (no character on
this machine: STUDIO makes `_studiotest`, slow on the CPU; ask the user for a local run of GDPEOPLE after
`install`). Not merged into main yet: main has moved on (PR #6, the street builder); bringing main in conflicts
only in CLAUDE.md, CONTINUE, DECISIONS and LESSONS (both sides added entries), the runtime merging by itself (run
GDPLAY, GDTESTROOM and DIRECTOR after).

Then the user asked that the desk's way into Godot follow the new system too (DECISIONS 2026-11-01, later): **a desk
game as a Director project**, `python tools/godot_director.py from-desk <Game> [folder] [--force] [--play]`
(GODOT_DIRECTOR §6d): `storykit/director_desk.py` writes the world (`director/desk_world.json`) and the Director file,
the plugin's `desk/desk_build.gd` builds the world as nodes and saves `main.tscn`. To carry the desk's games whole the
Director grew: a room's **windows** (an opening's `glass`, `daylight` by the time of day, `shaft`, a car passing) and
**leaks** (`core/leak.gd`), a path point's `pose` and `check`, a little thing's `life_light` (a candle's flame), an
actor's cast id in the ids index, a quest's **round** (the format's `play`: hide and seek; `result:<quest>:<result>`
its fact; the Manager edits it), a level's `look` and `weather`, aimed pattern lights as the Look plugin's
HSPatternLight, kit mirrors; the runtime turns off every collider of a thing it rolls (the die). **FROMDESK**: the
Pilot plays through to its good ending; TestRoom001 passes every station but 6 (the same skin check the export fails
here: no bake bodies in this container). Not carried yet: the trims and thresholds, a kit door's own model, the light
zones per room; the desk's Godot button still makes the export only (a `from-desk` choice there would be next if the
user wants it). The desk's export stays as it was beside it.

## 0. The Director-Godot session (2026-10-30, night; branch `Director-Godot`)

The user asked for a Godot plugin to build the games in Godot itself, no desk in between (DECISIONS 2026-10-30,
night). Built, each step checked and pushed: **HorrorStudio Director** (`GodotPlugins/HorrorStudioDirector`,
docs/GODOT_DIRECTOR.md is the user's guide, the plugin's CLAUDE.md the map):
- **Nodes**: the level's (HSLevel, HSRoom with doors cutting their own openings, HSDoor, HSThing with fifteen uses,
  HSTrigger, HSSpot, HSPath, HSActor; the user's lights by name) and the story's (HSGame, HSChapter, HSTask with
  HSTodos, HSEvent when/if/then on HSWhen and HSAction resources, HSDialogue with HSLines and HSOption answers,
  HSChoice, HSEnding); steps play in the tree's order; where an event sits is when it listens.
- **compile.gd** turns them into the runtime's story at play; **HSGame** starts the runtime with it (levels as
  templates), F9's panel, the editor's dock told where the player is; F6 on a level plays it alone.
- **The runtime** grew for it (STORY_FORMAT and the story check with it): `game.collision: physics` (collide.gd: a
  capsule against whatever collides, physics rays for the cursor and sight), `game.track_steps` (`@<step>` flags),
  `move` (the player to a spot), `anim` and a behaviour's `rest`, a beat's `repeat`/`every`, `item:<id>` in an `if`,
  `use: talk`, a project's own sound files; `game.gd` takes `story_data`, `level_scenes`, `on_step`, `on_play`;
  pieces anywhere in a level (the group `hs_piece`). The export's games are unchanged (GDPLAY, GDEXPORT; GDTESTROOM
  stations 1-5 and 7 on: station 6 fails the same on main in a fresh cloud container, no stand-in bodies there).
- **The dock** under the Inspector: Story (the quest log, + Add, drag to reorder, Play from here, ▶ where the game
  is), Events (sentences and nine templates: the user's jumpscare in an area after flags first), Flags (set where,
  checked where, ⚠ never set), Things, Add (click, or drag into the 3D view), Check, Kimodo.
- **Kimodo**: a room sent as the demo's stage (kimodo/stage.gd, the format `kimodo.py stage` writes), an .npz brought
  back (kimodo/npz.gd) and retargeted onto the character's own skeleton (kimodo/retarget.gd, the desk's bodies.js way;
  MHR, SOMA, Godot's humanoid profile, Mixamo), played as her idle or walk or by an event.
- **tools/godot_director.py**: `new <folder> [--sample]`, `install <folder> [--link]`, `guide`, `check` (DIRECTOR: the
  sample played to its good ending, the Kimodo link measured, a level alone, the editor driven, the guide's pictures
  and links). The launcher's Godot section has all four.
- **The guide** (2026-10-31, the user asked for one): `guides/director/index.html`, the Director start to finish with
  24 pictures Godot makes of the sample (`godot_director.py guide`); `guides/index.html` lists the studio's guides
  (the desk's and the export's too). Every project gets a copy in `guide/`; the dock's Guide button opens it.
  Found while writing it and fixed: a game table defaulted to a board game the Godot runtime can't play (now
  chohan), and a character's `studio_character` export was never copied in (`install` does now).

**For the user to try** (on their machine, Godot 4.7): read the guide (`guides/director/index.html`), then
`python tools/godot_director.py new ~/Games/Sample --sample`, open it, F5 (walk to the letter, the kitchen, the key, Mari, the bedroom, the wardrobe), then the dock's tabs; F9 in
the game. Then a level of their own from their notes (docs/GODOT_DIRECTOR.md §1's table), and the Kimodo round trip
with a real motion (the sample's idle is a made one). What to ask them: whether the dock under the Inspector suits
them (Godot lets it move), which event templates they want next, and which of their models need a BoneMap for the
retarget (MHR from the Character Studio works as it is).

**Open** (GODOT_DIRECTOR §9): fingers and MHR's twist bones in the retarget; a kit thing or a CC0 prop in one click; an
event inside a dialogue; no way back from a Director game to the desk (the scene is the game).

## 0. `procedural-trees` (2026-11-02, evening): the prop generator's trees, after Modular Tree

The user pointed at steven-ray's fork of Maxime Herpin's Modular Tree and asked for a tree prop generator for urban
streets with variations (DECISIONS 2026-11-02, evening). Built (PROPGEN §18): `tools/propgen/mtree.py`, Mtree 4's
MIT core (trunk, branches with phyllotaxis, splits, gravity and the floor, the pipe model's radii) ported to numpy
Python, nothing to compile; the `tree` family (`families/tree.py`): nine species by season (zelkova, ginkgo, cherry
with blossom, camphor, plane and pollarded, maple, crape myrtle, black pine, a dead tree), tubes with a seamless bark
tile drawn by 4D noise on the flat torus, leaf cards off a cluster atlas drawn by code (alpha-cut in Godot, normals
rounded over the crown), torii or tripod stakes and a kerbed pit, the tree set down by its trunk (`Thing.anchor`);
sixteen recipes. Framework: `surface.material` cuts alpha (`alpha="clip"`, the glTF's MASK), `mesh.to_blender` takes
a mesh's own normals (`a["normal"]`), `build.run` skips the per-texel raster where nothing reads it (the wear) and the
occlusion bake when a thing says so. The user then asked for the trees by night: `propgen.py godot --night` pictures
any prop under the game's blue moon and in the dark under the flashlight from the player's eye (the sheets in
`docs/godot_sheets/2026-11-02_trees.jpg` and `_trees_night.jpg`). Then the user pushed three ambientCG bark sets and
four leaf sets (`pbr/bark/`, `pbr/leaf/`): every species' bark is now a real one by default (`bark.pbr`, the drawn
tile behind `pbr: null`), and the leaves have a realistic category (`*_real`, nine recipes with a new cedar: the sets'
own leaves cut out by `tools/propgen/leafset.py` and hung along the twigs, hued to the season). Then bushes (azalea
balls and hedges by `clip`, a loose shrub, grass tufts) and `tools/godot/street_dress.py`, which dressed the hill
road with trees and bushes and pictured it by day and night (`docs/godot_sheets/2026-11-02_hill_motel_dressed.jpg`;
the judgement in PROPGEN §18: scale and shadows carry it, the cards show up close, the green is a shade bright). Then
**small trees** (`habit: upright`, ten `small_*` recipes under a two-storey house, branches steep) and the dress tool
putting them beside houses, big trees only with room (`--room`). Then **potted plants** (the `plant` family,
PROPGEN §19: a pot turned with a real wall or a cube planter, the soil and its topping, the tree family's growth and
cards on it as an aloe, an echeveria, a snake plant, a fern, a palm, a monstera, a rubber plant, a fiddle leaf fig, a
ficus, a bonsai, basil, a pothos, ivy, lucky bamboo, a yucca, a cactus and a dead one: eighteen `pot_*` recipes,
`docs/godot_sheets/2026-11-02_plants.jpg`) and **vines** (`propgen.py vines`, §20: five seamless sets a metre a repeat
on the shelf, `pbr/foliage/vine_*`, a layer by its own mask over a wall's set in the street paint,
`2026-11-02_vines.jpg`). Next, if the user wants: the plants in the kit's places (a windowsill, a shelf, a desk's
corner: the scene builder putting a `pot_*` prop there), vines as a mesh standing off a wall (cards on the stems, the
set's own leaves) and climbing the street builder's facades by a slot of their own, more plants (an orchid, a
succulent tray, a hanging basket), their own look at the trees on the 3090 (the page shows
them as cards, `python tools/propgen/serve.py`), wind on the cards (a vertex shader in the look plugin), a bush family
(azalea hedges, clipped balls), the street builder's `tree` stand-in swapped for a made tree by the Godot drop (street_dress's `placements.json` is
the shape of it), a nearer card set for crowns at the player's face, lower LODs (the twigs' sides, fewer cards) for a
street of them, bushes that know a door from a wall.

## 0. `enhance-prop-editor` (2026-11-01, late night): the prop generator's picture editor (tsukibii/HorrorEngine#10, not merged yet)

The user found pictures on props hard to place (DECISIONS 2026-11-01, late night) and asked for a Figma-like panel:
the image in use, where the cuts are, one large image or small ones dragged to fit the cut areas. Built (PROPGEN §17):
**the picture editor**, the page's Texture & pictures tab taking the whole page (`tools/propgen/page/picedit.js`, the
helpers moved to `page/util.js`): the canvas (Design: the paint under your pictures, `_paint.png`, with them live over
it; As made), the cuts from the made .glb's UVs, the parts and pictures as layers, drops onto a part, an own picture
or the whole texture (**`sheets`**, a new recipe word: one picture in the layout it was laid in), handles to move, size
and turn (decals' **`rot`**, and the fits **`cover`**, **`contain`**), undo, the prop in 3D wearing the canvas (a click
picks a part), a Krita .ora template out and back in (the server takes its Paint layer). Checked by PROPGEN (its new
case) and PROPPAGE (rewritten for the editor). Next, if the user wants: their own run on the 3090
(`GPU=1 node tools/propgen/pagetest.mjs` is quicker there), what they find awkward in it, and perhaps the same canvas
for the kit maker's slots.

## 0. `clothing-refiner` (2026-11-02, later): the drape on the GPU, as a switch

*Use the GPU* in the wardrobe's header and the Studio's Clothes tab: each drape's steps as WebGPU compute
(`tailor/drape_gpu.js`, TAILOR §1i), the CPU's drape bit for bit as before when off or without WebGPU. Here only
SwiftShader's WebGPU (on the CPU, so slower than the CPU's own drape): GPUDRAPE ok (the kernels match `likeGPU`, the
card's way on the CPU, to under 0.05 mm; the hang alike, the folds placed a little differently). Next: the user tries it
on the 3090 (in Vivaldi, the user's browser: Unsafe WebGPU Support in vivaldi://flags, Vulkan too if vivaldi://gpu says WebGPU is off; `GPU=1 node
tools/character/tailor/gputest.mjs` gives the card's times), then a local session tunes it: fewer dispatches (the
bends' batches are most of them; several steps' predict, tether and collide fused), the planes asked on the card.

## 0. `clothing-refiner` (2026-11-02): the wardrobe (docs/WARDROBE_PLAN.md, ticked)

Kept garments (a change re-makes only what changed and what's over it), folds by seed on shorts, trousers and skirts,
loose houndstooth shorts and micro skirts, the wardrobe page on a dummy with My outfits for the Studio's Mine tab
(TAILOR §1i). Next: the user's try on the 3090 (the wardrobe's feel; STUDIO); the drape on the GPU (WebGPU) and a pool of
workers are the plan's Later.

## 0. `clothing-refiner` (2026-11-01, late night): soles carried down from the shoe

After the user's sandal OBJ: every shoe's sole is the upper's own outline extruded down, grooved, with heel blocks
(TAILOR §1h). Next: their look in the Studio; the sneaker's upper itself (its toe bumper) could be smoothed next.

## 0. `clothing-refiner` (2026-11-01, night): cozy and gothic (docs/COZY_GOTHIC_PLAN.md, ticked)

Built (TAILOR §1h): socks in every length and heavier, a PVC rain jacket, the sneaker designer, spider web and mesh
nets baked in Blender, gothic clothes and a Gothic group, horns and headband ears, every accessory placed by sliders
and PBR on props; bras that stand off the body and fit bigger busts, a halter's strings as cords (§1g). Next: the
user's look in the Studio (STUDIO wants a local GPU run: the sneaker designer's panel and the props' placement are only
driven headless by our shots, not by STUDIO's steps yet).

## 0. `clothing-refiner` (2026-11-01, evening): bikinis and thongs on the hip bone

The user's note on the bikinis: the waistline's `hip` lift, the briefs re-cut so their top edge rises over the hip
bones, a string bikini and a halter triangle top after their OBJs (TAILOR §1g). Next: their look in the Studio.

## 0. `clothing-refiner` (2026-11-01, later): the clothing review (docs/CLOTHING_PLAN.md, ticked)

The user's eight notes, all built (TAILOR §1g): waistbands snug, hollows bridged (no cleft, cleavage or spine dent, no
dent behind or ledge round the knee, a skirt's back kept off the gap between the legs), ease limits checked by TAILOR,
loose tops hanging from the bust and shoulder blades with soft vertical folds and a sleeve's sag in the creases, up to
three prints a garment with a prints library, and the everyday wardrobe (Casual, Business, Uniforms, Sleepwear,
Swimwear tabs; joggers, sweatshirt, polo, suit trousers, pyjamas, sleep and swim shorts, bikinis). Next: the user's look
in the Studio (STUDIO wants a local GPU run); the older outfits' thumbnails still show them before the bridge (re-run
`node tools/character/tailor/thumbs.mjs`, ~40 min); a shirt dress and a one-piece swimsuit need a cut of their own.

## 0. `clothing-refiner` (2026-11-01): creases, made fabrics, the smart casual collection

The user: Japanese smart casual outfits after their reference sheet, creases ("how we emulate wrinkles on faces"),
then fabrics made in Blender "like the props and buildings". Built (TAILOR §1d, §1e, §1f): `tailor/crease.js` (folds,
drag lines, the press, seams, hems, crinkle as a shader height from per-vertex data; the Creases slider and Pressed
crease switch; baked into the export's normal map), `tools/fabric_bake.py` + `tools/streetbake/fabrics.py` (26 fabrics
baked into `assets/pbr/Procedural/fabric_*`, first in the PBR picker, tinted; FABRICS in check_all), the Smart casual tab
(fifteen outfits, nine new cuts; linen, crepe, flannel). Next: the user's look in the Studio (`python tools/fabric_bake.py
bake` once on their machine; a local STUDIO run on the GPU); the outfits' thumbnails (`tailor/thumbs.mjs`); the
sweater over the shoulders; the creases in Godot measured (GDPEOPLE on a dressed export).

## 0a. The eyes in Godot (2026-11-01, on `eye-enhancements`, merged into main by tsukibii/HorrorEngine#7)

The user: the eyes "look kind of lifeless and scary ... it doesnt seem like we are applying the eye wetness etc
correctly", the exported eyes left alone (DECISIONS 2026-11-01). Measured on a fresh export (`_eyetest`: the soft cinematic
look, natural lashes, the grafted eyes): the iris black, the whites grey, HumanShaders' eye wetness unused. Done in the
look plugin (GODOT_LOOK §5h): the iris's bowl fixed (a doubled `handed`), **the eye's wet layer** (`eye_wet.gdshader`, each
eyeball's material overlay: the real lids found in the depth buffer, a warm shade by them, the upper lid's deeper, the
lid's edge melted in), the guessed ellipse off and the socket halved under it, the white's light wrapped warm (`wrap`,
`scatter_color`, `sss`), a crisp catchlight (`catch_size` 0.025). The sheet: `docs/godot_sheets/2026-11-01_eyes.jpg`.
Then, at the user's word, **the skin's depth merged in** (`subsurace-scattering-exp`, §0b; DECISIONS 2026-11-01, evening):
GODOT_LOOK keeps it as §5g and the eyes are §5h; the two checked together on a fresh export, the eyes' numbers unchanged;
before (main) and after: `docs/godot_sheets/2026-11-01_eyes_depth.jpg`. Main (the school, §0c) merged in too.
In the cloud a Studio export needs MediaPipe first (`face_mesh.py setup`, libegl1: LESSONS). **Next, if wanted** (ask
first): the eyes' own life in Godot (micro-saccades, a glance, look-at: they don't turn yet); the user's look in a real
level on the 3090; the tear line's glint if it reads too white under their lights; EYELIDS' file measure on a new
character with the grafted eyes (0.315 mm² of the right eye through the lower lid at 0.90 shut from below: the export's
blink, not touched here).

## 0b. `subsurace-scattering-exp` (2026-11-01): the skin's depth, merged into `eye-enhancements` (#7)

The user asked whether we use subsurface scattering (the characters' skin looked lifeless) and for Blender's look round
the eyes and nose, for baked light, the ears switchable (DECISIONS 2026-11-01). We had HumanShaders' (per lamp, so
nothing under a baked level's light but a grey occlusion). Built (GODOT_LOOK §5g): **the skin's depth layer** in
`skin_wet.gdshader` (`skin_depth`, `HSSkin.set_depth`), placed by **MHR's depth map** (`tools/skin_detail.py depth`,
`textures/mhr_skin_depth.png`: eyes, nose, ears, mouth, most in the creases), on every Studio export by itself;
per character the Studio's Skin light **Depth (game)** and **Ear glow (game)** (the export's `studioSkin` record);
`HSCharacterLook` Skin Depth and Ear Glow (auto, on, off); then, the user's yes, the rest of the body gently: a warm
edge where the skin turns away, the creases everywhere, the fingers lit through, the lips (each a slider: the
node's "Skin depth's parts"). GDPORTRAIT measures it under a baked light (portrait.gd's
`--light=baked`, `--depth`, `--ears=off`, `side`, `--probe`); the sheet `docs/godot_sheets/2026-11-01_skin_depth.jpg`.
The branch is named as the user typed it. **Next:** the user's look in a game of theirs (its baked light, a cast member
with hair over the ears and Ear glow off), then the strength (1 by default; 2 is Blender's picture); merged into the eyes' pull request at the user's word
(DECISIONS 2026-11-01, evening: the two checked together, `docs/godot_sheets/2026-11-01_eyes_depth.jpg`); the
Studio's view could draw it too (not asked).

## 0c. A Japanese school (2026-11-01, on `claude/laughing-goldberg-6l5of3`, merged into main by tsukibii/HorrorEngine#8)

The user asked for a school in the tools we have (DECISIONS 2026-11-01): the kit's school furniture and fittings (KIT
§10), books with covers of their own (PROPGEN §16), the 1:1 classroom of their Blender render and its corridor (the set
`school_classroom`, SCENE_BUILDER §10), a school street (`school`). Then "the school building needs to be to scale" and
two photos of school buildings "1:1": **the school building kit** (SCENE_BUILDER §10b: `schoolBuilding` in
builder-presets.js, modules into rooms on every storey, dog-leg stairs (`flights: 2`) in shafts to a penthouse, round
windows; `tools/director/layoutset.mjs` saves a layout as a set) and **buildings in storeys on the street**
(STREET_BUILDER §5f: the shell storey by storey round the rooms, the facade from them: eaves, pilasters, rails, bands,
the name on the roof; ribbed walls, a sliding gate, stand-in trees). The photos rebuilt: sets `school_white` and
`school_showa`, streets `school_white` and `school_showa` with their shots `photo` (renders:
`node tools/director/streetshot.mjs --street school_white --shot photo`; the photos in each street's `refs/`, on this
machine only). Next, what the user asked earlier: **the 1:1 classroom with PBR sets** ("to see if it helps realism":
the interior sets in tools/streetbake/library.py, `jp_oak_floor` and `jp_pine_varnish` baked, ten to go with
`python tools/street.py library <names>`). Not yet: the school's walkable roof, its toilets' stalls, a gym set; dusk renders
here come out black now and then (the headless renderer; retry). Then (DECISIONS 2026-11-01, night) **a small private
school in Tokyo concrete**: the set `school_tokyo` (one storey round a courtyard, two mixed-year classes, the lunch
room, the reception; SCENE_BUILDER §10c) on the street `tokyo_school`; the user's next word on it decides what follows
(timber was "for later").

## 0. The street builder (2026-10-30, night, on `buildings-streets`; not merged)

The user asked for a new tool (DECISIONS 2026-10-30, night and later night): the outside world the enterable buildings
go into, low poly and layman-simple; then slopes and curves, big streets handled, a .glb to drop into a Godot folder,
and the interiors (sets) walked into from the street. Built (docs/STREET_BUILDER.md): **the street builder**
(`tools/director/street.html`, the dashboard's tile; `street-gen.js` the generator in plain JS, `street3.js` the drawing
and the export, `street-presets.js` ten styles, five mixes and the walk-ins; `Content/Studio/Streets/<name>/street.json`):
the map, the facade view (parts clicked onto the wall, floors by dragging the roof, a photo behind each side), the 3D
view (orbit, walk, shots matched to a photo), **Fill a street**, streets that **bend** (a dot in a street's middle) and
**climb** (heights a point; the ground, plinths, things and fence posts follow), **big streets** in 48 m chunks merged
by material (colours on the vertices; 451 draws for the 89-building town), a piece rebuilt only when it changes, **the
.glb for Godot** (colliders `-colonly`, occluders `-occonly`, lamps, insides' markers; a colour a material, since Godot
leaves vertex colours off), **buildings to walk into** (a set inside: the shell round its rooms with its doors and
windows cut through, roof, plinth, steps; rows and floors: the Motel with its walkway and stair; the Bungalow), gates.
Streets: **shibuya_lane** (the first photo matched, 13 pins at 0.5%), **reference_town** (the other five references),
**hill_motel** (a winding hill, the motel and its car park, the bungalow behind its gate). Sets: **motel_room**,
**bungalow**. Checks: STREET (check_all), STREETPAGE, GDSTREET (Godot 4.7: rays onto the road, the pavement, roofs, the
walkway; through each inside's doorway onto the set's own door with the set's level at its marker).

**Then the surfaces** (2026-10-31, past midnight; DECISIONS): "the most aesthetic way" to texture the streets, wear and
decals, procedural bakes instead of PBRs, a street → Blender → Godot path with easy collision. Answered and built
(docs/STREET_TEXTURING.md): **finishes that tile at their real size** (Blender node groups in `tools/streetbake/
finishes.py`, baked once onto the PBR shelf as seamless sets, `assets/pbr/Procedural/`), **the street's own wear** in
one low-res atlas (`wear.py`: the prop generator's idea at a street's scale; dirt, splash band, rain streaks run down
each ledge, worn edges, wet patches), PBR sets optional by slot or material (a street's `finish.json`). `tools/street.py
look` renders a shot beside its photo in Cycles; `bake` writes `<name>.glb` and `<name>.blend` (plain glTF: the
finish at its size times the colour, the atlas as occlusion on UV2, the recipe in extras; colliders, occluders, lamps
and markers by name; the .blend's Foliage collection kept between bakes). The look plugin's import step
(`street_import.gd`) makes those materials `street.gdshader`, so Godot matches Blender (GDSTREET `--glb --plugin
--shot`: the rays land on the road at 0.004 m and the pavement at 0.150 m after Blender, 85 surfaces on the street
shader). STREETBAKE (`street.py bake-check --godot`, a minute). The Shibuya lane: `Saved/Streets/shibuya_lane/blender/
compare_photo.jpg` (the photo, Blender, Godot). **Next, if wanted:** decals as a street builder part made Godot Decal
nodes by the same import step (STREET_TEXTURING §5); a `finish` beside each slot's colour in the street's `look`; the
wear reacting to the plugin's rain.

**Then the enterable buildings' outsides** (2026-10-31, small hours; DECISIONS): the shop door made readable (a frame
all round, a kick plate, a push bar, its own pane), and the scene builder's **Outside panel** (SCENE_BUILDER §8): an
enterable building designed whole, inside and out, with the street's own generator and styles (roof, walls, raise,
front, fittings), seen *round the building*, kept as the level's `outside` (STORY_FORMAT §2, story_check reads the
street's own words from street-gen.js); the street builder's palette has every set, its building wears the set's
outside until changed in the street (`inside.from`, `inside.own`, *Follow the set's outside*; STREET fails when a
following building is stale). The bungalow set has its outside (hip roof, raised 45 cm, an air conditioner and a pipe);
hill_motel's bungalow follows it, its motel is its own. Checks: STORY, STREET, STREETPAGE, BUILDER.

**Then no clipping** (2026-10-31, small hours; the user saw the bungalow's wall tops through its roof): walk-in roofs
boxed on a soffit 1 cm over the level's top (gables flush), roofs over an L or a T joined into one (flat: one slab and
its parapet round the outline; pitched: a roof over each arm, cut where it's inside another), and the whole generator
swept for faces in one plane over each other: layers a `GAP` (1 cm) apart, parts `SIDE_IN` (6 mm) in, rails sharing
their corner posts, parts up the floors never into their own copy, and the rest by rule (STREET_BUILDER §5d). STREET
measures it over everything it builds (1 cm², 4 mm) and over sets shaped L, T, U, steps and apart under every roof.

**Then the streets made to look real** (2026-10-31, before dawn and morning; DECISIONS): research first
(docs/research/photoreal.md: the Battlefront look is right values, right light, right flaws; through a tape, light and
metre-scale variation matter, micro detail doesn't; LightmapGI with a Dynamic sun is Battlefront II's split), then
**street paint** (docs/STREET_PAINT.md): **the material library** (49 Japanese exterior finishes, `street.py library`,
`pbr/Procedural/jp_*`, each with every PBR map: colour, normal, height, roughness, occlusion, ORM), **wear and tear**
in every material and finish (smudges, fingerprints, scratches, chips, cracks, dents), **27 decals** made from code
(`street.py decals`), and **the paint page** (`paint.html`: paint a surface or every one like it, lay decals, Blender's
look or bake from the page). The Shibuya lane is painted from its photo and rendered under **Blender's physical sky**
(Nishita), calibrated against the photo by measurement. Checks: PAINT (new), STREET (decals), STREETBAKE.
**Then the road and the light** (2026-10-31, late morning; DECISIONS): the road's print lies on the road (5 mm, no
shadow anywhere: the page, Blender, Godot's import step, GDSTREET checks it); the light is the user's, baked by hand
in Godot (STREET_TEXTURING §3 has what LightmapGI and VoxelGI each need from the street).

**Then the PBR sets** (2026-10-31, afternoon; DECISIONS): the user's `pbrs` branch merged (37 ambientCG sets, CC0, 1K,
in git at `pbr/<category>/<set>`, each with its real size and a label in its meta.json; the shelf reads them after
assets/pbr). The street paint page's materials are those sets by category (the first library, made in code, folded
away), and **the brush** tunes one (tint, brightness, contrast, saturation, hue, fade, roughness, relief, size, turn)
and **layers** over it: another set in soft patches or by its own mask, the street's decals scattered over each
repeat, and the bake's wear per surface (grime, streaks, edges, damp). A tuned look is an object in the street's
`look` that `storykit/pbrmix.py` makes into a tileable set of its own (`pbr/_made/<hash>`, not in git; one function,
so the page, Blender and Godot match), and STREET checks every look through it. The Shibuya lane is repainted with
them, tinted to the colours the earlier calibration found: `docs/godot_sheets/2026-10-31_shibuya_pbr.jpg` (the photo,
the procedural render, the PBR one; close-ups of the shop, the kiosk and the road). Up close the road and pavers
read real; from the photo's distance the frame is still ruled by the light and the street's clutter. **GDSTREET** now
drops a body a person's size on the roads and pavements (it stands there) and walks it at a building's front (it
stops at the wall). **Next, if wanted** (ask first): the street's light by the user in Godot, more of the photo's
clutter (cables, AC units, signs), more sets (tiles, siding, glass), a set per material in the street builder's own
inspector with the brush.

**Then the interiors** (2026-10-31, evening; DECISIONS): **Paint in the scene builder** (SCENE_BUILDER §9): the street
paint's brush, now `brush.js` and shared, on a level's floors, walls, ceilings, trim, blocks and outside; a room's look
and a block's `mat` take a colour or a tuned set (STORY_FORMAT §1: the plan tags it `mat:pbr/_made/<hash>`, the desk's
plan answer carries the made sets, the stage draws them and colours); a kit floor under the click is taken up; a room's
walls are its own side (plan.py's **linings**: a 4 mm lining wearing a room's own look on a wall its neighbour builds,
wherever their looks differ). **Your folders** (ASSETS §6): folders of PBR sets anywhere attached to the shelf where
they are (`pbr/<name>/<set>`, nothing written in them; the shelf page's Attach). **The Godot export's materials**
(GODOT_EXPORT §3b): `game/materials/<Name>.tres` once a set, named after it, its maps beside it, every piece on every
level wearing it by reference (GDEXPORT checks one instance a file). BUILDER paints, tunes, lines and undoes; PBR
attaches; GDEXPORT shares. **Then the furniture** (2026-10-31, night: "do whatever's best"): a kit thing's slots take
looks (`mats`: STORY_FORMAT §2, KIT §4), Paint dresses the slot under a click (every one like it: the same preset),
the desk draws them (`dressSlots`), the Godot export gives them `<Name>_uv.tres` through `slot_materials.gd`;
TestRoom001's fridge wears the white plastic set (GDEXPORT's kit slots). The street's materials stay inside its .glb
(DECISIONS). **Then the fittings and doors** (late night: "the plastic PBR for light switches"): the switch, the
built-ins, the stairs and window frames the finish makes, and doors (a plain door's `mat`, a kit door's `mats` over its
parts) take sets; a fitting's paint is kept on a stub in its room's props (the export copies it onto the fitting it
makes), a frame's on its window, a door's on its opening; a moving block's set in Godot is `<Name>_obj.tres`;
TestRoom001's power switch, library door and kitchen door show them. **Then the lights as furniture** (small hours:
"no Godot light sources, rounded LEDs"): the kit's downlight grows `flush`, `dome` and `ring` styles (four presets); a
story light with a `kit` is a fitting (plan: `<id>__fitting` and the light under it; the desk's glass glows with it);
the scene builder's ceiling lights are round LEDs (by room size or picked in Finish); the Godot export writes a fitting
light as its fitting and a node, no light source (its glass and the user's lights under it follow the story's light);
TestRoom001's power bulb is a flush 300 (GDEXPORT fittings, GDTESTROOM's switch). **Then the floors take a material**
("yes make the floors take a material"): painting a room's floor dresses its kit floor's boards instead of taking it
up; a set that paints its own tiles, boards or mats (found in its maps as cells: `storykit/pbrcells.py`, the PBR check)
lays the kit floor out by them (plan.py `fitted` puts the cells in the kit's spec, kit.js lays them, the set straight
across: KIT checks every board inside a cell), its gaps in the set's seams on the desk and in Godot (the stage builds
from the plan's spec now; `<Name>_uv.tres` has a `uv1_offset` for the .glb's `1 - v`); TestRoom001's keys room is paved
with Concrete010, its library tiled in Concrete012. **Next, if wanted** (ask first): a set per material in the street
builder's inspector; a kit floor sunk into the floor (now it sits on it: a tatami raises the walking height 5.5 cm).

**What could come next** (ask first): the user's verdict on the match, the town and the motel; more references; the
export placing an inside's level by itself (today a marker; the set's level dropped there by hand); a two-storey
interior (stairs inside the set); foliage when the user wants it; steps and retaining walls on a slope; a grade in the
page (the photo's teal and orange).

## 0b. The prop generator (2026-10-30, night, on `prop-gen-tool`; merged into `buildings-streets` 2026-10-31)

A side branch, merged into `buildings-streets` at the user's word (2026-10-31, with the street builder, its paint
and the PBR sets): **`python tools/propgen.py`** makes small props from recipes by Python in Blender
(docs/PROPGEN.md). 38 recipes in `Content/Studio/Props/presets.json`:

- **The sampler's twenty kinds of litter:** cans pristine, dented and crushed; PET bottles; coffee and iced cups;
  newspaper, crumpled paper, napkin, fries bag, receipt, note; burger and pizza boxes; a bin bag; cigarette butts;
  bottle caps.
- **TestRoom001's kinds of thing:** cutlery with metal finishes, keys, kitchenware.
- **A worn kit chair:** the `import` family with a PBR set.

Checks: PROPGEN ok (12 families measured) and GDPROPS ok (Godot 4.7 reads every material back); a scratch copy of
Sample placing `asset props/<name>` passed STORY and GDEXPORT. **For the user:**

1. On your machine (Blender on the PATH): `python tools/propgen.py all`, then `python tools/propgen.py sheet`, and look
   at `Saved/Props/sheet.png`.
2. `python tools/propgen.py library`, to get them into the library for stories.

Then, from the user's second message (2026-10-30, late):

- **Liquids that stay level and slosh in Godot** (PROPGEN.md §10): the look plugin's HSLiquidFill. The game attaches
  it in `enter_level`. A fill table from the inside's own shape keeps a tipped bottle's volume.
- **The pill bottle** (`pills`): tinted vial, swappable sticker, tablets settled inside.

40 recipes. GDPROPS ok with the liquids upright and tipped; PROPGEN, GDEXPORT, GDPLAY, LOOKPLUGIN (nodes) and CHECKS
ok.

**GDTESTROOM fails at station 6 in this cloud with or without the change:** "Aoi's skin on 0 materials", her body
wanting a Studio export the fresh container lacks. Worth a run on the user's machine.

Then, the user's third message (2026-10-31): **the occult, the kitchen and the sinks**, eight new families with 42
recipes, 82 recipes in all:

- **Candles:** pillar, church, black, red, a taper in a brass candlestick, a votive in sooty glass, a cluster;
  `socket_flame` at each wick.
- **Japanese occult:** ofuda in a brush hand with vermilion seals (`sheet` with the `ofuda` design), ema, omamori, a
  shimenawa with shide, a wara-ningyo nailed through its name, a kokeshi.
- **Shrine and altar things:** a hokora (one sealed with an ofuda), a sanbō, an orin, a kōro, an offering table.
- **Cookware, appliances and sinks:** saucepan, stockpot (broth), frying pan, yukihira (miso), donabe, tetsubin,
  enamel pot; a rice cooker (modern and 1980s); electric kettles; a kitchen sink and a washbasin (with water, with
  blood).

New in the tool: weighted normals for hard surfaces, `rbox`, `tube`, `spline`, ring strips (shapes a lathe can't
turn), and sockets as empties in the glb under the kit's names (PROPGEN.md §11-12). PROPGEN ok (22 recipes measured),
GDPROPS ok on all 42 (four liquids upright and tipped), CHECKS ok; all 42 in the library. The look plugin and the
game's export weren't touched, so GDPLAY and GDTESTROOM weren't rerun. **For the user:** `python tools/propgen.py
make <names>` and `sheet` on your machine (GPU), and say which need another pass.

Then (2026-10-31, later): **the page**, `python tools/propgen/serve.py` (port 8797, PROPGEN.md §13): the recipes as
pictures, a form, pictures clicked onto the texture (`decals`, any family), PBR sets per material (`pbr`), variations,
3D, saving. PROPPAGE ok (113 s here), PROPGEN, CHECKS. **For the user:** open it from the launcher (Pages) and try a
decal on something; say what's missing.

Then (2026-10-31, evening): **enhancers** (PROPGEN.md §14): what glows painted as emission, the look plugin's
`HSPropFX` (glow, flame with its candle light, smoke, steam, wax; switches per prop and per project), the game putting
one on every made prop, and a `<name>.tscn` beside every glb. The rice cooker's panel moved onto its lid; the pots'
handles into their walls. **For the user:** open a candle's `.tscn` (Saved/Props/candle_taper/, copied into a project
with the look plugin) in Godot and switch its enhancers; say if the flame wants another shape.

Then (2026-10-31, night): **no part inside out**, and **your pictures on any prop** (PROPGEN.md §11, §15):

- **The user saw the rice cooker's bottom through its sides in Godot.** `slab` walked its rounded edge from the top
  down, so every slab and rounded box had its edge band facing in. Seven other parts were inside out the same way.
  Cycles' previews draw both sides and hid it. PROPGEN now casts rays at each case and fails past 1.5% of backs seen
  (`check.orientation`). GDPROPS ok; the rice cookers in Godot sent to the user.
- **Every prop's own pictures swappable**: 116 slots on 50 recipes (logos, pictures, ornaments, stamps, patterns,
  print), `pictures` in a recipe (wildcards `*.logo`, `false` to turn one off, stamps as relief only); smudges (nine
  built in, or yours); flourishes (decals repeated or in the corners); the size every picture wants on the page and
  in docs/PROPGEN_PICTURES.md. PROPGEN, PROPPAGE (an own picture swapped, a smudge moved by a click, a flourish),
  CHECKS ok. **For the user:** open the page, pick a prop, Texture & pictures: swap its logo for yours (the template
  link gives the drawn one at the size it wants), add a smudge; say what's missing.
- **The loose ends, fixed after (the user: "fix whatevers left"):** textures the same run to run (the padding's bands
  walked in the islands' order, a set's wasn't; PROPGEN makes a case again in a second process), the enamel pot's
  unused island gone, the import's kit meshes under `--out`, a `tile` fit (patterns and strips repeat by default),
  pictures and smudges carried across a band's seam, the fork's tines' tips and slots walked the right way (they
  crossed themselves: 1.2% backs, now none), the sleeve's HOT inside its ring. **Still open:** the burger box's lid
  shows 0.5% of backs at its inner chamfer by the back (cause not found; under PROPGEN's 1.5%); the knives have
  edges whose faces disagree inside the steel, where nothing sees them.

Next if wanted (PROPGEN.md §9): a life on a generated prop (a generated kettle boiling, a candle burning down: the
sockets are there), food tins, a flashlight, batteries, a bucket, a crate, a die, a book; a recipe page with a PBR
picker.

## 0r. `realism-enhancer-skin` (2026-10-31, the night, the last): the grafted eyes for everyone, the add-on gone

The user: make the base mesh's eyes the default ("I don't care about the old eyes"), upgrade our own brows and lashes
with what the add-on's technique does, and remove the add-on. Done (DECISIONS 2026-10-31, the last; CHARACTER_STUDIO §2b, §2c):
`Content/Studio/Bodies/MHR_eyes.bin` is committed and worn by every character (Blender Studio's Human Base Meshes'
lids, CC0; `eye_patch.py make` from `vendor/human_base_meshes/`); the brows and lashes by hand gained trimmed edges,
clumps, frizz, the curl at the lash tip, uneven lashes (`groom.js`, docs/research/brows_lashes.md); the add-on's
bake tool, its Studio loader, its notes, its bake button, Start from the add-on's brows and its check are gone. Next: the user's look (a local
STUDIO run on the GPU); the eyelid-line handles on the graft; the remote the old transfer branch (ask before deleting).

## 0c. `realism-enhancer-skin` (2026-10-31, the night, later): the grafted eyes on our faces, in the Studio

The user asked for the base mesh's eye and lid shape ("meaty flesh that curves in") on our editable faces, with a few shape keys
(more Asian or Caucasian, size). Built so far (CHARACTER_STUDIO §2c): `tools/eye_patch.py` (make, preview, check:
EYEPATCH) grafts the base mesh's eye region onto MHR's face; the Studio wears it (Skin, Eyes, the grafted eyes; `eyegraft.js`), open
to shut. Also Start from the add-on's brows (§2b). The shape keys are in (size, crease monolid to double
lid, inner fold, tilt, opening, depth; presets Default, East Asian, Caucasian). The export carries it (the graft in the skin with
its blink's morph targets, baked; EYELIDS on `_graftedeyes`) and Godot shuts it. Next: the user's look; the eyelid-line
handles on the graft; the head's licence (compare with Blender's Human Base Meshes). The head's licence: compare it with Blender's Human Base Meshes bundle when
www.blender.org is reachable (DECISIONS).

## 0b. `realism-enhancer-skin` (2026-10-31, the night): brows and lashes by hand, waiting for the user's try

The user liked the add-on's lash texture but not its design ("they move up too upwards") and asked for "an easy eyebrow editor
tool where I manually can add and adjust the eyebrows and eyelashes inside an easy wrapper". Built: Face, **Brows &
lashes by hand** (CHARACTER_STUDIO §2b, `groom.js`, GROOM): Edit on the face, handles on the brows' edges and the lashes'
tips, Mirror, Add hair / Thin out / Comb, a blink, styles and sliders, at the add-on's thickness; the lashes forward and swept
out. Sheet: `docs/godot_sheets/2026-10-31_brows_lashes_by_hand.jpg`. Next, the user's try: what the handles, brushes and
defaults need. Ideas: a brow-shape library (arched, straight, soft angled) as handle presets; per-hair brushes for
strays; the lower lashes' own handles.

## 0a. `realism-enhancer-skin` (2026-10-31, later): the add-on's brows and lashes, eyes that close, waiting for the user's review

The user's asks (DECISIONS 2026-10-31, later): MetaHuman-like eyes, brows and lashes; then a third-party procedural hair add-on
for the brows and lashes (its .blend at vendor/, git-ignored, CC BY-SA 4.0); then eyes that don't clip through the
lids, open or shut, and whites that aren't paint, wet as MetaHuman's. Built: the add-on's bake tool (since removed) and
the Studio's bake button for it; the export's blink (morph targets with in-betweens, the lids kept off the eyes, met when
shut), `HSBlink` in Godot, the tear line, the whites (GODOT_LOOK §5f); EYELIDS and its check. Pictures:
`Saved/Story/_look/godot_eyelids/blink.jpg`. Open: a lash clump at an inner corner and a fold at an outer corner in the
shut picture; the brows placed by the add-on's own region (not our brow rows); a presets sheet; the eyes don't turn in Godot;
the hybrid MetaHuman-face plan on hold; the old transfer branch still on the remote (ask before deleting). The STUDIO browser
check wants a local GPU run (the socket shade and the export's blink and tear line are in its path).

## 0b. `realism-enhancer-skin` (2026-10-30, night): the Studio's characters less like dolls, waiting for the user's review

The user's ask (DECISIONS 2026-10-30, night): the Studio's characters in Godot looked like dolls beside MetaHumans;
the plugin's skin did little; close up "the pores look way too large and not enough micro detail"; a Blender step
offered. Built without one (GODOT_LOOK §5d): **the skin's detail layer** in HSSkin (pores, furrows, the lips' lines,
the colour's unevenness at their true size from `textures/`, made by `tools/skin_detail.py`, placed by MHR's region
map; presets young, natural, adult, old picked from the export's own age and pores, or `HSCharacterLook`'s Skin
Detail), **the Studio's ambient occlusion** in its export (`albedo.js` `bakeOcclusion`, the ORM's red), **the
scattering kept gentle** (`sss_scale`: HumanShaders' strength blurred the face to wax) and **the eyes' lid shadow**
(`eye.gdshader` `occlusion`, `sclera_bright`). The sheets: `docs/godot_sheets/2026-10-30_skin_detail.jpg` (before and
after at three distances, the eye) and `2026-10-30_skin_presets.jpg`. New checks: GDPORTRAIT
(`tools/godot/portrait_check.py`), SKINDETAIL (`tools/skin_detail.py check`, in check_all).

**For the user:** pull `realism-enhancer-skin`, re-export a character from the Character Studio (its occlusion and
its record's age and pores come with the new export; an old export still gets the detail layer, without occlusion),
export the game to Godot and look close; `python tools/godot/portrait_check.py --person <name>` pictures any
character on the card. Tell us: the pores' size and strength, the presets, the eyes' shadow (`occlusion`), the skin's
sheen (it's more matte than before), and whether the two black streaks over the face in their screenshot were salon
locks (they're not the skin).

**STUDIO in the cloud** (SwiftShader, about 50 minutes a run): two full runs stopped at steps this branch doesn't touch
(the skin light's shadow edge measured after the whole flow, 10500 px against 1.2 × 11023, though that step passes on
its own on this branch and on the original; then a 30 s click timeout at "the eye refracts", which the first run had
passed); the export's skin maps assertion, the part this branch changes (the pores left out of the normal map), checked
with the test's own code on an export with painted nails: relief 39 (8 wanted), roughness 0.32, 4112 thin pixels, the
occlusion map on. A local run on the card (`GPU=1`, docs/RUN_LOCALLY.md) is the full answer.

**Then the hair** (2026-10-31, DECISIONS; GODOT_LOOK §5e): the salon's bake as a volume (shell normals and occlusion
from `hairvolume.js`, strand tangents, the second UV across the card and its occlusion, each strand's numbers in the
occlusion slot, `studioHair`), kept by the Studio's export (brows and lashes named, with their own numbers), worn by
HSHair from the file's records (dithered soft coverage under TAA, tapered card sides, the roots fading in, two
highlights with glints, light through from behind, a scatter); the white scalp cap and the brows' fill fixed; the sheet
`docs/godot_sheets/2026-10-31_hair.jpg`. New: HAIRVOLUME, GDPORTRAIT's hair shots and measures. **For the user:**
re-bake each character's hair in the salon (Bake), re-export it from the Studio, and look at it in Godot; tell us the
softness (`density`, `side_fade`), the highlights (`spec_gain`), the light through from behind (`transmission`): HSHair's
`BAKED` holds them. Open: the salon's live view still lights each card by its face; flyaways; a long cut's fan of
cards on the shoulders is the hairstyle's own. Open on
the skin: the eye's shadow fitted to each opening (the skin's `extras.openings` is in the file), wrinkle maps that
deepen with the 72 shapes, the clothes' fabric detail the same way, the desk (plain by decision).

## 0a. The cloud session after (2026-10-30, small hours): §0's four pieces built, and a stand-in bug from the user

All four of §0 are in, each measured where the cloud could (GDTESTROOM, GDEXPORT, GDPLAY, DESK, LOOKPLUGIN):
**the leak** (`use: leak`, GODOT_LOOK §2b: the wet shader's band on the wall below it, HSLeak's drips; the desk's
dark strip; the bath's west wall), **a mirror in a mirror** (§5b: each mirror on a layer of its own, 11 to 19; the
demo's second mirror), **the timeline's edits playing back** (GODOT_EXPORT §3: the scene player takes its eye from
scene.tscn's camera keys and the lines' and cues' moments from the method track, mapped onto the run by the seg that
plays the same; GDEXPORT moves a key and reads the eye moved) and **the bodies on the timeline** (a cast member's glb
instanced in scene.tscn with bone and blend-shape tracks from the bake, every third frame, only what moves: 35 bones
and 36 shapes for Aoi's lobby scene, 760 KB; GDEXPORT seeks it and measures the head bone on the recording's head
joint). **For the user:** open `Saved/Godot/TestRoom001/game/acts/02_n_hello/scene.tscn` beside the lab level and
scrub: the camera along the recording, Aoi moving; `python tools/godot/plugin_check.py` for the leak and the two
mirrors pictured on the card (the cloud's: `docs/godot_sheets/2026-10-30_leak_mirror.jpg`).

**The user's three asks after that** (2026-10-30, morning; "Ah that sorta worked"): (1) the visitor at the
peephole showed her back: not the level (her idle has `face: "player"`), the runtime: `standin_body` turned a
Studio export 180° on a wrong note about the stand-in's forward (it's +z, the desk's figure's), so every export
faced away from what it faced; worn unturned now, lookshot's `--cast` fixed with it, pictured from a metre in
front of her spot (GODOT_EXPORT §8). (2) **HSHair** (GODOT_LOOK §5c): the Studio's hair look on any imported
model's card hair, brows and lashes, with the PSX dither as the story's `hair` word (`{"retro": true}` on the
game or a cast member; `flat`, `steps`, `dither`, `gain`, `shine`, `soft`, `cut` each); worn by every stand-in and
every scene's body; the demo's `hair` stage measures it. (3) **Scenes play the designed character**: bakeplay
instances the Character Studio export itself (posed from the same skinning matrices: the bake was made on its
skeleton) when the story or the bake's index says the body is `people/<name>` (GODOT_EXPORT §8); the face stays
neutral there for now. Then **"why does it look so plastic"**: HSSkin wore the export's albedo alone, dropping
its normal map (the pores and wrinkles), its roughness map and its thinness; now all three and the `studioSkin`
record go on (GODOT_LOOK §5; GDPEOPLE measures the relief). Other realism enhancers for imported models still
open: a cloth sheen on the tailor's garments (their maps come across as albedo only), hashed alpha on hair
under TAA. Two more from the user's play: **the peephole wasn't drawn in Godot** (a bare node for the reticle;
now the desk's brass ring and dark glass, and the latch's thumb turn with it: GODOT_EXPORT §8), and **a door
they can't open on the desk but can in Godot**: not reproduced (the headless tests click the test room's doors
open); the likely causes given to them (the pointer lock not taken, a kit door's handle being a dumb mesh on
both runtimes, a story lock); awaiting what the reticle says there. If it's the handle: a kit door's
`attach:<door>` parts should count as the door for the reticle in both runtimes. And **thousands of VoxelGI
"bounds" errors** after their pull: a broken kept bake in `user://gi/`; validated, thrown away and rebaked now
(GODOT_EXPORT §8). **The lighting that changed with the look** (their last note before sleep: darker looking
down, bright gaps on the floor coming and going): three causes, each cut back (GODOT_LOOK §1, GODOT_EXPORT §8):
the iris's five-stop range (one stop now), SSIL at 1.2 (0.45, radius 1.2), the rooms' VoxelGIs at 64 cells a
metre into the neighbours (cells by the room's size, 30 cm past it); measured with lookshot pairs at the same
spot level and looking down, before and after (`docs/godot_sheets/2026-10-30_look_down.jpg`: in the corridor at
night the picture looking down was 0.70 of the level one, 0.79 after; the whole picture a third brighter after,
the finer VoxelGIs bouncing more); their three
pictures of a bright rectangle on a room's floor were the windows' shafts (a box of lit fog); made faint at night
first, then, after two more pictures (the strip at the wall's foot with a dotted edge, gone when far from the
window), the fog box replaced by a card (GODOT_LOOK §1c): the froxel grid can't draw a box's foot cleanly. **The desk's clicks** ("I still can't click or interact with anything
when testing via director tool, it used to work"): the reticle's ray hit the shafts' see-through boxes and the
patterns' planes before anything (the Light Kit pieces drawn on the desk since 2026-10-29): skipped now; and with
their decision (DECISIONS 2026-10-30) the desk lights plainly by default, no effects drawn at all (the toolbar's
Lighting shows them). **Overlit skin in Godot**: GDPEOPLE now holds the lit face within 0.85 to 1.15 of the
export's own plain material under the same lights (0.95 on `_studiotest`); if lol still glows, it's the room's
lights' energy on a brighter tone, or the SSS: `subsurface_scattering_strength` and `specular` in skin.gd are the
knobs. **The `index_array is null` error**: a glb surface with an index buffer and nothing in it (an empty
primitive in an export) is drawn every frame; loaded glbs are scrubbed of such surfaces now (play.gd
`scrub_meshes`, said on the console). **The cutscene lines not seen** ("I don't see dialogue in godot for cutscenes"): a new GDTESTROOM check (the
line's label visible with words through the lobby scene) found it: a scene holds the player and `play.hold` hid
the whole HUD, the footer with the lines in it; now `hud.held` steps the play HUD back and keeps the footer (the
lines, who, a reply's choices), the fade and the chapter card. The menu's `paused` is once each way too, and the
Subtitles on/off row is gone (the lines are the dialogue). If they still see none after pulling:
the label's words are the clip's `en` text (a game whose lines carry only `ja` shows nothing), and the HUD is
layer 10 over the grade (6) and the tape (5). **The grade** (their last ask: "post processing
so the game feels more professional, color grading, characters less like bright plastic"): HSPost (GODOT_LOOK
§1d), `cinema` on every game by default, the skin's gloss softened (§5); next for the characters, if they still
read as plastic on lol: a look at the stand-in under the lobby's lamps with `tools/godot/people_check.py`'s lit
pictures beside a Godot lookshot of her, and the clothes' maps (albedo only).

**Open: the user's stand-in bug** (2026-10-30, their words: "in director I chose an actual designed character to
test but in game I only see this base mesh; after switching to the designed character it now has weird splotches
of skin colour mixed with the default grey"). Not reproduced here: the cloud's `_studiotest` export worn by Aoi
(`previs_body: people/_studiotest`, a scratch export in `Saved/Godot/_peopletest`) is what the next lines check.
The first symptom (the base mesh) is `standin_file` falling through to the bake's body: the export copies
`Content/Studio/People/<name>/export/<name>.glb` into `game/people/` only when that file exists, so a character the
desk shows from `People/<name>/export/` but whose glb isn't named `<name>.glb`, or a stale copy already in
`game/people/`, would do it; the second (the splotches) is in HSSkin.wear on their export's meshes (the skin rule
by name, the albedo texture, the tone) or in that character's baked albedo itself. play.gd now prints a line per
stand-in at level load (`standin <cid> wears <file> (...): N skin surfaces on <meshes>`): ask the user for that
line from Godot's output, the character's folder name under `Content/Studio/People/`, and a run of
`python tools/godot/people_check.py --person <name>` on the card (GDPEOPLE pictures that export in Godot on the
skin shader: if the splotches are there, it's the export or the shader; if not, it's the stand-in's wear).

**The lighting handed to the user** (DECISIONS 2026-10-30, noon, after the scripted lightmap bake took hours in the
cloud): the export writes no lighting of its own (no VoxelGI, probes or lightmaps; moving things dynamic GI), the
runtime's `game.lighting` is `on` (the time of day's sky and sun unless a level has its own WorldEnvironment or sun)
or `off` (a flat test light); every export a new version folder (`Saved/Godot/<G>_v001`...; the checks in
`Saved/Godot/_check/`); the dialogue choice a glass panel of rows, clickable (it wasn't: a live scene passed only
the walking keys, and the mouse stayed captured). **Then the effects as drag-and-drop nodes** (GODOT_LOOK §0,
built): every effect a node in Add Child Node (`HS...`, an icon each) with its settings in the inspector, 33 ready
ones in `addons/horrorstudio_look/presets/` to drag from the FileSystem dock; they preview in the editor (rain,
wet floors, shafts, sweeps, patterns, flicker) and save only their numbers (a wet floor's, a pane's or a leak's mesh
gets its own material back before every save); a flicker light of the user's goes out with the story's power cut
(`hs_mains`). LOOKPLUGIN's new part runs the presets in a game and **in the editor itself** (`--nodes` alone). **For
the user:** open a level of the latest export, drag `presets/window_sun.tscn` or `fluorescent_tube.tscn` in, tune
it; tell us what's missing or awkward to tune.

**Then the user's three asks after trying them** (2026-10-30, afternoon, DECISIONS): **the window sun fitted to its
window** (HSLightShaft in the opening, an orange outline to size it, the opening swept along the sunlight to the
floor, its light aimed through: `docs/godot_sheets/2026-10-30_window_sun.jpg`); **choices wait for the player** (no
countdown anywhere, on the desk or in Godot; `default`, an ask's `secs` and a reply's `timeout` warned as unused;
the panel low on the screen while it's up); **only what can be seen is drawn** (every wall, floor and ceiling a box
occluder, occlusion culling on in the project, the story's lights fading far away; GDCULL measures it: 73% fewer
objects drawn across TestRoom001's 19 rooms, the pictures alike).

**Then, the evening** (DECISIONS 2026-10-30, evening): the user found the light leaking at the wall's top was the
sun's shadow (gone with the sun off), and the colour flashes were the corridor's fluorescent stutter. Built: **the
balanced look** (a GTX 1060 the target; the default `game.look`; its project settings applied by the plugin on enable
and written by the export, GDEXPORT reading them back; `look_balanced.tscn` for a project of your own) and **light
zones** (`HSLightZone` and the room_* presets: a room's box owning its lights, kept to it, reach fitted, off while
unseen; the export a zone per room). **Open:** the sun's leak itself (Sky Only indoors, or a tighter directional
shadow, or thicker overlapping walls and ceilings in the export: GODOT_LOOK's answer to the user's question 1, not
built); the baking of static lights is the user's, on their machine. **Last:** the choice back on one line
(two answers, a dash between, A/D and Enter), and **the Unreal side removed** before the merge into main (DECISIONS
2026-10-30, evening): the games are Godot's alone.

## 0. Next: the cloud session (left 2026-10-29, late night, on `godot-support`, after the local session on the 3090)

The user's handoff (their words: continue the ones that haven't been started back in the cloud, since the GPU-heavy
ones were done locally). Everything is pushed (`ca3e053` the last). Four pieces, in this order, each its own commit
with its checks before the push; all of them are code whose checks run headless (GDEXPORT, GDTESTROOM, GDPLAY take a
minute or two in the cloud), and only their pictures wait for the user's eyes:

1. **Wet walls under a leak** (GODOT_LOOK §7): a story word on a room or a prop for where water runs down a wall
   (grow STORY_FORMAT, `story_check.py` and the runtime in one commit, as the rule says; a name that isn't taken:
   `leak` on a prop with `at` and a `drip`), HSWet's wetness on a band of the wall below it (no pools, no rings), the
   drips as lifefx's (`lifefx.gd` has the tap's), a stage in the plugin's demo measured by LOOKPLUGIN (the band's glint
   over the dry wall), the desk's stage drawing the band dark and glossy as it does a wet floor. TestRoom001's bath
   gets one (its ceiling's old leak), GDTESTROOM checks the wall's material.
2. **A mirror seen in a mirror** (GODOT_LOOK §5b): HSMirror's viewport renders the room without the other mirrors'
   reflections (they draw their glass flat); one bounce more: a mirror's camera sees the other mirror's last frame
   (its viewport texture, a frame late), never itself. The demo's stage puts two mirrors facing; LOOKPLUGIN measures
   the bulb's glint twice in the first one. The cloud draws a viewport in a viewport slowly on lavapipe: keep that
   stage's views small (`HSMirror.attach(..., 288)` is the size) and expect the check to take longer than eight
   minutes there; the user looks at the picture on the card.
3. **The timeline's edits playing back** (GODOT_EXPORT §8, the editable layer's second cut): the scene player takes
   its camera and its lines' and cues' moments from `game/acts/<folder>/scene.tscn`'s Animation when the file exists
   (`story.gd` gets `edited_scene(nid)` as `edited_stitch` is; the camera track sampled by the bake's frame, the
   method track's keys mapped onto the timeline's clips by their order), so a camera key dragged in Godot plays;
   GDEXPORT edits a camera key in the file and sees the scene's eye move (as it edits a title now). The bake the
   checks need isn't in git (`Content/Games/<G>/Previs/` is ignored): `node tools/godot/bake.mjs --game TestRoom001`
   on the desk's server makes it (a browser job on SwiftShader: slow, it has worked there); it carries Aoi's
   `second` model and the lobby scene's pick, both in the pushed story.
4. **The bodies on the timeline**: each cast member's recorded skinning as bone tracks (position and rotation per
   bone from the bake's matrices, as bakeplay.gd poses them: every bone's global pose first, then local under its
   parent) and the 72 face weights as blend-shape tracks on the body's mesh, so the Animation moves her in the
   editor; keys thinned; the file size watched (a 24 s scene at 30 fps over 70 bones is large: every third frame
   and only the bones that move). GDEXPORT loads it and measures the head joint against the recording at a few
   frames, as GDTESTROOM does for the bake.

**For the user, after:** the leak and the two mirrors pictured on the card (`python tools/godot/plugin_check.py`), a
scene scrubbed in Godot's editor (open `Saved/Godot/TestRoom001/game/acts/02_n_hello/scene.tscn` beside the lab
level: the camera along the recording, Aoi moving once step 4 is in), and the three judgement calls below.

## 0z. The local session on the 3090 (2026-10-29, night)

The local session (docs/RUN_LOCALLY.md) ran everything the cloud couldn't, in CONTINUE's order, and fixed forward:
- **LOOKPLUGIN**: its ten red rows weren't the plugin. The check had set the cloud's lavapipe ICD path (absent on the
  user's machine: Godot fell back to OpenGL unnoticed) and Hyprland had tiled Godot's window to 941 × 1030 (every
  pixel box off). Every Godot script now sets that ICD only when it exists, fails on an OpenGL fallback, prefers Xvfb
  (the card draws through Vulkan there; no window to resize), makes the check projects unresizable, and the demo runs
  at `--fixed-fps 60`; the demo's sweep measure was passing by accident (its beam never crossed the camera's view in
  sequence) and aims across the room now. LESSONS has both. 29 s on the card, all green.
- **TESTROOM**: green first time in 3.2 min, the typed thought included: the cloud's reds were SwiftShader's frame.
- **PLAY**: red three times, each a pacing race in the check hidden by the cloud's slow frames (the name box's focus,
  the eye still rising after a crouch, the glimpse beat's own 1.4 s): fixed in the checks, and the HUD focuses the
  name box at once (LESSONS). GDPEOPLE: the pupil finder caught the character's black fringe (the cloud's test
  character is bald): the Godot side writes the eyeball's radius on the picture, the finder looks only inside it and
  the hair is hidden for the eye pictures; `--person lol` here.
- **GDTESTROOM** green; then the pieces in Godot (`tools/godot/sheet.py`, `lookshot.gd --sweep=<room>` holds a car
  mid-pass): the **sweep** got in only after three fixes (the export's panes cast shadows; the test room's car ran
  past the yard's wall, `out` 2.5 now; the lamp's fog glow made the window a white card, 0.15 now): GODOT_LOOK §1d,
  `docs/godot_sheets/2026-10-29_local_sweep.jpg`. The **shafts**: a ladder of strengths 0.5, 1, 2, 4 by day and at
  dusk for the user to pick from (`2026-10-29_local_shafts.jpg`): 1 already reads as a beam by day on the card, dusk
  is too weak for any, night has no window light. The **yard's caustics** reach the lobby's wall (faint at the
  story's scale, `2026-10-29_local_sweep.jpg`'s last cell). The **square light patch under a distant counter**
  (GODOT_LOOK §7) didn't show from the kitchen's door at day with GI and SSIL flipped either way: ask the user which
  counter and room, and what time of day.
- Playwright on this machine: the global install is missing; `NODE_PATH=<a folder with playwright@1.56 installed>`
  matched the cached Chromium 1194 (RUN_LOCALLY's step 2 should say which version the cache holds).

**Decided after this (DECISIONS 2026-10-29, night):** no voiced lines for now (GODOT_EXPORT §8's voices step is
skipped; a typewriter blip only after a playtest), **Godot 100%: every Unreal goal is scrapped** (§4's Unreal
items below are void; the Unreal docs and code stay as history and as the numbers Godot matches), and **the motion
sets on the stand-ins wait** until the user says they've made some basic Kimodo sets (they'll say when).

**Then, the same night, the leftover Godot parts** (the user: "finish the left over godot parts"), each its own
commit: the desk draws the pattern, the shaft and the sweep (`tools/director/lightfx.js`; no shadow maps on the
desk: they broke every shader of the stage on the card); a cast member's models per scene in Godot; a `look` per
level; one rain box riding with the player; GDSTUDIO (the Studio's own render beside Godot's, measured); and **the
editable layer's first cut** (GODOT_EXPORT §8: every task a scene in `game/acts/` with its beats in the Inspector,
read back by the runtime when it plays; every recorded scene a timeline to scrub, its camera along the recording and
its lines and cues as keys; GDEXPORT checks both). **Left of GODOT_LOOK §7 and GODOT_EXPORT §3:** wet walls under
a leak and a mirror seen in a mirror (not started); the timeline's edits playing back (the scene player taking its
camera and cues from the Animation when one exists) and the bodies' bone and blend-shape tracks on it; a per-scene
look preset would need a word that isn't `look` (that's the look-at).

**Open, for the user:** pick a shaft strength from the ladder (or leave 1); say where the square light patch was;
whether the splashes' glints read at a real frame rate (only the game itself shows that: `godot-mono --path
Saved/Godot/TestRoom001`); run the game and look at the car passing the lobby's first window (every half minute at
night) and the yard's caustics. **Then** §3 below and GODOT_LOOK §7.

3. ~~What the desk doesn't draw yet of the five~~ Done (2026-10-29, night): the desk draws the pattern itself (the
   same four functions in JavaScript as the spot's `map`), the shaft (a see-through box along the window's light) and
   the sweep's shadows (`tools/director/lightfx.js`, stage.js's shadow maps), and "A car passes" is a quick beat.

## 0b. Latest (2026-10-29, on `godot-support`): the test demo plays in Godot, with its look, effects, sounds, menu and guide

The user said keep going till the test demo is 1:1 in Godot (DECISIONS 2026-10-28, late night), and mid-way asked
for a search on realistic smoke and steam (docs/research/godot_smoke.md). Built, each its own commit (the log from
`09b5f28` to `a4dfb58`), the checks ok before each push (GDEXPORT, GDPLAY, GDTESTROOM, GODOTLOOK, DESK, CMDS):
- **The runtime**: the desk's Play ported to GDScript; **GDPLAY** (the Pilot) and **GDTESTROOM** (TestRoom001's 21
  stations, the death and retry, the doll's cutscene); the desk's own TESTROOM ran here and its states agree.
- **The scenes from the desk's recording** (`tools/godot/bake.mjs`, `bakeplay.gd`): the camera, the shaped MHR body
  posed from the skinning matrices, MHR's 72 face shapes as the body's morph targets, every reply branch its own
  recording, the lights' flicker.
- **The things' meshes** (the kit's glbs and the library's instanced in their blocks), **the little things' effects**
  (`lifefx.gd` at the kit's sockets; the puffs through `puff.gdshader` after the smoke research), **the sound shelf**
  placed in the room, **physics** (the thing in the hand, the plushie, the die as a rigid body), **the pause menu and
  the HUD's themes** (`menu.gd`, `theme.gd`), **the guide** in every export (`storykit/godot_guide.py`), **the
  desk's Godot button** (the bake, the zip, the guide), the launcher's Godot section, `--node=<id>`.
- **The look**: **UltraVHS** as `vhs.gdshader` (GODOTLOOK measures it against the plugin's reference; `game.vhs` the
  new story word), **Light Kit's times of day** as nodes (the sun, the sky, the haze, the grade), and **the lighting
  trial** (GODOT_PLAN §4: a VoxelGI per room baked at run time gives the bounce, SSAO the corners; SDFGI and a
  level-wide VoxelGI miss the greybox's thin walls; the sheets in `Saved/Story/TestRoom001/godot_reference/`).
- **2026-10-29, afternoon and night** (DECISIONS that day; the user away about seven hours, the checks run here one
  at a time, each step its own commit, `6a5765c` to the last): **the inventory's row as the things themselves**
  (`hud.gd`: a slot a small viewport of its own world, only the shown ones drawn); **the HorrorStudio Look plugin**
  (`GodotPlugins/HorrorStudioLook/`, docs/GODOT_LOOK.md, copied into every export, the user's "keep our plugins in a
  folder that gets passed in"): the pseudo-realism preset (SSR, SSAO, SSIL, glow, a thin haze, AgX, TAA alone since
  MSAA switches SSR off; the pause menu's Graphics rows pare it back), UltraVHS and the puffs moved there, **the tape's
  persistence**, wet floors with pools and rain's rings, puddles as decals, blood (a `clean` stain of kind blood wears
  it), rain in every room with no ceiling (`game.weather`), **window panes** written by the export with the rain
  running down them, wet and oiled skin on HumanShaders' skin shader, **the Studio's eye** (the refracting cornea as
  a shader; Godot's binormal runs the other way: `handed` −1); `game.look`, `game.weather` (STORY_FORMAT §9.1);
  LOOKPLUGIN pictures and measures each part, GDPEOPLE a Character Studio export on the skin and the eye (flat-lit
  against its own paint; dry, sweating, oiled; the pupil moved by the cornea). **The shelf's texture sets on the
  rooms** (world-aligned materials, `game/textures/`), **the little things' sounds** (`lifesound.gd`, the recipes
  rendered into loops), **the re-export's receipt** (`.desk/manifest.json`: a file changed by hand kept, the new one
  beside it), **the cast's stand-ins as their bodies** (the bake's shaped body or a Studio export, arms down), every
  baked body on HSSkin. TestRoom001 rains in its yard, its lobby's windows wear the rain, its second chores stain is
  blood, four rooms wear the demo shelf's sets. The night's pictures: `docs/godot_sheets/2026-10-29_look.jpg`.
  **Later that morning**: the desk's stage drawing the `skin` word (`tools/shared/skinwet.js`), **rain splashes**
  where the streaks land (`splash.gdshader`), **real mirrors** (`HSMirror`, GODOT_LOOK §5b: the camera reflected into
  a viewport of its own, every kit mirror in a game; the bath's checked, a picture of it in the guide); the rain
  heard all round you in its room and every step there wet (the desk too); a level's own `weather`; LightmapGI
  ruled out (editor-only); the rain lit by the lights that reach it; the re-export's receipt leaving Godot's
  sidecars alone (they'd been taken for stale); the mirrors on the menu's Reflections row; the guide's own pictures
  made at the export (`--pictures`, the desk's button too); a room's own `wet` (the bath; the desk's stage shows a
  wet floor dark and glossy, Godot gives it the pools); a cast member out in the rain wet by herself, dry again
  indoors (Aoi at the front door). The checks that morning: STORY, DESK, CMDS, REFS, KIT, DASH, LOOKPLUGIN,
  GDPEOPLE, GODOTLOOK, GDEXPORT, GDPLAY, GDTESTROOM, TESTROOM, all ok before each push. The morning's pictures:
  `docs/godot_sheets/2026-10-29_morning.jpg`.
**The user's first run in Godot (2026-10-29, midday)**, and what it changed (DECISIONS that day, their words): the
desk's Godot button writes a plain project and no windows; `HSLookEnvironment` for the look in the editor; the
seams that turn the eye (`glance`, `cutaway`) deprecated and the games' glances blinks; **live scenes**
(`camera.mode: live`, DIRECTING §1: the eye stays the player's, no cuts, look and walk, a 180° look seated; the
lobby scene is live); a card closed by a click (Godot: taken in `_input`), the thing looked at staying put, no dot
over a card; **Q lowers the thing in the hand**. **Their second run** (the afternoon): the lowered hand hidden in
Godot too (its copy was shown again every frame); **the exported level in folders by kind** (Ground, Walls,
Ceilings, Doors, Things, Lights, Glass, Triggers, Spots, People, GI; `game.pieces()` reads through them); **the
`camhybrid` tape** (VHS.md §5: the camcorder with half the fisheye and its blur only with distance, `HSSoften` a
depth-aware softener on the camera; `docs/godot_sheets/2026-10-29_camhybrid.jpg`). **Their third**: under camhybrid
the LED digits and the steam had vanished (the softener had been a quad over the screen texture, the opaque pass
only); it's a CompositorEffect after the transparents now (`2026-10-29_camhybrid_led.jpg`). **Then, that evening**:
`camhybrid` at the strength they picked from seven (between B and C), softer shadows (the filter, the atlas, the
lights' size and blur, the menu's Shadows row), the rain's splashes without rings (glints and thrown droplets, the
wet floor's ripple per pixel), and **the five Light Kit pieces the Godot side lacked** (their "build all five"):
flicker `mode`s (fluorescent, dying, candle, pulse, custom; the same curves on the desk, `tools/shared/flicker.js`,
and in Godot, `flicker.gd`), light `pattern`s (caustics, leaves, blinds, clouds drawn into a shadowed spot's
projector, `HSPattern`), window `shaft`s (a FogVolume along the window's light, `HSShaft`), window `sweep`s and the
`sweep` action (a car's headlights sliding past, `HSSweep`) and the iris (auto exposure, a stop under at night,
`HSLook.iris`); GODOT_LOOK §1 has each with its measure; TestRoom001 wears one of each. Open from those runs: the
square light patch under a distant counter (GODOT_LOOK §7).

**Open, for the user:** a run on the 3090 (`python tools/godot_export.py --game TestRoom001 --testroom`, then the
game itself: `godot --path Saved/Godot/TestRoom001`; the cost of the realism preset with nineteen VoxelGIs, the rain
and the wet floors there; `tools/godot/plugin_check.py` and `people_check.py` for the plugin's pictures), a look at
the sheets (the night's and the morning's: does the wet floor, the blood, the rain on the glass, the sweat, the
splashes and the mirror read as meant; the arms-down pose of the stand-ins; the eye's size), whether the realism
preset's numbers (GODOT_LOOK §1) want pushing further or back, whether the puff shader should go back onto the desk's
stage, and whether a mirror should be drawn for real on the desk's stage too (today the desk's mirror is a metallic
grey; Godot's reflects). **Next** (GODOT_EXPORT §8, GODOT_LOOK §7): ~~the
voices (the takes' audio)~~ (scrapped, DECISIONS 2026-10-29, night), the Inspector resources and AnimationPlayer timelines (§3: the tasks as scenes with their beats in the Inspector built 2026-10-29, night, read back by the runtime; the scenes written as timelines to scrub (the camera along the recording, the lines and cues as keys), their edits not played back yet), ~~a cast member's models per
scene~~ (done 2026-10-29, night, GODOT_EXPORT §8), the Studio's paint and eye measured beside the Studio's own render (the three.js side), ~~the motion sets on
the stand-ins (GAMEPLAY_PLAN)~~ (waiting on the user's Kimodo sets), ~~splashes where the rain lands~~ (done that morning); and from GODOT_LOOK §7 that night: a `look` per level (STORY_FORMAT §2) and one rain box riding with the player (GODOT_LOOK §4, `docs/godot_sheets/2026-10-29_local_rain_follow.jpg`). (The desk's stage draws the `skin` word since the
morning of the 29th: `tools/shared/skinwet.js`, GODOT_LOOK §5.)

## 0a. Before that (2026-10-28, night, on `godot-support`): Godot started, the export analysed, waiting on the user

The user said to start the Godot side (DECISIONS 2026-10-28, night; the plan docs/GODOT_PLAN.md): main (`dev-002`)
merged in, Godot 4.7 set up on the cloud (`tools/godot_setup.sh`, GODOT ok: headless and a picture under xvfb on
lavapipe), **GDScript** chosen over C#, and the analysis the plan asked for before building: **docs/GODOT_EXPORT.md**
(a plain-Python exporter writes a Godot project per game as text `.tscn`/`.tres` plus copied assets, zipped; the
runtime as an add-on; scenes as AnimationPlayer timelines; beats as Inspector resources; the re-export's receipt;
the order). **Waiting on the user:** GODOT_EXPORT §4's three choices (numbered folders or stable ids; baked
animations; GDScript only) and a yes to its §8 order. Then its step 1, the trial: the Pilot's hall exported by a
first cut of the level writer, lit three ways, pictured at three times of day and with the power cut.

## 0. Latest (2026-10-28, night, on `dev-002`): the director's to-do built, the Studio's eyes, nose and face bake

The user's asks this session, each its own commit:
- **Merged `game-research-001`** (44773fe: The Visitor's research, abstract and chart, docs/HANDOFF_DIRECTOR_TODO.md)
  and built its to-do: §1 to §6 and most of §7. The handoff's top lists the commits and what's still open: the
  answering machine, the fireworks, the Obon kit pieces, the second tea secret, Build carrying a talk's answers' `go`.
- **The Character Studio**, from the user's report and asks:
  - the eyes vanished seen from the side: each eye its own stencil, the opening walled and arched into a smooth mask
    after the user's red masks, the white's paint fading side on (1d595ff; LESSONS 2026-10-28);
  - the hair's dullness after the bake: the user said leave it (a shader matter for Unreal later, maybe);
  - a small nose: **Nose size** and **Nose projection** in the sculpt (aa7188c);
  - **Bake the face**: the fit kept in `face.bin`, so the reference pictures can go (d5fa64b).
- **Waiting on the user:** a look at the eyes from the side, the nose sliders and the bake; The Visitor's
  `/build-game` once they say its chart looks right (below).

## 0v. Before that (2026-10-28, evening, on `game-research-001`, off `dev-002`): The Visitor, steps 1 and 2

The user started a new game (DECISIONS 2026-10-28, evening): The Visitor, set in Japan in one apartment, an old friend
and crush who comes to visit. Their three steps are research, an abstract, and (once the abstract is approved) the
writer block flow. On a new branch off `dev-002`, in a new folder:
- `docs/game_research/README.md`: the folder (one per game, the three steps).
- `docs/game_research/TheVisitor/01_research.md`: step 1, sourced. Missing people and jōhatsu, the seven-year
  declaration and the mourning postcard, homes that hide things, impostors, the dead who visit (Tōno, Ishinomaki,
  *Ghosts of the Tsunami*, itako), New Year's Eve (ōsōji, soba, the 108 bells, raihōshin, marebito, Somin Shōrai, the
  Fire Horse), folk tells (moshi moshi, salt, Kagome Kagome, the prohibition of looking, fox possession), the mind
  (Capgras, paranoia and faces, Japan's rename, the props of treatment, care), and the shapes we borrow.
- `docs/game_research/TheVisitor/02_abstract.md`: step 2, the pitch. New Year's Eve; Haruki, and "Natsumi" (her
  younger sister Fuyumi playing her); the believability ladder; what really happened; how it plays (tasks, the hidden
  clean-up, talks read by the face with an unreliable narrator, the pills); six parts, about 75 minutes; three endings
  (First Light, Kamikakushi, Shiki); about two dozen achievements; the lines, the faces, what we have and what's new,
  care notes and five questions for the user.
- **Revised the same night** after the user's notes (DECISIONS 2026-10-28, night): a summer day (16 August, the last
  day of Obon, the anniversary), lilac eyes (her lenses) instead of the mole, his mother's first Obon, and a second
  mystery about Haruki himself, told by his own answers, thoughts and hands; research §5b for the summer.
- **Revised again** (DECISIONS 2026-10-28, late night): the sister, Natsuki, is honest and he's too ill to see her
  (the names one letter apart), they were thirteen so no police ending (Okuribi now), the pills as to-do tasks, the
  secret ending (Mō ii yo) off the pills with the call and the geta.
- **Third pass** (DECISIONS 2026-10-28, small hours): the pills decide what you see (his romance or her real faces,
  her name, her eyes, her corrections; reflections always true); no confession; three endings, three pieces of the
  truth (Okuribi, Thank You for Tonight, Don't Let Go with the police); the branches are secrets. Three questions at
  the end of the abstract.
- **Fourth pass** (DECISIONS 2026-10-28, before dawn): no reflections; the endings as cutscene slots with rough
  outlines and a title card each; shinkei-suijaku as the card game, its settings by the pills; her cigarette in the
  building's little garden instead of the lanterns; the small moments of a visit, with memory flickers.
- **Fifth pass** (DECISIONS 2026-10-28, morning): he is the reason she died (a fight in the shrine woods at sixteen
  over the boy she was seeing, a shove, the river); Shun, the boy the town blamed; Ren, Natsuki's boyfriend, the echo;
  the dark ending is Stay.
- **Approved** ("a strong start"), and **step 3 charted** (DECISIONS 2026-10-28, mid-morning): the writers' room
  session `the-visitor` (59 shapes, 0 problems, 23 sticky notes), made by `/chart` from the abstract.
- **Rewritten as pseudo-code** (DECISIONS 2026-10-28, late morning): 52 shapes, 0 problems; literal lines only.
- **The director's to-do for after the merge**: docs/HANDOFF_DIRECTOR_TODO.md (a conversation card with Next, Skip,
  End and Go to per answer; cutting and re-attaching the flow on the wire; Build moving only dialogue, tasks and
  gameplay; a body track per cast member through a shot with states and patrols; what The Visitor needs). Not built
  here: the user merges this branch and asks the next session.
- **Waiting on the user:** a look at the chart in the writers' room; `/build-game the-visitor TheVisitor` once they say
  it looks right. Then step 3: the flow as the writers' room's
  chart through `/chart` (the chart's script written from the abstract, `room.py import`, shown to the user), and
  `/build-game` only once they say the chart looks right. Nothing is built yet, and there's no game folder in
  Content/Games.

## 0'. In parallel (2026-10-28, back, on `dev-002`): TestRoom001, the Unreal note, skin like HumanShaders, expression loops

The user's four asks (DECISIONS 2026-10-28, back), each its own commit:
- **TestRoom001** (docs/games/TestRoom001.md): a lab of stations, a feature of the format each, its to-do list the
  checklist; `node tools/director/testroom.mjs [--from n_station]` (TESTROOM) plays it start to end in the simple view
  and writes the desk's reference for Unreal (`Saved/Story/TestRoom001/reference/`). Building it found and fixed in
  Play: `use_on`, `swap`, `jumpscare`, `take` leaving the row, a switch's own light, a beat's instant actions run
  together, beats hearing an event before the to-do list, the reticle through a kit door's frame, a checkpoint keeping
  the pocket and the little things (a retry used to empty them), a skipped scene's state cues; the simple view drawing
  only the rooms in sight (Play was a frame a second on its 23 rooms); the checks for a second level; and the story
  check's new warning for a task that would end its station before its own beat (LESSONS: the last tick).
- **The Unreal note** (docs/UNREAL_NEXT.md): what the next local session does, top to bottom: S5, TestRoom001 into
  Unreal, the preview (faces now too), the StoryRunner built to Play's parts with TestRoom001 as its acceptance test
  station by station, the skin, what's built but untested in the editor.
- **Skin like HumanShaders** (`tools/shared/skinlight.js`, `tools/character/thin.js`): the Studio's skin lit per
  colour through smoothed normals and wrapped, light through the thin parts, two highlights (Skin, Light on the skin);
  the export bakes the colour, a normal map and one map of roughness and thinness with the light's numbers; the desk
  lights a Studio export the same way; `storykit.people` makes M_StudioSkin for Unreal (untested in the editor).
- **Expression loops**: a loop cut from a range in the preview (↻ cards, the wrap blended), and **face rows** on a
  scene's timeline (`faces`, STORY_FORMAT §3.7): dropped or double-clicked on, crossfading, a loop until the next; the
  stage, the Watch and Play's scenes wear them; the bake carries them for Unreal. TestRoom001's lobby scene has one.

## 0''. Before both (2026-10-28, on `dev-002`, the user away five hours): seven of Chilla's Art's small systems, skin v2

The user's brief (DECISIONS 2026-10-28, later): add the simple systems we're missing for Chilla's Art-style games,
else research realistic skin (v2, like MetaHuman and their three stills). Both, each step its own commit, PLAY and
CHECKS passing before each push:
- **The controls' symbols** on the pause menu redrawn as the Studio's own (frosted keys on their lips, W A S D a pad
  round you, a mouse without a cable, what each does beside it in the accent).
- **The flashlight** (`play/torch.js`): an item with `torch` goes in the pocket; F switches it; the story's `torch`
  flickers it, kills it (F only clicks), brings it back; `{"torch": "on"}` hears F. The pause menu shows F once it's had.
- **Cleaning** (`use: clean`, `play/clean.js`, `stain.js`): a stain scrubbed away by holding the left button, with the
  mop in the hand if it says `with`; a ring fills, the blot fades; its `use` ticks the chore.
- **The peephole** (a door's `peephole`, `play/peephole.js`): the eye to the lens, the other side through a wide lens
  in a round hole; `{"peeping": door}` holds meanwhile.
- **The power cut** (`power` action and trigger, `use: breaker`): every bulb and lamp in the level dark (candles and
  fires burn on), the switches dead, till the breaker box.
- **Footsteps** (`play/steps.js`): the player's steps by the room's `floor` (the format always said it sets them), a
  step a stride of ground covered, softer crouched, a creak now and then on wood, never the same sound twice running;
  and the cast's, heard from where they walk (through walls, fainter with distance), hidden in a locker too.
- **Examining** (`play/examine.js`): a small `inspect` thing (0.6 m or less) is taken up in the hands, the thing
  itself in front of the eye; a drag turns it (the Pilot's photo turned over), its words under it, Esc puts it back.
- **The latch** (a door's `latch`, `play/latch.js`): a thumb turn on the inside face; a click locks the shut door or
  unlocks it; from outside it's Locked; it undoes only its own lock (the Pilot's front door, slammed and locked
  behind you by the story, won't turn); `{"locked": door}` holds while it is (lock up, then the handle turns).
- **From the user's notes** (`/chart`, `/build-game`): the chart script reads a mess to mop (a stain), the fuse box (a
  breaker), a peephole, a flashlight, the power going and coming back, and locking a door (its latch); the build places
  each.
- **Skin v2** (docs/research/skin_v2.md, `skin_v2_sources.md`, `skin_v2/`): the stills measured (a very low-chroma
  lit cheek, the red where the blood is, sparkle at the pore field's density, lip lines 1 mm, an 8:1 key), our skin
  against them, the plan in eight steps each with its number. Step 1's light is built as an option: the Character
  Studio's **reference (film)** light (lit to shadow 7.7:1, the lit cheek L\* 62, a\* 3.5, b\* 7.6 against the stills'
  57-63, 2-6, 7-8), the old emissive glow off under it. The rest is the user's call (§6 of the note).
- **Quick events** for them on the desk (`templates.js`): *A chore: clean up a mess* (on the to-do list, its stain
  given the mop it needs), *A chore: lock the door* (its door given a latch), *The power cut* (find the breaker box), *A knock at the door* (its door given a peephole;
  someone shown while you look, gone after), and the quick beat *The flashlight flickers* (or dies). The pickers know
  stains and breaker boxes; DESK builds each into the Sample.
- **Fixed on the way:** a scene played from the peephole left the eye at the lens; the Esc that closed a card (a note,
  an inspect card) or put a thing back also paused the game; a story sound placed at a cast member played from
  nowhere in particular (the stage's cast are figures: `.group` is where she is); and the desk's **saves kept** list
  (the toolbar's clock), broken since 2026-10-26 by an import inside the server's GET handler. LESSONS has each.
- **The guide's pictures** made again (`guide_shots.mjs`, GUIDE ok): the ten that had changed kept (the board with the
  new quick tasks, the command palette with today's commands, the problems panel, a task's beats, the script, the
  toolbar, typing, the pose picker, a round, the Watch), the others left as they were (render noise only).
- Not done: the shelf's own dirt and metal steps (they borrow carpet's and concrete's), and Unreal for all seven
  (RUNNER_SPEC says how).
- **The user's to decide:** skin v2 (docs/research/skin_v2.md §6: build the rest, in that order? the grade in the
  Studio's view or the game's? Unreal's Adaptive GBuffer for fuzz and glints?); the expression loops (task #6) still
  wait for their go-ahead; whether examining's 0.6 m (what's small enough to pick up) is right.

## 0b. Before that (2026-10-27, later, on `dev-002`): the story from your notes, through Claude

The user's notes-to-chart route went from a syntax they'd write in to **writing any way, Claude converting it**
(DECISIONS 2026-10-27, later). Built:
- **`/chart`** and **`/build-game`**, Claude Code skills in `.claude/skills/`: their notes (any notepad, docs/NOTES.md
  the few marks suggested) → Claude's script (`.claude/skills/chart/script.md`, the former syntax, read by
  `storykit/chartscript.py`) → `room.py import` → the writers' room's chart to inspect (format 3: each shape's script
  as `steps`, the things as `items` sized small, medium, large) → Build → the director, blocks to swap for real things.
- the writers' room page: the Notes tab is gone; a shape's script shows in the inspector; a session changed on disk is
  taken in by an open page (Ctrl+Z goes back), a stale save refused with the newer one shown.
- **English only** on the HUD (no Japanese over the lines) and every choice at the bottom centre: committed before.
- **Play's controls, as the user asked** (GAMEPLAY_PLAN §10): a left click uses everything, E shows or hides **the
  inventory** (`play/inventory.js`: one row at the bottom centre, the one in the hand in the middle and held in view,
  the wheel turns it, at most five shown, frosted glass fading at its ends), G puts the one in the hand down in front of
  you (no fall), Shift runs; the pause menu shows the controls on its left, as the Studio's own symbols since 2026-10-28
  (frosted keys, a W A S D pad, what each does drawn beside it in the accent). PLAY walks all of it (the faked pointer
  lock from the start, LESSONS). Not in Unreal yet (RUNNER_SPEC says how). The guide's pictures (`guide/help.jpg`) still
  show the old keys: `guide_shots.mjs` makes them again.
- **Sets** (`Content/Studio/Sets/`): the place designed first in the scene builder (its game picker's Sets, `+ new
  set…`), a small story of its own; `room.py build --set <name>` (and the Build dialog's *The place*, `/build-game ...
  set <name>`) builds the chart into its level: each place on its room, the things fitted round its furniture and
  doorways, a door the story opens one of its own; then Claude moves each block where the notes say (BUILD.md's first
  box). WRITERS builds the example and the fixture into the Pilot's house as a set; BUILDER makes, saves and borrows one.
Open: the expression loops and blends (EXPRESSIONS_PLAN §2b), waiting for the user's go-ahead.

## 0x. Before that (2026-10-27, on `dev-002`): the dashboard and the writers' room

Asked for two things: a dashboard to start and stop every tool, and a writers' room to prototype a game's story
before the director. Built, checked and pushed:
- **the dashboard**: `python dashboard.py` (root), http://127.0.0.1:8790: every launcher tool by section, the pages
  started, opened and stopped, everything else a job with its output (DASH).
- **the writers' room**, first with a local model drafting the story, then **changed course** (DECISIONS 2026-10-27,
  the change of course): the user writes the whole story themselves, no AI anywhere in it. `python
  tools/writers/serve.py` (port 8795) is a Lucidchart-like chart: shapes dragged from a palette (start, scene, talk:
  the L.A. Noire close-up with 2 or 3 answers, task, chapter, choice by the player, karma or an earlier answer,
  secret, ending, note), arrows from the dots, acts as frames; About (the brief, the feats), Cast & places, Faces
  (MiniMax post prompts from `Content/Studio/Expressions/prompts.json`). **Build** writes a rough working outline into
  `Content/Games/<G>/` (`game.draft`, `voice: "none"`, the board laid out as the chart, acts as `frames`) with
  `BUILD.md`, the handoff for Claude, and `faces.md`. docs/WRITERS_ROOM.md; WRITERS and WRITERSPAGE.
- the story format grew for it (STORY_FORMAT §9.1, §9.9, §9.13): `game.draft` (timing as warnings), `voice: "none"`,
  replies of two or three answers (the check forks on an answer a choice reads), and **achievements** (a secret, an
  ending or a flag; the desk's Watch toasts them).
- the example session `ticket-114` (the old model draft, upgraded to the chart) builds and passes STORY, LEVEL and
  SHOTS.

PLAY's bed step waited 8 s for a tween a software GPU takes about that long to finish; it waits 60 s now (LESSONS).
Open from the request: **loops and blends in the expressions** (a timeline range made loopable, the loop's seam
tweened; blending between several expressions dragged on): EXPRESSIONS_PLAN §2b, not started; ask first.

## 0y. Before that (2026-10-27, late night, on `dev-002`): simpler games, after Chilla's Art

The user deprecated quick-time events (the Pilot's grab and locker are dialogue choices now) and asked for a study of
Chilla's Art's games (docs/research/chillas_art.md). From its five suggestions they picked three (DECISIONS 2026-10-27,
late night), all built:
- **the to-do list** with tasks that can fail (`todo`, `tick`, `fail`, `untodo`; `ticked`, `failed`): the HUD's list
  under the objective; the Pilot's search lists the letter and the key;
- **nights as chapters**: a bed (`use: sleep`, gated by its `if` flags) and `chapter` (a title card, the time of day
  carried on after the task, an autosave); the Pilot's study has a bed for a nap ("Later · 02:13");
- **requests**: a task with a `who`; the asker waits, then walks off and sits (`behave` `go`, the `arrived` trigger);
  the quick task "Someone asks for something" (STORY_FORMAT §9.12). PLAY tests one on the Pilot's kettle.
No pocket phone (only analogue phones, if ever) and no ending cards (endings are cutscenes). Not yet in Unreal: the
list, the chapter card and `go` are desk-only (bake.js doesn't carry them). Next: ask what the user's doing; the
expression plan's steps 2 to 5 are still open.

## 0z. Before that (2026-10-27, night, on `dev-002`): the expression library

The user switched direction (DECISIONS 2026-10-27 night): English text with a typewriter blip instead of voices, and
a library of captured expressions placed on the timeline per character, with loops, reactions and look-at by angle in
play. docs/EXPRESSIONS_PLAN.md has the plan (steps 1 to 5). **Step 1 is built:** the desk's Expressions tab beside the
Inspector (import a video of a face, preview it on the default MHR, a cast member or a Studio export, name it,
Accept; cards are the character wearing the expression, played on hover, as the user asked; names only; the red ×
asks first); `tools/face_capture.py` (MediaPipe's 52 scores a frame, the head left out); Studio exports carry their
corners' MHR points so the desk plays expressions on them. The user's test video is in the library as
`pout_and_glance` (its curves; the clip stays on this machine). Open: a blink on a photo-fitted export closes only
part of the way (EXPRESSIONS_PLAN §1). Next: ask which of steps 2 (timeline), 3 (text and blips), 4 (play), 5 (Unreal).

## 0a. Before that (2026-10-27, evening, on `dev-002`)

`dev-002` is `main` with the four branches merged (`claude/inspiring-curie-fntkfv`, `easier-hair-editing`,
`eyelash-more`, `clothing-expanded`; only the docs conflicted, both sides kept), PR #4. Then the user put a Studio
character on the Pilot's Mari and it stood white: the export didn't carry the Studio's colours, which its shaders draw.
Built: **the export bakes them** (`tools/character/albedo.js`, DECISIONS 2026-10-27 evening, docs/CHARACTER_STUDIO.md
§3.1): the skin's every layer at 4096 px on MHR's UVs, each garment part's fabric on its own islands (the metres kept as
`uv1` for a PBR set's other maps), brows and lashes as their strands in their colours. STUDIO has a step for it.

Then two Play fixes the user found on the desk: a second playtest kept the first one's world (a door it opened stood
open, though the new run had it shut and locked: the stage's level wasn't rebuilt when a run first entered it; now it
is), and Esc in the pause menu reopened it (closing it asked for the pointer lock back and the browser took that same
Esc as leaving the lock, which pauses; closed by Esc it no longer asks). PLAY has a step for each.

Open: PEOPLE's eye close-up measures the white at 120 against its > 120 in the cloud container, the same on `main`
(likely the software renderer): run it on the 3090. The bake is the colour before the light; a roughness or normal
bake (the oily T-zone, the pores, the weave) would be the next step if Unreal's look needs it.

## 0b. Before that (2026-10-26, past midnight, on `claude/inspiring-curie-fntkfv`)

Asked: search for open horror sound libraries, then "add everything you can", make the strings swappable with notes,
put new instruments in the expanded scorer, and keep sound effects in the flow, not the orchestra (DECISIONS
2026-10-26, past midnight). Built, checked and pushed:

- **28 more CC0 instruments** in the score room from VSCO-2 CE and VCSL (`tools/score/fetch_samples.py`; docs/MUSIC.md §7).
- **String sets** (`js/32-strings.js`): Woohill's section, full, low, solo, eerie, glass. Pick one in the header or per
  favourite. Each has a note, and the cue says which set it suits.
- **The Expanded orchestra**: twelve cues for the new instruments (`js/66-expanded.js`), and the Instruments list.
- **The sound shelf** (`Content/Studio/SFX`, `tools/sfx.py`, docs/SFX.md): 240 CC0 sound effects. A story sound names
  one as `sfx/<name>`. The Database picks and plays it, Play and the Watch play it, and the Pilot's and Sample's sounds
  use it. SFX joins check_all.

Open: the levels between the added instruments are matched by loudness, not by ear; the user may want some louder or
softer (`adjust` in fetch_samples.py). The shelf sounds were picked by name and tags, not heard; swap any that miss in
the Database. Unreal doesn't import sounds yet (docs/SFX.md §4). Most sound sites (Freesound, OpenGameArt, itch.io)
can't be reached from a cloud session: `tools/sfx.py add` takes files the user downloads.

## 1. Where we are

**Last (2026-10-27, branch `clothing-expanded` off main; DECISIONS of that day): the clothes.** The Clothes tab's
**edit mode** (`cutedit.js`, `tailor/guides.js`: every worn garment as a film on the body with its cut lines, a skirt
as its rings, the handles and the sliders moving them at once, Bake cutting and hanging: a change took minutes before),
the **designer collection** (twelve outfits after the user's five reference images: a lace jeogori and a pleated mini,
four Korean street looks, a long coat over a turtleneck and wide jeans, two modern hanbok dresses, four menswear looks;
25 new designs, `open.shift`, `neck.rise`, a skirt's `straight` and `open.gap`, lined lace and sequin fabrics), the
outfits as **pictures** on cards in groups (`tailor/thumbs.mjs`, `Content/Studio/Clothes/thumbs/`), **hats** as
accessories. TAILOR checks the guides against the cuts; STUDIO has an edit-mode step and a beret. Then the designer
clothes were **reviewed by eye and fixed** (TAILOR.md §2b: a built shoulder for jackets, `ease.shoulder`; blazers and
the coat cut open, `open.closed: false`; quiet fabric tiles; a soft turtleneck; jeans that keep their cut).

The user left a list before going AFK (DECISIONS 2026-10-24, small hours); all of it is built, checked and pushed:

| Commit | What |
|---|---|
| `bedf5b7` | **UltraVHS's night mode**: at night black records as a cool blue (0.02, 0.03, 0.05), not the camcorder's warm lift; `r.UltraVHS.Night`, `SetNightMode`; Light Kit's sky turns it on at Night. |
| `5e99709` | **Day or night per scene** on the desk: a scene starts at the time of the scene it branched from, changed by hand (`time`; `game.time`, default night); the stage's sky, ambient and a light in every window by time (`TIME_LOOK`); into Unreal through Light Kit's sky. TIMES. |
| `485a3a7` | **The plugins into any Unreal project in one command**: `python tools/unreal_plugins.py on UltraVHS LightKit [--project X.uproject] [--build]`; Light Kit builds its own materials on the editor's first start. |
| `896a052` | **The same look in Blender**: `tools/blender_look.py` (Light Kit's day, dusk and night, UltraVHS's camcorder as compositor nodes, window lights, the handheld drift), docs/BLENDER_LOOK.md, BLENDERLOOK measured against UltraVHS's reference. |
| `e9cb763` | **Accessories** in the Character Studio: glasses (six styles), piercings, stickers, an eyepatch with its strap, a choker or chain; held to the skin's triangles so they ride every expression; Place by clicking. |
| `a7ebc1a` | **Export for desk / Unreal, and Import**: one GLB of the character (neutral, the eyes' openings cut) carrying its recipe, every file it's made from; Import brings it back editable (CHARACTER_STUDIO §3.1). |
| `c55732d` | **Things you carry and board games in Play**: `use: carry` (hold E to pick up, hold E to put down; physics kinds `rigid` and `plushie`: lag, squash and stretch, the top's flop, a soft landing, on any mesh; `carrying`, `dropped` `in`) and `use: game` (rules as JS modules in `Content/Studio/BoardGames/`: Russian roulette, high dice, chō-han, spin the cup, find the ball, high card, blackjack; `played` `result`). BOARD; PLAY walks both. |

Earlier the same night (before the list): the eyes' iris softening, eye occlusion and tear line, wet teeth, lipstick
with a guide, soft hair edges, the default "soft cinematic" look after the user's reference.

Then (2026-10-24, the user back), three more asks, built, checked and pushed:

| Commit | What |
|---|---|
| `ff4d1f8` | **Jewellery** (`jewellery.js`): heart lenses; earrings (stud, pearl, gem, huggie, hoop swung clear of the jaw, drop, chain drop; pairs mirrored); a nose hoop and a septum ring; metals by name, the colour, or a PBR set off the shelf; domed charms; **necklaces dropped by gravity** onto the body (chain, pearls, beads, cord; a choker snug round the neck's narrowest part, Looser lets it out), their length kept. The Studio's `open()` guarded against an earlier load finishing last. STUDIO `ONLY=<words>` runs just some steps. |
| `a3c044e` | **Fingernails** painted on the skin (`nails.js` finds each nail on MHR's fingertips once; the skin's shader paints the nail, its half moon, the free edge, the cuticle) and **nail polish** (full, French, half moon, ombré, tips, dots; gloss, matte, chrome, glitter, jelly; presets; Look at the nails). |
| `b65b09c` | **Underwear** in the tailor, skin tight (`bra` and `brief` cuts): six bras, five thongs and briefs, four boxers; lingerie, sporty and boxer outfits; the garment picker grouped by kind. TAILOR ok. |

Then the user asked for a lead developer's review of the director's desk: its ease of use, adding Kimodo motions,
and blending between things (docs/DESK_REVIEW.md has the findings, what changed and what's still open):

| Commit | What |
|---|---|
| `da2674b` | A Kimodo walk **carries its actor into the next clip** (no snap back to the mark); the blend starts from the pose at the cut; the timeline's blend wedges; the clip's **motion picker** (made, its length, or not made yet). |
| `87ca35e` | **Kimodo into the desk:** a take imported again shows at once; Send to Studio by a segment's name links it; MOTION checks the shot list; partly made clips play; **inertial blends**; the blocking's stride eases; travel in metres (Mari stopped 5% short); the shot list's metres in Kimodo's scale; the demo runs in the project folder. |
| `59fbeed` | **Body layers** (`layers`: upper, arms, one arm, head, from a motion or a pose) and the **Kimodo segment editor** on the clip card. |
| `b919cbb` | **Ease of use:** Watch from here, undo and redo, a shortcuts list, clips move down, choices by count, the look row applies at once, Generate shows the checks' errors and gives up after 20 minutes, the launcher's number reopens a running page. |

Then the user parked NPC states (DECISIONS 2026-10-24, evening) and asked for the desk to be made much easier: an
intuitive drag-and-drop tool like RPG Maker MV, Claude as lead designer and UI artist. Built in four steps (docs/DESK_DESIGN.md
has the rules, the parts and how to grow it):

| Commit | What |
|---|---|
| `39eb4d8` | **An event editor after RPG Maker's**: every action and trigger as data (`commands.js`), a beat as an event page ("When the player picks up the doll" as a pill; its commands as sentences), the command palette with search, forms that pick from what exists, commands and beats dragged to reorder or into another beat. CMDS. |
| `1aa249a` | **The flow board by drag and drop** (`board.js`): cards dragged where you want them (`xy` kept in the flow), wired port to port, Scene, Task, Choice and Ending dragged in from the palette, the outline to find a node. |
| `194a91f` | **A scene reads as a script**: a row a line (the speaker in their colour, the words, chips for what's set), dragged to reorder; a line's settings in tabs; the reply as a form; a take's file dropped on its line is stored, measured and trimmed. |
| `ae51947` | **The Database** (`database.js`, `refs.js`): the game's settings, cast, items, notes, sounds, lines, motions, flags and counters, secrets and trigger cutscenes as tabs; each entry's uses, clicked to go there; a rename moves every use (REFS); `+ New…` in any picker. **The toolbar** in groups with icons (Save, Undo, Redo, Database, Playtest, Check, Unreal, Tools, Help); help as a dialog; a scene's look, trackers and see-through props as forms. |

Then the user asked for every further enhancement proposed for the desk, and an HTML guide to using it (2026-10-25):

| Commit | What |
|---|---|
| `cf7f719` | **Problems as you edit** (`lint.js`): each at its card, beat or line, in the Problems panel with the story check's own (run on the unsaved story). DESK. |
| `dff5cc6` | **Claude's edits merged** with the desk's (`merge.js`): a three-way merge, a toast of what came in with Undo, a question only where both changed one thing. |
| `a6ce6d2` | **Copy, paste and right-click menus** (`clipboard.js`): cards, lines, beats, commands; between games too. |
| `697d3d0` | **The debug panel** (F9 in the Watch, `debug.js`): flags, counters, karma, items live; beats as they fire; a start from any node with a state. |
| `3d70f39` | **Quick tasks and beats** (`templates.js`): a locked door and its key, a note, a chase... from a few blanks. |
| `1c342ec` | **Acts on the board** (the story's `frames`), Shift-drag box picking, the minimap. |
| `da6dfce` | **Ctrl+K goes to anything** (`goto.js`). |
| `3e4de9e` | **Pictures instead of names** (`pictures.js`): what the player sees on each line, faces, poses, motions; picker grids. |
| `0684564` | **A take's waveform** with its trims as handles; **cues dragged** along the timeline onto clip edges. |
| `3c42cfd` | **Blocking by mouse** on the stage (`blocking.js`, `marks.js`): drag onto marks or new ones, the right-click menu, the player's marker. |
| `219b28f` | **Reusable motions play**: behave's `motion` (format grown with the check), the seeker's loops by phase in the Watch's rounds, the motions table as pictures. |
| `d6b2c5d` | **Screenplay typing** (`screenplay.js`): "Mari: …" under the script, Edit as text, a pasted draft; lines kept with their takes. |
| `64e380b` | **A draft kept in the browser** and **the saves kept** (the toolbar's clock: what differs, bring one back). |
| `e94c1fc` | **The guide**: `tools/director/guide.html` (Help, Tools), its pictures made by `guide_shots.mjs`, which is also the GUIDE check. |

Then the user asked for immersion (2026-10-25): "kettle steaming, electric hob with leds, steam, cup of tea filling,
kettles etc, little things that help build immersion, maybe cigarettes, lit cigarette". Planned in docs/IMMERSION.md
and built on the desk, in six steps:

| Commit | What |
|---|---|
| `62d12ab` | **The plan** (docs/IMMERSION.md): the catalogue, a life per thing, the `state` word, the desk, Unreal. |
| `ea9964d` | **The things in the kit** (KIT.md §9), at their real size, with **sockets** where their effects come from: kettles (jug, gooseneck, whistling, tetsubin), hobs (ceramic, IH, gas konro), pots, cups (mug, teacup, yunomi, glass, takeaway), teapots, ashtrays, cigarettes, lighters, clocks, a rice cooker, a mosquito coil, incense, phones, taps, candles; 45 presets. KIT ok. |
| `288eb2f` | **Lives** (`Content/Studio/Life/lives.json`, `life.js`, `storykit/life.py`): states with timers, acts, a pot following its hob, a cup poured from its kettle; the word `state` (an action and a trigger) grown with the check, STORY_FORMAT and RUNNER_SPEC; the walker plays a `state` trigger through; Play's E does a thing's act. |
| `1e99bed` | **Effects** on the stage (`lifefx.js`), each a function of time: steam, a cigarette's smoke thread and its burn back, embers, LEDs, digits, glowing rings, gas flames, the fill and the pour, drips, screens (static, a call), a clock's hands. |
| `f3d6260` | **Sounds** (`lifesound.js`) made by Web Audio, no files, placed in the room: the kettle's rumble, its boil and click, a whistle, a hob's beep, the gas and its igniter, a pot's bubbling, the pour, a cigarette's crackle, a clock's tick, a phone ringing, static, a tap's drip and run, a fridge's hum, the rice cooker's tune. PLAY checks each renders and doesn't clip. |
| `7d07175` | **On the desk:** right-click the stage, *Add a little thing here…* from pictures; *It starts …* on a thing; quick beats (a kettle put on, a cigarette still burning, the phone rings, the TV on by itself, the clock stops); the Sample dressed (a kettle and tea in the kitchen, a clock at 2:47, a cigarette burning in the hall, a phone and a TV in the study). |
| `269780d` | **The guide's §11** (Little things, with pictures GUIDE makes), the state command's thing picked by its picture, a form's sentence following a picked state; CLAUDE.md, IMMERSION.md (§5: what goes to Unreal now and what's next). |

Then (2026-10-25, evening) the user, shaping a character, asked for the Character Studio to start from a pose like
their reference (a T-pose) and for a stomach that can be truly flat:

| Commit | What |
|---|---|
| `46f30f0` | **The Studio's view in a T-pose** (`pose.js` on MHR's skinning, `Content/Studio/Bodies/MHR_lod1_rig.bin` from `rig_mhr.mjs`): the arms level, the legs straight, the head untouched; the A-pose a switch in the view bar; the clothes, the circles, the accessories and the nails' close-up follow it; everything still saved and exported in MHR's pose. **Belly** in the sculpt: -1 a flat stomach. POSE (`node tools/character/posetest.mjs`), STUDIO's pose step. |

Then (2026-10-26) the user found the clothes lifeless and asked for a skin-tight slider, a cloth simulation with gravity
and a bake (DECISIONS 2026-10-26):

| Commit | What |
|---|---|
| `3eb3989` | **The drape** (`tailor/drape.js`, docs/TAILOR.md §1c): every garment that hangs falls by gravity onto the body and the clothes under it (XPBD in small steps: lengths, flat-rest bending held to the points' weight, tethers to where it hangs from, the skin's plane per point, friction), held round the neckline, by the waistband, under neckbands and ribbed cuffs and hems, tucked into what closes over it, buttoned fronts closed; fullness falls into folds. The details, buttons and handles sewn on the hanging cloth, the fabric's coordinates the cut's. **Fit** (0 skin tight, 1 as designed, 2 loose) per garment. The Studio: Hang by gravity, each garment's Hang (fullness, stiffness, weight), the cut at once and the hung clothes after (a newer edit stops the drape), baked as `drape.bin` and carried by the export. TAILOR drapes seven outfits on three bodies; STUDIO's drape step. |
| `d8f45ad` | **Sleeves inside sleeves** held as cut (a shirt's in a blazer's: the jacket was cut over the shirt's sagging sleeve and sagged again, ballooning from the elbow down; now 6.2 cm off the skin at most, from 7.9), and **the bake's key** covers what closes over each layer (a t-shirt baked alone came back untucked under trousers, 10.6 cm off); the **bending in each pass** with the lengths (a cardigan's sleeve rocked for ever at some stiffnesses and weights; now every combination settles). TAILOR checks the first two. |
| `d14f46b` | **Slim default bodies** after the user's references (DECISIONS 2026-10-26, later): the Feminine and Masculine bases refitted in `mhr.py` (body only, the heads kept), a base's sculpt (the feminine flat stomach) in the presets, the slider's middle halfway between them; the Studio, the check and the sheet build them alike. **Sleeves end at the wrist:** the frame's wrist round each slice's middle, the elbow a forearm up from it, both within 2.7 cm of MHR's joints, TAILOR holds them there. |
| `6aea007` | **Clothes tailored after the references:** tops cut close and following the waist (tension about halved, a third less ease, the drape's fullness only for soft folds), a **blouse** and one with its sleeves rolled, the pleated skirt high, mid-thigh and full, the pencil skirt high and close, a **fitted blazer** for women, the men's suit closer; outfits `school uniform (summer)`, `office (pencil skirt)`, `skirt suit`, `shirt and shorts` (a fit of 1.5 carried by the outfit), `t-shirt tucked in`; TAILOR hangs them. |
| `6c65afd` | **Lashes over the lid's rim** (DECISIONS 2026-10-26, evening): MHR's lid line is the rim's back edge, so lashes rooted there and sent straight out ran under the rim's skin for 3 mm and a band of bare skin showed between the eye and the lashes. `rimOf` (`index.html`) finds the rim's front edge from each point of the line (the skin's most forward point a little out from it, at most 3 mm, fading at the corners) and the way over the rim's rounded skin by rays; the lashes lie along it and lift from the front edge, the lash line is a strip along it, and the way fades as the eye shuts (shut, they're rooted on the line as before). STUDIO measures the way over the rim: 2.0 mm on average open, 0.2 shut |
| (this) | **The T-pose's neck upright** (DECISIONS 2026-10-26, evening): MHR's rest pose carries the head 6 to 7.5 cm ahead of the shoulders, the neck leaning far forward; `pose.js` moves everything under the head forward, level (the neck's joints part of the way by their height), until the head's joint is `NECK_AHEAD` (0.12 of the neck's height, about 2.2 cm) ahead of the shoulders': the ear over the shoulder's top, the neck's front under the jaw leaning about 14° in the side view (29° in MHR's pose, about 8° in the user's reference). The head stays put to the last bit; the salon's baked hair below it goes with the body (`shiftAt`, `poseHair`). POSE and STUDIO judge the head by its own bones now (by height, the skin under the jaw counted as head) and check the stand |
| `easier-hair-editing` | **Easier hair editing in the salon** (DECISIONS 2026-10-26, later still; docs/SALON_REVIEW.md, docs/SALON.md): the user asked for a list of what's hard about making hair, then "Add all the above and make the flow easy to use". Measured first (`tools/character/salon_audit.js`: a lock placed from the front hung through the head seen from the side, the end re-read on a turn, 37 cm at most before zooming out, a 20 cm reach taking 52 of 54 locks, picking through the head), then nineteen items built in seven commits, each with a SALON step: the pull's **scope** and **locked** locks and groups; the **placing arrow** (a placed lock stays in hand, its arrowhead dragged for length and direction from any view, OK or Enter; the wheel bows every type; Length and Sag sliders; the hint per stage); the **view buttons** with Blender's keys, the crown from above, **Ortho** (the cursor's ray from the camera's own projection); **Split** (two panes with their own orbits, every tool in the pane under the pointer, the view bar moved into the header); **roots that slide**, picking that takes the nearest in depth, never through the head, cycling on a click again, a **dot** where a root would go; **Let it fall**, the Locks list (group picker, rename, solo, fold, delete, lengths), **new locks like the last one**, a **draft** in localStorage offered back; a lock **swung by its body** (Shift: slide; R, G), **several picked** (Ctrl-click, a box), the view panning at a drag's edge, zoom stops (Home). Lessons: a test's root point above the crown's top misses from a level view (the radial field overestimates at the pole); UI over the view steals clicks. |
| `better-eyelashes` | **Anime lashes and the pink eye makeup after the user's references** (DECISIONS 2026-10-26, night): three lash sliders (Spiky clumps: each clump's roots gathered with a gap to the next; Long and short: every other spike shorter; Lower lashes down: the lower lashes down the skin) and three anime styles (an anime lash set, drawn wisps, an anime doll) in a grouped Style picker, a style setting every slider (`styleOf`); the makeup's eye layers (the liner's thickness and its point past the inner corner, the eyeshadow's placement, an under-eye wash, the inner corner, the waterline), the **anime pink** makeup preset and the **anime pink** look (the preset with the anime lashes on; a look can name lashes and brows). The painted liner now runs between the lashes' roots and a line a liner's width up the lid, both found on the skin (`rimOf`'s fourth point), so it shows over the lashes in any pose (before, it ran along the lid line under the lashes and the cut: invisible). STUDIO's two new steps. Then, the user finding the spikes nowhere near the photo: **every lash one fine hair** (`lashAtlas`, one strand to a cell; thin crossed cards, hundreds an eye) in clusters drawn to points, long, medium and short in turn, a short fringe under them (Under-lashes), clusters crossing (Criss-cross), the outer ones swept up and out; every style retuned on it. Then the user's two asks: **no skin between the roots** (the lash line its own mesh with a dense fringe atlas, `lineAtlas`, over the whole rim and up the lid) and **lashes that turn with a blink** (each hair's frame set on the open lid and turned with the lid about the eyeball's middle, with the margin's droop: shut, they point at the viewer, 15° down, still on their rim, on the upper lid's own edge; the painted liner's lines from the same swung lid, so no patch on a shut lid). Then the lower lashes (the user: too angular, fading into the skin): one hair each rooted at the margin's front edge (the waterline showing), leaving along the skin and easing into their direction (no L), at most 57° down; the lash atlas a solid core, black to the tip (crisper upper lashes too). Then the corners (the user: skin showing at the corners of the upper lid, the lower roots off their line): the rim runs to the corners instead of fading to nothing (`rimOf` searches square to the lid's line, drops far picks, fills a corner from its neighbour), no lashes on the innermost 7%, the lower roots one smooth line along the margin. Then **the three eye shapes the user drew, as lashes only** (the opening stays the scan's): styles fox almond, half-lidded and round doll with Sweep, Inner length and Lift below zero added, and a whole look each with its drawn liner (`fox liner`, `half-lidded liner`, `doll pink`). |
| `eyelash-more` | **The second reference's five lash sets** (DECISIONS 2026-10-26, last thing): lash styles sparse (men, older), glam volume, fluffy mink, doll volume and natural medium, each a whole look; a **lower liner** (the painted liner along the lower lashes' roots: amount, thickness, reach), **Eyeshadow size** (a smoky eye up to the crease and out past the corner), lash looks brown, greying and grey, makeup presets smoky plum, bold doll liner and tinted waterline, and **Hooded lids** in the sculpt (the old man's fold; the opening and the lashes' roots kept, no skin turned over). STUDIO measures the sets, the lower band and the fold. |

## 2. Where things are

- Play: `tools/director/play/physics.js` (physics kinds as parts; carrying; the soft bend), `boardgames.js` (the table
  and its pieces), `boardgames-ctx.js` (seeded chance), `runtime.js` (`pickUp`, `putDown`, `carryTick`, `pressE` and
  `holdTick`: hold E; `boardGame`, `seatAt`, `anim`: tweens on the game's clock), `interactables.js` (`carry`,
  `game`), `conditions.js` (`carrying`, `dropped`, `played`), `hud.js` (the hold ring, the score line, the flash).
- The rules: `Content/Studio/BoardGames/` (README: the games, `ctx`, how to add one); `storylib.board_games()` reads
  their one-line JSON `meta`; the desk serves them at `/boardgames/<game>/<id>.js` and lists them at
  `/api/boardgames/<game>`.
- The Studio: `tools/character/accessories.js` and `jewellery.js` (the necklace's drop: `dropNecklace`, `neckRing`,
  `neckWaist`, `BodySDF`); `nails.js` and the `paintNail` part of `skinshader.js`; `serve.py`'s `api/recipe`,
  `api/package`, `api/import`.
- The tailor's underwear: `tailor/pieces.js` `bra`, `brief`, `bust`, the `trim` detail, `fine`; the designs with slot
  `under` in `Content/Studio/Clothes/designs.json`.
- Format: STORY_FORMAT §2 (`carry`, `game`) and §4 (`carrying`, `dropped`, `played`); story_check checks them and its
  walker carries things and plays games.

- The desk: docs/DESK_DESIGN.md (the rules, the parts, how to grow it); the guide `tools/director/guide.html` at
  http://127.0.0.1:8780/guide.html; the saves kept in `Saved/Story/<Game>/history/` (git-ignored).
- The little things (docs/IMMERSION.md §4 has the files): the shapes in `kit.js` (`TYPES` with `cat: "small"`,
  sockets from `build()`), the lives in `Content/Studio/Life/lives.json`, their logic in `life.js` (`States`) and
  `storykit/life.py` (`reach`, for the walker), the effects in `lifefx.js` (attached by `stage.js` after `setWorld`;
  the stage's `lifeAt` says the states shown), the sounds in `lifesound.js`; Play's side in `play/runtime.js`
  (`stateOf`, `lifeActs`, `setState`) and the `life` interactable; the desk's in `blocking.js` (the menu),
  `marks.js` (`newThing`) and `app.js` (`addThing`, `thingPic`).

## 3. Testing

- `python tools/check_all.py`: CHECKS ok. `node tools/director/play/boardtest.mjs`: BOARD ok. `node
  tools/director/cmdtest.mjs`: CMDS ok. `node tools/director/refstest.mjs`: REFS ok (both games' entries renamed).
- `node tools/director/playtest.js`: PLAY ok (it adds, in memory only, a plushie in the hall and chō-han on the hall
  table). `node tools/character/studiotest.js`: STUDIO ok (it exports `_studiotest` and imports it back as
  `_studiotest_back`, left in `People/`, git-ignored; about 45 minutes here: `ONLY=jewellery` runs just the steps
  whose words match, after the new character). `node tools/character/tailor/check.mjs`: TAILOR ok (68 designs on seven
  bodies, seven outfits hung by gravity on three bodies; about 7 minutes here). TIMES ok, BLENDERLOOK ok.
  `node tools/character/ueeye.mjs`: UEEYE ok (DXC isn't here: its HLSL ran as GLSL only).
  `node tools/director/peopletest.js`: PEOPLE ok (a Character Studio export as Mari's body, the simple view; it needs
  an export on the machine: STUDIO's `_studiotest` will do). Delete `People/_studiotest_back` before a STUDIO run: an
  old one left there failed the import's "every file the same" once.
- `node tools/director/desktest.mjs`: DESK ok (the desk's logic without a browser; it maps `three` to the vendored
  copy, so modules that draw are tested too; the lives: node and Python agree on every preset, the timers, a pot
  following its hob, the burnt time kept, the acts; every effect and sound known). `node tools/director/guide_shots.mjs`: GUIDE ok (every part the guide
  shows, driven in a browser and pictured; it makes and removes a scratch game `ZzGuide` and a take in
  `Footage/Sample/`).
- **Run the browser checks one at a time**: two at once on this machine's software GPU starve each other (LESSONS
  2026-10-24). Restart a desk or Studio server after changing its Python (find the PID, kill it in a second command).

## 4. What's next (ask which)

0000000g. **Write a story in the writers' room** (`python tools/writers/serve.py`, then http://127.0.0.1:8795, or the
   dashboard's tile): drag shapes from the palette, join them by their dots, type titles and labels on the chart,
   Shift-drag a box round a part for an act, About for the brief; the Problems bar says what's missing. Build it and
   say what to change: the shapes, what a talk asks for, how the outline lands on the desk (`BUILD.md`). Then
   "build <G> from its BUILD.md" when it's time to turn it into the game.

0000000f. **Try the salon's easier editing** (the branch `easier-hair-editing`, off main, 2026-10-26; docs/SALON.md has
   how it's used, docs/SALON_REVIEW.md what was hard and what each item became): place a strand (root, end), drag its
   **arrowhead** for its length and direction, turn the view and drag it again, OK; **Split** for a side pane and drag
   a handle there; Pull's **Scope** and the padlocks; the view buttons (1, 3, 7, Shift for the opposite, 5 ortho);
   drag a lock's **green root** to slide it, its **body** to swing it (Shift: slide; R and G); Ctrl-click or a box
   to pick several; **Let it fall** in Selected; the Locks list (rename, solo, fold, delete, the Group picker); New
   locks like the last one; close the page with an edit and open it again (the draft). Say what's still awkward:
   the arrowhead's size and where OK sits, the default scope (the lock and its twin), whether a click on the
   selected lock's body should swing or pick, the edge pan's speed. Next from SALON_PLAN if wanted: the brushes
   (comb, grow, puff, smooth), the galleries, tracing the outline over the reference; or the salon in the T-pose.
0000000e. **Eyes like MetaHuman's** (DECISIONS 2026-10-26, night; docs/research/eyes.md §4): built on
   `claude/bold-ride-mcg3gt`, merged with the lash work (`better-eyelashes`) into `better-eyes-and-eyelashes`. The Studio's eyes are `tools/shared/eye.js` (the iris behind a refracting cornea, the
   cornea reflecting the lights, the iris lit as a bowl; STUDIO traces the refraction by Snell's law). The export is
   rigged on MHR's skeleton, the eyes on `l_eye`/`r_eye` carrying their paint baked flat and the eye's shape and paint
   (`extras.studioEye`), the lids resting on the eyes (a file has no stencil) and each opening's outline in the skin's
   extras. The desk wears it as a cast member's body (`previs_body: "people/<name>"`, the Database's body picker:
   "<name> (Character Studio)"), its eyes refracting; the toolbar's **Simple** draws everything plain when it lags
   (PEOPLE). In Unreal (written blind: run it once with the editor, UNREAL_FLOW §1d): `storykit.people` imports the
   export as one skeletal mesh, its eyes wearing M_StudioEye (made from text; UEEYE runs its HLSL as GLSL against a
   traced ray), and Generate uses it for a cast member who is the character. Next, if wanted: §4's steps 5 and 6
   (the room in the cornea, photo irises, the eyes' life), the caustic and an eye occlusion in Unreal. Then (DECISIONS
   2026-10-26, late night) iris patterns and pupil shapes after the user's references, a heart among them, and
   sixteen styles (Skin, Eyes, Iris and pupil): say which look right and what to change in the others.
0000000b. **Look at the three eye shapes** (Face, Look: fox almond, half-lidded, round doll; or Face, Lashes, Style, the
   "Eye shapes" group) against the drawing and say what to change: the fox's sweep and wing (Sweep, Outer flare, Inner
   length), how far down the half-lidded lashes lie (Lift) and how dense (Upper lashes, Under-lashes), the doll's spike
   count and length; the liners' wings and points (Skin, Makeup: Liner wing, Liner thickness, Inner corner liner).
000000. **Look at the anime lashes and the pink eye makeup** (Face, Look: anime pink; or Face, Lashes, Style; Skin,
   makeup preset anime pink) against the references and say what to change: the hairs' count, length and thickness
   (Upper lashes, Length, Thickness), the clusters (Clumping, Spiky clumps, Long and short, Under-lashes,
   Criss-cross), the lower lashes' angle and length (Lower lashes down, Lower length),
   the pinks' strength and hues (Eyeshadow, Under-eye shadow, Inner corner, Waterline and their colours), the liner's
   thickness and wing, and whether the look should set the brows too (a look can: `brow` in `looks.js`).
0000000. **Look at the second reference's five lash sets** (DECISIONS 2026-10-26, last thing; built on `eyelash-more`;
   docs/research/lash_reference.md's last section): Face, Look: older man (sparse lashes), glam smoky plum, fluffy
   mink, doll volume, natural medium; or Face, Lashes, Style, the "Lash sets, after the second reference" group. Made
   from the write-up, not the photo: compare them with it and say what to change (the hairs' count, length, lift and
   crossing; the lower lashes; the greying look's grey share; the lower liner's thickness and reach, Skin, Makeup;
   Eyeshadow size for the smoky plum; Hooded lids in Body, the sculpt, for the old man's fold). Men still start with
   the lashes off like everyone: whether a masculine base should start on the sparse set is the user's call.
00000. **Look at the new bodies and the tailored clothes** (Feminine or Masculine, then the outfits named after the
   references: `school uniform (summer)`, `office (pencil skirt)`, `skirt suit`, `shirt and shorts`, `t-shirt tucked
   in`); characters made before have the new bodies too. Say what to change: how loose each design hangs (its Fit, its Hang: fullness, stiffness, weight; the designs' own
   `drape` in designs.json), the folds' size, the tuck, the cardigan's bulk. A drape takes a few seconds a garment here
   in software (an outfit over ten); the RTX 3090's CPU is faster. Next for the drape if wanted: watching the cloth
   fall, keeping a fold off its neighbour (self-collision), hanging in a desk pose, and the clothes into Unreal as
   skeletal meshes with Chaos Cloth on a skirt's hem (TAILOR §4).
0000. **Shape a character in the T-pose** and say what's still awkward: the pose (arms level; a little lower, like
   many references, is one number in `pose.js`), the Belly control's flat (all the way down; a body with a bigger belly
   may want more), whether the salon (the Hair tab, still in MHR's A-pose) should show the T-pose too.
000. **Look at the little things and listen to them**: the Sample's kitchen (the kettle: switch it on in Play with E;
   the tea), the hall's cigarette, the study's phone and TV; the guide's §11. Say what to change: how much steam, the
   sounds (made in the browser, so any of them can be tuned or swapped for a recording), the sizes, and which
   things next (IMMERSION.md §1's "Later": a fan, a kerosene heater, a kotatsu, a wind chime, a microwave, a
   washing machine, a butsudan's bell). Unreal's side is IMMERSION §5 (a Blueprint per life, Niagara, the
   `life` table in class_map), with the editor.

00. **Try the new desk with the guide open** (Help, Open the guide) and say what's still awkward: type a scene, drag
   Mari onto a mark, trim a real take on its waveform, a quick task, an act, Ctrl+K, F9 in the Watch, bring back a
   save. The pictures are made in software here: on the RTX 3090 they're instant.

0. **Look at the jewellery, the nails and the underwear** in the Studio and say what to change: necklace lengths and
   weights, the hoops' size, the nails' length and shape (painted: a long acrylic would need a modelled nail), more
   underwear styles (a lace that reads on small pieces, a push-up's padding, a bodysuit, a slip), and colours.
0b. **Try the desk's new motion work** on a real Kimodo take: a segment from the clip card, Send to Studio by its
   name, a layer (arms over a walk), the blends; then DESK_REVIEW §3, the open items: the shot list loaded into the
   demo by name (needs Kimodo here), the reach into Kimodo, the `motions` table (idles, the seeker's loops) playing
   in the Watch and Play, a mark tool on the desk's stage.
0c. **NPC patterns** (docs/PATTERNS_PLAN.md, a plan): states such as calm, uneasy and hunting, each with its own
   motions (a per-character motion set by style and role); reusable patterns; routines and patrols. Its §13 has
   five questions for the user, and §12 the build order (motion sets on NPCs first).
1. **Look at the board games and the plushie in play** and say what feels wrong: the pieces' sizes, how close the
   seat leans in, the plushie's softness (`jiggle`, the kind's `follow`, `squash`, `floppy`), the revolver's moment.
2. **More board games or a game's own** (a card game of the story's, hanafuda, a ouija board): one file each, BOARD.
3. **More physics kinds**: glass that breaks when dropped, a bottle that rolls, a liquid that slops (a part each).
4. **The export in the desk**: the desk's bodies could wear a Studio export (`export/<name>.glb`) for a cast member,
   which PERFORMANCE_PLAN wants; then into Unreal.
5. **Unreal's side** of carrying and board games (the StoryRunner; the tables are greybox blocks tagged `use:game`
   there for now), and Kimodo's motions on the characters (task 6, last, with Unreal).
6. From before: routes and safe zones drawn in the scene builder, talk lines, interactive cinematics (GAMEPLAY_PLAN).

## 5. The user's machine (unchanged, outside the repo)

- `ue` starts Unreal on native Wayland (`UE_WAYLAND=0 ue` for XWayland when a dialog opens blank).
- Close MetaHuman Creator's conform tool before editing a mesh (it crashed once); systemd's core dumps can freeze the PC.
- `MHR_feminine.fbx` and `test.json` in the repo root are not ours to commit.

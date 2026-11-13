# The Character Studio: where it is, the rule it keeps, and one app

Written 2026-10-22 as the pass-over from the `claude/character-studio` session into this branch (the character
creator), updated when the salon's branch (`claude/elegant-planck-9aatj8`) was merged in. §1 is what's built, §2 the rule every stage keeps (DECISIONS 2026-10-22, evening), §3 where each stage
stands against it, §4 the one-app revamp, §5 the order to build it in. Nothing in §4 and §5 is built yet.

## 1. What's built

One server (`python tools/character/serve.py`, port 8793), one page (`tools/character/index.html`) with tabs, and the
character on disk in `Content/Studio/People/<name>/` (git-ignored: real faces stay local). STUDIO
(`node tools/character/studiotest.js`, the server running) walks every tab.

| Tab | What it does | Its code |
|---|---|---|
| Body | MHR: a base (feminine to masculine: slim and young after the user's references, 2026-10-26, the body between the two bases, new characters halfway, the heads kept as they were; a base carries a sculpt, the feminine one's flat stomach; **v2female**, 2026-11-12: what the feminine end becomes when it's picked, a head and a neck after the user's Daz3D characters, §2f, with the sculpt's new **Neck width** and **Face taper**), 45 identity sliders, a height; the **sculpt** (2026-10-23): 30 named controls MHR's shapes don't give (Forehead: height, width, slope, brow ridge, temples; Face: hooded lids, cheekbones, cheeks, jaw width, chin length, width and forward, nose size and projection, nose length, tip, width and bridge, mouth width, lips; Body: neck, shoulders, chest, waist, **belly**, hips, upper arms, forearms, thighs, calves; the belly 2026-10-25: MHR's average stomach stands 3 cm proud of a straight line from the pubic bone to the lower ribs and its identity shapes take back only 1 cm of it, so Belly at -1 takes it back to that line (bowed 4 mm: a flat stomach, not a board), a smooth field whole across the middle 12 cm and easing out by the flanks, +1 rounder; **hooded lids** 2026-10-26, after the second lash reference's old man: the skin between the lid's crease and the brow comes down over the upper lid and a little forward, most at the outer corner and on past it, nothing within 2.8 mm of the line the eye is cut along moving (the sculpt is built with the model's own lid line: MediaPipe's ring sits 2 mm below it), so the opening, the lid's rim and the lashes' roots stay; the height over the line measured from an envelope that never falls faster than 0.6 (so the field changes slowly round the corners) and the drop's slope kept under 0.85, so the skin gathers into a fold and never turns over itself (STUDIO counts the triangles turned over at 1 and -1: none; the opening moves 0.000 mm), -1 lifting the crease instead; **the nose's size and projection** 2026-10-28, the user: no way to make a small nose, everything dragged low still left a fat nose standing out in profile (MHR's average nose has its alae 37 mm across and stands 16 mm out of the line from its root to the subnasale; the tip's and the bridge's controls move a spot each, the tip 5 mm, and leave the rest standing): the nose as a height over the face under it (that line down the middle, falling across to the skin at the nose's border), **Nose size** -1 its width 30% in (the alar crease too, the cheek beside it eased along over 16 mm: a nose narrowed alone would stand on its old, wide foot) and its height 35% down, **Nose projection** -1 its height halved, a circle each (the nose's side, its bridge's middle); nothing within 6 mm of the eye's inner corner moves, STUDIO checks the lids' lines, the eyes' corners and the lips stay put and no skin turns over), each a smooth offset field over MHR's base body, mirrored (the face's placed by MediaPipe's points on it, each pair averaged across the middle; the limbs' by their cross-sections), -1 to 1, added after a photo's fit (so a picture never undoes it) and before the expressions (a blink still shuts); **circles on the body** (the Body view shows the body's, the Head view the face's, both sides of each): a circle dragged moves its sliders as far as follows the pointer (120 px a whole slider; what moves towards you from this view stays, a chest seen from the front goes up for more), its rows green while it's held | `index.html`, `sculpt.js`, `mhr.py`, `MHR_lod1.bin` |
| The view's pose | the body is **shown in a T-pose** (2026-10-25, DECISIONS: modelling wants a modeller's pose, the user's reference: the arms level out to the sides, the elbows and wrists straight, the legs straight down, the feet flat), or in MHR's own A-pose (the view bar's pose picker, kept per browser). Only what's shown: the character is shaped, fitted, dressed, saved and **exported in MHR's own pose** (the desk and Unreal expect it: an export and the clothes' OBJ switch to it while they write; `body.bin` and the body's OBJ are made from it anyway). Laid over the body by MHR's own skinning (`Content/Studio/Bodies/MHR_lod1_rig.bin`: its 127 bones and each point's four, from `MHR_lod1.fbx` by `rig_mhr.mjs`), the joints refitted to the body as it is (each moves with the skin round it, as the desk's `bodies.js` does); only the arms and the legs turn, and the neck stands up (2026-10-26, DECISIONS: MHR's rest pose carries the head 6 to 7.5 cm ahead of the shoulders, the neck leaning far forward, which the user found uncanny next to a real profile; the body under the head moves forward, level, the neck's joints part of the way by their height, until the head's joint is `NECK_AHEAD`, 0.12 of the neck's height (about 2.2 cm), ahead of the shoulders' and the ear over the shoulder's top: as upright as the user's reference: the neck's front, under the jaw, leaning about 14° from upright in the side view where MHR's leans 29° and the reference's about 8°), so the head and all on it (eyes, teeth, lids, brows, lashes, glasses) are the rest pose's own to the last bit; the salon's baked hair moves with the body below the head, by the same share at each height (`shiftAt`). What's drawn on the body goes with it: the sculpt's circles and their pull, the clothes (each garment skinned by the body's weights round it, `tailor/weights.js`) and their handles, the accessories, the nails' close-up, the layers' picking; the procedural skin sits on the unposed body (`objPos`), so a turned arm keeps its pattern. The POV view shows MHR's own pose (the arms down, as a body stands in a game: the face under the game's lights is what it checks); the salon still shows MHR's own pose too (it shapes the hair on the head). POSE (`node tools/character/posetest.mjs`): every base and the tailor's slim and full bodies posed, the arms level, the neck stood up (the head's joint where `NECK_AHEAD` puts it, the trunk's joints only forward, the ear over the shoulder's top), the head's own points untouched, no skin torn (under the chin squeezed to no less than 40%); the Belly control | `pose.js`, `rig_mhr.mjs`, `index.html` |
| Face | front and side pictures bend the head (MediaPipe's landmarks); **Bake the face** (2026-10-28, the user: done with image to face, remove the reference pictures) keeps the fit as it is in `face.bin` (a header saying when, from which pictures, with what settings and on what body, then the points and their offsets before Face strength), opened with the character from then on, pictures or none: the fit's settings wait while it's baked (Face strength still works) and **Unbake** fits the face to its pictures again (with none left, the base's face, asked first); **brows and lashes** on the salon's hair shader: lashes on the lids' edges that lie over the lid's rounded rim to its front edge before they lift (2026-10-26: MHR's lid line is the rim's back edge, where the lid meets the eye, and the rim is 2.4 mm deep in the upper lid's middle; rooted on the line and sent straight out, the lashes ran under the rim's skin and a band of bare skin showed between the eye and the lashes. `rimOf` in `index.html` finds the front edge from each point of the line and the way over the rim's skin by rays, the lash line's band lies along it, and the way fades as the eye shuts), turn with the lid and squash as it shuts, brows as fine hairs flat on the skin with a fill, shapes and looks (off until asked for); **every lash one fine hair** (2026-10-26, night, after the user's anime lash set: the first spiky lashes were a few dozen wedge cards and read as solid triangles; a real lash set is hundreds of fine hairs): each hair a thin card (two, crossed) with one strand of the lashes' own atlas on it (`lashAtlas`: one soft-cored strand to a cell, thinning to a point), about a tenth of a millimetre wide, hundreds an eye; the upper lid's hairs in clusters that draw together to a point (Clumping: three to eight a cluster), their roots spread evenly or gathered with a gap to the next cluster (Spiky clumps), the clusters long, medium and short in turn (Long and short), each leaning its own way along the lid so neighbours cross (Criss-cross), short hairs along the whole lid under them (Under-lashes), longer and swept up and out toward the outer corner (Outer flare; the way off the lid tilts toward up there); the lower lid's one hair each (a real lower lash is a single fibre; two or three side by side read as a comb), rooted at the margin's front edge with the waterline showing between the eye and the lashes as in a real eye and the reference (a stretch across the margin ran toward the viewer and kinked down: an L), leaving the way the skin goes over the edge and easing into their own direction over their first half (no corner), at most 57° down so they clear the skin under the eye, pointing out or down the skin (Lower lashes down), longest from the middle outward; the lash atlas's strand is a solid core thinning to the tip and black to the end (a soft core mipped down to a few pixels went grey over the whole card and a fading tip dissolved into the skin: the user's find, 2026-10-26, night); **the rim at the corners** (the user's find, 2026-10-26, night: skin showing at both corners of the upper lid where the lashes came out from under it, and the lower roots jumping up to the eye's edge there): `rimOf` searches for the margin's front edge square to the lid's own line (the way from the eye's middle points along the eye at the corners, where the margin still runs across the lid), drops a pick far deeper than the lid's own rim (at the inner corner the lower lid's search reached the nose's flank, 3 mm forward, where the margin is under 1 mm) and fills a corner that found nothing from its nearest neighbour, shallower, instead of fading the rim to nothing; the lashes grow square to the lid's line too, and the innermost 7% of the upper lid and 3% of the lower carry none (a real lid has none beside the tear duct); the lower roots run as one smooth line along the margin's front edge, corner to corner; **the lash line** is its own mesh with a fringe atlas of its own (`lineAtlas`: the roots as a dense fringe, opaque along the eye's edge and ragged where it ends), over the whole rim from the eye's edge to the lid's front edge and on up the lid's skin as far as Lash line takes it (`rimOf`'s fourth point), so no skin shows between the roots (the user's ask, 2026-10-26, night); **a blink** (the user: the lashes shouldn't disappear, they should angle toward the viewer): each hair's frame is set on the lid as it is open (the lid's line, its rim path and the eyeball's middle, kept from the last compose with the eye open) and turned about the lid's own line by how far its root has swung round the eyeball's middle since, so the rim the lashes lie over turns with the margin (the roots stay on the upper lid's own edge, level with the seam and forward of it when shut: a droop on the rim put them below the seam, on the lower lid, the user's find), and the hairs' direction turns the same plus a droop as the lid shuts (MHR's blink brings the lids together halfway; a real lid comes all the way down): shut, the upper lashes point at the viewer and a little down (from 50° up to 15° down on the anime style), still rooted on their rim, a bendy bone a lash in effect; the painted liner's lines come from the same open lid swung the same way (`lidFrame`, `OPENLID`), so on a shut lid it stays a line along the lashes' roots (found by rays on the shut lid's bulge it was a dark patch up the lid); **lash styles** after the user's references (an anime lash set photographed on an eye, drawn eyes): anime (spikes), drawn (long wisps) and anime doll (short spikes all round) beside natural, defined, short and doll, grouped in the picker, a style setting every slider (`styleOf`); **the three eye shapes the user drew** (2026-10-26, night: a drawing of three pairs of eyes; the user: the openings stay as the image-to-face scan gives them, only the lashes' shape and direction), as lash styles in their own group: **fox almond** (a fan swept out to a wing at the outer corner, long there and short at the inner, sparse short lower lashes), **half-lidded** (dense lashes lying down over the top of the eye as a dark band, no lower lashes) and **round doll** (short spikes radiating all round, the lower lid in spikes too), with three controls added for them: **Sweep** (where the lashes lean along the lid, growing toward the outer corner), **Inner length** (the inner corner's lashes against the outer ones) and **Lift below zero** (the lashes down over the eye, to 28° at -0.6); each shape is also a whole look (Face, Look) with the liner the drawing gives it (`skinshader.js`'s `fox liner`: a bold liner to a long wing with the inner corner drawn to a long point and tinted pink; `half-lidded liner`: a broad band, a long inner point, a short flick, the under-eye bulge lit; `doll pink`: a thin liner with small points both ends and pink all round the eye); STUDIO measures the fox's sweep against the natural style's, the half-lidded's elevation and the doll's spikes; **the five lash sets of the user's second reference** (2026-10-26, docs/research/lash_reference.md: five rendered pairs of eyes, "thin ones for men etc"), in a group of their own: **sparse, thin (men, older)** (about fifty short, thin, nearly straight hairs, a few lower ones), **glam volume** (long and dense, fanned into soft wispy spikes, dense long lower lashes), **fluffy mink** (the fullest: about two hundred, soft, neighbours crossing, long fluffy lower lashes), **doll volume** (very long, swept up and out together, the longest lower lashes) and **natural medium** (medium, lightly curled, separated, the lower ones thin and short), each also a whole look (older man (sparse lashes): the skin seventy and over, full ash brows, red veins, no makeup; glam smoky plum; fluffy mink on bare skin; doll volume with the bold doll liner; natural medium with the tinted waterline; the irises stay the character's own); lash looks **brown**, **greying** (dark hairs with pale tips and about a third grey all along: the hair shader's inner colour on a share of the strands) and **grey**; the upper lashes' slider runs to 240; STUDIO measures each set against the natural style (the sparse the fewest and shortest, the glam's spikes, the mink the fullest with its neighbours crossing most, the doll's lift and its lower lashes the longest, the natural medium separated) and that each look sets its set and its makeup; STUDIO measures the gap between clusters against the roots' spacing inside one (13× anime, 1× natural), the clusters' lengths' spread (16% anime, 3% natural) and the lower lashes' angle (61° anime, 33° natural); **teeth and a tongue** (2026-10-24; MHR has none): an adult's average arches, sized to the neutral mouth's width and set behind the lips, wet (a clear coat), the biting edges translucent blue-grey, darker gaps, dimmer when the mouth is barely open, the upper with the skull, the lower and the tongue on the jaw (a rigid motion fitted once to each of MHR's jaw shapes, so lip shapes never move them); the opening is cut out of the skin along the mouth's own lip line (the seal's points, the upper lip's lowest edge and the lower's highest, corner to corner, smoothed: no wedges at the corners, no jagged edge), with a dark bag behind it marking the stencil, so the mouth shows only through the opening and never through the lips or cheeks; a pucker and a funnel together are limited (past 1.1 between them the funnel gives way: MHR folds the lower lip out over itself); the opening counts from the mouth at rest (MHR's lips overlap there); the **lower lip's curl** (Mouth, 0.5 by default) rolls the top of the lower lip down into the mouth, as a real lip curls: MHR's runs straight up to a hard edge and, at rest, a millimetre up inside the upper lip; **whole looks** (`looks.js`, Face, Look): the eyes, the lips, the teeth and the skin set together, new characters starting from "soft cinematic" (after the user's reference, docs/research/look_reference.md), "MHR plain" taking it off; **lipstick** (`lips.js`): painted by the skin's shader inside the lips' outline (MediaPipe's outer lip ring, riding the face), over the photo skin or the procedural one, soft at its border, a gradient, gloss, lip lines; Show the guide draws the outline, shaped by five sliders (shade, size, forward, up; Open the mouth) | `teeth.js`, `face_mesh.py` (worker), `browlash.js` |
| Expressions | MHR's 72 shapes, presets written as ARKit-52 curves (the mocap's map) | `arkit_mhr.json` |
| Skin | tone; the **photo skin** (the front picture projected onto MHR's UVs: `skin.py`, `skin.png` + `skin_mask.png`); the **procedural skin** (`skinshader.js`: noise layers, glass, oil, age, makeup, presets); the **touch-up** (`touchup.js`: paint, take the photo away, bring it back, soften, undo; pigment brushes); eyes (`tools/shared/eye.js`, shared with the desk: the iris behind a refracting cornea, MetaHuman's way, 2026-10-26, docs/research/eyes.md: the cornea's dome over the limbus bends the view onto the iris's plane, its clear coat reflects the lights, the iris is lit as a shallow bowl; Refracting cornea off paints the iris on the eyeball with painted catchlights, as before; an **iris pattern** (natural, sunburst, lightning, nebula, crypts, halo, in an accent colour: strength, burst reach, detail) and a **pupil shape** (round, heart, slit, bar, star, diamond, cross, crescent, flower, ring, two, none, in a colour of its own, turned), drawn as distance fields so they're sharp at any size and follow Pupil size, and sixteen **styles** after the user's references setting colours, pattern and pupil together, 2026-10-26): the shell **cut out** in the skin's shader along the model's own lid line (found once, on MHR's own face, from what its blink squeezes shut; a photo's fit carries it, and its blink still meets), an eyeball behind each opening drawn only through it and over what's inside (always full, any pose), fitted to the opening and grown back from its pupil, a blink shuts it, the lids' shadow, catchlights fixed to the light (size, depth, opening, lid shadow, pupil size); the iris's edge melting into the white (Iris edge softness), an eye occlusion all round the opening, a tear line along each lower lid (faded at its edges and corners, so it glints and never draws a hard white line); the openings' edges (eyes and mouth) faded over a pixel, alpha to coverage, not cut with stair-steps; **fingernails** (`nails.js`, 2026-10-24: painted on the skin, no model): found once on MHR's hands (each fingertip the hand's farthest point from the wrist along the skin, the finger's axis, its back from the hand's flat, the nail's length and width from the finger's own width), a coordinate per point for the skin's shader, which paints the nail over its pink bed, a pale half moon, the free edge, the cuticle and the folds round it a little raised, faint ridges and a gloss; a **polish** over it (full, French, half moon, ombré, tips, dots; gloss, matte, chrome, glitter, jelly; two colours, coverage, accent ring fingers), the nail's shape (square to almond), presets (bare, buffed, clear gloss, classic red, nude, French, black, matte black, chrome, glitter pink, ombré, half moon, pastel dots, jelly berry) and **Look at the nails** (the view over the left hand) | | **Eye makeup after the user's references** (2026-10-26, night): the liner is painted on the band between the lashes' roots (the upper lid's front edge, `rimOf`) and a line a liner's width up the lid found on the skin by rays, so it hugs the lashes in any pose (between two lines the distances to them add up to their separation); its thickness, its wing, a point carried past the inner corner; the eyeshadow's placement (along the lid or gathered at the outer corner) and its size (Eyeshadow size: how far it and the under-eye wash spread, up to the crease and out past the corner for a smoky eye, where long lashes hide the lid), an under-eye wash fuller toward the outer corner, a dab at the inner corner with a shimmer, the waterline tinted and wet; a **lower liner** (2026-10-26, after the second lash reference): the same band under the eye, from the lower lashes' roots (the lower lid's front edge, `rimOf` on the lower line with a fourth point down the skin, swung with the margin as the upper's) its width down the skin, thicker toward the outer corner, from the outer corner as far as its reach and thinning out before the inner corner, in the liner's colour, with its own amount (Lower liner, its thickness, its reach); the presets **smoky plum** (a thick winged liner top and bottom in a dark plum smoke all round the eye, the inner corner lit, the waterline dark), **bold doll liner** (a bold liner above and below, the lids dark, the waterline lined) and **tinted waterline** (a thin red-brown tint on the lower waterline on bare skin), STUDIO measuring the lower band and the strip under the eye darker with it; the **anime pink** makeup preset sets them (a mauve-pink shadow, a pink wash, a pink inner corner and waterline, a bold winged liner, aegyo-sal, pink gradient lips), and the **anime pink** look is that preset with the anime lashes on; STUDIO measures the band and the pink under the eye.
| Layers | paint layers above the base: select by vertex, fill with colour, decal, PBR set or texture, opacity, shine, relief (docs/LAYERS.md) | `layers.js`, `layersui.js` |
| Hair | **the salon** (DECISIONS 2026-10-22, 2026-10-23): the tab opens `salon.html` inside the Studio (`?embed=1&person=NAME`) on this character's own body and face (the tab posts `body.bin` first); locks drawn by hand against a reference video locked to the view; fourteen numbered steps, each a dropdown closed until opened; a new character starts bald; Bake writes `salon/salon.glb` and `salon_bake.json`, which the Studio wears on the head when you leave the tab (docs/SALON.md). Brows and lashes (`hair.js`) switch in the Face tab | `salon.html`, `salon.js`, `salonlib.js`, ... |
| Clothes | the tailor: designs cut from this body (a membrane relaxed off the skin, skirts as rings, details lifted off), each with a **Fit** (skin tight to loose), then **hung by gravity** (a cloth simulation in the worker after the cut: they fall from the shoulders, the bust and the waist into folds, tops tucked into what closes over them, a sleeve inside a jacket's held as cut, buttoned fronts closed; each garment's **Hang**: on or off, fullness, stiffness, weight) and baked with the character (`drape.bin`), outfits worn in layers, refit when the body changes, fabrics after Woohill's surfaces (fishnet and sheer tights among them), patterns and prints, jackets, shoes and socks, shaped by handles in the view and sliders (**the edit mode**: the garments as films with their cut lines on the body, a skirt as its rings, moved at once, Bake cuts and hangs them), the outfits as pictures in groups (Designer after the user's references, Studio, Underwear), exported as OBJ (docs/TAILOR.md) | `tailor.js`, `tailor/`, `cutedit.js` |
| Accessories | made in code, no models (`accessories.js`, 2026-10-24; the jewellery's parts in `jewellery.js`): **glasses** (round, square, cat-eye, aviator, rimless, sunglasses, **heart**: lenses round the eyes from the face's own points, a bridge over the nose, the temples back over the ears; the frame its colour (plastic to metal) or a metal, lens colour and tint, size, height, forward, thickness), **earrings** (stud, pearl, gem, huggie, hoop, drop, chain drop; a pair by default, the other ear's place mirrored across the face; a hoop hangs from the hole and swings out only as far as the jaw and neck push it; a drop's charm: heart, star, moon, cross, coin, gem, pearl, ball, domed so polished metal catches the light), **piercings** (stud, gem, ring, hoop, barbell, spike, **nose hoop**: a ring hugging the nostril's rim; a ring at the septum hangs under the nose), **stickers** (heart, star, bandage, tear, sparkle, moon, flower, beauty mark, gem: drawn on a canvas, a sheet laid on the skin), an **eyepatch** (with a strap round the head on the skin), **necklaces** (chain, pearls, beads, cord, choker): a strand put round the neck and **dropped by gravity** onto the body as it is (position-based dynamics against the skin as a distance field: the back catches at the nape, the sides on the shoulders, the front falls down the chest; its length in cm kept, never shorter than the neck is round; a pendant from the charms at its front lying on the chest); a choker goes round the neck's narrowest part, snug whatever the neck is like (**Looser** lets it out; past a centimetre it hangs). Metal parts are a metal (gold, rose gold, white gold, silver, platinum, steel, copper, brass, black), "the colour as metal", or **a PBR set off the shelf**. Earrings, piercings, stickers and the patch go on a spot from the list (the ears' lobes and rims, the nostrils, the septum, the lips, the brows, the cheeks, under the eyes, the forehead, the temples, the chin, the eyes) or **Place by clicking**, and are held to the skin there (a triangle of MHR's mesh and a place in it), so they follow every shape and expression; a necklace settles again when the neck, shoulders or chest change (an expression leaves it) | `accessories.js`, `jewellery.js` |
| View | the viewer, like Blender's: middle (or right) drag turns it (the left too where no tool is on), Shift+drag pans, the wheel zooms, a double-click centres; guards so a slip never leaves the page (the mouse's back and forward buttons, right-click's menu, middle-click's paste, Backspace and Alt+arrows outside a text box do nothing; leaving with unsaved changes asks, the salon's too); **Split**: front and side panes, each its own camera, the line between them dragged (double-click evens it), Split again for one; the studio view (`tools/shared/studioview.js`); POV from the player's eye at MCU or MS through the game's 90° lens in 16:9, under studio, warm lamp, cold night and flashlight | |

Research behind it: docs/research/skin.md, docs/research/hair.md (and CC0 hair models), docs/research/hair_splats.md,
docs/MHR_PIPELINE_RESEARCH.md. Lessons in docs/LESSONS.md (colour converted twice, the wig in a frame, the 16:9 lens,
cuffs on tops).

Character pages that still live elsewhere, on the desk's server (port 8780): `face.html` (photos to a head, the
MetaHuman route), `shape.html` (an MHR body shaped for MetaHuman), `bodies.html` (a body against every pose),
`flesh.html` (soft bones, jiggle), `poses.html` (the pose library), `pigment.html` (the pigment test), `pbr.html` (the
PBR shelf). The salon (`salon.html`) is the Studio's Hair tab now and also opens alone. The rest is the address typing the
revamp ends. (The splat and clay pages were removed, DECISIONS 2026-10-23.)

## 2. The rule: editable at every stage, even after a bake

Every stage keeps three things apart:

- **Sources:** what the user brought (pictures, a hair model, a design file, a decal) and the settings they chose
  (weights, sliders, layer stacks, fits, colours). Saved with the character; never written over by the app.
- **Bakes:** what the app makes from them (`skin.png`, a draped `garment.obj`, `hair/batch.bin`, an export). Made
  from sources only, never from another bake that has been edited by hand, and always remade the same way.
- **The receipt:** each bake records what it was made from (the sources' names, the settings it used, a fingerprint of
  the body it was made on, the tool's version) next to itself, as `<bake>.made.json`. When an edit changes any of those,
  the bake is **stale**: the stage shows it, and one button makes it again.

So a character can be pulled back at any point (change the body after the clothes were draped, swap the hair after
the export) and only what depends on the change is redone. Unreal never becomes the place a character is edited: an
export is a bake like any other (§3, Export).

## 2b. Brows and lashes by hand (DECISIONS 2026-10-31, the night)

The user, after the add-on's bake (since removed, below): "The texture of the procedural eye lashes looks really good but the design you
generated is very bad, they move up too upwards" (the add-on's Straight preset stands its lashes at 70 to 80° off the lid line,
and our tidy turned them up further to keep them off the eye), with four references (a brow, an eye at three-quarter, an
eye from the front, a MetaHuman head without its hair); then "could you make an easy eyebrow editor tool where I manually
can add and adjust the eyebrows and eyelashes inside an easy wrapper?" Built: **Face, Brows & lashes by hand** (since its own tab, **Brows & lashes**, before Hair, its first part **Fine hairs (shaped on the face)**, the clumped ones under it: DECISIONS 2026-10-31, the last)
(`tools/character/groom.js`, the editor in `index.html`).

- **Use them** puts them in place of the clumped brows and lashes below; **Mirror** does each change on both sides.
- **Edit on the face** frames the eyes and brows and shows **handles**: five on each brow's top edge and five on its
  bottom edge (yellow circles: dragged, that edge moves on the face; the band between the edges is the brow), and three
  at the upper lashes' tips (blue squares, inner, middle, outer: dragged, their length, lift and sweep there follow the
  pointer, smooth between the three). A bar over the view: Front, ¾ left, ¾ right, Side, **Blink** (the lids shut, the
  lashes with them), the **brushes** (Add hair, Thin out, Comb: the brow's density or its hairs' flow painted where you
  drag, at the brush's Size), Done. Alt-drag turns the view as ever.
- **Styles and sliders**: the brows Natural (MetaHuman), Soft and sparse, Full, Groomed, Straight, Bold; Hairs, Length,
  Thickness, Soft edges, Messy, the front, middle and tail hairs' angles, Toward the middle. The lashes Natural
  (MetaHuman), Soft, Full, Doll, Fox, Sparse; Upper lashes, Length, Lift, Curl, Outer sweep, Inner length, Thickness,
  Clumps, Lower lashes, Lower length, Lower angle. A style sets the sliders; the shape by hand stays.
- **The hairs** are made on the face as it is, every time it changes (so they ride every expression and the blink), at
  a real hair's thickness (about 0.05 mm at the root), drawn as `strandCards` (one fine hair to a card): a brow's
  hairs lying on the skin across its band (the band laid on the skin as a grid: each hair a curve in it, following the
  flow: up at the front, swept out along the body, out and down at the tail, the top and bottom rows leaning in; fewer at
  its soft edges and its front); an upper lash from the lid's edge over its rim, forward, easing up into its curl and
  swept toward the temple more the further out it grows (the inner ones a touch toward the nose), turned with the lid as
  it shuts; the lower lashes few, fine, uneven, down and out. Measured (GROOM): the middle lashes rise 2.4 mm over the
  lid at 23° from straight out (it was 3.7 mm at 36° before the defaults were tuned on the references; the add-on's Straight
  stood up), the outer ones swept 45° out; the brows' hairs within 0.33 mm of the skin.
- **Blender's procedural hair technique** (DECISIONS 2026-10-31, the night, the last: "enhance our eyebrows and
  eyelash system we already use and remove the add-on"; the technique in our own words: docs/research/brows_lashes.md): the
  brows' **Trimmed edges** (hairs near the top, the bottom and the front shorter, as a groomed brow's), **Clumps** (each
  hair's tip drawn toward a guide hair of its own 2 by 1.5 mm cell, the root staying), **Frizz** (each hair's own small
  waves), and lengths spread wide with a few long strays; the lashes' **Curl at the tip** (the curl gathered toward the
  tip: straight out of the lid, then up), **Uneven** (short lashes between the long), **Frizz**, and clumps of two to six
  lashes drawn tighter at their tips. Every style sets them. The add-on itself (its bake in Blender, Start from the add-on's brows,
  the add-on's bake tool, its loader) is gone: nothing goes through Blender for brows and lashes.
- **The lash line** (a slider under the lashes): the dark line along the lid where the lashes grow, a thin line at 0.2
  (the default), an eyeliner's at 1; the upper lashes grow along the whole lid, its inner corner to its outer one (they
  stopped short of both ends before the user's note: "the upper eyelashes don't reach out the entire eyelid line").
- **Saved** with the character (`st.groom`: the shape's offsets in mm, the brushing as two small grids, the lash
  handles, the sliders); the export carries them as any brows
  and lashes (their blink, lifted with the lids: §3.1).
- **GROOM** (`node tools/character/groomtest.mjs`, the Studio's server running): the edit mode and its 26 handles, the
  brows' hair count and their lying on the skin, the lashes' rise, angle and sweep, a brow handle dragged (and its twin),
  a lash handle dragged up, Thin out and Add hair, a style, the blink, saved
  and opened again the same, Done.

The sheet: `docs/godot_sheets/2026-10-31_brows_lashes_by_hand.jpg` (the editor, then the result in Godot open, at
three-quarter and shut).

## 2c. The eyes: Blender's human base mesh's lids (DECISIONS 2026-10-31, the night, later)

**Every character's eyes now** (DECISIONS 2026-10-31, the night, the last: "modify the base loaded mesh so it has those
eyes from the start, I don't care about the old eyes"): the graft is `Content/Studio/Bodies/MHR_eyes.bin`, committed,
and the Studio wears it whenever it's there (no switch, no Make button; MHR's own cut lids and the eyelid line only if
the file is missing). Its source is the eye region of **Blender Studio's Human Base Meshes** (CC0; the user checked that
the head in the add-on's file is that body, `GEO-body_female_realistic`); `python tools/eye_patch.py make` remakes it from the
bundle's .blend in `vendor/human_base_meshes/` (or `--blend PATH`).

The user: "in ours the eyelids look like thin skin bending over the eye whereas the base mesh's eyelids actually look like meaty
flesh that curves in, ideally we want that look for the eyes, eyelid shape and then make it modifiable through some
basic shape keys". Why ours read thin: MHR's eye is a closed shell of skin cut open along the lid line, so the lid ends
in an edge with no thickness (the export lays it onto the eyeball, a sheet over a ball). The base mesh's head is one closed
skin that wraps round the eyeball like a socket: the lids are about 2 mm thick, their edge is rounded and rolls in to
touch the eye, the skin goes on just inside the eyeball behind them, the upper lid bulges over the eyeball up to a
crease, the lower lid has a soft roll. Measured (`tools/eye_patch.py`): the base mesh's eyeball 13.8 mm; its lids 1 to 3 mm over
it; within 15 mm of the eye's centre the base mesh has 4,391 points at its second multires level where MHR has 268.

- **The graft** (`python tools/eye_patch.py make`, inside Blender's module): the base mesh's head lined up on MHR's base face (a
  similarity fitted over the upper face round the eyes, 0.46 mm off it at the median); the left eye's region taken as
  the base mesh's own loops (80 points where the skin meets the eyeball, then 19 loops out over the lids and 5 in over the lining);
  its outer loops eased onto MHR's skin; MHR's triangles inside it hidden and the gap stitched (59 of MHR's points round
  the hole are the graft's too: no seam); the right eye the left mirrored. Each point keeps the MHR triangle nearest it
  (not MHR's strip over the eye) and moves as its points do, so the sliders, the sculpt, a photo's fit and the
  expressions carry it. Its UVs: the base mesh's lid laid on MHR's lid between the opening and the edge, so a photo skin or paint
  shows the photo's lid on it. `Content/Studio/Bodies/MHR_eyes.bin` (committed: every character's eyes).
- **In the Studio** (`eyegraft.js`; Skin, Eyes; on every character):
  drawn on the skin's own material, the wet membrane (the lining, where the lid meets the eye, its edge behind the lash
  line) pinker and glossier (skinshader.js); the eyeball the base mesh's size, following the skin round the eye (loops 15 and out)
  and growing with it; the lid's edge and the lining seated back on the eyeball as they rest on it; drawn behind real
  lids (no stencil, no cut); the lid shadow, the tear line, the lashes and the liner take its opening and its lid edges
  (`outline32`, `rim`).
- **Its blink**: each lid point turned about the eyeball's centre on the head's x axis by its share of the angle between
  the lids where it is, measured on the face as it is (the upper lid 85%, the lower 15%; the lid's edge and the lining
  whole, fading out by the 13th loop), so the lids slide over the eyeball and meet; never into the eyeball or the
  cornea's bulge (the lid rides over it shut, as a real lid shows the cornea's bump). MHR's own eyesClosed is left out
  while it's on.
- **The shape keys** (under the grafted eyes, with a preset menu: Default, East Asian, Caucasian; saved with the character as
  `st.eyes.shape`): **Eye size** (the eyeball and the opening together, 8% either way), **Crease** (−1 a monolid: the
  fold over the lid filled and a little lower; +1 a deep double lid: the fold set in; at the base mesh's crease, about the 12th
  loop, where the lid plate lying 1.85 mm over the eyeball meets the skin rising to the brow), **Inner fold** (the upper
  lid's skin over the inner corner, its edge staying), **Tilt** (the outer corner up or down, 8°), **Opening** (the lids
  apart or nearer), **Depth** (the eye and its lids back under the brow or forward, 1.2 mm). Our own fields in the eye's
  frame (eyegraft.js `SHAPE_KEYS`, eye_patch.py `apply`), size, tilt and depth fading by an even falloff from the opening
  to the graft's edge (harmonic over its triangles: the base mesh's loops bunch up toward the nose). East Asian is crease −0.8,
  inner fold 0.6, tilt 0.25, opening −0.3, depth 0.35; Caucasian crease 0.6, opening 0.15, depth −0.4.
- **The shut lid** (the user, seeing grey stripes on it: "should just blend in with the rest of the skin color but maybe
  make it possible to apply makeup (eye shadow) onto that closed eyelid part"): shut, the base mesh's upper lid unfolds over skin
  that a photo never saw open (open, it lies folded under the crease), and its UVs, laid from MHR's narrow lid, stretched
  whatever the photo had there into stripes (on the test character, a screenshot with the Studio's circles printed over
  the lid). So from its edge to the crease the lid reads the photo and the paint four mip levels softer and 90% of the
  way to the photo's own skin tone (`photoBlur`, skinshader.js), and its skin and makeup are worked out where it lies
  open, laid flat from the lash line to the crease (`skinPlaces`, the drawn objPos), with the makeup's lid lines from the
  open lid (`lidFront`, `skinLm`): eyeshadow put on the open lid covers the shut lid from the lash line to the crease and
  goes down with it, as on a real lid; the liner stays on the lashes' roots.
- **The graft's extent**: the base mesh's own loops kept to the 21st (eased onto MHR's skin from the 16th, so the base mesh's crease and the
  fold over it stay the base mesh's), reaching 12 mm above the eye's centre, under the brow's ends; so the brows lie on whichever
  skin is there (`skinNear` takes the graft's triangles and leaves out MHR's hidden ones).
- **EYEPATCH** (`python tools/eye_patch.py check`, in check_all; says so and passes when the graft isn't made here): the
  seam (MHR's own points round the hole, the edge on MHR's skin), the right eye the left mirrored, and on MHR's base and
  every character's body found, and on MHR's base with both presets and every key at its ends: nothing of a lid inside
  the eyeball open or shut, shut the lids meeting (within their edge's own spacing), the lid's edge on the eyeball. The
  Studio's points match it within a micron away from the cornea (over it they ride out with its bulge). `preview` draws
  it as clay (open, shut, and on a character: `Saved/Story/_look/eyes/`).
- **The export** (Export for Godot with the grafted eyes on): the skin carries the graft in place of MHR's skin under
  it, each of its corners on its MHR triangle's points and shares (`_MHRP`, `_MHRW`: the desk plays MHR's face shapes
  through them as the Studio does), its blink as `eyesClosed_L`/`_R` and their in-betweens, taken from the Studio's
  own shut states (MHR's skin holds still); the bake draws the graft over MHR's lids in the skin's texture, so its
  colours, the shut lid's tone, the waterline and the makeup reach Godot, where `HSBlink` shuts it as any export; the
  eyeballs are the graft's; the file's extras say `eyeGraft`. EYELIDS on such a file leaves out what faces the eyeball
  and lies in it (the lining, the lids' backs on the eye), reaches 2.5 mm behind the eye's front (the base mesh's lids are 2 to 3
  mm thick: farther is the far lid's rim through the opening) and takes contact within 0.1 mm as the lids' touch:
  `_graftedeyes` (a copy of `_studiotest` with the grafted eyes) at most 0.008 mm² through the blink, shut nothing, held shut in
  Godot nothing.
- **Not yet**: the eyelid-line handles on the graft; a lighter waterline along the shut lash line (the bake carries a
  little of its pink to the lid's front).

## 2d. Ages, Cutify and monster mode (DECISIONS 2026-11-10, night)

The user: "we are restricted to making older characters ... a toggle for monster mode (where we can modify and
exaggerate features) ... making younger npcs 8-18 age, I think the main issue is the height selector ... maybe a
separate toggleable 'cutify', but we should still be able to import image to face". The height slider stopped at 1.4 m,
but that was the symptom: an adult scaled down to 1.28 m is a small adult. `tools/character/grow.js` (plain JS, checked
in node by GROW) adds what the sculpt's offset fields couldn't: **proportions**, parts of the body made longer, shorter,
bigger or smaller against the rest, on MHR's own rig (a point belongs to an arm, a hand, the neck by its skin weights).

- **The head is the unit.** Nothing in grow.js moves a point of the head against another: "a bigger head" is the body
  under it made smaller about the top of the neck (the neck tapering from the body's size at its base to the head's at
  its top), and the Studio then scales the whole to the height. So everything made on the head stays exactly as it was
  made and needs no change: a face fitted to a picture, the 72 expressions, the eyes and their lids, the teeth, the
  brows and lashes, the hair's bake, the accessories (which are sized by the head: a child's glasses are a child's). In
  the body's compose (`index.html`): RAW (MHR with the identity weights, what the face fit sees) → `proportioned()`
  (grow.js `applyProps`: lengths first, each a plain move; then the hunch's bend; then sizes about their joints as those
  have moved; the body against the head last) → the height's scale from that body's own extent → the face's fit and the
  sculpt on top, each point's offset scaled by its part's own scale (`PARTK`: 1 on the head). With nothing set,
  `proportioned()` is RAW itself: every character from before is the same to the bit, and its clothes' bake keeps its
  key. The rig's joints follow (pose.js `joints` takes each point's scale: the T-pose and the export's skeleton on a
  child).
- **The height's rule.** A body from before the ages is as tall as its height says before its sculpt and its picture's
  fit go on (a taller forehead stands a few millimetres over it): its clothes' bake and its hair were made on that, and
  it stays so. A body with an age, in monster mode or with Cutify on is measured after everything (`exactHeight`): a
  1.28 m child is 1.28 m, an ogre with a low skull is still 2.6 m, soles on the floor.
- **Age** (Body, Age: 8 to 17, or the adult). `ageOf(age, base)` from a table by year: the head's height as a share of
  the stature (CDC's stature for age and Snyder's 1977 anthropometry of children: 0.156 at eight to 0.132 grown; MHR's
  own adult is 0.125, an eighth, so each age is the chart's ratio to its adult's times MHR's: 6.8 heads at eight, 7.5 at
  twelve, 8 grown: a child beside the Studio's adults as a real one beside real ones), the girls' and boys' average
  stature, how much of a child's build is left (`young`: narrow shoulders and pelvis, thin limbs, a straight waist, a
  flat chest and seat, a thin neck), how far the legs have run ahead of the torso (`leggy`: most at twelve) and how far
  the two builds have parted (`sexed`: nothing at eight, all by eighteen: the base's body weights are blended by it, so
  Feminine and Masculine give the same body at eight). The values go onto the sculpt's own controls, under the
  character's sliders as a base's sculpt does (they don't show in the sliders, which stay the character's own). Moving
  the age sets the height to its average (girls' to boys' by the base); the height slider (now from 1.1 m) is still
  free. At eight on a 1.28 m body the head is 18.8 cm from chin to crown, its skull 93% of the adult's at 1.70 m (a real
  child's head is about 93% round at eight) over a face a tenth shorter: the body is sized to the head with its short
  face counted, whether the age's own or a child's picture shortens it. And a head never shrinks growing up: the chart's
  one column of head shares is nearer a boy's timing, and a girl is at her adult height two years sooner, so the share
  is held to what gives the adult's skull at that age's height (unheld, a fourteen-year-old girl's skull came out 4%
  bigger than at eighteen). The skull against the adult's of the same base: feminine 97% at eight and full from twelve,
  halfway 94% and 98% at twelve, masculine 90%, 93% at twelve and 98% at fourteen (GROW holds it). A girl's earlier
  timing in the build itself (`young`, `leggy`, `sexed` are one column for both) is not modelled.
- **The age's face** (`CHILD_FACE`, times `young`): the face a tenth shorter from the eyes down (`face_height`: the
  nose, mouth, jaw and chin together toward the eyes' line; the eyes and ears stay), a narrower jaw, a smaller, shorter,
  flatter nose with a low bridge, a softer brow, a round lower face (`face_round`), bigger eyes (`eye_size`), a rounder
  forehead. **Young face** (0 to 1) turns it down alone, the body's proportions staying: for a child's own picture,
  whose fit already gives the face.
- **Image to face on a child.** The fit is still made on RAW and added after; the age's fields go on after it, as the
  sculpt's always did. GROWPAGE fits a front picture on a nine-year-old: the face fitted, nothing under the neck
  moved, the head still the age's share of the height.
- **Cutify** (Body, under the age; `CUTE`, times its amount, 0.6 by default, to 1.5): at any age, the baby schema on the
  sculpt's controls: bigger eyes a little further apart, a shorter, rounder face, a smaller nose, mouth and chin, a soft
  brow, a round forehead; the face alone (nothing of it lifts the crown: hair and hats stay as they sit). An eye made
  bigger by the sculpt keeps its iris's share (`eyeGrow`: the iris grows with it;
  an eyeball bigger for any other reason keeps the iris's own size, as before).
- **A control's whole value** is the character's slider plus its base's, its age's and Cutify's, eased into a limit
  (`soften`: as it is up to 1.75, never past 2.3; in monster mode 3 and 3.4) and never past where its field turns the
  skin inside out (`REACH`: a nose narrowed to nothing, lips pushed through the teeth, an ear pressed into the head).
- **Monster mode** (the switch over the sculpt, saved with the character): the sliders' and the circles' reach is 3
  instead of 1, the height runs 0.4 to 3.5 m, and the **Creature** group shows: Eye slant, Pointed ears, Snout, Long
  skull, Hunch (the back bent forward from the waist, the head brought back up to look ahead). New controls a person
  can use too: **Proportions** (Head size, Torso length, Leg length, Arm length, Hands, Feet, Fingers; **Neck length**
  is one of them and is listed in Body, with the neck's other sliders, since 2026-11-12),
  Face (Face length, Round face, Eye size, Eye spacing, Deep-set eyes, Ear size, Ears out), Body (Bust, Seat).
  **Fangs** and **Pointed teeth** (Face, Mouth; teeth.js). Off, every slider comes back into a person's range and the
  creature's own go to 0 (asked first). The head's view follows a head a hunch or a long neck has carried (`HEADOFF`),
  and small and giant bodies are framed to fill the view.
- **The creatures as presets** (DECISIONS 2026-11-11: "add presets for the monster-ish shapes you made so I can use
  them"). Body, under Monster mode: seven **cards**, each a picture of the creature (`MONSTERS` in grow.js: goblin,
  ghoul, ogre, grey alien, demon, hag, imp), there whether Monster mode is on or not. A click makes the character that
  creature and switches Monster mode on: its sculpt, its height, its base, its build from MHR's own identity shapes
  (a big body made of them is one body; the sculpt's bumps stacked up read as rolls), its teeth, and **its look**: a
  skin colour on the procedural skin (a skin preset and what's changed on it: the goblin's green with dark freckles,
  the ghoul's grey with veins, the hag's seventy years), its eyes (an eye style and what's changed on it: the goblin's
  yellow slit, the ghoul's milky white, the alien's all black), its lips, how stained its teeth are and, for the demon
  and the imp, horns off the Accessories. All of it is plain settings: every slider it sets is still the character's
  to move, and Skin, Face and Accessories show what it chose. Two switches under the cards: **With its look** (off:
  the shape and the teeth alone, on the character's own skin and eyes) and **Face only** (its head on the character's
  own body: the Face group's controls and the Creature group's but the hunch, `onHead`; the height, the build and the
  body's sliders stay). A whole creature starts from the adult (an imp is small, not a child; the age is still there
  after). The card worn is marked and kept with the character (`creature`), until Monster mode goes off. A character
  with a shape of its own is asked before a card replaces it.
  - **The pictures** are kept in the project, `Content/Studio/Creatures/thumbs/<id>.jpg` (as the outfits' are), made by
    the page itself: `node tools/character/creatures.mjs thumbs` (each creature with its look on a scratch character,
    its head and what it wears fitted into the card through the view's own camera). A card with no picture yet shows
    its skin's colour.
  - **As characters of their own**: `node tools/character/creatures.mjs make [--only goblin,ogre] [--export]` makes
    each creature a character (`creature_goblin` ...) from its preset and saves it; `--export` also runs Export for
    Godot on each (`Exports/characters/creature_goblin/creature_goblin.glb`, its face shapes baked: ready to drop into
    a Godot project). One that's there already is left as it is (it may be yours by now) unless `--again`.
  - A new creature is an entry in `MONSTERS` (its `label`, `about`, `height`, `base`, `shape`, `teeth`, `sculpt` and
    `look`: `tone`, `skin` {`preset`, `tweak`}, `eyes` {`style`, `set`}, `lips`, `teeth`, `horns` {`style`, `set`});
    GROW checks its controls exist, GROWPAGE that every name its look uses is the page's own, then `creatures.mjs
    thumbs --only <id>` for its picture.
- **The ears as a sheet** (LESSONS): an ear's weight is a harmonic blend over the mesh (1 where it stands clear of the
  head, 0 on the skull, each point between the mean of its neighbours), so its front and back faces are ear alike; its
  fields grow with how far a point stands off the head, so nothing moves at its root.
- **Horns and animal ears** (Accessories; `tools/character/horns.js`). Horns: a tube along its kind's curve from the
  scalp (found as the nearest skin, so they sit on any head, a creature's too), frames carried along the curve (a
  spiral never flips), growth rings as real ridges, a keel, a twist, a base that swells where it leaves the skin; its
  colour from base to tip, its rings and its grain a texture drawn here with their relief as a normal map (or a set off
  the shelf, or a metal); thirteen kinds; Length, Thickness, Spread, Curl, Rings, Tip forward, a Tip colour. Ears: a
  cupped shell along a line (upright, out to the side, flopped over by **Flop**, a pig's tip folded forward), its
  inside a panel of its own colour, on a headband or growing from the head; thirteen kinds, a cow's with a tag. Made
  again only when the head or their own settings change.
- **In a file** (§3.1): each ear's chain of bones, `jiggle_ear_L_0` ... `jiggle_ear_L_tip` under `c_head`, after MHR's
  127 in the skeleton, the ear, its inside and its tag skinned along it (each point between the two bones whose
  middles it lies between), the chain's softness in the ear's node's extras and all chains in the scene's
  (`jiggle`); horns and the headband whole on the head's bone (they took the nearest skin's weights before: a ram's
  horn by the jaw bent with the neck). Godot's **HSJiggle** springs them (docs/GODOT_LOOK.md §5n).
- **The head's scale in a file.** The 72 face shapes are MHR's moves times the head's scale. A reader (the desk's
  `tools/shared/face.js`, the Godot copy's bake `tools/face_morphs.mjs`) took that from the body's height over MHR's,
  which was near enough while every body was an adult's; a nine-year-old's head is 0.93 of MHR's on a body 0.77 as
  tall, and an ogre's is near MHR's on a body half as tall again. The export now says it (`studioScale` on its skin's
  node) and both readers use it, falling back to the height for a file from before. (FACEMORPHS has the case; GROWPAGE
  reads it in the file.)
- **Checks**: GROW (`node tools/character/growtest.mjs`, in check_all), GROWPAGE (`node
  tools/character/growpagetest.mjs`, the Studio's server running), JIGGLE (`python tools/godot/jiggle_check.py`).
- **Pictures** (drawn on the CPU here, small: to be looked at again on the card):
  `docs/studio_sheets/2026-11-10_ages_cutify.jpg` (each base at eight, ten, twelve, fourteen, sixteen and grown; a face
  grown, cutified at 0.6 and 1, at nine with and without Cutify, at fourteen; a ten-year-old in the summer school
  uniform, a nine-year-old in a t-shirt and shorts, a fifteen-year-old in a hoodie and jeans),
  `2026-11-10_creatures.jpg` (the seven creatures, body and head; the demon's fangs), `2026-11-10_horns_ears.jpg` (the
  thirteen horns and the thirteen ears; a ten-year-old with a cow's ears and horns), and in Godot
  `docs/godot_sheets/2026-11-10_ears_jiggle.jpg` (the export of a nine-year-old with a bull's horns and tagged cow ears:
  at rest, thrown sideways, turned, dropped, settled).
- **Hair rides the head.** The salon's bake is placed by the head's frame it was baked on (`salon_bake.json`), so a
  height or an age set afterwards used to leave it hanging where the old head was. The character now records the head
  its hair was made on (`hairHead` in character.json: which bake, and the head's frame on the body before its face's fit
  and sculpt, `headBase`), written when the salon bakes here, and the bake is placed again on every change by how that
  frame has moved and been sized since (`placeHair`: now times then's inverse; nothing at all when it hasn't). A bake
  with no record (an older one, one made in the salon alone) takes the head the character opens with when it sits on it
  (within 15 mm in height and 15% in size: a face's fit moves the frame's points by millimetres, a height or an age by
  centimetres); one that sits on no head we know is left where it was baked and the view says "the hair was baked on
  another head". It is only placed again, not made again: hair that lay on the shoulders or was kept off the body was
  shaped on the body it had, and a skull reshaped under it (Forehead height lifts the crown 14 mm a slider, a creature's
  Long skull the back of the head 34 mm) isn't followed (Hair, then Bake). GROWPAGE: four marks baked on an adult's
  scalp are still on their points at eight and opened again at ten. And with real hair, end to end: the salon's eight
  presets all build on a nine-year-old's head (96 to 99% of the scalp covered, nothing inside the head, as SALON asks of
  an adult's), one let fall and baked onto her is worn in the Studio, and it rides her head at eight, at fourteen and
  grown (`docs/studio_sheets/2026-11-10_child_hair.jpg`).
- **Not yet**: the salon shows the body it was given; clothes are cut again on the smaller body by themselves, but
  the outfits' pictures are an adult's; the growth table's numbers and each creature are first passes to look at on
  the card; younger than eight (the head's share and the limbs change faster there) isn't offered.

## 2e. Anime: a bust from flat to very full (DECISIONS 2026-11-11, latest)

The user asked for a figure after a Daz3D picture ("we should be able to make the woman more flat too but also more
busty like the image"), said of the first try "from the front angle it looks perfect, but as you go towards a side view
it looks unnaturally pointy, it should feel more how a waterballoon would sit rather than a fine point", and then kept
only this of the whole look-alike: "keep the new bust slider as an 'anime' toggleable". So it's a switch, as Cutify and
Monster mode are.

- **The switch** (Body, under Cutify; saved with the character as `anime`). On, a **Bust** slider shows under it and
  runs from −2 to 3; it is the same value as Sculpt, Body, Bust (each moves the other, and that slider and its circle
  on the body run as far). **Off, the Bust is the plain slider it always was**, −1 to 1 (a creature's ±3), one small
  bump added to the body: nothing below runs, and every character made before is the same to the bit. Switched off
  on a character whose Bust is past the plain range, the value comes back into it (the status line says so).
- **Between −1 and 1 it is that same bump**, Anime or not: switching Anime on changes nothing until the slider leaves
  the plain range (no clothes cut again, a clothes bake keeps its key).
- **Past 1: a ball hung from the breast's root** (`sculpt.js` `bustShape`). The first try was a field like the other
  controls, a bigger bump added onto the body. But the body already has a small breast, and the Bust's own bump sits
  on it: three bumps on one spot are a cone, whatever their profiles. So this is not a field: it makes the shape
  itself, on the body as it stands (its base, shape sliders, age and other sculpt already on it).
  - **The foot**: on each side the points of the breast's root, an oval on the chest from under the collarbone to the
    fold under the breast, found once on MHR's base (104 points a side), and the ring of points round it.
  - **The chest wall under the breast** is the body's own: a membrane across the foot's ring (each foot point a fixed
    blend of the ring's points, weights solved once), so the breast the body has is taken up into the ball instead of
    standing on it.
  - **The ball**: its middle below the foot's middle and a little outward, more the bigger it is (the weight low);
    each foot point goes its own share of the way along the skin from the ball's front to its place on the foot's
    edge: round the ball, then straight to the edge where the skin leaves the ball (the long slope down from the
    collarbone, eased into the chest at the top: no crease), or, where the ball hangs out past the edge (below the
    fold, and at the sides when it's big), on round the ball back to the ribs (the fold stays where it is). The spot
    of skin that was the breast's middle lands below the ball's front, more the bigger (skin slides down a heavy
    breast). The two never pass through each other: they press together 4 mm either side of the chest's middle.
  - **Its size**, at the slider's value v, k = v − 1, on an adult's chest: the front stands 6 + 5.5k cm off the chest
    wall, the ball's radius is 5.5 + 2.5k cm, its middle 1.5 + 1.8k cm below the foot's. The body's own breast blends
    into the ball over the first 0.6 (all ball from 1.6). Measured on the feminine base at 1.62 m: the front 2.1 cm
    further out at 1.3, 4.2 at 1.6, 6.2 at 2, 10.9 at 3; a sphere of 9.7 cm fits the front at 3 within 2 mm, where the
    plain bump pushed to 3 stood 11 mm proud of its best sphere. **3 is about the picture's size**, 2 to 2.2 the "60% as
    busty" the user asked for; it is scaled to the chest it's on (a child's, a goblin's: the part's own scale).
- **Under −1: flatter.** The breast is taken back toward that same wall, at −2 a flat chest with 4 mm of a chest's own
  swell left on it (taking the bump off a breast of another shape left dents: the first −2).
- **A control's whole value** with Anime on: the Bust's bump stops at −1 and 1 (`fieldValue`, the control's `cap`), its
  slider's run is `grow.js` `SPAN.bust`, and its sum (the slider, the base's, the age's) eases into a limit past 3
  instead of past 1.75 (`limits`).
- **Clothes** are cut on a **dress form** of a full bust, not on the hanging shape itself (TAILOR §1j): the same ball
  with the hollow under it closed. The body shown, saved for the salon and exported is always the hanging one.
- **Outside the page**: `tailor/node.mjs` `mhrBody(m, weights, height, sculpt, { anime, form })` and
  `grownBody(m, { ..., anime, form })`; `node tools/character/tailor/sheet.mjs --anime --sculpt '{"bust": 2}'` pictures
  clothes on one. The wardrobe's dummy and the outfits' pictures are plain bodies.
- **Checks**: GROW. Anime off: the bump alone at any value, as it was. On: only the breasts' own points move (the
  fold, the ribs and the arms stay), the two sides alike, fuller at every step, the front a ball and not a point, its
  weight low, flat at −2, the dress form with no underside and its gathered points exactly on the points they lie on.
- **Pictures** (drawn on the CPU here): `docs/studio_sheets/2026-11-11_anime_bust.jpg` (the switch and its slider; the
  feminine base with Anime off at Bust 1, on at −2, 2 and 3; the red sweater dress on the plain body and on Bust 2).
- **Not yet**: MHR's chest is coarse (104 points a breast), so the very top of the slider is faceted close up; nothing
  lifts or holds a full bust (a bra is cut on the form and sits on it, the breast under it the hanging one); it
  doesn't move in play (the ears have bone chains for HSJiggle, the bust none: LATER).

## 2f. The v2female base (DECISIONS 2026-11-12, v2female)

The user, while a Daz3D hairstyle was being matched 1:1 (docs/HAIR_V2.md §10): "If required to make these hairstyles
work feel free to create a better preset base head shape called v2female (which still allows face sculpting etc)", and
once it was found to be required, "lets create a v2female base". It was required because the hair by the twin tails'
ties could not be judged closer than 2 cm while the head and the neck under it were MHR's.

- **What it is.** Not a third body: *what the feminine end of the base becomes*. `Content/Studio/Bodies/MHR_presets.json`
  holds `presets.v2female` (MHR's identity weights: the feminine base's own, so the body is the feminine base's and
  clothes cut for it fit as they did) and `sculpt.v2female` (the sculpt it carries in place of the feminine base's):

  | control | value | | control | value |
  |---|---|---|---|---|
  | Belly | -0.7 (the feminine base's) | | Neck width | -0.7 |
  | Face length | -0.8 | | Face taper | -1 |
  | Eye spacing | 1.6 | | Eye size | 0.7 |
  | Nose size | -0.4 | | Nose projection | -0.22 |
  | Nose length | 0.35 | | Nose bridge | -0.22 |
  | Mouth width | -0.72 | | Lips | 0.13 |
  | Brow ridge | -0.18 | | Forehead slope | 0.45 |
  | Chin length | -0.15 | | Chin width | -0.8 |
  | Jaw width | -0.5 | | Cheekbones | -0.2 |
  | Neck base | -0.3 | | Neck length | -0.35 |

  Twenty plain values on the Sculpt's own controls (Neck length is a proportion, `grow.js`; a base carries it the
  same way): a base is a starting point, and nothing in it is locked. The
  character's own sliders and circles add to them (`sculptValue`: its own, its base's, its age's and Cutify's, eased
  into the control's limit), so the user's "which still allows face sculpting" holds by construction: a character on
  v2female with Eye size at -0.7 has the feminine base's eyes again.
- **In the page.** Body, Base: a fourth button, **v2female** (the feminine base with the switch on), and under the
  base's slider a switch, **v2female**, to turn it on or off for a character already made without touching its
  base. Toward masculine it fades out as the feminine base's own sculpt does (at Average half of it is there, at
  Masculine none: `baseSculpt`). Kept with the character as `v2: 1`, absent when off, so characters saved before are
  as they were. The body's cache key carries it (`bodyKey`: its weights are the feminine base's, so nothing else
  would tell the two apart and the clothes cut for one would be kept for the other). A creature's card turns it off
  (a creature is its own whole shape). New characters start without it.
- **Controls made for it** (`sculpt.js`), all for anyone (Shoulder slope was made for the first answer about the
  shoulders and is not used by the base):
  - **Neck width** (Body). MHR's neck could not be slimmed: the sculpt's *Neck* is the throat under the jaw alone
    (it stops 7.5 cm from the neck's axis; the widest of the neck is its back and sides, further out), and MHR's
    identity shapes make a whole body heavier or lighter. Neck width moves every point of the neck toward its own
    axis or away from it, 30% at -1. *Its axis* is the line through the neck's middle (front to back) at two heights
    of the neck proper, 1.45 m and 1.2 cm under the chin. *Where it ends above* goes by the bearing round that axis:
    at the front just under the chin, round the side along the jaw's line, then from just behind the jaw up to under
    the ear and the skull's base and so round the nape; it comes in over 3 cm under that line at the front and sides
    (the jaw overhangs the neck anyway) and over 5 cm at the back, where the skull runs down into the nape, and
    behind the jaw its offsets are smoothed over the mesh (three rounds), so the jaw, the chin and the skull stay
    and no step or crease is left under the skull. *Below* it fades in
    from 1.405 to 1.46 m, and out from 8 to 12.5 cm off the axis (the shoulders are not the neck). *Its reach* is
    -1.4 (`grow.js` `REACH`): past it the triangles where the neck runs into the shoulders turn over.
  - **Face taper** (Face, with a circle of its own on the jaw). The face narrowing from the eyes down to the chin,
    or widening: every point of the face's front moves sideways in proportion to how far out it is, more the lower
    it is (nothing at the eyes' line, a third of it at the mouth, all of it at the chin: a fifth narrower there at
    -1), easing out under the chin and toward the ears. Because every point at one height moves in the same
    proportion, each height keeps its shape and nothing is left standing over what moved. With *Face length* it
    makes a small lower face, shorter and narrower together. (Jaw width is a spot at the jaw's angle and Chin width
    a spot at the chin: pulled in far, they leave the cheek above them as a ledge. A band along the jaw's own line
    was tried first and did the same.)
  - **Shoulder slope** (Body; the Shoulder circle moves it up and down as it moves Shoulders sideways). The
    shoulders' points and the arms lower (or higher), the line from the neck coming down to them: nothing within
    7 cm of the middle, all of it (3 cm at 1) from 19 cm out, the arm whole. Its reach is 1.8 (past it the armpit
    folds).
  - **Neck base** (Body, with a circle of its own on the shoulder's top). The rise from the shoulders up to the neck,
    the trapezius' top edge: hollowed and lower, or fuller and higher. Only the top of the shoulder between the
    neck's root and the shoulder's point, most 9 cm out (2.5 cm at 1), nothing at either end. Its reach is -2.3 to
    1.9.
- **The neck and the shoulders** (the user, on seeing the base: "the shoulders and base of neck ... looks a bit
  uncanny when it should look more feminine"; then, on my first answer, a long neck on sloped, narrowed shoulders:
  "instead of doing the long neck ... try match the neck shape to the shoulders in a same way" as the face and the
  hair are matched). Measured in the fitted frames of her front and three-quarter pictures:
  - **her shoulders are where MHR's are.** Her collar's line lies 0.75 cm over our shoulder line at 14 cm out
    once the 8 degrees her head is tilted on her body are taken off (they raise one side and lower the other by
    1.9 cm there, which is what the two sides showed), and a collar is about that thick. Her head sits close on
    her shoulders. Nothing is dropped, sloped or narrowed.
  - **her neck is a straight column**, about 9.3 cm across from under the ears to the collar (the head's own
    units). Ours was 10.2 to 11 from the chin's level down and wider still under the ears, because Neck width
    stopped at the jaw's height all the way round to behind the ear: a neck that flared at its top. The field now
    climbs to under the ear just behind the jaw, and the base carries -0.7: **9.2 to 9.9 cm against her 9.1 to 9.4
    from the chin's level to 2.5 cm under it.**
  - **the rise from her shoulders to her neck is a little lower beside the neck**: Neck base -0.3 (the collar's
    line is all there is to go on; -0.6 put our skin under where hers can be).
  - The first answer's picture is not kept; the one in the repo is the base as it is.
- **The neck's length** (the user, later the same day: "make sure we add a modifier / slider in general to make necks
  shorter ... unrealistic turtle length necks ... a lot of Asian people don't"). There was a slider, **Neck length**
  (`grow.js`, a proportion: the head comes down whole, the neck's skin with it by its height, the shoulders stay),
  filed under Proportions. It is listed in **Body** now, right after Neck and Neck width (a control can name the one
  it comes after: `after`), and its help says what it does: -1 is about 2.5 cm off an adult's neck, +1 as much
  longer. The chin over the pit of the neck (the front's middle, where the throat meets the chest), bodies at their
  own heights:

  | | the chin over the pit of the neck | of the head's height |
  |---|---|---|
  | feminine | 6.6 cm | 0.32 |
  | average | 6.2 | 0.29 |
  | masculine | 5.3 | 0.23 |
  | v2female as it was | 7.5 | 0.39 |
  | **v2female now** (Neck length -0.35) | **6.7** | **0.34** |
  | feminine, Neck length -1 / +1 | 4.2 / 8.9 | 0.20 / 0.44 |

  So the long neck was this base's: *Face length* had made the lower face short by lifting the chin, and the neck
  took up that centimetre; slim, it read longer still. By her pictures: in the front one (the fitted camera, her
  head's tilt taken off the body) her collar's top edge on her left shoulder is at 316 px over columns 880 to 960;
  our bare shoulder was at 330, a centimetre under it, and is at 316. The skin has to be under the cloth, so that
  picture alone says -0.25 or so; in the three-quarter one her bare shoulder is higher than ours even at -0.4 (her
  arm may be up: -0.4 to -0.6, or a pose). -0.35 is between them. ("Her shoulders are where MHR's are", above, was
  read off the same collar and let the centimetre go as the cloth's thickness: the shoulders are MHR's, and the head
  sat a centimetre high on them.) The other bases are not long by these numbers and are left as they are.
- **Held to her pictures.** The first version (the same day) was made from proportions read off one picture by eye
  and carried Neck width at -1. Then the head was laid against two of her pictures properly (the scratch
  `rig2/joint.mjs`: landmarks on the body, MediaPipe's points through `MHR_landmarks.json` and the ear as the sculpt
  finds it, against the same points in each picture; each picture's camera fitted, the misses in millimetres), and:
  - **her neck is 1.22 to 1.27 times as wide as her eyes are apart** (124 to 129 px against 101.9), and both of
    its edges are in the picture (the head is turned 10 degrees on it, which is why its middle is not under the
    chin and why one edge was missed the first time). At -1 ours was 1.10 (7.4 cm against eyes 6.7 apart) and,
    from the side, dented at the nape. At -0.4, the second try, 1.34. At **-0.7**, with the field reaching under
    the ears, 1.19 (8.0 cm at its narrowest).
  - **her lower face is short**: the chin 1 cm higher than ours, the mouth 3 mm, the nose's tip 3 mm *lower*; and
    with the chins aligned her jaw's outline is ours on the side where it is clear of hair. So the face is shorter
    under the eyes (Face length -0.8, with the nose let down again by Nose length) and narrower in step with it
    (Face taper -1): shortened alone, the same width in less height reads as a heavy jaw.
  - **her mouth is 16% narrower**: Mouth width -0.72 (past -1 it pinches).
  - What a fit by points alone asked for and was **not** taken: a mouth at -1.27 and a face squeezed further (the
    points landed, the face looked wrong), the chin back by 8 mm (her mouth is open in that picture).
  The landmarks now land 3.4 mm off in the front picture and 2.8 in the other (4.7 and 3.7 on the first version):
  the eyes, nose, mouth and far ear within 2.5 mm.
- **Measured** (GROW: bodies at the feminine adult's own height, 1.63 m): the neck at its narrowest from the front 10.3 cm on the feminine
  base, 7.2 with Neck width at -1, **8.0 on v2female**. Neck width alone moves the chin, the nose, the mouth, the
  eyes, the head's sides and the forehead 0.00 mm, the jaw's line by the mouth 0.0 mm, and under the ear behind
  the jaw it comes in 6.6 mm (meant); held at its reach none of the 1306 triangles it moves is turned past a right
  angle. The masculine base is the same with v2female on to the bit. The
  face: the eyes 6.7 cm apart (the feminine base's 5.7), each 27.1 mm corner to corner (24.7), 9.1 cm from the
  eyes' line to the chin (10.1), 9.7 cm between the jaw's angles (10.7), 6.3 across the jaw by the chin (7.5), the
  mouth 3.8 (4.8). Face taper at -1 alone: the jaw by the chin 16% nearer the middle, at the mouth's height 10%, the
  mouth's corners 7%, the eyes and the ears 0.2 mm; at one height every point within 2.4% of the same proportion;
  no triangle turned at 3 either way. Shoulder slope at 1 alone: the arm down whole by 30 mm and nothing sideways,
  13 to 17 mm halfway out, 0.00 mm within 7 cm of the middle, from the chin up and on the trunk under the armpits.
  Neck base at 1 alone: 25 mm at 9 cm out, 0.00 mm within 4.5 cm of the middle, from the shoulder's point out and
  from the chin up. **v2female's neck base**: the top of the shoulder 9 cm out 0.7 cm lower against the
  shoulder's point than the feminine base's, the shoulder's point as high over the pit of the neck as it was.
  **Neck length**: at -1 and at 1 on the feminine base the chin 2.4 cm nearer the pit of the neck or further, the
  head's own height within 3% (the body is made as tall again), the shoulder's point where it was against the pit,
  no triangle of the neck or the shoulders turned over; **v2female's neck**: the chin 6.7 cm over the pit of the neck
  against the feminine base's 6.6, and 7.5 without the Neck length it carries.
- **Outside the page**: `tailor/node.mjs` `grownBody(m, { base: -1, v2: 1, ... })`; `grow.js` `V2FEMALE` is what the
  hair editor's test body adds to it (`hair2/node.mjs` `bodyByName("v2female")`: 1.62 m and a full bust, for tails to
  lie on), `node tools/character/hair2/make.mjs --body v2female`.
- **The file and its tool**: `tools/character/mhr.py` knows the base (`SCULPT["v2female"]`, `SAME_BODY`: a base that
  is another's body with a sculpt of its own), but the file was written by hand in the tool's layout. `mhr.py
  presets` fits the bodies again and no longer lands on the committed weights (feminine up to 0.9 off, masculine
  1.6: found by running it into a scratch copy), and every character made on a base depends on those. Don't run it
  to add a base.
- **Checks**: GROW (the lines above), GROWPAGE (the button and the switch in the page: the neck narrower on
  v2female, the feminine base again with the switch off, saved and opened again with it on).
- **Not matched, and known**: her right ear in the front picture leans more than ours (its top 5 mm further out,
  its lobe 7 mm further in; her left ear in the other picture fits within 2 mm: no control was made for one ear in
  one picture). Her shoulders begin lower under the chin than MHR's (a longer neck, or sloping shoulders, or her
  pose: this was read off too early. Measured with her head's tilt taken off, they are where MHR's are: above). Her eyes are far
  larger than Eye size makes them.
- **Known in Neck width**: its first form dented the nape under the ears past about -0.7. The longer run-in at the
  back and the smoothing behind the jaw were made for that and looked at on v2female's -0.7 (from the side, behind
  and three quarters: a smooth taper); further down the slider nobody has looked.
- **A side effect to know**: the hair tools size a head by its height from the top to the chin (`salonref.js`
  `headFrame`). v2female's chin is 1 cm higher, so its frame is 6.6% smaller than the feminine base's (0.868
  against 0.929) on the same skull, and hair grown from the same numbers is that much smaller on it.
- **Picture** (Godot's, of the hair tool's bare head and shoulders: no skin, no eyes): `docs/studio_sheets/2026-11-12_v2female.jpg`
  (the feminine base and v2female; from the front, three quarters, the side and behind).
- **Not yet**: no outfit has been looked at on its neck and shoulders (clothes are cut on the body, so they follow;
  nobody has looked); the wardrobe's dummy and the outfits' cards are the plain bodies; seen in the Studio's own
  T-pose view only by the user.

## 2g. The bodyv2 base (DECISIONS 2026-11-12, a T-pose reference)

The user sent a Daz3D character from the front in a T-pose ("this t pose reference for what the body should look
like ... create a base bodyv2 that aims to get these exact proportions, 1:1 but don't calculate the clothing (mostly
the cardigan and sneakers) ... this mesh is the medium size (slightly chubbier side) so imagine the bust and waist
width sliders around mid", and: "I mean thighs and legs too and hands and feet"). The picture stays out of git
(`Saved/Body/ref/t1.jpg`).

- **What it is.** *What the feminine end's body becomes*, as v2female is what its head becomes; the two are separate
  switches and are meant together. `MHR_presets.json` holds `presets.bodyv2` (MHR's identity weights: the body's
  twenty its own, the head's and the hands' the feminine base's) and `sculpt.bodyv2`, the sliders it carries, which
  change only what they list (the head's and the neck's stay v2female's or the feminine base's):

  | slider | value | | slider | value |
  |---|---|---|---|---|
  | Arm length | -1.75 | | Thighs | 0.8 |
  | Torso length | -0.47 | | Shoulders | -0.27 |
  | Leg length | -0.33 | | Waist | -0.15 |
  | Neck length | -0.1 (on v2female's -0.35) | | Upper arms | -0.11 |
  | Calves | -0.09 | | | |

  A character on it has every slider at 0 and moves from there, so this build is the middle: a slimmer and a fuller
  one are each a slider's half away, as asked.
- **In the page.** Body, Base: a fifth button, **bodyv2** (the feminine base with both switches on), and a second
  switch under v2female's, **bodyv2**. Kept with the character as `b2: 1`; in the body's cache key; a creature's
  card turns it off; new characters start without it; toward masculine it fades out as the base's sculpt does.
  Outside the page: `grownBody(m, { base: -1, v2: 1, body2: 1 })`, `grow.js` `BODYV2`, `hair2/node.mjs`
  `bodyByName("bodyv2")`, `make.mjs --body bodyv2`. (`trial: { weights, sculpt }` puts a body being fitted in its
  place.)
- **How the picture was read.** The figure cut from its backdrop (a mask), then by height: the two legs' edges, the
  trunk's width, the arms' top and bottom by how far out; and the face's marks off enlargements (the eyes' line, the
  mouth, the chin, the pit of the neck in the cardigan's V, the cuffs' edges, the fingertips). Everything is a share
  of her bare height: from the sole in the shoe (taken 2.5 cm over the shoe's bottom) to the skull's top under the
  hair (taken 3 cm under the hair's), 1311 px, said below in centimetres on a 163 cm body. That height is a guess
  at both ends, so the fit has the picture's scale and floor as unknowns of its own, held near it: they came out
  1.004 and -0.4 cm. The picture is not stretched (its round buttons are 12 by 12 px).
- **What was taken off for the clothes** (the user: "don't calculate the clothing"). The cardigan's knit: 1 cm a
  side on the bust and the hips, 2 where it hangs clear of the waist. Its sleeves: 0.8 cm above and below the arm,
  1.5 toward the cuff, where it bunches; the cuff itself not used. The cuff's edge is taken 2.5 cm past the wrist
  (the thumb leaves the cuff there). The leggings count as skin. The sneakers: only their soles.
- **The fit** (scratch scripts, kept as they were run in `docs/research/bodyfit/`): the body is the feminine base
  with v2female's head, in the Studio's own T-pose (`pose.js`), cut by planes as the picture was. Unknowns: twelve
  of MHR's body shapes (the ones that say something: hips, waist, bust, seat, belly, thighs; the subtle ones and
  the neck's stay the feminine base's), the length sliders, the limbs' and the trunk's sculpt sliders, the picture's
  scale and floor. Gauss-Newton with a ridge toward the feminine base and toward no slider at all (MHR's own shapes
  before the sculpt's bumps: Thighs is capped at 0.8, past which it left a ledge across the back of the thigh).

  | cm on a 163 cm body, T-pose | her picture | bodyv2 | the feminine body |
  |---|---|---|---|
  | the leg's width at the ankle (0.08 of the height) | 5.3 | 5.3 | 4.6 |
  | at the calf (0.20) | 11.2 | 11.0 | 9.1 |
  | under the knee (0.26) | 10.4 | 10.9 | 8.6 |
  | the thigh (0.35) | 14.2 | 14.5 | 10.4 |
  | the thigh's top (0.44) | 19.7 | 19.6 | 14.2 |
  | across the hips | 41.4 (the hem less its knit) | 41.5 | 34.5 |
  | across the waist | 29.8 (less the cardigan) | 30.7 | 21.4 |
  | the wrist from the middle | 58.3 | 59.2 | 66.2 |
  | the eyes' height | 152.4 | 152.8 | 153.2 |
  | the chin's | 143.3 | 143.1 | 143.8 |
  | the knee's joint | 46.6 | 47.0 | 46.9 |

  Over all 42 heights of the legs the width is 0.28 cm off (rms), 0.6 at the most; the trunk under the cardigan
  0.84 cm.
- **What the picture cannot say, and what was done.**
  - *Front to back.* It is from the front alone. The trunk's depths are held to a medium build's for these widths
    (mine, not hers): 26.5 cm at the bust, 20.5 under it, 21.5 at the waist, 24.5 at the belly and the hips. Round
    it at rest: bust 101 cm, waist 82, hips 113. A side picture would replace them.
  - *The arms.* Her wrists are 58 cm from her middle where MHR's and a real person's of her height are 66 to 68:
    arms about a sixth shorter. The cuffs' ends are straight in the picture, so the arms lie in its plane, and it is
    not stretched: the base carries it (Arm length -1.75). If it is the pose or the camera after all, it is that one
    slider.
  - *The shoulders.* In her T-pose the arms' line is 2.5 cm higher over the pit of the neck than ours: a raised arm
    takes the shoulder up with it, and the Studio's T-pose turns the arm alone. Read as the body's it came out as a
    neck 0.8 shorter still; the neck is measured from the chin to the pit of the neck instead (hers 6.3 cm, ours
    6.7 before: Neck length -0.1).
  - *The hands and the feet.* Her hands are half closed (the fingers show 6 cm past the cuff); ours end where hers
    do, and the Hands slider is left. Her sneakers are 8.5 cm across; our bare feet stand inside them with a shoe's
    margin; a foot's length cannot be seen from the front. Feet left.
  - *The head's size* is left v2female's: her eyes are 6% further apart than ours and her eyes-to-chin 3% shorter,
    which point opposite ways.
- **The joints inside a limb** (`pose.js` `readRig` `along`, `joints`), found on the way. An arm a sixth shorter
  showed that the elbow never followed Arm length: a limb's skin is weighted to its twist bones, not to its own
  bones, so the rule that finds a joint where the skin bends found the elbow no ring and it rode the shoulder (the
  ankle the same, under the knee): the upper arm's bone kept its length and the forearm's took all of it, 5 cm off
  the skin's elbow. Now the elbow and the ankle go along their limb's own line as far as the skin round them went
  (the middle one of their ring's votes, not their mean; sideways they stay on their parent). Arm length -1: the
  upper arm 9.7% shorter and the forearm 9.9%; an arm made thicker moves its elbow 2 mm. On the bodies there were,
  the elbow and the ankle are within 5 mm of where they were (a child of twelve's ankle 18 mm: it had not followed
  her legs).
- **Checks**: GROW (the base in the file; off, v2female's body to the bit; the legs at five heights, the trunk, the
  wrist, the heights, the tape, against the picture's numbers; the joints' three lines), GROWPAGE (the button and the
  switch: the hips wider, the hands nearer, as tall as set; off again; saved and opened again with it on), POSE.
- **Picture**: `docs/studio_sheets/2026-11-12_bodyv2.jpg` (the body from four sides beside v2female's on the
  feminine body; Godot's, bare, no skin).
- **Not yet**: no outfit has been looked at on it (the tailor cuts on any body; nobody has looked); the wardrobe's
  dummy and the outfits' cards are the plain bodies; the Studio's own view of it has been seen by nobody but the
  page check.

## 2h. Heads and bodies as preset cards (DECISIONS 2026-11-12, make-up enhanced)

The user: "is there any reason we dont have the new face shape as a preset thumbnail similar to the monster presets?
If w can have it as a thumbnail preset that we default to just do that, same with the body (body preset shouldnt
override the face), maybe create some thumbnail categories for, monster as we have now (untouched), heads, and
bodies." There was no good reason: v2female and bodyv2 had been built as two more Base buttons with a switch each
(§2f, §2g), off for new characters, because nobody had asked for the default to change.

- **What it is.** The Body tab has **Presets** under Base, in three categories picked by chips: **Heads**,
  **Bodies**, **Monsters**. Monsters are the creature cards of §2d, moved under their chip and otherwise untouched
  (their two switches, their note, `useCreature`). A head card and a body card are each *what a part of the feminine
  end of the base becomes*, as v2female and bodyv2 always were; the two older Base buttons and the two switches are
  gone. Each category starts with **Plain** (MHR's own feminine head; the slim feminine base's body).
- **A head changes the head and the neck only, a body the body only.** `grow.js` `femEnd` puts the feminine end
  together: MHR's identity weights of the *head* group from the head preset, of the *body* group from the body
  preset, the rest the feminine base's; the sculpt a preset carries only for the controls it lists. A head preset
  may list the Face and Forehead groups' controls, the Creature group's but the hunch, and the neck's (`headOwns`); a
  body preset everything else, and **Neck length**: how high the body carries the head is the body's word, and
  bodyv2 has it from its picture. GROW holds every preset to that and measures it: a head preset moves nothing under
  the shoulders; a body preset leaves the face's 468 points and the skull within half a millimetre against the crown
  (0.42 mm at the jaw's edge, where the neck's skin that Neck length stretches begins; the face itself 0.001 mm).
  Neither sets a slider of the character's own: every slider still moves from it.
- **A new character starts on v2female's head and bodyv2's body**, on the feminine base at 1.63 m (`grow.js`
  `NEW_START`, the page's `newStart`). A character saved before keeps what it had: a file with the two switches'
  `v2: 1` and `b2: 1` opens on the same two presets (`presetOf`); a file with neither opens plain. A character
  saves `headPreset` and `bodyPreset`.
- **Picked on another base**, a card moves the base to Feminine and says so: the presets are made on the feminine
  end and fade out toward the masculine one, so at Average a card would be half itself. A body card doesn't change
  the height that's set. A creature card clears both (a creature is shaped from the plain bases), as it cleared the
  two switches.
- **The heads** (`sculpt.<name>` in `MHR_presets.json`; `grow.js` `HEADS`): **v2female** (§2f), and three more after
  the user's other Daz3D faces ("look through our previous daz references ... and make an aligned one for 3 of
  them"):
  - **v2 elegant** (`v2elegant`): the Christmas picture's left face. Narrower eyes lifted at the outer corners
    (Eye size -0.1, Eye slant 0.3, set closer than v2female's: 1.05), a wider mouth with fuller lips (-0.45, 0.4),
    a firmer jaw (-0.2), a little more nose.
  - **v2 doll** (`v2doll`): its right face. Big lifted eyes set wide (0.5, 0.5, 1.6), round cheeks (0.3) over a
    small jaw (-0.9), a short turned-up nose, a small full mouth.
  - **v2 soft** (`v2soft`): the T-pose reference's own face (bodyv2's picture). A rounder, softer face (Round face
    0.3, Cheeks 0.2), heavier lids (Hooded lids 0.4), a broader nose, a wider mouth.
  - All three carry v2female's neck (its width, its base, its length).
- **How the three were aligned, and how far.** MediaPipe's 468 points on each picture against the same points on
  the head (`MHR_landmarks.json`), under a camera fitted with the sliders (a turn, a scale, a shift; across and down
  the picture trusted, depth hardly; the mouth and the brows trusted less where her expression moves them, the
  forehead under her fringe hardly). On v2female's own picture that fit finds her eyes, nose, mouth and face length
  in the right direction and **misses how narrow her jaw is** (the detector draws every face's outline toward an
  average one: 2.1 mm left). So each new face was measured *against hers* with the same fit on both, and what
  differs was added to the hand-made v2female (the controls a front view reads well in full, the rest by half);
  then the head's outline, eyes, nose base and lips were drawn over the picture from the fitted camera and looked
  at. All three faces' jaws and chins sit on v2female's outline already (one artist's style); what separates them
  is the eyes, the nose, the mouth and the cheeks. **This is not the perfectionist's 1:1 that v2female got** (two
  pictures, outlines read by hand, many rounds): one picture each, 2.8 to 3.5 mm rms left across the picture, most
  of it the detector's outline and its eye rings on drawn eyes. The scripts as they were run: `docs/research/headfit/`. A
  second pass per head, with outlines read off the picture, is what would tighten them.
  - Not made: the neon picture's face (she is laughing, mouth open: her jaw and cheeks can't be read at rest), and
    the two small faces of the fourth picture (60 px between the eyes, puckered).
- **The bodies** (`presets.<name>` and `sculpt.<name>`; `grow.js` `BODIES`): **bodyv2** (§2g), and two alterations
  of it ("more skinny (sports muscular woman), and more hourglass one"; no male presets: "just focus on feminity").
  Both keep bodyv2's proportions (the lengths of its legs, torso, arms and neck); their MHR weights are bodyv2's
  moved to measures of their own (`mhr.py` `fit_measures` from bodyv2's weights; `docs/research/bodyfit/alter/`), with
  sliders on top. Round each
  at 1.63 m (a tape: the hull's length, the arms left out):

  | | bust | waist | hips | waist / hips | shoulders across | a thigh |
  |---|---|---|---|---|---|---|
  | bodyv2 | 104 | 76 | 113 | 0.68 | 43.2 | 19.6 |
  | **v2 athletic** (`v2athletic`) | 97 | 63 | 102 | 0.62 | 47.5 | 16.0 |
  | **v2 hourglass** (`v2hourglass`) | 98 | 65 | 116 | 0.56 | 44.8 | 19.8 |

  - v2 athletic: lean and toned; the shoulders wider, a small waist, narrow hips, firmer arms, calves and seat
    (Upper arms 0.25, Forearms 0.15, Calves 0.35, Seat 0.4, Shoulders 0.2). **"Muscular" is build, not
    definition**: MHR's shapes and the sculpt give no muscle relief (no abs, no cut of the deltoid); that would be
    a normal map on the skin, not built.
  - v2 hourglass: bodyv2's hips and thighs under a small waist, a fuller bust and seat (Bust 0.6, Hips 0.25, Seat
    0.35). A first fit pinched the waist to 49 cm (0.41 of the hips), a cartoon's; this one is 0.56.
- **The cards' pictures**: `node tools/character/presets.mjs thumbs` (the Studio's page driven headless, as the
  creatures' are: PRESETS) into `Content/Studio/Presets/thumbs/head_<id>.jpg` and `body_<id>.jpg`, served at
  `api/presets/thumbs/`. A head: a character as the Studio starts one, in a buzz cut (the hair editor's `m_buzz`:
  the head's shape, forehead and hairline are what the card is for), a little from the side. A body: the whole
  figure from the front on v2female's head, in a cropped tee and leggings the tailor cuts on that body (the trunk
  and legs fill the card: the arms, out in MHR's pose, run off it).
- **Picture**: `docs/studio_sheets/2026-11-12_presets.jpg` (the nine cards: five heads, four bodies).
- **The checks start plain.** The page checks that make a scratch character (STUDIO, GROWPAGE, HAIR2PAGE,
  LIBRARYPAGE, SALON, the creatures' and the library's pictures) were written on MHR's halfway base at 1.7 m and
  say so before they make one (`window.__plainNew`): what they measure is unchanged. GROWPAGE also makes one as the
  Studio does and holds the start.
- **Checks**: GROW (every card's numbers in the file, the rule kept and measured, the older words the same bodies
  to the bit, the start, the two alterations' tapes against bodyv2's), GROWPAGE (the start and its cards marked,
  saved so; the three categories and each card's picture; a file from before the cards; v2female's card on the
  halfway base: the base to Feminine, the neck slender, the hips as they were; bodyv2's card: the hips wider, the
  hands nearer, the head not moved; Plain; the creatures under Monsters).
- **Not yet**: no outfit has been looked at on the two new bodies beyond the cards' tee and leggings; the sports
  bra's straps stand off bodyv2's shoulders (seen while the cards were tried: the tailor's, not looked into); the
  wardrobe's dummy and the outfits' cards are still the plain bodies; hair made on one head is not re-fitted when
  another head card is picked (the hair editor v2.0 grows again by itself; the salon's bake rides the head).

## 2i. The makeup of the Daz3D faces: two-tone lips, wet glints, a red lower line, a highlighter (DECISIONS 2026-11-12, make-up enhanced)

The user: "For makeup, I want better makeup, analyze the daz images I shared earlier and re-create those makeup looks
1:1 (the same lip gloss, shines etc, )". What each picture's makeup is, part by part, is in
`docs/research/makeup_reference.md` (the pictures stay out of git). What it took:

- **What the pictures have that the Studio could not draw.**
  - **A two-tone lip**: the deepest colour where the lips meet, a lighter one toward a soft border. The lipstick had
    one colour whose amount faded outward. Now `lips.colour2` and `lips.inner` (Face, Mouth: *Inner colour*, its
    colour and how much): the second colour takes over toward the outline's deepest line, the seam
    (`skinshader.js`, the lipstick's block; `lips.js` `LIP_PAINT`).
  - **Wet gloss that reads at any size and in any light**: small hard white glints, one broad and one small on the
    lower lip a little to her left, a thin one on the cupid's bow. A clear coat alone shows only what the scene's
    lamps give. Now `lips.shine` (*Wet shine*): the glints painted, their edges a little uneven, the coat at its
    smoothest under them (so a real light still adds its own). They are the references' look, not physics: they stay
    where they are drawn.
  - **A red line under the lower lashes** under a dark upper liner. The lower liner used the liner's colour. Now
    `lowerColor` (Skin, Makeup: *Lower liner colour*); the upper liner is drawn over it where they meet. Settings
    from before it, a saved character's or a preset's, take the liner's colour (`skinshader.js` `withLower`: nothing
    that existed changes).
  - **Small shines on the skin**: the nose's tip and bridge, the tops of the cheekbones, the cupid's bow, the chin.
    Dewy is a broad glow. Now `highlight` (*Highlighter*): a little lighter there, and a coat that catches the light.
  - All four are off (0) unless a look or a slider sets them: a character from before is as it was.
- **Five looks after the five faces** (`looks.js`; Face, Look): **porcelain berry** (the twin-tail reference),
  **red satin** and **wine doll** (the Christmas picture's two faces), **neon wing** (the neon picture), **smoky
  nude** (the T-pose reference's face). Each sets the eyes (pale grey irises, a dark limbal ring), the lips (both
  colours, the gloss, the glints, the outline a little over the lip's own edge so the upper lip is full to its
  cupid's bow), the skin's makeup (the flush high over the nose, the liners, the shadow and wash, the waterline, the
  highlighter), separate dark lashes and soft dark brows. The table of which part came from which picture is in the
  research note.
- **The brows lie on the skin now.** Worn with a look, a *straight* brow drew as a few hairs at each end. A probe in
  the page (each brow hair against the skin under it) found its middle 5 to 8 mm inside the head: a shape's Arch
  scaled the brow's whole offset from the line between its two ends, depth included, and that line runs through the
  head, the forehead being round (an *arched* brow stood off the face the same way). The arch is now applied up and
  down the face only (`browlash.js` `brow`), and the page hands the builder the skin under the brows (`browSkin`: the
  triangles within 14 mm, a ray out of the head through each point, 9 mm either way), so each hair's root, middle
  and tip, and the fill, are set on the skin before the lift. The brows by hand (groom.js) are placed their own way
  and were not touched.
- **Into Godot**: the export bakes what the skin's shader draws (`albedo.js`: the colour, and the roughness in the
  ORM), so the two-tone lip, the glints, the lower line and the highlighter's lightening and gloss are in the file's
  maps. The clear coat itself is not a map: in Godot the glints are the painted ones, and the lips' shine is their
  low roughness.
- **Tools**: `node tools/character/makeupshots.mjs --out DIR [--looks a,b] [--light studio]` pictures looks close up
  on a scratch character (the face from the front and three quarters, the eyes, the lips), `--set` laying settings
  over a look to try a value. `node tools/character/lookscheck.mjs` (LOOKS, in check_all): every look names only
  what exists (a look that named a brow colour that isn't there threw in the page when worn), every setting within
  its slider, the new parts off by default.
- **How near, and what's left** (seen in the Studio's own view under its studio light; nothing of it has been seen
  in Godot or on the user's machine):
  - The lips' two colours, their fullness and the glints' places are the pictures'. The glints are white dabs: under
    a dim lamp they dim with the lip, where a render's reflection would stay bright.
  - The references' skin is a render's (subsurface light, a soft key from the front); the Studio's view is flatter.
    The colours were read by eye through each picture's own light and grade.
  - **neon wing is the furthest off**: her wing is a centimetre long and thick; the liner's wing is a flick of 5 mm
    at most, and under glam lashes it hardly shows. A wing length of its own is not built.
  - The lids' shape is the character's (a look doesn't set it): the pictures' eyes are lifted almonds with the upper
    lid over the iris's top, ours open rounder. Face, Eyes, the *East Asian* shape preset brings them nearer.
  - The lashes are the nearest existing sets (separate, defined, round doll, glam, natural), not drawn lash by lash
    from the pictures. The brows are mostly under each picture's fringe: straight or arched, dark, guessed.
  - The eyes' size on the face is the head's (v2female's are smaller than the pictures' drawn eyes: §2f).
- **Checks**: LOOKS; GROWPAGE and STUDIO unchanged by it (the new settings default to 0).

## 3. Each stage against the rule (as of this branch)

| Stage | Sources kept | Bakes | Gaps |
|---|---|---|---|
| Body | `character.json`: base, shape, height, sculpt (the controls not at 0), `age` (the age and Young face), `cute` (Cutify and its amount), `monster` (§2d) | none (computed live) | none |
| Face | `pictures/` front and side; face settings in `character.json` | the face's fit (made live by the worker), or once baked `face.bin` (its header the receipt: when, the pictures, the settings, the body's weights; carried in the recipe) | a body changed after the bake keeps the baked offsets (nothing left to refit to) |
| Expressions | none: a preview, not saved | none | fine for now; a character's own expression set would be a source later |
| Skin: photo | the front picture; size | `skin.png`, `skin_mask.png` | no receipt: a body or face change after the skin was made leaves it silently stale |
| Skin: procedural | every slider and colour in `character.json` | none (the shader) | none |
| Skin: touch-up | `skin_paint.png`, `skin_touch.png`, `skin_pigment.png` (layers over the bake, not baked in) | none | none: they sit on the UVs, so they survive a remade `skin.png` |
| Nails | `st.nails` in `character.json` (the bare nail's sliders and shape, the polish) | none (the shader; the places on MHR's fingertips found on loading) | not in the export's texture yet (the skin's procedural look stays in the Studio) |
| Layers | `layers.json` (selections, fills, decals as data URLs) | the layer textures (made live) | big decals inside the JSON: move them to files beside it when it grows |
| Eyes | `st.eyes` in `character.json` (the paint, size, depth, opening, lid shadow, the eyelid line); the default eyelid line in `People/defaults.json` | made live | none |
| Brows and lashes | `st.lash`, `st.brow` in `character.json` | made live | not in the exports yet (the head OBJ is the skin only) |
| Brows and lashes | on, off and a colour in `character.json` | made live | none |
| Hair: salon | `salon/salon.json` (the locks, groups, look); the reference video in `Content/Studio/Hair/References/`; hairstyles to start from in `Content/Studio/Hair/` | `salon/salon.glb`, `salon_bake.json` (the head frame it was made on: a receipt already) | the Studio doesn't yet say when the head changed after the bake (the salon's note asks to bake again by hand): the first stale dot to add |
| Body for the salon | the body's weights, the face and the sculpt (above) | `body.bin` (written by Save) | none: remade on every Save |
| Clothes | each garment's design, colour and edits (fit, shape, hang), in the order worn, in `character.json`; the designs in `Content/Studio/Clothes/` | `drape.bin`: the clothes as they hang, by a key of what they were draped on (made live in a worker; a key that no longer fits hangs them again) | the export has no skin weights yet (docs/TAILOR.md §4) |
| Accessories | `st.accessories` in `character.json`: each one's kind, style, colours and sliders, its spot or the place clicked (a triangle and where in it) | none (made live) | none |
| Export for the desk and Unreal | everything above, carried inside it (the recipe: §3.1) | `export/<name>.glb`, `<name>.studio.json`, `export.made.json` (the receipt: when, the size, each source's sha1) | the GLB is neutral and **rigged on MHR's skeleton** (2026-10-26: every part skinned on it, the salon's swinging locks folded onto the body's bones); **the Studio's colours baked** (2026-10-27, `albedo.js`: the skin's every layer on MHR's UVs, each garment's fabric on islands of its own, brows and lashes as their strands' atlas in their colours; nothing comes out white); the eyes carry their paint baked flat and the eye's shape and paint, for the desk and Unreal to refract them again, the lids resting on them (a file has no stencil); the desk wears it as a cast member's body (`previs_body: "people/<name>"`) |
| Exports (OBJ) | none | `<name>_body.obj`, `<name>_head.obj`, in the character's own folder | **bakes mixed with sources**: move them to `export/` with the rest |

The fixes are small and belong in the revamp's first steps (§5): a `made.json` receipt on each bake, the body's
fingerprint in it, the clothes' lock and order saved, exports in their own folder.

### 3.1 Out to Godot and the desk, and back (DECISIONS 2026-10-24; Godot 2026-11-03, night)

**Export for Godot** (the header; it was Export for desk / Unreal) saves, writes `body.bin`, and writes
`People/<name>/export/<name>.glb` (the desk's and the Director's), then its copy for a Godot project built by hand,
`Exports/characters/<name>/<name>.glb` with a `README.txt`: MHR's 72 face shapes baked into it as blend shapes
(`tools/face_morphs.mjs`, as the Director's install does for `game/people/`; `/api/godot/<name>`, `storykit/exports.py`
`character`); in Godot an HSCharacterLook child gives it the studio's skin, eyes and hair. The export: the
character as it looks, neutral, in metres, Y up, feet on the floor, facing +Z. MHR's skin with the eyes' openings cut
out as the shader cuts them, the eyeballs, the teeth and the tongue, brows and lashes, the salon's baked hair, the clothes and the accessories.
**The skin the clothes hide is left out** (DECISIONS 2026-11-03, evening: an elbow came through a knit sleeve in a
pose): a triangle whose corners are all well inside an opaque garment's edges isn't written (`hiddenUnder`, the
skin node's extras `underClothes` its count), so a bent elbow or knee has no skin there to come through the cloth;
the skin near the edges, under see-through clothes and the feet stay (docs/TAILOR.md §3d). The Studio's own view
keeps the whole body.
**Rigged** (2026-10-26, so the desk can drive it and Unreal imports a skeletal mesh): MHR's own skeleton
(`MHR_lod1_rig.bin`'s 127 bones by MHR's names, root `body_world`), each joint where it sits in this body (refitted, as
the T-pose refits them), the eyes' joints at the eyeballs' middles; the bones unturned, the bind pose MHR's rest pose.
The skin takes MHR's own weights, the eyeballs their eye's bone (`l_eye`, `r_eye`), the upper teeth the head, the lower
teeth and the tongue the jaw, everything else (hair, brows and lashes, clothes, accessories) the weights of the skin
under it (`tailor/weights.js`). **The eyes** carry their paint baked flat in Epic's layout (the texture a plain viewer
shows), the eye's shape and paint in their material's extras (`studioEye`), each point in eye units (`_EYELOCAL`),
tangents and the flat uv: what the desk's `wearEye` and Unreal's eye material refract again (`tools/shared/eye.js`).
**The lids rest on the eyes** (2026-10-26): the Studio draws an eyeball only through its opening (a stencil), so it can
stand proud of MHR's lids (up to 3 to 4 mm at the lower lid); a file has only depth, so the export brings the skin round
each opening forward onto the eyeball's surface (0.3 mm over it, the cornea's dome too, a triangle's flat middle too;
lifted at MHR's own points and blended into the cut's new corners, so its edges stay closed; the shading as it was)
and keeps the eyeball a whole sphere. The cut follows the outline's own edges (the last pieces of a split triangle cut
along it), and the skin's node carries **each opening's outline** as cut, on the lids as they rest
(`extras.openings.L`/`R`, 32 points in the file's space), for a reader that follows the lid line. The outline itself
is untangled in the Studio too: smoothed, MHR's own left inner corner crossed itself and the little loop showed a
diamond of eyeball at every character's corner (`untangle`, pulled to the crossing). STUDIO draws the file's skin and
eyes flat from the front, above, below and 20° to either side: none of an eyeball outside its opening.
**The blink in the file** (2026-10-31, GODOT_LOOK §5f): MHR's `eyesClosed_L` and `eyesClosed_R` as morph targets on the
skin (with their normals), the lashes, the lash line, the brows and the tear line, each eye's way down kept at eight
in-between weights (`eyesClosed_L_in1250` ... `_in9375`) so the lid follows its curve over the cornea, the lids kept off
the eyeball in every state and, shut, the cut's edges met (MHR's shut lids leave 15 to 20% of the opening); written
sparse (`sparseTargets`). Godot's HSBlink plays it (an idle blink, a scene's face); EYELIDS measures it. What lies on the
lids (the lashes, the lash line, the tear line, the brows) comes forward with them (`liftWith`); **the tear line** goes
into the file (`tearline_L`/`_R`, its fade in the vertices' colour, `studioTear`; see-through in a plain viewer), drawn as a wet glint in Godot.

**The colours are baked** (2026-10-27, DECISIONS: the user's character stood white on the desk). glTF carries a
material's colour and its maps, never a shader, and the Studio draws its colours in shaders: the procedural skin
(`skinshader.js`: the tone, the mottling, the makeup, the lipstick, the nails, the photo through its mask, the touch-up
and the layers), the tailor's fabric (`tailor/look.js`: the colour, the weave, a pattern, a print, a PBR set's colour)
and the hair shader of the brows and lashes. Exported as they were, the skin and the clothes came out white and the
lashes without a material. `albedo.js` draws each material's own shader flat into its mesh's UV layout (the vertices at
their UVs, every layer computed as in the view) and reads back the colour it reaches **before the light**: what the
light does (the coat and the dewy glow, the pores' relief, the glow through the skin, a fabric's sheen) is left to
whatever draws the file. The empty texels round each island take its edge, eight rings out, so a filtered read doesn't
pull in black; the rest the islands' mean.
- **The skin:** 4096 px on MHR's own UVs (the face takes about a quarter of the width), a JPEG in the file. **And how
  it's lit** (2026-10-28, back: the skin light, below): its relief (the pores, the wrinkles, a nail's edge) as a
  tangent-space normal map in glTF's convention (+X along u, +Y up the picture), and one map of R the ambient
  occlusion (2026-10-30, night: `bakeOcclusion`, how much of the sky each point sees, from depth maps of the body
  from 64 directions and of the head again finer; also the glb's occlusionTexture), G the roughness (the oil, the
  lips' gloss, the nails' polish) and B how thin the skin is (the file's metalness is 0, so its blue is free), 2048 px
  PNGs; the light's numbers in the skin material's `extras.studioSkin`, with the procedural skin's `age`, `pores`,
  `poreSize`, `evenness` and `wrinkles` (Godot's detail layer picks its look from them: GODOT_LOOK §5d). The pores
  are left out of the file's maps (their colour and relief: a 0.35 mm texel only blurred them): Godot draws them at
  their true size, as deep and as far apart as the record's Pores and Pore spacing say.
- **The hair** (2026-10-31, GODOT_LOOK §5e): the salon's bake goes through as it is (its shell normals, strand tangents,
  second UV and strand numbers; a swinging lock's normals and tangents turned onto the body's skeleton, no longer
  recomputed); the **brows and lashes** are named in the file (`brows`, `lashes`, `lash_line`, `brow_fill`) and carry
  their strands' numbers in the occlusion slot and a `studioHair` record beside their look. The desk
  lights the file's skin with the same `skinlight.js` (`bodies.js`, the thinness from the map's blue); Unreal makes
  **M_StudioSkin** (`storykit/people.py`, Subsurface Profile, written blind: UNREAL_FLOW §1d).

**The skin light** (2026-10-28, back, the user: "something like the skin shader in this godot repo",
github.com/matmadness/HumanShaders, MIT): `tools/shared/skinlight.js` replaces three's direct light on the skin (the
Studio's and an export's on the desk) with HumanShaders' way of lighting skin, rebuilt in three.js (none of its textures
or scans): each colour through a normal smoothed by a different amount toward the surface's own (red the most: red
light travels furthest under the skin), each wrapped past the terminator by a smoothstep, so a shadow's edge is soft and
warm instead of grey; the light coming through the thin parts toward the eye (ears, nostrils, fingers, lips) through a
ramp from dark red to orange, as thin as `thin.js` finds the body (a ray from each point straight in to where it comes
out again, a grid of the triangles keeping it to a fraction of a second; 0 thick, 1 thin, averaged once with the
neighbours); two GGX highlights, the second broader, from Specular's f0 (0.04 × s²). The environment's light, the
clear coat (the oil, glass skin) and the shadows stay three's. Skin, **Light on the skin**: Skin light (on by default;
off is three's plain light, to compare), Smoothness, Falloff, Wrap, Specular, Second highlight, Translucency; with it on,
the procedural skin's emissive glow through the skin is off (the light does it now). STUDIO measures the thin parts
(the ears' rims and the fingers thin, the cheeks and the torso thick), the shadow's edge under one side light (where
the light fades into the dark, 2 to 12% of the brightest: wider than three's, the light reaching past the terminator and
fading in slowly, an S-curve, and warmer), the ear's rim red against a lamp behind the head and the cheek not, and the
export's maps (a relief that bends the normal, the look's own roughness, thin pixels, the light's numbers).
- **Each garment part:** its fabric coordinates (metres round each part, `tailor/uv.js`) packed as one island per part
  at about 2 mm a pixel (64 to 2048 px), the new layout its `uv` (TEXCOORD_0) and the metres kept as `uv1`
  (TEXCOORD_1), where a PBR set's normal, roughness, metalness and AO maps still tile by their real size; the per-vertex
  edge shade stays its vertex colour. Sheer and net fabrics keep their alpha (PNG); the weave's relief isn't carried.
- **Brows and lashes:** their strand atlas in their look's colours (`hairtex.js`'s `albedo`, as the salon's bake), cut
  out at 0.3.

STUDIO wears the anime pink look and a t-shirt and skirt, exports, and reads the file back: the skin's texture in its
colour with the makeup in it, every plain garment part within 15% of its colour, the lashes dark strands.
**In Unreal** (UNREAL_FLOW §1d): `storykit.people` imports the GLB as one skeletal mesh and gives each eye
M_StudioEye, the same eye as a material made from text, its numbers from `studioEye`; Generate does it for every cast
member whose `previs_body` is the character, the preview posing it from the desk's bake.
The GLB's scene carries **the recipe** in its extras (`extras.studio`, the server's `api/recipe/<name>`): every file
the character is made from (`character.json`, `layers.json`, the skin's pictures and paint, `body.bin`, the front and
side pictures, the salon's `salon/*.json` and bakes), base64, each with its sha1. `<name>.studio.json` beside it is the
same recipe on its own, and `export.made.json` the receipt.

**Import…** takes either file back (`api/import/<name>`, asking for a name; an existing one is never written over
unless asked) and opens it: every setting, picture, paint stroke and hairstyle as it was exported, so a character that
went to the desk or to Unreal comes back to be changed, never remade. What the recipe doesn't carry is what's shared
by name: the clothes' designs (`Content/Studio/Clothes/`), PBR sets from the shelf (`assets/pbr/`), the salon's
reference videos and hairstyles. STUDIO exports the test character, checks the GLB (its size, the openings cut, the
recipe) and imports it back as `_studiotest_back`: the same files, the same settings.

## 4. The revamp: one app, a bar of stages at the top

**The shape.** One page, one server (8793), one character open at a time. Across the top:

```
[ character ▾ ]  Body · Face · Expressions · Skin · Paint · Hair · Clothes · Motion · Look · Export   [ ● saved ]
```

- **Stages, left to right, in the order a character is made**, but any can be opened at any time. Each shows its state
  as a dot: empty, done, stale (a source it depends on changed: §2), or working (a bake running).
- **Inside a stage, its steps** as a second, smaller row (Skin: Photo · Procedural · Touch-up · Eyes; Hair: the salon's
  fourteen; Clothes: Garments · Outfits; Look: Studio · POV). The side panel holds that step's controls only;
  the 3D view is shared and stays put while you swap.
- **The address follows the bar** (`/#/skin/touch-up`), so a reload, the launcher and the back button land where you
  were, and the launcher has one entry: "Character Studio".
- **One save** for the whole character (the button and Ctrl+S), with a dot per stage that has unsaved changes, and
  bakes that run in the background with their progress in the stage's dot.
- **Keys:** 1 to 9 the stages, Tab the steps, Alt-drag always turns the view (painting tools take the plain drag).

**The steps look like the salon's** (the UI the salon's branch settled): in each stage the side panel is the work
in order, numbered steps, each a dropdown closed until opened (the open ones remembered), each with a one-line hint
of what it's for or what it's on now. The salon already is that; the other stages are rebuilt the same way as they
move into the shell.

**What moves in from the desk:**

| Page today | Becomes |
|---|---|
| `face.html` (photos to a head, MetaHuman route) | Face, a "MetaHuman head" step (the OBJ for Mesh to MetaHuman), for the optional hero-face branch |
| `shape.html` | gone: Body does it on MHR |
| `bodies.html` (a body against every pose) | Motion, a "Poses" step: the character run through the pose library |
| `poses.html` | stays on the desk (it's for blocking); Motion reads the same library |
| `flesh.html` (soft bones, jiggle) | Body, a "Flesh" step: the jiggle regions and sliders on this character |
| `pigment.html` | gone: its brushes are in the touch-up (Paint) |
| `pbr.html` (the shelf) | stays on the desk; Paint's fill picker reads the same shelf |
| Kimodo motions (later) | Motion, a "Clips" step: the shot list's motions played on the character |
| `salon.html` | **Hair**: done first (2026-10-23), the salon framed in the Hair tab; the old styles, the Perm library and the model wig were removed |

**How it's built** (so the move is safe): each stage becomes its own module (`stages/body.js`, `stages/skin.js`...)
with `mount(panel)`, `unmount()`, `status()` and its part of the save, around a small shell (`app.js`: the bar, the
router, the save, the shared scene, the character). Today's tabs are already most of the way there: the first step only
wraps them, and STUDIO keeps passing at every step because the controls keep their ids.

## 5. The order to build it

Each a commit, STUDIO ok at each:

1. **The shell:** the top bar, the second row, the router and the one save around today's tabs, unchanged inside.
2. **Receipts and the stale dots:** `made.json` on `skin.png`, garments and the hair batch; the body's fingerprint;
   clothes keep their lock and order. A stale bake shows; one button remakes it.
3. **Export as a stage:** everything to `export/` with one receipt (the OBJs, the salon's bake, the textures), ready for
   Unreal; the character's folder keeps only sources and live bakes. (A first cut done 2026-10-24: the GLB with its
   recipe and Import, §3.1; the OBJs still land beside the sources.)
4. **The salon moves in** as the Hair stage (a first cut done 2026-10-23: the page framed in the tab, the character
   fixed by the tab; still its own save), then
   **Flesh** (Body, Flesh), then **Poses** (Motion), then **the MetaHuman head** (Face). `shape.html` and
   `pigment.html` retire once nothing links to them; the launcher drops their lines.
5. **Look:** the studio view and the POV in one stage, the lights side by side as a contact sheet of the character.
6. **Motion: Kimodo's clips** on the character (last, with the move to Unreal, as decided).

Open for the user: whether Expressions should save a character's own expressions (a source); whether the stage order
above is the one you work in; whether the desk keeps `poses.html` and `pbr.html` or those move too.

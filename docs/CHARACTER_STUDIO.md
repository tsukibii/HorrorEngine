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
| Body | MHR: a base (feminine to masculine: slim and young after the user's references, 2026-10-26, the body between the two bases, new characters halfway, the heads kept as they were; a base carries a sculpt, the feminine one's flat stomach), 45 identity sliders, a height; the **sculpt** (2026-10-23): 30 named controls MHR's shapes don't give (Forehead: height, width, slope, brow ridge, temples; Face: hooded lids, cheekbones, cheeks, jaw width, chin length, width and forward, nose size and projection, nose length, tip, width and bridge, mouth width, lips; Body: neck, shoulders, chest, waist, **belly**, hips, upper arms, forearms, thighs, calves; the belly 2026-10-25: MHR's average stomach stands 3 cm proud of a straight line from the pubic bone to the lower ribs and its identity shapes take back only 1 cm of it, so Belly at -1 takes it back to that line (bowed 4 mm: a flat stomach, not a board), a smooth field whole across the middle 12 cm and easing out by the flanks, +1 rounder; **hooded lids** 2026-10-26, after the second lash reference's old man: the skin between the lid's crease and the brow comes down over the upper lid and a little forward, most at the outer corner and on past it, nothing within 2.8 mm of the line the eye is cut along moving (the sculpt is built with the model's own lid line: MediaPipe's ring sits 2 mm below it), so the opening, the lid's rim and the lashes' roots stay; the height over the line measured from an envelope that never falls faster than 0.6 (so the field changes slowly round the corners) and the drop's slope kept under 0.85, so the skin gathers into a fold and never turns over itself (STUDIO counts the triangles turned over at 1 and -1: none; the opening moves 0.000 mm), -1 lifting the crease instead; **the nose's size and projection** 2026-10-28, the user: no way to make a small nose, everything dragged low still left a fat nose standing out in profile (MHR's average nose has its alae 37 mm across and stands 16 mm out of the line from its root to the subnasale; the tip's and the bridge's controls move a spot each, the tip 5 mm, and leave the rest standing): the nose as a height over the face under it (that line down the middle, falling across to the skin at the nose's border), **Nose size** -1 its width 30% in (the alar crease too, the cheek beside it eased along over 16 mm: a nose narrowed alone would stand on its old, wide foot) and its height 35% down, **Nose projection** -1 its height halved, a circle each (the nose's side, its bridge's middle); nothing within 6 mm of the eye's inner corner moves, STUDIO checks the lids' lines, the eyes' corners and the lips stay put and no skin turns over), each a smooth offset field over MHR's base body, mirrored (the face's placed by MediaPipe's points on it, each pair averaged across the middle; the limbs' by their cross-sections), -1 to 1, added after a photo's fit (so a picture never undoes it) and before the expressions (a blink still shuts); **circles on the body** (the Body view shows the body's, the Head view the face's, both sides of each): a circle dragged moves its sliders as far as follows the pointer (120 px a whole slider; what moves towards you from this view stays, a chest seen from the front goes up for more), its rows green while it's held | `index.html`, `sculpt.js`, `mhr.py`, `MHR_lod1.bin` |
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

The user, after TAU's (docs/TAU_HAIR.md): "The texture of the procedural eye lashes looks really good but the design you
generated is very bad, they move up too upwards" (TAU's Straight preset stands its lashes at 70 to 80° off the lid line,
and our tidy turned them up further to keep them off the eye), with four references (a brow, an eye at three-quarter, an
eye from the front, a MetaHuman head without its hair); then "could you make an easy eyebrow editor tool where I manually
can add and adjust the eyebrows and eyelashes inside an easy wrapper?" Built: **Face, Brows & lashes by hand**
(`tools/character/groom.js`, the editor in `index.html`).

- **Use them** puts them in place of the brows and lashes below and TAU's; **Mirror** does each change on both sides.
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
  TAU's thickness (0.055 mm at the root) as TAU's strands are drawn (`strandCards`: one fine hair to a card): a brow's
  hairs lying on the skin across its band (the band laid on the skin as a grid: each hair a curve in it, following the
  flow: up at the front, swept out along the body, out and down at the tail, the top and bottom rows leaning in; fewer at
  its soft edges and its front); an upper lash from the lid's edge over its rim, forward, easing up into its curl and
  swept toward the temple more the further out it grows (the inner ones a touch toward the nose), turned with the lid as
  it shuts; the lower lashes few, fine, uneven, down and out. Measured (GROOM): the middle lashes rise 2.4 mm over the
  lid at 23° from straight out (it was 3.7 mm at 36° before the defaults were tuned on the references; TAU's Straight
  stood up), the outer ones swept 45° out; the brows' hairs within 0.33 mm of the skin.
- **Start from TAU's brows** (the user's next look, the same night: "the actual TAU plugin makes way better eyebrows
  than we do", and "use the default .blend eyebrow as starter (which is placed correctly) and modify based off that"):
  a TAU preset beside the brows' styles grows TAU's brows on the character if they aren't there yet (Blender, a few
  minutes: docs/TAU_HAIR.md), then its hair becomes the brows to shape. The band is laid on **TAU's own brow as it grew**
  (`tauFit`: its head and tail at the 2nd and 98th percentile of its roots along the brow rows' band, each station's top
  and bottom at the 95th and 5th percentile of the roots near it), so the handles start on its outline (about 91% of its
  roots inside it), not on MediaPipe's rows, which sit higher on most faces; each hair moves with the band where its root
  lies (past the edges, with the edge), the brushes thin, double and comb it, Hairs, Length, Thickness and Messy change
  it; its flow stays TAU's. **Back to the made ones** brings the brows grown here back as they were shaped: each source
  keeps its own handles and brushing (`brow.kept`), switching never loses them.
- **The lash line** (a slider under the lashes): the dark line along the lid where the lashes grow, a thin line at 0.2
  (the default), an eyeliner's at 1; the upper lashes grow along the whole lid, its inner corner to its outer one (they
  stopped short of both ends before the user's note: "the upper eyelashes don't reach out the entire eyelid line").
- **Saved** with the character (`st.groom`: the shape's offsets in mm, the brushing as two small grids, the lash
  handles, the sliders, the brows' source and the other source's kept hand work); the export carries them as any brows
  and lashes (their blink, lifted with the lids: §3.1).
- **GROOM** (`node tools/character/groomtest.mjs`, the Studio's server running): the edit mode and its 26 handles, the
  brows' hair count and their lying on the skin, the lashes' rise, angle and sweep, a brow handle dragged (and its twin),
  a lash handle dragged up, Thin out and Add hair, TAU's brows started from (most of their roots inside the handles'
  outline, a handle dragged moving the hairs under it; back to the made ones as they were), a style, the blink, saved
  and opened again the same, Done.

The sheet: `docs/godot_sheets/2026-10-31_brows_lashes_by_hand.jpg` (the editor, then the result in Godot open, at
three-quarter and shut).

## 3. Each stage against the rule (as of this branch)

| Stage | Sources kept | Bakes | Gaps |
|---|---|---|---|
| Body | `character.json`: base, shape, height, sculpt (the controls not at 0) | none (computed live) | none |
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

### 3.1 Out to the desk and Unreal, and back (DECISIONS 2026-10-24)

**Export for desk / Unreal** (the header) saves, writes `body.bin`, and writes `People/<name>/export/<name>.glb`: the
character as it looks, neutral, in metres, Y up, feet on the floor, facing +Z. MHR's skin with the eyes' openings cut
out as the shader cuts them, the eyeballs, the teeth and the tongue, brows and lashes, the salon's baked hair, the clothes and the accessories.
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
**TAU's brows and lashes** (docs/TAU_HAIR.md): Face, TAU (baked in Blender), **Bake with TAU** exports, grows them with
TAU's pack in Blender, wears them and exports again.

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

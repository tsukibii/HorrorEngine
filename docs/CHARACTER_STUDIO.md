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
| Body | MHR: a base (feminine to masculine), 45 identity sliders, a height; the **sculpt** (2026-10-23): 26 named controls MHR's shapes don't give (Forehead: height, width, slope, brow ridge, temples; Face: cheekbones, cheeks, jaw width, chin length, width and forward, nose length, tip, width and bridge, mouth width, lips; Body: neck, shoulders, chest, waist, hips, upper arms, forearms, thighs, calves), each a smooth offset field over MHR's base body, mirrored (the face's placed by MediaPipe's points on it, each pair averaged across the middle; the limbs' by their cross-sections), -1 to 1, added after a photo's fit (so a picture never undoes it) and before the expressions (a blink still shuts); **circles on the body** (the Body view shows the body's, the Head view the face's, both sides of each): a circle dragged moves its sliders as far as follows the pointer (120 px a whole slider; what moves towards you from this view stays, a chest seen from the front goes up for more), its rows green while it's held | `index.html`, `sculpt.js`, `mhr.py`, `MHR_lod1.bin` |
| Face | front and side pictures bend the head (MediaPipe's landmarks); **brows and lashes** on the salon's hair shader: lashes on the lids' edges that turn with the lid and squash as it shuts, brows as fine hairs flat on the skin with a fill, shapes and looks (off until asked for); **teeth and a tongue** (2026-10-24; MHR has none): an adult's average arches, sized to the neutral mouth's width and set behind the lips, wet (a clear coat), the biting edges translucent blue-grey, darker gaps, dimmer when the mouth is barely open, the upper with the skull, the lower and the tongue on the jaw (a rigid motion fitted once to each of MHR's jaw shapes, so lip shapes never move them); the opening is cut out of the skin along the mouth's own lip line (the seal's points, the upper lip's lowest edge and the lower's highest, corner to corner, smoothed: no wedges at the corners, no jagged edge), with a dark bag behind it marking the stencil, so the mouth shows only through the opening and never through the lips or cheeks; a pucker and a funnel together are limited (past 1.1 between them the funnel gives way: MHR folds the lower lip out over itself); the opening counts from the mouth at rest (MHR's lips overlap there); the **lower lip's curl** (Mouth, 0.5 by default) rolls the top of the lower lip down into the mouth, as a real lip curls: MHR's runs straight up to a hard edge and, at rest, a millimetre up inside the upper lip; **whole looks** (`looks.js`, Face, Look): the eyes, the lips, the teeth and the skin set together, new characters starting from "soft cinematic" (after the user's reference, docs/research/look_reference.md), "MHR plain" taking it off; **lipstick** (`lips.js`): painted by the skin's shader inside the lips' outline (MediaPipe's outer lip ring, riding the face), over the photo skin or the procedural one, soft at its border, a gradient, gloss, lip lines; Show the guide draws the outline, shaped by five sliders (shade, size, forward, up; Open the mouth) | `teeth.js`, `face_mesh.py` (worker), `browlash.js` |
| Expressions | MHR's 72 shapes, presets written as ARKit-52 curves (the mocap's map) | `arkit_mhr.json` |
| Skin | tone; the **photo skin** (the front picture projected onto MHR's UVs: `skin.py`, `skin.png` + `skin_mask.png`); the **procedural skin** (`skinshader.js`: noise layers, glass, oil, age, makeup, presets); the **touch-up** (`touchup.js`: paint, take the photo away, bring it back, soften, undo; pigment brushes); eyes (`eyes.js`): the shell **cut out** in the skin's shader along the model's own lid line (found once, on MHR's own face, from what its blink squeezes shut; a photo's fit carries it, and its blink still meets), an eyeball behind each opening drawn only through it and over what's inside (always full, any pose), fitted to the opening and grown back from its pupil, a blink shuts it, the lids' shadow, catchlights fixed to the light (size, depth, opening, lid shadow, pupil size); the iris's edge melting into the white (Iris edge softness), an eye occlusion all round the opening, a tear line along each lower lid (faded at its edges and corners, so it glints and never draws a hard white line); the openings' edges (eyes and mouth) faded over a pixel, alpha to coverage, not cut with stair-steps | |
| Layers | paint layers above the base: select by vertex, fill with colour, decal, PBR set or texture, opacity, shine, relief (docs/LAYERS.md) | `layers.js`, `layersui.js` |
| Hair | **the salon** (DECISIONS 2026-10-22, 2026-10-23): the tab opens `salon.html` inside the Studio (`?embed=1&person=NAME`) on this character's own body and face (the tab posts `body.bin` first); locks drawn by hand against a reference video locked to the view; fourteen numbered steps, each a dropdown closed until opened; a new character starts bald; Bake writes `salon/salon.glb` and `salon_bake.json`, which the Studio wears on the head when you leave the tab (docs/SALON.md). Brows and lashes (`hair.js`) switch in the Face tab | `salon.html`, `salon.js`, `salonlib.js`, ... |
| Clothes | the tailor: designs cut from this body (a membrane relaxed off the skin, skirts as rings, details lifted off), outfits worn in layers, refit when the body changes, fabrics after Woohill's surfaces (fishnet and sheer tights among them), patterns and prints, jackets, shoes and socks, shaped by handles in the view and sliders, exported as OBJ (docs/TAILOR.md) | `tailor.js`, `tailor/` |
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

## 3. Each stage against the rule (as of this branch)

| Stage | Sources kept | Bakes | Gaps |
|---|---|---|---|
| Body | `character.json`: base, shape, height, sculpt (the controls not at 0) | none (computed live) | none |
| Face | `pictures/` front and side; face settings in `character.json` | the face's fit (made live by the worker) | none |
| Expressions | none: a preview, not saved | none | fine for now; a character's own expression set would be a source later |
| Skin: photo | the front picture; size | `skin.png`, `skin_mask.png` | no receipt: a body or face change after the skin was made leaves it silently stale |
| Skin: procedural | every slider and colour in `character.json` | none (the shader) | none |
| Skin: touch-up | `skin_paint.png`, `skin_touch.png`, `skin_pigment.png` (layers over the bake, not baked in) | none | none: they sit on the UVs, so they survive a remade `skin.png` |
| Layers | `layers.json` (selections, fills, decals as data URLs) | the layer textures (made live) | big decals inside the JSON: move them to files beside it when it grows |
| Eyes | `st.eyes` in `character.json` (the paint, size, depth, opening, lid shadow, the eyelid line); the default eyelid line in `People/defaults.json` | made live | none |
| Brows and lashes | `st.lash`, `st.brow` in `character.json` | made live | not in the exports yet (the head OBJ is the skin only) |
| Brows and lashes | on, off and a colour in `character.json` | made live | none |
| Hair: salon | `salon/salon.json` (the locks, groups, look); the reference video in `Content/Studio/Hair/References/`; hairstyles to start from in `Content/Studio/Hair/` | `salon/salon.glb`, `salon_bake.json` (the head frame it was made on: a receipt already) | the Studio doesn't yet say when the head changed after the bake (the salon's note asks to bake again by hand): the first stale dot to add |
| Body for the salon | the body's weights, the face and the sculpt (above) | `body.bin` (written by Save) | none: remade on every Save |
| Clothes | each garment's design and colour, in the order worn, in `character.json`; the designs in `Content/Studio/Clothes/` | none (made live in a worker) | the export has no skin weights or UVs yet (docs/TAILOR.md §4) |
| Accessories | `st.accessories` in `character.json`: each one's kind, style, colours and sliders, its spot or the place clicked (a triangle and where in it) | none (made live) | none |
| Export for the desk and Unreal | everything above, carried inside it (the recipe: §3.1) | `export/<name>.glb`, `<name>.studio.json`, `export.made.json` (the receipt: when, the size, each source's sha1) | the GLB is neutral and unrigged, the procedural skin and the eyes' shaders come out as plain materials; the clothes have no skin weights yet (docs/TAILOR.md §4) |
| Exports (OBJ) | none | `<name>_body.obj`, `<name>_head.obj`, in the character's own folder | **bakes mixed with sources**: move them to `export/` with the rest |

The fixes are small and belong in the revamp's first steps (§5): a `made.json` receipt on each bake, the body's
fingerprint in it, the clothes' lock and order saved, exports in their own folder.

### 3.1 Out to the desk and Unreal, and back (DECISIONS 2026-10-24)

**Export for desk / Unreal** (the header) saves, writes `body.bin`, and writes `People/<name>/export/<name>.glb`: the
character as it looks, neutral, in metres, Y up, feet on the floor, facing +Z. MHR's skin with the eyes' openings cut
out as the shader cuts them (its texture the photo skin; the procedural skin is the Studio's shader, Unreal has its
own), the eyeballs, the teeth and the tongue, brows and lashes, the salon's baked hair, the clothes and the accessories.
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

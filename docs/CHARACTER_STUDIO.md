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
| Body | MHR: a base (feminine to masculine), 45 identity sliders, a height | `index.html`, `mhr.py`, `MHR_lod1.bin` |
| Face | front and side pictures bend the head (MediaPipe's landmarks) | `face_mesh.py` (worker) |
| Expressions | MHR's 72 shapes, presets written as ARKit-52 curves (the mocap's map) | `arkit_mhr.json` |
| Skin | tone; the **photo skin** (the front picture projected onto MHR's UVs: `skin.py`, `skin.png` + `skin_mask.png`); the **procedural skin** (`skinshader.js`: noise layers, glass, oil, age, makeup, presets); the **touch-up** (`touchup.js`: paint, take the photo away, bring it back, soften, undo; pigment brushes); eyes (`eyes.js`) | |
| Layers | paint layers above the base: select by vertex, fill with colour, decal, PBR set or texture, opacity, shine, relief (docs/LAYERS.md) | `layers.js`, `layersui.js` |
| Hair | **the salon** (DECISIONS 2026-10-22, 2026-10-23): the tab opens `salon.html` inside the Studio (`?embed=1&person=NAME`) on this character's own body and face (the tab posts `body.bin` first); locks drawn by hand against a reference video locked to the view; fourteen numbered steps, each a dropdown closed until opened; a new character starts bald; Bake writes `salon/salon.glb` and `salon_bake.json`, which the Studio wears on the head when you leave the tab (docs/SALON.md). Brows and lashes (`hair.js`) switch in the Face tab | `salon.html`, `salon.js`, `salonlib.js`, ... |
| Clothes | GarmentCode designs draped with Blender's cloth (`clothes.py`, `drape.py`), lock points, presets and outfits worn in layers (`make_designs.py`) | |
| View | the studio view (`tools/shared/studioview.js`); POV from the player's eye at MCU or MS through the game's 90° lens in 16:9, under studio, warm lamp, cold night and flashlight | |

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
| Body | `character.json`: base, shape, height | none (computed live) | none |
| Face | `pictures/` front and side; face settings in `character.json` | the face's fit (made live by the worker) | none |
| Expressions | none: a preview, not saved | none | fine for now; a character's own expression set would be a source later |
| Skin: photo | the front picture; size | `skin.png`, `skin_mask.png` | no receipt: a body or face change after the skin was made leaves it silently stale |
| Skin: procedural | every slider and colour in `character.json` | none (the shader) | none |
| Skin: touch-up | `skin_paint.png`, `skin_touch.png`, `skin_pigment.png` (layers over the bake, not baked in) | none | none: they sit on the UVs, so they survive a remade `skin.png` |
| Layers | `layers.json` (selections, fills, decals as data URLs) | the layer textures (made live) | big decals inside the JSON: move them to files beside it when it grows |
| Eyes | `st.eyes` in `character.json` | made live | none |
| Brows and lashes | on, off and a colour in `character.json` | made live | none |
| Hair: salon | `salon/salon.json` (the locks, groups, look); the reference video in `Content/Studio/Hair/References/`; hairstyles to start from in `Content/Studio/Hair/` | `salon/salon.glb`, `salon_bake.json` (the head frame it was made on: a receipt already) | the Studio doesn't yet say when the head changed after the bake (the salon's note asks to bake again by hand): the first stale dot to add |
| Body for the salon | the body's weights and the face (above) | `body.bin` (written by Save) | none: remade on every Save |
| Clothes | each garment's design and colour; `design.yaml`, `body.yaml` beside the drape | `garment.obj` | **the lock choice and what it was draped over aren't saved** (an outfit remade alone would drape differently); no receipt |
| Exports | none | `<name>_body.obj`, `<name>_head.obj`, in the character's own folder | **bakes mixed with sources**: move them to `export/` with one receipt for the whole export |

The fixes are small and belong in the revamp's first steps (§5): a `made.json` receipt on each bake, the body's
fingerprint in it, the clothes' lock and order saved, exports in their own folder.

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
   Unreal; the character's folder keeps only sources and live bakes.
4. **The salon moves in** as the Hair stage (a first cut done 2026-10-23: the page framed in the tab, the character
   fixed by the tab; still its own save), then
   **Flesh** (Body, Flesh), then **Poses** (Motion), then **the MetaHuman head** (Face). `shape.html` and
   `pigment.html` retire once nothing links to them; the launcher drops their lines.
5. **Look:** the studio view and the POV in one stage, the lights side by side as a contact sheet of the character.
6. **Motion: Kimodo's clips** on the character (last, with the move to Unreal, as decided).

Open for the user: whether Expressions should save a character's own expressions (a source); whether the stage order
above is the one you work in; whether the desk keeps `poses.html` and `pbr.html` or those move too.

# TAU's brows and lashes on a Character Studio character

DECISIONS 2026-10-31 (later): the user, after we found nobody had MetaHuman-like brows and lashes procedurally and
ours (browlash.js, cards from Blender-like hair) didn't look natural: "I'd be happy to use TAU's Procedural Human Hair
and bake it onto the model before exporting to Godot if you can figure out how to get it to work." It works.

## 1. What TAU's pack is, and the licence

[TAU's Procedural Human Hair](https://creamtau.itch.io/procedural-human-hair) (by TAU, **CC BY-SA 4.0**): one .blend of
Blender 4.0 Geometry Nodes generators that grow eyebrows and eyelashes hair by hair (tapered strands a few hundredths of a
millimetre thick, flow, curl, clumping, noise), five presets each (brows Natural, Bushy, Feather, Fluffy, Laminated;
lashes Straight, Clumped, Fox, Manga, Volume).

- **The .blend stays out of git.** The user downloads it and puts it at `vendor/tau/procedural_human_hair.blend`
  (`vendor/tau/` is git-ignored; 105 MB, it came in through a branch of its own, `tau-transfer`, in two parts).
- **Credit TAU** wherever the brows and lashes show (the Studio's TAU section says it; a game's credits should too).
- **Share-alike**: hair TAU grows is a work made with its CC BY-SA generators. Keep the strands (`People/<name>/tau/`)
  and the exports that carry them in the user's own projects; a game that ships them ships them under CC BY-SA's terms
  for that part (credit, the licence named). Ask before putting them anywhere shared.

## 2. The way through

`python tools/tau_hair.py make --person NAME [--brows Natural] [--lashes Straight] [--preview]` (the Studio's **Bake with
TAU** button runs it: Face, TAU (baked in Blender)):

1. **The surface is the character's export** (`People/NAME/export/NAME.glb`): the skin welded into one mesh with its UVs
   and baked colours, the eyeballs; Blender's module runs TAU's .blend headless (`vendor/blender/.venv`, made by
   `python tools/retarget.py setup`).
2. **Fed as TAU's own body is**: the brows' density group, TAU's UV layout (so its brow mask applies) and its six face
   measurements (inner and outer eyebrow distance, lower and upper eyebrow height, inner and outer eye distance) carried
   from TAU's body laid over ours by the eyeballs; a **lid margin strip** along each opening's outline as cut (the
   export's extras), facing forward and down above the eye and forward and up below as TAU's do (TAU sorts a lash upper
   or lower by its root's surface normal), the lashes' density group on it.
3. **TAU grows them** (`hide_render` off on the presets, the modifiers evaluated), the strands read out in the file's frame.
4. **Tidied** (`tidy_lashes`): TAU grew some lashes a third of a millimetre long (a dot on the lid): none under 1.2 mm;
   each lash clear of the opening seen from the front past its first fifth (an upper lash turned up about the lid's line
   at its root as little as clears it, a lower one down, and 30 degrees under the forward way at least: TAU's came out
   toward the viewer, dots again; one that 40 degrees doesn't clear is left out); the lower lashes thinned to 45% and
   shortened to 70% (MetaHuman's lower lashes are a soft fringe; TAU's were a second row as dark as the upper).
5. **Unlifted** (`unlift`): the export brings the lids forward onto the eyeballs (up to 4 mm, `lidsRest`) and the
   Studio's face doesn't; each strand is moved back whole by the lift under its root (from `People/NAME/body.bin`, the
   Studio's own face), so it's pinned with its own shape. (Pinned to the lifted lids, the strands came back on the
   Studio's face turned by their triangles' tilt, across the eye.)
6. **Pinned** (`pin`): each strand to the MHR triangle nearest its root (lashes never to one inside an opening: it
   squeezes shut in a blink), its points as offsets in the triangle's frame (x along its first edge, z its normal, each
   axis the triangle's size long, so a strand follows the face's scale and its stretch), its radius per point;
   `People/NAME/tau/strands.json`, the export's recipe carries it (`tau/*.json`).
7. **The Studio wears them** (`tools/character/tau.js` `strandsNow`, `browlash.js` `strandCards`): rebuilt on the face as it
   is (the sliders, the sculpt, the photo's fit, the expressions and the blink), a lash two crossed cards, a brow hair one
   card flat on the skin, each one hair of the lashes' atlas wide as TAU's root; Face, TAU's lashes and TAU's brows
   switch them on. Saved with the character (`st.lash.tau`, `st.brow.tau`, the presets).
8. **The export** carries them as the brows and lashes always went (`brows`, `lashes`, their records), lifted with the
   lids (`liftWith`) and blinking (`eyesClosed_L`/`_R` and their in-betweens: GODOT_LOOK §5f); Godot's HSHair draws
   them as fine hairs (`hair_fine.gdshader`: blended coverage, a lash a pixel wide never dithers away).

Measured on the two test characters (2026-10-31): Natural brows 587 to 629 strands, 5.5 to 5.7 mm; Straight lashes 414
to 428 after the tidy (58 stubs left out, 93 turned clear on `_skintest`), 5.3 to 5.5 mm; none crossing the opening.

## 3. The check

`python tools/tau_hair.py check` (TAUHAIR): a strand pinned to a triangle's frame comes back within a micron, rides the
triangle when it turns, comes back 6.7% larger in a space 6.7% larger; with Blender's module, TAU's .blend and an export
(`_studiotest`, else `_skintest`), a whole make measured (brows 300 to 1500 strands, 3.5 to 8 mm; lashes 250 to 1200, 3 to
7 mm). EYELIDS (GODOT_LOOK §5f) pictures the lashes through the blink in Godot.

## 4. Not yet

- The brows are placed by TAU's own brow region laid over ours by the eyes: on a face whose brows sit unlike TAU's body
  they follow the eyes, not our brow landmarks (MediaPipe's brow rows); the tails run a little long.
- A contact sheet of the presets on one face (`tools/tau_hair.py presets` lists them).
- The lash tidy's numbers (45%, 70%, 30 degrees) are fixed; they could be sliders beside the presets.

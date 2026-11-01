# Continue: the next session

Written 2026-10-24 (small hours, the user away; brought up to date in the afternoon and the evening, twice on
2026-10-25, on 2026-10-26 (`easier-hair-editing`, the salon's editing; `eyelash-more`, the second reference's five
lash sets), on 2026-10-27 on `clothing-expanded`, and last on `dev-002`: the four merged, the export's colours, the
dashboard and the writers' room; 2026-10-28 the flashlight, cleaning, the peephole, the power cut, footsteps, the
latch, examining, skin v2; then TestRoom001, the Unreal note, the skin after HumanShaders and expression loops; and
on `game-research-001`: The Visitor's research, abstract and chart, the director's to-do; merged into `dev-002` and
the to-do built there, with the Studio's eyes from the side, a small nose and the face's bake; 2026-10-28 and 29 on
`godot-support`: the Godot export, its runtime, its look, the look plugin; 2026-10-30 and 31 on `buildings-streets`: the
street builder, its paint and the PBR sets, with `prop-gen-tool` merged in). Read this
after CLAUDE.md's start list (DECISIONS, notes, SETUP), then **ask the user what they're doing now**; §4 is the menu,
not an order. Overwrite this file at the end of the next session.

## 0. `subsurace-scattering-exp` (2026-11-01): the skin's depth, waiting for the user's look in the game

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
with hair over the ears and Ear glow off), then the strength (1 by default; 2 is Blender's picture), merge or not; the
Studio's view could draw it too (not asked).

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

## 0. `realism-enhancer-skin` (2026-10-31, the night, the last): the grafted eyes for everyone, the add-on gone

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

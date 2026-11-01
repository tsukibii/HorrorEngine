# Decisions

The user's answers, newest first. They override the plan, the research and the docs.

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

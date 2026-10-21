# MetaHuman looks: East Asian faces, glass skin, hair that fits (2026-10-21)

Three questions from the user, researched without an editor in the session (so: what the docs, the API reference and
the people who did it say, with every editor-side step marked for the first run). Short answers:

1. **Korean or Japanese-looking faces:** MetaHuman Creator (in the editor since 5.6) is built from real scans and has
   East Asian presets; the route is **Blend** from two or three of those presets, then **Head Sculpt** on the six
   features that make the read (the eyelid fold above all), then skin tone, eyes and brows. For a specific likeness
   or a stylised "idol" face, go through **From Custom Mesh** (Mesh to MetaHuman) with a head made from photos.
2. **Glass skin:** on a MetaHuman it is roughness, specular and cavity, not colour. We ship a generated, UV-agnostic
   texture set (`Content/Studio/Skin/GlassSkin/`, `tools/glass_skin.py`) plus the Creator settings and the material
   multipliers to pair with it; `storykit.skin` loads and applies it. The colour stays Creator's synthesised skin.
3. **Hair that adapts to the head:** every MetaHuman groom is bound to Epic's archetype groom head
   (`SKM_MH_Groom_Head`) and re-fitted to the character's head when the character is assembled, so any groom made
   that way follows a sculpted head. The easy tools: Creator's own wardrobe, Fab `.mhpkg` grooms (there are Korean
   styles), and the free **Blender MetaHuman Groom Starter Kit** (geometry nodes) for your own.

## 1. East Asian faces in MetaHuman Creator

### 1.1 The three ways to get the shape

| Way | What it does | Use it for |
|---|---|---|
| **Blend** (Head and Body > Blend) | mixes up to three presets, globally or by head region, by moving a point between them; earlier sculpts fade as the point moves | the base: two or three East Asian presets of the right age and sex, blended by region (eyes from one, jaw from another) |
| **Head Transform / Head Sculpt** | Transform moves whole features; Sculpt adds markers (Ctrl-click) you drag, driven by the scan database (so it stays a plausible human); symmetric by default | the six features below |
| **From Custom Mesh** (Mesh to MetaHuman) | fits the MetaHuman topology to any head mesh (a scan, a sculpt, a photo reconstruction) through a MetaHuman Identity, then **Conform from Identity** in the character editor (5.6 changed this: it no longer makes a web character) | a real likeness, or a stylised face the scan database won't reach |
| **The 5.8 Python API** | `translate_face_landmarks` and the sculpt and blend calls, then `commit_face_state` (examples: `examples/example_live_edit.py`, `example_sculpt_face.py`) | repeating a recipe across the cast, once it's known |

Presets: Creator's library is built from scans across ethnicities (Epic's own example for trait blending was an
Asian monolid). Filter by look, not label: pick the presets whose eyes and jaw are already close. Fab adds editable
presets in `.mhpkg` for 5.6+, among them Asian female presets (listed as "MH_F_26", "MH_F_29", age 16 to 24) and
named ones (Lumelle Studio's Yue and Tong); read each licence before it goes near a shipped game.

### 1.2 What makes the read (the sculpt checklist)

What a frame reads as East Asian is a handful of proportions. Measure them against reference photos of the kind of
face the story wants (a Seoul office worker and a Tokyo schoolgirl aren't one face), and move only these:

1. **The upper eyelid fold.** The single biggest cue. Head Sculpt has two markers under the brow ridge and four on the
   eye (top lid, bottom lid, inner canthus, outer canthus). Pull the top-lid marker down so the fold sits low or
   disappears (monolid), or leave a low, narrow double fold (common in Korea and Japan, and what the "idol" look has).
   Don't make the eye smaller: the aperture is the same, the fold is what changes.
2. **The inner canthus.** Bring it down and slightly inward so the fold of skin covers the tear duct (the epicanthic
   fold). The eye reads as almond, the axis tilts up at the outer corner a touch.
3. **The nose bridge.** Lower the radix (where the nose meets the brow) and keep the bridge low and straight; the
   nose base a little wider, the tip rounder and less projected. Nothing else on the nose.
4. **The midface.** Flatter: cheekbones wide (bizygomatic width up) but not forward; the brow ridge shallow, the eyes
   less deep-set, the orbit shallower. This is what makes the face read flat in a side-lit horror corridor.
5. **The jaw and chin.** A rounder, narrower mandible with the chin less projected; for the stylised look, the
   "V-line": a narrow chin and a jaw that tapers from the cheekbones. Creator's scan data keeps it plausible, so the
   true idol V-line needs From Custom Mesh.
6. **Hair line and brows.** Straight, fuller brows set lower and flatter; a straight hairline.

Then the colour: **skin tone** on Creator's map with a yellow or olive undertone (the map is unlabelled; sample
against photos, the `U, V` pair is what the API and `cast.<id>.skin` store), **irises** dark brown with a strong
limbal ring, **lashes** shorter and straighter, **brows** straight. Two cautions: these are population tendencies,
not a face, so blend from real presets and keep asymmetry; and the scan database limits stylisation (very large eyes,
a tiny nose) so a manga-leaning face is a sculpt elsewhere brought in through Mesh to MetaHuman (docs/ANIMATION.md §3).

### 1.3 From photos (a likeness or a type)

- **KeenTools FaceBuilder (Blender, paid, 15-day trial):** a head from 4 to 8 photos, exported with a MetaHuman-UV
  texture ("MH texture"), then Mesh to MetaHuman. The texture transfers the real skin (moles, the exact tone) onto
  the synthesised one as an override: the best way to get a real East Asian skin, not a generic one.
- **Reallusion Character Creator 4 + Headshot 2:** a photo to a CC head; CC heads aren't MetaHuman topology, so it's
  the same Mesh to MetaHuman path (Reallusion's own notes say the 5.6 steps changed; their "Apply CC Texture" route
  is for textures, not shape).
- **A generated reference:** the user already makes close-up face videos; a neutral frontal frame from those is a
  FaceBuilder input, and the mocap takes are the same face, so likeness and animation agree.

### 1.4 In our pipeline

Faces are made in Creator, bodies in the desk (DECISIONS 2026-10-20). Write the face recipe (presets blended, the
sculpt moves, tone U V, eyes) in `docs/games/<Game>.md` for the cast member, so the next game's cast starts from it;
`cast.<id>.skin` keeps the tone the body script commits. No new story words.

## 2. Glass skin

### 2.1 What it is, physically

The K-beauty "glass" finish: an even tone with no visible pores or redness, a soft, wet-looking highlight that sits
broad over the cheekbones, nose bridge and cupid's bow, and light that sinks into the skin a little (translucency).
In a renderer that is: **low, even roughness** (skin's usual 0.45 to 0.55 down to about 0.3), **specular a touch
above skin's 0.5**, **very shallow cavity** (pores almost gone), **subsurface a little stronger**, and an albedo
with the blotchiness and redness taken out. It only reads under a soft key with a rim; under one hard flashlight it
reads as a wet highlight, which in horror is a choice, not a fault (the user judges in play).

### 2.2 What MetaHuman skin is made of

Creator **synthesises** the skin textures from the skin tone (`U, V` on its map), a texture type index (the
face and body "texture index": smoother or more detailed scans), freckles, accents (area redness) and make-up
(foundation, eyes, blush, lips, each with colour, intensity and roughness); the skin panel also has a **Roughness**
multiplier (the API documents it as 0.85 to 1.15). At assembly these bake to the head material's inputs: **Base
Color**, **SRMF** (Specular, Roughness, Metallic and Fuzz packed in one texture, `T_Head_SRMF`), **Normal** and a
small subsurface-scatter modulation map; the baked head material then exposes global multipliers for base colour,
specular, roughness, scatter and normal. Creator's **Texture Override** takes your own face **base colour, normal,
cavity and the animated (wrinkle) maps**, and body base colour, normal and cavity. Roughness is not an override
slot (a 5.6 thread: the fix was to export `T_Head_SRMF`, edit the roughness channel, reimport). 5.8 adds
**Material Overrides** (assemble unbaked, every material parameter open) and exports the unbaked textures for a DCC.

### 2.3 The recipe

In Creator, before assembly (the API names in `storykit.skin.creator`):

| Where | Setting |
|---|---|
| Materials > Skin | tone from §1; **texture index**: the smoothest type; **Roughness** multiplier at its minimum (0.85); freckles none; accents none, or cheek redness 0.1 to 0.2 |
| Materials > Makeup > Foundation | on, colour half a step lighter than the tone, intensity about 0.6, **roughness low (0.15)**, concealer high (0.8): this is the even tone |
| Materials > Makeup > Lips | roughness low (gloss) |
| Materials > Eyes | dark brown iris, limbal ring, sclera a touch brighter |
| Materials > Skin > Texture Override | **Cavity (face): `T_GlassSkin_Cavity`** (the pores nearly gone). Leave base colour and normal synthesised; the micro normal is the last resort (it also removes every wrinkle) |

After assembly (`storykit.skin.apply`, rerun after every re-assembly):

| Head material instance | Value |
|---|---|
| roughness multiplier | 0.8 |
| specular multiplier | 1.1 |
| scatter / subsurface multiplier | 1.15 |
| normal strength | 0.7 |
| the SRMF texture | `T_GlassSkin_SRMF` (ours), or in 5.8 the Material Override with our roughness and specular maps |

### 2.4 The texture set (`python tools/glass_skin.py`)

`Content/Studio/Skin/GlassSkin/` holds the 2048 set (committed, 10 MB); for a hero face run the tool at 4096 or
8192 on your machine (the maps are generated, not resized, so the pores keep their size: one every 1/400 of the
map). Every map is linear data (sRGB off): `storykit.skin.load()` imports them with the right settings.

| File | What | Where it goes |
|---|---|---|
| `T_GlassSkin_Roughness.png` | mean 0.31: low, pores a touch rougher, dewy patches lower, fine grain | a Material Override's roughness, or to build your own SRMF |
| `T_GlassSkin_Specular.png` | mean 0.55, lower in the pores | the same |
| `T_GlassSkin_Cavity.png` | mean 0.995, pores to 0.82 | Creator's Texture Override, Cavity (face) |
| `T_GlassSkin_SRMF.png` | RGBA packed in `--order` (default S,R,M,F; metallic 0; fuzz 0.25) | the baked head material's SRMF slot |
| `T_GlassSkin_NormalMicro.png` | the pores as a very shallow DirectX-green normal | optional, Texture Override, Normal (face) |
| `glass_skin.json` | the recipe above as numbers, and each file's meaning | `storykit.skin` reads it |
| `glass_skin_sheet.png` | a contact sheet: 1:1 crops and the whole map | review by eye |

Why UV-agnostic: the MetaHuman head is one UV tile with a fixed layout, but the synthesised albedo already carries
the face (lips, nostrils, the eye sockets); a roughness or cavity map with no features drawn in fits every head and
never fights it. Zones that need the layout (a drier T-zone, matte eyelids) are the second pass, painted over these
on the exported unbaked textures (5.8) once a head exists to paint on.

**Verify on the first run** (SETUP S12): open the assembled `T_Head_SRMF` in the texture editor and view one channel
at a time: the roughness channel is the one where the lips and nose tip read dark (shiny), the specular channel
mostly mid-grey and darker in the sockets, metallic black. If the order isn't S,R,M,F, rerun the tool with `--order`.
Then one contact sheet of the face under the game's three lights (the key, a flashlight, the dark) against the
default skin.

## 3. Hair that fits the head

### 3.1 How MetaHuman grooms adapt

A groom in Unreal is strands (an Alembic import) or cards; it moves with a head through a **Groom Binding** asset
(source and target skeletal mesh). For MetaHuman, the binding is made against Epic's archetype groom head,
`SKM_MH_Groom_Head`, as both source and target, and wrapped in a **Wardrobe Item**; when a character is assembled,
the pipeline re-binds the groom to **that** character's head mesh, so the strands follow the sculpted skull, hairline
and brow. That is the adaptation: it's automatic for anything that is a wardrobe item (Creator's own hair, Fab
grooms installed as `.mhpkg`, your own grooms made on the archetype head). Limits: a head far from the archetype
(From Custom Mesh, heavy stylisation) can stretch the hairline, and re-sculpting a head after binding needs a rebind;
grooms attached by socket instead of binding only follow the head's motion, not its shape.

### 3.2 The tools, easiest first

| Tool | What it is | Fit to head | Cost |
|---|---|---|---|
| **Creator's wardrobe** (Materials > Hair and Clothing) | Epic's grooms: head hair, brows, lashes, beards, peach fuzz; colour, roughness, and per-item parameters | automatic | free |
| **Fab `.mhpkg` grooms** | strand grooms for 5.6 to 5.8 with binding and wardrobe item included; Korean styles exist ("Korean Collarbone Waves", two styles, verified through 5.7's accessory adaptation), long straight hair, bobs; KhitrovArt and others sell dozens | automatic (they ship bound to the archetype head) | mostly paid, some free samples |
| **Blender MetaHuman Groom Starter Kit** (Fab, by IamSH1VA) | geometry-nodes grooming on the archetype head, a sample Alembic, a 5.6 project that makes the `.mhpkg`; the free **Groom Exporter** add-on (turbocheke) writes the Alembic | you groom on the archetype, bind to it, it adapts | free |
| **GroomForge Pro** (Superhive, paid) | turns Blender hair curves into Unreal-ready grooms: guides, attributes, binding, cards, bakes; aims at 5.7's hair dataflow | same | paid |
| **Houdini Groom Starter Kit** / **Maya XGen kit** (Epic, official) | `MH_Groom_Template.hip` with the MetaHuman for Houdini plugin; XGen for Maya 2023 to 2026 | same | needs Houdini or Maya |
| **PixelHair** and similar Blender hair packs | a hair cap with a shrink-wrap modifier fitted to any head, strands follow | fit in Blender, then bind | paid |
| **Daz or Character Creator hair** | converted to Alembic and bound; CC's hair cards need the card pipeline | manual fit | you own the asset |

The honest ranking for a 3-hour game: Creator's wardrobe first (it's free and already adapts), Fab for a style it
lacks (the Korean styles are there), and the Blender starter kit when a scene needs one specific cut: groom once on
the archetype, and every cast member's head wears it. Cards, not strands, for the shipped game (grooms LOD to cards
in the groom asset; strands are for the cutscene close-ups). 5.7 gave the Groom plugin a joint-based strand workflow
(hair that can be animated by bones), useful for a ponytail the player grabs (docs/TRICKS.md, the grab).

### 3.3 In our pipeline

Hair is Creator's: nothing in the desk (the storyboard's bodies are clay). Record the wardrobe item or the `.mhpkg`
name per cast member in `docs/games/<Game>.md` next to the face recipe. Custom grooms live in `/Game/Studio/Grooms/`
(shared, never a game's folder). Fab grooms are not CC0: they stay in the user's project and out of shared files.

## Sources

Epic: [Skin Material Controls](https://dev.epicgames.com/documentation/metahuman/skin-material-controls),
[MetaHuman Materials and Textures](https://dev.epicgames.com/documentation/metahuman/metahuman-materials-and-textures),
[Stylized Character: Texture and Material Editing](https://dev.epicgames.com/documentation/metahuman/metahuman-stylized-character-texture-and-material-editing),
[Material Overrides in Unreal Engine](https://dev.epicgames.com/documentation/metahuman/metahuman-creator-material-overrides-in-unreal-engine),
[Makeup Material Tools](https://dev.epicgames.com/documentation/en-us/metahuman/makeup-material-controls),
[FMetaHumanCharacterSkinProperties](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/MetaHumanCharacter/FMetaHumanCharacterSkinPropertie-),
[FMetaHumanCharacterFoundationMakeupProperties](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/MetaHumanCharacter/FMetaHumanCharacterFoundationMak-),
[Head and Body tools](https://dev.epicgames.com/documentation/metahuman/metahuman-creator-head-and-body-tools-in-unreal-engine),
[Blend tool](https://dev.epicgames.com/documentation/metahuman/metahuman-creator-blend-tool-in-unreal-engine),
[Head Sculpt tool](https://dev.epicgames.com/documentation/metahuman/metahuman-creator-head-sculpt-tool-in-unreal-engine),
[From Custom Mesh](https://dev.epicgames.com/documentation/metahuman/metahuman-creator-from-custom-mesh-tool-in-unreal-engine),
[Mesh to MetaHuman: from mesh](https://dev.epicgames.com/documentation/metahuman/from-mesh),
[Python scripting](https://dev.epicgames.com/documentation/metahuman/metahuman-creator-python-scripting-in-unreal-engine),
[Hair and Clothing Tools](https://dev.epicgames.com/documentation/metahuman/hair-and-clothing-tools),
[Tailoring your own wardrobe items](https://dev.epicgames.com/documentation/metahuman/tailoring-your-own-wardrobe-items),
[Houdini Groom Starter Kit](https://dev.epicgames.com/documentation/metahuman/houdini-groom-starter-kit),
[MetaHuman 5.8 release notes](https://dev.epicgames.com/documentation/metahuman/metahuman-5-8-release-notes-in-unreal-engine),
[MetaHuman 5.8 announcement](https://www.metahuman.com/news/metahuman-5-8-is-now-available),
[MetaHuman 5.7 announcement](https://forums.unrealengine.com/t/metahuman-5-7-released/2672724).
Community: [5.6 lacks a roughness override (T_Head_SRMF)](https://forums.unrealengine.com/t/5-6-metahuman-character-creator-lacks-roughness-texture-override/2616877),
[custom skin textures tutorial](https://forums.unrealengine.com/t/community-tutorial-create-custom-skin-textures-for-metahumans/2597197),
[MetaHuman makeup thread](https://forums.unrealengine.com/t/metahuman-makeup/2590907),
[trait blending and the monolid (VFX Voice)](https://vfxvoice.com/and-now-digital-humans-for-the-rest-of-us/),
[blending facial types (Wireframe)](https://wireframe.raspberrypi.com/articles/metahuman-creator-getting-our-hands-on-the-facemaker),
[Blender MetaHuman Groom Starter Kit](https://www.fab.com/listings/6a061f58-8dfc-4bce-b298-4cf5f943d8a4) and its
[forum thread](https://forums.unrealengine.com/t/iamsh1va-blender-metahuman-groom-starter-hair-cards-with-complete-workflow/2586758),
[Groom Exporter for Blender](https://blenderartists.org/t/groom-exporter-for-unreal-engine/1415778),
[GroomForge Pro](https://superhivemarket.com/products/groomforge),
[Korean Collarbone Waves groom](https://forums.unrealengine.com/t/venice-real-time-two-styles-korean-collarbone-waves-hair-for-metahuman/2723843),
[Fab grooms category](https://www.fab.com/category/3d-model/characters-creatures--grooms),
[MetaHuman hair fixes (binding)](https://yelzkizi.org/metahuman-hair-fixes-groom-lod-binding-wind-ue5/),
[Daz hair to MetaHuman](https://yelzkizi.org/transfer-daz-3d-hair-to-unreal-engine/),
[FaceBuilder + Mesh to MetaHuman](https://keentools.io/integrations/fbb-mh),
[Reallusion on 5.6 Mesh to MetaHuman](https://www.reallusion.com/FeedBackTracker/Issue/Skin-Gen-Metahuman-Exports-do-not-work-on-Migrated-UE-5-6-Metahumans),
[Fab Asian female preset](https://www.fab.com/listings/0aa4265d-d6ad-47ab-bf06-3fc1ecfb4916),
[Lumelle Yue preset](https://forums.unrealengine.com/t/lumelle-studio-yue-editable-metahuman-character/2666217),
[Subsurface Profile shading](https://dev.epicgames.com/documentation/unreal-engine/subsurface-profile-shading-model-in-unreal-engine).

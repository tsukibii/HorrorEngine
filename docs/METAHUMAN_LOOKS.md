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
- **`tools/face_mesh.py` (ours, free, no account):** a head shaped from one photo or several, or a video (the
  close-up takes work), with MediaPipe's Face Landmarker (Apache-2.0). Each picture's 468 points are taken out of
  their head pose, the turned, smiling, blinking and talking ones dropped, the rest averaged into one neutral face;
  then a whole head is bent to it (MHR's by default; **better, your MetaHuman's base head saved as OBJ from Blender**:
  the result keeps its topology and place, so it's already lined up for Mesh to MetaHuman's trace and auto-match).
  A face alone isn't enough for the tracker: with no skull or ears it struggles to place things, and MediaPipe's own
  eye openings are too soft (docs/LESSONS.md); the template's eyelids, shaped by the photo's, fix both. Settings:
  depth (MediaPipe's depth is a learned guess, so the profile is the weakest part: check it against a side photo),
  follow, detail, smooth, symmetry, all sliders on the desk's face page (`face.html`: drop pictures, see why each was
  used or dropped, turn the head, Save). Expressions are read against the person's own most neutral picture, so full
  lips (MediaPipe's "pout") don't drop every picture; an open mouth is measured from the lips. Faces made from real people's pictures stay in `Content/Studio/Heads/`
  (git-ignored). Not MICA or FLAME: both need an account and are non-commercial.
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

### 3.3 Tools that make the hairstyle itself (the "easy hair" question, 2026-10-21)

§3.2 is how a groom gets onto a MetaHuman. This is who has made the *making* of a hairstyle easy: draw a few guides
or pick a preset, get strands. Everything below ends in an Alembic groom, which binds to the archetype head like any
other (§3.1), so the fit is the same. Easiest first; "unverified" means a vendor's page, no independent test found.

| Tool | What it is | Output | Cost | Notes |
|---|---|---|---|---|
| **Sisir** (standalone, Windows, July 2026) | import a head OBJ, draw guide curves on it, a non-destructive procedural stack (clump, frizz, curl, cut) grows the full groom | Alembic and PLY (no FBX or USD) | free; the licence was being updated for commercial use (CG Channel), 80.lv says free for commercial already: check its site | **the user's pick (DECISIONS 2026-10-21)**; the closest thing to "easy hair" today; its Unreal import is untested in print (Unreal's Alembic groom schema is informal), so the first run is a test |
| **Unreal's own Groom Dataflow** (5.7, Hair Data Flow section in the groom asset) | templates build a node graph on an imported groom: guides, interpolation, cards, joint-based deformation and painting on strands (the "hair art directability" docs) | the groom itself | free, in the engine | edits an existing groom; it doesn't draw one from nothing |
| **Epic's Hair Card Generator** (experimental plugin, Geometry category; a Dataflow "Cards" template in 5.7) | strands to card LODs with textures, inside the editor | card meshes and textures on the groom | free | the ship step for a game: strands for the close-ups, cards everywhere else |
| **MetaHuman for Houdini + Houdini Groom Starter Kit** (Epic, free assets) | procedural grooming on the MetaHuman head in Houdini, with an exporter | Alembic | the assets are free; Houdini isn't (Indie is cheap) | the official procedural route |
| **StrandKit** (Blender, Superhive, paid) | 22 procedural hairstyle setups by hair type (1A to 4C), 13 hair-card generators, 1000+ baked cards | Blender hair curves, then Alembic | paid | unverified; the nearest thing to "pick a style, adjust" |
| **Medusa Nodes** (Blender, free) | a procedural hair add-on on geometry nodes: generator, deformers, a hierarchy panel | hair curves | free | unverified |
| **Hair Wrangler** (Blender 4.1+), **Hair Painter / Hair Lab** (4.2+), **Hair Brick Pro**, **Tube Hair Generator** | draw Bezier curves or tubes, the add-on builds the geometry-node hair; Stylized Hair Pro (4.5+) for anime clumps | hair curves | paid, cheap | the anime route for a stylised cast: Stylized Hair Pro, then Alembic |
| **GroomForge Pro** (Blender, paid) and the free **Groom Exporter** | the pipeline end: guides, Unreal attributes (groom_id, groups), binding, cards, export | Unreal-ready Alembic | paid / free | pairs with any of the Blender tools above |
| **MetaBridge Forge** (Unreal plugin, Chamiseul) | one action: import a groom Alembic, clone the archetype head and materials, create the binding and the Wardrobe Item | a `.mhpkg`-style wardrobe item | paid | what the Blender starter kit does by hand, automated; unverified |
| **Hair-card texture makers:** Fiber Card Gen (free, browser), HairShop, HairTG, Houdini's Hair Card Texture | the strip textures for cards | PNG colour, normal, depth | free to paid | only if you make cards outside Unreal |
| **AI, from one photo: DiffLocks** (Max Planck, 2025) | a diffusion model that predicts 3D strands from one frontal image, trained on 40K Blender hairstyles; code on its project page, weights on registration | strands (to export yourself) | free, research | the real "photo of a K-pop cut to strands" route, but it's a research repo: a weekend to run, and the strands need a Blender pass to become a groom. Newer papers (HairLRM, CGHair, 2026) have no code yet; Digital Salon (AI plus physics grooming) has no code found |
| **Ready-made grooms on Fab** | Korean collarbone waves, anime twin-tails ("Venice", verified on 5.6 and up), broccoli fades, beards | `.mhpkg` | mostly paid, some free | still the fastest when the style exists |

**What I'd do for this studio:** Fab for the styles that exist (the Korean and anime ones do), Sisir for a cut of our
own (draw ten guides on the archetype head, export Alembic, bind in Unreal), Stylized Hair Pro when a game wants the
anime read, and Epic's card generator before shipping. The Blender starter kit's project is the reference for the
`.mhpkg` packaging whichever tool drew the strands. Write the first Sisir-to-Unreal result in LESSONS.md.

### 3.4 In our pipeline

Hair is Creator's: nothing in the desk (the storyboard's bodies are clay). Record the wardrobe item or the `.mhpkg`
name per cast member in `docs/games/<Game>.md` next to the face recipe. Custom grooms live in `/Game/Studio/Grooms/`
(shared, never a game's folder). Fab grooms are not CC0: they stay in the user's project and out of shared files.

### 3.5 Ready-made grooms on Fab: what to buy for a Korean or Japanese cast (2026-10-21)

Fab's MetaHuman channel (`fab.com/search/channels/metahuman?tags=groom`) has hundreds of grooms; most are Western
cuts, fades and beards. The ones that read East Asian come mostly from one seller, **Venice**, whose names are
salon terms from Seoul (air bangs, collarbone waves) and who posts every style on the Unreal forums with the same
spec: strands bound to the archetype head ("verified through the MetaHuman accessory adaptation of Unreal 5.6",
so it fits any head), an LOD setup that drops the curve count by 50 to 70 percent, 20 to 500 physics guides, the
`.abc` source, a UE 5.5.4 project and the `.mhpkg`. Prices aren't in the forum posts: read them on Fab.

| Need | Buy | Why |
|---|---|---|
| **Pipeline test, costs nothing** | Venice, **"Real-time Straight Hair with Air Bangs"** (free) | long straight hair with the thin Korean fringe: the most common young-woman look in both countries; install it first, confirm the binding, the LODs and the card generator on it before paying for anything |
| **The female lead** | Venice, **"Two Styles Korean Collarbone Waves"** | the K-drama cut (collarbone length, soft C-curl ends), two variants in one pack |
| **A schoolgirl or a short cut** | Venice **"Short Bob Vol.2 - Straight"**, or **"Short Bob with Blunt Bangs"** (seller unnamed in the listing; check it) | the straight bob with a blunt fringe is the Japanese schoolgirl read; Venice's "Twisted Bob" for a styled one |
| **Hair the player can grab, or a runner** | Venice **"Six Style Ponytail"** or **"Eve Long Ponytail with Bangs"** (also in Venice's "Mega Groom Hair Pack", often half price) | ponytails have the most physics guides (up to 500): they swing, and they're what a hand can close on (docs/TRICKS.md, the grab) |
| **Anime read** | Venice **"Anime Twin-Tail"**, "Bubble Twin-Tail", "Spiral Twin Tail", "Ichigo Spiky Short" | the only anime-styled MetaHuman grooms found |
| **Men** | Venice **"Two Styles SlickedBack Short"** or **"Triple SidePart Pompadour"** as the nearest; KhitrovArt for fades and recedes (strands only, 5.6 to 5.8) | **Fab has no two-block, comma hair or curtain fringe**: the Korean men's cuts are the first Sisir job (§3.3) |
| **Free, to learn the format** | AnnaLev "Messy Bob", Quang Phan "MHC: Nomad Wave Undercut", studio TEKATI "Broccoli Fade 2" (all free) | three different sellers' packaging to compare against our own `.mhpkg` |
| **Brows** | KhitrovArt "Medium Natural Straight Eyebrows" | straight brows are half the East Asian read (§1.2) and Creator's are mostly arched |

Before buying, on each listing: 5.6 or later and "verified" or "accessory adaptation" in the text (older grooms
bound to the 5.5 head need rebinding by hand); whether cards are included (KhitrovArt says no; Venice doesn't say:
assume strands only and plan on Epic's card generator); physics guide count if it must swing. Fab's standard
licence allows the groom in a shipped game but not redistribution: it stays in the user's project, never in a
shared file (the studio rule). Colour is the hair material, not the groom: every one of these goes black.

### 3.6 Changing a groom you already have (length, cut, shape) (2026-10-21)

The user's question: can a bought or built hairstyle be modified, say made longer? Yes, in two tiers: Unreal can
**shorten, thin, recolour and pose** a groom without leaving the editor; **lengthening and restyling** means the
strands go out to Blender (or Sisir) and come back as a new Alembic. Buy long, clip short.

**Inside Unreal (no re-export):**

| Control | Where | What it does | Limit |
|---|---|---|---|
| **Hair Clip Length** (0 to 1) | Groom component, Strands; per group in the groom asset | clips every strand at that fraction of *its own* length: 0.7 takes 30 percent off everything | shortens only, proportionally: a bob from long hair keeps the long hair's shape, and a blunt line needs Blender |
| Hair Width, Root Scale, Tip Scale | same | thicker or finer strands, tapered or blunt tips | look, not shape |
| Decimation and LOD settings | groom asset | fewer strands, fewer points | density, not length |
| Hair material | the wardrobe item's material instance | colour, melanin, roughness, root-to-tip gradient | every Fab groom goes black here |
| **Art directability** (5.7, "Deformation" on, simulation off) | the groom's deformer graph plus a skeletal mesh of hair joints | pose and animate strands by joints, selection sets and paint tools, blended with physics: a fringe swept aside, a ponytail held up | moves what exists; it doesn't grow or cut |
| **Groom Dataflow** (5.7, 5.8) | Hair Data Flow on the groom asset, from a template | nodes that resample curve points, average curves into one, build joints from guides (for the above), and in 5.8 generate the cards | no length or cut node in the docs found |

**Outside Unreal (the real restyle):** the sellers who ship the `.abc` source (Venice and KhitrovArt do; buy only
those) make this possible.

1. **Blender:** import the Alembic, convert the curves to hair curves on a scalp (the archetype groom head from the
   starter kit, so the result binds to every MetaHuman), then **Curves Sculpt mode**: **Grow/Shrink** (lengthens by
   extrapolating each curve's direction, or scales uniformly; a minimum length), Comb, Snake Hook, Puff, Pinch,
   Smooth, Add, Delete and Density. Extrapolated ends come out straight, so comb after growing, or add curl and
   clump with geometry nodes. Export Alembic (scale 100, selection only, children off; the free Groom Exporter keeps
   the group ids), import as a new groom, bind to the archetype head, make the wardrobe item (MetaBridge Forge does
   the last two in one click). Known traps: a Blender 4.2 export gave radius 0 in Unreal (check the version), and
   group ids must survive or the materials land on the wrong strands.
2. **Sisir:** imports PLY curves, not Alembic, so the groom goes through Blender once (`.abc` in, PLY out); then
   its procedural stack (length, cut, clump, frizz) works on the bought guides and the Alembic comes back. Untested.
3. **Houdini or Maya** with Epic's starter kits: the heavy route, same result.

Rebind after every change: a new Alembic is a new groom asset, and the wardrobe item points at the binding, so the
character is re-assembled. Fab's licence allows modifying a groom for your own game; the edited `.abc` is still
theirs and stays out of shared files.

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
Hair tools (§3.3): [Sisir (CG Channel)](https://www.cgchannel.com/2026/07/sisir-is-a-promising-new-free-standalone-hair-grooming-tool/),
[Sisir (80.lv)](https://80.lv/articles/sisir-new-guide-based-hair-grooming-tool),
[Hair Card Generator (Epic)](https://dev.epicgames.com/documentation/unreal-engine/hair-card-generator-for-grooms-in-unreal-engine),
[cards and LODs with the generator](https://dev.epicgames.com/documentation/unreal-engine/creating-hair-cards-and-lods-using-hair-card-generator),
[Hair art directability (Epic)](https://dev.epicgames.com/documentation/metahuman/hair-art-directability),
[Groom Dataflow in 5.7 (community)](https://wiki.kwonsh.duckdns.org/Advanced-Groom-Dataflow-Setup-in-UE-5-7-/Advanced-Groom-Dataflow-Setup-in-UE-5-7-.html),
[MetaHuman for Houdini](https://digitalproduction.com/2025/09/01/metahuman-meets-houdini/),
[StrandKit](https://superhivemarket.com/products/strandkit), [Medusa Nodes](https://medusa-nodes-documentation.readthedocs.io/),
[Hair Wrangler](https://dannymac.gumroad.com/l/hairwrangler), [Hair Painter](https://superhivemarket.com/products/hair-painter),
[Stylized Hair Pro](https://superhivemarket.com/products/stylized-hair-pro), [LS Hair Card Tool](https://superhivemarket.com/products/ls-hair-card-tool),
[MetaBridge Forge](https://forums.unrealengine.com/t/chamiseul-studio-ci-metabridge-forge-metahuman-outfit-groom-automation/2745720),
[Fiber Card Gen](https://eperson.itch.io/fiber-card-gen), [HairTG-Cards](https://olif.artstation.com/blog/category/2),
[DiffLocks](https://difflocks.is.tue.mpg.de/), [HairLRM](https://arxiv.org/abs/2606.15238), [CGHair](https://arxiv.org/abs/2604.03716),
[Digital Salon](https://digital-salon.github.io/), [anime twin-tail groom](https://forums.unrealengine.com/t/venice-real-time-anime-twin-tail-hair-for-metahuman/2743782),
[best grooming tools for Unreal (overview)](https://yelzkizi.org/best-hair-grooming-tools-for-unreal-engine/).
Fab grooms (§3.5): [Fab MetaHuman grooms](https://www.fab.com/search/channels/metahuman?tags=groom),
[Venice: Straight Hair with Air Bangs (free)](https://fab.com/s/392bcd050924),
[Venice: Short Bob Vol.2 Straight](https://forums.unrealengine.com/t/venice-real-time-short-bob-hair-for-metahuman-vol-2-straight/2600874),
[Venice: Twisted Bob](https://forums.unrealengine.com/t/venice-real-time-twisted-bob-hair-hair-for-metahuman/2745890),
[Venice: Six Style Ponytail](https://forums.unrealengine.com/t/2633452),
[Venice: Voluminous High Ponytail](https://forums.unrealengine.com/t/venice-real-time-voluminous-high-ponytail-hair-for-metahuman/2617192),
[Venice: Two Styles SlickedBack Short](https://forums.unrealengine.com/t/venice-real-time-two-styles-slickedback-short-groom-hair-for-metahuman/2653230),
[Venice: Ichigo Spiky Short](https://forums.unrealengine.com/t/2569322),
[Eve Long Ponytail with Bangs](https://www.fab.com/listings/5ea13ec6-90a3-4af4-bfca-96f9f606559f),
[Short Bob with Blunt Bangs](https://www.fab.com/listings/152a6956-200e-4918-b0bd-c6e22711f652),
[Studio Ninjato MetaHair 17](https://forums.unrealengine.com/t/studio-ninjato-metahair-17-groom-hair-for-metahuman/2583008),
[studio TEKATI Broccoli Fade 2 (free)](https://forums.unrealengine.com/t/now-permanently-free-studio-tekati-metahuman-broccoli-fade-2/2732688),
[KhitrovArt straight eyebrows](https://forums.unrealengine.com/t/khitrovart-medium-natural-straight-eyebrows-groom-for-metahuman/2838687),
[KhitrovArt hard part slick back (5.6 to 5.8, strands only)](https://forums.unrealengine.com/t/khitrovart-hard-part-slick-back-with-mid-skin-fade-groom-for-metahuman/2739919).
Editing grooms (§3.6): [Groom component reference: Hair Clip Length, width, root and tip scale](https://docs.unrealengine.com/4.27/en-US/WorkingWithContent/Hair/Reference),
[Hair art directability (Epic)](https://dev.epicgames.com/documentation/metahuman/hair-art-directability),
[Skeleton creation from hair guides, Dataflow nodes (Epic)](https://dev.epicgames.com/documentation/metahuman/skeleton-creation-from-hair-waves-in-unreal-engine),
[Hair card generator in Dataflow, 5.8 (Epic)](https://dev.epicgames.com/documentation/metahuman/hair-card-generator-in-dataflow-in-unreal-engine),
[Blender Curves Sculpting manual](https://docs.blender.org/manual/en/latest/sculpt_paint/curves_sculpting/index.html),
[Blender Grow/Shrink brush commit](https://developer.blender.org/rB190334b47df),
[Blender 3.3 hair system notes](https://wiki.blender.org/release_notes/3.3/nodes_physics/),
[Blender to Unreal groom guide (iRender, 2026)](https://irendering.net/integrating-blender-hair-into-unreal-engine-groom-system/),
[Blender 4.2 Alembic radius bug thread](https://blenderartists.org/t/trouble-exporting-importing-alembic-file-to-unreal-5-3/1519878),
[Daz hair to groom notes (Alembic recipe)](https://www.versluis.com/2024/04/quick-notes-on-turning-daz-hair-into-groom-hair-for-unreal-engine/).

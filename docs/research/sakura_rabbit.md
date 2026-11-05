# Sakura Rabbit's Unity experiments: candidates for the studio and the games

2026-11-05, on `sakura-rabbit-research`. The user: "research some experiments Sakura Rabbit has made in Unity that might
be well suited for aesthetics in our engine (either studio, or gameplay etc), especially anything on designing clothing
via shaders etc; if you find some good candidates list them, otherwise we will move on to other research." This note is
the list: each candidate with what she showed, how it is most likely done, what we already have and what we would build.
Nothing is decided here; the user picks, and DECISIONS records it.

## 0. Who she is, and how this was read

**Sakura Rabbit (樱花兔, @Sakura_Rabbiter)** is a solo Unity artist who publishes one real-time effect at a time as a
short video, then sells the project. Chinese profiles (a Sohu piece on CAFA alumni, ~Apr 2023; Unity China's developer
interview, ~2020) say Guangdong-born in 1995, a Central Academy of Fine Arts graduate, then an art teacher, self-taught
in Unity's HDRP from about 2018, "no team, done alone"; Hitmarker alone calls her a Hong Kong developer; since March 2024
she is also Convai's creative director. Her subjects are refined female characters in everyday clothes and the effects
round them, which is our cast. In the last two years every PC (HDRP) effect has been ported to a phone (URP), a stricter
budget than our GTX 1060's.

**Where her work lives, and what that means for us.** X (every post ends "subscribe to my Fanbox to download this
project"), Fanbox (a paid subscription), Patreon (from $70 a month per its page's extract, files kept two months), Unity
China's learn.u3d.cn (two packs of project files: any two for 399 CNY, a full set for 2798 CNY), Bilibili, YouTube, one
free guest post on the Unity blog (2023), two Zhihu articles and a few Unity China community posts (2019 to 2020). The
Asset Store page in her name is an influencer page listing the third-party assets her demos use; she sells nothing
there. **Every project file of hers is for learning only, no commercial use or resale.** So nothing of hers can go into
this project, and nothing in this note needs to: what it takes is the idea, built our own way, as everything here is
(CLAUDE.md: assets CC0 or ours).

**How this was read, and the caveat.** This cloud session's network policy resolves GitHub and nothing else that
matters here: 80.lv (which has covered dozens of her experiments), Hitmarker, 3dvf, unity.com, Fanbox, learn.u3d.cn,
YouTube, X, Bilibili, CSDN and cnblogs all fail. So every claim below comes from search extracts of those pages (the
quotes are the extracts' own wording, not the full articles), gathered by three research passes of about 150 searches.
Dates decoded from X post ids are exact to the day; dates from an article's age are approximate (~). **No public source
states how any of her effects is built** beyond a phrase (80.lv describes, the breakdowns are in the paid files), so
every "how" below is marked stated or inferred, and the inferences are mine. With those hosts allowed in the session's
network settings, each article is one fetch away and this note should be read again against them (research/photoreal.md
was written under the same limit).

## 1. The candidates, ranked

The user's priority first (clothing by shaders), then what the games' look and play would gain. "Reads through the
tape" is photoreal.md §2's test: the games are seen through UltraVHS, which keeps about 240 lines of brightness and 40 of
colour, so metre-scale variation, gradients, gloss and motion read, and millimetre detail doesn't.

| # | Candidate | Her experiment (date) | Lands in | Reads through the tape | Size |
|---|---|---|---|---|---|
| 1 | **Hosiery and skin-tight layers painted by the skin shader**: denier, stretch, the view's angle, the knit, the band's squeeze | the stocking shader (27 Feb 2022; on a phone ~Jun 2025); the ribbon pressing a thigh (11 Dec 2024) | the Studio's `skinshader.js` and the tailor's designs; Godot's `HSSkin` | the density gradient and the band: yes; the knit only close | medium |
| 2 | **Wet clothes**: darker, glossier, thin cloth clinging and see-through, drops | wet stockings and clothes in Shader Graph (~Jan 2020, very likely hers); the raindrop decal on shoes (Sep 2023) | the story's `skin` word and `game.weather`; a clothes shader in the look plugin | yes | medium |
| 3 | **Wrinkles that move**: clothes by the joints, the face by the expression | real-time clothing wrinkles (~Jun 2024; mobile ~Jul 2025); facial wrinkles (~early 2025) | `tailor/crease.js` and the clothes shader; `HSSkin` with `face.gd`'s weights | the big folds yes; fine lines in close-ups | medium |
| 4 | **Dissolve transitions**: a change of clothes, a cover creeping over the skin, a ghost dissipating | clothing change (7 Nov 2022, May 2023, 27 Feb 2025, mobile ~Jul 2026); the Venom suit (14 Sep 2023; mobile ~Oct 2025); the wings (May 2024) | one `dissolve` shader in the look plugin; a transition on a model change; the `skin` word's cover | yes: big, bright-edged, slow | small to medium |
| 5 | **Contact deformation**: fingers, a rope, a band pressing into the skin | pressing the skin, the ribbon, the mouth's inside (11 to 13 Dec 2024) | `HSSkin`'s vertex stage; the Studio's sculpt fields; the grab (TRICKS §5) | yes | small |
| 6 | **The room that changes**: two dressings of a level masked per pixel | space transformation (Oct 2022), space distortion (Nov 2022), seamless scene transitions (Sep 2024) | a story word; a level's second dressing; a world-space mask | yes | medium to large |
| 7 | **Snow** as a weather | global snow covering (13 Nov 2022); URP mobile (Jun 2026); the winter scene (25 Jan 2025) | `game.weather: snow`, an `HSSnow` beside `HSWet`; the street shader | yes, best of all | medium |
| 8 | **Fabric detail by mask and detail map**, not baked | her own advice (Unity blog, 29 May 2023) | the Godot clothes material (UV2 in metres is exported already) | close up only | small |
| 9 | **A CRT screen seen close** | the 2020 Retro Shaders challenge entry | the little things' TV, a leaning-in moment | yes | small |
| 10 | Smaller: **heels by a slider**, **eyes driving the lids**, **muscles** | adaptive heels (~2024); eyes drive the eyelids (14 Oct 2024); muscle simulation (25 Oct 2023) | the tailor's shoes; `eye.gd`/`blink.gd`; nothing | yes / yes / no | small / small / not for us |

**Not candidates** (we have it, Godot can't, or it is someone else's tool): her eye shader (ours refracts: research/eyes.md,
GODOT_LOOK §5f), face capture (`face_capture.py` on MediaPipe), Unity's strand hair and Alembic grooms (Godot has no strand
hair; the salon's bake worn MetaHuman's way, GODOT_LOOK §5e), MagicaCloth2 layered cloth (our drape and soft bones; Godot
has no cloth), ZibraAI liquids and smoke (third-party, Unity-only), the stylized ocean and the water cross-section,
automatic paving under the feet, the Unity 6 hand close-up (our skin detail at its true size, GODOT_LOOK §5d), and her
environments (the witch's bedroom, the jungle tomb, the alien scenes, the cyber street: ours come from the builders).

## 2. Hosiery and skin-tight layers as a layer of the skin shader (candidate 1)

**What she showed.** Stated (80.lv): "a tension simulation of nylon stockings set up in Unity; the material becomes
denser when compressed and more transparent when stretched; the diamond-pattern details show the subtle changes". The
first stocking shader was 27 Feb 2022 ("How to make the shader of stockings? Join Fanbox to download this project"), a
URP version ran on a Huawei Pocket 2 (~Jun 2025), and the mobile wrinkles demo (~Jul 2025) pairs "the same stocking
shader she used on PC" with wrinkles moving on tights. Her Sep 2019 scene 《黑丝事务所》 (HDRP) and a Jan 2020 column on
wet stockings in Shader Graph (§3) say stockings were her first subject; the learn.u3d.cn pack's one free preview
chapter is 丝袜材质, the stocking material.

**How it is most likely done (inferred: her files are paid).** The recipe every Chinese write-up on stockings uses, and
which her phrases fit: the nylon's coverage from its **denier** (5 to 10 D nearly clear, 100 D and over opaque), times a
**stretch** term (a greyscale stretch map, or the knit's strain where the leg is thickest: more stretch, fewer fibres per
pixel, more skin), times a **view-angle** term (fibres seen edge-on stack up: denser toward the leg's silhouette,
sheerest where the surface faces the eye, the inverse of a Fresnel), the knit as a detail normal whose scale follows the
stretch, a sheen down the leg (anisotropic along the knit), metal 0 and a smoothness by the yarn. Open implementations of
the same idea: Kirkice's StockingShader (Unity, 2019: density = denier x a stretch map x an edge term, in prose, no licence
stated), Blatke's Silk Stocking Shader (a Fresnel strength and exponent on the alpha, a flip, wetness and fluid layers;
no licence), a Zhihu HDRP Shader Graph write-up (transparency by Fresnel and the degree of stretch, 2019.4) and a URP one
with Substance and Unity files (2023). None is needed: ours is a few lines.

**What we have.** The tailor's **sheer** fabric (TAILOR §1b; `tailor/fabric.js`, `tailor/look.js`): tights cut from the
legs as a garment mesh at a fit, the nylon's alpha `denier x (0.85 + 0.15 x grain)`, raised to opaque where the surface
turns from the eye (`pow(1 - |n.v|, 1.4)`), a sheen tile down the leg, a lace top as its own surface; fishnet and lace
with real holes. In the Godot export the tights are a mesh with a baked albedo and alpha. No stretch anywhere, and no
squeeze at the band.

**What to build.**
- **Stretch into the sheer alpha.** The drape knows each triangle's cut size and its hung size; per vertex, strain = hung
  edge length over the cut's, baked into the garment's per-vertex data as `crz` is (`tailor/uv.js` `unwrap`: a fifth
  channel) and read by `look.js`: alpha x (1 - k x strain), the knit tile's scale divided by the strain. In Godot the strain
  leaves in a vertex colour channel and the tights' material becomes a `sheer.gdshader` of the look plugin (denier, strain,
  the view term, the knit as a detail normal on the metres UV) instead of a baked alpha. Strain by pose (a bent knee) wants
  the skinned pose: scale the baked strain by the knee's flexion the way candidate 3 scales the folds.
- **The band.** The tops of thigh-highs, sock cuffs and waistbands press in: candidate 5's ring falloff, static in the
  Studio (a sculpt-like offset field along the band's edge: in by 3 to 6 mm, a bulge of half that beside it), baked into
  the body as the sculpt's controls are, so the export carries it.
- **Hosiery as paint, not a mesh: the "designing clothing via shaders" idea.** A garment with no silhouette of its own
  (tights, stockings, socks, gloves, a bodysuit, a swimsuit's fabric, a tattoo-like print) can be a layer of the skin
  shader on the body itself, the way the skin shader already paints liner, lipstick and nails (`lips.js`, `nails.js`): no
  second mesh, no poke-through ever, the band's squeeze on the body's own vertices, and the stretch from the body's own
  skinning (the thigh's skin stretches where the nylon would). The tailor's designs already draw their cut lines on the
  body in the edit mode (TAILOR §3c): a design marked `painted: true` would use the same cut lines (a hem at a height
  along the leg, a waistband, a neckline) as the layer's mask instead of cutting cloth, so one design format serves both
  renderings and a stocking is cut or painted by one word. The layer is baked by `albedo.js` beside the makeup into MHR's
  UVs, and in Godot `HSSkin` takes it as a mask texture with its denier, colour and knit. The export has one fewer mesh per
  hosiery garment and the tape sees the same thing.
- **Through the tape.** Beyond a metre the knit vanishes; what reads is the gradient (sheerer over the thigh's front,
  denser toward its edge and at the knee's bend), the band's dent and the sheen. So the stretch and the view term carry it;
  the knit is for the close-ups (`CU` on a `talk`).

## 3. Wet clothes (candidate 2)

**What she showed.** A Unity China community column, "[HDRP] 用ShaderGraph制作丝袜和衣服的淋湿效果" (wet stockings and
clothes in Shader Graph; the author calls herself 兔纸, "Bunny", and wishes readers a happy Year of the Rat: ~Jan 2020,
on the same community as her Sep 2019 stockings scene, so very likely hers, not confirmed): raindrops on stockings,
clothes soaked. Then the **dynamic raindrop decal** (Sep 2023): "a highly-realistic rain effect to 3D surfaces", shown as
drops on a character's shoes "that closely resemble their real-life counterparts"; generalised in Dec 2024 to rain
"projected onto any surface" (a Fanbox project), and a Unity 6 scene of "water droplets and puddles with ripples and
accurate reflections" (Dec 2024).

**How (inferred).** Wet cloth: the albedo darkens (water fills the fibres' air: cotton and linen darken most, nylon and
polyester least), the roughness drops, a clear coat appears; thin cloth loses opacity where wet and clings where it
touches the skin (cheaply: alpha x (1 - wet x thinness), the skin's colour mixed in); drops as an animated normal layer
(a drop texture, a fall, a trail) run down by gravity, more at the shoulders and hems. The Chinese write-ups (cnblogs,
2023) say the same: a noise mask animated along UV for the rain, driving roughness, normal and clear coat; soaked cloth
"simply as translucency".

**What we have.** The story's `skin` word (STORY_FORMAT §9: a cast member `wet`, sweating, dripping, oiled) on `HSSkin`:
a sweat film, beads with glints, drips, oil (GODOT_LOOK §5). `game.weather: rain` wets a room with no ceiling by itself
(`HSWet` floors with rain's rings, `HSRain` streaks and splashes, the panes' drops in `glass.gdshader`, the street's wear
turned up). The clothes do nothing in the rain: a cast member in from a storm has wet skin and dry clothes.

**What to build.** A clothes shader in the look plugin (`cloth.gdshader`: the glTF material's maps plus ours) with a `wet`
0..1: albedo x (1 - 0.5 x wet x absorb) with `absorb` by the garment's fabric (its surface's name already leaves in the
glTF extras), roughness toward 0.25, a clear coat, thin fabrics' alpha falling with the skin's colour mixed in where the
cloth sits on the skin (the Studio already works out which skin lies under which garment, TAILOR §3d, so the distance is at
hand at the bake), the panes' drop layer on the shoulders and the hem running down. Driven by the `skin` word (her `wet`
wets both) and by `game.weather` outdoors with a time constant (soaked in a minute, dry in ten). The Studio's `look.js`
gets the same `wet` for the pictures and the desk. Through the tape the darkening and the gloss read; the drops are for
the close-up.

## 4. Wrinkles that move (candidate 3)

**What she showed.** "An innovative system for creating real-time wrinkles, allowing her to produce highly realistic
digital clothing that folds naturally as 3D characters move" (~Jun 2024; a Bilibili series "Unity实时褶皱"), then on a
phone with tights (~Jul 2025); and the face: "adjusting parameters changes the character's expression and adds wrinkles
around the mouth and forehead" (~early 2025).

**How (inferred).** Wrinkle maps: two or three normal maps of the garment's folded states (elbow bent, knee bent, arm
raised; brows down, a smile) blended in by region masks whose weights come from the joint angles or the blend shapes'
weights (Crysis's and Uncharted's technique; the Unity forum's "wrinkle maps or tension maps"); a tension-map variant
derives the weight from each triangle's compression. The phone version rules out tessellation: it is normals.

**What we have.** Static creases (TAILOR §1d, `tailor/crease.js`): per vertex at the unwrap, `bend` (how much the cloth
bunches there), `drag`, the seams and hems, drawn as a height in the shader and baked into the export's normal map
(`albedo.js` `bakeClothNormal`). They don't move with the pose. The skin's age wrinkles (`skinshader.js`) are placed from
the landmarks and fixed; the expressions play MHR's 72 shapes (`face.gd`) with nothing in the skin following them.

**What to build.**
- **Clothes:** scale the fold height by the joint's flexion, live. The per-vertex `bend` already says where a garment
  bunches; multiply it by the flexion of the joint that owns the spot (the elbow for the sleeve's inside, the knee for the
  back of the leg, the hip for the lap), 0 straight to 1 fully bent, in the vertex shader from the skeleton (the garment is
  skinned on MHR's bones, TAILOR §3b). In the Studio for the pictures and `tailor/motion.mjs`; in Godot the clothes shader
  reads the two bones' angle. If the live height costs too much, bake two normal maps (straight, bent) and lerp. The big
  folds read through the tape: this is the cheapest motion the clothes can get.
- **The face:** expression wrinkles in `HSSkin`: frown lines weighted by the brows-down shapes, crow's feet by the squint,
  the nasolabial fold by the smile and the cheek raise, the forehead's by brows-up; the weights are the clip's own
  (`face.gd`), the maps drawn once by `skinshader.js`'s wrinkle placer at full depth and baked per region into the plugin's
  `textures/` like the detail tiles (SKINDETAIL's recipe). For the L.A. Noire close-ups (`talk`) this is where a face stops
  being a mask; a young cast shows little of it, the old (`70 and over`) all.

## 5. Dissolve transitions (candidate 4)

**What she showed.** Three generations of a clothing change: "a magical-looking clothing change effect that allows her to
change the attire of her digital characters in real-time" (7 Nov 2022), a revised version (May 2023), "a long skirt turns
into a short one in a magical trick controlled by Material Dissolve parameters" (27 Feb 2025: "the smoothness and
seamlessness of the transition are its main draw"), a URP mobile outfit change (~Jul 2026). The Venom suit: "a Venom-like
suit that covers her entire body, all in real-time animation" on a Spider-Verse Gwen (14 Sep 2023), "a sleek Venom-style
reveal effect ... fully optimized for mobile" (~Oct 2025). The angel wings "break apart and dissipate" (May 2024).

**How (inferred).** A dissolve: a noise texture against a threshold swept along a gradient (height, or distance from a
seed point), discarded below it, an emissive edge a few millimetres wide above it; two garments share the threshold, one
going as the other comes; "Material Dissolve parameters" says the whole thing is animated material properties, no script.
The suit: a mask grown over the body (distance from a seed in body space, or a flood over the skin's UVs) that swaps the
skin's material for a glossy black and may thicken the surface along its normals. The wings: a per-feather dissolve with
particles emitted from the dissolving edge.

**What we have.** A cast member's **models** (named looks, a body each, picked per scene and carried down the flow:
STORY_FORMAT §2, §3.1): a change is a swap at a scene's start, never seen. Nothing dissolves; a ghost is a body or isn't.

**What to build.** One `dissolve.gdshader` in the look plugin (noise, threshold, direction, edge colour and width) worn by
any mesh as its `material_overlay` or a next pass, and three story uses: (a) a model change inside a scene as a
transition (`set model` with `transition: "dissolve"`, seconds, a direction: the old export dissolves out as the new
dissolves in, both resident for the second it takes; a possession, a reveal, the yandere's switch); (b) a **cover** on the
`skin` word (`{"skin": "aoi", "cover": 0.6, "from": "chest", "as": "tar"}`: a mask grown from a point over her skin, the
covered part another look (black and glossy, veined, wet, bone), the edge glowing or weeping: a curse spreading while the
player watches); (c) a ghost's **dissipation** (a trigger's `vanish: "ash"`: the body dissolves from the hem up, a
GPUParticles3D emitting moths, ash or petals from the mesh's surface). The desk's Play and the Watch get the same in
three.js (an `onBeforeCompile` patch as the tailor's). Through the tape these are big, bright-edged and slow: they read
best of all her effects.

## 6. Contact deformation (candidate 5)

**What she showed.** "Pressing the skin" (11 Dec 2024) and "Ribbon" (12 Dec 2024, 670k views). Stated (80.lv): "the vertex
shader calculates the deformation of the thigh, with the deformation points synchronized to the ribbon's position", and
"the realistic deformation of the interior of the character's mouth" (13 Dec 2024). Replies asked how and said it couldn't
be real-time physics; it isn't: a vertex shader.

**How (inferred).** The ribbon's transform as uniforms; each vertex within a ring of it is pushed in along its normal by a
smooth falloff (the ring's width), with a bulge beside the ring (the displaced flesh), the normal recomputed from the
displacement's slope. A finger is the same with a point in place of the ring.

**What we have.** FLESH §5's soft bones (jiggle chains per soft region, collisions with the world and the arms) move the
flesh as a whole; nothing dents it. TRICKS §5's grab and struggle (hybrid IK: her hand on the player's arm, or the player's
on hers) leaves no mark where the hand holds.

**What to build.** `HSSkin`'s vertex stage takes up to four **presses** (a point or a ring, radius, depth, a bulge), set by
`play.gd` from a hand's or a rope's bone: the grab dents the arm it holds, a rope round a wrist, a gag, a hand over a mouth,
her fingers in the player's shoulder in the struggle. In the Studio, the static version for the tailor's bands
(candidate 1) and a press brush beside the sculpt's circles for a bruise's hollow. Small, and the single most convincing
thing a hand can do in a horror close-up.

## 7. The room that changes (candidate 6)

**What she showed.** "A shader that enables a neat real-time space distortion effect that makes it look like an entire
environment appears out of nowhere" (Nov 2022); "allows the artist to completely change the landscape's looks and
lighting in real-time" (Oct 2022; the learn.u3d.cn pack has a "simple scene-switching effect" from the same years);
"shader-based FX allows the artist to seamlessly shift between two different environments with distinct assets and
lighting" (Mid-Autumn 2024).

**How (inferred).** Both environments resident; a world-space mask (a sphere growing from a point, or a plane sweeping)
decides per pixel which is drawn (a discard on the losing side, a noisy edge), each lit by its own lights (Unity's light
layers); or a stencil portal. Nothing is stated.

**What we have.** Levels as scenes with their own light zones (`HSLightZone`: a room's box owning its lights by render
layers and cull masks, GODOT_LOOK §0), occlusion culling, the time of day's rig; TRICKS §1 and §3 (seams, immersion
tricks); the Director's moments and cutscenes.

**What to build.** A story word `morph` on a trigger or a moment (`{"morph": "hall_rotten", "from": "player", "secs": 3,
"edge": "ash"}`): a second dressing of the level's pieces (the same plan, another `look` per room, other props: the house
as it was, the house as it is), loaded alongside, every material of both wearing the mask as a global shader parameter
(centre, radius, noise), the two dressings' light zones on their own layers so each half is lit by its own lamps; the
player's eye in the middle sees the world change round them: behind their back if the morph starts behind them, or
rolling toward them down the corridor. A quick version for the desk swaps the room's `look` and props under a fade. The
horror use is plain (the room isn't the same when you turn round; a flashback laid over the present; the ending's house as
it really is) and it is the biggest build here: both halves resident doubles a level's memory, and the plan would want a
level's `variants` (a second dressing in the format). Through the tape the sweep's edge reads, so the two dressings must
differ at the metre scale (photoreal.md §2), not in detail.

## 8. Snow (candidate 7)

**What she showed.** "Instantly cover the environment with realistic-looking snow and customize its depth" (13 Nov 2022);
a URP mobile version, "very smooth" (Jun 2026); a sunlit winter scene with a frozen river (25 Jan 2025, an HDRP project).

**How (inferred).** A global parameter; coverage by the world normal's upness with a noise edge and a height (a vertex
offset where there is geometry to lift, else the normal flattened and the albedo whitened with a sparkle); accumulation by
raising the threshold over time; the mobile version drops the displacement.

**What we have.** `game.weather`: `clear` or `rain` (a level's own `weather` over it). `HSWet` wets floors by material;
`HSStreet.weather` turns the street's wear up and down; the street's wear atlas knows every flat patch's upright place and
its ledges (STREET_TEXTURING §1), which is exactly where snow lies.

**What to build.** `weather: snow`: an `HSSnow` layer on every outdoor surface (and under open windows) by world normal and
a noise height, whiter and rougher with a sparkle, a rim where it meets a wall, lying on the street's ledges by the atlas;
the kerbs, roofs, poles and wires; footprints and tracks the next step (a render-to-texture of where the player walked,
which her demo doesn't show). The sky and the ambient of `TIME_LOOK` go cold. A snowed-in house is a horror house, and a
winter chapter is a mood the games don't have yet. Through the tape snow is the best-reading surface there is: bright,
flat, big.

## 9. Fabric detail by mask and detail map (candidate 8)

**What she said (stated, and free).** In the Unity blog post (29 May 2023; the Chinese original on Zhihu, ~Jan 2021): fine
surface detail (a knit hat is her example) should not be baked ("due to the resolution limit ... these details should be
separated using Mask ID in the shader and added through Detail Map"); plan the UVs for the shader effects; split the
materials so each gets its own shader; test skin weights in the engine while animating ("adding details in the shader
directly is the way to go").

**What we have.** The export bakes each garment's fabric colour into the albedo on islands of its own, "with its metres a
second UV" (CHARACTER_STUDIO §3.1), and the creases into the normal map; Godot wears the glTF material as it comes
(GODOT_LOOK §7: the clothes' maps are the open item). Close up, a knit is a blur.

**What to build.** The clothes shader of candidate 2 reads the fabric's tile (the same `fabric.js` tile, drawn once per
fabric into the look plugin's `textures/` the way the skin's detail tiles are) on the metres UV as a detail normal and
roughness, so the knit, the rib, denim's twill and the sequins' discs read at any distance the tape allows, with the
albedo left to the colour and the prints. Small, because the UV is already there.

## 10. A CRT screen seen close (candidate 9)

**What she showed.** Her 2020 Retro Shaders challenge entry (Technically Art, issue 67, Sep 2020): "a postprocess effect to
mimic the surface of a screen as seen from close".

**What we have.** UltraVHS as the game's tape (`vhs.gdshader`, `game.vhs`: the camcorder's look over the whole frame,
measured against the plugin's numpy reference), and the little things' screens of static (`lifefx.gd`, IMMERSION.md).

**What to build.** A `crt.gdshader` on a screen's glass (the TV, a monitor, a security feed): the phosphor triads and
scanlines at their true size (a 0.3 mm pitch on a 14-inch tube), the glass's curve and reflection, the raster's glow
bleeding, a flicker, seen when the player leans in (`push`). Not the tape: the tape is what the game is seen through; this
is what a screen in the game looks like. Small, and the TV is a prop already.

## 11. Smaller candidates (10)

- **Heels by a slider** (adaptive heels, ~2024: "the heels are raised with a slider, and the shoes appear at a set
  height"; "pair well with her stockings"). Our shoes are cut from the body on MHR's flat foot. A `heel` on a shoe design:
  the foot's bones pitched (`pose.js` poses MHR's rig already), the shoe cut on the pitched foot, the body raised by the
  heel; the designer collection's boots and the uniforms' loafers would stand right. Small.
- **Eyes driving the eyelids** (14 Oct 2024: the eyes follow the cursor and "the eyelids adjust their movement" to the
  eye's rotation). Ours blink by morphs (`HSBlink`, EYELIDS) and look by bones; the lids don't follow the gaze. Couple the
  upper lid's height to the eye's pitch (a down-gaze lowers the lid, an up-gaze raises it a little): a few lines in
  `eye.gd`/`blink.gd` and the desk's `eye.js`. Small, and it is what makes a look-at read as alive.
- **Muscle simulation** (25 Oct 2023: a leg bending at the knee; a commenter's unanswered guess: bone rotation mapped to
  blend shapes). Not for us: the cast is clothed and the games are first person; FLESH's soft bones are the body motion we
  need.

## 12. What this would mean for the Godot side as a whole

A **clothes shader** in the look plugin is the thread through candidates 2, 3 and 8 (wet, moving folds, detail);
candidates 1 and 5 extend `HSSkin` (the painted layer, the presses); 4 and 7 add two surface effects (`dissolve`,
`snow`); 6 adds a level word. The order that pays soonest: 8 (small, the export has the UV), then 2 and 3's clothes half
(one shader with `wet` and the flexion), then 1 (the strain into the sheer, then hosiery as paint), 5, 4, and 10's two
small ones; 7 and 6 are a chapter's mood and a game's trick, built when a game asks for them. Each grows the format, the
runner, the check and STORY_FORMAT in one commit (CLAUDE.md's rule), with a check that pictures it (GDPEOPLE's and
GDPORTRAIT's pattern: the character in Godot beside the Studio's own render, measured).

## Sources

All read as search extracts (§0). 80.lv unless said otherwise.

- **Stockings:** https://80.lv/articles/check-out-this-impressive-nylon-tension-simulation-set-up-in-3d,
  https://80.lv/articles/real-time-unity-powered-stocking-shader-running-on-a-smartphone, the first post
  https://x.com/Sakura_Rabbiter/status/1497953376918593536 (27 Feb 2022), her 2019 scene
  https://developer.unity.cn/projects/5d74bb92edbc2a0b2dea3e8e, the learn.u3d.cn packs
  https://learn.u3d.cn/tutorial/sakura-rabbit-full-package and https://learn.u3d.cn/tutorial/sakura-rabbit-full-package-2
- **Wet clothes and rain:** https://developer.unity.cn/projects/5e2fa606edbc2a39a9fe6552 (wet stockings and clothes in
  Shader Graph, ~Jan 2020), https://80.lv/articles/unity-powered-dynamic-raindrop-decal,
  https://hitmarker.net/news/highly-realistic-dynamic-raindrop-decal-showcase-created-in-unity-517425,
  https://80.lv/articles/realistic-dynamic-raindrop-effects-in-unity (https://x.com/Sakura_Rabbiter/status/1867928291770003802,
  14 Dec 2024), https://80.lv/articles/highly-realistic-rain-shader-set-up-in-unity-6,
  https://80.lv/articles/sakura-rabbit-created-urp-version-of-rain-scene-using-huawei-phone
- **Wrinkles:** https://80.lv/articles/sakura-rabbit-demonstrates-real-time-wrinkles-in-unity,
  https://80.lv/articles/sakura-rabbit-shows-off-cool-real-time-wrinkle-effect-on-clothes-on-mobile-phone,
  https://80.lv/articles/3d-artist-showcased-adding-facial-wrinkles-in-real-time
- **Clothing change, the suit, the wings:** https://80.lv/articles/real-time-clothing-change-effect-made-in-unity
  (https://x.com/Sakura_Rabbiter/status/1589649542022336512, 7 Nov 2022),
  https://80.lv/articles/a-new-version-of-the-unity-powered-clothing-transformation-effect,
  https://80.lv/articles/see-how-clothes-change-in-this-smooth-trick-set-up-in-unity
  (https://x.com/Sakura_Rabbiter/status/1894992139769258391, 27 Feb 2025),
  https://80.lv/articles/this-unity-powered-shader-gives-gwen-stacy-a-venom-like-suit,
  https://hitmarker.net/news/impressive-shader-effect-in-unity-transforms-gwen-stacy-into-venom-like-suit-517831,
  https://80.lv/articles/new-mobile-ready-venom-inspired-reveal-effect-by-sakura-rabbit,
  https://80.lv/articles/outstanding-angel-wings-dissipation-effect-in-unity,
  https://80.lv/articles/2023-s-most-remarkable-projects-created-with-unity
- **Pressing the skin, muscles, the hand:** https://80.lv/articles/sakura-rabbit-demonstrated-impressive-real-time-mesh-deformations-in-unity
  (https://x.com/Sakura_Rabbiter/status/1866769867388682375, 11 Dec 2024; https://x.com/Sakura_Rabbiter/status/1867080010491891884,
  12 Dec 2024), https://80.lv/articles/testing-out-real-time-muscle-simulations-in-unity
  (https://x.com/Sakura_Rabbiter/status/1717229001322959341, 25 Oct 2023),
  https://80.lv/articles/beautiful-unity-6-real-time-hand-rendering-showcase
- **Scenes, snow, water:** https://80.lv/articles/real-time-space-transformation-in-unity,
  https://80.lv/articles/real-time-space-distortion-in-unity,
  https://80.lv/articles/real-time-magic-seamless-3d-scene-transitions-made-with-unity,
  https://80.lv/articles/a-global-real-time-snow-covering-effect-set-up-in-unity
  (https://x.com/Sakura_Rabbiter/status/1591792515161919489, 13 Nov 2022),
  https://80.lv/articles/sakura-rabbit-built-a-real-time-snow-coverage-shader-for-unity-urp-on-mobile,
  https://80.lv/articles/sweet-winter-environment-made-with-unity, https://80.lv/articles/check-out-sakura-rabbit-s-magical-automatic-paving-unity-effect,
  https://80.lv/articles/amazing-water-effects-for-unity-urp-on-mobile,
  https://80.lv/articles/this-enchanting-water-cross-section-was-created-in-unity,
  https://80.lv/articles/customizable-real-time-stylized-ocean-shader-created-with-unity,
  https://80.lv/articles/create-witch-s-bedroom-in-unity-using-sakura-rabbit-s-magical-assets,
  https://80.lv/articles/experimenting-with-zibra-ai-s-real-time-smoke-solution-in-unity,
  https://halisavakis.com/technically-art-issue-67-11-09-2020/ (the 2020 CRT entry)
- **Eyes, hair, face, heels:** https://80.lv/articles/a-highly-realistic-eye-shader-created-with-unity,
  https://80.lv/articles/new-eye-tracking-project-by-sakura-rabbit, https://80.lv/articles/a-real-time-hair-system-set-up-in-unity,
  https://80.lv/articles/experimenting-with-unity-6-s-new-hair-system,
  https://80.lv/articles/here-s-how-you-can-set-up-real-time-cloth-simulations-in-unity,
  https://80.lv/articles/check-out-this-high-energy-character-animation-made-with-unity,
  https://80.lv/articles/check-out-these-3d-heels-that-adapt-to-character-s-heel-height-in-unity
- **In her own words, and about her:** https://unity.com/blog/games/advanced-tips-for-character-art-production-in-unity
  (29 May 2023), https://zhuanlan.zhihu.com/p/344991995 (the Chinese original),
  https://80.lv/articles/breakdown-character-art-production-process-in-unity,
  https://80.lv/articles/a-collection-of-unity-powered-projects-by-sakura-rabbit,
  https://3dvf.com/en/sakura-rabbit-unveils-one-year-of-work-using-unity (17 Jan 2022),
  https://hitmarker.net/news/highly-realistic-real-time-renders-in-unity-2226602,
  https://www.163.com/dy/article/FLMHFLFO0526E124.html (Unity China's interview, ~2020),
  https://gamedevjelly.com/creators/sakura-rabbit/, https://sakura-rabbit.fanbox.cc/,
  https://www.patreon.com/SakuraRabbit, https://assetstore.unity.com/sakura-rabbit (the influencer page)
- **Open implementations of the techniques (not hers):** https://github.com/Kirkice/StockingShader (denier, a stretch map,
  the edge term; no licence), https://github.com/Blatke/Silk-Stocking-Shader-for-ME (Fresnel alpha, wetness; no licence),
  https://zhuanlan.zhihu.com/p/161705299 (HDRP Shader Graph stockings by Fresnel and stretch),
  https://zhuanlan.zhihu.com/p/635091152 (URP stockings with Substance and Unity files),
  https://blog.csdn.net/qq_42115447/article/details/102616272 (denier and a density map),
  https://www.cnblogs.com/jietian331/p/17061656.html (stockings and wet cloth), https://www.jianshu.com/p/e2776e912a85,
  https://github.com/soupday/cc_unity_tools_3D (a wrinkle-map system with flow maps, for the technique)

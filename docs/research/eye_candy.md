# Eye candy: the small things that make a game feel real, and a beam in the fog

The user (2026-11-08): "Anyway we could work on a better flashlight + level atmosphere system, you know when we put a
light in real life in the woods it's more like a beam in a fog, maybe have a fog level adjuster and dust particle
visible, before you do anything do eye candy research meaning the little visual things that make the game feel more
immersion and then work on this, include this system part of the tutorial too".

This note covers two things:
- **The beam, the fog and the dust** (§2): measured in Godot 4.7, with the design that follows from it.
- **The rest of the eye candy** (§3): what makes our games feel real, what the Look plugin already has, and what's
  missing.

It builds on:
- docs/GODOT_LOOK.md: the look's presets, the haze, the effects as nodes;
- docs/FLASHLIGHT_PLAN.md: the battery, the bulb's and the LED's curves, `beam_on`, characters who feel the light;
- docs/research/godot_lighting.md: what exists for Godot 4.7. It already lists SimplestGodRay3D as "cheap visible
  beams (the flashlight in dust, a window at dusk) where volumetric fog costs too much".

**How it was gathered.**
- About 25 web searches. Some sites don't open from the cloud session (docs.godotengine.org, forum.godotengine.org,
  gamedeveloper.com, remedygames.com), so **a quote is the search engine's extract of the page linked**, as in
  jump_scares.md. "(mine)" marks an inference.
- **The fog lab**: a night in the woods in Godot 4.7 here (lavapipe under xvfb, 960×540). It has 46 trunks, a black
  sky and an ambient of 0.05. The flashlight is the starter kit's (`guides/first_game/starter/player.tscn`):
  - a SpotLight3D with energy 3, range 14 m and a 24° angle;
  - angle attenuation 0.6 and shadows on;
  - held 18 cm right, 20 cm down and 10 cm forward of the eye.

  Measurements are the mean luma (0 to 255) of a small patch of the sRGB picture. The pictures are what a card
  draws. **The timings are a software renderer's, so they are relative only**: the user's card is the measure
  (RUN_LOCALLY.md).
- The sheet: `docs/godot_sheets/2026-11-08_fog_beam.jpg` (brightened 1.6× to read on a page).

## 1. What eye candy is, and its rules

1. **A detail weighs more where there are few.** Playdead on Limbo and Inside: "The fluorescent lamps seen throughout
   the game are quite lifelike in their behavior. As you might expect, aging tubes struggle to stay on … The
   sparseness of our environments make every detail that is there more significant." Our games are small rooms at
   night, so each detail is seen.
2. **Things that react make a world alive.** The Broken Roads devlog: "Even simple effects, such as having
   grasshoppers fly away when disturbed, help make a world feel alive". Its creatures react to torches and lamps.
   Game Informer and 80 Level make the same case: snow on Drake's clothes after a roll, props that "don't affect
   gameplay but make the world feel lived-in".
3. **Coherence.** "When visual and audio details conflict, the illusion can quickly break." For us:
   - a mote shows only where light reaches it;
   - a beam fades with its battery;
   - the fog swallows what the light can't reach.
4. **Restraint.** "Less is often more" for effects; polish "should enhance a solid foundation rather than mask a weak
   one".
5. **Darkness is lost information, not low brightness.** The level-design sources say:
   - keep silhouettes and landmarks readable;
   - keep the key, the switch and the note readable "when the room is dark or foggy";
   - a scene can feel dark from its contrast and specular highlights while being "pretty bright";
   - "pitch-black nights that force flashlight dependence" are a design problem.
6. **What players turn off**: motion blur, chromatic aberration and film grain, "a holy trinity of unwanted settings".
   One comment analysis gives 86% against motion blur and 75% against chromatic aberration, but those are shares of
   commenters, not a poll. PC Gamer's "always disable" list has motion blur and chromatic aberration. So: none of them
   on by default; the tape is the look a game chooses (docs/VHS.md).
7. **Banding in the dark.** Dark fog gradients band. The Godot forum has "Volumetric Fog Causes Light Rings/Banding
   When Scene Is Dark". Playdead's Inside "properly using dithering to get rid of distracting artifacts", with 8-bit
   TPDF dithering on the fog's output in Mikkel Gjøl's write-up. Our project has debanding on (`HSLook.PROJECT`). Any
   shader of ours that draws a gradient in the dark dithers it (the beam below jitters its samples per pixel and TAA
   settles them).

## 2. The beam, the fog level and the dust

### 2.1 Why a beam shows, and why it's faint from behind

- You see a beam because the air scatters some of the light toward your eye. Fog droplets scatter forward: the
  Henyey-Greenstein anisotropy `g` runs from −1 (all back) to +1 (all forward), and fog sits "pretty strongly
  forward".
- **Holding the light, you look along it**, so only the part scattered back comes to you. That part is small in
  forward-scattering air (mine, from the phase function), which is why a beam is easier to see from the side.
- Games hold the light off the eye's axis so its edge shows. The offset has its own trouble: a wall behind can shadow
  the beam (a Roblox developer). Forum advice: start a fog "a few studs in front of the player", so it doesn't sit on
  the lens.

### 2.2 What Godot 4.7 has (read off ClassDB here)

- **Volumetric fog** works in Forward+ only and is computed in a 3D grid of froxels.
  - Environment: `volumetric_fog_` density (0.05 default), albedo, emission, anisotropy (0.2), length (64 m), detail
    spread (2), GI inject, ambient inject, sky affect, temporal reprojection (on, amount 0.9).
  - Project settings: `volume_size` and `volume_depth`, both 64 by default (our balanced look sets 48 and 48), and
    `use_filter`, which "substantially blurs the fog".
- **Per light**: `light_volumetric_fog_energy` (0 leaves the light out and saves a little); `light_projector`, a cookie
  (shadows on).
- **FogVolume** (shapes ellipsoid, cone, cylinder, box, world) with a FogMaterial (density, albedo, emission, height
  falloff, edge fade, a 3D density texture) or a **fog shader** (`shader_type fog`: DENSITY, ALBEDO and EMISSION from
  WORLD_POSITION and TIME). A negative density takes fog away.
- **The depth fog** (the cheap kind): `fog_` mode, density, height, height density, depth begin and end, sky affect,
  aerial perspective.
- **The docs' cautions** (search extracts):
  - "moving FogVolumes and Light3Ds ghosting and leaving a trail behind them";
  - "brief dynamic lighting effects should set Volumetric Fog Energy to 0.0";
  - shadows show in the fog;
  - fog doesn't light other surfaces;
  - for visible beams on a dark scene, a density near 0.0001 with a light's fog energy in the hundreds or thousands.
  - A pull-request discussion reported a shadowed SpotLight3D's fog as "very faint".

### 2.3 Measured in the lab

**A. The balanced look's haze hides the flashlight's beam.** This is the beam in the air 6 m out, with the black sky
behind it, at the look's anisotropy (0.55):

| density | 0 | 0.009 (balanced) | 0.02 | 0.04 | 0.08 |
|---|---|---|---|---|---|
| beam | 0 | **0** | 0 | 8 | 19.4 |

**B. The anisotropy does it.** At a density of 0.03, from behind the light (the player):

| g | −0.3 | 0 | 0.3 | 0.55 (the look's) | 0.8 |
|---|---|---|---|---|---|
| beam | 84 | 43 | 18.7 | **3.9** | 0 |

- The look's 0.55 makes lamps' halos and windows read when you face them. From the holder's eye it removes about 90% of
  the beam that an isotropic phase (0) gives.
- Godot's anisotropy is one number for the whole fog, not per light.

**C. The light's own fog energy can buy it back**, at the balanced haze:

| fog energy | 1 | 3 | 6 | 12 |
|---|---|---|---|---|
| beam | 0 | 3.4 | 15.7 | 33.2 |

**D. A turn's ghost is short.** Turning 40° in 6 frames at density 0.03 and g 0.3:
- with temporal reprojection at 0.9, 29% of the beam is still where it was on the first frame after the turn, and under
  10% three frames later;
- at 0.5, or off, nothing can be measured.

The docs' warning is for fast lights; a flashlight swung hard smears for about 50 ms (mine).

**E. Godot's beam stays a glow, and finer froxels don't fix it.**
- At a density of 0.04 the froxel beam is a soft blob without an edge (the sheet, frames 2 to 3).
- The 90%-to-10% width of its edge at 5 m:

| | froxels 48 | froxels 128, no filter | hard-edged spot | the flashlight's cookie |
|---|---|---|---|---|
| edge, px | 103 | 101 | 63 | 89 |

- Froxels at 128 cost **9.5×** the fog's own time (+8.2 ms → +77.8 ms over a frame without fog, software renderer):
  8× the cells for an edge 2 px sharper.
- The softness is the light's own profile: the starter flashlight's angle attenuation 0.6 falls off from its middle.
- The fog didn't take the cookie's shape; only the lit surfaces did.

**F. A beam drawn by its own shader reads as a beam.**
- A cone hull round the light draws its back faces, so it's drawn with the eye inside it too.
- Along each view ray it integrates the light scattered toward the eye inside the cone.
  - **Equiangular samples** (Kulla and Fajardo 2012) crowd where the light is strongest; 24 a pixel, jittered per pixel
    and settled by TAA.
  - The ray stops at the depth buffer.
  - It uses the spot's own falloffs (Godot's formulas), a phase function, and 3D noise drifting on the wind for the
    air's structure.
- With a flashlight's **cookie** (a hot core, a faint ring and a dim spill) it is what a flashlight in fog looks like
  from behind it: a core running out from the hand, the ring, and the spill round it (the sheet, frames 6 to 8).
- It cost **+2.3 ms** on the software renderer, against +8.2 ms for the froxel fog at 48.
- It has no history, so it leaves no ghost.

**G. What the cone can't do: shadows.**
- The froxel fog shows the flashlight's shadows; the cone's shader can't read Godot's shadow atlas.
- From the holder's eye, a shadow lies behind its occluder along the view, so the occluder mostly hides it (mine). The
  hand's offset shows a sliver beside each trunk.
- Shadow shafts matter **seen from the side**: someone else's light, a lamp's cone, a window. The froxel fog and
  HSLightShaft keep those.

**H. Dust.**
- Motes are tiny billboards lit by the lights, so they show only where light reaches.
- With Godot's standard material they were **9×** denser in the beam than outside it (3.3 against 0.37 a thousand
  pixels, sampled every other pixel).
- But they glint by their phase. From behind the light, a forward lobe (g 0.55) gives a mote about **1/40** of what it
  shows looking toward the light (the HG numbers, mine). Motes in your own beam need **a back lobe**: flakes glint
  back. With 35% of a lobe at −0.35 they show in the beam.
- A weak light mustn't show them everywhere: the candidate's moon (energy 0.06) speckled the whole sky. Motes need a
  knee, a light level under which they stay dark. Real dust isn't seen by moonlight.

### 2.3b Realistic motes (the user, 2026-11-08: "The dust motes look too stylized, can you research on making better more realistic motes")

The first motes were round soft dots of one size, lit evenly, drifting by a sine wander: a camera's bokeh, not dust.
What makes real ones read:

1. **What they are.** Household dust is mostly flat skin scales and fabric fibres (lint), 1 to 100 µm; the ones seen
   in a beam are the bigger flakes and threads. Most dust by count is under 10 µm, invisible, and hangs in the air
   for minutes to hours. Shares of skin and fibre vary by source and home: consumer pages, not studies.
2. **Why they twinkle** (mine, from the flake models). A flat flake tumbling in the air sends the light
   back like a mirror only when its face lines up with the light and the eye: it flashes, goes dim, flashes again.
   Glitter is rendered the same way: a discrete set of mirror flakes (Jakob et al., "Discrete stochastic microfacet
   models", SIGGRAPH 2014; Zirr and Kaplanyan 2016; Deliot and Belcour 2023), each bright only within a narrow lobe.
   A fibre glints along its length where the light meets it square, as hair does.
3. **Their colour.** Particles over a micrometre scatter by Mie, "all colors equally": white or grey, the light's own
   colour, never the sky's blue (the Tyndall effect proper is the colloids').
4. **Seen by the eye, not a camera.** A camera at a wide aperture turns motes into soft discs (bokeh), and a film's
   dust is often that: "even the best-looking particles in those photos are out of focus". The eye focuses past them
   to what it's looking at: in the beam they're sharp points, and the ones a hand's width from the face aren't seen at
   all (mine; a VFX critique asks for soft motes, for a camera). In first person: points, faded out near the eye, never
   discs.
5. **How they move.** Brownian motion is microscopic. What you see is the air moving: convection, people, doors.
   Indoors that's about 0 to 10 cm/s still, 15 to 20 cm/s at most where many people are comfortable, a mean of up
   to 35 cm/s in an occupied zone. So motes drift slowly in coherent eddies, not jitter. The standard way is **curl
   noise** (Bridson, Hourihan and Nordenstam 2007): the curl of a smooth potential is a divergence-free flow, so
   particles swirl without bunching up or thinning out. Small ones settle very slowly.
6. **Sizes vary a lot.** Epic's dust tutorial sets the size "random non-uniform" over about 1 to 10. Many small and
   faint, a few big and bright (a power law).
7. **Shown by contrast.** "They need a dark surround and a hard beam"; backlit or sidelit they glow. In a lit room the
   same motes vanish (§2.3 H's knee).

**So the motes become:**
- **Flakes** (88%): a size from a power law (0.4 to 2.5 mm), each tumbling about its own axis at its own rate. Its
  light is a dim glow (the two-lobed phase, §2.3 H) plus a **mirror flash** when its face lines up with the light and
  the eye (`pow(|n·h|, shine)`).
- **Fibres** (12%): a thread 3 to 8 times as long as wide, drawn along its own axis as seen, glinting where the light
  meets it square.
- **Shape**: points with a Gaussian edge, never discs. Under a pixel and a half they grow, dimmed to keep their light
  (TAA). They fade out within half a metre of the eye.
- **Motion**: a curl-noise flow, two octaves of eddies about 1.5 m and 0.6 m across, at `stir` (3 cm/s, a still
  room's air), the atmosphere's wind on top, a slow settling, wrapped round the eye.
- **Colour**: the light's, with a touch of each mote's own (lint isn't white).
- **Where they show** (found tuning them, 2026-11-08). One light level can't tell a flashlight's beam from a lamp
  nearby: Godot's spot lights don't pack their light into the beam the way a real flashlight does, and a lamp at 1.5 m
  outshone the spill. So:
  - a mote inside an HSBeam's light is lit by the beam directly (the cone, cookie and falloff per mote);
  - the other lights reach it faintly above a knee of 2.

  Dust shows in beams and sunbeams, and a lit room stays clear. "A Unity asset uses collision volumes to brighten
  dust that passes through light rays" is the same idea.
- **Never blooming**: a mote's brightest pixel is capped under the look's glow (1.05). Specks that bloomed read as
  soft blobs, the stylized look again.

### 2.4 The design that follows

| Piece | What it is |
|---|---|
| **HSAtmosphere** (the fog level) | One node for a level's air. `fog` 0..1 (clear, dusty, haze, mist, fog, thick) mapped onto the fog's density, so it's one number to set by eye. It also holds the fog's colour, **ground mist** (a fog shader on a world FogVolume: thick low down, thinning with height, broken by noise drifting on the `wind`), `dust` and the beams' strength. `fog_to(level, seconds)` lets a moment roll the fog in or out. Its presets name the places: a clean room, a dusty room, a hazy night, mist in the woods, fog, a thick fog. The look's haze keeps its anisotropy (0.55) for lamps and windows; the atmosphere sets the density. |
| **HSBeam** (a light's beam in the air) | The cone's shader of §2.3 F, on any SpotLight3D: the flashlight by default, a car's lamps, a street lamp, a searchlight. It reads its light every frame (energy, colour, range, angle, attenuation, the cookie as its profile), so the battery's curve, a flicker and a dying bulb show in the air. Its density is the atmosphere's: the same haze, the same mist by height, the same noise on the same wind. The flashlight's own fog energy goes to 0: no double beam, no ghost. |
| **The flashlight's cookie** | A hot core, a ring and a dim spill to a soft edge (a reflector's beam: "hotspot, beam (corona) and spill"; an IES-style profile is "bands for rings, cores, gaps"). It goes on the starter's flashlight as a projector, its edge from the angle attenuation, and the beam reads it too. |
| **HSDust** | Motes in a box round the eye, riding a curl-noise flow of slow eddies with the wind on top: tumbling flakes that flash when a face catches the light, and threads of lint (§2.3b). They're lit by every light through a two-lobed phase with a knee, sharp points never discs, faded out near the eye. How many follows the atmosphere's `dust`. |

**Cost** (mine, to be measured on the user's card):
- The beam costs its pixels × 24 samples: a flashlight's cone covers 20 to 40% of the screen.
- The froxel fog stays at 48.
- The motes are one GPUParticles3D draw.

## 3. The rest of the eye candy

What makes our kind of game (small rooms and woods at night, first person, a flashlight) feel real, against what we
have. **Priority**: A is cheap and seen in every game; B pays off in some; C is optional.

### The air and the light

| Detail | Why | Have | Priority |
|---|---|---|---|
| **A beam in the air, a fog level, dust in the light** | §2: the user's ask | haze only; the beam invisible (§2.3 A) | **A**: HSAtmosphere, HSBeam, HSDust |
| **Ground mist, drifting** | woods, fields, a graveyard; the Silent Hill signature ("crucial … to the game's atmosphere") | no | **A**: in HSAtmosphere |
| **A flashlight's real beam** (core, ring, spill) | a reflector's beam; Unreal's answer for a horror flashlight is "an IES profile or a light function" | a soft spot | **A**: the cookie |
| **Light shafts through windows, dust in them** | | HSLightShaft (its dust in the card) | have |
| **Lamps with halos in the haze** | | the haze at g 0.55, glow | have |
| **Lamps that misbehave** (an old tube struggling on, a dying bulb, a buzz) | Playdead's tubes | HSFlicker presets, dying_bulb, faulty_neon | have |
| **Moving light** (a car passing, leaves, blinds, caustics) | | HSHeadlightSweep, HSPatternLight | have |
| **A TV lighting the room** | the screen's flicker on the walls in a dark room | the CRT's glass only, no light | **A**: HSCrtScreen drives a light by its picture's brightness |
| **Rain seen in the light** | drops "are difficult to see" unless lit (CMU) | HSRainBox is lit (blend_add, shaded) | have |

### Surfaces

| Detail | Why | Have | Priority |
|---|---|---|---|
| **Wet floors and puddles carrying the lights** | | HSWetSurface, HSPuddle (SSR) | have |
| **Water running down a wall, drips with rings** | | HSWallLeak | have |
| **Blood, drying** | | HSBloodSplat | have |
| **A pickup catching the light** | players miss dark interactables; a glint "that only appears in the beam" keeps darkness without a highlight UI; a hand icon on everything feels false | no | **A**: a glint on a pickup, bright only in the beam (`beam_on`) |
| **Eyes that catch the light** (eyeshine) | tapetum lucidum, an animal's eyes in the dark; horror games build on it (Eyes to Eyes: "you must illuminate it") | no | **A**: two glints on a character, lit by the flashlight's beam on her face (`beam_on`) |
| **Grime, stains, cracks** | "wall texture (cracks, dirt, tears etc.)" | the street's decals; the props' wear | B: decals for interiors |

### The lens and the eye

| Detail | Why | Have | Priority |
|---|---|---|---|
| **The tape** | a found-footage look, when a game chooses it | HSTape (camcorder, camhybrid, worn, nightmare) | have |
| **The iris adapting** | | HSLook.iris | have |
| **The beam lagging the look** | | the flashlight's own | have |
| **Vignette, chromatic aberration, motion blur** | players turn them off (§1.6) | off | none, or a setting |
| **Lens dirt and flare at a bright light** | | glow only | C |
| **Breath in the cold** | a cold night or a freezer; no source found; a known detail | no | C |

### Life

| Detail | Why | Have | Priority |
|---|---|---|---|
| **Moths round a lamp, flies** | a creature reacting to the light makes a world alive (Broken Roads) | no | **A**: a swarm orbiting a light, gone when it's off |
| **Dust shaken down** (a slam, steps above) | | no | **A**: a burst from the ceiling as a moment's effect |
| **Steam, smoke, a cup going cold** | | lifefx, HSPropFX | have |
| **Curtains and paper in a draught** | wind on cloth: "flags, curtains and foliage that move through shaders" | static | B: a sway shader for hung cloth |

### Darkness

| Detail | Why | Have | Priority |
|---|---|---|---|
| **Readable darkness** | silhouettes, landmarks and interactables kept (§1.5) | ambient floors per room; the look's AgX | a rule: every picture of the tutorial and the checks keeps a silhouette |
| **No banding** | §1.7 | debanding; our gradients dither | a rule |

## 4. What to build, in order

1. **The atmosphere** (§2.4): HSAtmosphere, HSBeam, the cookie, HSDust in the Look plugin and the starter flashlight.
   - It gets a check that measures it: the beam in the air at each fog level; its edge against the froxels'; the
     motes in the beam and not outside it, or under the knee; `fog_to` reaching its level in its time; and the beam
     following the battery.
   - Then into tutorial v2 (the user's "include this system part of the tutorial too"):
     - the hotel's haze and dust, thicker in the stairwell;
     - the flashlight's beam in it;
     - a moment that changes the fog.
2. **Eye candy A**:
   - the TV lighting the room;
   - a pickup's glint in the beam;
   - eyeshine;
   - moths round a lamp;
   - dust shaken down.

   Each is a small node and goes into the tutorial where it fits: the TV in 304, the key's glint, her eyes in the
   corridor, moths at the vending corner's bulb, dust when the fire door slams.
3. **Already there, and into the tutorial**: the tape, a light shaft, a pattern light, a puddle, a wall leak and her
   look.
4. B and C when a game asks.

## Sources

Quotes are search engines' extracts of these pages.

- Godot: [Volumetric fog and fog volumes](https://docs.godotengine.org/en/stable/tutorials/3d/volumetric_fog.html) · [its source](https://github.com/godotengine/godot-docs/blob/master/tutorials/3d/volumetric_fog.rst) · [Fog volumes arrive in Godot 4](https://godotengine.org/article/fog-volumes-arrive-in-godot-4) · [the spot light fog discussion](https://github.com/godotengine/godot/pull/53353) · [banding in dark fog](https://forum.godotengine.org/t/volumetric-fog-causes-light-rings-banding-when-scene-is-dark/115318) · [the 3D particle workflow](https://forum.godotengine.org/t/3d-particle-workflow-feels-overly-clunky/142310)
- Rendering: [Low Complexity, High Fidelity: INSIDE (GDC 2016)](https://gdcvault.com/play/1023002/Low-Complexity-High-Fidelity-INSIDE) · [Playdead's presentations](https://blog.playdead.com/articles/inside_presentations/inside_publications.html) · [Mikkel Gjøl, depth-aware upsampling](https://pixelmager.github.io/depth_aware_upsampling/upsampling) · [Ray marching fog with blue noise](https://blog.demofox.org/2020/05/10/ray-marching-fog-with-blue-noise/) · [Henyey-Greenstein phase function](https://wiki.krisyotam.com/content/wikipedia_en_all_nopic_2026-03/Henyey-Greenstein_phase_function) · [Mie scattering and fog](https://miepython.readthedocs.io/en/3.0.4/05_fog.html) · [Atmospheric scattering and volumetric fog](https://gamedeveloper.com/programming/atmospheric-scattering-and-volumetric-fog-algorithm-part-1) · [Unity HDRP, local fog's anisotropy](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@15.0/api/UnityEngine.Rendering.HighDefinition.LocalVolumetricFogArtistParameters.anisotropy.html) · [How Northlight makes Alan Wake 2 shine](https://www.remedygames.com/article/how-northlight-makes-alan-wake-2-shine) · [Silent Hill 2's fog in UE5](https://www.tweaktown.com/news/89021/silent-hill-2-remake-uses-unreal-engine-5s-lumen-for-ultra-creepy-fog/)
- Beams: [UE3 volumetric light beam tutorial](https://docs.unrealengine.com/udk/Three/VolumetricLightbeamTutorial.html) · [light beams in DirectX](https://gamedev.net/forums/topic/663480-how-can-i-implement-light-beams-with-directx-9-or-11) · [Faking volumetric lights (The Wonhon)](https://www.indiedb.com/news/faking-volumetric-lights-july-30-2019) · [a flashlight's beam profile modelled](https://sites.google.com/view/map-of-flashlights/description) · [a flashlight texture in Unreal](https://forums.unrealengine.com/t/how-to-assign-texture-to-flashlights/316980) · [IES procedural beams](https://superhivemarket.com/products/ies-procedural-beam) · [flashlights in games](https://www.candlepowerforums.com/threads/flashlights-in-games.480406/) · [first person and an offset flashlight](https://forums.unrealengine.com/t/question-about-flashlight-and-first-person-view/389205) · [Hands-free handlamp (TV Tropes)](https://tvtropes.org/pmwiki/pmwiki.php/Main/HandsFreeHandlamp) · [Flashlight for horror games](https://devforum.roblox.com/t/flashlight-for-horror-games/318440)
- Dust and rain: [particles only in light shafts](https://forums.unrealengine.com/t/is-there-any-way-to-make-particles-seen-only-in-sun-light-shafts/303681) · [dust motes in film](https://melies.co/cinematic-techniques/atmosphere/dust-motes) · [Light and water drops (CMU)](https://ri.cmu.edu/?p=7263) · [a flashlight and rain trails](https://devforum.roblox.com/t/spotlight-illumination-of-trails/1560405)
- Eye candy and design: [Playdead, The Weight of Detail](https://blog.playdead.com/articles/the_weight_of_detail/weight_of_detail.html) · [Breathing life into our environments (Broken Roads)](https://brokenroadsgame.com/dev-blog/breathing-life-into-our-environments) · [When little details make a big difference (Game Informer)](https://gameinformer.com/b/features/archive/2013/10/30/when-little-details-make-a-big-difference.aspx) · [Immersive details (80 Level)](https://80.lv/articles/the-importance-of-immersive-details-and-easter-eggs-in-games/) · [Atmosphere in games, visuals](https://www.gamedeveloper.com/art/atmosphere-in-games---part-2---visuals) · [Visual polish survival guide](https://www.wayline.io/blog/looks-good-enough-lie-visual-polish) · [Toy Story 4's dust and cobwebs (Pixar)](https://research.pixar.com/docs/2019.SiggraphTalks.CL.pdf) · [The clever trick behind wind in games](https://production-blue.amara.org/videos/N7O3UPzHw9AQ/info/the-clever-trick-behind-wind-in-games) · [Four parameters to animate environmental elements](https://devbytes.co.in/news/four-parameters-to-animate-environmental-elements-in-games)
- Darkness and horror: [The Level Design Book, darkness](https://book.leveldesignbook.com/process/lighting/darkness) · [a horror game on a small budget: lighting and fog](https://www.positioniseverything.net/make-a-convincing-horror-game-on-a-small-budget-lighting-fog-and-smart-asset-choices/) · [lighting in horror games (Bloody Disgusting)](https://bloody-disgusting.com/news/3227846/horror-declassified-a-look-at-lighting-in-horror-games/) · [Silent Hill's fog](https://blog.blog.wordpress.arktimes.com/?p=15145) · [Amnesia: The Bunker's dynamo flashlight (GamingBolt)](https://gamingbolt.com/amnesia-the-bunker-review-and-then-the-darkness) · [the Bunker (MP1st)](https://mp1st.com/reviews/amnesia-the-bunker-review-hide-and-dont-seek) · [eyeshine in a toad swamp](https://paigemanley.myportfolio.com/toad-swamp) · [Eyes to Eyes](https://sarbatore.itch.io/eyes-to-eyes) · [Creatures](https://2shy2shine.itch.io/creatures)
- Settings: [Graphics settings every gamer turns off](https://leveluptalk.com/news/graphics-settings-every-gamer-turns-off/) · [Which graphics settings should I always disable (PC Gamer)](https://www.pcgamer.com/which-graphics-settings-should-i-always-disable) · [Assassin's Creed Mirage and chromatic aberration](https://www.ggrecon.com/articles/assassins-creed-mirage-players-irritated-by-chromatic-aberration-settings/)

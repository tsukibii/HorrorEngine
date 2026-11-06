# The street builder goes outdoors: paths, steps, rivers, banks, hills and foliage (the plan)

The user (2026-11-06, the branch `street-nature`): "For street builder I want a new more nature park update ... using
our standard for realistic trees and foliage and streets build tools that let you build the following styles. Create
a plan and then your acceptance criteria is being able to re-create 1:1 framing/shots in our style of each of the
photos above, note this includes rivers too, the river doesn't need to be moving or anything (we will later create a
shader for it in Godot, not part of this branch though). Try make sure you can do accurate 1:1s so create foliage,
fences, stone steps that are needed. Go through it image by image, we are trying to do the 1:1 recreation similar to
how we did the first street app one."

The first one was the Shibuya lane (docs/STREET_BUILDER.md §7): the photo's camera measured from the picture, the
scene placed by casting the photo's pixels through that camera onto the ground, pins holding the shot to the photo,
and STREET failing when it drifts. The five photos here are the same job in a park, on a hillside and by two rivers.
Everything new is the street's own words (`street.json`, built by `street-gen.js`, drawn by `street3.js`, placed in
the page), so a street drawn any way builds and exports as before. The checks: STREET builds every new kind and holds
each street's shot to its pins; STREETPAGE draws a river.

## 1. The five photos, image by image

**1. Timber steps up a garden (550 x 734, portrait, sunny, dappled).** Landscape-timber (railway-sleeper) steps
climbing away from the eye, each riser one timber with a steel strap and bolts at each end, the treads soil and
gravel held by the next timber; ornamental grasses spilling over both sides (a fountain of fine arching, variegated
yellow-green blades: Japanese forest grass and a sedge), stiff bronze-striped sword leaves at the top left (a flax),
a black bell-shaped path light on a shepherd's hook at the right, bare soil and a creeping succulent at the right
foot, a dead leaf or two, shrubs and trees overhead closing the sky. The eye is low, about a metre over the bottom
step, looking up the flight; a wide-normal lens.
Needs: a road of kind **steps** with `tread: "sleepers"` (its rise and run from the photo: about 17 cm and 70 cm);
**banks** rising beside it (the slope the steps cut into); cover **soil** at the right; the things **belllamp** and
**plant**; the foliage props **hakone grass** (variegated), **sedge**, **flax** and a **succulent mat**; a canopy of
real trees over it (the camphor and the zelkova, `*_real`); the `day` light.

**2. Stone steps up a shrine hill (601 x 900, portrait, bright overcast).** A long flight of irregular stone slab
steps between two banks of moss and ferns, a round-timber post-and-rail fence (two rails, bolted) coming down the
right side and turning at the bottom, a low dry wall of mossy boulders at the bottom right, a red-and-white paper
lantern and a white notice board at the top, trees leaning in from both sides. The eye about 1.4 m over the lower
landing, tilted up about 12 degrees; a normal lens.
Needs: **steps** with `tread: "stone"` (slabs 3 m wide, each its own ragged front, mossed); **banks** steep and
mossed (cover **moss**); the fences **lograil** (following the steps and the ground) and **stonewall** (a dry wall of
lumpy stones, moss on top); the things **chochin** (a paper lantern on a post) and **signboard**; the foliage props
**fern** (a crown of arching fronds) and the **moss tuft**; trees (`cedar_real`, `camphor_real`).

**3. A river town from above (1200 x 673, overcast).** A wide river (about 40 m) in a gorge, white water over rocks,
a steep wooded hillside filling the left half (a broadleaf canopy down to the water), a red arched bridge across it
in the middle distance, the town along the right bank (tiled houses, a few blocks of flats, a tall white tower far
off), green mountains closing the valley in haze. The eye about 25 m over the water (from a higher bridge), looking
down the river about 15 degrees; a moderately wide lens.
Needs: a road of kind **river** (width 40, `rocks` and `rapids` on it); **hills** (the near hillside, the far
mountains: big bumps and ridges in `terrain.hills`, a far ground grid to carry them); the **forest** cover and a
**canopy scatter** (lumps of crown over the hill, real trees at the water's edge); the **bridge** thing, `kind:
"arch"`; the town by Fill (house, apartment, shop, tower styles; a road along the bank); the **overcast** time with
its haze.

**4. A mountain-town stream (1600 x 1153, broken cloud).** A stream 8 m wide running away between grass banks: on the
left a stepped concrete block revetment with a lane on top (a walker's path), on the right a rough grass bank with
boulders and houses behind it, a blue steel girder bridge with a blue railing crossing 80 m off, a village of low
houses beyond it, utility poles and wires both sides, forested mountains all round, a bare ridge at the top left.
The eye about 6 m over the water (another bridge), looking down a little; a normal lens.
Needs: **river** with `banks: [{kind: "concrete"}, {kind: "grass"}]` (the terraced block revetment as geometry under
the `blocks` pattern, the grass bank with its boulder toe: **rock** scatters), **path** on top of the left bank,
**bridge** `kind: "steel"`, Fill for the village (houses with tiled and metal roofs), poles with wires (there
already), **hills** with the `forest` cover, the foliage props **meadow tuft** and **reeds** scattered on the banks,
the `day` light with cloud.

**5. A park brook (800 x 530, sunny).** A small brook stepping down over river stones between two mown-grass banks,
a dark-stained timber footbridge (a deck on posts, a two-rail balustrade) crossing it 12 m off, a thick tree trunk at
the right edge, a woodland behind. The eye low (0.8 m), looking slightly down at the stones; a normal lens.
Needs: **river** 1.2 m wide with `drops` (its level falling at each cascade) and a **rock bed** (`banks: rock`,
stones along both edges, a lip stone at each drop), the cover **grass** (mown: a short-grass pattern), **bridge**
`kind: "wood"`, a trunk (`camphor_real` or a bare `tree` thing), trees behind (`zelkova_real`, `cherry_real`), the
`day` light.

## 2. The format (street.json), new words only

```
roads: [{ ..., "kind": "road|path|steps|river",
          path:  "surface": "gravel|soil|stone|concrete|grass", "width"; no kerbs, no pavements, no lines
          steps: "tread": "sleepers|stone|concrete", "rise" (m a step), "run" (m a tread), "width"; climbs `z`
          river: "width" (the water), "depth", "rocks": {"every", "size", "seed"}, "rapids": [{"at", "len"}],
                 "drops": [{"at", "h"}] (a cascade), "banks": [left, right] (below)
          any:   "banks": [{"h", "w", "kind": "grass|soil|moss|concrete|stone|rock"}, {...}]
                 (the ground beside it rising h metres over w metres: a cutting's sides, a river's banks) }],
terrain: { "cell": 1 (the ground grid near the street), "far": {"r": 1500, "cell": 40, "cover": "forest"},
           "cover": "grass" (the ground's slot; or [{"kind", "at", "r"}] patches), "drop": the grid's offset,
           "hills": [{"at", "r", "h"}, {"ridge": [[x, y], ...], "r", "h"}], "noise": {"amp", "scale", "seed"} },
things:  rock {w, d, h, seed}, bridge {style: wood|steel|arch, w (span), d (width), deck (above what's under it), h (rail), piers},
         belllamp, chochin, signboard {text}, plant {w, h, prop}  (and tree, as before)
fences:  lograil, stonewall
scatters: [{ "id", "prop": "props/<recipe>" (or a list), "kind": "plant|rock|canopy", "along": <road id>,
            "side": -1|1|0, "off": [near, far] (m from its edge), "from", "to" (m along), "every", "jitter",
            "size": [min, max], "seed" }  or  { ..., "at": [x, y], "r", "density" (a m²) }]
time: "overcast" (with day, dusk, night)
```

The ground is one function (`terrain(S).ground`): the roads' heights blended as before, each road's banks added
beside it, the hills added where the roads let go (fully `blend` metres from any road's edge), the noise over it.
The drawn grid is fine near the street (`cell`) and grows coarser out to `far.r`, one grid with no cracks, its cover
by cell. Everything stands on `surface()` as before: a river's water, bed and banks are its own piece.

## 3. The order of work (a step a commit, pushed)

1. This plan.
2. `street-gen.js`: road kinds path, steps, river; banks; `terrain` (hills, ridges, noise, cover, the far grid); the
   new slots. STREET builds each, the ground follows (a bank rises beside a path, a river's water lies under its
   banks, steps climb their rise).
3. `street-gen.js`: things rock, bridge, belllamp, chochin, signboard, plant; fences lograil, stonewall; scatters
   expanded at build; colliders for the Godot export. STREET builds each.
4. The page (`street.js`, `street3.js`): Path, Steps, River in the palette, their inspectors, the terrain section,
   scatters; the patterns (grass, moss, soil, stone, water, forest, sleepers), the overcast sky; scattered props
   drawn and exported. STREETPAGE draws a river.
5. The prop generator (`families/tree.py`): blades as bent strips, not flat cards; kinds hakone, sedge, flax, reeds,
   meadow, fern, succulent, moss tuft; recipes; made with Blender's module and put in the library (PROPGEN ok).
6. The five streets, one at a time: the camera measured from the photo, the scene placed through it, pins, the shot
   rendered beside the photo (`python tools/street.py shot <name>`) until it sits on it; STREET holds the pins.
7. Docs: STREET_BUILDER §7d, PROPGEN §18, CLAUDE.md's table, DECISIONS, CONTINUE; the sheets.

## 3b. What came out (the same day)

Built as planned (STREET_BUILDER §7d has the whole of it): the road kinds with banks (`flat` added: a stream's grass
strip before its revetment), widths that change along a path or river, the terrain, the things and fences, scatters,
the blade plants, and the five streets. Two tools made the matching tractable: `shotfit.mjs` solves a shot's camera
from its pins (Nelder-Mead; hold any of x, y, z, yaw, pitch, vfov) and casts a pixel through the shot onto the ground
or a plane, so a scene is placed by the photo's pixels once the camera is known from what can be measured (a timber's
strap tops, a fence's posts). Godot's check (GDSTREET) then found the mountain town's houses standing in the terrain's noise and on the road behind them: a bank now holds its level to its end, and `flats` (areas held level) carry a town's floor. Lessons (docs/LESSONS.md): fit the camera from measurable things only, then cast;
a feature's height assumed wrongly (a bridge's deck over a bank, a post's height) moves the whole camera; a pole turned
along its wires puts them in one line.

## 4. Acceptance

- Each of the five streets has a shot `photo` framed as its picture (the picture's own aspect), with at least six
  pins on things that can be measured in the photo (a step's edge, a post's foot, a bridge's end, the water's edge),
  landing within STREET's tolerance (2% of the frame's height on average, 4.5% at most), and the drawing beside the
  photo reads as the same place: the same things in the same places at the same sizes, in the street builder's own
  low-poly style with the realistic foliage standing in the plants' places.
- The photos stay out of git (`refs/`, as the Shibuya lane's): paste each into its shot (Photo… or Ctrl+V) to see the
  two together; `docs/street_sheets/` keeps the drawings.
- STREET, STREETPAGE and PROPGEN ok; the Godot export of each street imports (GDSTREET) with its colliders.

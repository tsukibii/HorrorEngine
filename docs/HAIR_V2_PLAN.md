# Hair editor v2.0: hair grown from pores, shaped by sliders (the plan)

**Built** (2026-11-12): what's there, how it works and what differs from this plan is `docs/HAIR_V2.md`. This file
stays as the plan it was built from.

The user (DECISIONS 2026-11-11, after the very last), with five reference pictures: *"Analyse our character studio hair
creator, I really love how I can make the hair and it looks really good in godot but there are often small gaps etc,
can you make a new tab called hair editor v2.0, instead of me having to create the strands, add pre defined hair pores
all around the head and sliders I can adjust to change the shape. Aim to be able to re-create all the hair styles in
the images provided. Maybe vary the hair line pore shape so we can get slight variations (this should be a dropdown),
your goal is to be able to recreate each hair in the image 1:1 and preview it in godot to make sure it looks good ...
(the hair maker shouldn't exist in the current hair tab, should be a full on new tab like clothes etc). Try make it in
a way where you can do pigtails, tied up hair, curly long hair etc ... + more (more traditional male ones, balding,
long) ... don't make the hair too much longer than shoulder height as this may cause clipping with clothing later.
Come up with the detailed plan first ... then ask me to start on implementation."*

**Designed, not built: waiting on the user's yes.** Progressive: the salon (the Hair tab), its hairstyles and every
character's baked hair stay exactly as they are. The new editor is a new tab, new files and one new field on a
character.

## 0. In short

    1. pores on the scalp         which are alive: the hairline (a dropdown), thinning
    2. a direction for each       the parting, the crown, the fringe, ties
    3. a hair grown from each     comb, lie, fall: in layers, off the body; no simulation
    4. cut                        by length, or to a line
    5. texture                    clumps, waves, curls, strays
    6. cards                      one small lock a pore; coverage counted, thin places filled
    7. the salon's bake           shell normals, occlusion, strand numbers: as now
    8. Godot                      HSHair, as now; tails swing on HSJiggle's bones

- Hair grows from a **fixed set of pores** spread evenly over the scalp, so there is hair everywhere a head has hair;
  which pores are alive is the **hairline** (a dropdown of shapes, a few sliders) and the **thinning** (balding).
- Nothing is drawn by hand. **Sliders** say where it's parted, which way each part is combed, how long each part is,
  how the cut line runs, how much it lifts and how full it is, straight to wavy to curly, the fringe, the ties.
- Each hair is **traced, not simulated**: combed over the head, laid on the hair below it, falling where the head falls
  away. Layers are in order by construction, so cards don't cross and gaps don't open; coverage is counted and anything
  thin is filled before you see it.
- Out come the same **cards with the same bake** as the salon's (the part that already looks good in Godot), so Godot
  wears it with no new shader. Tails get bones and swing there.
- It lives in the Character Studio as its own tab, **Hair editor v2.0**, between Hair and Clothes, drawn on the
  character in the Studio's own view, saved with the character as a handful of numbers, made again whenever the head,
  the body or the clothes change.

## 1. What there is now: the salon, analysed

**How it works** (docs/SALON.md): a hairstyle is a few dozen *locks* placed by hand (a strand, a sheet from a root line,
a bundle), each a few control curves the guides are made from (`salonlib.js` `evaluate`: 24 points a guide, kept off a
collider, laid over the hair below by Layer by height). A guide is a card with a strand atlas (`hairtex.js`). The bake
(`salon.js` `buildBake`, `finishCards`, `hairvolume.js`) puts every card of the hairstyle in a density grid with the
head solid and writes shell normals, strand tangents, an occlusion and each strand's numbers; Godot's HSHair
(`hair.gdshaderinc`) draws that as soft dithered strands with two highlights and light through from behind
(GODOT_LOOK §5e). The Character Studio wears the baked file and its export carries it.

**What's good, and kept as it is:** the look. The atlas, the bake's volume data, the hair shader in Godot, the export's
path. That is why hair "looks really good in Godot", and v2 feeds the same pipeline.

**Where the gaps come from** (read in the code and the checks' own numbers):

1. **Roots are only where a lock was put.** The presets cover a head with six or seven rows of sheets, each 40° to 45°
   of the head wide (`salonpresets.js`). Between two rows the scalp is covered only by the row above lying over it:
   lift the roots, look from above or behind, and skin shows. SALON's own check has the long cut covering 88% of the
   scalp before padding. Hand-placed hair is sparser still.
2. **A card is see-through toward its tip** (the atlas's coverage runs from 0.69 at the root down to 0.05 and then
   nothing), so one layer never hides what's behind it. Where fewer than two layers overlap there's a gap, and
   nothing counts layers.
3. **A card's strands scale with its width**: every card shows the same 0.3 of the atlas, so a wide sheet has fat
   strands with wide holes between its clumps, and a narrow one fine strands.
4. **The cures are patches, by hand**: the darkened scalp (a flat colour that reads as a painted cap at the hairline and
   the parting), the cover (the parting's Y's), the padding (cards on a smoothed hull), Thicken, Layer by height. Each
   is a step and a judgement; none removes the cause.
5. **Gravity finishes the presets**, and a fall undoes the shape it started from: fans on the shoulders, cards that
   slide and cross ("hair that pierces the outer layer after a fall still shows as a card", GODOT_LOOK §5e).
6. **The head is rays from the skull's middle** (`Collider`): fine on the scalp, but nothing can go behind an ear and
   hair by the cheeks stands off the face (LESSONS: collide hair with the skin, not a star-shaped head).
7. **Nothing swings in Godot**: the export bakes a swinging lock still and skins it to the body's nearest bones. (Animal
   ears do swing there since 2026-11-10: bone chains for HSJiggle. Tails will use that.)

**Not the old Hair tab again.** The Studio's first hair was procedural too (`hair.js`, scrapped 2026-10-23,
docs/research/hair.md): 160 to 900 wide cards, one growth rule a style, lit like plastic, then a wig simulation that
undid the rules. What's different now: thousands of pores that ride the mesh, real combing (parting, crown, fringe,
ties), layers by construction, no simulation after, the salon's bake and Godot's hair shader (neither existed then),
and coverage that's measured.

## 2. The five pictures, taken apart

The pictures stay on the user's side (not in git: they're other people's renders); this is what each asks for.

| # | What it is | What the editor needs for it |
|---|---|---|
| 1 | A jaw-length sleek bob. A middle parting with the skin showing along it; the top lying flat from the parting; a bell that hangs clear of the neck; blunt ends, a little uneven, turned slightly in; two thin strands in front of the ears; a few stray hairs on the outline. Black, a soft sheen | a middle parting with a width; hair lying flat; a one-length cut at a height; ends that turn in; face-framing strands; strays |
| 2 | Low twin tails in red ties, falling in front of the shoulders, their tips thinning. Over them a short layered cap: a wispy side-swept fringe to the brows, side layers to the cheeks over the ears. Dark brown | two ties low behind the ears; tails over the front of the shoulders; a tie as an object with a colour; what's left out of the ties with its own lengths; a swept fringe; layers |
| 3 | Shoulder-length loose waves from a side parting. Lift at the roots, the big side swept across the top; S-waves from eye level down, the ends curling; clear clumps, many stray hairs. Soft black | a parting moved to a side; root lift and volume; waves (size, length, where they start) that hold together by clump; curled ends; strays; layers |
| 4 | A short boyish cut: a long fringe swept across the forehead from a side parting, a textured top with volume, short sides and nape, the ears clear. Dark brown | lengths by part (top, fringe, sides, nape); a sweep angle; lift and bend for short hair; sides that taper; pointed tips |
| 5 | A chin-length rounded bob with no parting (it falls from the crown), thin see-through bangs to the brows, the ends curled under, the ears covered. Black roots into brown lengths | combing from the crown's whorl; a fringe by density; ends curled under by a radius; a round outline; a root colour into a length colour |

And "more": men's traditional cuts (side parting with short back and sides, crew cut, buzz cut, slicked back,
two-block, middle-part curtains), balding (receding temples, a thinning crown, bald on top with hair round the sides,
a shaved head's shadow), long (to the collarbones, straight and wavy), tied up (ponytails, buns, half-up), and for
our games a horror set (long hair over the face, unkempt, wet). §8 lists them.

## 3. The design

### 3.1 The pores

- **One fixed set for every character**: about 4,000 points on MHR's scalp, made once by a tool and kept in the
  project (`Content/Studio/Hair2/pores.bin`: the triangle each sits on, where on it, its place on the scalp's chart,
  its rank). Evenly spaced (Poisson-disk by sample elimination), the two sides mirror images. Measured on MHR's base
  head: the scalp is 679 cm² over 1,838 triangles; a spacing of 6 mm is about 1,800 pores, 7 mm about 1,300, 4 mm
  about 4,000.
- **They ride the mesh**, each on its own triangle, so they sit right on any head the Studio makes (a fitted face, the
  sculpt, a child of eight, an ogre) with no frame to place them by (LESSONS: the salon's hair is placed by a frame
  that the chin is in). Hair sizes with the head.
- **Ranked**, so the first N of them are evenly spaced too: the Density slider takes more or fewer of the same pores
  (light 600, medium 1,300, full 1,800, rich 2,600) and nothing reshuffles when it moves.
- **The chart**: every pore knows where it is on the scalp as an angle round the head and a distance down from the
  top. Hairlines, partings, the crown, the fringe's band and the parts (top, sides, back, nape) are all drawn on that
  chart, so they mean the same on every head.
- **Show the pores** draws them as dots on the scalp, coloured by what they do (fringe, top, sides, back, in a tie,
  switched off), with the parting's line and the crown's point. What you see is what grows.

### 3.2 The hairline, a dropdown; and thinning

- **Hairline** (dropdown): *Soft round* (the default), *Straight*, *High forehead*, *Low*, *Widow's peak*, *Heart*,
  *Square (men's)*, *M-shape*, *Receding I, II, III*, *Uneven*. Each is the scalp's edge as a curve on the chart; the
  pores outside it are off. Changing it only switches pores on and off: the rest of the hair doesn't jump.
- **Its sliders**: Height, Temples (how far they go back), Peak, Sideburns (none to long), Nape (height; straight,
  round, V), Irregular (a real hairline wobbles), **Soft edge** (the last centimetre thins out into short fine *baby
  hairs* instead of ending in a line).
- **Thinning** (dropdown and Amount, Size): *None*, *Crown*, *Top*, *Front*, *Horseshoe* (bald on top, hair round the
  sides and back), *All over*. A pore is alive by its own fixed random number against the density there, so thinning
  is gradual and the same every time.
- **A variation** button (the seed) for slightly different edges of the same shape.

### 3.3 Which way it's combed

Each pore gets a direction along the scalp and a lift off it, put together from a few things on the chart and
smoothed between neighbouring pores (never across the parting):

- **The crown** (the whorl): hair turns out from a point behind the top, with a swirl. Alone it gives the natural fall
  of a cut with no parting: forward into a fringe, down the sides and the back (picture 5, a man's crop).
- **The parting**: *None*, *Middle*, *Left*, *Right* (and *Zigzag*); how far to the side, how far back it runs, its
  angle, and its **width** (the skin that shows along it: picture 1). Pores each side comb away from the line.
- **The top**: falls naturally, combed to a side, combed back (slicked back; a quiff by the front's lift), forward.
- **The sides**: down, back, forward. **The ears**: covered, clear, or tucked behind (each side).
- **The fringe's band** combs forward and down, turned by its Sweep (pictures 2 and 4), or split (curtains).
- **A tie** pulls its pores' hair along the head toward it (§3.8).
- **Hold**: how far the comb reaches before gravity takes over, natural to gelled.

### 3.4 Growing a hair: comb, lie, fall

Each hair is traced from its pore in short steps (24 points kept, closer near the root, as the salon's guides):

1. It **leaves the skin** at its lift, the way it's combed.
2. **Comb.** Where the head is flat enough to hold hair (as friction would: under about 35° of slope) it goes the
   combed way; where it's steeper, or in the air, gravity takes over. Hold stretches the comb's reach.
3. **Lie.** Over the head it's laid at a height above the skin that grows with how far it has come from its root, up
   to the Volume there. Hair from further up has come further, so it lies over the hair that grows below it: **the
   layers are in order by construction**, nothing to sort, nothing crossing. It's laid down to that height, not only
   kept out (LESSONS: hair has to be laid down), and the root rises out of the skin on the way.
4. **Fall.** Past where the head falls away it hangs: straight down from where it left, at its layer's distance, so a
   bob stands off the neck as a real one does; the last few centimetres turn in or out by a radius; all of it kept
   off the neck and shoulders.
5. **The rules live in the tracer** (LESSONS: a simulation undoes what the generator promised): no hair over the eyes
   unless the fringe says so, the ears as chosen, the length cap, which pores a tie takes. **There is no fall
   simulation afterwards**: what's traced is the hair. One light pass eases neighbours toward each other so no hair
   crosses the one beside it, with the same rules in it.

**The body is a distance grid**, not rays from the skull: the real skin of the head, ears, neck and shoulders (3 mm
cells round the head), made once a body. Hair can pass behind an ear and lie along a cheek. The clothes the character
wears can be put in the same grid (**Keep off the clothes**: ends rest on a collar instead of going through it), which
is the answer to clipping beyond the length cap, and the hair is made again when the outfit changes.

### 3.5 Length and cut

- **Lengths by part**: Fringe, Top, Sides, Back, Nape, blended where parts meet.
- **The cut**: *by length* (every hair its own length: layered, shaggy, short cuts) or *to a line* (every hair cut
  where it crosses a height: one-length bobs). The line has a Height (ears to collarbones), a Tilt (longer in front or
  behind: an A-line), a Round (a U or a V at the back). **Layers** blends the two. **Graduation** shortens toward the
  nape (a stacked bob). **Undercut** and **Fade** clip the sides and nape short up to a height (two-block, tapered
  sides).
- **Ends**: Blunt to Wispy (a blunt end stops before the atlas's strands thin out; a wispy one runs through them),
  Thin out (some hairs cut shorter), Uneven.
- **The cap** (the user's answer, DECISIONS 2026-11-11, the go: "let it reach the chest ... we can adjust always with a
  slider the length"): the length sliders end at the chest, for loose hair and tails alike; the styles' own lengths
  stay about the shoulders (measured on MHR's base body: the shoulders' tops are about 25 cm under the crown, 3 to
  4 cm under the chin's height).

### 3.6 Shape and volume

Root lift; Volume at the crown, the sides and the back (how thick the hair lies: flat and sleek to full); Width at the
jaw (the bell); Ends turn in or flip out, and their radius (picture 5's curl under); Asymmetry. For short hair: Lift
(standing to lying) and Bend (how soon it lies back down), which between them make a crew cut, a textured top or a
flat side parting.

### 3.7 Texture

Applied to the traced hair, in this order (Blender's own order for hair: clump, curl, noise):

- **Clumps**: pores gather in small groups round a guide hair (the group's size a slider); the group's hairs draw
  together toward their tips. This is what makes waves and curls read as locks, and tips as points.
- **Waves**: a size, a length (4 to 14 cm), where down the hair they start, how regular; one phase a clump, so a lock
  waves together (picture 3).
- **Curls**: the lock winds round its own middle (a radius, a pitch), the card turning with it: ringlets to tight coils.
  Curly hair is bigger: the volume follows.
- **Frizz** (fine noise, more toward the tips), **Messy** (clumps knocked a little off their way), **Wet** (tight
  clumps, flat roots, gloss: for our games).
- **Strays**: a number of single fine hairs standing off the surface along the parting, the outline and the ends
  (pictures 1 and 3), each one hair to a thin card, the way the lashes are made (`browlash.js` `strandCards`).

### 3.8 The fringe, and ties

- **Fringe**: *None*, *Blunt*, *See-through*, *Wispy*, *Side-swept*, *Curtain*, *Micro*, *Over the eyes* (the horror
  one). Length (hairline, brows, eyes, nose), Width (how far round to the temples), Density (see-through is fewer
  pores falling forward; the rest go with the top), Sweep, Curve (how it rounds off the forehead), Split.
  **Face-framing strands**: how many, how long (picture 1's two strands).
- **Ties**: *None*, *Ponytail*, *Twin tails*, *Half-up*, *Bun*, *Twin buns*, *Top knot*. Where on the head (nape to
  crown; out to the sides for twins), Tightness, and **what's left out** (the fringe; the fringe and face strands; the
  front layers at their own length: picture 2's cap).
  - The tied pores' hair runs along the head to the tie, tight or loose, and ends there. Which pores a tie takes is
    plain to see in Show the pores (LESSONS: bangs that took the tie and were pinned whole).
  - **The tail** from the tie: Length, Thickness, Spread, Falls behind or over the front of the shoulder, its texture
    the hair's own, its tip tapering; traced with a thickness so it rests on the shoulder and chest. A **bun** is a
    tail wound round a ball at the tie.
  - **The tie itself**: an elastic, a scrunchie or a ribbon, in a colour (picture 2's red).
  - **It swings in Godot**: a tail is skinned to its own chain of bones under the head, named as the animal ears'
    chains are (`jiggle_<name>_0` … `_tip`), so the look plugin's HSJiggle springs it. Loose hair stays skinned to the
    body's bones as now.
  - Braids come later (a plait is its own geometry).

### 3.9 From hairs to cards, and the bake

- **One small lock a pore**: a card about twice as wide as the pores are apart, lying flat on the hair's surface like a
  shingle (its width across the flow, facing out), so every point of the scalp is under two or three cards at the
  roots and more further down.
- **Strands the same thickness on every card**: a card shows as much of the atlas as it is wide (the whole atlas is
  5 cm of hair), instead of every card showing the same 0.3. Narrow cards (baby hairs, a see-through fringe) show one
  or two clumps.
- **Short hair that stands** (a crew cut, a textured top) has its cards turned at random round their own hair, so
  some face you from any side; lying hair keeps them flat on the surface.
- **Points where it bends**: straight hair keeps 5 or 6 points a card, a curl up to 24 (the bake's own Smooth curves).
- **A triangle budget**: Light (about 8,000), Medium (about 20,000, the default), High (about 40,000), and **Drop
  what's never seen** (cards the occlusion says are buried all along their length).
- **The salon's bake, shared**: the card builders and the finish (`cardsGeometry`, `finishCards`, `bakeMat`: shell
  normals from the hair's volume, tangents, occlusion, strand numbers, the `studioHair` record) move out of `salon.js`
  into a module both use (`haircards.js`), unchanged; SALON holds the salon to what it did.

### 3.10 The scalp, painted from the pores

In place of the flat darkened cap: a small texture on the scalp's own patch with **a soft dot for every live pore**.
Under thick hair the dots merge into the root shade; under thin hair and at the hairline they thin out with the pores,
so the edge is soft; on a buzz cut or a shaved head they are the stubble; along the parting the skin is left clear by
the parting's width. Its strength is a slider (Shade under the hair), and so is Stubble.

**Hair under a centimetre is shells, not cards** (a buzz cut, stubble, clipped sides): a few copies of the scalp's
patch lifted off the skin a millimetre or so apart, each wearing the pores' dots, fewer toward the top (the fur
technique), because a card standing on end can't be seen from above. Cards take over as the length grows, the two
blended over a fade's height.

### 3.11 No gaps: built in, counted, filled

- **Built in**: even pores, cards over twice their spacing wide, layers stacked along the flow.
- **Counted**: after every change, rays from outside onto the scalp count the cards they cross. The tab says *Scalp
  covered 100%, two layers 97%* and marks where it isn't.
- **Filled**: where fewer than two layers cover live scalp (beside a parting, at the crown, behind the ears, at the
  nape), extra hairs are grown between the pores there until it's covered. Automatic, the same every time.
- **And measured in Godot** (§6): the scalp drawn in a marker colour in a second picture, and the marker's pixels inside
  the hair's outline counted.

### 3.12 Colour and look

The salon's looks (`hairtex.js` `LOOKS`) with more: soft black, dark brown, brown lengths on black roots (picture 5),
grey, salt and pepper, white, a dyed set. Root, length and tip colours, how far the root colour runs, inner strands,
Shine, Glossy, **Grey hairs** (a share of the locks). The retro switches (flat, steps, dither) carry over.

## 4. The tab

**Hair editor v2.0**, a tab of its own after Hair. A module mounted the way the Layers tab is (`mountLayers(ctx)`:
`hair2/ui.js` `mountHair2(ctx)`), drawing in the Studio's own view on the character, under its lights, in its poses,
with its split view. Sections, closed until opened, the two or three main sliders of each first:

| Section | Controls |
|---|---|
| **Start from** | the styles as picture cards (§8), a click puts one on; Variation; Mirror both sides |
| **Hairline** | the dropdown; Height, Temples, Peak, Sideburns, Nape, Irregular, Soft edge; Thinning and its Amount, Size; Show the pores |
| **Parting and direction** | Parting, Side offset, Length, Angle, Width; Crown (place, swirl); Top, Sides, Ears; Hold |
| **Length and cut** | Fringe, Top, Sides, Back, Nape; Cut (by length, to a line), Line height, Tilt, Round; Layers, Graduation; Undercut, Fade; Ends (blunt to wispy), Thin out, Uneven |
| **Shape and volume** | Root lift; Volume crown, sides, back; Width at the jaw; Ends in or out, Radius; Lift and Bend (short hair); Asymmetry |
| **Texture** | Waves (size, length, starts at); Curls (radius, tightness); Clumps (amount, size); Frizz; Messy; Wet; Strays |
| **Fringe** | Kind; Length, Width, Density, Sweep, Curve, Split; Face-framing strands (amount, length) |
| **Ties** | Kind; Height, Out to the side, Tightness; Left out; Tail (length, thickness, spread, falls, sway); Tie (kind, colour) |
| **Colour** | Look; Root, Length, Tip; Root length; Inner strands; Shine, Glossy; Grey hairs; Shade under the hair, Stubble |
| **Detail and Godot** | Density; Detail (light, medium, high); Drop what's never seen; Keep off the clothes; the numbers (pores, cards, triangles, scalp covered, two layers, inside the body: none); **Preview in Godot**; **Wear** (this hair, the salon's, none) |

- **Live**: the hair is made in a worker. While a slider is dragged, a draft (a third of the pores, no occlusion) keeps
  up with it; let go, and the full hair with its volume data follows (the aim: within about half a second; measured
  and shown in the tab).
- **What you see is what Godot draws, as near as the Studio can**: the tab draws the cards with the bake's own data
  (shell normals, occlusion, soft coverage), the part the salon's live view still lacks.
- **Saved with the character** as `hair2` (the style it started from and what differs, as a prop's recipe is): a few
  numbers, not a file. Nothing is baked to disk: opening the character makes it again, and so does any change to the
  head (a new age, a sculpt, a fitted face).
- **One hair worn**: with *Wear: this hair* the salon's bake is hidden and left out of the export; switch it off and
  the salon's is back. Both are kept. (New behaviour behind a switch.)
- **Undo and redo** in the tab; a style **saved as your own** (`Content/Studio/Hair2/styles/`), shown first in Start
  from.
- **Export for Godot** carries it as it carries everything on the rig: `hair_static`, `hair_scalp`, a mesh a tail with
  its chain, the ties.
- Later, if sliders aren't enough: handles on the head (drag the parting, a tie, the cut line), a comb brush that turns
  the direction where you stroke, and *Finish by hand in the salon* (this hair as the salon's base to add locks on).

## 5. "1:1", and how likeness is judged

A likeness is the user's to judge, part by part (LESSONS, 2026-11-11: don't finish on a first guess). So:

- For each picture a **sheet**: the picture beside Godot's renders of our hair on a Studio head, from the picture's
  own angle and from the front, three-quarter, side, back and top.
- **Measures as a guard, not as proof**: the hair's outline over the picture's once the eyes and chin are lined up;
  where the parting sits; the fringe's line against the brows; the ends against the chin and shoulders.
- **What 1:1 can mean here**: the same cut, parting, fringe, lengths, outline and texture in our look. The pictures
  are strand grooms of 50,000 hairs and more in Unreal; ours are cards under HSHair. The sheets show how close that
  gets, and the first sheet comes before anything is built on it (§7, step 1).
- **The user's answers** (DECISIONS 2026-11-11, the go): a tab of the Character Studio, yes; hair may reach the chest
  (the length is a slider); 20,000 triangles, yes; braids, beards and hats later, yes; and **no stops**: "start
  working on everything and dont stop until it looks really good inside godot and runs well", so §7's stops for the
  user's answer are lifted and each step is judged in Godot's pictures instead. The questions as they were asked (my
  defaults in brackets):
  1. v2 beside the salon, a switch on each character choosing which is worn [yes].
  2. Picture 2's tails reach the chest, past "not much longer than the shoulders". Loose hair to the collarbones at
     most, tails up to about 25 cm from the tie since they swing on their own bones [yes]; or tails capped at the
     shoulders too.
  3. The first sheet: picture 1's bob, picture 4's short cut, a man's side parting and a thinning crown, with the
     hairline dropdown's shapes as dots on the head [yes].
  4. Medium detail, about 20,000 triangles of hair, as the default [yes].
  5. Braids, beards (the same pores would do a beard) and hair under hats: later [yes].

## 6. In Godot

- **Wearing it needs nothing new**: the meshes and their `studioHair` records are the salon's, so `HSHair.wear` puts the
  bake's look on. Two small additions to the look plugin: the strays and baby hairs drawn by the fine shader the
  lashes use (`hair_fine.gdshader`: a mesh named for it), and the scalp's texture (and a short cut's shells) on the
  scalp material.
- **Preview in Godot** (the tab's button): the page sends the head and its hair to the Studio's server, Godot (the
  user's own, `$GODOT`) pictures it under the game's look (the balanced preset, TAA) from five sides and close, and the
  sheet comes back into the page. Seconds on the user's machine; no export, no project to open.
- **For the checks and for making the styles** the same pictures are made without the page: a node script makes a
  style on a body as a `.glb` (`hair2/make.mjs`), `tools/godot/hair2_check.py` pictures it (Godot 4.7 runs in the
  cloud sessions under xvfb, on the CPU: slow, but it runs; GODOT ok here on 2026-11-11).

## 7. The build, in steps (each a commit, pushed; each ends with pictures for the user)

1. **The engine, and the first sheet.** The pores and the chart; the hairlines and thinning; the directions; the
   tracer on the distance grid; the cut; cards through the shared bake; the node tool and the Godot pictures. *The
   user sees*: the hairline shapes as dots on the head, and picture 1's bob, picture 4's short cut, a man's side
   parting and a thinning crown from five sides in Godot, beside the pictures. **Stop for the user's answer.**
2. **The tab.** Hair editor v2.0 in the Studio with every control of step 1: the sections, the worker, Show the pores,
   the numbers, saving, the Wear switch, the export, Preview in Godot. *The user can use it* for bobs and short cuts.
3. **Texture and fringes.** Clumps, waves, curls, frizz, strays, baby hairs; the fringe's kinds; ends curled under.
   Pictures 5 and 3 as sheets. **Stop for the user's answer.**
4. **Ties.** Ponytails, twin tails, half-up, buns; the tie objects; the tails' chains swinging in Godot. Picture 2 as a
   sheet. **Stop for the user's answer.**
5. **The rest of the styles** (§8) with their pictures on the cards; the scalp painted from the pores (stubble);
   Keep off the clothes; Drop what's never seen; children and creatures checked.
6. **Docs and checks**: docs/HAIR_V2.md (what's built), CLAUDE.md, the launcher, the checks below in check_all where
   they're offline.

## 8. The styles to ship

- **From the pictures**: Sleek bob, middle parting (1); Low twin tails, swept fringe (2); Shoulder-length waves, side
  parting (3); Short cut, long swept fringe (4); Chin bob, see-through bangs (5).
- **Women's**: Long and straight to the collarbones; Hime cut; High ponytail; Low ponytail; High bun; Low bun; Half-up;
  High twin tails; Shoulder-length curls; Shaggy layers with curtain bangs.
- **Men's**: Side parting, short back and sides; Crew cut; Buzz cut; Slicked back; Two-block; Middle-part curtains;
  Quiff; Long, tucked behind the ears; Top knot.
- **Balding**: Receding temples; Thinning crown; Bald on top (horseshoe); Shaved, a shadow of stubble; Comb-over.
- **Horror**: Long hair over the face; Unkempt; Wet.
- **Children**: Bowl cut; Short bob with a full fringe.

## 9. What's reused, what's new

| Reused as it is | For |
|---|---|
| `hairtex.js` (the atlas, the looks), `hairshader.js` (`STUDIO_HAIR`, `strandsTexture`) | the cards' texture and record |
| `hairvolume.js` (volume, shell normals, occlusion, winding) | the bake's finish |
| `salon.js`'s card builders and finish, moved to `haircards.js` | the bake, shared with the salon |
| `salonlib.js` (curves, resampling, the random numbers) | the tracer's curves |
| `browlash.js` `strandCards` and the one-hair atlas | strays and baby hairs |
| the export (`exportRig`: what's on the rig goes in the file; `userData.jiggle` chains) | Export for Godot, tails that swing |
| `tailor/node.mjs` (`mhrBody`, `grownBody`), `tailor/bodies.json` | the test bodies in node (slim, full, children, creatures) |
| Godot: `hair.gd`, `hair.gdshaderinc`, `hair_fine.gdshader`, `jiggle.gd`, the portrait tool | wearing it, the pictures |

| New | What |
|---|---|
| `tools/character/hair2/pores.js`, `pores.mjs` | the fixed pores, the chart, hairlines, thinning; the tool that makes `pores.bin` |
| `hair2/flow.js` | the crown, the parting, the parts' directions, a tie's pull |
| `hair2/sdf.js` | the body (and clothes) as a distance grid |
| `hair2/strands.js` | the tracer: comb, lie, fall; layers; the rules; the cut |
| `hair2/texture.js`, `hair2/ties.js` | clumps, waves, curls, frizz, strays; tails, buns, tie objects, chains |
| `hair2/cards.js` | hairs to cards: widths, the atlas by width, ends, budgets, the fill, the coverage count |
| `hair2/styles.js`, `Content/Studio/Hair2/` | the controls' table (ranges, defaults, help), the styles, their pictures, `pores.bin` |
| `hair2/engine.js`, `worker.js`, `ui.js` | settings and a body in, hair out; off the page's thread; the tab |
| `hair2/make.mjs`, `sheet.mjs`, `check.mjs` | a style as a `.glb` in node; contact sheets; HAIR2 |
| `tools/character/hair2pagetest.mjs` | HAIR2PAGE |
| `tools/godot/hair2_check.py`, `hair2_shots.gd` | GDHAIR2, and the pictures behind Preview in Godot |
| `tools/character/serve.py`: `api/hair2/styles`, `api/hair2/godot` | your own styles; the Godot preview |
| docs/HAIR_V2.md | what's built (this file stays the plan) |

## 10. Checks (each ends `<NAME> ok`)

- **HAIR2** (`node tools/character/hair2/check.mjs`, offline, in check_all): the pores (their number, spacing, mirror,
  every prefix evenly spaced, made again the same); every hairline a closed edge with the ears out; every style on the
  test bodies (the base, slim, full, children of eight and twelve, a goblin and an ogre): no NaN, no point inside the
  body, nothing below the cap, nothing over the eyes unless the style says so, the scalp covered (one layer everywhere
  alive, two layers over 95%), the layers in order (no card crossing its neighbour), a tie's pores all at the tie and
  none of the fringe's, a tail's chain running root to tip, the triangle budgets, the same settings twice the same
  mesh, and how long it took.
- **HAIR2PAGE** (`node tools/character/hair2pagetest.mjs`, the Studio's server running): the tab, the cards, a style
  put on, a slider changing the hair, the pores shown and changed by the hairline, saved and opened again the same,
  the salon's hair hidden while this is worn and back after, the export carrying the hair with its records and a
  tail's bones.
- **GDHAIR2** (`python tools/godot/hair2_check.py`): each style in Godot on HSHair with the bake read from the file;
  skin seen through the hair under a tenth of a percent of its outline from five sides; the outline smooth (no
  spikes); not black, not bleached; a tail's chain found by HSJiggle and swinging; the sheets.
- SALON after `haircards.js` moves (the salon bakes what it baked), STUDIO, GROWPAGE (hair on a child and a creature)
  on the user's machine (docs/RUN_LOCALLY.md: the page checks draw on the CPU here).

## 11. Limits and risks, said now

- **Cards, not strands.** Close up, a groom of 50,000 strands has depth that cards approach but don't equal. What
  closes most of it: finer and more cards, strays, the bake's volume data, HSHair's dithered coverage. The first sheet
  shows how near it gets.
- **Tight curls are the hardest shape for cards** (a coil is a ribbon turning in space). Loose waves and ringlets are
  safe; tight coils may want their own atlas. Picture 3's waves are the safe kind.
- **Tails past the shoulders can still meet clothes** in motion: their bones swing them, and nothing in Godot collides
  hair with cloth. Keep off the clothes helps at rest; the cap is the real guard.
- **Hats, horns and animal ears** aren't known to the hair yet (hair goes through them as the salon's does).
- **The page checks are slow in the cloud** (no graphics card): the engine and its checks are built to run in node
  and Godot here, and the page's own checks are for the user's machine.
- **The pores file is tied to MHR's mesh**: a new base mesh means making it again (one command).

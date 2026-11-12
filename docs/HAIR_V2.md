# The hair editor v2.0

Hair grown, not laid: the Character Studio's **Hair editor v2.0** tab (beside the salon's Hair tab, which stays as it
was). The scalp carries a fixed set of pores; a hairstyle is a few dozen settings (a hairline, a parting, lengths, a
cut, volume, texture, a fringe, ties, a colour); the engine grows a lock from every pore and the result is the same
kind of thing the salon bakes, so Godot's HSHair wears it. DECISIONS 2026-11-11 (the plan, then the go) and 2026-11-12
(long hair with the ears out; Japanese and Korean styles; a chart of twelve drawn hairstyles). The plan it was built from: `docs/HAIR_V2_PLAN.md` (what differs from it: §9).

## 0. In short

- **Where**: `python tools/character/serve.py`, the tab *Hair editor v2.0*. Tick *Wear this hair*, or click a style.
- **What you do**: pick a style's card, move sliders. Nothing is placed by hand. *Show the pores* shows what grows.
- **What a character keeps**: `hair2: { on, style, set }` in its `character.json`: the style it started from and what
  differs. The hair itself is made again from that on any body (a child's, a creature's): nothing is baked to a file.
- **Into Godot**: *Export for Godot* (the Studio's own button) carries it. *Preview in Godot* in the tab pictures this
  head and hair with Godot itself, without exporting the character.
- **The salon** is untouched. While this hair is worn the salon's bake is hidden and left out of an export; untick
  *Wear this hair* to wear the salon's again.

## 1. The tab

`tools/character/hair2/ui.js` (`mountHair2`, mounted by `index.html` as the Layers tab is), the engine in a worker
(`hair2/worker.js`).

- **Wear this hair**, and a line under it: locks, triangles, how much of the scalp is covered, how long it took.
- **Styles**: cards by group (*From the pictures*, *Women's*, *Women's, long with the ears out*, *Japanese and Korean
  styles*, *Drawn hair: the chart's twelve*, *Men's*, *Balding*, *For our games*, *Children's*, and *Mine*). A card sets every setting; their pictures are Godot's
  (`python tools/godot/hair2_check.py thumbs` into `Content/Studio/Hair2/thumbs/`).
- **Nine sections** of sliders and dropdowns, drawn from `styles.js`'s `CONTROLS` (a row is a path into the settings,
  its range and its help): Hairline, Parting and direction, Length and cut, Shape and volume, Texture, Fringe, Ties,
  Colour, Detail. A row lights up while it differs from the style's own. Lengths read in centimetres and millimetres.
- **While a slider is dragged** the hair is made as a draft (no occlusion, no coverage count: 130 to 300 ms); let go,
  the finished hair (250 to 700 ms). Only the newest request is made.
- **Undo, Redo**; **Show the pores** (the growing pores as dots, the locks hidden: dark the loose hair's, blue the
  fringe's, green the face-framing strands', red the tied hair's); **Back to the style**; **Save as my style…** (kept
  in `Content/Studio/Hair2/my_styles.json` with a picture of the view; right-click a card of yours to remove it);
  **Preview in Godot**.
- **The body changed** (a height, an age, a sculpt, a creature): the hair is grown again on it, half a second after
  the body holds still. In the T-pose view the hair below the head goes with the body, as the salon's bake does.

## 2. What a hairstyle is

`tools/character/hair2/styles.js`. `DEFAULTS` is every setting; a **style** is a label, a group and the settings that
differ (`STYLES`, 59 of them; one can be `from` another); `settings(style, set)` is the defaults, the style's, then
the character's own; `differs(style, settings)` is what a character keeps. A fringe's kind brings its own numbers
(`FRINGES`); a look is a name from `LOOKS2` (and the salon's `LOOKS`) or its colours.

Lengths and heights are metres in **the head's own space** (salonref.js: the origin between the ears, X her left, Y
up, Z forward, the size of MHR's base head): the crown 0.122, the brows 0.037, the chin -0.096, the shoulders' tops
-0.135, the chest -0.30 (`MARKS` in `pores.js`).

## 3. The engine

`tools/character/hair2/engine.js`: `prepare(body)` once a body (about a second), `grow(body, pores, settings, prep)`
each time. Plain arrays, no three.js: the page's worker, node and the checks run the same code.

### 3.1 The pores

`pores.mjs make` threw 4096 pores onto MHR's base scalp once (`Content/Studio/Hair2/pores.bin`): each a triangle and
its place in it, so it rides any body; mirrored pairs; **ranked**, so the first N of them are evenly spread whatever N
is (the Pores slider takes the first so many: 1300 by default, about 6 mm apart). Their place on the head is a chart:
the angle round the head (0 the front, +90 her left) and the height on the base head.

### 3.2 The hairline, thinning

`pores.js` `hairline(h)`: a limit's height at each angle. A dropdown of twelve shapes (soft round, straight, high, low,
widow's peak, heart, square, M, three receded ones, uneven), then Height, Temples, Peak (millimetres), Sideburns, Nape
and its shape, Irregular, a Variation; **Soft edge**: the last centimetre thins out and its hairs are short and fine.
The ear is cut out of the pores. **Thinning** (crown, top, a horseshoe, all over) takes pores away by chance, more
toward its middle. `alive(pores, hairline)` is which grow.

### 3.3 The body as a distance grid

`sdf.js`: the body's skin as signed distances on a 4 mm grid round the head, the neck, the shoulders and the chest
(exact near the skin, 0.2 mm off on average). With the ears **covered**, two rounded lumps are joined on over the ears
(`withLumps`), so hair that falls over an ear lies over a smooth side of the head, not in and out of the flap.

### 3.4 Comb, lie, fall

Each hair is **traced** in short steps from its pore, not simulated (`flow.js` which way it's combed, `strands.js` the
trace):

- **comb**: the crown's whorl, the parting (away from its line), the top combed back or forward, the sides down, back
  or forward, a fringe forward, a tie's pull; eased between neighbouring pores, never across the parting. The same as
  a field over the head, so a hair passing over other hair's roots goes the way the hair there goes. Hold is how far
  the comb reaches before gravity.
- **lie**: over the head a hair is laid at a height above the skin that grows with how far it has come, up to the
  **Volume of where it is** (top, sides, back). Hair from further up has come further, so it lies over the hair below
  it: the layers are in order by construction. Nothing is sorted, nothing crosses.
- **fall**: where the head falls away it hangs, kept off the neck, the shoulders and the chest; its last centimetres
  turn in or out (Ends turn).

And the rules live in the trace, not in a simulation after (LESSONS: a simulation undoes what a generator promised):

- **the face**: with no fringe, nothing comes down over the eyes, the nose or the mouth; it goes to the face's side.
- **the ears**: *covered*; *clear* (the hair is cut where it would cover one: short cuts); **tucked** (both, or her
  left or right alone): the roots over the temple and above the ear are combed back, the hair runs along the hairline,
  over the ear's top and down behind it, never across it; what grows in front of the ear below its top stays as a few
  short wisps. *Tucked hair falls* in front (it comes forward under the ear and hangs in front of the shoulder to its
  cut) or behind the shoulders.
- **the cut**: to a line (every hair cut where it crosses a height: Tilt for an A-line, Round for a U) or by length.
  **Two lengths** (`cut.tiers`): the front and sides to a shorter line of their own as far round the head as you say
  (a step or a slope), the back long; or a bob all round over a long nape (the hair that grows on the low back of the
  head keeps the long line: the jellyfish cut).
- **the chest**: nothing below it. **The shoulders**: what ends a hair is running level along the body or sliding out
  over a shoulder's slope (no brim, no fan of hair over the shoulders); hair that still comes down, down the back or
  the chest, lies on to its cut.

### 3.5 Lengths

A length for the top, the sides, the back and the nape (blended by where a pore is), Layers between a line cut and
the lengths, Thin out, Uneven, an **undercut** (below a height the hair is clipped to a length, with a fade).

### 3.6 Texture

`texture.js`: locks (neighbouring hairs drawn together, while they travel together: a hair whose guide went another
way round the head is left alone), **waves** (their size, length, where they start, In step:
each lock on its own or waves running across the head), **curls** (a lock wound round its own middle line), frizz,
Messy (a lock's way knocked off), Wet (tight locks, flat roots), **stray hairs** (single wisps standing off the
surface; none off tucked hair).

### 3.7 Fringes and face-framing strands

A fringe is the front hairline's own band, as deep as its Amount (a see-through fringe a shallow band, a full one
deep): blunt, see-through, wispy, side-swept, curtain, micro, over the eyes, **choppy** (drawn hair's pointed locks);
its line, width, sweep, split, curve, arch, ends; **Choppy** (each lock cut to its own length), **Centre lock** (a
longer one between the eyes), **Slant** (longer toward one side: hair over one eye). **Face-framing strands** are
some of the temples' own pores, hanging in front of the ears to their own line; **Ringlets** winds each side's into a
drill (`ties.js` `drills`: a ribbon round a middle line kept off the body, cards end to end).

Since the Advanced styles (DECISIONS 2026-11-12, the very last): a fringe's **Amount** goes past 1 (a heavy fringe,
its band up to six centimetres deep: from further back on the head) and its **Arch** both ways (shorter toward the
temples, or longer: rounded down at its sides). **Tendrils** gathers each side's face-framing strands into one to
four pointed locks (`engine.js`: the strands of a lock take one guide and are drawn to it, `clumpAmt`; measured, one
lock's tips lie 0.8 mm apart where a flat sidelock's lie 10.8); **uneven** gives each lock its own line (every strand
of a lock ends at it exactly; the left and the right are not mirrored); **wave** an S along each. **Wisps by the
ears** leaves some of the sideburn's own pores out of a tie as thin strands to between the lobe and the jaw. A
tendril ends at its line or where it comes to rest on the body, whichever is first: one asked to end under the
shoulders' tops stops on the shoulder (half a centimetre short at -15 cm on MHR's base).

A face-framing strand is cut by its own line only. Before 2026-11-12 the cut's line cut it too, and on tied hair,
where nobody sets that line, its default ended every tendril at the chin whatever *Their length* said. What that
changed in the 59 styles there were, grown by the engine before and after and compared hair by hair: 49 the same
point for point; four differ only in how their bun is wound; in six a few face-framing strands are longer (the
thinned ones, which the cut's line had been ending above their own): both ponytails (three strands, at the most
3.1 cm), the high twin tails, the pigtails and the odango (one or two, about a centimetre), the sleek bob (one, by
less than a millimetre). No other hair moved.

A card's shade is by how far from its root it is in metres (`cards.js` `shade`, in the vertex colour): the atlas goes
from the roots' colour to the lengths' over the first third of a card however long the card, so a 9 cm fringe was all
"lengths" beside long hair still in its roots' shade, and read grey.

### 3.8 Ties

`ties.js`: a ponytail, twin tails, half-up, two side up, a bun, twin buns, a top knot. A tie is a point just off the
head (Height, Out to the sides, **To one side** for a side ponytail); it takes all the hair or **the top's only**
(the rest hangs loose: buns with the hair down); the pores it takes have their hair run along the head and end in it; *Left loose in front* keeps
the front out. From it hangs a **tail**: a spine traced from the tie with cards round it, its length, thickness,
spread and taper, behind or over the shoulders; or a bun wound round a ball. A tail carries the five joints of a
chain down its spine. The tie itself is an elastic or a scrunchie in a colour.

Tied hair's way to its tie (the user's reference: guide curves over the scalp into a bun): **Sweep**, it leaves its
root the way the hair there is combed, away from the parting, and bends round to the tie over up to ten centimetres
(arcs, not straight lines; only where its own way and the tie's agree: hair at the back, combed down, goes straight
up to a high tie, or it would hang in a loop first); **Swirl**, it comes in turned and winds round the tie. With both
at their most, either way, every tied hair still ends in its tie (HAIR2: 761 of 761 on the twin buns). A **bun** is a
coil: most of its hair wound the one way, a few across, a pair of buns mirrored. **Loose strands** stand out of a
bun (`ties.js` `wildOf`: three to fourteen thin locks that leave it every way but into the head, and a halo of short
fine hairs; **Soft or spiky**: they arc and droop, or stand straight to a point); they are the bun's own cards and
stay out of the body.

An **ahoge** (Shape and volume): one lock standing up out of the top of the head and curving over to a side (`ties.js`
`ahoge`: two thin cards facing the front).

### 3.9 Cards and the bake

`cards.js`: each pore's hair is one small lock, a ribbon about 2.3 pore spacings wide lying flat on the hair's surface
with the salon's strand atlas on it. A card shows as much of the atlas as it is wide (strands the same thickness on
every card); a blunt end stops before the atlas's strands thin out, a wispy one runs through them; a card keeps points
only where it bends, and if the whole is over the detail's budget (light 9,000, medium 20,000, high 40,000 triangles)
the fit loosens until it isn't. At the hairline's edge a lock leaves the skin as a point and widens over two
centimetres: an edge of hairs, not of planks' ends.

`bake.js`: the salon's bake's finish on them (`hairvolume.js`): every card vertex's normal the hair volume's **shell
normal**, the strand's tangent, the second UV (across the card, the occlusion), each strand's numbers in the occlusion
slot's texture, `studioHair` in the material's extras, and with it **`settings`**: `root_fade: 0.012` (HSHair's own
6% of a lock is for the salon's hand-laid locks, whose roots are under other locks; here it bared two centimetres of
scalp).

### 3.10 Short hair, and the scalp

- **Shells** (`shell.js`): hair under 3 cm is not cards (a card on end can't be seen from above) but a few copies of
  the scalp lifted off the skin, each drawn with a tile of hairs' cross-sections that thin toward the top layer: a buzz
  cut, stubble, clipped sides and napes, the undercoat of a short cut. Where pores thin, fewer of the tile's hairs.
- **The scalp painted from the pores** (`scalp.js`): the scalp's own patch of the skin (grown two rings past the
  pores), a hair off it, with a small texture: a soft dot for every growing pore in the roots' colour. Under thick
  hair the dots run together into a shade; at the hairline's soft edge they're fainter; under a cut's line (a bob's,
  a bowl cut's nape) there are none; the parting's skin is left clear by its width. In place of the salon's flat
  darkened cap.

### 3.11 A second colour

`dye` (Colour: *A second colour*): **all of it**, **streaks**, **underneath** (the hair that grows low on the head),
**the top layer**, **the front pieces**, **the fringe**, **one half** (her left or her right), **the ends** (a dip
dye); its colour, how much, a streak's size, the **roots grown out** and the **ends left natural** in centimetres,
how soft its edges are along the hair.

The strand atlas is one colour times a shade, so dyed hair can't be drawn with it as it is. Its atlas is one flat
colour instead (`styles.js` `drawLook`: the brighter of the hair's own and the dye's, channel by channel, the
"carrier") and every point of every card carries its own colour over it in the vertex colour (`cards.js` `dye`): the
natural colour from the roots' shade to the lengths', or the dye, by its lock and by how far it is from its root and
its tip. Plain hair is untouched: its atlas and its one shade a point, as before (HAIR2 and HAIR2PAGE hold both).

A **streak** is a lane the hair runs in, not a patch of scalp: for hair that hangs, its place round the head where
it hangs (a slice from the parting down through all the layers, as a colourist takes it); for tied hair, the bearing
it arrives at its tie on, read from its own path five centimetres before the tie. Not from its root: on a low bun a
root's bearing is a median 9 degrees off the one its hair comes in on, wider than a lane's fine band, and hair dyed
by its root lay in its neighbour's lane (LESSONS). The share dyed follows the Amount to within a few points (0.08,
0.29, 0.46, 0.66, 0.87 of the lengths for 0.1 to 0.9). A tail has its tie's share of dyed hairs as stripes down it, a
bun as bands round its ball, a dip dye the tail's own tips.

## 4. In the Studio

- **Drawn** with the salon's hair shader (`hairshader.js`) on the cards and the tails, a small shader of its own on
  the shells, a plain material with the painted texture on the scalp, under the character's `rig` in a group placed by
  the head's frame.
- **Saved**: `hair2` in `character.json` (*Save*), brought back on opening and on *Import*.
- **Export for Godot**: the group's meshes go into the file as everything on the rig does: `hair_static` (the locks)
  and `hair_shell` and `hair_scalp` skinned by the skin nearest each point, each tail `hair_tail…` on a chain of its
  own bones under the head (`jiggle_hair_tail…_0` … `_tip`, from its joints), buns and ties whole on the head's bone.
  The materials are made for the file by each material's own `userData.fileMaterial` (the page's `fileLook` asks):
  `hair_cards` with the atlas in the look's colours, the strands' texture and the bake's record.

## 5. In Godot

`GodotPlugins/HorrorStudioLook`: nothing new to do in a game. `HSHair.wear` (which `HSEye.wear` and `HSCharacterLook`
call for a Studio export) finds:

- the **locks** by the `studioHair` record: the salon bake's look (soft dithered coverage under TAA, tapered card
  sides, two highlights, light through from behind), with the bake's own `settings` over it;
- **`hair_shell`**: `hair_shell.gdshader` (GODOT_LOOK §5p) with the look's root and tip colours;
- **`hair_scalp`** with a texture: kept as it is, matt;
- the tails' chains: **HSJiggle** springs every chain named `jiggle_…`, soft by the tail's Sway.

**Preview in Godot** (the tab's button; `POST api/hair2/godot/<name>`): the character's `body.bin` and its
`{ style, set }` go to `node tools/character/hair2/make.mjs --bodybin … --settings …` (the same engine), and
`python tools/godot/hair2_check.py shots` pictures the head and hair from the front, three quarters, the side and the
back in a scratch Godot project with the look plugin (`Saved/Godot/_hair2`). Godot is `$GODOT`, else `godot`.

## 6. The styles

Long hair ends with **just its tips on the shoulders** in every style (a cut's line at -0.14, a tail's length to
match: DECISIONS 2026-11-12, last); longer is a slider away, down to the chest. Every style as Godot pictures it:
`docs/godot_sheets/2026-11-12_hair_v2_styles.jpg` (the cards' own pictures, by group).

| Group | Styles |
|---|---|
| From the pictures | sleek bob with a middle parting; low twin tails with a swept fringe; shoulder-length waves from a side parting; a short cut with a long swept fringe; a chin bob with see-through bangs |
| Women's | long and straight; hime cut; high and low ponytails; high and low buns; half-up; high twin tails with blunt bangs; shoulder-length curls; shaggy layers with curtain bangs |
| Women's, long with the ears out | long and straight, tucked; see-through bangs and sidelocks; a side parting with one ear out; loose waves; half-up |
| Japanese and Korean styles | sides just under the ears with a long back; hime with sidelocks to the jaw; jellyfish cut; wolf cut; two side up; odango; long with C-curl ends; a lob with the ends flipped out |
| Drawn hair: the chart's twelve | long with bangs to the eyes; shoulder length, flicked ends; hime; long and tousled with an ahoge; side ponytail; bob with the fringe over one eye; pigtails; short bob with parted bangs; long with ringlets; twin buns with the hair down; short and spiky; short with two low tails |
| Men's | side parting; crew cut; buzz cut; slicked back; two-block; middle-part curtains; quiff; long, swept back; top knot with shaved sides |
| Balding | receding temples; thinning crown; bald on top; shaved with a shadow of stubble; comb-over |
| For our games | long hair over the face; unkempt; wet |
| Children's | bowl cut; short bob with a full fringe |

## 7. How fast, how big

On this machine's CPU, in node: the distance grid once a body 0.9 to 1.1 s; a style 250 to 700 ms finished, 130 to
300 ms as a draft; locks 6,000 to 27,000 triangles by style at the medium detail (wavy and curly hair up to a third
over the 20,000: a curl needs its points), shells 5,000 to 20,000 on short cuts, a tail about 1,000. The glb of a
head's hair 1.5 to 3 MB with its two 512 px textures.

## 8. Checks

- `node tools/character/hair2/check.mjs`: **HAIR2** (no browser, in check_all): the pores; the styles' table; every
  style grown on MHR's base and measured; the hairline's and thinning's pores; what sliders do; other bodies.
- `node tools/character/hair2pagetest.mjs [--out DIR]`: **HAIR2PAGE** (the tab in a headless browser on a scratch
  character; the Studio's server running; `EXPORT=1` also exports for Godot and reads the file).
- `python tools/godot/hair2_check.py [--styles a,b] [--quick] [--keep DIR]`: **GDHAIR2** (styles made by node, worn by
  HSHair in Godot, pictured from every side: every lock material on the bake's look, the scalp seen through the hair
  as a share of the hair's own outline, the hair neither black nor bleached; a sheet in
  `Saved/Story/_look/godot_hair2/`). `sheets`, `shots` and `thumbs` are its tools for looking.
- `node tools/character/hair2/pores.mjs check`: the pores' file (PORES).

## 9. What differs from the plan, and what's not there

- **Its own card builder** (`cards.js`), not the salon's lifted out: the salon is untouched.
- **Hair may reach the chest** (the plan stopped at the collarbones): the user's answer.
- **Short hair as shells** and **the scalp painted from the pores** are new against the plan (cards on end can't be
  seen from above; a flat cap reads as painted on).
- **Not built**: braids, beards, hair under hats (the user: later); clothes in the distance grid (`addSurface` is
  there, unused: long hair lies on the bare body); a tail's chain doesn't collide with the body in Godot (HSJiggle's
  springs have no colliders); the Studio's view has no temporal anti-aliasing, so the hair there is coarser at its
  edges than Godot's.
- **The Advanced styles' faults, as they stand** (2026-11-12): streaks on hair tied into buns still show card-shaped
  flecks close up (the lanes' fix above removed one cause, measured; what is left is unexplained); the underside
  colour of the long waves fans out sideways at the nape; a platinum half reads flat and chalky in Godot's picture of
  it at bust distance (the Studio's closer picture shows its strands; the two weren't taken alike); brown scalp shows at a pulled-back hairline under a see-through fringe. The coil was compared with the
  five older bun styles' cards at their size (the same), not close up.
- **Not there, and needed for a strand render's look** (the user's Daz3D hairstyles, DECISIONS 2026-11-12, after the
  very last): hair drawn as hairs close up. Tested: the editor at its limits (high detail, 2600 pores, narrow cards,
  120 loose strands) reads the same as at its defaults beside a strand render. A pass of real thin strands over the
  cards is the finding; not built. Nor is a way to dye one chosen lock (a single streak in a fringe).
- **The pictures' size, and the cards' pictures** (found 2026-11-12): a picture is the scratch project's window, and
  the window's size is the project's own setting, not resizable; `hair2_shots.gd`'s `root.size` doesn't change it.
  The project was written 960 x 720 once, so every picture was that size whatever `--size` said, and a style's card
  (asked for at 512 x 512, then made 200 x 200 without a crop) is that 4:3 picture squeezed into a square: **the 59
  cards committed before this are a quarter too narrow**. Now a project for each picture size (`_hair2`,
  `_hair2_<W>x<H>`), and a render that fails and says so when a picture isn't the size asked for. Tried: 512 x 512,
  960 x 720 and 1600 x 1200 each come out that size (a window larger than xvfb's 1280 x 1024 screen is no trouble).

## 10. Files

| File | What |
|---|---|
| `tools/character/hair2/pores.js`, `pores.mjs` | the pores, the chart, the hairlines, thinning; making and checking the pores' file |
| `sdf.js`, `body.js` | the distance grid; a body in the head's space, the ears' lumps |
| `flow.js`, `strands.js` | comb; the trace (comb, lie, fall, the rules) |
| `texture.js`, `ties.js` | locks, waves, curls, strays; ties, tails, buns |
| `cards.js`, `bake.js`, `shell.js`, `scalp.js` | cards; the bake's finish and textures; shells; the scalp's patch and paint |
| `styles.js` | the defaults, the looks, the fringes, the styles, the controls |
| `engine.js` | `prepare`, `grow` |
| `worker.js`, `ui.js` | the page's worker; the tab |
| `node.mjs`, `glb.mjs`, `make.mjs`, `check.mjs` | node's side: bodies, a glb writer, a head and its hair as a file, HAIR2 |
| `tools/character/hair2pagetest.mjs` | HAIR2PAGE |
| `tools/godot/hair2_check.py`, `hair2_shots.gd` | GDHAIR2 and Godot's pictures |
| `GodotPlugins/HorrorStudioLook/addons/horrorstudio_look/hair_shell.gdshader`, `hair.gd` | the shells' shader; HSHair's part |
| `Content/Studio/Hair2/` | `pores.bin`, `thumbs/`, `my_styles.json` |

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
  short wisps: fine hairs, a point at both ends (as short cards a third of a lock wide they read as dark shards in
  front of the ear), with the scalp under them a light shade (§3.10). *Tucked hair falls* in front (it comes forward
  under the ear and hangs in front of the shoulder to its cut) or behind the shoulders. **In front needs length**:
  cut at the shoulders (every long style here, §6) the hair has eight centimetres under the ear to come forward
  with, and it hooked round the neck as a C. The four shoulder-length styles with the ears out and the one-ear
  waves now fall behind; in front is for hair to the collarbones and longer.
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

**Tuck under** (`shape.tuck`, 2026-11-12, the bob of the user's T-pose reference). Loose hair cut to a line lies
closer in toward its ends: its thickness (the Volume of where it is) falls away from the eyes' line down to the cut,
by as much as the slider says. The ends' turn can then bring it in to the jaw: a bob's rounded line, fullest at the
temples. Without it the sides' Volume held the hair out all the way down, and a bob hung as a bell however far its
ends turned (2 to 3 cm too wide at the jaw against the picture). Measured: 13.4 cm from the head's middle a
centimetre over the cut at 0, 10.6 at 0.8, and the same above the eyes. The **Volume** sliders go to 60 mm (from 35):
a full bob stands 4.5 to 5.5 cm off the head. On a bob over a long nape (`cut.tiers: "over"`, the jellyfish cut) it
is by each hair's own line, the bob's or the nape's. It only shapes hair that lies near the head where it ends: a
bob cut at the lips. A chin-length bob hangs free below the cheekbone, and what rounds it is the ends' turn with a
long radius (4 to 5 cm) over more Volume; the bobs here have both (§10c).

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

**A ringlet is its lock wound up** (DECISIONS 2026-11-12, the ringlets: the user's picture, "the curls look like they
float rather than come from the head/hair"). It was a coil hung beside the face: it began at its full width at
once, two centimetres off the cheek, at the middle of where a few loose strands ended on the skin, its top the
roots' dark under strands already in the lengths' colour. Now: each side's face-framing strands are **one gathered
lock** (the tendrils' gathering, one lock a side: their tips under a millimetre apart), ending in a point; the ringlet **begins
at that point** (0.1 mm from it), 0.2 mm across there, and opens into the coil over its first three centimetres
(2.1 cm across a third of the way down); it is kept off the body by its own width at each height, so there is no
step sideways at its top; its ribbon starts as a point; and its colour goes on from a lock some centimetres from
its roots. With *Hang free* (which *Long, with ringlets in front* now has) the lock leaves the head at the temple
and the ringlet hangs in front of the ear, at the front edge of the side hair. HAIR2 holds the three numbers.

**Hang free** (`fringe.frameHang`, 2026-11-12, the twin tails' long sidelocks). At 0 a face-framing strand is combed
along the cheek for a quarter of its length, turned 12 degrees in toward the face, and then falls: right for strands
that end at the cheek or the jaw. At 1 it is combed for its first two centimetres only, straight down, and leaves the
head at the temple: it hangs plumb in front of the ear, clear of the cheek and the jaw, to its line (measured: no more
than 2 mm sideways from where it passes the jaw). **And the ends' turn is at the strand's own end** (`strands.js`
`ownLine`): the turn (Shape, *Ends turn*) was read against the cut's line alone, so a face-framing strand that goes on
below it (a tied style's tendrils and sidelocks: the cut is left at the chin) began to turn in at the chin and stayed
turned all the way down, drawn in under the chin to the pit of the neck. It now turns at the lower of the two lines,
and one that hangs free doesn't turn. Four of the 66 styles there were then had such strands (the twin tails and three of the
Advanced ones: space buns, the messy bun, the high ponytail); the other 62 are the same hair by hair.

Since the Advanced styles (DECISIONS 2026-11-12, the very last): a fringe's **Amount** goes past 1 (a heavy fringe,
its band up to six centimetres deep: from further back on the head) and its **Arch** both ways (shorter toward the
temples, or longer: rounded down at its sides). **Tendrils** gathers each side's face-framing strands into one to
four pointed locks (`engine.js`: the strands of a lock take one guide and are drawn to it all the way, `clumpAmt`;
measured over a lock's own strands, their tips lie 0.7 mm apart where the same strands lie 6 to 8 mm apart as a flat
sidelock); **uneven** gives each lock its own line (every strand of a lock ends at it exactly; the left and the
right are not mirrored); **wave** an S along each. A strand joins the nearest lock's guide on its side, and only
within reach of it (2 cm, or 1.4 times the Lock size: 2.5 cm by default); one that grows further off stays a plain
face-framing strand (`guides.lock` says which). The first version took every strand of an angle's band: the band
reaches down the temple's front edge, where pores are in it by angle and six to nine centimetres from the guide, and
those hung on their own for half their length, out of the pull's reach, then jogged across to the guide: a zigzag
in the lock (seen plainly on the high ponytail, in a close picture, and found by one factor changed at a time; four
styles had strands gathered from out of reach, for some hours after they were pushed). **Wisps by the
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

**Closed middle** (`fringe.closed`, 0 by default): a fringe with no line of skin down its middle. A fringe's hair runs
down the dome, so its two sides fan away from the middle (HAIR2: the hairs beside the middle of a heavy fringe drift
12.5 mm out to their own side) and the skin shows between them; Closed combs the hair beside the middle, and the hair
from far back on the top, straight forward side by side (4.3 mm). A heavy fringe from the top of the head (Amount
1.5) needs it, with Hold long enough to carry its hair to the forehead (0.7 of 17 cm).

**And the locks' part of it** (2026-11-12, the lessons into every style). On the older fringes Closed changed
nothing that showed: the forehead's middle stayed bare in a V. Printed, hair by hair: no fringe hair's tip ended
within two centimetres of the middle; hairs rooted 3 mm from it ended 2.5 cm out. Not the comb: the **locks**. Each
hair is drawn to its lock's guide, the guides are the first pores of the ranked set, none of them sits on the
middle, and so the hair beside the middle went to the locks at either side, further the bigger the locks (drawn
hair's are 3 cm). Closed now also makes the fringe's hairs beside the middle one lock **on** the middle (half a lock
size to each side, its guide the hair nearest the middle at the front of the band: `engine.js`). With a choppy
fringe's Centre lock that is the lock between the eyes it always meant. **A blunt, a choppy and a micro fringe are
closed by their kind** (`FRINGES`): every style with one changed.

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

**Tied hair that hangs** (DECISIONS 2026-11-12, the sides; the 1:1). Tied hair used to lie on the head all the way
to its tie: drawn onto the skin at every step, with no gravity. Low ties showed it: the hair followed the skull in
under the ear, where a person's hangs from the head's widest part as a curtain and is gathered at the end. Five
settings, all 0 by default (the older styles are the same hair by hair):

- **Drape**: where the head doesn't hold it up (its side from the widest part down: the skin's normal level or
  tipping down; or already off the skin) and within some centimetres of its tie's plumb line, a tied hair leaves the
  skin and follows a curve of its own, planned where it leaves: plumb down to a **Gather**'s height over the tie
  (7.5 cm, measured on the user's picture), then in, its distance from the plumb line shrinking as 1 − (1 − t)² of
  its height over the tie. It is steered at the curve's next point, a step below it, so it comes back to the curve
  when the body or an ear puts it off, and it ends in its tie. The curve is laid round the head's own axis (how far
  out, and the bearing, each going from where the hair left to the tie's): hair as far round the head from its tie
  as a quarter turn hangs too, the back of the head's as a bob's curtain, and is swept round to the tie (a straight
  line across would go through the neck); past 70 to 100 degrees round it runs along the head as before.
- **Puff**: slack. The hanging hair bows out from the head on the way down, as t (1 − t)^1.5 of its height over the
  tie (fullest two fifths of the way up), and tucks in to the tie: a rounded bulb. Hair that has come further bows
  more, so the bulb has a body.
- **Fullness**: how thick the gathered hair lies on the head (up to 2.2 cm over Tightness's 1).
- **Fullness at the back** (`ties.back`): thicker on the back of the head only, behind the ears and below the top
  (up to 2.5 cm): body behind the ear without a taller top. HAIR2: at 0.5 the tied hair lies 10.0 mm thick on the
  back of the head and 20.9 with it, 9.9 and 9.8 at the side over the ear.
- **Tie lower**: the tie slid down the hanging hair, below where Height can put it on the head (the lowest was level
  with the ear lobe; a low tail's elastic sits some centimetres under the ear), brought in against the neck there.

**Round an ear that's out.** A low tie by a tucked ear (under it, or behind it as far as 30 to 55 degrees round):
hair that grows in front of the ear's back edge goes to a pass of its own over the ear's top and on to a lane of its
own behind the ear, comes down there, and goes to the tie from under the ear; the sideburn's hair goes up the front
of the ear first; hair from behind comes forward no further than the ear's back edge while it's level with the ear.
The ear's outline stays the safety net (lifted over the top in front of the ear's middle, put back to the back edge
behind it). Before, the temple's hair ran down across the cheek and under the lobe to the tie as a ribbon, and hair
shuttled on the ear's top. HAIR2: 974 to 979 of 983 tied hairs end at their tie with none of their points across an
ear, with the tie by the ear, 4 cm lower, and with Drape, Fullness and Puff.

**A tail as a brush.** **Fan**: it springs out right under the tie (0: it leaves the tie as a rope and widens
after); **Widest at**; **Flat**: it lies against the body, wide across and thin through (its section's frame is the
body's where it rests on it, and faces forward where it hangs in the air: the body's own way beside the neck is
sideways, and the fan was edge-on from the front); **Tails lean out**: twin tails leave their ties almost
plumb and hang out of plumb all the way down, so the lean builds as they go (the other way round, turned out at
the tie, was 1 to 2 cm too wide right under it against the picture and too plumb below); **Tail strands**: how many hairs it has; **Tail stiffness**. HAIR2: 26
hairs, 66 at Strands 2.5; 1.4 cm across right under the tie, 2.1 with Fan; 4.5 cm through half way, 1.9 Flat; the
tip 1.1 cm out from its tie, 4.5 with Out.

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
- **Its shade is as it's seen** (2026-11-12). The picture is blended over the skin in linear light, where a
  twentieth of the skin left in still reads a fifth as bright as bare skin: at the Shade of 0.95 every style had, the
  scalp under black hair was a **brown**, and it showed as patches wherever the hair opens: behind a see-through
  fringe's roots, at a temple pulled back to a tie, in front of a tucked ear. The full shade is now
  1 − (1 − Shade)^2.2 (0.95 hides all but a thousandth), the soft edge keeps its own fall. The short cuts, whose look
  was tuned with the skin showing through clipped hair, carry the Shade that draws as they were (0.745 for 0.95,
  0.27 for the shaved head's 0.5). Under a tucked ear's wisps the shade is three tenths: a few hairs grow there.

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
  sides, two highlights, light through from behind), with the bake's own `settings` over it, and the look's own
  `bake` over those (GODOT_LOOK §5u). Since 2026-11-12 every look of the editor's own asks for the first highlight
  **lock by lock** (`streak`: 0.9 on the glossy black, 0.7 on the other dark looks, 0.5 to 0.6 on the light ones): a
  fringe under a light from the front was one even grey sheet, the same on every dark style; and the light looks
  (dark blonde, grey, white) for more light wandering through the hair and less dark between its strands
  (`scatter` 0.6, `occlusion` 0.55), where they read as yarn. The salt and pepper of the two balding cuts is as it
  was. The Studio's own shader has neither: its tab shows the older sheen;
- **`hair_shell`**: `hair_shell.gdshader` (GODOT_LOOK §5u) with the look's root and tip colours;
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

**A card is pictured on the body its style is for** (2026-11-12, `hair2_check.py` `card_body`): the women's on the
Studio's v2female base (the head and neck of the user's own characters, on the feminine base's plain body:
`make.mjs --body v2base`), the men's and the balding cuts on the masculine base, the children's on a child of
eight. They were all on MHR's own body, a broad neck and shoulders under every hime cut. The styles themselves
were gone through the same day with what the two matched ones taught: §10c.

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
  style grown on MHR's base and measured; the hairline's and thinning's pores; what sliders do; other bodies. A
  slider is measured against a plain tie and tail the check sets itself (`PLAIN`), not against whatever the style
  it's tried on has: the day the high twin tails were given Fullness and more strands, two of its lines failed for
  that alone.
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
- **The Advanced styles' faults, as they stand** (2026-11-12, after a close look at each from the side; the first
  three items here were then dealt with in §10c: the space buns' fringe is narrower, so their tendrils have strands,
  and they are all violet with the roots black; brown scalp no longer shows at a pulled-back hairline): the space
  buns have no gathered tendrils at all (under their wide fringe only two face-framing strands grow a side: each
  "lock" is one strand, hard to see from the front, where two thirds of it is edge on) and a blocky dark patch at the
  sideburn; the messy bun's long waved tendrils turned sharply near their tips, and that one is found and fixed (the
  ends' turn was read against the cut's line, §3.7: the space buns', the messy bun's and the high ponytail's tendrils
  no longer hook in toward the neck; their cards made again); the high
  ponytail has a bare strip of scalp at its hairline under its see-through fringe, and two strands from low on the
  temple now hang as a strand of their own across the jaw. Streaks on hair tied into buns still show card-shaped
  flecks close up (the lanes' fix above removed one cause, measured; what is left is unexplained); the underside
  colour of the long waves fans out sideways at the nape; a platinum half reads flat and chalky in Godot's picture of
  it at bust distance (the Studio's closer picture shows its strands; the two weren't taken alike); brown scalp shows at a pulled-back hairline under a see-through fringe. The coil was compared with the
  five older bun styles' cards at their size (the same), not close up.
- **Not there, and needed for a strand render's look** (the user's Daz3D hairstyles, DECISIONS 2026-11-12, after the
  very last): hair drawn as hairs close up. Two things tried, 2026-11-12. More cards: the editor at its limits (high
  detail, 2600 pores, narrow cards, 120 loose strands) reads the same as at its defaults beside a strand render. The
  same cards drawn crisply (`hashed` off, `side_fade` 0, `soft` 0 on the hair's material): the fringe goes from a
  see-through haze to a dark mass whose edge breaks into separate tips, much nearer the reference's, by eye, in one
  still, at three times the reference's scale; nothing is known of it in motion, where a cut-out card can shimmer
  that a dithered one doesn't. So how the cards are drawn matters more than how many; whether a pass of real thin
  strands is needed as well is open (an earlier note here called it the finding: the first test didn't show that).
  Not there either: a way to dye one chosen lock (a single streak in a fringe).
- **The sides of tied hair** (DECISIONS 2026-11-12, the sides: the user's Daz3D hair comes down from the crown round
  the side of the head in a curve, widest at eye level, and tucks in to a small low tie under the ear, with the ear's
  lower half showing). With the sliders there are, *ears covered*, the tie right at the ear and at its lowest, a thin
  tail (8 mm) and the hair left loose come close to that from the front and from three quarters; a thick tail and a
  tie further back make a flat-sided hood, widest at the tie (a tie stands a centimetre and the tail's thickness off
  the skin). Not there: the ear showing. With *ears out* and a tie below the ear the tied hair is broken, in the engine as
  pushed on 2026-11-12: the rule that keeps hair off a tucked ear (extended to tied hair that day) lifts any point
  inside the ear's outline straight up onto its top; a tie under the ear is on the far side of the outline, so a
  strand steps in, is lifted back, and shuttles along the outline without ever reaching its tie (printed: 401 of 469
  tied strands on a side with points on the outline, doubling back on themselves, one 38 cm long). High ties (the
  Advanced styles' buns and ponytail) pass above the ear and are not caught. **Fixed since, and what this note
  said of her ear was wrong:** enlarged seven times, her whole ear shows, with the hair behind it; the look is *ears
  out*, not the ear's top covered. Tied hair now has a route round an ear that's out and hangs to its tie (§3.8:
  Drape, Puff, Fullness, Tie lower); §10 has the match. What this note asked for beyond that: a side volume that can be shaped (on tied hair only Tightness thickens it, to a centimetre at the
  most, evenly: the Volume sliders and Sweep do nothing to it). The outline's numbers (where it's widest, how far it
  pinches at the tie) were met once by a shape that was plainly wrong in the picture: they support a picture, they
  don't stand in for it.
- **The pictures' size, and the cards' pictures** (found 2026-11-12): a picture is the scratch project's window, and
  the window's size is the project's own setting, not resizable; `hair2_shots.gd`'s `root.size` doesn't change it.
  The project was written 960 x 720 once, so every picture was that size whatever `--size` said, and a style's card
  (asked for at 512 x 512, then made 200 x 200 without a crop) is that 4:3 picture squeezed into a square: **the 59
  cards committed before this are a quarter too narrow**. Now a project for each picture size (`_hair2`,
  `_hair2_<W>x<H>`), and a render that fails and says so when a picture isn't the size asked for. Tried: 512 x 512,
  960 x 720 and 1600 x 1200 each come out that size (a window larger than xvfb's 1280 x 1024 screen is no trouble).
  All 65 cards were made again with it the same day, from the same view, and looked at as sheets: none cropped.

## 10. The Daz3D twin tails, held to their picture

DECISIONS 2026-11-12, the 1:1: one hairstyle matched to its picture, to find what the system lacks. The style is
`daz_twin_tails` (the group *From your Daz3D pictures*). The pictures stay out of git (`Saved/Hair2/daz/ref`).

**The head it is held on** is `v2female`, the Character Studio's base made for this (docs/CHARACTER_STUDIO.md §2f):
her head and neck measured from the same two pictures. The test body adds 1.62 m and a full bust (`grow.js`
`V2FEMALE`, `make.mjs --body v2female`). Until it existed the head was the feminine base with a rounder face, its
neck 12 cm across at the ties where hers is 9: every number this section had before was measured on that body and
is replaced below. (Later the same day the base's head came down 0.8 cm on its shoulders, Neck length -0.35: her
collar had been a centimetre over our shoulder line. The hair was measured again on it: nothing below moved by more
than 0.2 cm, and the table is that measure.)

**The rig** (scratch scripts in `rig2/`, not in git; the numbers are what matter). Two cameras, each fitted from
landmarks, pictured by `tools/godot/hair2_check.py shots --origin 0,0,0 --size 1600x1200`:

| her picture | view | the camera | her picture into our frame | landmarks land |
|---|---|---|---|---|
| the fifth (front) | `v:-9.5:5:1.05:22:0:-0.07:-0.02` | 9.5° to her right, 5° above | turned 7.9°, times 2.137 (29.3 px a centimetre) | 3.4 mm off (11 points) |
| the first (her left front) | `v:32:-14.5:1.05:22:0:-0.07:-0.02` | 32° to her left, 14.5° below | turned -4.6°, times 2.091 (29.6 px a centimetre) | 2.8 mm off (10 points) |

- *The landmarks*: on the body, MediaPipe's points through `Content/Studio/Bodies/MHR_landmarks.json` (the eyes'
  middles, the nose's tip, under the nose, the mouth's corners, the chin) and the ear's top, rim and lobe as the
  ear's own extremes in the view (the ear as `sculpt.js` finds it), the far ear's lobe where it shows; in her
  picture, the same points read off gridded enlargements (her irises' middles for the eyes). Every turn and tilt
  is tried on a grid and the roll, scale and shift come in closed form; the mapping that lays her picture into our
  render comes from the same points as our camera draws them. Centimetres are the head's own (`body.js`: a head is
  sized by its height from the top to the chin; v2female's frame is 6.6% smaller than the feminine base's on the
  same skull, because its chin is higher: numbers tuned here are that much large for other bodies).
- *The measure*: the hair's outer edge by height, counted in centimetres from the eyes' line (minus above it),
  where a run of six dark pixels starts coming in from outside the head; on her right and her left in the front
  picture, on her left in the other.
- *Her pose, which the measure has to allow for*: her head is tilted 7.9° on her body in the front picture and
  4.6° the other way in the other. Her hair hangs by the picture's own vertical, so against her head it hangs
  inward on both measured sides (up to a centimetre by the tie, more down the tails), and her body under the chin
  is turned by that much against ours in the frame. Her left side in the front picture can't be measured by its
  edge: her sidelock hangs outermost there.

**What is matched** (`daz_twin_tails`: Drape 1, Fullness 0.33, Puff 0.12, the tie 3.3 cm lower, Gather 7.5 cm; the
tails 10.5 mm thick, flat, widest four fifths of the way down, Fan 0.6; the sidelocks hanging free). Ours against
hers, centimetres, minus where ours is narrower:

| under the eyes' line | front, her right | the other view, her left |
|---|---|---|
| 7 to 1 cm above | -0.4 to +0.1 | (her ears and horns: a headband, not hair) |
| 0 to 1 | +0.2 to +0.3 | -0.9 to -0.7 |
| 2 to 5 | 0.0 to -0.2 | -0.3 to 0.0 |
| 6 to 8 (behind the ear's lower half) | -0.6 to -0.1 | +0.2 to -0.4 |
| 9 to 11 (the tie) | +0.2 to -0.1 | -0.2 to -0.1 |
| 12 to 18 (the tail) | +0.4 to -0.6 | -0.6 to +0.7 (to 14; the picture ends at 15, where ours is 2.1 wide) |
| 19 to 21 | -2.9 to -0.6 (hers flares: loose hair on the tail's outside) | |
| 22 to 24 (the tips) | +0.3 to -0.7 | |

- So the hair's edge is within about half a centimetre of hers from the crown to nine centimetres down the tails.
  What did it on the new head: **Fullness 0.33** (it was 0.1: the top and sides were 0.4 to 0.7 cm short all the way
  round; the plain Volume sliders do nothing to tied hair, whose thickness is Fullness), **the tie 7 mm higher** (Tie
  lower 3.3 cm, from 4: it sat 0.7 cm under hers on both sides, which read as 0.6 to 1 cm too wide just over it), and
  **the tails as flat brushes** (thick 10.5 mm from 8, Flat 1 from 0.7, widest at 0.8 from 0.65, Fan 0.6 from 1:
  they were 0.7 to 1.5 cm narrow from the front and already a little wide from the other view, which is a tail that
  is wide across and thin through; and narrower where it leaves the tie).
- The ears out, the hair behind them, nothing of it across the ear or the cheek.
- The fringe's line (her lash line: 0.034), no gap down its middle, from the top of the head.
- **A long sidelock a side that hangs free** from the fringe's corner, in front of the ear, to the collar (*Hang
  free*, §3.7). They had been drawn in under the chin to a V at the pit of the neck: not the cheek's doing but the
  ends' turn, read against the cut's line.

**What is not** (the list to work from):
1. **The look**, in part. Under a light from the front every strand of ours lit up alike: a grey sheet, where hers
   is black with bright strands. The hair shader has **`streak`** for that (GODOT_LOOK §5u): the first highlight
   lock by lock; 0 for every other hair, 0.9 in the look `gloss_black` through its `bake`. Still different: ours
   is striped evenly across the fringe and the tails where hers has larger dark areas (her light is from one side;
   the rig's is from the front), and hers has a faint teal tint in its highlights. The Studio's own shader has no
   `streak`: its tab shows the old sheen.
2. **The tails' outside, 19 to 21 cm under the eyes' line**: hers flares 0.6 to 2.9 cm wider there, loose hair on the
   outside of the tail; ours has a clean edge. (Hers hang by a vertical tilted 8 degrees against her head; ours are
   a pair.)
3. **Behind the ear's top, in the other view**: 0.7 to 0.9 cm narrow over the first centimetre under the eyes' line.
4. **The fringe's pieces**: hers ends in locks with small steps and gaps; ours in a straighter line.
5. **The sidelocks' body**: hers are flat glossy ribbons a centimetre wide that end in a point, a thin plait beside
   one; ours hang where hers do but are thin strands, and there is no plait.
6. **The red streaks**, the few fine strands across the ear, the flyaways: none.
7. **The back** is in no picture.

**What the earlier findings turned out to be.** Before the base, this section said the hair was 0.4 to 2 cm too wide
by the tie and blamed the head: right, and more than it knew. Three things were stacked: the neck (12 cm across at
the ties, hers 9.3: the base), the tie 0.7 cm too low (this style), and her head's tilt, which swings her hair in
on the measured side (her pose: nothing to fix). *Fullness at the back* (`ties.back`) stays built and unused.

**Not checked here:** the Studio's own tab draws the same hair, but a look's `bake` numbers are Godot's only.

## 10b. The bob of the T-pose reference, held to its picture

DECISIONS 2026-11-12, a T-pose reference: "as a goal try recreate this exact hairstyle too so you can see if it's
possible to get a 1:1". The style is `daz_bob` (the group *From your Daz3D pictures*): a short rounded bob, fullest
at the temples and tucked in at the jaw, a fringe swept from her left over her right eye. It is held on **bodyv2**
(docs/CHARACTER_STUDIO.md §2g: `make.mjs --body bodyv2`).

- **The rig** (scratch): the picture is the whole body, so her head is 160 px tall in it: 6.9 px a head-local
  centimetre. One view, the front, level (`v:0:0:1.05:22:0:-0.07:-0.02`); her picture laid into our render by a
  similarity from five points (her eyes, the mouth's corners, the chin: times 4.5, turned -1.7 degrees, the points
  2.3 of her pixels off at the most). The measure is §10's: the hair's outer edge by height from the eyes' line, on
  both sides.
- **What is matched**, ours against hers in centimetres (minus where ours is narrower; half a centimetre is three of
  her pixels):

  | under the eyes' line | her right | her left |
  |---|---|---|
  | 10 to 1 cm above | +0.3 to +0.7 | -1.5 to -0.1 |
  | 0 to 3 | +0.9 to +1.3 | +0.2 to +0.5 |
  | 4 to 6 (the jaw) | +1.0 to +0.3 | +0.3 to -0.5 |
  | 7 (the tips) | -0.5 | |

  Her hair sits half a centimetre to her left of ours all the way down (her head turned a little, or the hair's own
  lean); with that taken off the outline is within about half a centimetre from the crown to the tips. The length
  (the tips at the lips' height), the rounded line, the fringe's side and its fall over her right brow.
- **What had to be made**: **Tuck under** (§3.5: the first versions hung as a bell, 2 to 3 cm wide at the jaw), and
  the Volume sliders' longer run. No side parting on top (with one the side it lies toward came out fuller; hers is
  even), layers (the upper hair shorter: the bottom thinner).
- **What is not**, and what the picture cannot say: her fringe is a few fine locks over the eye with skin between
  them, ours a fuller sweep; her tips are points toward the mouth, ours a rounded end; pale slivers of skin show
  at her temples between the fringe and the sides, ours is closed there; her top is fuller on her left than her
  right by a centimetre; the look (hers smooth and black, ours streaked under a front light: §10's first item).
  The back and the sides' depth are in no picture.
- **Can it be 1:1?** The outline, yes, to what a 160 px head can show (half a centimetre). The locks, not from this
  picture: it does not resolve them. A close-up of the head would.

## 10c. What the two matched styles taught, in every style

DECISIONS 2026-11-12, the lessons into every style: "take everything you've learnt from the last hairstyles and
enhance improve v2 hairstyles". All 67 were pictured from the front, three quarters, the side and the back **on the
body each is for** (the women's on v2female, the men's on the masculine base, the children's on a child of eight)
before anything was changed, changed, and pictured again from the same four sides: 67 pairs, each looked at. The
pictures are scratch (`Saved/Hair2/imp`); the cards are the result (§6).

**What they taught, as rules** (the "system for aesthetic hair" the 1:1 was for):

1. **The outline first.** Hair is read by its silhouette: how far it stands off the skull at the crown and the
   temples, where it is widest, where it comes in. Measure it; then look.
2. **Tied hair has body and hangs.** The Volume sliders do nothing to it: its thickness is Fullness. Pulled flat
   it is a cap painted on the skull. Low at the nape it hangs to its tie from the head's widest part, and behind
   the ears, not across them.
3. **A tail is a brush**: more hairs than its thickness alone gives, springing out under its tie; twin tails lean
   out.
4. **A fringe is closed at its middle**, from the top of the head, to the lash line.
5. **A bob is round**: fullest at the temples, in at the jaw (the ends' turn on a long radius; Tuck under where it
   ends near the head).
6. **A lock that hangs past the jaw hangs free**; and what is wound from a lock begins where the lock ends (the
   ringlets, §3.7: the user's catch).
7. **Black hair is black with bright strands**, not a grey sheet; and what shows between the hairs is the roots'
   colour, not the skin's.
8. **Judge it on the body it's for, from the side as well.** On MHR's broad shoulders long hair made ledges that a
   slender neck doesn't; and the ringlets floated in the side view alone.

**What changed.** In the engine, for every style: the scalp's shade as it's seen (§3.10), a closed fringe's lock on
the middle (§3.7), a tucked ear's wisps as fine hairs over a light shade (§3.4), ringlets as their lock wound up
(§3.7), Tuck under by a hair's own line (§3.5), the looks' own highlights (§5). In the styles, grown by the engine
as committed and as changed and compared hair by hair on MHR's base: **44 of the 67 have hair that moved; the
other 23 are the same hair by hair** (the men's nine, the five balding cuts, the three for our games, the waves,
the curls, the shaggy layers, the wolf cut, the short swept cut, the rounded bob of §10b) and differ only by the
scalp's shade and the highlights.

| What | Styles | Before, after (v2female's head, centimetres off the skin) |
|---|---|---|
| Tied hair with body (Fullness 0.1 to 0.3, a looser Tightness: eighteen styles with the low ties below) | the high ponytail, the high bun, the half-ups, the high twin tails, two side up, the odango, the side ponytail, the pigtails, the twin buns, the Advanced four | the high ponytail 7 and 10 cm over the ears' line: 0.9 and 0.9, now 1.5 and 1.4 (the matched twin tails: 1.8 and 2.0) |
| Low ties that hang (Drape), behind the ears | the low ponytail, the low bun (ears out: across the ears the gathered hair's lower edge was a rim at the lobe, a helmet's), the small low tails, the low twin tails of the pictures | |
| Tails as brushes (Strands 1.5 to 1.8, Fan 0.3 to 0.5; twin tails Flat and leaning out) | the eleven styles with tails | 28 to 40 hairs a tail, now 49 to 78 |
| Fringes closed, to the lash line (0.035) | every blunt and choppy fringe (eighteen styles); the line on the himes, the high twin tails, two side up, the jellyfish, the split dye | no fringe hair ended within 2 cm of the middle; now the middle lock does |
| Bobs rounder and fuller (Volume, the ends' turn on 4 to 5 cm, Tuck under 0.35 to 0.6) | the sleek bob, the chin bob, the one-eye bob, the short bob, the children's bob, the jellyfish's bob, the sides of sides-short-back-long | the short bob's sides 4 to 10 cm up: 1.9 to 2.4, now 2.8 to 3.1; its crown 1.0, now 1.3 |
| A fuller crown on long hair (Volume 3 to 5 mm more, Lift) | long and straight, the himes, the long ears-out pair, two side up, the half-up, the Korean long, the lob, the drawn long ones, two Advanced | long and straight, 3 and 6 cm from the middle: 0.6 and 1.2, now 0.9 and 1.7 |
| The hime's sidelocks as a step | *Hime cut* (the front cut to the cheek at -4.5 cm, the back long: its sidelocks were face-framing strands over long side hair of the same colour, and could not be seen) | |
| Ears out, the hair behind the shoulders | the four shoulder-length ears-out styles, the peekaboo waves | §3.4 |
| Tendrils that hang free | the Advanced five with long tendrils (Hang free 0.5 to 1); the ringlets' lock (1) | |
| Dyes that read | the space buns (all violet, the roots black, in place of streaks that showed as card-shaped flecks on hair wound into buns), the messy bun's lights (finer, fewer) | |

**The matched two.** The rounded bob is the same hair by hair. The twin tails' fringe has its middle lock: 25 fringe
hairs moved, by a centimetre at the most; nothing else of it moved, and its four pictures before and after are the
same to the eye. Its table (§10) was not measured again.

**Not done, and seen.** The see-through fringes still begin as a row of card ends at the hairline (dark on dark
now; a close-up shows them). Light hair is better and still striped: the strand atlas is the salon's, and the dyed
platinum half of the split dye is drawn by its base look. The peekaboo's rose still fans a little where the nape's
hair rests on the shoulders. Waves read as bands at the side. The short swept cut's edge round the ear is stepped.
The Studio's own view shows none of the highlights' change (its shader has no `streak`). Nothing here was looked at
in motion.

## 10d. The two head cards' own hair: fox_long and pixie_tail (DECISIONS 2026-11-13, two heads)

Two styles in a group of their own (`refs`: "From your pictures: the head cards' own hair"), each after the hair of
one of the two pictures the head cards v2 fox and v2 pixie are after (docs/research/headfit/two_heads.md §3 takes
the hair apart), each pictured on its own head (`node.mjs` `bodyByName("head:v2fox")`: a head card on the bodyv2
body with its lip shape; `hair2_check.py` `card_body`).

- **fox_long** (from `ears_long`): no parting, a heavy fringe to the eyes cut blunt and broken into chunks (Choppy
  0.4, Clump 0.55) with a wider lock between the eyes (Centre lock 0.5), her right ear out with the hair behind it
  (`ears: tucked_right`) and one strand in front of it, the hair on her left hanging in front of the shoulder, to the
  chest. A fringe wider than 44 or heavier than 1 hangs its outer hairs over the ear that should be out.
- **pixie_tail** (from `ponytail_low`): a blunt fringe to the upper lid, one long thin strand a side hanging free
  past the chin, the ears out with a bunch of wisps in front of each, the back full (Fullness 0.5, at the back 0.5,
  Puff 0.25) and gathered into a short tail at the nape; one pink streak in the fringe over her left eye.
- **One streak in the fringe** (`dye.where: "fringe_streak"`, `dye.at`): the fringe's hairs that grow within a few
  degrees of a place round the head (her left +), the Amount its width (1.5 to 13 degrees either way; pixie_tail's is 0: the
  narrowest, about a centimetre of fringe, where the picture's is a few hairs).
- **Not there**: the picture's tail is tied a few centimetres under the nape's hairline. A pony tied that low (its
  height under 0.18, or by its Drop, which is the twin tails') stands its side hair off the head in loops: the tie
  is at the nape. fox_long's strand in front of the ear is thin and short where the picture's is a pointed lock to
  the mouth.

## 11. Files

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

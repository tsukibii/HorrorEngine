# The salon

Hair made of a few dozen locks laid on a character's head by hand, against a reference video whose frames lock to the
view. The plan, the decisions behind it and what comes next are in docs/SALON_PLAN.md; this is what's built.

    python tools/character/serve.py          then http://127.0.0.1:8793/salon.html
                                             ?person=NAME opens a character, ?ref=NAME a reference, ?hair=NAME a hairstyle

## The steps (2026-10-22)

The side panel is the work in order, each step a dropdown, all closed until opened (the ones open are remembered in
the browser); each one's hint says what it's for, or what it's on now (the character, the lock picked):
**1. Character** (whose head), **2. Reference** (a video to trace over, if you like), **3. Start from** (a preset or
a hairstyle), **4. Mirror**, **5. Locks** (draw the hair, in groups; Layer by height), **6. Selected** (the lock
picked), **7. Pull** (how the handles drag), **8. Roots**, **9. Gravity and motion** (let it fall; try the swing),
**10. Finish** (the cover), **11. Volume** (Thicken, padding, the base), **12. Scalp**, **13. Look**, **14. Bake**.
The view turns with the middle or right button (or the left on empty space); the mouse's back and forward buttons,
right-click's menu and Backspace outside a text box don't leave the page, and leaving with unsaved hair asks first
(alone; in the Studio's Hair tab, the Studio asks).

## On a character (2026-10-22)

The hair belongs to a character (DECISIONS 2026-10-22, final): **the Character Studio** makes the character, **the
salon** gives it hair, **the director's desk** uses it in the blocking, and only the finished character (rigged, its
hair on, its animations) goes to Unreal. Nothing goes from the salon to Unreal on its own.

- **Character** (the top bar) lists the Character Studio's characters (`Content/Studio/People/`, git-ignored). Picking
  one draws on **its own body and face**: the Character Studio's **Save** also writes `body.bin`, the body as it shows
  it (MHR with its weights, the fitted face on, no expression, its height). A character never saved there since this
  has only its weights and height (no face) until it is. The Character Studio's Hair tab links here
  (`salon.html?person=NAME`).
- **Save** keeps the hair on the character: `People/<name>/salon/salon.json`. Opening the character again brings it
  back. A character with no hair of its own yet opens **bald** (2026-10-23); to start from another's hair, Load it as a hairstyle.
- **Bake** puts it on the character: `People/<name>/salon/salon.glb` and `salon_bake.json` (with the head frame it was
  made on). The Character Studio wears it (Hair: **made in the salon**): the GLB on the head by that frame, riding the
  body and its head motions; the brows and lashes are the studio's own. After changing the head in the studio, save
  it there and bake again here.
- **Hairstyles** (Start from) are hair kept to start other characters from, `Content/Studio/Hair/<name>/salon.json`
  (**Save as a hairstyle**; `hime_demo`, `salon_demo`): loaded onto whatever head is shown, re-laid on it. With no
  character picked (a base body: Body and Height in Character), Save and Bake write the hairstyle named there.

## The reference

A turntable or orbit video of a wig (or a person) becomes a **locked reference**: each frame with its camera in the
head's own space. Turning the view snaps it onto the frame shot from nearest where you look; the frame is laid over
the head half-transparent (or under it: "behind the head"), so the reference is right from every side, not only front
and side. "Hair only" shows the keyed frames, without the backdrop.

Making one (the gshair environment: `python tools/gshair.py setup` once):

    python tools/gshair.py run VIDEO --orbit --to reference --ref NAME      the capture goes to References/NAME/capture
    python tools/gshair.py reference --out CAPTURE --name NAME        from a capture already made (frames, masks, poses)
    python tools/gshair.py reference --photos FRONT SIDE BACK --name NAME     three photos as three fixed cameras

The salon's own button for it is `POST api/refs/NAME/run` (a video's path, or the photos). It writes
`Content/Studio/Hair/References/NAME/`: `reference.json`, `frames/` and `keyed/` (WebP; the working folder `capture/`
is git-ignored).

**The head's local space**: the origin between the ears, X to the character's left, Y up the face, Z forward, in
units of MHR's face height. Four MHR vertices define it on any body (the right ear side and its mirror, the forehead's
top, the chin), so a reference made on the base body lands on a character of another height or shape.

**The fit** (saved with the hair, in `salon.json`): made automatically when the frames saw a face (a mannequin's
will do): 24 inner-face landmarks triangulated from the frames that saw them, matched to the same landmarks on MHR
(scale, turn, tilt, offset; the MiniMax wig: 5 mm residual). Then by hand: the **Fit ref** tool drags the picture
over the head (the wheel scales it), and sliders: scale, left-right, up-down, front-back, turn (the video under the
head), camera height, sweep (a turn that went further or less than found), "the other way round", **use up to**
(degrees of the turn to use: a video that only reached the side; the rest is the mirrored frames, flipped and its
camera reflected across the head's middle). "Glue again" goes back to the automatic fit. Shift+wheel or the arrow keys
step through the frames.

## The cube (2026-10-22)

The reference sits inside a **cube**: a 3 x 3 x 3 lattice (`ffd.js`) round its hair (the box carved from the keyed
frames: `hull_box` in `reference.json`). With the **Fit ref** tool the cube is drawn in orange with a handle on every
surface point: the corners (white) are shared by three faces, the edges' middles (orange) by two, each face has its
middle (blue). Pulling one bends the picture where that part of the cube faces you: the front face's points bend the
front views, a side's the side views, a corner every view that sees it. Alt-drag moves a point towards or away from
you. **Width, height, depth** stretch the whole cube about its middle (the reference's own move, scale and turn are
the fit's sliders above); **symmetric** pulls the other side's same point mirrored; **Reset the cube** puts every point
back; **Cube round the hair** makes a new one on the hair as it sits now. Undo covers the cube and the fit.

How a frame bends: it's drawn as a 24 x 24 grid, each vertex where its pixel lands once the cube has moved the space it
shows. A pixel's ray is taken to meet the hair at the cube's inscribed ellipsoid (where it enters, or where it passes
closest), that point is moved by the lattice, and projected back with the frame's camera. The lattice interpolates:
the space under a handle moves exactly with it, smoothly between (Blender's Bezier lattice moves it by a fraction; here
a pulled face's middle drags the picture's middle the whole way). The cube is saved with the fit (`fit.cube`).

## The view (2026-10-26)

Buttons over the view, with Blender's keys: **Front** (1), **¾**, **Side L** (3: the character's left) and **Side R**
(Shift+3), **Back** (Shift+1), **Top** (7; from below, Shift+7): the free orbit turned there, the distance, zoom and pan
kept (with the reference locked, the nearest frame). The orbit's pitch reaches 89° either way (it stopped at 69°), so
the crown is seen from straight above. **Ortho** (5) draws without perspective, so what's at different depths lines up
(the head the size it has at its distance; picking and the pan the same as in perspective; the reference's frames are
perspective and stay so).

**Split** (the user's ask: a side view beside the front) puts two panes side by side, each turned on its own (the right
one starts as the character's left side, at the working view's distance): the pane the pointer touches is the one the
buttons, keys and wheel move and every tool works in (placing, the arrow, the handles and the pull's ring, the root
line, picking), by that pane's own camera; a handle dragged in the side pane moves in depth as the front pane sees it.
The gold line along a pane's top marks the active one; drag the line between the panes for their widths, double-click
it to even them; Split again for one view. With the reference locked, each pane snaps to its own nearest frame.

## The locks

| Tool | Key | How | The wheel while placing |
|---|---|---|---|
| Strand | S | click a root on the scalp (tinted blue while a tool is armed), click the end | the sag (how far it bows out); Shift: its width |
| Sheet | L | drag a root line along the scalp, let go, click where it ends | the sag; Shift: the spread of the end |
| Bundle | B | click a root, click the tip | the sag; Shift: the root's width |
| Bundle line | D | drag a line along the scalp (its width), let go, click the tip | the sag; Shift: its height (an oval) |
| Select | V | click a lock; drag a handle (Alt: towards or away from you); the handles in its ring go with it; drag its arrowhead | the pull's reach (down grows it); the sag while the arrow is dragged |
| Fit ref | F | drag the reference picture; the wheel scales it | |

**The lock's vector** (2026-10-26, the user's ask): a placed lock stays **in hand**: an arrow from its root's middle to
its end, an **OK** button at the arrowhead. Drag the arrowhead to set the lock's length and direction from whatever view
(turn the view and drag again: the end is a point in space, kept); Alt-drag takes it towards or away from you; the
wheel while dragging bows it. The lock turns and scales about its root (`salonlib.js`'s `setVector`), keeping the
shaping done by hand: points that lay on the body lie on it again, the rest keep their distance, the end goes where the
cursor is; a twin's arrow moves its original. **OK** or Enter lets go (the lock stays), Delete removes it, and the next
root click starts the next lock. The arrow shows on the selected lock in any tool but Fit; Selected has **Length** (cm
along the lock, the root fixed, grown along its last direction) and **Sag** (the bow) as sliders. The hint under the
view says what to do at each stage (the root placed: click the end, the wheel's sag and Shift+wheel's number; in hand:
the arrow, OK). The wheel bows every type while placing (a sheet got no bow before), Shift+wheel sets the type's own
number (a strand's width, a sheet's spread, a bundle's root width, a bundle line's height).

**Roots slide** (2026-10-26): a lock's green root handle dragged slides the whole lock along the scalp (a sheet's root
line has three: its middle slides the line whole, an end stretches it, the far end staying), the shaping kept as the
arrow keeps it (`slideRoot`); Shift lets a root off the scalp. **Picking** takes the lock nearest in depth under the
cursor and never one the head hides (a lock on the back of the head isn't picked through the face); a click again on
the same spot picks the next lock under it. While a placing tool is armed, a **dot** under the cursor shows where a root
would go: green on the scalp, red off it (the ear, the face); the hint reads a root line's length as it's drawn, and
the dot says when the line has run off the scalp.

**Hair lies on the scalp** (2026-10-22): a new lock is combed onto the head: every point within 3 cm of it is laid on
the skin, 2.5 mm off it (the head's surface is measured from its triangles, 2.5 degrees a bin, 0.3 mm off the real
skin), and only the wheel's bow lifts it (the bow starts flat for every new lock). **Onto the scalp** and **All onto the
scalp** (Selected) lay hair made before down the same way. The scalp runs from the forehead's hairline round the
temples' corners, **down the sideburns** in front of the ears to the tragus, over the ears (not on them) and close
behind them to the nape.

**The pull is Blender's proportional editing** (Pull; 2026-10-22): dragging a handle takes every handle within its
**reach** along, less the farther they are, on its own lock and on the hair round it; the ring shows the reach round
where the handle was, and the handles it takes are lit, brighter the more they move (hovering a handle shows the same
before you pull). The wheel **while dragging** grows (down) or shrinks (up) the reach by a tenth a notch, a hundredth
with Shift, as Blender's does, and the pull is weighed again from where the handles started; Page Up and Page Down too.
**O** turns it off (then only the handle moves). **Falloff**: Smooth (the default), Sphere, Root, Inverse square,
Sharp, Linear, Constant: Blender's curves of d = (reach - distance) / reach, from `calculatePropRatio`. **Scope**
(2026-10-26) is what a pull may move however wide the reach: *This lock*, *This lock and its twin* (the default), *This
group* or *All the hair shown*; the ring lights only what the scope takes, so you see it before pulling. **Locked**
locks and groups (the padlock on each row in Locks, Lock in Selected; a twin follows its original) never move under a
pull, Gravity (they stay as the layer the rest falls onto) or the cover, and All onto the scalp leaves them; they're
still drawn, picked and laid over; `locked` is saved with the lock and the group. A twin's handles pull their
original's (mirrored), so both sides move; roots never move. The reach starts at 8 cm (a long strand's handles are
about 6 cm apart).

**Roots** (2026-10-22): hair comes out of the head. Every guide leaves the scalp **Lift** degrees off it (40 to start;
0 lies flat from the root), the way the hair goes, and bends over into the rest of the lock within **Bend** (2 cm), a
Hermite curve from the root to the guide there; **Natural** gives each guide a little of its own lift and way. It's
done last, once the lock is kept off the body and laid over the hair below, and on whatever pose physics or gravity
gives it, so gravity never flattens it and a root under other hair rises through it (a parting's hair comes out of the
head and arcs over instead of standing straight up and hooking over). The guides are sampled closer near the root (the
k-th of 24 at (k/23)^1.4 along) so the bend shows; the texture, the taper and the bake's skin weights go by each
sample's place along the lock. Saved as `roots` (lift, length, vary).

Ends clicked on the body lie on it (a fringe resting on the brows, a lock on the chest); clicked in the air, on the
plane through the root facing you. Shift lets a root off the scalp. Esc cancels a placing; Delete removes the selected
lock; Ctrl+Z and Ctrl+Shift+Z undo and redo.

- **Strand**: one guide, six control points (a Catmull-Rom). Width from a single hair (1 mm) to a lock (3 cm).
- **Sheet**: the root line plus three edge curves (left, middle, right); the guides across it are blended from them,
  their roots on the line. The edges' points are the handles.
- **Thickness** (strands and sheets, Selected; 2026-10-22): a bundle's volume on a flat lock: a dome over it, half an
  ellipse across it as high as Thickness times half its width (0 flat, the default; 1 round), outward from the head,
  thinning towards the tip by **Thickness taper** (1, the default: to nothing at the tip; 0: as thick all the way).
  Its cards follow the arc from one edge over the top to the other (a strand gets three, a sheet one fewer than its
  guides, 3 to 8); strands (realism) fill round it; physics carries the dome with the lock; layering counts it.
- **Bundle**: a spine with a radius at the root and the tip (wide to gathered, or the other way): a tube of guides.
  Its cross-section is an ellipse: **Height** (Selected) is its other axis as a share of its width, 1 round, less a
  flatter oval lying on the head, more a taller one standing off it.
- **Bundle line** (2026-10-22): a bundle whose root is drawn as a line along the scalp, the line its **diameter**: the
  width across the root is the line's length, its middle the root, the width's way the line's (squared to where the
  bundle leaves the head, if drawn at a slant), gathered to a third at the tip. The wheel while placing sets its
  Height (a tenth a notch); a twin's line is mirrored.
- **Drawn as** cards (stylised: ribbons with a strand texture) or strands (realism: thin lines spread through the
  lock, as many as the slider says).
- **Kept off the body**: the head is a radial field round the skull's middle, the neck and torso horizontal slices
  every centimetre (the arms left out); every guide point is pushed out to 2.5 mm off the skin, and new curves are laid
  over the head before that, so a lock combed down the back lies on it instead of cutting through.
- **Mirror**: with it on, a new lock gets a twin across the seam that follows every edit of its original (dragging
  the twin's handle edits the original, mirrored). The seam is the head's middle or moved sideways (a side parting).
  "Break the mirror" frees a twin; "Mirror once" makes a free copy.
- **Layer by height** (Locks; 2026-10-22): like real hair, what grows higher lies over what grows lower. The locks are
  laid lowest root first; each is pushed out of a map of the hair already laid (how far out it reaches in each
  direction round the skull, 2.5 degrees a bin, both edges of every card counted, a card's 2 mm on top) to 1.5 mm
  over it, the lift spread along the lock so it drapes over what's under it instead of stepping up. Only hair that
  **lies on the head** goes into the map: at each point along a lock, if its lowest part is within 8 mm of where it
  would rest (the skin, or the hair under it), its points there count up to the lock's own thickness (a bundle's
  diameter); a lock pulled out from the head (poking), a sheet's edge lifted off the cheek or hair hanging below the
  head doesn't count, so hair rooted higher passes under a poke instead of being lifted along it (it was lifted 11 cm).
  Any change re-lays them all. The bake takes the layered hair.
- **Groups**: new locks go into the group in gold; the eyes show and hide a group or a lock.

## The cover: the finishing helper (2026-10-22)

Locks placed round a crown can leave a hole in the middle. **Finish** covers it with a **parting**: a root line along
the head's middle (the mirror's seam, so moving the seam makes a side parting), **From** and **To** where it runs (0 the
front hairline, 100 the nape; 10 to 60 to start), each root a **Y**: a stem up from the skin to the top of the hair
over it (the fork; in a gap, none), then two arms, out to both sides over the hair, round the head to 80 degrees off
the parting and then straight down, **Length** long (to start: as long as the hair rooted highest on the head).
**Show the parting** draws the Y's before they're made. **Make the hair** makes them (two sheets a stretch of about 6
cm, in the group **Cover**) and lets them fall: gravity for them alone, the rest of the hair still and in their way,
and **friction** where they touch, so they stay where they lie and slide only where it's steep. Switch gravity off (or
Keep this frame) to keep them, as with gravity; Back to before leaves them as made. Its hair is ordinary sheets
(`cover: true`), refined like any other.

**Covers always lie over all the other hair**, Layer by height on or off: they're laid last, pushed out of a map of
the hair under them (what lies on the head, as layering counts it). Combing is for later.

## Volume (2026-10-22)

**Thicken** (Volume): every card that many times as wide (the strands' widths, a sheet's and a bundle's cards, a
dome's), from 0.5 to 3, the guides where they are; on screen and in the bake. Saved as `volume.thicken`.

**Padding** (Volume) fills **the base** out into one smooth, full mass, the way finished hair reads (no see-through
gaps between locks, no lumps). The base is the groups ticked ▣ in Locks (none ticked: all the hair shown); locks with
physics are left out (they swing). `salonpad.js`, only the head (above the chin; what hangs below is the locks' own):

1. the hull: per direction round the skull's middle (72 x 144 bins, 2.5 degrees), how far out the hair reaches;
2. the gaps closed: the covered bins dilated and eroded back (a morphological closing, 2 to 5 bins by Smooth), a gap's
   radius its neighbours' (a normalized Gaussian average);
3. smoothed: the radius averaged over a Gaussian (1 to 3.5 bins by **Smooth**), lifted by **Thickness** (up to 1.2 cm),
   never under the skin: the mass's outer curve;
4. the flow: each bin's hair direction (the guides' tangents on the sphere, root to tip), averaged; none near: down;
5. the cards: evenly spaced streamlines along the flow on that surface (after Jobard and Lefer 1997: a line starts a
   spacing, 1.2 cm, from the others and stops within half of it), upstream to where the hair starts and downstream to
   where it ends, each a card with the strand texture, its root upstream, 2 mm under the surface (the outer locks lie
   on it, the gaps show it); Thickness adds deeper shells.

**Padding (preview)** shows it; while it's ticked the bake puts it in the still mesh. **The check** under it: how much
of the scalp the hair covers, without and with the padding (the long cut fallen: 88 % and 99.8 %), and how many places
two locks' cards cross at the same height (they clip); **Show where it clips** marks them with red dots. Saved as
`volume` (padding, thickness, smooth); a group's `base`.

**The base** (Volume): bake a good base shape first, then add the swinging flourishes over it. Tick the base's groups
▣ in Locks; with a base, it's laid first and its smooth outside (the padding's hull) is found, and every lock outside
it, physics ones too, is pushed out of that outside by **Clip blend** (1: it lies on the base; 0: it may sink into it;
0.5 halfway: on the long cut, a strand on the scalp sits 15.5, 0 and 7.7 mm into it). **Bake the base** writes
`salon_base.glb`: the base's still locks and its padding as one mesh. **Hide the base** hides its groups and padding;
the base still holds the rest up, roots still go on the skull (the head is what's picked), and the main Bake keeps
the hidden base. Saved as `volume.blend`.

## Presets: starting points finished by gravity (2026-10-22)

**Bald** (2026-10-23) heads the list: no locks, one empty group; with no hair the darkened scalp isn't drawn or baked, so a
bald head is bare. Undo brings the hair back.

**Start from** makes a hairstyle laid out rough on purpose, in layers, to be finished by gravity: make it, switch
Gravity on (or **Make it and let it fall**), and switch it off when it looks right; then refine. It replaces the hair
(undo brings it back). Women: *Long, straight, middle parting* (55 cm), *Long with blunt bangs*, *Hime cut* (blunt
bangs, cheek-length sidelocks), *Chest length, curtain bangs*, *Shoulder length, middle parting*. Men: *Short crop*,
*Two-block, fringe down*, *Middle-part curtains*.

How they're made (`salonpresets.js`): the scalp is covered in rows of sheets from the nape to the top (six for women,
seven for men, each split into the runs that are on the scalp, so a row stops at the ear and goes on behind it), the
left side mirrored to the right as twins; each sheet combed by where it grows (the front band away from the face from
a parting, the temples down by the face, the rest down; a fringe forward, curtains out from the middle), its tips at
the style's cut (a height: the waist, the chest, the shoulders, the brows, the cheekbones) or a length for short hair,
each a little longer or shorter than the next so the ends don't line up; the top a parting of Y's (the cover). Layer by
height on; short hair lifts less at the root (Roots). They're built on the head shown, so they fit any MHR body.

Nobody publishes presets made this way that we found. The way of working is known: grooms are left to settle under
gravity and the result kept (Houdini's guide simulation; its forum on keeping a groom from flopping when gravity comes
in), Bertails et al. (Eurographics 2005) predict natural hair shapes as the statics of rods under gravity, and Hsu,
Yuksel et al. (SIGGRAPH 2023) solve the opposite, keeping a styled groom from sagging.

**Gravity's Friction and Root hold** (Gravity and motion), for every fall: friction where hair touches the head or the hair
(1: it stays on slopes under 45 degrees; 0: it slides round the head, as before), and the roots' stiffness (0.5: each
strand's first 7 cm keep their comb, fading along it, while the rest falls; 0: nothing holds them).

**Shading by depth** is now by what's over the hair: how far each point is under the hair's outer surface (all the hair
shown), so the outermost hair is lit however close to the skin it lies; below the chin, the distance off the body.

## The scalp (2026-10-22)

The **Scalp** panel darkens the skin under the hair so the hair doesn't look sparse: a flat colour (the look's roots'
colour unless set by hand), **no shine and no shader**, on the scalp's triangles (the same outline the roots keep to,
sideburns in, the ears and the face out). **Thickness** is its opacity, sparse (0) to full (1, the skin hidden);
**Soft edge** fades it in over the last centimetre or so above the hairline, so there's no hard line on the forehead.
It's a copy of the head's scalp triangles half a millimetre off the skin, unlit, its alpha per vertex. Saved in
`salon.json` (`scalp`: on, thickness, soft, colour); the bake carries it as `hair_scalp` (unlit, alpha-blended).

It replaced the trace, glow and fill (the user's call, 2026-10-22: a mass of hair under the shader didn't look good).

## Physics and the bake (2026-10-22)

**Physics** is per lock (Selected: **Physics (it swings)**), game-grade (`salonphys.js`): the lock's own control
curves are its chains (a strand's points, a bundle's spine, a sheet's three edges, tied together point by point), the
root pinned to the head, the rest Verlet points held towards the styled shape (**Floppy-stiff**), so a still head
keeps the style exactly; they lag and swing when the head moves, keep their lengths, are pushed off the body, and
gravity pulls only as far as the head is tilted from upright (**Gravity**). **Rustle** is a wind with no direction:
a small sway both ways. **Gravity and motion** (Swing) turns, nods, shakes or walks the head (the hair with it); **still** stops
it and the locks settle back. No bending springs, no solver, one step a frame.

**Gravity** (Gravity and motion, 2026-10-22): the switch drops **all** the hair shown, physics ticked or not: nothing holds a lock
to its style, real gravity pulls it down, the roots stay, the lengths are kept, the body pushes it out, and it lies on
the head and shoulders or hangs (`salonphys.js`, drop mode, the same chains as the swing). Every moment is recorded (30
a second, 12 s at most); **Moment** slides back to any of them, **Pause** and **Run on** carry on from there. Switching
off, or **Keep this frame**, makes the moment shown the hair's shape, exactly as it's drawn: a twin falls as its
original's fall mirrored (on its own only when its original is hidden), and with Layer by height on every moment is laid
in layers as the kept hair will be. Pull up by hand what should stick up. **Back to before** drops the fall; undo takes a kept one back. **Strength** scales gravity.

**Bake** puts the hair on the character (On a character, above): `People/<name>/salon/salon.glb` (a binary glTF,
the head's local space in metres; with no character, the hairstyle's `Content/Studio/Hair/<name>/salon.glb`) and
`salon_bake.json` (the numbers, the head frame it was made on, each swinging lock's settings). The glTF loads anywhere
(three.js, Blender, Unreal), but the swing (the chains' physics) and the hair shader need the runtime's own: the
Character Studio shows it still on the head for now; Unreal gets it with the finished character.

- Every lock with physics is **its own skinned mesh** on bones along its chains (a strand or bundle one chain of six,
  a sheet three), each vertex on the two nearest joints along and the two nearest chains across (four influences),
  its physics settings in the mesh's extras for the runtime.
- Everything else is **one mesh**: each card simplified to **Points along a card** (8 by default; the live hair has 24;
  a swinging lock keeps at least 12), or **Keep every point** for no reduction: lighter for a game with many
  characters, heavier where few are on screen (saved with the hair, the preview follows it), cut out at 0.4
  and tinted by vertex colours; the darkened scalp is its own mesh, `hair_scalp`. `hime_demo`: 5 410 vertices live,
  1 440 baked, 503 KB.
- **Smoothing** (2026-10-23; only in the bake, the hair you edit stays as it is). **Smooth curves**: evenly spaced, an
  arch over the roots or a bend could be cut to a sharp tent; while a kept corner turns more than 60 degrees (down to 15
  at 1), the point beside it the kept line misses most (its distance, plus how far the card's edge moves where it
  twists) is kept too. The vertices go only where cards bend (the test's hair at 1: 256 -> 456 points, corners over 45
  degrees 21 -> 14; the long cut at 0.5 looks like the bake that keeps every point). **Tame flyaways**: the hair's
  outer surface is its radius in each direction from the head's middle (a 24 x 48 grid, the 70th percentile, the gaps
  filled and blurred); what stands beyond it (by 12 mm at the least taming, 2 at the most) is pressed in towards it by
  up to 85 %, so the layers keep their order, the pull eased along each card so it bends into it instead of buckling,
  never nearer the head than 3 mm, nothing below the chin: a ring of roots standing round the crown comes down. Tried
  and dropped: easing each card's curve (cut corners pulled cards into the skull; kept at their lengths, long strands
  swung out), flattening each card's bumps (it flattened the roots' lift too and opened the partings), squaring a
  pulled card's width to its new line (it flipped where the card turned: shards).
- **Preview the bake** shows only the bake: the file it would write, read back (three.js's GLTFLoader), the hair you
  edit and its live scalp hidden; it's made again a moment after the hair changes (a lock, the padding, the scalp, the
  look), left-drag only turns the head, and a drawing tool (or Gravity) ends it. It's the file's own look (the strand
  atlas on a plain material, as the Character Studio shows it), not the salon's hair shader. Two changes at once (a
  tick and a slider) start two previews; only the newest is shown.

## The look (2026-10-22)

The hair is drawn with a strand texture and a hair shader, after the user's reference (glossy black anime-realism hair:
a cool blue sheen in streaks along the strands, a few crimson strands, pointed see-through clump tips, dark roots).

- **The strand atlas** (`hairtex.js`), made in code: 34 clumps of 14 to 27 strands run root to tip; each clump draws
  together to a point over its last stretch and its strands stop at their own lengths, so a card's tip is see-through
  and pointed. Coverage, root to tip: 0.69 down to half way, 0.46, 0.23, 0.05, nothing. Its channels: the strand's
  brightness, the strand's own number (its highlight's shift; the inner-colour strands), the clump's number. A card
  shows 0.3 of its width (about eight clumps).
- **The shader** (`hairshader.js`): Kajiya-Kay's two highlights with each strand's tangent shifted along the card's
  normal (a sharp pale one towards the root, a broad tinted one towards the tip), a soft sheen from where you look
  broken into streaks clump by clump, wrapped diffuse, dark roots, the inner colour, a cool rim, and **depth**: hair
  near the skin is in the outer layers' shade (each vertex's distance off the body). Cut out softly with alpha to
  coverage.
- **Looks** (Look, **Hair look**): *Jet black, blue sheen, crimson strands* (the reference, the default),
  natural black, dark brown, ash brown, chestnut, black with red underneath. Then by hand: the roots', lengths', shine,
  sheen and inner colours, the inner amount, **Glossy**, **Highlight** (towards the roots or the tips), **Streaks**
  (a smooth band to broken streaks). Saved in `salon.json` (`look.hair`, `look.custom`). A lock's **own colour**
  replaces the look's on that lock; **colour by lock** still tells them apart.
- **The bake** carries it: the atlas with the look's colours baked in as the cards' texture (glTF's MASK cut-out, the
  shader can't go in a glTF), the look's numbers in the material's extras for a runtime that has the shader.
- **Retro** (2026-10-23, hides imperfections; all off unless asked): **Flat (unlit)**, the hair's own colours whatever
  the light (no highlights, no shading: card edges and spikes don't catch the light), a little darker inside; **Flat
  brightness**; **Colour steps** (posterized, as old consoles' colours were; 0 off); **PSX dither** (the PlayStation's
  4 x 4 ordered dither between the steps, 32 a channel unless Colour steps says fewer). In the shader the steps and
  the dither are in the screen's colours; the bake carries them: Flat is an unlit material (glTF's
  `KHR_materials_unlit`), the brightness, steps and dither go into the cards' texture (the dither in its pixels).
- **Soft edges** (2026-10-24, 0.5 unless set; brows and lashes 0): the hair's outline dissolves instead of ending in
  spikes, after the user's reference (docs/research/look_reference.md): the cut's fade wider, the last fifth of each
  card feathered, a card seen edge-on fading, all through alpha to coverage (the browser's 4x MSAA). The Studio draws
  the baked cards the same way (their faint fringe as coverage, not cut at a hard line). Unity's and Unreal's hair is
  softer still with temporal anti-aliasing (docs/research/hair_cards_unreal.md); SALON measures the edges change.

`hime_demo` is a hime cut built like the reference (a blunt fringe at the brows, sidelocks to the collarbones, the
crown and back, two low tails), on the darkened scalp.

## The file

`People/<name>/salon/salon.json` (or a hairstyle's `Content/Studio/Hair/<name>/salon.json`): `head` (`person`, the
character it's on, or the body preset and height), `reference` (its name, the view
settings, the fit), `mirror`, `look`, `groups`, `locks`. Every point is in the head's local space, so the hair moves
to another body with it. A lock: `id`, `type`, `name`, `group`, `visible`, `render`, `taper`, `color`, `mirror_of`, and
by type `pts` and `width` (strand), `root`, `edges` and `guides` (sheet), `thickness` and `thicknessTaper` (both), `spine`, `r0`, `r1`, `height` (1 round),
`axis` (a bundle line's width, or none) and `guides` (bundle); `cover` (a sheet the cover made: laid over all the rest).
`roots`: how hair comes out of the head (lift in degrees, length in metres, vary), for every lock.

## Code

`salon.html` and `salon.js` (the page), `salonlib.js` (locks, curves, the collider, the mirror, the pull: plain arrays, node
can run it), `salonref.js` (the reference's cameras, the fit, picking the frame), `ffd.js` (the cube: a lattice, its handles, the
ellipsoid depth), `salonpresets.js` (the starting points), `salonpad.js` (the padding), `salonphys.js` (the chains, the step, the
skin weights), `hairtex.js` (the strand atlas, the looks), `hairshader.js` (the hair shader), `gshair/reference.py` (the reference from a capture or photos, the face fit, the hair's box), `serve.py` (`api/refs`, `api/salon`, a hairstyle through `api/hair`, a character's hair through `api/people/<name>/salon/`, its body as `api/people/<name>/body.bin`).

## Checks

- `node tools/character/salontest.js`: SALON (the server running; `BODY_URL` for another port): the side panel's
  fourteen steps in order, closed until opened; the preview of the bake (only it shown, its bones bending it, made
  again when a lock is hidden and shown, ended by a drawing tool); the view snaps onto
  the MiniMax reference's frames at 0, 90, 180 and 270 degrees with the frame's camera exactly, the far side mirrored
  with half the turn, the fit moving the cameras; the cube's front face dragged with the mouse bending the front view
  and not the back (and undone); the darkened scalp (on the scalp only, the face clear, faded at the hairline, the
  thickness applied); physics on
  a bundle (a shake swings its tip 10 cm, the root stays, still settles it); the bake (one skinned mesh, one static
  with fewer vertices, the scalp unlit and blended, a glTF whose bind pose is exact and whose root bone bends it, the
  look's texture in it); the bake's smoothing (Smooth curves: more points kept, fewer sharp corners; Tame flyaways:
  hair brought in only, never nearer the head than 3 mm, nothing below the chin; the hair you edit unchanged); the
  retro look (Flat unlit on the hair shader, an unlit material in the bake); the look (the atlas see-through at its tips, every card on the hair shader, a look restyling them); a strand, a sheet and a bundle placed with the mouse; Mirror's twin
  following a pulled handle; no guide point inside the body; undo, redo; the pull (Blender's seven curves exactly, the
  wheel's 1.1 and 1.01, a strand's pull moving its own handles and the next strand's where the smooth falloff says and
  none beyond the reach, the wheel mid-drag growing the reach until it takes the next strand, O, a twin's pull moving
  its original mirrored); a bundle line; thickness; Thicken (every card twice as wide at 2, the guides unmoved); padding (the long cut: the scalp
  covered at least as well and 97 % or more, the cards along the nearest hair, none in the body or over the smooth
  outside, a physics lock left out, one base group alone, more still vertices in the bake); the base (baked alone with its padding, hidden yet holding a strand up, Clip blend
  0, 1 and 0.5, the main bake keeping it); the presets (all eight on the head, mirrored, at least 90 % of the
  scalp covered, the long cut falling clear of the face, undone); the roots (a strand on the crown leaving
  the scalp at its lift and bending over, flat at Lift 0, the same after gravity); the cover (the parting's Y's previewed at the top hair's length,
  made on the middle line and the skin, out to their own sides, the forks lifted onto the hair, over all of it, hardly
  sliding on top as they fall, kept exactly as shown, the rest unmoved, undone); a save and a reload; on a character
  (the Character Studio saves its body, the salon opens it at that height, Save keeps the hair on it, Save as a
  hairstyle keeps it with no character, Bake writes onto it, it reopens with its hair, and the Character Studio wears
  it over the head's top, centred).
- `python tools/gshair.py check`: GSHAIR includes the reference: the cameras moved into the head's space reproject the
  face exactly, and the face fit of a head onto itself is scale 1, no offset, no turn.

## Not built yet (docs/SALON_PLAN.md)

Tracing the outline over the reference, the galleries (fringes, sidelocks, tails, colours), the brushes (comb, grow,
puff, smooth) and the curl, frizz and clump sliders, the cap and the brows and lashes, a drawn seam, the clothed body's collision, a photo's own nudge in the page (the data has it:
`fit.per_frame`), the player's-eye view.

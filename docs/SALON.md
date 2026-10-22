# The salon

Hair made of a few dozen locks laid on an MHR head by hand, against a reference video whose frames lock to the view.
The plan, the decisions behind it and what comes next are in docs/SALON_PLAN.md; this is what's built.

    python tools/character/serve.py          then http://127.0.0.1:8793/salon.html
                                             ?ref=NAME opens a reference, ?hair=NAME a saved hair

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

## The locks

| Tool | Key | How | The wheel while placing |
|---|---|---|---|
| Strand | S | click a root on the scalp (tinted blue while a tool is armed), click the end | the sag (how far it bows out) |
| Sheet | L | drag a root line along the scalp, let go, click where it ends | the spread of the end |
| Bundle | B | click a root, click the tip | the root's width |
| Bundle line | D | drag a line along the scalp (its width), let go, click the tip | its height (an oval) |
| Select | V | click a lock; drag a handle (Alt: towards or away from you); the handles in its ring go with it | the pull's reach (down grows it) |
| Cover | C | click on the head over a gap: the finishing helper's plane (Finish) | its size |
| Fit ref | F | drag the reference picture; the wheel scales it | |

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
Sharp, Linear, Constant: Blender's curves of d = (reach - distance) / reach, from `calculatePropRatio`. **This lock
only** keeps it to the lock you pull. A twin's handles pull their original's (mirrored), so both sides move; roots
never move. The reach starts at 8 cm (a long strand's handles are about 6 cm apart).

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

Locks placed round a crown can leave a hole in the middle. The **Cover** tool (C) puts a **plane** over it: a click on
the head lays it there, following the head and the hair already on it (it goes round the skull's middle by arc length,
then sits on the hair shown), its **seam** (green, the plane's middle) running up the view. In **Finish**: **Width**
(across the seam, half to each side), **Height** (along the seam: the root line's length), **Turn** (the seam turned
from the view's up); the wheel sizes it. **Make the hair** turns it into two sheets rooted on the seam (on the skin),
combed out over the plane to each side, in the group **Cover**, and lets them fall: gravity on for them alone, the rest
of the hair still and in their way (they land on it, not through it to the skin). Switch gravity off (or Keep this
frame) to keep them, as with gravity; Back to before leaves them as made. The plane is a helper, not saved; its hair
is ordinary sheets (`cover: true`), refined like any other.

**Covers always lie over all the other hair**, Layer by height on or off: they're laid last, pushed out of a map of
the hair under them (what lies on the head, as layering counts it). Hair laid along the head is already where gravity
leaves it, so a cover over the crown hardly moves; what reaches past the head's widest, or off the hair's edge, hangs.
Combing is for later.

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
a small sway both ways. The **Move** panel turns, nods, shakes or walks the head (the hair with it); **still** stops
it and the locks settle back. No bending springs, no solver, one step a frame.

**Gravity** (Move, 2026-10-22): the switch drops **all** the hair shown, physics ticked or not: nothing holds a lock
to its style, real gravity pulls it down, the roots stay, the lengths are kept, the body pushes it out, and it lies on
the head and shoulders or hangs (`salonphys.js`, drop mode, the same chains as the swing). Every moment is recorded (30
a second, 12 s at most); **Moment** slides back to any of them, **Pause** and **Run on** carry on from there. Switching
off, or **Keep this frame**, makes the moment shown the hair's shape, exactly as it's drawn: a twin falls as its
original's fall mirrored (on its own only when its original is hidden), and with Layer by height on every moment is laid
in layers as the kept hair will be. Pull up by hand what should stick up. **Back to before** drops the fall; undo takes a kept one back. **Strength** scales gravity.

**Bake** writes the hair for a game: `Content/Studio/Hair/<name>/salon.glb` (a binary glTF, the head's local space in
metres) and `salon_bake.json` (the numbers, the head it was made on, each swinging lock's settings).

- Every lock with physics is **its own skinned mesh** on bones along its chains (a strand or bundle one chain of six,
  a sheet three), each vertex on the two nearest joints along and the two nearest chains across (four influences),
  its physics settings in the mesh's extras for the runtime.
- Everything else is **one mesh**: each card simplified to 8 points along it (the live hair has 24), cut out at 0.4
  and tinted by vertex colours; the darkened scalp is its own mesh, `hair_scalp`. `hime_demo`: 5 410 vertices live,
  1 440 baked, 503 KB.
- **show the bake** loads the file back (three.js's GLTFLoader) in place of the live hair.

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
- **Looks** (Head and look, **Hair look**): *Jet black, blue sheen, crimson strands* (the reference, the default),
  natural black, dark brown, ash brown, chestnut, black with red underneath. Then by hand: the roots', lengths', shine,
  sheen and inner colours, the inner amount, **Glossy**, **Highlight** (towards the roots or the tips), **Streaks**
  (a smooth band to broken streaks). Saved in `salon.json` (`look.hair`, `look.custom`). A lock's **own colour**
  replaces the look's on that lock; **colour by lock** still tells them apart.
- **The bake** carries it: the atlas with the look's colours baked in as the cards' texture (glTF's MASK cut-out, the
  shader can't go in a glTF), the look's numbers in the material's extras for a runtime that has the shader.

`hime_demo` is a hime cut built like the reference (a blunt fringe at the brows, sidelocks to the collarbones, the
crown and back, two low tails), on the darkened scalp.

## The file

`Content/Studio/Hair/<name>/salon.json`: `head` (the body preset, its height), `reference` (its name, the view
settings, the fit), `mirror`, `look`, `groups`, `locks`. Every point is in the head's local space, so the hair moves
to another body with it. A lock: `id`, `type`, `name`, `group`, `visible`, `render`, `taper`, `color`, `mirror_of`, and
by type `pts` and `width` (strand), `root`, `edges` and `guides` (sheet), `thickness` and `thicknessTaper` (both), `spine`, `r0`, `r1`, `height` (1 round),
`axis` (a bundle line's width, or none) and `guides` (bundle); `cover` (a sheet the cover made: laid over all the rest).

## Code

`salon.html` and `salon.js` (the page), `salonlib.js` (locks, curves, the collider, the mirror, the pull: plain arrays, node
can run it), `salonref.js` (the reference's cameras, the fit, picking the frame), `ffd.js` (the cube: a lattice, its handles, the
ellipsoid depth), `salonphys.js` (the chains, the step, the
skin weights), `hairtex.js` (the strand atlas, the looks), `hairshader.js` (the hair shader), `gshair/reference.py` (the reference from a capture or photos, the face fit, the hair's box), `serve.py` (`api/refs`, `api/salon`, `salon.json` through `api/hair`).

## Checks

- `node tools/character/salontest.js`: SALON (the server running; `BODY_URL` for another port): the view snaps onto
  the MiniMax reference's frames at 0, 90, 180 and 270 degrees with the frame's camera exactly, the far side mirrored
  with half the turn, the fit moving the cameras; the cube's front face dragged with the mouse bending the front view
  and not the back (and undone); the darkened scalp (on the scalp only, the face clear, faded at the hairline, the
  thickness applied); physics on
  a bundle (a shake swings its tip 10 cm, the root stays, still settles it); the bake (one skinned mesh, one static
  with fewer vertices, the scalp unlit and blended, a glTF whose bind pose is exact and whose root bone bends it, the
  look's texture in it); the
  look (the atlas see-through at its tips, every card on the hair shader, a look restyling them); a strand, a sheet and a bundle placed with the mouse; Mirror's twin
  following a pulled handle; no guide point inside the body; undo, redo; the pull (Blender's seven curves exactly, the
  wheel's 1.1 and 1.01, a strand's pull moving its own handles and the next strand's where the smooth falloff says and
  none beyond the reach, the wheel mid-drag growing the reach until it takes the next strand, O, a twin's pull moving
  its original mirrored); a bundle line; thickness; the cover (its plane on the hair at the size asked, its two sheets
  rooted on the seam and over all the other hair, falling, kept exactly as shown, the rest unmoved, undone); a save and
  a reload.
- `python tools/gshair.py check`: GSHAIR includes the reference: the cameras moved into the head's space reproject the
  face exactly, and the face fit of a head onto itself is scale 1, no offset, no turn.

## Not built yet (docs/SALON_PLAN.md)

Tracing the outline over the reference, the galleries (fringes, sidelocks, tails, colours), the brushes (comb, grow,
puff, smooth) and the curl, frizz and clump sliders, the cap and the brows and lashes, a drawn seam, the clothed body's collision, a photo's own nudge in the page (the data has it:
`fit.per_frame`), the player's-eye view.

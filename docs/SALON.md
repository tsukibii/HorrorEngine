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
| Select | V | click a lock; drag a handle (Alt: towards or away from you) | |
| Fit ref | F | drag the reference picture; the wheel scales it | |

Ends clicked on the body lie on it (a fringe resting on the brows, a lock on the chest); clicked in the air, on the
plane through the root facing you. Shift lets a root off the scalp. Esc cancels a placing; Delete removes the selected
lock; Ctrl+Z and Ctrl+Shift+Z undo and redo.

- **Strand**: one guide, six control points (a Catmull-Rom). Width from a single hair (1 mm) to a lock (3 cm).
- **Sheet**: the root line plus three edge curves (left, middle, right); the guides across it are blended from them,
  their roots on the line. The edges' points are the handles; pulling one bends the rest of that edge after it.
- **Bundle**: a spine with a radius at the root and the tip (wide to gathered, or the other way): a tube of guides.
- **Drawn as** cards (stylised: ribbons with a strand texture) or strands (realism: thin lines spread through the
  lock, as many as the slider says).
- **Kept off the body**: the head is a radial field round the skull's middle, the neck and torso horizontal slices
  every centimetre (the arms left out); every guide point is pushed out to 4 mm off the skin, and new curves are laid
  over the head before that, so a lock combed down the back lies on it instead of cutting through.
- **Mirror**: with it on, a new lock gets a twin across the seam that follows every edit of its original (dragging
  the twin's handle edits the original, mirrored). The seam is the head's middle or moved sideways (a side parting).
  "Break the mirror" frees a twin; "Mirror once" makes a free copy.
- **Groups**: new locks go into the group in gold; the eyes show and hide a group or a lock.

## The file

`Content/Studio/Hair/<name>/salon.json`: `head` (the body preset, its height), `reference` (its name, the view
settings, the fit), `mirror`, `look`, `groups`, `locks`. Every point is in the head's local space, so the hair moves
to another body with it. A lock: `id`, `type`, `name`, `group`, `visible`, `render`, `taper`, `color`, `mirror_of`, and
by type `pts` and `width` (strand), `root`, `edges` and `guides` (sheet), `spine`, `r0`, `r1` and `guides` (bundle).

## Code

`salon.html` and `salon.js` (the page), `salonlib.js` (locks, curves, the collider, the mirror: plain arrays, node can
run it), `salonref.js` (the reference's cameras, the fit, picking the frame), `ffd.js` (the cube: a lattice, its handles, the
ellipsoid depth), `gshair/reference.py` (the reference from a capture or photos, the face fit, the hair's box), `serve.py` (`api/refs`, `api/salon`, `salon.json` through `api/hair`).

## Checks

- `node tools/character/salontest.js`: SALON (the server running; `BODY_URL` for another port): the view snaps onto
  the MiniMax reference's frames at 0, 90, 180 and 270 degrees with the frame's camera exactly, the far side mirrored
  with half the turn, the fit moving the cameras; the cube's front face dragged with the mouse bending the front view
  and not the back (and undone); a strand, a sheet and a bundle placed with the mouse; Mirror's twin
  following a pulled handle; no guide point inside the body; undo, redo; a save and a reload.
- `python tools/gshair.py check`: GSHAIR includes the reference: the cameras moved into the head's space reproject the
  face exactly, and the face fit of a head onto itself is scale 1, no offset, no turn.

## Not built yet (docs/SALON_PLAN.md)

Tracing the outline over the reference, the galleries (fringes, sidelocks, tails, colours), the brushes (comb, grow,
puff, smooth) and the curl, frizz and clump sliders, the cap and the brows and lashes, a drawn seam, physics (jiggle and
the rustle), the clothed body's collision, the bake, a photo's own nudge in the page (the data has it:
`fit.per_frame`), the player's-eye view.

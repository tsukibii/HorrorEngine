# Brows and lashes: the procedural hair technique, for `groom.js`

DECISIONS 2026-10-31 (the last): our own brows and lashes, no Blender bake. This is what the common Blender approach
(the one many tutorials teach, built from Blender's stock hair node groups: Generate Hair Curves, Clump, Noise, Trim,
Curl, Rotate, Smooth, Restore Segment Length) does to make brows and lashes look grown rather than drawn, written in
our words, and what `tools/character/groom.js` does with it. The numbers are ours, tuned on the Studio's faces.

## The idea: every setting is a profile, not a number

A brow or a lash row is a line (inner corner to outer end). Every setting takes a value at the inner end, one at the
outer end, a blend that says where along the line it changes, and a random spread per hair. A brow's density is lower
at its head than its tail; its hairs stand up at the head and lie out along the body; a lash row's lashes are longer in
the middle and outer third. `groom.js` does this with its stations (`profile`) and its handles.

## Brows

- **Growth on the skin**: roots scattered over the brow's region, each hair a short curve lying on the skin (shrinkwrap
  to the surface, then restore its length), its direction from two turns: the head's hairs up, the body's and tail's
  out and down, the top and bottom rows converging toward a middle line. Ours: the band between the brow's edges, the
  flow from the head, body and tail angles and Toward the middle (already built).
- **Trimmed edges**: hairs near the brow's top, bottom and head cut shorter, as a groomed brow is. Ours: **Trimmed
  edges** (a hair's length shortened by up to half near the band's edges and front).
- **Length spread**: lengths vary a lot hair to hair (a long stray here and there). Ours: a skewed spread (`r*r`), a few
  long ones.
- **Clumping**: hairs gathered toward a guide hair in small groups (about 2 mm), the tips pulled most, the roots kept.
  Ours: **Clumps** (a guide grown from the middle of each 2 by 1.5 mm cell of the band; each hair's points pulled toward
  the guide's, rising toward the tip).
- **Noise**: a fine frizz along each hair and a per-hair offset. Ours: **Frizz** (a small sine wave along the hair,
  sideways on the skin, a little off it).

## Lashes

- **Take-off**: lashes leave the lid's edge forward, at a moderate angle (35 to 45 degrees off the lid's surface), then
  curl up. Ours: `lash()`'s exit and lift.
- **Curl concentrated toward the tip**: the curvature profile rises along the lash, so a lash is nearly straight out of
  the lid and bends near its end (the look of a curled lash; a uniform curl reads as a fan). Ours: **Curl at the tip**
  (the curl's exponent along the lash, 1 to 3.5).
- **Corner trim**: shorter at the inner corner. Ours: Inner length (already built).
- **Tight clumps**: lashes drawn together at their tips in small irregular groups (a clump is 1 mm or so). Ours:
  **Clumps** in groups of two to six, pulled harder (up to 0.92 at the tip).
- **Length randomness**: strong (some short lashes between the long). Ours: **Uneven** (about a third of the lashes at
  half to three-quarters length).
- **Noise**: a little wave and lean per lash. Ours: **Frizz**.
- **Lower lashes**: fewer, shorter, a flatter take-off, looser clumps. Ours: Lower lashes, Lower length, Lower angle.

# Two heads from two pictures: the references, read by hand

The analysis behind the head cards **v2 fox** and **v2 pixie** and the hairstyles that go with them (DECISIONS
2026-11-13, two heads). The pictures stay out of git (`Saved/Heads/ref/h1.png`, `h2.png`); every number below is in
the pictures' own pixels, read on enlargements with a grid (`out/h1_grid.jpg`, `out/h2_grid.jpg`, and the feature
crops `out/h1_eyes.jpg`, `out/h1_nose_mouth.jpg`, `out/h2_face_big.jpg`: `lm.py` and the lines in this file's last
section make them again).

## 0. What went wrong first, and the rule it left

The first heads were fitted by machine: MediaPipe's points on the front picture, an outline match on the side one.
The user, on seeing them: *"I don't think you've analyzed the original images well enough, the faces you make look
like parody distortions."* They were right.

- **MediaPipe on a stylised face under a fringe is not a measurement.** On h1 it put the eyes' outer corners 153 px
  apart; they are 172 px apart (the lash line's ends under the hair). Every proportion it gave was off by that 12%,
  and each in its own direction: a wider jaw, a wider nose, a wider mouth, smaller eyes. Fitted, that is a round face
  with a big nose.
- **A side picture alone doesn't say how the head is turned**, and a longer nose seen a little more from the front
  draws the same outline as a short one in true profile. Left free, the outline fit paid for the angle with the nose:
  a tip pulled a centimetre down, a nose base at the mouth.
- **Held to a number from one angle, a head can be wrong from every other.** The front picture's lower face is 0.7
  of the eyes' span across at the mouth; a head made that narrow matched the number and looked deformed. The user:
  *"instead of doing 1:1, try match the angle and profile only 1:1, but for the other angles use common sense and
  aestheticism, you don't want disfigured looking female heads."*
- **The check that would have caught it at once**: read the picture a head was already made from (d5, v2female's own)
  by hand, the same way. Its numbers and h1's are the same within a few percent (§1). h1 is v2female's head with
  small changes, and so, most likely, is h2: the same family of face.

The rule: **measure by hand first, on the picture and on the picture of a head we already have; move a slider only
for a difference both readings agree on; start from the nearest head that exists.** The fits are kept as tools that
draw ours over the picture (`pover.py`), not as the source of the values.

## 1. h1: the front picture (red turtleneck)

Head turned about 16 degrees to her left, seen from a little above; a relaxed, half-lidded look to her left.

| read by hand (shares of the eyes' span, outer corner to outer corner) | h1 | d5 (v2female's own picture) |
|---|---|---|
| an eye's length, corner to corner (the two averaged) | 0.30 | 0.30 |
| between the eyes (inner corners) | 0.40 | 0.40 |
| eyes' line to the nose's base | 0.38 | 0.38 |
| eyes' line to the mouth's line | 0.575 | 0.57 |
| eyes' line to the chin | 0.88 | 0.92 |
| mouth's width | 0.38 | 0.365 |
| nose's width (the wings' outer edges) | 0.22 | 0.24 |

The points (h1's pixels): eyes' outer corners (139, 226) and (311, 226), inner (196, 229) and (264, 227.5); nose tip
(247, 275), its base y 293, the wings' outer edges x 221 and 259; mouth corners (200, 327.5) and (265, 323), the
bow's dip x 240, the lips' line y 326; chin's lower edge y 378.

What is hers and not v2female's:

- **Eyes**: long and narrow, the upper lid resting a third of the way down the iris (the iris is 18 px across, a
  third of the eye's length; 13 px of the opening's height shows). The outer corner 2 to 3 degrees higher than the
  inner: a mild lift; the fox look is the liner's wing past the corner. A clear, thin crease 5 px over the lash line,
  parallel to it. Brows thin, straight and low on the inside, 26 px over the lid.
- **Nose**: very small and narrow (0.22 of the eyes' span where a person's is 0.36 to 0.40), no drawn bridge, a
  small tip with a soft highlight, the nostrils two short commas: a touch turned up.
- **Lips**: a heart: the upper lip thin at the corners with a sharp, high bow (peaks 11 px apart), 10 px tall at its
  middle; the lower lip fuller (12.5 px) and narrower than the upper (about 0.7 of the mouth); the corners end in a
  fine upward tail. The mouth small: 0.38 of the eyes' span.
- **Jaw and chin**: a clean V from the cheeks, no angle, to a small soft point; the face is 125 px wide at the mouth's
  height (0.73 of the eyes' span), the chin 43 px wide 6 px over its edge.
- **Head and neck**: nothing to read: the skull is under the hair and the neck in the collar.

## 2. h2: the side picture (sailor collar)

Her left side, seen 15 to 25 degrees from in front of a true profile (the far eye's lashes show past the bridge; the
near eye's front is 17 px behind the nasion where a true profile would have about 9), the head tipped back about 11
degrees, the mouth parted.

The outline (`profile.py`'s `PROFILES["h2"]`: traced row by row where the skin's colour begins, set right by hand
where the background is skin-coloured) and what it measures (`profile.py h2`: shares of the face's height, nasion to
menton, 109 px):

| | h2 | v2female, same camera |
|---|---|---|
| nasion to the nose's tip | 0.41 | 0.31 |
| the tip off the line nasion to upper lip | 0.115 | 0.077 |
| the tip to the upper lip | 0.22 | 0.24 |
| nasion to the mouth | 0.62 | 0.61 |
| the mouth to menton | 0.41 | 0.40 |
| lips against the line tip to chin | on it | 1 to 2% in front |
| the jaw's line against the eye-to-ear line | 33 degrees | 39 |
| the ear's height | 0.54 | 0.53 |
| the ear's axis against the eye-to-ear line | 84 degrees | 99 |

What is hers:

- **Nose**: a long, smooth, slightly hollow bridge to a small round tip that stands a little further out than
  v2female's and sits nearer the lip; under it the outline runs on to the lip with hardly a notch: the nose is turned
  up and the upper lip is short and full. The wing is tiny (9 px from the tip to its crease).
- **Lips**: both forward, on the line from the nose's tip to the chin; the upper lip's red turned up, the lower full.
- **Chin**: small, flat in front, a little behind the lips; a shallow fold under the lower lip.
- **Jaw**: its lower border rises to the ear more steeply than MHR's: a short back to the jaw, a soft angle.
- **Eye**: big: 15 px from lid to lid where the ear is 59 px tall; long lashes above; the white shows beside a large
  iris.
- **Ear**: of ordinary height, small in its upper part, leaning back.
- **Skull and neck**: the head from the forehead to the back of the hair is 219 px, about twice the face's height: a
  full, round skull over a small face. The neck is slim (about 90 px front to back at the choker) and leans forward.

## 3. The hair, taken apart

**h1**: jet black, glossy, straight, long (past the frame: to the chest). No parting: a heavy fringe from the crown
to the eyes, cut blunt but broken into chunks, a wider centre lock between the eyes down to the nose's bridge, a gap
either side of it showing the forehead, fine strands across the eyes. Her right ear out, the hair behind it; one
pointed strand in front of that ear to the mouth's height. On her left the hair hangs straight in front of the
shoulder, over the ear.

**h2**: jet black, glossy with fine glints, one thin pink streak in the fringe over her left eye. A blunt fringe to
the upper lid. One long thin strand from the fringe's corner hanging free past the chin. The side hair swept back
over the ear's top, the ear out; a dense bunch of short wisps in front of the ear tapering to points at the jaw. The
back full and round (a bob's volume), gathered loosely into a short tail tied low on the neck.

## 4. What the cards ended as

- **v2 fox** (h1): MHR head weights of its own (head shapes 20 -1.2, 24 -0.5, 23 +0.4 from the feminine base's: a
  slimmer lower face) and v2female's sculpt with the eyes a little lifted and larger, the nose smaller and a little
  narrower, the mouth a little wider, the chin narrower. Lids: opening -1.5, tilt 0.5, crease 0.4. Lips: v2 fox.
  Read the way §1 reads the picture, its face at the mouth's height is still wider than hers: held to her number it
  was a head the user called deformed (§0).
- **v2 pixie** (h2): head shape 20 -0.8, and v2female's sculpt with Nose base 0.9, the tip out 0.7 and down only
  0.4, the bridge hollowed, the chin shorter and set back, Jaw line 0.5, larger eyes. Lids: size 0.5, opening 0.2.
  Lips: v2 pixie. Seen by the picture's camera its outline is 1.7 mm rms from the trace (v2female's 2.4): nose length
  0.39 of the face's height (hers 0.41), the tip 0.13 off the line nasion to upper lip (0.115).

## 5. The tools

- `lm.py h1`: MediaPipe's points (for the camera's angle only: §0).
- `direct.mjs v2female v2fox v2pixie`: each head's front proportions straight off its mesh, in §1's shares.
- `headshapes.mjs`: what each of MHR's twenty head shapes does to a face (shape 20: the whole lower face slimmer).
- `profile.py h2`: the side picture's trace and its measures; `out/h2_ref.jpg` the picture with the trace on it.
- `profit.mjs h2 --sculpt FILE --iters 0 --tag T`: a head seen by the picture's camera (only the camera fitted; FILE
  `{ sculpt, weights, jaw }`); `pover.py h2 T`: its outline over the picture and both tables. `--yaw`: the camera
  held at an angle. Left to fit the sliders too, it finds the hooked nose (§0): it is for looking, not for choosing.
- `tools/character/headshots.mjs`: the Studio's own page pictured from the pictures' angles, the head wearing its
  hairstyle and a makeup look, through a long lens (`--fov 20`): the thing to put beside the picture. A bald head
  under the Studio's close-up camera reads as a caricature whatever its proportions.
- `tools/character/hair2/make.mjs --body head:v2fox` + `tools/godot/hair2_check.py shots`: the bare head (or the
  head and a hairstyle) pictured by Godot in half a minute: the quick look from three sides.

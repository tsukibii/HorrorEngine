# The cute eye: one picture's opening, fitted (DECISIONS 2026-11-17, cuter eyes)

What's built is in docs/CHARACTER_STUDIO.md §2o (the shape key, the switch, the card) and docs/GODOT_LOOK.md §5ab (wet
eyes). This is how the picture was read and how the key's numbers were found, so another eye shape can be made the
same way from another picture.

## The picture

One eye, 102 by 45 pixels, soft (the user made it with a Polaroid prompt). Kept out of git:
`Saved/Eyes/ref/cute_eye.png` (to be sent again in a new session). The user then traced its outline with a mouse and
asked for smoother lines.

**Which eye.** The user: "the right side eye at a front view". Read as the eye on the right of a face's picture (her
left eye), the nose to the picture's left. So the low, pointed corner is the inner one and the high corner the outer:
the eye slants up toward the temple. Beside the words:

| In the picture | Says |
|---|---|
| the low corner comes to a point, no pink flesh in it, a dark line running on down past it | a single lid's skin over the inner corner (the tear duct covered) |
| the skin is brightest to the picture's left | a flash on the bridge of the nose; the side of the face falls away darker |
| the iris sits toward the low corner, the white shows on the other side | eyes turned in toward a close camera |
| the upper lid peaks past the middle, toward the high corner | as single-lidded eyes do (the fold pulls the inner half down) |

Against: the bright wet blob at the high corner could be the tear duct's flesh, which would make that the inner
corner and the eye a drooping one. If the user says so, mirror the outline (below) and fit again.

## The outline

`Content/Studio/Eyes/cute_outline.json`: the two corners and each lid as a dozen points, in the picture's pixels times
ten. Read two ways and put together:

1. **From the picture**: the eye's opening (iris and white) is where the skin's redness, `r - (g + b) / 2`, is under
   0.125 after a little blur; the skin is over 0.15 everywhere. Its top and bottom edges column by column are the
   lids. (It can't find the corners: the picture is too soft there.)
2. **From the tracing**: the opening is one closed leaf; its point is at the lower left where the dark line ends; the
   lids meet at the upper right, above the bright blob; the upper lid's line carries on past that corner, down to
   the right (the tail: not part of the opening).

`tools/eye_patch.py` `cute_target` joins the points, resamples them evenly and passes them through a 1-2-1 filter 36
times (the corners kept): the smoother lines.

In numbers, for an opening 24.5 mm from corner to corner (ours, where the lids meet the eyeball):

- the corners' line: the outer corner **20.6 degrees** higher (a new character's eye: 2.2);
- over that line the upper lid rises to **8.5 mm**, a little inward of its middle; it leaves the inner corner at 47
  degrees and comes down to the outer one nearly square (a blunt outer end);
- under it the lower lid goes to **4.7 mm**;
- in the picture's own frame the upper lid's highest point is past the middle toward the outer corner and the lower
  lid's lowest by the inner corner: nearly all of that is the tilt;
- the iris is **0.58** of the opening's length across (ours at Iris size 31: 0.43; at 36: 0.58), its top a third
  under the lid, the white showing 3 mm under it by the inner corner. That last part is the pose (she looks up about
  15 degrees), not the shape.

## The key, and the fit

The Cute eye shape key is five moves (CHARACTER_STUDIO §2o): the inner corner narrowed, each lid's edge turned by a
profile, the corners lifted and lowered about a pivot (the diagonal), the eyeball's height in its lids, and the skin
it has moved smoothed. The profiles
(17 values a lid) and the tilt are found by `fit.py`:

    python docs/research/cute_eye/fit.py Content/Studio/People/<a new character>/body.bin --picture fit.png   # look first
    python docs/research/cute_eye/fit.py Content/Studio/People/<a new character>/body.bin --write             # into eye_patch.py and eyegraft.js
    python tools/eye_patch.py check                                                                           # EYEPATCH

Each pass: the graft placed on the body with the key at 1 (`eye_patch.apply`), the opening taken in the frame of its
own corners, the outline sized to the opening's length as it now is, each profile value moved by how far the lid's
edge is under the outline there (as an angle about the eye's x axis), a little smoothing (more by the corners), the
tilt moved by half its error. Sixty passes. The body is a new character's as the Studio saves it (the v2female head:
what a user starts from); none: MHR's base. `fit.jpg` here is its picture: the outline in red, the opening before
(grey) and after (white), the eyeball and an iris of 36 degrees.

| | tilt | the lids' edges from the outline (rms, most) |
|---|---|---|
| a new character (fitted on it) | 20.6 (the picture's 20.6) | 0.08 mm, 0.27 |
| MHR's plain base (the same numbers) | 19.6 | 0.19 mm, 0.54 |

What isn't fitted: the pinch at the inner corner, how far the skin follows each move (`CUTE_REACH`), the pivot and the
eyeball's height, chosen by looking at the Studio's pictures and by measuring the skin's creases (CHARACTER_STUDIO
§2o has the table). With the opening placed by the picture's own iris (its upward gaze taken as shape) the lower lid
would lie 10 mm under the eyeball's middle; with the eye's whole iris showing the level eye looks startled.

## What it took (docs/LESSONS.md has them)

A lid turned alone bunched under its fold; the inner corner narrowed by the lids' own turn crumpled the skin beside
it (a squeeze every point near it takes doesn't); the first fit was against an outline 5% too big (size the outline by
the opening as it is); the first error measure blew up at the blunt outer end (measure each point to the nearest part
of its lid's line). Then **the side sag** the user ringed, a fold from the outer corner down the cheek: the diagonal as
a turn of the whole region pushed skin sideways (a lift straight up and down doesn't); whole columns of skin following
the lids' profiles creased wherever a profile changes fast (only skin near the edge follows it; further off a gentler
one); all the lift at the outer corner, where there's least skin (a pivot 4 mm outward shares it with the inner one).

## Another eye from another picture

Trace the opening into a file like `cute_outline.json` (two corners, a dozen points a lid, the picture's pixels, the
nose to the left), point `CUTE_OUTLINE` at it or pass the fit a copy of the key under a new name, fit on a new
character's body, look at the Studio's pictures, then the pinch and the rise by eye. A shape that isn't a single
lid's wants its own Crease and Inner fold in its switch's keys (`CUTE_KEYS`).

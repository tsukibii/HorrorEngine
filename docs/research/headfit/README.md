# headfit: a head preset from one picture's landmarks

The scripts the three head presets after the user's Daz3D faces were made with (docs/CHARACTER_STUDIO.md §2h,
DECISIONS 2026-11-12, make-up enhanced), as they were run. The pictures stay out of git (`Saved/Hair2/daz/ref/`,
`Saved/Body/ref/`); what the scripts write goes to `out/` here (ignored).

- `lm.py [name ...]`: MediaPipe's face landmarks (the Studio's own model, `vendor/face_mesh`: run it with that
  environment's Python, from `out/`) on a crop of each reference picture: `<name>.json` (478 points in the picture's
  pixels, the expression scores), `<name>_lm.jpg` to look at. The crops are its `SRC` table.
- `fit.mjs <name> [--prior plain] [--sculpt FILE --iters 0] [--lim 3] [--tag T]`: the sculpt values whose head
  lands on those points: MediaPipe's 468 points on MHR's feminine head as a trial head preset makes it
  (`grownBody`'s `trialHead`), a camera fitted with the sliders. Across and down the picture count, depth hardly;
  the mouth and the brows count less where her expression moves them; the forehead under a fringe hardly. With
  `--sculpt FILE --iters 0` only the camera is fitted, for values already chosen. Writes `<name>_fit.json` and
  `<name><tag>_proj.json` (the head's triangles in the picture's pixels).
- `over.py <name> [tag ...]`: the fitted head's outline, eye rings, nose base and lips drawn over the picture, a
  panel a tag, the bare crop first.

How it was used: `fit.mjs <name> --prior plain --lim 3` on v2female's own picture (d5) and on each new face; a new
head is v2female's values plus what its fit differs from d5's (in full for the eyes, the nose's size and width, the
face's and the chin's length; by 0.7 for the mouth's width, the jaw, the chin's width and the taper; by half for
the rest), then looked at with `over.py`. The detector draws every outline toward an average face: on d5 the fit
alone leaves v2female's narrow jaw out, which is why nothing is taken from one fit alone.

## Two heads read by hand (DECISIONS 2026-11-13, two heads): `two_heads.md`

v2 fox and v2 pixie were not made the way above: on their pictures the detector was 12% off (a fringe over the eyes'
corners) and one of the two is a profile it can't read at all. `two_heads.md` is the analysis and the rule it left;
its tools are here: `profile.py` (a side picture's traced outline and its measures), `profit.mjs` + `pover.py` (a
head seen by that picture's camera, drawn over it), `direct.mjs` (a head's front proportions off its mesh),
`headshapes.mjs` (what MHR's own head shapes do). `fit.mjs` also writes its head's 468 points in the picture
(`lm` in `_proj.json`); `lm.py` reads h1 and h2 (`Saved/Heads/ref/`).


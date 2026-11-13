# The body fit: a base from a T-pose picture

Scripts as they were run to make the Character Studio's **bodyv2** base (docs/CHARACTER_STUDIO.md §2g, DECISIONS
2026-11-12, a T-pose reference). Research scripts, not a tool: no check runs them, and the numbers at their tops are
that one picture's. The picture itself is the user's and stays out of git (`Saved/Body/ref/t1.jpg`).

Run from the repo's root; the fit's own files go to `Saved/Body/fit` (or `$BODYFIT`).

| script | what it does |
|---|---|
| `sil.py` | the figure cut from the picture's backdrop: `t1_mask.png`, and its runs across by height |
| `targets.py` | what the picture says, as shares of the bare height: the legs' edges, the trunk's half width, the arms' top and bottom by how far out, the face's marks. The skull's top, the sole and the middle (`TOP`, `FLOOR`, `CX`) and the marks' rows were read off enlargements by hand. Writes `t1_targets.json` |
| `fit.mjs` | MHR's body shapes and the Studio's sliders fitted to those measures: the feminine base with v2female's head in the Studio's T-pose, cut by planes; Gauss-Newton with ridges; the picture's scale and floor as unknowns. `--iters 60 --lenridge 8 --bumpridge 6 --out NAME` is the run the base came from; `--iters 0 --start NAME.fit.json` prints a fit's measures |
| `depth.mjs` | a body's width, depth and tape at the bust, the waist, the belly and the hips (`file`: the base in the presets file; `plain`: v2female on the feminine body; or a fit's file) |
| `over.mjs`, `over.py` | a fit's T-pose outline drawn over the picture |
| `glb.mjs` | the whole body at rest as a .glb for `tools/godot/hair2_check.py shots` (`file`, `plain`, `fem`, or a fit's file) |

What the fit holds and why is in §2g. To use a second picture (a side view above all): add its measures to
`targets.py` and its residuals to `fit.mjs` `measure` in place of `DEPTHS`, which are a medium build's depths put there
because the first picture shows the front alone.

`fit.mjs` gives the body being tried to `grownBody` as `trial: { weights, sculpt }` with `body2: 1`; with a `bodyv2` in
the presets file the same call without `trial` is the base itself.

## alter/: the two alterations of bodyv2 (DECISIONS 2026-11-12, make-up enhanced)

`alter/fitw.py ['{"name": {measure: cm, ...}}']`: MHR body weights from target measures, starting from bodyv2's
(`mhr.py` `fit_measures`; the head's measures held), into `alter/out/weights.json`. `alter/meas.mjs [cand.json]`:
each candidate (`{name: {weights: "<name in weights.json>" | "bodyv2", sculpt: {...}}}`; `alter/cand.json` is the
last one tried) made as the Studio makes it on v2female's head at 1.63 m: the tape round the bust, the waist and
the hips, the shoulders and a thigh across, and its triangles for `alter/sil.py name ...`, which draws each from the
front and the side. v2athletic and v2hourglass are the second fit (docs/CHARACTER_STUDIO.md §2h).

## lowpoly/: v2 pear, after the user's low-poly character (DECISIONS 2026-11-13, more body presets)

The picture (`Saved/Body/ref/lowpoly.png`, out of git) is a torso from three quarters in front and behind.
`lowpoly/fitw.py '{"name": {measure: cm, ...}}'`: as `alter/fitw.py`, but added to `alter/out/weights.json` instead of
replacing it. `alter/meas.mjs lowpoly/cand.json`: the candidates made as the Studio makes them (`anime` and `own` for
the Anime bust); `lowpoly/cand.json` is the one kept. `lowpoly/view34.py name ... [--ref] [--yaw -55,-150]`: each
seen from the picture's two sides, from under the bust to above the knee, and measured as the picture is: the width
across at each height, the waist's against the widest row's, and the widths below it; `--ref` puts the picture's two
halves beside the first body, scaled so its waist and its widest row are at the same heights. Writes
`lowpoly/out/view.jpg`.

`lowpoly/outline.py name ... [--back]`: the outline from the front between the knee and the ribs (`--back`: the
back's, from the side), drawn large, and how far it turns within any 4 cm: what a corner is, in a number.

What was tried: MHR's weights alone (they stop at 3 before the waist is small enough: `pearA` to `pearD`); Hips, Seat
and Thighs stacked on them (`c1` to `c3`: the widths, with a dip under the seat and bands on the thigh); one control
for the lower body, `sculpt.js` `pear` (`d1` to `d3`, `e1`, `e2`: the picture's ratios, 0.45 and 0.48, and its
corners: the outline turned 34 degrees at the hip, which the user sent back); then the control as a long curve from
a fitted centre line, the seat grown evenly (`f1` to `f3`, `g1` to `g4`). v2 pear is `g3` on `pearD`'s weights
(asked of the fit: shoulders 47, chest 23, bust 15, waist 32.5, belly 12.8, hips 42, seat −14, thighs 17.6, neck
13.8): the waist 0.49 and 0.51 of the widest row (the picture's 0.47 and 0.49), the outline turning 17 degrees at
the most (v2 hourglass's 18).

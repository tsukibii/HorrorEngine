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

# The hair splat on clay

Hair for a character without modelling it: a Gaussian splat of a real wig, captured with a phone, glued to a few
invisible clumps of clay that jiggle on the head. The look is the splat (a painted-on image of real hair, soft and
layered); the motion is cheap (a dozen or so short spring chains, pinned to the scalp); nothing per strand is simulated
or drawn. `tools/gshair.py` makes it; the Studio's `gshair.html` shows it on the character's head.

Where it comes from: GaussianHair (Luo et al. 2024, arXiv 2402.10483) reconstructs hair from a phone video as strands
of thin Gaussians with a hair scattering model. We don't want strands in a game (docs/DECISIONS.md: the look over the
simulation, light in medium shots), so this takes the paper's capture, its differentiable splatting, its alpha and
orientation losses and its UE4-style hair shading, and swaps the strands for the user's clay: a plain splat grouped
into clumps on chains. Nothing of the paper's code or data is used; nothing trained is shipped.

## What it needs

- **The environment:** `python tools/gshair.py setup` makes `vendor/gshair/` (git-ignored): a uv environment with
  PyTorch (CUDA from PyPI's wheel; `--cpu` for the CPU one), NumPy, OpenCV, SciPy and MediaPipe, and MediaPipe's
  three models (hair, person, face; Apache-2.0, no account). No CUDA extension to build: the splatter is plain PyTorch
  (`tools/character/gshair/raster.py`), minutes on the 3090, hours on a CPU.
- **No network while it runs:** every step runs under `unshare -rn` (nothing in it can reach out) with every proxy
  pointed at a dead port and `DO_NOT_TRACK` set, the way Perm and MediaPipe are run. Nothing is sent anywhere.
- **A video** of the wig. The capture (what the other session worked out):
  - a wig on a **matte green** mannequin head (paint or tape, not glossy), a green backdrop; a person works too
    (`--key hair` masks the hair with MediaPipe, the face anchors the cameras), sitting very still;
  - **texture on the floor** round the stand (newspaper, printed patterns): the cameras are found from fixed details
    in the picture, and a blank green world with a black wig leaves them lost; the key drops the patterns afterwards;
  - soft, even light, no sun moving, no fan;
  - the camera the user has: about 0.4 megapixels and a little soft, which is fine for the stylised realism the
    characters have now (not Unreal's humans). A soft, small frame gives the feature matcher less to hold, so the
    texture round the stand matters more, not less, and the sweep should be slow (small steps between frames);
    focus and exposure locked; 0.6 to 1 m away, three loops (eye level, from above, from a little below), a minute
    each. About 90 sharp frames are picked; the splat works at the frame's own size (`--res`).

## The steps

    python tools/gshair.py run VIDEO --name NAME [--key green|hair|keyed:DIR] [--head mhr|NAME|head.obj] [--iters 4000] [--res 540] [--clumps 16]

makes `Content/Studio/People/NAME/gshair/` (git-ignored), one step after another; `--from STEP` picks up where one
stopped; each step is also its own command (`python tools/gshair.py STEP --out DIR ...`, `--help` for its options):

| Step | What | Look at |
|---|---|---|
| `frames` | the sharpest frame in each of 90 windows of the video, saved at 1080 px with the lens's focal guess (`--focal35`, a phone's main camera is 24 to 26 mm) | `frames/` |
| `masks` | the hair cut out: `green` a chroma key (`--hue`), the largest piece kept, the spill taken out; `hair` MediaPipe's segmenter; `keyed:DIR` PNGs with alpha from a better keyer (CorridorKey) used as the pictures too. Always the face points where a face is seen, and a Gabor bank's 2D hair orientation per pixel | `masks/*_hair.png`, `masks.json` |
| `poses` | where the camera was in each frame, no COLMAP. `--orbit` for a turntable (a rotating head on a plain backdrop, a MiniMax orbit): cameras on an even circle (`--sweep`, `--elevation`, `--distance`, `--front`), refined with the splat; otherwise with a face, PnP of its 468 points against the same points pinned on the character's head (the world is the head's); without, the essential matrix of a starting pair; then features (SIFT) chained round the head and one bundle adjustment over poses, points and the focal | `poses_sheet.jpg` (the head's points or the feature points drawn over frames), `cameras.json` report: `rms`, `sweep_deg`, `anchored` |
| `splat` | 3DGS of the hair: ellipsoid Gaussians seeded in the hair's visual hull (the masks carve it), trained against the keyed frames with L1 + D-SSIM, an alpha loss and the orientation loss (the long Gaussians along the hair's direction); clone, split and prune as 3DGS. Every tenth frame held out | `splat_sheet.jpg` (held-out: the picture, the render, the orientation as hue), `splat.json`: `psnr_heldout`, `gaussians`, `anisotropy_mean` |
| `clumps` | the clay: the splat fitted onto the character's head (a wig's world is free: up from the cameras, front from the first frame, scaled to the skull: a guess the page finishes), grouped into `--clumps` blobs (k-means, the vertical squashed so a lock stays one blob), each a chain of `--joints` pinned to the scalp; every Gaussian kept in its chain's frame | `splat.json` report: `clump_size`, `chain_m`; `align.json` |

The page: `python tools/character/serve.py`, then `http://127.0.0.1:8793/gshair.html?name=NAME` (the launcher's Pages).
The character's head (grey) with the splat on it; the head still, turning, nodding, shaking or walking; the jiggle's
gravity, hold and damping; the look (roughness, shift, specular, ambient, the light's direction, the splats' size and
opacity); the clay shown as amber blobs on their chains; the fit (move, turn, tip, tilt, scale; a wig's first fit is a
guess) and **Glue again** (re-clusters on the server with the fit kept in `align.json`); the chains exported as JSON.
Everything runs on the GPU from two float textures (the chains, the Gaussians); the Gaussians are sorted by their chain
segment's depth each frame, which is right within a clump's thickness.

The shading on the page is the paper's: the UE4 approximation of Marschner (R, TT, TRT along each Gaussian's long axis;
Karis 2016) plus its local scattering term, with how deep a Gaussian sits in the hair standing in for the light's
transmittance. The splat's colours keep the capture's light: film flat, and the page's light adds the game's.

## The first real capture (2026-10-22)

A MiniMax orbit of a wig on a green bust (640 px, 124 frames, 5 s). What it taught:

- **The key** had to go by brightness as well as hue: the bust is a paler, less saturated green than the backdrop
  (hue 43 to 48 in OpenCV's units, saturation down to 0.17), and the black wig carries green spill (its hue is the
  backdrop's). Green is now: the hue in range, saturation over 0.12, value over 0.4; dark pixels are hair whatever
  their hue (`--val` lower for a light wig). The result: the wig alone, the face opening cut out.
- **A plain green world has nothing to match features on**, and MediaPipe's face on the bust doesn't fit MHR's
  points well enough to anchor; so `poses --orbit`: the frames on an even circle, which is what a turntable or an
  AI orbit is. The sweep, the front frame and the elevation are told, not found; the splat's pose refinement
  takes up the slack; the clay's fit does the scale.
- A generated video isn't a photograph of one object: MiniMax's wig may change a little as it turns. The held-out
  PSNR says how consistent it was.

## The check

    python tools/gshair.py check [--keep] [--full]          GSHAIR ok
    node tools/character/gshairtest.js [DIR]                GSHAIRPAGE ok (the page, headless; the desk's server running)

The check runs the whole pipeline on a synthetic capture (256 px frames: about the user's 0.4 MP footage) on the CPU in a few minutes: the splatter's gradients against
finite differences (cylinders and ellipsoids), the Gabor orientation on stripes, the green key, then a known wig on
MHR's head rendered from a sweep of cameras, once as a person (the face anchors the poses: camera centres within a few
mm) and once as a mannequin (a pair to start, the chain round, the bundle: the centres within a few mm after the
similarity a free world needs), the splat (held-out PSNR) and the clay (the Gaussians' distance to the true hair with
the true alignment and with the guessed one). `--keep` leaves it in `vendor/gshair/check/` for the page test.

## Unreal

The characters have moved away from Unreal's humans (docs/DECISIONS.md), so this is for later, if ever. Unreal 5.8 has no splat renderer of its own; the free plugins are for static scenes and untested on Linux, and none
follows bones. Two routes, neither built yet (the first test is on the page):

1. **The splat as a Niagara layer:** each Gaussian a particle on its clump's bones (the chains exported from the page
   are the bones; Kawaii Physics or the same spring jiggle), sorted and blended like the page does. A week or two of
   engine work; sorting against other translucent things (glass, fog) is the unknown.
2. **Bake it onto the clay:** the clumps as meshes with bones, the splat baked onto them as textures with see-through
   edges from the angles that matter. An ordinary skeletal mesh then: the game's lights with a normal map, Kawaii
   Physics, Linux, no plugin. Softer up close is lost; at a 1.2 m medium shot it hardly shows.

## Limits

- The light is baked into the splat: a wig filmed under a lamp looks lit by that lamp. Film flat; the page's shading
  adds the rest, as an approximation.
- A wig's capture has no face, so its world is the first camera's and its scale the starting pair's baseline: the
  fit onto the head is a guess (up, front, width) to finish on the page. Its cameras have nothing to anchor them
  either: the check's 256 px synthetic sweep (30 frames, 12 degrees apart, about the user's 0.4 MP footage) poses
  them within 35 mm mean before the splat refines them; a 90-frame sweep is better conditioned.
- Camera poses need texture in the picture (the floor patterns) and a steady sweep; a capture that won't chain can
  bring a COLMAP text model (`poses --colmap DIR`).
- Dark hair against dark backgrounds keys badly; green it is. Glossy green reflects the room and leaves patches.
- Pure PyTorch: the splatter lists every (Gaussian, pixel) pair, so memory grows with the hair's size on screen and
  the Gaussian count; `--res` and `--init` bring it down. 40 M pairs is the budget per frame.

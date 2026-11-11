# The fit test's scripts

A research prototype (`../fit_test.md`): ready-made MakeHuman garments carried onto the Character Studio's MHR bodies.
It has no check, isn't on the launcher and nothing in the Studio uses it. It is kept so the test can be run again and
so a real build has something to start from. Nothing of MakeHuman's is in the repo: the files below are fetched.

| File | What |
|---|---|
| `lib.py` | MakeHuman's base mesh and `.mhclo` clothes read, MHR's body and rig, closest points on a mesh |
| `register.py` | once per source body: MakeHuman's `hm08` registered onto MHR's average body (pose, joints, skin onto skin) |
| `fit.py` | a garment onto MHR's average at rest, then onto any body, out of the skin, the skin it hides; a second UV in metres; the garment's own detail as a layer |
| `bodies.mjs` | the Studio's seven test bodies as the Studio makes them |
| `render.mjs` | contact sheets by three.js in headless Chromium; `LOOKS` puts the tailor's fabrics and a PNG decal on a garment |

## Running it

Python needs numpy, scipy and pillow; node needs Playwright (as the browser checks do).

```bash
cd /path/to/HorrorEngine/docs/research/clothing_v2/proto
```

```bash
git clone --depth 1 https://github.com/makehumancommunity/mpfb2 /tmp/mpfb2
```

```bash
curl -L -o /tmp/mh_system_CC0.zip https://github.com/Makehuman-2/MH2_Asset_Repository_CCO/releases/download/CC0/mh_system_CC0.zip
```

```bash
mkdir -p /tmp/mh_system && cd /tmp/mh_system && unzip -q -o /tmp/mh_system_CC0.zip 'clothes/*' && cd -
```

```bash
node bodies.mjs /tmp/fit/bodies
```

```bash
uv run --with numpy --with scipy --with pillow python register.py /tmp/mpfb2/src/mpfb/data/3dobjs/base.obj /tmp/fit/reg.npz
```

```bash
uv run --with numpy --with scipy --with pillow python fit.py /tmp/fit/reg.npz /tmp/fit/bodies /tmp/fit/out feminine,masculine /tmp/mh_system/clothes/male_casualsuit05 /tmp/mh_system/clothes/shoes01
```

```bash
VIEWS=0,40,180 node render.mjs /tmp/fit/out /tmp/fit/sheet.png 360
```

`EACH=1` before `fit.py` puts every garment alone on the first body (a catalogue; `GRID=9 VIEWS=0` for `render.mjs`).
On the user's machine add `GPU=1` before `node render.mjs` to draw on the card (docs/RUN_LOCALLY.md).

The base mesh is CC0 (MPFB2's `LICENSE.ASSETS.md`), the system assets CC0 (their README: "All of these assets are
CC0"). Community garments carry their author and licence in each `.mhclo` header: read it before using one.

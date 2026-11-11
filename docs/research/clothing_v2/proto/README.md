# The fit test's scripts

A research prototype (`../fit_test.md`): ready-made MakeHuman garments carried onto the Character Studio's MHR bodies
and worn in layers, with each other and with the tailor's own garments. It isn't on the launcher and nothing in the
Studio uses it. It is kept so the test can be run again and so a real build has something to start from. Nothing of
MakeHuman's is in the repo: the files below are fetched. `check.py` (LAYERS) holds the layer rules; it isn't in
`check_all` because it needs those fetched garments.

| File | What |
|---|---|
| `lib.py` | MakeHuman's base mesh and `.mhclo` clothes read, MHR's body and rig, closest points on a mesh |
| `register.py` | once per source body: MakeHuman's `hm08` registered onto MHR's average body (pose, joints, skin onto skin) |
| `fit.py` | a garment onto MHR's average at rest, then onto any body, out of the skin, the skin it hides; a second UV in metres; the garment's own detail as a layer |
| `layers.py` | **the layers** (`../fit_test.md` §7): a garment's kind and layer, the order, each garment set outside the ones under it (cloth against cloth), what each covers left out with a soft edge, the fault counted |
| `wear.py` | an outfit (`outfits/*.json`: library garments and the tailor's together) on bodies, with the layers or without (`--no-layers`), for `render.mjs`; `--glb` for Godot |
| `tailor_parts.mjs` | the tailor's own garments (pantyhose, fishnets, socks, the red sweater dress...) cut on a dumped body, for `wear.py` |
| `glb.py` | the layered outfit as one .glb: what each band of layers hides in every mesh's vertex colours |
| `godot/cover.gdshader`, `godot/shots.gd`, `godot_test.py` | the layers in Godot 4.7: what's covered not drawn, a dissolve at its edge, a band switched off at run time; GDLAYERS |
| `check.py` | LAYERS: on the outfits that clipped, the fault counted without the layers and gone with them, nothing shoved about |
| `pictures.py` | every picture of §7 made again: the outfits worn both ways, drawn, the Godot test, the five sheets |
| `outfits/`, `looks/` | the test's outfits, and the PBR sets worn in `layers_pbr.jpg` |
| `bodies.mjs` | the Studio's seven test bodies as the Studio makes them, and four of the newer ones: Anime at Bust 2.1 (with its dress form) and at -2, a girl of ten, a boy of fourteen |
| `render.mjs` | contact sheets by three.js in headless Chromium; a look puts a PBR set off the shelf, the tailor's fabrics or a PNG decal on a library garment; the tailor's parts in the tailor's own materials |

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

## The layers

A work folder holds `reg.npz`, `bodies/` and `sources.json`, which names the folders the garments are in (the outfits
say `glam:`, `sys:` and `mini:`: the two public projects of `../fit_test.md` §2 and the system pack):

```bash
echo '{"glam": "/tmp/glamcam/finalized_clothes", "sys": "/tmp/mh_system/clothes", "mini": "/tmp/minimaker/src/assets/clothes"}' > /tmp/fit/sources.json
```

```bash
uv run --with numpy --with scipy --with pillow python wear.py /tmp/fit outfits/uniform.json
```

```bash
VIEWS=0,50,180 node render.mjs /tmp/fit/uniform /tmp/fit/uniform.png 360
```

```bash
uv run --with numpy --with scipy --with pillow python check.py /tmp/fit
```

```bash
uv run --with numpy --with scipy --with pillow python wear.py /tmp/fit outfits/godot.json --glb
```

```bash
uv run --with numpy --with scipy --with pillow python godot_test.py /tmp/fit/godot feminine /tmp/fit/godot_pics
```

```bash
uv run --with numpy --with scipy --with pillow python pictures.py /tmp/fit /tmp/fit/sheets
```

An outfit's PBR looks need the baked fabric sets on the shelf (`python tools/fabric_bake.py bake`, then
`python tools/pbr.py list`). `ZOOM=waist|legs|feet|top` and `NOHIDE=1` (draw what's covered too) for `render.mjs`.

The base mesh is CC0 (MPFB2's `LICENSE.ASSETS.md`), the system assets CC0 (their README: "All of these assets are
CC0"). Community garments carry their author and licence in each `.mhclo` header: read it before using one.

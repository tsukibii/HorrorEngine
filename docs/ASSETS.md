# Assets: the CC0 library, texturing and replacing textures

Every game shares one library of public-domain (CC0) meshes and textures in `Content/Studio/Library/`. Claude picks
from it by name, fetches what a story needs, and swaps grey blocks and grey walls for real props and surfaces: first in
the director (so the storyboard looks like the room), then in Unreal (the same story fields). CC0 means no credit is
owed and commercial use is fine; we record where each file came from anyway (`LEDGER.json`), which is the proof if a
store or a buyer asks.

## 1. Where to look: the awesome-cc0 list

`docs/assets/awesome-cc0.md` is a copy of [madjin/awesome-cc0](https://github.com/madjin/awesome-cc0) (itself CC0):
about 35 sources of CC0 models, textures, sound and more. `python tools/cc0.py list [section] [word]` reads it
(`list textures`, `list sound`, `list 3d psx`). To refresh it: `python setup/setup.py fetch awesome-cc0`, then copy
`vendor/awesome-cc0/README.md` over the copy (keep its header line).

What we use from it, and how:

| Source | What | How it gets in |
| --- | --- | --- |
| **The Base Mesh** (glTF copy: M3-org/base-meshes) | 900 props at real-world scale with basic UVs: furniture, tools, headstones, chandeliers, pottery | `cc0.py get basemesh/<name>` (the index ships, so Claude can place one by name before it's fetched) |
| **ambientCG** | 1500+ PBR materials (colour, normal, roughness, AO, height) | `cc0.py textures <word>`, then `cc0.py get ambientcg/<AssetId> --tile <m>` |
| **Poly Haven** | textures, HDRIs, models | CC0, but its **API** asks commercial projects for a licence: download from the site by hand, then `cc0.py add <zip or folder> polyhaven/<name> --tile <m> --url <page>` |
| **Texture Ninja**, Wikimedia (unrestricted) | photos: grime, stains, wallpaper, signs | download by hand, `cc0.py add <image> local/<name>` (a colour map only: fine for decals and walls seen in the dark) |
| **Kenney**, **Quaternius**, itch.io CC0, Smithsonian 3D | models | download by hand, convert to `.glb` if needed (Blender), `cc0.py add <file.glb> local/<name>` |
| **freesound** (CC0 filter only), Free Music Archive (public domain) | sound | by hand into the game's Audio folder; note each one in `LEDGER.json` the same way (`cc0.py` doesn't fetch sound yet) |

Not in the library: Megascans (no longer free), Mixamo and Epic content (licensed for use, not redistributable: they
stay in your own project, see `Content/Studio/Bodies/README.md`), anything marked CC-BY or "free for personal use".
**Check the licence on the page you download from**: a CC0 site can host one CC-BY pack.

## 2. The story fields

```json
{"id": "chair_a", "shape": "asset basemesh/wooden_chair_01", "at": [1.4, 1.2], "rot": 0, "tag": "chair"}
{"id": "kitchen_table", "shape": "box 1.6 0.9 0.76", "art": "basemesh/food_prep_table", "at": [2, 2]}
{"id": "crate", "shape": "box 0.6 0.6 0.6", "mat": "ambientcg/Wood049", "at": [3, 1]}
{"id": "kitchen", "at": [0, 6, 0], "size": [4, 4, 2.8], "look": {"floor": "ambientcg/WoodFloor041", "walls": "ambientcg/Plaster003", "ceiling": "ambientcg/Plaster003"}}
```

- `shape: "asset <ref> [scale]"`: the library mesh itself, at its **real size** (from the index). Its box stands in
  until it's fetched, and the level check, `on`, shots and visibility all use that box.
- `art: "<ref>"` (or an Unreal path `/Game/...`): replaces a block, **scaled evenly to fit** it, centred, on the block's
  base. Use it when the block's size matters to the layout and the mesh is close.
- `mat: "<ref>"`: a texture set on a block (boxes only).
- a room's `look`: texture sets for its `floor`, `walls`, `ceiling` and `trim`. `floor` (wood, stone...) still sets the
  footsteps.
- either can also be a colour (`#rrggbb`) or a **tuned set**: a set with its tint, contrast, size and layers (wear,
  decals, another set over it), the street paint's look object (docs/STREET_PAINT.md §2), which the scene builder's
  Paint makes; it's made into `pbr/_made/<hash>` on the shelf when it's drawn or exported (STORY_FORMAT §1).
- A ref is `<lib>/<name>`: `basemesh/...`, `ambientcg/...`, `polyhaven/...`, `local/...`; a set on your PBR shelf is
  `pbr/<category>/<name>` (§6).
- **Facing:** a library mesh's front (glTF +Z) faces the prop's `rot` the same way a block does. If they come out
  turned in Unreal, set `library_yaw` in `Content/Studio/class_map.json` once (SETUP S8).

## 3. The commands (`tools/cc0.py`)

```
python tools/cc0.py props chair                 # library meshes named like it: size w d h, triangles, fetched or not
python tools/story.py art                       # every prop still a block, with library meshes named like its tag
python tools/cc0.py textures rusty metal        # ambientCG search (falls back to the site's search link)
python tools/cc0.py get basemesh/headstone_01 ambientcg/Rust004 --res 2K --tile 1
python tools/cc0.py needs                       # what the story uses from the library, fetched or not
python tools/cc0.py fetch                       # get all that's missing (ambientCG, The Base Mesh); prints the rest
python tools/cc0.py add ~/Downloads/rough_plaster_brick_2k polyhaven/rough_plaster_brick --tile 2 --url https://polyhaven.com/a/rough_plaster_brick
python tools/cc0.py ledger Builds/<Game>/THIRD_PARTY.md   # the credits list
```

- `--tile` is the metres one repeat of the texture covers (a plank floor about 1 to 2, bricks 1 to 1.5, a plaster wall
  2 to 3). The director and Unreal both tile by real size, so a texture looks the same on a 1 m crate and a 6 m wall.
- `add` sorts maps by their file names (`_Color`, `_diff`, `_NormalGL`, `_nor_gl`, `_Roughness`, `_AO`, `_disp`...);
  GL normals are preferred, DirectX ones are kept and flagged. Packed ARM maps aren't split: fetch the separate maps.
- `story_check` errors on a ref that doesn't exist and warns (once) about what isn't fetched yet.
- The fetch commands for ambientCG were written against its documented download links but couldn't be tried from the
  session that wrote them (its network blocked the site): the first run on your machine is the test, and Claude fixes
  `cc0.py` if the site disagrees. The Base Mesh fetch was tested.

## 4. Texturing a room (Claude's routine)

1. `story.py rooms <level>` and `story.py art`: the rooms, the blocks still grey.
2. For each room, pick a `look` that fits its mood and age (`light`, the scene notes, DIRECTING.md): a dread room
   wants worn, darker, rougher surfaces; avoid bright, clean, saturated ones. Floors read most from a first-person
   eye: spend the care there, then walls; ceilings are mostly in the dark.
3. Props: `shape: asset` where a library mesh fits (chairs, tables, desks, lamps, tools, headstones); `art` where the
   block's size must stay; leave interactables as blocks until the class map gives them Blueprints.
4. `cc0.py fetch`, then open the director: the storyboard and Watch show the real props and surfaces. Look at the
   frames, not just the checks (DIRECTING.md: does the subject still read against the new walls?).
5. In Unreal: rebuild the level (`importer.build`): it imports each library file once into `/Game/Studio/Imported/Library/`
   and reuses it. Take one screenshot per room from the player's start and compare with the director's frame.
6. `cc0.py ledger` before packaging; `package_game.py` only copies the assets the game uses.

**Replacing a texture:** change the ref in the story (or `cc0.py add` a better file under the same ref with `--tile`
corrected) and rebuild; the material instance is remade when its folder is deleted from `/Game/Studio/Imported/Library/Textures`.

## 5. In Unreal (`storykit/surfaces.py`)

- Meshes import with Unreal's glTF importer into `/Game/Studio/Imported/Library/Meshes/<lib>/<name>/`.
- Textures import into `/Game/Studio/Imported/Library/Textures/<lib>/<name>/` (normal maps as normal maps with the green
  channel flipped for GL files, data maps linear), and get a material instance `MI_<name>` of **M_StudioSurface**.
- **M_StudioSurface** (`/Game/Studio/Materials/`) is the one master: world-aligned (so blocks' stretched UVs don't
  matter), with texture parameters `Albedo`, `Normal`, `Rough`, `AO` and a scalar `TileCm` (one repeat, in cm).
  `surfaces.master_material()` builds it from the engine's `WorldAlignedTexture` and `WorldAlignedNormal` functions
  (normals in world space: the material's Tangent Space Normal is off). It was written without an editor to try it
  in: if it fails, build it by hand (or ask Claude in the editor to) with exactly those names, and the rest works.
- Later, for final art: real meshes get their own UVs and materials (a Blender pass or bought packs); the library is
  for greybox-plus and for props that are fine as they are.

## 6. The PBR shelf: your own texture sets (`assets/pbr/`)

The sets you download (Poly Haven, ambientCG, Unreal-ready ones, bought ones you may use) live on a shelf at the
project's root, one folder per set (DECISIONS 2026-10-23); category folders are there if you want them, and can nest:

```
assets/pbr/                             ($STUDIO_PBR puts it elsewhere, e.g. another drive; nothing in it is tracked)
  denim1/                               denim1_albedo.png, _ao.png, _height.png, _metallic.png, _normal-dx.png, _roughness.png
  Wood/old_planks/                      the maps as they came: old_planks_diff_2k.jpg, _ao_2k.jpg, _disp_2k.png,
                                        _nor_dx_2k.png, _rough_2k.jpg
  Stone/Walls/rough_brick_2k.zip        a ZIP dropped in is unpacked into rough_brick/ on the next scan
```

The shelf used to be `Content/Studio/PBR/`: sets still there are read too (a set in `assets/pbr` wins), new ones go to
`assets/pbr`.

**Your folders** (the user, 2026-10-31: "a PBR local, where I can attach a local folder and use PBRs from it and we
export to Godot with those"): a folder of PBR sets anywhere on this machine (another drive, a bought pack, your own
library) attached to the shelf where it is. The shelf page's **Your folders** box, *Attach a folder…*: click through
to it (or type its path), give it a short name, *Attach this folder*. Its sets are then `pbr/<name>/<set>` (the folder's
own layout under it: `pbr/mylib/Bricks/red_brick`), in every picker, the street paint's and the scene builder's Paint,
the desk, Blender and the Godot export (which copies the maps a game uses into the game: GODOT_EXPORT). **Nothing is
written in your folder**: what the shelf keeps for a set (its `meta.json`: the repeat, maps chosen by hand; its
thumbnail) lives in a mirror, `assets/pbr/_attached/<name>/`, and its ZIPs stay ZIPs (unzip them there, or drop them on
the shelf). The list is `assets/pbr/_folders.json` (this machine's paths: not in git). × takes a folder off (its files
untouched; what you set on its sets is kept for when it's back); a story that uses its sets warns that they aren't on
the shelf while it's off, and on another machine until a folder is attached there under the same name.
`storykit/pbr.py` (`attached`, `attach`, `detach`, `browse`, `side`), the servers' `/api/pbrfolders` and `/api/pbrbrowse`.

**The project's own sets are in git**, at `pbr/<category>/<set>` beside `assets/` (the user's ambientCG sets, 1K, merged
2026-10-31 from the `pbrs` branch: asphalt, road, concrete, wall, building, roofing tiles, metal, plastic, gravel, floor,
foliage, effects; all CC0). They're read after `assets/pbr`, their `meta.json` kept in git with each one's real size
(`tile_m`, judged from its picture: the pavers 8 across at 30 cm, the slates and tiles about 8 across) and a label;
`_thumb.jpg` isn't. A set's ref is its path (`pbr/concrete/Concrete010_1K-PNG`). `pbr/_made/<hash>` (in `assets/pbr`,
not in git) is a set the street paint page made from one of them, tinted and layered (docs/STREET_PAINT.md §3b).

- **The download:** Poly Haven's ZIP with Blend and glTF off, MaterialX off, the packed AO/Rough/Metal off, and AO, Diffuse
  and Rough as JPG, Displacement and Normal (DX) as PNG. Other names work too: the last word of each file name says
  which map it is (`diff`, `col`, `Color`, `ao`, `AmbientOcclusion`, `rough`, `Roughness`, `disp`, `Displacement`,
  `nor_dx`, `NormalDX`, `normal-dx`, `nor_gl`, `NormalGL`, `metal`, `metallic`...); a resolution like `_2k` is ignored,
  so Unreal-ready names work as they are (`denim1_albedo.png`, `_normal-dx`, `_roughness`). A GL normal is used before
  a DX one, JPG and PNG before EXR (the desk can't show EXR). A packed `arm`/`orm` map is noted (`orm` in meta.json):
  the Character Studio's clothes use it where the separate maps are missing; Unreal's import takes the separate maps.
- **By hand:** when a name says the wrong thing (a `_mask` that's a colour mask, not an opacity; two colour maps), the
  shelf page has a picker under each map: by its name, any image in the set, or none, and the normal's convention
  (OpenGL or DirectX). It's saved at once as `by_hand` in the set's meta.json and kept on every rescan.
- **Clothes** (docs/TAILOR.md §1b): the Character Studio's *Add a set* puts maps picked from disk into
  `assets/pbr/<name>/`, and a garment wears a set at a repeat in metres (0.3 unless the set's `tile_m` says).
- **Scanning** (`python tools/pbr.py`, the shelf page, or the desk at start) unpacks new ZIPs (their images only),
  writes each set's `meta.json` (which file is which map, the normal's convention, `tile_m`, where it came from) and a
  small `_thumb.jpg` (when Pillow is there). Poly Haven and ambientCG names give the source and its page; what you
  set by hand (`tile_m`, source, url, licence, note) is kept on every rescan. Nothing here goes into git (only its
  README): the sets are big and yours.
- **Using one:** its ref is `pbr/<its path>` (`pbr/denim1`, `pbr/Wood/old_planks`): a room's `look`, a prop's `mat`
  or a garment's `pbr`, like any library texture. The scene builder's Look pickers list the shelf, and take a set added or changed there when you come back to the
  builder (no reload: the pickers and the walk view). `story_check` warns about a ref that isn't on
  the shelf.
- **The shelf page** (the **PBR** button in the Character Studio, the scene builder and the kit maker, each in its
  own tab with the way back to the tool that opened it; http://127.0.0.1:8793/pbr.html, or the desk's
  http://127.0.0.1:8780/pbr.html, the launcher's *PBR shelf*): the sets (by category when there are any); each one on a
  1 m sphere, a 1 m cube, a 3 x 3 m room corner with a 1.7 m figure, or a close-up under a low light, at its real
  size, with the light turning round it. Click a map to see the set without it; the displacement slider pushes the
  sphere and the close-up. Set **one repeat** (`tile_m`, the metres one repeat covers: planks 1 to 2.5, bricks 1 to
  1.5, plaster 2 to 3) and where it came from, and Save.
- **DX normals:** DirectX is Unreal's own convention, so Unreal takes them as they are (a GL one has its green flipped
  on import); the desk (three.js, GL) flips the green itself.
- **Kimodo:** the stage `kimodo.py stage` sends is boxes, and the previs glTF export is the skeleton and its clips:
  neither carries a material, so nothing from the shelf goes to Kimodo.

**In Unreal** (`storykit/surfaces.py`):
- A set goes to `/Game/Studio/PBR/<category>/<name>/` (the shelf's folders mirrored; characters Unreal won't take in
  a path become `_`), with its maps (the displacement as a linear greyscale, kept for Nanite displacement later: the
  surface material doesn't use it yet) and `MI_<name>`, a material instance of M_StudioSurface (§5).
- **Checked before it's imported:** when a level is built, each set it uses is looked for in Unreal first. If
  `MI_<name>` is there and its maps haven't changed since (a stamp of the files, kept as metadata on the instance),
  it's used as it is (only its `TileCm` follows `tile_m`); if it isn't there, or a map changed, the maps are imported
  (replacing the old ones) and the instance is made or updated.
- `storykit.surfaces.sync_pbr()` does the whole shelf at once (or `sync_pbr(["pbr/Wood/old_planks"])` a few), and
  logs how many Unreal already had, imported and re-imported.
- Written without an editor to try it in, like §5: the first run is the test. Its logic (import once, reuse, re-import
  a changed set) was run against a stand-in for Unreal's API.

`python tools/pbr.py demo` puts five made-up sets on the shelf (planks, brick, plaster, tiles, concrete, 1k, in
Poly Haven's format as ZIPs) to try all this on; `python tools/pbr.py check` (PBR ok; `check_all` runs it) tests the
names, the ZIPs, the meta and the refs on a temporary shelf.

## 7. Painting the placeholder things (`tools/uv_templates.py`, HANDOFF_DIRECTOR_TODO §6)

The small things a game places as blocks at their real size (Build's things, a game's `box` props: not kit things,
library meshes or stains) can be painted in Krita before they're modelled:

- `python tools/uv_templates.py --game G [thing ...]` writes `Content/Games/<G>/Art/Textures/<thing>/<thing>.ora`
  (layers Guide, locked; Paint, yours; Base, a flat grey), `<thing>_guide.png` and `<thing>.json` (the layout).
  `--game G list` shows each thing, its layout and what's been painted.
- A **box** is a cross net (front in the middle, top above, bottom below, left and right beside it, back at the far
  end), one scale for every face, 8 px of bleed round each island, the fold lines dashed. A **plane** (paper, a card, a
  mat) is its front and its back side by side. A **photo** (photo, polaroid, picture or print in its id or tag) is its
  print alone; its frame is a part of its own with a PBR set off the shelf.
- Paint on Paint, hide Guide, and export the picture beside it as `<thing>.png`: the desk wears it on the block on its
  next load (`painted.js` lays the block's UVs from the layout), and Unreal will (UNREAL_NEXT §5).
- A thing whose size changed: run it again. A painted .ora is never overwritten (`<thing>_new.ora` beside it), and the
  story check warns while a painting's proportions don't match its thing.
- `python tools/uv_templates.py check` (UVTEMPLATES ok; check_all runs it): every layout's islands at one scale with
  their bleed, each face's corners on its island and the net's folds meeting, a photo's template its print alone, the
  .ora as Krita reads it, the desk's UVs and the templates agreeing at every corner, and no painting gone stale.


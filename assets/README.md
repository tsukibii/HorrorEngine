# assets

Things of yours that are too big (or too much yours) for git, kept next to the project. Nothing under these folders
is tracked; only this README is.

- **`pbr/`**: the PBR shelf (docs/ASSETS.md §6). One folder per texture set, its maps named by their last word:

  ```
  assets/pbr/denim1/denim1_albedo.png
                    denim1_ao.png
                    denim1_height.png
                    denim1_metallic.png
                    denim1_normal-dx.png     (a DirectX normal: Unreal's own; `normal` or `normal-gl` for OpenGL)
                    denim1_roughness.png     (or one packed `denim1_orm.png`: AO, roughness, metal in R, G, B)
  ```

  Folders can sit in category folders (`assets/pbr/Wood/old_planks/`), and a ZIP dropped in is unpacked on the next
  scan. A map the names get wrong is chosen by hand on the shelf page: the Character Studio's **PBR** button
  (http://127.0.0.1:8793/pbr.html) or the desk's (http://127.0.0.1:8780/pbr.html): each set on a sphere, a cube, a
  room corner and a close-up, at its real size. `python tools/pbr.py` lists the shelf; `$STUDIO_PBR` puts it
  somewhere else. The shelf's first place, `Content/Studio/PBR`, is still read.

- **`clothing/`**: the clothing library's files (DECISIONS 2026-11-11, last): MakeHuman's community clothing packs,
  about 2.6 GB, a folder a pack (`clothing/dress02/...`), fetched by

  ```
  python tools/clothing_library.py fetch
  ```

  from MakeHuman's two file servers: **only the garments picked** (`python tools/clothing_library.py pick 12 40 ...`,
  the numbers on the sheets `sheets` makes; kept in `Content/Studio/Clothes/library/picks.json`), each cut out of its
  pack on the server, or every pack when nothing is picked (`--all`; `--licence cc0` or `cc-by` for one half, pack
  names for whole packs). What's tracked is the catalogue, `Content/Studio/Clothes/library/index.json` (every
  garment's author, licence, page and pack), the picks, `docs/CREDITS.md`, and **the picked garments themselves**
  (DECISIONS 2026-11-11: 90 garments, 486 MB, added with `git add -f`; the folder is ignored, so a garment fetched
  later is kept out of git until it's added the same way). `$STUDIO_CLOTHING` puts the files somewhere else.

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

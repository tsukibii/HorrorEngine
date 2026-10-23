# The PBR shelf's old place

The shelf has moved to **`assets/pbr/`** at the project's root (DECISIONS 2026-10-23): one folder per set, its maps
named by their last word (`denim1_albedo.png`, `denim1_normal-dx.png`, `denim1_roughness.png`...), nothing in it
tracked by git. See `assets/README.md` and docs/ASSETS.md §6.

Sets still in this folder are read too (a set of the same name in `assets/pbr` wins), so nothing here goes missing;
move them to `assets/pbr` when it suits you. Everything here but this file is git-ignored.

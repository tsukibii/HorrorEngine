# The lash reference: five lash styles to make later

The user's reference (2026-10-26, night, "for later: I want us to make these eyelash shapes too, thin ones for men
etc"): a picture of five rendered pairs of eyes, one row each, all with violet irises, each a different lash style on a
different face. The picture itself isn't in the repo (it came in the chat): when it's wanted here, save it as
`docs/research/refs/lashes_five_styles.jpg`. What each row shows, and what a lash style for it would set in the
Character Studio (`tools/character/browlash.js`, `LASH_STYLES`; the sliders are its own words). **None of these are made
yet**: they sit beside the anime styles made the same day (CHARACTER_STUDIO.md, Face: brows and lashes).

| Row | Who | The lashes | The rest of the eye | A style for it |
|---|---|---|---|---|
| 1 | an old man: deeply wrinkled lids, a hooded upper lid folding over, bushy brows | short, sparse, thin and nearly straight; a few lower lashes; dark going grey | no makeup; red veins in the whites | **sparse (men, older)**: Upper lashes ~40, Length 5.5, Curl 0.15, Lift 0.3, Clumping 0.1, Thickness 0.35, Outer flare 0.1, Under-lashes 0.2, Lower lashes ~12 at 2.5 mm, Lash line 0.1; a greying look (a new entry in `LOOKS`, brown-grey tips) |
| 2 | a young woman, glam | long, dense, black, fanned and clumped into soft spikes (a "wispy volume" set); dense long lower lashes | a thick black winged liner top and bottom, a dark plum smoky shadow all round the eye, a lit inner corner | **glam volume**: Upper lashes ~160, Length 12, Curl 0.7, Lift 0.5, Clumping 0.7, Spiky 0.3, Under-lashes 0.7, Outer flare 0.6, Lower lashes ~40 at 5 mm, Lash line 0.9; a makeup preset "smoky plum" (liner 1 with a wing, shadow plum 0.8 gathered out, under 0.6 dark, inner corner light) |
| 3 | a young woman, no makeup | extremely full, long, soft, criss-crossing natural black lashes (a "fluffy mink" set), long fluffy lower lashes too | bare skin, natural brows, a clean eye | **fluffy mink**: Upper lashes ~200, Length 12, Curl 0.6, Lift 0.55, Clumping 0.3, Criss-cross 1.0, Long and short 0.5, Under-lashes 1.0, Thickness 0.5, Outer flare 0.4, Lower lashes ~50 at 6 mm, Lower lashes down 0.3, Lash line 0.5 |
| 4 | a young woman, dramatic, the eyes rolled up | very long, dense, swept up in one long sweep; long lower lashes on a thick lower liner | a bold black liner above and below, the lids dark | **doll volume**: Upper lashes ~170, Length 13, Curl 0.75, Lift 0.7, Clumping 0.6, Outer flare 0.5, Under-lashes 0.6, Lower lashes ~50 at 6.5 mm, Lower lashes down 0.4, Lash line 1; the makeup's liner on the lower lid too (not painted yet: the painted liner is the upper lid's only) |
| 5 | a young woman, natural | medium length, dark, lightly curled, separated (not clumped); the lower lashes thin and short | a thin red-brown tint on the lower waterline, bare skin | **natural medium**: our `natural` style, Length 8, Clumping 0.1, Lower lashes ~24 at 3 mm; the Waterline makeup slider in a red-brown |

What the five want that the lashes don't have yet (to build with them):

- **A lower liner**: the painted liner (`skinshader.js`, `makeup()`) runs along the upper lid only; rows 2 and 4 draw it
  along the lower lashes' roots too (the same two-line band, from the lower lid's margin down). The lower lid's rim
  path exists (`rimOf` with the lower line; `OPENLID`).
- **Greying and brown lash looks** (`browlash.js`, `LOOKS`): only black and brown-black exist; an old man's lashes are
  dark grey with pale tips, a fair woman's brown.
- **A hooded upper lid** (row 1) is a shape, not a lash: a sculpt control for the upper lid's fold (`sculpt.js`), or the
  Age slider's wrinkles; the lashes then root under the fold.
- **Men's lashes** are mostly the sparse style and no makeup, with the brows' `full` shape; the Studio's masculine base
  carries nothing lash-specific yet (a new character starts with the lashes off either way).

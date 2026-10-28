# The lash reference: five lash styles (made)

The user's reference (2026-10-26, night, "for later: I want us to make these eyelash shapes too, thin ones for men
etc"): a picture of five rendered pairs of eyes, one row each, all with violet irises, each a different lash style on a
different face. The picture itself isn't in the repo (it came in the chat): when it's wanted here, save it as
`docs/research/refs/lashes_five_styles.jpg`. What each row shows, and what a lash style for it would set in the
Character Studio (`tools/character/browlash.js`, `LASH_STYLES`; the sliders are its own words). **Made 2026-10-26** on
`eyelash-more` (DECISIONS 2026-10-26, "the five lash sets"), from this write-up (the picture never came into the repo):
the last section says what each became; the sketches below were their starting points, tuned on renders.

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

## What they became

| Row | Lash style (`LASH_STYLES`) | Whole look (`looks.js`) | What it needed, made with it |
|---|---|---|---|
| 1 | `sparse`: Sparse, thin (men, older): 50 upper hairs (57 with the under-lashes), 6.2 mm long at most (5 mm on average), nearly straight, 12 lower at 2.5 mm | **older man (sparse lashes)**: the skin seventy and over, no makeup, red veins and a warmer white, full ash brows, the lashes greying | the lash looks `lash_greying` (dark hairs with pale tips, about a third grey all along: the hair shader's inner colour on a share of the strands) and `lash_grey`; **Hooded lids** in the sculpt (`sculpt.js`, Body: the skin under the brow down over the upper lid in a fold, the opening and the lashes' roots kept) |
| 2 | `glam`: Glam volume (wispy spikes): 165, 12 mm, clumped into soft spikes, long and short, 42 lower at 5 mm | **glam smoky plum** | the **lower liner** (`skinshader.js`: the band along the lower lashes' roots, its thickness and reach), **Eyeshadow size** (the smoke up to the crease and out past the corner: the glam lashes hide the lid) and the makeup preset **smoky plum** (a thick winged liner top and bottom, a plum smoke over the lid and under the eye, the inner corner lit, the waterline dark) |
| 3 | `mink`: Fluffy mink (full, soft, criss-cross): 205 and as many under-lashes again, criss-cross 1, 50 lower at 6 mm | **fluffy mink** (bare skin, no makeup) | the upper lashes' slider to 240 |
| 4 | `dollVolume`: Doll volume (swept up, long lower): 175, 13 mm, swept up and out together, 50 lower at 6.5 mm | **doll volume** | the makeup preset **bold doll liner** (a bold liner above and below, the lower one corner to corner, the lids dark, the waterline lined) |
| 5 | `naturalMedium`: Natural medium (separated): 110, 8 mm, unclumped, 24 lower at 3 mm | **natural medium** (brown-black lashes) | the makeup preset **tinted waterline** (a thin red-brown tint on the lower waterline) |

The looks leave the irises as they are (the reference's are all violet: its render's, not the lashes'). A brown look,
`lash_brown`, came with the greying ones (a fair face's lashes). Men's lashes are the sparse set; a masculine base
still starts with the lashes off, as every new character does.

# Credits

Who has to be credited when a game ships, kept here as things come into the project so the credits screen can be
written at the end. Started 2026-11-11, when the user decided that **CC-BY clothing may ship with a credit**
(docs/DECISIONS.md).

How to use it:

- **Only what ships needs a credit.** Tick the *In the game* column as a garment is actually used in a game; the
  credits screen is the ticked lines.
- **What a CC-BY licence asks for**: the author's name, the work's title, the licence with a link to it, where it
  came from, and a note that it was changed. Ours are always changed (fitted to another body, often given another
  fabric), so the note is always needed. A credits screen in the game, or a credits file shipped beside it, is
  enough.
- **CC0 needs no credit.** Those are listed in §2 so it's clear they were looked at, and as a courtesy if wanted.
- **A new thing that asks for credit gets a line here in the commit that brings it in.**

Licence links: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/),
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

## 1. Clothing that must be credited (CC-BY)

MakeHuman community garments, fitted to our bodies by the clothing prototype (docs/research/clothing_v2/fit_test.md).
Each line is what the garment's own file header says. **The garment files are not in the repo yet**: these are the
ones tested so far, fetched as `docs/research/clothing_v2/proto/README.md` says.

Source for all of them: the MakeHuman Community asset repository, http://www.makehumancommunity.org/clothes.html.
Each garment's own page there wasn't reachable when this was written; add its link when the packs are downloaded.

| In the game | Garment (the name in its file) | Author | Licence, as its file says | What we changed |
|---|---|---|---|---|
| | Dress 01 (`F_Dress_01`) | Mindfront (Sweden) | CC BY 4.0 | fitted to MHR bodies |
| | Dress 02 (`F_Dress_02`) | Mindfront (Sweden) | CC BY 4.0 | fitted |
| | Dress 04 (`F_Dress_04`) | Mindfront (Sweden) | CC BY 4.0 | fitted |
| | Dress 05, wide sleeves, floor length (`F_Dress_05`) | Mindfront (Sweden) | CC BY 4.0 | fitted |
| | Dress 08 (`F_Dress_08`) | Mindfront (Sweden) | CC BY 4.0 | fitted |
| | Dress 11 (`F_Dress_11`) | Mindfront (Sweden) | CC BY 4.0 | fitted |
| | Women's trousers 01 (`F_Trousers_01`) | Mindfront (Sweden) | CC BY 4.0 | fitted |
| | Men's trousers 02 (`M_Trousers_02`) | Mindfront (Sweden) | CC BY 4.0 | fitted; also shown in our gabardine |
| | Knitted sweater 01 (`Knitted_Sweater_01`) | Mindfront (Sweden) | CC BY 4.0 | fitted; also shown in our knit fabrics |
| | Lusekofta, a knitted jacket (`F_Lusekofta`) | Mindfront (Sweden) | CC BY 4.0 | fitted |
| | Black cocktail dress (`Cocktaildress`) | punkduck | CC BY 3.0 | fitted |
| | Qipao, middle length (`Qipao`) | punkduck | CC BY 3.0 | fitted |
| | Denim jacket (`Denim_Jacket`) | punkduck | CC BY 3.0 | fitted; also shown in our denim and plaid, with a print on its back |
| | Uniform jacket (`Uniform_jacket`) | punkduck | CC BY 3.0 | fitted; also shown in our melton |
| | Winter coat (`Coat`) | punkduck | CC BY 3.0 | fitted; also shown in our melton |
| | Retro top (`VintageTop`) | punkduck | CC BY 3.0 | fitted |
| | Handbag (`Handbag`) | punkduck | CC BY 4.0 | fitted |
| | Rescue team jacket (`rescueteam-jacket-male`) | Elvaerwyn and punkduck | CC BY 4.0 | fitted |
| | Knee-length halter dress (`elvs_short_halterdress1`) | Elvaerwyn | CC-BY, no version given | fitted |
| | Goddess dress 8, floor length (`elvs_goddessdress8`) | Elvaerwyn | CC-BY, no version given | fitted |
| | 50s blouse and skirt (`50sdress`) | Elvaerwyn | CC-BY, no version given | fitted |
| | Crochet baby doll (`babydoll_elvruff1a`) | Elvaerwyn | CC-BY, no version given | fitted |
| | Pleated plaid miniskirt (`pleated_skirtelv1`) | Elvaerwyn | CC-BY, no version given | fitted; also shown in our herringbone and tweed |
| | Butterfly disco top (`elvs_butterflydiscotop1`) | Elvaerwyn | CC-BY, no version given | fitted |
| | Double-ruffle disco pants (`elvs_disco_pant_druffles`) | Elvaerwyn | CC-BY, no version given | fitted |
| | Gored elephant pants (`elvs_gored_elephantpant1`) | Elvaerwyn | CC-BY, no version given | fitted |
| | Men's boho top (`mens_boho_top1elv`) | Elvaerwyn | CC-BY, no version given | fitted |
| | Maria skirt (`mariaskirt`) | sonicteam998 | CC BY 3.0 | fitted; also shown in our corduroy |

To settle before shipping any of Elvaerwyn's: their files say only "CC-BY". Read the version on each one's page and
write it here; until then credit them as "CC BY" with a link to 4.0.

Not to ship, whatever their licence line says: the fan costumes in the same packs (a Sailor Moon dress, Sheeta from
Laputa: someone else's characters), and the Mars suit (its file says AGPL).

## 2. Clothing that needs no credit (CC0)

| Garment | Author | Licence |
|---|---|---|
| The system outfits: women's casual suits 01 and 02, elegant suit 01, sport suit 01; men's casual suits 01 to 06, elegant suit 01, work suit 01; shoes 01 to 06; the fedora | the MakeHuman team | CC0 (the pack's own note: "All of these assets are CC0") |
| Basic tucked T-shirt (`T-shirt_basic_tucked`), fisherman's sweater (`Sweater_Fisherman`) | MRT | CC0 |
| Polo shirt (`Polo t-shirt`) | Namuhekam | CC0 |
| MakeHuman's base body, used only to carry garments across, never shipped | the MakeHuman team | CC0 |

## 3. A credits block to paste, once the ticks are in

Keep only the lines for what the game uses.

```text
CLOTHING

Dresses, trousers, knitted sweater and jacket by Mindfront (Sweden), CC BY 4.0
Cocktail dress, qipao, denim jacket, uniform jacket, winter coat and retro top by punkduck, CC BY 3.0
Handbag by punkduck, CC BY 4.0
Rescue team jacket by Elvaerwyn and punkduck, CC BY 4.0
Halter dress, goddess dress, 50s blouse and skirt, crochet baby doll, pleated miniskirt,
disco top and pants, elephant pants and boho top by Elvaerwyn, CC BY
Maria skirt by sonicteam998, CC BY 3.0

From the MakeHuman Community asset repository (makehumancommunity.org).
All were changed for this game: refitted to its characters, some given other fabrics.
Licences: creativecommons.org/licenses/by/4.0 and creativecommons.org/licenses/by/3.0
```

## 4. Other things to go through when a game is finished

Not gathered here yet. These are the places in the project where a licence is already written down, to be read
through once at the end and brought into this file:

| Where | What it covers |
|---|---|
| `GodotPlugins/HumanShaders/UPSTREAM.md` | the skin and eye shaders (MIT, matmadness) and their textures ("MIT and CC BY 4.0": a game that ships those textures credits matmadness) |
| `Content/Studio/Bodies/MHR_LICENSE.txt` | Meta's MHR body (Apache-2.0: keep the notice) |
| `Content/Studio/Library/LEDGER.json` | the CC0 prop and texture library: where each came from |
| `Content/Studio/SFX/index.json` | the sound shelf: each sound's credit, licence and source |
| `Content/Studio/Music/samples/LICENSES.md` | the orchestra's samples (CC0: no credit required) |
| `tools/propgen/fonts/licences/`, and the `fonts/` folders of the Devices plugin and the runtime add-on | the fonts (OFL) with their licence files |

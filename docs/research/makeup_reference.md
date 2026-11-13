# The makeup of the user's Daz3D faces, taken apart

DECISIONS 2026-11-12, make-up enhanced: "For makeup, I want better makeup, analyze the daz images I shared earlier
and re-create those makeup looks 1:1 (the same lip gloss, shines etc, )". The pictures stay out of git
(`Saved/Hair2/daz/ref/`, `Saved/Body/ref/`); this is what each one's makeup is, read off enlarged crops of the eyes
and the lips, and which control of the Character Studio draws each part. The looks built from it are in
`tools/character/looks.js`; docs/CHARACTER_STUDIO.md §2i says what was added to draw them and how near they came.

## 1. What the five faces share

- **A two-tone lip.** No lip is one colour. The deepest colour is where the lips meet (a berry, a wine, a dark red),
  and it fades outward to a lighter, often pinker colour at the border, which itself has no hard line (a "blurred"
  or gradient lip). Until now the lipstick had one colour whose *amount* faded toward the border: the middle was
  never darker than the colour picked. Now: **Inner colour** (`lips.colour2`, `lips.inner`).
- **Wet gloss with glints.** On four of the five the lower lip carries one broad white highlight a little to her
  left of the middle and a small second one beside it; the upper lip a thin one on the cupid's bow. They are small,
  white and hard-edged (a render's reflection of small lamps), and they are *there in every picture whatever the
  light*, which is what makes the lips read as wet at a thumbnail's size. A clear coat alone gives only what the
  scene's lights give (in a dark room: nothing). Now: **Wet shine** (`lips.shine`), painted glints with the coat at
  its smoothest under them, so a real light still adds its own.
- **The lips are full to their border.** The colour covers the whole upper lip up to the cupid's bow. On our heads the
  lipstick's outline (MediaPipe's outer lip ring) sits a little inside the lip's own edge, and with a strong
  gradient the upper lip was left nearly bare: the looks overline by 0.3 to 0.4 mm, raise the upper border by half
  a millimetre and keep the gradient low (0.1 to 0.3).
- **A red line under the eye.** Three faces have a red, red-brown or wine line along the lower lashes' roots, from
  the outer corner most of the way in, under black lashes and a dark upper liner. The lower liner used the upper
  liner's colour. Now: **Lower liner colour** (`lowerColor`); settings from before it keep the liner's
  (`skinshader.js` `withLower`).
- **A flush across the nose.** The blush is high: under the eyes and over the bridge of the nose (igari), pink on
  the pale faces, peach on the warm one. That was there (Blush placement toward 1).
- **Small shines on the skin.** The tip of the nose, a line down its bridge, the tops of the cheekbones and the
  cupid's bow carry small bright highlights (a doll's finish). Dewy is a broad glow on the high planes; now there is
  a **Highlighter** (`highlight`) for the small ones: a little lighter, and a coat that catches the light.
- **Pale grey irises** with a dark limbal ring and a large pupil, a white catchlight; separate black lashes above
  and below (the lower ones drawn one by one); soft straight dark brows half hidden by a fringe.

## 2. Each face

| look | after | skin | lips | eyes |
|---|---|---|---|---|
| **porcelain berry** | the twin-tail reference | porcelain, a soft pink flush under the eyes and on the nose's tip | rose `#d88392` to berry `#8a1f36` at the seam, glossed, two glints on the lower lip, a soft border | a thin dark liner, a red-brown line under the lower lashes, a faint red-brown shadow at the outer corner; pale grey |
| **red satin** | the Christmas picture's left face | warm, a peach flush on the cheekbones | a true red `#c8343c`, darker at the seam, satin: one soft glint | a winged dark liner, a red line under the lower lashes, a red-brown shadow at the outer corner; grey |
| **wine doll** | its right face | a strong pink flush across the nose and under the eyes | wine `#b83a4c` to nearly black-red `#560d1c`, very wet, sharp glints | red all round: a wine lower liner corner to corner, a rose shadow and wash, a tinted waterline, doll lashes; big pale grey |
| **neon wing** | the neon picture | dewy, highlights on the nose and cheeks (her light is pink and blue neon: the skin's own colour can't be read) | coral-red `#e0405a`, a broad wet gloss | a bright pink-red wing out from the outer corner over a pink shadow and under-eye wash; violet-blue |
| **smoky nude** | the T-pose reference's face | pale, matte, hardly a flush | a brown nude `#8a5a4c`, matte, darker at the seam, no glints | a smoky grey-brown eye lined above and below; grey-green |

## 3. What a picture can't give

- **The colours are read through each picture's own light and grade** (the Christmas picture is warm, the neon one
  pink and blue): a lip's hex is the lit pixel's hue pulled back toward what a neutral light would show, by eye.
- **The glints are the render's lamps.** Their place on the lip is the picture's; under another light a real gloss
  would put them elsewhere. Painted glints stay where they are drawn (a little to her left on the lower lip), which
  is the references' look and not physics.
- **The faces are small** (60 to 180 px between the eyes): the lashes' count, the liner's exact width and the
  brows under the fringes are read as kinds (separate, doll, glam; thin, winged), not measured.

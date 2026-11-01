# The clothing pass: everyday clothes that hold up in animation

The user's notes (DECISIONS 2026-11-01, the clothing review): waistbands must be snug; no harsh dents at the knees; the
clothes will be skinned, never simulated, so nothing so baggy it clips in a walk; no dent into the buttocks' cleft;
looseness should read as fitted cloth under gravity, its creases selling the bagginess; easy custom tees (front and back
prints); a wardrobe of everyday clothes (smart casual, casual, business, uniforms, pyjamas, bikinis), reusable simple
pieces that fabric and colour vary. Ticked as each lands (one commit each), so a session that runs out can carry on.

## The review (before)

- Bottoms take their body ease at the waist too: 8 to 20 mm off the skin at the band (work trousers 12, wide trousers
  20, cargo 14); skirts 4 to 6 mm.
- Some eases are past what skinning carries: the long coat 24 mm, the leather jacket 22, the hoodie 16, a full sleeve 30,
  the wide trousers' legs a column off the knee.
- The cut relaxes into every hollow of the skin across the body: the buttocks' cleft, between the breasts, the spine.
- The wide trousers still dent in at the knee; looseness is held off the body instead of hung.
- One print a garment, set from its look's panel.
- Outfit groups: Smart casual, Designer, Studio, Underwear. No business, pyjamas or swimwear.

## The plan

- [ ] 1. **Snug waistbands.** Every bottom's ease falls to the cloth's own thickness at its waistline and opens out over
  the hip; a skirt's top ring the same. (pieces.js `shell`, `skirt`)
- [ ] 2. **Bridge the hollows.** Across each height of the body the cloth lies on the slice's convex hull, never into a
  hollow it spans: the buttocks' cleft, between the breasts, the spine's groove; the waist's in-curve (up and down) kept.
  (pieces.js, after the relax)
- [ ] 3. **Animation-safe ease.** Every design's ease within what skinning carries: tops 4 to 12 mm (jackets and coats to
  16, with a built shoulder), sleeves 6 to 14, legs 6 to 18 (wide legs by their straight column, not more), skirts
  flared enough to clear a stride; the drape on so loose cloth hangs. Ease limits checked by TAILOR.
- [ ] 4. **No knee dents.** Straight legs taper smoothly from the seat to the hem; nothing follows the kneecap in.
- [ ] 5. **Bagginess by creases.** Loose garments read loose by their folds: vertical hang folds below the bust and
  down the back, the sleeves' sag under the arm and their stack at the cuff, a top's blousing over a tucked waist; the
  amount by the garment's ease. (crease.js)
- [ ] 6. **Easy custom tees.** Front and back prints on any top, each text or a picture, its size and height, set from a
  Print panel in the Studio; prints kept in `Content/Studio/Clothes/prints/`; the export bakes them.
- [ ] 7. **The everyday wardrobe.** Groups Casual, Smart casual, Business, Uniforms, Sleepwear, Swimwear, Underwear (and
  Designer last); new basics where missing (joggers, sweatshirt, polo, a suit's jacket and trousers, a shirt dress,
  pyjama top and trousers, a sleep tee and shorts, a bikini, a one-piece swimsuit, swim shorts); outfits for each from the
  basics, fabric and colour doing the variety.
- [ ] 8. **Pictures, docs, checks.** Thumbnails for the new outfits, TAILOR §, DECISIONS, CHECKS and TAILOR.

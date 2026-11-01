# The wardrobe: faster clothes, a dummy to dress, folds by seed, short skirts

The user's asks (DECISIONS 2026-11-02), on `clothing-refiner`: the clothes are laggy to change, "is there anything we
can do to isolate the processing or utilize more of my GPU", a clothing tab to make outfits on a dummy "really well in
real time" and load them onto the actual character, saved like the preset outfits; a looseness modifier whose folds
are picked by trying seeds (after loose shorts: their lines round the thighs, snug at the waist, a small gap); a skirt
that only goes a little below the crotch. **Progressive: nothing made so far changes** (every design, outfit and
character dresses as it did; the new parts are new fields, new designs, a new page). Ticked as each lands.

## Why it's slow (measured)

One worker re-made every garment of the outfit for every change: about 1.5 s a garment on the feminine body (the cut
a quarter of it, the trim pieces, thickening and unwrap the rest), then the drape. Editing the top garment re-made the
socks and shoes under it too.

## The plan

- [x] 1. **Garments kept, not made twice.** Each garment made is kept on its body by its design, its own edits, colour
  and look, and the shape of everything under it (tailor.js `dressing`); a change re-makes only that garment and what's
  worn over it. Measured on a three-garment outfit: 4.2 s, the same again 1 ms, the outermost edited 0.4 s, the
  innermost's colour 0.9 s. The worker sends copies (it keeps its own) and, asked with `have`, nothing for a garment the
  page already shows.
- [ ] 2. **Folds by seed.** A garment's `folds` ({depth, seed, count}): soft folds round each leg (or round a skirt)
  growing from nothing at the hip to `depth` at the hem, their places, widths and sharpness from the seed; the waist
  untouched. In the Studio: a Folds slider and **New folds** (the next seed) on a bottom or skirt.
- [ ] 3. **Short skirts and loose shorts.** A micro A-line skirt and a micro pleated skirt ending just under the
  crotch; loose high-waisted shorts after the user's picture (snug band, legs standing a little off the thighs, folds),
  in houndstooth; outfits for them.
- [ ] 4. **The wardrobe page.** `tools/character/wardrobe.html` on the Studio's server: the default body as a plain
  dummy (no skin shaders, eyes or hair: only the clothes cost), the outfit as a list (design, colour, fabric, pattern,
  shape sliders, folds), every change made in a worker with the kept garments (only what changed is made), the drape
  off until asked (Hang); outfits from the presets to start from.
- [ ] 5. **My outfits.** Save an outfit from the wardrobe into `Content/Studio/Clothes/my_outfits.json`; the Studio's
  outfit picker shows them first (*Mine*), worn on the character as any outfit is (cut on its own body).
- [ ] 6. **Docs and checks.** TAILOR §, CLAUDE.md, a headless check of the wardrobe page (WARDROBE), TAILOR, CHECKS.

## Later (not now)

- **The drape on the GPU**: the cloth simulation (tailor/drape.js, position-based) as WebGPU compute would use the
  3090; it's the one part a GPU would speed up a lot, but it's a rewrite of the drape and can't be measured here (no
  GPU in the cloud session). Worth it once the wardrobe settles.
- **More than one worker**: garments that don't touch (shoes and a hat) could be made at once in a pool of workers.

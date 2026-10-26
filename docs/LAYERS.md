# Paint layers and pigment in the Character Studio

Our own code: `tools/character/layers.js` (the selection, the bake, the merge), `layersui.js` (the Layers tab), the shader in
`skinshader.js`, the touch-up's pigment brushes in `touchup.js`. Contact sheets in `docs/assets/layers/` and
`docs/assets/pigment/`.

**Layers sit above the base mesh.** Nothing under them is changed: delete the layers and the frame is pixel-identical to the
base (checked: difference 0).

## Selecting (paint by vertex)
Brush (radius along the surface), Flood (until the surface bends past an angle or goes too far), All, None, Invert, Head
(from the chin up), Body (below the chin), Grow, Shrink. The selection shows as an orange tint.
- **Bleed** grows the selection with a hard edge. **Soft inner** and **soft outer** are feathers measured along the surface
  (Dijkstra over the mesh's edges), like a feathered selection. The mesh's own point spacing (about 5 mm on the face) is the
  finest step; the bake softens a few texels more.

## Erasing
- **Erase layer** and **Restore** (in the Select tool list): the brush takes the fill of the layer you're editing away (or
  brings back what the fill first covered). **Erase softness** 0 is a hard-edged disc, 1 fades from the centre to the rim;
  **Erase strength** is how much one dab takes; the radius is the Brush slider. Pick a layer first (click its name).
- The touch-up's own Erase brush (Skin tab) takes paint, pigment strokes and photo-mask edits away; its Hardness slider is the
  softness.

## Fills (a new layer each time)
- **Colour**, **PNG** (front, side, top or triplanar, size in cm, rotate, move, tile or not; its own alpha is kept, and the
  picture lands centred on the selection), **PBR set** (albedo, roughness, height, AO from files or the PBR shelf, tiled
  triplanar, so the body can wear one while the face doesn't), **UV texture** (a picture in MHR's UV layout, such as the photo skin).
- **Gradient** (a fill type): the Colour is the middle, the second colour the edge, along the surface (**Middle → edge**) or
  along a line (angle, length in cm); **Solid**, **Fades out** (strong in the middle: gradient lips) or **Rim** (strong at the
  edge: an ear's rim); a curve. `docs/assets/layers/gradient_smooth_before_after.png`: gradient lips and blush, and smoothing.
- **Glow from within** (with a colour): light through thin skin, painted where the layer is (ears, nose tip, flushed cheeks);
  `docs/assets/layers/glow_whole_head.png` is the strongest setting on the whole head, so use a little.
- **Smooth skin**: evens out the pores, grain, mottling, wrinkles and age spots where the layer is (the porcelain look). A
  layer that only smooths (or only glows) takes a white **Pigment** fill: white filters nothing, so the paint is invisible.
- **Opacity**, **Pigment** (on: the fill filters the skin's own colour and overlapping pigments mix, order doesn't matter;
  off: it covers like paint), pigment density and cover, **Shine** (a clear coat: gel, gloss, lipstick), **Oily** (lower
  roughness), **Gloss tightness**. **Relative to its own average** divides out a picture's mean colour, so a face photo lays
  its features onto whatever skin tone is under it.
- Pigment layers show under the overlay ones whatever their order (separate textures).
- A PBR set's normal map isn't used yet: its height map gives the relief.

## Saving
`Content/Studio/People/<name>/layers.json` (masks as bytes, pictures as data URLs; Save in the header saves it too). A PBR
set picked from the shelf is not embedded: re-pick it after loading.

## Pigment mixing in the touch-up
The Pigment and Swatch brushes paint a transmittance layer composited by multiply (blue over green goes dark teal). The
Swatch brush is a circle picked on a reference image; Blend evens it out. See `docs/assets/pigment/`.

## Eye paint (`tools/shared/eye.js`, the Skin tab's Eyes)
The eyeball's paint is drawn by its shader in the eye's flat layout (the front projected flat, the iris in the middle):
iris colour (rim) and a second colour round the pupil, iris size, pupil, fibres and a pale ring, a limbal ring (strength,
width), sclera colour and shading toward the rim, corner pink (the inner corner, a little of the outer, the waterline),
veins, and a wet gloss (roughness and the clear coat). With the refracting cornea (2026-10-26, docs/research/eyes.md) the
iris is read through the cornea's dome and the cornea reflects the lights; off, the iris is painted on the eyeball and
two painted catchlights (size and place) stand in for them. Each eye has its own paint so the pink is the inner corner.
Saved in the character's `eyes`.
Left: the old look. Right: iris 38, blue-grey two-tone, limbal 0.85, corner pink 0.7 (`docs/assets/layers/eyes_default_vs_painted.png`).

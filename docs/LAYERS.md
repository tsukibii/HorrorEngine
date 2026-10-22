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

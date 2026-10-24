# The reference look: what makes it, what we copy

The user's reference (2026-10-24): three frames from a Unity editor viewport, a stylised-real young woman: the eyes in
tears, close; the face in a warm side light; the lips and teeth, very close. It's almost all materials and light, very
little geometry. What each part does, and where we do it: the Character Studio's preview now, Unreal when the
character is dressed (docs/PERFORMANCE_PLAN.md §6, docs/research/hair_cards_unreal.md). **All of the Studio's side
together is the look "soft cinematic"** (`tools/character/looks.js`, Face, Look), which new characters start from;
"MHR plain" takes it off.

## Eyes

| What you see | How it's made | Studio | Unreal |
|---|---|---|---|
| The iris melts into the white, no line | The limbus is a translucent band seen through the cornea: a dark rim that fades over a wide band into a grey shadow on the white. Unity HDRP's eye shader and MetaHuman's eye material both expose the limbal ring's size, fade and strength | **Iris edge softness** (`eyes.js`): a wider fade, a cool shadow on the white round the iris | the eye material's limbus settings |
| The lids sit softly on the eye | A soft shadow all round where the lids meet the eyeball: MetaHuman faces carry an eye occlusion shell for it | **Eye occlusion**: the lid shadow on the eyeball widened all round | the eye occlusion mesh (or a decal) |
| A wet bright line along the lower lid | The tear film: MetaHuman's lacrimal fluid strip, a thin wet mesh on the lower lid's edge | **Tear line**: a strip along the lower lid that only reflects | the tear line strip, translucent and refractive |
| Two catchlights, a glassy front | The cornea's reflection of the lights; a refractive cornea over the iris | painted catchlights fixed to the light, a clear coat | a refractive cornea; the catchlights from real lights |
| Pink wet inner corner, waterline | The caruncle and the lid margin, wet | Corner tint, Wet gloss | the same in the eye and skin materials |
| Tears and sparkle on the cheek | A wet layer: a streak, a high-frequency sparkle in the normal and very low roughness | (not yet: a touch-up layer could carry it) | a decal or a runtime wetness mask |

## Lips

| What you see | How it's made | Studio |
|---|---|---|
| Colour strongest inside, fading to a soft border | Gradient (Korean) lipstick | **Lipstick** (Face, Mouth; on and off): Gradient, Soft edge, Amount, over the photo skin too |
| Exactly on the lip, a little over or under | The lip's outline, shaped by the artist | **Show the guide**: the outline from the face's own points (MediaPipe's outer lip ring), Overline, Upper lip, Lower lip, Corners, Cupid's bow |
| Glossy, with fine vertical lines | Low roughness and a clear coat, the lip lines in the normal and roughness | Gloss; Lip lines (square to the border, a little darker, less glossy) |
| Lips that roll into the mouth | The lower lip's inner surface curling in | Lower lip curl |

## Teeth

Never pure white: off-white with a blue-grey, translucent biting edge (light passes through the enamel), wet (strong
small highlights), darker gaps between them, the back teeth in the mouth's shadow. **Studio:** a wet clear coat,
the biting edges translucent blue-grey, the gaps and the back darker. **Unreal:** the same plus subsurface (a subsurface
profile for teeth), the mouth's ambient occlusion.

## Skin

Pale and translucent (subsurface scattering: HDRP's diffusion profiles, Unreal's subsurface profile), a dewy sheen
on the high planes (nose bridge, cheekbones, under the eyes), rosy under the eyes. **Studio:** the procedural skin's
translucency, dewy glow and blush (the skin presets). **Unreal:** the subsurface profile and the skin material's
specular lobes.

## Hair

The soft edge is the renderer's more than the hair's: card hair cut out by a dithered coverage that temporal
anti-aliasing (Unity's TAA, Unreal's TSR) resolves into a soft fringe; the tips fade; a warm rim light from behind.
**Salon:** Soft edges (the look): a softer coverage ramp, the tips feathered, cards fading as they turn edge-on, through
alpha to coverage (the browser's 4x MSAA: soft, never as soft as temporal AA). **Studio:** the baked cards' faint fringe
drawn as coverage instead of cut at a hard line. **Unreal:** the material recipe in
docs/research/hair_cards_unreal.md (dithered opacity with TSR, the edge-on fade, the root fade, shell normals).

## Light and camera

A warm key from the side and above, a cool weak fill, a dark background, a rim on the hair; a close camera with a
shallow depth of field (the background and the far eye soft). Unreal's job (the camera's depth of field, the lights);
the Studio's lights only check the face reads.

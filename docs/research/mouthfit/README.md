# mouthfit: the Studio's open mouth laid over a picture

The scripts the v2 mouth, the open smile and the v2 smile lips were held to the user's picture with
(docs/CHARACTER_STUDIO.md §2j, DECISIONS 2026-11-13, better mouths: "If your overlayed open mouth matches the image
1:1 in 3d model shape, and is close in texture then you can pass this new branch"), as they were run. The picture
stays out of git (`Saved/Mouth/ref/m1.jpg`; its face is `Saved/Hair2/daz/ref/d3`); what the scripts write goes to
`out/` here (ignored).

- `out/d3.json`: MediaPipe's 478 points on the picture (docs/research/headfit/lm.py makes it).
- `probe.mjs`: what a few of MHR's face shapes do to the lips' landmarks at full weight. It is how the seal was found:
  MediaPipe's inner-lip points for both lips (13 and 14) sit on MHR's lip membrane at one place and never part,
  whatever the jaw does.
- `exprfit.mjs d3 [--head v2female] [--shapes a,b,...] [--fix jawDrop=0.33] [--ridge 0.01] [--max 1] [--iters 8]`:
  the expression (MHR's face shapes) that puts a head's lips where the picture's are. The lips' outer ring from
  MediaPipe's points; the opening from the membrane's own upper and lower edges (the triangles that stretch tenfold
  when the jaw drops: those that stay up are the upper lip's edge), thirteen points along each against the picture's
  inner rings. A camera (a turn, a scale, a shift) is fitted with the shapes. Left and right are tied. With every
  shape free it finds mixes no face makes; `--shapes` keeps it to a smile's (jawDrop, lowerLipDepressor,
  lipCornerPuller, lipStretcher, dimpler, upperLipRaiser, cheekRaiser). Writes `out/d3_expr.json`.
- `tools/character/mouthshots.mjs --out DIR --pitch 8 --sculpt '{...}' --lips '{"shine": 0}' --key front`: the Studio's
  own page pictured with the expression, from the picture's side (the fitted camera: 1 degree to her right, 8 below),
  with where its lips' points and its opening's outline are in the picture, in pixels. `--key front`: the lamp from
  the camera's side, as the picture's is (the Studio's own lamp comes from steeply above in a close-up of the head).
- `compare.py DIR`: ours turned, sized and moved onto the picture by the lips' twenty outer points (a similarity:
  nothing stretched), then measured: the outer points' distance (mm, rms), the opening's width and height and how much
  the two outlines share, how much of each opening is teeth, tongue and dark (by colour), whether the teeth and the
  tongue are in the same places, how far across the teeth show and how much of the upper teeth shows in the middle,
  the teeth's and the tongue's colours. Writes `DIR/compare.jpg`: hers, ours, half and half; the lines; the two
  openings with what was counted as teeth, tongue and dark.

What decided what:

- The jaw and the lower lip can't both be read from the lips: a lower lip pulled down and a jaw dropped open the
  mouth alike. What the picture shows of the lower teeth decides (only their tips: the jaw 0.33, the lower lip's
  depressor 0.7).
- The upper teeth are set by the face at rest and don't move: how much of them shows under the smiling lip is the
  frame's height alone (`teeth.js` `V2.down`), set by the overlay.
- Her teeth are large for her small mouth: sized by the mouth's width, as the classic mouth is, they came out a
  fifth too small on v2female (her mouth at rest is 40 mm across, MHR's 50). `V2.fit`: by the square root of that.
- The sheet is honest only under the picture's light. Under the Studio's own lamp the same mouth has grey upper
  teeth: the lamp is above the head in a close-up. The numbers are the same either way but the colours.

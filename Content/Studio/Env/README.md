# HDR environments for the studio view

`studio_small_09_1k.hdr`: the user's `studio_small_09_4k.hdr` (a Poly Haven-style studio HDRI) downscaled to 1024 x 512 (area
filter, 1.6 MB) with OpenCV from the face-mesh environment. 1k is plenty: the studio view prefilters it for lighting and
reflections, and shows a white background. **Check the source's licence before a game ships with it** (Poly Haven's HDRIs are
CC0, but this file came in without its page): the rule is CC0 or ours.

To use another: put an equirectangular `.hdr` here and pass `envUrl: "/env/<name>.hdr"` to `StudioView`.

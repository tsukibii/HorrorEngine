# HumanShaders: where it came from

- **Upstream:** https://github.com/matmadness/HumanShaders, commit `95a54cff4a9165993914143ca9047a5f5d029bce`
  (2025-11-27). Copied 2026-10-28, unchanged.
- **What's here:** upstream's `HumanShaders/` folder only (the shaders and their resources), which its README says is
  all you need for the shaders, and its `LICENSE` (MIT, matmadness).
- **Left out:** the demo project (`project.godot`, the test scenes, the visualizer scripts, LUTs, HDRIs) and the head
  scans: Digital Emily 2 (USC ICT, licence not stated: not for commercial use without asking) and Infinite (Lee
  Perry-Smith, CC BY 3.0). Neither may go into a shared file here (CLAUDE.md, Assets).
- **Licences:** the shaders are MIT. Upstream's README puts the folder's resources (the iris, sclera and micro-detail
  textures, the noise) under "MIT and CC BY 4.0": a game that ships those textures credits matmadness. The plan
  (docs/GODOT_PLAN.md §2) is to drive the shaders with the Character Studio's own procedural paint, so the textures
  may never ship.
- **Status upstream:** "a work in progress and not actively maintained"; meant as a base to change. Changes we make
  go in our copy and are listed below.

## Our changes

None yet.

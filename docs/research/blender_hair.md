# Blender's hair, read for the salon (2026-10-22)

Phase 0 of docs/SALON_PLAN.md. Blender's source read from GitHub (`blender/blender`, `main` and the `v4.2.0` tag for
the sculpt brushes, which moved after 4.2): the curves data model, the add-and-interpolate step, the sculpt brushes,
the constraints that run after every brush, the children's curl, clump and roughness, and the hair simulation that
runs on the cloth solver. The maths is ported below in JavaScript with Blender's names kept, so anyone can diff it
against the source. **Blender is GPL-2.0-or-later: the salon's files that carry these ports say so in their header
and in THIRD_PARTY.md** (the user's call: an in-house tool for free games; the GPL asks nothing more of us than that
the repo says where it came from). Blender's manual was not reachable from the session; the hair node groups are
described from the source they're built on (the children code) and from memory, marked as such.

## 1. The data model (`BKE_curves.hh`, `curves_geometry.cc`)

A `CurvesGeometry` is one flat array of points with per-curve **offsets** (curve i owns points `offsets[i]` to
`offsets[i+1]`), a per-curve type (poly, Catmull-Rom, Bezier, NURBS: hair sculpting uses Catmull-Rom), per-point
`position` and `radius`, per-curve `cyclic`, `resolution`, and for hair on a surface the per-curve `surface_uv_coords`:
the root's UV on the scalp mesh, which is how a curve stays attached when the mesh deforms (a `ReverseUVSampler` turns
the UV back into a triangle and barycentric weights). The first point of a curve is its root.

**Ours:** the same shape in JSON and typed arrays: a lock holds guide curves; a curve is `n` points root first; the
root is stored as `(triangle, bary)` on the body directly (we have no UV map worth trusting on MHR, and the body's
triangles are stable), so the root rides the head's shape and the character's height.

## 2. Adding curves and interpolating their shape (`add_curves_on_mesh.cc`)

Roots are sampled on the surface (one at the brush centre, a projected disc of random points, or a spherical brush).
A new curve with **no neighbours** is a straight line from the root along the surface normal, `length` long. With
neighbours it takes the shape of the nearest existing curves (`max_neighbors = 5`, found by a KD-tree on roots,
weights `1 / max(distance, 1e-5)` normalised to 1): each neighbour's points are taken **relative to its root**,
rotated by the rotation that takes the neighbour's surface normal onto the new root's normal, resampled by length so
a shorter new curve follows the first part of a longer neighbour, and mixed by weight. This is the whole trick behind
"the hair I draw next looks like the hair beside it", and it is what Blender's *Interpolate Hair Curves* node does
for children.

```js
// port of geometry::add_curves_on_mesh (calc_position_with_interpolation), simplified to one normal rotation
// per neighbour: the new curve's points (n) from up to 5 neighbour curves, each an array of points root first
export function interpolateFromNeighbours(root, normal, length, n, neighbours /* [{points, normal, weight}] */) {
  const out = Array.from({ length: n }, () => [root[0], root[1], root[2]]);
  if (!neighbours.length) { for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) out[i][a] += normal[a] * length * i / (n - 1); return out; }
  for (const nb of neighbours) {
    const R = rotationBetween(nb.normal, normal);                       // mat3: nb.normal -> normal
    const lengths = accumulateLengths(nb.points), total = lengths[lengths.length - 1];
    const factor = Math.min(1, length / total) / (n - 1);              // resample by length: a shorter curve takes the neighbour's first part
    for (let i = 1; i < n; i++) {
      const s = sampleAtLength(nb.points, lengths, i * factor * total); // a point along the neighbour at that length
      const rel = [s[0] - nb.points[0][0], s[1] - nb.points[0][1], s[2] - nb.points[0][2]];
      const rot = mat3mul(R, rel);
      for (let a = 0; a < 3; a++) out[i][a] += rot[a] * nb.weight;
    }
  }
  return out;
}
```

## 3. The sculpt brushes (`curves_sculpt_*.cc`, 4.2)

Every brush works on **selected curves** with a per-point factor, a radius falloff (`BKE_brush_curve_strength`: the
brush's falloff curve over distance/radius) and, for comb, a **curve-parameter falloff** (how far along the strand the
point sits, so roots can stay put). Two shapes: *spherical* (a 3D brush at the depth of the hair under the cursor:
`sample_curves_3d_brush` finds that depth from the curves near the cursor, as our builder does with the Gaussians) and
*projected* (a tube along the view). The roots are never moved by any brush but *slide*.

| Brush | What it does to each point within the radius (`weight = strength * falloff * point_factor`) |
|---|---|
| **comb** | `position += weight * (brush_end - brush_start)`: the stroke's motion, points after the root only, scaled by the along-curve falloff |
| **snake hook** | only the **tip** moves by `weight * brush_diff`; then `move_last_point_and_resample` spreads the change down the curve |
| **grow / shrink** | the tip is moved along the direction from the curve's middle point to its tip by `move_distance` (grow extrapolates, shrink pulls back, or the whole curve is scaled about the root); then the same resample |
| **puff** | the curve is pulled toward the surface normal at its root: goal for point i is `root + length_i * normal`, mixed by `0.01 * strength`, and a point is never allowed closer to the root than it was (so the curve rotates up rather than folding) |
| **pinch** | points move toward the brush centre by `t * falloff(t)` where `t = distance / radius`, inverted for the opposite |
| **smooth** | each point toward the average of its two neighbours along the curve, by a factor from the falloff |
| **slide** | the **root** moves along the surface: the brush motion is projected onto the surface by a ray, the new UV found, the whole curve translated and re-aligned to the new normal |
| **add** | new curves at sampled roots (§2); **density** adds or removes to a target spacing; **delete** removes within the radius |

```js
// port of comb_spherical: points within the radius of the stroke segment move with it
export function comb(curve, lengths /* segment lengths */, start, end, radius, strength, alongFalloff /* t -> 0..1 */, falloff /* d/r -> 0..1 */) {
  const total = lengths.reduce((a, b) => a + b, 0) || 1, diff = sub(end, start);
  let along = 0;
  for (let i = 1; i < curve.length; i++) {
    along += lengths[i - 1];
    const d = distToSegment(curve[i], start, end); if (d > radius) continue;
    const w = strength * alongFalloff(along / total) * falloff(d / radius);
    for (let a = 0; a < 3; a++) curve[i][a] += w * diff[a];
  }
}

// port of move_last_point_and_resample: the tip moved, the rest re-spread by the old spacing scaled to the new length
export function moveTipAndResample(curve, newTip) {
  const lengths = accumulateLengths(curve), oldTotal = lengths[lengths.length - 1];
  const newTotal = lengths[lengths.length - 2] + dist(curve[curve.length - 2], newTip), k = oldTotal ? newTotal / oldTotal : 1;
  const out = curve.map((p, i) => i === curve.length - 1 ? newTip : sampleAtLength(curve, lengths, lengths[i] * k));
  for (let i = 0; i < curve.length; i++) curve[i] = out[i];
}

// port of puff: toward the root's surface normal, never nearer the root than before
export function puff(curve, normal, strength, pointFactor) {
  const root = curve[0], lengths = accumulateLengths(curve);
  for (let i = 1; i < curve.length; i++) {
    const old = curve[i], goal = add(root, mul(normal, lengths[i])), w = 0.01 * strength * pointFactor(i);
    let p = mix(old, goal, w);
    const dOld = dist(old, root), dNew = dist(p, root);
    if (dNew < dOld) p = add(p, mul(norm(sub(p, root)), dOld - dNew));
    curve[i] = p;
  }
}
```

**After every brush stroke** (`CurvesConstraintSolver::solve_step` → `curve_constraints.cc`), two constraints run, and
they are the reason Blender's hair never stretches or sinks into the head while you comb it:

```js
// port of solve_length_constraints: root to tip, each point put back at its rest distance from the one before
export function solveLengths(curve, rest /* segment lengths at the stroke's start */) {
  for (let i = 1; i < curve.length; i++) { const d = norm(sub(curve[i], curve[i - 1])); curve[i] = add(curve[i - 1], mul(d, rest[i - 1])); }
}
// port of solve_length_and_collision_constraints, with our proxies in place of the mesh BVH: a point that ended up
// inside the body is put on the surface plus a gap and slid on that plane so its segment keeps its length
// (Pythagoras: slide = sqrt(rest^2 - normalPart^2) - tangentPart); if it can't, the curve is reverted (Blender's
// "better not to move than to go into the surface")
export function solveLengthsAndCollision(curve, rest, startCurve, push /* (p, gap) -> [q, moved] */, gap = 0.002) {
  solveLengths(curve, rest);
  for (let i = 1; i < curve.length; i++) {
    const [q, moved] = push(curve[i], gap); if (!moved) continue;
    const n = norm(sub(q, curve[i]));                                  // the push direction stands in for the surface normal
    const seg = sub(q, curve[i - 1]), nPart = mul(n, dot(seg, n)), tPart = sub(seg, nPart), tLen = len(tPart);
    const r2 = rest[i - 1] ** 2, n2 = dot(nPart, nPart);
    if (r2 > n2) curve[i] = add(q, mul(norm(tPart), Math.sqrt(r2 - n2) - tLen));
    else { for (let k = 0; k < curve.length; k++) curve[k] = startCurve[k]; return false; }
  }
  return true;
}
```

## 4. Children: curl, clump, roughness (`particle_child.cc`)

The old particle hair's children are the shapes the Hair Nodes (Curl, Clump, Frizz, Roll) reproduce. The code is the
clearest statement of each:

- **kink** (`do_kink`): along the strand `time` runs 0..1, reparametrised by `shape` (`time^(1+shape)` for shape < 0,
  `time^(1/(1-shape))` for shape > 0); `t = time * freq * π`; `smooth_start` ramps the effect in with `sin(t/2)`. The
  kink axis is a vector made normal to the strand. Types:
  - **curl**: the axis vector scaled by `amplitude` and rotated about the strand's tangent by `t`, added to the point
    (which is first pulled toward the parent by `flat`);
  - **wave**: `amplitude * sin(t)` along the axis;
  - **radial**: the point pulled toward the parent by `amplitude * sin(t)`;
  - **braid**: three strands' offsets as `cos(t)`, `sin(2t)` phases.
- **clump** (`do_clump_level`): the point mixed toward the parent (the clump's centre line) by
  `clump = clumpfac * pa_clump * time^cpow`, `cpow = 1 + 9 * clumppow` (or `1 + clumppow` when negative); a negative
  `clumpfac` clumps the roots instead of the tips. Optional noise moves the centre with a Voronoi offset.
- **roughness** (`do_rough`, `do_rough_end`): turbulence noise (2 octaves) at `rco = loc * t` added along the strand
  frame's three axes, scaled by `fac`; `rough_end` scatters the tips by `fac * t^shape` in the frame's plane.

```js
// ports of do_kink (curl, wave) and do_clump_level and do_rough, per point: time in 0..1 along the strand
export function kink(point, parent, tangent, time, { type = "curl", freq = 2, shape = 0, amplitude = 0.01, flat = 0, axis = [0, 0, 1], smoothStart = true }) {
  if (shape) time = shape < 0 ? Math.pow(time, 1 + shape) : Math.pow(time, 1 / (1 - shape));
  const t = time * freq * Math.PI;
  let dt = 1; if (smoothStart) dt = Math.sin(Math.min(Math.abs(t), Math.PI) / 2);
  let k = norm(sub(axis, mul(tangent, dot(axis, tangent))));           // the kink axis normal to the strand
  let result;
  if (type === "curl") { const off = rotateAbout(mul(k, amplitude), tangent, t); result = add(mix(point, parent, flat), off); }
  else if (type === "wave") { result = add(point, mul(k, amplitude * Math.sin(t))); if (flat > 0) result = add(result, mul(projectOn(sub(parent, point), k), flat)); }
  else if (type === "radial") { result = add(point, mul(sub(parent, point), -amplitude * Math.sin(t))); }
  else return point;
  return dt < 1 ? mix(point, result, dt) : result;
}
export function clump(point, parent, time, clumpfac, clumppow, paClump = 1) {
  const cpow = clumppow < 0 ? 1 + clumppow : 1 + 9 * clumppow;
  const c = clumpfac < 0 ? -clumpfac * paClump * Math.pow(1 - time, cpow) : clumpfac * paClump * Math.pow(time, cpow);
  return mix(point, parent, c);
}
export function rough(point, frame /* [x, y, z] axes */, loc /* a per-strand seed in 0..1^3 */, t, fac, size, noise /* (x, y, z) -> -1..1 */) {
  const r = [loc[0] * t, loc[1] * t, loc[2] * t];
  const n = [noise(r[0] / size, r[1] / size, r[2] / size), noise(r[1] / size, r[2] / size, r[0] / size), noise(r[2] / size, r[0] / size, r[1] / size)];
  return add(point, add(mul(frame[0], fac * n[0]), add(mul(frame[1], fac * n[1]), mul(frame[2], fac * n[2]))));
}
```

**The hair node groups** (from memory of the manual and the code they lift from; verify in Blender when it's open):
*Interpolate Hair Curves* is §2 for children from guides; *Clump Hair Curves* is `clump` with a shape curve;
*Curl Hair Curves* and *Frizz* are `kink` curl and `rough`; *Roll* bends the tips into a roll; *Shrinkwrap* pushes
curves out of a surface by a distance (our push-out); *Smooth*, *Trim* (cut to a length), *Set Hair Curve Profile*
(the radius along the strand), *Duplicate* (copies with jitter), *Attach to Surface* (the root UV). None of this is
beyond a page of code each.

## 5. The simulation (`particle_system.cc` → `cloth.cc` → `SIM_mass_spring.cc` → `implicit_blender.cc`)

"Hair currently is a cloth sim in disguise" (the comment in `SIM_cloth_solve`). What happens:

- **Setup** (`particle_system.cc` ~3360): every hair key becomes a cloth vertex; a **fake root** is added before the
  real root at `co + (co - co_next)` (a point mirrored behind the root) so the first bending spring has something to
  hold the root's direction; the root transform (`root_mat`) is stored per hair; each vertex gets a pin weight
  (`hair_set_pinning`: the root 1.0, the rest the key's weight 0..1 from the vertex group, or 1.0 for hairs too
  short to simulate) and a `bending_stiffness` with per-hair randomness. Hairs whose segments are under a tenth of the
  average length are excluded (`psys_hair_use_simulation`: they make the solver unstable).
- **Springs** (`cloth_build_springs`): **structural** springs between consecutive points (rest length, stiffness,
  damping); **bending-hair** springs over every triple (i, j, k) along the strand with `restlen = |xj - xi|` and
  stiffness the mean of the two points' `bend_stiff`.
- **Bending targets** (`cloth_hair_update_bending_targets`): a frame is started from the root's rotation (the
  surface normal as the initial direction) and **parallel-transported** along the strand, segment by segment; each
  spring's target is its rest offset in that frame times the rest length. So a bent rest shape is kept, not a
  straight one.
- **Forces** (`cloth_calc_force` + `implicit_blender.cc`): gravity per mass; a **goal spring** per unpinned vertex
  with goal > 0: pulled toward its animated rest position (interpolated over the step) with
  `k = goal * goalspring / avg_spring_len` and `goalfrict` damping (this is wig.js's `hold`); air **drag** (`Cvi`);
  the **linear spring** `f = stiffness * (length - restlen)` along the segment with damping on the along-velocity,
  resisting compression only when asked; the **hair bending spring** (`spring_hairbend_forces`): the force on k is
  `stiffness * (target - edge_jk)` where `target = restlen * dir_ij` turned into the frame, the counterforce on j, and
  damping on the velocity of k orthogonal to the segment (damping is set to 0 "TESTING" in the current source); wind
  and other effectors per vertex.
- **Hair volume** (`hair_volume.cc`): hair positions and velocities are splatted onto a **voxel grid**; each vertex
  then gets a force toward the grid's smoothed velocity (`smoothfac`: hair moving together, friction) and a
  **pressure** force up the density gradient where the gradient is over `minpressure` (`pressurefac`: hair pushing
  itself apart so a bundle keeps volume); a Poisson solve toward a `target_density` ("Two-way Coupled SPH and Particle
  Level Set Fluid Simulation", Losasso 2008) makes the hair neither collapse nor explode. This is Blender's *volume*,
  at simulation time; our **fake volume** is a geometric cap and costs nothing. Worth having later as an option for the
  jiggle: the velocity smoothing alone makes a lock move as one.
- **The step** (`SIM_cloth_solve`): per substep: pinned vertices' constraints → forces → velocities (implicit, a
  conjugate-gradient solve) → collisions (`cloth_bvh_collision`: impulses from the body's BVH, then the velocities
  corrected) → the hair volume continuum step → positions → pinned vertices moved to their animated positions.

**Ours (the lighter version),** in `wig.js` extended, verlet instead of implicit:

1. Points per guide, the root pinned to the body (its triangle and bary), a **fake root** behind it kept rigid with
   the root's frame (so the hair leaves the scalp in the drawn direction).
2. Per substep: gravity, drag (damping), the goal pull toward the drawn rest shape with a pin weight that falls from
   the root (`hold * (1 - t)^2` as wig.js does; Blender's per-point vertex weight is the same idea).
3. Constraints, iterated 4 times: segment lengths (§3's `solveLengths`, root to tip); a **bending constraint** as a
   position correction: with the frame transported from the root, point k is pulled toward `j + R * rest_jk` by the
   bending stiffness (Blender's target, applied as PBD rather than as a force); collisions by push-out against the
   head field, the body slices and the garment proxy (§3's slide-on-the-plane keeps the length).
4. Only locks with physics on are simulated; the rest are rigid with the head. Each lock's physics (gravity, hold,
   damping, bending, collide) is data in `salon.json`; a per-lock **pose override** replaces the points after the
   step (the animation refiner's hook).

## 6. What gets ported, and where

| Function (Blender) | Ours | File |
|---|---|---|
| `calc_position_with_interpolation` | `interpolateFromNeighbours` | `tools/character/salon/curveops.js` |
| `comb_spherical`, `spherical_snake_hook`, `puff`, `pinch_spherical`, `smooth`, `ExtrapolateCurvesEffect` | `comb`, `snakeHook`, `puff`, `pinch`, `smooth`, `grow` | `curveops.js` |
| `move_last_point_and_resample`, `solve_length_constraints`, `solve_length_and_collision_constraints` | `moveTipAndResample`, `solveLengths`, `solveLengthsAndCollision` | `curveops.js` |
| `do_kink` (curl, wave, radial), `do_clump_level`, `do_rough`, `do_rough_end` | `kink`, `clump`, `rough`, `roughEnd` | `tools/character/salon/kink.js` |
| the fake root, bending targets by parallel transport, the goal spring, the pin weights | `wig.js` grown: `bend`, `fakeRoot`, per-point `pin` | `tools/character/wig.js` |
| `SIM_hair_volume_vertex_grid_forces` (velocity smoothing) | later, `hairvolume.js` | optional |

Each of those files starts with: `// Ported from Blender (blender/blender, GPL-2.0-or-later): <the functions>. Our
JavaScript; Blender's names kept so it can be diffed against the source.` THIRD_PARTY.md gets the row.

What's **not** taken: the implicit solver (Eigen, conjugate gradient), the BVH collision, the cloth coupling, the
particle system's caches, the UV reverse sampler (our roots are triangle and bary), the brush falloff curve editor
(a fixed smooth falloff and an along-curve falloff slider are enough).

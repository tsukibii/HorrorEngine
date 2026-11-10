# Your own models, as recipes start from them

A recipe's `model` names a file here: the user's own models the prop generator reads, brings to their real size,
cuts into parts, paints and bakes as it does the props it makes in code (docs/PROPGEN.md).

| File | What | Recipe |
|---|---|---|
| `dbl_barrel.fbx` | the user's side-by-side double barrel (2026-11-09: "use it as a base and enhance it with better pbr textures"): the stock and action, the barrels and fore-end, the top lever, two triggers | `shotgun_double` (the `weapon` family's kind `double`, PROPGEN §30) |

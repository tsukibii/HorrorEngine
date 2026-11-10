# Your own models, as recipes start from them

A recipe's `model` names a file here: the user's own models the prop generator reads, brings to their real size,
cuts into parts, paints and bakes as it does the props it makes in code (docs/PROPGEN.md).

| File | What | Recipe |
|---|---|---|
| `dbl_barrel.fbx` | the user's side-by-side double barrel (2026-11-09: "use it as a base and enhance it with better pbr textures"): the stock and action, the barrels and fore-end, the top lever, two triggers | `shotgun_double` (the `weapon` family's kind `double`, PROPGEN §30) |
| `laptop_mouse.fbx` | the user's PSX-style laptop and mouse (2026-11-10: "analyze and enhance the laptop and mouse model"): the base, the lid open, the mouse, and a copy laid out flat; the two web photos it wore taken out | `laptop`, `laptop_shut`, `computer_mouse` (the `computer` family, PROPGEN §32) |

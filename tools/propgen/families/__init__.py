"""The prop families: each a module with make(spec, thing) that fills in a build.Thing (its materials, islands, game
mesh, detailed mesh and paint). FAMILIES names them; a recipe's `family` picks one."""
from . import bottle, box, can, cup, imported, key, sheet, utensil

FAMILIES = {"can": can, "bottle": bottle, "cup": cup, "sheet": sheet, "box": box, "import": imported, "utensil": utensil,
            "key": key}

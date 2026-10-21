"""The kit's meshes for a game (docs/KIT.md §5): plans the game, lists every kit mesh it needs (props, floors, window
frames, each door's leaf, handle and frame) and has `node tools/kit/build.mjs` write the missing ones into the
library. The importer does the same before it builds.

    python tools/kit_build.py --game Sample [--force]
"""
import subprocess
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import storylib as L  # noqa: E402
from storykit import kit as KIT  # noqa: E402


def main():
    game, args = L.pick_game(sys.argv[1:])
    story, _ = L.load(game)
    specs = ROOT / "Saved" / "kit" / f"{game}.json"
    items = KIT.write_specs(story, specs)
    node = shutil.which("node")
    if not node:
        print("node isn't on the PATH (the kit's meshes are made by tools/director/kit.js)")
        sys.exit(1)
    print(f"{game}: {len(items)} kit meshes")
    sys.exit(subprocess.run([node, str(ROOT / "tools" / "kit" / "build.mjs"), "--specs", str(specs)] + (["--force"] if "--force" in args else [])).returncode)


if __name__ == "__main__":
    main()

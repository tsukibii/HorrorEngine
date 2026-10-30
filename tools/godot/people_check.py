"""GDPEOPLE: a Character Studio export in Godot on the look plugin's skin (HSSkin: HumanShaders' skin shader with the
wetness layer): the glb in a Godot project of its own, its skin worn, pictured under xvfb as a medium close-up flat-lit
(its colour measured against the export's own baked paint), lit dry, sweating and oiled. Pictures in
Saved/Story/_look/godot_people/. Ends "GDPEOPLE ok". Needs a Studio export (STUDIO makes People/_studiotest).

    python tools/godot/people_check.py [--person NAME] [--keep DIR]
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLUGIN = ROOT / "GodotPlugins" / "HorrorStudioLook" / "addons" / "horrorstudio_look"
HUMAN = ROOT / "GodotPlugins" / "HumanShaders"
PEOPLE = ROOT / "Content" / "Studio" / "People"
OUT = ROOT / "Saved" / "Godot" / "_people"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_people"

PROJECT = '''config_version=5

[application]

config/name="HorrorStudio people check"
config/features=PackedStringArray("4.7", "Forward Plus")

[display]

window/size/viewport_width=1280
window/size/viewport_height=720
window/size/resizable=false

[rendering]

renderer/rendering_method="forward_plus"
'''


def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--person", default="_studiotest")
    ap.add_argument("--keep", default=str(KEEP))
    a = ap.parse_args()
    g = godot_bin()
    if not g:
        print("GDPEOPLE FAIL: no godot")
        return 1
    glb = PEOPLE / a.person / "export" / f"{a.person}.glb"
    if not glb.exists():
        print(f"GDPEOPLE FAIL: no export at {glb} (the Character Studio's Export for desk / Unreal, or STUDIO)")
        return 1
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "addons").mkdir(parents=True)
    (OUT / "people").mkdir()
    (OUT / "project.godot").write_text(PROJECT, encoding="utf-8")
    shutil.copytree(PLUGIN, OUT / "addons" / "horrorstudio_look")
    shutil.copytree(HUMAN, OUT / "HumanShaders", ignore=shutil.ignore_patterns("*.import"))
    shutil.copy(glb, OUT / "people" / glb.name)
    env = dict(os.environ)
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json"):          # the cloud's lavapipe; on a machine with a card the loader finds it itself
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    subprocess.run([g, "--headless", "--path", str(OUT), "--import"], capture_output=True, text=True, timeout=900)
    keep = Path(a.keep)
    keep.mkdir(parents=True, exist_ok=True)
    cmd = [g, "--path", str(OUT), "--rendering-driver", "vulkan", "-s", "res://addons/horrorstudio_look/demo/people.gd", "--", f"--glb=res://people/{glb.name}", f"--out={keep}"]
    if shutil.which("xvfb-run"):                                          # Xvfb when it's there (the card still draws through Vulkan): a fixed-size window no window manager resizes
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1200, env=env)
    text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l and "ERR_CANT_OPEN" not in l)
    if "switching to OpenGL 3" in text:
        print(text[:1200])
        print("GDPEOPLE FAIL: Vulkan failed and Godot fell back to OpenGL (VK_ICD_FILENAMES=" + env.get("VK_ICD_FILENAMES", "") + ")")
        return 1
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "SHADER ERROR" in l or "PEOPLE FAIL" in l]
    if bad or "PEOPLE {" not in text:
        print(text[-3000:])
        print("GDPEOPLE FAIL: the demo didn't run clean")
        return 1
    rep = json.loads((keep / "people.json").read_text(encoding="utf-8"))
    paint, flat = rep.get("paint") or {}, rep.get("flat") or {}
    ok = rep.get("skin_mats", 0) >= 1
    print(("  ok  " if ok else "  BAD ") + "the skin on HSSkin (%d materials)" % rep.get("skin_mats", 0))
    if rep.get("normal_maps", 0) >= 1 and rep.get("relief_map", 0) > 0.01:   # an export with the Studio's relief (pores, wrinkles): the lit face grainier with it than flattened
        relief = rep.get("relief_lit", 0) > rep.get("relief_smooth", 9) * 1.08
        ok = ok and relief
        print(("  ok  " if relief else "  BAD ") + "the export's maps worn (%d normal, %d roughness and thinness, %d studioSkin records): the lit face's grain %.4f with the relief against %.4f flattened" % (
            rep.get("normal_maps", 0), rep.get("orm_maps", 0), rep.get("studio_skin", 0), rep.get("relief_lit", 0), rep.get("relief_smooth", 0)))
    elif rep.get("normal_maps", 0) >= 1:
        print("  ok  the export's maps worn (%d normal, %d roughness and thinness, %d studioSkin records); its normal map is flat (mean tilt %.4f: no pores or wrinkles set on this character), so the relief isn't measured" % (rep.get("normal_maps", 0), rep.get("orm_maps", 0), rep.get("studio_skin", 0), rep.get("relief_map", 0)))
    else:
        print("  --  no normal map in this export (an older Export for desk / Unreal): the relief isn't measured")
    if paint and flat:
        ratios = [flat[c] / max(paint[c], 1e-3) for c in "rgb"]
        close = all(0.7 < r < 1.6 for r in ratios) and max(ratios) / min(ratios) < 1.25      # flat-lit: the paint's colour, its hue kept
        print(("  ok  " if close else "  BAD ") + "flat-lit, the skin reads as its baked paint: picture %s against paint %s (ratios %s)" % (
            [round(flat[c], 3) for c in "rgb"], [round(paint[c], 3) for c in "rgb"], [round(x, 2) for x in ratios]))
        ok = ok and close
    else:
        print("  BAD  no paint or no skin pixels measured: " + json.dumps(rep))
        ok = False
    # the eye: the Studio's refracting cornea on the export's eyeballs; at a slant the iris lies elsewhere than with
    # the cornea bending nothing (IOR 1): the pupil's centre in the two pictures differs
    try:
        from PIL import Image
        import numpy as np
        def pupil(f):
            im = np.asarray(Image.open(keep / f).convert("L")).astype(float) / 255.0
            h, w = im.shape
            r = int(rep.get("eye_radius_px", h / 4))                       # the eyeball's radius on the picture (its centre is the frame's: the camera looks at it)
            c = im[h // 2 - r:h // 2 + r, w // 2 - r:w // 2 + r]
            dark = c < 0.06
            solid = dark.copy()                                           # a solid blot: a dark pixel whose 5 × 5 neighbourhood is dark too (lashes and hair strands are thin and fall out)
            for dy in range(-2, 3):
                for dx in range(-2, 3):
                    solid[2:-2, 2:-2] &= dark[2 + dy:c.shape[0] - 2 + dy, 2 + dx:c.shape[1] - 2 + dx]
            yy, xx = np.mgrid[0:c.shape[0], 0:c.shape[1]]
            solid &= (xx - r) ** 2 + (yy - r) ** 2 < (0.9 * r) ** 2       # inside the eyeball: hair over the brow is outside it
            ys, xs = np.nonzero(solid)
            return (float(xs.mean()), float(ys.mean()), int(xs.size)) if xs.size else None
        eyes_on = bool(rep.get("eyes"))
        print(("  ok  " if eyes_on else "  BAD ") + "the eyes on the Studio's eye shader: " + ", ".join(rep.get("eyes", [])))
        ok = ok and eyes_on
        a, b, c = pupil("people_eye_front.png"), pupil("people_eye_slant.png"), pupil("people_eye_slant_flat.png")
        if a and b and c:
            shift = ((b[0] - c[0]) ** 2 + (b[1] - c[1]) ** 2) ** 0.5
            bent = shift > 1.0
            print(("  ok  " if bent else "  BAD ") + "at a slant the cornea moves the iris: the pupil's centre %.1f px from where IOR 1 reads it (front %d px of pupil, slant %d)" % (shift, a[2], b[2]))
            ok = ok and bent
        else:
            print("  BAD  no pupil found in the eye pictures: " + json.dumps([a, b, c]))
            ok = False
    except ImportError:
        print("  (PIL or numpy missing: the eye not measured)")
    print("  pictures in " + str(keep))
    if not ok:
        print("GDPEOPLE FAIL")
        return 1
    print("GDPEOPLE ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())

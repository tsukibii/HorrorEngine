"""GDCLOTH: the look plugin's cloth shader (HSCloth: the studio's clothing fabric sets worn in Godot, GODOT_LOOK §5x)
in a Godot project of its own under xvfb. Every set the plugin has on a ball of cloth (its weave magnified, and at a
garment's distance in four dyes: the sheet), then one ball lit so each thing the shader does can be measured:

  the dye      a ball dyed cream, red, black and green keeps each colour (its hue, its lightness in order)
  the weave    a low light across a magnified knit: far more fine contrast with the relief than without
  the fuzz     a light from the side on a wool ball: its lit side brighter with the fuzz lobe than without; a light
               behind it: its outline lit by the halo; hardly either on leather; under the sky's light alone the
               wool's edge lifts too
  sheer        a black sheer knit over skin: the skin shows through its middle, less at a higher denier, least at its edge

With --person NAME (a Character Studio export that wears fabric sets: Exports/characters/NAME/NAME.glb) its garments
are pictured as the file has them and on the cloth shader, and the records counted. Pictures in
Saved/Story/_look/godot_cloth/. Ends "GDCLOTH ok".

    python tools/godot/cloth_check.py [--person NAME | --glb FILE] [--sets A,B] [--keep DIR] [--sheet FILE]
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
OUT = ROOT / "Saved" / "Godot" / "_cloth"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_cloth"

PROJECT = '''config_version=5

[application]

config/name="HorrorStudio cloth check"
config/features=PackedStringArray("4.7", "Forward Plus")

[display]

window/size/viewport_width=640
window/size/viewport_height=360
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
    ap.add_argument("--person", default="")
    ap.add_argument("--glb", default="")
    ap.add_argument("--sets", default="")
    ap.add_argument("--keep", default=str(KEEP))
    ap.add_argument("--sheet", default="")
    a = ap.parse_args()
    g = godot_bin()
    if not g:
        print("GDCLOTH FAIL: no godot")
        return 1
    glb = Path(a.glb) if a.glb else None
    if a.person:
        glb = next((p for p in [ROOT / d / "characters" / a.person / f"{a.person}.glb" for d in ("Exports", "Saved/Exports")] if p.exists()), None)
        if glb is None:
            print(f"GDCLOTH FAIL: no export of {a.person} (the Character Studio's Export for Godot)")
            return 1
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "addons").mkdir(parents=True)
    (OUT / "project.godot").write_text(PROJECT, encoding="utf-8")
    shutil.copytree(PLUGIN, OUT / "addons" / "horrorstudio_look")
    shutil.copytree(HUMAN, OUT / "HumanShaders", ignore=shutil.ignore_patterns("*.import"))
    if glb:
        (OUT / "people").mkdir()
        shutil.copy(glb, OUT / "people" / glb.name)
    env = dict(os.environ)
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json"):
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    subprocess.run([g, "--headless", "--path", str(OUT), "--import"], capture_output=True, text=True, timeout=1800)
    keep = Path(a.keep)
    keep.mkdir(parents=True, exist_ok=True)
    for f in keep.glob("*.png"):
        f.unlink()
    cmd = [g, "--path", str(OUT), "--rendering-driver", "vulkan", "-s", "res://addons/horrorstudio_look/demo/cloth.gd", "--", f"--out={keep}"]
    if glb:
        cmd.append(f"--glb=res://people/{glb.name}")
    if a.sets:
        cmd.append(f"--sets={a.sets}")
    if shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=3600, env=env)
    text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l and "ERR_CANT_OPEN" not in l)
    errs = [l for l in text.splitlines() if "SHADER ERROR" in l or "ERROR:" in l or "SCRIPT ERROR" in l or "Parse Error" in l]
    rep = json.loads((keep / "cloth_report.json").read_text()) if (keep / "cloth_report.json").exists() else None
    if rep is None or "CLOTH demo done" not in text:
        print(text[-3000:])
        print("GDCLOTH FAIL: the demo didn't finish")
        return 1
    import numpy as np
    from PIL import Image
    bad = []
    say = lambda ok, what: (print(("  ok  " if ok else "  BAD ") + what), None if ok else bad.append(what))
    say(not errs, "no shader or script errors" if not errs else "errors: " + " | ".join(errs[:4]))
    say(rep["made"] == rep["sets"] and len(rep["sets"]) > 0, f"{len(rep['made'])} of {len(rep['sets'])} sets made a material: {', '.join(rep['sets'])}")
    lin = lambda a: np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    img = lambda n: lin(np.asarray(Image.open(keep / n).convert("RGB"), np.float64) / 255)
    lum = lambda a: a @ np.array([0.2126, 0.7152, 0.0722])
    n = 512
    yy, xx = np.mgrid[0:n, 0:n]
    rr = np.hypot(xx - n / 2, yy - n / 2) / (n / 2)
    has = lambda f: (keep / f).exists()
    if has("lab_dye_e9e4d8.png"):
        mid = rr < 0.2
        c = {k: img(f"lab_dye_{k}.png")[mid].mean(0) for k in ("e9e4d8", "8a2432", "19191b", "2f6b3a")}
        L = {k: float(lum(v)) for k, v in c.items()}
        say(L["e9e4d8"] > 2.5 * L["8a2432"] and L["8a2432"] > 2 * L["19191b"] and L["19191b"] < 0.06, f"the dye's lightness: cream {L['e9e4d8']:.3f}, red {L['8a2432']:.3f}, black {L['19191b']:.4f}")
        say(c["8a2432"][0] > 3 * c["8a2432"][1] and c["2f6b3a"][1] > 1.6 * c["2f6b3a"][0] and abs(c["e9e4d8"][0] / c["e9e4d8"][2] - 1) < 0.35,
            f"the dye's hue kept: red r/g {c['8a2432'][0] / c['8a2432'][1]:.1f}, green g/r {c['2f6b3a'][1] / c['2f6b3a'][0]:.1f}, cream r/b {c['e9e4d8'][0] / c['e9e4d8'][2]:.2f}")
    if has("lab_detail_1.png"):
        mid = rr < 0.45
        fine = lambda a: float(np.abs(a - (np.roll(a, 3, 0) + np.roll(a, -3, 0) + np.roll(a, 3, 1) + np.roll(a, -3, 1)) / 4)[mid].mean())
        d1, d0 = fine(lum(img("lab_detail_1.png"))), fine(lum(img("lab_detail_0.png")))
        say(d1 > 1.8 * d0, f"the weave's relief: fine contrast {d1:.4f} with it, {d0:.4f} without ({d1 / max(d0, 1e-9):.1f} times)")
    wool = "WoolKnit001" if has("lab_fuzz_WoolKnit001_1.png") else None
    if wool:
        lit_side = (rr > 0.45) & (rr < 0.8) & (xx > n * 0.62)                   # the side the light is on
        e = lambda f, where: float(lum(img(f))[where].mean())
        w1, w0 = e(f"lab_fuzz_{wool}_1.png", lit_side), e(f"lab_fuzz_{wool}_0.png", lit_side)
        say(w1 > 1.12 * w0, f"the fuzz under a light from the side, on wool: its lit side {w1:.4f} with the lobe, {w0:.4f} without ({w1 / max(w0, 1e-9):.2f} times)")
        ring = (rr > 0.6) & (rr < 0.9)
        h1, h0 = e(f"lab_halo_{wool}_1.png", ring), e(f"lab_halo_{wool}_0.png", ring)
        say(h1 > 1.3 * h0, f"the halo against a light behind, on wool: its outline {h1:.4f} with it, {h0:.4f} without ({h1 / max(h0, 1e-9):.2f} times)")
        if has("lab_fuzz_Leather001_1.png"):
            l1, l0 = e("lab_fuzz_Leather001_1.png", lit_side), e("lab_fuzz_Leather001_0.png", lit_side)
            g1, g0 = e("lab_halo_Leather001_1.png", ring), e("lab_halo_Leather001_0.png", ring)
            say(l1 < 1.08 * l0 and g1 < 1.05 * g0 + 1e-4, f"and on leather hardly either: {l1 / max(l0, 1e-9):.2f} and {g1 / max(g0, 1e-9):.2f} times")
        edge, mid = (rr > 0.6) & (rr < 0.8), rr < 0.25
        s1, s0 = lum(img(f"lab_sky_{wool}_1.png")), lum(img(f"lab_sky_{wool}_0.png"))
        k1, k0 = float(s1[edge].mean() / s1[mid].mean()), float(s0[edge].mean() / s0[mid].mean())
        say(k1 > 1.12 * k0, f"under the sky's light alone the wool's edge lifts: edge over middle {k1:.2f} with the fuzz, {k0:.2f} without")
    if has("lab_sheer_3.png"):
        mid, edge = rr < 0.2, (rr > 0.62) & (rr < 0.74)
        skin, a3, a7 = lum(img("lab_sheer_skin.png")), lum(img("lab_sheer_3.png")), lum(img("lab_sheer_7.png"))
        t3, t7, te = float(a3[mid].mean() / skin[mid].mean()), float(a7[mid].mean() / skin[mid].mean()), float(a3[edge].mean() / skin[edge].mean())
        say(0.35 < t3 < 0.92 and t7 < t3 - 0.15 and te < t3 - 0.08, f"a black sheer knit over skin: {t3:.2f} of the skin's light through its middle at 0.3, {t7:.2f} at 0.7, {te:.2f} toward its edge")
    if glb:
        p = rep.get("person", {})
        say(p.get("cloth_materials", 0) > 0 and p.get("records", 0) > 0, f"{glb.name}: {p.get('records')} garments say their fabric, {p.get('cloth_materials')} surfaces on the cloth shader ({', '.join(f'{k} x{v}' for k, v in p.get('sets', {}).items())})")
        views = [v for v in ("full", "chest", "legs", "feet") if has(f"person_{v}_cloth.png")]
        if views:
            ims = [np.concatenate([np.asarray(Image.open(keep / f"person_{v}_file.png").convert("RGB")), np.asarray(Image.open(keep / f"person_{v}_cloth.png").convert("RGB"))], 1) for v in views]
            Image.fromarray(np.concatenate(ims[:2], 1)).save(keep / "person_sheet_a.jpg", quality=90)
            if len(ims) > 2:
                Image.fromarray(np.concatenate(ims[2:4], 1)).save(keep / "person_sheet_b.jpg", quality=90)
    if has("cloth_sheet.png"):                                            # the sheet with each set's name under its row
        from PIL import ImageDraw
        table = json.loads((PLUGIN / "textures" / "cloth" / "cloth.json").read_text(encoding="utf-8"))
        src, c = Image.open(keep / "cloth_sheet.png").convert("RGB"), rep["cells"]
        px, cap = c["px"], 22
        sheet = Image.new("RGB", (src.width, c["rows"] * (px + cap)), (27, 29, 34))
        dr = ImageDraw.Draw(sheet)
        for r, nme in enumerate(rep["sets"]):
            sheet.paste(src.crop((0, r * px, src.width, (r + 1) * px)), (0, r * (px + cap)))
            dr.text((8, r * (px + cap) + px + 4), f"{nme}: {table.get(nme, {}).get('label', '')}"[:230], fill=(226, 224, 216))
        sheet.save(keep / "cloth_sheet.jpg", quality=90)
        if a.sheet:
            sheet.save(a.sheet, quality=90)
    print(f"  pictures in {keep.relative_to(ROOT) if keep.is_relative_to(ROOT) else keep}")
    print("GDCLOTH " + ("FAIL" if bad else "ok"))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

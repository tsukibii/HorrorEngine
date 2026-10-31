"""EYELIDS: a Character Studio export's eyes behind its lids, open and through the blink (docs/GODOT_LOOK.md §5f). The
export carries each eye's blink as morph targets (eyesClosed_L and _R on the skin, the lashes and the brows, each with
its in-betweens: tools/character/index.html blinkTargets) and Godot sets them (blink.gd: the blink's w, each in-between by
its hat).
Two measures:

  the file: the skin and each eyeball drawn as depth from the front and from four sides (25 degrees left and right, 20
  above and below), at every twentieth of the blink, both eyes together, as Godot puts the targets together; anywhere
  the eyeball comes in front of skin within 5 mm of it is the eye through the lid (none allowed); open, the eyes show;
  shut, nothing of them shows from the front (the cut's edges meet: MHR's own shut lids leave a slit);

  Godot: the export worn as the game wears it, the eyeballs a flat green, pictured with the eyes open and held shut
  (demo/portrait.gd --blink --eyes=mask, the front and the eyes close): shut, no green.

Ends "EYELIDS ok". Needs a Studio export made since the blink (STUDIO makes People/_studiotest).

    python tools/godot/eyelids_check.py [--person NAME] [--no-godot] [--keep DIR]
"""
import argparse
import json
import os
import shutil
import struct
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from portrait_check import HUMAN, PEOPLE, PLUGIN, godot_bin, project_text, run  # noqa: E402

OUT = ROOT / "Saved" / "Godot" / "_eyelids"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_eyelids"
VIEWS = [("front", 0, 0), ("left", 25, 0), ("right", -25, 0), ("above", 0, -20), ("below", 0, 20)]
RES = 0.00005                      # 0.05 mm a pixel
NEAR = 0.005                       # skin within 5 mm behind the eye's surface is a lid over it (farther: the head's inside)


def glb_parts(path):
    """the skin (its points, triangles and blink targets) and each eyeball (points, triangles) from a binary glTF"""
    f = Path(path).read_bytes()
    n = struct.unpack("<I", f[12:16])[0]
    j = json.loads(f[20:20 + n])
    off = 20 + n + 8

    DT = {5126: np.float32, 5121: np.uint8, 5123: np.uint16, 5125: np.uint32}

    def view(bi, dt, count, extra=0):
        bv = j["bufferViews"][bi]
        return np.frombuffer(f, dtype=dt, count=count, offset=off + bv.get("byteOffset", 0) + extra)

    def acc(i):                                        # an accessor's values (a sparse one: zeros, or its view, with its few set)
        a = j["accessors"][i]
        k = {"VEC3": 3, "VEC2": 2, "VEC4": 4, "SCALAR": 1}[a["type"]]
        dt = DT[a["componentType"]]
        out = view(a["bufferView"], dt, a["count"] * k, a.get("byteOffset", 0)).reshape(-1, k) if "bufferView" in a else np.zeros((a["count"], k), dt)
        sp = a.get("sparse")
        if sp:
            out = out.copy()
            ix = view(sp["indices"]["bufferView"], DT[sp["indices"]["componentType"]], sp["count"], sp["indices"].get("byteOffset", 0)).astype(np.int64)
            out[ix] = view(sp["values"]["bufferView"], dt, sp["count"] * k, sp["values"].get("byteOffset", 0)).reshape(-1, k)
        return out

    skin, eyes = None, {}
    for nd in j["nodes"]:
        nm = nd.get("name") or ""
        if "mesh" not in nd:
            continue
        m = j["meshes"][nd["mesh"]]
        pr = m["primitives"][0]
        P = acc(pr["attributes"]["POSITION"]).astype(np.float64)
        T = acc(pr["indices"]).reshape(-1, 3).astype(np.int64) if "indices" in pr else np.arange(len(P)).reshape(-1, 3)
        if nm.endswith("_skin"):
            names = (m.get("extras") or {}).get("targetNames", [])
            targets = {names[i]: acc(t["POSITION"]).astype(np.float64) for i, t in enumerate(pr.get("targets", [])) if i < len(names) and "POSITION" in t}
            skin = (P, T, targets)
        elif "_eye_" in nm:
            eyes[nm[-1]] = (P, T)
    return skin, eyes


def zbuf(P, T, R, o, box):
    """the nearest surface's depth (towards the viewer, +z after R) on a grid over box, -inf where there's none"""
    Q = (P - o) @ R.T
    x0, y0, x1, y1 = box
    W, H = int((x1 - x0) / RES), int((y1 - y0) / RES)
    Z = np.full((H, W), -np.inf)
    A, B, C = Q[T[:, 0]], Q[T[:, 1]], Q[T[:, 2]]
    keep = ((np.minimum(np.minimum(A[:, 0], B[:, 0]), C[:, 0]) < x1) & (np.maximum(np.maximum(A[:, 0], B[:, 0]), C[:, 0]) > x0) &
            (np.minimum(np.minimum(A[:, 1], B[:, 1]), C[:, 1]) < y1) & (np.maximum(np.maximum(A[:, 1], B[:, 1]), C[:, 1]) > y0))
    for a, b, c in zip(A[keep], B[keep], C[keep]):
        mnx, mxx = max(int((min(a[0], b[0], c[0]) - x0) / RES), 0), min(int((max(a[0], b[0], c[0]) - x0) / RES) + 1, W)
        mny, mxy = max(int((min(a[1], b[1], c[1]) - y0) / RES), 0), min(int((max(a[1], b[1], c[1]) - y0) / RES) + 1, H)
        if mnx >= mxx or mny >= mxy:
            continue
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-18:
            continue
        X, Y = np.meshgrid(x0 + (np.arange(mnx, mxx) + 0.5) * RES, y0 + (np.arange(mny, mxy) + 0.5) * RES)
        w0 = ((b[1] - c[1]) * (X - c[0]) + (c[0] - b[0]) * (Y - c[1])) / d
        w1 = ((c[1] - a[1]) * (X - c[0]) + (a[0] - c[0]) * (Y - c[1])) / d
        w2 = 1 - w0 - w1
        m = (w0 >= -1e-9) & (w1 >= -1e-9) & (w2 >= -1e-9)
        sub = Z[mny:mxy, mnx:mxx]
        np.maximum(sub, np.where(m, w0 * a[2] + w1 * b[2] + w2 * c[2], -np.inf), out=sub)
    return Z


def turn(yaw, pitch):
    cy, sy, cp, sp = np.cos(yaw), np.sin(yaw), np.cos(pitch), np.sin(pitch)
    return np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]]) @ np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])


def blink_weights(names, w):
    """each blink target's weight for an eye shut by w, as blink.gd sets them: the blink itself w, each in-between
    (`eyesClosed_L_in1250`: its weight 0.125, in ten-thousandths) its hat, 1 at its weight and nothing at its neighbours'"""
    out = {}
    for side in "LR":
        base = f"eyesClosed_{side}"
        if base not in names:
            continue
        out[base] = w
        keys = sorted((int(n[len(base) + 3:]) / 10000, n) for n in names if n.startswith(base + "_in") and n[len(base) + 3:].isdigit())
        ws = [0.0] + [k for k, _ in keys] + [1.0]
        for i, (k, n) in enumerate(keys, start=1):
            lo, hi = ws[i - 1], ws[i + 1]
            out[n] = (w - lo) / (k - lo) if lo <= w <= k else (hi - w) / (hi - k) if k < w <= hi else 0.0
    return out


def skin_at(skin, w):
    """the skin with both eyes' blink at w, as Godot puts the targets together"""
    P, _, tg = skin
    out = P.copy()
    for n, v in blink_weights(tg.keys(), w).items():
        if v:
            out += v * tg[n]
    return out


def sweep(skin, eyes):
    """for each eye, w and view: the eye in front of a lid (mm2, deepest mm), and how much of the eye shows (mm2)"""
    rows = []
    for side, (EP, ET) in sorted(eyes.items()):
        c = (EP.max(0) + EP.min(0)) / 2
        r = (EP.max(0) - EP.min(0))[0] / 2
        box = (-1.6 * r, -1.2 * r, 1.6 * r, 1.2 * r)
        turns = {name: turn(np.radians(yaw), np.radians(pitch)) for name, yaw, pitch in VIEWS}
        eyez = {name: zbuf(EP, ET, R, c, box) for name, R in turns.items()}   # the eyeball doesn't blink
        for w in [k / 20 for k in range(21)]:
            SP = skin_at(skin, w)
            for name, R in turns.items():
                Zs, Ze = zbuf(SP, skin[1], R, c, box), eyez[name]
                eye = np.isfinite(Ze)
                with np.errstate(invalid="ignore"):
                    dz = Ze - Zs
                    poke = eye & np.isfinite(Zs) & (dz > 0) & (dz < NEAR)
                    seen = eye & (~np.isfinite(Zs) | (dz > 0))
                rows.append({"eye": side, "w": w, "view": name, "poke_mm2": float(poke.sum() * RES * RES * 1e6),
                             "deepest_mm": float(dz[poke].max() * 1000) if poke.any() else 0.0,
                             "seen_mm2": float(seen.sum() * RES * RES * 1e6)})
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--person", default="_studiotest")
    ap.add_argument("--no-godot", action="store_true")
    ap.add_argument("--keep", default=str(KEEP))
    a = ap.parse_args()
    glb = PEOPLE / a.person / "export" / f"{a.person}.glb"
    if not glb.exists():
        print(f"EYELIDS FAIL: no export at {glb} (the Character Studio's Export for desk / Unreal, or STUDIO)")
        return 1
    skin, eyes = glb_parts(glb)
    if skin is None or not eyes:
        print("EYELIDS FAIL: the export has no skin or no eyeballs")
        return 1
    have = sorted(k for k in skin[2] if k.startswith("eyesClosed_"))
    ins = [k for k in have if "_in" in k]
    ok = {"eyesClosed_L", "eyesClosed_R"} <= set(have) and len(ins) >= 2
    print(("  ok  " if ok else "  BAD ") + "the skin carries the blink: " + ("eyesClosed_L and _R with %d in-betweens" % len(ins) if have else "no targets (an export from before the blink: export it again)"))
    if not ok:
        print("EYELIDS FAIL")
        return 1
    rows = sweep(skin, eyes)
    worst = max(rows, key=lambda r: r["poke_mm2"])
    behind = worst["poke_mm2"] <= 0.02
    print(("  ok  " if behind else "  BAD ") + "the eyes behind the lids at every twentieth of the blink from five sides: the most in front of a lid %.3f mm2 (%s eye, w %.2f, from the %s, %.2f mm deep)" % (
        worst["poke_mm2"], worst["eye"], worst["w"], worst["view"], worst["deepest_mm"]))
    open_ = [r for r in rows if r["w"] == 0 and r["view"] == "front"]
    shut = [r for r in rows if r["w"] == 1 and r["view"] == "front"]
    opened = all(r["seen_mm2"] > 40 for r in open_)
    print(("  ok  " if opened else "  BAD ") + "open, the eyes show from the front: " + ", ".join("%s %.0f mm2" % (r["eye"], r["seen_mm2"]) for r in open_))
    closed = all(r["seen_mm2"] <= 0.05 for r in shut)
    print(("  ok  " if closed else "  BAD ") + "shut, nothing of them shows from the front (the lids meet): " + ", ".join("%s %.2f mm2" % (r["eye"], r["seen_mm2"]) for r in shut))
    half = [r for r in rows if abs(r["w"] - 0.5) < 1e-9 and r["view"] == "front"]
    print("      halfway they show " + ", ".join("%s %.0f mm2" % (r["eye"], r["seen_mm2"]) for r in half))
    ok = behind and opened and closed
    keep = Path(a.keep).resolve()
    keep.mkdir(parents=True, exist_ok=True)
    (keep / "sweep.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
    if not a.no_godot:
        g = godot_bin()
        if not g:
            print("EYELIDS FAIL: no godot (--no-godot for the file's measure alone)")
            return 1
        if OUT.exists():
            shutil.rmtree(OUT)
        (OUT / "addons").mkdir(parents=True)
        (OUT / "people").mkdir()
        (OUT / "project.godot").write_text(project_text(), encoding="utf-8")
        shutil.copytree(PLUGIN, OUT / "addons" / "horrorstudio_look")
        shutil.copytree(HUMAN, OUT / "HumanShaders", ignore=shutil.ignore_patterns("*.import"))
        shutil.copy(glb, OUT / "people" / glb.name)
        env = dict(os.environ)
        if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json"):
            env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
        subprocess.run([g, "--headless", "--path", str(OUT), "--import"], capture_output=True, text=True, timeout=900)
        got = {}
        for tag, w, mask in [("open", 0.0, True), ("shut", 1.0, True), ("half", 0.5, False), ("closed", 1.0, False)]:
            text, err = run(g, OUT, [f"--glb=res://people/{glb.name}", f"--out={keep}", f"--tag={tag}", "--shots=front,eyes", f"--blink={w}"] + (["--eyes=mask"] if mask else []), env)
            if text is None:
                print(err)
                print(f"EYELIDS FAIL: the portrait ({tag}) didn't run clean")
                return 1
            got[tag] = json.loads((keep / f"{tag}.json").read_text(encoding="utf-8"))
        blinks = got["shut"].get("blink_meshes", 0)
        print(("  ok  " if blinks >= 2 else "  BAD ") + "in Godot HSBlink drives the blink on %d meshes (the skin and the lashes at least)" % blinks)
        o, s = got["open"]["shots"], got["shut"]["shots"]
        g_open = all(o[k].get("eye_px", 0) > 500 for k in ("front", "eyes"))
        g_shut = all(s[k].get("eye_px", 0) <= 12 for k in ("front", "eyes"))
        print(("  ok  " if g_open else "  BAD ") + "open, Godot draws the eyes: %d and %d pixels (the front, the eyes close)" % (o["front"].get("eye_px", 0), o["eyes"].get("eye_px", 0)))
        print(("  ok  " if g_shut else "  BAD ") + "held shut, none of them: %d and %d pixels" % (s["front"].get("eye_px", 0), s["eyes"].get("eye_px", 0)))
        ok = ok and blinks >= 2 and g_open and g_shut
        try:
            from PIL import Image
            tiles = [Image.open(keep / f"{t}_eyes.png").convert("RGB").resize((640, 360)) for t in ("open", "half", "closed")]
            im = Image.new("RGB", (640, 360 * 3))
            for i, t in enumerate(tiles):
                im.paste(t, (0, 360 * i))
            im.save(keep / "blink.jpg", quality=90)
            print(f"  the blink (open, half, shut): {keep / 'blink.jpg'}")
        except (ImportError, FileNotFoundError):
            pass
    print(f"  measures in {keep}")
    if not ok:
        print("EYELIDS FAIL")
        return 1
    print("EYELIDS ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())

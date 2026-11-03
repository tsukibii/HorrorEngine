"""The PBR shelf (docs/ASSETS.md §6): your texture sets in Content/Studio/PBR/<category>/<name>/.

    python tools/pbr.py                 scan (unpacks new ZIPs, writes meta.json and thumbnails) and list by category
    python tools/pbr.py demo            five made-up sets as ZIPs in Poly Haven's format, unpacked: a shelf to try things on
    python tools/pbr.py check           PBR ok: map names, ZIPs, meta, refs (on a temporary shelf)

The shelf page (http://127.0.0.1:8780/pbr.html) shows them; a room's look or a prop's mat names one as pbr/<path>.
"""
import io
import json
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "Content" / "Python"))
from storykit import pbr as PBR  # noqa: E402
from storykit import library as LIB  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def cmd_list(_args):
    sets = PBR.scan()
    if not sets:
        print(f"The shelf is empty: put sets (or their ZIPs) in category folders under {PBR.ROOT}, or `pbr.py demo`.")
        return
    cat = None
    for ref, m in sorted(sets.items()):
        if m["category"] != cat:
            cat = m["category"]
            print(f"{cat or '(no category)'}/")
        maps = " ".join(sorted(m["maps"])) + (" (DX normal)" if m["normal"] == "dx" else "")
        print(f"  {ref:40} {maps:34} {m['tile_m']:g} m  {m.get('source', '')}")
    print(f"{len(sets)} sets in {PBR.ROOT}")


# ---- the demo: tileable made-up sets in the format you download (diff/ao/rough JPG, disp PNG, nor_dx PNG) ---------
def _demo_sets(n=1024, seed=7):
    import numpy as np
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n] / n

    def noise(beta, s=None):              # periodic fractal noise (so every set tiles), 0..1
        r = np.random.default_rng(s if s is not None else rng.integers(1 << 30))
        f = np.fft.fftfreq(n)
        k = np.sqrt(f[:, None] ** 2 + f[None, :] ** 2)
        k[0, 0] = 1
        z = np.fft.ifft2(np.fft.fft2(r.standard_normal((n, n))) / k ** beta).real
        return (z - z.min()) / (z.max() - z.min())

    def grooves(cell, width):              # 1 in the gaps, falling off over `width` (fractions of the image)
        return np.clip(1 - cell / width, 0, 1)

    def planks():
        rows, pl = 6, 3                    # 6 planks across, staggered ends
        v = yy * rows
        row = np.floor(v)
        off = (row * 0.37) % 1
        u = (xx + off) * pl % 1
        edge = np.minimum(np.minimum(v % 1, 1 - v % 1) / rows, np.minimum(u, 1 - u) / pl)
        gap = grooves(edge, 0.004)
        tone = (row * 0.618 + np.floor((xx + off) * pl) * 0.29) % 1
        grain = noise(2.6)
        stretch = np.sin((yy * rows * 40 + noise(2.2) * 6 + tone * 9) * np.pi) * 0.5 + 0.5
        fibre = noise(0.9)
        h = 0.75 - 0.6 * gap + 0.012 * stretch - 0.04 * grain + 0.03 * fibre
        base = np.stack([0.34, 0.20, 0.11])[:, None, None] * (0.6 + 0.45 * tone) * (0.7 + 0.3 * stretch) * (0.85 + 0.3 * grain)
        return base, h, 0.55 + 0.3 * grain + 0.15 * gap

    def bricks():
        rows, per = 8, 4
        v = yy * rows
        row = np.floor(v)
        u = (xx * per + 0.5 * (row % 2)) % 1
        edge = np.minimum(np.minimum(v % 1, 1 - v % 1) / rows, np.minimum(u, 1 - u) / per)
        mortar = grooves(edge, 0.006)
        chip = noise(1.4)
        tone = ((row * 0.73 + np.floor(xx * per + 0.5 * (row % 2)) * 0.41) % 1)
        h = 0.8 - 0.55 * mortar - 0.15 * (chip > 0.72) * (1 - mortar) + 0.04 * noise(1.0)
        brick = np.stack([0.42, 0.18, 0.13])[:, None, None] * (0.7 + 0.4 * tone + 0.2 * noise(1.8))
        grey = np.stack([0.42, 0.40, 0.37])[:, None, None] * (0.8 + 0.3 * chip)
        base = brick * (1 - mortar) + grey * mortar
        grime = noise(2.4) * (yy * 0.6 + 0.4)
        return base * (1 - 0.4 * grime), h, 0.75 + 0.2 * mortar + 0.05 * chip

    def plaster():
        low, mid = noise(2.8), noise(1.6)
        stain = np.clip((noise(3.0) - 0.55) * 4, 0, 1) * (0.4 + 0.6 * (1 - yy))   # water stains, darker at the top
        h = 0.5 + 0.12 * low + 0.05 * mid + 0.025 * noise(0.8)
        base = np.stack([0.78, 0.75, 0.68])[:, None, None] * (0.92 + 0.1 * mid) - np.stack([0.22, 0.22, 0.12])[:, None, None] * stain
        return base, h, 0.85 + 0.1 * mid - 0.25 * stain

    def tiles():
        cells = 5
        u, v = xx * cells % 1, yy * cells % 1
        edge = np.minimum(np.minimum(u, 1 - u), np.minimum(v, 1 - v)) / cells
        grout = grooves(edge, 0.005)
        crack = np.abs(noise(2.0) - 0.5) < 0.004
        tone = (np.floor(xx * cells) * 0.37 + np.floor(yy * cells) * 0.61) % 1
        h = 0.8 - 0.6 * grout - 0.3 * crack + 0.01 * noise(1.2)
        dirt = noise(2.2)
        base = np.stack([0.82, 0.83, 0.80])[:, None, None] * (0.9 + 0.08 * tone) * (1 - 0.25 * dirt * 0.6)
        base = base * (1 - grout) + np.stack([0.30, 0.28, 0.25])[:, None, None] * grout
        return base, h, 0.25 + 0.55 * grout + 0.2 * dirt + 0.3 * crack

    def concrete():
        low, pits = noise(2.4), noise(0.9)
        damp = np.clip((noise(3.2) - 0.45) * 3, 0, 1) * yy           # damp creeping up from the floor
        h = 0.55 + 0.1 * low - 0.25 * (pits > 0.8) + 0.035 * noise(0.7)
        base = np.stack([0.50, 0.50, 0.48])[:, None, None] * (0.85 + 0.25 * low) * (1 - 0.35 * damp)
        return base, h, 0.9 - 0.2 * damp + 0.05 * pits

    return {"Wood/worn_planks": planks, "Stone/Walls/grimy_brick": bricks, "Plaster/stained_plaster": plaster,
            "Tiles/cracked_tiles": tiles, "Concrete/damp_concrete": concrete}, np


def _encode(base, h, rough, np):
    from PIL import Image
    n = h.shape[0]
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * n * 0.03
    dr = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * n * 0.03               # down the image
    nrm = np.stack([-dx, -dr, np.ones_like(h)])                           # DirectX: green is down the image
    nrm /= np.linalg.norm(nrm, axis=0)
    blur = h.copy()
    for s in (2, 6, 14):
        blur = blur + sum(np.roll(np.roll(h, a * s, 0), b * s, 1) for a in (-1, 1) for b in (-1, 1))
    ao = np.clip(1 - np.clip(blur / 13 - h, 0, 1) * 3.5, 0, 1)
    rgb = np.clip(np.moveaxis(base, 0, -1) * ao[..., None] ** 0.5, 0, 1)
    u8 = lambda a: Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))   # noqa: E731
    return {"diff": (u8(rgb ** (1 / 2.2)), "JPEG"), "ao": (u8(ao), "JPEG"), "rough": (u8(rough), "JPEG"),
            "disp": (Image.fromarray((np.clip(h, 0, 1) * 65535).astype(np.uint16)), "PNG"),
            "nor_dx": (u8(np.moveaxis(nrm * 0.5 + 0.5, 0, -1)), "PNG")}


def cmd_demo(args):
    try:
        import numpy  # noqa: F401
        from PIL import Image  # noqa: F401
    except ImportError:
        sys.exit("pbr.py demo needs numpy and Pillow: `uv run --with numpy --with pillow tools/pbr.py demo`")
    sets, np = _demo_sets(int(args[0]) if args and args[0].isdigit() else 1024)
    res = "1k"
    for path, make in sets.items():
        cat, slug = path.rsplit("/", 1)
        d = PBR.ROOT / cat
        if (d / slug).exists():
            print(f"  {path}: already on the shelf")
            continue
        d.mkdir(parents=True, exist_ok=True)
        base, h, rough = make()
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            for key, (im, fmt) in _encode(base, h, rough, np).items():
                b = io.BytesIO()
                im.save(b, fmt, **({"quality": 90} if fmt == "JPEG" else {}))
                z.writestr(f"{slug}_{key}_{res}.{'jpg' if fmt == 'JPEG' else 'png'}", b.getvalue())
        (d / f"{slug}_{res}.zip").write_bytes(buf.getvalue())
        print(f"  {path}: {slug}_{res}.zip")
    sets = PBR.scan()
    for ref in sets:
        if any(ref.endswith(p) for p in _DEMO):
            PBR.save(ref, {"source": "made up (tools/pbr.py demo)", "url": "", "tile_m": _DEMO[next(p for p in _DEMO if ref.endswith(p))]})
    cmd_list([])


_DEMO = {"worn_planks": 2.4, "grimy_brick": 1.6, "stained_plaster": 2.5, "cracked_tiles": 1.0, "damp_concrete": 2.0}


# ---- the check ----------------------------------------------------------------------------------------------------
def check_cells(ok, bad):
    """A set's own layout (storykit/pbrcells.py, ASSETS §6c) on the project's sets in git: the tatami mats and the pavers
    found as their cells, tiling the repeat, a turned and scaled look's turned with it; the plain ones none."""
    try:
        from storykit import pbrcells as CELLS
        import numpy  # noqa: F401
    except ImportError:
        bad.append("a set's cells need numpy and Pillow")
        return
    tat = "pbr/floor/Tatami004_1K-PNG"
    for ref, want in ((tat, 8), ("pbr/concrete/Concrete010_1K-PNG", 64), ("pbr/floor/Tatami001_1K-PNG", 0),
                      ("pbr/wall/Plaster001_1K-PNG", 0), ("pbr/building/black marble", 0), ("pbr/metal/Metal063_1K-PNG", 0)):
        c = CELLS.cells(ref)
        got = len(c["rects"]) if c else 0
        ok(got == want, f"{ref}: {got} cells, not {want}" + ("" if c else f" ({CELLS.why(ref)})"))
    c = CELLS.cells(tat)
    if not c:
        return
    area = sum((r[2] - r[0]) * (r[3] - r[1]) for r in c["rects"])
    ok(abs(area - 1) < 0.02, f"{tat}'s cells cover {area:.3f} of its repeat")
    ok(all(abs(max(r[2] - r[0], r[3] - r[1]) / min(r[2] - r[0], r[3] - r[1]) - 2) < 0.1 for r in c["rects"]), "its mats are twice as long as they're wide")
    ok(c["tile"] == 3.6 and 0 < c["seam"] < 0.03, f"its tile {c['tile']} m, seam {c['seam']} m")
    t = CELLS.cells({"set": tat, "turn": 90, "scale": 0.5})                 # a quarter turn anticlockwise: (u, v) -> (1 - v, u)
    want = sorted([round((1 - r[3]) % 1, 2), round(r[0] % 1, 2)] for r in c["rects"])
    have = sorted([round(r[0] % 1, 2), round(r[1] % 1, 2)] for r in (t or {}).get("rects", []))
    ok(t and t["tile"] == 1.8 and len(have) == 8 and all(abs(a[0] - b[0]) < 0.01 and abs(a[1] - b[1]) < 0.01 for a, b in zip(want, have)),
       f"a turned look's cells turn with it: {have} for {want}")


def cmd_check(_args):
    bad = []

    def ok(cond, what):
        if not cond:
            bad.append(what)

    names = {"old_planks_diff_2k.jpg": "albedo", "old_planks_ao_2k.jpg": "ao", "old_planks_disp_2k.png": "height",
             "old_planks_nor_dx_2k.png": "normal_dx", "old_planks_nor_gl_2k.exr": "normal", "old_planks_rough_2k.jpg": "rough",
             "old_planks_arm_2k.jpg": "arm", "old_column_rough_4k.jpg": "rough", "rough_plaster_brick_diff_1k.jpg": "albedo",
             "Planks012_2K-JPG_Color.jpg": "albedo", "Planks012_2K-JPG_NormalDX.jpg": "normal_dx",
             "Planks012_2K-JPG_AmbientOcclusion.jpg": "ao", "Planks012_2K-JPG_Displacement.jpg": "height",
             "Planks012_2K-JPG_Roughness.jpg": "rough", "Planks012.png": None, "albedo.jpg": "albedo",
             "brick_preview.jpg": None, "metal_plate_metal_2k.jpg": "metal",
             # Unreal-ready names: the last word, after _ or -
             "denim1_albedo.png": "albedo", "denim1_ao.png": "ao", "denim1_height.png": "height", "denim1_metallic.png": "metal",
             "denim1_normal-dx.png": "normal_dx", "denim1_roughness.png": "rough", "T_Denim_BaseColor.png": "albedo",
             "T_Denim_ORM.png": "arm"}
    for fn, want in names.items():
        got = PBR.map_of(fn)
        ok(got == want, f"map_of({fn}) = {got}, wanted {want}")

    old_root = PBR.ROOT
    tmp = Path(tempfile.mkdtemp(prefix="pbrcheck_"))
    try:
        PBR.ROOT = tmp
        cat = tmp / "Stone" / "Walls"
        cat.mkdir(parents=True)
        with zipfile.ZipFile(cat / "rough_brick_2k.zip", "w") as z:
            for k in ("diff", "ao", "rough"):
                z.writestr(f"textures/rough_brick_{k}_2k.jpg", b"jpg")
            z.writestr("rough_brick_disp_2k.png", b"png")
            z.writestr("rough_brick_nor_dx_2k.png", b"png")
            z.writestr("rough_brick_nor_gl_2k.exr", b"exr")
            z.writestr("rough_brick.blend", b"blend")
        (tmp / "_hidden" / "x").mkdir(parents=True)
        (tmp / "_hidden" / "x" / "x_diff_1k.jpg").write_bytes(b"jpg")
        sets = PBR.scan()
        ref = "pbr/Stone/Walls/rough_brick"
        ok(list(sets) == [ref], f"scan found {list(sets)}, wanted [{ref}]")
        m = sets.get(ref) or {}
        ok(m.get("category") == "Stone/Walls", f"category {m.get('category')}")
        ok(sorted(m.get("maps", {})) == ["albedo", "ao", "height", "normal", "rough"], f"maps {m.get('maps')}")
        ok(m.get("maps", {}).get("normal") == "rough_brick_nor_gl_2k.exr" and m.get("normal") == "gl",
           f"a GL normal (even EXR) beats a DX one: {m.get('maps', {}).get('normal')} {m.get('normal')}")
        ok(not (cat / "rough_brick" / "rough_brick.blend").exists(), "only images come out of a ZIP")
        ok(m.get("source") == "Poly Haven" and m.get("url") == "https://polyhaven.com/a/rough_brick", f"source {m.get('url')}")
        (cat / "rough_brick" / "rough_brick_nor_gl_2k.exr").unlink()
        m = PBR.scan()[ref]
        ok(m["normal"] == "dx" and m["maps"]["normal"].endswith("_nor_dx_2k.png"), "the DX normal when there's no GL one")
        s0 = m["stamp"]
        PBR.save(ref, {"tile_m": 1.25, "note": "mine"})
        (cat / "rough_brick" / "rough_brick_rough_2k.jpg").write_bytes(b"a longer jpg")
        m = PBR.scan()[ref]
        ok(m["tile_m"] == 1.25 and m.get("note") == "mine", "what you set survives a rescan")
        ok(m["stamp"] != s0, "a changed map changes the stamp (Unreal re-imports)")
        # a set straight in the shelf (no category), and its maps chosen by hand over what the names say
        flat = tmp / "denim1"; flat.mkdir()
        for f in ("denim1_albedo.png", "denim1_normal-dx.png", "denim1_roughness.png", "denim1_worn.png", "denim1_mask.png"):
            (flat / f).write_bytes(b"png")
        m = PBR.scan()["pbr/denim1"]
        ok(m["category"] == "" and m["normal"] == "dx" and m["maps"].get("opacity") == "denim1_mask.png", f"flat set {m['maps']}")
        PBR.save("pbr/denim1", {"by_hand": {"albedo": "denim1_worn.png", "opacity": "", "normal": "denim1_normal-dx.png"}})
        m = PBR.scan()["pbr/denim1"]
        ok(m["maps"]["albedo"] == "denim1_worn.png" and "opacity" not in m["maps"] and m["normal"] == "gl", f"by hand {m['maps']} {m['normal']}")
        ok("denim1_worn.png" in m["files"] and m["by_hand"]["opacity"] == "", "the files to choose from, and by_hand kept")
        try:
            PBR.save("pbr/denim1", {"by_hand": {"albedo": "nothing.png"}})
            bad.append("by_hand took a file that isn't in the set")
        except ValueError:
            pass
        ok(PBR.set_dir("pbr/denim1") == flat and PBR.roots() == [tmp], "a moved ROOT reads only itself")
        ok(LIB.split(ref) == ("pbr", "Stone/Walls/rough_brick") and LIB.is_texture(ref), "library refs")
        ok(LIB.fetched(ref, "texture") and not LIB.fetched("pbr/Stone/nothing", "texture"), "fetched = on the shelf")
        ok(LIB.texture_dir(ref) == cat / "rough_brick", "texture_dir")
        ok(PBR.unreal_path("pbr/Old Wood/dark planks") == ("/Game/Studio/PBR/Old_Wood/dark_planks", "MI_dark_planks"),
           f"unreal path {PBR.unreal_path('pbr/Old Wood/dark planks')}")
        for b in ("pbr/", "pbr/a/../b", "pbr//x"):
            try:
                PBR.split_ref(b)
                bad.append(f"{b} should be a bad ref")
            except ValueError:
                pass
        # a folder of yours attached where it is (ASSETS §6): its sets pbr/<name>/<set>, nothing written in it (their meta
        # and thumbnails mirrored in ROOT/_attached), its ZIPs left as they are; a name or a folder the shelf has is refused
        mine = Path(tempfile.mkdtemp(prefix="pbrmine_"))
        try:
            (mine / "Bricks" / "red_brick").mkdir(parents=True)
            for k in ("diff", "nor_gl", "rough"):
                (mine / "Bricks" / "red_brick" / f"red_brick_{k}_1k.jpg").write_bytes(b"jpg")
            with zipfile.ZipFile(mine / "boxed_2k.zip", "w") as z:
                z.writestr("boxed_diff_2k.jpg", b"jpg")
            before = sorted(str(f.relative_to(mine)) for f in mine.rglob("*"))
            rows = PBR.attach(mine, "mylib")
            ok([r["name"] for r in rows] == ["mylib"] and PBR.attached()[0]["path"] == str(mine.resolve()), f"attached {rows}")
            mref = "pbr/mylib/Bricks/red_brick"
            sets = PBR.scan()
            ok(mref in sets and sets[mref].get("category") == "mylib/Bricks" and sets[mref].get("attached") == "mylib", f"its set on the shelf: {sorted(sets)}")
            ok(PBR.set_dir(mref) == mine / "Bricks" / "red_brick" and LIB.fetched(mref, "texture"), "its ref resolves where it is")
            PBR.save(mref, {"tile_m": 1.5})
            ok(PBR.meta(PBR.set_dir(mref))["tile_m"] == 1.5 and PBR.meta_file(PBR.set_dir(mref)).is_relative_to(tmp / "_attached" / "mylib"), "what you set kept in its mirror")
            ok(sorted(str(f.relative_to(mine)) for f in mine.rglob("*")) == before, "nothing written in your folder (no meta.json, no thumbnail, its ZIP unopened)")
            ok(PBR.own_file(mref, "_thumb.jpg").parent == PBR.side(PBR.set_dir(mref)) and PBR.own_file(mref, "red_brick_diff_1k.jpg") == mine / "Bricks" / "red_brick" / "red_brick_diff_1k.jpg",
               "the server's files: maps from your folder, ours from the mirror")
            for args, why in (((mine, "other"), "the same folder twice"), ((cat, "x"), "a folder on the shelf"), ((tmp / "nowhere", "y"), "no such folder"),
                              ((mine / "Bricks", "Stone"), "a name the shelf has"), ((mine / "Bricks", "bad name!"), "a name with spaces")):
                try:
                    PBR.attach(*args)
                    bad.append(f"attach should refuse {why}")
                except ValueError:
                    pass
            PBR.detach("mylib")
            ok(not PBR.attached() and mref not in PBR.scan(write=False) and PBR.set_dir(mref) == tmp / "mylib" / "Bricks" / "red_brick", "detached: its sets off the shelf")
            PBR.attach(mine, "mylib")
            ok(PBR.meta(PBR.set_dir(mref))["tile_m"] == 1.5, "attached again: what you set is still there")
        finally:
            shutil.rmtree(mine, ignore_errors=True)
    finally:
        PBR.ROOT = old_root
        PBR._ATT["key"] = None
        shutil.rmtree(tmp, ignore_errors=True)
    check_cells(ok, bad)
    for b in bad:
        print("FAIL " + b)
    print("PBR ok" if not bad else f"PBR FAILED ({len(bad)})")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    a = sys.argv[1:]
    {"demo": cmd_demo, "check": cmd_check, "list": cmd_list}.get(a[0] if a else "list", cmd_list)(a[1:])

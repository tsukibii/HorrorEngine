"""The PBR shelf (docs/ASSETS.md §6): your own texture sets, in category folders, used like the library's.

    Content/Studio/PBR/            (or $STUDIO_PBR, e.g. a folder on another drive)
      Wood/
        old_planks/                one set: its maps as they came (old_planks_diff_2k.jpg, _ao_, _disp_, _nor_dx_, _rough_)
        dark_wood_2k.zip           a ZIP dropped in is unpacked into dark_wood/ on the next scan
      Stone/Walls/rough_brick/     categories can nest

A set's ref is `pbr/<its path>` (`pbr/Wood/old_planks`), in a room's `look` or a prop's `mat`, like `ambientcg/...`.
Scanning writes a meta.json next to the maps (which file is which map, the normal's convention, `tile_m`: the metres
one repeat covers) and a small `_thumb.jpg`; what you set by hand in meta.json (tile_m, source, url, licence) is kept.
Plain Python, no `unreal` import: the tools, the desk's server and the importer all use it.
"""
import hashlib
import json
import os
import re
import zipfile
from pathlib import Path

from . import storylib as L

ROOT = Path(os.environ.get("STUDIO_PBR") or (L.STUDIO / "PBR"))
IMG = (".jpg", ".jpeg", ".png", ".tga", ".tif", ".tiff", ".exr")
WEB = (".jpg", ".jpeg", ".png")                 # what the desk can show (and what's preferred when both are there)
KEEP = ("tile_m", "source", "url", "licence", "note")
# the last word(s) of a map's file name, after its resolution (2k, 4K-JPG) is taken off: Poly Haven, ambientCG and plain names
WORDS = {
    "albedo": ("diff", "diffuse", "color", "colour", "col", "albedo", "basecolor", "base_color"),
    "normal": ("nor_gl", "normalgl", "normal_gl", "normal", "nrm", "nor"),
    "normal_dx": ("nor_dx", "normaldx", "normal_dx"),
    "rough": ("rough", "roughness", "rgh"),
    "ao": ("ao", "ambientocclusion", "ambient_occlusion", "occlusion"),
    "height": ("disp", "displacement", "height", "bump"),
    "metal": ("metal", "metalness", "metallic"),
    "opacity": ("opacity", "alpha", "mask"),
    "arm": ("arm", "orm"),                      # packed AO/rough/metal (R, G, B): the clothes use it; Unreal takes the separate maps
}
_RES = re.compile(r"^\d+k(-(jpg|png|exr))?$|^\d+$")


def map_of(filename):
    """'old_planks_nor_dx_2k.png' -> 'normal_dx'; 'Planks012_2K-JPG_Color.jpg' -> 'albedo'; None if it isn't a map."""
    toks = [t for t in re.split(r"[_\-\s.]+", Path(filename).stem.lower()) if t]
    if any(t in ("preview", "thumb", "sphere", "cube") for t in toks):
        return None
    while toks and _RES.match(toks[-1]):
        toks.pop()
    toks = [t for t in toks if not _RES.match(t)]
    for n in (2, 1):
        tail = "_".join(toks[-n:]) if len(toks) >= n else None
        if tail:
            for key, words in WORDS.items():
                if tail in words:
                    return key
    return None


def split_ref(ref):
    """'pbr/Wood/old_planks' -> 'Wood/old_planks'."""
    rest = str(ref)[4:] if str(ref).startswith("pbr/") else ""
    parts = rest.split("/")
    if not rest or not all(parts) or ".." in parts:
        raise ValueError(f"bad PBR ref {ref!r}: 'pbr/<category>/<name>', like pbr/Wood/old_planks")
    return rest


def set_dir(ref):
    return ROOT.joinpath(*split_ref(ref).split("/"))


def read_maps(d):
    """{map: file name} for the images in a folder (web formats before EXR), the normal's convention, and a packed
    AO/rough/metal map's file name (or None)."""
    found = {}
    for f in sorted(d.iterdir(), key=lambda f: (f.suffix.lower() not in WEB, f.name)):
        if f.is_file() and f.suffix.lower() in IMG and not f.name.startswith("_"):
            k = map_of(f.name)
            if k and k not in found:
                found[k] = f.name
    maps = {k: v for k, v in found.items() if k not in ("normal_dx", "arm")}
    conv = "gl"
    if "normal" not in maps and "normal_dx" in found:
        maps["normal"], conv = found["normal_dx"], "dx"
    return maps, conv, found.get("arm")


def guess_source(d, maps):
    """Poly Haven's file names (<slug>_diff_2k.jpg) give its page; anything else is yours to fill in."""
    a = maps.get("albedo", "")
    m = re.match(r"^(.+?)_(diff|col)_\d+k\.", a)
    if m:
        return {"source": "Poly Haven", "url": f"https://polyhaven.com/a/{m.group(1)}", "licence": "CC0-1.0"}
    m = re.match(r"^(.+?)_\d+K-(JPG|PNG)_Color\.", a)
    if m:
        return {"source": "ambientCG", "url": f"https://ambientcg.com/view?id={m.group(1)}", "licence": "CC0-1.0"}
    return {"source": "yours", "url": "", "licence": "CC0-1.0"}


def stamp(d, maps):
    """Changes when a map's file changes: the importer re-imports the set into Unreal when it does."""
    h = hashlib.sha1()
    for k in sorted(maps):
        f = d / maps[k]
        st = f.stat() if f.exists() else None
        h.update(f"{k}:{maps[k]}:{st.st_size if st else 0}:{int(st.st_mtime) if st else 0};".encode())
    return h.hexdigest()[:12]


def meta(d, write=False):
    """A set's meta from its folder (meta.json kept for what you set by hand); None if it has no colour map."""
    p = d / "meta.json"
    old = {}
    if p.exists():
        try:
            old = json.loads(p.read_text(encoding="utf-8"))
        except ValueError:
            old = {}
    maps, conv, arm = read_maps(d)
    if "albedo" not in maps:
        return None
    m = {"maps": maps, "normal": conv, "tile_m": 2.0}
    m.update(guess_source(d, maps))
    m.update({k: old[k] for k in KEEP if k in old})
    if arm:
        m["arm"] = "packed AO/rough/metal map: the Studio's clothes use it where the separate maps are missing; Unreal takes the separate maps"
        m["orm"] = arm
    m["stamp"] = stamp(d, maps)
    if write and {k: old.get(k) for k in m} != m:
        p.write_text(json.dumps(m, indent=1), encoding="utf-8")
    if write:
        _thumb(d, maps["albedo"])
    m["thumb"] = "_thumb.jpg" if (d / "_thumb.jpg").exists() else maps["albedo"]
    return m


def _thumb(d, albedo):
    t, src = d / "_thumb.jpg", d / albedo
    if t.exists() and t.stat().st_mtime >= src.stat().st_mtime:
        return
    try:
        from PIL import Image
    except ImportError:          # the desk shows the colour map itself
        return
    try:
        im = Image.open(src)
        im.draft("RGB", (256, 256))
        im = im.convert("RGB")
        im.thumbnail((256, 256))
        im.save(t, quality=85)
    except Exception:   # noqa: BLE001 - an EXR or an odd file: no thumbnail, the desk copes
        pass


def unpack(z):
    """A ZIP dropped into a category: its images go into a folder named after it (the resolution taken off)."""
    name = re.sub(r"[_\-](\d+k)([_\-](jpg|png|exr))?$", "", z.stem, flags=re.I) or z.stem
    d = z.parent / name
    if d.exists():
        return None
    try:
        with zipfile.ZipFile(z) as zf:
            imgs = [n for n in zf.namelist() if not n.endswith("/") and Path(n).suffix.lower() in IMG]
            if not imgs:
                return None
            d.mkdir()
            for n in imgs:
                (d / Path(n).name).write_bytes(zf.read(n))
    except zipfile.BadZipFile:
        return None
    return d


def scan(write=True):
    """Every set on the shelf: {ref: meta}. Unpacks new ZIPs and refreshes meta.json and thumbnails when `write`."""
    out = {}
    if not ROOT.exists():
        return out
    if write:
        for z in sorted(ROOT.rglob("*.zip")):
            unpack(z)
    for d in sorted({f.parent for f in ROOT.rglob("*") if f.is_file() and f.suffix.lower() in IMG}):
        rel = d.relative_to(ROOT).as_posix()
        if rel == "." or any(part.startswith((".", "_")) for part in rel.split("/")):
            continue
        m = meta(d, write=write)
        if m:
            m["category"] = rel.rsplit("/", 1)[0] if "/" in rel else ""
            out[f"pbr/{rel}"] = m
    return out


def save(ref, fields):
    """Set tile_m, source, url, licence or note on a set (the shelf page's Save)."""
    d = set_dir(ref)
    m = meta(d)
    if m is None:
        raise ValueError(f"{ref}: no such set (no colour map in {d})")
    p = d / "meta.json"
    old = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    for k in KEEP:
        if k in fields:
            old[k] = float(fields[k]) if k == "tile_m" else str(fields[k])
    if "tile_m" in old and not (0.05 <= old["tile_m"] <= 50):
        raise ValueError("tile_m: the metres one repeat covers, 0.05 to 50")
    p.write_text(json.dumps(old, indent=1), encoding="utf-8")
    return meta(d, write=True)


def unreal_path(ref):
    """Where the set lives in Unreal: /Game/Studio/PBR/<category>/<name>/ (names made safe for Unreal's paths)."""
    parts = [re.sub(r"[^A-Za-z0-9_\-]", "_", p) for p in split_ref(ref).split("/")]
    return "/Game/Studio/PBR/" + "/".join(parts), "MI_" + parts[-1]

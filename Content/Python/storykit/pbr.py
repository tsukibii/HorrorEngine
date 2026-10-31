"""The PBR shelf (docs/ASSETS.md §6): your own texture sets, a folder each (in category folders if you like), used like
the library's.

    assets/pbr/                    (or $STUDIO_PBR, e.g. a folder on another drive; nothing in it is tracked by git)
      denim1/                      one set: its maps as they came (denim1_albedo.png, _ao, _height, _metallic, _normal-dx,
                                   _roughness: the last word of each name says which map it is)
      Wood/old_planks/             in a category: old_planks_diff_2k.jpg, _ao_, _disp_, _nor_dx_, _rough_
      Wood/dark_wood_2k.zip        a ZIP dropped in is unpacked into dark_wood/ on the next scan

The project's own sets live in git at `pbr/<category>/<set>` beside assets/ (the user's ambientCG sets, merged
2026-10-31: asphalt, concrete, roofing tiles...): read after assets/pbr, their meta.json kept in git with each set's
real size and a label. A set's ref is `pbr/<its path>` (`pbr/denim1`, `pbr/Wood/old_planks`,
`pbr/concrete/Concrete010_1K-PNG`), in a room's `look`, a prop's `mat` or a garment's `pbr`; `pbr/_made/<hash>` is a
set made from another by a street's look (pbrmix.py). Scanning writes a meta.json next to the maps (which file is which map, the normal's convention, `tile_m`: the
metres one repeat covers) and a small `_thumb.jpg`; what you set by hand in meta.json (tile_m, source, url, licence,
note, and `by_hand`: a map's file chosen by hand over its name) is kept. The shelf used to be Content/Studio/PBR: sets
still there are read too (the new place wins), new ones go to assets/pbr.
Plain Python, no `unreal` import: the tools, the desk's and the Studio's servers and the importer all use it.
"""
import hashlib
import json
import os
import re
import zipfile
from pathlib import Path

from . import storylib as L

DEFAULT = Path(os.environ.get("STUDIO_PBR") or (L.ROOT / "assets" / "pbr"))
ROOT = DEFAULT                                  # where new sets go (pbr.py's check points it at a scratch folder)
OLD = L.STUDIO / "PBR"                          # the shelf's first place: still read, unless ROOT was moved
TRACKED = L.ROOT / "pbr"                        # the project's own sets, in git


def roots():
    """The folders sets are read from, the first winning: ROOT, the project's own (pbr/), and the old place while ROOT
    is the default."""
    default = ROOT == DEFAULT                   # not moved by a check (STUDIO_PBR only moves your own sets: the project's stay)
    old = default and not os.environ.get("STUDIO_PBR") and OLD.is_dir() and OLD != ROOT
    return [ROOT] + ([TRACKED] if default and TRACKED.is_dir() else []) + ([OLD] if old else [])
IMG = (".jpg", ".jpeg", ".png", ".tga", ".tif", ".tiff", ".exr")
WEB = (".jpg", ".jpeg", ".png")                 # what the desk can show (and what's preferred when both are there)
KEEP = ("tile_m", "tile_v_m", "source", "url", "licence", "note", "by_hand", "tint", "label", "group", "family", "relief_m", "wear", "recipe")
# the maps a set can have, as `by_hand` names them: a file name, or "" for none (`normal_dx`: a DirectX normal)
SLOTS = ("albedo", "normal", "normal_dx", "rough", "metal", "ao", "height", "opacity", "orm")
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
    """The set's folder: where it is on the shelf, or where it would go in ROOT."""
    rel = split_ref(ref).split("/")
    for r in roots():
        if r.joinpath(*rel).is_dir():
            return r.joinpath(*rel)
    return ROOT.joinpath(*rel)


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
    hand = old.get("by_hand") if isinstance(old.get("by_hand"), dict) else {}
    maps, conv, arm = with_hand(d, hand, *read_maps(d))
    if "albedo" not in maps:
        return None
    m = {"maps": maps, "normal": conv, "tile_m": 2.0}
    m.update(guess_source(d, maps))
    m.update({k: old[k] for k in KEEP if k in old})
    if arm:
        m["arm"] = "packed AO/rough/metal map: the Studio's clothes use it where the separate maps are missing; Unreal takes the separate maps"
        m["orm"] = arm
    keep = dict(m)                             # what's written: not the stamp, which file times make (a checkout changes them)
    m["stamp"] = stamp(d, maps)
    if write and ({k: old.get(k) for k in keep} != keep or "stamp" in old):
        p.write_text(json.dumps(keep, indent=1), encoding="utf-8")
    if write:
        _thumb(d, maps["albedo"])
    m["thumb"] = "_thumb.jpg" if (d / "_thumb.jpg").exists() else maps["albedo"]
    m["files"] = images(d)                     # every image in the folder, for choosing a map by hand
    return m


def images(d):
    return sorted(f.name for f in d.iterdir() if f.is_file() and f.suffix.lower() in IMG and not f.name.startswith("_"))


def with_hand(d, hand, maps, conv, arm):
    """`by_hand` over what the names say: a slot's file (when it's in the folder) or "" for none; `normal_dx` makes the
    normal a DirectX one, `normal` a GL one, `orm` the packed AO/rough/metal map."""
    maps = dict(maps)
    for k, f in hand.items():
        if k not in SLOTS or not isinstance(f, str) or (f and not (d / f).is_file()):
            continue
        if k == "orm":
            arm = f or None
        elif k in ("normal", "normal_dx"):
            if f:
                maps["normal"], conv = f, "dx" if k == "normal_dx" else "gl"
            else:
                maps.pop("normal", None)
        elif f:
            maps[k] = f
        else:
            maps.pop(k, None)
    return maps, conv, arm


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
    if write and ROOT == DEFAULT:
        ROOT.mkdir(parents=True, exist_ok=True)     # somewhere to put the first set
    for root in roots():
        if not root.exists():
            continue
        if write:
            for z in sorted(root.rglob("*.zip")):
                unpack(z)
        for d in sorted({f.parent for f in root.rglob("*") if f.is_file() and f.suffix.lower() in IMG}):
            rel = d.relative_to(root).as_posix()
            if rel == "." or any(part.startswith((".", "_")) for part in rel.split("/")) or f"pbr/{rel}" in out:
                continue
            m = meta(d, write=write)
            if m:
                m["category"] = rel.rsplit("/", 1)[0] if "/" in rel else ""
                out[f"pbr/{rel}"] = m
    return out


def save(ref, fields):
    """Set tile_m, source, url, licence, note or by_hand ({slot: file or ""}: a map chosen by hand) on a set (the shelf
    page's Save)."""
    d = set_dir(ref)
    m = meta(d)
    if m is None:
        raise ValueError(f"{ref}: no such set (no colour map in {d})")
    p = d / "meta.json"
    old = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    for k in KEEP:
        if k in fields and k == "by_hand":
            hand = fields[k] if isinstance(fields[k], dict) else {}
            bad = [f for k2, f in hand.items() if k2 not in SLOTS or not isinstance(f, str) or (f and f not in images(d))]
            if bad:
                raise ValueError(f"by_hand: a map is one of {', '.join(SLOTS)} and a file in the set, or \"\" for none")
            old[k] = {k2: f for k2, f in hand.items()}
        elif k in fields:
            old[k] = float(fields[k]) if k == "tile_m" else str(fields[k])
    if "tile_m" in old and not (0.05 <= old["tile_m"] <= 50):
        raise ValueError("tile_m: the metres one repeat covers, 0.05 to 50")
    p.write_text(json.dumps(old, indent=1), encoding="utf-8")
    return meta(d, write=True)


def unreal_path(ref):
    """Where the set lives in Unreal: /Game/Studio/PBR/<category>/<name>/ (names made safe for Unreal's paths)."""
    parts = [re.sub(r"[^A-Za-z0-9_\-]", "_", p) for p in split_ref(ref).split("/")]
    return "/Game/Studio/PBR/" + "/".join(parts), "MI_" + parts[-1]

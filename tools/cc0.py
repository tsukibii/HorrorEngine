#!/usr/bin/env python3
"""The CC0 library (docs/ASSETS.md): find, fetch and record public-domain meshes and textures in Content/Studio/Library.

    python tools/cc0.py list [section] [word]       the awesome-cc0 list (docs/assets/awesome-cc0.md): where to look
    python tools/cc0.py props <word> [word...]      search the mesh indexes (The Base Mesh: 900 real-scale props)
    python tools/cc0.py textures <word>             search ambientCG (prints the site's search if the API won't answer)
    python tools/cc0.py get <ref> [ref...] [--res 1K|2K|4K] [--tile <m>]   fetch: basemesh/<name>, ambientcg/<AssetId>
    python tools/cc0.py add <file or folder> <lib/name> [--tile <m>] [--url <where from>] [--licence CC0-1.0]
                                                    yours, or a manual download (Poly Haven, Texture Ninja, Kenney...)
    python tools/cc0.py needs [--game G]            what the story uses from the library, fetched or not
    python tools/cc0.py fetch [--game G]            get everything the story uses that isn't here yet
    python tools/cc0.py index <folder> <lib>        (re)build Library/index/<lib>.json from a folder of glbs
    python tools/cc0.py ledger [out.md]             every fetched file: source, url, licence (the credits list)

Refs are <lib>/<name> (storykit/library.py). Poly Haven is CC0 too, but its API's terms want a licence for commercial
projects: download from the site by hand, then `add`.
"""
import io
import itertools
import json
import re
import struct
import sys
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "Content" / "Python"))
from storykit import storylib as L, library as LIB  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

LIST = L.ROOT / "docs" / "assets" / "awesome-cc0.md"
UA = {"User-Agent": "HorrorStudio-cc0/1 (a game studio's asset fetcher)"}
BASEMESH_RAW = "https://raw.githubusercontent.com/M3-org/base-meshes/main/models/{0}/{0}.glb"
BASEMESH_PAGE = "https://thebasemesh.com/ (glTF: https://github.com/M3-org/base-meshes)"
AMBIENT_GET = "https://ambientcg.com/get?file={id}_{res}-JPG.zip"
AMBIENT_SEARCH = "https://ambientcg.com/api/v2/full_json?type=Material&q={q}&limit=20&sort=Popular"
MAP_WORDS = [("albedo", ("color", "albedo", "diffuse", "diff", "basecolor", "base_color", "col")),
             ("normal", ("normalgl", "nor_gl", "normal", "nrm", "nor")),
             ("rough", ("roughness", "rough", "rgh")),
             ("ao", ("ambientocclusion", "occlusion", "_ao", "ao")),
             ("height", ("displacement", "height", "disp", "bump")),
             ("metal", ("metalness", "metallic", "metal")),
             ("opacity", ("opacity", "alpha", "mask"))]
IMG = (".jpg", ".jpeg", ".png", ".tga", ".exr", ".tif", ".tiff")


def opt(args, name, default=None):
    if name in args:
        i = args.index(name)
        v = args[i + 1]
        del args[i:i + 2]
        return v
    return default


def http(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


# ---- the list ---------------------------------------------------------------------------------------------------
def cmd_list(args):
    sec, word = (args + [None, None])[:2]
    cur = None
    for line in LIST.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            cur = line[3:].strip()
            continue
        m = re.match(r"\s*- \[(.+?)\]\((.+?)\)\s*-?\s*(.*)", line)
        if not m or cur in ("To-do", "Contributing"):
            continue
        if sec and sec.lower() not in cur.lower():
            continue
        if word and word.lower() not in line.lower():
            continue
        print(f"{cur:10} {m.group(1)}: {m.group(3)}  {m.group(2)}")


# ---- meshes -----------------------------------------------------------------------------------------------------
def _qm(q):
    x, y, z, w = q
    return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]


def _mat(n):
    if "matrix" in n:
        m = n["matrix"]
        return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    R, s, t = _qm(n.get("rotation", [0, 0, 0, 1])), n.get("scale", [1, 1, 1]), n.get("translation", [0, 0, 0])
    return [[R[r][0] * s[0], R[r][1] * s[1], R[r][2] * s[2], t[r]] for r in range(3)] + [[0, 0, 0, 1]]


def _mul(a, b):
    return [[sum(a[r][k] * b[k][c] for k in range(4)) for c in range(4)] for r in range(4)]


def glb_info(path):
    """{'size_m': [x, y, z], 'tris', 'kb'}: the world-space box (node transforms applied, glTF Y up)."""
    b = Path(path).read_bytes()
    n = struct.unpack_from("<I", b, 12)[0]
    j = json.loads(b[20:20 + n])
    lo, hi, tris = [1e9] * 3, [-1e9] * 3, 0

    def walk(i, M):
        nonlocal tris
        nd = j["nodes"][i]
        W = _mul(M, _mat(nd))
        if "mesh" in nd:
            for p in j["meshes"][nd["mesh"]]["primitives"]:
                a = j["accessors"][p["attributes"]["POSITION"]]
                for c in itertools.product(*zip(a["min"], a["max"])):
                    w = [sum(W[r][k] * c[k] for k in range(3)) + W[r][3] for r in range(3)]
                    for k in range(3):
                        lo[k], hi[k] = min(lo[k], w[k]), max(hi[k], w[k])
                tris += (j["accessors"][p["indices"]]["count"] if "indices" in p else a["count"]) // 3
        for ch in nd.get("children", []):
            walk(ch, W)
    eye = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
    for i in j["scenes"][j.get("scene", 0)]["nodes"]:
        walk(i, eye)
    return {"size_m": [round(hi[k] - lo[k], 3) for k in range(3)], "tris": tris, "kb": len(b) // 1024}


def cmd_index(args):
    folder, lib = Path(args[0]), args[1]
    out = {g.stem: glb_info(g) for g in sorted(folder.rglob("*.glb"))}
    LIB.INDEX.mkdir(parents=True, exist_ok=True)
    (LIB.INDEX / f"{lib}.json").write_text(json.dumps(out, separators=(",", ":"), sort_keys=True), encoding="utf-8")
    print(f"index/{lib}.json: {len(out)} meshes")


def cmd_props(args):
    words = [w.lower() for w in args]
    libs = sorted(p.stem for p in LIB.INDEX.glob("*.json")) if LIB.INDEX.exists() else []
    n = 0
    for lib in libs:
        for name, v in sorted(LIB.mesh_index(lib).items()):
            if all(w in name for w in words):
                x, y, z = v["size_m"]
                have = "fetched" if LIB.mesh_file(f"{lib}/{name}").exists() else ""
                print(f"{lib}/{name:34} w {x:.2f} d {z:.2f} h {y:.2f} m  {v['tris']:>6} tris  {v['kb']:>5} KB  {have}")
                n += 1
    print(f"{n} found" + ("" if n else "  (try one shorter word; `cc0.py list 3d` for other sources)"))


def get_basemesh(name):
    ref = f"basemesh/{name}"
    if name not in LIB.mesh_index("basemesh"):
        raise SystemExit(f"{ref}: not in the index (`cc0.py props <word>`)")
    url = BASEMESH_RAW.format(name)
    data = http(url)
    f = LIB.mesh_file(ref)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_bytes(data)
    LIB.record(ref, "mesh", "The Base Mesh (M3-org/base-meshes)", url)
    print(f"{ref}: {len(data) // 1024} KB")


# ---- textures ---------------------------------------------------------------------------------------------------
def map_of(filename):
    n = Path(filename).stem.lower().replace("-", "_")
    if "normaldx" in n or "nor_dx" in n:
        return "normal_dx"
    if "preview" in n or "thumb" in n:
        return None
    for key, words in MAP_WORDS:
        if any(n.endswith(w) or f"_{w}" in n or n == w for w in words):
            return key
    return None


def store_textures(ref, files, tile, source, url, licence="CC0-1.0"):
    """files: {filename: bytes}. Keeps one file per map (GL normals before DX), writes meta.json and the ledger."""
    d = LIB.texture_dir(ref)
    d.mkdir(parents=True, exist_ok=True)
    maps, dx = {}, None
    for fn, data in sorted(files.items()):
        if Path(fn).suffix.lower() not in IMG:
            continue
        k = map_of(fn)
        if k == "normal_dx":
            dx = (fn, data)
            continue
        if k and k not in maps:
            out = f"{k}{Path(fn).suffix.lower()}"
            (d / out).write_bytes(data)
            maps[k] = out
    meta = {"maps": maps, "tile_m": float(tile), "source": source, "url": url, "licence": licence}
    if "normal" not in maps and dx:
        out = f"normal{Path(dx[0]).suffix.lower()}"
        (d / out).write_bytes(dx[1])
        maps["normal"], meta["normal"] = out, "dx"
    if "albedo" not in maps:
        print(f"  warning: no colour map found among {sorted(files)}")
    (d / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    LIB.record(ref, "texture", source, url, licence, maps=sorted(maps))
    print(f"{ref}: {', '.join(sorted(maps))} (one repeat = {tile} m)")


def get_ambientcg(aid, res, tile):
    url = AMBIENT_GET.format(id=aid, res=res)
    z = zipfile.ZipFile(io.BytesIO(http(url)))
    store_textures(f"ambientcg/{aid}", {Path(n).name: z.read(n) for n in z.namelist() if not n.endswith("/")},
                   tile, "ambientCG", url)


def cmd_textures(args):
    q = " ".join(args)
    try:
        d = json.loads(http(AMBIENT_SEARCH.format(q=urllib.parse.quote(q))))
        found = d.get("foundAssets") or d.get("assets") or []
        for a in found:
            aid = a.get("assetId") or a.get("id")
            print(f"ambientcg/{aid:20} {a.get('displayName', '')}  {', '.join(a.get('tags', [])[:6])}")
        print(f"{len(found)} found: `cc0.py get ambientcg/<id> --tile <metres one repeat covers>`")
    except Exception as e:     # noqa: BLE001  (the API moves: the site's search always works)
        print(f"ambientCG's API didn't answer ({e}). Search the site: https://ambientcg.com/list?type=material&q={urllib.parse.quote(q)}")
    print(f"Poly Haven (download by hand, then `add`): https://polyhaven.com/textures?s={urllib.parse.quote(q)}")
    print(f"Texture Ninja (photos, no PBR maps): https://texture.ninja/  (search '{q}')")


# ---- commands ---------------------------------------------------------------------------------------------------
def cmd_get(args):
    res, tile = opt(args, "--res", "2K"), opt(args, "--tile", "2")
    for ref in args:
        lib, name = LIB.split(ref)
        if lib == "basemesh":
            get_basemesh(name)
        elif lib == "ambientcg":
            get_ambientcg(name, res, tile)
        else:
            raise SystemExit(f"{ref}: `get` knows basemesh and ambientcg; for {lib}, download it and use `add`")


def cmd_add(args):
    tile, url, licence = opt(args, "--tile", "2"), opt(args, "--url", "added by hand"), opt(args, "--licence", "CC0-1.0")
    src, ref = Path(args[0]), args[1]
    lib, name = LIB.split(ref)
    if src.suffix.lower() == ".glb":
        f = LIB.mesh_file(ref)
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(src.read_bytes())
        idx = dict(LIB.mesh_index(lib))
        idx[name] = glb_info(f)
        LIB.INDEX.mkdir(parents=True, exist_ok=True)
        (LIB.INDEX / f"{lib}.json").write_text(json.dumps(idx, separators=(",", ":"), sort_keys=True), encoding="utf-8")
        LIB.record(ref, "mesh", lib, url, licence)
        x, y, z = idx[name]["size_m"]
        print(f"{ref}: w {x:.2f} d {z:.2f} h {y:.2f} m (check it's in metres: a chair is about 0.9 m tall)")
        return
    if src.suffix.lower() == ".zip":
        z = zipfile.ZipFile(src)
        files = {Path(n).name: z.read(n) for n in z.namelist() if not n.endswith("/")}
    elif src.is_dir():
        files = {p.name: p.read_bytes() for p in src.rglob("*") if p.is_file()}
    else:
        files = {"albedo" + src.suffix.lower(): src.read_bytes()}       # one photo: a colour map only
    store_textures(ref, files, tile, lib, url, licence)


def cmd_needs(args, fetch=False):
    game = opt(args, "--game")
    story, _ = L.load(game)
    rows = LIB.refs(story)
    missing = []
    for kind, ref, where in rows:
        try:
            ok = LIB.fetched(ref, kind)
        except ValueError as e:
            print(f"  BAD {where}: {e}")
            continue
        print(f"  {'ok ' if ok else '-- '} {kind:7} {ref:36} {where}")
        if not ok and (ref, kind) not in missing:
            missing.append((ref, kind))
    print(f"{len(rows)} uses, {len(missing)} not fetched")
    if fetch:
        for ref, kind in missing:
            lib = LIB.split(ref)[0]
            if lib in ("basemesh", "ambientcg"):
                try:
                    cmd_get([ref])
                except Exception as e:  # noqa: BLE001
                    print(f"  {ref}: {e}")
            else:
                print(f"  {ref}: download it by hand, then `cc0.py add <file> {ref}`")


def cmd_ledger(args):
    d = LIB.ledger()
    lines = ["# Third-party assets", "", "Every file fetched into Content/Studio/Library (tools/cc0.py keeps this).", "",
             "| Asset | Kind | Source | Licence | Fetched | From |", "| --- | --- | --- | --- | --- | --- |"]
    for ref, v in sorted(d.items()):
        lines.append(f"| {ref} | {v['kind']} | {v['source']} | {v['licence']} | {v['date']} | {v['url']} |")
    text = "\n".join(lines) + "\n"
    if args:
        Path(args[0]).write_text(text, encoding="utf-8")
        print(f"{args[0]}: {len(d)} assets")
    else:
        print(text)


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return
    cmd, args = argv[0], argv[1:]
    {"list": cmd_list, "props": cmd_props, "textures": cmd_textures, "get": cmd_get, "add": cmd_add,
     "needs": cmd_needs, "fetch": lambda a: cmd_needs(a, fetch=True), "index": cmd_index,
     "ledger": cmd_ledger}.get(cmd, lambda a: print(__doc__))(args)


if __name__ == "__main__":
    main(sys.argv[1:])

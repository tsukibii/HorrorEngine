#!/usr/bin/env python3
"""The prop generator's page: every recipe as its thumbnail, opened into a form of its settings (colours, words,
liquids, designs, a PBR set from the shelf on any material, your own pictures placed on its texture), made by Blender
in the background with its log, seen turning in 3D, kept as a recipe of its own (docs/PROPGEN.md §13).

    python tools/propgen/serve.py           then open http://127.0.0.1:8797 (PROPS_PORT for another)

It runs tools/propgen.py for every make, so it needs what that needs (Blender). Your recipes stay in
Content/Studio/Props/presets.json (a copy of it kept in Saved/Props/_history/ before every save), what's made in
Saved/Props/<name>/, the pictures you drop in Content/Studio/Props/images/. PROPS_PRESETS, PROPS_OUT and
PROPS_IMAGES move them (the page's check does). Plain Python; thumbnails are small when Pillow is there. Listens on
127.0.0.1 only.
"""
import ast
import base64
import copy
import json
import os
import queue
import re
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from propgen import recipes  # noqa: E402  (plain Python: no Blender)

PORT = int(os.environ.get("PROPS_PORT", 8797))
PRESETS = Path(os.environ.get("PROPS_PRESETS") or recipes.PRESETS).resolve()
OUT = Path(os.environ.get("PROPS_OUT") or recipes.OUT).resolve()
IMAGES = Path(os.environ.get("PROPS_IMAGES") or (ROOT / "Content" / "Studio" / "Props" / "images")).resolve()
PAGE = HERE / "page"
VENDOR = ROOT / "tools" / "director" / "vendor"
TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png",
         ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".glb": "model/gltf-binary", ".svg": "image/svg+xml", ".txt": "text/plain"}
NAME = re.compile(r"^[a-z0-9_][a-z0-9_\-]{0,80}$")
KEEP = 50


# ---- what the page can choose from, read from the generator's own code (no Blender, no numpy) -------------------------

def _literal(path, var):
    """A module-level dict or tuple's keys (or items) from a module, without importing it."""
    tree = ast.parse(Path(path).read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == var for t in node.targets):
            v = node.value
            if isinstance(v, ast.Dict):
                return [k.value for k in v.keys if isinstance(k, ast.Constant)]
            if isinstance(v, (ast.Tuple, ast.List)):
                return [e.value for e in v.elts if isinstance(e, ast.Constant)]
    return []


def _doc_options(doc):
    """What a family's docstring says a key may be: "kind": "pillar" | "church" | ... -> {kind: [pillar, church]}."""
    out = {}
    for m in re.finditer(r'"(\w+)":\s*((?:"[^"\n]+"\s*\|\s*)+"[^"\n]+")', doc or ""):
        out.setdefault(m.group(1), [])
        for o in re.findall(r'"([^"\n]+)"', m.group(2)):
            if o not in out[m.group(1)]:
                out[m.group(1)].append(o)
    return out


def choices():
    P = ROOT / "tools" / "propgen"
    fams = {}
    for fam in _literal(P / "families" / "__init__.py", "FAMILIES"):
        mod = "imported" if fam == "import" else fam
        f = P / "families" / f"{mod}.py"
        doc = ast.get_docstring(ast.parse(f.read_text(encoding="utf-8"))) if f.exists() else ""
        fams[fam] = {"doc": doc or "", "options": _doc_options(doc)}
    book = recipes.load(PRESETS)
    for n, r in book.items():                       # the kinds the recipes use, as options too
        try:
            sp = recipes.resolve(book, n)
        except SystemExit:
            continue
        o = fams.setdefault(sp.get("family", "?"), {"doc": "", "options": {}})["options"]
        if isinstance(sp.get("kind"), str) and sp["kind"] not in o.setdefault("kind", []):
            o["kind"].append(sp["kind"])
    return {"families": fams, "designs": sorted(_literal(P / "designs.py", "DESIGNS")), "fonts": sorted(_literal(P / "paint.py", "FONT_FILES")),
            "liquids": _literal(P / "liquid.py", "LIQUIDS"), "finishes": _literal(P / "finish.py", "FINISHES"),
            "metals": _literal(P / "finish.py", "METALS"), "ages": ["tarnish", "patina", "rust"],
            "poses": ["stand", "lie", "auto", "any", "upside"], "wear": ["grime", "dirt", "dust", "scratches", "edges", "stains", "fade"]}


def shelf():
    """The PBR shelf's sets: [{ref, category, tile_m, thumb}]."""
    try:
        from storykit import pbr as PBR
        sets = PBR.scan(write=True)
    except Exception as e:  # noqa: BLE001 - a shelf that can't be read is an empty one here
        return {"sets": [], "error": str(e)}
    out = []
    for ref, m in sorted(sets.items()):
        out.append({"ref": ref, "category": m.get("category", ""), "tile_m": m.get("tile_m"), "thumb": "/pbrthumb/" + ref[4:]})
    return {"sets": out}


def pbr_thumb(rel):
    try:
        from storykit import pbr as PBR
        d = PBR.set_dir("pbr/" + rel)
    except Exception:  # noqa: BLE001
        return None
    if not d or not Path(d).is_dir():
        return None
    d = Path(d)
    if PBR.thumb_file(d).exists():                     # beside its maps, or an attached folder's in its mirror
        return PBR.thumb_file(d)
    for f in sorted(d.iterdir()):
        if f.suffix.lower() in (".png", ".jpg", ".jpeg") and re.search(r"(albedo|diff|color|colour|basecolor|col)", f.stem, re.I):
            return f
    return None


# ---- recipes, what's made, thumbnails -----------------------------------------------------------------------------------

def made(name):
    d = OUT / name
    m = d / "meta.json"
    if not m.exists():
        return None
    try:
        meta = json.loads(m.read_text(encoding="utf-8"))
    except ValueError:
        return None
    meta["_mtime"] = int(m.stat().st_mtime)
    return meta


def listing():
    book = recipes.load(PRESETS)
    out = []
    for n, r in book.items():
        try:
            sp = recipes.resolve(book, n)
        except SystemExit as e:
            sp = {"family": r.get("family", "?"), "_error": str(e)}
        mt = made(n)
        out.append({"name": n, "family": sp.get("family"), "label": sp.get("label", ""), "from": r.get("from"), "raw": r, "spec": sp,
                    "made": bool(mt), "tris": mt and mt.get("tris"), "size_m": mt and mt.get("size_m"), "secs": mt and mt.get("secs"),
                    "thumb": f"/thumb/{n}?v={mt['_mtime']}" if mt else None,
                    "edited": bool(mt) and _bare(mt.get("spec")) != _bare(sp)})
    # props made from the page under names of their own that aren't recipes (variations), after the recipes
    names = set(book)
    extra = []
    if OUT.exists():
        for d in sorted(OUT.iterdir()):
            if d.is_dir() and not d.name.startswith("_") and d.name not in names and (d / "meta.json").exists():
                mt = made(d.name)
                if mt:
                    sp = mt.get("spec") or {}
                    extra.append({"name": d.name, "family": sp.get("family"), "label": sp.get("label", ""), "from": None, "raw": None, "spec": sp,
                                  "made": True, "tris": mt.get("tris"), "size_m": mt.get("size_m"), "secs": mt.get("secs"),
                                  "thumb": f"/thumb/{d.name}?v={mt['_mtime']}", "unsaved": True})
    return {"recipes": out + extra, "presets": str(PRESETS), "out": str(OUT)}


def _bare(sp):
    """A recipe as it shapes the prop: what only the tools set (the check's small textures) left out."""
    return {k: v for k, v in (sp or {}).items() if k not in ("tex",) and not k.startswith("_")}


def thumb(name):
    d = OUT / name
    pv = d / f"{name}_preview.png"
    if not pv.exists():
        return None
    t = OUT / "_thumbs" / f"{name}.jpg"
    if t.exists() and t.stat().st_mtime >= pv.stat().st_mtime:
        return t
    try:
        from PIL import Image
        t.parent.mkdir(parents=True, exist_ok=True)
        im = Image.open(pv).convert("RGB")
        im.thumbnail((400, 300))
        im.save(t, quality=86)
        return t
    except Exception:  # noqa: BLE001 - no Pillow: the preview itself
        return pv


def diff(a, b):
    """What a has that b hasn't (dicts key by key, anything else whole); what b has and a dropped as None."""
    out = {}
    for k, v in a.items():
        if k not in b:
            out[k] = v
        elif isinstance(v, dict) and isinstance(b[k], dict):
            d = diff(v, b[k])
            if d:
                out[k] = d
        elif v != b[k]:
            out[k] = v
    for k in b:
        if k not in a:
            out[k] = None
    return out


def backup():
    h = OUT / "_history"
    h.mkdir(parents=True, exist_ok=True)
    if PRESETS.exists():
        (h / f"presets_{time.strftime('%Y%m%d-%H%M%S')}.json").write_bytes(PRESETS.read_bytes())
    old = sorted(h.glob("presets_*.json"))
    for f in old[:-KEEP]:
        f.unlink()


def save_recipe(name, spec, base=None):
    """The page's recipe (resolved, as edited) into presets.json under `name`: as `from` its base and what differs,
    so the file stays readable; written whole when it has no base."""
    book = recipes.load(PRESETS)
    spec = {k: v for k, v in spec.items() if not k.startswith("_")}
    base = base if base and base in book and base != name else (book.get(name, {}).get("from") if name in book else None)
    if base and base in book:
        raw = {"label": spec.get("label", ""), "family": spec.get("family")}
        raw["from"] = base
        d = diff(spec, recipes.resolve(book, base))
        d.pop("label", None)
        d.pop("family", None)
        raw.update(d)
    else:
        raw = spec
    backup()
    book[name] = raw
    recipes.save(book, PRESETS)
    return raw


def delete_recipe(name):
    book = recipes.load(PRESETS)
    users = [n for n, r in book.items() if r.get("from") == name]
    if users:
        raise ValueError(f"{', '.join(users)} start from {name}: change them first")
    if name not in book:
        raise ValueError(f"no recipe {name}")
    backup()
    del book[name]
    recipes.save(book, PRESETS)


# ---- jobs: one Blender run at a time, their logs kept -------------------------------------------------------------------

JOBS, Q = {}, queue.Queue()
NOISE = re.compile(r"^(Fra:|Saved:|Time:|\s*$|Blender |Read prefs|Warning: Unable|Color management|Info: )")


def worker():
    while True:
        jid = Q.get()
        job = JOBS[jid]
        job["state"] = "running"
        job["started"] = time.time()
        try:
            p = subprocess.Popen(job["cmd"], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1,
                                 env=dict(os.environ, PYTHONUNBUFFERED="1"))
            job["pid"] = p.pid
            for line in p.stdout:
                line = line.rstrip("\n")
                if not NOISE.match(line):
                    job["log"].append(line)
            rc = p.wait()
            job["rc"] = rc
            job["state"] = "done" if rc == 0 else "failed"
        except Exception as e:  # noqa: BLE001
            job["log"].append(f"could not run: {e}")
            job["state"] = "failed"
        job["ended"] = time.time()


def new_job(kind, cmd, names):
    jid = f"{int(time.time() * 1000):x}"
    JOBS[jid] = {"id": jid, "kind": kind, "cmd": cmd, "names": names, "state": "queued", "log": [], "queued": time.time()}
    Q.put(jid)
    return jid


def make(body):
    """Make one recipe (as the page edited it) or several variations of it, each under its own name, through a copy of
    the recipe book with them written in whole."""
    if body.get("names") and not body.get("spec"):          # recipes as they are, from the book itself
        book = recipes.load(PRESETS)
        names = [n for n in body["names"] if n in book]
        if not names:
            raise ValueError("no such recipes")
        cmd = [sys.executable, str(ROOT / "tools" / "propgen.py"), "make", *names, "--presets", str(PRESETS), "--out", str(OUT),
               "--formats", str(body.get("formats") or "glb")]
        return {"job": new_job("make", cmd, names), "names": names}
    name = str(body.get("name") or "")
    spec = body.get("spec")
    if not NAME.match(name) or not isinstance(spec, dict):
        raise ValueError("a name (lower case, digits, _ and -) and its recipe")
    book = recipes.load(PRESETS)
    seeds = [int(s) for s in (body.get("seeds") or [spec.get("seed", 0)])][:12]
    names = []
    for i, s in enumerate(seeds):
        n = name if len(seeds) == 1 else f"{name}_v{i + 1}"
        book[n] = dict({k: v for k, v in spec.items() if not k.startswith("_")}, seed=s)
        names.append(n)
    tmp = OUT / "_page"
    tmp.mkdir(parents=True, exist_ok=True)
    tf = tmp / f"presets_{int(time.time() * 1000)}.json"
    tf.write_text(json.dumps({"_note": "made by the prop page", **book}, ensure_ascii=False), encoding="utf-8")
    for f in sorted(tmp.glob("presets_*.json"))[:-10]:
        f.unlink()
    cmd = [sys.executable, str(ROOT / "tools" / "propgen.py"), "make", *names, "--presets", str(tf), "--out", str(OUT),
           "--formats", str(body.get("formats") or "glb")]
    if body.get("tex"):
        cmd += ["--tex", str(int(body["tex"]))]
    if body.get("samples"):
        cmd += ["--samples", str(int(body["samples"]))]
    if body.get("cpu"):
        cmd += ["--cpu"]
    return {"job": new_job("make", cmd, names), "names": names}


def to_library(body):
    """Made props into the library as props/<name> (plain Python: their glb copied, their size in the index)."""
    names = [n for n in body.get("names") or [] if NAME.match(str(n))]
    if not names:
        raise ValueError("which props")
    done = []
    for n in names:
        mp = OUT / n / "meta.json"
        if not mp.exists():
            raise ValueError(f"{n}: not made yet")
        recipes.to_library(json.loads(mp.read_text(encoding="utf-8")), str(OUT))
        done.append(n)
    return {"names": done, "as": [f"props/{n}" for n in done]}


def upload(body):
    """A picture from the page (a data URL) into the pictures folder: its path as a recipe names it. A Krita .ora (the
    picture editor's template painted over) gives its Paint layer, or the one layer that isn't the Guide or the Base,
    or else its merged picture. A name that's taken by another picture gets _2, _3... (the same picture again is kept
    once)."""
    nm = re.sub(r"[^A-Za-z0-9_\-]+", "_", Path(str(body.get("name") or "picture")).stem)[:60] or "picture"
    data = str(body.get("data") or "")
    note = None
    if str(body.get("name") or "").lower().endswith(".ora"):
        m = re.match(r"^data:[^;,]*;base64,(.*)$", data, re.S)
        if not m:
            raise ValueError("a Krita .ora")
        raw, note = _ora_paint(base64.b64decode(m.group(1)))
        ext = ".png"
    else:
        m = re.match(r"^data:image/(png|jpeg|jpg);base64,(.*)$", data, re.S)
        if not m:
            raise ValueError("a PNG or a JPEG")
        ext = ".png" if m.group(1) == "png" else ".jpg"
        raw = base64.b64decode(m.group(2))
    IMAGES.mkdir(parents=True, exist_ok=True)
    f = IMAGES / (nm + ext)
    k = 2
    while f.exists() and f.read_bytes() != raw:
        f = IMAGES / f"{nm}_{k}{ext}"
        k += 1
    f.write_bytes(raw)
    out = {"path": _rel(f), "url": f"/images/{f.name}", "name": f.name}
    if note:
        out["note"] = note
    return out


def _ora_paint(raw):
    """The painting in an OpenRaster file (a zip: stack.xml names its layers, each a PNG): the layer called Paint, else
    the one layer that isn't Guide or Base, else the merged picture. (png bytes, what was taken)."""
    import io
    import zipfile
    from xml.etree import ElementTree
    try:
        z = zipfile.ZipFile(io.BytesIO(raw))
        stack = ElementTree.fromstring(z.read("stack.xml"))
    except (zipfile.BadZipFile, KeyError, ElementTree.ParseError) as e:
        raise ValueError(f"not an .ora Krita can save: {e}")
    layers = [(ly.get("name") or "", ly.get("src") or "") for ly in stack.iter("layer")]
    pick = next((s for n, s in layers if n.strip().lower() == "paint"), None)
    rest = [s for n, s in layers if n.strip().lower() not in ("guide", "base", "paint")]
    if pick is None and len(rest) == 1:
        pick = rest[0]
    if pick is not None:
        return z.read(pick), f"the .ora's {next(n for n, s in layers if s == pick)} layer"
    return z.read("mergedimage.png"), "the .ora's merged picture (no layer called Paint)"


def _rel(f):
    try:
        return f.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(f.resolve())


def pictures():
    if not IMAGES.exists():
        return {"images": []}
    return {"images": [{"name": f.name, "path": _rel(f), "url": f"/images/{f.name}"} for f in sorted(IMAGES.iterdir())
                       if f.suffix.lower() in (".png", ".jpg", ".jpeg")]}


# ---- the server -----------------------------------------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else (body if isinstance(body, str) else json.dumps(body, ensure_ascii=False)).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith(("text", "application/json")) else ""))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def file(self, path, cache=False):
        if path is None or not Path(path).is_file():
            return self.send(404, {"error": "not found"})
        data = Path(path).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", TYPES.get(Path(path).suffix.lower(), "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "max-age=3600" if cache else "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path, _, qs = self.path.partition("?")
        parts = [p for p in path.split("/") if p]
        if any(p.startswith(".") or "\\" in p for p in parts):
            return self.send(400, {"error": "bad path"})
        if not parts:
            return self.file(PAGE / "index.html")
        a = parts[0]
        if a == "page":
            return self.file(PAGE.joinpath(*parts[1:]))
        if a == "vendor":
            return self.file(VENDOR.joinpath(*parts[1:]), cache=True)
        if a == "thumb" and len(parts) == 2:
            return self.file(thumb(parts[1]), cache=True)
        if a == "props" and len(parts) == 3:
            return self.file(OUT / parts[1] / parts[2])
        if a == "images" and len(parts) == 2:
            return self.file(IMAGES / parts[1])
        if a == "pbrthumb":
            return self.file(pbr_thumb("/".join(parts[1:])), cache=True)
        if a == "smudges" and len(parts) == 2 and parts[1].endswith(".png"):
            from propgen import smudges
            try:
                return self.file(Path(smudges.path(parts[1][:-4])), cache=True)
            except ValueError as e:
                return self.send(404, {"error": str(e)})
        if a == "api":
            what = parts[1] if len(parts) > 1 else ""
            try:
                if what == "recipes":
                    return self.send(200, listing())
                if what == "recipe" and len(parts) == 3:
                    book = recipes.load(PRESETS)
                    n = parts[2]
                    sp = recipes.resolve(book, n) if n in book else ((made(n) or {}).get("spec"))
                    if sp is None:
                        return self.send(404, {"error": "no such recipe"})
                    return self.send(200, {"name": n, "raw": book.get(n), "spec": sp, "meta": made(n)})
                if what == "choices":
                    return self.send(200, choices())
                if what == "shelf":
                    return self.send(200, shelf())
                if what == "pictures":
                    return self.send(200, pictures())
                if what == "smudges":
                    from propgen import smudges
                    return self.send(200, {"smudges": [dict(v, name=k, path=f"smudge/{k}", url=f"/smudges/{k}.png")
                                                       for k, v in smudges.INDEX.items()]})
                if what == "job" and len(parts) == 3 and parts[2] in JOBS:
                    j = JOBS[parts[2]]
                    since = int((re.search(r"from=(\d+)", qs) or [0, 0])[1])
                    return self.send(200, {k: v for k, v in j.items() if k not in ("cmd", "log")} | {"log": j["log"][since:], "lines": len(j["log"])})
                if what == "jobs":
                    return self.send(200, {"jobs": [{k: v for k, v in j.items() if k not in ("cmd", "log")} for j in list(JOBS.values())[-20:]]})
            except SystemExit as e:
                return self.send(400, {"error": str(e)})
        return self.send(404, {"error": "not found"})

    def do_POST(self):
        parts = [p for p in self.path.split("?")[0].split("/") if p]
        n = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return self.send(400, {"error": "not JSON"})
        what = parts[1] if len(parts) > 1 and parts[0] == "api" else ""
        try:
            if what == "make":
                return self.send(200, make(body))
            if what == "save":
                name = str(body.get("name") or "")
                if not NAME.match(name) or not isinstance(body.get("spec"), dict):
                    raise ValueError("a name (lower case, digits, _ and -) and its recipe")
                return self.send(200, {"name": name, "raw": save_recipe(name, body["spec"], body.get("base"))})
            if what == "delete":
                delete_recipe(str(body.get("name") or ""))
                return self.send(200, {"ok": True})
            if what == "library":
                return self.send(200, to_library(body))
            if what == "upload":
                return self.send(200, upload(body))
        except (ValueError, SystemExit) as e:
            return self.send(400, {"error": str(e)})
        return self.send(404, {"error": "unknown"})


def main():
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError:
        sys.exit(f"port {PORT} is taken: is the prop page already open? (PROPS_PORT=8789 for another)")
    threading.Thread(target=worker, daemon=True).start()
    print(f"THE PROP GENERATOR on http://127.0.0.1:{PORT}  (recipes: {PRESETS}; made: {OUT})  (Ctrl+C stops it)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
